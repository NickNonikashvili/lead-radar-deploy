'use strict';

// Folder classification (special-use attributes first, English + localised name fallbacks),
// Exchange's non-mail folders (hidden: never synced, not listed, no move target) and the
// FOLDER_NOT_EMPTY count. The sync test uses q1 on Dovecot; the rest needs no IMAP.

const test = require('node:test');
const assert = require('node:assert/strict');

const folders = require('../src/folders');
const actions = require('../src/actions');
const imap = require('../src/imap');
const { SyncManager } = require('../src/sync');
const eh = require('./engine-helpers');
const gh = require('./gaps-helpers');
const { startTestServer, makeClient, signupUser, seedAccount, seedFolder, seedMessage } = require('./helpers');

const entry = (path, flags = [], extra = {}) => ({
  path,
  name: path.split(extra.delimiter || '/').pop(),
  delimiter: '/',
  flags: new Set(flags),
  ...extra,
});
const use = (path, opts, flags) => folders.classifyFolder(entry(path, flags), opts).specialUse;

test('name fallbacks: Yahoo, Exchange and localised (de/fr/es/it/pt/nl) special folders', () => {
  const expected = {
    '\\Drafts': ['Draft', 'Drafts', 'Entwürfe', 'Brouillons', 'Borradores', 'Bozze', 'Rascunhos', 'Concepten'],
    '\\Junk': ['Bulk', 'Bulk Mail', 'Junk Email', 'Junk E-mail', 'Spam', 'Spamverdacht', 'Junk-E-Mail', 'Courrier indésirable'],
    '\\Trash': [
      'Deleted',
      'Deleted Items',
      'Deleted Messages',
      'Gelöscht',
      'Gelöschte Elemente',
      'Papierkorb',
      'Corbeille',
      'Éléments supprimés',
      'Papelera',
      'Cestino',
      'Lixeira',
      'Verwijderde items',
      'Prullenbak',
    ],
    '\\Sent': [
      'Sent Items',
      'Sent Messages',
      'Gesendet',
      'Gesendete Elemente',
      'Envoyés',
      'Éléments envoyés',
      'Enviados',
      'Elementos enviados',
      'Posta inviata',
      'Itens Enviados',
      'Verzonden items',
    ],
    '\\Archive': ['Archive', 'Archiv'],
  };
  for (const [specialUse, names] of Object.entries(expected)) {
    for (const name of names) {
      const c = folders.classifyFolder(entry(name));
      assert.equal(c.specialUse, specialUse, name);
      assert.equal(c.specialUseSource, 'name', name);
    }
  }
  // Case and Unicode normalisation (NFD "Entwürfe" from some servers) do not matter.
  assert.equal(use('ENTWÜRFE'), '\\Drafts');
  assert.equal(use('INBOX.Papierkorb', {}, []), null, 'with "/" as delimiter this is one top-level name');
  assert.equal(folders.classifyFolder(entry('INBOX.Papierkorb', [], { delimiter: '.' })).specialUse, '\\Trash');
  // Only near the top of the tree, never on Gmail.
  assert.equal(use('Projects/Archiv'), null);
  assert.equal(use('Kunden/Gesendet'), null);
  assert.equal(use('Archive', { isGmail: true }), null);
  assert.equal(use('Papierkorb', { isGmail: true }), null);
  assert.equal(use('[Gmail]/Papierkorb', { isGmail: true }, ['\\Trash']), '\\Trash', 'Gmail flags its own (localised) folders');
});

test('special-use attributes win over names, and one use is never given twice', () => {
  // The folder's own flag beats a name (and beats imapflow's name-based pick for it).
  assert.equal(use('Trash', {}, ['\\Sent']), '\\Sent');
  const guessed = folders.classifyFolder({ ...entry('Papierkorb', ['\\Archive']), specialUse: '\\Trash', specialUseSource: 'name' });
  assert.equal(guessed.specialUse, '\\Archive');
  assert.equal(guessed.specialUseSource, 'server');
  // An imapflow pick from the SPECIAL-USE extension counts as the server's.
  assert.equal(folders.classifyFolder({ ...entry('Stuff'), specialUse: '\\Junk', specialUseSource: 'extension' }).specialUse, '\\Junk');

  const env = eh.makeEngineEnv();
  try {
    const account = eh.createAccount(env.db, env.crypto, eh.createUser(env.db), {});
    folders.upsertFolders(env.db, account.id, [
      entry('INBOX'),
      entry('Sent'), // name only
      entry('Gesendete Elemente', ['\\Sent']), // flagged: wins
      entry('Papierkorb'), // two name guesses for \Trash: the alphabetically first top-level one
      entry('Trash'),
      entry('Deleted Items'),
    ]);
    const rows = env.db.prepare('SELECT path, special_use FROM folders WHERE account_id = ? ORDER BY path').all(account.id);
    const byPath = Object.fromEntries(rows.map((r) => [r.path, r.special_use]));
    assert.equal(byPath['Gesendete Elemente'], '\\Sent');
    assert.equal(byPath.Sent, null);
    assert.deepEqual(rows.filter((r) => r.special_use === '\\Trash').length, 1);
    assert.equal(byPath['Deleted Items'], '\\Trash');
  } finally {
    env.close();
  }
});

