// Operator scripts that work directly on the database (scripts/make-admin.js and
// scripts/reset-password.js), and keyring.hmac, the keyed fingerprint behind one-bonus-per-email.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadConfig } = require("../src/config");
const { openDb } = require("../src/db");
const { createAuth } = require("../src/auth");
const { createKeyring, randomToken } = require("../src/crypto");
const makeAdmin = require("../scripts/make-admin");
const resetPassword = require("../scripts/reset-password");

const PASSWORD = "correct-horse-battery";
let dir;
let env;

function io() {
  const out = { lines: [], errors: [] };
  out.log = (s) => out.lines.push(String(s));
  out.error = (s) => out.errors.push(String(s));
  return out;
}

/** A fresh connection per step, like a separate CLI process next to the server. */
function withDb(fn) {
  const db = openDb(env.DATABASE_PATH);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

async function withDbAsync(fn) {
  const db = openDb(env.DATABASE_PATH);
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

function authFor(db, extraEnv = {}) {
  const config = loadConfig({ ...env, ...extraEnv });
  return createAuth({ db, config, keyring: createKeyring(crypto.randomBytes(32)) });
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-scripts-"));
  env = { NODE_ENV: "test", DATA_DIR: dir, DATABASE_PATH: path.join(dir, "gode.db"), ADMIN_EMAILS: "", FIRST_USER_ADMIN: "0", SIGNUP_CREDIT_USD: "0" };
  const db = openDb(env.DATABASE_PATH);
  try {
    const auth = authFor(db);
    await auth.signup({ email: "owner@example.test", password: PASSWORD });
    await auth.signup({ email: "locked.out@example.test", password: PASSWORD });
  } finally {
    db.close();
  }
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

const isAdmin = (email) => withDb((db) => db.prepare("SELECT is_admin FROM users WHERE email = ?").get(email).is_admin);

test("make-admin grants and revokes admin directly in the database", () => {
  assert.equal(isAdmin("owner@example.test"), 0, "FIRST_USER_ADMIN off: nobody is admin by signing up first");
  let out = io();
  assert.equal(makeAdmin.main(["Owner@Example.test"], env, out), 0);
  assert.match(out.lines.join("\n"), /Admin rights granted/);
  assert.equal(isAdmin("owner@example.test"), 1);
  // The running server sees it on the next request (no restart): userFromToken reads the row.
  withDb((db) => {
    const auth = authFor(db);
    const token = auth.createSession(db.prepare("SELECT id FROM users WHERE email = ?").get("owner@example.test").id);
    assert.equal(auth.userFromToken(token).is_admin, 1);
  });
  out = io();
  assert.equal(makeAdmin.main(["owner@example.test"], env, out), 0);
  assert.match(out.lines.join("\n"), /already an admin/);
  out = io();
  assert.equal(makeAdmin.main(["owner@example.test", "--revoke"], env, out), 0);
  assert.equal(isAdmin("owner@example.test"), 0);
});

test("make-admin refuses unknown accounts, bad input, and ADMIN_EMAILS deployments", () => {
  let out = io();
  assert.equal(makeAdmin.main(["nobody@example.test"], env, out), 1);
  assert.match(out.errors.join("\n"), /No account with that email/);
  out = io();
  assert.equal(makeAdmin.main(["not-an-email"], env, out), 2);
  out = io();
  assert.equal(makeAdmin.main([], env, out), 2);
  assert.match(out.errors.join("\n"), /Usage/);
  out = io();
  assert.equal(makeAdmin.main(["a@example.test", "--force"], env, out), 2);
  out = io();
  assert.equal(makeAdmin.main(["--help"], env, out), 0);
  // With ADMIN_EMAILS set the list alone decides (re-checked per request): the script must not
  // pretend to change anything.
  out = io();
  assert.equal(makeAdmin.main(["owner@example.test"], { ...env, ADMIN_EMAILS: "boss@example.test" }, out), 1);
  assert.match(out.errors.join("\n"), /ADMIN_EMAILS is set/);
  assert.equal(isAdmin("owner@example.test"), 0);
});

test("reset-password sets a random one-time password, prints it once and signs the account out", async () => {
  const userId = withDb((db) => db.prepare("SELECT id FROM users WHERE email = ?").get("locked.out@example.test").id);
  const token = withDb((db) => authFor(db).createSession(userId));
  const out = io();
  assert.equal(await resetPassword.main(["locked.out@example.test"], env, out), 0);
  const line = out.lines.find((l) => l.startsWith("New one-time password: "));
  assert.ok(line, out.lines.join("\n"));
  const fresh = line.slice("New one-time password: ".length);
  assert.ok(fresh.length >= 20 && /^[A-Za-z0-9_-]+$/.test(fresh), "long, random, copy-paste safe");
  assert.match(out.lines.join("\n"), /Signed out 1 session/);
  await withDbAsync(async (db) => {
    const auth = authFor(db);
    assert.equal(auth.userFromToken(token), null, "existing sessions are gone");
    await assert.rejects(auth.login({ email: "locked.out@example.test", password: PASSWORD }), { status: 401 });
    assert.equal((await auth.login({ email: "locked.out@example.test", password: fresh })).id, userId);
  });
  // Never the same twice.
  const again = io();
  assert.equal(await resetPassword.main(["locked.out@example.test"], env, again), 0);
  assert.notEqual(again.lines.find((l) => l.startsWith("New one-time password: ")), line);
});

test("reset-password refuses unknown accounts and bad input", async () => {
  let out = io();
  assert.equal(await resetPassword.main(["ghost@example.test"], env, out), 1);
  out = io();
  assert.equal(await resetPassword.main(["nope"], env, out), 2);
  out = io();
  assert.equal(await resetPassword.main([], env, out), 2);
});

test("keyring.hmac: deterministic, separated by label, keyed by an HKDF-derived key (not the master key)", () => {
  const master = crypto.randomBytes(32);
  const k = createKeyring(master);
  const a = k.hmac("signup-bonus-email", "ada@example.test");
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(k.hmac("signup-bonus-email", "ada@example.test"), a, "deterministic");
  assert.equal(createKeyring(Buffer.from(master)).hmac("signup-bonus-email", "ada@example.test"), a, "same key, same fingerprint across restarts");
  assert.notEqual(k.hmac("other-purpose", "ada@example.test"), a, "labels are separate keys");
  assert.notEqual(createKeyring(crypto.randomBytes(32)).hmac("signup-bonus-email", "ada@example.test"), a, "another master key, another fingerprint");
  // Not a plain hash, and not an HMAC with the master key itself.
  assert.notEqual(a, crypto.createHash("sha256").update("ada@example.test").digest("hex"));
  assert.notEqual(a, crypto.createHmac("sha256", master).update("ada@example.test").digest("hex"));
  const derived = Buffer.from(crypto.hkdfSync("sha256", master, Buffer.alloc(0), "gode-hmac:signup-bonus-email", 32));
  assert.equal(a, crypto.createHmac("sha256", derived).update("ada@example.test").digest("hex"));
  assert.throws(() => k.hmac("", "x"), TypeError);
  assert.ok(randomToken(15).length >= 20);
});
