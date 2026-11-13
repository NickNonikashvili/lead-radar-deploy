'use strict';

/**
 * /api/oauth/:provider/start and /callback — "Sign in with Google / Microsoft" for mail access.
 *
 * Both are full-page browser navigations, so problems are reported by redirecting to
 * `/?oauth=failed` and keeping the message server-side for that user; the frontend fetches it
 * once from GET /api/oauth/result. Messages are never put in the URL, so a crafted link can't
 * make Mailtabs display text of an attacker's choosing.
 *
 * The `state` parameter is a random, single-use token stored server-side together with the
 * PKCE verifier, the signed-in user, the provider and what to do afterwards. The callback only
 * acts on a state that exists, has not expired, was created for this provider and belongs to
 * the user whose session cookie came back with the redirect.
 */

const express = require('express');
const { randomToken, pkcePair } = require('../crypto');
const { oauthProviders } = require('../providers');
const oauth = require('../oauth');
const queries = require('../queries');

const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_STATES_PER_USER = 20;
const MAX_TAB_IDS = 100;
const MAX_ERROR_LENGTH = 300;

// Fixed texts for the provider's `error` parameter. The provider's own error_description is
// never shown: anyone can craft a callback link, so free text from the URL is not trusted.
const PROVIDER_ERRORS = {
  access_denied: 'Sign-in was cancelled, so no account was connected.',
  consent_required: 'Mail access was not granted, so no account was connected.',
  interaction_required: 'The sign-in could not be completed. Please try again.',
  login_required: 'The sign-in could not be completed. Please try again.',
  invalid_scope: 'The sign-in service refused the requested mail access.',
  unauthorized_client: 'This server is not allowed to use that sign-in service. Check the OAuth app settings.',
  server_error: 'The sign-in service had a problem. Please try again in a moment.',
  temporarily_unavailable: 'The sign-in service is temporarily unavailable. Please try again in a moment.',
};

const NO_REFRESH_TOKEN =
  "Mail access wasn't granted, so Mailtabs can't keep this inbox up to date. Please try again and allow access to your mail.";
const BAD_STATE = 'This sign-in link has expired or was already used. Please try again.';

const RESULT_TTL_MS = 5 * 60 * 1000;
const lastErrors = new Map(); // userId -> { message, expires }

function errorRedirect(req, res, message) {
  if (!req.user) return res.redirect(302, '/?oauth=signin');
  const now = Date.now();
  for (const [userId, entry] of lastErrors) if (entry.expires <= now) lastErrors.delete(userId);
  lastErrors.set(req.user.id, { message: String(message || 'Sign-in failed.').slice(0, MAX_ERROR_LENGTH), expires: now + RESULT_TTL_MS });
  res.redirect(302, '/?oauth=failed');
}

function scalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

/** "1,2,3" -> [1,2,3]; null when malformed. */
function parseIdCsv(value) {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string' || value.length > 2000) return null;
  const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > MAX_TAB_IDS || parts.some((p) => !/^\d{1,15}$/.test(p))) return null;
  const ids = [...new Set(parts.map(Number))];
  return ids.every((n) => Number.isSafeInteger(n) && n > 0) ? ids : null;
}

