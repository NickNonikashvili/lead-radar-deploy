// One local HTTP server that emulates every upstream Gode talks to, for tests. Shared by all test
// files: keep scenarios backward compatible.
//
//   const { startMockUpstream } = require("./helpers/mock-upstream");
//   const up = await startMockUpstream();
//   const config = loadConfig({ ...up.env, OPENROUTER_API_KEY: "sk-or-test", GODE_MOCK: "0" });
//   ...
//   up.requests            // every request: { method, path, query, url, headers, body, rawBody, at,
//                          //   closedEarly /* the client hung up before the answer ended */ }
//   up.find("/chat/completions")  // requests whose path contains the fragment; up.last(fragment)
//   up.setScenario("chat_midstream_error")            // a preset, or
//   up.setScenario({ chat: { mode: "error", status: 429 } })  // overrides merged over "ok"
//   up.setScenario({ name: "chat_slow", chat: { delayMs: 5 } }) // preset + overrides
//   up.reset()             // clear recorded requests, fal state and scenario
//   await up.close()
//
// Base URLs (up.urls / up.env). up.env holds only overrides that enable nothing on their own
// (gateways still need keys), plus a fast fal poll interval. Opt in to the others explicitly:
//   OPENROUTER_BASE_URL / OPENAI_BASE_URL = up.urls.v1          (= `${up.url}/v1`)
//   SELFHOSTED_BASE_URL  = up.urls.selfhosted (= `${up.url}/v1`; setting it CONFIGURES self-hosted)
//   FAL_QUEUE_BASE_URL   = up.urls.fal        (= `${up.url}/fal`)
//   PRESIDIO_ANALYZER_URL = up.urls.presidio  (= up.url; setting it ENABLES Presidio)
//   STRIPE_API_BASE      = up.urls.stripe     (= up.url)
//
// Endpoints:
//   POST /v1/chat/completions   OpenAI-compatible. stream:true -> SSE with ": OPENROUTER PROCESSING"
//        keepalive comments, a role chunk, a reasoning delta (must be ignored), content deltas whose
//        lines are split across network writes (one event uses CRLF), a finish chunk, a usage chunk
//        (usage.cost + completion_tokens_details.reasoning_tokens, top-level "provider"), [DONE].
//        stream:false -> chat.completion JSON; content defaults to a valid classification when the
//        system prompt contains GODE_CLASSIFIER_V1, else '{"ok":true}'.
//   POST /v1/images/generations -> { data: [{ b64_json: <1x1 PNG> }], output_format: <requested, else "png"> }
//   POST /fal/<owner>/<app>/<path...> -> queue submit { request_id, status_url, response_url,
//        cancel_url, queue_position } (URLs on this server, owner/app only like real fal).
//   GET  /fal/<owner>/<app>/requests/<id>/status -> 202 IN_QUEUE (position 0), 202 IN_PROGRESS,
//        then 200 COMPLETED (scenario.fal.polls = number of 202s). A sub-path here -> 405 (as fal).
//   GET  /fal/<owner>/<app>/requests/<id> -> result by endpoint id: "video"/"veo"/"wan"/"ltx" -> video.url;
//        "tts"/"speech"/"voice" -> audio.url (+duration); "music"/"audio"/"lyria"/"song" -> audio.url;
//        else images[] with width/height. scenario.fal.result overrides the body.
//   PUT  /fal/<owner>/<app>/requests/<id>/cancel -> 200 {status:"OK"} while queued, 202
//        {status:"CANCELLATION_REQUESTED"} once IN_PROGRESS was reported, 400 ALREADY_COMPLETED if
//        done; scenario.fal.cancel forces "ok" | "requested" | "completed" | "not_found" | "error"
//   POST /analyze (Presidio) -> EMAIL_ADDRESS entities found by a simple regex; GET /health.
//   POST /v1/checkout/sessions (Stripe, form-encoded, needs Authorization) -> { id: "cs_test_...", url, ... }
//
// Scenario presets (setScenario(name)):
//   ok                    everything succeeds (default)
//   chat_echo             stream "You said: <last user message>" in 3-char pieces (splits placeholders)
//   chat_error            400 JSON error before the stream     chat_rate_limited  429 (+Retry-After)
//   chat_no_credits       402 JSON error                        chat_auth_error    401 (message quotes a key)
//   chat_quota            429 insufficient_quota (OpenAI's real "no credits" answer)
//   chat_midstream_error  200 stream: one delta, then a chunk with a top-level error (code 429)
//   chat_error_only       200 stream whose only event is an error chunk
//   chat_truncated        stream ends without finish_reason or [DONE]
//   chat_no_usage         no usage chunk (adapters must estimate)
//   chat_slow             40 deltas, 40 ms apart (abort tests); stops writing when the client leaves
//   chat_keepalive_only   200 SSE, then only ": keepalive" comments every chat.keepaliveMs (timeouts)
//   chat_stall            one delta, then only keepalive comments (idle timeout mid-stream)
//   chat_hang             never answers, not even headers (first-byte timeout before the response)
//   images_error          400 from /images/generations
//   fal_failed            status COMPLETED with error/error_type
//   fal_result_error      result GET answers 422 {detail:[{loc,msg,type}]}
//   fal_no_media          result 200 without any media field
//   fal_stuck             status stays IN_PROGRESS forever (timeout/abort/cancel tests)
//   fal_queued            status stays IN_QUEUE forever (a stop before the job ran)
//   fal_submit_error      submit answers 401 {detail, type:"rejected_key"}
//   (option) setScenario({ fal: { foreignUrls: true } }): submit returns URLs on another host
//   (option) fal.statusFailures { [n]: status | "reset" }: status poll n (1-based, per request) fails
//            with that HTTP status (JSON body, Retry-After: fal.retryAfter when set) or a reset socket
//   (option) fal.resultFailures [status | "reset", ...]: the first result GETs fail in this order
//   presidio_down         /analyze and /health answer 500
//   presidio_slow         /analyze waits scenario.presidio.delayMs (default 2000) before answering
//   stripe_error          checkout answers 400 {error:{type,message}}
const http = require("http");
const crypto = require("crypto");

