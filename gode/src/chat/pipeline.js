"use strict";
// Chat pipeline: one user turn, from the typed text to a stored, billed answer. See
// docs/ARCHITECTURE.md "Chat pipeline".
//
//   load user + conversation -> redact (history + new text, one placeholder map per conversation)
//   -> classify -> pick -> reserve credits + store the question -> route event
//   -> stream text (restore placeholders on the fly, then the response filter) or generate media
//   -> settle + store the answer and the requests row in ONE transaction -> done event.
//
// Privacy rules kept here:
// - Upstreams only ever see redacted text (placeholders for text jobs, neutral phrases for media
//   prompts), except the self-hosted tier when REDACT_SELF_HOSTED is off: that never leaves our servers.
// - Messages, titles and the placeholder map are stored encrypted with the user's data key; the
//   requests table holds metadata only (ids, counts, costs).
// - Logs carry request ids and error codes, never text, emails or tokens.
//
// Failure rules: every failure releases the credit hold, writes a requests row with status 'error'
// when it happens after classification, and ends with one `error { error, code }` event whose
// message is safe to show (AppError messages are written for users; anything else becomes a
// generic message). An answer is stored only when it finished: a partial or failed answer leaves
// the conversation as it was (a failed regenerate keeps the old answer visible).
const { newId, now, microsToUsd, AppError, safeJsonParse, estimateTokens } = require("../util");
const { sha256 } = require("../crypto");
const { MEDIA_JOBS } = require("../seed/catalog");
const { sanitizeTitle } = require("../router/classify");
const { routeJob } = require("../router/pick");
const { ceilMicros } = require("../billing/credits");
const { checkMaxChars } = require("../providers/fal");

const MODES = Object.freeze(["auto", "manual", "regenerate", "switch"]);
const CLASSIFIER_CONTEXT_MESSAGES = 4;
const TITLE_MAX_CHARS = 120;
const CAPTION_MAX_CHARS = 500;
const MEDIA_TYPES = new Set(["image", "video", "audio"]);
const MEDIA_HISTORY_LABEL = { image: "[generated image]", video: "[generated video]", audio: "[generated audio]" };

// Display estimate only (the `est.` on the live chip): a typical answer for the classifier's
// expected length plus a reasoning allowance for the effort. The credit hold always covers the full
// MAX_OUTPUT_TOKENS, so an answer can never overspend.
const EXPECTED_OUTPUT_TOKENS = Object.freeze({ short: 300, medium: 900, long: 2500 });
const REASONING_ALLOWANCE_TOKENS = Object.freeze({ none: 0, low: 300, medium: 1000, high: 2500 });

// Media units for the credit hold, when the catalog params don't say. fal's usual clip is 5 s and
// its square_hd preset is 1024 x 1024 (about 1.05 megapixels).
const DEFAULT_MEDIA_SECONDS = 5;
const MEGAPIXELS_PER_IMAGE = 1.05;

const PLACEHOLDER_NOTE =
  "Some personal details in this conversation were replaced with placeholders such as [PERSON_1] or [EMAIL_1] " +
  "before reaching you. Treat each placeholder as the real value: use it exactly as written when you refer to it, " +
  "never ask what it stands for, and never invent a replacement.";
// Phase 1 answers `action` jobs with the chat route (see "Core vocabulary").
const ACTION_NOTE =
  "The user wants something done in another app (sending, posting or scheduling). You cannot act in other apps " +
  "yet: prepare what they need, such as the draft or the details, and say in one short sentence that they will " +
  "have to send or schedule it themselves.";

// Expected outcomes that need no log line: they are the user's doing, not ours.
const QUIET_CODES = new Set(["aborted", "bad_request", "not_found", "insufficient_credits", "private_blocked"]);

// ---------------------------------------------------------------------------------------------
// Pure helpers (exported for tests and for routes that render stored requests)

/**
 * Customer-facing cost: 2 significant digits. $0.01 and up -> 2 decimals ("$0.04"); below that up
 * to 4 decimals ("$0.0031", "$0.003"); below $0.0001 -> "<$0.0001". Integer micro-USD math, so
 * float noise never flips a rounding.
 */
function formatCost(costUsd) {
  const micros = Math.round(Number(costUsd) * 1e6);
  if (!Number.isFinite(micros) || micros <= 0) return "$0.00";
  if (micros < 100) return "<$0.0001";
  if (micros < 10_000) {
    const tenThousandths = Math.round(micros / 100);
    if (tenThousandths < 100) return `$${(tenThousandths / 10_000).toFixed(4).replace(/0+$/, "")}`;
  }
  return `$${(Math.round(micros / 10_000) / 100).toFixed(2)}`;
}

/**
 * "Claude Opus 5.5 · high effort · $0.04" / "DeepSeek V4.1 Flash · no thinking · $0.0031".
 * An empty effort (null/undefined) leaves the middle part out: media answers have no reasoning,
 * so "no thinking" would read oddly under an image.
 */
function formatChip(label, effort, costUsd) {
  const parts = [String(label || "")];
  if (effort) parts.push(effort === "none" ? "no thinking" : `${effort} effort`);
  parts.push(formatCost(costUsd));
  return parts.join(" · ");
}

/** The chip for a stored or live answer: media jobs show no effort part. */
function chipFor({ label, job, effort, costUsd }) {
  return formatChip(label, isMediaJob(job) ? null : effort || "none", costUsd);
}

