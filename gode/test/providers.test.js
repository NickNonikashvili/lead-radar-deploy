// Providers: every adapter against the local mock upstream (exact wire format, streaming, errors,
// aborts, fal polling), the offline mock provider, the effort map and the registry.
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig } = require("../src/config");
const { AppError } = require("../src/util");
const { createProviders } = require("../src/providers");
const { resolveEffort } = require("../src/providers/effort-map");
const { readSSE, parseJsonLoose, sanitizeUpstreamMessage } = require("../src/providers/openaiCompatible");
const { createOpenRouterProvider } = require("../src/providers/openrouter");
const { createOpenAIProvider } = require("../src/providers/openai");
const { createSelfhostedProvider } = require("../src/providers/selfhosted");
const { createFalProvider } = require("../src/providers/fal");
const { createMockProvider, mockClassify, CLASSIFIER_MARKER } = require("../src/providers/mock");
const { startMockUpstream } = require("./helpers/mock-upstream");

// ---- fixtures (local copies so catalog edits don't break these tests) ----

const text = ["chat", "code", "action"];
const M = {
  opus: {
    id: "openrouter:anthropic/claude-opus-5.5", label: "Claude Opus 5.5", gateway: "openrouter", slug: "anthropic/claude-opus-5.5",
    jobs: text, supports_reasoning: true, enabled: true,
    params: { reasoning: { mandatory: true, efforts: ["max", "xhigh", "high", "medium", "low"] } },
  },
  gemini: {
    id: "openrouter:google/gemini-4-carbon", label: "Gemini 4 Carbon", gateway: "openrouter", slug: "google/gemini-4-carbon",
    jobs: text, supports_reasoning: true, enabled: true,
    params: { reasoning: { mandatory: true, efforts: ["high", "medium", "low"] } },
  },
  deepseek: {
    id: "openrouter:deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", gateway: "openrouter", slug: "deepseek/deepseek-v4.1-flash",
    jobs: text, supports_reasoning: true, enabled: true,
    params: { reasoning: { mandatory: false, efforts: ["max", "high", "low", "none"] } },
  },
  mistral: {
    id: "openrouter:mistralai/mistral-large-4-0", label: "Mistral Large 4", gateway: "openrouter", slug: "mistralai/mistral-large-4-0",
    jobs: text, supports_reasoning: true, enabled: true, params: { reasoning: { mandatory: false, efforts: ["high", "none"] } },
  },
  coder: {
    id: "openrouter:qwen/qwen3-coder-next", label: "Qwen3-Coder-Next", gateway: "openrouter", slug: "qwen/qwen3-coder-next",
    jobs: ["code"], supports_reasoning: false, enabled: true, params: {},
  },
  luna: {
    id: "openai:gpt-6-luna", label: "GPT-6 Luna", gateway: "openai", slug: "gpt-6-luna", jobs: text, supports_reasoning: true,
    enabled: true, params: { reasoning: { mandatory: false, efforts: ["max", "xhigh", "high", "medium", "low", "none"] } },
  },
  sol: {
    id: "openai:gpt-6.2-sol", label: "GPT-6.2 Sol", gateway: "openai", slug: "gpt-6.2-sol", jobs: text, supports_reasoning: true,
    enabled: true, params: { reasoning: { mandatory: true, efforts: ["max", "xhigh", "high", "medium", "low"] } },
  },
  gptImage: {
    id: "openai:gpt-image-1-mini", label: "GPT Image 1 mini", gateway: "openai", slug: "gpt-image-1-mini", jobs: ["image"],
    supports_reasoning: false, enabled: true, price_unit: "image", price_per_unit: 0.011, params: { size: "1024x1024", quality: "medium" },
  },
  qwenSelf: {
    id: "selfhosted:qwen3.8-27b", label: "Qwen3.8 27B (self-hosted)", gateway: "selfhosted", slug: "qwen3.8-27b", jobs: text,
    supports_reasoning: true, enabled: true, self_hosted: true, zdr: true,
    params: { reasoning: { mandatory: false, efforts: ["high", "medium", "low", "none"] } },
  },
  klein: {
    id: "fal:blackforestlabs/flux-3/klein/text-to-image", label: "FLUX.3 Klein", gateway: "fal",
    slug: "blackforestlabs/flux-3/klein/text-to-image", jobs: ["image"], enabled: true, price_unit: "image", price_per_unit: 0.009,
    params: { image_size: "square_hd", num_images: 1 },
  },
  schnell: {
    id: "fal:fal-ai/flux/schnell", label: "FLUX.1 schnell", gateway: "fal", slug: "fal-ai/flux/schnell", jobs: ["image"], enabled: true,
    price_unit: "megapixel", price_per_unit: 0.003, params: { image_size: "landscape_16_9", num_images: 1 },
  },
  veoLite: {
    id: "fal:fal-ai/veo3.1/lite", label: "Veo 3.1 Lite", gateway: "fal", slug: "fal-ai/veo3.1/lite", jobs: ["video"], enabled: true,
    price_unit: "second", price_per_unit: 0.05, params: { resolution: "720p", duration: "4s", aspect_ratio: "16:9", generate_audio: true },
  },
  wanFast: {
    id: "fal:fal-ai/wan/v2.2-5b/text-to-video/fast-wan", label: "Wan 2.2 Fast", gateway: "fal",
    slug: "fal-ai/wan/v2.2-5b/text-to-video/fast-wan", jobs: ["video"], enabled: true, price_unit: "request", price_per_unit: 0.025,
    params: { resolution: "720p", aspect_ratio: "16:9" },
  },
  elevenMusic: {
    id: "fal:elevenlabs/music/v2.5", label: "ElevenLabs Music v2.5", gateway: "fal", slug: "elevenlabs/music/v2.5", jobs: ["music"],
    enabled: true, price_unit: "minute", price_per_unit: 0.6, params: { music_length_ms: 30000 },
  },
  tts: {
    id: "fal:elevenlabs/tts/eleven-v4", label: "ElevenLabs v4", gateway: "fal", slug: "elevenlabs/tts/eleven-v4", jobs: ["voice"],
    enabled: true, price_unit: "1k_chars", price_per_unit: 0.08, params: { prompt_field: "text" },
  },
};

