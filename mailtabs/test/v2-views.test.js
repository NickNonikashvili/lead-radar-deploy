'use strict';

// ROUTES v2, no IMAP: unified views, folder lists, list item fields, tab counts, conversations,
// contacts, settings and the folder tree — with seeded rows and a stubbed sync manager.

const test = require('node:test');
const assert = require('node:assert/strict');

const messagesRoutes = require('../src/routes/messages');
const composeRoutes = require('../src/routes/compose');
const { startTestServer, makeClient, signupUser, seedAccount, seedMessage, seedFolder } = require('./helpers');

async function setup(t) {
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  const aliceUser = await signupUser(alice, { email: 'alice@example.com', name: 'Alice' });
  const malloryUser = await signupUser(mallory, { email: 'mallory@example.com' });
  return { srv, alice, mallory, aliceUser, malloryUser };
}

/** An account with the usual Dovecot folders. Returns { account, f: { inbox, sent, ... } }. */
function accountWithFolders(srv, userId, overrides = {}) {
  const account = seedAccount(srv.db, srv.crypto, userId, overrides);
  const f = {
    inbox: seedFolder(srv.db, account.id, 'INBOX'),
    sent: seedFolder(srv.db, account.id, 'Sent', { specialUse: '\\Sent' }),
    drafts: seedFolder(srv.db, account.id, 'Drafts', { specialUse: '\\Drafts' }),
    junk: seedFolder(srv.db, account.id, 'Junk', { specialUse: '\\Junk' }),
    trash: seedFolder(srv.db, account.id, 'Trash', { specialUse: '\\Trash' }),
    archive: seedFolder(srv.db, account.id, 'Archive', { specialUse: '\\Archive' }),
    all: seedFolder(srv.db, account.id, 'All Mail', { specialUse: '\\All', sync_mode: 'on_demand' }),
    work: seedFolder(srv.db, account.id, 'Work'),
    clients: seedFolder(srv.db, account.id, 'Work/Clients'),
  };
  return { account, f };
}

function msgIn(srv, account, folder, overrides = {}) {
  return seedMessage(srv.db, account.id, { mailbox: folder.path, folder_id: folder.id, ...overrides });
}

const ids = (res) => res.body.messages.map((m) => m.id);