const CLASSIFIER_MARKER = "GODE_CLASSIFIER_V1";
// 1x1 transparent PNG.
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function defaultScenario() {
  return {
    name: "ok",
    chat: {
      mode: "ok", // ok | error | midstream_error | error_only | truncated | no_usage | slow | keepalive_only | stall | hang
      status: 400,
      error: { code: 400, message: "Invalid request: model is required", metadata: { error_type: "invalid_request" } },
      retryAfter: null,
      deltas: ["Hello", " from", " mock", " upstream."],
      echo: false,
      content: null, // non-stream content: string, object (JSON-encoded) or null (default)
      usage: {
        prompt_tokens: 12,
        completion_tokens: 9,
        total_tokens: 21,
        cost: 0.00042,
        prompt_tokens_details: { cached_tokens: 2 },
        completion_tokens_details: { reasoning_tokens: 3 },
      },
      usageStyle: "openrouter", // openrouter: usage chunk repeats a choice; openai: choices: []
      provider: "MockProvider",
      delayMs: 2,
      comments: true,
      keepaliveMs: 20, // keepalive_only / stall: interval between ": keepalive" comments
    },
    // b64Bytes: pad the returned base64 to this many characters (large-image tests).
    images: { mode: "ok", status: 400, error: { message: "Invalid size", type: "invalid_request_error", code: "invalid_value" }, b64Bytes: 0 },
    // foreignUrls: submit returns status/response/cancel URLs on another host (key-leak guard tests).
    fal: { mode: "ok", polls: 2, status: 422, result: null, foreignUrls: false, statusFailures: null, resultFailures: null, retryAfter: null },
    presidio: { mode: "ok", delayMs: 2000 },
    stripe: { mode: "ok", status: 400 },
  };
}

