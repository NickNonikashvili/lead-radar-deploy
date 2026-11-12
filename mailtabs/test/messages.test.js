'use strict';

// HTTP tests for /api/messages.
// Part 1 uses seeded rows and a stubbed sync manager. Part 2 runs the real sync engine against the
// local Dovecot with bob@test.local only (bob's mailboxes are reset first; skipped when it is down).

const test = require('node:test');
const assert = require('node:assert/strict');

const { HttpError } = require('../src/errors');
const imapModule = require('../src/imap');
const messagesRoutes = require('../src/routes/messages');
const {
  startTestServer,
  makeClient,
  signupUser,
  seedAccount,
  seedMessage,
  IMAP_TEST,
  imapAvailable,
  resetMailbox,
  appendMessage,
  lockTestImapUser,
  mailboxFlags,
  withTestImap,
} = require('./helpers');

const BOB = IMAP_TEST.users.bob;
const CSP_NO_IMAGES =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: cid:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const CSP_IMAGES =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: cid: https: http:; font-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function setup(t, env = {}, options = { stubSync: true }) {
  const srv = await startTestServer(env, options);
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  const aliceUser = await signupUser(alice, { email: 'alice@example.com' });
  const malloryUser = await signupUser(mallory, { email: 'mallory@example.com' });
  return { srv, alice, mallory, aliceUser, malloryUser };
}

const row = (srv, id) => srv.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

// =============================================================================================
// Part 1: seeded data, stubbed sync
// =============================================================================================

test('unit: LRU cache honours entry and byte limits', () => {
  const { LruCache } = messagesRoutes;
  const cache = new LruCache({ maxEntries: 3, maxBytes: 100 });
  cache.set('a', 'A', 10);
  cache.set('b', 'B', 10);
  cache.set('c', 'C', 10);
  assert.equal(cache.get('a'), 'A'); // a is now the most recently used
  cache.set('d', 'D', 10); // evicts b (least recently used)
  assert.equal(cache.has('b'), false);
  assert.deepEqual([...cache.map.keys()], ['c', 'a', 'd']);
  assert.equal(cache.bytes, 30);

  cache.set('big', 'X', 90); // 30 + 90 > 100: evict oldest until it fits
  assert.ok(cache.bytes <= 100);
  assert.equal(cache.get('big'), 'X');
  assert.ok(cache.size <= 3);

  assert.equal(cache.set('huge', 'H', 101), false, 'larger than the whole cache: not stored');
  assert.equal(cache.has('huge'), false);
  assert.equal(cache.get('big'), 'X', 'and nothing was evicted for it');

  cache.set('big', 'Y', 5); // replacing a key updates the byte count
  assert.equal(cache.bytes, [...cache.map.values()].reduce((s, e) => s + e.size, 0));
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.bytes, 0);
});

test('unit: Content-Disposition encoding', () => {
  const { contentDisposition, encodeRfc5987, cleanFilename } = messagesRoutes;
  assert.equal(contentDisposition('attachment', 'report.pdf'), `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`);
  assert.equal(
    contentDisposition('attachment', 'résumé (final) "v2".txt'),
    `attachment; filename="r_sum_ (final) _v2_.txt"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%28final%29%20%22v2%22.txt`
  );
  assert.equal(encodeRfc5987("it's*"), 'it%27s%2A');
  assert.equal(encodeRfc5987('日本.txt'), '%E6%97%A5%E6%9C%AC.txt');
  assert.equal(cleanFilename('../../etc/passwd', 0), 'passwd');
  assert.equal(cleanFilename('C:\\Users\\x\\evil.exe', 0), 'evil.exe');
  assert.equal(cleanFilename('bad\r\nheader.txt', 0), 'badheader.txt');
  assert.equal(cleanFilename('', 2), 'attachment-3');
  assert.equal(cleanFilename('..', 0), 'attachment-1');
});

