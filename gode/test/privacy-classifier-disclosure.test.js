// A message the local checks miss but the remote classifier calls private is answered on the
// self-hosted model. The classifier (a third party) read it first, with personal details removed,
// so the API says so (classifier_model / classified_outside on the route event and the stored
// request) and the badge does not claim that no outside AI provider got the request.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

globalThis.React = require(path.join(__dirname, "..", "public", "vendor", "react.production.min.js"));
const ui = require("../public/app.js");
const { createTestApp } = require("./helpers/app");
const { startMockUpstream } = require("./helpers/mock-upstream");

const PRIVATE_CHAT = { job: "chat", difficulty: 2, private: true, output: { length: "short", format: "text" }, title: "Feeling low" };
const TEXT = "I've been feeling really down and can't get out of bed most days, what should I do?";

let up;
let t;
before(async () => {
  up = await startMockUpstream();
  t = await createTestApp({ ...up.env, GODE_MOCK: "0", OPENROUTER_API_KEY: "sk-or-test", SELFHOSTED_BASE_URL: up.urls.selfhosted });
});
after(async () => {
  await t.close();
  await up.close();
});

test("route event and stored request name the outside classifier; the self-hosted badge discloses it", async () => {
  up.reset();
  up.setScenario({ chat: { content: PRIVATE_CHAT } });
  const c = t.client();
  await c.signup("badge@example.test");
  const r = await c.sse("/api/chat", { text: TEXT });
  const route = r.events.find((e) => e.event === "route").data;
  assert.equal(route.private, true);
  assert.equal(route.model.region, "self");
  assert.ok(route.classifier_model && route.classifier_model !== "heuristic", route.classifier_model);
  assert.equal(route.classified_outside, true);
  assert.ok(route.classifier_label);

  const live = ui.privacyBadgeFor(ui.requestFromRoute(route));
  assert.equal(live.kind, "self");
  assert.doesNotMatch(live.title, /no outside AI provider/);
  assert.ok(live.title.includes(`${route.classifier_label} read it first`), live.title);

  const conv = (await c.json("GET", `/api/conversations/${route.conversation_id}`)).body;
  const answer = conv.messages.find((m) => m.role === "assistant");
  assert.equal(answer.request.classifier_model, route.classifier_model);
  assert.equal(answer.request.classified_outside, true);
  const stored = ui.privacyBadgeFor(answer.request);
  assert.doesNotMatch(stored.title, /no outside AI provider/);
  assert.match(stored.title, /with your personal details removed/);

  // A regenerate reuses the decision (its own row names no classifier) but still discloses who read it.
  const regen = await c.sse(`/api/messages/${answer.id}/regenerate`, {});
  const regenRoute = regen.events.find((e) => e.event === "route").data;
  assert.equal(regenRoute.classified_outside, true);
  const after = (await c.json("GET", `/api/conversations/${route.conversation_id}`)).body;
  const replaced = after.messages.find((m) => m.role === "assistant");
  assert.equal(replaced.request.kind, "regenerate");
  assert.equal(replaced.request.classified_outside, true);
});

test("a later turn of the now-private conversation is classified locally: the badge says no outside provider got it", async () => {
  up.reset();
  up.setScenario({ chat: { content: PRIVATE_CHAT } });
  const c = t.client();
  await c.signup("badge2@example.test");
  const first = await c.sse("/api/chat", { text: TEXT });
  const conversationId = first.events.find((e) => e.event === "route").data.conversation_id;
  const second = await c.sse("/api/chat", { text: "Thanks. What else could help?", conversation_id: conversationId });
  const route = second.events.find((e) => e.event === "route").data;
  assert.equal(route.private, true);
  assert.equal(route.classified_outside, false, `classified by ${route.classifier_model}`);
  const badge = ui.privacyBadgeFor(ui.requestFromRoute(route));
  assert.match(badge.title, /no outside AI provider got the request/);
});

test("badge copy: heuristic or self-hosted classifiers keep the 'no outside provider' wording", () => {
  const base = { private: true, zdr: true, model_region: "self" };
  assert.match(ui.privacyBadgeFor({ ...base, classifier_model: "heuristic", classified_outside: false }).title, /no outside AI provider/);
  assert.match(ui.privacyBadgeFor({ ...base, classifier_model: "selfhosted:qwen3.8-27b", classified_outside: false }).title, /no outside AI provider/);
  assert.match(ui.privacyBadgeFor({ ...base, classifier_model: null }).title, /no outside AI provider/);
  const zdr = ui.privacyBadgeFor({ private: true, zdr: true, model_region: "us", classified_outside: true, classifier_label: "DeepSeek V4.1 Flash" });
  assert.match(zdr.title, /DeepSeek V4\.1 Flash read it first/);
});
