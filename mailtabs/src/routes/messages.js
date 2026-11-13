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
const { randomToken } = require('../crypto');
const imap = require('../imap');
const actions = require('../actions');
const folders = require('../folders');
const { parseRawMessage, renderBodyDocument, escapeHtml } = require('../mailparse');
const queries = require('../queries');
const drafts = require('../drafts');
const uploads = require('../uploads');
const { createLimiter, createKeyedLimiter } = require('../concurrency');

const { validate } = queries;

const MAX_BULK = 500;
const MAX_QUERY = 500;
const BODY_WAIT_MS = 45000;
const LOCAL_UPDATE_BATCH = 500;
const FLAG_ACTIONS = Object.freeze({
  read: { isRead: true },
  unread: { isRead: false },
  star: { isStarred: true },
  unstar: { isStarred: false },
});
// Bulk actions that move messages to another folder, and the special folder each one targets.
const SPECIAL_MOVES = Object.freeze({ archive: 'archive', trash: 'trash', spam: 'junk', notspam: 'inbox' });
const BULK_ACTIONS = [...Object.keys(FLAG_ACTIONS), ...Object.keys(SPECIAL_MOVES), 'delete_forever', 'move'];
// A move that is already where it is going is simply left alone.
// Archiving a message shown from Gmail's All Mail or Starred (mail stored nowhere else, see the
// Starred view) leaves it where it is: moving it out of Starred would only unstar it.
const ALREADY_THERE = Object.freeze({ archive: ['\\Archive', '\\All', '\\Flagged'], spam: ['\\Junk'], notspam: ['\\Inbox'] });
const FOREVER_FOLDERS = new Set(['\\Trash', '\\Junk']);

// Undo of moves: tokens live in memory for 10 minutes, are single use and belong to one user.
const UNDO_TTL_MS = 10 * 60 * 1000;
const MAX_UNDO_PER_USER = 50;
const UNDO_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const UNDO_SYNC_WAIT_MS = 10000;

// Largest message source offered as a download (the IMAP literal cap is a little above this).
const MAX_RAW_BYTES = 60 * 1024 * 1024;
// Whole message sources (an .eml download, a message's attachments) are held in memory while
// they are sent or parsed: each user's downloads take turns, two at a time, and the whole server
// runs at most six at once.
const SOURCE_DOWNLOADS_PER_USER = 2;
const SOURCE_DOWNLOADS_AT_ONCE = 6;

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

/** "<subject>.eml" without characters file systems refuse. */
function emlFilename(subject) {
  const base = String(subject || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 150)
    .trim();
  return `${base || 'message'}.eml`;
}

/** CSP of the printable page: like the body document's, but meant to be opened directly. */
function printCsp(showImages) {
  return (
    `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:${showImages ? ' https: http:' : ''}; ` +
    `font-src data:${showImages ? ' https:' : ''}; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`
  );
}

const PRINT_CSS = [
  '.mt-print-head{margin:0 0 16px;padding:0 0 12px;border-bottom:1px solid #d0d7de}',
  '.mt-print-head h1{font-size:20px;line-height:1.3;margin:0 0 8px;font-weight:600}',
  '.mt-print-head table{border-collapse:collapse;font-size:13px}',
  '.mt-print-head th{text-align:left;font-weight:600;color:#57606a;padding:1px 12px 1px 0;vertical-align:top;white-space:nowrap}',
  '.mt-print-head td{padding:1px 0;overflow-wrap:anywhere}',
  '@media print{body{padding:0}}',
].join('');

function formatAddressList(list) {
  return (Array.isArray(list) ? list : [])
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .filter(Boolean)
    .join(', ');
}

const PRINT_DATE_FORMAT = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };

/** A date for the printed header, in the reader's time zone when it is a valid one (else UTC). */
function printDate(ms, timeZone) {
  const date = new Date(Number(ms));
  if (!Number.isFinite(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { ...PRINT_DATE_FORMAT, timeZone: timeZone || 'UTC' }).format(date);
  } catch (_) {
    return new Intl.DateTimeFormat('en-US', { ...PRINT_DATE_FORMAT, timeZone: 'UTC' }).format(date);
  }
}

