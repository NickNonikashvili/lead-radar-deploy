// Composer controller (SPEC2 §5 COMPOSER): the open composer windows, draft autosave, uploads,
// send / schedule / undo, and the mobile sheet's history entry. Components read this state with
// useComposerStore() and call the functions below; NAV only needs openComposer + <ComposerHost />.
import { useEffect, useReducer, useRef } from '/vendor/preact-htm.js';
import { getState } from '../store.js';
import { toast } from '../actions.js';
import { clearContactCache, composeApi, uploadFile } from './compose-api.js';
import { addRecipients, makeRecipient, parseAddressList, MAX_RECIPIENTS } from './recipients.js';
import {
  LIMITS,
  MODES,
  QUOTE_SEPARATOR,
  byteLength,
  checkAttachmentFiles,
  cleanFilename,
  formatSendTime,
  keepOwnSignatureMarker,
  markSignature,
  mentionsAttachment,
  newMessageHtml,
  splitQuote,
  validateSendAt,
} from './compose-utils.js';
import { parseUntrusted, sanitizeTree, serializeTree } from './sanitize.js';

const MAX_OPEN = 3;
const AUTOSAVE_MS = 4000;
const RATE_LIMIT_RETRY_MS = 1300;
const DOCK = { expanded: 510, minimized: 250, gap: 12, margin: 32 }; // keep in sync with compose.css

// ------------------------------------------------------------------------------- store

let state = { composers: [], snack: null };
let owner = null; // id of the Mailtabs user the open composers belong to
const listeners = new Set();
const runtimes = new Map(); // composer id -> non-serialisable bits (timers, editor handle, uploads)
let seq = 0;
let focusClock = 0; // orders composers by when they were last opened/focused

function emit() {
  for (const fn of [...listeners]) fn();
}

function setComposerState(patch) {
  state = { ...state, ...patch };
  emit();
}

export function getComposerState() {
  return state;
}

export function subscribeComposers(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]));
}

/** Like store.js useStore, for the composer state. */
export function useComposerStore(selector) {
  const [, force] = useReducer((n) => n + 1, 0);
  const selRef = useRef(selector);
  selRef.current = selector;
  const selected = selector(state);
  const lastRef = useRef(selected);
  lastRef.current = selected;
  useEffect(() => {
    const check = () => {
      if (!shallowEqual(selRef.current(state), lastRef.current)) force();
    };
    listeners.add(check);
    check();
    return () => listeners.delete(check);
  }, []);
  return selected;
}

function getComposer(id) {
  return state.composers.find((c) => c.id === id) || null;
}

function updateComposer(id, patch) {
  let found = false;
  const composers = state.composers.map((c) => {
    if (c.id !== id) return c;
    found = true;
    return { ...c, ...(typeof patch === 'function' ? patch(c) : patch) };
  });
  if (found) setComposerState({ composers });
}

function runtime(id) {
  let rt = runtimes.get(id);
  if (!rt) {
    rt = { saveTimer: null, savePromise: null, saveAgain: false, editor: null, uploads: new Map(), commits: new Set(), lastDraft: null, sourceReplaced: false };
    runtimes.set(id, rt);
  }
  return rt;
}

// ------------------------------------------------------------------------------- accounts

export function accountById(accountId) {
  return getState().accounts.find((a) => a.id === accountId) || null;
}

export function canSendFrom(account) {
  return !!account && account.canSend !== false;
}

/** What to do so an account can send (a button label), or null when it can send. */
export function sendBlockReason(account) {
  if (!account || canSendFrom(account)) return null;
  return account.authType === 'oauth' ? 'Reconnect to enable sending' : 'Set up sending';
}

/** Why an account can't send, in the server's words (account JSON `sendBlockedReason`). */
export function sendBlockedText(account) {
  if (!account || canSendFrom(account)) return null;
  const reason = typeof account.sendBlockedReason === 'string' ? account.sendBlockedReason.trim() : '';
  if (reason) return reason;
  return account.authType === 'oauth' ? 'Reconnect this account to allow sending.' : 'Sending is not set up for this account yet.';
}

