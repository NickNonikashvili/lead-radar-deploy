// All side effects live here: API calls, optimistic updates, timers, history.
// Components read state with useStore() and call these functions.
import { api, oauthStartUrl, setUnauthorizedHandler } from './api.js';
import { getState, setState, resetState, EMPTY_LIST } from './store.js';
import { MOBILE_QUERY, providerLabel } from './constants.js';
import { plural } from './format.js';

const PAGE_SIZE = 50;
const DETAIL_CACHE_MAX = 40;
const IDLE_REFRESH_MS = 60_000;
const BUSY_REFRESH_MS = 5_000;

// ---------------------------------------------------------------------------
// Small utilities

function storageGet(storage, key) {
  try {
    return window[storage].getItem(key);
  } catch (_) {
    return null; // private mode / blocked storage
  }
}

function storageSet(storage, key, value) {
  try {
    if (value === null) window[storage].removeItem(key);
    else window[storage].setItem(key, value);
  } catch (_) {
    /* ignore: these are conveniences only */
  }
}

export function isMobile() {
  return typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches;
}

function isSessionGone(err) {
  return err && err.status === 401 && (!err.code || err.code === 'UNAUTHENTICATED');
}

/** Sort comparator matching the server's `date DESC, id DESC`. */
function newestFirst(a, b) {
  return b.date - a.date || b.id - a.id;
}

function hasRules(tab) {
  return !!(tab && tab.rules && Array.isArray(tab.rules.conditions) && tab.rules.conditions.length);
}

export function accountLabel(account, presets) {
  if (!account) return 'This account';
  return account.displayName || providerLabel(account.provider, presets, { short: true });
}

// ---------------------------------------------------------------------------
// Toasts

let toastSeq = 0;

