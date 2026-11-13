'use strict';

// Unit tests for src/queries.js against an in-memory database (no HTTP, no IMAP).

const test = require('node:test');
const assert = require('node:assert/strict');

const { openDb } = require('../src/db');
const { createCrypto } = require('../src/crypto');
const { HttpError } = require('../src/errors');
const queries = require('../src/queries');
const { seedAccount, seedMessage, seedFolder, TEST_SECRET_KEY } = require('./helpers');

const crypto = createCrypto(TEST_SECRET_KEY);

function setup() {
  const db = openDb(':memory:');
  const addUser = (email) =>
    Number(db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)').run(email, null, 'x', Date.now()).lastInsertRowid);
  const addTab = (userId, { name = 'Tab', allAccounts = false, rules = null, accountIds = [], position = 0 } = {}) => {
    const id = Number(
      db
        .prepare('INSERT INTO tabs (user_id, name, color, position, all_accounts, rules, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(userId, name, '#4f46e5', position, allAccounts ? 1 : 0, rules === null ? null : typeof rules === 'string' ? rules : JSON.stringify(rules), Date.now())
        .lastInsertRowid
    );
    for (const a of accountIds) db.prepare('INSERT INTO tab_accounts (tab_id, account_id) VALUES (?, ?)').run(id, a);
    return db.prepare('SELECT * FROM tabs WHERE id = ?').get(id);
  };
  return { db, addUser, addTab };
}

const ids = (page) => page.messages.map((m) => m.id);
const subjects = (page) => page.messages.map((m) => m.subject).sort();

test('All inboxes and tabs only ever show the user\'s own mail', () => {
  const { db, addUser, addTab } = setup();
  const alice = addUser('alice@example.com');
  const mallory = addUser('mallory@example.com');
  const work = seedAccount(db, crypto, alice, { email: 'work@corp.com' });
  const home = seedAccount(db, crypto, alice, { email: 'me@home.com' });
  const evil = seedAccount(db, crypto, mallory, { email: 'evil@x.com' });
  const w = seedMessage(db, work.id, { subject: 'work mail' });
  const h = seedMessage(db, home.id, { subject: 'home mail' });
  const e = seedMessage(db, evil.id, { subject: 'mallory mail' });

  assert.deepEqual(subjects(queries.listMessages(db, alice, { tabId: 'all' })), ['home mail', 'work mail']);
  assert.deepEqual(subjects(queries.listMessages(db, mallory, { tabId: 'all' })), ['mallory mail']);

  const workTab = addTab(alice, { name: 'Work', accountIds: [work.id] });
  assert.deepEqual(subjects(queries.listMessages(db, alice, { tabId: workTab.id })), ['work mail']);

  // A tab row that somehow references another user's account still shows nothing of theirs.
  db.prepare('INSERT INTO tab_accounts (tab_id, account_id) VALUES (?, ?)').run(workTab.id, evil.id);
  assert.deepEqual(subjects(queries.listMessages(db, alice, { tabId: workTab.id })), ['work mail']);

  // Mallory cannot read Alice's tab.
  assert.throws(() => queries.listMessages(db, mallory, { tabId: workTab.id }), (err) => err instanceof HttpError && err.status === 404);
  assert.equal(queries.tabFilterSql(db, mallory, workTab).where, '0');

  // Ownership check on single messages.
  assert.equal(queries.getMessageForUser(db, alice, e.id), null);
  assert.equal(queries.getMessageForUser(db, mallory, w.id), null);
  assert.equal(queries.getMessageForUser(db, alice, h.id).id, h.id);
  assert.equal(queries.getMessageForUser(db, alice, 'nope'), null);
  assert.deepEqual(queries.getMessagesForUser(db, mallory, [w.id, h.id, e.id]).map((r) => r.id), [e.id]);

  // An account filter for someone else's account matches nothing.
  assert.deepEqual(ids(queries.listMessages(db, alice, { tabId: 'all', accountId: evil.id })), []);
  assert.deepEqual(ids(queries.listMessages(db, alice, { tabId: 'all', accountId: home.id })), [h.id]);
});

test('tab membership: all accounts, chosen accounts, and no accounts', () => {
  const { db, addUser, addTab } = setup();
  const u = addUser('u@example.com');
  const a1 = seedAccount(db, crypto, u);
  const a2 = seedAccount(db, crypto, u);
  seedMessage(db, a1.id, { subject: 'one' });
  seedMessage(db, a2.id, { subject: 'two' });

  const all = addTab(u, { allAccounts: true });
  const chosen = addTab(u, { accountIds: [a2.id] });
  const empty = addTab(u, {});
  assert.deepEqual(subjects(queries.listMessages(db, u, { tabId: all.id })), ['one', 'two']);
  assert.deepEqual(subjects(queries.listMessages(db, u, { tabId: chosen.id })), ['two']);
  assert.deepEqual(subjects(queries.listMessages(db, u, { tabId: empty.id })), []);
  assert.deepEqual(queries.countForTab(db, u, empty), { unreadCount: 0, totalCount: 0 });

  // A rules-only tab with no accounts still shows nothing (accounts come first).
  const rulesOnly = addTab(u, { rules: { match: 'all', conditions: [{ field: 'subject', op: 'contains', value: 'o' }] } });
  assert.deepEqual(subjects(queries.listMessages(db, u, { tabId: rulesOnly.id })), []);
});

test('rules: fields, case-insensitivity, all/any', () => {
  const { db, addUser, addTab } = setup();
  const u = addUser('u@example.com');
  const acc = seedAccount(db, crypto, u);
  seedMessage(db, acc.id, { subject: 'Your Receipt #123', from_name: 'Shop', from_address: 'billing@shop.com', to: [{ name: 'Me', address: 'me@home.com' }] });
  seedMessage(db, acc.id, { subject: 'Team lunch', from_name: 'Boss Person', from_address: 'boss@corp.com', to: [{ name: '', address: 'team@corp.com' }], cc: [{ name: 'Receipts Box', address: 'receipts@home.com' }] });
  seedMessage(db, acc.id, { subject: 'Newsletter', from_name: null, from_address: 'news@list.com', snippet: 'weekly digest', text_body: 'Read our RECEIPT policy' });

  const tab = (rules) => addTab(u, { allAccounts: true, rules });
  const run = (rules) => subjects(queries.listMessages(db, u, { tabId: tab(rules).id }));
  const c = (field, op, value) => ({ field, op, value });

  assert.deepEqual(run({ match: 'all', conditions: [c('subject', 'contains', 'receipt')] }), ['Your Receipt #123']);
  assert.deepEqual(run({ match: 'all', conditions: [c('from', 'contains', 'BOSS')] }), ['Team lunch'], 'from name, case-insensitive');
  assert.deepEqual(run({ match: 'all', conditions: [c('from', 'contains', 'shop.com')] }), ['Your Receipt #123'], 'from address');
  assert.deepEqual(run({ match: 'all', conditions: [c('to', 'contains', 'me@home')] }), ['Your Receipt #123']);
  assert.deepEqual(run({ match: 'all', conditions: [c('to', 'contains', 'receipts box')] }), ['Team lunch'], 'to covers cc names');
  assert.deepEqual(run({ match: 'all', conditions: [c('body', 'contains', 'digest')] }), ['Newsletter'], 'body: snippet');
  assert.deepEqual(run({ match: 'all', conditions: [c('body', 'contains', 'receipt policy')] }), ['Newsletter'], 'body: text');
  assert.deepEqual(
    run({ match: 'any', conditions: [c('subject', 'contains', 'receipt'), c('body', 'contains', 'receipt')] }),
    ['Newsletter', 'Your Receipt #123']
  );
  assert.deepEqual(run({ match: 'all', conditions: [c('subject', 'contains', 'receipt'), c('from', 'contains', 'boss')] }), []);
  assert.deepEqual(run({ match: 'all', conditions: [] }), ['Newsletter', 'Team lunch', 'Your Receipt #123'], 'empty conditions = no filter');

  // JSON keys of the stored recipient list are not searchable text.
  assert.deepEqual(run({ match: 'all', conditions: [c('to', 'contains', 'address')] }), []);
  assert.deepEqual(run({ match: 'all', conditions: [c('to', 'contains', '"name"')] }), []);
});

test('rules: LIKE wildcards and backslashes are matched literally', () => {
  const { db, addUser, addTab } = setup();
  const u = addUser('u@example.com');
  const acc = seedAccount(db, crypto, u);
  seedMessage(db, acc.id, { subject: '50% off today' });
  seedMessage(db, acc.id, { subject: '50 percent off' });
  seedMessage(db, acc.id, { subject: 'file_name.txt' });
  seedMessage(db, acc.id, { subject: 'filename.txt' });
  seedMessage(db, acc.id, { subject: 'C:\\path\\to' });
  seedMessage(db, acc.id, { subject: 'Say "hi"', to: [{ name: 'Quote "Q" Person', address: 'q@x.com' }] });

  const run = (field, value, op = 'contains') =>
    subjects(queries.listMessages(db, u, { tabId: addTab(u, { allAccounts: true, rules: { match: 'all', conditions: [{ field, op, value }] } }).id }));
  assert.deepEqual(run('subject', '50%'), ['50% off today']);
  assert.deepEqual(run('subject', '%'), ['50% off today']);
  assert.deepEqual(run('subject', 'file_name'), ['file_name.txt']);
  assert.deepEqual(run('subject', '_'), ['file_name.txt']);
  assert.deepEqual(run('subject', '\\path'), ['C:\\path\\to']);
  assert.deepEqual(run('subject', '\\'), ['C:\\path\\to']);
  assert.deepEqual(run('subject', '"hi"'), ['Say "hi"']);
  assert.deepEqual(run('to', '"Q"'), ['Say "hi"'], 'quotes inside JSON-stored names');
  assert.equal(queries.escapeLike('a%b_c\\d'), 'a\\%b\\_c\\\\d');
});

test('rules: not_contains treats missing values as "does not contain"', () => {
  const { db, addUser, addTab } = setup();
  const u = addUser('u@example.com');
  const acc = seedAccount(db, crypto, u);
  seedMessage(db, acc.id, { subject: null, from_name: null, from_address: null, snippet: null, text_body: null, to_json: null, cc_json: null });
  seedMessage(db, acc.id, { subject: 'Promo inside', from_name: 'Ads', from_address: 'ads@x.com' });
  seedMessage(db, acc.id, { subject: 'Hello', from_name: 'Friend', from_address: 'friend@x.com', to_json: 'not json' });

  const tab = (match, conditions) => addTab(u, { allAccounts: true, rules: { match, conditions } });
  const count = (t) => queries.countForTab(db, u, t).totalCount;
  const c = (field, op, value) => ({ field, op, value });

  assert.equal(count(tab('all', [c('subject', 'not_contains', 'promo')])), 2, 'NULL subject counts as not containing');
  assert.equal(count(tab('all', [c('subject', 'contains', 'promo')])), 1);
  assert.equal(count(tab('all', [c('from', 'not_contains', 'ads')])), 2);
  assert.equal(count(tab('all', [c('to', 'not_contains', 'someone')])), 3, 'NULL and malformed recipient JSON never error');
  assert.equal(count(tab('all', [c('body', 'not_contains', 'seeded')])), 1, 'only the message with no body at all');
  // NOT inside OR: a NULL must not swallow the other branch.
  assert.equal(count(tab('any', [c('subject', 'not_contains', 'promo'), c('from', 'contains', 'zzz')])), 2);
});

test('parseRules tolerates junk stored in the database', () => {
  assert.equal(queries.parseRules(null), null);
  assert.equal(queries.parseRules('{oops'), null);
  assert.equal(queries.parseRules('{"match":"all","conditions":"x"}'), null);
  assert.equal(queries.parseRules({ match: 'all', conditions: [{ field: 'nope', op: 'contains', value: 'x' }] }), null);
  assert.deepEqual(queries.parseRules({ match: 'weird', conditions: [{ field: 'subject', op: 'contains', value: ' x ' }] }), {
    match: 'all',
    conditions: [{ field: 'subject', op: 'contains', value: 'x' }],
  });

  const { db, addUser, addTab } = setup();
  const u = addUser('u@example.com');
  const acc = seedAccount(db, crypto, u);
  seedMessage(db, acc.id);
  const broken = addTab(u, { allAccounts: true, rules: '{not valid json' });
  assert.equal(queries.listMessages(db, u, { tabId: broken.id }).messages.length, 1);
  assert.equal(queries.toTabJson(broken).rules, null);
});

test('search: FTS query building never throws on user input', () => {
  const { db, addUser } = setup();
  const u = addUser('u@example.com');
  const other = addUser('o@example.com');
  const acc = seedAccount(db, crypto, u);
  const otherAcc = seedAccount(db, crypto, other);
  seedMessage(db, acc.id, { subject: 'Quarterly invoice (March)', from_name: 'Zoë Accounting', text_body: 'Pay by Friday. C++ rocks.' });
  seedMessage(db, acc.id, { subject: 'Café meetup', from_name: 'Bob', text_body: '日本語のメール and AND keyword' });
  seedMessage(db, acc.id, { subject: 'Holiday photos', from_name: 'Mum', snippet: 'see attached' });
  seedMessage(db, otherAcc.id, { subject: 'Quarterly invoice for someone else' });

  const search = (q) => subjects(queries.listMessages(db, u, { tabId: 'all', q }));

  assert.deepEqual(search('invoice'), ['Quarterly invoice (March)']);
  assert.deepEqual(search('INVO'), ['Quarterly invoice (March)'], 'prefix + case-insensitive');
  assert.deepEqual(search('quarterly march'), ['Quarterly invoice (March)'], 'terms are ANDed');
  assert.deepEqual(search('quarterly holiday'), []);
  assert.deepEqual(search('zoe'), ['Quarterly invoice (March)'], 'diacritics removed');
  assert.deepEqual(search('cafe'), ['Café meetup']);
  assert.deepEqual(search('café'), ['Café meetup']);
  assert.deepEqual(search('  '), ['Café meetup', 'Holiday photos', 'Quarterly invoice (March)'], 'blank q is ignored');
  assert.deepEqual(search('AND'), ['Café meetup'], 'operators are plain words');
  assert.deepEqual(search('(march)'), ['Quarterly invoice (March)']);
  assert.deepEqual(search('"invoice'), ['Quarterly invoice (March)']);
  assert.ok(search('c++').includes('Quarterly invoice (March)'), 'c++ searches the prefix "c"');
  assert.deepEqual(search('-photos'), ['Holiday photos'], 'a leading minus is not NOT');
  assert.deepEqual(search('subject:holiday'), [], 'column filters are not interpreted');
  assert.deepEqual(search('***'), [], 'nothing searchable = no results');

  const nasty = [
    '"', '""', '"""', "'", '(', ')', '()', '((a', 'a))', 'AND', 'OR', 'NOT', 'NEAR', 'NEAR(a b)', 'a AND', 'OR b',
    '*', '**', 'a*', '*a', '-', '--', '-a', ':', 'a:', ':a', 'subject:', '^', '^a', '+', '{a b}', '[x]', 'a"b"c',
    '\u0000', 'a\u0000b', '\u202e', '🙂', '🙂🙂 x', '日本', 'ä', '\\', '\\"', 'x'.repeat(5000),
    Array.from({ length: 100 }, (_, i) => `t${i}`).join(' '),
  ];
  for (const q of nasty) {
    assert.doesNotThrow(() => queries.listMessages(db, u, { tabId: 'all', q }), `q=${JSON.stringify(q).slice(0, 40)}`);
    const built = queries.buildFtsQuery(q);
    if (built !== null) {
      assert.doesNotThrow(() => db.prepare('SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?').all(built), `fts ${built.slice(0, 40)}`);
    }
  }
  assert.equal(queries.buildFtsQuery('say "hi" now'), '"say"* """hi"""* "now"*');
  assert.equal(queries.buildFtsQuery('* - :'), null);
  assert.equal(queries.buildFtsQuery(Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ')).split(' ').length, 20);

  // Search combined with a tab, unread and starred.
  db.prepare("UPDATE messages SET is_read = 1 WHERE subject LIKE 'Holiday%'").run();
  db.prepare("UPDATE messages SET is_starred = 1 WHERE subject LIKE 'Café%'").run();
  assert.deepEqual(subjects(queries.listMessages(db, u, { tabId: 'all', unread: true })), ['Café meetup', 'Quarterly invoice (March)']);
  assert.deepEqual(subjects(queries.listMessages(db, u, { tabId: 'all', starred: true })), ['Café meetup']);
  assert.deepEqual(subjects(queries.listMessages(db, u, { tabId: 'all', q: 'photos', unread: true })), []);
});

test('cursor pagination is stable and gap-free with equal dates', () => {
  const { db, addUser } = setup();
  const u = addUser('u@example.com');
  const acc = seedAccount(db, crypto, u);
  const dates = [5000, 5000, 5000, 5000, 4000, 4000, 6000, 5000, 3000, 5000, 5000];
  const rows = dates.map((date, i) => seedMessage(db, acc.id, { date, subject: `m${i}` }));
  const expected = [...rows].sort((a, b) => b.date - a.date || b.id - a.id).map((r) => r.id);

  for (const limit of [1, 2, 3, 4, 11, 50]) {
    const seen = [];
    let before;
    let pages = 0;
    for (;;) {
      const page = queries.listMessages(db, u, { tabId: 'all', limit, before });
      seen.push(...ids(page));
      pages += 1;
      assert.ok(page.messages.length <= limit);
      if (!page.nextCursor) break;
      before = page.nextCursor;
      assert.ok(pages < 50, 'pagination terminates');
    }
    assert.deepEqual(seen, expected, `limit ${limit}`);
  }

  // Exactly `limit` rows left: no extra empty page.
  const exact = queries.listMessages(db, u, { tabId: 'all', limit: rows.length });
  assert.equal(exact.messages.length, rows.length);
  assert.equal(exact.nextCursor, null);

  // A new message arriving between pages does not shift the next page.
  const first = queries.listMessages(db, u, { tabId: 'all', limit: 3 });
  seedMessage(db, acc.id, { date: 9999, subject: 'newer' });
  const second = queries.listMessages(db, u, { tabId: 'all', limit: 3, before: first.nextCursor });
  assert.deepEqual(ids(second), expected.slice(3, 6));
});

test('limit clamping and bad cursors', () => {
  const { db, addUser } = setup();
  const u = addUser('u@example.com');
  const acc = seedAccount(db, crypto, u);
  for (let i = 0; i < 120; i++) seedMessage(db, acc.id, { date: i });

  assert.equal(queries.listMessages(db, u, { limit: 0 }).messages.length, 1);
  assert.equal(queries.listMessages(db, u, { limit: -5 }).messages.length, 1);
  assert.equal(queries.listMessages(db, u, { limit: 1000 }).messages.length, 100);
  assert.equal(queries.listMessages(db, u, { limit: 'abc' }).messages.length, 50);
  assert.equal(queries.listMessages(db, u, {}).messages.length, 50);

  const bad = [
    'not-a-cursor!',
    Buffer.from('{"a":1}').toString('base64url'),
    Buffer.from('[1]').toString('base64url'),
    Buffer.from('[1, 0]').toString('base64url'),
    Buffer.from('["1", 2]').toString('base64url'),
    Buffer.from('[1.5, 2]').toString('base64url'),
    'x'.repeat(500),
    '!!!',
  ];
  for (const before of bad) {
    assert.throws(
      () => queries.listMessages(db, u, { before }),
      (err) => err instanceof HttpError && err.status === 400 && err.code === 'INVALID_CURSOR',
      before
    );
  }
  assert.deepEqual(queries.decodeCursor(queries.encodeCursor({ date: 123, id: 4 })), [123, 4]);
});

test('counts per tab and for All inboxes', () => {
  const { db, addUser, addTab } = setup();
  const u = addUser('u@example.com');
  const other = addUser('o@example.com');
  const a1 = seedAccount(db, crypto, u);
  const a2 = seedAccount(db, crypto, u);
  const ao = seedAccount(db, crypto, other);
  seedMessage(db, a1.id, { is_read: 0, subject: 'invoice 1' });
  seedMessage(db, a1.id, { is_read: 1, subject: 'invoice 2' });
  seedMessage(db, a2.id, { is_read: 0, subject: 'hello' });
  seedMessage(db, ao.id, { is_read: 0 });

  assert.deepEqual(queries.countForTab(db, u, null), { unreadCount: 2, totalCount: 3 });
  assert.deepEqual(queries.countForTab(db, other, null), { unreadCount: 1, totalCount: 1 });
  const t1 = addTab(u, { accountIds: [a1.id] });
  assert.deepEqual(queries.countForTab(db, u, t1), { unreadCount: 1, totalCount: 2 });
  const rules = addTab(u, { allAccounts: true, rules: { match: 'all', conditions: [{ field: 'subject', op: 'contains', value: 'invoice' }] } });
  assert.deepEqual(queries.countForTab(db, u, rules), { unreadCount: 1, totalCount: 2 });

  const listed = queries.listTabsJson(db, u);
  assert.deepEqual(listed.all, { unreadCount: 2, totalCount: 3 });
  assert.deepEqual(
    listed.tabs.map((t) => [t.id, t.unreadCount, t.totalCount]),
    [
      [t1.id, 1, 2],
      [rules.id, 1, 2],
    ]
  );
  assert.deepEqual(listed.tabs[0].accountIds, [a1.id]);

  // mark-all-read helper selects exactly the tab's unread messages.
  assert.deepEqual(
    queries.selectTabMessageRefs(db, u, rules, { unread: true }).map((r) => r.account_id),
    [a1.id]
  );
});

test('JSON mappers: shapes, and secrets never appear', () => {
  const { db, addUser, addTab } = setup();
  const u = addUser('u@example.com');
  const acc = seedAccount(db, crypto, u, { secret: { password: 'hunter2-SECRET' }, display_name: 'Work', status: 'error', last_error: 'boom' });
  const tab = addTab(u, { accountIds: [acc.id] });
  const msg = seedMessage(db, acc.id, {
    is_read: 1,
    to: [{ name: 'A', address: 'a@x.com' }],
    attachments: [
      { index: 0, filename: 'logo.png', contentType: 'image/png', size: 10, cid: 'logo', inline: true },
      { index: 1, filename: 'report.pdf', contentType: 'application/pdf', size: 99, cid: null, inline: false },
    ],
    html_body: '<p>hi</p>',
    remote_image_count: 2,
  });

  const json = queries.getAccountJson(db, u, acc.id);
  assert.deepEqual(Object.keys(json).sort(), [
    'authType', 'canSend', 'color', 'createdAt', 'displayName', 'email', 'hasSmtpPassword', 'id', 'imapHost', 'imapPort',
    'imapSecurity', 'imapUser', 'lastError', 'lastSyncedAt', 'messageCount', 'provider', 'sendBlockedReason', 'senderName',
    'signatureHtml', 'smtpHost', 'smtpPort', 'smtpSecurity', 'smtpUser', 'status', 'tabIds', 'unreadCount',
  ]);
  assert.equal(json.messageCount, 1);
  assert.equal(json.unreadCount, 0);
  assert.deepEqual(json.tabIds, [tab.id]);
  const text = JSON.stringify(queries.listAccountsJson(db, u));
  assert.ok(!text.includes('hunter2'));
  assert.ok(!text.includes(acc.secret_enc));
  assert.ok(!/secret/i.test(text));
  assert.equal(queries.getAccountJson(db, u + 999, acc.id), null);

  const detail = queries.toMessageDetail(db.prepare('SELECT * FROM messages WHERE id = ?').get(msg.id));
  assert.equal(detail.isRead, true);
  assert.equal(detail.hasHtml, true);
  assert.equal(detail.remoteImageCount, 2);
  assert.deepEqual(detail.to, [{ name: 'A', address: 'a@x.com' }]);
  assert.deepEqual(detail.attachments[1], { index: 1, filename: 'report.pdf', contentType: 'application/pdf', size: 99, inline: false });
  assert.equal('html_body' in detail || 'htmlBody' in detail || 'textBody' in detail, false, 'no body content in detail JSON');
  assert.deepEqual(Object.keys(queries.toMessageListItem(msg)).sort(), [
    'accountId', 'date', 'folderId', 'fromAddress', 'fromName', 'hasAttachments', 'id', 'isAnswered', 'isDraft', 'isRead',
    'isStarred', 'snippet', 'subject', 'threadKey', 'to', 'toCount',
  ]);
  // Sent / Drafts rows name their recipients: the first few, plus how many there are.
  const many = Array.from({ length: 14 }, (_, i) => ({ name: `P${i}`, address: `p${i}@x.com` }));
  const item = queries.toMessageListItem({ ...msg, to_json: JSON.stringify(many) });
  assert.equal(item.to.length, 10);
  assert.deepEqual(item.to[0], { name: 'P0', address: 'p0@x.com' });
  assert.equal(item.toCount, 14);
  assert.deepEqual(queries.toMessageListItem({ ...msg, to_json: 'not json' }).to, []);
});

test('validate helpers', () => {
  const { validate } = queries;
  assert.equal(validate.requireId('12'), 12);
  assert.equal(validate.requireId(7), 7);
  for (const bad of [0, -1, 1.5, '1.5', '01x', '', null, undefined, '9'.repeat(20), {}, [], true]) {
    assert.throws(() => validate.requireId(bad), (err) => err.status === 400, String(bad));
  }
  assert.deepEqual(validate.requireIdList([3, '3', 4]), [3, 4]);
  assert.throws(() => validate.requireIdList('1,2'), (err) => err.status === 400);
  assert.throws(() => validate.requireIdList(new Array(501).fill(1)), (err) => err.status === 400);
  assert.equal(validate.requireColor('#ABCDEF'), '#abcdef');
  for (const bad of ['red', '#abc', '#abcdeg', 'abcdef', '#abcdef0', 123, null]) {
    assert.throws(() => validate.requireColor(bad), (err) => err.code === 'INVALID_COLOR', String(bad));
  }
  assert.equal(validate.optionalText('  hi  ', { field: 'x', max: 5 }), 'hi');
  assert.equal(validate.optionalText('   ', { field: 'x', max: 5 }), null);
  assert.throws(() => validate.optionalText('toolong', { field: 'x', max: 5 }), (err) => err.status === 400);
  assert.throws(() => validate.optionalText(5, { field: 'x', max: 5 }), (err) => err.status === 400);
});

test("hidden folders (Exchange's Calendar, Contacts, ...) are neither listed nor resolvable", () => {
  const { db, addUser } = setup();
  const alice = addUser('alice@example.com');
  const mallory = addUser('mallory@example.com');
  const work = seedAccount(db, crypto, alice, { email: 'work@corp.com' });
  const inbox = seedFolder(db, work.id, 'INBOX');
  const archive = seedFolder(db, work.id, 'Archive', { specialUse: '\\Archive' });
  const calendar = seedFolder(db, work.id, 'Calendar', { sync_mode: 'hidden' });
  seedMessage(db, work.id, { subject: 'meeting', mailbox: 'Calendar', folder_id: calendar.id });

  const tree = queries.listFoldersJson(db, alice);
  assert.equal(tree.accounts.length, 1);
  assert.deepEqual(tree.accounts[0].folders.map((f) => f.id).sort(), [inbox.id, archive.id].sort());

  assert.equal(queries.resolveFolder(db, alice, archive.id).id, archive.id);
  const notFound = (err) => err instanceof HttpError && err.status === 404 && err.code === 'NOT_FOUND';
  assert.throws(() => queries.resolveFolder(db, alice, calendar.id), notFound);
  assert.throws(() => queries.resolveFolder(db, mallory, archive.id), notFound, "another user's folder");
  assert.throws(() => queries.listMessages(db, alice, { folderId: calendar.id }), notFound);
  assert.deepEqual(queries.listFoldersJson(db, mallory), { accounts: [] });
});
