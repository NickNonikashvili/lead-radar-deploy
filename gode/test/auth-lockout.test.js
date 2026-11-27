// Failed-login and signup limits under attack (src/routes/auth.js): a stranger spreading wrong
// guesses over many networks can't lock the owner out, and concurrent requests can't all slip
// under a limit before any of them is counted.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { createTestApp } = require("./helpers/app");
const { rateLimit } = require("../src/auth");

const PASSWORD = "the-owners-passphrase";
const from = (ip) => ({ headers: { "X-Forwarded-For": ip } });

async function withApp(rateLimits, fn, env = {}) {
  const t = await createTestApp({ TRUST_PROXY: "1", SIGNUP_CREDIT_USD: "0.25", ...env }, { rateLimits });
  try {
    return await fn(t);
  } finally {
    await t.close();
  }
}

async function login(t, email, password, ip) {
  return t.client().json("POST", "/api/auth/login", { email, password }, from(ip));
}

test("default limits: 100 failures from ten IPv6 /64s don't stop the owner's right password from their own network", async () => {
  await withApp(undefined, async (t) => {
    await t.client().json("POST", "/api/auth/signup", { email: "owner@example.test", password: PASSWORD }, from("198.51.100.7"));
    let failures = 0;
    // Each /64 stays under its own limits (auth 20 / 15 min, authEmail 10 / 15 min).
    for (let n = 0; n < 10; n++) {
      for (let i = 0; i < 10; i++) {
        const r = await login(t, "owner@example.test", `wrong-guess-${i}`, `2001:db8:0:${n.toString(16)}::1`);
        if (r.status === 401) failures++;
      }
    }
    assert.equal(failures, 100, "every guess was checked");
    const owner = await login(t, "owner@example.test", PASSWORD, "198.51.100.7");
    assert.equal(owner.status, 200, owner.text);
    // The attacking /48 failed while the account was under attack: another /64 of it gets nothing.
    const more = await login(t, "owner@example.test", "wrong-guess-x", "2001:db8:0:ff::1");
    assert.equal(more.status, 429);
  });
});

test("default limits: 110 failures from eleven IPv4 networks, then the owner logs in from a clean network", async () => {
  await withApp(undefined, async (t) => {
    await t.client().signup("victim@example.test", PASSWORD);
    for (let n = 0; n < 11; n++) {
      for (let i = 0; i < 10; i++) await login(t, "victim@example.test", `nope-${i}`, `203.0.${n}.10`);
    }
    assert.equal((await login(t, "victim@example.test", PASSWORD, "192.0.2.44")).status, 200);
    // A fresh attacker group gets one checked guess, then it is refused too.
    assert.equal((await login(t, "victim@example.test", "nope", "198.18.0.1")).status, 401);
    assert.equal((await login(t, "victim@example.test", PASSWORD, "198.18.0.2")).status, 429, "that group failed while under attack");
  });
});

test("the owner's own typo is forgiven by a successful login, so a later attack doesn't lock their network", async () => {
  await withApp({ auth: { max: 1000 }, authEmailGlobal: { max: 5 } }, async (t) => {
    await t.client().signup("typo@example.test", PASSWORD);
    assert.equal((await login(t, "typo@example.test", "typo-typo", "192.0.2.10")).status, 401);
    assert.equal((await login(t, "typo@example.test", PASSWORD, "192.0.2.10")).status, 200);
    for (let i = 0; i < 6; i++) await login(t, "typo@example.test", "guess", `198.51.${i}.1`);
    assert.equal((await login(t, "typo@example.test", PASSWORD, "192.0.2.10")).status, 200);
  });
});

test("failures from more network groups than authEmailGroups allows (a botnet) refuse every login for the email", async () => {
  await withApp({ auth: { max: 1000 }, authEmailGlobal: { max: 3 }, authEmailGroups: { max: 4 } }, async (t) => {
    await t.client().signup("big@example.test", PASSWORD);
    for (let i = 0; i < 4; i++) assert.equal((await login(t, "big@example.test", "guess", `10.${i}.0.1`)).status, 401);
    const owner = await login(t, "big@example.test", PASSWORD, "192.0.2.99");
    assert.equal(owner.status, 429);
    assert.match(owner.body.error, /Too many wrong passwords/);
    // Other accounts are not affected.
    await t.client().signup("other@example.test", PASSWORD);
    assert.equal((await login(t, "other@example.test", PASSWORD, "10.0.0.1")).status, 200);
  });
});

test("concurrent wrong passwords from one network count before scrypt: at most 10 are checked", async () => {
  await withApp(undefined, async (t) => {
    await t.client().signup("race@example.test", PASSWORD);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => login(t, "race@example.test", `wrong-${i}`, "192.0.2.77")));
    const checked = results.filter((r) => r.status === 401).length;
    const refused = results.filter((r) => r.status === 429).length;
    assert.equal(checked, 10, `401s: ${checked}`);
    assert.equal(refused, 10);
  });
});

test("concurrent sign-ups from one network count before the hash: at most the daily limit get accounts and bonuses", async () => {
  await withApp(undefined, async (t) => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => t.client().json("POST", "/api/auth/signup", { email: `bulk${i}@example.test`, password: `a-long-passphrase-${i}` }, from("192.0.2.5")))
    );
    assert.equal(results.filter((r) => r.status === 201).length, 10);
    assert.equal(results.filter((r) => r.status === 429).length, 10);
    assert.equal(t.deps.db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE kind = 'signup_bonus'").get().n, 10);
  });
});

test("a sign-up refused for its input gives its count back; a 409 keeps it", async () => {
  await withApp({ auth: { max: 1000 }, signup: { max: 2 } }, async (t) => {
    const signup = (email, password) => t.client().json("POST", "/api/auth/signup", { email, password }, from("192.0.2.8"));
    for (let i = 0; i < 5; i++) assert.equal((await signup(`x${i}@example.test`, "short")).status, 400);
    assert.equal((await signup("one@example.test", PASSWORD)).status, 201);
    assert.equal((await signup("one@example.test", PASSWORD)).status, 409);
    assert.equal((await signup("two@example.test", PASSWORD)).status, 429);
  });
});

test("rateLimit undo and clear", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2 });
  try {
    limiter.hit("k");
    limiter.hit("k");
    assert.ok(limiter.peek("k") > 0);
    limiter.undo("k");
    assert.equal(limiter.peek("k"), 0);
    limiter.undo("k");
    limiter.undo("k"); // never below zero
    limiter.hit("k");
    assert.equal(limiter.peek("k"), 0, "one hit after undoing to zero");
    limiter.hit("k");
    assert.ok(limiter.peek("k") > 0);
    limiter.clear("k");
    assert.equal(limiter.peek("k"), 0);
    limiter.undo("never-seen"); // a no-op
  } finally {
    limiter.stop();
  }
});
