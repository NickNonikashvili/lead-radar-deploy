// Auth & web security: accounts, sessions, cookies, admin rules, rate limiting, same-origin
// checks, security headers and "delete everything". Real :memory: DB and keyring; credits is a
// small stub that writes real ledger rows so the transaction behaviour is observable.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");

const { loadConfig } = require("../src/config");
const { openDb } = require("../src/db");
const { createKeyring, sha256, hashPassword } = require("../src/crypto");
const { AppError, newId, now, ah } = require("../src/util");
const {
  createAuth,
  publicUser,
  securityHeaders,
  rateLimit,
  requireSameOrigin,
  parseCookies,
  normalizeEmail,
  ipPrefix,
  cspFor,
  CSP,
  SESSION_COOKIE,
  HOST_SESSION_COOKIE,
} = require("../src/auth");

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

// Not on the common-password list (validatePassword refuses "password123" and friends).
const PW = "violet-kettle-42";

function stubCredits(db, { fail = false } = {}) {
  const calls = [];
  return {
    calls,
    grant(userId, micros, kind, ref) {
      calls.push({ userId, micros, kind, ref });
      if (fail) throw new Error("ledger unavailable");
      return db.tx(() => {
        db.prepare("INSERT INTO ledger (user_id, delta_micros, kind, ref, created_at) VALUES (?, ?, ?, ?, ?)").run(
          userId,
          micros,
          kind,
          ref,
          now()
        );
        db.prepare("UPDATE users SET balance_micros = balance_micros + ? WHERE id = ?").run(micros, userId);
        return { balance: db.prepare("SELECT balance_micros AS b FROM users WHERE id = ?").get(userId).b, duplicate: false };
      });
    },
  };
}

function setup(env = {}, { creditsFail = false } = {}) {
  const config = loadConfig({ GODE_MOCK: "1", PORT: "3000", ...env });
  const db = openDb(":memory:");
  const keyring = createKeyring(crypto.randomBytes(32));
  const forgotten = [];
  const realForget = keyring.forget;
  keyring.forget = (w) => {
    forgotten.push(w);
    realForget(w);
  };
  const credits = stubCredits(db, { fail: creditsFail });
  const auth = createAuth({ db, config, keyring, credits });
  return { config, db, keyring, credits, auth, forgotten };
}

/** A small app wired the way createApp is specified to wire auth. */
function buildApp(ctx, { loginLimit = 100, sameOrigin } = {}) {
  const { auth, config } = ctx;
  const app = express();
  app.use(securityHeaders(config));
  app.use(express.json());
  app.use(auth.middleware());
  // Webhook-style route mounted before the origin check, as the app does for Stripe.
  app.post("/api/billing/webhook", (req, res) => res.json({ received: true }));
  app.use("/api", sameOrigin || auth.requireSameOrigin);
  const limiter = rateLimit({ windowMs: 60_000, max: loginLimit });
  app.post(
    "/api/auth/signup",
    limiter,
    ah(async (req, res) => {
      const user = await auth.signup(req.body || {});
      auth.setCookie(res, auth.createSession(user.id));
      res.json({ user: publicUser(user) });
    })
  );
  app.post(
    "/api/auth/login",
    limiter,
    ah(async (req, res) => {
      const user = await auth.login(req.body || {});
      auth.setCookie(res, auth.createSession(user.id));
      res.json({ user: publicUser(user) });
    })
  );
  app.post("/api/auth/logout", (req, res) => {
    auth.logout(req, res);
    res.json({ ok: true });
  });
  app.get("/api/me", auth.requireUser, (req, res) => res.json({ user: publicUser(req.user), raw: req.user }));
  app.post("/api/me/echo", auth.requireUser, (req, res) => res.json({ ok: true }));
  app.get("/api/admin/ping", auth.requireUser, auth.requireAdmin, (req, res) => res.json({ ok: true }));
  app.get("/api/admin/only", auth.requireAdmin, (req, res) => res.json({ ok: true }));
  app.use((req, res) => res.status(404).json({ error: "Not found", code: "not_found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Bad JSON", code: "bad_request" });
    res.status(500).json({ error: "Internal error", code: "internal" });
  });
  return { app, limiter };
}

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    port,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Raw HTTP request: full control over Host/Origin/Cookie headers (fetch rewrites Host). */
function request(port, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const h = { ...headers };
    if (payload !== null) {
      h["content-type"] = "application/json";
      h["content-length"] = Buffer.byteLength(payload);
    }
    const req = http.request({ host: "127.0.0.1", port, method, path, headers: h }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : null;
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, json, setCookies: res.headers["set-cookie"] || [] });
      });
    });
    req.on("error", reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

function sessionCookieFrom(setCookies, name = SESSION_COOKIE) {
  const line = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!line) return null;
  const value = line.split(";")[0].slice(name.length + 1);
  const attrs = line
    .split(";")
    .slice(1)
    .map((s) => s.trim());
  return { line, value, attrs };
}

