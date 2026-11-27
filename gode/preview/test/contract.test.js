"use strict";
// Same scenario against the REAL server (test/helpers/app.js, mock mode) and against the preview:
// the JSON shapes, status codes, error bodies and SSE events must match, so the real frontend
// cannot tell them apart. Values that depend on the deployment differ on purpose (the preview has
// no self-hosted model; ids, times and costs differ), so the comparison is of keys and codes.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("../../test/helpers/app");
const { previewBackend, previewClient, keys } = require("./helpers");

const EMAIL = "contract@example.com";
const PASSWORD = "a long enough passphrase";

let real;
let realClient;
let preview;
let previewC;
// Admins: on the real server the scenario's account is the first one, so it is the admin; in the
// preview the demo account came first, so a second "browser" signs in as the demo for admin calls.
let realAdmin;
let previewAdmin;
// A signed-in account that is not an admin, on each side.
let realMember;
let previewMember;

before(async () => {
  real = await createTestApp({ ALLOW_DEV_TOPUP: "1" });
  realClient = real.client();
  realAdmin = realClient;
  preview = await previewBackend();
  previewC = previewClient(preview);
  previewMember = previewC;
  // The preview starts signed in as the demo account; the scenario uses a fresh account on both.
  await previewC.json("POST", "/api/auth/logout", {});
  previewAdmin = previewClient(preview.session());
  const login = await previewAdmin.json("POST", "/api/auth/login", { email: "demo@example.com", password: "preview-demo" });
  assert.equal(login.status, 200, "the demo account signs in");
  assert.equal(login.body.user.is_admin, true);
});

after(async () => {
  if (real) await real.close();
});

/** Run the same request on both; returns [realResult, previewResult]. */
async function both(method, path, body) {
  return Promise.all([realClient.json(method, path, body), previewC.json(method, path, body)]);
}

/**
 * The same JSON structure: the same keys at every level and the same type for every value both
 * sides have (null on either side matches anything: a nullable field can be empty in one dataset);
 * arrays compare their first elements when both have one.
 */
function sameShape(p, r, label) {
  const type = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
  if (p === null || r === null) return;
  assert.equal(type(p), type(r), `${label}: type`);
  if (Array.isArray(r)) {
    if (r.length && p.length) sameShape(p[0], r[0], `${label}[0]`);
    return;
  }
  if (type(r) !== "object") return;
  assert.deepEqual(keys(p), keys(r), `${label}: keys`);
  for (const k of Object.keys(r)) sameShape(p[k], r[k], `${label}.${k}`);
}

function sameError(r, p, label) {
  assert.equal(p.status, r.status, `${label}: status`);
  assert.deepEqual(keys(p.body), keys(r.body), `${label}: error body keys`);
  assert.equal(p.body.code, r.body.code, `${label}: code`);
  assert.equal(p.body.error, r.body.error, `${label}: message`);
}

test("signed out: /api/me is a 401 with the same body; unknown /api paths are JSON 404s", async () => {
  const [r, p] = await both("GET", "/api/me");
  sameError(r, p, "GET /api/me signed out");
  const [r2, p2] = await both("GET", "/api/nope");
  sameError(r2, p2, "unknown path");
  assert.equal(p2.headers.get("cache-control"), "no-store");
});

test("sign-up rules and messages are the real ones", async () => {
  for (const body of [
    { email: "not-an-email", password: PASSWORD },
    { email: EMAIL, password: "short" },
    { email: EMAIL, password: "password123" },
    { email: EMAIL, password: "aaaaaaaaaa" },
    { email: EMAIL },
    { email: EMAIL, password: PASSWORD, extra: 1 },
  ]) {
    const [r, p] = await both("POST", "/api/auth/signup", body);
    sameError(r, p, `signup ${JSON.stringify(body)}`);
  }
  const [r, p] = await both("POST", "/api/auth/signup", { email: EMAIL, password: PASSWORD });
  assert.equal(r.status, 201);
  assert.equal(p.status, 201);
  assert.deepEqual(keys(p.body), keys(r.body));
  assert.deepEqual(keys(p.body.user), keys(r.body.user));
  assert.equal(p.body.signup_bonus_usd, r.body.signup_bonus_usd);
  assert.equal(p.body.user.balance_usd, 0.25);
  assert.equal(p.body.user.is_admin, false, "the demo account is the preview's first user, so not admin");
  const [r2, p2] = await both("POST", "/api/auth/signup", { email: EMAIL.toUpperCase(), password: PASSWORD });
  sameError(r2, p2, "signup taken");
});

