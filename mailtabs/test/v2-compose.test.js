'use strict';

// ROUTES v2, no IMAP: compose prefills, uploads, drafts (validation + rate limit), sending into
// the outbox, the outbox endpoints and undo tokens — seeded rows, stubbed sync, an outbox that is
// not started (nothing is actually sent here; see v2-e2e.test.js for real sending).

const test = require('node:test');
const assert = require('node:assert/strict');

const actions = require('../src/actions');
const { startTestServer, makeClient, signupUser, seedAccount, seedMessage, seedFolder } = require('./helpers');

async function setup(t, options = {}) {
  const srv = await startTestServer({}, { stubSync: true, ...options });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  const aliceUser = await signupUser(alice, { email: 'alice@example.com', name: 'Alice' });
  const malloryUser = await signupUser(mallory, { email: 'mallory@example.com' });
  return { srv, alice, mallory, aliceUser, malloryUser };
}

/** A password account that can send (its own SMTP server; nothing listens there in these tests). */
function sendingAccount(srv, userId, overrides = {}) {
  return seedAccount(srv.db, srv.crypto, userId, { smtp_host: '127.0.0.1', smtp_port: 2525, smtp_security: 'none', ...overrides });
}

const MB = 1024 * 1024;

function upload(client, body, { filename, type = 'application/octet-stream', headers = {} } = {}) {
  const h = { 'content-type': type, ...headers };
  if (filename !== undefined) h['x-filename'] = filename;
  return client.raw('/api/uploads', { method: 'POST', headers: h, body }, { csrf: true });
}

// ---------------------------------------------------------------------------------------------
// Compose prefill
// ---------------------------------------------------------------------------------------------

test('compose prepare: new / reply / replyAll / forward, From = the receiving account, cross-user 404', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  assert.equal((await alice.get('/api/compose/prepare?mode=new')).body.code, 'NO_ACCOUNTS');

  const cannotSend = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'old@x.example' });
  const work = sendingAccount(srv, aliceUser.id, { email: 'me@work.example', signature_html: '<p>-- Alice at work</p>' });
  const original = seedMessage(srv.db, work.id, {
    subject: 'Re: Re: Budget',
    from_name: 'Bob',
    from_address: 'bob@b.example',
    to: [
      { name: 'Me', address: 'me@work.example' },
      { name: 'Carol', address: 'carol@c.example' },
    ],
    cc: [
      { name: '', address: 'OLD@x.example' },
      { name: 'Dan', address: 'dan@d.example' },
    ],
    message_id: '<budget-3@b.example>',
    references_json: JSON.stringify(['<budget-1@b.example>', '<budget-2@b.example>']),
    html_body: '<p>The numbers <b>attached</b>.</p>',
    attachments: [
      { index: 0, filename: 'logo.png', contentType: 'image/png', size: 5, cid: 'logo', inline: true },
      { index: 1, filename: 'q3.xlsx', contentType: 'application/vnd.ms-excel', size: 100, cid: null, inline: false },
    ],
  });

  const prepare = (client, qs) => client.get(`/api/compose/prepare${qs}`);

  // New: the first account that can send, with its signature.
  const fresh = await prepare(alice, '?mode=new');
  assert.equal(fresh.status, 200, JSON.stringify(fresh.body));
  assert.equal(fresh.body.payload.accountId, work.id);
  assert.match(fresh.body.payload.html, /Alice at work/);
  assert.equal(fresh.body.draft, null);
  assert.equal((await prepare(alice, `?mode=new&accountId=${cannotSend.id}`)).body.payload.accountId, cannotSend.id);

  const reply = (await prepare(alice, `?mode=reply&messageId=${original.id}`)).body.payload;
  assert.equal(reply.accountId, work.id, 'answered from the account that received it');
  assert.deepEqual(reply.to, [{ name: 'Bob', address: 'bob@b.example' }]);
  assert.deepEqual(reply.cc, []);
  assert.equal(reply.subject, 'Re: Budget', 'no stacked Re:');
  assert.equal(reply.inReplyTo, '<budget-3@b.example>');
  assert.deepEqual(reply.references, ['<budget-1@b.example>', '<budget-2@b.example>', '<budget-3@b.example>']);
  assert.equal(reply.replyToMessageId, original.id);
  assert.match(reply.html, /<blockquote type="cite"/);
  assert.match(reply.html, /The numbers <b>attached<\/b>/);

  const all = (await prepare(alice, `?mode=replyAll&messageId=${original.id}`)).body.payload;
  assert.deepEqual(all.to.map((r) => r.address), ['bob@b.example', 'carol@c.example'], 'own address dropped');
  assert.deepEqual(all.cc.map((r) => r.address), ['dan@d.example'], "the user's other account dropped too (case-insensitive)");

  const fwd = (await prepare(alice, `?mode=forward&messageId=${original.id}`)).body.payload;
  assert.equal(fwd.subject, 'Fwd: Re: Re: Budget');
  assert.deepEqual(fwd.to, []);
  assert.deepEqual(fwd.attachments.map((a) => [a.messageId, a.index, a.filename]), [[original.id, 1, 'q3.xlsx']], 'non-inline attachments only');
  assert.match(fwd.html, /Forwarded message/);
  assert.equal(fwd.forwardOfMessageId, original.id);

  // A deferred body is downloaded first so the quote is complete.
  const deferred = seedMessage(srv.db, work.id, { body_state: 'deferred', text_body: null });
  await prepare(alice, `?mode=reply&messageId=${deferred.id}`);
  assert.deepEqual(srv.syncManager.calls.fetchBodyNow, [deferred.id]);

  // Validation and ownership.
  assert.equal((await prepare(alice, '?mode=sideways')).body.code, 'INVALID_MODE');
  assert.equal((await prepare(alice, '?mode=reply')).status, 400, 'messageId required');
  assert.equal((await prepare(alice, '?mode=reply&messageId=999999')).status, 404);
  seedAccount(srv.db, srv.crypto, (await signupUser(makeClient(srv.baseUrl))).id); // a third user with an account
  const malloryAccount = sendingAccount(srv, malloryUser.id, { email: 'm@x.example' });
  for (const mode of ['reply', 'replyAll', 'forward', 'draft']) {
    const res = await prepare(mallory, `?mode=${mode}&messageId=${original.id}`);
    assert.equal(res.status, 404, `${mode}: ${JSON.stringify(res.body)}`);
  }
  assert.equal((await prepare(mallory, `?mode=new&accountId=${work.id}`)).status, 404);
  assert.equal((await prepare(alice, `?mode=new&accountId=${malloryAccount.id}`)).status, 404);
  assert.equal((await makeClient(srv.baseUrl).get('/api/compose/prepare?mode=new')).status, 401);
});