export function toast(message, { type = 'info', timeout } = {}) {
  // Don't stack identical toasts (e.g. the same error from parallel requests).
  const existing = getState().toasts.find((t) => t.message === message && t.type === type);
  if (existing) return existing.id;
  const id = ++toastSeq;
  setState((s) => ({ toasts: [...s.toasts, { id, message, type }].slice(-4) }));
  const ms = timeout !== undefined ? timeout : type === 'error' ? 7000 : 4000;
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id) {
  setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function toastError(err, fallback = 'Something went wrong.') {
  if (!err || err.name === 'AbortError' || isSessionGone(err)) return;
  toast(err.message || fallback, { type: 'error' });
}

// ---------------------------------------------------------------------------
// Theme (per-browser preference)

export function loadTheme() {
  const t = storageGet('localStorage', 'mt.theme');
  return t === 'light' || t === 'dark' ? t : 'system';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

export function setTheme(theme) {
  storageSet('localStorage', 'mt.theme', theme === 'system' ? null : theme);
  applyTheme(theme);
  setState({ theme });
}

// ---------------------------------------------------------------------------
// Boot + session

setUnauthorizedHandler(() => {
  if (!getState().user) return;
  stopBackgroundRefresh();
  resetState({ theme: getState().theme });
  toast('Your session has ended. Please sign in again.');
});

function takeUrlFlags() {
  const url = new URL(window.location.href);
  const connected = url.searchParams.get('connected');
  const oauthError = url.searchParams.get('oauth_error');
  if (connected !== null || oauthError !== null) {
    url.searchParams.delete('connected');
    url.searchParams.delete('oauth_error');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  return { connected, oauthError };
}

export async function boot() {
  const theme = loadTheme();
  applyTheme(theme);
  setState({ theme, bootError: null });
  const { connected, oauthError } = takeUrlFlags();

  let config = getState().config;
  try {
    config = await api.config();
  } catch (_) {
    /* non-fatal: defaults hide OAuth buttons */
  }

  let user = null;
  try {
    ({ user } = await api.me());
  } catch (err) {
    if (err.status !== 401) {
      setState({ config, booted: true, bootError: err.message || "Can't reach Mailtabs." });
      return;
    }
  }

  setState({ config, user: user || null, booted: true });
  if (oauthError) toast(oauthError, { type: 'error' });
  if (user) await enterApp({ connectedId: connected });
}

async function enterApp({ connectedId } = {}) {
  const saved = storageGet('localStorage', 'mt.activeTab');
  const activeTabId = saved && saved !== 'all' && Number.isFinite(Number(saved)) ? Number(saved) : 'all';
  setState({ activeTabId });
  await Promise.allSettled([refreshAccounts(), refreshTabs()]);
  const s = getState();
  if (s.activeTabId !== 'all' && !s.tabs.some((t) => t.id === s.activeTabId)) setState({ activeTabId: 'all' });
  if (connectedId) await handleConnected(Number(connectedId));
  loadList();
  startBackgroundRefresh();
}

async function handleConnected(accountId) {
  toast('Account connected — syncing your inbox…', { type: 'success' });
  // Choices made in the Add account dialog before the OAuth redirect (color,
  // "Create a tab for this account") are stashed in sessionStorage; apply them now.
  let pending = null;
  try {
    pending = JSON.parse(storageGet('sessionStorage', 'mt.pendingOAuth') || 'null');
  } catch (_) {
    pending = null;
  }
  storageSet('sessionStorage', 'mt.pendingOAuth', null);
  if (!pending || !Number.isFinite(accountId)) return;
  if (Date.now() - (pending.at || 0) > 30 * 60 * 1000) return;
  if (pending.color) {
    try {
      await api.updateAccount(accountId, { color: pending.color });
      await refreshAccounts({ quiet: true });
    } catch (_) {
      /* cosmetic only */
    }
  }
  if (pending.tab && pending.tab.name) {
    try {
      const { tab } = await api.createTab({ name: pending.tab.name, color: pending.tab.color, accountIds: [accountId] });
      await refreshTabs();
      if (tab) selectTab(tab.id, { load: false });
    } catch (err) {
      toastError(err, "Couldn't create the tab.");
    }
  }
}

export async function signIn({ email, password }) {
  const { user } = await api.login({ email, password });
  setState({ user });
  await enterApp();
}

export async function signUp({ email, password, name }) {
  const { user } = await api.signup({ email, password, name: name || undefined });
  setState({ user });
  await enterApp();
}

export async function signOut() {
  try {
    await api.logout();
  } catch (_) {
    /* clear local state regardless */
  }
  stopBackgroundRefresh();
  resetState({ theme: getState().theme });
}

export async function changePassword(currentPassword, newPassword) {
  await api.changePassword({ currentPassword, newPassword });
}

// ---------------------------------------------------------------------------
// Accounts + tabs

export async function refreshAccounts({ quiet = false } = {}) {
  try {
    const { accounts } = await api.accounts();
    setState({ accounts: accounts || [], accountsLoaded: true });
    return accounts || [];
  } catch (err) {
    // Leave accountsLoaded alone: a failed load must not look like "no accounts yet".
    if (!quiet) toastError(err, "Couldn't load your accounts.");
    return null;
  }
}

export async function refreshTabs({ quiet = false } = {}) {
  try {
    const { tabs, all } = await api.tabs();
    setState({
      tabs: (tabs || []).slice().sort((a, b) => a.position - b.position),
      allCounts: all || { unreadCount: 0, totalCount: 0 },
      tabsLoaded: true,
    });
    return tabs || [];
  } catch (err) {
    setState({ tabsLoaded: true });
    if (!quiet) toastError(err, "Couldn't load your tabs.");
    return null;
  }
}

let countsTimer = null;
/** Re-fetch tab badges shortly after a burst of changes (rules make local math inexact). */
function scheduleCountsRefresh() {
  clearTimeout(countsTimer);
  countsTimer = setTimeout(() => refreshTabs({ quiet: true }), 700);
}

/** Optimistically adjust unread/total badges for a message in `accountId`. */
function adjustCounts(accountId, { unread = 0, total = 0 }) {
  if (!unread && !total) return;
  setState((s) => {
    const clamp = (n) => Math.max(0, n);
    const tabs = s.tabs.map((t) => {
      const containsAccount = t.allAccounts || (t.accountIds || []).includes(accountId);
      // A tab with rules only certainly contains the message if it is the tab being viewed.
      const certain = containsAccount && (!hasRules(t) || t.id === s.activeTabId);
      if (!certain) return t;
      return { ...t, unreadCount: clamp(t.unreadCount + unread), totalCount: clamp(t.totalCount + total) };
    });
    return {
      tabs,
      allCounts: {
        unreadCount: clamp(s.allCounts.unreadCount + unread),
        totalCount: clamp(s.allCounts.totalCount + total),
      },
    };
  });
}

export function selectTab(tabId, { load = true } = {}) {
  const s = getState();
  storageSet('localStorage', 'mt.activeTab', String(tabId));
  if (s.activeTabId === tabId && load) return;
  if (s.openId != null) closeReader();
  setState({ activeTabId: tabId, cursorId: null });
  if (load) loadList();
}

export async function createTab(data) {
  const { tab } = await api.createTab(data);
  await refreshTabs({ quiet: true });
  if (tab) selectTab(tab.id);
  toast(`Tab “${tab ? tab.name : data.name}” created`, { type: 'success' });
  return tab;
}

export async function updateTab(tabId, data) {
  const { tab } = await api.updateTab(tabId, data);
  await refreshTabs({ quiet: true });
  if (getState().activeTabId === tabId) loadList();
  toast('Tab saved', { type: 'success' });
  return tab;
}

export async function deleteTab(tabId) {
  await api.deleteTab(tabId);
  const wasActive = getState().activeTabId === tabId;
  setState((s) => ({ tabs: s.tabs.filter((t) => t.id !== tabId) }));
  if (wasActive) selectTab('all');
  refreshTabs({ quiet: true });
  toast('Tab deleted', { type: 'success' });
}

/** Persist a new tab order; reorders locally first and reverts on failure. */
export async function reorderTabs(ids) {
  const before = getState().tabs;
  const byId = new Map(before.map((t) => [t.id, t]));
  const next = ids.map((tid, i) => ({ ...byId.get(tid), position: i })).filter((t) => t.id !== undefined);
  if (next.length !== before.length) return;
  setState({ tabs: next });
  try {
    await api.reorderTabs(ids);
  } catch (err) {
    setState({ tabs: before });
    toastError(err, "Couldn't reorder tabs.");
  }
}

export function moveTab(tabId, direction) {
  const ids = getState().tabs.map((t) => t.id);
  const i = ids.indexOf(tabId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  reorderTabs(ids);
}

/** Password/IMAP account. Optionally creates a tab containing just this account. */
export async function addPasswordAccount(body, { newTab = null } = {}) {
  const { account } = await api.createAccount(body);
  let tab = null;
  if (newTab && account) {
    try {
      ({ tab } = await api.createTab({ name: newTab.name, color: newTab.color, accountIds: [account.id] }));
    } catch (err) {
      toastError(err, "The account was added, but the tab couldn't be created.");
    }
  }
  await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true })]);
  if (tab) selectTab(tab.id);
  else loadList({ keepMessages: true });
  restartBackgroundRefresh(); // poll faster while the first sync runs
  toast(`${account ? account.email : 'Account'} connected — syncing your inbox…`, { type: 'success' });
  return account;
}