async function withServer(ctx, opts, fn) {
  const { app, limiter } = buildApp(ctx, opts);
  const srv = await listen(app);
  try {
    return await fn(srv, limiter);
  } finally {
    limiter.stop();
    await srv.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

test("parseCookies handles spaces, quotes, encoding, junk and __proto__", async () => {
  const c = parseCookies(' a=1;b = two ;  gode_session="tok%2Fen" ; bad ; =x; e=%E0%A4%A; __proto__=p; a=dup');
  assert.equal(c.a, "1", "first occurrence wins");
  assert.equal(c.b, "two");
  assert.equal(c.gode_session, "tok/en");
  assert.equal(c.e, "%E0%A4%A", "malformed escape keeps raw value");
  assert.equal(c.__proto__, "p");
  assert.equal(Object.getPrototypeOf(c), null);
  assert.equal({}.p, undefined, "no prototype pollution");
  assert.deepEqual(Object.keys(parseCookies(undefined)), []);
  assert.deepEqual(Object.keys(parseCookies("")), []);
  assert.equal(parseCookies(["x=1", "y=2"]).y, "2");
});

test("normalizeEmail lower-cases, trims and rejects junk", async () => {
  assert.equal(normalizeEmail("  Ada.Lovelace+gode@Example.COM "), "ada.lovelace+gode@example.com");
  for (const bad of ["", "nope", "@x.com", "a@", "a@b", "a b@c.com", "a@b..com", ".a@b.com", "a..b@c.com", "a@-b.com", 5, null, `${"a".repeat(65)}@b.com`, `a@${"b".repeat(250)}.com`]) {
    assert.equal(normalizeEmail(bad), null, String(bad));
  }
});

test("publicUser exposes only the public fields with booleans and balance_usd", async () => {
  const row = {
    id: "u1",
    email: "a@b.co",
    password_hash: "secret",
    wrapped_dek: "wrapped",
    is_admin: 1,
    plan: "best",
    strict_privacy: 0,
    eu_only: 1,
    auto_pick: 1,
    share_prompts: 0,
    balance_micros: 1_250_000,
    created_at: 123,
  };
  const pub = publicUser(row);
  assert.deepEqual(pub, {
    id: "u1",
    email: "a@b.co",
    plan: "best",
    strict_privacy: false,
    eu_only: true,
    auto_pick: true,
    share_prompts: false,
    is_admin: true,
    balance_usd: 1.25,
    created_at: 123,
  });
  assert.deepEqual(publicUser(pub), pub, "idempotent on its own output");
  assert.equal(publicUser(null), null);
});

test("createAuth validates its dependencies and accepts the positional form", async () => {
  const { db, config, keyring, credits } = setup();
  assert.throws(() => createAuth({ config, keyring }), TypeError);
  assert.throws(() => createAuth({ db, keyring }), TypeError);
  assert.throws(() => createAuth({ db, config }), TypeError);
  assert.throws(() => createAuth({ db, config, keyring, credits: {} }), TypeError);
  const positional = createAuth(db, config, keyring, credits);
  assert.equal(typeof positional.signup, "function");
});

// ---------------------------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------------------------

test("signup normalises email, hashes the password, wraps a DEK and grants the bonus", async () => {
  const { auth, db, credits, keyring } = setup({ SIGNUP_CREDIT_USD: "0.25" });
  const user = await auth.signup({ email: "  Ada@Example.com ", password: "correct horse" });
  assert.equal(user.email, "ada@example.com");
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  assert.match(row.password_hash, /^scrypt\$/);
  assert.ok(!row.password_hash.includes("correct horse"));
  // The wrapped DEK works with the keyring.
  const sealed = keyring.encrypt(row.wrapped_dek, "hello");
  assert.equal(keyring.decrypt(row.wrapped_dek, sealed), "hello");
  assert.deepEqual(credits.calls, [{ userId: user.id, micros: 250_000, kind: "signup_bonus", ref: "signup" }]);
  assert.equal(user.balance_micros, 250_000, "returned user reflects the bonus");
  assert.equal(publicUser(user).balance_usd, 0.25);
});

test("signup user object hides password_hash and wrapped_dek from serialisation", async () => {
  const { auth } = setup();
  const user = await auth.signup({ email: "a@example.com", password: PW });
  assert.match(user.password_hash, /^scrypt\$/, "still readable server-side");
  assert.ok(user.wrapped_dek.startsWith("v1."));
  const json = JSON.stringify(user);
  assert.ok(!json.includes("password_hash") && !json.includes("wrapped_dek"));
  assert.ok(!("password_hash" in { ...user }));
});

test("no signup bonus when SIGNUP_CREDIT_USD is 0", async () => {
  const { auth, credits } = setup({ SIGNUP_CREDIT_USD: "0" });
  await auth.signup({ email: "a@example.com", password: PW });
  assert.equal(credits.calls.length, 0);
});

test("a failing bonus grant rolls back the whole signup", async () => {
  const { auth, db } = setup({}, { creditsFail: true });
  await assert.rejects(() => auth.signup({ email: "a@example.com", password: PW }), /ledger unavailable/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0);
});

test("weak, common, long or missing passwords and bad emails are 400 bad_request", async () => {
  const { auth, db } = setup();
  const cases = [
    { email: "a@example.com", password: "short" },
    { email: "a@example.com", password: "1234567" },
    { email: "a@example.com", password: "x".repeat(201) },
    { email: "a@example.com" },
    { email: "a@example.com", password: 12345678 },
    { email: "not-an-email", password: PW },
    { password: PW },
    // Very common passwords, any case, and passwords that are only spaces or one repeated character.
    { email: "a@example.com", password: "12345678" },
    { email: "a@example.com", password: "password" },
    { email: "a@example.com", password: "Password123" },
    { email: "a@example.com", password: "qwertyuiop" },
    { email: "a@example.com", password: "        " },
    { email: "a@example.com", password: " \t \n \t  " },
    { email: "a@example.com", password: "zzzzzzzzzz" },
    // The address itself, or its local part.
    { email: "longname@example.com", password: "LongName@example.com" },
    { email: "longname@example.com", password: "longname" },
  ];
  for (const c of cases) {
    await assert.rejects(
      () => auth.signup(c),
      (e) => e instanceof AppError && e.status === 400 && e.code === "bad_request",
      JSON.stringify(c)
    );
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0, "nothing was stored");
  await auth.signup({ email: "ok@example.com", password: "xy".repeat(100) }); // boundary is inclusive
  await auth.signup({ email: "ok2@example.com", password: "  spaces inside are fine  " });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 2);
});

test("duplicate email (any case) is 409 conflict", async () => {
  const { auth, credits } = setup();
  await auth.signup({ email: "dup@example.com", password: PW });
  await assert.rejects(
    () => auth.signup({ email: "DUP@Example.com", password: "another-pass" }),
    (e) => e instanceof AppError && e.status === 409 && e.code === "conflict"
  );
  assert.equal(credits.calls.length, 1, "no bonus for the rejected signup");
});

test("with ADMIN_EMAILS set only listed addresses are admins, never the first account", async () => {
  const { auth } = setup({ ADMIN_EMAILS: "Boss@Example.com, ops@example.com" });
  assert.equal((await auth.signup({ email: "first@example.com", password: PW })).is_admin, 0, "first account is not admin");
  assert.equal((await auth.signup({ email: "second@example.com", password: PW })).is_admin, 0);
  assert.equal((await auth.signup({ email: "boss@example.com", password: PW })).is_admin, 1);
  assert.equal((await auth.signup({ email: "OPS@example.com", password: PW })).is_admin, 1);
});

test("without ADMIN_EMAILS the first account is admin only when FIRST_USER_ADMIN is on (off in production)", async () => {
  const dev = setup();
  assert.equal(dev.config.firstUserAdmin, true, "on by default outside production");
  assert.equal((await dev.auth.signup({ email: "first@example.com", password: PW })).is_admin, 1);
  assert.equal((await dev.auth.signup({ email: "second@example.com", password: PW })).is_admin, 0);

  const off = setup({ FIRST_USER_ADMIN: "0" });
  assert.equal((await off.auth.signup({ email: "first@example.com", password: PW })).is_admin, 0);

  const prod = setup({ NODE_ENV: "production", GODE_MASTER_KEY: crypto.randomBytes(32).toString("base64") });
  assert.equal(prod.config.firstUserAdmin, false);
  assert.equal((await prod.auth.signup({ email: "first@example.com", password: PW })).is_admin, 0, "no first-come admin in production");
});

test("ADMIN_EMAILS is re-checked: removing an address revokes admin for live sessions and at login", async () => {
  const before = setup({ ADMIN_EMAILS: "boss@example.com" });
  const boss = await before.auth.signup({ email: "boss@example.com", password: PW });
  const token = before.auth.createSession(boss.id);
  assert.equal(before.auth.userFromToken(token).is_admin, 1);

  // Same database, restarted without the address (and with someone else listed).
  const after = createAuth({ db: before.db, config: loadConfig({ GODE_MOCK: "1", ADMIN_EMAILS: "other@example.com" }), keyring: before.keyring, credits: before.credits });
  assert.equal(after.userFromToken(token).is_admin, 0, "an existing session loses admin at once");
  assert.equal(before.db.prepare("SELECT is_admin FROM users WHERE id = ?").get(boss.id).is_admin, 0, "and the stored flag follows");
  assert.equal((await after.login({ email: "boss@example.com", password: PW })).is_admin, 0);

  // A stale stored flag can't grant admin either while ADMIN_EMAILS is set.
  before.db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(boss.id);
  assert.equal(after.userFromToken(token).is_admin, 0);

  // Listed again: admin comes back on the next request.
  const relisted = createAuth({ db: before.db, config: loadConfig({ GODE_MOCK: "1", ADMIN_EMAILS: "boss@example.com" }), keyring: before.keyring, credits: before.credits });
  assert.equal(relisted.userFromToken(token).is_admin, 1);
});

test("login accepts the right password (email case-insensitive) and returns the user", async () => {
  const { auth } = setup();
  const created = await auth.signup({ email: "ada@example.com", password: PW });
  const user = await auth.login({ email: " ADA@example.com", password: PW });
  assert.equal(user.id, created.id);
});

test("login fails with the same 401 for unknown email, wrong password and malformed input", async () => {
  const { auth } = setup();
  await auth.signup({ email: "ada@example.com", password: PW });
  const attempts = [
    { email: "ada@example.com", password: "wrong-password" },
    { email: "nobody@example.com", password: PW },
    { email: "not-an-email", password: PW },
    { email: "ada@example.com" },
    { email: "ada@example.com", password: "x".repeat(10_000) },
    {},
  ];
  const errors = [];
  for (const a of attempts) {
    try {
      await auth.login(a);
    } catch (e) {
      errors.push(e);
      continue;
    }
    assert.fail("login should have failed");
  }
  for (const e of errors) {
    assert.ok(e instanceof AppError);
    assert.equal(e.status, 401);
    assert.equal(e.code, "unauthorized");
    assert.equal(e.message, errors[0].message);
  }
});

test("login for an unknown email still pays for a password verification", async () => {
  const { auth } = setup();
  await auth.signup({ email: "ada@example.com", password: PW });
  const time = async (attempt) => {
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const t = process.hrtime.bigint();
      await assert.rejects(() => auth.login(attempt));
      best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6);
    }
    return best;
  };
  const wrongPassword = await time({ email: "ada@example.com", password: "nope-nope" });
  const unknownEmail = await time({ email: "ghost@example.com", password: "nope-nope" });
  // A short-circuit would be ~100x faster than scrypt; equal work lands near 1x.
  assert.ok(unknownEmail > wrongPassword * 0.3, `unknown ${unknownEmail}ms vs wrong ${wrongPassword}ms`);
});

