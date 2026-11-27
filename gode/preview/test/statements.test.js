"use strict";
// The preview's database stand-in knows every SQL statement the bundled Gode modules can prepare.
// If a product change adds or edits a statement, this test names it (and the preview would
// otherwise fail at runtime with "statement not supported by the preview").

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { previewBuild, previewBackend, previewClient } = require("./helpers");

const ROOT = path.resolve(__dirname, "..", "..");
const SQL_START = /^\s*(SELECT|INSERT|UPDATE|DELETE|PRAGMA)\b/i;

/** SQL string literals of a source file, with ${FRAGMENT} constants of the same file filled in. */
function sqlOf(source) {
  const fragments = new Map();
  for (const m of source.matchAll(/const (\w+) = `([^`]*)`;/g)) {
    if (source.includes("${" + m[1] + "}") && !m[2].includes("${")) fragments.set(m[1], m[2]);
  }
  const LIT = String.raw`("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\`(?:[^\`\\]|\\.)*\`)`;
  const literals = [];
  for (const m of source.matchAll(new RegExp(String.raw`\b(?:prepare|run)\(\s*` + LIT, "g"))) literals.push(m[1]);
  // SQL kept in a constant and run elsewhere (e.g. src/auth.js ARCHIVE_USAGE_SQL).
  for (const m of source.matchAll(/const (\w+) = (`[^`]*`);/g)) if (!fragments.has(m[1])) literals.push(m[2]);
  const statements = [];
  const dynamic = [];
  for (const lit of literals) {
    let text = lit.slice(1, -1);
    if (lit[0] === "`" && text.includes("${")) {
      let unresolved = false;
      text = text.replace(/\$\{([^}]+)\}/g, (all, name) => {
        if (fragments.has(name)) return fragments.get(name);
        unresolved = true;
        return all;
      });
      if (unresolved) {
        if (SQL_START.test(text)) dynamic.push(text.replace(/\s+/g, " ").trim());
        continue;
      }
    }
    if (SQL_START.test(text)) statements.push(text);
  }
  return { statements, dynamic };
}

test("every literal SQL statement in the bundled src/ modules is supported", async () => {
  const { result } = previewBuild();
  const backend = await previewBackend();
  const missing = [];
  const dynamic = [];
  let count = 0;
  for (const id of result.modules.filter((m) => m.startsWith("src/"))) {
    const { statements, dynamic: dyn } = sqlOf(fs.readFileSync(path.join(ROOT, id), "utf8"));
    dynamic.push(...dyn.map((d) => `${id}: ${d.slice(0, 80)}`));
    for (const sql of statements) {
      count += 1;
      try {
        backend.db.prepare(sql);
      } catch (e) {
        missing.push(`${id}: ${sql.replace(/\s+/g, " ").trim().slice(0, 160)}`);
      }
    }
  }
  assert.ok(count > 80, `found ${count} statements`);
  assert.deepEqual(missing, [], "statements the preview does not support");
  // The dynamic ones are known and exercised by the next test.
  const KNOWN_DYNAMIC = [
    "src/billing/credits.js: SELECT id, kind, delta_micros, ref, created_at FROM ledger WHERE user_id = ?",
    "src/routes/me.js: UPDATE users SET ",
    "src/seed/catalog.js: INSERT INTO models (",
    "src/seed/catalog.js: SELECT * FROM models ",
    "src/router/learn.js: SELECT ${keys}, COUNT(*) AS n,",
    "src/routes/admin.js: SELECT ${cols} FROM users ",
  ];
  assert.deepEqual(dynamic.filter((d) => !KNOWN_DYNAMIC.some((k) => d.startsWith(k))), [], "unexpected dynamic SQL");
});

test("the dynamically built statements work: profile update, ledger kinds, model lists", async () => {
  const backend = await previewBackend();
  const { db } = backend;
  const user = db.rows("users")[0];
  // PATCH /api/me builds "UPDATE users SET a = ?, b = ? WHERE id = ?".
  assert.equal(db.prepare("UPDATE users SET plan = ?, strict_privacy = ?, share_prompts = ? WHERE id = ?").run("best", 1, 1, user.id).changes, 1);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  assert.equal(row.plan, "best");
  assert.equal(row.strict_privacy, 1);
  // credits.ledger() with and without a kinds filter.
  const credits = backend.ctx.credits;
  const all = credits.ledger(user.id, { limit: 100 });
  const statement = credits.ledger(user.id, { limit: 100, kinds: ["purchase", "signup_bonus", "charge"] });
  assert.ok(all.length > statement.length && statement.length >= 3);
  assert.ok(statement.every((e) => ["purchase", "signup_bonus", "charge"].includes(e.kind)));
  assert.equal(statement[0].created_at >= statement[statement.length - 1].created_at, true, "newest first");
  assert.equal(all.reduce((s, e) => s + e.delta_micros, 0), row.balance_micros, "balance == sum of the ledger");
  // listModels both ways (enabledOnly adds a WHERE).
  assert.ok(db.prepare("SELECT * FROM models ORDER BY id").all().length >= 30);
  assert.ok(db.prepare("SELECT * FROM models WHERE enabled = 1 ORDER BY id").all().length >= 30);
});

test("the learner's and the admin page's dynamic statements: signal sums both ways, user search", async () => {
  const backend = await previewBackend();
  const { db } = backend;
  // computeStats / computeCellStats build "SELECT ${keys}, ..." with and without the tier; the
  // overview returns both (the demo account is an admin).
  const stats = await previewClient(backend).json("GET", "/api/admin/stats?days=90");
  assert.equal(stats.status, 200);
  const { models: perModel, cells: perCell } = stats.body;
  const since = stats.body.gate.since_ms;
  assert.ok(perModel.length > 3 && perCell.length >= perModel.length);
  const okRows = db.rows("requests").filter((r) => r.created_at >= since && r.status === "ok" && r.job && r.model_id);
  assert.equal(perModel.reduce((n, s) => n + s.n, 0), okRows.length, "every completed answer counted once");
  assert.equal(
    perModel.reduce((n, s) => n + s.up, 0),
    okRows.filter((r) => r.feedback === 1).length
  );
  const sorted = perModel.map((s) => `${s.job}|${s.model_id}`);
  assert.deepEqual(sorted, [...sorted].sort(), "ORDER BY job, model_id");
  // GET /api/admin/users: LIKE with backslash escapes, case-insensitive for ASCII.
  const like = (term) =>
    db
      .prepare("SELECT id, email, balance_micros, is_admin, created_at FROM users WHERE email LIKE ? ESCAPE '\\' ORDER BY created_at DESC, id LIMIT ?")
      .all(term, 50)
      .map((u) => u.email);
  assert.deepEqual(like("%DEMO%"), ["demo@example.com"]);
  assert.deepEqual(like("%\\_%"), [], "an escaped _ is a literal underscore");
  assert.ok(like("%example.com%").length >= 2);
  const newest = db.prepare("SELECT id, email, balance_micros, is_admin, created_at FROM users ORDER BY created_at DESC, id LIMIT ?").all(50);
  assert.equal(newest.length, db.rows("users").length);
  assert.ok(newest.every((u, i) => i === 0 || newest[i - 1].created_at >= u.created_at), "newest first");
});

test("unknown SQL is refused at prepare time, with the statement in the message", async () => {
  const backend = await previewBackend();
  assert.throws(() => backend.db.prepare("SELECT secret FROM nowhere"), /not supported by the preview: SELECT secret FROM nowhere/);
});

test("transactions roll back every table on a throw and join when nested", async () => {
  const backend = await previewBackend();
  const { db } = backend;
  const before = db.rows("ledger").length;
  const user = db.rows("users")[0];
  assert.throws(() =>
    db.tx(() => {
      db.prepare("INSERT INTO ledger (user_id, delta_micros, kind, ref, created_at) VALUES (?, ?, ?, ?, ?)").run(user.id, 1, "dev_topup", null, Date.now());
      db.tx(() => db.prepare("UPDATE users SET balance_micros = balance_micros + ? WHERE id = ?").run(1, user.id));
      throw new Error("boom");
    })
  );
  assert.equal(db.rows("ledger").length, before);
  assert.equal(db.prepare("SELECT balance_micros FROM users WHERE id = ?").get(user.id).balance_micros, user.balance_micros);
  assert.throws(() => db.tx(() => Promise.resolve()), /synchronous/);
});
