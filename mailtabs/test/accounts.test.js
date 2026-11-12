'use strict';

// HTTP tests for /api/accounts and /api/sync.
// Login checks run against the local Dovecot with bob@test.local only (skipped when it is down).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  startTestServer,
  makeClient,
  signupUser,
  seedAccount,
  seedMessage,
  IMAP_TEST,
  imapAvailable,
  resetMailbox,
  appendMessage,
  lockTestImapUser,
} = require('./helpers');

const BOB = IMAP_TEST.users.bob;
const bobAccountBody = (over = {}) => ({
  provider: 'imap',
  email: BOB.user,
  password: BOB.pass,
  imapHost: IMAP_TEST.host,
  imapPort: IMAP_TEST.port,
  imapSecurity: 'none',
  ...over,
});

async function setup(t, env = {}, options = { stubSync: true }) {
  const srv = await startTestServer(env, options);
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  const aliceUser = await signupUser(alice, { email: 'alice@example.com' });
  const malloryUser = await signupUser(mallory, { email: 'mallory@example.com' });
  return { srv, alice, mallory, aliceUser, malloryUser };
}

/** No string anywhere in a JSON value may contain one of the secrets. */
function assertNoSecrets(value, secrets) {
  const text = JSON.stringify(value);
  for (const s of secrets) assert.ok(!text.includes(s), `response leaked ${s.slice(0, 12)}…`);
  assert.ok(!/"(secret_?enc|password|pass|accessToken|refreshToken|access_token|refresh_token)"\s*:/i.test(text), 'no secret-looking keys');
}

async function waitFor(fn, { timeoutMs = 20000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

test('accounts require a session and the CSRF header', async (t) => {
  const { srv, alice } = await setup(t);
  const anon = makeClient(srv.baseUrl);
  for (const [method, path] of [
    ['get', '/api/accounts'],
    ['post', '/api/accounts'],
    ['post', '/api/accounts/test'],
    ['patch', '/api/accounts/1'],
    ['del', '/api/accounts/1'],
    ['post', '/api/accounts/1/sync'],
    ['post', '/api/sync'],
  ]) {
    const res = await anon[method](path, method === 'get' || method === 'del' ? undefined : {});
    assert.equal(res.status, 401, `${method} ${path}`);
    assert.equal(res.body.code, 'UNAUTHENTICATED');
  }
  const noCsrf = await alice.raw('/api/accounts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(noCsrf.status, 403);
});

test('GET /api/accounts: shape, counts, tab ids, ordering, never any secret', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const a1 = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'first@x.com', secret: { password: 'pw-ONE-secret' }, display_name: 'Work' });
  const a2 = seedAccount(srv.db, srv.crypto, aliceUser.id, {
    email: 'second@x.com',
    auth_type: 'oauth',
    provider: 'gmail',
    secret: { refreshToken: 'rt-TWO-secret', accessToken: 'at-TWO-secret', accessTokenExpiresAt: Date.now() + 3600e3 },
  });
  seedAccount(srv.db, srv.crypto, malloryUser.id, { email: 'mallory@x.com' });
  seedMessage(srv.db, a1.id, { is_read: 0 });
  seedMessage(srv.db, a1.id, { is_read: 1 });
  seedMessage(srv.db, a2.id, { is_read: 0 });
  const tab = await alice.post('/api/tabs', { name: 'Work', accountIds: [a1.id] });

  const res = await alice.get('/api/accounts');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.accounts.map((a) => a.email), ['first@x.com', 'second@x.com']);
  const [first, second] = res.body.accounts;
  assert.deepEqual(first, {
    id: a1.id,
    provider: 'imap',
    authType: 'password',
    email: 'first@x.com',
    displayName: 'Work',
    color: '#4f46e5',
    imapHost: IMAP_TEST.host,
    imapPort: IMAP_TEST.port,
    imapSecurity: 'none',
    imapUser: BOB.user,
    status: 'ok',
    lastError: null,
    lastSyncedAt: null,
    createdAt: a1.created_at,
    messageCount: 2,
    unreadCount: 1,
    tabIds: [tab.body.tab.id],
  });
  assert.equal(second.authType, 'oauth');
  assert.equal(second.unreadCount, 1);
  assertNoSecrets(res.body, ['pw-ONE-secret', 'rt-TWO-secret', 'at-TWO-secret', a1.secret_enc, a2.secret_enc, BOB.pass]);

  const other = await mallory.get('/api/accounts');
  assert.deepEqual(other.body.accounts.map((a) => a.email), ['mallory@x.com']);
});

