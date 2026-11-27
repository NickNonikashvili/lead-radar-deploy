// Shared client for OpenAI-style /chat/completions upstreams (OpenRouter, OpenAI direct, self-hosted
// vLLM/Ollama/TGI): SSE parsing, usage accounting, JSON completions and error mapping.
//
// Privacy rules enforced here for every text gateway:
// - Messages are rebuilt as { role, content } so no stray field (ids, user ids) can leak upstream.
// - No `user` field is ever sent (pooled identity: upstreams see Gode, not the person).
// - Upstream error bodies never reach our error messages verbatim: they can quote prompt text or
//   key fragments ("Incorrect API key provided: sk-..."), so only a sanitised, truncated summary is kept.
const { AppError, estimateTokens } = require("../util");
const { resolveEffort } = require("./effort-map");

const MAX_SSE_BUFFER = 1024 * 1024; // a single SSE line larger than this is a broken upstream
const MAX_JSON_BODY = 2 * 1024 * 1024; // non-stream completions and error bodies
const MAX_ERROR_BODY = 64 * 1024;
const MESSAGE_ROLES = new Set(["system", "developer", "user", "assistant"]);

/**
 * JSON.parse that returns undefined on failure. (util.safeJsonParse can't express "failed": its
 * fallback parameter defaults to null when undefined is passed, and null is valid JSON.)
 */
