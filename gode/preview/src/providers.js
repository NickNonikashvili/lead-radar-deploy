"use strict";
// The preview's model gateways: the same interface as src/providers (get(gateway) -> adapter with
// streamChat / completeJSON / generateMedia; isAvailable(model); status()), answering locally.
//
// The simulated deployment (preview/build.js DEPLOYMENT) has OpenRouter, OpenAI and fal keys and
// no self-hosted GPU server, so self-hosted models are unavailable and private text takes the
// PRIVATE_FALLBACK=zdr path, exactly as the real picker does on such a server.
//
// Kept from src/providers/mock.js: a last user message containing GODE_MOCK_FAIL makes the answer
// fail before any text (upstream_error), GODE_MOCK_FAIL_MIDSTREAM after the first words; the same
// words in a media prompt make the generation fail. Not advertised in the UI.

const { AppError } = require("../../src/util");
const { heuristicClassify, _internal: classifyInternals } = require("../../src/router/classify");
const { checkMaxChars, buildInput, computeUnits } = require("../../src/providers/fal");
const { abortReason } = require("../../src/providers/openaiCompatible");
const { composeTextAnswer, composeMediaCaption } = require("./answers");
const { svgDataUrl, wavDataUrl } = require("./media-files");
const { isEditFollowUp } = require("./follow-up");

const FAIL_WORD = "GODE_MOCK_FAIL";
const FAIL_MIDSTREAM_WORD = "GODE_MOCK_FAIL_MIDSTREAM";
const UPSTREAM_PROVIDER = "preview (simulated)";

// What the failure card shows as its detail line: neutral words, not test jargon (the real mock
// says "mock: simulated ... failure").
const FAILURE_MESSAGE = {
  upstream: "The provider returned an error (simulated in this preview).",
  "mid-stream": "The provider stopped responding mid-answer (simulated in this preview).",
  media: "The media provider returned an error (simulated in this preview).",
};

function mockFailure(stage) {
  return new AppError(502, "upstream_error", FAILURE_MESSAGE[stage] || FAILURE_MESSAGE.upstream, { upstreamStatus: null, upstreamType: "mock" });
}

/** True once `text` holds a complete first markdown span ("**...**"): a clean place to fail. */
function closedFirstSpan(text) {
  return (String(text).match(/\*\*/g) || []).length >= 2;
}

function lastUserText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i] && list[i].role === "user") return String(list[i].content ?? "");
  return "";
}

/** The classifier's input is a JSON envelope ({ text, history, chars }); see buildUserMessage. */
function classifierInput(user) {
  try {
    const parsed = JSON.parse(String(user || ""));
    if (parsed && typeof parsed === "object") {
      return { text: typeof parsed.text === "string" ? parsed.text : "", history: Array.isArray(parsed.history) ? parsed.history : [] };
    }
  } catch {
    // plain text
  }
  return { text: String(user || ""), history: [] };
}

// A bare description of a picture, clip or song ("A 5-second video of waves at sunset", "A calm
// lo-fi track with soft piano", "A watercolor of a fox in the snow", "A 3D render of a city"): the
// classifier model reads it as a request to make one, while the keyword classifier needs a verb
// ("make a video ...") and calls it chat. Not for questions. The first media noun is the thing
// described: "A thumbnail for my YouTube video" is a picture.
const VIDEO_NOUNS = "video|clip|animation|time-?lapse|gif|short film|trailer";
const MUSIC_NOUNS = "song|track|tune|melody|jingle|beat|soundtrack|instrumental|anthem|lullaby";
// Bare "art" or "landscape" also mean other things ("The art of negotiation"): only as a kind of art.
const IMAGE_NOUNS =
  "image|picture|photo|photograph|illustration|drawing|painting|poster|logo|icon|portrait|wallpaper|watercolou?r|cartoon|render(?:ing)?|artwork|comic|sketch|doodle|sticker|avatar|banner|thumbnail|meme|mock-?up|collage|selfie|(?:pixel|digital|line|fan|concept|clip) art";
