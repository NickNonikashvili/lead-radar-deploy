// Accounts, sessions and the web-security middleware.
//
// Sessions are opaque random tokens in an HttpOnly cookie. Only sha256(token) is stored, so a
// database leak does not hand out live sessions. Passwords use async scrypt (src/crypto.js) on the
// threadpool, a few at a time. Every account gets its own wrapped data key (DEK) at signup;
// "delete everything" removes the user's rows and the wrapped DEK from the live database (and
// truncates the WAL), which makes leftover ciphertext there unreadable. Backups taken earlier
// still hold both until they expire (see src/crypto.js).
//
// CSRF: the session cookie is SameSite=Lax (no cookie on cross-site POST/fetch) and
// requireSameOrigin rejects state-changing requests whose Origin is not ours. Either alone stops
// classic CSRF; both together also cover sibling-subdomain CSRF, which SameSite does not.
// Cookie injection ("tossing") from a sibling subdomain is a different attack: a sibling can set a
// plain-named cookie for the parent domain, but not a __Host- one, which is why production uses
// __Host-gode_session (see the middleware).
//
// Admins: with ADMIN_EMAILS set, exactly the listed addresses are admins, re-checked on every
// request, so removing an address revokes admin at once. Without it, the first account becomes
// admin only when FIRST_USER_ADMIN is on (the default outside production); in production use
// `node scripts/make-admin.js <email>`. Emails are not verified, so a listed address can be
// registered by someone else before its owner does: sign up with it right after deploying.
const net = require("net");
const { newId, now, microsToUsd, usdToMicros, AppError } = require("./util");
const { hashPassword, verifyPassword, needsRehash, randomToken, sha256 } = require("./crypto");

// Development (plain http) cookie name. In production it is also the pre-__Host- name, still read
// for one release so existing sessions survive the rename (moved to the new name on first use).
const SESSION_COOKIE = "gode_session";
// Production (COOKIE_SECURE) cookie. Browsers only accept a __Host- cookie that is Secure, has
// Path=/ and no Domain, so a page on a sibling subdomain cannot plant one for us.
const HOST_SESSION_COOKIE = "__Host-gode_session";
const DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD_MIN = 8;
// Bounds the work an attacker can make scrypt do per request and keeps the UI honest.
const PASSWORD_MAX = 200;
const EMAIL_MAX = 254;
// randomToken(32) is 43 base64url chars. Anything far outside that is junk: skip the DB lookup.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,256}$/;
// When a browser sends several cookies with our name (e.g. one tossed in from a sibling
// subdomain), look at a few instead of letting the first bogus one log the user out.
const MAX_SESSION_CANDIDATES = 3;
// scrypt jobs at once (32 MiB each). The libuv threadpool has 4 threads by default and also serves
// DNS lookups and file I/O for everything else, so passwords never take all of it.
const HASH_CONCURRENCY = 2;
// Hash jobs allowed to wait; beyond that a login or signup is refused at once (503) instead of
// queueing without bound under a flood.
const HASH_QUEUE_MAX = 64;
// HMAC label of the one-bonus-per-email fingerprints (bonus_claims.email_hmac).
const BONUS_HMAC_LABEL = "signup-bonus-email";

