// All side effects live here: API calls, optimistic updates, timers, history.
// Components read state with useStore() and call these functions.
import { api, oauthStartUrl, setUnauthorizedHandler } from './api.js';
import { getState, setState, resetState, EMPTY_LIST } from './store.js';
import { MOBILE_QUERY, UNIFIED_VIEWS, providerLabel } from './constants.js';
import { plural, senderLabel } from './format.js';
import { SPECIAL, folderLabel, isInboxFolder, nextSelection } from './components/navModel.js';
import { ensureComposerOwner, forgetOutboxItem, openComposer, resetComposers } from './compose/compose.js';

const PAGE_SIZE = 50;
const DETAIL_CACHE_MAX = 40;
const THREAD_CACHE_MAX = 20;
const IDLE_REFRESH_MS = 60_000;
const BUSY_REFRESH_MS = 5_000;
const UNDO_MS = 10_000;
const BULK_CHUNK = 500;
const BACKFILL_COUNT = 100;
const NOTIFY_MAX = 3;

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

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function accountLabel(account, presets) {
  if (!account) return 'This account';
  return account.displayName || providerLabel(account.provider, presets, { short: true });
}

// ---------------------------------------------------------------------------
// Toasts

let toastSeq = 0;

/** Errors stay long enough to read, longer for the ones that explain what to do (e.g. Gmail's "Show in IMAP"). */
function errorToastMs(message) {
  return Math.min(15000, Math.max(7000, String(message).length * 60));
}

/**
 * toast('Saved', { type: 'success' }); an `action` ({ label, run }) adds a button (e.g. Undo).
 * Toasts with an action are never merged with an identical one: each undoes something different.
 */
export function toast(message, { type = 'info', timeout, action = null } = {}) {
  if (!action) {
    // Don't stack identical toasts (e.g. the same error from parallel requests).
    const existing = getState().toasts.find((t) => t.message === message && t.type === type && !t.action);
    if (existing) return existing.id;
  }
  const id = ++toastSeq;
  setState((s) => ({ toasts: [...s.toasts, { id, message, type, action }].slice(-4) }));
  const ms = timeout !== undefined ? timeout : action ? UNDO_MS : type === 'error' ? errorToastMs(message) : 4000;
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id) {
  setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

/** The toast's action button was pressed: run it once and remove the toast. */
export function runToastAction(id) {
  const t = getState().toasts.find((x) => x.id === id);
  dismissToast(id);
  if (t && t.action && typeof t.action.run === 'function') t.action.run();
}

export function toastError(err, fallback = 'Something went wrong.') {
  if (!err || err.name === 'AbortError' || isSessionGone(err)) return;
  toast(err.message || fallback, { type: 'error' });
}

// ---------------------------------------------------------------------------
// Theme + per-browser preferences

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

function loadPrefs() {
  let collapsed = {};
  try {
    const parsed = JSON.parse(storageGet('localStorage', 'mt.collapsed') || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed)) if (/^[af]:\d+$/.test(k) && v === true) collapsed[k] = true;
    }
  } catch (_) {
    collapsed = {};
  }
  return {
    sidebarCollapsed: storageGet('localStorage', 'mt.sidebar') === 'rail',
    conversationView: storageGet('localStorage', 'mt.conversation') !== 'off',
    collapsed,
  };
}

export function setSidebarCollapsed(on) {
  storageSet('localStorage', 'mt.sidebar', on ? 'rail' : null);
  setState({ sidebarCollapsed: !!on });
}

/** Expand/collapse an account ('a:<id>') or folder ('f:<id>') in the sidebar tree. */
export function toggleCollapsed(key) {
  setState((s) => {
    const collapsed = { ...s.collapsed };
    if (collapsed[key]) delete collapsed[key];
    else collapsed[key] = true;
    storageSet('localStorage', 'mt.collapsed', JSON.stringify(collapsed));
    return { collapsed };
  });
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
  // 'failed' | 'signin'. The message itself is fetched from the server: text in the URL is
  // never displayed, so nobody can craft a link that makes Mailtabs show their words.
  const oauth = url.searchParams.get('oauth');
  if (connected !== null || oauth !== null || url.searchParams.has('oauth_error')) {
    url.searchParams.delete('connected');
    url.searchParams.delete('oauth');
    url.searchParams.delete('oauth_error');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  return { connected, oauth };
}

async function showOAuthOutcome(oauth, user) {
  if (oauth === 'signin') {
    toast('Please sign in to Mailtabs first, then connect the account again.', { type: 'error' });
  } else if (oauth === 'failed' && user) {
    try {
      const { error } = await api.oauthResult();
      if (error) toast(error, { type: 'error' });
    } catch (_) {
      /* nothing to show */
    }
  }
}

export async function boot() {
  const theme = loadTheme();
  applyTheme(theme);
  setState({ theme, bootError: null, ...loadPrefs() });
  const { connected, oauth } = takeUrlFlags();

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
  showOAuthOutcome(oauth, user);
  if (user) await enterApp({ connectedId: connected });
}

const VIEW_IDS = new Set(['inbox', 'outbox', ...UNIFIED_VIEWS.map((v) => v.id)]);

function savedView() {
  const raw = storageGet('localStorage', 'mt.view') || 'inbox';
  const m = /^folder:(\d+)$/.exec(raw);
  if (m) return { view: 'folder', folderId: Number(m[1]) };
  return { view: VIEW_IDS.has(raw) ? raw : 'inbox', folderId: null };
}

function persistView(view, folderId) {
  storageSet('localStorage', 'mt.view', view === 'folder' ? `folder:${folderId}` : view === 'inbox' ? null : view);
}

async function enterApp({ connectedId } = {}) {
  // Composers left open by somebody else (their session expired here) are dropped unseen.
  const { user } = getState();
  ensureComposerOwner(user ? user.id : null);
  const saved = storageGet('localStorage', 'mt.activeTab');
  const activeTabId = saved && saved !== 'all' && Number.isFinite(Number(saved)) ? Number(saved) : 'all';
  setState({ activeTabId, ...savedView() });
  await Promise.allSettled([refreshAccounts(), refreshTabs(), refreshFolders({ quiet: true }), loadSettings(), refreshOutbox()]);
  const s = getState();
  if (s.activeTabId !== 'all' && !s.tabs.some((t) => t.id === s.activeTabId)) setState({ activeTabId: 'all' });
  // A remembered folder may be gone (deleted elsewhere); fall back to the inbox.
  if (s.view === 'folder' && (!s.foldersLoaded || !folderById(s.folderId))) setState({ view: 'inbox', folderId: null });
  if (connectedId) await handleConnected(Number(connectedId));
  const v = getState();
  if (v.view !== 'outbox') loadList();
  if (v.view === 'folder') syncOpenedFolder(v.folderId);
  else if (v.view !== 'inbox' && v.view !== 'starred' && v.view !== 'outbox') syncUnifiedView(v.view);
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
  notifyWatermark = null;
  // Open composers belong to this user: never show them to whoever signs in next.
  resetComposers();
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
/** Re-fetch badges shortly after a burst of changes (rules make local math inexact). */
function scheduleCountsRefresh() {
  clearTimeout(countsTimer);
  countsTimer = setTimeout(() => {
    refreshTabs({ quiet: true });
    refreshFolders({ quiet: true });
  }, 700);
}

/** Optimistically adjust the inbox (tab) unread/total badges for a message in `accountId`. */
function adjustInboxCounts(accountId, { unread = 0, total = 0 }) {
  if (!unread && !total) return;
  setState((s) => {
    const clamp = (n) => Math.max(0, n);
    const tabs = s.tabs.map((t) => {
      const containsAccount = t.allAccounts || (t.accountIds || []).includes(accountId);
      // A tab with rules only certainly contains the message if it is the tab being viewed.
      const certain = containsAccount && (!hasRules(t) || (s.view === 'inbox' && t.id === s.activeTabId));
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

function adjustFolderCounts(folderId, { unread = 0, total = 0 }) {
  if ((!unread && !total) || folderId == null) return;
  setState((s) => ({
    folders: s.folders.map((f) =>
      f.id === folderId ? { ...f, unreadCount: Math.max(0, (f.unreadCount || 0) + unread), totalCount: Math.max(0, (f.totalCount || 0) + total) } : f
    ),
  }));
}

/** Badges for one message changing: its folder, and the tabs when it is inbox mail. */
function adjustCountsFor(m, deltas) {
  const folder = m.folderId != null ? folderById(m.folderId) : null;
  // Rows from servers without folder info come from the inbox (v1 behaviour).
  const inInbox = folder ? isInboxFolder(folder) : m.folderId == null && getState().view === 'inbox';
  if (inInbox) adjustInboxCounts(m.accountId, deltas);
  if (folder) adjustFolderCounts(folder.id, deltas);
}

export function selectTab(tabId, { load = true } = {}) {
  const s = getState();
  storageSet('localStorage', 'mt.activeTab', String(tabId));
  if (s.view !== 'inbox') {
    setState({ activeTabId: tabId });
    selectView('inbox', { load });
    return;
  }
  if (s.activeTabId === tabId && load) return;
  if (s.openId != null) closeReader();
  setState({ activeTabId: tabId, cursorId: null, selectedIds: [], selectAnchor: null });
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
  const s = getState();
  if (s.view === 'inbox' && s.activeTabId === tabId) loadList();
  toast('Tab saved', { type: 'success' });
  return tab;
}

export async function deleteTab(tabId) {
  await api.deleteTab(tabId);
  const wasActive = getState().activeTabId === tabId;
  setState((s) => ({ tabs: s.tabs.filter((t) => t.id !== tabId) }));
  if (wasActive) {
    if (getState().view === 'inbox') selectTab('all');
    else {
      // Not looking at the tabs right now: just forget the deleted one.
      storageSet('localStorage', 'mt.activeTab', 'all');
      setState({ activeTabId: 'all' });
    }
  }
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
  const { account, warnings = [] } = await api.createAccount(body);
  let tab = null;
  if (newTab && account) {
    try {
      ({ tab } = await api.createTab({ name: newTab.name, color: newTab.color, accountIds: [account.id] }));
    } catch (err) {
      toastError(err, "The account was added, but the tab couldn't be created.");
    }
  }
  await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true }), refreshFolders({ quiet: true })]);
  if (tab) selectTab(tab.id);
  else if (getState().view !== 'outbox') loadList({ keepMessages: true });
  restartBackgroundRefresh(); // poll faster while the first sync runs
  toast(`${account ? account.email : 'Account'} connected — syncing your inbox…`, { type: 'success' });
  // e.g. "Sending is not set up yet: …" — the account works for reading regardless.
  for (const w of Array.isArray(warnings) ? warnings : []) if (typeof w === 'string' && w) toast(w, { type: 'error', timeout: 12000 });
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
  if (getState().view !== 'outbox') loadList({ keepMessages: true });
  restartBackgroundRefresh();
  return account;
}

export async function removeAccount(accountId) {
  await api.deleteAccount(accountId);
  const s = getState();
  const viewedFolder = s.view === 'folder' ? folderById(s.folderId) : null;
  setState((st) => ({ accounts: st.accounts.filter((a) => a.id !== accountId), folders: st.folders.filter((f) => f.accountId !== accountId) }));
  if (getState().openId != null) {
    const open = findMessage(getState().openId);
    if (open && open.accountId === accountId) closeReader();
  }
  await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true }), refreshFolders({ quiet: true })]);
  if (viewedFolder && viewedFolder.accountId === accountId) selectView('inbox');
  else if (getState().view !== 'outbox') loadList();
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
    await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true }), refreshFolders({ quiet: true })]);
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
    await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true }), refreshFolders({ quiet: true }), refreshOutbox()]);
    await softRefreshList();
  }
}

