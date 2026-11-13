'use strict';

// What the composer relies on: incomplete drafts save (sending still needs a recipient), a
// draft follows a From switch to the new account, servers without UIDPLUS still give each draft
// its UID (no duplicates), attachment references come back with filename/type/size, and the
// SMTP SIZE limit is enforced before sending (never retried). IMAP: q1, q2 on Dovecot.

const test = require('node:test');
const assert = require('node:assert/strict');

const imap = require('../src/imap');
const smtp = require('../src/smtp');
const { startTestServer, makeClient, signupUser, seedAccount, seedMessage, waitUntil } = require('./helpers');
const { startSmtpServer } = require('./send-helpers');
const eh = require('./engine-helpers');
const gh = require('./gaps-helpers');

const pause = () => new Promise((resolve) => setTimeout(resolve, 1100)); // drafts: 1 save per second

let available = false;
let release = () => {};
test.before(async () => {
  available = await gh.dovecotAvailable();
  if (!available) return;
  release = await gh.lockUsers();
  await gh.resetUser('q1');
  await gh.resetUser('q2');
});
test.after(async () => {
  try {
    if (available) {
      await gh.resetUser('q1');
      await gh.resetUser('q2');
    }
  } finally {
    release();
  }
});

async function setup(t, { stubSync = true } = {}) {
  const srv = await startTestServer({}, { stubSync });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const user = await signupUser(alice, { email: 'alice@example.com', name: 'Alice' });
  const account = (name) =>
    seedAccount(srv.db, srv.crypto, user.id, { ...gh.accountFields(name), smtp_host: '127.0.0.1', smtp_port: 2525, smtp_security: 'none' });
  return { srv, alice, user, account };
}

function imapTest(name, fn) {
  test(name, async (t) => {
    if (!available) return t.skip('IMAP test server (127.0.0.1:1143) not reachable');
    await gh.resetUser('q1');
    await gh.resetUser('q2');
    await fn(t);
  });
}

// ---------------------------------------------------------------------------------------------