/** Opaque per-conversation id for gateway stickiness (prompt caching). Never identifies the user. */
function sessionIdFor(conversationId) {
  return sha256(`gode-session:${conversationId}`).slice(0, 32);
}

/** Short system message for text jobs. Holds nothing that identifies the user. */
function buildSystemPrompt({ date, placeholders = false, action = false } = {}) {
  const parts = [`You are a helpful assistant answering through Gode. Today's date is ${date} (UTC).`];
  if (action) parts.push(ACTION_NOTE);
  if (placeholders) parts.push(PLACEHOLDER_NOTE);
  return parts.join("\n\n");
}

/** Text a stored message contributes to the history sent upstream. Media becomes a short marker. */
function historyContent(content) {
  const text = typeof content?.text === "string" ? content.text : "";
  const media = Array.isArray(content?.media) ? content.media : [];
  if (!media.length) return text;
  const labels = [...new Set(media.map((m) => MEDIA_HISTORY_LABEL[m?.type] || "[generated media]"))].join(" ");
  return text ? `${labels} ${text}` : labels;
}

function isMediaJob(job) {
  return MEDIA_JOBS.includes(routeJob(job));
}

function hasEntries(map) {
  return Boolean(map && map.byPlaceholder && typeof map.byPlaceholder === "object" && Object.keys(map.byPlaceholder).length);
}