test('unified views, folder lists, list item fields and source validation', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const a = accountWithFolders(srv, aliceUser.id, { email: 'a@work.example' });
  const b = accountWithFolders(srv, aliceUser.id, { email: 'b@home.example' });
  const evil = accountWithFolders(srv, malloryUser.id, { email: 'evil@x.example' });
  const base = 1_700_000_000_000;
  const at = (n) => base + n * 1000;

  const inboxA = msgIn(srv, a.account, a.f.inbox, { date: at(10), is_starred: 1, message_id: '<star@x>', thread_key: 'mid:<root@x>', is_answered: 1 });
  // The same starred message again in All Mail (Gmail-style copy) and in a label: shown once.
  msgIn(srv, a.account, a.f.all, { date: at(10), is_starred: 1, message_id: '<star@x>' });
  const labelCopy = msgIn(srv, a.account, a.f.work, { date: at(10), is_starred: 1, message_id: '<star@x>' });
  const starredClients = msgIn(srv, a.account, a.f.clients, { date: at(9), is_starred: 1, message_id: '<other-star@x>' });
  const starredTrash = msgIn(srv, a.account, a.f.trash, { date: at(8), is_starred: 1, message_id: '<trashed-star@x>' });
  const starredJunk = msgIn(srv, a.account, a.f.junk, { date: at(7), is_starred: 1 });
  const starredNoId = msgIn(srv, b.account, b.f.archive, { date: at(6), is_starred: 1, message_id: null });
  // Same Message-ID in another account is another message: both shown.
  const starredOtherAccount = msgIn(srv, b.account, b.f.inbox, { date: at(5), is_starred: 1, message_id: '<star@x>' });
  msgIn(srv, evil.account, evil.f.inbox, { date: at(20), is_starred: 1 });

  const sentA = msgIn(srv, a.account, a.f.sent, { date: at(4), is_read: 1 });
  const sentB = msgIn(srv, b.account, b.f.sent, { date: at(3), is_read: 1 });
  const draftA = msgIn(srv, a.account, a.f.drafts, { date: at(2), is_draft: 1 });
  const junkB = msgIn(srv, b.account, b.f.junk, { date: at(1) });
  msgIn(srv, evil.account, evil.f.sent, { date: at(30) });

  const list = (client, qs) => client.get(`/api/messages${qs}`);

  // --- starred: deduped per (account, Message-ID), lowest id; no Trash/Spam/All Mail copies
  const starred = await list(alice, '?view=starred');
  assert.equal(starred.status, 200, JSON.stringify(starred.body));
  assert.deepEqual(ids(starred), [inboxA.id, starredClients.id, starredNoId.id, starredOtherAccount.id]);
  assert.ok(!ids(starred).includes(labelCopy.id) && !ids(starred).includes(starredTrash.id) && !ids(starred).includes(starredJunk.id));
  assert.deepEqual(ids(await list(alice, `?view=starred&account=${b.account.id}`)), [starredNoId.id, starredOtherAccount.id]);
  assert.deepEqual(ids(await list(mallory, '?view=starred')).length, 1, 'only Mallory\'s own');

  // --- list items carry folder, answered/draft flags and the thread key
  const item = starred.body.messages[0];
  assert.equal(item.folderId, a.f.inbox.id);
  assert.equal(item.isAnswered, true);
  assert.equal(item.isDraft, false);
  assert.equal(item.threadKey, 'mid:<root@x>');

  // --- sent / drafts / junk / trash across accounts
  assert.deepEqual(ids(await list(alice, '?view=sent')), [sentA.id, sentB.id]);
  assert.deepEqual(ids(await list(alice, '?view=drafts')), [draftA.id]);
  assert.equal((await list(alice, '?view=drafts')).body.messages[0].isDraft, true);
  assert.deepEqual(ids(await list(alice, '?view=junk')), [starredJunk.id, junkB.id]);
  assert.deepEqual(ids(await list(alice, '?view=trash')), [starredTrash.id]);
  assert.deepEqual(ids(await list(alice, '?view=sent&unread=1')), []);

  // --- one folder
  assert.deepEqual(ids(await list(alice, `?folder=${a.f.clients.id}`)), [starredClients.id]);
  assert.deepEqual(ids(await list(alice, `?folder=${a.f.inbox.id}`)), [inboxA.id]);
  // --- the inbox tab view only ever shows INBOX mail
  assert.deepEqual(ids(await list(alice, '?tab=all')), [inboxA.id, starredOtherAccount.id]);

  // --- validation and ownership
  assert.equal((await list(alice, `?folder=${evil.f.inbox.id}`)).status, 404, "someone else's folder");
  assert.equal((await list(alice, '?folder=999999')).status, 404);
  assert.equal((await list(alice, '?folder=abc')).status, 400);
  assert.equal((await list(alice, '?view=everything')).body.code, 'INVALID_VIEW');
  assert.equal((await list(alice, `?view=sent&folder=${a.f.inbox.id}`)).body.code, 'INVALID_SOURCE');
  assert.equal((await list(alice, '?view=sent&tab=all')).body.code, 'INVALID_SOURCE');
  assert.equal((await list(mallory, `?view=sent&account=${a.account.id}`)).status, 404);
  assert.deepEqual(ids(await list(mallory, '?view=sent')).length, 1);
});

test('tab counts and mark-all-read only cover the INBOX; mark-all-read works on a folder or view too', async (t) => {
  const { srv, alice, aliceUser } = await setup(t);
  const a = accountWithFolders(srv, aliceUser.id);
  msgIn(srv, a.account, a.f.inbox, { is_read: 0 });
  msgIn(srv, a.account, a.f.inbox, { is_read: 1 });
  msgIn(srv, a.account, a.f.work, { is_read: 0 });
  msgIn(srv, a.account, a.f.sent, { is_read: 0 });
  const tab = (await alice.post('/api/tabs', { name: 'All of it', allAccounts: true })).body.tab;
  const tabs = (await alice.get('/api/tabs')).body;
  assert.deepEqual(tabs.all, { unreadCount: 1, totalCount: 2 });
  assert.equal(tabs.tabs.find((x) => x.id === tab.id).unreadCount, 1);
  const [account] = (await alice.get('/api/accounts')).body.accounts;
  assert.deepEqual([account.messageCount, account.unreadCount], [2, 1]);

  // A folder source needs no tab, and a bad combination is refused.
  assert.equal((await alice.post('/api/messages/mark-all-read', { folder: a.f.work.id, tab: 'all' })).body.code, 'INVALID_SOURCE');
  assert.equal((await alice.post('/api/messages/mark-all-read', { view: 'nope' })).body.code, 'INVALID_VIEW');
});

