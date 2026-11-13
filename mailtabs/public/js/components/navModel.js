// Pure helpers for navigation: folder trees, folder metadata, selection ranges.
// No imports and no DOM access, so they can be unit-tested in Node.

export const SPECIAL = Object.freeze({
  inbox: '\\Inbox',
  drafts: '\\Drafts',
  sent: '\\Sent',
  archive: '\\Archive',
  all: '\\All',
  junk: '\\Junk',
  trash: '\\Trash',
  flagged: '\\Flagged',
  important: '\\Important',
});

// Order of special folders at the top of an account's tree.
const SPECIAL_RANK = ['\\Inbox', '\\Drafts', '\\Sent', '\\Archive', '\\All', '\\Junk', '\\Trash', '\\Flagged', '\\Important'];

// Gmail's virtual views of other folders: you can open them, but moving mail "into" them means nothing.
const VIRTUAL = new Set(['\\Flagged', '\\Important']);
// Received mail filed into Drafts would reopen as a draft in the composer: not a move target.
const NOT_TARGETS = new Set([...VIRTUAL, '\\Drafts']);

const ICONS = {
  '\\Inbox': 'inbox',
  '\\Drafts': 'draft',
  '\\Sent': 'send',
  '\\Archive': 'archive',
  '\\All': 'layers',
  '\\Junk': 'spam',
  '\\Trash': 'trash',
  '\\Flagged': 'star',
  '\\Important': 'tag',
};

export function isInboxFolder(folder) {
  return !!folder && (folder.specialUse === SPECIAL.inbox || String(folder.path).toUpperCase() === 'INBOX');
}

/** Inbox and special-use folders can't be renamed or deleted (the server refuses too). */
export function isProtectedFolder(folder) {
  return !!folder && (!!folder.specialUse || isInboxFolder(folder));
}

export function canEmptyFolder(folder) {
  return !!folder && (folder.specialUse === SPECIAL.trash || folder.specialUse === SPECIAL.junk);
}

export function folderIcon(folder) {
  if (!folder) return 'folder';
  return ICONS[folder.specialUse] || (isInboxFolder(folder) ? 'inbox' : 'folder');
}

export function folderLabel(folder) {
  if (!folder) return '';
  if (isInboxFolder(folder)) return 'Inbox';
  return folder.name || folder.path;
}

/** "Clients › Northwind" for nested folders, else the plain name. */
export function folderPathLabel(folder) {
  if (!folder) return '';
  if (isInboxFolder(folder) || folder.specialUse || !folder.parentPath || !folder.delimiter) return folderLabel(folder);
  return folder.path.split(folder.delimiter).filter(Boolean).join(' › ');
}

/** The number shown next to a folder: drafts count everything, Sent/Trash/All show nothing. */
export function folderBadge(folder) {
  if (!folder || !folder.selectable) return 0;
  const use = folder.specialUse;
  if (use === SPECIAL.drafts) return folder.totalCount || 0;
  if (use === SPECIAL.sent || use === SPECIAL.trash || use === SPECIAL.all || use === SPECIAL.flagged || use === SPECIAL.important) return 0;
  return folder.unreadCount || 0;
}

function rankOf(folder) {
  const i = SPECIAL_RANK.indexOf(folder.specialUse);
  if (i >= 0) return i;
  return isInboxFolder(folder) ? 0 : SPECIAL_RANK.length;
}

