// GET /api/models: the models this user could switch an answer to (or pick by hand when auto-pick
// is off), for one job. Uses the picker's own eligibility rules, so the menu never offers a model
// the router would then refuse: strict privacy, EU-only and, with ?conversation_id=, the
// conversation's sticky privacy (once a chat went private, only private-safe models remain).
// With ?message_id= (the answer being switched) the answer's own privacy applies too, exactly as
// the switch will apply it: a private image answer only lists the models a switch would accept.
//
// Order: the current model (the answer's, else the conversation's pin), the routed picks, then the
// rest cheapest first. `header` is the menu's subtitle when the router did not pick the model:
// "Your pick, pinned for this chat" after a switch or a manual pick.
const express = require("express");
const { JOBS } = require("../seed/catalog");
const { AppError } = require("../util");
const { idField, badRequest } = require("./validate");
const { findOwnConversation, readPins } = require("./conversations");

const USER_PICK_HEADER = "Your pick, pinned for this chat";

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

const routeJob = (job) => (job === "action" ? "chat" : job);

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createModelRoutes({ db, auth, picker, keyring }) {
  const router = express.Router();

  /** The user's own answer and the request that produced it, or a 404 (never someone else's). */
  function ownAnswer(userId, messageId) {
    const msg = db.prepare("SELECT id, user_id, conversation_id, role, request_id FROM messages WHERE id = ?").get(messageId);
    if (!msg || msg.user_id !== userId || msg.role !== "assistant") throw new AppError(404, "not_found", "Message not found.");
    const request = msg.request_id ? db.prepare("SELECT user_id, job, model_id, private FROM requests WHERE id = ?").get(msg.request_id) : null;
    return { msg, request: request && request.user_id === userId ? request : null };
  }

  router.get("/models", auth.requireUser, (req, res) => {
    const job = req.query.job === undefined || req.query.job === "" ? "chat" : req.query.job;
    if (typeof job !== "string" || !JOBS.includes(job)) throw badRequest(`job must be one of: ${JOBS.join(", ")}.`);
    // idField refuses non-strings, e.g. a repeated ?conversation_id= (which arrives as an array).
    let conversationId = idField(req.query.conversation_id, "conversation_id");
    const messageId = idField(req.query.message_id, "message_id");
    let answer = null;
    if (messageId) {
      answer = ownAnswer(req.user.id, messageId);
      if (conversationId && conversationId !== answer.msg.conversation_id) throw new AppError(404, "not_found", "Message not found.");
      conversationId = answer.msg.conversation_id;
    }
    const conversation = conversationId ? findOwnConversation(db, req.user.id, conversationId) : null;
    const pins = conversation ? readPins(conversation, req.user, keyring) : null;
    const models = picker
      .candidates({
        job,
        user: req.user,
        // A switch re-uses the answer's privacy decision (requests.private), so the menu does too.
        private: Boolean(answer?.request?.private),
        pins,
        conversationPrivate: Boolean(conversation?.private),
        currentModelId: answer?.request?.model_id || null,
      })
      .map(menuModel);
    const pin = pins && pins[routeJob(job)];
    const userPick = Boolean(pin && pin.source === "user" && (!answer?.request || answer.request.model_id === pin.model_id));
    res.json({ models, header: userPick ? USER_PICK_HEADER : null });
  });

  return router;
}

module.exports = { createModelRoutes, menuModel, USER_PICK_HEADER };
