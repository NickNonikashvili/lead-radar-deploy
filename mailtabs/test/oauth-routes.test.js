'use strict';

// HTTP tests for /api/oauth/:provider/start and /callback, against a mock OAuth token server
// (OAUTH_TEST_ENDPOINTS) with fake client ids. No real Google/Microsoft and no IMAP involved.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const nodeCrypto = require('node:crypto');

const { startTestServer, makeClient, signupUser, seedAccount, seedMessage } = require('./helpers');

const NO_REFRESH = /Mail access wasn/;

function jwt(payload) {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(payload)}.sig`;
}

/** Mock token endpoint. `mock.reply(fields)` decides the response; requests are recorded. */
async function startMockTokenServer() {
  const mock = {
    requests: [],
    reply: () => ({
      status: 200,
      body: { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, id_token: jwt({ email: 'person@gmail.com', name: 'Person' }) },
    }),
  };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      const fields = Object.fromEntries(new URLSearchParams(raw));
      mock.requests.push({ path: req.url, fields });
      const { status, body } = mock.reply(fields, req.url);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  mock.url = `http://127.0.0.1:${server.address().port}`;
  mock.close = () => new Promise((resolve) => server.close(resolve));
  return mock;
}

async function setup(t, { microsoft = true } = {}) {
  const mock = await startMockTokenServer();
  t.after(() => mock.close());
  const endpoint = (name) => ({
    authUrl: `${mock.url}/${name}/authorize`,
    tokenUrl: `${mock.url}/${name}/token`,
    imapHost: '127.0.0.1',
    imapPort: 1143,
    imapSecurity: 'none',
  });
  const env = {
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    OAUTH_TEST_ENDPOINTS: JSON.stringify({ google: endpoint('google'), microsoft: endpoint('microsoft') }),
  };
  if (microsoft) Object.assign(env, { MICROSOFT_CLIENT_ID: 'ms-client-id', MICROSOFT_CLIENT_SECRET: 'ms-client-secret' });
  const srv = await startTestServer(env, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  const aliceUser = await signupUser(alice, { email: 'alice@example.com' });
  const malloryUser = await signupUser(mallory, { email: 'mallory@example.com' });
  return { mock, srv, alice, mallory, aliceUser, malloryUser };
}

/** GET /start and return { location, url, state } (asserting the redirect goes to the provider). */
async function start(client, provider = 'google', query = '') {
  const res = await client.get(`/api/oauth/${provider}/start${query}`);
  assert.equal(res.status, 302, JSON.stringify(res.body));
  const location = res.headers.get('location');
  const url = new URL(location);
  return { location, url, state: url.searchParams.get('state') };
}

/** Assert a failed-sign-in redirect and return the message the frontend would show. */
async function oauthError(client, res) {
  assert.equal(res.status, 302);
  const location = res.headers.get('location');
  assert.equal(location, '/?oauth=failed', `expected an oauth failure redirect, got ${location}`);
  const result = await client.get('/api/oauth/result');
  assert.equal(result.status, 200);
  assert.equal((await client.get('/api/oauth/result')).body.error, null, 'the message is shown once');
  return result.body.error;
}

const accountsOf = (srv, userId) => srv.db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY id').all(userId);

test('start: needs a configured provider and a signed-in user', async (t) => {
  const { srv, alice } = await setup(t, { microsoft: false });
  const anon = makeClient(srv.baseUrl);
  const signedOut = await anon.get('/api/oauth/google/start');
  assert.equal(signedOut.status, 302);
  assert.equal(signedOut.headers.get('location'), '/?oauth=signin');

  assert.equal((await alice.get('/api/oauth/yahoo/start')).status, 404);
  assert.equal((await alice.get('/api/oauth/microsoft/start')).status, 404, 'not configured');
  assert.equal((await alice.get('/api/oauth/__proto__/start')).status, 404);
});

test('start: redirects to the provider with PKCE and stores a single-use state', async (t) => {
  const { srv, alice, aliceUser, mock } = await setup(t);
  const tab = (await alice.post('/api/tabs', { name: 'Work' })).body.tab;
  const before = Date.now();
  const { url, state } = await start(alice, 'google', `?tabIds=${tab.id}`);

  assert.equal(`${url.origin}${url.pathname}`, `${mock.url}/google/authorize`);
  const p = Object.fromEntries(url.searchParams);
  assert.equal(p.client_id, 'google-client-id');
  assert.equal(p.redirect_uri, `${srv.baseUrl}/api/oauth/google/callback`);
  assert.equal(p.response_type, 'code');
  assert.equal(p.code_challenge_method, 'S256');
  assert.match(p.code_challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.match(p.scope, /https:\/\/mail\.google\.com\//);
  assert.equal(p.access_type, 'offline');
  assert.equal(p.prompt, 'consent');
  assert.ok(!('client_secret' in p), 'the secret never goes to the browser');
  assert.ok(state && state.length >= 40);

  const row = srv.db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state);
  assert.equal(row.user_id, aliceUser.id);
  assert.equal(row.provider, 'google');
  assert.deepEqual(JSON.parse(row.tab_ids), [tab.id]);
  assert.equal(row.account_id, null);
  assert.ok(row.expires_at >= before + 10 * 60 * 1000 - 1000 && row.expires_at <= Date.now() + 10 * 60 * 1000);
  // The challenge is S256 of the stored verifier.
  assert.equal(nodeCrypto.createHash('sha256').update(row.code_verifier).digest('base64url'), p.code_challenge);

  // Expired rows are cleaned up on the next start; each user keeps at most 20 pending sign-ins.
  srv.db.prepare('UPDATE oauth_states SET expires_at = 1 WHERE state = ?').run(state);
  for (let i = 0; i < 25; i++) await start(alice);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM oauth_states WHERE state = ?').get(state).n, 0);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM oauth_states WHERE user_id = ?').get(aliceUser.id).n, 20);
});