test('message list: tabs, account filter, search, flags, paging, validation', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const work = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'me@work.com' });
  const home = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'me@home.com' });
  const evil = seedAccount(srv.db, srv.crypto, malloryUser.id, { email: 'evil@x.com' });
  const base = 1_700_000_000_000;
  const w1 = seedMessage(srv.db, work.id, { subject: 'Budget review', date: base + 3000, is_read: 0 });
  const w2 = seedMessage(srv.db, work.id, { subject: 'Lunch?', date: base + 2000, is_read: 1, is_starred: 1 });
  const h1 = seedMessage(srv.db, home.id, { subject: 'Holiday budget', date: base + 1000, is_read: 0, has_attachments: 1 });
  seedMessage(srv.db, evil.id, { subject: 'Budget secrets of mallory', date: base + 5000 });
  const workTab = (await alice.post('/api/tabs', { name: 'Work', accountIds: [work.id] })).body.tab;
  const malloryTab = (await mallory.post('/api/tabs', { name: 'M', allAccounts: true })).body.tab;

  const list = async (qs) => {
    const res = await alice.get(`/api/messages${qs}`);
    assert.equal(res.status, 200, `${qs}: ${JSON.stringify(res.body)}`);
    return res.body;
  };
  const listIds = async (qs) => (await list(qs)).messages.map((m) => m.id);

  const all = await list('?tab=all');
  assert.deepEqual(all.messages.map((m) => m.id), [w1.id, w2.id, h1.id]);
  assert.equal(all.nextCursor, null);
  assert.deepEqual(all.messages[1], {
    id: w2.id,
    accountId: work.id,
    fromName: 'Seed Sender',
    fromAddress: 'sender@example.com',
    subject: 'Lunch?',
    snippet: 'Seeded snippet',
    date: base + 2000,
    isRead: true,
    isStarred: true,
    hasAttachments: false,
  });
  assert.deepEqual(await listIds(''), [w1.id, w2.id, h1.id], 'tab defaults to all');
  assert.deepEqual(await listIds(`?tab=${workTab.id}`), [w1.id, w2.id]);
  assert.deepEqual(await listIds(`?account=${home.id}`), [h1.id]);
  assert.deepEqual(await listIds('?q=budget'), [w1.id, h1.id]);
  assert.deepEqual(await listIds(`?q=budget&tab=${workTab.id}`), [w1.id]);
  assert.deepEqual(await listIds('?q=%22budget%20(%20*%20-%20:'), [w1.id, h1.id], 'FTS syntax in q is harmless');
  assert.deepEqual(await listIds('?q=budget%20AND'), [], 'AND is a plain word, not an operator');
  assert.deepEqual(await listIds('?unread=1'), [w1.id, h1.id]);
  assert.deepEqual(await listIds('?starred=1'), [w2.id]);
  assert.deepEqual(await listIds('?unread=0'), [w1.id, w2.id, h1.id], 'only 1/true turn a filter on');

  // Paging through HTTP.
  const p1 = await list('?limit=2');
  assert.equal(p1.messages.length, 2);
  assert.ok(p1.nextCursor);
  const p2 = await list(`?limit=2&before=${encodeURIComponent(p1.nextCursor)}`);
  assert.deepEqual(p2.messages.map((m) => m.id), [h1.id]);
  assert.equal(p2.nextCursor, null);

  // Validation and ownership.
  assert.equal((await alice.get(`/api/messages?tab=${malloryTab.id}`)).status, 404);
  assert.equal((await alice.get('/api/messages?tab=999999')).status, 404);
  assert.equal((await alice.get('/api/messages?tab=abc')).status, 400);
  assert.equal((await alice.get(`/api/messages?account=${evil.id}`)).status, 404);
  assert.equal((await alice.get('/api/messages?account=-1')).status, 400);
  assert.equal((await alice.get('/api/messages?before=garbage!')).body.code, 'INVALID_CURSOR');
  assert.equal((await alice.get('/api/messages?limit=lots')).status, 400);
  assert.equal((await alice.get('/api/messages?tab=all&tab=1')).status, 200, 'repeated params use the first');
  // Mallory sees only Mallory's mail.
  assert.deepEqual((await mallory.get('/api/messages')).body.messages.map((m) => m.subject), ['Budget secrets of mallory']);
  assert.deepEqual((await mallory.get('/api/messages?q=budget')).body.messages.length, 1);
});

