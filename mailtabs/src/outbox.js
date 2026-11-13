'use strict';

/**
 * OutboxManager — sends queued messages when they are due.
 *
 * Every send goes through the outbox, even "send now": the row waits for the user's undo
 * window (undoSendSeconds) or the scheduled time, and can be cancelled until it is picked up.
 * Sending one row:
 *   resolve attachments -> build MIME -> SMTP (or Microsoft Graph, see smtp.sendMessage) -> status 'sent'
 *   then, best effort: copy to \Sent (providers whose SMTP server does not do it), mark the
 *   original \Answered, delete the server draft, delete the uploads, sync Sent.
 * The row is marked 'sent' as soon as the SMTP server accepted the message, so a problem in
 * the follow-up steps can never cause a second delivery.
 *
 * Accounts send in parallel, one message at a time each (a user's accounts at most two at a
 * time): an account with mail due gets its lane at once, whatever other lanes are doing, and
 * every send has a wall-clock deadline, so one slow or hostile server holds up nobody else.
 *
 * Failures: status 'failed' with a friendly error. Problems before the server received the
 * message (connection refused, 4xx answers) get one automatic retry after a minute; login,
 * recipient and size errors do not. Once the whole message was handed over, a lost connection
 * or a timeout means it may have been delivered: the row fails saying so and is never resent
 * automatically. A process that died mid-send leaves rows in 'sending': start() queues them
 * again when they never reached the hand-over, else fails them the same way.
 *
 * Recipients refused while the server accepted the others stay in pending_recipients and the
 * row stays in the outbox: queued for one more try when every refusal was temporary (4xx),
 * else failed. Retrying it sends the same message (same Message-ID) to them only.
 *
 * A scheduled message lives in the outbox, not in Drafts: its server draft is removed when it
 * is queued (parts the message takes from that draft are kept first), so nobody edits a copy
 * the outbox would never send.
 */

const { HttpError } = require('./errors');
const compose = require('./compose');
const drafts = require('./drafts');
const smtp = require('./smtp');
const uploads = require('./uploads');
const imap = require('./imap');
const providers = require('./providers');

const DEFAULT_SETTINGS = Object.freeze({ undoSendSeconds: 10, notifications: false });
const MAX_SCHEDULE_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_TIMER_MS = 60 * 60 * 1000; // re-check at least hourly (clock changes, long schedules)
const KEEP_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LANES = 8; // accounts sending at the same time
const LANES_PER_USER = 2;
// One send, start to finish (25 MB of attachments on a slow link fits; a server that trickles
// replies to keep the connection alive does not).
const SEND_DEADLINE_MS = 10 * 60 * 1000;
const STOP_WAIT_MS = 10000;
const ACTIVE = ['queued', 'sending', 'failed'];
const INTERRUPTED_MAYBE_SENT = `Mailtabs was restarted while it was handing this message to the mail server. ${smtp.MAY_HAVE_BEEN_SENT}`;

/** The user's settings with defaults applied (undoSendSeconds clamped to 0..30). */
function getUserSettings(db, userId) {
  let stored = {};
  try {
    const row = db.prepare('SELECT settings FROM user_settings WHERE user_id = ?').get(userId);
    stored = row ? JSON.parse(row.settings) || {} : {};
  } catch (_) {
    stored = {};
  }
  const undo = Number(stored.undoSendSeconds);
  return {
    undoSendSeconds: Number.isInteger(undo) && undo >= 0 && undo <= 30 ? undo : DEFAULT_SETTINGS.undoSendSeconds,
    notifications: stored.notifications === true,
  };
}

function parsePayload(row) {
  try {
    return JSON.parse(row.payload) || {};
  } catch (_) {
    return {};
  }
}

/** Recipients a partly delivered row still has to reach, or null (= all of them). */
function pendingRecipients(row) {
  if (!row || !row.pending_recipients) return null;
  try {
    const list = JSON.parse(row.pending_recipients);
    return Array.isArray(list) ? list.filter((a) => typeof a === 'string' && a) : null;
  } catch (_) {
    return null;
  }
}

