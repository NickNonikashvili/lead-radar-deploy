'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');

const { startTestServer, makeClient, signupUser } = require('./helpers');
const { HttpError } = require('../src/errors');
const middleware = require('../src/middleware');

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; " +
  "connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";

function assertSecurityHeaders(res, label) {
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff', label);
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer', label);
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN', label);
  assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin', label);
  assert.equal(res.headers.get('content-security-policy'), EXPECTED_CSP, label);
  assert.equal(res.headers.get('x-powered-by'), null, label);
}

function makePublicDir(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailtabs-public-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const INDEX_HTML = '<!doctype html><html><head><title>Mailtabs</title></head><body><div id="app"></div></body></html>';

test('app with a built frontend', async (t) => {
  const publicDir = makePublicDir(t, {
    'index.html': INDEX_HTML,
    'styles.css': 'body { color: red; }',
    'js/mod.js': 'export const x = 1;',
    '.secret': 'do not serve',
  });
  const srv = await startTestServer({}, { stubSync: true, publicDir });
  t.after(() => srv.close());
  const client = makeClient(srv.baseUrl);

  await t.test('security headers on API, static, SPA and 404 responses', async () => {
    for (const p of ['/api/config', '/api/auth/me', '/styles.css', '/', '/inbox/work', '/api/nope', '/vendor/preact-htm.js', '/missing.css']) {
      assertSecurityHeaders(await client.get(p), p);
    }
  });

  await t.test('API responses are not cacheable', async () => {
    assert.equal((await client.get('/api/config')).headers.get('cache-control'), 'no-store');
    assert.equal((await client.get('/api/auth/me')).headers.get('cache-control'), 'no-store');
  });

  await t.test('GET /api/config', async () => {
    const res = await client.get('/api/config');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.equal(res.body.allowSignups, true);
    assert.deepEqual(res.body.providers, { google: false, microsoft: false });
    assert.ok(Array.isArray(res.body.presets));
    assert.ok(res.body.presets.length > 0, 'presets come from providers.publicPresets()');
    const keys = res.body.presets.map((p) => p.key);
    for (const k of ['gmail', 'outlook', 'imap']) assert.ok(keys.includes(k), `preset ${k}`);
    // Never leak OAuth client secrets through the public config.
    assert.doesNotMatch(JSON.stringify(res.body), /clientSecret|client_secret/);
  });

  await t.test('unknown /api routes get a JSON 404, never the SPA', async () => {
    for (const p of ['/api/nope', '/api/auth/nope', '/api', '/api/']) {
      const res = await client.get(p);
      assert.equal(res.status, 404, p);
      assert.match(res.headers.get('content-type'), /application\/json/, p);
      assert.deepEqual(res.body, { error: 'Not found', code: 'NOT_FOUND' }, p);
    }
    const post = await client.post('/api/does-not-exist', { a: 1 });
    assert.equal(post.status, 404);
    assert.equal(post.body.code, 'NOT_FOUND');
  });

  await t.test('SPA fallback serves index.html for app routes', async () => {
    for (const p of ['/', '/settings', '/tab/3/message/42']) {
      const res = await client.get(p);
      assert.equal(res.status, 200, p);
      assert.match(res.headers.get('content-type'), /text\/html/, p);
      assert.equal(res.body, INDEX_HTML, p);
      assert.equal(res.headers.get('cache-control'), 'no-cache', p);
    }
    const head = await client.raw('/somewhere', { method: 'HEAD' });
    assert.equal(head.status, 200);
  });

  await t.test('static files are served; missing assets and dotfiles 404 instead of index.html', async () => {
    const css = await client.get('/styles.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);
    assert.equal(css.body, 'body { color: red; }');

    const js = await client.get('/js/mod.js');
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /javascript/);

    for (const p of ['/missing.js', '/js/missing.js', '/.secret']) {
      const res = await client.get(p);
      assert.equal(res.status, 404, p);
      assert.notEqual(res.body, INDEX_HTML, p);
    }
  });

  await t.test('vendored Preact + htm bundle', async () => {
    const res = await client.get('/vendor/preact-htm.js');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/javascript/);
    assert.match(res.body, /export\s*\{/);
    assert.match(res.body, /as html/);
    assert.match(res.body, /as render/);

    const missing = await client.get('/vendor/other.js');
    assert.equal(missing.status, 404);
    assert.notEqual(missing.body, INDEX_HTML);
    assert.equal((await client.get('/vendor')).status, 404);
  });

  await t.test('malformed and oversized JSON bodies become JSON 400 / 413', async () => {
    let res = await client.post('/api/auth/login', '{"email": "x@example.com",');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'The request body is not valid JSON.', code: 'BAD_JSON' });

    res = await client.post('/api/auth/login', 'null'); // strict mode: only objects/arrays
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_JSON');

    const big = JSON.stringify({ email: 'x@example.com', password: 'x'.repeat(1024 * 1024 + 10) });
    res = await client.post('/api/auth/login', big);
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, { error: 'The request body is too large.', code: 'PAYLOAD_TOO_LARGE' });
  });

  await t.test('non-GET requests outside /api are a plain 404', async () => {
    const res = await client.post('/settings', { a: 1 });
    assert.equal(res.status, 404);
  });

  await t.test('feature routes are mounted behind the CSRF guard and the session', async () => {
    const user = makeClient(srv.baseUrl);
    await signupUser(user);
    for (const p of ['/api/accounts', '/api/tabs', '/api/messages?tab=all']) {
      const res = await user.get(p);
      assert.notEqual(res.status, 404, `${p} should be mounted`);
      assert.match(res.headers.get('content-type'), /json/, p);
    }
    assert.notEqual((await user.post('/api/sync')).status, 404, '/api/sync should be mounted');
  });
});

