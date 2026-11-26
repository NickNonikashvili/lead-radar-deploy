// Direct OpenAI gateway: chat completions + gpt-image generation. Lets a deployment with only an
// OpenAI key work. OpenAI reports tokens but no cost, so costUsd is null and the pipeline prices it.
const { AppError } = require("../util");
const { createChatProvider, requestJSON, notConfigured, upstreamError } = require("./openaiCompatible");

const SESSION_KEY_MAX = 64; // prompt_cache_key limit is generous; our ids are 32 hex chars

// Only these image inputs are forwarded. Anything else (generic hints such as `aspect`, fal-style
// fields, typos) would be a 400 "Unknown parameter" from OpenAI. Size and quality are left at the
// catalog defaults unless explicitly given, because the catalog price assumes them.
const IMAGE_FIELDS = ["size", "quality", "background", "output_format", "output_compression", "moderation"];
const IMAGE_MIME = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", webp: "image/webp" };
// gpt-image returns the picture inline as base64: a 1536x1024 high-quality PNG is ~5 MB encoded.
const IMAGE_RESPONSE_MAX_BYTES = 25 * 1024 * 1024;

function chatFields(args, effort) {
  const fields = { stream_options: { include_usage: true } };
  if (effort) fields.reasoning_effort = effort;
  // OpenAI's own sticky-cache key; the session id is an opaque per-conversation hash, never a user id.
  if (typeof args.sessionId === "string" && args.sessionId) fields.prompt_cache_key = args.sessionId.slice(0, SESSION_KEY_MAX);
  return fields;
}

function imageBody(model, prompt, params) {
  const merged = { ...(model.params || {}), ...(params || {}) };
  const body = { model: model.slug, prompt, n: 1 };
  for (const k of IMAGE_FIELDS) {
    if (merged[k] !== undefined && merged[k] !== null && merged[k] !== "") body[k] = merged[k];
  }
  return body;
}

function createOpenAIProvider(config) {
  const gw = config.gateways.openai;
  const headers = () => ({ Authorization: `Bearer ${gw.apiKey}` });
  const chat = createChatProvider({
    name: "openai",
    configured: () => Boolean(gw.apiKey),
    baseUrl: () => gw.baseUrl,
    headers,
    chatFields,
    jsonFields: (args, effort) => (effort ? { reasoning_effort: effort } : {}),
    defaultUpstreamProvider: "OpenAI",
  });

  /** Image generation via POST /images/generations; gpt-image models always return base64. */
  async function generateMedia({ model, job, prompt, params, signal, onProgress } = {}) {
    if (!gw.apiKey) throw notConfigured("openai");
    if (job && job !== "image") throw new AppError(400, "bad_request", `openai: ${job} generation is not supported`);
    if (!model?.slug) throw new TypeError("model.slug is required");
    if (typeof prompt !== "string" || !prompt.trim()) throw new AppError(400, "bad_request", "A prompt is required");

    const body = imageBody(model, prompt, params);
    if (onProgress) onProgress({ status: "running" });
    const { json } = await requestJSON("openai", `${gw.baseUrl}/images/generations`, {
      method: "POST",
      headers: headers(),
      body,
      signal,
      maxBytes: IMAGE_RESPONSE_MAX_BYTES,
    });
    const format = String(json.output_format || body.output_format || "png").toLowerCase();
    const mime = IMAGE_MIME[format] || "image/png";
    const media = (Array.isArray(json.data) ? json.data : [])
      .map((d) => {
        if (typeof d?.b64_json === "string" && d.b64_json) return { type: "image", url: `data:${mime};base64,${d.b64_json}`, mime };
        if (typeof d?.url === "string" && /^https:\/\//.test(d.url)) return { type: "image", url: d.url, mime };
        return null;
      })
      .filter(Boolean);
    if (!media.length) throw upstreamError("openai", { message: "no image in response" });
    return { media, units: media.length, costUsd: null };
  }

  return { ...chat, generateMedia };
}

module.exports = { createOpenAIProvider };
