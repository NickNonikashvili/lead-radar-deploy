// The signed-in user: GET/PATCH/DELETE /api/me, POST /api/me/password and the transparency log
// (GET /api/transparency).
const express = require("express");
const { publicUser, PASSWORD_MAX } = require("../auth");
const { AppError, ah, microsToUsd, safeJsonParse } = require("../util");
const { PLANS } = require("../router/effort");
const { TEXT_MAX } = require("./chat");
const { presidioFacts } = require("./public");
const { bodyObject, onlyKeys, stringField, booleanField, intQuery, idField, badRequest } = require("./validate");

const BOOLEAN_SETTINGS = ["strict_privacy", "eu_only", "auto_pick", "share_prompts"];
const TRANSPARENCY_DEFAULT = 50;
const TRANSPARENCY_MAX = 200;

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createMeRoutes({ db, config, auth, stripe, redactor, providers, limiters }) {
  const router = express.Router();
  // The classifier model of each request is joined too (cm): it receives every message it
  // classifies, so the log names it next to the model that answered. 'heuristic' (or NULL, for a
  // regenerate/switch that reused the earlier decision) means nothing was sent for classifying.
  const TRANSPARENCY_SELECT = `SELECT r.id, r.created_at, r.kind, r.job, r.tier, r.model_id, m.label AS model_label, r.gateway,
              r.upstream_provider, r.effort, r.zdr, r.private, r.redactions, r.charged_micros, r.status, r.error_code,
              r.classifier_model, cm.label AS classifier_label
         FROM requests r
         LEFT JOIN models m ON m.id = r.model_id
         LEFT JOIN models cm ON cm.id = r.classifier_model`;
  const stmt = {
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    transparency: db.prepare(`${TRANSPARENCY_SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC, r.rowid DESC LIMIT ?`),
    // Keyset paging: rows strictly older than the cursor row, in the same order (created_at ties
    // broken by rowid, as above).
    transparencyBefore: db.prepare(
      `${TRANSPARENCY_SELECT}
        WHERE r.user_id = ?1 AND (r.created_at < ?2 OR (r.created_at = ?2 AND r.rowid < ?3))
        ORDER BY r.created_at DESC, r.rowid DESC LIMIT ?4`
    ),
    cursorRow: db.prepare("SELECT created_at, rowid AS rid FROM requests WHERE id = ? AND user_id = ?"),
  };

  /** What the UI needs to know about this deployment. No secrets, no per-user data. */
  function clientConfig() {
    const status = typeof providers.status === "function" ? providers.status() : {};
    const presidio = presidioFacts(redactor);
    return {
      mock: Boolean(config.mock),
      // Both Stripe keys are needed (stripe.enabled), not just the secret key: without the webhook
      // secret a payment could never be credited.
      stripe_enabled: Boolean(stripe.enabled),
      dev_topup: Boolean(config.billing.allowDevTopup),
      margin: config.billing.margin,
      packs_usd: [...config.billing.packsUsd],
      redaction: Boolean(config.privacy.redaction),
      // Named only while it really checks what is sent (see src/routes/public.js presidioFacts).
      presidio: presidio.claim,
      presidio_state: presidio.state,
      // Whether private requests can reach a self-hosted model (always true in mock mode, where the
      // mock serves every gateway; that is also what the router does).
      selfhosted: Boolean(status.selfhosted ?? config.gateways.selfhosted.baseUrl),
      private_fallback: config.router.privateFallback,
      // Generated media is served through /api/media (the browser never contacts the media host).
      media_proxy: Boolean(config.privacy.mediaProxy),
      // Longest message the chat API accepts, so the composer can stop there.
      text_max: TEXT_MAX,
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
  router.delete(
    "/me",
    auth.requireUser,
    limiters.password,
    ah(async (req, res) => {
      const body = bodyObject(req);
      onlyKeys(body, ["password"]);
      const password = stringField(body.password, "password", { required: true, trim: false, max: PASSWORD_MAX });
      if (!(await auth.checkPassword(req.user, password))) throw new AppError(401, "unauthorized", "Wrong password.");
      auth.deleteEverything(req.user.id);
      auth.clearCookie(res);
      res.json({ ok: true });
    })
  );

  // Change the password. The current one is asked again; every other signed-in device is signed
  // out (this browser's session stays).
  router.post(
    "/me/password",
    auth.requireUser,
    limiters.password,
    ah(async (req, res) => {
      const body = bodyObject(req);
      onlyKeys(body, ["current", "next"]);
      const current = stringField(body.current, "current", { required: true, trim: false, max: PASSWORD_MAX });
      const next = stringField(body.next, "next", { required: true, trim: false, max: 1000 });
      const { revoked } = await auth.changePassword(req.user, { current, next, keepToken: req.sessionToken });
      res.json({ ok: true, signed_out_sessions: revoked });
    })
  );

  // The user's own routing log: which model answered, where it ran, what it cost, how many personal
  // details were hidden, and which classifier read the message. Metadata only: the requests table
  // never holds prompts or answers. Paged newest first: ?before=<id of the last row seen>.
  router.get("/transparency", auth.requireUser, (req, res) => {
    const limit = intQuery(req.query.limit, "limit", { min: 1, max: TRANSPARENCY_MAX, dflt: TRANSPARENCY_DEFAULT });
    const before = idField(req.query.before, "before");
    let rows;
    if (before) {
      const cursor = stmt.cursorRow.get(before, req.user.id);
      if (!cursor) throw badRequest("Unknown before cursor.");
      rows = stmt.transparencyBefore.all(req.user.id, cursor.created_at, cursor.rid, limit + 1);
    } else {
      rows = stmt.transparency.all(req.user.id, limit + 1);
    }
    const hasMore = rows.length > limit;
    const requests = rows.slice(0, limit).map((r) => ({
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
      // Contract (docs/ARCHITECTURE.md): exactly these two classifier columns. Where that model
      // runs and what it keeps is on the privacy page (/api/public/providers `classifier`).
      classifier_model: r.classifier_model || null,
      classifier_label: r.classifier_model === "heuristic" ? "Gode's own rules" : r.classifier_label || r.classifier_model || null,
    }));
    res.json({ requests, has_more: hasMore, next_before: hasMore ? requests[requests.length - 1].id : null });
  });

  return router;
}

module.exports = { createMeRoutes };
