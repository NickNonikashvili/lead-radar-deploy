'use strict';

/**
 * SyncManager — keeps the local copy of every account's INBOX up to date.
 *
 * Per account, a sync:
 *   1. opens the mailbox read-only (EXAMINE — a sync can never change flags on the server);
 *   2. resets local mail if UIDVALIDITY changed;
 *   3. lists the live (not \Deleted) UIDs once and derives the new ones from it
 *      (initial sync: the newest INITIAL_SYNC_LIMIT; afterwards: UID > lastUid);
 *   4. downloads new messages in chunks (bodies of messages over MAX_BODY_BYTES are deferred
 *      until the user opens them — see fetchBodyNow);
 *   5. refreshes read/starred flags of known messages (CONDSTORE CHANGEDSINCE when possible,
 *      otherwise a plain FLAGS fetch over the known UID range);
 *   6. deletes local rows whose UID is no longer in the mailbox (archived/deleted elsewhere);
 *   7. saves { uidValidity, lastUid, highestModseq } and marks the account 'ok'.
 *
 * Errors never escape: they are recorded on the account (status 'error' or 'auth_error').
 */

const imap = require('./imap');
const { parseRawMessage, rewriteCidLinks } = require('./mailparse');
const { HttpError } = require('./errors');

const FETCH_CHUNK = 50; // messages per metadata FETCH / insert transaction
const SOURCE_BATCH_BYTES = 20 * 1024 * 1024; // cap on (reported) raw bytes held in memory at once
const SOURCE_BATCH_COUNT = 10; // ...and on the number of sources, in case the server under-reports sizes
const MAX_NEW_PER_RUN = 1000; // a huge batch of new mail is spread over several runs
const SYNC_DEADLINE_MS = 10 * 60 * 1000; // a run that takes longer is cut off (progress is kept)
const DELETE_BATCH = 500;
const MAX_STAGGER_MS = 500;
const STOP_WAIT_MS = 10000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Thrown inside a sync when the account row disappeared (user removed it mid-sync). */
class AccountGoneError extends Error {
  constructor() {
    super('Account was removed');
    this.name = 'AccountGoneError';
  }
}

/** Thrown inside a sync when the account's server/login was changed mid-sync (its writes are stale). */
class SettingsChangedError extends Error {
  constructor() {
    super('Account settings changed during the sync');
    this.name = 'SettingsChangedError';
  }
}

/** A refusal the server gave for this command only (NO/BAD); the connection is still fine. */
function isCommandRefusal(err, client) {
  return !!(err && client && client.usable && (err.responseStatus === 'NO' || err.responseStatus === 'BAD'));
}

/** Minimal promise concurrency limiter. */
function createLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    while (active < max && queue.length) {
      const { fn, resolve, reject } = queue.shift();
      active += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          next();
        });
    }
  };
  const limit = (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  Object.defineProperty(limit, 'active', { get: () => active });
  return limit;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Group fetch metadata so each group's total size stays under maxBytes. */
function sizeBatches(metas, maxBytes) {
  const out = [];
  let current = [];
  let bytes = 0;
  for (const meta of metas) {
    const size = Number(meta.size) || 0;
    if (current.length && bytes + size > maxBytes) {
      out.push(current);
      current = [];
      bytes = 0;
    }
    current.push(meta);
    bytes += size;
  }
  if (current.length) out.push(current);
  return out;
}

function parseState(json) {
  if (!json) return {};
  try {
    const s = JSON.parse(json);
    if (!s || typeof s !== 'object') return {};
    return {
      uidValidity: Number(s.uidValidity) || null,
      lastUid: Number(s.lastUid) || 0,
      highestModseq: s.highestModseq ? String(s.highestModseq) : null,
    };
  } catch (_) {
    return {};
  }
}

function toBigIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  try {
    return BigInt(value);
  } catch (_) {
    return null;
  }
}

function toMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** The Date header when it is believable, else the server's arrival time, else now. */
function pickDate(headerMs, internalMs) {
  const now = Date.now();
  if (Number.isFinite(headerMs) && headerMs > 0 && headerMs <= now + ONE_DAY_MS) return headerMs;
  if (Number.isFinite(internalMs) && internalMs > 0) return internalMs;
  return now;
}

function envelopeAddresses(list) {
  return (list || [])
    .filter((a) => a && (a.address || a.name))
    .map((a) => ({ name: (a.name || '').trim(), address: (a.address || '').trim() }));
}

/** Does an IMAP BODYSTRUCTURE contain a real (non-inline) attachment? */
function structureHasAttachments(node) {
  if (!node) return false;
  if (Array.isArray(node.childNodes) && node.childNodes.length) return node.childNodes.some(structureHasAttachments);
  const disposition = String(node.disposition || '').toLowerCase();
  if (disposition === 'attachment') return true;
  const type = String(node.type || '').toLowerCase();
  const hasName = !!((node.dispositionParameters && node.dispositionParameters.filename) || (node.parameters && node.parameters.name));
  return hasName && !type.startsWith('text/') && disposition !== 'inline';
}

function isForeignKeyError(err) {
  return !!(err && (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY constraint failed/i.test(String(err.message))));
}

function attachmentsMeta(attachments) {
  return JSON.stringify(
    (attachments || []).map(({ index, filename, contentType, size, cid, inline }) => ({ index, filename, contentType, size, cid, inline }))
  );
}

const INSERT_COLUMNS = [
  'account_id', 'mailbox', 'uid', 'uid_validity', 'message_id', 'from_name', 'from_address', 'to_json',
  'cc_json', 'reply_to_json', 'subject', 'snippet', 'date', 'is_read', 'is_starred', 'has_attachments',
  'size', 'body_state', 'text_body', 'html_body', 'attachments_json', 'remote_image_count', 'created_at',
];

class SyncManager {
  constructor({ db, crypto, config, logger = console }) {
    if (!db || !crypto || !config) throw new Error('SyncManager needs { db, crypto, config }');
    this.db = db;
    this.crypto = crypto;
    this.config = config;
    this.logger = logger || console;
    this.deps = { db, crypto, config, logger: this.logger };
    this.inFlight = new Map(); // accountId -> Promise<result>
    this.bodyFetches = new Map(); // messageId -> Promise<row>
    this.rerun = new Set(); // accountIds whose settings changed during their running sync
    this.limit = createLimiter(Math.max(1, Number(config.syncConcurrency) || 4));
    this.timers = new Set();
    this.interval = null;
    this.started = false;
    this.stopped = false;
  }

  // ------------------------------------------------------------------------------------------
  // Scheduler
  // ------------------------------------------------------------------------------------------

  start() {
    if (this.started) return;
    this.started = true;
    this.stopped = false;
    // A previous process may have died mid-sync; those accounts are not syncing any more.
    this._safe(() => this.db.prepare("UPDATE accounts SET status = 'pending' WHERE status = 'syncing'").run());
    if (this.config.disableScheduler) return;
    this._later(2000, () => this._scheduledPass());
    const intervalMs = Math.max(1, Number(this.config.syncIntervalMinutes) || 3) * 60 * 1000;
    this.interval = setInterval(() => this._scheduledPass(), intervalMs);
    if (typeof this.interval.unref === 'function') this.interval.unref();
  }

  async stop() {
    this.stopped = true;
    this.started = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    const pending = [...this.inFlight.values(), ...this.bodyFetches.values()];
    if (!pending.length) return;
    let timer;
    await Promise.race([
      Promise.allSettled(pending),
      new Promise((resolve) => {
        timer = setTimeout(resolve, STOP_WAIT_MS); // cleared below; must keep the loop alive while awaited
      }),
    ]);
    clearTimeout(timer);
  }

