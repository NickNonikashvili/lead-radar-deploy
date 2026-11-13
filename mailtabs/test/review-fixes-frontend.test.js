'use strict';

/**
 * Regression tests for the v2 frontend review findings. The composer controller
 * (public/js/compose/compose.js) runs in Node with stubbed Preact, store, toasts and API; what
 * needs a real browser (focus, the folder dialog) is checked statically here and with
 * Playwright outside the repository.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PUBLIC = path.join(__dirname, '..', 'public');
const read = (rel) => fs.readFileSync(path.join(PUBLIC, rel), 'utf8');

// ------------------------------------------------------------------------------- harness

const STUBS = {
  'vendor/preact-htm.mjs': 'export const useEffect = () => {}; export const useReducer = () => [0, () => {}]; export const useRef = (v) => ({ current: v });',
  'js/store.mjs': 'export const getState = () => globalThis.__mt.state;',
  'js/actions.mjs': 'export const toast = (...args) => globalThis.__mt.toasts.push(args);',
  'js/compose/editor.mjs': 'export const swapSignatureInHtml = (html) => html;',
  'js/compose/compose-api.mjs': [
    'const call = (name) => (...args) => globalThis.__mt.api[name](...args);',
    "export const composeApi = new Proxy({}, { get: (_, name) => call(name) });",
    "export const uploadFile = (...args) => globalThis.__mt.api.uploadFile(...args);",
    'export const clearContactCache = () => {};',
  ].join('\n'),
};

let tmpRoot = null;
let loaded = null;
/** compose.js with its real pure modules (sanitize, recipients, utils, format) and stubs for the rest. */
function loadComposer() {
  if (loaded) return loaded;
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mailtabs-composer-'));
  const write = (rel, text) => {
    const file = path.join(tmpRoot, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const rewrite = (src) =>
    src.replace("from '/vendor/preact-htm.js'", "from '../../vendor/preact-htm.mjs'").replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.js(['"])/g, '$1$2.mjs$3');
  for (const [rel, text] of Object.entries(STUBS)) write(rel, text);
  write('js/format.mjs', rewrite(read('js/format.js')));
  for (const f of ['compose.js', 'sanitize.js', 'recipients.js', 'compose-utils.js']) write(`js/compose/${f.replace(/\.js$/, '.mjs')}`, rewrite(read(`js/compose/${f}`)));
  loaded = import(pathToFileURL(path.join(tmpRoot, 'js', 'compose', 'compose.mjs')).href);
  return loaded;
}

test.after(() => {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

async function fresh() {
  const ctl = await loadComposer();
  ctl.resetComposers();
  globalThis.__mt = {
    state: { user: { id: 1 }, accounts: [{ id: 1, email: 'me@example.com', canSend: true, signatureHtml: '' }] },
    toasts: [],
    api: {
      saveDraft: async () => ({ draft: { folderId: 3, uid: 9 } }),
      send: async () => ({ outbox: { id: 42, sendAt: Date.now() } }),
      outboxItem: async () => ({ outbox: { id: 42, status: 'queued' } }),
      prepare: async () => {
        throw new Error('prepare not stubbed');
      },
      uploadFile: () => {
        globalThis.__mt.uploads += 1;
        return { promise: new Promise(() => {}), abort() {} };
      },
    },
    uploads: 0,
  };
  return ctl;
}

const composer = (ctl, id) => ctl.getComposerState().composers.find((c) => c.id === id) || null;

function newMessage(ctl, extra = {}) {
  return ctl.openComposer({ mode: 'new', accountId: 1, to: [{ name: '', address: 'bob@example.com' }], subject: 'Hello', ...extra });
}

// ------------------------------------------------------------------------------- composer controller

test('undo send / Outbox Edit: the restored text is unsaved even with a draft, and its first save replaces that draft', async (t) => {
  const ctl = await fresh();
  t.after(() => ctl.resetComposers());
  const saves = [];
  globalThis.__mt.api.saveDraft = async (payload, draft) => {
    saves.push({ payload, draft });
    return { draft: { folderId: 1, uid: 6 } };
  };
  const id = ctl.openComposer({
    mode: 'outbox',
    payload: { accountId: 1, to: [{ name: '', address: 'bob@example.com' }], subject: 'S', html: '<div>OLD-PART NEW-PART-TYPED-BEFORE-SEND</div>' },
    draft: { folderId: 1, uid: 5 },
  });
  let c = composer(ctl, id);
  assert.deepEqual([c.status, c.revision, c.saveState], ['ready', 1, 'dirty']);
  await ctl.saveDraft(id);
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].draft, { folderId: 1, uid: 5 }, 'replaces the older server draft');
  assert.match(saves[0].payload.html, /NEW-PART-TYPED-BEFORE-SEND/);
  c = composer(ctl, id);
  assert.deepEqual([c.saveState, c.draft], ['saved', { folderId: 1, uid: 6 }]);
});

test('a draft that is already open in a composer is brought to the front instead of opened twice', async (t) => {
  const ctl = await fresh();
  t.after(() => ctl.resetComposers());
  const a = newMessage(ctl, { subject: 'Dup draft test' });
  ctl.editComposer(a, { subject: 'Dup draft test!' });
  await ctl.saveDraft(a);
  assert.deepEqual(composer(ctl, a).draft, { folderId: 3, uid: 9 });
  // The Drafts list row of that draft (a different row id than anything the window knows).
  globalThis.__mt.api.prepare = async (mode, messageId) => {
    assert.deepEqual([mode, messageId], ['draft', 77]);
    return { payload: { accountId: 1, to: [], subject: 'Dup draft test!', html: '<p>x</p>' }, draft: { folderId: 3, uid: 9 } };
  };
  ctl.minimizeComposer(a, true);
  ctl.openComposer({ mode: 'draft', messageId: 77 });
  await flush();
  const open = ctl.getComposerState().composers;
  assert.deepEqual(open.map((c) => c.id), [a], 'one window');
  assert.equal(open[0].minimized, false, 'and it came to the front');

  // Another draft still opens normally.
  globalThis.__mt.api.prepare = async () => ({ payload: { accountId: 1, to: [], subject: 'Other', html: '' }, draft: { folderId: 3, uid: 10 } });
  ctl.openComposer({ mode: 'draft', messageId: 78 });
  await flush();
  assert.equal(ctl.getComposerState().composers.length, 2);
});

test('files dropped or pasted while the message is being sent (or closed) are not taken', async (t) => {
  const ctl = await fresh();
  t.after(() => ctl.resetComposers());
  let finishSave;
  globalThis.__mt.api.saveDraft = () =>
    new Promise((resolve) => {
      finishSave = () => resolve({ draft: { folderId: 3, uid: 9 } });
    });
  const sent = [];
  globalThis.__mt.api.send = async (payload) => {
    sent.push(payload);
    return { outbox: { id: 42, sendAt: Date.now() + 60000 } };
  };
  const id = newMessage(ctl);
  ctl.editComposer(id, { subject: 'With text' });
  const saving = ctl.saveDraft(id); // an autosave in flight
  const sending = ctl.sendComposer(id); // waits for it ("Sending…")
  await flush();
  assert.equal(composer(ctl, id).sending, true);
  ctl.addFiles(id, [{ name: 'late.txt', size: 9, type: 'text/plain' }]);
  assert.equal(composer(ctl, id).attachments.length, 0, 'no chip for a file that would not be sent');
  assert.equal(globalThis.__mt.uploads, 0, 'and no orphaned upload');
  finishSave();
  await saving;
  await sending;
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].attachments, []);
  assert.equal(composer(ctl, id), null, 'sent and closed');
});

test('send snackbar: a message stopped or deleted from the Outbox is never reported as sent', async (t) => {
  const ctl = await fresh();
  t.after(() => ctl.resetComposers());
  globalThis.__mt.api.send = async () => ({ outbox: { id: 42, sendAt: Date.now() } });
  globalThis.__mt.api.outboxItem = async () => ({ outbox: { id: 42, status: 'cancelled' } });
  await ctl.sendComposer(newMessage(ctl));
  assert.equal(ctl.getComposerState().snack.kind, 'sending');
  await new Promise((resolve) => setTimeout(resolve, 1400)); // the watcher's first look
  await flush();
  assert.equal(ctl.getComposerState().snack, null, 'no "Message sent" for a cancelled message');

  // The Outbox view tells the composer when it stops or deletes the message.
  await ctl.sendComposer(newMessage(ctl));
  assert.equal(ctl.getComposerState().snack.outboxId, 42);
  ctl.forgetOutboxItem(42);
  assert.equal(ctl.getComposerState().snack, null);

  // Really sent: said so.
  globalThis.__mt.api.outboxItem = async () => ({ outbox: { id: 42, status: 'sent' } });
  await ctl.sendComposer(newMessage(ctl));
  await new Promise((resolve) => setTimeout(resolve, 1400));
  await flush();
  assert.equal(ctl.getComposerState().snack.text, 'Message sent');

  // Partly sent: said so, not "not sent".
  globalThis.__mt.api.outboxItem = async () => ({ outbox: { id: 42, status: 'failed', partial: true, error: 'Sent to a@x.org, but not delivered to b@x.org.' } });
  await ctl.sendComposer(newMessage(ctl));
  await new Promise((resolve) => setTimeout(resolve, 1400));
  await flush();
  assert.match(ctl.getComposerState().snack.text, /^Partly sent: Sent to a@x\.org/);
});

test('dismissing a confirm strip puts the focus back into the composer (subject when it was missing)', async (t) => {
  const ctl = await fresh();
  t.after(() => ctl.resetComposers());
  const id = newMessage(ctl, { subject: '' });
  await ctl.sendComposer(id);
  let c = composer(ctl, id);
  assert.equal(c.confirm.kind, 'subject');
  const seq = c.focusSeq;
  ctl.resolveConfirm(id, 'keep');
  c = composer(ctl, id);
  assert.equal(c.confirm, null);
  assert.deepEqual([c.focusTarget, c.focusSeq], ['subject', seq + 1]);
  ctl.editComposer(id, { subject: 'Now with a subject' });
  ctl.discardComposer(id); // asks first: there is something to lose
  assert.equal(composer(ctl, id).confirm.kind, 'discard');
  ctl.resolveConfirm(id, 'keep');
  assert.deepEqual([composer(ctl, id).focusTarget, composer(ctl, id).focusSeq], ['editor', seq + 2]);
});

// ------------------------------------------------------------------------------- static (browser-only paths)

test('composer window: every way a strip, panel or notice closes refocuses the composer', () => {
  const win = read('js/compose/ComposerWindow.js');
  assert.match(win, /model\.focusTarget === 'subject'[\s\S]{0,120}\.cmp-subject/, 'focus target "subject" focuses the subject field');
  assert.match(win, /controller\.focus\(model\.focusTarget === 'editor' \? 'keep' : 'start'\)/, '"editor" keeps the caret');
  assert.match(win, /editComposer\(model\.id, \{ notice: null \}, \{ changed: false \}\);\s*refocusComposer\(model\.id, 'editor'\)/, 'notice ✕');
  assert.match(win, /<\$\{CustomSchedule\} onSchedule=\$\{schedule\} onCancel=\$\{closeCustom\} \/>/, 'custom schedule Cancel');
  assert.match(win, /else if \(customOpen\) closeCustom\(\);/, 'custom schedule Escape');
  assert.match(win, /const closeCustom = \(\) => \{[\s\S]*?menuBtnRef\.current[\s\S]*?refocusComposer\(id, 'editor'\)/);
  assert.match(read('js/compose/editor.js'), /if \(where === 'keep'\) \{[\s\S]*?this\.savedRange/);
});

test('opening a message that is not in the loaded list marks it read once its detail is loaded', () => {
  const actions = read('js/actions.js');
  assert.match(actions, /loadDetail\(id, \{ markRead: !item \}\)/);
  assert.match(actions, /async function loadDetail\(id, \{ markRead = false \} = \{\}\)[\s\S]*?if \(markRead && !merged\.isRead && getState\(\)\.openId === id\) updateFlags\(id, \{ isRead: true \}, \{ quiet: true \}\)/);
});

test('deleting a folder closes its dialog before the folder leaves the store, and focus lands on the sidebar', () => {
  const actions = read('js/actions.js');
  const del = actions.slice(actions.indexOf('export async function deleteFolder('));
  const body = del.slice(0, del.indexOf('\n}\n'));
  assert.ok(body.indexOf('if (onDeleted) onDeleted();') > body.indexOf('await api.deleteFolder('), 'after the server deleted it');
  assert.ok(body.indexOf('if (onDeleted) onDeleted();') < body.indexOf('setState((st) => ({ folders:'), 'before the store forgets it');
  assert.match(body, /focusStableElement\(\);/);
  assert.match(actions, /function focusStableElement\(\)[\s\S]*?nav\.sidebar \[aria-current=page\][\s\S]*?\.compose-btn/);
  const dialog = read('js/components/FolderDialog.js');
  assert.match(dialog, /await deleteFolder\(folder\.id, \{ force: count !== 0 \|\| serverSaid, onDeleted: closeDialog \}\);/);
  assert.doesNotMatch(dialog, /await deleteFolder\([^)]*\);\s*closeDialog\(\);/, 'no second closeDialog (it would go back in history twice)');
});

test('the Outbox view tells the composer about messages it stops or deletes; partly sent ones cannot be edited', () => {
  const actions = read('js/actions.js');
  assert.match(actions, /export async function cancelOutboxItem\(id\)[\s\S]*?forgetOutboxItem\(id\)/);
  assert.match(actions, /export async function deleteOutboxItem\(id\)[\s\S]*?forgetOutboxItem\(id\)/);
  const view = read('js/components/OutboxView.js');
  assert.match(view, /item\.status === 'queued' && !item\.partial/);
  assert.match(view, /item\.partial \? 'Partly sent' : 'Not sent'/);
});
