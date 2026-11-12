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

  activeTabId: 'all', // 'all' | number
  filter: 'all', // all | unread | starred
  query: '',

  list: EMPTY_LIST,
  cursorId: null, // keyboard / selection cursor in the list
  openId: null, // message shown in the reading pane
  details: {}, // id -> { status: 'loading'|'ready'|'error', message?, error? }
  showImages: {}, // id -> true once the user allowed remote images

  syncing: false,
  lastCheckedAt: null,

  dialog: null, // { type: 'addAccount' | 'tabEditor' | 'settings', props }
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

/** Restore everything except config (used on sign-out / session expiry). */
export function resetState(overrides = {}) {
  state = { ...initialState, config: state.config, booted: true, ...overrides };
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
