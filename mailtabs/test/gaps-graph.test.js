'use strict';

// Microsoft Graph send fallback for Microsoft accounts whose SMTP AUTH is turned off (535 5.7.139).
// Everything runs against local mocks: a token endpoint + Graph endpoint (one HTTP server) and an
// in-process SMTP server. Real Microsoft is never contacted.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { buildAuthUrl, exchangeCode, getFreshAccessToken, getGraphAccessToken } = require('../src/oauth');
const { oauthProviders } = require('../src/providers');
const smtp = require('../src/smtp');
const graph = require('../src/graph');
const queries = require('../src/queries');
const { OutboxManager } = require('../src/outbox');
const { makeEngineEnv, createUser, createAccount, getAccount, recordingLogger } = require('./engine-helpers');
const { startSmtpServer } = require('./send-helpers');

const IMAP_SCOPE = 'https://outlook.office.com/IMAP.AccessAsUser.All';
const SMTP_SCOPE = 'https://outlook.office.com/SMTP.Send';
const GRAPH_SCOPE = 'https://graph.microsoft.com/Mail.Send';
const SMTP_OFF = '5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Mailbox. Visit https://aka.ms/smtp_auth_disabled for more information.';

function jwt(claims) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none' })}.${enc(claims)}.x`;
}

/** Token endpoint (/token) + Graph sendMail (/v1.0/me/sendMail) on one local server. */
async function startMicrosoftMock() {
  const state = {
    seq: 0,
    tokenRequests: [],
    graphRequests: [],
    // Default: every refresh rotates the refresh token; Graph accepts the message.
    token: (form) => {
      state.seq += 1;
      const seq = state.seq;
      const graphScope = /graph\.microsoft\.com/.test(form.scope || '');
      return {
        status: 200,
        body: {
          access_token: `${graphScope ? 'graph' : 'imap'}-at-${seq}`,
          refresh_token: `rt-${seq}`,
          expires_in: 3600,
          scope: graphScope ? GRAPH_SCOPE : `${IMAP_SCOPE} ${SMTP_SCOPE}`,
        },
      };
    },
    graph: () => ({ status: 202, body: '' }),
  };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let reply;
      if (req.url === '/token') {
        const form = Object.fromEntries(new URLSearchParams(raw));
        state.tokenRequests.push(form);
        if (state.tokenDelayMs) await new Promise((r) => setTimeout(r, state.tokenDelayMs));
        reply = state.token(form);
        res.writeHead(reply.status, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(reply.body));
      }
      state.graphRequests.push({ method: req.method, url: req.url, headers: req.headers, body: raw });
      reply = state.graph(req);
      res.writeHead(reply.status, { 'content-type': 'application/json', ...(reply.headers || {}) });
      res.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  state.port = port;
  state.tokenUrl = `http://127.0.0.1:${port}/token`;
  state.graphSendUrl = `http://127.0.0.1:${port}/v1.0/me/sendMail`;
  state.reset = () => {
    state.seq = 0;
    state.tokenRequests.length = 0;
    state.graphRequests.length = 0;
    state.token = state.defaultToken;
    state.graph = () => ({ status: 202, body: '' });
    state.tokenDelayMs = 0;
  };
  state.defaultToken = state.token;
  state.close = () => new Promise((resolve) => server.close(resolve));
  return state;
}

let ms;
let smtpOff; // SMTP server answering 535 5.7.139 to every login
let smtpOk; // SMTP server accepting the account's XOAUTH2 token

test.before(async () => {
  ms = await startMicrosoftMock();
  smtpOff = await startSmtpServer({ authError: SMTP_OFF });
  smtpOk = await startSmtpServer({ tokens: { 'me@outlook.com': 'imap-at-valid' } });
});
test.after(async () => {
  await ms.close();
  await smtpOff.close();
  await smtpOk.close();
});
test.beforeEach(() => {
  ms.reset();
  smtpOff.messages.length = 0;
  smtpOff.auths.length = 0;
  smtpOk.messages.length = 0;
  smtpOk.auths.length = 0;
});