// ---------------------------------------------------------------------------
// Folders

export function folderById(id) {
  if (id == null) return null;
  return getState().folders.find((f) => f.id === Number(id)) || null;
}

export function foldersOf(accountId) {
  return getState().folders.filter((f) => f.accountId === accountId);
}

export function specialFolder(accountId, specialUse) {
  return getState().folders.find((f) => f.accountId === accountId && f.specialUse === specialUse) || null;
}

function inboxFolderOf(accountId) {
  return getState().folders.find((f) => f.accountId === accountId && isInboxFolder(f)) || null;
}

/** The folder a message is in (null when the server didn't say). */
export function folderOfMessage(m) {
  return m && m.folderId != null ? folderById(m.folderId) : null;
}

export function isDraftMessage(m) {
  if (!m) return false;
  if (m.isDraft) return true;
  const f = folderOfMessage(m);
  return !!f && f.specialUse === SPECIAL.drafts;
}

export async function refreshFolders({ quiet = false } = {}) {
  try {
    const { accounts = [] } = await api.folders();
    const folders = [];
    for (const entry of accounts) {
      for (const f of entry.folders || []) folders.push({ ...f, accountId: f.accountId != null ? f.accountId : entry.accountId });
    }
    setState({ folders, foldersLoaded: true });
    return folders;
  } catch (err) {
    // A server without folder support: show the accounts without trees instead of "Loading…".
    if (err.status === 404) setState({ foldersLoaded: true });
    if (!quiet) toastError(err, "Couldn't load your folders.");
    return null;
  }
}

const syncKey = (view, folderId) => (view === 'folder' ? `f${folderId}` : view);

function setSyncStatus(key, status) {
  setState((s) => {
    const folderSync = { ...s.folderSync };
    if (status) folderSync[key] = status;
    else delete folderSync[key];
    return { folderSync };
  });
}

/** Opening a folder asks the server to check it now (spinner in the header), then refreshes the list. */
async function syncOpenedFolder(folderId) {
  const key = syncKey('folder', folderId);
  setSyncStatus(key, 'syncing');
  let gone = false;
  try {
    const { result } = await api.syncFolder(folderId);
    if (result && result.ok === false && !result.pending) toast(result.error || "Couldn't check this folder for new mail.", { type: 'error' });
    setSyncStatus(key, null);
  } catch (err) {
    gone = err.status === 404;
    setSyncStatus(key, gone ? null : 'error');
    if (!gone) toastError(err, "Couldn't check this folder for new mail.");
  }
  await refreshFolders({ quiet: true });
  const s = getState();
  if (s.view !== 'folder' || s.folderId !== folderId) return;
  if (gone || !folderById(folderId)) {
    toast('That folder no longer exists.', { type: 'error' });
    selectView('inbox');
    return;
  }
  if (s.list.status === 'ready' && s.list.messages.length) await softRefreshList();
  else loadList({ keepMessages: true });
}

/** Unified Sent/Drafts/Spam/Trash: check those folders of every account in the background. */
async function syncUnifiedView(view) {
  const def = UNIFIED_VIEWS.find((v) => v.id === view);
  if (!def || !def.specialUse) return;
  const targets = getState().folders.filter((f) => f.specialUse === def.specialUse && f.selectable !== false);
  if (!targets.length) return;
  setSyncStatus(view, 'syncing');
  await Promise.allSettled(targets.map((f) => api.syncFolder(f.id)));
  setSyncStatus(view, null);
  await refreshFolders({ quiet: true });
  if (getState().view === view) softRefreshList();
}

