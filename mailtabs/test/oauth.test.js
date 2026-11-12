'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getFreshAccessToken,
  OAuthError,
  decodeJwtPayload,
  grantsMailScope,
  redirectUriFor,
} = require('../src/oauth');
const { oauthProviders } = require('../src/providers');
const imap = require('../src/imap');
const { makeEngineEnv, createUser, createAccount, getAccount } = require('./engine-helpers');

// ---------------------------------------------------------------------------------------------
// Mock token endpoint
// ---------------------------------------------------------------------------------------------

function jwt(claims) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(claims)}.signature-not-checked`;
}

/** Starts a token endpoint; `respond(form, req)` returns { status, body }. */
async function startTokenServer() {
  const state = {
    requests: [],
    respond: () => ({ status: 200, body: { access_token: 'at-default', expires_in: 3600 } }),
  };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const form = Object.fromEntries(new URLSearchParams(raw));
      state.requests.push({ method: req.method, url: req.url, headers: req.headers, form });
      const { status = 200, body } = state.respond(form, req) || {};
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  state.tokenUrl = `http://127.0.0.1:${port}/token`;
  state.close = () => new Promise((resolve) => server.close(resolve));
  return state;
}

let mock;
test.before(async () => {
  mock = await startTokenServer();
});
test.after(async () => {
  await mock.close();
});
test.beforeEach(() => {
  mock.requests.length = 0;
  mock.respond = () => ({ status: 200, body: { access_token: 'at-default', expires_in: 3600 } });
});

function envWithOAuth(extra = {}) {
  return makeEngineEnv({
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    MICROSOFT_CLIENT_ID: 'ms-client',
    MICROSOFT_CLIENT_SECRET: 'ms-secret',
    OAUTH_TEST_ENDPOINTS: JSON.stringify({
      google: { authUrl: 'http://127.0.0.1:1/auth', tokenUrl: mock.tokenUrl, imapHost: '127.0.0.1', imapPort: 1143, imapSecurity: 'none' },
      microsoft: { tokenUrl: mock.tokenUrl },
    }),
    ...extra,
  });
}

function providersFor(env) {
  return oauthProviders(env.config);
}

// ---------------------------------------------------------------------------------------------
// buildAuthUrl
// ---------------------------------------------------------------------------------------------

test('buildAuthUrl includes PKCE, state, scopes and provider extras', () => {
  const env = envWithOAuth();
  try {
    const { google, microsoft } = providersFor(env);
    const url = new URL(
      buildAuthUrl(google, { state: 'st4te', codeChallenge: 'ch4llenge', redirectUri: 'http://localhost:3999/api/oauth/google/callback', loginHint: 'me@gmail.com' })
    );
    assert.equal(url.origin + url.pathname, 'http://127.0.0.1:1/auth');
    const q = Object.fromEntries(url.searchParams);
    assert.equal(q.client_id, 'google-client');
    assert.equal(q.redirect_uri, 'http://localhost:3999/api/oauth/google/callback');
    assert.equal(q.response_type, 'code');
    assert.equal(q.scope, 'https://mail.google.com/ openid email profile');
    assert.equal(q.state, 'st4te');
    assert.equal(q.code_challenge, 'ch4llenge');
    assert.equal(q.code_challenge_method, 'S256');
    assert.equal(q.access_type, 'offline');
    assert.equal(q.prompt, 'consent');
    assert.equal(q.include_granted_scopes, 'true');
    assert.equal(q.login_hint, 'me@gmail.com');
    assert.equal(q.client_secret, undefined, 'the secret never goes to the browser');

    const ms = new URL(buildAuthUrl(microsoft, { state: 's', codeChallenge: 'c', redirectUri: 'http://x/cb' }));
    assert.equal(ms.searchParams.get('prompt'), 'select_account');
    assert.ok(ms.searchParams.get('scope').includes('offline_access'));
    assert.ok(ms.searchParams.get('scope').startsWith('https://outlook.office.com/IMAP.AccessAsUser.All '), 'IMAP scope first');
    assert.equal(ms.searchParams.get('login_hint'), null);
    assert.throws(() => buildAuthUrl(google, { state: 's' }), OAuthError);
  } finally {
    env.close();
  }
});