test('message detail: shape, deferred bodies, cross-user 404', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);
  const acct = seedAccount(srv.db, srv.crypto, aliceUser.id);
  const ready = seedMessage(srv.db, acct.id, {
    to: [{ name: 'Alice', address: 'alice@example.com' }],
    cc: [{ name: '', address: 'cc@example.com' }],
    html_body: '<p>Hello</p>',
    remote_image_count: 3,
    attachments: [
      { index: 0, filename: 'a.png', contentType: 'image/png', size: 5, cid: 'a', inline: true },
      { index: 1, filename: 'b.pdf', contentType: 'application/pdf', size: 7, cid: null, inline: false },
    ],
  });
  const deferred = seedMessage(srv.db, acct.id, { body_state: 'deferred', text_body: null, snippet: null, attachments_json: null });

  const res = await alice.get(`/api/messages/${ready.id}`);
  assert.equal(res.status, 200);
  const m = res.body.message;
  assert.equal(m.id, ready.id);
  assert.deepEqual(m.to, [{ name: 'Alice', address: 'alice@example.com' }]);
  assert.deepEqual(m.cc, [{ name: '', address: 'cc@example.com' }]);
  assert.deepEqual(m.replyTo, []);
  assert.equal(m.messageId, ready.message_id);
  assert.equal(m.bodyState, 'ready');
  assert.equal(m.hasHtml, true);
  assert.equal(m.remoteImageCount, 3);
  assert.deepEqual(m.attachments, [
    { index: 0, filename: 'a.png', contentType: 'image/png', size: 5, inline: true },
    { index: 1, filename: 'b.pdf', contentType: 'application/pdf', size: 7, inline: false },
  ]);
  assert.equal(m.bodyError, undefined);
  assert.ok(!('textBody' in m) && !('htmlBody' in m), 'no body content in JSON');
  assert.deepEqual(srv.syncManager.calls.fetchBodyNow, [], 'ready bodies are not re-fetched');

  // Deferred: the body is fetched on open.
  srv.syncManager.fetchBodyNow = async (r) => ({ ...r, body_state: 'ready', text_body: 'Fetched!', snippet: 'Fetched!' });
  const fetched = await alice.get(`/api/messages/${deferred.id}`);
  assert.equal(fetched.body.message.bodyState, 'ready');
  assert.equal(fetched.body.message.snippet, 'Fetched!');

  // ... and when that fails the detail is still returned, with a friendly bodyError.
  srv.syncManager.fetchBodyNow = async () => {
    throw new HttpError(502, 'Could not reach imap.example.com:993.', 'IMAP_ERROR');
  };
  const failed = await alice.get(`/api/messages/${deferred.id}`);
  assert.equal(failed.status, 200);
  assert.equal(failed.body.message.bodyState, 'deferred');
  assert.equal(failed.body.message.bodyError, 'Could not reach imap.example.com:993.');
  srv.syncManager.fetchBodyNow = async () => {
    throw new Error('ECONNRESET internal detail');
  };
  const generic = await alice.get(`/api/messages/${deferred.id}`);
  assert.equal(typeof generic.body.message.bodyError, 'string');

  // A sync manager returning some other row must not leak it.
  const other = seedMessage(srv.db, acct.id, { subject: 'not this one' });
  srv.syncManager.fetchBodyNow = async () => row(srv, other.id);
  assert.equal((await alice.get(`/api/messages/${deferred.id}`)).body.message.id, deferred.id);

  assert.equal((await mallory.get(`/api/messages/${ready.id}`)).status, 404);
  assert.equal((await alice.get('/api/messages/999999')).status, 404);
  assert.equal((await alice.get('/api/messages/abc')).status, 400);
});