test('app without a built frontend responds 404 text instead of crashing', async (t) => {
  const publicDir = makePublicDir(t, {});
  const srv = await startTestServer({}, { stubSync: true, publicDir });
  t.after(() => srv.close());
  const client = makeClient(srv.baseUrl);
  for (const p of ['/', '/settings']) {
    const res = await client.get(p);
    assert.equal(res.status, 404, p);
    assert.match(res.headers.get('content-type'), /text\/plain/, p);
  }
  // The API still works.
  assert.equal((await client.get('/api/config')).status, 200);
});

test('OAuth providers show up in /api/config when configured; trust proxy is applied', async (t) => {
  const srv = await startTestServer(
    { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret-value', TRUST_PROXY: '1' },
    { stubSync: true, publicDir: makePublicDir(t, {}) }
  );
  t.after(() => srv.close());
  const res = await makeClient(srv.baseUrl).get('/api/config');
  assert.deepEqual(res.body.providers, { google: true, microsoft: false });
  assert.doesNotMatch(JSON.stringify(res.body), /gsecret-value/);
  assert.equal(srv.app.get('trust proxy'), 1);
});

// ---------------------------------------------------------------------------------------------
// middleware units (on a tiny standalone express app)
// ---------------------------------------------------------------------------------------------

async function serve(t, app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );
  return `http://127.0.0.1:${server.address().port}`;
}

