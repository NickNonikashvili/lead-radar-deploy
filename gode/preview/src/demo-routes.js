"use strict";
// Preview-only: the way back to the demo account. Delete everything really deletes it (the real
// auth.deleteAccount, kept across reloads like any other change), and a viewer exploring the
// preview would otherwise be stuck with ordinary accounts and no Admin page. So signing in with
// the demo's own credentials (demo@example.com / preview-demo) when that account no longer exists
// makes it again first: the seeded chats, its credit and its admin flag (preview/src/seed.js
// restoreDemo). Then the real route answers. A sign-up with those credentials signs in to the
// restored demo (the real sign-up would only make an ordinary account). The auth screen says so
// (preview/src/page-notes.js).
//
// Mounted before src/routes/auth.js. Every other request, and every request with other
// credentials, goes on untouched.

const express = require("express");
const { normalizeEmail } = require("../../src/auth");

/**
 * @param {object} opts
 * @param {{ email: string, password: string }} opts.demo
 * @param {() => boolean} opts.missing     true when no account has the demo's email
 * @param {() => Promise<void>} opts.restore  makes the demo account again (one at a time)
 * @param {() => boolean} [opts.restoring]    true while a restore runs (a second click waits for it)
 */
function createDemoRoutes({ demo, missing, restore, restoring = () => false }) {
  const router = express.Router();
  const isDemo = (body) => Boolean(body) && normalizeEmail(body.email) === demo.email && body.password === demo.password;

  function bringBack(rewriteTo) {
    return (req, res, next) => {
      if (!isDemo(req.body) || !(missing() || restoring())) return next();
      restore().then(
        () => {
          if (rewriteTo) {
            // The account exists now: the real login route signs the viewer in to it.
            req.path = rewriteTo;
            req.url = rewriteTo;
            req.originalUrl = "/api" + rewriteTo;
          }
          next();
        },
        (err) => next(err)
      );
    };
  }

  router.post("/auth/login", bringBack(null));
  router.post("/auth/signup", bringBack("/auth/login"));
  return router;
}

module.exports = { createDemoRoutes };
