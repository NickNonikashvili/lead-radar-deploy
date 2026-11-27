"use strict";
// openDb() connection settings: a busy timeout (a second connection's write lock is waited for,
// not an instant "database is locked"), secure_delete, and WAL with synchronous=FULL for files.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { openDb } = require("../src/db");

const pragma = (db, name) => Object.values(db.prepare(`PRAGMA ${name}`).get())[0];

function tempFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-pragma-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, "gode.db");
}

test("file databases: WAL, synchronous FULL, busy timeout, secure_delete, foreign keys", (t) => {
  const db = openDb(tempFile(t));
  try {
    assert.equal(pragma(db, "journal_mode"), "wal");
    assert.equal(pragma(db, "synchronous"), 2, "FULL: a committed Stripe grant survives a power loss");
    assert.equal(pragma(db, "busy_timeout"), 5000);
    assert.equal(pragma(db, "secure_delete"), 1);
    assert.equal(pragma(db, "foreign_keys"), 1);
  } finally {
    db.close();
  }
  const mem = openDb(":memory:");
  assert.equal(pragma(mem, "busy_timeout"), 5000);
  assert.equal(pragma(mem, "secure_delete"), 1);
  mem.close();
});

test("a write waits for another process's short write lock instead of failing", async (t) => {
  const file = tempFile(t);
  openDb(file).close(); // migrate first
  // A second process (like the cron learner) holds BEGIN IMMEDIATE for 400 ms.
  const holder = spawn(
    process.execPath,
    [
      "-e",
      `const { DatabaseSync } = require("node:sqlite");
       const db = new DatabaseSync(${JSON.stringify(file)});
       db.exec("BEGIN IMMEDIATE");
       process.stdout.write("locked\\n");
       setTimeout(() => { db.exec("COMMIT"); db.close(); }, 400);`,
    ],
    { stdio: ["ignore", "pipe", "ignore"] }
  );
  await new Promise((resolve, reject) => {
    holder.stdout.on("data", (d) => String(d).includes("locked") && resolve());
    holder.on("error", reject);
  });
  const db = openDb(file);
  try {
    const started = Date.now();
    db.tx(() => db.prepare("INSERT INTO stripe_events (id, type, created_at) VALUES ('evt_wait', 'test', 1)").run());
    const waited = Date.now() - started;
    assert.ok(waited >= 100, `the write waited for the lock (${waited} ms)`);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stripe_events").get().n, 1);
  } finally {
    db.close();
    await new Promise((resolve) => (holder.exitCode !== null ? resolve() : holder.on("exit", resolve)));
  }
});