// ---------------------------------------------------------------------------------------------
// exchangeCode
// ---------------------------------------------------------------------------------------------

test('exchangeCode posts the right form and reads the Google id_token email', async () => {
  const env = envWithOAuth();
  try {
    const { google } = providersFor(env);
    mock.respond = () => ({
      status: 200,
      body: {
        access_token: 'ya29.access',
        refresh_token: '1//refresh',
        expires_in: 3599,
        token_type: 'Bearer',
        id_token: jwt({ email: 'Me@Gmail.com', email_verified: true, name: 'Me Myself', sub: '123' }),
      },
    });
    const before = Date.now();
    const out = await exchangeCode(google, { code: 'auth-code', codeVerifier: 'verifier-xyz', redirectUri: 'http://localhost:3999/api/oauth/google/callback' });
    assert.equal(out.accessToken, 'ya29.access');
    assert.equal(out.refreshToken, '1//refresh');
    assert.equal(out.email, 'Me@Gmail.com');
    assert.equal(out.name, 'Me Myself');
    assert.ok(out.expiresAt >= before + 3599000 && out.expiresAt <= Date.now() + 3599000);

    assert.equal(mock.requests.length, 1);
    const req = mock.requests[0];
    assert.equal(req.method, 'POST');
    assert.match(req.headers['content-type'], /application\/x-www-form-urlencoded/);
    assert.deepEqual(req.form, {
      client_id: 'google-client',
      client_secret: 'google-secret',
      grant_type: 'authorization_code',
      code: 'auth-code',
      redirect_uri: 'http://localhost:3999/api/oauth/google/callback',
      code_verifier: 'verifier-xyz',
    });
  } finally {
    env.close();
  }
});

test('exchangeCode: Microsoft falls back to preferred_username; missing refresh token is null', async () => {
  const env = envWithOAuth();
  try {
    const { microsoft } = providersFor(env);
    mock.respond = () => ({ body: { access_token: 'eyJ.ms', expires_in: 4000, id_token: jwt({ preferred_username: 'someone@outlook.com', name: 'Some One' }) } });
    const out = await exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'http://x/cb' });
    assert.equal(out.email, 'someone@outlook.com');
    assert.equal(out.refreshToken, null);
    assert.equal(mock.requests[0].form.client_id, 'ms-client');

    // Google does not use preferred_username.
    const { google } = providersFor(env);
    mock.respond = () => ({ body: { access_token: 'a', id_token: jwt({ preferred_username: 'x@y.z' }) } });
    await assert.rejects(exchangeCode(google, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), (err) => {
      assert.ok(err instanceof OAuthError);
      assert.equal(err.code, 'oauth_error');
      assert.match(err.message, /email/i);
      return true;
    });
  } finally {
    env.close();
  }
});

test('exchangeCode: no id_token / non-email claim -> OAuthError', async () => {
  const env = envWithOAuth();
  try {
    const { microsoft } = providersFor(env);
    mock.respond = () => ({ body: { access_token: 'a' } });
    await assert.rejects(exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), OAuthError);
    mock.respond = () => ({ body: { access_token: 'a', id_token: jwt({ preferred_username: '+15551234567' }) } });
    await assert.rejects(exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), (err) => {
      assert.ok(err instanceof OAuthError);
      assert.match(err.message, /mailbox address/);
      assert.match(err.message, /phone number/);
      return true;
    });
    mock.respond = () => ({ body: { access_token: 'a', id_token: 'garbage' } });
    await assert.rejects(exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), OAuthError);
    // Usernames that only look a bit like addresses are not used as the mailbox.
    for (const name of ['jdoe', 'jdoe@contoso', 'j doe@contoso.com', `${'a'.repeat(250)}@contoso.com`]) {
      mock.respond = () => ({ body: { access_token: 'a', id_token: jwt({ preferred_username: name }) } });
      await assert.rejects(exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), OAuthError, name);
    }
    // A bad email claim falls back to a good preferred_username.
    mock.respond = () => ({ body: { access_token: 'a', id_token: jwt({ email: 'not-an-email', preferred_username: 'jdoe@contoso.com' }) } });
    assert.equal((await exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'r' })).email, 'jdoe@contoso.com');
  } finally {
    env.close();
  }
});

