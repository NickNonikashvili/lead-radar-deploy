'use strict';
// Static + unit checks for the browser code in public/ (no browser needed).
// The click-through UI tests run with Playwright against a mock API outside this repo.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PUBLIC = path.join(__dirname, '..', 'public');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(PUBLIC);
const jsFiles = files.filter((f) => f.endsWith('.js'));
const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(PUBLIC, f);

/** Import a dependency-free ES module from public/ (the package itself is CommonJS). */
async function importModule(relPath) {
  const src = read(path.join(PUBLIC, relPath));
  return import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
}

test('index.html loads only same-origin resources and has no inline script or handlers', () => {
  const htmlSrc = read(path.join(PUBLIC, 'index.html'));
  const scripts = [...htmlSrc.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1, 'has a script tag');
  for (const [, attrs, body] of scripts) {
    assert.match(attrs, /\bsrc="\/[^"/]/, 'script has a same-origin src');
    assert.equal(body.trim(), '', 'script tag has no inline code');
  }
  assert.doesNotMatch(htmlSrc, /\son[a-z]+\s*=/i, 'no inline event-handler attributes');
  assert.doesNotMatch(htmlSrc, /(src|href)="(https?:)?\/\//i, 'no external resources');
  assert.match(htmlSrc, /<script type="module" src="\/app\.js"><\/script>/);
  assert.match(htmlSrc, /<link rel="stylesheet" href="\/styles\.css"/);
});

