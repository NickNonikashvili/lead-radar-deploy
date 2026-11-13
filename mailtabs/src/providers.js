'use strict';

/**
 * Email provider presets (IMAP settings + how users sign in) and the OAuth provider definitions
 * for Google and Microsoft.
 *
 * Presets only describe *defaults*; the account form lets the user override host/port/security.
 * Besides the fields sent to the browser (see publicPresets), a preset may have:
 *   otherHosts        further IMAP hosts of the provider (used to recognise it by host name)
 *   usernameFallback  'localPart': the provider may want only the part before the @ as the IMAP
 *                     username, so a failed login is retried once with the other form
 *   authFailureHint   added to the "wrong password" message for this provider's servers
 *
 * Sending (SMTP) fields:
 *   smtpHost/smtpPort/smtpSecurity  the default outgoing server
 *   smtpHostByDomain     outgoing host for particular email domains (sent to the browser)
 *   smtpHostForImapHost  outgoing host that belongs to a particular IMAP host (Zoho paid plans, GMX.net)
 *   otherSmtpHosts       further SMTP hosts of the provider (to recognise it by host name)
 *   smtpUser             'email': the SMTP username is the full address even when the IMAP one is not
 *   sentCopy             'server' when the provider's SMTP server files a copy in Sent itself,
 *                        'append' when the client has to APPEND one
 *   sentCopyUnverified   the provider does not document it either way: look for a server copy
 *                        (by Message-ID) a little later before appending
 *
 * Help texts follow the providers' own documentation as checked on 2026-11-12; SMTP settings
 * as checked on 2026-11-13.
 */

const PRESET_ORDER = ['gmail', 'outlook', 'yahoo', 'icloud', 'aol', 'fastmail', 'zoho', 'gmx', 'yandex', 'imap'];

// Personal Microsoft account domains (Outlook.com, Hotmail, Live, MSN). Any other domain on the
// Outlook preset is a work or school mailbox on Exchange Online.
const OUTLOOK_CONSUMER_DOMAINS = Object.freeze([
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'hotmail.co.uk',
  'outlook.co.uk',
  'passport.com',
  'hotmail.fr',
  'hotmail.de',
  'hotmail.it',
  'hotmail.es',
  'live.co.uk',
  'live.fr',
  'outlook.fr',
  'outlook.de',
]);

