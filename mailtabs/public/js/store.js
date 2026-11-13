// A tiny global store: one immutable state object, setState(patch), and a
// useStore(selector) hook that re-renders a component only when its selected
// slice changes (shallow comparison).
import { useEffect, useReducer, useRef } from '/vendor/preact-htm.js';

export const EMPTY_LIST = Object.freeze({
  key: '',
  messages: [],
  nextCursor: null,
  status: 'idle', // idle | loading | ready | error
  loadingMore: false,
  error: null,
});

export const initialState = {
  booted: false,
  config: { allowSignups: true, providers: { google: false, microsoft: false }, presets: [] },
  user: null,

  accounts: [],
  accountsLoaded: false,
  tabs: [],
  tabsLoaded: false,
  allCounts: { unreadCount: 0, totalCount: 0 },

  // What the main list shows: 'inbox' (the tabs), a unified view across accounts
  // ('starred' | 'sent' | 'drafts' | 'junk' | 'trash'), 'outbox', or 'folder' (folderId).
  view: 'inbox',
  folderId: null,
  activeTabId: 'all', // 'all' | number (only meaningful in the inbox view)
  filter: 'all', // all | unread | starred
  query: '',

  folders: [], // every folder of every account (GET /api/folders), flattened
  foldersLoaded: false,
  folderSync: {}, // folderId -> 'syncing' | 'error' while a folder view is being refreshed
  backfill: { folderId: null, status: 'idle', error: null }, // "Load older messages"
  collapsed: {}, // sidebar tree: 'a:<accountId>' / 'f:<folderId>' -> true when collapsed

  outbox: { items: [], loaded: false, error: null },
  settings: { undoSendSeconds: 10, notifications: false },
  settingsLoaded: false,

  list: EMPTY_LIST,
  cursorId: null, // keyboard / selection cursor in the list
  selectedIds: [], // multi-select (checkboxes), in list order
  selectAnchor: null, // last row toggled without Shift (start of a Shift-click range)
  openId: null, // message shown in the reading pane
  details: {}, // id -> { status: 'loading'|'ready'|'error', message?, error? }
  threads: {}, // id of the opened message -> { status, messages?, error? }
  conversationView: true, // show the whole conversation in the reader
  showImages: {}, // id -> true once the user allowed remote images

  sidebarCollapsed: false, // desktop: icon rail instead of the full sidebar
  drawerOpen: false, // tablet/phone: navigation drawer

  syncing: false,
  lastCheckedAt: null,

  dialog: null, // { type: 'addAccount' | 'tabEditor' | 'settings' | 'move' | 'folder' | 'confirm', props }
  toasts: [],
};

let state = initialState;
const listeners = new Set();

export function getState() {
  return state;
}

/** setState({ a: 1 }) or setState((s) => ({ a: s.a + 1 })). Shallow-merges. */
export function setState(update) {
  const patch = typeof update === 'function' ? update(state) : update;
  if (!patch) return;
  state = { ...state, ...patch };
  for (const listener of [...listeners]) listener();
}

/** Restore everything except config and per-browser UI preferences (sign-out / session expiry). */
export function resetState(overrides = {}) {
  const keep = { sidebarCollapsed: state.sidebarCollapsed, conversationView: state.conversationView, collapsed: state.collapsed };
  state = { ...initialState, config: state.config, booted: true, ...keep, ...overrides };
  for (const listener of [...listeners]) listener();
}

function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !Object.is(a[k], b[k])) return false;
  }
  return true;
}

export function useStore(selector = (s) => s) {
  const [, forceRender] = useReducer((n) => n + 1, 0);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const selected = selector(state);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const check = () => {
      const next = selectorRef.current(state);
      if (!shallowEqual(next, selectedRef.current)) forceRender();
    };
    listeners.add(check);
    check(); // state may have changed between render and subscription
    return () => listeners.delete(check);
  }, []);

  return selected;
}
