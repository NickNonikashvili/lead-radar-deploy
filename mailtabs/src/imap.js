'use strict';

/**
 * ImapFlow connection factory and helpers.
 *
 * Every connection goes through buildConnectionOptions(), which enforces the security policy
 * (no plaintext unless explicitly allowed), runs the SSRF guard and pins the connection to an
 * address the guard checked.
 */

const net = require('net');
const { ImapFlow } = require('imapflow');
const { HttpError } = require('./errors');
const netguard = require('./netguard');
const { getFreshAccessToken, OAuthError } = require('./oauth');
const { presetKeyForHost, authFailureHintForHost } = require('./providers');

const SECURITY_VALUES = ['tls', 'starttls', 'none'];
const LOGOUT_TIMEOUT_MS = 5000;

// Upper bound on any single literal (one message source) a server may send us. Without it
// imapflow accepts up to 1 GB, so a hostile "Other IMAP" server could exhaust memory.
// Callers that only expect small literals (the sync) pass a tighter limit.
const DEFAULT_MAX_LITERAL_BYTES = 64 * 1024 * 1024;

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

/**
 * Build ImapFlow options from explicit connection parameters.
 * @param {object} config app config
 * @param {{host, port, security, user, password?, accessToken?}} params
 */
async function buildConnectionOptions(config, { host, port, security, user, password, accessToken }, limits = {}) {
  const sec = String(security || 'tls').toLowerCase();
  if (!SECURITY_VALUES.includes(sec)) {
    throw new HttpError(400, 'Security must be one of: tls, starttls, none.', 'INVALID_SECURITY');
  }
  if (sec === 'none' && !config.allowPrivateHosts) {
    throw new HttpError(
      400,
      'Unencrypted IMAP connections are not allowed. Choose TLS (usually port 993) or STARTTLS (usually port 143).',
      'INSECURE_NOT_ALLOWED'
    );
  }
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    throw new HttpError(400, 'The port must be a number between 1 and 65535.', 'INVALID_PORT');
  }
  if (!user) throw new HttpError(400, 'A username is required.', 'INVALID_USER');

  const guard = await netguard.assertAllowedHost(host, { allowPrivate: !!config.allowPrivateHosts });
  const hostname = guard.host;

  // Connect to an address the guard has already checked (prefer IPv4, which every mail host
  // has), while TLS still verifies the certificate against the real host name.
  const pinned = guard.addresses.find((a) => a.family === 4) || guard.addresses[0];
  const connectHost = pinned ? pinned.address : hostname;
  const isIpHost = net.isIP(hostname) !== 0;

  const options = {
    host: connectHost,
    port: portNum,
    secure: sec === 'tls',
    doSTARTTLS: sec === 'starttls' ? true : sec === 'none' ? false : undefined,
    auth: accessToken ? { user, accessToken } : { user, pass: password || '' },
    logger: false,
    emitLogs: false,
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
    disableAutoIdle: true, // connections are short-lived; never sit in IDLE
    tls: isIpHost ? {} : { servername: hostname },
    maxLiteralSize: limitOr(limits.maxLiteralSize, DEFAULT_MAX_LITERAL_BYTES),
  };
  // One response = its literals plus framing; keep headroom above the literal cap.
  options.maxResponseSize = options.maxLiteralSize + 1024 * 1024;
  // SNI must not be an IP address (RFC 6066); only set it for real host names.
  if (!isIpHost) options.servername = hostname;
  // Remember the name the user typed so error messages don't show the pinned IP.
  Object.defineProperty(options, 'displayHost', { value: hostname, enumerable: false });
  return options;
}

