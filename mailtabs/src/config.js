'use strict';

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

const APP_ROOT = path.resolve(__dirname, '..');

function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  return fallback;
}

function int(value, fallback, min) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return min !== undefined ? Math.max(min, n) : n;
}

function parseTrustProxy(value) {
  if (value === undefined || value === null || value === '') return false;
  const v = String(value).trim();
  if (/^\d+$/.test(v)) return Number(v);
  const b = bool(v, undefined);
  if (b !== undefined) return b;
  return v; // express also accepts strings like 'loopback' or a CIDR list
}

function resolveSecretKey(env, dataDir) {
  const fromEnv = (env.SECRET_KEY || '').trim();
  if (fromEnv) {
    if (fromEnv.length < 32) {
      console.warn('WARNING: SECRET_KEY is shorter than 32 characters. Use a long random value (e.g. `openssl rand -hex 32`).');
    }
    return fromEnv;
  }
  const keyFile = path.join(dataDir, '.secret-key');
  try {
    const existing = fs.readFileSync(keyFile, 'utf8').trim();
    if (existing) return existing;
  } catch (_) {
    /* not there yet */
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const generated = nodeCrypto.randomBytes(32).toString('hex');
  fs.writeFileSync(keyFile, generated + '\n', { mode: 0o600 });
  console.warn(
    `WARNING: SECRET_KEY is not set, so a random one was generated and saved to ${keyFile}.\n` +
      '         It encrypts your connected accounts\' passwords and tokens. If that file is lost,\n' +
      '         every account must be reconnected. For production, set SECRET_KEY in your host\'s environment.'
  );
  return generated;
}

function parseOverrides(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.warn('WARNING: OAUTH_TEST_ENDPOINTS is not valid JSON; ignoring it.');
    return null;
  }
}

function loadConfig(env = process.env) {
  const port = int(env.PORT, 3000, 0);
  const appUrl = String(env.APP_URL || `http://localhost:${port}`).trim().replace(/\/+$/, '');
  const dataDir = path.resolve(APP_ROOT, env.DATA_DIR || 'data');
  const secretKey = resolveSecretKey(env, dataDir);

  const googleId = (env.GOOGLE_CLIENT_ID || '').trim();
  const googleSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();
  const msId = (env.MICROSOFT_CLIENT_ID || '').trim();
  const msSecret = (env.MICROSOFT_CLIENT_SECRET || '').trim();

  const config = {
    port,
    appUrl,
    dataDir,
    secretKey,
    allowSignups: bool(env.ALLOW_SIGNUPS, true),
    syncIntervalMinutes: int(env.SYNC_INTERVAL_MINUTES, 3, 1),
    initialSyncLimit: int(env.INITIAL_SYNC_LIMIT, 200, 1),
    maxBodyBytes: int(env.MAX_BODY_BYTES, 5000000, 10000),
    syncConcurrency: int(env.SYNC_CONCURRENCY, 4, 1),
    allowPrivateHosts: bool(env.ALLOW_PRIVATE_IMAP_HOSTS, false),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    cookieSecure: appUrl.startsWith('https://'),
    google: Object.freeze({ clientId: googleId, clientSecret: googleSecret, enabled: !!(googleId && googleSecret) }),
    microsoft: Object.freeze({
      clientId: msId,
      clientSecret: msSecret,
      tenant: (env.MICROSOFT_TENANT || 'common').trim() || 'common',
      enabled: !!(msId && msSecret),
    }),
    oauthOverrides: parseOverrides(env.OAUTH_TEST_ENDPOINTS),
    disableScheduler: bool(env.DISABLE_SYNC_SCHEDULER, false),
  };
  return Object.freeze(config);
}

module.exports = { loadConfig, APP_ROOT };
