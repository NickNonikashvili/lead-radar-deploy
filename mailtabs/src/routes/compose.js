'use strict';

/**
 * Writing mail: compose prefills (reply / reply all / forward / reopen a draft), attachment
 * uploads, drafts saved to the account's Drafts folder, sending through the outbox (undo send,
 * scheduled send), the outbox itself, and recipient autocomplete.
 *
 *   GET    /api/compose/prepare?mode=new|reply|replyAll|forward|draft&messageId=
 *   POST   /api/uploads            raw body, X-Filename (percent-encoded), Content-Type
 *   DELETE /api/uploads/:id
 *   POST   /api/drafts             { payload, draft? }     (at most one save per second per user)
 *   DELETE /api/drafts             { draft }
 *   POST   /api/send               { payload, sendAt?, draft? }
 *   GET    /api/outbox,  GET /api/outbox/:id
 *   POST   /api/outbox/:id/cancel | /retry,   DELETE /api/outbox/:id
 *   GET    /api/contacts?q=&limit=
 *
 * Everything is scoped to the signed-in user: accounts, folders, messages, uploads and outbox
 * rows of other users read as "not found".
 */

const express = require('express');
const { HttpError } = require('../errors');
const { requireAuth, asyncHandler, rateLimit } = require('../middleware');
const compose = require('../compose');
const drafts = require('../drafts');
const uploads = require('../uploads');
const folders = require('../folders');
const smtp = require('../smtp');
const { outboxItemJson } = require('../outbox');
const queries = require('../queries');

const { validate } = queries;

const PREPARE_MODES = ['new', 'reply', 'replyAll', 'forward', 'draft'];
const BODY_WAIT_MS = 45000;
// Upload bodies are read into memory: one file at most 25 MB (plus a little multipart-free slack),
// a few at a time per user, and never more pending bytes than the per-user quota.
const RAW_UPLOAD_LIMIT = '26mb';
const MAX_PARALLEL_UPLOADS = 4;
const PENDING_UPLOAD_QUOTA = 250 * 1024 * 1024; // the same quota uploads.saveUpload enforces
const MAX_FILENAME_HEADER = 1024;
const MAX_ACTIVE_OUTBOX = 500;
const SEND_WINDOW_MS = 10 * 60 * 1000;
const SEND_MAX = 60;

function scalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

function withTimeout(promise, ms, onTimeout) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        try {
          resolve(onTimeout());
        } catch (err) {
          reject(err);
        }
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** A { folderId, uid } draft reference, null when absent, else 400. */
function readDraftRef(value) {
  if (value === undefined || value === null) return null;
  const ref = drafts.validDraftRef(value);
  if (!ref) throw validate.badRequest('Invalid draft.', 'INVALID_DRAFT');
  return ref;
}

function requirePayload(body) {
  const payload = body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw validate.badRequest('The message is missing.', 'INVALID_COMPOSE');
  return payload;
}

/** An IANA time zone / BCP 47 locale from the query, or undefined when absent or unknown. */
function readTimeZone(value) {
  const v = scalar(value);
  if (typeof v !== 'string' || !v || v.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v }).format(0);
    return v;
  } catch (_) {
    return undefined;
  }
}

function readLocale(value) {
  const v = scalar(value);
  if (typeof v !== 'string' || !v || v.length > 35) return undefined;
  try {
    return Intl.getCanonicalLocales(v)[0];
  } catch (_) {
    return undefined;
  }
}

/** The X-Filename header: percent-encoded UTF-8 (the browser can only send ASCII headers). */
function decodeFilenameHeader(value) {
  const raw = typeof value === 'string' ? value.slice(0, MAX_FILENAME_HEADER) : '';
  if (!raw) return 'attachment';
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    return raw; // not valid percent-encoding: use it as it came (cleanFilename makes it safe)
  }
}

// ---------------------------------------------------------------------------------------------
// /api/uploads — mounted before the JSON body parser: its bodies are files of any type.
// ---------------------------------------------------------------------------------------------

