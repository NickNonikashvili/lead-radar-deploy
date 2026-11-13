'use strict';

/**
 * FOLDERS engine — folder-aware write-back (actions.js) against the real Dovecot test server.
 * Uses ONLY f2@test.local (reset before every test). Skipped when Dovecot is not reachable.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const imap = require('../src/imap');
const actions = require('../src/actions');
const folders = require('../src/folders');
const { SyncManager } = require('../src/sync');
const { HttpError } = require('../src/errors');
const h = require('./engine-helpers');
const fh = require('./folders-helpers');

const USER = 'f2';
let available = false;
let releaseLock = () => {};

test.before(async () => {
  available = await fh.dovecotAvailable();
  if (!available) return;
  releaseLock = await fh.lockUser(USER);
  await fh.resetUser(USER);
});

test.after(async () => {
  try {
    if (available) await fh.resetUser(USER);
  } finally {
    releaseLock();
  }
});

function imapTest(name, fn) {
  test(name, async (t) => {
    if (!available) return t.skip('IMAP test server (127.0.0.1:1143) not reachable');
    await fh.resetUser(USER);
    const env = h.makeEngineEnv();
    const userId = h.createUser(env.db);
    const account = h.createAccount(env.db, env.crypto, userId, fh.accountFor(USER));
    const deps = { db: env.db, crypto: env.crypto, config: env.config };
    const manager = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: h.recordingLogger() });
    try {
      await fn(t, { ...env, deps, account, userId, manager, folder: (p) => fh.folderRow(env.db, account.id, p), rows: (p) => fh.rowsIn(env.db, account.id, p) });
    } finally {
      await manager.stop();
      env.close();
    }
  });
}

const uidsOf = async (mailbox) => [...(await fh.flagsOf(USER, mailbox)).keys()].sort((a, b) => a - b);

// ---------------------------------------------------------------------------------------------
// Moving
// ---------------------------------------------------------------------------------------------

imapTest('moveMessages moves between any folders and returns the COPYUID uidMap', async (t, ctx) => {
  await fh.withUser(USER, (c) => c.mailboxCreate('Work/Clients'));
  const [a, b, c] = await fh.appendMany(USER, 'INBOX', [{ subject: 'a' }, { subject: 'b' }, { subject: 'c' }]);
  const destBefore = await uidsOf('Work/Clients');
  const res = await actions.moveMessages(ctx.deps, ctx.account, 'INBOX', [c, a], 'Work/Clients', { uidValidity: await fh.uidValidityOf(USER, 'INBOX') });
  assert.equal(res.destination, 'Work/Clients');
  assert.equal(res.uidValidity, await fh.uidValidityOf(USER, 'Work/Clients'));
  assert.deepEqual(Object.keys(res.uidMap).map(Number).sort((x, y) => x - y), [a, c]);
  const dest = await uidsOf('Work/Clients');
  assert.deepEqual(Object.values(res.uidMap).sort((x, y) => x - y), dest.filter((u) => !destBefore.includes(u)), 'the new UIDs in the destination');
  assert.deepEqual(await fh.subjects(USER, 'Work/Clients'), ['a', 'c']);
  assert.deepEqual(await fh.subjects(USER, 'INBOX'), ['b']);

  // Moving back (undo) with the map works the same way.
  const back = await actions.moveMessages(ctx.deps, ctx.account, 'Work/Clients', Object.values(res.uidMap), 'INBOX');
  assert.equal(Object.keys(back.uidMap).length, 2);
  assert.deepEqual(await fh.subjects(USER, 'INBOX'), ['a', 'b', 'c']);
  void b;

  await assert.rejects(actions.moveMessages(ctx.deps, ctx.account, 'INBOX', [b], 'Archive', { uidValidity: 1 }), (err) => err.status === 409 && err.code === 'UIDVALIDITY_CHANGED');
  await assert.rejects(actions.moveMessages(ctx.deps, ctx.account, 'INBOX', [b], 'Does/Not/Exist'), (err) => err.status === 502 && err.code === 'REMOTE_FAILED');
  assert.deepEqual(await fh.subjects(USER, 'INBOX'), ['a', 'b', 'c'], 'nothing lost on a refused move');
});

imapTest('without the MOVE extension: COPY + delete, still with a uidMap', async (t, ctx) => {
  const real = imap.withImap;
  imap.withImap = (deps, account, fn, limits) =>
    real(deps, account, (client) => {
      client.capabilities.delete('MOVE');
      return fn(client);
    }, limits);
  t.after(() => {
    imap.withImap = real;
  });
  const [a] = await fh.appendMany(USER, 'INBOX', [{ subject: 'a' }, { subject: 'keep' }]);
  const res = await actions.moveMessages(ctx.deps, ctx.account, 'INBOX', [a], 'Archive');
  assert.equal(Object.keys(res.uidMap).length, 1);
  assert.deepEqual(await fh.subjects(USER, 'Archive'), ['a']);
  assert.deepEqual(await fh.subjects(USER, 'INBOX'), ['keep']);
});

imapTest('moveToSpecial: archive, trash, junk and back to the inbox, from the folders table', async (t, ctx) => {
  await ctx.manager.syncAccount(ctx.account.id); // fills the folders table
  const [a, b, c] = await fh.appendMany(USER, 'INBOX', [{ subject: 'to-archive' }, { subject: 'to-trash' }, { subject: 'spammy' }]);
  // The table decides: no LIST needed.
  let lists = 0;
  const real = imap.withImap;
  imap.withImap = (deps, account, fn, limits) =>
    real(deps, account, (client) => {
      const list = client.list.bind(client);
      client.list = (...args) => {
        lists += 1;
        return list(...args);
      };
      return fn(client);
    }, limits);
  t.after(() => {
    imap.withImap = real;
  });

  const archived = await actions.moveToSpecial(ctx.deps, ctx.account, 'INBOX', [a], 'archive');
  assert.equal(archived.destination, 'Archive');
  assert.equal(archived.deleted, false);
  assert.equal(Object.keys(archived.uidMap).length, 1);
  assert.equal((await actions.moveToSpecial(ctx.deps, ctx.account, 'INBOX', [b], 'trash')).destination, 'Trash');
  const junked = await actions.moveToSpecial(ctx.deps, ctx.account, 'INBOX', [c], 'junk', { uidValidity: await fh.uidValidityOf(USER, 'INBOX') });
  assert.equal(junked.destination, 'Junk');
  assert.equal(lists, 0);
  assert.deepEqual(await fh.subjects(USER, 'Junk'), ['spammy']);

  const notSpam = await actions.moveToSpecial(ctx.deps, ctx.account, 'Junk', Object.values(junked.uidMap), 'inbox');
  assert.equal(notSpam.destination, 'INBOX');
  assert.deepEqual(await fh.subjects(USER, 'INBOX'), ['spammy']);

  // Delete inside the Trash is for good.
  const gone = await actions.moveToSpecial(ctx.deps, ctx.account, 'Trash', await uidsOf('Trash'), 'trash');
  assert.deepEqual(gone, { destination: null, uidMap: {}, uidValidity: null, deleted: true });
  assert.deepEqual(await fh.subjects(USER, 'Trash'), []);
  await assert.rejects(actions.moveToSpecial(ctx.deps, ctx.account, 'Archive', await uidsOf('Archive'), 'archive'), (err) => err.code === 'INVALID_TARGET');
});

imapTest('moveToSpecial without a folders table (or before the first sync) falls back to LIST', async (t, ctx) => {
  // (Dovecot recreates its special folders at login, so "no Junk folder" is covered by the unit tests.)
  const [a, b] = await fh.appendMany(USER, 'INBOX', [{ subject: 'x' }, { subject: 'y' }]);
  const noDb = { crypto: ctx.crypto, config: ctx.config };
  assert.equal((await actions.moveToSpecial(noDb, ctx.account, 'INBOX', [a], 'junk')).destination, 'Junk');
  assert.equal((await actions.moveToSpecial(ctx.deps, ctx.account, 'INBOX', [b], 'archive')).destination, 'Archive', 'empty folders table');
  assert.deepEqual(await fh.subjects(USER, 'Junk'), ['x']);
  assert.deepEqual(await fh.subjects(USER, 'Archive'), ['y']);
});

// ---------------------------------------------------------------------------------------------
// Deleting, emptying, saving
// ---------------------------------------------------------------------------------------------

imapTest('deleteForever expunges exactly the given UIDs', async (t, ctx) => {
  const [a, b, c] = await fh.appendMany(USER, 'Archive', [{ subject: 'a' }, { subject: 'b' }, { subject: 'c' }]);
  // Another app marked c \Deleted without expunging: UID EXPUNGE must leave it alone.
  await fh.withUser(USER, async (client) => {
    const lock = await client.getMailboxLock('Archive');
    try {
      await client.messageFlagsAdd(String(c), ['\\Deleted'], { uid: true });
    } finally {
      lock.release();
    }
  });
  assert.deepEqual(await actions.deleteForever(ctx.deps, ctx.account, 'Archive', [a], { uidValidity: await fh.uidValidityOf(USER, 'Archive') }), { deleted: 1 });
  assert.deepEqual(await uidsOf('Archive'), [b, c]);
  assert.deepEqual(await actions.deleteForever(ctx.deps, { ...ctx.account, imap_port: 1 }, 'Archive', []), { deleted: 0 }, 'nothing to do: no connection');
  await assert.rejects(actions.deleteForever(ctx.deps, ctx.account, 'Archive', [b], { uidValidity: 1 }), (err) => err.code === 'UIDVALIDITY_CHANGED');
  assert.deepEqual(await uidsOf('Archive'), [b, c]);
});

imapTest('emptyFolder empties Trash and Junk only', async (t, ctx) => {
  await ctx.manager.syncAccount(ctx.account.id);
  await fh.appendMany(USER, 'Trash', [{ subject: 't1' }, { subject: 't2' }]);
  await fh.append(USER, 'Archive', { subject: 'keep me' });
  assert.deepEqual(await actions.emptyFolder(ctx.deps, ctx.account, 'Trash'), { count: 2 });
  assert.deepEqual(await fh.subjects(USER, 'Trash'), []);
  assert.deepEqual(await actions.emptyFolder(ctx.deps, ctx.account, 'Junk'), { count: 0 });
  await assert.rejects(actions.emptyFolder(ctx.deps, ctx.account, 'Archive'), (err) => err.status === 400 && err.code === 'NOT_EMPTYABLE');
  await assert.rejects(actions.emptyFolder({ crypto: ctx.crypto, config: ctx.config }, ctx.account, 'INBOX'), (err) => err.code === 'NOT_EMPTYABLE');
  assert.deepEqual(await fh.subjects(USER, 'Archive'), ['keep me']);
  // Known only from the server's flags (no table).
  await fh.append(USER, 'Junk', { subject: 'spam' });
  assert.deepEqual(await actions.emptyFolder({ crypto: ctx.crypto, config: ctx.config }, ctx.account, 'Junk'), { count: 1 });
});

imapTest('appendMessage stores with flags and reports APPENDUID; deleteByUid replaces a draft', async (t, ctx) => {
  const raw = fh.rawMessage({ subject: 'Draft v1', messageId: '<draft-1@t>' });
  const saved = await actions.appendMessage(ctx.deps, ctx.account, 'Drafts', raw, ['\\Draft', '\\Seen']);
  assert.equal(saved.uidValidity, await fh.uidValidityOf(USER, 'Drafts'));
  assert.ok(saved.uid > 0);
  const flags = await fh.flagsOf(USER, 'Drafts');
  assert.deepEqual([...flags.get(saved.uid)].filter((f) => f !== '\\Recent').sort(), ['\\Draft', '\\Seen']);

  const v2 = await actions.appendMessage(ctx.deps, ctx.account, 'Drafts', fh.rawMessage({ subject: 'Draft v2' }), ['\\Draft', '\\Seen']);
  await assert.rejects(actions.deleteByUid(ctx.deps, ctx.account, 'Drafts', saved.uid, { uidValidity: saved.uidValidity + 1 }), (err) => err.code === 'UIDVALIDITY_CHANGED');
  await actions.deleteByUid(ctx.deps, ctx.account, 'Drafts', saved.uid, { uidValidity: saved.uidValidity });
  assert.deepEqual(await uidsOf('Drafts'), [v2.uid]);
  await actions.deleteByUid(ctx.deps, ctx.account, 'Drafts', saved.uid); // already gone: fine
  await assert.rejects(actions.appendMessage(ctx.deps, ctx.account, 'No Such Folder', raw, []), (err) => err.status === 502 && err.code === 'REMOTE_FAILED');
});

imapTest('applyFlags works in any folder, including \\Answered', async (t, ctx) => {
  const uid = await fh.append(USER, 'Sent', { subject: 'mine' });
  await actions.applyFlags(ctx.deps, ctx.account, 'Sent', [uid], { isAnswered: true, isStarred: true });
  assert.deepEqual([...(await fh.flagsOf(USER, 'Sent')).get(uid)].sort(), ['\\Answered', '\\Flagged']);
  await actions.applyFlags(ctx.deps, ctx.account, 'Sent', [uid], { isAnswered: false, isRead: true });
  assert.deepEqual([...(await fh.flagsOf(USER, 'Sent')).get(uid)].sort(), ['\\Flagged', '\\Seen']);
});

// ---------------------------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------------------------

imapTest('createFolder / renameFolder / deleteFolder, nested, keeping the local tree in step', async (t, ctx) => {
  await ctx.manager.syncAccount(ctx.account.id);

  const created = await actions.createFolder(ctx.deps, ctx.account, 'Work/Clients');
  assert.equal(created.path, 'Work/Clients');
  assert.equal(created.created, true);
  assert.equal(created.folder.path, 'Work/Clients');
  assert.equal(created.folder.parent_path, 'Work');
  assert.equal(ctx.folder('Work').selectable, 0, 'the parent exists as a container');
  assert.equal((await actions.createFolder(ctx.deps, ctx.account, 'Work/Clients')).created, false, 'already there');
  await actions.createFolder(ctx.deps, ctx.account, 'Work');
  assert.equal(ctx.folder('Work').selectable, 1, 'created for real');

  // Mail in the subfolder, synced.
  await fh.appendMany(USER, 'Work/Clients', [{ subject: 'c-1' }, { subject: 'c-2' }]);
  await ctx.manager.syncAccount(ctx.account.id);
  const clientsId = ctx.folder('Work/Clients').id;
  const workId = ctx.folder('Work').id;
  const messageIds = ctx.rows('Work/Clients').map((r) => r.id);
  assert.equal(messageIds.length, 2);

  // Rename the parent: the subtree follows, ids/messages/sync state are kept.
  await assert.rejects(actions.renameFolder(ctx.deps, ctx.account, 'Work', 'Archive'), (err) => err.status === 409 && err.code === 'FOLDER_EXISTS');
  await assert.rejects(actions.renameFolder(ctx.deps, ctx.account, 'Work', 'Work/Clients/Inner'), (err) => err.status === 400);
  await assert.rejects(actions.renameFolder(ctx.deps, ctx.account, 'Nope', 'Other'), (err) => err.status === 404 && err.code === 'FOLDER_NOT_FOUND');
  const renamed = await actions.renameFolder(ctx.deps, ctx.account, 'Work', 'Projects');
  assert.equal(renamed.path, 'Projects');
  assert.equal(renamed.folder.id, workId);
  assert.equal(ctx.folder('Work'), undefined);
  assert.equal(ctx.folder('Projects/Clients').id, clientsId);
  assert.equal(ctx.folder('Projects/Clients').parent_path, 'Projects');
  assert.deepEqual(ctx.rows('Projects/Clients').map((r) => [r.id, r.mailbox]), messageIds.map((id) => [id, 'Projects/Clients']));
  const server = (await fh.withUser(USER, (c) => c.list())).map((b) => b.path);
  assert.ok(server.includes('Projects/Clients') && !server.includes('Work'));

  // The next sync agrees: nothing downloaded again, nothing removed.
  const after = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(after.ok, true);
  assert.equal(after.removed, 0);
  assert.equal(after.newMessages, 0);
  assert.deepEqual(ctx.rows('Projects/Clients').map((r) => r.id), messageIds);

  // A rename one level up, with a new name.
  await actions.renameFolder(ctx.deps, ctx.account, 'Projects/Clients', 'Customers');
  assert.equal(ctx.folder('Customers').id, clientsId);
  assert.equal(ctx.folder('Customers').parent_path, null);
  assert.deepEqual(ctx.rows('Customers').map((r) => r.mailbox), ['Customers', 'Customers']);
  await assert.rejects(actions.renameFolder(ctx.deps, ctx.account, 'INBOX', 'Old Inbox'), (err) => err.code === 'PROTECTED_FOLDER');

  // Delete a folder with a subfolder and mail: deepest first, local rows and messages gone.
  await actions.renameFolder(ctx.deps, ctx.account, 'Customers', 'Projects/Customers');
  await ctx.manager.syncAccount(ctx.account.id);
  const deleted = await actions.deleteFolder(ctx.deps, ctx.account, 'Projects');
  assert.deepEqual(deleted.deleted, ['Projects/Customers', 'Projects']);
  assert.equal(ctx.folder('Projects'), undefined);
  assert.equal(ctx.folder('Projects/Customers'), undefined);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(clientsId).n, 0);
  const left = (await fh.withUser(USER, (c) => c.list())).map((b) => b.path);
  assert.ok(!left.some((p) => p.startsWith('Projects')));
  assert.deepEqual(await actions.deleteFolder(ctx.deps, ctx.account, 'Projects'), { deleted: [] }, 'already gone');
  await assert.rejects(actions.deleteFolder(ctx.deps, ctx.account, 'INBOX'), (err) => err.code === 'PROTECTED_FOLDER');
  await assert.rejects(actions.createFolder(ctx.deps, ctx.account, 'bad\nname'), (err) => err.code === 'INVALID_FOLDER');
});

imapTest('folder changes are not written locally when the account was pointed elsewhere meanwhile', async (t, ctx) => {
  await ctx.manager.syncAccount(ctx.account.id);
  const stale = { ...ctx.account }; // the snapshot the action started with
  ctx.db.prepare('UPDATE accounts SET config_version = config_version + 1 WHERE id = ?').run(ctx.account.id);
  const res = await actions.createFolder(ctx.deps, stale, 'Elsewhere');
  assert.equal(res.created, true);
  assert.equal(res.folder, null);
  assert.equal(ctx.folder('Elsewhere'), undefined);
});

imapTest('remote failures are HttpError 502 REMOTE_FAILED with a friendly message; one connection per account at a time', async (t, ctx) => {
  const wrong = h.createAccount(ctx.db, ctx.crypto, ctx.userId, fh.accountFor(USER, { email: 'wrong@test.local', password: 'nope' }));
  await assert.rejects(actions.moveMessages(ctx.deps, wrong, 'INBOX', [1], 'Archive'), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 502);
    assert.equal(err.code, 'REMOTE_FAILED');
    assert.match(err.message, /Wrong email or password/);
    return true;
  });
  await assert.rejects(actions.createFolder(ctx.deps, { ...ctx.account, imap_port: 1 }, 'X'), (err) => err.status === 502 && /refused the connection/.test(err.message));

  let active = 0;
  let max = 0;
  const real = imap.withImap;
  imap.withImap = async (...args) => {
    active += 1;
    max = Math.max(max, active);
    try {
      return await real(...args);
    } finally {
      active -= 1;
    }
  };
  t.after(() => {
    imap.withImap = real;
  });
  const uids = await fh.appendMany(USER, 'INBOX', [{ subject: '1' }, { subject: '2' }, { subject: '3' }]);
  await Promise.all([
    actions.applyFlags(ctx.deps, ctx.account, 'INBOX', [uids[0]], { isRead: true }),
    actions.moveMessages(ctx.deps, ctx.account, 'INBOX', [uids[1]], 'Archive'),
    actions.appendMessage(ctx.deps, ctx.account, 'Drafts', fh.rawMessage(), ['\\Draft']),
    actions.createFolder(ctx.deps, ctx.account, 'Queued'),
  ]);
  assert.equal(max, 1);
  assert.ok(folders.getFolder(ctx.db, ctx.folder('Queued').id));
});