/**
 * Full-page redirect into Google/Microsoft sign-in. `accountColor` / `pendingTab`
 * (new accounts only) are applied when the browser comes back with ?connected=<id>.
 */
export function startOAuth(provider, { tabIds = [], accountId, pendingTab = null, accountColor = null } = {}) {
  const pending = !accountId && (pendingTab || accountColor) ? { tab: pendingTab, color: accountColor, at: Date.now() } : null;
  storageSet('sessionStorage', 'mt.pendingOAuth', pending ? JSON.stringify(pending) : null);
  window.location.assign(oauthStartUrl(provider, { tabIds, accountId }));
}

export async function updateAccount(accountId, body) {
  const { account } = await api.updateAccount(accountId, body);
  await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true })]);
  loadList({ keepMessages: true });
  restartBackgroundRefresh();
  return account;
}

export async function removeAccount(accountId) {
  await api.deleteAccount(accountId);
  setState((s) => ({ accounts: s.accounts.filter((a) => a.id !== accountId) }));
  if (getState().openId != null) {
    const open = findMessage(getState().openId);
    if (open && open.accountId === accountId) closeReader();
  }
  await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true })]);
  loadList();
  toast('Account removed from Mailtabs', { type: 'success' });
}

export async function syncAccount(accountId) {
  setState((s) => ({ accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, status: 'syncing' } : a)) }));
  try {
    const { result } = await api.syncAccount(accountId);
    if (result && result.ok === false && !result.pending) toast(result.error || "Couldn't check this account.", { type: 'error' });
  } catch (err) {
    toastError(err, "Couldn't check this account.");
  } finally {
    await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true })]);
    softRefreshList();
  }
}