function uploadsRouter({ db, config }) {
  const router = express.Router();
  router.use(requireAuth);
  const deps = { db, config };
  const inFlight = new Map(); // userId -> uploads being received

  /** Refuse what can be refused before a byte of the body is read. */
  function uploadGate(req, res, next) {
    const userId = req.user.id;
    const declared = req.get('content-length');
    const length = declared !== undefined && /^\d{1,12}$/.test(declared) ? Number(declared) : null;
    if (length !== null && length > uploads.MAX_UPLOAD_BYTES) {
      return next(new HttpError(413, 'This file is too large to attach (at most 25 MB).', 'UPLOAD_TOO_LARGE'));
    }
    const usage = db.prepare('SELECT COALESCE(SUM(size), 0) AS bytes FROM uploads WHERE user_id = ?').get(userId);
    if (Number(usage.bytes) + (length || 0) > PENDING_UPLOAD_QUOTA) {
      return next(new HttpError(413, 'You have too many unsent attachments. Send or discard some drafts first.', 'UPLOAD_QUOTA'));
    }
    const running = inFlight.get(userId) || 0;
    if (running >= MAX_PARALLEL_UPLOADS) {
      res.setHeader('Retry-After', '2');
      return next(new HttpError(429, 'Too many uploads at once. Wait for the others to finish.', 'RATE_LIMITED'));
    }
    inFlight.set(userId, running + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const n = (inFlight.get(userId) || 1) - 1;
      if (n > 0) inFlight.set(userId, n);
      else inFlight.delete(userId);
    };
    res.on('finish', release);
    res.on('close', release);
    next();
  }

  router.post(
    '/',
    uploadGate,
    express.raw({ type: () => true, limit: RAW_UPLOAD_LIMIT }),
    (req, res) => {
      // body-parser leaves {} for an empty body: an empty file is still a file.
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const upload = uploads.saveUpload(deps, req.user.id, {
        filename: decodeFilenameHeader(req.get('x-filename')),
        contentType: req.get('content-type') || 'application/octet-stream',
        buffer,
      });
      res.status(201).json({ upload });
    }
  );

  router.delete('/:id', (req, res) => {
    const userId = req.user.id;
    const row = uploads.getUpload(db, userId, req.params.id);
    if (!row) throw new HttpError(404, 'Attachment not found', 'NOT_FOUND');
    // A message waiting in the outbox still needs it (cancel or delete that message first).
    if (uploads.uploadInUse(db, row.id)) {
      throw new HttpError(409, 'This attachment belongs to a message waiting to be sent.', 'UPLOAD_IN_USE');
    }
    uploads.deleteUpload(deps, userId, row.id);
    res.json({ ok: true });
  });

  // A body over the limit gets the same friendly answer as a declared one.
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return next(new HttpError(413, 'This file is too large to attach (at most 25 MB).', 'UPLOAD_TOO_LARGE'));
    }
    next(err);
  });

  return router;
}

// ---------------------------------------------------------------------------------------------
// Everything else (mounted at /api)
// ---------------------------------------------------------------------------------------------

