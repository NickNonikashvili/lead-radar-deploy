'use strict';

/**
 * OAuth 2.0 (authorization code + PKCE) for Google and Microsoft mail access.
 *
 * Provider objects come from providers.oauthProviders(config). Tokens are stored encrypted in
 * accounts.secret_enc as { refreshToken, accessToken, accessTokenExpiresAt, grantedScopes?, graphScopes? }.
 * grantedScopes is the space-separated scope string the token endpoint last reported (absent
 * for accounts connected before it was recorded). graphScopes (Microsoft only) are the Microsoft
 * Graph scopes the account consented to — Graph is a second resource, so its token is obtained
 * separately (getGraphAccessToken) and only kept in memory; '' means Microsoft refused them.
 */

const { oauthProviderForPreset } = require('./providers');

const TOKEN_REQUEST_TIMEOUT_MS = 15000;
// Refresh when the access token has less than this much life left.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;
const REVOKED_MESSAGE = 'Access was revoked or expired — reconnect this account.';
const UNREADABLE_MESSAGE = "The saved sign-in for this account can't be read (the server's secret key changed) — reconnect this account.";
// Token endpoint errors that mean the server's own client ID/secret are wrong, expired or deleted.
const CLIENT_ERRORS = new Set(['invalid_client', 'unauthorized_client', 'deleted_client']);
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const GRAPH_RECONNECT_MESSAGE =
  'Reconnect this account to allow sending through Microsoft (sign in with Microsoft again and accept the permission to send email).';
// Refresh answers that mean "this scope was never (or is no longer) consented to", not "the
// sign-in is gone": AADSTS65001 no consent, 65004 consent declined, 70000 scope unauthorized,
// 70011 invalid scope.
const CONSENT_ERROR_RE = /\bAADSTS(?:65001|65004|70000|70011)\b/;
const CONSENT_ERROR_CODES = new Set(['invalid_scope', 'consent_required']);

class OAuthError extends Error {
  /**
   * @param {string} message human readable
   * @param {'invalid_grant'|'invalid_client'|'insufficient_scope'|'oauth_error'} code
   *   invalid_grant: the user's grant is gone (reconnect); invalid_client: this server's client
   *   ID/secret were rejected (site owner must fix the configuration)
   * @param {number} [status] HTTP status returned by the token endpoint, if any
   */
  constructor(message, code = 'oauth_error', status) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    this.status = status;
  }
}

/** The redirect URI to register with the provider: <APP_URL>/api/oauth/<provider>/callback. */
function redirectUriFor(config, providerKey) {
  return `${config.appUrl}/api/oauth/${providerKey}/callback`;
}

/** Why a stored refresh token stopped working, in words the user (and site owner) can act on. */
function revokedMessage(provider) {
  if (provider && provider.key === 'google') {
    return (
      "Google stopped accepting this account's saved sign-in — reconnect it. Common causes: this server's Google app is still " +
      'in "Testing" mode (sign-ins then expire after 7 days), your Google password changed, access was removed in your ' +
      'Google Account, it went unused for 6 months, or it was connected more than 100 times.'
    );
  }
  if (provider && provider.key === 'microsoft') {
    return (
      "Microsoft stopped accepting this account's saved sign-in — reconnect it. Common causes: your password changed or " +
      'your sessions were signed out, access was removed from your Microsoft account, or it went unused for 90 days.'
    );
  }
  return REVOKED_MESSAGE;
}

/** The provider refused this server's client credentials: a configuration problem, not the user's. */
function clientErrorMessage(provider, errorCode, description) {
  const who = provider.label || provider.key;
  const names = (provider.envNames || []).join(' and ') || 'the OAuth client ID and secret';
  let cause = 'the client secret may be wrong, expired or replaced';
  if (provider.key === 'microsoft' && errorCode === 'unauthorized_client') {
    cause = 'the app registration may not allow this kind of account (its supported account types must match MICROSOFT_TENANT)';
  } else if (provider.key === 'microsoft') {
    cause = 'client secrets expire (after 24 months at most), so a new one may be needed';
  } else if (errorCode === 'deleted_client') {
    cause = 'Google deletes OAuth clients that go unused for 6 months, so a new one is needed';
  } else if (provider.key === 'google') {
    cause = 'the client secret may be wrong or replaced, or the OAuth client deleted';
  }
  const detail = description ? `${errorCode}: ${description.slice(0, 100)}` : errorCode;
  return `${who} rejected this server's ${who} sign-in settings (${detail}). Nothing is wrong with your account: the site owner should check ${names} — ${cause}.`;
}