export async function syncAll() {
  const s = getState();
  if (s.syncing) return;
  setState({ syncing: true });
  try {
    const { results = [] } = await api.syncAll();
    const failed = results.filter((r) => r && r.ok === false && !r.pending);
    if (failed.length) {
      const accounts = getState().accounts;
      const first = accounts.find((a) => a.id === failed[0].accountId);
      const who = first ? first.email : 'an account';
      const more = failed.length > 1 ? ` (and ${plural(failed.length - 1, 'other account')})` : '';
      toast(`Couldn't check ${who}${more}: ${failed[0].error || 'unknown error'}`, { type: 'error' });
    }
    setState({ lastCheckedAt: Date.now() });
  } catch (err) {
    toastError(err, "Couldn't check for new mail.");
  } finally {
    setState({ syncing: false });
    await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true })]);
    await softRefreshList();
  }
}

// ---------------------------------------------------------------------------
// Message list

let listSeq = 0;
let listAbort = null;

// Optimistic changes vs. list fetches that were already in flight: a response
// started before an archive/delete or flag change must not undo it on screen.
let mutationSeq = 0; // bumped on every local message mutation
const hiddenIds = new Map(); // id -> expiry (ms): archived/deleted locally
const pendingFlags = new Map(); // id -> { isRead?, isStarred? } awaiting the server
const HIDE_MS = 15_000;

function hideIds(ids) {
  const until = Date.now() + HIDE_MS;
  for (const id of ids) hiddenIds.set(id, until);
}

function unhideIds(ids) {
  for (const id of ids) hiddenIds.delete(id);
}

/** Apply local knowledge (pending removals and flag edits) to server rows. */
function reconcile(messages) {
  const now = Date.now();
  for (const [id, until] of hiddenIds) if (until < now) hiddenIds.delete(id);
  const out = [];
  for (const m of messages) {
    if (hiddenIds.has(m.id)) continue;
    const flags = pendingFlags.get(m.id);
    out.push(flags ? { ...m, ...flags } : m);
  }
  return out;
}

function listParams(s = getState()) {
  const q = s.query.trim();
  return {
    tab: s.activeTabId,
    q: q || undefined,
    unread: s.filter === 'unread' || undefined,
    starred: s.filter === 'starred' || undefined,
    limit: PAGE_SIZE,
  };
}

function listKey(s = getState()) {
  const p = listParams(s);
  return JSON.stringify([p.tab, p.q || '', p.unread ? 1 : 0, p.starred ? 1 : 0]);
}