const PRESETS = {
  ok: {},
  chat_echo: { chat: { echo: true } },
  chat_error: { chat: { mode: "error" } },
  chat_rate_limited: {
    chat: { mode: "error", status: 429, retryAfter: "7", error: { code: 429, message: "Rate limit exceeded", metadata: { error_type: "rate_limit_exceeded" } } },
  },
  // Exactly what api.openai.com answered during the live check on an account without credits.
  chat_quota: {
    chat: {
      mode: "error",
      status: 429,
      error: {
        message: "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.",
        type: "insufficient_quota",
        param: null,
        code: "credit_balance_exhausted",
      },
    },
  },
  chat_no_credits: { chat: { mode: "error", status: 402, error: { code: 402, message: "Insufficient credits. Add more using https://openrouter.ai/credits" } } },
  chat_auth_error: {
    chat: { mode: "error", status: 401, error: { message: "Incorrect API key provided: sk-proj-abcdefghijklmnop1234. You can find your API key at https://platform.openai.com.", type: "invalid_request_error", code: "invalid_api_key" } },
  },
  chat_midstream_error: { chat: { mode: "midstream_error" } },
  chat_error_only: { chat: { mode: "error_only" } },
  chat_truncated: { chat: { mode: "truncated" } },
  chat_no_usage: { chat: { mode: "no_usage" } },
  chat_slow: { chat: { mode: "slow", delayMs: 40, deltas: Array.from({ length: 40 }, (_, i) => ` w${i}`) } },
  chat_keepalive_only: { chat: { mode: "keepalive_only" } },
  chat_stall: { chat: { mode: "stall" } },
  chat_hang: { chat: { mode: "hang" } },
  images_error: { images: { mode: "error" } },
  fal_failed: { fal: { mode: "failed" } },
  fal_result_error: { fal: { mode: "result_error" } },
  fal_no_media: { fal: { mode: "no_media" } },
  fal_stuck: { fal: { mode: "stuck" } },
  fal_queued: { fal: { mode: "queued" } },
  fal_submit_error: { fal: { mode: "submit_error", status: 401 } },
  presidio_down: { presidio: { mode: "error" } },
  presidio_slow: { presidio: { mode: "slow" } },
  stripe_error: { stripe: { mode: "error" } },
};

function mergeScenario(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" ? { ...base[k], ...v } : v;
  }
  return out;
}

function resolveScenario(input) {
  if (input === undefined || input === null) return defaultScenario();
  if (typeof input === "string") {
    if (!PRESETS[input]) throw new Error(`mock-upstream: unknown scenario "${input}"`);
    return { ...mergeScenario(defaultScenario(), PRESETS[input]), name: input };
  }
  const presetName = input.name && PRESETS[input.name] ? input.name : null;
  const base = presetName ? mergeScenario(defaultScenario(), PRESETS[presetName]) : defaultScenario();
  const { name, ...rest } = input;
  return { ...mergeScenario(base, rest), name: name || "custom" };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseBody(raw, contentType) {
  if (!raw) return null;
  if ((contentType || "").includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if ((contentType || "").includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

function sendJSON(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text), ...headers });
  res.end(text);
}

function chunkString(s, size) {
  const out = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

// ---- OpenAI-compatible chat ----

function lastUser(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i]?.role === "user") return String(list[i].content ?? "");
  return "";
}

function defaultJSONContent(body) {
  const system = (body.messages || []).find((m) => m.role === "system")?.content || "";
  if (String(system).includes(CLASSIFIER_MARKER)) {
    return JSON.stringify({
      job: "chat",
      difficulty: 2,
      private: false,
      output: { length: "short", format: "text" },
      title: "Mock upstream classification",
    });
  }
  return '{"ok":true}';
}

function chatErrorBody(sc) {
  return { error: sc.error };
}