function parseJSON(text) {
  if (typeof text !== "string" || text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Errors

const STATUS_PHRASES = {
  400: "rejected the request",
  401: "authentication failed",
  402: "insufficient upstream credits",
  403: "request refused",
  404: "model or endpoint not found",
  408: "timed out",
  413: "request too large",
  422: "invalid input",
  429: "rate limited",
  499: "request cancelled",
  500: "internal error",
  502: "model unavailable",
  503: "no provider available",
  504: "timed out",
  524: "timed out",
  529: "overloaded",
};
// Upstream error types that say more than their HTTP status (OpenAI reports an exhausted credit
// balance as 429 insufficient_quota, which is not a rate limit: waiting won't fix it).
const TYPE_PHRASES = {
  insufficient_quota: "insufficient upstream credits",
  payment_required: "insufficient upstream credits",
  context_length_exceeded: "prompt too long for this model",
  content_policy_violation: "request refused by the model provider",
  refusal: "request refused by the model provider",
  provider_overloaded: "overloaded",
};
// STATUS_PHRASES speaks OpenRouter ("no provider available"); gateways that are a single service
// get their own wording for the statuses where that reads wrong.
const GATEWAY_STATUS_PHRASES = {
  fal: { 502: "service unavailable", 503: "service unavailable" },
  selfhosted: { 502: "server unavailable", 503: "server unavailable" },
};
// Statuses where the upstream's own wording helps an operator fix the request (bad parameter,
// unsupported effort, ...). Auth/billing/policy failures get a fixed phrase only.
const DETAIL_STATUSES = new Set([400, 404, 413, 422]);
// Answers that mean "the server is not serving right now" rather than "this request is wrong".
const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);
// Our own stream deadlines (config.gateways.timeouts); these defaults apply to hand-built configs.
const DEFAULT_FIRST_BYTE_MS = 120_000;
const DEFAULT_IDLE_MS = 90_000;
// High reasoning efforts may think for minutes before the first token on gateways that stream no
// reasoning (OpenAI chat completions), so their first-byte budget is stretched.
const EFFORT_FIRST_BYTE_FACTOR = { high: 2, xhigh: 3, max: 4 };
const TIMEOUT_MESSAGE = "The model took too long to respond.";

/** Strip anything that could be a secret, personal data or quoted prompt text; keep it short. */
function sanitizeUpstreamMessage(message) {
  if (typeof message !== "string") return "";
  let s = message.replace(/\s+/g, " ").trim();
  s = s
    .replace(/\b(?:sk|rk|pk)[-_][A-Za-z0-9_*.-]{4,}/g, "[key]")
    .replace(/\b(Bearer|Key)\s+\S+/gi, "$1 [key]")
    .replace(/[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/[A-Za-z0-9+/=_-]{32,}/g, "[...]")
    .replace(/(["'`])[^"'`]{40,}\1/g, "$1...$1");
  return s.length > 160 ? `${s.slice(0, 157)}...` : s;
}

/** Only identifier-like upstream error types are kept ("rate_limit_exceeded", "invalid_request"). */
function safeType(type) {
  return typeof type === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(type) ? type : null;
}

/**
 * The one error every gateway throws for upstream failures.
 * @param {string} gateway
 * @param {{ status?: number|null, message?: string, type?: string, retryAfter?: string|null }} info
 */
function upstreamError(gateway, { status = null, message, type, retryAfter = null } = {}) {
  const t = safeType(type);
  const detail = !status || DETAIL_STATUSES.has(status) ? sanitizeUpstreamMessage(message) : "";
  const statusPhrase = GATEWAY_STATUS_PHRASES[gateway]?.[status] || STATUS_PHRASES[status];
  const phrase = detail || (t && TYPE_PHRASES[t]) || statusPhrase || "request failed";
  const meta = [status ? String(status) : null, t].filter(Boolean).join(", ");
  const extra = { upstreamStatus: status || null, upstreamType: t };
  if (retryAfter) extra.retryAfter = String(retryAfter).slice(0, 32);
  return new AppError(502, "upstream_error", `${gateway}: ${phrase}${meta ? ` (${meta})` : ""}`, extra);
}

/** Pull { message, type, code } out of the error shapes OpenAI, OpenRouter and fal use. */
function describeErrorBody(body) {
  if (body === null || body === undefined) return {};
  if (typeof body === "string") return { message: body };
  const e = body.error ?? body.choices?.[0]?.error ?? null;
  if (typeof e === "string") return { message: e, type: body.error_type ?? body.type };
  if (e && typeof e === "object") {
    return {
      message: typeof e.message === "string" ? e.message : undefined,
      type: e.metadata?.error_type ?? e.type ?? (typeof e.code === "string" ? e.code : undefined),
      code: typeof e.code === "number" ? e.code : undefined,
    };
  }
  // fal: {"detail": "..."} or {"detail": [{loc, msg, type}]} (422 validation errors).
  if (typeof body.detail === "string") return { message: body.detail, type: body.error_type ?? body.type };
  if (Array.isArray(body.detail)) {
    const first = body.detail[0] || {};
    const field = Array.isArray(first.loc) ? first.loc.filter((p) => p !== "body").join(".") : "";
    return { message: [field, first.msg].filter(Boolean).join(": "), type: first.type };
  }
  return {};
}

function notConfigured(gateway) {
  return new AppError(503, "gateway_not_configured", `${gateway}: gateway not configured`);
}

/** The error to rethrow when the caller's signal aborted: its reason, or a standard AbortError. */
function abortReason(signal) {
  if (signal?.reason !== undefined) return signal.reason;
  return new DOMException("This operation was aborted", "AbortError");
}

/** Our own deadline fired: an upstream failure the pipeline reports and does not charge for. */
function timeoutError(gateway, kind) {
  return new AppError(502, "upstream_error", TIMEOUT_MESSAGE, { upstreamStatus: null, upstreamType: "timeout", timeout: kind, gateway });
}

// ---------------------------------------------------------------------------------------------
// Deadlines

/** Milliseconds from config.gateways.timeouts; 0 (or negative) switches that deadline off. */
function timeoutMs(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

/**
 * First-byte and idle deadlines for one upstream call, as an AbortSignal to combine with the
 * caller's. The first-byte timer runs from the request until the first data payload; after that
 * the idle timer covers each wait for the next one. Only data payloads count: keepalive comments
 * (": OPENROUTER PROCESSING") would otherwise keep a hung upstream alive forever.
 * pause()/resume() stop the clock while the consumer handles a yielded event, so a slow consumer
 * is never blamed on the upstream. Timers are ref'd (unlike AbortSignal.timeout) so a script
 * waiting on a hung upstream ends with this error instead of exiting early; clear() must run when
 * the call ends.
 */
function createDeadline({ firstByteMs, idleMs }) {
  const ctl = new AbortController();
  let timer = null;
  let kind = null;
  let gotData = false;
  let firstLeft = firstByteMs; // first-byte budget not yet used, kept across pauses
  let armedAt = 0;
  const stop = () => {
    if (timer) {
      clearTimeout(timer);
      if (!gotData) firstLeft = Math.max(1, firstLeft - (Date.now() - armedAt));
    }
    timer = null;
  };
  const arm = (ms, k) => {
    stop();
    if (!(ms > 0) || kind) return;
    armedAt = Date.now();
    timer = setTimeout(() => {
      timer = null;
      kind = k;
      ctl.abort(new DOMException(`upstream ${k} deadline`, "TimeoutError"));
    }, ms);
  };
  const resume = () => (gotData ? arm(idleMs, "idle") : arm(firstLeft, "first_byte"));
  resume();
  return {
    signal: ctl.signal,
    /** 'first_byte' | 'idle' once fired, else null. */
    get kind() {
      return kind;
    },
    /** A data payload arrived: the clock stops until resume(). */
    data() {
      stop();
      gotData = true;
    },
    pause: stop,
    resume,
    clear: stop,
  };
}

const combineSignals = (signal, other) => (signal ? AbortSignal.any([signal, other]) : other);

// ---------------------------------------------------------------------------------------------
// HTTP

/** fetch that maps network failures to upstream_error and keeps aborts as aborts. */
async function send(gateway, url, init, signal) {
  if (signal?.aborted) throw abortReason(signal);
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (signal?.aborted) throw abortReason(signal);
    const code = err?.cause?.code || err?.code;
    throw new AppError(502, "upstream_error", `${gateway}: network error`, {
      upstreamStatus: null,
      networkCode: typeof code === "string" ? code : null,
    });
  }
}

/**
 * Read a response body as text without buffering more than `limit` bytes. Over the limit it throws
 * (gateway known) or, with `truncate`, returns the first `limit` bytes (enough for error bodies).
 */
async function readTextLimited(res, limit, { truncate = false, gateway = "upstream" } = {}) {
  if (!res.body) return "";
  const decoder = new TextDecoder();
  let out = "";
  let bytes = 0;
  for await (const chunk of res.body) {
    bytes += chunk.byteLength;
    if (bytes > limit) {
      // Leaving the loop cancels the rest of the body.
      if (!truncate) throw upstreamError(gateway, { message: "response too large" });
      out += decoder.decode(chunk.subarray(0, chunk.byteLength - (bytes - limit)), { stream: true });
      break;
    }
    out += decoder.decode(chunk, { stream: true });
  }
  return out + decoder.decode();
}

/** Throw a mapped upstream_error for any non-2xx response. */
async function ensureOk(gateway, res, signal) {
  if (res.ok) return;
  let text = "";
  try {
    text = await readTextLimited(res, MAX_ERROR_BODY, { truncate: true });
  } catch {
    if (signal?.aborted) throw abortReason(signal);
    // The status alone is enough to report; a broken error body must not mask it.
  }
  const info = describeErrorBody(parseJSON(text) ?? null);
  throw upstreamError(gateway, { ...info, status: res.status, retryAfter: res.headers.get("retry-after") });
}

/**
 * JSON request helper shared by the image and fal clients.
 * @returns {Promise<{ status: number, json: any, headers: Headers }>}
 */
async function requestJSON(gateway, url, { method = "GET", headers = {}, body, signal, okStatuses, maxBytes = MAX_JSON_BODY, onResponse } = {}) {
  const init = { method, headers: { Accept: "application/json", ...headers } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await send(gateway, url, init, signal);
  if (onResponse) onResponse(res);
  const accepted = okStatuses ? okStatuses.includes(res.status) : res.ok;
  if (!accepted) {
    if (res.ok) {
      // A 2xx we did not expect (e.g. 201 from a misbehaving server): report it, don't guess.
      await res.body?.cancel().catch(() => {});
      throw upstreamError(gateway, { status: res.status, message: "unexpected response status" });
    }
    await ensureOk(gateway, res, signal);
  }
  let text;
  try {
    text = await readTextLimited(res, maxBytes, { gateway });
  } catch (err) {
    if (signal?.aborted) throw abortReason(signal);
    if (err instanceof AppError) throw err;
    // `interrupted`: the connection broke mid-body, which a retry may fix (fal polling).
    throw new AppError(502, "upstream_error", `${gateway}: response interrupted`, { upstreamStatus: res.status, interrupted: true });
  }
  const json = parseJSON(text);
  if (json === undefined) throw upstreamError(gateway, { message: "response was not JSON" });
  return { status: res.status, json, headers: res.headers };
}

// ---------------------------------------------------------------------------------------------
// SSE

function nextLineBreak(buf) {
  const m = /\r\n|\r|\n/.exec(buf);
  if (!m) return null;
  // A trailing '\r' may be the first half of a '\r\n' split across network chunks: wait for more.
  if (m[0] === "\r" && m.index === buf.length - 1) return null;
  return m;
}

/**
 * Parse a byte stream of Server-Sent Events into the `data` payload of each event.
 * Handles comment lines (": OPENROUTER PROCESSING"), multi-line data, CR/LF/CRLF line endings and
 * events split at arbitrary byte boundaries.
 * @param {AsyncIterable<Uint8Array>} body
 * @returns {AsyncGenerator<string>}
 */
async function* readSSE(body) {
  const decoder = new TextDecoder();
  let buf = "";
  let data = [];
  const takeLines = function* () {
    let m;
    while ((m = nextLineBreak(buf))) {
      const line = buf.slice(0, m.index);
      buf = buf.slice(m.index + m[0].length);
      yield line;
    }
  };
  const onLine = (line) => {
    if (line === "") {
      const payload = data.length ? data.join("\n") : null;
      data = [];
      return payload;
    }
    if (line.startsWith(":")) return null; // keepalive comment
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") data.push(value);
    return null; // event/id/retry fields carry nothing we use
  };

  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    for (const line of takeLines()) {
      const payload = onLine(line);
      if (payload !== null) yield payload;
    }
    if (buf.length > MAX_SSE_BUFFER) throw new Error("SSE line too long");
  }
  buf += decoder.decode();
  // Lenient end of stream: a final event without its blank line still counts.
  if (buf) buf += "\n";
  for (const line of takeLines()) {
    const payload = onLine(line);
    if (payload !== null) yield payload;
  }
  const last = onLine("");
  if (last !== null) yield last;
}

// ---------------------------------------------------------------------------------------------
// Chat completions

/** Rebuild messages as plain { role, content } so nothing but the text leaves Gode. */
function toWireMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError("messages must be a non-empty array");
  }
  return messages.map((m, i) => {
    if (!m || !MESSAGE_ROLES.has(m.role)) throw new TypeError(`messages[${i}].role is invalid`);
    if (typeof m.content !== "string") throw new TypeError(`messages[${i}].content must be a string`);
    return { role: m.role, content: m.content };
  });
}

function positiveInt(n) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : null;
}

function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((p) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : "")).join("");
  }
  return "";
}