const USER_MSG = [{ role: "user", content: "Email [EMAIL_1] about the launch" }];

async function collect(gen) {
  const events = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

const deltasOf = (events) => events.filter((e) => e.type === "delta").map((e) => e.text).join("");

async function rejectsUpstream(promise, pattern) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof AppError, `expected AppError, got ${err?.name}: ${err?.message}`);
    assert.equal(err.status, 502);
    assert.equal(err.code, "upstream_error");
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
}

function realConfig(up, extra = {}) {
  return loadConfig({
    ...up.env,
    GODE_MOCK: "0",
    PUBLIC_URL: "https://gode.example",
    OPENROUTER_API_KEY: "sk-or-v1-test",
    OPENAI_API_KEY: "sk-test-openai",
    FAL_KEY: "fal-test-key",
    ...extra,
  });
}

// ---------------------------------------------------------------------------------------------

describe("resolveEffort", () => {
  it("sends nothing for models without reasoning support or without a preference", () => {
    assert.equal(resolveEffort(M.coder, "high"), null);
    assert.equal(resolveEffort(M.opus, undefined), null);
    assert.equal(resolveEffort(null, "low"), null);
  });

  it("never sends 'none' to mandatory-reasoning models", () => {
    assert.equal(resolveEffort(M.opus, "none"), "low");
    assert.equal(resolveEffort(M.gemini, "none"), "low");
    assert.equal(resolveEffort(M.sol, "none"), "low");
    const withMinimal = { supports_reasoning: true, params: { reasoning: { mandatory: true, efforts: ["high", "low", "minimal"] } } };
    assert.equal(resolveEffort(withMinimal, "none"), "minimal");
    const noList = { supports_reasoning: true, params: { reasoning: { mandatory: true } } };
    assert.equal(resolveEffort(noList, "none"), "low");
  });

  it("passes 'none' through when reasoning can be switched off", () => {
    assert.equal(resolveEffort(M.deepseek, "none"), "none");
    assert.equal(resolveEffort(M.luna, "none"), "none");
    assert.equal(resolveEffort({ supports_reasoning: true, params: {} }, "none"), "none");
  });

  it("maps unsupported levels to the nearest supported one, ties to the lower", () => {
    assert.equal(resolveEffort(M.opus, "medium"), "medium");
    assert.equal(resolveEffort(M.deepseek, "medium"), "low"); // low and high are equally near
    assert.equal(resolveEffort(M.gemini, "high"), "high");
    // Asking for thinking never snaps to 'none', even when it is as near.
    assert.equal(resolveEffort(M.mistral, "low"), "high");
    assert.equal(resolveEffort(M.mistral, "none"), "none");
  });

  it("rejects effort values outside the vocabulary", () => {
    assert.throws(() => resolveEffort(M.opus, "extreme"), TypeError);
  });
});

describe("SSE parsing", () => {
  async function* bytes(parts) {
    for (const p of parts) yield new TextEncoder().encode(p);
  }

  it("handles split lines, CRLF/CR endings, comments, multi-line data and a missing final blank line", async () => {
    const parts = [": OPENROUTER PROCESSING\n\nda", 'ta: {"a"', ":1}\r", "\n\r\ndata: line1\ndata: line2\n\n", ": ping\r\rdata:x\r\r", "event: e\ndata: last"];
    const out = [];
    for await (const d of readSSE(bytes(parts))) out.push(d);
    assert.deepEqual(out, ['{"a":1}', "line1\nline2", "x", "last"]);
  });

  it("decodes multi-byte characters split across chunks", async () => {
    const enc = new TextEncoder().encode('data: {"t":"héllo"}\n\n');
    async function* split() {
      yield enc.slice(0, 15);
      yield enc.slice(15);
    }
    const out = [];
    for await (const d of readSSE(split())) out.push(d);
    assert.deepEqual(out, ['{"t":"héllo"}']);
  });
});

describe("helpers", () => {
  it("parseJsonLoose strips fences, think blocks and surrounding prose", () => {
    assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(parseJsonLoose('<think>hmm {"no":1}</think>{"a":2}'), { a: 2 });
    assert.deepEqual(parseJsonLoose('Sure! Here it is: {"a":3} Hope that helps.'), { a: 3 });
    assert.equal(parseJsonLoose("not json"), undefined);
  });

  it("sanitizeUpstreamMessage removes keys, emails and long quoted text", () => {
    const s = sanitizeUpstreamMessage(
      `Incorrect API key provided: sk-proj-abcdef123456. Contact ada@example.com about "${"x".repeat(50)}" Bearer abc.def`
    );
    assert.doesNotMatch(s, /sk-proj|abcdef123456|ada@example\.com|xxxxxxxxxx|abc\.def/);
    assert.ok(s.length <= 160);
  });
});

