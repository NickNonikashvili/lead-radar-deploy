'use strict';

/**
 * Drafts on the mail server, plus the IMAP helpers sending shares with them:
 *   - finding an account's \Drafts / \Sent folder (folders table first, LIST as fallback);
 *   - APPEND / delete-by-UID;
 *   - turning a compose payload's attachment references (uploads, attachments of stored
 *     messages, inline images of quoted mail) into real MIME parts.
 *
 * Drafts are replaced, not edited: every save APPENDs a new message and deletes the previous
 * one. Saves of one account run one at a time, and a save whose "previous" draft was already
 * replaced by another save also removes that replacement, so racing autosaves never leave
 * duplicates behind.
 */

const imap = require('./imap');
const { HttpError } = require('./errors');
const compose = require('./compose');
const uploads = require('./uploads');
const folders = require('./folders');
const { parseRawMessage } = require('./mailparse');
const { createLimiter, createKeyedLimiter } = require('./concurrency');

// Largest message source we download to take attachments from (25 MB of attachments ≈ 34 MB encoded).
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
// Most source bytes (stored sizes) one payload may make us download, one message at a time.
const MAX_TOTAL_SOURCE_BYTES = 80 * 1024 * 1024;
const MAX_INLINE_IMAGES = 30;
// Quoted/forwarded inline images of one message, together (attachments have their own 25 MB).
const MAX_INLINE_BYTES = 25 * 1024 * 1024;
const MOVED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Whole message sources are held in memory while they are parsed: a few at a time for the
// whole server, and each user's drafts/sends take turns.
const sourceDownloads = createLimiter(8);
const materializations = createKeyedLimiter(2);
const SOURCE_DEADLINE_MS = 3 * 60 * 1000;
const SUPERSEDED_TTL_MS = 60 * 60 * 1000;

const FOLDER_NAMES = {
  '\\Drafts': ['Drafts', 'Draft', 'INBOX.Drafts', 'INBOX/Drafts'],
  '\\Sent': ['Sent', 'Sent Items', 'Sent Messages', 'Sent Mail', 'INBOX.Sent', 'INBOX/Sent', 'INBOX.Sent Items'],
};
const CREATE_NAMES = { '\\Drafts': 'Drafts', '\\Sent': 'Sent' };

function remoteFailed(err, what) {
  if (err instanceof HttpError) return err;
  const wrapped = new HttpError(502, err ? imap.friendlyImapError(err) : `The mail server refused to ${what}. Try again in a moment.`, 'REMOTE_FAILED');
  if (err) wrapped.cause = err;
  return wrapped;
}

// ---------------------------------------------------------------------------------------------
// Per-account serialisation (drafts and sent copies of one account never interleave)
// ---------------------------------------------------------------------------------------------

const accountQueues = new Map();

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

// ---------------------------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------------------------

/** The account's folder row with that special use (selectable), or null. */
function specialFolderRow(db, accountId, specialUse) {
  return (
    db
      .prepare('SELECT * FROM folders WHERE account_id = ? AND special_use = ? AND selectable = 1 ORDER BY id LIMIT 1')
      .get(accountId, specialUse) || null
  );
}

function folderById(db, folderId) {
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(Number(folderId)) || null;
}

/** Folder row for an IMAP path, created (minimal) when the folders sync has not seen it yet. */
function ensureFolderRow(db, accountId, entry, specialUse) {
  const existing = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(accountId, entry.path);
  if (existing) return existing;
  db.prepare(
    `INSERT OR IGNORE INTO folders (account_id, path, name, delimiter, parent_path, special_use, selectable, sync_mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 'auto', ?)`
  ).run(accountId, entry.path, entry.name || entry.path, entry.delimiter || null, entry.parentPath || null, specialUse, Date.now());
  return db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(accountId, entry.path) || null;
}

/** LIST entry of the mailbox with that special use (flag first, then well-known names), or null. */
function pickFolder(list, specialUse) {
  const path = imap.pickSpecialMailbox(list, specialUse);
  if (path) return list.find((b) => b.path === path) || { path };
  const names = (FOLDER_NAMES[specialUse] || []).map((n) => n.toLowerCase());
  const selectable = (list || []).filter((b) => !(b.flags && (b.flags.has('\\Noselect') || b.flags.has('\\NonExistent'))));
  return (
    selectable.find((b) => names.includes(String(b.path).toLowerCase())) ||
    selectable.find((b) => names.includes(String(b.name).toLowerCase())) ||
    null
  );
}

/**
 * The folder row of the account's \Drafts / \Sent folder, using `client` for the LIST
 * fallback. `create`: make it (named 'Drafts' / 'Sent') when the server has none.
 * @returns row or null
 */
async function resolveSpecialFolder(deps, account, client, specialUse, { create = false } = {}) {
  const known = specialFolderRow(deps.db, account.id, specialUse);
  if (known) return known;
  const list = await client.list();
  const entry = pickFolder(list, specialUse);
  if (entry) return ensureFolderRow(deps.db, account.id, entry, specialUse);
  if (!create) return null;
  // A folder created here: a sync listing taken before it must not remove its row again.
  const end = folders.beginFolderChange(deps.db, account.id);
  try {
    const created = await client.mailboxCreate(CREATE_NAMES[specialUse]);
    return ensureFolderRow(deps.db, account.id, { path: created.path, name: CREATE_NAMES[specialUse] }, specialUse);
  } finally {
    end();
  }
}