test('start: validates accountId and tabIds against the signed-in user', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const myGmail = seedAccount(srv.db, srv.crypto, aliceUser.id, { provider: 'gmail', email: 'me@gmail.com' });
  const myYahoo = seedAccount(srv.db, srv.crypto, aliceUser.id, { provider: 'yahoo', email: 'me@yahoo.com' });
  const theirs = seedAccount(srv.db, srv.crypto, malloryUser.id, { provider: 'gmail', email: 'm@gmail.com' });
  const theirTab = (await mallory.post('/api/tabs', { name: 'M' })).body.tab;

  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/start?accountId=${theirs.id}`)), /not found/);
  assert.match(await oauthError(alice, await alice.get('/api/oauth/google/start?accountId=abc')), /not found/);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/start?accountId=${myYahoo.id}`)), /can't be connected/);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/start?tabIds=${theirTab.id}`)), /tab/);
  assert.match(await oauthError(alice, await alice.get('/api/oauth/google/start?tabIds=1,x')), /tab/);
  assert.match(await oauthError(alice, await alice.get('/api/oauth/google/start?tabIds=-1')), /tab/);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM oauth_states').get().n, 0, 'no state stored for rejected starts');

  // Reconnect: the state remembers the account, and the provider gets a login hint.
  const { url, state } = await start(alice, 'google', `?accountId=${myGmail.id}`);
  assert.equal(url.searchParams.get('login_hint'), 'me@gmail.com');
  assert.equal(srv.db.prepare('SELECT account_id FROM oauth_states WHERE state = ?').get(state).account_id, myGmail.id);
});