/** What Exchange Online lists (observed: no SPECIAL-USE capability, attributes still sent). */
const EXCHANGE_LIST = [
  entry('INBOX'),
  entry('Archive'),
  entry('Calendar', ['\\HasChildren']),
  entry('Calendar/Birthdays'),
  entry('Calendar/United States holidays'),
  entry('Contacts'),
  entry('Conversation History'),
  entry('Deleted Items', ['\\Trash']),
  entry('Drafts', ['\\Drafts']),
  entry('Journal'),
  entry('Junk Email', ['\\Junk']),
  entry('Notes'),
  entry('Outbox'),
  entry('RSS Subscriptions'),
  entry('Sent Items', ['\\Sent']),
  entry('Sync Issues', ['\\HasChildren']),
  entry('Sync Issues/Conflicts'),
  entry('Sync Issues/Local Failures'),
  entry('Tasks'),
  entry('Kalender'),
  entry('Kontakte'),
  entry('Aufgaben'),
  entry('Notizen'),
  entry('Projects', ['\\HasChildren']),
  entry('Projects/Notes'),
];
const HIDDEN_PATHS = [
  'Calendar',
  'Calendar/Birthdays',
  'Calendar/United States holidays',
  'Contacts',
  'Conversation History',
  'Journal',
  'Notes',
  'Outbox',
  'RSS Subscriptions',
  'Sync Issues',
  'Sync Issues/Conflicts',
  'Sync Issues/Local Failures',
  'Tasks',
  'Kalender',
  'Kontakte',
  'Aufgaben',
  'Notizen',
];

test("Exchange: calendar/contacts/tasks/… folders are 'hidden'; mail folders keep their uses", () => {
  const env = eh.makeEngineEnv();
  try {
    const account = eh.createAccount(env.db, env.crypto, eh.createUser(env.db), {});
    folders.upsertFolders(env.db, account.id, EXCHANGE_LIST, { isExchange: true });
    const rows = Object.fromEntries(env.db.prepare('SELECT * FROM folders WHERE account_id = ?').all(account.id).map((r) => [r.path, r]));
    for (const path of HIDDEN_PATHS) {
      assert.equal(rows[path].sync_mode, 'hidden', path);
      assert.equal(rows[path].special_use, null, path);
      assert.ok(folders.isHiddenFolder(rows[path]));
    }
    for (const path of ['INBOX', 'Archive', 'Deleted Items', 'Drafts', 'Junk Email', 'Sent Items', 'Projects', 'Projects/Notes']) {
      assert.equal(rows[path].sync_mode, 'auto', path);
    }
    assert.equal(rows.Archive.special_use, '\\Archive', 'Exchange sends no \\Archive attribute: the name decides');
    assert.equal(rows['Deleted Items'].special_use, '\\Trash');
    assert.equal(rows['Sent Items'].special_use, '\\Sent');
    assert.equal(rows['Junk Email'].special_use, '\\Junk');

    // Elsewhere "Notes" or "Calendar" is just a mail folder.
    const other = eh.createAccount(env.db, env.crypto, eh.createUser(env.db), {});
    folders.upsertFolders(env.db, other.id, EXCHANGE_LIST);
    assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM folders WHERE account_id = ? AND sync_mode = 'hidden'").get(other.id).n, 0);

    // An account synced before its calendar was recognised: the stored items go.
    const calendar = env.db.prepare("SELECT * FROM folders WHERE account_id = ? AND path = 'Calendar'").get(other.id);
    env.db.prepare("UPDATE folders SET sync_state = '{\"uidValidity\":1,\"lastUid\":1}', last_synced_at = 1 WHERE id = ?").run(calendar.id);
    env.db
      .prepare("INSERT INTO messages (account_id, mailbox, folder_id, uid, uid_validity, date, created_at) VALUES (?, 'Calendar', ?, 1, 1, 0, 0)")
      .run(other.id, calendar.id);
    folders.upsertFolders(env.db, other.id, EXCHANGE_LIST, { isExchange: true });
    const after = env.db.prepare('SELECT * FROM folders WHERE id = ?').get(calendar.id);
    assert.equal(after.sync_mode, 'hidden');
    assert.equal(after.sync_state, null);
    assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(calendar.id).n, 0);

    // Detection: the Outlook preset / Microsoft hosts, Exchange Online capabilities, the greeting.
    assert.equal(imap.isExchange({ provider: 'outlook' }), true);
    assert.equal(imap.isExchange({ provider: 'imap', imap_host: 'outlook.office365.com' }), true);
    assert.equal(imap.isExchange({ provider: 'imap', imap_host: 'mail.example.org' }, { capabilities: new Map([['CLIENTACCESSRULES', true]]) }), true);
    assert.equal(imap.isExchange({ provider: 'imap', imap_host: 'mail.example.org' }, { capabilities: new Map(), greeting: 'The Microsoft Exchange IMAP4 service is ready.' }), true);
    assert.equal(imap.isExchange({ provider: 'imap', imap_host: '127.0.0.1' }, { capabilities: new Map([['IMAP4rev1', true]]), greeting: 'Dovecot ready.' }), false);
  } finally {
    env.close();
  }
});