test("password hashing is async: the event loop keeps running while scrypt works", async () => {
  const { auth } = setup();
  let ticks = 0;
  const timer = setInterval(() => ticks++, 5);
  try {
    await auth.signup({ email: "ada@example.com", password: PW });
    await assert.rejects(() => auth.login({ email: "ada@example.com", password: "nope-nope" }));
  } finally {
    clearInterval(timer);
  }
  // Two hashes take ~400 ms; a synchronous scryptSync would leave the 5 ms timer at 0-1 ticks.
  assert.ok(ticks >= 10, `timer ticked ${ticks} times while hashing`);
});

test("new hashes use scrypt N=2^15, r=8, p=3; an old N=2^14 hash still logs in and is upgraded", async () => {
  const { auth, db, keyring } = setup();
  const user = await auth.signup({ email: "ada@example.com", password: PW });
  assert.match(db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id).password_hash, /^scrypt\$32768\$8\$3\$/);

  // A hash as the previous release wrote it (scryptSync, N=2^14, r=8, p=1).
  const salt = crypto.randomBytes(16);
  const old = `scrypt$16384$8$1$${salt.toString("base64")}$${crypto.scryptSync("old-password-1", salt, 64, { N: 16384, r: 8, p: 1 }).toString("base64")}`;
  db.prepare("INSERT INTO users (id, email, password_hash, wrapped_dek, created_at) VALUES (?, ?, ?, ?, ?)").run("old", "old@example.com", old, keyring.newWrappedDek(), now());
  assert.equal((await auth.login({ email: "old@example.com", password: "old-password-1" })).id, "old");
  const upgraded = db.prepare("SELECT password_hash FROM users WHERE id = 'old'").get().password_hash;
  assert.match(upgraded, /^scrypt\$32768\$8\$3\$/, "rehashed with the new parameters");
  assert.equal((await auth.login({ email: "old@example.com", password: "old-password-1" })).id, "old", "and still logs in");
  await assert.rejects(() => auth.login({ email: "old@example.com", password: "wrong-password" }), (e) => e.status === 401);
});

test("one signup bonus per email address, even after delete everything, +tags and gmail dots", async () => {
  const { auth, db, credits } = setup({ SIGNUP_CREDIT_USD: "0.25" });
  const first = await auth.signup({ email: "Farm.Er@gmail.com", password: PW });
  assert.equal(credits.calls.length, 1);
  assert.equal(first.signupBonusMicros, 250_000);
  auth.deleteEverything(first.id);
  const again = await auth.signup({ email: "farm.er@gmail.com", password: PW });
  assert.equal(again.balance_micros, 0, "no second bonus for a re-registered address");
  assert.equal(again.signupBonusMicros, 0);
  auth.deleteEverything(again.id);
  for (const variant of ["farmer+1@gmail.com", "f.a.r.m.e.r@googlemail.com"]) {
    const u = await auth.signup({ email: variant, password: PW });
    assert.equal(u.balance_micros, 0, variant);
  }
  const other = await auth.signup({ email: "someone.else@example.com", password: PW });
  assert.equal(other.balance_micros, 250_000);
  assert.equal(credits.calls.length, 2);
  // Only keyed fingerprints are kept: no address in the claims table.
  const claims = db.prepare("SELECT * FROM bonus_claims").all();
  assert.equal(claims.length, 2);
  assert.ok(claims.every((c) => /^[0-9a-f]{64}$/.test(c.email_hmac)));
  assert.ok(!JSON.stringify(claims).includes("farm"));
  assert.notEqual(claims[0].email_hmac, sha256("farmer@gmail.com"), "an HMAC, not a guessable plain hash");
});

test("signup bonuses stop at SIGNUP_BONUS_DAILY_CAP per UTC day; accounts still open", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 10, 27, 23, 0, 0) });
  const { auth, db } = setup({ SIGNUP_CREDIT_USD: "0.25", SIGNUP_BONUS_DAILY_CAP: "2" });
  const balances = [];
  for (const n of [1, 2, 3]) balances.push((await auth.signup({ email: `u${n}@example.com`, password: PW })).balance_micros);
  assert.deepEqual(balances, [250_000, 250_000, 0]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 3);
  t.mock.timers.tick(2 * 60 * 60 * 1000); // past midnight UTC
  assert.equal((await auth.signup({ email: "u4@example.com", password: PW })).balance_micros, 250_000, "a new day, new bonuses");
  const unlimited = setup({ SIGNUP_CREDIT_USD: "0.25", SIGNUP_BONUS_DAILY_CAP: "0" });
  for (const n of [1, 2, 3]) assert.equal((await unlimited.auth.signup({ email: `v${n}@example.com`, password: PW })).balance_micros, 250_000);
});