/** "Sync now" from a folder's ⋯ menu or the view header. */
export async function syncFolderNow(folderId) {
  const s = getState();
  if (s.view === 'folder' && s.folderId === folderId) return syncOpenedFolder(folderId);
  const key = syncKey('folder', folderId);
  setSyncStatus(key, 'syncing');
  try {
    const { result } = await api.syncFolder(folderId);
    if (result && result.ok === false && !result.pending) toast(result.error || "Couldn't check this folder.", { type: 'error' });
    else toast('Folder checked for new mail', { type: 'success' });
  } catch (err) {
    toastError(err, "Couldn't check this folder.");
  } finally {
    setSyncStatus(key, null);
    refreshFolders({ quiet: true });
    if (getState().view !== 'outbox') softRefreshList();
  }
}

/** Re-check what the current view shows (the header's refresh button). */
export function refreshView() {
  const s = getState();
  if (s.view === 'folder') return syncOpenedFolder(s.folderId);
  if (s.view === 'outbox') return refreshOutbox({ quiet: false });
  if (s.view === 'inbox') return syncAll();
  return syncUnifiedView(s.view);
}

/** "Load older messages": ask the server for mail older than the oldest stored, then show it. */
export async function loadOlder() {
  const s = getState();
  if (s.view !== 'folder' || s.backfill.status === 'loading') return;
  const folderId = s.folderId;
  setState({ backfill: { folderId, status: 'loading', error: null } });
  try {
    const { added = 0, hasOlder = false } = await api.backfillFolder(folderId, BACKFILL_COUNT);
    setState((st) => ({ folders: st.folders.map((f) => (f.id === folderId ? { ...f, hasOlder: !!hasOlder } : f)) }));
    if (getState().folderId !== folderId) return;
    setState({ backfill: { folderId, status: 'idle', error: null } });
    if (added > 0) await fetchListTail();
    else toast('There are no older messages in this folder.', { type: 'info' });
    refreshFolders({ quiet: true });
  } catch (err) {
    setState({ backfill: { folderId, status: 'error', error: err.message || "Couldn't load older messages." } });
  }
}

export async function createFolder({ accountId, name, parentId = null }) {
  const { folder } = await api.createFolder({ accountId, name, parentId: parentId || undefined });
  await refreshFolders({ quiet: true });
  if (parentId) setState((s) => {
    const collapsed = { ...s.collapsed };
    delete collapsed[`f:${parentId}`]; // show the new child
    return { collapsed };
  });
  toast(`Folder “${folder ? folderLabel(folder) : name}” created`, { type: 'success' });
  return folder;
}

export async function renameFolder(folderId, name) {
  const { folder } = await api.renameFolder(folderId, name);
  await refreshFolders({ quiet: true });
  toast(`Folder renamed to “${folder ? folderLabel(folder) : name}”`, { type: 'success' });
  return folder;
}

/**
 * Throws ApiError FOLDER_NOT_EMPTY (409) unless `force`; the dialog asks first. onDeleted runs as
 * soon as the server deleted it, before the folder leaves the store: the dialog closes there, so
 * it never re-renders for a folder that no longer exists.
 */
export async function deleteFolder(folderId, { force = false, onDeleted = null } = {}) {
  const before = folderById(folderId);
  await api.deleteFolder(folderId, { force });
  if (onDeleted) onDeleted();
  const s = getState();
  // Children go with their parent on the server.
  const prefix = before ? `${before.path}${before.delimiter || '/'}` : null;
  const doomed = new Set(
    s.folders.filter((f) => f.id === folderId || (prefix && before && f.accountId === before.accountId && f.path.startsWith(prefix))).map((f) => f.id)
  );
  setState((st) => ({ folders: st.folders.filter((f) => !doomed.has(f.id)) }));
  if (s.view === 'folder' && doomed.has(s.folderId)) selectView('inbox');
  // Focus was on the deleted folder's menu: put it somewhere that stays.
  focusStableElement();
  await refreshFolders({ quiet: true });
  refreshTabs({ quiet: true });
  toast(`Folder “${before ? folderLabel(before) : 'folder'}” deleted`, { type: 'success' });
}

/**
 * After the element that had the focus went away: focus the current sidebar entry (or Compose),
 * never leave it on <body>, where single keys are list shortcuts.
 */
function focusStableElement() {
  setTimeout(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const visible = (el) => !!el && el.offsetParent !== null;
    const target =
      [...document.querySelectorAll('nav.sidebar [aria-current=page]')].find(visible) || [...document.querySelectorAll('.compose-btn')].find(visible);
    if (target) target.focus({ preventScroll: true });
  }, 50);
}

/** Permanently delete everything in Trash/Spam folders (one or many, e.g. "Empty Trash" across accounts). */
export async function emptyFolders(folderIds) {
  let count = 0;
  const failures = [];
  await Promise.all(
    folderIds.map(async (fid) => {
      try {
        const r = await api.emptyFolder(fid);
        count += Number(r.count) || 0;
      } catch (err) {
        failures.push({ fid, err });
      }
    })
  );
  await refreshFolders({ quiet: true });
  const s = getState();
  if (s.view !== 'outbox') loadList({ keepMessages: true });
  if (failures.length) {
    const f = folderById(failures[0].fid);
    toast(`Couldn't empty ${f ? folderLabel(f) : 'a folder'}: ${failures[0].err.message || 'the mail server refused'}`, { type: 'error' });
  }
  if (count || !failures.length) toast(count ? `Deleted ${plural(count, 'message')} forever` : 'Nothing to delete', { type: 'success' });
}

// ---------------------------------------------------------------------------
// Views

/**
 * Switch what the main area shows: 'inbox' (tabs), a unified view, 'outbox', or a folder.
 * Re-selecting the open folder checks it again.
 */
export function selectView(view, { folderId = null, load = true } = {}) {
  const s = getState();
  const nextFolderId = view === 'folder' ? Number(folderId) : null;
  const same = s.view === view && s.folderId === nextFolderId;
  persistView(view, nextFolderId);
  // Leaving the drawer (and, on phones, the open message) in one history step.
  const st = window.history.state || {};
  const steps = (st.mtDrawer && s.drawerOpen ? 1 : 0) + (!same && st.mtReader && s.openId != null ? 1 : 0);
  const patch = { drawerOpen: false };
  if (!same) {
    Object.assign(patch, {
      view,
      folderId: nextFolderId,
      openId: null,
      cursorId: null,
      selectedIds: [],
      selectAnchor: null,
      backfill: { folderId: null, status: 'idle', error: null },
      // "Starred" + the Starred filter would be the same thing twice.
      filter: view === 'starred' && s.filter === 'starred' ? 'all' : s.filter,
    });
  }
  setState(patch);
  if (steps) goBack(steps);
  if (same) {
    if (view === 'folder') syncOpenedFolder(nextFolderId);
    return;
  }
  if (view === 'outbox') {
    refreshOutbox({ quiet: false });
    return;
  }
  if (load) loadList();
  if (view === 'folder') syncOpenedFolder(nextFolderId);
  else if (view !== 'inbox' && view !== 'starred') syncUnifiedView(view);
}

export function selectFolder(folderId) {
  selectView('folder', { folderId });
}

/** Human name of the current view ("Inbox" / tab name, "Sent", folder name). */
export function viewTitle(s = getState()) {
  if (s.view === 'inbox') {
    if (s.activeTabId === 'all') return 'All inboxes';
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab ? tab.name : 'Inbox';
  }
  if (s.view === 'folder') {
    const f = s.folders.find((x) => x.id === s.folderId);
    return f ? folderLabel(f) : 'Folder';
  }
  const def = UNIFIED_VIEWS.find((v) => v.id === s.view);
  return def ? def.label : 'Mail';
}

// ---------------------------------------------------------------------------
// Message list

let listSeq = 0;
let listAbort = null;

