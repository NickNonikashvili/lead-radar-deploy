// POST /api/auth/signup, /api/auth/login, /api/auth/logout.
//
// Limits (built in src/app.js, keyed by client network: IPv4 address or IPv6 /64):
//   auth             every sign-up and log-in request, per network
//   signup           new accounts per network per day (a sign-up for an existing address counts
//                    too, so the 409 can't be used to check many addresses)
//   authEmail        FAILED log-ins per email + network
//   authEmailGlobal  FAILED log-ins per email from anywhere (a much higher ceiling)
//   authEmailGroup   marks a network group (IPv4 /24, IPv6 /48) that failed for an email
//   authEmailGroups  distinct failing network groups per email
// Only failures count against an email. Past the global ceiling the account is "under attack":
// a log-in is still checked from a network group with no failure for this email in the window
// (so the owner's right password from their own network works), while a group that failed is
// refused until the window ends, which leaves an attacker one guess per group per hour. Only
// when failures come from more groups than authEmailGroups allows (a botnet) is every log-in for
// the email refused. A network's own failures (authEmail) are refused on that network only.
//
// Attempts are counted BEFORE the awaited scrypt and taken back when they turn out not to count,
// so concurrent requests can't all slip under a limit together.
//
// Email enumeration: signup answers 409 for an address that has an account. Without email
// verification (not in phase 1) the answer can't be made identical, because signup signs the
// user in. The per-network daily signup limit bounds how many addresses one client can check.
const express = require("express");
const { publicUser, ipKey, ipGroupKey } = require("../auth");
const { AppError, ah, microsToUsd } = require("../util");
const { bodyObject, onlyKeys, stringField } = require("./validate");

/**
 * @param {object} ctx  app context (see src/app.js): auth, limiters
 */
function createAuthRoutes({ auth, limiters }) {
  const router = express.Router();

  // Types only: auth.signup/login own the format rules (email shape, password length) and their
  // messages. The password is never trimmed.
  function credentials(req) {
    const body = bodyObject(req);
    onlyKeys(body, ["email", "password"]);
    return {
      email: stringField(body.email, "email", { required: true, max: 320 }),
      password: stringField(body.password, "password", { required: true, trim: false, max: 1000 }),
    };
  }

  function startSession(res, user) {
    auth.setCookie(res, auth.createSession(user.id));
  }

  function tooMany(res, seconds, message) {
    res.setHeader("Retry-After", String(seconds));
    return new AppError(429, "rate_limited", message);
  }

  /** [limiter, key] pairs of this login attempt's failure buckets (missing limiters are null). */
  function loginBuckets(req, email) {
    const e = String(email || "").trim().toLowerCase().slice(0, 320);
    const pair = (limiter, key) => (e && limiter ? [limiter, key] : null);
    return {
      network: pair(limiters.authEmail, `email:${e}|${ipKey(req)}`),
      global: pair(limiters.authEmailGlobal, `email:${e}`),
      group: pair(limiters.authEmailGroup, `email:${e}|${ipGroupKey(req)}`),
      groups: pair(limiters.authEmailGroups, `email:${e}`),
    };
  }

  const peek = (pair) => (pair ? pair[0].peek(pair[1]) : 0);

  router.post(
    "/auth/signup",
    limiters.auth,
    ah(async (req, res) => {
      const creds = credentials(req);
      const network = ipKey(req);
      const wait = limiters.signup ? limiters.signup.peek(network) : 0;
      if (wait) throw tooMany(res, wait, "Too many new accounts from your network today. Try again tomorrow.");
      // Counted before the awaited hash, so concurrent sign-ups from one network see each other.
      // A 409 keeps the count (it tells whether an address has an account); a sign-up refused for
      // its input or for load gives it back.
      limiters.signup?.hit(network);
      let user;
      try {
        user = await auth.signup(creds);
      } catch (err) {
        if (!(err instanceof AppError && err.code === "conflict")) limiters.signup?.undo(network);
        throw err;
      }
      startSession(res, user);
      res.status(201).json({ user: publicUser(user), signup_bonus_usd: microsToUsd(user.signupBonusMicros || 0) });
    })
  );

  router.post(
    "/auth/login",
    limiters.auth,
    ah(async (req, res) => {
      const creds = credentials(req);
      const b = loginBuckets(req, creds.email);
      // Checked before scrypt runs: a refused attempt costs no hashing.
      let wait = Math.max(peek(b.network), peek(b.groups));
      // Under attack: only network groups that have not failed for this email may still try.
      if (!wait && peek(b.global) && peek(b.group)) wait = Math.max(peek(b.global), peek(b.group));
      if (wait) throw tooMany(res, wait, `Too many wrong passwords for this account. Try again in ${wait} s.`);

      // Counted as a failure up front and taken back unless the password turns out wrong.
      const counted = [];
      const hit = (pair) => {
        if (!pair) return;
        pair[0].hit(pair[1]);
        counted.push(pair);
      };
      hit(b.network);
      hit(b.global);
      // The group's first failure in the window adds one distinct failing group.
      if (b.group && !peek(b.group)) {
        hit(b.group);
        hit(b.groups);
      }
      const takeBack = () => {
        for (const [limiter, key] of counted) limiter.undo(key);
      };
      let user;
      try {
        user = await auth.login(creds);
      } catch (err) {
        if (!(err instanceof AppError && err.status === 401)) takeBack();
        throw err;
      }
      takeBack();
      // The right password from this group: an earlier typo here no longer marks it as failing.
      if (b.group) b.group[0].clear(b.group[1]);
      startSession(res, user);
      res.json({ user: publicUser(user) });
    })
  );

  // Idempotent: logging out without a session still clears the cookie.
  router.post("/auth/logout", (req, res) => {
    auth.logout(req, res);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAuthRoutes };
