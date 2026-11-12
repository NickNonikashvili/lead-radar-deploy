'use strict';

// Startup warnings printed by server.js (no server is started).

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');

const { startupWarnings, redirectUriProblems } = require('../server');
const { loadConfig } = require('../src/config');

function config(env = {}) {
  return loadConfig({ SECRET_KEY: 'x'.repeat(40), DATA_DIR: os.tmpdir(), ALLOW_SIGNUPS: 'false', ...env });
}

const GOOGLE = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' };
const MICROSOFT = { MICROSOFT_CLIENT_ID: 'mid', MICROSOFT_CLIENT_SECRET: 'msecret' };
const fakeDb = { prepare: () => ({ get: () => ({ n: 0 }) }) };

function run(cfg) {
  const logged = { log: [], warn: [] };
  const logger = { log: (m) => logged.log.push(m), warn: (m) => logged.warn.push(m) };
  const warnings = startupWarnings(cfg, fakeDb, logger);
  return { warnings, ...logged };
}

test('redirectUriProblems: Google needs https (except localhost), a domain name and a public suffix', () => {
  for (const ok of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'https://mail.example.com', 'https://mail.example.co.uk:8443']) {
    assert.deepEqual(redirectUriProblems('google', ok), [], ok);
  }
  const lanIp = redirectUriProblems('google', 'http://192.168.1.10:3000');
  assert.equal(lanIp.length, 2);
  assert.match(lanIp.join(' '), /https/);
  assert.match(lanIp.join(' '), /raw IP/);
  assert.match(redirectUriProblems('google', 'http://mail.example.com').join(' '), /not https/);
  assert.match(redirectUriProblems('google', 'https://10.0.0.5').join(' '), /raw IP/);
  for (const host of ['mailtabs.lan', 'box.local', 'nas.home', 'mail.internal', 'server.home.arpa', 'mailtabs']) {
    assert.match(redirectUriProblems('google', `https://${host}`).join(' '), /public domain ending/, host);
  }
});

test('redirectUriProblems: Microsoft needs https except http://localhost; no [::1]', () => {
  for (const ok of ['http://localhost:3000', 'https://mail.example.com', 'https://mailtabs.lan']) {
    assert.deepEqual(redirectUriProblems('microsoft', ok), [], ok);
  }
  assert.match(redirectUriProblems('microsoft', 'http://192.168.1.10:3000').join(' '), /not https/);
  assert.match(redirectUriProblems('microsoft', 'http://mail.example.com').join(' '), /not https/);
  assert.match(redirectUriProblems('microsoft', 'http://127.0.0.1:3000').join(' '), /manifest/);
  assert.match(redirectUriProblems('microsoft', 'http://[::1]:3000').join(' '), /\[::1\]/);
});

test('startupWarnings logs the exact redirect URI of each enabled provider', () => {
  const out = run(config({ ...GOOGLE, ...MICROSOFT, APP_URL: 'https://mail.example.com/' }));
  assert.equal(out.log.length, 2);
  assert.match(out.log[0], /^Google sign-in: register this exact redirect URI/);
  assert.ok(out.log[0].includes('https://mail.example.com/api/oauth/google/callback'));
  assert.match(out.log[1], /^Microsoft sign-in: .*"Web"/);
  assert.ok(out.log[1].includes('https://mail.example.com/api/oauth/microsoft/callback'));
  assert.deepEqual(out.warnings, [], 'nothing to warn about');
  assert.deepEqual(out.warn, []);
});

test('startupWarnings warns when a provider will reject the redirect URI', () => {
  const lan = run(config({ ...GOOGLE, ...MICROSOFT, APP_URL: 'http://192.168.1.10:3000' }));
  const google = lan.warnings.find((w) => w.startsWith('Google sign-in is enabled'));
  const microsoft = lan.warnings.find((w) => w.startsWith('Microsoft sign-in is enabled'));
  assert.ok(google && microsoft, JSON.stringify(lan.warnings));
  assert.match(google, /Google will reject the redirect URI http:\/\/192\.168\.1\.10:3000\/api\/oauth\/google\/callback/);
  assert.match(google, /raw IP/);
  assert.match(microsoft, /Microsoft will reject the redirect URI .*microsoft\/callback: it is not https/);
  assert.ok(lan.warn.every((line) => line.startsWith('WARNING: ')));
  assert.ok(lan.warnings.some((w) => /not https:\/\/\. Sign-in cookies/.test(w)), 'the general https warning is still there');

  // Only enabled providers are checked or logged.
  const googleOnly = run(config({ ...GOOGLE, APP_URL: 'https://mailtabs.lan' }));
  assert.equal(googleOnly.log.length, 1);
  assert.ok(googleOnly.warnings.some((w) => /Google will reject .*public domain ending/.test(w)));
  assert.ok(!googleOnly.warnings.some((w) => /Microsoft will reject/.test(w)));
  assert.ok(googleOnly.warnings.some((w) => /Microsoft sign-in is not configured.*Microsoft 365/.test(w)));

  const none = run(config({ APP_URL: 'http://192.168.1.10:3000' }));
  assert.deepEqual(none.log, []);
  assert.ok(!none.warnings.some((w) => /will reject the redirect URI/.test(w)));

  const local = run(config({ ...GOOGLE, ...MICROSOFT, APP_URL: 'http://localhost:3000' }));
  assert.ok(!local.warnings.some((w) => /will reject the redirect URI/.test(w)), JSON.stringify(local.warnings));
  assert.ok(local.log[0].includes('http://localhost:3000/api/oauth/google/callback'));
});
