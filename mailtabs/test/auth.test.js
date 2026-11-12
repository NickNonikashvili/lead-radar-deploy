'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, makeClient, signupUser, DEFAULT_TEST_PASSWORD } = require('./helpers');
const { sha256Hex } = require('../src/crypto');

const PASSWORD = DEFAULT_TEST_PASSWORD;

function sessionCookieLine(res) {
  return res.headers.getSetCookie().find((l) => l.startsWith('mt_session=') || l.startsWith('__Host-mt_session='));
}

test('auth', async (t) => {
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());

  await t.test('signup creates the user, signs in, and sets a hardened cookie', async () => {
    const client = makeClient(srv.baseUrl);
    const res = await client.post('/api/auth/signup', { email: '  Alice@Example.com ', password: PASSWORD, name: ' Alice ' });
    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.body.user).sort(), ['email', 'id', 'name']);
    assert.equal(res.body.user.email, 'alice@example.com');
    assert.equal(res.body.user.name, 'Alice');

    const line = sessionCookieLine(res);
    assert.ok(line, 'Set-Cookie for mt_session');
    assert.match(line, /; HttpOnly/i);
    assert.match(line, /; SameSite=Lax/i);
    assert.match(line, /; Path=\//);
    assert.match(line, /; Max-Age=2592000/);
    assert.doesNotMatch(line, /; Secure/i, 'not Secure on plain http');

    // Only the sha256 of the token is stored.
    const token = client.cookies.get('mt_session');
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    const rows = srv.db.prepare('SELECT id, expires_at, created_at FROM sessions WHERE user_id = ?').all(res.body.user.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, sha256Hex(token));
    assert.notEqual(rows[0].id, token);
    assert.ok(Math.abs(rows[0].expires_at - rows[0].created_at - 30 * 24 * 3600 * 1000) < 1000);

    const pw = srv.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(res.body.user.id).password_hash;
    assert.match(pw, /^scrypt\$/);

    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.deepEqual(me.body.user, res.body.user);
  });

  await t.test('signup validation', async () => {
    const client = makeClient(srv.baseUrl);
    let res = await client.post('/api/auth/signup', { email: 'not-an-email', password: PASSWORD });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_EMAIL');
    assert.ok(res.body.error);

    res = await client.post('/api/auth/signup', { email: 'short@example.com', password: 'seven77' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'WEAK_PASSWORD');

    res = await client.post('/api/auth/signup', { email: 'nopw@example.com' });
    assert.equal(res.status, 400);

    res = await client.post('/api/auth/signup', { email: ['x@example.com'], password: PASSWORD });
    assert.equal(res.status, 400);

    res = await client.post('/api/auth/signup', { email: 'ALICE@example.com', password: PASSWORD });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'EMAIL_TAKEN');
    assert.equal(client.cookies.has('mt_session'), false, 'failed signups do not sign in');
  });

  await t.test('me without a session is 401', async () => {
    const client = makeClient(srv.baseUrl);
    const res = await client.get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Not signed in', code: 'UNAUTHENTICATED' });
  });

  await t.test('a forged or unknown cookie is rejected and cleared', async () => {
    const client = makeClient(srv.baseUrl);
    client.setCookie('mt_session', 'forged-token-value');
    const res = await client.get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.match(sessionCookieLine(res), /Expires=Thu, 01 Jan 1970/);
    assert.equal(client.cookies.has('mt_session'), false);
  });

  await t.test('login: wrong password and unknown email look identical', async () => {
    const client = makeClient(srv.baseUrl);
    const wrong = await client.post('/api/auth/login', { email: 'alice@example.com', password: 'wrong password!' });
    const unknown = await client.post('/api/auth/login', { email: 'nobody@example.com', password: 'wrong password!' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
    assert.equal(wrong.body.code, 'INVALID_CREDENTIALS');
    assert.equal(client.cookies.has('mt_session'), false);

    const missing = await client.post('/api/auth/login', { email: 'alice@example.com' });
    assert.equal(missing.status, 400);
  });

  await t.test('login succeeds case-insensitively and creates a separate session', async () => {
    const client = makeClient(srv.baseUrl);
    const res = await client.post('/api/auth/login', { email: 'ALICE@EXAMPLE.COM', password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'alice@example.com');
    assert.ok(sessionCookieLine(res));
    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(res.body.user.id).n, 2);
  });

  await t.test('logout deletes the session and clears the cookie; the old token is dead', async () => {
    const client = makeClient(srv.baseUrl);
    await signupUser(client, { email: 'logout@example.com' });
    const token = client.cookies.get('mt_session');

    const res = await client.post('/api/auth/logout');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.match(sessionCookieLine(res), /Expires=Thu, 01 Jan 1970/);
    assert.equal(client.cookies.has('mt_session'), false);
    assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE id = ?').get(sha256Hex(token)).n, 0);

    const replay = makeClient(srv.baseUrl);
    replay.setCookie('mt_session', token);
    assert.equal((await replay.get('/api/auth/me')).status, 401);

    // Logging out without a session is harmless.
    assert.equal((await makeClient(srv.baseUrl).post('/api/auth/logout')).status, 200);
  });

  await t.test('password change verifies the current password and signs out other sessions', async () => {
    const email = 'pwchange@example.com';
    const laptop = makeClient(srv.baseUrl);
    await signupUser(laptop, { email });
    const phone = makeClient(srv.baseUrl);
    assert.equal((await phone.post('/api/auth/login', { email, password: PASSWORD })).status, 200);

    let res = await laptop.post('/api/auth/password', { currentPassword: 'not my password', newPassword: 'brand new password' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'WRONG_PASSWORD');

    res = await laptop.post('/api/auth/password', { currentPassword: PASSWORD, newPassword: 'short' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'WEAK_PASSWORD');

    res = await laptop.post('/api/auth/password', { currentPassword: PASSWORD, newPassword: 'brand new password' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });

    assert.equal((await laptop.get('/api/auth/me')).status, 200, 'current session survives');
    assert.equal((await phone.get('/api/auth/me')).status, 401, 'other session is signed out');

    const fresh = makeClient(srv.baseUrl);
    assert.equal((await fresh.post('/api/auth/login', { email, password: PASSWORD })).status, 401);
    assert.equal((await fresh.post('/api/auth/login', { email, password: 'brand new password' })).status, 200);

    // Needs a session.
    res = await makeClient(srv.baseUrl).post('/api/auth/password', { currentPassword: 'x', newPassword: 'yyyyyyyy' });
    assert.equal(res.status, 401);
  });

  await t.test('sliding expiry: refreshed at most once per hour', async () => {
    const client = makeClient(srv.baseUrl);
    await signupUser(client, { email: 'sliding@example.com' });
    const id = sha256Hex(client.cookies.get('mt_session'));
    const get = () => srv.db.prepare('SELECT last_seen_at, expires_at FROM sessions WHERE id = ?').get(id);

    // Seen 10 minutes ago: no refresh, no new cookie.
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    srv.db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(tenMinAgo, tenMinAgo + 1e9, id);
    let res = await client.get('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(get().last_seen_at, tenMinAgo);
    assert.equal(sessionCookieLine(res), undefined);

    // Seen 2 hours ago: refreshed, expiry pushed out to 30 days from now, cookie re-sent.
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
    srv.db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(twoHoursAgo, twoHoursAgo + 1e9, id);
    const before = Date.now();
    res = await client.get('/api/auth/me');
    assert.equal(res.status, 200);
    const row = get();
    assert.ok(row.last_seen_at >= before);
    assert.ok(row.expires_at >= before + 30 * 24 * 3600 * 1000 - 1000);
    assert.match(sessionCookieLine(res), /Max-Age=2592000/);
  });

  await t.test('expired sessions are rejected and deleted on read', async () => {
    const client = makeClient(srv.baseUrl);
    await signupUser(client, { email: 'expired@example.com' });
    const id = sha256Hex(client.cookies.get('mt_session'));
    srv.db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, id);
    const res = await client.get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE id = ?').get(id).n, 0);
  });

  await t.test('CSRF: state-changing API requests need X-Mailtabs: 1', async () => {
    const client = makeClient(srv.baseUrl);
    const body = JSON.stringify({ email: 'alice@example.com', password: PASSWORD });
    const headers = { 'content-type': 'application/json' };

    let res = await client.raw('/api/auth/login', { method: 'POST', headers, body });
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Missing CSRF header', code: 'CSRF' });
    assert.equal(client.cookies.has('mt_session'), false);

    res = await client.raw('/api/auth/login', { method: 'POST', headers: { ...headers, 'x-mailtabs': '0' }, body });
    assert.equal(res.status, 403);

    // A simple cross-site form post (no custom header possible) is rejected too.
    res = await client.raw('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=evil%40example.com&password=xxxxxxxxxx',
    });
    assert.equal(res.status, 403);

    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      res = await client.raw('/api/tabs/1', { method });
      assert.equal(res.status, 403, method);
    }

    res = await client.raw('/api/auth/login', { method: 'POST', headers: { ...headers, 'x-mailtabs': '1' }, body });
    assert.equal(res.status, 200);
    // GET needs no header
    assert.equal((await client.raw('/api/auth/me')).status, 200);
  });

  await t.test('rate limit: 10 attempts per 15 minutes per IP + email', async () => {
    const client = makeClient(srv.baseUrl);
    const email = 'victim@example.com';
    for (let i = 0; i < 10; i++) {
      const res = await client.post('/api/auth/login', { email, password: `guess-${i}-xx` });
      assert.equal(res.status, 401, `attempt ${i + 1}`);
    }
    const blocked = await client.post('/api/auth/login', { email: email.toUpperCase(), password: 'guess-x-xx' });
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { error: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' });
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);

    // A different email from the same IP is not affected.
    const other = await client.post('/api/auth/login', { email: 'someone-else@example.com', password: 'whatever-x' });
    assert.equal(other.status, 401);
  });

  await t.test('rate limit applies to signup too', async () => {
    const client = makeClient(srv.baseUrl);
    for (let i = 0; i < 10; i++) {
      const res = await client.post('/api/auth/signup', { email: 'ratelimited-signup@example.com', password: 'short' });
      assert.equal(res.status, 400);
    }
    const res = await client.post('/api/auth/signup', { email: 'ratelimited-signup@example.com', password: PASSWORD });
    assert.equal(res.status, 429);
    assert.equal(res.body.code, 'RATE_LIMITED');
  });

  await t.test('a successful login resets the counter for that email', async () => {
    const email = 'forgetful@example.com';
    await signupUser(makeClient(srv.baseUrl), { email });
    const client = makeClient(srv.baseUrl);
    for (let i = 0; i < 9; i++) await client.post('/api/auth/login', { email, password: 'nope-nope' });
    assert.equal((await client.post('/api/auth/login', { email, password: PASSWORD })).status, 200);
    for (let i = 0; i < 9; i++) {
      assert.equal((await client.post('/api/auth/login', { email, password: 'nope-nope' })).status, 401);
    }
  });
});

