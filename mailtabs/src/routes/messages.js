'use strict';

/**
 * /api/messages — list, open, render (sandboxed iframe document), attachments, flag changes,
 * bulk actions and mark-all-read.
 *
 * Changes made here are written back to the real mail server (actions.js) so every other mail
 * app sees them too. Message bodies are rendered by mailparse.renderBodyDocument and served with
 * a CSP that forbids scripts entirely; the frontend's iframe sandbox is the second wall.
 */

const express = require('express');
const { HttpError } = require('../errors');
const { requireAuth, asyncHandler } = require('../middleware');
const imap = require('../imap');
const actions = require('../actions');
const { parseRawMessage, renderBodyDocument } = require('../mailparse');
const queries = require('../queries');

const { validate } = queries;

const MAX_BULK = 500;
const MAX_QUERY = 500;
const BODY_WAIT_MS = 45000;
const LOCAL_UPDATE_BATCH = 500;
const BULK_ACTIONS = ['read', 'unread', 'star', 'unstar', 'archive', 'trash'];

// Only these image types are shown inline (they are what cid: images in emails use). Everything
// else, including SVG (which can carry script), is always a download.
const INLINE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const CONTENT_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

/** CSP for the message-body document (SPEC §7, exactly). */
function bodyCsp(showImages) {
  return (
    `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: cid:${showImages ? ' https: http:' : ''}; ` +
    `font-src data:${showImages ? ' https:' : ''}; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`
  );
}

function setBodyHeaders(res, showImages) {
  res.setHeader('Content-Security-Policy', bodyCsp(showImages));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.type('html');
}

function flagQuery(value) {
  return value === '1' || value === 'true';
}

