// HTTP API: every route in docs/ARCHITECTURE.md "HTTP API", the SSE framing and disconnect
// handling, the origin check, rate limits, the error handler, static files and server.js.
// Real app (test/helpers/app.js) on an in-memory DB in mock mode; most chat-route tests inject a
// scripted pipeline to pin the transport down, and "chat with the real pipeline" runs the real one.
// Stripe goes to test/helpers/mock-upstream.js.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createTestApp } = require("./helpers/app");
const { startMockUpstream } = require("./helpers/mock-upstream");
const { AppError } = require("../src/util");

const PASSWORD = "correct-horse-battery";
const OPUS = "openrouter:anthropic/claude-opus-5.5";
const HAIKU = "openrouter:anthropic/claude-haiku-5.5";
const GEMINI = "openrouter:google/gemini-4-carbon";
const MINISTRAL = "openrouter:mistralai/ministral-3b-2512";
const FLUX_KLEIN = "fal:blackforestlabs/flux-3/klein/text-to-image";
const WEBHOOK_SECRET = "whsec_test_api_secret";
const STRIPE_KEY = "sk_test_api_0123456789";

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

let emailSeq = 0;
const nextEmail = (name = "user") => `${name}${++emailSeq}@example.test`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { timeoutMs = 3000, stepMs = 10 } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error("waitFor: timed out");
    await sleep(stepMs);
  }
}

function captureLogger() {
  const lines = [];
  const push = (...args) => lines.push(args.map(String).join(" "));
  return { lines, error: push, warn: push, log: push, info: push };
}

/** A pipeline whose behaviour each test sets with `pipe.impl = async (args) => {...}`. */
function scriptedPipeline() {
  const pipe = {
    calls: [],
    impl: async ({ emit }) => {
      emit("route", { request_id: "r1" });
      emit("done", { message_id: "m1" });
    },
    async run(args) {
      pipe.calls.push(args);
      return pipe.impl(args);
    },
  };
  return pipe;
}

async function signedIn(t, name) {
  const c = t.client();
  const user = await c.signup(nextEmail(name), PASSWORD);
  return { c, user };
}

