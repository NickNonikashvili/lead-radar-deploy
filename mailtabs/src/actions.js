'use strict';

/**
 * Remote write-back: changes the user makes in Mailtabs (read/unread, star, move, archive,
 * delete, spam, folders, saved messages) are applied on the real mail server so every other
 * mail app sees them too.
 *
 * Message operations take the folder the messages are in (`folderPath`, = messages.mailbox) and
 * optionally the UIDVALIDITY the caller's UIDs belong to: when it no longer matches, nothing is
 * changed (the UIDs could now point at different messages).
 *
 * Failures are thrown as HttpError: 409 'UIDVALIDITY_CHANGED', 400 'NO_ARCHIVE' / 'NO_JUNK' /
 * 'INVALID_TARGET' / 'INVALID_FOLDER' / 'PROTECTED_FOLDER' / 'NOT_EMPTYABLE', 409 'FOLDER_EXISTS',
 * 404 'FOLDER_NOT_FOUND', and 502 'REMOTE_FAILED' (with a friendly message) for anything the
 * server or the network refused.
 *
 * Gmail (labels as folders): archive = MOVE to All Mail (or, when All Mail is hidden from IMAP,
 * remove the \Inbox label); trash = MOVE to [Gmail]/Trash; deleting for good outside Trash/Spam
 * = MOVE to Trash, then delete there (an EXPUNGE in INBOX or a label only removes that label).
 * Folder names are never trusted there: a label called "Archive" is just a label.
 *
 * Message operations only change the server; the routes update the local rows. Folder
 * operations (create/rename/delete) also update the `folders` table when deps.db is given,
 * because the local folder tree has to follow the server exactly (a rename keeps the folder's
 * id, sync state and messages).
 */

const imap = require('./imap');
const folders = require('./folders');
const { HttpError } = require('./errors');

const UID_BATCH = 500; // keeps IMAP command lines short
const MAX_PATH_LENGTH = 1000;

const SPECIAL_TARGETS = ['archive', 'trash', 'junk', 'inbox'];
const ARCHIVE_NAMES = ['archive'];
const TRASH_NAMES = ['trash', 'deleted items', 'deleted messages', 'deleted', 'bin'];
const JUNK_NAMES = ['junk', 'spam', 'junk e-mail', 'junk email', 'bulk mail'];
const GMAIL_HIDDEN = (folder) =>
  `Gmail's ${folder} folder is hidden from mail apps, so this can't be done here. In Gmail's settings (Labels), turn on "Show in IMAP" for ${folder}.`;

// System flags plus RFC 3501 keyword atoms; anything else could break the APPEND command line.
const FLAG_RE = /^(?:\\(?:Seen|Answered|Flagged|Deleted|Draft)|\$?[A-Za-z0-9_.-]{1,64})$/;

