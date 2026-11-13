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
const { parseRawMessage } = require('./mailparse');

// Largest message source we download to take attachments from (25 MB of attachments ≈ 34 MB encoded).
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_INLINE_IMAGES = 30;
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
  let entry = pickFolder(list, specialUse);
  if (!entry && create) {
    const created = await client.mailboxCreate(CREATE_NAMES[specialUse]);
    entry = { path: created.path, name: CREATE_NAMES[specialUse] };
  }
  return entry ? ensureFolderRow(deps.db, account.id, entry, specialUse) : null;
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

/** Every draft reference in the replacement chain starting at `draft` (itself first). */
function draftChain(db, draft) {
  const { superseded } = memFor(db);
  pruneSuperseded(superseded);
  const out = [];
  const seen = new Set();
  let cur = draft;
  while (cur && !seen.has(`${cur.folderId}:${cur.uid}`) && out.length < 50) {
    const key = `${cur.folderId}:${cur.uid}`;
    seen.add(key);
    out.push({ folderId: Number(cur.folderId), uid: Number(cur.uid) });
    cur = superseded.get(key);
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

function messageForUser(db, userId, messageId) {
  return (
    db
      .prepare('SELECT m.* FROM messages m JOIN accounts a ON a.id = m.account_id WHERE m.id = ? AND a.user_id = ?')
      .get(Number(messageId), userId) || null
  );
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
      const row = messageForUser(db, userId, messageId);
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
      const meta = metaOf(ref.messageId).find((a) => a && a.index === ref.index);
      return {
        messageId: ref.messageId,
        index: ref.index,
        filename: compose.cleanFilename(meta && meta.filename, `attachment-${Number(ref.index) + 1}`),
        contentType: compose.cleanContentType(meta && meta.contentType),
        size: meta && Number.isFinite(meta.size) ? meta.size : null,
      };
    });
}

/** Download and parse a stored message's source (for its attachments). */
async function fetchParsedMessage(deps, userId, messageId) {
  const gone = () => new HttpError(410, 'A message you attached files from is no longer on the mail server.', 'ATTACHMENT_GONE');
  const row = messageForUser(deps.db, userId, messageId);
  if (!row) throw gone();
  const account = deps.db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(row.account_id, userId);
  if (!account) throw gone();
  let source;
  try {
    source = await imap.withImap(
      deps,
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
      { maxLiteralSize: MAX_SOURCE_BYTES }
    );
  } catch (err) {
    if (err && err.mailboxMissing) throw gone();
    const wrapped = remoteFailed(err, 'download the attachment');
    wrapped.retryable = true;
    throw wrapped;
  }
  if (!source) throw gone();
  try {
    return { row, source, parsed: await parseRawMessage(source) };
  } catch (_) {
    throw new HttpError(422, 'A message you attached files from could not be decoded.', 'UNPARSEABLE');
  }
}

/**
 * Turn attachment references into MIME parts.
 * @param {Array<{uploadId}|{messageId, index}>} attachments (validatePayload output)
 * @param {Map} [cache] messageId -> Promise<parsed>, shared with resolveInlineImages
 * @returns {Promise<Array<{ filename, contentType, content: Buffer }>>}
 */
async function resolveAttachments(deps, userId, attachments, cache = new Map()) {
  const out = [];
  let total = 0;
  const add = (part) => {
    total += part.content.length;
    if (total > compose.COMPOSE_LIMITS.maxAttachmentBytes) {
      throw new HttpError(400, 'The attachments are too large (at most 25 MB together). Remove some, or share them as links.', 'ATTACHMENTS_TOO_LARGE');
    }
    out.push(part);
  };
  for (const ref of attachments || []) {
    if (ref.uploadId) {
      const row = uploads.getUpload(deps.db, userId, ref.uploadId);
      if (!row) throw new HttpError(410, 'An attachment is no longer available — attach it again.', 'ATTACHMENT_GONE');
      add({ filename: row.filename, contentType: row.content_type, content: uploads.readUpload(row) });
    } else if (ref.messageId) {
      if (!cache.has(ref.messageId)) cache.set(ref.messageId, fetchParsedMessage(deps, userId, ref.messageId));
      const { parsed } = await cache.get(ref.messageId);
      const att = parsed.attachments[ref.index];
      if (!att) throw new HttpError(410, 'An attachment of the original message is no longer available.', 'ATTACHMENT_GONE');
      add({ filename: att.filename, contentType: att.contentType, content: att.content });
    }
  }
  return out;
}

/**
 * Embed images of quoted/forwarded mail (src="/api/messages/<id>/attachments/<n>") as cid parts.
 * Images that can't be resolved are dropped from the HTML (never sent as app-internal URLs).
 * @returns {Promise<{ html: string, inline: Array<{ filename, contentType, content, cid }> }>}
 */
async function resolveInlineImages(deps, userId, html, cache = new Map()) {
  const refs = compose.internalImageRefs(html).slice(0, MAX_INLINE_IMAGES);
  const map = {};
  const inline = [];
  for (const ref of refs) {
    try {
      if (!cache.has(ref.messageId)) cache.set(ref.messageId, fetchParsedMessage(deps, userId, ref.messageId));
      const { parsed } = await cache.get(ref.messageId);
      const att = parsed.attachments[ref.index];
      if (!att || !/^image\//i.test(String(att.contentType))) continue;
      const cid = `inline${inline.length + 1}.${Date.now().toString(36)}@mailtabs`;
      map[ref.src] = cid;
      inline.push({ filename: att.filename, contentType: att.contentType, content: att.content, cid });
    } catch (err) {
      if (deps.logger) deps.logger.warn(`[drafts] inline image ${ref.src} dropped: ${err && err.message}`);
    }
  }
  return { html: compose.replaceInternalImages(html, map), inline };
}

/** A validated payload's html + attachments as MIME-ready parts. */
async function materialize(deps, userId, payload) {
  const cache = new Map();
  const attachments = await resolveAttachments(deps, userId, payload.attachments, cache);
  const { html, inline } = await resolveInlineImages(deps, userId, payload.html, cache);
  return { payload: { ...payload, html }, attachments: [...attachments, ...inline] };
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
  const { payload: ready, attachments } = await materialize(deps, account.user_id, normalized);
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
      const { same, other } = splitByAccount(deps.db, account, chain);
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
