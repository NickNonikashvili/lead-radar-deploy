'use strict';

const http = require('http');
const { HttpError } = require('./errors');
const { randomToken, sha256Hex } = require('./crypto');

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

const SESSION_COOKIE = 'mt_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_MS = 60 * 60 * 1000; // sliding expiry is bumped at most once per hour

const CSRF_HEADER = 'X-Mailtabs';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Default CSP for everything except the sandboxed message-body endpoint, which sets its own.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "frame-src 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

// ---------------------------------------------------------------------------------------------
// Async route wrapper (express 4 does not catch promise rejections)
// ---------------------------------------------------------------------------------------------

function asyncHandler(fn) {
  return function asyncRoute(req, res, next) {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
}

// ---------------------------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------------------------

function securityHeaders(config = {}) {
  return function setSecurityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // Routes that serve message bodies overwrite this with a stricter policy.
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    if (config.cookieSecure) {
      // Only meaningful (and only safe to send) when the site is actually served over HTTPS.
      res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    }
    next();
  };
}

/** API responses contain private data: never let browsers or proxies cache them by default. */
function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

// ---------------------------------------------------------------------------------------------
// Cookies (tiny parser — we only need one cookie and do not want another dependency)
// ---------------------------------------------------------------------------------------------

function parseCookies(header) {
  const out = Object.create(null);
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue; // first occurrence wins (most specific path, per RFC 6265)
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch (_) {
      out[name] = value;
    }
  }
  return out;
}

function cookieOptions(config) {
  return { httpOnly: true, sameSite: 'lax', path: '/', secure: !!config.cookieSecure };
}

function setSessionCookie(res, config, token) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(config), maxAge: SESSION_TTL_MS });
}

function clearSessionCookie(res, config) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(config));
}

// ---------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------

/**
 * Create a session row for `userId` and set the cookie. Only sha256(token) is stored, so a leaked
 * database cannot be used to hijack sessions.
 */
function createSession(db, config, res, userId) {
  const token = randomToken(32);
  const id = sha256Hex(token);
  const now = Date.now();
  // Opportunistic cleanup keeps the table small without a background job.
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    userId,
    now,
    now + SESSION_TTL_MS,
    now
  );
  setSessionCookie(res, config, token);
  return { id, token };
}

function destroySession(db, config, res, sessionId) {
  if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  clearSessionCookie(res, config);
}

/**
 * Loads req.user / req.sessionId from the session cookie. Never rejects a request on its own —
 * routes decide with requireAuth.
 */
function sessionLoader({ db, config }) {
  const findSession = db.prepare(
    `SELECT s.id, s.user_id, s.expires_at, s.last_seen_at, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`
  );
  const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');
  const touchSession = db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?');

  return function loadSession(req, res, next) {
    req.user = null;
    req.sessionId = null;
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return next();

    let row;
    try {
      row = findSession.get(sha256Hex(token));
      const now = Date.now();
      if (!row) {
        clearSessionCookie(res, config); // stale or forged cookie: tell the browser to drop it
        return next();
      }
      if (row.expires_at <= now) {
        deleteSession.run(row.id);
        clearSessionCookie(res, config);
        return next();
      }
      if (now - row.last_seen_at >= SESSION_REFRESH_MS) {
        touchSession.run(now, now + SESSION_TTL_MS, row.id);
        setSessionCookie(res, config, token); // keep the browser's Max-Age in step with the server
      }
    } catch (err) {
      return next(err);
    }

    req.user = { id: row.user_id, email: row.email, name: row.name };
    req.sessionId = row.id;
    next();
  };
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not signed in', code: 'UNAUTHENTICATED' });
  }
  next();
}

// ---------------------------------------------------------------------------------------------
// CSRF: every state-changing /api request must carry `X-Mailtabs: 1`. Browsers cannot attach a
// custom header to a cross-site request without a CORS preflight, which we never approve.
// ---------------------------------------------------------------------------------------------

