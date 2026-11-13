'use strict';

/**
 * Folder bookkeeping: one `folders` row per IMAP mailbox of an account.
 *
 * Pure database + classification helpers (no IMAP here). The sync engine feeds LIST results
 * into upsertFolders(); actions.js uses the rename/remove helpers after changing the server.
 *
 * Rows use AUTOINCREMENT ids (see db.js): a sync still holding the id of a folder that was
 * deleted can never write into a different folder that happens to get the same id.
 */

// Every special use we store, in its canonical spelling.
const SPECIAL_USES = ['\\Inbox', '\\Sent', '\\Drafts', '\\Trash', '\\Junk', '\\Archive', '\\All', '\\Flagged', '\\Important'];
const CANONICAL_SPECIAL_USE = new Map(SPECIAL_USES.map((s) => [s.toLowerCase(), s]));

// Well-known folder names for servers that do not flag their special folders: English (incl.
// Yahoo's 'Draft' and 'Bulk', Exchange's 'Sent Items' / 'Deleted Items' / 'Junk Email'), German,
// French, Spanish, Italian, Portuguese and Dutch (webmail and Exchange spellings). Compared in
// lower case, NFC. imapflow's own (larger) name tables are used as well — see classifyFolder.
const NAMES_BY_SPECIAL_USE = {
  '\\Sent': [
    'sent', 'sent items', 'sent messages', 'sent mail',
    'gesendet', 'gesendete elemente', 'gesendete objekte', 'gesendete nachrichten',
    'envoyés', 'envoyes', 'éléments envoyés', 'elements envoyes', 'messages envoyés',
    'enviados', 'elementos enviados', 'mensajes enviados',
    'posta inviata', 'inviata', 'inviati', 'elementi inviati', 'messaggi inviati',
    'itens enviados', 'mensagens enviadas',
    'verzonden', 'verzonden items', 'verzonden berichten',
  ],
  '\\Drafts': [
    'drafts', 'draft',
    'entwürfe', 'entwurf',
    'brouillons',
    'borradores',
    'bozze',
    'rascunhos',
    'concepten',
  ],
  '\\Junk': [
    'junk', 'junk e-mail', 'junk email', 'junk mail', 'spam', 'bulk', 'bulk mail',
    'spamverdacht', 'junk-e-mail', 'unerwünscht',
    'courrier indésirable', 'courrier indesirable', 'indésirables', 'pourriel',
    'correo no deseado', 'correo electrónico no deseado',
    'posta indesiderata',
    'lixo eletrônico', 'lixo eletrónico', 'e-mail de lixo',
    'ongewenste e-mail', 'ongewenste mail',
  ],
  '\\Trash': [
    'trash', 'deleted', 'deleted items', 'deleted messages', 'bin',
    'gelöscht', 'gelöschte elemente', 'gelöschte objekte', 'papierkorb',
    'corbeille', 'éléments supprimés', 'elements supprimes', 'supprimés',
    'papelera', 'elementos eliminados', 'eliminados',
    'cestino', 'posta eliminata', 'elementi eliminati',
    'lixeira', 'lixo', 'itens excluídos', 'itens eliminados', 'reciclagem',
    'prullenbak', 'verwijderde items', 'verwijderd',
  ],
  '\\Archive': ['archive', 'archives', 'archiv', 'archivio', 'archivo', 'arquivo', 'archief'],
};
const SPECIAL_USE_BY_NAME = new Map(
  Object.entries(NAMES_BY_SPECIAL_USE).flatMap(([use, names]) => names.map((n) => [n.normalize('NFC'), use]))
);

// Exchange (Outlook.com, Microsoft 365, on-premises Exchange) lists its calendars, contacts,
// tasks, … as selectable mailboxes. They hold no mail: never synced, not shown, no move targets.
// Top-level names (their subfolders, e.g. Calendar/Birthdays, go with them), English plus the
// localised mailbox languages above.
const EXCHANGE_NON_MAIL_NAMES = new Set(
  [
    'calendar', 'contacts', 'tasks', 'notes', 'journal', 'outbox', 'sync issues', 'conversation history',
    'rss subscriptions', 'rss feeds', 'conversation action settings', 'quick step settings', 'yammer root', 'social activity notifications',
    'kalender', 'kontakte', 'aufgaben', 'notizen', 'postausgang', 'synchronisierungsprobleme', 'unterhaltungsverlauf', 'rss-feeds', 'rss-abonnements',
    'calendrier', 'tâches', 'boîte d\'envoi', 'problèmes de synchronisation', 'historique des conversations', 'flux rss',
    'calendario', 'contactos', 'tareas', 'notas', 'diario', 'bandeja de salida', 'problemas de sincronización', 'historial de conversaciones', 'fuentes rss',
    'contatti', 'attività', 'note', 'posta in uscita', 'problemi di sincronizzazione', 'cronologia conversazioni', 'feed rss',
    'calendário', 'contatos', 'tarefas', 'anotações', 'diário', 'caixa de saída', 'problemas de sincronização', 'histórico de conversa', 'histórico de conversas',
    'agenda', 'contactpersonen', 'taken', 'notities', 'logboek', 'postvak uit', 'synchronisatieproblemen', 'gespreksgeschiedenis',
  ].map((n) => n.normalize('NFC'))
);

