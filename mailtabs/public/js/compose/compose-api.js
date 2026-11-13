// API calls used by the composer (SPEC2 §4), following /js/api.js conventions:
// JSON bodies, `X-Mailtabs: 1` on every non-GET (CSRF guard), same-origin credentials,
// errors as ApiError, and a lost session handed to the app's shared 401 handler.
import { ApiError, api, browserTimeZone } from '../api.js';

const CSRF_HEADER = 'X-Mailtabs';

function fallbackMessage(status) {
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return "You don't have access to that.";
  if (status === 404) return "That item doesn't exist any more.";
  if (status === 409) return 'That changed in the meantime. Try again.';
  if (status === 413) return 'That is too large to send.';
  if (status === 429) return 'Too many requests. Try again in a moment.';
  if (status === 502 || status === 504) return "The mail server didn't respond. Try again in a moment.";
  if (status >= 500) return 'Something went wrong on the server.';
  return 'Something went wrong.';
}

function isSessionGone(status, code) {
  return status === 401 && (!code || code === 'UNAUTHENTICATED');
}

let sessionCheck = null;
/**
 * The app's unauthorized handler lives inside api.js; make one ordinary API call so that, if the
 * session really is gone, that call reports it through the shared handler (sign-in screen).
 */
function reportSessionGone() {
  if (sessionCheck) return;
  sessionCheck = api
    .accounts()
    .catch(() => {})
    .finally(() => {
      sessionCheck = null;
    });
}

function errorFrom(status, data) {
  const code = data && data.code;
  if (isSessionGone(status, code)) reportSessionGone();
  return new ApiError((data && data.error) || fallbackMessage(status), status, code, data);
}

async function request(method, path, body, { signal } = {}) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' }, signal };
  if (method !== 'GET' && method !== 'HEAD') {
    init.headers[CSRF_HEADER] = '1';
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
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
  }
  if (!res.ok) throw errorFrom(res.status, data);
  return data || {};
}

function query(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    usp.set(key, String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

const id = (value) => encodeURIComponent(String(value));

// Recent contact lookups (query -> contacts), a small LRU shared by every recipient field.
// They are the signed-in user's correspondents: cleared whenever the composers are reset.
const contactCache = new Map();
const CONTACT_CACHE_MAX = 60;

export function cachedContacts(q) {
  return contactCache.has(q) ? contactCache.get(q) : null;
}

export function rememberContacts(q, contacts) {
  contactCache.delete(q);
  contactCache.set(q, contacts);
  if (contactCache.size > CONTACT_CACHE_MAX) contactCache.delete(contactCache.keys().next().value);
}

export function clearContactCache() {
  contactCache.clear();
}

export const composeApi = {
  /** -> { payload, draft }. The time zone dates the reply quote ("On <date>, … wrote:") like the reader sees it. */
  prepare: (mode, messageId, opts) => request('GET', `/api/compose/prepare${query({ mode, messageId, tz: browserTimeZone() })}`, undefined, opts),
  /** -> { draft: { folderId, uid } } */
  saveDraft: (payload, draft) => request('POST', '/api/drafts', draft ? { payload, draft } : { payload }),
  deleteDraft: (draft) => request('DELETE', '/api/drafts', { draft }),
  /** -> { outbox: { id, sendAt, status } } */
  send: (payload, { sendAt, draft } = {}) => {
    const body = { payload };
    if (sendAt) body.sendAt = sendAt;
    if (draft) body.draft = draft;
    return request('POST', '/api/send', body);
  },
  outbox: (opts) => request('GET', '/api/outbox', undefined, opts),
  /** -> { payload, draft } */
  cancelOutbox: (outboxId) => request('POST', `/api/outbox/${id(outboxId)}/cancel`, {}),
  retryOutbox: (outboxId) => request('POST', `/api/outbox/${id(outboxId)}/retry`, {}),
  deleteOutbox: (outboxId) => request('DELETE', `/api/outbox/${id(outboxId)}`),
  /** -> { contacts: [{ name, address }] } */
  contacts: (q, { limit = 8, signal } = {}) => request('GET', `/api/contacts${query({ q, limit })}`, undefined, { signal }),
  settings: () => request('GET', '/api/settings'),
  saveSettings: (body) => request('PUT', '/api/settings', body),
  deleteUpload: (uploadId) => request('DELETE', `/api/uploads/${id(uploadId)}`),
  /** Message detail (used to name forwarded/draft attachments). */
  message: (messageId, opts) => request('GET', `/api/messages/${id(messageId)}`, undefined, opts),
  updateAccount: (accountId, body) => request('PATCH', `/api/accounts/${id(accountId)}`, body),
};

/**
 * Upload one file with progress (fetch has no upload progress, so this uses XHR).
 * -> { promise: Promise<{ id, filename, contentType, size }>, abort() }
 */
export function uploadFile(file, { filename, onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  const name = filename || (file && file.name) || 'attachment';
  const promise = new Promise((resolve, reject) => {
    xhr.open('POST', '/api/uploads');
    xhr.withCredentials = true;
    xhr.setRequestHeader(CSRF_HEADER, '1');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', (file && file.type) || 'application/octet-stream');
    // Header values must be ASCII; the server decodes the percent-encoding.
    xhr.setRequestHeader('X-Filename', encodeURIComponent(name));
    if (xhr.upload && onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
      });
    }
    xhr.addEventListener('load', () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (_) {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data && data.upload && data.upload.id) {
        resolve(data.upload);
      } else {
        reject(errorFrom(xhr.status, data));
      }
    });
    xhr.addEventListener('error', () => reject(new ApiError("Couldn't upload the file. Check your connection and try again.", 0, 'NETWORK')));
    xhr.addEventListener('abort', () => {
      const err = new Error('Upload cancelled');
      err.name = 'AbortError';
      reject(err);
    });
    xhr.send(file);
  });
  return {
    promise,
    abort: () => {
      try {
        xhr.abort();
      } catch (_) {
        /* already finished */
      }
    },
  };
}