/** Ask the sync engine to pick up a change in one folder, in the background. */
function syncFolderSoon(deps, folder) {
  const sm = deps.syncManager;
  if (!sm || !folder) return;
  try {
    const p = typeof sm.syncFolder === 'function' ? sm.syncFolder(folder.id, { markOpened: false }) : sm.syncAccount(folder.account_id);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {
    /* background only */
  }
}

// ---------------------------------------------------------------------------------------------
// APPEND / delete
// ---------------------------------------------------------------------------------------------

/**
 * APPEND raw to `path` with `flags` on an open client.
 * @returns {{ uid: number|null, uidValidity: number|null }} (uid looked up by Message-ID when the
 *   server has no UIDPLUS)
 */
async function appendRaw(client, path, raw, flags, messageId) {
  const res = await client.append(path, raw, flags);
  if (!res) throw remoteFailed(null, 'save the message');
  if (res.uid) return { uid: Number(res.uid), uidValidity: res.uidValidity ? Number(res.uidValidity) : null };
  if (!messageId) return { uid: null, uidValidity: null };
  const lock = await client.getMailboxLock(path, { readOnly: true });
  try {
    const uids = await client.search({ header: { 'message-id': messageId } }, { uid: true });
    const uid = Array.isArray(uids) && uids.length ? Math.max(...uids) : null;
    return { uid, uidValidity: client.mailbox ? Number(client.mailbox.uidValidity) : null };
  } finally {
    lock.release();
  }
}

/** UIDs in `path` whose Message-ID header is `messageId` (open client). */
async function findByMessageId(client, path, messageId) {
  const lock = await client.getMailboxLock(path, { readOnly: true });
  try {
    const uids = await client.search({ header: { 'message-id': messageId } }, { uid: true });
    return Array.isArray(uids) ? uids : [];
  } finally {
    lock.release();
  }
}

// In-memory bookkeeping, per database (folder ids are only unique within one):
//   appended:   "<folderId>:<uid>" -> uidValidity of what we APPENDed (never delete a reused UID)
//   superseded: "<folderId>:<uid>" -> { folderId, uid, at } the draft that replaced it
const memory = new WeakMap();
const APPENDED_MAX = 5000;

function memFor(db) {
  if (!memory.has(db)) memory.set(db, { appended: new Map(), superseded: new Map() });
  return memory.get(db);
}

function rememberAppend(db, folderId, uid, uidValidity) {
  if (!uid || !uidValidity) return;
  const { appended } = memFor(db);
  if (appended.size >= APPENDED_MAX) appended.delete(appended.keys().next().value);
  appended.set(`${folderId}:${uid}`, uidValidity);
}

/** The UIDVALIDITY a draft reference was created under, when we know it. */
function knownUidValidity(db, folderId, uid) {
  const mem = memFor(db).appended.get(`${folderId}:${uid}`);
  if (mem) return mem;
  const row = db.prepare('SELECT uid_validity FROM messages WHERE folder_id = ? AND uid = ? ORDER BY id DESC LIMIT 1').get(folderId, uid);
  return row ? Number(row.uid_validity) : null;
}

/**
 * Delete one draft by UID on an open client. Only messages flagged \Draft (or anything in the
 * \Drafts folder) are deleted, and never when the folder's UIDVALIDITY no longer matches the
 * one the UID came from — a stale or forged reference must not delete real mail.
 * @returns true when a message was deleted
 */
async function deleteDraftOnClient(deps, client, folder, uid) {
  const lock = await client.getMailboxLock(folder.path);
  try {
    const expected = knownUidValidity(deps.db, folder.id, uid);
    if (expected && Number(client.mailbox.uidValidity) !== Number(expected)) return false;
    const msg = await client.fetchOne(String(uid), { uid: true, flags: true }, { uid: true });
    if (!msg) return false;
    const isDraft = msg.flags && msg.flags.has('\\Draft');
    if (!isDraft && folder.special_use !== '\\Drafts') return false;
    const ok = await client.messageDelete(String(uid), { uid: true });
    if (!ok) throw remoteFailed(null, 'delete the draft');
    return true;
  } finally {
    lock.release();
  }
}

function forgetLocalMessage(db, folderId, uid) {
  try {
    db.prepare('DELETE FROM messages WHERE folder_id = ? AND uid = ?').run(folderId, uid);
  } catch (_) {
    /* best effort: the next sync removes it anyway */
  }
}

function pruneSuperseded(superseded) {
  const cutoff = Date.now() - SUPERSEDED_TTL_MS;
  for (const [key, v] of superseded) if (v.at < cutoff) superseded.delete(key);
}

/**
 * Every draft reference in the replacement chain starting at `draft` (itself first).
 * `until` (epoch ms): leave out replacements saved after that time (edits made after a message
 * was queued are the user's newer draft, not part of what was sent).
 */
function draftChain(db, draft, { until = Infinity } = {}) {
  const { superseded } = memFor(db);
  pruneSuperseded(superseded);
  const out = [];
  const seen = new Set();
  let cur = draft;
  while (cur && !seen.has(`${cur.folderId}:${cur.uid}`) && out.length < 50) {
    const key = `${cur.folderId}:${cur.uid}`;
    seen.add(key);
    out.push({ folderId: Number(cur.folderId), uid: Number(cur.uid) });
    const next = superseded.get(key);
    cur = next && next.at <= until ? next : null;
  }
  return out;
}

function validDraftRef(draft) {
  if (!draft || typeof draft !== 'object') return null;
  const folderId = Number(draft.folderId);
  const uid = Number(draft.uid);
  if (!Number.isSafeInteger(folderId) || folderId < 1 || !Number.isSafeInteger(uid) || uid < 1) return null;
  return { folderId, uid };
}

/** Load the user's account that owns a folder, or null. */
function accountOfFolder(db, userId, folderId) {
  return (
    db
      .prepare('SELECT a.* FROM folders f JOIN accounts a ON a.id = f.account_id WHERE f.id = ? AND a.user_id = ?')
      .get(Number(folderId), userId) || null
  );
}

/**
 * Delete drafts (and whatever replaced them) of the same user. Missing ones are ignored.
 * Must run inside serializePerAccount for each account involved (callers do).
 */
async function deleteDraftRefs(deps, userId, refs) {
  const byAccount = new Map();
  for (const ref of refs) {
    const account = accountOfFolder(deps.db, userId, ref.folderId);
    if (!account) continue;
    if (!byAccount.has(account.id)) byAccount.set(account.id, { account, refs: [] });
    byAccount.get(account.id).refs.push(ref);
  }
  let deleted = 0;
  for (const { account, refs: list } of byAccount.values()) {
    await imap.withImap(deps, account, async (client) => {
      for (const ref of list) {
        const folder = folderById(deps.db, ref.folderId);
        if (!folder) continue;
        try {
          if (await deleteDraftOnClient(deps, client, folder, ref.uid)) deleted += 1;
        } catch (err) {
          if (!(err && err.mailboxMissing)) throw err;
        }
        forgetLocalMessage(deps.db, folder.id, ref.uid);
      }
    });
  }
  return deleted;
}

// ---------------------------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------------------------
//
// A payload refers to parts of stored messages as { messageId, index } (forwarded attachments,
// a reopened draft's files) and as <img src="/api/messages/<id>/attachments/<n>"> (quoted or
// forwarded inline images). A part is found, in this order:
//   1. carried_parts: a draft the composer was opened from was replaced by a later save; the
//      parts the payload took from it were kept as uploads then (see carryReplacedParts);
//   2. the stored message row, whose source is downloaded from the mail server;
//   3. moved_messages: the message was moved since (archived, ...) — found again by its
//      Message-ID in the same account, or in the folder the move put it in.
// Sources are downloaded one at a time, only the wanted parts are kept, and the stored sizes are
// checked first, so one payload never holds more than one message source in memory.

function messageForUser(db, userId, messageId) {
  return (
    db
      .prepare('SELECT m.* FROM messages m JOIN accounts a ON a.id = m.account_id WHERE m.id = ? AND a.user_id = ?')
      .get(Number(messageId), userId) || null
  );
}

/** Where a moved message of the user went, or null. */
function movedRecord(db, userId, oldId) {
  return (
    db
      .prepare('SELECT mm.* FROM moved_messages mm JOIN accounts a ON a.id = mm.account_id WHERE mm.old_id = ? AND a.user_id = ?')
      .get(Number(oldId), userId) || null
  );
}

const VIEW_COPY_SPECIAL_USES = ['\\All', '\\Flagged', '\\Important'];

/**
 * The user's row for a message id, or — when that message was moved since — its row in its
 * new folder (same account and Message-ID; Gmail's All Mail / Starred copies last). Null when
 * neither is stored.
 */
function currentMessageRow(db, userId, messageId) {
  const row = messageForUser(db, userId, messageId);
  if (row) return row;
  const moved = movedRecord(db, userId, messageId);
  if (!moved || !moved.message_id) return null;
  return (
    db
      .prepare(
        `SELECT m.* FROM messages m LEFT JOIN folders f ON f.id = m.folder_id
          WHERE m.account_id = ? AND m.message_id = ? AND m.is_draft = 0
          ORDER BY CASE WHEN f.special_use IN (?, ?, ?) THEN 1 ELSE 0 END, m.id DESC LIMIT 1`
      )
      .get(moved.account_id, moved.message_id, ...VIEW_COPY_SPECIAL_USES) || null
  );
}

/**
 * Where to download a referenced message from: { accountId, mailbox, uid, uidValidity, size, row }
 * (row null when only the move's destination is known), or null.
 */
function sourceFor(db, userId, messageId) {
  const row = currentMessageRow(db, userId, messageId);
  if (row) return { accountId: row.account_id, mailbox: row.mailbox, uid: row.uid, uidValidity: row.uid_validity, size: row.size, row };
  const moved = movedRecord(db, userId, messageId);
  if (moved && moved.folder_id && moved.uid && moved.uid_validity) {
    const folder = folderById(db, moved.folder_id);
    if (folder && folder.account_id === moved.account_id) {
      return { accountId: moved.account_id, mailbox: folder.path, uid: moved.uid, uidValidity: moved.uid_validity, size: null, row: null };
    }
  }
  return null;
}

/**
 * Remember where moved messages went (rows: their messages rows before the move). `uidMap`
 * (old UID -> new UID) and `uidValidity` come from the server's COPYUID, when it sent one.
 */
function recordMoves(db, accountId, rows, { folderId = null, uidMap = {}, uidValidity = null } = {}) {
  const now = Date.now();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO moved_messages (old_id, account_id, message_id, folder_id, uid, uid_validity, moved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    db.prepare('DELETE FROM moved_messages WHERE moved_at < ?').run(now - MOVED_TTL_MS);
    for (const row of rows) {
      const uid = Number(uidMap && uidMap[row.uid]) || null;
      insert.run(row.id, accountId, row.message_id || null, uid ? folderId : null, uid, uid ? uidValidity : null, now);
    }
  })();
}

