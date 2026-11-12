'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const nodeCrypto = require('crypto');

const { loadConfig, APP_ROOT } = require('../src/config');
const { openDb, MIGRATIONS } = require('../src/db');
const {
  createCrypto,
  hashPassword,
  verifyPassword,
  randomToken,
  sha256Hex,
  pkcePair,
} = require('../src/crypto');
const { HttpError } = require('../src/errors');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailtabs-foundation-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// -------------------------------------------------------------------------------------------
// config
// -------------------------------------------------------------------------------------------

test('config: defaults', (t) => {
  const dir = tempDir(t);
  const c = loadConfig({ DATA_DIR: dir, SECRET_KEY: 'x'.repeat(40) });
  assert.equal(c.port, 3000);
  assert.equal(c.appUrl, 'http://localhost:3000');
  assert.equal(c.dataDir, dir);
  assert.equal(c.allowSignups, true);
  assert.equal(c.syncIntervalMinutes, 3);
  assert.equal(c.initialSyncLimit, 200);
  assert.equal(c.maxBodyBytes, 5000000);
  assert.equal(c.syncConcurrency, 4);
  assert.equal(c.allowPrivateHosts, false);
  assert.equal(c.trustProxy, false);
  assert.equal(c.cookieSecure, false);
  assert.deepEqual({ ...c.google }, { clientId: '', clientSecret: '', enabled: false });
  assert.equal(c.microsoft.tenant, 'common');
  assert.equal(c.microsoft.enabled, false);
  assert.equal(c.oauthOverrides, null);
  assert.equal(c.disableScheduler, false);
  assert.ok(Object.isFrozen(c));
});

test('config: overrides and parsing', (t) => {
  const dir = tempDir(t);
  const c = loadConfig({
    DATA_DIR: dir,
    SECRET_KEY: 'k'.repeat(64),
    PORT: '8080',
    APP_URL: 'https://mail.example.com///',
    ALLOW_SIGNUPS: 'false',
    SYNC_INTERVAL_MINUTES: '0', // clamped to the minimum of 1
    TRUST_PROXY: '2',
    ALLOW_PRIVATE_IMAP_HOSTS: '1',
    GOOGLE_CLIENT_ID: 'gid',
    GOOGLE_CLIENT_SECRET: 'gsecret',
    MICROSOFT_CLIENT_ID: 'mid', // no secret -> not enabled
    MICROSOFT_TENANT: 'contoso.onmicrosoft.com',
    OAUTH_TEST_ENDPOINTS: '{"google":{"authUrl":"http://127.0.0.1:1/auth"}}',
    DISABLE_SYNC_SCHEDULER: 'true',
  });
  assert.equal(c.port, 8080);
  assert.equal(c.appUrl, 'https://mail.example.com');
  assert.equal(c.cookieSecure, true);
  assert.equal(c.allowSignups, false);
  assert.equal(c.syncIntervalMinutes, 1);
  assert.equal(c.trustProxy, 2);
  assert.equal(c.allowPrivateHosts, true);
  assert.equal(c.google.enabled, true);
  assert.equal(c.microsoft.enabled, false);
  assert.equal(c.microsoft.tenant, 'contoso.onmicrosoft.com');
  assert.equal(c.oauthOverrides.google.authUrl, 'http://127.0.0.1:1/auth');
  assert.equal(c.disableScheduler, true);

  assert.equal(loadConfig({ DATA_DIR: dir, SECRET_KEY: 'k'.repeat(64), ALLOW_SIGNUPS: '0' }).allowSignups, false);
  assert.equal(loadConfig({ DATA_DIR: dir, SECRET_KEY: 'k'.repeat(64), TRUST_PROXY: 'true' }).trustProxy, 1, '"true" means one proxy hop, never trust-everything');
  assert.equal(loadConfig({ DATA_DIR: dir, SECRET_KEY: 'k'.repeat(64), PORT: '4000' }).appUrl, 'http://localhost:4000');
});

test('config: relative DATA_DIR resolves against the app root', (t) => {
  const c = loadConfig({ DATA_DIR: 'data-test-relative', SECRET_KEY: 'k'.repeat(64) });
  assert.equal(c.dataDir, path.join(APP_ROOT, 'data-test-relative'));
  assert.ok(path.isAbsolute(c.dataDir));
});

