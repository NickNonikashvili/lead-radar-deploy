'use strict';

/**
 * /api/folders — every folder of the user's accounts: the tree, create / rename / delete on the
 * mail server, "sync now", "load older messages" and emptying Trash / Spam.
 *
 * Folder changes are made on the real mail server first (actions.js), which also keeps the
 * local folders table in step. Special folders (Inbox, Sent, Drafts, Trash, Spam, Archive, Gmail's
 * system folders) can't be renamed or deleted: other mail apps and the provider depend on them.
 */

const express = require('express');
const { HttpError } = require('../errors');
const { requireAuth, asyncHandler } = require('../middleware');
const actions = require('../actions');
const folders = require('../folders');
const imap = require('../imap');
const queries = require('../queries');

const { validate } = queries;

const MAX_FOLDER_NAME = 100;
const MAX_PATH = 1000;
const SYNC_WAIT_MS = 30000;
const BACKFILL_WAIT_MS = 45000;
const DEFAULT_BACKFILL = 100;
const MAX_BACKFILL = 500;
const EMPTYABLE = new Set(['\\Trash', '\\Junk']);
// IMAP LIST wildcards and control characters never belong in a folder name. A leading # or ~
// would address another namespace (shared folders, other users) on many servers.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_NAME_CHARS = /[\u0000-\u001f\u007f-\u009f*%\u2028\u2029]/;
const GMAIL_SYSTEM_PREFIX = /^\[(?:gmail|google ?mail)\]/i;

function scalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

function flagQuery(value) {
  const v = scalar(value);
  return v === '1' || v === 'true';
}

