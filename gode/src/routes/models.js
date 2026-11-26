// GET /api/models: the models this user could switch an answer to (or pick by hand when auto-pick
// is off), for one job. Uses the picker's own eligibility rules, so the menu never offers a model
// the router would then refuse: strict privacy, EU-only and, with ?conversation_id=, the
// conversation's sticky privacy (once a chat went private, only private-safe models remain).
const express = require("express");
const { JOBS } = require("../seed/catalog");
const { idField, badRequest } = require("./validate");
const { findOwnConversation, readPins } = require("./conversations");

/** The menu's view of a model: what it is, where it runs, what it costs. */
function menuModel(m) {
  return {
    id: m.id,
    label: m.label,
    vendor: m.vendor,
    region: m.region,
    zdr: m.zdr,
    self_hosted: m.self_hosted,
    price_in: m.price_in,
    price_out: m.price_out,
    price_unit: m.price_unit,
    price_per_unit: m.price_per_unit,
    supports_reasoning: m.supports_reasoning,
  };
}

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createModelRoutes({ db, auth, picker, keyring }) {
  const router = express.Router();

  router.get("/models", auth.requireUser, (req, res) => {
    const job = req.query.job === undefined || req.query.job === "" ? "chat" : req.query.job;
    if (typeof job !== "string" || !JOBS.includes(job)) throw badRequest(`job must be one of: ${JOBS.join(", ")}.`);
    // idField refuses non-strings, e.g. a repeated ?conversation_id= (which arrives as an array).
    const conversationId = idField(req.query.conversation_id, "conversation_id");
    const pins = conversationId ? readPins(findOwnConversation(db, req.user.id, conversationId), req.user, keyring) : null;
    const models = picker.candidates({ job, user: req.user, private: false, pins }).map(menuModel);
    res.json({ models });
  });

  return router;
}

module.exports = { createModelRoutes, menuModel };