async function handleChat(req, res, body, sc) {
  const c = sc.chat;
  if (c.mode === "hang") {
    // Never answer: the client's own deadline (or hanging up) ends this.
    await new Promise((resolve) => res.on("close", resolve));
    return;
  }
  if (c.mode === "error") {
    return sendJSON(res, c.status, chatErrorBody(c), c.retryAfter ? { "Retry-After": c.retryAfter } : {});
  }
  const id = `gen-${crypto.randomBytes(6).toString("hex")}`;
  const model = body?.model || "unknown";
  const created = Math.floor(Date.now() / 1000);

  if (!body?.stream) {
    const content = c.content === null || c.content === undefined ? defaultJSONContent(body || {}) : typeof c.content === "string" ? c.content : JSON.stringify(c.content);
    return sendJSON(res, 200, {
      id,
      object: "chat.completion",
      created,
      model,
      provider: c.provider,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop", native_finish_reason: "stop" }],
      usage: c.usage,
    });
  }

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  let gone = false;
  res.on("close", () => {
    gone = true;
  });
  const base = { id, object: "chat.completion.chunk", created, model, provider: c.provider };
  const write = async (text) => {
    if (gone) return false;
    res.write(text);
    await wait(c.delayMs);
    return !gone;
  };
  // Each event is written in two halves so the client must buffer partial lines.
  const event = async (obj, crlf = false) => {
    const nl = crlf ? "\r\n" : "\n";
    const line = `data: ${JSON.stringify(obj)}${nl}${nl}`;
    const cut = Math.floor(line.length / 2);
    return (await write(line.slice(0, cut))) && write(line.slice(cut));
  };
  const errorChunk = {
    ...base,
    error: { code: 429, message: "Rate limit exceeded", metadata: { error_type: "rate_limit_exceeded" } },
    choices: [{ index: 0, delta: { content: "" }, finish_reason: "error" }],
  };

  // Keepalive comments until the client leaves: an upstream that is "alive" but never answers.
  const keepalive = async () => {
    while (await write(": keepalive\n\n")) await wait(c.keepaliveMs);
  };
  if (c.comments) await write(": OPENROUTER PROCESSING\n\n");
  if (c.mode === "keepalive_only") return keepalive();
  if (c.mode === "error_only") {
    await event(errorChunk);
    return res.end();
  }
  await event({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] });
  await event({ ...base, choices: [{ index: 0, delta: { content: null, reasoning: "Thinking about it..." }, finish_reason: null }] });
  if (c.comments) await write(": OPENROUTER PROCESSING\n\n");

  const deltas = c.echo ? chunkString(`You said: ${lastUser(body.messages)}`, 3) : c.deltas;
  for (let i = 0; i < deltas.length; i++) {
    const ok = await event({ ...base, choices: [{ index: 0, delta: { content: deltas[i] }, finish_reason: null }] }, i === 1);
    if (!ok) return; // client went away (abort tests)
    if (c.mode === "stall" && i === 0) return keepalive();
    if (c.mode === "midstream_error" && i === 0) {
      await event(errorChunk);
      return res.end();
    }
  }
  if (c.mode === "truncated") return res.end();

  if (c.usageStyle === "openai") {
    await event({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    if (c.mode !== "no_usage") await event({ ...base, choices: [], usage: c.usage });
  } else if (c.mode === "no_usage") {
    await event({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop", native_finish_reason: "stop" }] });
  } else {
    await event({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop", native_finish_reason: "stop" }] });
    await event({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: "stop", native_finish_reason: "stop" }], usage: c.usage });
  }
  await write("data: [DONE]\n\n");
  res.end();
}

function handleImages(res, sc, body) {
  if (sc.images.mode === "error") return sendJSON(res, sc.images.status, { error: sc.images.error });
  return sendJSON(res, 200, {
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: sc.images.b64Bytes > PNG_1X1.length ? PNG_1X1 + "A".repeat(sc.images.b64Bytes - PNG_1X1.length) : PNG_1X1 }],
    // gpt-image echoes the requested format (the bytes stay a PNG here; only the label matters).
    output_format: (body && typeof body.output_format === "string" && body.output_format) || "png",
    usage: { input_tokens: 10, output_tokens: 272, total_tokens: 282 },
  });
}

// ---- fal queue ----

function falResult(endpoint, sc) {
  if (sc.fal.result) return sc.fal.result;
  const media = "https://v3.fal.media/files/mock";
  if (/video|veo|wan|ltx|kling|hunyuan/.test(endpoint)) {
    return { video: { url: `${media}/clip.mp4`, content_type: "video/mp4", file_name: "clip.mp4", file_size: 123456 } };
  }
  if (/tts|speech|voice/.test(endpoint)) {
    return { audio: { url: `${media}/speech.mp3`, content_type: "audio/mpeg", duration: 2.5 } };
  }
  if (/music|audio|lyria|song/.test(endpoint)) {
    return { audio: { url: `${media}/music.mp3`, content_type: "audio/mpeg", file_name: "music.mp3" } };
  }
  return { images: [{ url: `${media}/image.png`, width: 1024, height: 1024, content_type: "image/png" }], seed: 42 };
}

/** A transient-looking fal failure: an HTTP status (fal's edge answers JSON) or a dropped socket. */
function falFailure(res, failure, sc) {
  if (failure === "reset") return res.socket.destroy();
  return sendJSON(res, failure, { detail: "Service temporarily unavailable" }, sc.fal.retryAfter ? { "Retry-After": String(sc.fal.retryAfter) } : {});
}

function handleFal(req, res, pathname, body, sc, state, baseUrl) {
  const rest = pathname.slice("/fal/".length);
  const m = /^([^/]+)\/([^/]+)\/requests\/([^/]+)(\/status|\/cancel)?$/.exec(rest);
  if (!m) {
    if (rest.includes("/requests/")) return sendJSON(res, 405, { detail: "Method Not Allowed" });
    if (req.method !== "POST") return sendJSON(res, 405, { detail: "Method Not Allowed" });
    // Submit.
    if (sc.fal.mode === "submit_error") return sendJSON(res, sc.fal.status, { detail: "No user found for Key ID and Secret", type: "rejected_key" });
    const parts = rest.split("/");
    if (parts.length < 2) return sendJSON(res, 404, { detail: "Application not found" });
    const [owner, app] = parts;
    const id = crypto.randomUUID();
    state.fal.set(id, { endpoint: rest, polls: 0, completed: false, cancelled: false, input: body });
    const root = sc.fal.foreignUrls
      ? `https://queue.attacker.example/${owner}/${app}/requests/${id}`
      : `${baseUrl}/fal/${owner}/${app}/requests/${id}`;
    return sendJSON(res, 200, {
      status: "IN_QUEUE",
      request_id: id,
      response_url: root,
      status_url: `${root}/status`,
      cancel_url: `${root}/cancel`,
      queue_position: 1,
      logs: null,
      metrics: {},
    });
  }
  const [, owner, app, id, action] = m;
  const r = state.fal.get(id);
  if (!r || !r.endpoint.startsWith(`${owner}/${app}`)) return sendJSON(res, 404, { status: "NOT_FOUND" });
  const root = `${baseUrl}/fal/${owner}/${app}/requests/${id}`;
  const urls = { request_id: id, response_url: root, status_url: `${root}/status`, cancel_url: `${root}/cancel` };

  if (action === "/cancel") {
    if (req.method !== "PUT") return sendJSON(res, 405, { detail: "Method Not Allowed" });
    // scenario.fal.cancel forces an answer: "ok" | "requested" | "completed" | "not_found" | "error".
    const forced = sc.fal.cancel;
    if (forced === "error") return sendJSON(res, 500, { detail: "Internal Server Error" });
    if (forced === "not_found") return sendJSON(res, 404, { status: "NOT_FOUND" });
    if (r.completed || forced === "completed") {
      r.completed = true;
      return sendJSON(res, 400, { status: "ALREADY_COMPLETED" });
    }
    r.cancelled = true;
    // Like fal: a job that started running can only be asked to stop (and may still be billed).
    if (forced === "requested" || (forced !== "ok" && r.lastStatus === "IN_PROGRESS")) return sendJSON(res, 202, { status: "CANCELLATION_REQUESTED" });
    return sendJSON(res, 200, { status: "OK" });
  }
  if (action === "/status") {
    r.polls += 1;
    const failure = sc.fal.statusFailures ? sc.fal.statusFailures[r.polls] : undefined;
    if (failure !== undefined) return falFailure(res, failure, sc);
    if (r.cancelled) {
      r.completed = true;
      return sendJSON(res, 200, { status: "COMPLETED", ...urls, error: "Request cancelled", error_type: "client_cancelled", metrics: {} });
    }
    if (sc.fal.mode === "stuck" || sc.fal.mode === "queued" || r.polls <= sc.fal.polls) {
      const inQueue = sc.fal.mode === "queued" || (sc.fal.mode !== "stuck" && r.polls === 1);
      r.lastStatus = inQueue ? "IN_QUEUE" : "IN_PROGRESS";
      return sendJSON(res, 202, inQueue ? { status: "IN_QUEUE", queue_position: 0, ...urls, logs: null } : { status: "IN_PROGRESS", ...urls, logs: null });
    }
    r.completed = true;
    if (sc.fal.mode === "failed") {
      return sendJSON(res, 200, { status: "COMPLETED", ...urls, error: "Internal server error", error_type: "runner_server_error", metrics: {} });
    }
    return sendJSON(res, 200, { status: "COMPLETED", ...urls, logs: null, metrics: { inference_time: 1.23 } });
  }
  // Result.
  if (!r.completed) return sendJSON(res, 400, { detail: "Request is still in progress", ...urls });
  r.resultGets = (r.resultGets || 0) + 1;
  const resultFailure = Array.isArray(sc.fal.resultFailures) ? sc.fal.resultFailures[r.resultGets - 1] : undefined;
  if (resultFailure !== undefined) return falFailure(res, resultFailure, sc);
  if (sc.fal.mode === "result_error") {
    return sendJSON(res, sc.fal.status, { detail: [{ loc: ["body", "prompt"], msg: "field required", type: "value_error.missing" }] });
  }
  if (sc.fal.mode === "no_media") return sendJSON(res, 200, { seed: 1 });
  return sendJSON(res, 200, falResult(r.endpoint, sc));
}

// ---- Presidio ----

async function handlePresidio(req, res, pathname, body, sc) {
  if (pathname === "/health") {
    if (sc.presidio.mode === "error") return sendJSON(res, 500, { error: "down" });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end("Presidio Analyzer service is up");
  }
  if (sc.presidio.mode === "error") {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    return res.end("<h1>Internal Server Error</h1>");
  }
  if (sc.presidio.mode === "slow") await wait(sc.presidio.delayMs);
  if (!body || typeof body.text !== "string" || !body.language) {
    return sendJSON(res, 400, { error: "No text provided" });
  }
  const out = [];
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let m;
  while ((m = re.exec(body.text))) {
    out.push({
      entity_type: "EMAIL_ADDRESS",
      start: m.index,
      end: m.index + m[0].length,
      score: 1.0,
      analysis_explanation: null,
      recognition_metadata: { recognizer_name: "EmailRecognizer", recognizer_identifier: "EmailRecognizer_1" },
    });
  }
  return sendJSON(res, 200, out);
}

// ---- Stripe ----

function handleStripe(req, res, body, sc) {
  if (!/^Bearer sk_/.test(req.headers.authorization || "") && !/^Basic /.test(req.headers.authorization || "")) {
    return sendJSON(res, 401, { error: { type: "invalid_request_error", message: "You did not provide an API key." } });
  }
  if (sc.stripe.mode === "error") {
    return sendJSON(res, sc.stripe.status, { error: { type: "invalid_request_error", message: "Invalid currency: xyz", param: "line_items[0][price_data][currency]" } });
  }
  const f = body && typeof body === "object" ? body : {};
  const id = `cs_test_${crypto.randomBytes(12).toString("hex")}`;
  const metadata = {};
  for (const [k, v] of Object.entries(f)) {
    const mm = /^metadata\[([^\]]+)\]$/.exec(k);
    if (mm) metadata[mm[1]] = v;
  }
  const unit = Number(f["line_items[0][price_data][unit_amount]"] || 0);
  const qty = Number(f["line_items[0][quantity]"] || 1);
  return sendJSON(res, 200, {
    id,
    object: "checkout.session",
    url: `https://checkout.stripe.com/c/pay/${id}`,
    mode: f.mode || null,
    status: "open",
    payment_status: "unpaid",
    client_reference_id: f.client_reference_id || null,
    metadata,
    amount_total: unit * qty,
    currency: f["line_items[0][price_data][currency]"] || null,
    success_url: f.success_url || null,
    cancel_url: f.cancel_url || null,
  });
}

