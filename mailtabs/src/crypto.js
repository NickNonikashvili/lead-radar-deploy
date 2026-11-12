'use strict';

const nodeCrypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(nodeCrypto.scrypt);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * Authenticated encryption for account secrets (IMAP passwords, OAuth tokens).
 * Format: v1.<iv>.<tag>.<ciphertext>  (all base64url)
 */
function createCrypto(secretKey) {
  if (!secretKey || typeof secretKey !== 'string') throw new Error('createCrypto: secretKey is required');
  const key = Buffer.from(
    nodeCrypto.hkdfSync('sha256', Buffer.from(secretKey, 'utf8'), Buffer.from('mailtabs-v1'), Buffer.from('account-secrets'), 32)
  );

  function encryptJson(obj) {
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', b64url(iv), b64url(tag), b64url(ciphertext)].join('.');
  }

  function decryptJson(str) {
    if (typeof str !== 'string') throw new Error('decryptJson: expected a string');
    const parts = str.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('decryptJson: unknown format');
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('decryptJson: malformed payload');
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  }

  return { encryptJson, decryptJson };
}

async function hashPassword(password) {
  if (typeof password !== 'string') throw new TypeError('password must be a string');
  const salt = nodeCrypto.randomBytes(16);
  const hash = await scryptAsync(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), Buffer.from(hash).toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  try {
    if (typeof password !== 'string' || typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (![N, r, p].every((n) => Number.isInteger(n) && n > 0) || N > 1 << 20) return false;
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (!expected.length) return false;
    const actual = Buffer.from(
      await scryptAsync(password.normalize('NFKC'), salt, expected.length, { N, r, p, maxmem: 256 * 1024 * 1024 })
    );
    return actual.length === expected.length && nodeCrypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

function randomToken(bytes = 32) {
  return nodeCrypto.randomBytes(bytes).toString('base64url');
}

function sha256Hex(str) {
  return nodeCrypto.createHash('sha256').update(String(str), 'utf8').digest('hex');
}

function pkcePair() {
  const verifier = randomToken(48); // 64 chars, within RFC 7636's 43-128
  const challenge = nodeCrypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
  return { verifier, challenge };
}

module.exports = { createCrypto, hashPassword, verifyPassword, randomToken, sha256Hex, pkcePair };