test('GET /api/folders: per account, sidebar order, local unread counts when complete, never another user\'s', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const empty = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'first@x.example' });
  const a = accountWithFolders(srv, aliceUser.id, { email: 'second@x.example' });
  const z = seedFolder(srv.db, a.account.id, 'Zebra');
  const nested = seedFolder(srv.db, a.account.id, 'Archive/2023');
  const container = seedFolder(srv.db, a.account.id, '[Gmail]', { selectable: 0 });
  accountWithFolders(srv, malloryUser.id);
  // INBOX fully synced: the local unread count (follows reads at once). Work: older mail exists
  // on the server, so the server's count is shown.
  srv.db.prepare('UPDATE folders SET last_synced_at = 1, has_older = 0, unread_count = 50, total_count = 60 WHERE id = ?').run(a.f.inbox.id);
  srv.db.prepare('UPDATE folders SET last_synced_at = 1, has_older = 1, unread_count = 7, total_count = 900 WHERE id = ?').run(a.f.work.id);
  msgIn(srv, a.account, a.f.inbox, { is_read: 0 });
  msgIn(srv, a.account, a.f.inbox, { is_read: 1 });
  msgIn(srv, a.account, a.f.work, { is_read: 0 });

  const res = await alice.get('/api/folders');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.accounts.map((x) => x.accountId), [empty.id, a.account.id]);
  assert.deepEqual(res.body.accounts[0].folders, []);
  const tree = res.body.accounts[1].folders;
  assert.deepEqual(
    tree.map((f) => f.path),
    ['INBOX', 'Drafts', 'Sent', 'Archive', 'Junk', 'Trash', '[Gmail]', 'All Mail', 'Archive/2023', 'Work', 'Work/Clients', 'Zebra']
  );
  const inbox = tree[0];
  assert.deepEqual(inbox, {
    id: a.f.inbox.id,
    accountId: a.account.id,
    path: 'INBOX',
    name: 'Inbox',
    parentPath: null,
    delimiter: null,
    specialUse: '\\Inbox',
    selectable: true,
    syncMode: 'auto',
    totalCount: 60,
    unreadCount: 1,
    hasOlder: false,
    lastSyncedAt: 1,
  });
  const work = tree.find((f) => f.path === 'Work');
  assert.deepEqual([work.unreadCount, work.totalCount, work.hasOlder], [7, 900, true]);
  assert.equal(tree.find((f) => f.id === nested.id).parentPath, 'Archive');
  assert.equal(tree.find((f) => f.id === container.id).selectable, false);
  assert.ok(tree.find((f) => f.id === z.id));

  const theirs = await mallory.get('/api/folders');
  assert.equal(theirs.body.accounts.length, 1);
  assert.ok(!JSON.stringify(theirs.body).includes(`"accountId":${a.account.id}`));
  assert.equal((await makeClient(srv.baseUrl).get('/api/folders')).status, 401);
});

