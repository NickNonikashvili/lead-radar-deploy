"use strict";
// Stands in for src/crypto.js in the browser preview (same exports, same call shapes).
//
// - sha256 / hmacSha256: synchronous SHA-256 in plain JavaScript, because src/auth.js hashes
//   session tokens synchronously (Web Crypto's digest is async only).
// - hashPassword / verifyPassword: PBKDF2-SHA256 through Web Crypto instead of Node's scrypt
//   (not in browsers). Stored as "pbkdf2$<iterations>$<salt b64>$<hash b64>".
// - createKeyring: the preview keeps chats in this browser's own storage, so "encryption" is an
//   identity encoding with a version prefix ("p1:"). Nothing is sent anywhere; see preview/README.md.

const PBKDF2_ITERATIONS = 60_000;
const PBKDF2_BITS = 256;

// ---- SHA-256 (FIPS 180-4) ----------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8(s) {
  return new TextEncoder().encode(String(s));
}

/** SHA-256 of bytes -> 32 bytes. */
function sha256Bytes(bytes) {
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const bits = len * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
  view.setUint32(padded.length - 4, bits >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function sha256(s) {
  return hex(sha256Bytes(utf8(s)));
}

/** HMAC-SHA256(key, message) as hex (RFC 2104). */
function hmacSha256(key, message) {
  let k = typeof key === "string" ? utf8(key) : key;
  if (k.length > 64) k = sha256Bytes(k);
  const block = new Uint8Array(64);
  block.set(k);
  const inner = new Uint8Array(64);
  const outer = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    inner[i] = block[i] ^ 0x36;
    outer[i] = block[i] ^ 0x5c;
  }
  const msg = utf8(message);
  const a = new Uint8Array(64 + msg.length);
  a.set(inner);
  a.set(msg, 64);
  const ih = sha256Bytes(a);
  const b = new Uint8Array(96);
  b.set(outer);
  b.set(ih, 64);
  return hex(sha256Bytes(b));
}

// ---- tokens and passwords -------------------------------------------------------------------

function randomBytes(n) {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function b64(bytes) {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
}

function unb64(text) {
  const s = atob(String(text));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function randomToken(bytes = 32) {
  return b64(randomBytes(bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pbkdf2(password, salt, iterations) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error("preview: Web Crypto (crypto.subtle) is needed for passwords");
  const key = await subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, PBKDF2_BITS);
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await pbkdf2(String(password), salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

async function verifyPassword(password, stored) {
  try {
    const [algo, n, saltB64, hashB64] = String(stored).split("$");
    const iterations = Number(n);
    if (algo !== "pbkdf2" || !Number.isSafeInteger(iterations) || iterations < 1 || iterations > 10_000_000 || !saltB64 || !hashB64) return false;
    const expected = unb64(hashB64);
    const actual = await pbkdf2(String(password), unb64(saltB64), iterations);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function needsRehash(stored) {
  return !String(stored).startsWith(`pbkdf2$${PBKDF2_ITERATIONS}$`);
}

// ---- keyring --------------------------------------------------------------------------------

const PREFIX = "p1:";

function seal(_key, plaintext) {
  return PREFIX + String(plaintext);
}

function open(_key, sealed) {
  const s = String(sealed);
  if (!s.startsWith(PREFIX)) throw new Error("preview: not a preview-sealed value");
  return s.slice(PREFIX.length);
}

function loadMasterKey() {
  return "preview-master-key";
}

/** Same interface as src/crypto.js createKeyring: newWrappedDek, encrypt, decrypt, forget, hmac. */
function createKeyring(masterKey = loadMasterKey()) {
  function newWrappedDek() {
    return `preview-dek:${randomToken(12)}`;
  }
  function encrypt(_wrappedDek, value, { json = false } = {}) {
    if (value === null || value === undefined) return null;
    return seal(masterKey, json ? JSON.stringify(value) : String(value));
  }
  function decrypt(_wrappedDek, sealed, { json = false } = {}) {
    if (sealed === null || sealed === undefined || sealed === "") return null;
    const s = open(masterKey, sealed);
    return json ? JSON.parse(s) : s;
  }
  function hmac(label, value) {
    if (typeof label !== "string" || !label) throw new TypeError("hmac: label is required");
    return hmacSha256(`${masterKey}:gode-hmac:${label}`, String(value));
  }
  return { newWrappedDek, encrypt, decrypt, forget() {}, hmac };
}

const SCRYPT = Object.freeze({ N: 0, r: 0, p: 0, keylen: 0, maxmem: 0, preview: "pbkdf2" });

module.exports = {
  hashPassword,
  verifyPassword,
  needsRehash,
  SCRYPT,
  randomToken,
  sha256,
  seal,
  open,
  loadMasterKey,
  createKeyring,
  // preview-only helpers
  hmacSha256,
  PBKDF2_ITERATIONS,
};