test('hidden folders: not in GET /api/folders, "not found" for folder routes, never a move target', async (t) => {
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const user = await signupUser(alice, { email: 'alice@example.com' });
  const account = seedAccount(srv.db, srv.crypto, user.id, { provider: 'outlook', email: 'me@contoso.example' });
  seedFolder(srv.db, account.id, 'INBOX');
  const calendar = seedFolder(srv.db, account.id, 'Calendar', { sync_mode: 'hidden' });
  const work = seedFolder(srv.db, account.id, 'Work');

  const tree = (await alice.get('/api/folders')).body.accounts[0].folders.map((f) => f.path);
  assert.deepEqual(tree.sort(), ['INBOX', 'Work']);
  for (const [method, path] of [
    ['post', `/api/folders/${calendar.id}/sync`],
    ['post', `/api/folders/${calendar.id}/backfill`],
    ['post', `/api/folders/${calendar.id}/empty`],
    ['patch', `/api/folders/${calendar.id}`],
    ['del', `/api/folders/${calendar.id}`],
  ]) {
    const res = method === 'patch' ? await alice.patch(path, { name: 'x' }) : await alice[method](path, {});
    assert.equal(res.status, 404, `${method} ${path}`);
  }

  // The engine refuses a hidden destination before connecting anywhere.
  const message = seedMessage(srv.db, account.id, { mailbox: 'Work', folder_id: work.id, uid: 5 });
  const deps = { db: srv.db, crypto: srv.crypto, config: srv.config };
  await assert.rejects(actions.moveMessages(deps, account, 'Work', [message.uid], 'Calendar'), (err) => err.status === 400 && err.code === 'INVALID_TARGET');
});

test('DELETE /api/folders/:id refuses a non-empty folder with the message count incl. subfolders', async (t) => {
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const user = await signupUser(alice, { email: 'alice@example.com' });
  const account = seedAccount(srv.db, srv.crypto, user.id, {});
  seedFolder(srv.db, account.id, 'INBOX');
  const work = seedFolder(srv.db, account.id, 'Work', { total_count: 3 });
  const clients = seedFolder(srv.db, account.id, 'Work/Clients', { total_count: 1 });
  for (const uid of [1, 2]) seedMessage(srv.db, account.id, { mailbox: 'Work/Clients', folder_id: clients.id, uid });

  const res = await alice.del(`/api/folders/${work.id}`);
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'FOLDER_NOT_EMPTY');
  assert.equal(res.body.count, 5, '3 (server count) + 2 (stored here, more than the stale count of 1)');
  assert.equal(res.body.subfolders, 1);
  assert.match(res.body.error, /5 messages and 1 subfolder/);

  const leaf = seedFolder(srv.db, account.id, 'Old', { total_count: 0 });
  seedMessage(srv.db, account.id, { mailbox: 'Old', folder_id: leaf.id, uid: 9 });
  const one = await alice.del(`/api/folders/${leaf.id}`);
  assert.equal(one.status, 409);
  assert.equal(one.body.count, 1);
  assert.equal(one.body.subfolders, 0);
});

