'use strict';

/**
 * Outgoing mail (SMTP) for an account.
 *
 * Same security policy as imap.js: no plaintext unless ALLOW_PRIVATE_IMAP_HOSTS, the SSRF guard
 * checks the user-supplied host, and the connection is pinned to an address the guard checked
 * while TLS still verifies the certificate against the real host name.
 *
 * Passwords: accounts.smtp_secret_enc ({ password }) when the outgoing server has its own
 * login, else the IMAP secret. OAuth accounts send with XOAUTH2 using the account's (fresh)
 * access token; Microsoft accounts need the SMTP.Send scope (granted since v2).
 *
 * Microsoft accounts whose SMTP AUTH is turned off (5.7.139 — many personal Outlook.com
 * accounts) send through Microsoft Graph instead (graph.js) when they consented to Graph's
 * Mail.Send; accounts.smtp_disabled_at remembers the refusal so later sends go straight there.
 */

const net = require('net');
const nodemailer = require('nodemailer');
const { HttpError } = require('./errors');
const netguard = require('./netguard');
const providers = require('./providers');
const graph = require('./graph');
const { getFreshAccessToken, OAuthError, grantsSendScope, grantsGraphSendScope } = require('./oauth');

const SECURITY_VALUES = ['tls', 'starttls', 'none'];
const TIMEOUTS = Object.freeze({ connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 60000, dnsTimeout: 10000 });
const RECONNECT_TO_SEND = 'Reconnect this account to allow sending (sign in again and accept the permission to send email).';
const SMTP_OFF_RECONNECT =
  'Microsoft has turned off sending from mail apps (SMTP) for this account. Reconnect it (sign in with Microsoft again and accept the permission to send email) so Mailtabs can send through Microsoft Graph instead.';
// Microsoft's "SMTP AUTH is turned off for this mailbox / organisation".
const SMTP_AUTH_DISABLED_RE = /5\.7\.139\b|SmtpClientAuthentication is disabled/i;

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

/**
 * The outgoing server of an account: its own smtp_* columns, else the preset's defaults.
 * @returns {{ host: string, port: number, security: string, user: string }} host '' = not set up
 */
function smtpSettingsFor(account) {
  const preset = providers.presetSmtpSettings(account.provider, { email: account.email, imapHost: account.imap_host });
  // A password account pointed at someone else's IMAP server (a "Yahoo" account whose server
  // was changed to mail.example.org) must not send its saved password to the preset's SMTP
  // server: the provider's default only applies while the IMAP server is the provider's own.
  const presetApplies =
    account.auth_type === 'oauth' || !account.imap_host || providers.presetKeyForHost(account.imap_host) === account.provider;
  const host = String(account.smtp_host || '').trim() || (presetApplies ? preset.host : '') || '';
  const port = Number(account.smtp_port) || preset.port || 465;
  const security = String(account.smtp_security || preset.security || 'tls').toLowerCase();
  let user = String(account.smtp_user || '').trim();
  if (!user) {
    const imapUser = String(account.imap_user || '').trim();
    const wantsEmail = (providers.PRESETS[account.provider] || {}).smtpUser === 'email';
    if (account.auth_type === 'oauth') user = account.email; // XOAUTH2 user= must be the mailbox address
    else if (wantsEmail && !imapUser.includes('@')) user = account.email; // iCloud: bare IMAP name, full SMTP name
    else user = imapUser || account.email;
  }
  return { host, port, security, user };
}

function oauthProviderFor(config, account) {
  return providers.oauthProviderForPreset(config, account.provider);
}

function storedOAuthSecret(crypto, account) {
  try {
    return crypto.decryptJson(account.secret_enc) || {};
  } catch (_) {
    return {};
  }
}

function isMicrosoftOAuth(config, account) {
  if (!account || account.auth_type !== 'oauth') return false;
  const provider = oauthProviderFor(config, account);
  return !!(provider && provider.key === 'microsoft');
}

/**
 * Can this account log in to its outgoing (SMTP) server at all?
 * @returns {{ ok: boolean, code: string|null, message: string|null }}
 */
