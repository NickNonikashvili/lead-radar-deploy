// Accounts, sessions and the web-security middleware.
//
// Sessions are opaque random tokens in an HttpOnly cookie. Only sha256(token) is stored, so a
// database leak does not hand out live sessions. Passwords use scrypt (src/crypto.js). Every
// account gets its own wrapped data key (DEK) at signup; "delete everything" removes the user's
// rows and the wrapped DEK, which makes any leftover ciphertext unreadable.
//
// CSRF: the session cookie is SameSite=Lax (no cookie on cross-site POST/fetch) and
// requireSameOrigin rejects state-changing requests whose Origin is not ours. Either alone stops
// classic CSRF; both together also cover sibling-subdomain attacks, which SameSite does not.
const { newId, now, microsToUsd, usdToMicros, AppError } = require("./util");
const { hashPassword, verifyPassword, randomToken, sha256 } = require("./crypto");

const SESSION_COOKIE = "gode_session";
const DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD_MIN = 8;
// Bounds the work an attacker can make scrypt do per request and keeps the UI honest.
const PASSWORD_MAX = 200;
const EMAIL_MAX = 254;
// randomToken(32) is 43 base64url chars. Anything far outside that is junk: skip the DB lookup.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,256}$/;
// When a browser sends several cookies with our name (e.g. one tossed in from a sibling
// subdomain), try a few instead of letting the first bogus one log the user out.
const MAX_SESSION_CANDIDATES = 3;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const CSP = [
  "default-src 'self'",
  // Only our own files: public/app.js is plain JavaScript on the vendored React UMD build, so
  // nothing is compiled or eval'd in the browser. Never add 'unsafe-eval' or 'unsafe-inline' here.
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // Generated media comes back as data:/blob: URLs (mock, OpenAI images) or fal's https CDN.
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Billing hands the browser off to Stripe Checkout.
  "form-action 'self' https://checkout.stripe.com",
].join("; ");

// ---------------------------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------------------------

const EMAIL_LOCAL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const EMAIL_DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Trimmed, lower-cased email, or null when it is not a plausible address. */
function normalizeEmail(email) {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  if (e.length === 0 || e.length > EMAIL_MAX) return null;
  const at = e.lastIndexOf("@");
  if (at <= 0 || at > 64) return null;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!EMAIL_LOCAL_RE.test(local) || !EMAIL_DOMAIN_RE.test(domain)) return null;
  return e;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    throw new AppError(400, "bad_request", `Password must be at least ${PASSWORD_MIN} characters.`);
  }
  if (password.length > PASSWORD_MAX) {
    throw new AppError(400, "bad_request", `Password must be at most ${PASSWORD_MAX} characters.`);
  }
}

function isTokenShaped(token) {
  return typeof token === "string" && TOKEN_RE.test(token);
}

// One scrypt hash with the same parameters as real ones, so a login for an unknown email costs
// the same as a wrong password and response time does not reveal which emails have accounts.
let dummyHash = null;
function getDummyHash() {
  if (!dummyHash) dummyHash = hashPassword(randomToken(18));
  return dummyHash;
}

// ---------------------------------------------------------------------------------------------
// User shapes
// ---------------------------------------------------------------------------------------------

/**
 * Internal user object from a users row. password_hash and wrapped_dek stay readable for server
 * code (password confirmation, decrypting the user's data) but are non-enumerable, so
 * res.json(user), JSON.stringify and object spread can never ship them to a client by accident.
 */
function toUser(row) {
  if (!row) return null;
  const user = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "password_hash" || k === "wrapped_dek") continue;
    user[k] = v;
  }
  Object.defineProperty(user, "password_hash", { value: row.password_hash, enumerable: false });
  Object.defineProperty(user, "wrapped_dek", { value: row.wrapped_dek, enumerable: false });
  return user;
}