test('callback: exchanges the code, creates the account, attaches tabs, starts a sync', async (t) => {
  const { srv, alice, aliceUser, mock } = await setup(t);
  const tab = (await alice.post('/api/tabs', { name: 'Personal' })).body.tab;
  const { state, url } = await start(alice, 'google', `?tabIds=${tab.id}`);
  const verifier = srv.db.prepare('SELECT code_verifier FROM oauth_states WHERE state = ?').get(state).code_verifier;

  const res = await alice.get(`/api/oauth/google/callback?code=auth-code-1&state=${encodeURIComponent(state)}`);
  assert.equal(res.status, 302);
  const [account] = accountsOf(srv, aliceUser.id);
  assert.equal(res.headers.get('location'), `/?connected=${account.id}`);

  // The token request was exactly what the provider expects.
  assert.equal(mock.requests.length, 1);
  assert.equal(mock.requests[0].path, '/google/token');
  assert.deepEqual(mock.requests[0].fields, {
    client_id: 'google-client-id',
    client_secret: 'google-client-secret',
    grant_type: 'authorization_code',
    code: 'auth-code-1',
    redirect_uri: url.searchParams.get('redirect_uri'),
    code_verifier: verifier,
  });

  assert.equal(account.email, 'person@gmail.com');
  assert.equal(account.provider, 'gmail');
  assert.equal(account.auth_type, 'oauth');
  assert.equal(account.imap_host, '127.0.0.1');
  assert.equal(account.imap_port, 1143);
  assert.equal(account.imap_security, 'none');
  assert.equal(account.imap_user, 'person@gmail.com');
  assert.equal(account.status, 'pending');
  const secret = srv.crypto.decryptJson(account.secret_enc);
  assert.equal(secret.refreshToken, 'refresh-1');
  assert.equal(secret.accessToken, 'access-1');
  assert.ok(secret.accessTokenExpiresAt > Date.now() + 3500 * 1000);
  assert.deepEqual(srv.syncManager.calls.syncAccount, [account.id]);
  assert.deepEqual((await alice.get('/api/tabs')).body.tabs[0].accountIds, [account.id]);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM oauth_states').get().n, 0, 'state consumed');

  // The account JSON never includes the tokens.
  const json = JSON.stringify((await alice.get('/api/accounts')).body);
  assert.ok(!json.includes('refresh-1') && !json.includes('access-1'));
});

