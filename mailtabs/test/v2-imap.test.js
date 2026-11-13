'use strict';

// ROUTES v2 against the local Dovecot with r1@test.local (reset first; skipped when Dovecot is
// down) and the real sync engine: folder create/rename/delete, moves + undo, spam / not spam,
// delete forever, empty trash, load older mail, download original, and drafts on the server.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  startTestServer,
  makeClient,
  signupUser,
  imapAvailable,
  lockTestImapUser,
  resetAllFolders,
  mailboxMessages,
  appendMessage,
  buildRawMessage,
  withTestImap,
  waitUntil,
  IMAP_TEST,
} = require('./helpers');

const R1 = IMAP_TEST.users.r1;

async function setup(t) {
  const release = await lockTestImapUser('r1');
  t.after(release);
  await resetAllFolders('r1');
  const srv = await startTestServer({});
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  await signupUser(alice, { email: 'alice@example.com', name: 'Alice' });
  await signupUser(mallory, { email: 'mallory@example.com' });
  const created = await alice.post('/api/accounts', {
    provider: 'imap',
    email: R1.user,
    password: R1.pass,
    imapHost: IMAP_TEST.host,
    imapPort: IMAP_TEST.port,
    imapSecurity: 'none',
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.deepEqual(created.body.warnings, ['Sending is not set up yet: add the outgoing (SMTP) server in the account settings.']);
  const accountId = created.body.account.id;
  const sync = async () => {
    const res = await alice.post(`/api/accounts/${accountId}/sync`, {});
    assert.equal(res.body.result.ok, true, JSON.stringify(res.body));
    return res.body.result;
  };
  await sync();
  const folderList = async () => (await alice.get('/api/folders')).body.accounts.find((a) => a.accountId === accountId).folders;
  const folder = async (path) => (await folderList()).find((f) => f.path === path);
  const serverPaths = () => withTestImap('r1', async (client) => (await client.list()).map((b) => b.path).sort());
  const subjectsIn = async (box) => (await mailboxMessages('r1', box)).map((m) => m.envelope.subject).sort();
  const listSubjects = async (qs) => (await alice.get(`/api/messages${qs}`)).body.messages.map((m) => m.subject).sort();
  return { srv, alice, mallory, accountId, sync, folderList, folder, serverPaths, subjectsIn, listSubjects };
}

test('folders on the server: create nested, rename, refuse non-empty delete, force delete, live emptiness check', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const { alice, mallory, accountId, folderList, folder, serverPaths } = await setup(t);

  assert.deepEqual((await folderList()).map((f) => f.path), ['INBOX', 'Drafts', 'Sent', 'Archive', 'Junk', 'Trash']);

  const projects = await alice.post('/api/folders', { accountId, name: 'Projects' });
  assert.equal(projects.status, 201, JSON.stringify(projects.body));
  assert.equal(projects.body.folder.path, 'Projects');
  const clients = await alice.post('/api/folders', { accountId, name: 'Clients ü', parentId: projects.body.folder.id });
  assert.equal(clients.status, 201, JSON.stringify(clients.body));
  assert.equal(clients.body.folder.path, 'Projects/Clients ü');
  assert.equal(clients.body.folder.parentPath, 'Projects');
  assert.ok((await serverPaths()).includes('Projects/Clients ü'), 'created on the server (UTF-7 handled by imapflow)');
  assert.equal((await alice.post('/api/folders', { accountId, name: 'Projects' })).body.code, 'FOLDER_EXISTS');
  assert.equal((await mallory.post('/api/folders', { accountId, name: 'Nope' })).status, 404);

  // Rename keeps the folder id; the server follows.
  const renamed = await alice.patch(`/api/folders/${clients.body.folder.id}`, { name: 'Customers' });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  assert.equal(renamed.body.folder.id, clients.body.folder.id);
  assert.equal(renamed.body.folder.path, 'Projects/Customers');
  const paths = await serverPaths();
  assert.ok(paths.includes('Projects/Customers') && !paths.includes('Projects/Clients ü'));
  assert.equal((await mallory.patch(`/api/folders/${clients.body.folder.id}`, { name: 'x' })).status, 404);

  // A subfolder makes it non-empty; force deletes the whole tree.
  const refused = await alice.del(`/api/folders/${projects.body.folder.id}`);
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'FOLDER_NOT_EMPTY');
  assert.ok((await serverPaths()).includes('Projects'), 'nothing deleted');
  const forced = await alice.del(`/api/folders/${projects.body.folder.id}?force=1`);
  assert.deepEqual(forced.body, { ok: true, deleted: 2 });
  assert.ok(!(await serverPaths()).some((p) => p.startsWith('Projects')));
  assert.equal(await folder('Projects'), undefined);
  assert.equal(await folder('Projects/Customers'), undefined);

  // Mail that arrived since the last sync still counts: the server is asked before deleting.
  const temp = (await alice.post('/api/folders', { accountId, name: 'Temp' })).body.folder;
  await appendMessage('r1', { mailbox: 'Temp', subject: 'Not synced yet', to: R1.user });
  const live = await alice.del(`/api/folders/${temp.id}`);
  assert.equal(live.body.code, 'FOLDER_NOT_EMPTY', JSON.stringify(live.body));
  assert.match(live.body.error, /1 message/);
  const empty = (await alice.post('/api/folders', { accountId, name: 'Empty' })).body.folder;
  assert.deepEqual((await alice.del(`/api/folders/${empty.id}`)).body, { ok: true, deleted: 1 }, 'an empty folder goes without asking');
  assert.equal((await alice.del(`/api/folders/${temp.id}?force=1`)).status, 200);
});

