// POST /api/auth/signup, /api/auth/login, /api/auth/logout.
//
// Limits (built in src/app.js, keyed by client network: IPv4 address or IPv6 /64):
//   auth             every sign-up and log-in request, per network
//   signup           new accounts per network per day (a sign-up for an existing address counts
//                    too, so the 409 can't be used to check many addresses)
//   authEmail        FAILED log-ins per email + network
//   authEmailGlobal  FAILED log-ins per email from anywhere (a much higher ceiling)
// Only failures count against an email, so a stranger's wrong guesses can't lock its owner out
// from another network, and the right password is never refused for someone else's mistakes.
//
// Email enumeration: signup answers 409 for an address that has an account. Without email
// verification (not in phase 1) the answer can't be made identical, because signup signs the
// user in. The per-network daily signup limit bounds how many addresses one client can check.
const express = require("express");
const { publicUser, ipKey } = require("../auth");
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

  /** [limiter, key] pairs that count a failed login for this email. */
  function failureKeys(req, email) {
    const e = String(email || "").trim().toLowerCase().slice(0, 320);
    if (!e) return [];
    return [
      [limiters.authEmail, `email:${e}|${ipKey(req)}`],
      [limiters.authEmailGlobal, `email:${e}`],
    ].filter(([limiter]) => limiter);
  }

  router.post(
    "/auth/signup",
    limiters.auth,
    ah(async (req, res) => {
      const creds = credentials(req);
      const network = ipKey(req);
      const wait = limiters.signup ? limiters.signup.peek(network) : 0;
      if (wait) throw tooMany(res, wait, "Too many new accounts from your network today. Try again tomorrow.");
      let user;
      try {
        user = await auth.signup(creds);
      } catch (err) {
        if (err instanceof AppError && err.code === "conflict") limiters.signup?.hit(network);
        throw err;
      }
      limiters.signup?.hit(network);
      startSession(res, user);
      res.status(201).json({ user: publicUser(user), signup_bonus_usd: microsToUsd(user.signupBonusMicros || 0) });
    })
  );

  router.post(
    "/auth/login",
    limiters.auth,
    ah(async (req, res) => {
      const creds = credentials(req);
      const keys = failureKeys(req, creds.email);
      // Checked before scrypt runs: a locked bucket costs no hashing.
      const wait = Math.max(0, ...keys.map(([limiter, key]) => limiter.peek(key)));
      if (wait) throw tooMany(res, wait, `Too many wrong passwords for this account. Try again in ${wait} s.`);
      let user;
      try {
        user = await auth.login(creds);
      } catch (err) {
        if (err instanceof AppError && err.status === 401) for (const [limiter, key] of keys) limiter.hit(key);
        throw err;
      }
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