test("/api/me: same user and config keys; settings validation is the real one", async () => {
  const [r, p] = await both("GET", "/api/me");
  assert.equal(p.status, 200);
  assert.deepEqual(keys(p.body.user), keys(r.body.user));
  assert.deepEqual(keys(p.body.config), keys(r.body.config));
  assert.equal(p.body.config.mock, true);
  assert.equal(p.body.config.selfhosted, false, "the preview simulates a deployment without a self-hosted model");
  for (const body of [{ plan: "gold" }, { strict_privacy: "yes" }, {}, { nope: 1 }]) {
    const [r2, p2] = await both("PATCH", "/api/me", body);
    sameError(r2, p2, `PATCH /api/me ${JSON.stringify(body)}`);
  }
  const [r3, p3] = await both("PATCH", "/api/me", { plan: "saver", share_prompts: true });
  assert.equal(p3.status, 200);
  assert.deepEqual(keys(p3.body.user), keys(r3.body.user));
  assert.equal(p3.body.user.plan, "saver");
  await both("PATCH", "/api/me", { plan: "balanced", share_prompts: false });
});

test("chat: same pre-stream errors, same SSE events and payload keys", async () => {
  for (const body of [{}, { text: "   " }, { text: 5 }, { text: "hi", conversation_id: "00000000-0000-4000-8000-000000000000" }, { text: "hi", nope: 1 }]) {
    const [r, p] = await Promise.all([realClient.sse("/api/chat", body), previewC.sse("/api/chat", body)]);
    assert.equal(p.status, r.status, `chat ${JSON.stringify(body)} status`);
    assert.deepEqual(p.body, r.body, `chat ${JSON.stringify(body)} body`);
  }
  const text = "My name is Ada Example and my email is ada@example.org. Write a short thank-you note to my landlord.";
  const [r, p] = await Promise.all([realClient.sse("/api/chat", { text }), previewC.sse("/api/chat", { text })]);
  assert.equal(p.headers.get("content-type"), r.headers.get("content-type"));
  const names = (x) => [...new Set(x.events.map((e) => e.event))];
  assert.deepEqual(names(p), names(r), "event kinds");
  const ev = (x, name) => x.events.find((e) => e.event === name).data;
  assert.deepEqual(keys(ev(p, "route")), keys(ev(r, "route")), "route keys");
  assert.deepEqual(keys(ev(p, "route").model), keys(ev(r, "route").model));
  assert.deepEqual(keys(ev(p, "done")), keys(ev(r, "done")), "done keys");
  assert.deepEqual(ev(p, "route").redactions, ev(r, "route").redactions, "same personal details found");
  const shown = p.events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
  assert.ok(!/\[(PERSON|EMAIL)_\d\]/.test(shown), "no placeholder reaches the screen");
  assert.ok(p.events.filter((e) => e.event === "delta").length >= 10, "streamed in pieces");
  assert.match(ev(p, "done").chip, /^DeepSeek V4\.1 Flash · low effort · /);
});

test("conversations: list, read, rename and delete have the real shapes and errors", async () => {
  const [r, p] = await both("GET", "/api/conversations");
  assert.deepEqual(keys(p.body), keys(r.body));
  assert.deepEqual(keys(p.body.conversations[0]), keys(r.body.conversations[0]));
  const rid = r.body.conversations[0].id;
  const pid = p.body.conversations[0].id;
  const [rc, pc] = await Promise.all([realClient.json("GET", `/api/conversations/${rid}`), previewC.json("GET", `/api/conversations/${pid}`)]);
  assert.deepEqual(keys(pc.body), keys(rc.body));
  assert.deepEqual(keys(pc.body.conversation), keys(rc.body.conversation));
  assert.equal(pc.body.messages.length, rc.body.messages.length);
  for (let i = 0; i < rc.body.messages.length; i++) {
    assert.deepEqual(keys(pc.body.messages[i]), keys(rc.body.messages[i]), `message ${i} keys`);
    if (rc.body.messages[i].request) assert.deepEqual(keys(pc.body.messages[i].request), keys(rc.body.messages[i].request), `request ${i} keys`);
  }
  assert.equal(pc.body.messages[1].request.chip.startsWith("DeepSeek V4.1 Flash"), true);
  for (const [method, suffix, body] of [
    ["GET", "/00000000-0000-4000-8000-000000000000"],
    ["PATCH", "/00000000-0000-4000-8000-000000000000", { title: "x" }],
    ["DELETE", "/00000000-0000-4000-8000-000000000000"],
    ["GET", "/%E0%A4%A"],
  ]) {
    const [r2, p2] = await both(method, `/api/conversations${suffix}`, body);
    sameError(r2, p2, `${method} conversations${suffix}`);
  }
  const [r3, p3] = await Promise.all([realClient.json("PATCH", `/api/conversations/${rid}`, {}), previewC.json("PATCH", `/api/conversations/${pid}`, {})]);
  sameError(r3, p3, "rename without a title");
  const [r4, p4] = await both("POST", "/api/conversations", { title: "Planning" });
  assert.equal(p4.status, 201);
  assert.deepEqual(keys(p4.body.conversation), keys(r4.body.conversation));
});

