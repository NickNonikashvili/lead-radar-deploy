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
// Failure rules: a failure writes a requests row (status 'error', or 'stopped') when it happens
// after classification and ends with one `error { error, code }` event whose message is safe to
// show (AppError messages are written for users; anything else becomes a generic message).
// Billing on failure:
// - Stop (client abort) after at least one delta: the partial answer is stored as
//   { text, stopped: true } and charged for what was produced (provider usage if reported, else the
//   estimated input plus the streamed text), never more than the hold. A stopped regenerate/switch
//   is charged but keeps the old answer.
// - Stop of a media job that the provider had already started: charged at its estimate (capped at
//   the hold) and stored as an empty { text: "", media: [], stopped: true } answer, because the
//   provider bills a started generation (fal answers the cancel with CANCELLATION_REQUESTED or
//   ALREADY_COMPLETED; the adapter reports it as err.upstreamBilled). Still queued (fal: cancel
//   200 OK): free. A job that finished anyway is kept and billed like any finished generation.
// - Stop before any delta, a server shutdown, or an upstream error: the hold is released (the user
//   pays nothing); requests.api_cost_micros still records our estimated upstream spend.
// - An answer that finished upstream but could not be stored (conversation deleted mid-answer) is
//   charged: it was delivered and the upstream billed us.
// Privacy: conversations.private is set in the transaction that stores the question whenever the
// turn is private, so a failed or stopped private turn still makes later turns private.
// One turn per conversation at a time (in-process lock): a second one gets `busy`.
const { newId, now, microsToUsd, AppError, safeJsonParse, estimateTokens } = require("../util");
const { sha256 } = require("../crypto");
const { MEDIA_JOBS, durationFor, textRates } = require("../seed/catalog");
const { sanitizeTitle } = require("../router/classify");
const { routeJob } = require("../router/pick");
const { EFFORTS } = require("../router/effort");
const { resolveEffort } = require("../providers/effort-map");
const { ceilMicros } = require("../billing/credits");
const { checkMaxChars } = require("../providers/fal");
const redact = require("../redact");
const { publicMediaUrl } = require("../media");

const MODES = Object.freeze(["auto", "manual", "regenerate", "switch"]);
const CLASSIFIER_CONTEXT_MESSAGES = 4;
const TITLE_MAX_CHARS = 120;
const CAPTION_MAX_CHARS = 500;
const MEDIA_TYPES = new Set(["image", "video", "audio"]);
const MEDIA_HISTORY_LABEL = { image: "[generated image]", video: "[generated video]", audio: "[generated audio]" };
// A stopped media answer has no text or media; the model still sees that something answered.
const STOPPED_HISTORY_LABEL = "[stopped before it was ready]";

// Display estimate only (the `est.` on the live chip): a typical answer for the classifier's
// expected length plus a reasoning allowance for the effort. The credit hold always covers the full
// MAX_OUTPUT_TOKENS, so an answer can never overspend.
const EXPECTED_OUTPUT_TOKENS = Object.freeze({ short: 300, medium: 900, long: 2500 });
const REASONING_ALLOWANCE_TOKENS = Object.freeze({ none: 0, low: 300, medium: 1000, high: 2500 });
// Upstream levels outside Gode's vocabulary, as the picker reports them.
const GODE_EFFORT = Object.freeze({ minimal: "low", xhigh: "high", max: "high" });

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

// Expected outcomes that need no log line: they are the user's doing (or our restart), not a fault.
const QUIET_CODES = new Set(["aborted", "interrupted", "busy", "bad_request", "not_found", "insufficient_credits", "private_blocked"]);
const BUSY_MESSAGE = "Wait for the current answer to finish.";
const SHUTDOWN_MESSAGE = "The server is restarting. Try again in a moment.";

// History is trimmed so estimated input + MAX_OUTPUT_TOKENS fits in this share of the model's
// context_length: estimateTokens (chars / 4) undercounts dense text for some tokenizers.
const CONTEXT_HEADROOM = 0.9;
const MESSAGE_OVERHEAD_TOKENS = 4; // role framing per message

// Catalog-only media params the pipeline reads itself and never hands to an adapter.
const PIPELINE_ONLY_PARAMS = ["duration_options", "pricing"];
const HIGH_RISK = new Set(redact.HIGH_RISK_TYPES);
const MAP_KEY_RE = /^\[([A-Z][A-Z_]*)_(\d+)\]$/;

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

/**
 * Who read a question to route it, for the privacy badge: classifier_model (a models.id, 'heuristic',
 * or null when a regenerate/switch reused an earlier decision), its label, and classified_outside:
 * true when a third-party model saw the (redacted) text, which a "ran on our servers" badge must not
 * hide. `model` is the classifier's catalog row ({ label, gateway }) when known; a model missing
 * from the catalog counts as outside unless its id names the selfhosted gateway.
 */