// Optimistic changes vs. list fetches that were already in flight: a response
// started before an archive/delete or flag change must not undo it on screen.
let mutationSeq = 0; // bumped on every local message mutation
const hiddenIds = new Map(); // id -> expiry (ms): moved/deleted locally
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
  const params = {
    q: q || undefined,
    unread: s.filter === 'unread' || undefined,
    starred: (s.filter === 'starred' && s.view !== 'starred') || undefined,
    limit: PAGE_SIZE,
  };
  // Exactly one source per request.
  if (s.view === 'folder') params.folder = s.folderId;
  else if (s.view === 'inbox') params.tab = s.activeTabId;
  else params.view = s.view;
  return params;
}

function listKey(s = getState()) {
  const p = listParams(s);
  return JSON.stringify([p.tab ?? null, p.folder ?? null, p.view ?? null, p.q || '', p.unread ? 1 : 0, p.starred ? 1 : 0]);
}

/** Selection only ever holds rows that are still in the list. */
function pruneSelection(st, messages) {
  if (!st.selectedIds.length) return {};
  const present = new Set(messages.map((m) => m.id));
  const kept = st.selectedIds.filter((id) => present.has(id));
  return kept.length === st.selectedIds.length ? {} : { selectedIds: kept };
}

export async function loadList({ keepMessages = false } = {}) {
  const s = getState();
  if (!s.user || s.view === 'outbox') return;
  const key = listKey(s);
  const seq = ++listSeq;
  if (listAbort) listAbort.abort();
  const controller = new AbortController();
  listAbort = controller;
  const sameList = s.list.key === key;
  setState((st) => ({
    list: { ...(keepMessages ? st.list : EMPTY_LIST), key, status: 'loading', error: null, loadingMore: false },
    ...(sameList ? {} : { selectedIds: [], selectAnchor: null }),
  }));
  try {
    const page = await api.messages(listParams(s), { signal: controller.signal });
    if (seq !== listSeq) return;
    const messages = reconcile(page.messages || []);
    const nextCursor = page.nextCursor || null;
    setState((st) => ({
      list: { key, messages, nextCursor, tailCursor: null, status: 'ready', loadingMore: false, error: null, moreError: null },
      cursorId: messages.some((m) => m.id === st.cursorId) ? st.cursorId : null,
      ...pruneSelection(st, messages),
    }));
  } catch (err) {
    if ((err && err.name === 'AbortError') || seq !== listSeq) return;
    // Never leave the previous results on screen as if they answered this query: clear them
    // so the list shows the error with its "Try again" button.
    setState((st) => ({
      list: { ...st.list, messages: [], nextCursor: null, loadingMore: false, status: 'error', error: err.message || "Couldn't load messages." },
      selectedIds: [],
    }));
  }
}

export async function loadMore() {
  const s = getState();
  const { list } = s;
  if (list.status !== 'ready' || list.loadingMore || !list.nextCursor) return;
  const seq = listSeq;
  const cursor = list.nextCursor;
  setState((st) => ({ list: { ...st.list, loadingMore: true, moreError: null } }));
  try {
    const page = await api.messages({ ...listParams(s), before: cursor });
    if (seq !== listSeq || getState().list.key !== list.key) return;
    const messages = reconcile(page.messages || []);
    const nextCursor = page.nextCursor || null;
    setState((st) => {
      const seen = new Set(st.list.messages.map((m) => m.id));
      return {
        list: { ...st.list, messages: [...st.list.messages, ...messages.filter((m) => !seen.has(m.id))], nextCursor, tailCursor: cursor, loadingMore: false },
      };
    });
  } catch (err) {
    if (seq !== listSeq) return;
    setState((st) => ({ list: { ...st.list, loadingMore: false, moreError: err.message || "Couldn't load more." } }));
  }
}

/** After older mail arrived (backfill): re-read from the last page loaded and append what's new. */
async function fetchListTail() {
  const s = getState();
  const { list } = s;
  if (list.status !== 'ready') return loadList({ keepMessages: true });
  const seq = listSeq;
  try {
    const page = await api.messages({ ...listParams(s), before: list.tailCursor || undefined });
    if (seq !== listSeq || getState().list.key !== list.key) return;
    const messages = reconcile(page.messages || []);
    setState((st) => {
      const seen = new Set(st.list.messages.map((m) => m.id));
      const merged = [...st.list.messages, ...messages.filter((m) => !seen.has(m.id))].sort(newestFirst);
      return { list: { ...st.list, messages: merged, nextCursor: page.nextCursor || null } };
    });
  } catch (err) {
    toastError(err, "Couldn't show the older messages.");
  }
}

/**
 * Re-fetch the first page and merge it in without disturbing what the user is
 * reading: new mail is prepended, flags on the first page are refreshed, and the
 * older pages already loaded are kept.
 */
export async function softRefreshList() {
  const s = getState();
  if (!s.user || s.view === 'outbox' || s.list.status !== 'ready') return;
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
      return { list: { ...st.list, messages, nextCursor: page.nextCursor || null, tailCursor: null }, ...pruneSelection(st, messages) };
    }
    const last = messages[messages.length - 1];
    const pageIds = new Set(messages.map((m) => m.id));
    const tail = current.filter((m) => !pageIds.has(m.id) && newestFirst(last, m) < 0);
    const merged = [...messages, ...tail];
    return { list: { ...st.list, messages: merged }, ...pruneSelection(st, merged) };
  });
}

/** "Try again" after a failed load: refresh everything the workspace shows. */
export async function retryWorkspace() {
  await Promise.allSettled([refreshAccounts(), refreshTabs(), refreshFolders({ quiet: true })]);
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
  if (getState().view === 'outbox') {
    if (query.trim()) selectView('inbox');
    return;
  }
  loadList({ keepMessages: true });
}

// ---------------------------------------------------------------------------
// Background refresh (badges, account status, new mail, outbox, notifications)

let bgTimer = null;
let lastBgRefresh = 0;

function onVisibility() {
  if (!document.hidden && Date.now() - lastBgRefresh > IDLE_REFRESH_MS) restartBackgroundRefresh(0);
}

function onOutboxChanged() {
  refreshOutbox();
  restartBackgroundRefresh(BUSY_REFRESH_MS);
}

let draftsTimer = null;

/**
 * The composer saved, discarded or sent a draft. Rows of drafts that no longer exist leave the
 * list now; Drafts lists and counts are brought up to date shortly after (the server re-reads
 * its Drafts folder in the background).
 */
function onDraftsChanged(event) {
  const detail = (event && event.detail) || {};
  const gone = new Set((detail.removedMessageIds || []).filter((id) => id != null));
  if (gone.size) {
    mutationSeq += 1;
    hideIds([...gone]);
    setState((st) => ({
      list: { ...st.list, messages: st.list.messages.filter((m) => !gone.has(m.id)) },
      selectedIds: st.selectedIds.filter((id) => !gone.has(id)),
      cursorId: gone.has(st.cursorId) ? null : st.cursorId,
    }));
    mutationSeq += 1;
  }
  if (!detail.refresh) return;
  clearTimeout(draftsTimer);
  draftsTimer = setTimeout(() => {
    const s = getState();
    if (!s.user) return;
    const folder = s.view === 'folder' ? folderById(s.folderId) : null;
    if (s.view === 'drafts') syncUnifiedView('drafts');
    else if (folder && folder.specialUse === SPECIAL.drafts) syncOpenedFolder(folder.id);
    else refreshFolders({ quiet: true }); // the Drafts counts in the sidebar
  }, 1200);
}

export function startBackgroundRefresh() {
  stopBackgroundRefresh();
  document.addEventListener('visibilitychange', onVisibility);
  // The composer can announce sends/schedules so the Outbox count updates at once, and
  // saved/discarded/sent drafts so the Drafts list follows.
  window.addEventListener('mailtabs:outbox-changed', onOutboxChanged);
  window.addEventListener('mailtabs:drafts-changed', onDraftsChanged);
  lastBgRefresh = Date.now();
  scheduleBackground();
}

