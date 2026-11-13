'use strict';

// FOLDERS engine — pure tests (no IMAP server): folder classification and bookkeeping,
// change detection, thread keys, special-folder resolution and action input checks.

const test = require('node:test');
const assert = require('node:assert/strict');

const folders = require('../src/folders');
const { folderChanged, parseState, SyncManager } = require('../src/sync');
const { parseMessageIdList, normalizeMessageId, threadKeyFor, parseRawMessage } = require('../src/mailparse');
const imap = require('../src/imap');
const actions = require('../src/actions');
const { HttpError } = require('../src/errors');
const h = require('./engine-helpers');

const entry = (path, { flags = [], specialUse, specialUseSource, delimiter = '/', status } = {}) => {
  const parts = path.split(delimiter);
  return {
    path,
    name: parts[parts.length - 1],
    delimiter,
    parentPath: parts.slice(0, -1).join(delimiter),
    flags: new Set(flags),
    specialUse,
    specialUseSource,
    status,
  };
};

const DOVECOT_LIST = [
  entry('INBOX', { specialUse: '\\Inbox', specialUseSource: 'name', status: { messages: 3, unseen: 1 } }),
  entry('Sent', { flags: ['\\Sent'], specialUse: '\\Sent', specialUseSource: 'extension', status: { messages: 2, unseen: 0 } }),
  entry('Drafts', { flags: ['\\Drafts'], specialUse: '\\Drafts', specialUseSource: 'extension' }),
  entry('Archive', { flags: ['\\Archive'], specialUse: '\\Archive', specialUseSource: 'extension' }),
  entry('Junk', { flags: ['\\Junk'], specialUse: '\\Junk', specialUseSource: 'extension' }),
  entry('Trash', { flags: ['\\Trash'], specialUse: '\\Trash', specialUseSource: 'extension' }),
  entry('Work', { flags: ['\\NonExistent', '\\Noselect', '\\HasChildren'] }),
  entry('Work/Clients', { flags: ['\\HasNoChildren'] }),
];

function makeAccount() {
  const env = h.makeEngineEnv();
  const userId = h.createUser(env.db);
  const account = h.createAccount(env.db, env.crypto, userId);
  return { env, db: env.db, userId, account };
}

// ---------------------------------------------------------------------------------------------
// classifyFolder
// ---------------------------------------------------------------------------------------------

test('classifyFolder: INBOX, server flags, names, containers, display names', () => {
  const c = (e, opts) => folders.classifyFolder(e, opts);
  assert.deepEqual(c(entry('INBOX')), {
    path: 'INBOX',
    name: 'Inbox',
    delimiter: '/',
    parentPath: null,
    specialUse: '\\Inbox',
    selectable: true,
    syncMode: 'auto',
    specialUseSource: 'server',
  });
  assert.equal(c(entry('Sent', { flags: ['\\Sent'], specialUse: '\\Sent', specialUseSource: 'extension' })).specialUse, '\\Sent');
  // Flags imapflow does not resolve (or gave to another folder) still count.
  assert.equal(c(entry('Old Sent', { flags: ['\\Sent'] })).specialUse, '\\Sent');
  assert.equal(c(entry('[Gmail]/Important', { flags: ['\\Important'] })).specialUse, '\\Important');
  // Well-known names (case-insensitive), also below INBOX on "INBOX.Sent" style servers.
  for (const [name, use] of [
    ['Sent Items', '\\Sent'], ['Sent Messages', '\\Sent'], ['drafts', '\\Drafts'], ['Junk E-mail', '\\Junk'], ['Junk Email', '\\Junk'],
    ['Spam', '\\Junk'], ['Bulk Mail', '\\Junk'], ['Deleted Items', '\\Trash'], ['Deleted Messages', '\\Trash'], ['Bin', '\\Trash'], ['Archive', '\\Archive'],
  ]) {
    assert.equal(c(entry(name)).specialUse, use, name);
  }
  assert.equal(c(entry('INBOX.Trash', { delimiter: '.' })).specialUse, '\\Trash');
  assert.equal(c(entry('INBOX.Trash', { delimiter: '.' })).parentPath, 'INBOX');
  // ...but a user's nested folder named like one is just a folder.
  assert.equal(c(entry('Clients/Archive')).specialUse, null);
  assert.equal(c(entry('Clients/Archive', { specialUse: '\\Archive', specialUseSource: 'name' })).specialUse, null);
  // Containers.
  const work = c(entry('Work', { flags: ['\\NonExistent', '\\HasChildren'] }));
  assert.equal(work.selectable, false);
  assert.equal(c(entry('Old', { flags: ['\\Noselect'] })).selectable, false);
  const nested = c(entry('Work/Clients/ACME'));
  assert.equal(nested.name, 'ACME');
  assert.equal(nested.parentPath, 'Work/Clients');
  assert.equal(c(entry('Flat', { delimiter: null })).parentPath, null);
});

