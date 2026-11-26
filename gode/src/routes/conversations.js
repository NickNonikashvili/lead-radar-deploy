// Conversations: list, create, read (decrypted, with per-answer routing metadata), rename, delete.
//
// Titles and message contents are encrypted with the owner's data key (src/crypto.js keyring);
// they are decrypted here, per request, for that owner only. Someone else's conversation is a 404,
// never a 403, so ids can't be probed.
const express = require("express");
const { AppError, microsToUsd, newId, now, safeJsonParse } = require("../util");
const { chipFor } = require("../chat/pipeline");
const { bodyObject, onlyKeys, stringField } = require("./validate");

const TITLE_MAX = 200;

// ---------------------------------------------------------------------------------------------
// Shared lookups (also used by the chat and models routes)
// ---------------------------------------------------------------------------------------------

function conversationNotFound() {
  return new AppError(404, "not_found", "Conversation not found.");
}

/** The user's conversation row, or a 404. */
function findOwnConversation(db, userId, conversationId) {
  const row =
    typeof conversationId === "string" && conversationId
      ? db.prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?").get(conversationId, userId)
      : null;
  if (!row) throw conversationNotFound();
  return row;
}

/**
 * A conversation's pins as an object. The schema stores them as plain JSON; an encrypted value
 * (keyring format "v1.<iv>.<tag>.<ct>") is accepted too, so either storage choice reads back.
 */
function readPins(row, user, keyring) {
  const raw = row?.pins;
  if (typeof raw === "string" && raw.startsWith("v1.")) {
    const pins = keyring.decrypt(user.wrapped_dek, raw, { json: true });
    return pins && typeof pins === "object" && !Array.isArray(pins) ? pins : {};
  }
  const pins = safeJsonParse(raw, {});
  return pins && typeof pins === "object" && !Array.isArray(pins) ? pins : {};
}

/** Decrypted message content -> { text, media }. Stored as encrypted JSON { text, media? }. */
function readContent(user, keyring, contentEnc) {
  const plain = keyring.decrypt(user.wrapped_dek, contentEnc);
  if (plain === null) return { text: "", media: [] };
  const parsed = safeJsonParse(plain, undefined);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return { text: typeof parsed.text === "string" ? parsed.text : "", media: Array.isArray(parsed.media) ? parsed.media : [] };
  }
  // Tolerate a bare string (or a JSON string) as the whole text.
  return { text: typeof parsed === "string" ? parsed : plain, media: [] };
}

function readTitle(user, keyring, titleEnc) {
  return titleEnc ? keyring.decrypt(user.wrapped_dek, titleEnc) : null;
}

/** The chip for a stored answer, exactly as the live `done` event showed it (media: no effort part). */
function chipText({ label, job, effort, costUsd }) {
  return chipFor({ label, job, effort, costUsd });
}

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------

/**
 * @param {object} ctx  app context (see src/app.js)
 */
function createConversationRoutes({ db, auth, keyring }) {
  const router = express.Router();
  const stmt = {
    list: db.prepare("SELECT id, title_enc, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC"),
    insert: db.prepare(
      "INSERT INTO conversations (id, user_id, title_enc, pins, created_at, updated_at) VALUES (?, ?, ?, '{}', ?, ?)"
    ),
    // Current messages only: regenerate/switch mark the answer they replace as superseded.
    messages: db.prepare(
      `SELECT m.id, m.role, m.content_enc, m.parent_id, m.request_id, m.created_at,
              r.id AS r_id, r.job, r.tier, r.model_id, md.label AS model_label, r.effort, r.charged_micros,
              r.private, r.zdr, r.redactions, r.feedback, r.pinned, r.status
         FROM messages m
         LEFT JOIN requests r ON r.id = m.request_id AND r.user_id = m.user_id
         LEFT JOIN models md ON md.id = r.model_id
        WHERE m.conversation_id = ? AND m.user_id = ? AND m.superseded = 0
        ORDER BY m.created_at, m.rowid`
    ),
    rename: db.prepare("UPDATE conversations SET title_enc = ?, updated_at = ? WHERE id = ? AND user_id = ?"),
    deleteMessages: db.prepare("DELETE FROM messages WHERE conversation_id = ?"),
    deleteConversation: db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?"),
  };

  function titleFromBody(req, { required }) {
    const body = bodyObject(req);
    onlyKeys(body, ["title"]);
    return stringField(body.title, "title", { required, max: TITLE_MAX });
  }

  function requestMeta(row) {
    if (!row.r_id) return undefined;
    const label = row.model_label || row.model_id;
    const costUsd = microsToUsd(row.charged_micros);
    return {
      id: row.r_id,
      job: row.job,
      tier: row.tier,
      model_id: row.model_id,
      model_label: label,
      effort: row.effort,
      cost_usd: costUsd,
      chip: chipText({ label, job: row.job, effort: row.effort, costUsd }),
      private: Boolean(row.private),
      zdr: Boolean(row.zdr),
      redactions: safeJsonParse(row.redactions, {}) || {},
      feedback: row.feedback ?? null,
      pinned: Boolean(row.pinned),
      status: row.status,
    };
  }

  router.get("/conversations", auth.requireUser, (req, res) => {
    const conversations = stmt.list.all(req.user.id).map((c) => ({
      id: c.id,
      title: readTitle(req.user, keyring, c.title_enc),
      updated_at: c.updated_at,
    }));
    res.json({ conversations });
  });

  router.post("/conversations", auth.requireUser, (req, res) => {
    const title = titleFromBody(req, { required: false }) || null;
    const id = newId();
    const t = now();
    stmt.insert.run(id, req.user.id, title ? keyring.encrypt(req.user.wrapped_dek, title) : null, t, t);
    res.status(201).json({ conversation: { id, title, updated_at: t } });
  });

  router.get("/conversations/:id", auth.requireUser, (req, res) => {
    const conv = findOwnConversation(db, req.user.id, req.params.id);
    const messages = stmt.messages.all(conv.id, req.user.id).map((m) => {
      const { text, media } = readContent(req.user, keyring, m.content_enc);
      const message = { id: m.id, role: m.role, text, media, created_at: m.created_at, parent_id: m.parent_id || null };
      if (m.role === "assistant") {
        const request = requestMeta(m);
        if (request) message.request = request;
      }
      return message;
    });
    res.json({
      conversation: {
        id: conv.id,
        title: readTitle(req.user, keyring, conv.title_enc),
        pins: readPins(conv, req.user, keyring),
        updated_at: conv.updated_at,
      },
      messages,
    });
  });

  router.patch("/conversations/:id", auth.requireUser, (req, res) => {
    const title = titleFromBody(req, { required: true });
    const conv = findOwnConversation(db, req.user.id, req.params.id);
    stmt.rename.run(keyring.encrypt(req.user.wrapped_dek, title), now(), conv.id, req.user.id);
    res.json({ ok: true });
  });

  // Deletes the content (messages, title, placeholder map). The routing log rows in `requests`
  // stay: they hold no content and are the user's billing record (transparency log, ledger refs).
  router.delete("/conversations/:id", auth.requireUser, (req, res) => {
    const conv = findOwnConversation(db, req.user.id, req.params.id);
    db.tx(() => {
      stmt.deleteMessages.run(conv.id);
      stmt.deleteConversation.run(conv.id, req.user.id);
    });
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createConversationRoutes, findOwnConversation, readPins, readContent, chipText };