export async function loadList({ keepMessages = false } = {}) {
  const s = getState();
  if (!s.user) return;
  const key = listKey(s);
  const seq = ++listSeq;
  if (listAbort) listAbort.abort();
  const controller = new AbortController();
  listAbort = controller;
  setState((st) => ({
    list: { ...(keepMessages ? st.list : EMPTY_LIST), key, status: 'loading', error: null, loadingMore: false },
  }));
  try {
    const page = await api.messages(listParams(s), { signal: controller.signal });
    if (seq !== listSeq) return;
    const messages = reconcile(page.messages || []);
    const nextCursor = page.nextCursor || null;
    setState((st) => ({
      list: { key, messages, nextCursor, status: 'ready', loadingMore: false, error: null, moreError: null },
      cursorId: messages.some((m) => m.id === st.cursorId) ? st.cursorId : null,
    }));
  } catch (err) {
    if ((err && err.name === 'AbortError') || seq !== listSeq) return;
    setState((st) => ({ list: { ...st.list, status: 'error', error: err.message || "Couldn't load messages." } }));
  }
}

export async function loadMore() {
  const s = getState();
  const { list } = s;
  if (list.status !== 'ready' || list.loadingMore || !list.nextCursor) return;
  const seq = listSeq;
  setState((st) => ({ list: { ...st.list, loadingMore: true, moreError: null } }));
  try {
    const page = await api.messages({ ...listParams(s), before: list.nextCursor });
    if (seq !== listSeq || getState().list.key !== list.key) return;
    const messages = reconcile(page.messages || []);
    const nextCursor = page.nextCursor || null;
    setState((st) => {
      const seen = new Set(st.list.messages.map((m) => m.id));
      return {
        list: { ...st.list, messages: [...st.list.messages, ...messages.filter((m) => !seen.has(m.id))], nextCursor, loadingMore: false },
      };
    });
  } catch (err) {
    if (seq !== listSeq) return;
    setState((st) => ({ list: { ...st.list, loadingMore: false, moreError: err.message || "Couldn't load more." } }));
  }
}

/**
 * Re-fetch the first page and merge it in without disturbing what the user is
 * reading: new mail is prepended, flags on the first page are refreshed, and the
 * older pages already loaded are kept.
 */
export async function softRefreshList() {
  const s = getState();
  if (!s.user || s.list.status !== 'ready') return;
  const seq = listSeq;
  const mutationsAtStart = mutationSeq;
  const key = s.list.key;
  let page;
  try {
    page = await api.messages(listParams(s));
  } catch (_) {
    return; // background work: stay quiet, the next tick retries
  }
  if (seq !== listSeq || getState().list.key !== key) return;
  // Something changed locally while this was in flight: drop it, the next refresh is fresher.
  if (mutationsAtStart !== mutationSeq) return;
  setState((st) => {
    const messages = reconcile(page.messages || []);
    const current = st.list.messages;
    if (current.length <= messages.length || messages.length === 0) {
      return { list: { ...st.list, messages, nextCursor: page.nextCursor || null } };
    }
    const last = messages[messages.length - 1];
    const pageIds = new Set(messages.map((m) => m.id));
    const tail = current.filter((m) => !pageIds.has(m.id) && newestFirst(last, m) < 0);
    return { list: { ...st.list, messages: [...messages, ...tail] } };
  });
}

/** "Try again" after a failed load: refresh everything the workspace shows. */
export async function retryWorkspace() {
  await Promise.allSettled([refreshAccounts(), refreshTabs()]);
  loadList();
}

export function setFilter(filter) {
  if (getState().filter === filter) return;
  setState({ filter, cursorId: null });
  loadList();
}

export function setQuery(query) {
  if (getState().query === query) return;
  setState({ query });
  loadList({ keepMessages: true });
}

// ---------------------------------------------------------------------------
// Background refresh (badges, account status, new mail)

let bgTimer = null;
let lastBgRefresh = 0;

function onVisibility() {
  if (!document.hidden && Date.now() - lastBgRefresh > IDLE_REFRESH_MS) restartBackgroundRefresh(0);
}

export function startBackgroundRefresh() {
  stopBackgroundRefresh();
  document.addEventListener('visibilitychange', onVisibility);
  lastBgRefresh = Date.now();
  scheduleBackground();
}