test('POST /api/accounts validates input before any login check', async (t) => {
  const { srv, alice, aliceUser, malloryUser } = await setup(t);
  const malloryTab = srv.db
    .prepare('INSERT INTO tabs (user_id, name, color, position, all_accounts, created_at) VALUES (?, ?, ?, 0, 0, ?)')
    .run(malloryUser.id, 'M', '#000000', Date.now()).lastInsertRowid;

  const bad = async (body, code) => {
    const res = await alice.post('/api/accounts', body);
    assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${res.status} ${JSON.stringify(res.body)}`);
    if (code) assert.equal(res.body.code, code, JSON.stringify(body));
    return res;
  };
  await bad({}, 'VALIDATION');
  await bad(bobAccountBody({ email: 'not-an-email' }), 'INVALID_EMAIL');
  await bad(bobAccountBody({ email: `${'a'.repeat(250)}@x.com` }));
  await bad(bobAccountBody({ provider: 'hotmail2000' }), 'INVALID_PROVIDER');
  await bad(bobAccountBody({ password: '' }), 'PASSWORD_REQUIRED');
  await bad(bobAccountBody({ password: 12345 }), 'PASSWORD_REQUIRED');
  await bad(bobAccountBody({ imapHost: 'https://imap.example.com/' }), 'HOST_NOT_ALLOWED');
  await bad(bobAccountBody({ imapHost: undefined }), 'HOST_REQUIRED'); // provider 'imap' has no default host
  await bad(bobAccountBody({ imapPort: 0 }), 'INVALID_PORT');
  await bad(bobAccountBody({ imapPort: 70000 }), 'INVALID_PORT');
  await bad(bobAccountBody({ imapPort: '99x' }), 'INVALID_PORT');
  await bad(bobAccountBody({ imapSecurity: 'ssl3' }), 'INVALID_SECURITY');
  await bad(bobAccountBody({ color: 'purple' }), 'INVALID_COLOR');
  await bad(bobAccountBody({ displayName: 'x'.repeat(61) }));
  await bad(bobAccountBody({ tabIds: 'all' }), 'INVALID_ID');
  await bad(bobAccountBody({ tabIds: [Number(malloryTab)] }), 'INVALID_TAB');
  await bad(bobAccountBody({ tabIds: [123456] }), 'INVALID_TAB');

  // Unencrypted IMAP is refused unless the operator allows private hosts (ENGINE policy, passed through).
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE user_id = ?').get(aliceUser.id).n, 0);
});

test('duplicates are 409 ACCOUNT_EXISTS (case-insensitive) without contacting the server', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);
  seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'Me@Example.com' });
  // Port 1 would fail the login check, so a 409 proves the duplicate check came first.
  const res = await alice.post('/api/accounts', bobAccountBody({ email: 'me@example.COM', imapPort: 1 }));
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'ACCOUNT_EXISTS');
  // Another user may connect the same address.
  const other = await mallory.post('/api/accounts', bobAccountBody({ email: 'me@example.com', imapPort: 1 }));
  assert.equal(other.status, 400);
  assert.equal(other.body.code, 'IMAP_CONNECT_FAILED');
});

test('PATCH display name, color and tab memberships (no login check needed)', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);
  // A wrong stored password proves no login check happens for cosmetic changes.
  const acct = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'w@x.com', secret: { password: 'wrong' } });
  const t1 = (await alice.post('/api/tabs', { name: 'One' })).body.tab.id;
  const t2 = (await alice.post('/api/tabs', { name: 'Two' })).body.tab.id;
  const malloryTab = (await mallory.post('/api/tabs', { name: 'M' })).body.tab.id;

  const res = await alice.patch(`/api/accounts/${acct.id}`, { displayName: '  Work  ', color: '#ABCDEF', tabIds: [t1, t2] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.account.displayName, 'Work');
  assert.equal(res.body.account.color, '#abcdef');
  assert.deepEqual(res.body.account.tabIds.sort(), [t1, t2].sort());
  assert.equal(res.body.account.status, 'ok', 'cosmetic edits do not reset the sync status');
  assert.equal(srv.syncManager.calls.syncAccount.length, 0);

  const replaced = await alice.patch(`/api/accounts/${acct.id}`, { tabIds: [t2], displayName: '' });
  assert.deepEqual(replaced.body.account.tabIds, [t2]);
  assert.equal(replaced.body.account.displayName, null);
  const tabs = (await alice.get('/api/tabs')).body.tabs;
  assert.deepEqual(tabs.find((x) => x.id === t1).accountIds, []);
  assert.deepEqual(tabs.find((x) => x.id === t2).accountIds, [acct.id]);

  assert.equal((await alice.patch(`/api/accounts/${acct.id}`, { tabIds: [malloryTab] })).body.code, 'INVALID_TAB');
  assert.equal((await alice.patch(`/api/accounts/${acct.id}`, { color: 'nope' })).status, 400);
  assert.equal((await alice.patch('/api/accounts/xyz', { color: '#000000' })).status, 400);
  assert.equal((await alice.patch('/api/accounts/987654', { color: '#000000' })).status, 404);
});

test('OAuth accounts cannot be given a password or a different server', async (t) => {
  const { srv, alice, aliceUser } = await setup(t);
  const acct = seedAccount(srv.db, srv.crypto, aliceUser.id, {
    provider: 'gmail',
    auth_type: 'oauth',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_security: 'tls',
    secret: { refreshToken: 'r', accessToken: 'a', accessTokenExpiresAt: 0 },
  });
  const pw = await alice.patch(`/api/accounts/${acct.id}`, { password: 'new password' });
  assert.equal(pw.status, 400);
  assert.equal(pw.body.code, 'OAUTH_ACCOUNT');
  assert.equal((await alice.patch(`/api/accounts/${acct.id}`, { imapHost: 'imap.evil.com' })).body.code, 'OAUTH_ACCOUNT');
  // Sending the same values back (as a form might) is fine.
  const same = await alice.patch(`/api/accounts/${acct.id}`, { imapHost: 'imap.gmail.com', imapPort: 993, color: '#111111' });
  assert.equal(same.status, 200);
  assert.equal(same.body.account.color, '#111111');
});

test('cross-user: nobody can read, edit, sync or delete another user\'s account', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);
  const acct = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'private@x.com' });
  seedMessage(srv.db, acct.id);

  assert.equal((await mallory.patch(`/api/accounts/${acct.id}`, { displayName: 'pwned' })).status, 404);
  assert.equal((await mallory.patch(`/api/accounts/${acct.id}`, { password: 'x', imapPort: 1 })).status, 404);
  assert.equal((await mallory.del(`/api/accounts/${acct.id}`)).status, 404);
  assert.equal((await mallory.post(`/api/accounts/${acct.id}/sync`, {})).status, 404);
  assert.equal(srv.syncManager.calls.syncAccount.length, 0);

  const sync = await mallory.post('/api/sync', {});
  assert.deepEqual(sync.body, { results: [] });

  const still = (await alice.get('/api/accounts')).body.accounts[0];
  assert.equal(still.displayName, null);
  assert.equal(still.messageCount, 1);
});

test('DELETE removes the account, its messages and tab memberships only', async (t) => {
  const { srv, alice, aliceUser } = await setup(t);
  const keep = seedAccount(srv.db, srv.crypto, aliceUser.id);
  const drop = seedAccount(srv.db, srv.crypto, aliceUser.id);
  seedMessage(srv.db, keep.id);
  seedMessage(srv.db, drop.id);
  seedMessage(srv.db, drop.id);
  const tab = (await alice.post('/api/tabs', { name: 'Both', accountIds: [keep.id, drop.id] })).body.tab;

  const res = await alice.del(`/api/accounts/${drop.id}`);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(drop.id).n, 0);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(keep.id).n, 1);
  const tabs = (await alice.get('/api/tabs')).body.tabs;
  assert.deepEqual(tabs[0].accountIds, [keep.id]);
  assert.equal(tabs[0].id, tab.id);
  assert.equal((await alice.del(`/api/accounts/${drop.id}`)).status, 404);
});

test('sync endpoints return the sync manager\'s results', async (t) => {
  const { srv, alice, aliceUser } = await setup(t);
  const a = seedAccount(srv.db, srv.crypto, aliceUser.id);
  const b = seedAccount(srv.db, srv.crypto, aliceUser.id);

  const one = await alice.post(`/api/accounts/${a.id}/sync`, {});
  assert.equal(one.status, 200);
  assert.deepEqual(one.body.result, { accountId: a.id, ok: true, newMessages: 0, removed: 0, updated: 0 });
  assert.deepEqual(srv.syncManager.calls.syncAccount, [a.id]);

  const all = await alice.post('/api/sync', {});
  assert.deepEqual(all.body.results.map((r) => r.accountId), [a.id, b.id]);
  assert.deepEqual(srv.syncManager.calls.syncUser, [aliceUser.id]);

  // Whatever the engine returns, only documented fields are passed on.
  srv.syncManager.syncAccount = async (id) => ({ accountId: id, ok: false, error: 'Wrong password', internal: { secret: 'x' }, newMessages: 0 });
  const failed = await alice.post(`/api/accounts/${a.id}/sync`, {});
  assert.deepEqual(failed.body.result, { accountId: a.id, ok: false, newMessages: 0, error: 'Wrong password' });
});

test('login checks are rate limited per user', async (t) => {
  const { alice, mallory } = await setup(t);
  // Port 1 on loopback refuses instantly, so each check is a fast IMAP_CONNECT_FAILED.
  const body = bobAccountBody({ imapPort: 1 });
  for (let i = 0; i < 30; i++) {
    const res = await alice.post('/api/accounts/test', body);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'IMAP_CONNECT_FAILED');
  }
  const limited = await alice.post('/api/accounts/test', body);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, 'RATE_LIMITED');
  assert.equal((await alice.post('/api/accounts', { ...body, email: 'z@x.com' })).status, 429);
  // Other users are unaffected.
  assert.equal((await mallory.post('/api/accounts/test', body)).body.code, 'IMAP_CONNECT_FAILED');
});

test('private and unencrypted hosts are refused when the operator has not allowed them', async (t) => {
  const { alice } = await setup(t, { ALLOW_PRIVATE_IMAP_HOSTS: 'false' });
  const insecure = await alice.post('/api/accounts', bobAccountBody());
  assert.equal(insecure.status, 400);
  assert.equal(insecure.body.code, 'INSECURE_NOT_ALLOWED');
  const loopback = await alice.post('/api/accounts', bobAccountBody({ imapSecurity: 'tls' }));
  assert.equal(loopback.status, 400);
  assert.equal(loopback.body.code, 'HOST_NOT_ALLOWED');
  const metadata = await alice.post('/api/accounts/test', bobAccountBody({ imapHost: '169.254.169.254', imapSecurity: 'tls', imapPort: 993 }));
  assert.equal(metadata.body.code, 'HOST_NOT_ALLOWED');
  assert.equal((await alice.get('/api/accounts')).body.accounts.length, 0);
});

test('Microsoft accounts cannot be added or changed with a password (OAUTH_REQUIRED)', async (t) => {
  const { srv, alice, aliceUser } = await setup(t);
  const expectOAuthRequired = (res, label) => {
    assert.equal(res.status, 400, `${label}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.code, 'OAUTH_REQUIRED', label);
    assert.match(res.body.error, /Sign in with Microsoft/, label);
    return res.body.error;
  };

  // Refused before any login check: these hosts would otherwise need DNS and a real server.
  const outlook = { provider: 'outlook', email: 'me@outlook.com', password: 'an-app-password' };
  for (const path of ['/api/accounts', '/api/accounts/test']) {
    const message = expectOAuthRequired(await alice.post(path, outlook), path);
    // Microsoft sign-in is not configured in this test server: say what the site owner must set.
    assert.match(message, /MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET/);
    assert.match(message, /README/);
  }
  expectOAuthRequired(await alice.post('/api/accounts', { email: 'me@hotmail.com', password: 'x' }), 'provider guessed from the domain');
  expectOAuthRequired(await alice.post('/api/accounts', { provider: 'outlook', email: 'me@outlook.com' }), 'not asked for a password first');
  for (const host of ['outlook.office365.com', 'OUTLOOK.OFFICE.COM', 'imap-mail.outlook.com']) {
    const body = { provider: 'imap', email: 'me@contoso.com', password: 'x', imapHost: host, imapPort: 993, imapSecurity: 'tls' };
    expectOAuthRequired(await alice.post('/api/accounts', body), host);
  }
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0);

  // Existing password accounts cannot be pointed at Microsoft or given a new password there.
  const plain = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'me@contoso.com' });
  expectOAuthRequired(
    await alice.patch(`/api/accounts/${plain.id}`, { imapHost: 'outlook.office365.com', imapPort: 993, imapSecurity: 'tls' }),
    'PATCH host'
  );
  const legacy = seedAccount(srv.db, srv.crypto, aliceUser.id, { provider: 'outlook', email: 'old@outlook.com', imap_host: 'outlook.office365.com' });
  expectOAuthRequired(await alice.patch(`/api/accounts/${legacy.id}`, { password: 'new' }), 'PATCH password');
  const renamed = await alice.patch(`/api/accounts/${legacy.id}`, { displayName: 'Old mail' });
  assert.equal(renamed.status, 200, 'cosmetic edits still work');
  assert.equal(srv.db.prepare('SELECT imap_host FROM accounts WHERE id = ?').get(plain.id).imap_host, IMAP_TEST.host);
});