function normalizeUids(uids) {
  return [...new Set((Array.isArray(uids) ? uids : [uids]).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort(
    (a, b) => a - b
  );
}

function batches(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function remoteFailed(what) {
  return new HttpError(502, `The mail server refused to ${what}. Try again in a moment.`, 'REMOTE_FAILED');
}

function invalidFolder() {
  return new HttpError(400, 'Invalid folder.', 'INVALID_FOLDER');
}

/** A mailbox path as stored/listed: non-empty text without control characters. */
function requirePath(path) {
  // eslint-disable-next-line no-control-regex
  if (typeof path !== 'string' || !path || path.length > MAX_PATH_LENGTH || /[\u0000-\u001f\u007f]/.test(path)) throw invalidFolder();
  return path;
}

const isInboxPath = (path) => String(path).toUpperCase() === 'INBOX';

// One write-back connection per account at a time. Fast triage (j/k with the reader open,
// several archives in a row) would otherwise open a burst of parallel logins, and providers
// cap those (Gmail allows ~15 connections per account across all of the user's apps).
const accountQueues = new Map(); // accountId -> tail promise

function serializePerAccount(accountId, task) {
  const key = Number(accountId);
  const prev = accountQueues.get(key) || Promise.resolve();
  const run = prev.then(task, task);
  const tail = run.catch(() => {});
  accountQueues.set(key, tail);
  tail.then(() => {
    if (accountQueues.get(key) === tail) accountQueues.delete(key);
  });
  return run;
}

/** Run fn(client) on a connection of the account (serialised), mapping failures to HttpError. */
function withAccount(deps, accountRow, fn) {
  return serializePerAccount(accountRow.id, async () => {
    try {
      return await imap.withImap(deps, accountRow, fn);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      const wrapped = new HttpError(502, imap.friendlyImapError(err), 'REMOTE_FAILED');
      wrapped.cause = err;
      throw wrapped;
    }
  });
}

/**
 * On an open connection: select `path` read-write and run fn(client). When `uidValidity` is
 * given and no longer matches, nothing is changed.
 */
async function inWritableMailbox(client, path, uidValidity, fn) {
  const lock = await client.getMailboxLock(path);
  try {
    if (uidValidity !== undefined && uidValidity !== null && Number(client.mailbox.uidValidity) !== Number(uidValidity)) {
      throw new HttpError(409, 'This folder changed on the mail server. Refresh and try again.', 'UIDVALIDITY_CHANGED');
    }
    if (client.mailbox.readOnly) {
      throw new HttpError(502, 'The mail server only allows reading this folder, so changes cannot be saved.', 'REMOTE_FAILED');
    }
    return await fn(client);
  } finally {
    lock.release();
  }
}

/** Open one of the account's folders read-write and run fn(client) (see inWritableMailbox). */
function withWritableMailbox(deps, accountRow, folderPath, uidValidity, fn) {
  const path = requirePath(folderPath);
  return withAccount(deps, accountRow, (client) => inWritableMailbox(client, path, uidValidity, fn));
}

/** imapflow's Map of source UID -> destination UID as a plain { [oldUid]: newUid } object. */
function uidMapObject(map) {
  const out = {};
  if (map instanceof Map) {
    for (const [from, to] of map) {
      const a = Number(from);
      const b = Number(to);
      if (Number.isSafeInteger(a) && a > 0 && Number.isSafeInteger(b) && b > 0) out[a] = b;
    }
  }
  return out;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === false) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------------------------

/**
 * Set or clear \Seen / \Flagged / \Answered on messages of one folder.
 * @param {string} folderPath
 * @param {number[]} uids
 * @param {{isRead?: boolean, isStarred?: boolean, isAnswered?: boolean, uidValidity?: number}} changes
 */
async function applyFlags(deps, accountRow, folderPath, uids, { isRead, isStarred, isAnswered, uidValidity } = {}) {
  const list = normalizeUids(uids);
  const add = [];
  const remove = [];
  for (const [value, flag] of [
    [isRead, '\\Seen'],
    [isStarred, '\\Flagged'],
    [isAnswered, '\\Answered'],
  ]) {
    if (value === true) add.push(flag);
    else if (value === false) remove.push(flag);
  }
  if (!list.length || (!add.length && !remove.length)) return;

  await withWritableMailbox(deps, accountRow, folderPath, uidValidity, async (client) => {
    for (const batch of batches(list, UID_BATCH)) {
      const range = imap.toUidSet(batch);
      if (add.length && !(await client.messageFlagsAdd(range, add, { uid: true }))) throw remoteFailed('update the message');
      if (remove.length && !(await client.messageFlagsRemove(range, remove, { uid: true }))) throw remoteFailed('update the message');
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Special folders
// ---------------------------------------------------------------------------------------------

/** Folders whose path (top level first) or last segment is one of `names`. */
function byName(list, names) {
  const wanted = names.map((n) => n.toLowerCase());
  const exact = list.filter((box) => wanted.includes(String(box.path).toLowerCase()));
  const named = list.filter((box) => wanted.includes(String(box.name).toLowerCase()) && !exact.includes(box));
  return [...exact, ...named].map((box) => box.path);
}

/**
 * Where `target` messages go on this server, best first (may include the source folder).
 * Gmail: only the folders Gmail itself flags (never a label that is merely named "Archive").
 */
function specialCandidates(list, target, { gmail = false } = {}) {
  const boxes = (list || []).filter(
    (box) => box && box.path && box.selectable !== false && !(box.flags && [...box.flags].some((f) => /^\\(noselect|nonexistent)$/i.test(String(f))))
  );
  const out = [];
  const add = (path) => {
    if (path && !out.includes(path)) out.push(path);
  };
  switch (target) {
    case 'archive':
      add(imap.pickSpecialMailbox(boxes, '\\Archive'));
      // Gmail: moving out of INBOX into All Mail is exactly what "Archive" does there.
      add(imap.pickSpecialMailbox(boxes, '\\All'));
      if (!gmail) byName(boxes, ARCHIVE_NAMES).forEach(add);
      break;
    case 'trash':
      add(imap.pickSpecialMailbox(boxes, '\\Trash'));
      if (!gmail) byName(boxes, TRASH_NAMES).forEach(add);
      break;
    case 'junk':
      add(imap.pickSpecialMailbox(boxes, '\\Junk'));
      if (!gmail) byName(boxes, JUNK_NAMES).forEach(add);
      break;
    case 'inbox':
      add('INBOX');
      break;
    default:
      break;
  }
  return out;
}

/**
 * Where 'archive' / 'trash' / 'junk' / 'inbox' go on this server, or null. Never the folder the
 * messages are already in (archive: none; trash: delete in place; junk: none).
 */
function resolveTarget(list, target, sourcePath, options) {
  const source = String(sourcePath).toLowerCase();
  return specialCandidates(list, target, options).find((path) => path.toLowerCase() !== source) || null;
}

/** The account's folders from the local table, shaped like LIST entries (null when none). */
function listFromTable(db, accountId) {
  if (!db) return null;
  const rows = db.prepare('SELECT path, name, special_use, selectable, sync_mode FROM folders WHERE account_id = ?').all(accountId);
  if (!rows.length) return null;
  return rows.map((r) => ({
    path: r.path,
    name: r.name,
    // Exchange's calendar/contacts/… folders are never where messages go.
    selectable: !!r.selectable && !folders.isHiddenFolder(r),
    specialUse: r.special_use || undefined,
    specialUseSource: r.special_use ? 'extension' : undefined,
    flags: new Set(r.special_use ? [r.special_use] : []),
  }));
}

/**
 * Move messages of one folder to the account's Archive / Trash / Junk folder or back to INBOX.
 * The destination comes from the folders table first, a LIST only when the table has none.
 * Trash falls back to deleting (\Deleted + EXPUNGE) when the server has no trash folder, and
 * trashing inside the Trash deletes for good (like every mail app). On Gmail, archiving without
 * a visible All Mail removes the \Inbox label instead, and a hidden Trash is an error (an
 * EXPUNGE elsewhere would only remove a label).
 * @returns {Promise<{destination: string|null, uidMap: object, uidValidity: number|null, deleted: boolean}>}
 */
async function moveToSpecial(deps, accountRow, folderPath, uids, target, { uidValidity } = {}) {
  if (!SPECIAL_TARGETS.includes(target)) {
    throw new HttpError(400, 'Messages can only be moved to the archive, the trash, spam or the inbox.', 'INVALID_TARGET');
  }
  const source = requirePath(folderPath);
  const list = normalizeUids(uids);
  if (!list.length) return { destination: null, uidMap: {}, uidValidity: null, deleted: false };

  return withWritableMailbox(deps, accountRow, source, uidValidity, async (client) => {
    const gmail = imap.isGmail(accountRow, client);
    const table = listFromTable(deps && deps.db, accountRow.id);
    let destination = table ? resolveTarget(table, target, source, { gmail }) : null;
    let candidates = table ? specialCandidates(table, target, { gmail }) : [];
    if (!destination) {
      const boxes = await client.list();
      destination = resolveTarget(boxes, target, source, { gmail });
      candidates = candidates.concat(specialCandidates(boxes, target, { gmail }));
    }
    if (!destination) {
      const alreadyThere = candidates.some((path) => path.toLowerCase() === source.toLowerCase());
      if (target === 'trash') {
        if (gmail && !alreadyThere) throw new HttpError(400, GMAIL_HIDDEN('Trash'), 'NO_TRASH');
        await deleteRanges(client, list);
        return { destination: null, uidMap: {}, uidValidity: null, deleted: true };
      }
      if (alreadyThere) throw new HttpError(400, 'These messages are already in that folder.', 'INVALID_TARGET');
      if (target === 'archive' && gmail && isInboxPath(source)) {
        await removeInboxLabel(client, list);
        return { destination: null, uidMap: {}, uidValidity: null, deleted: false };
      }
      if (target === 'archive') throw new HttpError(400, gmail ? GMAIL_HIDDEN('All Mail') : 'This account has no Archive folder', 'NO_ARCHIVE');
      throw new HttpError(400, gmail ? GMAIL_HIDDEN('Spam') : 'This account has no Spam folder', 'NO_JUNK');
    }
    const moved = await moveRanges(client, list, destination, target);
    return { ...moved, deleted: false };
  });
}

/** Gmail archive without All Mail: UID STORE -X-GM-LABELS (\Inbox) — the message leaves INBOX only. */
async function removeInboxLabel(client, uids) {
  for (const batch of batches(uids, UID_BATCH)) {
    const ok = await client.messageFlagsRemove(imap.toUidSet(batch), ['\\Inbox'], { uid: true, useLabels: true });
    if (!ok) throw remoteFailed('archive the message');
  }
}

async function moveRanges(client, uids, destination, what) {
  const uidMap = {};
  let destUidValidity = null;
  for (const batch of batches(uids, UID_BATCH)) {
    const result = await client.messageMove(imap.toUidSet(batch), destination, { uid: true });
    if (!result) {
      const verb = { archive: 'archive the message', trash: 'move the message to the trash', junk: 'move the message to spam' }[what] || 'move the message';
      throw remoteFailed(verb);
    }
    Object.assign(uidMap, uidMapObject(result.uidMap));
    destUidValidity = numberOrNull(result.uidValidity) ?? destUidValidity;
  }
  return { destination, uidMap, uidValidity: destUidValidity };
}

async function deleteRanges(client, uids) {
  for (const batch of batches(uids, UID_BATCH)) {
    if (!(await client.messageDelete(imap.toUidSet(batch), { uid: true }))) throw remoteFailed('delete the message');
  }
}

// ---------------------------------------------------------------------------------------------
// Moving and deleting messages
// ---------------------------------------------------------------------------------------------

/**
 * Move messages of one folder into another folder of the same account (MOVE, or COPY + delete
 * on servers without MOVE). uidMap comes from COPYUID (UIDPLUS); {} when the server sent none.
 * @returns {Promise<{destination: string, uidMap: object, uidValidity: number|null}>}
 *   uidValidity is the destination's, when the server reported it.
 */
async function moveMessages(deps, accountRow, folderPath, uids, destPath, { uidValidity } = {}) {
  const source = requirePath(folderPath);
  const destination = requirePath(destPath);
  if (destination === source) throw new HttpError(400, 'These messages are already in that folder.', 'INVALID_TARGET');
  if (folders.isHiddenFolder(folderRow(deps, accountRow, destination))) {
    throw new HttpError(400, 'Messages cannot be moved into that folder.', 'INVALID_TARGET');
  }
  const list = normalizeUids(uids);
  if (!list.length) return { destination, uidMap: {}, uidValidity: null };
  return withWritableMailbox(deps, accountRow, source, uidValidity, (client) => moveRanges(client, list, destination, 'move'));
}

/** The special use of one of the account's folders: the folders table first, else LIST. */
async function specialUseOf(deps, accountRow, client, path) {
  const row = deps && deps.db ? deps.db.prepare('SELECT special_use FROM folders WHERE account_id = ? AND path = ?').get(accountRow.id, path) : null;
  if (row) return row.special_use || null;
  const boxes = await client.list();
  for (const use of ['\\Trash', '\\Junk', '\\All']) if (imap.pickSpecialMailbox(boxes, use) === path) return use;
  return null;
}

/**
 * Delete messages for good: \Deleted + UID EXPUNGE (only these UIDs, given UIDPLUS).
 * Gmail: only Trash and Spam really delete; from anywhere else the messages are moved to the
 * Trash first and deleted there.
 */
async function deleteForever(deps, accountRow, folderPath, uids, { uidValidity } = {}) {
  const path = requirePath(folderPath);
  const list = normalizeUids(uids);
  if (!list.length) return { deleted: 0 };
  await withAccount(deps, accountRow, async (client) => {
    if (imap.isGmail(accountRow, client)) {
      const use = await specialUseOf(deps, accountRow, client, path);
      if (use !== '\\Trash' && use !== '\\Junk') return gmailDeleteViaTrash(deps, accountRow, client, path, list, uidValidity);
    }
    return inWritableMailbox(client, path, uidValidity, () => deleteRanges(client, list));
  });
  return { deleted: list.length };
}

/** Gmail delete-forever outside Trash/Spam: MOVE to [Gmail]/Trash, then delete them there. */
async function gmailDeleteViaTrash(deps, accountRow, client, source, uids, uidValidity) {
  const table = listFromTable(deps && deps.db, accountRow.id);
  const trash = (table && resolveTarget(table, 'trash', source, { gmail: true })) || resolveTarget(await client.list(), 'trash', source, { gmail: true });
  if (!trash) throw new HttpError(400, GMAIL_HIDDEN('Trash'), 'NO_TRASH');

  // Gmail's message ids (X-GM-MSGID: 64-bit decimals, kept as strings) find the messages in the
  // Trash should the server not report their new UIDs.
  const emailIds = [];
  const moved = await inWritableMailbox(client, source, uidValidity, async () => {
    for (const batch of batches(uids, UID_BATCH)) {
      for await (const msg of client.fetch(imap.toUidSet(batch), { uid: true }, { uid: true })) {
        if (msg && msg.emailId !== undefined && msg.emailId !== null && msg.emailId !== false) emailIds.push(String(msg.emailId));
      }
    }
    return moveRanges(client, uids, trash, 'trash');
  });

  await inWritableMailbox(client, trash, undefined, async () => {
    const sameFolder = !moved.uidValidity || Number(client.mailbox.uidValidity) === Number(moved.uidValidity);
    const found = new Set(sameFolder ? Object.values(moved.uidMap).map(Number) : []);
    if (found.size < uids.length) {
      for (const id of emailIds) {
        const hits = await client.search({ emailId: id }, { uid: true });
        for (const uid of Array.isArray(hits) ? hits : []) found.add(Number(uid));
      }
    }
    const targets = normalizeUids([...found]);
    if (targets.length) await deleteRanges(client, targets);
  });
}

/** Delete one message by UID (replacing a saved draft). Nothing happens when it is already gone. */
async function deleteByUid(deps, accountRow, folderPath, uid, { uidValidity } = {}) {
  const list = normalizeUids([uid]);
  if (!list.length) throw new HttpError(400, 'Invalid message.', 'INVALID_ID');
  return deleteForever(deps, accountRow, folderPath, list, { uidValidity });
}

/**
 * Empty a Trash or Spam folder (every message in it, for good). Refuses any other folder: the
 * folder must be known as \Trash / \Junk locally or flagged so by the server.
 * @returns {Promise<{count: number}>} how many messages the folder held
 */
async function emptyFolder(deps, accountRow, folderPath) {
  const path = requirePath(folderPath);
  return withWritableMailbox(deps, accountRow, path, undefined, async (client) => {
    let specialUse = null;
    const row = deps && deps.db ? deps.db.prepare('SELECT special_use FROM folders WHERE account_id = ? AND path = ?').get(accountRow.id, path) : null;
    if (row) specialUse = row.special_use;
    else {
      const boxes = await client.list();
      if (imap.pickSpecialMailbox(boxes, '\\Trash') === path) specialUse = '\\Trash';
      else if (imap.pickSpecialMailbox(boxes, '\\Junk') === path) specialUse = '\\Junk';
    }
    if (specialUse !== '\\Trash' && specialUse !== '\\Junk') {
      throw new HttpError(400, 'Only the Trash and Spam folders can be emptied.', 'NOT_EMPTYABLE');
    }
    const count = Number(client.mailbox.exists) || 0;
    if (count > 0 && !(await client.messageDelete('1:*'))) throw remoteFailed('empty the folder');
    return { count };
  });
}

/**
 * Store a message in a folder (a draft, a copy in Sent). Flags: system flags or keywords.
 * @returns {Promise<{uid: number|null, uidValidity: number|null}>} from APPENDUID when available
 */
async function appendMessage(deps, accountRow, folderPath, rawBuffer, flags = []) {
  const path = requirePath(folderPath);
  if (!Buffer.isBuffer(rawBuffer) || !rawBuffer.length) throw new HttpError(400, 'The message is empty.', 'INVALID_MESSAGE');
  const list = Array.isArray(flags) ? flags : [];
  if (list.some((f) => typeof f !== 'string' || !FLAG_RE.test(f))) throw new HttpError(400, 'Invalid message flag.', 'INVALID_FLAG');
  return withAccount(deps, accountRow, async (client) => {
    const result = await client.append(path, rawBuffer, [...new Set(list)]);
    if (!result) throw remoteFailed('save the message');
    return { uid: numberOrNull(result.uid), uidValidity: numberOrNull(result.uidValidity) };
  });
}

// ---------------------------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------------------------

/** Map a refused CREATE/RENAME/DELETE to a clear HttpError, or null. */
function folderCommandError(err) {
  const code = String((err && err.serverResponseCode) || '').toUpperCase();
  const text = `${(err && err.responseText) || ''}`;
  if (code === 'ALREADYEXISTS' || /already exists/i.test(text)) {
    return new HttpError(409, 'A folder with that name already exists.', 'FOLDER_EXISTS');
  }
  if (code === 'NONEXISTENT' || /doesn't exist|does not exist|no such mailbox|not found/i.test(text)) {
    return new HttpError(404, 'That folder no longer exists on the mail server.', 'FOLDER_NOT_FOUND');
  }
  return null;
}

async function folderCommand(fn) {
  try {
    return await fn();
  } catch (err) {
    throw folderCommandError(err) || err;
  }
}

/**
 * Apply local folder-table changes only while the account still has the settings this action
 * connected with (an edit to another server would make these folders someone else's).
 */
function localTx(deps, accountRow, fn) {
  const db = deps && deps.db;
  if (!db) return undefined;
  return db.transaction(() => {
    const row = db.prepare('SELECT config_version FROM accounts WHERE id = ?').get(accountRow.id);
    if (!row || (accountRow.config_version !== undefined && row.config_version !== accountRow.config_version)) return undefined;
    return fn(db);
  })();
}

/** Re-read the server's folder list into the folders table. */
async function relist(deps, accountRow, client) {
  if (!deps || !deps.db) return;
  const entries = await client.list();
  const options = { isGmail: imap.isGmail(accountRow, client), isExchange: imap.isExchange(accountRow, client) };
  localTx(deps, accountRow, (db) => folders.upsertFolders(db, accountRow.id, entries, options));
}

function folderRow(deps, accountRow, path) {
  if (!deps || !deps.db) return null;
  return deps.db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(accountRow.id, path) || null;
}

/**
 * Create a folder ("Work", or nested "Work/Clients" with the server's delimiter).
 * @returns {Promise<{path: string, created: boolean, folder: object|null}>} created is false
 *   when it already existed; folder is the local row (when deps.db is given).
 */
async function createFolder(deps, accountRow, path) {
  const target = requirePath(path);
  if (isInboxPath(target)) return { path: 'INBOX', created: false, folder: folderRow(deps, accountRow, 'INBOX') };
  return withAccount(deps, accountRow, async (client) => {
    const result = await folderCommand(() => client.mailboxCreate(target));
    if (!result) throw remoteFailed('create the folder');
    const created = result.path || target;
    await relist(deps, accountRow, client);
    return { path: created, created: result.created !== false, folder: folderRow(deps, accountRow, created) };
  });
}

/**
 * Rename (or move within the tree) a folder; its subfolders move with it. Locally the folder
 * keeps its id, sync state and messages (messages.mailbox and child paths follow).
 * @returns {Promise<{path: string, folder: object|null}>}
 */
async function renameFolder(deps, accountRow, oldPath, newPath) {
  const from = requirePath(oldPath);
  const to = requirePath(newPath);
  if (isInboxPath(from) || isInboxPath(to)) throw new HttpError(400, 'The inbox cannot be renamed.', 'PROTECTED_FOLDER');
  if (from === to) return { path: to, folder: folderRow(deps, accountRow, to) };
  return withAccount(deps, accountRow, async (client) => {
    // Some servers (Dovecot) happily RENAME onto an existing name and merge the subfolders, so
    // the name must be free, including as the parent of other folders.
    const boxes = await client.list();
    const source = boxes.find((box) => box.path === from);
    if (!source) throw new HttpError(404, 'That folder no longer exists on the mail server.', 'FOLDER_NOT_FOUND');
    const delimiter = source.delimiter;
    if (delimiter && to.startsWith(from + delimiter)) throw new HttpError(400, 'A folder cannot be moved into itself.', 'INVALID_TARGET');
    if (boxes.some((box) => box.path === to || (delimiter && box.path.startsWith(to + delimiter)))) {
      throw new HttpError(409, 'A folder with that name already exists.', 'FOLDER_EXISTS');
    }
    const result = await folderCommand(() => client.mailboxRename(from, to));
    if (!result) throw remoteFailed('rename the folder');
    const renamed = result.newPath || to;
    localTx(deps, accountRow, (db) => folders.renameFolderLocal(db, accountRow.id, result.path || from, renamed));
    await relist(deps, accountRow, client);
    return { path: renamed, folder: folderRow(deps, accountRow, renamed) };
  });
}

/**
 * Delete a folder and every folder below it (deepest first — IMAP servers refuse, or leave an
 * empty shell, when a folder with subfolders is deleted). Their messages are deleted with them
 * on the server; locally the rows go too. Refuses INBOX.
 * @returns {Promise<{deleted: string[]}>} the paths deleted on the server
 */
async function deleteFolder(deps, accountRow, path) {
  const target = requirePath(path);
  if (isInboxPath(target)) throw new HttpError(400, 'The inbox cannot be deleted.', 'PROTECTED_FOLDER');
  return withAccount(deps, accountRow, async (client) => {
    const boxes = await client.list();
    const entry = boxes.find((box) => box.path === target);
    if (!entry) {
      // Deleted elsewhere already: only the local rows are left to remove.
      localTx(deps, accountRow, (db) => folders.removeFolderLocal(db, accountRow.id, target));
      return { deleted: [] };
    }
    const delimiter = entry.delimiter;
    const children = delimiter
      ? boxes
          .filter((box) => box.path.startsWith(target + delimiter))
          .sort((a, b) => b.path.split(delimiter).length - a.path.split(delimiter).length || b.path.localeCompare(a.path))
      : [];
    const deleted = [];
    for (const box of [...children, entry]) {
      try {
        await folderCommand(() => client.mailboxDelete(box.path));
        deleted.push(box.path);
      } catch (err) {
        // Already gone (deleted elsewhere meanwhile, or a \NonExistent placeholder): fine.
        if (!(err instanceof HttpError && err.code === 'FOLDER_NOT_FOUND')) throw err;
      }
    }
    localTx(deps, accountRow, (db) => folders.removeFolderLocal(db, accountRow.id, target));
    await relist(deps, accountRow, client);
    return { deleted };
  });
}

module.exports = {
  applyFlags,
  moveMessages,
  moveToSpecial,
  deleteForever,
  emptyFolder,
  appendMessage,
  deleteByUid,
  createFolder,
  renameFolder,
  deleteFolder,
  resolveTarget,
};