const PRESETS = Object.freeze({
  gmail: Object.freeze({
    key: 'gmail',
    label: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecurity: 'tls',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecurity: 'tls',
    // "Sent messages are automatically copied to the Gmail/Sent folder if your email client uses SMTP."
    sentCopy: 'server',
    domains: Object.freeze(['gmail.com', 'googlemail.com']),
    auth: Object.freeze(['oauth', 'password']),
    oauthProvider: 'google',
    passwordHelp:
      'Use a Google App Password (needs 2-Step Verification; not available with Advanced Protection, security-key-only 2-Step Verification or most work and school accounts)',
    passwordHelpUrl: 'https://myaccount.google.com/apppasswords',
    authFailureHint:
      'Gmail needs a Google App Password here, not your normal password. App Passwords need 2-Step Verification and stop working when you change your Google password.',
  }),
  outlook: Object.freeze({
    key: 'outlook',
    label: 'Outlook / Hotmail / Microsoft 365',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecurity: 'tls',
    // Work/school (Exchange Online) mailboxes submit through smtp.office365.com; personal
    // Outlook.com/Hotmail addresses through smtp-mail.outlook.com (see smtpHostByDomain).
    // Port 465 is not supported by either. Exchange files a copy in Sent Items itself.
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    sentCopy: 'server',
    domains: OUTLOOK_CONSUMER_DOMAINS,
    otherHosts: Object.freeze(['outlook.office.com', 'imap-mail.outlook.com']),
    smtpHostByDomain: Object.freeze(Object.fromEntries(OUTLOOK_CONSUMER_DOMAINS.map((d) => [d, 'smtp-mail.outlook.com']))),
    otherSmtpHosts: Object.freeze(['smtp-mail.outlook.com']),
    // Microsoft turned off password (basic auth) sign-in for IMAP everywhere: Outlook.com since
    // 2024-09-16, and every Exchange Online / Microsoft 365 tenant for good (app passwords too).
    auth: Object.freeze(['oauth']),
    oauthProvider: 'microsoft',
    passwordHelp:
      'Microsoft no longer accepts passwords for IMAP (Outlook.com, Hotmail and Microsoft 365) — use "Sign in with Microsoft". Outlook.com users must first turn on IMAP: Settings → Mail → Forwarding and IMAP.',
    passwordHelpUrl: null,
    authFailureHint:
      'For Outlook.com, check that IMAP is turned on: Outlook.com Settings → Mail → Forwarding and IMAP → "Let devices and apps use IMAP".',
  }),
  yahoo: Object.freeze({
    key: 'yahoo',
    label: 'Yahoo Mail',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecurity: 'tls',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 465,
    smtpSecurity: 'tls',
    sentCopy: 'append',
    sentCopyUnverified: true,
    domains: Object.freeze([
      'yahoo.com',
      'ymail.com',
      'rocketmail.com',
      'yahoo.co.uk',
      'yahoo.fr',
      'yahoo.de',
      'yahoo.es',
      'yahoo.it',
      'yahoo.ca',
      'yahoo.com.au',
      'yahoo.co.in',
      'yahoo.com.br',
    ]),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Generate an app password in your Yahoo account security settings',
    passwordHelpUrl: 'https://login.yahoo.com/account/security',
    authFailureHint: 'Yahoo needs an app password (Account Security → Generate app password), not your normal password.',
  }),
  icloud: Object.freeze({
    key: 'icloud',
    label: 'iCloud Mail',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecurity: 'tls',
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    sentCopy: 'append',
    // iCloud's SMTP server wants the full address even when IMAP accepts the bare name.
    smtpUser: 'email',
    domains: Object.freeze(['icloud.com', 'me.com', 'mac.com']),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    usernameFallback: 'localPart',
    passwordHelp:
      'Use an app-specific password from your Apple Account: Sign-In and Security → App-Specific Passwords (needs two-factor authentication)',
    passwordHelpUrl: 'https://account.apple.com',
    authFailureHint:
      'iCloud needs an app-specific password (account.apple.com → Sign-In and Security → App-Specific Passwords), not your Apple Account password.',
  }),
  aol: Object.freeze({
    key: 'aol',
    label: 'AOL Mail',
    imapHost: 'imap.aol.com',
    imapPort: 993,
    imapSecurity: 'tls',
    smtpHost: 'smtp.aol.com',
    smtpPort: 465,
    smtpSecurity: 'tls',
    sentCopy: 'append',
    sentCopyUnverified: true,
    domains: Object.freeze(['aol.com', 'aim.com']),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Generate an app password in your AOL account security settings',
    passwordHelpUrl: 'https://login.aol.com/myaccount/security',
    authFailureHint: 'AOL needs an app password (Account Security → Generate app password), not your normal password.',
  }),
  fastmail: Object.freeze({
    key: 'fastmail',
    label: 'Fastmail',
    imapHost: 'imap.fastmail.com',
    imapPort: 993,
    imapSecurity: 'tls',
    smtpHost: 'smtp.fastmail.com',
    smtpPort: 465,
    smtpSecurity: 'tls',
    sentCopy: 'append',
    domains: Object.freeze(['fastmail.com', 'fastmail.fm']),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp:
      "Create an app password in Fastmail: Settings → Privacy & Security → Manage app passwords (your normal password won't work, and the Basic plan has no IMAP)",
    passwordHelpUrl: 'https://app.fastmail.com/settings/security',
    authFailureHint:
      'Fastmail needs an app password, and the username must be your full Fastmail sign-in address (not an alias). The Basic plan has no IMAP access.',
  }),
  zoho: Object.freeze({
    key: 'zoho',
    label: 'Zoho Mail',
    imapHost: 'imap.zoho.com',
    imapPort: 993,
    imapSecurity: 'tls',
    smtpHost: 'smtp.zoho.com',
    smtpPort: 465,
    smtpSecurity: 'tls',
    // Zoho documents that mail sent through its SMTP servers "is automatically saved in your
    // Sent folder", so appending a copy would duplicate it.
    sentCopy: 'server',
    domains: Object.freeze(['zoho.com', 'zohomail.com', 'zoho.eu', 'zohomail.eu']),
    hostByDomain: Object.freeze({ 'zoho.eu': 'imap.zoho.eu', 'zohomail.eu': 'imap.zoho.eu' }),
    smtpHostByDomain: Object.freeze({ 'zoho.eu': 'smtp.zoho.eu', 'zohomail.eu': 'smtp.zoho.eu' }),
    // Paid organisations (imappro.*) and other data centres send through the matching SMTP host.
    smtpHostForImapHost: Object.freeze({
      'imap.zoho.eu': 'smtp.zoho.eu',
      'imappro.zoho.com': 'smtppro.zoho.com',
      'imappro.zoho.eu': 'smtppro.zoho.eu',
      'imap.zoho.in': 'smtp.zoho.in',
      'imappro.zoho.in': 'smtppro.zoho.in',
      'imap.zoho.com.au': 'smtp.zoho.com.au',
      'imappro.zoho.com.au': 'smtppro.zoho.com.au',
    }),
    // imappro.* serve paid organisations on their own domain; the regional hosts are not on
    // Zoho's own help page, so they are only used to recognise a Zoho server.
    otherHosts: Object.freeze([
      'imappro.zoho.com',
      'imappro.zoho.eu',
      'imap.zoho.in',
      'imappro.zoho.in',
      'imap.zoho.com.au',
      'imappro.zoho.com.au',
    ]),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp:
      'Enable IMAP access in Zoho Mail settings (Mail Accounts → IMAP Access); with 2-factor sign-in, use an app-specific password. Addresses on your own domain (paid plans) use the server imappro.zoho.com — Zoho shows your exact server under "Server Configuration Details".',
    passwordHelpUrl: 'https://accounts.zoho.com/home#security/app_password',
    authFailureHint:
      'Zoho: turn on IMAP Access (Settings → Mail Accounts), use an app-specific password if you have 2-factor sign-in, and check the server under "Server Configuration Details" (addresses on your own domain usually use imappro.zoho.com). Newer free-plan accounts have no IMAP.',
  }),
  gmx: Object.freeze({
    key: 'gmx',
    label: 'GMX',
    imapHost: 'imap.gmx.com',
    imapPort: 993,
    imapSecurity: 'tls',
    smtpHost: 'mail.gmx.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    sentCopy: 'append',
    domains: Object.freeze(['gmx.com', 'gmx.us', 'gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch']),
    // German-language GMX accounts live on a different IMAP host.
    hostByDomain: Object.freeze({
      'gmx.net': 'imap.gmx.net',
      'gmx.de': 'imap.gmx.net',
      'gmx.at': 'imap.gmx.net',
      'gmx.ch': 'imap.gmx.net',
    }),
    smtpHostByDomain: Object.freeze({
      'gmx.net': 'mail.gmx.net',
      'gmx.de': 'mail.gmx.net',
      'gmx.at': 'mail.gmx.net',
      'gmx.ch': 'mail.gmx.net',
    }),
    smtpHostForImapHost: Object.freeze({ 'imap.gmx.net': 'mail.gmx.net', 'imap.gmx.com': 'mail.gmx.com' }),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Turn on "POP3 & IMAP access" in your GMX mail settings first (GMX switches it off again after a long time without use)',
    passwordHelpUrl: null,
    authFailureHint:
      'GMX: turn on "POP3 & IMAP" access in your GMX mail settings (GMX switches it off again after a long time without use).',
  }),
  yandex: Object.freeze({
    key: 'yandex',
    label: 'Yandex Mail',
    imapHost: 'imap.yandex.com',
    imapPort: 993,
    imapSecurity: 'tls',
    smtpHost: 'smtp.yandex.com',
    smtpPort: 465,
    smtpSecurity: 'tls',
    sentCopy: 'append',
    sentCopyUnverified: true,
    domains: Object.freeze(['yandex.com', 'yandex.ru', 'ya.ru', 'yandex.by', 'yandex.kz', 'yandex.ua']),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    otherHosts: Object.freeze(['imap.ya.ru', 'imap.yandex.ru']),
    // Yandex documents the login (the part before @) as the username.
    usernameFallback: 'localPart',
    passwordHelp:
      'Create an app password for "Mail" in your Yandex ID security settings, and turn on IMAP and "App passwords and OAuth tokens" in Yandex Mail settings → Email clients. A new app password can take 2–3 hours to start working',
    passwordHelpUrl: 'https://id.yandex.com/security',
    authFailureHint:
      'Yandex: turn on IMAP and "App passwords and OAuth tokens" (Mail settings → Email clients) and use an app password for "Mail". A new app password can take 2–3 hours to start working.',
  }),
  imap: Object.freeze({
    key: 'imap',
    label: 'Other (IMAP)',
    imapHost: '',
    imapPort: 993,
    imapSecurity: 'tls',
    // The user supplies the outgoing server; these are only the form's defaults.
    smtpHost: '',
    smtpPort: 465,
    smtpSecurity: 'tls',
    sentCopy: 'append',
    domains: Object.freeze([]),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: "Use the IMAP server settings from your email provider. Many providers need an app password instead of your normal password.",
    passwordHelpUrl: null,
  }),
});

