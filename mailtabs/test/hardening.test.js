'use strict';

// Regression tests for issues found in review: id reuse, transient login refusals,
// one broken message blocking a sync, stale writes after a settings change, and sync
// undoing a read/star change the user just made.

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const { ImapFlow } = require('imapflow');

const { openDb } = require('../src/db');
const imap = require('../src/imap');
const { SyncManager, SettingsChangedError } = require('../src/sync');
const { makeEngineEnv, createUser, createAccount, recordingLogger } = require('./engine-helpers');
const { buildRawMessage } = require('./helpers');

// A Dovecot user no other test file touches.
const V2 = { user: 'v2@test.local', pass: 'v2pw', host: '127.0.0.1', port: 1143 };

function reachable() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: V2.host, port: V2.port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function withV2(fn) {
  const client = new ImapFlow({ host: V2.host, port: V2.port, secure: false, auth: { user: V2.user, pass: V2.pass }, logger: false });
  client.on('error', () => {});
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

async function resetV2() {
  await withV2(async (client) => {
    for (const box of ['INBOX', 'Archive', 'Trash']) {
      const lock = await client.getMailboxLock(box).catch(() => null);
      if (!lock) continue;
      try {
        if (client.mailbox.exists) await client.messageDelete('1:*');
      } finally {
        lock.release();
      }
    }
  });
}

async function appendV2(subject, flags = []) {
  const raw = buildRawMessage({ to: V2.user, subject, text: `Body of ${subject}` });
  return withV2(async (client) => (await client.append('INBOX', raw, flags)).uid);
}

function v2Account(env) {
  const userId = createUser(env.db);
  return createAccount(env.db, env.crypto, userId, { email: V2.user, imap_user: V2.user, password: V2.pass });
}

// ---------------------------------------------------------------------------------------------

test('ids of deleted accounts and messages are never handed out again', () => {
  const db = openDb(':memory:');
  const user = db.prepare("INSERT INTO users (email, password_hash, created_at) VALUES ('u@x.y', 'x', 1)").run().lastInsertRowid;
  const addAccount = (email) =>
    Number(
      db
        .prepare(
          `INSERT INTO accounts (user_id, provider, auth_type, email, imap_host, imap_port, imap_security, imap_user, secret_enc, created_at)
           VALUES (?, 'imap', 'password', ?, 'h', 993, 'tls', 'u', 's', 1)`
        )
        .run(user, email).lastInsertRowid
    );
  const first = addAccount('a@x.y');
  db.prepare('DELETE FROM accounts WHERE id = ?').run(first);
  const second = addAccount('b@x.y');
  assert.notEqual(second, first, 'a newest-row delete must not free its id');

  const addMessage = (uid) =>
    Number(
      db
        .prepare("INSERT INTO messages (account_id, mailbox, uid, uid_validity, date, created_at) VALUES (?, 'INBOX', ?, 1, 1, 1)")
        .run(second, uid).lastInsertRowid
    );
  const m1 = addMessage(1);
  db.prepare('DELETE FROM messages WHERE id = ?').run(m1);
  assert.notEqual(addMessage(2), m1);
});

test('temporary login refusals are not treated as wrong passwords', () => {
  const refusal = (props) => Object.assign(new Error('Command failed'), { authenticationFailed: true }, props);
  for (const code of ['UNAVAILABLE', 'INUSE', 'LIMIT', 'SERVERBUG']) {
    const err = refusal({ serverResponseCode: code, responseText: `[${code}] try later` });
    assert.equal(imap.isAuthFailure(err), false, code);
    assert.match(imap.friendlyImapError(err), /temporarily/);
  }
  assert.equal(imap.isAuthFailure(refusal({ responseText: '[ALERT] Too many simultaneous connections. (Failure)' })), false);
  assert.equal(imap.isAuthFailure(refusal({ serverResponseCode: 'AUTHENTICATIONFAILED', responseText: 'Invalid credentials' })), true);
  assert.equal(imap.isAuthFailure(refusal({ responseText: 'LOGIN failed' })), true, 'a refusal without a reason is a credentials problem');
});

test('one message the server refuses to fetch does not block the others', async () => {
  const env = makeEngineEnv();
  const sync = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: recordingLogger() });
  const refusal = () => Object.assign(new Error('Command failed'), { responseStatus: 'NO', responseText: 'Message conversion failed' });
  const client = {
    usable: true,
    fetch(range) {
      const uids = String(range)
        .split(',')
        .flatMap((part) => {
          const [a, b = a] = part.split(':').map(Number);
          return Array.from({ length: b - a + 1 }, (_, i) => a + i);
        });
      return (async function* () {
        if (uids.length > 1 || uids[0] === 3) throw refusal();
        yield { uid: uids[0] };
      })();
    },
  };
  const got = [];
  const failed = await sync._fetchEach(client, [1, 2, 3, 4], { uid: true }, (msg) => got.push(msg.uid));
  assert.deepEqual(got, [1, 2, 4]);
  assert.deepEqual(failed, [3]);

  // A dead connection is not a per-message problem: it ends the run.
  const dead = { usable: false, fetch: client.fetch };
  await assert.rejects(sync._fetchEach(dead, [1, 2], { uid: true }, () => {}), /Command failed/);
});