test('OAUTH_REQUIRED does not mention server settings once Microsoft sign-in is configured', async (t) => {
  const { alice } = await setup(t, { MICROSOFT_CLIENT_ID: 'ms-id', MICROSOFT_CLIENT_SECRET: 'ms-secret' });
  const res = await alice.post('/api/accounts', { provider: 'outlook', email: 'me@outlook.com', password: 'x' });
  assert.equal(res.body.code, 'OAUTH_REQUIRED');
  assert.doesNotMatch(res.body.error, /MICROSOFT_CLIENT_ID/);
});

// ---------------------------------------------------------------------------------------------
// Real IMAP login checks (bob@test.local only)
// ---------------------------------------------------------------------------------------------

test('POST without a color gives the account the first palette colour not in use', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const { srv, alice, aliceUser } = await setup(t);
  seedAccount(srv.db, srv.crypto, aliceUser.id, { color: '#4f46e5' }); // indigo, palette slot 1
  seedAccount(srv.db, srv.crypto, aliceUser.id, { color: '#0891b2' }); // teal, slot 3
  const res = await alice.post('/api/accounts', bobAccountBody());
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.account.color, '#2563eb', 'blue, the first free slot');
});

test('iCloud/Yandex: a failed login is retried once with the other username form, which is saved', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const { srv, alice, aliceUser } = await setup(t);
  // Dovecot knows bob only as bob@test.local, so the bare name fails and the full address works.
  const icloud = seedAccount(srv.db, srv.crypto, aliceUser.id, {
    provider: 'icloud',
    email: BOB.user,
    imap_user: 'bob',
    secret: { password: 'old-wrong-password' },
    status: 'auth_error',
    sync_state: '{"uidValidity":1,"lastUid":5}',
  });
  seedMessage(srv.db, icloud.id);

  // A username the user typed is used as it is: no retry.
  const typed = await alice.patch(`/api/accounts/${icloud.id}`, { password: BOB.pass, imapUser: 'bob' });
  assert.equal(typed.status, 400);
  assert.equal(typed.body.code, 'IMAP_AUTH_FAILED');

  const fixed = await alice.patch(`/api/accounts/${icloud.id}`, { password: BOB.pass });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
  assert.equal(fixed.body.account.imapUser, BOB.user, 'the username that worked is saved');
  assert.equal(fixed.body.account.status, 'pending');
  const row = srv.db.prepare('SELECT * FROM accounts WHERE id = ?').get(icloud.id);
  assert.equal(row.sync_state, '{"uidValidity":1,"lastUid":5}', 'same mailbox: sync state kept');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(icloud.id).n, 1, 'and its mail');

  // Providers without that quirk get no second attempt.
  const other = seedAccount(srv.db, srv.crypto, aliceUser.id, { provider: 'imap', email: 'bob@other.example', imap_user: 'bob' });
  const noRetry = await alice.patch(`/api/accounts/${other.id}`, { password: BOB.pass });
  assert.equal(noRetry.body.code, 'IMAP_AUTH_FAILED');

  // New accounts: the default username (the full address) is tried first; a typed one is kept
  // (a retry would have found bob@test.local and succeeded).
  srv.db.prepare('DELETE FROM accounts WHERE id = ?').run(icloud.id);
  const yandexTyped = await alice.post('/api/accounts', bobAccountBody({ provider: 'yandex', imapUser: 'bob' }));
  assert.equal(yandexTyped.body.code, 'IMAP_AUTH_FAILED');
  const created = await alice.post('/api/accounts', bobAccountBody({ provider: 'yandex' }));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.account.imapUser, BOB.user);
});


