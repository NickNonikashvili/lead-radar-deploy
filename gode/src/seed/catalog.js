// Seed model catalog + routing table, and helpers to read/write it.
// The routing table is DATA: admins edit it in /#/admin and the weekly learner rewrites picks.
// These seeds only fill an empty database (or `npm run seed -- --force`).
const { now, safeJsonParse, AppError } = require("../util");
const { providerPreferences } = require("../providers/openrouter");
const { EFFORT_RANK } = require("../providers/effort-map");

const JOBS = ["chat", "code", "image", "video", "music", "voice", "action"];
const TEXT_JOBS = ["chat", "code", "action"];
const MEDIA_JOBS = ["image", "video", "music", "voice"];
const TIERS = ["quality", "balanced", "budget", "private"];

// ---- filled from the Nov 2026 research (see docs/ARCHITECTURE.md "Seed catalog") ----
// Sources, checked 2026-11-26: OpenRouter /api/v1/models + /endpoints/zdr (text prices, reasoning
// objects, ZDR endpoints), OpenAI model pages + data-controls guide (direct OpenAI prices/retention),
// fal model pages + queue OpenAPI schemas (media prices, input fields, defaults), Anthropic's
// API-and-data-retention page. Prices are what WE pay; the margin is applied at billing time.
//
// Column conventions:
// - price_in / price_out: USD per 1M tokens at the short-context rate. OpenRouter reports the real
//   cost of every request, which wins over these prices. Direct OpenAI and self-hosted report none,
//   so for them the optional params.pricing (cached-input rate, long-prompt multipliers, below)
//   matters: without it a cache hit is billed at the full input price and a prompt above OpenAI's
//   272K tier at the short-context rate.
// - Media price_per_unit is the price AT THE DEFAULT params below (resolution, quality, length);
//   changing a default param means changing the price too.
// - region: where a request may be processed in the worst case across the hosts the gateway can
//   pick ("cn" if OpenRouter may route to a Chinese vendor's own API). "self" = our GPUs. The
//   EU-only setting trusts "eu", so only mark a model "eu" when every host is in the EU.
// - zdr: true only when the research found zero-retention endpoints the gateway can be forced onto.
//   Google models are false: OpenRouter's ZDR filter accepts Safety Retention endpoints and Vertex
//   requires Safety Retention for Google models since 2026-10-18. OpenAI direct is false: ZDR needs
//   OpenAI's prior approval. fal is false: it keeps queue payloads and serves public result URLs.
//   validateModel enforces this for admin edits and imports: never zdr on fal, zdr on openai only
//   with OPENAI_ZDR_APPROVED, and self_hosted / region "self" only on the selfhosted gateway (the
//   pipeline sends unredacted text only to that gateway).
// - retention_note is published verbatim on the public /privacy page: keep it factual.
// - params.reasoning = { mandatory, efforts } mirrors OpenRouter's per-model reasoning object
//   (src/providers/effort-map.js maps our effort onto it). Media params are the upstream request
//   inputs merged into every call, so they may only contain valid upstream fields, plus these
//   catalog-only keys, which the adapters read and never send as-is:
//     prompt_field         fal models whose text input is not called "prompt" (TTS: "text")
//     max_chars            fal TTS: longest text the model accepts; longer text is refused with
//                          400 bad_request before any upstream call (fal would answer 422)
//     openrouter_provider  OpenRouter text models: merged into the request's `provider` routing
//                          object (with the ZDR fields), e.g. pinning an EU model to its EU host
//     pricing              text models without a provider-reported cost (direct OpenAI):
//                          { cached_in: USD per 1M cached input tokens,
//                            long_context: { above_input_tokens, in_mult, out_mult } }; prompts
//                          with more input tokens than above_input_tokens are priced at
//                          price_in x in_mult (cached_in too) and price_out x out_mult
//     duration_options     media models with a `duration` input: the values the endpoint accepts,
//                          either a list (["4s","6s","8s"], [6, 8, 10]) or { min, max } whole
//                          seconds. The classifier's duration_s is snapped onto it (the pipeline
//                          removes this key before the adapter call); without it the default stays
/** @type {Array<object>} */
const MODELS = (() => {
  const zdrVia = (hosts) =>
    `OpenRouter lists zero-retention endpoints for this model (${hosts}); requests that need zero retention are restricted to them.`;
  const GOOGLE_NOTE =
    "Not zero-retention. Since 18 Oct 2026 Google requires Safety Retention for its models on Vertex AI " +
    "(content flagged by safety systems can be kept for review), and Google's paid Gemini API keeps data for 55 days " +
    "by default. Never used for private or strict-privacy requests.";
  const CLAUDE_NOTE =
    zdrVia("Amazon Bedrock, Google Vertex AI") +
    " Anthropic's own API keeps no prompts by default for this model (only Claude Fable and Mythos models require " +
    "30-day retention). Content flagged by Anthropic's safety systems may be kept for up to 2 years.";
  const QWEN_TAIL = " Other requests may be served by any OpenRouter provider for this model, possibly Alibaba Cloud.";
  const MISTRAL_NOTE = zdrVia("Mistral AI, France") + " Mistral AI serves this model from the EU.";
  const OPENAI_DIRECT =
    "Sent directly to OpenAI. OpenAI does not train on API data but keeps prompts and outputs in abuse-monitoring " +
    "logs for up to 30 days; zero retention is offered only to customers OpenAI approves.";
  const FAL_TAIL =
    "fal keeps the request and result in its queue for about 1 hour after completion (about 6 minutes for results " +
    "of 10 KB or more) and serves the output from a public fal.media link until it expires. No zero-retention option is confirmed.";
  const falOwn = () => `Runs on fal's own GPUs. ${FAL_TAIL}`;
  // Partner endpoints (vendor namespace on fal) are served by, or forwarded to, the model maker.
  const falPartner = (vendor, forwarded) =>
    `fal ${forwarded ? "passes" : "may pass"} the prompt to ${vendor}, whose own retention policy also applies. ${FAL_TAIL}`;
  const text = ["chat", "code", "action"];

  return [
    // ===== Text and code: OpenRouter =====
    {
      // Chat quality pick: #1 on Arena text (1526, preliminary).
      id: "openrouter:google/gemini-4-carbon", label: "Gemini 4 Carbon", vendor: "Google", region: "us",
      gateway: "openrouter", slug: "google/gemini-4-carbon", jobs: text,
      price_in: 2, price_out: 10, price_unit: null, price_per_unit: null,
      zdr: false, retention_note: GOOGLE_NOTE, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1048576,
      params: { reasoning: { mandatory: true, efforts: ["high", "medium", "low"] } },
    },
    {
      // Code quality pick: #1 on Arena WebDev (1810); #2 on Arena text (1507).
      id: "openrouter:anthropic/claude-opus-5.5", label: "Claude Opus 5.5", vendor: "Anthropic", region: "us",
      gateway: "openrouter", slug: "anthropic/claude-opus-5.5", jobs: text,
      price_in: 4, price_out: 20, price_unit: null, price_per_unit: null,
      zdr: true, retention_note: CLAUDE_NOTE, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1000000,
      // Effort 'none' is a 400 on this endpoint, so it is mandatory with no 'none' level.
      params: { reasoning: { mandatory: true, efforts: ["max", "xhigh", "high", "medium", "low"] } },
    },
    {
      // Code balanced pick: half Opus' price.
      id: "openrouter:anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", vendor: "Anthropic", region: "us",
      gateway: "openrouter", slug: "anthropic/claude-sonnet-5.5", jobs: text,
      price_in: 2, price_out: 10, price_unit: null, price_per_unit: null,
      zdr: true, retention_note: CLAUDE_NOTE, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1000000,
      params: { reasoning: { mandatory: true, efforts: ["max", "xhigh", "high", "medium", "low"] } },
    },
    {
      // Alternate: cheap Anthropic option. Below 100K prompt tokens; longer prompts cost $0.50/$2.50.
      id: "openrouter:anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", vendor: "Anthropic", region: "us",
      gateway: "openrouter", slug: "anthropic/claude-haiku-5.5", jobs: text,
      price_in: 0.1, price_out: 0.5, price_unit: null, price_per_unit: null,
      zdr: true, retention_note: CLAUDE_NOTE, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1000000,
      params: { reasoning: { mandatory: false, efforts: ["max", "xhigh", "high", "medium", "low", "none"] } },
    },
    {
      // Chat budget pick and default classifier: cheapest mainstream model with json_schema output,
      // reasoning that can be switched off, and many ZDR hosts. The stable slug is used on purpose:
      // the newer -1017 snapshot costs 3x and has time-of-day pricing.
      id: "openrouter:deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", vendor: "DeepSeek", region: "cn",
      gateway: "openrouter", slug: "deepseek/deepseek-v4.1-flash", jobs: text,
      price_in: 0.0507, price_out: 0.2028, price_unit: null, price_per_unit: null,
      zdr: true,
      retention_note:
        zdrVia("Together, Fireworks, DeepInfra, Nebius, Parasail, BaseTen and others") +
        " Other requests may be served by any OpenRouter provider for this model, possibly DeepSeek's own platform in China.",
      open_weights: true, self_hosted: false, supports_reasoning: true, context_length: 1048576,
      params: { reasoning: { mandatory: false, efforts: ["max", "high", "low", "none"] } },
    },
    {
      // Code budget pick: open-weight MoE (80B total / 3B active). No reasoning parameter.
      id: "openrouter:qwen/qwen3-coder-next", label: "Qwen3-Coder-Next", vendor: "Alibaba", region: "cn",
      gateway: "openrouter", slug: "qwen/qwen3-coder-next", jobs: ["code"],
      price_in: 0.12, price_out: 0.8, price_unit: null, price_per_unit: null,
      zdr: true, retention_note: zdrVia("Parasail only") + QWEN_TAIL,
      open_weights: true, self_hosted: false, supports_reasoning: false, context_length: 262144,
      params: {},
    },
    {
      // Chat balanced pick: the doc's Europe-hosted model. Being ZDR + EU means strict-privacy and
      // EU-only users fall back to a mid-tier model rather than the budget one.
      id: "openrouter:mistralai/mistral-large-4-0", label: "Mistral Large 4", vendor: "Mistral AI", region: "eu",
      gateway: "openrouter", slug: "mistralai/mistral-large-4-0", jobs: text,
      price_in: 0.7, price_out: 2.1, price_unit: null, price_per_unit: null,
      zdr: true, retention_note: MISTRAL_NOTE, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1048576,
      // Only on/off: every effort above 'none' runs as 'high'. Pinned to Mistral's own (EU, ZDR)
      // endpoint with no fallback, so region 'eu' holds for every request, not only ZDR ones.
      params: {
        reasoning: { mandatory: false, efforts: ["high", "none"] },
        openrouter_provider: { only: ["mistral"], allow_fallbacks: false },
      },
    },
    {
      // Alternate: the doc's cheap Europe-hosted pick. Too small for code.
      id: "openrouter:mistralai/ministral-3b-2512", label: "Ministral 3 3B", vendor: "Mistral AI", region: "eu",
      gateway: "openrouter", slug: "mistralai/ministral-3b-2512", jobs: ["chat", "action"],
      price_in: 0.1, price_out: 0.1, price_unit: null, price_per_unit: null,
      zdr: true, retention_note: MISTRAL_NOTE, open_weights: true, self_hosted: false,
      supports_reasoning: false, context_length: 131072,
      // Pinned to Mistral's own EU endpoint (its ZDR endpoint), as for Mistral Large 4.
      params: { openrouter_provider: { only: ["mistral"], allow_fallbacks: false } },
    },
    {
      // Alternate: newest Gemini Flash-family model (target of ~google/gemini-flash-latest).
      id: "openrouter:google/gemini-4-hydrogen", label: "Gemini 4 Hydrogen", vendor: "Google", region: "us",
      gateway: "openrouter", slug: "google/gemini-4-hydrogen", jobs: text,
      price_in: 1.5, price_out: 7.5, price_unit: null, price_per_unit: null,
      zdr: false, retention_note: GOOGLE_NOTE, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1048576,
      params: { reasoning: { mandatory: true, efforts: ["xhigh", "high", "medium", "low"] } },
    },
    {
      // Alternate: Apache-2.0 open weights served by many independent hosts.
      id: "openrouter:openai/gpt-oss-120b", label: "gpt-oss-120b", vendor: "OpenAI", region: "us",
      gateway: "openrouter", slug: "openai/gpt-oss-120b", jobs: text,
      price_in: 0.05, price_out: 0.25, price_unit: null, price_per_unit: null,
      zdr: true,
      retention_note:
        zdrVia("Groq, Cerebras, Amazon Bedrock, Together, Fireworks, DeepInfra and others") +
        " Open-weight model: OpenAI itself does not serve it.",
      open_weights: true, self_hosted: false, supports_reasoning: true, context_length: 131072,
      params: { reasoning: { mandatory: true, efforts: ["high", "medium", "low"] } },
    },
    {
      // Alternate: the same open weights as our self-hosted model, for comparison by the learner.
      // The catalog lists 1,024,000 tokens but the top provider serves 262,144, so use that.
      id: "openrouter:qwen/qwen3.8-27b", label: "Qwen3.8 27B", vendor: "Alibaba", region: "cn",
      gateway: "openrouter", slug: "qwen/qwen3.8-27b", jobs: text,
      price_in: 0.06, price_out: 1.96, price_unit: null, price_per_unit: null,
      zdr: true, retention_note: zdrVia("Cerebras, DeepInfra, Nebius, Parasail, CoreWeave and others") + QWEN_TAIL,
      open_weights: true, self_hosted: false, supports_reasoning: true, context_length: 262144,
      params: { reasoning: { mandatory: false, efforts: ["xhigh", "medium", "low", "none"] } },
    },

    // ===== Text and code: direct OpenAI (lets an OpenAI-only deployment work) =====
    {
      // Alternate: #2 on Arena WebDev (GPT-6 Astra, 1773); 6.2 is the newer, cheaper point release.
      id: "openai:gpt-6.2-astra", label: "GPT-6.2 Astra", vendor: "OpenAI", region: "us",
      gateway: "openai", slug: "gpt-6.2-astra", jobs: text,
      price_in: 8, price_out: 40, price_unit: null, price_per_unit: null,
      zdr: false, retention_note: OPENAI_DIRECT, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1050000,
      // OpenAI reports no cost: cache reads are $0.40/1M, prompts of 272K tokens or more cost $16/$60.
      params: {
        reasoning: { mandatory: true, efforts: ["max", "xhigh", "high", "medium", "low"] },
        pricing: { cached_in: 0.4, long_context: { above_input_tokens: 272000, in_mult: 2, out_mult: 1.5 } },
      },
    },
    {
      // Alternate: OpenAI's everyday model. Rejects effort 'none'.
      id: "openai:gpt-6.2-sol", label: "GPT-6.2 Sol", vendor: "OpenAI", region: "us",
      gateway: "openai", slug: "gpt-6.2-sol", jobs: text,
      price_in: 2, price_out: 10, price_unit: null, price_per_unit: null,
      zdr: false, retention_note: OPENAI_DIRECT, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1050000,
      params: { reasoning: { mandatory: true, efforts: ["max", "xhigh", "high", "medium", "low"] } },
    },
    {
      // Alternate: OpenAI mid tier; 'none' disables reasoning.
      id: "openai:gpt-6.1-terra", label: "GPT-6.1 Terra", vendor: "OpenAI", region: "us",
      gateway: "openai", slug: "gpt-6.1-terra", jobs: text,
      price_in: 1, price_out: 5, price_unit: null, price_per_unit: null,
      zdr: false, retention_note: OPENAI_DIRECT, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1050000,
      // Cache reads $0.05/1M (no long-prompt rate was published for Terra).
      params: { reasoning: { mandatory: false, efforts: ["max", "xhigh", "high", "medium", "low", "none"] }, pricing: { cached_in: 0.05 } },
    },
    {
      // Alternate and classifier fallback: OpenAI's cheapest current model with structured outputs.
      // Preferred over gpt-5.4-nano, which OpenAI lists as deprecated and which costs more.
      id: "openai:gpt-6-luna", label: "GPT-6 Luna", vendor: "OpenAI", region: "us",
      gateway: "openai", slug: "gpt-6-luna", jobs: text,
      price_in: 0.1, price_out: 0.5, price_unit: null, price_per_unit: null,
      zdr: false, retention_note: OPENAI_DIRECT, open_weights: false, self_hosted: false,
      supports_reasoning: true, context_length: 1050000,
      // Cache reads $0.01/1M; prompts of 272K tokens or more cost $0.20/$0.75.
      params: {
        reasoning: { mandatory: false, efforts: ["max", "xhigh", "high", "medium", "low", "none"] },
        pricing: { cached_in: 0.01, long_context: { above_input_tokens: 272000, in_mult: 2, out_mult: 1.5 } },
      },
    },

    // ===== Private tier: self-hosted open weights =====
    {
      // Text private pick. The slug is the vLLM --served-model-name. Prices are our GPU cost, not a
      // list price: one rented H100 (~$2.50/h) running the 27B dense model in FP8 decodes roughly
      // 4M output tokens/h at moderate batching (~$0.60/1M); prefill is ~10x cheaper but idle time
      // is billed too, hence $0.20 in. Revisit once real utilisation is known.
      id: "selfhosted:qwen3.8-27b", label: "Qwen3.8 27B (self-hosted)", vendor: "Alibaba", region: "self",
      gateway: "selfhosted", slug: "qwen3.8-27b", jobs: text,
      price_in: 0.2, price_out: 0.6, price_unit: null, price_per_unit: null,
      zdr: true,
      retention_note: "Runs on GPUs Gode controls. Prompts and answers never leave Gode's infrastructure, so no AI company sees them.",
      open_weights: true, self_hosted: true, supports_reasoning: true, context_length: 131072,
      params: { reasoning: { mandatory: false, efforts: ["high", "medium", "low", "none"] } },
    },

    // ===== Image =====
    {
      // Image quality pick: #1 on Arena text-to-image (1414). Billed per token: ~1,756 output
      // tokens x $30/1M for a 1024x1024 image at quality "high" = ~$0.053.
      id: "openai:gpt-image-2.6-sunburst", label: "GPT-Image-2.6 Sunburst", vendor: "OpenAI", region: "us",
      gateway: "openai", slug: "gpt-image-2.6-sunburst", jobs: ["image"],
      price_in: null, price_out: null, price_unit: "image", price_per_unit: 0.053,
      zdr: false,
      retention_note: OPENAI_DIRECT + " GPT-Image-2.6 is not on OpenAI's list of zero-retention-compatible image models.",
      open_weights: false, self_hosted: false, supports_reasoning: false, context_length: null,
      // WebP at 85: a fraction of the default PNG's size in the stored (encrypted) message.
      params: { size: "1024x1024", quality: "high", output_format: "webp", output_compression: 85 },
    },
    {
      // Alternate: same token rates as Sunburst but ~5x faster. "medium" at 1024x1024 = ~$0.043.
      id: "openai:gpt-image-2.6-flare", label: "GPT-Image-2.6 Flare", vendor: "OpenAI", region: "us",
      gateway: "openai", slug: "gpt-image-2.6-flare", jobs: ["image"],
      price_in: null, price_out: null, price_unit: "image", price_per_unit: 0.043,
      zdr: false,
      retention_note: OPENAI_DIRECT + " GPT-Image-2.6 is not on OpenAI's list of zero-retention-compatible image models.",
      open_weights: false, self_hosted: false, supports_reasoning: false, context_length: null,
      params: { size: "1024x1024", quality: "medium", output_format: "webp", output_compression: 85 },
    },
    {
      // Alternate: cheapest direct-OpenAI image model (official $0.011 per 1024x1024 "medium" image).
      // OpenAI marks it deprecated; kept so an OpenAI-only deployment has a budget image option.
      id: "openai:gpt-image-1-mini", label: "GPT Image 1 mini", vendor: "OpenAI", region: "us",
      gateway: "openai", slug: "gpt-image-1-mini", jobs: ["image"],
      price_in: null, price_out: null, price_unit: "image", price_per_unit: 0.011,
      zdr: false, retention_note: OPENAI_DIRECT, open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { size: "1024x1024", quality: "medium", output_format: "webp", output_compression: 85 },
    },
    {
      // Image balanced pick: the doc's cheaper pick (Qwen-Image scores 86% of the top model); fal has
      // no Qwen-Image-2.1, Qwen Image 3 is the newest. $0.04 at 1K (square_hd), $0.075 at 2K.
      id: "fal:alibaba/qwen-image-3/text-to-image", label: "Qwen Image 3", vendor: "Alibaba", region: "cn",
      gateway: "fal", slug: "alibaba/qwen-image-3/text-to-image", jobs: ["image"],
      price_in: null, price_out: null, price_unit: "image", price_per_unit: 0.04,
      zdr: false, retention_note: falPartner("Alibaba", false), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { image_size: "square_hd", num_images: 1 },
    },
    {
      // Image budget pick (and private fallback): newest FLUX small model, $0.009 per 1K image.
      id: "fal:blackforestlabs/flux-3/klein/text-to-image", label: "FLUX.3 Klein", vendor: "Black Forest Labs", region: "us",
      gateway: "fal", slug: "blackforestlabs/flux-3/klein/text-to-image", jobs: ["image"],
      price_in: null, price_out: null, price_unit: "image", price_per_unit: 0.009,
      zdr: false, retention_note: falPartner("Black Forest Labs", false), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { image_size: "square_hd", num_images: 1 },
    },
    {
      // Alternate: cheapest fast option, billed per megapixel (square_hd = 1024x1024 = ~1.05 MP).
      id: "fal:fal-ai/flux/schnell", label: "FLUX.1 schnell", vendor: "Black Forest Labs", region: "us",
      gateway: "fal", slug: "fal-ai/flux/schnell", jobs: ["image"],
      price_in: null, price_out: null, price_unit: "megapixel", price_per_unit: 0.003,
      zdr: false, retention_note: falOwn(), open_weights: true, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { image_size: "square_hd", num_images: 1 },
    },

    // ===== Video (5 s / 4 s at 720p by default so a clip's cost is bounded) =====
    {
      // Video quality pick: #1 on Artificial Analysis text-to-video. $0.10/s at 720p (1080p is $0.20/s
      // and is fal's default, so resolution must stay explicit).
      id: "fal:alibaba/wan-3.0/text-to-video", label: "Wan 3.0", vendor: "Alibaba", region: "cn",
      gateway: "fal", slug: "alibaba/wan-3.0/text-to-video", jobs: ["video"],
      price_in: null, price_out: null, price_unit: "second", price_per_unit: 0.1,
      zdr: false, retention_note: falPartner("Alibaba", false), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { resolution: "720p", duration: 5, aspect_ratio: "16:9", audio: true, duration_options: { min: 2, max: 30 } },
    },
    {
      // Video balanced pick: $0.05/s at 720p with audio. Veo takes duration as "4s" | "6s" | "8s".
      id: "fal:fal-ai/veo3.1/lite", label: "Veo 3.1 Lite", vendor: "Google", region: "us",
      gateway: "fal", slug: "fal-ai/veo3.1/lite", jobs: ["video"],
      price_in: null, price_out: null, price_unit: "second", price_per_unit: 0.05,
      zdr: false, retention_note: falPartner("Google", true), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { resolution: "720p", duration: "4s", aspect_ratio: "16:9", generate_audio: true, duration_options: ["4s", "6s", "8s"] },
    },
    {
      // Alternate: the doc's premium video option, $0.40/s at 720p with audio.
      id: "fal:fal-ai/veo3.1", label: "Veo 3.1", vendor: "Google", region: "us",
      gateway: "fal", slug: "fal-ai/veo3.1", jobs: ["video"],
      price_in: null, price_out: null, price_unit: "second", price_per_unit: 0.4,
      zdr: false, retention_note: falPartner("Google", true), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { resolution: "720p", duration: "4s", aspect_ratio: "16:9", generate_audio: true, duration_options: ["4s", "6s", "8s"] },
    },
    {
      // Video budget pick (and private fallback): $0.025 per ~3 s clip at 720p. fal lists the whole
      // Wan 2.2 family as retiring on 2027-01-04: re-route this cell before then.
      id: "fal:fal-ai/wan/v2.2-5b/text-to-video/fast-wan", label: "Wan 2.2 Fast", vendor: "Alibaba", region: "us",
      gateway: "fal", slug: "fal-ai/wan/v2.2-5b/text-to-video/fast-wan", jobs: ["video"],
      price_in: null, price_out: null, price_unit: "request", price_per_unit: 0.025,
      zdr: false, retention_note: falOwn(), open_weights: true, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { resolution: "720p", aspect_ratio: "16:9" },
    },
    {
      // Alternate: longer-lived low-cost option, $0.06/s at 1080p (its lowest resolution).
      id: "fal:fal-ai/ltx-2.3/text-to-video/fast", label: "LTX-2.3 Fast", vendor: "Lightricks", region: "us",
      gateway: "fal", slug: "fal-ai/ltx-2.3/text-to-video/fast", jobs: ["video"],
      price_in: null, price_out: null, price_unit: "second", price_per_unit: 0.06,
      zdr: false, retention_note: falOwn(), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      // Above 10 s fal needs 25 fps at 1080p, which is the default fps.
      params: { resolution: "1080p", duration: 6, aspect_ratio: "16:9", duration_options: [6, 8, 10, 12, 14, 16, 18, 20] },
    },

    // ===== Music =====
    {
      // Music quality pick: official API and licensed training data (Suno, the top pick, is only
      // reachable via resellers and faces label lawsuits). $0.60 per started minute; 30 s = 1 minute.
      id: "fal:elevenlabs/music/v2.5", label: "ElevenLabs Music v2.5", vendor: "ElevenLabs", region: "us",
      gateway: "fal", slug: "elevenlabs/music/v2.5", jobs: ["music"],
      price_in: null, price_out: null, price_unit: "minute", price_per_unit: 0.6,
      zdr: false, retention_note: falPartner("ElevenLabs", true), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { music_length_ms: 30000 },
    },
    {
      // Music balanced pick: full songs with vocals, $0.10 per generation whatever the length.
      id: "fal:google/lyria-3.5", label: "Lyria 3.5", vendor: "Google", region: "us",
      gateway: "fal", slug: "google/lyria-3.5", jobs: ["music"],
      price_in: null, price_out: null, price_unit: "request", price_per_unit: 0.1,
      zdr: false, retention_note: falPartner("Google", true), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: {},
    },
    {
      // Music budget pick (and private fallback): instrumental only, $0.0217 per clip.
      id: "fal:fal-ai/stable-audio-3/small/music/text-to-audio", label: "Stable Audio 3 Small", vendor: "Stability AI",
      region: "us", gateway: "fal", slug: "fal-ai/stable-audio-3/small/music/text-to-audio", jobs: ["music"],
      price_in: null, price_out: null, price_unit: "request", price_per_unit: 0.0217,
      zdr: false, retention_note: falOwn(), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { duration: 30, duration_options: { min: 5, max: 120 } }, // up to 2 minutes, same price
    },
    {
      // Alternate: songs with vocals, $0.15 per generation.
      id: "fal:fal-ai/minimax-music/v2.6", label: "MiniMax Music 2.6", vendor: "MiniMax", region: "cn",
      gateway: "fal", slug: "fal-ai/minimax-music/v2.6", jobs: ["music"],
      price_in: null, price_out: null, price_unit: "request", price_per_unit: 0.15,
      zdr: false, retention_note: falPartner("MiniMax", false), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: {},
    },

    // ===== Voice (text to speech; prices per 1,000 input characters) =====
    {
      // Voice quality pick: ElevenLabs tops Voice Arena's non-English boards; v4 is newer and cheaper
      // than v3. Simba 3.2 (#1 overall) is not on fal. Max 5,000 characters per request.
      id: "fal:elevenlabs/tts/eleven-v4", label: "ElevenLabs v4", vendor: "ElevenLabs", region: "us",
      gateway: "fal", slug: "elevenlabs/tts/eleven-v4", jobs: ["voice"],
      price_in: null, price_out: null, price_unit: "1k_chars", price_per_unit: 0.08,
      zdr: false, retention_note: falPartner("ElevenLabs", true), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { prompt_field: "text", max_chars: 5000 },
    },
    {
      // Voice balanced pick: Qwen TTS is #2 on the Artificial Analysis speech arena (1227, two points
      // behind Simba). Max 2,000 characters per request.
      id: "fal:alibaba/qwen-audio-3-tts", label: "Qwen Audio 3 TTS", vendor: "Alibaba", region: "cn",
      gateway: "fal", slug: "alibaba/qwen-audio-3-tts", jobs: ["voice"],
      price_in: null, price_out: null, price_unit: "1k_chars", price_per_unit: 0.05,
      zdr: false, retention_note: falPartner("Alibaba", false), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { prompt_field: "text", language: "Auto", max_chars: 2000 },
    },
    {
      // Voice budget pick (and private fallback): low-latency ElevenLabs, $0.04 per 1,000 characters.
      // Max 5,000 characters per request.
      id: "fal:elevenlabs/tts/eleven-v4-turbo", label: "ElevenLabs v4 Turbo", vendor: "ElevenLabs", region: "us",
      gateway: "fal", slug: "elevenlabs/tts/eleven-v4-turbo", jobs: ["voice"],
      price_in: null, price_out: null, price_unit: "1k_chars", price_per_unit: 0.04,
      zdr: false, retention_note: falPartner("ElevenLabs", true), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { prompt_field: "text", max_chars: 5000 },
    },
    {
      // Alternate: previous ElevenLabs generation. The research found no documented text limit
      // for this endpoint, so 3,000 characters is a conservative cap.
      id: "fal:fal-ai/elevenlabs/tts/eleven-v3", label: "ElevenLabs v3", vendor: "ElevenLabs", region: "us",
      gateway: "fal", slug: "fal-ai/elevenlabs/tts/eleven-v3", jobs: ["voice"],
      price_in: null, price_out: null, price_unit: "1k_chars", price_per_unit: 0.1,
      zdr: false, retention_note: falPartner("ElevenLabs", true), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { prompt_field: "text", max_chars: 3000 },
    },
    {
      // Alternate: expressive TTS with inline tags. Its text input is called "prompt" (the default).
      // The research found no documented text limit; 5,000 characters is a safe cap.
      id: "fal:fal-ai/minimax/speech-2.8-hd", label: "MiniMax Speech 2.8 HD", vendor: "MiniMax", region: "cn",
      gateway: "fal", slug: "fal-ai/minimax/speech-2.8-hd", jobs: ["voice"],
      price_in: null, price_out: null, price_unit: "1k_chars", price_per_unit: 0.1,
      zdr: false, retention_note: falPartner("MiniMax", true), open_weights: false, self_hosted: false,
      supports_reasoning: false, context_length: null,
      params: { max_chars: 5000 },
    },
  ];
})();

