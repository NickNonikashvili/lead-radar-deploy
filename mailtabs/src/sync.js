'use strict';

/**
 * SyncManager — keeps the local copy of every folder of every account up to date.
 *
 * An account sync (one IMAP connection):
 *   1. LISTs every folder with its STATUS (LIST-STATUS where the server has it) and brings the
 *      `folders` table in line (folders.upsertFolders: new, changed and removed folders);
 *   2. picks the folders worth opening: INBOX always; other folders only when their STATUS
 *      (UIDVALIDITY, UIDNEXT, MESSAGES, HIGHESTMODSEQ) differs from what the last sync recorded
 *      ('on_demand' folders such as Gmail's All Mail only while the user has them open);
 *   3. syncs them INBOX first, then Sent, Drafts and the rest, until ~70% of the run's deadline
 *      is used (the rest continues in an immediate follow-up run).
 *
 * Per folder:
 *   a. opens it read-only (EXAMINE — a sync can never change flags on the server);
 *   b. resets the folder's local mail if UIDVALIDITY changed;
 *   c. lists the live (not \Deleted) UIDs once and derives the new ones from it
 *      (first sync: the newest INITIAL_SYNC_LIMIT for INBOX, 50 elsewhere; afterwards UID > lastUid);
 *   d. downloads new messages in chunks (bodies of messages over MAX_BODY_BYTES are deferred
 *      until the user opens them — see fetchBodyNow);
 *   e. refreshes flags of known messages (CONDSTORE CHANGEDSINCE when possible, otherwise a
 *      plain FLAGS fetch over the known UID range);
 *   f. deletes local rows whose UID is no longer in the folder (moved/deleted elsewhere);
 *   g. saves folders.sync_state { uidValidity, lastUid, highestModseq, uidNext, messages, unseen,
 *      oldestUid }, has_older and last_synced_at.
 *
 * syncFolder() runs steps a-g for one folder (when the user opens it); backfillFolder() loads
 * older messages below the oldest one stored. All runs of one account are serialised: they
 * share one queue, so an account never has two sync connections at once.
 *
 * Sync errors never escape syncAccount/syncFolder: they are recorded on the account (status
 * 'error' or 'auth_error') and returned in the result.
 */

const imap = require('./imap');
const folders = require('./folders');
const { parseRawMessage, rewriteCidLinks, parseMessageIdList, normalizeMessageId, threadKeyFor } = require('./mailparse');
const { HttpError } = require('./errors');

const FETCH_CHUNK = 50; // messages per metadata FETCH / insert transaction
const SOURCE_BATCH_BYTES = 20 * 1024 * 1024; // cap on (reported) raw bytes held in memory at once
const SOURCE_BATCH_COUNT = 10; // ...and on the number of sources, in case the server under-reports sizes
const MAX_NEW_PER_RUN = 1000; // a huge batch of new mail is spread over several runs
const SYNC_DEADLINE_MS = 10 * 60 * 1000; // a run that takes longer is cut off (progress is kept)
const FOLDER_START_BUDGET = 0.7; // no new folder is started after this share of the deadline
const OTHER_FOLDER_INITIAL_LIMIT = 50; // first sync of a folder other than INBOX
const ON_DEMAND_WINDOW_MS = 30 * 60 * 1000; // 'on_demand' folders are synced while opened this recently
const FLAG_RECHECK_MS = 15 * 60 * 1000; // servers without CONDSTORE: look at unchanged folders this often
const MAX_BACKFILL = 500;
const DELETE_BATCH = 500;
const MAX_STAGGER_MS = 500;
const STOP_WAIT_MS = 10000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_QUERY = Object.freeze({ messages: true, unseen: true, uidNext: true, uidValidity: true, highestModseq: true });
// Sync order after INBOX.
const FOLDER_PRIORITY = { '\\Inbox': 0, '\\Sent': 1, '\\Drafts': 2 };

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

/** Thrown inside a sync when the folder row was removed or renamed meanwhile. */
class FolderGoneError extends Error {
  constructor() {
    super('Folder not found');
    this.name = 'FolderGoneError';
  }
}

/** A refusal the server gave for this command only (NO/BAD); the connection is still fine. */
function isCommandRefusal(err, client) {
  return !!(err && client && client.usable && (err.responseStatus === 'NO' || err.responseStatus === 'BAD'));
}

/** A problem with one folder (not the connection or the account): other folders can go on. */
function isFolderProblem(err, client) {
  return !!(err && (err.folderProblem || isCommandRefusal(err, client)));
}