function smtpLoginStatus(deps, account) {
  const { host } = smtpSettingsFor(account);
  if (!host) {
    return {
      ok: false,
      code: 'SMTP_NOT_CONFIGURED',
      message: 'Sending is not set up for this account yet: add its outgoing (SMTP) server in the account settings.',
    };
  }
  if (account.auth_type === 'oauth') {
    const provider = oauthProviderFor(deps.config, account);
    const granted = grantsSendScope(provider, storedOAuthSecret(deps.crypto, account).grantedScopes);
    // Google's mail scope always includes SMTP. Microsoft accounts connected before sending
    // existed only consented to IMAP (and recorded no scopes), so they must reconnect once.
    const ok = provider && provider.key === 'google' ? granted !== false : granted === true;
    if (!ok) return { ok: false, code: 'SMTP_SCOPE_MISSING', message: RECONNECT_TO_SEND };
  }
  return { ok: true, code: null, message: null };
}

/** May this Microsoft account send through Microsoft Graph (it consented to Mail.Send)? */
function graphSendAvailable(deps, account) {
  if (!isMicrosoftOAuth(deps.config, account)) return false;
  return grantsGraphSendScope(oauthProviderFor(deps.config, account), storedOAuthSecret(deps.crypto, account));
}

/**
 * How this account sends: 'smtp', 'graph' (Microsoft accounts whose SMTP AUTH is off, or that
 * consented to Graph but not to SMTP.Send), or null with the reason it can't.
 * @returns {{ route: 'smtp'|'graph'|null, code: string|null, message: string|null }}
 */
function sendRoute(deps, account) {
  const login = smtpLoginStatus(deps, account);
  const smtpOff = !!account.smtp_disabled_at && isMicrosoftOAuth(deps.config, account);
  if (login.ok && !smtpOff) return { route: 'smtp', code: null, message: null };
  if (graphSendAvailable(deps, account)) return { route: 'graph', code: null, message: null };
  if (smtpOff) return { route: null, code: 'SMTP_SCOPE_MISSING', message: SMTP_OFF_RECONNECT };
  return { route: null, code: login.code, message: login.message };
}

/**
 * Can this account send, and if not, why? For the account JSON (canSend) and the composer.
 * @returns {{ canSend: boolean, code: string|null, message: string|null }}
 */
function sendingStatus(deps, account) {
  const { route, code, message } = sendRoute(deps, account);
  return route ? { canSend: true, code: null, message: null } : { canSend: false, code, message };
}

/** The password for the outgoing server: its own when saved, else the IMAP password. */
function smtpPassword(crypto, account) {
  const enc = account.smtp_secret_enc || account.secret_enc;
  try {
    const secret = crypto.decryptJson(enc) || {};
    return typeof secret.password === 'string' ? secret.password : '';
  } catch (_) {
    throw new HttpError(
      400,
      "The saved password for sending can't be read (the server's secret key changed) — enter it again in the account settings.",
      'SMTP_AUTH_FAILED'
    );
  }
}

/** EHLO name: the app's own host name when it is a real domain, else a neutral literal. */
function ehloName(config) {
  try {
    const host = new URL(config.appUrl).hostname;
    if (host && host.includes('.') && !net.isIP(host) && netguard.normalizeHost(host) === host) return host;
  } catch (_) {
    /* fall through */
  }
  return '[127.0.0.1]';
}

/**
 * nodemailer transport options for explicit connection parameters (security policy, SSRF
 * guard, IP pinning, timeouts). `auth` is passed through.
 */
async function connectionOptions(config, { host, port, security, auth }) {
  const sec = String(security || 'tls').toLowerCase();
  if (!SECURITY_VALUES.includes(sec)) {
    throw new HttpError(400, 'Security must be one of: tls, starttls, none.', 'INVALID_SECURITY');
  }
  if (sec === 'none' && !config.allowPrivateHosts) {
    throw new HttpError(
      400,
      'Unencrypted SMTP connections are not allowed. Choose TLS (usually port 465) or STARTTLS (usually port 587).',
      'INSECURE_NOT_ALLOWED'
    );
  }
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    throw new HttpError(400, 'The port must be a number between 1 and 65535.', 'INVALID_PORT');
  }
  if (!auth || !auth.user) throw new HttpError(400, 'A username for the outgoing server is required.', 'INVALID_USER');

  const guard = await netguard.assertAllowedHost(host, { allowPrivate: !!config.allowPrivateHosts });
  const hostname = guard.host;
  const pinned = guard.addresses.find((a) => a.family === 4) || guard.addresses[0];
  const isIpHost = net.isIP(hostname) !== 0;

  const options = {
    // Connect to the checked address; certificate checks and SNI use the real name.
    host: pinned ? pinned.address : hostname,
    port: portNum,
    secure: sec === 'tls',
    requireTLS: sec === 'starttls',
    // 'none' means none: no opportunistic upgrade (private test/LAN servers often have
    // self-signed certificates, which would then fail).
    ignoreTLS: sec === 'none',
    name: ehloName(config),
    auth,
    tls: isIpHost ? { minVersion: 'TLSv1.2' } : { servername: hostname, minVersion: 'TLSv1.2' },
    ...TIMEOUTS,
    logger: false,
    debug: false,
    // We only ever hand over Buffers; never let a payload make nodemailer read files or URLs.
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  if (!isIpHost) options.servername = hostname;
  Object.defineProperty(options, 'displayHost', { value: hostname, enumerable: false });
  return options;
}