/** The user as the HTTP API shows it. Accepts a users row, a toUser() object, or its own output. */
function publicUser(row) {
  if (!row) return null;
  const balanceUsd =
    row.balance_micros !== undefined && row.balance_micros !== null
      ? microsToUsd(row.balance_micros)
      : Number(row.balance_usd) || 0;
  return {
    id: row.id,
    email: row.email,
    plan: row.plan,
    strict_privacy: Boolean(row.strict_privacy),
    eu_only: Boolean(row.eu_only),
    auto_pick: Boolean(row.auto_pick),
    share_prompts: Boolean(row.share_prompts),
    is_admin: Boolean(row.is_admin),
    balance_usd: balanceUsd,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------------------------------------
// Cookies (no dependency: express does not parse cookies itself)
// ---------------------------------------------------------------------------------------------

function decodeCookieValue(raw) {
  let v = raw.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!v.includes("%")) return v;
  try {
    return decodeURIComponent(v);
  } catch {
    return v; // malformed escape: keep the raw value rather than dropping the cookie
  }
}

/** Every [name, value] pair of a Cookie header, in the order the browser sent them. */
function cookiePairs(header) {
  const text = Array.isArray(header) ? header.join("; ") : typeof header === "string" ? header : "";
  const pairs = [];
  for (const part of text.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    pairs.push([name, decodeCookieValue(part.slice(eq + 1))]);
  }
  return pairs;
}

/** Cookie header -> { name: value } (first occurrence wins, like most parsers). */
function parseCookies(header) {
  // Null prototype: a cookie named "__proto__" must not reach Object.prototype.
  const out = Object.create(null);
  for (const [name, value] of cookiePairs(header)) {
    if (!(name in out)) out[name] = value;
  }
  return out;
}

/** Append a Set-Cookie value without clobbering cookies set elsewhere in the response. */
function appendSetCookie(res, value) {
  const prev = res.getHeader("Set-Cookie");
  if (prev === undefined) res.setHeader("Set-Cookie", [value]);
  else res.setHeader("Set-Cookie", [...(Array.isArray(prev) ? prev : [String(prev)]), value]);
}

// ---------------------------------------------------------------------------------------------
// createAuth
// ---------------------------------------------------------------------------------------------

/**
 * @param {{ db, config, keyring, credits? }} deps  credits is needed for the signup bonus; without
 *   it no bonus is granted. The positional form createAuth(db, config, keyring, credits) is also
 *   accepted because an earlier draft of the contract used it.
 */
function createAuth(deps, ...rest) {
  const { db, config, keyring, credits } =
    deps && typeof deps.prepare === "function" ? { db: deps, config: rest[0], keyring: rest[1], credits: rest[2] } : deps || {};
  if (!db || typeof db.prepare !== "function" || typeof db.tx !== "function") throw new TypeError("createAuth: db is required");
  if (!config || typeof config !== "object") throw new TypeError("createAuth: config is required");
  if (!keyring || typeof keyring.newWrappedDek !== "function") throw new TypeError("createAuth: keyring is required");
  if (credits && typeof credits.grant !== "function") throw new TypeError("createAuth: credits.grant must be a function");

  const sessionDays = Number(config.sessionDays) > 0 ? Number(config.sessionDays) : 30;
  const sessionMs = sessionDays * DAY_MS;
  const adminEmails = new Set((config.adminEmails || []).map((e) => String(e).trim().toLowerCase()));
  const signupBonusMicros = usdToMicros(config.billing?.signupCreditUsd || 0);
  const cookieSecure = Boolean(config.cookieSecure);
  getDummyHash(); // pay the one-off scrypt at boot, not on the first unknown-email login

  const stmt = {
    userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    countUsers: db.prepare("SELECT COUNT(*) AS n FROM users"),
    insertUser: db.prepare(
      "INSERT INTO users (id, email, password_hash, wrapped_dek, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"),
    sessionUser: db.prepare(
      "SELECT s.expires_at AS session_expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"
    ),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    deleteExpiredForUser: db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?"),
    deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
  };

  function isAdminEmail(email) {
    return adminEmails.has(email);
  }

  function signup({ email, password } = {}) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new AppError(400, "bad_request", "Enter a valid email address.");
    validatePassword(password);
    // scrypt runs before the transaction so the write lock is held only for the inserts.
    const passwordHash = hashPassword(password);
    const wrappedDek = keyring.newWrappedDek();
    const id = newId();

    db.tx(() => {
      if (stmt.userByEmail.get(normalized)) {
        throw new AppError(409, "conflict", "An account with this email already exists.");
      }
      const firstUser = stmt.countUsers.get().n === 0;
      const isAdmin = firstUser || isAdminEmail(normalized) ? 1 : 0;
      try {
        stmt.insertUser.run(id, normalized, passwordHash, wrappedDek, isAdmin, now());
      } catch (e) {
        // Backstop for the UNIQUE index (another process wrote the same email).
        if (/UNIQUE/i.test(String(e && e.message))) {
          throw new AppError(409, "conflict", "An account with this email already exists.");
        }
        throw e;
      }
      // Same transaction: an account never exists without its bonus, nor a bonus without an account.
      if (credits && signupBonusMicros > 0) credits.grant(id, signupBonusMicros, "signup_bonus", "signup");
    });
    return toUser(stmt.userById.get(id));
  }

  function login({ email, password } = {}) {
    const normalized = normalizeEmail(email);
    const row = normalized ? stmt.userByEmail.get(normalized) : undefined;
    // Always run one scrypt verification, even for unknown or malformed emails.
    const candidate = typeof password === "string" && password.length <= PASSWORD_MAX ? password : "";
    const ok = verifyPassword(candidate, row ? row.password_hash : getDummyHash());
    if (!row || !ok || candidate !== password) {
      throw new AppError(401, "unauthorized", "Wrong email or password.");
    }
    return toUser(row);
  }

  function createSession(userId) {
    if (typeof userId !== "string" || !userId) throw new TypeError("createSession: userId is required");
    const token = randomToken(32);
    const t = now();
    stmt.insertSession.run(sha256(token), userId, t, t + sessionMs);
    // Housekeeping on an indexed path, so expired rows do not pile up for active users.
    stmt.deleteExpiredForUser.run(userId, t);
    return token;
  }

  function destroySession(token) {
    if (!isTokenShaped(token)) return false;
    return stmt.deleteSession.run(sha256(token)).changes > 0;
  }

  function userFromToken(token) {
    if (!isTokenShaped(token)) return null;
    const hash = sha256(token);
    const row = stmt.sessionUser.get(hash);
    if (!row) return null;
    if (row.session_expires_at <= now()) {
      stmt.deleteSession.run(hash);
      return null;
    }
    const { session_expires_at: _ignored, ...userRow } = row;
    return toUser(userRow);
  }

  /** Remove every expired session (e.g. from a boot or cron hook). Returns the number removed. */
  function purgeExpiredSessions() {
    return stmt.deleteExpired.run(now()).changes;
  }

  function cookieAttributes(maxAgeSeconds) {
    const expires = new Date(maxAgeSeconds > 0 ? now() + maxAgeSeconds * 1000 : 0).toUTCString();
    const attrs = [`Path=/`, `Max-Age=${maxAgeSeconds}`, `Expires=${expires}`, "HttpOnly", "SameSite=Lax"];
    if (cookieSecure) attrs.push("Secure");
    return attrs.join("; ");
  }

  function setCookie(res, token) {
    if (!isTokenShaped(token)) throw new TypeError("setCookie: invalid session token");
    // base64url tokens need no encoding.
    appendSetCookie(res, `${SESSION_COOKIE}=${token}; ${cookieAttributes(Math.floor(sessionMs / 1000))}`);
  }

  function clearCookie(res) {
    appendSetCookie(res, `${SESSION_COOKIE}=; ${cookieAttributes(0)}`);
  }

  /** Express middleware: req.user = the signed-in user or null; req.sessionToken = its token. */
  function middleware() {
    return function authMiddleware(req, res, next) {
      req.user = null;
      req.sessionToken = null;
      try {
        const pairs = cookiePairs(req.headers.cookie);
        // Mimic cookie-parser so routes can read other cookies without another dependency.
        if (!req.cookies) {
          req.cookies = Object.create(null);
          for (const [name, value] of pairs) if (!(name in req.cookies)) req.cookies[name] = value;
        }
        const candidates = pairs.filter(([name]) => name === SESSION_COOKIE).map(([, v]) => v);
        for (const token of candidates.slice(0, MAX_SESSION_CANDIDATES)) {
          const user = userFromToken(token);
          if (user) {
            req.user = user;
            req.sessionToken = token;
            break;
          }
        }
        // A stale or forged cookie: tell the browser to drop it so it stops being sent.
        if (!req.user && candidates.length > 0) clearCookie(res);
      } catch (err) {
        return next(err);
      }
      next();
    };
  }

  function requireUser(req, res, next) {
    if (!req.user) return next(new AppError(401, "unauthorized", "Please sign in."));
    next();
  }

  function requireAdmin(req, res, next) {
    // Not signed in is a 401 (sign in and retry); signed in without the role is a 403.
    if (!req.user) return next(new AppError(401, "unauthorized", "Please sign in."));
    if (!req.user.is_admin) return next(new AppError(403, "forbidden", "Admins only."));
    next();
  }

  /** Convenience for the logout route: end this request's session and clear the cookie. */
  function logout(req, res) {
    const token = req.sessionToken || (req.cookies && req.cookies[SESSION_COOKIE]) || parseCookies(req.headers.cookie)[SESSION_COOKIE];
    destroySession(token);
    clearCookie(res);
  }

  /**
   * Delete the account and everything tied to it, in one transaction. Ledger rows stay (the
   * books must balance across all users) but lose their link to the person. Child rows are
   * deleted explicitly rather than trusting ON DELETE CASCADE alone, so this still holds on a
   * connection opened without PRAGMA foreign_keys, and we can report exact counts.
   */
  function deleteEverything(userId) {
    if (typeof userId !== "string" || !userId) throw new AppError(400, "bad_request", "userId is required");
    const result = db.tx(() => {
      const row = db.prepare("SELECT id, wrapped_dek FROM users WHERE id = ?").get(userId);
      if (!row) throw new AppError(404, "not_found", "Account not found.");
      const run = (sql) => db.prepare(sql).run(userId).changes;
      const counts = {
        ledger_unlinked: run("UPDATE ledger SET user_id = NULL WHERE user_id = ?"),
        // Messages in the user's conversations, plus any stray row that names the user directly.
        messages: run("DELETE FROM messages WHERE user_id = ?1 OR conversation_id IN (SELECT id FROM conversations WHERE user_id = ?1)"),
        conversations: run("DELETE FROM conversations WHERE user_id = ?"),
        requests: run("DELETE FROM requests WHERE user_id = ?"),
        holds: run("DELETE FROM holds WHERE user_id = ?"),
        sessions: run("DELETE FROM sessions WHERE user_id = ?"),
        users: run("DELETE FROM users WHERE id = ?"),
      };
      return { counts, wrappedDek: row.wrapped_dek };
    });
    // Only after COMMIT: a rolled-back delete must keep the user's key usable.
    if (typeof keyring.forget === "function") keyring.forget(result.wrappedDek);
    return result.counts;
  }

  return {
    signup,
    login,
    createSession,
    destroySession,
    userFromToken,
    purgeExpiredSessions,
    middleware,
    requireUser,
    requireAdmin,
    setCookie,
    clearCookie,
    logout,
    deleteEverything,
    // Same check as the module-level export, bound to this app's config.
    requireSameOrigin: createSameOriginCheck(config),
    publicUser,
  };
}