export function stopBackgroundRefresh() {
  clearTimeout(bgTimer);
  bgTimer = null;
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('mailtabs:outbox-changed', onOutboxChanged);
  window.removeEventListener('mailtabs:drafts-changed', onDraftsChanged);
  clearTimeout(draftsTimer);
}

function restartBackgroundRefresh(delay) {
  if (!getState().user) return;
  clearTimeout(bgTimer);
  scheduleBackground(delay);
}

function anyAccountBusy() {
  return getState().accounts.some((a) => a.status === 'pending' || a.status === 'syncing');
}

/** Something in the outbox goes out within the next minute: follow it closely. */
function outboxBusy() {
  const soon = Date.now() + IDLE_REFRESH_MS;
  return getState().outbox.items.some((o) => o.status === 'sending' || (o.status === 'queued' && o.sendAt <= soon));
}

function scheduleBackground(delay) {
  const busy = anyAccountBusy() || outboxBusy() || (getState().view === 'outbox' && getState().outbox.items.length > 0);
  const ms = delay !== undefined ? delay : busy ? BUSY_REFRESH_MS : IDLE_REFRESH_MS;
  bgTimer = setTimeout(backgroundTick, ms);
}

async function backgroundTick() {
  bgTimer = null;
  if (!getState().user) return;
  const notifying = notificationsActive();
  if (!document.hidden) {
    lastBgRefresh = Date.now();
    await Promise.allSettled([refreshAccounts({ quiet: true }), refreshTabs({ quiet: true }), refreshFolders({ quiet: true }), refreshOutbox()]);
    await refreshListIfChanged();
  } else if (notifying) {
    // Keeps the "(3) Mailtabs" title current while the tab is in the background.
    await refreshTabs({ quiet: true });
  }
  if (notifying) await checkNewMailForNotifications();
  if (getState().user && bgTimer === null) scheduleBackground();
}

/**
 * Bring the visible list up to date: new mail, and read/star/removal changes the server picked
 * up from other mail apps. Re-fetching the first page is one small request per tick.
 * A list that failed to load is retried.
 */
async function refreshListIfChanged() {
  const s = getState();
  if (s.view === 'outbox') return;
  if (s.list.status === 'error') return loadList();
  if (s.list.status !== 'ready') return;
  return softRefreshList();
}

// ---------------------------------------------------------------------------
// Desktop notifications (only while Mailtabs is open in a background tab)

let notifyWatermark = null; // highest inbox message id already seen

export function notificationPermission() {
  return typeof window.Notification === 'function' ? window.Notification.permission : 'unsupported';
}

function notificationsActive() {
  return !!getState().settings.notifications && notificationPermission() === 'granted';
}

/** Turning on asks the browser for permission first; throws with a readable reason if refused. */
export async function setNotifications(on) {
  if (on) {
    const current = notificationPermission();
    if (current === 'unsupported') throw new Error("This browser can't show desktop notifications.");
    let permission = current;
    if (permission === 'default') permission = await window.Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notifications are blocked for Mailtabs in this browser. Allow them in the site settings (the icon left of the address), then try again.');
    }
  }
  await updateSettings({ notifications: !!on });
  notifyWatermark = null;
  if (on) checkNewMailForNotifications(); // sets the watermark so old mail doesn't pop up
}

async function checkNewMailForNotifications() {
  let page;
  try {
    page = await api.messages({ tab: 'all', unread: true, limit: 20 });
  } catch (_) {
    return;
  }
  const messages = page.messages || [];
  const maxId = messages.reduce((n, m) => Math.max(n, m.id), 0);
  if (notifyWatermark === null) {
    notifyWatermark = maxId;
    return;
  }
  const fresh = messages.filter((m) => m.id > notifyWatermark && !m.isRead);
  notifyWatermark = Math.max(notifyWatermark, maxId);
  if (!fresh.length || !document.hidden || !notificationsActive()) return;
  if (fresh.length <= NOTIFY_MAX) {
    for (const m of fresh) showNotification(senderLabel(m), m.subject || '(no subject)', `mailtabs-${m.id}`, () => openFromNotification(m.id));
  } else {
    const who = [...new Set(fresh.map((m) => senderLabel(m)))].slice(0, 3).join(', ');
    showNotification(`${fresh.length} new messages`, `From ${who}${fresh.length > 3 ? ' and others' : ''}`, 'mailtabs-summary', () => openFromNotification(null));
  }
}

function showNotification(title, body, tag, onClick) {
  try {
    const n = new window.Notification(title, { body, tag, icon: '/favicon.svg' });
    n.onclick = () => {
      try {
        window.focus();
      } catch (_) {
        /* ignore */
      }
      n.close();
      onClick();
    };
  } catch (_) {
    /* some browsers only allow notifications from a service worker */
  }
}

function openFromNotification(messageId) {
  const s = getState();
  if (s.view !== 'inbox' || s.activeTabId !== 'all') {
    storageSet('localStorage', 'mt.activeTab', 'all');
    setState({ activeTabId: 'all' });
    selectView('inbox');
  } else softRefreshList();
  if (messageId != null) openMessage(messageId);
}

// ---------------------------------------------------------------------------
// Messages: open, flags, moves

export function findMessage(id) {
  const s = getState();
  const fromList = s.list.messages.find((m) => m.id === id);
  if (fromList) return fromList;
  const detail = s.details[id];
  if (detail && detail.message) return detail.message;
  for (const t of Object.values(s.threads)) {
    const hit = t && t.messages && t.messages.find((m) => m.id === id);
    if (hit) return hit;
  }
  return null;
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

/** Apply flag values to the list row, the cached detail and any loaded conversation. */
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
    let threadsChanged = false;
    const threads = {};
    for (const [k, t] of Object.entries(s.threads)) {
      if (t && t.messages && t.messages.some((m) => m.id === id)) {
        threadsChanged = true;
        threads[k] = { ...t, messages: t.messages.map((m) => (m.id === id ? { ...m, ...flags } : m)) };
      } else threads[k] = t;
    }
    if (threadsChanged) patch.threads = threads;
    return patch;
  });
}

/** markRead: the message was opened without being in the loaded list (a notification): mark it read once known. */
async function loadDetail(id, { markRead = false } = {}) {
  setDetail(id, { status: 'loading' });
  try {
    const { message } = await api.message(id);
    // Prefer the local flags: an optimistic update may have happened while loading.
    const local = getState().list.messages.find((m) => m.id === id);
    const merged = local ? { ...message, isRead: local.isRead, isStarred: local.isStarred } : message;
    setDetail(id, { status: 'ready', message: merged });
    if (markRead && !merged.isRead && getState().openId === id) updateFlags(id, { isRead: true }, { quiet: true });
  } catch (err) {
    if (isSessionGone(err)) return;
    const notFound = err.status === 404;
    setDetail(id, { status: 'error', error: err.message || "Couldn't open this message.", notFound });
    if (notFound) {
      // Moved or deleted in another app (and already gone here): drop the stale row.
      setState((st) => ({ list: { ...st.list, messages: st.list.messages.filter((m) => m.id !== id) } }));
      scheduleCountsRefresh();
    }
  }
}

export function retryDetail(id) {
  loadDetail(id);
}

/** Make sure a message's full detail is loaded (conversation items expanded in the reader). */
export function ensureDetail(id) {
  const d = getState().details[id];
  if (!d || d.status === 'error') loadDetail(id);
}

/** The user allowed remote images for this message (reloads the body iframe). */
export function showImagesFor(id) {
  setState((s) => ({ showImages: { ...s.showImages, [id]: true } }));
}

// --- conversation ----------------------------------------------------------