test("models menu, feedback, regenerate and switch: same shapes and errors", async () => {
  const [r, p] = await both("GET", "/api/models?job=chat");
  assert.deepEqual(keys(p.body), keys(r.body));
  assert.deepEqual(keys(p.body.models[0]), keys(r.body.models[0]));
  const [r2, p2] = await both("GET", "/api/models?job=painting");
  sameError(r2, p2, "unknown job");

  const lastAnswer = async (client) => {
    const list = await client.json("GET", "/api/conversations");
    for (const c of list.body.conversations) {
      const conv = await client.json("GET", `/api/conversations/${c.id}`);
      const answer = conv.body.messages.filter((m) => m.role === "assistant" && m.request).pop();
      if (answer) return answer;
    }
    throw new Error("no answer to act on");
  };
  const [ra, pa] = await Promise.all([lastAnswer(realClient), lastAnswer(previewC)]);
  for (const body of [{ value: 2 }, { value: "1" }, {}]) {
    const [r3, p3] = await Promise.all([realClient.json("POST", `/api/messages/${ra.id}/feedback`, body), previewC.json("POST", `/api/messages/${pa.id}/feedback`, body)]);
    sameError(r3, p3, `feedback ${JSON.stringify(body)}`);
  }
  const [r4, p4] = await Promise.all([realClient.json("POST", `/api/messages/${ra.id}/feedback`, { value: 1 }), previewC.json("POST", `/api/messages/${pa.id}/feedback`, { value: 1 })]);
  assert.deepEqual(p4.body, r4.body);

  const [rs, ps] = await Promise.all([
    realClient.sse(`/api/messages/${ra.id}/switch`, { model_id: "openrouter:anthropic/claude-sonnet-5.5" }),
    previewC.sse(`/api/messages/${pa.id}/switch`, { model_id: "openrouter:anthropic/claude-sonnet-5.5" }),
  ]);
  const ev = (x, name) => (x.events.find((e) => e.event === name) || {}).data;
  assert.deepEqual(keys(ev(ps, "route")), keys(ev(rs, "route")), "switch route keys");
  assert.match(ev(ps, "done").chip, /^Claude Sonnet 5\.5 · /);
  // Regenerating the current (switched) answer: the same events as a new answer.
  const [rg, pg] = await Promise.all([
    realClient.sse(`/api/messages/${ev(rs, "done").message_id}/regenerate`, {}),
    previewC.sse(`/api/messages/${ev(ps, "done").message_id}/regenerate`, {}),
  ]);
  assert.deepEqual([...new Set(pg.events.map((e) => e.event))], [...new Set(rg.events.map((e) => e.event))], "regenerate events");
  assert.deepEqual(keys(ev(pg, "route")), keys(ev(rg, "route")), "regenerate route keys");
  assert.deepEqual(keys(ev(pg, "done")), keys(ev(rg, "done")), "regenerate done keys");
  assert.equal(ev(pg, "route").model.id, "openrouter:anthropic/claude-sonnet-5.5", "regenerate keeps the switched model");
  const [r5, p5] = await Promise.all([
    realClient.sse(`/api/messages/${ra.id}/regenerate`, {}),
    previewC.sse(`/api/messages/${pa.id}/regenerate`, {}),
  ]);
  assert.equal(p5.status, r5.status, "regenerating a replaced answer");
  assert.deepEqual(p5.body, r5.body);
  for (const [path, body] of [
    ["/api/messages/00000000-0000-4000-8000-000000000000/regenerate", {}],
    ["/api/messages/00000000-0000-4000-8000-000000000000/switch", { model_id: "openrouter:anthropic/claude-sonnet-5.5" }],
  ]) {
    const [r6, p6] = await Promise.all([realClient.sse(path, body), previewC.sse(path, body)]);
    assert.equal(p6.status, r6.status, path);
    assert.deepEqual(p6.body, r6.body, path);
  }
  const [r7, p7] = await Promise.all([realClient.sse(`/api/messages/${ra.id}/switch`, { model_id: "nope:model" }), previewC.sse(`/api/messages/${pa.id}/switch`, { model_id: "nope:model" })]);
  assert.deepEqual(p7.body, r7.body, "switch to an unknown model");
});

