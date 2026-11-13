// "Are you sure?" for destructive actions (delete forever, empty Trash, delete a folder).
import { html, useState } from '/vendor/preact-htm.js';
import { closeDialog } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { Dialog } from './Dialog.js';
import { InlineError } from './ui.js';

export function ConfirmDialog({ title, message, confirmLabel = 'OK', danger = false, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError((err && err.message) || "That didn't work. Try again.");
      setBusy(false);
    }
  };

  const footer = html`<button type="button" class="btn btn-ghost" onClick=${closeDialog} disabled=${busy} data-autofocus>Cancel</button>
    <button type="button" class=${`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick=${confirm} disabled=${busy}>
      ${busy ? html`<${Spinner} size=${14} />` : null} ${confirmLabel}
    </button>`;

  return html`<${Dialog}
    title=${title}
    onClose=${() => !busy && closeDialog()}
    footer=${footer}
    size="sm"
    className="confirm-dialog"
    titleIcon=${danger ? html`<span class="dialog-title-icon is-danger"><${Icon} name="alert" size=${18} /></span>` : null}
  >
    <div class="stack">
      ${message ? html`<p class="confirm-text">${message}</p>` : null}
      <${InlineError} message=${error} />
    </div>
  </${Dialog}>`;
}
