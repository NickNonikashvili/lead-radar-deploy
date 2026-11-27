// ADMIN_EMAILS in production: emails are not verified, so whoever registers a listed address first
// must not become an admin by that alone. An operator confirms the account once with
// scripts/make-admin.js; the list still revokes at once.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadConfig } = require("../src/config");
const { openDb } = require("../src/db");
const { createAuth } = require("../src/auth");
const { createKeyring } = require("../src/crypto");
const makeAdmin = require("../scripts/make-admin");

const PASSWORD = "correct-horse-battery";
let dir;
let env;

function io() {
  const out = { lines: [], errors: [] };
  out.log = (s) => out.lines.push(String(s));
  out.error = (s) => out.errors.push(String(s));
  return out;
}

/** A fresh connection per step, like a restart (or the CLI next to the server). */
async function withAuth(extraEnv, fn) {
  const db = openDb(env.DATABASE_PATH);
  const warnings = [];
  const logger = { warn: (s) => warnings.push(String(s)), error() {} };
  try {
    const auth = createAuth({ db, config: loadConfig({ ...env, ...extraEnv }), keyring: createKeyring(crypto.randomBytes(32)), logger });
    return await fn({ auth, db, warnings });
  } finally {
    db.close();
  }
}

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-admin-"));
  env = {
    NODE_ENV: "production",
    GODE_MASTER_KEY: crypto.randomBytes(32).toString("base64"),
    DATA_DIR: dir,
    DATABASE_PATH: path.join(dir, "gode.db"),
    ADMIN_EMAILS: "owner@example.test",
    SIGNUP_CREDIT_USD: "0",
  };
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("production: a listed address is not an admin at signup, and the signup is logged by account id only", async () => {
  assert.equal(loadConfig(env).adminEmailsAutoGrant, false, "off by default in production");
  await withAuth({}, async ({ auth, warnings }) => {
    // Someone (maybe not the owner) registers the listed address first.
    const squatter = await auth.signup({ email: "owner@example.test", password: PASSWORD });
    assert.equal(squatter.is_admin, 0);
    const token = auth.createSession(squatter.id);
    assert.equal(auth.userFromToken(token).is_admin, 0, "no admin on later requests either");
    assert.equal((await auth.login({ email: "owner@example.test", password: PASSWORD })).is_admin, 0);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes(squatter.id), warnings[0]);
    assert.ok(!warnings[0].includes("owner@"), "never the address");
    assert.match(warnings[0], /make-admin/);
    // An unlisted signup logs nothing.
    await auth.signup({ email: "someone@example.test", password: PASSWORD });
    assert.equal(warnings.length, 1);
  });
});

test("production: make-admin confirms a listed account, refuses unlisted ones, and the list still revokes", async () => {
  let out = io();
  assert.equal(makeAdmin.main(["someone@example.test"], env, out), 1, "not in ADMIN_EMAILS");
  assert.match(out.errors.join("\n"), /not in ADMIN_EMAILS/);

  out = io();
  assert.equal(makeAdmin.main(["owner@example.test"], env, out), 0);
  assert.match(out.lines.join("\n"), /confirmed/);
  await withAuth({}, ({ auth, db }) => {
    const id = db.prepare("SELECT id FROM users WHERE email = ?").get("owner@example.test").id;
    const token = auth.createSession(id);
    assert.equal(auth.userFromToken(token).is_admin, 1, "admin once confirmed");
  });
  // Removed from the list: revoked at once (and the stored confirmation is gone with it).
  await withAuth({ ADMIN_EMAILS: "boss@example.test" }, ({ auth, db }) => {
    const id = db.prepare("SELECT id FROM users WHERE email = ?").get("owner@example.test").id;
    assert.equal(auth.userFromToken(auth.createSession(id)).is_admin, 0);
  });
  // Listed again: needs a new confirmation.
  await withAuth({}, ({ auth, db }) => {
    const id = db.prepare("SELECT id FROM users WHERE email = ?").get("owner@example.test").id;
    assert.equal(auth.userFromToken(auth.createSession(id)).is_admin, 0);
  });
  out = io();
  assert.equal(makeAdmin.main(["owner@example.test", "--revoke"], env, out), 0);
  assert.match(out.lines.join("\n"), /not an admin/);
});

test("ADMIN_EMAILS_AUTO_GRANT=1 restores admin at signup in production; make-admin then defers to the list", async () => {
  await withAuth({ ADMIN_EMAILS: "auto@example.test", ADMIN_EMAILS_AUTO_GRANT: "1" }, async ({ auth, warnings }) => {
    const u = await auth.signup({ email: "auto@example.test", password: PASSWORD });
    assert.equal(u.is_admin, 1);
    assert.match(warnings[0], /granted admin/);
  });
  const out = io();
  assert.equal(makeAdmin.main(["auto@example.test"], { ...env, ADMIN_EMAILS: "auto@example.test", ADMIN_EMAILS_AUTO_GRANT: "1" }, out), 1);
  assert.match(out.errors.join("\n"), /ADMIN_EMAILS is set/);
});