export function stopBackgroundRefresh() {
  clearTimeout(bgTimer);
  bgTimer = null;
  document.removeEventListener('visibilitychange', onVisibility);
}

function restartBackgroundRefresh(delay) {
  if (!getState().user) return;
  clearTimeout(bgTimer);
  scheduleBackground(delay);
}

function anyAccountBusy() {
  return getState().accounts.some((a) => a.status === 'pending' || a.status === 'syncing');
}

function scheduleBackground(delay) {
  const ms = delay !== undefined ? delay : anyAccountBusy() ? BUSY_REFRESH_MS : IDLE_REFRESH_MS;
  bgTimer = setTimeout(backgroundTick, ms);
}

async function backgroundTick() {
  bgTimer = null;
  if (!getState().user) return;
  if (!document.hidden) {
    lastBgRefresh = Date.now();
    const wasBusy = anyAccountBusy();
    await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true })]);
    await refreshListIfChanged({ force: wasBusy && !anyAccountBusy() });
  }
  if (getState().user && bgTimer === null) scheduleBackground();
}

/** Cheap check (limit=1) whether the newest message in view changed. */
async function refreshListIfChanged({ force = false } = {}) {
  const s = getState();
  if (s.list.status !== 'ready') return;
  if (force) return softRefreshList();
  try {
    const { messages = [] } = await api.messages({ ...listParams(s), limit: 1 });
    const top = messages[0] ? messages[0].id : null;
    const currentTop = getState().list.messages[0] ? getState().list.messages[0].id : null;
    if (top !== currentTop) await softRefreshList();
  } catch (_) {
    /* quiet */
  }
}

// ---------------------------------------------------------------------------
// Messages: open, flags, archive/delete

export function findMessage(id) {
  const s = getState();
  const fromList = s.list.messages.find((m) => m.id === id);
  if (fromList) return fromList;
  const detail = s.details[id];
  return detail && detail.message ? detail.message : null;
}

function setDetail(id, value) {
  setState((s) => {
    const details = { ...s.details, [id]: value };
    const ids = Object.keys(details);
    if (ids.length > DETAIL_CACHE_MAX) {
      // Drop the oldest cached detail that isn't currently open.
      const drop = ids.find((k) => Number(k) !== s.openId && Number(k) !== id);
      if (drop !== undefined) delete details[drop];
    }
    return { details };
  });
}

/** Apply flag values to the list row and the cached detail. */
function applyLocalFlags(id, flags) {
  setState((s) => {
    const patch = {};
    const idx = s.list.messages.findIndex((m) => m.id === id);
    if (idx >= 0) {
      const messages = s.list.messages.slice();
      messages[idx] = { ...messages[idx], ...flags };
      patch.list = { ...s.list, messages };
    }
    const d = s.details[id];
    if (d && d.message) patch.details = { ...s.details, [id]: { ...d, message: { ...d.message, ...flags } } };
    return patch;
  });
}

async function loadDetail(id) {
  setDetail(id, { status: 'loading' });
  try {
    const { message } = await api.message(id);
    // Prefer the local flags: an optimistic update may have happened while loading.
    const local = getState().list.messages.find((m) => m.id === id);
    const merged = local ? { ...message, isRead: local.isRead, isStarred: local.isStarred } : message;
    setDetail(id, { status: 'ready', message: merged });
  } catch (err) {
    if (isSessionGone(err)) return;
    setDetail(id, { status: 'error', error: err.message || "Couldn't open this message.", notFound: err.status === 404 });
  }
}

export function retryDetail(id) {
  loadDetail(id);
}

/** The user allowed remote images for this message (reloads the body iframe). */
export function showImagesFor(id) {
  setState((s) => ({ showImages: { ...s.showImages, [id]: true } }));
}

// Mobile: opening a message pushes a history entry so the phone's Back button
// returns to the list instead of leaving the app.
let ignoreNextPop = false;

window.addEventListener('popstate', (event) => {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  const inReader = event.state && event.state.mtReader;
  if (!inReader && getState().openId != null) setState({ openId: null });
});