test('callback: state is single-use, expires, is bound to the user and the provider', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser, mock } = await setup(t);

  // Replay.
  const first = await start(alice);
  assert.equal((await alice.get(`/api/oauth/google/callback?code=c1&state=${first.state}`)).status, 302);
  assert.equal(accountsOf(srv, aliceUser.id).length, 1);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c1&state=${first.state}`)), /expired or was already used/);
  assert.equal(mock.requests.length, 1, 'a replayed state never reaches the token endpoint');

  // Expired.
  const expired = await start(alice);
  srv.db.prepare('UPDATE oauth_states SET expires_at = ? WHERE state = ?').run(Date.now() - 1, expired.state);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c2&state=${expired.state}`)), /expired/);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM oauth_states WHERE state = ?').get(expired.state).n, 0, 'expired state removed');

  // Another user's session.
  const stolen = await start(alice);
  assert.match(await oauthError(mallory, await mallory.get(`/api/oauth/google/callback?code=c3&state=${stolen.state}`)), /expired or was already used/);
  assert.equal(accountsOf(srv, malloryUser.id).length, 0);
  // ... and the state is gone for Alice too (it was single-use).
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c3&state=${stolen.state}`)), /expired/);

  // Wrong provider.
  const google = await start(alice, 'google');
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/microsoft/callback?code=c4&state=${google.state}`)), /expired or was already used/);

  // Missing / unknown / absurd state.
  assert.match(await oauthError(alice, await alice.get('/api/oauth/google/callback?code=c5')), /expired/);
  assert.match(await oauthError(alice, await alice.get('/api/oauth/google/callback?code=c5&state=nope')), /expired/);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c5&state=${'x'.repeat(5000)}`)), /expired/);
  assert.equal((await alice.get('/api/oauth/yahoo/callback?code=c&state=s')).status, 404);

  // Not signed in when coming back: asked to sign in, and the state is used up anyway.
  const anon = makeClient(srv.baseUrl);
  const pending = await start(alice);
  const signedOut = await anon.get(`/api/oauth/google/callback?code=c6&state=${pending.state}`);
  assert.equal(signedOut.headers.get('location'), '/?oauth=signin');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM oauth_states WHERE state = ?').get(pending.state).n, 0);

  assert.equal(mock.requests.length, 1);
});

test('callback: provider error parameter and token endpoint failures', async (t) => {
  const { srv, alice, aliceUser, mock } = await setup(t);

  const cancelled = await start(alice);
  const msg = await oauthError(alice, await alice.get(`/api/oauth/google/callback?error=access_denied&state=${cancelled.state}`));
  assert.match(msg, /cancelled/);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM oauth_states WHERE state = ?').get(cancelled.state).n, 0, 'state consumed');

  // Free text from the URL is never shown (anyone can craft a callback link).
  const crafted = await oauthError(
    alice,
    await alice.get('/api/oauth/google/callback?error=weird_thing&error_description=Call%20555-0100%20to%20restore%20your%20account')
  );
  assert.ok(!/555-0100|weird_thing/.test(crafted));
  assert.match(crafted, /Sign-in failed/);

  // No code.
  const noCode = await start(alice);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?state=${noCode.state}`)), /authorization code/);

  // The token endpoint refuses the code.
  mock.reply = () => ({ status: 400, body: { error: 'invalid_grant', error_description: 'Bad code' } });
  const refused = await start(alice);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=bad&state=${refused.state}`)), /took too long or was already used/);
  mock.reply = () => ({ status: 500, body: { error: 'server_error' } });
  const broken = await start(alice);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=bad&state=${broken.state}`)), /sign-in failed/i);

  // No email in the id_token.
  mock.reply = () => ({ status: 200, body: { access_token: 'a', refresh_token: 'r', expires_in: 60, id_token: jwt({ sub: '123' }) } });
  const noEmail = await start(alice);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c&state=${noEmail.state}`)), /email address/);

  // No refresh token for a new account: mail access was not granted.
  mock.reply = () => ({ status: 200, body: { access_token: 'a', expires_in: 3600, id_token: jwt({ email: 'new@gmail.com' }) } });
  const noRefresh = await start(alice);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c&state=${noRefresh.state}`)), NO_REFRESH);

  assert.equal(accountsOf(srv, aliceUser.id).length, 0, 'no account was created by any failure');
  assert.equal(srv.syncManager.calls.syncAccount.length, 0);
});

