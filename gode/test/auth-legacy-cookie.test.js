// The pre-__Host- cookie name (gode_session) in secure mode: accepted only for sessions that were
// issued under it (sessions.cookie 'plain' or NULL), a fact stored with the session. A restart must
// not make tokens issued under __Host-gode_session acceptable under the tossable old name.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createTestApp } = require("./helpers/app");
const { SESSION_COOKIE, HOST_SESSION_COOKIE } = require("../src/auth");
const { sha256 } = require("../src/crypto");

const PASSWORD = "a-long-passphrase-1";

function setCookieNames(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return list.map((c) => {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
  });
}

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-legacy-"));
  return { dir, file: path.join(dir, "gode.db") };
}

test("after a restart on the same database, a post-rename token tossed in as gode_session is refused and not re-issued", async () => {
  const { dir, file } = tempDb();
  const env = { COOKIE_SECURE: "1", GODE_MASTER_KEY: crypto.randomBytes(32).toString("base64") };
  let token;
  try {
    const first = await createTestApp(env, { dbFile: file });
    try {
      const mallory = first.client();
      const r = await mallory.json("POST", "/api/auth/signup", { email: "mallory@example.test", password: PASSWORD });
      assert.equal(r.status, 201);
      token = mallory.cookies.get(HOST_SESSION_COOKIE);
      assert.ok(token, "issued under the __Host- name");
    } finally {
      await first.close();
    }
    // Deploy / crash / restart: a new process on the same file.
    const second = await createTestApp(env, { dbFile: file });
    try {
      // A sibling subdomain planted Mallory's own token under the old name in a signed-out browser.
      const victim = second.client();
      const res = await victim.json("GET", "/api/me", undefined, { headers: { Cookie: `${SESSION_COOKIE}=${token}` } });
      assert.equal(res.status, 401, "never signed in as Mallory");
      assert.ok(!setCookieNames(res).some((c) => c.name === HOST_SESSION_COOKIE && c.value), "nothing re-issued under __Host-");
      // Her session still works under its real name.
      const own = await victim.json("GET", "/api/me", undefined, { headers: { Cookie: `${HOST_SESSION_COOKIE}=${token}` } });
      assert.equal(own.status, 200);
      assert.equal(own.body.user.email, "mallory@example.test");
    } finally {
      await second.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a genuine pre-rename session (cookie NULL) moves to the __Host- name once; the old name then stops working for it", async () => {
  const t = await createTestApp({ COOKIE_SECURE: "1" });
  try {
    const c = t.client();
    await c.signup("old@example.test", PASSWORD);
    const token = c.cookies.get(HOST_SESSION_COOKIE);
    // As if made by the release before the rename (migration 3 leaves those rows NULL).
    t.deps.db.prepare("UPDATE sessions SET cookie = NULL WHERE token_hash = ?").run(sha256(token));
    const browser = t.client();
    const res = await browser.json("GET", "/api/me", undefined, { headers: { Cookie: `${SESSION_COOKIE}=${token}` } });
    assert.equal(res.status, 200);
    const set = setCookieNames(res);
    assert.ok(set.some((x) => x.name === HOST_SESSION_COOKIE && x.value === token), "same session under the new name");
    assert.ok(set.some((x) => x.name === SESSION_COOKIE && x.value === ""), "old cookie dropped");
    assert.equal(t.deps.db.prepare("SELECT cookie FROM sessions WHERE token_hash = ?").get(sha256(token)).cookie, "host");
    // Moved: a copy of the old cookie (or someone tossing it back) no longer signs in.
    const again = await t.client().json("GET", "/api/me", undefined, { headers: { Cookie: `${SESSION_COOKIE}=${token}` } });
    assert.equal(again.status, 401);
  } finally {
    await t.close();
  }
});

test("sessions record the name they were issued under", async () => {
  for (const [env, want] of [
    [{ COOKIE_SECURE: "1" }, "host"],
    [{ COOKIE_SECURE: "0" }, "plain"],
  ]) {
    const t = await createTestApp(env);
    try {
      const c = t.client();
      await c.signup("who@example.test", PASSWORD);
      assert.deepEqual(t.deps.db.prepare("SELECT cookie FROM sessions").all().map((r) => r.cookie), [want]);
    } finally {
      await t.close();
    }
  }
});

test("a session issued under the plain name (before COOKIE_SECURE was turned on) is still read under it once", async () => {
  const { dir, file } = tempDb();
  const key = crypto.randomBytes(32).toString("base64");
  try {
    const plain = await createTestApp({ COOKIE_SECURE: "0", GODE_MASTER_KEY: key }, { dbFile: file });
    let token;
    try {
      const c = plain.client();
      await c.signup("early@example.test", PASSWORD);
      token = c.cookies.get(SESSION_COOKIE);
    } finally {
      await plain.close();
    }
    const secure = await createTestApp({ COOKIE_SECURE: "1", GODE_MASTER_KEY: key }, { dbFile: file });
    try {
      const res = await secure.client().json("GET", "/api/me", undefined, { headers: { Cookie: `${SESSION_COOKIE}=${token}` } });
      assert.equal(res.status, 200);
      assert.ok(setCookieNames(res).some((x) => x.name === HOST_SESSION_COOKIE && x.value === token));
    } finally {
      await secure.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