async function loadThread(id) {
  setState((s) => {
    const threads = { ...s.threads, [id]: { status: 'loading', messages: s.threads[id] && s.threads[id].messages } };
    const keys = Object.keys(threads);
    if (keys.length > THREAD_CACHE_MAX) {
      const drop = keys.find((k) => Number(k) !== s.openId && Number(k) !== id);
      if (drop !== undefined) delete threads[drop];
    }
    return { threads };
  });
  try {
    const { messages = [] } = await api.thread(id);
    setState((s) => ({ threads: { ...s.threads, [id]: { status: 'ready', messages } } }));
  } catch (err) {
    // The reader falls back to the single message.
    setState((s) => ({ threads: { ...s.threads, [id]: { status: 'error', error: err.message || '' } } }));
  }
}

export function setConversationView(on) {
  storageSet('localStorage', 'mt.conversation', on ? null : 'off');
  setState({ conversationView: !!on });
  const id = getState().openId;
  if (on && id != null && !getState().threads[id]) loadThread(id);
}

/** A collapsed message in the conversation was expanded: load it and mark it read. */
export function expandThreadMessage(id) {
  ensureDetail(id);
  const m = findMessage(id);
  if (m && !m.isRead) updateFlags(id, { isRead: true }, { quiet: true });
}

// --- history (phones: Back closes the reader / drawer / dialog) ---------------

let ignoreNextPop = false;
let popWaiters = [];

/** history.go(-steps) without the resulting popstate being treated as the user's Back. */
function goBack(steps = 1) {
  return new Promise((resolve) => {
    ignoreNextPop = true;
    popWaiters.push(resolve);
    window.history.go(-steps);
    setTimeout(resolve, 500); // popstate can be skipped (e.g. no entry): never hang
  });
}

window.addEventListener('popstate', (event) => {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    const waiters = popWaiters;
    popWaiters = [];
    for (const w of waiters) w();
    return;
  }
  const state = event.state || {};
  const s = getState();
  // Back while a full-screen dialog (mobile) is open closes the dialog, nothing else.
  if (!state.mtDialog && s.dialog) {
    setState({ dialog: null });
    return;
  }
  if (!state.mtDrawer && s.drawerOpen) {
    setState({ drawerOpen: false });
    return;
  }
  if (!state.mtReader && s.openId != null) setState({ openId: null });
});

export function openDrawer() {
  if (getState().drawerOpen) return;
  const current = window.history.state || {};
  if (isMobile() && !current.mtDrawer) window.history.pushState({ ...current, mtDrawer: true }, '');
  setState({ drawerOpen: true });
}

/** Resolves once the drawer's history entry (phones) is gone. */
export function closeDrawer() {
  if (!getState().drawerOpen) return Promise.resolve();
  setState({ drawerOpen: false });
  if (window.history.state && window.history.state.mtDrawer) return goBack(1);
  return Promise.resolve();
}

export function openMessage(id) {
  const s = getState();
  const item = s.list.messages.find((m) => m.id === id) || findMessage(id);
  // Drafts open in the composer, not the reader.
  if (item && isDraftMessage(item)) {
    setState({ cursorId: id });
    openComposer({ mode: 'draft', messageId: id });
    return;
  }
  if (isMobile() && !(window.history.state && window.history.state.mtReader)) {
    window.history.pushState({ mtReader: true }, '');
  }
  setState({ openId: id, cursorId: id });
  if (item && !item.isRead) updateFlags(id, { isRead: true }, { quiet: true });
  const cached = s.details[id];
  // Not known here yet (opened from a notification before the list caught up): marked read once loaded.
  if (!cached || cached.status === 'error') loadDetail(id, { markRead: !item });
  if (getState().conversationView) {
    const t = s.threads[id];
    if (!t || t.status === 'error' || t.status === 'ready') loadThread(id); // refresh: replies may have arrived
  }
}

