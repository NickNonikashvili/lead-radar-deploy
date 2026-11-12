// Modal dialog built on the native <dialog> element: showModal() makes the rest
// of the page inert (focus stays inside), Esc closes via the `cancel` event, and
// focus returns to whatever was focused before the dialog opened.
import { html, useEffect, useRef } from '/vendor/preact-htm.js';
import { Icon } from '../icons.js';
import { useUid } from '../hooks.js';

const FIELD_SELECTOR =
  'input:not([type=hidden]):not([disabled]):not([type=radio]):not([type=checkbox]), select:not([disabled]), textarea:not([disabled])';

function pickInitialFocus(el) {
  const explicit = el.querySelector('[data-autofocus]');
  if (explicit) return explicit;
  // On touch screens don't pop the keyboard over the dialog; focus the panel.
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const body = el.querySelector('.dialog-body');
  if (!coarse && body) {
    const field = body.querySelector(FIELD_SELECTOR);
    if (field) return field;
  }
  return el.querySelector('.dialog-panel');
}

export function Dialog({ title, subtitle, onClose, children, footer, size = 'md', className = '', titleIcon = null }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useUid('dialog-title');
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const el = ref.current;
    const previouslyFocused = document.activeElement;
    let closingOurselves = false;

    try {
      el.showModal();
    } catch (_) {
      el.setAttribute('open', ''); // very old browsers: degrade to a non-modal dialog
    }
    const target = pickInitialFocus(el);
    if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });

    const onCancel = (e) => {
      e.preventDefault();
      if (onCloseRef.current) onCloseRef.current();
    };
    // If the browser closes the dialog on its own (e.g. repeated Esc), keep state in sync.
    const onNativeClose = () => {
      if (!closingOurselves && onCloseRef.current) onCloseRef.current();
    };
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onNativeClose);
    return () => {
      closingOurselves = true;
      el.removeEventListener('cancel', onCancel);
      el.removeEventListener('close', onNativeClose);
      if (el.open) el.close();
      if (previouslyFocused && previouslyFocused.isConnected && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  // Close on a click that both starts and ends on the backdrop (the <dialog>
  // element itself) so a drag from inside a text field doesn't dismiss it.
  const onMouseDown = (e) => {
    pressStartedOnBackdrop.current = e.target === ref.current;
  };
  const onClick = (e) => {
    if (e.target === ref.current && pressStartedOnBackdrop.current && onCloseRef.current) onCloseRef.current();
    pressStartedOnBackdrop.current = false;
  };

  return html`<dialog
    ref=${ref}
    class=${`dialog dialog-${size} ${className}`}
    aria-labelledby=${titleId}
    onMouseDown=${onMouseDown}
    onClick=${onClick}
  >
    <div class="dialog-panel" tabindex="-1">
      <header class="dialog-header">
        ${titleIcon}
        <div class="dialog-titles">
          <h2 class="dialog-title" id=${titleId}>${title}</h2>
          ${subtitle ? html`<p class="dialog-subtitle">${subtitle}</p>` : null}
        </div>
        <button type="button" class="icon-btn dialog-close" aria-label="Close" title="Close (Esc)" onClick=${() => onCloseRef.current && onCloseRef.current()}>
          <${Icon} name="x" size=${18} />
        </button>
      </header>
      <div class="dialog-body">${children}</div>
      ${footer ? html`<footer class="dialog-footer">${footer}</footer>` : null}
    </div>
  </dialog>`;
}
