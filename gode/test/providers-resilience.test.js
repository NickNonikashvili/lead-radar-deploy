// Providers under failure: stream deadlines (first byte, idle), the self-hosted outage window that
// makes isAvailable() false so the picker can apply PRIVATE_FALLBACK, early reporting of the
// upstream provider (meta events, err.extra.upstreamProvider), and fal's retries of transient
// polling/result failures.
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { loadConfig } = require("../src/config");
const { AppError } = require("../src/util");
const { createProviders } = require("../src/providers");
const { createOpenRouterProvider } = require("../src/providers/openrouter");
const { createOpenAIProvider } = require("../src/providers/openai");
const { createSelfhostedProvider } = require("../src/providers/selfhosted");
const { createFalProvider, isTransient, retryAfterMs } = require("../src/providers/fal");
const { createDeadline, TIMEOUT_MESSAGE } = require("../src/providers/openaiCompatible");
const { startMockUpstream } = require("./helpers/mock-upstream");

const text = ["chat", "code", "action"];
const M = {
  opus: {
    id: "openrouter:anthropic/claude-opus-5.5", label: "Claude Opus 5.5", gateway: "openrouter", slug: "anthropic/claude-opus-5.5",
    jobs: text, supports_reasoning: true, enabled: true,
    params: { reasoning: { mandatory: true, efforts: ["max", "xhigh", "high", "medium", "low"] } },
  },
  luna: {
    id: "openai:gpt-6-luna", label: "GPT-6 Luna", gateway: "openai", slug: "gpt-6-luna", jobs: text, supports_reasoning: true,
    enabled: true, params: { reasoning: { mandatory: false, efforts: ["max", "xhigh", "high", "medium", "low", "none"] } },
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
};
const USER_MSG = [{ role: "user", content: "Email [EMAIL_1] about the launch" }];

async function collect(gen) {
  const events = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

/** Run a stream to its end; returns { events, err }. */
async function drain(gen) {
  const events = [];
  try {
    for await (const ev of gen) events.push(ev);
    return { events, err: null };
  } catch (err) {
    return { events, err };
  }
}

function assertTimeout(err, kind) {
  assert.ok(err instanceof AppError, `expected AppError, got ${err?.name}: ${err?.message}`);
  assert.equal(err.code, "upstream_error");
  assert.equal(err.message, TIMEOUT_MESSAGE);
  assert.equal(err.message, "The model took too long to respond.");
  assert.equal(err.extra.timeout, kind);
  assert.equal(err.extra.upstreamType, "timeout");
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

async function closedPortUrl() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}/v1`;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait until the mock upstream has seen the client hang up (it records closedEarly on 'close').
async function closedSoon(up, fragment) {
  for (let i = 0; i < 50 && !up.last(fragment)?.closedEarly; i++) await wait(10);
  return up.last(fragment)?.closedEarly;
}

describe("createDeadline", () => {
  it("first-byte budget survives pauses; idle starts only after data; clear() stops everything", async () => {
    const d = createDeadline({ firstByteMs: 60, idleMs: 30 });
    d.pause();
    await wait(80); // paused: the consumer's time is not counted
    assert.equal(d.kind, null);
    d.resume();
    await wait(90);
    assert.equal(d.kind, "first_byte");
    assert.equal(d.signal.aborted, true);
    assert.equal(d.signal.reason.name, "TimeoutError");

    const e = createDeadline({ firstByteMs: 1000, idleMs: 30 });
    e.data();
    e.resume();
    await wait(60);
    assert.equal(e.kind, "idle");

    const f = createDeadline({ firstByteMs: 20, idleMs: 20 });
    f.clear();
    await wait(40);
    assert.equal(f.kind, null);

    const off = createDeadline({ firstByteMs: 0, idleMs: 0 });
    await wait(10);
    assert.equal(off.kind, null, "0 disables a deadline");
  });
});

describe("providers under failure (mock upstream)", () => {
  let up;
  before(async () => {
    up = await startMockUpstream();
  });
  after(async () => {
    await up.close();
  });
  beforeEach(() => up.reset());

  describe("stream deadlines", () => {
    it("keepalive comments alone never count: a 200 stream with no data hits the first-byte deadline", async () => {
      // Regression: an upstream sending ': keepalive' forever kept the stream, the hold and the
      // spinner open with no bound.
      const sh = createSelfhostedProvider(realConfig(up, { SELFHOSTED_BASE_URL: up.urls.selfhosted, TEXT_FIRST_BYTE_TIMEOUT_MS: "150" }));
      up.setScenario("chat_keepalive_only");
      const t0 = Date.now();
      const { events, err } = await drain(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG, effort: "none" }));
      const elapsed = Date.now() - t0;
      assertTimeout(err, "first_byte");
      assert.ok(elapsed >= 140 && elapsed < 1500, `elapsed ${elapsed} ms`);
      assert.deepEqual(events, [{ type: "meta", upstreamProvider: "self-hosted" }]);
      assert.equal(err.extra.upstreamProvider, "self-hosted");
      assert.ok(await closedSoon(up, "/chat/completions"), "the upstream connection is closed");
    });

    it("an upstream that never answers (no headers) hits the first-byte deadline too", async () => {
      const or = createOpenRouterProvider(realConfig(up, { TEXT_FIRST_BYTE_TIMEOUT_MS: "120" }));
      up.setScenario("chat_hang");
      const { events, err } = await drain(or.streamChat({ model: M.opus, messages: USER_MSG, effort: "low" }));
      assertTimeout(err, "first_byte");
      assert.deepEqual(events, []);
      assert.ok(await closedSoon(up, "/chat/completions"));
    });

    it("a stream that stalls after some data hits the idle deadline and says who had the prompt", async () => {
      const or = createOpenRouterProvider(realConfig(up, { TEXT_IDLE_TIMEOUT_MS: "150" }));
      up.setScenario("chat_stall");
      const t0 = Date.now();
      const { events, err } = await drain(or.streamChat({ model: M.opus, messages: USER_MSG, effort: "low" }));
      assertTimeout(err, "idle");
      assert.ok(Date.now() - t0 < 1500);
      assert.deepEqual(events, [
        { type: "meta", upstreamProvider: "MockProvider" },
        { type: "delta", text: "Hello" },
      ]);
      assert.equal(err.extra.upstreamProvider, "MockProvider");
    });

    it("a slow consumer is not blamed on the upstream (the clock stops while an event is handled)", async () => {
      const or = createOpenRouterProvider(realConfig(up, { TEXT_IDLE_TIMEOUT_MS: "100", TEXT_FIRST_BYTE_TIMEOUT_MS: "100" }));
      let first = true;
      const out = [];
      for await (const ev of or.streamChat({ model: M.opus, messages: USER_MSG, effort: "low" })) {
        if (first) {
          first = false;
          await wait(250); // longer than both deadlines
        }
        out.push(ev);
      }
      assert.equal(out.at(-1).type, "usage");
    });

    it("high efforts stretch the first-byte budget (reasoning before the first token)", async () => {
      const or = createOpenRouterProvider(realConfig(up, { TEXT_FIRST_BYTE_TIMEOUT_MS: "100" }));
      up.setScenario("chat_keepalive_only");
      const t0 = Date.now();
      const { err } = await drain(or.streamChat({ model: M.opus, messages: USER_MSG, effort: "high" }));
      assertTimeout(err, "first_byte");
      assert.ok(Date.now() - t0 >= 190, "x2 for effort high");
    });

    it("the caller's abort still wins: AbortError, not a timeout", async () => {
      const or = createOpenRouterProvider(realConfig(up, { TEXT_FIRST_BYTE_TIMEOUT_MS: "5000" }));
      up.setScenario("chat_keepalive_only");
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 60);
      await assert.rejects(collect(or.streamChat({ model: M.opus, messages: USER_MSG, signal: ac.signal })), { name: "AbortError" });
    });

    it("completeJSON is bounded by the same deadlines", async () => {
      const or = createOpenRouterProvider(realConfig(up, { TEXT_FIRST_BYTE_TIMEOUT_MS: "120" }));
      up.setScenario("chat_hang");
      await assert.rejects(or.completeJSON({ model: M.opus, user: "hi" }), (err) => {
        assertTimeout(err, "first_byte");
        return true;
      });
    });

    it("normal streams are unaffected and leave no timer behind", async () => {
      const or = createOpenRouterProvider(realConfig(up, { TEXT_FIRST_BYTE_TIMEOUT_MS: "200", TEXT_IDLE_TIMEOUT_MS: "200" }));
      const events = await collect(or.streamChat({ model: M.opus, messages: USER_MSG, effort: "low" }));
      assert.equal(events.at(-1).type, "usage");
      // A consumer that stops early must not leave the deadline armed either (it would fire later).
      for await (const ev of or.streamChat({ model: M.opus, messages: USER_MSG, effort: "low" })) {
        if (ev.type === "delta") break;
      }
      await wait(260);
    });
  });

  describe("upstream provider reporting", () => {
    it("openrouter: one meta event with the chunk's provider, before the first delta", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      const events = await collect(or.streamChat({ model: M.opus, messages: USER_MSG, effort: "low" }));
      assert.deepEqual(events[0], { type: "meta", upstreamProvider: "MockProvider" });
      assert.equal(events.filter((e) => e.type === "meta").length, 1);
      assert.equal(events.at(-1).upstreamProvider, "MockProvider");
    });

    it("a stopped stream already reported its provider", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario("chat_slow");
      const ac = new AbortController();
      const seen = [];
      await assert.rejects(
        (async () => {
          for await (const ev of or.streamChat({ model: M.opus, messages: USER_MSG, signal: ac.signal })) {
            seen.push(ev);
            if (ev.type === "delta") ac.abort();
          }
        })(),
        { name: "AbortError" }
      );
      assert.deepEqual(seen[0], { type: "meta", upstreamProvider: "MockProvider" });
    });

    it("an error chunk that is the whole stream still names its provider", async () => {
      const or = createOpenRouterProvider(realConfig(up));
      up.setScenario("chat_error_only");
      const { events, err } = await drain(or.streamChat({ model: M.opus, messages: USER_MSG }));
      assert.deepEqual(events, [{ type: "meta", upstreamProvider: "MockProvider" }]);
      assert.equal(err.code, "upstream_error");
      assert.equal(err.extra.upstreamProvider, "MockProvider");
    });

    it("gateways with one host report it as soon as the upstream accepted the request", async () => {
      const oa = createOpenAIProvider(realConfig(up));
      up.setScenario({ chat: { provider: null } });
      const events = await collect(oa.streamChat({ model: M.luna, messages: USER_MSG, effort: "low" }));
      assert.deepEqual(events[0], { type: "meta", upstreamProvider: "OpenAI" });
      // A rejected request reached the upstream too; a network error did not.
      up.setScenario("chat_error");
      const rejected = await drain(oa.streamChat({ model: M.luna, messages: USER_MSG }));
      assert.equal(rejected.err.extra.upstreamProvider, "OpenAI");
      const down = createOpenAIProvider(loadConfig({ GODE_MOCK: "0", OPENAI_API_KEY: "k", OPENAI_BASE_URL: await closedPortUrl() }));
      const unreached = await drain(down.streamChat({ model: M.luna, messages: USER_MSG }));
      assert.equal(unreached.err.message, "openai: network error");
      assert.equal(unreached.err.extra.upstreamProvider, undefined);
    });
  });

  describe("self-hosted outage window", () => {
    it("a connection failure marks the server down for SELFHOSTED_RETRY_MS, so isAvailable() is false", async () => {
      const url = await closedPortUrl();
      const config = loadConfig({ GODE_MOCK: "0", OPENROUTER_API_KEY: "k", SELFHOSTED_BASE_URL: url, SELFHOSTED_RETRY_MS: "150" });
      const providers = createProviders(config);
      assert.equal(providers.isAvailable(M.qwenSelf), true, "configured and not known to be down");
      const { err } = await drain(providers.get("selfhosted").streamChat({ model: M.qwenSelf, messages: USER_MSG }));
      assert.equal(err.message, "selfhosted: network error");
      assert.equal(providers.isAvailable(M.qwenSelf), false);
      assert.ok(providers.downUntil("selfhosted") > Date.now());
      assert.equal(providers.isAvailable(M.opus), true, "other gateways are unaffected");
      assert.equal(providers.status().selfhosted, true, "status() still reports configuration");
      await wait(170);
      assert.equal(providers.isAvailable(M.qwenSelf), true, "retried after the window");
      assert.equal(providers.downUntil("selfhosted"), 0);
    });

    it("502/503/504 and a first-byte timeout mark it down; a 4xx does not; a good answer clears it", async () => {
      const sh = createSelfhostedProvider(
        realConfig(up, { SELFHOSTED_BASE_URL: up.urls.selfhosted, SELFHOSTED_RETRY_MS: "60000", TEXT_FIRST_BYTE_TIMEOUT_MS: "100" })
      );
      up.setScenario({ chat: { mode: "error", status: 400 } });
      await drain(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG }));
      assert.equal(sh.available(), true, "a rejected request says nothing about the server");

      up.setScenario({ chat: { mode: "error", status: 503, error: { message: "Service Unavailable" } } });
      const r503 = await drain(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG }));
      assert.match(r503.err.message, /^selfhosted: server unavailable \(503\)$/);
      assert.equal(sh.available(), false);

      up.setScenario("ok");
      await collect(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG }));
      assert.equal(sh.available(), true, "a direct call that works clears the mark");

      up.setScenario("chat_keepalive_only");
      const slow = await drain(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG }));
      assertTimeout(slow.err, "first_byte");
      assert.equal(sh.available(), false);

      up.setScenario("ok");
      await sh.completeJSON({ model: M.qwenSelf, user: "hi" });
      assert.equal(sh.available(), true);
      up.setScenario("chat_hang");
      await assert.rejects(sh.completeJSON({ model: M.qwenSelf, user: "hi" }), { code: "upstream_error" });
      assert.equal(sh.available(), false, "the classifier path marks it down too");
    });

    it("the caller's abort and mid-stream idle stalls never mark it down", async () => {
      const sh = createSelfhostedProvider(realConfig(up, { SELFHOSTED_BASE_URL: up.urls.selfhosted, TEXT_IDLE_TIMEOUT_MS: "100" }));
      up.setScenario("chat_stall");
      const stalled = await drain(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG }));
      assertTimeout(stalled.err, "idle");
      assert.equal(sh.available(), true, "it served data: up, just slow");
      up.setScenario("chat_keepalive_only");
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 50);
      await assert.rejects(collect(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG, signal: ac.signal })), { name: "AbortError" });
      assert.equal(sh.available(), true);
    });

    it("SELFHOSTED_RETRY_MS=0 never marks it down; OpenRouter is never marked down", async () => {
      const url = await closedPortUrl();
      const sh = createSelfhostedProvider(loadConfig({ GODE_MOCK: "0", SELFHOSTED_BASE_URL: url, SELFHOSTED_RETRY_MS: "0" }));
      await drain(sh.streamChat({ model: M.qwenSelf, messages: USER_MSG }));
      assert.equal(sh.available(), true);
      const or = createOpenRouterProvider(loadConfig({ GODE_MOCK: "0", OPENROUTER_API_KEY: "k", OPENROUTER_BASE_URL: url }));
      await drain(or.streamChat({ model: M.opus, messages: USER_MSG }));
      assert.equal(or.available(), true, "one route failing says nothing about OpenRouter's other hosts");
    });
  });

  describe("fal transient failures", () => {
    const falPaths = () => up.find("/fal/").map((r) => `${r.method} ${r.path.replace(/[0-9a-f-]{36}/, ":id")}`);

    it("a 503 between IN_PROGRESS polls is retried: the job completes and is never cancelled", async () => {
      // Regression: one 503 among the polls cancelled a running (billed) generation.
      const fal = createFalProvider(realConfig(up));
      up.setScenario({ fal: { polls: 4, statusFailures: { 3: 503 } } });
      const out = await fal.generateMedia({ model: M.klein, prompt: "a red fox" });
      assert.equal(out.media.length, 1);
      assert.equal(up.find("/cancel").length, 0);
      assert.deepEqual(falPaths(), [
        "POST /fal/blackforestlabs/flux-3/klein/text-to-image",
        // Polls 1, 2 and 4 answer 202, poll 3 fails with 503 and is retried, poll 5 is COMPLETED.
        ...Array(5).fill("GET /fal/blackforestlabs/flux-3/requests/:id/status"),
        "GET /fal/blackforestlabs/flux-3/requests/:id",
      ]);
    });

    it("network errors and 429/502 on polls are retried, honouring Retry-After", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario({ fal: { polls: 2, statusFailures: { 1: "reset", 2: 429, 3: 502 }, retryAfter: "0.2" } });
      const t0 = Date.now();
      const out = await fal.generateMedia({ model: M.klein, prompt: "x" });
      assert.equal(out.media.length, 1);
      assert.ok(Date.now() - t0 >= 380, "two Retry-After waits of 200 ms");
      assert.equal(up.find("/cancel").length, 0);
    });

    it("a transient failure on the result GET after COMPLETED is retried, not dropped", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario({ fal: { resultFailures: [502, "reset", 504] } });
      const out = await fal.generateMedia({ model: M.klein, prompt: "x" });
      assert.equal(out.media.length, 1);
      assert.equal(up.find("/fal/").filter((r) => /\/requests\/[0-9a-f-]{36}$/.test(r.path)).length, 4);
      assert.equal(up.find("/cancel").length, 0);
    });

    it("a final failure (404 on a poll) fails fast and cancels the job it can no longer follow", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario({ fal: { polls: 3, statusFailures: { 2: 404 } } });
      await assert.rejects(fal.generateMedia({ model: M.klein, prompt: "x" }), (err) => {
        assert.equal(err.code, "upstream_error");
        assert.equal(err.extra.upstreamStatus, 404);
        return true;
      });
      assert.equal(up.find("/status").length, 2);
      assert.equal(up.find("/cancel").length, 1);
    });

    it("a fal that stays unavailable ends at FAL_TIMEOUT_MS ('fal: timed out') and cancels", async () => {
      const fal = createFalProvider(realConfig(up, { FAL_TIMEOUT_MS: "250" }));
      const always = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [i + 1, 503]));
      up.setScenario({ fal: { statusFailures: always } });
      const t0 = Date.now();
      await assert.rejects(fal.generateMedia({ model: M.klein, prompt: "x" }), (err) => {
        assert.equal(err.message, "fal: timed out");
        return true;
      });
      assert.ok(Date.now() - t0 < 1500, "retries never outlive the job's deadline");
      assert.ok(up.find("/status").length >= 3, "it kept retrying until then");
      assert.equal(up.find("/cancel").length, 1);
    });

    it("submit is never retried (not idempotent), and fal's 503 reads as its own service", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario({ fal: { mode: "submit_error", status: 503 } });
      await assert.rejects(fal.generateMedia({ model: M.klein, prompt: "x" }), (err) => {
        assert.match(err.message, /^fal: service unavailable \(503/);
        assert.ok(!/no provider available/.test(err.message));
        return true;
      });
      assert.equal(up.find("/fal/").length, 1);
    });

    it("abort during a retry wait still cancels and rejects with AbortError", async () => {
      const fal = createFalProvider(realConfig(up));
      up.setScenario({ fal: { statusFailures: { 1: 503, 2: 503, 3: 503, 4: 503 }, retryAfter: "5" } });
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 80);
      await assert.rejects(fal.generateMedia({ model: M.klein, prompt: "x", signal: ac.signal }), { name: "AbortError" });
      assert.equal(up.find("/cancel").length, 1);
    });

    it("isTransient / retryAfterMs", () => {
      const net = new AppError(502, "upstream_error", "fal: network error", { upstreamStatus: null, networkCode: "ECONNRESET" });
      const cut = new AppError(502, "upstream_error", "fal: response interrupted", { upstreamStatus: 200, interrupted: true });
      const st = (s) => new AppError(502, "upstream_error", "fal: x", { upstreamStatus: s });
      assert.equal(isTransient(net), true);
      assert.equal(isTransient(cut), true);
      for (const s of [408, 429, 500, 502, 503, 504, 524]) assert.equal(isTransient(st(s)), true, String(s));
      for (const s of [400, 401, 403, 404, 405, 422, null]) assert.equal(isTransient(st(s)), false, String(s));
      assert.equal(isTransient(new Error("x")), false);
      assert.equal(isTransient(new AppError(400, "bad_request", "x")), false);
      assert.equal(retryAfterMs("2"), 2000);
      assert.equal(retryAfterMs("0.5"), 500);
      assert.equal(retryAfterMs(null), 0);
      assert.equal(retryAfterMs("soon"), 0);
      const later = retryAfterMs(new Date(Date.now() + 3000).toUTCString());
      assert.ok(later > 1000 && later <= 3000);
    });
  });
});