/** @type {Array<{job:string,tier:string,model_id:string,effort_override?:string|null}>} */
const ROUTES = (() => {
  // job -> [quality, balanced, budget, private]. No media model is honestly zero-retention, so each
  // media job's private cell repeats its budget pick (the pipeline sends media prompts redacted).
  const picks = {
    chat: [
      "openrouter:google/gemini-4-carbon",
      "openrouter:mistralai/mistral-large-4-0",
      "openrouter:deepseek/deepseek-v4.1-flash",
      "selfhosted:qwen3.8-27b",
    ],
    code: [
      "openrouter:anthropic/claude-opus-5.5",
      "openrouter:anthropic/claude-sonnet-5.5",
      "openrouter:qwen/qwen3-coder-next",
      "selfhosted:qwen3.8-27b",
    ],
    image: [
      "openai:gpt-image-2.6-sunburst",
      "fal:alibaba/qwen-image-3/text-to-image",
      "fal:blackforestlabs/flux-3/klein/text-to-image",
      "fal:blackforestlabs/flux-3/klein/text-to-image",
    ],
    video: [
      "fal:alibaba/wan-3.0/text-to-video",
      "fal:fal-ai/veo3.1/lite",
      // MAINTENANCE, due before 2027-01-04: fal retires the whole Wan 2.2 family on that date, and
      // both cells below (budget + private) then fail. Re-route them in the admin routing grid (and
      // here, for new installs) to a live budget video model. The nearest seeded alternate is
      // LTX-2.3 Fast, at a much higher price per clip, so re-check fal's catalog first. Not
      // re-routed yet: as of 2026-11-26 Wan 2.2 Fast is still served and is the cheapest clip.
      "fal:fal-ai/wan/v2.2-5b/text-to-video/fast-wan",
      "fal:fal-ai/wan/v2.2-5b/text-to-video/fast-wan",
    ],
    music: [
      "fal:elevenlabs/music/v2.5",
      "fal:google/lyria-3.5",
      "fal:fal-ai/stable-audio-3/small/music/text-to-audio",
      "fal:fal-ai/stable-audio-3/small/music/text-to-audio",
    ],
    voice: [
      "fal:elevenlabs/tts/eleven-v4",
      "fal:alibaba/qwen-audio-3-tts",
      "fal:elevenlabs/tts/eleven-v4-turbo",
      "fal:elevenlabs/tts/eleven-v4-turbo",
    ],
  };
  // Phase 1 answers `action` with the chat route (see "Core vocabulary").
  picks.action = picks.chat;
  return JOBS.flatMap((job) =>
    TIERS.map((tier, i) => ({ job, tier, model_id: picks[job][i], effort_override: null }))
  );
})();

