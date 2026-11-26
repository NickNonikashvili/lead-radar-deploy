// fal media gateway (image, video, music, voice) via the queue API:
// submit -> poll status_url -> GET response_url. fal reports no per-request cost, so we return the
// billable units for model.price_unit and the pipeline prices them (costUsd stays null).
const { AppError } = require("../util");
const { requestJSON, upstreamError, notConfigured, abortReason } = require("./openaiCompatible");

const ENDPOINT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const CANCEL_TIMEOUT_MS = 5000;
const DEFAULT_SECONDS = 5; // fal's usual clip length when neither input nor output says otherwise
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MIN_POLL_MS = 50;
// Catalog-only keys and generic hints that must never reach a model's input schema.
const META_KEYS = new Set(["prompt_field", "aspect", "duration_s", "reasoning"]);
// fal image_size presets -> pixels, for megapixel billing when the result omits dimensions.
const PRESET_PIXELS = {
  square_hd: [1024, 1024],
  square: [512, 512],
  portrait_4_3: [768, 1024],
  portrait_16_9: [576, 1024],
  landscape_4_3: [1024, 768],
  landscape_16_9: [1024, 576],
};

// ---- input ----

function stripMeta(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) if (!META_KEYS.has(k)) out[k] = v;
  return out;
}

/** 'landscape' | 'portrait' | null from "16:9", "9:16", "portrait", "wide", ... */
function aspectOrientation(aspect) {
  if (typeof aspect !== "string") return null;
  const a = aspect.trim().toLowerCase();
  const m = /^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/.exec(a);
  if (m) {
    const r = Number(m[1]) / Number(m[2]);
    if (r > 1.1) return "landscape";
    if (r < 0.9) return "portrait";
    return null;
  }
  if (/landscape|wide|horizontal/.test(a)) return "landscape";
  if (/portrait|tall|vertical/.test(a)) return "portrait";
  return null;
}

/**
 * Apply a generic aspect hint only to fields that keep the catalog price valid: a video's
 * aspect_ratio, or an image_size preset (16:9 presets have fewer pixels than square_hd).
 */
function applyAspect(input, aspect) {
  const o = aspectOrientation(aspect);
  if (!o) return;
  if (typeof input.aspect_ratio === "string") input.aspect_ratio = o === "landscape" ? "16:9" : "9:16";
  if (typeof input.image_size === "string" && PRESET_PIXELS[input.image_size]) {
    input.image_size = o === "landscape" ? "landscape_16_9" : "portrait_16_9";
  }
}

/** body = { ...model.params, ...params, [prompt_field]: prompt }, minus catalog-only keys. */
function buildInput(model, params, prompt) {
  const field = model.params?.prompt_field || "prompt";
  if (!FIELD_RE.test(field)) throw new TypeError("model.params.prompt_field is invalid");
  const input = stripMeta(model.params);
  applyAspect(input, params?.aspect);
  Object.assign(input, stripMeta(params));
  input[field] = prompt;
  return input;
}

// ---- output ----