export function openMessage(id) {
  const s = getState();
  if (isMobile() && !(window.history.state && window.history.state.mtReader)) {
    window.history.pushState({ mtReader: true }, '');
  }
  setState({ openId: id, cursorId: id });
  const item = s.list.messages.find((m) => m.id === id);
  if (item && !item.isRead) updateFlags(id, { isRead: true }, { quiet: true });
  const cached = s.details[id];
  if (!cached || cached.status === 'error') loadDetail(id);
}

export function closeReader() {
  if (getState().openId == null) return;
  setState({ openId: null });
  if (window.history.state && window.history.state.mtReader) {
    ignoreNextPop = true;
    window.history.back();
  }
}

async function updateFlags(id, changes, { quiet = false } = {}) {
  const before = findMessage(id);
  if (!before) return;
  const previous = { isRead: before.isRead, isStarred: before.isStarred };
  const readDelta = 'isRead' in changes && changes.isRead !== before.isRead ? (changes.isRead ? -1 : 1) : 0;

  mutationSeq += 1;
  const pending = { ...(pendingFlags.get(id) || {}), ...changes };
  pendingFlags.set(id, pending);
  applyLocalFlags(id, changes);
  adjustCounts(before.accountId, { unread: readDelta });
  try {
    const { message } = await api.updateMessage(id, changes);
    if (message && pendingFlags.get(id) === pending) applyLocalFlags(id, { isRead: message.isRead, isStarred: message.isStarred });
  } catch (err) {
    if (pendingFlags.get(id) === pending) applyLocalFlags(id, previous);
    adjustCounts(before.accountId, { unread: -readDelta });
    if (!quiet || err.code === 'REMOTE_FAILED') toastError(err, "Couldn't update the message.");
  } finally {
    // Only the latest change for this message clears the override.
    if (pendingFlags.get(id) === pending) pendingFlags.delete(id);
    mutationSeq += 1;
    if (readDelta) scheduleCountsRefresh();
  }
}

export function toggleStar(id) {
  const m = findMessage(id);
  if (m) updateFlags(id, { isStarred: !m.isStarred });
}

export function toggleRead(id) {
  const m = findMessage(id);
  if (m) updateFlags(id, { isRead: !m.isRead });
}

function restoreMessages(messages, listKeyAtRemoval) {
  if (!messages.length) return;
  // The user moved to another tab/filter meanwhile: just reload what's on screen.
  if (getState().list.key !== listKeyAtRemoval) {
    loadList({ keepMessages: true });
    return;
  }
  setState((s) => {
    const ids = new Set(s.list.messages.map((m) => m.id));
    const merged = [...s.list.messages, ...messages.filter((m) => !ids.has(m.id))].sort(newestFirst);
    return { list: { ...s.list, messages: merged } };
  });
}

/** Archive or trash messages: removed from the list at once, restored if the server refuses. */
export async function moveMessages(ids, action) {
  const s = getState();
  const idSet = new Set(ids);
  const removed = ids.map((id) => findMessage(id)).filter(Boolean);
  if (!removed.length) return;

  const index = s.list.messages.findIndex((m) => idSet.has(m.id));
  const remaining = s.list.messages.filter((m) => !idSet.has(m.id));
  const next = index >= 0 ? remaining[Math.min(index, remaining.length - 1)] || null : null;
  const wasOpen = s.openId != null && idSet.has(s.openId);

  mutationSeq += 1;
  hideIds(ids);
  setState((st) => ({ list: { ...st.list, messages: remaining }, cursorId: next ? next.id : null }));
  for (const m of removed) adjustCounts(m.accountId, { total: -1, unread: m.isRead ? 0 : -1 });
  if (wasOpen) {
    if (next && !isMobile()) openMessage(next.id);
    else closeReader();
  }

  const verb = action === 'archive' ? 'archive' : 'delete';
  try {
    const { failed = [] } = await api.bulk(ids, action);
    if (failed.length) {
      const failedAccounts = new Set(failed.map((f) => f.accountId));
      const back = removed.filter((m) => failedAccounts.has(m.accountId));
      unhideIds(back.map((m) => m.id));
      restoreMessages(back, s.list.key);
      toast(`Couldn't ${verb} ${plural(back.length, 'message')}: ${failed[0].error || 'the mail server refused'}`, { type: 'error' });
    } else {
      const n = removed.length;
      toast(action === 'archive' ? (n === 1 ? 'Message archived' : `${n} messages archived`) : n === 1 ? 'Message moved to Trash' : `${n} messages moved to Trash`, {
        type: 'success',
      });
    }
  } catch (err) {
    unhideIds(removed.map((m) => m.id));
    restoreMessages(removed, s.list.key);
    toastError(err, `Couldn't ${verb} the message.`);
  } finally {
    mutationSeq += 1;
    scheduleCountsRefresh();
  }
}

