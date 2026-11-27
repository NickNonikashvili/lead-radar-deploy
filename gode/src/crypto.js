// Passwords, session tokens and per-user envelope encryption.
//
// Envelope encryption: every user gets a random 256-bit data key (DEK). The DEK encrypts that
// user's chats, titles and placeholder maps with AES-256-GCM. The DEK itself is stored only in
// wrapped form (encrypted with the server MASTER KEY), in the users table of the same database.
// Deleting a user deletes the wrapped DEK from the live database (secure_delete zeroes the freed
// pages and "delete everything" truncates the WAL), so leftover ciphertext there is unreadable. A
// BACKUP taken before the deletion still holds both the wrapped DEK and the ciphertext, and the
// master key opens it: deleted data stays readable in backups until those backups expire.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// New hashes: OWASP's scrypt option N=2^15, r=8, p=3 (32 MiB, about 200 ms of one core). Hashes
// made with older parameters keep verifying: verifyPassword reads N, r and p from the stored
// string, and needsRehash() tells the login path to upgrade them.
const SCRYPT = { N: 2 ** 15, r: 8, p: 3, keylen: 64, maxmem: 64 * 1024 * 1024 };
// A stored hash may ask for at most this much memory (128 * N * r bytes), so a corrupt or hostile
// row can't make one verification allocate gigabytes.
const SCRYPT_VERIFY_MAXMEM = 128 * 1024 * 1024;

/** Async scrypt: runs on the libuv threadpool, so a login never blocks other requests or streams. */
function scrypt(password, salt, keylen, opts) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Resolves to "scrypt$N$r$p$<salt b64>$<hash b64>". */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(String(password), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function parseHash(stored) {
  const [algo, N, r, p, saltB64, hashB64] = String(stored).split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return null;
  const params = { N: Number(N), r: Number(r), p: Number(p) };
  if (![params.N, params.r, params.p].every((n) => Number.isSafeInteger(n) && n > 0)) return null;
  return { ...params, salt: Buffer.from(saltB64, "base64"), expected: Buffer.from(hashB64, "base64") };
}

/** Resolves true or false; never rejects (a malformed stored hash is simply no match). */
async function verifyPassword(password, stored) {
  try {
    const h = parseHash(stored);
    if (!h || !h.expected.length) return false;
    const actual = await scrypt(String(password), h.salt, h.expected.length, { N: h.N, r: h.r, p: h.p, maxmem: SCRYPT_VERIFY_MAXMEM });
    return actual.length === h.expected.length && crypto.timingSafeEqual(actual, h.expected);
  } catch {
    return false;
  }
}

/** True when a stored hash uses weaker parameters than new hashes (upgrade it after a login). */
function needsRehash(stored) {
  const h = parseHash(stored);
  return !h || h.N < SCRYPT.N || h.r < SCRYPT.r || h.p < SCRYPT.p;
}

/** URL-safe random token (session cookies, CSRF-free one-time values). */
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

// ---------- AES-256-GCM primitives. Format: "v1.<iv b64url>.<tag b64url>.<ciphertext b64url>" ----------
function seal(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

function open(key, sealed) {
  const parts = String(sealed).split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Unrecognized ciphertext format");
  const [, ivB, tagB, ctB] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]);
}

/**
 * Resolve the 32-byte master key. Order: config.masterKey (base64) -> <dataDir>/master.key (dev only,
 * auto-created with mode 0600). In production a missing key is a hard error.
 */
function loadMasterKey(config) {
  if (config.masterKey) {
    const key = Buffer.from(config.masterKey, "base64");
    if (key.length !== 32) throw new Error("GODE_MASTER_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
    return key;
  }
  if (config.production) {
    throw new Error("GODE_MASTER_KEY is required in production (generate one with: openssl rand -base64 32)");
  }
  const file = path.join(config.dataDir, "master.key");
  if (fs.existsSync(file)) {
    const key = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
    if (key.length === 32) return key;
  }
  fs.mkdirSync(config.dataDir, { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString("base64"), { mode: 0o600 });
  console.warn(`[gode] No GODE_MASTER_KEY set; generated a development key at ${file}. Set GODE_MASTER_KEY in production.`);
  return key;
}

/**
 * Keyring bound to one master key. Unwrapped DEKs are cached in memory (bounded) so we don't
 * decrypt the DEK on every message.
 */
function createKeyring(masterKey, { cacheSize = 500 } = {}) {
  if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) throw new Error("master key must be a 32-byte Buffer");
  const cache = new Map(); // wrappedDek -> dek Buffer (LRU by insertion order)
  const hmacKeys = new Map(); // label -> HKDF-derived key

  function newWrappedDek() {
    return seal(masterKey, crypto.randomBytes(32));
  }

  function unwrap(wrappedDek) {
    const hit = cache.get(wrappedDek);
    if (hit) {
      cache.delete(wrappedDek);
      cache.set(wrappedDek, hit);
      return hit;
    }
    const dek = open(masterKey, wrappedDek);
    cache.set(wrappedDek, dek);
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
    return dek;
  }

  /** Encrypt a string (or JSON-able value when json=true) for the user owning wrappedDek. */
  function encrypt(wrappedDek, value, { json = false } = {}) {
    if (value === null || value === undefined) return null;
    return seal(unwrap(wrappedDek), json ? JSON.stringify(value) : String(value));
  }

  function decrypt(wrappedDek, sealed, { json = false } = {}) {
    if (sealed === null || sealed === undefined || sealed === "") return null;
    const s = open(unwrap(wrappedDek), sealed).toString("utf8");
    return json ? JSON.parse(s) : s;
  }

  function forget(wrappedDek) {
    cache.delete(wrappedDek);
  }

  /**
   * Keyed fingerprint of a value (hex HMAC-SHA256), e.g. of a normalized email for the one-bonus-
   * per-address rule. The key is derived from the master key with HKDF, one key per label, so the
   * master key itself is never used as an HMAC key and fingerprints made for different purposes
   * can't be matched with each other. Unlike a plain sha256, a fingerprint can't be checked
   * against guessed addresses without the master key.
   */
  function hmac(label, value) {
    if (typeof label !== "string" || !label) throw new TypeError("hmac: label is required");
    let key = hmacKeys.get(label);
    if (!key) {
      key = Buffer.from(crypto.hkdfSync("sha256", masterKey, Buffer.alloc(0), `gode-hmac:${label}`, 32));
      hmacKeys.set(label, key);
    }
    return crypto.createHmac("sha256", key).update(String(value), "utf8").digest("hex");
  }

  return { newWrappedDek, encrypt, decrypt, forget, hmac };
}

module.exports = { hashPassword, verifyPassword, needsRehash, SCRYPT, randomToken, sha256, seal, open, loadMasterKey, createKeyring };