test('message body document: CSP, caching, sanitizing, remote images, 404', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);
  const acct = seedAccount(srv.db, srv.crypto, aliceUser.id);
  const html = seedMessage(srv.db, acct.id, {
    subject: 'Newsletter <b>',
    html_body:
      '<p>Hi <b>there</b></p><img src="https://tracker.example.com/p.gif" alt="pixel"><img src="/api/messages/1/attachments/0" alt="inline">' +
      '<script>alert(1)</script><a href="javascript:alert(2)">x</a><a href="https://example.com">site</a><iframe src="https://evil"></iframe>',
    remote_image_count: 1,
  });
  const text = seedMessage(srv.db, acct.id, { html_body: null, text_body: 'Plain <text> see https://example.com/page now' });

  const res = await alice.get(`/api/messages/${html.id}/body`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html; charset=utf-8/);
  assert.equal(res.headers.get('content-security-policy'), CSP_NO_IMAGES);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  const doc = res.body;
  assert.match(doc, /^<!DOCTYPE html>/);
  assert.match(doc, /<b>there<\/b>/);
  assert.ok(!/<script/i.test(doc), 'no script');
  assert.ok(!/javascript:/i.test(doc), 'no javascript: URLs');
  assert.ok(!/<iframe/i.test(doc), 'no iframes');
  assert.ok(!doc.includes('tracker.example.com'), 'remote image blocked by default');
  assert.match(doc, /data-blocked="1"/);
  assert.match(doc, /src="\/api\/messages\/1\/attachments\/0"/, 'inline attachment images stay');
  assert.match(doc, /<title>Newsletter &lt;b&gt;<\/title>/);
  assert.match(doc, /target="_blank"/);

  const withImages = await alice.get(`/api/messages/${html.id}/body?images=1`);
  assert.equal(withImages.headers.get('content-security-policy'), CSP_IMAGES);
  assert.match(withImages.body, /src="https:\/\/tracker\.example\.com\/p\.gif"/);
  assert.equal((await alice.get(`/api/messages/${html.id}/body?images=0`)).headers.get('content-security-policy'), CSP_NO_IMAGES);

  const plain = await alice.get(`/api/messages/${text.id}/body`);
  assert.match(plain.body, /<pre class="mt-text">Plain &lt;text&gt; see <a href="https:\/\/example\.com\/page"/);

  // Not the user's / not there: an HTML 404 with the same strict policy.
  for (const [client, id] of [
    [mallory, html.id],
    [alice, 999999],
  ]) {
    const nf = await client.get(`/api/messages/${id}/body`);
    assert.equal(nf.status, 404);
    assert.match(nf.headers.get('content-type'), /text\/html/);
    assert.equal(nf.headers.get('content-security-policy'), CSP_NO_IMAGES);
    assert.ok(!nf.body.includes('Hi <b>there'), 'nothing of the message');
  }
  const anon = makeClient(srv.baseUrl);
  assert.equal((await anon.get(`/api/messages/${html.id}/body`)).status, 401);

  // Deferred body that cannot be downloaded: the document explains instead of being blank.
  const deferred = seedMessage(srv.db, acct.id, { body_state: 'deferred', text_body: null, html_body: null, snippet: 'preview text' });
  srv.syncManager.fetchBodyNow = async () => {
    throw new HttpError(502, 'Could not reach the server.', 'IMAP_ERROR');
  };
  const explained = await alice.get(`/api/messages/${deferred.id}/body`);
  assert.equal(explained.status, 200);
  assert.match(explained.body, /Could not reach the server\./);
  assert.match(explained.body, /preview text/);
});