/** Outbox row -> the JSON the outbox list shows. */
function outboxItemJson(row) {
  const payload = parsePayload(row);
  const pending = pendingRecipients(row);
  return {
    id: row.id,
    accountId: row.account_id,
    to: [...(payload.to || []), ...(payload.cc || []), ...(payload.bcc || [])].map((r) => ({ name: r.name || '', address: r.address })),
    subject: payload.subject || '',
    sendAt: row.send_at,
    status: row.status,
    error: row.error || null,
    attempts: row.attempts,
    createdAt: row.created_at,
    sentAt: row.sent_at || null,
    // Delivered to some recipients already; notDeliveredTo still have to get it.
    partial: !!(pending && pending.length && row.sent_at),
    notDeliveredTo: pending || [],
  };
}

function draftOf(row) {
  return row.draft_folder_id && row.draft_uid ? { folderId: row.draft_folder_id, uid: row.draft_uid } : null;
}

/** sendAt (ms, ISO string or Date) -> epoch ms; absent/past -> now + undo delay. */
function resolveSendAt(sendAt, now, undoSeconds) {
  const fallback = now + undoSeconds * 1000;
  if (sendAt === undefined || sendAt === null || sendAt === '') return fallback;
  const ms = sendAt instanceof Date ? sendAt.getTime() : typeof sendAt === 'number' ? sendAt : Date.parse(String(sendAt));
  if (!Number.isFinite(ms)) throw new HttpError(400, 'Invalid send time.', 'INVALID_SEND_AT');
  if (ms <= now) return fallback;
  if (ms > now + MAX_SCHEDULE_MS) throw new HttpError(400, 'Messages can be scheduled at most a year ahead.', 'INVALID_SEND_AT');
  return Math.floor(ms);
}

/** The provider of the account's mailbox: its IMAP server when that is a known one, else its preset. */
function mailboxProviderKey(account) {
  return providers.presetKeyForHost(account.imap_host) || account.provider;
}

/** The provider whose SMTP server sends for the account (unknown host: the mailbox's provider). */
function smtpProviderKey(account) {
  return providers.presetKeyForSmtpHost(smtp.smtpSettingsFor(account).host) || mailboxProviderKey(account);
}

/**
 * Does Mailtabs have to APPEND a copy to Sent for this account? 'append' | 'server' | 'if-folder'
 * ('if-folder': Other-IMAP accounts — only when the server has a Sent folder; never create one).
 * 'server' only when the outgoing server belongs to the mailbox's own provider: Gmail or
 * Microsoft file their copy in the mailbox of the SMTP login, so an IMAP account on
 * mail.example.org that sends through smtp.gmail.com still needs its own copy.
 */
function sentCopyPolicy(account) {
  const mailboxKey = mailboxProviderKey(account);
  const preset = providers.PRESETS[mailboxKey];
  if (!preset || mailboxKey === 'imap') return 'if-folder';
  if (smtpProviderKey(account) !== mailboxKey) return 'append';
  return preset.sentCopy === 'server' ? 'server' : 'append';
}

function sentCopyUnverified(account) {
  const key = smtpProviderKey(account);
  return key === mailboxProviderKey(account) && !!(providers.PRESETS[key] && providers.PRESETS[key].sentCopyUnverified);
}

function errorText(err) {
  if (!err) return 'Sending failed.';
  if (err instanceof HttpError || err.expose === true) return err.message;
  return smtp.friendlySmtpError(err);
}