test('asyncHandler + errorHandler map errors to JSON', async (t) => {
  const logged = [];
  const logger = { error: (...args) => logged.push(args) };
  const app = express();
  app.get(
    '/http',
    middleware.asyncHandler(async () => {
      throw new HttpError(422, 'Nope, not like that', 'BAD_THING');
    })
  );
  app.get(
    '/nocode',
    middleware.asyncHandler(async () => {
      throw new HttpError(400, 'Just a message');
    })
  );
  app.get(
    '/exposed',
    middleware.asyncHandler(async () => {
      const err = new Error('Upstream mail server failed');
      err.status = 502;
      err.expose = true;
      err.code = 'REMOTE_FAILED';
      throw err;
    })
  );
  app.get(
    '/boom',
    middleware.asyncHandler(async () => {
      throw new Error('secret internal detail');
    })
  );
  app.get(
    '/sync-throw',
    middleware.asyncHandler(() => {
      throw new TypeError('sync failure');
    })
  );
  app.get('/plain-throw', () => {
    throw new Error('thrown outside asyncHandler');
  });
  app.get('/param/:id', (req, res) => res.json({ id: req.params.id }));
  app.get(
    '/ok',
    middleware.asyncHandler(async (req, res) => {
      await new Promise((r) => setTimeout(r, 5));
      res.json({ ok: true });
    })
  );
  app.use(middleware.createErrorHandler(logger));
  const base = await serve(t, app);
  const client = makeClient(base);

  let res = await client.get('/http');
  assert.equal(res.status, 422);
  assert.deepEqual(res.body, { error: 'Nope, not like that', code: 'BAD_THING' });

  res = await client.get('/nocode');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'Just a message' });

  res = await client.get('/exposed');
  assert.equal(res.status, 502);
  assert.deepEqual(res.body, { error: 'Upstream mail server failed', code: 'REMOTE_FAILED' });

  assert.equal(logged.length, 0, 'expected errors are not logged');

  for (const p of ['/boom', '/sync-throw', '/plain-throw']) {
    res = await client.get(p);
    assert.equal(res.status, 500, p);
    assert.deepEqual(res.body, { error: 'Something went wrong' }, p);
    assert.doesNotMatch(JSON.stringify(res.body), /secret internal detail/);
  }
  assert.equal(logged.length, 3, 'unexpected errors are logged');
  assert.match(String(logged[0][1]), /secret internal detail/, 'with the stack');

  res = await client.get('/ok');
  assert.deepEqual(res.body, { ok: true });

  // express rejects undecodable route params with a bare 400; it must stay a 400 (not a 500).
  res = await client.get('/param/%E0%A4%A');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'Bad Request' });
  assert.equal(logged.length, 3, 'client errors are not logged');
});

test('rateLimit middleware: counts per key, resets after the window, exposes reset()', async (t) => {
  const limiter = middleware.rateLimit({ windowMs: 200, max: 2, key: (req) => req.query.k || 'none' });
  const app = express();
  app.get('/hit', limiter, (req, res) => res.json({ ok: true }));
  app.get('/reset', (req, res) => {
    limiter.reset(req);
    res.json({ ok: true });
  });
  const client = makeClient(await serve(t, app));

  assert.equal((await client.get('/hit?k=a')).status, 200);
  assert.equal((await client.get('/hit?k=a')).status, 200);
  const blocked = await client.get('/hit?k=a');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, 'RATE_LIMITED');
  assert.equal((await client.get('/hit?k=b')).status, 200, 'other keys unaffected');

  await client.get('/reset?k=a');
  assert.equal((await client.get('/hit?k=a')).status, 200, 'reset() clears the key');

  await client.get('/hit?k=a');
  assert.equal((await client.get('/hit?k=a')).status, 429);
  await new Promise((r) => setTimeout(r, 250));
  assert.equal((await client.get('/hit?k=a')).status, 200, 'window expired');

  assert.throws(() => middleware.rateLimit({ windowMs: 0, max: 1, key: () => 'x' }), TypeError);
});

test('parseCookies', () => {
  assert.deepEqual({ ...middleware.parseCookies('a=1; mt_session=abc%2Fdef; b="quoted"') }, { a: '1', mt_session: 'abc/def', b: 'quoted' });
  assert.deepEqual({ ...middleware.parseCookies('') }, {});
  assert.deepEqual({ ...middleware.parseCookies(undefined) }, {});
  assert.deepEqual({ ...middleware.parseCookies('broken; x=%E0%A4%A') }, { x: '%E0%A4%A' });
  assert.deepEqual({ ...middleware.parseCookies('x=1; x=2') }, { x: '1' });
});