/** Fold one chunk (or a whole non-stream completion) into `state`; returns visible text, if any. */
function applyChunk(gateway, state, chunk) {
  if (!chunk || typeof chunk !== "object") throw upstreamError(gateway, { message: "malformed stream chunk" });
  if (chunk.error) {
    // OpenRouter: once the 200 is committed, failures arrive as a chunk with a top-level error.
    const info = describeErrorBody(chunk);
    throw upstreamError(gateway, { message: info.message, type: info.type, status: info.code ?? null });
  }
  if (typeof chunk.provider === "string" && chunk.provider) state.provider = chunk.provider;
  if (typeof chunk.model === "string" && chunk.model) state.model = chunk.model;
  if (chunk.usage && typeof chunk.usage === "object") state.usage = chunk.usage;
  const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : null;
  if (!choice) return "";
  if (choice.error) {
    const info = describeErrorBody({ error: choice.error });
    throw upstreamError(gateway, { message: info.message, type: info.type, status: info.code ?? null });
  }
  if (choice.finish_reason) {
    state.finish = choice.finish_reason;
    if (choice.finish_reason === "error") throw upstreamError(gateway, { message: "generation failed" });
  }
  const part = choice.delta ?? choice.message ?? {};
  // Reasoning deltas (part.reasoning / reasoning_content) are deliberately dropped: Gode shows answers only.
  let text = contentText(part.content);
  // A model-authored refusal is not an error; show it so the person knows why there is no answer.
  if (!text && typeof part.refusal === "string") text = part.refusal;
  state.outChars += text.length;
  return text;
}