/**
 * nodemailer createTransport options for an account (auth resolved, OAuth token fresh).
 * Throws HttpError 400 SMTP_NOT_CONFIGURED / SMTP_SCOPE_MISSING / policy errors.
 */
async function buildTransportOptions(deps, account) {
  const status = smtpLoginStatus(deps, account);
  if (!status.ok) throw new HttpError(400, status.message, status.code);
  const settings = smtpSettingsFor(account);
  let auth;
  if (account.auth_type === 'oauth') {
    const accessToken = await getFreshAccessToken(deps, account);
    auth = { type: 'OAuth2', user: settings.user, accessToken };
  } else {
    auth = { user: settings.user, pass: smtpPassword(deps.crypto, account) };
  }
  return connectionOptions(deps.config, { ...settings, auth });
}

// ---------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------

function annotate(err, options) {
  if (err && typeof err === 'object' && options) {
    if (!err.smtpHost) err.smtpHost = options.displayHost || options.host;
    if (!err.smtpPort) err.smtpPort = options.port;
  }
  return err;
}

/**
 * Send a prebuilt message.
 * @param {{ from: string, recipients: string[], raw: Buffer }} message
 * @returns {Promise<{ accepted: string[], rejected: string[], response: string }>}
 * @throws HttpError 400 (setup/policy problems) or 502 with a friendly message; the original
 *   error is `cause`, and `retryable` says whether trying again later may help.
 */
async function sendRaw(deps, account, { from, recipients, raw }) {
  if (!Buffer.isBuffer(raw) || !raw.length) throw new TypeError('sendRaw: raw must be a non-empty Buffer');
  const to = [...new Set((recipients || []).map((r) => String(r || '').trim()).filter(Boolean))];
  if (!to.length) throw new HttpError(400, 'Add at least one recipient.', 'INVALID_COMPOSE');

  let options;
  try {
    options = await buildTransportOptions(deps, account);
  } catch (err) {
    throw wrapSendError(err, { oauth: account.auth_type === 'oauth', email: account.email });
  }
  const transport = nodemailer.createTransport(options);
  try {
    // With the size in the envelope, nodemailer refuses a message over the server's advertised
    // SIZE limit before transmitting it (and announces SIZE= in MAIL FROM).
    const info = await transport.sendMail({ envelope: { from: from || account.email, to, size: raw.length }, raw });
    return {
      accepted: (info.accepted || []).map(String),
      rejected: (info.rejected || []).map(String),
      response: String(info.response || ''),
    };
  } catch (err) {
    throw wrapSendError(annotate(err, options), { oauth: account.auth_type === 'oauth', email: account.email });
  } finally {
    transport.close();
  }
}

function wrapSendError(err, ctx) {
  if (err instanceof HttpError) {
    if (err.retryable === undefined) err.retryable = false;
    return err;
  }
  const kind = classifySmtpError(err);
  const status = kind === 'policy' ? 400 : 502;
  const code = { auth: 'SMTP_AUTH_FAILED', scope: 'SMTP_SCOPE_MISSING', connection: 'SMTP_CONNECT_FAILED' }[kind] || 'SMTP_FAILED';
  const wrapped = new HttpError(status, friendlySmtpError(err, ctx), code);
  wrapped.cause = err;
  wrapped.retryable = isRetryableSmtpError(err);
  return wrapped;
}

/** Remember that Microsoft refused SMTP AUTH for this account (later sends go straight to Graph). */
function markSmtpDisabled(db, account) {
  try {
    db.prepare('UPDATE accounts SET smtp_disabled_at = ? WHERE id = ? AND smtp_disabled_at IS NULL').run(Date.now(), account.id);
  } catch (_) {
    /* account removed meanwhile */
  }
}