// A small built-in list of the most common passwords (checked lower-cased). Not a breach corpus:
// it stops the passwords every guessing script tries first.
const COMMON_PASSWORDS = new Set(
  [
    "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword",
    "12345678", "123456789", "1234567890", "0123456789", "87654321", "98765432", "12341234", "11223344",
    "11111111", "00000000", "22222222", "88888888", "99999999", "12121212", "123123123", "112233445566",
    "qwertyui", "qwertyuiop", "qwerty12", "qwerty123", "qwerty1234", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx",
    "zaq12wsx", "q1w2e3r4", "asdfghjk", "asdfghjkl", "asdfasdf", "zxcvbnm1", "abcd1234", "abc12345",
    "abcdefgh", "iloveyou", "iloveyou1", "letmein1", "letmein123", "welcome1", "welcome123", "admin123",
    "administrator", "changeme", "changeme1", "sunshine", "princess", "football", "baseball", "superman",
    "starwars", "whatever", "trustno1", "computer", "internet", "michelle", "jennifer", "michael1",
    "monkey123", "dragon123", "shadow12", "master12", "freedom1", "pa55word", "passpass", "secret12",
    "secret123", "test1234", "testtest", "default1", "letmeinplease", "gode1234", "godegode",
  ]
);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The Content-Security-Policy. Generated media comes back as data:/blob: URLs (mock, OpenAI
 * images) or as links on a media CDN (fal). With the media proxy on (MEDIA_PROXY, the default)
 * those links are served from our own /api/media, so the page may load images and media from
 * 'self' only and the browser can never contact a media host (which would learn the user's IP).
 * Only with the proxy off is https: allowed for them.
 */
function cspFor(config = {}) {
  const proxied = config?.privacy?.mediaProxy !== false;
  const mediaSrc = proxied ? "'self' data: blob:" : "'self' data: blob: https:";
  return [
    "default-src 'self'",
    // Only our own files: public/app.js is plain JavaScript on the vendored React UMD build, so
    // nothing is compiled or eval'd in the browser. Never add 'unsafe-eval' or 'unsafe-inline' here.
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${mediaSrc}`,
    `media-src ${mediaSrc}`,
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // Billing hands the browser off to Stripe Checkout.
    "form-action 'self' https://checkout.stripe.com",
  ].join("; ");
}

// The default policy (media proxy on).
const CSP = cspFor({});

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

/**
 * Rules for a NEW password (signup, change, reset). Login never applies them: an old password that
 * predates a rule must still log in.
 * @param {string} password
 * @param {{ email?: string }} [opts]  the account's normalized email, to refuse it as the password
 */
function validatePassword(password, { email } = {}) {
  const bad = (message) => new AppError(400, "bad_request", message);
  if (typeof password !== "string" || password.length < PASSWORD_MIN) throw bad(`Password must be at least ${PASSWORD_MIN} characters.`);
  if (password.length > PASSWORD_MAX) throw bad(`Password must be at most ${PASSWORD_MAX} characters.`);
  if (!password.trim()) throw bad("Password can't be only spaces.");
  const lower = password.toLowerCase();
  if (/^(.)\1*$/su.test(password)) throw bad("Choose a password that isn't one character repeated.");
  if (COMMON_PASSWORDS.has(lower.trim())) throw bad("That password is too common. Choose one that is harder to guess.");
  if (email && (lower === email || lower === email.slice(0, email.lastIndexOf("@")))) {
    throw bad("Don't use your email address as your password.");
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

/**
 * Run async jobs at most `concurrency` at a time, with at most `maxQueue` waiting; past that the
 * job is refused with 503 instead of queued.
 */
function createJobQueue({ concurrency, maxQueue }) {
  let active = 0;
  const waiting = [];
  function next() {
    while (active < concurrency && waiting.length) {
      const job = waiting.shift();
      active += 1;
      Promise.resolve()
        .then(job.fn)
        .then(job.resolve, job.reject)
        .finally(() => {
          active -= 1;
          next();
        });
    }
  }
  const run = (fn) => {
    if (active >= concurrency && waiting.length >= maxQueue) {
      return Promise.reject(new AppError(503, "unavailable", "Too many sign-ins right now. Try again in a moment."));
    }
    return new Promise((resolve, reject) => {
      waiting.push({ fn, resolve, reject });
      next();
    });
  };
  run.stats = () => ({ active, waiting: waiting.length });
  return run;
}

/**
 * The address a signup bonus is counted against: lower-cased, "+tag" dropped, and for Gmail also
 * the dots (gmail ignores both), so a+1@x and a+2@x share one bonus.
 */
function bonusEmailKey(email) {
  const at = email.lastIndexOf("@");
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Start of the UTC day of `t` (ms). */
function utcDayStart(t) {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
  const adminEmails = new Set((config.adminEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean));
  const firstUserAdmin = Boolean(config.firstUserAdmin);
  const signupBonusMicros = usdToMicros(config.billing?.signupCreditUsd || 0);
  const bonusDailyCap = Math.max(0, Math.floor(Number(config.billing?.signupBonusDailyCap) || 0));
  if (credits && signupBonusMicros > 0 && typeof keyring.hmac !== "function") {
    throw new TypeError("createAuth: keyring.hmac is required for the signup bonus (one per email address)");
  }
  const cookieSecure = Boolean(config.cookieSecure);
  const cookieName = cookieSecure ? HOST_SESSION_COOKIE : SESSION_COOKIE;
  // TODO(next release): drop the legacy name. Until then a pre-rename production cookie still
  // signs in, and is re-issued under the __Host- name on first use (see middleware).
  const legacyCookieName = cookieSecure ? SESSION_COOKIE : null;
  const hashJobs = createJobQueue({ concurrency: HASH_CONCURRENCY, maxQueue: HASH_QUEUE_MAX });
  // Pay the one-off dummy hash at boot, not on the first unknown-email login.
  getDummyHash().catch(() => {});

  const stmt = {
    userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    countUsers: db.prepare("SELECT COUNT(*) AS n FROM users"),
    insertUser: db.prepare(
      "INSERT INTO users (id, email, password_hash, wrapped_dek, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ),
    setAdmin: db.prepare("UPDATE users SET is_admin = ? WHERE id = ?"),
    setPasswordHash: db.prepare("UPDATE users SET password_hash = ? WHERE id = ?"),
    bonusClaimed: db.prepare("SELECT 1 AS hit FROM bonus_claims WHERE email_hmac = ?"),
    bonusClaimsSince: db.prepare("SELECT COUNT(*) AS n FROM bonus_claims WHERE created_at >= ?"),
    insertBonusClaim: db.prepare("INSERT INTO bonus_claims (email_hmac, created_at) VALUES (?, ?)"),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"),
    sessionUser: db.prepare(
      "SELECT s.expires_at AS session_expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"
    ),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    deleteOtherSessions: db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?"),
    deleteAllSessions: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
    deleteExpiredForUser: db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?"),
    deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
  };

  function isAdminEmail(email) {
    return adminEmails.has(String(email || "").toLowerCase());
  }

  /** Admin for a new account. Call inside the signup transaction (the user count must be exact). */
  function adminAtSignup(email) {
    if (adminEmails.size) return isAdminEmail(email);
    return firstUserAdmin && stmt.countUsers.get().n === 0;
  }

  /**
   * With ADMIN_EMAILS set, the list is the truth: bring the stored flag in line (a write only when it
   * changed) and return the row as it should be seen. Without it, the stored flag stands
   * (FIRST_USER_ADMIN or scripts/make-admin.js set it).
   */
  function syncAdmin(row) {
    if (!row || !adminEmails.size) return row;
    const want = isAdminEmail(row.email) ? 1 : 0;
    if (Number(row.is_admin) === want) return row;
    stmt.setAdmin.run(want, row.id);
    return { ...row, is_admin: want };
  }

  /**
   * One signup bonus per email address (normalized, HMAC-keyed so the address itself is not kept
   * after "delete everything"), and at most bonusDailyCap per UTC day. Call inside the signup
   * transaction. Returns true when this signup gets the bonus (and records the claim).
   */
  function claimBonus(email, t) {
    const fingerprint = keyring.hmac(BONUS_HMAC_LABEL, bonusEmailKey(email));
    if (stmt.bonusClaimed.get(fingerprint)) return false;
    if (bonusDailyCap > 0 && stmt.bonusClaimsSince.get(utcDayStart(t)).n >= bonusDailyCap) return false;
    stmt.insertBonusClaim.run(fingerprint, t);
    return true;
  }

  async function signup({ email, password } = {}) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new AppError(400, "bad_request", "Enter a valid email address.");
    validatePassword(password, { email: normalized });
    // scrypt runs before the transaction so the write lock is held only for the inserts. It also
    // runs for an address that already has an account, so the 409 below costs the same time.
    const passwordHash = await hashJobs(() => hashPassword(password));
    const wrappedDek = keyring.newWrappedDek();
    const id = newId();
    const t = now();

    let bonusMicros = 0;
    db.tx(() => {
      if (stmt.userByEmail.get(normalized)) {
        throw new AppError(409, "conflict", "An account with this email already exists.");
      }
      const isAdmin = adminAtSignup(normalized) ? 1 : 0;
      try {
        stmt.insertUser.run(id, normalized, passwordHash, wrappedDek, isAdmin, t);
      } catch (e) {
        // Backstop for the UNIQUE index (another process wrote the same email).
        if (/UNIQUE/i.test(String(e && e.message))) {
          throw new AppError(409, "conflict", "An account with this email already exists.");
        }
        throw e;
      }
      // Same transaction: an account never exists without its bonus, nor a bonus (or a claim)
      // without an account.
      if (credits && signupBonusMicros > 0 && claimBonus(normalized, t)) {
        credits.grant(id, signupBonusMicros, "signup_bonus", "signup");
        bonusMicros = signupBonusMicros;
      }
    });
    const user = toUser(stmt.userById.get(id));
    Object.defineProperty(user, "signupBonusMicros", { value: bonusMicros, enumerable: false });
    return user;
  }

  async function login({ email, password } = {}) {
    const normalized = normalizeEmail(email);
    const row = normalized ? stmt.userByEmail.get(normalized) : undefined;
    // Always run one scrypt verification, even for unknown or malformed emails.
    const candidate = typeof password === "string" && password.length <= PASSWORD_MAX ? password : "";
    const stored = row ? row.password_hash : await getDummyHash();
    const ok = await hashJobs(() => verifyPassword(candidate, stored));
    if (!row || !ok || candidate !== password) {
      throw new AppError(401, "unauthorized", "Wrong email or password.");
    }
    // The account may have been deleted while scrypt ran.
    let fresh = stmt.userById.get(row.id);
    if (!fresh) throw new AppError(401, "unauthorized", "Wrong email or password.");
    // Upgrade a hash made with older scrypt parameters while we have the password.
    if (needsRehash(fresh.password_hash)) {
      const upgraded = await hashJobs(() => hashPassword(candidate));
      stmt.setPasswordHash.run(upgraded, fresh.id);
      fresh = stmt.userById.get(fresh.id) || fresh;
    }
    return toUser(syncAdmin(fresh));
  }

  /** True when `password` is this user's password (for re-confirmation: delete, password change). */
  async function checkPassword(user, password) {
    if (!user || typeof password !== "string" || password.length > PASSWORD_MAX) return false;
    const row = stmt.userById.get(user.id);
    if (!row) return false;
    return hashJobs(() => verifyPassword(password, row.password_hash));
  }

  /**
   * Change the password after confirming the current one; every other session of the account is
   * signed out (keepToken = this request's session stays). Returns { revoked } (sessions ended).
   */
  async function changePassword(user, { current, next, keepToken } = {}) {
    if (!user || typeof user.id !== "string") throw new AppError(401, "unauthorized", "Please sign in.");
    const row = stmt.userById.get(user.id);
    if (!row) throw new AppError(404, "not_found", "Account not found.");
    if (!(await checkPassword(row, current))) throw new AppError(401, "unauthorized", "Your current password is not right.");
    validatePassword(next, { email: row.email });
    if (next === current) throw new AppError(400, "bad_request", "Choose a new password that is different from the current one.");
    const hash = await hashJobs(() => hashPassword(next));
    const revoked = db.tx(() => {
      if (!stmt.userById.get(row.id)) throw new AppError(404, "not_found", "Account not found.");
      stmt.setPasswordHash.run(hash, row.id);
      return isTokenShaped(keepToken) ? stmt.deleteOtherSessions.run(row.id, sha256(keepToken)).changes : stmt.deleteAllSessions.run(row.id).changes;
    });
    return { revoked };
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
    return toUser(syncAdmin(userRow));
  }

  /** Remove every expired session (e.g. from a boot or cron hook). Returns the number removed. */
  function purgeExpiredSessions() {
    return stmt.deleteExpired.run(now()).changes;
  }

  function cookieAttributes(maxAgeSeconds) {
    const expires = new Date(maxAgeSeconds > 0 ? now() + maxAgeSeconds * 1000 : 0).toUTCString();
    // Path=/ and no Domain: required for the __Host- prefix, and keeps the cookie on this host only.
    const attrs = [`Path=/`, `Max-Age=${maxAgeSeconds}`, `Expires=${expires}`, "HttpOnly", "SameSite=Lax"];
    if (cookieSecure) attrs.push("Secure");
    return attrs.join("; ");
  }

  function setCookie(res, token) {
    if (!isTokenShaped(token)) throw new TypeError("setCookie: invalid session token");
    // base64url tokens need no encoding.
    appendSetCookie(res, `${cookieName}=${token}; ${cookieAttributes(Math.floor(sessionMs / 1000))}`);
  }

  function clearCookie(res, { legacy = true } = {}) {
    appendSetCookie(res, `${cookieName}=; ${cookieAttributes(0)}`);
    if (legacy && legacyCookieName) appendSetCookie(res, `${legacyCookieName}=; ${cookieAttributes(0)}`);
  }

  /**
   * The session among `tokens` (cookie values in header order), or null. Two different users'
   * valid sessions in one request is the signature of a tossed cookie: neither is used.
   */
  function resolveSession(tokens) {
    const found = new Map(); // user id -> { user, token }
    for (const token of tokens.slice(0, MAX_SESSION_CANDIDATES)) {
      const user = userFromToken(token);
      if (user && !found.has(user.id)) found.set(user.id, { user, token });
    }
    if (found.size > 1) return { conflict: true };
    return found.size === 1 ? found.values().next().value : null;
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
        const current = pairs.filter(([name]) => name === cookieName).map(([, v]) => v);
        const legacy = legacyCookieName ? pairs.filter(([name]) => name === legacyCookieName).map(([, v]) => v) : [];
        let hit = resolveSession(current);
        let fromLegacy = false;
        // The legacy name only counts when no current cookie is valid: a tossed plain-name cookie
        // can never override a real __Host- session.
        if (!hit && legacy.length) {
          hit = resolveSession(legacy);
          fromLegacy = Boolean(hit && !hit.conflict);
        }
        if (hit && !hit.conflict) {
          req.user = hit.user;
          req.sessionToken = hit.token;
          if (fromLegacy) {
            // Same session, new name; the old Path=/ cookie is dropped.
            setCookie(res, hit.token);
            appendSetCookie(res, `${legacyCookieName}=; ${cookieAttributes(0)}`);
          }
        } else if (!hit && (current.length || legacy.length)) {
          // A stale or forged cookie: tell the browser to drop it so it stops being sent.
          clearCookie(res);
        }
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
    const cookies = req.cookies || parseCookies(req.headers.cookie);
    const token = req.sessionToken || cookies[cookieName] || (legacyCookieName && cookies[legacyCookieName]);
    destroySession(token);
    clearCookie(res);
  }

  /**
   * Delete the account and everything tied to it, in one transaction. Ledger rows stay (the
   * books must balance across all users) but lose their link to the person. Child rows are
   * deleted explicitly rather than trusting ON DELETE CASCADE alone, so this still holds on a
   * connection opened without PRAGMA foreign_keys, and we can report exact counts.
   * bonus_claims rows stay too: they hold only a keyed fingerprint of the address, and stop the
   * same address from collecting a second signup bonus.
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
    // secure_delete (src/db.js) zeroed the freed pages of the main file; the WAL still holds the
    // pre-delete frames until a checkpoint rewrites and truncates it.
    checkpointWal(db);
    return result.counts;
  }

  return {
    signup,
    login,
    checkPassword,
    changePassword,
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
    cookieName,
    isAdminEmail,
    hashQueueStats: () => hashJobs.stats(),
    // Same check as the module-level export, bound to this app's config.
    requireSameOrigin: createSameOriginCheck(config),
    publicUser,
  };
}

/**
 * Move the WAL into the main database file and truncate it, so rows deleted for privacy ("delete
 * everything", a deleted conversation) don't linger as old WAL frames. With PRAGMA secure_delete
 * the main file's freed pages are already zeroed. An open reader on another connection (a backup,
 * the cron learner) can keep it from completing: then it is retried a few times in the
 * background. In-memory databases have no WAL; the pragma is a harmless no-op there.
 * @returns {boolean} true when the checkpoint completed now
 */
function checkpointWal(db, { attempts = 5, delayMs = 2000 } = {}) {
  let row;
  try {
    row = db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
  } catch {
    if (db.isOpen === false) return false; // closed meanwhile (shutdown)
    row = { busy: 1 }; // e.g. SQLITE_BUSY from another connection's lock
  }
  if (!row || !row.busy) return true;
  if (attempts > 1) {
    const timer = setTimeout(() => {
      try {
        if (db.isOpen === false) return;
        checkpointWal(db, { attempts: attempts - 1, delayMs });
      } catch {
        // The database was closed meanwhile (shutdown): nothing left to do.
      }
    }, delayMs);
    timer.unref?.();
  }
  return false;
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
    res.setHeader("Content-Security-Policy", cspFor(cfg));
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
 * IPv6 address -> its 8 hextets (4 hex digits each), or null. Handles "::" and an embedded IPv4
 * tail ("64:ff9b::192.0.2.1").
 */
function expandIPv6(addr) {
  let s = String(addr).toLowerCase();
  if (!net.isIPv6(s)) return null;
  const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    s = s.slice(0, v4.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const double = s.indexOf("::");
  const head = (double >= 0 ? s.slice(0, double) : s).split(":").filter(Boolean);
  const tail = double >= 0 ? s.slice(double + 2).split(":").filter(Boolean) : [];
  const fill = double >= 0 ? Array(Math.max(0, 8 - head.length - tail.length)).fill("0") : [];
  const groups = [...head, ...fill, ...tail];
  return groups.length === 8 ? groups.map((g) => g.padStart(4, "0")) : null;
}

/**
 * The network a client address belongs to, as rate limits should count it: an IPv4 address as is
 * (IPv4-mapped IPv6 "::ffff:a.b.c.d" included) and an IPv6 address by its /64 prefix. One
 * customer usually gets a whole /64, so keying on the full IPv6 address would hand every client
 * billions of fresh rate-limit buckets.
 */
function ipPrefix(ip) {
  let a = String(ip || "").trim();
  if (!a) return null;
  a = a.replace(/^\[(.*)\]$/, "$1").replace(/%.*$/, ""); // brackets, zone id
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(a);
  if (mapped) a = mapped[1];
  if (net.isIPv4(a)) return a;
  const groups = expandIPv6(a);
  return groups ? `${groups.slice(0, 4).join(":")}::/64` : a;
}

/** The rate-limit key of a request's client (see ipPrefix). Needs 'trust proxy' behind a proxy. */
function ipKey(req) {
  return ipPrefix(req.ip || req.socket?.remoteAddress) || "unknown";
}

/**
 * Fixed-window in-memory limiter (single process, which is how Gode runs). Responds through the
 * error handler with 429 rate_limited and a Retry-After header.
 * @param {{ windowMs: number, max: number, key?: (req) => string|null }} opts
 *   key defaults to ipKey(req) (IPv6 by /64); a falsy key skips limiting for that request. Behind
 *   a reverse proxy req.ip is only the client when express 'trust proxy' is set.
 * Besides the middleware (which counts every request), limiter.peek(key) / limiter.hit(key) let a
 * route count only some outcomes, e.g. failed logins.
 */
function rateLimit({ windowMs, max, key, maxKeys = 50_000 } = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new TypeError("rateLimit: windowMs must be a positive number");
  if (!Number.isInteger(max) || max <= 0) throw new TypeError("rateLimit: max must be a positive integer");
  if (key !== undefined && typeof key !== "function") throw new TypeError("rateLimit: key must be a function");
  const keyOf = key || ipKey;
  const hits = new Map(); // key -> { count, resetAt }; insertion order = oldest window first

  function sweep(t) {
    for (const [k, entry] of hits) if (entry.resetAt <= t) hits.delete(k);
  }

  // Periodic cleanup so one-off visitors don't accumulate; unref'd so it never keeps the process alive.
  const timer = setInterval(() => sweep(now()), Math.min(Math.max(windowMs, 1000), 60_000));
  timer.unref?.();

  /** The live window for k, opened (count 0) when there is none. */
  function windowFor(k, t) {
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
    return entry;
  }

  const retryAfterOf = (entry, t) => Math.max(1, Math.ceil((entry.resetAt - t) / 1000));

  function limiter(req, res, next) {
    let k;
    try {
      k = keyOf(req);
    } catch (err) {
      return next(err);
    }
    if (!k) return next();
    const t = now();
    const entry = windowFor(String(k), t);
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = retryAfterOf(entry, t);
      res.setHeader("Retry-After", String(retryAfter));
      return next(new AppError(429, "rate_limited", `Too many requests. Try again in ${retryAfter} s.`));
    }
    next();
  }

  /** Seconds until `k` may be counted again (0 when it is under the limit). Counts nothing. */
  limiter.peek = (k) => {
    if (!k) return 0;
    const t = now();
    const entry = hits.get(String(k));
    return entry && entry.resetAt > t && entry.count >= max ? retryAfterOf(entry, t) : 0;
  };
  /** Count one event for `k`. */
  limiter.hit = (k) => {
    if (!k) return;
    windowFor(String(k), now()).count += 1;
  };
  limiter.max = max;
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
  validatePassword,
  bonusEmailKey,
  ipKey,
  ipPrefix,
  checkpointWal,
  cspFor,
  SESSION_COOKIE,
  HOST_SESSION_COOKIE,
  BONUS_HMAC_LABEL,
  CSP,
  PASSWORD_MIN,
  PASSWORD_MAX,
};