function userRow(t, id) {
  return t.deps.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function insertConversation(t, user, { title = null, pins = {}, at = Date.now() } = {}) {
  const { db, keyring } = t.deps;
  const id = crypto.randomUUID();
  const dek = userRow(t, user.id).wrapped_dek;
  db.prepare("INSERT INTO conversations (id, user_id, title_enc, pins, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    user.id,
    title ? keyring.encrypt(dek, title) : null,
    JSON.stringify(pins),
    at,
    at
  );
  return id;
}

function insertRequest(t, fields) {
  const row = {
    id: crypto.randomUUID(),
    user_id: null,
    conversation_id: null,
    message_id: null,
    kind: "auto",
    job: "chat",
    difficulty: 2,
    private: 0,
    tier: "budget",
    model_id: OPUS,
    gateway: "openrouter",
    upstream_provider: "Anthropic",
    effort: "high",
    zdr: 0,
    pinned: 0,
    api_cost_micros: 30000,
    charged_micros: 40000,
    status: "ok",
    error_code: null,
    redactions: "{}",
    feedback: null,
    created_at: Date.now(),
    ...fields,
  };
  const cols = Object.keys(row);
  t.deps.db.prepare(`INSERT INTO requests (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((c) => row[c]));
  return row.id;
}

/** One question + answer (+ its requests row), stored the way the pipeline stores them. */
function insertTurn(t, user, conversationId, { question = "What is 2+2?", answer = "4", media, superseded = 0, request = {}, at = Date.now() } = {}) {
  const { db, keyring } = t.deps;
  const dek = userRow(t, user.id).wrapped_dek;
  const userMsgId = crypto.randomUUID();
  const asstId = crypto.randomUUID();
  const insert = db.prepare(
    "INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, superseded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insert.run(userMsgId, conversationId, user.id, "user", keyring.encrypt(dek, { text: question }, { json: true }), null, null, 0, at);
  const requestId = insertRequest(t, { user_id: user.id, conversation_id: conversationId, message_id: asstId, created_at: at + 1, ...request });
  const content = media ? { text: answer, media } : { text: answer };
  insert.run(asstId, conversationId, user.id, "assistant", keyring.encrypt(dek, content, { json: true }), userMsgId, requestId, superseded, at + 1);
  return { userMsgId, asstId, requestId };
}

function stripeSignature(body, { secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const sig = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

function paidSessionEvent(userId, { eventId = `evt_${crypto.randomUUID()}`, sessionId = `cs_test_${crypto.randomUUID()}`, type = "checkout.session.completed", cents = 1000 } = {}) {
  return {
    id: eventId,
    object: "event",
    type,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        amount_total: cents,
        currency: "usd",
        client_reference_id: userId,
        metadata: { user_id: userId, credit_micros: String(cents * 10000) },
      },
    },
  };
}

async function postWebhook(t, event, { signature, contentType = "application/json" } = {}) {
  const body = JSON.stringify(event);
  // Stripe sends neither an Origin nor a session cookie.
  const c = t.client({ origin: null });
  return c.json("POST", "/api/billing/webhook", undefined, {
    body,
    headers: { "Content-Type": contentType, "Stripe-Signature": signature === undefined ? stripeSignature(body) : signature },
  });
}

// ---------------------------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------------------------

describe("auth routes", () => {
  let t;
  before(async () => {
    t = await createTestApp();
  });
  after(() => t.close());

  test("signup creates a session cookie and returns the public user", async () => {
    const c = t.client();
    const email = nextEmail("first");
    const r = await c.json("POST", "/api/auth/signup", { email: `  ${email.toUpperCase()} `, password: PASSWORD });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get("cache-control"), "no-store");
    const cookie = r.headers.getSetCookie().find((s) => s.startsWith("gode_session="));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.deepEqual(Object.keys(r.body.user).sort(), [
      "auto_pick", "balance_usd", "created_at", "email", "eu_only", "id", "is_admin", "plan", "share_prompts", "strict_privacy",
    ]);
    assert.equal(r.body.user.email, email, "email normalised");
    assert.equal(r.body.user.is_admin, true, "first account is admin (no ADMIN_EMAILS, FIRST_USER_ADMIN on outside production)");
    assert.equal(r.body.user.balance_usd, 0.25, "signup bonus");
    assert.equal(r.body.signup_bonus_usd, 0.25);
    assert.ok(!r.text.includes("password_hash") && !r.text.includes("wrapped_dek"));

    const me = await c.json("GET", "/api/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.user.id, r.body.user.id);
  });

  test("GET /api/me carries the deployment config", async () => {
    const { c } = await signedIn(t, "cfg");
    const r = await c.json("GET", "/api/me");
    assert.deepEqual(r.body.config, {
      mock: true,
      stripe_enabled: false,
      dev_topup: false,
      margin: 0.3,
      packs_usd: [5, 10, 25],
      redaction: true,
      presidio: false,
      presidio_state: "off",
      selfhosted: true,
      private_fallback: "zdr",
      media_proxy: true,
      text_max: 32000,
    });
    assert.equal(r.body.user.is_admin, false, "later accounts are not admins");
  });

  test("signup validation and duplicates", async () => {
    const c = t.client();
    const email = nextEmail("dup");
    assert.equal((await c.json("POST", "/api/auth/signup", { email, password: PASSWORD })).status, 201);
    const dup = await c.json("POST", "/api/auth/signup", { email: email.toUpperCase(), password: PASSWORD });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, "conflict");

    const cases = [
      [{ password: PASSWORD }, /email is required/],
      [{ email: nextEmail(), password: "short" }, /at least 8/],
      [{ email: "not-an-email", password: PASSWORD }, /valid email/],
      [{ email: 42, password: PASSWORD }, /email must be a string/],
      [{ email: nextEmail(), password: 12345678 }, /password must be a string/],
      [{ email: nextEmail(), password: PASSWORD, admin: true }, /Unknown field "admin"/],
      [{ email: nextEmail(), password: "12345678" }, /too common/],
      [{ email: nextEmail(), password: "        " }, /only spaces/],
    ];
    for (const [body, message] of cases) {
      const r = await t.client().json("POST", "/api/auth/signup", body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.body.code, "bad_request");
      assert.match(r.body.error, message);
    }
  });

  test("login, wrong password and logout", async () => {
    const email = nextEmail("login");
    await t.client().signup(email, PASSWORD);
    const c = t.client();
    const wrong = await c.json("POST", "/api/auth/login", { email, password: "nope-nope-nope" });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, { error: "Wrong email or password.", code: "unauthorized" });
    const unknown = await c.json("POST", "/api/auth/login", { email: nextEmail("ghost"), password: PASSWORD });
    assert.equal(unknown.body.error, wrong.body.error, "same message for unknown accounts");

    const ok = await c.json("POST", "/api/auth/login", { email, password: PASSWORD });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, email);
    assert.equal((await c.json("GET", "/api/me")).status, 200);

    const out = await c.json("POST", "/api/auth/logout", {});
    assert.deepEqual(out.body, { ok: true });
    assert.equal((await c.json("GET", "/api/me")).status, 401);
    assert.equal((await c.json("POST", "/api/auth/logout")).status, 200, "logout is idempotent");
  });

  test("401 JSON without a session on every signed-in route", async () => {
    const c = t.client();
    const routes = [
      ["GET", "/api/me"],
      ["PATCH", "/api/me", { plan: "best" }],
      ["DELETE", "/api/me", { password: PASSWORD }],
      ["GET", "/api/conversations"],
      ["POST", "/api/conversations", {}],
      ["GET", "/api/conversations/abc"],
      ["PATCH", "/api/conversations/abc", { title: "x" }],
      ["DELETE", "/api/conversations/abc"],
      ["POST", "/api/chat", { text: "hi" }],
      ["POST", "/api/messages/abc/regenerate", {}],
      ["POST", "/api/messages/abc/switch", { model_id: OPUS }],
      ["POST", "/api/messages/abc/feedback", { value: 1 }],
      ["GET", "/api/models?job=chat"],
      ["GET", "/api/transparency"],
      ["GET", "/api/billing/ledger"],
      ["POST", "/api/billing/checkout", { pack_usd: 5 }],
      ["POST", "/api/billing/dev-topup", { usd: 1 }],
      ["GET", "/api/admin/routing"],
    ];
    for (const [method, url, body] of routes) {
      const r = await c.json(method, url, body);
      assert.equal(r.status, 401, `${method} ${url}`);
      assert.equal(r.body.code, "unauthorized", `${method} ${url}`);
      assert.equal(r.headers.get("cache-control"), "no-store", `${method} ${url}`);
    }
  });

  test("a forged session cookie is a 401 and is cleared", async () => {
    const c = t.client();
    c.cookies.set("gode_session", "A".repeat(43));
    const r = await c.json("GET", "/api/me");
    assert.equal(r.status, 401);
    assert.equal(c.cookies.has("gode_session"), false);
  });
});

// ---------------------------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------------------------

describe("rate limits", () => {
  test("signup and login: about 20 per 15 minutes per IP", async () => {
    const t = await createTestApp();
    try {
      const c = t.client();
      for (let i = 0; i < 20; i++) {
        const r = await c.json("POST", "/api/auth/login", { email: nextEmail("ip"), password: PASSWORD });
        assert.equal(r.status, 401, `attempt ${i + 1}`);
      }
      const limited = await c.json("POST", "/api/auth/login", { email: nextEmail("ip"), password: PASSWORD });
      assert.equal(limited.status, 429);
      assert.equal(limited.body.code, "rate_limited");
      assert.ok(Number(limited.headers.get("retry-after")) > 0);
      // The limiter is shared: signing up from the same IP is blocked too.
      assert.equal((await c.json("POST", "/api/auth/signup", { email: nextEmail("ip"), password: PASSWORD })).status, 429);
    } finally {
      await t.close();
    }
  });

  test("login: failed attempts per email count per network, so an attacker can't lock the owner out", async () => {
    // TRUST_PROXY so X-Forwarded-For stands in for different client networks.
    const t = await createTestApp({ TRUST_PROXY: "1" }, { rateLimits: { auth: { max: 100 } } });
    try {
      const email = nextEmail("victim");
      await t.client().signup(email, PASSWORD);
      const attacker = t.client();
      const from = (ip) => ({ headers: { "X-Forwarded-For": ip } });
      for (let i = 0; i < 10; i++) {
        const r = await attacker.json("POST", "/api/auth/login", { email: i % 2 ? email.toUpperCase() : email, password: "wrong-password" }, from("203.0.113.9"));
        assert.equal(r.status, 401, `attempt ${i + 1}`);
      }
      const locked = await attacker.json("POST", "/api/auth/login", { email, password: "wrong-password" }, from("203.0.113.9"));
      assert.equal(locked.status, 429, "the attacker's network is stopped for this account");
      assert.equal(locked.body.code, "rate_limited");
      assert.ok(Number(locked.headers.get("retry-after")) > 0);
      // The owner, from their own network, gets in with the right password.
      const owner = t.client();
      const ok = await owner.json("POST", "/api/auth/login", { email, password: PASSWORD }, from("198.51.100.20"));
      assert.equal(ok.status, 200, "the right password is never refused for someone else's failures");
      // Successful logins don't count: the owner can log in again and again.
      for (let i = 0; i < 12; i++) assert.equal((await owner.json("POST", "/api/auth/login", { email, password: PASSWORD }, from("198.51.100.20"))).status, 200);
      // Rotating addresses inside one IPv6 /64 is one network.
      const v6 = t.client();
      for (let i = 0; i < 10; i++) {
        assert.equal((await v6.json("POST", "/api/auth/login", { email, password: "wrong" + i }, from(`2001:db8:7:7::${i + 1}`))).status, 401);
      }
      assert.equal((await v6.json("POST", "/api/auth/login", { email, password: "wrong" }, from("2001:db8:7:7::ffff"))).status, 429);
    } finally {
      await t.close();
    }
  });

  test("login: past the global ceiling per email, each failing network group gets no more guesses, a fresh one still can", async () => {
    const t = await createTestApp({ TRUST_PROXY: "1" }, { rateLimits: { auth: { max: 1000 }, authEmailGlobal: { max: 15 } } });
    try {
      const email = nextEmail("target");
      await t.client().signup(email, PASSWORD);
      const c = t.client();
      const from = (ip) => ({ headers: { "X-Forwarded-For": ip } });
      // 15 guesses spread over 15 addresses of one /24 (each under its own per-network limit).
      for (let i = 0; i < 15; i++) {
        const r = await c.json("POST", "/api/auth/login", { email, password: "wrong" }, from(`192.0.2.${i + 1}`));
        assert.equal(r.status, 401);
      }
      // That /24 failed while the account is under attack: refused, even with the right password.
      const sameGroup = await c.json("POST", "/api/auth/login", { email, password: PASSWORD }, from("192.0.2.200"));
      assert.equal(sameGroup.status, 429);
      assert.ok(Number(sameGroup.headers.get("retry-after")) > 0);
      // Another /24: one more wrong guess is checked (401), then that group is refused too.
      assert.equal((await c.json("POST", "/api/auth/login", { email, password: "wrong" }, from("198.51.100.1"))).status, 401);
      assert.equal((await c.json("POST", "/api/auth/login", { email, password: "wrong" }, from("198.51.100.2"))).status, 429);
      // The owner from a network group that never failed gets in.
      assert.equal((await t.client().json("POST", "/api/auth/login", { email, password: PASSWORD }, from("203.0.113.50"))).status, 200);
    } finally {
      await t.close();
    }
  });

  test("signup: a daily limit per network (IPv6 by /64), counting new accounts and duplicates", async () => {
    const t = await createTestApp({ TRUST_PROXY: "1" }, { rateLimits: { auth: { max: 1000 }, signup: { max: 3 } } });
    try {
      const from = (ip) => ({ headers: { "X-Forwarded-For": ip } });
      const dupEmail = nextEmail("farm");
      assert.equal((await t.client().json("POST", "/api/auth/signup", { email: dupEmail, password: PASSWORD }, from("2001:db8:5:5::1"))).status, 201);
      assert.equal((await t.client().json("POST", "/api/auth/signup", { email: dupEmail, password: PASSWORD }, from("2001:db8:5:5::2"))).status, 409);
      // Validation errors don't count.
      assert.equal((await t.client().json("POST", "/api/auth/signup", { email: nextEmail(), password: "short" }, from("2001:db8:5:5::3"))).status, 400);
      assert.equal((await t.client().json("POST", "/api/auth/signup", { email: nextEmail("farm"), password: PASSWORD }, from("2001:db8:5:5::4"))).status, 201);
      const limited = await t.client().json("POST", "/api/auth/signup", { email: nextEmail("farm"), password: PASSWORD }, from("2001:db8:5:5:abcd::9"));
      assert.equal(limited.status, 429);
      assert.match(limited.body.error, /today/);
      assert.equal((await t.client().json("POST", "/api/auth/signup", { email: nextEmail("farm"), password: PASSWORD }, from("2001:db8:5:6::1"))).status, 201, "another /64");
    } finally {
      await t.close();
    }
  });

  test("signup bonus: once per address (survives delete everything), capped per UTC day", async () => {
    const t = await createTestApp({ SIGNUP_BONUS_DAILY_CAP: "2" });
    try {
      const email = nextEmail("recycle");
      const first = t.client();
      const u = await first.signup(email, PASSWORD);
      assert.equal(u.balance_usd, 0.25);
      assert.deepEqual((await first.json("DELETE", "/api/me", { password: PASSWORD })).body, { ok: true });
      const again = await t.client().json("POST", "/api/auth/signup", { email, password: PASSWORD });
      assert.equal(again.status, 201);
      assert.equal(again.body.user.balance_usd, 0, "no second bonus for the same address");
      assert.equal(again.body.signup_bonus_usd, 0);
      assert.equal((await t.client().signup(nextEmail("second"), PASSWORD)).balance_usd, 0.25);
      assert.equal((await t.client().signup(nextEmail("third"), PASSWORD)).balance_usd, 0, "daily cap of 2 reached");
    } finally {
      await t.close();
    }
  });

  test("chat, regenerate and switch share a per-user limiter", async () => {
    const pipe = scriptedPipeline();
    const t = await createTestApp({}, { pipeline: pipe, rateLimits: { chat: { max: 2 } } });
    try {
      const a = await signedIn(t, "chatty");
      assert.equal((await a.c.sse("/api/chat", { text: "one" })).status, 200);
      assert.equal((await a.c.sse("/api/chat", { text: "two" })).status, 200);
      const limited = await a.c.sse("/api/chat", { text: "three" });
      assert.equal(limited.status, 429, "a pre-stream JSON error, not an event");
      assert.equal(limited.body.code, "rate_limited");
      const regen = await a.c.sse("/api/messages/whatever/regenerate", {});
      assert.equal(regen.status, 429);
      const b = await signedIn(t, "calm");
      assert.equal((await b.c.sse("/api/chat", { text: "hi" })).status, 200, "per user, not global");
      assert.equal(pipe.calls.length, 3);
    } finally {
      await t.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Same-origin check
// ---------------------------------------------------------------------------------------------

describe("same-origin check", () => {
  let t;
  before(async () => {
    t = await createTestApp();
  });
  after(() => t.close());

  test("cross-site POSTs are refused before they do anything", async () => {
    const email = nextEmail("csrf");
    const evil = t.client({ origin: "https://evil.example" });
    const r = await evil.json("POST", "/api/auth/signup", { email, password: PASSWORD });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, "forbidden");
    assert.equal(t.deps.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = ?").get(email).n, 0);

    assert.equal((await t.client({ origin: "null" }).json("POST", "/api/auth/signup", { email, password: PASSWORD })).status, 403);
    const fetchMeta = t.client({ origin: null });
    const meta = await fetchMeta.json("POST", "/api/auth/signup", { email, password: PASSWORD }, { headers: { "Sec-Fetch-Site": "cross-site" } });
    assert.equal(meta.status, 403, "Fetch Metadata without Origin");
  });

  test("a signed-in user's settings can't be changed cross-site", async () => {
    const { c, user } = await signedIn(t, "victim");
    const cookie = [...c.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const evil = t.client({ origin: "https://evil.example" });
    const r = await evil.json("PATCH", "/api/me", { share_prompts: true }, { headers: { Cookie: cookie } });
    assert.equal(r.status, 403);
    assert.equal(userRow(t, user.id).share_prompts, 0);
  });

  test("same-origin, origin-less (non-browser) and safe requests pass", async () => {
    assert.equal((await t.client().json("POST", "/api/auth/signup", { email: nextEmail(), password: PASSWORD })).status, 201);
    assert.equal((await t.client({ origin: null }).json("POST", "/api/auth/signup", { email: nextEmail(), password: PASSWORD })).status, 201);
    const get = await t.client({ origin: "https://evil.example" }).json("GET", "/api/public/providers");
    assert.equal(get.status, 200);
  });
});

// ---------------------------------------------------------------------------------------------
// /api/me
// ---------------------------------------------------------------------------------------------

describe("PATCH /api/me", () => {
  let t;
  before(async () => {
    t = await createTestApp();
  });
  after(() => t.close());

  test("updates the plan and the privacy switches and returns {user}", async () => {
    const { c, user } = await signedIn(t, "settings");
    const r = await c.json("PATCH", "/api/me", { plan: "best", strict_privacy: true, eu_only: true, auto_pick: false, share_prompts: true });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body), ["user"]);
    assert.equal(r.body.user.plan, "best");
    assert.equal(r.body.user.strict_privacy, true);
    assert.equal(r.body.user.eu_only, true);
    assert.equal(r.body.user.auto_pick, false);
    assert.equal(r.body.user.share_prompts, true);
    const row = userRow(t, user.id);
    assert.equal(row.plan, "best");
    assert.equal(row.auto_pick, 0);

    const back = await c.json("PATCH", "/api/me", { strict_privacy: false });
    assert.equal(back.body.user.strict_privacy, false);
    assert.equal(back.body.user.plan, "best", "other fields untouched");
  });

  test("rejects bad values and unknown fields", async () => {
    const { c, user } = await signedIn(t, "badsettings");
    const cases = [
      [{ plan: "premium" }, /plan must be one of/],
      [{ plan: 1 }, /plan must be one of/],
      [{ strict_privacy: "true" }, /strict_privacy must be true or false/],
      [{ eu_only: 1 }, /eu_only must be true or false/],
      [{ is_admin: true }, /Unknown field "is_admin"/],
      [{ balance_micros: 1e9 }, /Unknown field/],
      [{}, /Nothing to update/],
    ];
    for (const [body, message] of cases) {
      const r = await c.json("PATCH", "/api/me", body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.match(r.body.error, message);
    }
    const arr = await c.json("PATCH", "/api/me", [{ plan: "best" }]);
    assert.equal(arr.status, 400);
    const row = userRow(t, user.id);
    assert.equal(row.plan, "balanced");
    assert.equal(row.is_admin, 0);
  });
});

// ---------------------------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------------------------

describe("conversations", () => {
  let t;
  let alice;
  let bob;
  before(async () => {
    t = await createTestApp({}, { pipeline: scriptedPipeline() });
    alice = await signedIn(t, "alice");
    bob = await signedIn(t, "bob");
  });
  after(() => t.close());

  test("create, list, rename and delete", async () => {
    const c = alice.c;
    const created = await c.json("POST", "/api/conversations", {});
    assert.equal(created.status, 201);
    assert.deepEqual(Object.keys(created.body.conversation).sort(), ["id", "title", "updated_at"]);
    assert.equal(created.body.conversation.title, null);
    const id = created.body.conversation.id;

    await sleep(2);
    const titled = await c.json("POST", "/api/conversations", { title: "  Trip plans  " });
    assert.equal(titled.body.conversation.title, "Trip plans");
    const stored = t.deps.db.prepare("SELECT title_enc FROM conversations WHERE id = ?").get(titled.body.conversation.id);
    assert.ok(stored.title_enc.startsWith("v1.") && !stored.title_enc.includes("Trip"), "title stored encrypted");

    const list = await c.json("GET", "/api/conversations");
    assert.deepEqual(
      list.body.conversations.map((x) => x.title),
      ["Trip plans", null],
      "most recent first"
    );

    await sleep(2);
    assert.deepEqual((await c.json("PATCH", `/api/conversations/${id}`, { title: "Renamed" })).body, { ok: true });
    const after = await c.json("GET", "/api/conversations");
    assert.equal(after.body.conversations[0].id, id, "rename bumps updated_at");
    assert.equal(after.body.conversations[0].title, "Renamed");

    assert.equal((await c.json("PATCH", `/api/conversations/${id}`, {})).status, 400);
    assert.equal((await c.json("PATCH", `/api/conversations/${id}`, { title: "   " })).status, 400);
    assert.equal((await c.json("PATCH", `/api/conversations/${id}`, { title: "x".repeat(201) })).status, 400);
    assert.equal((await c.json("POST", "/api/conversations", { name: "x" })).status, 400);

    const del = await c.json("DELETE", `/api/conversations/${id}`);
    assert.deepEqual(del.body, { ok: true });
    assert.equal((await c.json("GET", `/api/conversations/${id}`)).status, 404);
    assert.equal((await c.json("DELETE", `/api/conversations/${id}`)).status, 404);
  });

  test("GET /:id returns current messages, decrypted, with request metadata", async () => {
    const pins = { chat: { model_id: OPUS, tier: "quality", source: "auto" } };
    const convId = insertConversation(t, alice.user, { title: "Maths", pins });
    const at = Date.now() - 10_000;
    const old = insertTurn(t, alice.user, convId, { question: "What is 2+2?", answer: "Five", superseded: 1, at });
    const { db } = t.deps;
    // The regenerated answer replaces the superseded one under the same question.
    const newAsst = crypto.randomUUID();
    const reqId = insertRequest(t, {
      user_id: alice.user.id,
      conversation_id: convId,
      message_id: newAsst,
      kind: "regenerate",
      tier: "quality",
      effort: "high",
      charged_micros: 40000,
      private: 1,
      zdr: 1,
      pinned: 1,
      redactions: JSON.stringify({ PERSON: 2 }),
      feedback: 1,
      created_at: at + 5,
    });
    const dek = userRow(t, alice.user.id).wrapped_dek;
    db.prepare(
      "INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, superseded, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?, 0, ?)"
    ).run(newAsst, convId, alice.user.id, t.deps.keyring.encrypt(dek, { text: "Four", media: [{ type: "image", url: "data:image/svg+xml,x" }] }, { json: true }), old.userMsgId, reqId, at + 5);

    const r = await alice.c.json("GET", `/api/conversations/${convId}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.conversation, { id: convId, title: "Maths", pins, private: false, updated_at: r.body.conversation.updated_at });
    assert.equal(r.body.messages.length, 2, "superseded answer hidden");
    const [q, a] = r.body.messages;
    assert.deepEqual(q, { id: old.userMsgId, role: "user", text: "What is 2+2?", media: [], created_at: at, parent_id: null, answered: true });
    assert.equal(a.id, newAsst);
    assert.equal(a.text, "Four");
    assert.deepEqual(a.media, [{ type: "image", url: "data:image/svg+xml,x" }]);
    assert.equal(a.parent_id, old.userMsgId);
    assert.deepEqual(a.request, {
      id: reqId,
      kind: "regenerate",
      job: "chat",
      tier: "quality",
      model_id: OPUS,
      model_label: "Claude Opus 5.5",
      model_region: "us",
      pick_source: "auto",
      effort: "high",
      cost_usd: 0.04,
      chip: "Claude Opus 5.5 · high effort · $0.04",
      private: true,
      zdr: true,
      redactions: { PERSON: 2 },
      feedback: 1,
      pinned: true,
      status: "ok",
      context_included: false,
      // No classifier on either row: nobody outside is named as having read the question.
      classifier_model: null,
      classifier_label: null,
      classified_outside: false,
    });
    assert.ok(!r.text.includes("Five"));
  });

  test("another user's conversation and answers are 404 everywhere", async () => {
    const convId = insertConversation(t, alice.user, { title: "Private diary" });
    const turn = insertTurn(t, alice.user, convId, { question: "secret question", answer: "secret answer" });
    const b = bob.c;
    const checks = [
      ["GET", `/api/conversations/${convId}`],
      ["PATCH", `/api/conversations/${convId}`, { title: "pwned" }],
      ["DELETE", `/api/conversations/${convId}`],
      ["POST", "/api/chat", { conversation_id: convId, text: "hello" }],
      ["POST", `/api/messages/${turn.asstId}/regenerate`, {}],
      ["POST", `/api/messages/${turn.asstId}/switch`, { model_id: HAIKU }],
      ["POST", `/api/messages/${turn.asstId}/feedback`, { value: -1 }],
      ["GET", `/api/models?job=chat&conversation_id=${convId}`],
    ];
    for (const [method, url, body] of checks) {
      const r = await b.json(method, url, body);
      assert.equal(r.status, 404, `${method} ${url}`);
      assert.equal(r.body.code, "not_found", `${method} ${url}`);
      assert.ok(!r.text.includes("secret") && !r.text.includes("diary"), `${method} ${url} leaks nothing`);
    }
    assert.ok(!(await b.json("GET", "/api/conversations")).body.conversations.some((x) => x.id === convId));
    // Untouched for the owner.
    const mine = await alice.c.json("GET", `/api/conversations/${convId}`);
    assert.equal(mine.body.conversation.title, "Private diary");
    assert.equal(t.deps.db.prepare("SELECT feedback FROM requests WHERE id = ?").get(turn.requestId).feedback, null);
  });
});