function emailDomain(email) {
  const s = String(email || '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  return at >= 0 ? s.slice(at + 1) : '';
}

/** Array of presets in display order, safe to send to the browser. */
function publicPresets() {
  return PRESET_ORDER.map((key) => {
    const p = PRESETS[key];
    return {
      key: p.key,
      label: p.label,
      imapHost: p.imapHost,
      imapPort: p.imapPort,
      imapSecurity: p.imapSecurity,
      domains: [...p.domains],
      auth: [...p.auth],
      oauthProvider: p.oauthProvider,
      passwordHelp: p.passwordHelp,
      passwordHelpUrl: p.passwordHelpUrl,
      hostByDomain: p.hostByDomain ? { ...p.hostByDomain } : {},
      smtpHost: p.smtpHost,
      smtpPort: p.smtpPort,
      smtpSecurity: p.smtpSecurity,
      smtpHostByDomain: p.smtpHostByDomain ? { ...p.smtpHostByDomain } : {},
      sentCopy: p.sentCopy,
    };
  });
}

/** Preset key for an email address, by domain ('imap' when unknown). */
function guessPresetForEmail(email) {
  const domain = emailDomain(email);
  if (!domain) return 'imap';
  for (const key of PRESET_ORDER) {
    if (PRESETS[key].domains.includes(domain)) return key;
  }
  return 'imap';
}

/**
 * The default IMAP host of a preset for a given email address. Most presets have one host;
 * a few (GMX, Zoho) use a different host for some domains. Returns '' for 'imap'/unknown.
 */
function presetHostForEmail(presetKey, email) {
  const preset = PRESETS[presetKey];
  if (!preset) return '';
  const domain = emailDomain(email);
  return (preset.hostByDomain && preset.hostByDomain[domain]) || preset.imapHost;
}

/** Preset key whose IMAP server `host` is (by host name), or null. */
function presetKeyForHost(host) {
  const h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h) return null;
  for (const key of PRESET_ORDER) {
    const p = PRESETS[key];
    if (!p.imapHost) continue;
    const hosts = [p.imapHost, ...Object.values(p.hostByDomain || {}), ...(p.otherHosts || [])];
    if (hosts.includes(h)) return key;
  }
  return null;
}