/** RFC 5987 encoding for filename*=UTF-8''… */
function encodeRfc5987(value) {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** A filename safe to put in a header: no path, no control characters, not empty. */
function cleanFilename(name, index) {
  const base = String(name || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split(/[\\/]/)
    .pop()
    .trim()
    .slice(0, 200);
  return base && base !== '.' && base !== '..' ? base : `attachment-${index + 1}`;
}

function contentDisposition(type, filename) {
  // Plain-ASCII fallback for very old clients; filename* carries the real (UTF-8) name.
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}

function errorMessage(err, fallback) {
  if (err && err.expose === true && err.message) return err.message;
  if (err) return imap.friendlyImapError(err) || fallback;
  return fallback;
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

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Group message rows by account, then by (mailbox, uidValidity) — one remote call per group. */
function groupForRemote(rows) {
  const byAccount = new Map();
  for (const row of rows) {
    if (!byAccount.has(row.account_id)) byAccount.set(row.account_id, new Map());
    const groups = byAccount.get(row.account_id);
    const key = `${row.mailbox}\u0000${row.uid_validity}`;
    if (!groups.has(key)) groups.set(key, { mailbox: row.mailbox, uidValidity: row.uid_validity, rows: [] });
    groups.get(key).rows.push(row);
  }
  return byAccount;
}

// ---------------------------------------------------------------------------------------------
// LRU cache of parsed attachments (a message with 5 inline images is downloaded once)
// ---------------------------------------------------------------------------------------------

class LruCache {
  constructor({ maxEntries = 20, maxBytes = 50 * 1024 * 1024 } = {}) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.map = new Map(); // key -> { value, size }  (Map keeps insertion order: oldest first)
    this.bytes = 0;
  }

  get size() {
    return this.map.size;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Re-insert to mark as most recently used.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  has(key) {
    return this.map.has(key);
  }

  set(key, value, size) {
    const bytes = Math.max(0, Number(size) || 0);
    this.delete(key);
    if (bytes > this.maxBytes) return false; // would evict everything else for one item
    this.map.set(key, { value, size: bytes });
    this.bytes += bytes;
    while (this.map.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldestKey = this.map.keys().next().value;
      this.delete(oldestKey);
    }
    return true;
  }

  delete(key) {
    const entry = this.map.get(key);
    if (!entry) return false;
    this.map.delete(key);
    this.bytes -= entry.size;
    return true;
  }

  clear() {
    this.map.clear();
    this.bytes = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------------------------

module.exports = function messagesRoutes({ db, config, crypto, syncManager }) {
  const router = express.Router();
  router.use(requireAuth);
  const imapDeps = { db, crypto, config };

  const attachmentCache = new LruCache({ maxEntries: 20, maxBytes: 50 * 1024 * 1024 });
  const attachmentFetches = new Map(); // cache key -> Promise (concurrent requests share one download)

  function loadMessage(userId, rawId) {
    const id = validate.requireId(rawId, 'message id');
    const row = queries.getMessageForUser(db, userId, id);
    if (!row) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    return row;
  }

  function loadAccount(userId, accountId) {
    const account = queries.getAccountRowForUser(db, userId, accountId);
    if (!account) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    return account;
  }

  /** The tab parameter: 'all' (default) or one of the user's tab ids. */
  function readTabParam(userId, value) {
    if (value === undefined || value === null || value === '' || value === 'all') return 'all';
    const id = validate.requireId(value, 'tab');
    queries.resolveTab(db, userId, id); // 404 when not the user's
    return id;
  }

  /** Download the body of a deferred message (shared with sync), within a time limit. */
  async function ensureBody(row) {
    if (row.body_state !== 'deferred') return { row };
    try {
      const updated = await withTimeout(Promise.resolve().then(() => syncManager.fetchBodyNow(row)), BODY_WAIT_MS, () => {
        throw new HttpError(504, 'The mail server is taking a long time to send this message. Try again in a moment.', 'TIMEOUT');
      });
      // Only trust a row for the same message (the stub sync manager returns its input as-is).
      return { row: updated && updated.id === row.id ? updated : row };
    } catch (err) {
      return { row, bodyError: errorMessage(err, 'The message could not be downloaded from the mail server.') };
    }
  }

  // --- list -------------------------------------------------------------------------------

  router.get('/', (req, res) => {
    const userId = req.user.id;
    const q = req.query;
    const scalar = (v) => (Array.isArray(v) ? v[0] : v);
    const tabId = readTabParam(userId, scalar(q.tab));
    let accountId;
    if (scalar(q.account) !== undefined && scalar(q.account) !== '') {
      accountId = validate.requireId(scalar(q.account), 'account');
      if (!queries.getAccountRowForUser(db, userId, accountId)) throw new HttpError(404, 'Account not found', 'NOT_FOUND');
    }
    const search = typeof scalar(q.q) === 'string' ? scalar(q.q).slice(0, MAX_QUERY) : undefined;
    const limit = scalar(q.limit) === undefined || scalar(q.limit) === '' ? undefined : Number(scalar(q.limit));
    if (limit !== undefined && !Number.isFinite(limit)) throw validate.badRequest('limit must be a number.');

    res.json(
      queries.listMessages(db, userId, {
        tabId,
        accountId,
        q: search,
        unread: flagQuery(scalar(q.unread)),
        starred: flagQuery(scalar(q.starred)),
        before: typeof scalar(q.before) === 'string' ? scalar(q.before) : undefined,
        limit,
      })
    );
  });

  // --- bulk + mark-all-read (before /:id so these paths never parse as ids) --------------

  /** Apply one bulk action to every group; returns { count, failed }. */
  async function applyToGroups(userId, rows, action) {
    const failed = [];
    let count = 0;
    const byAccount = groupForRemote(rows);
    await Promise.all(
      [...byAccount].map(async ([accountId, groups]) => {
        const account = queries.getAccountRowForUser(db, userId, accountId);
        if (!account) return; // removed meanwhile; its messages are gone too
        for (const group of groups.values()) {
          const target = { ...account, mailbox: group.mailbox };
          const uids = group.rows.map((r) => r.uid);
          const ids = group.rows.map((r) => r.id);
          try {
            if (action === 'archive' || action === 'trash') {
              await actions.moveMessages(imapDeps, target, uids, action, { uidValidity: group.uidValidity });
              for (const batch of chunk(ids, LOCAL_UPDATE_BATCH)) {
                count += db.prepare(`DELETE FROM messages WHERE id IN (${batch.map(() => '?').join(', ')})`).run(...batch).changes;
              }
            } else {
              const flags =
                action === 'read' ? { isRead: true } : action === 'unread' ? { isRead: false } : action === 'star' ? { isStarred: true } : { isStarred: false };
              await actions.applyFlags(imapDeps, target, uids, { ...flags, uidValidity: group.uidValidity });
              const [column, value] = 'isRead' in flags ? ['is_read', flags.isRead ? 1 : 0] : ['is_starred', flags.isStarred ? 1 : 0];
              for (const batch of chunk(ids, LOCAL_UPDATE_BATCH)) {
                count += db
                  .prepare(`UPDATE messages SET ${column} = ? WHERE ${column} != ? AND id IN (${batch.map(() => '?').join(', ')})`)
                  .run(value, value, ...batch).changes;
              }
            }
          } catch (err) {
            failed.push({ accountId, error: errorMessage(err, 'The mail server refused the change.') });
          }
        }
      })
    );
    return { count, failed };
  }

  router.post(
    '/bulk',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const body = validate.requireBody(req);
      const ids = validate.requireIdList(body.ids, { what: 'ids', max: MAX_BULK });
      if (!BULK_ACTIONS.includes(body.action)) {
        throw validate.badRequest(`action must be one of: ${BULK_ACTIONS.join(', ')}.`, 'INVALID_ACTION');
      }
      // Ids that are not the user's simply match nothing.
      const rows = queries.getMessagesForUser(db, userId, ids);
      const { count, failed } = await applyToGroups(userId, rows, body.action);
      res.json({ ok: true, count, failed });
    })
  );

  router.post(
    '/mark-all-read',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const body = validate.requireBody(req);
      const tab = queries.resolveTab(db, userId, readTabParam(userId, body.tab));
      const refs = queries.selectTabMessageRefs(db, userId, tab, { unread: true });
      const { count, failed } = await applyToGroups(userId, refs, 'read');
      if (failed.length && count === 0) {
        // Nothing could be changed: report it as an error so the UI rolls back.
        throw new HttpError(502, failed[0].error, 'REMOTE_FAILED');
      }
      res.json({ ok: true, count, failed });
    })
  );

  // --- one message ------------------------------------------------------------------------

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const row = loadMessage(userId, req.params.id);
      const { row: current, bodyError } = await ensureBody(row);
      const message = queries.toMessageDetail(current);
      if (bodyError) message.bodyError = bodyError;
      res.json({ message });
    })
  );

  router.get(
    '/:id/body',
    asyncHandler(async (req, res) => {
      const showImages = flagQuery(req.query.images);
      setBodyHeaders(res, showImages);
      let row;
      try {
        row = loadMessage(req.user.id, req.params.id);
      } catch (err) {
        if (err instanceof HttpError) {
          res.status(err.status === 400 ? 400 : 404).send(renderBodyDocument({ text: 'This message was not found.' }));
          return;
        }
        throw err;
      }
      let { row: current, bodyError } = await ensureBody(row);
      if (current.body_state === 'deferred' && !bodyError) bodyError = 'The full message has not been downloaded yet.';
      const html = bodyError
        ? renderBodyDocument({ text: `${bodyError}\n\n${current.snippet || ''}`.trim(), subject: current.subject })
        : renderBodyDocument({ html: current.html_body, text: current.text_body, subject: current.subject }, { showImages });
      res.send(html);
    })
  );

  /** Parsed attachments [{filename, contentType, content}] of a message, from cache or IMAP. */
  async function getAttachments(row, account) {
    // created_at is part of the key: SQLite can reuse the id of a deleted row.
    const key = `${row.id}:${row.account_id}:${row.mailbox}:${row.uid_validity}:${row.uid}:${row.created_at}`;
    const cached = attachmentCache.get(key);
    if (cached) return cached;
    if (attachmentFetches.has(key)) return attachmentFetches.get(key);

    const work = (async () => {
      let source;
      try {
        source = await imap.withImap(imapDeps, account, async (client) => {
          const lock = await client.getMailboxLock(row.mailbox, { readOnly: true });
          try {
            if (Number(client.mailbox.uidValidity) !== Number(row.uid_validity)) return null;
            const msg = await client.fetchOne(String(row.uid), { uid: true, source: true }, { uid: true });
            return msg && msg.source ? msg.source : null;
          } finally {
            lock.release();
          }
        });
      } catch (err) {
        throw new HttpError(502, imap.friendlyImapError(err), 'IMAP_ERROR');
      }
      if (!source) throw new HttpError(404, 'This message is no longer on the mail server.', 'MESSAGE_GONE');

      let parsed;
      try {
        parsed = await parseRawMessage(source);
      } catch (_) {
        throw new HttpError(422, 'This message could not be decoded.', 'UNPARSEABLE');
      }
      const list = parsed.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content }));
      attachmentCache.set(
        key,
        list,
        list.reduce((sum, a) => sum + a.content.length, 0)
      );
      return list;
    })();

    attachmentFetches.set(key, work);
    try {
      return await work;
    } finally {
      attachmentFetches.delete(key);
    }
  }

  router.get(
    '/:id/attachments/:index',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const row = loadMessage(userId, req.params.id);
      if (!/^\d{1,4}$/.test(req.params.index)) throw validate.badRequest('Invalid attachment number.', 'INVALID_ID');
      const index = Number(req.params.index);
      // When the body is stored we know the attachment list: skip the download for bad indexes.
      let known = null;
      if (row.body_state === 'ready' && row.attachments_json) {
        try {
          known = JSON.parse(row.attachments_json);
        } catch (_) {
          known = null; // unreadable metadata: let the download decide
        }
      }
      if (Array.isArray(known) && !known.some((a) => a && a.index === index)) {
        throw new HttpError(404, 'Attachment not found', 'NOT_FOUND');
      }
      const account = loadAccount(userId, row.account_id);
      const list = await getAttachments(row, account);
      const att = list[index];
      if (!att) throw new HttpError(404, 'Attachment not found', 'NOT_FOUND');

      const declared = String(att.contentType || '').toLowerCase().split(';')[0].trim();
      const contentType = CONTENT_TYPE_RE.test(declared) ? declared : 'application/octet-stream';
      const inline = INLINE_IMAGE_TYPES.has(contentType);
      const filename = cleanFilename(att.filename, index);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', filename));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      // If a browser ever renders an attachment, it gets no scripts, no plugins, no origin.
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
      res.setHeader('Content-Length', String(att.content.length));
      res.end(att.content);
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const row = loadMessage(userId, req.params.id);
      const body = validate.requireBody(req);
      const changes = {};
      if (body.isRead !== undefined) changes.isRead = validate.requireBoolean(body.isRead, 'isRead');
      if (body.isStarred !== undefined) changes.isStarred = validate.requireBoolean(body.isStarred, 'isStarred');
      if (!Object.keys(changes).length) throw validate.badRequest('Nothing to change: send isRead and/or isStarred.');
      const account = loadAccount(userId, row.account_id);

      const columns = [];
      if ('isRead' in changes) columns.push({ column: 'is_read', next: changes.isRead ? 1 : 0, prev: row.is_read });
      if ('isStarred' in changes) columns.push({ column: 'is_starred', next: changes.isStarred ? 1 : 0, prev: row.is_starred });

      // Local first, so the UI and the counts are right immediately ...
      db.prepare(`UPDATE messages SET ${columns.map((c) => `${c.column} = ?`).join(', ')} WHERE id = ?`).run(
        ...columns.map((c) => c.next),
        row.id
      );
      // ... then on the mail server; undo locally if that fails.
      try {
        await actions.applyFlags(imapDeps, { ...account, mailbox: row.mailbox }, [row.uid], { ...changes, uidValidity: row.uid_validity });
      } catch (err) {
        for (const c of columns) {
          // Only undo our own change (a later request may have set the column again).
          db.prepare(`UPDATE messages SET ${c.column} = ? WHERE id = ? AND ${c.column} = ?`).run(c.prev, row.id, c.next);
        }
        throw new HttpError(502, errorMessage(err, 'The mail server refused the change.'), 'REMOTE_FAILED');
      }

      const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(row.id) || {
        ...row,
        ...Object.fromEntries(columns.map((c) => [c.column, c.next])),
      };
      res.json({ message: queries.toMessageListItem(updated) });
    })
  );

  return router;
};

module.exports.LruCache = LruCache;
module.exports.bodyCsp = bodyCsp;
module.exports.contentDisposition = contentDisposition;
module.exports.encodeRfc5987 = encodeRfc5987;
module.exports.cleanFilename = cleanFilename;
