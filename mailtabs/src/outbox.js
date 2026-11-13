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
 * Failures: status 'failed' with a friendly error. Connection problems (and other temporary
 * answers) get one automatic retry after a minute; login, recipient and size errors do not.
 * A process that died mid-send leaves rows in 'sending'; start() queues them again.
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
const ACCOUNT_CONCURRENCY = 4;
const STOP_WAIT_MS = 10000;
const ACTIVE = ['queued', 'sending', 'failed'];

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

/** Outbox row -> the JSON the outbox list shows. */
function outboxItemJson(row) {
  const payload = parsePayload(row);
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

/**
 * Does Mailtabs have to APPEND a copy to Sent for this account? 'append' | 'server' | 'if-folder'
 * ('if-folder': Other-IMAP accounts — only when the server has a Sent folder; never create one).
 * The outgoing server decides when it is a known one (e.g. an IMAP account sending via Gmail).
 */
function sentCopyPolicy(account) {
  const settings = smtp.smtpSettingsFor(account);
  const bySmtp = providers.presetKeyForSmtpHost(settings.host);
  const key = bySmtp || account.provider;
  const preset = providers.PRESETS[key];
  if (!preset || key === 'imap') return 'if-folder';
  return preset.sentCopy === 'server' ? 'server' : 'append';
}

function sentCopyUnverified(account) {
  const key = providers.presetKeyForSmtpHost(smtp.smtpSettingsFor(account).host) || account.provider;
  return !!(providers.PRESETS[key] && providers.PRESETS[key].sentCopyUnverified);
}

function errorText(err) {
  if (!err) return 'Sending failed.';
  if (err instanceof HttpError || err.expose === true) return err.message;
  return smtp.friendlySmtpError(err);
}

class OutboxManager {
  /**
   * @param {{ db, crypto, config, syncManager?, logger?, retryDelayMs?, sentCopyCheckDelayMs? }} deps
   *   retryDelayMs / sentCopyCheckDelayMs are only changed by tests.
   */
  constructor({ db, crypto, config, syncManager = null, logger = console, retryDelayMs = 60000, sentCopyCheckDelayMs = 3000 }) {
    if (!db || !crypto || !config) throw new Error('OutboxManager needs { db, crypto, config }');
    this.db = db;
    this.logger = logger || console;
    this.deps = { db, crypto, config, syncManager, logger: this.logger };
    this.retryDelayMs = retryDelayMs;
    this.sentCopyCheckDelayMs = sentCopyCheckDelayMs;
    this.timer = null;
    this.running = null;
    this.again = false;
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
    // A previous process died mid-send: those rows go out again (at-least-once).
    this._safe(() => this.db.prepare("UPDATE outbox SET status = 'queued' WHERE status = 'sending'").run());
    this._arm();
  }

  async stop() {
    this.stopped = true;
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const pending = [this.running, ...this.followUps].filter(Boolean);
    if (!pending.length) return;
    let t;
    await Promise.race([Promise.allSettled(pending), new Promise((resolve) => (t = setTimeout(resolve, STOP_WAIT_MS)))]);
    clearTimeout(t);
  }

  /** Wait until no send or follow-up step is running (tests). */
  async idle() {
    while (this.running || this.followUps.size) {
      await Promise.allSettled([this.running, ...this.followUps].filter(Boolean));
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

  /** Schedule the next sendDue() for the earliest queued row. */
  _arm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.started || this.stopped) return;
    const next = this._safe(() => this.db.prepare("SELECT MIN(send_at) AS at FROM outbox WHERE status = 'queued'").get(), null);
    if (!next || next.at === null || next.at === undefined) return;
    const delay = Math.min(Math.max(0, next.at - Date.now()), MAX_TIMER_MS);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sendDue().catch((err) => this.logger.error('[outbox] send pass failed:', err));
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
      if (ref.messageId && !drafts.messageForUser(db, userId, ref.messageId)) {
        throw new HttpError(410, 'A message you attached files from is no longer available.', 'ATTACHMENT_GONE');
      }
    }
    for (const key of ['replyToMessageId', 'forwardOfMessageId']) {
      if (normalized[key] && !drafts.messageForUser(db, userId, normalized[key])) normalized[key] = null;
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
    const at = resolveSendAt(sendAt, now, getUserSettings(db, userId).undoSendSeconds);
    const info = db
      .prepare(
        `INSERT INTO outbox (user_id, account_id, payload, send_at, status, attempts, draft_folder_id, draft_uid, created_at)
         VALUES (?, ?, ?, ?, 'queued', 0, ?, ?, ?)`
      )
      .run(userId, account.id, JSON.stringify(normalized), at, draftRef ? draftRef.folderId : null, draftRef ? draftRef.uid : null, now);
    this._arm();
    return db.prepare('SELECT * FROM outbox WHERE id = ?').get(Number(info.lastInsertRowid));
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
    const res = this.db.prepare("UPDATE outbox SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'queued'").run(row.id, userId);
    if (res.changes !== 1) {
      throw new HttpError(409, row.status === 'sent' ? 'Too late: the message was already sent.' : 'Too late: the message is being sent.', 'TOO_LATE');
    }
    this._arm();
    const payload = parsePayload(row);
    payload.attachments = drafts.describeAttachments(this.db, userId, payload.attachments);
    return { payload, draft: draftOf(row) };
  }

  /** Try a failed message again now. */
  retry(userId, outboxId) {
    const row = this._requireRow(userId, outboxId);
    const res = this.db
      .prepare("UPDATE outbox SET status = 'queued', send_at = ?, error = NULL, attempts = 0 WHERE id = ? AND user_id = ? AND status = 'failed'")
      .run(Date.now(), row.id, userId);
    if (res.changes !== 1) throw new HttpError(409, 'Only messages that failed to send can be retried.', 'NOT_FAILED');
    this._arm();
    return this.db.prepare('SELECT * FROM outbox WHERE id = ?').get(row.id);
  }

  /** Delete a queued, failed (or finished) message and the uploads only it used. */
  remove(userId, outboxId) {
    const row = this._requireRow(userId, outboxId);
    const res = this.db.prepare("DELETE FROM outbox WHERE id = ? AND user_id = ? AND status != 'sending'").run(row.id, userId);
    if (res.changes !== 1) throw new HttpError(409, 'Too late: the message is being sent.', 'TOO_LATE');
    this._deleteUploads(userId, parsePayload(row));
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

  /** Send every due row: accounts in parallel (bounded), one message at a time per account. */
  sendDue() {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        this._purgeFinished();
        const due = this._safe(
          () => this.db.prepare("SELECT id, account_id FROM outbox WHERE status = 'queued' AND send_at <= ? ORDER BY send_at, id").all(Date.now()),
          []
        );
        const byAccount = new Map();
        for (const r of due) {
          if (!byAccount.has(r.account_id)) byAccount.set(r.account_id, []);
          byAccount.get(r.account_id).push(r.id);
        }
        const lanes = [...byAccount.values()];
        const workers = Array.from({ length: Math.min(ACCOUNT_CONCURRENCY, lanes.length) }, async () => {
          for (let lane = lanes.shift(); lane; lane = lanes.shift()) {
            for (const id of lane) {
              if (this.stopped) return;
              await this._sendOne(id).catch((err) => this.logger.error(`[outbox] unexpected failure sending ${id}:`, err));
            }
          }
        });
        await Promise.all(workers);
      } while (this.again && !this.stopped);
    })().finally(() => {
      this.running = null;
      this._arm();
    });
    return this.running;
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
      .prepare("UPDATE outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ? AND status = 'queued' AND send_at <= ?")
      .run(id, Date.now());
    if (claimed.changes !== 1) return;
    const row = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id);
    if (!row) return;
    const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(row.account_id, row.user_id);
    if (!account) return this._fail(row, new HttpError(404, 'The account this message was to be sent from was removed.', 'NOT_FOUND'));

    let payload;
    let built;
    let result;
    try {
      payload = compose.validatePayload(parsePayload(row));
      const { payload: ready, attachments } = await drafts.materialize(this.deps, row.user_id, payload);
      const fromName = drafts.senderNameFor(db, account);
      built = await compose.buildMime({ account, payload: ready, attachments, fromName });
      result = await smtp.sendMessage(this.deps, account, {
        from: built.envelope.from,
        recipients: built.envelope.to,
        raw: built.raw,
        // Graph reads the recipients from the headers: the same message, Bcc header kept.
        graphRaw: async () =>
          (await compose.buildMime({ account, payload: ready, attachments, fromName, messageId: built.messageId, date: built.date, keepBcc: true })).raw,
      });
    } catch (err) {
      return this._fail(row, err);
    }

    const note = result.rejected.length ? `Not delivered to: ${result.rejected.join(', ').slice(0, 400)}` : null;
    this._safe(() =>
      db
        .prepare("UPDATE outbox SET status = 'sent', sent_at = ?, sent_message_id = ?, error = ? WHERE id = ?")
        .run(Date.now(), built.messageId, note, row.id)
    );
    // Follow-up steps never delay the next message of the queue... but are awaited by stop().
    const followUp = this._afterSend(row, account, payload, built, result.via).finally(() => this.followUps.delete(followUp));
    this.followUps.add(followUp);
  }

  _fail(row, err) {
    const message = errorText(err);
    const retryable = !!(err && err.retryable === true);
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

  async _afterSend(row, account, payload, built, via) {
    const steps = [
      ['sent copy', () => this._sentCopy(account, built, via)],
      ['answered flag', () => (payload.replyToMessageId ? this._markAnswered(row.user_id, payload.replyToMessageId) : null)],
      ['draft cleanup', () => (draftOf(row) ? drafts.deleteRefsAcrossAccounts(this.deps, row.user_id, drafts.draftChain(this.db, draftOf(row))) : null)],
      ['upload cleanup', () => this._deleteUploads(row.user_id, payload)],
    ];
    for (const [name, step] of steps) {
      try {
        await step();
      } catch (err) {
        this.logger.warn(`[outbox] message ${row.id}: ${name} failed: ${imap.friendlyImapError(err)}`);
      }
    }
  }

  /** File the sent message in \Sent unless the provider's server (or Microsoft Graph) does that itself. */
  async _sentCopy(account, built, via = 'smtp') {
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
    const folder = await drafts.serializePerAccount(account.id, () =>
      imap.withImap(deps, account, async (client) => {
        const sent = await drafts.resolveSpecialFolder(deps, account, client, '\\Sent', { create: policy === 'append' });
        if (!sent) return null;
        const existing = await drafts.findByMessageId(client, sent.path, built.messageId);
        if (existing.length) return sent; // the server filed it already
        const res = await drafts.appendRaw(client, sent.path, built.raw, ['\\Seen'], built.messageId);
        drafts.rememberAppend(deps.db, sent.id, res.uid, res.uidValidity);
        return sent;
      })
    );
    drafts.syncFolderSoon(deps, folder);
  }

  /** Set \Answered on the message replied to, on the server and here. */
  async _markAnswered(userId, messageId) {
    const deps = this.deps;
    const original = drafts.messageForUser(deps.db, userId, messageId);
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

  /** Delete the uploads a payload used, unless another waiting message still needs them. */
  _deleteUploads(userId, payload) {
    const ids = ((payload && payload.attachments) || []).map((a) => a && a.uploadId).filter(Boolean);
    if (!ids.length) return;
    const inUse = uploads.uploadsInUse(this.db);
    for (const id of ids) if (!inUse.has(id)) uploads.deleteUpload(this.deps, userId, id);
  }
}

module.exports = { OutboxManager, getUserSettings, outboxItemJson, sentCopyPolicy, resolveSendAt, DEFAULT_SETTINGS };