export function closeReader() {
  if (getState().openId == null) return;
  setState({ openId: null });
  if (window.history.state && window.history.state.mtReader) goBack(1);
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
  adjustCountsFor(before, { unread: readDelta });
  try {
    const { message } = await api.updateMessage(id, changes);
    if (message && pendingFlags.get(id) === pending) applyLocalFlags(id, { isRead: message.isRead, isStarred: message.isStarred });
  } catch (err) {
    if (pendingFlags.get(id) === pending) applyLocalFlags(id, previous);
    adjustCountsFor(before, { unread: -readDelta });
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

/** read / unread / star / unstar for several messages in one request. */
export async function setFlagsBulk(ids, action) {
  const flags = action === 'read' ? { isRead: true } : action === 'unread' ? { isRead: false } : action === 'star' ? { isStarred: true } : { isStarred: false };
  const targets = ids.map((id) => findMessage(id)).filter(Boolean);
  const changed = targets.filter((m) => Object.keys(flags).some((k) => m[k] !== flags[k]));
  if (!changed.length) return;
  mutationSeq += 1;
  for (const m of changed) {
    pendingFlags.set(m.id, { ...(pendingFlags.get(m.id) || {}), ...flags });
    applyLocalFlags(m.id, flags);
    if ('isRead' in flags) adjustCountsFor(m, { unread: flags.isRead ? -1 : 1 });
  }
  const revert = (list) => {
    for (const m of list) {
      applyLocalFlags(m.id, { isRead: m.isRead, isStarred: m.isStarred });
      if ('isRead' in flags) adjustCountsFor(m, { unread: flags.isRead ? 1 : -1 });
    }
  };
  try {
    const results = await Promise.all(chunk(changed.map((m) => m.id), BULK_CHUNK).map((part) => api.bulk(part, action)));
    const failed = results.flatMap((r) => r.failed || []);
    if (failed.length) {
      const bad = new Set(failed.map((f) => f.accountId));
      revert(changed.filter((m) => bad.has(m.accountId)));
      toast(`Couldn't update some messages: ${failed[0].error || 'the mail server refused'}`, { type: 'error' });
    }
  } catch (err) {
    revert(changed);
    toastError(err, "Couldn't update the messages.");
  } finally {
    for (const m of changed) pendingFlags.delete(m.id);
    mutationSeq += 1;
    scheduleCountsRefresh();
  }
}

function restoreMessages(messages, listKeyAtRemoval) {
  if (!messages.length) return;
  // The user moved to another view/filter meanwhile: just reload what's on screen.
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

/** Would `m` still belong in the current view after `action`? (e.g. archiving in Starred.) */
function staysInView(m, action, destinationFolder) {
  const s = getState();
  if (s.view === 'starred') return m.isStarred && !['trash', 'spam', 'delete_forever'].includes(action);
  if (s.view === 'folder' && destinationFolder && destinationFolder.id === s.folderId) return true;
  return false;
}

const VERBS = {
  archive: ['archived', 'archive'],
  trash: ['moved to Trash', 'delete'],
  spam: ['marked as spam', 'mark as spam'],
  notspam: ['moved to Inbox', 'move'],
  inbox: ['moved to Inbox', 'move'],
  move: ['moved', 'move'],
  delete_forever: ['deleted forever', 'delete'],
};

let lastUndo = null; // { run, until } for the z shortcut

/** z: undo the most recent move while its toast would still offer it. */
export function undoLast() {
  if (!lastUndo || lastUndo.until < Date.now()) return false;
  const { run, toastId } = lastUndo;
  lastUndo = null;
  dismissToast(toastId);
  run();
  return true;
}

async function undoMoves(tokens, restored) {
  mutationSeq += 1;
  // Moving back and re-reading the folder can take a few seconds on a slow server.
  const progress = toast(restored.length === 1 ? 'Putting the message back…' : 'Putting the messages back…', { type: 'info', timeout: 0 });
  try {
    const results = await Promise.all(tokens.map((t) => api.undo(t)));
    const count = results.reduce((n, r) => n + (Number(r.count) || 0), 0);
    // Moved back, the messages have new ids on the server (it re-read their folder before
    // answering): show the server's rows. Putting the old local rows back would offer actions
    // on ids that no longer exist, which the server would silently ignore.
    unhideIds(restored.map((m) => m.id));
    for (const m of restored) adjustCountsFor(m, { total: 1, unread: m.isRead ? 0 : 1 });
    toast(count === 1 || restored.length === 1 ? 'Undone' : `Undone — ${plural(count || restored.length, 'message')} put back`, { type: 'success' });
  } catch (err) {
    toastError(err, "Couldn't undo that.");
  } finally {
    dismissToast(progress);
    mutationSeq += 1;
    scheduleCountsRefresh();
    if (getState().view !== 'outbox') await loadList({ keepMessages: true });
  }
}

/**
 * Move messages out of where they are: 'archive' | 'trash' | 'spam' | 'notspam' |
 * 'delete_forever' | 'move' (with folderId, same account) | 'inbox' (each account's Inbox).
 * Rows leave the list at once and come back if the server refuses; moves can be undone.
 */
export async function moveMessages(ids, action, { folderId = null } = {}) {
  const s = getState();
  let targets = ids.map((id) => findMessage(id)).filter(Boolean);
  if (!targets.length) return;

  // Group requests: 'move' goes to one folder (same account only), 'inbox' to each account's Inbox.
  let destination = null;
  let skipped = 0;
  if (action === 'move') {
    destination = folderById(folderId);
    if (!destination) return;
    const sameAccount = targets.filter((m) => m.accountId === destination.accountId && m.folderId !== destination.id);
    skipped = targets.filter((m) => m.accountId !== destination.accountId).length;
    targets = sameAccount;
    if (!targets.length) {
      if (skipped) toast("Messages can only be moved to folders of their own account.", { type: 'error' });
      return;
    }
  }
  const requests = [];
  if (action === 'inbox') {
    const byAccount = new Map();
    for (const m of targets) {
      const inbox = inboxFolderOf(m.accountId);
      if (!inbox || m.folderId === inbox.id) continue;
      if (!byAccount.has(inbox.id)) byAccount.set(inbox.id, []);
      byAccount.get(inbox.id).push(m);
    }
    targets = [...byAccount.values()].flat();
    for (const [fid, list] of byAccount) requests.push({ ids: list.map((m) => m.id), action: 'move', extra: { folderId: fid } });
  } else {
    for (const part of chunk(targets.map((m) => m.id), BULK_CHUNK)) requests.push({ ids: part, action, extra: action === 'move' ? { folderId } : {} });
  }
  if (!targets.length) return;

  const targetIds = new Set(targets.map((m) => m.id));
  const leaving = targets.filter((m) => !staysInView(m, action, destination));
  const leavingIds = new Set(leaving.map((m) => m.id));
  const index = s.list.messages.findIndex((m) => leavingIds.has(m.id));
  const remaining = s.list.messages.filter((m) => !leavingIds.has(m.id));
  const next = index >= 0 ? remaining[Math.min(index, remaining.length - 1)] || null : null;
  const wasOpen = s.openId != null && leavingIds.has(s.openId);

  mutationSeq += 1;
  hideIds([...leavingIds]);
  setState((st) => ({
    list: { ...st.list, messages: st.list.messages.filter((m) => !leavingIds.has(m.id)) },
    cursorId: leavingIds.has(st.cursorId) || st.cursorId == null ? (next ? next.id : null) : st.cursorId,
    selectedIds: st.selectedIds.filter((id) => !targetIds.has(id)),
  }));
  for (const m of targets) adjustCountsFor(m, { total: -1, unread: m.isRead ? 0 : -1 });
  if (wasOpen) {
    // Advance to the next message only when that doesn't change anything on the server:
    // opening an unread one would silently mark it read. Otherwise the cursor waits on it.
    if (next && !isMobile() && next.isRead && !isDraftMessage(next)) openMessage(next.id);
    else closeReader();
  }

  // The open message stayed where it was after all: show it again (desktop) unless the user
  // moved on meanwhile (the next message we opened ourselves doesn't count).
  const reopenIfBack = (backIds) => {
    if (!wasOpen || !backIds.has(s.openId) || isMobile()) return;
    const now = getState();
    if (now.list.key !== s.list.key) return;
    if (now.openId == null || (next && now.openId === next.id)) openMessage(s.openId);
  };

  const [done, verb] = VERBS[action] || ['moved', 'move'];
  try {
    const results = await Promise.all(requests.map((r) => api.bulk(r.ids, r.action, r.extra)));
    const failed = results.flatMap((r) => r.failed || []);
    const tokens = results.map((r) => r.undo).filter(Boolean);
    let restoredOnFail = [];
    if (failed.length) {
      const failedAccounts = new Set(failed.map((f) => f.accountId));
      restoredOnFail = targets.filter((m) => failedAccounts.has(m.accountId));
      unhideIds(restoredOnFail.map((m) => m.id));
      restoreMessages(restoredOnFail.filter((m) => leavingIds.has(m.id)), s.list.key);
      for (const m of restoredOnFail) adjustCountsFor(m, { total: 1, unread: m.isRead ? 0 : 1 });
      toast(`Couldn't ${verb} ${plural(restoredOnFail.length, 'message')}: ${failed[0].error || 'the mail server refused'}`, { type: 'error' });
      reopenIfBack(new Set(restoredOnFail.map((m) => m.id)));
    }
    const moved = targets.filter((m) => !restoredOnFail.includes(m));
    if (moved.length) {
      const n = moved.length;
      const where = action === 'move' && destination ? ` to ${folderLabel(destination)}` : '';
      const message = `${n === 1 ? 'Message' : `${n} messages`} ${done}${where}${skipped ? ` (${plural(skipped, 'message')} from other accounts left as they were)` : ''}`;
      if (tokens.length) {
        const run = () => undoMoves(tokens, moved.filter((m) => leavingIds.has(m.id)));
        const toastId = toast(message, { type: 'success', action: { label: 'Undo', run } });
        lastUndo = { run, toastId, until: Date.now() + UNDO_MS };
      } else {
        toast(message, { type: 'success' });
      }
    }
  } catch (err) {
    unhideIds(targets.map((m) => m.id));
    restoreMessages(targets.filter((m) => leavingIds.has(m.id)), s.list.key);
    for (const m of targets) adjustCountsFor(m, { total: 1, unread: m.isRead ? 0 : 1 });
    toastError(err, `Couldn't ${verb} the message.`);
    reopenIfBack(targetIds);
  } finally {
    mutationSeq += 1;
    scheduleCountsRefresh();
  }
}

/** Permanently delete, after asking. */
export function deleteForever(ids) {
  const n = ids.length;
  if (!n) return;
  openDialog('confirm', {
    title: n === 1 ? 'Delete this message forever?' : `Delete ${n} messages forever?`,
    message: 'They are removed from the mail server and can’t be recovered.',
    confirmLabel: 'Delete forever',
    danger: true,
    onConfirm: async () => {
      closeDialog();
      await moveMessages(ids, 'delete_forever');
    },
  });
}

/** "Delete" (#): to Trash, or forever when the messages are already in Trash. */
export function deleteMessages(ids) {
  const list = ids.map((id) => findMessage(id)).filter(Boolean);
  if (!list.length) return;
  const inTrash = list.every((m) => {
    const f = folderOfMessage(m);
    return f ? f.specialUse === SPECIAL.trash : getState().view === 'trash';
  });
  if (inTrash) deleteForever(list.map((m) => m.id));
  else moveMessages(list.map((m) => m.id), 'trash');
}

/** "!": report as spam, or "not spam" when they are in a Spam folder. */
export function toggleSpam(ids) {
  const list = ids.map((id) => findMessage(id)).filter(Boolean);
  if (!list.length) return;
  const allJunk = list.every((m) => {
    const f = folderOfMessage(m);
    return f ? f.specialUse === SPECIAL.junk : getState().view === 'junk';
  });
  moveMessages(list.map((m) => m.id), allJunk ? 'notspam' : 'spam');
}

/** Open the Move dialog for these messages. */
export function openMoveDialog(ids) {
  const list = ids.map((id) => findMessage(id)).filter(Boolean);
  if (!list.length) return;
  openDialog('move', { ids: list.map((m) => m.id) });
}

/**
 * "Mark all as read" for whatever the list shows — a tab, a folder or a unified view — done by
 * the server over everything there (not only the pages loaded here), narrowed by the search
 * and the Starred filter like the list.
 */
export async function markAllRead() {
  const s = getState();
  if (s.view === 'outbox') return;
  const params = listParams(s);
  const source = s.view === 'folder' ? { folder: params.folder } : s.view === 'inbox' ? { tab: params.tab } : { view: params.view };
  const unreadIds = new Set(s.list.messages.filter((m) => !m.isRead).map((m) => m.id));
  const listKeyAtStart = s.list.key;
  mutationSeq += 1;
  setState((st) => ({ list: { ...st.list, messages: st.list.messages.map((m) => (m.isRead ? m : { ...m, isRead: true })) } }));
  try {
    const { count = 0, failed = [] } = await api.markAllRead(source, { q: params.q, starred: params.starred });
    if (failed.length) {
      // Some accounts refused: reload so the rows that are still unread show as unread.
      const names = failed.map((f) => accountLabel(getState().accounts.find((a) => a.id === f.accountId)) || 'one account');
      toast(`Couldn't mark everything as read in ${names.join(', ')}: ${failed[0].error}`, { type: 'error' });
      loadList({ keepMessages: true });
    } else {
      toast(count ? `Marked ${plural(count, 'message')} as read` : 'Everything here is already read', { type: 'success' });
    }
  } catch (err) {
    if (getState().list.key === listKeyAtStart) {
      setState((st) => ({ list: { ...st.list, messages: st.list.messages.map((m) => (unreadIds.has(m.id) ? { ...m, isRead: false } : m)) } }));
    }
    toastError(err, "Couldn't mark messages as read.");
  } finally {
    mutationSeq += 1;
    refreshTabs({ quiet: true });
    refreshFolders({ quiet: true });
  }
}

// ---------------------------------------------------------------------------
// Multi-select

/** Toggle one row; with `range` (Shift-click) the rows between it and the last toggled one. */
export function toggleSelect(id, { range = false } = {}) {
  const s = getState();
  const { selected, anchor } = nextSelection({ order: s.list.messages.map((m) => m.id), selected: s.selectedIds, anchor: s.selectAnchor }, id, { range });
  setState({ selectedIds: selected, selectAnchor: anchor });
}

export function selectAllLoaded() {
  setState((s) => ({ selectedIds: s.list.messages.map((m) => m.id) }));
}

export function clearSelection() {
  if (getState().selectedIds.length || getState().selectAnchor != null) setState({ selectedIds: [], selectAnchor: null });
}

// ---------------------------------------------------------------------------
// Compose (the composer itself lives in /js/compose/)

/** compose('reply' | 'replyAll' | 'forward', messageId) or compose('new'). */
export function compose(mode = 'new', messageId = null) {
  const options = { mode };
  if (messageId != null) options.messageId = messageId;
  if (getState().drawerOpen) {
    // Let the drawer's history entry go first so the composer's own entry sits on top.
    closeDrawer().then(() => openComposer(options));
    return;
  }
  openComposer(options);
}

// ---------------------------------------------------------------------------
// Outbox

export async function refreshOutbox({ quiet = true } = {}) {
  try {
    const { items = [] } = await api.outbox();
    setState({ outbox: { items, loaded: true, error: null } });
  } catch (err) {
    setState((s) => ({ outbox: { ...s.outbox, loaded: true, error: err.message || "Couldn't load the outbox." } }));
    if (!quiet) toastError(err, "Couldn't load the outbox.");
  }
}

function dropOutboxItem(id) {
  setState((s) => ({ outbox: { ...s.outbox, items: s.outbox.items.filter((o) => o.id !== id) } }));
}

/** Stop a queued message and reopen it in the composer. */
export async function cancelOutboxItem(id) {
  try {
    const { payload, draft } = await api.cancelOutbox(id);
    dropOutboxItem(id);
    forgetOutboxItem(id); // its "Sending… Undo" snackbar is over
    openComposer({ mode: 'outbox', payload, draft: draft || null });
  } catch (err) {
    toastError(err, "Couldn't stop this message.");
    refreshOutbox();
  }
}

export async function retryOutboxItem(id) {
  try {
    await api.retryOutbox(id);
    toast('Trying to send it again…', { type: 'info' });
  } catch (err) {
    toastError(err, "Couldn't retry this message.");
  } finally {
    await refreshOutbox();
    restartBackgroundRefresh(BUSY_REFRESH_MS);
  }
}

export async function deleteOutboxItem(id) {
  try {
    await api.deleteOutbox(id);
    dropOutboxItem(id);
    forgetOutboxItem(id);
    toast('Removed from the outbox', { type: 'success' });
  } catch (err) {
    toastError(err, "Couldn't remove this message.");
    refreshOutbox();
  }
}

// ---------------------------------------------------------------------------
// Settings (server-side, per user)

export async function loadSettings() {
  try {
    const { settings } = await api.settings();
    setState((s) => ({ settings: { ...s.settings, ...(settings || {}) }, settingsLoaded: true }));
  } catch (_) {
    setState({ settingsLoaded: true }); // defaults stay
  }
}

/** Optimistic; reverts and rethrows on failure so the form can say why. */
export async function updateSettings(patch) {
  const before = getState().settings;
  setState({ settings: { ...before, ...patch } });
  try {
    const { settings } = await api.updateSettings(patch);
    if (settings) setState({ settings: { ...before, ...settings } });
  } catch (err) {
    setState({ settings: before });
    throw err;
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
  const target = msgs[idx];
  if (s.openId != null && !isDraftMessage(target)) openMessage(target.id);
  else {
    // Drafts open in the composer, so stepping onto one while reading just moves the cursor.
    if (s.openId != null) closeReader();
    setState({ cursorId: target.id });
  }
  if (idx >= msgs.length - 5) loadMore();
  return target.id;
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

/** What list actions apply to: the selection when there is one (and no message is open). */
export function targetIds() {
  const s = getState();
  if (s.openId == null && s.selectedIds.length) return s.selectedIds.slice();
  const id = targetMessageId();
  return id == null ? [] : [id];
}

// ---------------------------------------------------------------------------
// Dialogs

export function openDialog(type, props = {}) {
  const current = window.history.state || {};
  if (getState().drawerOpen && current.mtDrawer) {
    // Opened from the drawer: the dialog takes over the drawer's history entry.
    const next = { ...current, mtDialog: true };
    delete next.mtDrawer;
    window.history.replaceState(next, '');
  } else if (isMobile() && !getState().dialog && !current.mtDialog) {
    // On phones dialogs are full-screen sheets that look like pages, so give them a history
    // entry: the Back gesture then closes the sheet instead of leaving Mailtabs.
    window.history.pushState({ ...current, mtDialog: true }, '');
  }
  // Success/info toasts refer to what happened before; don't let them sit over the dialog.
  // (Undo stays available with z for its 10 seconds.)
  setState((s) => ({ dialog: { type, props }, drawerOpen: false, toasts: s.toasts.filter((t) => t.type === 'error') }));
}

export function closeDialog() {
  setState({ dialog: null });
  if (window.history.state && window.history.state.mtDialog) goBack(1);
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
