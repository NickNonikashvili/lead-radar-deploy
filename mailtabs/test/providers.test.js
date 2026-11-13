'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PRESETS,
  publicPresets,
  guessPresetForEmail,
  presetHostForEmail,
  presetKeyForHost,
  isMicrosoftImapHost,
  alternateUsername,
  authFailureHintForHost,
  oauthProviders,
  oauthProviderForPreset,
} = require('../src/providers');
const { loadConfig } = require('../src/config');

function config(env = {}) {
  return loadConfig({ SECRET_KEY: 'x'.repeat(40), DATA_DIR: require('os').tmpdir(), ...env });
}

test('every preset has the public shape and sane IMAP defaults', () => {
  const list = publicPresets();
  assert.deepEqual(
    list.map((p) => p.key),
    ['gmail', 'outlook', 'yahoo', 'icloud', 'aol', 'fastmail', 'zoho', 'gmx', 'yandex', 'imap']
  );
  for (const p of list) {
    assert.equal(typeof p.label, 'string');
    assert.equal(typeof p.imapHost, 'string');
    assert.ok(Number.isInteger(p.imapPort));
    assert.ok(['tls', 'starttls', 'none'].includes(p.imapSecurity));
    assert.ok(Array.isArray(p.domains));
    assert.ok(Array.isArray(p.auth) && p.auth.length > 0);
    assert.ok(p.oauthProvider === null || ['google', 'microsoft'].includes(p.oauthProvider));
    assert.equal(typeof p.passwordHelp, 'string');
    assert.ok(p.passwordHelpUrl === null || /^https:\/\//.test(p.passwordHelpUrl));
    if (p.key !== 'imap') {
      assert.ok(p.imapHost.length > 0, `${p.key} needs a host`);
      assert.equal(p.imapPort, 993);
      assert.equal(p.imapSecurity, 'tls');
    }
  }
  // The array is a copy: mutating it must not change the presets.
  list[0].domains.push('evil.example');
  assert.ok(!PRESETS.gmail.domains.includes('evil.example'));
});

test('key presets match the spec', () => {
  assert.equal(PRESETS.gmail.imapHost, 'imap.gmail.com');
  assert.deepEqual([...PRESETS.gmail.auth], ['oauth', 'password']);
  assert.equal(PRESETS.gmail.oauthProvider, 'google');
  assert.equal(PRESETS.gmail.passwordHelpUrl, 'https://myaccount.google.com/apppasswords');
  assert.equal(PRESETS.outlook.imapHost, 'outlook.office365.com');
  assert.deepEqual([...PRESETS.outlook.auth], ['oauth']);
  assert.equal(PRESETS.outlook.oauthProvider, 'microsoft');
  assert.equal(PRESETS.icloud.imapHost, 'imap.mail.me.com');
  assert.equal(PRESETS.yahoo.imapHost, 'imap.mail.yahoo.com');
  assert.equal(PRESETS.imap.imapHost, '');
  assert.equal(PRESETS.imap.label, 'Other (IMAP)');
});

test('help texts and links follow the providers\' current documentation', () => {
  assert.match(PRESETS.gmail.passwordHelp, /2-Step Verification/);
  assert.match(PRESETS.gmail.passwordHelp, /Advanced Protection/);
  assert.match(PRESETS.gmail.passwordHelp, /security-key-only/);
  assert.match(PRESETS.gmail.passwordHelp, /work and school/);

  // No password escape hatch for Microsoft accounts any more.
  assert.doesNotMatch(PRESETS.outlook.passwordHelp, /work accounts still allow/i);
  assert.match(PRESETS.outlook.passwordHelp, /Sign in with Microsoft/);
  assert.match(PRESETS.outlook.passwordHelp, /Forwarding and IMAP/);
  assert.equal(PRESETS.outlook.passwordHelpUrl, null);

  assert.equal(PRESETS.icloud.passwordHelpUrl, 'https://account.apple.com');
  assert.match(PRESETS.icloud.passwordHelp, /App-Specific Passwords/);
  assert.equal(PRESETS.icloud.usernameFallback, 'localPart');

  assert.equal(PRESETS.yandex.passwordHelpUrl, 'https://id.yandex.com/security');
  assert.match(PRESETS.yandex.passwordHelp, /IMAP/);
  assert.match(PRESETS.yandex.passwordHelp, /App passwords and OAuth tokens/);
  assert.match(PRESETS.yandex.passwordHelp, /2–3 hours/);
  assert.equal(PRESETS.yandex.usernameFallback, 'localPart');

  assert.ok(PRESETS.zoho.domains.includes('zohomail.com') && PRESETS.zoho.domains.includes('zoho.com'));
  assert.match(PRESETS.zoho.passwordHelp, /imappro\.zoho\.com/);
  assert.match(PRESETS.zoho.passwordHelp, /Server Configuration Details/);

  assert.equal(PRESETS.aol.passwordHelpUrl, 'https://login.aol.com/myaccount/security');
  assert.ok(PRESETS.aol.domains.includes('aol.com'));
  assert.equal(PRESETS.fastmail.passwordHelpUrl, 'https://app.fastmail.com/settings/security');
  assert.match(PRESETS.fastmail.passwordHelp, /Basic plan has no IMAP/);
  assert.match(PRESETS.gmx.passwordHelp, /POP3 & IMAP/);
  assert.equal(presetHostForEmail('gmx', 'a@gmx.com'), 'imap.gmx.com');

  // The browser gets the help texts but not the server-only fields.
  const icloud = publicPresets().find((p) => p.key === 'icloud');
  assert.equal(icloud.passwordHelpUrl, 'https://account.apple.com');
  assert.equal(icloud.authFailureHint, undefined);
});

test('presetKeyForHost / isMicrosoftImapHost recognise providers by IMAP server name', () => {
  assert.equal(presetKeyForHost('imap.gmail.com'), 'gmail');
  assert.equal(presetKeyForHost('IMAP.GMX.NET.'), 'gmx');
  assert.equal(presetKeyForHost('imappro.zoho.com'), 'zoho');
  assert.equal(presetKeyForHost('imap.zoho.eu'), 'zoho');
  assert.equal(presetKeyForHost('imap.ya.ru'), 'yandex');
  assert.equal(presetKeyForHost('imap.example.com'), null);
  assert.equal(presetKeyForHost(''), null);
  assert.equal(presetKeyForHost(undefined), null);
  for (const host of ['outlook.office365.com', 'outlook.office.com', 'imap-mail.outlook.com', 'Outlook.Office365.com']) {
    assert.equal(isMicrosoftImapHost(host), true, host);
  }
  assert.equal(isMicrosoftImapHost('imap.gmail.com'), false);
  assert.equal(isMicrosoftImapHost('outlook.office365.com.evil.example'), false);
});

test('alternateUsername: iCloud and Yandex retry with the other username form', () => {
  assert.equal(alternateUsername('icloud', 'johnappleseed@icloud.com', 'johnappleseed@icloud.com'), 'johnappleseed');
  assert.equal(alternateUsername('icloud', 'johnappleseed', 'johnappleseed@icloud.com'), 'johnappleseed@icloud.com');
  assert.equal(alternateUsername('yandex', 'user@yandex.com', 'user@yandex.com'), 'user');
  assert.equal(alternateUsername('icloud', 'same@me.com', 'SAME@me.com'), 'same');
  assert.equal(alternateUsername('icloud', 'Same', 'same'), null, 'nothing else to try');
  assert.equal(alternateUsername('icloud', '', 'a@me.com'), null);
  for (const key of ['gmail', 'outlook', 'yahoo', 'fastmail', 'imap', 'nope']) {
    assert.equal(alternateUsername(key, 'a@b.com', 'a@b.com'), null, key);
  }
});

test('authFailureHintForHost gives provider advice by server name', () => {
  assert.match(authFailureHintForHost('imap.gmx.net'), /POP3 & IMAP/);
  assert.match(authFailureHintForHost('imap.gmx.com'), /switches it off/);
  assert.match(authFailureHintForHost('imap.zoho.com'), /IMAP Access/);
  assert.match(authFailureHintForHost('imap.yandex.com'), /2–3 hours/);
  assert.match(authFailureHintForHost('outlook.office365.com'), /Forwarding and IMAP/);
  assert.match(authFailureHintForHost('imap.mail.yahoo.com'), /app password/);
  assert.match(authFailureHintForHost('imap.aol.com'), /app password/);
  assert.match(authFailureHintForHost('imap.fastmail.com'), /Basic plan/);
  assert.match(authFailureHintForHost('imap.mail.me.com'), /app-specific password/);
  assert.match(authFailureHintForHost('imap.gmail.com'), /App Password/);
  assert.equal(authFailureHintForHost('127.0.0.1'), '');
});

test('guessPresetForEmail maps domains and falls back to imap', () => {
  assert.equal(guessPresetForEmail('me@gmail.com'), 'gmail');
  assert.equal(guessPresetForEmail('Me@GoogleMail.com'), 'gmail');
  assert.equal(guessPresetForEmail('x@hotmail.co.uk'), 'outlook');
  assert.equal(guessPresetForEmail('x@live.com'), 'outlook');
  assert.equal(guessPresetForEmail('x@ymail.com'), 'yahoo');
  assert.equal(guessPresetForEmail('x@me.com'), 'icloud');
  assert.equal(guessPresetForEmail('x@fastmail.fm'), 'fastmail');
  assert.equal(guessPresetForEmail('x@gmx.de'), 'gmx');
  assert.equal(guessPresetForEmail('x@yandex.ru'), 'yandex');
  assert.equal(guessPresetForEmail('x@company.example'), 'imap');
  assert.equal(guessPresetForEmail(''), 'imap');
  assert.equal(guessPresetForEmail(undefined), 'imap');
  assert.equal(guessPresetForEmail('no-at-sign'), 'imap');
});

test('presetHostForEmail picks the regional host where one exists', () => {
  assert.equal(presetHostForEmail('gmx', 'a@gmx.de'), 'imap.gmx.net');
  assert.equal(presetHostForEmail('gmx', 'a@gmx.net'), 'imap.gmx.net');
  assert.equal(presetHostForEmail('gmx', 'a@gmx.com'), 'imap.gmx.com');
  assert.equal(presetHostForEmail('gmail', 'a@gmail.com'), 'imap.gmail.com');
  assert.equal(presetHostForEmail('nope', 'a@b.c'), '');
});

test('oauthProviders reflects config and spec endpoints', () => {
  const p = oauthProviders(
    config({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret', MICROSOFT_CLIENT_ID: 'mid', MICROSOFT_TENANT: 'consumers' })
  );
  assert.equal(p.google.enabled, true);
  assert.equal(p.google.clientId, 'gid');
  assert.equal(p.google.clientSecret, 'gsecret');
  assert.equal(p.google.presetKey, 'gmail');
  assert.equal(p.google.authUrl, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(p.google.tokenUrl, 'https://oauth2.googleapis.com/token');
  assert.deepEqual(p.google.scopes, ['https://mail.google.com/', 'openid', 'email', 'profile']);
  assert.deepEqual(p.google.extraAuthParams, { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' });
  assert.equal(p.google.imapHost, 'imap.gmail.com');

  assert.equal(p.microsoft.enabled, false, 'no secret -> disabled');
  assert.equal(p.microsoft.presetKey, 'outlook');
  assert.equal(p.microsoft.authUrl, 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize');
  assert.equal(p.microsoft.tokenUrl, 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token');
  assert.ok(p.microsoft.scopes.includes('https://outlook.office.com/IMAP.AccessAsUser.All'));
  assert.ok(p.microsoft.scopes.includes('offline_access'));
  assert.equal(p.microsoft.scopes[0], 'https://outlook.office.com/IMAP.AccessAsUser.All', 'the IMAP scope comes first');
  // Graph's Mail.Send is consented to at sign-in (for the Graph send fallback), never first and
  // never more than that: the sign-in token must stay an outlook.office.com one.
  assert.deepEqual(p.microsoft.scopes.filter((s) => /graph\.microsoft\.com|User\.Read/i.test(s)), ['https://graph.microsoft.com/Mail.Send']);
  assert.deepEqual(p.microsoft.graphScopes, ['https://graph.microsoft.com/Mail.Send', 'offline_access']);
  assert.equal(p.microsoft.graphSendUrl, 'https://graph.microsoft.com/v1.0/me/sendMail');
  assert.equal(p.google.graphSendUrl, null);
  assert.deepEqual(p.microsoft.extraAuthParams, { prompt: 'select_account' });
  assert.equal(p.microsoft.mailScope, 'https://outlook.office.com/IMAP.AccessAsUser.All');
  assert.deepEqual(p.microsoft.refreshScopes, [
    'https://outlook.office.com/IMAP.AccessAsUser.All',
    'https://outlook.office.com/SMTP.Send',
    'offline_access',
  ]);
  // Sending: SMTP.Send (same resource as IMAP) is asked for at sign-in, right after the IMAP scope.
  assert.equal(p.microsoft.scopes[1], 'https://outlook.office.com/SMTP.Send');
  assert.equal(p.microsoft.sendScope, 'https://outlook.office.com/SMTP.Send');
  assert.deepEqual(p.microsoft.optionalScopes, ['https://outlook.office.com/SMTP.Send']);
  assert.equal(p.google.sendScope, 'https://mail.google.com/', 'the Gmail scope covers SMTP');
  assert.deepEqual([p.google.smtpHost, p.google.smtpPort, p.google.smtpSecurity], ['smtp.gmail.com', 465, 'tls']);
  assert.deepEqual([p.microsoft.smtpHost, p.microsoft.smtpPort, p.microsoft.smtpSecurity], ['smtp.office365.com', 587, 'starttls']);
  assert.equal(p.google.mailScope, 'https://mail.google.com/');
  assert.equal(p.google.refreshScopes, null, 'Google refreshes without a scope');
  assert.deepEqual(p.google.envNames, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
  assert.deepEqual(p.microsoft.envNames, ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET']);

  // Fresh objects every call.
  p.google.scopes.push('x');
  assert.equal(oauthProviders(config()).google.scopes.length, 4);
});

test('oauthOverrides (tests only) replace endpoint/IMAP fields but never credentials', () => {
  const overrides = {
    google: { authUrl: 'http://127.0.0.1:9/auth', tokenUrl: 'http://127.0.0.1:9/token', imapHost: '127.0.0.1', imapPort: '1143', imapSecurity: 'none', clientSecret: 'hijack' },
  };
  const p = oauthProviders(config({ OAUTH_TEST_ENDPOINTS: JSON.stringify(overrides), GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b' }));
  assert.equal(p.google.authUrl, 'http://127.0.0.1:9/auth');
  assert.equal(p.google.tokenUrl, 'http://127.0.0.1:9/token');
  assert.equal(p.google.imapHost, '127.0.0.1');
  assert.equal(p.google.imapPort, 1143);
  assert.equal(p.google.imapSecurity, 'none');
  assert.equal(p.google.clientSecret, 'b');
  assert.equal(p.microsoft.authUrl, 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
});

test('oauthProviderForPreset maps account provider keys to OAuth providers', () => {
  const c = config();
  assert.equal(oauthProviderForPreset(c, 'gmail').key, 'google');
  assert.equal(oauthProviderForPreset(c, 'outlook').key, 'microsoft');
  assert.equal(oauthProviderForPreset(c, 'yahoo'), null);
});

// ---------------------------------------------------------------------------------------------
// Sending (SMTP) presets
// ---------------------------------------------------------------------------------------------

const { presetSmtpSettings, presetKeyForSmtpHost, isMicrosoftConsumerEmail } = require('../src/providers');

test('every preset has SMTP defaults and a sent-copy policy', () => {
  const expected = {
    gmail: ['smtp.gmail.com', 465, 'tls', 'server'],
    outlook: ['smtp.office365.com', 587, 'starttls', 'server'],
    yahoo: ['smtp.mail.yahoo.com', 465, 'tls', 'append'],
    icloud: ['smtp.mail.me.com', 587, 'starttls', 'append'],
    aol: ['smtp.aol.com', 465, 'tls', 'append'],
    fastmail: ['smtp.fastmail.com', 465, 'tls', 'append'],
    // Zoho documents that its SMTP server files sent mail in Sent itself.
    zoho: ['smtp.zoho.com', 465, 'tls', 'server'],
    gmx: ['mail.gmx.com', 587, 'starttls', 'append'],
    yandex: ['smtp.yandex.com', 465, 'tls', 'append'],
    imap: ['', 465, 'tls', 'append'],
  };
  for (const p of publicPresets()) {
    assert.deepEqual([p.smtpHost, p.smtpPort, p.smtpSecurity, p.sentCopy], expected[p.key], p.key);
    assert.equal(typeof p.smtpHostByDomain, 'object');
  }
  // Public copies: changing them must not change the presets.
  const outlook = publicPresets().find((p) => p.key === 'outlook');
  outlook.smtpHostByDomain['evil.example'] = 'x';
  assert.equal(PRESETS.outlook.smtpHostByDomain['evil.example'], undefined);
  assert.equal(PRESETS.icloud.smtpUser, 'email', 'iCloud SMTP wants the full address');
});

test('presetSmtpSettings picks the outgoing host by IMAP host, then email domain', () => {
  // Personal Microsoft accounts vs work/school mailboxes.
  assert.equal(presetSmtpSettings('outlook', { email: 'me@hotmail.com' }).host, 'smtp-mail.outlook.com');
  assert.equal(presetSmtpSettings('outlook', { email: 'me@OUTLOOK.com' }).host, 'smtp-mail.outlook.com');
  assert.equal(presetSmtpSettings('outlook', { email: 'me@contoso.com' }).host, 'smtp.office365.com');
  assert.equal(presetSmtpSettings('outlook', { email: 'me@contoso.com' }).port, 587);
  // GMX.net / .de accounts use mail.gmx.net.
  assert.equal(presetSmtpSettings('gmx', { email: 'me@gmx.de' }).host, 'mail.gmx.net');
  assert.equal(presetSmtpSettings('gmx', { email: 'me@gmx.com' }).host, 'mail.gmx.com');
  assert.equal(presetSmtpSettings('gmx', { email: 'me@example.org', imapHost: 'imap.gmx.net' }).host, 'mail.gmx.net');
  // Zoho: own-domain paid plans (imappro.*) and EU accounts.
  assert.equal(presetSmtpSettings('zoho', { email: 'me@company.com', imapHost: 'imappro.zoho.com' }).host, 'smtppro.zoho.com');
  assert.equal(presetSmtpSettings('zoho', { email: 'me@zoho.eu' }).host, 'smtp.zoho.eu');
  assert.equal(presetSmtpSettings('zoho', { email: 'me@zoho.com' }).host, 'smtp.zoho.com');
  // Other IMAP and unknown presets have no default host.
  assert.deepEqual(presetSmtpSettings('imap', { email: 'me@example.org' }), { host: '', port: 465, security: 'tls', sentCopy: 'append' });
  assert.equal(presetSmtpSettings('nope', {}).host, '');
});

test('presetKeyForSmtpHost and isMicrosoftConsumerEmail', () => {
  assert.equal(presetKeyForSmtpHost('smtp.gmail.com'), 'gmail');
  assert.equal(presetKeyForSmtpHost('SMTP-MAIL.OUTLOOK.COM.'), 'outlook');
  assert.equal(presetKeyForSmtpHost('smtp.office365.com'), 'outlook');
  assert.equal(presetKeyForSmtpHost('smtppro.zoho.eu'), 'zoho');
  assert.equal(presetKeyForSmtpHost('mail.gmx.net'), 'gmx');
  assert.equal(presetKeyForSmtpHost('smtp.example.org'), null);
  assert.equal(presetKeyForSmtpHost(''), null);
  assert.equal(isMicrosoftConsumerEmail('a@live.com'), true);
  assert.equal(isMicrosoftConsumerEmail('a@contoso.com'), false);
});

test('oauthOverrides may point SMTP at a test server too', () => {
  const overrides = { google: { smtpHost: '127.0.0.1', smtpPort: '2525', smtpSecurity: 'none' } };
  const p = oauthProviders(config({ OAUTH_TEST_ENDPOINTS: JSON.stringify(overrides) }));
  assert.deepEqual([p.google.smtpHost, p.google.smtpPort, p.google.smtpSecurity], ['127.0.0.1', 2525, 'none']);
});