const ALL_NOUNS = `${VIDEO_NOUNS}|${MUSIC_NOUNS}|${IMAGE_NOUNS}`;
const MEDIA_DESCRIPTION = new RegExp(`^(?:an?|the|one)\\b[^.?!\\n]{0,40}?\\b(?:(${VIDEO_NOUNS})|(${MUSIC_NOUNS})|(${IMAGE_NOUNS}))s?\\b`, "i");

// Not a bare description: a question or a second clause after a comma or dash ("A song stuck in my
// head all day, how do I get rid of it"), a sentence with its own verb right after the media noun
// ("A picture is worth a thousand words."), or more than one sentence.
const QUESTION_CLAUSE = /(?:^|[,;:–—]|\s-\s)\s*(?:how|what|why|when|where|who|whom|whose|which|can|could|should|would|will|shall|is|are|am|was|were|do|does|did|has|have|any(?:one|body)?|i|we|you|he|she|it|they|this|that|there|but|so|please|thanks|any ideas)\b/i;
const VERB_AFTER_NOUN = new RegExp(
  `\\b(?:${ALL_NOUNS})s?\\s+(?:is|are|was|were|has|have|had|can|could|will|would|should|must|might|may|does|do|did|keeps?|kept|gets?|got|makes?|made|sounds?|looks?|seems?|says?|said|goes|went|plays?|played|reminds?|means?|costs?)\\b`,
  "i"
);

// "A video I watched yesterday was great": a clause of its own about the thing, not a description.
const PRONOUN_CLAUSE = new RegExp(`\\b(?:${ALL_NOUNS})s?\\s+(?:that\\s+|which\\s+)?(?:i|we|you|he|she|they)\\s+[^,.;]*\\b(?:is|are|was|were)\\b`, "i");

function mediaDescriptionJob(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 400 || /\?\s*$/.test(t)) return null;
  if (/[.!?…]\s+\S/.test(t)) return null;
  // The description itself starts the message; a question or another clause may not follow it.
  if (QUESTION_CLAUSE.test(t.replace(/^(?:an?|the|one)\b/i, ""))) return null;
  if (VERB_AFTER_NOUN.test(t) || PRONOUN_CLAUSE.test(t)) return null;
  const m = MEDIA_DESCRIPTION.exec(t);
  if (!m) return null;
  return m[1] ? "video" : m[2] ? "music" : "image";
}

// A short follow-up that only makes sense with the chat before it: "Now make it also handle PNG
// files", "Add a --dry-run option", "Can you add comments to it?", "Make it at night instead",
// "Add a cat sleeping on the chair", "Turn it into a song". The classifier model gets the history
// as context (src/router/classify.js: after an image request, "now make it move" is a video job),
// so it keeps the chat's job; the keyword rules read the latest message alone and call these chat.
// What counts as such a follow-up: preview/src/follow-up.js. One that names a medium takes it:
// "Turn it into a song", "make it a short video".
const MEDIUM_NAMED = [
  ["video", new RegExp(`\\b(?:${VIDEO_NOUNS}|movie)s?\\b`, "i")],
  ["music", new RegExp(`\\b(?:${MUSIC_NOUNS}|music)s?\\b`, "i")],
  ["voice", /\b(?:voice(?:-?over)?|audio|narration|voice note|(?:read|say) (?:it|this|that) (?:aloud|out loud))\b/i],
  ["image", new RegExp(`\\b(?:${IMAGE_NOUNS})s?\\b`, "i")],
];
const historyText = (m) => String((m && (typeof m.content === "string" ? m.content : m.text)) || "").trim();

