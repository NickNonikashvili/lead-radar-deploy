'use strict';

// Gmail semantics with a fake IMAP client (no real Gmail here): archive without a visible All
// Mail, names never trusted, delete-forever through [Gmail]/Trash, X-GM-THRID / X-GM-MSGID as
// strings end to end.

const test = require('node:test');
const assert = require('node:assert/strict');

const imap = require('../src/imap');
const actions = require('../src/actions');
const folders = require('../src/folders');
const { threadKeyFor } = require('../src/mailparse');
const { SyncManager } = require('../src/sync');
const eh = require('./engine-helpers');

const BIG_THRID = '1278455344230334865'; // > 2^53: a Number would turn it into ...4800
const BIG_MSGID = '1749284719372419123';

const box = (path, specialUse) => ({
  path,
  name: path.split('/').pop(),
  delimiter: '/',
  flags: new Set(specialUse ? [specialUse] : []),
  specialUse,
  specialUseSource: specialUse ? 'extension' : undefined,
});
const GMAIL_LIST = [
  box('INBOX', '\\Inbox'),
  box('Archive'), // a user label that happens to be called "Archive"
  box('Deleted Items'), // and one called like Exchange's trash
  box('[Gmail]/All Mail', '\\All'),
  box('[Gmail]/Spam', '\\Junk'),
  box('[Gmail]/Trash', '\\Trash'),
];

/**
 * A Gmail-like client: X-GM-EXT-1, MOVE with COPYUID (unless uidMap: false), per-folder messages
 * { uid, emailId } so FETCH / SEARCH emailId / EXPUNGE behave.
 */
function gmailClient({ list = GMAIL_LIST, uidMap = true, mailboxes = {} } = {}) {
  const calls = [];
  const boxes = new Map(Object.entries(mailboxes).map(([k, v]) => [k, v.map((m) => ({ ...m }))]));
  const uidNext = new Map([...boxes].map(([k, v]) => [k, Math.max(0, ...v.map((m) => m.uid)) + 1]));
  const client = {
    calls,
    capabilities: new Map([['IMAP4rev1', true], ['X-GM-EXT-1', true], ['UIDPLUS', true], ['MOVE', true]]),
    mailbox: null,
    async getMailboxLock(path) {
      calls.push(['lock', path]);
      client.mailbox = { path, uidValidity: path === '[Gmail]/Trash' ? 900n : 77n, readOnly: false };
      if (!boxes.has(path)) boxes.set(path, []);
      return { release: () => calls.push(['release', path]) };
    },
    async list() {
      calls.push(['list']);
      return list;
    },
    async *fetch(range, query, opts) {
      calls.push(['fetch', range, query, opts]);
      const wanted = new Set(expand(range));
      for (const m of boxes.get(client.mailbox.path) || []) if (wanted.has(m.uid)) yield { uid: m.uid, emailId: m.emailId };
    },
    async search(query, opts) {
      calls.push(['search', query, opts]);
      return (boxes.get(client.mailbox.path) || []).filter((m) => m.emailId === query.emailId).map((m) => m.uid);
    },
    async messageMove(range, dest, opts) {
      calls.push(['move', range, dest, opts]);
      const src = boxes.get(client.mailbox.path) || [];
      if (!boxes.has(dest)) boxes.set(dest, []);
      const map = new Map();
      for (const uid of expand(range)) {
        const i = src.findIndex((m) => m.uid === uid);
        if (i < 0) continue;
        const [m] = src.splice(i, 1);
        const next = uidNext.get(dest) || 1;
        uidNext.set(dest, next + 1);
        boxes.get(dest).push({ ...m, uid: next });
        map.set(uid, next);
      }
      return uidMap ? { destination: dest, uidValidity: dest === '[Gmail]/Trash' ? 900n : 77n, uidMap: map } : { destination: dest };
    },
    async messageDelete(range, opts) {
      calls.push(['delete', client.mailbox.path, range, opts]);
      const set = new Set(expand(range));
      boxes.set(client.mailbox.path, (boxes.get(client.mailbox.path) || []).filter((m) => !set.has(m.uid)));
      return true;
    },
    async messageFlagsRemove(range, flags, opts) {
      calls.push(['flagsRemove', range, flags, opts]);
      return true;
    },
    boxes,
  };
  return client;
}

function expand(range) {
  const out = [];
  for (const part of String(range).split(',')) {
    const [a, b] = part.split(':').map(Number);
    for (let n = a; n <= (b || a); n++) out.push(n);
  }
  return out;
}

function useClient(t, client) {
  const original = imap.withImap;
  imap.withImap = async (deps, account, fn) => fn(client);
  t.after(() => {
    imap.withImap = original;
  });
}

const deps = { db: null, crypto: null, config: {} };
const gmailAccount = { id: 4242, imap_host: 'imap.gmail.com' };