// Cheapest model with json_schema output whose reasoning can be switched off.
const CLASSIFIER_MODEL_ID = "openrouter:deepseek/deepseek-v4.1-flash";
/** Ordered classifier fallbacks; the classifier uses the first enabled + available one. */
// The direct-OpenAI fallback keeps classification working on a deployment with only an OpenAI key.
const CLASSIFIER_MODEL_CANDIDATES = [CLASSIFIER_MODEL_ID, "openai:gpt-6-luna"];

/** Convert a `models` DB row into the JS Model shape used everywhere. */
function rowToModel(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    vendor: row.vendor || null,
    region: row.region || null,
    gateway: row.gateway,
    slug: row.slug,
    jobs: safeJsonParse(row.jobs, []),
    price_in: row.price_in ?? null,
    price_out: row.price_out ?? null,
    price_unit: row.price_unit || null,
    price_per_unit: row.price_per_unit ?? null,
    zdr: Boolean(row.zdr),
    retention_note: row.retention_note || null,
    open_weights: Boolean(row.open_weights),
    self_hosted: Boolean(row.self_hosted),
    supports_reasoning: Boolean(row.supports_reasoning),
    context_length: row.context_length ?? null,
    params: safeJsonParse(row.params, {}),
    enabled: row.enabled === undefined ? true : Boolean(row.enabled),
  };
}

