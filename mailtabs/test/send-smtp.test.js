'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('dns');

const smtp = require('../src/smtp');
const { HttpError } = require('../src/errors');
const { OAuthError } = require('../src/oauth');
const { makeEngineEnv, createUser, createAccount, startSmtpServer, closedPort } = require('./send-helpers');

let server;
test.before(async () => {
  server = await startSmtpServer({
    passwords: { 'me@example.com': 'right-pass', 'smtp-login': 'smtp-only-pass' },
    tokens: { 'me@gmail.com': 'good-token', 'me@outlook.com': 'ms-token' },
  });
});
test.after(async () => {
  await server.close();
});
test.beforeEach(() => {
  server.messages.length = 0;
  server.auths.length = 0;
  server.opts.authError = null;
  server.opts.rejectRecipients = [];
});

function env(extra) {
  return makeEngineEnv(extra);
}

function passwordAccount(e, overrides = {}) {
  const userId = createUser(e.db);
  return createAccount(e.db, e.crypto, userId, {
    email: 'me@example.com',
    imap_user: 'me@example.com',
    password: 'right-pass',
    smtp_host: '127.0.0.1',
    smtp_port: server.port,
    smtp_security: 'none',
    ...overrides,
  });
}

function oauthAccount(e, { provider = 'gmail', email = 'me@gmail.com', token = 'good-token', grantedScopes, ...overrides } = {}) {
  const userId = createUser(e.db);
  return createAccount(e.db, e.crypto, userId, {
    provider,
    auth_type: 'oauth',
    email,
    imap_user: email,
    secret: { refreshToken: 'rt', accessToken: token, accessTokenExpiresAt: Date.now() + 3600 * 1000, ...(grantedScopes ? { grantedScopes } : {}) },
    smtp_host: '127.0.0.1',
    smtp_port: server.port,
    smtp_security: 'none',
    ...overrides,
  });
}

const RAW = Buffer.from('From: me@example.com\r\nTo: bob@example.org\r\nSubject: hi\r\nMessage-ID: <t1@example.com>\r\n\r\nHello\r\n');

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

test('smtpSettingsFor: own settings, else the preset (by IMAP host / domain), usernames per provider', () => {
  assert.deepEqual(
    smtp.smtpSettingsFor({ provider: 'imap', email: 'me@x.org', imap_user: 'me', smtp_host: 'mail.x.org', smtp_port: 587, smtp_security: 'starttls', smtp_user: 'sender' }),
    { host: 'mail.x.org', port: 587, security: 'starttls', user: 'sender' }
  );
  assert.deepEqual(smtp.smtpSettingsFor({ provider: 'yahoo', email: 'me@yahoo.com', imap_user: 'me@yahoo.com' }), {
    host: 'smtp.mail.yahoo.com',
    port: 465,
    security: 'tls',
    user: 'me@yahoo.com',
  });
  // iCloud accepts the bare name for IMAP but wants the full address for SMTP.
  assert.equal(smtp.smtpSettingsFor({ provider: 'icloud', email: 'me@icloud.com', imap_user: 'me' }).user, 'me@icloud.com');
  // Plain IMAP servers keep their own username form.
  assert.equal(smtp.smtpSettingsFor({ provider: 'imap', email: 'me@x.org', imap_user: 'jdoe', smtp_host: 'mail.x.org' }).user, 'jdoe');
  // OAuth: XOAUTH2 user= is the mailbox address; personal Microsoft accounts use smtp-mail.outlook.com.
  assert.deepEqual(smtp.smtpSettingsFor({ provider: 'outlook', auth_type: 'oauth', email: 'me@hotmail.com', imap_user: 'me@hotmail.com' }), {
    host: 'smtp-mail.outlook.com',
    port: 587,
    security: 'starttls',
    user: 'me@hotmail.com',
  });
  assert.equal(smtp.smtpSettingsFor({ provider: 'outlook', auth_type: 'oauth', email: 'me@contoso.com' }).host, 'smtp.office365.com');
  assert.equal(smtp.smtpSettingsFor({ provider: 'zoho', email: 'me@corp.com', imap_host: 'imappro.zoho.com', imap_user: 'me@corp.com' }).host, 'smtppro.zoho.com');
  assert.equal(smtp.smtpSettingsFor({ provider: 'imap', email: 'me@x.org', imap_user: 'me' }).host, '', 'Other IMAP has no default');
});