// sync_mode values: 'auto' (synced when it changed), 'on_demand' (only while opened), 'hidden'
// (not mail: never synced or shown).
const HIDDEN = 'hidden';

// Virtual "every message again" folders: only synced while the user is looking at them.
const ON_DEMAND_SPECIAL_USES = new Set(['\\All', '\\Flagged', '\\Important']);
// The Gmail system folders that hold mail of their own (the rest of [Gmail]/… are views).
const GMAIL_SYNCED_SPECIAL_USES = new Set(['\\Sent', '\\Drafts', '\\Junk', '\\Trash']);
const GMAIL_SYSTEM_PREFIX = /^\[(?:gmail|google mail)\]/i;

// A hostile or broken server must not be able to fill the database with folders.
const MAX_FOLDERS_PER_ACCOUNT = 2000;
const MAX_PATH_LENGTH = 1000;

// Sidebar order: Inbox, Drafts, Sent, Archive, Junk, Trash, then everything else by path.
const DISPLAY_ORDER = ['\\Inbox', '\\Drafts', '\\Sent', '\\Archive', '\\Junk', '\\Trash'];

function lowerFlags(flags) {
  return new Set([...(flags || [])].map((f) => String(f).toLowerCase()));
}

/** Path segments by the hierarchy delimiter (a flat server has one segment per folder). */
function segmentsOf(path, delimiter) {
  return delimiter ? String(path).split(delimiter) : [String(path)];
}

/**
 * Name-based guesses are only trusted near the top of the tree ("Sent", or "INBOX.Sent" on
 * servers that keep every folder under INBOX): a user's "Clients/Archive" is just a folder.
 */
function isShallow(segments) {
  return segments.length === 1 || (segments.length === 2 && segments[0].toUpperCase() === 'INBOX');
}

function nameKey(name) {
  return String(name || '').trim().toLowerCase().normalize('NFC');
}

/** An Exchange calendar/contacts/tasks/… folder (or one below it)? */
function isExchangeNonMail(segments) {
  return EXCHANGE_NON_MAIL_NAMES.has(nameKey(segments[0]));
}

/**
 * Describe one imapflow LIST entry as a folder row.
 * Special use: the server's SPECIAL-USE attributes first (imapflow's pick when it came from the
 * extension, else the entry's own flags — Exchange sends them without announcing SPECIAL-USE),
 * then well-known names (imapflow's localised tables, then ours) — names only near the top of
 * the tree and never on Gmail, where a label merely named "Archive" or "Spam" is just a label.
 * @param {object} entry imapflow list() entry ({ path, name, delimiter, parentPath, flags, specialUse, specialUseSource })
 * @param {{ isGmail?: boolean, isExchange?: boolean }} options isExchange: hide calendar/contacts/… folders
 * @returns {{ path, name, delimiter, parentPath, specialUse, selectable, syncMode, specialUseSource }}
 *   specialUseSource is 'server' (flagged by the server) or 'name' (guessed from the name) or null.
 */