imapTest('an empty draft saves (no recipients, subject or body); sending still needs a recipient', async (t) => {
  const { alice, account } = await setup(t);
  const q1 = account('q1');

  const first = await alice.post('/api/drafts', { payload: { accountId: q1.id } });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.ok(Number.isInteger(first.body.draft.folderId) && Number.isInteger(first.body.draft.uid));
  await pause();
  const second = await alice.post('/api/drafts', {
    payload: { accountId: q1.id, to: [], cc: [], bcc: [], subject: '', html: '', attachments: [] },
    draft: first.body.draft,
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  const drafts = await gh.messagesIn('q1', 'Drafts');
  assert.equal(drafts.length, 1, 'the second save replaced the first');
  assert.ok(drafts[0].flags.has('\\Draft'));

  const send = await alice.post('/api/send', { payload: { accountId: q1.id, subject: 'No one to send to', html: '<p>x</p>' } });
  assert.equal(send.status, 400);
  assert.equal(send.body.code, 'INVALID_COMPOSE');
  assert.match(send.body.error, /recipient/);
});

imapTest('switching From: the draft leaves the old account and is saved in the new one', async (t) => {
  const { srv, alice, account } = await setup(t);
  const q1 = account('q1');
  const q2 = account('q2');

  const saved = await alice.post('/api/drafts', { payload: { accountId: q1.id, subject: 'Moving draft', to: [{ name: '', address: 'bob@example.org' }] } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal((await gh.messagesIn('q1', 'Drafts')).length, 1);
  await pause();
  const moved = await alice.post('/api/drafts', { payload: { accountId: q2.id, subject: 'Moving draft', to: [{ name: '', address: 'bob@example.org' }] }, draft: saved.body.draft });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  const q2Drafts = srv.db.prepare("SELECT id FROM folders WHERE account_id = ? AND special_use = '\\Drafts'").get(q2.id);
  assert.equal(moved.body.draft.folderId, q2Drafts.id);
  assert.notEqual(moved.body.draft.folderId, saved.body.draft.folderId);
  assert.equal((await gh.messagesIn('q1', 'Drafts')).length, 0, 'removed from its own (old) account');
  const inQ2 = await gh.messagesIn('q2', 'Drafts');
  assert.equal(inQ2.length, 1);
  assert.match(inQ2[0].source.toString('utf8'), /^Subject: Moving draft\r?$/m);

  // A draft reference into another user's folder is refused and deletes nothing there.
  const mallory = makeClient(srv.baseUrl);
  const malloryUser = await signupUser(mallory, { email: 'mallory@example.com' });
  const theirs = seedAccount(srv.db, srv.crypto, malloryUser.id, { ...gh.accountFields('q2'), smtp_host: '127.0.0.1', smtp_port: 2525, smtp_security: 'none' });
  await pause();
  const theirDraft = await mallory.post('/api/drafts', { payload: { accountId: theirs.id, subject: 'Mallory' } });
  assert.equal(theirDraft.status, 200);
  await pause();
  const forged = await alice.post('/api/drafts', { payload: { accountId: q1.id, subject: 'x' }, draft: theirDraft.body.draft });
  assert.equal(forged.status, 404);
  assert.equal((await gh.messagesIn('q2', 'Drafts')).length, 2, "the other user's draft is untouched");
});

imapTest('a server without UIDPLUS: each draft gets its UID by Message-ID, so autosave never duplicates', async (t) => {
  const { alice, account } = await setup(t);
  const q1 = account('q1');
  // Dovecot without APPENDUID: append() reports no uid (as on servers without UIDPLUS).
  const searches = [];
  const original = imap.withImap;
  imap.withImap = (deps, acc, fn, limits) =>
    original(
      deps,
      acc,
      async (client) => {
        const append = client.append.bind(client);
        client.append = async (...args) => {
          const res = await append(...args);
          return res ? { destination: res.destination || args[0] } : res;
        };
        const search = client.search.bind(client);
        client.search = async (query, opts) => {
          searches.push(query);
          return search(query, opts);
        };
        return fn(client);
      },
      limits
    );
  t.after(() => {
    imap.withImap = original;
  });

  let draft = null;
  const uids = [];
  for (const subject of ['v1', 'v2', 'v3']) {
    const res = await alice.post('/api/drafts', { payload: { accountId: q1.id, subject }, draft });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Number.isInteger(res.body.draft.uid), 'uid found without APPENDUID');
    draft = res.body.draft;
    uids.push(draft.uid);
    await pause();
  }
  assert.ok(searches.some((q) => q.header && q.header['message-id']), 'looked up by Message-ID');
  const left = await gh.messagesIn('q1', 'Drafts');
  assert.deepEqual(left.map((m) => m.uid), [uids[2]]);
  assert.match(left[0].source.toString('utf8'), /^Subject: v3\r?$/m);
});

imapTest('attachment refs carry filename, contentType and size: forward prefill, reopened draft, cancelled send', async (t) => {
  const { srv, alice, account } = await setup(t, { stubSync: false });
  const q1 = account('q1');
  const original = seedMessage(srv.db, q1.id, {
    subject: 'Report',
    attachments: [{ index: 0, filename: 'report.pdf', contentType: 'application/pdf', size: 1234, inline: false }],
  });
  const forward = await alice.get(`/api/compose/prepare?mode=forward&messageId=${original.id}`);
  assert.equal(forward.status, 200);
  assert.deepEqual(forward.body.payload.attachments, [{ messageId: original.id, index: 0, filename: 'report.pdf', contentType: 'application/pdf', size: 1234 }]);

  const up = await alice.raw('/api/uploads', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-filename': encodeURIComponent('notes ü.txt') }, body: 'hello world' }, { csrf: true });
  assert.equal(up.status, 201);
  const uploadId = up.body.upload.id;

  // Cancelled (undo) send: the payload comes back with names, types and sizes.
  const queued = await alice.post('/api/send', {
    payload: { accountId: q1.id, to: [{ name: '', address: 'bob@example.org' }], subject: 'Fwd: Report', attachments: [{ uploadId }, { messageId: original.id, index: 0 }] },
    sendAt: Date.now() + 3600 * 1000,
  });
  assert.equal(queued.status, 202, JSON.stringify(queued.body));
  const cancelled = await alice.post(`/api/outbox/${queued.body.outbox.id}/cancel`);
  assert.equal(cancelled.status, 200);
  assert.deepEqual(cancelled.body.payload.attachments, [
    { uploadId, filename: 'notes ü.txt', contentType: 'text/plain', size: 11 },
    { messageId: original.id, index: 0, filename: 'report.pdf', contentType: 'application/pdf', size: 1234 },
  ]);

  // A draft with an attachment, synced like any message and reopened.
  const saved = await alice.post('/api/drafts', { payload: { accountId: q1.id, subject: 'With file', attachments: [{ uploadId }] } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const sync = await alice.post(`/api/folders/${saved.body.draft.folderId}/sync`);
  assert.equal(sync.status, 200);
  const row = await waitUntil(() => srv.db.prepare('SELECT id FROM messages WHERE folder_id = ? AND uid = ?').get(saved.body.draft.folderId, saved.body.draft.uid), { what: 'draft synced' });
  const reopened = await alice.get(`/api/compose/prepare?mode=draft&messageId=${row.id}`);
  assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
  assert.deepEqual(reopened.body.draft, saved.body.draft);
  assert.equal(reopened.body.payload.attachments.length, 1);
  const [att] = reopened.body.payload.attachments;
  assert.equal(att.messageId, row.id);
  assert.equal(att.filename, 'notes ü.txt');
  assert.equal(att.contentType, 'text/plain');
  assert.equal(att.size, 11);
});

// ---------------------------------------------------------------------------------------------
// SMTP SIZE and permanent failures (no IMAP needed)
// ---------------------------------------------------------------------------------------------

test('SMTP SIZE: a message over the advertised limit fails before it is sent, "too large for <server>"', async (t) => {
  const server = await startSmtpServer({ passwords: { 'me@example.com': 'pw' }, size: 2000 });
  t.after(() => server.close());
  const env = eh.makeEngineEnv();
  t.after(() => env.close());
  const account = eh.createAccount(env.db, env.crypto, eh.createUser(env.db), {
    email: 'me@example.com',
    imap_user: 'me@example.com',
    password: 'pw',
    smtp_host: '127.0.0.1',
    smtp_port: server.port,
    smtp_security: 'none',
  });
  const raw = Buffer.concat([Buffer.from('From: me@example.com\r\nTo: bob@example.org\r\nSubject: big\r\n\r\n'), Buffer.alloc(5000, 'a')]);
  await assert.rejects(smtp.sendRaw(env, account, { from: 'me@example.com', recipients: ['bob@example.org'], raw }), (err) => {
    assert.equal(err.retryable, false);
    assert.equal(err.cause.code, 'EMESSAGE', 'refused by the client before MAIL FROM / DATA');
    assert.match(err.message, /too large for 127\.0\.0\.1 \(it accepts at most 2 KB per message/);
    return true;
  });
  assert.equal(server.messages.length, 0);
  // A message under the limit announces its size and goes through.
  const small = Buffer.from('From: me@example.com\r\nTo: bob@example.org\r\nSubject: small\r\n\r\nhi\r\n');
  const ok = await smtp.sendRaw(env, account, { from: 'me@example.com', recipients: ['bob@example.org'], raw: small });
  assert.deepEqual(ok.accepted, ['bob@example.org']);

  // With a known provider the message names it.
  const gmail = smtp.friendlySmtpError({ code: 'EMESSAGE', message: 'Message size larger than allowed 35882577', command: 'MAIL FROM', smtpHost: 'smtp.gmail.com' });
  assert.match(gmail, /^This message is too large for Gmail \(it accepts at most 34 MB per message/);
  const outlook = smtp.friendlySmtpError({ code: 'EMESSAGE', message: 'Message size larger than allowed 36700160', smtpHost: 'smtp.office365.com' });
  assert.match(outlook, /too large for Outlook/);
});

test('outbox: permanent SMTP failures (size, 535 5.7.3, 5.7.139, 550 5.7.30) are not retried', async (t) => {
  const { OutboxManager } = require('../src/outbox');
  const env = eh.makeEngineEnv();
  t.after(() => env.close());
  const servers = {
    size: await startSmtpServer({ passwords: { 'me@example.com': 'pw' }, size: 500 }),
    auth: await startSmtpServer({ authError: '5.7.3 Authentication unsuccessful' }),
    disabled: await startSmtpServer({ authError: '5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant.' }),
    basic: await startSmtpServer({ authError: '5.7.30 Basic authentication is not supported for Client Submission.' }),
  };
  t.after(() => Promise.all(Object.values(servers).map((s) => s.close())));
  const manager = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: eh.recordingLogger(), sentCopyCheckDelayMs: 0 });
  t.after(() => manager.stop());
  const userId = eh.createUser(env.db);
  env.db.prepare("INSERT INTO user_settings (user_id, settings) VALUES (?, '{\"undoSendSeconds\":0}')").run(userId);
  const expected = { size: /too large/, auth: /rejected the username or password/, disabled: /administrator has turned off/, basic: /no longer accepts passwords/ };
  for (const [kind, server] of Object.entries(servers)) {
    const account = eh.createAccount(env.db, env.crypto, userId, {
      email: `${kind}@example.com`,
      imap_user: 'me@example.com',
      password: 'pw',
      smtp_host: '127.0.0.1',
      smtp_port: server.port,
      smtp_security: 'none',
    });
    const row = manager.queue(userId, { accountId: account.id, to: [{ address: 'bob@example.org' }], subject: 'x', html: `<p>${'y'.repeat(800)}</p>` });
    await manager.sendDue();
    await manager.idle();
    const after = env.db.prepare('SELECT * FROM outbox WHERE id = ?').get(row.id);
    assert.equal(after.status, 'failed', kind);
    assert.equal(after.attempts, 1, kind);
    assert.match(after.error, expected[kind], kind);
    assert.doesNotMatch(after.error, /Trying again/, kind);
  }
});