function usageEvent(state, messages, defaultUpstreamProvider) {
  const u = state.usage || {};
  const inputTokens = numOrNull(u.prompt_tokens);
  const outputTokens = numOrNull(u.completion_tokens);
  return {
    type: "usage",
    // When an upstream reports nothing (some self-hosted servers), estimate so billing still works.
    inputTokens: inputTokens ?? estimateTokens(messages.map((m) => m.content).join("\n")),
    outputTokens: outputTokens ?? Math.ceil(state.outChars / 4),
    reasoningTokens: numOrNull(u.completion_tokens_details?.reasoning_tokens) ?? 0,
    cachedTokens: numOrNull(u.prompt_tokens_details?.cached_tokens) ?? 0,
    costUsd: numOrNull(u.cost),
    upstreamProvider: state.provider ?? defaultUpstreamProvider ?? null,
    modelReported: state.model ?? null,
    estimated: inputTokens === null || outputTokens === null,
  };
}

/** A network error from send(): nothing reached the upstream, or its server is not there. */
function isNetworkError(err) {
  return err instanceof AppError && err.code === "upstream_error" && Boolean(err.extra) && "networkCode" in err.extra;
}

/** Record which host got the prompt on an upstream error (never on the caller's abort reason). */
function withUpstreamProvider(err, provider) {
  if (provider && err instanceof AppError && err.code === "upstream_error") {
    err.extra = { ...(err.extra || {}), upstreamProvider: provider };
  }
  return err;
}