test('moves with undo, spam / not spam, delete forever, empty trash, older mail, original download', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const { alice, mallory, accountId, sync, folder, subjectsIn, listSubjects } = await setup(t);

  for (const subject of ['Alpha', 'Bravo', 'Charlie']) await appendMessage('r1', { subject, to: R1.user, text: `Body of ${subject}` });
  await sync();
  const inboxRows = (await alice.get('/api/messages?tab=all')).body.messages;
  const id = (subject) => inboxRows.find((m) => m.subject === subject).id;
  const work = (await alice.post('/api/folders', { accountId, name: 'Work' })).body.folder;

  // --- move + undo
  const moved = await alice.post('/api/messages/bulk', { ids: [id('Alpha'), id('Bravo')], action: 'move', folderId: work.id });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.count, 2);
  assert.equal(typeof moved.body.undo, 'string');
  assert.deepEqual(await subjectsIn('Work'), ['Alpha', 'Bravo']);
  assert.deepEqual(await listSubjects('?tab=all'), ['Charlie'], 'gone from the inbox list at once');
  assert.equal((await mallory.post('/api/messages/undo', { token: moved.body.undo })).status, 404, "not Mallory's to undo");
  const undone = await alice.post('/api/messages/undo', { token: moved.body.undo });
  assert.deepEqual(undone.body, { ok: true, count: 2, failed: [] });
  assert.deepEqual(await subjectsIn('INBOX'), ['Alpha', 'Bravo', 'Charlie']);
  assert.deepEqual(await subjectsIn('Work'), []);
  assert.deepEqual(await listSubjects('?tab=all'), ['Alpha', 'Bravo', 'Charlie'], 'back in the list once undo answers');
  assert.equal((await alice.post('/api/messages/undo', { token: moved.body.undo })).status, 404, 'single use');

  // --- spam, then not spam from the unified Spam view
  const charlie = (await alice.get('/api/messages?tab=all')).body.messages.find((m) => m.subject === 'Charlie');
  const spam = await alice.post('/api/messages/bulk', { ids: [charlie.id], action: 'spam' });
  assert.equal(spam.body.count, 1);
  assert.deepEqual(await subjectsIn('Junk'), ['Charlie']);
  const junk = await folder('Junk');
  await alice.post(`/api/folders/${junk.id}/sync`, {});
  const inSpam = (await alice.get('/api/messages?view=junk')).body.messages;
  assert.deepEqual(inSpam.map((m) => m.subject), ['Charlie']);
  const notSpam = await alice.post('/api/messages/bulk', { ids: [inSpam[0].id], action: 'notspam' });
  assert.equal(notSpam.body.count, 1);
  assert.deepEqual(await subjectsIn('Junk'), []);
  assert.ok((await subjectsIn('INBOX')).includes('Charlie'));

  // --- trash, delete forever (only from Trash/Spam), empty trash
  await sync();
  const rows = (await alice.get('/api/messages?tab=all')).body.messages;
  const alpha = rows.find((m) => m.subject === 'Alpha');
  assert.match((await alice.post('/api/messages/bulk', { ids: [alpha.id], action: 'delete_forever' })).body.failed[0].error, /Trash or Spam/);
  await alice.post('/api/messages/bulk', { ids: rows.filter((m) => m.subject !== 'Charlie').map((m) => m.id), action: 'trash' });
  assert.deepEqual(await subjectsIn('Trash'), ['Alpha', 'Bravo']);
  const trash = await folder('Trash');
  await alice.post(`/api/folders/${trash.id}/sync`, {});
  const inTrash = (await alice.get(`/api/messages?folder=${trash.id}`)).body.messages;
  const forever = await alice.post('/api/messages/bulk', { ids: [inTrash.find((m) => m.subject === 'Alpha').id], action: 'delete_forever' });
  assert.deepEqual(forever.body, { ok: true, count: 1, failed: [], undo: null });
  assert.deepEqual(await subjectsIn('Trash'), ['Bravo']);
  assert.equal((await mallory.post(`/api/folders/${trash.id}/empty`, {})).status, 404);
  const emptied = await alice.post(`/api/folders/${trash.id}/empty`, {});
  assert.deepEqual(emptied.body, { ok: true, count: 1 });
  assert.deepEqual(await subjectsIn('Trash'), []);
  assert.deepEqual((await alice.get(`/api/messages?folder=${trash.id}`)).body.messages, []);

  // --- download the original
  const charlieNow = (await alice.get('/api/messages?tab=all')).body.messages.find((m) => m.subject === 'Charlie');
  const raw = await alice.get(`/api/messages/${charlieNow.id}/raw`);
  assert.equal(raw.status, 200);
  assert.equal(raw.headers.get('content-type'), 'message/rfc822');
  assert.equal(raw.headers.get('content-disposition'), `attachment; filename="Charlie.eml"; filename*=UTF-8''Charlie.eml`);
  assert.equal(raw.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(raw.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  const serverSource = (await mailboxMessages('r1', 'INBOX')).find((m) => m.envelope.subject === 'Charlie').source;
  assert.ok(raw.buffer.equals(serverSource), 'byte for byte what the server has');
  assert.equal((await mallory.get(`/api/messages/${charlieNow.id}/raw`)).status, 404);

  // --- load older mail: a new folder's first sync stores the newest 50
  await withTestImap('r1', async (client) => {
    await client.mailboxCreate('Old');
    for (let i = 1; i <= 53; i++) {
      await client.append('Old', buildRawMessage({ subject: `Old ${String(i).padStart(2, '0')}`, to: R1.user, date: new Date(Date.UTC(2020, 0, i)) }), ['\\Seen']);
    }
  });
  await sync(); // lists the new folder and gives it its first sync
  const old = await folder('Old');
  assert.ok(old, 'the folder from the server is listed');
  await waitUntil(async () => (await folder('Old')).lastSyncedAt, { what: 'the first sync of Old' });
  const firstPage = (await alice.get(`/api/messages?folder=${old.id}&limit=100`)).body.messages;
  assert.equal(firstPage.length, 50);
  assert.equal((await folder('Old')).hasOlder, true);
  const older = await alice.post(`/api/folders/${old.id}/backfill`, { count: 10 });
  assert.deepEqual(older.body, { added: 3, hasOlder: false });
  assert.equal((await alice.get(`/api/messages?folder=${old.id}&limit=100`)).body.messages.length, 53);
});

