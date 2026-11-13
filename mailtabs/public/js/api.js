// Thin JSON client for the Mailtabs API (SPEC §5/§7).
// - every non-GET request sends `X-Mailtabs: 1` (CSRF guard) and a JSON body
// - errors become ApiError { status, code, message }
// - a 401 meaning "session gone" calls the registered unauthorized handler,
//   which returns the app to the sign-in screen

export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || null;
    this.data = data || null;
  }
}

let unauthorizedHandler = null;

/** Register the callback run when any request reports the session is gone. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function fallbackMessage(status) {
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return "You don't have access to that.";
  if (status === 404) return "That item doesn't exist any more.";
  if (status === 409) return 'That already exists.';
  if (status === 413) return 'That request was too large.';
  if (status === 429) return 'Too many attempts. Try again later.';
  if (status === 502 || status === 504) return "The mail server didn't respond. Try again in a moment.";
  if (status >= 500) return 'Something went wrong on the server.';
  return 'Something went wrong.';
}

async function request(method, path, body, options = {}) {
  const init = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  };
  if (method !== 'GET' && method !== 'HEAD') {
    init.headers['X-Mailtabs'] = '1';
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body === undefined ? {} : body);
  }

  let res;
  try {
    res = await fetch(path, init);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError("Can't reach Mailtabs. Check your connection and try again.", 0, 'NETWORK');
  }

  let data = null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      data = await res.json();
    } catch (_) {
      data = null; // malformed JSON is treated like an empty body
    }
  }

  if (!res.ok) {
    const code = data && data.code;
    const err = new ApiError((data && data.error) || fallbackMessage(res.status), res.status, code, data);
    // Only an "unauthenticated" 401 means the session is gone; e.g. INVALID_CREDENTIALS
    // on the sign-in form or a wrong current password must be shown inline instead.
    const sessionGone = res.status === 401 && (!code || code === 'UNAUTHENTICATED');
    if (sessionGone && !options.ignoreUnauthorized && unauthorizedHandler) unauthorizedHandler(err);
    throw err;
  }
  return data || {};
}

function query(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    usp.set(key, value === true ? '1' : String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

const get = (path, opts) => request('GET', path, undefined, opts);
const post = (path, body, opts) => request('POST', path, body, opts);
const patch = (path, body, opts) => request('PATCH', path, body, opts);
const put = (path, body, opts) => request('PUT', path, body, opts);
const del = (path, body, opts) => request('DELETE', path, body, opts);

const id = (value) => encodeURIComponent(String(value));

export const api = {
  // config + auth
  config: () => get('/api/config', { ignoreUnauthorized: true }),
  me: () => get('/api/auth/me', { ignoreUnauthorized: true }),
  login: (body) => post('/api/auth/login', body, { ignoreUnauthorized: true }),
  signup: (body) => post('/api/auth/signup', body, { ignoreUnauthorized: true }),
  logout: () => post('/api/auth/logout', {}, { ignoreUnauthorized: true }),
  changePassword: (body) => post('/api/auth/password', body),

  // accounts
  accounts: () => get('/api/accounts'),
  createAccount: (body) => post('/api/accounts', body),
  testAccount: (body) => post('/api/accounts/test', body),
  updateAccount: (accountId, body) => patch(`/api/accounts/${id(accountId)}`, body),
  deleteAccount: (accountId) => del(`/api/accounts/${id(accountId)}`),
  syncAccount: (accountId) => post(`/api/accounts/${id(accountId)}/sync`, {}),
  syncAll: () => post('/api/sync', {}),

  // tabs
  tabs: () => get('/api/tabs'),
  createTab: (body) => post('/api/tabs', body),
  updateTab: (tabId, body) => patch(`/api/tabs/${id(tabId)}`, body),
  deleteTab: (tabId) => del(`/api/tabs/${id(tabId)}`),
  reorderTabs: (ids) => put('/api/tabs/order', { ids }),

  // messages. `params` has exactly one source: { tab } | { folder } | { view }.
  messages: (params, opts) => get(`/api/messages${query(params)}`, opts),
  message: (messageId, opts) => get(`/api/messages/${id(messageId)}`, opts),
  updateMessage: (messageId, body) => patch(`/api/messages/${id(messageId)}`, body),
  // `extra` carries action arguments, e.g. { folderId } for 'move'.
  bulk: (ids, action, extra = {}) => post('/api/messages/bulk', { ids, action, ...extra }),
  undo: (token) => post('/api/messages/undo', { token }),
  thread: (messageId, opts) => get(`/api/messages/${id(messageId)}/thread`, opts),
  // `filters` narrows it to what the list shows: { q, starred }.
  markAllRead: (tab, filters = {}) => post('/api/messages/mark-all-read', { tab, ...filters }),
  oauthResult: () => get('/api/oauth/result'),

  // folders
  folders: () => get('/api/folders'),
  createFolder: (body) => post('/api/folders', body),
  renameFolder: (folderId, name) => patch(`/api/folders/${id(folderId)}`, { name }),
  deleteFolder: (folderId, { force = false } = {}) => del(`/api/folders/${id(folderId)}${force ? '?force=1' : ''}`),
  syncFolder: (folderId) => post(`/api/folders/${id(folderId)}/sync`, {}),
  backfillFolder: (folderId, count = 100) => post(`/api/folders/${id(folderId)}/backfill`, { count }),
  emptyFolder: (folderId) => post(`/api/folders/${id(folderId)}/empty`, {}),

  // settings
  settings: () => get('/api/settings'),
  updateSettings: (body) => put('/api/settings', body),

  // outbox
  outbox: () => get('/api/outbox'),
  cancelOutbox: (outboxId) => post(`/api/outbox/${id(outboxId)}/cancel`, {}),
  retryOutbox: (outboxId) => post(`/api/outbox/${id(outboxId)}/retry`, {}),
  deleteOutbox: (outboxId) => del(`/api/outbox/${id(outboxId)}`),

  // compose (the composer may use these or its own helpers)
  prepareCompose: (params) => get(`/api/compose/prepare${query(params)}`),
  saveDraft: (body) => post('/api/drafts', body),
  deleteDraft: (draft) => del('/api/drafts', { draft }),
  send: (body) => post('/api/send', body),
  contacts: (q, limit = 8, opts) => get(`/api/contacts${query({ q, limit })}`, opts),
  deleteUpload: (uploadId) => del(`/api/uploads/${id(uploadId)}`),
};

/** URL for the sandboxed iframe that renders a message body. */
export function bodyUrl(messageId, showImages) {
  return `/api/messages/${id(messageId)}/body${showImages ? '?images=1' : ''}`;
}

export function attachmentUrl(messageId, index) {
  return `/api/messages/${id(messageId)}/attachments/${id(index)}`;
}

/** Download of the original message (.eml). */
export function rawUrl(messageId) {
  return `/api/messages/${id(messageId)}/raw`;
}

/** Printable page for a message (remote images only when the user allowed them). */
export function printUrl(messageId, showImages) {
  return `/api/messages/${id(messageId)}/print${showImages ? '?images=1' : ''}`;
}

/** Full-page navigation target that starts Google/Microsoft sign-in. */
export function oauthStartUrl(provider, { accountId, tabIds } = {}) {
  const params = {};
  if (accountId) params.accountId = accountId;
  if (tabIds && tabIds.length) params.tabIds = tabIds.join(',');
  return `/api/oauth/${id(provider)}/start${query(params)}`;
}