// ---------------------------------------------------------------------------------------------

test('Gmail archive: MOVE to All Mail, never to a label named "Archive"', async (t) => {
  const client = gmailClient({ mailboxes: { INBOX: [{ uid: 3, emailId: BIG_MSGID }] } });
  useClient(t, client);
  const res = await actions.moveToSpecial(deps, gmailAccount, 'INBOX', [3], 'archive', { uidValidity: 77 });
  assert.equal(res.destination, '[Gmail]/All Mail');
  assert.deepEqual(res.uidMap, { 3: 1 });
  assert.ok(!client.calls.some((c) => c[0] === 'move' && c[2] === 'Archive'));
});

test('Gmail archive with All Mail hidden from IMAP: UID STORE -X-GM-LABELS (\\Inbox)', async (t) => {
  const client = gmailClient({ list: GMAIL_LIST.filter((b) => b.specialUse !== '\\All'), mailboxes: { INBOX: [{ uid: 3 }, { uid: 4 }, { uid: 9 }] } });
  useClient(t, client);
  const res = await actions.moveToSpecial(deps, gmailAccount, 'INBOX', [9, 3, 4], 'archive');
  assert.deepEqual(res, { destination: null, uidMap: {}, uidValidity: null, deleted: false });
  assert.deepEqual(client.calls.find((c) => c[0] === 'flagsRemove'), ['flagsRemove', '3:4,9', ['\\Inbox'], { uid: true, useLabels: true }]);
  assert.ok(!client.calls.some((c) => c[0] === 'move' || c[0] === 'delete'), 'no MOVE into the "Archive" label, no EXPUNGE');

  // From a label there is no Inbox label to remove: a clear error, nothing changed.
  client.calls.length = 0;
  await assert.rejects(actions.moveToSpecial(deps, gmailAccount, 'Clients', [1], 'archive'), (err) => {
    assert.equal(err.code, 'NO_ARCHIVE');
    assert.match(err.message, /All Mail/);
    assert.match(err.message, /Show in IMAP/);
    return true;
  });
  assert.ok(!client.calls.some((c) => ['move', 'delete', 'flagsRemove'].includes(c[0])));

  // The same server seen without X-GM-EXT-1 / Gmail host is an ordinary IMAP server.
  const plain = gmailClient({ list: GMAIL_LIST.filter((b) => b.specialUse !== '\\All') });
  plain.capabilities.delete('X-GM-EXT-1');
  imap.withImap = async (d, a, fn) => fn(plain);
  const ordinary = await actions.moveToSpecial(deps, { id: 1, imap_host: 'mail.example.org' }, 'INBOX', [1], 'archive');
  assert.equal(ordinary.destination, 'Archive', 'elsewhere a folder named Archive is the archive');
});

test('Gmail trash: MOVE to [Gmail]/Trash; a hidden Trash is an error, not an EXPUNGE', async (t) => {
  const client = gmailClient({ mailboxes: { 'Clients/ACME': [{ uid: 5 }] } });
  useClient(t, client);
  const res = await actions.moveToSpecial(deps, gmailAccount, 'Clients/ACME', [5], 'trash');
  assert.equal(res.destination, '[Gmail]/Trash');
  assert.equal(res.deleted, false);

  const hidden = gmailClient({ list: GMAIL_LIST.filter((b) => b.specialUse !== '\\Trash'), mailboxes: { INBOX: [{ uid: 5 }] } });
  imap.withImap = async (d, a, fn) => fn(hidden);
  await assert.rejects(actions.moveToSpecial(deps, gmailAccount, 'INBOX', [5], 'trash'), (err) => err.code === 'NO_TRASH' && /Trash/.test(err.message));
  assert.ok(!hidden.calls.some((c) => c[0] === 'delete' || c[0] === 'move'), 'the "Deleted Items" label is not a trash');

  // Trashing inside the Trash deletes for good (permanent on Gmail).
  const inTrash = gmailClient({ mailboxes: { '[Gmail]/Trash': [{ uid: 8 }] } });
  imap.withImap = async (d, a, fn) => fn(inTrash);
  const gone = await actions.moveToSpecial(deps, gmailAccount, '[Gmail]/Trash', [8], 'trash');
  assert.equal(gone.deleted, true);
  assert.deepEqual(inTrash.calls.find((c) => c[0] === 'delete'), ['delete', '[Gmail]/Trash', '8', { uid: true }]);
});

