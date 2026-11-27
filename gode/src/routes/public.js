// GET /api/public/providers: no sign-in. The privacy page's live table of every model a request
// can be sent to right now, where it runs and what its provider keeps, plus the deployment facts
// the privacy promises depend on (so the page never promises more than this server does). Doubles
// as a health check.
const express = require("express");
const { listModels } = require("../seed/catalog");

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createPublicRoutes({ db, config, providers, redactor, classifier }) {
  const router = express.Router();

  router.get("/public/providers", (req, res) => {
    // Only models that can actually receive a request: enabled, with their gateway configured
    // (a self-hosted server marked down is unavailable too).
    const available = listModels(db, { enabledOnly: true }).filter((m) => providers.isAvailable(m));
    const models = available
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
    // "Stays on our servers" is only true when a model on our own gateway can answer right now.
    // Decided by the gateway, not the editable self_hosted flag.
    const selfhosted = available.some((m) => m.gateway === "selfhosted" && (m.jobs || []).some((j) => j === "chat" || j === "code"));
    // The classifier a message goes to before routing (none = Gode's own rules). Requests our own
    // checks flag as private never reach it (src/router/classify.js).
    const active = typeof classifier?.resolveModel === "function" ? classifier.resolveModel() : null;
    res.json({
      models,
      redaction: { enabled: Boolean(config.privacy.redaction), presidio: Boolean(redactor.presidioEnabled) },
      selfhosted,
      presidio: Boolean(redactor.presidioEnabled),
      // Private text with no self-hosted model: "zdr" (zero-retention model after redaction) or "block".
      private_fallback: config.router.privateFallback,
      redact_self_hosted: Boolean(config.privacy.redactSelfHosted),
      media_proxy: Boolean(config.privacy.mediaProxy),
      classifier: active
        ? { label: active.label, zdr: Boolean(active.zdr || active.self_hosted), region: active.region || null, self_hosted: active.gateway === "selfhosted" }
        : null,
    });
  });

  return router;
}

module.exports = { createPublicRoutes };
