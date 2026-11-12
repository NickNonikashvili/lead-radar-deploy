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
  const reader = read(path.join(PUBLIC, 'js/components/Reader.js'));
  const m = reader.match(/const FRAME_SANDBOX = '([^']*)'/);
  assert.ok(m, 'Reader.js defines FRAME_SANDBOX');
  assert.equal(m[1], 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  assert.match(reader, /sandbox=\$\{FRAME_SANDBOX\}/);
  for (const f of jsFiles) {
    for (const s of read(f).matchAll(/sandbox=["'`]([^"'`]*)["'`]/g)) {
      assert.ok(!s[1].includes('allow-scripts'), `${rel(f)} sandbox must not include allow-scripts`);
    }
  }
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