test('PATCH flags: validation, cross-user, and revert when the mail server fails', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);
  // Port 1 refuses connections: every remote write fails.
  const broken = seedAccount(srv.db, srv.crypto, aliceUser.id, { imap_port: 1 });
  const msg = seedMessage(srv.db, broken.id, { is_read: 0, is_starred: 1 });

  assert.equal((await alice.patch(`/api/messages/${msg.id}`, {})).status, 400);
  assert.equal((await alice.patch(`/api/messages/${msg.id}`, { isRead: 'yes' })).status, 400);
  assert.equal((await alice.patch(`/api/messages/${msg.id}`, { isStarred: 1 })).status, 400);
  assert.equal((await mallory.patch(`/api/messages/${msg.id}`, { isRead: true })).status, 404);
  assert.equal((await alice.patch('/api/messages/0', { isRead: true })).status, 400);

  // Watch the local value while the remote call is in flight: it must already be updated.
  let localDuringRemote = null;
  const actions = require('../src/actions');
  const original = actions.applyFlags;
  actions.applyFlags = async (...args) => {
    localDuringRemote = row(srv, msg.id).is_read;
    return original(...args);
  };
  t.after(() => {
    actions.applyFlags = original;
  });

  const res = await alice.patch(`/api/messages/${msg.id}`, { isRead: true, isStarred: false });
  assert.equal(res.status, 502);
  assert.equal(res.body.code, 'REMOTE_FAILED');
  assert.match(res.body.error, /127\.0\.0\.1:1|refused|reach/i);
  assert.equal(localDuringRemote, 1, 'local row was updated first');
  const after = row(srv, msg.id);
  assert.equal(after.is_read, 0, 'reverted');
  assert.equal(after.is_starred, 1, 'reverted');
});

test('bulk and mark-all-read: validation, grouping per account, failures, cross-user', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const broken = seedAccount(srv.db, srv.crypto, aliceUser.id, { imap_port: 1 });
  const m1 = seedMessage(srv.db, broken.id, { is_read: 0 });
  const m2 = seedMessage(srv.db, broken.id, { is_read: 0 });
  const evilAcct = seedAccount(srv.db, srv.crypto, malloryUser.id, { imap_port: 1 });
  const evilMsg = seedMessage(srv.db, evilAcct.id, { is_read: 0 });

  const bad = async (body) => assert.equal((await alice.post('/api/messages/bulk', body)).status, 400, JSON.stringify(body).slice(0, 80));
  await bad({});
  await bad({ ids: [m1.id] });
  await bad({ ids: [m1.id], action: 'explode' });
  await bad({ ids: 'all', action: 'read' });
  await bad({ ids: [0], action: 'read' });
  await bad({ ids: Array.from({ length: 501 }, (_, i) => i + 1), action: 'read' });

  // Ids of other users' messages match nothing; Alice's failing account is reported.
  const res = await alice.post('/api/messages/bulk', { ids: [m1.id, m2.id, evilMsg.id], action: 'trash' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.count, 0);
  assert.equal(res.body.failed.length, 1, 'one entry per failing account');
  assert.equal(res.body.failed[0].accountId, broken.id);
  assert.equal(typeof res.body.failed[0].error, 'string');
  assert.ok(row(srv, m1.id) && row(srv, m2.id), 'nothing deleted locally when the move fails');
  assert.ok(row(srv, evilMsg.id));

  const flags = await alice.post('/api/messages/bulk', { ids: [m1.id], action: 'read' });
  assert.equal(flags.body.failed.length, 1);
  assert.equal(row(srv, m1.id).is_read, 0, 'not marked read when the server refused');

  const empty = await mallory.post('/api/messages/bulk', { ids: [m1.id, m2.id], action: 'archive' });
  assert.deepEqual(empty.body, { ok: true, count: 0, failed: [] });

  // mark-all-read: nothing could be changed -> 502 so the UI rolls back.
  const mar = await alice.post('/api/messages/mark-all-read', { tab: 'all' });
  assert.equal(mar.status, 502);
  assert.equal(mar.body.code, 'REMOTE_FAILED');
  assert.equal(row(srv, m1.id).is_read, 0);
  const malloryTab = (await mallory.post('/api/tabs', { name: 'M', allAccounts: true })).body.tab;
  assert.equal((await alice.post('/api/messages/mark-all-read', { tab: malloryTab.id })).status, 404);
  assert.equal((await alice.post('/api/messages/mark-all-read', { tab: 'x' })).status, 400);

  // Nothing unread in a tab: count 0, no server contact.
  const emptyTab = (await alice.post('/api/tabs', { name: 'Empty' })).body.tab;
  assert.deepEqual((await alice.post('/api/messages/mark-all-read', { tab: emptyTab.id })).body, { ok: true, count: 0, failed: [] });
  assert.equal(row(srv, evilMsg.id).is_read, 0, 'other users untouched');
});

test('attachments: ownership and index checks happen before any download', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);
  const acct = seedAccount(srv.db, srv.crypto, aliceUser.id, { imap_port: 1 });
  const msg = seedMessage(srv.db, acct.id, {
    attachments: [{ index: 0, filename: 'a.pdf', contentType: 'application/pdf', size: 1, cid: null, inline: false }],
  });
  let downloads = 0;
  const original = imapModule.withImap;
  imapModule.withImap = async (...args) => {
    downloads += 1;
    return original(...args);
  };
  t.after(() => {
    imapModule.withImap = original;
  });

  assert.equal((await mallory.get(`/api/messages/${msg.id}/attachments/0`)).status, 404);
  assert.equal((await alice.get(`/api/messages/${msg.id}/attachments/5`)).status, 404);
  assert.equal((await alice.get(`/api/messages/${msg.id}/attachments/-1`)).status, 400);
  assert.equal((await alice.get(`/api/messages/${msg.id}/attachments/abc`)).status, 400);
  assert.equal(downloads, 0);

  const unreachable = await alice.get(`/api/messages/${msg.id}/attachments/0`);
  assert.equal(unreachable.status, 502);
  assert.equal(unreachable.body.code, 'IMAP_ERROR');
  assert.equal(downloads, 1);
});

// =============================================================================================
// Part 2: the real sync engine + Dovecot (bob@test.local)
// =============================================================================================

