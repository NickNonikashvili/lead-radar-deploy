'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const { APP_ROOT } = require('./config');
const providers = require('./providers');
const { OutboxManager } = require('./outbox');
const {
  securityHeaders,
  noStore,
  csrfGuard,
  sessionLoader,
  apiNotFound,
  createErrorHandler,
} = require('./middleware');

const DEFAULT_PUBLIC_DIR = path.join(APP_ROOT, 'public');

// The htm package does not export this file path, so locate it via the package's main entry.
// That keeps working if npm hoists htm somewhere other than ./node_modules.
const PREACT_HTM_BUNDLE = path.join(path.dirname(require.resolve('htm')), '..', 'preact', 'standalone.module.js');

// A request path whose last segment has a file extension is a request for an asset, not an app
// route, so a missing one should 404 rather than receive index.html.
const LOOKS_LIKE_FILE = /\/[^/]*\.[A-Za-z0-9]+$/;

// Compose payloads carry the message HTML (up to 2 MB, more once JSON-escaped).
const COMPOSE_JSON_LIMIT = '6mb';

/**
 * Build the express app (does not listen).
 * @param {{ db, config, crypto, syncManager, outboxManager?, publicDir?: string, logger?: Console }} deps
 *   outboxManager: the server passes the one it starts; without it the app makes one that is
 *   not started (messages are queued, nothing is sent). publicDir/logger are for tests.
 */
function createApp(deps) {
  const { db, config, crypto, syncManager } = deps;
  if (!db || !config || !crypto || !syncManager) {
    throw new TypeError('createApp: db, config, crypto and syncManager are required');
  }
  const publicDir = deps.publicDir || DEFAULT_PUBLIC_DIR;
  const logger = deps.logger || console;
  const outboxManager = deps.outboxManager || new OutboxManager({ db, crypto, config, syncManager, logger });
  const routeDeps = { db, config, crypto, syncManager, outboxManager, logger };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.locals.outboxManager = outboxManager;

  app.use(securityHeaders(config));
  app.use('/api', noStore);
  // Reject cross-site writes before spending time parsing their bodies.
  app.use(csrfGuard);
  // Only the API takes request bodies or needs to know who is signed in; static files skip both.
  // The session comes first so an upload is refused before its body is read.
  app.use('/api', sessionLoader(routeDeps));
  // Attachments are raw bodies of any type (a .json file too), so they bypass the JSON parser.
  app.use('/api/uploads', require('./routes/compose').uploadsRouter(routeDeps));
  // Drafts and sends carry whole messages; everything else stays small. (A parsed body is
  // skipped by the next parser.)
  app.use(['/api/drafts', '/api/send'], express.json({ limit: COMPOSE_JSON_LIMIT }));
  app.use('/api', express.json({ limit: '1mb' }));

  // --- API -----------------------------------------------------------------------------------
  const countUsers = db.prepare('SELECT COUNT(*) AS n FROM users');
  app.get('/api/config', (req, res) => {
    res.json({
      // The first user may always sign up, so report signups as open until someone has.
      allowSignups: config.allowSignups || countUsers.get().n === 0,
      providers: { google: !!config.google.enabled, microsoft: !!config.microsoft.enabled },
      presets: providers.publicPresets(),
    });
  });

  const accountsRoutes = require('./routes/accounts');
  app.use('/api/auth', require('./routes/auth')(routeDeps));
  app.use('/api/accounts', accountsRoutes(routeDeps));
  app.use('/api/sync', accountsRoutes.syncRouter(routeDeps));
  app.use('/api/tabs', require('./routes/tabs')(routeDeps));
  app.use('/api/messages', require('./routes/messages')(routeDeps));
  app.use('/api/folders', require('./routes/folders')(routeDeps));
  app.use('/api/settings', require('./routes/settings')(routeDeps));
  app.use('/api/oauth', require('./routes/oauth')(routeDeps));
  // /api/compose/prepare, /api/drafts, /api/send, /api/outbox, /api/contacts
  app.use('/api', require('./routes/compose')(routeDeps));
  app.use('/api', apiNotFound);

  // --- Vendored browser library ------------------------------------------------------------
  app.get('/vendor/preact-htm.js', (req, res, next) => {
    res.type('text/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(PREACT_HTM_BUNDLE, (err) => {
      if (err && !res.headersSent) next(err);
    });
  });
  app.use('/vendor', (req, res) => res.status(404).type('text/plain').send('Not found'));

  // --- Frontend ------------------------------------------------------------------------------
  // No build step and no hashed filenames, so make browsers revalidate (cheap with ETags).
  app.use(
    express.static(publicDir, {
      index: false, // "/" is handled by the SPA fallback below so index.html gets the same headers everywhere
      dotfiles: 'ignore',
      setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
    })
  );

  const indexFile = path.join(publicDir, 'index.html');
  app.get('*', (req, res, next) => {
    if (LOOKS_LIKE_FILE.test(req.path)) {
      return res.status(404).type('text/plain').send('Not found');
    }
    fs.stat(indexFile, (statErr, stat) => {
      if (statErr || !stat.isFile()) {
        return res.status(404).type('text/plain').send('Not found (the web interface has not been built yet).');
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexFile, (err) => {
        if (err && !res.headersSent) next(err);
      });
    });
  });

  // Anything else (non-GET outside /api) is simply not found.
  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

  app.use(createErrorHandler(logger));
  return app;
}

module.exports = { createApp };