test('exchangeCode refuses a grant without mail access (granular consent)', async () => {
  const env = envWithOAuth();
  try {
    const { google, microsoft } = providersFor(env);
    const idToken = jwt({ email: 'me@gmail.com' });
    // Google: the user unticked the Gmail permission but allowed sign-in.
    mock.respond = () => ({
      body: { access_token: 'a', refresh_token: 'r', scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile', id_token: idToken },
    });
    await assert.rejects(exchangeCode(google, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), (err) => {
      assert.ok(err instanceof OAuthError);
      assert.equal(err.code, 'insufficient_scope');
      assert.match(err.message, /Mail access wasn't granted/);
      assert.match(err.message, /Gmail/);
      return true;
    });
    mock.respond = () => ({ body: { access_token: 'a', scope: 'https://mail.google.com/ openid https://www.googleapis.com/auth/userinfo.email', id_token: idToken } });
    assert.equal((await exchangeCode(google, { code: 'c', codeVerifier: 'v', redirectUri: 'r' })).email, 'me@gmail.com');
    // No scope field at all means "what was asked for" (RFC 6749 §5.1).
    mock.respond = () => ({ body: { access_token: 'a', id_token: idToken } });
    assert.equal((await exchangeCode(google, { code: 'c', codeVerifier: 'v', redirectUri: 'r' })).email, 'me@gmail.com');

    // Microsoft: the token must carry IMAP.AccessAsUser.All.
    const msToken = jwt({ email: 'me@outlook.com' });
    mock.respond = () => ({ body: { access_token: 'a', scope: 'openid profile email offline_access', id_token: msToken } });
    await assert.rejects(exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), (err) => err.code === 'insufficient_scope');
    mock.respond = () => ({ body: { access_token: 'a', scope: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/User.Read', id_token: msToken } });
    assert.equal((await exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'r' })).email, 'me@outlook.com');
  } finally {
    env.close();
  }
});

test('grantsMailScope accepts the full or the bare scope name, in any case', () => {
  const env = envWithOAuth();
  try {
    const { google, microsoft } = providersFor(env);
    assert.equal(grantsMailScope(google, 'https://mail.google.com/'), true);
    assert.equal(grantsMailScope(google, 'openid https://mail.google.com'), true);
    assert.equal(grantsMailScope(google, 'openid email'), false);
    assert.equal(grantsMailScope(google, 'https://mail.google.com.evil.example/'), false);
    assert.equal(grantsMailScope(google, undefined), true);
    assert.equal(grantsMailScope(google, ''), true);
    assert.equal(grantsMailScope(microsoft, 'IMAP.AccessAsUser.All offline_access'), true);
    assert.equal(grantsMailScope(microsoft, 'https://outlook.office.com/imap.accessasuser.all'), true);
    assert.equal(grantsMailScope(microsoft, 'https://outlook.office.com/SMTP.Send'), false);
    assert.equal(redirectUriFor(env.config, 'google'), `${env.config.appUrl}/api/oauth/google/callback`);
  } finally {
    env.close();
  }
});

test('exchangeCode: provider errors become OAuthError with code and status', async () => {
  const env = envWithOAuth();
  try {
    const { google } = providersFor(env);
    mock.respond = () => ({ status: 400, body: { error: 'invalid_grant', error_description: 'Bad Request' } });
    await assert.rejects(exchangeCode(google, { code: 'used', codeVerifier: 'v', redirectUri: 'r' }), (err) => {
      assert.equal(err.code, 'invalid_grant');
      assert.equal(err.status, 400);
      return true;
    });
    // The server's own client ID/secret were refused: a configuration problem for the site owner.
    mock.respond = () => ({ status: 401, body: { error: 'invalid_client', error_description: 'The OAuth client was not found.' } });
    await assert.rejects(exchangeCode(google, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), (err) => {
      assert.equal(err.code, 'invalid_client');
      assert.equal(err.status, 401);
      assert.match(err.message, /OAuth client was not found/);
      assert.match(err.message, /site owner should check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
      assert.ok(err.message.length <= 300, 'fits the callback error redirect');
      return true;
    });
    mock.respond = () => ({ status: 401, body: { error: 'deleted_client', error_description: 'The OAuth client was deleted.' } });
    await assert.rejects(exchangeCode(google, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), (err) => {
      assert.equal(err.code, 'invalid_client');
      assert.match(err.message, /unused for 6 months/);
      return true;
    });
    mock.respond = () => ({ status: 400, body: { error: 'unauthorized_client' } });
    await assert.rejects(exchangeCode(google, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), (err) => err.code === 'invalid_client');
    mock.respond = () => ({ status: 502, body: '<html>bad gateway</html>' });
    await assert.rejects(exchangeCode(google, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }), (err) => err.code === 'oauth_error' && err.status === 502);
    await assert.rejects(exchangeCode(google, { code: '', codeVerifier: 'v', redirectUri: 'r' }), OAuthError);
  } finally {
    env.close();
  }
});

test('token endpoint unreachable -> OAuthError oauth_error', async () => {
  const env = envWithOAuth();
  try {
    const google = { ...providersFor(env).google, tokenUrl: 'http://127.0.0.1:1/token' };
    await assert.rejects(refreshAccessToken(google, 'rt'), (err) => {
      assert.ok(err instanceof OAuthError);
      assert.equal(err.code, 'oauth_error');
      assert.match(err.message, /Could not reach/);
      return true;
    });
  } finally {
    env.close();
  }
});

// ---------------------------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------------------------

test('refreshAccessToken keeps the original refresh token unless the provider rotates it', async () => {
  const env = envWithOAuth();
  try {
    const { google, microsoft } = providersFor(env);
    mock.respond = () => ({ body: { access_token: 'new-at', expires_in: 3600 } });
    const kept = await refreshAccessToken(google, 'orig-rt');
    assert.deepEqual({ a: kept.accessToken, r: kept.refreshToken }, { a: 'new-at', r: 'orig-rt' });
    assert.deepEqual(mock.requests[0].form, {
      client_id: 'google-client',
      client_secret: 'google-secret',
      grant_type: 'refresh_token',
      refresh_token: 'orig-rt',
    });

    mock.respond = () => ({ body: { access_token: 'new-at-2', refresh_token: 'rotated-rt', expires_in: 3600 } });
    const rotated = await refreshAccessToken(microsoft, 'orig-rt');
    assert.equal(rotated.refreshToken, 'rotated-rt');
    // Microsoft issues the token for the first scope's resource, so the IMAP scope leads.
    assert.equal(mock.requests[1].form.scope, 'https://outlook.office.com/IMAP.AccessAsUser.All offline_access', 'Microsoft refresh sends scope');
    assert.equal(mock.requests[1].form.client_id, 'ms-client');
    assert.equal(mock.requests[1].form.client_secret, 'ms-secret');

    mock.respond = () => ({ status: 400, body: { error: 'invalid_grant' } });
    await assert.rejects(refreshAccessToken(google, 'revoked'), (err) => err.code === 'invalid_grant');
    await assert.rejects(refreshAccessToken(google, ''), (err) => err.code === 'invalid_grant');
  } finally {
    env.close();
  }
});

// ---------------------------------------------------------------------------------------------
// getFreshAccessToken
// ---------------------------------------------------------------------------------------------

function oauthAccount(env, secret, overrides = {}) {
  const userId = createUser(env.db);
  return createAccount(env.db, env.crypto, userId, {
    provider: 'gmail',
    auth_type: 'oauth',
    email: 'me@gmail.com',
    imap_user: 'me@gmail.com',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_security: 'tls',
    secret,
    ...overrides,
  });
}

test('getFreshAccessToken returns the stored token while it has > 2 minutes left (no request)', async () => {
  const env = envWithOAuth();
  try {
    const account = oauthAccount(env, { refreshToken: 'rt', accessToken: 'still-good', accessTokenExpiresAt: Date.now() + 10 * 60 * 1000 });
    const token = await getFreshAccessToken(env, account);
    assert.equal(token, 'still-good');
    assert.equal(mock.requests.length, 0);
  } finally {
    env.close();
  }
});

test('getFreshAccessToken refreshes an expiring token and persists the new secret (rotated refresh token)', async () => {
  const env = envWithOAuth();
  try {
    const account = oauthAccount(env, { refreshToken: 'rt-1', accessToken: 'old', accessTokenExpiresAt: Date.now() + 60 * 1000 });
    mock.respond = () => ({ body: { access_token: 'fresh', refresh_token: 'rt-2', expires_in: 3600 } });
    const token = await getFreshAccessToken(env, account);
    assert.equal(token, 'fresh');
    assert.equal(mock.requests.length, 1);
    assert.equal(mock.requests[0].form.refresh_token, 'rt-1');

    const stored = env.crypto.decryptJson(getAccount(env.db, account.id).secret_enc);
    assert.equal(stored.accessToken, 'fresh');
    assert.equal(stored.refreshToken, 'rt-2');
    assert.ok(stored.accessTokenExpiresAt > Date.now() + 50 * 60 * 1000);

    // The caller's stale row still works: the stored (fresh) secret is used, no new request.
    const again = await getFreshAccessToken(env, account);
    assert.equal(again, 'fresh');
    assert.equal(mock.requests.length, 1);
  } finally {
    env.close();
  }
});

test('getFreshAccessToken keeps the refresh token when the provider does not rotate it', async () => {
  const env = envWithOAuth();
  try {
    const account = oauthAccount(env, { refreshToken: 'keep-me', accessToken: null, accessTokenExpiresAt: 0 });
    mock.respond = () => ({ body: { access_token: 'fresh', expires_in: 3600 } });
    assert.equal(await getFreshAccessToken(env, account), 'fresh');
    assert.equal(env.crypto.decryptJson(getAccount(env.db, account.id).secret_enc).refreshToken, 'keep-me');
  } finally {
    env.close();
  }
});

test('getFreshAccessToken: invalid_grant marks the account auth_error', async () => {
  const env = envWithOAuth();
  try {
    const account = oauthAccount(env, { refreshToken: 'revoked', accessToken: 'old', accessTokenExpiresAt: Date.now() - 1000 });
    mock.respond = () => ({ status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } });
    await assert.rejects(getFreshAccessToken(env, account), (err) => {
      assert.ok(err instanceof OAuthError);
      assert.equal(err.code, 'invalid_grant');
      return true;
    });
    const row = getAccount(env.db, account.id);
    assert.equal(row.status, 'auth_error');
    // The message names the likely causes, including the Testing-mode 7-day expiry.
    assert.match(row.last_error, /^Google stopped accepting this account's saved sign-in — reconnect it\./);
    assert.match(row.last_error, /"Testing" mode/);
    assert.match(row.last_error, /7 days/);
    assert.match(row.last_error, /password changed/);
    assert.match(row.last_error, /6 months/);
    assert.match(row.last_error, /100 times/);
    assert.equal(imap.isAuthFailure(new OAuthError('x', 'invalid_grant')), true);
    assert.equal(imap.friendlyImapError(new OAuthError(row.last_error, 'invalid_grant')), row.last_error);

    const ms = oauthAccount(env, { refreshToken: 'gone', accessToken: 'old', accessTokenExpiresAt: 0 }, { provider: 'outlook', email: 'me@outlook.com' });
    await assert.rejects(getFreshAccessToken(env, ms), (err) => err.code === 'invalid_grant');
    assert.equal(getAccount(env.db, ms.id).status, 'auth_error');
    assert.match(getAccount(env.db, ms.id).last_error, /^Microsoft stopped accepting .*reconnect it/);
  } finally {
    env.close();
  }
});

test('getFreshAccessToken: a rejected client ID/secret is a server problem (status error, not auth_error)', async () => {
  const env = envWithOAuth();
  try {
    for (const error of ['invalid_client', 'unauthorized_client', 'deleted_client']) {
      const account = oauthAccount(env, { refreshToken: 'rt', accessToken: 'old', accessTokenExpiresAt: 0 }, { email: `${error}@gmail.com` });
      mock.respond = () => ({ status: 401, body: { error, error_description: 'Unauthorized' } });
      await assert.rejects(getFreshAccessToken(env, account), (err) => {
        assert.ok(err instanceof OAuthError);
        assert.equal(err.code, 'invalid_client');
        assert.equal(imap.isAuthFailure(err), false, 'the user cannot fix this by reconnecting');
        return true;
      });
      const row = getAccount(env.db, account.id);
      assert.equal(row.status, 'error', error);
      assert.match(row.last_error, /site owner should check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
      assert.match(row.last_error, /Nothing is wrong with your account/);
      assert.equal(env.crypto.decryptJson(row.secret_enc).refreshToken, 'rt', 'the refresh token is kept for when the config is fixed');
    }

    const ms = oauthAccount(env, { refreshToken: 'rt', accessToken: 'old', accessTokenExpiresAt: 0 }, { provider: 'outlook', email: 'me@outlook.com' });
    mock.respond = () => ({ status: 401, body: { error: 'invalid_client', error_description: 'AADSTS7000222: The provided client secret keys are expired.' } });
    await assert.rejects(getFreshAccessToken(env, ms), (err) => err.code === 'invalid_client');
    const msRow = getAccount(env.db, ms.id);
    assert.equal(msRow.status, 'error');
    assert.match(msRow.last_error, /MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET/);
    assert.match(msRow.last_error, /expire/);
    mock.respond = () => ({ status: 400, body: { error: 'unauthorized_client', error_description: 'AADSTS70002: not enabled for consumers.' } });
    await assert.rejects(refreshAccessToken(providersFor(env).microsoft, 'rt'), (err) => err.code === 'invalid_client' && /MICROSOFT_TENANT/.test(err.message));
  } finally {
    env.close();
  }
});

test('getFreshAccessToken (Microsoft): IMAP scope first and the rotated refresh token is stored', async () => {
  const env = envWithOAuth();
  try {
    const account = oauthAccount(env, { refreshToken: 'ms-rt-1', accessToken: 'old', accessTokenExpiresAt: 0 }, { provider: 'outlook', email: 'me@outlook.com' });
    mock.respond = () => ({ body: { access_token: 'ms-fresh', refresh_token: 'ms-rt-2', expires_in: 3600 } });
    assert.equal(await getFreshAccessToken(env, account), 'ms-fresh');
    assert.equal(mock.requests[0].form.scope.split(' ')[0], 'https://outlook.office.com/IMAP.AccessAsUser.All');
    assert.equal(mock.requests[0].form.refresh_token, 'ms-rt-1');
    assert.equal(env.crypto.decryptJson(getAccount(env.db, account.id).secret_enc).refreshToken, 'ms-rt-2');

    // The next refresh uses the rotated token.
    env.db.prepare('UPDATE accounts SET secret_enc = ? WHERE id = ?').run(
      env.crypto.encryptJson({ ...env.crypto.decryptJson(getAccount(env.db, account.id).secret_enc), accessTokenExpiresAt: 0 }),
      account.id
    );
    mock.respond = () => ({ body: { access_token: 'ms-fresh-2', refresh_token: 'ms-rt-3', expires_in: 3600 } });
    assert.equal(await getFreshAccessToken(env, account), 'ms-fresh-2');
    assert.equal(mock.requests[1].form.refresh_token, 'ms-rt-2');
    assert.equal(env.crypto.decryptJson(getAccount(env.db, account.id).secret_enc).refreshToken, 'ms-rt-3');
  } finally {
    env.close();
  }
});

test('getFreshAccessToken: other refresh failures do not mark auth_error', async () => {
  const env = envWithOAuth();
  try {
    const account = oauthAccount(env, { refreshToken: 'rt', accessToken: 'old', accessTokenExpiresAt: 0 });
    mock.respond = () => ({ status: 500, body: { error: 'server_error' } });
    await assert.rejects(getFreshAccessToken(env, account), (err) => err.code === 'oauth_error');
    assert.equal(getAccount(env.db, account.id).status, 'pending');
  } finally {
    env.close();
  }
});

test('getFreshAccessToken: no refresh token or unreadable secret -> auth_error', async () => {
  const env = envWithOAuth();
  try {
    const a = oauthAccount(env, { accessToken: 'old', accessTokenExpiresAt: 0 });
    await assert.rejects(getFreshAccessToken(env, a), (err) => err.code === 'invalid_grant');
    assert.equal(getAccount(env.db, a.id).status, 'auth_error');

    const b = oauthAccount(env, { refreshToken: 'x' }, { email: 'b@gmail.com' });
    env.db.prepare('UPDATE accounts SET secret_enc = ? WHERE id = ?').run('v1.bad.bad.bad', b.id);
    await assert.rejects(getFreshAccessToken(env, { ...b, secret_enc: 'v1.bad.bad.bad' }), (err) => err.code === 'invalid_grant');
    assert.equal(getAccount(env.db, b.id).status, 'auth_error');
    assert.match(getAccount(env.db, b.id).last_error, /reconnect/);
    assert.equal(mock.requests.length, 0);
  } finally {
    env.close();
  }
});

test('getFreshAccessToken: provider not configured -> OAuthError', async () => {
  const env = makeEngineEnv(); // no client id/secret
  try {
    const account = oauthAccount(env, { refreshToken: 'rt', accessToken: 'old', accessTokenExpiresAt: 0 });
    await assert.rejects(getFreshAccessToken(env, account), (err) => err instanceof OAuthError && /not configured/.test(err.message));
  } finally {
    env.close();
  }
});

test('getFreshAccessToken: concurrent callers share one refresh', async () => {
  const env = envWithOAuth();
  try {
    const account = oauthAccount(env, { refreshToken: 'rt', accessToken: 'old', accessTokenExpiresAt: 0 });
    mock.respond = () => ({ body: { access_token: 'shared', refresh_token: 'rt-new', expires_in: 3600 } });
    const tokens = await Promise.all([getFreshAccessToken(env, account), getFreshAccessToken(env, account), getFreshAccessToken(env, account)]);
    assert.deepEqual(tokens, ['shared', 'shared', 'shared']);
    assert.equal(mock.requests.length, 1);
  } finally {
    env.close();
  }
});

test('decodeJwtPayload tolerates garbage', () => {
  assert.deepEqual(decodeJwtPayload(jwt({ a: 1 })), { a: 1 });
  assert.equal(decodeJwtPayload('nope'), null);
  assert.equal(decodeJwtPayload('a.%%%.c'), null);
  assert.equal(decodeJwtPayload(undefined), null);
});

// ---------------------------------------------------------------------------------------------
// IMAP options for OAuth accounts
// ---------------------------------------------------------------------------------------------

test('buildImapOptions for an OAuth account uses { user, accessToken } (XOAUTH2) with a fresh token', async () => {
  const env = envWithOAuth();
  try {
    // Gmail preset host, but this test config allows private hosts so no DNS is needed: use a literal.
    const account = oauthAccount(
      env,
      { refreshToken: 'rt', accessToken: 'expired', accessTokenExpiresAt: Date.now() - 1 },
      { imap_host: '127.0.0.1', imap_port: 993, imap_security: 'tls' }
    );
    mock.respond = () => ({ body: { access_token: 'xoauth-token', expires_in: 3600 } });
    const opts = await imap.buildImapOptions(env, account);
    assert.deepEqual(opts.auth, { user: 'me@gmail.com', accessToken: 'xoauth-token' });
    assert.equal(opts.auth.pass, undefined);
    assert.equal(opts.secure, true);
    assert.equal(opts.host, '127.0.0.1');
    assert.equal(opts.port, 993);
  } finally {
    env.close();
  }
});