test('POST /api/accounts verifies the login with the real IMAP server before saving', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const { srv, alice, aliceUser } = await setup(t);
  const tab = (await alice.post('/api/tabs', { name: 'Work' })).body.tab;

  // Wrong password: friendly 400, nothing stored.
  const wrong = await alice.post('/api/accounts', bobAccountBody({ password: 'definitely-wrong' }));
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, 'IMAP_AUTH_FAILED');
  assert.match(wrong.body.error, /password/i);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0);

  const wrongTest = await alice.post('/api/accounts/test', bobAccountBody({ password: 'nope' }));
  assert.equal(wrongTest.body.code, 'IMAP_AUTH_FAILED');
  const rightTest = await alice.post('/api/accounts/test', bobAccountBody());
  assert.deepEqual(rightTest.body, { ok: true });
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0, '/test never saves');

  // Unreachable server: friendly connect error.
  const refused = await alice.post('/api/accounts', bobAccountBody({ imapPort: 1 }));
  assert.equal(refused.body.code, 'IMAP_CONNECT_FAILED');
  assert.match(refused.body.error, /127\.0\.0\.1:1/);

  // Right password: saved (encrypted), attached to the tab, sync started.
  const ok = await alice.post('/api/accounts', bobAccountBody({ displayName: 'Bob box', color: '#00AA00', tabIds: [tab.id] }));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const account = ok.body.account;
  assert.equal(account.email, BOB.user);
  assert.equal(account.authType, 'password');
  assert.equal(account.provider, 'imap');
  assert.equal(account.imapUser, BOB.user, 'username defaults to the email');
  assert.equal(account.color, '#00aa00');
  assert.equal(account.status, 'pending');
  assert.deepEqual(account.tabIds, [tab.id]);
  assertNoSecrets(ok.body, [BOB.pass]);
  assert.deepEqual(srv.syncManager.calls.syncAccount, [account.id]);

  const row = srv.db.prepare('SELECT * FROM accounts WHERE id = ?').get(account.id);
  assert.equal(row.user_id, aliceUser.id);
  assert.ok(!row.secret_enc.includes(BOB.pass), 'stored encrypted');
  assert.deepEqual(srv.crypto.decryptJson(row.secret_enc), { password: BOB.pass });

  // Same address again -> 409.
  const dup = await alice.post('/api/accounts', bobAccountBody({ email: BOB.user.toUpperCase() }));
  assert.equal(dup.status, 409);
});