// ---------------------------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------------------------

/**
 * @param {{ production?: boolean }} [config]  the app config; HSTS is sent only in production
 *   (over plain-http development it would pin localhost to https). Without an argument the
 *   config is looked up on req.app.locals.config.
 */
function securityHeaders(config, res, next) {
  // Mounted as `app.use(securityHeaders)` by mistake: act as the middleware instead of returning
  // one, which would leave every request hanging.
  if (typeof next === "function") return securityHeaders()(config, res, next);
  return function securityHeadersMiddleware(req, res, next) {
    const cfg = config || req.app?.locals?.config || {};
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (cfg.production) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.removeHeader("X-Powered-By"); // don't advertise the framework
    next();
  };
}

// ---------------------------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------------------------

/**
 * Fixed-window in-memory limiter (single process, which is how Gode runs). Responds through the
 * error handler with 429 rate_limited and a Retry-After header.
 * @param {{ windowMs: number, max: number, key?: (req) => string|null }} opts
 *   key defaults to req.ip; a falsy key skips limiting for that request. Behind a reverse proxy
 *   req.ip is only the client when express 'trust proxy' is set.
 */
function rateLimit({ windowMs, max, key, maxKeys = 50_000 } = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new TypeError("rateLimit: windowMs must be a positive number");
  if (!Number.isInteger(max) || max <= 0) throw new TypeError("rateLimit: max must be a positive integer");
  if (key !== undefined && typeof key !== "function") throw new TypeError("rateLimit: key must be a function");
  const keyOf = key || ((req) => req.ip || req.socket?.remoteAddress || "unknown");
  const hits = new Map(); // key -> { count, resetAt }; insertion order = oldest window first

  function sweep(t) {
    for (const [k, entry] of hits) if (entry.resetAt <= t) hits.delete(k);
  }

  // Periodic cleanup so one-off visitors don't accumulate; unref'd so it never keeps the process alive.
  const timer = setInterval(() => sweep(now()), Math.min(Math.max(windowMs, 1000), 60_000));
  timer.unref?.();

  function limiter(req, res, next) {
    let k;
    try {
      k = keyOf(req);
    } catch (err) {
      return next(err);
    }
    if (!k) return next();
    k = String(k);
    const t = now();
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= t) {
      if (entry) hits.delete(k);
      if (hits.size >= maxKeys) {
        sweep(t);
        // Still full (an attacker rotating keys): evict the oldest windows to bound memory.
        while (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
      }
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - t) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return next(new AppError(429, "rate_limited", `Too many requests. Try again in ${retryAfter} s.`));
    }
    next();
  }

  limiter.reset = () => hits.clear();
  limiter.stop = () => clearInterval(timer);
  return limiter;
}