const MODEL_COLUMNS = [
  "id", "label", "vendor", "region", "gateway", "slug", "jobs", "price_in", "price_out", "price_unit",
  "price_per_unit", "zdr", "retention_note", "open_weights", "self_hosted", "supports_reasoning",
  "context_length", "params", "enabled",
];

function modelToParams(m) {
  const b = (v) => (v ? 1 : 0);
  const n = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  return {
    id: String(m.id),
    label: String(m.label || m.id),
    vendor: m.vendor ?? null,
    region: m.region ?? null,
    gateway: String(m.gateway),
    slug: String(m.slug),
    jobs: JSON.stringify(Array.isArray(m.jobs) ? m.jobs : safeJsonParse(m.jobs, [])),
    price_in: n(m.price_in),
    price_out: n(m.price_out),
    price_unit: m.price_unit ?? null,
    price_per_unit: n(m.price_per_unit),
    zdr: b(m.zdr),
    retention_note: m.retention_note ?? null,
    open_weights: b(m.open_weights),
    self_hosted: b(m.self_hosted),
    supports_reasoning: b(m.supports_reasoning),
    context_length: n(m.context_length),
    params: JSON.stringify(m.params && typeof m.params === "object" ? m.params : safeJsonParse(m.params, {})),
    enabled: m.enabled === undefined ? 1 : b(m.enabled),
  };
}

