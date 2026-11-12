// Global keyboard shortcuts (SPEC §8): j/k move, Enter/o open, e archive,
// # delete, s star, u toggle unread, / search, Esc close reader.
// Ignored while typing, while a dialog/menu is open, or with modifier keys.
import { useEffect } from '/vendor/preact-htm.js';
import { getState } from './store.js';
import { closeReader, moveCursor, moveMessages, openMessage, targetMessageId, toggleRead, toggleStar } from './actions.js';
import { SEARCH_INPUT_ID } from './constants.js';

export function focusSearch() {
  const input = document.getElementById(SEARCH_INPUT_ID);
  if (input) {
    input.focus();
    input.select();
  }
}

export function isTypingTarget(el) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
  }
  return false;
}

function isActivatable(el) {
  // Note: may receive elements from the message iframe's document as well.
  return !!(el && el.closest && el.closest('button, a[href], summary, [role=menuitem], [role=button]'));
}

export function handleShortcut(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (isTypingTarget(e.target)) return false;
  const s = getState();
  if (s.dialog || document.querySelector('dialog[open]')) return false;
  if (e.target && e.target.closest && e.target.closest('[role=menu]')) return false;

  const key = e.key;
  const target = targetMessageId();
  switch (key) {
    case 'j':
      moveCursor(1);
      break;
    case 'k':
      moveCursor(-1);
      break;
    case 'Enter':
    case 'o': {
      // On a message row, open the *cursor* message: focus follows the cursor a
      // frame later, so a fast "j Enter" must not open the previously focused row.
      const onRow = !!(e.target && e.target.closest && e.target.closest('.msg-main'));
      // Elsewhere, Enter on a focused button/link activates it natively.
      if (key === 'Enter' && !onRow && isActivatable(e.target)) return false;
      if (s.cursorId == null) return false;
      openMessage(s.cursorId);
      break;
    }
    case 'e':
      if (target == null) return false;
      moveMessages([target], 'archive');
      break;
    case '#':
      if (target == null) return false;
      moveMessages([target], 'trash');
      break;
    case 's':
      if (target == null) return false;
      toggleStar(target);
      break;
    case 'u':
      if (target == null) return false;
      toggleRead(target);
      break;
    case '/':
      focusSearch();
      break;
    case 'Escape':
      if (s.openId == null) return false;
      closeReader();
      break;
    default:
      return false;
  }
  e.preventDefault();
  return true;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);
}

/**
 * Key presses inside the (same-origin, script-less) message iframe never reach the
 * app's document; listen on the iframe document too so shortcuts keep working
 * after the user clicks into an email.
 */
export function forwardShortcutsFrom(doc) {
  if (!doc || doc.__mailtabsShortcuts) return;
  doc.__mailtabsShortcuts = true;
  doc.addEventListener('keydown', handleShortcut);
}
