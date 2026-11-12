'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { PRESETS, publicPresets, guessPresetForEmail, presetHostForEmail, oauthProviders, oauthProviderForPreset } = require('../src/providers');
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
  assert.deepEqual(p.microsoft.extraAuthParams, { prompt: 'select_account' });

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