/** Parts kept from replaced drafts: [{ part_index, upload_id }] of one message id. */
function carriedFor(db, userId, messageId) {
  return db.prepare('SELECT part_index, upload_id FROM carried_parts WHERE message_id = ? AND user_id = ?').all(Number(messageId), userId);
}

/** The upload holding a carried part of a replaced draft (for showing it in the composer), or null. */
function carriedUpload(db, userId, messageId, index) {
  const c = db
    .prepare('SELECT upload_id FROM carried_parts WHERE message_id = ? AND part_index = ? AND user_id = ?')
    .get(Number(messageId), Number(index), userId);
  return c ? uploads.getUpload(db, userId, c.upload_id) : null;
}

/** Can this { messageId, index } reference still be resolved (before sending it in a minute)? */
function refAvailable(db, userId, ref) {
  if (carriedUpload(db, userId, ref.messageId, ref.index)) return true;
  return !!sourceFor(db, userId, ref.messageId);
}

/** Upload ids of the carried parts a validated payload refers to (attachments and inline images). */
function carriedUploadIds(db, userId, payload) {
  const ids = new Set();
  const refs = [
    ...((payload && payload.attachments) || []).filter((a) => a && a.messageId),
    ...compose.internalImageRefs((payload && payload.html) || ''),
  ];
  for (const ref of refs) {
    const upload = carriedUpload(db, userId, ref.messageId, ref.index);
    if (upload) ids.add(upload.id);
  }
  return [...ids];
}