function withTimeout(promise, ms, onTimeout) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(onTimeout()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Copy only the documented fields of a sync result (never anything internal). */
function publicSyncResult(r, folderId) {
  if (!r || typeof r !== 'object') return { folderId, ok: false, error: 'Sync did not report a result.' };
  const out = { folderId, ok: !!r.ok };
  if (r.accountId !== undefined && r.accountId !== null) out.accountId = r.accountId;
  for (const key of ['newMessages', 'removed', 'updated']) if (Number.isFinite(r[key])) out[key] = r[key];
  if (r.pending) out.pending = true;
  if (r.error) out.error = String(r.error);
  return out;
}

/** The hierarchy delimiter an account uses ('/' when nothing is known yet). */
function accountDelimiter(db, accountId) {
  const row = db
    .prepare(
      `SELECT delimiter, COUNT(*) AS n FROM folders WHERE account_id = ? AND delimiter IS NOT NULL AND delimiter != ''
        GROUP BY delimiter ORDER BY n DESC LIMIT 1`
    )
    .get(accountId);
  return row ? row.delimiter : '/';
}

/** A folder name the user typed, checked for this account; else 400 INVALID_FOLDER_NAME. */
function requireFolderName(value, { delimiter, topLevel }) {
  const bad = (message) => validate.badRequest(message, 'INVALID_FOLDER_NAME');
  if (typeof value !== 'string' || !value.trim()) throw bad('Enter a name for the folder.');
  const name = value.trim().normalize('NFC');
  if ([...name].length > MAX_FOLDER_NAME) throw bad(`Folder names can be at most ${MAX_FOLDER_NAME} characters.`);
  if (FORBIDDEN_NAME_CHARS.test(name)) throw bad('Folder names cannot contain * or %, line breaks or other control characters.');
  if (delimiter && name.includes(delimiter)) {
    throw bad(`Folder names cannot contain "${delimiter}" on this account (it separates folders from their subfolders).`);
  }
  if (name === '.' || name === '..' || /^[#~]/.test(name)) throw bad('That folder name is not allowed.');
  if (topLevel && name.toUpperCase() === 'INBOX') throw bad('"Inbox" is already taken by your inbox.');
  return name;
}

module.exports = function foldersRoutes({ db, config, crypto, syncManager }) {
  const router = express.Router();
  router.use(requireAuth);
  const deps = { db, crypto, config };

  function loadFolder(userId, rawId) {
    const id = validate.requireId(rawId, 'folder id');
    const folder = folders.folderForUser(db, userId, id);
    if (!folder) throw new HttpError(404, 'Folder not found', 'NOT_FOUND');
    return folder;
  }

  function accountOf(userId, folder) {
    const account = queries.getAccountRowForUser(db, userId, folder.account_id);
    if (!account) throw new HttpError(404, 'Folder not found', 'NOT_FOUND');
    return account;
  }

  /** The folder and every folder below it (local table). */
  function subtree(folder) {
    return db
      .prepare('SELECT * FROM folders WHERE account_id = ?')
      .all(folder.account_id)
      .filter((row) => row.path === folder.path || (row.delimiter && row.path.startsWith(folder.path + row.delimiter)));
  }

  /**
   * Special folders are refused, and so is a folder holding one (renaming "INBOX.Archive"'s
   * parent or Gmail's "[Gmail]" container would move the special folder with it).
   */
  function assertNotProtected(folder, account, what) {
    const isGmailSystem = imap.isGmail(account) && GMAIL_SYSTEM_PREFIX.test(folder.path);
    const special = folder.path.toUpperCase() === 'INBOX' || !!folder.special_use || isGmailSystem;
    if (special || subtree(folder).some((row) => row.special_use)) {
      throw new HttpError(
        400,
        special ? `This is one of the account's special folders, so it can't be ${what}.` : `This folder contains one of the account's special folders, so it can't be ${what}.`,
        'PROTECTED_FOLDER'
      );
    }
  }

  function folderPathFor(parentPath, delimiter, name) {
    const path = parentPath ? `${parentPath}${delimiter || ''}${name}` : name;
    if (path.length > MAX_PATH) throw validate.badRequest('That folder name is too long.', 'INVALID_FOLDER_NAME');
    return path;
  }

  const findByPath = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?');
  const exists = () => new HttpError(409, 'A folder with that name already exists.', 'FOLDER_EXISTS');

  // --- the tree -------------------------------------------------------------------------

  router.get('/', (req, res) => {
    res.json(queries.listFoldersJson(db, req.user.id));
  });

  // --- create ---------------------------------------------------------------------------

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const body = validate.requireBody(req);
      const accountId = validate.requireId(body.accountId, 'account');
      const account = queries.getAccountRowForUser(db, userId, accountId);
      if (!account) throw new HttpError(404, 'Account not found', 'NOT_FOUND');

      let parent = null;
      if (body.parentId !== undefined && body.parentId !== null && body.parentId !== '') {
        parent = loadFolder(userId, body.parentId);
        if (parent.account_id !== account.id) {
          throw validate.badRequest('A folder can only be created inside a folder of the same account.', 'INVALID_FOLDER');
        }
      }
      const delimiter = (parent && parent.delimiter) || accountDelimiter(db, account.id);
      const name = requireFolderName(body.name, { delimiter, topLevel: !parent });
      const path = folderPathFor(parent ? parent.path : null, delimiter, name);
      if (findByPath.get(account.id, path)) throw exists();
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM folders WHERE account_id = ?').get(account.id);
      if (n >= folders.MAX_FOLDERS_PER_ACCOUNT) {
        throw validate.badRequest(`An account can have at most ${folders.MAX_FOLDERS_PER_ACCOUNT} folders here.`, 'TOO_MANY_FOLDERS');
      }

      const result = await actions.createFolder(deps, account, path);
      if (!result.created) throw exists();
      const row = result.folder || findByPath.get(account.id, result.path);
      if (!row) throw new HttpError(502, 'The folder was created, but the mail server did not list it. Refresh in a moment.', 'REMOTE_FAILED');
      res.status(201).json({ folder: folders.folderJson(row) });
    })
  );

  // --- rename ---------------------------------------------------------------------------

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const folder = loadFolder(userId, req.params.id);
      const account = accountOf(userId, folder);
      const body = validate.requireBody(req);
      assertNotProtected(folder, account, 'renamed');
      const delimiter = folder.delimiter || accountDelimiter(db, account.id);
      const name = requireFolderName(body.name, { delimiter, topLevel: !folder.parent_path });
      const path = folderPathFor(folder.parent_path, delimiter, name);
      if (path === folder.path) return res.json({ folder: folders.folderJson(folder) });
      const clash = findByPath.get(account.id, path);
      // Changing only the letter case is a real rename on case-sensitive servers.
      if (clash && clash.id !== folder.id) throw exists();

      const result = await actions.renameFolder(deps, account, folder.path, path);
      const row = result.folder || folders.getFolder(db, folder.id);
      res.json({ folder: row ? folders.folderJson(row) : null });
    })
  );

  // --- delete ---------------------------------------------------------------------------

  /** Messages in the folder according to the server right now (null when it is gone). */
  async function liveMessageCount(account, folder) {
    try {
      return await imap.withImap(deps, account, async (client) => {
        try {
          // imapflow resolves false when the server refuses STATUS (e.g. the folder is gone).
          const status = await client.status(folder.path, { messages: true });
          return status ? Number(status.messages) || 0 : null;
        } catch (err) {
          if (err && /nonexistent|doesn't exist|does not exist|no such mailbox|not found/i.test(`${err.serverResponseCode || ''} ${err.responseText || ''}`)) {
            return null;
          }
          throw err;
        }
      });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(502, imap.friendlyImapError(err), 'REMOTE_FAILED');
    }
  }

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const folder = loadFolder(userId, req.params.id);
      const account = accountOf(userId, folder);
      assertNotProtected(folder, account, 'deleted');

      if (!flagQuery(req.query.force)) {
        // Deleting a folder deletes its mail and every subfolder on the server: only an empty
        // one goes without asking. Local rows and the last STATUS can be stale, so ask the server.
        const children = subtree(folder).length - 1;
        const { n: local } = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(folder.id);
        let count = Math.max(Number(folder.total_count) || 0, Number(local) || 0);
        if (!children && !count && folder.selectable) count = (await liveMessageCount(account, folder)) || 0;
        if (children || count) {
          const what = [count ? `${count} message${count === 1 ? '' : 's'}` : null, children ? `${children} subfolder${children === 1 ? '' : 's'}` : null]
            .filter(Boolean)
            .join(' and ');
          throw new HttpError(409, `This folder isn't empty (${what}). Deleting it deletes everything in it for good.`, 'FOLDER_NOT_EMPTY');
        }
      }

      const result = await actions.deleteFolder(deps, account, folder.path);
      res.json({ ok: true, deleted: result.deleted.length });
    })
  );

  // --- sync, older mail, empty ----------------------------------------------------------

  function assertSelectable(folder) {
    if (!folder.selectable) throw validate.badRequest('This folder only holds other folders.', 'NOT_SELECTABLE');
  }

  router.post(
    '/:id/sync',
    asyncHandler(async (req, res) => {
      const folder = loadFolder(req.user.id, req.params.id);
      assertSelectable(folder);
      const result = await withTimeout(
        Promise.resolve().then(() => syncManager.syncFolder(folder.id)),
        SYNC_WAIT_MS,
        () => ({ accountId: folder.account_id, ok: false, pending: true })
      );
      const current = folders.getFolder(db, folder.id);
      res.json({ result: publicSyncResult(result, folder.id), folder: current ? folders.folderJson(current) : null });
    })
  );

  router.post(
    '/:id/backfill',
    asyncHandler(async (req, res) => {
      const folder = loadFolder(req.user.id, req.params.id);
      assertSelectable(folder);
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const count = body.count === undefined || body.count === null ? DEFAULT_BACKFILL : validate.requireInt(body.count, { field: 'count', min: 1, max: MAX_BACKFILL });
      const result = await withTimeout(
        Promise.resolve().then(() => syncManager.backfillFolder(folder.id, { count })),
        BACKFILL_WAIT_MS,
        () => ({ added: 0, hasOlder: true, pending: true })
      );
      const out = { added: Number(result && result.added) || 0, hasOlder: !!(result && result.hasOlder) };
      if (result && result.pending) out.pending = true;
      res.json(out);
    })
  );

  router.post(
    '/:id/empty',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const folder = loadFolder(userId, req.params.id);
      const account = accountOf(userId, folder);
      if (!EMPTYABLE.has(folder.special_use)) throw validate.badRequest('Only the Trash and Spam folders can be emptied.', 'NOT_EMPTYABLE');
      const { count } = await actions.emptyFolder(deps, account, folder.path);
      db.transaction(() => {
        db.prepare('DELETE FROM messages WHERE folder_id = ?').run(folder.id);
        db.prepare('UPDATE folders SET total_count = 0, unread_count = 0, has_older = 0 WHERE id = ?').run(folder.id);
      })();
      res.json({ ok: true, count });
    })
  );

  return router;
};

module.exports.requireFolderName = requireFolderName;
