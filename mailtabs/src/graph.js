'use strict';

/**
 * Sending through Microsoft Graph, for Microsoft accounts whose SMTP AUTH is turned off
 * ("535 5.7.139 ... SmtpClientAuthentication is disabled") — the case for many personal
 * Outlook.com accounts, and for tenants that switched SMTP AUTH off.
 *
 * POST /v1.0/me/sendMail with Content-Type text/plain and the base64 of the raw MIME message;
 * 202 means Microsoft accepted it. Graph takes the recipients from the To/Cc/Bcc headers (so the
 * MIME given here must keep its Bcc header) and files the copy in Sent Items itself.
 * Graph requests are limited to about 4 MB, so larger messages are refused before sending.
 */

const { HttpError } = require('./errors');
const netguard = require('./netguard');
const { oauthProviderForPreset } = require('./providers');
const { getGraphAccessToken, forgetGraphAccessToken, OAuthError, GRAPH_RECONNECT_MESSAGE } = require('./oauth');

// Raw MIME size; base64 makes the request about a third larger (Graph's limit is ~4 MB).
const MAX_GRAPH_MIME_BYTES = Math.floor(3.5 * 1024 * 1024);
const REQUEST_TIMEOUT_MS = 60000;
const MAX_ERROR_BODY = 64 * 1024;

function failure(status, message, code, { retryable = false, cause } = {}) {
  const err = new HttpError(status, message, code);
  err.retryable = retryable;
  if (cause) err.cause = cause;
  return err;
}

function megabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tooLarge(size) {
  return failure(
    400,
    `This message is too large to send from this Microsoft account (${size ? `${megabytes(size)}; ` : ''}at most about ${megabytes(MAX_GRAPH_MIME_BYTES)} ` +
      'including attachments). Microsoft has turned off sending from mail apps (SMTP) for it, and the way Mailtabs sends instead ' +
      'only takes smaller messages. Remove some attachments (or share them as links) and try again.',
    'MESSAGE_TOO_LARGE'
  );
}

/** The sendMail URL after the SSRF guard (only a test override can point it anywhere else). */
async function checkedUrl(config, value) {
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    throw failure(500, 'The Microsoft Graph address is misconfigured on this server.', 'GRAPH_MISCONFIGURED');
  }
  if (url.protocol !== 'https:' && !(config.allowPrivateHosts && url.protocol === 'http:')) {
    throw failure(500, 'The Microsoft Graph address must use https.', 'GRAPH_MISCONFIGURED');
  }
  try {
    await netguard.assertAllowedHost(url.hostname, { allowPrivate: !!config.allowPrivateHosts });
  } catch (err) {
    if (err instanceof HttpError && err.code === 'HOST_NOT_FOUND') {
      throw failure(502, `Could not reach Microsoft (${url.hostname}) to send the message. Try again in a moment.`, 'SMTP_CONNECT_FAILED', { retryable: true, cause: err });
    }
    throw err;
  }
  return url.toString();
}

async function readErrorBody(res) {
  let text = '';
  try {
    text = (await res.text()).slice(0, MAX_ERROR_BODY);
  } catch (_) {
    return { code: '', message: '' };
  }
  try {
    const data = JSON.parse(text);
    const e = (data && data.error) || {};
    return { code: typeof e.code === 'string' ? e.code : '', message: typeof e.message === 'string' ? e.message.replace(/\s+/g, ' ').trim().slice(0, 300) : '' };
  } catch (_) {
    return { code: '', message: text.replace(/\s+/g, ' ').trim().slice(0, 300) };
  }
}

