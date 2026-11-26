// Chat: POST /api/chat and the per-answer actions under /api/messages/:id (regenerate, switch,
// feedback). The first three answer with Server-Sent Events from the chat pipeline.
//
// Everything that can be checked before the stream starts is checked here (sign-in, rate limit,
// body, ownership, model exists), so those failures are ordinary JSON errors with a status code.
// After the stream opens, the pipeline reports problems as `error` events.
const express = require("express");
const { AppError } = require("../util");
const { getModel } = require("../seed/catalog");
const { bodyObject, onlyKeys, idField, badRequest } = require("./validate");
const { streamPipeline } = require("./sse");
const { findOwnConversation } = require("./conversations");

const TEXT_MAX = 32_000;
const FEEDBACK_VALUES = [1, -1, 0];

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createChatRoutes({ db, auth, pipeline, limiters, streams, ssePingMs, logError }) {
  const router = express.Router();
  const stmt = {
    message: db.prepare("SELECT id, conversation_id, role, request_id, superseded FROM messages WHERE id = ? AND user_id = ?"),
    feedback: db.prepare("UPDATE requests SET feedback = ? WHERE id = ? AND user_id = ?"),
  };

  function chatText(value) {
    if (value === undefined || value === null) throw badRequest("text is required.");
    if (typeof value !== "string") throw badRequest("text must be a string.");
    const text = value.trim();
    if (!text) throw badRequest("Type a message first.");
    if (text.length > TEXT_MAX) throw badRequest(`Message is too long (at most ${TEXT_MAX.toLocaleString("en-US")} characters).`);
    return text;
  }

  /** A model the user asked for by id must at least exist and be turned on. */
  function requireUsableModel(modelId) {
    const model = getModel(db, modelId);
    if (!model) throw badRequest("Unknown model.");
    if (!model.enabled) throw badRequest(`${model.label} is turned off.`);
    return model;
  }

  /** The user's assistant message that regenerate/switch/feedback act on. */
  function findOwnAnswer(userId, messageId) {
    const msg = typeof messageId === "string" && messageId ? stmt.message.get(messageId, userId) : null;
    if (!msg || msg.role !== "assistant") throw new AppError(404, "not_found", "Answer not found.");
    return msg;
  }

  // streamPipeline settles only after the stream ended; it rejects only if the stream could not be
  // opened at all, which goes to the JSON error handler.
  function stream(req, res, next, args) {
    streamPipeline({ req, res, pipeline, args: { user: req.user, ...args }, tracker: streams, pingMs: ssePingMs, logError }).catch(next);
  }

  router.post("/chat", auth.requireUser, limiters.chat, (req, res, next) => {
    const body = bodyObject(req);
    onlyKeys(body, ["conversation_id", "text", "model_id"]);
    const text = chatText(body.text);
    const conversationId = idField(body.conversation_id, "conversation_id");
    const requested = idField(body.model_id, "model_id");
    if (conversationId) findOwnConversation(db, req.user.id, conversationId);
    // A model choice counts only when auto-pick is off; with auto-pick on the router decides.
    const manual = Boolean(requested) && !req.user.auto_pick;
    if (manual) requireUsableModel(requested);
    stream(req, res, next, {
      conversationId,
      text,
      mode: manual ? "manual" : "auto",
      modelId: manual ? requested : null,
      targetMessageId: null,
    });
  });

  // Answer the same question again with the same (pinned) model.
  router.post("/messages/:id/regenerate", auth.requireUser, limiters.chat, (req, res, next) => {
    onlyKeys(bodyObject(req), []);
    const msg = findOwnAnswer(req.user.id, req.params.id);
    if (msg.superseded) throw new AppError(409, "conflict", "This answer was already replaced.");
    stream(req, res, next, { conversationId: msg.conversation_id, text: null, mode: "regenerate", modelId: null, targetMessageId: msg.id });
  });

  // Answer the same question again with a model the user picked (pins it for the conversation).
  router.post("/messages/:id/switch", auth.requireUser, limiters.chat, (req, res, next) => {
    const body = bodyObject(req);
    onlyKeys(body, ["model_id"]);
    const modelId = idField(body.model_id, "model_id", { required: true });
    const msg = findOwnAnswer(req.user.id, req.params.id);
    if (msg.superseded) throw new AppError(409, "conflict", "This answer was already replaced.");
    requireUsableModel(modelId);
    stream(req, res, next, { conversationId: msg.conversation_id, text: null, mode: "switch", modelId, targetMessageId: msg.id });
  });

  // 👍 = 1, 👎 = -1, 0 clears. Stored on the answer's routing-log row; the learner reads it.
  router.post("/messages/:id/feedback", auth.requireUser, (req, res) => {
    const body = bodyObject(req);
    onlyKeys(body, ["value"]);
    if (!FEEDBACK_VALUES.includes(body.value)) throw badRequest("value must be 1, -1 or 0.");
    const msg = findOwnAnswer(req.user.id, req.params.id);
    if (!msg.request_id) throw new AppError(404, "not_found", "Answer not found.");
    const changed = stmt.feedback.run(body.value === 0 ? null : body.value, msg.request_id, req.user.id).changes;
    if (!changed) throw new AppError(404, "not_found", "Answer not found.");
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createChatRoutes, TEXT_MAX };
