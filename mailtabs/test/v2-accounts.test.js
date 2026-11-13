'use strict';

// ROUTES v2: sending settings of accounts. SMTP checks run against an in-process SMTP server;
// adding an account (which checks the IMAP login first) uses r1@test.local on the local Dovecot.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  startTestServer,
  makeClient,
  signupUser,
  seedAccount,
  imapAvailable,
  lockTestImapUser,
  startSmtpCapture,
  IMAP_TEST,
} = require('./helpers');

const R1 = IMAP_TEST.users.r1;
const SMTP_USER = 'sender@test.local';
const SMTP_PASS = 'smtp-pass-123';

async function setup(t) {
  const smtp = await startSmtpCapture({ users: { [SMTP_USER]: SMTP_PASS, [R1.user]: R1.pass } });
  t.after(() => smtp.close());
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  const aliceUser = await signupUser(alice, { email: 'alice@example.com', name: 'Alice' });
  await signupUser(mallory, { email: 'mallory@example.com' });
  return { srv, smtp, alice, mallory, aliceUser };
}

const row = (srv, id) => srv.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);

test('POST /api/accounts checks SMTP after IMAP; a sending problem is a warning, never a failure', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const release = await lockTestImapUser('r1');
  t.after(release);
  const { srv, smtp, alice } = await setup(t);
  const base = { provider: 'imap', email: R1.user, password: R1.pass, imapHost: IMAP_TEST.host, imapPort: IMAP_TEST.port, imapSecurity: 'none' };
  const add = async (body) => {
    const res = await alice.post('/api/accounts', { ...base, ...body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body;
  };
  const remove = (id) => alice.del(`/api/accounts/${id}`);

  // No outgoing server for an Other-IMAP account: saved, with a warning.
  const none = await add({});
  assert.deepEqual(none.warnings, ['Sending is not set up yet: add the outgoing (SMTP) server in the account settings.']);
  assert.equal(none.account.canSend, false);
  assert.equal(none.account.smtpHost, null);
  await remove(none.account.id);

  // A wrong SMTP password: still saved (reading mail works), with the friendly reason.
  const wrong = await add({ smtpHost: '127.0.0.1', smtpPort: smtp.port, smtpSecurity: 'none', smtpUser: SMTP_USER, smtpPassword: 'nope' });
  assert.equal(wrong.warnings.length, 1);
  assert.match(wrong.warnings[0], /^Sending is not set up yet: The outgoing mail server rejected the username or password/);
  assert.equal(wrong.account.smtpHost, '127.0.0.1', 'the settings are kept so they can be corrected');
  await remove(wrong.account.id);

  // The outgoing server is not reachable: also a warning.
  const unreachable = await add({ smtpHost: '127.0.0.1', smtpPort: 1, smtpSecurity: 'none' });
  assert.match(unreachable.warnings[0], /^Sending is not set up yet: Could not reach 127\.0\.0\.1:1/);
  await remove(unreachable.account.id);

  // Working settings: no warnings; the SMTP password is stored encrypted, apart from the IMAP one.
  const good = await add({ smtpHost: '127.0.0.1', smtpPort: smtp.port, smtpSecurity: 'none', smtpUser: SMTP_USER, smtpPassword: SMTP_PASS, senderName: 'Rita' });
  assert.deepEqual(good.warnings, []);
  assert.equal(good.account.canSend, true);
  assert.deepEqual(
    [good.account.smtpHost, good.account.smtpPort, good.account.smtpSecurity, good.account.smtpUser, good.account.hasSmtpPassword, good.account.senderName],
    ['127.0.0.1', smtp.port, 'none', SMTP_USER, true, 'Rita']
  );
  const stored = row(srv, good.account.id);
  assert.ok(stored.smtp_secret_enc && !stored.smtp_secret_enc.includes(SMTP_PASS));
  assert.deepEqual(srv.crypto.decryptJson(stored.smtp_secret_enc), { password: SMTP_PASS });
  assert.ok(!JSON.stringify(good).includes(SMTP_PASS), 'never in a response');
  await remove(good.account.id);

  // Without an SMTP password the mailbox password is used for the check (and for sending).
  const reuse = await add({ smtpHost: '127.0.0.1', smtpPort: smtp.port, smtpSecurity: 'none' });
  assert.deepEqual(reuse.warnings, []);
  assert.equal(row(srv, reuse.account.id).smtp_secret_enc, null);

  // Invalid SMTP fields are refused before anything is checked.
  for (const [body, code] of [
    [{ smtpHost: 'bad host!' }, 'HOST_NOT_ALLOWED'],
    [{ smtpHost: '127.0.0.1', smtpPort: 70000 }, 'INVALID_PORT'],
    [{ smtpHost: '127.0.0.1', smtpSecurity: 'ssl3' }, 'INVALID_SECURITY'],
    [{ senderName: 'Evil\r\nBcc: x@y.z' }, 'VALIDATION'],
  ]) {
    const res = await alice.post('/api/accounts', { ...base, email: 'other@test.local', imapUser: R1.user, ...body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.code, code, JSON.stringify(body));
  }
});

test('PATCH sending settings: re-checked, password needed for a new server, cleared, OAuth refused', async (t) => {
  const { srv, smtp, alice, mallory, aliceUser } = await setup(t);
  const other = await startSmtpCapture({ users: { [SMTP_USER]: SMTP_PASS } });
  t.after(() => other.close());
  const account = seedAccount(srv.db, srv.crypto, aliceUser.id, {
    email: 'me@test.local',
    smtp_host: '127.0.0.1',
    smtp_port: smtp.port,
    smtp_security: 'none',
    smtp_user: SMTP_USER,
    smtp_secret_enc: srv.crypto.encryptJson({ password: SMTP_PASS }),
  });
  const patch = (body, client = alice) => client.patch(`/api/accounts/${account.id}`, body);

  const before = (await alice.get('/api/accounts')).body.accounts[0];
  assert.equal(before.canSend, true);
  assert.equal(before.sendBlockedReason, null);

  // A new server (port) with the saved password: refused, the password must be typed again.
  const noPassword = await patch({ smtpPort: other.port });
  assert.equal(noPassword.status, 400);
  assert.equal(noPassword.body.code, 'PASSWORD_REQUIRED');
  const wrong = await patch({ smtpPort: other.port, smtpPassword: 'wrong' });
  assert.equal(wrong.body.code, 'SMTP_AUTH_FAILED');
  assert.equal(row(srv, account.id).smtp_port, smtp.port, 'nothing saved');
  const loginsBefore = other.messages.length;
  const moved = await patch({ smtpPort: other.port, smtpPassword: SMTP_PASS });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.account.smtpPort, other.port);
  assert.equal(other.messages.length, loginsBefore, 'checked with a login only, nothing sent');

  // Same server, other username: re-checked with the saved password (allowed).
  const badUser = await patch({ smtpUser: 'nobody@test.local' });
  assert.equal(badUser.body.code, 'SMTP_AUTH_FAILED');
  assert.equal((await patch({ smtpUser: SMTP_USER })).status, 200, 'unchanged values are fine');

  // Unreachable server: a clear error, nothing saved.
  const down = await patch({ smtpHost: '127.0.0.1', smtpPort: 1, smtpPassword: SMTP_PASS });
  assert.equal(down.body.code, 'SMTP_CONNECT_FAILED');

  // Sender name and signature (sanitised, size-limited).
  const sig = await patch({ senderName: '  Alice Example ', signatureHtml: '<p>Cheers, <b>Alice</b><script>steal()</script><img src="x" onerror="steal()"></p>' });
  assert.equal(sig.status, 200);
  assert.equal(sig.body.account.senderName, 'Alice Example');
  assert.ok(sig.body.account.signatureHtml.includes('<b>Alice</b>'));
  assert.ok(!/script|onerror/i.test(sig.body.account.signatureHtml));
  assert.equal((await patch({ signatureHtml: `<p>${'x'.repeat(21 * 1024)}</p>` })).body.code, 'SIGNATURE_TOO_LARGE');
  assert.equal((await patch({ senderName: 'a\nb' })).status, 400);
  assert.equal((await patch({ signatureHtml: 42 })).status, 400);
  assert.equal((await patch({ signatureHtml: '<p><br></p>' })).body.account.signatureHtml, '', 'an empty signature is none');
  assert.equal((await patch({ senderName: '', signatureHtml: null })).body.account.senderName, null);

  // Clearing the outgoing server (back to "not set up" for an Other-IMAP account).
  const cleared = await patch({ smtpHost: '' });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.account.smtpHost, null);
  assert.equal(cleared.body.account.canSend, false);
  assert.equal(row(srv, account.id).smtp_secret_enc, null, 'its password goes too');
  // Setting it up again needs a password, because the mailbox password would go to a new server.
  assert.equal((await patch({ smtpHost: '127.0.0.1', smtpPort: smtp.port, smtpSecurity: 'none' })).body.code, 'PASSWORD_REQUIRED');
  assert.equal((await patch({ smtpPort: smtp.port })).body.code, 'HOST_REQUIRED');

  // Someone else's account: 404, nothing checked.
  assert.equal((await patch({ smtpHost: 'evil.example', smtpPassword: 'x' }, mallory)).status, 404);
  assert.equal((await patch({ senderName: 'pwned' }, mallory)).status, 404);

  // OAuth accounts: no SMTP settings of their own, but a sender name and signature are fine.
  const oauth = seedAccount(srv.db, srv.crypto, aliceUser.id, {
    provider: 'gmail',
    auth_type: 'oauth',
    email: 'me@gmail.com',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_security: 'tls',
    imap_user: 'me@gmail.com',
    secret: { refreshToken: 'r', accessToken: 'a', accessTokenExpiresAt: 0 },
  });
  const oauthPatch = (body) => alice.patch(`/api/accounts/${oauth.id}`, body);
  assert.equal((await oauthPatch({ smtpHost: 'smtp.evil.example', smtpPassword: 'x' })).body.code, 'OAUTH_ACCOUNT');
  assert.equal((await oauthPatch({ smtpHost: '' })).body.code, 'OAUTH_ACCOUNT');
  const named = await oauthPatch({ senderName: 'Me', smtpHost: 'smtp.gmail.com' });
  assert.equal(named.status, 200, 'sending the shown values back is fine');
  assert.equal(named.body.account.smtpHost, 'smtp.gmail.com');
  assert.equal(named.body.account.canSend, true);
});