test('error details: only plain values with safe names reach the JSON body', async () => {
  const { createErrorHandler, HttpError } = require('../src/middleware');
  const handler = createErrorHandler({ error() {} });
  const err = new HttpError(409, 'Nope', 'X');
  err.details = { count: 3, ok: true, note: 'hi', error: 'overwrite?', code: 'Y', nested: { a: 1 }, __proto__x: 1, 'bad key': 2, inf: Infinity };
  let body;
  handler(err, { method: 'GET', originalUrl: '/' }, { headersSent: false, status() { return this; }, json(b) { body = b; } }, () => {});
  assert.deepEqual(body, { error: 'Nope', code: 'X', count: 3, ok: true, note: 'hi' });
});

// ---------------------------------------------------------------------------------------------
// Sync against Dovecot, made to look like Exchange (q1)
// ---------------------------------------------------------------------------------------------

test('sync (Exchange-like server): hidden folders are never STATUSed, opened or stored', async (t) => {
  if (!(await gh.dovecotAvailable())) return t.skip('IMAP test server (127.0.0.1:1143) not reachable');
  const release = await gh.lockUsers();
  t.after(release);
  await gh.resetUser('q1');
  t.after(() => gh.resetUser('q1'));
  await gh.withUser('q1', async (client) => {
    for (const box of ['Calendar', 'Calendar/Birthdays', 'Contacts', 'Sync Issues', 'Sync Issues/Conflicts', 'Work']) await client.mailboxCreate(box);
  });
  await gh.append('q1', 'Calendar', { subject: 'not mail' });
  await gh.append('q1', 'Calendar/Birthdays', { subject: 'not mail either' });
  await gh.append('q1', 'Work', { subject: 'real mail' });
  await gh.append('q1', 'INBOX', { subject: 'inbox mail' });

  const env = eh.makeEngineEnv();
  t.after(() => env.close());
  const manager = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: eh.recordingLogger() });
  t.after(() => manager.stop());
  const account = eh.createAccount(env.db, env.crypto, eh.createUser(env.db), gh.accountFields('q1'));

  // Make Dovecot look like Exchange Online: its capability marker, and no LIST-STATUS.
  const statusCalls = [];
  const opened = [];
  const original = imap.withImap;
  imap.withImap = (deps, acc, fn, limits) =>
    original(
      deps,
      acc,
      async (client) => {
        client.capabilities.set('CLIENTACCESSRULES', true);
        client.capabilities.delete('LIST-STATUS');
        const status = client.status.bind(client);
        client.status = (path, query) => {
          statusCalls.push(path);
          return status(path, query);
        };
        const lock = client.getMailboxLock.bind(client);
        client.getMailboxLock = (path, opts) => {
          opened.push(path);
          return lock(path, opts);
        };
        return fn(client);
      },
      limits
    );
  t.after(() => {
    imap.withImap = original;
  });

  const result = await manager.syncAccount(account.id);
  assert.equal(result.ok, true, result.error);
  const rows = Object.fromEntries(env.db.prepare('SELECT * FROM folders WHERE account_id = ?').all(account.id).map((r) => [r.path, r]));
  const hidden = ['Calendar', 'Calendar/Birthdays', 'Contacts', 'Sync Issues', 'Sync Issues/Conflicts'];
  for (const path of hidden) {
    assert.equal(rows[path].sync_mode, 'hidden', path);
    assert.ok(!statusCalls.includes(path), `no STATUS for ${path}`);
    assert.ok(!opened.includes(path), `${path} never opened`);
  }
  assert.ok(statusCalls.includes('Work') && statusCalls.includes('Sent'), 'mail folders still get their STATUS');
  assert.equal(rows.Work.total_count, 1);
  const subjects = env.db.prepare('SELECT subject FROM messages WHERE account_id = ? ORDER BY subject').all(account.id).map((r) => r.subject);
  assert.deepEqual(subjects, ['inbox mail', 'real mail']);

  // Opening one directly does nothing either.
  const direct = await manager.syncFolder(rows.Calendar.id);
  assert.equal(direct.ok, true);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(rows.Calendar.id).n, 0);
  assert.deepEqual(await manager.backfillFolder(rows.Calendar.id, { count: 10 }), { added: 0, hasOlder: false });
});