function isSmtpAuthDisabled(err) {
  return SMTP_AUTH_DISABLED_RE.test(serverText((err && err.cause) || err)) || SMTP_AUTH_DISABLED_RE.test(serverText(err));
}

/**
 * Send a built message the way the account can: SMTP, or Microsoft Graph for Microsoft
 * accounts whose SMTP AUTH is turned off. A 5.7.139 answer switches the account to Graph for
 * good (when it consented to Graph; else the error says to reconnect).
 * @param {{ from: string, recipients: string[], raw: Buffer, graphRaw?: Buffer|(() => Promise<Buffer>) }} message
 *   graphRaw: the same message with its Bcc header (Graph reads the recipients from the headers);
 *   defaults to raw
 * @returns {Promise<{ accepted: string[], rejected: string[], response: string, via: 'smtp'|'graph' }>}
 * @throws HttpError like sendRaw (`retryable` set)
 */
async function sendMessage(deps, account, message) {
  const { route, code, message: reason } = sendRoute(deps, account);
  if (!route) {
    const err = new HttpError(400, reason, code);
    err.retryable = false;
    throw err;
  }
  if (route === 'smtp') {
    try {
      return { ...(await sendRaw(deps, account, message)), via: 'smtp' };
    } catch (err) {
      if (!isMicrosoftOAuth(deps.config, account) || !isSmtpAuthDisabled(err)) throw err;
      markSmtpDisabled(deps.db, account);
      if (!graphSendAvailable(deps, account)) {
        const wrapped = new HttpError(400, SMTP_OFF_RECONNECT, 'SMTP_SCOPE_MISSING');
        wrapped.cause = err.cause || err;
        wrapped.retryable = false;
        throw wrapped;
      }
      if (deps.logger) deps.logger.warn(`[smtp] ${account.email}: SMTP AUTH is turned off by Microsoft; sending through Microsoft Graph from now on.`);
    }
  }
  const raw = typeof message.graphRaw === 'function' ? await message.graphRaw() : message.graphRaw || message.raw;
  return { ...(await graph.sendMimeViaGraph(deps, account, raw, message.recipients)), via: 'graph' };
}

/**
 * Check that the outgoing server accepts a login, without sending anything.
 * @returns {{ ok: true }} or throws HttpError(400, friendly, 'SMTP_AUTH_FAILED' | 'SMTP_CONNECT_FAILED');
 *   policy errors (HOST_NOT_ALLOWED, INSECURE_NOT_ALLOWED, ...) are thrown as they are.
 */
