'use strict';

// HTTP tests for /api/tabs (stubbed sync, no IMAP).

const test = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, makeClient, signupUser, seedAccount, seedMessage } = require('./helpers');

async function setup(t) {
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const bob = makeClient(srv.baseUrl);
  const aliceUser = await signupUser(alice, { email: 'alice@example.com' });
  const bobUser = await signupUser(bob, { email: 'bob@example.com' });
  return { srv, alice, bob, aliceUser, bobUser };
}

test('tabs require a session and the CSRF header', async (t) => {
  const { srv, alice } = await setup(t);
  const anon = makeClient(srv.baseUrl);
  assert.equal((await anon.get('/api/tabs')).status, 401);
  assert.equal((await anon.post('/api/tabs', { name: 'x' })).status, 401);
  assert.equal((await anon.patch('/api/tabs/1', { name: 'x' })).status, 401);
  assert.equal((await anon.del('/api/tabs/1')).status, 401);
  assert.equal((await anon.put('/api/tabs/order', { ids: [] })).status, 401);
  const noCsrf = await alice.raw('/api/tabs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"x"}' });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.body.code, 'CSRF');
});

test('create, list, update and delete tabs', async (t) => {
  const { srv, alice, aliceUser } = await setup(t);
  const work = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'me@work.com' });
  const home = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'me@home.com' });

  const empty = await alice.get('/api/tabs');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { tabs: [], all: { unreadCount: 0, totalCount: 0 } });

  const created = await alice.post('/api/tabs', { name: '  Work  ', color: '#FF0000', accountIds: [work.id] });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.tab, {
    id: created.body.tab.id,
    name: 'Work',
    color: '#ff0000',
    position: 0,
    allAccounts: false,
    accountIds: [work.id],
    rules: null,
    unreadCount: 0,
    totalCount: 0,
  });

  const receipts = await alice.post('/api/tabs', {
    name: 'Receipts',
    allAccounts: true,
    rules: { match: 'all', conditions: [{ field: 'subject', op: 'contains', value: ' receipt ' }, { field: 'from', op: 'not_contains', value: 'spam' }] },
  });
  assert.equal(receipts.status, 201);
  assert.equal(receipts.body.tab.position, 1);
  assert.equal(receipts.body.tab.color, '#4f46e5');
  assert.deepEqual(receipts.body.tab.rules, {
    match: 'all',
    conditions: [
      { field: 'subject', op: 'contains', value: 'receipt' },
      { field: 'from', op: 'not_contains', value: 'spam' },
    ],
  });

  // Counts follow the messages.
  seedMessage(srv.db, work.id, { is_read: 0, subject: 'Standup' });
  seedMessage(srv.db, work.id, { is_read: 1, subject: 'Your receipt' });
  seedMessage(srv.db, home.id, { is_read: 0, subject: 'Receipt from shop', from_address: 'spam@x.com' });
  seedMessage(srv.db, home.id, { is_read: 0, subject: 'Hi' });
  const listed = await alice.get('/api/tabs');
  assert.deepEqual(listed.body.all, { unreadCount: 3, totalCount: 4 });
  assert.deepEqual(
    listed.body.tabs.map((tab) => [tab.name, tab.unreadCount, tab.totalCount]),
    [
      ['Work', 1, 2],
      ['Receipts', 0, 1], // subject has "receipt" AND sender is not spam: only the read one
    ]
  );

  // PATCH is partial; accountIds replaces the set; rules: null clears.
  const tabId = created.body.tab.id;
  const renamed = await alice.patch(`/api/tabs/${tabId}`, { name: 'Office' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.tab.name, 'Office');
  assert.equal(renamed.body.tab.color, '#ff0000');
  assert.deepEqual(renamed.body.tab.accountIds, [work.id]);

  const swapped = await alice.patch(`/api/tabs/${tabId}`, { accountIds: [home.id, work.id], color: '#00ff00' });
  assert.deepEqual(swapped.body.tab.accountIds.sort(), [work.id, home.id].sort());
  assert.equal(swapped.body.tab.totalCount, 4);
  const none = await alice.patch(`/api/tabs/${tabId}`, { accountIds: [] });
  assert.deepEqual(none.body.tab.accountIds, []);
  assert.equal(none.body.tab.totalCount, 0, 'a tab with no accounts shows nothing');

  const cleared = await alice.patch(`/api/tabs/${receipts.body.tab.id}`, { rules: null, allAccounts: false });
  assert.equal(cleared.body.tab.rules, null);
  assert.equal(cleared.body.tab.allAccounts, false);
  const emptyRules = await alice.patch(`/api/tabs/${receipts.body.tab.id}`, { rules: { match: 'all', conditions: [] } });
  assert.equal(emptyRules.body.tab.rules, null, 'empty conditions are stored as no rules');

  // Delete leaves accounts and mail alone.
  const removed = await alice.del(`/api/tabs/${tabId}`);
  assert.deepEqual(removed.body, { ok: true });
  assert.equal((await alice.get('/api/tabs')).body.tabs.length, 1);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE user_id = ?').get(aliceUser.id).n, 2);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 4);
  assert.equal((await alice.del(`/api/tabs/${tabId}`)).status, 404);
});