function limitOr(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Decrypt an account's stored secret, mapping failure to a reconnect-style auth error. */
function decryptSecret(crypto, accountRow) {
  try {
    return crypto.decryptJson(accountRow.secret_enc) || {};
  } catch (_) {
    const err = new Error("The saved password for this account can't be read (the server's secret key changed) — enter it again.");
    err.authenticationFailed = true;
    err.friendly = err.message;
    throw err;
  }
}

/** ImapFlow constructor options for an account row (auth resolved, OAuth token fresh). */
async function buildImapOptions(deps, accountRow, limits = {}) {
  const { config, crypto } = deps;
  const base = { host: accountRow.imap_host, port: accountRow.imap_port, security: accountRow.imap_security, user: accountRow.imap_user };
  if (accountRow.auth_type === 'oauth') {
    const accessToken = await getFreshAccessToken(deps, accountRow);
    return buildConnectionOptions(config, { ...base, accessToken }, limits);
  }
  const secret = decryptSecret(crypto, accountRow);
  return buildConnectionOptions(config, { ...base, password: secret.password }, limits);
}

function annotate(err, options) {
  if (err && typeof err === 'object' && options) {
    if (!err.imapHost) err.imapHost = options.displayHost || options.host;
    if (!err.imapPort) err.imapPort = options.port;
  }
  return err;
}

/** Create a client, attach the mandatory error listener and connect it. */
async function connectWithOptions(options, logger = silentLogger) {
  const client = new ImapFlow(options);
  // ImapFlow emits 'error' for socket-level failures; without a listener Node would crash.
  client.on('error', (err) => {
    logger.warn(`[imap] ${options.displayHost || options.host}: ${err && err.message}`);
  });
  try {
    await client.connect();
  } catch (err) {
    client.close();
    throw annotate(err, options);
  }
  return client;
}

/** Connected ImapFlow client for an account. The caller must logout() it. */
async function connect(deps, accountRow, limits = {}) {
  const options = await buildImapOptions(deps, accountRow, limits);
  return connectWithOptions(options, deps.logger);
}

/** Log out politely, but never hang or throw: fall back to closing the socket. */
async function safeLogout(client) {
  if (!client) return;
  if (!client.usable) {
    client.close();
    return;
  }
  let timer;
  try {
    await Promise.race([
      client.logout(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('logout timed out')), LOGOUT_TIMEOUT_MS);
      }),
    ]);
  } catch (_) {
    client.close();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run fn(client) with a connected client; always logs out / closes afterwards.
 * `limits.maxLiteralSize` caps the size of any one message the server may send.
 */
async function withImap(deps, accountRow, fn, limits = {}) {
  const client = await connect(deps, accountRow, limits);
  try {
    return await fn(client);
  } catch (err) {
    throw annotate(err, { displayHost: accountRow.imap_host, port: accountRow.imap_port });
  } finally {
    await safeLogout(client);
  }
}

// RFC 5530 response codes that mean "not now", not "wrong credentials".
const TRANSIENT_LOGIN_CODES = new Set(['UNAVAILABLE', 'INUSE', 'LIMIT', 'SERVERBUG', 'OVERQUOTA']);

/**
 * A login the server refused for a temporary reason (too many connections, maintenance...).
 * imapflow flags every refused LOGIN/AUTHENTICATE as authenticationFailed, so look closer
 * before telling the user their password is wrong.
 */
function isTransientLoginRefusal(err) {
  if (!err || !err.authenticationFailed) return false;
  const code = String(err.serverResponseCode || '').toUpperCase();
  if (TRANSIENT_LOGIN_CODES.has(code)) return true;
  if (code) return false; // AUTHENTICATIONFAILED, AUTHORIZATIONFAILED, EXPIRED, ...
  const text = `${err.responseText || ''} ${typeof err.response === 'string' ? err.response : ''}`;
  return /too many (simultaneous |concurrent )?(connections|logins|sessions)|try again later|temporar(il)?y|maintenance|unavailable/i.test(text) &&
    !/password|credential|invalid|incorrect/i.test(text);
}

/** True when the user has to fix credentials / reconnect (never for temporary refusals). */
function isAuthFailure(err) {
  if (!err) return false;
  if (err instanceof OAuthError) return err.code === 'invalid_grant';
  return !!err.authenticationFailed && !isTransientLoginRefusal(err);
}

/**
 * Check that a login works without saving anything.
 * `alternateUser` (optional, password logins only): a second username to try once when the
 * server rejects `user` — iCloud and Yandex may want only the part before the @.
 * @returns {{ok: true, user: string}} with the username that worked, or throws
 *   HttpError(400, friendly, 'IMAP_AUTH_FAILED' | 'IMAP_CONNECT_FAILED') for the first attempt
 *   (policy errors such as HOST_NOT_ALLOWED / INSECURE_NOT_ALLOWED are thrown as they are).
 */
async function verifyLogin(deps, { host, port, security, user, password, accessToken, alternateUser }) {
  const options = await buildConnectionOptions(deps.config, { host, port, security, user, password, accessToken });
  let client;
  try {
    client = await connectWithOptions(options, deps.logger);
  } catch (err) {
    const message = friendlyImapError(err, { host: options.displayHost, port: options.port, oauth: !!accessToken });
    const failure = new HttpError(400, message, isAuthFailure(err) ? 'IMAP_AUTH_FAILED' : 'IMAP_CONNECT_FAILED');
    if (failure.code === 'IMAP_AUTH_FAILED' && !accessToken && alternateUser && alternateUser !== user) {
      try {
        const retry = await buildConnectionOptions(deps.config, { host, port, security, user: alternateUser, password });
        client = await connectWithOptions(retry, deps.logger);
      } catch (_) {
        throw failure; // report the first attempt: it used the username the user expects
      }
      await safeLogout(client);
      return { ok: true, user: alternateUser };
    }
    throw failure;
  }
  await safeLogout(client);
  return { ok: true, user };
}

/** Pick the mailbox path with a special-use flag from a LIST result. */
function pickSpecialMailbox(list, specialUse) {
  const wanted = String(specialUse).toLowerCase();
  // Prefer a server-declared flag over imapflow's name-based guess.
  const matches = (list || []).filter((box) => {
    if (box.specialUse && box.specialUse.toLowerCase() === wanted) return true;
    return box.flags && [...box.flags].some((f) => String(f).toLowerCase() === wanted);
  });
  matches.sort((a, b) => rank(a) - rank(b));
  return matches.length ? matches[0].path : null;

  function rank(box) {
    return box.specialUseSource === 'extension' ? 0 : box.specialUseSource === 'user' ? 1 : 2;
  }
}

/** Path of the mailbox flagged '\\Archive' | '\\Trash' | '\\All' | …, or null. */
async function findSpecialMailbox(client, specialUse) {
  const list = await client.list();
  return pickSpecialMailbox(list, specialUse);
}

const GMAIL_HOSTS = new Set(['imap.gmail.com', 'imap.googlemail.com']);

/**
 * Is this account on Gmail (labels as folders, [Gmail]/… system folders, X-GM-THRID)?
 * Decided by the server name, or by the X-GM-EXT-1 capability of a connected client
 * (Google Workspace accounts on a custom IMAP name, test doubles).
 */
function isGmail(accountRow, client) {
  const host = String((accountRow && accountRow.imap_host) || '').trim().toLowerCase();
  if (GMAIL_HOSTS.has(host)) return true;
  return !!(client && client.capabilities && typeof client.capabilities.has === 'function' && client.capabilities.has('X-GM-EXT-1'));
}

/** Compress UIDs into an IMAP sequence set: [1,2,3,7,9,10] -> "1:3,7,9:10". */
function toUidSet(uids) {
  const sorted = [...new Set(uids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) end = sorted[++i];
    parts.push(start === end ? String(start) : `${start}:${end}`);
  }
  return parts.join(',');
}

function truncate(s, n = 200) {
  const str = String(s || '').replace(/\s+/g, ' ').trim();
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

const CERT_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_UNTRUSTED',
  'CERT_REVOKED',
  'CERT_SIGNATURE_FAILURE',
  'HOSTNAME_MISMATCH',
]);