test('classifyFolder: on-demand folders (\\All, \\Flagged, \\Important, Gmail views; Gmail Starred is synced)', () => {
  const c = (e, opts) => folders.classifyFolder(e, opts);
  const gmail = { isGmail: true };
  assert.equal(c(entry('[Gmail]/All Mail', { flags: ['\\All'], specialUse: '\\All', specialUseSource: 'extension' }), gmail).syncMode, 'on_demand');
  // Gmail's Starred backs the Starred view (starred mail that was archived lives nowhere else).
  assert.equal(c(entry('[Gmail]/Starred', { flags: ['\\Flagged'], specialUse: '\\Flagged', specialUseSource: 'extension' }), gmail).syncMode, 'auto');
  assert.equal(c(entry('Flagged', { flags: ['\\Flagged'], specialUse: '\\Flagged', specialUseSource: 'extension' })).syncMode, 'on_demand', 'other servers\' virtual Flagged');
  assert.equal(c(entry('[Gmail]/Important', { flags: ['\\Important'] }), gmail).syncMode, 'on_demand');
  assert.equal(c(entry('[Gmail]/Scheduled'), gmail).syncMode, 'on_demand', 'other [Gmail] views');
  assert.equal(c(entry('[Google Mail]/Bin', { flags: ['\\Trash'], specialUse: '\\Trash', specialUseSource: 'extension' }), gmail).syncMode, 'auto');
  for (const [path, use] of [['[Gmail]/Sent Mail', '\\Sent'], ['[Gmail]/Drafts', '\\Drafts'], ['[Gmail]/Spam', '\\Junk'], ['[Gmail]/Trash', '\\Trash']]) {
    const f = c(entry(path, { flags: [use], specialUse: use, specialUseSource: 'extension' }), gmail);
    assert.equal(f.specialUse, use);
    assert.equal(f.syncMode, 'auto', path);
  }
  assert.equal(c(entry('Work'), gmail).syncMode, 'auto', 'Gmail labels are ordinary folders');
  assert.equal(c(entry('Archive'), gmail).specialUse, null, 'a Gmail label named Archive is just a label');
  assert.equal(c(entry('Spam', { specialUse: '\\Junk', specialUseSource: 'name' }), gmail).specialUse, null);
  assert.equal(c(entry('[Gmail]/Scheduled')).syncMode, 'auto', 'only on Gmail');
  assert.equal(c(entry('Everything', { flags: ['\\All'] })).syncMode, 'on_demand');
});

// ---------------------------------------------------------------------------------------------
// upsertFolders and friends
// ---------------------------------------------------------------------------------------------

test('upsertFolders adds, updates and removes folders; messages of removed folders go too', (t) => {
  const { env, db, account } = makeAccount();
  t.after(() => env.close());
  assert.deepEqual(folders.upsertFolders(db, account.id, DOVECOT_LIST), { added: 8, removed: 0, changed: 0 });
  const rows = db.prepare('SELECT * FROM folders WHERE account_id = ? ORDER BY id').all(account.id);
  assert.deepEqual(rows.map((r) => [r.path, r.name, r.special_use, r.selectable, r.parent_path, r.sync_mode]), [
    ['INBOX', 'Inbox', '\\Inbox', 1, null, 'auto'],
    ['Sent', 'Sent', '\\Sent', 1, null, 'auto'],
    ['Drafts', 'Drafts', '\\Drafts', 1, null, 'auto'],
    ['Archive', 'Archive', '\\Archive', 1, null, 'auto'],
    ['Junk', 'Junk', '\\Junk', 1, null, 'auto'],
    ['Trash', 'Trash', '\\Trash', 1, null, 'auto'],
    ['Work', 'Work', null, 0, null, 'auto'],
    ['Work/Clients', 'Clients', null, 1, 'Work', 'auto'],
  ]);
  const inbox = rows[0];
  assert.equal(inbox.total_count, 3);
  assert.equal(inbox.unread_count, 1);
  assert.equal(rows[1].total_count, 2);

  // Same listing again: nothing to do (ids kept).
  assert.deepEqual(folders.upsertFolders(db, account.id, DOVECOT_LIST), { added: 0, removed: 0, changed: 0 });

  // Messages in Work/Clients, then the folder disappears from the server.
  const clients = rows.find((r) => r.path === 'Work/Clients');
  db.prepare("INSERT INTO messages (account_id, folder_id, mailbox, uid, uid_validity, date, created_at) VALUES (?, ?, 'Work/Clients', 1, 1, 1, 1)").run(account.id, clients.id);
  const without = DOVECOT_LIST.filter((e) => !e.path.startsWith('Work'));
  // The Junk folder is no longer flagged: its special use is dropped (changed).
  without[4] = entry('Junk');
  const result = folders.upsertFolders(db, account.id, without);
  assert.equal(result.removed, 2);
  assert.equal(result.changed, 0, 'still \\Junk by its name');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(account.id).n, 0, 'messages cascade');
  assert.equal(folders.getFolder(db, clients.id), undefined);

  // A folder moving in the hierarchy / becoming selectable is an update.
  const moved = [...without, entry('Work', { flags: [] })];
  assert.equal(folders.upsertFolders(db, account.id, moved).added, 1);
  const again = moved.map((e) => (e.path === 'Work' ? entry('Work', { flags: ['\\Noselect'] }) : e));
  assert.equal(folders.upsertFolders(db, account.id, again).changed, 1);
});