/** The first clause of sendBlockedText, short enough for an entry of the From list. */
export function sendBlockedHint(account) {
  const text = sendBlockedText(account);
  if (!text) return null;
  const short = text.split(/:\s|\s\(|\.\s/)[0].replace(/\.$/, '').trim();
  return short.length > 70 ? `${short.slice(0, 67).trimEnd()}…` : short;
}

function defaultAccountId(preferred) {
  const accounts = getState().accounts;
  if (preferred != null && accounts.some((a) => a.id === preferred)) return preferred;
  const sender = accounts.find(canSendFrom);
  return (sender || accounts[0] || {}).id ?? null;
}

// ------------------------------------------------------------------------------- open

function isDirty(c) {
  return !!c && c.revision > 0;
}

function hasUnsavedChanges(c) {
  return !!c && (c.revision !== c.savedRevision || c.attachments.some((a) => a.status === 'uploading'));
}

function baseModel(id, mode, opts) {
  return {
    id,
    mode,
    payloadMode: mode,
    sourceMessageId: opts.messageId ?? null,
    status: 'loading', // loading | ready | error
    error: null,
    accountId: defaultAccountId(opts.accountId),
    to: [],
    cc: [],
    bcc: [],
    showCc: false,
    showBcc: false,
    subject: '',
    bodyHtml: '',
    bodyVersion: 0,
    quoteHtml: '',
    quoteCollapsed: false,
    attachments: [],
    inReplyTo: null,
    references: [],
    replyToMessageId: null,
    forwardOfMessageId: null,
    draft: null,
    revision: 0,
    savedRevision: 0,
    saveState: 'idle', // idle | dirty | saving | saved | error
    saveError: null,
    savedAt: null,
    sending: false,
    closing: false,
    notice: null, // { type: 'error'|'info', text }
    confirm: null, // { kind, text, actions: [{ id, label, primary?, danger? }], ...extra }
    minimized: false,
    maximized: false,
    focusTarget: null,
    focusSeq: 0,
    focusedAt: ++focusClock,
  };
}

function toRecipientList(list) {
  let entries = [];
  if (typeof list === 'string') entries = parseAddressList(list);
  else if (Array.isArray(list)) {
    for (const e of list) {
      if (typeof e === 'string') entries.push(...parseAddressList(e));
      else if (e && typeof e.address === 'string') entries.push({ name: e.name || '', address: e.address });
    }
  }
  return addRecipients([], entries.map(makeRecipient));
}

/**
 * Open a composer window. Contract with NAV (SPEC2 §5):
 *   openComposer({ mode: 'new'|'reply'|'replyAll'|'forward'|'draft'|'outbox', messageId?, payload?, draft?, to? })
 * Extras: accountId (preferred From for 'new'), subject, outboxId (mode 'outbox' without a payload:
 * the queued message is cancelled first and then opened).
 * Returns the composer id, or null when it couldn't be opened.
 */
export function openComposer(opts = {}) {
  const user = getState().user;
  ensureComposerOwner(user ? user.id : null);
  const mode = MODES.includes(opts.mode) ? opts.mode : 'new';
  const messageId = opts.messageId ?? null;

  // A draft that is already open just comes to the front.
  if (mode === 'draft' && messageId != null) {
    const open = state.composers.find((c) => c.mode === 'draft' && c.sourceMessageId === messageId);
    if (open) {
      focusComposer(open.id);
      return open.id;
    }
  }
  const needsMessage = mode === 'reply' || mode === 'replyAll' || mode === 'forward' || mode === 'draft';
  if ((needsMessage && messageId == null && !opts.payload) || (mode === 'outbox' && !opts.payload && opts.outboxId == null)) {
    toast("Couldn't open that message.", { type: 'error' });
    return null;
  }

  // Restoring something the user already wrote (undo send, outbox) is never refused.
  const restoring = mode === 'outbox' || !!opts.payload;
  if (!restoring && state.composers.length >= MAX_OPEN) {
    const pristine = state.composers.find((c) => !isDirty(c) && !c.sending && c.status !== 'loading');
    if (pristine) removeComposer(pristine.id, { abortUploads: true });
    else {
      toast(`You can have up to ${MAX_OPEN} messages open at once. Send or close one first.`, { type: 'error' });
      return null;
    }
  }

  seq += 1;
  const id = `composer-${seq}`;
  const model = baseModel(id, mode, opts);
  setComposerState({ composers: [...state.composers.map((c) => ({ ...c, maximized: false })), model] });
  fitComposers(lastLayout.width, lastLayout.mobile, id);

  if (opts.payload) {
    applyPayload(id, opts.payload, opts.draft || null, { stash: opts._stash || null });
  } else if (mode === 'new') {
    const accountId = defaultAccountId(opts.accountId);
    const account = accountById(accountId);
    applyPayload(
      id,
      { accountId, to: opts.to || [], cc: opts.cc || [], bcc: opts.bcc || [], subject: opts.subject || '', html: newMessageHtml(account && account.signatureHtml) },
      null
    );
  } else if (mode === 'outbox' && opts.outboxId != null) {
    composeApi
      .cancelOutbox(opts.outboxId)
      .then(({ payload, draft }) => {
        announceOutbox();
        applyPayload(id, payload || {}, draft || null, { restored: true });
      })
      .catch((err) => updateComposer(id, { status: 'error', error: err.message || "Couldn't open that message." }));
  } else {
    loadPrepared(id, mode, messageId);
  }
  return id;
}

function loadPrepared(id, mode, messageId) {
  updateComposer(id, { status: 'loading', error: null });
  composeApi
    .prepare(mode, messageId)
    .then(({ payload, draft }) => {
      if (!payload) throw new Error("Couldn't prepare that message.");
      applyPayload(id, payload, draft || null);
    })
    .catch((err) => {
      if (err && err.name === 'AbortError') return;
      updateComposer(id, { status: 'error', error: err.message || "Couldn't open that message." });
    });
}

export function retryLoad(id) {
  const c = getComposer(id);
  if (c && c.status === 'error') loadPrepared(id, c.mode, c.sourceMessageId);
}

/** Composers currently open (minimised ones included). */
export function composerCount() {
  return state.composers.length;
}

const uploadInfo = new Map(); // uploadId -> { filename, contentType, size } (to name chips after undo)
let attachmentSeq = 0;

function normaliseAttachments(list, stash) {
  const out = [];
  for (const a of Array.isArray(list) ? list : []) {
    if (!a) continue;
    attachmentSeq += 1;
    const key = `att-${attachmentSeq}`;
    const known =
      (stash && stash.attachments.find((s) => (a.uploadId ? s.uploadId === a.uploadId : s.messageId === a.messageId && s.index === a.index))) || null;
    if (a.uploadId) {
      const info = uploadInfo.get(a.uploadId) || known || {};
      out.push({
        key,
        kind: 'upload',
        uploadId: String(a.uploadId),
        filename: cleanFilename(a.filename || info.filename, 'Attachment'),
        contentType: a.contentType || info.contentType || 'application/octet-stream',
        size: Number.isFinite(a.size) ? a.size : Number.isFinite(info.size) ? info.size : null,
        status: 'done',
        progress: 1,
      });
    } else if (a.messageId != null && Number.isInteger(a.index)) {
      const info = known || {};
      out.push({
        key,
        kind: 'ref',
        messageId: a.messageId,
        index: a.index,
        filename: a.filename || info.filename || null,
        contentType: a.contentType || info.contentType || null,
        size: Number.isFinite(a.size) ? a.size : Number.isFinite(info.size) ? info.size : null,
        status: 'done',
        progress: 1,
      });
    }
  }
  return out;
}

const messageAttachmentCache = new Map(); // messageId -> Promise<attachments[]>

function resolveAttachmentNames(id) {
  const c = getComposer(id);
  if (!c) return;
  const ids = [...new Set(c.attachments.filter((a) => a.kind === 'ref' && !a.filename).map((a) => a.messageId))];
  for (const messageId of ids) {
    if (!messageAttachmentCache.has(messageId)) {
      if (messageAttachmentCache.size > 50) messageAttachmentCache.delete(messageAttachmentCache.keys().next().value);
      messageAttachmentCache.set(
        messageId,
        composeApi
          .message(messageId)
          .then(({ message }) => (message && Array.isArray(message.attachments) ? message.attachments : []))
          .catch(() => {
            messageAttachmentCache.delete(messageId);
            return [];
          })
      );
    }
    messageAttachmentCache.get(messageId).then((list) => {
      updateComposer(id, (cur) => ({
        attachments: cur.attachments.map((a) => {
          if (a.kind !== 'ref' || a.messageId !== messageId || a.filename) return a;
          const hit = list.find((x) => x.index === a.index);
          return hit
            ? { ...a, filename: hit.filename || 'Attachment', contentType: hit.contentType || a.contentType, size: Number.isFinite(hit.size) ? hit.size : a.size }
            : { ...a, filename: 'Attachment' };
        }),
      }));
    });
  }
}

function applyPayload(id, payload, draft, { stash = null, restored = false } = {}) {
  const c = getComposer(id);
  if (!c) return;
  const p = payload || {};
  const accountId = p.accountId != null ? p.accountId : defaultAccountId();
  const account = accountById(accountId);
  const payloadMode =
    p.mode && p.mode !== 'draft' ? p.mode : p.forwardOfMessageId ? 'forward' : p.inReplyTo || p.replyToMessageId ? 'reply' : c.mode === 'draft' || c.mode === 'outbox' ? 'new' : c.mode;

  let bodyHtml;
  let quoteHtml = '';
  let quoteCollapsed = false;
  if (stash && stash.payloadHtml === p.html) {
    // Undo send: put back exactly what the editor held (quote still collapsed, etc.).
    bodyHtml = stash.bodyHtml;
    quoteHtml = stash.quoteHtml;
    quoteCollapsed = stash.quoteCollapsed;
  } else {
    // The server sanitises too; this client pass is the guarantee for what reaches the editor.
    let tree = sanitizeTree(parseUntrusted(p.html || ''), { mode: 'send' });
    tree = markSignature(keepOwnSignatureMarker(tree), account && account.signatureHtml);
    const replyLike = payloadMode === 'reply' || payloadMode === 'replyAll';
    if (replyLike) {
      const split = splitQuote(tree);
      if (split.quote) {
        tree = split.body;
        quoteHtml = serializeTree(split.quote);
        quoteCollapsed = true;
      }
    }
    bodyHtml = serializeTree(tree) || '<div><br></div>';
  }

  const to = toRecipientList(p.to);
  const cc = toRecipientList(p.cc);
  const bcc = toRecipientList(p.bcc);
  const unsaved = (c.mode === 'outbox' || restored || !!stash) && !draft;
  updateComposer(id, (cur) => ({
    status: 'ready',
    error: null,
    accountId,
    payloadMode,
    to,
    cc,
    bcc,
    showCc: cc.length > 0 || (stash ? stash.showCc : false),
    showBcc: bcc.length > 0 || (stash ? stash.showBcc : false),
    subject: String(p.subject || '').slice(0, LIMITS.maxSubject),
    bodyHtml,
    bodyVersion: cur.bodyVersion + 1,
    quoteHtml,
    quoteCollapsed,
    attachments: normaliseAttachments(p.attachments, stash),
    inReplyTo: p.inReplyTo || null,
    references: Array.isArray(p.references) ? p.references.filter((r) => typeof r === 'string') : [],
    replyToMessageId: p.replyToMessageId ?? null,
    forwardOfMessageId: p.forwardOfMessageId ?? null,
    draft: draft || null,
    // A restored message that exists nowhere else counts as unsaved, so it gets saved as a draft.
    revision: unsaved ? 1 : 0,
    savedRevision: 0,
    saveState: draft ? 'saved' : unsaved ? 'dirty' : 'idle',
    focusTarget: to.length || cc.length || bcc.length ? 'body' : 'to',
    focusSeq: cur.focusSeq + 1,
  }));
  runtime(id).lastDraft = draft || null;
  if (unsaved) scheduleSave(id);
  resolveAttachmentNames(id);
}

// ------------------------------------------------------------------------------- editing

/** Field edits from the window: to/cc/bcc/subject/showCc/showBcc/notice/confirm. */
export function editComposer(id, patch, { changed = true } = {}) {
  updateComposer(id, patch);
  if (changed) markChanged(id);
}

export function markChanged(id) {
  const c = getComposer(id);
  if (!c || c.status !== 'ready' || c.sending) return;
  updateComposer(id, (cur) => ({ revision: cur.revision + 1, saveState: cur.saveState === 'saving' ? 'saving' : 'dirty' }));
  scheduleSave(id);
}

/** The editor component registers how to read/modify its content. */
export function registerEditor(id, handle) {
  const rt = runtime(id);
  rt.editor = handle;
  return () => {
    if (rt.editor !== handle) return;
    // Keep what was typed in case the window is re-mounted (e.g. layout switch).
    const c = getComposer(id);
    if (c && handle.getHtml) {
      try {
        const snapshot = handle.getHtml();
        if (snapshot != null) updateComposer(id, { bodyHtml: snapshot });
      } catch (_) {
        /* editor already gone */
      }
    }
    rt.editor = null;
  };
}

/** Recipient fields register a function that turns half-typed text into chips (before send). */
export function registerCommit(id, fn) {
  const rt = runtime(id);
  rt.commits.add(fn);
  return () => rt.commits.delete(fn);
}

export function setFrom(id, accountId) {
  const c = getComposer(id);
  if (!c || c.accountId === accountId) return;
  const account = accountById(accountId);
  const rt = runtime(id);
  if (rt.editor && rt.editor.swapSignature) rt.editor.swapSignature((account && account.signatureHtml) || '');
  editComposer(id, { accountId, notice: null });
}

/**
 * Accounts may load after a composer opened (or the chosen one was removed): pick the default
 * From account then, without counting it as an edit.
 */
export function ensureAccount(id) {
  const c = getComposer(id);
  if (!c || c.status !== 'ready' || (c.accountId != null && accountById(c.accountId))) return;
  const accountId = defaultAccountId();
  if (accountId == null) return;
  const account = accountById(accountId);
  const rt = runtime(id);
  if (rt.editor && rt.editor.swapSignature) rt.editor.swapSignature((account && account.signatureHtml) || '');
  updateComposer(id, { accountId });
}

export function expandQuote(id) {
  const c = getComposer(id);
  if (!c || !c.quoteCollapsed) return;
  const rt = runtime(id);
  if (rt.editor && rt.editor.appendQuote) rt.editor.appendQuote(c.quoteHtml);
  // The quote now lives in the editor (inside a data-mt-quote wrapper).
  updateComposer(id, { quoteCollapsed: false, quoteHtml: '' });
}

export function focusComposer(id) {
  const c = getComposer(id);
  if (!c) return;
  focusClock += 1;
  const composers = state.composers.map((x) =>
    x.id === id ? { ...x, minimized: false, focusSeq: x.focusSeq + 1, focusedAt: focusClock, focusTarget: x.focusTarget || 'body' } : x
  );
  setComposerState({ composers });
  fitComposers(lastLayout.width, lastLayout.mobile, id);
}

export function minimizeComposer(id, minimized = true) {
  const c = getComposer(id);
  if (!c) return;
  if (!minimized) {
    focusComposer(id);
    return;
  }
  updateComposer(id, { minimized: true, maximized: false });
}

export function maximizeComposer(id, maximized = true) {
  if (!getComposer(id)) return;
  setComposerState({
    composers: state.composers.map((c) => (c.id === id ? { ...c, maximized, minimized: false } : { ...c, maximized: false })),
  });
}

// ------------------------------------------------------------------------------- layout

const lastLayout = { width: typeof window !== 'undefined' ? window.innerWidth : 1366, mobile: false };

/**
 * Keep the docked windows within the viewport: older expanded windows are minimised until
 * everything fits (on phones only one composer is expanded at a time). `keepId` stays open.
 */
export function fitComposers(width, mobile, keepId = null) {
  lastLayout.width = width || lastLayout.width;
  lastLayout.mobile = !!mobile;
  const list = state.composers;
  if (!list.length) return;
  const keep = keepId || (list.filter((c) => !c.minimized).sort((a, b) => b.focusedAt - a.focusedAt)[0] || {}).id;
  const expanded = list.filter((c) => !c.minimized);
  const collapse = new Set();
  if (mobile) {
    for (const c of expanded) if (c.id !== keep) collapse.add(c.id);
  } else {
    const usable = lastLayout.width - DOCK.margin;
    const widthOf = (n) => n * DOCK.expanded + (list.length - n) * DOCK.minimized + Math.max(0, list.length - 1) * DOCK.gap;
    let open = expanded.length;
    // Least recently used first, but never the one being opened/focused.
    for (const c of [...expanded].sort((a, b) => a.focusedAt - b.focusedAt)) {
      if (open <= 1 || widthOf(open) <= usable) break;
      if (c.id === keep) continue;
      collapse.add(c.id);
      open -= 1;
    }
  }
  if (collapse.size) {
    setComposerState({ composers: list.map((c) => (collapse.has(c.id) ? { ...c, minimized: true, maximized: false } : c)) });
  }
}

// ------------------------------------------------------------------------------- payload + drafts

function editorHtml(c) {
  const rt = runtimes.get(c.id);
  const live = rt && rt.editor && rt.editor.getHtml ? rt.editor.getHtml() : null;
  return live != null ? live : c.bodyHtml;
}

function buildPayload(c, { forDraft }) {
  let html = editorHtml(c);
  if (c.quoteCollapsed && c.quoteHtml) html += QUOTE_SEPARATOR + c.quoteHtml;
  const pick = (list) => list.filter((r) => !forDraft || r.valid).map((r) => ({ name: r.name, address: r.address }));
  const payload = {
    accountId: c.accountId,
    to: pick(c.to),
    cc: pick(c.cc),
    bcc: pick(c.bcc),
    subject: c.subject.slice(0, LIMITS.maxSubject),
    html,
    attachments: c.attachments
      .filter((a) => a.status === 'done')
      .map((a) => (a.kind === 'upload' ? { uploadId: a.uploadId } : { messageId: a.messageId, index: a.index })),
    mode: c.payloadMode,
  };
  if (c.inReplyTo) payload.inReplyTo = c.inReplyTo;
  if (c.references && c.references.length) payload.references = c.references;
  if (c.replyToMessageId != null) payload.replyToMessageId = c.replyToMessageId;
  if (c.forwardOfMessageId != null) payload.forwardOfMessageId = c.forwardOfMessageId;
  return payload;
}

function scheduleSave(id, delay = AUTOSAVE_MS) {
  const rt = runtime(id);
  clearTimeout(rt.saveTimer);
  rt.saveTimer = setTimeout(() => {
    rt.saveTimer = null;
    saveDraft(id);
  }, delay);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Save the composer as a server draft now (one save at a time per composer). */
export function saveDraft(id) {
  const rt = runtime(id);
  clearTimeout(rt.saveTimer);
  rt.saveTimer = null;
  const c = getComposer(id);
  if (!c || c.status !== 'ready' || c.sending) return Promise.resolve();
  if (rt.savePromise) {
    rt.saveAgain = true;
    return rt.savePromise;
  }
  if (c.revision === c.savedRevision && c.saveState !== 'error') return Promise.resolve();
  if (c.accountId == null || !accountById(c.accountId)) return Promise.resolve();

  const revision = c.revision;
  let payload;
  try {
    payload = buildPayload(c, { forDraft: true });
  } catch (err) {
    updateComposer(id, { saveState: 'error', saveError: "Couldn't read the message." });
    return Promise.resolve();
  }
  updateComposer(id, { saveState: 'saving', saveError: null });
  const previous = c.draft;
  rt.savePromise = (async () => {
    try {
      let result;
      for (let attempt = 0; ; attempt += 1) {
        try {
          result = await composeApi.saveDraft(payload, previous);
          break;
        } catch (err) {
          // The server allows one draft save per second per user; several composers can collide.
          if (err.status === 429 && attempt < 3) await wait(RATE_LIMIT_RETRY_MS * (attempt + 1));
          else throw err;
        }
      }
      const draft = (result && result.draft) || previous;
      rt.lastDraft = draft;
      const now = getComposer(id);
      if (now && now.mode === 'draft' && now.sourceMessageId != null && !rt.sourceReplaced && previous) {
        // The server replaced the draft this composer was opened from: its list row is gone.
        rt.sourceReplaced = true;
        announceDrafts({ removedMessageIds: [now.sourceMessageId] });
      }
      updateComposer(id, (cur) => ({
        draft,
        savedRevision: revision,
        saveState: cur.revision === revision ? 'saved' : 'dirty',
        saveError: null,
        savedAt: Date.now(),
      }));
    } catch (err) {
      updateComposer(id, { saveState: 'error', saveError: err.message || "Couldn't save the draft." });
    } finally {
      rt.savePromise = null;
      const cur = getComposer(id);
      if (rt.saveAgain) {
        rt.saveAgain = false;
        if (cur && cur.revision !== cur.savedRevision && cur.saveState !== 'error') saveDraft(id);
      }
    }
  })();
  return rt.savePromise;
}

/** Wait until everything typed so far is saved (or a save failed). */
async function flushSave(id) {
  for (let i = 0; i < 4; i += 1) {
    const rt = runtimes.get(id);
    const c = getComposer(id);
    if (!rt || !c) return;
    if (rt.savePromise) {
      await rt.savePromise.catch(() => {});
      continue;
    }
    if (c.revision === c.savedRevision) return;
    await saveDraft(id);
    const after = getComposer(id);
    if (!after || after.saveState === 'error') return;
  }
}

// ------------------------------------------------------------------------------- attachments

export function addFiles(id, fileList) {
  const c = getComposer(id);
  if (!c || c.status !== 'ready') return;
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;
  const { accepted, rejected } = checkAttachmentFiles(c.attachments, files);
  if (rejected.length) {
    updateComposer(id, { notice: { type: 'error', text: rejected.map((r) => r.message).join(' ') } });
  }
  for (const file of accepted) startUpload(id, file);
}

function startUpload(id, file, existingKey = null) {
  const rt = runtime(id);
  attachmentSeq += 1;
  const key = existingKey || `att-${attachmentSeq}`;
  const filename = cleanFilename(file.name);
  const item = { key, kind: 'upload', uploadId: null, filename, contentType: file.type || 'application/octet-stream', size: file.size, status: 'uploading', progress: 0, error: null, file };
  updateComposer(id, (cur) => ({
    attachments: existingKey ? cur.attachments.map((a) => (a.key === key ? item : a)) : [...cur.attachments, item],
  }));
  let lastShown = 0;
  const upload = uploadFile(file, {
    filename,
    onProgress: (p) => {
      // Re-render at most every 2%: progress events can fire hundreds of times.
      if (p - lastShown < 0.02 && p < 1) return;
      lastShown = p;
      updateComposer(id, (cur) => ({ attachments: cur.attachments.map((a) => (a.key === key ? { ...a, progress: p } : a)) }));
    },
  });
  rt.uploads.set(key, upload);
  upload.promise
    .then((info) => {
      uploadInfo.set(info.id, { filename: info.filename || filename, contentType: info.contentType || item.contentType, size: info.size ?? file.size });
      updateComposer(id, (cur) => ({
        attachments: cur.attachments.map((a) =>
          a.key === key
            ? { ...a, uploadId: info.id, filename: cleanFilename(info.filename || filename), size: Number.isFinite(info.size) ? info.size : a.size, status: 'done', progress: 1, file: null }
            : a
        ),
      }));
      markChanged(id);
    })
    .catch((err) => {
      if (err && err.name === 'AbortError') return;
      updateComposer(id, (cur) => ({
        attachments: cur.attachments.map((a) => (a.key === key ? { ...a, status: 'error', error: err.message || "Couldn't upload this file." } : a)),
      }));
    })
    .finally(() => {
      if (rt.uploads.get(key) === upload) rt.uploads.delete(key);
    });
}

export function retryAttachment(id, key) {
  const c = getComposer(id);
  const a = c && c.attachments.find((x) => x.key === key);
  if (!a || a.status !== 'error' || !a.file) return;
  startUpload(id, a.file, key);
}

export function removeAttachment(id, key) {
  const c = getComposer(id);
  const a = c && c.attachments.find((x) => x.key === key);
  if (!a) return;
  const rt = runtime(id);
  const upload = rt.uploads.get(key);
  if (upload) upload.abort();
  updateComposer(id, (cur) => ({ attachments: cur.attachments.filter((x) => x.key !== key), notice: null }));
  if (a.kind === 'upload' && a.uploadId) composeApi.deleteUpload(a.uploadId).catch(() => {});
  if (a.status === 'done') markChanged(id);
}

// ------------------------------------------------------------------------------- close / discard

function removeComposer(id, { abortUploads = false } = {}) {
  const rt = runtimes.get(id);
  if (rt) {
    clearTimeout(rt.saveTimer);
    rt.saveTimer = null;
    if (abortUploads) for (const u of rt.uploads.values()) u.abort();
    runtimes.delete(id);
  }
  setComposerState({ composers: state.composers.filter((c) => c.id !== id) });
}

const ACTIONS = {
  keep: { id: 'keep', label: 'Keep editing' },
  discard: { id: 'discard', label: 'Discard', danger: true },
  closeAnyway: { id: 'closeAnyway', label: 'Close anyway', danger: true },
  saveClose: { id: 'saveClose', label: 'Save draft', primary: true },
  send: { id: 'send', label: 'Send anyway', primary: true },
};

/** The ✕ button: closing keeps a draft of anything that was written. */
export async function closeComposer(id) {
  const c = getComposer(id);
  if (!c || c.closing) return;
  if (c.status !== 'ready' || c.sending) {
    if (!c.sending) removeComposer(id, { abortUploads: true });
    return;
  }
  if (c.attachments.some((a) => a.status === 'uploading')) {
    updateComposer(id, {
      confirm: { kind: 'uploading', text: "Attachments are still uploading and won't be kept if you close now.", actions: [ACTIONS.keep, ACTIONS.closeAnyway] },
    });
    return;
  }
  if (!isDirty(c)) {
    removeComposer(id);
    return;
  }
  if (c.revision === c.savedRevision && c.draft) {
    removeComposer(id);
    toast('Saved to Drafts', { type: 'success' });
    announceDrafts({ refresh: true });
    return;
  }
  updateComposer(id, { closing: true, confirm: null });
  await flushSave(id);
  const cur = getComposer(id);
  if (!cur) return;
  if (cur.revision === cur.savedRevision && cur.saveState === 'saved') {
    removeComposer(id);
    toast('Saved to Drafts', { type: 'success' });
    announceDrafts({ refresh: true });
  } else {
    updateComposer(id, {
      closing: false,
      confirm: {
        kind: 'saveFailed',
        text: `Couldn't save the draft${cur.saveError ? `: ${cur.saveError}` : '.'} Close anyway and lose the changes?`,
        actions: [ACTIONS.keep, ACTIONS.closeAnyway],
      },
    });
  }
}

/** Trash button: deletes the server draft too (asks first when there is anything to lose). */
export async function discardComposer(id, { confirmed = false } = {}) {
  const c = getComposer(id);
  if (!c) return;
  if (!confirmed && (isDirty(c) || c.draft)) {
    updateComposer(id, { confirm: { kind: 'discard', text: 'Discard this draft? This deletes it from your Drafts folder too.', actions: [ACTIONS.keep, { ...ACTIONS.discard, label: 'Discard draft' }] } });
    return;
  }
  const rt = runtime(id);
  const uploads = c.attachments.filter((a) => a.kind === 'upload' && a.uploadId).map((a) => a.uploadId);
  const pending = rt.savePromise;
  removeComposer(id, { abortUploads: true });
  if (pending) await pending.catch(() => {}); // a save in flight may have just created a draft
  const draft = rt.lastDraft || c.draft;
  for (const uploadId of uploads) composeApi.deleteUpload(uploadId).catch(() => {});
  if (!draft) {
    if (isDirty(c)) toast('Draft discarded');
    return;
  }
  try {
    await composeApi.deleteDraft(draft);
    toast('Draft discarded');
    announceDrafts({ removedMessageIds: c.mode === 'draft' ? [c.sourceMessageId] : [], refresh: true });
  } catch (err) {
    toast(err.message || "Couldn't delete the draft from the server.", { type: 'error' });
  }
}

/** The buttons of a confirm strip. */
export function resolveConfirm(id, actionId) {
  const c = getComposer(id);
  if (!c || !c.confirm) return;
  const confirm = c.confirm;
  updateComposer(id, { confirm: null });
  switch (actionId) {
    case 'keep':
      break;
    case 'discard':
      discardComposer(id, { confirmed: true });
      break;
    case 'closeAnyway':
      removeComposer(id, { abortUploads: true });
      break;
    case 'saveClose':
      closeComposer(id);
      break;
    case 'send':
      sendComposer(id, { sendAt: confirm.sendAt || null, confirmed: [...(confirm.confirmed || []), confirm.kind] });
      break;
    default:
      break;
  }
}

/** Mobile Back: close an untouched composer, otherwise ask (a second Back saves and closes). */
function handleSheetBack() {
  const c = state.composers.find((x) => !x.minimized);
  if (!c) return;
  if (c.status !== 'ready' || !isDirty(c)) {
    if (!c.sending) removeComposer(c.id, { abortUploads: true });
    return;
  }
  if (c.confirm && c.confirm.kind === 'leave') {
    resolveConfirm(c.id, 'saveClose');
    return;
  }
  updateComposer(c.id, {
    confirm: { kind: 'leave', text: hasUnsavedChanges(c) || !c.draft ? 'Save this message as a draft?' : 'Close this draft?', actions: [ACTIONS.discard, ACTIONS.keep, ACTIONS.saveClose] },
  });
}

// ------------------------------------------------------------------------------- send

function userText(c) {
  const rt = runtimes.get(c.id);
  return rt && rt.editor && rt.editor.getText ? rt.editor.getText() : '';
}

function fail(id, text, focusTarget = null) {
  updateComposer(id, (cur) => ({ notice: { type: 'error', text }, ...(focusTarget ? { focusTarget, focusSeq: cur.focusSeq + 1 } : {}) }));
}

/** Send now (or at `sendAt`). Validates first; asks about a missing subject / attachment. */
export async function sendComposer(id, { sendAt = null, confirmed = [] } = {}) {
  const rt = runtime(id);
  for (const commit of rt.commits) commit(); // half-typed addresses become chips first
  const c = getComposer(id);
  if (!c || c.status !== 'ready' || c.sending) return;
  const account = accountById(c.accountId);
  if (!account) return fail(id, 'Choose an account to send from.');
  if (!canSendFrom(account)) return fail(id, `${account.email} can't send yet: ${sendBlockedText(account)} Choose another account, or save this as a draft.`);
  const all = [...c.to, ...c.cc, ...c.bcc];
  if (!all.length) return fail(id, 'Add at least one recipient.', 'to');
  const invalid = all.find((r) => !r.valid);
  if (invalid) return fail(id, `“${invalid.address || invalid.name}” isn't a valid email address. Fix or remove it.`);
  if (all.length > MAX_RECIPIENTS) return fail(id, `A message can have up to ${MAX_RECIPIENTS} recipients.`);
  if (c.attachments.some((a) => a.status === 'uploading')) return fail(id, 'Wait for the attachments to finish uploading.');
  if (c.attachments.some((a) => a.status === 'error')) return fail(id, "Some attachments didn't upload. Try them again or remove them.");
  if (sendAt != null) {
    const problem = validateSendAt(sendAt);
    if (problem) return fail(id, problem);
  }
  if (!confirmed.includes('subject') && !c.subject.trim()) {
    updateComposer(id, { notice: null, confirm: { kind: 'subject', text: 'Send this message without a subject?', actions: [ACTIONS.keep, ACTIONS.send], sendAt, confirmed } });
    return;
  }
  if (!confirmed.includes('attach') && !c.attachments.length && mentionsAttachment(userText(c))) {
    updateComposer(id, {
      notice: null,
      confirm: { kind: 'attach', text: 'You mentioned an attachment, but nothing is attached. Send anyway?', actions: [ACTIONS.keep, ACTIONS.send], sendAt, confirmed },
    });
    return;
  }

  updateComposer(id, { sending: true, notice: null, confirm: null });
  clearTimeout(rt.saveTimer);
  rt.saveTimer = null;
  // Let a draft save in flight finish, so the server deletes the newest draft after sending.
  if (rt.savePromise) await rt.savePromise.catch(() => {});
  const cur = getComposer(id);
  if (!cur) return;
  let payload;
  try {
    payload = buildPayload(cur, { forDraft: false });
  } catch (_) {
    updateComposer(id, { sending: false });
    return fail(id, "Couldn't read the message. Try again.");
  }
  if (byteLength(payload.html) > LIMITS.maxHtmlBytes) {
    updateComposer(id, { sending: false });
    return fail(id, 'This message is too long to send. Remove some of the quoted text or images.');
  }
  try {
    const { outbox } = await composeApi.send(payload, { sendAt, draft: cur.draft || rt.lastDraft });
    if (!outbox || outbox.id == null) throw new Error("The server didn't accept the message.");
    sentStash.set(outbox.id, {
      payloadHtml: payload.html,
      bodyHtml: editorHtml(cur),
      quoteHtml: cur.quoteHtml,
      quoteCollapsed: cur.quoteCollapsed,
      showCc: cur.showCc,
      showBcc: cur.showBcc,
      attachments: cur.attachments.map(({ uploadId, messageId, index, filename, contentType, size }) => ({ uploadId, messageId, index, filename, contentType, size })),
    });
    removeComposer(id);
    announceOutbox();
    // The server deletes the draft once the message is out; its row goes now.
    if (cur.mode === 'draft' && cur.sourceMessageId != null) announceDrafts({ removedMessageIds: [cur.sourceMessageId] });
    // sendAt is epoch milliseconds; tolerate an ISO string too.
    const parsed = typeof outbox.sendAt === 'string' && !/^\d+$/.test(outbox.sendAt) ? Date.parse(outbox.sendAt) : Number(outbox.sendAt);
    const sendAtMs = Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
    if (sendAt != null) {
      showSnack({ kind: 'scheduled', outboxId: outbox.id, sendAt: sendAtMs, text: `Scheduled for ${formatSendTime(sendAtMs)}`, timeout: 10000 });
    } else {
      showSnack({ kind: 'sending', outboxId: outbox.id, sendAt: sendAtMs, text: 'Sending…' });
      watchOutbox(outbox.id, sendAtMs);
    }
  } catch (err) {
    updateComposer(id, { sending: false });
    fail(id, err.message || "Couldn't send the message.");
  }
}

// ------------------------------------------------------------------------------- snackbar + undo

const sentStash = new Map(); // outbox id -> editor snapshot, to restore exactly on undo

/** Tell the rest of the app (Outbox count/view) that the outbox changed. */
function announceOutbox() {
  try {
    window.dispatchEvent(new CustomEvent('mailtabs:outbox-changed'));
  } catch (_) {
    /* very old browsers: the outbox view refreshes on its own */
  }
}

/**
 * Tell the message list that server drafts changed: `removedMessageIds` are list rows that no
 * longer exist (a reopened draft is replaced by its first save, discarded or sent); `refresh`
 * asks for the Drafts list and counts to be brought up to date.
 */
function announceDrafts({ removedMessageIds = [], refresh = false } = {}) {
  try {
    window.dispatchEvent(new CustomEvent('mailtabs:drafts-changed', { detail: { removedMessageIds: removedMessageIds.filter((x) => x != null), refresh } }));
  } catch (_) {
    /* the list catches up on its next refresh */
  }
}
let snackSeq = 0;
let snackTimer = null;

function showSnack(snack) {
  clearTimeout(snackTimer);
  snackSeq += 1;
  const id = snackSeq;
  setComposerState({ snack: { id, ...snack } });
  if (snack.timeout) snackTimer = setTimeout(() => dismissSnack(id), snack.timeout);
}

export function dismissSnack(id) {
  if (state.snack && (id == null || state.snack.id === id)) setComposerState({ snack: null });
}

const WATCH_MS = 3 * 60 * 1000; // follow a send this long after it was due (covers the server's retry a minute later)

/**
 * Follow a message after Send until it is sent or has failed. When the server could not send it
 * and will try again (connection problems), say so instead of a silent "Sending…".
 */
function watchOutbox(outboxId, sendAt) {
  const until = Math.max(sendAt, Date.now()) + WATCH_MS;
  const watching = () => !!state.snack && state.snack.outboxId === outboxId && (state.snack.kind === 'sending' || state.snack.kind === 'retrying');
  const check = async (failures) => {
    if (!watching()) return;
    try {
      const { items } = await composeApi.outbox();
      if (!watching()) return;
      const item = (items || []).find((i) => i.id === outboxId);
      if (!item || item.status === 'sent') {
        sentStash.delete(outboxId);
        announceOutbox();
        announceDrafts({ refresh: true });
        showSnack({ kind: 'sent', text: 'Message sent', timeout: 5000 });
        return;
      }
      if (item.status === 'failed') {
        announceOutbox();
        showSnack({ kind: 'failed', outboxId, text: `Message not sent: ${item.error || 'the mail server refused it.'}`, timeout: 15000 });
        return;
      }
      if (item.status === 'cancelled') return;
      if (item.status === 'queued' && item.error && item.sendAt <= Date.now() + 120_000) {
        // The first attempt failed; the server tries again shortly (the error says when).
        const text = `Not sent yet: ${item.error}`;
        if (state.snack.kind !== 'retrying' || state.snack.text !== text) {
          announceOutbox();
          showSnack({ kind: 'retrying', outboxId, sendAt: item.sendAt, text });
        }
      }
      if (Date.now() < until) setTimeout(() => check(0), 2000);
      else showSnack({ kind: 'info', text: 'Still sending… check the Outbox for its status.', timeout: 6000 });
    } catch (_) {
      if (failures < 5) setTimeout(() => check(failures + 1), 3000);
    }
  };
  setTimeout(() => check(0), Math.max(0, sendAt - Date.now()) + 1200);
}

/** Undo send / unschedule: cancel the queued message and put it back in a composer. */
export async function undoSend(outboxId) {
  if (state.snack && state.snack.outboxId === outboxId) setComposerState({ snack: { ...state.snack, busy: true } });
  try {
    const { payload, draft } = await composeApi.cancelOutbox(outboxId);
    const stash = sentStash.get(outboxId) || null;
    sentStash.delete(outboxId);
    announceOutbox();
    openComposer({ mode: 'outbox', payload: payload || {}, draft: draft || null, _stash: stash });
    showSnack({ kind: 'info', text: 'Sending undone', timeout: 3000 });
  } catch (err) {
    if (err.status === 409) showSnack({ kind: 'info', text: 'Too late to undo: the message has already been sent.', timeout: 6000 });
    else showSnack({ kind: 'failed', outboxId, text: err.message || "Couldn't undo sending.", timeout: 8000 });
  }
}

export async function retrySend(outboxId) {
  try {
    await composeApi.retryOutbox(outboxId);
    announceOutbox();
    showSnack({ kind: 'sending', outboxId, sendAt: Date.now(), text: 'Sending…' });
    watchOutbox(outboxId, Date.now());
  } catch (err) {
    showSnack({ kind: 'failed', outboxId, text: err.message || "Couldn't retry sending.", timeout: 8000 });
  }
}

// ------------------------------------------------------------------------------- page lifecycle

let sheetEntry = false; // our history entry for the mobile sheet exists
let ignorePops = 0;

/** Called by ComposerHost after each render: keep one history entry while the mobile sheet is up. */
export function syncSheetHistory(mobile) {
  const active = mobile ? state.composers.find((c) => !c.minimized) : null;
  if (active && !sheetEntry) {
    window.history.pushState({ ...(window.history.state || {}), mtComposer: true }, '');
    sheetEntry = true;
  } else if (!active && sheetEntry) {
    sheetEntry = false;
    if (window.history.state && window.history.state.mtComposer) {
      ignorePops += 1;
      window.history.back();
    }
  }
}

/** The sheet's Back button: same as the phone's Back (pops our history entry when it exists). */
export function sheetBack() {
  if (sheetEntry && window.history.state && window.history.state.mtComposer) window.history.back();
  else {
    sheetEntry = false;
    handleSheetBack();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (event) => {
    if (ignorePops > 0) {
      ignorePops -= 1;
      return;
    }
    if (!sheetEntry || (event.state && event.state.mtComposer)) return;
    sheetEntry = false;
    handleSheetBack();
  });

  window.addEventListener('beforeunload', (event) => {
    if (state.composers.some((c) => c.status === 'ready' && (hasUnsavedChanges(c) || c.sending))) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

/** Drop every composer without saving, and everything cached for its user (sign-out / a different user signed in). */
export function resetComposers() {
  for (const rt of runtimes.values()) {
    clearTimeout(rt.saveTimer);
    for (const u of rt.uploads.values()) u.abort();
  }
  runtimes.clear();
  sentStash.clear();
  uploadInfo.clear();
  messageAttachmentCache.clear();
  clearContactCache();
  clearTimeout(snackTimer);
  owner = null;
  setComposerState({ composers: [], snack: null });
}

/** The user the open composers (and the send snackbar) belong to. */
export function composerOwner() {
  return owner;
}

/**
 * Composers belong to the user who opened them. When somebody else is signed in now (for
 * example after the session expired and another person signed in), drop them unseen; the
 * same user signing back in finds them again.
 */
export function ensureComposerOwner(userId) {
  const id = userId ?? null;
  if (owner === id) return;
  if (owner !== null || state.composers.length || state.snack) resetComposers();
  owner = id;
}