/**
 * Does the space-separated scope string `scope` contain `wanted`? Accepts the full scope URL or
 * its last part ('IMAP.AccessAsUser.All' — Microsoft reports either), case-insensitively.
 */
function scopeIncludes(scope, wanted) {
  if (typeof scope !== 'string' || !wanted) return false;
  const norm = (v) => String(v).toLowerCase().replace(/\/+$/, '');
  const full = norm(wanted);
  const bare = full.slice(full.lastIndexOf('/') + 1);
  return scope.split(/\s+/).some((s) => {
    const got = norm(s);
    return got && (got === full || got === bare);
  });
}

/**
 * Did the token response grant the mail scope? RFC 6749 §5.1: a response without `scope`
 * granted exactly what was asked for.
 */
function grantsMailScope(provider, scope) {
  if (!provider.mailScope || typeof scope !== 'string' || !scope.trim()) return true;
  return scopeIncludes(scope, provider.mailScope);
}

/**
 * May an account with these granted scopes send mail over SMTP?
 * true / false, or null when it is not known (no scope string was recorded for the account).
 */
function grantsSendScope(provider, grantedScopes) {
  if (!provider || !provider.sendScope) return null;
  if (typeof grantedScopes !== 'string' || !grantedScopes.trim()) return null;
  return scopeIncludes(grantedScopes, provider.sendScope);
}

/**
 * May an account send through Microsoft Graph (Mail.Send)? Judged from the secret's graphScopes:
 * recorded at sign-in when the authorize request asked for them, and replaced by what each Graph
 * token response reports.
 */
function grantsGraphSendScope(provider, secret) {
  if (!provider || !provider.graphSendScope || !secret || typeof secret !== 'object') return false;
  return scopeIncludes(secret.graphScopes, provider.graphSendScope);
}

/**
 * Graph scopes a successful sign-in consented to. Microsoft's consent covers every scope of the
 * authorize request, but the code-redeem response only lists those of the first resource
 * (outlook.office.com), so they are taken from the request.
 */
function consentedGraphScopes(provider, data) {
  if (!provider.graphSendScope || !Array.isArray(provider.graphScopes)) return null;
  if (data && typeof data.scope === 'string' && scopeIncludes(data.scope, provider.graphSendScope)) return data.scope.trim().slice(0, 2000);
  return Array.isArray(provider.scopes) && provider.scopes.includes(provider.graphSendScope) ? provider.graphScopes.join(' ') : null;
}

/** The scope string to record for a token response (what was granted, or what was asked for). */
function grantedScopesFrom(data, requested) {
  if (data && typeof data.scope === 'string' && data.scope.trim()) return data.scope.trim().slice(0, 2000);
  return Array.isArray(requested) && requested.length ? requested.join(' ') : null;
}

function missingScopeMessage(provider) {
  if (provider.key === 'google') {
    return (
      "Mail access wasn't granted, so the account was not connected. Sign in again and tick the Gmail permission " +
      '("Read, compose, send, and permanently delete all your email from Gmail") — Mailtabs needs it to read your inbox.'
    );
  }
  return (
    "Mail access wasn't granted, so the account was not connected. Sign in again and accept the permission to read your " +
    'mail (IMAP). Work accounts may need an administrator to approve it.'
  );
}

/** URL to send the browser to so the user can grant mail access. */
function buildAuthUrl(provider, { state, codeChallenge, redirectUri, loginHint } = {}) {
  if (!provider || !provider.authUrl) throw new OAuthError('Unknown sign-in provider');
  if (!state || !codeChallenge || !redirectUri) throw new OAuthError('buildAuthUrl: state, codeChallenge and redirectUri are required');
  const url = new URL(provider.authUrl);
  const params = {
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    ...(provider.extraAuthParams || {}),
  };
  if (loginHint) params.login_hint = loginHint;
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.toString();
}

