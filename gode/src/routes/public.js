// GET /api/public/providers: no sign-in. The privacy page's live table of every model a request
// can be sent to right now, where it runs and what its provider keeps, plus the deployment facts
// the privacy promises depend on (so the page never promises more than this server does). Doubles
// as a health check.
const express = require("express");
const { listModels, onOwnServers, privateSafe } = require("../seed/catalog");

/**
 * What redaction can promise right now (no network call). `claim`: whether everything sent goes
 * through Presidio. True while it is up (or not used yet), and also while it is down in fail mode
 * 'closed', because then nothing is sent at all. In mode 'open' an outage means built-in checks
 * only, so the claim is dropped until it is back. `state`: 'off' | 'unknown' | 'up' | 'down'.
 */
function presidioFacts(redactor) {
  const st = typeof redactor?.presidioStatus === "function" ? redactor.presidioStatus() : null;
  if (!st) {
    const on = Boolean(redactor?.presidioEnabled);
    return { claim: on, state: on ? "unknown" : "off", failMode: "closed" };
  }
  return { claim: Boolean(st.enabled) && (st.failMode === "closed" || st.state !== "down"), state: st.state, failMode: st.failMode };
}

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
        // By gateway: what the privacy page promises must match where the request really goes.
        self_hosted: onOwnServers(m),
        retention_note: m.retention_note,
      }));
    // "Stays on our servers" is only true when a model on our own gateway can answer right now.
    // Decided by the gateway, not the editable self_hosted flag.
    const selfhosted = available.some((m) => m.gateway === "selfhosted" && (m.jobs || []).some((j) => j === "chat" || j === "code"));
    // The classifier a message goes to before routing (none = Gode's own rules). Requests our own
    // checks flag as private never reach it (src/router/classify.js).
    const active = typeof classifier?.resolveModel === "function" ? classifier.resolveModel() : null;
    const presidio = presidioFacts(redactor);
    res.json({
      models,
      redaction: { enabled: Boolean(config.privacy.redaction), presidio: presidio.claim },
      selfhosted,
      // The page names Microsoft Presidio only while it really checks what is sent (presidioFacts).
      presidio: presidio.claim,
      presidio_state: presidio.state,
      // Private text with no self-hosted model: "zdr" (zero-retention model after redaction) or "block".
      private_fallback: config.router.privateFallback,
      redact_self_hosted: Boolean(config.privacy.redactSelfHosted),
      media_proxy: Boolean(config.privacy.mediaProxy),
      classifier: active
        ? { label: active.label, zdr: privateSafe(active), region: active.region || null, self_hosted: onOwnServers(active) }
        : null,
    });
  });

  return router;
}

module.exports = { createPublicRoutes, presidioFacts };