/** Does a payload take attachments or inline images from one of these drafts' rows? */
function refersToDrafts(db, userId, payload, chain) {
  const keys = new Set(chain.map((r) => `${r.folderId}:${r.uid}`));
  const refs = [
    ...((payload && payload.attachments) || []).filter((a) => a && a.messageId),
    ...compose.internalImageRefs((payload && payload.html) || ''),
  ];
  return refs.some((ref) => {
    const row = messageForUser(db, userId, ref.messageId);
    return !!row && keys.has(`${row.folder_id}:${row.uid}`);
  });
}

/**
 * Attachment references with what the composer shows for them (filename, contentType, size),
 * from the user's uploads and stored messages. A reference that can no longer be found keeps a
 * generic name (sending it reports it as gone).
 */
function describeAttachments(db, userId, attachments) {
  const metaByMessage = new Map();
  const metaOf = (messageId) => {
    if (!metaByMessage.has(messageId)) {
      const row = currentMessageRow(db, userId, messageId);
      let list = [];
      try {
        list = row ? JSON.parse(row.attachments_json || '[]') : [];
      } catch (_) {
        list = [];
      }
      metaByMessage.set(messageId, Array.isArray(list) ? list : []);
    }
    return metaByMessage.get(messageId);
  };
  return (Array.isArray(attachments) ? attachments : [])
    .filter((ref) => ref && typeof ref === 'object')
    .map((ref) => {
      if (ref.uploadId) {
        const row = uploads.getUpload(db, userId, ref.uploadId);
        return {
          uploadId: ref.uploadId,
          filename: row ? row.filename : 'attachment',
          contentType: row ? row.content_type : 'application/octet-stream',
          size: row ? Number(row.size) : null,
        };
      }
      const carried = carriedUpload(db, userId, ref.messageId, ref.index);
      const meta = carried
        ? { filename: carried.filename, contentType: carried.content_type, size: Number(carried.size) }
        : metaOf(ref.messageId).find((a) => a && a.index === ref.index);
      return {
        messageId: ref.messageId,
        index: ref.index,
        filename: compose.cleanFilename(meta && meta.filename, `attachment-${Number(ref.index) + 1}`),
        contentType: compose.cleanContentType(meta && meta.contentType),
        size: meta && Number.isFinite(meta.size) ? meta.size : null,
      };
    });
}

function attachmentSourceGone() {
  return new HttpError(410, 'A message you attached files from is no longer on the mail server.', 'ATTACHMENT_GONE');
}