/**
 * Turn an ImapFlow / socket / OAuth error into a sentence a non-technical user can act on.
 * @param {Error} err
 * @param {{host?: string, port?: number, oauth?: boolean}} [ctx] connection details for the message
 */
function friendlyImapError(err, ctx = {}) {
  if (!err) return 'Unknown error talking to the mail server.';
  if (err.friendly) return err.friendly;
  // Our own policy / validation errors are already user-facing.
  if (err instanceof HttpError || err.expose === true) return err.message;
  if (err instanceof OAuthError || err.name === 'OAuthError') return err.message;

  const host = ctx.host || err.imapHost || err.hostname || err.address || 'the mail server';
  const port = ctx.port || err.imapPort || err.port;
  const where = port ? `${host}:${port}` : host;
  const code = String(err.code || '');
  const message = String(err.message || '');
  const serverText = String(err.responseText || (typeof err.response === 'string' ? err.response : '') || '');

  if (err.authenticationFailed && isTransientLoginRefusal(err)) {
    return `The mail server is temporarily refusing connections (${truncate(serverText || message)}). Mailtabs will try again automatically.`;
  }
  if (err.authenticationFailed) {
    const text = `${serverText} ${message}`;
    // Provider-specific advice (app passwords, "turn IMAP on first", ...), chosen by server name.
    const hint = authFailureHintForHost(host);
    if (ctx.oauth || err.oauthError || /XOAUTH2|OAUTHBEARER/i.test(String(err.executedCommand || ''))) {
      // Outlook.com refuses even a valid token until the user turns IMAP on.
      const imapOff = presetKeyForHost(host) === 'outlook' ? ` ${hint}` : '';
      return `The mail server rejected the sign-in — reconnect this account.${imapOff}`;
    }
    if (presetKeyForHost(host) === 'outlook') {
      // An account saved with a password before Microsoft switched password sign-in off.
      return 'Microsoft no longer accepts passwords for IMAP. Add this account again with "Sign in with Microsoft" to switch it over.';
    }
    if (/application-specific password|app password|\bASP\b/i.test(text)) {
      return 'This account needs an app password instead of your normal password. Create one in your account security settings.';
    }
    if (/web ?login required|please log ?in via your web browser/i.test(text)) {
      return 'Your provider wants you to sign in through its website first (a security check). Sign in there, then try again.';
    }
    if (/imap (access )?(is )?disabled|enable imap|not enabled for imap/i.test(text)) {
      return `IMAP access is turned off for this account. Turn it on in your email provider's settings, then try again.${hint ? ` ${hint}` : ''}`;
    }
    if (/too many|rate|try again later/i.test(text) && !/password/i.test(text)) {
      return `The mail server temporarily refused the login: ${truncate(serverText || message)}`;
    }
    return `Wrong email or password. ${hint || 'Many providers (Gmail, Yahoo, iCloud) require an app password instead of your normal password.'}`;
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'EAI_NONAME') {
    return `Could not find the mail server ${host}. Check the server name for typos.`;
  }
  if (code === 'ECONNREFUSED') {
    return `Could not reach ${where} — the server refused the connection. Check the server name and port.`;
  }
  if (code === 'ETIMEDOUT' || code === 'CONNECT_TIMEOUT' || code === 'ETIMEOUT' || code === 'ESOCKETTIMEDOUT') {
    return `Timed out connecting to ${where}. Check the server name, port and security setting.`;
  }
  if (code === 'GREETING_TIMEOUT') {
    return `${where} did not respond like a mail server. Check the port and the security setting (TLS vs STARTTLS).`;
  }
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return `Could not reach ${where} — the network is unreachable.`;
  }
  if (CERT_CODES.has(code) || /certificate/i.test(message)) {
    if (code === 'CERT_HAS_EXPIRED') return `The security certificate of ${host} has expired, so the connection is not safe.`;
    if (code === 'ERR_TLS_CERT_ALTNAME_INVALID' || code === 'HOSTNAME_MISMATCH') {
      return `The security certificate of ${host} is for a different server name. Check the server name.`;
    }
    return `The security certificate of ${host} is not trusted (it may be self-signed), so the connection is not safe.`;
  }
  if (code === 'ERR_SSL_WRONG_VERSION_NUMBER' || /wrong version number|unknown protocol|packet length too long/i.test(message)) {
    return `Could not start a secure connection to ${where}. This port may expect STARTTLS or no encryption — check the security setting (TLS is usually port 993, STARTTLS port 143).`;
  }
  if (err.tlsFailed) {
    if (/does not support STARTTLS/i.test(message)) {
      return `${host} does not support STARTTLS on port ${port || 143}. Try TLS on port 993.`;
    }
    return `Could not start a secure connection to ${where}. Check the security setting.`;
  }
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'EConnectionClosed' || code === 'NoConnection' || code === 'ClosedAfterConnectText' || code === 'ClosedAfterConnectTLS') {
    return 'The mail server closed the connection unexpectedly. Try again in a moment.';
  }
  if (code === 'ETHROTTLE') return 'The mail server is limiting how often we can connect. It will be retried automatically.';
  if (code === 'LockTimeout') return 'The mailbox was busy. Try again in a moment.';
  if (err.mailboxMissing) return `The folder "${err.path || 'INBOX'}" was not found on the mail server.`;
  if (serverText) return `The mail server said: ${truncate(serverText)}`;
  if (message && message !== 'Command failed') return `Mail server error: ${truncate(message)}`;
  return 'Unknown error talking to the mail server.';
}

module.exports = {
  buildImapOptions,
  buildConnectionOptions,
  connect,
  withImap,
  verifyLogin,
  findSpecialMailbox,
  pickSpecialMailbox,
  isGmail,
  friendlyImapError,
  isAuthFailure,
  isTransientLoginRefusal,
  toUidSet,
  safeLogout,
};