test('requireAuth and csrfGuard in isolation', async (t) => {
  const app = express();
  app.use(middleware.csrfGuard);
  app.get('/api/private', middleware.requireAuth, (req, res) => res.json({ ok: true }));
  app.post('/api/thing', (req, res) => res.json({ ok: true }));
  app.post('/not-api', (req, res) => res.json({ ok: true }));
  app.options('/api/thing', (req, res) => res.json({ ok: true }));
  const client = makeClient(await serve(t, app));

  const priv = await client.get('/api/private');
  assert.equal(priv.status, 401);
  assert.equal(priv.body.code, 'UNAUTHENTICATED');

  assert.equal((await client.raw('/api/thing', { method: 'POST' })).status, 403);
  assert.equal((await client.raw('/api/thing', { method: 'POST', headers: { 'X-Mailtabs': '1' } })).status, 200);
  assert.equal((await client.raw('/api/thing', { method: 'OPTIONS' })).status, 200);
  assert.equal((await client.raw('/not-api', { method: 'POST' })).status, 403, 'every unsafe method is guarded, whatever the path');
  assert.equal((await client.raw('/API/thing', { method: 'POST' })).status, 403, 'path case cannot bypass the guard');
  assert.equal((await client.raw('/apiary', { method: 'POST', headers: { 'X-Mailtabs': '1' } })).status, 404, 'with the header, unknown paths fall through');
});

// ---------------------------------------------------------------------------------------------
// test helper sanity (the MIME builder other areas use to seed the IMAP test server)
// ---------------------------------------------------------------------------------------------

test('helpers.buildRawMessage produces MIME that mailparser reads back', async () => {
  const { simpleParser } = require('mailparser');
  const { buildRawMessage } = require('./helpers');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const date = new Date('2026-03-04T10:20:30Z');
  const raw = buildRawMessage({
    from: { name: 'Zoë "Z" Example', address: 'zoe@example.com' },
    to: ['bob@test.local', { name: 'Carol', address: 'carol@example.com' }],
    cc: 'Dave <dave@example.com>',
    subject: 'Invoice ✓ #42',
    text: 'Plain body — with unicode',
    html: '<p>HTML <b>body</b> <img src="cid:logo@x"></p>',
    date,
    headers: { 'X-Test': 'yes' },
    attachments: [
      { filename: 'report.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.4 fake') },
      { filename: 'logo.png', contentType: 'image/png', content: png, cid: 'logo@x' },
    ],
  });
  assert.ok(Buffer.isBuffer(raw));
  assert.ok(raw.includes('\r\n'), 'CRLF line endings');

  const parsed = await simpleParser(raw);
  assert.equal(parsed.subject, 'Invoice ✓ #42');
  assert.equal(parsed.from.value[0].name, 'Zoë "Z" Example');
  assert.equal(parsed.from.value[0].address, 'zoe@example.com');
  assert.deepEqual(parsed.to.value.map((a) => a.address), ['bob@test.local', 'carol@example.com']);
  assert.equal(parsed.cc.value[0].address, 'dave@example.com');
  assert.equal(parsed.date.getTime(), date.getTime());
  assert.equal(parsed.text.trim(), 'Plain body — with unicode');
  assert.match(parsed.html, /HTML <b>body<\/b>/);
  assert.equal(parsed.headers.get('x-test'), 'yes');
  assert.ok(parsed.messageId);

  const pdf = parsed.attachments.find((a) => a.filename === 'report.pdf');
  assert.ok(pdf);
  assert.equal(pdf.contentDisposition, 'attachment');
  assert.equal(pdf.content.toString(), '%PDF-1.4 fake');
  const logo = parsed.attachments.find((a) => a.filename === 'logo.png');
  assert.ok(logo);
  assert.equal(logo.cid, 'logo@x');
  assert.equal(logo.contentDisposition, 'inline');
  assert.deepEqual(logo.content, png);

  // Text-only and HTML-only messages are single-part.
  const textOnly = await simpleParser(buildRawMessage({ subject: 'hi', text: 'just text' }));
  assert.equal(textOnly.text.trim(), 'just text');
  assert.equal(textOnly.html, false);
  const htmlOnly = await simpleParser(buildRawMessage({ subject: 'hi', html: '<p>only html</p>' }));
  assert.match(htmlOnly.html, /only html/);
});
