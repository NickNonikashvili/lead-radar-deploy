// "Add an email account": pick a provider, then sign in with Google/Microsoft
// (OAuth redirect) or connect with an (app) password over IMAP.
import { html, useEffect, useMemo, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { addPasswordAccount, closeDialog, openDialog, startOAuth } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { PROVIDER_ORDER, providerLabel } from '../constants.js';
import { emailDomain, guessPresetKey } from '../format.js';
import { useUid } from '../hooks.js';
import { Dialog } from './Dialog.js';
import { ColorSwatches, InlineError, ProviderMark, TabChecklist, nextFreeColor } from './ui.js';

const FALLBACK_PRESETS = [
  { key: 'imap', label: 'Other (IMAP)', imapHost: '', imapPort: 993, imapSecurity: 'tls', domains: [], auth: ['password'], oauthProvider: null },
];

const OAUTH_NAMES = { google: 'Google', microsoft: 'Microsoft' };
const DEFAULT_PORTS = { tls: 993, starttls: 143, none: 143 };

function oauthAvailable(preset, providers) {
  return !!(preset && preset.oauthProvider && (preset.auth || []).includes('oauth') && providers && providers[preset.oauthProvider]);
}

function tileSubtitle(preset, providers) {
  if (oauthAvailable(preset, providers)) return `Sign in with ${OAUTH_NAMES[preset.oauthProvider]}`;
  if (preset.key === 'imap') return 'Any IMAP mail server';
  if (preset.key === 'outlook') return 'Needs Microsoft sign-in';
  return /\bapp(-specific)? password/i.test(preset.passwordHelp || '') ? 'App password' : 'Password';
}

function friendlyAccountError(err) {
  if (!err) return '';
  if (err.code === 'ACCOUNT_EXISTS') return 'This account is already connected to Mailtabs.';
  if (err.code === 'INSECURE_NOT_ALLOWED') return 'Unencrypted connections are turned off on this server. Choose SSL/TLS or STARTTLS.';
  // OAUTH_REQUIRED (a Microsoft server): the server's message says what to do instead.
  return err.message || "Couldn't connect this account.";
}

/** "Show this account in" — existing tabs plus "create a tab for this account". */
function TabsSection({ tabs, selected, setSelected, createTab, setCreateTab, newTabName, setNewTabName, nameEditable, impliedName }) {
  const toggle = (id, on) => setSelected(on ? [...selected, id] : selected.filter((x) => x !== id));
  return html`<fieldset class="fieldset">
    <legend class="field-label">Show this account in</legend>
    <p class="field-hint">“All inboxes” always includes every account.</p>
    <${TabChecklist} tabs=${tabs} selected=${selected} onToggle=${toggle} emptyText="" />
    <label class="check-row">
      <input type="checkbox" checked=${createTab} onChange=${(e) => setCreateTab(e.currentTarget.checked)} />
      <span class="check-label">Create a tab for this account</span>
    </label>
    ${createTab && nameEditable
      ? html`<label class="field field-indent">
          <span class="field-label">Tab name</span>
          <input class="input" type="text" maxlength="40" value=${newTabName} onInput=${(e) => setNewTabName(e.currentTarget.value)} />
        </label>`
      : null}
    ${createTab && !nameEditable ? html`<p class="field-hint field-indent">Creates a tab called “${impliedName}”.</p>` : null}
  </fieldset>`;
}

function ProviderChooser({ presets, providers, onPick }) {
  const [email, setEmail] = useState('');
  const guess = guessPresetKey(email, presets);
  const guessPreset = guess ? presets.find((p) => p.key === guess) : null;
  const ordered = useMemo(() => {
    const byKey = new Map(presets.map((p) => [p.key, p]));
    const known = PROVIDER_ORDER.map((k) => byKey.get(k)).filter(Boolean);
    const extra = presets.filter((p) => !PROVIDER_ORDER.includes(p.key));
    return [...known, ...extra];
  }, [presets]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (email.includes('@')) onPick(guess || 'imap', email.trim());
  };

  return html`<div class="stack">
    <form class="detect" onSubmit=${onSubmit}>
      <label class="field">
        <span class="field-label">Your email address</span>
        <div class="input-row">
          <input class="input" type="email" placeholder="you@example.com" value=${email} onInput=${(e) => setEmail(e.currentTarget.value)} autocomplete="email" />
          <button type="submit" class="btn" disabled=${!email.includes('@')}>Continue</button>
        </div>
      </label>
      <p class="field-hint" aria-live="polite">
        ${guessPreset
          ? html`Looks like a <strong>${providerLabel(guessPreset.key, presets, { short: true })}</strong> address.`
          : 'Type your address and we’ll pick the right settings, or choose your provider below.'}
      </p>
    </form>
    <div class="provider-grid">
      ${ordered.map(
        (p) => html`<button
          key=${p.key}
          type="button"
          class=${`provider-tile ${guess === p.key ? 'is-suggested' : ''}`}
          onClick=${() => onPick(p.key, email.includes('@') ? email.trim() : '')}
        >
          <${ProviderMark} provider=${p.key} size=${34} />
          <span class="provider-tile-text">
            <span class="provider-tile-name">${providerLabel(p.key, presets)}</span>
            <span class="provider-tile-sub">${tileSubtitle(p, providers)}</span>
          </span>
        </button>`
      )}
    </div>
  </div>`;
}

export function AddAccountDialog({ provider: initialProvider = null, tabIds: initialTabIds = [], email: initialEmail = '', returnTo = null }) {
  const { config, tabs, accounts } = useStore((s) => ({ config: s.config, tabs: s.tabs, accounts: s.accounts }));
  const presets = config.presets && config.presets.length ? config.presets : FALLBACK_PRESETS;
  const providers = config.providers || {};

  const initialPreset = (initialProvider && presets.find((p) => p.key === initialProvider)) || null;
  const [providerKey, setProviderKey] = useState(initialPreset ? initialPreset.key : null);
  const [usePassword, setUsePassword] = useState(false);
  const preset = presets.find((p) => p.key === providerKey) || null;

  // Shared form state (survives switching between OAuth and password modes).
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState(() => nextFreeColor(accounts.map((a) => a.color)));
  const [selectedTabs, setSelectedTabs] = useState(initialTabIds);
  const [createTab, setCreateTab] = useState(false);
  const [newTabName, setNewTabName] = useState(() => (initialPreset ? providerLabel(initialPreset.key, presets, { short: true }) : ''));
  const [advancedOpen, setAdvancedOpen] = useState(() => !!initialPreset && initialPreset.key === 'imap');
  const [advanced, setAdvanced] = useState(() => presetDefaults(initialPreset, initialEmail));
  const [advancedTouched, setAdvancedTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const formId = useUid('add-account-form');
  const pwHelpId = useUid('pw-help');

  // Opened from the tab editor: go back to it (with its unsaved draft) instead of closing.
  const leave = (newAccount = null) => {
    if (!returnTo) return closeDialog();
    const props = { ...(returnTo.props || {}) };
    if (newAccount && props.draft) {
      props.draft = { ...props.draft, mode: 'some', accountIds: [...new Set([...(props.draft.accountIds || []), newAccount.id])] };
    }
    openDialog(returnTo.type, props);
  };
  // While the login is being checked the dialog can't be dismissed: the account would be
  // added anyway, behind the user's back.
  const close = () => {
    if (!busy) leave();
  };

  const pick = (key, typedEmail) => {
    const next = presets.find((p) => p.key === key);
    setProviderKey(key);
    setUsePassword(false);
    setError('');
    if (typedEmail) setEmail(typedEmail);
    setAdvanced(presetDefaults(next, typedEmail || email));
    setAdvancedTouched(false);
    setAdvancedOpen(key === 'imap');
    setNewTabName(providerLabel(key, presets, { short: true }));
  };

  // Moving between steps replaces the focused element; put focus on the new step.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const root = document.querySelector('.add-account-dialog .dialog-body');
    if (!root) return;
    const target = root.querySelector('[data-autofocus]') || root.querySelector('input:not([type=checkbox]):not([type=radio]), button');
    if (target) target.focus({ preventScroll: true });
  }, [providerKey, usePassword]);

  // Some providers use a different server per domain (e.g. gmx.net -> imap.gmx.net).
  const onEmailInput = (value) => {
    setEmail(value);
    if (!preset || advancedTouched || preset.key === 'imap') return;
    const byDomain = (preset.hostByDomain && preset.hostByDomain[emailDomain(value)]) || preset.imapHost || '';
    setAdvanced((a) => (a.host === byDomain ? a : { ...a, host: byDomain }));
  };

  const backToProviders = () => {
    setProviderKey(null);
    setError('');
  };

  const setAdv = (field, value) => {
    setAdvancedTouched(true);
    setAdvanced((a) => {
      const next = { ...a, [field]: value };
      // Follow the conventional port when switching security, unless a custom port was typed.
      if (field === 'security' && Object.values(DEFAULT_PORTS).map(String).includes(a.port)) next.port = String(DEFAULT_PORTS[value]);
      return next;
    });
  };

  const shortName = preset ? providerLabel(preset.key, presets, { short: true }) : '';
  // "Other (IMAP)" would otherwise name the tab "IMAP": the mail domain says more.
  const emailDomain = (email.split('@')[1] || '').trim().toLowerCase();
  const impliedTabName = (displayName.trim() || (preset && preset.key === 'imap' && emailDomain ? emailDomain : shortName)).slice(0, 40);
  const tabIdsToAttach = selectedTabs.filter((id) => tabs.some((t) => t.id === id && !t.allAccounts));

  // ------------------------------------------------------------------ OAuth
  const onOAuth = () => {
    const pendingTab = createTab && newTabName.trim() ? { name: newTabName.trim().slice(0, 40), color } : null;
    setBusy(true);
    startOAuth(preset.oauthProvider, { tabIds: tabIdsToAttach, pendingTab, accountColor: color });
  };

  // --------------------------------------------------------------- password
  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+$/.test(trimmedEmail)) return setError('Enter the full email address, like name@example.com.');
    if (!password) return setError(`Enter the ${appPasswordWord(preset)} for this account.`);
    const isImap = preset.key === 'imap';
    if (isImap && !advanced.host.trim()) {
      setAdvancedOpen(true);
      return setError('Enter the IMAP server name (ask your email provider if you are not sure).');
    }
    const port = Number(advanced.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setAdvancedOpen(true);
      return setError('The port must be a number between 1 and 65535.');
    }

    const body = {
      provider: preset.key,
      email: trimmedEmail,
      password,
      displayName: displayName.trim() || undefined,
      color,
      tabIds: tabIdsToAttach,
    };
    // Only override the server's preset when the user changed something (or for custom IMAP).
    if (isImap || advancedTouched) {
      body.imapHost = advanced.host.trim();
      body.imapPort = port;
      body.imapSecurity = advanced.security;
      if (advanced.user.trim()) body.imapUser = advanced.user.trim();
    }

    setBusy(true);
    try {
      const account = await addPasswordAccount(body, { newTab: createTab && impliedTabName ? { name: impliedTabName, color } : null });
      leave(account);
    } catch (err) {
      setError(friendlyAccountError(err));
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------ views
  let title = 'Add an email account';
  let subtitle = 'Connect as many accounts as you like — then choose which ones each tab shows.';
  let body;
  let footer = null;

  if (!preset) {
    body = html`<${ProviderChooser} presets=${presets} providers=${providers} onPick=${pick} />`;
  } else {
    title = preset.key === 'imap' ? 'Connect an IMAP account' : `Connect ${providerLabel(preset.key, presets, { short: true })}`;
    subtitle = null;
    const oauthOk = oauthAvailable(preset, providers);
    const passwordAllowed = (preset.auth || ['password']).includes('password');
    // Microsoft accepts no IMAP passwords at all, so without Microsoft sign-in there is nothing to offer.
    const mode = oauthOk && (!usePassword || !passwordAllowed) ? 'oauth' : !passwordAllowed ? 'blocked' : 'password';

    const back = html`<button type="button" class="link-btn back-link" onClick=${backToProviders}>
      <${Icon} name="chevronLeft" size=${14} /> All providers
    </button>`;

    const tabsSection = html`<${TabsSection}
      tabs=${tabs}
      selected=${selectedTabs}
      setSelected=${setSelectedTabs}
      createTab=${createTab}
      setCreateTab=${setCreateTab}
      newTabName=${newTabName}
      setNewTabName=${setNewTabName}
      nameEditable=${mode === 'oauth'}
      impliedName=${impliedTabName}
    />`;

    if (mode === 'oauth') {
      const name = OAUTH_NAMES[preset.oauthProvider];
      body = html`<div class="stack">
        ${back}
        <div class="oauth-panel">
          <${ProviderMark} provider=${preset.key} size=${44} />
          <p class="oauth-text">
            You'll go to ${name} to sign in and allow Mailtabs to read your inbox. Your ${name} password is never shared with Mailtabs.
          </p>
        </div>
        ${tabsSection}
        <${ColorSwatches} value=${color} onChange=${setColor} label="Account color" />
        ${passwordAllowed
          ? html`<p class="small muted">
              Prefer not to use ${name} sign-in?${' '}
              <button type="button" class="link-btn" onClick=${() => setUsePassword(true)}>Use an app password instead</button>
            </p>`
          : null}
      </div>`;
      footer = html`<button type="button" class="btn btn-ghost" onClick=${close} disabled=${busy}>Cancel</button>
        <button type="button" class="btn btn-primary" onClick=${onOAuth} disabled=${busy} data-autofocus>
          ${busy ? html`<${Spinner} size=${14} />` : null} Sign in with ${name}
        </button>`;
    } else if (mode === 'blocked') {
      body = html`<div class="stack">
        ${back}
        <div class="notice">
          <div class="notice-icon"><${Icon} name="info" size=${18} /></div>
          <div>
            <h3 class="notice-title">Microsoft sign-in isn't set up on this server</h3>
            <p>
              Outlook.com, Hotmail, Live and Microsoft 365 work or school accounts no longer let mail apps sign in with a
              password or app password — they need “Sign in with Microsoft”.
            </p>
            <p>
              The person who runs this Mailtabs server can turn it on by registering an app with Microsoft and setting
              <code>MICROSOFT_CLIENT_ID</code> and <code>MICROSOFT_CLIENT_SECRET</code> (the README explains how).
            </p>
          </div>
        </div>
      </div>`;
      footer = html`<button type="button" class="btn" onClick=${close}>Close</button>`;
    } else {
      const guess = guessPresetKey(email, presets);
      const showGuess = guess && guess !== preset.key;
      const googleNote = preset.key === 'gmail' && !oauthOk;
      body = html`<form id=${formId} class="form" onSubmit=${onSubmit} aria-busy=${busy ? 'true' : 'false'}>
        ${back}
        ${googleNote
          ? html`<div class="notice notice-compact">
              <div class="notice-icon"><${Icon} name="info" size=${16} /></div>
              <p>Google sign-in isn't set up on this server, so connect Gmail with an app password.</p>
            </div>`
          : null}
        <label class="field">
          <span class="field-label">Email address</span>
          <input class="input" type="email" required autocomplete="email" value=${email} onInput=${(e) => onEmailInput(e.currentTarget.value)} data-autofocus=${email ? undefined : true} />
        </label>
        ${showGuess
          ? html`<p class="field-hint hint-switch">
              This looks like a ${providerLabel(guess, presets, { short: true })} address.${' '}
              <button type="button" class="link-btn" onClick=${() => pick(guess)}>Use ${providerLabel(guess, presets, { short: true })} settings</button>
            </p>`
          : null}
        <label class="field">
          <span class="field-label">${capitalize(appPasswordWord(preset))}</span>
          <div class="input-row">
            <input
              class="input"
              type=${showPassword ? 'text' : 'password'}
              required
              autocomplete="off"
              spellcheck=${false}
              value=${password}
              onInput=${(e) => setPassword(e.currentTarget.value)}
              aria-describedby=${preset.passwordHelp ? pwHelpId : undefined}
              data-autofocus=${email ? true : undefined}
            />
            <button type="button" class="icon-btn input-addon" aria-label=${showPassword ? 'Hide password' : 'Show password'} aria-pressed=${showPassword ? 'true' : 'false'} onClick=${() => setShowPassword((v) => !v)}>
              <${Icon} name=${showPassword ? 'eyeOff' : 'eye'} size=${16} />
            </button>
          </div>
          ${preset.passwordHelp
            ? html`<span class="field-hint" id=${pwHelpId}>
                ${preset.passwordHelp}${preset.passwordHelpUrl
                  ? html` <a href=${preset.passwordHelpUrl} target="_blank" rel="noopener noreferrer">Create one <${Icon} name="external" size=${12} /></a>`
                  : null}
              </span>`
            : null}
        </label>
        <label class="field">
          <span class="field-label">Display name <span class="muted">(optional)</span></span>
          <input class="input" type="text" maxlength="60" placeholder="e.g. Work" value=${displayName} onInput=${(e) => setDisplayName(e.currentTarget.value)} />
        </label>
        <${ColorSwatches} value=${color} onChange=${setColor} label="Account color" />
        ${tabsSection}

        <div class="advanced">
          <button type="button" class="advanced-toggle" aria-expanded=${advancedOpen ? 'true' : 'false'} onClick=${() => setAdvancedOpen((v) => !v)}>
            <${Icon} name="chevronRight" size=${14} className=${advancedOpen ? 'rot-90' : ''} />
            Advanced settings${preset.key === 'imap' ? '' : ' (pre-filled)'}
          </button>
          ${advancedOpen
            ? html`<div class="advanced-grid">
                <label class="field field-host">
                  <span class="field-label">IMAP server</span>
                  <input
                    class="input"
                    type="text"
                    inputmode="url"
                    spellcheck=${false}
                    autocomplete="off"
                    required=${preset.key === 'imap'}
                    placeholder=${email.includes('@') ? `imap.${email.split('@').pop()}` : 'imap.example.com'}
                    value=${advanced.host}
                    onInput=${(e) => setAdv('host', e.currentTarget.value)}
                  />
                </label>
                <label class="field field-port">
                  <span class="field-label">Port</span>
                  <input class="input" type="number" min="1" max="65535" inputmode="numeric" value=${advanced.port} onInput=${(e) => setAdv('port', e.currentTarget.value)} />
                </label>
                <label class="field">
                  <span class="field-label">Security</span>
                  <select class="input" aria-label="Security" value=${advanced.security} onChange=${(e) => setAdv('security', e.currentTarget.value)}>
                    <option value="tls">SSL/TLS (recommended)</option>
                    <option value="starttls">STARTTLS</option>
                    <option value="none">None — unencrypted</option>
                  </select>
                </label>
                <label class="field">
                  <span class="field-label">Username</span>
                  <input class="input" type="text" spellcheck=${false} autocomplete="off" placeholder="Same as email address" value=${advanced.user} onInput=${(e) => setAdv('user', e.currentTarget.value)} />
                </label>
              </div>`
            : null}
        </div>

        <${InlineError} message=${error} />
      </form>`;
      footer = html`<button type="button" class="btn btn-ghost" onClick=${close} disabled=${busy}>Cancel</button>
        <button type="submit" form=${formId} class="btn btn-primary" disabled=${busy}>
          ${busy ? html`<${Spinner} size=${14} /> Checking your login…` : 'Add account'}
        </button>`;
    }
  }

  return html`<${Dialog} title=${title} subtitle=${subtitle} onClose=${close} footer=${footer} size="md" className="add-account-dialog">
    ${body}
  </${Dialog}>`;
}

/** Connection defaults for a preset; some providers pick the server by the email's domain. */
function presetDefaults(preset, email = '') {
  const byDomain = preset && preset.hostByDomain ? preset.hostByDomain[emailDomain(email)] : null;
  return {
    host: byDomain || (preset && preset.imapHost) || '',
    port: String((preset && preset.imapPort) || 993),
    security: (preset && preset.imapSecurity) || 'tls',
    user: '',
  };
}

function appPasswordWord(preset) {
  if (!preset || preset.key === 'imap') return 'password';
  return /\bapp(-specific)? password/i.test(preset.passwordHelp || '') ? 'app password' : 'password';
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