function envWithMicrosoft(extra = {}) {
  return makeEngineEnv({
    MICROSOFT_CLIENT_ID: 'ms-client',
    MICROSOFT_CLIENT_SECRET: 'ms-secret',
    GOOGLE_CLIENT_ID: 'g-client',
    GOOGLE_CLIENT_SECRET: 'g-secret',
    OAUTH_TEST_ENDPOINTS: JSON.stringify({ microsoft: { tokenUrl: ms.tokenUrl, graphSendUrl: ms.graphSendUrl } }),
    ...extra,
  });
}

/** A Microsoft OAuth account sending through the given local SMTP server. */
function msAccount(env, { smtpPort = smtpOff.port, secret = {}, ...overrides } = {}) {
  const userId = overrides.user_id || createUser(env.db);
  env.db.prepare("INSERT OR REPLACE INTO user_settings (user_id, settings) VALUES (?, '{\"undoSendSeconds\":0}')").run(userId);
  return createAccount(env.db, env.crypto, userId, {
    provider: 'outlook',
    auth_type: 'oauth',
    email: 'me@outlook.com',
    imap_user: 'me@outlook.com',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_security: 'tls',
    smtp_host: '127.0.0.1',
    smtp_port: smtpPort,
    smtp_security: 'none',
    secret: {
      refreshToken: 'rt-0',
      accessToken: 'imap-at-valid',
      accessTokenExpiresAt: Date.now() + 3600 * 1000,
      grantedScopes: `${IMAP_SCOPE} ${SMTP_SCOPE}`,
      graphScopes: `${GRAPH_SCOPE} offline_access`,
      ...secret,
    },
    ...overrides,
  });
}

function secretOf(env, accountId) {
  return env.crypto.decryptJson(getAccount(env.db, accountId).secret_enc);
}

function outboxFor(env, logger = recordingLogger()) {
  return new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger, sentCopyCheckDelayMs: 0, retryDelayMs: 60000 });
}

async function sendNow(manager, account, payload) {
  const row = manager.queue(account.user_id, { accountId: account.id, subject: 'Hello', html: '<p>Hi there</p>', to: [{ name: 'Bob', address: 'bob@example.org' }], ...payload });
  await manager.sendDue();
  await manager.idle();
  return manager.db.prepare('SELECT * FROM outbox WHERE id = ?').get(row.id);
}

function graphMime(request) {
  return Buffer.from(request.body, 'base64').toString('utf8');
}

// ---------------------------------------------------------------------------------------------

test('Microsoft sign-in asks for Graph Mail.Send (IMAP scope first) and records the consent', async () => {
  const env = envWithMicrosoft();
  try {
    const { microsoft, google } = oauthProviders(env.config);
    const url = new URL(buildAuthUrl(microsoft, { state: 's', codeChallenge: 'c', redirectUri: 'r' }));
    const scopes = url.searchParams.get('scope').split(' ');
    assert.deepEqual(scopes.slice(0, 3), [IMAP_SCOPE, SMTP_SCOPE, GRAPH_SCOPE]);

    // The code-redeem token is the outlook.office.com one: its scope lists only that resource,
    // yet the consent covered Mail.Send too.
    ms.token = () => ({ status: 200, body: { access_token: 'a', refresh_token: 'r', scope: `${IMAP_SCOPE} ${SMTP_SCOPE}`, id_token: jwt({ email: 'me@outlook.com' }) } });
    const tokens = await exchangeCode(microsoft, { code: 'c', codeVerifier: 'v', redirectUri: 'r' });
    assert.equal(tokens.grantedScopes, `${IMAP_SCOPE} ${SMTP_SCOPE}`, 'grantedScopes recorded as before');
    assert.equal(tokens.graphScopes, `${GRAPH_SCOPE} offline_access`);
    assert.equal(google.graphSendScope, null);
  } finally {
    env.close();
  }
});

