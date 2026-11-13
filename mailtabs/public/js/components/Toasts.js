// Toast stack. Uses the Popover API (when available) so toasts render in the
// top layer and stay visible above an open modal dialog.
import { html, useEffect, useRef } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { dismissToast, runToastAction } from '../actions.js';
import { Icon } from '../icons.js';

const ICONS = { success: 'check', error: 'alert', info: 'info' };

export function Toasts() {
  // On phones the list has a floating Compose button in the corner; toasts sit above it.
  const { toasts, inDialog, aboveFab } = useStore((s) => ({ toasts: s.toasts, inDialog: !!s.dialog, aboveFab: !!s.user && s.openId == null }));
  const ref = useRef(null);
  const count = toasts.length;
  const lastId = count ? toasts[count - 1].id : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      // Re-show on every new toast so it moves above any dialog opened since.
      if (el.matches(':popover-open')) el.hidePopover();
      if (count > 0) el.showPopover();
    } catch (_) {
      /* popover unsupported or element detached: toasts still render in place */
    }
  }, [count, lastId]);

  // While a dialog is open, toasts move away from where dialog footers sit (see CSS).
  return html`<div
    ref=${ref}
    class=${`toasts ${inDialog ? 'in-dialog' : ''} ${aboveFab && !inDialog ? 'above-fab' : ''}`}
    popover="manual"
    aria-live="polite"
    aria-relevant="additions"
  >
    ${toasts.map(
      (t) => html`<div key=${t.id} class=${`toast toast-${t.type}`} role=${t.type === 'error' ? 'alert' : 'status'}>
        <span class="toast-icon"><${Icon} name=${ICONS[t.type] || 'info'} size=${16} /></span>
        <span class="toast-text">${t.message}</span>
        ${t.action
          ? html`<button type="button" class="toast-action" onClick=${() => runToastAction(t.id)}>${t.action.label}</button>`
          : null}
        <button type="button" class="icon-btn toast-close" aria-label="Dismiss" onClick=${() => dismissToast(t.id)}>
          <${Icon} name="x" size=${14} />
        </button>
      </div>`
    )}
  </div>`;
}
