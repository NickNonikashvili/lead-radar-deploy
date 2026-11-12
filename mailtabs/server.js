'use strict';

const fs = require('fs');
const path = require('path');

// Load .env from the app folder (not the current directory), so `node mailtabs/server.js` works too.
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const { loadConfig } = require('./src/config');
const { openDb } = require('./src/db');
const { createCrypto } = require('./src/crypto');
const { createApp } = require('./src/app');
const { SyncManager } = require('./src/sync');

const SHUTDOWN_TIMEOUT_MS = 10_000;

function isLocalUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
  } catch (_) {
    return false;
  }
}

/** Print configuration hints that a self-hoster would otherwise only discover by accident. */
function startupWarnings(config, db) {
  const warnings = [];

  if (!config.google.enabled && !config.microsoft.enabled) {
    warnings.push(
      'Neither Google nor Microsoft sign-in is configured (GOOGLE_CLIENT_ID/SECRET, MICROSOFT_CLIENT_ID/SECRET).\n' +
        '  Password accounts still work: Gmail with an App Password, Yahoo, iCloud, AOL, Fastmail and any IMAP server.\n' +
        '  Outlook.com / Hotmail accounts need Microsoft sign-in, because Microsoft turned off IMAP passwords.'
    );
  } else if (!config.google.enabled) {
    warnings.push('Google sign-in is not configured; Gmail accounts can still be added with an App Password.');
  } else if (!config.microsoft.enabled) {
    warnings.push(
      'Microsoft sign-in is not configured (MICROSOFT_CLIENT_ID/SECRET), so Outlook.com / Hotmail accounts cannot be added.'
    );
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

  for (const w of warnings) console.warn(`WARNING: ${w}`);
}

function main() {
  const config = loadConfig();
  fs.mkdirSync(config.dataDir, { recursive: true });

  const db = openDb(path.join(config.dataDir, 'mailtabs.db'));
  const crypto = createCrypto(config.secretKey);
  const syncManager = new SyncManager({ db, crypto, config });
  const app = createApp({ db, config, crypto, syncManager });

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

module.exports = { main, startupWarnings };