test('canSend: SMTP.Send or Graph Mail.Send; SMTP turned off and no Graph -> reconnect', () => {
  const env = envWithMicrosoft();
  try {
    const both = msAccount(env);
    assert.deepEqual(smtp.sendRoute(env, both), { route: 'smtp', code: null, message: null });

    const smtpOnly = msAccount(env, { email: 'a@outlook.com', secret: { graphScopes: undefined } });
    assert.equal(smtp.sendRoute(env, smtpOnly).route, 'smtp');

    // Connected after SMTP AUTH was found off: straight to Graph.
    const off = msAccount(env, { email: 'b@outlook.com', smtp_disabled_at: Date.now() });
    assert.equal(smtp.sendRoute(env, off).route, 'graph');
    assert.equal(smtp.sendingStatus(env, off).canSend, true);

    // Graph consent but no SMTP.Send (e.g. a refresh that reported IMAP only): Graph.
    const graphOnly = msAccount(env, { email: 'c@outlook.com', secret: { grantedScopes: IMAP_SCOPE } });
    assert.equal(smtp.sendRoute(env, graphOnly).route, 'graph');

    const stuck = msAccount(env, { email: 'd@outlook.com', smtp_disabled_at: Date.now(), secret: { graphScopes: undefined } });
    const status = smtp.sendingStatus(env, stuck);
    assert.equal(status.canSend, false);
    assert.equal(status.code, 'SMTP_SCOPE_MISSING');
    assert.match(status.message, /Reconnect/);
    assert.match(status.message, /Microsoft Graph/);
    const json = queries.toAccountJson(stuck, { deps: env });
    assert.equal(json.canSend, false);
    assert.equal(json.sendBlockedReason, status.message);
    assert.equal(queries.toAccountJson(off, { deps: env }).canSend, true);

    // Graph consent recorded as refused ('') counts as none.
    const refused = msAccount(env, { email: 'e@outlook.com', smtp_disabled_at: Date.now(), secret: { graphScopes: '' } });
    assert.equal(smtp.sendingStatus(env, refused).canSend, false);

    // Only Microsoft accounts: a Gmail account with smtp_disabled_at set still sends over SMTP.
    const gmail = createAccount(env.db, env.crypto, createUser(env.db), {
      provider: 'gmail',
      auth_type: 'oauth',
      email: 'me@gmail.com',
      imap_user: 'me@gmail.com',
      imap_host: 'imap.gmail.com',
      smtp_disabled_at: Date.now(),
      secret: { refreshToken: 'r', grantedScopes: 'https://mail.google.com/' },
    });
    assert.equal(smtp.sendRoute(env, gmail).route, 'smtp');
  } finally {
    env.close();
  }
});