test('upsertFolders: a listing without INBOX removes nothing; name guesses never duplicate a server flag', (t) => {
  const { env, db, account } = makeAccount();
  t.after(() => env.close());
  folders.upsertFolders(db, account.id, DOVECOT_LIST);
  const partial = folders.upsertFolders(db, account.id, [entry('Sent', { flags: ['\\Sent'] })]);
  assert.equal(partial.removed, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM folders WHERE account_id = ?').get(account.id).n, 8);
  assert.equal(folders.upsertFolders(db, account.id, []).removed, 0);

  // "Sent Items" by name alongside a server-flagged Sent; two Trash guesses -> one wins.
  const list = [entry('INBOX'), entry('Sent', { flags: ['\\Sent'] }), entry('Sent Items'), entry('Trash'), entry('Deleted Items'), entry('Spam')];
  folders.upsertFolders(db, account.id, list);
  const use = (path) => folders.folderJson(db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(account.id, path)).specialUse;
  assert.equal(use('Sent'), '\\Sent');
  assert.equal(use('Sent Items'), null);
  assert.equal(use('Deleted Items'), '\\Trash', 'alphabetically first of the guesses');
  assert.equal(use('Trash'), null);
  assert.equal(use('Spam'), '\\Junk');
});

test('upsertFolders ignores junk input and caps the number of folders', (t) => {
  const { env, db, account } = makeAccount();
  t.after(() => env.close());
  const many = [entry('INBOX')];
  for (let i = 0; i < folders.MAX_FOLDERS_PER_ACCOUNT + 50; i++) many.push(entry(`F${i}`));
  many.push(null, { path: '' }, { path: 'x'.repeat(2000) }, entry('INBOX'));
  folders.upsertFolders(db, account.id, many);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM folders WHERE account_id = ?').get(account.id).n, folders.MAX_FOLDERS_PER_ACCOUNT);
});

test('getFolder / folderForUser / findSpecialFolder / inboxFolder / folderJson / sortFolders', (t) => {
  const { env, db, userId, account } = makeAccount();
  t.after(() => env.close());
  const otherUser = h.createUser(db);

  // Accounts start without folder rows; inboxFolder creates the INBOX one.
  const inbox = folders.inboxFolder(db, account.id);
  assert.equal(inbox.path, 'INBOX');
  assert.equal(inbox.special_use, '\\Inbox');
  assert.equal(folders.inboxFolder(db, account.id).id, inbox.id, 'idempotent');
  assert.equal(folders.inboxFolder(db, 987654), null);

  folders.upsertFolders(db, account.id, [...DOVECOT_LIST, entry('Old/Trash', { flags: ['\\Trash'] })]);
  assert.equal(folders.getFolder(db, inbox.id).id, inbox.id, 'INBOX row reused by the listing');
  assert.equal(folders.getFolder(db, 'abc'), undefined);
  assert.equal(folders.findSpecialFolder(db, account.id, '\\trash').path, 'Trash', 'shallowest first, case-insensitive use');
  assert.equal(folders.findSpecialFolder(db, account.id, '\\All'), null);
  assert.equal(folders.findSpecialFolder(db, account.id, 'bogus'), null);

  const sent = folders.findSpecialFolder(db, account.id, '\\Sent');
  const own = folders.folderForUser(db, userId, sent.id);
  assert.equal(own.id, sent.id);
  assert.equal(own.user_id, userId);
  assert.equal(folders.folderForUser(db, otherUser, sent.id), null, 'never another user\'s folder');
  assert.equal(folders.folderForUser(db, userId, -1), null);

  assert.deepEqual(folders.folderJson(folders.getFolder(db, inbox.id)), {
    id: inbox.id,
    accountId: account.id,
    path: 'INBOX',
    name: 'Inbox',
    parentPath: null,
    delimiter: '/',
    specialUse: '\\Inbox',
    selectable: true,
    syncMode: 'auto',
    totalCount: 3,
    unreadCount: 1,
    hasOlder: false,
    lastSyncedAt: null,
  });
  assert.equal(folders.folderJson(folders.getFolder(db, inbox.id), { unreadLocal: 7 }).unreadCount, 7);

  const order = folders.sortFolders(db.prepare('SELECT * FROM folders WHERE account_id = ?').all(account.id)).map((r) => r.path);
  assert.deepEqual(order.slice(0, 6), ['INBOX', 'Drafts', 'Sent', 'Archive', 'Junk', 'Trash']);
  assert.deepEqual(order.slice(6), ['Old/Trash', 'Work', 'Work/Clients'], 'a second Trash right after the main one');
});

test('renameFolderLocal moves a subtree (paths, names, parents, messages.mailbox); removeFolderLocal drops one', (t) => {
  const { env, db, account } = makeAccount();
  t.after(() => env.close());
  folders.upsertFolders(db, account.id, [...DOVECOT_LIST, entry('Work/Clients/ACME'), entry('Workshop')]);
  const byPath = (p) => db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(account.id, p);
  const ids = { work: byPath('Work').id, clients: byPath('Work/Clients').id, acme: byPath('Work/Clients/ACME').id, shop: byPath('Workshop').id };
  const insert = db.prepare('INSERT INTO messages (account_id, folder_id, mailbox, uid, uid_validity, date, created_at) VALUES (?, ?, ?, ?, 1, 1, 1)');
  insert.run(account.id, ids.clients, 'Work/Clients', 1);
  insert.run(account.id, ids.acme, 'Work/Clients/ACME', 1);
  insert.run(account.id, ids.shop, 'Workshop', 1);
  // A stale local row where the subtree is going (the server just said nothing is there).
  db.prepare("INSERT INTO folders (account_id, path, name, created_at) VALUES (?, 'Projects/Clients', 'Clients', 1)").run(account.id);

  assert.equal(folders.renameFolderLocal(db, account.id, 'Work', 'Projects'), 3);
  assert.equal(byPath('Work'), undefined);
  assert.equal(byPath('Projects').id, ids.work);
  assert.deepEqual([byPath('Projects/Clients').id, byPath('Projects/Clients').name, byPath('Projects/Clients').parent_path], [ids.clients, 'Clients', 'Projects']);
  assert.equal(byPath('Projects/Clients/ACME').parent_path, 'Projects/Clients');
  assert.equal(byPath('Workshop').id, ids.shop, 'a sibling with the same prefix is untouched');
  const mailboxes = db.prepare('SELECT folder_id, mailbox FROM messages WHERE account_id = ? ORDER BY folder_id').all(account.id);
  assert.deepEqual(mailboxes, [
    { folder_id: ids.clients, mailbox: 'Projects/Clients' },
    { folder_id: ids.acme, mailbox: 'Projects/Clients/ACME' },
    { folder_id: ids.shop, mailbox: 'Workshop' },
  ]);

  // Moving one level up and renaming at once.
  assert.equal(folders.renameFolderLocal(db, account.id, 'Projects/Clients/ACME', 'ACME Corp'), 1);
  assert.deepEqual([byPath('ACME Corp').name, byPath('ACME Corp').parent_path], ['ACME Corp', null]);
  assert.equal(folders.renameFolderLocal(db, account.id, 'Nope', 'Other'), 0);

  assert.equal(folders.removeFolderLocal(db, account.id, 'Projects'), 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(account.id).n, 2, 'ACME Corp and Workshop mail left');
});

// ---------------------------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------------------------

test('folderChanged compares STATUS with the recorded state; unknown means changed', () => {
  const state = parseState(JSON.stringify({ uidValidity: 7, lastUid: 10, highestModseq: '55', uidNext: 11, messages: 9, unseen: 2, oldestUid: 3 }));
  assert.deepEqual(state, { uidValidity: 7, lastUid: 10, highestModseq: '55', uidNext: 11, messages: 9, unseen: 2, oldestUid: 3 });
  const status = { uidValidity: 7n, uidNext: 11, messages: 9, unseen: 2, highestModseq: 55n };
  assert.equal(folderChanged(state, status, Date.now()), false);
  assert.equal(folderChanged(state, { ...status, uidNext: 12 }, Date.now()), true);
  assert.equal(folderChanged(state, { ...status, messages: 8 }, Date.now()), true, 'expunged elsewhere');
  assert.equal(folderChanged(state, { ...status, highestModseq: 56n }, Date.now()), true, 'flags changed');
  assert.equal(folderChanged(state, { ...status, uidValidity: 8n }, Date.now()), true);
  assert.equal(folderChanged(state, { ...status, unseen: 1 }, Date.now()), false, 'modseq decides when there is one');
  assert.equal(folderChanged(state, null, Date.now()), true, 'no STATUS');
  assert.equal(folderChanged({}, status, Date.now()), true, 'never synced');
  assert.equal(folderChanged({ ...state, uidNext: null }, status, Date.now()), true, 'last run was cut short');

  // Without CONDSTORE: UNSEEN, and a periodic look for star changes.
  const noModseq = { uidValidity: 7n, uidNext: 11, messages: 9, unseen: 2 };
  const plain = { ...state, highestModseq: null };
  assert.equal(folderChanged(plain, noModseq, Date.now()), false);
  assert.equal(folderChanged(plain, { ...noModseq, unseen: 3 }, Date.now()), true);
  assert.equal(folderChanged(plain, noModseq, Date.now() - 16 * 60 * 1000), true);
  assert.equal(folderChanged(plain, noModseq, null), true);

  assert.deepEqual(parseState('not json'), {});
  assert.deepEqual(parseState(null), {});
  assert.equal(parseState(JSON.stringify({ uidValidity: 1, lastUid: 2, uidNext: -1, messages: 'x' })).uidNext, null);
});

// ---------------------------------------------------------------------------------------------
// Thread keys
// ---------------------------------------------------------------------------------------------

test('parseMessageIdList / normalizeMessageId / threadKeyFor', () => {
  assert.deepEqual(parseMessageIdList('<a@x> <b@x>\r\n <c@x> <a@x>'), ['<a@x>', '<b@x>', '<c@x>']);
  assert.deepEqual(parseMessageIdList(['<a@x>', ['<b@x>']]), ['<a@x>', '<b@x>']);
  assert.deepEqual(parseMessageIdList('References: <r1@x>\r\n\t<r2@x>\r\n\r\n'), ['<r1@x>', '<r2@x>']);
  assert.deepEqual(parseMessageIdList(null), []);
  assert.deepEqual(parseMessageIdList('no ids here'), []);
  const long = Array.from({ length: 150 }, (_, i) => `<m${i}@x>`).join(' ');
  const capped = parseMessageIdList(long);
  assert.equal(capped.length, 100);
  assert.equal(capped[0], '<m0@x>', 'thread root kept');
  assert.equal(capped[99], '<m149@x>', 'newest kept');

  assert.equal(normalizeMessageId('<id@x> <other@x>'), '<id@x>');
  assert.equal(normalizeMessageId('bare@x'), '<bare@x>');
  assert.equal(normalizeMessageId('has space'), null);
  assert.equal(normalizeMessageId(''), null);

  assert.equal(threadKeyFor({ gmailThreadId: '1749284719372419', references: ['<r@x>'], messageId: '<m@x>' }), 'gm:1749284719372419');
  assert.equal(threadKeyFor({ gmailThreadId: 'bad id!', references: ['<r@x>'] }), 'mid:<r@x>');
  assert.equal(threadKeyFor({ references: ['<root@x>', '<parent@x>'], inReplyTo: '<parent@x>', messageId: '<m@x>' }), 'mid:<root@x>');
  assert.equal(threadKeyFor({ references: [], inReplyTo: '<parent@x>', messageId: '<m@x>' }), 'mid:<parent@x>');
  assert.equal(threadKeyFor({ messageId: '<m@x>' }), 'mid:<m@x>');
  assert.equal(threadKeyFor({}), null);
});

test('parseRawMessage returns inReplyTo and references', async () => {
  const raw = Buffer.from(
    [
      'From: a@x',
      'To: b@x',
      'Subject: Re: hi',
      'Message-ID: <three@x>',
      'In-Reply-To: <two@x>',
      'References: <one@x>',
      '  <two@x>',
      '',
      'body',
    ].join('\r\n')
  );
  const parsed = await parseRawMessage(raw);
  assert.equal(parsed.inReplyTo, '<two@x>');
  assert.deepEqual(parsed.references, ['<one@x>', '<two@x>']);
  const plain = await parseRawMessage(Buffer.from('From: a@x\r\nSubject: x\r\n\r\nbody'));
  assert.equal(plain.inReplyTo, null);
  assert.deepEqual(plain.references, []);
});

test('Gmail detection and X-GM-THRID thread keys in stored rows', (t) => {
  assert.equal(imap.isGmail({ imap_host: 'imap.gmail.com' }), true);
  assert.equal(imap.isGmail({ imap_host: 'IMAP.GMAIL.COM' }), true);
  assert.equal(imap.isGmail({ imap_host: 'imap.example.com' }), false);
  assert.equal(imap.isGmail({ imap_host: 'mail.workspace.example' }, { capabilities: new Map([['X-GM-EXT-1', true]]) }), true);
  assert.equal(imap.isGmail(null, null), false);

  const { env, db, account } = makeAccount();
  t.after(() => env.close());
  const sync = new SyncManager({ db, crypto: env.crypto, config: env.config, logger: h.recordingLogger() });
  const folder = folders.inboxFolder(db, account.id);
  const meta = {
    uid: 5,
    flags: new Set(['\\Seen', '\\Answered', '\\Draft']),
    envelope: { messageId: '<m@x>', inReplyTo: '<p@x>', subject: 'S', from: [{ name: 'A', address: 'a@x' }] },
    internalDate: new Date(),
    size: 10,
    threadId: '1749284719372419',
  };
  const gm = sync._buildRow(account.id, folder, 9, meta, null, { isGmail: true, references: ['<root@x>'] });
  assert.equal(gm.thread_key, 'gm:1749284719372419');
  assert.equal(gm.folder_id, folder.id);
  assert.equal(gm.mailbox, 'INBOX');
  assert.equal(gm.in_reply_to, '<p@x>');
  assert.equal(gm.references_json, '["<root@x>"]');
  assert.deepEqual([gm.is_read, gm.is_answered, gm.is_draft, gm.is_starred], [1, 1, 1, 0]);
  const other = sync._buildRow(account.id, folder, 9, meta, null, { isGmail: false, references: ['<root@x>'] });
  assert.equal(other.thread_key, 'mid:<root@x>', 'a THREADID from a non-Gmail server is not used');
});

// ---------------------------------------------------------------------------------------------
// actions.js with fake clients (layouts Dovecot does not have)
// ---------------------------------------------------------------------------------------------

function fakeClient({ list = [], moveResult, readOnly = false, exists = 3 } = {}) {
  const calls = [];
  return {
    calls,
    capabilities: new Map(),
    mailbox: { path: 'INBOX', uidValidity: 77n, readOnly, exists },
    async getMailboxLock(path) {
      calls.push(['lock', path]);
      this.mailbox.path = path;
      return { release: () => calls.push(['release']) };
    },
    async list() {
      calls.push(['list']);
      return list;
    },
    async messageMove(range, dest) {
      calls.push(['move', range, dest]);
      return moveResult === undefined ? { path: this.mailbox.path, destination: dest, uidValidity: 99n, uidMap: new Map([[3, 30], [4, 40]]) } : moveResult;
    },
    async messageDelete(range, opts) {
      calls.push(['delete', range, opts]);
      return true;
    },
    async messageFlagsAdd(range, flags) {
      calls.push(['add', range, flags]);
      return true;
    },
    async messageFlagsRemove(range, flags) {
      calls.push(['remove', range, flags]);
      return true;
    },
    async append(path, raw, flags) {
      calls.push(['append', path, flags]);
      return { destination: path, uid: 12, uidValidity: 34n };
    },
  };
}

function useFakeClient(t, client) {
  const original = imap.withImap;
  imap.withImap = async (deps, account, fn) => fn(client);
  t.after(() => {
    imap.withImap = original;
  });
}

const box = (path, specialUse) => ({ path, name: path.split('/').pop(), flags: new Set(specialUse ? [specialUse] : []), specialUse, specialUseSource: specialUse ? 'extension' : undefined });
const fakeDeps = { db: null, crypto: null, config: {} };
const fakeAccount = { id: 424242 };

test('moveToSpecial: junk / inbox targets, uidMap, "already there", missing folders', async (t) => {
  const client = fakeClient({ list: [box('INBOX', '\\Inbox'), box('Spam'), box('Trash', '\\Trash')] });
  useFakeClient(t, client);
  const junk = await actions.moveToSpecial(fakeDeps, fakeAccount, 'INBOX', [4, 3], 'junk', { uidValidity: 77 });
  assert.deepEqual(junk, { destination: 'Spam', uidMap: { 3: 30, 4: 40 }, uidValidity: 99, deleted: false });
  const back = await actions.moveToSpecial(fakeDeps, fakeAccount, 'Spam', [3], 'inbox');
  assert.equal(back.destination, 'INBOX');
  assert.deepEqual(client.calls.filter((c) => c[0] === 'move').map((c) => c.slice(1)), [['3:4', 'Spam'], ['3', 'INBOX']]);

  await assert.rejects(actions.moveToSpecial(fakeDeps, fakeAccount, 'INBOX', [1], 'inbox'), (err) => err.status === 400 && err.code === 'INVALID_TARGET');
  await assert.rejects(actions.moveToSpecial(fakeDeps, fakeAccount, 'Spam', [1], 'junk'), (err) => err.code === 'INVALID_TARGET');
  await assert.rejects(actions.moveToSpecial(fakeDeps, fakeAccount, 'INBOX', [1], 'archive'), (err) => err.code === 'NO_ARCHIVE');
  await assert.rejects(actions.moveToSpecial(fakeDeps, fakeAccount, 'INBOX', [1], 'spam'), (err) => err.code === 'INVALID_TARGET');
  // Trash inside the Trash deletes for good.
  client.calls.length = 0;
  assert.deepEqual(await actions.moveToSpecial(fakeDeps, fakeAccount, 'Trash', [8], 'trash'), { destination: null, uidMap: {}, uidValidity: null, deleted: true });
  assert.deepEqual(client.calls.find((c) => c[0] === 'delete'), ['delete', '8', { uid: true }]);
  assert.deepEqual(await actions.moveToSpecial(fakeDeps, fakeAccount, 'INBOX', [], 'trash'), { destination: null, uidMap: {}, uidValidity: null, deleted: false });

  const noJunk = fakeClient({ list: [box('INBOX', '\\Inbox')] });
  imap.withImap = async (deps, account, fn) => fn(noJunk);
  await assert.rejects(actions.moveToSpecial(fakeDeps, fakeAccount, 'INBOX', [1], 'junk'), (err) => err.status === 400 && err.code === 'NO_JUNK');
});

test('moveToSpecial resolves from the folders table first and LISTs only as a fallback', async (t) => {
  const { env, db, account } = makeAccount();
  t.after(() => env.close());
  folders.upsertFolders(db, account.id, [entry('INBOX'), entry('Old Mail', { flags: ['\\Archive'] }), entry('Rubbish', { flags: ['\\Trash'] })]);
  const client = fakeClient({ list: [box('INBOX'), box('Archive', '\\Archive')] });
  useFakeClient(t, client);
  const deps = { db, crypto: env.crypto, config: env.config };
  assert.equal((await actions.moveToSpecial(deps, account, 'INBOX', [1], 'archive')).destination, 'Old Mail');
  assert.equal(client.calls.some((c) => c[0] === 'list'), false, 'no LIST needed');
  // Junk is not known locally: LIST decides (and finds nothing).
  await assert.rejects(actions.moveToSpecial(deps, account, 'INBOX', [1], 'junk'), (err) => err.code === 'NO_JUNK');
  assert.equal(client.calls.some((c) => c[0] === 'list'), true);
});

test('moveMessages returns a plain uidMap; refused moves and bad input are errors', async (t) => {
  const client = fakeClient();
  useFakeClient(t, client);
  assert.deepEqual(await actions.moveMessages(fakeDeps, fakeAccount, 'INBOX', [3, 4], 'Work/Clients', { uidValidity: 77 }), {
    destination: 'Work/Clients',
    uidMap: { 3: 30, 4: 40 },
    uidValidity: 99,
  });
  assert.deepEqual(await actions.moveMessages(fakeDeps, fakeAccount, 'INBOX', [], 'Work'), { destination: 'Work', uidMap: {}, uidValidity: null });
  await assert.rejects(actions.moveMessages(fakeDeps, fakeAccount, 'INBOX', [1], 'INBOX'), (err) => err.code === 'INVALID_TARGET');
  await assert.rejects(actions.moveMessages(fakeDeps, fakeAccount, 'INBOX', [1], 'bad\r\nname'), (err) => err.code === 'INVALID_FOLDER');
  await assert.rejects(actions.moveMessages(fakeDeps, fakeAccount, '', [1], 'Work'), (err) => err.code === 'INVALID_FOLDER');
  await assert.rejects(actions.moveMessages(fakeDeps, fakeAccount, 'INBOX', [1], 'Work', { uidValidity: 5 }), (err) => err.status === 409 && err.code === 'UIDVALIDITY_CHANGED');
  // A server without UIDPLUS: no COPYUID, so no map.
  const plain = fakeClient({ moveResult: { path: 'INBOX', destination: 'Work' } });
  imap.withImap = async (deps, account, fn) => fn(plain);
  assert.deepEqual(await actions.moveMessages(fakeDeps, fakeAccount, 'INBOX', [3], 'Work'), { destination: 'Work', uidMap: {}, uidValidity: null });
  const refused = fakeClient({ moveResult: false });
  imap.withImap = async (deps, account, fn) => fn(refused);
  await assert.rejects(actions.moveMessages(fakeDeps, fakeAccount, 'INBOX', [3], 'Work'), (err) => err.status === 502 && err.code === 'REMOTE_FAILED');
});

test('applyFlags sets \\Answered; appendMessage validates flags; emptyFolder refuses ordinary folders', async (t) => {
  const client = fakeClient({ list: [box('INBOX'), box('Trash', '\\Trash')] });
  useFakeClient(t, client);
  await actions.applyFlags(fakeDeps, fakeAccount, 'Work', [5], { isAnswered: true, isRead: false });
  assert.deepEqual(client.calls.slice(0, 3), [['lock', 'Work'], ['add', '5', ['\\Answered']], ['remove', '5', ['\\Seen']]]);

  assert.deepEqual(await actions.appendMessage(fakeDeps, fakeAccount, 'Drafts', Buffer.from('x'), ['\\Draft', '\\Seen', '\\Seen']), { uid: 12, uidValidity: 34 });
  assert.deepEqual(client.calls.find((c) => c[0] === 'append'), ['append', 'Drafts', ['\\Draft', '\\Seen']]);
  await assert.rejects(actions.appendMessage(fakeDeps, fakeAccount, 'Drafts', Buffer.from('x'), ['\\Seen) (evil']), (err) => err.code === 'INVALID_FLAG');
  await assert.rejects(actions.appendMessage(fakeDeps, fakeAccount, 'Drafts', Buffer.alloc(0), []), (err) => err.code === 'INVALID_MESSAGE');
  await assert.rejects(actions.appendMessage(fakeDeps, fakeAccount, 'Drafts', 'not a buffer', []), (err) => err.code === 'INVALID_MESSAGE');

  await assert.rejects(actions.emptyFolder(fakeDeps, fakeAccount, 'Work'), (err) => err.status === 400 && err.code === 'NOT_EMPTYABLE');
  client.calls.length = 0;
  assert.deepEqual(await actions.emptyFolder(fakeDeps, fakeAccount, 'Trash'), { count: 3 });
  assert.deepEqual(client.calls.find((c) => c[0] === 'delete'), ['delete', '1:*', undefined]);

  await assert.rejects(actions.deleteByUid(fakeDeps, fakeAccount, 'Drafts', 'x'), (err) => err.code === 'INVALID_ID');
  await assert.rejects(actions.renameFolder(fakeDeps, fakeAccount, 'INBOX', 'Old'), (err) => err.code === 'PROTECTED_FOLDER');
  await assert.rejects(actions.deleteFolder(fakeDeps, fakeAccount, 'inbox'), (err) => err.code === 'PROTECTED_FOLDER');
  assert.ok(new HttpError(400, 'x') instanceof Error);
});

test('tabs, their counts and account counts only include INBOX messages', (t) => {
  const queries = require('../src/queries');
  const { env, db, userId, account } = makeAccount();
  t.after(() => env.close());
  folders.upsertFolders(db, account.id, DOVECOT_LIST);
  const id = (path) => db.prepare('SELECT id FROM folders WHERE account_id = ? AND path = ?').get(account.id, path).id;
  const insert = db.prepare(
    'INSERT INTO messages (account_id, folder_id, mailbox, uid, uid_validity, subject, date, is_read, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, 0, 1)'
  );
  insert.run(account.id, id('INBOX'), 'INBOX', 1, 'in inbox', 3);
  insert.run(account.id, id('Sent'), 'Sent', 1, 'in sent', 2);
  insert.run(account.id, id('Work/Clients'), 'Work/Clients', 1, 'in clients', 1);
  insert.run(account.id, null, 'INBOX', 2, 'legacy inbox row', 4);
  insert.run(account.id, null, 'Sent', 2, 'legacy sent row', 5);
  // Another user's INBOX folder must not make this user's rows count.
  const other = h.createAccount(db, env.crypto, h.createUser(db), { email: 'other@test.local' });
  folders.inboxFolder(db, other.id);

  const subjects = queries.listMessages(db, userId, { tabId: 'all' }).messages.map((m) => m.subject);
  assert.deepEqual(subjects, ['legacy inbox row', 'in inbox']);
  assert.deepEqual(queries.countForTab(db, userId, null), { unreadCount: 2, totalCount: 2 });
  const [acc] = queries.listAccountsJson(db, userId);
  assert.deepEqual([acc.messageCount, acc.unreadCount], [2, 2]);
  assert.equal(queries.selectTabMessageRefs(db, userId, null, { unread: true }).length, 2, 'mark-all-read stays in the inbox');
});