test('Gmail delete forever from INBOX: MOVE to Trash, then delete the moved UIDs there', async (t) => {
  const client = gmailClient({ mailboxes: { INBOX: [{ uid: 10, emailId: BIG_MSGID }, { uid: 11, emailId: '42' }], '[Gmail]/Trash': [{ uid: 1, emailId: 'other' }] } });
  useClient(t, client);
  assert.deepEqual(await actions.deleteForever(deps, gmailAccount, 'INBOX', [10, 11], { uidValidity: 77 }), { deleted: 2 });
  const steps = client.calls.filter((c) => ['move', 'delete', 'lock'].includes(c[0]));
  assert.deepEqual(steps, [
    ['lock', 'INBOX'],
    ['move', '10:11', '[Gmail]/Trash', { uid: true }],
    ['lock', '[Gmail]/Trash'],
    ['delete', '[Gmail]/Trash', '2:3', { uid: true }],
  ]);
  assert.deepEqual(client.boxes.get('[Gmail]/Trash').map((m) => m.uid), [1], 'only the moved messages were deleted');
  assert.equal(client.boxes.get('INBOX').length, 0);
});

test('Gmail delete forever without COPYUID: the messages are found in Trash by X-GM-MSGID (a string)', async (t) => {
  const client = gmailClient({ uidMap: false, mailboxes: { 'Clients': [{ uid: 7, emailId: BIG_MSGID }], '[Gmail]/Trash': [{ uid: 1, emailId: '1749284719372419000' }] } });
  useClient(t, client);
  await actions.deleteForever(deps, gmailAccount, 'Clients', [7]);
  const search = client.calls.find((c) => c[0] === 'search');
  assert.deepEqual(search, ['search', { emailId: BIG_MSGID }, { uid: true }]);
  assert.equal(typeof search[1].emailId, 'string');
  assert.deepEqual(client.boxes.get('[Gmail]/Trash').map((m) => m.emailId), ['1749284719372419000'], 'a near-identical id is not deleted');
});

test('Gmail delete forever inside Trash or Spam: deleted where they are', async (t) => {
  const client = gmailClient({ mailboxes: { '[Gmail]/Spam': [{ uid: 3 }] } });
  useClient(t, client);
  await actions.deleteForever(deps, gmailAccount, '[Gmail]/Spam', [3]);
  assert.ok(!client.calls.some((c) => c[0] === 'move'));
  assert.deepEqual(client.calls.find((c) => c[0] === 'delete'), ['delete', '[Gmail]/Spam', '3', { uid: true }]);

  // The folders table decides first when there is one.
  const env = eh.makeEngineEnv();
  t.after(() => env.close());
  const account = eh.createAccount(env.db, env.crypto, eh.createUser(env.db), { imap_host: 'imap.gmail.com' });
  folders.upsertFolders(env.db, account.id, GMAIL_LIST, { isGmail: true });
  const table = gmailClient({ mailboxes: { '[Gmail]/Trash': [{ uid: 4 }] } });
  imap.withImap = async (d, a, fn) => fn(table);
  await actions.deleteForever({ db: env.db, crypto: env.crypto, config: env.config }, account, '[Gmail]/Trash', [4]);
  assert.ok(!table.calls.some((c) => c[0] === 'list' || c[0] === 'move'));
});

test('X-GM-THRID: kept exactly as a string (or BigInt); a lossy Number is never used', () => {
  assert.equal(threadKeyFor({ gmailThreadId: BIG_THRID, messageId: '<m@x>' }), `gm:${BIG_THRID}`);
  assert.equal(threadKeyFor({ gmailThreadId: BigInt(BIG_THRID), messageId: '<m@x>' }), `gm:${BIG_THRID}`);
  // Number('1278455344230334865') === 1278455344230334800: that thread id would be wrong.
  assert.equal(threadKeyFor({ gmailThreadId: Number(BIG_THRID), references: ['<root@x>'], messageId: '<m@x>' }), 'mid:<root@x>');
  assert.equal(threadKeyFor({ gmailThreadId: 12345, messageId: '<m@x>' }), 'gm:12345', 'a safe integer is fine');
});

test('sync of a Gmail folder stores the 64-bit X-GM-THRID exactly', async (t) => {
  const env = eh.makeEngineEnv();
  t.after(() => env.close());
  const manager = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: eh.recordingLogger() });
  t.after(() => manager.stop());
  const account = eh.createAccount(env.db, env.crypto, eh.createUser(env.db), { imap_host: 'imap.gmail.com', email: 'me@gmail.com' });
  const inbox = folders.inboxFolder(env.db, account.id);
  const meta = { uid: 1, flags: new Set(), size: 100, threadId: BIG_THRID, emailId: BIG_MSGID, internalDate: new Date() };
  const parsed = { messageId: '<a@b>', subject: 'Hi', from: { name: '', address: 'x@y.z' }, to: [], cc: [], replyTo: [], date: Date.now(), snippet: '', text: '', html: null, attachments: [], references: ['<root@b>'], inReplyTo: null };
  const row = manager._buildRow(account.id, inbox, 5, meta, parsed, { isGmail: true });
  assert.equal(row.thread_key, `gm:${BIG_THRID}`);
});
