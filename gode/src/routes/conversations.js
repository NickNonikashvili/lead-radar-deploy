// Conversations: list, create, read (decrypted, with per-answer routing metadata), rename, delete.
//
// Titles and message contents are encrypted with the owner's data key (src/crypto.js keyring);
// they are decrypted here, per request, for that owner only. Someone else's conversation is a 404,
// never a 403, so ids can't be probed.
const express = require("express");
const { AppError, microsToUsd, newId, now, safeJsonParse } = require("../util");
const { chipFor } = require("../chat/pipeline");
const { publicMediaUrl } = require("../media");
const { checkpointWal } = require("../auth");
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

/**
 * Decrypted message content -> { text, media, stopped }. Stored as encrypted JSON
 * { text, media?, stopped? } (stopped: the user pressed Stop and this partial answer was kept).
 */
function readContent(user, keyring, contentEnc) {
  const plain = keyring.decrypt(user.wrapped_dek, contentEnc);
  if (plain === null) return { text: "", media: [], stopped: false };
  const parsed = safeJsonParse(plain, undefined);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      media: Array.isArray(parsed.media) ? parsed.media : [],
      stopped: parsed.stopped === true,
    };
  }
  // Tolerate a bare string (or a JSON string) as the whole text.
  return { text: typeof parsed === "string" ? parsed : plain, media: [], stopped: false };
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
function createConversationRoutes({ db, config, auth, keyring }) {
  const router = express.Router();
  const stmt = {
    list: db.prepare("SELECT id, title_enc, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC"),
    insert: db.prepare(
      "INSERT INTO conversations (id, user_id, title_enc, pins, created_at, updated_at) VALUES (?, ?, ?, '{}', ?, ?)"
    ),
    // Current messages only: regenerate/switch mark the answer they replace as superseded.
    messages: db.prepare(
      `SELECT m.id, m.role, m.content_enc, m.parent_id, m.request_id, m.created_at,
              r.id AS r_id, r.kind, r.job, r.tier, r.model_id, md.label AS model_label, md.region AS model_region,
              md.gateway AS model_gateway, r.effort, r.charged_micros, r.private, r.zdr, r.redactions, r.feedback,
              r.pinned, r.status
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

  /**
   * 'user' when the user chose this model (a manual pick, a switch, or a later answer from the
   * model they pinned), else 'auto' (the router's pick). The switch menu words its header by it.
   */
  function pickSource(row, pins) {
    if (row.kind === "manual" || row.kind === "switch") return "user";
    const pin = pins && pins[row.job === "action" ? "chat" : row.job];
    return row.pinned && pin && pin.source === "user" && pin.model_id === row.model_id ? "user" : "auto";
  }

  function requestMeta(row, pins) {
    if (!row.r_id) return undefined;
    const label = row.model_label || row.model_id;
    const costUsd = microsToUsd(row.charged_micros);
    return {
      id: row.r_id,
      kind: row.kind,
      job: row.job,
      tier: row.tier,
      model_id: row.model_id,
      model_label: label,
      // Where it ran ('self' = our own servers): the privacy badge depends on it.
      model_region: row.model_gateway === "selfhosted" ? "self" : row.model_region || null,
      pick_source: pickSource(row, pins),
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
    const pins = readPins(conv, req.user, keyring);
    const rows = stmt.messages.all(conv.id, req.user.id);
    // A question with no current answer (its answer failed, was stopped before any text, or the
    // page closed mid-answer): the UI marks it "No answer" and offers to try again.
    const answeredIds = new Set(rows.filter((m) => m.role === "assistant" && m.parent_id).map((m) => m.parent_id));
    const messages = rows.map((m) => {
      const { text, media, stopped } = readContent(req.user, keyring, m.content_enc);
      // The stored message keeps the upstream URL; the browser gets Gode's media proxy link.
      const shown = media.map((item, i) => (item && typeof item === "object" ? { ...item, url: publicMediaUrl(config, m.id, i, item.url) } : item));
      const message = { id: m.id, role: m.role, text, media: shown, created_at: m.created_at, parent_id: m.parent_id || null };
      if (m.role === "assistant") {
        if (stopped) message.stopped = true;
        const request = requestMeta(m, pins);
        if (request) message.request = request;
      } else {
        message.answered = answeredIds.has(m.id);
      }
      return message;
    });
    res.json({
      conversation: {
        id: conv.id,
        title: readTitle(req.user, keyring, conv.title_enc),
        pins,
        private: Boolean(conv.private),
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
  // The user's data key stays live, so the deleted ciphertext must not linger in the WAL either:
  // the checkpoint after the commit rewrites it (secure_delete zeroes the freed pages).
  router.delete("/conversations/:id", auth.requireUser, (req, res) => {
    const conv = findOwnConversation(db, req.user.id, req.params.id);
    db.tx(() => {
      stmt.deleteMessages.run(conv.id);
      stmt.deleteConversation.run(conv.id, req.user.id);
    });
    checkpointWal(db);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createConversationRoutes, findOwnConversation, readPins, readContent, chipText };