test('tab input validation', async (t) => {
  const { srv, alice, aliceUser, bobUser } = await setup(t);
  const mine = seedAccount(srv.db, srv.crypto, aliceUser.id);
  const bobs = seedAccount(srv.db, srv.crypto, bobUser.id);

  const bad = async (body, code) => {
    const res = await alice.post('/api/tabs', body);
    assert.equal(res.status, 400, `${JSON.stringify(body).slice(0, 80)} -> ${res.status} ${JSON.stringify(res.body)}`);
    assert.equal(typeof res.body.error, 'string');
    if (code) assert.equal(res.body.code, code, JSON.stringify(body).slice(0, 80));
  };
  const cond = (over = {}) => ({ field: 'subject', op: 'contains', value: 'x', ...over });

  await bad({});
  await bad({ name: '' });
  await bad({ name: '    ' });
  await bad({ name: 'x'.repeat(41) });
  await bad({ name: 42 });
  await bad({ name: 'ok', color: 'red' }, 'INVALID_COLOR');
  await bad({ name: 'ok', color: '#12345' }, 'INVALID_COLOR');
  await bad({ name: 'ok', allAccounts: 'yes' });
  await bad({ name: 'ok', accountIds: 'all' }, 'INVALID_ID');
  await bad({ name: 'ok', accountIds: [0] }, 'INVALID_ID');
  await bad({ name: 'ok', accountIds: [-3] }, 'INVALID_ID');
  await bad({ name: 'ok', accountIds: [1.5] }, 'INVALID_ID');
  await bad({ name: 'ok', accountIds: [bobs.id] }, 'INVALID_ACCOUNT');
  await bad({ name: 'ok', accountIds: [mine.id, 999999] }, 'INVALID_ACCOUNT');
  await bad({ name: 'ok', rules: 'subject contains x' }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: [] }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'some', conditions: [cond()] } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: 'x' } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: [cond({ field: 'cc' })] } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: [cond({ op: 'equals' })] } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: [cond({ value: '' })] } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: [cond({ value: '   ' })] } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: [cond({ value: 5 })] } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: [cond({ value: 'v'.repeat(201) })] } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: [null] } }, 'INVALID_RULES');
  await bad({ name: 'ok', rules: { match: 'all', conditions: new Array(21).fill(cond()) } }, 'INVALID_RULES');

  // Limits that are fine.
  const okRes = await alice.post('/api/tabs', {
    name: 'x'.repeat(40),
    rules: { match: 'all', conditions: new Array(20).fill(cond({ value: 'v'.repeat(200) })) },
  });
  assert.equal(okRes.status, 201);
  const accountIdsDuplicated = await alice.post('/api/tabs', { name: 'dups', accountIds: [mine.id, mine.id] });
  assert.deepEqual(accountIdsDuplicated.body.tab.accountIds, [mine.id]);

  // PATCH validates the same way, and ids in the path must be positive integers.
  const tabId = okRes.body.tab.id;
  assert.equal((await alice.patch(`/api/tabs/${tabId}`, { name: '' })).status, 400);
  assert.equal((await alice.patch(`/api/tabs/${tabId}`, { color: 'blue' })).status, 400);
  assert.equal((await alice.patch(`/api/tabs/${tabId}`, { accountIds: [bobs.id] })).body.code, 'INVALID_ACCOUNT');
  assert.equal((await alice.patch(`/api/tabs/${tabId}`, { rules: { match: 'all', conditions: [cond({ op: 'x' })] } })).status, 400);
  assert.equal((await alice.patch('/api/tabs/abc', { name: 'x' })).status, 400);
  assert.equal((await alice.patch('/api/tabs/0', { name: 'x' })).status, 400);
  assert.equal((await alice.patch('/api/tabs/999999', { name: 'x' })).status, 404);
  assert.equal((await alice.del('/api/tabs/-1')).status, 400);
  assert.equal((await alice.post('/api/tabs', [1, 2])).status, 400, 'array body');

  // A failed PATCH changes nothing (validation happens before any write).
  const after = (await alice.get('/api/tabs')).body.tabs.find((x) => x.id === tabId);
  assert.equal(after.name, 'x'.repeat(40));
});

