'use strict';

/**
 * The outbox end to end: Dovecot (users s1 and s2 only) + an in-process SMTP server that
 * "delivers" mail for s2 into s2's INBOX.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { OutboxManager, getUserSettings, outboxItemJson, sentCopyPolicy, resolveSendAt } = require('../src/outbox');
const drafts = require('../src/drafts');
const uploads = require('../src/uploads');
const {
  imapAvailable,
  lockUsers,
  resetUser,
  appendTo,
  messagesIn,
  startSmtpServer,
  closedPort,
  sendAccount,
  storeMessageRow,
  makeEngineEnv,
  createUser,
  buildMessage,
  parse,
  headerBlock,
  headerLines,
  waitFor,
} = require('./send-helpers');

const quiet = { warn() {}, error() {}, info() {}, debug() {}, log() {} };

let skip = false;
let release = () => {};
let smtpServer;
test.before(async () => {
  skip = !(await imapAvailable());
  if (skip) return;
  release = await lockUsers();
  smtpServer = await startSmtpServer({
    passwords: { 's1@test.local': 's1pw' },
    // Simulated delivery: mail for s2 lands in s2's INBOX.
    deliver: async (raw, envelope) => {
      if (envelope.to.includes('s2@test.local')) await appendTo('s2', 'INBOX', raw);
      if (smtpServer.opts.fileInSent) await appendTo('s1', 'Sent', raw, ['\\Seen']);
    },
  });
});
test.after(async () => {
  if (smtpServer) await smtpServer.close();
  release();
});

async function setup({ undoSendSeconds, provider = 'imap', ...accountOverrides } = {}) {
  await resetUser('s1');
  await resetUser('s2');
  smtpServer.messages.length = 0;
  smtpServer.opts.rejectRecipients = [];
  smtpServer.opts.fileInSent = false;
  const env = makeEngineEnv();
  const userId = createUser(env.db);
  env.db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Sam One', userId);
  if (undoSendSeconds !== undefined) {
    env.db.prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)').run(userId, JSON.stringify({ undoSendSeconds }));
  }
  const account = sendAccount(env, userId, 's1', smtpServer.port, { provider, ...accountOverrides });
  const synced = [];
  const syncManager = { syncFolder: (id, opts) => (synced.push(id), Promise.resolve({ ok: true })) };
  const outbox = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, syncManager, logger: quiet, retryDelayMs: 0, sentCopyCheckDelayMs: 50 });
  const deps = { db: env.db, crypto: env.crypto, config: env.config, syncManager, logger: quiet };
  return { env, deps, userId, account, outbox, synced };
}

function payload(extra = {}) {
  return {
    accountId: extra.accountId,
    to: [{ name: 'Sam Two', address: 's2@test.local' }],
    bcc: [{ name: 'Hidden', address: 'hidden@example.org' }],
    subject: 'Hello from the outbox',
    html: '<p>Hi <b>Sam</b>,</p><p>see attached.</p>',
    ...extra,
  };
}

test('queue -> undo window -> cancel -> send: exact MIME, Sent copy, \\Answered, draft and upload cleanup', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  const { env, deps, userId, account, outbox, synced } = await setup();
  try {
    // The message being replied to, in s1's INBOX.
    const incoming = buildMessage({ from: 'Sam Two <s2@test.local>', to: 's1@test.local', subject: 'Question', text: 'Can you send the notes?', messageId: '<question@test.local>' });
    const { uid: origUid, uidValidity } = await appendTo('s1', 'INBOX', incoming);
    const original = await storeMessageRow(env, account, { mailbox: 'INBOX', uid: origUid, uidValidity, raw: incoming });

    const up = uploads.saveUpload(deps, userId, { filename: 'notes.txt', contentType: 'text/plain', buffer: Buffer.from('the notes') });
    const reply = payload({
      accountId: account.id,
      mode: 'reply',
      subject: 'Re: Question',
      inReplyTo: '<question@test.local>',
      references: ['<question@test.local>'],
      replyToMessageId: original.id,
      attachments: [{ uploadId: up.id }],
    });
    const draft = await drafts.saveDraft(deps, account, reply, null);
    assert.equal((await messagesIn('s1', 'Drafts')).length, 1);

    // Default undo window: 10 s.
    const before = Date.now();
    const row = outbox.queue(userId, reply, { draft });
    assert.equal(row.status, 'queued');
    assert.ok(row.send_at >= before + 10000 && row.send_at <= Date.now() + 10000);
    assert.deepEqual([row.draft_folder_id, row.draft_uid], [draft.folderId, draft.uid]);
    assert.deepEqual(outbox.list(userId).map((r) => r.id), [row.id]);
    await outbox.sendDue();
    assert.equal(smtpServer.messages.length, 0, 'nothing goes out inside the undo window');

    // Undo.
    const undone = outbox.cancelWithDraft(userId, row.id);
    assert.equal(undone.payload.subject, 'Re: Question');
    assert.deepEqual(undone.draft, draft);
    assert.throws(() => outbox.cancel(userId, row.id), (err) => err.status === 409 && err.code === 'TOO_LATE');
    assert.equal(outbox.list(userId).length, 0);
    assert.ok(uploads.getUpload(env.db, userId, up.id), 'uploads survive an undo');

    // Send again, now with no undo delay.
    env.db.prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)').run(userId, JSON.stringify({ undoSendSeconds: 0 }));
    const again = outbox.queue(userId, undone.payload, { draft: undone.draft, sendAt: Date.now() - 1000 });
    assert.ok(again.send_at <= Date.now());
    await outbox.sendDue();
    await outbox.idle();

    // Exactly what the SMTP server received.
    assert.equal(smtpServer.messages.length, 1);
    const sent = smtpServer.messages[0];
    assert.equal(sent.from, 's1@test.local');
    assert.deepEqual(sent.to.sort(), ['hidden@example.org', 's2@test.local']);
    const head = headerBlock(sent.raw);
    assert.ok(!/^bcc:/im.test(head), 'Bcc not in the headers of sent mail');
    assert.deepEqual(headerLines(sent.raw, 'In-Reply-To'), ['In-Reply-To: <question@test.local>']);
    assert.deepEqual(headerLines(sent.raw, 'References'), ['References: <question@test.local>']);
    const parsed = await parse(sent.raw);
    assert.equal(parsed.from.value[0].name, 'Sam One');
    assert.equal(parsed.from.value[0].address, 's1@test.local');
    assert.equal(parsed.subject, 'Re: Question');
    assert.match(parsed.html, /<b>Sam<\/b>/);
    assert.match(parsed.text, /Hi Sam,/);
    assert.deepEqual(parsed.attachments.map((a) => [a.filename, a.content.toString()]), [['notes.txt', 'the notes']]);
    assert.match(sent.raw.toString(), /multipart\/mixed[\s\S]*multipart\/alternative/);

    const done = env.db.prepare('SELECT * FROM outbox WHERE id = ?').get(again.id);
    assert.equal(done.status, 'sent');
    assert.ok(done.sent_at >= again.created_at);
    assert.equal(done.sent_message_id, parsed.messageId);
    assert.equal(done.error, null);
    assert.equal(outbox.list(userId).length, 0, 'sent messages leave the outbox list');

    // Delivered to s2.
    const s2Inbox = await messagesIn('s2', 'INBOX');
    assert.equal(s2Inbox.length, 1);
    assert.equal(s2Inbox[0].envelope.subject, 'Re: Question');

    // Copy in s1's Sent (Other-IMAP account with a \Sent folder), once, flagged \Seen.
    const sentFolder = await messagesIn('s1', 'Sent');
    assert.equal(sentFolder.length, 1);
    assert.ok(sentFolder[0].flags.has('\\Seen'));
    const trimEnd = (b) => b.toString().replace(/(\r\n)+$/, '');
    assert.equal(trimEnd(sentFolder[0].source), trimEnd(sent.raw), 'the Sent copy is the very message that was sent');
    const sentRow = env.db.prepare("SELECT * FROM folders WHERE account_id = ? AND special_use = '\\Sent'").get(account.id);
    assert.ok(synced.includes(sentRow.id), 'Sent synced in the background');

    // Original marked answered, on the server and here.
    const inbox = await messagesIn('s1', 'INBOX');
    assert.ok(inbox.find((m) => m.uid === origUid).flags.has('\\Answered'));
    assert.equal(env.db.prepare('SELECT is_answered FROM messages WHERE id = ?').get(original.id).is_answered, 1);

    // Draft gone, upload gone.
    assert.deepEqual(await messagesIn('s1', 'Drafts'), []);
    assert.equal(uploads.getUpload(env.db, userId, up.id), null);
  } finally {
    await outbox.stop();
    env.close();
  }
});

test('Sent copy: skipped for providers whose server files it, never duplicated otherwise', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  // Gmail's SMTP server files sent mail itself: no APPEND.
  let ctx = await setup({ undoSendSeconds: 0, provider: 'gmail' });
  try {
    // The outgoing host is not a known one here (127.0.0.1), so the account's provider decides.
    assert.equal(sentCopyPolicy(ctx.account), 'server');
    ctx.outbox.queue(ctx.userId, payload({ accountId: ctx.account.id, bcc: [] }));
    await ctx.outbox.sendDue();
    await ctx.outbox.idle();
    assert.equal(smtpServer.messages.length, 1);
    assert.deepEqual(await messagesIn('s1', 'Sent'), [], 'no copy appended for Gmail');
    assert.equal(sentCopyPolicy({ ...ctx.account, smtp_host: 'smtp.gmail.com' }), 'server');
    assert.equal(sentCopyPolicy({ ...ctx.account, provider: 'zoho', smtp_host: null }), 'server');
    assert.equal(sentCopyPolicy({ ...ctx.account, provider: 'icloud', smtp_host: null }), 'append');
    assert.equal(sentCopyPolicy({ ...ctx.account, provider: 'imap', smtp_host: 'smtp.gmail.com' }), 'server', 'judged by the outgoing server');
    assert.equal(sentCopyPolicy({ ...ctx.account, provider: 'imap', smtp_host: 'mail.example.org' }), 'if-folder');
  } finally {
    await ctx.outbox.stop();
    ctx.env.close();
  }

  // Yahoo (undocumented): wait a moment, then append only if the server did not file one.
  ctx = await setup({ undoSendSeconds: 0, provider: 'yahoo' });
  try {
    smtpServer.opts.fileInSent = true;
    ctx.outbox.queue(ctx.userId, payload({ accountId: ctx.account.id, bcc: [] }));
    await ctx.outbox.sendDue();
    await ctx.outbox.idle();
    assert.equal(smtpServer.messages.length, 1);
    assert.equal((await messagesIn('s1', 'Sent')).length, 1, 'the server copy was found by Message-ID: no duplicate');

    smtpServer.opts.fileInSent = false;
    ctx.outbox.queue(ctx.userId, payload({ accountId: ctx.account.id, bcc: [], subject: 'Second' }));
    await ctx.outbox.sendDue();
    await ctx.outbox.idle();
    const sent = await messagesIn('s1', 'Sent');
    assert.deepEqual(sent.map((m) => m.envelope.subject).sort(), ['Hello from the outbox', 'Second']);
  } finally {
    await ctx.outbox.stop();
    ctx.env.close();
  }
});

test('scheduled sends go out at their time; restart resumes queued and interrupted rows', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  const { env, userId, account, outbox } = await setup({ undoSendSeconds: 0 });
  try {
    outbox.start();
    const at = Date.now() + 1200;
    const row = outbox.queue(userId, payload({ accountId: account.id, subject: 'Scheduled' }), { sendAt: at });
    assert.equal(row.send_at, at);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(smtpServer.messages.length, 0, 'not before its time');
    await waitFor(() => smtpServer.messages.length === 1, { timeoutMs: 8000 });
    await waitFor(() => env.db.prepare('SELECT status FROM outbox WHERE id = ?').get(row.id).status === 'sent');
    assert.ok(Date.now() >= at);
    await outbox.stop();

    // "Crash": one row was mid-send, one is due; a new manager picks both up.
    smtpServer.messages.length = 0;
    const insert = env.db.prepare(
      "INSERT INTO outbox (user_id, account_id, payload, send_at, status, attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const p = (subject) => JSON.stringify({ ...payload({ accountId: account.id, subject }), to: [{ name: '', address: 's2@test.local' }], bcc: [] });
    insert.run(userId, account.id, p('Interrupted'), Date.now() - 5000, 'sending', 1, Date.now() - 5000);
    insert.run(userId, account.id, p('Due'), Date.now() - 1000, 'queued', 0, Date.now() - 1000);
    insert.run(userId, account.id, p('Later'), Date.now() + 3600 * 1000, 'queued', 0, Date.now());
    const restarted = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet, sentCopyCheckDelayMs: 0 });
    restarted.start();
    try {
      await waitFor(() => smtpServer.messages.length === 2, { timeoutMs: 8000 });
      await restarted.idle();
      const subjects = await Promise.all(smtpServer.messages.map(async (m) => (await parse(m.raw)).subject));
      assert.deepEqual(subjects.sort(), ['Due', 'Interrupted']);
      assert.deepEqual(env.db.prepare("SELECT status FROM outbox WHERE status != 'sent'").all().map((r) => r.status), ['queued'], 'the later one waits');
    } finally {
      await restarted.stop();
    }
  } finally {
    await outbox.stop();
    env.close();
  }
});

test('failures: friendly errors, one automatic retry for connection problems only, retry/remove', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  const { env, deps, userId, account, outbox } = await setup({ undoSendSeconds: 0 });
  try {
    // Wrong password: failed at once, no automatic retry.
    env.db.prepare('UPDATE accounts SET smtp_secret_enc = ? WHERE id = ?').run(env.crypto.encryptJson({ password: 'wrong' }), account.id);
    const authRow = outbox.queue(userId, payload({ accountId: account.id }));
    await outbox.sendDue();
    let row = outbox.get(userId, authRow.id);
    assert.deepEqual([row.status, row.attempts], ['failed', 1]);
    assert.match(row.error, /rejected the username or password/);
    assert.deepEqual(outboxItemJson(row), {
      id: row.id,
      accountId: account.id,
      to: [{ name: 'Sam Two', address: 's2@test.local' }, { name: 'Hidden', address: 'hidden@example.org' }],
      subject: 'Hello from the outbox',
      sendAt: row.send_at,
      status: 'failed',
      error: row.error,
      attempts: 1,
      createdAt: row.created_at,
      sentAt: null,
    });

    // Fixed password + retry -> sent.
    env.db.prepare('UPDATE accounts SET smtp_secret_enc = NULL WHERE id = ?').run(account.id);
    assert.equal(outbox.retry(userId, authRow.id).status, 'queued');
    assert.throws(() => outbox.retry(userId, authRow.id), (err) => err.status === 409 && err.code === 'NOT_FAILED');
    await outbox.sendDue();
    await outbox.idle();
    assert.equal(outbox.get(userId, authRow.id).status, 'sent');
    assert.equal(smtpServer.messages.length, 1);

    // Server unreachable: queued again once (retryDelayMs 0 here), then failed.
    env.db.prepare('UPDATE accounts SET smtp_port = ? WHERE id = ?').run(await closedPort(), account.id);
    const connRow = outbox.queue(userId, payload({ accountId: account.id }));
    await outbox.sendDue();
    row = outbox.get(userId, connRow.id);
    assert.deepEqual([row.status, row.attempts], ['queued', 1]);
    assert.match(row.error, /Could not reach 127\.0\.0\.1:\d+.*Trying again in a minute\./);
    await outbox.sendDue();
    row = outbox.get(userId, connRow.id);
    assert.deepEqual([row.status, row.attempts], ['failed', 2]);
    assert.doesNotMatch(row.error, /Trying again/);
    env.db.prepare('UPDATE accounts SET smtp_port = ? WHERE id = ?').run(smtpServer.port, account.id);

    // Recipient refused: failed, no retry.
    smtpServer.opts.rejectRecipients = ['nobody@example.org'];
    const rcptRow = outbox.queue(userId, payload({ accountId: account.id, to: ['nobody@example.org'], bcc: [] }));
    await outbox.sendDue();
    row = outbox.get(userId, rcptRow.id);
    assert.equal(row.status, 'failed');
    assert.match(row.error, /refused the recipient address: nobody@example.org/);

    // Some recipients refused: sent, the refused ones noted.
    const partRow = outbox.queue(userId, payload({ accountId: account.id, to: ['s2@test.local', 'nobody@example.org'], bcc: [] }));
    await outbox.sendDue();
    await outbox.idle();
    row = outbox.get(userId, partRow.id);
    assert.equal(row.status, 'sent');
    assert.equal(row.error, 'Not delivered to: nobody@example.org');

    // An attachment that disappeared before sending.
    const up = uploads.saveUpload(deps, userId, { filename: 'x.txt', contentType: 'text/plain', buffer: Buffer.from('x') });
    const goneRow = outbox.queue(userId, payload({ accountId: account.id, bcc: [], attachments: [{ uploadId: up.id }] }));
    uploads.deleteUpload(deps, userId, up.id);
    await outbox.sendDue();
    row = outbox.get(userId, goneRow.id);
    assert.equal(row.status, 'failed');
    assert.match(row.error, /no longer available/);

    // remove(): failed rows can be deleted; rows being sent cannot.
    assert.deepEqual(outbox.remove(userId, goneRow.id), { ok: true });
    assert.equal(outbox.get(userId, goneRow.id), null);
    env.db.prepare("UPDATE outbox SET status = 'sending' WHERE id = ?").run(rcptRow.id);
    assert.throws(() => outbox.remove(userId, rcptRow.id), (err) => err.status === 409);
    assert.throws(() => outbox.cancel(userId, rcptRow.id), (err) => err.code === 'TOO_LATE');
    assert.throws(() => outbox.remove(createUser(env.db), rcptRow.id), (err) => err.status === 404, 'other users cannot touch it');
  } finally {
    await outbox.stop();
    env.close();
  }
});

test('queue validates ownership, sending setup and the send time', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  const { env, deps, userId, account, outbox } = await setup();
  try {
    const mallory = createUser(env.db);
    assert.throws(() => outbox.queue(mallory, payload({ accountId: account.id })), (err) => err.status === 404);
    assert.throws(() => outbox.queue(userId, payload({ accountId: account.id, to: [], bcc: [] })), (err) => err.code === 'INVALID_COMPOSE');
    const noSmtp = sendAccount(env, userId, 's2', 1, { smtp_host: null, email: 'nosmtp@test.local' });
    assert.throws(() => outbox.queue(userId, payload({ accountId: noSmtp.id })), (err) => err.status === 400 && err.code === 'SMTP_NOT_CONFIGURED');
    assert.throws(() => outbox.queue(userId, payload({ accountId: account.id }), { sendAt: 'tomorrow-ish' }), (err) => err.code === 'INVALID_SEND_AT');
    assert.throws(() => outbox.queue(userId, payload({ accountId: account.id }), { sendAt: Date.now() + 400 * 24 * 3600 * 1000 }), (err) => err.code === 'INVALID_SEND_AT');
    const theirs = uploads.saveUpload(deps, mallory, { filename: 'm.txt', contentType: 'text/plain', buffer: Buffer.from('m') });
    assert.throws(() => outbox.queue(userId, payload({ accountId: account.id, attachments: [{ uploadId: theirs.id }] })), (err) => err.status === 410);
    assert.throws(() => outbox.queue(userId, payload({ accountId: account.id }), { draft: { folderId: 'x' } }), (err) => err.code === 'INVALID_DRAFT');

    // ISO times work; a foreign replyToMessageId is dropped rather than trusted.
    const iso = new Date(Date.now() + 3600 * 1000).toISOString();
    const row = outbox.queue(userId, payload({ accountId: account.id, replyToMessageId: 999999 }), { sendAt: iso });
    assert.equal(row.send_at, Date.parse(iso));
    assert.equal(JSON.parse(row.payload).replyToMessageId, null);
    const second = outbox.queue(userId, payload({ accountId: account.id, subject: 'Newer' }));
    assert.deepEqual(outbox.list(userId).map((r) => r.id), [second.id, row.id], 'newest first');

    assert.deepEqual(getUserSettings(env.db, userId), { undoSendSeconds: 10, notifications: false });
    env.db.prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)').run(mallory, '{"undoSendSeconds": 99, "notifications": true}');
    assert.deepEqual(getUserSettings(env.db, mallory), { undoSendSeconds: 10, notifications: true });
    assert.equal(resolveSendAt(undefined, 1000, 5), 6000);
    assert.equal(resolveSendAt(500, 1000, 0), 1000);
  } finally {
    await outbox.stop();
    env.close();
  }
});
