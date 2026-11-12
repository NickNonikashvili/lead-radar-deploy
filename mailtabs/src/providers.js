'use strict';

/**
 * Email provider presets (IMAP settings + how users sign in) and the OAuth provider definitions
 * for Google and Microsoft.
 *
 * Presets only describe *defaults*; the account form lets the user override host/port/security.
 */

const PRESET_ORDER = ['gmail', 'outlook', 'yahoo', 'icloud', 'aol', 'fastmail', 'zoho', 'gmx', 'yandex', 'imap'];

const PRESETS = Object.freeze({
  gmail: Object.freeze({
    key: 'gmail',
    label: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecurity: 'tls',
    domains: Object.freeze(['gmail.com', 'googlemail.com']),
    auth: Object.freeze(['oauth', 'password']),
    oauthProvider: 'google',
    passwordHelp: 'Use a Google App Password (needs 2-Step Verification)',
    passwordHelpUrl: 'https://myaccount.google.com/apppasswords',
  }),
  outlook: Object.freeze({
    key: 'outlook',
    label: 'Outlook / Hotmail / Microsoft 365',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecurity: 'tls',
    domains: Object.freeze([
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
    ]),
    // Microsoft turned off password (basic auth) sign-in for IMAP on Outlook.com.
    auth: Object.freeze(['oauth']),
    oauthProvider: 'microsoft',
    passwordHelp:
      'Outlook.com no longer accepts passwords for IMAP — use "Sign in with Microsoft". Some work accounts still allow an app password.',
    passwordHelpUrl: 'https://account.microsoft.com/security',
  }),
  yahoo: Object.freeze({
    key: 'yahoo',
    label: 'Yahoo Mail',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecurity: 'tls',
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
  }),
  icloud: Object.freeze({
    key: 'icloud',
    label: 'iCloud Mail',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecurity: 'tls',
    domains: Object.freeze(['icloud.com', 'me.com', 'mac.com']),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Use an app-specific password from your Apple Account (Sign-In and Security)',
    passwordHelpUrl: 'https://account.apple.com/account/manage',
  }),
  aol: Object.freeze({
    key: 'aol',
    label: 'AOL Mail',
    imapHost: 'imap.aol.com',
    imapPort: 993,
    imapSecurity: 'tls',
    domains: Object.freeze(['aol.com', 'aim.com']),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Generate an app password in your AOL account security settings',
    passwordHelpUrl: 'https://login.aol.com/account/security',
  }),
  fastmail: Object.freeze({
    key: 'fastmail',
    label: 'Fastmail',
    imapHost: 'imap.fastmail.com',
    imapPort: 993,
    imapSecurity: 'tls',
    domains: Object.freeze(['fastmail.com', 'fastmail.fm']),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Create an app password in Fastmail: Settings → Privacy & Security → App passwords',
    passwordHelpUrl: null,
  }),
  zoho: Object.freeze({
    key: 'zoho',
    label: 'Zoho Mail',
    imapHost: 'imap.zoho.com',
    imapPort: 993,
    imapSecurity: 'tls',
    domains: Object.freeze(['zoho.com', 'zohomail.com', 'zoho.eu', 'zohomail.eu']),
    hostByDomain: Object.freeze({ 'zoho.eu': 'imap.zoho.eu', 'zohomail.eu': 'imap.zoho.eu' }),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Enable IMAP access in Zoho Mail settings; with 2-factor sign-in, use an app-specific password',
    passwordHelpUrl: 'https://accounts.zoho.com/home#security/app_password',
  }),
  gmx: Object.freeze({
    key: 'gmx',
    label: 'GMX',
    imapHost: 'imap.gmx.com',
    imapPort: 993,
    imapSecurity: 'tls',
    domains: Object.freeze(['gmx.com', 'gmx.us', 'gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch']),
    // German-language GMX accounts live on a different IMAP host.
    hostByDomain: Object.freeze({
      'gmx.net': 'imap.gmx.net',
      'gmx.de': 'imap.gmx.net',
      'gmx.at': 'imap.gmx.net',
      'gmx.ch': 'imap.gmx.net',
    }),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Turn on "POP3 & IMAP access" in your GMX mail settings first',
    passwordHelpUrl: null,
  }),
  yandex: Object.freeze({
    key: 'yandex',
    label: 'Yandex Mail',
    imapHost: 'imap.yandex.com',
    imapPort: 993,
    imapSecurity: 'tls',
    domains: Object.freeze(['yandex.com', 'yandex.ru', 'ya.ru', 'yandex.by', 'yandex.kz', 'yandex.ua']),
    auth: Object.freeze(['password']),
    oauthProvider: null,
    passwordHelp: 'Create an app password for "Mail" in your Yandex ID security settings',
    passwordHelpUrl: 'https://id.yandex.com/security/app-passwords',
  }),
  imap: Object.freeze({
    key: 'imap',
    label: 'Other (IMAP)',
    imapHost: '',
    imapPort: 993,
    imapSecurity: 'tls',
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

// Only these keys of config.oauthOverrides (tests only) may replace a provider's values.
const OVERRIDABLE_KEYS = ['authUrl', 'tokenUrl', 'imapHost', 'imapPort', 'imapSecurity'];

function applyOverrides(provider, overrides) {
  if (!overrides || typeof overrides !== 'object') return provider;
  for (const key of OVERRIDABLE_KEYS) {
    if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') {
      provider[key] = key === 'imapPort' ? Number(overrides[key]) : overrides[key];
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
        extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapSecurity: 'tls',
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
        scopes: ['https://outlook.office.com/IMAP.AccessAsUser.All', 'offline_access', 'openid', 'email', 'profile'],
        extraAuthParams: { prompt: 'select_account' },
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        imapSecurity: 'tls',
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
  oauthProviders,
  oauthProviderForPreset,
};
