'use strict';

/**
 * Remote write-back (actions.js) and the IMAP helpers it is built on (imap.js).
 * IMAP tests use alice@test.local on the local Dovecot and are skipped when it is not reachable.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('dns');

const imap = require('../src/imap');
const { applyFlags, moveMessages, resolveTarget } = require('../src/actions');
const { HttpError } = require('../src/errors');
const { OAuthError } = require('../src/oauth');
const h = require('./engine-helpers');

let available = false;
let releaseLock = () => {};

test.before(async () => {
  available = await h.aliceAvailable();
  if (!available) return;
  releaseLock = await h.lockAlice();
  await h.resetAlice();
});

test.after(async () => {
  try {
    if (available) await h.resetAlice();
  } finally {
    releaseLock();
  }
});

function imapTest(name, fn) {
  test(name, async (t) => {
    if (!available) return t.skip('IMAP test server (127.0.0.1:1143) not reachable');
    await h.resetAlice();
    const env = h.makeEngineEnv();
    const userId = h.createUser(env.db);
    const account = h.createAccount(env.db, env.crypto, userId);
    try {
      await fn(t, { ...env, account, userId });
    } finally {
      env.close();
    }
  });
}

async function uidValidityOfInbox() {
  return h.withAlice(async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      return Number(client.mailbox.uidValidity);
    } finally {
      lock.release();
    }
  });
}

// ---------------------------------------------------------------------------------------------
// imap.js — pure helpers
// ---------------------------------------------------------------------------------------------

test('toUidSet compresses UID lists into IMAP ranges', () => {
  assert.equal(imap.toUidSet([1, 2, 3, 7, 9, 10]), '1:3,7,9:10');
  assert.equal(imap.toUidSet([5]), '5');
  assert.equal(imap.toUidSet([10, 3, 3, 4, '5', 0, -1, 2.5, 'x']), '3:5,10');
  assert.equal(imap.toUidSet([]), '');
});

test('friendlyImapError maps common failures to plain English', () => {
  const f = imap.friendlyImapError;
  const authErr = Object.assign(new Error('Command failed'), {
    authenticationFailed: true,
    responseText: 'Authentication failed.',
    serverResponseCode: 'AUTHENTICATIONFAILED',
    executedCommand: '2 AUTHENTICATE PLAIN',
  });
  assert.match(f(authErr), /Wrong email or password/);
  assert.match(f(authErr), /app password/);
  assert.match(
    f(Object.assign(new Error('Command failed'), { authenticationFailed: true, responseText: '[ALERT] Application-specific password required: https://support.google.com/accounts/answer/185833 (Failure)' })),
    /needs an app password/
  );
  assert.match(f(Object.assign(new Error('Command failed'), { authenticationFailed: true, executedCommand: '2 AUTHENTICATE XOAUTH2' })), /reconnect/);
  assert.match(f(authErr, { oauth: true }), /reconnect/);
  assert.match(f(Object.assign(new Error('Command failed'), { authenticationFailed: true, responseText: '[ALERT] Please log in via your web browser' })), /website/);

  assert.equal(
    f(Object.assign(new Error('getaddrinfo ENOTFOUND imap.nope.example'), { code: 'ENOTFOUND', hostname: 'imap.nope.example' })),
    'Could not find the mail server imap.nope.example. Check the server name for typos.'
  );
  assert.match(f(Object.assign(new Error('connect ECONNREFUSED 1.2.3.4:993'), { code: 'ECONNREFUSED', address: '1.2.3.4', port: 993 }), { host: 'imap.example.com', port: 993 }), /Could not reach imap\.example\.com:993 — the server refused the connection/);
  assert.match(f(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), { host: 'imap.example.com', port: 993 }), /Timed out connecting to imap\.example\.com:993/);
  assert.match(f(Object.assign(new Error('Connection timed out'), { code: 'CONNECT_TIMEOUT' }), { host: 'h', port: 1 }), /Timed out/);
  assert.match(f(Object.assign(new Error('Failed to receive greeting'), { code: 'GREETING_TIMEOUT' }), { host: 'h', port: 993 }), /security setting/);
  assert.match(f(Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' }), { host: 'h' }), /certificate of h has expired/);
  assert.match(f(Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }), { host: 'h' }), /not trusted/);
  assert.match(f(Object.assign(new Error("Hostname/IP does not match certificate's altnames"), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }), { host: 'h' }), /different server name/);
  assert.match(f(Object.assign(new Error('unable to verify the first certificate'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }), { host: 'h' }), /not trusted/);
  assert.match(f(Object.assign(new Error('ssl3_get_record:wrong version number'), { code: 'ERR_SSL_WRONG_VERSION_NUMBER' }), { host: 'h', port: 143 }), /STARTTLS or no encryption/);
  assert.match(f(Object.assign(new Error('Server does not support STARTTLS'), { tlsFailed: true }), { host: 'h', port: 143 }), /does not support STARTTLS/);
  assert.match(f(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })), /closed the connection/);
  assert.match(f(Object.assign(new Error('Command failed'), { responseText: 'Mailbox is full', responseStatus: 'NO' })), /^The mail server said: Mailbox is full$/);
  assert.match(f(Object.assign(new Error('Command failed'), { mailboxMissing: true, path: 'INBOX' })), /INBOX.*not found/);
  assert.equal(f(new HttpError(400, 'Policy says no', 'HOST_NOT_ALLOWED')), 'Policy says no');
  assert.equal(f(new OAuthError('Access was revoked or expired — reconnect this account.', 'invalid_grant')), 'Access was revoked or expired — reconnect this account.');
  assert.match(f(new Error('something odd')), /something odd/);
  assert.equal(f(null), 'Unknown error talking to the mail server.');
  assert.equal(f(new Error('Command failed')), 'Unknown error talking to the mail server.');
});

test('isAuthFailure recognises IMAP and OAuth auth failures only', () => {
  assert.equal(imap.isAuthFailure(Object.assign(new Error('x'), { authenticationFailed: true })), true);
  assert.equal(imap.isAuthFailure(new OAuthError('x', 'invalid_grant')), true);
  assert.equal(imap.isAuthFailure(new OAuthError('x', 'oauth_error')), false);
  assert.equal(imap.isAuthFailure(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })), false);
  assert.equal(imap.isAuthFailure(null), false);
});

test('buildImapOptions maps security settings and spec options', async () => {
  const env = h.makeEngineEnv();
  try {
    const userId = h.createUser(env.db);
    const tls = await imap.buildImapOptions(env, h.createAccount(env.db, env.crypto, userId, { email: 'a@x', imap_security: 'tls', imap_port: 993 }));
    assert.equal(tls.secure, true);
    assert.equal(tls.doSTARTTLS, undefined);
    assert.deepEqual(tls.auth, { user: 'alice@test.local', pass: 'alicepw' });
    assert.equal(tls.logger, false);
    assert.equal(tls.emitLogs, false);
    assert.equal(tls.connectionTimeout, 20000);
    assert.equal(tls.greetingTimeout, 15000);
    assert.equal(tls.socketTimeout, 60000);
    assert.equal(tls.host, '127.0.0.1');
    assert.equal(tls.servername, undefined, 'no SNI for an IP literal');

    const starttls = await imap.buildImapOptions(env, h.createAccount(env.db, env.crypto, userId, { email: 'b@x', imap_security: 'starttls', imap_port: 143 }));
    assert.equal(starttls.secure, false);
    assert.equal(starttls.doSTARTTLS, true);

    const none = await imap.buildImapOptions(env, h.createAccount(env.db, env.crypto, userId, { email: 'c@x', imap_security: 'none' }));
    assert.equal(none.secure, false);
    assert.equal(none.doSTARTTLS, false);
  } finally {
    env.close();
  }
});

test('buildImapOptions enforces the policy when private hosts are not allowed', async () => {
  const env = h.makeEngineEnv({ ALLOW_PRIVATE_IMAP_HOSTS: 'false' });
  try {
    const userId = h.createUser(env.db);
    const plain = h.createAccount(env.db, env.crypto, userId, { email: 'a@x', imap_host: '8.8.8.8', imap_security: 'none' });
    await assert.rejects(imap.buildImapOptions(env, plain), (err) => err instanceof HttpError && err.code === 'INSECURE_NOT_ALLOWED' && err.status === 400);

    const loopback = h.createAccount(env.db, env.crypto, userId, { email: 'b@x', imap_host: '127.0.0.1', imap_security: 'tls' });
    await assert.rejects(imap.buildImapOptions(env, loopback), (err) => err.code === 'HOST_NOT_ALLOWED');

    const metadata = h.createAccount(env.db, env.crypto, userId, { email: 'c@x', imap_host: '169.254.169.254', imap_security: 'tls' });
    await assert.rejects(imap.buildImapOptions(env, metadata), (err) => err.code === 'HOST_NOT_ALLOWED');

    const badPort = h.createAccount(env.db, env.crypto, userId, { email: 'd@x', imap_host: '8.8.8.8', imap_security: 'tls', imap_port: 0 });
    await assert.rejects(imap.buildImapOptions(env, badPort), (err) => err.code === 'INVALID_PORT');

    const badSec = h.createAccount(env.db, env.crypto, userId, { email: 'e@x', imap_host: '8.8.8.8', imap_security: 'ssl3' });
    await assert.rejects(imap.buildImapOptions(env, badSec), (err) => err.code === 'INVALID_SECURITY');
  } finally {
    env.close();
  }
});

test('buildImapOptions pins the connection to a checked address and keeps the name for TLS', async (t) => {
  const env = h.makeEngineEnv({ ALLOW_PRIVATE_IMAP_HOSTS: 'false' });
  const original = dns.lookup;
  t.after(() => {
    dns.lookup = original;
    env.close();
  });
  dns.lookup = (host, opts, cb) =>
    host === 'imap.public.example'
      ? cb(null, [{ address: '2a00:1450:4001:82a::200e', family: 6 }, { address: '93.184.216.34', family: 4 }])
      : original(host, opts, cb);
  const userId = h.createUser(env.db);
  const account = h.createAccount(env.db, env.crypto, userId, { imap_host: 'IMAP.Public.Example', imap_port: 993, imap_security: 'tls' });
  const opts = await imap.buildImapOptions(env, account);
  assert.equal(opts.host, '93.184.216.34', 'IPv4 preferred');
  assert.equal(opts.servername, 'imap.public.example');
  assert.deepEqual(opts.tls, { servername: 'imap.public.example' });
});

test('buildImapOptions: an unreadable stored password is an auth failure with a clear message', async () => {
  const env = h.makeEngineEnv();
  try {
    const userId = h.createUser(env.db);
    const account = h.createAccount(env.db, env.crypto, userId);
    await assert.rejects(imap.buildImapOptions(env, { ...account, secret_enc: 'v1.a.b.c' }), (err) => {
      assert.equal(imap.isAuthFailure(err), true);
      assert.match(imap.friendlyImapError(err), /secret key changed/);
      return true;
    });
  } finally {
    env.close();
  }
});

test('pickSpecialMailbox prefers server-declared flags', () => {
  const list = [
    { path: 'INBOX', name: 'INBOX', flags: new Set(), specialUse: '\\Inbox' },
    { path: 'Archive', name: 'Archive', flags: new Set(), specialUse: '\\Archive', specialUseSource: 'name' },
    { path: 'Old/Archived', name: 'Archived', flags: new Set(['\\Archive']), specialUse: '\\Archive', specialUseSource: 'extension' },
    { path: '[Gmail]/All Mail', name: 'All Mail', flags: new Set(['\\All']), specialUse: '\\All', specialUseSource: 'extension' },
  ];
  assert.equal(imap.pickSpecialMailbox(list, '\\Archive'), 'Old/Archived');
  assert.equal(imap.pickSpecialMailbox(list, '\\all'), '[Gmail]/All Mail');
  assert.equal(imap.pickSpecialMailbox(list, '\\Trash'), null);
  assert.equal(imap.pickSpecialMailbox([], '\\Trash'), null);
});

test('resolveTarget: Archive, then All Mail (Gmail), then a folder named Archive; Trash fallbacks', () => {
  const box = (path, specialUse, flags = []) => ({ path, name: path.split('/').pop(), specialUse, flags: new Set(flags), specialUseSource: specialUse ? 'extension' : undefined });
  const gmail = [box('INBOX', '\\Inbox'), box('[Gmail]/All Mail', '\\All', ['\\All']), box('[Gmail]/Trash', '\\Trash', ['\\Trash'])];
  assert.equal(resolveTarget(gmail, 'archive', 'INBOX'), '[Gmail]/All Mail');
  assert.equal(resolveTarget(gmail, 'trash', 'INBOX'), '[Gmail]/Trash');

  const named = [box('INBOX'), box('Archive'), box('Deleted Items')];
  assert.equal(resolveTarget(named, 'archive', 'INBOX'), 'Archive');
  assert.equal(resolveTarget(named, 'trash', 'INBOX'), 'Deleted Items');

  const bare = [box('INBOX')];
  assert.equal(resolveTarget(bare, 'archive', 'INBOX'), null);
  assert.equal(resolveTarget(bare, 'trash', 'INBOX'), null);

  // Never "move" into the mailbox the messages are already in.
  assert.equal(resolveTarget([box('Archive', '\\Archive', ['\\Archive'])], 'archive', 'Archive'), null);
});

// ---------------------------------------------------------------------------------------------
// imap.js against Dovecot
// ---------------------------------------------------------------------------------------------

imapTest('verifyLogin: success, wrong password, unreachable, insecure', async (t, ctx) => {
  const deps = { config: ctx.config };
  const base = { host: '127.0.0.1', port: 1143, security: 'none', user: 'alice@test.local' };
  assert.deepEqual(await imap.verifyLogin(deps, { ...base, password: 'alicepw' }), { ok: true });

  await assert.rejects(imap.verifyLogin(deps, { ...base, password: 'nope' }), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 400);
    assert.equal(err.code, 'IMAP_AUTH_FAILED');
    assert.match(err.message, /Wrong email or password/);
    return true;
  });
  await assert.rejects(imap.verifyLogin(deps, { ...base, port: 1, password: 'x' }), (err) => {
    assert.equal(err.code, 'IMAP_CONNECT_FAILED');
    assert.match(err.message, /127\.0\.0\.1:1/);
    return true;
  });
  await assert.rejects(imap.verifyLogin(deps, { ...base, security: 'tls', password: 'alicepw' }), (err) => {
    assert.equal(err.code, 'IMAP_CONNECT_FAILED');
    assert.match(err.message, /secure connection/);
    return true;
  });
  await assert.rejects(imap.verifyLogin(deps, { ...base, security: 'starttls', password: 'alicepw' }), (err) => {
    assert.equal(err.code, 'IMAP_CONNECT_FAILED');
    assert.match(err.message, /does not support STARTTLS/);
    return true;
  });
  await assert.rejects(imap.verifyLogin(deps, { ...base, host: '', password: 'x' }), (err) => err.code === 'HOST_NOT_ALLOWED');

  const strict = h.makeEngineEnv({ ALLOW_PRIVATE_IMAP_HOSTS: 'false' });
  try {
    await assert.rejects(imap.verifyLogin({ config: strict.config }, { ...base, password: 'alicepw' }), (err) => err.code === 'INSECURE_NOT_ALLOWED');
    await assert.rejects(imap.verifyLogin({ config: strict.config }, { ...base, security: 'tls', password: 'alicepw' }), (err) => err.code === 'HOST_NOT_ALLOWED');
  } finally {
    strict.close();
  }
});

imapTest('withImap logs out even when the callback throws, and returns its result', async (t, ctx) => {
  let client;
  const result = await imap.withImap(ctx, ctx.account, async (c) => {
    client = c;
    return c.usable;
  });
  assert.equal(result, true);
  assert.equal(client.usable, false, 'logged out');

  await assert.rejects(
    imap.withImap(ctx, ctx.account, async (c) => {
      client = c;
      throw new Error('callback failed');
    }),
    /callback failed/
  );
  assert.equal(client.usable, false);
});

imapTest('connect surfaces auth failures from the server', async (t, ctx) => {
  const bad = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { email: 'bad@test.local', password: 'wrong' });
  await assert.rejects(imap.connect(ctx, bad), (err) => {
    assert.equal(err.authenticationFailed, true);
    assert.equal(imap.isAuthFailure(err), true);
    return true;
  });
});

imapTest('findSpecialMailbox finds Dovecot\'s special-use folders', async (t, ctx) => {
  await imap.withImap(ctx, ctx.account, async (client) => {
    assert.equal(await imap.findSpecialMailbox(client, '\\Archive'), 'Archive');
    assert.equal(await imap.findSpecialMailbox(client, '\\Trash'), 'Trash');
    assert.equal(await imap.findSpecialMailbox(client, '\\All'), null);
  });
});

// ---------------------------------------------------------------------------------------------
// actions.js against Dovecot
// ---------------------------------------------------------------------------------------------

imapTest('applyFlags adds and removes \\Seen and \\Flagged on the server', async (t, ctx) => {
  const a = await h.appendAlice(h.buildMessage({ subject: 'a' }));
  const b = await h.appendAlice(h.buildMessage({ subject: 'b' }), { flags: ['\\Seen', '\\Flagged'] });

  await applyFlags(ctx, ctx.account, [a], { isRead: true, isStarred: true });
  await applyFlags(ctx, ctx.account, [b], { isRead: false });
  let flags = await h.aliceFlags();
  assert.ok(flags.get(a).has('\\Seen'));
  assert.ok(flags.get(a).has('\\Flagged'));
  assert.ok(!flags.get(b).has('\\Seen'));
  assert.ok(flags.get(b).has('\\Flagged'), 'untouched flag kept');

  await applyFlags(ctx, ctx.account, [a, b], { isStarred: false, uidValidity: await uidValidityOfInbox() });
  flags = await h.aliceFlags();
  assert.ok(!flags.get(a).has('\\Flagged'));
  assert.ok(!flags.get(b).has('\\Flagged'));
  assert.ok(flags.get(a).has('\\Seen'));
});

imapTest('applyFlags refuses to touch anything when UIDVALIDITY changed', async (t, ctx) => {
  const a = await h.appendAlice(h.buildMessage({ subject: 'a' }));
  await assert.rejects(applyFlags(ctx, ctx.account, [a], { isRead: true, uidValidity: 1 }), (err) => {
    assert.equal(err.status, 409);
    assert.equal(err.code, 'UIDVALIDITY_CHANGED');
    return true;
  });
  assert.ok(!(await h.aliceFlags()).get(a).has('\\Seen'));
});

imapTest('applyFlags with nothing to do does not connect', async (t, ctx) => {
  const broken = { ...ctx.account, imap_port: 1 };
  await applyFlags(ctx, broken, [], { isRead: true });
  await applyFlags(ctx, broken, [1, 2], {});
});

imapTest('moveMessages archives into \\Archive and trashes into \\Trash', async (t, ctx) => {
  const keep = await h.appendAlice(h.buildMessage({ subject: 'keep' }));
  const arch1 = await h.appendAlice(h.buildMessage({ subject: 'archive-1' }));
  const arch2 = await h.appendAlice(h.buildMessage({ subject: 'archive-2' }));
  const del = await h.appendAlice(h.buildMessage({ subject: 'trash-me' }));

  const archived = await moveMessages(ctx, ctx.account, [arch1, arch2], 'archive');
  assert.deepEqual(archived, { destination: 'Archive', deleted: false });
  const trashed = await moveMessages(ctx, ctx.account, [del], 'trash', { uidValidity: await uidValidityOfInbox() });
  assert.deepEqual(trashed, { destination: 'Trash', deleted: false });

  assert.deepEqual(await h.aliceSubjects('INBOX'), ['keep']);
  assert.deepEqual((await h.aliceSubjects('Archive')).sort(), ['archive-1', 'archive-2']);
  assert.deepEqual(await h.aliceSubjects('Trash'), ['trash-me']);
  assert.ok((await h.aliceFlags()).has(keep));
});

imapTest('moveMessages validates its target and tolerates empty input', async (t, ctx) => {
  await assert.rejects(moveMessages(ctx, ctx.account, [1], 'spam'), (err) => err.status === 400 && err.code === 'INVALID_TARGET');
  assert.deepEqual(await moveMessages(ctx, { ...ctx.account, imap_port: 1 }, [], 'trash'), { destination: null, deleted: false });
});

imapTest('remote failures become HttpError 502 REMOTE_FAILED with a friendly message', async (t, ctx) => {
  const unreachable = { ...ctx.account, imap_port: 1 };
  await assert.rejects(applyFlags(ctx, unreachable, [1], { isRead: true }), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 502);
    assert.equal(err.code, 'REMOTE_FAILED');
    assert.match(err.message, /refused the connection/);
    return true;
  });
  const wrongPw = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { email: 'wrong@test.local', password: 'nope' });
  await assert.rejects(moveMessages(ctx, wrongPw, [1], 'archive'), (err) => err.status === 502 && /Wrong email or password/.test(err.message));
});

// ---------------------------------------------------------------------------------------------
// actions.js with a fake client (server layouts Dovecot does not have)
// ---------------------------------------------------------------------------------------------

function fakeClient({ list, flagsResult = true, moveResult = { uidMap: new Map() }, deleteResult = true, readOnly = false }) {
  const calls = [];
  return {
    calls,
    mailbox: { path: 'INBOX', uidValidity: 77n, readOnly },
    async getMailboxLock(path) {
      calls.push(['lock', path]);
      return { release: () => calls.push(['release']) };
    },
    async list() {
      return list;
    },
    async messageFlagsAdd(range, flags, opts) {
      calls.push(['add', range, flags, opts]);
      return flagsResult;
    },
    async messageFlagsRemove(range, flags, opts) {
      calls.push(['remove', range, flags, opts]);
      return flagsResult;
    },
    async messageMove(range, dest, opts) {
      calls.push(['move', range, dest, opts]);
      return moveResult;
    },
    async messageDelete(range, opts) {
      calls.push(['delete', range, opts]);
      return deleteResult;
    },
  };
}

function useFakeClient(t, client) {
  const original = imap.withImap;
  imap.withImap = async (deps, account, fn) => fn(client);
  t.after(() => {
    imap.withImap = original;
  });
}

const fakeDeps = { db: null, crypto: null, config: {} };
const fakeAccount = { id: 1, mailbox: 'INBOX' };
const box = (path, specialUse) => ({ path, name: path.split('/').pop(), flags: new Set(specialUse ? [specialUse] : []), specialUse, specialUseSource: specialUse ? 'extension' : undefined });

test('moveMessages: Gmail-style archive goes to All Mail; ranges are compressed; lock released', async (t) => {
  const client = fakeClient({ list: [box('INBOX', '\\Inbox'), box('[Gmail]/All Mail', '\\All'), box('[Gmail]/Trash', '\\Trash')] });
  useFakeClient(t, client);
  const res = await moveMessages(fakeDeps, fakeAccount, [5, 3, 4, 9], 'archive', { uidValidity: 77 });
  assert.deepEqual(res, { destination: '[Gmail]/All Mail', deleted: false });
  assert.deepEqual(client.calls, [['lock', 'INBOX'], ['move', '3:5,9', '[Gmail]/All Mail', { uid: true }], ['release']]);
});

test('moveMessages: no archive folder -> NO_ARCHIVE; no trash folder -> delete in place', async (t) => {
  const client = fakeClient({ list: [box('INBOX', '\\Inbox')] });
  useFakeClient(t, client);
  await assert.rejects(moveMessages(fakeDeps, fakeAccount, [1], 'archive'), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, 'NO_ARCHIVE');
    assert.equal(err.message, 'This account has no Archive folder');
    return true;
  });
  assert.deepEqual(client.calls.at(-1), ['release'], 'lock released after failure');
  client.calls.length = 0;
  const res = await moveMessages(fakeDeps, fakeAccount, [1, 2], 'trash');
  assert.deepEqual(res, { destination: null, deleted: true });
  assert.deepEqual(client.calls, [['lock', 'INBOX'], ['delete', '1:2', { uid: true }], ['release']]);
});

test('moveMessages / applyFlags: a refused command is a 502 REMOTE_FAILED', async (t) => {
  const client = fakeClient({ list: [box('INBOX'), box('Trash', '\\Trash')], moveResult: false, flagsResult: false });
  useFakeClient(t, client);
  await assert.rejects(moveMessages(fakeDeps, fakeAccount, [1], 'trash'), (err) => err.status === 502 && err.code === 'REMOTE_FAILED');
  await assert.rejects(applyFlags(fakeDeps, fakeAccount, [1], { isRead: false }), (err) => err.status === 502 && err.code === 'REMOTE_FAILED');
});

test('applyFlags: large selections are sent in batches; read-only mailboxes are refused', async (t) => {
  const client = fakeClient({ list: [] });
  useFakeClient(t, client);
  const uids = Array.from({ length: 1200 }, (_, i) => i * 2 + 1); // no ranges possible
  await applyFlags(fakeDeps, fakeAccount, uids, { isRead: true, isStarred: false });
  const adds = client.calls.filter((c) => c[0] === 'add');
  const removes = client.calls.filter((c) => c[0] === 'remove');
  assert.equal(adds.length, 3);
  assert.equal(removes.length, 3);
  assert.deepEqual(adds[0][2], ['\\Seen']);
  assert.deepEqual(removes[0][2], ['\\Flagged']);

  client.mailbox.readOnly = true;
  await assert.rejects(applyFlags(fakeDeps, fakeAccount, [1], { isRead: true }), (err) => err.status === 502);
});