test('PATCH with a new password or server re-verifies the login first', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const { srv, alice } = await setup(t);
  const account = (await alice.post('/api/accounts', bobAccountBody())).body.account;
  srv.db.prepare("UPDATE accounts SET status = 'auth_error', last_error = 'Wrong password' WHERE id = ?").run(account.id);
  srv.syncManager.calls.syncAccount.length = 0;
  const before = srv.db.prepare('SELECT * FROM accounts WHERE id = ?').get(account.id);

  const wrong = await alice.patch(`/api/accounts/${account.id}`, { password: 'bad-password', displayName: 'Changed' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, 'IMAP_AUTH_FAILED');
  const unchanged = srv.db.prepare('SELECT * FROM accounts WHERE id = ?').get(account.id);
  assert.equal(unchanged.secret_enc, before.secret_enc, 'a wrong password is never stored');
  assert.equal(unchanged.display_name, null, 'nothing else changes either');

  // Changing the server needs the password typed again: the saved one is only ever sent to
  // the server it was saved for.
  const noPassword = await alice.patch(`/api/accounts/${account.id}`, { imapPort: 1 });
  assert.equal(noPassword.status, 400);
  assert.equal(noPassword.body.code, 'PASSWORD_REQUIRED');
  const badPort = await alice.patch(`/api/accounts/${account.id}`, { imapPort: 1, password: BOB.pass });
  assert.equal(badPort.body.code, 'IMAP_CONNECT_FAILED');
  assert.equal(srv.db.prepare('SELECT imap_port FROM accounts WHERE id = ?').get(account.id).imap_port, IMAP_TEST.port);

  // Correct password: stored, status reset to pending (before the sync starts), sync started.
  let statusWhenSyncStarted = null;
  const realSync = srv.syncManager.syncAccount.bind(srv.syncManager);
  srv.syncManager.syncAccount = async (id) => {
    statusWhenSyncStarted = srv.db.prepare('SELECT status FROM accounts WHERE id = ?').get(id).status;
    return realSync(id);
  };
  const fixed = await alice.patch(`/api/accounts/${account.id}`, { password: BOB.pass });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
  assert.equal(fixed.body.account.status, 'pending');
  assert.equal(fixed.body.account.lastError, null);
  await waitFor(() => statusWhenSyncStarted);
  assert.equal(statusWhenSyncStarted, 'pending');
  assert.deepEqual(srv.syncManager.calls.syncAccount, [account.id]);
  const after = srv.db.prepare('SELECT * FROM accounts WHERE id = ?').get(account.id);
  assert.notEqual(after.secret_enc, before.secret_enc);
  assert.deepEqual(srv.crypto.decryptJson(after.secret_enc), { password: BOB.pass });

  // Re-sending the current settings is not a change: no login check, mail kept.
  seedMessage(srv.db, account.id);
  srv.db.prepare("UPDATE accounts SET sync_state = '{\"uidValidity\":1,\"lastUid\":5}' WHERE id = ?").run(account.id);
  srv.syncManager.calls.syncAccount.length = 0;
  const noop = await alice.patch(`/api/accounts/${account.id}`, { imapUser: BOB.user, imapSecurity: 'none', imapHost: IMAP_TEST.host });
  assert.equal(noop.status, 200);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(account.id).n, 1, 'no-op change keeps mail');
  assert.equal(srv.syncManager.calls.syncAccount.length, 0);

  // A different server is a different mailbox: after a successful check, local mail and the
  // sync state are reset so the next sync starts fresh.
  const moved = await alice.patch(`/api/accounts/${account.id}`, { imapHost: 'LOCALHOST', password: BOB.pass });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.account.imapHost, 'localhost', 'host names are normalised');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(account.id).n, 0);
  assert.equal(srv.db.prepare('SELECT sync_state FROM accounts WHERE id = ?').get(account.id).sync_state, null);
  assert.deepEqual(srv.syncManager.calls.syncAccount, [account.id]);
});