test('callback: reconnecting keeps the old refresh token when none is sent, and checks the address', async (t) => {
  const { srv, alice, aliceUser, mock } = await setup(t);
  const { state } = await start(alice);
  await alice.get(`/api/oauth/google/callback?code=c1&state=${state}`);
  const [account] = accountsOf(srv, aliceUser.id);
  seedMessage(srv.db, account.id);
  srv.db.prepare("UPDATE accounts SET status = 'auth_error', last_error = 'Access was revoked' WHERE id = ?").run(account.id);

  // Google sends no refresh token on re-consent: the stored one is kept.
  mock.reply = () => ({ status: 200, body: { access_token: 'access-2', expires_in: 3600, id_token: jwt({ email: 'PERSON@gmail.com' }) } });
  const again = await start(alice, 'google', `?accountId=${account.id}`);
  const res = await alice.get(`/api/oauth/google/callback?code=c2&state=${again.state}`);
  assert.equal(res.headers.get('location'), `/?connected=${account.id}`);
  const after = accountsOf(srv, aliceUser.id);
  assert.equal(after.length, 1, 'same account (email matched case-insensitively)');
  assert.equal(after[0].status, 'pending');
  assert.equal(after[0].last_error, null);
  const secret = srv.crypto.decryptJson(after[0].secret_enc);
  assert.equal(secret.refreshToken, 'refresh-1');
  assert.equal(secret.accessToken, 'access-2');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(account.id).n, 1, 'mail kept');

  // Signing in as a different Google account while reconnecting this one is refused.
  mock.reply = () => ({ status: 200, body: { access_token: 'x', refresh_token: 'y', expires_in: 3600, id_token: jwt({ email: 'someone-else@gmail.com' }) } });
  const wrong = await start(alice, 'google', `?accountId=${account.id}`);
  assert.match(await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c3&state=${wrong.state}`)), /someone-else@gmail\.com/);
  assert.equal(accountsOf(srv, aliceUser.id).length, 1);
  assert.equal(srv.crypto.decryptJson(accountsOf(srv, aliceUser.id)[0].secret_enc).accessToken, 'access-2');
});

test('callback: converts an existing password account for the same address', async (t) => {
  const { srv, alice, aliceUser, mock } = await setup(t);
  const tabA = (await alice.post('/api/tabs', { name: 'A' })).body.tab;
  const tabB = (await alice.post('/api/tabs', { name: 'B' })).body.tab;
  // Same server and login as the OAuth provider: a conversion keeps the synced mail.
  const sameBox = seedAccount(srv.db, srv.crypto, aliceUser.id, {
    provider: 'gmail',
    email: 'Person@Gmail.com',
    imap_host: '127.0.0.1',
    imap_user: 'person@gmail.com',
    display_name: 'Mine',
    color: '#123456',
  });
  srv.db.prepare('INSERT INTO tab_accounts (tab_id, account_id) VALUES (?, ?)').run(tabA.id, sameBox.id);
  seedMessage(srv.db, sameBox.id);

  const { state } = await start(alice, 'google', `?tabIds=${tabB.id}`);
  // The tab chosen at start was deleted before the user came back: silently skipped.
  const tabC = (await alice.post('/api/tabs', { name: 'C' })).body.tab;
  srv.db.prepare('UPDATE oauth_states SET tab_ids = ? WHERE state = ?').run(JSON.stringify([tabB.id, tabC.id]), state);
  await alice.del(`/api/tabs/${tabC.id}`);

  const res = await alice.get(`/api/oauth/google/callback?code=c&state=${state}`);
  assert.equal(res.headers.get('location'), `/?connected=${sameBox.id}`);
  const [converted] = accountsOf(srv, aliceUser.id);
  assert.equal(converted.id, sameBox.id);
  assert.equal(converted.auth_type, 'oauth');
  assert.equal(converted.display_name, 'Mine', 'user labels are kept');
  assert.equal(converted.color, '#123456');
  // v2: the granted scopes are kept (they decide what a refresh asks for, and whether the account may send).
  assert.deepEqual(Object.keys(srv.crypto.decryptJson(converted.secret_enc)).sort(), ['accessToken', 'accessTokenExpiresAt', 'grantedScopes', 'refreshToken']);
  assert.equal(converted.smtp_secret_enc, null, 'a converted password account loses its SMTP password');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(sameBox.id).n, 1);
  const tabs = (await alice.get('/api/tabs')).body.tabs;
  assert.deepEqual(tabs.find((x) => x.id === tabA.id).accountIds, [sameBox.id], 'existing memberships kept');
  assert.deepEqual(tabs.find((x) => x.id === tabB.id).accountIds, [sameBox.id], 'new tab attached');

  // A password account for the same address on another server: converted, and its old mail
  // (from a different mailbox) is cleared so the next sync starts fresh.
  mock.reply = () => ({ status: 200, body: { access_token: 'a', refresh_token: 'r', expires_in: 3600, id_token: jwt({ email: 'other@gmail.com' }) } });
  const elsewhere = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'other@gmail.com', imap_host: 'imap.elsewhere.example', sync_state: '{"uidValidity":5,"lastUid":9}' });
  seedMessage(srv.db, elsewhere.id);
  const second = await start(alice);
  await alice.get(`/api/oauth/google/callback?code=c&state=${second.state}`);
  const moved = srv.db.prepare('SELECT * FROM accounts WHERE id = ?').get(elsewhere.id);
  assert.equal(moved.imap_host, '127.0.0.1');
  assert.equal(moved.sync_state, null);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(elsewhere.id).n, 0);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM folders WHERE account_id = ?').get(elsewhere.id).n, 0, 'the old mailbox\'s folders go too');
});

test('callback: Microsoft accounts (email from preferred_username)', async (t) => {
  const { srv, alice, aliceUser, mock } = await setup(t);
  mock.reply = () => ({
    status: 200,
    body: { access_token: 'ms-a', refresh_token: 'ms-r', expires_in: 3600, id_token: jwt({ preferred_username: 'me@outlook.com', name: 'Me' }) },
  });
  const { url, state } = await start(alice, 'microsoft');
  assert.equal(url.searchParams.get('prompt'), 'select_account');
  assert.match(url.searchParams.get('scope'), /offline_access/);
  const res = await alice.get(`/api/oauth/microsoft/callback?code=c&state=${state}`);
  const [account] = accountsOf(srv, aliceUser.id);
  assert.equal(res.headers.get('location'), `/?connected=${account.id}`);
  assert.equal(account.provider, 'outlook');
  assert.equal(account.email, 'me@outlook.com');
  assert.equal(mock.requests[0].path, '/microsoft/token');
  assert.equal(mock.requests[0].fields.client_secret, 'ms-client-secret');
});

test('callback: a grant without mail access connects nothing and says what to tick', async (t) => {
  const { srv, alice, aliceUser, mock } = await setup(t);
  mock.reply = () => ({
    status: 200,
    body: {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
      scope: 'openid https://www.googleapis.com/auth/userinfo.email',
      id_token: jwt({ email: 'person@gmail.com' }),
    },
  });
  const { state } = await start(alice);
  const msg = await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c&state=${state}`));
  assert.match(msg, /Mail access wasn't granted/);
  assert.match(msg, /Gmail permission/);
  assert.equal(accountsOf(srv, aliceUser.id).length, 0);
  assert.equal(srv.syncManager.calls.syncAccount.length, 0);
});