describe("gateway adapters against mock upstream", () => {
  let up;
  before(async () => {
    up = await startMockUpstream();
  });
  after(async () => {
    await up.close();
  });
  beforeEach(() => up.reset());

  describe("openrouter", () => {
    it("streams deltas and one final usage event with provider-reported cost", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      const events = await collect(or.streamChat({ model: M.opus, messages: USER_MSG, effort: "high", maxTokens: 500 }));
      assert.equal(deltasOf(events), "Hello from mock upstream."); // reasoning delta dropped
      const usage = events.at(-1);
      assert.equal(events.filter((e) => e.type === "usage").length, 1);
      assert.deepEqual(usage, {
        type: "usage",
        inputTokens: 12,
        outputTokens: 9,
        reasoningTokens: 3,
        cachedTokens: 2,
        costUsd: 0.00042,
        upstreamProvider: "MockProvider",
        modelReported: "anthropic/claude-opus-5.5",
        estimated: false,
      });
    });

    it("sends the exact body and headers: zdr provider object, session_id, effort, no user field", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      const messages = [
        { role: "system", content: "Be brief." },
        { role: "user", content: "hi", id: "msg_1", user: "u_123", name: "Ada" },
      ];
      await collect(or.streamChat({ model: M.deepseek, messages, effort: "medium", maxTokens: 256, zdr: true, sessionId: "a1b2c3" }));
      const req = up.last("/chat/completions");
      assert.equal(req.path, "/v1/chat/completions");
      assert.deepEqual(req.body, {
        model: "deepseek/deepseek-v4.1-flash",
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "hi" },
        ],
        stream: true,
        max_completion_tokens: 256,
        reasoning: { effort: "low" },
        provider: { zdr: true, data_collection: "deny" },
        session_id: "a1b2c3",
      });
      assert.equal(req.headers.authorization, "Bearer sk-or-v1-test");
      assert.equal(req.headers["http-referer"], "https://gode.example");
      assert.equal(req.headers["x-openrouter-title"], "Gode");
      assert.equal(req.headers["x-title"], "Gode");
      assert.match(req.headers["content-type"], /application\/json/);
      assert.ok(!("user" in req.body));
    });

    it("omits reasoning for non-reasoning models and provider/session_id when not asked", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      await collect(or.streamChat({ model: M.coder, messages: USER_MSG, effort: "high" }));
      const body = up.last("/chat/completions").body;
      assert.deepEqual(Object.keys(body).sort(), ["messages", "model", "stream"]);
    });

    it("maps 'none' to the lowest supported level for mandatory models", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      await collect(or.streamChat({ model: M.opus, messages: USER_MSG, effort: "none" }));
      assert.deepEqual(up.last("/chat/completions").body.reasoning, { effort: "low" });
      await collect(or.streamChat({ model: M.deepseek, messages: USER_MSG, effort: "none" }));
      assert.deepEqual(up.last("/chat/completions").body.reasoning, { effort: "none" });
    });

    it("pre-stream JSON errors become upstream_error with a short message", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario("chat_error");
      await rejectsUpstream(collect(or.streamChat({ model: M.opus, messages: USER_MSG })), /^openrouter: Invalid request: model is required \(400, invalid_request\)$/);
      up.setScenario("chat_no_credits");
      await rejectsUpstream(collect(or.streamChat({ model: M.opus, messages: USER_MSG })), /^openrouter: insufficient upstream credits \(402\)$/);
      up.setScenario("chat_rate_limited");
      await assert.rejects(collect(or.streamChat({ model: M.opus, messages: USER_MSG })), (err) => {
        assert.equal(err.code, "upstream_error");
        assert.equal(err.message, "openrouter: rate limited (429, rate_limit_exceeded)");
        assert.equal(err.extra.upstreamStatus, 429);
        assert.equal(err.extra.retryAfter, "7");
        return true;
      });
    });

    it("a mid-stream error chunk throws after the deltas already sent", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario("chat_midstream_error");
      const seen = [];
      await rejectsUpstream(
        (async () => {
          for await (const ev of or.streamChat({ model: M.opus, messages: USER_MSG })) seen.push(ev);
        })(),
        /rate_limit_exceeded/
      );
      assert.deepEqual(seen, [{ type: "delta", text: "Hello" }]);
    });

    it("a 200 stream holding only an error chunk is a failure", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario("chat_error_only");
      await rejectsUpstream(collect(or.streamChat({ model: M.opus, messages: USER_MSG })), /^openrouter: /);
    });

    it("a stream cut off before finish_reason/[DONE] is an error", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario("chat_truncated");
      await rejectsUpstream(collect(or.streamChat({ model: M.opus, messages: USER_MSG })), /ended unexpectedly/);
    });

    it("estimates usage when the upstream sends none", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario("chat_no_usage");
      const events = await collect(or.streamChat({ model: M.opus, messages: USER_MSG }));
      const usage = events.at(-1);
      assert.equal(usage.type, "usage");
      assert.equal(usage.estimated, true);
      assert.equal(usage.costUsd, null);
      assert.ok(usage.inputTokens > 0 && usage.outputTokens > 0);
    });

    it("abort stops the stream promptly with an AbortError and closes the connection", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario("chat_slow");
      const ac = new AbortController();
      const started = Date.now();
      let n = 0;
      await assert.rejects(
        (async () => {
          for await (const ev of or.streamChat({ model: M.opus, messages: USER_MSG, signal: ac.signal })) {
            if (ev.type === "delta" && ++n === 3) ac.abort();
          }
        })(),
        { name: "AbortError" }
      );
      assert.equal(n, 3);
      assert.ok(Date.now() - started < 1500, "abort should not wait for the full stream");
    });

    it("an already-aborted signal never reaches the network", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      await assert.rejects(collect(or.streamChat({ model: M.opus, messages: USER_MSG, signal: AbortSignal.abort() })), { name: "AbortError" });
      assert.equal(up.find("/chat/completions").length, 0);
    });

    it("network failures map to upstream_error without leaking details", async () => {
      const or = createOpenRouterProvider(loadConfig({ GODE_MOCK: "0", OPENROUTER_API_KEY: "k", OPENROUTER_BASE_URL: "http://127.0.0.1:9/v1" }));
      await assert.rejects(collect(or.streamChat({ model: M.opus, messages: USER_MSG })), (err) => {
        assert.equal(err.code, "upstream_error");
        assert.equal(err.message, "openrouter: network error");
        return true;
      });
    });

    it("unconfigured gateway refuses with gateway_not_configured", async () => {
      const or = createOpenRouterProvider(loadConfig({ GODE_MOCK: "0", OPENAI_API_KEY: "x" }));
      assert.equal(or.configured(), false);
      await assert.rejects(collect(or.streamChat({ model: M.opus, messages: USER_MSG })), { status: 503, code: "gateway_not_configured" });
    });

    it("validates messages before calling out", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      await assert.rejects(collect(or.streamChat({ model: M.opus, messages: [] })), TypeError);
      await assert.rejects(collect(or.streamChat({ model: M.opus, messages: [{ role: "tool", content: "x" }] })), TypeError);
      assert.equal(up.requests.length, 0);
    });

    it("completeJSON: non-streaming json_object request with the lowest effort", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario({ chat: { content: '```json\n{"job":"code","difficulty":3}\n```' } });
      const out = await or.completeJSON({ model: M.deepseek, system: `${CLASSIFIER_MARKER} Classify. Answer in JSON.`, user: "fix my regex" });
      assert.deepEqual(out.json, { job: "code", difficulty: 3 });
      assert.match(out.text, /```json/);
      assert.deepEqual(out.usage, { inputTokens: 12, outputTokens: 9, costUsd: 0.00042 });
      const body = up.last("/chat/completions").body;
      assert.equal(body.stream, false);
      assert.equal(body.max_completion_tokens, 300);
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.deepEqual(body.reasoning, { effort: "none" });
      assert.ok(!("user" in body));
      assert.deepEqual(body.messages.map((m) => m.role), ["system", "user"]);
    });

    it("completeJSON: mandatory models get the lowest effort, json_schema when a schema is passed, JSON hint added", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"] };
      await or.completeJSON({ model: M.opus, system: "Classify this.", user: "hello", schema, maxTokens: 50 });
      const body = up.last("/chat/completions").body;
      assert.deepEqual(body.reasoning, { effort: "low" });
      assert.equal(body.max_completion_tokens, 50);
      assert.deepEqual(body.response_format, { type: "json_schema", json_schema: { name: "gode_result", strict: false, schema } });
      assert.match(body.messages[0].content, /JSON/);
      await or.completeJSON({ model: M.coder, system: "json please", user: "x", schema: { name: "verdict", strict: true, schema } });
      const b2 = up.last("/chat/completions").body;
      assert.deepEqual(b2.response_format.json_schema, { name: "verdict", strict: true, schema });
      assert.ok(!("reasoning" in b2));
    });

    it("completeJSON: invalid JSON and upstream errors become upstream_error", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario({ chat: { content: "I cannot classify that." } });
      await rejectsUpstream(or.completeJSON({ model: M.deepseek, system: "json", user: "x" }), /did not return a JSON object/);
      up.setScenario({ chat: { content: "[1,2]" } });
      await rejectsUpstream(or.completeJSON({ model: M.deepseek, system: "json", user: "x" }), /JSON object/);
      up.setScenario("chat_rate_limited");
      await rejectsUpstream(or.completeJSON({ model: M.deepseek, system: "json", user: "x" }), /rate limited/);
    });
  });

  describe("openai", () => {
    it("chat: reasoning_effort, include_usage, max_completion_tokens; costUsd null when not reported", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      const { cost, ...usageNoCost } = up.scenario.chat.usage;
      assert.ok(cost);
      up.setScenario({ chat: { usageStyle: "openai", usage: usageNoCost, provider: null } });
      const events = await collect(oa.streamChat({ model: M.sol, messages: USER_MSG, effort: "none", maxTokens: 64, zdr: true, sessionId: "s1" }));
      assert.equal(deltasOf(events), "Hello from mock upstream.");
      const usage = events.at(-1);
      assert.equal(usage.costUsd, null);
      assert.equal(usage.upstreamProvider, "OpenAI");
      assert.equal(usage.reasoningTokens, 3);
      const req = up.last("/chat/completions");
      assert.deepEqual(req.body, {
        model: "gpt-6.2-sol",
        messages: USER_MSG,
        stream: true,
        max_completion_tokens: 64,
        stream_options: { include_usage: true },
        reasoning_effort: "low",
        prompt_cache_key: "s1",
      });
      assert.equal(req.headers.authorization, "Bearer sk-test-openai");
      assert.equal(req.headers["http-referer"], undefined);
    });

    it("chat: 'none' passes through for models that allow it", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      await collect(oa.streamChat({ model: M.luna, messages: USER_MSG, effort: "none" }));
      assert.equal(up.last("/chat/completions").body.reasoning_effort, "none");
    });

    it("auth errors never echo the key", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      up.setScenario("chat_auth_error");
      await assert.rejects(collect(oa.streamChat({ model: M.luna, messages: USER_MSG })), (err) => {
        assert.equal(err.code, "upstream_error");
        assert.equal(err.message, "openai: authentication failed (401, invalid_request_error)");
        assert.doesNotMatch(JSON.stringify({ m: err.message, e: err.extra }), /sk-/);
        return true;
      });
    });

    it("429 insufficient_quota reads as missing credits, not a rate limit", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      up.setScenario("chat_quota");
      await assert.rejects(oa.completeJSON({ model: M.luna, system: "json", user: "x" }), (err) => {
        assert.equal(err.code, "upstream_error");
        assert.equal(err.message, "openai: insufficient upstream credits (429, insufficient_quota)");
        assert.equal(err.extra.upstreamType, "insufficient_quota");
        return true;
      });
    });

    it("completeJSON uses reasoning_effort (not the OpenRouter reasoning object)", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      const out = await oa.completeJSON({ model: M.luna, system: "Return JSON.", user: "hi" });
      assert.deepEqual(out.json, { ok: true });
      const body = up.last("/chat/completions").body;
      assert.equal(body.reasoning_effort, "none");
      assert.ok(!("reasoning" in body) && !("provider" in body));
    });

    it("images: allowlisted params only, base64 -> data URL, one unit", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      const progress = [];
      const out = await oa.generateMedia({
        model: M.gptImage,
        job: "image",
        prompt: "a lighthouse at dusk",
        params: { quality: "low", aspect: "16:9", num_images: 4, image_size: "square_hd" },
        onProgress: (p) => progress.push(p),
      });
      assert.equal(out.media.length, 1);
      assert.equal(out.media[0].type, "image");
      assert.equal(out.media[0].mime, "image/png");
      assert.match(out.media[0].url, /^data:image\/png;base64,iVBOR/);
      assert.equal(out.units, 1);
      assert.equal(out.costUsd, null);
      assert.deepEqual(progress, [{ status: "running" }]);
      const req = up.last("/images/generations");
      assert.deepEqual(req.body, { model: "gpt-image-1-mini", prompt: "a lighthouse at dusk", n: 1, size: "1024x1024", quality: "low" });
      assert.equal(req.headers.authorization, "Bearer sk-test-openai");
    });

    it("images: multi-megabyte base64 responses are accepted", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      up.setScenario({ images: { b64Bytes: 6 * 1024 * 1024 } });
      const out = await oa.generateMedia({ model: M.gptImage, job: "image", prompt: "big" });
      assert.ok(out.media[0].url.length > 6 * 1024 * 1024);
    });

    it("images: errors map to upstream_error; non-image jobs are refused", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      up.setScenario("images_error");
      await rejectsUpstream(oa.generateMedia({ model: M.gptImage, job: "image", prompt: "x" }), /^openai: Invalid size \(400, invalid_request_error\)$/);
      await assert.rejects(oa.generateMedia({ model: M.gptImage, job: "video", prompt: "x" }), { status: 400, code: "bad_request" });
    });
  });

  describe("selfhosted", () => {
    it("is configured only by a base URL; key is optional", async () => {
      assert.equal(createSelfhostedProvider(loadConfig({ GODE_MOCK: "0" })).configured(), false);
      const sh = createSelfhostedProvider(realConfig(up, { SELFHOSTED_BASE_URL: up.urls.selfhosted }));
      assert.equal(sh.configured(), true);
      up.setScenario({ chat: { provider: null } });
      const events = await collect(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG, effort: "none", maxTokens: 100, zdr: true, sessionId: "s" }));
      assert.equal(deltasOf(events), "Hello from mock upstream.");
      assert.equal(events.at(-1).upstreamProvider, "self-hosted");
      const req = up.last("/chat/completions");
      assert.equal(req.headers.authorization, undefined);
      assert.deepEqual(req.body, {
        model: "qwen3.8-27b",
        messages: USER_MSG,
        stream: true,
        max_tokens: 100,
        stream_options: { include_usage: true },
        reasoning_effort: "none",
        chat_template_kwargs: { enable_thinking: false },
      });
    });

    it("sends a Bearer key when one is configured", async () => {
      const sh = createSelfhostedProvider(realConfig(up, { SELFHOSTED_BASE_URL: up.urls.selfhosted, SELFHOSTED_API_KEY: "local-key" }));
      await collect(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG, effort: "high" }));
      const req = up.last("/chat/completions");
      assert.equal(req.headers.authorization, "Bearer local-key");
      assert.equal(req.body.reasoning_effort, "high");
      assert.ok(!("chat_template_kwargs" in req.body));
    });
  });

  describe("fal", () => {
    const falPaths = () => up.find("/fal/").map((r) => `${r.method} ${r.path.replace(/[0-9a-f-]{36}/, ":id")}`);

    it("submits, polls status_url (202 -> 200), fetches response_url and reports progress", async () => {
      const fal = createFalProvider(realConfig(up));
      const progress = [];
      const out = await fal.generateMedia({ model: M.klein, job: "image", prompt: "a red fox", onProgress: (p) => progress.push(p) });
      assert.deepEqual(out, { media: [{ type: "image", url: "https://v3.fal.media/files/mock/image.png", mime: "image/png" }], units: 1, costUsd: null });
      assert.deepEqual(progress, [{ status: "queued", position: 1 }, { status: "queued", position: 0 }, { status: "running" }]);
      assert.deepEqual(falPaths(), [
        "POST /fal/blackforestlabs/flux-3/klein/text-to-image",
        "GET /fal/blackforestlabs/flux-3/requests/:id/status",
        "GET /fal/blackforestlabs/flux-3/requests/:id/status",
        "GET /fal/blackforestlabs/flux-3/requests/:id/status",
        "GET /fal/blackforestlabs/flux-3/requests/:id",
      ]);
      const submit = up.find("/fal/")[0];
      assert.deepEqual(submit.body, { image_size: "square_hd", num_images: 1, prompt: "a red fox" });
      assert.equal(submit.headers.authorization, "Key fal-test-key");
      assert.equal(submit.headers["x-fal-store-io"], "0");
      for (const r of up.find("/fal/")) assert.equal(r.headers.authorization, "Key fal-test-key");
    });

    it("merges model params, caller params and the prompt; strips catalog-only keys", async () => {
      const fal = createFalProvider(realConfig(up));
      const out = await fal.generateMedia({ model: M.veoLite, job: "video", prompt: "waves", params: { aspect: "9:16", seed: 7, duration_s: 30 } });
      assert.deepEqual(out.media, [{ type: "video", url: "https://v3.fal.media/files/mock/clip.mp4", mime: "video/mp4" }]);
      assert.equal(out.units, 4); // "4s"
      assert.deepEqual(up.find("/fal/")[0].body, {
        resolution: "720p",
        duration: "4s",
        aspect_ratio: "9:16",
        generate_audio: true,
        seed: 7,
        prompt: "waves",
      });
    });

    it("TTS models get the text under prompt_field, billed per 1k characters", async () => {
      const fal = createFalProvider(realConfig(up));
      const prompt = "Hello there, this is a narration test.";
      const out = await fal.generateMedia({ model: M.tts, job: "voice", prompt });
      assert.equal(out.media[0].type, "audio");
      assert.equal(out.units, Math.round((prompt.length / 1000) * 10000) / 10000);
      assert.deepEqual(up.find("/fal/")[0].body, { text: prompt });
    });

    it("computes units per price_unit", async () => {
      const fal = createFalProvider(realConfig(up));
      // megapixel: result reports 1024x1024
      assert.equal((await fal.generateMedia({ model: M.schnell, prompt: "x" })).units, 1.0486);
      // megapixel without dimensions in the result: falls back to the preset (landscape_16_9)
      up.setScenario({ fal: { result: { images: [{ url: "https://v3.fal.media/files/mock/a.png" }] } } });
      assert.equal((await fal.generateMedia({ model: M.schnell, prompt: "x" })).units, 0.5898);
      up.setScenario("ok");
      assert.equal((await fal.generateMedia({ model: M.wanFast, prompt: "x" })).units, 1); // request
      assert.equal((await fal.generateMedia({ model: M.elevenMusic, prompt: "x" })).units, 1); // 30 s -> 1 minute
      const long = { ...M.elevenMusic, params: { music_length_ms: 90000 } };
      assert.equal((await fal.generateMedia({ model: long, prompt: "x" })).units, 2);
      const twoImages = { images: [{ url: "https://v3.fal.media/a.png" }, { url: "https://v3.fal.media/b.png" }] };
      up.setScenario({ fal: { result: twoImages } });
      assert.equal((await fal.generateMedia({ model: M.klein, prompt: "x" })).units, 2);
    });

    it("accepts bare URL strings and audio_file; drops non-https media URLs", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario({ fal: { result: { audio: "https://v3.fal.media/song.mp3", audio_file: { url: "javascript:alert(1)" } } } });
      const out = await fal.generateMedia({ model: { ...M.wanFast, slug: "google/lyria-3.5", price_unit: "request" }, prompt: "x" });
      assert.deepEqual(out.media, [{ type: "audio", url: "https://v3.fal.media/song.mp3" }]);
    });

    it("a COMPLETED status with an error is upstream_error, and is not cancelled", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario("fal_failed");
      await rejectsUpstream(fal.generateMedia({ model: M.klein, prompt: "x" }), /runner_server_error/);
      assert.equal(up.find("/cancel").length, 0);
    });

    it("result errors (422 detail) and results without media are upstream_error", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario("fal_result_error");
      await rejectsUpstream(fal.generateMedia({ model: M.klein, prompt: "x" }), /^fal: prompt: field required \(422, value_error\.missing\)$/);
      up.setScenario("fal_no_media");
      await rejectsUpstream(fal.generateMedia({ model: M.klein, prompt: "x" }), /no media in result/);
    });

    it("submit errors are upstream_error", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario("fal_submit_error");
      await rejectsUpstream(fal.generateMedia({ model: M.klein, prompt: "x" }), /^fal: authentication failed \(401, rejected_key\)$/);
    });

    it("abort while queued cancels the request and rejects with AbortError", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario("fal_stuck");
      const ac = new AbortController();
      const p = fal.generateMedia({ model: M.klein, prompt: "x", signal: ac.signal });
      setTimeout(() => ac.abort(), 60);
      await assert.rejects(p, { name: "AbortError" });
      const cancels = up.find("/cancel");
      assert.equal(cancels.length, 1);
      assert.equal(cancels[0].method, "PUT");
      assert.match(cancels[0].path, /^\/fal\/blackforestlabs\/flux-3\/requests\/[0-9a-f-]{36}\/cancel$/);
      assert.equal(cancels[0].headers.authorization, "Key fal-test-key");
    });

    it("times out after FAL_TIMEOUT_MS with upstream_error and cancels", async () => {
      const fal = createFalProvider(realConfig(up, { FAL_TIMEOUT_MS: "80" }));
      up.setScenario("fal_stuck");
      await rejectsUpstream(fal.generateMedia({ model: M.klein, prompt: "x" }), /^fal: timed out$/);
      assert.equal(up.find("/cancel").length, 1);
    });

    it("ignores returned queue URLs on another host (the key would leak) and builds its own", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario({ fal: { foreignUrls: true } });
      const out = await fal.generateMedia({ model: M.klein, prompt: "x" });
      assert.equal(out.media.length, 1);
      for (const r of up.find("/fal/")) assert.ok(r.path.startsWith("/fal/blackforestlabs/flux-3"));
    });

    it("validates inputs before calling out", async () => {
      const fal = createFalProvider(realConfig(up));
      await assert.rejects(fal.generateMedia({ model: { ...M.klein, slug: "../../etc" }, prompt: "x" }), TypeError);
      await assert.rejects(fal.generateMedia({ model: M.klein, prompt: "  " }), { code: "bad_request" });
      await assert.rejects(fal.generateMedia({ model: M.klein, prompt: "x", signal: AbortSignal.abort() }), { name: "AbortError" });
      assert.equal(up.requests.length, 0);
      const unconfigured = createFalProvider(loadConfig({ GODE_MOCK: "0", OPENAI_API_KEY: "x" }));
      await assert.rejects(unconfigured.generateMedia({ model: M.klein, prompt: "x" }), { code: "gateway_not_configured" });
    });
  });
});

describe("mock provider", () => {
  const mock = createMockProvider(loadConfig({ GODE_MOCK: "1" }));

  it("streams word by word, names the model, echoes the user text, ends with one usage event", async () => {
    const events = await collect(mock.streamChat({ model: M.opus, messages: USER_MSG, effort: "high" }));
    const answer = deltasOf(events);
    assert.match(answer, /Claude Opus 5\.5/);
    assert.match(answer, /Email \[EMAIL_1\] about the launch/);
    assert.ok(events.filter((e) => e.type === "delta").length > 5);
    const usage = events.at(-1);
    assert.equal(events.filter((e) => e.type === "usage").length, 1);
    assert.equal(usage.type, "usage");
    assert.equal(usage.costUsd, null);
    assert.equal(usage.reasoningTokens, 256);
    assert.ok(usage.outputTokens > usage.reasoningTokens && usage.inputTokens > 0);
  });

  it("is deterministic", async () => {
    const a = deltasOf(await collect(mock.streamChat({ model: M.deepseek, messages: USER_MSG })));
    const b = deltasOf(await collect(mock.streamChat({ model: M.deepseek, messages: USER_MSG })));
    assert.equal(a, b);
  });

  it("honours abort mid-stream", async () => {
    const ac = new AbortController();
    let n = 0;
    await assert.rejects(
      (async () => {
        for await (const ev of mock.streamChat({ model: M.opus, messages: USER_MSG, signal: ac.signal })) {
          if (ev.type === "delta" && ++n === 2) ac.abort();
        }
      })(),
      { name: "AbortError" }
    );
    assert.equal(n, 2);
  });

  it("simulates upstream failures on request", async () => {
    await rejectsUpstream(collect(mock.streamChat({ model: M.opus, messages: [{ role: "user", content: "GODE_MOCK_FAIL now" }] })), /mock/);
    const seen = [];
    await rejectsUpstream(
      (async () => {
        for await (const ev of mock.streamChat({ model: M.opus, messages: [{ role: "user", content: "GODE_MOCK_FAIL_MIDSTREAM" }] })) seen.push(ev);
      })(),
      /mid-stream/
    );
    assert.equal(seen.length, 1);
    await rejectsUpstream(mock.generateMedia({ model: M.klein, job: "image", prompt: "GODE_MOCK_FAIL" }), /media/);
  });

  it("classifies by keywords when called with the classifier prompt, {} otherwise", async () => {
    const system = `You are the router. ${CLASSIFIER_MARKER}. Answer in JSON.`;
    const cases = {
      "Draw a logo for my bakery": "image",
      "make a short video clip of waves": "video",
      "write a song about autumn": "music",
      "please read aloud this paragraph": "voice",
      "fix this bug in my javascript": "code",
      "```\nconst x = 1\n```\nwhy?": "code",
      "what's the capital of France?": "chat",
    };
    for (const [prompt, job] of Object.entries(cases)) {
      const out = await mock.completeJSON({ model: M.deepseek, system, user: prompt });
      assert.equal(out.json.job, job, prompt);
      assert.equal(out.json.private, false);
      assert.ok(out.json.difficulty >= 1 && out.json.difficulty <= 5);
      assert.ok(out.json.title.split(" ").length <= 5);
      assert.equal(out.usage.costUsd, null);
    }
    const env = await mock.completeJSON({ model: M.deepseek, system, user: JSON.stringify({ text: "animate my logo" }) });
    assert.equal(env.json.job, "video");
    assert.deepEqual((await mock.completeJSON({ model: M.deepseek, system: "Judge these answers", user: "A or B?" })).json, {});
  });

  it("difficulty grows with length and hard keywords; title is the first 5 words", () => {
    assert.equal(mockClassify("hi").difficulty, 1);
    assert.ok(mockClassify(`Analyze the trade-offs ${"of this design ".repeat(20)}`).difficulty >= 4);
    assert.equal(mockClassify("Email [PERSON_1] about the quarterly results please").title, "Email [PERSON_1] about the quarterly");
    assert.equal(mockClassify("write a python function").difficulty, 2);
  });

  it("generates SVG images (also for video) and WAV audio as data URLs, one unit, with progress", async () => {
    const progress = [];
    const img = await mock.generateMedia({ model: M.klein, job: "image", prompt: "a <cat> & dog", onProgress: (p) => progress.push(p) });
    assert.equal(img.media[0].type, "image");
    assert.match(img.media[0].url, /^data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(img.media[0].url.split(",")[1], "base64").toString();
    assert.match(svg, /&lt;cat&gt; &amp; dog/);
    assert.equal(img.units, 1);
    assert.equal(img.costUsd, null);
    assert.deepEqual(progress.map((p) => p.status), ["queued", "running"]);
    const vid = await mock.generateMedia({ model: M.veoLite, job: "video", prompt: "waves" });
    assert.equal(vid.media[0].type, "image");
    for (const job of ["voice", "music"]) {
      const a = await mock.generateMedia({ model: M.tts, job, prompt: "hello" });
      assert.equal(a.media[0].type, "audio");
      assert.equal(a.media[0].mime, "audio/wav");
      const wav = Buffer.from(a.media[0].url.split(",")[1], "base64");
      assert.equal(wav.toString("ascii", 0, 4), "RIFF");
      assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    }
    await assert.rejects(mock.generateMedia({ model: M.klein, job: "image", prompt: "x", signal: AbortSignal.abort() }), { name: "AbortError" });
  });
});

describe("registry", () => {
  it("mock mode serves every gateway with the mock and every enabled model is available", () => {
    const providers = createProviders(loadConfig({ GODE_MOCK: "1" }));
    for (const g of ["openrouter", "openai", "selfhosted", "fal"]) assert.equal(providers.get(g).name, "mock");
    assert.equal(providers.isAvailable(M.opus), true);
    assert.equal(providers.isAvailable(M.qwenSelf), true);
    assert.equal(providers.isAvailable({ ...M.opus, enabled: false }), false);
    assert.equal(providers.isAvailable(null), false);
    assert.deepEqual(providers.status(), { openrouter: true, openai: true, selfhosted: true, fal: true });
  });

  it("real mode: available only where the gateway is configured", () => {
    const providers = createProviders(loadConfig({ GODE_MOCK: "0", OPENROUTER_API_KEY: "k" }));
    assert.equal(providers.get("openrouter").name, "openrouter");
    assert.equal(providers.get("openai").name, "openai");
    assert.equal(providers.get("openai").configured(), false);
    assert.equal(providers.isAvailable(M.opus), true);
    assert.equal(providers.isAvailable({ ...M.opus, enabled: false }), false);
    assert.equal(providers.isAvailable(M.luna), false);
    assert.equal(providers.isAvailable(M.qwenSelf), false);
    assert.equal(providers.isAvailable(M.klein), false);
    assert.equal(providers.isAvailable({ ...M.opus, gateway: "nope" }), false);
    assert.throws(() => providers.get("nope"), { code: "gateway_not_configured" });
    assert.deepEqual(providers.status(), { openrouter: true, openai: false, selfhosted: false, fal: false });

    const all = createProviders(loadConfig({ GODE_MOCK: "0", OPENAI_API_KEY: "k", FAL_KEY: "f", SELFHOSTED_BASE_URL: "http://gpu:8000/v1" }));
    assert.equal(all.isAvailable(M.luna), true);
    assert.equal(all.isAvailable(M.qwenSelf), true);
    assert.equal(all.isAvailable(M.klein), true);
    assert.equal(all.isAvailable(M.opus), false);
  });

  it("accepts provider overrides as a test seam", () => {
    const fake = { name: "fake", configured: () => true };
    const providers = createProviders(loadConfig({ GODE_MOCK: "0" }), { providers: { openrouter: fake } });
    assert.equal(providers.get("openrouter"), fake);
    assert.equal(providers.isAvailable(M.opus), true);
  });
});

describe("mock-upstream helper (shared by other test files)", () => {
  let up;
  before(async () => {
    up = await startMockUpstream();
  });
  after(async () => {
    await up.close();
  });
  beforeEach(() => up.reset());

  it("Presidio /analyze finds emails; /health is up; presidio_down answers 500", async () => {
    const text = "Mail ada@example.com or bob@test.org";
    const res = await fetch(`${up.urls.presidio}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "en", score_threshold: 0.5 }),
    });
    const entities = await res.json();
    assert.deepEqual(entities.map((e) => [e.entity_type, text.slice(e.start, e.end)]), [
      ["EMAIL_ADDRESS", "ada@example.com"],
      ["EMAIL_ADDRESS", "bob@test.org"],
    ]);
    assert.equal(await (await fetch(`${up.urls.presidio}/health`)).text(), "Presidio Analyzer service is up");
    up.setScenario("presidio_down");
    assert.equal((await fetch(`${up.urls.presidio}/analyze`, { method: "POST", body: "{}" })).status, 500);
    assert.equal(up.last("/analyze").body, "{}");
  });

  it("Stripe checkout needs auth, parses the form and returns a cs_test_ session", async () => {
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": "1000",
      "line_items[0][quantity]": "1",
      client_reference_id: "user-1",
      "metadata[user_id]": "user-1",
      "metadata[credit_micros]": "10000000",
    });
    const post = (headers) =>
      fetch(`${up.urls.stripe}/v1/checkout/sessions`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body: form });
    assert.equal((await post({})).status, 401);
    const session = await (await post({ Authorization: "Bearer sk_test_123" })).json();
    assert.match(session.id, /^cs_test_/);
    assert.match(session.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.deepEqual(session.metadata, { user_id: "user-1", credit_micros: "10000000" });
    assert.equal(session.amount_total, 1000);
    assert.equal(up.last("/checkout").body["metadata[user_id]"], "user-1");
    up.setScenario("stripe_error");
    assert.equal((await post({ Authorization: "Bearer sk_test_123" })).status, 400);
  });

  it("scenario presets merge with overrides and unknown presets throw", () => {
    const sc = up.setScenario({ name: "chat_slow", chat: { delayMs: 1 } });
    assert.equal(sc.chat.mode, "slow");
    assert.equal(sc.chat.delayMs, 1);
    assert.equal(sc.fal.mode, "ok");
    assert.throws(() => up.setScenario("nope"), /unknown scenario/);
  });

  it("fal status URLs with the endpoint sub-path answer 405, like real fal", async () => {
    const res = await fetch(`${up.urls.fal}/fal-ai/flux/schnell/requests/abc/status`);
    assert.equal(res.status, 405);
  });
});