// What the last answer was, as the history shows it: code, or a media marker (pipeline.js
// MEDIA_HISTORY_LABEL). For a chain of follow-ups whose first request is out of the history window.
// The classifier sees each earlier message clipped to its head and tail, which may leave a code
// block out; a preview answer says its job near the top ("- **Job:** Code").
const ANSWER_KIND = [
  ["code", /```|\*\*Job:\*\* Code\b/],
  ["image", /\[generated image\]/],
  ["video", /\[generated video\]/],
  ["music", /\[generated audio\]/],
];

/** The job an earlier user message asked for, walking back through follow-ups ("make it blue"). */
function earlierJob(history) {
  const list = Array.isArray(history) ? history : [];
  const users = list.filter((m) => m && m.role === "user").map(historyText).filter(Boolean);
  for (let i = users.length - 1, steps = 0; i >= 0 && steps < 4; i--, steps++) {
    const job = heuristicClassify(users[i]).job;
    const own = job !== "chat" ? job : mediaDescriptionJob(users[i]);
    if (own) return own;
    if (!isEditFollowUp(users[i])) return null;
  }
  // Only follow-ups in view (the classifier sees the last few messages): the last answer tells.
  const answer = [...list].reverse().find((m) => m && m.role === "assistant");
  const said = historyText(answer);
  for (const [job, re] of ANSWER_KIND) if (re.test(said)) return job;
  return null;
}

/** A follow-up's job from the chat (see EDIT_START), or null when the message stands on its own. */
function followUpJob(text, history) {
  if (!isEditFollowUp(text)) return null;
  const before = earlierJob(history);
  if (!before) return null;
  for (const [job, re] of MEDIUM_NAMED) if (re.test(text)) return job;
  return before;
}

/** Split an answer into stream chunks of one to three words (code keeps its line breaks). */
function chunksOf(text) {
  const tokens = String(text).match(/\s*\S+|\s+$/g) || [];
  const out = [];
  let i = 0;
  let k = 0;
  while (i < tokens.length) {
    const n = 1 + ((k * 7 + 3) % 3);
    out.push(tokens.slice(i, i + n).join(""));
    i += n;
    k += 1;
  }
  return out;
}

/**
 * @param {object} opts
 * @param {Record<string, boolean>} opts.gateways   which gateways this deployment has keys for
 * @param {{ sleep(ms, signal): Promise<void>, rand(min, max): number }} opts.pace
 * @param {(signal) => object|undefined} opts.contextOf  the turn's route event, user and mode
 * @param {number} opts.margin
 */
function createPreviewProviders({ gateways, pace, contextOf, margin, onCall }) {
  const available = new Set(Object.entries(gateways || {}).filter(([, on]) => on).map(([g]) => g));
  // The simulated gateway got this turn's request (the backend marks its log row as simulated).
  const called = (signal) => {
    if (typeof onCall === "function") onCall(signal);
  };

  async function* streamChat({ model, messages, effort, maxTokens, signal } = {}) {
    if (signal && signal.aborted) throw abortReason(signal);
    called(signal);
    const said = lastUserText(messages);
    // Like a real gateway: a first-byte wait, longer when the model thinks harder.
    await pace.sleep(pace.rand(260, 520) + ({ low: 120, medium: 260, high: 480 }[effort] || 0), signal);
    if (said.includes(FAIL_WORD) && !said.includes(FAIL_MIDSTREAM_WORD)) throw mockFailure("upstream");
    const ctx = contextOf(signal) || {};
    const { text, usage } = composeTextAnswer({ model, messages, effort, maxTokens, route: ctx.route, mode: ctx.mode, user: ctx.user, margin, ctx });
    yield { type: "meta", upstreamProvider: UPSTREAM_PROVIDER };
    const chunks = chunksOf(text);
    const failMidstream = said.includes(FAIL_MIDSTREAM_WORD);
    let sent = "";
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await pace.sleep(pace.rand(15, 40), signal);
      // GODE_MOCK_FAIL_MIDSTREAM: fail once the first sentence (a bold span) is complete, so the
      // kept partial text reads cleanly instead of ending in an unclosed "**".
      if (failMidstream && (closedFirstSpan(sent + chunks[i]) || i >= 40)) {
        const whole = sent + chunks[i];
        const close = whole.indexOf("**", whole.indexOf("**") + 2);
        const piece = close >= 0 ? whole.slice(sent.length, close + 2) : chunks[i];
        if (piece) yield { type: "delta", text: piece };
        throw mockFailure("mid-stream");
      }
      yield { type: "delta", text: chunks[i] };
      sent += chunks[i];
    }
    yield {
      type: "usage",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.reasoningTokens,
      cachedTokens: 0,
      costUsd: null,
      upstreamProvider: UPSTREAM_PROVIDER,
      modelReported: (model && model.slug) || null,
      estimated: true,
    };
  }

  /** The classifier call: Gode's built-in classifier stands in for the classifier model's reply. */
  async function completeJSON({ system, user, signal } = {}) {
    if (signal && signal.aborted) throw abortReason(signal);
    const isClassifier = String(system || "").includes("GODE_CLASSIFIER_V1");
    let json = {};
    if (isClassifier) {
      const { text, history } = classifierInput(user);
      let c = heuristicClassify(text, {}, { history });
      const described = c.job === "chat" ? mediaDescriptionJob(text) : null;
      const followed = c.job === "chat" && !described ? followUpJob(text, history) : null;
      const job = described || followed;
      if (job) {
        // The reply the classifier model would give: this job, with its difficulty (code is at
        // least 2) and output. Gode's own rule then adds the media prompt for a follow-up
        // ("make it at night instead" folds the earlier request in), as in the live app.
        const difficulty = classifyInternals.heuristicDifficulty(text, job);
        c = { ...c, job, difficulty, output: classifyInternals.heuristicOutput(text, job, difficulty) };
      }
      json = { job: c.job, difficulty: c.difficulty, private: c.private, output: c.output, title: c.title };
    }
    const out = JSON.stringify(json);
    const est = (s) => Math.ceil(String(s || "").length / 4);
    return { json, text: out, usage: { inputTokens: est(`${system || ""}\n${user || ""}`), outputTokens: est(out), costUsd: null } };
  }

  async function generateMedia({ model, job, prompt, params, signal, onProgress } = {}) {
    if (signal && signal.aborted) throw abortReason(signal);
    called(signal);
    const text = String(prompt || "");
    checkMaxChars(model || {}, text);
    const report = typeof onProgress === "function" ? onProgress : () => {};
    // A short queue, then the generation (videos take longest), as fal reports them.
    for (const position of [2, 1, 0]) {
      report({ status: "queued", position });
      await pace.sleep(pace.rand(450, 750), signal);
    }
    report({ status: "running" });
    await pace.sleep({ video: 3600, music: 2200, voice: 1400 }[job] || 2000, signal);
    if (text.includes(FAIL_WORD)) throw mockFailure("media");
    const ctx = contextOf(signal) || {};
    const audio = job === "voice" || job === "music";
    const media = audio
      ? [{ type: "audio", url: wavDataUrl(job), mime: "audio/wav" }]
      : [{ type: "image", url: svgDataUrl({ label: model.label, prompt: text, job, aspect: params && params.aspect }), mime: "image/svg+xml" }];
    // The units fal would bill, from the real adapter's rules (its request input, no result sizes).
    let units = 1;
    try {
      units = computeUnits(model, { input: buildInput(model, params || {}, text), result: {}, media, prompt: text });
    } catch {
      units = 1;
    }
    const caption = composeMediaCaption({ model, job, prompt: text, route: ctx.route, user: ctx.user, mode: ctx.mode, ctx });
    // The pipeline stores the caption as the answer's text; the backend also shows it live.
    ctx.caption = caption;
    return { media, units, costUsd: null, caption };
  }

  const adapter = { name: "preview", configured: () => true, streamChat, completeJSON, generateMedia };

  return {
    get: () => adapter,
    isAvailable(model) {
      if (!model || model.enabled === false || model.enabled === 0) return false;
      return available.has(model.gateway);
    },
    downUntil: () => 0,
    status: () => ({ openrouter: available.has("openrouter"), openai: available.has("openai"), selfhosted: available.has("selfhosted"), fal: available.has("fal") }),
    mock: true,
  };
}

module.exports = { createPreviewProviders, chunksOf, mediaDescriptionJob, followUpJob, FAIL_WORD, FAIL_MIDSTREAM_WORD, FAILURE_MESSAGE, UPSTREAM_PROVIDER };