/** Decode the (unverified) payload of a JWT. Safe here: it came straight from the token endpoint over TLS. */
function decodeJwtPayload(jwt) {
  if (typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function emailFromClaims(provider, claims) {
  if (!claims) return null;
  const candidates = provider.key === 'microsoft' ? [claims.email, claims.preferred_username, claims.upn] : [claims.email];
  for (const value of candidates) {
    // Microsoft's preferred_username can also be a phone number or a plain user name.
    if (typeof value === 'string' && value.trim().length <= 254 && EMAIL_RE.test(value.trim())) return value.trim();
  }
  return null;
}

function expiresAtFrom(data) {
  const seconds = Number(data.expires_in);
  // Default to one hour when the provider leaves it out (both Google and Microsoft send it).
  return Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000;
}

/** POST a form to the provider's token endpoint and return the parsed JSON body. */
async function tokenRequest(provider, fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }
  let res;
  try {
    res = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new OAuthError(`Could not reach ${provider.label || provider.key} sign-in service. Try again in a moment.`, 'oauth_error');
  }

  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }

  if (!res.ok || !data || data.error) {
    const errorCode = data && typeof data.error === 'string' ? data.error : '';
    const description = data && typeof data.error_description === 'string' ? data.error_description : '';
    if (errorCode === 'invalid_grant') {
      const err = new OAuthError(revokedMessage(provider), 'invalid_grant', res.status);
      err.description = description;
      err.providerError = errorCode;
      throw err;
    }
    if (CLIENT_ERRORS.has(errorCode)) {
      const err = new OAuthError(clientErrorMessage(provider, errorCode, description), 'invalid_client', res.status);
      err.description = description;
      err.providerError = errorCode;
      throw err;
    }
    const detail = description || errorCode || `HTTP ${res.status}`;
    const err = new OAuthError(`${provider.label || provider.key} sign-in failed: ${detail.slice(0, 300)}`, 'oauth_error', res.status);
    err.description = description;
    err.providerError = errorCode || null;
    throw err;
  }
  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw new OAuthError(`${provider.label || provider.key} did not return an access token.`, 'oauth_error', res.status);
  }
  return data;
}

/**
 * Exchange an authorization code for tokens.
 * @returns {Promise<{accessToken, refreshToken: string|null, expiresAt: number, email: string, name: string|null,
 *   grantedScopes: string|null, graphScopes: string|null}>} grantedScopes (and graphScopes, Microsoft)
 *   must be saved in the account secret: they decide which scopes later refreshes ask for and
 *   whether (and how) the account may send.
 */
