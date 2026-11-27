"use strict";
// What the simulated backend does that a viewer will notice: the seeded demo account, routing and
// pins, private routing with redaction, media progress, Stop (kept and charged), failures (not
// charged), persistence through localStorage (and running without it), and that only same-origin
// /api/* requests are intercepted.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { previewBuild, previewBackend, previewClient, fakeWindow } = require("./helpers");

const ev = (x, name) => (x.events.find((e) => e.event === name) || {}).data;

test("first visit: signed in as the demo admin with about $5 and the seeded conversations", async () => {
  const b = await previewBackend();
  const c = previewClient(b);
  const me = await c.json("GET", "/api/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "demo@example.com");
  assert.equal(me.body.user.is_admin, true);
  assert.equal(me.body.user.plan, "balanced");
  assert.ok(me.body.user.balance_usd > 5 && me.body.user.balance_usd < 5.25, `balance ${me.body.user.balance_usd}`);
  const list = (await c.json("GET", "/api/conversations")).body.conversations;
  assert.equal(list.length, 5);
  assert.equal(list[0].title, "Welcome to the Gode preview");
  const convs = {};
  for (const conv of list) convs[conv.title] = (await c.json("GET", `/api/conversations/${conv.id}`)).body;
  const answers = Object.values(convs).flatMap((x) => x.messages.filter((m) => m.request));
  assert.ok(answers.some((m) => m.request.job === "code" && /```python/.test(m.text)), "a code answer with a code block");
  const priv = answers.find((m) => m.request.private);
  assert.ok(priv, "a private answer");
  assert.equal(priv.request.tier, "private");
  assert.equal(priv.request.zdr, true);
  assert.deepEqual(priv.request.redactions, { PERSON: 1, EMAIL: 1 });
  assert.ok(priv.text.includes("‹name 1›") && priv.text.includes("Sam Carter") === false, "shows what the model got, not the name");
  const img = answers.find((m) => m.request.job === "image");
  assert.match(img.media[0].url, /^data:image\/svg\+xml;base64,/);
  assert.equal(img.request.chip, "Qwen Image 3 · $0.0521");
  const pinned = answers.find((m) => m.request.pinned);
  assert.ok(pinned, "a follow-up answered by the pinned model");
  const days = new Set(list.map((x) => Math.floor((Date.now() - x.updated_at) / 86_400_000)));
  assert.ok(days.size >= 3, "spread over several days");
  // Ledger: welcome credit, a purchase and the charges; nothing on hold.
  const kinds = new Set(b.db.rows("ledger").map((l) => l.kind));
  for (const k of ["signup_bonus", "purchase", "charge"]) assert.ok(kinds.has(k), k);
  assert.equal(b.db.rows("holds").length, 0);
  assert.ok(b.db.rows("requests").length >= 5);
});

test("a new chat streams a preview answer that names the model, then a final chip with the cost", async () => {
  const b = await previewBackend();
  const c = previewClient(b);
  const before = (await c.json("GET", "/api/me")).body.user.balance_usd;
  const res = await c.sse("/api/chat", { text: "Write a Python function that checks whether a string is a palindrome." });
  const route = ev(res, "route");
  const done = ev(res, "done");
  assert.equal(route.job, "code");
  assert.match(route.model.label, /Claude|Qwen/);
  const text = res.events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
  assert.match(text, /no AI model was called/);
  assert.ok(text.includes(route.model.label));
  assert.match(text, /```python/);
  assert.ok(done.cost_usd > 0);
  assert.ok(Math.abs(done.balance_usd - (before - done.cost_usd)) < 1e-9, "charged exactly the chip's cost");
  assert.ok(done.chip.startsWith(route.model.label + " · "));
});

test("private: a diagnosis with a name routes to a zero-retention model, redacted, and stays private", async () => {
  const b = await previewBackend();
  const c = previewClient(b);
  const first = await c.sse("/api/chat", { text: "My name is Jo Tester. I was diagnosed with diabetes, what should I eat?" });
  const route = ev(first, "route");
  assert.equal(route.private, true);
  assert.equal(route.tier, "private");
  assert.equal(route.zdr, true);
  assert.equal(route.redactions.PERSON, 1);
  assert.equal(route.classifier_model, "heuristic", "a private message never goes to an outside classifier");
  const text = first.events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
  assert.ok(text.includes("‹name 1›"));
  const follow = await c.sse("/api/chat", { conversation_id: route.conversation_id, text: "Thanks! And what about breakfast ideas?" });
  assert.equal(ev(follow, "route").private, true, "sticky: the conversation stays private");
  assert.equal(ev(follow, "route").tier, "private");
  const models = await c.json("GET", `/api/models?job=chat&conversation_id=${route.conversation_id}`);
  assert.ok(models.body.models.length > 0 && models.body.models.every((m) => m.zdr || m.self_hosted), "only private-safe models in the menu");
});

test("media: queued and running progress, then the picture; a voice gets a sound", async () => {
  const b = await previewBackend();
  const c = previewClient(b);
  const res = await c.sse("/api/chat", { text: "Draw a picture of a red fox in the snow" });
  const progress = res.events.filter((e) => e.event === "progress").map((e) => e.data.status);
  assert.deepEqual(progress, ["queued", "queued", "queued", "running"]);
  const media = ev(res, "media");
  assert.equal(media.type, "image");
  assert.match(media.url, /^data:image\/svg\+xml;base64,/);
  const svg = Buffer.from(media.url.split(",")[1], "base64").toString("utf8");
  assert.match(svg, /no image model was called/);
  assert.equal(ev(res, "done").chip, "Qwen Image 3 · $0.0521");
  const voice = await c.sse("/api/chat", { text: "Read this aloud in a warm voice: Good morning, everyone!" });
  assert.equal(ev(voice, "route").job, "voice");
  assert.match(ev(voice, "media").url, /^data:audio\/wav;base64,/);
});

test("Stop keeps and charges the partial answer; the reader gets an AbortError", async () => {
  const b = await previewBackend({ timing: "live" });
  const c = previewClient(b);
  const before = (await c.json("GET", "/api/me")).body.user.balance_usd;
  const controller = new AbortController();
  let deltas = 0;
  const res = await c.sse("/api/chat", { text: "Tell me a long story about a lighthouse keeper." }, {
    signal: controller.signal,
    onEvent: (e) => {
      if (e.event === "delta" && ++deltas === 5) controller.abort();
    },
  });
  assert.equal(res.aborted, true);
  assert.equal(res.error.name, "AbortError");
  const route = ev(res, "route");
  // The pipeline stores the stopped answer as soon as it sees the client go.
  let last;
  for (let i = 0; i < 40; i++) {
    const conv = await c.json("GET", `/api/conversations/${route.conversation_id}`);
    last = conv.body.messages[conv.body.messages.length - 1];
    if (last.role === "assistant") break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(last.role, "assistant");
  assert.equal(last.stopped, true);
  assert.equal(last.request.status, "stopped");
  assert.ok(last.text.length > 0);
  assert.ok(last.request.cost_usd > 0, "charged for what was produced");
  const after = (await c.json("GET", "/api/me")).body.user.balance_usd;
  assert.ok(after < before && after >= 0);
  assert.equal(b.db.rows("holds").length, 0, "the hold was settled");
});

test("an upstream failure mid-answer is an error event and costs nothing; Try again reuses the question", async () => {
  const b = await previewBackend();
  const c = previewClient(b);
  const before = (await c.json("GET", "/api/me")).body.user.balance_usd;
  const res = await c.sse("/api/chat", { text: "GODE_MOCK_FAIL_MIDSTREAM please explain compound interest" });
  assert.equal(ev(res, "error").code, "upstream_error");
  assert.equal((await c.json("GET", "/api/me")).body.user.balance_usd, before);
  const convId = ev(res, "route").conversation_id;
  await c.sse("/api/chat", { conversation_id: convId, text: "GODE_MOCK_FAIL_MIDSTREAM please explain compound interest" });
  const conv = await c.json("GET", `/api/conversations/${convId}`);
  assert.equal(conv.body.messages.filter((m) => m.role === "user").length, 1, "not stored twice");
  assert.equal(conv.body.messages[0].answered, false);
});

test("one answer at a time per conversation: a second send gets busy", async () => {
  const b = await previewBackend({ timing: "live" });
  const c = previewClient(b);
  const first = await c.sse("/api/chat", { text: "hello there" });
  const convId = ev(first, "route").conversation_id;
  // Send the second message once the first answer is under way (its route event has arrived).
  let started;
  const routed = new Promise((resolve) => (started = resolve));
  const running = c.sse("/api/chat", { conversation_id: convId, text: "and another thing" }, { onEvent: (e) => e.event === "route" && started() });
  await routed;
  const second = await c.sse("/api/chat", { conversation_id: convId, text: "and one more" });
  await running;
  assert.equal(ev(second, "error").code, "busy");
});

test("state survives a reload through localStorage, signed in, under one versioned key", async () => {
  const { win, store } = fakeWindow();
  const b1 = await previewBackend({ window: win, persist: true });
  const c1 = previewClient(b1);
  const res = await c1.sse("/api/chat", { text: "Remember this conversation please" });
  b1.storage.flush();
  assert.deepEqual([...store.keys()], ["gode-preview:v1"]);
  const b2 = await previewBackend({ window: win, persist: true });
  assert.equal(b2.restored, true);
  const c2 = previewClient(b2);
  assert.equal((await c2.json("GET", "/api/me")).status, 200, "still signed in");
  const conv = await c2.json("GET", `/api/conversations/${ev(res, "route").conversation_id}`);
  assert.equal(conv.status, 200);
  assert.equal(conv.body.messages.length, 2);
});

test("with storage blocked everything still works, in memory", async () => {
  const { win } = fakeWindow({ blocked: true });
  const b = await previewBackend({ window: win, persist: true });
  assert.equal(b.storage.persistent, false);
  const c = previewClient(b);
  assert.equal((await c.json("GET", "/api/me")).body.user.email, "demo@example.com");
  const res = await c.sse("/api/chat", { text: "Does this work without storage?" });
  assert.ok(ev(res, "done"));
});

test("log out, sign up, log back in to the demo account; delete everything removes the account (also after a reload)", async () => {
  const { win } = fakeWindow();
  const b = await previewBackend({ window: win, persist: true });
  const c = previewClient(b);
  assert.equal((await c.json("POST", "/api/auth/logout", {})).status, 200);
  assert.equal((await c.json("GET", "/api/me")).status, 401);
  const wrong = await c.json("POST", "/api/auth/login", { email: "demo@example.com", password: "not the password" });
  assert.equal(wrong.status, 401);
  assert.equal((await c.json("POST", "/api/auth/login", { email: "demo@example.com", password: "preview-demo" })).status, 200);
  assert.equal((await c.json("DELETE", "/api/me", { password: "preview-demo" })).status, 200);
  assert.equal((await c.json("GET", "/api/me")).status, 401);
  const demoId = b.db.rows("users").find((u) => u.email === "demo@example.com");
  assert.equal(demoId, undefined, "the demo account is gone");
  assert.deepEqual(
    b.db.rows("users").map((u) => u.email).sort(),
    ["alex@example.com", "jordan@example.com", "mei@example.com", "priya@example.com"],
    "the made-up teammates stay"
  );
  assert.equal(b.db.rows("conversations").length, 0, "the demo's conversations are gone (the teammates have none)");
  assert.ok(b.db.rows("usage_archive").length > 0, "usage kept as day totals, as on the server");
  const teamIds = new Set(b.db.rows("users").map((u) => u.id));
  assert.ok(b.db.rows("ledger").every((l) => l.user_id === null || teamIds.has(l.user_id)), "the demo's ledger rows are unlinked");
  assert.ok(b.db.rows("ledger").some((l) => l.user_id === null && l.kind === "purchase"), "its purchase stays in the books");
  b.storage.flush();
  // A reload does not bring the demo back: the deletion is stored.
  const b2 = await previewBackend({ window: win, persist: true });
  assert.equal((await previewClient(b2).json("GET", "/api/me")).status, 401);
  // Re-registering the address works, without a second welcome credit.
  const again = await previewClient(b2).json("POST", "/api/auth/signup", { email: "demo@example.com", password: "a new passphrase" });
  assert.equal(again.status, 201);
  assert.equal(again.body.signup_bonus_usd, 0);
  // FIRST_USER_ADMIN makes only the very first account an admin; the teammates came before this one.
  assert.equal(again.body.user.is_admin, false, "a new account is an ordinary user");
});

test("after Delete everything, the demo's own credentials bring the demo account back (log in or sign up)", async () => {
  for (const route of ["/api/auth/login", "/api/auth/signup"]) {
    const { win } = fakeWindow();
    const b = await previewBackend({ window: win, persist: true });
    const c = previewClient(b);
    const before = (await c.json("GET", "/api/conversations")).body.conversations.length;
    assert.equal((await c.json("DELETE", "/api/me", { password: "preview-demo" })).status, 200);
    b.storage.flush();
    // A reload: the deletion was stored, so the auth screen shows.
    const b2 = await previewBackend({ window: win, persist: true });
    const c2 = previewClient(b2);
    assert.equal((await c2.json("GET", "/api/me")).status, 401);
    // Other credentials change nothing: the real routes answer.
    assert.equal((await c2.json("POST", "/api/auth/login", { email: "demo@example.com", password: "something else" })).status, 401);
    assert.equal(b2.db.rows("users").some((u) => u.email === "demo@example.com"), false);
    const res = await c2.json("POST", route, { email: " Demo@Example.com ", password: "preview-demo" });
    assert.equal(res.status, 200, `${route}: ${res.text}`);
    assert.equal(res.body.user.email, "demo@example.com");
    const me = (await c2.json("GET", "/api/me")).body.user;
    assert.equal(me.is_admin, true, "the demo is an admin again");
    assert.ok(me.balance_usd > 5 && me.balance_usd < 5.25, `about $5 again: ${me.balance_usd}`);
    const ledger = (await c2.json("GET", "/api/billing/ledger")).body.entries.map((e) => e.kind);
    assert.ok(ledger.includes("signup_bonus") && ledger.includes("purchase"), ledger.join());
    const convs = (await c2.json("GET", "/api/conversations")).body.conversations;
    assert.equal(convs.length, before, "the sample chats and the welcome note are back");
    assert.equal(convs[0].title, "Welcome to the Gode preview");
    assert.equal((await c2.json("GET", "/api/admin/stats")).status, 200);
    // Only once: the demo exists now, so a sign-up with its address is the real 409.
    assert.equal((await c2.json("POST", "/api/auth/logout", {})).status, 200);
    assert.equal((await c2.json("POST", "/api/auth/signup", { email: "demo@example.com", password: "preview-demo" })).status, 409);
    assert.equal(b2.db.rows("users").filter((u) => u.email === "demo@example.com").length, 1);
  }
});

test("only same-origin /api/* requests are intercepted", async () => {
  const { api } = previewBuild();
  const b = await previewBackend();
  const seen = [];
  const win = { location: { href: "https://preview.example/page/", origin: "https://preview.example" }, fetch: async (u) => (seen.push(String(u)), new Response("real")) };
  const uninstall = api.installFetch(win, b);
  assert.equal((await win.fetch("/api/me")).status, 200);
  assert.equal((await win.fetch("https://preview.example/api/public/providers")).status, 200);
  assert.equal(await (await win.fetch("styles.css")).text(), "real");
  assert.equal(await (await win.fetch("/apiary")).text(), "real");
  assert.equal(await (await win.fetch("https://elsewhere.example/api/me")).text(), "real");
  assert.deepEqual(seen, ["styles.css", "/apiary", "https://elsewhere.example/api/me"]);
  uninstall();
});

test("the app's six suggestion chips route to their jobs", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const appJs = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app.js"), "utf8");
  const suggestions = [...appJs.matchAll(/\{ job: '(\w+)', label: '[^']+', text: '([^']+)' \}/g)].map((m) => ({ job: m[1], text: m[2] }));
  assert.equal(suggestions.length, 6, "the SUGGESTIONS list of public/app.js");
  const b = await previewBackend();
  const c = previewClient(b);
  for (const s of suggestions) {
    const res = await c.sse("/api/chat", { text: s.text });
    assert.equal(ev(res, "route").job, s.job, s.text);
    assert.ok(ev(res, "done"), `answered: ${s.text}`);
  }
});

test("the admin overview is computed from the preview's own rows: it moves as the viewer chats, and the money adds up with the ledger", async () => {
  const b = await previewBackend();
  const c = previewClient(b);
  const stats = async () => (await c.json("GET", "/api/admin/stats?days=28")).body;
  const s0 = await stats();
  assert.equal(s0.gate.total_users, 5, "the demo account and four made-up teammates");
  assert.ok(s0.gate.requests > 150, `seeded history: ${s0.gate.requests} requests`);
  assert.equal(s0.gate.users, 5, "all of them active in the window");
  assert.equal(s0.gate.auto_pick_kept_pct, 80, "one teammate picks models by hand");
  assert.equal(s0.gate.credits_cover_api_costs, true);
  assert.equal(s0.gate.cash_covers_api_costs, true);
  assert.equal(s0.gate.gross_margin_pct, 23.1, "a 30% margin on API cost is 23.1% of the charge");
  assert.ok(s0.gate.override_rate > 0 && s0.gate.thumbs_up_rate > 0.5);

  const res = await c.sse("/api/chat", { text: "Write a haiku about autumn leaves." });
  const done = ev(res, "done");
  const route = ev(res, "route");
  await c.json("POST", `/api/messages/${done.message_id}/feedback`, { value: -1 });
  const s1 = await stats();
  assert.equal(s1.gate.requests, s0.gate.requests + 1, "one more request");
  assert.equal(Math.round((s1.gate.charged_usd - s0.gate.charged_usd) * 1e6), Math.round(done.cost_usd * 1e6), "charged moves by the answer's cost");
  assert.equal(Math.round((s1.gate.api_cost_usd - s0.gate.api_cost_usd) * 1e6), Math.round(done.api_cost_usd * 1e6));
  const row = (s, jobName) => s.models.find((m) => m.job === jobName && m.model_id === route.model.id) || { n: 0, down: 0 };
  assert.equal(row(s1, route.job).n, row(s0, route.job).n + 1);
  assert.equal(row(s1, route.job).down, row(s0, route.job).down + 1, "the thumbs down shows up");

  // Stop part-way: kept, charged, and counted as API cost on a stopped request.
  const ctl = new AbortController();
  await c.sse("/api/chat", { text: "Explain the history of the printing press in detail, please." }, { onEvent: (e) => e.event === "delta" && ctl.abort(), signal: ctl.signal });
  await new Promise((r) => setTimeout(r, 20));
  const s2 = await stats();
  assert.equal(s2.gate.requests, s1.gate.requests + 1);
  assert.ok(s2.gate.failed_api_cost_usd > s1.gate.failed_api_cost_usd, "a stopped answer's cost is in failed_api_cost_usd");

  // The books: each balance is the sum of its ledger, every charge on a request is a ledger charge,
  // and the gate's purchases and free credit are the ledger's.
  for (const u of b.db.rows("users")) {
    const sum = b.db.rows("ledger").filter((l) => l.user_id === u.id).reduce((n, l) => n + l.delta_micros, 0);
    assert.equal(u.balance_micros, sum, `${u.email}: balance == SUM(ledger)`);
  }
  const charged = b.db.rows("requests").reduce((n, r) => n + r.charged_micros, 0);
  const charges = -b.db.rows("ledger").filter((l) => l.kind === "charge").reduce((n, l) => n + l.delta_micros, 0);
  assert.equal(charged, charges, "requests.charged_micros == the ledger's charges");
  assert.equal(Math.round(s2.gate.charged_usd * 1e6), charged, "all of it inside the 28-day window");
  const since = s2.gate.since_ms;
  const sumKind = (kinds) => b.db.rows("ledger").filter((l) => l.created_at >= since && kinds.includes(l.kind)).reduce((n, l) => n + l.delta_micros, 0);
  assert.equal(Math.round(s2.gate.purchases_usd * 1e6), sumKind(["purchase"]));
  assert.equal(Math.round(s2.gate.free_credit_usd * 1e6), sumKind(["signup_bonus", "dev_topup"]));
  assert.equal(b.db.rows("holds").length, 0, "nothing left on hold");

  // A shorter window has fewer requests: the history is spread over three weeks.
  const week = (await c.json("GET", "/api/admin/stats?days=7")).body;
  assert.ok(week.gate.requests < s2.gate.requests && week.gate.requests > 10);
});

test("the seeded team history is the same on every first visit and gives the learner two proposals", async () => {
  const shape = async () => {
    const b = await previewBackend();
    const c = previewClient(b);
    const stats = (await c.json("GET", "/api/admin/stats?days=28")).body;
    const learn = (await c.json("POST", "/api/admin/learn", {})).body;
    return {
      models: stats.models.map((m) => [m.job, m.model_id, m.n, m.up, m.down, m.regenerated, m.overridden, m.avg_cost_micros]),
      proposals: learn.proposals.map((p) => [p.job, p.tier, p.current_model_id, p.proposed_model_id, p.current_n, p.proposed_n]),
      users: (await c.json("GET", "/api/admin/users")).body.users.map((u) => [u.email, u.balance_usd, u.is_admin]),
    };
  };
  const [a, z] = [await shape(), await shape()];
  assert.deepEqual(a, z);
  assert.deepEqual(
    a.proposals.map((p) => p.slice(0, 4)),
    [
      ["chat", "quality", "openrouter:google/gemini-4-carbon", "openrouter:anthropic/claude-opus-5.5"],
      ["code", "budget", "openrouter:qwen/qwen3-coder-next", "openrouter:deepseek/deepseek-v4.1-flash"],
    ]
  );
  assert.deepEqual(a.users.map((u) => u[0]), ["demo@example.com", "mei@example.com", "jordan@example.com", "priya@example.com", "alex@example.com"], "newest first");
  assert.deepEqual(a.users.map((u) => u[2]), [true, false, false, false, false], "only the demo account is an admin");
  assert.ok(a.users.every((u) => u[1] > 0), "everyone still has credit");
});

test("billing in the preview: test credit works, checkout says payments are off and gives no URL", async () => {
  const b = await previewBackend();
  const c = previewClient(b);
  const me = (await c.json("GET", "/api/me")).body;
  assert.equal(me.config.stripe_enabled, true, "the packs are shown as on a live server");
  assert.equal(me.config.dev_topup, true);
  const checkout = await c.json("POST", "/api/billing/checkout", { pack_usd: 10 });
  assert.equal(checkout.status, 503);
  assert.equal(checkout.body.code, "gateway_not_configured");
  assert.equal(checkout.body.url, undefined, "nothing to navigate to");
  const top = await c.json("POST", "/api/billing/dev-topup", { usd: 5 });
  assert.equal(Math.round((top.body.balance_usd - me.user.balance_usd) * 1e6), 5_000_000);
  const ledger = (await c.json("GET", "/api/billing/ledger")).body;
  assert.equal(ledger.entries[0].kind, "dev_topup");
  assert.equal(ledger.held_usd, 0);
  // While an answer runs, its hold shows as held_usd.
  const b2 = await previewBackend({ timing: "live" });
  const c2 = previewClient(b2);
  let held = null;
  await c2.sse("/api/chat", { text: "Tell me about the moon" }, {
    onEvent: async (e) => {
      if (e.event === "route" && held === null) held = (await c2.json("GET", "/api/billing/ledger")).body.held_usd;
    },
  });
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(held > 0, `held while running: ${held}`);
  assert.equal((await c2.json("GET", "/api/billing/ledger")).body.held_usd, 0, "released when done");
});

test("a first visit opens the welcome note; a stored visit or a route of its own is left alone", async () => {
  const { api } = previewBuild();
  const b = await previewBackend();
  assert.ok(b.welcomeConversationId);
  const conv = await previewClient(b).json("GET", `/api/conversations/${b.welcomeConversationId}`);
  assert.equal(conv.body.conversation.title, "Welcome to the Gode preview");
  const fakeWin = (hash) => {
    const win = { location: { hash }, history: { state: null, replaceState: (s, t, u) => (win.replaced = u) } };
    return win;
  };
  for (const hash of ["", "#", "#/"]) {
    const w = fakeWin(hash);
    api.openWelcome(w, b);
    assert.equal(w.replaced, `#/c/${b.welcomeConversationId}`, `from "${hash}"`);
  }
  const own = fakeWin("#/settings");
  api.openWelcome(own, b);
  assert.equal(own.replaced, undefined, "a route of its own wins");
  const { win } = fakeWindow();
  const first = await previewBackend({ window: win, persist: true });
  first.storage.flush();
  const again = await previewBackend({ window: win, persist: true });
  assert.equal(again.welcomeConversationId, null, "a stored visit keeps its own place");
  assert.ok(first.welcomeConversationId);
});

test("the classifier stand-in's media rule skips questions and sentences: they stay chat", async () => {
  const { mediaDescriptionJob } = require("../src/providers");
  for (const text of [
    "A song stuck in my head all day, how do I get rid of it",
    "A picture is worth a thousand words.",
    "A video I watched yesterday was great",
    "The song that plays at weddings, what is it called",
    "A photo of my dog. Can you make it brighter",
  ]) {
    assert.equal(mediaDescriptionJob(text), null, text);
  }
  assert.equal(mediaDescriptionJob("A 5-second video of waves rolling onto a beach at sunset."), "video");
  assert.equal(mediaDescriptionJob("A calm lo-fi track with soft piano, about 30 seconds"), "music");
  assert.equal(mediaDescriptionJob("A watercolor painting of a fox in the snow"), "image");
  const b = await previewBackend();
  const c = previewClient(b);
  const res = await c.sse("/api/chat", { text: "A song stuck in my head all day, how do I get rid of it" });
  assert.equal(ev(res, "route").job, "chat");
  assert.ok(ev(res, "done").cost_usd < 0.01, "a chat answer's cost, not a song's");
});

test("every request the simulated gateways got says so in the transparency log, media and failures too", async () => {
  const b = await previewBackend();
  const c = previewClient(b);
  const image = await c.sse("/api/chat", { text: "Draw a picture of a lighthouse at dawn" });
  const failed = await c.sse("/api/chat", { text: "Please answer this GODE_MOCK_FAIL thanks" });
  assert.ok(ev(failed, "error"));
  const rows = (await c.json("GET", "/api/transparency")).body.requests;
  const byId = (id) => rows.find((r) => r.id === id);
  assert.equal(byId(ev(image, "route").request_id).upstream_provider, "preview (simulated)");
  assert.equal(byId(ev(failed, "route").request_id).upstream_provider, "preview (simulated)");
  // Seeded rows too: the demo's picture and the team's media.
  const all = b.db.rows("requests");
  assert.ok(all.length > 150);
  const unmarked = all.filter((r) => r.gateway && !r.upstream_provider);
  assert.deepEqual(unmarked.map((r) => [r.job, r.status]), [], "every row with a gateway is marked simulated");
});

test("the classifier stand-in reads picture descriptions as pictures: watercolor, cartoon, 3D render, thumbnail", async () => {
  const { mediaDescriptionJob } = require("../src/providers");
  for (const text of [
    "A watercolor of a fox in the snow",
    "A cartoon of a dog surfing",
    "A 3D render of a futuristic city at night",
    "A watercolor of a person managing their diabetes with a glucose monitor",
    "A thumbnail for my YouTube video about bread",
    "A comic about a cat who runs a bakery",
  ]) {
    assert.equal(mediaDescriptionJob(text), "image", text);
  }
  // Still chat: a book title, a clause of its own, a question.
  for (const text of ["The art of negotiation", "A cartoon I watched as a kid was great", "A meme is funny, why?"]) assert.equal(mediaDescriptionJob(text), null, text);
  const b = await previewBackend();
  const c = previewClient(b);
  const res = await c.sse("/api/chat", { text: "A cartoon of a dog surfing" });
  assert.equal(ev(res, "route").job, "image");
  assert.equal(ev(res, "media").type, "image");
});

test("a follow-up keeps the chat's job, as the classifier model would with the history: code stays code, a picture is redrawn", async () => {
  const { followUpJob } = require("../src/providers");
  const b = await previewBackend();
  const c = previewClient(b);
  const convs = (await c.json("GET", "/api/conversations")).body.conversations;
  const code = convs.find((x) => /Python script/.test(x.title));
  const codeModel = (await c.json("GET", `/api/conversations/${code.id}`)).body.messages.find((m) => m.request).request.model_id;
  for (const text of ["Now make it also handle PNG files", "Add a --dry-run option", "Can you add comments to it?"]) {
    const res = await c.sse("/api/chat", { conversation_id: code.id, text });
    const route = ev(res, "route");
    assert.equal(route.job, "code", text);
    assert.equal(route.model.id, codeModel, `${text}: one model per chat`);
    assert.equal(route.pinned, true, text);
    const said = res.events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
    assert.match(said, /Job:\*\* Code/, text);
    assert.match(said, /```python\n# .*\ndef rename_photos\(path: str\) -> None:/, `${text}: the updated code of the request it edits`);
  }
  // A plain question in the same chat stays a chat answer.
  const plain = await c.sse("/api/chat", { conversation_id: code.id, text: "Thanks! What does EXIF stand for?" });
  assert.equal(ev(plain, "route").job, "chat");

  const image = convs.find((x) => /cozy reading/i.test(x.title));
  const night = await c.sse("/api/chat", { conversation_id: image.id, text: "Make it at night instead" });
  assert.equal(ev(night, "route").job, "image");
  assert.equal(ev(night, "route").context_included, true, "the earlier request is folded into the prompt");
  assert.match(ev(night, "replace").text, /It would get: “An image of a cozy reading nook[^”]*Make it at night instead/);
  // A new picture too, with the prompt the live app's own rule builds (no "it": the sentence alone).
  const cat = await c.sse("/api/chat", { conversation_id: image.id, text: "Add a cat sleeping on the chair" });
  assert.equal(ev(cat, "route").job, "image");
  assert.equal(ev(cat, "media").type, "image");
  const song = await c.sse("/api/chat", { conversation_id: image.id, text: "Turn it into a song" });
  assert.equal(ev(song, "route").job, "music");
  // A follow-up in a chat chat is chat.
  assert.equal(followUpJob("Make it shorter", [{ role: "user", text: "Explain how compound interest works" }]), null);
});