class OutboxManager {
  /**
   * @param {{ db, crypto, config, syncManager?, logger?, retryDelayMs?, sentCopyCheckDelayMs?, sendDeadlineMs? }} deps
   *   retryDelayMs / sentCopyCheckDelayMs / sendDeadlineMs are only changed by tests.
   */
  constructor({
    db,
    crypto,
    config,
    syncManager = null,
    logger = console,
    retryDelayMs = 60000,
    sentCopyCheckDelayMs = 3000,
    sendDeadlineMs = SEND_DEADLINE_MS,
  }) {
    if (!db || !crypto || !config) throw new Error('OutboxManager needs { db, crypto, config }');
    this.db = db;
    this.logger = logger || console;
    this.deps = { db, crypto, config, syncManager, logger: this.logger };
    this.retryDelayMs = retryDelayMs;
    this.sentCopyCheckDelayMs = sentCopyCheckDelayMs;
    this.sendDeadlineMs = sendDeadlineMs;
    this.timer = null;
    this.lanes = new Map(); // accountId -> { userId, promise } (one account sending, a message at a time)
    this.started = false;
    this.stopped = false;
    this.followUps = new Set(); // after-send work still in progress
  }

  // ------------------------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------------------------

  start() {
    if (this.started) return;
    this.started = true;
    this.stopped = false;
    // A previous process died mid-send. Rows that never reached the hand-over go out again; the
    // others may have been delivered, so they wait for the user instead.
    this._safe(() => {
      this.db.prepare("UPDATE outbox SET status = 'failed', error = ? WHERE status = 'sending' AND handed_over_at IS NOT NULL").run(INTERRUPTED_MAYBE_SENT);
      this.db.prepare("UPDATE outbox SET status = 'queued' WHERE status = 'sending'").run();
    });
    this._arm();
  }

  async stop() {
    this.stopped = true;
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const pending = [...[...this.lanes.values()].map((l) => l.promise), ...this.followUps];
    if (!pending.length) return;
    let t;
    await Promise.race([Promise.allSettled(pending), new Promise((resolve) => (t = setTimeout(resolve, STOP_WAIT_MS)))]);
    clearTimeout(t);
  }

  /** Wait until no send or follow-up step is running (tests). */
  async idle() {
    while (this.lanes.size || this.followUps.size) {
      await Promise.allSettled([...[...this.lanes.values()].map((l) => l.promise), ...this.followUps]);
    }
  }

  _safe(fn, fallback) {
    try {
      return fn();
    } catch (err) {
      if (!/database connection is not open/i.test(String(err && err.message))) this.logger.warn(`[outbox] database error: ${err && err.message}`);
      return fallback;
    }
  }