function byName(a, b) {
  return folderLabel(a.folder).localeCompare(folderLabel(b.folder), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Build one account's folder tree. Special folders are lifted to the top level (so Gmail's
 * "[Gmail]/Sent Mail" sits next to Inbox), everything else nests by parentPath, and
 * non-selectable containers that end up empty (like "[Gmail]") are dropped.
 * Returns [{ folder, children: [...] }].
 */
export function buildFolderTree(folders) {
  const list = Array.isArray(folders) ? folders.filter(Boolean) : [];
  const nodes = new Map(list.map((f) => [f.path, { folder: f, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const f = node.folder;
    const parent = f.parentPath != null ? nodes.get(f.parentPath) : null;
    if (f.specialUse || isInboxFolder(f) || !parent || parent === node) roots.push(node);
    else parent.children.push(node);
  }
  const prune = (arr) =>
    arr.filter((n) => {
      n.children = prune(n.children);
      return n.folder.selectable !== false || n.children.length > 0;
    });
  const sortDeep = (arr) => {
    arr.sort(byName);
    for (const n of arr) sortDeep(n.children);
    return arr;
  };
  const kept = prune(roots);
  const special = kept.filter((n) => rankOf(n.folder) < SPECIAL_RANK.length).sort((a, b) => rankOf(a.folder) - rankOf(b.folder) || byName(a, b));
  for (const n of special) sortDeep(n.children);
  const custom = sortDeep(kept.filter((n) => rankOf(n.folder) >= SPECIAL_RANK.length));
  return [...special, ...custom];
}

/** Visible rows of a tree given the set of collapsed folder ids: [{ folder, depth, hasChildren, expanded }]. */
export function flattenTree(nodes, isCollapsed = () => false, depth = 0, out = []) {
  for (const n of nodes) {
    const hasChildren = n.children.length > 0;
    const expanded = hasChildren && !isCollapsed(n.folder.id);
    out.push({ folder: n.folder, depth, hasChildren, expanded });
    if (expanded) flattenTree(n.children, isCollapsed, depth + 1, out);
  }
  return out;
}

/** Folders a message of `accountId` can be moved to, best first (Inbox, specials, then A–Z). */
export function moveTargets(folders, accountId, { excludeFolderId = null } = {}) {
  const own = (folders || []).filter((f) => f.accountId === accountId && f.selectable !== false && !NOT_TARGETS.has(f.specialUse) && f.id !== excludeFolderId);
  return own.sort((a, b) => rankOf(a) - rankOf(b) || folderPathLabel(a).localeCompare(folderPathLabel(b), undefined, { numeric: true, sensitivity: 'base' }));
}

/** Case-insensitive match on the folder's name or full path (for the Move dialog search). */
export function folderMatches(folder, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return folderLabel(folder).toLowerCase().includes(q) || String(folder.path || '').toLowerCase().includes(q);
}

/** Where new folders may be created inside an account (none of Gmail's system containers). */
export function parentOptions(folders, accountId) {
  return (folders || [])
    .filter((f) => f.accountId === accountId && !f.specialUse && !isInboxFolder(f) && !/^\[gmail\]/i.test(f.path) && !/^\[google mail\]/i.test(f.path))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
}

/**
 * Client-side check of a new folder name ('' when fine). The server checks again; this only
 * catches mistakes early: empty names, the hierarchy separator, duplicates among siblings.
 */
export function validateFolderName(name, { delimiter = '/', siblings = [], current = null } = {}) {
  const n = String(name || '').trim();
  if (!n) return 'Enter a folder name.';
  if (n.length > 100) return 'Use at most 100 characters.';
  if (/[\u0000-\u001f\u007f]/.test(n)) return "Folder names can't contain control characters.";
  if (delimiter && n.includes(delimiter)) return `Folder names can't contain “${delimiter}” (it separates folders on this server).`;
  if (n === '.' || n === '..') return 'Choose a different name.';
  if (/^inbox$/i.test(n)) return '“Inbox” is reserved. Choose a different name.';
  const lower = n.toLowerCase();
  if (siblings.some((s) => s && s !== current && String(s).toLowerCase() === lower)) return 'A folder with that name already exists here.';
  return '';
}

/**
 * New selection after clicking `id` (with Shift: a range from the anchor, set to the anchor's
 * state). Keeps list order. Returns { selected, anchor }.
 */
export function nextSelection({ order, selected, anchor }, id, { range = false } = {}) {
  const ids = Array.isArray(order) ? order : [];
  const set = new Set(selected || []);
  if (range && anchor != null && ids.includes(anchor) && ids.includes(id)) {
    const a = ids.indexOf(anchor);
    const b = ids.indexOf(id);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const on = set.has(anchor);
    for (const x of ids.slice(lo, hi + 1)) {
      if (on) set.add(x);
      else set.delete(x);
    }
    return { selected: ids.filter((x) => set.has(x)), anchor };
  }
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return { selected: ids.filter((x) => set.has(x)), anchor: id };
}