/** True for Microsoft's IMAP servers (Outlook.com and Microsoft 365), which only accept OAuth. */
function isMicrosoftImapHost(host) {
  return presetKeyForHost(host) === 'outlook';
}

/**
 * For providers whose IMAP username may be the local part only (iCloud, Yandex): the other form
 * of `user` to try once if the login fails — the local part for a full address, the full email
 * address for a bare name. Null when there is nothing else to try.
 */
function alternateUsername(presetKey, user, email) {
  const preset = PRESETS[presetKey];
  if (!preset || preset.usernameFallback !== 'localPart') return null;
  const u = String(user || '').trim();
  const at = u.lastIndexOf('@');
  if (at > 0) return u.slice(0, at);
  const full = String(email || '').trim();
  return u && full.includes('@') && full.toLowerCase() !== u.toLowerCase() ? full : null;
}

/**
 * Default outgoing (SMTP) server for an account on preset `presetKey`.
 * The account's IMAP host decides first (a Zoho paid-plan IMAP host means the matching SMTP
 * host), then the email domain (Outlook.com vs Microsoft 365, GMX.net), then the preset default.
 * @returns {{ host: string, port: number, security: string, sentCopy: 'server'|'append' }}
 *   host is '' when the preset has no default (Other IMAP) or the preset is unknown.
 */
function presetSmtpSettings(presetKey, { email, imapHost } = {}) {
  const preset = PRESETS[presetKey] || PRESETS.imap;
  const imap = String(imapHost || '').trim().toLowerCase().replace(/\.$/, '');
  const domain = emailDomain(email);
  const host =
    (preset.smtpHostForImapHost && preset.smtpHostForImapHost[imap]) ||
    (preset.smtpHostByDomain && preset.smtpHostByDomain[domain]) ||
    preset.smtpHost ||
    '';
  return { host, port: preset.smtpPort, security: preset.smtpSecurity, sentCopy: preset.sentCopy };
}

/** Preset key whose outgoing server `host` is (by host name), or null. */
function presetKeyForSmtpHost(host) {
  const h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h) return null;
  for (const key of PRESET_ORDER) {
    const p = PRESETS[key];
    if (!p.smtpHost) continue;
    const hosts = [
      p.smtpHost,
      ...Object.values(p.smtpHostByDomain || {}),
      ...Object.values(p.smtpHostForImapHost || {}),
      ...(p.otherSmtpHosts || []),
    ];
    if (hosts.includes(h)) return key;
  }
  return null;
}