async function verifySmtp(deps, { host, port, security, user, password, accessToken }) {
  const auth = accessToken ? { type: 'OAuth2', user, accessToken } : { user, pass: password || '' };
  const options = await connectionOptions(deps.config, { host, port, security, auth });
  const transport = nodemailer.createTransport(options);
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    annotate(err, options);
    const kind = classifySmtpError(err);
    const message = friendlySmtpError(err, { host: options.displayHost, port: options.port, oauth: !!accessToken });
    throw new HttpError(400, message, kind === 'auth' || kind === 'scope' ? 'SMTP_AUTH_FAILED' : 'SMTP_CONNECT_FAILED');
  } finally {
    transport.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

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
const CONNECTION_CODES = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ETLS', 'EPROTOCOL', 'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH']);

function serverText(err) {
  return String((err && (err.response || err.message)) || '');
}

function truncate(s, n = 200) {
  const str = String(s || '').replace(/\s+/g, ' ').trim();
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

/** 'auth' | 'scope' | 'recipient' | 'sender' | 'size' | 'limit' | 'connection' | 'temporary' | 'policy' | 'other' */
function classifySmtpError(err) {
  if (!err) return 'other';
  if (err instanceof HttpError || err.expose === true) {
    if (err.code === 'SMTP_SCOPE_MISSING') return 'scope';
    if (err.code === 'SMTP_AUTH_FAILED') return 'auth';
    return 'policy';
  }
  // A token endpoint that could not be reached (oauth_error) may work later; a revoked or
  // refused grant needs the user.
  if (err instanceof OAuthError || err.name === 'OAuthError') return err.code === 'oauth_error' ? 'temporary' : 'auth';
  const text = serverText(err);
  const code = String(err.code || '');
  const original = String(err.originalCode || '');
  const rc = Number(err.responseCode) || 0;
  if (code === 'EAUTH' || code === 'ENOAUTH' || code === 'EOAUTH2' || rc === 535 || rc === 534 || rc === 530) return 'auth';
  if (/5\.7\.30\b|basic authentication is not supported/i.test(text)) return 'auth';
  if (/limit for sending|sending limit|5\.4\.5\b|daily (user )?sending quota|too many (messages|recipients)/i.test(text)) return 'limit';
  const mailboxFull = /5\.2\.2\b|mailbox (is )?full|over ?quota|quota exceeded/i.test(text);
  if (!mailboxFull && (rc === 552 || /5\.3\.4\b|message (size|too (big|large))|too large|exceeds .*size|size limit|larger than allowed/i.test(text))) return 'size';
  // A 4xx answer to the envelope (greylisting, "try again later") is worth another attempt.
  if (code === 'EENVELOPE' && rc >= 400 && rc < 500) return 'temporary';
  if (/5\.7\.60\b|send ?as|not (allowed|authori[sz]ed) to send|sender address rejected|5\.1\.8\b|bad outbound sender/i.test(text)) return 'sender';
  if (code === 'EENVELOPE') return err.command === 'MAIL FROM' ? 'sender' : 'recipient';
  if (CONNECTION_CODES.has(code) || CONNECTION_CODES.has(original) || CERT_CODES.has(original) || rc === 421) return 'connection';
  if (rc >= 400 && rc < 500) return 'temporary';
  return 'other';
}

/** Trying again later may help (connection problems, 4xx answers) — never for auth/recipient errors. */
function isRetryableSmtpError(err) {
  if (!err || err.permanent === true) return false;
  const kind = classifySmtpError(err);
  if (kind === 'connection') return !CERT_CODES.has(String(err.originalCode || '')) && String(err.originalCode || '') !== 'ENOTFOUND';
  return kind === 'temporary';
}

function sizeText(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/** "Too large for Gmail (it accepts at most 35 MB …)" — the limit when the server announced one. */
function tooLargeMessage(err, presetKey, host) {
  const label = presetKey && presetKey !== 'imap' && providers.PRESETS[presetKey] ? providers.PRESETS[presetKey].label : null;
  const who = label || (host && host !== 'the outgoing mail server' ? host : 'the mail server');
  const limit = Number((serverText(err).match(/larger than allowed (\d+)/i) || [])[1]) || 0;
  const detail = limit ? ` (it accepts at most ${sizeText(limit)} per message, and attachments grow by about a third when sent)` : '';
  return `This message is too large for ${who}${detail}. Remove some attachments (or share them as links) and try again.`;
}

/** Microsoft's "SMTP AUTH is turned off" answers (5.7.139), with the right advice. */
function smtpAuthDisabledMessage(text, email) {
  if (/for the tenant/i.test(text)) {
    return 'Your Microsoft 365 administrator has turned off sending from mail apps (SMTP AUTH) for your organisation. Ask them to allow "Authenticated SMTP" for your mailbox.';
  }
  if (providers.isMicrosoftConsumerEmail(email)) {
    return 'Microsoft has turned off sending from mail apps (SMTP AUTH) for this Outlook.com account, and offers no setting to turn it back on. Send from Outlook.com itself, or from another account.';
  }
  return 'Sending from mail apps (Authenticated SMTP) is turned off for this mailbox. Ask your administrator to enable it: Microsoft 365 admin center → Users → Active users → your user → Mail → Manage email apps → Authenticated SMTP.';
}

/**
 * Turn a nodemailer / socket / OAuth error into a sentence a non-technical user can act on.
 * @param {{ host?: string, port?: number, oauth?: boolean, email?: string }} [ctx]
 */
function friendlySmtpError(err, ctx = {}) {
  if (!err) return 'Unknown error talking to the outgoing mail server.';
  if (err instanceof HttpError || err.expose === true) return err.message;
  if (err instanceof OAuthError || err.name === 'OAuthError') return err.message;

  const host = ctx.host || err.smtpHost || 'the outgoing mail server';
  const port = ctx.port || err.smtpPort;
  const where = port ? `${host}:${port}` : host;
  const text = serverText(err);
  const code = String(err.code || '');
  const original = String(err.originalCode || '');
  const kind = classifySmtpError(err);
  const presetKey = providers.presetKeyForSmtpHost(host);

  if (/5\.7\.139\b|SmtpClientAuthentication is disabled/i.test(text)) return smtpAuthDisabledMessage(text, ctx.email);
  if (/5\.7\.30\b|basic authentication is not supported/i.test(text)) {
    return 'Microsoft no longer accepts passwords for sending. Add this account again with "Sign in with Microsoft".';
  }
  if (kind === 'auth') {
    if (code === 'ENOAUTH') return 'No login is saved for the outgoing mail server. Enter the SMTP username and password in the account settings.';
    if (ctx.oauth || code === 'EOAUTH2' || /XOAUTH2/i.test(String(err.command || ''))) {
      return `The mail server did not accept this account's sign-in for sending. ${RECONNECT_TO_SEND}`;
    }
    const hint = presetKey ? (providers.PRESETS[presetKey] || {}).authFailureHint : '';
    if (/application-specific password|app password|\bASP\b/i.test(text)) {
      return 'Sending needs an app password instead of your normal password. Create one in your account security settings and enter it in the account settings.';
    }
    return `The outgoing mail server rejected the username or password. ${hint || 'Many providers (Gmail, Yahoo, iCloud) need an app password instead of your normal password.'}`;
  }
  if (kind === 'limit') {
    return "You have reached your provider's sending limit. Try again later — the limit resets within 24 hours.";
  }
  if (kind === 'size') return tooLargeMessage(err, presetKey, host);
  if (kind === 'sender') {
    if (/5\.1\.8\b|bad outbound sender/i.test(text)) {
      return 'Your provider has blocked sending from this account, often after suspected spam. Sign in on its website to unblock it.';
    }
    return `The mail server won't let this account send as this address. The From address must be the mailbox you signed in with. (${truncate(text, 150)})`;
  }
  if (kind === 'recipient') {
    const rejected = Array.isArray(err.rejected) ? err.rejected.map(String).filter(Boolean) : [];
    const list = rejected.length ? `: ${truncate(rejected.join(', '), 150)}` : '';
    return `The mail server refused the recipient address${rejected.length === 1 ? '' : 'es'}${list}. Check the address${rejected.length === 1 ? '' : 'es'} and try again.`;
  }

  if (code === 'EDNS' || original === 'ENOTFOUND' || original === 'EAI_AGAIN' || code === 'ENOTFOUND') {
    return `Could not find the outgoing mail server ${host}. Check the server name for typos.`;
  }
  if (original === 'ECONNREFUSED' || code === 'ECONNREFUSED') {
    return `Could not reach ${where} — the server refused the connection. Check the outgoing server name and port.`;
  }
  if (CERT_CODES.has(original) || CERT_CODES.has(code) || /certificate/i.test(text)) {
    if (original === 'CERT_HAS_EXPIRED') return `The security certificate of ${host} has expired, so the connection is not safe.`;
    if (original === 'ERR_TLS_CERT_ALTNAME_INVALID' || original === 'HOSTNAME_MISMATCH') {
      return `The security certificate of ${host} is for a different server name. Check the outgoing server name.`;
    }
    return `The security certificate of ${host} is not trusted (it may be self-signed), so the connection is not safe.`;
  }
  if (/wrong version number|unknown protocol|packet length too long/i.test(text)) {
    return `Could not start a secure connection to ${where}. This port may expect STARTTLS instead — check the security setting (TLS is usually port 465, STARTTLS port 587).`;
  }
  if (/STARTTLS/i.test(text) && (code === 'ETLS' || /not support|unavailable|required/i.test(text))) {
    return `${host} does not offer STARTTLS on port ${port || 587}. Try TLS on port 465.`;
  }
  if (code === 'ETLS') return `Could not start a secure connection to ${where}. Check the security setting.`;
  if (code === 'ETIMEDOUT' || original === 'ETIMEDOUT') {
    return `Timed out talking to ${where}. Check the outgoing server name, port and security setting.`;
  }
  if (original === 'EHOSTUNREACH' || original === 'ENETUNREACH') return `Could not reach ${where} — the network is unreachable.`;
  if (kind === 'connection') return `The connection to ${where} was lost. Try again in a moment.`;
  if (kind === 'temporary') return `The mail server is temporarily unable to accept the message (${truncate(text, 150)}).`;
  if (err.response) return `The mail server said: ${truncate(err.response)}`;
  if (err.message) return `Sending failed: ${truncate(err.message)}`;
  return 'Unknown error talking to the outgoing mail server.';
}

module.exports = {
  buildTransportOptions,
  connectionOptions,
  verifySmtp,
  sendRaw,
  sendMessage,
  sendRoute,
  friendlySmtpError,
  classifySmtpError,
  isRetryableSmtpError,
  smtpSettingsFor,
  sendingStatus,
  RECONNECT_TO_SEND,
};