function classifierFacts(modelId, model) {
  if (typeof modelId !== "string" || !modelId) return { classifier_model: null, classifier_label: null, classified_outside: false };
  if (modelId === "heuristic") return { classifier_model: "heuristic", classifier_label: "Gode's own rules", classified_outside: false };
  const gateway = model?.gateway || modelId.split(":")[0];
  return { classifier_model: modelId, classifier_label: model?.label || modelId, classified_outside: gateway !== "selfhosted" };
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
  if (!media.length) return text || (content?.stopped === true ? STOPPED_HISTORY_LABEL : text);
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

/**
 * Billable units of model.price_unit we expect a media request to use (sizes the credit hold).
 * `params` are the request's own inputs (e.g. a duration mapped from the classifier), which win
 * over the catalog defaults exactly as they do in the adapter call.
 */
function estimateMediaUnits(model, prompt, params = {}) {
  const p = { ...(model?.params || {}), ...(params || {}) };
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

/** The Gode effort `model` really runs `effort` at (a mandatory-reasoning model runs 'none' as 'low'). */
function effectiveEffort(model, effort) {
  if (!model?.supports_reasoning) return "none";
  const sent = resolveEffort(model, effort);
  if (!sent) return effort;
  return EFFORTS.includes(sent) ? sent : GODE_EFFORT[sent] || effort;
}

/**
 * The highest effort, at most `effort`, whose reasoning allowance still leaves `minAnswer` tokens of
 * a `cap`-token max_tokens for the answer (reasoning tokens count against max_tokens on OpenAI-style
 * APIs, so thinking alone could use up a small cap and bill an empty answer), or null when not even
 * the model's lowest level fits.
 */
function effortForCap(model, effort, cap, minAnswer) {
  if (!model?.supports_reasoning) return effort;
  const fits = (e) => (REASONING_ALLOWANCE_TOKENS[effectiveEffort(model, e)] ?? 0) + minAnswer <= cap;
  for (let i = Math.max(0, EFFORTS.indexOf(effort)); i >= 0; i--) {
    if (fits(EFFORTS[i])) return effectiveEffort(model, EFFORTS[i]);
  }
  return null;
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
 * includes reasoning tokens. Cached input tokens (part of inputTokens) are priced at
 * params.pricing.cached_in, and prompts above params.pricing.long_context's threshold at the long
 * rate (direct OpenAI reports no cost, so these matter there). Media prices are USD per price_unit.
 * Unknown prices count as 0 (`unpriced` tells the caller so it can log the model id).
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
  const inTok = nonNegativeCount(usage.inputTokens);
  const outTok = nonNegativeCount(usage.outputTokens);
  const cached = Math.min(inTok, nonNegativeCount(usage.cachedTokens));
  const rates = textRates(model, inTok);
  return {
    micros: ceilMicros((inTok - cached) * (rates.in ?? 0) + cached * (rates.cachedIn ?? 0) + outTok * (rates.out ?? 0)),
    unpriced: (rates.in === null && inTok > 0) || (rates.out === null && outTok > 0),
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

/**
 * A shutdown abort is ours, not the user's Stop: sse.js aborts with "The server is shutting down."
 * (a `shutdown: true` property on the reason is accepted too).
 */
function isShutdownReason(reason) {
  return reason?.shutdown === true || /shutting down/i.test(String(reason?.message || ""));
}

/**
 * What a title may show for a high-risk value: the last 4 characters of a card or account number
 * ("•••• 0366"), else a mask. Titles sit in the sidebar and the page title, in plain view.
 */
function maskedTitleValue(type, value) {
  const tail = String(value || "").replace(/[^0-9A-Za-z]/g, "").slice(-4);
  if (["CARD", "IBAN", "BANK_ACCOUNT"].includes(type) && tail.length === 4) return `•••• ${tail}`;
  return "••••";
}

/** The map titles are restored with: real values for low-risk types, masks for HIGH_RISK ones. */
function titleMap(map) {
  const byPlaceholder = {};
  const src = map && typeof map.byPlaceholder === "object" && map.byPlaceholder ? map.byPlaceholder : {};
  for (const [k, v] of Object.entries(src)) {
    const type = MAP_KEY_RE.exec(k)?.[1];
    if (!type || typeof v !== "string") continue;
    byPlaceholder[k] = HIGH_RISK.has(type) ? maskedTitleValue(type, v) : v;
  }
  return { byPlaceholder };
}

/** [PERSON_1] -> "a person" for media prompts (the redactor's rule, shared with its generic mode). */
const genericizePlaceholders = redact.genericizePlaceholders;

/** Distinct placeholders per type in a text: the "N personal details hidden" counts of a media prompt. */
function placeholderCounts(text) {
  const byType = {};
  for (const m of String(text ?? "").matchAll(/\[([A-Z][A-Z_]*)_(\d+)\]/g)) (byType[m[1]] ||= new Set()).add(m[0]);
  return Object.fromEntries(Object.entries(byType).map(([t, set]) => [t, set.size]));
}

function addCounts(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) out[k] = (out[k] || 0) + (Number(v) || 0);
  return out;
}

/** The model as an adapter should see it: without the catalog keys only the pipeline reads. */
function adapterModel(model) {
  const params = model?.params && typeof model.params === "object" ? { ...model.params } : {};
  let changed = false;
  for (const k of PIPELINE_ONLY_PARAMS) {
    if (k in params) {
      delete params[k];
      changed = true;
    }
  }
  return changed ? { ...model, params } : model;
}

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
  const minAffordableOutputTokens = Math.min(maxOutputTokens, Math.max(1, Math.floor(Number(config.billing?.minAffordableOutputTokens) || 256)));

  // Single process per database (src/db.js), so in-memory sets are authoritative:
  // conversations with a turn in flight (one turn at a time per conversation keeps the stored
  // placeholder map, pins and supersede flags consistent), and the credit holds of running turns
  // (the stale-hold sweep in server.js must never release those).
  const busyConversations = new Set();
  const liveHolds = new Set();

  const q = {
    user: db.prepare("SELECT * FROM users WHERE id = ?"),
    userExists: db.prepare("SELECT 1 AS ok FROM users WHERE id = ?"),
    conversation: db.prepare("SELECT id, user_id, title_enc, pins, pii_map_enc, private FROM conversations WHERE id = ?"),
    conversationExists: db.prepare("SELECT 1 AS ok FROM conversations WHERE id = ? AND user_id = ?"),
    conversationPins: db.prepare("SELECT pins FROM conversations WHERE id = ?"),
    insertConversation: db.prepare(
      `INSERT INTO conversations (id, user_id, title_enc, pins, pii_map_enc, private, created_at, updated_at)
       VALUES (?, ?, ?, '{}', ?, ?, ?, ?)`
    ),
    // Never cleared: once any turn was private, the history it left behind keeps the chat private.
    setPrivate: db.prepare("UPDATE conversations SET private = 1 WHERE id = ? AND private = 0"),
    setTitle: db.prepare("UPDATE conversations SET title_enc = ? WHERE id = ? AND title_enc IS NULL"),
    setMap: db.prepare("UPDATE conversations SET pii_map_enc = ? WHERE id = ?"),
    setPins: db.prepare("UPDATE conversations SET pins = ? WHERE id = ?"),
    touch: db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?"),
    message: db.prepare("SELECT rowid AS seq, * FROM messages WHERE id = ?"),
    recentMessages: db.prepare(
      `SELECT rowid AS seq, id, role, content_enc, parent_id, created_at FROM messages
        WHERE conversation_id = ? AND superseded = 0
        ORDER BY created_at DESC, rowid DESC LIMIT ?`
    ),
    messagesBefore: db.prepare(
      `SELECT rowid AS seq, id, role, content_enc, parent_id, created_at FROM messages
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
    modelBrief: db.prepare("SELECT label, gateway FROM models WHERE id = ?"),
    // The classifier that first read a question (a regenerate or switch reuses its decision).
    questionClassifier: db.prepare(
      `SELECT r.classifier_model FROM messages m JOIN requests r ON r.id = m.request_id
        WHERE m.parent_id = ? AND r.classifier_model IS NOT NULL ORDER BY r.created_at LIMIT 1`
    ),
    holdAlive: db.prepare("SELECT 1 AS ok FROM holds WHERE id = ? AND user_id = ?"),
    markRegenerated: db.prepare("UPDATE requests SET regenerated = 1 WHERE id = ?"),
    markOverridden: db.prepare("UPDATE requests SET overridden = 1 WHERE id = ?"),
    insertRequest: db.prepare(
      `INSERT INTO requests (id, user_id, conversation_id, message_id, kind, job, difficulty, private, tier, model_id,
         gateway, upstream_provider, effort, zdr, pinned, classifier_model, input_tokens, output_tokens,
         reasoning_tokens, media_units, api_cost_micros, charged_micros, latency_ms, status, error_code, redactions,
         context_included, created_at)
       VALUES ($id, $user_id, $conversation_id, $message_id, $kind, $job, $difficulty, $private, $tier, $model_id,
         $gateway, $upstream_provider, $effort, $zdr, $pinned, $classifier_model, $input_tokens, $output_tokens,
         $reasoning_tokens, $media_units, $api_cost_micros, $charged_micros, $latency_ms, $status, $error_code,
         $redactions, $context_included, $created_at)`
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
      private: Boolean(row.private),
    };
  }

  /** A new conversation is only written together with its first message (no empty ghost chats). */
  function newConversation() {
    return { id: newId(), isNew: true, hasTitle: false, pins: {}, map: null, private: false };
  }

  /** One turn at a time per conversation; released in run()'s finally. */
  function lockConversation(turn, conversationId) {
    if (busyConversations.has(conversationId)) throw new AppError(409, "busy", BUSY_MESSAGE);
    busyConversations.add(conversationId);
    turn.lockedConversationId = conversationId;
  }

  const toHistory = (turn) => (row) => ({ role: row.role, content: historyContent(messageContent(turn, row)) });

  /**
   * History rows without the questions that have no current answer (it failed, was stopped before
   * any text, or the page closed mid-answer). The UI shows those as "No answer" with Ask again, so
   * the model must not see them either; it would also get [..., user, user], which some providers
   * refuse. A reply always follows its question in (created_at, rowid) order, so the window holds it.
   */
  function answeredOnly(rows) {
    const answered = new Set(rows.filter((r) => r.role === "assistant" && r.parent_id).map((r) => r.parent_id));
    return rows.filter((r) => r.role !== "user" || answered.has(r.id));
  }

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
    const conv = conversationId ? loadConversation(turn, conversationId) : newConversation();
    // Before anything is read or written: a second tab must not interleave with a running turn.
    // A new chat is locked too: its id reaches the client in the route event, while it still runs.
    lockConversation(turn, conv.id);
    turn.conv = conv;
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
    const kept = answeredOnly(rows);
    turn.history = kept.slice(Math.max(0, kept.length - historyLimit)).map(toHistory(turn));

    requireCredit(turn);
    await redactTurn(turn);

    const redactedLatest = turn.redactedMessages[turn.redactedMessages.length - 1].content;
    const c = await classifier.classify({
      text: redactedLatest,
      history: turn.redactedMessages.slice(0, -1).slice(-CLASSIFIER_CONTEXT_MESSAGES),
      redactionCounts: turn.newCounts,
      signal,
      zdrOnly: Boolean(turn.user.strict_privacy),
      // A private conversation is classified locally (no third-party classifier sees its text).
      conversationPrivate: turn.conv.private,
      euOnly: Boolean(turn.user.eu_only),
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
      conversationPrivate: turn.conv.private,
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
    // Two regenerates (or a regenerate and a switch) of one answer would both call the upstream
    // and only one could be stored: the second gets `busy` before any upstream call.
    const conv = loadConversation(turn, target.conversation_id);
    lockConversation(turn, conv.id);
    turn.conv = conv;

    const parent = target.parent_id ? q.message.get(target.parent_id) : null;
    const original = target.request_id ? q.request.get(target.request_id) : null;
    if (!parent || parent.role !== "user" || parent.conversation_id !== target.conversation_id || !original || original.user_id !== turn.user.id) {
      throw new AppError(409, "conflict", "This answer can't be redone.");
    }
    turn.target = target;
    turn.text = messageContent(turn, parent).text;
    turn.userMessageId = parent.id;
    turn.reuseUserMessage = true;
    turn.history = answeredOnly(q.messagesBefore.all(turn.conv.id, parent.created_at, parent.created_at, parent.seq, historyLimit).reverse()).map(
      toHistory(turn)
    );

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
    // Not classified again, but whoever classified the question then has read it.
    turn.readBy = q.questionClassifier.get(parent.id)?.classifier_model ?? null;
    turn.classified = true;
    turn.classifierCost = 0;
    turn.job = original.job;
    turn.pick = await picker.pick({
      job: original.job,
      difficulty: original.difficulty,
      private: Boolean(original.private),
      conversationPrivate: turn.conv.private,
      user: turn.user,
      pins: turn.conv.pins,
      overrideModelId: mode === "switch" ? modelId.trim() : null,
    });
    // A feedback signal for the learner, also when the new answer then fails upstream. Only after
    // the pick: a switch the picker refuses (a non-private model in a private chat, an unknown id)
    // changed nothing, so it must not count as the user rejecting the answer.
    (mode === "switch" ? q.markOverridden : q.markRegenerated).run(original.id);
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
    // Only our own servers get the real text (with REDACT_SELF_HOSTED off). Decided by the gateway,
    // not by the editable self_hosted flag: a mislabelled OpenRouter model still gets placeholders.
    turn.redactedSend = redactionOn && !(model.gateway === "selfhosted" && !redactSelfHosted);

    if (media) {
      await buildMediaRequest(turn, model, c);
    } else {
      const system = buildSystemPrompt({
        date: new Date(now()).toISOString().slice(0, 10),
        placeholders: turn.redactedSend && hasEntries(turn.map),
        action: turn.job === "action",
      });
      fitHistory(turn, model, system);
      const conversation = turn.redactedSend ? turn.redactedMessages : turn.realMessages;
      turn.upstreamMessages = [{ role: "system", content: system }, ...conversation];
      turn.redactions = turn.redactedSend ? turn.newCounts : {};
      turn.estimatedInputTokens = estimateTokens(turn.upstreamMessages.map((m) => m.content).join("\n"));
    }
    // The client may have left while we redacted or classified: don't hold credit or store anything.
    throwIfAborted(signal);

    const title = titleFor(turn);
    const hold = db.tx(() => {
      // Sized inside the transaction, against the balance as it is now.
      const amount = holdAmount(turn, model, media);
      const h = credits.reserve(turn.user.id, amount);
      storeQuestion(turn, title);
      return h;
    });
    turn.holdId = hold.holdId;
    turn.liveHoldId = hold.holdId;
    liveHolds.add(hold.holdId);
    turn.stored = true;

    const expectedApi = media
      ? turn.estimateApi
      : credits.estimateApiCostMicros({
          model,
          inputTokens: turn.estimatedInputTokens,
          maxOutputTokens: expectedOutputTokens(c.output?.length, pick.effort, turn.maxTokens),
        });
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
      ...classifierOf(turn),
    };
    if (title) route.title = title;
    if (turn.target) route.replaces_message_id = turn.target.id;
    // The balance only paid for a short answer, so the model thinks less (holdAmount).
    if (pick.effortLowered) route.effort_lowered = true;
    if (turn.contextIncluded) route.context_included = true;
    send("route", route);

    turn.callStartedAt = now();
    if (media) await generateMediaAnswer(turn, send, signal);
    else await streamTextAnswer(turn, send, signal);
    turn.latencyMs = now() - turn.callStartedAt;

    finish(turn, send);
  }

  /** classifierFacts for this turn's question: its own classifier, else the one that read it first. */
  function classifierOf(turn) {
    const id = turn.classification?.classifierModel || turn.readBy || null;
    return classifierFacts(id, id && id !== "heuristic" ? q.modelBrief.get(id) : null);
  }

  /**
   * The media prompt, params and unit estimate. The classifier's media_prompt (written from the
   * redacted history, so "now make a video of it" names its subject) is preferred; its placeholders
   * become neutral phrases, because media models can't round-trip them, and a second generic pass
   * catches anything personal the classifier wrote itself. Without it: the latest text, generically
   * redacted. The classifier's duration_s is snapped onto the model's allowed durations.
   */
  async function buildMediaRequest(turn, model, c) {
    const mediaPrompt = typeof c.output?.media_prompt === "string" ? c.output.media_prompt.trim() : "";
    // The classifier writes media_prompt only for a follow-up that quotes earlier messages: the
    // media provider then gets those too (genericised), which the privacy badge discloses.
    turn.contextIncluded = Boolean(mediaPrompt);
    if (turn.redactedSend) {
      const source = mediaPrompt ? genericizePlaceholders(mediaPrompt) : turn.text;
      const generic = await redactor.redactMessages([{ role: "user", content: source }], turn.map, { mode: "generic" });
      turn.prompt = generic.messages[0].content;
      turn.redactions = mediaPrompt ? addCounts(placeholderCounts(mediaPrompt), generic.counts) : generic.counts || {};
    } else {
      // Unredacted path (redaction off, or our own servers): put real values back.
      turn.prompt = mediaPrompt ? redactor.restore(mediaPrompt, turn.map) : turn.text;
      turn.redactions = {};
    }
    // A text-to-speech model with a length limit (params.max_chars) would refuse it upstream after
    // queueing: say so now, before any credit is held.
    checkMaxChars(model, turn.prompt);

    const params = {};
    const aspect = c.output?.aspect;
    if (typeof aspect === "string" && aspect) params.aspect = aspect;
    const duration = durationFor(model, c.output?.duration_s);
    if (duration !== null) params.duration = duration;
    turn.mediaParams = params;
    // The same params size the hold as go upstream, so a 20 s request holds 20 s of video.
    turn.estimateApi = credits.estimateApiCostMicros({ model, units: estimateMediaUnits(model, turn.prompt, params) });
  }

  /**
   * Drop the oldest history until the estimated input plus MAX_OUTPUT_TOKENS fits the model's
   * context window (with headroom), keeping the newest messages. Redacted and real messages are
   * index-aligned, so both are trimmed together. The latest message is never dropped: if it alone
   * does not fit, the request is refused.
   */
  function fitHistory(turn, model, system) {
    const contextLength = Number(model.context_length);
    if (!Number.isFinite(contextLength) || contextLength <= 0) return;
    const budget = Math.floor(contextLength * CONTEXT_HEADROOM) - maxOutputTokens;
    const sent = turn.redactedSend ? turn.redactedMessages : turn.realMessages;
    const cost = (m) => estimateTokens(m.content) + MESSAGE_OVERHEAD_TOKENS;
    let total = estimateTokens(system) + MESSAGE_OVERHEAD_TOKENS + sent.reduce((n, m) => n + cost(m), 0);
    let drop = 0;
    while (total > budget && drop < sent.length - 1) {
      total -= cost(sent[drop]);
      drop += 1;
    }
    // Start the kept history on a user turn: some providers reject a conversation that opens with
    // an assistant message.
    while (drop < sent.length - 1 && sent[drop].role !== "user") {
      total -= cost(sent[drop]);
      drop += 1;
    }
    if (total > budget) {
      throw new AppError(400, "bad_request", `This message is too long for ${model.label}. Shorten it or pick a model with a larger context.`);
    }
    if (!drop) return;
    turn.redactedMessages = turn.redactedMessages.slice(drop);
    turn.realMessages = turn.realMessages.slice(drop);
  }

  /**
   * The credit hold: the full estimate. A text answer the balance can't fully cover gets a lower
   * max_tokens (sent upstream) so the hold fits; below MIN_AFFORDABLE_OUTPUT_TOKENS it is refused.
   * On a reasoning model the effort is lowered too, until its reasoning allowance plus that minimum
   * fits the lower cap (the effective effort shows in the route event, the chip and the requests
   * row); when not even the model's lowest level fits, it is refused. Media must be affordable in
   * full. Runs inside the reserve transaction.
   */
  function holdAmount(turn, model, media) {
    const balance = credits.balance(turn.user.id);
    if (media) {
      const amount = credits.priceFor(turn.estimateApi + turn.classifierCost);
      if (balance > 0 && balance < amount) {
        throw new AppError(
          402,
          "insufficient_credits",
          `This costs about ${formatCost(microsToUsd(amount))} and your balance is ${formatCost(microsToUsd(balance))}. Buy credits to continue.`
        );
      }
      return amount;
    }
    turn.maxTokens = maxOutputTokens;
    if (balance > 0) {
      const affordable = credits.affordableOutputTokens({
        model,
        inputTokens: turn.estimatedInputTokens,
        maxOutputTokens,
        extraApiMicros: turn.classifierCost,
        balanceMicros: balance,
      });
      const tooLow = () =>
        new AppError(
          402,
          "insufficient_credits",
          `Your balance (${formatCost(microsToUsd(balance))}) is too low for an answer from ${model.label}. Buy credits to continue.`
        );
      if (affordable < minAffordableOutputTokens) throw tooLow();
      if (affordable < maxOutputTokens) {
        const effort = effortForCap(model, turn.pick.effort, affordable, minAffordableOutputTokens);
        if (effort === null) throw tooLow();
        // In place: answer() holds this pick object for the route event.
        if (effort !== turn.pick.effort) Object.assign(turn.pick, { effort, effortLowered: true });
      }
      turn.maxTokens = affordable;
    }
    turn.estimateApi = credits.estimateApiCostMicros({ model, inputTokens: turn.estimatedInputTokens, maxOutputTokens: turn.maxTokens });
    // balance <= 0: reserve() refuses with "out of credits".
    return credits.priceFor(turn.estimateApi + turn.classifierCost);
  }

  /**
   * The conversation's first title: the classifier's, with placeholders put back, except HIGH_RISK
   * types (card, IBAN, SSN, bank account, passport, secret), which stay masked ("•••• 0366").
   */
  function titleFor(turn) {
    if (turn.conv.hasTitle) return null;
    const raw = sanitizeTitle(turn.classification?.title || "");
    if (!raw) return null;
    return redactor.restore(raw, titleMap(turn.map)).slice(0, TITLE_MAX_CHARS).trim() || null;
  }

  /**
   * Inside the reserve transaction: the conversation (if new), the question, the map, the title,
   * and the sticky private flag. The flag is set here, not on success: a private question stays in
   * the history even when its answer fails or is stopped.
   */
  function storeQuestion(turn, title) {
    const t = now();
    const conv = turn.conv;
    const mapEnc = turn.map ? encryptJSON(turn, turn.map) : null;
    const titleEnc = title ? keyring.encrypt(turn.user.wrapped_dek, title) : null;
    const makePrivate = Boolean(turn.pick?.private);
    if (conv.isNew) {
      q.insertConversation.run(conv.id, turn.user.id, titleEnc, mapEnc, makePrivate ? 1 : 0, t, t);
    } else {
      if (!q.conversationExists.get(conv.id, turn.user.id)) throw new AppError(404, "not_found", "This conversation was deleted.");
      // The only map write of a turn: the map does not change after redaction, and the per-
      // conversation lock keeps another turn from writing in between.
      if (mapEnc && redactionOn) q.setMap.run(mapEnc, conv.id);
      if (titleEnc) q.setTitle.run(titleEnc, conv.id);
      if (makePrivate) q.setPrivate.run(conv.id);
      q.touch.run(t, conv.id);
    }
    if (makePrivate) conv.private = true;
    if (!turn.reuseUserMessage) {
      q.insertMessage.run(turn.userMessageId, conv.id, turn.user.id, "user", encryptJSON(turn, { text: turn.text }), null, null, t);
    }
  }

  async function streamTextAnswer(turn, send, signal) {
    const { model, effort, zdrRequired } = turn.pick;
    const provider = providers.get(model.gateway);
    // A model that got the real text has no placeholders to put back: restoring would only rewrite
    // a placeholder-looking string the user typed themselves.
    // maskHighRisk: a card number or key the model produced on its own is masked before any part of
    // it reaches the screen (the final filterResponse below stays the safety net for what the
    // incremental masker cannot see whole). ownMap: the user's own values are never masked, also
    // when the model got the real text (no map to restore from).
    const restorer = redactor.createStreamRestorer(turn.redactedSend ? turn.map : null, { maskHighRisk: responseFilterOn, ownMap: turn.map });
    // What the model produced (raw) and what the user was shown: a Stop is billed from raw and
    // stores what was shown.
    const streamed = { raw: "", shown: "", deltas: 0 };
    turn.streamed = streamed;
    const emitSafe = (text) => {
      if (!text) return;
      streamed.shown += text;
      send("delta", { text });
    };

    const stream = provider.streamChat({
      model,
      messages: turn.upstreamMessages,
      effort,
      maxTokens: turn.maxTokens ?? maxOutputTokens,
      zdr: Boolean(zdrRequired),
      sessionId: sessionIdFor(turn.conv.id),
      signal,
    });
    try {
      for await (const ev of stream) {
        if (ev?.type === "delta" && typeof ev.text === "string") {
          streamed.raw += ev.text;
          if (ev.text) streamed.deltas += 1;
          emitSafe(restorer.push(ev.text));
        } else if (ev?.type === "usage") {
          turn.usage = ev;
        } else if (ev?.type === "meta" && typeof ev.upstreamProvider === "string") {
          // Who got the prompt, known before the first delta: recorded even if the answer then
          // fails or is stopped (the transparency log names it).
          turn.upstreamProvider = ev.upstreamProvider;
        }
      }
    } catch (err) {
      // The restorer may still hold the end of a word (or a placeholder's start). It is part of
      // what the model produced: shown before an upstream error, stored with a stopped answer.
      // flush() restores and masks it like everything before it.
      try {
        const tail = restorer.flush();
        // Nobody is listening after a Stop: the tail only goes into the stored partial answer.
        if (signal?.aborted) streamed.shown += tail;
        else emitSafe(tail);
      } catch {
        // Keep what was shown.
      }
      throw err;
    }
    emitSafe(restorer.flush());
    // Providers throw on abort; one that just stops early without usage must not count as finished.
    if (!turn.usage && signal?.aborted) throw abortError(signal);
    if (!turn.usage) {
      // Contract breach (no usage event): bill an estimate rather than nothing.
      turn.usage = estimatedUsage(turn);
    }

    turn.answer = { text: filtered(turn, streamed.shown, send) };
  }

  /** Response filter (high-risk data the model produced on its own) on the restored text. */
  function filtered(turn, text, send) {
    if (!responseFilterOn) return text;
    const out = redactor.filterResponse(text, turn.map);
    if (!out.masked || !Object.keys(out.masked).length) return text;
    if (send) send("replace", { text: out.text });
    return out.text;
  }

  /** Usage for a stream that gave none: the estimated input and the text it streamed. */
  function estimatedUsage(turn) {
    return {
      inputTokens: turn.estimatedInputTokens || 0,
      outputTokens: estimateTokens(turn.streamed?.raw || ""),
      reasoningTokens: 0,
      costUsd: null,
      upstreamProvider: turn.upstreamProvider ?? null,
      estimated: true,
    };
  }

  async function generateMediaAnswer(turn, send, signal) {
    const { model } = turn.pick;
    const provider = providers.get(model.gateway);
    const result = await provider.generateMedia({
      model: adapterModel(model),
      job: routeJob(turn.job),
      prompt: turn.prompt,
      params: turn.mediaParams || {},
      signal,
      onProgress: (p) => {
        const data = { status: String(p?.status || "running") };
        if (Number.isInteger(p?.position)) data.position = p.position;
        // A job that started running may be billed upstream even if it is cancelled now.
        if (data.status === "running") turn.mediaRunning = true;
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
    const caption = typeof result.caption === "string" ? result.caption.trim().slice(0, CAPTION_MAX_CHARS) : "";
    // Stored with the upstream URLs; the `media` events go out after the answer is committed.
    turn.answer = { text: caption, media: items };
  }

  // ---- cost, storage, done -----------------------------------------------------------------

  /** Upstream cost of this request in micro-USD: the answer (if any usage is known) + classifier. */
  function apiCostMicros(turn, usage = turn.usage) {
    let provider = 0;
    if (turn.pick && (usage || turn.mediaResult)) {
      const cost = providerCostMicros(turn.pick.model, { usage, media: turn.mediaResult });
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
    const settled = settleAndStore(turn, { apiMicros, charged: credits.priceFor(apiMicros) });
    const media = isMediaJob(turn.job);
    const balance = settled ? settled.balance : credits.balance(turn.user.id);
    const chargedNow = settled ? settled.charged : 0;
    // Media only now, after the commit, and as links the browser can use: the stored message keeps
    // the upstream URL, the browser gets Gode's media proxy (/api/media/<message>/<i>).
    if (media) {
      // url null: a host the proxy may not fetch from (the UI says the file can't be shown).
      turn.answer.media.forEach((item, i) => send("media", { ...item, url: publicMediaUrl(config, turn.assistantMessageId, i, item.url, { logger }) }));
    }
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
   * pins and (for regenerate/switch) the superseded flag commit together or not at all.
   * Returns the settle result ({ balance, charged }), or null when the hold had vanished (nothing
   * was charged). The settle runs inside the transaction, so a failed write rolls the charge back
   * and the error path decides what to charge instead.
   */
  function settleAndStore(turn, { apiMicros, charged, status = "ok" }) {
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
        storeAnswer(turn, { apiMicros, charged: settled ? settled.charged : 0, status });
        return settled;
      });
    } catch (err) {
      // The account was deleted mid-answer (its holds and conversations went with it).
      if (!q.userExists.get(turn.user.id)) throw new AppError(404, "not_found", "Your account was deleted.");
      throw err;
    }
  }

  function storeAnswer(turn, { apiMicros, charged, status = "ok" }) {
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
    insertRequest(turn, { status, errorCode: null, apiMicros, charged, messageId: turn.assistantMessageId });

    if (turn.pick.pinsUpdate) {
      // Merge only what this pick changed, so a concurrent turn's pin for another job survives.
      const current = normalizePins(q.conversationPins.get(conv.id)?.pins);
      for (const [job, pin] of Object.entries(turn.pick.pinsUpdate)) {
        const started = conv.pins[job];
        if (sameJSON(pin, started)) continue;
        // The user's own choice (manual pick, switch) always applies. An automatic pin applies only
        // over the pin this turn started from, and never over a user pin stored in the meantime:
        // user pins never change by themselves.
        if (pin?.source !== "user" && (!sameJSON(current[job], started) || current[job]?.source === "user")) continue;
        current[job] = pin;
      }
      q.setPins.run(JSON.stringify(current), conv.id);
    }
    q.touch.run(t, conv.id);
  }

  /** The host that got the prompt: the usage event's, else the stream's meta event (or error). */
  function upstreamProviderOf(turn, usage) {
    const name = typeof usage?.upstreamProvider === "string" && usage.upstreamProvider ? usage.upstreamProvider : turn.upstreamProvider;
    return typeof name === "string" && name ? name.slice(0, 80) : null;
  }

  function insertRequest(turn, { status, errorCode, apiMicros, charged, messageId = null, usage = turn.usage }) {
    const c = turn.classification;
    const pick = turn.pick;
    const media = turn.job ? isMediaJob(turn.job) : false;
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
      $upstream_provider: upstreamProviderOf(turn, usage),
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
      $context_included: turn.contextIncluded ? 1 : 0,
      $created_at: turn.startedAt,
    });
  }

  // ---- failure -----------------------------------------------------------------------------

  /**
   * Settle the hold for `apiMicros` (capped at the hold) when the upstream produced something the
   * user received; otherwise release it. A Stop of a new answer also stores the partial text, in
   * the same transaction. Returns { charged, balance, stored }.
   */
  function billFailure(turn, { chargeable, storeStopped, apiMicros, userExists }) {
    if (!turn.holdId) return { charged: 0, balance: null, stored: false };
    const holdId = turn.holdId;
    turn.holdId = undefined;
    if (chargeable && userExists) {
      const wanted = credits.priceFor(apiMicros);
      if (storeStopped) {
        try {
          turn.holdId = holdId;
          const settled = settleAndStore(turn, { apiMicros, charged: wanted, status: "stopped" });
          turn.holdId = undefined;
          if (settled) return { charged: settled.charged, balance: settled.balance, stored: true };
          return { charged: 0, balance: null, stored: true };
        } catch (storeErr) {
          turn.holdId = undefined;
          // Not stored (the conversation was deleted meanwhile): still charge for the output.
          if (!(storeErr instanceof AppError)) log("warn", `[pipeline] ${turn.requestId}: could not store the stopped answer (${storeErr?.code || storeErr?.name || "error"})`);
        }
      }
      try {
        const settled = credits.settle(holdId, wanted, turn.requestId);
        return { charged: settled.charged, balance: settled.balance, stored: false };
      } catch (billingErr) {
        if (!(billingErr instanceof AppError && billingErr.code === "conflict")) {
          log("warn", `[pipeline] ${turn.requestId}: billing cleanup failed (${billingErr?.code || billingErr?.name || "error"})`);
        }
      }
    }
    try {
      credits.release(holdId);
    } catch (billingErr) {
      // Nothing left to refund (hold already gone with the account).
      if (userExists) log("warn", `[pipeline] ${turn.requestId}: billing cleanup failed (${billingErr?.code || billingErr?.name || "error"})`);
    }
    return { charged: 0, balance: null, stored: false };
  }

  function fail(turn, err, send, signal) {
    const aborted = Boolean(signal?.aborted) || err?.name === "AbortError";
    const shutdown = aborted && isShutdownReason(signal?.reason ?? err);
    const known = !aborted && err instanceof AppError;
    const code = aborted ? (shutdown ? "interrupted" : "aborted") : known ? err.code : "internal";
    const message = aborted ? (shutdown ? SHUTDOWN_MESSAGE : "Stopped.") : known ? err.message : "Something went wrong.";
    const userExists = Boolean(turn.user && q.userExists.get(turn.user.id));
    // An upstream error names the host once it had the prompt (never on our own abort).
    if (!turn.upstreamProvider && typeof err?.extra?.upstreamProvider === "string") turn.upstreamProvider = err.extra.upstreamProvider;

    // What the upstream produced: reported usage or a finished media job, else (text) the deltas
    // that reached the user, estimated as input sent + streamed text.
    const streamedOutput = Boolean(turn.streamed && turn.streamed.deltas > 0);
    const finishedUpstream = Boolean(turn.usage || turn.mediaResult);
    const usage = turn.usage || (streamedOutput ? estimatedUsage(turn) : null);
    let apiMicros = apiCostMicros(turn, usage);
    // A media job that ended unfinished after the provider started it is billed upstream. The
    // adapter knows best (fal's answer to the cancel: err.upstreamBilled); one that can't tell is
    // taken at its word that the job was running.
    const mediaCall = isMediaJob(turn.job) && Boolean(turn.callStartedAt) && !turn.mediaResult;
    const mediaBilled = mediaCall && turn.estimateApi > 0 && (typeof err?.upstreamBilled === "boolean" ? err.upstreamBilled : Boolean(turn.mediaRunning));
    if (mediaBilled) apiMicros += turn.estimateApi;

    // Who pays: a Stop after output pays for that output, and a Stop of a media job the provider
    // had started pays for the job; an answer that finished upstream but failed to store (deleted
    // chat, conflict) is paid; errors, shutdowns and early stops are free.
    const stopped = aborted && !shutdown && (streamedOutput || mediaBilled);
    const chargeable = stopped || (!aborted && finishedUpstream);
    if (stopped && streamedOutput && !turn.usage) turn.usage = usage;
    if (stopped && !turn.target) {
      turn.answer = streamedOutput ? { text: filtered(turn, turn.streamed.shown), stopped: true } : { text: "", media: [], stopped: true };
    }
    const bill = billFailure(turn, { chargeable, storeStopped: stopped && !turn.target, apiMicros, userExists });

    let requestLogged = bill.stored;
    if (!bill.stored && turn.classified && userExists) {
      try {
        if (turn.callStartedAt && turn.latencyMs === undefined) turn.latencyMs = now() - turn.callStartedAt;
        insertRequest(turn, { status: stopped ? "stopped" : "error", errorCode: stopped ? null : code, apiMicros, charged: bill.charged, usage });
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
    if (stopped) {
      data.stopped = true;
      if (bill.stored) data.message_id = turn.assistantMessageId;
    }
    // Whenever something was charged, say what (the live chip would otherwise show only "est.").
    if (stopped || bill.charged > 0) {
      data.cost_usd = microsToUsd(bill.charged);
      if (userExists) data.balance_usd = microsToUsd(bill.balance ?? credits.balance(turn.user.id));
    }
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
    } finally {
      if (turn.lockedConversationId) busyConversations.delete(turn.lockedConversationId);
      if (turn.liveHoldId) liveHolds.delete(turn.liveHoldId);
    }
  }

  /** Credit holds of turns still running in this process (the stale-hold sweep skips them). */
  function activeHoldIds() {
    return [...liveHolds];
  }

  return { run, activeHoldIds };
}

module.exports = {
  createPipeline,
  formatChip,
  formatCost,
  chipFor,
  classifierFacts,
  sessionIdFor,
  effortForCap,
  buildSystemPrompt,
  historyContent,
  estimateMediaUnits,
  expectedOutputTokens,
  providerCostMicros,
  PLACEHOLDER_NOTE,
  MODES,
};