test('sendingStatus: needs an SMTP host, and Microsoft needs the SMTP.Send grant', () => {
  const e = env({ GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's', MICROSOFT_CLIENT_ID: 'm', MICROSOFT_CLIENT_SECRET: 's' });
  try {
    assert.deepEqual(smtp.sendingStatus(e, { provider: 'imap', email: 'a@x.org', auth_type: 'password' }).code, 'SMTP_NOT_CONFIGURED');
    assert.equal(smtp.sendingStatus(e, passwordAccount(e)).canSend, true);
    // Google: the mail scope always includes SMTP, recorded or not.
    assert.equal(smtp.sendingStatus(e, oauthAccount(e)).canSend, true);
    assert.equal(smtp.sendingStatus(e, oauthAccount(e, { grantedScopes: 'openid email' })).canSend, false);
    // Microsoft accounts from before sending existed have no recorded scopes: reconnect.
    const legacy = smtp.sendingStatus(e, oauthAccount(e, { provider: 'outlook', email: 'me@outlook.com', token: 'ms-token' }));
    assert.deepEqual([legacy.canSend, legacy.code], [false, 'SMTP_SCOPE_MISSING']);
    assert.match(legacy.message, /Reconnect this account to allow sending/);
    const imapOnly = oauthAccount(e, { provider: 'outlook', email: 'me@outlook.com', token: 'ms-token', grantedScopes: 'https://outlook.office.com/IMAP.AccessAsUser.All' });
    assert.equal(smtp.sendingStatus(e, imapOnly).canSend, false);
    const granted = oauthAccount(e, {
      provider: 'outlook',
      email: 'me@outlook.com',
      token: 'ms-token',
      grantedScopes: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
    });
    assert.equal(smtp.sendingStatus(e, granted).canSend, true);
  } finally {
    e.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Transport options: security policy, SSRF guard, pinning
// ---------------------------------------------------------------------------------------------

test('connectionOptions: TLS modes, timeouts, no file/URL access', async () => {
  const e = env();
  try {
    const auth = { user: 'u', pass: 'p' };
    const tls = await smtp.connectionOptions(e.config, { host: '127.0.0.1', port: 465, security: 'tls', auth });
    assert.deepEqual([tls.secure, tls.requireTLS, tls.ignoreTLS], [true, false, false]);
    const starttls = await smtp.connectionOptions(e.config, { host: '127.0.0.1', port: 587, security: 'starttls', auth });
    assert.deepEqual([starttls.secure, starttls.requireTLS, starttls.ignoreTLS], [false, true, false]);
    const none = await smtp.connectionOptions(e.config, { host: '127.0.0.1', port: 25, security: 'none', auth });
    assert.deepEqual([none.secure, none.requireTLS, none.ignoreTLS], [false, false, true]);
    assert.deepEqual([tls.connectionTimeout, tls.greetingTimeout, tls.socketTimeout], [20000, 15000, 60000]);
    assert.equal(tls.disableFileAccess, true);
    assert.equal(tls.disableUrlAccess, true);
    assert.equal(tls.tls.minVersion, 'TLSv1.2');
    assert.equal(tls.name, '[127.0.0.1]', 'EHLO does not leak the server host name for a localhost APP_URL');
    await assert.rejects(smtp.connectionOptions(e.config, { host: '127.0.0.1', port: 0, security: 'tls', auth }), (err) => err.code === 'INVALID_PORT');
    await assert.rejects(smtp.connectionOptions(e.config, { host: '127.0.0.1', port: 25, security: 'ssl3', auth }), (err) => err.code === 'INVALID_SECURITY');
    await assert.rejects(smtp.connectionOptions(e.config, { host: 'http://x/', port: 25, security: 'tls', auth }), (err) => err.code === 'HOST_NOT_ALLOWED');
  } finally {
    e.close();
  }
});

test('SSRF guard: private hosts and plaintext are refused unless ALLOW_PRIVATE_IMAP_HOSTS', async () => {
  const e = env({ ALLOW_PRIVATE_IMAP_HOSTS: 'false' });
  try {
    const auth = { user: 'u', pass: 'p' };
    for (const host of ['127.0.0.1', 'localhost', '169.254.169.254', '10.0.0.5', '[::1]', '::ffff:127.0.0.1']) {
      await assert.rejects(smtp.connectionOptions(e.config, { host, port: 465, security: 'tls', auth }), (err) => err.code === 'HOST_NOT_ALLOWED', host);
    }
    await assert.rejects(smtp.connectionOptions(e.config, { host: '8.8.8.8', port: 25, security: 'none', auth }), (err) => err.code === 'INSECURE_NOT_ALLOWED');
    // An account pointed at a private SMTP host cannot send either.
    const account = passwordAccount(e);
    await assert.rejects(smtp.sendRaw(e, account, { from: 'me@example.com', recipients: ['bob@example.org'], raw: RAW }), (err) => err.code === 'INSECURE_NOT_ALLOWED');
    await assert.rejects(
      smtp.sendRaw(e, { ...account, smtp_security: 'tls' }, { from: 'me@example.com', recipients: ['bob@example.org'], raw: RAW }),
      (err) => err.code === 'HOST_NOT_ALLOWED' && err.status === 400
    );
    assert.equal(server.messages.length, 0);
  } finally {
    e.close();
  }
});

test('IP pinning: connect to the checked address, verify TLS against the real name', async (t) => {
  const e = env({ ALLOW_PRIVATE_IMAP_HOSTS: 'false', APP_URL: 'https://mail.example.net' });
  const original = dns.lookup;
  t.after(() => {
    dns.lookup = original;
  });
  let answer = [{ address: '2606:4700::1111', family: 6 }, { address: '93.184.216.34', family: 4 }];
  dns.lookup = (host, opts, cb) => cb(null, answer);
  try {
    const opts = await smtp.connectionOptions(e.config, { host: 'SMTP.Example.com.', port: 465, security: 'tls', auth: { user: 'u', pass: 'p' } });
    assert.equal(opts.host, '93.184.216.34', 'IPv4 preferred');
    assert.equal(opts.servername, 'smtp.example.com');
    assert.equal(opts.tls.servername, 'smtp.example.com');
    assert.equal(opts.displayHost, 'smtp.example.com');
    assert.equal(opts.name, 'mail.example.net', 'EHLO uses the public app host name');
    // DNS rebinding: any private answer refuses the host.
    answer = [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }];
    await assert.rejects(smtp.connectionOptions(e.config, { host: 'smtp.example.com', port: 465, security: 'tls', auth: { user: 'u', pass: 'p' } }), (err) => err.code === 'HOST_NOT_ALLOWED');
    // IP literals: no SNI.
    const ip = await smtp.connectionOptions(e.config, { host: '93.184.216.34', port: 465, security: 'tls', auth: { user: 'u', pass: 'p' } });
    assert.equal(ip.servername, undefined);
    assert.equal(ip.tls.servername, undefined);
  } finally {
    e.close();
  }
});

test('buildTransportOptions: SMTP password when saved, else the IMAP one; OAuth -> XOAUTH2', async () => {
  const e = env({ GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's', MICROSOFT_CLIENT_ID: 'm', MICROSOFT_CLIENT_SECRET: 's' });
  try {
    const shared = await smtp.buildTransportOptions(e, passwordAccount(e));
    assert.deepEqual(shared.auth, { user: 'me@example.com', pass: 'right-pass' });
    const own = await smtp.buildTransportOptions(e, passwordAccount(e, { smtp_user: 'smtp-login', smtp_secret_enc: e.crypto.encryptJson({ password: 'smtp-only-pass' }) }));
    assert.deepEqual(own.auth, { user: 'smtp-login', pass: 'smtp-only-pass' });
    const oauth = await smtp.buildTransportOptions(e, oauthAccount(e));
    assert.deepEqual(oauth.auth, { type: 'OAuth2', user: 'me@gmail.com', accessToken: 'good-token' });
    await assert.rejects(smtp.buildTransportOptions(e, oauthAccount(e, { provider: 'outlook', email: 'me@outlook.com' })), (err) => err.code === 'SMTP_SCOPE_MISSING');
    await assert.rejects(smtp.buildTransportOptions(e, passwordAccount(e, { smtp_host: null, provider: 'imap' })), (err) => err.code === 'SMTP_NOT_CONFIGURED');
    await assert.rejects(smtp.buildTransportOptions(e, passwordAccount(e, { smtp_secret_enc: 'v1.garbage.x.y' })), (err) => err.code === 'SMTP_AUTH_FAILED' && /enter it again/.test(err.message));
  } finally {
    e.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Sending against a real (in-process) SMTP server
// ---------------------------------------------------------------------------------------------

test('sendRaw delivers the exact bytes with the given envelope (PLAIN/LOGIN)', async () => {
  const e = env();
  try {
    const res = await smtp.sendRaw(e, passwordAccount(e), { from: 'me@example.com', recipients: ['bob@example.org', 'hidden@example.org', 'bob@example.org'], raw: RAW });
    assert.deepEqual(res.accepted, ['bob@example.org', 'hidden@example.org']);
    assert.deepEqual(res.rejected, []);
    assert.match(res.response, /Queued as test/);
    assert.equal(server.messages.length, 1);
    const msg = server.messages[0];
    assert.equal(msg.from, 'me@example.com');
    assert.deepEqual(msg.to, ['bob@example.org', 'hidden@example.org']);
    assert.equal(msg.raw.toString().replace(/\r\n$/, ''), RAW.toString().replace(/\r\n$/, ''));
    assert.equal(server.auths[0].username, 'me@example.com');
    assert.ok(['PLAIN', 'LOGIN'].includes(server.auths[0].method));
  } finally {
    e.close();
  }
});

test('sendRaw with OAuth uses XOAUTH2 with the account token', async () => {
  const e = env({ GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's', MICROSOFT_CLIENT_ID: 'm', MICROSOFT_CLIENT_SECRET: 's' });
  try {
    await smtp.sendRaw(e, oauthAccount(e), { from: 'me@gmail.com', recipients: ['bob@example.org'], raw: RAW });
    assert.deepEqual(server.auths.map((a) => [a.method, a.username, a.accessToken]), [['XOAUTH2', 'me@gmail.com', 'good-token']]);
    assert.equal(server.messages.length, 1);

    const ms = oauthAccount(e, {
      provider: 'outlook',
      email: 'me@outlook.com',
      token: 'ms-token',
      grantedScopes: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
    });
    await smtp.sendRaw(e, ms, { from: 'me@outlook.com', recipients: ['bob@example.org'], raw: RAW });
    assert.equal(server.messages.length, 2);

    // A token the server refuses: reconnect advice, no retry.
    const bad = oauthAccount(e, { token: 'stale-token' });
    await assert.rejects(smtp.sendRaw(e, bad, { from: 'me@gmail.com', recipients: ['bob@example.org'], raw: RAW }), (err) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.code, 'SMTP_AUTH_FAILED');
      assert.equal(err.retryable, false);
      assert.match(err.message, /Reconnect this account to allow sending/);
      return true;
    });
  } finally {
    e.close();
  }
});

test('sendRaw failures map to friendly, classified errors', async () => {
  const e = env();
  try {
    const account = passwordAccount(e);
    const send = (acc, recipients = ['bob@example.org']) => smtp.sendRaw(e, acc, { from: 'me@example.com', recipients, raw: RAW });

    await assert.rejects(send(passwordAccount(e, { password: 'wrong' })), (err) => {
      assert.deepEqual([err.status, err.code, err.retryable], [502, 'SMTP_AUTH_FAILED', false]);
      assert.match(err.message, /rejected the username or password/);
      return true;
    });

    server.opts.rejectRecipients = ['nobody@example.org'];
    await assert.rejects(send(account, ['nobody@example.org']), (err) => {
      assert.deepEqual([err.code, err.retryable], ['SMTP_FAILED', false]);
      assert.match(err.message, /refused the recipient address: nobody@example.org/);
      return true;
    });
    // Some recipients refused: still sent, the refused ones reported.
    const partial = await send(account, ['bob@example.org', 'nobody@example.org']);
    assert.deepEqual([partial.accepted, partial.rejected], [['bob@example.org'], ['nobody@example.org']]);

    const port = await closedPort();
    await assert.rejects(send({ ...account, smtp_port: port }), (err) => {
      assert.deepEqual([err.code, err.retryable], ['SMTP_CONNECT_FAILED', true]);
      assert.match(err.message, new RegExp(`Could not reach 127.0.0.1:${port}`));
      return true;
    });
    await assert.rejects(send(account, []), (err) => err.code === 'INVALID_COMPOSE');
  } finally {
    e.close();
  }
});

test('a message over the server SIZE limit is reported as too large', async () => {
  const small = await startSmtpServer({ passwords: { 'me@example.com': 'right-pass' }, size: 100 });
  const e = env();
  try {
    const account = passwordAccount(e, { smtp_port: small.port });
    await assert.rejects(smtp.sendRaw(e, account, { from: 'me@example.com', recipients: ['bob@example.org'], raw: Buffer.concat([RAW, Buffer.alloc(500, 'a')]) }), (err) => {
      assert.equal(err.retryable, false);
      assert.match(err.message, /too large/);
      return true;
    });
  } finally {
    e.close();
    await small.close();
  }
});

test('verifySmtp checks the login without sending', async () => {
  const e = env();
  try {
    assert.deepEqual(await smtp.verifySmtp(e, { host: '127.0.0.1', port: server.port, security: 'none', user: 'me@example.com', password: 'right-pass' }), { ok: true });
    await assert.rejects(smtp.verifySmtp(e, { host: '127.0.0.1', port: server.port, security: 'none', user: 'me@example.com', password: 'nope' }), (err) => err.status === 400 && err.code === 'SMTP_AUTH_FAILED');
    await assert.rejects(
      smtp.verifySmtp(e, { host: '127.0.0.1', port: await closedPort(), security: 'none', user: 'me@example.com', password: 'x' }),
      (err) => err.status === 400 && err.code === 'SMTP_CONNECT_FAILED'
    );
    // STARTTLS required but the server offers none.
    await assert.rejects(smtp.verifySmtp(e, { host: '127.0.0.1', port: server.port, security: 'starttls', user: 'me@example.com', password: 'right-pass' }), (err) => {
      assert.equal(err.code, 'SMTP_CONNECT_FAILED');
      assert.match(err.message, /STARTTLS|secure connection/);
      return true;
    });
    // Implicit TLS against a plaintext port.
    await assert.rejects(smtp.verifySmtp(e, { host: '127.0.0.1', port: server.port, security: 'tls', user: 'me@example.com', password: 'right-pass' }), (err) => err.code === 'SMTP_CONNECT_FAILED');
    assert.deepEqual(
      await smtp.verifySmtp(e, { host: '127.0.0.1', port: server.port, security: 'none', user: 'me@gmail.com', accessToken: 'good-token' }),
      { ok: true }
    );
    assert.equal(server.messages.length, 0);
  } finally {
    e.close();
  }
});

// ---------------------------------------------------------------------------------------------
// friendlySmtpError
// ---------------------------------------------------------------------------------------------

function smtpErr(code, response, extra = {}) {
  const err = new Error(`Invalid login: ${response}`);
  err.code = code;
  err.response = response;
  err.responseCode = Number(String(response).slice(0, 3)) || undefined;
  return Object.assign(err, extra);
}

test('friendlySmtpError explains provider-specific refusals', () => {
  const f = smtp.friendlySmtpError;
  const tenant = smtpErr('EAUTH', '535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant. Visit https://aka.ms/smtp_auth_disabled for more information.');
  assert.match(f(tenant, { oauth: true, email: 'me@contoso.com' }), /administrator has turned off sending from mail apps \(SMTP AUTH\) for your organisation/);
  const mailbox = smtpErr('EAUTH', '535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Mailbox. Visit https://aka.ms/smtp_auth_disabled');
  assert.match(f(mailbox, { oauth: true, email: 'me@outlook.com' }), /Outlook\.com account, and offers no setting/);
  assert.match(f(mailbox, { oauth: true, email: 'me@contoso.com' }), /Ask your administrator to enable it: Microsoft 365 admin center/);
  assert.equal(smtp.isRetryableSmtpError(mailbox), false);
  assert.match(f(smtpErr('EAUTH', '550 5.7.30 Basic authentication is not supported for Client Submission.')), /Sign in with Microsoft/);
  assert.match(f(smtpErr('EAUTH', '535 5.7.3 Authentication unsuccessful'), { oauth: true }), /Reconnect this account to allow sending/);
  assert.match(
    f(smtpErr('EAUTH', '535-5.7.8 Username and Password not accepted. For more information, go to https://support.google.com/mail/?p=BadCredentials'), { host: 'smtp.gmail.com' }),
    /rejected the username or password\. Gmail needs a Google App Password/
  );
  assert.match(f(smtpErr('EAUTH', '534-5.7.9 Application-specific password required.')), /app password/);
  assert.match(f(smtpErr('EMESSAGE', '550 5.4.5 Daily user sending limit exceeded.')), /sending limit/);
  assert.equal(smtp.isRetryableSmtpError(smtpErr('EMESSAGE', '550 5.4.5 Daily user sending limit exceeded.', { permanent: true })), false);
  assert.match(f(smtpErr('EENVELOPE', '554 5.2.252 SendAsDenied; 5.7.60 SMTP; Client does not have permissions to send as this sender', { command: 'DATA' })), /won't let this account send as/);
  assert.match(f(smtpErr('EENVELOPE', '550 5.1.8 Access denied, bad outbound sender', { command: 'MAIL FROM' })), /blocked sending from this account/);
  assert.match(f(smtpErr('EMESSAGE', '552 5.3.4 Message size exceeds fixed limit')), /too large/);
  const grey = smtpErr('EENVELOPE', '451 4.7.1 Greylisted, please try again later', { command: 'RCPT TO' });
  assert.equal(smtp.isRetryableSmtpError(grey), true, 'greylisting is retried');
  const full = smtpErr('EENVELOPE', '552 5.2.2 Mailbox full', { command: 'RCPT TO', rejected: ['full@example.org'] });
  assert.match(f(full), /refused the recipient address: full@example.org/);
  assert.equal(smtp.isRetryableSmtpError(full), false);
  const temp = smtpErr('EMESSAGE', '451 4.3.0 Temporary server error');
  assert.match(f(temp), /temporarily unable/);
  assert.equal(smtp.isRetryableSmtpError(temp), true);

  const dnsErr = Object.assign(new Error('getaddrinfo ENOTFOUND smtp.nope.example'), { code: 'EDNS', originalCode: 'ENOTFOUND' });
  assert.match(f(dnsErr, { host: 'smtp.nope.example' }), /Could not find the outgoing mail server smtp.nope.example/);
  assert.equal(smtp.isRetryableSmtpError(dnsErr), false);
  const cert = Object.assign(new Error('certificate has expired'), { code: 'ESOCKET', originalCode: 'CERT_HAS_EXPIRED' });
  assert.match(f(cert, { host: 'smtp.x.org' }), /certificate of smtp.x.org has expired/);
  assert.equal(smtp.isRetryableSmtpError(cert), false);
  const version = Object.assign(new Error('140:error:SSL routines:ssl3_get_record:wrong version number'), { code: 'ESOCKET' });
  assert.match(f(version, { host: 'smtp.x.org', port: 587 }), /may expect STARTTLS/);
  const timeout = Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' });
  assert.match(f(timeout, { host: 'smtp.x.org', port: 465 }), /Timed out talking to smtp.x.org:465/);
  assert.equal(smtp.isRetryableSmtpError(timeout), true);

  assert.equal(f(new HttpError(400, 'Policy says no', 'HOST_NOT_ALLOWED')), 'Policy says no');
  assert.equal(f(new OAuthError('Access was revoked', 'invalid_grant')), 'Access was revoked');
  assert.equal(smtp.isRetryableSmtpError(new OAuthError('Could not reach Google', 'oauth_error')), true);
  assert.equal(smtp.isRetryableSmtpError(new OAuthError('revoked', 'invalid_grant')), false);
  assert.match(f(null), /Unknown error/);
});