const noHealth = { ok() {}, fail() {} };

/**
 * Stream a chat completion. Yields:
 *   { type:'meta', upstreamProvider }  as soon as the host that got the prompt is known (the
 *                                      gateway default once the upstream accepted the request, or
 *                                      the first chunk's `provider` on OpenRouter), and again only
 *                                      if a later chunk names a different one
 *   { type:'delta', text }
 *   exactly one { type:'usage', ... }, last
 * Aborts rethrow the signal's reason; every other failure is AppError(502, 'upstream_error'), with
 * extra.upstreamProvider once that is known. Our own first-byte/idle deadlines give the message
 * "The model took too long to respond." (extra.timeout 'first_byte' | 'idle').
 * `health.fail()` is called when the server did not serve at all (network error, 502/503/504, no
 * data before the first-byte deadline) and `health.ok()` when it answered 2xx.
 */
async function* streamChatCompletion({ gateway, url, headers, body, signal, defaultUpstreamProvider = null, timeouts = {}, health = noHealth }) {
  const deadline = createDeadline({
    firstByteMs: timeoutMs(timeouts.firstByteMs, DEFAULT_FIRST_BYTE_MS),
    idleMs: timeoutMs(timeouts.idleMs, DEFAULT_IDLE_MS),
  });
  const combined = combineSignals(signal, deadline.signal);
  const state = { usage: null, provider: null, model: null, finish: null, outChars: 0, done: false };
  let reported = null; // last upstreamProvider sent as a meta event
  let res = null;
  const meta = (provider) => {
    reported = provider;
    return { type: "meta", upstreamProvider: provider };
  };

  try {
    try {
      res = await send(
        gateway,
        url,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(body),
        },
        combined
      );
    } catch (err) {
      if (isNetworkError(err)) health.fail();
      throw err;
    }
    if (!res.ok && UNAVAILABLE_STATUSES.has(res.status)) health.fail();
    await ensureOk(gateway, res, combined);
    health.ok();
    // The upstream accepted the prompt: gateways with one known host can say so right away.
    if (defaultUpstreamProvider) {
      deadline.pause();
      yield meta(defaultUpstreamProvider);
      deadline.resume();
    }

    if ((res.headers.get("content-type") || "").includes("application/json")) {
      // Some servers ignore stream:true (or put an error in a 200 JSON body).
      const json = parseJSON(await readTextLimited(res, MAX_JSON_BODY, { gateway }));
      deadline.data();
      if (json === undefined) throw upstreamError(gateway, { message: "response was not JSON" });
      if (typeof json.provider === "string" && json.provider && json.provider !== reported) yield meta(json.provider);
      const text = applyChunk(gateway, state, json);
      if (text) yield { type: "delta", text };
      state.done = true;
    } else {
      for await (const data of readSSE(res.body)) {
        deadline.data();
        if (data.trim() === "[DONE]") {
          state.done = true;
          break;
        }
        const chunk = parseJSON(data);
        if (chunk === undefined) throw upstreamError(gateway, { message: "malformed stream chunk" });
        // Before applyChunk: an error chunk names its provider too, and the pipeline should know
        // who got the prompt even when the stream fails right here.
        if (typeof chunk.provider === "string" && chunk.provider && chunk.provider !== reported) yield meta(chunk.provider);
        const text = applyChunk(gateway, state, chunk);
        if (text) yield { type: "delta", text };
        deadline.resume();
      }
    }
  } catch (err) {
    if (signal?.aborted) throw abortReason(signal);
    // Once the upstream answered (or we waited on it past a deadline) it had the prompt.
    const provider = res || deadline.kind ? (state.provider ?? reported ?? defaultUpstreamProvider) : null;
    if (deadline.kind) {
      // No data at all before the deadline: the server is not serving (overloaded or hung).
      if (deadline.kind === "first_byte") health.fail();
      throw withUpstreamProvider(timeoutError(gateway, deadline.kind), provider);
    }
    if (err instanceof AppError) throw withUpstreamProvider(err, provider);
    throw withUpstreamProvider(new AppError(502, "upstream_error", `${gateway}: stream interrupted`, { upstreamStatus: res?.status ?? null }), provider);
  } finally {
    deadline.clear();
  }
  // A body that just stops (no [DONE], no finish_reason) was cut off, not finished.
  if (!state.done && !state.finish) {
    throw withUpstreamProvider(upstreamError(gateway, { message: "stream ended unexpectedly" }), state.provider ?? defaultUpstreamProvider);
  }
  yield usageEvent(state, body.messages, defaultUpstreamProvider);
}

