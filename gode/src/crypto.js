// Passwords, session tokens and per-user envelope encryption.
//
// Envelope encryption: every user gets a random 256-bit data key (DEK). The DEK encrypts that
// user's chats, titles and placeholder maps with AES-256-GCM. The DEK itself is stored only in
// wrapped form (encrypted with the server MASTER KEY). Deleting a user deletes their wrapped DEK,
// which makes any leftover ciphertext (backups, WAL pages) unreadable.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltB64, hashB64] = String(stored).split("$");
    if (algo !== "scrypt") return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
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

  return { newWrappedDek, encrypt, decrypt, forget };
}

module.exports = { hashPassword, verifyPassword, randomToken, sha256, seal, open, loadMasterKey, createKeyring };