function positiveNumber(v) {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nonNegativeCount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Billable units of model.price_unit we expect a media request to use (sizes the credit hold). */
function estimateMediaUnits(model, prompt) {
  const p = model?.params || {};
  const images = Math.max(1, Math.floor(positiveNumber(p.num_images) || 1));
  const seconds = () => {
    const ms = positiveNumber(p.music_length_ms);
    return positiveNumber(p.duration) ?? (ms !== null ? ms / 1000 : DEFAULT_MEDIA_SECONDS);
  };
  switch (model?.price_unit) {
    case "image":
      return images;
    case "megapixel":
      return images * MEGAPIXELS_PER_IMAGE;
    case "second":
      return seconds();
    case "minute":
      return Math.max(1, Math.ceil(seconds() / 60));
    case "1k_chars":
      return String(prompt || "").length / 1000;
    default: // request, song
      return 1;
  }
}

/** Expected answer length in tokens, for the displayed estimate only. */
function expectedOutputTokens(length, effort, maxOutputTokens) {
  const answer = EXPECTED_OUTPUT_TOKENS[length] ?? EXPECTED_OUTPUT_TOKENS.medium;
  const reasoning = REASONING_ALLOWANCE_TOKENS[effort] ?? 0;
  return Math.min(Number(maxOutputTokens) || Infinity, answer + reasoning);
}

/**
 * What the provider charged us, in micro-USD: its own reported cost when present, else catalog
 * prices. Text prices are USD per 1M tokens, i.e. micro-USD per token; outputTokens already
 * includes reasoning tokens. Media prices are USD per price_unit. Unknown prices count as 0
 * (`unpriced` tells the caller so it can log the model id).
 */
function providerCostMicros(model, { usage = null, media = null } = {}) {
  const reported = media ? media.costUsd : usage?.costUsd;
  if (typeof reported === "number" && Number.isFinite(reported) && reported >= 0) {
    return { micros: ceilMicros(reported * 1e6), unpriced: false };
  }
  if (media) {
    const units = typeof media.units === "number" && Number.isFinite(media.units) && media.units >= 0 ? media.units : 1;
    const ppu = Number(model?.price_per_unit);
    if (model?.price_per_unit === null || model?.price_per_unit === undefined || !Number.isFinite(ppu)) return { micros: 0, unpriced: units > 0 };
    return { micros: ceilMicros(units * ppu * 1e6), unpriced: false };
  }
  if (!usage) return { micros: 0, unpriced: false };
  const priceIn = Number.isFinite(Number(model?.price_in)) && model?.price_in !== null ? Number(model.price_in) : null;
  const priceOut = Number.isFinite(Number(model?.price_out)) && model?.price_out !== null ? Number(model.price_out) : null;
  const inTok = nonNegativeCount(usage.inputTokens);
  const outTok = nonNegativeCount(usage.outputTokens);
  return {
    micros: ceilMicros(inTok * (priceIn ?? 0) + outTok * (priceOut ?? 0)),
    unpriced: (priceIn === null && inTok > 0) || (priceOut === null && outTok > 0),
  };
}

function abortError(signal) {
  if (signal?.reason !== undefined) return signal.reason;
  return new DOMException("This operation was aborted", "AbortError");
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(signal);
}

function normalizePins(pins) {
  const obj = typeof pins === "string" ? safeJsonParse(pins, {}) : pins;
  return obj && typeof obj === "object" && !Array.isArray(obj) ? { ...obj } : {};
}

const sameJSON = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ---------------------------------------------------------------------------------------------
// Pipeline

/**
 * @param {object} deps
 * @param {object} deps.db          openDb() handle
 * @param {object} deps.config      loadConfig() result
 * @param {object} deps.keyring     createKeyring() result
 * @param {object} deps.redactor    createRedactor() result
 * @param {object} deps.classifier  createClassifier() result
 * @param {object} deps.picker      createPicker() result
 * @param {object} deps.providers   createProviders() result
 * @param {object} deps.credits     createCredits() result
 * @param {{ warn?: Function, error?: Function }} [deps.logger]
 */
function createPipeline({ db, config, keyring, redactor, classifier, picker, providers, credits, logger = console } = {}) {
  const required = { db, config, keyring, redactor, classifier, picker, providers, credits };
  for (const [name, dep] of Object.entries(required)) {
    if (!dep) throw new TypeError(`createPipeline: ${name} is required`);
  }

  const historyLimit = Math.max(0, Math.floor(Number(config.router?.historyMessages) || 0));
  const maxOutputTokens = Math.max(1, Math.floor(Number(config.router?.maxOutputTokens) || 4096));
  const redactionOn = config.privacy?.redaction !== false;
  const responseFilterOn = config.privacy?.responseFilter !== false;
  const redactSelfHosted = Boolean(config.privacy?.redactSelfHosted);

  const q = {
    user: db.prepare("SELECT * FROM users WHERE id = ?"),
    userExists: db.prepare("SELECT 1 AS ok FROM users WHERE id = ?"),
    conversation: db.prepare("SELECT id, user_id, title_enc, pins, pii_map_enc FROM conversations WHERE id = ?"),
    conversationExists: db.prepare("SELECT 1 AS ok FROM conversations WHERE id = ? AND user_id = ?"),
    conversationPins: db.prepare("SELECT pins FROM conversations WHERE id = ?"),
    insertConversation: db.prepare(
      `INSERT INTO conversations (id, user_id, title_enc, pins, pii_map_enc, created_at, updated_at)
       VALUES (?, ?, ?, '{}', ?, ?, ?)`
    ),
    setTitle: db.prepare("UPDATE conversations SET title_enc = ? WHERE id = ? AND title_enc IS NULL"),
    setMap: db.prepare("UPDATE conversations SET pii_map_enc = ? WHERE id = ?"),
    setPins: db.prepare("UPDATE conversations SET pins = ? WHERE id = ?"),
    touch: db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?"),
    message: db.prepare("SELECT rowid AS seq, * FROM messages WHERE id = ?"),
    recentMessages: db.prepare(
      `SELECT rowid AS seq, id, role, content_enc, created_at FROM messages
        WHERE conversation_id = ? AND superseded = 0
        ORDER BY created_at DESC, rowid DESC LIMIT ?`
    ),
    messagesBefore: db.prepare(
      `SELECT rowid AS seq, id, role, content_enc, created_at FROM messages
        WHERE conversation_id = ? AND superseded = 0 AND (created_at < ? OR (created_at = ? AND rowid < ?))
        ORDER BY created_at DESC, rowid DESC LIMIT ?`
    ),
    liveReply: db.prepare("SELECT 1 AS ok FROM messages WHERE parent_id = ? AND role = 'assistant' AND superseded = 0 LIMIT 1"),
    insertMessage: db.prepare(
      `INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, superseded, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ),
    supersede: db.prepare("UPDATE messages SET superseded = 1 WHERE id = ? AND superseded = 0"),
    request: db.prepare("SELECT * FROM requests WHERE id = ?"),
    modelJobs: db.prepare("SELECT jobs FROM models WHERE id = ?"),
    holdAlive: db.prepare("SELECT 1 AS ok FROM holds WHERE id = ? AND user_id = ?"),
    markRegenerated: db.prepare("UPDATE requests SET regenerated = 1 WHERE id = ?"),
    markOverridden: db.prepare("UPDATE requests SET overridden = 1 WHERE id = ?"),
    insertRequest: db.prepare(
      `INSERT INTO requests (id, user_id, conversation_id, message_id, kind, job, difficulty, private, tier, model_id,
         gateway, upstream_provider, effort, zdr, pinned, classifier_model, input_tokens, output_tokens,
         reasoning_tokens, media_units, api_cost_micros, charged_micros, latency_ms, status, error_code, redactions,
         created_at)
       VALUES ($id, $user_id, $conversation_id, $message_id, $kind, $job, $difficulty, $private, $tier, $model_id,
         $gateway, $upstream_provider, $effort, $zdr, $pinned, $classifier_model, $input_tokens, $output_tokens,
         $reasoning_tokens, $media_units, $api_cost_micros, $charged_micros, $latency_ms, $status, $error_code,
         $redactions, $created_at)`
    ),
  };

  const warnedUnpriced = new Set();

  function log(level, line) {
    const fn = logger?.[level] || logger?.warn;
    if (typeof fn === "function") fn.call(logger, line);
  }

  /** emit() belongs to the transport; a throwing writer must not break billing or storage. */
  function safeEmitter(emit) {
    let failed = false;
    return (event, data) => {
      try {
        emit(event, data);
      } catch (err) {
        if (!failed) log("warn", `[pipeline] emit failed (${err?.name || "error"})`);
        failed = true;
      }
    };
  }

  // ---- encryption --------------------------------------------------------------------------

  const encryptJSON = (turn, value) => keyring.encrypt(turn.user.wrapped_dek, value, { json: true });
  const decryptJSON = (turn, sealed) => keyring.decrypt(turn.user.wrapped_dek, sealed, { json: true });

  function messageContent(turn, row) {
    const c = decryptJSON(turn, row.content_enc);
    return c && typeof c === "object" ? c : { text: "" };
  }

  // ---- loading -----------------------------------------------------------------------------

  function loadUser(user) {
    const id = typeof user === "string" ? user : user?.id;
    const row = typeof id === "string" && id ? q.user.get(id) : null;
    if (!row) throw new AppError(401, "unauthorized", "Please log in again.");
    return row;
  }

  function loadConversation(turn, conversationId) {
    const row = typeof conversationId === "string" && conversationId ? q.conversation.get(conversationId) : null;
    if (!row || row.user_id !== turn.user.id) throw new AppError(404, "not_found", "Conversation not found.");
    return {
      id: row.id,
      isNew: false,
      hasTitle: Boolean(row.title_enc),
      pins: normalizePins(row.pins),
      map: row.pii_map_enc ? decryptJSON(turn, row.pii_map_enc) : null,
    };
  }

  /** A new conversation is only written together with its first message (no empty ghost chats). */
  function newConversation() {
    return { id: newId(), isNew: true, hasTitle: false, pins: {}, map: null };
  }

  const toHistory = (turn) => (row) => ({ role: row.role, content: historyContent(messageContent(turn, row)) });

  /** Fail before redaction and classification when the user cannot pay for anything. */
  function requireCredit(turn) {
    if (credits.balance(turn.user.id) <= 0) {
      throw new AppError(402, "insufficient_credits", "You're out of credits. Buy credits to continue.");
    }
  }

  // ---- preparation: auto / manual ----------------------------------------------------------

  async function prepareNew(turn, { conversationId, text, mode, modelId, signal }) {
    if (typeof text !== "string" || !text.trim()) throw new AppError(400, "bad_request", "Type a message first.");
    if (mode === "manual" && !(typeof modelId === "string" && modelId.trim())) {
      throw new AppError(400, "bad_request", "Pick a model first.");
    }
    turn.conv = conversationId ? loadConversation(turn, conversationId) : newConversation();
    turn.text = text;

    // One extra row: the latest may be an unanswered copy of this very text (a retry after a stop or
    // an error), which is reused instead of stored twice.
    const rows = turn.conv.isNew ? [] : q.recentMessages.all(turn.conv.id, historyLimit + 1).reverse();
    const last = rows[rows.length - 1];
    if (last && last.role === "user" && !q.liveReply.get(last.id) && messageContent(turn, last).text === text) {
      rows.pop();
      turn.userMessageId = last.id;
      turn.reuseUserMessage = true;
    } else {
      turn.userMessageId = newId();
    }
    turn.history = rows.slice(Math.max(0, rows.length - historyLimit)).map(toHistory(turn));

    requireCredit(turn);
    await redactTurn(turn);

    const redactedLatest = turn.redactedMessages[turn.redactedMessages.length - 1].content;
    const c = await classifier.classify({
      text: redactedLatest,
      history: turn.redactedMessages.slice(0, -1).slice(-CLASSIFIER_CONTEXT_MESSAGES),
      redactionCounts: turn.newCounts,
      signal,
      zdrOnly: Boolean(turn.user.strict_privacy),
    });
    turn.classification = c;
    turn.classified = true;
    turn.classifierCost = nonNegativeCount(c?.usage?.costMicros);

    const override = mode === "manual" ? modelId.trim() : null;
    const job = override ? manualJob(c.job, override) : c.job;
    turn.job = job;
    turn.pick = await picker.pick({
      job,
      difficulty: c.difficulty,
      private: c.private,
      user: turn.user,
      pins: turn.conv.pins,
      overrideModelId: override,
    });
  }

  /**
   * A model picked by hand answers in the job it can do: the manual composer offers text models,
   * so "draw a cat" sent to Claude is answered as chat instead of failing with "can't do image".
   * Privacy and availability are still checked by the picker.
   */
  function manualJob(job, modelId) {
    const row = q.modelJobs.get(modelId);
    const jobs = row ? safeJsonParse(row.jobs, []) : null;
    if (!Array.isArray(jobs) || !jobs.length || jobs.includes(routeJob(job))) return job;
    return jobs.includes("chat") ? "chat" : jobs[0];
  }

  // ---- preparation: regenerate / switch ----------------------------------------------------

  async function prepareRetarget(turn, { conversationId, mode, modelId, targetMessageId }) {
    if (!(typeof targetMessageId === "string" && targetMessageId)) throw new AppError(400, "bad_request", "No answer was given to replace.");
    if (mode === "switch" && !(typeof modelId === "string" && modelId.trim())) {
      throw new AppError(400, "bad_request", "Pick a model to switch to.");
    }
    const target = q.message.get(targetMessageId);
    if (!target || target.user_id !== turn.user.id || (conversationId && target.conversation_id !== conversationId)) {
      throw new AppError(404, "not_found", "Message not found.");
    }
    if (target.role !== "assistant") throw new AppError(400, "bad_request", "Only answers can be regenerated.");
    if (target.superseded) throw new AppError(409, "conflict", "This answer was already replaced.");
    turn.conv = loadConversation(turn, target.conversation_id);

    const parent = target.parent_id ? q.message.get(target.parent_id) : null;
    const original = target.request_id ? q.request.get(target.request_id) : null;
    if (!parent || parent.role !== "user" || parent.conversation_id !== target.conversation_id || !original || original.user_id !== turn.user.id) {
      throw new AppError(409, "conflict", "This answer can't be redone.");
    }
    // A feedback signal for the learner even if the new answer fails.
    (mode === "switch" ? q.markOverridden : q.markRegenerated).run(original.id);

    turn.target = target;
    turn.text = messageContent(turn, parent).text;
    turn.userMessageId = parent.id;
    turn.reuseUserMessage = true;
    turn.history = q.messagesBefore
      .all(turn.conv.id, parent.created_at, parent.created_at, parent.seq, historyLimit)
      .reverse()
      .map(toHistory(turn));

    requireCredit(turn);
    await redactTurn(turn);

    // Same job, difficulty and privacy as the answer being replaced: no new classification.
    turn.classification = {
      job: original.job,
      difficulty: original.difficulty,
      private: Boolean(original.private),
      output: {},
      title: "",
      classifierModel: null,
      usage: { inputTokens: 0, outputTokens: 0, costMicros: 0 },
    };
    turn.classified = true;
    turn.classifierCost = 0;
    turn.job = original.job;
    turn.pick = await picker.pick({
      job: original.job,
      difficulty: original.difficulty,
      private: Boolean(original.private),
      user: turn.user,
      pins: turn.conv.pins,
      overrideModelId: mode === "switch" ? modelId.trim() : null,
    });
  }

  // ---- redaction ---------------------------------------------------------------------------

  /**
   * Redact REAL text (decrypted history + the new text) with the conversation's map, so the same
   * person keeps the same placeholder across turns. Counts cover the new text only: a second call
   * with the final map reproduces exactly the placeholders the first call put into it.
   */
  async function redactTurn(turn) {
    turn.realMessages = [...turn.history, { role: "user", content: turn.text }];
    if (!redactionOn) {
      turn.map = turn.conv.map;
      turn.redactedMessages = turn.realMessages;
      turn.newCounts = {};
      return;
    }
    const all = await redactor.redactMessages(turn.realMessages, turn.conv.map);
    const latest = await redactor.redactMessages([turn.realMessages[turn.realMessages.length - 1]], all.map);
    turn.map = all.map;
    turn.redactedMessages = all.messages;
    turn.newCounts = latest.counts || {};
  }

  // ---- answering ---------------------------------------------------------------------------

  async function answer(turn, send, signal) {
    const { pick, classification: c } = turn;
    const model = pick.model;
    const media = isMediaJob(turn.job);
    // Self-hosted models run on our own servers: with REDACT_SELF_HOSTED off they get the real text.
    turn.redactedSend = redactionOn && !(model.self_hosted && !redactSelfHosted);

    let estimateApi;
    let expectedApi;
    if (media) {
      if (turn.redactedSend) {
        const generic = await redactor.redactMessages([{ role: "user", content: turn.text }], turn.map, { mode: "generic" });
        turn.prompt = generic.messages[0].content;
        turn.redactions = generic.counts || {};
      } else {
        turn.prompt = turn.text;
        turn.redactions = {};
      }
      // A text-to-speech model with a length limit (params.max_chars) would refuse it upstream after
      // queueing: say so now, before any credit is held.
      checkMaxChars(model, turn.prompt);
      estimateApi = credits.estimateApiCostMicros({ model, units: estimateMediaUnits(model, turn.prompt) });
      expectedApi = estimateApi;
    } else {
      const system = buildSystemPrompt({
        date: new Date(now()).toISOString().slice(0, 10),
        placeholders: turn.redactedSend && hasEntries(turn.map),
        action: turn.job === "action",
      });
      const conversation = turn.redactedSend ? turn.redactedMessages : turn.realMessages;
      turn.upstreamMessages = [{ role: "system", content: system }, ...conversation];
      turn.redactions = turn.redactedSend ? turn.newCounts : {};
      const inputTokens = estimateTokens(turn.upstreamMessages.map((m) => m.content).join("\n"));
      turn.estimatedInputTokens = inputTokens;
      estimateApi = credits.estimateApiCostMicros({ model, inputTokens, maxOutputTokens });
      expectedApi = credits.estimateApiCostMicros({
        model,
        inputTokens,
        maxOutputTokens: expectedOutputTokens(c.output?.length, pick.effort, maxOutputTokens),
      });
    }
    // The client may have left while we redacted or classified: don't hold credit or store anything.
    throwIfAborted(signal);

    const title = titleFor(turn);
    const hold = db.tx(() => {
      const h = credits.reserve(turn.user.id, credits.priceFor(estimateApi + turn.classifierCost));
      storeQuestion(turn, title);
      return h;
    });
    turn.holdId = hold.holdId;
    turn.stored = true;

    const route = {
      request_id: turn.requestId,
      conversation_id: turn.conv.id,
      user_message_id: turn.userMessageId,
      message_id: turn.assistantMessageId,
      job: turn.job,
      difficulty: c.difficulty,
      private: Boolean(pick.private),
      tier: pick.tier,
      model: { id: model.id, label: model.label, vendor: model.vendor, region: model.region },
      effort: pick.effort,
      pinned: Boolean(pick.pinned),
      zdr: Boolean(pick.zdrRequired),
      redactions: turn.redactions,
      est_cost_usd: microsToUsd(credits.priceFor(expectedApi + turn.classifierCost)),
    };
    if (title) route.title = title;
    if (turn.target) route.replaces_message_id = turn.target.id;
    send("route", route);

    turn.callStartedAt = now();
    if (media) await generateMediaAnswer(turn, send, signal);
    else await streamTextAnswer(turn, send, signal);
    turn.latencyMs = now() - turn.callStartedAt;

    finish(turn, send);
  }

  /** The conversation's first title: the classifier's, with placeholders put back. */
  function titleFor(turn) {
    if (turn.conv.hasTitle) return null;
    const raw = sanitizeTitle(turn.classification?.title || "");
    if (!raw) return null;
    return redactor.restore(raw, turn.map).slice(0, TITLE_MAX_CHARS).trim() || null;
  }

  /** Inside the reserve transaction: the conversation (if new), the question, the map and title. */
  function storeQuestion(turn, title) {
    const t = now();
    const conv = turn.conv;
    const mapEnc = turn.map ? encryptJSON(turn, turn.map) : null;
    const titleEnc = title ? keyring.encrypt(turn.user.wrapped_dek, title) : null;
    if (conv.isNew) {
      q.insertConversation.run(conv.id, turn.user.id, titleEnc, mapEnc, t, t);
    } else {
      if (!q.conversationExists.get(conv.id, turn.user.id)) throw new AppError(404, "not_found", "This conversation was deleted.");
      if (mapEnc && redactionOn) q.setMap.run(mapEnc, conv.id);
      if (titleEnc) q.setTitle.run(titleEnc, conv.id);
      q.touch.run(t, conv.id);
    }
    if (!turn.reuseUserMessage) {
      q.insertMessage.run(turn.userMessageId, conv.id, turn.user.id, "user", encryptJSON(turn, { text: turn.text }), null, null, t);
    }
  }

  async function streamTextAnswer(turn, send, signal) {
    const { model, effort, zdrRequired } = turn.pick;
    const provider = providers.get(model.gateway);
    // A model that got the real text has no placeholders to put back: restoring would only rewrite
    // a placeholder-looking string the user typed themselves.
    const restorer = redactor.createStreamRestorer(turn.redactedSend ? turn.map : null);
    let raw = "";
    let restored = "";
    const emitSafe = (text) => {
      if (!text) return;
      restored += text;
      send("delta", { text });
    };

    const stream = provider.streamChat({
      model,
      messages: turn.upstreamMessages,
      effort,
      maxTokens: maxOutputTokens,
      zdr: Boolean(zdrRequired),
      sessionId: sessionIdFor(turn.conv.id),
      signal,
    });
    for await (const ev of stream) {
      if (ev?.type === "delta" && typeof ev.text === "string") {
        raw += ev.text;
        emitSafe(restorer.push(ev.text));
      } else if (ev?.type === "usage") {
        turn.usage = ev;
      }
    }
    emitSafe(restorer.flush());
    // Providers throw on abort; one that just stops early without usage must not count as finished.
    if (!turn.usage && signal?.aborted) throw abortError(signal);
    if (!turn.usage) {
      // Contract breach (no usage event): bill an estimate rather than nothing.
      turn.usage = { inputTokens: turn.estimatedInputTokens, outputTokens: estimateTokens(raw), reasoningTokens: 0, costUsd: null, upstreamProvider: null };
    }

    let finalText = restored;
    if (responseFilterOn) {
      const filtered = redactor.filterResponse(restored, turn.map);
      if (filtered.masked && Object.keys(filtered.masked).length) {
        finalText = filtered.text;
        send("replace", { text: filtered.text });
      }
    }
    turn.answer = { text: finalText };
  }

  async function generateMediaAnswer(turn, send, signal) {
    const { model } = turn.pick;
    const provider = providers.get(model.gateway);
    const params = {};
    const aspect = turn.classification?.output?.aspect;
    if (typeof aspect === "string" && aspect) params.aspect = aspect;

    const result = await provider.generateMedia({
      model,
      job: routeJob(turn.job),
      prompt: turn.prompt,
      params,
      signal,
      onProgress: (p) => {
        const data = { status: String(p?.status || "running") };
        if (Number.isInteger(p?.position)) data.position = p.position;
        send("progress", data);
      },
    });
    // A finished generation is kept even if the client left at the last moment (like a text answer
    // whose usage already arrived): it was paid for upstream and shows up when the chat is reopened.
    const items = (Array.isArray(result?.media) ? result.media : [])
      .filter((m) => m && MEDIA_TYPES.has(m.type) && typeof m.url === "string" && m.url)
      .map((m) => (typeof m.mime === "string" && m.mime ? { type: m.type, url: m.url, mime: m.mime } : { type: m.type, url: m.url }));
    if (!items.length) throw new AppError(502, "upstream_error", `${model.gateway}: no media in the result`);
    turn.mediaResult = result;
    for (const item of items) send("media", item);
    const caption = typeof result.caption === "string" ? result.caption.trim().slice(0, CAPTION_MAX_CHARS) : "";
    turn.answer = { text: caption, media: items };
  }

  // ---- cost, storage, done -----------------------------------------------------------------

  /** Upstream cost of this request in micro-USD: the answer (if any usage is known) + classifier. */
  function apiCostMicros(turn) {
    let provider = 0;
    if (turn.pick && (turn.usage || turn.mediaResult)) {
      const cost = providerCostMicros(turn.pick.model, { usage: turn.usage, media: turn.mediaResult });
      provider = cost.micros;
      if (cost.unpriced && !warnedUnpriced.has(turn.pick.model.id)) {
        warnedUnpriced.add(turn.pick.model.id);
        log("warn", `[pipeline] no catalog price for ${turn.pick.model.id}; its usage is billed as 0`);
      }
    }
    return provider + (turn.classifierCost || 0);
  }

  function finish(turn, send) {
    const apiMicros = apiCostMicros(turn);
    const charged = credits.priceFor(apiMicros);
    const settled = settleAndStore(turn, { apiMicros, charged });
    const media = isMediaJob(turn.job);
    const balance = settled ? settled.balance : credits.balance(turn.user.id);
    const chargedNow = settled ? charged : 0;
    send("done", {
      message_id: turn.assistantMessageId,
      request_id: turn.requestId,
      conversation_id: turn.conv.id,
      cost_usd: microsToUsd(chargedNow),
      api_cost_usd: microsToUsd(apiMicros),
      input_tokens: media ? null : nonNegativeCount(turn.usage?.inputTokens),
      output_tokens: media ? null : nonNegativeCount(turn.usage?.outputTokens),
      media_units: media ? nonNegativeCount(turn.mediaResult?.units) : null,
      balance_usd: microsToUsd(balance),
      chip: chipFor({ label: turn.pick.model.label, job: turn.job, effort: turn.pick.effort, costUsd: microsToUsd(chargedNow) }),
    });
  }

  /**
   * Charge and store the answer atomically: the settle, the assistant message, the requests row,
   * pins, map and (for regenerate/switch) the superseded flag commit together or not at all.
   * Returns the settle result, or null when the hold had vanished (nothing was charged). The settle
   * runs inside the transaction, so a failed write rolls the charge back and the caller's error
   * path releases the hold instead.
   */
  function settleAndStore(turn, { apiMicros, charged }) {
    try {
      return db.tx(() => {
        if (!q.conversationExists.get(turn.conv.id, turn.user.id)) throw new AppError(404, "not_found", "This conversation was deleted.");
        let settled = null;
        if (q.holdAlive.get(turn.holdId, turn.user.id)) {
          settled = credits.settle(turn.holdId, charged, turn.requestId);
        } else {
          // The hold was released elsewhere (a stale-hold sweep), so it was already refunded: keep
          // the answer and charge nothing rather than lose it.
          log("warn", `[pipeline] ${turn.requestId}: credit hold missing at settle; answer stored without a charge`);
        }
        storeAnswer(turn, { apiMicros, charged: settled ? charged : 0 });
        return settled;
      });
    } catch (err) {
      // The account was deleted mid-answer (its holds and conversations went with it).
      if (!q.userExists.get(turn.user.id)) throw new AppError(404, "not_found", "Your account was deleted.");
      throw err;
    }
  }

  function storeAnswer(turn, { apiMicros, charged }) {
    const t = now();
    const conv = turn.conv;
    if (turn.target && q.supersede.run(turn.target.id).changes !== 1) {
      throw new AppError(409, "conflict", "This answer was already replaced.");
    }
    // A regenerated answer takes the old one's place in the conversation, not the end of it.
    const createdAt = turn.target ? turn.target.created_at : t;
    q.insertMessage.run(
      turn.assistantMessageId,
      conv.id,
      turn.user.id,
      "assistant",
      encryptJSON(turn, turn.answer),
      turn.userMessageId,
      turn.requestId,
      createdAt
    );
    insertRequest(turn, { status: "ok", errorCode: null, apiMicros, charged, messageId: turn.assistantMessageId });

    if (turn.pick.pinsUpdate) {
      // Merge only what this pick changed, so a concurrent turn's pin for another job survives.
      const current = normalizePins(q.conversationPins.get(conv.id)?.pins);
      for (const [job, pin] of Object.entries(turn.pick.pinsUpdate)) {
        if (!sameJSON(pin, conv.pins[job])) current[job] = pin;
      }
      q.setPins.run(JSON.stringify(current), conv.id);
    }
    if (turn.map && redactionOn) q.setMap.run(encryptJSON(turn, turn.map), conv.id);
    q.touch.run(t, conv.id);
  }

  function insertRequest(turn, { status, errorCode, apiMicros, charged, messageId = null }) {
    const c = turn.classification;
    const pick = turn.pick;
    const media = turn.job ? isMediaJob(turn.job) : false;
    const usage = turn.usage;
    const conversationKnown = turn.conv && (!turn.conv.isNew || turn.stored);
    q.insertRequest.run({
      $id: turn.requestId,
      $user_id: turn.user.id,
      $conversation_id: conversationKnown ? turn.conv.id : null,
      $message_id: messageId,
      $kind: turn.kind,
      $job: turn.job ?? c?.job ?? null,
      $difficulty: c?.difficulty ?? null,
      $private: (pick ? pick.private : c?.private) ? 1 : 0,
      $tier: pick?.tier ?? null,
      $model_id: pick?.model?.id ?? null,
      $gateway: pick?.model?.gateway ?? null,
      $upstream_provider: typeof usage?.upstreamProvider === "string" ? usage.upstreamProvider.slice(0, 80) : null,
      $effort: pick?.effort ?? null,
      $zdr: pick?.zdrRequired ? 1 : 0,
      $pinned: pick?.pinned ? 1 : 0,
      $classifier_model: c?.classifierModel ?? null,
      $input_tokens: !media && usage ? nonNegativeCount(usage.inputTokens) : null,
      $output_tokens: !media && usage ? nonNegativeCount(usage.outputTokens) : null,
      $reasoning_tokens: !media && usage ? nonNegativeCount(usage.reasoningTokens) : null,
      $media_units: media && turn.mediaResult ? nonNegativeCount(turn.mediaResult.units) : null,
      $api_cost_micros: apiMicros,
      $charged_micros: charged,
      $latency_ms: turn.callStartedAt ? turn.latencyMs ?? now() - turn.callStartedAt : null,
      $status: status,
      $error_code: errorCode,
      $redactions: JSON.stringify(turn.redactions ?? turn.newCounts ?? {}),
      $created_at: turn.startedAt,
    });
  }

  // ---- failure -----------------------------------------------------------------------------

  function fail(turn, err, send, signal) {
    const aborted = Boolean(signal?.aborted) || err?.name === "AbortError";
    const known = !aborted && err instanceof AppError;
    const code = aborted ? "aborted" : known ? err.code : "internal";
    const message = aborted ? "Stopped." : known ? err.message : "Something went wrong.";
    const userExists = Boolean(turn.user && q.userExists.get(turn.user.id));

    // Billing: refund the hold; an abort after the provider reported usage pays for that usage.
    let apiMicros = turn.classifierCost || 0;
    let charged = 0;
    if (turn.holdId) {
      try {
        if (aborted && turn.usage) {
          apiMicros = apiCostMicros(turn);
          charged = credits.priceFor(apiMicros);
          credits.settle(turn.holdId, charged, turn.requestId);
        } else {
          credits.release(turn.holdId);
        }
      } catch (billingErr) {
        charged = 0;
        try {
          credits.release(turn.holdId);
        } catch {
          // Nothing left to refund (hold already gone with the account).
        }
        if (userExists) log("warn", `[pipeline] ${turn.requestId}: billing cleanup failed (${billingErr?.code || billingErr?.name || "error"})`);
      }
      turn.holdId = undefined;
    }

    let requestLogged = false;
    if (turn.classified && userExists) {
      try {
        if (turn.callStartedAt && turn.latencyMs === undefined) turn.latencyMs = now() - turn.callStartedAt;
        insertRequest(turn, { status: "error", errorCode: code, apiMicros, charged });
        requestLogged = true;
      } catch (logErr) {
        log("warn", `[pipeline] ${turn.requestId}: could not record the failed request (${logErr?.code || logErr?.name || "error"})`);
      }
    }

    if (!known && !aborted) log("error", `[pipeline] ${turn.requestId} failed: internal (${err?.name || "Error"}${err?.code ? `, ${String(err.code).slice(0, 40)}` : ""})`);
    else if (!QUIET_CODES.has(code)) log("warn", `[pipeline] ${turn.requestId} failed: ${code}`);

    const data = { error: message, code };
    // A conversation that was never stored (failure before the question was saved) is not mentioned.
    if (turn.conv && userExists && (!turn.conv.isNew || turn.stored)) data.conversation_id = turn.conv.id;
    if (requestLogged) data.request_id = turn.requestId;
    send("error", data);
  }

  // ---- entry point -------------------------------------------------------------------------

  /**
   * Run one turn. Never rejects for request-level failures: they end in an `error` event.
   * @param {object} args
   * @param {object|string} args.user          users row (or id); re-read from the DB
   * @param {string|null} [args.conversationId] null creates a conversation with the first message
   * @param {string} [args.text]               auto/manual only
   * @param {'auto'|'manual'|'regenerate'|'switch'} [args.mode]
   * @param {string} [args.modelId]            manual pick or switch target
   * @param {string} [args.targetMessageId]    regenerate/switch: the assistant message to replace
   * @param {(event: string, data: object) => void} args.emit
   * @param {AbortSignal} [args.signal]        client disconnect
   */
  async function run({ user, conversationId = null, text, mode = "auto", modelId = null, targetMessageId = null, emit, signal } = {}) {
    if (typeof emit !== "function") throw new TypeError("pipeline.run: emit must be a function");
    const send = safeEmitter(emit);
    const turn = {
      requestId: newId(),
      assistantMessageId: newId(),
      kind: mode,
      startedAt: now(),
      user: null,
      conv: null,
      classified: false,
      classifierCost: 0,
      stored: false,
      holdId: undefined,
      usage: null,
      mediaResult: null,
    };
    try {
      if (!MODES.includes(mode)) throw new AppError(400, "bad_request", "Unknown chat mode.");
      turn.user = loadUser(user);
      throwIfAborted(signal);
      if (mode === "regenerate" || mode === "switch") {
        await prepareRetarget(turn, { conversationId, mode, modelId, targetMessageId });
      } else {
        await prepareNew(turn, { conversationId, text, mode, modelId, signal });
      }
      await answer(turn, send, signal);
    } catch (err) {
      fail(turn, err, send, signal);
    }
  }

  return { run };
}

module.exports = {
  createPipeline,
  formatChip,
  formatCost,
  chipFor,
  sessionIdFor,
  buildSystemPrompt,
  historyContent,
  estimateMediaUnits,
  expectedOutputTokens,
  providerCostMicros,
  PLACEHOLDER_NOTE,
  MODES,
};