/** A Graph error answer as an HttpError the outbox can show (and knows whether to retry). */
function graphFailure(status, { code, message }, retryAfter) {
  const said = message ? ` (${message})` : '';
  if (status === 413 || /MessageSizeExceeded|RequestEntityTooLarge/i.test(code)) return tooLarge(0);
  if (/ExceededMessageLimit|SubmissionQuotaExceeded|ErrorSendLimit|QuotaExceeded.*Send/i.test(code)) {
    return failure(502, "You have reached Microsoft's sending limit for this account. Try again later — the limit resets within 24 hours.", 'SMTP_FAILED');
  }
  if (status === 429) {
    return failure(502, `Microsoft is limiting how fast this account can send${retryAfter ? ` (try again in ${retryAfter} s)` : ''}.`, 'SMTP_FAILED', { retryable: true });
  }
  if (status === 401) {
    return failure(400, `Microsoft did not accept this account's sign-in for sending. ${GRAPH_RECONNECT_MESSAGE}`, 'SMTP_AUTH_FAILED');
  }
  if (/SendAsDenied/i.test(code)) {
    return failure(400, `Microsoft won't let this account send as this address. The From address must be the mailbox you signed in with.${said}`, 'SMTP_FAILED');
  }
  if (/MailboxNotEnabledForRESTAPI|MailboxNotFound|ResourceNotFound/i.test(code) || status === 404) {
    return failure(400, `This mailbox can't send through Microsoft Graph (it may be hosted on an on-premises Exchange server).${said}`, 'SMTP_FAILED');
  }
  if (status === 403) return failure(400, `Microsoft refused to send from this account. ${GRAPH_RECONNECT_MESSAGE}${said}`, 'SMTP_SCOPE_MISSING');
  if (/InvalidRecipients|InvalidRecipient|RecipientNotFound/i.test(code)) {
    return failure(400, `Microsoft refused the recipient address${said}. Check the addresses and try again.`, 'SMTP_FAILED');
  }
  if (/MimeContent/i.test(code)) return failure(400, `Microsoft could not read the message${said}.`, 'SMTP_FAILED');
  if (status >= 500 || status === 408) {
    return failure(502, `Microsoft is temporarily unable to accept the message${said}.`, 'SMTP_FAILED', { retryable: true });
  }
  return failure(502, `Microsoft did not accept the message (HTTP ${status})${said}.`, 'SMTP_FAILED');
}

/**
 * Send a raw MIME message (with its Bcc header) through Microsoft Graph.
 * @param {string[]} recipients the envelope recipients (Graph reports none of its own)
 * @returns {Promise<{ accepted: string[], rejected: string[], response: string }>}
 * @throws HttpError (status 400 for problems the user must fix, 502 otherwise; `retryable` set)
 */
async function sendMimeViaGraph(deps, account, raw, recipients = []) {
  if (!Buffer.isBuffer(raw) || !raw.length) throw new TypeError('sendMimeViaGraph: raw must be a non-empty Buffer');
  if (raw.length > MAX_GRAPH_MIME_BYTES) throw tooLarge(raw.length);
  const provider = oauthProviderForPreset(deps.config, account.provider);
  if (!provider || !provider.graphSendUrl || account.auth_type !== 'oauth') {
    throw failure(400, 'Sending through Microsoft Graph is only possible for accounts connected with "Sign in with Microsoft".', 'SMTP_NOT_CONFIGURED');
  }
  const url = await checkedUrl(deps.config, provider.graphSendUrl);

  let token;
  try {
    token = await getGraphAccessToken(deps, account);
  } catch (err) {
    if (err instanceof OAuthError) {
      // The token endpoint could not be reached: worth another try; anything else needs the user.
      throw failure(err.code === 'oauth_error' ? 502 : 400, err.message, err.code === 'oauth_error' ? 'SMTP_CONNECT_FAILED' : 'SMTP_SCOPE_MISSING', {
        retryable: err.code === 'oauth_error',
        cause: err,
      });
    }
    throw err;
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'text/plain', accept: 'application/json' },
      body: raw.toString('base64'),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw failure(502, 'Could not reach Microsoft to send the message. Try again in a moment.', 'SMTP_CONNECT_FAILED', { retryable: true, cause: err });
  }

  if (res.status === 202 || (res.status >= 200 && res.status < 300)) {
    await res.arrayBuffer().catch(() => null); // let the connection be reused
    return {
      accepted: [...new Set((recipients || []).map(String))],
      rejected: [],
      response: `${res.status} Accepted by Microsoft Graph`,
    };
  }
  if (res.status === 401) forgetGraphAccessToken(deps.db, account.id);
  const retryAfter = Number(res.headers.get('retry-after')) || null;
  throw graphFailure(res.status, await readErrorBody(res), retryAfter);
}

module.exports = { sendMimeViaGraph, MAX_GRAPH_MIME_BYTES };
