'use strict';

/**
 * /api/accounts — the user's connected mailboxes — and /api/sync (refresh everything).
 *
 * Password accounts are verified against the IMAP server BEFORE anything is stored, so a wrong
 * password is never saved. Secrets are encrypted (crypto.encryptJson) and never leave the server:
 * every response goes through queries.toAccountJson, which copies an explicit list of fields.
 */

const express = require('express');
const { HttpError } = require('../errors');
const { requireAuth, asyncHandler } = require('../middleware');
const { PRESETS, guessPresetForEmail, presetHostForEmail, isMicrosoftImapHost, alternateUsername } = require('../providers');
const imap = require('../imap');
const smtp = require('../smtp');
const compose = require('../compose');
const netguard = require('../netguard');
const queries = require('../queries');

const { validate } = queries;

const MAX_EMAIL = 254;
const MAX_PASSWORD = 1024;
const MAX_DISPLAY_NAME = 60;
const MAX_IMAP_USER = 254;
const MAX_SENDER_NAME = 100;
const MAX_SIGNATURE_BYTES = 20 * 1024;
const SECURITY_VALUES = ['tls', 'starttls', 'none'];
const SMTP_FIELDS = ['smtpHost', 'smtpPort', 'smtpSecurity', 'smtpUser', 'smtpPassword'];
// eslint-disable-next-line no-control-regex
const HAS_CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const SYNC_WAIT_MS = 45000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;

// Each login check opens a connection to a host the user chose; cap them per user so the
// server cannot be used to guess passwords or probe ports at speed.
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_MAX = 30;

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

function requireEmail(value) {
  const email = validate.optionalText(value, { field: 'Email address', max: MAX_EMAIL, allowEmpty: false });
  if (!EMAIL_RE.test(email)) throw validate.badRequest('Enter the full email address, like name@example.com.', 'INVALID_EMAIL');
  return email;
}

function requireProvider(value) {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(PRESETS, value)) {
    throw validate.badRequest('Unknown email provider.', 'INVALID_PROVIDER');
  }
  return value;
}

function requirePassword(value) {
  if (typeof value !== 'string' || value === '') throw validate.badRequest('Enter the password for this account.', 'PASSWORD_REQUIRED');
  if (value.length > MAX_PASSWORD) throw validate.badRequest('That password is too long.', 'VALIDATION');
  // Not trimmed: spaces can be part of a password (Google shows app passwords with spaces).
  return value;
}

function requireHost(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw validate.badRequest('Enter the IMAP server name (for example imap.example.com).', 'HOST_REQUIRED');
  }
  const host = netguard.normalizeHost(value);
  if (!host) throw validate.badRequest('Enter a valid mail server name, like imap.example.com.', 'HOST_NOT_ALLOWED');
  return host;
}

function requirePort(value) {
  const n = typeof value === 'string' && /^\d{1,5}$/.test(value.trim()) ? Number(value.trim()) : value;
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw validate.badRequest('The port must be a number between 1 and 65535.', 'INVALID_PORT');
  return n;
}

function requireSecurity(value) {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!SECURITY_VALUES.includes(s)) throw validate.badRequest('Security must be one of: tls, starttls, none.', 'INVALID_SECURITY');
  return s;
}

const given = (v) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');

function requireSmtpHost(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw validate.badRequest('Enter the outgoing (SMTP) server name, for example smtp.example.com.', 'HOST_REQUIRED');
  }
  const host = netguard.normalizeHost(value);
  if (!host) throw validate.badRequest('Enter a valid outgoing server name, like smtp.example.com.', 'HOST_NOT_ALLOWED');
  return host;
}

function requireSmtpPassword(value) {
  if (typeof value !== 'string' || value === '') throw validate.badRequest('Enter the password for the outgoing server.', 'PASSWORD_REQUIRED');
  if (value.length > MAX_PASSWORD) throw validate.badRequest('That password is too long.', 'VALIDATION');
  return value;
}

/** The From display name: one line of text, or null to use the Mailtabs user's name. */
function readSenderName(value) {
  const name = validate.optionalText(value, { field: 'Sender name', max: MAX_SENDER_NAME });
  if (name && HAS_CONTROL.test(name)) throw validate.badRequest('The sender name cannot contain line breaks or control characters.');
  return name;
}