function isApiPath(p) {
  return p === '/api' || p.startsWith('/api/');
}

function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method) || !isApiPath(req.path)) return next();
  if (req.get(CSRF_HEADER) !== '1') {
    return res.status(403).json({ error: 'Missing CSRF header', code: 'CSRF' });
  }
  next();
}

// ---------------------------------------------------------------------------------------------
// Rate limiting (fixed window, in memory — fine for a single-process self-hosted app)
// ---------------------------------------------------------------------------------------------

/**
 * rateLimit({ windowMs, max, key: req => string }) -> express middleware.
 * The returned middleware also has `.reset(req)` to forget a key (e.g. after a successful login)
 * and `.store` for inspection in tests.
 */
function rateLimit({ windowMs, max, key, message = 'Too many attempts. Try again later.' }) {
  if (!(windowMs > 0) || !(max > 0) || typeof key !== 'function') {
    throw new TypeError('rateLimit: windowMs, max and key(req) are required');
  }
  const store = new Map(); // key -> { count, resetAt }
  let nextSweep = Date.now() + windowMs;

  function sweep(now) {
    if (now < nextSweep) return;
    for (const [k, entry] of store) if (entry.resetAt <= now) store.delete(k);
    nextSweep = now + windowMs;
  }

  function limiter(req, res, next) {
    const now = Date.now();
    sweep(now);
    let k;
    try {
      k = String(key(req));
    } catch (err) {
      return next(err);
    }
    let entry = store.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ error: message, code: 'RATE_LIMITED' });
    }
    next();
  }

  limiter.reset = (req) => {
    try {
      store.delete(String(key(req)));
    } catch (_) {
      /* key function failed — nothing to reset */
    }
  };
  limiter.store = store;
  return limiter;
}

// ---------------------------------------------------------------------------------------------
// 404 + error handling
// ---------------------------------------------------------------------------------------------

function apiNotFound(req, res) {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}

/**
 * createErrorHandler(logger) -> express error middleware. HttpError (or anything with a numeric
 * `.status` and `.expose === true`) is sent as-is; everything else becomes a logged 500.
 */
function createErrorHandler(logger = console) {
  // eslint-disable-next-line no-unused-vars
  return function handleError(err, req, res, next) {
    if (res.headersSent) {
      // Too late to send a JSON error; let express close the connection.
      return next(err);
    }

    let status = 500;
    let body = { error: 'Something went wrong' };

    if (err && err.type === 'entity.parse.failed') {
      status = 400;
      body = { error: 'The request body is not valid JSON.', code: 'BAD_JSON' };
    } else if (err && err.type === 'entity.too.large') {
      status = 413;
      body = { error: 'The request body is too large.', code: 'PAYLOAD_TOO_LARGE' };
    } else if (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600 && err.expose === true) {
      status = err.status;
      body = { error: String(err.message || http.STATUS_CODES[status] || 'Error') };
      if (typeof err.code === 'string' && err.code) body.code = err.code;
    } else if (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
      // Client errors raised by express/body-parser internals (e.g. malformed URL encoding).
      // Their messages are not meant for users, so send only the standard reason phrase.
      status = err.status;
      body = { error: http.STATUS_CODES[status] || 'Bad request' };
    } else {
      logger.error(`[mailtabs] ${req.method} ${req.originalUrl} failed:`, (err && err.stack) || err);
    }

    res.status(status).json(body);
  };
}

/** Ready-to-use error middleware that logs to console. */
const errorHandler = createErrorHandler(console);

module.exports = {
  HttpError,
  asyncHandler,
  securityHeaders,
  noStore,
  parseCookies,
  sessionLoader,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  csrfGuard,
  rateLimit,
  apiNotFound,
  errorHandler,
  createErrorHandler,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  SESSION_REFRESH_MS,
  CSRF_HEADER,
  CONTENT_SECURITY_POLICY,
};
