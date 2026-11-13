// A button that opens a menu of actions (WAI-ARIA menu button pattern). The menu is
// position: fixed and kept next to its button, so scrolling containers (sidebar, reader
// toolbar) never clip it. Arrow keys / Home / End move, Esc closes and refocuses the button.
import { html, useEffect, useLayoutEffect, useRef, useState } from '/vendor/preact-htm.js';
import { Icon } from '../icons.js';
import { useUid } from '../hooks.js';

const GAP = 6;
const MARGIN = 8;

/**
 * items: [{ id, label, icon?, onSelect, danger?, disabled?, hint? } | { separator: true }]
 * The trigger is an icon button unless `text` is given.
 */
export function Menu({ items, label, icon = 'more', text = null, buttonClass = 'icon-btn', align = 'end', title, iconSize = 16, className = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useUid('menu');
  const visible = (items || []).filter(Boolean);

  const close = (refocus = true) => {
    setOpen(false);
    setPos(null);
    if (refocus && buttonRef.current) buttonRef.current.focus();
  };

  // Place the menu below (or above, when there's no room) the button, inside the viewport.
  const place = () => {
    if (!buttonRef.current || !menuRef.current) return;
    const b = buttonRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === 'start' ? b.left : b.right - m.width;
    left = Math.max(MARGIN, Math.min(left, vw - m.width - MARGIN));
    let top = b.bottom + GAP;
    if (top + m.height > vh - MARGIN && b.top - GAP - m.height >= MARGIN) top = b.top - GAP - m.height;
    top = Math.max(MARGIN, Math.min(top, vh - m.height - MARGIN));
    const next = { left: Math.round(left), top: Math.round(top) };
    setPos((p) => (p && p.left === next.left && p.top === next.top ? p : next));
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  // Move focus into the menu once it is placed (while hidden for measuring it can't take focus).
  const focused = useRef(false);
  useEffect(() => {
    if (!open) {
      focused.current = false;
      return;
    }
    if (!pos || focused.current) return;
    focused.current = true;
    const first = menuRef.current && menuRef.current.querySelector('[role=menuitem]:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }, [open, pos]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;
      close(false);
    };
    // Content resizing or scrolling (e.g. a message body finishing loading) moves the button:
    // follow it, and only close once it has left the screen.
    const onMove = (e) => {
      if (e && menuRef.current && e.target && e.target.nodeType === 1 && menuRef.current.contains(e.target)) return;
      const b = buttonRef.current && buttonRef.current.getBoundingClientRect();
      if (!b || !b.width || b.bottom < 0 || b.top > window.innerHeight) close(false);
      else place();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  const onMenuKeyDown = (e) => {
    const all = [...menuRef.current.querySelectorAll('[role=menuitem]:not([disabled])')];
    const i = all.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      all[(i + 1) % all.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      all[(i - 1 + all.length) % all.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      all[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      all[all.length - 1].focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const onButtonKeyDown = (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape' && open) {
      // Close the menu only; Esc must not also reach the app's shortcuts (close the message).
      e.preventDefault();
      e.stopPropagation();
      close(false);
    }
  };

  const choose = (item) => () => {
    if (item.disabled) return;
    close(true);
    item.onSelect();
  };

  if (!visible.length) return null;
  return html`<span class=${`menu-anchor ${className}`}>
    <button
      ref=${buttonRef}
      type="button"
      class=${`${buttonClass} ${open ? 'is-active' : ''}`}
      aria-haspopup="menu"
      aria-expanded=${open ? 'true' : 'false'}
      aria-controls=${open ? menuId : undefined}
      aria-label=${text ? undefined : label}
      title=${title || label}
      onClick=${() => (open ? close(false) : setOpen(true))}
      onKeyDown=${onButtonKeyDown}
    >
      ${icon ? html`<${Icon} name=${icon} size=${iconSize} />` : null}${text ? html`<span>${text}</span>` : null}
    </button>
    ${open
      ? html`<div
          ref=${menuRef}
          id=${menuId}
          class="menu menu-floating"
          role="menu"
          aria-label=${label}
          style=${pos ? { left: `${pos.left}px`, top: `${pos.top}px` } : { visibility: 'hidden', left: '0px', top: '0px' }}
          onKeyDown=${onMenuKeyDown}
        >
          ${visible.map((item, i) =>
            item.separator
              ? html`<div key=${`sep-${i}`} class="menu-sep" role="separator"></div>`
              : html`<button
                  key=${item.id || item.label}
                  type="button"
                  role="menuitem"
                  class=${`menu-item ${item.danger ? 'is-danger' : ''}`}
                  disabled=${item.disabled}
                  onClick=${choose(item)}
                >
                  ${item.icon ? html`<${Icon} name=${item.icon} size=${16} />` : html`<span class="menu-icon-gap" aria-hidden="true"></span>`}
                  <span class="menu-label">${item.label}</span>
                  ${item.hint ? html`<kbd class="kbd menu-hint" aria-hidden="true">${item.hint}</kbd>` : null}
                </button>`
          )}
        </div>`
      : null}
  </span>`;
}