// Same rule as the fal adapter's prompt_field check (an input field name).
const PROMPT_FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/**
 * Problems with the catalog-only keys in params (see docs/ARCHITECTURE.md "Seed catalog"). Adapters
 * read these on every request, so a bad value saved from the admin page would otherwise make every
 * call to that model fail with an internal error.
 */
function validateParams(params) {
  if (params === undefined || params === null) return [];
  const p = typeof params === "string" ? safeJsonParse(params, null) : params;
  if (!p || typeof p !== "object" || Array.isArray(p)) return ["params must be an object"];
  const errors = [];
  try {
    providerPreferences({ params: p }); // throws TypeError with a safe message
  } catch (err) {
    errors.push(err instanceof TypeError ? err.message : "params.openrouter_provider is invalid");
  }
  if (p.max_chars !== undefined && p.max_chars !== null && !(Number.isInteger(p.max_chars) && p.max_chars > 0)) {
    errors.push("params.max_chars must be a positive whole number");
  }
  if (p.prompt_field !== undefined && !(typeof p.prompt_field === "string" && PROMPT_FIELD_RE.test(p.prompt_field))) {
    errors.push("params.prompt_field must be an input field name");
  }
  if (p.reasoning !== undefined && p.reasoning !== null) {
    const r = p.reasoning;
    if (typeof r !== "object" || Array.isArray(r)) errors.push("params.reasoning must be an object");
    else {
      if (r.mandatory !== undefined && typeof r.mandatory !== "boolean") errors.push("params.reasoning.mandatory must be true or false");
      if (r.efforts !== undefined && !(Array.isArray(r.efforts) && r.efforts.every((e) => EFFORT_RANK.includes(e)))) {
        errors.push(`params.reasoning.efforts must list levels from: ${EFFORT_RANK.join(", ")}`);
      }
    }
  }
  if (p.pricing !== undefined && p.pricing !== null) errors.push(...validatePricing(p.pricing));
  if (p.duration_options !== undefined && p.duration_options !== null) {
    errors.push(...validateDurationOptions(p.duration_options));
    if (p.duration === undefined || p.duration === null) errors.push("params.duration_options needs a default params.duration");
  }
  return errors;
}