test('folder routes: validation, protected folders, FOLDER_NOT_EMPTY and cross-user 404s (no server contact)', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const a = accountWithFolders(srv, aliceUser.id);
  const theirs = accountWithFolders(srv, malloryUser.id);
  msgIn(srv, a.account, a.f.work, {});

  // Create: account and parent must be the user's; names are checked before any IMAP call.
  const create = (client, body) => client.post('/api/folders', body);
  assert.equal((await create(alice, { accountId: theirs.account.id, name: 'X' })).status, 404);
  assert.equal((await create(mallory, { accountId: a.account.id, name: 'X' })).status, 404);
  assert.equal((await create(alice, { accountId: a.account.id, name: 'X', parentId: theirs.f.work.id })).status, 404);
  const other = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'other@x.example' });
  const otherFolder = seedFolder(srv.db, other.id, 'Elsewhere');
  assert.equal((await create(alice, { accountId: a.account.id, name: 'X', parentId: otherFolder.id })).body.code, 'INVALID_FOLDER');
  for (const name of ['', '   ', 'a/b', 'star*', '100%', 'line\nbreak', 'tab\there', '..', '#shared', '~bob', 'x'.repeat(101), 42, null]) {
    const res = await create(alice, { accountId: a.account.id, name });
    assert.equal(res.status, 400, `${JSON.stringify(name)}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.code, 'INVALID_FOLDER_NAME', JSON.stringify(name));
  }
  assert.equal((await create(alice, { accountId: a.account.id, name: 'inbox' })).body.code, 'INVALID_FOLDER_NAME', 'INBOX is taken');
  assert.equal((await create(alice, { accountId: a.account.id, name: 'Work' })).body.code, 'FOLDER_EXISTS', 'known locally: no round trip');
  assert.equal((await create(alice, { accountId: a.account.id, name: 'Clients', parentId: a.f.work.id })).body.code, 'FOLDER_EXISTS');

  // Rename / delete: special folders (and folders holding one) are protected.
  const holder = seedFolder(srv.db, a.account.id, 'Projects');
  seedFolder(srv.db, a.account.id, 'Projects/Archive', { specialUse: '\\Archive' });
  for (const folder of [a.f.inbox, a.f.sent, a.f.drafts, a.f.trash, a.f.junk, a.f.archive, a.f.all, holder]) {
    const renamed = await alice.patch(`/api/folders/${folder.id}`, { name: 'Renamed' });
    assert.equal(renamed.body.code, 'PROTECTED_FOLDER', `rename ${folder.path}`);
    const deleted = await alice.del(`/api/folders/${folder.id}?force=1`);
    assert.equal(deleted.body.code, 'PROTECTED_FOLDER', `delete ${folder.path}`);
  }
  assert.equal((await alice.patch(`/api/folders/${a.f.clients.id}`, { name: 'a/b' })).body.code, 'INVALID_FOLDER_NAME');
  assert.equal((await alice.patch(`/api/folders/${a.f.work.id}`, { name: 'Projects' })).body.code, 'FOLDER_EXISTS');
  const same = await alice.patch(`/api/folders/${a.f.work.id}`, { name: 'Work' });
  assert.equal(same.status, 200, 'same name: nothing to do');
  assert.equal(same.body.folder.id, a.f.work.id);

  // Not empty (local messages, or subfolders): 409 unless forced.
  const notEmpty = await alice.del(`/api/folders/${a.f.work.id}`);
  assert.equal(notEmpty.status, 409);
  assert.equal(notEmpty.body.code, 'FOLDER_NOT_EMPTY');
  assert.match(notEmpty.body.error, /1 message and 1 subfolder/);
  srv.db.prepare('UPDATE folders SET total_count = 3 WHERE id = ?').run(a.f.clients.id);
  assert.match((await alice.del(`/api/folders/${a.f.clients.id}`)).body.error, /3 messages/, 'the server count counts too');

  // Empty: only Trash / Spam.
  for (const folder of [a.f.inbox, a.f.work, a.f.archive, a.f.sent]) {
    assert.equal((await alice.post(`/api/folders/${folder.id}/empty`, {})).body.code, 'NOT_EMPTYABLE', folder.path);
  }

  // Sync / backfill go to the sync manager, for the user's own selectable folders only.
  const synced = await alice.post(`/api/folders/${a.f.work.id}/sync`, {});
  assert.equal(synced.status, 200);
  assert.deepEqual(synced.body.result, { folderId: a.f.work.id, ok: true, accountId: a.account.id, newMessages: 0, removed: 0, updated: 0 });
  assert.equal(synced.body.folder.id, a.f.work.id);
  assert.deepEqual(srv.syncManager.calls.syncFolder, [{ folderId: a.f.work.id, markOpened: true }]);
  const older = await alice.post(`/api/folders/${a.f.work.id}/backfill`, { count: 50 });
  assert.deepEqual(older.body, { added: 0, hasOlder: false });
  assert.deepEqual(srv.syncManager.calls.backfillFolder, [{ folderId: a.f.work.id, count: 50 }]);
  assert.equal((await alice.post(`/api/folders/${a.f.work.id}/backfill`, { count: 0 })).status, 400);
  assert.equal((await alice.post(`/api/folders/${a.f.work.id}/backfill`, { count: 501 })).status, 400);
  const container = seedFolder(srv.db, a.account.id, 'Box', { selectable: 0 });
  assert.equal((await alice.post(`/api/folders/${container.id}/sync`, {})).body.code, 'NOT_SELECTABLE');

  // Every folder route: someone else's folder is simply not found, and nothing reaches the engine.
  for (const [method, path, body] of [
    ['patch', '', { name: 'pwned' }],
    ['del', '?force=1', undefined],
    ['post', '/sync', {}],
    ['post', '/backfill', {}],
    ['post', '/empty', {}],
  ]) {
    const res = await mallory[method](`/api/folders/${a.f.trash.id}${path}`, body);
    assert.equal(res.status, 404, `${method} ${path}`);
  }
  assert.equal(srv.syncManager.calls.syncFolder.length, 1);
  assert.equal(srv.syncManager.calls.backfillFolder.length, 1);
  assert.equal((await alice.post('/api/folders/xyz/sync', {})).status, 400);
});

test('conversation: same account + thread, across folders, deduped, without Gmail views; cross-user 404', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);
  const a = accountWithFolders(srv, aliceUser.id);
  const b = accountWithFolders(srv, aliceUser.id, { email: 'b@x.example' });
  const key = 'mid:<root@x>';
  const root = msgIn(srv, a.account, a.f.inbox, { date: 1000, message_id: '<root@x>', thread_key: key, subject: 'Plan' });
  const reply = msgIn(srv, a.account, a.f.sent, {
    date: 2000,
    message_id: '<reply@x>',
    in_reply_to: '<root@x>',
    references_json: JSON.stringify(['<root@x>']),
    thread_key: key,
  });
  // The same reply again in All Mail (a Gmail view) and in Archive: shown once, from Sent.
  msgIn(srv, a.account, a.f.all, { date: 2000, message_id: '<reply@x>', thread_key: key });
  msgIn(srv, a.account, a.f.archive, { date: 2000, message_id: '<reply@x>', thread_key: key });
  // A reply from a client that only sets In-Reply-To (its own thread key differs).
  const loose = msgIn(srv, a.account, a.f.inbox, { date: 3000, message_id: '<loose@x>', in_reply_to: '<reply@x>', thread_key: 'mid:<reply@x>' });
  // Deleted messages stay out (unless the opened one is deleted too); other accounts never join.
  const trashed = msgIn(srv, a.account, a.f.trash, { date: 2500, message_id: '<trashed@x>', thread_key: key });
  msgIn(srv, b.account, b.f.inbox, { date: 1500, message_id: '<root@x>', thread_key: key });
  const unrelated = msgIn(srv, a.account, a.f.inbox, { date: 1200, message_id: '<else@x>', thread_key: 'mid:<else@x>' });

  const res = await alice.get(`/api/messages/${reply.id}/thread`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.messages.map((m) => m.id), [root.id, reply.id, loose.id]);
  const sent = res.body.messages[1];
  assert.equal(sent.specialUse, '\\Sent');
  assert.equal(sent.folderId, a.f.sent.id);
  assert.equal(sent.folderName, 'Sent');
  assert.ok(Array.isArray(sent.to) && Array.isArray(sent.attachments), 'detail fields');
  assert.ok(!('textBody' in sent) && !('htmlBody' in sent));

  const fromTrash = await alice.get(`/api/messages/${trashed.id}/thread`);
  assert.ok(fromTrash.body.messages.some((m) => m.id === trashed.id));
  assert.deepEqual((await alice.get(`/api/messages/${unrelated.id}/thread`)).body.messages.map((m) => m.id), [unrelated.id]);
  const noKey = msgIn(srv, a.account, a.f.inbox, { message_id: null, thread_key: null });
  assert.deepEqual((await alice.get(`/api/messages/${noKey.id}/thread`)).body.messages.map((m) => m.id), [noKey.id]);

  assert.equal((await mallory.get(`/api/messages/${reply.id}/thread`)).status, 404);
  assert.equal((await mallory.get(`/api/messages/${reply.id}/print`)).status, 404);
  assert.equal((await mallory.get(`/api/messages/${reply.id}/raw`)).status, 404);
});

test('print view: headers, escaping, CSP, remote images only on request', async (t) => {
  const { srv, alice, aliceUser } = await setup(t);
  const a = accountWithFolders(srv, aliceUser.id);
  const m = msgIn(srv, a.account, a.f.inbox, {
    subject: 'Q3 <b>plan</b> & "budget"',
    from_name: 'Eve <script>',
    from_address: 'eve@x.example',
    to: [{ name: 'Alice', address: 'alice@example.com' }],
    date: Date.UTC(2026, 0, 2, 15, 4),
    html_body: '<p>Hello <img src="https://tracker.example/p.png"><script>alert(1)</script></p>',
    attachments: [{ index: 0, filename: 'report.pdf', contentType: 'application/pdf', size: 3, inline: false }],
  });

  const res = await alice.get(`/api/messages/${m.id}/print?tz=Europe/Berlin`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  assert.equal(
    res.headers.get('content-security-policy'),
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
  );
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const html = res.body;
  assert.ok(html.includes('<h1>Q3 &lt;b&gt;plan&lt;/b&gt; &amp; &quot;budget&quot;</h1>'), 'subject escaped');
  assert.ok(html.includes('Eve &lt;script&gt; &lt;eve@x.example&gt;'), 'sender escaped');
  assert.ok(html.includes('Alice &lt;alice@example.com&gt;'));
  assert.ok(html.includes('report.pdf'));
  assert.match(html, /Friday, January 2, 2026 at 4:04\s?PM GMT\+1/, 'date in the requested time zone');
  assert.ok(!/<script/i.test(html.replace(/&lt;script/g, '')), 'no script elements');
  assert.ok(!html.includes('https://tracker.example'), 'remote image held back');

  const images = await alice.get(`/api/messages/${m.id}/print?images=1&tz=Not/AZone`);
  assert.match(images.headers.get('content-security-policy'), /img-src 'self' data: https: http:;/);
  assert.ok(images.body.includes('https://tracker.example/p.png'));
  assert.match(images.body, /UTC/, 'unknown time zones fall back to UTC');
});

test('contacts: ranked by frequency then recency, prefix match, own addresses and spam left out, per user', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const a = accountWithFolders(srv, aliceUser.id, { email: 'me@work.example' });
  const evil = accountWithFolders(srv, malloryUser.id, { email: 'evil@x.example' });
  const from = (name, address, date, folder = a.f.inbox) => msgIn(srv, a.account, folder, { from_name: name, from_address: address, date });
  from('Bob Builder', 'bob@b.example', 100);
  from('Bob Builder', 'bob@b.example', 200);
  from('Bobby Tables', 'bobby@t.example', 900);
  from('', 'bo@quiet.example', 950);
  from('Spammy Bob', 'bob@spam.example', 999, a.f.junk);
  from('Me Myself', 'ME@work.example', 1000);
  // Recipients of sent mail count; Cc too.
  msgIn(srv, a.account, a.f.sent, {
    from_address: 'me@work.example',
    to: [{ name: 'Carol Boe', address: 'carol@c.example' }],
    cc: [{ name: '', address: 'bob@b.example' }],
    date: 300,
  });
  msgIn(srv, a.account, a.f.sent, { from_address: 'me@work.example', to: [{ name: 'Carol Boe', address: 'carol@c.example' }], date: 400 });
  // Mail *received* in To isn't a contact signal; Mallory's mail is never Alice's.
  msgIn(srv, a.account, a.f.inbox, { to: [{ name: 'Bob Stranger', address: 'bob@stranger.example' }], from_address: 'x@x.example', date: 1 });
  msgIn(srv, evil.account, evil.f.inbox, { from_name: 'Bob Evil', from_address: 'bob@evil.example', date: 5000 });

  const get = async (client, qs) => {
    const res = await client.get(`/api/contacts${qs}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.contacts;
  };
  assert.deepEqual(await get(alice, '?q=bo'), [
    { name: 'Bob Builder', address: 'bob@b.example' }, // 3 times
    { name: 'Carol Boe', address: 'carol@c.example' }, // twice, matches the second word of the name
    { name: '', address: 'bo@quiet.example' }, // once, newest
    { name: 'Bobby Tables', address: 'bobby@t.example' },
  ]);
  assert.deepEqual(await get(alice, '?q=BOB&limit=1'), [{ name: 'Bob Builder', address: 'bob@b.example' }]);
  assert.deepEqual(await get(alice, '?q=carol@'), [{ name: 'Carol Boe', address: 'carol@c.example' }]);
  assert.deepEqual(await get(alice, '?q=me'), [], 'own account left out');
  assert.deepEqual(await get(alice, '?q=%25'), [], 'LIKE wildcards are literal');
  assert.deepEqual((await get(alice, '')).map((c) => c.address), ['bob@b.example', 'carol@c.example', 'bo@quiet.example', 'bobby@t.example', 'x@x.example'], 'no query: everyone, most frequent first');
  assert.deepEqual(await get(mallory, '?q=bob'), [{ name: 'Bob Evil', address: 'bob@evil.example' }]);
  assert.equal((await alice.get('/api/contacts?q=bo&limit=0')).status, 400);
  assert.equal((await alice.get('/api/contacts?q=bo&limit=21')).status, 400);
  assert.equal((await makeClient(srv.baseUrl).get('/api/contacts?q=bo')).status, 401);
});