// ---------------------------------------------------------------------------------------------
// Chat streams (fake pipeline)
// ---------------------------------------------------------------------------------------------

describe("chat SSE", () => {
  let t;
  let pipe;
  let logger;
  let me;
  before(async () => {
    pipe = scriptedPipeline();
    logger = captureLogger();
    t = await createTestApp({}, { pipeline: pipe, ssePingMs: 20, logger });
    me = await signedIn(t, "streamer");
  });
  after(() => t.close());

  test("frames events as `event: X\\ndata: JSON\\n\\n` with the streaming headers", async () => {
    pipe.calls.length = 0;
    pipe.impl = async ({ emit }) => {
      emit("route", { request_id: "req-1", model: { label: "Line\nbreak" } });
      emit("delta", { text: "Hel" });
      emit("delta", { text: "lo\n\n" });
      emit("done", { message_id: "m-1", chip: "x" });
    };
    const r = await me.c.sse("/api/chat", { text: "  Hello there  " });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "text/event-stream; charset=utf-8");
    assert.equal(r.headers.get("cache-control"), "no-cache, no-transform");
    assert.equal(r.headers.get("x-accel-buffering"), "no");
    assert.ok(r.raw.startsWith('event: route\ndata: {"request_id":"req-1","model":{"label":"Line\\nbreak"}}\n\n'), r.raw);
    assert.ok(r.raw.includes('event: delta\ndata: {"text":"lo\\n\\n"}\n\n'), "newlines stay inside one data line");
    assert.deepEqual(
      r.events.map((e) => e.event),
      ["route", "delta", "delta", "done"]
    );
    assert.equal(r.events.map((e) => e.data.text).filter(Boolean).join(""), "Hello\n\n");

    assert.equal(pipe.calls.length, 1);
    const args = pipe.calls[0];
    assert.equal(args.user.id, me.user.id);
    assert.equal(args.text, "Hello there", "trimmed");
    assert.equal(args.mode, "auto");
    assert.equal(args.conversationId, null);
    assert.equal(args.modelId, null);
    assert.equal(args.targetMessageId, null);
    assert.ok(args.signal instanceof AbortSignal);
    assert.equal(args.signal.aborted, false, "a finished stream does not abort its pipeline");
  });

  test("model_id is honoured only with auto-pick off (manual mode)", async () => {
    pipe.calls.length = 0;
    pipe.impl = async ({ emit }) => emit("done", {});
    await me.c.sse("/api/chat", { text: "hi", model_id: HAIKU });
    assert.equal(pipe.calls[0].mode, "auto");
    assert.equal(pipe.calls[0].modelId, null);

    await me.c.json("PATCH", "/api/me", { auto_pick: false });
    const convId = insertConversation(t, me.user);
    await me.c.sse("/api/chat", { text: "hi", model_id: HAIKU, conversation_id: convId });
    assert.equal(pipe.calls[1].mode, "manual");
    assert.equal(pipe.calls[1].modelId, HAIKU);
    assert.equal(pipe.calls[1].conversationId, convId);

    const unknown = await me.c.sse("/api/chat", { text: "hi", model_id: "openrouter:nope/nope" });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.error, "Unknown model.");
    t.deps.db.prepare("UPDATE models SET enabled = 0 WHERE id = ?").run(MINISTRAL);
    const off = await me.c.sse("/api/chat", { text: "hi", model_id: MINISTRAL });
    assert.equal(off.status, 400);
    assert.match(off.body.error, /turned off/);
    t.deps.db.prepare("UPDATE models SET enabled = 1 WHERE id = ?").run(MINISTRAL);
    await me.c.json("PATCH", "/api/me", { auto_pick: true });
    assert.equal(pipe.calls.length, 2);
  });

  test("bodies are validated before the stream starts (JSON 400s)", async () => {
    pipe.calls.length = 0;
    const cases = [
      [{}, /text is required/],
      [{ text: "   \n " }, /Type a message first/],
      [{ text: 42 }, /text must be a string/],
      [{ text: "x".repeat(32_001) }, /too long/],
      [{ text: "hi", conversation_id: 7 }, /conversation_id must be a string/],
      [{ text: "hi", model_id: ["a"] }, /model_id must be a string/],
      [{ text: "hi", mode: "switch" }, /Unknown field "mode"/],
    ];
    for (const [body, message] of cases) {
      const r = await me.c.sse("/api/chat", body);
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
      assert.equal(r.headers.get("content-type").startsWith("application/json"), true);
      assert.match(r.body.error, message);
    }
    assert.equal(pipe.calls.length, 0, "the pipeline never ran");
    pipe.impl = async ({ emit }) => emit("done", {});
    const max = await me.c.sse("/api/chat", { text: `  ${"y".repeat(32_000)}  ` });
    assert.equal(max.status, 200, "32,000 characters after trim is allowed");
  });

  test("sends ': ping' comments while the pipeline is busy", async () => {
    pipe.impl = async ({ emit }) => {
      emit("route", {});
      await sleep(90);
      emit("done", {});
    };
    const r = await me.c.sse("/api/chat", { text: "slow one" });
    assert.ok(r.comments.filter((x) => x === "ping").length >= 2, r.raw);
    assert.match(r.raw, /\n\n: ping\n\n/);
    assert.deepEqual(
      r.events.map((e) => e.event),
      ["route", "done"]
    );
  });

  test("a client disconnect aborts the pipeline's signal; nothing is written afterwards", async () => {
    let observed = null;
    pipe.impl = async ({ emit, signal }) => {
      emit("route", { request_id: "r" });
      await new Promise((resolve) => (signal.aborted ? resolve() : signal.addEventListener("abort", resolve, { once: true })));
      await sleep(5);
      observed = { aborted: signal.aborted, reason: signal.reason?.name, lateWrite: emit("delta", { text: "too late" }) };
    };
    const ac = new AbortController();
    const r = await me.c.sse("/api/chat", { text: "stop me" }, { signal: ac.signal, onEvent: (e) => e.event === "route" && ac.abort() });
    assert.equal(r.aborted, true);
    await waitFor(() => observed);
    assert.equal(observed.aborted, true);
    assert.equal(observed.reason, "AbortError");
    assert.equal(observed.lateWrite, false);
    await waitFor(() => t.app.locals.activeStreams() === 0);
  });

  test("an exception the pipeline didn't emit becomes an `internal` error event", async () => {
    logger.lines.length = 0;
    pipe.impl = async ({ emit }) => {
      emit("route", {});
      throw new Error("decrypted prompt text must never be logged");
    };
    const r = await me.c.sse("/api/chat", { text: "boom" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.events.at(-1), { event: "error", data: { error: "Something went wrong.", code: "internal" } });
    const log = logger.lines.join("\n");
    assert.match(log, /POST \/api\/chat/);
    assert.match(log, /Error/);
    assert.ok(!log.includes("decrypted prompt"), "the message is not logged");
    assert.ok(!log.includes("boom"), "the body is not logged");
  });

  test("an AppError keeps its code; an emitted error is never doubled", async () => {
    pipe.impl = async () => {
      throw new AppError(402, "insufficient_credits", "You're out of credits.");
    };
    const r1 = await me.c.sse("/api/chat", { text: "pay" });
    assert.deepEqual(r1.events, [{ event: "error", data: { error: "You're out of credits.", code: "insufficient_credits" } }]);

    pipe.impl = async ({ emit }) => {
      emit("error", { error: "Upstream failed.", code: "upstream_error" });
      emit("error", { error: "second", code: "x" });
      throw new Error("after emitting");
    };
    const r2 = await me.c.sse("/api/chat", { text: "fail" });
    assert.deepEqual(r2.events, [{ event: "error", data: { error: "Upstream failed.", code: "upstream_error" } }]);
  });

  test("shutdown tells running streams, aborts their pipelines and waits for their cleanup", async () => {
    let cleanedUp = false;
    const own = scriptedPipeline();
    own.impl = async ({ emit, signal }) => {
      emit("route", {});
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
      await sleep(30); // e.g. releasing the credit hold
      cleanedUp = true;
      emit("error", { error: "aborted", code: "aborted" }); // too late: the stream is closed
    };
    const app = await createTestApp({}, { pipeline: own });
    try {
      const { c } = await signedIn(app, "shutdown");
      let shutdown = null;
      const r = await c.sse("/api/chat", { text: "hi" }, { onEvent: (e) => e.event === "route" && (shutdown = app.app.locals.shutdown()) });
      await shutdown;
      assert.equal(cleanedUp, true, "shutdown waited for the pipeline");
      assert.deepEqual(r.events, [
        { event: "route", data: {} },
        { event: "error", data: { error: "The server is restarting. Try again in a moment.", code: "interrupted" } },
      ]);
    } finally {
      await app.close();
    }
  });

  test("regenerate and switch pass the target answer to the pipeline", async () => {
    pipe.calls.length = 0;
    pipe.impl = async ({ emit }) => emit("done", {});
    const convId = insertConversation(t, me.user);
    const turn = insertTurn(t, me.user, convId);

    const regen = await me.c.sse(`/api/messages/${turn.asstId}/regenerate`, {});
    assert.equal(regen.status, 200);
    assert.deepEqual(
      { mode: pipe.calls[0].mode, target: pipe.calls[0].targetMessageId, conv: pipe.calls[0].conversationId, model: pipe.calls[0].modelId, text: pipe.calls[0].text },
      { mode: "regenerate", target: turn.asstId, conv: convId, model: null, text: null }
    );
    assert.equal((await me.c.request("POST", `/api/messages/${turn.asstId}/regenerate`)).status, 200, "a bare POST (no body) is fine");

    const sw = await me.c.sse(`/api/messages/${turn.asstId}/switch`, { model_id: HAIKU });
    assert.equal(sw.status, 200);
    const last = pipe.calls.at(-1);
    assert.equal(last.mode, "switch");
    assert.equal(last.modelId, HAIKU);
    assert.equal(last.targetMessageId, turn.asstId);

    const bad = [
      [`/api/messages/${turn.asstId}/switch`, {}, 400],
      [`/api/messages/${turn.asstId}/switch`, { model_id: "openrouter:nope/nope" }, 400],
      [`/api/messages/${turn.asstId}/regenerate`, { model_id: HAIKU }, 400],
      [`/api/messages/${turn.userMsgId}/regenerate`, {}, 404],
      ["/api/messages/does-not-exist/regenerate", {}, 404],
    ];
    const before = pipe.calls.length;
    for (const [url, body, status] of bad) assert.equal((await me.c.sse(url, body)).status, status, url);
    t.deps.db.prepare("UPDATE messages SET superseded = 1 WHERE id = ?").run(turn.asstId);
    const stale = await me.c.sse(`/api/messages/${turn.asstId}/regenerate`, {});
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "conflict");
    assert.equal(pipe.calls.length, before);
  });
});