const isPlain = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const finiteAtLeast = (v, min) => typeof v === "number" && Number.isFinite(v) && v >= min;

/** params.pricing = { cached_in?, long_context?: { above_input_tokens, in_mult?, out_mult? } } */
function validatePricing(pricing) {
  if (!isPlain(pricing)) return ["params.pricing must be an object"];
  const errors = [];
  for (const k of Object.keys(pricing)) {
    if (!["cached_in", "long_context"].includes(k)) errors.push(`params.pricing.${k.slice(0, 40)} is not supported`);
  }
  if (pricing.cached_in !== undefined && pricing.cached_in !== null && !finiteAtLeast(pricing.cached_in, 0)) {
    errors.push("params.pricing.cached_in must be a price of 0 or more (USD per 1M tokens)");
  }
  const lc = pricing.long_context;
  if (lc !== undefined && lc !== null) {
    if (!isPlain(lc)) errors.push("params.pricing.long_context must be an object");
    else {
      for (const k of Object.keys(lc)) {
        if (!["above_input_tokens", "in_mult", "out_mult"].includes(k)) errors.push(`params.pricing.long_context.${k.slice(0, 40)} is not supported`);
      }
      if (!(Number.isInteger(lc.above_input_tokens) && lc.above_input_tokens > 0)) {
        errors.push("params.pricing.long_context.above_input_tokens must be a positive whole number");
      }
      for (const k of ["in_mult", "out_mult"]) {
        if (lc[k] !== undefined && !(finiteAtLeast(lc[k], 0) && lc[k] > 0)) errors.push(`params.pricing.long_context.${k} must be a positive number`);
      }
    }
  }
  return errors;
}