  _later(ms, fn) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    if (typeof t.unref === 'function') t.unref();
    this.timers.add(t);
  }

  /**
   * Sync every account that is not waiting for the user to reconnect it, staggered.
   * Accounts are scheduled independently: one slow account (still in flight from an earlier
   * tick) is simply skipped, it never holds up everybody else's sync.
   */
  _scheduledPass() {
    if (this.stopped) return;
    const rows = this._safe(
      () => this.db.prepare("SELECT id FROM accounts WHERE status != 'auth_error' ORDER BY COALESCE(last_synced_at, 0), id").all(),
      []
    ).filter((row) => !this.inFlight.has(row.id));
    if (!rows.length) return;
    const intervalMs = Math.max(1, Number(this.config.syncIntervalMinutes) || 3) * 60 * 1000;
    const stagger = Math.min(MAX_STAGGER_MS, Math.floor(intervalMs / (rows.length + 1)));
    rows.forEach((row, i) => {
      const run = () => {
        if (!this.stopped) this.syncAccount(row.id);
      };
      if (i === 0) run();
      else this._later(i * stagger, run);
    });
  }

  // ------------------------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------------------------

  isSyncing(accountId) {
    return this.inFlight.has(Number(accountId));
  }

  /**
   * Sync one account. Concurrent calls for the same account share one run (same promise).
   * Never rejects: resolves { accountId, ok, newMessages, removed, updated, error? }.
   */
  syncAccount(accountId) {
    const id = Number(accountId);
    if (this.inFlight.has(id)) return this.inFlight.get(id);
    const promise = this.limit(() => this._runSync(id))
      .catch((err) => {
        this.logger.error(`[sync] unexpected failure for account ${id}:`, err);
        return { accountId: id, ok: false, newMessages: 0, removed: 0, updated: 0, error: imap.friendlyImapError(err) };
      })
      .finally(() => {
        this.inFlight.delete(id);
        // Settings changed mid-run (see _runSync): start a fresh run with the new ones.
        if (this.rerun.delete(id) && !this.stopped) this.syncAccount(id);
      });
    this.inFlight.set(id, promise);
    return promise;
  }

  /** Sync all of a user's accounts (shares the global concurrency limit). */
  async syncUser(userId, { timeoutMs = 45000 } = {}) {
    const rows = this._safe(() => this.db.prepare('SELECT id FROM accounts WHERE user_id = ? ORDER BY id').all(userId), []);
    if (!rows.length) return [];
    let timer;
    // Not unref()'d: a caller awaiting this must not see the process exit under it. Always cleared.
    const timeout = new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      return await Promise.all(
        rows.map(({ id }) => Promise.race([this.syncAccount(id), timeout.then(() => ({ accountId: id, ok: false, pending: true }))]))
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Download and store the body of a message whose body was deferred during sync.
   * Resolves with the updated row. Throws HttpError (404 when the message is gone,
   * 502 'IMAP_ERROR' with a friendly message when the server could not be reached).
   */
  fetchBodyNow(messageRow) {
    const id = messageRow && Number(messageRow.id);
    if (!id) return Promise.reject(new HttpError(404, 'Message not found', 'NOT_FOUND'));
    if (this.bodyFetches.has(id)) return this.bodyFetches.get(id);
    const promise = this._fetchBody(id).finally(() => this.bodyFetches.delete(id));
    this.bodyFetches.set(id, promise);
    return promise;
  }

  // ------------------------------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------------------------------

  _safe(fn, fallback) {
    try {
      return fn();
    } catch (err) {
      if (!/database connection is not open/i.test(String(err && err.message))) {
        this.logger.warn(`[sync] database error: ${err && err.message}`);
      }
      return fallback;
    }
  }

  _getAccount(id) {
    return this._safe(() => this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id), undefined);
  }

  async _runSync(accountId) {
    const stats = { accountId, ok: false, newMessages: 0, removed: 0, updated: 0, flagRefresh: 'none' };
    const account = this._getAccount(accountId);
    if (!account) return { ...stats, error: 'Account not found' };

    this._safe(() => this.db.prepare("UPDATE accounts SET status = 'syncing' WHERE id = ?").run(accountId));
    let state = null;
    let error = null;
    let activeClient = null;
    let timedOut = false;
    // Wall-clock deadline: a server that trickles bytes can't keep this run (and its
    // concurrency slot) forever. Progress saved per chunk survives the cut-off.
    const deadline = setTimeout(() => {
      timedOut = true;
      if (activeClient) activeClient.close();
    }, SYNC_DEADLINE_MS);
    if (typeof deadline.unref === 'function') deadline.unref();
    try {
      state = await imap.withImap(
        this.deps,
        account,
        (client) => {
          activeClient = client;
          if (timedOut) client.close();
          return this._syncMailbox(client, account, stats);
        },
        { maxLiteralSize: this._sourceCap() + 64 * 1024 }
      );
    } catch (err) {
      error = err;
    } finally {
      clearTimeout(deadline);
    }
    if (error && timedOut && !(error instanceof AccountGoneError) && !(error instanceof SettingsChangedError)) {
      error = new Error('Checking this inbox took too long and was stopped. It will continue on the next check.');
      error.friendly = error.message;
    }

    const current = this._getAccount(accountId);
    if (!current || error instanceof AccountGoneError) return { ...stats, ok: false, error: 'Account was removed' };
    const message = error ? imap.friendlyImapError(error) : null;

    if (error instanceof SettingsChangedError || current.config_version !== account.config_version || current.status === 'pending') {
      // The account was edited or reconnected while this sync ran with its old settings
      // (we set 'syncing' above). This outcome is stale: leave the status alone and sync again.
      this.rerun.add(accountId);
      return error && !(error instanceof SettingsChangedError) ? { ...stats, ok: false, error: message } : { ...stats, ok: true };
    }

    if (!error) {
      this._safe(() =>
        this.db
          .prepare(
            "UPDATE accounts SET sync_state = ?, status = 'ok', last_error = NULL, last_synced_at = ? WHERE id = ? AND config_version = ?"
          )
          .run(JSON.stringify(state), Date.now(), accountId, account.config_version)
      );
      // More new mail than one run handles: carry on right away.
      if (stats.more) this.rerun.add(accountId);
      return { ...stats, ok: true };
    }
    const status = imap.isAuthFailure(error) ? 'auth_error' : 'error';
    this._safe(() =>
      this.db
        .prepare('UPDATE accounts SET status = ?, last_error = ? WHERE id = ? AND config_version = ?')
        .run(status, message, accountId, account.config_version)
    );
    this.logger.warn(`[sync] ${account.email}: ${message}`);
    return { ...stats, ok: false, error: message };
  }

  /** Steps 1-6 for one connected client. Returns the new sync_state. */
  async _syncMailbox(client, account, stats) {
    const db = this.db;
    const mailbox = account.mailbox || 'INBOX';
    const lock = await client.getMailboxLock(mailbox, { readOnly: true });
    try {
      const mb = client.mailbox;
      const uidValidity = Number(mb.uidValidity); // BigInt in imapflow; always fits in 32 bits
      if (!Number.isSafeInteger(uidValidity) || uidValidity <= 0) throw new Error('The mail server did not report a valid UIDVALIDITY.');

      // HIGHESTMODSEQ as of selecting: everything changed after this is picked up next time.
      const condstore = client.enabled.has('CONDSTORE') && !mb.noModseq;
      const startModseq = condstore ? toBigIntOrNull(mb.highestModseq) : null;

      let state = parseState(account.sync_state);
      if (state.uidValidity !== uidValidity) {
        // UIDs from the old UIDVALIDITY mean nothing any more: start over.
        const info = this._accountTx(account, () =>
          db.prepare('DELETE FROM messages WHERE account_id = ? AND mailbox = ? AND uid_validity != ?').run(account.id, mailbox, uidValidity)
        );
        stats.removed += info.changes;
        state = { uidValidity, lastUid: 0, highestModseq: null };
      }
      const prevLastUid = state.lastUid || 0;

      // One listing of live UIDs serves both "what is new" and "what was removed".
      let listed = await client.search({ deleted: false }, { uid: true });
      if (!Array.isArray(listed)) {
        // A non-array means "rejected" (or, on some servers, "no matches"). Only an empty
        // mailbox may be read as no messages — never wipe local mail because a search failed.
        if (Number(mb.exists) === 0) listed = [];
        else throw new Error('The mail server refused to list the mailbox.');
      }
      const serverUids = [...new Set(listed.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);

      // `lastUid+1:*` always matches the newest message even when it is older (IMAP quirk),
      // so new mail is decided by comparing UIDs, never by the range alone.
      let newUids = prevLastUid
        ? serverUids.filter((uid) => uid > prevLastUid)
        : serverUids.slice(-Math.max(1, Number(this.config.initialSyncLimit) || 200));
      if (newUids.length > MAX_NEW_PER_RUN) {
        // Oldest first, so lastUid only ever moves past messages that were stored.
        newUids = newUids.slice(0, MAX_NEW_PER_RUN);
        stats.more = true;
      }

      let lastUid = prevLastUid;
      for (const uids of chunk(newUids, FETCH_CHUNK)) {
        stats.newMessages += await this._fetchAndStore(client, account, mailbox, uidValidity, uids);
        lastUid = Math.max(lastUid, uids[uids.length - 1]);
        // Save progress so an interrupted first sync resumes instead of starting over.
        // highestModseq stays at the old value until flags have been refreshed.
        const progress = JSON.stringify({ uidValidity, lastUid, highestModseq: state.highestModseq || null });
        this._accountTx(account, () => db.prepare('UPDATE accounts SET sync_state = ? WHERE id = ?').run(progress, account.id));
      }

      if (prevLastUid > 0) {
        await this._refreshFlags(client, account, mailbox, uidValidity, prevLastUid, state, startModseq, stats);
      }

      // Local messages that are no longer in the mailbox were moved or deleted elsewhere.
      const serverSet = new Set(serverUids);
      const localRows = db
        .prepare('SELECT id, uid FROM messages WHERE account_id = ? AND mailbox = ? AND uid_validity = ?')
        .all(account.id, mailbox, uidValidity);
      const goneIds = localRows.filter((r) => !serverSet.has(r.uid)).map((r) => r.id);
      for (const ids of chunk(goneIds, DELETE_BATCH)) {
        const info = this._accountTx(account, () =>
          db.prepare(`DELETE FROM messages WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
        );
        stats.removed += info.changes;
      }

      // When this run stopped early (stats.more), keep the old modseq: the flags of messages
      // not yet stored will be fetched fresh anyway, and nothing is skipped.
      return { uidValidity, lastUid, highestModseq: startModseq !== null ? startModseq.toString() : null };
    } finally {
      lock.release();
    }
  }

  async _refreshFlags(client, account, mailbox, uidValidity, prevLastUid, state, startModseq, stats) {
    const range = this.db
      .prepare('SELECT MIN(uid) AS minUid, COUNT(*) AS n FROM messages WHERE account_id = ? AND mailbox = ? AND uid_validity = ? AND uid <= ?')
      .get(account.id, mailbox, uidValidity, prevLastUid);
    if (!range || !range.n) return;

    const since = toBigIntOrNull(state.highestModseq);
    const changes = [];
    // Flags read from the server reflect its state at about this moment. A read/star change
    // the user makes in Mailtabs after this point must not be overwritten by them.
    const fetchStartedAt = Date.now();
    if (startModseq !== null && since !== null) {
      stats.flagRefresh = 'condstore';
      if (startModseq <= since) return; // nothing at all changed in the mailbox
      for await (const msg of client.fetch('1:*', { uid: true, flags: true }, { uid: true, changedSince: since })) {
        changes.push({ uid: msg.uid, flags: msg.flags });
      }
    } else {
      stats.flagRefresh = 'fallback';
      for await (const msg of client.fetch(`${range.minUid}:${prevLastUid}`, { uid: true, flags: true }, { uid: true })) {
        changes.push({ uid: msg.uid, flags: msg.flags });
      }
    }
    if (!changes.length) return;

    const stmt = this.db.prepare(
      'UPDATE messages SET is_read = ?, is_starred = ? WHERE account_id = ? AND mailbox = ? AND uid_validity = ? AND uid = ? AND (is_read != ? OR is_starred != ?)' +
        ' AND (flags_changed_at IS NULL OR flags_changed_at < ?)'
    );
    stats.updated += this._accountTx(account, () => {
      let n = 0;
      for (const { uid, flags } of changes) {
        if (!flags || uid > prevLastUid) continue; // newer messages were just stored with fresh flags
        const read = flags.has('\\Seen') ? 1 : 0;
        const starred = flags.has('\\Flagged') ? 1 : 0;
        n += stmt.run(read, starred, account.id, mailbox, uidValidity, uid, read, starred, fetchStartedAt).changes;
      }
      return n;
    });
  }

  /** Largest message source the sync downloads; anything bigger is fetched when opened. */
  _sourceCap() {
    return 2 * (Number(this.config.maxBodyBytes) || 5000000);
  }

  /**
   * Run one FETCH over `uids`, collecting results with collect(msg). If the server refuses the
   * whole command (one broken message can do that, e.g. Exchange "conversion failed"), retry
   * message by message so one bad message can't block the rest. Returns the UIDs that still failed.
   */
  async _fetchEach(client, uids, query, collect) {
    try {
      for await (const msg of client.fetch(imap.toUidSet(uids), query, { uid: true })) collect(msg);
      return [];
    } catch (err) {
      if (!isCommandRefusal(err, client) || uids.length === 1) {
        if (uids.length === 1 && isCommandRefusal(err, client)) return uids;
        throw err;
      }
    }
    const failed = [];
    for (const uid of uids) {
      try {
        for await (const msg of client.fetch(String(uid), query, { uid: true })) collect(msg);
      } catch (err) {
        if (!isCommandRefusal(err, client)) throw err;
        failed.push(uid);
      }
    }
    return failed;
  }

  /** Fetch and store one chunk of new UIDs. Returns how many rows were inserted. */
  async _fetchAndStore(client, account, mailbox, uidValidity, uids) {
    const wanted = new Set(uids);
    const byUid = new Map(); // a retried FETCH may deliver a message twice
    // Collect first: no other IMAP command may run while a fetch() is being iterated.
    const metaFailed = await this._fetchEach(client, uids, { uid: true, flags: true, envelope: true, internalDate: true, size: true }, (msg) => {
      if (wanted.has(msg.uid)) byUid.set(msg.uid, msg);
    });
    const metas = [...byUid.values()].sort((a, b) => a.uid - b.uid);
    if (metaFailed.length) {
      this.logger.warn(`[sync] ${account.email}: the server refused to describe UID(s) ${metaFailed.join(',')}; skipping them`);
    }
    if (!metas.length) return 0;

    const maxBody = Number(this.config.maxBodyBytes) || 5000000;
    const sourceCap = this._sourceCap();
    const large = metas.filter((m) => Number(m.size) > maxBody);
    const small = metas.filter((m) => !(Number(m.size) > maxBody));
    let inserted = 0;

    if (large.length) {
      // Bodies are deferred; the structure alone tells us whether to show a paperclip.
      const structures = new Map();
      await this._fetchEach(client, large.map((m) => m.uid), { uid: true, bodyStructure: true }, (msg) => {
        structures.set(msg.uid, msg.bodyStructure);
      });
      inserted += this._storeRows(
        account,
        large.map((meta) => ({ row: this._buildRow(account.id, mailbox, uidValidity, meta, null, structures.get(meta.uid)), parsed: null }))
      );
    }

    for (const sized of sizeBatches(small, SOURCE_BATCH_BYTES)) {
      for (const batch of chunk(sized, SOURCE_BATCH_COUNT)) {
        const sources = new Map();
        // Ask for at most sourceCap bytes: a server that under-reports sizes still can't make us
        // buffer more (the connection's literal limit backs this up).
        const failed = await this._fetchEach(
          client,
          batch.map((m) => m.uid),
          { uid: true, source: { start: 0, maxLength: sourceCap } },
          (msg) => {
            if (msg.source && msg.source.length < sourceCap) sources.set(msg.uid, msg.source);
          }
        );
        if (failed.length) {
          this.logger.warn(`[sync] ${account.email}: could not download UID(s) ${failed.join(',')}; they will be fetched when opened`);
        }
        const entries = [];
        for (const meta of batch) {
          let parsed = null;
          const source = sources.get(meta.uid);
          if (source) {
            try {
              parsed = await parseRawMessage(source);
            } catch (err) {
              // Unparseable MIME: keep the envelope, the body can be retried on open.
              this.logger.warn(`[sync] ${account.email}: could not parse message UID ${meta.uid}: ${err && err.message}`);
            }
          }
          entries.push({ row: this._buildRow(account.id, mailbox, uidValidity, meta, parsed, null), parsed });
        }
        sources.clear();
        inserted += this._storeRows(account, entries);
      }
    }
    return inserted;
  }

  _buildRow(accountId, mailbox, uidValidity, meta, parsed, structure) {
    const env = meta.envelope || {};
    const flags = meta.flags instanceof Set ? meta.flags : new Set(meta.flags || []);
    const envFrom = envelopeAddresses(env.from)[0] || null;
    const from = (parsed && parsed.from) || envFrom;
    const headerDate = parsed && parsed.date !== null ? parsed.date : toMs(env.date);
    return {
      account_id: accountId,
      mailbox,
      uid: meta.uid,
      uid_validity: uidValidity,
      message_id: (parsed && parsed.messageId) || env.messageId || null,
      from_name: (from && from.name) || null,
      from_address: (from && from.address) || null,
      to_json: JSON.stringify(parsed ? parsed.to : envelopeAddresses(env.to)),
      cc_json: JSON.stringify(parsed ? parsed.cc : envelopeAddresses(env.cc)),
      reply_to_json: JSON.stringify(parsed ? parsed.replyTo : envelopeAddresses(env.replyTo)),
      subject: (parsed && parsed.subject !== null ? parsed.subject : env.subject) ?? null,
      snippet: parsed ? parsed.snippet : null,
      date: pickDate(headerDate, toMs(meta.internalDate)),
      is_read: flags.has('\\Seen') ? 1 : 0,
      is_starred: flags.has('\\Flagged') ? 1 : 0,
      has_attachments: (parsed ? parsed.hasAttachments : structureHasAttachments(structure)) ? 1 : 0,
      size: Number.isFinite(Number(meta.size)) ? Number(meta.size) : null,
      body_state: parsed ? 'ready' : 'deferred',
      text_body: parsed ? parsed.text : null,
      html_body: parsed ? parsed.html : null,
      attachments_json: parsed ? attachmentsMeta(parsed.attachments) : null,
      remote_image_count: parsed ? parsed.remoteImageCount : 0,
      created_at: Date.now(),
    };
  }

  /**
   * Run fn in a transaction that first checks the account still exists with the settings this
   * sync started with (otherwise the writes would belong to a different mailbox).
   */
  _accountTx(account, fn) {
    const tx = this.db.transaction(() => {
      const row = this.db.prepare('SELECT config_version FROM accounts WHERE id = ?').get(account.id);
      if (!row) throw new AccountGoneError();
      if (row.config_version !== account.config_version) throw new SettingsChangedError();
      return fn();
    });
    try {
      return tx();
    } catch (err) {
      if (isForeignKeyError(err)) throw new AccountGoneError();
      throw err;
    }
  }

  _storeRows(account, entries) {
    if (!entries.length) return 0;
    if (!this._insertStmt) {
      this._insertStmt = this.db.prepare(
        `INSERT OR IGNORE INTO messages (${INSERT_COLUMNS.join(', ')}) VALUES (${INSERT_COLUMNS.map((c) => `@${c}`).join(', ')})`
      );
      this._updateHtmlStmt = this.db.prepare('UPDATE messages SET html_body = ? WHERE id = ?');
    }
    return this._accountTx(account, () => {
      let n = 0;
      for (const { row, parsed } of entries) {
        const info = this._insertStmt.run(row);
        if (info.changes !== 1) continue; // already stored
        n += 1;
        // cid: links can only be rewritten once we know the new row id.
        if (parsed && parsed.html && parsed.attachments.some((a) => a.cid)) {
          const id = Number(info.lastInsertRowid);
          const html = rewriteCidLinks(parsed.html, id, parsed.attachments);
          if (html !== parsed.html) this._updateHtmlStmt.run(html, id);
        }
      }
      return n;
    });
  }

  async _fetchBody(id) {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!row) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    if (row.body_state === 'ready') return row;
    const account = this._getAccount(row.account_id);
    if (!account) throw new HttpError(404, 'Message not found', 'NOT_FOUND');

    const goneError = () => new HttpError(404, 'This message is no longer on the mail server.', 'MESSAGE_GONE');
    let source;
    try {
      source = await imap.withImap(this.deps, account, async (client) => {
        const lock = await client.getMailboxLock(row.mailbox, { readOnly: true });
        try {
          if (Number(client.mailbox.uidValidity) !== Number(row.uid_validity)) throw goneError();
          const msg = await client.fetchOne(String(row.uid), { uid: true, source: true }, { uid: true });
          if (!msg || !msg.source) throw goneError();
          return msg.source;
        } finally {
          lock.release();
        }
      });
      // (withImap's default literal limit, 64 MB, bounds how much one message may be.)
    } catch (err) {
      if (err instanceof HttpError) throw err;
      const wrapped = new HttpError(502, imap.friendlyImapError(err), 'IMAP_ERROR');
      wrapped.cause = err;
      throw wrapped;
    }

    let parsed;
    try {
      parsed = await parseRawMessage(source);
    } catch (err) {
      const wrapped = new HttpError(422, 'This message could not be decoded.', 'UNPARSEABLE');
      wrapped.cause = err;
      throw wrapped;
    }
    const html = parsed.html ? rewriteCidLinks(parsed.html, row.id, parsed.attachments) : null;
    // Only fill in the very row we downloaded for (it may have been archived meanwhile).
    const identity = [row.id, row.account_id, row.mailbox, row.uid_validity, row.uid];
    this.db
      .prepare(
        `UPDATE messages SET body_state = 'ready', text_body = ?, html_body = ?, attachments_json = ?, snippet = ?,
           has_attachments = ?, remote_image_count = ?
         WHERE id = ? AND account_id = ? AND mailbox = ? AND uid_validity = ? AND uid = ?`
      )
      .run(parsed.text, html, attachmentsMeta(parsed.attachments), parsed.snippet, parsed.hasAttachments ? 1 : 0, parsed.remoteImageCount, ...identity);
    const updated = this.db
      .prepare('SELECT * FROM messages WHERE id = ? AND account_id = ? AND mailbox = ? AND uid_validity = ? AND uid = ?')
      .get(...identity);
    if (!updated) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    return updated;
  }
}

module.exports = { SyncManager, createLimiter, pickDate, structureHasAttachments, SettingsChangedError };