test('5.7.139 falls back to Graph: base64 MIME with Bcc, remembered per account, Graph token cached', async () => {
  const env = envWithMicrosoft();
  const logger = recordingLogger();
  const manager = outboxFor(env, logger);
  try {
    const account = msAccount(env);
    const row = await sendNow(manager, account, { bcc: [{ name: '', address: 'secret@example.net' }], cc: [{ name: '', address: 'carol@example.com' }] });
    assert.equal(row.status, 'sent', row.error);
    assert.equal(smtpOff.auths.length, 1, 'SMTP was tried first');
    assert.equal(smtpOff.messages.length, 0);

    // Graph token: refresh_token grant for the Graph scope only, rotated refresh token stored.
    assert.equal(ms.tokenRequests.length, 1);
    assert.equal(ms.tokenRequests[0].grant_type, 'refresh_token');
    assert.equal(ms.tokenRequests[0].refresh_token, 'rt-0');
    assert.equal(ms.tokenRequests[0].scope, `${GRAPH_SCOPE} offline_access`);
    const secret = secretOf(env, account.id);
    assert.equal(secret.refreshToken, 'rt-1');
    assert.equal(secret.accessToken, 'imap-at-valid', 'the IMAP token is kept');
    assert.equal(secret.graphScopes, GRAPH_SCOPE);

    // Graph request: POST, bearer Graph token, text/plain, base64 of the full MIME incl. Bcc.
    assert.equal(ms.graphRequests.length, 1);
    const req = ms.graphRequests[0];
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/v1.0/me/sendMail');
    assert.equal(req.headers.authorization, 'Bearer graph-at-1');
    assert.equal(req.headers['content-type'], 'text/plain');
    const mime = graphMime(req);
    assert.match(mime, /^Bcc: secret@example\.net\r?$/m);
    assert.match(mime, /^Cc: carol@example\.com\r?$/m);
    assert.match(mime, /^To: Bob <bob@example\.org>\r?$/m);
    assert.match(mime, /^Subject: Hello\r?$/m);
    assert.match(mime, new RegExp(`^Message-ID: ${row.sent_message_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?$`, 'm'));
    assert.ok(getAccount(env.db, account.id).smtp_disabled_at > 0, 'SMTP AUTH refusal remembered');
    assert.ok(logger.lines.some((l) => /Microsoft Graph/.test(l.text)));

    // The next message goes straight to Graph, with the cached Graph token.
    const fresh = getAccount(env.db, account.id);
    const second = await sendNow(manager, fresh, {});
    assert.equal(second.status, 'sent', second.error);
    assert.equal(smtpOff.auths.length, 1, 'SMTP not tried again');
    assert.equal(ms.tokenRequests.length, 1, 'Graph token reused from memory');
    assert.equal(ms.graphRequests.length, 2);
    assert.doesNotMatch(graphMime(ms.graphRequests[1]), /^Bcc:/m, 'no Bcc when there is none');
  } finally {
    await manager.stop();
    env.close();
  }
});

test('an account that sends over SMTP keeps doing so (no Graph, no Bcc header on the wire)', async () => {
  const env = envWithMicrosoft();
  const manager = outboxFor(env);
  try {
    const account = msAccount(env, { smtpPort: smtpOk.port });
    const row = await sendNow(manager, account, { bcc: [{ name: '', address: 'secret@example.net' }] });
    assert.equal(row.status, 'sent', row.error);
    assert.equal(smtpOk.messages.length, 1);
    assert.deepEqual(smtpOk.messages[0].to.sort(), ['bob@example.org', 'secret@example.net']);
    assert.doesNotMatch(smtpOk.messages[0].raw.toString('utf8'), /^Bcc:/im);
    assert.equal(ms.graphRequests.length, 0);
    assert.equal(getAccount(env.db, account.id).smtp_disabled_at, null);
  } finally {
    await manager.stop();
    env.close();
  }
});

test('5.7.139 without Graph consent: failed with reconnect advice, never retried, canSend false', async () => {
  const env = envWithMicrosoft();
  const manager = outboxFor(env);
  try {
    const account = msAccount(env, { secret: { graphScopes: undefined } });
    const row = await sendNow(manager, account, {});
    assert.equal(row.status, 'failed');
    assert.equal(row.attempts, 1);
    assert.match(row.error, /turned off sending from mail apps/);
    assert.match(row.error, /Reconnect/);
    assert.equal(ms.graphRequests.length, 0);
    assert.equal(ms.tokenRequests.length, 0);
    const after = getAccount(env.db, account.id);
    assert.ok(after.smtp_disabled_at > 0);
    assert.equal(smtp.sendingStatus(env, after).canSend, false);
    assert.throws(() => manager.queue(account.user_id, { accountId: account.id, to: [{ address: 'x@example.org' }] }), (err) => err.status === 400 && err.code === 'SMTP_SCOPE_MISSING');
  } finally {
    await manager.stop();
    env.close();
  }
});

