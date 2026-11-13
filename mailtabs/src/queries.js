'use strict';

/**
 * Read-side SQL for the API: which messages belong to a tab, search, paging, counts, and the
 * row -> JSON mappers.
 *
 * Every function takes the signed-in user's id and scopes its SQL to that user's accounts, so a
 * route can never accidentally return another user's data by passing the wrong id.
 */

const { HttpError } = require('./errors');
const { nextPaletteColor } = require('./palette');
const smtp = require('./smtp');
const folders = require('./folders');

const DEFAULT_COLOR = '#4f46e5';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_SEARCH_TERMS = 20;
const MAX_SEARCH_LENGTH = 500;
const MAX_CURSOR_LENGTH = 200;

// Columns a message list needs. Bodies are deliberately left out (they can be megabytes).
const LIST_COLUMNS = [
  'm.id', 'm.account_id', 'm.folder_id', 'm.from_name', 'm.from_address', 'm.to_json', 'm.subject', 'm.snippet', 'm.date',
  'm.is_read', 'm.is_starred', 'm.is_answered', 'm.is_draft', 'm.has_attachments', 'm.thread_key',
].join(', ');
// List rows of Sent / Drafts name their recipients; a few are enough for one line.
const LIST_RECIPIENTS_MAX = 10;

// Unified views across all of a user's accounts (GET /api/messages?view=...).
const VIEWS = ['starred', 'sent', 'drafts', 'junk', 'trash'];
const VIEW_SPECIAL_USE = Object.freeze({ sent: '\\Sent', drafts: '\\Drafts', junk: '\\Junk', trash: '\\Trash' });
// Starred leaves out mail on its way out (Trash, Spam) and Gmail's views, whose messages are
// copies of mail that lives in another folder.
const STARRED_EXCLUDED_SPECIAL_USES = ['\\Trash', '\\Junk', '\\All', '\\Flagged', '\\Important'];

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

