'use strict';

/**
 * Remote write-back: changes the user makes in Mailtabs (read/unread, star, archive, delete)
 * are applied on the real mail server so every other mail app sees them too.
 *
 * Failures are thrown as HttpError: 409 'UIDVALIDITY_CHANGED', 400 'NO_ARCHIVE' /
 * 'INVALID_TARGET', and 502 'REMOTE_FAILED' (with a friendly message) for anything the
 * server or the network refused.
 */

const imap = require('./imap');
const { HttpError } = require('./errors');

const UID_BATCH = 500; // keeps IMAP command lines short

const TRASH_NAMES = ['trash', 'deleted items', 'deleted messages', 'deleted'];

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

/**
 * Open the account's mailbox read-write and run fn(client). When `uidValidity` is given and
 * no longer matches, nothing is changed (the UIDs could now point at different messages).
 */
function withWritableMailbox(deps, accountRow, uidValidity, fn) {
  return serializePerAccount(accountRow.id, () => openWritable(deps, accountRow, uidValidity, fn));
}

async function openWritable(deps, accountRow, uidValidity, fn) {
  try {
    return await imap.withImap(deps, accountRow, async (client) => {
      const lock = await client.getMailboxLock(accountRow.mailbox || 'INBOX');
      try {
        if (uidValidity !== undefined && uidValidity !== null && Number(client.mailbox.uidValidity) !== Number(uidValidity)) {
          throw new HttpError(409, 'This mailbox changed on the mail server. Refresh and try again.', 'UIDVALIDITY_CHANGED');
        }
        if (client.mailbox.readOnly) {
          throw new HttpError(502, 'The mail server only allows reading this mailbox, so changes cannot be saved.', 'REMOTE_FAILED');
        }
        return await fn(client);
      } finally {
        lock.release();
      }
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const wrapped = new HttpError(502, imap.friendlyImapError(err), 'REMOTE_FAILED');
    wrapped.cause = err;
    throw wrapped;
  }
}

/**
 * Set or clear \Seen / \Flagged on messages.
 * @param {number[]} uids
 * @param {{isRead?: boolean, isStarred?: boolean, uidValidity?: number}} changes
 */
async function applyFlags(deps, accountRow, uids, { isRead, isStarred, uidValidity } = {}) {
  const list = normalizeUids(uids);
  const add = [];
  const remove = [];
  if (isRead === true) add.push('\\Seen');
  else if (isRead === false) remove.push('\\Seen');
  if (isStarred === true) add.push('\\Flagged');
  else if (isStarred === false) remove.push('\\Flagged');
  if (!list.length || (!add.length && !remove.length)) return;

  await withWritableMailbox(deps, accountRow, uidValidity, async (client) => {
    for (const batch of batches(list, UID_BATCH)) {
      const range = imap.toUidSet(batch);
      if (add.length && !(await client.messageFlagsAdd(range, add, { uid: true }))) throw remoteFailed('update the message');
      if (remove.length && !(await client.messageFlagsRemove(range, remove, { uid: true }))) throw remoteFailed('update the message');
    }
  });
}

function findByName(list, names, sourcePath) {
  const wanted = names.map((n) => n.toLowerCase());
  const candidates = (list || []).filter((box) => box.path !== sourcePath);
  // Prefer a top-level folder, then any folder whose last path segment matches.
  return (
    candidates.find((box) => wanted.includes(String(box.path).toLowerCase())) ||
    candidates.find((box) => wanted.includes(String(box.name).toLowerCase())) ||
    null
  );
}

/** Where 'archive' / 'trash' go on this server, or null (archive: none; trash: delete in place). */
function resolveTarget(list, target, sourcePath) {
  const notSource = (path) => (path && path.toLowerCase() !== String(sourcePath).toLowerCase() ? path : null);
  if (target === 'archive') {
    return (
      notSource(imap.pickSpecialMailbox(list, '\\Archive')) ||
      // Gmail: moving out of INBOX into All Mail is exactly what "Archive" does there.
      notSource(imap.pickSpecialMailbox(list, '\\All')) ||
      notSource((findByName(list, ['Archive'], sourcePath) || {}).path)
    );
  }
  return notSource(imap.pickSpecialMailbox(list, '\\Trash')) || notSource((findByName(list, TRASH_NAMES, sourcePath) || {}).path);
}

/**
 * Move messages to the account's Archive or Trash folder.
 * Trash falls back to deleting (\Deleted + EXPUNGE) when the server has no trash folder.
 * @returns {Promise<{destination: string|null, deleted: boolean}>}
 */
async function moveMessages(deps, accountRow, uids, target, { uidValidity } = {}) {
  if (target !== 'archive' && target !== 'trash') {
    throw new HttpError(400, 'Messages can only be moved to the archive or the trash.', 'INVALID_TARGET');
  }
  const list = normalizeUids(uids);
  if (!list.length) return { destination: null, deleted: false };

  return withWritableMailbox(deps, accountRow, uidValidity, async (client) => {
    const boxes = await client.list();
    const destination = resolveTarget(boxes, target, client.mailbox.path);
    if (target === 'archive' && !destination) {
      throw new HttpError(400, 'This account has no Archive folder', 'NO_ARCHIVE');
    }
    for (const batch of batches(list, UID_BATCH)) {
      const range = imap.toUidSet(batch);
      if (destination) {
        const moved = await client.messageMove(range, destination, { uid: true });
        if (!moved) throw remoteFailed(target === 'archive' ? 'archive the message' : 'move the message to the trash');
      } else {
        const deleted = await client.messageDelete(range, { uid: true });
        if (!deleted) throw remoteFailed('delete the message');
      }
    }
    return { destination: destination || null, deleted: !destination };
  });
}

module.exports = { applyFlags, moveMessages, resolveTarget };