test('a sync whose account settings changed mid-run stops writing', () => {
  const env = makeEngineEnv();
  const sync = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: recordingLogger() });
  const account = createAccount(env.db, env.crypto, createUser(env.db));
  assert.equal(sync._accountTx(account, () => 'wrote'), 'wrote');
  env.db.prepare('UPDATE accounts SET config_version = config_version + 1 WHERE id = ?').run(account.id);
  assert.throws(() => sync._accountTx(account, () => 'wrote'), SettingsChangedError);
  env.db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id);
  assert.throws(() => sync._accountTx(account, () => 'wrote'), /removed/);
});

test('sync against Dovecot: flag refresh keeps a change the user made after the server was read', async (t) => {
  if (!(await reachable())) return t.skip('Dovecot not reachable');
  await resetV2();
  t.after(() => resetV2().catch(() => {}));
  const env = makeEngineEnv();
  const sync = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: recordingLogger() });
  const account = v2Account(env);

  await appendV2('first');
  await appendV2('second');
  assert.equal((await sync.syncAccount(account.id)).ok, true);
  const rows = env.db.prepare('SELECT * FROM messages WHERE account_id = ? ORDER BY uid').all(account.id);
  assert.equal(rows.length, 2);

  // The user marks "first" read in Mailtabs *after* this sync's flag fetch would have started
  // (simulated with a timestamp in the future); the server still says unread.
  env.db.prepare('UPDATE messages SET is_read = 1, flags_changed_at = ? WHERE id = ?').run(Date.now() + 60_000, rows[0].id);
  // Meanwhile "second" was starred in another mail app: that change must still come through.
  await withV2(async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageFlagsAdd(String(rows[1].uid), ['\\Flagged'], { uid: true });
    } finally {
      lock.release();
    }
  });
  const result = await sync.syncAccount(account.id);
  assert.equal(result.ok, true, result.error);
  const after = env.db.prepare('SELECT * FROM messages WHERE account_id = ? ORDER BY uid').all(account.id);
  assert.equal(after[0].is_read, 1, "the user's own change survives the sync");
  assert.equal(after[1].is_starred, 1, 'changes from other apps still arrive');
});

test('sync against Dovecot: settings changed mid-sync -> stale run discards its writes and reruns', async (t) => {
  if (!(await reachable())) return t.skip('Dovecot not reachable');
  await resetV2();
  t.after(() => resetV2().catch(() => {}));
  const env = makeEngineEnv();
  const sync = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: recordingLogger() });
  const account = v2Account(env);
  await appendV2('one');

  // Bump config_version as soon as the run has its snapshot (i.e. once it set 'syncing').
  const realWithImap = imap.withImap;
  let bumped = false;
  imap.withImap = async (...args) => {
    if (!bumped) {
      bumped = true;
      env.db.prepare('UPDATE accounts SET config_version = config_version + 1 WHERE id = ?').run(account.id);
    }
    return realWithImap(...args);
  };
  t.after(() => {
    imap.withImap = realWithImap;
  });
  const first = await sync.syncAccount(account.id);
  assert.equal(first.ok, true);
  // The rerun (with the current settings) is started automatically; wait for it.
  for (let i = 0; i < 50 && (sync.isSyncing(account.id) || !env.db.prepare('SELECT last_synced_at FROM accounts WHERE id = ?').get(account.id).last_synced_at); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const row = env.db.prepare('SELECT * FROM accounts WHERE id = ?').get(account.id);
  assert.equal(row.status, 'ok');
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(account.id).n, 1, 'stored once, by the fresh run');
});
