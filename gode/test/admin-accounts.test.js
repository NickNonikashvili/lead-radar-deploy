// Admin: user search, credit adjustments, the action-route guard and catalog validation options.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/app");

const PASSWORD = "correct-horse-battery";

describe("admin accounts and catalog guards", () => {
  let t;
  let admin;
  let alice;
  let aliceUser;

  before(async () => {
    t = await createTestApp({ ADMIN_EMAILS: "root@example.test" });
    admin = t.client();
    await admin.signup("root@example.test", PASSWORD);
    alice = t.client();
    aliceUser = await alice.signup("alice_100%@example.test", PASSWORD);
    await t.client().signup("bob@example.test", PASSWORD);
  });
  after(() => t.close());

  const balance = (id) => t.deps.db.prepare("SELECT balance_micros FROM users WHERE id = ?").get(id).balance_micros;
  const ledgerSum = (id) => t.deps.db.prepare("SELECT COALESCE(SUM(delta_micros), 0) AS s FROM ledger WHERE user_id = ?").get(id).s;

  test("GET /api/admin/users finds users by part of their email, without secrets", async () => {
    const all = await admin.json("GET", "/api/admin/users");
    assert.equal(all.status, 200);
    assert.equal(all.body.users.length, 3);
    const found = await admin.json("GET", `/api/admin/users?email=${encodeURIComponent("ALICE")}`);
    assert.deepEqual(found.body.users.map((u) => u.email), ["alice_100%@example.test"]);
    const u = found.body.users[0];
    assert.deepEqual(Object.keys(u).sort(), ["balance_usd", "created_at", "email", "id", "is_admin"]);
    assert.equal(u.id, aliceUser.id);
    assert.equal(u.is_admin, false);
    assert.equal(typeof u.balance_usd, "number");
    // LIKE wildcards in the search are literal characters.
    assert.deepEqual((await admin.json("GET", `/api/admin/users?email=${encodeURIComponent("_100%")}`)).body.users.length, 1);
    assert.deepEqual((await admin.json("GET", `/api/admin/users?email=${encodeURIComponent("%")}`)).body.users.length, 1);
    assert.deepEqual((await admin.json("GET", "/api/admin/users?email=nobody")).body.users, []);
    assert.equal((await admin.json("GET", "/api/admin/users?email=a&email=b")).status, 400);
    assert.equal((await alice.json("GET", "/api/admin/users")).status, 403);
  });

  test("POST /api/admin/users/:id/credit adds and takes back credit through the ledger, never below zero", async () => {
    const start = balance(aliceUser.id);
    const add = await admin.json("POST", `/api/admin/users/${aliceUser.id}/credit`, { usd: 5, note: "goodwill" });
    assert.equal(add.status, 200, add.text);
    assert.equal(add.body.balance_usd * 1e6, start + 5_000_000);
    const row = t.deps.db.prepare("SELECT * FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(aliceUser.id);
    assert.equal(row.kind, "admin_adjust");
    assert.equal(row.delta_micros, 5_000_000);
    assert.match(row.ref, /^admin:\S+ goodwill$/);

    const back = await admin.json("POST", `/api/admin/users/${aliceUser.id}/credit`, { usd: -2.5 });
    assert.equal(back.body.balance_usd * 1e6, start + 2_500_000);
    // A refund larger than the balance takes it to zero, not below.
    const all = await admin.json("POST", `/api/admin/users/${aliceUser.id}/credit`, { usd: -10_000 });
    assert.equal(all.body.balance_usd, 0);
    assert.equal(balance(aliceUser.id), 0);
    assert.equal(ledgerSum(aliceUser.id), 0, "balance == SUM(ledger)");

    for (const body of [{}, { usd: 0 }, { usd: "5" }, { usd: 10_001 }, { usd: 1, note: "x".repeat(201) }, { usd: 1, extra: 1 }]) {
      assert.equal((await admin.json("POST", `/api/admin/users/${aliceUser.id}/credit`, body)).status, 400, JSON.stringify(body).slice(0, 60));
    }
    assert.equal((await admin.json("POST", "/api/admin/users/nope/credit", { usd: 1 })).status, 404);
    assert.equal((await alice.json("POST", `/api/admin/users/${aliceUser.id}/credit`, { usd: 100 })).status, 403);
  });

  test("PUT /api/admin/routes/action/* is a 400: action routes as chat", async () => {
    const r = await admin.json("PUT", "/api/admin/routes/action/budget", { model_id: "openrouter:mistralai/ministral-3b-2512" });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /chat routes/);
    const cell = t.deps.db.prepare("SELECT model_id FROM routes WHERE job = 'action' AND tier = 'budget'").get();
    assert.equal(cell.model_id, "openrouter:deepseek/deepseek-v4.1-flash", "unchanged");
  });

  test("model edits pass openaiZdrApproved to validateModel", async () => {
    const model = {
      id: "openai:t/zdr-test", label: "ZDR test", vendor: "OpenAI", region: "us", gateway: "openai", slug: "t/zdr-test",
      jobs: ["chat"], price_in: 1, price_out: 2, zdr: true, supports_reasoning: false, params: {}, enabled: true,
    };
    const refused = await admin.json("POST", "/api/admin/models", model);
    assert.equal(refused.status, 400);
    assert.match(refused.body.error, /OPENAI_ZDR_APPROVED/);

    const approved = await createTestApp({ ADMIN_EMAILS: "root@example.test", OPENAI_ZDR_APPROVED: "1" });
    try {
      const c = approved.client();
      await c.signup("root@example.test", PASSWORD);
      assert.equal((await c.json("POST", "/api/admin/models", model)).status, 201);
      // Import goes through the same check.
      const exp = (await c.json("GET", "/api/admin/catalog/export")).body;
      assert.equal((await c.json("POST", "/api/admin/catalog/import", exp)).status, 200);
    } finally {
      await approved.close();
    }
    const exp = (await admin.json("GET", "/api/admin/catalog/export")).body;
    const withZdr = { models: [...exp.models, model], routes: [] };
    assert.equal((await admin.json("POST", "/api/admin/catalog/import", withZdr)).status, 400);
  });
});