test("changePassword checks the current password, applies the rules and signs out other sessions", async () => {
  const { auth, db } = setup();
  const user = await auth.signup({ email: "ada@example.com", password: PW });
  const here = auth.createSession(user.id);
  const elsewhere = auth.createSession(user.id);
  await assert.rejects(() => auth.changePassword(user, { current: "not-it-at-all", next: "new-pass-word-9", keepToken: here }), (e) => e.status === 401);
  await assert.rejects(() => auth.changePassword(user, { current: PW, next: "password1", keepToken: here }), (e) => e.status === 400);
  await assert.rejects(() => auth.changePassword(user, { current: PW, next: PW, keepToken: here }), (e) => e.status === 400);
  assert.equal(auth.userFromToken(elsewhere).id, user.id, "nothing changed on refusal");
  const out = await auth.changePassword(user, { current: PW, next: "new-pass-word-9", keepToken: here });
  assert.deepEqual(out, { revoked: 1 });
  assert.equal(auth.userFromToken(here).id, user.id, "this session stays");
  assert.equal(auth.userFromToken(elsewhere), null, "the other device is signed out");
  await assert.rejects(() => auth.login({ email: "ada@example.com", password: PW }), (e) => e.status === 401);
  assert.equal((await auth.login({ email: "ada@example.com", password: "new-pass-word-9" })).id, user.id);
  assert.equal(await auth.checkPassword(user, "new-pass-word-9"), true);
  assert.equal(await auth.checkPassword(user, PW), false);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(user.id).n, 1);
});

// ---------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------

test("createSession stores only sha256(token) with the configured expiry", async () => {
  const { auth, db } = setup({ SESSION_DAYS: "7" });
  const user = await auth.signup({ email: "a@example.com", password: PW });
  const before = now();
  const token = auth.createSession(user.id);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const rows = db.prepare("SELECT * FROM sessions").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, sha256(token));
  assert.ok(!JSON.stringify(rows).includes(token), "raw token never stored");
  const days = (rows[0].expires_at - rows[0].created_at) / 86_400_000;
  assert.equal(days, 7);
  assert.ok(rows[0].created_at >= before);
  assert.equal(auth.userFromToken(token).id, user.id);
});

test("userFromToken rejects junk, unknown and expired tokens (deleting expired rows)", async () => {
  const { auth, db } = setup();
  const user = await auth.signup({ email: "a@example.com", password: PW });
  for (const junk of [undefined, null, "", "short", "x".repeat(300), "has space in it!!!!!", 42]) {
    assert.equal(auth.userFromToken(junk), null);
  }
  assert.equal(auth.userFromToken("A".repeat(43)), null);
  const token = auth.createSession(user.id);
  db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(now() - 1, sha256(token));
  assert.equal(auth.userFromToken(token), null);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0, "expired session deleted lazily");
});

test("destroySession removes the session; purgeExpiredSessions clears old ones", async () => {
  const { auth, db } = setup();
  const user = await auth.signup({ email: "a@example.com", password: PW });
  const t1 = auth.createSession(user.id);
  const t2 = auth.createSession(user.id);
  assert.equal(auth.destroySession(t1), true);
  assert.equal(auth.destroySession(t1), false);
  assert.equal(auth.destroySession(undefined), false);
  assert.equal(auth.userFromToken(t1), null);
  assert.equal(auth.userFromToken(t2).id, user.id, "other sessions survive");
  db.prepare("UPDATE sessions SET expires_at = 0").run();
  assert.equal(auth.purgeExpiredSessions(), 1);
});

test("createSession prunes the user's expired sessions", async () => {
  const { auth, db } = setup();
  const user = await auth.signup({ email: "a@example.com", password: PW });
  auth.createSession(user.id);
  db.prepare("UPDATE sessions SET expires_at = 1").run();
  auth.createSession(user.id);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
});

// ---------------------------------------------------------------------------------------------
// HTTP flows
// ---------------------------------------------------------------------------------------------

test("signup -> me -> logout -> me over HTTP, with correct cookie flags", async () => {
  const ctx = setup({ SESSION_DAYS: "30" });
  await withServer(ctx, {}, async ({ port }) => {
    const signup = await request(port, "POST", "/api/auth/signup", { body: { email: "Ada@Example.com", password: PW } });
    assert.equal(signup.status, 200);
    assert.equal(signup.json.user.email, "ada@example.com");
    assert.equal(signup.json.user.is_admin, true);
    assert.equal(signup.json.user.balance_usd, 0.25);
    assert.ok(!JSON.stringify(signup.json).includes("password"));

    const cookie = sessionCookieFrom(signup.setCookies);
    assert.ok(cookie, "session cookie set");
    assert.ok(cookie.attrs.includes("HttpOnly"));
    assert.ok(cookie.attrs.includes("SameSite=Lax"));
    assert.ok(cookie.attrs.includes("Path=/"));
    assert.ok(cookie.attrs.includes(`Max-Age=${30 * 86400}`));
    assert.ok(cookie.attrs.some((a) => a.startsWith("Expires=")));
    assert.ok(!cookie.attrs.includes("Secure"), "not Secure when COOKIE_SECURE is off");

    const me = await request(port, "GET", "/api/me", { headers: { cookie: `other=1; ${SESSION_COOKIE}=${cookie.value}` } });
    assert.equal(me.status, 200);
    assert.equal(me.json.user.email, "ada@example.com");
    assert.equal(me.json.raw.password_hash, undefined, "res.json(req.user) does not leak the hash");
    assert.equal(me.json.raw.wrapped_dek, undefined);

    const logout = await request(port, "POST", "/api/auth/logout", { headers: { cookie: `${SESSION_COOKIE}=${cookie.value}` } });
    assert.equal(logout.status, 200);
    const cleared = sessionCookieFrom(logout.setCookies);
    assert.equal(cleared.value, "");
    assert.ok(cleared.attrs.includes("Max-Age=0"));
    assert.ok(cleared.attrs.includes("HttpOnly"));

    const after = await request(port, "GET", "/api/me", { headers: { cookie: `${SESSION_COOKIE}=${cookie.value}` } });
    assert.equal(after.status, 401);
    assert.equal(after.json.code, "unauthorized");
    assert.equal(ctx.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);
  });
});

test("login over HTTP: success sets a new cookie; failures share one error body", async () => {
  const ctx = setup();
  await ctx.auth.signup({ email: "ada@example.com", password: PW });
  await withServer(ctx, {}, async ({ port }) => {
    const ok = await request(port, "POST", "/api/auth/login", { body: { email: "ada@example.com", password: PW } });
    assert.equal(ok.status, 200);
    assert.ok(sessionCookieFrom(ok.setCookies).value.length >= 43);

    const wrongPw = await request(port, "POST", "/api/auth/login", { body: { email: "ada@example.com", password: "nope-nope" } });
    const noUser = await request(port, "POST", "/api/auth/login", { body: { email: "ghost@example.com", password: PW } });
    assert.equal(wrongPw.status, 401);
    assert.equal(noUser.status, 401);
    assert.deepEqual(wrongPw.json, noUser.json);
    assert.equal(wrongPw.setCookies.length, 0);
  });
});

test("COOKIE_SECURE: the session cookie is __Host-gode_session, Secure, Path=/ and without Domain", async () => {
  const ctx = setup({ COOKIE_SECURE: "1" });
  assert.equal(ctx.auth.cookieName, HOST_SESSION_COOKIE);
  await withServer(ctx, {}, async ({ port }) => {
    const res = await request(port, "POST", "/api/auth/signup", { body: { email: "a@example.com", password: PW } });
    const cookie = sessionCookieFrom(res.setCookies, HOST_SESSION_COOKIE);
    assert.ok(cookie, "__Host- cookie set");
    assert.ok(cookie.attrs.includes("Secure"));
    assert.ok(cookie.attrs.includes("Path=/"));
    assert.ok(!cookie.attrs.some((a) => /^domain=/i.test(a)), "a __Host- cookie must not carry Domain");
    assert.equal(sessionCookieFrom(res.setCookies), null, "no plain-name cookie is issued");
    const me = await request(port, "GET", "/api/me", { headers: { cookie: `${HOST_SESSION_COOKIE}=${cookie.value}` } });
    assert.equal(me.status, 200);
    const out = await request(port, "POST", "/api/auth/logout", { headers: { cookie: `${HOST_SESSION_COOKIE}=${cookie.value}` } });
    assert.ok(sessionCookieFrom(out.setCookies, HOST_SESSION_COOKIE).attrs.includes("Secure"));
    assert.equal(sessionCookieFrom(out.setCookies).value, "", "the legacy name is cleared too");
    assert.equal((await request(port, "GET", "/api/me", { headers: { cookie: `${HOST_SESSION_COOKIE}=${cookie.value}` } })).status, 401);
  });
});