test('account JSON canSend: provider defaults only for the provider\'s own servers; Microsoft needs SMTP.Send', async (t) => {
  const { srv, alice, aliceUser } = await setup(t);
  const seed = (overrides) => seedAccount(srv.db, srv.crypto, aliceUser.id, overrides);
  const yahoo = seed({ provider: 'yahoo', email: 'me@yahoo.com', imap_host: 'imap.mail.yahoo.com', imap_user: 'me@yahoo.com' });
  // A "Yahoo" account pointed at another IMAP server must not send its password to Yahoo's SMTP.
  const elsewhere = seed({ provider: 'yahoo', email: 'me2@yahoo.com', imap_host: 'mail.example.org', imap_user: 'me2@yahoo.com' });
  const icloud = seed({ provider: 'icloud', email: 'me@icloud.com', imap_host: 'imap.mail.me.com', imap_user: 'me' });
  const ms = (email, secret) =>
    seed({ provider: 'outlook', auth_type: 'oauth', email, imap_host: 'outlook.office365.com', imap_port: 993, imap_security: 'tls', imap_user: email, secret });
  const msLegacy = ms('old@outlook.com', { refreshToken: 'r', accessToken: 'a', accessTokenExpiresAt: 0 });
  const msGranted = ms('new@outlook.com', {
    refreshToken: 'r',
    accessToken: 'a',
    accessTokenExpiresAt: 0,
    grantedScopes: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access',
  });
  const work = ms('me@contoso.com', { refreshToken: 'r', accessToken: 'a', accessTokenExpiresAt: 0, grantedScopes: 'IMAP.AccessAsUser.All SMTP.Send' });

  const byId = new Map((await alice.get('/api/accounts')).body.accounts.map((a) => [a.id, a]));
  const pick = (id) => {
    const a = byId.get(id);
    return [a.smtpHost, a.smtpPort, a.smtpSecurity, a.smtpUser, a.canSend];
  };
  assert.deepEqual(pick(yahoo.id), ['smtp.mail.yahoo.com', 465, 'tls', 'me@yahoo.com', true]);
  assert.deepEqual(pick(elsewhere.id), [null, null, null, null, false]);
  assert.deepEqual(pick(icloud.id), ['smtp.mail.me.com', 587, 'starttls', 'me@icloud.com', true], 'iCloud sends with the full address');
  assert.deepEqual(pick(msLegacy.id), ['smtp-mail.outlook.com', 587, 'starttls', 'old@outlook.com', false]);
  assert.match(byId.get(msLegacy.id).sendBlockedReason, /^Reconnect this account to allow sending/);
  assert.deepEqual(pick(msGranted.id), ['smtp-mail.outlook.com', 587, 'starttls', 'new@outlook.com', true]);
  assert.deepEqual(pick(work.id), ['smtp.office365.com', 587, 'starttls', 'me@contoso.com', true]);
  const text = JSON.stringify([...byId.values()]);
  assert.ok(!/refreshToken|accessToken|"r"|secret_enc/.test(text), 'no secrets');
});