test("media: the same route, progress, media and done payloads", async () => {
  const text = "Make an image of a red bicycle leaning on a wall";
  const [r, p] = await Promise.all([realClient.sse("/api/chat", { text }), previewC.sse("/api/chat", { text })]);
  const names = (x) => [...new Set(x.events.map((e) => e.event))];
  // The preview also sends the caption as a `replace` before `done` (preview/README.md).
  assert.deepEqual(names(p).filter((n) => n !== "replace"), names(r), "event kinds");
  for (const name of ["route", "media", "done"]) {
    const a = p.events.find((e) => e.event === name).data;
    const b = r.events.find((e) => e.event === name).data;
    sameShape(a, b, `${name} event`);
  }
  const pp = p.events.filter((e) => e.event === "progress").map((e) => e.data);
  const rp = r.events.filter((e) => e.event === "progress").map((e) => e.data);
  assert.deepEqual([...new Set(pp.map((x) => x.status))], [...new Set(rp.map((x) => x.status))], "progress statuses");
  assert.ok(pp.every((x) => keys(x).every((k) => ["status", "position"].includes(k))));
  assert.match(p.events.find((e) => e.event === "media").data.url, /^data:image\/svg\+xml/);
});

test("transparency log and the public providers list have the real shapes", async () => {
  const [r, p] = await both("GET", "/api/transparency?limit=2");
  assert.deepEqual(keys(p.body), keys(r.body));
  assert.deepEqual(keys(p.body.requests[0]), keys(r.body.requests[0]));
  assert.equal(p.body.has_more, r.body.has_more);
  if (p.body.next_before) {
    const page2 = await previewC.json("GET", `/api/transparency?limit=2&before=${p.body.next_before}`);
    assert.equal(page2.status, 200);
    assert.ok(page2.body.requests.every((x) => !p.body.requests.some((y) => y.id === x.id)), "keyset paging moves on");
  }
  const [r2, p2] = await both("GET", "/api/transparency?before=nope");
  sameError(r2, p2, "unknown cursor");
  const [r3, p3] = await both("GET", "/api/public/providers");
  assert.deepEqual(keys(p3.body), keys(r3.body));
  assert.deepEqual(keys(p3.body.models[0]), keys(r3.body.models[0]));
  assert.equal(p3.body.selfhosted, false);
  assert.ok(!p3.body.models.some((m) => m.gateway === "selfhosted"), "no self-hosted model is offered");
  assert.equal(p3.body.classifier.label, r3.body.classifier.label);
});

test("billing: the ledger, credit packs and test credit follow the real rules", async () => {
  const [r, p] = await both("GET", "/api/billing/ledger");
  assert.equal(p.status, 200);
  sameShape(p.body, r.body, "ledger");
  assert.equal(typeof p.body.held_usd, "number", "held_usd");
  assert.ok(p.body.entries.length >= 1 && p.body.entries.every((e) => e.kind !== "hold" && e.kind !== "release"), "a statement by default");
  const [ra, pa] = await both("GET", "/api/billing/ledger?all=1&limit=500");
  sameShape(pa.body, ra.body, "ledger?all=1");
  for (const q of ["?limit=0", "?limit=501", "?limit=abc", "?all=maybe"]) {
    const [r2, p2] = await both("GET", `/api/billing/ledger${q}`);
    sameError(r2, p2, `ledger${q}`);
  }
  for (const body of [{}, { pack_usd: 7 }, { pack_usd: "10" }, { pack_usd: 10, coupon: "x" }]) {
    const [r3, p3] = await both("POST", "/api/billing/checkout", body);
    sameError(r3, p3, `checkout ${JSON.stringify(body)}`);
  }
  // A valid pack: the real server without Stripe keys and the preview both refuse with
  // 503 gateway_not_configured (no URL, so the page never navigates); the preview says why.
  const [r4, p4] = await both("POST", "/api/billing/checkout", { pack_usd: 10 });
  assert.equal(r4.status, 503);
  assert.equal(p4.status, r4.status);
  assert.equal(p4.body.code, r4.body.code);
  assert.deepEqual(keys(p4.body), keys(r4.body));
  assert.match(p4.body.error, /preview/i);
  assert.match(p4.body.error, /top-up/i);
  for (const body of [{}, { usd: 0 }, { usd: -1 }, { usd: 101 }, { usd: "5" }, { usd: 1e-7 }, { usd: 5, note: "x" }]) {
    const [r5, p5] = await both("POST", "/api/billing/dev-topup", body);
    sameError(r5, p5, `dev-topup ${JSON.stringify(body)}`);
  }
  const [rb, pb] = await both("GET", "/api/me");
  const [r6, p6] = await both("POST", "/api/billing/dev-topup", { usd: 2.5 });
  assert.equal(p6.status, 200);
  sameShape(p6.body, r6.body, "dev-topup");
  assert.equal(Math.round((p6.body.balance_usd - pb.body.user.balance_usd) * 1e6), 2_500_000);
  assert.equal(Math.round((r6.body.balance_usd - rb.body.user.balance_usd) * 1e6), 2_500_000);
  const [r7, p7] = await both("GET", "/api/billing/ledger?limit=1");
  assert.equal(p7.body.entries[0].kind, r7.body.entries[0].kind);
  assert.equal(p7.body.entries[0].kind, "dev_topup");
  // Signed out: the real 401.
  const [r8, p8] = await Promise.all([real.client().json("GET", "/api/billing/ledger"), previewClient(preview.session()).json("GET", "/api/billing/ledger")]);
  sameError(r8, p8, "ledger signed out");
});

