'use strict';

// ROUTES v2 end to end, against the local Dovecot (r1@test.local, r2@test.local) and an
// in-process SMTP server that delivers into the recipient's Dovecot INBOX:
//   r1 writes to r2 -> r2's account syncs and sees it -> r2 replies (from the reply prefill)
//   -> each side's Sent folder has its copy -> r2's original is marked answered
//   -> both conversations (thread endpoint) hold both messages.
// Two Mailtabs users, one account each, so per-user scoping is exercised on the way.

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
  startSmtpCapture,
  waitUntil,
  IMAP_TEST,
} = require('./helpers');

const R1 = IMAP_TEST.users.r1;
const R2 = IMAP_TEST.users.r2;
const SMTP_PASSWORDS = { [R1.user]: 'r1-smtp-secret', [R2.user]: 'r2-smtp-secret' };

test('end to end: send, receive, reply, Sent copies, answered flag and conversations', async (t) => {
  if (!(await imapAvailable())) return t.skip('IMAP test server not reachable');
  const releaseR1 = await lockTestImapUser('r1');
  t.after(releaseR1);
  const releaseR2 = await lockTestImapUser('r2');
  t.after(releaseR2);
  await resetAllFolders('r1');
  await resetAllFolders('r2');

  const smtp = await startSmtpCapture({ users: SMTP_PASSWORDS, deliverToDovecot: true });
  t.after(() => smtp.close());
  const srv = await startTestServer({}, { outbox: 'auto', outboxOptions: { retryDelayMs: 500 } });
  t.after(() => srv.close());

  const one = makeClient(srv.baseUrl);
  const two = makeClient(srv.baseUrl);
  await signupUser(one, { email: 'one@example.com', name: 'User One' });
  await signupUser(two, { email: 'two@example.com', name: 'User Two' });
  // Send without the undo delay so the test doesn't wait for it.
  for (const client of [one, two]) assert.equal((await client.put('/api/settings', { undoSendSeconds: 0 })).status, 200);

  async function addAccount(client, creds, senderName) {
    const res = await client.post('/api/accounts', {
      provider: 'imap',
      email: creds.user,
      password: creds.pass,
      imapHost: IMAP_TEST.host,
      imapPort: IMAP_TEST.port,
      imapSecurity: 'none',
      smtpHost: '127.0.0.1',
      smtpPort: smtp.port,
      smtpSecurity: 'none',
      smtpPassword: SMTP_PASSWORDS[creds.user],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.warnings, [], 'the SMTP login was checked and works');
    assert.equal(res.body.account.canSend, true);
    const id = res.body.account.id;
    assert.equal((await client.patch(`/api/accounts/${id}`, { senderName })).status, 200);
    const synced = await client.post(`/api/accounts/${id}/sync`, {});
    assert.equal(synced.body.result.ok, true, JSON.stringify(synced.body));
    return id;
  }
  const account1 = await addAccount(one, R1, 'Rita One');
  const account2 = await addAccount(two, R2, 'Rob Two');

  const folderOf = async (client, accountId, specialUse) => {
    const { accounts } = (await client.get('/api/folders')).body;
    return accounts.find((a) => a.accountId === accountId).folders.find((f) => f.specialUse === specialUse);
  };
  const outboxEmpty = (client) => waitUntil(async () => (await client.get('/api/outbox')).body.items.length === 0, { what: 'the outbox to empty' });

  // --- 1. r1 writes to r2 ------------------------------------------------------------------
  const prepared = (await one.get('/api/compose/prepare?mode=new')).body;
  assert.equal(prepared.payload.accountId, account1);
  const subject = `Lunch on Friday? ${Date.now()}`;
  const sent = await one.post('/api/send', {
    payload: { ...prepared.payload, to: [{ name: 'Rob', address: R2.user }], subject, html: '<p>Shall we try the <b>new place</b>?</p>' },
  });
  assert.equal(sent.status, 202, JSON.stringify(sent.body));
  await outboxEmpty(one);
  assert.equal(smtp.messages.length, 1);
  assert.equal(smtp.messages[0].user, R1.user, 'sent with r1\'s own SMTP login');
  assert.deepEqual(smtp.messages[0].to, [R2.user]);
  assert.match(smtp.messages[0].raw.toString('utf8'), /^From: "?Rita One"? <r1@test\.local>/m);

  // The sender's Sent folder gets the copy (this server's SMTP does not file one itself).
  const sentCopy = await waitUntil(async () => (await mailboxMessages('r1', 'Sent')).find((m) => m.envelope.subject === subject), { what: "r1's Sent copy" });
  assert.ok(sentCopy.flags.has('\\Seen'));

  // --- 2. r2 receives it --------------------------------------------------------------------
  assert.equal((await two.post(`/api/accounts/${account2}/sync`, {})).body.result.ok, true);
  const inbox2 = (await two.get('/api/messages?tab=all')).body.messages;
  const received = inbox2.find((m) => m.subject === subject);
  assert.ok(received, JSON.stringify(inbox2));
  assert.equal(received.fromAddress, R1.user);
  assert.equal(received.fromName, 'Rita One');
  assert.equal(received.isAnswered, false);
  assert.ok(received.threadKey);
  // User one can't see user two's mail.
  assert.equal((await one.get(`/api/messages/${received.id}`)).status, 404);
  assert.equal((await one.get(`/api/messages/${received.id}/thread`)).status, 404);

  // --- 3. r2 replies --------------------------------------------------------------------------
  const replyPrefill = await two.get(`/api/compose/prepare?mode=reply&messageId=${received.id}`);
  assert.equal(replyPrefill.status, 200, JSON.stringify(replyPrefill.body));
  const reply = replyPrefill.body.payload;
  assert.equal(reply.accountId, account2);
  assert.deepEqual(reply.to.map((r) => r.address), [R1.user]);
  assert.equal(reply.subject, `Re: ${subject}`);
  assert.match(reply.html, /new place/, 'the original is quoted');
  const replied = await two.post('/api/send', { payload: { ...reply, html: `<p>Yes, 12:30!</p>${reply.html}` } });
  assert.equal(replied.status, 202, JSON.stringify(replied.body));
  await outboxEmpty(two);
  assert.equal(smtp.messages.length, 2);
  const replyRaw = smtp.messages[1].raw.toString('utf8');
  const receivedDetail = (await two.get(`/api/messages/${received.id}`)).body.message;
  assert.ok(receivedDetail.messageId);
  assert.ok(replyRaw.includes(`In-Reply-To: ${receivedDetail.messageId}`), 'threaded with the original');

  // r2's original is marked answered, here and on the server.
  await waitUntil(async () => (await two.get(`/api/messages/${received.id}`)).body.message.isAnswered === true, { what: 'the answered flag' });
  const onServer = await waitUntil(async () => {
    const m = (await mailboxMessages('r2', 'INBOX')).find((x) => x.envelope.subject === subject);
    return m && m.flags.has('\\Answered') ? m : null;
  }, { what: '\\Answered on the server' });
  assert.ok(onServer);
  await waitUntil(async () => (await mailboxMessages('r2', 'Sent')).some((m) => m.envelope.subject === `Re: ${subject}`), { what: "r2's Sent copy" });

  // --- 4. both conversations hold both messages ------------------------------------------------
  assert.equal((await one.post(`/api/accounts/${account1}/sync`, {})).body.result.ok, true);
  const sent1 = await folderOf(one, account1, '\\Sent');
  assert.ok(sent1, 'r1 has a Sent folder');
  assert.equal((await one.post(`/api/folders/${sent1.id}/sync`, {})).body.result.ok, true);
  const replyIn1 = (await one.get('/api/messages?tab=all')).body.messages.find((m) => m.subject === `Re: ${subject}`);
  assert.ok(replyIn1, 'the reply arrived in r1\'s inbox');
  const original1 = (await one.get('/api/messages?view=sent')).body.messages.find((m) => m.subject === subject);
  assert.ok(original1, 'the original is in r1\'s unified Sent view');
  assert.equal(original1.folderId, sent1.id);
  assert.equal(replyIn1.threadKey, original1.threadKey, 'same conversation key');

  const thread1 = await one.get(`/api/messages/${replyIn1.id}/thread`);
  assert.equal(thread1.status, 200);
  assert.deepEqual(thread1.body.messages.map((m) => m.subject), [subject, `Re: ${subject}`], 'oldest first');
  assert.deepEqual(thread1.body.messages.map((m) => m.specialUse), ['\\Sent', '\\Inbox']);

  const sent2 = await folderOf(two, account2, '\\Sent');
  await two.post(`/api/folders/${sent2.id}/sync`, {});
  const replyIn2 = (await two.get(`/api/messages?folder=${sent2.id}`)).body.messages.find((m) => m.subject === `Re: ${subject}`);
  assert.ok(replyIn2);
  const thread2 = await two.get(`/api/messages/${replyIn2.id}/thread`);
  assert.deepEqual(thread2.body.messages.map((m) => m.id), [received.id, replyIn2.id]);

  // Contacts learned from the conversation (sender of received mail, recipient of sent mail).
  assert.deepEqual((await two.get('/api/contacts?q=r1')).body.contacts, [{ name: 'Rita One', address: R1.user }]);
  assert.deepEqual((await one.get('/api/contacts?q=r2')).body.contacts.map((c) => c.address), [R2.user]);
  assert.deepEqual((await one.get('/api/contacts?q=r1')).body.contacts, [], 'never yourself');
});