async function exchangeCode(provider, { code, codeVerifier, redirectUri }) {
  if (!code) throw new OAuthError('No authorization code was returned.');
  const data = await tokenRequest(provider, {
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
  // With granular consent (Google) the user may have granted sign-in but not mail access.
  if (!grantsMailScope(provider, data.scope)) throw new OAuthError(missingScopeMessage(provider), 'insufficient_scope');
  const claims = decodeJwtPayload(data.id_token);
  const email = emailFromClaims(provider, claims);
  if (!email) {
    throw new OAuthError(
      provider.key === 'microsoft'
        ? 'Could not determine the mailbox address of the Microsoft account. If you signed in with a phone number or user name, sign in with your email address instead.'
        : `Could not determine the email address of the ${provider.label || provider.key} account.`,
      'oauth_error'
    );
  }
  const name = claims && typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null;
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : null,
    expiresAt: expiresAtFrom(data),
    email,
    name,
    grantedScopes: grantedScopesFrom(data, provider.scopes),
    graphScopes: consentedGraphScopes(provider, data),
  };
}

/**
 * The scopes to send with a refresh: the provider's refresh scopes, minus optional ones the
 * account was never granted (`grantedScopes` unknown counts as not granted), mail scope first.
 */
function refreshScopesFor(provider, grantedScopes) {
  if (!Array.isArray(provider.refreshScopes) || !provider.refreshScopes.length) return null;
  const optional = new Set(provider.optionalScopes || []);
  const wanted = provider.refreshScopes.filter((s) => !optional.has(s) || scopeIncludes(grantedScopes, s));
  // Microsoft returns a token for the resource of the FIRST scope, so the mail scope leads.
  const rest = wanted.filter((s) => s !== provider.mailScope);
  return provider.mailScope ? [provider.mailScope, ...rest] : rest;
}

/**
 * Use a refresh token to get a new access token.
 * @param {{ grantedScopes?: string|null }} [opts] the scopes the account was granted so far
 * @returns {Promise<{accessToken, refreshToken, expiresAt, grantedScopes: string|null}>} refreshToken is
 *   the rotated one if the provider sent one, else the original; grantedScopes is the scope string of
 *   the response (null when it had none).
 */
async function refreshAccessToken(provider, refreshToken, { grantedScopes = null } = {}) {
  if (!refreshToken) throw new OAuthError(REVOKED_MESSAGE, 'invalid_grant');
  const fields = {
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };
  const scopes = refreshScopesFor(provider, grantedScopes);
  if (scopes && scopes.length) fields.scope = scopes.join(' ');
  const data = await tokenRequest(provider, fields);
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : refreshToken,
    expiresAt: expiresAtFrom(data),
    grantedScopes: typeof data.scope === 'string' && data.scope.trim() ? data.scope.trim().slice(0, 2000) : null,
  };
}

function markAccount(db, accountId, status, message) {
  try {
    db.prepare('UPDATE accounts SET status = ?, last_error = ? WHERE id = ?').run(status, message, accountId);
  } catch (_) {
    /* account deleted or DB closed — nothing to mark */
  }
}

/** The user must reconnect: the scheduler skips 'auth_error' accounts until then. */
function markRevoked(db, accountId, message = REVOKED_MESSAGE) {
  markAccount(db, accountId, 'auth_error', message);
}

// Keyed by db handle first so separate databases (e.g. in tests) never share entries.
const refreshesInFlight = new WeakMap(); // db -> Map(accountId -> Promise<access token>)
const graphRefreshesInFlight = new WeakMap(); // db -> Map(accountId -> Promise<Graph access token>)
const refreshQueues = new WeakMap(); // db -> Map(accountId -> tail of the account's refresh queue)
const graphTokens = new WeakMap(); // db -> Map(accountId -> { token, expiresAt, email, configVersion })

function mapFor(weak, db) {
  if (!weak.has(db)) weak.set(db, new Map());
  return weak.get(db);
}

/** One caller per account does `work`; the others share its promise. */
async function shared(weak, db, accountId, work) {
  const inFlight = mapFor(weak, db);
  if (inFlight.has(accountId)) return inFlight.get(accountId);
  const promise = work();
  inFlight.set(accountId, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(accountId);
  }
}

/**
 * Refreshes of one account (for IMAP/SMTP or for Graph) run one at a time: Microsoft rotates
 * refresh tokens, so each refresh must start from the token the previous one stored.
 */
function inRefreshQueue(db, accountId, task) {
  const queues = mapFor(refreshQueues, db);
  const run = (queues.get(accountId) || Promise.resolve()).then(task, task);
  const tail = run.catch(() => {});
  queues.set(accountId, tail);
  tail.then(() => {
    if (queues.get(accountId) === tail) queues.delete(accountId);
  });
  return run;
}

/** The account's secret as stored now (the caller's row may be older); unreadable -> reconnect. */
function readSecret({ db, crypto }, accountRow) {
  let secretEnc = accountRow.secret_enc;
  try {
    const current = db.prepare('SELECT secret_enc FROM accounts WHERE id = ?').get(accountRow.id);
    if (current && current.secret_enc) secretEnc = current.secret_enc;
  } catch (_) {
    /* fall back to the row we were given */
  }
  try {
    return crypto.decryptJson(secretEnc) || {};
  } catch (_) {
    markRevoked(db, accountRow.id, UNREADABLE_MESSAGE);
    throw new OAuthError(UNREADABLE_MESSAGE, 'invalid_grant');
  }
}