export async function markAllRead() {
  const s = getState();
  const unreadIds = new Set(s.list.messages.filter((m) => !m.isRead).map((m) => m.id));
  mutationSeq += 1;
  setState((st) => ({ list: { ...st.list, messages: st.list.messages.map((m) => (m.isRead ? m : { ...m, isRead: true })) } }));
  try {
    const { count = 0 } = await api.markAllRead(s.activeTabId);
    toast(count ? `Marked ${plural(count, 'message')} as read` : 'Everything here is already read', { type: 'success' });
  } catch (err) {
    setState((st) => ({ list: { ...st.list, messages: st.list.messages.map((m) => (unreadIds.has(m.id) ? { ...m, isRead: false } : m)) } }));
    toastError(err, "Couldn't mark messages as read.");
  } finally {
    mutationSeq += 1;
    refreshTabs({ quiet: true });
  }
}

// ---------------------------------------------------------------------------
// Keyboard cursor

/** Move the list cursor by +1/-1. While a message is open, the next one opens too. */
export function moveCursor(delta) {
  const s = getState();
  const msgs = s.list.messages;
  if (!msgs.length) return null;
  const current = msgs.findIndex((m) => m.id === (s.openId != null ? s.openId : s.cursorId));
  const idx = current === -1 ? 0 : Math.min(msgs.length - 1, Math.max(0, current + delta));
  const id = msgs[idx].id;
  if (s.openId != null) openMessage(id);
  else setState({ cursorId: id });
  if (idx >= msgs.length - 5) loadMore();
  return id;
}

/** Keep the cursor on whichever row has keyboard focus (e.g. reached with Tab). */
export function setCursor(id) {
  if (getState().cursorId !== id) setState({ cursorId: id });
}

/** The message keyboard actions apply to: the open one, else the cursor. */
export function targetMessageId() {
  const s = getState();
  return s.openId != null ? s.openId : s.cursorId;
}

// ---------------------------------------------------------------------------
// Dialogs

export function openDialog(type, props = {}) {
  // Success/info toasts refer to what happened before; don't let them sit over the dialog.
  setState((s) => ({ dialog: { type, props }, toasts: s.toasts.filter((t) => t.type === 'error') }));
}

export function closeDialog() {
  setState({ dialog: null });
}

/** Which OAuth provider (google|microsoft) an account signs in with, if any. */
export function oauthProviderFor(account, presets) {
  const preset = (presets || []).find((p) => p.key === account.provider);
  if (preset && preset.oauthProvider) return preset.oauthProvider;
  if (account.provider === 'gmail') return 'google';
  if (account.provider === 'outlook') return 'microsoft';
  return null;
}

/** "Reconnect": OAuth accounts go back through sign-in, password accounts open Settings. */
export function reconnectAccount(account) {
  const s = getState();
  const provider = account.authType === 'oauth' ? oauthProviderFor(account, s.config.presets) : null;
  if (provider && s.config.providers && s.config.providers[provider]) {
    startOAuth(provider, { accountId: account.id });
    return;
  }
  openDialog('settings', { accountId: account.id });
}