test("COOKIE_SECURE: a pre-rename gode_session cookie still works once and moves to the __Host- name", async () => {
  const ctx = setup({ COOKIE_SECURE: "1" });
  const user = await ctx.auth.signup({ email: "a@example.com", password: PW });
  const token = ctx.auth.createSession(user.id);
  // Made by the release before the rename (migration 3 leaves those rows' cookie NULL): the only
  // way a genuine plain-name cookie can exist in secure mode.
  ctx.db.prepare("UPDATE sessions SET cookie = NULL WHERE token_hash = ?").run(sha256(token));
  await withServer(ctx, {}, async ({ port }) => {
    const res = await request(port, "GET", "/api/me", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.id, user.id);
    assert.equal(sessionCookieFrom(res.setCookies, HOST_SESSION_COOKIE).value, token, "same session under the new name");
    const legacy = sessionCookieFrom(res.setCookies);
    assert.equal(legacy.value, "");
    assert.ok(legacy.attrs.includes("Max-Age=0"), "old cookie dropped");
  });
});

test("COOKIE_SECURE: a session made by this release is never accepted under the old name (tossed into a signed-out browser)", async () => {
  const ctx = setup({ COOKIE_SECURE: "1" });
  const mallory = await ctx.auth.signup({ email: "mallory@example.com", password: PW });
  // Mallory logs in herself, reads her own fresh token and plants it as gode_session on the
  // victim's browser from a sibling subdomain. The victim has no session of their own.
  const malloryToken = ctx.auth.createSession(mallory.id);
  await withServer(ctx, {}, async ({ port }) => {
    const res = await request(port, "GET", "/api/me", { headers: { cookie: `${SESSION_COOKIE}=${malloryToken}` } });
    assert.equal(res.status, 401, "never signed in as Mallory");
    assert.equal(sessionCookieFrom(res.setCookies, HOST_SESSION_COOKIE)?.value || "", "", "nothing re-issued under the __Host- name");
  });
  assert.equal(ctx.auth.userFromToken(malloryToken).id, mallory.id, "her session itself still works under the right name");
});

test("COOKIE_SECURE: a tossed plain-name cookie never overrides the real __Host- session", async () => {
  const ctx = setup({ COOKIE_SECURE: "1" });
  const alice = await ctx.auth.signup({ email: "alice@example.com", password: PW });
  const mallory = await ctx.auth.signup({ email: "mallory@example.com", password: PW });
  const aliceToken = ctx.auth.createSession(alice.id);
  const malloryToken = ctx.auth.createSession(mallory.id);
  await withServer(ctx, {}, async ({ port }) => {
    // A sibling subdomain set gode_session=<mallory> with Path=/api, which browsers send first.
    const res = await request(port, "GET", "/api/me", { headers: { cookie: `${SESSION_COOKIE}=${malloryToken}; ${HOST_SESSION_COOKIE}=${aliceToken}` } });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.email, "alice@example.com");
    assert.equal(res.setCookies.length, 0, "nothing re-issued");
  });
});

test("two different users' valid sessions in one request sign in neither (cookie tossing)", async () => {
  const ctx = setup();
  const alice = await ctx.auth.signup({ email: "alice@example.com", password: PW });
  const mallory = await ctx.auth.signup({ email: "mallory@example.com", password: PW });
  const aliceToken = ctx.auth.createSession(alice.id);
  const malloryToken = ctx.auth.createSession(mallory.id);
  await withServer(ctx, {}, async ({ port }) => {
    const res = await request(port, "GET", "/api/me", { headers: { cookie: `${SESSION_COOKIE}=${malloryToken}; ${SESSION_COOKIE}=${aliceToken}` } });
    assert.equal(res.status, 401, "never Mallory's account");
    assert.equal(ctx.auth.userFromToken(aliceToken).id, alice.id, "Alice's session itself is intact");
    // Two cookies of the same user (an old tab) are fine.
    const second = ctx.auth.createSession(alice.id);
    const ok = await request(port, "GET", "/api/me", { headers: { cookie: `${SESSION_COOKIE}=${second}; ${SESSION_COOKIE}=${aliceToken}` } });
    assert.equal(ok.json.user.id, alice.id);
  });
});

test("an expired session cookie is rejected over HTTP and cleared", async () => {
  const ctx = setup();
  const user = await ctx.auth.signup({ email: "a@example.com", password: PW });
  const token = ctx.auth.createSession(user.id);
  ctx.db.prepare("UPDATE sessions SET expires_at = ?").run(now() - 1000);
  await withServer(ctx, {}, async ({ port }) => {
    const res = await request(port, "GET", "/api/me", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
    assert.equal(res.status, 401);
    const cleared = sessionCookieFrom(res.setCookies);
    assert.ok(cleared && cleared.attrs.includes("Max-Age=0"), "browser told to drop the stale cookie");
  });
});

test("a tossed bogus cookie ahead of the real one does not log the user out", async () => {
  const ctx = setup();
  const user = await ctx.auth.signup({ email: "a@example.com", password: PW });
  const token = ctx.auth.createSession(user.id);
  await withServer(ctx, {}, async ({ port }) => {
    const res = await request(port, "GET", "/api/me", { headers: { cookie: `${SESSION_COOKIE}=${"B".repeat(43)}; ${SESSION_COOKIE}=${token}` } });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.id, user.id);
    assert.equal(res.setCookies.length, 0);
  });
});

test("requireUser / requireAdmin", async () => {
  const ctx = setup();
  const admin = await ctx.auth.signup({ email: "admin@example.com", password: PW });
  const plain = await ctx.auth.signup({ email: "plain@example.com", password: PW });
  const adminCookie = `${SESSION_COOKIE}=${ctx.auth.createSession(admin.id)}`;
  const plainCookie = `${SESSION_COOKIE}=${ctx.auth.createSession(plain.id)}`;
  await withServer(ctx, {}, async ({ port }) => {
    assert.equal((await request(port, "GET", "/api/me")).status, 401);
    assert.equal((await request(port, "GET", "/api/admin/ping", { headers: { cookie: adminCookie } })).status, 200);
    const denied = await request(port, "GET", "/api/admin/ping", { headers: { cookie: plainCookie } });
    assert.equal(denied.status, 403);
    assert.equal(denied.json.code, "forbidden");
    const anon = await request(port, "GET", "/api/admin/only");
    assert.equal(anon.status, 401, "requireAdmin alone: anonymous is 401");
    assert.equal((await request(port, "GET", "/api/admin/only", { headers: { cookie: plainCookie } })).status, 403);
  });
});

// ---------------------------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------------------------

