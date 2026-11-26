// GET /api/public/providers: no sign-in. The privacy page's live table of every model a request
// can be sent to right now, where it runs and what its provider keeps. Doubles as a health check.
const express = require("express");
const { listModels } = require("../seed/catalog");

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createPublicRoutes({ db, config, providers, redactor }) {
  const router = express.Router();

  router.get("/public/providers", (req, res) => {
    // Only models that can actually receive a request: enabled, with their gateway configured.
    const models = listModels(db, { enabledOnly: true })
      .filter((m) => providers.isAvailable(m))
      .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
      .map((m) => ({
        label: m.label,
        vendor: m.vendor,
        region: m.region,
        gateway: m.gateway,
        jobs: m.jobs,
        zdr: m.zdr,
        self_hosted: m.self_hosted,
        retention_note: m.retention_note,
      }));
    res.json({
      models,
      redaction: { enabled: Boolean(config.privacy.redaction), presidio: Boolean(redactor.presidioEnabled) },
    });
  });

  return router;
}

module.exports = { createPublicRoutes };