function isDeliverableUrl(url) {
  return typeof url === "string" && (/^https:\/\//i.test(url) || /^data:(image|video|audio)\//i.test(url));
}

/** Media items from images[] / image / video / audio / audio_file (File objects or bare URLs). */
function extractMedia(result) {
  const media = [];
  const add = (type, file) => {
    const url = typeof file === "string" ? file : file?.url;
    if (!isDeliverableUrl(url)) return;
    const item = { type, url };
    if (typeof file?.content_type === "string" && file.content_type) item.mime = file.content_type;
    media.push(item);
  };
  if (Array.isArray(result?.images)) result.images.forEach((f) => add("image", f));
  if (result?.image) add("image", result.image);
  if (result?.video) add("video", result.video);
  if (result?.audio) add("audio", result.audio);
  if (result?.audio_file) add("audio", result.audio_file);
  return media;
}

function parseSeconds(v) {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = parseFloat(v); // Veo takes "4s"
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function mediaSeconds(input, result) {
  const ms = parseSeconds(input.music_length_ms);
  return (
    parseSeconds(input.duration) ??
    (ms !== null ? ms / 1000 : null) ??
    parseSeconds(result?.video?.duration) ??
    parseSeconds(result?.audio?.duration) ??
    parseSeconds(result?.duration) ??
    DEFAULT_SECONDS
  );
}

function imagePixels(file, imageSize) {
  if (Number.isFinite(file?.width) && Number.isFinite(file?.height)) return file.width * file.height;
  if (imageSize && typeof imageSize === "object" && Number.isFinite(imageSize.width) && Number.isFinite(imageSize.height)) {
    return imageSize.width * imageSize.height;
  }
  const preset = PRESET_PIXELS[imageSize] || PRESET_PIXELS.square_hd;
  return preset[0] * preset[1];
}

const round4 = (n) => Math.round(n * 10000) / 10000;

/** Number of model.price_unit units this request is billed for. */
function computeUnits(model, { input, result, media, prompt }) {
  const count = (type) => media.filter((m) => m.type === type).length;
  switch (model.price_unit) {
    case "image":
      return Math.max(1, count("image"));
    case "megapixel": {
      const files = Array.isArray(result?.images) ? result.images : result?.image ? [result.image] : [{}];
      return round4(files.reduce((sum, f) => sum + imagePixels(f, input.image_size), 0) / 1e6);
    }
    case "second":
      return mediaSeconds(input, result);
    case "minute":
      return Math.max(1, Math.ceil(mediaSeconds(input, result) / 60));
    case "song":
      return Math.max(1, count("audio"));
    case "1k_chars":
      return round4(prompt.length / 1000);
    case "request":
    default:
      return 1;
  }
}

// ---- queue ----

function createFalProvider(config) {
  const gw = config.gateways.fal;
  const base = () => gw.queueBaseUrl;
  const headers = () => ({ Authorization: `Key ${gw.apiKey}` });

  /** Use fal's returned URLs, but only on our queue origin: they receive the API key. */
  function queueUrls(submit, slug) {
    const origin = new URL(base()).origin;
    const sameOrigin = (u) => {
      try {
        return typeof u === "string" && new URL(u).origin === origin ? u : null;
      } catch {
        return null;
      }
    };
    const id = typeof submit?.request_id === "string" && REQUEST_ID_RE.test(submit.request_id) ? submit.request_id : null;
    // Status/result/cancel live under owner/app only: the sub-path gives 405.
    const [owner, app] = slug.split("/");
    const root = id ? `${base()}/${owner}/${app}/requests/${id}` : null;
    const urls = {
      status: sameOrigin(submit?.status_url) || (root && `${root}/status`),
      response: sameOrigin(submit?.response_url) || root,
      cancel: sameOrigin(submit?.cancel_url) || (root && `${root}/cancel`),
    };
    if (!urls.status || !urls.response) throw upstreamError("fal", { message: "queue did not return a request id" });
    return urls;
  }

  /** Poll until COMPLETED; returns the final status body (which may carry error/error_type). */
  async function waitForCompletion(statusUrl, signal, report) {
    for (;;) {
      const { json } = await requestJSON("fal", statusUrl, { headers: headers(), signal, okStatuses: [200, 202] });
      const status = json?.status;
      if (status === "COMPLETED") return json;
      if (status !== "IN_QUEUE" && status !== "IN_PROGRESS") throw upstreamError("fal", { message: "unexpected queue status" });
      report(status, json.queue_position);
      await pause(Math.max(MIN_POLL_MS, Number(gw.pollIntervalMs) || 0), signal);
    }
  }

  /** Best effort: the request already failed or was aborted, so a cancel failure changes nothing. */
  async function cancelQuietly(cancelUrl) {
    if (!cancelUrl) return;
    try {
      const res = await fetch(cancelUrl, { method: "PUT", headers: headers(), signal: AbortSignal.timeout(CANCEL_TIMEOUT_MS) });
      await res.body?.cancel().catch(() => {});
    } catch {
      // Unreachable queue: fal drops unclaimed results after an hour anyway.
    }
  }

  // `job` is not needed: the endpoint id and model.params.prompt_field say everything fal needs.
  async function generateMedia({ model, prompt, params, signal, onProgress } = {}) {
    if (!gw.apiKey) throw notConfigured("fal");
    if (!model || typeof model.slug !== "string" || !ENDPOINT_RE.test(model.slug)) {
      throw new TypeError("model.slug must be a fal endpoint id (owner/app[/path])");
    }
    if (typeof prompt !== "string" || !prompt.trim()) throw new AppError(400, "bad_request", "A prompt is required");
    if (signal?.aborted) throw abortReason(signal);

    const input = buildInput(model, params, prompt);
    // One deadline for queue wait + generation; the caller's signal still wins if it fires first.
    const timeout = AbortSignal.timeout(Number(gw.timeoutMs) > 0 ? Number(gw.timeoutMs) : DEFAULT_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    const { json: submitted } = await requestJSON("fal", `${base()}/${model.slug}`, {
      method: "POST",
      // Ask fal not to keep the payload in its request history (privacy; results still expire).
      headers: { ...headers(), "X-Fal-Store-IO": "0" },
      body: input,
      signal: combined,
    }).catch((err) => {
      throw mapTimeout(err, signal, timeout);
    });
    const urls = queueUrls(submitted, model.slug);

    let completed = false;
    try {
      const report = progressReporter(onProgress);
      report(submitted.status || "IN_QUEUE", submitted.queue_position);
      const final = await waitForCompletion(urls.status, combined, report);
      completed = true;
      // Failed requests are COMPLETED too; the status body then carries error/error_type.
      if (final.error) throw upstreamError("fal", { message: String(final.error), type: final.error_type });
      const { json: result } = await requestJSON("fal", urls.response, { headers: headers(), signal: combined });
      const media = extractMedia(result);
      if (!media.length) throw resultError(result);
      return { media, units: computeUnits(model, { input, result, media, prompt }), costUsd: null };
    } catch (err) {
      if (!completed) await cancelQuietly(urls.cancel);
      throw mapTimeout(err, signal, timeout);
    }
  }

  return {
    name: "fal",
    configured: () => Boolean(gw.apiKey),
    async *streamChat() {
      throw new AppError(400, "bad_request", "fal: text generation is not supported on this gateway");
    },
    async completeJSON() {
      throw new AppError(400, "bad_request", "fal: text generation is not supported on this gateway");
    },
    generateMedia,
  };
}

/** onProgress({status, position?}) with fal's IN_QUEUE/IN_PROGRESS as queued/running, deduplicated. */
function progressReporter(onProgress) {
  let last = null;
  return (falStatus, position) => {
    if (typeof onProgress !== "function") return;
    const p = { status: falStatus === "IN_PROGRESS" ? "running" : "queued" };
    if (p.status === "queued" && Number.isInteger(position)) p.position = position;
    const key = `${p.status}:${p.position ?? ""}`;
    if (key === last) return;
    last = key;
    onProgress(p);
  };
}

/** A 200 result without media: fal puts model failures in detail/error. */
function resultError(result) {
  const detail = typeof result?.detail === "string" ? result.detail : typeof result?.error === "string" ? result.error : null;
  return upstreamError("fal", { message: detail || "no media in result", type: result?.error_type });
}

/**
 * Abortable delay. util.sleep leaves its abort listener attached after resolving, which would pile
 * up hundreds of listeners on one signal over a long poll.
 */
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

/** Our own deadline firing is an upstream failure; the caller's abort stays an abort. */
function mapTimeout(err, callerSignal, timeout) {
  if (callerSignal?.aborted) return abortReason(callerSignal);
  if (timeout.aborted) return new AppError(502, "upstream_error", "fal: timed out", { upstreamStatus: null, upstreamType: "timeout" });
  return err;
}

module.exports = { createFalProvider, buildInput, extractMedia, computeUnits };