/** Seconds a duration value stands for: 5, "5", "4s" -> 5, 5, 4; anything else -> null. */
function durationSeconds(v) {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === "string" && /^\d+(?:\.\d+)?s?$/.test(v.trim())) {
    const n = parseFloat(v);
    return n > 0 ? n : null;
  }
  return null;
}

/** params.duration_options: a non-empty list of durations, or { min, max } whole seconds. */
function validateDurationOptions(options) {
  if (Array.isArray(options)) {
    if (!options.length || options.length > 100) return ["params.duration_options must list 1 to 100 durations"];
    if (options.some((o) => durationSeconds(o) === null)) return ['params.duration_options entries must be durations such as 5 or "4s"'];
    return [];
  }
  if (isPlain(options)) {
    const keys = Object.keys(options);
    const { min, max } = options;
    if (keys.some((k) => k !== "min" && k !== "max") || !Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || min > max) {
      return ["params.duration_options must be { min, max } in whole seconds with 0 < min <= max"];
    }
    return [];
  }
  return ["params.duration_options must be a list or { min, max }"];
}

/**
 * The value for a media model's `duration` input that comes closest to `seconds` (the classifier's
 * duration_s) among params.duration_options, in the format of the catalog default ("4s" or 5).
 * Ties go to the shorter (cheaper) value, so the classifier's 5 s default keeps Veo at "4s".
 * Returns null when the model has no duration input or no declared options: the default stays.
 */
function durationFor(model, seconds) {
  const p = model?.params || {};
  const want = typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  if (want === null || p.duration === undefined || p.duration === null) return null;
  const options = p.duration_options;
  if (Array.isArray(options)) {
    let best = null;
    for (const o of options) {
      const s = durationSeconds(o);
      if (s === null) continue;
      const better = best === null || Math.abs(s - want) < Math.abs(best.s - want) || (Math.abs(s - want) === Math.abs(best.s - want) && s < best.s);
      if (better) best = { s, o };
    }
    return best ? best.o : null;
  }
  if (isPlain(options) && Number.isInteger(options.min) && Number.isInteger(options.max) && options.min <= options.max) {
    const n = Math.min(options.max, Math.max(options.min, Math.round(want)));
    if (typeof p.duration === "number") return n;
    return typeof p.duration === "string" && /s$/.test(p.duration.trim()) ? `${n}s` : String(n);
  }
  return null;
}

/**
 * Per-token rates (USD per 1M tokens, i.e. micro-USD per token) for a text request with this many
 * input tokens: { in, out, cachedIn } where null means "unknown". The long-prompt multipliers of
 * params.pricing apply above its threshold; cachedIn falls back to the input rate.
 */
function textRates(model, inputTokens = 0) {
  const price = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const pricing = isPlain(model?.params?.pricing) ? model.params.pricing : {};
  let rateIn = price(model?.price_in);
  let rateOut = price(model?.price_out);
  let cachedIn = price(pricing.cached_in);
  const lc = isPlain(pricing.long_context) ? pricing.long_context : null;
  if (lc && Number.isInteger(lc.above_input_tokens) && Number(inputTokens) > lc.above_input_tokens) {
    const inMult = finiteAtLeast(lc.in_mult, 0) ? lc.in_mult : 1;
    const outMult = finiteAtLeast(lc.out_mult, 0) ? lc.out_mult : 1;
    if (rateIn !== null) rateIn *= inMult;
    if (cachedIn !== null) cachedIn *= inMult;
    if (rateOut !== null) rateOut *= outMult;
  }
  return { in: rateIn, out: rateOut, cachedIn: cachedIn ?? rateIn };
}

/**
 * Whether a model runs on our own servers. Decided by the gateway, never by the editable
 * self_hosted flag: privacy decisions (unredacted text, private routing, the classifier for
 * private prompts) must not trust a flag an admin edit or an old row could get wrong.
 */
function onOwnServers(model) {
  return Boolean(model) && model.gateway === "selfhosted";
}

/** Safe for private text: zero-retention, or on our own servers. */
function privateSafe(model) {
  return Boolean(model) && (Boolean(model.zdr) || onOwnServers(model));
}

/**
 * Problems with a model as a whole (admin edits, imports). The gateway rules guard privacy:
 * the pipeline sends unredacted text only to the selfhosted gateway, and the picker treats zdr and
 * self_hosted models as safe for private requests, so neither flag may claim more than the gateway
 * can enforce.
 * @param {object} m
 * @param {{ openaiZdrApproved?: boolean }} [opts]  config.gateways.openai.zdrApproved
 */
function validateModel(m, { openaiZdrApproved = false } = {}) {
  const errors = [];
  if (!m || typeof m !== "object") return ["model must be an object"];
  if (!m.id || typeof m.id !== "string") errors.push("id is required");
  if (!["openrouter", "fal", "openai", "selfhosted"].includes(m.gateway)) errors.push(`unknown gateway ${m.gateway}`);
  if (!m.slug) errors.push("slug is required");
  if (m.id && m.gateway && m.slug && m.id !== `${m.gateway}:${m.slug}`) errors.push(`id must be "${m.gateway}:${m.slug}"`);
  const jobs = Array.isArray(m.jobs) ? m.jobs : safeJsonParse(m.jobs, null);
  if (!Array.isArray(jobs) || !jobs.length || jobs.some((j) => !JOBS.includes(j))) errors.push("jobs must be a non-empty array of known jobs");
  if (m.self_hosted && m.gateway !== "selfhosted") errors.push("self_hosted is only for models on the selfhosted gateway");
  if (m.region === "self" && m.gateway !== "selfhosted") errors.push('region "self" is only for models on the selfhosted gateway');
  if (m.zdr && m.gateway === "fal") errors.push("zdr is not possible on fal (it keeps queue payloads and serves public result links)");
  if (m.zdr && m.gateway === "openai" && !openaiZdrApproved) {
    errors.push("zdr on openai needs OPENAI_ZDR_APPROVED=1 (OpenAI must approve zero retention for this key first)");
  }
  errors.push(...validateParams(m.params));
  return errors;
}