test('too large for Graph: refused before any request, with a clear message', async () => {
  const env = envWithMicrosoft();
  try {
    const account = msAccount(env, { smtp_disabled_at: Date.now() });
    const raw = Buffer.concat([Buffer.from('From: me@outlook.com\r\nTo: bob@example.org\r\nSubject: big\r\n\r\n'), Buffer.alloc(graph.MAX_GRAPH_MIME_BYTES, 'a')]);
    await assert.rejects(smtp.sendMessage(env, account, { from: 'me@outlook.com', recipients: ['bob@example.org'], raw }), (err) => {
      assert.equal(err.code, 'MESSAGE_TOO_LARGE');
      assert.equal(err.retryable, false);
      assert.match(err.message, /too large/);
      assert.match(err.message, /3\.5 MB/);
      return true;
    });
    assert.equal(ms.tokenRequests.length, 0);
    assert.equal(ms.graphRequests.length, 0);
    // Graph's own "too large" (413) reads the same.
    ms.graph = () => ({ status: 413, body: { error: { code: 'RequestEntityTooLarge', message: 'too big' } } });
    await assert.rejects(smtp.sendMessage(env, account, { from: 'me@outlook.com', recipients: ['bob@example.org'], raw: Buffer.from('Subject: x\r\n\r\nhi') }), (err) => err.code === 'MESSAGE_TOO_LARGE' && err.retryable === false);
  } finally {
    env.close();
  }
});

test('Graph consent refused at refresh (AADSTS65001): forgotten, account keeps syncing, reconnect advice', async () => {
  const env = envWithMicrosoft();
  try {
    const account = msAccount(env, { smtp_disabled_at: Date.now() });
    ms.token = () => ({
      status: 400,
      body: { error: 'invalid_grant', error_description: 'AADSTS65001: The user or administrator has not consented to use the application with ID ms-client.' },
    });
    await assert.rejects(smtp.sendMessage(env, account, { from: 'me@outlook.com', recipients: ['bob@example.org'], raw: Buffer.from('Subject: x\r\n\r\nhi') }), (err) => {
      assert.equal(err.code, 'SMTP_SCOPE_MISSING');
      assert.equal(err.retryable, false);
      assert.match(err.message, /Reconnect/);
      return true;
    });
    const after = getAccount(env.db, account.id);
    assert.equal(after.status, 'pending', 'a missing Graph consent is not a revoked sign-in');
    assert.equal(secretOf(env, account.id).graphScopes, '');
    assert.equal(secretOf(env, account.id).refreshToken, 'rt-0', 'the refresh token is kept');
    assert.equal(smtp.sendingStatus(env, after).canSend, false);

    // A revoked refresh token is revoked for IMAP too.
    const other = msAccount(env, { email: 'x@outlook.com', smtp_disabled_at: Date.now() });
    ms.token = () => ({ status: 400, body: { error: 'invalid_grant', error_description: 'AADSTS50173: The provided grant has expired due to it being revoked.' } });
    await assert.rejects(getGraphAccessToken(env, other), (err) => err.code === 'invalid_grant');
    assert.equal(getAccount(env.db, other.id).status, 'auth_error');
  } finally {
    env.close();
  }
});

test('Graph answers: 429/5xx retryable, 401 drops the cached token, 403 asks to reconnect', async () => {
  const env = envWithMicrosoft();
  try {
    const account = msAccount(env, { smtp_disabled_at: Date.now() });
    const send = () => smtp.sendMessage(env, account, { from: 'me@outlook.com', recipients: ['bob@example.org'], raw: Buffer.from('Subject: x\r\n\r\nhi') });

    ms.graph = () => ({ status: 429, headers: { 'retry-after': '7' }, body: { error: { code: 'ApplicationThrottled', message: 'Too many requests' } } });
    await assert.rejects(send(), (err) => err.retryable === true && /limiting how fast/.test(err.message) && /7 s/.test(err.message));
    ms.graph = () => ({ status: 503, body: { error: { code: 'ServiceUnavailable', message: 'busy' } } });
    await assert.rejects(send(), (err) => err.retryable === true && /temporarily/.test(err.message));
    assert.equal(ms.tokenRequests.length, 1, 'the Graph token is reused');

    ms.graph = () => ({ status: 401, body: { error: { code: 'InvalidAuthenticationToken', message: 'Access token has expired' } } });
    await assert.rejects(send(), (err) => err.retryable === false && err.code === 'SMTP_AUTH_FAILED' && /Reconnect/.test(err.message));
    ms.graph = () => ({ status: 202, body: '' });
    const ok = await send();
    assert.equal(ok.via, 'graph');
    assert.deepEqual(ok.accepted, ['bob@example.org']);
    assert.equal(ms.tokenRequests.length, 2, 'a new Graph token after the 401');

    ms.graph = () => ({ status: 403, body: { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } } });
    await assert.rejects(send(), (err) => err.retryable === false && err.code === 'SMTP_SCOPE_MISSING');
    ms.graph = () => ({ status: 400, body: { error: { code: 'ErrorInvalidRecipients', message: 'At least one recipient is not valid.' } } });
    await assert.rejects(send(), (err) => err.retryable === false && /recipient/.test(err.message));
  } finally {
    env.close();
  }
});