/** A signature, sanitised with the same allow-list as outgoing mail; null when empty. */
function readSignature(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw validate.badRequest('The signature must be text.');
  const tooLarge = () =>
    validate.badRequest(`The signature is too long (at most ${MAX_SIGNATURE_BYTES / 1024} KB). Remove images or formatting.`, 'SIGNATURE_TOO_LARGE');
  if (Buffer.byteLength(value, 'utf8') > MAX_SIGNATURE_BYTES * 2) throw tooLarge();
  const clean = compose.sanitizeOutgoingHtml(value);
  if (Buffer.byteLength(clean, 'utf8') > MAX_SIGNATURE_BYTES) throw tooLarge();
  // A signature with no visible content (e.g. "<p><br></p>") is no signature.
  const visible = clean.replace(/<(?!img\b)[^>]*>/gi, '').replace(/&nbsp;|\s/g, '');
  return visible ? clean : null;
}

/**
 * Outgoing-server fields of a request body ({ smtpHost, smtpPort, smtpSecurity, smtpUser,
 * smtpPassword }) as account columns; only the fields that were given. `smtpHost: ''` / null
 * clears the account's own outgoing settings (back to the provider's default, if any).
 */
function readSmtpColumns(body) {
  const cols = {};
  if (body.smtpHost !== undefined) {
    if (body.smtpHost === null || (typeof body.smtpHost === 'string' && !body.smtpHost.trim())) {
      return { clear: true, cols: { smtp_host: null, smtp_port: null, smtp_security: null, smtp_user: null, smtp_secret_enc: null } };
    }
    cols.smtp_host = requireSmtpHost(body.smtpHost);
  }
  if (given(body.smtpPort)) cols.smtp_port = requirePort(body.smtpPort);
  if (given(body.smtpSecurity)) cols.smtp_security = requireSecurity(body.smtpSecurity);
  // An empty username means "the default" (the mailbox's own username).
  if (body.smtpUser !== undefined) cols.smtp_user = validate.optionalText(body.smtpUser, { field: 'SMTP username', max: MAX_IMAP_USER });
  const password = given(body.smtpPassword) ? requireSmtpPassword(body.smtpPassword) : null;
  return { clear: false, cols, password };
}

/**
 * Connection settings for a new password account: the body's values, else the provider preset.
 * `alternateUser` is a second username to try if the login fails (iCloud/Yandex may want only the
 * part before the @); never set when the user typed a username themselves.
 * Microsoft accounts are refused (OAUTH_REQUIRED) before a password is even asked for.
 * @returns {{ provider, email, password, host, port, security, user, alternateUser }}
 */
function readNewConnection(body, config) {
  const email = requireEmail(body.email);
  const provider = given(body.provider) ? requireProvider(body.provider) : guessPresetForEmail(email);
  const preset = PRESETS[provider];
  const host = given(body.imapHost) ? requireHost(body.imapHost) : presetHostForEmail(provider, email);
  assertPasswordLoginPossible(config, { provider, host });
  const password = requirePassword(body.password);
  if (!host) throw validate.badRequest('Enter the IMAP server name (for example imap.example.com).', 'HOST_REQUIRED');
  const port = given(body.imapPort) ? requirePort(body.imapPort) : preset.imapPort;
  const security = given(body.imapSecurity) ? requireSecurity(body.imapSecurity) : preset.imapSecurity;
  const typedUser = validate.optionalText(body.imapUser, { field: 'Username', max: MAX_IMAP_USER });
  const user = typedUser || email;
  const alternateUser = typedUser ? null : alternateUsername(provider, user, email);
  return { provider, email, password, host, port, security, user, alternateUser };
}

/**
 * Microsoft turned off password sign-in for IMAP everywhere (Outlook.com since September 2024,
 * every Microsoft 365 tenant for good), so a password login can only fail: refuse it up front.
 */
function assertPasswordLoginPossible(config, { provider, host }) {
  if (provider !== 'outlook' && !isMicrosoftImapHost(host)) return;
  let message =
    'Microsoft accounts (Outlook.com, Hotmail, Live and Microsoft 365) no longer accept passwords or app passwords for IMAP. ' +
    'Connect this account with "Sign in with Microsoft" instead.';
  if (!(config && config.microsoft && config.microsoft.enabled)) {
    message +=
      " Microsoft sign-in isn't set up on this server yet: the site owner needs to set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET (see the README).";
  }
  throw validate.badRequest(message, 'OAUTH_REQUIRED');
}