function folderProblem(message) {
  const err = new Error(message);
  err.folderProblem = true;
  err.friendly = message;
  return err;
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

/** A non-negative safe integer, or null (never NaN/Infinity, never a BigInt). */
function intOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** folders.sync_state JSON -> normalised object ({} when there is none). */
function parseState(json) {
  if (!json) return {};
  try {
    const s = JSON.parse(json);
    if (!s || typeof s !== 'object') return {};
    return {
      uidValidity: intOrNull(s.uidValidity) || null,
      lastUid: intOrNull(s.lastUid) || 0,
      highestModseq: s.highestModseq ? String(s.highestModseq) : null,
      uidNext: intOrNull(s.uidNext),
      messages: intOrNull(s.messages),
      unseen: intOrNull(s.unseen),
      oldestUid: intOrNull(s.oldestUid) || null,
    };
  } catch (_) {
    return {};
  }
}

function serializeState(s) {
  return JSON.stringify({
    uidValidity: s.uidValidity,
    lastUid: s.lastUid || 0,
    highestModseq: s.highestModseq || null,
    uidNext: s.uidNext ?? null,
    messages: s.messages ?? null,
    unseen: s.unseen ?? null,
    oldestUid: s.oldestUid || null,
  });
}

/**
 * Did the folder change on the server since its last complete sync? Unknown means yes.
 * `status` is the folder's STATUS from this run's LIST (null when the server sent none).
 */
function folderChanged(state, status, lastSyncedAt, now = Date.now()) {
  if (!state || !state.uidValidity || state.uidNext === null || state.uidNext === undefined) return true;
  if (!status) return true;
  const differs = (value, recorded) => value !== undefined && value !== null && String(value) !== String(recorded);
  if (differs(status.uidValidity, state.uidValidity)) return true;
  if (differs(status.uidNext, state.uidNext)) return true;
  if (status.messages !== undefined && (state.messages === null || differs(status.messages, state.messages))) return true;
  if (status.highestModseq !== undefined && status.highestModseq !== null) {
    return state.highestModseq === null || differs(status.highestModseq, state.highestModseq);
  }
  // No mod-sequences: flag changes made in other apps only show up as a different UNSEEN
  // count (stars not at all), so also look again every FLAG_RECHECK_MS.
  if (status.unseen !== undefined && state.unseen !== null && differs(status.unseen, state.unseen)) return true;
  return !lastSyncedAt || now - lastSyncedAt >= FLAG_RECHECK_MS;
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

function hasFlag(flags, flag) {
  return flags instanceof Set ? flags.has(flag) : Array.isArray(flags) && flags.includes(flag);
}

const INSERT_COLUMNS = [
  'account_id', 'folder_id', 'mailbox', 'uid', 'uid_validity', 'message_id', 'in_reply_to', 'references_json',
  'thread_key', 'from_name', 'from_address', 'to_json', 'cc_json', 'reply_to_json', 'subject', 'snippet', 'date',
  'is_read', 'is_starred', 'is_answered', 'is_draft', 'has_attachments', 'size', 'body_state', 'text_body',
  'html_body', 'attachments_json', 'remote_image_count', 'created_at',
];

function emptyStats(accountId) {
  return { accountId, ok: false, newMessages: 0, removed: 0, updated: 0, flagRefresh: 'none', folders: [] };
}

class SyncManager {
  constructor({ db, crypto, config, logger = console }) {
    if (!db || !crypto || !config) throw new Error('SyncManager needs { db, crypto, config }');
    this.db = db;
    this.crypto = crypto;
    this.config = config;
    this.logger = logger || console;
    this.deps = { db, crypto, config, logger: this.logger };
    // accountId -> { kind: 'account'|'folder'|'backfill', promise, settled } — the account's
    // queue tail. Every run of an account waits for the one before it.
    this.inFlight = new Map();
    this.folderRuns = new Map(); // folderId -> Promise<result> (queued or running folder sync)
    this.backfills = new Map(); // folderId -> Promise<{ added, hasOlder }>
    this.bodyFetches = new Map(); // messageId -> Promise<row>
    this.rerun = new Set(); // accountIds that need another full run once the current one ends
    this.limit = createLimiter(Math.max(1, Number(config.syncConcurrency) || 4));
    this.syncDeadlineMs = Number(config.syncDeadlineMs) > 0 ? Number(config.syncDeadlineMs) : SYNC_DEADLINE_MS;
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
    const pending = [...[...this.inFlight.values()].map((entry) => entry.settled), ...this.bodyFetches.values()];
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
   * Sync one account (all its folders that changed). Concurrent calls share one run (same
   * promise); a call made while a folder sync or backfill of the account runs is queued after it.
   * Never rejects: resolves { accountId, ok, newMessages, removed, updated, flagRefresh, folders, error? }.
   */
  syncAccount(accountId) {
    const id = Number(accountId);
    const current = this.inFlight.get(id);
    if (current && current.kind === 'account') return current.promise;
    return this._enqueue(id, 'account', () => this._runSync(id), (err) => {
      this.logger.error(`[sync] unexpected failure for account ${id}:`, err);
      return { ...emptyStats(id), error: imap.friendlyImapError(err) };
    });
  }

  /**
   * Sync exactly one folder now (the user opened it). Waits for a sync of the account that is
   * already running, then runs. Sets the folder's last_opened_at unless markOpened is false.
   * Never rejects: resolves the same shape as syncAccount plus folderId.
   */
  syncFolder(folderId, { markOpened = true } = {}) {
    const id = Number(folderId);
    const folder = this._safe(() => folders.getFolder(this.db, id), undefined);
    if (!folder) return Promise.resolve({ ...emptyStats(null), folderId: id, error: 'Folder not found' });
    if (markOpened) this._safe(() => this.db.prepare('UPDATE folders SET last_opened_at = ? WHERE id = ?').run(Date.now(), id));
    if (this.folderRuns.has(id)) return this.folderRuns.get(id);
    const accountId = folder.account_id;
    const promise = this._enqueue(accountId, 'folder', () => this._runSync(accountId, { folderId: id }), (err) => {
      this.logger.error(`[sync] unexpected failure for folder ${id}:`, err);
      return { ...emptyStats(accountId), folderId: id, error: imap.friendlyImapError(err) };
    });
    this.folderRuns.set(id, promise);
    promise.then(() => {
      if (this.folderRuns.get(id) === promise) this.folderRuns.delete(id);
    });
    return promise;
  }

  /**
   * Load up to `count` messages older than the oldest one stored for the folder (newest of
   * those first). Resolves { added, hasOlder }. Rejects with HttpError: 404 NOT_FOUND,
   * 502 IMAP_ERROR (friendly message), 409 SETTINGS_CHANGED.
   */
  backfillFolder(folderId, { count = 100 } = {}) {
    const id = Number(folderId);
    const folder = this._safe(() => folders.getFolder(this.db, id), undefined);
    if (!folder) return Promise.reject(new HttpError(404, 'Folder not found', 'NOT_FOUND'));
    if (this.backfills.has(id)) return this.backfills.get(id);
    const n = Math.min(MAX_BACKFILL, Math.max(1, Math.floor(Number(count)) || 100));
    const promise = this._enqueue(folder.account_id, 'backfill', () => this._runBackfill(folder.account_id, id, n));
    this.backfills.set(id, promise);
    const forget = () => {
      if (this.backfills.get(id) === promise) this.backfills.delete(id);
    };
    promise.then(forget, forget);
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
  // Queue + run wrappers
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

  /**
   * Append a task to the account's queue (after whatever runs or waits there) and run it under
   * the global concurrency limit. The returned promise settles after the queue bookkeeping, so
   * a caller that awaits it sees the account idle (or its follow-up run already queued).
   */
  _enqueue(accountId, kind, task, onError) {
    const id = Number(accountId);
    const previous = this.inFlight.get(id);
    const entry = { kind, promise: null, settled: null };
    const start = () => this.limit(task);
    const run = previous ? previous.settled.then(start) : start();
    const done = run.finally(() => {
      if (this.inFlight.get(id) === entry) this.inFlight.delete(id);
      // Settings changed mid-run, or more to do than one run handles: a fresh full run.
      if (this.rerun.delete(id) && !this.stopped) this.syncAccount(id);
    });
    entry.promise = onError ? done.catch(onError) : done;
    entry.settled = done.then(
      () => {},
      () => {}
    );
    this.inFlight.set(id, entry);
    return entry.promise;
  }

  /**
   * Run fn(client) on a fresh connection with a wall-clock deadline: a server that trickles
   * bytes can't keep the run (and its concurrency slot) forever. Progress saved per chunk
   * survives the cut-off.
   */
  async _withDeadline(account, fn) {
    let activeClient = null;
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      if (activeClient) activeClient.close();
    }, this.syncDeadlineMs);
    if (typeof deadline.unref === 'function') deadline.unref();
    try {
      return await imap.withImap(
        this.deps,
        account,
        (client) => {
          activeClient = client;
          if (timedOut) client.close();
          return fn(client);
        },
        { maxLiteralSize: this._sourceCap() + 64 * 1024 }
      );
    } catch (err) {
      if (timedOut && !(err instanceof AccountGoneError) && !(err instanceof SettingsChangedError) && !(err instanceof FolderGoneError)) {
        const message = 'Checking this mailbox took too long and was stopped. It will continue on the next check.';
        const wrapped = new Error(message);
        wrapped.friendly = message;
        wrapped.cause = err;
        throw wrapped;
      }
      throw err;
    } finally {
      clearTimeout(deadline);
    }
  }

  /** One account run (folderId = null) or one folder run. Never throws. */
  async _runSync(accountId, { folderId = null } = {}) {
    const folderRun = folderId !== null;
    const stats = emptyStats(accountId);
    if (folderRun) stats.folderId = folderId;
    const account = this._getAccount(accountId);
    if (!account) return { ...stats, error: 'Account not found' };

    // A folder run is a quick look at one folder: it leaves the account's status alone.
    if (!folderRun) this._safe(() => this.db.prepare("UPDATE accounts SET status = 'syncing' WHERE id = ?").run(accountId));
    const startedAt = Date.now();
    let error = null;
    try {
      await this._withDeadline(account, (client) =>
        folderRun ? this._syncOneFolder(client, account, folderId, stats) : this._syncAllFolders(client, account, stats, startedAt)
      );
    } catch (err) {
      error = err;
    }

    const current = this._getAccount(accountId);
    if (!current || error instanceof AccountGoneError) return { ...stats, ok: false, error: 'Account was removed' };
    const message = error ? imap.friendlyImapError(error) : null;

    const stale =
      error instanceof SettingsChangedError ||
      current.config_version !== account.config_version ||
      (!folderRun && current.status === 'pending');
    if (stale) {
      // The account was edited or reconnected while this run used its old settings (an account
      // run set 'syncing' above). This outcome is stale: leave the status alone and sync again.
      this.rerun.add(accountId);
      return error && !(error instanceof SettingsChangedError) ? { ...stats, ok: false, error: message } : { ...stats, ok: true };
    }
    if (error instanceof FolderGoneError) return { ...stats, ok: false, error: 'Folder not found' };

    if (!error) {
      if (!folderRun) {
        this._safe(() =>
          this.db
            .prepare("UPDATE accounts SET status = 'ok', last_error = NULL, last_synced_at = ? WHERE id = ? AND config_version = ?")
            .run(Date.now(), accountId, account.config_version)
        );
      }
      // More than one run handles (new mail, folders left for later): carry on right away.
      if (stats.more) this.rerun.add(accountId);
      return { ...stats, ok: true };
    }
    const status = imap.isAuthFailure(error) ? 'auth_error' : 'error';
    // A folder run only records failures that concern the whole account (the login).
    if (!folderRun || status === 'auth_error') {
      this._safe(() =>
        this.db
          .prepare('UPDATE accounts SET status = ?, last_error = ? WHERE id = ? AND config_version = ?')
          .run(status, message, accountId, account.config_version)
      );
    }
    this.logger.warn(`[sync] ${account.email}${folderRun ? ` (folder ${folderId})` : ''}: ${message}`);
    return { ...stats, ok: false, error: message };
  }

  // ------------------------------------------------------------------------------------------
  // Folder selection
  // ------------------------------------------------------------------------------------------

  /** Account run, steps 1-3 of the module doc. */
  async _syncAllFolders(client, account, stats, startedAt) {
    const db = this.db;
    let entries = null;
    try {
      entries = await client.list({ statusQuery: STATUS_QUERY });
    } catch (err) {
      if (!isCommandRefusal(err, client)) throw err;
      // A server that refuses to list its folders still has an INBOX: keep that one working.
      this.logger.warn(`[sync] ${account.email}: the server refused to list folders, checking only the inbox: ${imap.friendlyImapError(err)}`);
    }
    const gmail = imap.isGmail(account, client);
    const statusByPath = new Map();
    for (const entry of entries || []) {
      if (entry && typeof entry.path === 'string') {
        statusByPath.set(entry.path, entry.status && typeof entry.status === 'object' && !entry.status.error ? entry.status : null);
      }
    }
    this._accountTx(account, () => {
      if (entries) {
        const changes = folders.upsertFolders(db, account.id, entries, { isGmail: gmail });
        db.prepare('UPDATE accounts SET folders_synced_at = ? WHERE id = ?').run(Date.now(), account.id);
        stats.foldersAdded = changes.added;
        stats.foldersRemoved = changes.removed;
      }
      // Should a server ever leave INBOX out of its listing, it still exists (RFC 9051).
      folders.inboxFolder(db, account.id);
    });

    const now = Date.now();
    const picked = db
      .prepare('SELECT * FROM folders WHERE account_id = ?')
      .all(account.id)
      .filter((row) => (entries ? this._wantsSync(row, statusByPath.get(row.path) || null, now) : row.special_use === '\\Inbox'))
      .sort(
        (a, b) =>
          (FOLDER_PRIORITY[a.special_use] ?? 3) - (FOLDER_PRIORITY[b.special_use] ?? 3) || a.path.localeCompare(b.path) || a.id - b.id
      );

    const budget = this.syncDeadlineMs * FOLDER_START_BUDGET;
    for (const folder of picked) {
      if (folder.special_use !== '\\Inbox' && Date.now() - startedAt > budget) {
        stats.more = true; // the remaining folders still differ from their STATUS: next run
        break;
      }
      await this._syncFolderGuarded(client, account, folder, stats, { isGmail: gmail, status: statusByPath.get(folder.path) || null });
    }
  }

  /** Should an account run open this folder? */
  _wantsSync(row, status, now) {
    if (!row.selectable) return false;
    if (row.special_use === '\\Inbox') return true;
    if (row.sync_mode === 'on_demand' && !(row.last_opened_at && now - row.last_opened_at < ON_DEMAND_WINDOW_MS)) return false;
    return folderChanged(parseState(row.sync_state), status, row.last_synced_at, now);
  }

  /** Sync one folder of an account run; a problem with a folder other than INBOX only skips it. */
  async _syncFolderGuarded(client, account, folder, stats, options) {
    try {
      await this._syncFolderMailbox(client, account, folder, stats, options);
    } catch (err) {
      if (err instanceof FolderGoneError) return; // removed or renamed meanwhile
      if (folder.special_use !== '\\Inbox' && isFolderProblem(err, client)) {
        const message = imap.friendlyImapError(err);
        this.logger.warn(`[sync] ${account.email}: skipped folder "${folder.path}": ${message}`);
        (stats.folderErrors || (stats.folderErrors = [])).push({ folderId: folder.id, path: folder.path, error: message });
        return;
      }
      throw err;
    }
  }

  /** Folder run: refresh the folder's counts, then sync it. */
  async _syncOneFolder(client, account, folderId, stats) {
    const folder = this._safe(() => folders.getFolder(this.db, folderId), undefined);
    if (!folder || folder.account_id !== account.id) throw new FolderGoneError();
    if (!folder.selectable) return;
    let status = null;
    try {
      status = await client.status(folder.path, STATUS_QUERY);
    } catch (err) {
      if (!isCommandRefusal(err, client)) throw err; // the EXAMINE below reports the problem
    }
    if (status) {
      const total = intOrNull(status.messages);
      const unread = intOrNull(status.unseen);
      this._folderTx(account, folder, () =>
        this.db
          .prepare('UPDATE folders SET total_count = COALESCE(?, total_count), unread_count = COALESCE(?, unread_count) WHERE id = ?')
          .run(total, unread, folder.id)
      );
    }
    await this._syncFolderMailbox(client, account, folder, stats, { isGmail: imap.isGmail(account, client), status });
  }

  // ------------------------------------------------------------------------------------------
  // One folder (steps a-g)
  // ------------------------------------------------------------------------------------------

  async _syncFolderMailbox(client, account, folder, stats, { isGmail = false, status = null } = {}) {
    const db = this.db;
    const fstats = { folderId: folder.id, path: folder.path, newMessages: 0, removed: 0, updated: 0, flagRefresh: 'none' };
    const lock = await client.getMailboxLock(folder.path, { readOnly: true });
    try {
      const mb = client.mailbox;
      const uidValidity = Number(mb.uidValidity); // BigInt in imapflow; always fits in 32 bits
      if (!Number.isSafeInteger(uidValidity) || uidValidity <= 0) throw folderProblem('The mail server did not report a valid UIDVALIDITY.');

      // HIGHESTMODSEQ as of selecting: everything changed after this is picked up next time.
      const condstore = client.enabled.has('CONDSTORE') && !mb.noModseq;
      const startModseq = condstore ? toBigIntOrNull(mb.highestModseq) : null;
      // What the folder looked like when opened; the next run compares STATUS against it.
      const snapshot = { uidNext: intOrNull(mb.uidNext), messages: intOrNull(mb.exists), unseen: status ? intOrNull(status.unseen) : null };

      let state = parseState(folder.sync_state);
      if (state.uidValidity !== uidValidity) {
        // UIDs from the old UIDVALIDITY mean nothing any more: start over.
        const info = this._folderTx(account, folder, () =>
          db.prepare('DELETE FROM messages WHERE folder_id = ? AND uid_validity != ?').run(folder.id, uidValidity)
        );
        fstats.removed += info.changes;
        state = { uidValidity, lastUid: 0, highestModseq: null, oldestUid: null };
      }
      const prevLastUid = state.lastUid || 0;

      // One listing of live UIDs serves "what is new", "what was removed" and "is there older mail".
      let listed = await client.search({ deleted: false }, { uid: true });
      if (!Array.isArray(listed)) {
        // A non-array means "rejected" (or, on some servers, "no matches"). Only an empty
        // mailbox may be read as no messages — never wipe local mail because a search failed.
        if (Number(mb.exists) === 0) listed = [];
        else throw folderProblem('The mail server refused to list the folder.');
      }
      const serverUids = [...new Set(listed.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);

      // `lastUid+1:*` always matches the newest message even when it is older (IMAP quirk),
      // so new mail is decided by comparing UIDs, never by the range alone.
      const window = folder.special_use === '\\Inbox' ? Math.max(1, Number(this.config.initialSyncLimit) || 200) : OTHER_FOLDER_INITIAL_LIMIT;
      let newUids = prevLastUid ? serverUids.filter((uid) => uid > prevLastUid) : serverUids.slice(-window);
      let complete = true;
      if (newUids.length > MAX_NEW_PER_RUN) {
        // Oldest first, so lastUid only ever moves past messages that were stored.
        newUids = newUids.slice(0, MAX_NEW_PER_RUN);
        complete = false;
        stats.more = true;
      }

      let oldestUid = state.oldestUid || null;
      if (!prevLastUid && newUids.length) oldestUid = newUids[0];
      else if (!oldestUid && prevLastUid) oldestUid = this._oldestLocalUid(folder, uidValidity) || prevLastUid + 1;

      let lastUid = prevLastUid;
      for (const uids of chunk(newUids, FETCH_CHUNK)) {
        fstats.newMessages += await this._fetchAndStore(client, account, folder, uidValidity, uids, { isGmail });
        lastUid = Math.max(lastUid, uids[uids.length - 1]);
        // Save progress so an interrupted first sync resumes instead of starting over. Without
        // uidNext the folder counts as changed, so the next run comes back to it; highestModseq
        // stays at the old value until flags have been refreshed.
        const progress = serializeState({ ...state, uidValidity, lastUid, uidNext: null, messages: null, unseen: null, oldestUid });
        this._folderTx(account, folder, () => db.prepare('UPDATE folders SET sync_state = ? WHERE id = ?').run(progress, folder.id));
      }

      if (prevLastUid > 0) {
        await this._refreshFlags(client, account, folder, uidValidity, prevLastUid, state, startModseq, fstats);
      }

      // Local messages that are no longer in the folder were moved or deleted elsewhere.
      const serverSet = new Set(serverUids);
      const localRows = db
        .prepare('SELECT id, uid FROM messages WHERE account_id = ? AND mailbox = ? AND uid_validity = ? AND folder_id = ?')
        .all(account.id, folder.path, uidValidity, folder.id);
      const goneIds = localRows.filter((r) => !serverSet.has(r.uid)).map((r) => r.id);
      for (const ids of chunk(goneIds, DELETE_BATCH)) {
        const info = this._folderTx(account, folder, () =>
          db.prepare(`DELETE FROM messages WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
        );
        fstats.removed += info.changes;
      }

      const hasOlder = oldestUid !== null && serverUids.length > 0 && serverUids[0] < oldestUid;
      const final = serializeState({
        uidValidity,
        lastUid,
        highestModseq: startModseq !== null ? startModseq.toString() : null,
        // A run cut short leaves these empty: the folder must be looked at again.
        uidNext: complete ? snapshot.uidNext : null,
        messages: complete ? snapshot.messages : null,
        unseen: complete ? snapshot.unseen : null,
        oldestUid,
      });
      this._folderTx(account, folder, () =>
        db.prepare('UPDATE folders SET sync_state = ?, has_older = ?, last_synced_at = ? WHERE id = ?').run(final, hasOlder ? 1 : 0, Date.now(), folder.id)
      );
    } finally {
      lock.release();
    }

    stats.newMessages += fstats.newMessages;
    stats.removed += fstats.removed;
    stats.updated += fstats.updated;
    if (folder.special_use === '\\Inbox' || stats.folderId === folder.id) stats.flagRefresh = fstats.flagRefresh;
    stats.folders.push(fstats);
    return fstats;
  }

  _oldestLocalUid(folder, uidValidity) {
    const row = this.db.prepare('SELECT MIN(uid) AS uid FROM messages WHERE folder_id = ? AND uid_validity = ?').get(folder.id, uidValidity);
    return row && row.uid ? Number(row.uid) : null;
  }

  async _refreshFlags(client, account, folder, uidValidity, prevLastUid, state, startModseq, fstats) {
    const range = this.db
      .prepare(
        'SELECT MIN(uid) AS minUid, COUNT(*) AS n FROM messages WHERE account_id = ? AND mailbox = ? AND uid_validity = ? AND folder_id = ? AND uid <= ?'
      )
      .get(account.id, folder.path, uidValidity, folder.id, prevLastUid);
    if (!range || !range.n) return;

    const since = toBigIntOrNull(state.highestModseq);
    const changes = [];
    // Flags read from the server reflect its state at about this moment. A read/star change
    // the user makes in Mailtabs after this point must not be overwritten by them.
    const fetchStartedAt = Date.now();
    if (startModseq !== null && since !== null) {
      fstats.flagRefresh = 'condstore';
      if (startModseq <= since) return; // nothing at all changed in the folder
      for await (const msg of client.fetch('1:*', { uid: true, flags: true }, { uid: true, changedSince: since })) {
        changes.push({ uid: msg.uid, flags: msg.flags });
      }
    } else {
      fstats.flagRefresh = 'fallback';
      for await (const msg of client.fetch(`${range.minUid}:${prevLastUid}`, { uid: true, flags: true }, { uid: true })) {
        changes.push({ uid: msg.uid, flags: msg.flags });
      }
    }
    if (!changes.length) return;

    const stmt = this.db.prepare(
      'UPDATE messages SET is_read = ?, is_starred = ?, is_answered = ?, is_draft = ?' +
        ' WHERE account_id = ? AND mailbox = ? AND uid_validity = ? AND uid = ? AND folder_id = ?' +
        ' AND (is_read != ? OR is_starred != ? OR is_answered != ? OR is_draft != ?)' +
        ' AND (flags_changed_at IS NULL OR flags_changed_at < ?)'
    );
    fstats.updated += this._folderTx(account, folder, () => {
      let n = 0;
      for (const { uid, flags } of changes) {
        if (!flags || uid > prevLastUid) continue; // newer messages were just stored with fresh flags
        const v = [hasFlag(flags, '\\Seen'), hasFlag(flags, '\\Flagged'), hasFlag(flags, '\\Answered'), hasFlag(flags, '\\Draft')].map(Number);
        n += stmt.run(...v, account.id, folder.path, uidValidity, uid, folder.id, ...v, fetchStartedAt).changes;
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

  /** Fetch and store one chunk of UIDs of a folder. Returns how many rows were inserted. */
  async _fetchAndStore(client, account, folder, uidValidity, uids, { isGmail = false } = {}) {
    const wanted = new Set(uids);
    const byUid = new Map(); // a retried FETCH may deliver a message twice
    const metaQuery = { uid: true, flags: true, envelope: true, internalDate: true, size: true };
    if (isGmail) metaQuery.threadId = true; // X-GM-THRID
    // Collect first: no other IMAP command may run while a fetch() is being iterated.
    const metaFailed = await this._fetchEach(client, uids, metaQuery, (msg) => {
      if (wanted.has(msg.uid)) byUid.set(msg.uid, msg);
    });
    const metas = [...byUid.values()].sort((a, b) => a.uid - b.uid);
    if (metaFailed.length) {
      this.logger.warn(`[sync] ${account.email}: the server refused to describe UID(s) ${metaFailed.join(',')} in "${folder.path}"; skipping them`);
    }
    if (!metas.length) return 0;

    const maxBody = Number(this.config.maxBodyBytes) || 5000000;
    const sourceCap = this._sourceCap();
    const large = metas.filter((m) => Number(m.size) > maxBody);
    const small = metas.filter((m) => !(Number(m.size) > maxBody));
    const build = (meta, parsed, extra) => this._buildRow(account.id, folder, uidValidity, meta, parsed, { ...extra, isGmail });
    let inserted = 0;

    if (large.length) {
      // Bodies are deferred; the structure alone tells us whether to show a paperclip, and the
      // References header (small) keeps the message in its conversation.
      const extras = new Map();
      await this._fetchEach(client, large.map((m) => m.uid), { uid: true, bodyStructure: true, headers: ['references'] }, (msg) => {
        extras.set(msg.uid, { structure: msg.bodyStructure, references: parseMessageIdList(msg.headers ? msg.headers.toString('utf8') : '') });
      });
      inserted += this._storeRows(
        account,
        folder,
        large.map((meta) => ({ row: build(meta, null, extras.get(meta.uid) || {}), parsed: null }))
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
          this.logger.warn(`[sync] ${account.email}: could not download UID(s) ${failed.join(',')} in "${folder.path}"; they will be fetched when opened`);
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
              this.logger.warn(`[sync] ${account.email}: could not parse message UID ${meta.uid} in "${folder.path}": ${err && err.message}`);
            }
          }
          entries.push({ row: build(meta, parsed, {}), parsed });
        }
        sources.clear();
        inserted += this._storeRows(account, folder, entries);
      }
    }
    return inserted;
  }

  _buildRow(accountId, folder, uidValidity, meta, parsed, { structure = null, references = null, isGmail = false } = {}) {
    const env = meta.envelope || {};
    const flags = meta.flags instanceof Set ? meta.flags : new Set(meta.flags || []);
    const envFrom = envelopeAddresses(env.from)[0] || null;
    const from = (parsed && parsed.from) || envFrom;
    const headerDate = parsed && parsed.date !== null ? parsed.date : toMs(env.date);
    const messageId = (parsed && parsed.messageId) || env.messageId || null;
    const inReplyTo = parsed ? parsed.inReplyTo : normalizeMessageId(env.inReplyTo);
    const refs = parsed ? parsed.references : references || [];
    return {
      account_id: accountId,
      folder_id: folder.id,
      mailbox: folder.path,
      uid: meta.uid,
      uid_validity: uidValidity,
      message_id: messageId,
      in_reply_to: inReplyTo || null,
      references_json: JSON.stringify(refs),
      thread_key: threadKeyFor({ gmailThreadId: isGmail ? meta.threadId : null, references: refs, inReplyTo, messageId }),
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
      is_answered: flags.has('\\Answered') ? 1 : 0,
      is_draft: flags.has('\\Draft') ? 1 : 0,
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

  /**
   * Like _accountTx, and the folder row must still be the one this sync opened: same id (ids
   * are never reused) and same path (a rename moved its messages to another mailbox).
   */
  _folderTx(account, folder, fn) {
    try {
      return this._accountTx(account, () => {
        const row = this.db.prepare('SELECT path FROM folders WHERE id = ? AND account_id = ?').get(folder.id, account.id);
        if (!row || row.path !== folder.path) throw new FolderGoneError();
        return fn();
      });
    } catch (err) {
      if (err instanceof AccountGoneError && this._getAccount(account.id)) throw new FolderGoneError();
      throw err;
    }
  }

  _storeRows(account, folder, entries) {
    if (!entries.length) return 0;
    if (!this._insertStmt) {
      this._insertStmt = this.db.prepare(
        `INSERT OR IGNORE INTO messages (${INSERT_COLUMNS.join(', ')}) VALUES (${INSERT_COLUMNS.map((c) => `@${c}`).join(', ')})`
      );
      this._updateHtmlStmt = this.db.prepare('UPDATE messages SET html_body = ? WHERE id = ?');
    }
    return this._folderTx(account, folder, () => {
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

  // ------------------------------------------------------------------------------------------
  // Backfill (older messages)
  // ------------------------------------------------------------------------------------------

  async _runBackfill(accountId, folderId, count) {
    const account = this._getAccount(accountId);
    const folder = this._safe(() => folders.getFolder(this.db, folderId), undefined);
    if (!account || !folder || folder.account_id !== account.id) throw new HttpError(404, 'Folder not found', 'NOT_FOUND');
    if (!folder.selectable) return { added: 0, hasOlder: false };
    try {
      return await this._withDeadline(account, (client) => this._backfillMailbox(client, account, folder, count));
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof FolderGoneError || err instanceof AccountGoneError) throw new HttpError(404, 'Folder not found', 'NOT_FOUND');
      if (err instanceof SettingsChangedError) {
        throw new HttpError(409, 'The account settings changed meanwhile. Try again in a moment.', 'SETTINGS_CHANGED');
      }
      const wrapped = new HttpError(502, imap.friendlyImapError(err), 'IMAP_ERROR');
      wrapped.cause = err;
      throw wrapped;
    }
  }

  async _backfillMailbox(client, account, folder, count) {
    const db = this.db;
    const isGmail = imap.isGmail(account, client);
    const state = parseState(folder.sync_state);
    const resync = async () => {
      // Never synced, or UIDVALIDITY changed: an ordinary sync loads the newest messages first.
      const stats = emptyStats(account.id);
      await this._syncFolderMailbox(client, account, folder, stats, { isGmail });
      const fresh = folders.getFolder(db, folder.id);
      return { added: stats.newMessages, hasOlder: !!(fresh && fresh.has_older) };
    };
    if (!state.uidValidity || !state.lastUid) return resync();

    const lock = await client.getMailboxLock(folder.path, { readOnly: true });
    let result = null;
    try {
      const uidValidity = Number(client.mailbox.uidValidity);
      if (uidValidity === state.uidValidity) {
        const oldest = state.oldestUid || this._oldestLocalUid(folder, uidValidity) || state.lastUid + 1;
        let older = [];
        if (oldest > 1) {
          // An explicit range without `*`: matches only UIDs inside it.
          const listed = await client.search({ uid: `1:${oldest - 1}`, deleted: false }, { uid: true });
          if (!Array.isArray(listed)) {
            if (Number(client.mailbox.exists) !== 0) throw folderProblem('The mail server refused to list the folder.');
          } else {
            older = [...new Set(listed.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < oldest))].sort((a, b) => a - b);
          }
        }
        const take = older.slice(-count);
        let added = 0;
        let newOldest = oldest;
        // Newest first; oldestUid moves down after every chunk, so an interrupted backfill
        // never leaves a gap between what is stored and what oldestUid claims.
        const olderRemain = () => older.length > 0 && older[0] < newOldest;
        for (const uids of chunk(take, FETCH_CHUNK).reverse()) {
          added += await this._fetchAndStore(client, account, folder, uidValidity, uids, { isGmail });
          newOldest = Math.min(newOldest, uids[0]);
          this._saveOldest(account, folder, uidValidity, newOldest, olderRemain());
        }
        if (!take.length) this._saveOldest(account, folder, uidValidity, newOldest, olderRemain());
        result = { added, hasOlder: olderRemain() };
      }
    } finally {
      lock.release();
    }
    return result || resync();
  }

  /** Record a lower oldestUid (and has_older) without touching the rest of the sync state. */
  _saveOldest(account, folder, uidValidity, oldestUid, hasOlder) {
    this._folderTx(account, folder, () => {
      const row = this.db.prepare('SELECT sync_state FROM folders WHERE id = ?').get(folder.id);
      const current = parseState(row && row.sync_state);
      if (current.uidValidity !== uidValidity) return; // reset meanwhile: the next sync decides
      const next = serializeState({ ...current, oldestUid: Math.min(current.oldestUid || oldestUid, oldestUid) });
      this.db.prepare('UPDATE folders SET sync_state = ?, has_older = ? WHERE id = ?').run(next, hasOlder ? 1 : 0, folder.id);
    });
  }

  // ------------------------------------------------------------------------------------------
  // Deferred bodies
  // ------------------------------------------------------------------------------------------

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

module.exports = {
  SyncManager,
  createLimiter,
  pickDate,
  structureHasAttachments,
  folderChanged,
  parseState,
  SettingsChangedError,
  FolderGoneError,
  STATUS_QUERY,
  OTHER_FOLDER_INITIAL_LIMIT,
};
