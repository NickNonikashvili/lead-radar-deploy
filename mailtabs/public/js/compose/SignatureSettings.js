// Settings → Sending: per-account "From" name and signature (rich text), saved with
// PATCH /api/accounts/:id { senderName, signatureHtml }. Mounted by NAV's Settings dialog.
import { html, useEffect, useMemo, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { reconnectAccount, toast, updateAccount } from '../actions.js';
import { Spinner } from '../icons.js';
import { useUid } from '../hooks.js';
import { ColorDot, InlineError } from '../components/ui.js';
import { CIcon } from './compose-icons.js';
import { EditorController, EditorSurface, FormatToolbar } from './editor.js';
import { canSendFrom, sendBlockReason } from './compose.js';
import { LIMITS, byteLength, formatBytes } from './compose-utils.js';

function SignatureCard({ account, user }) {
  const [senderName, setSenderName] = useState(account.senderName || '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const uid = useUid('sig');
  const controller = useMemo(() => new EditorController({ onChange: () => setDirty(true) }), []);

  // Follow server-side changes while nothing is being edited here.
  useEffect(() => {
    if (dirty || busy) return;
    setSenderName(account.senderName || '');
    setVersion((v) => v + 1);
  }, [account.senderName, account.signatureHtml]);

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    const name = senderName.trim();
    if (/[\r\n<>]/.test(name)) return setError('The name can’t contain line breaks or < >.');
    if (name.length > LIMITS.maxSenderName) return setError(`Use at most ${LIMITS.maxSenderName} characters for the name.`);
    const signatureHtml = controller.isEmpty() ? '' : controller.getHtml() || '';
    if (byteLength(signatureHtml) > LIMITS.maxSignatureBytes) {
      return setError(`This signature is ${formatBytes(byteLength(signatureHtml))}; signatures can be up to ${formatBytes(LIMITS.maxSignatureBytes)}. Remove images or formatting.`);
    }
    setBusy(true);
    try {
      await updateAccount(account.id, { senderName: name, signatureHtml });
      setDirty(false);
      toast(`Saved the signature for ${account.email}`, { type: 'success' });
    } catch (err) {
      setError(err.message || "Couldn't save the signature.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSenderName(account.senderName || '');
    setVersion((v) => v + 1);
    setDirty(false);
    setError('');
  };

  const reason = sendBlockReason(account);
  return html`<form class="sig-card" onSubmit=${save} aria-labelledby=${`${uid}-title`}>
    <div class="sig-card-head">
      <${ColorDot} color=${account.color} size=${10} />
      <div class="sig-card-titles">
        <h4 class="sig-card-title" id=${`${uid}-title`}>${account.displayName || account.email}</h4>
        ${account.displayName ? html`<span class="sig-card-sub">${account.email}</span>` : null}
      </div>
      ${canSendFrom(account)
        ? null
        : html`<button type="button" class="btn btn-sm" onClick=${() => reconnectAccount(account)}><${CIcon} name="alert" size=${14} /> ${reason}</button>`}
    </div>
    <label class="field">
      <span class="field-label">From name</span>
      <input
        class="input"
        type="text"
        maxlength=${LIMITS.maxSenderName}
        placeholder=${(user && user.name) || 'Your name'}
        value=${senderName}
        onInput=${(e) => {
          setSenderName(e.currentTarget.value);
          setDirty(true);
        }}
      />
      <span class="field-hint">${`Shown to recipients as “${senderName.trim() || (user && user.name) || account.email} <${account.email}>”.`}</span>
    </label>
    <div class="field">
      <span class="field-label" id=${`${uid}-sig`}>Signature</span>
      <div class="sig-editor">
        <${EditorSurface} controller=${controller} html=${account.signatureHtml || ''} version=${version} label=${`Signature for ${account.email}`} className="sig-rte" />
        <${FormatToolbar} controller=${controller} compact=${true} label="Signature formatting" className="sig-toolbar" />
      </div>
      <span class="field-hint">Added to new messages, replies and forwards sent from this account. It changes automatically when you switch the From account.</span>
    </div>
    <${InlineError} message=${error} />
    <div class="sig-actions">
      ${dirty ? html`<button type="button" class="btn btn-ghost btn-sm" onClick=${reset} disabled=${busy}>Undo changes</button>` : null}
      <button type="submit" class="btn btn-primary btn-sm" disabled=${busy || !dirty}>
        ${busy ? html`<${Spinner} size=${13} />` : null} Save
      </button>
    </div>
  </form>`;
}

/** Per-account sender name + signature editors. `accountId` limits it to one account. */
export function SignatureSettings({ accountId = null } = {}) {
  const { accounts, user } = useStore((s) => ({ accounts: s.accounts, user: s.user }));
  const list = accountId != null ? accounts.filter((a) => a.id === accountId) : accounts;
  if (!list.length) return html`<p class="muted small">Connect an email account to set up its signature.</p>`;
  return html`<div class="sig-list">
    ${list.map((a) => html`<${SignatureCard} key=${a.id} account=${a} user=${user} />`)}
  </div>`;
}