test('outbox: a throttled Graph send is retried once, a permanent refusal is not', async () => {
  const env = envWithMicrosoft();
  const manager = outboxFor(env);
  try {
    const account = msAccount(env, { smtp_disabled_at: Date.now() });
    ms.graph = () => ({ status: 429, body: { error: { code: 'ApplicationThrottled', message: 'slow down' } } });
    let row = await sendNow(manager, account, {});
    assert.equal(row.status, 'queued', 'requeued for one automatic retry');
    assert.ok(row.send_at > Date.now() + 30000);
    assert.match(row.error, /Trying again/);

    ms.graph = () => ({ status: 403, body: { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } } });
    row = await sendNow(manager, account, {});
    assert.equal(row.status, 'failed');
    assert.equal(row.attempts, 1);
  } finally {
    await manager.stop();
    env.close();
  }
});

test('the Graph endpoint goes through the SSRF guard (only https, never private addresses)', async () => {
  const strict = makeEngineEnv({
    ALLOW_PRIVATE_IMAP_HOSTS: 'false',
    MICROSOFT_CLIENT_ID: 'ms-client',
    MICROSOFT_CLIENT_SECRET: 'ms-secret',
    OAUTH_TEST_ENDPOINTS: JSON.stringify({ microsoft: { tokenUrl: ms.tokenUrl, graphSendUrl: `https://127.0.0.1:${ms.port}/v1.0/me/sendMail` } }),
  });
  const plain = makeEngineEnv({
    ALLOW_PRIVATE_IMAP_HOSTS: 'false',
    MICROSOFT_CLIENT_ID: 'ms-client',
    MICROSOFT_CLIENT_SECRET: 'ms-secret',
    OAUTH_TEST_ENDPOINTS: JSON.stringify({ microsoft: { tokenUrl: ms.tokenUrl, graphSendUrl: ms.graphSendUrl } }),
  });
  try {
    const raw = Buffer.from('Subject: x\r\n\r\nhi');
    const a = msAccount(strict, { smtp_disabled_at: Date.now() });
    await assert.rejects(graph.sendMimeViaGraph(strict, a, raw, ['bob@example.org']), (err) => err.code === 'HOST_NOT_ALLOWED');
    const b = msAccount(plain, { smtp_disabled_at: Date.now() });
    await assert.rejects(graph.sendMimeViaGraph(plain, b, raw, ['bob@example.org']), (err) => err.code === 'GRAPH_MISCONFIGURED');
    assert.equal(ms.graphRequests.length, 0);
    assert.equal(ms.tokenRequests.length, 0);
    // The real endpoint is a public https URL.
    assert.equal(new URL(oauthProviders(makeEngineEnv().config).microsoft.graphSendUrl).host, 'graph.microsoft.com');
  } finally {
    strict.close();
    plain.close();
  }
});