test('config: generates, persists (0600) and reuses a secret key when SECRET_KEY is unset', (t) => {
  const dir = tempDir(t);
  const warn = t.mock.method(console, 'warn', () => {});
  const first = loadConfig({ DATA_DIR: dir });
  assert.match(first.secretKey, /^[0-9a-f]{64}$/);
  assert.equal(warn.mock.callCount(), 1, 'warns once when generating');

  const keyFile = path.join(dir, '.secret-key');
  assert.equal(fs.readFileSync(keyFile, 'utf8').trim(), first.secretKey);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(keyFile).mode & 0o777, 0o600);
  }

  const second = loadConfig({ DATA_DIR: dir });
  assert.equal(second.secretKey, first.secretKey);
  assert.equal(warn.mock.callCount(), 1, 'does not warn again when reusing');
});

test('config: invalid OAUTH_TEST_ENDPOINTS is ignored with a warning', (t) => {
  const dir = tempDir(t);
  const warn = t.mock.method(console, 'warn', () => {});
  const c = loadConfig({ DATA_DIR: dir, SECRET_KEY: 'k'.repeat(64), OAUTH_TEST_ENDPOINTS: '{nope' });
  assert.equal(c.oauthOverrides, null);
  assert.equal(warn.mock.callCount(), 1);
});

// -------------------------------------------------------------------------------------------
// db
// -------------------------------------------------------------------------------------------

test('db: creates the schema with expected pragmas', () => {
  const db = openDb(':memory:');
  try {
    assert.equal(db.pragma('user_version', { simple: true }), MIGRATIONS.length);
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(db.pragma('busy_timeout', { simple: true }), 5000);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'messages_fts_%'")
      .all()
      .map((r) => r.name)
      .sort();
    assert.deepEqual(tables, ['accounts', 'messages', 'messages_fts', 'oauth_states', 'sessions', 'tab_accounts', 'tabs', 'users']);
  } finally {
    db.close();
  }
});

test('db: migrations are idempotent (openDb twice on the same file keeps data)', (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'mailtabs.db');

  const db1 = openDb(file);
  assert.equal(db1.pragma('journal_mode', { simple: true }), 'wal');
  db1.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)').run('a@example.com', 'A', 'h', 1);
  db1.close();

  const db2 = openDb(file); // must not try to re-create tables
  try {
    assert.equal(db2.pragma('user_version', { simple: true }), MIGRATIONS.length);
    assert.equal(db2.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  } finally {
    db2.close();
  }

  const db3 = openDb(file);
  db3.close();
});

test('db: constraints, cascades and full-text triggers', () => {
  const db = openDb(':memory:');
  try {
    const now = Date.now();
    const userId = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run('Me@Example.com', 'h', now)
      .lastInsertRowid;
    // email is unique case-insensitively
    assert.throws(
      () => db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run('me@example.COM', 'h', now),
      /UNIQUE/
    );

    const accountId = db
      .prepare(
        `INSERT INTO accounts (user_id, provider, auth_type, email, imap_host, imap_port, imap_security, imap_user, secret_enc, created_at)
         VALUES (?, 'imap', 'password', 'work@corp.example', 'imap.corp.example', 993, 'tls', 'work@corp.example', 'x', ?)`
      )
      .run(userId, now).lastInsertRowid;
    const insertMsg = db.prepare(
      `INSERT INTO messages (account_id, mailbox, uid, uid_validity, subject, from_name, from_address, snippet, text_body, date, created_at)
       VALUES (?, 'INBOX', ?, 1, ?, 'Sender', 'sender@example.com', ?, ?, ?, ?)`
    );
    const m1 = insertMsg.run(accountId, 1, 'Quarterly invoice', 'Please pay', 'Invoice body', now, now).lastInsertRowid;
    insertMsg.run(accountId, 2, 'Lunch?', 'Tacos', 'Tacos at noon', now, now);
    assert.throws(() => insertMsg.run(accountId, 1, 'dup', '', '', now, now), /UNIQUE/);

    const search = (q) => db.prepare('SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?').all(q).map((r) => r.rowid);
    assert.deepEqual(search('"invoic"*'), [m1]);

    db.prepare('UPDATE messages SET subject = ? WHERE id = ?').run('Receipt', m1);
    assert.deepEqual(search('"invoice"'), [m1], 'text_body still matches');
    assert.deepEqual(search('subject:"quarterly"'), [], 'old subject removed from index');
    assert.deepEqual(search('"receipt"'), [m1]);

    db.prepare('DELETE FROM messages WHERE id = ?').run(m1);
    assert.deepEqual(search('"receipt"'), []);

    // deleting the user cascades through accounts -> messages
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 0);
    assert.deepEqual(search('"tacos"'), []);
  } finally {
    db.close();
  }
});