test('styles.css pulls in nothing external', () => {
  const css = read(path.join(PUBLIC, 'styles.css'));
  assert.doesNotMatch(css, /@import/i);
  assert.doesNotMatch(css, /url\(\s*['"]?(https?:)?\/\//i);
});

test('browser JS never writes raw HTML or evaluates strings', () => {
  for (const f of jsFiles) {
    const src = read(f);
    for (const banned of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'dangerouslySetInnerHTML', 'document.write', 'eval(', 'new Function']) {
      assert.ok(!src.includes(banned), `${rel(f)} must not use ${banned}`);
    }
    // Only same-origin module imports (relative or the vendored Preact bundle).
    for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
      assert.ok(m[1].startsWith('.') || m[1] === '/vendor/preact-htm.js', `${rel(f)} imports ${m[1]}`);
    }
  }
});

test('the message iframe sandbox never allows scripts', () => {
  const frame = read(path.join(PUBLIC, 'js/components/BodyFrame.js'));
  const m = frame.match(/export const FRAME_SANDBOX = '([^']*)'/);
  assert.ok(m, 'BodyFrame.js defines FRAME_SANDBOX');
  assert.equal(m[1], 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  assert.match(frame, /sandbox=\$\{FRAME_SANDBOX\}/);
  // The reader and conversation items render bodies only through BodyFrame.
  for (const f of ['js/components/Reader.js', 'js/components/Conversation.js']) {
    const src = read(path.join(PUBLIC, f));
    assert.doesNotMatch(src, /<iframe/, `${f} must use BodyFrame for message bodies`);
    assert.match(src, /import \{[^}]*\bBodyFrame\b[^}]*\} from '\.\/BodyFrame\.js'/);
  }
  for (const f of jsFiles) {
    const src = read(f);
    for (const s of src.matchAll(/sandbox=["'`]([^"'`]*)["'`]/g)) {
      assert.ok(!s[1].includes('allow-scripts'), `${rel(f)} sandbox must not include allow-scripts`);
    }
    // Sandbox values kept in constants or set with setAttribute.
    for (const s of src.matchAll(/_SANDBOX\s*=\s*['"`]([^'"`]*)['"`]/g)) {
      assert.ok(!s[1].includes('allow-scripts'), `${rel(f)} sandbox constant must not include allow-scripts`);
    }
    for (const s of src.matchAll(/setAttribute\(\s*['"]sandbox['"]\s*,\s*['"`]([^'"`]*)['"`]/g)) {
      assert.ok(!s[1].includes('allow-scripts'), `${rel(f)} must not set allow-scripts`);
    }
  }
  // The print frame may open the print dialog (allow-modals) but never run script.
  const print = frame.match(/const PRINT_SANDBOX = '([^']*)'/);
  assert.ok(print, 'BodyFrame.js defines PRINT_SANDBOX');
  assert.equal(print[1], 'allow-same-origin allow-modals');
});

test('every module parses as an ES module and every relative import resolves to a real export', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mailtabs-fe-'));
  try {
    for (const f of jsFiles) {
      // Syntax check: copy as .mjs so Node parses it as ESM.
      const copy = path.join(tmp, rel(f).replace(/[\\/]/g, '__') + '.mjs');
      fs.writeFileSync(copy, read(f));
      execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' });

      const src = read(f);
      for (const m of src.matchAll(/^\s*import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/gm)) {
        const target = path.resolve(path.dirname(f), m[2]);
        assert.ok(fs.existsSync(target), `${rel(f)} imports missing file ${m[2]}`);
        const targetSrc = read(target);
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0];
          if (!name) continue;
          const exported =
            new RegExp(`export\\s+(async\\s+)?(function|class|const|let)\\s+${name}\\b`).test(targetSrc) ||
            new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(targetSrc);
          assert.ok(exported, `${rel(f)} imports {${name}} which ${m[2]} does not export`);
        }
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('format: list dates follow the time / weekday / month-day / short-date rules', async () => {
  const { formatListDate } = await importModule('js/format.js');
  const now = new Date(2026, 10, 12, 15, 0).getTime(); // Thu 12 Nov 2026, 3 PM local
  const today = formatListDate(new Date(2026, 10, 12, 9, 41).getTime(), now, 'en-US');
  assert.match(today, /^9:41\sAM$/);
  assert.equal(formatListDate(new Date(2026, 10, 9, 8, 0).getTime(), now, 'en-US'), 'Mon');
  assert.equal(formatListDate(new Date(2026, 2, 4, 8, 0).getTime(), now, 'en-US'), 'Mar 4');
  assert.equal(formatListDate(new Date(2024, 2, 4, 8, 0).getTime(), now, 'en-US'), '3/4/24');
  assert.equal(formatListDate(NaN, now), '');
});

test('format: helpers', async () => {
  const f = await importModule('js/format.js');
  const now = Date.now();
  assert.equal(f.timeAgo(now - 10_000, now), 'just now');
  assert.equal(f.timeAgo(now - 2 * 60_000, now), '2 min ago');
  assert.equal(f.timeAgo(now - 3 * 3600_000, now), '3 h ago');
  assert.equal(f.timeAgo(now - 30 * 3600_000, now), 'yesterday');
  assert.equal(f.initials('Ada Lovelace', 'x@y'), 'AL');
  assert.equal(f.initials('', 'zed@example.com'), 'Z');
  assert.equal(f.initials('"Priya" (Work)', ''), 'PW');
  assert.equal(f.formatBytes(512), '512 B');
  assert.equal(f.formatBytes(482113), '471 KB');
  assert.equal(f.formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(f.formatAddress({ name: 'Ada', address: 'ada@x.org' }), 'Ada <ada@x.org>');
  assert.equal(f.formatAddress({ name: '', address: 'ada@x.org' }), 'ada@x.org');
  assert.equal(f.emailDomain('Me@Example.ORG'), 'example.org');
  const presets = [{ key: 'gmail', domains: ['gmail.com'] }, { key: 'imap', domains: [] }];
  assert.equal(f.guessPresetKey('a@gmail.com', presets), 'gmail');
  assert.equal(f.guessPresetKey('a@unknown.dev', presets), null);
});

test('api: mutating requests send X-Mailtabs + JSON; a 401 session loss calls the handler once', async () => {
  const mod = await importModule('js/api.js');
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === '/api/auth/me') return new Response(JSON.stringify({ error: 'Not signed in', code: 'UNAUTHENTICATED' }), { status: 401, headers: { 'content-type': 'application/json' } });
    if (url === '/api/auth/login') return new Response(JSON.stringify({ error: 'Wrong', code: 'INVALID_CREDENTIALS' }), { status: 401, headers: { 'content-type': 'application/json' } });
    if (url === '/api/tabs') return new Response(JSON.stringify({ error: 'Not signed in', code: 'UNAUTHENTICATED' }), { status: 401, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    let lost = 0;
    mod.setUnauthorizedHandler(() => {
      lost += 1;
    });

    await mod.api.bulk([1, 2], 'archive');
    await mod.api.deleteTab(3);
    await mod.api.reorderTabs([2, 1]);
    await mod.api.updateMessage(5, { isRead: true });
    await mod.api.syncAll();
    for (const c of calls) {
      assert.notEqual(c.init.method, 'GET');
      assert.equal(c.init.headers['X-Mailtabs'], '1', `${c.init.method} ${c.url} sends X-Mailtabs`);
      assert.equal(c.init.headers['Content-Type'], 'application/json');
      assert.equal(c.init.credentials, 'same-origin');
      assert.doesNotThrow(() => JSON.parse(c.init.body));
    }
    assert.deepEqual(JSON.parse(calls[0].init.body), { ids: [1, 2], action: 'archive' });

    calls.length = 0;
    await mod.api.messages({ tab: 'all', q: 'hello world', unread: true, starred: undefined, limit: 50 });
    assert.equal(calls[0].url, '/api/messages?tab=all&q=hello+world&unread=1&limit=50');
    assert.equal(calls[0].init.headers['X-Mailtabs'], undefined, 'GET does not need the CSRF header');

    // Expected 401s on the sign-in form / boot check don't count as "session lost".
    await assert.rejects(mod.api.me(), (e) => e.status === 401);
    await assert.rejects(mod.api.login({ email: 'a', password: 'b' }), (e) => e.code === 'INVALID_CREDENTIALS');
    assert.equal(lost, 0);
    await assert.rejects(mod.api.tabs(), (e) => e.status === 401 && e.code === 'UNAUTHENTICATED');
    assert.equal(lost, 1, 'a 401 from any other call returns the app to sign-in');

    assert.equal(mod.bodyUrl(7, false), '/api/messages/7/body');
    assert.equal(mod.bodyUrl(7, true), '/api/messages/7/body?images=1');
    assert.equal(mod.attachmentUrl(7, 2), '/api/messages/7/attachments/2');
    assert.equal(mod.oauthStartUrl('google', { tabIds: [1, 2] }), '/api/oauth/google/start?tabIds=1%2C2');
    assert.equal(mod.oauthStartUrl('microsoft', { accountId: 4 }), '/api/oauth/microsoft/start?accountId=4');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('api: network failures become a friendly ApiError', async () => {
  const mod = await importModule('js/api.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  try {
    await assert.rejects(mod.api.accounts(), (e) => e.name === 'ApiError' && e.code === 'NETWORK' && /reach Mailtabs/.test(e.message));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Add account: Microsoft accounts have no password escape hatch; the owner is told what to set', () => {
  const src = read(path.join(PUBLIC, 'js/components/AddAccountDialog.js'));
  assert.doesNotMatch(src, /allows IMAP passwords/);
  assert.doesNotMatch(src, /preset\.key === 'outlook' && usePassword/);
  assert.match(src, /<code>MICROSOFT_CLIENT_ID<\/code> and <code>MICROSOFT_CLIENT_SECRET<\/code>/);
  assert.match(src, /README/);
  assert.match(src, /Microsoft 365/);
});

// ---------------------------------------------------------------------------------------------
// v2 navigation

test('v2: the composer is wired in through its three contract modules only', () => {
  const htmlSrc = read(path.join(PUBLIC, 'index.html'));
  assert.match(htmlSrc, /<link rel="stylesheet" href="\/js\/compose\/compose\.css"/);
  const layout = read(path.join(PUBLIC, 'js/components/MainLayout.js'));
  assert.match(layout, /import \{ ComposerHost \} from '\.\.\/compose\/ComposerHost\.js'/);
  assert.equal((layout.match(/<\$\{ComposerHost\}/g) || []).length, 1, 'ComposerHost is mounted exactly once');
  const settings = read(path.join(PUBLIC, 'js/components/SettingsDialog.js'));
  assert.match(settings, /import \{ SignatureSettings \} from '\.\.\/compose\/SignatureSettings\.js'/);
  assert.match(settings, /<\$\{SignatureSettings\}/);
  assert.match(read(path.join(PUBLIC, 'js/actions.js')), /import \{ ensureComposerOwner, openComposer, resetComposers \} from '\.\/compose\/compose\.js'/);
  // Outside compose/, nothing reaches into the composer's internals.
  const contract = new Set(['compose.js', 'ComposerHost.js', 'SignatureSettings.js']);
  for (const f of jsFiles.filter((x) => !rel(x).startsWith(`js${path.sep}compose${path.sep}`))) {
    for (const m of read(f).matchAll(/from\s*['"]([^'"]*compose\/[^'"]+)['"]/g)) {
      assert.ok(contract.has(path.basename(m[1])), `${rel(f)} imports composer internals (${m[1]})`);
    }
  }
});

test('v2: keyboard shortcuts cover reply, reply all, forward, compose, move, spam and select', () => {
  const src = read(path.join(PUBLIC, 'js/keyboard.js'));
  for (const key of ['r', 'a', 'f', 'c', 'v', '!', 'x', 'e', '#', 's', 'u', 'j', 'k', 'z']) {
    assert.match(src, new RegExp(`case '${key.replace(/[#!]/g, (c) => `\\${c}`)}'`), `keyboard.js handles ${key}`);
  }
  // Non-modal windows (the docked composer) keep their keys.
  assert.match(src, /\[role=dialog\]/);
  const constants = read(path.join(PUBLIC, 'js/constants.js'));
  for (const label of ['Reply', 'Reply all', 'Forward', 'Compose', 'Move to…', 'Select / deselect']) {
    assert.ok(constants.includes(`label: '${label}'`), `SHORTCUTS lists ${label}`);
  }
});

test('v2: Add account no longer shadows the emailDomain() helper', () => {
  const src = read(path.join(PUBLIC, 'js/components/AddAccountDialog.js'));
  assert.doesNotMatch(src, /const emailDomain\s*=/);
  assert.match(src, /hostByDomain\[emailDomain\(value\)\]/);
});

test('v2 navModel: folder trees lift special folders, nest the rest and drop empty containers', async () => {
  const nav = await importModule('js/components/navModel.js');
  const f = (id, path, specialUse = null, extra = {}) => {
    const parts = path.split('/');
    return { id, accountId: 1, path, name: path === 'INBOX' ? 'INBOX' : parts[parts.length - 1], parentPath: parts.length > 1 ? parts.slice(0, -1).join('/') : null, delimiter: '/', specialUse, selectable: true, ...extra };
  };
  const folders = [
    f(1, 'INBOX', '\\Inbox'),
    f(2, '[Gmail]', null, { selectable: false }),
    f(3, '[Gmail]/Sent Mail', '\\Sent'),
    f(4, '[Gmail]/Trash', '\\Trash'),
    f(5, '[Gmail]/Drafts', '\\Drafts'),
    f(6, 'Travel'),
    f(7, 'Travel/Lisbon 2027'),
    f(8, 'Receipts'),
    f(9, 'Empty container', null, { selectable: false }),
    f(10, '[Gmail]/Starred', '\\Flagged'),
  ];
  const tree = nav.buildFolderTree(folders);
  assert.deepEqual(tree.map((n) => n.folder.id), [1, 5, 3, 4, 10, 8, 6], 'specials first in fixed order, then custom A–Z; empty containers dropped');
  assert.deepEqual(tree.find((n) => n.folder.id === 6).children.map((n) => n.folder.id), [7]);
  const rows = nav.flattenTree(tree, (id) => id === 6);
  assert.ok(!rows.some((r) => r.folder.id === 7), 'collapsed folders hide their children');
  assert.deepEqual(rows.find((r) => r.folder.id === 6), { folder: folders[5], depth: 0, hasChildren: true, expanded: false });
  assert.equal(nav.flattenTree(tree).find((r) => r.folder.id === 7).depth, 1);

  assert.equal(nav.folderLabel(folders[0]), 'Inbox');
  assert.equal(nav.folderPathLabel(folders[6]), 'Travel › Lisbon 2027');
  assert.equal(nav.folderIcon(folders[2]), 'send');
  assert.ok(nav.isProtectedFolder(folders[0]) && nav.isProtectedFolder(folders[2]) && !nav.isProtectedFolder(folders[5]));
  assert.ok(nav.canEmptyFolder(folders[3]) && !nav.canEmptyFolder(folders[5]));
  assert.equal(nav.folderBadge({ ...folders[4], totalCount: 3, unreadCount: 0 }), 3, 'drafts show their total');
  assert.equal(nav.folderBadge({ ...folders[2], totalCount: 9, unreadCount: 2 }), 0, 'Sent shows no count');
  assert.equal(nav.folderBadge({ ...folders[7], totalCount: 9, unreadCount: 2 }), 2);

  const targets = nav.moveTargets(folders, 1, { excludeFolderId: 1 });
  assert.ok(!targets.some((t) => t.id === 1), 'the current folder is not a move target');
  assert.ok(!targets.some((t) => t.id === 2 || t.id === 9), 'containers are not move targets');
  assert.ok(!targets.some((t) => t.id === 10), 'virtual Starred is not a move target');
  assert.ok(!targets.some((t) => t.id === 5), 'Drafts is not a move target');
  assert.deepEqual(targets.slice(0, 2).map((t) => t.id), [3, 4], 'special folders first');
  assert.equal(nav.moveTargets(folders, 2).length, 0, 'other accounts have their own folders');
  assert.ok(nav.folderMatches(folders[6], 'lisb') && nav.folderMatches(folders[6], 'travel/') && !nav.folderMatches(folders[6], 'zzz'));
  assert.deepEqual(nav.parentOptions(folders, 1).map((x) => x.id), [9, 8, 6, 7], 'no Inbox, special or [Gmail] parents');
});

test('v2 navModel: folder names and selection ranges', async () => {
  const nav = await importModule('js/components/navModel.js');
  assert.match(nav.validateFolderName('  '), /Enter a folder name/);
  assert.match(nav.validateFolderName('a/b', { delimiter: '/' }), /can't contain “\/”/);
  assert.match(nav.validateFolderName('inbox'), /reserved/);
  assert.match(nav.validateFolderName('Work', { siblings: ['work'] }), /already exists/);
  assert.equal(nav.validateFolderName('Work', { siblings: ['Work'], current: 'Work' }), '', 'renaming to its own name is fine');
  assert.match(nav.validateFolderName('x'.repeat(101)), /at most 100/);
  assert.match(nav.validateFolderName('a\u0007b'), /control characters/);
  assert.equal(nav.validateFolderName('Clients 2027'), '');

  const order = [10, 11, 12, 13, 14];
  let sel = nav.nextSelection({ order, selected: [], anchor: null }, 11);
  assert.deepEqual(sel, { selected: [11], anchor: 11 });
  sel = nav.nextSelection({ order, ...sel }, 14, { range: true });
  assert.deepEqual(sel.selected, [11, 12, 13, 14], 'Shift-click selects the range from the anchor');
  sel = nav.nextSelection({ order, selected: sel.selected, anchor: 12 }, 12);
  assert.deepEqual(sel.selected, [11, 13, 14], 'plain click toggles one row and moves the anchor');
  sel = nav.nextSelection({ order, ...sel }, 14, { range: true });
  assert.deepEqual(sel.selected, [11], 'a range from an unselected anchor clears the range');
  assert.deepEqual(nav.nextSelection({ order, selected: [10], anchor: 99 }, 12, { range: true }).selected, [10, 12], 'a stale anchor falls back to a toggle');
});

test('v2 format: outbox send times', async () => {
  const { formatSendTime } = await importModule('js/format.js');
  const now = new Date(2026, 10, 12, 15, 0).getTime();
  assert.equal(formatSendTime(now - 1000, now), 'now');
  assert.equal(formatSendTime(now + 8000, now), 'in 8 s');
  assert.equal(formatSendTime(now + 5 * 60_000, now), 'in 5 min');
  assert.match(formatSendTime(new Date(2026, 10, 12, 20, 30).getTime(), now, 'en-US'), /^today at 8:30\sPM$/);
  assert.match(formatSendTime(new Date(2026, 10, 13, 8, 0).getTime(), now, 'en-US'), /^tomorrow at 8:00\sAM$/);
  assert.match(formatSendTime(new Date(2026, 10, 16, 8, 0).getTime(), now, 'en-US'), /^Mon, Nov 16 at 8:00\sAM$/);
  assert.match(formatSendTime(new Date(2027, 0, 4, 8, 0).getTime(), now, 'en-US'), /2027/);
  assert.equal(formatSendTime(NaN, now), '');
});

test('v2 api: folder, bulk, undo, thread, settings, outbox and compose endpoints', async () => {
  const mod = await importModule('js/api.js');
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined, csrf: init.headers['X-Mailtabs'] });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { api } = mod;
    await api.folders();
    await api.createFolder({ accountId: 1, name: 'Clients', parentId: 4 });
    await api.renameFolder(7, 'Partners');
    await api.deleteFolder(7);
    await api.deleteFolder(7, { force: true });
    await api.syncFolder(7);
    await api.backfillFolder(7, 100);
    await api.emptyFolder(9);
    await api.bulk([1, 2], 'move', { folderId: 7 });
    await api.undo('tok123');
    await api.thread(5);
    await api.settings();
    await api.updateSettings({ undoSendSeconds: 20 });
    await api.outbox();
    await api.cancelOutbox(3);
    await api.retryOutbox(3);
    await api.deleteOutbox(3);
    await api.deleteDraft({ folderId: 2, uid: 9 });
    await api.messages({ folder: 7, limit: 50 });
    await api.messages({ view: 'starred', unread: true });
    const sig = calls.map((c) => `${c.method} ${c.url}`);
    assert.deepEqual(sig, [
      'GET /api/folders',
      'POST /api/folders',
      'PATCH /api/folders/7',
      'DELETE /api/folders/7',
      'DELETE /api/folders/7?force=1',
      'POST /api/folders/7/sync',
      'POST /api/folders/7/backfill',
      'POST /api/folders/9/empty',
      'POST /api/messages/bulk',
      'POST /api/messages/undo',
      'GET /api/messages/5/thread',
      'GET /api/settings',
      'PUT /api/settings',
      'GET /api/outbox',
      'POST /api/outbox/3/cancel',
      'POST /api/outbox/3/retry',
      'DELETE /api/outbox/3',
      'DELETE /api/drafts',
      'GET /api/messages?folder=7&limit=50',
      'GET /api/messages?view=starred&unread=1',
    ]);
    for (const c of calls) if (c.method !== 'GET') assert.equal(c.csrf, '1', `${c.method} ${c.url} sends X-Mailtabs`);
    assert.deepEqual(calls[1].body, { accountId: 1, name: 'Clients', parentId: 4 });
    assert.deepEqual(calls[2].body, { name: 'Partners' });
    assert.deepEqual(calls[6].body, { count: 100 });
    assert.deepEqual(calls[8].body, { ids: [1, 2], action: 'move', folderId: 7 });
    assert.deepEqual(calls[9].body, { token: 'tok123' });
    assert.deepEqual(calls[12].body, { undoSendSeconds: 20 });
    assert.deepEqual(calls[17].body, { draft: { folderId: 2, uid: 9 } });
    assert.equal(mod.rawUrl(5), '/api/messages/5/raw');
    // The printed header is dated in the browser's time zone.
    const tz = new URLSearchParams({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone }).toString();
    assert.equal(mod.printUrl(5, false), `/api/messages/5/print?${tz}`);
    assert.equal(mod.printUrl(5, true), `/api/messages/5/print?images=1&${tz}`);
  } finally {
    globalThis.fetch = realFetch;
  }
});