module.exports = function composeRoutes({ db, config, crypto, syncManager, outboxManager, logger = console }) {
  if (!outboxManager) throw new TypeError('composeRoutes: outboxManager is required');
  const router = express.Router();
  // Mounted at /api: only this router's own paths require a session (others fall through).
  const deps = { db, crypto, config, syncManager, logger };

  const draftLimiter = rateLimit({
    windowMs: 1000,
    max: 1,
    key: (req) => `drafts:${req.user.id}`,
    message: 'Saving drafts too quickly. Try again in a moment.',
  });
  const sendLimiter = rateLimit({
    windowMs: SEND_WINDOW_MS,
    max: SEND_MAX,
    key: (req) => `send:${req.user.id}`,
    message: 'You have sent a lot of messages in a short time. Wait a few minutes and try again.',
  });

  function loadAccount(userId, rawId, what = 'account') {
    const id = validate.requireId(rawId, what);
    const account = queries.getAccountRowForUser(db, userId, id);
    if (!account) throw new HttpError(404, 'Account not found', 'NOT_FOUND');
    return account;
  }

  function loadMessage(userId, rawId) {
    const id = validate.requireId(rawId, 'message id');
    const row = queries.getMessageForUser(db, userId, id);
    if (!row) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    return row;
  }

  /** The user's folder holding a draft reference, else 404. */
  function draftFolder(userId, ref) {
    const folder = folders.folderForUser(db, userId, ref.folderId);
    if (!folder) throw new HttpError(404, 'Draft not found', 'NOT_FOUND');
    return folder;
  }

  /** Download a deferred body first, so the quote has the whole message (best effort). */
  async function withBody(row) {
    if (row.body_state === 'ready') return row;
    try {
      const updated = await withTimeout(Promise.resolve().then(() => syncManager.fetchBodyNow(row)), BODY_WAIT_MS, () => null);
      return updated && updated.id === row.id ? updated : row;
    } catch (_) {
      return row; // quote what we have (the snippet) rather than failing the reply
    }
  }

  // --- compose prefill ------------------------------------------------------------------

  router.get(
    '/compose/prepare',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const mode = scalar(req.query.mode) || 'new';
      if (!PREPARE_MODES.includes(mode)) throw validate.badRequest(`mode must be one of: ${PREPARE_MODES.join(', ')}.`, 'INVALID_MODE');
      // Someone else's message is "not found" whatever else is wrong with the request.
      const row = mode === 'new' ? null : loadMessage(userId, scalar(req.query.messageId));
      const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at, id').all(userId);
      if (!accounts.length) throw validate.badRequest('Connect an email account first.', 'NO_ACCOUNTS');
      const timeZone = readTimeZone(req.query.tz);
      const locale = readLocale(req.query.locale);

      if (mode === 'new') {
        const requested = scalar(req.query.accountId);
        const account =
          requested !== undefined && requested !== ''
            ? loadAccount(userId, requested)
            : accounts.find((a) => smtp.sendingStatus(deps, a).canSend) || accounts[0];
        const payload = compose.prepareCompose({ mode: 'new', account, accounts, timeZone, locale });
        return res.json({ payload, draft: null });
      }

      if (mode === 'draft') return res.json(await drafts.loadDraft(deps, userId, row));

      // Replies and forwards come from the account that received the original.
      const account = accounts.find((a) => a.id === row.account_id);
      if (!account) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
      const folder = row.folder_id ? folders.getFolder(db, row.folder_id) : null;
      const inSentFolder = !!folder && folder.account_id === account.id && folder.special_use === '\\Sent';
      const original = await withBody(row);
      const payload = compose.prepareCompose({
        mode,
        original,
        account,
        accounts,
        inSentFolder,
        signatureHtml: account.signature_html,
        timeZone,
        locale,
      });
      res.json({ payload, draft: null });
    })
  );

  // --- drafts ---------------------------------------------------------------------------

  router.post(
    '/drafts',
    requireAuth,
    draftLimiter,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const body = validate.requireBody(req);
      const payload = requirePayload(body);
      const account = loadAccount(userId, payload.accountId, 'From account');
      const previous = readDraftRef(body.draft);
      if (previous) draftFolder(userId, previous);
      const draft = await drafts.saveDraft(deps, account, payload, previous);
      res.json({ draft });
    })
  );

  router.delete(
    '/drafts',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const body = validate.requireBody(req);
      const ref = readDraftRef(body.draft);
      if (!ref) throw validate.badRequest('Which draft? Send { draft: { folderId, uid } }.', 'INVALID_DRAFT');
      const folder = draftFolder(userId, ref);
      const account = queries.getAccountRowForUser(db, userId, folder.account_id);
      if (!account) throw new HttpError(404, 'Draft not found', 'NOT_FOUND');
      await drafts.deleteDraft(deps, account, ref);
      res.json({ ok: true });
    })
  );

  // --- send + outbox --------------------------------------------------------------------

  router.post('/send', requireAuth, sendLimiter, (req, res) => {
    const userId = req.user.id;
    const body = validate.requireBody(req);
    const payload = requirePayload(body);
    const sendAt = body.sendAt;
    if (sendAt !== undefined && sendAt !== null && typeof sendAt !== 'number' && typeof sendAt !== 'string') {
      throw validate.badRequest('Invalid send time.', 'INVALID_SEND_AT');
    }
    if (typeof sendAt === 'string' && sendAt.length > 64) throw validate.badRequest('Invalid send time.', 'INVALID_SEND_AT');
    const draft = readDraftRef(body.draft);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE user_id = ? AND status IN ('queued', 'sending', 'failed')").get(userId);
    if (n >= MAX_ACTIVE_OUTBOX) {
      throw new HttpError(429, 'Your outbox is full. Wait for messages to go out, or delete failed ones.', 'OUTBOX_FULL');
    }
    // Validates the payload, the From account (and that it can send), attachments and the time.
    const row = outboxManager.queue(userId, payload, { sendAt: sendAt === null ? undefined : sendAt, draft });
    res.status(202).json({ outbox: outboxItemJson(row) });
  });

  router.get('/outbox', requireAuth, (req, res) => {
    res.json({ items: outboxManager.list(req.user.id).map(outboxItemJson) });
  });

  // One message, whatever its status (sent and cancelled ones are kept for a week): the composer
  // follows a send with it, so a message gone from the list is never taken for "sent".
  router.get('/outbox/:id', requireAuth, (req, res) => {
    const id = validate.requireId(req.params.id, 'outbox id');
    const row = outboxManager.get(req.user.id, id);
    if (!row) throw new HttpError(404, 'This message is no longer in the outbox.', 'NOT_FOUND');
    res.json({ outbox: outboxItemJson(row) });
  });

  router.post('/outbox/:id/cancel', requireAuth, (req, res) => {
    const id = validate.requireId(req.params.id, 'outbox id');
    res.json(outboxManager.cancelWithDraft(req.user.id, id));
  });

  router.post('/outbox/:id/retry', requireAuth, (req, res) => {
    const id = validate.requireId(req.params.id, 'outbox id');
    res.json({ outbox: outboxItemJson(outboxManager.retry(req.user.id, id)) });
  });

  router.delete('/outbox/:id', requireAuth, (req, res) => {
    const id = validate.requireId(req.params.id, 'outbox id');
    res.json(outboxManager.remove(req.user.id, id));
  });

  // --- contacts -------------------------------------------------------------------------

  router.get('/contacts', requireAuth, (req, res) => {
    const q = scalar(req.query.q);
    const rawLimit = scalar(req.query.limit);
    const limit = rawLimit === undefined || rawLimit === '' ? 8 : validate.requireInt(rawLimit, { field: 'limit', min: 1, max: 20 });
    res.json({ contacts: queries.listContacts(db, req.user.id, { q: typeof q === 'string' ? q : '', limit }) });
  });

  return router;
};

module.exports.uploadsRouter = uploadsRouter;
module.exports.decodeFilenameHeader = decodeFilenameHeader;