test("out of credit: the same SSE error, then test credit gets the account going again", async () => {
  const [rme, pme] = await both("GET", "/api/me");
  // Take the balance to $0 with an admin credit adjustment (never below zero).
  const [r0, p0] = await Promise.all([
    realAdmin.json("POST", `/api/admin/users/${rme.body.user.id}/credit`, { usd: -10_000, note: "contract test" }),
    previewAdmin.json("POST", `/api/admin/users/${pme.body.user.id}/credit`, { usd: -10_000, note: "contract test" }),
  ]);
  // The same shape; applied_usd is what was taken back (each account's own balance).
  assert.deepEqual(keys(p0.body), keys(r0.body));
  assert.equal(p0.body.balance_usd, 0);
  assert.equal(r0.body.balance_usd, 0);
  assert.ok(p0.body.applied_usd < 0 && r0.body.applied_usd < 0, "the whole balance was taken back");
  assert.ok(p0.body.applied_usd > -10_000 && r0.body.applied_usd > -10_000, "not the amount asked for");
  for (const text of ["What is a good name for a goldfish?", "Make an image of a lighthouse at dawn"]) {
    const [r, p] = await Promise.all([realClient.sse("/api/chat", { text }), previewC.sse("/api/chat", { text })]);
    assert.equal(p.status, r.status, `${text}: status`);
    assert.deepEqual(p.events.map((e) => e.event), r.events.map((e) => e.event), `${text}: events`);
    const pe = p.events.find((e) => e.event === "error").data;
    const re = r.events.find((e) => e.event === "error").data;
    assert.deepEqual(keys(pe), keys(re), `${text}: error keys`);
    assert.equal(pe.code, "insufficient_credits");
    assert.equal(pe.code, re.code);
    assert.equal(pe.error, re.error, `${text}: message`);
  }
  const [r1, p1] = await both("POST", "/api/billing/dev-topup", { usd: 5 });
  assert.equal(p1.body.balance_usd, 5);
  assert.equal(r1.body.balance_usd, 5);
});

test("admin: who may call it, the overview and the routing table", async () => {
  const anon = [real.client(), previewClient(preview.session())];
  realMember = real.client();
  await realMember.signup("member@example.com", "another long passphrase");
  for (const path of ["/api/admin/stats", "/api/admin/routing", "/api/admin/users", "/api/admin/learn/runs", "/api/admin/catalog/export", "/api/admin/nope"]) {
    const [r, p] = await Promise.all([anon[0].json("GET", path), anon[1].json("GET", path)]);
    sameError(r, p, `${path} signed out`);
    const [r2, p2] = await Promise.all([realMember.json("GET", path), previewMember.json("GET", path)]);
    sameError(r2, p2, `${path} not an admin`);
  }
  const admin = (method, path, body) => Promise.all([realAdmin.json(method, path, body), previewAdmin.json(method, path, body)]);
  for (const q of ["?days=0", "?days=366", "?days=abc", "?days=7&days=8"]) {
    const [r, p] = await admin("GET", `/api/admin/stats${q}`);
    sameError(r, p, `stats${q}`);
  }
  const [r, p] = await admin("GET", "/api/admin/stats?days=28");
  assert.equal(p.status, 200);
  sameShape(p.body, r.body, "stats");
  assert.deepEqual(keys(p.body.gate), keys(r.body.gate), "gate metric keys");
  assert.ok(p.body.models.length && r.body.models.length && p.body.cells.length, "per-model and per-cell rows");
  assert.equal(p.body.presidio.state, "off", "no Presidio in the preview, as on the test server");

  const [rr, pr] = await admin("GET", "/api/admin/routing");
  sameShape(pr.body, rr.body, "routing");
  assert.equal(pr.body.models.length, rr.body.models.length, "the same catalog");
  assert.deepEqual(
    pr.body.routes.map((x) => [x.job, x.tier, x.model_id, x.effort_override]),
    rr.body.routes.map((x) => [x.job, x.tier, x.model_id, x.effort_override]),
    "the same seeded routing table, in the same order"
  );
  assert.equal(pr.body.classifier_model_id, "openrouter:deepseek/deepseek-v4.1-flash");
});

test("admin: route edits have the real validation, including the private cells", async () => {
  const admin = (method, path, body) => Promise.all([realAdmin.json(method, path, body), previewAdmin.json(method, path, body)]);
  const HAIKU = "openrouter:anthropic/claude-haiku-5.5";
  for (const [path, body] of [
    ["/api/admin/routes/painting/budget", { model_id: HAIKU }],
    ["/api/admin/routes/chat/premium", { model_id: HAIKU }],
    ["/api/admin/routes/action/budget", { model_id: HAIKU }],
    ["/api/admin/routes/chat/private", { model_id: "openrouter:google/gemini-4-carbon" }],
    ["/api/admin/routes/code/private", { model_id: "openai:gpt-6.2-astra" }],
    ["/api/admin/routes/chat/budget", { model_id: "fal:google/lyria-3.5" }],
    ["/api/admin/routes/chat/budget", { model_id: "nope:model" }],
    ["/api/admin/routes/chat/budget", {}],
    ["/api/admin/routes/chat/budget", { model_id: HAIKU, effort_override: "max" }],
    ["/api/admin/routes/chat/budget", { model_id: HAIKU, effort_override: "extreme" }],
    ["/api/admin/routes/chat/budget", { model_id: HAIKU, extra: true }],
  ]) {
    const [r, p] = await admin("PUT", path, body);
    sameError(r, p, `PUT ${path} ${JSON.stringify(body)}`);
  }
  const [r, p] = await admin("PUT", "/api/admin/routes/chat/budget", { model_id: HAIKU, effort_override: "low" });
  assert.deepEqual(p.body, { ok: true });
  assert.deepEqual(p.body, r.body);
  const cell = (body) => body.routes.find((x) => x.job === "chat" && x.tier === "budget");
  const [rr, pr] = await admin("GET", "/api/admin/routing");
  assert.deepEqual([cell(pr.body).model_id, cell(pr.body).effort_override, cell(pr.body).source], [HAIKU, "low", "admin"]);
  assert.deepEqual([cell(rr.body).model_id, cell(rr.body).effort_override, cell(rr.body).source], [HAIKU, "low", "admin"]);
  // Omitting effort_override keeps the cell's; null clears it.
  await admin("PUT", "/api/admin/routes/chat/budget", { model_id: "openrouter:deepseek/deepseek-v4.1-flash" });
  const [, pr2] = await admin("GET", "/api/admin/routing");
  assert.equal(cell(pr2.body).effort_override, "low");
  await admin("PUT", "/api/admin/routes/chat/budget", { model_id: "openrouter:deepseek/deepseek-v4.1-flash", effort_override: null });

  // A model in a private text cell must stay zero-retention (or self-hosted).
  const FLASH = "openrouter:deepseek/deepseek-v4.1-flash";
  const enc = encodeURIComponent(FLASH);
  await admin("PUT", "/api/admin/routes/chat/private", { model_id: FLASH });
  const [r3, p3] = await admin("PUT", `/api/admin/models/${enc}`, { zdr: false });
  sameError(r3, p3, "unflag the private pick");
  await admin("PUT", "/api/admin/routes/chat/private", { model_id: "selfhosted:qwen3.8-27b" });
});

test("admin: model edits and new models use validateModel's rules", async () => {
  const admin = (method, path, body) => Promise.all([realAdmin.json(method, path, body), previewAdmin.json(method, path, body)]);
  const HAIKU = encodeURIComponent("openrouter:anthropic/claude-haiku-5.5");
  for (const [path, body] of [
    [`/api/admin/models/${encodeURIComponent("nope:model")}`, { price_in: 1 }],
    [`/api/admin/models/${HAIKU}`, {}],
    [`/api/admin/models/${HAIKU}`, { slug: "anthropic/other" }],
    [`/api/admin/models/${HAIKU}`, { price_in: -1 }],
    [`/api/admin/models/${HAIKU}`, { zdr: "yes" }],
    [`/api/admin/models/${HAIKU}`, { jobs: ["painting"] }],
    [`/api/admin/models/${HAIKU}`, { price_unit: "litre" }],
    [`/api/admin/models/${HAIKU}`, { secret: 1 }],
    [`/api/admin/models/${encodeURIComponent("fal:fal-ai/flux/schnell")}`, { zdr: true }],
    [`/api/admin/models/${encodeURIComponent("openai:gpt-6.2-astra")}`, { zdr: true }],
  ]) {
    const [r, p] = await admin("PUT", path, body);
    sameError(r, p, `PUT ${decodeURIComponent(path)} ${JSON.stringify(body)}`);
  }
  const [r, p] = await admin("PUT", `/api/admin/models/${HAIKU}`, { price_in: 1.25, enabled: true });
  assert.deepEqual(p.body, { ok: true });
  assert.deepEqual(p.body, r.body);
  const fresh = { id: "openrouter:acme/tiny-1", gateway: "openrouter", slug: "acme/tiny-1", label: "Acme Tiny 1", vendor: "Acme", jobs: ["chat"], price_in: 0.1, price_out: 0.2 };
  for (const body of [{ ...fresh, label: undefined }, { ...fresh, gateway: "nowhere" }, { ...fresh, id: "openrouter:acme/other" }, { ...fresh, jobs: [] }, { ...fresh, self_hosted: true }]) {
    const [r2, p2] = await admin("POST", "/api/admin/models", JSON.parse(JSON.stringify(body)));
    sameError(r2, p2, `POST model ${JSON.stringify(body).slice(0, 80)}`);
  }
  const [r3, p3] = await admin("POST", "/api/admin/models", fresh);
  assert.equal(p3.status, 201);
  assert.deepEqual(p3.body, r3.body);
  const [r4, p4] = await admin("POST", "/api/admin/models", fresh);
  sameError(r4, p4, "duplicate model");
  const [, pr] = await admin("GET", "/api/admin/routing");
  const added = pr.body.models.find((m) => m.id === fresh.id);
  assert.equal(added.label, "Acme Tiny 1");
  assert.equal(added.enabled, true);
});

test("admin: catalog export and import round-trip with the real checks", async () => {
  const admin = (method, path, body) => Promise.all([realAdmin.json(method, path, body), previewAdmin.json(method, path, body)]);
  const [r, p] = await admin("GET", "/api/admin/catalog/export");
  assert.equal(p.status, 200);
  sameShape(p.body, r.body, "export");
  assert.equal(p.headers.get("content-disposition"), r.headers.get("content-disposition"));
  assert.equal(p.body.models.length, r.body.models.length);
  assert.equal(p.body.routes.length, r.body.routes.length);
  for (const body of [
    { models: "x" },
    { models: [{ id: "x" }] },
    { routes: [{ job: "chat", tier: "private", model_id: "openrouter:google/gemini-4-carbon" }] },
    { routes: [{ job: "chat", tier: "budget", model_id: "nope:model" }] },
    { routes: [{ job: "chat", tier: "budget", model_id: "openrouter:deepseek/deepseek-v4.1-flash", effort_override: "max" }] },
    { models: [], routes: [], extra: 1 },
  ]) {
    const [r2, p2] = await admin("POST", "/api/admin/catalog/import", body);
    sameError(r2, p2, `import ${JSON.stringify(body).slice(0, 80)}`);
  }
  // Importing the export back changes nothing and reports what it wrote.
  const [r3, p3] = await Promise.all([
    realAdmin.json("POST", "/api/admin/catalog/import", r.body),
    previewAdmin.json("POST", "/api/admin/catalog/import", p.body),
  ]);
  assert.equal(p3.status, 200);
  assert.deepEqual(keys(p3.body), keys(r3.body));
  assert.deepEqual(p3.body, { ok: true, models: p.body.models.length, routes: p.body.routes.length });
  const [, pr] = await admin("GET", "/api/admin/catalog/export");
  assert.deepEqual(
    pr.body.routes.map((x) => [x.job, x.tier, x.model_id]),
    p.body.routes.map((x) => [x.job, x.tier, x.model_id]),
    "the round trip keeps the table"
  );
});

test("admin: the user list and credit adjustments", async () => {
  const admin = (method, path, body) => Promise.all([realAdmin.json(method, path, body), previewAdmin.json(method, path, body)]);
  const [r, p] = await admin("GET", "/api/admin/users");
  assert.equal(p.status, 200);
  sameShape(p.body, r.body, "users");
  const [r1, p1] = await admin("GET", `/api/admin/users?email=${encodeURIComponent("CONTRACT@")}`);
  assert.deepEqual(p1.body.users.map((u) => u.email), [EMAIL]);
  assert.deepEqual(r1.body.users.map((u) => u.email), [EMAIL]);
  const [r1b, p1b] = await admin("GET", "/api/admin/users?email=%25_%25");
  assert.ok(Array.isArray(p1b.body.users) && Array.isArray(r1b.body.users), "LIKE wildcards in the term are literal");
  assert.equal(p1b.body.users.length, r1b.body.users.length, "neither has an address with %_ in it");
  const [r2, p2] = await admin("GET", "/api/admin/users?email=a&email=b");
  sameError(r2, p2, "two email terms");
  const rid = r1.body.users[0].id;
  const pid = p1.body.users[0].id;
  const credit = (body, [ri, pi] = [rid, pid]) =>
    Promise.all([realAdmin.json("POST", `/api/admin/users/${ri}/credit`, body), previewAdmin.json("POST", `/api/admin/users/${pi}/credit`, body)]);
  for (const body of [{}, { usd: 0 }, { usd: 10_001 }, { usd: "5" }, { usd: 1, note: "x".repeat(201) }, { usd: 1, extra: 1 }]) {
    const [r3, p3] = await credit(body);
    sameError(r3, p3, `credit ${JSON.stringify(body).slice(0, 60)}`);
  }
  const [r4, p4] = await credit({ usd: 1 }, ["00000000-0000-4000-8000-000000000000", "00000000-0000-4000-8000-000000000000"]);
  sameError(r4, p4, "credit for an unknown user");
  const [r5, p5] = await credit({ usd: 1.5, note: "goodwill" });
  assert.deepEqual(keys(p5.body), keys(r5.body));
  const [r6, p6] = await both("GET", "/api/billing/ledger?limit=1");
  assert.equal(p6.body.entries[0].kind, "admin_adjust");
  assert.equal(p6.body.entries[0].kind, r6.body.entries[0].kind);
  assert.equal(p6.body.entries[0].delta_usd, r6.body.entries[0].delta_usd);
});