// ---------------------------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------------------------

describe("feedback", () => {
  test("1, -1 and 0 (clear) are stored on the answer's request row", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const { c, user } = await signedIn(t, "thumbs");
      const convId = insertConversation(t, user);
      const turn = insertTurn(t, user, convId);
      const stored = () => t.deps.db.prepare("SELECT feedback FROM requests WHERE id = ?").get(turn.requestId).feedback;
      for (const [value, expected] of [
        [1, 1],
        [-1, -1],
        [0, null],
      ]) {
        const r = await c.json("POST", `/api/messages/${turn.asstId}/feedback`, { value });
        assert.deepEqual(r.body, { ok: true });
        assert.equal(stored(), expected);
      }
      for (const body of [{ value: 2 }, { value: "1" }, { value: true }, {}, { value: 1, extra: 1 }]) {
        assert.equal((await c.json("POST", `/api/messages/${turn.asstId}/feedback`, body)).status, 400, JSON.stringify(body));
      }
      assert.equal((await c.json("POST", `/api/messages/${turn.userMsgId}/feedback`, { value: 1 })).status, 404, "questions take no feedback");
      assert.equal(stored(), null);
    } finally {
      await t.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Models menu
// ---------------------------------------------------------------------------------------------

describe("GET /api/models", () => {
  let t;
  before(async () => {
    t = await createTestApp({}, { pipeline: scriptedPipeline() });
  });
  after(() => t.close());

  test("lists eligible candidates for a job with the menu fields", async () => {
    const { c } = await signedIn(t, "menu");
    const r = await c.json("GET", "/api/models?job=chat");
    assert.equal(r.status, 200);
    assert.ok(r.body.models.length > 3);
    assert.deepEqual(Object.keys(r.body.models[0]).sort(), [
      "id", "label", "price_in", "price_out", "price_per_unit", "price_unit", "region", "self_hosted", "supports_reasoning", "vendor", "zdr",
    ]);
    assert.equal(r.body.models[0].id, GEMINI, "routed quality pick first");
    assert.deepEqual((await c.json("GET", "/api/models")).body, r.body, "job defaults to chat");

    const img = await c.json("GET", "/api/models?job=image");
    assert.equal(img.status, 200);
    assert.ok(img.body.models.length >= 3);
    assert.ok(img.body.models.every((m) => m.price_unit), "media models only");

    const bad = await c.json("GET", "/api/models?job=poetry");
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /job must be one of/);
    assert.equal((await c.json("GET", "/api/models?job=chat&job=code")).status, 400);
  });

  test("a private conversation limits the menu to private-safe models", async () => {
    const { c, user } = await signedIn(t, "privmenu");
    const convId = insertConversation(t, user, { pins: { chat: { model_id: "selfhosted:qwen3.8-27b", tier: "private", source: "auto" } } });
    const all = (await c.json("GET", "/api/models?job=chat")).body.models;
    const priv = (await c.json("GET", `/api/models?job=chat&conversation_id=${convId}`)).body.models;
    assert.ok(priv.length > 0 && priv.length < all.length);
    assert.ok(priv.every((m) => m.zdr || m.self_hosted));
    assert.equal(priv[0].id, "selfhosted:qwen3.8-27b", "the private pick first");
    assert.ok(all.some((m) => m.id === GEMINI) && !priv.some((m) => m.id === GEMINI));
    assert.equal((await c.json("GET", "/api/models?job=chat&conversation_id=nope")).status, 404);
  });

  test("strict privacy and EU-only filter the menu", async () => {
    const { c } = await signedIn(t, "strict");
    await c.json("PATCH", "/api/me", { strict_privacy: true });
    const strict = (await c.json("GET", "/api/models?job=chat")).body.models;
    assert.ok(strict.length > 0 && strict.every((m) => m.zdr || m.self_hosted));
    assert.deepEqual((await c.json("GET", "/api/models?job=image")).body.models, [], "no media model is zero-retention");
    await c.json("PATCH", "/api/me", { strict_privacy: false, eu_only: true });
    const eu = (await c.json("GET", "/api/models?job=chat")).body.models;
    assert.ok(eu.length > 0 && eu.every((m) => m.region === "eu" || m.region === "self"));
  });
});

// ---------------------------------------------------------------------------------------------
// Transparency log
// ---------------------------------------------------------------------------------------------

describe("GET /api/transparency", () => {
  test("the user's own requests, newest first, metadata only", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const a = await signedIn(t, "transp");
      const b = await signedIn(t, "other");
      const base = Date.now() - 60_000;
      for (let i = 0; i < 3; i++) {
        insertRequest(t, { user_id: a.user.id, created_at: base + i, redactions: JSON.stringify({ EMAIL: i }), charged_micros: 10_000 * (i + 1) });
      }
      insertRequest(t, { user_id: a.user.id, created_at: base + 10, status: "error", error_code: "upstream_error", charged_micros: 0, model_id: FLUX_KLEIN, job: "image", gateway: "fal" });
      insertRequest(t, { user_id: b.user.id, created_at: base + 20 });

      const r = await a.c.json("GET", "/api/transparency");
      assert.equal(r.status, 200);
      assert.equal(r.body.requests.length, 4, "only my rows");
      assert.deepEqual(Object.keys(r.body.requests[0]).sort(), [
        "classifier_label", "classifier_model",
        "cost_usd", "created_at", "effort", "error_code", "gateway", "id", "job", "kind", "model_id", "model_label", "private",
        "redactions", "status", "tier", "upstream_provider", "zdr",
      ]);
      assert.equal(r.body.has_more, false);
      assert.equal(r.body.next_before, null);
      const [first, second] = r.body.requests;
      assert.equal(first.status, "error");
      assert.equal(first.error_code, "upstream_error");
      assert.equal(first.model_label, "FLUX.3 Klein");
      assert.equal(second.cost_usd, 0.03);
      assert.deepEqual(second.redactions, { EMAIL: 2 });
      assert.equal(second.zdr, false);
      assert.equal(second.model_label, "Claude Opus 5.5");

      assert.equal((await a.c.json("GET", "/api/transparency?limit=2")).body.requests.length, 2);
      for (const q of ["0", "201", "abc", "1.5", "-1"]) assert.equal((await a.c.json("GET", `/api/transparency?limit=${q}`)).status, 400, q);
      assert.equal((await a.c.json("GET", "/api/transparency?limit=200")).status, 200);
    } finally {
      await t.close();
    }
  });

  test("names the classifier each request went to, and pages with ?before=", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const a = await signedIn(t, "pager");
      const b = await signedIn(t, "nosy");
      const base = Date.now() - 60_000;
      const ids = [];
      // Same created_at for two rows: ties are broken by insertion order, never skipped or repeated.
      for (let i = 0; i < 5; i++) {
        ids.push(insertRequest(t, { user_id: a.user.id, created_at: base + Math.min(i, 3), classifier_model: i === 0 ? "heuristic" : i === 1 ? "openai:gpt-6-luna" : "openrouter:deepseek/deepseek-v4.1-flash" }));
      }
      const page1 = await a.c.json("GET", "/api/transparency?limit=2");
      assert.equal(page1.body.requests.length, 2);
      assert.equal(page1.body.has_more, true);
      assert.equal(page1.body.next_before, page1.body.requests[1].id);
      const page2 = await a.c.json("GET", `/api/transparency?limit=2&before=${page1.body.next_before}`);
      const page3 = await a.c.json("GET", `/api/transparency?limit=2&before=${page2.body.next_before}`);
      assert.equal(page3.body.has_more, false);
      const seen = [...page1.body.requests, ...page2.body.requests, ...page3.body.requests].map((r) => r.id);
      assert.deepEqual(seen, [...ids].reverse(), "every row once, newest first");

      const byId = Object.fromEntries(seen.map((id, i) => [id, [...page1.body.requests, ...page2.body.requests, ...page3.body.requests][i]]));
      assert.deepEqual(
        [byId[ids[0]], byId[ids[1]], byId[ids[2]]].map((r) => [r.classifier_model, r.classifier_label]),
        [
          ["heuristic", "Gode's own rules"],
          ["openai:gpt-6-luna", "GPT-6 Luna"],
          ["openrouter:deepseek/deepseek-v4.1-flash", "DeepSeek V4.1 Flash"],
        ]
      );

      // Someone else's row (or junk) is not a cursor.
      const theirs = insertRequest(t, { user_id: b.user.id });
      assert.equal((await a.c.json("GET", `/api/transparency?before=${theirs}`)).status, 400);
      assert.equal((await a.c.json("GET", "/api/transparency?before=nope")).status, 400);
    } finally {
      await t.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------------------------

describe("billing: ledger and dev top-up", () => {
  test("ledger hides hold/release rows by default and maps micros to USD", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const { c, user } = await signedIn(t, "ledger");
      const first = await c.json("GET", "/api/billing/ledger");
      assert.equal(first.status, 200);
      assert.equal(first.body.balance_usd, 0.25);
      assert.deepEqual(
        first.body.entries.map((e) => [e.kind, e.delta_usd]),
        [["signup_bonus", 0.25]]
      );
      assert.deepEqual(Object.keys(first.body.entries[0]).sort(), ["created_at", "delta_usd", "id", "kind"]);

      const { credits } = t.deps;
      const hold = credits.reserve(user.id, 50_000);
      credits.settle(hold.holdId, 12_000, "req-1");
      const open = credits.reserve(user.id, 20_000); // still running: shows only in the balance

      const r = await c.json("GET", "/api/billing/ledger");
      assert.equal(r.body.balance_usd, 0.218);
      assert.deepEqual(
        r.body.entries.map((e) => [e.kind, e.delta_usd]),
        [
          ["charge", -0.012],
          ["signup_bonus", 0.25],
        ]
      );
      const all = await c.json("GET", "/api/billing/ledger?all=1");
      assert.deepEqual(all.body.entries.map((e) => e.kind).sort(), ["charge", "hold", "hold", "release", "signup_bonus"]);
      assert.equal((await c.json("GET", "/api/billing/ledger?limit=1")).body.entries.length, 1);
      assert.equal((await c.json("GET", "/api/billing/ledger?limit=0")).status, 400);
      assert.equal((await c.json("GET", "/api/billing/ledger?all=maybe")).status, 400);
      credits.release(open.holdId);
    } finally {
      await t.close();
    }
  });

  test("dev top-up when enabled: (0, 100] USD", async () => {
    const t = await createTestApp({ ALLOW_DEV_TOPUP: "1" }, { pipeline: scriptedPipeline() });
    try {
      const { c } = await signedIn(t, "topup");
      assert.equal((await c.json("GET", "/api/me")).body.config.dev_topup, true);
      const r = await c.json("POST", "/api/billing/dev-topup", { usd: 5 });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { balance_usd: 5.25 });
      assert.equal((await c.json("POST", "/api/billing/dev-topup", { usd: 100 })).body.balance_usd, 105.25);
      for (const usd of [0, -1, 100.01, "5", null, Number.NaN, 1e-7]) {
        assert.equal((await c.json("POST", "/api/billing/dev-topup", { usd })).status, 400, String(usd));
      }
      assert.equal((await c.json("POST", "/api/billing/dev-topup", {})).status, 400);
      const ledger = await c.json("GET", "/api/billing/ledger");
      assert.deepEqual(
        ledger.body.entries.map((e) => e.kind),
        ["dev_topup", "dev_topup", "signup_bonus"]
      );
    } finally {
      await t.close();
    }
  });

  test("dev top-up is refused when turned off", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const { c } = await signedIn(t, "notopup");
      const r = await c.json("POST", "/api/billing/dev-topup", { usd: 5 });
      assert.equal(r.status, 403);
      assert.equal(r.body.code, "forbidden");
      assert.equal((await c.json("GET", "/api/billing/ledger")).body.balance_usd, 0.25);
    } finally {
      await t.close();
    }
  });

  test("checkout is unavailable without both Stripe keys", async () => {
    for (const env of [{}, { STRIPE_SECRET_KEY: STRIPE_KEY }]) {
      const t = await createTestApp(env, { pipeline: scriptedPipeline(), logger: captureLogger() });
      try {
        const { c } = await signedIn(t, "nostripe");
        assert.equal((await c.json("GET", "/api/me")).body.config.stripe_enabled, false, JSON.stringify(env));
        const r = await c.json("POST", "/api/billing/checkout", { pack_usd: 5 });
        assert.equal(r.status, 503);
        assert.equal(r.body.code, "gateway_not_configured");
      } finally {
        await t.close();
      }
    }
  });
});