test("rate limiter returns 429 rate_limited with Retry-After over HTTP", async () => {
  const ctx = setup();
  await ctx.auth.signup({ email: "a@example.com", password: PW });
  await withServer(ctx, { loginLimit: 3 }, async ({ port }, limiter) => {
    const body = { email: "a@example.com", password: "wrong-pass" };
    for (let i = 0; i < 3; i++) assert.equal((await request(port, "POST", "/api/auth/login", { body })).status, 401);
    const limited = await request(port, "POST", "/api/auth/login", { body: { email: "a@example.com", password: PW } });
    assert.equal(limited.status, 429);
    assert.equal(limited.json.code, "rate_limited");
    assert.ok(Number(limited.headers["retry-after"]) >= 1);
    limiter.reset();
    assert.equal((await request(port, "POST", "/api/auth/login", { body: { email: "a@example.com", password: PW } })).status, 200);
  });
});

function fakeLimiterCall(limiter, req) {
  const headers = {};
  const res = { setHeader: (k, v) => (headers[k.toLowerCase()] = v) };
  let error = null;
  let passed = false;
  limiter(req, res, (err) => {
    if (err) error = err;
    else passed = true;
  });
  return { passed, error, headers };
}

test("rate limiter windows reset, keys are independent, custom key and falsy key", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const limiter = rateLimit({ windowMs: 10_000, max: 2 });
  try {
    const a = { ip: "1.1.1.1" };
    const b = { ip: "2.2.2.2" };
    assert.ok(fakeLimiterCall(limiter, a).passed);
    assert.ok(fakeLimiterCall(limiter, a).passed);
    const third = fakeLimiterCall(limiter, a);
    assert.equal(third.error.status, 429);
    assert.equal(third.headers["retry-after"], "10");
    assert.ok(fakeLimiterCall(limiter, b).passed, "other IPs unaffected");
    t.mock.timers.tick(4_000);
    assert.equal(fakeLimiterCall(limiter, a).headers["retry-after"], "6");
    t.mock.timers.tick(6_000);
    assert.ok(fakeLimiterCall(limiter, a).passed, "new window");
  } finally {
    limiter.stop();
  }

  const byEmail = rateLimit({ windowMs: 1000, max: 1, key: (req) => req.body && req.body.email });
  try {
    assert.ok(fakeLimiterCall(byEmail, { body: { email: "x" } }).passed);
    assert.equal(fakeLimiterCall(byEmail, { body: { email: "x" } }).error.code, "rate_limited");
    assert.ok(fakeLimiterCall(byEmail, { body: {} }).passed, "falsy key is not limited");
    assert.ok(fakeLimiterCall(byEmail, { body: {} }).passed);
  } finally {
    byEmail.stop();
  }
});

test("rate limiter bounds memory and validates options", async () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 1, maxKeys: 3 });
  try {
    for (const ip of ["a", "b", "c", "d"]) assert.ok(fakeLimiterCall(limiter, { ip }).passed);
    // "a" was evicted as the oldest window, so it gets a fresh one.
    assert.ok(fakeLimiterCall(limiter, { ip: "a" }).passed);
    assert.equal(fakeLimiterCall(limiter, { ip: "d" }).error.status, 429);
  } finally {
    limiter.stop();
  }
  assert.throws(() => rateLimit({ windowMs: 0, max: 1 }), TypeError);
  assert.throws(() => rateLimit({ windowMs: 1000, max: 0 }), TypeError);
  assert.throws(() => rateLimit({ windowMs: 1000, max: 1.5 }), TypeError);
  assert.throws(() => rateLimit({ windowMs: 1000, max: 1, key: "ip" }), TypeError);
});

// ---------------------------------------------------------------------------------------------
// Same-origin checks
// ---------------------------------------------------------------------------------------------