/** Lenient JSON extraction from model output: code fences, <think> blocks, prose around the object. */
function parseJsonLoose(text) {
  let t = String(text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const fence = /```[A-Za-z]*\s*([\s\S]*?)```/.exec(t);
  if (fence) t = fence[1].trim();
  const direct = parseJSON(t);
  if (direct !== undefined) return direct;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) return parseJSON(t.slice(start, end + 1));
  return undefined;
}

/** response_format for completeJSON: json_schema when a schema is given, else json_object. */
function responseFormat(schema) {
  if (!schema) return { type: "json_object" };
  if (typeof schema !== "object") throw new TypeError("schema must be an object");
  // Accept either a bare JSON Schema or the wrapper { name, schema, strict }.
  const wrapped = schema.schema && typeof schema.schema === "object";
  const name = String((wrapped && schema.name) || "gode_result").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return {
    type: "json_schema",
    json_schema: { name, strict: wrapped ? Boolean(schema.strict) : false, schema: wrapped ? schema.schema : schema },
  };
}

/**
 * Non-streaming JSON completion. Returns { json, text, usage: { inputTokens, outputTokens, costUsd } }.
 * A non-stream answer has no bytes until it is complete, so the first-byte deadline covers the whole
 * generation and the idle deadline the body. `health` as for streamChatCompletion.
 */