/** True for a personal Microsoft account address (Outlook.com, Hotmail, Live, MSN). */
function isMicrosoftConsumerEmail(email) {
  return OUTLOOK_CONSUMER_DOMAINS.includes(emailDomain(email));
}

/** Provider-specific advice to add to a failed password login for `host`, or ''. */
function authFailureHintForHost(host) {
  const key = presetKeyForHost(host);
  return (key && PRESETS[key].authFailureHint) || '';
}

// Only these keys of config.oauthOverrides (tests only) may replace a provider's values.
const OVERRIDABLE_KEYS = ['authUrl', 'tokenUrl', 'imapHost', 'imapPort', 'imapSecurity', 'smtpHost', 'smtpPort', 'smtpSecurity'];

function applyOverrides(provider, overrides) {
  if (!overrides || typeof overrides !== 'object') return provider;
  for (const key of OVERRIDABLE_KEYS) {
    if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') {
      provider[key] = key === 'imapPort' || key === 'smtpPort' ? Number(overrides[key]) : overrides[key];
    }
  }
  return provider;
}

/**
 * OAuth provider definitions, built from config (client ids/secrets, Microsoft tenant).
 * Returns fresh objects on every call.
 */
function oauthProviders(config) {
  const google = (config && config.google) || {};
  const microsoft = (config && config.microsoft) || {};
  const overrides = (config && config.oauthOverrides) || {};
  const tenant = encodeURIComponent(microsoft.tenant || 'common');

  return {
    google: applyOverrides(
      {
        key: 'google',
        label: 'Google',
        presetKey: 'gmail',
        enabled: !!google.enabled,
        clientId: google.clientId || '',
        clientSecret: google.clientSecret || '',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['https://mail.google.com/', 'openid', 'email', 'profile'],
        // Granular consent lets the user untick Gmail access; the code exchange checks it was granted.
        mailScope: 'https://mail.google.com/',
        // Google refreshes without a scope parameter.
        refreshScopes: null,
        // https://mail.google.com/ covers IMAP, POP and SMTP.
        sendScope: 'https://mail.google.com/',
        optionalScopes: [],
        envNames: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapSecurity: 'tls',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpSecurity: 'tls',
      },
      overrides.google
    ),
    microsoft: applyOverrides(
      {
        key: 'microsoft',
        label: 'Microsoft',
        presetKey: 'outlook',
        enabled: !!microsoft.enabled,
        clientId: microsoft.clientId || '',
        clientSecret: microsoft.clientSecret || '',
        authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        // The IMAP scope must come first: with scopes for several resources, Microsoft issues the
        // access token for the first one. SMTP.Send belongs to the same resource
        // (outlook.office.com), so one token covers both. No Graph scopes (such as User.Read).
        scopes: [
          'https://outlook.office.com/IMAP.AccessAsUser.All',
          'https://outlook.office.com/SMTP.Send',
          'offline_access',
          'openid',
          'email',
          'profile',
        ],
        mailScope: 'https://outlook.office.com/IMAP.AccessAsUser.All',
        refreshScopes: ['https://outlook.office.com/IMAP.AccessAsUser.All', 'https://outlook.office.com/SMTP.Send', 'offline_access'],
        sendScope: 'https://outlook.office.com/SMTP.Send',
        // Asked for on refresh only when the account was granted them: Microsoft refuses a refresh
        // for scopes the user never consented to, which would cut off accounts connected before
        // sending existed (they consented to IMAP only) — they must reconnect to add sending.
        optionalScopes: ['https://outlook.office.com/SMTP.Send'],
        envNames: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
        extraAuthParams: { prompt: 'select_account' },
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        imapSecurity: 'tls',
        // Work/school default; personal addresses use smtp-mail.outlook.com (presetSmtpSettings).
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecurity: 'starttls',
      },
      overrides.microsoft
    ),
  };
}

/** The OAuth provider definition for an account row's preset key ('gmail' -> google), or null. */
function oauthProviderForPreset(config, presetKey) {
  const providers = oauthProviders(config);
  return Object.values(providers).find((p) => p.presetKey === presetKey) || null;
}

module.exports = {
  PRESETS,
  publicPresets,
  guessPresetForEmail,
  presetHostForEmail,
  presetKeyForHost,
  isMicrosoftImapHost,
  alternateUsername,
  authFailureHintForHost,
  presetSmtpSettings,
  presetKeyForSmtpHost,
  isMicrosoftConsumerEmail,
  oauthProviders,
  oauthProviderForPreset,
};
