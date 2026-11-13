'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');

// Load .env from the app folder (not the current directory), so `node mailtabs/server.js` works too.
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const { loadConfig } = require('./src/config');
const { openDb } = require('./src/db');
const { createCrypto } = require('./src/crypto');
const { createApp } = require('./src/app');
const { SyncManager } = require('./src/sync');
const { OutboxManager } = require('./src/outbox');
const { cleanupUploads } = require('./src/uploads');
const { redirectUriFor } = require('./src/oauth');

const SHUTDOWN_TIMEOUT_MS = 15_000;
// Abandoned attachment uploads (older than a day and not needed by the outbox) are removed hourly.
const UPLOAD_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const UPLOAD_CLEANUP_FIRST_MS = 60 * 1000;

/**
 * Run cleanupUploads now-ish and then every hour. Returns stop(). Timers are unref()'d so they
 * never keep the process alive on their own.
 */
function startUploadCleanup({ db, config }, logger = console) {
  const run = () => {
    try {
      const { removed, strayFiles } = cleanupUploads({ db, config });
      if (removed || strayFiles) logger.log(`Removed ${removed + strayFiles} abandoned attachment upload(s).`);
    } catch (err) {
      logger.error('Cleaning up attachment uploads failed:', err);
    }
  };
  const first = setTimeout(run, UPLOAD_CLEANUP_FIRST_MS);
  const interval = setInterval(run, UPLOAD_CLEANUP_INTERVAL_MS);
  first.unref();
  interval.unref();
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}

function isLocalUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
  } catch (_) {
    return false;
  }
}

// Top-level domains that are not on the public suffix list: home/office networks and tests.
const PRIVATE_TLDS = new Set(['lan', 'local', 'localdomain', 'home', 'internal', 'intranet', 'corp', 'private', 'test', 'example', 'invalid']);

/**
 * Why Google or Microsoft would refuse <APP_URL>/api/oauth/<provider>/callback as a redirect
 * URI, as short reasons (empty when it looks acceptable). Google: https unless localhost or a
 * loopback IP, no raw IPs, and the domain must end in a public suffix. Microsoft: https unless
 * localhost; http://127.0.0.1 only via the app manifest; [::1] not at all.
 */
function redirectUriProblems(providerKey, appUrl) {
  let url;
  try {
    url = new URL(appUrl);
  } catch (_) {
    return ['APP_URL is not a valid URL'];
  }
  const host = url.hostname.toLowerCase();
  const bare = host.replace(/^\[|\]$/g, '');
  const isIp = net.isIP(bare) !== 0;
  const isLocalhost = host === 'localhost' || host.endsWith('.localhost');
  const isLoopbackIp = (net.isIPv4(bare) && bare.startsWith('127.')) || bare === '::1';
  const https = url.protocol === 'https:';
  const problems = [];

  if (providerKey === 'google') {
    if (!https && !isLocalhost && !isLoopbackIp) problems.push('it is not https:// (only localhost may use http://)');
    if (isIp && !isLoopbackIp) problems.push('it uses a raw IP address instead of a domain name');
    const tld = host.split('.').pop();
    if (!isIp && !isLocalhost && (!host.includes('.') || PRIVATE_TLDS.has(tld) || host.endsWith('.home.arpa'))) {
      problems.push(`${host} is not under a public domain ending (names like *.lan, *.local or *.home are refused)`);
    }
  } else if (bare === '::1') {
    problems.push('the IPv6 loopback [::1] is not supported (use http://localhost)');
  } else if (!https && !isLocalhost) {
    problems.push(
      isLoopbackIp
        ? 'http://127.0.0.1 can only be registered through the app manifest (use http://localhost instead)'
        : 'it is not https:// (only localhost may use http://)'
    );
  }
  return problems;
}

/**
 * Print configuration hints that a self-hoster would otherwise only discover by accident.
 * Returns the warnings (also logged with logger.warn); informational lines go to logger.log.
 */
