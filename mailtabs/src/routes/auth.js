'use strict';

const express = require('express');
const { HttpError } = require('../errors');
const { hashPassword, verifyPassword } = require('../crypto');
const { asyncHandler, requireAuth, rateLimit, createSession, destroySession } = require('../middleware');

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 1024; // scrypt is cheap on long inputs, but there is no reason to accept megabytes
const MAX_EMAIL = 254;
const MAX_NAME = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;

// A real scrypt hash of a random password, used to spend the same time on unknown emails as on
// wrong passwords so login timing does not reveal which addresses have accounts.
let dummyHashPromise = null;
function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(`dummy-${Math.random()}-${Date.now()}`);
  return dummyHashPromise;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name ?? null };
}

function validateNewPassword(password, field = 'Password') {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new HttpError(400, `${field} must be at least ${MIN_PASSWORD} characters.`, 'WEAK_PASSWORD');
  }
  if (password.length > MAX_PASSWORD) {
    throw new HttpError(400, `${field} is too long.`, 'WEAK_PASSWORD');
  }
}

function isUniqueViolation(err) {
  return err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT');
}

module.exports = function authRoutes({ db, config }) {
  const router = express.Router();
  dummyHash(); // start computing now so the first unknown-email login is not measurably faster/slower

  const countUsers = db.prepare('SELECT COUNT(*) AS n FROM users');
  const findUserByEmail = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?');
  const findUserById = db.prepare('SELECT id, email, name, password_hash FROM users WHERE id = ?');
  const insertUser = db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)');
  const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  const deleteOtherSessions = db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?');

  // Separate windows for signup and login; both keyed per client IP + submitted email.
  const ipEmailKey = (prefix) => (req) => `${prefix}|${req.ip}|${normalizeEmail(req.body && req.body.email)}`;
  const signupLimiter = rateLimit({ windowMs: RATE_WINDOW_MS, max: RATE_MAX, key: ipEmailKey('signup') });
  const loginLimiter = rateLimit({ windowMs: RATE_WINDOW_MS, max: RATE_MAX, key: ipEmailKey('login') });
  // Changing the password needs the current one, so brute-forcing it from a stolen session is limited too.
  const passwordLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS,
    max: RATE_MAX,
    key: (req) => `password|${req.user ? req.user.id : req.ip}`,
  });

  // Signups are open when the operator allows them, and always for the very first user.
  const signupsOpen = () => config.allowSignups || countUsers.get().n === 0;

  router.post(
    '/signup',
    signupLimiter,
    asyncHandler(async (req, res) => {
      if (!signupsOpen()) {
        throw new HttpError(403, 'New sign-ups are disabled on this server.', 'SIGNUPS_DISABLED');
      }
      const body = req.body || {};
      const email = normalizeEmail(body.email);
      if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
        throw new HttpError(400, 'Please enter a valid email address.', 'INVALID_EMAIL');
      }
      validateNewPassword(body.password);
      if (body.name !== undefined && body.name !== null && typeof body.name !== 'string') {
        throw new HttpError(400, 'Name must be text.', 'INVALID_NAME');
      }
      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, MAX_NAME) : null;

      if (findUserByEmail.get(email)) {
        throw new HttpError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
      }

      const passwordHash = await hashPassword(body.password);

      // Re-check inside a transaction: hashing is async, so another signup may have landed meanwhile.
      let userId;
      try {
        userId = db.transaction(() => {
          if (!signupsOpen()) {
            throw new HttpError(403, 'New sign-ups are disabled on this server.', 'SIGNUPS_DISABLED');
          }
          return Number(insertUser.run(email, name, passwordHash, Date.now()).lastInsertRowid);
        })();
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new HttpError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
        }
        throw err;
      }

      createSession(db, config, res, userId);
      res.status(201).json({ user: publicUser({ id: userId, email, name }) });
    })
  );

  router.post(
    '/login',
    loginLimiter,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const email = normalizeEmail(body.email);
      const password = body.password;
      if (!email || typeof password !== 'string' || !password) {
        throw new HttpError(400, 'Email and password are required.', 'VALIDATION');
      }

      const user = email.length <= MAX_EMAIL ? findUserByEmail.get(email) : undefined;
      // Always run exactly one scrypt verification so both failure paths take the same time.
      const ok = user
        ? await verifyPassword(password, user.password_hash)
        : (await verifyPassword(password, await dummyHash()), false);
      if (!ok) {
        throw new HttpError(401, 'Wrong email or password.', 'INVALID_CREDENTIALS');
      }

      loginLimiter.reset(req);
      createSession(db, config, res, user.id);
      res.json({ user: publicUser(user) });
    })
  );

  router.post('/logout', (req, res) => {
    destroySession(db, config, res, req.sessionId);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  router.post(
    '/password',
    requireAuth,
    passwordLimiter,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (typeof body.currentPassword !== 'string' || !body.currentPassword) {
        throw new HttpError(400, 'Please enter your current password.', 'VALIDATION');
      }
      validateNewPassword(body.newPassword, 'New password');

      const user = findUserById.get(req.user.id);
      if (!user) throw new HttpError(401, 'Not signed in', 'UNAUTHENTICATED');
      if (!(await verifyPassword(body.currentPassword, user.password_hash))) {
        throw new HttpError(400, 'Your current password is incorrect.', 'WRONG_PASSWORD');
      }

      const newHash = await hashPassword(body.newPassword);
      db.transaction(() => {
        updatePassword.run(newHash, user.id);
        // Sign out every other device; this one stays signed in.
        deleteOtherSessions.run(user.id, req.sessionId);
      })();
      passwordLimiter.reset(req);
      res.json({ ok: true });
    })
  );

  return router;
};

module.exports.MIN_PASSWORD = MIN_PASSWORD;