test("admin: the learner proposes, stores runs and applies exactly a reviewed run", async () => {
  const admin = (method, path, body) => Promise.all([realAdmin.json(method, path, body), previewAdmin.json(method, path, body)]);
  for (const body of [{ run_id: 1 }, { apply: true, run_id: 1, proposals: [] }, { apply: "yes" }, { days: 0 }, { min_samples: 0 }, { nope: 1 }, { apply: true, run_id: 999_999 }]) {
    const [r, p] = await admin("POST", "/api/admin/learn", body);
    sameError(r, p, `learn ${JSON.stringify(body)}`);
  }
  const bad = { job: "chat", tier: "private", current_model_id: "selfhosted:qwen3.8-27b", proposed_model_id: "openrouter:google/gemini-4-carbon" };
  const [rb, pb] = await admin("POST", "/api/admin/learn", { apply: true, proposals: [bad] });
  sameError(rb, pb, "a proposal for the private cell");
  const [r, p] = await admin("POST", "/api/admin/learn", {});
  assert.equal(p.status, 200);
  assert.deepEqual(keys(p.body), keys(r.body));
  assert.equal(typeof p.body.run_id, "number");
  // The preview's seeded team history has two changes worth proposing; the empty test server none.
  assert.deepEqual(
    p.body.proposals.map((x) => `${x.job}/${x.tier} -> ${x.proposed_model_id}`),
    ["chat/quality -> openrouter:anthropic/claude-opus-5.5", "code/budget -> openrouter:deepseek/deepseek-v4.1-flash"]
  );
  assert.deepEqual(keys(p.body.proposals[0]), ["current_model_id", "current_n", "current_requests", "current_score", "job", "proposed_model_id", "proposed_n", "proposed_requests", "proposed_score", "reason", "summary", "tier"]);
  const [ra, pa] = await Promise.all([
    realAdmin.json("POST", "/api/admin/learn", { apply: true, run_id: r.body.run_id }),
    previewAdmin.json("POST", "/api/admin/learn", { apply: true, run_id: p.body.run_id }),
  ]);
  assert.deepEqual(keys(pa.body), keys(ra.body));
  assert.equal(pa.body.applied, 2);
  assert.equal(pa.body.run_id, p.body.run_id);
  const [rr, pr] = await admin("GET", "/api/admin/learn/runs?limit=5");
  sameShape(pr.body, rr.body, "learn runs");
  assert.equal(pr.body.runs[0].applied, 2);
  const [rl, pl] = await admin("GET", "/api/admin/learn/runs?limit=0");
  sameError(rl, pl, "runs?limit=0");
  const [rs, ps] = await admin("GET", "/api/admin/stats");
  sameShape(ps.body.last_learn_run, rs.body.last_learn_run, "last learner run");
  assert.equal(ps.body.last_learn_run.applied, 2);
  const [, routing] = await admin("GET", "/api/admin/routing");
  const cell = routing.body.routes.find((x) => x.job === "code" && x.tier === "budget");
  assert.deepEqual([cell.model_id, cell.source], ["openrouter:deepseek/deepseek-v4.1-flash", "learn"]);
});

test("password change and delete everything: same confirmations and messages", async () => {
  for (const body of [{ current: "wrong password!", next: "another passphrase" }, { current: PASSWORD, next: "password123" }, { current: PASSWORD, next: PASSWORD }, { current: PASSWORD }]) {
    const [r, p] = await both("POST", "/api/me/password", body);
    sameError(r, p, `password ${JSON.stringify({ ...body, current: "…" })}`);
  }
  const [r, p] = await both("POST", "/api/me/password", { current: PASSWORD, next: "another long passphrase" });
  assert.equal(p.status, 200);
  assert.deepEqual(keys(p.body), keys(r.body));
  for (const body of [{ password: "wrong password!" }, {}]) {
    const [r2, p2] = await both("DELETE", "/api/me", body);
    sameError(r2, p2, `delete ${JSON.stringify(body)}`);
  }
  const [r3, p3] = await both("DELETE", "/api/me", { password: "another long passphrase" });
  assert.equal(p3.status, 200);
  assert.deepEqual(p3.body, r3.body);
  const [r4, p4] = await both("GET", "/api/me");
  sameError(r4, p4, "after delete everything");
  const [r5, p5] = await both("POST", "/api/auth/login", { email: EMAIL, password: "another long passphrase" });
  sameError(r5, p5, "log in to a deleted account");
});