function startupWarnings(config, db, logger = console) {
  const warnings = [];

  if (!config.google.enabled && !config.microsoft.enabled) {
    warnings.push(
      'Neither Google nor Microsoft sign-in is configured (GOOGLE_CLIENT_ID/SECRET, MICROSOFT_CLIENT_ID/SECRET).\n' +
        '  Password accounts still work: Gmail with an App Password, Yahoo, iCloud, AOL, Fastmail and any IMAP server.\n' +
        '  Outlook.com, Hotmail and Microsoft 365 accounts need Microsoft sign-in, because Microsoft turned off IMAP passwords.'
    );
  } else if (!config.google.enabled) {
    warnings.push('Google sign-in is not configured; Gmail accounts can still be added with an App Password.');
  } else if (!config.microsoft.enabled) {
    warnings.push(
      'Microsoft sign-in is not configured (MICROSOFT_CLIENT_ID/SECRET), so Outlook.com, Hotmail and Microsoft 365 accounts cannot be added.'
    );
  }

  const oauthSetups = [
    { key: 'google', name: 'Google', where: 'your Google OAuth client (Google Auth platform > Clients > Authorized redirect URIs)' },
    { key: 'microsoft', name: 'Microsoft', where: 'your Entra app registration (Authentication > Redirect URI, platform "Web", not SPA)' },
  ];
  for (const { key, name, where } of oauthSetups) {
    if (!config[key].enabled) continue;
    const uri = redirectUriFor(config, key);
    logger.log(`${name} sign-in: register this exact redirect URI in ${where}:\n  ${uri}`);
    const problems = redirectUriProblems(key, config.appUrl);
    if (problems.length) {
      warnings.push(
        `${name} sign-in is enabled, but ${name} will reject the redirect URI ${uri}: ${problems.join('; ')}.\n` +
          '  Serve Mailtabs on a real domain over https (for example behind a TLS reverse proxy) and set APP_URL to it,\n' +
          '  or open it through http://localhost (for example over an SSH tunnel) with APP_URL=http://localhost:<port>.'
      );
    }
  }

  if (!config.cookieSecure && !isLocalUrl(config.appUrl)) {
    warnings.push(
      `APP_URL (${config.appUrl}) is not https://. Sign-in cookies and your mail will travel unencrypted;\n` +
        '  put Mailtabs behind HTTPS and set APP_URL to the https:// address.'
    );
  }

  if (config.allowPrivateHosts) {
    warnings.push(
      'ALLOW_PRIVATE_IMAP_HOSTS is on: users can point accounts at servers on your private network and use\n' +
        '  unencrypted IMAP. Only enable this when every user of this server is trusted.'
    );
  }

  try {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
    if (n > 0 && config.allowSignups) {
      warnings.push(
        'ALLOW_SIGNUPS is on: anyone who can open this site can create an account.\n' +
          '  Set ALLOW_SIGNUPS=false once everyone who should use it has signed up.'
      );
    }
  } catch (_) {
    /* informational only */
  }

  for (const w of warnings) logger.warn(`WARNING: ${w}`);
  return warnings;
}

function main() {
  const config = loadConfig();
  fs.mkdirSync(config.dataDir, { recursive: true });

  const db = openDb(path.join(config.dataDir, 'mailtabs.db'));
  const crypto = createCrypto(config.secretKey);
  const syncManager = new SyncManager({ db, crypto, config });
  const outboxManager = new OutboxManager({ db, crypto, config, syncManager });
  const app = createApp({ db, config, crypto, syncManager, outboxManager });

  startupWarnings(config, db);

  const server = app.listen(config.port, () => {
    console.log(`Mailtabs running at ${config.appUrl}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Stop the other process or set PORT to a free port.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  syncManager.start();
  outboxManager.start();
  const stopUploadCleanup = startUploadCleanup({ db, config });

  let shuttingDown = false;
  async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) {
      console.warn('Forcing exit.');
      process.exit(1);
    }
    shuttingDown = true;
    console.log(`${signal} received — shutting down…`);

    // If something hangs (a stuck IMAP socket, a long request), do not wait forever.
    const force = setTimeout(() => {
      console.warn('Shutdown took too long; exiting anyway.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    const serverClosed = new Promise((resolve) => server.close(() => resolve()));
    server.closeIdleConnections(); // keep-alive sockets would otherwise hold close() open
    stopUploadCleanup();

    // The outbox first: a message being handed to the SMTP server is finished (or left
    // 'sending' to go out again on the next start); its follow-up steps use the sync engine.
    try {
      await outboxManager.stop();
    } catch (err) {
      console.error('Error while stopping the outbox:', err);
    }
    try {
      await syncManager.stop();
    } catch (err) {
      console.error('Error while stopping sync:', err);
    }
    await serverClosed;
    try {
      db.close();
    } catch (err) {
      console.error('Error while closing the database:', err);
    }
    process.exit(exitCode);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // A stray rejection (e.g. from a remote server misbehaving) should be logged, not take the site down.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });
  // After an uncaught exception the process state is unknown: log it and shut down cleanly.
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException', 1);
  });
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('Mailtabs failed to start:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

module.exports = { main, startupWarnings, redirectUriProblems, startUploadCleanup };
