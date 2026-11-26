// The signed-in user: GET/PATCH/DELETE /api/me and the transparency log (GET /api/transparency).
const express = require("express");
const { publicUser, PASSWORD_MAX } = require("../auth");
const { verifyPassword } = require("../crypto");
const { AppError, microsToUsd, safeJsonParse } = require("../util");
const { PLANS } = require("../router/effort");
const { bodyObject, onlyKeys, stringField, booleanField, intQuery, badRequest } = require("./validate");

const BOOLEAN_SETTINGS = ["strict_privacy", "eu_only", "auto_pick", "share_prompts"];
const TRANSPARENCY_DEFAULT = 50;
const TRANSPARENCY_MAX = 200;

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createMeRoutes({ db, config, auth, stripe, redactor, providers, limiters }) {
  const router = express.Router();
  const stmt = {
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    transparency: db.prepare(
      `SELECT r.id, r.created_at, r.kind, r.job, r.tier, r.model_id, m.label AS model_label, r.gateway,
              r.upstream_provider, r.effort, r.zdr, r.private, r.redactions, r.charged_micros, r.status, r.error_code
         FROM requests r LEFT JOIN models m ON m.id = r.model_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC, r.rowid DESC
        LIMIT ?`
    ),
  };

  /** What the UI needs to know about this deployment. No secrets, no per-user data. */
  function clientConfig() {
    const status = typeof providers.status === "function" ? providers.status() : {};
    return {
      mock: Boolean(config.mock),
      // Both Stripe keys are needed (stripe.enabled), not just the secret key: without the webhook
      // secret a payment could never be credited.
      stripe_enabled: Boolean(stripe.enabled),
      dev_topup: Boolean(config.billing.allowDevTopup),
      margin: config.billing.margin,
      packs_usd: [...config.billing.packsUsd],
      redaction: Boolean(config.privacy.redaction),
      presidio: Boolean(redactor.presidioEnabled),
      // Whether private requests can reach a self-hosted model (always true in mock mode, where the
      // mock serves every gateway; that is also what the router does).
      selfhosted: Boolean(status.selfhosted ?? config.gateways.selfhosted.baseUrl),
      private_fallback: config.router.privateFallback,
    };
  }

  router.get("/me", auth.requireUser, (req, res) => {
    res.json({ user: publicUser(req.user), config: clientConfig() });
  });

  router.patch("/me", auth.requireUser, (req, res) => {
    const body = bodyObject(req);
    onlyKeys(body, ["plan", ...BOOLEAN_SETTINGS]);
    const sets = [];
    const values = [];
    if (body.plan !== undefined) {
      if (typeof body.plan !== "string" || !PLANS.includes(body.plan)) throw badRequest(`plan must be one of: ${PLANS.join(", ")}.`);
      sets.push("plan = ?");
      values.push(body.plan);
    }
    for (const key of BOOLEAN_SETTINGS) {
      if (body[key] === undefined) continue;
      // Column names come from the fixed list above, never from the request.
      sets.push(`${key} = ?`);
      values.push(booleanField(body[key], key) ? 1 : 0);
    }
    if (!sets.length) throw badRequest("Nothing to update.");
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values, req.user.id);
    res.json({ user: publicUser(stmt.userById.get(req.user.id)) });
  });

  // Delete everything: the account, its chats, its routing log and its data key. The password is
  // asked again so a borrowed, signed-in browser can't wipe the account.
  router.delete("/me", auth.requireUser, limiters.password, (req, res) => {
    const body = bodyObject(req);
    onlyKeys(body, ["password"]);
    const password = stringField(body.password, "password", { required: true, trim: false, max: PASSWORD_MAX });
    if (!verifyPassword(password, req.user.password_hash)) throw new AppError(401, "unauthorized", "Wrong password.");
    auth.deleteEverything(req.user.id);
    auth.clearCookie(res);
    res.json({ ok: true });
  });

  // The user's own routing log: which model answered, where it ran, what it cost, how many personal
  // details were hidden. Metadata only: the requests table never holds prompts or answers.
  router.get("/transparency", auth.requireUser, (req, res) => {
    const limit = intQuery(req.query.limit, "limit", { min: 1, max: TRANSPARENCY_MAX, dflt: TRANSPARENCY_DEFAULT });
    const requests = stmt.transparency.all(req.user.id, limit).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      kind: r.kind,
      job: r.job,
      tier: r.tier,
      model_id: r.model_id,
      model_label: r.model_label || r.model_id,
      gateway: r.gateway,
      upstream_provider: r.upstream_provider,
      effort: r.effort,
      zdr: Boolean(r.zdr),
      private: Boolean(r.private),
      redactions: safeJsonParse(r.redactions, {}) || {},
      cost_usd: microsToUsd(r.charged_micros),
      status: r.status,
      error_code: r.error_code,
    }));
    res.json({ requests });
  });

  return router;
}

module.exports = { createMeRoutes };