test('drafts on the server: save, replace, reopen (with Bcc), discard; never someone else\'s', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const { srv, alice, mallory, accountId, folder, subjectsIn } = await setup(t);
  const pause = () => new Promise((resolve) => setTimeout(resolve, 1100)); // 1 save per second

  const payload = {
    accountId,
    to: [{ name: 'Bob', address: 'bob@b.example' }],
    bcc: [{ name: '', address: 'secret@b.example' }],
    subject: 'Draft one',
    html: '<p>First <script>alert(1)</script>try</p>',
  };
  const saved = await alice.post('/api/drafts', { payload });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const drafts = await folder('Drafts');
  assert.equal(saved.body.draft.folderId, drafts.id);
  assert.ok(saved.body.draft.uid > 0);
  assert.deepEqual(await subjectsIn('Drafts'), ['Draft one']);

  await pause();
  const replaced = await alice.post('/api/drafts', { payload: { ...payload, subject: 'Draft two' }, draft: saved.body.draft });
  assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
  assert.deepEqual(await subjectsIn('Drafts'), ['Draft two'], 'the previous copy is replaced');

  // Reopen it from the Drafts folder.
  await alice.post(`/api/folders/${drafts.id}/sync`, {});
  const row = await waitUntil(async () => (await alice.get(`/api/messages?folder=${drafts.id}`)).body.messages.find((m) => m.subject === 'Draft two'), { what: 'the draft row' });
  assert.equal(row.isDraft, true);
  const reopened = await alice.get(`/api/compose/prepare?mode=draft&messageId=${row.id}`);
  assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
  assert.deepEqual(reopened.body.draft, replaced.body.draft);
  assert.equal(reopened.body.payload.subject, 'Draft two');
  assert.deepEqual(reopened.body.payload.bcc.map((r) => r.address), ['secret@b.example'], 'Bcc survives in the draft');
  assert.ok(!/script/i.test(reopened.body.payload.html));
  assert.equal((await mallory.get(`/api/compose/prepare?mode=draft&messageId=${row.id}`)).status, 404);
  const theirDelete = await mallory.del('/api/drafts', { draft: replaced.body.draft });
  assert.equal(theirDelete.status, 404, JSON.stringify(theirDelete.body));
  assert.deepEqual(await subjectsIn('Drafts'), ['Draft two'], "Mallory's attempts changed nothing");

  const discarded = await alice.del('/api/drafts', { draft: replaced.body.draft });
  assert.deepEqual(discarded.body, { ok: true });
  assert.deepEqual(await subjectsIn('Drafts'), []);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(drafts.id).n, 0);
});