/** Insert or update one model row. */
function upsertModel(db, m) {
  const p = modelToParams(m);
  const cols = MODEL_COLUMNS.join(", ");
  const placeholders = MODEL_COLUMNS.map((c) => `$${c}`).join(", ");
  const updates = MODEL_COLUMNS.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
  db.prepare(
    `INSERT INTO models (${cols}, updated_at) VALUES (${placeholders}, $updated_at)
     ON CONFLICT(id) DO UPDATE SET ${updates}, updated_at = excluded.updated_at`
  ).run({ ...Object.fromEntries(Object.entries(p).map(([k, v]) => [`$${k}`, v])), $updated_at: now() });
}

/** Set one routing cell, recording history. */
// Bad input is a 400 (AppError), so any caller (admin routes, scripts) gets a clear message.
function setRoute(db, { job, tier, model_id, effort_override = null }, { source = "admin", reason = null } = {}) {
  const bad = (msg) => new AppError(400, "bad_request", msg);
  if (!JOBS.includes(job)) throw bad(`unknown job ${String(job).slice(0, 40)}`);
  if (!TIERS.includes(tier)) throw bad(`unknown tier ${String(tier).slice(0, 40)}`);
  if (effort_override && !["none", "low", "medium", "high"].includes(effort_override)) throw bad("bad effort_override");
  const model = db.prepare("SELECT id FROM models WHERE id = ?").get(model_id);
  if (!model) throw bad(`unknown model ${String(model_id).slice(0, 200)}`);
  const old = db.prepare("SELECT model_id FROM routes WHERE job = ? AND tier = ?").get(job, tier);
  db.prepare(
    `INSERT INTO routes (job, tier, model_id, effort_override, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(job, tier) DO UPDATE SET model_id = excluded.model_id, effort_override = excluded.effort_override,
       source = excluded.source, updated_at = excluded.updated_at`
  ).run(job, tier, model_id, effort_override || null, source, now());
  if (!old || old.model_id !== model_id) {
    db.prepare(
      "INSERT INTO route_history (job, tier, old_model_id, new_model_id, source, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(job, tier, old ? old.model_id : null, model_id, source, reason, now());
  }
}

/**
 * Fill an empty catalog with the seeds. force=true upserts every seed model and overwrites the
 * seeded routes (admin/learned routes for other cells are left alone only when force=false).
 */
function seedCatalog(db, { force = false } = {}) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM models").get().n;
  if (count > 0 && !force) return { seeded: false };
  db.tx(() => {
    for (const m of MODELS) upsertModel(db, m);
    for (const r of ROUTES) setRoute(db, r, { source: "seed", reason: force ? "reseed" : "initial seed" });
  });
  return { seeded: true, models: MODELS.length, routes: ROUTES.length };
}

/**
 * Boot-time fix-up for rows saved before validateModel enforced the gateway rules: clears
 * self_hosted and region "self" off the selfhosted gateway, zdr on fal, and zdr on openai unless
 * OpenAI approved zero retention. Returns the ids it changed (ids only, safe to log).
 * @param {{ openaiZdrApproved?: boolean }} [opts]
 */
function repairCatalog(db, { openaiZdrApproved = false } = {}) {
  const bad = db
    .prepare(
      `SELECT id FROM models
        WHERE (self_hosted = 1 AND gateway <> 'selfhosted')
           OR (region = 'self' AND gateway <> 'selfhosted')
           OR (zdr = 1 AND gateway = 'fal')
           OR (zdr = 1 AND gateway = 'openai' AND ? = 0)
        ORDER BY id`
    )
    .all(openaiZdrApproved ? 1 : 0)
    .map((r) => r.id);
  if (!bad.length) return [];
  db.tx(() => {
    const t = now();
    db.prepare("UPDATE models SET self_hosted = 0, updated_at = ? WHERE self_hosted = 1 AND gateway <> 'selfhosted'").run(t);
    db.prepare("UPDATE models SET region = NULL, updated_at = ? WHERE region = 'self' AND gateway <> 'selfhosted'").run(t);
    db.prepare("UPDATE models SET zdr = 0, updated_at = ? WHERE zdr = 1 AND gateway = 'fal'").run(t);
    if (!openaiZdrApproved) db.prepare("UPDATE models SET zdr = 0, updated_at = ? WHERE zdr = 1 AND gateway = 'openai'").run(t);
  });
  return bad;
}

function exportCatalog(db) {
  return {
    models: db.prepare("SELECT * FROM models ORDER BY id").all().map(rowToModel),
    routes: db.prepare("SELECT job, tier, model_id, effort_override, source, updated_at FROM routes ORDER BY job, tier").all(),
  };
}

/**
 * Upsert models then routes from an exported catalog. Throws on validation errors (nothing written).
 * An export taken before the gateway rules existed may now be refused (e.g. self_hosted on an
 * OpenRouter model): that is intended, fix the file.
 */
function importCatalog(db, { models = [], routes = [] } = {}, { source = "admin", openaiZdrApproved = false } = {}) {
  const errors = [];
  models.forEach((m, i) => validateModel(m, { openaiZdrApproved }).forEach((e) => errors.push(`models[${i}]: ${e}`)));
  if (errors.length) throw new AppError(400, "bad_request", errors.join("; "));
  db.tx(() => {
    for (const m of models) upsertModel(db, m);
    for (const r of routes) setRoute(db, r, { source, reason: "import" });
  });
  return { models: models.length, routes: routes.length };
}

function getModel(db, id) {
  return rowToModel(db.prepare("SELECT * FROM models WHERE id = ?").get(id));
}

function listModels(db, { enabledOnly = false } = {}) {
  return db
    .prepare(`SELECT * FROM models ${enabledOnly ? "WHERE enabled = 1" : ""} ORDER BY id`)
    .all()
    .map(rowToModel);
}

function getRoutes(db) {
  return db.prepare("SELECT job, tier, model_id, effort_override, source, updated_at FROM routes").all();
}

module.exports = {
  JOBS,
  TEXT_JOBS,
  MEDIA_JOBS,
  TIERS,
  MODELS,
  ROUTES,
  CLASSIFIER_MODEL_ID,
  CLASSIFIER_MODEL_CANDIDATES,
  rowToModel,
  modelToParams,
  validateModel,
  validateParams,
  durationFor,
  textRates,
  onOwnServers,
  privateSafe,
  upsertModel,
  setRoute,
  seedCatalog,
  repairCatalog,
  exportCatalog,
  importCatalog,
  getModel,
  listModels,
  getRoutes,
};