test('end to end with the real sync engine: add bob, sync, counts', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const release = await lockTestImapUser('bob');
  t.after(release);
  await resetMailbox('bob');
  t.after(() => resetMailbox('bob').catch(() => {}));
  await appendMessage('bob', { subject: 'Hello from the accounts test', text: 'one' });
  await appendMessage('bob', { subject: 'Second message', text: 'two', flags: ['\\Seen'] });

  const { srv, alice } = await setup(t, {}, { stubSync: false });
  const created = await alice.post('/api/accounts', bobAccountBody());
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.account.id;

  const synced = await alice.post(`/api/accounts/${id}/sync`, {});
  assert.equal(synced.status, 200);
  assert.equal(synced.body.result.ok, true, JSON.stringify(synced.body));
  const account = await waitFor(async () => {
    const a = (await alice.get('/api/accounts')).body.accounts[0];
    return a.status === 'ok' && a.messageCount === 2 ? a : null;
  });
  assert.equal(account.unreadCount, 1);
  assert.ok(account.lastSyncedAt > 0);

  const all = await alice.post('/api/sync', {});
  assert.equal(all.body.results.length, 1);
  assert.equal(all.body.results[0].ok, true);
  assert.equal((await alice.get('/api/tabs')).body.all.totalCount, 2);
  void srv;
});