/** The header block of the printable page (every value escaped). */
function printHeaderHtml(detail, { timeZone } = {}) {
  const rows = [
    ['From', detail.fromName ? `${detail.fromName} <${detail.fromAddress || ''}>` : detail.fromAddress || ''],
    ['To', formatAddressList(detail.to)],
    ['Cc', formatAddressList(detail.cc)],
    ['Date', printDate(detail.date, timeZone)],
    ['Attachments', detail.attachments.filter((a) => !a.inline).map((a) => a.filename).join(', ')],
  ].filter(([, value]) => value);
  return (
    `<header class="mt-print-head"><h1>${escapeHtml(detail.subject || '(no subject)')}</h1><table>` +
    rows.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${escapeHtml(value)}</td></tr>`).join('') +
    `</table></header><style>${PRINT_CSS}</style>`
  );
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

/** Group message rows by account, then by (folder, uidValidity) — one remote call per group. */
function groupForRemote(rows) {
  const byAccount = new Map();
  for (const row of rows) {
    if (!byAccount.has(row.account_id)) byAccount.set(row.account_id, new Map());
    const groups = byAccount.get(row.account_id);
    const key = `${row.folder_id ?? ''}\u0000${row.mailbox}\u0000${row.uid_validity}`;
    if (!groups.has(key)) groups.set(key, { folderId: row.folder_id ?? null, mailbox: row.mailbox, uidValidity: row.uid_validity, rows: [] });
    groups.get(key).rows.push(row);
  }
  return byAccount;
}

function sqlList(n) {
  return new Array(n).fill('?').join(', ');
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

module.exports = function messagesRoutes({ db, config, crypto, syncManager, logger = console }) {
  const router = express.Router();
  router.use(requireAuth);
  const imapDeps = { db, crypto, config };
  const perUserDownloads = createKeyedLimiter(SOURCE_DOWNLOADS_PER_USER);
  const allDownloads = createLimiter(SOURCE_DOWNLOADS_AT_ONCE);
  const sourceDownloads = (userId, fn) => perUserDownloads(userId, () => allDownloads(fn));

  const attachmentCache = new LruCache({ maxEntries: 20, maxBytes: 50 * 1024 * 1024 });
  const attachmentFetches = new Map(); // cache key -> Promise (concurrent requests share one download)
  const undoTokens = new Map(); // token -> { userId, moves, expiresAt }

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

  /**
   * The list source of a request (query string or body): exactly one of tab, folder or view.
   * Returns options for queries.listMessages / resolveSource (already validated for the user).
   */
  function readSource(userId, input) {
    const scalar = (v) => (Array.isArray(v) ? v[0] : v);
    const given = (v) => v !== undefined && v !== null && v !== '';
    const tab = scalar(input.tab);
    const folder = scalar(input.folder);
    const view = scalar(input.view);
    const count = [given(tab) && tab !== 'all', given(folder), given(view)].filter(Boolean).length;
    if (count > 1 || (given(tab) && (given(folder) || given(view)))) {
      throw validate.badRequest('Use only one of tab, folder or view.', 'INVALID_SOURCE');
    }
    if (given(folder)) {
      const folderId = validate.requireId(folder, 'folder');
      queries.resolveFolder(db, userId, folderId); // 404 when not the user's
      return { folderId };
    }
    if (given(view)) {
      if (typeof view !== 'string' || !queries.VIEWS.includes(view)) {
        throw validate.badRequest(`view must be one of: ${queries.VIEWS.join(', ')}.`, 'INVALID_VIEW');
      }
      return { view };
    }
    return { tabId: readTabParam(userId, tab) };
  }

  function readAccountFilter(userId, value) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v === undefined || v === null || v === '') return undefined;
    const accountId = validate.requireId(v, 'account');
    if (!queries.getAccountRowForUser(db, userId, accountId)) throw new HttpError(404, 'Account not found', 'NOT_FOUND');
    return accountId;
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

  /** Ask the sync engine to pick up a folder change in the background (never throws). */
  function syncFolderSoon(folderId) {
    if (!folderId || typeof syncManager.syncFolder !== 'function') return Promise.resolve(null);
    return Promise.resolve()
      .then(() => syncManager.syncFolder(folderId, { markOpened: false }))
      .catch((err) => {
        console.error(`[messages] background sync of folder ${folderId} failed:`, (err && err.message) || err);
        return null;
      });
  }

  // --- list -------------------------------------------------------------------------------

  router.get('/', (req, res) => {
    const userId = req.user.id;
    const q = req.query;
    const scalar = (v) => (Array.isArray(v) ? v[0] : v);
    const source = readSource(userId, q);
    const accountId = readAccountFilter(userId, q.account);
    const search = typeof scalar(q.q) === 'string' ? scalar(q.q).slice(0, MAX_QUERY) : undefined;
    const limit = scalar(q.limit) === undefined || scalar(q.limit) === '' ? undefined : Number(scalar(q.limit));
    if (limit !== undefined && !Number.isFinite(limit)) throw validate.badRequest('limit must be a number.');

    res.json(
      queries.listMessages(db, userId, {
        ...source,
        accountId,
        q: search,
        unread: flagQuery(scalar(q.unread)),
        starred: flagQuery(scalar(q.starred)),
        before: typeof scalar(q.before) === 'string' ? scalar(q.before) : undefined,
        limit,
      })
    );
  });

  // --- bulk + undo + mark-all-read (before /:id so these paths never parse as ids) ------

  function folderOfGroup(accountId, group) {
    const row = group.folderId ? folders.getFolder(db, group.folderId) : null;
    if (row && row.account_id === accountId) return row;
    return db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(accountId, group.mailbox) || null;
  }

  function deleteLocalRows(ids) {
    let n = 0;
    for (const batch of chunk(ids, LOCAL_UPDATE_BATCH)) {
      n += db.prepare(`DELETE FROM messages WHERE id IN (${sqlList(batch.length)})`).run(...batch).changes;
    }
    return n;
  }

  /** Read/unread/star/unstar on the server, then locally. */
  async function applyFlagGroup(account, group, action) {
    const flags = FLAG_ACTIONS[action];
    const uids = group.rows.map((r) => r.uid);
    const ids = group.rows.map((r) => r.id);
    await actions.applyFlags(imapDeps, account, group.mailbox, uids, { ...flags, uidValidity: group.uidValidity });
    const [column, value] = 'isRead' in flags ? ['is_read', flags.isRead ? 1 : 0] : ['is_starred', flags.isStarred ? 1 : 0];
    let count = 0;
    for (const batch of chunk(ids, LOCAL_UPDATE_BATCH)) {
      count += db
        .prepare(`UPDATE messages SET ${column} = ?, flags_changed_at = ? WHERE ${column} != ? AND id IN (${sqlList(batch.length)})`)
        .run(value, Date.now(), value, ...batch).changes;
    }
    return { count };
  }

  /**
   * archive / trash / spam / notspam / move one group on the server. The local rows leave the
   * source folder at once; the destination folder picks the messages up on its next sync
   * (started here in the background). Returns { count, undo } — undo is null when the server
   * reported no new UIDs (no UIDPLUS) or deleted instead of moving.
   */
  async function applyMoveGroup(account, group, action, destination) {
    const source = folderOfGroup(account.id, group);
    const uids = group.rows.map((r) => r.uid);
    const ids = group.rows.map((r) => r.id);
    const sourceUse = source ? source.special_use : group.mailbox.toUpperCase() === 'INBOX' ? '\\Inbox' : null;
    if (action === 'move' ? destination.path === group.mailbox : (ALREADY_THERE[action] || []).includes(sourceUse)) {
      return { count: 0, undo: null };
    }
    const result =
      action === 'move'
        ? await actions.moveMessages(imapDeps, account, group.mailbox, uids, destination.path, { uidValidity: group.uidValidity })
        : await actions.moveToSpecial(imapDeps, account, group.mailbox, uids, SPECIAL_MOVES[action], { uidValidity: group.uidValidity });
    const dest =
      result.destination && !result.deleted
        ? action === 'move'
          ? destination
          : db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(account.id, result.destination)
        : null;
    // An open composer may still refer to these rows (a forward's attachments): remember where
    // the messages went before their rows go.
    try {
      drafts.recordMoves(db, account.id, group.rows, { folderId: dest ? dest.id : null, uidMap: result.uidMap, uidValidity: result.uidValidity ?? null });
    } catch (err) {
      logger.warn(`[messages] could not record where moved messages went: ${err && err.message}`);
    }
    const count = deleteLocalRows(ids);
    if (result.deleted || !result.destination) return { count, undo: null };

    // Views that are only synced while open (Gmail's All Mail) pick the messages up when opened.
    if (dest && dest.sync_mode !== 'on_demand') syncFolderSoon(dest.id);
    const uidMap = {};
    for (const uid of uids) {
      const to = result.uidMap && result.uidMap[uid];
      if (Number.isSafeInteger(Number(to)) && Number(to) > 0) uidMap[uid] = Number(to);
    }
    if (!Object.keys(uidMap).length) return { count, undo: null };
    return {
      count,
      undo: {
        accountId: account.id,
        fromFolderId: source ? source.id : null,
        fromPath: group.mailbox,
        toFolderId: dest ? dest.id : null,
        toPath: result.destination,
        uidMap,
        uidValidity: result.uidValidity ?? null,
      },
    };
  }

  /** Delete forever — only from Trash or Spam (everywhere else "Delete" moves to the Trash). */
  async function applyDeleteForeverGroup(account, group) {
    const source = folderOfGroup(account.id, group);
    if (!source || !FOREVER_FOLDERS.has(source.special_use)) {
      throw validate.badRequest('Only messages in Trash or Spam can be deleted forever.', 'NOT_IN_TRASH');
    }
    await actions.deleteForever(imapDeps, account, group.mailbox, group.rows.map((r) => r.uid), { uidValidity: group.uidValidity });
    return { count: deleteLocalRows(group.rows.map((r) => r.id)) };
  }

  /**
   * Apply one bulk action to every group (accounts in parallel, groups of one account in turn).
   * @returns {{ count, failed: Array<{accountId, error}>, moves: object[] }}
   */
  async function applyToGroups(userId, rows, action, { destination } = {}) {
    const failed = [];
    const moves = [];
    let count = 0;
    const byAccount = groupForRemote(rows);
    await Promise.all(
      [...byAccount].map(async ([accountId, groups]) => {
        const account = queries.getAccountRowForUser(db, userId, accountId);
        if (!account) return; // removed meanwhile; its messages are gone too
        if (action === 'move' && destination.account_id !== account.id) {
          failed.push({ accountId, error: 'Messages can only be moved to folders of their own account.' });
          return;
        }
        for (const group of groups.values()) {
          try {
            let result;
            if (FLAG_ACTIONS[action]) result = await applyFlagGroup(account, group, action);
            else if (action === 'delete_forever') result = await applyDeleteForeverGroup(account, group);
            else result = await applyMoveGroup(account, group, action, destination);
            count += result.count;
            if (result.undo) moves.push(result.undo);
          } catch (err) {
            failed.push({ accountId, error: errorMessage(err, 'The mail server refused the change.') });
          }
        }
      })
    );
    return { count, failed, moves };
  }

  function issueUndoToken(userId, moves) {
    const now = Date.now();
    for (const [token, entry] of undoTokens) if (entry.expiresAt <= now) undoTokens.delete(token);
    const mine = [...undoTokens].filter(([, entry]) => entry.userId === userId);
    for (const [token] of mine.slice(0, Math.max(0, mine.length - MAX_UNDO_PER_USER + 1))) undoTokens.delete(token);
    const token = randomToken(24);
    undoTokens.set(token, { userId, moves, expiresAt: now + UNDO_TTL_MS });
    return token;
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
      let destination;
      if (body.action === 'move') {
        destination = folders.folderForUser(db, userId, validate.requireId(body.folderId, 'folder'));
        // Exchange's hidden non-mail folders don't exist as far as the app is concerned.
        if (!destination || folders.isHiddenFolder(destination)) throw new HttpError(404, 'Folder not found', 'NOT_FOUND');
        if (!destination.selectable) throw validate.badRequest('Messages cannot be moved into this folder.', 'NOT_SELECTABLE');
      }
      // Ids that are not the user's simply match nothing.
      const rows = queries.getMessagesForUser(db, userId, ids);
      const { count, failed, moves } = await applyToGroups(userId, rows, body.action, { destination });
      if (FLAG_ACTIONS[body.action]) return res.json({ ok: true, count, failed });
      res.json({ ok: true, count, failed, undo: moves.length ? issueUndoToken(userId, moves) : null });
    })
  );

  /** A folder's current path (it may have been renamed since), else the remembered one. */
  function currentPath(accountId, folderId, fallback) {
    const row = folderId ? folders.getFolder(db, folderId) : null;
    return row && row.account_id === accountId ? row.path : fallback;
  }

  router.post(
    '/undo',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const body = validate.requireBody(req);
      if (typeof body.token !== 'string' || !UNDO_TOKEN_RE.test(body.token)) throw validate.badRequest('Invalid undo token.', 'INVALID_TOKEN');
      const entry = undoTokens.get(body.token);
      // Someone else's token reads exactly like an expired one.
      if (!entry || entry.userId !== userId || entry.expiresAt <= Date.now()) {
        throw new HttpError(404, 'This can no longer be undone.', 'UNDO_EXPIRED');
      }
      undoTokens.delete(body.token); // single use, even if moving back fails
      const moves = entry.moves.filter((m) => m.uidMap && Object.keys(m.uidMap).length);
      if (!moves.length) throw new HttpError(409, "This change can't be undone on this mail server.", 'CANT_UNDO');

      let count = 0;
      const failed = [];
      const resync = [];
      for (const move of moves) {
        const account = queries.getAccountRowForUser(db, userId, move.accountId);
        if (!account) continue;
        const fromPath = currentPath(account.id, move.fromFolderId, move.fromPath);
        const toPath = currentPath(account.id, move.toFolderId, move.toPath);
        const uids = Object.values(move.uidMap).map(Number);
        try {
          await actions.moveMessages(imapDeps, account, toPath, uids, fromPath, { uidValidity: move.uidValidity ?? undefined });
          count += uids.length;
          // The copies the destination's sync may already have stored are gone from there now.
          for (const batch of chunk(uids, LOCAL_UPDATE_BATCH)) {
            db.prepare(`DELETE FROM messages WHERE account_id = ? AND mailbox = ? AND uid IN (${sqlList(batch.length)})`).run(account.id, toPath, ...batch);
          }
          resync.push(move);
        } catch (err) {
          failed.push({ accountId: account.id, error: errorMessage(err, 'The mail server refused to move the messages back.') });
        }
      }
      if (!count && failed.length) throw new HttpError(502, failed[0].error, 'REMOTE_FAILED');

      // The messages are back on the server; wait (briefly) until they are listed here again.
      const sourceSyncs = [];
      for (const move of resync) {
        const fromId = move.fromFolderId || (db.prepare('SELECT id FROM folders WHERE account_id = ? AND path = ?').get(move.accountId, move.fromPath) || {}).id;
        if (fromId) sourceSyncs.push(syncFolderSoon(fromId));
        if (move.toFolderId) syncFolderSoon(move.toFolderId);
      }
      await withTimeout(Promise.all(sourceSyncs), UNDO_SYNC_WAIT_MS, () => null);
      res.json({ ok: true, count, failed });
    })
  );

  router.post(
    '/mark-all-read',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const body = validate.requireBody(req);
      // Same narrowing as the list the user is looking at: a search or the Starred filter
      // must only mark what is shown, not the whole tab / folder / view.
      const source = queries.resolveSource(db, userId, readSource(userId, body));
      const accountId = readAccountFilter(userId, body.account);
      const search = typeof body.q === 'string' ? body.q.slice(0, MAX_QUERY) : undefined;
      const starred = body.starred === true || body.starred === 1 || body.starred === '1' || body.starred === 'true';
      const refs = queries.selectTabMessageRefs(db, userId, source, { unread: true, q: search, starred: starred || undefined, accountId });
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
    '/:id/thread',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const row = loadMessage(userId, req.params.id);
      res.json({ messages: queries.threadMessages(db, userId, row).map(queries.toThreadMessageJson) });
    })
  );

  router.get(
    '/:id/raw',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const row = loadMessage(userId, req.params.id);
      const account = loadAccount(userId, row.account_id);
      if (Number(row.size) > MAX_RAW_BYTES) {
        throw new HttpError(413, 'This message is too large to download here. Open it in your provider\'s web mail instead.', 'TOO_LARGE');
      }
      const source = await sourceDownloads(userId, () => fetchSource(row, account, { maxLiteralSize: MAX_RAW_BYTES }));
      res.setHeader('Content-Type', 'message/rfc822');
      res.setHeader('Content-Disposition', contentDisposition('attachment', emlFilename(row.subject)));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Content-Length', String(source.length));
      res.end(source);
    })
  );

  router.get(
    '/:id/print',
    asyncHandler(async (req, res) => {
      const showImages = flagQuery(req.query.images);
      res.setHeader('Content-Security-Policy', printCsp(showImages));
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.type('html');
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
      const doc = bodyError
        ? renderBodyDocument({ text: `${bodyError}\n\n${current.snippet || ''}`.trim(), subject: current.subject })
        : renderBodyDocument({ html: current.html_body, text: current.text_body, subject: current.subject }, { showImages });
      const timeZone = typeof req.query.tz === 'string' && req.query.tz.length <= 64 ? req.query.tz : undefined;
      const header = printHeaderHtml(queries.toMessageDetail(current), { timeZone });
      // renderBodyDocument's root element is fixed; the header goes first inside it.
      res.send(doc.replace('<div id="mt-root">', () => `<div id="mt-root">${header}`));
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

  /** The raw RFC 822 source of a stored message, from the mail server. */
  async function fetchSource(row, account, limits) {
    let source;
    try {
      source = await imap.withImap(
        imapDeps,
        account,
        async (client) => {
          const lock = await client.getMailboxLock(row.mailbox, { readOnly: true });
          try {
            if (Number(client.mailbox.uidValidity) !== Number(row.uid_validity)) return null;
            const msg = await client.fetchOne(String(row.uid), { uid: true, source: true }, { uid: true });
            return msg && msg.source ? msg.source : null;
          } finally {
            lock.release();
          }
        },
        limits
      );
    } catch (err) {
      throw new HttpError(502, imap.friendlyImapError(err), 'IMAP_ERROR');
    }
    if (!source) throw new HttpError(404, 'This message is no longer on the mail server.', 'MESSAGE_GONE');
    return source;
  }

  /** Parsed attachments [{filename, contentType, content}] of a message, from cache or IMAP. */
  async function getAttachments(row, account) {
    // created_at is part of the key: SQLite can reuse the id of a deleted row.
    const key = `${row.id}:${row.account_id}:${row.mailbox}:${row.uid_validity}:${row.uid}:${row.created_at}`;
    const cached = attachmentCache.get(key);
    if (cached) return cached;
    if (attachmentFetches.has(key)) return attachmentFetches.get(key);

    const work = (async () => {
      const source = await sourceDownloads(account.user_id, () => fetchSource(row, account));
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
      let row;
      try {
        row = loadMessage(userId, req.params.id);
      } catch (err) {
        // A reopened draft that a later save replaced: the composer still shows its pictures
        // (and sends its files) from the parts kept back then.
        const carried =
          err instanceof HttpError && err.status === 404 && /^\d{1,15}$/.test(req.params.id) && /^\d{1,4}$/.test(req.params.index)
            ? drafts.carriedUpload(db, userId, Number(req.params.id), Number(req.params.index))
            : null;
        if (!carried) throw err;
        let content;
        try {
          content = uploads.readUpload(carried);
        } catch (_) {
          throw new HttpError(404, 'Attachment not found', 'NOT_FOUND');
        }
        return sendAttachment(res, { filename: carried.filename, contentType: carried.content_type, content }, Number(req.params.index));
      }
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
      sendAttachment(res, att, index);
    })
  );

  function sendAttachment(res, att, index) {
    const declared = String(att.contentType || '').toLowerCase().split(';')[0].trim();
    const inline = INLINE_IMAGE_TYPES.has(declared);
    // Only the safe inline image types keep the sender's type. Everything else is a plain
    // download: a same-origin response typed text/html or application/javascript is a gadget
    // for script injection, whatever Content-Disposition says.
    const contentType = inline && CONTENT_TYPE_RE.test(declared) ? declared : 'application/octet-stream';
    const filename = cleanFilename(att.filename, index);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', filename));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    // If a browser ever renders an attachment, it gets no scripts, no plugins, no origin.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Content-Length', String(att.content.length));
    res.end(att.content);
  }

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
      // (flags_changed_at keeps a sync that read the server's flags a moment ago from undoing it.)
      db.prepare(`UPDATE messages SET ${columns.map((c) => `${c.column} = ?`).join(', ')}, flags_changed_at = ? WHERE id = ?`).run(
        ...columns.map((c) => c.next),
        Date.now(),
        row.id
      );
      // ... then on the mail server; undo locally if that fails.
      try {
        await actions.applyFlags(imapDeps, account, row.mailbox, [row.uid], { ...changes, uidValidity: row.uid_validity });
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
module.exports.emlFilename = emlFilename;
module.exports.printCsp = printCsp;
