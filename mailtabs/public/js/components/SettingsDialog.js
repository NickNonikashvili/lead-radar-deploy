// Settings: accounts (status, edit, sending, sync, remove), sending (undo delay, From name and
// signatures), notifications, password, appearance, shortcuts.
import { html, useEffect, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import {
  changePassword,
  closeDialog,
  notificationPermission,
  oauthProviderFor,
  openDialog,
  removeAccount,
  setNotifications,
  setTheme,
  signOut,
  startOAuth,
  syncAccount,
  toast,
  updateAccount,
  updateSettings,
} from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { SHORTCUTS, UNDO_SEND_CHOICES, providerLabel } from '../constants.js';
import { useNow, useUid } from '../hooks.js';
import { SignatureSettings } from '../compose/SignatureSettings.js';
import { Dialog } from './Dialog.js';
import { ColorDot, ColorSwatches, InlineError, Kbd, StatusPill, TabChecklist } from './ui.js';

const SECTIONS = [
  { id: 'accounts', label: 'Accounts', icon: 'mail' },
  { id: 'sending', label: 'Sending', icon: 'send' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'security', label: 'Password', icon: 'lock' },
  { id: 'appearance', label: 'Appearance', icon: 'moon' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' },
];

const SMTP_DEFAULT_PORTS = { tls: 465, starttls: 587, none: 25 };

function smtpFromAccount(account) {
  return {
    host: account.smtpHost || '',
    port: account.smtpPort ? String(account.smtpPort) : '465',
    security: account.smtpSecurity || 'tls',
    user: account.smtpUser || '',
    password: '',
  };
}

/** Outgoing mail (SMTP) for password accounts; OAuth accounts send with their sign-in. */
function SendingFields({ account, smtp, setSmtp, open, setOpen }) {
  const set = (field, value) =>
    setSmtp((v) => {
      const next = { ...v, [field]: value };
      // Follow the conventional port when switching security, unless a custom port was typed.
      if (field === 'security' && Object.values(SMTP_DEFAULT_PORTS).map(String).includes(v.port)) next.port = String(SMTP_DEFAULT_PORTS[value]);
      return next;
    });
  return html`<fieldset class="fieldset smtp-fieldset">
    <legend class="field-label">Sending</legend>
    <p class=${`send-status ${account.canSend ? 'is-ok' : 'is-off'}`}>
      <${Icon} name=${account.canSend ? 'check' : 'alert'} size=${14} />
      ${account.canSend
        ? html`Sends through <strong>${account.smtpHost || 'your provider'}</strong>.`
        : account.smtpHost
          ? 'Sending isn’t working yet. Check the outgoing server settings below.'
          : 'Sending isn’t set up yet. Enter the outgoing (SMTP) server below.'}
    </p>
    <button type="button" class="advanced-toggle" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen((v) => !v)}>
      <${Icon} name="chevronRight" size=${14} className=${open ? 'rot-90' : ''} /> Outgoing server (SMTP)
    </button>
    ${open
      ? html`<div class="advanced-grid">
          <label class="field">
            <span class="field-label">SMTP server</span>
            <input class="input" type="text" inputmode="url" spellcheck=${false} autocomplete="off" placeholder="smtp.example.com" value=${smtp.host} onInput=${(e) => set('host', e.currentTarget.value)} />
          </label>
          <label class="field">
            <span class="field-label">Port</span>
            <input class="input" type="number" min="1" max="65535" inputmode="numeric" value=${smtp.port} onInput=${(e) => set('port', e.currentTarget.value)} />
          </label>
          <label class="field">
            <span class="field-label">Security</span>
            <select class="input" value=${smtp.security} onChange=${(e) => set('security', e.currentTarget.value)}>
              <option value="tls">SSL/TLS (recommended)</option>
              <option value="starttls">STARTTLS</option>
              <option value="none">None — unencrypted</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Username</span>
            <input class="input" type="text" spellcheck=${false} autocomplete="off" placeholder="Same as incoming" value=${smtp.user} onInput=${(e) => set('user', e.currentTarget.value)} />
          </label>
          <label class="field field-span">
            <span class="field-label">SMTP password</span>
            <input class="input" type="password" autocomplete="off" placeholder="Leave blank to use the incoming password" value=${smtp.password} onInput=${(e) => set('password', e.currentTarget.value)} />
            <span class="field-hint">Changing the server needs the password again, so it is never sent somewhere new without you typing it.</span>
          </label>
        </div>`
      : null}
  </fieldset>`;
}

const OAUTH_NAMES = { google: 'Google', microsoft: 'Microsoft' };

function AccountEditor({ account, tabs, presets, providers, onDone }) {
  const [displayName, setDisplayName] = useState(account.displayName || '');
  const [color, setColor] = useState(account.color);
  const [tabIds, setTabIds] = useState(account.tabIds || []);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [smtp, setSmtp] = useState(() => smtpFromAccount(account));
  const [smtpOpen, setSmtpOpen] = useState(() => account.authType !== 'oauth' && !account.canSend);
  const formId = useUid('acct-form');
  const isOAuth = account.authType === 'oauth';
  const oauthProvider = isOAuth ? oauthProviderFor(account, presets) : null;
  const canReconnect = oauthProvider && providers[oauthProvider];
  const preset = presets.find((p) => p.key === account.provider);

  const toggleTab = (id, on) => setTabIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    const body = {
      displayName: displayName.trim(),
      color,
      // tabIds replaces the account's memberships, so keep the ones the checklist doesn't show
      // ("All accounts" tabs): they remember the choice if that tab is switched back to "Only these".
      tabIds: tabIds.filter((id) => tabs.some((t) => t.id === id)),
    };
    if (!isOAuth && password) body.password = password;
    let smtpChanged = false;
    if (!isOAuth) {
      const before = smtpFromAccount(account);
      const port = Number(smtp.port);
      if (smtp.host.trim() !== before.host) body.smtpHost = smtp.host.trim();
      if (smtp.port !== before.port) {
        if (!Number.isInteger(port) || port < 1 || port > 65535) return setError('The SMTP port must be a number between 1 and 65535.');
        body.smtpPort = port;
      }
      if (smtp.security !== before.security) body.smtpSecurity = smtp.security;
      if (smtp.user.trim() !== before.user) body.smtpUser = smtp.user.trim();
      if (smtp.password) body.smtpPassword = smtp.password;
      smtpChanged = ['smtpHost', 'smtpPort', 'smtpSecurity', 'smtpUser', 'smtpPassword'].some((k) => k in body);
      if ('smtpHost' in body && before.host && !smtp.password) {
        setSmtpOpen(true);
        return setError('Enter the SMTP password again to send through a different server.');
      }
    }
    setBusy(true);
    try {
      await updateAccount(account.id, body);
      toast(password ? 'Password updated — checking for new mail…' : smtpChanged ? 'Sending settings checked and saved' : 'Account saved', { type: 'success' });
      setPassword('');
      setSmtp((v) => ({ ...v, password: '' }));
      setBusy(false);
      onDone();
    } catch (err) {
      setError(err.message || "Couldn't save the account.");
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    try {
      await removeAccount(account.id);
      // The row unmounts once the account is gone from the list.
    } catch (err) {
      setError(err.message || "Couldn't remove the account.");
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  return html`<form id=${formId} class="form account-editor" onSubmit=${onSubmit}>
    ${(account.status === 'error' || account.status === 'auth_error') && account.lastError
      ? html`<div class=${`banner ${account.status === 'auth_error' ? 'banner-warning' : 'banner-danger'}`}>
          <${Icon} name="alert" size=${16} /><span>${account.lastError}</span>
        </div>`
      : null}
    <label class="field">
      <span class="field-label">Display name</span>
      <input class="input" type="text" maxlength="60" placeholder="e.g. Work" value=${displayName} onInput=${(e) => setDisplayName(e.currentTarget.value)} />
    </label>
    <${ColorSwatches} value=${color} onChange=${setColor} label="Color" />
    <fieldset class="fieldset">
      <legend class="field-label">Show in tabs</legend>
      <${TabChecklist} tabs=${tabs} selected=${tabIds} onToggle=${toggleTab} emptyText="You haven't made any tabs yet." />
    </fieldset>
    ${isOAuth
      ? html`<div class="field">
          <span class="field-label">Sign-in</span>
          <div class="reconnect-row">
            <span class="muted small">
              Connected with ${OAUTH_NAMES[oauthProvider] || 'OAuth'} sign-in.${' '}
              ${account.canSend === false ? html`<strong class="send-off">Reconnect to enable sending.</strong>` : account.canSend ? 'Sending is set up.' : ''}
            </span>
            ${canReconnect
              ? html`<button type="button" class="btn btn-sm" onClick=${() => startOAuth(oauthProvider, { accountId: account.id })}>
                  <${Icon} name="refresh" size=${14} /> Reconnect
                </button>`
              : html`<span class="muted small">${OAUTH_NAMES[oauthProvider] || 'OAuth'} sign-in isn't configured on this server, so it can't be reconnected.</span>`}
          </div>
        </div>`
      : html`<label class="field">
          <span class="field-label">Update ${preset && /app/i.test(preset.passwordHelp || '') ? 'app password' : 'password'}</span>
          <input
            class="input"
            type="password"
            autocomplete="off"
            placeholder="Leave blank to keep the current one"
            value=${password}
            onInput=${(e) => setPassword(e.currentTarget.value)}
          />
          ${preset && preset.passwordHelp ? html`<span class="field-hint">${preset.passwordHelp}</span>` : null}
        </label>`}
    ${isOAuth ? null : html`<${SendingFields} account=${account} smtp=${smtp} setSmtp=${setSmtp} open=${smtpOpen} setOpen=${setSmtpOpen} />`}

    <${InlineError} message=${error} />

    ${confirmRemove
      ? html`<div class="confirm-box" role="alert">
          <p><strong>Remove ${account.email}?</strong> This removes it from Mailtabs only; your mail stays on the server.</p>
          <div class="row-gap">
            <button type="button" class="btn btn-ghost" onClick=${() => setConfirmRemove(false)} disabled=${busy} data-autofocus>Keep account</button>
            <button type="button" class="btn btn-danger" onClick=${onRemove} disabled=${busy}>
              ${busy ? html`<${Spinner} size=${14} />` : null} Remove account
            </button>
          </div>
        </div>`
      : html`<div class="editor-actions">
          <button type="button" class="btn btn-ghost btn-danger-text" onClick=${() => setConfirmRemove(true)}>
            <${Icon} name="trash" size=${15} /> Remove
          </button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" onClick=${onDone}>Cancel</button>
          <button type="submit" class="btn btn-primary" disabled=${busy}>
            ${busy ? html`<${Spinner} size=${14} />` : null} ${!isOAuth && (password || smtp.password || smtp.host.trim() !== (account.smtpHost || '')) ? 'Check & save' : 'Save changes'}
          </button>
        </div>`}
  </form>`;
}

function AccountsSection({ focusAccountId }) {
  const { accounts, tabs, presets, providers } = useStore((s) => ({
    accounts: s.accounts,
    tabs: s.tabs,
    presets: s.config.presets,
    providers: s.config.providers || {},
  }));
  const [expanded, setExpanded] = useState(focusAccountId || null);
  const now = useNow(30_000);
  const listRef = useRef(null);

  useEffect(() => {
    if (!focusAccountId || !listRef.current) return;
    // Wait until the dialog has opened (and set its own initial focus) first.
    const t = setTimeout(() => {
      const row = listRef.current && listRef.current.querySelector(`[data-account-id="${focusAccountId}"]`);
      if (!row) return;
      row.scrollIntoView({ block: 'nearest' });
      const input = row.querySelector('input[type=password]') || row.querySelector('.account-editor input');
      if (input) input.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return html`<div class="settings-section">
    <div class="section-head">
      <div>
        <h3 class="section-title">Email accounts</h3>
        <p class="section-sub">Mailtabs checks each account's folders every few minutes. Removing an account never deletes mail on the server.
          Calendar, contact sync, server-side filters, vacation replies and snooze stay on your provider's own site.</p>
      </div>
      <button type="button" class="btn btn-sm" onClick=${() => openDialog('addAccount')}><${Icon} name="plus" size=${14} /> Add account</button>
    </div>
    ${accounts.length === 0
      ? html`<div class="empty-inline">
          <p>No accounts connected yet.</p>
          <button type="button" class="btn btn-primary btn-sm" onClick=${() => openDialog('addAccount')}>Connect an account</button>
        </div>`
      : html`<ul class="account-list" ref=${listRef}>
          ${accounts.map((a) => {
            const open = expanded === a.id;
            const busy = a.status === 'syncing';
            return html`<li key=${a.id} class=${`account-item ${open ? 'is-open' : ''}`} data-account-id=${a.id}>
              <div class="account-row">
                <${ColorDot} color=${a.color} size=${10} />
                <div class="account-main">
                  <div class="account-name">${a.displayName || a.email}</div>
                  <div class="account-sub">
                    ${a.displayName ? html`<span>${a.email}</span><span aria-hidden="true"> · </span>` : null}
                    <span>${providerLabel(a.provider, presets, { short: true })}</span>
                    ${typeof a.messageCount === 'number' ? html`<span aria-hidden="true"> · </span><span>${a.messageCount.toLocaleString()} messages</span>` : null}
                    ${a.canSend === false ? html`<span aria-hidden="true"> · </span><span class="send-off">Can't send yet</span>` : null}
                  </div>
                </div>
                <div class="account-status"><${StatusPill} account=${a} now=${now} /></div>
                <div class="account-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    title="Sync now"
                    aria-label=${`Sync ${a.email} now`}
                    disabled=${busy}
                    onClick=${() => syncAccount(a.id)}
                  >
                    <${Icon} name="refresh" size=${16} className=${busy ? 'spin' : ''} />
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    aria-expanded=${open ? 'true' : 'false'}
                    aria-label=${`Edit ${a.email}`}
                    onClick=${() => setExpanded(open ? null : a.id)}
                  >
                    ${open ? 'Close' : 'Edit'}
                  </button>
                </div>
              </div>
              ${open
                ? html`<${AccountEditor} key=${`edit-${a.id}`} account=${a} tabs=${tabs} presets=${presets} providers=${providers} onDone=${() => setExpanded(null)} />`
                : null}
            </li>`;
          })}
        </ul>`}
  </div>`;
}

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setDone(false);
    if (next.length < 8) return setError('Use a new password with at least 8 characters.');
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      const wrongCurrent = err.code === 'WRONG_PASSWORD' || err.code === 'INVALID_CREDENTIALS' || err.status === 401;
      setError(wrongCurrent ? 'Your current password is not correct.' : err.message || "Couldn't change your password.");
    } finally {
      setBusy(false);
    }
  };

  return html`<div class="settings-section">
    <div class="section-head">
      <div>
        <h3 class="section-title">Mailtabs password</h3>
        <p class="section-sub">This is the password for Mailtabs itself, not for your email accounts. Changing it signs out your other devices.</p>
      </div>
    </div>
    <form class="form narrow" onSubmit=${onSubmit}>
      <input type="text" class="visually-hidden" autocomplete="username" tabindex="-1" aria-hidden="true" value="" readonly />
      <label class="field">
        <span class="field-label">Current password</span>
        <input class="input" type="password" autocomplete="current-password" required value=${current} onInput=${(e) => setCurrent(e.currentTarget.value)} />
      </label>
      <label class="field">
        <span class="field-label">New password</span>
        <input class="input" type="password" autocomplete="new-password" required minlength="8" value=${next} onInput=${(e) => setNext(e.currentTarget.value)} />
        <span class="field-hint">At least 8 characters.</span>
      </label>
      <label class="field">
        <span class="field-label">Confirm new password</span>
        <input class="input" type="password" autocomplete="new-password" required value=${confirm} onInput=${(e) => setConfirm(e.currentTarget.value)} />
      </label>
      <${InlineError} message=${error} />
      ${done ? html`<p class="success-text" role="status"><${Icon} name="check" size=${15} /> Password changed. Your other devices were signed out.</p>` : null}
      <div>
        <button type="submit" class="btn btn-primary" disabled=${busy}>${busy ? html`<${Spinner} size=${14} />` : null} Change password</button>
      </div>
    </form>
  </div>`;
}

function AppearanceSection() {
  const theme = useStore((s) => s.theme || 'system');
  const options = [
    { value: 'system', label: 'Match system' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  return html`<div class="settings-section">
    <div class="section-head">
      <div>
        <h3 class="section-title">Theme</h3>
        <p class="section-sub">Saved in this browser. Email bodies always render on a light background so they look as the sender intended.</p>
      </div>
    </div>
    <div class="segmented" role="radiogroup" aria-label="Theme">
      ${options.map(
        (o) => html`<button key=${o.value} type="button" class="segment" role="radio" aria-checked=${theme === o.value ? 'true' : 'false'} onClick=${() => setTheme(o.value)}>
          ${o.label}
        </button>`
      )}
    </div>
  </div>`;
}

/** "Saved" next to a setting for a few seconds (toasts would sit on top of the dialog). */
function useSavedFlag() {
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = () => {
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 2500);
  };
  return [saved, flash, () => setSaved(false)];
}

function SavedNote({ show }) {
  return show ? html`<span class="saved-note" role="status"><${Icon} name="check" size=${14} /> Saved</span>` : null;
}

function SendingSection() {
  const { settings, loaded } = useStore((s) => ({ settings: s.settings, loaded: s.settingsLoaded }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, flashSaved, hideSaved] = useSavedFlag();
  const selectId = useUid('undo-send');

  const onChange = async (e) => {
    const value = Number(e.currentTarget.value);
    setBusy(true);
    setError('');
    hideSaved();
    try {
      await updateSettings({ undoSendSeconds: value });
      flashSaved();
    } catch (err) {
      setError(err.message || "Couldn't save the setting.");
    } finally {
      setBusy(false);
    }
  };

  return html`<div class="settings-section">
    <div class="section-head">
      <div>
        <h3 class="section-title">Undo send</h3>
        <p class="section-sub">After you press Send, Mailtabs waits this long before handing the message to your mail server, so you can still take it back.</p>
      </div>
    </div>
    <div class="field inline-field">
      <label class="field-label" for=${selectId}>Delay</label>
      <select id=${selectId} class="input input-inline" value=${String(settings.undoSendSeconds)} onChange=${onChange} disabled=${busy || !loaded}>
        ${UNDO_SEND_CHOICES.map((n) => html`<option key=${n} value=${String(n)}>${n ? `${n} seconds` : 'Off — send right away'}</option>`)}
      </select>
      ${busy ? html`<${Spinner} size=${14} />` : html`<${SavedNote} show=${saved} />`}
    </div>
    <${InlineError} message=${error} />
    <div class="section-divider" role="presentation"></div>
    <div class="section-head">
      <div>
        <h3 class="section-title">From name and signatures</h3>
        <p class="section-sub">Each account has its own name and signature. Mailtabs sends from one address per account (aliases aren't supported) and doesn't request read receipts.</p>
      </div>
    </div>
    <${SignatureSettings} />
  </div>`;
}

const PERMISSION_TEXT = {
  unsupported: "This browser can't show desktop notifications.",
  denied: 'Notifications are blocked for Mailtabs in this browser. Allow them in the site settings (the icon left of the address), then turn this on again.',
  default: 'Your browser will ask for permission when you turn this on.',
  granted: '',
};

function NotificationsSection() {
  const enabled = useStore((s) => !!s.settings.notifications);
  const [permission, setPermission] = useState(() => notificationPermission());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, flashSaved, hideSaved] = useSavedFlag();
  const switchId = useUid('notify');

  const toggle = async (on) => {
    setBusy(true);
    setError('');
    hideSaved();
    try {
      await setNotifications(on);
      flashSaved();
    } catch (err) {
      setError(err.message || "Couldn't change notifications.");
    } finally {
      setPermission(notificationPermission());
      setBusy(false);
    }
  };

  const active = enabled && permission === 'granted';
  return html`<div class="settings-section">
    <div class="section-head">
      <div>
        <h3 class="section-title">Desktop notifications</h3>
        <p class="section-sub">
          Get a notification for new Inbox mail while Mailtabs is open in a browser tab you aren't looking at. At most three at a time; more arrive as one summary.
        </p>
      </div>
    </div>
    <label class="switch-row" for=${switchId}>
      <input
        id=${switchId}
        type="checkbox"
        role="switch"
        class="switch"
        checked=${active}
        disabled=${busy || permission === 'unsupported'}
        onChange=${(e) => toggle(e.currentTarget.checked)}
      />
      <span class="switch-label">Notify me about new mail</span>
      ${busy ? html`<${Spinner} size=${14} />` : html`<${SavedNote} show=${saved} />`}
    </label>
    ${enabled && permission !== 'granted' && permission !== 'unsupported'
      ? html`<div class="banner banner-warning">
          <${Icon} name="alert" size=${16} />
          <span>Notifications are on for your account, but this browser hasn't allowed them yet.</span>
          <button type="button" class="btn btn-sm" onClick=${() => toggle(true)} disabled=${busy || permission === 'denied'}>Allow</button>
        </div>`
      : null}
    ${PERMISSION_TEXT[permission] && !(enabled && permission === 'default') ? html`<p class="field-hint">${PERMISSION_TEXT[permission]}</p>` : null}
    <${InlineError} message=${error} />
  </div>`;
}

function ShortcutsSection() {
  return html`<div class="settings-section">
    <div class="section-head">
      <div>
        <h3 class="section-title">Keyboard shortcuts</h3>
        <p class="section-sub">Shortcuts are off while you're typing in a field. Actions apply to the selected messages when you have selected some.</p>
      </div>
    </div>
    <dl class="shortcut-list">
      ${SHORTCUTS.map(
        (s) => html`<div key=${s.label} class="shortcut-row">
          <dt>${s.keys.map((k, i) => html`${i ? html`<span class="muted"> or </span>` : null}<${Kbd}>${k}</${Kbd}>`)}</dt>
          <dd>${s.label}</dd>
        </div>`
      )}
    </dl>
  </div>`;
}

export function SettingsDialog({ accountId = null, section: initialSection = 'accounts' }) {
  const user = useStore((s) => s.user);
  const [section, setSection] = useState(accountId ? 'accounts' : initialSection);
  const tabsRef = useRef(null);
  const baseId = useUid('settings');

  // Arrow keys move between section tabs (WAI-ARIA tabs pattern).
  const onTabKeyDown = (e) => {
    const i = SECTIONS.findIndex((s) => s.id === section);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = SECTIONS[(i + 1) % SECTIONS.length];
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = SECTIONS[(i - 1 + SECTIONS.length) % SECTIONS.length];
    if (e.key === 'Home') next = SECTIONS[0];
    if (e.key === 'End') next = SECTIONS[SECTIONS.length - 1];
    if (!next) return;
    e.preventDefault();
    setSection(next.id);
    const btn = tabsRef.current && tabsRef.current.querySelector(`[data-section="${next.id}"]`);
    if (btn) btn.focus();
  };

  const footer = html`<div class="settings-foot">
    <span class="muted small">Signed in as <strong>${user ? user.email : ''}</strong></span>
    <button type="button" class="btn btn-ghost" onClick=${() => { closeDialog(); signOut(); }}>
      <${Icon} name="logout" size=${15} /> Sign out
    </button>
  </div>`;

  return html`<${Dialog} title="Settings" onClose=${closeDialog} size="lg" className="settings-dialog" footer=${footer}>
    <div class="settings-layout">
      <div class="settings-nav" role="tablist" aria-label="Settings sections" aria-orientation="horizontal" ref=${tabsRef} onKeyDown=${onTabKeyDown}>
        ${SECTIONS.map(
          (s) => html`<button
            key=${s.id}
            type="button"
            role="tab"
            id=${`${baseId}-tab-${s.id}`}
            data-section=${s.id}
            class="settings-nav-btn"
            aria-selected=${section === s.id ? 'true' : 'false'}
            aria-controls=${`${baseId}-panel`}
            tabindex=${section === s.id ? '0' : '-1'}
            onClick=${() => setSection(s.id)}
            data-autofocus=${section === s.id && !accountId ? true : undefined}
          >
            <${Icon} name=${s.icon} size=${16} /><span>${s.label}</span>
          </button>`
        )}
      </div>
      <div class="settings-panel" role="tabpanel" id=${`${baseId}-panel`} aria-labelledby=${`${baseId}-tab-${section}`}>
        ${section === 'accounts' ? html`<${AccountsSection} focusAccountId=${accountId} />` : null}
        ${section === 'sending' ? html`<${SendingSection} />` : null}
        ${section === 'notifications' ? html`<${NotificationsSection} />` : null}
        ${section === 'security' ? html`<${PasswordSection} />` : null}
        ${section === 'appearance' ? html`<${AppearanceSection} />` : null}
        ${section === 'shortcuts' ? html`<${ShortcutsSection} />` : null}
      </div>
    </div>
  </${Dialog}>`;
}