// ---------------------------------------------------------------------------------------------
// Same-origin check (CSRF defence for state-changing requests)
// ---------------------------------------------------------------------------------------------

function firstHeaderValue(v) {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string") return "";
  const i = s.indexOf(",");
  return (i >= 0 ? s.slice(0, i) : s).trim();
}

/** Canonical origin ("https://host[:port]", default ports dropped), or null when unparseable. */
function canonicalOrigin(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** The origin this request was addressed to, as the browser saw it. */
function requestOrigin(req, trustProxy) {
  const forwardedProto = trustProxy ? firstHeaderValue(req.headers["x-forwarded-proto"]).toLowerCase() : "";
  const forwardedHost = trustProxy ? firstHeaderValue(req.headers["x-forwarded-host"]) : "";
  const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : req.socket?.encrypted ? "https" : "http";
  const host = forwardedHost || firstHeaderValue(req.headers.host);
  if (!host) return null;
  return canonicalOrigin(`${proto}://${host}`);
}

/** Build the check for one config ({ trustProxy, publicUrl }). */
function createSameOriginCheck(config = {}) {
  const publicOrigin = canonicalOrigin(config.publicUrl);
  const trustProxy = config.trustProxy;
  return function sameOrigin(req, res, next) {
    checkSameOrigin(req, { trustProxy, publicOrigin }, next);
  };
}

function checkSameOrigin(req, { trustProxy, publicOrigin }, next) {
  if (SAFE_METHODS.has(String(req.method).toUpperCase())) return next();
  const forbidden = () => next(new AppError(403, "forbidden", "Cross-origin request refused."));
  const originHeader = req.headers.origin;
  if (originHeader === undefined) {
    // Browsers that omit Origin still label cross-site requests via Fetch Metadata. Non-browser
    // clients (curl, Stripe webhooks) send neither and are allowed: they carry no victim cookie.
    const site = req.headers["sec-fetch-site"];
    if (site && site !== "same-origin" && site !== "none") return forbidden();
    return next();
  }
  // "null" (sandboxed frames, some redirects), garbage and multi-valued headers (browsers send
  // exactly one Origin; Node joins duplicates with ", ", which fails to parse) never match.
  const origin = canonicalOrigin(typeof originHeader === "string" ? originHeader : null);
  if (!origin) return forbidden();
  if (origin === requestOrigin(req, Boolean(trustProxy)) || (publicOrigin && origin === publicOrigin)) return next();
  return forbidden();
}

/**
 * Express middleware for state-changing routes. Usable two ways:
 *   app.use('/api', requireSameOrigin)          plain middleware; reads req.app.locals.config if
 *                                               set, else trusts X-Forwarded-* only when express
 *                                               'trust proxy' is enabled
 *   app.use('/api', requireSameOrigin(config))  configured middleware (same as auth.requireSameOrigin)
 * Mount the Stripe webhook before it: Stripe sends no Origin, but keeping the webhook outside
 * this check makes that explicit.
 */
function requireSameOrigin(reqOrConfig, res, next) {
  if (typeof next !== "function") return createSameOriginCheck(reqOrConfig || {});
  const req = reqOrConfig;
  const cfg = req.app?.locals?.config;
  const trustProxy = cfg ? cfg.trustProxy : Boolean(typeof req.app?.get === "function" && req.app.get("trust proxy"));
  checkSameOrigin(req, { trustProxy, publicOrigin: canonicalOrigin(cfg?.publicUrl) }, next);
}

module.exports = {
  createAuth,
  publicUser,
  securityHeaders,
  rateLimit,
  requireSameOrigin,
  createSameOriginCheck,
  parseCookies,
  normalizeEmail,
  SESSION_COOKIE,
  CSP,
  PASSWORD_MIN,
  PASSWORD_MAX,
};