/**
 * Merge `changes` into the stored secret (read and written in one synchronous step, so fields
 * another refresh stored meanwhile — Graph scopes, a rotated refresh token — are kept).
 */
function updateSecret({ db, crypto }, accountId, fallback, changes) {
  try {
    db.transaction(() => {
      const row = db.prepare('SELECT secret_enc FROM accounts WHERE id = ?').get(accountId);
      if (!row) return; // account deleted meanwhile — the token is still good for this one use
      let current;
      try {
        current = crypto.decryptJson(row.secret_enc) || {};
      } catch (_) {
        current = fallback || {};
      }
      db.prepare('UPDATE accounts SET secret_enc = ? WHERE id = ?').run(crypto.encryptJson({ ...current, ...changes }), accountId);
    })();
  } catch (_) {
    /* DB closed — the token is still good for this one use */
  }
}

function tokenUsable(token, expiresAt, margin = REFRESH_MARGIN_MS) {
  return !!token && (Number(expiresAt) || 0) - Date.now() > margin;
}

function providerForRefresh(config, accountRow) {
  const provider = oauthProviderForPreset(config, accountRow.provider);
  if (!provider) throw new OAuthError(`Unknown sign-in provider for this account (${accountRow.provider}).`);
  if (!provider.enabled) {
    throw new OAuthError(`${provider.label} sign-in is not configured on this server, so this account cannot be refreshed.`);
  }
  return provider;
}

/** Record what a failed refresh means for the account (revoked / server misconfiguration). */
function noteRefreshFailure(db, accountId, err) {
  if (err instanceof OAuthError && err.code === 'invalid_grant') markRevoked(db, accountId, err.message);
  // A server misconfiguration (wrong/expired client secret, deleted client) is not the
  // user's fault: plain 'error', so the account is retried once the site owner fixes it.
  else if (err instanceof OAuthError && err.code === 'invalid_client') markAccount(db, accountId, 'error', err.message);
}

/**
 * Return a usable access token for an OAuth account, refreshing it (and persisting the new
 * secret) when it has less than `minValidityMs` (default two minutes) left. IMAP connections ask
 * for more: Gmail closes an OAuth IMAP session when its token expires, so a long sync must not
 * start on a token about to run out.
 */
async function getFreshAccessToken(deps, accountRow, { minValidityMs = REFRESH_MARGIN_MS } = {}) {
  const { db, config } = deps;
  if (!accountRow || accountRow.auth_type !== 'oauth') throw new OAuthError('Not an OAuth account');

  const first = readSecret(deps, accountRow);
  if (tokenUsable(first.accessToken, first.accessTokenExpiresAt, minValidityMs)) return first.accessToken;

  // One refresh per account at a time, so a sync and a user action do not race each other.
  return shared(refreshesInFlight, db, accountRow.id, () =>
    inRefreshQueue(db, accountRow.id, async () => {
      // A refresh that ran while this one waited (Graph's included) may have stored newer tokens.
      const secret = readSecret(deps, accountRow);
      if (tokenUsable(secret.accessToken, secret.accessTokenExpiresAt, minValidityMs)) return secret.accessToken;
      const provider = providerForRefresh(config, accountRow);
      if (!secret.refreshToken) {
        markRevoked(db, accountRow.id);
        throw new OAuthError(REVOKED_MESSAGE, 'invalid_grant');
      }
      let fresh;
      try {
        fresh = await refreshAccessToken(provider, secret.refreshToken, { grantedScopes: secret.grantedScopes || null });
      } catch (err) {
        noteRefreshFailure(db, accountRow.id, err);
        throw err;
      }
      const grantedScopes = fresh.grantedScopes || secret.grantedScopes || null;
      updateSecret(deps, accountRow.id, secret, {
        refreshToken: fresh.refreshToken,
        accessToken: fresh.accessToken,
        accessTokenExpiresAt: fresh.expiresAt,
        ...(grantedScopes ? { grantedScopes } : {}),
      });
      return fresh.accessToken;
    })
  );
}