describe("billing: Stripe checkout and webhook (mock upstream)", () => {
  let up;
  let t;
  let buyer;
  before(async () => {
    up = await startMockUpstream();
    t = await createTestApp(
      { STRIPE_SECRET_KEY: STRIPE_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, STRIPE_API_BASE: up.urls.stripe },
      { pipeline: scriptedPipeline(), logger: captureLogger() }
    );
    buyer = await signedIn(t, "buyer");
  });
  after(async () => {
    await t.close();
    await up.close();
  });

  test("checkout creates a Stripe session for a known pack", async () => {
    assert.equal((await buyer.c.json("GET", "/api/me")).body.config.stripe_enabled, true);
    const r = await buyer.c.json("POST", "/api/billing/checkout", { pack_usd: 10 });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body), ["url"]);
    assert.match(r.body.url, /^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_/);
    const sent = up.last("/v1/checkout/sessions").body;
    assert.equal(sent.client_reference_id, buyer.user.id);
    assert.equal(sent["line_items[0][price_data][unit_amount]"], "1000");
    assert.equal(sent.mode, "payment");
    assert.ok(!JSON.stringify(sent).includes(buyer.user.email), "no email goes to Stripe");

    for (const body of [{ pack_usd: 7 }, { pack_usd: "10" }, {}, { pack_usd: 10, coupon: "x" }]) {
      const bad = await buyer.c.json("POST", "/api/billing/checkout", body);
      assert.equal(bad.status, 400, JSON.stringify(body));
    }
    up.setScenario("stripe_error");
    const failed = await buyer.c.json("POST", "/api/billing/checkout", { pack_usd: 5 });
    up.setScenario("ok");
    assert.equal(failed.status, 502);
    assert.equal(failed.body.code, "upstream_error");
  });

  test("a signed webhook grants the credits exactly once", async () => {
    const balance = () => userRow(t, buyer.user.id).balance_micros;
    const start = balance();
    const event = paidSessionEvent(buyer.user.id, { cents: 1000 });
    const r = await postWebhook(t, event);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { received: true });
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(balance(), start + 10_000_000);

    const again = await postWebhook(t, event);
    assert.equal(again.status, 200, "a redelivery is acknowledged");
    assert.deepEqual(again.body, { received: true });
    const async = paidSessionEvent(buyer.user.id, { sessionId: event.data.object.id, type: "checkout.session.async_payment_succeeded" });
    assert.equal((await postWebhook(t, async)).status, 200);
    assert.equal(balance(), start + 10_000_000, "same session, credited once");

    const ledger = await buyer.c.json("GET", "/api/billing/ledger");
    assert.equal(ledger.body.entries.filter((e) => e.kind === "purchase").length, 1);
    assert.equal(ledger.body.entries.find((e) => e.kind === "purchase").delta_usd, 10);

    // Also with a non-JSON content type: the raw body is what's signed.
    const other = paidSessionEvent(buyer.user.id, { cents: 500 });
    assert.equal((await postWebhook(t, other, { contentType: "text/plain" })).status, 200);
    assert.equal(balance(), start + 15_000_000);

    const unhandled = { id: `evt_${crypto.randomUUID()}`, type: "customer.created", data: { object: { id: "cus_1" } } };
    assert.deepEqual((await postWebhook(t, unhandled)).body, { received: true });
  });

  test("a bad or missing signature is a 400 and grants nothing", async () => {
    const start = userRow(t, buyer.user.id).balance_micros;
    const event = paidSessionEvent(buyer.user.id);
    const body = JSON.stringify(event);
    const wrongSecret = await postWebhook(t, event, { signature: stripeSignature(body, { secret: "whsec_wrong" }) });
    assert.equal(wrongSecret.status, 400);
    assert.equal(wrongSecret.body.code, "bad_request");
    const tampered = await postWebhook(t, { ...event, data: { object: { ...event.data.object, amount_total: 999_999 } } }, { signature: stripeSignature(body) });
    assert.equal(tampered.status, 400);
    const stale = await postWebhook(t, event, { signature: stripeSignature(body, { timestamp: Math.floor(Date.now() / 1000) - 3600 }) });
    assert.equal(stale.status, 400);
    assert.equal((await postWebhook(t, event, { signature: "" })).status, 400);
    assert.equal(userRow(t, buyer.user.id).balance_micros, start);
    // Nothing recorded: the genuine delivery still works afterwards.
    assert.equal((await postWebhook(t, event)).status, 200);
    assert.equal(userRow(t, buyer.user.id).balance_micros, start + 10_000_000);
  });

  test("the webhook is refused (non-2xx, so Stripe retries) when payments are off", async () => {
    const logger = captureLogger();
    const off = await createTestApp({}, { pipeline: scriptedPipeline(), logger });
    try {
      const r = await postWebhook(off, paidSessionEvent("someone"));
      assert.equal(r.status, 503);
      assert.deepEqual(logger.lines, ["[api] POST /api/billing/webhook -> 503 gateway_not_configured"]);
    } finally {
      await off.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

describe("admin routes", () => {
  let t;
  let admin;
  let regular;
  const route = (job, tier) => t.deps.db.prepare("SELECT * FROM routes WHERE job = ? AND tier = ?").get(job, tier);

  before(async () => {
    // ADMIN_EMAILS set: exactly the listed addresses are admins (being first means nothing).
    t = await createTestApp({ ADMIN_EMAILS: "founder@example.test, boss@example.test" }, { pipeline: scriptedPipeline() });
    regular = await signedIn(t, "member"); // the first account: not listed, not admin
    admin = { c: t.client() };
    admin.user = await admin.c.signup("founder@example.test", PASSWORD);
  });
  after(() => t.close());

  test("forbidden for non-admins, 401 when signed out", async () => {
    const routes = [
      ["GET", "/api/admin/routing"],
      ["PUT", `/api/admin/routes/chat/budget`, { model_id: HAIKU }],
      ["POST", "/api/admin/models", { id: "openrouter:x/y" }],
      ["PUT", `/api/admin/models/${encodeURIComponent(HAIKU)}`, { price_in: 0 }],
      ["GET", "/api/admin/stats"],
      ["POST", "/api/admin/learn", { apply: true }],
      ["GET", "/api/admin/catalog/export"],
      ["POST", "/api/admin/catalog/import", { models: [], routes: [] }],
      ["GET", "/api/admin/unknown"],
    ];
    for (const [method, url, body] of routes) {
      const r = await regular.c.json(method, url, body);
      assert.equal(r.status, 403, `${method} ${url}`);
      assert.equal(r.body.code, "forbidden");
      assert.equal((await t.client().json(method, url, body)).status, 401, `${method} ${url} signed out`);
    }
    assert.equal(route("chat", "budget").model_id, "openrouter:deepseek/deepseek-v4.1-flash");
    assert.equal(regular.user.is_admin, false, "the first account is not admin when ADMIN_EMAILS is set");
    assert.equal(admin.user.is_admin, true);
    // Any listed address is an admin.
    const boss = t.client();
    await boss.signup("boss@example.test", PASSWORD);
    assert.equal((await boss.json("GET", "/api/admin/routing")).status, 200);
  });

  test("GET /api/admin/routing", async () => {
    const r = await admin.c.json("GET", "/api/admin/routing");
    assert.equal(r.status, 200);
    assert.equal(r.body.models.length, 36);
    assert.equal(r.body.routes.length, 28);
    assert.deepEqual(r.body.routes.slice(0, 4).map((x) => `${x.job}/${x.tier}`), ["chat/quality", "chat/balanced", "chat/budget", "chat/private"]);
    assert.equal(r.body.classifier_model_id, "openrouter:deepseek/deepseek-v4.1-flash");
    assert.ok(r.body.models.every((m) => Array.isArray(m.jobs) && typeof m.enabled === "boolean"));
  });

  test("PUT /api/admin/routes/:job/:tier edits a cell, with validation", async () => {
    const put = (job, tier, body) => admin.c.json("PUT", `/api/admin/routes/${job}/${tier}`, body);
    const ok = await put("chat", "budget", { model_id: HAIKU, effort_override: "medium" });
    assert.deepEqual(ok.body, { ok: true });
    assert.deepEqual({ ...route("chat", "budget"), updated_at: 0 }, { job: "chat", tier: "budget", model_id: HAIKU, effort_override: "medium", source: "admin", updated_at: 0 });
    const history = t.deps.db.prepare("SELECT * FROM route_history WHERE job = 'chat' AND tier = 'budget' ORDER BY id DESC").get();
    assert.equal(history.new_model_id, HAIKU);
    assert.equal(history.source, "admin");

    await put("chat", "budget", { model_id: MINISTRAL });
    assert.equal(route("chat", "budget").effort_override, "medium", "omitted effort_override keeps the cell's");
    await put("chat", "budget", { model_id: MINISTRAL, effort_override: null });
    assert.equal(route("chat", "budget").effort_override, null, "null clears it");

    t.deps.db.prepare("UPDATE models SET enabled = 0 WHERE id = ?").run(GEMINI);
    const cases = [
      ["poetry", "budget", { model_id: HAIKU }, /Unknown job/],
      ["chat", "premium", { model_id: HAIKU }, /Unknown tier/],
      ["chat", "budget", {}, /model_id is required/],
      ["chat", "budget", { model_id: "openrouter:nope/nope" }, /Unknown model/],
      ["chat", "budget", { model_id: FLUX_KLEIN }, /can't do chat/],
      ["chat", "budget", { model_id: GEMINI }, /turned off/],
      ["chat", "private", { model_id: "openrouter:google/gemini-4-hydrogen" }, /zero-retention or self-hosted/],
      ["chat", "budget", { model_id: HAIKU, effort_override: "bogus" }, /effort_override must be null or one of/],
      ["chat", "budget", { model_id: HAIKU, effort_override: "xhigh" }, /not supported here/],
      ["chat", "budget", { model_id: HAIKU, effort_override: 3 }, /effort_override/],
      ["chat", "budget", { model_id: HAIKU, tier: "quality" }, /Unknown field/],
    ];
    for (const [job, tier, body, message] of cases) {
      const r = await put(job, tier, body);
      assert.equal(r.status, 400, `${job}/${tier} ${JSON.stringify(body)}`);
      assert.match(r.body.error, message);
    }
    t.deps.db.prepare("UPDATE models SET enabled = 1 WHERE id = ?").run(GEMINI);
    assert.equal(route("chat", "budget").model_id, MINISTRAL, "failed edits changed nothing");
    // Media private cells may hold a non-ZDR model (none is ZDR); effort override is just stored.
    assert.equal((await put("image", "private", { model_id: FLUX_KLEIN })).status, 200);
  });

  test("POST and PUT /api/admin/models", async () => {
    const id = "openrouter:acme/rocket-1";
    const model = {
      id,
      label: "Rocket 1",
      vendor: "Acme",
      region: "us",
      gateway: "openrouter",
      slug: "acme/rocket-1",
      jobs: ["chat", "code"],
      price_in: 1,
      price_out: 2,
      zdr: false,
      supports_reasoning: false,
      params: {},
    };
    const created = await admin.c.json("POST", "/api/admin/models", model);
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, { ok: true });
    assert.equal((await admin.c.json("POST", "/api/admin/models", model)).status, 409);
    for (const [body, message] of [
      [{ ...model, id: "openrouter:acme/rocket-2" }, /id must be/],
      [{ ...model, id: "nope:x", gateway: "nope", slug: "x" }, /unknown gateway/],
      [{ ...model, id: "openrouter:acme/r3", slug: "acme/r3", label: undefined }, /label is required/],
      [{ ...model, id: "openrouter:acme/r4", slug: "acme/r4", jobs: ["dance"] }, /jobs must be/],
      [{ ...model, id: "openrouter:acme/r5", slug: "acme/r5", price_in: -1 }, /price_in must be between/],
      [{ ...model, id: "openrouter:acme/r6", slug: "acme/r6", zdr: "yes" }, /zdr must be true or false/],
      [{ ...model, id: "openrouter:acme/r7", slug: "acme/r7", secret: 1 }, /Unknown field/],
    ]) {
      const r = await admin.c.json("POST", "/api/admin/models", body);
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
      assert.match(r.body.error, message);
    }

    // ':' and '/' in the id are URL-encoded on the wire.
    const url = `/api/admin/models/${encodeURIComponent(HAIKU)}`;
    const edit = await admin.c.json("PUT", url, { price_in: 0.2, price_out: null, zdr: false, enabled: false });
    assert.deepEqual(edit.body, { ok: true });
    const row = t.deps.db.prepare("SELECT price_in, price_out, zdr, enabled, label FROM models WHERE id = ?").get(HAIKU);
    assert.deepEqual({ ...row }, { price_in: 0.2, price_out: null, zdr: 0, enabled: 0, label: "Claude Haiku 5.5" });
    assert.equal((await admin.c.json("PUT", url, { enabled: true })).status, 200);

    assert.equal((await admin.c.json("PUT", url, { gateway: "openai" })).status, 400);
    assert.equal((await admin.c.json("PUT", url, { price_in: "cheap" })).status, 400);
    assert.equal((await admin.c.json("PUT", url, {})).status, 400);
    assert.equal((await admin.c.json("PUT", url, { owner: "me" })).status, 400);
    // Catalog-only params are validated before saving: a broken EU pin or TTS limit is a 400, not
    // an internal error on every later request to the model.
    const badPin = await admin.c.json("PUT", url, { params: { openrouter_provider: { onyl: ["anthropic"] } } });
    assert.equal(badPin.status, 400);
    assert.match(badPin.body.error, /openrouter_provider\.onyl is not a supported provider setting/);
    assert.equal((await admin.c.json("PUT", url, { params: { max_chars: "lots" } })).status, 400);
    assert.equal((await admin.c.json("PUT", url, { params: { openrouter_provider: { only: ["anthropic"] } } })).status, 200);
    assert.equal((await admin.c.json("PUT", `/api/admin/models/${encodeURIComponent("openrouter:nope/nope")}`, { price_in: 1 })).status, 404);
  });

  test("GET /api/admin/stats and POST /api/admin/learn", async () => {
    const stats = await admin.c.json("GET", "/api/admin/stats?days=7");
    assert.equal(stats.status, 200);
    assert.equal(stats.body.days, 7);
    assert.ok("auto_pick_on_pct" in stats.body.gate && "gross_margin_pct" in stats.body.gate);
    assert.ok(Array.isArray(stats.body.models));
    assert.equal((await admin.c.json("GET", "/api/admin/stats")).body.days, 28);
    for (const d of ["0", "366", "x"]) assert.equal((await admin.c.json("GET", `/api/admin/stats?days=${d}`)).status, 400, d);

    // Enough happy answers from an alternate to beat the code/quality pick, which has enough
    // unhappy ratings of its own (the learner only replaces a pick it has ratings for).
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      insertRequest(t, { user_id: regular.user.id, job: "code", model_id: HAIKU, tier: "quality", feedback: 1, created_at: now - 1000 + i });
      insertRequest(t, { user_id: regular.user.id, job: "code", model_id: OPUS, tier: "quality", feedback: -1, created_at: now - 2000 + i });
    }
    const dry = await admin.c.json("POST", "/api/admin/learn", { apply: false, min_samples: 3 });
    assert.equal(dry.status, 200);
    assert.equal(dry.body.applied, 0);
    const proposal = dry.body.proposals.find((p) => p.job === "code" && p.tier === "quality");
    assert.ok(proposal, JSON.stringify(dry.body.proposals));
    assert.equal(proposal.proposed_model_id, HAIKU);
    assert.equal(route("code", "quality").model_id, OPUS, "dry run changes nothing");

    const applied = await admin.c.json("POST", "/api/admin/learn", { apply: true, min_samples: 3 });
    assert.ok(applied.body.applied >= 1);
    assert.equal(route("code", "quality").model_id, HAIKU);
    assert.equal(route("code", "quality").source, "learn");
    assert.equal((await admin.c.json("POST", "/api/admin/learn", {})).status, 200, "apply defaults to false");
    assert.equal((await admin.c.json("POST", "/api/admin/learn", { apply: "yes" })).status, 400);
    assert.equal((await admin.c.json("POST", "/api/admin/learn", { days: 0 })).status, 400);
  });

  test("catalog export and import round-trip", async () => {
    const exp = await admin.c.json("GET", "/api/admin/catalog/export");
    assert.equal(exp.status, 200);
    assert.match(exp.headers.get("content-disposition"), /attachment/);
    const catalog = exp.body;
    assert.equal(catalog.models.length, 37);

    // Unmodified: imports cleanly and changes nothing.
    assert.deepEqual((await admin.c.json("POST", "/api/admin/catalog/import", catalog)).body, { ok: true, models: 37, routes: 28 });
    const same = (await admin.c.json("GET", "/api/admin/catalog/export")).body;
    assert.deepEqual(
      same.models,
      catalog.models
    );

    // Modified: one price and one routing cell.
    const edited = structuredClone(catalog);
    edited.models.find((m) => m.id === MINISTRAL).price_in = 0.07;
    edited.routes.find((r) => r.job === "voice" && r.tier === "balanced").model_id = "fal:elevenlabs/tts/eleven-v4-turbo";
    assert.equal((await admin.c.json("POST", "/api/admin/catalog/import", edited)).status, 200);
    const back = (await admin.c.json("GET", "/api/admin/catalog/export")).body;
    assert.equal(back.models.find((m) => m.id === MINISTRAL).price_in, 0.07);
    const cell = back.routes.find((r) => r.job === "voice" && r.tier === "balanced");
    assert.equal(cell.model_id, "fal:elevenlabs/tts/eleven-v4-turbo");
    assert.equal(cell.source, "admin");

    // Bad files: 400 and nothing written.
    const bad = [
      [{ models: "nope", routes: [] }, /must be arrays/],
      [{ models: [{ ...edited.models[0], gateway: "nope" }], routes: [] }, /models\[0\]/],
      [{ models: [], routes: [{ job: "chat", tier: "budget", model_id: "openrouter:nope/nope" }] }, /routes\[0\]: Unknown model/],
      [{ models: [], routes: [{ job: "chat", tier: "budget", model_id: FLUX_KLEIN }] }, /can't do chat/],
      [{ models: [], routes: [{ job: "chat", tier: "nope", model_id: HAIKU }] }, /tier is unknown/],
      [{ models: [], routes: [{ job: "chat", tier: "budget", model_id: HAIKU, effort_override: "max" }] }, /not supported/],
      [{ models: [], routes: [], extra: 1 }, /Unknown field/],
    ];
    for (const [body, message] of bad) {
      const r = await admin.c.json("POST", "/api/admin/catalog/import", body);
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
      assert.match(r.body.error, message);
    }
    assert.deepEqual((await admin.c.json("GET", "/api/admin/catalog/export")).body.routes, back.routes);
  });
});

// ---------------------------------------------------------------------------------------------
// Public, static files, 404s and the error handler
// ---------------------------------------------------------------------------------------------

describe("public providers, static files and errors", () => {
  let t;
  let logger;
  before(async () => {
    logger = captureLogger();
    t = await createTestApp({}, { pipeline: scriptedPipeline(), logger });
  });
  after(() => t.close());

  test("GET /api/public/providers needs no sign-in and shows no internals", async () => {
    t.deps.db.prepare("UPDATE models SET enabled = 0 WHERE id = ?").run(MINISTRAL);
    const r = await t.client({ origin: null }).json("GET", "/api/public/providers");
    t.deps.db.prepare("UPDATE models SET enabled = 1 WHERE id = ?").run(MINISTRAL);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.redaction, { enabled: true, presidio: false });
    assert.equal(r.body.models.length, 35, "disabled models are not listed");
    assert.deepEqual(Object.keys(r.body.models[0]).sort(), ["gateway", "jobs", "label", "region", "retention_note", "self_hosted", "vendor", "zdr"]);
    assert.ok(r.body.models.every((m) => m.retention_note && Array.isArray(m.jobs)));
    assert.ok(!r.body.models.some((m) => m.label === "Ministral 3 3B"));
  });

  test("static files with their MIME types and security headers", async () => {
    const c = t.client();
    const files = [
      ["/", /^text\/html/],
      ["/index.html", /^text\/html/],
      ["/app.js", /^application\/javascript/],
      ["/styles.css", /^text\/css/],
      ["/favicon.svg", /^image\/svg\+xml/],
      ["/privacy.html", /^text\/html/],
      ["/vendor/react.production.min.js", /^application\/javascript/],
    ];
    for (const [url, type] of files) {
      const r = await c.request("GET", url);
      assert.equal(r.status, 200, url);
      assert.match(r.headers.get("content-type"), type, url);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff", url);
      assert.match(r.headers.get("content-security-policy"), /default-src 'self'/, url);
      await r.arrayBuffer();
    }
    const html = await (await c.request("GET", "/")).text();
    assert.match(html, /<div id="root">/);
    assert.equal((await c.request("GET", "/")).headers.get("x-powered-by"), null);
  });

  test("SPA fallback for HTML page paths; real 404s for files and the API", async () => {
    const c = t.client();
    for (const url of ["/settings", "/c/123", "/billing/success"]) {
      const r = await c.request("GET", url, { headers: { Accept: "text/html,application/xhtml+xml" } });
      assert.equal(r.status, 200, url);
      assert.match(r.headers.get("content-type"), /^text\/html/);
      assert.match(await r.text(), /<div id="root">/);
    }
    const missingFile = await c.json("GET", "/missing.js");
    assert.equal(missingFile.status, 404);
    const jsonOnly = await c.json("GET", "/settings", undefined, { headers: { Accept: "application/json" } });
    assert.equal(jsonOnly.status, 404);

    for (const [method, url] of [
      ["GET", "/api/nope"],
      ["POST", "/api/nope"],
      ["GET", "/api/auth/login"],
      ["DELETE", "/api/billing/ledger"],
    ]) {
      const r = await c.json(method, url, method === "GET" ? undefined : {});
      assert.equal(r.status, 404, `${method} ${url}`);
      assert.deepEqual(r.body, { error: "Not found", code: "not_found" });
      assert.match(r.headers.get("content-type"), /^application\/json/);
      assert.equal(r.headers.get("cache-control"), "no-store");
    }
  });

  test("bad JSON, oversized bodies and internal errors", async () => {
    const c = t.client();
    const bad = await c.json("POST", "/api/auth/login", undefined, { body: '{"email": "a@b.c", "password": oops-secret', headers: { "Content-Type": "application/json" } });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body, { error: "Request body is not valid JSON.", code: "bad_request" });
    const big = await c.json("POST", "/api/auth/login", { email: "a@b.c", password: "x".repeat(300 * 1024) });
    assert.equal(big.status, 413);
    assert.equal(big.body.code, "bad_request");
    const notObject = await c.json("POST", "/api/auth/login", undefined, { body: '"just a string"', headers: { "Content-Type": "application/json" } });
    assert.equal(notObject.status, 400);

    // An unexpected exception: generic 500, logged without the message or the body.
    const { c: user } = await signedIn(t, "crash");
    const realCandidates = t.deps.picker.candidates;
    t.deps.picker.candidates = () => {
      throw new TypeError("boom with private data");
    };
    logger.lines.length = 0;
    const r = await user.json("GET", "/api/models?job=chat");
    t.deps.picker.candidates = realCandidates;
    const badEscape = await user.json("GET", "/api/conversations/%E0%A4%A");
    assert.equal(badEscape.status, 400, "a malformed %-escape in a parameter is the client's fault");
    assert.equal(badEscape.body.code, "bad_request");
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: "Internal error", code: "internal" });
    assert.equal(r.headers.get("cache-control"), "no-store");
    const log = logger.lines.join("\n");
    assert.match(log, /GET \/api\/models failed: TypeError/);
    assert.ok(!log.includes("private data"));
    assert.ok(!log.includes("job=chat"), "no query string");
    assert.ok(!logger.lines.some((l) => l.includes("oops-secret")));
  });

  test("AppError extra fields are merged into the body", async () => {
    const { c } = await signedIn(t, "extra");
    const real = t.deps.picker.candidates;
    t.deps.picker.candidates = () => {
      throw new AppError(409, "private_blocked", "Kept private.", { job: "image", code: "overridden?" });
    };
    const r = await c.json("GET", "/api/models?job=image");
    t.deps.picker.candidates = real;
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, { error: "Kept private.", code: "private_blocked", job: "image" });
  });

  test("trust proxy is a hop count, never `true`", async () => {
    assert.equal(t.app.get("trust proxy"), false);
    const proxied = await createTestApp({ TRUST_PROXY: "1" }, { pipeline: scriptedPipeline() });
    try {
      assert.equal(proxied.app.get("trust proxy"), 1);
    } finally {
      await proxied.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Delete everything
// ---------------------------------------------------------------------------------------------

describe("DELETE /api/me", () => {
  test("needs the password, then removes the account and its data", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const email = nextEmail("leaver");
      const c = t.client();
      const user = await c.signup(email, PASSWORD);
      const convId = insertConversation(t, user, { title: "mine" });
      insertTurn(t, user, convId);

      assert.equal((await c.json("DELETE", "/api/me", {})).status, 400);
      const wrong = await c.json("DELETE", "/api/me", { password: "not-my-password" });
      assert.equal(wrong.status, 401);
      assert.deepEqual(wrong.body, { error: "Wrong password.", code: "unauthorized" });
      assert.equal((await c.json("GET", "/api/me")).status, 200, "still signed in");

      const ok = await c.json("DELETE", "/api/me", { password: PASSWORD });
      assert.equal(ok.status, 200);
      assert.deepEqual(ok.body, { ok: true });
      assert.ok(ok.headers.getSetCookie().some((s) => /^gode_session=;/.test(s) && /Max-Age=0/.test(s)), "cookie cleared");
      assert.equal((await c.json("GET", "/api/me")).status, 401);

      const { db } = t.deps;
      const count = (sql) => db.prepare(sql).get(user.id).n;
      assert.equal(count("SELECT COUNT(*) AS n FROM users WHERE id = ?"), 0);
      assert.equal(count("SELECT COUNT(*) AS n FROM conversations WHERE user_id = ?"), 0);
      assert.equal(count("SELECT COUNT(*) AS n FROM messages WHERE user_id = ?"), 0);
      assert.equal(count("SELECT COUNT(*) AS n FROM requests WHERE user_id = ?"), 0);
      assert.equal(count("SELECT COUNT(*) AS n FROM ledger WHERE user_id = ?"), 0);
      assert.equal((await t.client().json("POST", "/api/auth/login", { email, password: PASSWORD })).status, 401);
    } finally {
      await t.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// server.js
// ---------------------------------------------------------------------------------------------

describe("server.js", () => {
  test("start(env) boots, seeds once, logs one line and shuts down", async () => {
    const { start } = require("../server");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-server-"));
    const env = { GODE_MOCK: "1", PORT: "0", DATABASE_PATH: path.join(dir, "gode.db"), GODE_MASTER_KEY: crypto.randomBytes(32).toString("base64") };
    try {
      const log = captureLogger();
      const s = await start(env, { log });
      assert.match(s.url, /^http:\/\/localhost:\d+$/);
      const r = await fetch(`${s.url}/api/public/providers`);
      assert.equal(r.status, 200);
      assert.equal((await r.json()).models.length, 36);
      assert.ok(log.lines.some((l) => /seeded the model catalog/.test(l)));
      const line = log.lines.find((l) => l.includes(s.url));
      assert.match(line, /mock mode · gateways: none · http:\/\/localhost:\d+/);
      await s.close();
      assert.equal(s.server.listening, false);
      assert.throws(() => s.deps.db.prepare("SELECT 1"), "database closed");

      // A second boot on the same file keeps the catalog and does not reseed.
      const log2 = captureLogger();
      const s2 = await start({ ...env, OPENAI_API_KEY: "sk-test", GODE_MOCK: "0" }, { log: log2 });
      assert.ok(!log2.lines.some((l) => /seeded/.test(l)));
      assert.ok(log2.lines.some((l) => /live mode · gateways: openai · /.test(l)));
      await s2.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("DATABASE_PATH=:memory: is SQLite's in-memory database, not a file in the repo", async () => {
    const { start } = require("../server");
    const { loadConfig } = require("../src/config");
    assert.equal(loadConfig({ DATABASE_PATH: ":memory:" }).databasePath, ":memory:");
    assert.equal(loadConfig({ DATABASE_PATH: "data/x.db" }).databasePath, path.join(__dirname, "..", "data", "x.db"));
    const stray = path.join(__dirname, "..", ":memory:");
    const s = await start({ GODE_MOCK: "1", PORT: "0", DATABASE_PATH: ":memory:", GODE_MASTER_KEY: crypto.randomBytes(32).toString("base64") }, { log: captureLogger() });
    try {
      assert.equal((await fetch(`${s.url}/api/public/providers`)).status, 200);
      assert.equal(fs.existsSync(stray), false);
    } finally {
      await s.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// With the real pipeline (mock providers). test/integration.test.js covers the full flows.
// ---------------------------------------------------------------------------------------------

describe("chat with the real pipeline", () => {
  let t;
  let me;
  before(async () => {
    t = await createTestApp();
    me = await signedIn(t, "real");
  });
  after(() => t.close());

  test("chat streams route, deltas and done; the conversation reads back with the same chip", async () => {
    const r = await me.c.sse("/api/chat", { text: "Hello there, how are you today?" });
    assert.equal(r.status, 200);
    const names = r.events.map((e) => e.event);
    assert.equal(names[0], "route");
    assert.equal(names.at(-1), "done", JSON.stringify(r.events.at(-1)));
    assert.ok(names.includes("delta"));
    const route = r.events[0].data;
    const done = r.events.at(-1).data;
    assert.equal(done.conversation_id, route.conversation_id);

    const conv = await me.c.json("GET", `/api/conversations/${route.conversation_id}`);
    assert.equal(conv.status, 200);
    assert.deepEqual(conv.body.messages.map((m) => m.role), ["user", "assistant"]);
    const answer = conv.body.messages[1];
    assert.equal(answer.id, done.message_id);
    assert.equal(answer.text, r.events.filter((e) => e.event === "delta").map((e) => e.data.text).join(""));
    assert.equal(answer.request.chip, done.chip);
    assert.equal(answer.request.id, done.request_id);

    assert.deepEqual((await me.c.json("POST", `/api/messages/${answer.id}/feedback`, { value: 1 })).body, { ok: true });
    const regen = await me.c.sse(`/api/messages/${answer.id}/regenerate`, {});
    assert.equal(regen.events.at(-1).event, "done");
    const after = await me.c.json("GET", `/api/conversations/${route.conversation_id}`);
    assert.equal(after.body.messages.length, 2, "the old answer is superseded");
    assert.equal(after.body.messages[1].id, regen.events.at(-1).data.message_id);
  });

  test("disconnecting mid-answer releases the credit hold", async () => {
    const ac = new AbortController();
    const r = await me.c.sse(
      "/api/chat",
      { text: "Write a long story about a lighthouse keeper and the sea, with many words in it please." },
      { signal: ac.signal, onEvent: (e) => e.event === "delta" && ac.abort() }
    );
    assert.equal(r.aborted, true);
    await waitFor(() => t.app.locals.activeStreams() === 0);
    await waitFor(() => t.deps.db.prepare("SELECT COUNT(*) AS n FROM holds WHERE user_id = ?").get(me.user.id).n === 0);
  });
});

// ---------------------------------------------------------------------------------------------
// Stopped and unanswered turns, password change, the privacy page's deployment facts
// ---------------------------------------------------------------------------------------------

describe("conversation state, password change and privacy facts", () => {
  test("a stopped answer reads back as stopped; a question without a live answer is unanswered", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const me = await signedIn(t, "stopper");
      const convId = insertConversation(t, me.user, { title: "Stops" });
      const at = Date.now() - 10_000;
      const answered = insertTurn(t, me.user, convId, { at });
      // A stopped answer: content { text, stopped: true }, requests.status 'stopped', charged.
      const stopped = insertTurn(t, me.user, convId, { at: at + 10, question: "Tell me a story", answer: "Once upon", request: { status: "stopped", charged_micros: 1234 } });
      const dek = userRow(t, me.user.id).wrapped_dek;
      t.deps.db.prepare("UPDATE messages SET content_enc = ? WHERE id = ?").run(t.deps.keyring.encrypt(dek, { text: "Once upon", stopped: true }, { json: true }), stopped.asstId);
      // A question whose answer failed (only the question was stored).
      const orphanId = crypto.randomUUID();
      t.deps.db
        .prepare("INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, superseded, created_at) VALUES (?, ?, ?, 'user', ?, NULL, NULL, 0, ?)")
        .run(orphanId, convId, me.user.id, t.deps.keyring.encrypt(dek, { text: "This one failed" }, { json: true }), at + 20);

      const r = await me.c.json("GET", `/api/conversations/${convId}`);
      assert.equal(r.status, 200);
      const byId = Object.fromEntries(r.body.messages.map((m) => [m.id, m]));
      assert.equal(byId[answered.userMsgId].answered, true);
      assert.equal(byId[stopped.userMsgId].answered, true, "a kept partial answer answers its question");
      assert.equal(byId[orphanId].answered, false);
      const kept = byId[stopped.asstId];
      assert.equal(kept.stopped, true);
      assert.equal(kept.text, "Once upon");
      assert.equal(kept.request.status, "stopped");
      assert.equal(kept.request.cost_usd, 0.001234);
      assert.match(kept.request.chip, / · \$0\.0012$/);
      assert.equal(byId[answered.asstId].stopped, undefined, "only stopped answers carry the flag");
    } finally {
      await t.close();
    }
  });

  test("POST /api/me/password: checks the current one, applies the rules, signs out the other devices", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const me = await signedIn(t, "pwchange");
      const other = t.client();
      assert.equal((await other.json("POST", "/api/auth/login", { email: me.user.email, password: PASSWORD })).status, 200);

      const wrong = await me.c.json("POST", "/api/me/password", { current: "not-the-password", next: "a fresh passphrase" });
      assert.equal(wrong.status, 401);
      assert.equal(wrong.body.code, "unauthorized");
      assert.equal((await me.c.json("GET", "/api/me")).status, 200, "a wrong current password does not sign this device out");
      for (const next of ["password", "        ", "short"]) {
        const r = await me.c.json("POST", "/api/me/password", { current: PASSWORD, next });
        assert.equal(r.status, 400, JSON.stringify(next));
      }
      assert.equal((await me.c.json("POST", "/api/me/password", { current: PASSWORD })).status, 400, "next is required");
      assert.equal((await me.c.json("POST", "/api/me/password", { current: PASSWORD, next: "x".repeat(20), extra: 1 })).status, 400, "unknown keys");

      const ok = await me.c.json("POST", "/api/me/password", { current: PASSWORD, next: "a fresh passphrase" });
      assert.equal(ok.status, 200);
      assert.deepEqual(ok.body, { ok: true, signed_out_sessions: 1 });
      assert.equal((await me.c.json("GET", "/api/me")).status, 200, "this device stays signed in");
      assert.equal((await other.json("GET", "/api/me")).status, 401, "the other device is signed out");
      assert.equal((await t.client().json("POST", "/api/auth/login", { email: me.user.email, password: PASSWORD })).status, 401);
      assert.equal((await t.client().json("POST", "/api/auth/login", { email: me.user.email, password: "a fresh passphrase" })).status, 200);
      assert.equal((await t.client().json("POST", "/api/me/password", { current: "a", next: "b" })).status, 401, "needs a session");
    } finally {
      await t.close();
    }
  });

  test("POST /api/me/password is rate limited per user", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline(), rateLimits: { password: { max: 2 } } });
    try {
      const me = await signedIn(t, "pwlimit");
      for (let i = 0; i < 2; i++) assert.equal((await me.c.json("POST", "/api/me/password", { current: "nope-nope", next: "a fresh passphrase" })).status, 401);
      assert.equal((await me.c.json("POST", "/api/me/password", { current: PASSWORD, next: "a fresh passphrase" })).status, 429);
    } finally {
      await t.close();
    }
  });

  test("GET /api/public/providers states what the privacy promises depend on (mock: everything runs)", async () => {
    const t = await createTestApp({}, { pipeline: scriptedPipeline() });
    try {
      const r = await t.client({ origin: null }).json("GET", "/api/public/providers");
      assert.equal(r.status, 200);
      assert.equal(r.body.selfhosted, true);
      assert.equal(r.body.presidio, false);
      assert.equal(r.body.private_fallback, "zdr");
      assert.equal(r.body.media_proxy, true);
      assert.deepEqual(r.body.classifier, { label: "DeepSeek V4.1 Flash", zdr: true, region: "cn", self_hosted: false });
      assert.ok(!JSON.stringify(r.body).includes("openrouter:"), "no model ids or other internals");
    } finally {
      await t.close();
    }
  });

  test("GET /api/public/providers without a self-hosted model and with PRIVATE_FALLBACK=block", async () => {
    const t = await createTestApp(
      { GODE_MOCK: "0", OPENROUTER_API_KEY: "sk-or-test", SELFHOSTED_BASE_URL: "", PRIVATE_FALLBACK: "block", MEDIA_PROXY: "0" },
      { pipeline: scriptedPipeline() }
    );
    try {
      const r = await t.client({ origin: null }).json("GET", "/api/public/providers");
      assert.equal(r.status, 200);
      assert.equal(r.body.selfhosted, false, "no 'stays on our servers' promise");
      assert.equal(r.body.private_fallback, "block");
      assert.equal(r.body.media_proxy, false);
      assert.ok(r.body.models.length > 0 && r.body.models.every((m) => m.gateway === "openrouter"), "only reachable gateways are listed");
      assert.equal(r.body.classifier.label, "DeepSeek V4.1 Flash");
      const me = await signedIn(t, "nofacts");
      const cfg = (await me.c.json("GET", "/api/me")).body.config;
      assert.equal(cfg.selfhosted, false);
      assert.equal(cfg.private_fallback, "block");
    } finally {
      await t.close();
    }
  });
});
