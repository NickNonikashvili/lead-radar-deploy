'use strict';

/**
 * /api/settings — the signed-in user's preferences: { undoSendSeconds (0..30), notifications }.
 * Only these known keys are ever stored.
 */

const express = require('express');
const { requireAuth } = require('../middleware');
const { getUserSettings } = require('../outbox');
const queries = require('../queries');

const { validate } = queries;

const MAX_UNDO_SECONDS = 30;

module.exports = function settingsRoutes({ db }) {
  const router = express.Router();
  router.use(requireAuth);

  const save = db.prepare(
    'INSERT INTO user_settings (user_id, settings) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET settings = excluded.settings'
  );

  router.get('/', (req, res) => {
    res.json({ settings: getUserSettings(db, req.user.id) });
  });

  router.put('/', (req, res) => {
    const userId = req.user.id;
    const body = validate.requireBody(req);
    const changes = {};
    if (body.undoSendSeconds !== undefined) {
      changes.undoSendSeconds = validate.requireInt(body.undoSendSeconds, { field: 'Undo send delay', min: 0, max: MAX_UNDO_SECONDS });
    }
    if (body.notifications !== undefined) changes.notifications = validate.requireBoolean(body.notifications, 'notifications');
    if (!Object.keys(changes).length) throw validate.badRequest('Nothing to change: send undoSendSeconds and/or notifications.');
    const settings = db.transaction(() => {
      const next = { ...getUserSettings(db, userId), ...changes };
      save.run(userId, JSON.stringify({ undoSendSeconds: next.undoSendSeconds, notifications: next.notifications }));
      return getUserSettings(db, userId);
    })();
    res.json({ settings });
  });

  return router;
};