function parseJson(text, fallback) {
  if (text === null || text === undefined || text === '') return fallback;
  if (typeof text !== 'string') return text;
  try {
    const value = JSON.parse(text);
    return value === null || value === undefined ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

/** Escape LIKE wildcards so user text is matched literally (used with ESCAPE '\'). */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function containsPattern(value) {
  return `%${escapeLike(value)}%`;
}

function placeholders(n) {
  return new Array(n).fill('?').join(', ');
}

// ---------------------------------------------------------------------------------------------
// Tab rules
// ---------------------------------------------------------------------------------------------

const RULE_FIELDS = ['from', 'to', 'subject', 'body'];
const RULE_OPS = ['contains', 'not_contains'];

/**
 * A tab's rules as stored (JSON text) or already parsed -> { match, conditions } | null.
 * Anything malformed is dropped rather than thrown: a bad row must not break the whole inbox.
 */
function parseRules(raw) {
  const rules = parseJson(raw, null);
  if (!rules || typeof rules !== 'object' || !Array.isArray(rules.conditions)) return null;
  const conditions = rules.conditions
    .filter(
      (c) =>
        c &&
        RULE_FIELDS.includes(c.field) &&
        RULE_OPS.includes(c.op) &&
        typeof c.value === 'string' &&
        c.value.trim() !== ''
    )
    .map((c) => ({ field: c.field, op: c.op, value: c.value.trim() }));
  if (!conditions.length) return null;
  return { match: rules.match === 'any' ? 'any' : 'all', conditions };
}

// A safe view of an address list column: malformed JSON reads as an empty list instead of
// making json_each() raise an error for the whole query.
const addressList = (column) => `json_each(CASE WHEN json_valid(${column}) THEN ${column} ELSE '[]' END)`;

/**
 * SQL for one "contains" test. Every column is COALESCEd so the expression is never NULL,
 * which keeps NOT (...) (not_contains) and AND/OR combinations two-valued: a message with no
 * subject does "not contain" anything.
 */
function conditionSql({ field, value }) {
  const p = containsPattern(value);
  switch (field) {
    case 'from':
      return {
        sql: "(COALESCE(m.from_name, '') LIKE ? ESCAPE '\\' OR COALESCE(m.from_address, '') LIKE ? ESCAPE '\\')",
        params: [p, p],
      };
    case 'to':
      // Recipients are stored as JSON [{name, address}]. Matching inside the values (not the
      // raw JSON text) means "name"/"address" keys and JSON escaping never cause false hits.
      // "To" covers Cc as well, like the to: operator in Gmail's search.
      return {
        sql:
          `(EXISTS (SELECT 1 FROM ${addressList('m.to_json')} r WHERE COALESCE(json_extract(r.value, '$.name'), '') LIKE ? ESCAPE '\\' OR COALESCE(json_extract(r.value, '$.address'), '') LIKE ? ESCAPE '\\')` +
          ` OR EXISTS (SELECT 1 FROM ${addressList('m.cc_json')} r WHERE COALESCE(json_extract(r.value, '$.name'), '') LIKE ? ESCAPE '\\' OR COALESCE(json_extract(r.value, '$.address'), '') LIKE ? ESCAPE '\\'))`,
        params: [p, p, p, p],
      };
    case 'subject':
      return { sql: "COALESCE(m.subject, '') LIKE ? ESCAPE '\\'", params: [p] };
    case 'body':
      return {
        sql: "(COALESCE(m.snippet, '') LIKE ? ESCAPE '\\' OR COALESCE(m.text_body, '') LIKE ? ESCAPE '\\')",
        params: [p, p],
      };
    default:
      return null;
  }
}

/** SQL for a whole rule set, or null when it does not filter anything. */
function rulesSql(rules) {
  const parsed = parseRules(rules);
  if (!parsed) return null;
  const parts = [];
  const params = [];
  for (const condition of parsed.conditions) {
    const c = conditionSql(condition);
    if (!c) continue;
    parts.push(condition.op === 'not_contains' ? `NOT ${c.sql}` : c.sql);
    params.push(...c.params);
  }
  if (!parts.length) return null;
  return { sql: `(${parts.join(parsed.match === 'any' ? ' OR ' : ' AND ')})`, params };
}

// ---------------------------------------------------------------------------------------------
// Tab membership
// ---------------------------------------------------------------------------------------------

const INBOX_SPECIAL_USE = '\\Inbox';

/**
 * WHERE fragment (on alias `alias`) for "this message is in the INBOX of one of the user's
 * accounts" — tabs and their counts only ever mean the inbox. A row without a folder (written
 * before folders existed) counts by its mailbox name.
 */
function inboxOnlySql(alias, userId) {
  return {
    sql:
      `(${alias}.folder_id IN (SELECT f.id FROM folders f JOIN accounts fa ON fa.id = f.account_id WHERE fa.user_id = ? AND f.special_use = ?)` +
      ` OR (${alias}.folder_id IS NULL AND ${alias}.mailbox = 'INBOX'))`,
    params: [userId, INBOX_SPECIAL_USE],
  };
}

/**
 * WHERE fragment (on alias `m`) selecting the messages of a tab, or of "All inboxes" when
 * `tab` is null. A message belongs to tab T iff its account is the user's AND it is in that
 * account's INBOX AND (T.all_accounts OR the account is attached to T) AND T's rules match.
 */
function tabFilterSql(db, userId, tab) {
  const inbox = inboxOnlySql('m', userId);
  const where = ['m.account_id IN (SELECT a.id FROM accounts a WHERE a.user_id = ?)', inbox.sql];
  const params = [userId, ...inbox.params];
  if (tab) {
    if (Number(tab.user_id) !== Number(userId)) {
      // Never reached through the routes (they look tabs up by user), but be safe.
      return { where: '0', params: [] };
    }
    if (!tab.all_accounts) {
      where.push(
        'm.account_id IN (SELECT ta.account_id FROM tab_accounts ta JOIN accounts a2 ON a2.id = ta.account_id WHERE ta.tab_id = ? AND a2.user_id = ?)'
      );
      params.push(tab.id, userId);
    }
    const rules = rulesSql(tab.rules);
    if (rules) {
      where.push(rules.sql);
      params.push(...rules.params);
    }
  }
  return { where: where.join(' AND '), params };
}

/** The user's tab row, null for 'all' / empty, or HttpError 404 when it is not theirs. */
function resolveTab(db, userId, tabId) {
  if (tabId === undefined || tabId === null || tabId === '' || tabId === 'all') return null;
  const id = Number(tabId);
  const row = Number.isSafeInteger(id) && id > 0 ? db.prepare('SELECT * FROM tabs WHERE id = ? AND user_id = ?').get(id, userId) : null;
  if (!row) throw new HttpError(404, 'Tab not found', 'NOT_FOUND');
  return row;
}

// ---------------------------------------------------------------------------------------------
// Folders and unified views
// ---------------------------------------------------------------------------------------------

const USER_ACCOUNTS_SQL = 'm.account_id IN (SELECT a.id FROM accounts a WHERE a.user_id = ?)';

/** The user's folder row (with user_id), or HttpError 404. */
function resolveFolder(db, userId, folderId) {
  const id = Number(folderId);
  const row =
    Number.isSafeInteger(id) && id > 0
      ? db.prepare('SELECT f.*, a.user_id AS user_id FROM folders f JOIN accounts a ON a.id = f.account_id WHERE f.id = ? AND a.user_id = ?').get(id, userId)
      : null;
  if (!row) throw new HttpError(404, 'Folder not found', 'NOT_FOUND');
  return row;
}

/**
 * WHERE fragment for one folder. Rows stored before folders existed have no folder_id; they
 * belong to the folder by account + mailbox path.
 */
function folderFilterSql(userId, folder) {
  return {
    where: `${USER_ACCOUNTS_SQL} AND (m.folder_id = ? OR (m.folder_id IS NULL AND m.account_id = ? AND m.mailbox = ?))`,
    params: [userId, folder.id, folder.account_id, folder.path],
  };
}

/** Ids of the user's folders with one of these special uses (SQL subquery + params). */
function specialFoldersSql(userId, specialUses) {
  return {
    sql: `(SELECT f.id FROM folders f JOIN accounts fa ON fa.id = f.account_id WHERE fa.user_id = ? AND f.special_use IN (${placeholders(specialUses.length)}))`,
    params: [userId, ...specialUses],
  };
}

/**
 * WHERE fragment for a unified view. 'starred' = starred messages in any folder except Trash,
 * Spam and Gmail's views, one row per (account, Message-ID) — the lowest id — because Gmail
 * shows a starred message in every label it carries. The others = every folder with that
 * special use, across the user's accounts.
 */
function viewFilterSql(userId, view) {
  if (view === 'starred') {
    const excluded = specialFoldersSql(userId, STARRED_EXCLUDED_SPECIAL_USES);
    return {
      where:
        `${USER_ACCOUNTS_SQL} AND m.is_starred = 1 AND (m.folder_id IS NULL OR m.folder_id NOT IN ${excluded.sql})` +
        ' AND (m.message_id IS NULL OR NOT EXISTS (SELECT 1 FROM messages d WHERE d.account_id = m.account_id' +
        ` AND d.message_id = m.message_id AND d.id < m.id AND d.is_starred = 1 AND (d.folder_id IS NULL OR d.folder_id NOT IN ${excluded.sql})))`,
      params: [userId, ...excluded.params, ...excluded.params],
    };
  }
  const specialUse = VIEW_SPECIAL_USE[view];
  if (!specialUse) throw new HttpError(400, `view must be one of: ${VIEWS.join(', ')}.`, 'INVALID_VIEW');
  const special = specialFoldersSql(userId, [specialUse]);
  return { where: `${USER_ACCOUNTS_SQL} AND m.folder_id IN ${special.sql}`, params: [userId, ...special.params] };
}

/**
 * Which messages a list request is about: exactly one of a tab (or All inboxes), a folder or a
 * unified view. Resolved for the user (404 for someone else's tab/folder).
 * @returns {{ kind: 'tab', tab: object|null } | { kind: 'folder', folder: object } | { kind: 'view', view: string }}
 */
function resolveSource(db, userId, { tabId, folderId, view } = {}) {
  const has = (v) => v !== undefined && v !== null && v !== '';
  const hasTab = has(tabId) && tabId !== 'all';
  if ([hasTab, has(folderId), has(view)].filter(Boolean).length > 1) {
    throw new HttpError(400, 'Use only one of tab, folder or view.', 'INVALID_SOURCE');
  }
  if (has(folderId)) return { kind: 'folder', folder: resolveFolder(db, userId, folderId) };
  if (has(view)) {
    if (!VIEWS.includes(view)) throw new HttpError(400, `view must be one of: ${VIEWS.join(', ')}.`, 'INVALID_VIEW');
    return { kind: 'view', view };
  }
  return { kind: 'tab', tab: resolveTab(db, userId, tabId) };
}

/** WHERE fragment for a resolved source. */
function sourceFilterSql(db, userId, source) {
  if (source.kind === 'folder') {
    if (Number(source.folder.user_id) !== Number(userId)) return { where: '0', params: [] };
    return folderFilterSql(userId, source.folder);
  }
  if (source.kind === 'view') return viewFilterSql(userId, source.view);
  return tabFilterSql(db, userId, source.tab);
}

/** A tab row / null (All inboxes) or an already resolved source -> resolved source. */
function asSource(tabOrSource) {
  return tabOrSource && typeof tabOrSource === 'object' && typeof tabOrSource.kind === 'string' ? tabOrSource : { kind: 'tab', tab: tabOrSource || null };
}

// ---------------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------------

// unicode61 only indexes letters, numbers and private-use characters; a term without any of
// them ("*", "-", "&") can never match and would turn the whole AND query into "no results".
const SEARCHABLE = /[\p{L}\p{N}\p{Co}]/u;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/**
 * Build an FTS5 MATCH expression from free text: every whitespace-separated term becomes a
 * quoted prefix query ("term"*), so FTS syntax in user input (quotes, parentheses, AND/OR/NOT,
 * NEAR, column:, *, -, ^) is always taken literally. Returns null when nothing is searchable.
 */
function buildFtsQuery(q) {
  if (typeof q !== 'string') return null;
  const terms = q
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(CONTROL_CHARS, ' ')
    .split(/\s+/u)
    .filter((t) => t && SEARCHABLE.test(t))
    .slice(0, MAX_SEARCH_TERMS);
  if (!terms.length) return null;
  return terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ');
}

// ---------------------------------------------------------------------------------------------
// Cursor paging
// ---------------------------------------------------------------------------------------------

function encodeCursor(row) {
  return Buffer.from(JSON.stringify([row.date, row.id]), 'utf8').toString('base64url');
}

/** [date, id] from a cursor string, or HttpError 400. */
function decodeCursor(cursor) {
  const fail = () => new HttpError(400, 'Invalid page cursor', 'INVALID_CURSOR');
  if (typeof cursor !== 'string' || cursor.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw fail();
  let value;
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch (_) {
    throw fail();
  }
  if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || !Number.isSafeInteger(value[1]) || value[1] < 1) {
    throw fail();
  }
  return value;
}

function clampLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
}

// ---------------------------------------------------------------------------------------------
// Message listing and counts
// ---------------------------------------------------------------------------------------------

/**
 * WHERE fragment for a list request: the source (tab, folder or view) + optional
 * account/search/unread/starred. `source` is a resolved source (resolveSource), or — as before
 * folders existed — a tab row (already resolved for this user) or null for All inboxes.
 * Returns { where, params, empty } — `empty` means the request can match nothing.
 */
function listFilterSql(db, userId, source, { accountId, q, unread, starred } = {}) {
  const filter = sourceFilterSql(db, userId, asSource(source));
  const where = [filter.where];
  const params = [...filter.params];
  if (accountId !== undefined && accountId !== null && accountId !== '') {
    where.push('m.account_id = ?');
    params.push(Number(accountId));
  }
  if (typeof q === 'string' && q.trim()) {
    const match = buildFtsQuery(q);
    if (!match) return { where: '0', params: [], empty: true };
    where.push('m.id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)');
    params.push(match);
  }
  if (unread) where.push('m.is_read = 0');
  if (starred) where.push('m.is_starred = 1');
  return { where: where.join(' AND '), params, empty: false };
}

function isFtsSyntaxError(err) {
  return !!(err && /fts5|unterminated string|syntax error/i.test(String(err.message)));
}

/**
 * One page of messages, newest first. The source is one of tabId (default All inboxes),
 * folderId or view ('starred' | 'sent' | 'drafts' | 'junk' | 'trash').
 * @param {{ tabId?: number|'all', folderId?: number, view?: string, accountId?: number, q?: string,
 *           unread?: boolean, starred?: boolean, before?: string, limit?: number }} options
 * @returns {{ messages: object[], nextCursor: string|null }}
 */
function listMessages(db, userId, { tabId = 'all', folderId, view, accountId, q, unread, starred, before, limit = DEFAULT_LIMIT } = {}) {
  const source = resolveSource(db, userId, { tabId, folderId, view });
  const pageSize = clampLimit(limit);
  const filter = listFilterSql(db, userId, source, { accountId, q, unread, starred });
  if (filter.empty) return { messages: [], nextCursor: null };

  const where = [filter.where];
  const params = [...filter.params];
  if (before !== undefined && before !== null && before !== '') {
    const [date, id] = decodeCursor(before);
    // Equal dates are common (bulk mail); the id tiebreak keeps pages stable and gap-free.
    // Row-value comparison lets SQLite walk the (date, id) index instead of re-sorting.
    where.push('(m.date, m.id) < (?, ?)');
    params.push(date, id);
  }

  let rows;
  try {
    rows = db
      .prepare(`SELECT ${LIST_COLUMNS} FROM messages m WHERE ${where.join(' AND ')} ORDER BY m.date DESC, m.id DESC LIMIT ?`)
      .all(...params, pageSize + 1);
  } catch (err) {
    // buildFtsQuery quotes everything, so this should be unreachable; but a search box must
    // never turn into a 500, so a query FTS still rejects simply has no results.
    if (q && isFtsSyntaxError(err)) return { messages: [], nextCursor: null };
    throw err;
  }
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    messages: page.map(toMessageListItem),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
  };
}