// ---------------------------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------------------------

test('uploads: raw bodies of any type, X-Filename decoding, size limits, quota, ownership', async (t) => {
  const { srv, alice, mallory, aliceUser } = await setup(t);

  const pdf = await upload(alice, Buffer.from('%PDF-1.4 hello'), { filename: encodeURIComponent('✓ résumé.pdf'), type: 'application/pdf' });
  assert.equal(pdf.status, 201, JSON.stringify(pdf.body));
  assert.deepEqual({ ...pdf.body.upload, id: typeof pdf.body.upload.id }, { id: 'string', filename: '✓ résumé.pdf', contentType: 'application/pdf', size: 14 });

  // A JSON file is a file, not a request body to parse.
  const json = await upload(alice, '{"not":"parsed"}', { filename: 'data.json', type: 'application/json' });
  assert.equal(json.status, 201);
  assert.equal(json.body.upload.size, 16);
  assert.equal(json.body.upload.contentType, 'application/json');
  // Bad percent-encoding is used as it came; paths and control characters are cleaned.
  assert.equal((await upload(alice, 'x', { filename: 'bad%zz.txt' })).body.upload.filename, 'bad%zz.txt');
  assert.equal((await upload(alice, 'x', { filename: encodeURIComponent('../../etc/passwd') })).body.upload.filename, 'passwd');
  assert.equal((await upload(alice, 'x', { filename: encodeURIComponent('a\r\nb.txt') })).body.upload.filename, 'ab.txt');
  assert.equal((await upload(alice, 'x')).body.upload.filename, 'attachment', 'no name given');
  const emptyFile = await upload(alice, Buffer.alloc(0), { filename: 'empty.txt', type: 'text/plain; charset=utf-8' });
  assert.equal(emptyFile.status, 201);
  assert.deepEqual([emptyFile.body.upload.size, emptyFile.body.upload.contentType], [0, 'text/plain']);

  // Files are stored privately, named by their random id.
  const row = srv.db.prepare('SELECT * FROM uploads WHERE id = ?').get(pdf.body.upload.id);
  assert.equal(row.user_id, aliceUser.id);
  assert.equal(require('path').basename(row.path), row.id);
  assert.equal(require('fs').statSync(row.path).mode & 0o777, 0o600);

  // CSRF header and a session are required (before any body is read).
  assert.equal((await alice.raw('/api/uploads', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status, 403);
  assert.equal((await upload(makeClient(srv.baseUrl), 'x', { filename: 'a.txt' })).status, 401);

  // Too large: refused from Content-Length alone, or after reading (chunked bodies).
  const big = await upload(alice, Buffer.alloc(25 * MB + 1), { filename: 'big.bin' });
  assert.equal(big.status, 413);
  assert.equal(big.body.code, 'UPLOAD_TOO_LARGE');
  const chunked = (size) =>
    alice.raw(
      '/api/uploads',
      {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream', 'x-filename': 'stream.bin' },
        body: new ReadableStream({
          start(controller) {
            for (let sent = 0; sent < size; sent += MB) controller.enqueue(new Uint8Array(Math.min(MB, size - sent)));
            controller.close();
          },
        }),
        duplex: 'half',
      },
      { csrf: true }
    );
  for (const size of [25 * MB + 1, 27 * MB]) {
    const res = await chunked(size);
    assert.equal(res.status, 413, `${size}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.code, 'UPLOAD_TOO_LARGE');
  }

  // Per-user quota of pending uploads (checked from Content-Length before reading the body).
  srv.db
    .prepare("INSERT INTO uploads (id, user_id, filename, content_type, size, path, created_at) VALUES (?, ?, 'old.bin', 'application/octet-stream', ?, '/nonexistent/x', ?)")
    .run('q'.repeat(24), aliceUser.id, 250 * MB - 20, Date.now());
  const over = await upload(alice, Buffer.alloc(100), { filename: 'one-more.bin' });
  assert.equal(over.status, 413);
  assert.equal(over.body.code, 'UPLOAD_QUOTA');
  assert.equal((await upload(mallory, Buffer.alloc(100), { filename: 'fine.bin' })).status, 201, "Mallory's quota is her own");
  srv.db.prepare('DELETE FROM uploads WHERE id = ?').run('q'.repeat(24));

  // Delete: only the owner; an upload a queued message needs stays.
  const id = pdf.body.upload.id;
  assert.equal((await mallory.del(`/api/uploads/${id}`)).status, 404);
  assert.equal((await alice.del('/api/uploads/not-a-valid-id')).status, 404);
  const account = sendingAccount(srv, aliceUser.id);
  const queued = await alice.post('/api/send', { payload: { accountId: account.id, to: [{ address: 'bob@b.example' }], subject: 'x', attachments: [{ uploadId: json.body.upload.id }] } });
  assert.equal(queued.status, 202, JSON.stringify(queued.body));
  assert.equal((await alice.del(`/api/uploads/${json.body.upload.id}`)).body.code, 'UPLOAD_IN_USE');
  const deleted = await alice.del(`/api/uploads/${id}`);
  assert.deepEqual(deleted.body, { ok: true });
  assert.equal(require('fs').existsSync(row.path), false, 'file removed');
  assert.equal((await alice.del(`/api/uploads/${id}`)).status, 404);
});

// ---------------------------------------------------------------------------------------------
// Drafts (validation and ownership; saving against a real server is in v2-imap.test.js)
// ---------------------------------------------------------------------------------------------

test('drafts: ownership checks, draft reference validation, 1 save per second per user', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const mine = sendingAccount(srv, aliceUser.id);
  const theirs = sendingAccount(srv, malloryUser.id, { email: 'm@x.example' });
  const theirDrafts = seedFolder(srv.db, theirs.id, 'Drafts', { specialUse: '\\Drafts' });
  const pause = () => new Promise((resolve) => setTimeout(resolve, 1100));

  const someoneElsesAccount = await alice.post('/api/drafts', { payload: { accountId: theirs.id, subject: 'x' } });
  assert.equal(someoneElsesAccount.status, 404);
  const tooFast = await alice.post('/api/drafts', { payload: { accountId: mine.id, subject: 'x' } });
  assert.equal(tooFast.status, 429);
  assert.equal(tooFast.body.code, 'RATE_LIMITED');
  assert.ok(Number(tooFast.headers.get('retry-after')) >= 1);
  assert.equal((await mallory.post('/api/drafts', { payload: { accountId: mine.id } })).status, 404, 'limits are per user');

  await pause();
  const foreignDraft = await alice.post('/api/drafts', { payload: { accountId: mine.id }, draft: { folderId: theirDrafts.id, uid: 1 } });
  assert.equal(foreignDraft.status, 404, "replacing someone else's draft");
  await pause();
  assert.equal((await alice.post('/api/drafts', { payload: { accountId: mine.id }, draft: { folderId: 'x', uid: 1 } })).body.code, 'INVALID_DRAFT');
  await pause();
  assert.equal((await alice.post('/api/drafts', { payload: 'nope' })).body.code, 'INVALID_COMPOSE');

  assert.equal((await alice.del('/api/drafts', { draft: { folderId: theirDrafts.id, uid: 1 } })).status, 404);
  assert.equal((await alice.del('/api/drafts', {})).body.code, 'INVALID_DRAFT');
  assert.equal((await alice.del('/api/drafts', { draft: { folderId: 1, uid: -4 } })).body.code, 'INVALID_DRAFT');
  assert.equal((await makeClient(srv.baseUrl).post('/api/drafts', { payload: {} })).status, 401);
});

// ---------------------------------------------------------------------------------------------
// Send + outbox
// ---------------------------------------------------------------------------------------------

test('send: validation, ownership, canSend, undo delay and scheduling; outbox endpoints per user', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const account = sendingAccount(srv, aliceUser.id, { email: 'me@work.example' });
  const noSmtp = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'nosmtp@x.example' });
  const theirs = sendingAccount(srv, malloryUser.id, { email: 'm@x.example' });
  const theirDrafts = seedFolder(srv.db, theirs.id, 'Drafts', { specialUse: '\\Drafts' });
  const to = [{ name: 'Bob', address: 'bob@b.example' }];
  const send = (client, body) => client.post('/api/send', body);

  assert.equal((await send(alice, {})).body.code, 'INVALID_COMPOSE');
  assert.equal((await send(alice, { payload: { accountId: account.id, to: [] } })).body.code, 'INVALID_COMPOSE', 'needs a recipient');
  assert.equal((await send(alice, { payload: { accountId: account.id, to: [{ address: 'bob@b.example\r\nBcc: x@evil.example' }] } })).body.code, 'INVALID_COMPOSE');
  assert.equal((await send(alice, { payload: { accountId: theirs.id, to } })).status, 404, "someone else's account");
  assert.equal((await send(alice, { payload: { accountId: noSmtp.id, to } })).body.code, 'SMTP_NOT_CONFIGURED');
  for (const sendAt of [{}, 'whenever', Date.now() + 2 * 366 * 24 * 3600e3, 'x'.repeat(65)]) {
    assert.equal((await send(alice, { payload: { accountId: account.id, to }, sendAt })).body.code, 'INVALID_SEND_AT', JSON.stringify(sendAt));
  }
  const theirUpload = (await upload(mallory, 'secret', { filename: 'm.txt' })).body.upload;
  assert.equal((await send(alice, { payload: { accountId: account.id, to, attachments: [{ uploadId: theirUpload.id }] } })).body.code, 'ATTACHMENT_GONE');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n, 0, 'nothing queued so far');

  // Send now = after the user's undo delay; a draft of someone else is never cleaned up for them.
  await alice.put('/api/settings', { undoSendSeconds: 5 });
  const before = Date.now();
  const now = await send(alice, { payload: { accountId: account.id, to, subject: 'Hello' }, draft: { folderId: theirDrafts.id, uid: 3 } });
  assert.equal(now.status, 202, JSON.stringify(now.body));
  assert.equal(now.body.outbox.status, 'queued');
  assert.ok(now.body.outbox.sendAt >= before + 5000 && now.body.outbox.sendAt <= Date.now() + 5000);
  assert.equal(srv.db.prepare('SELECT draft_folder_id FROM outbox WHERE id = ?').get(now.body.outbox.id).draft_folder_id, null);
  const at = Date.now() + 3600e3;
  const later = await send(alice, { payload: { accountId: account.id, to, subject: 'Later' }, sendAt: new Date(at).toISOString() });
  assert.equal(later.body.outbox.sendAt, at, 'scheduled');

  // Outbox list: newest first, only the user's.
  const list = await alice.get('/api/outbox');
  assert.deepEqual(list.body.items.map((i) => i.subject), ['Later', 'Hello']);
  assert.deepEqual(Object.keys(list.body.items[0]).sort(), ['accountId', 'attempts', 'createdAt', 'error', 'id', 'sendAt', 'sentAt', 'status', 'subject', 'to']);
  assert.deepEqual(list.body.items[1].to, [{ name: 'Bob', address: 'bob@b.example' }]);
  assert.deepEqual((await mallory.get('/api/outbox')).body.items, []);

  // Someone else's outbox rows: 404 for every action, and nothing changes.
  const id = now.body.outbox.id;
  assert.equal((await mallory.post(`/api/outbox/${id}/cancel`, {})).status, 404);
  assert.equal((await mallory.post(`/api/outbox/${id}/retry`, {})).status, 404);
  assert.equal((await mallory.del(`/api/outbox/${id}`)).status, 404);
  assert.equal((await alice.post('/api/outbox/abc/cancel', {})).status, 400);

  // Cancel (undo send) returns the payload for the composer; only once.
  const cancelled = await alice.post(`/api/outbox/${id}/cancel`, {});
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.payload.subject, 'Hello');
  assert.deepEqual(cancelled.body.payload.to, to);
  assert.equal(cancelled.body.draft, null);
  assert.equal((await alice.post(`/api/outbox/${id}/cancel`, {})).body.code, 'TOO_LATE');
  assert.equal((await alice.post(`/api/outbox/${later.body.outbox.id}/retry`, {})).body.code, 'NOT_FAILED');
  srv.db.prepare("UPDATE outbox SET status = 'failed', error = 'boom' WHERE id = ?").run(later.body.outbox.id);
  const retried = await alice.post(`/api/outbox/${later.body.outbox.id}/retry`, {});
  assert.equal(retried.body.outbox.status, 'queued');
  assert.equal(retried.body.outbox.error, null);
  assert.deepEqual((await alice.del(`/api/outbox/${later.body.outbox.id}`)).body, { ok: true });
  assert.deepEqual((await alice.get('/api/outbox')).body.items, []);
  assert.equal((await makeClient(srv.baseUrl).get('/api/outbox')).status, 401);
});

// ---------------------------------------------------------------------------------------------
// Undo tokens (the mail server is replaced by fakes so expiry and ownership can be checked)
// ---------------------------------------------------------------------------------------------

test('undo tokens: owner only, single use, expire after 10 minutes, need new UIDs', async (t) => {
  const { srv, alice, mallory, aliceUser, malloryUser } = await setup(t);
  const account = seedAccount(srv.db, srv.crypto, aliceUser.id);
  const inbox = seedFolder(srv.db, account.id, 'INBOX');
  const archive = seedFolder(srv.db, account.id, 'Archive', { specialUse: '\\Archive' });

  const calls = [];
  const real = { moveToSpecial: actions.moveToSpecial, moveMessages: actions.moveMessages };
  t.after(() => Object.assign(actions, real));
  let reportUids = true;
  actions.moveToSpecial = async (deps, acct, path, uids, target, opts) => {
    calls.push(['moveToSpecial', acct.id, path, uids, target, opts.uidValidity]);
    return { destination: 'Archive', uidMap: reportUids ? Object.fromEntries(uids.map((u) => [u, u + 100])) : {}, uidValidity: 77, deleted: false };
  };
  actions.moveMessages = async (deps, acct, from, uids, to, opts) => {
    calls.push(['moveMessages', acct.id, from, uids, to, opts.uidValidity]);
    return { destination: to, uidMap: {}, uidValidity: null };
  };

  const archiveOne = async () => {
    const m = seedMessage(srv.db, account.id, { folder_id: inbox.id, uid_validity: 5 });
    const res = await alice.post('/api/messages/bulk', { ids: [m.id], action: 'archive' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return { m, res };
  };

  const { m, res } = await archiveOne();
  assert.equal(res.body.count, 1);
  assert.match(res.body.undo, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(srv.db.prepare('SELECT 1 FROM messages WHERE id = ?').get(m.id), undefined, 'gone from the inbox at once');
  assert.deepEqual(srv.syncManager.calls.syncFolder, [{ folderId: archive.id, markOpened: false }], 'the archive picks it up');

  // Someone else's token reads like an expired one, and stays usable for its owner.
  assert.equal((await mallory.post('/api/messages/undo', { token: res.body.undo })).body.code, 'UNDO_EXPIRED');
  assert.equal((await alice.post('/api/messages/undo', { token: 'short' })).body.code, 'INVALID_TOKEN');
  assert.equal((await alice.post('/api/messages/undo', {})).body.code, 'INVALID_TOKEN');
  const undone = await alice.post('/api/messages/undo', { token: res.body.undo });
  assert.deepEqual(undone.body, { ok: true, count: 1, failed: [] });
  assert.deepEqual(calls.at(-1), ['moveMessages', account.id, 'Archive', [m.uid + 100], 'INBOX', 77], 'moved back by the new UIDs');
  assert.ok(srv.syncManager.calls.syncFolder.some((c) => c.folderId === inbox.id), 'the inbox is synced to show it again');
  assert.equal((await alice.post('/api/messages/undo', { token: res.body.undo })).body.code, 'UNDO_EXPIRED', 'single use');

  // Expiry after 10 minutes.
  const second = await archiveOne();
  const realNow = Date.now;
  Date.now = () => realNow() + 10 * 60 * 1000 + 1;
  let expired;
  try {
    expired = await alice.post('/api/messages/undo', { token: second.res.body.undo });
  } finally {
    Date.now = realNow;
  }
  assert.equal(expired.status, 404);
  assert.equal(expired.body.code, 'UNDO_EXPIRED');

  // No new UIDs from the server (no UIDPLUS): nothing to undo with.
  reportUids = false;
  const third = await archiveOne();
  assert.equal(third.res.body.undo, null);

  // Flag changes have no undo; delete forever only from Trash/Spam; moves stay within an account.
  const flagged = await alice.post('/api/messages/bulk', { ids: [seedMessage(srv.db, account.id, { folder_id: inbox.id }).id], action: 'star' });
  assert.equal('undo' in flagged.body, false);
  const keep = seedMessage(srv.db, account.id, { folder_id: inbox.id });
  const forever = await alice.post('/api/messages/bulk', { ids: [keep.id], action: 'delete_forever' });
  assert.equal(forever.body.count, 0);
  assert.match(forever.body.failed[0].error, /Trash or Spam/);
  assert.ok(srv.db.prepare('SELECT 1 FROM messages WHERE id = ?').get(keep.id));
  const other = seedAccount(srv.db, srv.crypto, aliceUser.id, { email: 'other@x.example' });
  const otherFolder = seedFolder(srv.db, other.id, 'Elsewhere');
  const across = await alice.post('/api/messages/bulk', { ids: [keep.id], action: 'move', folderId: otherFolder.id });
  assert.equal(across.body.count, 0);
  assert.deepEqual(across.body.failed, [{ accountId: account.id, error: 'Messages can only be moved to folders of their own account.' }]);
  assert.equal((await alice.post('/api/messages/bulk', { ids: [keep.id], action: 'move' })).status, 400, 'move needs a folderId');
  const malloryFolder = seedFolder(srv.db, seedAccount(srv.db, srv.crypto, malloryUser.id).id, 'Theirs');
  assert.equal((await alice.post('/api/messages/bulk', { ids: [keep.id], action: 'move', folderId: malloryFolder.id })).status, 404);
  // Already where it's going: nothing to do, no server call.
  const callsBefore = calls.length;
  const already = await alice.post('/api/messages/bulk', { ids: [keep.id], action: 'notspam' });
  assert.deepEqual(already.body, { ok: true, count: 0, failed: [], undo: null });
  assert.equal(calls.length, callsBefore);
});