/** A Graph refresh refused because the account never consented to (or lost) the Graph scopes. */
function isConsentError(err) {
  if (!(err instanceof OAuthError)) return false;
  return CONSENT_ERROR_CODES.has(err.providerError) || CONSENT_ERROR_RE.test(String(err.description || ''));
}

function graphCacheKey(accountRow) {
  return { email: String(accountRow.email || '').toLowerCase(), configVersion: accountRow.config_version ?? null };
}

/** Forget the cached Graph token of an account (e.g. Graph answered 401). */
function forgetGraphAccessToken(db, accountId) {
  if (graphTokens.has(db)) graphTokens.get(db).delete(accountId);
}

/**
 * A Microsoft Graph access token (scope Mail.Send) for a Microsoft account that consented to it,
 * obtained with a refresh_token grant and cached in memory until it is about to expire. A
 * rotated refresh token is stored like getFreshAccessToken stores it.
 * @throws OAuthError 'insufficient_scope' (with "reconnect" advice) when the account has no
 *   Graph consent — Microsoft's refusal is remembered (graphScopes ''), so the account shows
 *   "can't send" until it is reconnected; other OAuthErrors as getFreshAccessToken.
 */
async function getGraphAccessToken(deps, accountRow) {
  const { db, config } = deps;
  if (!accountRow || accountRow.auth_type !== 'oauth') throw new OAuthError('Not an OAuth account');
  const provider = oauthProviderForPreset(config, accountRow.provider);
  if (!provider || !provider.graphSendScope) throw new OAuthError('Sending through Microsoft Graph needs a Microsoft account.', 'insufficient_scope');

  const key = graphCacheKey(accountRow);
  const cached = mapFor(graphTokens, db).get(accountRow.id);
  if (cached && cached.email === key.email && cached.configVersion === key.configVersion && tokenUsable(cached.token, cached.expiresAt)) {
    return cached.token;
  }

  return shared(graphRefreshesInFlight, db, accountRow.id, () =>
    inRefreshQueue(db, accountRow.id, async () => {
      const secret = readSecret(deps, accountRow);
      if (!grantsGraphSendScope(provider, secret)) throw new OAuthError(GRAPH_RECONNECT_MESSAGE, 'insufficient_scope');
      providerForRefresh(config, accountRow);
      if (!secret.refreshToken) {
        markRevoked(db, accountRow.id);
        throw new OAuthError(REVOKED_MESSAGE, 'invalid_grant');
      }
      let data;
      try {
        data = await tokenRequest(provider, {
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: secret.refreshToken,
          scope: provider.graphScopes.join(' '),
        });
      } catch (err) {
        if (isConsentError(err)) {
          updateSecret(deps, accountRow.id, secret, { graphScopes: '' });
          throw new OAuthError(GRAPH_RECONNECT_MESSAGE, 'insufficient_scope', err.status);
        }
        // Conditional Access (e.g. MFA required for Graph) can't be satisfied without the user.
        if (err instanceof OAuthError && err.providerError === 'interaction_required') {
          throw new OAuthError(GRAPH_RECONNECT_MESSAGE, 'insufficient_scope', err.status);
        }
        noteRefreshFailure(db, accountRow.id, err); // the same refresh token serves IMAP: revoked is revoked
        throw err;
      }
      const reported = typeof data.scope === 'string' && data.scope.trim() ? data.scope.trim().slice(0, 2000) : null;
      updateSecret(deps, accountRow.id, secret, {
        refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : secret.refreshToken,
        ...(reported ? { graphScopes: reported } : {}),
      });
      const entry = { token: data.access_token, expiresAt: expiresAtFrom(data), ...key };
      mapFor(graphTokens, db).set(accountRow.id, entry);
      return entry.token;
    })
  );
}

module.exports = {
  redirectUriFor,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getFreshAccessToken,
  getGraphAccessToken,
  forgetGraphAccessToken,
  OAuthError,
  decodeJwtPayload,
  grantsMailScope,
  grantsSendScope,
  grantsGraphSendScope,
  scopeIncludes,
  refreshScopesFor,
  REVOKED_MESSAGE,
  GRAPH_RECONNECT_MESSAGE,
};
