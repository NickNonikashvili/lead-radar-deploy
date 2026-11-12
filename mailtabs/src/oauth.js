'use strict';

/**
 * OAuth 2.0 (authorization code + PKCE) for Google and Microsoft mail access.
 *
 * Provider objects come from providers.oauthProviders(config). Tokens are stored encrypted in
 * accounts.secret_enc as { refreshToken, accessToken, accessTokenExpiresAt }.
 */

const { oauthProviderForPreset } = require('./providers');

const TOKEN_REQUEST_TIMEOUT_MS = 15000;
// Refresh when the access token has less than this much life left.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;
const REVOKED_MESSAGE = 'Access was revoked or expired — reconnect this account.';
const UNREADABLE_MESSAGE = "The saved sign-in for this account can't be read (the server's secret key changed) — reconnect this account.";

class OAuthError extends Error {
  /**
   * @param {string} message human readable
   * @param {'invalid_grant'|'oauth_error'} code
   * @param {number} [status] HTTP status returned by the token endpoint, if any
   */
  constructor(message, code = 'oauth_error', status) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    this.status = status;
  }
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
    if (typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value.trim())) return value.trim();
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
      const err = new OAuthError(REVOKED_MESSAGE, 'invalid_grant', res.status);
      err.description = description;
      throw err;
    }
    const detail = description || errorCode || `HTTP ${res.status}`;
    const err = new OAuthError(`${provider.label || provider.key} sign-in failed: ${detail.slice(0, 300)}`, 'oauth_error', res.status);
    err.description = description;
    throw err;
  }
  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw new OAuthError(`${provider.label || provider.key} did not return an access token.`, 'oauth_error', res.status);
  }
  return data;
}

/**
 * Exchange an authorization code for tokens.
 * @returns {Promise<{accessToken, refreshToken: string|null, expiresAt: number, email: string, name: string|null}>}
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
  const claims = decodeJwtPayload(data.id_token);
  const email = emailFromClaims(provider, claims);
  if (!email) {
    throw new OAuthError(`Could not determine the email address of the ${provider.label || provider.key} account.`, 'oauth_error');
  }
  const name = claims && typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null;
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : null,
    expiresAt: expiresAtFrom(data),
    email,
    name,
  };
}

/**
 * Use a refresh token to get a new access token.
 * @returns {Promise<{accessToken, refreshToken, expiresAt}>} refreshToken is the rotated one if the
 *   provider sent one, else the original.
 */
async function refreshAccessToken(provider, refreshToken) {
  if (!refreshToken) throw new OAuthError(REVOKED_MESSAGE, 'invalid_grant');
  const fields = {
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };
  if (provider.key === 'microsoft') fields.scope = provider.scopes.join(' ');
  const data = await tokenRequest(provider, fields);
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : refreshToken,
    expiresAt: expiresAtFrom(data),
  };
}

function markRevoked(db, accountId, message = REVOKED_MESSAGE) {
  try {
    db.prepare("UPDATE accounts SET status = 'auth_error', last_error = ? WHERE id = ?").run(message, accountId);
  } catch (_) {
    /* account deleted or DB closed — nothing to mark */
  }
}

// One refresh per account at a time, so a sync and a user action do not race each other
// (Microsoft rotates refresh tokens; two parallel refreshes would waste one of them).
// Keyed by db handle first so separate databases (e.g. in tests) never share entries.
const refreshesInFlight = new WeakMap();

/**
 * Return a usable access token for an OAuth account, refreshing it (and persisting the new
 * secret) when it has less than two minutes left.
 */
async function getFreshAccessToken({ db, crypto, config }, accountRow) {
  if (!accountRow || accountRow.auth_type !== 'oauth') throw new OAuthError('Not an OAuth account');

  // Prefer the stored secret over the caller's copy of the row: it may have been refreshed since.
  let secretEnc = accountRow.secret_enc;
  try {
    const current = db.prepare('SELECT secret_enc FROM accounts WHERE id = ?').get(accountRow.id);
    if (current && current.secret_enc) secretEnc = current.secret_enc;
  } catch (_) {
    /* fall back to the row we were given */
  }

  let secret;
  try {
    secret = crypto.decryptJson(secretEnc) || {};
  } catch (_) {
    markRevoked(db, accountRow.id, UNREADABLE_MESSAGE);
    throw new OAuthError(UNREADABLE_MESSAGE, 'invalid_grant');
  }

  const expiresAt = Number(secret.accessTokenExpiresAt) || 0;
  if (secret.accessToken && expiresAt - Date.now() > REFRESH_MARGIN_MS) return secret.accessToken;

  if (!refreshesInFlight.has(db)) refreshesInFlight.set(db, new Map());
  const inFlight = refreshesInFlight.get(db);
  if (inFlight.has(accountRow.id)) return inFlight.get(accountRow.id);

  const work = (async () => {
    const provider = oauthProviderForPreset(config, accountRow.provider);
    if (!provider) throw new OAuthError(`Unknown sign-in provider for this account (${accountRow.provider}).`);
    if (!provider.enabled) {
      throw new OAuthError(`${provider.label} sign-in is not configured on this server, so this account cannot be refreshed.`);
    }
    if (!secret.refreshToken) {
      markRevoked(db, accountRow.id);
      throw new OAuthError(REVOKED_MESSAGE, 'invalid_grant');
    }
    let fresh;
    try {
      fresh = await refreshAccessToken(provider, secret.refreshToken);
    } catch (err) {
      if (err instanceof OAuthError && err.code === 'invalid_grant') markRevoked(db, accountRow.id);
      throw err;
    }
    const newSecret = crypto.encryptJson({
      refreshToken: fresh.refreshToken,
      accessToken: fresh.accessToken,
      accessTokenExpiresAt: fresh.expiresAt,
    });
    try {
      db.prepare('UPDATE accounts SET secret_enc = ? WHERE id = ?').run(newSecret, accountRow.id);
    } catch (_) {
      /* account deleted meanwhile — the token is still good for this one use */
    }
    return fresh.accessToken;
  })();

  inFlight.set(accountRow.id, work);
  try {
    return await work;
  } finally {
    inFlight.delete(accountRow.id);
  }
}

module.exports = {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getFreshAccessToken,
  OAuthError,
  decodeJwtPayload,
  REVOKED_MESSAGE,
};