module.exports = function oauthRoutes({ db, config, crypto, syncManager }) {
  const router = express.Router();

  /** Outgoing-server columns for an OAuth account: null (the provider default) unless a test overrides it. */
  function outgoingServerFor(provider) {
    const override = config.oauthOverrides && config.oauthOverrides[provider.key];
    if (override && override.smtpHost && provider.smtpHost) {
      return { host: provider.smtpHost, port: provider.smtpPort || null, security: provider.smtpSecurity || null };
    }
    return { host: null, port: null, security: null };
  }

  const redirectUri = (provider) => oauth.redirectUriFor(config, provider.key);

  /** The provider for :provider, or null when unknown or not configured on this server. */
  function enabledProvider(key) {
    if (key !== 'google' && key !== 'microsoft') return null;
    const provider = oauthProviders(config)[key];
    return provider && provider.enabled ? provider : null;
  }

  function notConfigured(res) {
    res.status(404).json({ error: 'That sign-in provider is not configured on this server.', code: 'NOT_FOUND' });
  }

  const deleteExpired = db.prepare('DELETE FROM oauth_states WHERE expires_at <= ?');
  const takeState = db.prepare('DELETE FROM oauth_states WHERE state = ? RETURNING *');

  // --- result of the last failed sign-in (read once) -----------------------------------------

  router.get('/result', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in', code: 'UNAUTHENTICATED' });
    const entry = lastErrors.get(req.user.id);
    lastErrors.delete(req.user.id);
    res.json({ error: entry && entry.expires > Date.now() ? entry.message : null });
  });

  // --- start --------------------------------------------------------------------------------

  router.get('/:provider/start', (req, res) => {
    const provider = enabledProvider(req.params.provider);
    if (!provider) return notConfigured(res);
    if (!req.user) return res.redirect(302, '/?oauth=signin');
    const userId = req.user.id;

    // Reconnecting an existing account?
    let account = null;
    const rawAccountId = scalar(req.query.accountId);
    if (rawAccountId !== undefined && rawAccountId !== '') {
      const id = /^\d{1,15}$/.test(String(rawAccountId)) ? Number(rawAccountId) : 0;
      account = id ? queries.getAccountRowForUser(db, userId, id) : null;
      if (!account) return errorRedirect(req, res, 'That account was not found.');
      if (account.provider !== provider.presetKey) {
        return errorRedirect(req, res, `That account can't be connected with ${provider.label} sign-in.`);
      }
    }

    const tabIds = parseIdCsv(scalar(req.query.tabIds));
    if (tabIds === null) return errorRedirect(req, res, 'The selected tabs are not valid.');
    if (tabIds.length) {
      const owned = db
        .prepare(`SELECT id FROM tabs WHERE user_id = ? AND id IN (${tabIds.map(() => '?').join(', ')})`)
        .all(userId, ...tabIds);
      if (owned.length !== tabIds.length) return errorRedirect(req, res, 'One of the selected tabs no longer exists.');
    }

    const state = randomToken(32);
    const { verifier, challenge } = pkcePair();
    const now = Date.now();
    db.transaction(() => {
      deleteExpired.run(now);
      // Keep only the newest few unfinished sign-ins per user so the table cannot grow unbounded.
      db.prepare(
        `DELETE FROM oauth_states WHERE user_id = ? AND state NOT IN
           (SELECT state FROM oauth_states WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)`
      ).run(userId, userId, MAX_PENDING_STATES_PER_USER - 1);
      db.prepare(
        `INSERT INTO oauth_states (state, user_id, provider, code_verifier, account_id, tab_ids, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(state, userId, provider.key, verifier, account ? account.id : null, tabIds.length ? JSON.stringify(tabIds) : null, now, now + STATE_TTL_MS);
    })();

    const url = oauth.buildAuthUrl(provider, {
      state,
      codeChallenge: challenge,
      redirectUri: redirectUri(provider),
      loginHint: account ? account.email : undefined,
    });
    res.redirect(302, url);
  });

  // --- callback -----------------------------------------------------------------------------

  /** Insert or update the OAuth account for `email` and attach tabs. Returns the account id. */
  function upsertAccount(userId, provider, tokens, stateRow) {
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND email = ? COLLATE NOCASE').get(userId, tokens.email);

      // Google only sends a refresh token on first consent; keep the one we already have.
      let refreshToken = tokens.refreshToken;
      if (!refreshToken && existing && existing.auth_type === 'oauth') {
        try {
          refreshToken = (crypto.decryptJson(existing.secret_enc) || {}).refreshToken || null;
        } catch (_) {
          refreshToken = null;
        }
      }
      if (!refreshToken) {
        const err = new Error(NO_REFRESH_TOKEN);
        err.redirectMessage = NO_REFRESH_TOKEN;
        throw err;
      }
      // grantedScopes decides which scopes later refreshes ask for and whether the account may
      // send (Microsoft's SMTP.Send).
      const secretEnc = crypto.encryptJson({
        refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        ...(tokens.grantedScopes ? { grantedScopes: tokens.grantedScopes } : {}),
      });
      // OAuth accounts send through the provider's own server (smtp.js picks it). Only test
      // setups that point the provider elsewhere (OAUTH_TEST_ENDPOINTS) store one; a password
      // account converted to OAuth loses its own outgoing settings and SMTP password.
      const smtpCols = outgoingServerFor(provider);

      let accountId;
      if (existing) {
        // Reconnect, or convert a password account for the same address to OAuth.
        const mailboxChanged =
          String(existing.imap_host).toLowerCase() !== String(provider.imapHost).toLowerCase() ||
          String(existing.imap_user).toLowerCase() !== String(tokens.email).toLowerCase();
        db.prepare(
          `UPDATE accounts SET provider = ?, auth_type = 'oauth', email = ?, imap_host = ?, imap_port = ?, imap_security = ?,
                  imap_user = ?, secret_enc = ?, status = 'pending', last_error = NULL,
                  smtp_host = ?, smtp_port = ?, smtp_security = ?, smtp_user = NULL, smtp_secret_enc = NULL${
                    mailboxChanged ? ', sync_state = NULL, folders_synced_at = NULL, config_version = config_version + 1' : ''
                  }
            WHERE id = ? AND user_id = ?`
        ).run(
          provider.presetKey,
          tokens.email,
          provider.imapHost,
          provider.imapPort,
          provider.imapSecurity,
          tokens.email,
          secretEnc,
          smtpCols.host,
          smtpCols.port,
          smtpCols.security,
          existing.id,
          userId
        );
        if (mailboxChanged) {
          // A different mailbox: its folders (and their messages, by cascade) mean nothing here.
          db.prepare('DELETE FROM folders WHERE account_id = ?').run(existing.id);
          db.prepare('DELETE FROM messages WHERE account_id = ?').run(existing.id);
        }
        accountId = existing.id;
      } else {
        const info = db
          .prepare(
            `INSERT INTO accounts (user_id, provider, auth_type, email, display_name, color, imap_host, imap_port,
                                   imap_security, imap_user, secret_enc, mailbox, status, created_at, smtp_host, smtp_port, smtp_security)
             VALUES (?, ?, 'oauth', ?, NULL, ?, ?, ?, ?, ?, ?, 'INBOX', 'pending', ?, ?, ?, ?)`
          )
          .run(
            userId,
            provider.presetKey,
            tokens.email,
            queries.nextAccountColor(db, userId),
            provider.imapHost,
            provider.imapPort,
            provider.imapSecurity,
            tokens.email,
            secretEnc,
            Date.now(),
            smtpCols.host,
            smtpCols.port,
            smtpCols.security
          );
        accountId = Number(info.lastInsertRowid);
      }

      // Tabs chosen when the sign-in started; skip any deleted since.
      let tabIds = [];
      try {
        tabIds = stateRow.tab_ids ? JSON.parse(stateRow.tab_ids) : [];
      } catch (_) {
        tabIds = [];
      }
      const findTab = db.prepare('SELECT 1 FROM tabs WHERE id = ? AND user_id = ?');
      const attach = db.prepare('INSERT OR IGNORE INTO tab_accounts (tab_id, account_id) VALUES (?, ?)');
      for (const tabId of Array.isArray(tabIds) ? tabIds : []) {
        if (Number.isSafeInteger(tabId) && findTab.get(tabId, userId)) attach.run(tabId, accountId);
      }
      return accountId;
    })();
  }

  router.get('/:provider/callback', async (req, res, next) => {
    try {
      const key = req.params.provider;
      if (key !== 'google' && key !== 'microsoft') return notConfigured(res);

      // Single use: the state row is removed before anything else is looked at.
      const stateParam = scalar(req.query.state);
      const stateRow = typeof stateParam === 'string' && stateParam && stateParam.length <= 200 ? takeState.get(stateParam) : undefined;

      const providerError = scalar(req.query.error);
      if (providerError) {
        return errorRedirect(req, res, PROVIDER_ERRORS[providerError] || 'Sign-in failed. Please try again.');
      }
      if (!req.user) return res.redirect(302, '/?oauth=signin');

      const now = Date.now();
      if (!stateRow || stateRow.expires_at <= now || stateRow.provider !== key || stateRow.user_id !== req.user.id) {
        return errorRedirect(req, res, BAD_STATE);
      }
      const provider = enabledProvider(key);
      if (!provider) return errorRedirect(req, res, 'That sign-in provider is not configured on this server.');

      const code = scalar(req.query.code);
      if (typeof code !== 'string' || !code || code.length > 4096) return errorRedirect(req, res, 'The sign-in did not return an authorization code. Please try again.');

      let tokens;
      try {
        tokens = await oauth.exchangeCode(provider, { code, codeVerifier: stateRow.code_verifier, redirectUri: redirectUri(provider) });
      } catch (err) {
        if (err instanceof oauth.OAuthError) {
          // invalid_grant here means the one-time code itself was rejected (expired or reused),
          // not that a stored connection was revoked.
          if (err.code === 'invalid_grant') return errorRedirect(req, res, 'The sign-in took too long or was already used. Please try again.');
          return errorRedirect(req, res, err.message);
        }
        throw err;
      }

      const userId = req.user.id;
      // Reconnecting a specific account: it must be the same mailbox the user picked.
      if (stateRow.account_id) {
        const target = queries.getAccountRowForUser(db, userId, stateRow.account_id);
        if (target && target.email.toLowerCase() !== tokens.email.toLowerCase()) {
          return errorRedirect(req, res, `You signed in as ${tokens.email}, but this account is ${target.email}. Sign in with ${target.email} to reconnect it.`);
        }
      }

      let accountId;
      try {
        accountId = upsertAccount(userId, provider, tokens, stateRow);
      } catch (err) {
        if (err.redirectMessage) return errorRedirect(req, res, err.redirectMessage);
        throw err;
      }

      // status is 'pending' now; start the first sync in the background.
      Promise.resolve()
        .then(() => syncManager.syncAccount(accountId))
        .catch((err) => console.error(`[oauth] background sync of account ${accountId} failed:`, err));

      res.redirect(302, `/?connected=${accountId}`);
    } catch (err) {
      // This is a browser navigation: a JSON 500 would strand the user on a raw error page.
      console.error('[oauth] callback failed:', (err && err.stack) || err);
      if (res.headersSent) return next(err);
      errorRedirect(req, res, 'Something went wrong while connecting the account. Please try again.');
    }
  });

  return router;
};

module.exports.PROVIDER_ERRORS = PROVIDER_ERRORS;
module.exports.STATE_TTL_MS = STATE_TTL_MS;