test('settings: defaults, validation, partial updates, per user', async (t) => {
  const { srv, alice, mallory } = await setup(t);
  assert.deepEqual((await alice.get('/api/settings')).body, { settings: { undoSendSeconds: 10, notifications: false } });
  const put = await alice.put('/api/settings', { undoSendSeconds: 20 });
  assert.equal(put.status, 200);
  assert.deepEqual(put.body.settings, { undoSendSeconds: 20, notifications: false });
  assert.deepEqual((await alice.put('/api/settings', { notifications: true })).body.settings, { undoSendSeconds: 20, notifications: true });
  for (const body of [{ undoSendSeconds: 31 }, { undoSendSeconds: -1 }, { undoSendSeconds: 2.5 }, { undoSendSeconds: 'ten' }, { notifications: 'yes' }, {}, { evil: 1 }]) {
    assert.equal((await alice.put('/api/settings', body)).status, 400, JSON.stringify(body));
  }
  assert.deepEqual((await alice.get('/api/settings')).body.settings, { undoSendSeconds: 20, notifications: true });
  assert.deepEqual((await mallory.get('/api/settings')).body.settings, { undoSendSeconds: 10, notifications: false }, 'Mallory has her own');
  const stored = srv.db.prepare('SELECT settings FROM user_settings').all().map((r) => JSON.parse(r.settings));
  assert.ok(stored.every((s) => Object.keys(s).sort().join() === 'notifications,undoSendSeconds'), 'only known keys are stored');
  assert.equal((await alice.put('/api/settings', { undoSendSeconds: 0 }, { headers: { 'x-mailtabs': '0' } })).status, 403, 'CSRF header required');
  assert.equal((await makeClient(srv.baseUrl).get('/api/settings')).status, 401);
});

test('unit: download and upload file names', () => {
  const { emlFilename, contentDisposition } = messagesRoutes;
  assert.equal(emlFilename('Quarterly report'), 'Quarterly report.eml');
  assert.equal(emlFilename('Re: a/b\\c *?<>| "q"\r\nnext'), 'Re_ a_b_c _____ _q_ next.eml');
  assert.equal(emlFilename('  ...  '), 'message.eml');
  assert.equal(emlFilename(null), 'message.eml');
  assert.equal(emlFilename('x'.repeat(400)).length, 154);
  assert.equal(
    contentDisposition('attachment', emlFilename('Résumé ✓')),
    `attachment; filename="R_sum_ _.eml"; filename*=UTF-8''R%C3%A9sum%C3%A9%20%E2%9C%93.eml`
  );
  const { decodeFilenameHeader } = composeRoutes;
  assert.equal(decodeFilenameHeader(encodeURIComponent('日本語 report.pdf')), '日本語 report.pdf');
  assert.equal(decodeFilenameHeader('100%.txt'), '100%.txt');
  assert.equal(decodeFilenameHeader(undefined), 'attachment');
  assert.equal(decodeFilenameHeader('a'.repeat(5000)).length, 1024);
});