/**
 * Download one message source over IMAP (null when it is no longer there). A wall-clock deadline
 * closes the connection, so a server that trickles bytes can't hold a download slot forever.
 */
async function downloadSource(deps, account, { mailbox, uid, uidValidity }) {
  return sourceDownloads(async () => {
    let timedOut = false;
    let active = null;
    const timer = setTimeout(() => {
      timedOut = true;
      if (active) active.close();
    }, SOURCE_DEADLINE_MS);
    try {
      return await imap.withImap(
        deps,
        account,
        async (client) => {
          active = client;
          if (timedOut) client.close();
          const lock = await client.getMailboxLock(mailbox, { readOnly: true });
          try {
            if (Number(client.mailbox.uidValidity) !== Number(uidValidity)) return null;
            const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
            return msg && msg.source ? msg.source : null;
          } finally {
            lock.release();
          }
        },
        { maxLiteralSize: MAX_SOURCE_BYTES }
      );
    } catch (err) {
      if (timedOut) {
        const slow = new HttpError(502, 'Downloading a message you attached files from took too long. Try again in a moment.', 'REMOTE_FAILED');
        slow.cause = err;
        throw slow;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });
}

/** Download and parse a message source of the user: { source, parsed }. */
async function fetchParsedSource(deps, userId, source) {
  const account = deps.db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(source.accountId, userId);
  if (!account) throw attachmentSourceGone();
  let raw;
  try {
    raw = await downloadSource(deps, account, source);
  } catch (err) {
    if (err && err.mailboxMissing) throw attachmentSourceGone();
    const wrapped = remoteFailed(err, 'download the attachment');
    wrapped.retryable = true;
    throw wrapped;
  }
  if (!raw) throw attachmentSourceGone();
  try {
    return { source: raw, parsed: await parseRawMessage(raw) };
  } catch (_) {
    throw new HttpError(422, 'A message you attached files from could not be decoded.', 'UNPARSEABLE');
  }
}

/** Download and parse a stored message's source (a draft being reopened). */
async function fetchParsedMessage(deps, userId, messageId) {
  const row = messageForUser(deps.db, userId, messageId);
  if (!row) throw attachmentSourceGone();
  const { source, parsed } = await fetchParsedSource(deps, userId, {
    accountId: row.account_id,
    mailbox: row.mailbox,
    uid: row.uid,
    uidValidity: row.uid_validity,
  });
  return { row, source, parsed };
}

const partKey = (messageId, index) => `${Number(messageId)}:${Number(index)}`;

function attachmentsTooLarge() {
  return new HttpError(400, 'The attachments are too large (at most 25 MB together). Remove some, or share them as links.', 'ATTACHMENTS_TOO_LARGE');
}

/**
 * The parts `wanted` refers to.
 * @param {Map<number, Map<number, boolean>>} wanted messageId -> (index -> required). A missing
 *   required part throws (410/400/502); optional ones (inline images) are left out.
 * @param {{ required: number, optional: number }} budget bytes the required parts (attachments)
 *   and the optional ones (inline images) may take: checked as each part is kept, so a payload
 *   can never make us hold more than that (more required bytes throw ATTACHMENTS_TOO_LARGE,
 *   optional parts over their budget are left out)
 * @returns {Promise<{ parts: Map<string, {filename, contentType, content}>, downloaded: Array<{ row, index, part }> }>}
 *   downloaded: the parts taken from a stored message row (saveDraft may have to carry them).
 */
async function collectParts(deps, userId, wanted, budget) {
  const { db } = deps;
  const parts = new Map();
  const downloaded = [];
  const plan = [];
  let sourceBytes = 0;
  const kept = { required: 0, optional: 0 };
  // Keep a part within the budgets; false when an optional one doesn't fit (it is left out).
  const keep = (messageId, index, required, part) => {
    const kind = required ? 'required' : 'optional';
    if (kept[kind] + part.content.length > budget[kind]) {
      if (required) throw attachmentsTooLarge();
      if (deps.logger) deps.logger.warn(`[drafts] inline image ${messageId}/${index} dropped: the images are too large together`);
      return false;
    }
    kept[kind] += part.content.length;
    parts.set(partKey(messageId, index), part);
    return true;
  };
  for (const [messageId, indexes] of wanted) {
    const remaining = new Map(indexes);
    for (const c of carriedFor(db, userId, messageId)) {
      if (!remaining.has(c.part_index)) continue;
      const upload = uploads.getUpload(db, userId, c.upload_id);
      if (!upload) continue;
      let content;
      try {
        content = uploads.readUpload(upload);
      } catch (_) {
        continue; // its file is gone: look for the message itself
      }
      keep(messageId, c.part_index, remaining.get(c.part_index), { filename: upload.filename, contentType: upload.content_type, content });
      remaining.delete(c.part_index);
    }
    if (!remaining.size) continue;
    const required = [...remaining.values()].some(Boolean);
    const source = sourceFor(db, userId, messageId);
    if (!source) {
      if (required) throw attachmentSourceGone();
      continue;
    }
    // Stored sizes come from the server; the download itself is capped at MAX_SOURCE_BYTES too.
    const size = Number(source.size) || 0;
    if (size > MAX_SOURCE_BYTES || sourceBytes + size > MAX_TOTAL_SOURCE_BYTES) {
      if (required) {
        throw new HttpError(
          400,
          'The messages you attached files from are too large to take attachments from. Download the files and attach them instead.',
          'ATTACHMENTS_TOO_LARGE'
        );
      }
      continue;
    }
    sourceBytes += size;
    plan.push({ messageId, source, remaining, required });
  }

  for (const item of plan) {
    let parsed;
    try {
      ({ parsed } = await fetchParsedSource(deps, userId, item.source));
    } catch (err) {
      if (item.required) throw err;
      if (deps.logger) deps.logger.warn(`[drafts] inline images of message ${item.messageId} dropped: ${err && err.message}`);
      continue;
    }
    for (const [index, required] of item.remaining) {
      const att = parsed.attachments[index];
      if (!att) {
        if (required) throw new HttpError(410, 'An attachment of the original message is no longer available.', 'ATTACHMENT_GONE');
        continue;
      }
      const part = { filename: att.filename, contentType: att.contentType, content: att.content };
      if (keep(item.messageId, index, required, part) && item.source.row) downloaded.push({ row: item.source.row, index, part });
    }
    // Nothing else of the parsed message is kept.
  }
  return { parts, downloaded };
}

/**
 * A validated payload's html + attachments as MIME-ready parts. Images of quoted/forwarded mail
 * (src="/api/messages/<id>/attachments/<n>") become cid parts; those that can't be resolved are
 * dropped from the HTML (never sent as app-internal URLs).
 * @returns {Promise<{ payload, attachments: Array<{ filename, contentType, content, cid? }>, sources }>}
 *   sources: parts taken from stored message rows (see collectParts)
 */
function materialize(deps, userId, payload) {
  // A user's materializations take turns (each may download sources of up to 40 MB).
  return materializations(userId, async () => {
    const html = (payload && payload.html) || '';
    const refs = (payload && payload.attachments) || [];
    const inlineRefs = compose.internalImageRefs(html).slice(0, MAX_INLINE_IMAGES);
    const wanted = new Map();
    const want = (messageId, index, required) => {
      const id = Number(messageId);
      if (!wanted.has(id)) wanted.set(id, new Map());
      const forMessage = wanted.get(id);
      forMessage.set(index, forMessage.get(index) || required);
    };
    for (const ref of refs) if (ref && ref.messageId) want(ref.messageId, ref.index, true);
    for (const ref of inlineRefs) want(ref.messageId, ref.index, false);

    // Uploads first: a missing one fails before anything is downloaded, and their sizes leave
    // what the attachments of stored messages may add.
    let uploadBytes = 0;
    for (const ref of refs) {
      if (!ref || !ref.uploadId) continue;
      const row = uploads.getUpload(deps.db, userId, ref.uploadId);
      if (!row) throw new HttpError(410, 'An attachment is no longer available — attach it again.', 'ATTACHMENT_GONE');
      uploadBytes += Number(row.size) || 0;
    }
    if (uploadBytes > compose.COMPOSE_LIMITS.maxAttachmentBytes) throw attachmentsTooLarge();
    const { parts, downloaded } = await collectParts(deps, userId, wanted, {
      required: compose.COMPOSE_LIMITS.maxAttachmentBytes - uploadBytes,
      optional: MAX_INLINE_BYTES,
    });

    const attachments = [];
    let total = 0;
    for (const ref of refs) {
      let part = null;
      if (ref.uploadId) {
        const row = uploads.getUpload(deps.db, userId, ref.uploadId);
        if (!row) throw new HttpError(410, 'An attachment is no longer available — attach it again.', 'ATTACHMENT_GONE');
        part = { filename: row.filename, contentType: row.content_type, content: uploads.readUpload(row) };
      } else if (ref.messageId) {
        part = parts.get(partKey(ref.messageId, ref.index)) || null;
      }
      if (!part) continue;
      total += part.content.length;
      if (total > compose.COMPOSE_LIMITS.maxAttachmentBytes) throw attachmentsTooLarge();
      attachments.push(part);
    }

    const map = {};
    const inline = [];
    for (const ref of inlineRefs) {
      const part = parts.get(partKey(ref.messageId, ref.index));
      if (!part || !/^image\//i.test(String(part.contentType))) continue;
      const cid = `inline${inline.length + 1}.${Date.now().toString(36)}@mailtabs`;
      map[ref.src] = cid;
      inline.push({ ...part, cid });
    }
    return { payload: { ...payload, html: compose.replaceInternalImages(html, map) }, attachments: [...attachments, ...inline], sources: downloaded };
  });
}

/**
 * Turn attachment references into MIME parts.
 * @param {Array<{uploadId}|{messageId, index}>} attachments (validatePayload output)
 * @returns {Promise<Array<{ filename, contentType, content: Buffer }>>}
 */
async function resolveAttachments(deps, userId, attachments) {
  return (await materialize(deps, userId, { attachments, html: '' })).attachments;
}

/**
 * Embed images of quoted/forwarded mail as cid parts (see materialize).
 * @returns {Promise<{ html: string, inline: Array<{ filename, contentType, content, cid }> }>}
 */
async function resolveInlineImages(deps, userId, html) {
  const { payload, attachments } = await materialize(deps, userId, { attachments: [], html });
  return { html: payload.html, inline: attachments };
}

/**
 * A new draft replaces the drafts of `chain`. The payload's parts that came from those drafts'
 * rows (a reopened draft's files and pictures) are kept as uploads in carried_parts, so the
 * composer's references to them keep working once the rows are gone.
 * @returns {boolean} false when they could not all be kept (the replaced drafts must then stay)
 */
function carryReplacedParts(deps, userId, sources, chain) {
  const doomed = new Set(chain.map((r) => `${r.folderId}:${r.uid}`));
  const exists = deps.db.prepare('SELECT 1 FROM carried_parts WHERE message_id = ? AND part_index = ?');
  const insert = deps.db.prepare('INSERT OR IGNORE INTO carried_parts (message_id, part_index, user_id, upload_id) VALUES (?, ?, ?, ?)');
  for (const { row, index, part } of sources || []) {
    if (!row || !doomed.has(`${row.folder_id}:${row.uid}`) || exists.get(row.id, index)) continue;
    try {
      const upload = uploads.saveUpload(deps, userId, { filename: part.filename, contentType: part.contentType, buffer: part.content });
      insert.run(row.id, index, userId, upload.id);
    } catch (err) {
      if (deps.logger) deps.logger.warn(`[drafts] could not keep the attachments of the previous draft: ${err && err.message}`);
      return false;
    }
  }
  return true;
}

/** "From" display name: the account's sender name, else the Mailtabs user's name. */
function senderNameFor(db, account) {
  if (account.sender_name && String(account.sender_name).trim()) return account.sender_name;
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(account.user_id);
  return (user && user.name) || '';
}

// ---------------------------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------------------------

/**
 * Save a draft on the server: build it, APPEND it to the account's \Drafts folder (created
 * when missing) flagged \Draft \Seen, then delete `previous` (and anything that replaced it).
 * @param {object} account the From account (its user owns everything referenced)
 * @param {object} payload raw or validated compose payload (recipients optional)
 * @param {{folderId, uid}|null} previous the draft this one replaces
 * @returns {Promise<{ folderId: number, uid: number|null }>}
 */
async function saveDraft(deps, account, payload, previous) {
  const normalized = compose.validatePayload({ ...(payload || {}), accountId: account.id }, { draft: true });
  const prev = validDraftRef(previous);
  const { payload: ready, attachments, sources } = await materialize(deps, account.user_id, normalized);
  const { raw, messageId } = await compose.buildMime({
    account,
    payload: ready,
    attachments,
    draft: true,
    fromName: senderNameFor(deps.db, account),
  });

  return serializePerAccount(account.id, async () => {
    let folder;
    let result;
    try {
      result = await imap.withImap(deps, account, async (client) => {
        folder = await resolveSpecialFolder(deps, account, client, '\\Drafts', { create: true });
        if (!folder) throw remoteFailed(null, 'create a Drafts folder');
        return appendRaw(client, folder.path, raw, ['\\Draft', '\\Seen'], messageId);
      });
    } catch (err) {
      throw remoteFailed(err, 'save the draft');
    }
    rememberAppend(deps.db, folder.id, result.uid, result.uidValidity);
    const saved = { folderId: folder.id, uid: result.uid };

    let elsewhere = [];
    if (prev) {
      const chain = draftChain(deps.db, prev).filter((r) => !(r.folderId === saved.folderId && r.uid === saved.uid));
      // Every draft of the chain now leads to the new one, so a late save that still names any
      // of them as "previous" removes this one too.
      const { superseded } = memFor(deps.db);
      if (result.uid) for (const r of chain) superseded.set(`${r.folderId}:${r.uid}`, { ...saved, at: Date.now() });
      // The composer still refers to the files and pictures of the draft it was opened from.
      const kept = carryReplacedParts(deps, account.user_id, sources, chain);
      const { same, other } = kept ? splitByAccount(deps.db, account, chain) : { same: [], other: [] };
      elsewhere = other;
      try {
        if (same.length) await deleteDraftRefs(deps, account.user_id, same);
      } catch (err) {
        // The new draft is saved; an old copy left behind is a nuisance, not a failure.
        if (deps.logger) deps.logger.warn(`[drafts] could not delete the previous draft: ${err && err.message}`);
      }
    }
    syncFolderSoon(deps, folder);
    return { saved, elsewhere };
  }).then(async ({ saved, elsewhere }) => {
    // Drafts in another account (the user switched From): deleted in that account's own queue,
    // after this one is released, so two accounts never wait for each other.
    if (elsewhere.length) {
      await deleteRefsAcrossAccounts(deps, account.user_id, elsewhere).catch((err) => {
        if (deps.logger) deps.logger.warn(`[drafts] could not delete the previous draft: ${err && err.message}`);
      });
    }
    return saved;
  });
}

/** Split draft refs into those of `account` and those of the user's other accounts. */
function splitByAccount(db, account, refs) {
  const same = [];
  const other = [];
  for (const ref of refs) {
    const owner = accountOfFolder(db, account.user_id, ref.folderId);
    if (owner) (owner.id === account.id ? same : other).push(ref);
  }
  return { same, other };
}

/** Delete refs of any of the user's accounts, each account in its own queue (hold none when calling). */
async function deleteRefsAcrossAccounts(deps, userId, refs) {
  const byAccount = new Map();
  for (const ref of refs) {
    const owner = accountOfFolder(deps.db, userId, ref.folderId);
    if (!owner) continue;
    if (!byAccount.has(owner.id)) byAccount.set(owner.id, []);
    byAccount.get(owner.id).push(ref);
  }
  let deleted = 0;
  for (const [accountId, list] of byAccount) {
    deleted += await serializePerAccount(accountId, () => deleteDraftRefs(deps, userId, list));
  }
  return deleted;
}

/**
 * Delete a draft (and any later save that replaced it). `account` is the user's account the
 * request is about; the draft may live in any account of the same user.
 */
async function deleteDraft(deps, account, draft) {
  const ref = validDraftRef(draft);
  if (!ref) throw new HttpError(400, 'Invalid draft.', 'INVALID_DRAFT');
  const owner = accountOfFolder(deps.db, account.user_id, ref.folderId);
  if (!owner) throw new HttpError(404, 'Draft not found', 'NOT_FOUND');
  const chain = draftChain(deps.db, ref);
  try {
    await deleteRefsAcrossAccounts(deps, account.user_id, chain);
  } catch (err) {
    throw remoteFailed(err, 'delete the draft');
  }
  const { superseded } = memFor(deps.db);
  for (const r of chain) superseded.delete(`${r.folderId}:${r.uid}`);
  syncFolderSoon(deps, folderById(deps.db, ref.folderId));
  return { ok: true };
}

/** Bcc / In-Reply-To / References of a raw message (headers only). */
async function draftHeaders(source) {
  const { simpleParser } = require('mailparser');
  const buf = Buffer.isBuffer(source) ? source : Buffer.from(String(source || ''));
  let end = buf.indexOf('\r\n\r\n');
  if (end < 0) end = buf.indexOf('\n\n');
  const head = end >= 0 ? buf.subarray(0, end) : buf;
  const parsed = await simpleParser(Buffer.concat([head, Buffer.from('\r\n\r\n')]), { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true });
  const flat = (field) => {
    const out = [];
    const walk = (list) => {
      for (const a of list || []) {
        if (a && Array.isArray(a.group)) walk(a.group);
        else if (a && a.address) out.push({ name: a.name || '', address: a.address });
      }
    };
    for (const obj of Array.isArray(field) ? field : field ? [field] : []) walk(obj.value);
    return out;
  };
  const refs = parsed.references ? (Array.isArray(parsed.references) ? parsed.references : String(parsed.references).split(/\s+/)) : [];
  return { bcc: flat(parsed.bcc), inReplyTo: parsed.inReplyTo || null, references: refs };
}

/**
 * Composer payload for one of the user's drafts (downloads its source for Bcc and attachments).
 * @returns {Promise<{ payload, draft: { folderId, uid } }>}
 */
async function loadDraft(deps, userId, messageRow) {
  if (!messageRow) throw new HttpError(404, 'Draft not found', 'NOT_FOUND');
  const { row, source, parsed } = await fetchParsedMessage(deps, userId, messageRow.id).catch((err) => {
    if (err && err.code === 'ATTACHMENT_GONE') throw new HttpError(404, 'This draft is no longer on the mail server.', 'MESSAGE_GONE');
    throw err;
  });
  const headers = await draftHeaders(source);
  const payload = compose.parseDraft({ ...parsed, ...headers, inReplyTo: headers.inReplyTo || parsed.inReplyTo }, row);
  if (payload.inReplyTo) {
    const original = deps.db
      .prepare('SELECT id FROM messages WHERE account_id = ? AND message_id = ? AND id != ? AND is_draft = 0 ORDER BY id LIMIT 1')
      .get(row.account_id, payload.inReplyTo, row.id);
    if (original) payload.replyToMessageId = original.id;
  }
  // Only a real draft may be replaced/deleted later; any other message just opens as a copy.
  const folder = row.folder_id ? folderById(deps.db, row.folder_id) : null;
  const isDraft = !!folder && (folder.special_use === '\\Drafts' || Number(row.is_draft) === 1);
  return { payload, draft: isDraft ? { folderId: row.folder_id, uid: row.uid } : null };
}

module.exports = {
  saveDraft,
  deleteDraft,
  loadDraft,
  resolveAttachments,
  resolveInlineImages,
  materialize,
  senderNameFor,
  describeAttachments,
  currentMessageRow,
  refAvailable,
  carriedUploadIds,
  carriedUpload,
  recordMoves,
  refersToDrafts,
  carryReplacedParts,
  // shared with the outbox
  serializePerAccount,
  resolveSpecialFolder,
  specialFolderRow,
  appendRaw,
  findByMessageId,
  rememberAppend,
  deleteDraftRefs,
  deleteRefsAcrossAccounts,
  draftChain,
  validDraftRef,
  syncFolderSoon,
  folderById,
  messageForUser,
};