function classifyFolder(entry, { isGmail = false, isExchange = false } = {}) {
  const path = String((entry && entry.path) || '');
  const delimiter = entry && entry.delimiter ? String(entry.delimiter) : null;
  const flags = lowerFlags(entry && entry.flags);
  const segments = segmentsOf(path, delimiter);
  const isInbox = path.toUpperCase() === 'INBOX';

  let specialUse = null;
  let specialUseSource = null;
  if (isInbox) {
    specialUse = '\\Inbox';
    specialUseSource = 'server';
  } else {
    const namesTrusted = !isGmail && isShallow(segments);
    const picked = entry && entry.specialUse ? CANONICAL_SPECIAL_USE.get(String(entry.specialUse).toLowerCase()) : null;
    const pickedFromServer = !!entry && (entry.specialUseSource === 'extension' || entry.specialUseSource === 'user');
    // 1. Declared by the server (or configured by the user): imapflow's pick, then the flags.
    if (picked && picked !== '\\Inbox' && pickedFromServer) {
      specialUse = picked;
      specialUseSource = 'server';
    } else {
      const flag = SPECIAL_USES.find((s) => s !== '\\Inbox' && flags.has(s.toLowerCase()));
      if (flag) {
        specialUse = flag;
        specialUseSource = 'server';
      }
    }
    // 2. Guessed from the name.
    if (!specialUse && namesTrusted) {
      const byName = (picked && picked !== '\\Inbox' ? picked : null) || SPECIAL_USE_BY_NAME.get(nameKey(segments[segments.length - 1]));
      if (byName) {
        specialUse = byName;
        specialUseSource = 'name';
      }
    }
  }

  const name = isInbox ? 'Inbox' : (entry && entry.name) || segments[segments.length - 1] || path;
  let parentPath = entry && typeof entry.parentPath === 'string' ? entry.parentPath : segments.slice(0, -1).join(delimiter || '');
  if (!parentPath) parentPath = null;

  let syncMode = 'auto';
  if (ON_DEMAND_SPECIAL_USES.has(specialUse)) syncMode = 'on_demand';
  else if (isGmail && GMAIL_SYSTEM_PREFIX.test(path) && !GMAIL_SYNCED_SPECIAL_USES.has(specialUse)) syncMode = 'on_demand';
  else if (isExchange && !isInbox && specialUseSource !== 'server' && isExchangeNonMail(segments)) {
    syncMode = HIDDEN;
    specialUse = null;
    specialUseSource = null;
  }

  return {
    path,
    name: String(name),
    delimiter,
    parentPath,
    specialUse,
    selectable: !(flags.has('\\noselect') || flags.has('\\nonexistent')),
    syncMode,
    specialUseSource,
  };
}

/**
 * A special use guessed from a name never duplicates one the server declared, and two guesses
 * for the same use keep only the shallowest (then alphabetically first) folder.
 */
function dropDuplicateGuesses(classified) {
  const declared = new Set(classified.filter((c) => c.specialUseSource === 'server').map((c) => c.specialUse));
  const guesses = classified
    .filter((c) => c.specialUseSource === 'name')
    .sort((a, b) => segmentsOf(a.path, a.delimiter).length - segmentsOf(b.path, b.delimiter).length || a.path.localeCompare(b.path));
  const taken = new Set();
  for (const c of guesses) {
    if (declared.has(c.specialUse) || taken.has(c.specialUse)) {
      c.specialUse = null;
      c.specialUseSource = null;
      if (c.syncMode === 'on_demand' && !GMAIL_SYSTEM_PREFIX.test(c.path)) c.syncMode = 'auto';
    } else {
      taken.add(c.specialUse);
    }
  }
}

