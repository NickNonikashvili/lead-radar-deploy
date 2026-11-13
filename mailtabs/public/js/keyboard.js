// Global keyboard shortcuts: j/k move, Enter/o open, c compose, r/a/f reply/reply all/forward,
// e archive, # delete, v move, ! spam, s star, u read/unread, x select, z undo, / search,
// Esc close reader / clear selection. List actions apply to the selection when there is one.
// Ignored while typing, while a dialog/menu is open, or with modifier keys.
import { useEffect } from '/vendor/preact-htm.js';
import { getState } from './store.js';
import {
  clearSelection,
  closeReader,
  compose,
  deleteMessages,
  findMessage,
  isDraftMessage,
  moveCursor,
  moveMessages,
  openMessage,
  openMoveDialog,
  setFlagsBulk,
  targetIds,
  targetMessageId,
  toggleRead,
  toggleSelect,
  toggleSpam,
  toggleStar,
  undoLast,
} from './actions.js';
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

/** Reply/forward target: the open or cursor message, never a draft. */
function replyTarget() {
  const id = targetMessageId();
  if (id == null) return null;
  const m = findMessage(id);
  return m && !isDraftMessage(m) ? id : null;
}

export function handleShortcut(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (isTypingTarget(e.target)) return false;
  const s = getState();
  if (s.dialog || document.querySelector('dialog[open]')) return false;
  // Menus, and non-modal windows such as the docked composer, keep their keys to themselves.
  if (e.target && e.target.closest && e.target.closest('[role=menu], [role=dialog], [data-shortcuts="off"]')) return false;

  const key = e.key;
  const target = targetMessageId();
  const ids = targetIds();
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
    case 'c':
      compose('new');
      break;
    case 'r':
    case 'a':
    case 'f': {
      const id = replyTarget();
      if (id == null) return false;
      compose(key === 'r' ? 'reply' : key === 'a' ? 'replyAll' : 'forward', id);
      break;
    }
    case 'e':
      if (!ids.length) return false;
      moveMessages(ids, 'archive');
      break;
    case '#':
      if (!ids.length) return false;
      deleteMessages(ids);
      break;
    case '!':
      if (!ids.length) return false;
      toggleSpam(ids);
      break;
    case 'v':
      if (!ids.length) return false;
      openMoveDialog(ids);
      break;
    case 's':
      if (!ids.length) return false;
      if (ids.length === 1) toggleStar(ids[0]);
      else setFlagsBulk(ids, ids.every((id) => (findMessage(id) || {}).isStarred) ? 'unstar' : 'star');
      break;
    case 'u':
      if (!ids.length) return false;
      if (ids.length === 1) toggleRead(ids[0]);
      else setFlagsBulk(ids, ids.some((id) => !(findMessage(id) || {}).isRead) ? 'read' : 'unread');
      break;
    case 'x':
      if (target == null) return false;
      toggleSelect(target);
      break;
    case 'z':
      if (!undoLast()) return false;
      break;
    case '/':
      focusSearch();
      break;
    case 'Escape':
      if (s.openId != null) closeReader();
      else if (s.selectedIds.length) clearSelection();
      else return false;
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