function isUniqueViolation(err) {
  return !!(err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT'));
}

/** Copy only the fields a sync result is documented to have (never anything internal). */
function publicSyncResult(r, accountId) {
  if (!r || typeof r !== 'object') return { accountId, ok: false, error: 'Sync did not report a result.' };
  const out = { accountId: r.accountId ?? accountId, ok: !!r.ok };
  for (const key of ['newMessages', 'removed', 'updated']) if (Number.isFinite(r[key])) out[key] = r[key];
  if (r.pending) out.pending = true;
  if (r.error) out.error = String(r.error);
  return out;
}

function withTimeout(promise, ms, onTimeout) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(onTimeout()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------------------------

module.exports = function accountsRoutes({ db, config, crypto, syncManager }) {
  const router = express.Router();
  router.use(requireAuth);
  const imapDeps = { db, crypto, config };
  // For canSend (OAuth grants) and SMTP checks.
  const jsonDeps = { deps: imapDeps };

  // --- per-user budget for IMAP login checks ---------------------------------------------
  const verifyBudget = new Map(); // userId -> { count, resetAt }
  function spendVerifyBudget(userId) {
    const now = Date.now();
    for (const [k, v] of verifyBudget) if (v.resetAt <= now) verifyBudget.delete(k);
    let entry = verifyBudget.get(userId);
    if (!entry) {
      entry = { count: 0, resetAt: now + VERIFY_WINDOW_MS };
      verifyBudget.set(userId, entry);
    }
    entry.count += 1;
    if (entry.count > VERIFY_MAX) {
      throw new HttpError(429, 'Too many login checks. Wait a few minutes and try again.', 'RATE_LIMITED');
    }
  }

  /** Check the login; resolves with the username that worked (conn.user or conn.alternateUser). */
  async function verify(userId, conn) {
    spendVerifyBudget(userId);
    // Throws HttpError 400 with a friendly message (IMAP_AUTH_FAILED, IMAP_CONNECT_FAILED,
    // HOST_NOT_ALLOWED, HOST_NOT_FOUND, INSECURE_NOT_ALLOWED, ...); passed through as-is.
    const result = await imap.verifyLogin(imapDeps, {
      host: conn.host,
      port: conn.port,
      security: conn.security,
      user: conn.user,
      password: conn.password,
      alternateUser: conn.alternateUser || undefined,
    });
    return (result && result.user) || conn.user;
  }

  /** Check an outgoing-server login (same per-user budget as IMAP checks); throws HttpError. */
  async function verifyOutgoing(userId, settings, password) {
    spendVerifyBudget(userId);
    return smtp.verifySmtp(imapDeps, { host: settings.host, port: settings.port, security: settings.security, user: settings.user, password });
  }

  /** Start a background sync. Must be called after the account's status is set to 'pending'. */
  function kickSync(accountId) {
    Promise.resolve()
      .then(() => syncManager.syncAccount(accountId))
      .catch((err) => console.error(`[accounts] background sync of account ${accountId} failed:`, err));
  }

  function loadAccount(userId, rawId) {
    const id = validate.requireId(rawId, 'account id');
    const row = queries.getAccountRowForUser(db, userId, id);
    if (!row) throw new HttpError(404, 'Account not found', 'NOT_FOUND');
    return row;
  }

  /** The password inside an encrypted secret, or null when it can't be read. */
  function readSavedPassword(secretEnc) {
    if (!secretEnc) return null;
    try {
      const secret = crypto.decryptJson(secretEnc) || {};
      return typeof secret.password === 'string' && secret.password ? secret.password : null;
    } catch (_) {
      return null;
    }
  }

  /** tabIds from a body, validated as the user's own tabs. */
  function readTabIds(userId, value) {
    if (value === undefined || value === null) return [];
    const ids = validate.requireIdList(value, { what: 'tabIds', max: 100 });
    if (!ids.length) return ids;
    const owned = new Set(
      db
        .prepare(`SELECT id FROM tabs WHERE user_id = ? AND id IN (${ids.map(() => '?').join(', ')})`)
        .all(userId, ...ids)
        .map((r) => r.id)
    );
    if (ids.some((id) => !owned.has(id))) throw validate.badRequest('One of the selected tabs does not exist.', 'INVALID_TAB');
    return ids;
  }

  const findByEmail = db.prepare('SELECT id FROM accounts WHERE user_id = ? AND email = ? COLLATE NOCASE');
  const insertTabAccount = db.prepare('INSERT OR IGNORE INTO tab_accounts (tab_id, account_id) VALUES (?, ?)');
  const findOwnTab = db.prepare('SELECT 1 FROM tabs WHERE id = ? AND user_id = ?');
  const duplicate = () => new HttpError(409, 'This email account is already connected.', 'ACCOUNT_EXISTS');

  router.get('/', (req, res) => {
    res.json({ accounts: queries.listAccountsJson(db, req.user.id, jsonDeps) });
  });

  router.post(
    '/test',
    asyncHandler(async (req, res) => {
      const conn = readNewConnection(validate.requireBody(req), config);
      const user = await verify(req.user.id, conn);
      res.json(user === conn.user ? { ok: true } : { ok: true, imapUser: user });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const body = validate.requireBody(req);
      const conn = readNewConnection(body, config);
      const displayName = validate.optionalText(body.displayName, { field: 'Display name', max: MAX_DISPLAY_NAME });
      // Without a chosen colour, the account gets the first palette colour its siblings don't use.
      const color = given(body.color) ? validate.requireColor(body.color) : null;
      const tabIds = readTabIds(userId, body.tabIds);
      const senderName = body.senderName === undefined ? null : readSenderName(body.senderName);
      const signatureHtml = body.signatureHtml === undefined ? null : readSignature(body.signatureHtml);
      const outgoing = readSmtpColumns(body);
      const smtpCols = outgoing.clear ? {} : outgoing.cols;

      // Cheap checks first; then the (slow) login check; only then store anything.
      if (findByEmail.get(userId, conn.email)) throw duplicate();
      conn.user = await verify(userId, conn);

      // Sending is checked after the mailbox works. A problem there never blocks adding the
      // account (reading mail is the main thing); the user is told what to fix instead.
      const warnings = [];
      const smtpSettings = smtp.smtpSettingsFor({
        provider: conn.provider,
        auth_type: 'password',
        email: conn.email,
        imap_host: conn.host,
        imap_user: conn.user,
        ...smtpCols,
      });
      if (!smtpSettings.host) {
        warnings.push('Sending is not set up yet: add the outgoing (SMTP) server in the account settings.');
      } else {
        try {
          await verifyOutgoing(userId, smtpSettings, outgoing.password !== null && outgoing.password !== undefined ? outgoing.password : conn.password);
        } catch (err) {
          warnings.push(`Sending is not set up yet: ${err && err.expose === true ? err.message : smtp.friendlySmtpError(err)}`);
        }
      }

      let accountId;
      try {
        accountId = db.transaction(() => {
          if (findByEmail.get(userId, conn.email)) throw duplicate(); // added while we were verifying
          const info = db
            .prepare(
              `INSERT INTO accounts (user_id, provider, auth_type, email, display_name, color, imap_host, imap_port,
                                     imap_security, imap_user, secret_enc, mailbox, status, created_at,
                                     smtp_host, smtp_port, smtp_security, smtp_user, smtp_secret_enc, sender_name, signature_html)
               VALUES (?, ?, 'password', ?, ?, ?, ?, ?, ?, ?, ?, 'INBOX', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              userId,
              conn.provider,
              conn.email,
              displayName,
              color || queries.nextAccountColor(db, userId),
              conn.host,
              conn.port,
              conn.security,
              conn.user,
              crypto.encryptJson({ password: conn.password }),
              Date.now(),
              smtpCols.smtp_host ?? null,
              smtpCols.smtp_port ?? null,
              smtpCols.smtp_security ?? null,
              smtpCols.smtp_user ?? null,
              outgoing.password ? crypto.encryptJson({ password: outgoing.password }) : null,
              senderName,
              signatureHtml
            );
          const id = Number(info.lastInsertRowid);
          // A tab could have been deleted during the login check; attach only those still there.
          for (const tabId of tabIds) {
            if (findOwnTab.get(tabId, userId)) insertTabAccount.run(tabId, id);
          }
          return id;
        })();
      } catch (err) {
        if (isUniqueViolation(err)) throw duplicate();
        throw err;
      }

      kickSync(accountId);
      res.status(201).json({ account: queries.getAccountJson(db, userId, accountId, jsonDeps), warnings });
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const account = loadAccount(userId, req.params.id);
      const body = validate.requireBody(req);

      const sets = {};
      if (body.displayName !== undefined) {
        sets.display_name = validate.optionalText(body.displayName, { field: 'Display name', max: MAX_DISPLAY_NAME });
      }
      if (body.color !== undefined) sets.color = validate.requireColor(body.color);
      if (body.senderName !== undefined) sets.sender_name = readSenderName(body.senderName);
      if (body.signatureHtml !== undefined) sets.signature_html = readSignature(body.signatureHtml);
      const tabIds = body.tabIds === undefined ? undefined : readTabIds(userId, body.tabIds);
      const outgoing = readSmtpColumns(body);

      // Connection settings: start from the stored ones and apply what the body changes.
      const conn = { host: account.imap_host, port: account.imap_port, security: account.imap_security, user: account.imap_user };
      if (given(body.imapHost)) conn.host = requireHost(body.imapHost);
      if (given(body.imapPort)) conn.port = requirePort(body.imapPort);
      if (given(body.imapSecurity)) conn.security = requireSecurity(body.imapSecurity);
      if (given(body.imapUser)) conn.user = validate.optionalText(body.imapUser, { field: 'Username', max: MAX_IMAP_USER });
      const newPassword = given(body.password) ? requirePassword(body.password) : null;

      const mailboxChanged = conn.host !== account.imap_host || conn.user !== account.imap_user;
      const connectionChanged = mailboxChanged || conn.port !== account.imap_port || conn.security !== account.imap_security;

      // Outgoing server: what it is now, and what it would be after this change.
      const smtpBefore = smtp.smtpSettingsFor(account);
      const smtpAfter = smtp.smtpSettingsFor({
        ...account,
        imap_host: conn.host,
        imap_user: conn.user,
        ...outgoing.cols,
      });
      const smtpEndpointChanged =
        smtpAfter.host !== smtpBefore.host || smtpAfter.port !== smtpBefore.port || smtpAfter.security !== smtpBefore.security;
      // Only fields the user sent count: when just the IMAP server changes, the provider's
      // default outgoing server simply follows it (that IMAP login was checked with a typed password).
      const smtpFieldsGiven = SMTP_FIELDS.some((key) => body[key] !== undefined);
      const smtpChanged =
        smtpFieldsGiven && !outgoing.clear && (smtpEndpointChanged || smtpAfter.user !== smtpBefore.user || !!outgoing.password);

      if (account.auth_type === 'oauth' && (connectionChanged || newPassword || smtpChanged || outgoing.clear)) {
        throw validate.badRequest(
          'This account signs in with Google or Microsoft — reconnect it instead of changing its password or server.',
          'OAUTH_ACCOUNT'
        );
      }
      if (connectionChanged || newPassword) assertPasswordLoginPossible(config, { provider: account.provider, host: conn.host });

      // The stored password may only ever be sent to the server it was saved for. Pointing the
      // account at another server (or downgrading its encryption) needs the password typed again,
      // otherwise a hijacked Mailtabs session could redirect the saved app password to itself.
      const endpointChanged = conn.host !== account.imap_host || conn.port !== account.imap_port || conn.security !== account.imap_security;
      if (endpointChanged && newPassword === null) {
        throw validate.badRequest('Enter the password for this account again to change its server settings.', 'PASSWORD_REQUIRED');
      }

      if (connectionChanged || newPassword) {
        let password = newPassword;
        if (password === null) {
          try {
            password = (crypto.decryptJson(account.secret_enc) || {}).password;
          } catch (_) {
            password = null;
          }
          if (!password) throw validate.badRequest('Enter the password for this account again.', 'PASSWORD_REQUIRED');
        }
        // Unless a username was given, iCloud/Yandex logins may retry with the other username form.
        const alternateUser = given(body.imapUser) ? null : alternateUsername(account.provider, conn.user, account.email);
        // The same mailbox under another login name: mailboxChanged stays as computed above.
        conn.user = await verify(userId, { ...conn, password, alternateUser });
        Object.assign(sets, {
          imap_host: conn.host,
          imap_port: conn.port,
          imap_security: conn.security,
          imap_user: conn.user,
          status: 'pending',
          last_error: null,
        });
        if (newPassword !== null) sets.secret_enc = crypto.encryptJson({ password: newPassword });
        // A different server or login is a different mailbox: its folders and UIDs mean nothing
        // here (sync_state is the pre-folders column, kept empty for older code paths).
        if (mailboxChanged) Object.assign(sets, { sync_state: null, folders_synced_at: null });
      }

      if (smtpChanged) {
        if (!smtpAfter.host) throw validate.badRequest('Enter the outgoing (SMTP) server name first.', 'HOST_REQUIRED');
        // Which password the outgoing server would get: typed now, or one that is saved.
        let smtpPassword = outgoing.password;
        let typed = !!smtpPassword;
        if (!smtpPassword && account.smtp_secret_enc) {
          smtpPassword = readSavedPassword(account.smtp_secret_enc);
        } else if (!smtpPassword) {
          // No separate SMTP password: sending reuses the mailbox password.
          typed = newPassword !== null;
          smtpPassword = newPassword !== null ? newPassword : readSavedPassword(account.secret_enc);
        }
        // Same rule as for the IMAP server: a saved password only ever goes to the server it
        // was saved (and checked) for.
        if (smtpEndpointChanged && !typed) {
          throw validate.badRequest('Enter the password for the outgoing server again to change its settings.', 'PASSWORD_REQUIRED');
        }
        if (!smtpPassword) throw validate.badRequest('Enter the password for the outgoing server.', 'PASSWORD_REQUIRED');
        // Throws 400 SMTP_AUTH_FAILED / SMTP_CONNECT_FAILED (or a policy error): nothing is saved.
        await verifyOutgoing(userId, smtpAfter, smtpPassword);
        Object.assign(sets, outgoing.cols);
        if (outgoing.password) sets.smtp_secret_enc = crypto.encryptJson({ password: outgoing.password });
      } else if (outgoing.clear) {
        Object.assign(sets, outgoing.cols);
      }

      const stillThere = db.transaction(() => {
        if (!queries.getAccountRowForUser(db, userId, account.id)) return false; // removed during the login check
        const columns = Object.keys(sets);
        if (columns.length) {
          // config_version tells a sync still running with the old settings that its writes are stale.
          const bump = sets.status === 'pending' ? ', config_version = config_version + 1' : '';
          db.prepare(`UPDATE accounts SET ${columns.map((c) => `${c} = ?`).join(', ')}${bump} WHERE id = ? AND user_id = ?`).run(
            ...columns.map((c) => sets[c]),
            account.id,
            userId
          );
        }
        if (mailboxChanged) {
          // Folders go with their messages (cascade); the next sync lists the new mailbox.
          db.prepare('DELETE FROM folders WHERE account_id = ?').run(account.id);
          db.prepare('DELETE FROM messages WHERE account_id = ?').run(account.id);
        }
        if (tabIds !== undefined) {
          db.prepare('DELETE FROM tab_accounts WHERE account_id = ?').run(account.id);
          for (const tabId of tabIds) {
            if (findOwnTab.get(tabId, userId)) insertTabAccount.run(tabId, account.id);
          }
        }
        return true;
      })();
      if (!stillThere) throw new HttpError(404, 'Account not found', 'NOT_FOUND');

      if (sets.status === 'pending') kickSync(account.id);
      res.json({ account: queries.getAccountJson(db, userId, account.id, jsonDeps) });
    })
  );

  router.delete('/:id', (req, res) => {
    const userId = req.user.id;
    const account = loadAccount(userId, req.params.id);
    // Messages and tab memberships cascade. Nothing is changed on the mail server.
    db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(account.id, userId);
    res.json({ ok: true });
  });

  router.post(
    '/:id/sync',
    asyncHandler(async (req, res) => {
      const account = loadAccount(req.user.id, req.params.id);
      const result = await withTimeout(
        Promise.resolve().then(() => syncManager.syncAccount(account.id)),
        SYNC_WAIT_MS,
        () => ({ accountId: account.id, ok: false, pending: true })
      );
      res.json({ result: publicSyncResult(result, account.id) });
    })
  );

  return router;
};

/** POST /api/sync — check every account of the signed-in user for new mail. */
module.exports.syncRouter = function syncRouter({ syncManager }) {
  const router = express.Router();
  router.use(requireAuth);
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const results = await syncManager.syncUser(req.user.id, { timeoutMs: SYNC_WAIT_MS });
      res.json({ results: (Array.isArray(results) ? results : []).map((r) => publicSyncResult(r, r && r.accountId)) });
    })
  );
  return router;
};

module.exports.readNewConnection = readNewConnection;