test('at most 50 tabs per user', async (t) => {
  const { alice, bob } = await setup(t);
  for (let i = 0; i < 50; i++) {
    const res = await alice.post('/api/tabs', { name: `Tab ${i}` });
    assert.equal(res.status, 201);
    assert.equal(res.body.tab.position, i);
  }
  const over = await alice.post('/api/tabs', { name: 'one too many' });
  assert.equal(over.status, 400);
  assert.equal(over.body.code, 'TOO_MANY_TABS');
  // The limit is per user.
  assert.equal((await bob.post('/api/tabs', { name: 'mine' })).status, 201);
});

test('reorder tabs with PUT /api/tabs/order', async (t) => {
  const { alice, bob } = await setup(t);
  const made = [];
  for (const name of ['A', 'B', 'C']) made.push((await alice.post('/api/tabs', { name })).body.tab.id);
  const bobTab = (await bob.post('/api/tabs', { name: 'Bob' })).body.tab.id;
  const [a, b, c] = made;

  const bad = async (ids) => {
    const res = await alice.put('/api/tabs/order', { ids });
    assert.equal(res.status, 400, JSON.stringify(ids));
  };
  await bad([a, b]); // missing one
  await bad([a, b, c, c]); // duplicate
  await bad([a, b, b]); // duplicate instead of one
  await bad([a, b, bobTab]); // someone else's
  await bad([a, b, c, bobTab]);
  await bad('a,b,c');
  await bad([a, b, 'x']);
  assert.equal((await alice.put('/api/tabs/order', {})).status, 400);

  const ok = await alice.put('/api/tabs/order', { ids: [c, a, b] });
  assert.deepEqual(ok.body, { ok: true });
  const listed = (await alice.get('/api/tabs')).body.tabs;
  assert.deepEqual(listed.map((x) => x.name), ['C', 'A', 'B']);
  assert.deepEqual(listed.map((x) => x.position), [0, 1, 2]);

  // New tabs go after the last one.
  const d = await alice.post('/api/tabs', { name: 'D' });
  assert.equal(d.body.tab.position, 3);
  // Bob's tab is untouched.
  assert.equal((await bob.get('/api/tabs')).body.tabs[0].position, 0);
});

test('users cannot see or change each other\'s tabs', async (t) => {
  const { srv, alice, bob, aliceUser } = await setup(t);
  const acct = seedAccount(srv.db, srv.crypto, aliceUser.id);
  seedMessage(srv.db, acct.id, { is_read: 0 });
  const tab = (await alice.post('/api/tabs', { name: 'Secret', accountIds: [acct.id] })).body.tab;

  const bobList = await bob.get('/api/tabs');
  assert.deepEqual(bobList.body, { tabs: [], all: { unreadCount: 0, totalCount: 0 } });
  assert.equal((await bob.patch(`/api/tabs/${tab.id}`, { name: 'pwned' })).status, 404);
  assert.equal((await bob.del(`/api/tabs/${tab.id}`)).status, 404);
  assert.equal((await bob.put('/api/tabs/order', { ids: [tab.id] })).status, 400);
  // Bob cannot attach Alice's account to his own tab.
  assert.equal((await bob.post('/api/tabs', { name: 'Mine', accountIds: [acct.id] })).body.code, 'INVALID_ACCOUNT');
  // Bob cannot list Alice's tab's messages.
  assert.equal((await bob.get(`/api/messages?tab=${tab.id}`)).status, 404);

  const still = (await alice.get('/api/tabs')).body.tabs[0];
  assert.equal(still.name, 'Secret');
  assert.equal(still.unreadCount, 1);
});