test('ALLOW_SIGNUPS=false: the first user can sign up, later ones cannot', async (t) => {
  const srv = await startTestServer({ ALLOW_SIGNUPS: 'false' }, { stubSync: true });
  t.after(() => srv.close());

  const anon = makeClient(srv.baseUrl);
  let cfg = await anon.get('/api/config');
  assert.equal(cfg.status, 200);
  assert.equal(cfg.body.allowSignups, true, 'open until the first account exists');

  const owner = makeClient(srv.baseUrl);
  const first = await owner.post('/api/auth/signup', { email: 'owner@example.com', password: PASSWORD });
  assert.equal(first.status, 201);

  const second = await makeClient(srv.baseUrl).post('/api/auth/signup', { email: 'stranger@example.com', password: PASSWORD });
  assert.equal(second.status, 403);
  assert.equal(second.body.code, 'SIGNUPS_DISABLED');
  assert.ok(second.body.error);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);

  cfg = await anon.get('/api/config');
  assert.equal(cfg.body.allowSignups, false);

  // Existing users can still sign in.
  assert.equal((await makeClient(srv.baseUrl).post('/api/auth/login', { email: 'owner@example.com', password: PASSWORD })).status, 200);
});

test('concurrent first signups with ALLOW_SIGNUPS=false create only one account', async (t) => {
  const srv = await startTestServer({ ALLOW_SIGNUPS: 'false' }, { stubSync: true });
  t.after(() => srv.close());
  const results = await Promise.all(
    ['a', 'b', 'c'].map((p) => makeClient(srv.baseUrl).post('/api/auth/signup', { email: `${p}@example.com`, password: PASSWORD }))
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 403, 403]);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
});

test('https APP_URL marks the session cookie Secure', async (t) => {
  const srv = await startTestServer({ APP_URL: 'https://mail.example.com' }, { stubSync: true });
  t.after(() => srv.close());
  const res = await makeClient(srv.baseUrl).post('/api/auth/signup', { email: 'secure@example.com', password: PASSWORD });
  assert.equal(res.status, 201);
  const line = sessionCookieLine(res);
  assert.match(line, /^__Host-mt_session=/, 'HTTPS sessions use the __Host- prefix');
  assert.match(line, /; Path=\//);
  assert.doesNotMatch(line, /; Domain=/i);
  assert.match(line, /; Secure/);
  assert.match(line, /; HttpOnly/);
  assert.match(res.headers.get('strict-transport-security') || '', /max-age=\d+/);
});
