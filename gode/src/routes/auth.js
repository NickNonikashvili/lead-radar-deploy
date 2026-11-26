// POST /api/auth/signup, /api/auth/login, /api/auth/logout.
//
// Signup and login share two limiters (built in src/app.js): one per client IP, one per lower-cased
// email, so neither a single address nor a single account can be hammered.
const express = require("express");
const { publicUser } = require("../auth");
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

  router.post("/auth/signup", limiters.auth, limiters.authEmail, (req, res) => {
    const user = auth.signup(credentials(req));
    startSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  router.post("/auth/login", limiters.auth, limiters.authEmail, (req, res) => {
    const user = auth.login(credentials(req));
    startSession(res, user);
    res.json({ user: publicUser(user) });
  });

  // Idempotent: logging out without a session still clears the cookie.
  router.post("/auth/logout", (req, res) => {
    auth.logout(req, res);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAuthRoutes };
