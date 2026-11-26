// Deterministic offline provider. In mock mode (config.mock) it serves EVERY gateway, so the whole
// app works without keys: chat streams a canned answer, the classifier gets a keyword-based
// classification, media returns inline SVG/WAV data URLs. Nothing here touches the network.
//
// Test hooks: a last user message containing GODE_MOCK_FAIL makes streamChat throw upstream_error
// before any text; GODE_MOCK_FAIL_MIDSTREAM throws after the first word. Same words in a media
// prompt make generateMedia fail. Lets pipeline tests exercise refund/error paths offline.
const { AppError, estimateTokens, safeJsonParse } = require("../util");
const { abortReason } = require("./openaiCompatible");

// The router's CLASSIFIER_SYSTEM_PROMPT contains this marker; matching on it (instead of importing
// the router) avoids a providers <-> router dependency cycle.
const CLASSIFIER_MARKER = "GODE_CLASSIFIER_V1";
const WORD_DELAY_MS = 15;
const MEDIA_STEP_MS = 20;
const ECHO_WORDS = 12;
const FAIL_WORD = "GODE_MOCK_FAIL";
const FAIL_MIDSTREAM_WORD = "GODE_MOCK_FAIL_MIDSTREAM";
const REASONING_TOKENS = { none: 0, minimal: 8, low: 16, medium: 64, high: 256, xhigh: 512, max: 1024 };

// ---- keyword classifier (mirrors what the real classifier returns, minus usage/model) ----

const has = (text, re) => re.test(text);
const JOB_RULES = [
  // Fenced code is unambiguous; check it before media words like "draw".
  ["code", /```/],
  // Video before image: "animate my logo" is a video of an image subject.
  ["video", /\b(video|clip|animate|animation|footage)\b/i],
  ["image", /\b(draw|drawing|image|picture|logo|illustration|illustrate|sketch|poster|icon)\b/i],
  ["music", /\b(song|music|melody|jingle|tune|beat)\b/i],
  ["voice", /\b(read (?:it |this |that )?aloud|narrate|narration|voice ?over|voice|speak|text to speech|tts)\b/i],
  ["code", /\b(code|function|bug|regex|sql|javascript|typescript|python|java|rust|golang|compile|stack trace|refactor)\b/i],
];
const HARD_WORDS =
  /\b(prove|proof|analy[sz]e|architecture|optimi[sz]e|step by step|complex|design|debug|refactor|compare|trade-?offs?|strategy|derive|research)\b/i;

function classifyJob(text) {
  for (const [job, re] of JOB_RULES) if (has(text, re)) return job;
  return "chat";
}

function classifyDifficulty(text, job) {
  const len = text.length;
  let d = len < 40 ? 1 : len < 200 ? 2 : len < 800 ? 3 : 4;
  if (has(text, HARD_WORDS)) d += 1;
  if (job === "code") d = Math.max(d, 2);
  return Math.min(5, Math.max(1, d));
}

const FORMAT_BY_JOB = { chat: "text", action: "text", code: "code", image: "image", video: "video", music: "audio", voice: "audio" };

/** Keyword classification. `text` is the (already redacted) latest message. */
function mockClassify(text) {
  const t = String(text || "");
  const job = classifyJob(t);
  const difficulty = classifyDifficulty(t, job);
  const output = {
    length: difficulty >= 4 ? "long" : difficulty >= 2 ? "medium" : "short",
    format: FORMAT_BY_JOB[job],
  };
  if (job === "video") output.duration_s = 5;
  if (job === "image" || job === "video") output.aspect = /\b(portrait|vertical|9:16)\b/i.test(t) ? "9:16" : job === "video" ? "16:9" : "1:1";
  const title = t
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[^\p{L}\p{N}\s'[\]_-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
  return { job, difficulty, private: false, output, title: title || "New chat" };
}

/** The classifier may send plain text or a JSON envelope; classify the latest message either way. */
function classifierText(user) {
  const parsed = safeJsonParse(user, null);
  if (parsed && typeof parsed === "object") {
    for (const k of ["text", "message", "latest", "request"]) if (typeof parsed[k] === "string") return parsed[k];
  }
  return String(user || "");
}

// ---- media fixtures ----

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

function hue(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

function svgDataUrl(label, prompt, job) {
  const caption = xmlEscape(String(prompt).slice(0, 60));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" fill="hsl(${hue(prompt)},60%,55%)"/>` +
    `<text x="256" y="230" font-family="sans-serif" font-size="28" fill="#fff" text-anchor="middle">${xmlEscape(label)}</text>` +
    `<text x="256" y="270" font-family="sans-serif" font-size="16" fill="#fff" text-anchor="middle">mock ${job}</text>` +
    `<text x="256" y="300" font-family="sans-serif" font-size="14" fill="#fff" text-anchor="middle">${caption}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

let cachedWav = null;
/** 0.25 s, 8 kHz, 8-bit mono 440 Hz tone: small enough to inline, real enough for <audio>. */
function wavDataUrl() {
  if (cachedWav) return cachedWav;
  const rate = 8000;
  const n = rate / 4;
  const buf = Buffer.alloc(44 + n);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28); // byte rate
  buf.writeUInt16LE(1, 32); // block align
  buf.writeUInt16LE(8, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) buf[44 + i] = Math.round(128 + 60 * Math.sin((2 * Math.PI * 440 * i) / rate));
  cachedWav = `data:audio/wav;base64,${buf.toString("base64")}`;
  return cachedWav;
}

// ---- helpers ----

/** Abortable delay that cleans up its listener (util.sleep keeps it attached). */
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortReason(signal));
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function lastUserText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i]?.role === "user") return String(list[i].content ?? "");
  return "";
}

function mockFailure(stage) {
  return new AppError(502, "upstream_error", `mock: simulated ${stage} failure`, { upstreamStatus: null, upstreamType: "mock" });
}

// `config` is accepted for interface symmetry with the real gateways; the mock needs none of it.
// eslint-disable-next-line no-unused-vars
function createMockProvider(config) {
  async function* streamChat({ model, messages, effort, signal } = {}) {
    if (signal?.aborted) throw abortReason(signal);
    const label = model?.label || model?.id || "mock model";
    const said = lastUserText(messages);
    if (said.includes(FAIL_WORD) && !said.includes(FAIL_MIDSTREAM_WORD)) throw mockFailure("upstream");
    const echo = said.split(/\s+/).filter(Boolean).slice(0, ECHO_WORDS).join(" ");
    // Echoing the (redacted) words shows placeholder restoration working end to end.
    const answer = `${label} (mock) here. You said: "${echo}". This is an offline demo answer, no AI was called.`;
    const words = answer.match(/\S+\s*/g) || [];
    for (let i = 0; i < words.length; i++) {
      await pause(WORD_DELAY_MS, signal);
      yield { type: "delta", text: words[i] };
      if (i === 0 && said.includes(FAIL_MIDSTREAM_WORD)) throw mockFailure("mid-stream");
    }
    const reasoning = REASONING_TOKENS[effort] ?? 0;
    yield {
      type: "usage",
      inputTokens: estimateTokens((messages || []).map((m) => m?.content ?? "").join("\n")),
      outputTokens: estimateTokens(answer) + reasoning, // upstreams bill reasoning as output
      reasoningTokens: reasoning,
      cachedTokens: 0,
      costUsd: null,
      upstreamProvider: "mock",
      modelReported: model?.slug || null,
      estimated: true,
    };
  }

  async function completeJSON({ system, user, signal } = {}) {
    if (signal?.aborted) throw abortReason(signal);
    const json = String(system || "").includes(CLASSIFIER_MARKER) ? mockClassify(classifierText(user)) : {};
    const text = JSON.stringify(json);
    return {
      json,
      text,
      usage: { inputTokens: estimateTokens(`${system || ""}\n${user || ""}`), outputTokens: estimateTokens(text), costUsd: null },
    };
  }

  async function generateMedia({ model, job, prompt, signal, onProgress } = {}) {
    if (signal?.aborted) throw abortReason(signal);
    const text = String(prompt || "");
    const report = typeof onProgress === "function" ? onProgress : () => {};
    report({ status: "queued", position: 0 });
    await pause(MEDIA_STEP_MS, signal);
    report({ status: "running" });
    await pause(MEDIA_STEP_MS, signal);
    if (text.includes(FAIL_WORD)) throw mockFailure("media");
    const label = model?.label || "mock";
    const audio = job === "voice" || job === "music";
    const media = audio
      ? [{ type: "audio", url: wavDataUrl(), mime: "audio/wav" }]
      : [{ type: "image", url: svgDataUrl(label, text, job || "image"), mime: "image/svg+xml" }];
    return { media, units: 1, costUsd: null };
  }

  return {
    name: "mock",
    configured: () => true,
    streamChat,
    completeJSON,
    generateMedia,
  };
}

module.exports = { createMockProvider, mockClassify, CLASSIFIER_MARKER };