  /**
   * Wake up for the earliest queued row of an account that has no lane (a lane picks up its own
   * account's rows as they come due).
   */
  _arm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.started || this.stopped) return;
    const busy = [...this.lanes.keys()];
    const next = this._safe(
      () =>
        this.db
          .prepare(
            `SELECT MIN(send_at) AS at FROM outbox WHERE status = 'queued'${busy.length ? ` AND account_id NOT IN (${busy.map(() => '?').join(', ')})` : ''}`
          )
          .get(...busy),
      null
    );
    if (!next || next.at === null || next.at === undefined) return;
    const delay = Math.min(Math.max(0, next.at - Date.now()), MAX_TIMER_MS);
    this.timer = setTimeout(() => {
      this.timer = null;
      this._pump();
      this._arm();
    }, delay);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  // ------------------------------------------------------------------------------------------
  // User actions
  // ------------------------------------------------------------------------------------------

  _row(userId, outboxId) {
    const id = Number(outboxId);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    return this.db.prepare('SELECT * FROM outbox WHERE id = ? AND user_id = ?').get(id, userId) || null;
  }

  _requireRow(userId, outboxId) {
    const row = this._row(userId, outboxId);
    if (!row) throw new HttpError(404, 'This message is no longer in the outbox.', 'NOT_FOUND');
    return row;
  }

  /** The user's outbox row, or null. */
  get(userId, outboxId) {
    return this._row(userId, outboxId);
  }

  /**
   * Queue a message.
   * @param {{ sendAt?: number|string|Date, draft?: {folderId, uid}|null }} [opts] sendAt absent or in
   *   the past = now + the user's undo-send delay; at most a year ahead
   * @returns the outbox row
   */
  queue(userId, payload, { sendAt, draft = null } = {}) {
    const { db } = this;
    const normalized = compose.validatePayload(payload);
    const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(normalized.accountId, userId);
    if (!account) throw new HttpError(404, 'That account was not found.', 'NOT_FOUND');
    const status = smtp.sendingStatus(this.deps, account);
    if (!status.canSend) throw new HttpError(400, status.message, status.code);

    // Everything referenced must be the user's and still there (fail now, not in a minute).
    for (const ref of normalized.attachments) {
      if (ref.uploadId && !uploads.getUpload(db, userId, ref.uploadId)) {
        throw new HttpError(410, 'An attachment is no longer available — attach it again.', 'ATTACHMENT_GONE');
      }
      if (ref.messageId && !drafts.refAvailable(db, userId, ref)) {
        throw new HttpError(410, 'A message you attached files from is no longer available.', 'ATTACHMENT_GONE');
      }
    }
    for (const key of ['replyToMessageId', 'forwardOfMessageId']) {
      if (!normalized[key]) continue;
      // A message moved since the composer opened is found again in its new folder.
      const current = drafts.currentMessageRow(db, userId, normalized[key]);
      normalized[key] = current ? current.id : null;
    }
    let draftRef = null;
    if (draft) {
      draftRef = drafts.validDraftRef(draft);
      if (!draftRef) throw new HttpError(400, 'Invalid draft.', 'INVALID_DRAFT');
      const owner = db
        .prepare('SELECT a.id FROM folders f JOIN accounts a ON a.id = f.account_id WHERE f.id = ? AND a.user_id = ?')
        .get(draftRef.folderId, userId);
      if (!owner) draftRef = null; // folder gone (or not the user's): nothing to clean up
    }

    const now = Date.now();
    const undoSeconds = getUserSettings(db, userId).undoSendSeconds;
    const at = resolveSendAt(sendAt, now, undoSeconds);
    const id = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO outbox (user_id, account_id, payload, send_at, status, attempts, draft_folder_id, draft_uid, created_at)
           VALUES (?, ?, ?, ?, 'queued', 0, ?, ?, ?)`
        )
        .run(userId, account.id, JSON.stringify(normalized), at, draftRef ? draftRef.folderId : null, draftRef ? draftRef.uid : null, now);
      const rowId = Number(info.lastInsertRowid);
      // The payload's own uploads are recorded by a trigger; these are reached through a replaced draft.
      uploads.recordOutboxUploads(db, rowId, drafts.carriedUploadIds(db, userId, normalized));
      return rowId;
    })();
    if (draftRef && at > now + undoSeconds * 1000) this._releaseScheduledDraft(userId, id, normalized, draftRef);
    this._arm();
    return db.prepare('SELECT * FROM outbox WHERE id = ?').get(id);
  }

  /**
   * A message scheduled for later: remove its server draft now (the outbox row holds the
   * message). The draft chain is taken now, so a draft saved after this is the user's new one.
   * Parts the message takes from those drafts are kept first; if that fails, the draft stays
   * and goes after sending, as for "send now".
   */
  _releaseScheduledDraft(userId, outboxId, payload, draftRef) {
    const { db, deps } = this;
    const chain = drafts.draftChain(db, draftRef);
    const task = (async () => {
      if (drafts.refersToDrafts(db, userId, payload, chain)) {
        const { sources } = await drafts.materialize(deps, userId, payload);
        if (!drafts.carryReplacedParts(deps, userId, sources, chain)) return;
        uploads.recordOutboxUploads(db, outboxId, drafts.carriedUploadIds(db, userId, payload));
      }
      await drafts.deleteRefsAcrossAccounts(deps, userId, chain);
      this._safe(() =>
        db
          .prepare('UPDATE outbox SET draft_folder_id = NULL, draft_uid = NULL WHERE id = ? AND draft_folder_id = ? AND draft_uid = ?')
          .run(outboxId, draftRef.folderId, draftRef.uid)
      );
      drafts.syncFolderSoon(deps, drafts.folderById(db, draftRef.folderId));
    })()
      .catch((err) => this.logger.warn(`[outbox] message ${outboxId}: could not remove its draft: ${imap.friendlyImapError(err)}`))
      .finally(() => this.followUps.delete(task));
    this.followUps.add(task);
  }

  /** Undo / unschedule: only while still queued. Returns the payload (for the composer). */
  cancel(userId, outboxId) {
    return this.cancelWithDraft(userId, outboxId).payload;
  }

  /**
   * cancel() plus the server draft the message was sent from ({folderId, uid} | null). The
   * payload's attachments carry filename, contentType and size again (for the composer).
   */
  cancelWithDraft(userId, outboxId) {
    const row = this._requireRow(userId, outboxId);
    // A message that already reached some of its recipients can't be taken back.
    const res = this.db
      .prepare("UPDATE outbox SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'queued' AND sent_at IS NULL")
      .run(row.id, userId);
    if (res.changes !== 1) {
      const text =
        row.status === 'sent'
          ? 'Too late: the message was already sent.'
          : row.sent_at
            ? 'Too late: the message was already sent to some of its recipients.'
            : 'Too late: the message is being sent.';
      throw new HttpError(409, text, 'TOO_LATE');
    }
    this._arm();
    const payload = parsePayload(row);
    payload.attachments = drafts.describeAttachments(this.db, userId, payload.attachments);
    return { payload, draft: draftOf(row) };
  }

  /** Try a failed message again now (only to the recipients it did not reach yet). */
  retry(userId, outboxId) {
    const row = this._requireRow(userId, outboxId);
    const res = this.db
      .prepare(
        "UPDATE outbox SET status = 'queued', send_at = ?, error = NULL, attempts = 0, handed_over_at = NULL WHERE id = ? AND user_id = ? AND status = 'failed'"
      )
      .run(Date.now(), row.id, userId);
    if (res.changes !== 1) throw new HttpError(409, 'Only messages that failed to send can be retried.', 'NOT_FAILED');
    this._arm();
    return this.db.prepare('SELECT * FROM outbox WHERE id = ?').get(row.id);
  }

  /** Delete a queued, failed (or finished) message and the uploads only it used. */
  remove(userId, outboxId) {
    const row = this._requireRow(userId, outboxId);
    const used = uploads.outboxUploadIds(this.db, row.id);
    const res = this.db.prepare("DELETE FROM outbox WHERE id = ? AND user_id = ? AND status != 'sending'").run(row.id, userId);
    if (res.changes !== 1) throw new HttpError(409, 'Too late: the message is being sent.', 'TOO_LATE');
    this._deleteUploads(userId, used);
    this._arm();
    return { ok: true };
  }

  /** Waiting, sending and failed messages, newest first. */
  list(userId) {
    return this.db
      .prepare(`SELECT * FROM outbox WHERE user_id = ? AND status IN (${ACTIVE.map(() => '?').join(', ')}) ORDER BY created_at DESC, id DESC`)
      .all(userId, ...ACTIVE);
  }

  // ------------------------------------------------------------------------------------------
  // Sending
  // ------------------------------------------------------------------------------------------

  /**
   * Send what is due now: a lane per account (within the limits), one attempt per row. Resolves
   * once the lanes have finished.
   */
  async sendDue() {
    this._pump();
    while (this.lanes.size) await Promise.allSettled([...this.lanes.values()].map((l) => l.promise));
  }

  /** Start a lane for every account with mail due that has none (MAX_LANES, LANES_PER_USER). */
  _pump() {
    if (this.stopped) return;
    this._purgeFinished();
    const due = this._safe(
      () =>
        this.db
          .prepare(
            "SELECT account_id, user_id, MIN(send_at) AS at FROM outbox WHERE status = 'queued' AND send_at <= ? GROUP BY account_id, user_id ORDER BY at, account_id"
          )
          .all(Date.now()),
      []
    );
    for (const { account_id: accountId, user_id: userId } of due) {
      if (this.lanes.size >= MAX_LANES) break;
      if (this.lanes.has(accountId)) continue;
      if ([...this.lanes.values()].filter((l) => l.userId === userId).length >= LANES_PER_USER) continue;
      const lane = { userId, promise: null };
      this.lanes.set(accountId, lane);
      lane.promise = this._runLane(accountId)
        .catch((err) => this.logger.error(`[outbox] sending for account ${accountId} failed:`, err))
        .finally(() => {
          this.lanes.delete(accountId);
          // A lane slot is free: whoever waits for one goes now.
          if (this.started && !this.stopped) this._pump();
          this._arm();
        });
    }
  }

  /** One account's due rows, one at a time, each at most once per lane. */
  async _runLane(accountId) {
    const attempted = [];
    for (;;) {
      if (this.stopped) return;
      const next = this._safe(
        () =>
          this.db
            .prepare(
              `SELECT id FROM outbox WHERE account_id = ? AND status = 'queued' AND send_at <= ?${
                attempted.length ? ` AND id NOT IN (${attempted.map(() => '?').join(', ')})` : ''
              } ORDER BY send_at, id LIMIT 1`
            )
            .get(accountId, Date.now(), ...attempted),
        null
      );
      if (!next) return;
      attempted.push(next.id);
      await this._sendOne(next.id).catch((err) => this.logger.error(`[outbox] unexpected failure sending ${next.id}:`, err));
    }
  }

  _purgeFinished() {
    this._safe(() =>
      this.db.prepare("DELETE FROM outbox WHERE status IN ('sent', 'cancelled') AND created_at < ?").run(Date.now() - KEEP_FINISHED_MS)
    );
  }

  async _sendOne(id) {
    const { db } = this;
    // Claim it: a cancel that got there first wins.
    const claimed = db
      .prepare("UPDATE outbox SET status = 'sending', attempts = attempts + 1, handed_over_at = NULL WHERE id = ? AND status = 'queued' AND send_at <= ?")
      .run(id, Date.now());
    if (claimed.changes !== 1) return;
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id);
    if (!row) return;
    const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(row.account_id, row.user_id);
    if (!account) return this._fail(row, new HttpError(404, 'The account this message was to be sent from was removed.', 'NOT_FOUND'));

    // Delivered to some recipients already: the same message (Message-ID, Date) to the others.
    const pending = pendingRecipients(row);
    const resend = !!(pending && row.sent_at);
    let payload;
    let built;
    let rawWithBcc;
    let result;
    try {
      payload = compose.validatePayload(parsePayload(row));
      const { payload: ready, attachments } = await drafts.materialize(this.deps, row.user_id, payload);
      const fromName = drafts.senderNameFor(db, account);
      const same = resend && row.sent_message_id ? { messageId: row.sent_message_id, date: new Date(row.sent_at) } : {};
      built = await compose.buildMime({ account, payload: ready, attachments, fromName, ...same });
      // The same message with its Bcc header, for Microsoft Graph (which reads the recipients from
      // the headers) and for the sender's own Sent copy. Only the delivered copy leaves Bcc out.
      const { raw, messageId, date } = built;
      rawWithBcc = async () => {
        if (!ready.bcc.length) return raw;
        return (await compose.buildMime({ account, payload: ready, attachments, fromName, messageId, date, keepBcc: true })).raw;
      };
      const wanted = pending ? new Set(pending.map((a) => a.toLowerCase())) : null;
      const recipients = wanted ? built.envelope.to.filter((a) => wanted.has(String(a).toLowerCase())) : built.envelope.to;
      if (!recipients.length) {
        result = { accepted: [], rejected: [], rejectedErrors: [], via: 'smtp' }; // nobody left to send to
      } else {
        result = await smtp.sendMessage(this.deps, account, {
          from: built.envelope.from,
          recipients,
          raw,
          graphRaw: rawWithBcc,
          smtpOnly: !!wanted,
          onHandover: () => this._handedOver(row.id),
          signal: AbortSignal.timeout(this.sendDeadlineMs),
        });
      }
    } catch (err) {
      return this._fail(row, err);
    }

    const complete = !result.rejected.length;
    if (complete) {
      this._safe(() =>
        db
          .prepare(
            "UPDATE outbox SET status = 'sent', sent_at = COALESCE(sent_at, ?), sent_message_id = COALESCE(sent_message_id, ?), error = NULL, pending_recipients = NULL WHERE id = ?"
          )
          .run(Date.now(), built.messageId, row.id)
      );
    } else {
      this._partlySent(row, built, result);
    }
    // Follow-up steps never delay the next message of the queue... but are awaited by stop().
    const followUp = this._afterSend(row, account, payload, built, result.via, rawWithBcc, { first: !resend, complete }).finally(() =>
      this.followUps.delete(followUp)
    );
    this.followUps.add(followUp);
  }

  _handedOver(id) {
    this._safe(() => this.db.prepare("UPDATE outbox SET handed_over_at = ? WHERE id = ? AND status = 'sending'").run(Date.now(), id));
  }

  /**
   * The server accepted the message for some recipients and refused others: keep the row (and
   * the refused recipients) in the outbox, to try them once more when every refusal was
   * temporary, else for the user to see.
   */
  _partlySent(row, built, result) {
    const now = Date.now();
    const why = new Map(result.rejectedErrors.map((e) => [String(e.address).toLowerCase(), e]));
    const temporary = (address) => {
      const e = why.get(String(address).toLowerCase());
      return !!e && e.code >= 400 && e.code < 500;
    };
    const left = result.rejected;
    const reached = result.accepted.length === 1 ? result.accepted[0] : `${result.accepted.length} recipients`;
    const refusals = left
      .map((address) => {
        const e = why.get(String(address).toLowerCase());
        return e && e.response ? `${address} (${e.response})` : address;
      })
      .join(', ')
      .slice(0, 600);
    const allTemporary = left.every(temporary);
    const again = allTemporary && row.attempts < 2 && !this.stopped;
    let error = result.accepted.length ? `Sent to ${reached}, but not delivered to ${refusals}.` : `Not delivered to ${refusals}.`;
    if (again) error += ' Trying them again in a minute.';
    else if (allTemporary) error += ' The server only refused them for now: retry later.';
    this._safe(() =>
      this.db
        .prepare(
          `UPDATE outbox SET status = ?, send_at = ?, error = ?, pending_recipients = ?,
             sent_at = COALESCE(sent_at, ?), sent_message_id = COALESCE(sent_message_id, ?) WHERE id = ?`
        )
        .run(again ? 'queued' : 'failed', again ? now + this.retryDelayMs : row.send_at, error, JSON.stringify(left), now, built.messageId, row.id)
    );
    this.logger.warn(`[outbox] message ${row.id} (account ${row.account_id}): ${error}`);
  }

  _fail(row, err) {
    const message = errorText(err);
    const retryable = !!(err && err.retryable === true && !err.maybeSent);
    if (retryable && row.attempts < 2 && !this.stopped) {
      this._safe(() =>
        this.db
          .prepare("UPDATE outbox SET status = 'queued', send_at = ?, error = ? WHERE id = ?")
          .run(Date.now() + this.retryDelayMs, `${message} Trying again in a minute.`, row.id)
      );
    } else {
      this._safe(() => this.db.prepare("UPDATE outbox SET status = 'failed', error = ? WHERE id = ?").run(message, row.id));
    }
    this.logger.warn(`[outbox] message ${row.id} (account ${row.account_id}) not sent: ${message}`);
  }

  /**
   * first: the message reached its first recipients now (not a resend to the remaining ones);
   * complete: nobody is left to send it to.
   */
  async _afterSend(row, account, payload, built, via, rawWithBcc, { first = true, complete = true } = {}) {
    const draft = draftOf(row);
    const steps = [];
    if (first) {
      steps.push(['sent copy', () => this._sentCopy(account, built, via, rawWithBcc)]);
      steps.push(['answered flag', () => (payload.replyToMessageId ? this._markAnswered(row.user_id, payload.replyToMessageId) : null)]);
      // Only the drafts saved up to queueing: a draft saved later is the user's newer one.
      steps.push([
        'draft cleanup',
        () => (draft ? drafts.deleteRefsAcrossAccounts(this.deps, row.user_id, drafts.draftChain(this.db, draft, { until: row.created_at })) : null),
      ]);
    }
    if (complete) steps.push(['upload cleanup', () => this._deleteUploads(row.user_id, uploads.outboxUploadIds(this.db, row.id))]);
    for (const [name, step] of steps) {
      try {
        await step();
      } catch (err) {
        this.logger.warn(`[outbox] message ${row.id}: ${name} failed: ${imap.friendlyImapError(err)}`);
      }
    }
  }

  /**
   * File the sent message in \Sent unless the provider's server (or Microsoft Graph) does that itself.
   * rawWithBcc: the message as sent plus its Bcc header (the sender's copy records whom they Bcc'd).
   */
  async _sentCopy(account, built, via = 'smtp', rawWithBcc = async () => built.raw) {
    const policy = via === 'graph' ? 'server' : sentCopyPolicy(account);
    const deps = this.deps;
    if (policy === 'server') {
      drafts.syncFolderSoon(deps, drafts.specialFolderRow(deps.db, account.id, '\\Sent'));
      return;
    }
    // Providers that do not document it: give a server-side copy a moment to appear first.
    if (sentCopyUnverified(account) && this.sentCopyCheckDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.sentCopyCheckDelayMs));
    }
    const raw = await rawWithBcc();
    const folder = await drafts.serializePerAccount(account.id, () =>
      imap.withImap(deps, account, async (client) => {
        const sent = await drafts.resolveSpecialFolder(deps, account, client, '\\Sent', { create: policy === 'append' });
        if (!sent) return null;
        const existing = await drafts.findByMessageId(client, sent.path, built.messageId);
        if (existing.length) return sent; // the server filed it already
        const res = await drafts.appendRaw(client, sent.path, raw, ['\\Seen'], built.messageId);
        drafts.rememberAppend(deps.db, sent.id, res.uid, res.uidValidity);
        return sent;
      })
    );
    drafts.syncFolderSoon(deps, folder);
  }

  /** Set \Answered on the message replied to, on the server and here. */
  async _markAnswered(userId, messageId) {
    const deps = this.deps;
    const original = drafts.currentMessageRow(deps.db, userId, messageId);
    if (!original) return;
    const account = deps.db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(original.account_id, userId);
    if (!account) return;
    deps.db.prepare('UPDATE messages SET is_answered = 1, flags_changed_at = ? WHERE id = ?').run(Date.now(), original.id);
    await drafts.serializePerAccount(account.id, () =>
      imap.withImap(deps, account, async (client) => {
        const lock = await client.getMailboxLock(original.mailbox);
        try {
          if (Number(client.mailbox.uidValidity) !== Number(original.uid_validity)) return;
          await client.messageFlagsAdd(String(original.uid), ['\\Answered'], { uid: true });
        } finally {
          lock.release();
        }
      })
    );
  }

  /** Delete these uploads of the user, unless a message waiting in the outbox still needs them. */
  _deleteUploads(userId, uploadIds) {
    for (const id of uploadIds || []) {
      if (!uploads.uploadInUse(this.db, id)) uploads.deleteUpload(this.deps, userId, id);
    }
  }
}

module.exports = { OutboxManager, getUserSettings, outboxItemJson, sentCopyPolicy, resolveSendAt, DEFAULT_SETTINGS };