/** { unreadCount, totalCount } of a tab (null = All inboxes). */
function countForTab(db, userId, tab) {
  const filter = tabFilterSql(db, userId, tab);
  const row = db
    .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(m.is_read = 0), 0) AS unread FROM messages m WHERE ${filter.where}`)
    .get(...filter.params);
  return { unreadCount: Number(row.unread) || 0, totalCount: Number(row.total) || 0 };
}

/**
 * Minimal rows ({id, account_id, folder_id, mailbox, uid, uid_validity}) of every message in a
 * tab (or a resolved source: folder, view) that matches extra conditions — used by mark-all-read.
 */
function selectTabMessageRefs(db, userId, tab, { unread, q, starred, accountId } = {}) {
  const filter = listFilterSql(db, userId, tab, { unread, q, starred, accountId });
  if (filter.empty) return [];
  try {
    return db
      .prepare(`SELECT m.id, m.account_id, m.folder_id, m.mailbox, m.uid, m.uid_validity FROM messages m WHERE ${filter.where} ORDER BY m.id`)
      .all(...filter.params);
  } catch (err) {
    if (q && isFtsSyntaxError(err)) return [];
    throw err;
  }
}

/** The full message row if it belongs to one of the user's accounts, else null. */
function getMessageForUser(db, userId, messageId) {
  const id = Number(messageId);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return (
    db
      .prepare('SELECT m.* FROM messages m JOIN accounts a ON a.id = m.account_id WHERE m.id = ? AND a.user_id = ?')
      .get(id, userId) || null
  );
}

/** Full message rows for several ids, keeping only the user's. */
function getMessagesForUser(db, userId, ids) {
  const clean = [...new Set((ids || []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
  const out = [];
  for (let i = 0; i < clean.length; i += 500) {
    const batch = clean.slice(i, i + 500);
    out.push(
      ...db
        .prepare(
          `SELECT m.* FROM messages m JOIN accounts a ON a.id = m.account_id WHERE a.user_id = ? AND m.id IN (${placeholders(batch.length)})`
        )
        .all(userId, ...batch)
    );
  }
  return out;
}

/** The full account row (including secret_enc — internal use only, never send it) or null. */
function getAccountRowForUser(db, userId, accountId) {
  const id = Number(accountId);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, userId) || null;
}

// ---------------------------------------------------------------------------------------------
// Row -> JSON mappers
// ---------------------------------------------------------------------------------------------

function toMessageListItem(row) {
  const to = addressesFrom(row.to_json);
  return {
    id: row.id,
    accountId: row.account_id,
    folderId: row.folder_id ?? null,
    fromName: row.from_name || null,
    fromAddress: row.from_address || null,
    to: to.slice(0, LIST_RECIPIENTS_MAX),
    toCount: to.length,
    subject: row.subject ?? null,
    snippet: row.snippet ?? null,
    date: row.date,
    isRead: !!row.is_read,
    isStarred: !!row.is_starred,
    isAnswered: !!row.is_answered,
    isDraft: !!row.is_draft,
    hasAttachments: !!row.has_attachments,
    threadKey: row.thread_key ?? null,
  };
}

function addressesFrom(json) {
  const list = parseJson(json, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({ name: typeof a.name === 'string' ? a.name : '', address: typeof a.address === 'string' ? a.address : '' }));
}

function toMessageDetail(row) {
  const attachments = parseJson(row.attachments_json, []);
  return {
    ...toMessageListItem(row),
    to: addressesFrom(row.to_json),
    cc: addressesFrom(row.cc_json),
    replyTo: addressesFrom(row.reply_to_json),
    messageId: row.message_id || null,
    bodyState: row.body_state,
    hasHtml: !!(row.html_body && String(row.html_body).trim()),
    remoteImageCount: Number(row.remote_image_count) || 0,
    attachments: (Array.isArray(attachments) ? attachments : [])
      .filter((a) => a && Number.isInteger(a.index))
      .map((a) => ({
        index: a.index,
        filename: a.filename || `attachment-${a.index + 1}`,
        contentType: a.contentType || 'application/octet-stream',
        size: Number.isFinite(a.size) ? a.size : null,
        inline: !!a.inline,
      })),
  };
}

// Without the app's crypto/config (unit tests), sending status is judged from the row alone:
// an unreadable OAuth secret means "scopes unknown" (Google: can send; Microsoft: reconnect).
const NO_SECRETS_DEPS = Object.freeze({
  config: {},
  crypto: Object.freeze({
    decryptJson() {
      throw new Error('no crypto');
    },
  }),
});

/** { canSend, code, message } for an account row (see smtp.sendingStatus). */
function sendingStatusFor(row, deps) {
  try {
    return smtp.sendingStatus(deps && deps.config && deps.crypto ? deps : NO_SECRETS_DEPS, row);
  } catch (_) {
    return { canSend: false, code: 'SMTP_NOT_CONFIGURED', message: 'Sending is not set up for this account yet.' };
  }
}

/**
 * Account JSON. Built field by field so secret_enc / smtp_secret_enc (passwords, tokens) can
 * never slip through. smtp* are the effective outgoing settings (the provider's defaults unless
 * the account has its own).
 */
function toAccountJson(row, { messageCount = 0, unreadCount = 0, tabIds = [], deps } = {}) {
  const outgoing = smtp.smtpSettingsFor(row);
  const sending = sendingStatusFor(row, deps);
  return {
    id: row.id,
    provider: row.provider,
    authType: row.auth_type,
    email: row.email,
    displayName: row.display_name || null,
    color: row.color || DEFAULT_COLOR,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    imapSecurity: row.imap_security,
    imapUser: row.imap_user,
    status: row.status,
    lastError: row.last_error || null,
    lastSyncedAt: row.last_synced_at ?? null,
    createdAt: row.created_at,
    messageCount,
    unreadCount,
    tabIds,
    smtpHost: outgoing.host || null,
    smtpPort: outgoing.host ? outgoing.port : null,
    smtpSecurity: outgoing.host ? outgoing.security : null,
    smtpUser: outgoing.host ? outgoing.user || null : null,
    hasSmtpPassword: !!row.smtp_secret_enc,
    senderName: row.sender_name || null,
    signatureHtml: row.signature_html || '',
    canSend: !!sending.canSend,
    sendBlockedReason: sending.canSend ? null : sending.message || null,
  };
}

function toTabJson(row, { accountIds = [], unreadCount = 0, totalCount = 0 } = {}) {
  return {
    id: row.id,
    name: row.name,
    color: row.color || DEFAULT_COLOR,
    position: row.position,
    allAccounts: !!row.all_accounts,
    accountIds,
    rules: parseRules(row.rules),
    unreadCount,
    totalCount,
  };
}

// ---------------------------------------------------------------------------------------------
// Whole-resource loaders used by the routes
// ---------------------------------------------------------------------------------------------

/**
 * Account JSON for all of a user's accounts (oldest first), or for one id.
 * `deps` ({ config, crypto }) lets canSend look at OAuth grants; optional.
 */
function listAccountsJson(db, userId, { accountId, deps } = {}) {
  const rows = accountId
    ? db.prepare('SELECT * FROM accounts WHERE user_id = ? AND id = ?').all(userId, accountId)
    : db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at, id').all(userId);
  if (!rows.length) return [];

  // Counts are of the inbox, like the tabs (folders carry their own counts).
  const inbox = inboxOnlySql('m', userId);
  const counts = new Map();
  for (const c of db
    .prepare(
      `SELECT m.account_id AS id, COUNT(*) AS total, COALESCE(SUM(m.is_read = 0), 0) AS unread
         FROM messages m JOIN accounts a ON a.id = m.account_id
        WHERE a.user_id = ? AND ${inbox.sql} GROUP BY m.account_id`
    )
    .all(userId, ...inbox.params)) {
    counts.set(c.id, c);
  }

  const tabIds = new Map();
  for (const t of db
    .prepare(
      `SELECT ta.account_id, ta.tab_id FROM tab_accounts ta JOIN tabs t ON t.id = ta.tab_id
        WHERE t.user_id = ? ORDER BY t.position, t.id`
    )
    .all(userId)) {
    if (!tabIds.has(t.account_id)) tabIds.set(t.account_id, []);
    tabIds.get(t.account_id).push(t.tab_id);
  }

  return rows.map((row) => {
    const c = counts.get(row.id);
    return toAccountJson(row, {
      messageCount: c ? Number(c.total) : 0,
      unreadCount: c ? Number(c.unread) : 0,
      tabIds: tabIds.get(row.id) || [],
      deps,
    });
  });
}

function getAccountJson(db, userId, accountId, { deps } = {}) {
  return listAccountsJson(db, userId, { accountId: Number(accountId), deps })[0] || null;
}

function tabAccountIds(db, userId, tabId) {
  return db
    .prepare(
      `SELECT ta.account_id FROM tab_accounts ta JOIN accounts a ON a.id = ta.account_id
        WHERE ta.tab_id = ? AND a.user_id = ? ORDER BY a.created_at, a.id`
    )
    .all(tabId, userId)
    .map((r) => r.account_id);
}

function tabJsonFromRow(db, userId, row) {
  return toTabJson(row, { accountIds: tabAccountIds(db, userId, row.id), ...countForTab(db, userId, row) });
}

/** { tabs: [Tab], all: {unreadCount, totalCount} } for GET /api/tabs. */
function listTabsJson(db, userId) {
  const rows = db.prepare('SELECT * FROM tabs WHERE user_id = ? ORDER BY position, id').all(userId);
  return { tabs: rows.map((row) => tabJsonFromRow(db, userId, row)), all: countForTab(db, userId, null) };
}

function getTabJson(db, userId, tabId) {
  const row = db.prepare('SELECT * FROM tabs WHERE id = ? AND user_id = ?').get(Number(tabId), userId);
  return row ? tabJsonFromRow(db, userId, row) : null;
}

// ---------------------------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------------------------

/**
 * { accounts: [{ accountId, folders: [Folder] }] } for GET /api/folders, accounts in the usual
 * order and folders in sidebar order (Inbox, Drafts, Sent, Archive, Junk, Trash, then by path).
 * Unread counts: for a folder whose every message is stored here, the local count (it follows
 * the user's reads at once); otherwise the server's STATUS count.
 */
function listFoldersJson(db, userId) {
  const accounts = db.prepare('SELECT id FROM accounts WHERE user_id = ? ORDER BY created_at, id').all(userId);
  const rows = db
    .prepare('SELECT f.* FROM folders f JOIN accounts a ON a.id = f.account_id WHERE a.user_id = ? ORDER BY f.account_id, f.id')
    .all(userId);
  const local = new Map(
    db
      .prepare(
        `SELECT m.folder_id AS id, COALESCE(SUM(m.is_read = 0), 0) AS unread FROM messages m JOIN accounts a ON a.id = m.account_id
          WHERE a.user_id = ? AND m.folder_id IS NOT NULL GROUP BY m.folder_id`
      )
      .all(userId)
      .map((r) => [r.id, Number(r.unread) || 0])
  );
  const byAccount = new Map(accounts.map((a) => [a.id, []]));
  for (const row of rows) if (byAccount.has(row.account_id)) byAccount.get(row.account_id).push(row);
  return {
    accounts: accounts.map((a) => ({
      accountId: a.id,
      folders: folders.sortFolders(byAccount.get(a.id)).map((row) => {
        const complete = row.last_synced_at !== null && row.last_synced_at !== undefined && !row.has_older;
        return folders.folderJson(row, complete ? { unreadLocal: local.get(row.id) || 0 } : {});
      }),
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------------------------

const MAX_THREAD_MESSAGES = 100;
// Gmail's views repeat messages stored in other folders; never show those copies.
const THREAD_HIDDEN_SPECIAL_USES = new Set(['\\All', '\\Flagged', '\\Important']);
// Deleted and spam mail only joins a conversation when the opened message is there itself.
const THREAD_OUT_SPECIAL_USES = new Set(['\\Trash', '\\Junk']);
// The copy to show when a message is in several folders (lower wins).
const COPY_RANK = { '\\Inbox': 0, '\\Sent': 1, '\\Archive': 2, '\\Drafts': 4, '\\Trash': 5, '\\Junk': 6 };
const copyRank = (row) => COPY_RANK[row.folder_special_use] ?? 3;

/**
 * The conversation of a message the user may see: same account, same thread_key, plus direct
 * links (the messages it references / that reply to it, for mail without a full References
 * chain). One row per Message-ID, oldest first, at most 100 (the newest ones, always including
 * the opened message). Rows carry folder_special_use / folder_name.
 */
function threadMessages(db, userId, row) {
  if (!row || !db.prepare('SELECT 1 FROM accounts WHERE id = ? AND user_id = ?').get(row.account_id, userId)) return [];
  const refs = parseJson(row.references_json, []);
  const linked = [...new Set([...(Array.isArray(refs) ? refs.slice(-50) : []), row.in_reply_to].filter((v) => typeof v === 'string' && v))];
  const conditions = ['m.id = ?'];
  const params = [row.id];
  if (row.thread_key) {
    conditions.push('m.thread_key = ?');
    params.push(row.thread_key);
  }
  if (linked.length) {
    conditions.push(`m.message_id IN (${placeholders(linked.length)})`);
    params.push(...linked);
  }
  if (row.message_id) {
    conditions.push('m.in_reply_to = ?');
    params.push(row.message_id);
  }
  const rows = db
    .prepare(
      `SELECT m.*, f.special_use AS folder_special_use, f.name AS folder_name
         FROM messages m LEFT JOIN folders f ON f.id = m.folder_id
        WHERE m.account_id = ? AND (${conditions.join(' OR ')})
        ORDER BY m.date DESC, m.id DESC LIMIT 1000`
    )
    .all(row.account_id, ...params);

  const opened = rows.find((r) => r.id === row.id);
  if (!opened) return [];
  const openedIsOut = THREAD_OUT_SPECIAL_USES.has(opened.folder_special_use);
  const best = new Map(); // dedupe key -> row
  for (const r of rows) {
    if (r.id !== opened.id) {
      if (THREAD_HIDDEN_SPECIAL_USES.has(r.folder_special_use)) continue;
      if (!openedIsOut && THREAD_OUT_SPECIAL_USES.has(r.folder_special_use)) continue;
    }
    const key = r.message_id ? `mid:${r.message_id}` : `id:${r.id}`;
    const current = best.get(key);
    if (
      !current ||
      (current.id !== opened.id && (r.id === opened.id || copyRank(r) < copyRank(current) || (copyRank(r) === copyRank(current) && r.id < current.id)))
    ) {
      best.set(key, r);
    }
  }
  const newestFirst = [...best.values()].sort((a, b) => b.date - a.date || b.id - a.id);
  let kept = newestFirst.slice(0, MAX_THREAD_MESSAGES);
  if (!kept.some((r) => r.id === opened.id)) kept = [...kept.slice(0, MAX_THREAD_MESSAGES - 1), best.get(opened.message_id ? `mid:${opened.message_id}` : `id:${opened.id}`)];
  return kept.sort((a, b) => a.date - b.date || a.id - b.id);
}

/** MessageDetail plus where the message is (for the conversation view). */
function toThreadMessageJson(row) {
  return { ...toMessageDetail(row), specialUse: row.folder_special_use || null, folderName: row.folder_name || null };
}

// ---------------------------------------------------------------------------------------------
// Contacts (recipient autocomplete)
// ---------------------------------------------------------------------------------------------

const MAX_CONTACT_ROWS = 20000;
const MAX_CONTACT_QUERY = 100;
const CONTACT_ADDRESS = /^[^\s@<>",;]{1,64}@[^\s@<>",;]{1,253}$/;
// eslint-disable-next-line no-control-regex
const HAS_CONTROL_CHAR = /[\u0000-\u001f\u007f]/;

/**
 * People the user corresponds with: senders of their mail (not Spam) and recipients of what
 * they sent (Sent folders). Prefix match on the address or on any word of the name; ranked by
 * how often they appear, then by how recently. The user's own accounts are left out.
 * @returns {Array<{ name: string, address: string }>}
 */
function listContacts(db, userId, { q = '', limit = 8 } = {}) {
  const term = String(q || '').replace(CONTROL_CHARS, ' ').trim().toLowerCase().slice(0, MAX_CONTACT_QUERY);
  const max = Math.min(20, Math.max(1, Math.floor(Number(limit)) || 8));
  const own = new Set(db.prepare('SELECT lower(email) AS e FROM accounts WHERE user_id = ?').all(userId).map((r) => r.e));
  const junk = specialFoldersSql(userId, ['\\Junk']);
  const sent = specialFoldersSql(userId, ['\\Sent']);
  const recipients = (column) =>
    `SELECT json_extract(r.value, '$.name') AS name, json_extract(r.value, '$.address') AS address, m.date AS date
       FROM messages m, ${addressList(column)} r
      WHERE ${USER_ACCOUNTS_SQL} AND m.folder_id IN ${sent.sql}`;
  const match = term
    ? `WHERE lower(c.address) LIKE ? ESCAPE '\\' OR lower(COALESCE(c.name, '')) LIKE ? ESCAPE '\\' OR lower(COALESCE(c.name, '')) LIKE ? ESCAPE '\\'`
    : '';
  const matchParams = term ? [`${escapeLike(term)}%`, `${escapeLike(term)}%`, `% ${escapeLike(term)}%`] : [];
  const rows = db
    .prepare(
      `SELECT c.name, c.address, c.date FROM (
         SELECT m.from_name AS name, m.from_address AS address, m.date AS date FROM messages m
          WHERE ${USER_ACCOUNTS_SQL} AND m.from_address IS NOT NULL AND m.from_address != ''
            AND (m.folder_id IS NULL OR m.folder_id NOT IN ${junk.sql})
         UNION ALL ${recipients('m.to_json')}
         UNION ALL ${recipients('m.cc_json')}
       ) c ${match}
       ORDER BY c.date DESC LIMIT ${MAX_CONTACT_ROWS}`
    )
    .all(userId, ...junk.params, userId, ...sent.params, userId, ...sent.params, ...matchParams);

  const byAddress = new Map();
  for (const r of rows) {
    const address = typeof r.address === 'string' ? r.address.trim() : '';
    if (!CONTACT_ADDRESS.test(address) || HAS_CONTROL_CHAR.test(address)) continue;
    const key = address.toLowerCase();
    if (own.has(key)) continue;
    let entry = byAddress.get(key);
    if (!entry) {
      entry = { address, name: '', count: 0, last: r.date };
      byAddress.set(key, entry);
    }
    entry.count += 1;
    // Rows come newest first: the first non-empty name is the most recent one.
    if (!entry.name && typeof r.name === 'string' && r.name.trim()) entry.name = r.name.replace(CONTROL_CHARS, ' ').trim().slice(0, 200);
  }
  return [...byAddress.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, max)
    .map(({ name, address }) => ({ name, address }));
}

// ---------------------------------------------------------------------------------------------
// Input validation shared by the ROUTES modules (kept here because it is the area's only
// shared module). Every helper throws HttpError 400 with a sentence the UI can show as-is.
// ---------------------------------------------------------------------------------------------

const COLOR_RE = /^#[0-9a-f]{6}$/i;

function badRequest(message, code = 'VALIDATION') {
  return new HttpError(400, message, code);
}

/** A positive integer id (number or digit string), else 400. */
function requireId(value, what = 'id') {
  const n = typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n < 1) throw badRequest(`Invalid ${what}.`, 'INVALID_ID');
  return n;
}

/** An array of unique positive integer ids, else 400. */
function requireIdList(value, { what = 'ids', max = 500 } = {}) {
  if (!Array.isArray(value)) throw badRequest(`${what} must be a list.`, 'INVALID_ID');
  if (value.length > max) throw badRequest(`Too many ${what} (at most ${max}).`, 'TOO_MANY');
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const n = requireId(item, what.replace(/s$/, ''));
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Trimmed string (or null when empty and allowed), at most `max` characters, else 400. */
function optionalText(value, { field, max, allowEmpty = true }) {
  if (value === undefined || value === null) {
    if (!allowEmpty) throw badRequest(`${field} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be text.`);
  const s = value.trim();
  if (!s) {
    if (!allowEmpty) throw badRequest(`${field} is required.`);
    return null;
  }
  if (s.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return s;
}

/** '#rrggbb' (normalised to lower case), else 400. */
function requireColor(value) {
  if (typeof value !== 'string' || !COLOR_RE.test(value.trim())) {
    throw badRequest('Color must be a hex color like #4f46e5.', 'INVALID_COLOR');
  }
  return value.trim().toLowerCase();
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') throw badRequest(`${field} must be true or false.`);
  return value;
}

/** An integer (number or digit string) between min and max, else 400. */
function requireInt(value, { field, min, max }) {
  const n = typeof value === 'string' && /^-?\d{1,15}$/.test(value.trim()) ? Number(value.trim()) : value;
  if (!Number.isSafeInteger(n) || n < min || n > max) throw badRequest(`${field} must be a whole number from ${min} to ${max}.`);
  return n;
}

/** Plain JSON object body (express.json leaves `{}` when there is none). */
function requireBody(req) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('The request body must be a JSON object.');
  return body;
}

/** Colour for a user's next account: the first palette colour none of their accounts has yet. */
function nextAccountColor(db, userId) {
  const used = db.prepare('SELECT color FROM accounts WHERE user_id = ?').all(userId).map((r) => r.color);
  return nextPaletteColor(used);
}

const validate = { requireId, requireIdList, optionalText, requireColor, requireBoolean, requireInt, requireBody, badRequest, COLOR_RE };

module.exports = {
  validate,
  tabFilterSql,
  inboxOnlySql,
  listMessages,
  countForTab,
  getMessageForUser,
  toMessageListItem,
  toMessageDetail,
  toAccountJson,
  toTabJson,
  // extras used by the routes and tests
  resolveTab,
  parseRules,
  rulesSql,
  buildFtsQuery,
  escapeLike,
  encodeCursor,
  decodeCursor,
  clampLimit,
  selectTabMessageRefs,
  getMessagesForUser,
  getAccountRowForUser,
  listAccountsJson,
  getAccountJson,
  nextAccountColor,
  listTabsJson,
  getTabJson,
  // v2: folders, unified views, conversations, contacts
  resolveSource,
  resolveFolder,
  folderFilterSql,
  viewFilterSql,
  listFoldersJson,
  threadMessages,
  toThreadMessageJson,
  listContacts,
  sendingStatusFor,
  VIEWS,
  RULE_FIELDS,
  RULE_OPS,
  DEFAULT_COLOR,
  MAX_LIMIT,
};