test('end to end against Dovecot: list, body, attachments, flags, bulk, mark-all-read', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const release = await lockTestImapUser('bob');
  t.after(release);
  await resetMailbox('bob');
  t.after(() => resetMailbox('bob').catch(() => {}));

  const pdf = Buffer.from('%PDF-1.4\n% fake pdf for tests\n', 'utf8');
  const unicodeText = Buffer.from('Grüße aus Köln', 'utf8');
  const now = Date.now();
  await appendMessage('bob', { subject: 'Plain hello', text: 'Just text. https://example.com', date: new Date(now - 30000) });
  await appendMessage('bob', {
    subject: 'Rich newsletter',
    from: { name: 'News Team', address: 'news@example.org' },
    html: '<p>Hello <b>reader</b></p><img src="cid:logo@mt" alt="logo"><img src="https://tracker.example.com/open.gif">',
    text: 'Hello reader',
    attachments: [
      { filename: 'logo.png', contentType: 'image/png', content: PNG, cid: 'logo@mt' },
      { filename: 'report.pdf', contentType: 'application/pdf', content: pdf },
      { filename: 'Grüße (final).txt', contentType: 'text/plain', content: unicodeText },
      { filename: 'vector.svg', contentType: 'image/svg+xml', content: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' },
    ],
    date: new Date(now - 20000),
  });
  await appendMessage('bob', { subject: 'Already read', text: 'old news', flags: ['\\Seen'], date: new Date(now - 10000) });
  // Bigger than MAX_BODY_BYTES (10000 below): stored without a body until opened.
  await appendMessage('bob', { subject: 'Huge one', text: `big ${'x'.repeat(30000)}`, date: new Date(now - 40000) });

  const { srv, alice, mallory } = await setup(t, { MAX_BODY_BYTES: '10000' }, { stubSync: false });
  const created = await alice.post('/api/accounts', {
    provider: 'imap',
    email: BOB.user,
    password: BOB.pass,
    imapHost: IMAP_TEST.host,
    imapPort: IMAP_TEST.port,
    imapSecurity: 'none',
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const accountId = created.body.account.id;
  const synced = await alice.post(`/api/accounts/${accountId}/sync`, {});
  assert.equal(synced.body.result.ok, true, JSON.stringify(synced.body));

  // --- list
  const list = (await alice.get('/api/messages?tab=all')).body.messages;
  assert.deepEqual(list.map((m) => m.subject), ['Already read', 'Rich newsletter', 'Plain hello', 'Huge one']);
  const bySubject = Object.fromEntries(list.map((m) => [m.subject, m]));
  assert.equal(bySubject['Already read'].isRead, true);
  assert.equal(bySubject['Plain hello'].isRead, false);
  assert.equal(bySubject['Rich newsletter'].hasAttachments, true);
  assert.equal(bySubject['Rich newsletter'].fromName, 'News Team');
  assert.deepEqual((await alice.get('/api/messages?q=newsletter')).body.messages.map((m) => m.subject), ['Rich newsletter']);
  assert.deepEqual((await alice.get('/api/tabs')).body.all, { unreadCount: 3, totalCount: 4 });

  // --- detail + body of the rich message
  const richId = bySubject['Rich newsletter'].id;
  const detail = (await alice.get(`/api/messages/${richId}`)).body.message;
  assert.equal(detail.bodyState, 'ready');
  assert.equal(detail.hasHtml, true);
  assert.equal(detail.remoteImageCount, 1);
  assert.deepEqual(
    detail.attachments.map((a) => [a.filename, a.contentType, a.inline]),
    [
      ['logo.png', 'image/png', true],
      ['report.pdf', 'application/pdf', false],
      ['Grüße (final).txt', 'text/plain', false],
      ['vector.svg', 'image/svg+xml', false],
    ]
  );
  const logoIndex = detail.attachments.find((a) => a.filename === 'logo.png').index;
  const body = await alice.get(`/api/messages/${richId}/body`);
  assert.equal(body.headers.get('content-security-policy'), CSP_NO_IMAGES);
  assert.ok(body.body.includes(`src="/api/messages/${richId}/attachments/${logoIndex}"`), 'cid: image rewritten to our endpoint');
  assert.ok(!body.body.includes('tracker.example.com'));
  assert.ok((await alice.get(`/api/messages/${richId}/body?images=1`)).body.includes('https://tracker.example.com/open.gif'));

  // --- attachments: one IMAP download for several (parallel) requests
  let downloads = 0;
  const original = imapModule.withImap;
  imapModule.withImap = async (...args) => {
    downloads += 1;
    return original(...args);
  };
  let responses;
  try {
    responses = await Promise.all(detail.attachments.map((a) => alice.get(`/api/messages/${richId}/attachments/${a.index}`)));
    await alice.get(`/api/messages/${richId}/attachments/${logoIndex}`); // cached
  } finally {
    imapModule.withImap = original;
  }
  assert.equal(downloads, 1, 'parallel requests share one download, later ones hit the cache');
  const [png, pdfRes, txt, svg] = responses;
  for (const r of responses) {
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('cache-control'), 'private, max-age=86400');
  }
  assert.equal(png.headers.get('content-type'), 'image/png');
  assert.equal(png.headers.get('content-disposition'), `inline; filename="logo.png"; filename*=UTF-8''logo.png`);
  assert.deepEqual(png.buffer, PNG);
  assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
  assert.equal(pdfRes.headers.get('content-disposition'), `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`);
  assert.deepEqual(pdfRes.buffer, pdf);
  assert.equal(txt.headers.get('content-disposition'), `attachment; filename="Gr__e (final).txt"; filename*=UTF-8''Gr%C3%BC%C3%9Fe%20%28final%29.txt`);
  assert.deepEqual(txt.buffer, unicodeText);
  assert.match(svg.headers.get('content-disposition'), /^attachment;/, 'SVG is never inline');
  assert.match(svg.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await alice.get(`/api/messages/${richId}/attachments/9`)).status, 404);
  assert.equal((await mallory.get(`/api/messages/${richId}/attachments/0`)).status, 404);
  assert.equal((await mallory.get(`/api/messages/${richId}/body`)).status, 404);

  // --- deferred body is downloaded when the message is opened
  const hugeId = bySubject['Huge one'].id;
  assert.equal(row(srv, hugeId).body_state, 'deferred');
  const huge = (await alice.get(`/api/messages/${hugeId}`)).body.message;
  assert.equal(huge.bodyState, 'ready');
  assert.equal(huge.bodyError, undefined);
  assert.match((await alice.get(`/api/messages/${hugeId}/body`)).body, /big xxxx/);

  // --- PATCH flags: local + remote
  const plainId = bySubject['Plain hello'].id;
  const plainUid = row(srv, plainId).uid;
  const read = await alice.patch(`/api/messages/${plainId}`, { isRead: true });
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.message.isRead, true);
  const star = await alice.patch(`/api/messages/${plainId}`, { isStarred: true });
  assert.equal(star.body.message.isStarred, true);
  let flags = await mailboxFlags('bob');
  assert.ok(flags.get(plainUid).has('\\Seen'));
  assert.ok(flags.get(plainUid).has('\\Flagged'));
  await alice.patch(`/api/messages/${plainId}`, { isRead: false, isStarred: false });
  flags = await mailboxFlags('bob');
  assert.ok(!flags.get(plainUid).has('\\Seen'));
  assert.ok(!flags.get(plainUid).has('\\Flagged'));
  assert.equal((await mallory.patch(`/api/messages/${plainId}`, { isRead: true })).status, 404);

  // Remote failure: point the account at a dead port; the local change is undone.
  srv.db.prepare('UPDATE accounts SET imap_port = 1 WHERE id = ?').run(accountId);
  const failed = await alice.patch(`/api/messages/${plainId}`, { isRead: true });
  assert.equal(failed.status, 502);
  assert.equal(row(srv, plainId).is_read, 0);
  srv.db.prepare('UPDATE accounts SET imap_port = ? WHERE id = ?').run(IMAP_TEST.port, accountId);

  // --- bulk flags
  const ids = list.map((m) => m.id);
  const bulkStar = await alice.post('/api/messages/bulk', { ids, action: 'star' });
  assert.deepEqual(bulkStar.body, { ok: true, count: 4, failed: [] });
  flags = await mailboxFlags('bob');
  assert.ok([...flags.values()].every((f) => f.has('\\Flagged')));
  const bulkUnstar = await alice.post('/api/messages/bulk', { ids, action: 'unstar' });
  assert.equal(bulkUnstar.body.count, 4);
  assert.equal((await alice.post('/api/messages/bulk', { ids: [plainId], action: 'unread' })).body.count, 0, 'already unread');

  // --- mark-all-read for a tab
  const tab = (await alice.post('/api/tabs', { name: 'Bob', accountIds: [accountId] })).body.tab;
  const mar = await alice.post('/api/messages/mark-all-read', { tab: tab.id });
  assert.deepEqual(mar.body, { ok: true, count: 3, failed: [] });
  flags = await mailboxFlags('bob');
  assert.ok([...flags.values()].every((f) => f.has('\\Seen')));
  assert.equal((await alice.get('/api/tabs')).body.tabs[0].unreadCount, 0);

  // --- archive and trash move on the server, then disappear locally
  const archived = await alice.post('/api/messages/bulk', { ids: [plainId], action: 'archive' });
  assert.deepEqual(archived.body, { ok: true, count: 1, failed: [] });
  const trashed = await alice.post('/api/messages/bulk', { ids: [richId, hugeId], action: 'trash' });
  assert.deepEqual(trashed.body, { ok: true, count: 2, failed: [] });
  assert.equal(row(srv, plainId), undefined);
  const subjectsIn = (box) =>
    withTestImap('bob', async (client) => {
      const lock = await client.getMailboxLock(box);
      try {
        if (!client.mailbox.exists) return [];
        const out = [];
        for await (const msg of client.fetch('1:*', { envelope: true })) out.push(msg.envelope.subject);
        return out.sort();
      } finally {
        lock.release();
      }
    });
  assert.deepEqual(await subjectsIn('Archive'), ['Plain hello']);
  assert.deepEqual(await subjectsIn('Trash'), ['Huge one', 'Rich newsletter']);
  assert.deepEqual(await subjectsIn('INBOX'), ['Already read']);
  assert.deepEqual((await alice.get('/api/messages')).body.messages.map((m) => m.subject), ['Already read']);

  // A later sync agrees with what we did.
  const resync = await alice.post(`/api/accounts/${accountId}/sync`, {});
  assert.equal(resync.body.result.ok, true);
  assert.deepEqual((await alice.get('/api/messages')).body.messages.map((m) => [m.subject, m.isRead]), [['Already read', true]]);
});