async function completeChatJSON({ gateway, url, headers, body, signal, timeouts = {}, health = noHealth }) {
  const deadline = createDeadline({
    firstByteMs: timeoutMs(timeouts.firstByteMs, DEFAULT_FIRST_BYTE_MS),
    idleMs: timeoutMs(timeouts.idleMs, DEFAULT_IDLE_MS),
  });
  let res;
  try {
    ({ json: res } = await requestJSON(gateway, url, {
      method: "POST",
      headers,
      body,
      signal: combineSignals(signal, deadline.signal),
      onResponse: (r) => {
        if (r.ok) health.ok();
        else if (UNAVAILABLE_STATUSES.has(r.status)) health.fail();
        deadline.data(); // headers are the first byte; the body gets the idle budget
        deadline.resume();
      },
    }));
  } catch (err) {
    if (signal?.aborted) throw abortReason(signal);
    if (deadline.kind) {
      if (deadline.kind === "first_byte") health.fail();
      throw timeoutError(gateway, deadline.kind);
    }
    if (isNetworkError(err)) health.fail();
    throw err;
  } finally {
    deadline.clear();
  }
  const state = { usage: null, provider: null, model: null, finish: null, outChars: 0 };
  const text = applyChunk(gateway, state, res);
  if (!text && state.finish === "length") {
    throw upstreamError(gateway, { message: "output token limit reached before any answer" });
  }
  const json = parseJsonLoose(text);
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw upstreamError(gateway, { message: "model did not return a JSON object" });
  }
  const u = state.usage || {};
  return {
    json,
    text,
    usage: {
      inputTokens: numOrNull(u.prompt_tokens) ?? estimateTokens(body.messages.map((m) => m.content).join("\n")),
      outputTokens: numOrNull(u.completion_tokens) ?? estimateTokens(text),
      costUsd: numOrNull(u.cost),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Provider skeleton

/**
 * Build a text Provider for an OpenAI-compatible upstream.
 * @param {object} spec
 * @param {string} spec.name
 * @param {() => boolean} spec.configured
 * @param {() => string} spec.baseUrl                 e.g. https://openrouter.ai/api/v1
 * @param {() => Record<string,string>} spec.headers  auth + attribution headers
 * @param {(args: object, effort: string|null) => object} [spec.chatFields]  gateway-specific body fields
 * @param {(args: object, effort: string|null) => object} [spec.jsonFields]
 * @param {boolean} [spec.maxTokensLegacy]            send max_tokens instead of max_completion_tokens
 * @param {string|null} [spec.defaultUpstreamProvider]
 * @param {() => {firstByteMs?: number, idleMs?: number}} [spec.timeouts]  config.gateways.timeouts
 * @param {() => number} [spec.outageRetryMs]  > 0: after the server failed to serve (network error,
 *   502/503/504, first-byte timeout) available() is false for this long. For single-server
 *   gateways only (self-hosted): one failure there means the server is down, while on OpenRouter
 *   it would only mean one route had a bad moment.
 */
function createChatProvider(spec) {
  const { name } = spec;
  const maxField = spec.maxTokensLegacy ? "max_tokens" : "max_completion_tokens";
  let downUntil = 0;
  const health = {
    ok() {
      downUntil = 0;
    },
    fail() {
      const ms = Number(spec.outageRetryMs ? spec.outageRetryMs() : 0);
      if (ms > 0) downUntil = Date.now() + ms;
    },
  };
  const isDown = () => downUntil > Date.now();
  const timeouts = () => (spec.timeouts && spec.timeouts()) || {};

  function requireConfigured() {
    if (!spec.configured()) throw notConfigured(name);
  }

  function requireModel(model) {
    if (!model || typeof model.slug !== "string" || !model.slug) throw new TypeError("model.slug is required");
  }

  return {
    name,
    configured: () => Boolean(spec.configured()),
    /** Configured and not marked down after a failure to serve (see spec.outageRetryMs). */
    available: () => Boolean(spec.configured()) && !isDown(),
    /** Epoch ms until which the server counts as down, or 0. */
    downUntil: () => (isDown() ? downUntil : 0),

    async *streamChat(args = {}) {
      const { model, messages, effort, maxTokens, signal } = args;
      requireConfigured();
      requireModel(model);
      const body = { model: model.slug, messages: toWireMessages(messages), stream: true };
      const max = positiveInt(maxTokens);
      if (max) body[maxField] = max;
      const resolved = resolveEffort(model, effort);
      Object.assign(body, spec.chatFields ? spec.chatFields(args, resolved) : {});
      const t = timeouts();
      const firstByteMs = timeoutMs(t.firstByteMs, DEFAULT_FIRST_BYTE_MS) * (EFFORT_FIRST_BYTE_FACTOR[resolved] || 1);
      yield* streamChatCompletion({
        gateway: name,
        url: `${spec.baseUrl()}/chat/completions`,
        headers: spec.headers(),
        body,
        signal,
        defaultUpstreamProvider: spec.defaultUpstreamProvider ?? null,
        timeouts: { firstByteMs, idleMs: t.idleMs },
        health,
      });
    },

    async completeJSON(args = {}) {
      const { model, system, user, maxTokens = 300, schema, signal } = args;
      requireConfigured();
      requireModel(model);
      if (typeof user !== "string" || !user) throw new TypeError("completeJSON: user must be a non-empty string");
      let sys = typeof system === "string" ? system : "";
      // OpenAI's json_object mode 400s unless the word "JSON" appears in the messages.
      if (!/json/i.test(sys + user)) sys = `${sys}${sys ? "\n" : ""}Reply with a single JSON object.`;
      const body = {
        model: model.slug,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        stream: false,
        [maxField]: positiveInt(maxTokens) || 300,
        response_format: responseFormat(schema),
      };
      // Classification and judging need no deliberation: the lowest effort the model allows.
      Object.assign(body, spec.jsonFields ? spec.jsonFields(args, resolveEffort(model, "none")) : {});
      return completeChatJSON({
        gateway: name,
        url: `${spec.baseUrl()}/chat/completions`,
        headers: spec.headers(),
        body,
        signal,
        timeouts: timeouts(),
        health,
      });
    },

    async generateMedia() {
      throw new AppError(400, "bad_request", `${name}: media generation is not supported on this gateway`);
    },
  };
}

module.exports = {
  createChatProvider,
  streamChatCompletion,
  completeChatJSON,
  readSSE,
  requestJSON,
  send,
  ensureOk,
  readTextLimited,
  toWireMessages,
  parseJsonLoose,
  parseJSON,
  responseFormat,
  upstreamError,
  describeErrorBody,
  sanitizeUpstreamMessage,
  notConfigured,
  abortReason,
  positiveInt,
  createDeadline,
  TIMEOUT_MESSAGE,
};