function countOrNull(value) {
  const n = Number(value);
  return value !== undefined && value !== null && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/**
 * Bring an account's folder rows in line with a LIST result.
 * New folders are added, changed ones updated (name, hierarchy, special use, selectability),
 * and folders the server no longer lists are deleted — their messages go with them (cascade).
 * STATUS counts (entry.status.messages / unseen) are stored when present.
 * A listing without INBOX is treated as incomplete: nothing is removed then.
 * @param {{ isGmail?: boolean, isExchange?: boolean }} options see classifyFolder
 * @returns {{ added: number, removed: number, changed: number }}
 */
function upsertFolders(db, accountId, listEntries, { isGmail = false, isExchange = false } = {}) {
  const classified = [];
  const statusByPath = new Map();
  const seen = new Set();
  for (const entry of listEntries || []) {
    if (!entry || typeof entry.path !== 'string' || !entry.path || entry.path.length > MAX_PATH_LENGTH) continue;
    const c = classifyFolder(entry, { isGmail, isExchange });
    if (seen.has(c.path)) continue;
    if (classified.length >= MAX_FOLDERS_PER_ACCOUNT && c.specialUse !== '\\Inbox') continue;
    seen.add(c.path);
    classified.push(c);
    if (entry.status && typeof entry.status === 'object' && !entry.status.error) statusByPath.set(c.path, entry.status);
  }
  dropDuplicateGuesses(classified);
  const complete = classified.some((c) => c.specialUse === '\\Inbox');

  const now = Date.now();
  const existing = new Map(db.prepare('SELECT * FROM folders WHERE account_id = ?').all(accountId).map((r) => [r.path, r]));
  const insert = db.prepare(
    `INSERT INTO folders (account_id, path, name, delimiter, parent_path, special_use, selectable, sync_mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const update = db.prepare(
    'UPDATE folders SET name = ?, delimiter = ?, parent_path = ?, special_use = ?, selectable = ?, sync_mode = ? WHERE id = ?'
  );
  const counts = db.prepare('UPDATE folders SET total_count = ?, unread_count = ? WHERE account_id = ? AND path = ?');
  const remove = db.prepare('DELETE FROM folders WHERE id = ?');
  // A folder recognised as not holding mail (synced before it was hidden): drop what was stored.
  const forgetMessages = db.prepare('DELETE FROM messages WHERE folder_id = ?');
  const forgetState = db.prepare('UPDATE folders SET sync_state = NULL, last_synced_at = NULL, has_older = 0 WHERE id = ?');

  return db.transaction(() => {
    const result = { added: 0, removed: 0, changed: 0 };
    for (const c of classified) {
      const row = existing.get(c.path);
      const selectable = c.selectable ? 1 : 0;
      if (!row) {
        insert.run(accountId, c.path, c.name, c.delimiter, c.parentPath, c.specialUse, selectable, c.syncMode, now);
        result.added += 1;
      } else if (
        row.name !== c.name ||
        row.delimiter !== c.delimiter ||
        row.parent_path !== c.parentPath ||
        row.special_use !== c.specialUse ||
        row.selectable !== selectable ||
        row.sync_mode !== c.syncMode
      ) {
        update.run(c.name, c.delimiter, c.parentPath, c.specialUse, selectable, c.syncMode, row.id);
        if (c.syncMode === HIDDEN && row.sync_mode !== HIDDEN) {
          forgetMessages.run(row.id);
          forgetState.run(row.id);
        }
        result.changed += 1;
      }
      const status = statusByPath.get(c.path);
      if (status) {
        const total = countOrNull(status.messages);
        const unread = countOrNull(status.unseen);
        if (total !== null || unread !== null) {
          const prev = row || { total_count: 0, unread_count: 0 };
          counts.run(total ?? prev.total_count, unread ?? prev.unread_count, accountId, c.path);
        }
      }
    }
    if (complete) {
      for (const row of existing.values()) {
        if (!seen.has(row.path)) result.removed += remove.run(row.id).changes;
      }
    }
    return result;
  })();
}

/** A folder row by id, or undefined. */
function getFolder(db, folderId) {
  const id = Number(folderId);
  if (!Number.isSafeInteger(id) || id < 1) return undefined;
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
}

/** The folder row (with user_id) if it belongs to one of the user's accounts, else null. */
function folderForUser(db, userId, folderId) {
  const id = Number(folderId);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return (
    db
      .prepare('SELECT f.*, a.user_id AS user_id FROM folders f JOIN accounts a ON a.id = f.account_id WHERE f.id = ? AND a.user_id = ?')
      .get(id, userId) || null
  );
}

/** The account's folder with that special use ('\\Sent', '\\Trash', …), or null. Shallowest first. */
function findSpecialFolder(db, accountId, specialUse) {
  const wanted = CANONICAL_SPECIAL_USE.get(String(specialUse || '').toLowerCase());
  if (!wanted) return null;
  return (
    db
      .prepare(
        `SELECT * FROM folders WHERE account_id = ? AND special_use = ?
          ORDER BY selectable DESC, length(path) - length(replace(path, COALESCE(delimiter, ''), '')), path, id LIMIT 1`
      )
      .get(accountId, wanted) || null
  );
}

/**
 * The account's INBOX row, created when it is missing (accounts start without folder rows;
 * the first sync's LIST fills them in). Returns null when the account does not exist.
 */
function inboxFolder(db, accountId) {
  const find = () =>
    db
      .prepare("SELECT * FROM folders WHERE account_id = ? AND (special_use = ? OR path = 'INBOX') ORDER BY path = 'INBOX' DESC, id LIMIT 1")
      .get(accountId, '\\Inbox');
  const row = find();
  if (row) return row;
  if (!db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(accountId)) return null;
  db.prepare(
    `INSERT OR IGNORE INTO folders (account_id, path, name, special_use, selectable, sync_mode, created_at)
     VALUES (?, 'INBOX', 'Inbox', ?, 1, 'auto', ?)`
  ).run(accountId, '\\Inbox', Date.now());
  return find() || null;
}

/** Public JSON for a folder row. `unreadLocal` (optional) replaces the server's UNSEEN count. */
function folderJson(row, { unreadLocal } = {}) {
  return {
    id: row.id,
    accountId: row.account_id,
    path: row.path,
    name: row.name,
    parentPath: row.parent_path || null,
    delimiter: row.delimiter || null,
    specialUse: row.special_use || null,
    selectable: !!row.selectable,
    syncMode: row.sync_mode,
    totalCount: Number(row.total_count) || 0,
    unreadCount: Number.isFinite(unreadLocal) ? unreadLocal : Number(row.unread_count) || 0,
    hasOlder: !!row.has_older,
    lastSyncedAt: row.last_synced_at ?? null,
  };
}

/** Folder rows in sidebar order (see DISPLAY_ORDER). Returns a new array. */
function sortFolders(rows) {
  const rank = (row) => {
    const i = DISPLAY_ORDER.indexOf(row.special_use);
    return i === -1 ? DISPLAY_ORDER.length : i;
  };
  // Two folders with the same special use: the shallower one (the main one) first.
  const depth = (row) => (rank(row) < DISPLAY_ORDER.length ? segmentsOf(row.path, row.delimiter).length : 0);
  return [...rows].sort((a, b) => rank(a) - rank(b) || depth(a) - depth(b) || String(a.path).localeCompare(String(b.path)) || a.id - b.id);
}

/** Rows of `path` and of every folder below it. */
function subtreeRows(db, accountId, path) {
  return db
    .prepare('SELECT * FROM folders WHERE account_id = ?')
    .all(accountId)
    .filter((row) => row.path === path || (row.delimiter && row.path.startsWith(path + row.delimiter)));
}

/**
 * After a successful RENAME on the server: move the folder and everything below it to the new
 * path, keeping their ids, sync state and messages (messages.mailbox follows the folder path).
 * Stale rows already sitting at a target path are dropped first (the server just proved that
 * nothing is there). Returns the number of folder rows renamed.
 */
function renameFolderLocal(db, accountId, oldPath, newPath) {
  if (oldPath === newPath) return 0;
  return db.transaction(() => {
    const moving = subtreeRows(db, accountId, oldPath);
    if (!moving.length) return 0;
    const targetOf = (path) => newPath + path.slice(oldPath.length);
    const movingIds = new Set(moving.map((r) => r.id));
    const stale = db.prepare('SELECT id FROM folders WHERE account_id = ? AND path = ?');
    const drop = db.prepare('DELETE FROM folders WHERE id = ?');
    for (const row of moving) {
      const other = stale.get(accountId, targetOf(row.path));
      if (other && !movingIds.has(other.id)) drop.run(other.id);
    }
    // Two passes through a temporary path so swapping names inside the subtree can't collide
    // with the UNIQUE(account_id, path) constraint half-way.
    const setPath = db.prepare('UPDATE folders SET path = ? WHERE id = ?');
    for (const row of moving) setPath.run(`\uffffmailtabs-rename-${row.id}`, row.id);
    const finish = db.prepare('UPDATE folders SET path = ?, name = ?, parent_path = ? WHERE id = ?');
    const syncMailbox = db.prepare('UPDATE messages SET mailbox = ? WHERE folder_id = ?');
    for (const row of moving) {
      const path = targetOf(row.path);
      const segments = segmentsOf(path, row.delimiter);
      const name = row.special_use === '\\Inbox' ? row.name : segments[segments.length - 1] || path;
      const parentPath = segments.length > 1 ? segments.slice(0, -1).join(row.delimiter) : null;
      finish.run(path, name, parentPath, row.id);
      syncMailbox.run(path, row.id);
    }
    return moving.length;
  })();
}

/** After a DELETE on the server: drop the folder and its subfolders (their messages cascade). */
function removeFolderLocal(db, accountId, path) {
  return db.transaction(() => {
    const drop = db.prepare('DELETE FROM folders WHERE id = ?');
    let n = 0;
    for (const row of subtreeRows(db, accountId, path)) n += drop.run(row.id).changes;
    return n;
  })();
}

/** Is this folder row one of Exchange's non-mail folders (never synced, shown or moved into)? */
function isHiddenFolder(row) {
  return !!row && row.sync_mode === HIDDEN;
}

module.exports = {
  classifyFolder,
  upsertFolders,
  getFolder,
  folderForUser,
  findSpecialFolder,
  inboxFolder,
  folderJson,
  // extras for the engine and routes
  sortFolders,
  renameFolderLocal,
  removeFolderLocal,
  isHiddenFolder,
  SPECIAL_USES,
  MAX_FOLDERS_PER_ACCOUNT,
  HIDDEN_SYNC_MODE: HIDDEN,
};