// -------------------------------------------------------------------------------------------
// crypto
// -------------------------------------------------------------------------------------------

test('crypto: encryptJson/decryptJson round trip with a random IV', () => {
  const c = createCrypto('a'.repeat(64));
  const secret = { password: 'hunter2 ✓', nested: { n: 1 } };
  const a = c.encryptJson(secret);
  const b = c.encryptJson(secret);
  assert.match(a, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b, 'fresh IV per encryption');
  assert.deepEqual(c.decryptJson(a), secret);
  assert.deepEqual(c.decryptJson(b), secret);
  assert.ok(!a.includes('hunter2'));
});

test('crypto: tampering with any part is detected', () => {
  const c = createCrypto('a'.repeat(64));
  const token = c.encryptJson({ refreshToken: 'rt-123', accessToken: 'at-456' });
  const parts = token.split('.');

  const flip = (b64) => {
    const buf = Buffer.from(b64, 'base64url');
    buf[0] ^= 0x01;
    return buf.toString('base64url');
  };
  for (const i of [1, 2, 3]) {
    const tampered = [...parts];
    tampered[i] = flip(tampered[i]);
    assert.throws(() => c.decryptJson(tampered.join('.')), `tampering with part ${i} must throw`);
  }
  assert.throws(() => c.decryptJson(parts.slice(0, 3).join('.')), /format/);
  assert.throws(() => c.decryptJson(`v2.${parts.slice(1).join('.')}`), /format/);
  assert.throws(() => c.decryptJson(null));
  assert.throws(() => c.decryptJson(`v1.${Buffer.alloc(5).toString('base64url')}.${parts[2]}.${parts[3]}`), /malformed/);
});

test('crypto: a different key cannot decrypt', () => {
  const token = createCrypto('a'.repeat(64)).encryptJson({ password: 'x' });
  assert.throws(() => createCrypto('b'.repeat(64)).decryptJson(token));
  assert.throws(() => createCrypto(''), /secretKey/);
});

test('crypto: password hashing', async () => {
  const stored = await hashPassword('correct horse battery staple');
  assert.match(stored, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.notEqual(stored, await hashPassword('correct horse battery staple'), 'salted');
  assert.equal(await verifyPassword('correct horse battery staple', stored), true);
  assert.equal(await verifyPassword('correct horse battery stapl', stored), false);
  assert.equal(await verifyPassword('', stored), false);
  // malformed inputs are simply "not a match", never a throw
  for (const bad of ['', 'garbage', 'scrypt$1$2$3$4', 'bcrypt$16384$8$1$a$b', 'scrypt$x$8$1$AAAA$AAAA', null, undefined, 42]) {
    assert.equal(await verifyPassword('pw', bad), false, `stored=${String(bad)}`);
  }
  assert.equal(await verifyPassword(null, stored), false);
  await assert.rejects(() => hashPassword(undefined), TypeError);
});

test('crypto: tokens, sha256 and PKCE', () => {
  const t1 = randomToken();
  assert.match(t1, /^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
  assert.notEqual(t1, randomToken());
  assert.equal(randomToken(16).length, 22);

  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

  const { verifier, challenge } = pkcePair();
  assert.ok(verifier.length >= 43 && verifier.length <= 128);
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.equal(challenge, nodeCrypto.createHash('sha256').update(verifier).digest('base64url'));
});

// -------------------------------------------------------------------------------------------
// errors
// -------------------------------------------------------------------------------------------

test('errors: HttpError carries status, code and expose', () => {
  const err = new HttpError(409, 'Taken', 'EMAIL_TAKEN');
  assert.ok(err instanceof Error);
  assert.equal(err.status, 409);
  assert.equal(err.code, 'EMAIL_TAKEN');
  assert.equal(err.expose, true);
  assert.equal(err.message, 'Taken');
});