test('callback: a rejected client secret is reported as a server setting', async (t) => {
  const { alice, mock } = await setup(t);
  mock.reply = () => ({ status: 401, body: { error: 'invalid_client', error_description: 'Unauthorized' } });
  const { state } = await start(alice);
  const msg = await oauthError(alice, await alice.get(`/api/oauth/google/callback?code=c&state=${state}`));
  assert.match(msg, /site owner should check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
});

test('callback: new accounts get distinct palette colours; existing ones keep theirs', async (t) => {
  const { srv, alice, aliceUser, mock } = await setup(t);
  // One existing account already uses the first palette colour (indigo).
  seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'old@example.com', color: '#4f46e5' });
  let email = 'first@gmail.com';
  mock.reply = () => ({ status: 200, body: { access_token: 'a', refresh_token: 'r', expires_in: 3600, id_token: jwt({ email }) } });

  const one = await start(alice);
  await alice.get(`/api/oauth/google/callback?code=c&state=${one.state}`);
  email = 'second@gmail.com';
  const two = await start(alice);
  await alice.get(`/api/oauth/google/callback?code=c&state=${two.state}`);
  const colors = Object.fromEntries(accountsOf(srv, aliceUser.id).map((a) => [a.email, a.color]));
  assert.equal(colors['first@gmail.com'], '#2563eb');
  assert.equal(colors['second@gmail.com'], '#0891b2');

  // Reconnecting keeps the colour the user has.
  srv.db.prepare("UPDATE accounts SET color = '#123456' WHERE email = 'first@gmail.com'").run();
  email = 'first@gmail.com';
  const again = await start(alice);
  await alice.get(`/api/oauth/google/callback?code=c&state=${again.state}`);
  assert.equal(srv.db.prepare("SELECT color FROM accounts WHERE email = 'first@gmail.com'").get().color, '#123456');
});