// ---- server ----

/**
 * @param {{ scenario?: string|object }} [options]
 * @returns {Promise<{ url, urls, env, requests, find, last, setScenario, scenario, reset, close }>}
 */
async function startMockUpstream({ scenario } = {}) {
  const requests = [];
  const state = { scenario: resolveScenario(scenario), fal: new Map() };
  let baseUrl = "";

  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://localhost");
      const rawBody = await readBody(req);
      const body = parseBody(rawBody, req.headers["content-type"]);
      const record = {
        method: req.method,
        path: u.pathname,
        query: Object.fromEntries(u.searchParams),
        url: req.url,
        headers: { ...req.headers },
        body,
        rawBody,
        at: Date.now(),
        closedEarly: false, // set when the client hung up before the answer was complete
      };
      requests.push(record);
      res.on("close", () => {
        if (!res.writableFinished) record.closedEarly = true;
      });
      const sc = state.scenario;
      const p = u.pathname;
      if (req.method === "POST" && p === "/v1/chat/completions") return await handleChat(req, res, body, sc);
      if (req.method === "POST" && p === "/v1/images/generations") return handleImages(res, sc, body);
      if (p.startsWith("/fal/")) return handleFal(req, res, p, body, sc, state, baseUrl);
      if ((req.method === "POST" && p === "/analyze") || (req.method === "GET" && p === "/health")) {
        return await handlePresidio(req, res, p, body, sc);
      }
      if (req.method === "POST" && p === "/v1/checkout/sessions") return handleStripe(req, res, body, sc);
      return sendJSON(res, 404, { error: { message: `mock-upstream: no route for ${req.method} ${p}` } });
    } catch (err) {
      if (!res.headersSent) sendJSON(res, 500, { error: { message: `mock-upstream: ${err.message}` } });
      else res.destroy();
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const urls = {
    v1: `${baseUrl}/v1`,
    selfhosted: `${baseUrl}/v1`,
    fal: `${baseUrl}/fal`,
    presidio: baseUrl,
    stripe: baseUrl,
  };

  return {
    url: baseUrl,
    urls,
    env: {
      OPENROUTER_BASE_URL: urls.v1,
      OPENAI_BASE_URL: urls.v1,
      FAL_QUEUE_BASE_URL: urls.fal,
      FAL_POLL_INTERVAL_MS: "5",
      STRIPE_API_BASE: urls.stripe,
    },
    requests,
    find: (fragment) => requests.filter((r) => r.path.includes(fragment)),
    last: (fragment) => {
      const list = fragment ? requests.filter((r) => r.path.includes(fragment)) : requests;
      return list[list.length - 1] || null;
    },
    setScenario(input) {
      state.scenario = resolveScenario(input);
      return state.scenario;
    },
    get scenario() {
      return state.scenario;
    },
    falRequests: state.fal,
    reset() {
      requests.length = 0;
      state.fal.clear();
      state.scenario = defaultScenario();
    },
    close() {
      server.closeAllConnections?.();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

module.exports = { startMockUpstream, PRESETS, CLASSIFIER_MARKER };