test("requireSameOrigin: own origin, public URL, missing Origin pass; others are 403", async () => {
  const ctx = setup({ PUBLIC_URL: "https://gode.example/" });
  const user = await ctx.auth.signup({ email: "a@example.com", password: PW });
  const cookie = `${SESSION_COOKIE}=${ctx.auth.createSession(user.id)}`;
  await withServer(ctx, {}, async ({ port }) => {
    const post = (headers) => request(port, "POST", "/api/me/echo", { headers: { cookie, ...headers }, body: {} });
    assert.equal((await post({ origin: `http://127.0.0.1:${port}` })).status, 200, "own origin");
    assert.equal((await post({ origin: `HTTP://127.0.0.1:${port}` })).status, 200, "case-insensitive scheme");
    assert.equal((await post({ origin: "https://gode.example" })).status, 200, "configured public URL");
    assert.equal((await post({ origin: "https://gode.example:443" })).status, 200, "default port normalised");
    assert.equal((await post({})).status, 200, "no Origin (non-browser client)");
    assert.equal((await post({ "sec-fetch-site": "same-origin" })).status, 200);

    for (const origin of ["https://evil.example", `http://127.0.0.1:${port + 1}`, `https://127.0.0.1:${port}`, "null", "garbage", "https://gode.example.evil.com", "https://gode.example, https://evil.example"]) {
      const res = await post({ origin });
      assert.equal(res.status, 403, origin);
      assert.equal(res.json.code, "forbidden");
    }
    assert.equal((await post({ "sec-fetch-site": "cross-site" })).status, 403, "Fetch Metadata without Origin");
    assert.equal((await post({ "sec-fetch-site": "same-site" })).status, 403);

    // Safe methods are never blocked; the webhook (mounted before) is never blocked.
    assert.equal((await request(port, "GET", "/api/me", { headers: { cookie, origin: "https://evil.example" } })).status, 200);
    assert.equal((await request(port, "POST", "/api/billing/webhook", { headers: { origin: "https://evil.example" }, body: {} })).status, 200);
    // Blocked before the route runs: no signup happens from a foreign origin.
    const signup = await request(port, "POST", "/api/auth/signup", {
      headers: { origin: "https://evil.example" },
      body: { email: "csrf@example.com", password: PW },
    });
    assert.equal(signup.status, 403);
    assert.equal(ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'csrf@example.com'").get().n, 0);
  });
});

test("requireSameOrigin honours X-Forwarded-* only when TRUST_PROXY is on", async () => {
  const forwarded = { host: "10.0.0.5:3000", "x-forwarded-proto": "https", "x-forwarded-host": "app.gode.test", origin: "https://app.gode.test" };

  const trusted = setup({ TRUST_PROXY: "1", PUBLIC_URL: "https://other.example" });
  await withServer(trusted, {}, async ({ port }) => {
    assert.equal((await request(port, "POST", "/api/auth/logout", { headers: forwarded })).status, 200);
    const multi = { ...forwarded, "x-forwarded-proto": "https, http", "x-forwarded-host": "app.gode.test, internal:3000" };
    assert.equal((await request(port, "POST", "/api/auth/logout", { headers: multi })).status, 200, "first hop value");
    const spoof = { ...forwarded, origin: "https://evil.example" };
    assert.equal((await request(port, "POST", "/api/auth/logout", { headers: spoof })).status, 403);
  });

  const untrusted = setup({ TRUST_PROXY: "0", PUBLIC_URL: "https://other.example" });
  await withServer(untrusted, {}, async ({ port }) => {
    assert.equal((await request(port, "POST", "/api/auth/logout", { headers: forwarded })).status, 403, "forwarded headers ignored");
    const direct = { host: "10.0.0.5:3000", origin: "http://10.0.0.5:3000" };
    assert.equal((await request(port, "POST", "/api/auth/logout", { headers: direct })).status, 200, "Host header used");
  });
});

test("requireSameOrigin works as a plain middleware and as a factory", async () => {
  const ctx = setup({ TRUST_PROXY: "1", PUBLIC_URL: "https://pub.example" });
  const fwd = { host: "internal:1", "x-forwarded-proto": "https", "x-forwarded-host": "front.example", origin: "https://front.example" };

  // Plain middleware reading app.locals.config.
  const withLocals = buildApp(ctx, { sameOrigin: requireSameOrigin });
  withLocals.app.locals.config = ctx.config;
  let srv = await listen(withLocals.app);
  try {
    assert.equal((await request(srv.port, "POST", "/api/auth/logout", { headers: fwd })).status, 200);
    assert.equal((await request(srv.port, "POST", "/api/auth/logout", { headers: { origin: "https://pub.example" } })).status, 200);
    assert.equal((await request(srv.port, "POST", "/api/auth/logout", { headers: { origin: "https://evil.example" } })).status, 403);
  } finally {
    withLocals.limiter.stop();
    await srv.close();
  }

  // Plain middleware without locals: falls back to express 'trust proxy'.
  const bare = buildApp(ctx, { sameOrigin: requireSameOrigin });
  srv = await listen(bare.app);
  try {
    assert.equal((await request(srv.port, "POST", "/api/auth/logout", { headers: fwd })).status, 403);
    bare.app.set("trust proxy", 1);
    assert.equal((await request(srv.port, "POST", "/api/auth/logout", { headers: fwd })).status, 200);
  } finally {
    bare.limiter.stop();
    await srv.close();
  }

  // Factory form.
  const factory = buildApp(ctx, { sameOrigin: requireSameOrigin({ trustProxy: false, publicUrl: "https://pub.example" }) });
  srv = await listen(factory.app);
  try {
    assert.equal((await request(srv.port, "POST", "/api/auth/logout", { headers: fwd })).status, 403);
    assert.equal((await request(srv.port, "POST", "/api/auth/logout", { headers: { origin: "https://pub.example" } })).status, 200);
  } finally {
    factory.limiter.stop();
    await srv.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------------------------

// With the media proxy on (the default), media loads from our own origin only: the browser never
// contacts a media host, which would learn the user's IP address.
const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com";

test("CSP: media hosts are allowed only when the media proxy is off", () => {
  assert.equal(cspFor(loadConfig({ GODE_MOCK: "1" })), EXPECTED_CSP);
  assert.equal(CSP, EXPECTED_CSP, "the exported default is the strict one");
  const off = cspFor(loadConfig({ GODE_MOCK: "1", MEDIA_PROXY: "0" }));
  assert.match(off, /img-src 'self' data: blob: https:;/);
  assert.match(off, /media-src 'self' data: blob: https:;/);
});

test("CSP allows only same-origin scripts: no eval, no inline script", async () => {
  const app = express();
  app.use(securityHeaders({ production: false }));
  app.get("/", (req, res) => res.send("ok"));
  const srv = await listen(app);
  try {
    const csp = (await request(srv.port, "GET", "/")).headers["content-security-policy"];
    assert.equal(csp.split("; ").find((d) => d.startsWith("script-src ")), "script-src 'self'");
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.doesNotMatch(csp.split("; ").find((d) => d.startsWith("script-src ")), /unsafe-inline/);
  } finally {
    await srv.close();
  }
});

test("security headers on every response; HSTS only in production", async () => {
  const dev = setup();
  await withServer(dev, {}, async ({ port }) => {
    const notFound = await request(port, "GET", "/nope");
    assert.equal(notFound.status, 404);
    for (const res of [await request(port, "GET", "/api/me"), notFound]) {
      assert.equal(res.headers["content-security-policy"], EXPECTED_CSP);
      assert.equal(res.headers["x-content-type-options"], "nosniff");
      assert.equal(res.headers["x-frame-options"], "DENY");
      assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
      assert.match(res.headers["permissions-policy"], /camera=\(\)/);
      assert.match(res.headers["permissions-policy"], /microphone=\(\)/);
      assert.match(res.headers["permissions-policy"], /geolocation=\(\)/);
      assert.equal(res.headers["strict-transport-security"], undefined);
      assert.equal(res.headers["x-powered-by"], undefined);
    }
  });

  const prod = setup({ NODE_ENV: "production" });
  await withServer(prod, {}, async ({ port }) => {
    const res = await request(port, "GET", "/api/me");
    assert.match(res.headers["strict-transport-security"], /^max-age=\d{7,}/);
  });
});

test("securityHeaders tolerates being mounted without calling it", async () => {
  const app = express();
  app.use(securityHeaders); // a common slip: must not hang the request
  app.locals.config = { production: true };
  app.get("/", (req, res) => res.send("ok"));
  const srv = await listen(app);
  try {
    const res = await request(srv.port, "GET", "/");
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-security-policy"], EXPECTED_CSP);
    assert.ok(res.headers["strict-transport-security"]);
  } finally {
    await srv.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Delete everything
// ---------------------------------------------------------------------------------------------

function seedUserData(db, keyring, user) {
  const t = now();
  const convId = newId();
  db.prepare("INSERT INTO conversations (id, user_id, title_enc, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    convId,
    user.id,
    keyring.encrypt(user.wrapped_dek, "Secret title"),
    t,
    t
  );
  const userMsg = newId();
  const asstMsg = newId();
  const reqId = newId();
  const insertMsg = db.prepare(
    "INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertMsg.run(userMsg, convId, user.id, "user", keyring.encrypt(user.wrapped_dek, { text: "hi" }, { json: true }), null, null, t);
  insertMsg.run(asstMsg, convId, user.id, "assistant", keyring.encrypt(user.wrapped_dek, { text: "hello" }, { json: true }), userMsg, reqId, t);
  db.prepare("INSERT INTO requests (id, user_id, conversation_id, message_id, kind, job, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    reqId,
    user.id,
    convId,
    asstMsg,
    "auto",
    "chat",
    t
  );
  const holdId = newId();
  db.prepare("INSERT INTO holds (id, user_id, amount_micros, created_at) VALUES (?, ?, ?, ?)").run(holdId, user.id, 1000, t);
  db.prepare("INSERT INTO ledger (user_id, delta_micros, kind, ref, created_at) VALUES (?, ?, ?, ?, ?)").run(user.id, -1000, "hold", holdId, t);
  db.prepare("INSERT INTO ledger (user_id, delta_micros, kind, ref, created_at) VALUES (?, ?, ?, ?, ?)").run(user.id, 5_000_000, "purchase", "cs_" + newId(), t);
  return { convId };
}

function countFor(db, table, userId) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(userId).n;
}

test("deleteEverything removes the user's data, unlinks the ledger and forgets the DEK", async () => {
  const { auth, db, keyring, forgotten } = setup();
  const victim = await auth.signup({ email: "gone@example.com", password: PW });
  const keeper = await auth.signup({ email: "stay@example.com", password: PW });
  auth.createSession(victim.id);
  auth.createSession(victim.id);
  const keeperToken = auth.createSession(keeper.id);
  seedUserData(db, keyring, victim);
  seedUserData(db, keyring, keeper);
  const ledgerTotal = db.prepare("SELECT COUNT(*) AS n, SUM(delta_micros) AS s FROM ledger").get();

  const counts = auth.deleteEverything(victim.id);
  assert.deepEqual(counts, {
    ledger_unlinked: 3, // signup bonus + hold + purchase
    messages: 2,
    conversations: 1,
    requests: 1,
    holds: 1,
    sessions: 2,
    users: 1,
  });

  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE id = ?").get(victim.id).n, 0);
  for (const table of ["sessions", "conversations", "messages", "requests", "holds", "ledger"]) {
    assert.equal(countFor(db, table, victim.id), 0, table);
  }
  // The books still balance: rows stay, only the link to the person is gone.
  const after = db.prepare("SELECT COUNT(*) AS n, SUM(delta_micros) AS s FROM ledger").get();
  assert.deepEqual({ ...after }, { ...ledgerTotal });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE user_id IS NULL").get().n, 3);
  assert.deepEqual(forgotten, [victim.wrapped_dek]);

  // The other user is untouched.
  for (const table of ["conversations", "messages", "requests", "holds"]) assert.equal(countFor(db, table, keeper.id), table === "messages" ? 2 : 1, table);
  assert.equal(countFor(db, "ledger", keeper.id), 3);
  assert.equal(auth.userFromToken(keeperToken).id, keeper.id);
  await assert.rejects(() => auth.login({ email: "gone@example.com", password: PW }), (e) => e.status === 401);
});

test("deleteEverything on an unknown user is 404 and changes nothing", async () => {
  const { auth, db, forgotten } = setup();
  await auth.signup({ email: "a@example.com", password: PW });
  assert.throws(() => auth.deleteEverything("nope"), (e) => e instanceof AppError && e.status === 404 && e.code === "not_found");
  assert.throws(() => auth.deleteEverything(""), (e) => e instanceof AppError && e.status === 400);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 1);
  assert.deepEqual(forgotten, []);
});

test("deleteEverything is atomic: a failure mid-way rolls back and keeps the key", async () => {
  const { auth, db, keyring, forgotten } = setup();
  const user = await auth.signup({ email: "a@example.com", password: PW });
  seedUserData(db, keyring, user);
  // A trigger that fails the final DELETE simulates a crash after the child rows are gone.
  db.exec("CREATE TRIGGER block_user_delete BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT, 'blocked'); END;");
  assert.throws(() => auth.deleteEverything(user.id), /blocked/);
  assert.equal(countFor(db, "conversations", user.id), 1);
  assert.equal(countFor(db, "messages", user.id), 2);
  assert.equal(countFor(db, "ledger", user.id), 3);
  assert.deepEqual(forgotten, []);
});

test("deleteEverything over HTTP-style flow: the session cookie stops working", async () => {
  const ctx = setup();
  const user = await ctx.auth.signup({ email: "a@example.com", password: PW });
  const token = ctx.auth.createSession(user.id);
  ctx.auth.deleteEverything(user.id);
  assert.equal(ctx.auth.userFromToken(token), null);
  // Re-signup with the same email is allowed after deletion.
  const again = await ctx.auth.signup({ email: "a@example.com", password: PW });
  assert.notEqual(again.id, user.id);
});

test("a stored hash from another code path still verifies (password_hash compatibility)", async () => {
  const { auth, db, keyring } = setup();
  db.prepare("INSERT INTO users (id, email, password_hash, wrapped_dek, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "legacy",
    "legacy@example.com",
    await hashPassword("legacy-password"),
    keyring.newWrappedDek(),
    now()
  );
  assert.equal((await auth.login({ email: "legacy@example.com", password: "legacy-password" })).id, "legacy");
});

// ---------------------------------------------------------------------------------------------
// Client networks and failure-only counting
// ---------------------------------------------------------------------------------------------

test("ipPrefix: IPv4 as is, IPv4-mapped IPv6 as IPv4, IPv6 by its /64", () => {
  assert.equal(ipPrefix("203.0.113.7"), "203.0.113.7");
  assert.equal(ipPrefix("::ffff:203.0.113.7"), "203.0.113.7");
  const a = ipPrefix("2001:db8:1:2::5");
  assert.equal(a, "2001:0db8:0001:0002::/64");
  assert.equal(ipPrefix("2001:0db8:0001:0002:ffff:eeee:dddd:cccc"), a, "same /64, same key");
  assert.equal(ipPrefix("[2001:db8:1:2::9]"), a);
  assert.notEqual(ipPrefix("2001:db8:1:3::5"), a, "another /64");
  assert.equal(ipPrefix("fe80::1%eth0"), "fe80:0000:0000:0000::/64");
  assert.equal(ipPrefix("64:ff9b::192.0.2.1"), "0064:ff9b:0000:0000::/64");
  assert.equal(ipPrefix(""), null);
});

test("rate limiter: IPv6 clients in one /64 share a bucket; peek/hit count only what the route says", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2 });
  try {
    assert.ok(fakeLimiterCall(limiter, { ip: "2001:db8:9::1" }).passed);
    assert.ok(fakeLimiterCall(limiter, { ip: "2001:db8:9::2" }).passed);
    assert.equal(fakeLimiterCall(limiter, { ip: "2001:db8:9:0:abcd::3" }).error.status, 429, "rotating inside the /64 does not help");
    assert.ok(fakeLimiterCall(limiter, { ip: "2001:db8:a::1" }).passed, "another /64 is another client");
    assert.equal(limiter.peek("k"), 0);
    limiter.hit("k");
    assert.equal(limiter.peek("k"), 0, "under the limit");
    limiter.hit("k");
    assert.ok(limiter.peek("k") >= 1, "at the limit: blocked, with seconds to wait");
    assert.equal(limiter.peek(null), 0);
  } finally {
    limiter.stop();
  }
});

test("deleteEverything on a file database leaves no wrapped DEK or ciphertext in gode.db or its WAL", async () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gode-shred-"));
  const file = path.join(dir, "gode.db");
  const db = openDb(file);
  try {
    const config = loadConfig({ GODE_MOCK: "1", SIGNUP_CREDIT_USD: "0" });
    const keyring = createKeyring(crypto.randomBytes(32));
    const auth = createAuth({ db, config, keyring });
    const victim = await auth.signup({ email: "gone@example.com", password: PW });
    const keeper = await auth.signup({ email: "stay@example.com", password: PW });
    seedUserData(db, keyring, victim);
    seedUserData(db, keyring, keeper);
    const victimRow = db.prepare("SELECT wrapped_dek FROM users WHERE id = ?").get(victim.id);
    const sealed = db.prepare("SELECT content_enc FROM messages WHERE user_id = ?").all(victim.id).map((r) => r.content_enc);
    const needles = [victimRow.wrapped_dek, ...sealed, "gone@example.com"].map((s) => s.slice(0, 40));
    const onDisk = () => ["gode.db", "gode.db-wal"].map((f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f)).toString("latin1") : "")).join("\n");
    assert.ok(needles.every((n) => onDisk().includes(n)), "the bytes are there before the delete");

    auth.deleteEverything(victim.id);
    const after = onDisk();
    for (const n of needles) assert.ok(!after.includes(n), `left on disk: ${n.slice(0, 12)}...`);
    // The other account is intact and still decrypts.
    const keep = db.prepare("SELECT content_enc FROM messages WHERE user_id = ?").get(keeper.id);
    assert.deepEqual(keyring.decrypt(keeper.wrapped_dek, keep.content_enc, { json: true }), { text: "hi" });
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
