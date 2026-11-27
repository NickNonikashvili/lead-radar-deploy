"use strict";
// A self-hosted outage, end to end through the real registry and picker: after one failure to serve,
// private requests use PRIVATE_FALLBACK (a zero-retention model, or private_blocked) instead of
// failing with "selfhosted: network error" one after another, and the self-hosted model is tried
// again once SELFHOSTED_RETRY_MS has passed.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { openDb } = require("../src/db");
const { loadConfig } = require("../src/config");
const { seedCatalog } = require("../src/seed/catalog");
const { createProviders } = require("../src/providers");
const { createPicker } = require("../src/router/pick");

async function closedPortUrl() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}/v1`;
}

async function drain(gen) {
  try {
    for await (const ev of gen) void ev;
    return null;
  } catch (err) {
    return err;
  }
}

async function setup(env = {}) {
  const config = loadConfig({
    GODE_MOCK: "0",
    OPENROUTER_API_KEY: "sk-or-v1-test",
    SELFHOSTED_BASE_URL: await closedPortUrl(),
    SELFHOSTED_RETRY_MS: "200",
    ...env,
  });
  const db = openDb(":memory:");
  seedCatalog(db);
  const providers = createProviders(config);
  return { db, providers, picker: createPicker({ db, config, providers }) };
}

const privateChat = { job: "chat", difficulty: 2, private: true, user: {} };

describe("self-hosted outage -> PRIVATE_FALLBACK", () => {
  it("PRIVATE_FALLBACK=zdr: the next private request goes to a zero-retention model, then back", async () => {
    const { db, providers, picker } = await setup({ PRIVATE_FALLBACK: "zdr" });
    const first = picker.pick(privateChat);
    assert.equal(first.model.gateway, "selfhosted", "configured and not known to be down");
    assert.equal(first.tier, "private");

    // The server is not there: this request fails, and the gateway is marked down.
    const err = await drain(providers.get("selfhosted").streamChat({ model: first.model, messages: [{ role: "user", content: "hi" }] }));
    assert.equal(err?.message, "selfhosted: network error");

    const fallback = picker.pick(privateChat);
    assert.notEqual(fallback.model.gateway, "selfhosted");
    assert.equal(Boolean(fallback.model.zdr), true, "only a zero-retention model may take it");
    assert.equal(fallback.private, true);
    assert.match(fallback.reason, /no self-hosted model, using zero-retention model/);

    await new Promise((r) => setTimeout(r, 230));
    assert.equal(picker.pick(privateChat).model.gateway, "selfhosted", "tried again after SELFHOSTED_RETRY_MS");
    db.close();
  });

  it("PRIVATE_FALLBACK=block: private requests are refused with private_blocked during the outage", async () => {
    const { db, providers, picker } = await setup({ PRIVATE_FALLBACK: "block" });
    const first = picker.pick(privateChat);
    await drain(providers.get("selfhosted").streamChat({ model: first.model, messages: [{ role: "user", content: "hi" }] }));
    assert.throws(() => picker.pick(privateChat), { code: "private_blocked" });
    // Requests that are not private are unaffected.
    assert.notEqual(picker.pick({ job: "chat", difficulty: 2, user: {} }).model.gateway, "selfhosted");
    db.close();
  });
});