test('IMAP and Graph refreshes of one account run one after the other and keep each other’s tokens', async () => {
  const env = envWithMicrosoft();
  try {
    const account = msAccount(env, { secret: { accessToken: 'old', accessTokenExpiresAt: 0 } });
    ms.tokenDelayMs = 50;
    const [imapToken, graphToken] = await Promise.all([getFreshAccessToken(env, account), getGraphAccessToken(env, account)]);
    assert.equal(ms.tokenRequests.length, 2);
    // The second refresh used the refresh token the first one rotated.
    assert.equal(ms.tokenRequests[0].refresh_token, 'rt-0');
    assert.equal(ms.tokenRequests[1].refresh_token, 'rt-1');
    assert.equal(imapToken, 'imap-at-1');
    assert.equal(graphToken, 'graph-at-2');
    const secret = secretOf(env, account.id);
    assert.equal(secret.refreshToken, 'rt-2');
    assert.equal(secret.accessToken, 'imap-at-1', 'the Graph refresh did not overwrite the IMAP token');
    assert.equal(secret.graphScopes, GRAPH_SCOPE, 'the IMAP refresh did not drop the Graph scopes');
    assert.equal(secret.grantedScopes, `${IMAP_SCOPE} ${SMTP_SCOPE}`);
  } finally {
    env.close();
  }
});

test('OAuth callback stores the Graph consent; a reconnect forgets that SMTP AUTH was refused', async (t) => {
  const { startTestServer, makeClient, signupUser } = require('./helpers');
  const srv = await startTestServer(
    {
      MICROSOFT_CLIENT_ID: 'ms-client',
      MICROSOFT_CLIENT_SECRET: 'ms-secret',
      OAUTH_TEST_ENDPOINTS: JSON.stringify({
        microsoft: { authUrl: `http://127.0.0.1:${ms.port}/authorize`, tokenUrl: ms.tokenUrl, graphSendUrl: ms.graphSendUrl },
      }),
    },
    { stubSync: true }
  );
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const user = await signupUser(alice, { email: 'alice@example.com' });
  ms.token = () => ({
    status: 200,
    body: { access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: `${IMAP_SCOPE} ${SMTP_SCOPE}`, id_token: jwt({ email: 'me@outlook.com' }) },
  });
  const connect = async () => {
    const start = await alice.get('/api/oauth/microsoft/start');
    assert.equal(start.status, 302);
    const url = new URL(start.headers.get('location'));
    assert.ok(url.searchParams.get('scope').split(' ').includes(GRAPH_SCOPE));
    const res = await alice.get(`/api/oauth/microsoft/callback?code=c&state=${url.searchParams.get('state')}`);
    assert.match(res.headers.get('location'), /connected=/);
    return srv.db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(user.id);
  };
  let account = await connect();
  assert.equal(srv.crypto.decryptJson(account.secret_enc).graphScopes, `${GRAPH_SCOPE} offline_access`);
  srv.db.prepare('UPDATE accounts SET smtp_disabled_at = ? WHERE id = ?').run(Date.now(), account.id);
  const listed = (await alice.get('/api/accounts')).body.accounts[0];
  assert.equal(listed.canSend, true, 'SMTP off, but Graph can send');
  account = await connect();
  assert.equal(account.smtp_disabled_at, null);
});

test('IMAP connections start with a token valid for 15+ minutes (Gmail ends OAuth sessions at expiry)', async () => {
  const imap = require('../src/imap');
  const env = envWithMicrosoft();
  try {
    const account = msAccount(env, { imap_host: '127.0.0.1', secret: { accessToken: 'short-lived', accessTokenExpiresAt: Date.now() + 10 * 60 * 1000 } });
    assert.equal(await getFreshAccessToken(env, account), 'short-lived', 'enough for one SMTP send');
    assert.equal(ms.tokenRequests.length, 0);
    const opts = await imap.buildImapOptions(env, account);
    assert.equal(opts.auth.accessToken, 'imap-at-1', 'a sync connection gets a fresh token');
    assert.equal(ms.tokenRequests.length, 1);
    assert.equal(ms.tokenRequests[0].scope, `${IMAP_SCOPE} ${SMTP_SCOPE} offline_access`, 'no Graph scope in the IMAP refresh');
  } finally {
    env.close();
  }
});
