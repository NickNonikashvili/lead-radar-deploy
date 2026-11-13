'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const uploads = require('../src/uploads');
const { makeEngineEnv, createUser, createAccount } = require('./send-helpers');

test('saveUpload stores a private file under <dataDir>/uploads with a random name', () => {
  const env = makeEngineEnv();
  try {
    const userId = createUser(env.db);
    const up = uploads.saveUpload(env, userId, { filename: '../../etc/pass\r\nwd.txt', contentType: 'Text/Plain; charset=utf-8', buffer: Buffer.from('hello') });
    assert.match(up.id, /^[A-Za-z0-9_-]{24}$/);
    assert.deepEqual({ ...up, id: undefined }, { id: undefined, filename: 'passwd.txt', contentType: 'text/plain', size: 5 });
    const row = uploads.getUpload(env.db, userId, up.id);
    assert.equal(row.path, path.join(env.dataDir, 'uploads', up.id));
    assert.equal(fs.statSync(row.path).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.dirname(row.path)).mode & 0o777, 0o700);
    assert.equal(uploads.readUpload(row).toString(), 'hello');

    // Odd content types and empty names get safe defaults.
    const odd = uploads.saveUpload(env, userId, { filename: '', contentType: 'text/html\r\nX-Evil: 1', buffer: Buffer.alloc(0) });
    assert.deepEqual([odd.filename, odd.contentType, odd.size], ['attachment', 'application/octet-stream', 0]);
  } finally {
    env.close();
  }
});

test('uploads are private to their user and size-limited', () => {
  const env = makeEngineEnv();
  try {
    const alice = createUser(env.db);
    const mallory = createUser(env.db);
    const up = uploads.saveUpload(env, alice, { filename: 'a.txt', contentType: 'text/plain', buffer: Buffer.from('a') });
    assert.equal(uploads.getUpload(env.db, mallory, up.id), null);
    assert.equal(uploads.deleteUpload(env, mallory, up.id), false);
    assert.ok(uploads.getUpload(env.db, alice, up.id), 'still there');
    assert.equal(uploads.getUpload(env.db, alice, '../x'), null);
    assert.equal(uploads.getUpload(env.db, alice, null), null);

    assert.throws(
      () => uploads.saveUpload(env, alice, { filename: 'big.bin', contentType: 'application/octet-stream', buffer: Buffer.alloc(uploads.MAX_UPLOAD_BYTES + 1) }),
      (err) => err.status === 413 && err.code === 'UPLOAD_TOO_LARGE'
    );
    assert.throws(() => uploads.saveUpload(env, alice, { filename: 'x', contentType: 'text/plain', buffer: 'not a buffer' }), (err) => err.code === 'INVALID_UPLOAD');

    // A row whose path was tampered with is never read.
    const row = uploads.getUpload(env.db, alice, up.id);
    assert.throws(() => uploads.readUpload({ ...row, path: '/etc/passwd' }), (err) => err.code === 'ATTACHMENT_GONE');
    fs.rmSync(row.path);
    assert.throws(() => uploads.readUpload(row), (err) => err.status === 410 && err.code === 'ATTACHMENT_GONE');

    assert.equal(uploads.deleteUpload(env, alice, up.id), true);
    assert.equal(uploads.getUpload(env.db, alice, up.id), null);
  } finally {
    env.close();
  }
});

test('cleanupUploads removes abandoned uploads and stray files, keeps ones the outbox still needs', () => {
  const env = makeEngineEnv();
  try {
    const userId = createUser(env.db);
    const account = createAccount(env.db, env.crypto, userId, {});
    const save = (name) => uploads.saveUpload(env, userId, { filename: name, contentType: 'text/plain', buffer: Buffer.from(name) });
    const old = save('old.txt');
    const queued = save('queued.txt');
    const fresh = save('fresh.txt');
    const dayAgo = Date.now() - 25 * 60 * 60 * 1000;
    env.db.prepare('UPDATE uploads SET created_at = ? WHERE id IN (?, ?)').run(dayAgo, old.id, queued.id);
    env.db
      .prepare("INSERT INTO outbox (user_id, account_id, payload, send_at, status, created_at) VALUES (?, ?, ?, ?, 'queued', ?)")
      .run(userId, account.id, JSON.stringify({ attachments: [{ uploadId: queued.id }] }), Date.now() + 1e9, Date.now());

    const dir = path.join(env.dataDir, 'uploads');
    const stray = path.join(dir, 'strayStrayStrayStray1234');
    fs.writeFileSync(stray, 'x');
    fs.utimesSync(stray, new Date(dayAgo), new Date(dayAgo));
    const unrelated = path.join(dir, 'README');
    fs.writeFileSync(unrelated, 'not ours');

    assert.deepEqual(uploads.cleanupUploads(env), { removed: 1, strayFiles: 1 });
    assert.equal(uploads.getUpload(env.db, userId, old.id), null);
    assert.ok(!fs.existsSync(path.join(dir, old.id)));
    assert.ok(uploads.getUpload(env.db, userId, queued.id), 'needed by a queued message');
    assert.ok(uploads.getUpload(env.db, userId, fresh.id), 'younger than a day');
    assert.ok(!fs.existsSync(stray));
    assert.ok(fs.existsSync(unrelated), 'files that cannot be uploads are left alone');

    // Once the message is gone, its upload goes too.
    env.db.prepare('DELETE FROM outbox').run();
    assert.equal(uploads.cleanupUploads(env).removed, 1);
    assert.equal(uploads.cleanupUploads(env, { olderThanMs: 0 }).removed, 1, 'olderThanMs 0 removes everything unused');
  } finally {
    env.close();
  }
});

test('per-user quota stops one user from filling the disk', () => {
  const env = makeEngineEnv();
  try {
    const userId = createUser(env.db);
    const other = createUser(env.db);
    env.db
      .prepare('INSERT INTO uploads (id, user_id, filename, content_type, size, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('fakefakefakefakefakefake', userId, 'x', 'text/plain', 249 * 1024 * 1024, '/nonexistent/fakefakefakefakefakefake', Date.now());
    assert.throws(
      () => uploads.saveUpload(env, userId, { filename: 'x', contentType: 'text/plain', buffer: Buffer.alloc(2 * 1024 * 1024) }),
      (err) => err.status === 413 && err.code === 'UPLOAD_QUOTA'
    );
    assert.ok(uploads.saveUpload(env, other, { filename: 'x', contentType: 'text/plain', buffer: Buffer.alloc(2 * 1024 * 1024) }).id);
  } finally {
    env.close();
  }
});
