'use strict';

/**
 * Regression tests for the v2 review findings (security, sending engine, folders/sync).
 * Dovecot tests use only s1/s2 (behind the sending tests' lock); SMTP servers are in-process.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { SMTPServer } = require('smtp-server');

const smtp = require('../src/smtp');
const imap = require('../src/imap');
const drafts = require('../src/drafts');
const uploads = require('../src/uploads');
const actions = require('../src/actions');
const queries = require('../src/queries');
const folders = require('../src/folders');
const { SyncManager } = require('../src/sync');
const { OutboxManager, sentCopyPolicy, outboxItemJson } = require('../src/outbox');
const { createKeyedLimiter } = require('../src/concurrency');
const {
  imapAvailable,
  lockUsers,
  resetUser,
  appendTo,
  messagesIn,
  withUser,
  sendAccount,
  storeMessageRow,
  makeEngineEnv,
  createUser,
  createAccount,
  buildMessage,
  parse,
  waitFor,
  TINY_PNG,
} = require('./send-helpers');
const { startTestServer, makeClient, signupUser, seedAccount, seedMessage, seedFolder } = require('./helpers');

const quiet = { warn() {}, error() {}, info() {}, debug() {}, log() {} };

let dovecot = false;
let release = () => {};
test.before(async () => {
  dovecot = await imapAvailable();
  if (dovecot) release = await lockUsers();
});
test.after(() => release());

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/**
 * A scriptable SMTP server speaking just enough of the protocol (AUTH always accepted).
 * handlers: rcpt({ conn, sock, line }) / data({ conn, sock }) -> true when they answered the
 * command themselves; duringData({ conn, sock, bytes }) -> true to stop reading; afterDot({ conn,
 * sock }) -> true when it answered (or dropped) instead of the 250.
 */
async function rawSmtp(handlers = {}) {
  const state = { received: [], connections: 0, sockets: new Set() };
  const server = net.createServer((sock) => {
    state.connections += 1;
    state.sockets.add(sock);
    const conn = state.connections;
    let inData = false;
    let buf = '';
    let data = '';
    sock.on('error', () => {});
    sock.on('close', () => state.sockets.delete(sock));
    sock.write('220 fake ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      for (;;) {
        if (inData) {
          if (handlers.duringData && handlers.duringData({ conn, sock, bytes: data.length + buf.length })) return;
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0) {
            data += buf;
            buf = '';
            return;
          }
          data += buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          state.received.push({ conn, raw: data });
          data = '';
          if (handlers.afterDot && handlers.afterDot({ conn, sock })) return;
          sock.write('250 2.0.0 queued\r\n');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl < 0) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') sock.write('250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 50000000\r\n');
        else if (cmd === 'AUTH') sock.write('235 2.7.0 ok\r\n');
        else if (cmd === 'RCPT' && handlers.rcpt && handlers.rcpt({ conn, sock, line })) continue;
        else if (cmd === 'DATA' && handlers.data && handlers.data({ conn, sock })) continue;
        else if (cmd === 'DATA') {
          inData = true;
          sock.write('354 go\r\n');
        } else if (cmd === 'QUIT') {
          sock.write('221 bye\r\n');
          sock.end();
        } else sock.write('250 ok\r\n');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  state.port = server.address().port;
  state.close = () =>
    new Promise((resolve) => {
      for (const s of state.sockets) s.destroy();
      server.close(resolve);
    });
  return state;
}

/** An engine env with one user whose account sends through 127.0.0.1:<port> (no IMAP needed: Gmail files Sent). */
function sendingEnv(port, { email = 'me@example.com', undoSendSeconds = 0 } = {}) {
  const env = makeEngineEnv();
  const userId = createUser(env.db);
  env.db.prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)').run(userId, JSON.stringify({ undoSendSeconds }));
  const account = createAccount(env.db, env.crypto, userId, {
    provider: 'gmail',
    email,
    imap_user: email,
    smtp_host: '127.0.0.1',
    smtp_port: port,
    smtp_security: 'none',
    password: 'pw',
  });
  return { env, userId, account };
}

function message(accountId, extra = {}) {
  return { accountId, to: [{ name: '', address: 'friend@example.net' }], subject: 'Probe', html: '<p>hello</p>', ...extra };
}

const rowOf = (env, id) => env.db.prepare('SELECT * FROM outbox WHERE id = ?').get(id);

// ---------------------------------------------------------------------------------------------
// Security: SMTP login is never skipped
// ---------------------------------------------------------------------------------------------

test('SMTP: a server that offers no login is refused by verify and send; nothing goes out unauthenticated', async () => {
  const delivered = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    logger: false,
    onData(stream, session, cb) {
      stream.resume();
      stream.on('end', () => {
        delivered.push(session.envelope.mailFrom.address);
        cb();
      });
    },
  });
  server.on('error', () => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.server.address();
  const { env, account } = sendingEnv(port, { email: 'ceo@victim.example' });
  try {
    const opts = await smtp.connectionOptions(env.config, { host: '127.0.0.1', port, security: 'none', auth: { user: 'x', pass: 'y' } });
    assert.equal(opts.forceAuth, true);
    await assert.rejects(smtp.verifySmtp(env, { host: '127.0.0.1', port, security: 'none', user: 'nobody', password: 'WRONG' }), (err) => {
      assert.equal(err.code, 'SMTP_AUTH_FAILED');
      assert.match(err.message, /does not accept a login/);
      return true;
    });
    await assert.rejects(
      smtp.sendRaw(env, account, { from: 'ceo@victim.example', recipients: ['victim@example.com'], raw: Buffer.from('Subject: hi\r\n\r\nhi\r\n') }),
      (err) => err.code === 'SMTP_AUTH_FAILED' && err.retryable === false
    );
    assert.deepEqual(delivered, [], 'nothing was delivered');
  } finally {
    env.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------------------------
// Sending: never deliver twice
// ---------------------------------------------------------------------------------------------

test('outbox: a connection lost after the whole message was sent is "may have been sent", never retried', async () => {
  const server = await rawSmtp({ afterDot: ({ conn, sock }) => conn === 1 && (sock.destroy(), true) });
  const { env, userId, account } = sendingEnv(server.port);
  const outbox = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet, retryDelayMs: 0 });
  try {
    const row = outbox.queue(userId, message(account.id));
    await outbox.sendDue();
    await outbox.sendDue();
    await outbox.idle();
    const after = rowOf(env, row.id);
    assert.deepEqual([after.status, after.attempts], ['failed', 1]);
    assert.match(after.error, /may have been delivered anyway/);
    assert.ok(after.handed_over_at, 'the hand-over was recorded');
    assert.equal(server.received.length, 1, 'the server got the message exactly once');
  } finally {
    await outbox.stop();
    env.close();
    await server.close();
  }
});

test('outbox: refusals before or at DATA, and the server\'s own answer to the message, are retried as usual', async () => {
  const refuse = { rcpt: false, data: false, afterDot: false };
  const server = await rawSmtp({
    rcpt: ({ sock }) => refuse.rcpt && (sock.write('451 4.3.0 try later\r\n'), true),
    data: ({ sock }) => refuse.data && (sock.write('451 4.3.0 not now\r\n'), true),
    afterDot: ({ sock }) => refuse.afterDot && (sock.write('451 4.3.0 queue full\r\n'), true),
  });
  const { env, userId, account } = sendingEnv(server.port);
  const outbox = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet, retryDelayMs: 0 });
  try {
    for (const step of ['rcpt', 'data', 'afterDot']) {
      Object.keys(refuse).forEach((k) => (refuse[k] = k === step));
      const row = outbox.queue(userId, message(account.id, { subject: step }));
      await outbox.sendDue();
      const after = rowOf(env, row.id);
      assert.deepEqual([after.status, after.attempts], ['queued', 1], step);
      assert.match(after.error, /Trying again in a minute/, step);
      assert.doesNotMatch(after.error, /may have been delivered/, step);
      // The message was only handed over when the server got to see it.
      assert.equal(!!after.handed_over_at, step === 'afterDot', step);
      refuse[step] = false;
      await outbox.sendDue();
      await outbox.idle();
      assert.equal(rowOf(env, row.id).status, 'sent', step);
    }
  } finally {
    await outbox.stop();
    env.close();
    await server.close();
  }
});

test('outbox restart: rows that reached the hand-over fail ("may have been sent"); the others are sent', async () => {
  const server = await rawSmtp();
  const { env, userId, account } = sendingEnv(server.port);
  const first = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet });
  const handedOver = first.queue(userId, message(account.id, { subject: 'Handed over' }));
  const notYet = first.queue(userId, message(account.id, { subject: 'Not yet' }));
  // A crash while both were being sent; one had started the DATA transfer.
  env.db.prepare("UPDATE outbox SET status = 'sending', attempts = 1 WHERE id IN (?, ?)").run(handedOver.id, notYet.id);
  env.db.prepare('UPDATE outbox SET handed_over_at = ? WHERE id = ?').run(Date.now(), handedOver.id);
  const restarted = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet });
  try {
    restarted.start();
    await waitFor(() => rowOf(env, notYet.id).status === 'sent', { timeoutMs: 8000 });
    const failed = rowOf(env, handedOver.id);
    assert.equal(failed.status, 'failed');
    assert.match(failed.error, /restarted while it was handing this message .*may have been delivered/);
    assert.equal(server.received.length, 1);
    assert.match(server.received[0].raw, /Subject: Not yet/);
  } finally {
    await restarted.stop();
    env.close();
    await server.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Sending: one slow server holds up nobody else
// ---------------------------------------------------------------------------------------------

test('outbox: a server that stalls with continuation lines neither blocks other accounts nor runs forever', async () => {
  const timers = new Set();
  const stall = await rawSmtp({
    rcpt: ({ sock }) => {
      const t = setInterval(() => sock.write('250-still checking\r\n'), 200);
      timers.add(t);
      sock.on('close', () => clearInterval(t));
      return true;
    },
  });
  const normal = await rawSmtp();
  const env = makeEngineEnv();
  const mk = (port, email) => {
    const userId = createUser(env.db);
    env.db.prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)').run(userId, JSON.stringify({ undoSendSeconds: 0 }));
    const account = createAccount(env.db, env.crypto, userId, { provider: 'gmail', email, imap_user: email, smtp_host: '127.0.0.1', smtp_port: port, smtp_security: 'none', password: 'pw' });
    return { userId, account };
  };
  const a = mk(stall.port, 'slow@example.com');
  const b = mk(normal.port, 'quick@example.com');
  const outbox = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet, retryDelayMs: 600000, sendDeadlineMs: 2500 });
  try {
    outbox.start();
    const slow = outbox.queue(a.userId, message(a.account.id));
    const t0 = Date.now();
    const quick = outbox.queue(b.userId, message(b.account.id), { sendAt: Date.now() + 600 });
    await waitFor(() => normal.received.length === 1, { timeoutMs: 2400 });
    assert.ok(Date.now() - t0 < 2400, 'the other account sent while the slow one was still busy');
    assert.equal(rowOf(env, quick.id).status === 'sent' || rowOf(env, quick.id).status === 'sending', true);
    assert.equal(rowOf(env, slow.id).status, 'sending');
    // The deadline stops the stalled send (before the message was handed over: retried later).
    await waitFor(() => rowOf(env, slow.id).status !== 'sending', { timeoutMs: 6000 });
    const after = rowOf(env, slow.id);
    assert.equal(after.status, 'queued');
    assert.match(after.error, /took too long to accept the message/);
  } finally {
    await outbox.stop();
    for (const t of timers) clearInterval(t);
    env.close();
    await stall.close();
    await normal.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Sending: refused recipients are never dropped silently
// ---------------------------------------------------------------------------------------------

test('outbox: recipients refused at RCPT stay in the outbox; 4xx are retried (same message), 5xx reported', async () => {
  const seen = new Map();
  const deliveries = [];
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    logger: false,
    onAuth(auth, session, cb) {
      cb(null, { user: auth.username });
    },
    onRcptTo(address, session, cb) {
      const n = (seen.get(address.address) || 0) + 1;
      seen.set(address.address, n);
      if (address.address === 'grey@ex.net' && n === 1) {
        const err = new Error('4.2.0 Greylisted, try again later');
        err.responseCode = 450;
        return cb(err);
      }
      if (address.address === 'bad@ex.net') {
        const err = new Error('5.1.1 User unknown');
        err.responseCode = 550;
        return cb(err);
      }
      cb();
    },
    onData(stream, session, cb) {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        deliveries.push({ to: session.envelope.rcptTo.map((r) => r.address), raw: Buffer.concat(chunks).toString('utf8') });
        cb();
      });
    },
  });
  server.on('error', () => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { env, userId, account } = sendingEnv(server.server.address().port);
  const outbox = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet, retryDelayMs: 0 });
  try {
    const recipients = (...list) => list.map((address) => ({ name: '', address }));
    // Greylisted: delivered to the others now, to the greylisted one on the retry.
    const grey = outbox.queue(userId, message(account.id, { to: recipients('ok@ex.net', 'grey@ex.net') }));
    await outbox.sendDue();
    await outbox.idle();
    let row = rowOf(env, grey.id);
    assert.equal(row.status, 'queued');
    assert.match(row.error, /^Sent to ok@ex\.net, but not delivered to grey@ex\.net \(.*Greylisted.*\)\. Trying them again in a minute\.$/);
    assert.deepEqual(outboxItemJson(row).notDeliveredTo, ['grey@ex.net']);
    assert.equal(outboxItemJson(row).partial, true);
    assert.ok(outbox.list(userId).some((r) => r.id === grey.id), 'still listed in the outbox');
    await outbox.sendDue();
    await outbox.idle();
    row = rowOf(env, grey.id);
    assert.deepEqual([row.status, row.error, row.pending_recipients], ['sent', null, null]);
    assert.deepEqual(deliveries.map((d) => d.to), [['ok@ex.net'], ['grey@ex.net']]);
    const messageIds = deliveries.map((d) => (d.raw.match(/^Message-ID: (.+)$/im) || [])[1]);
    assert.equal(messageIds[0], messageIds[1], 'the same message, not a new one');

    // Refused for good: failed (shown), never retried by itself; Retry tries only those again.
    deliveries.length = 0;
    const bad = outbox.queue(userId, message(account.id, { to: recipients('ok2@ex.net', 'bad@ex.net') }));
    await outbox.sendDue();
    await outbox.idle();
    row = rowOf(env, bad.id);
    assert.equal(row.status, 'failed');
    assert.match(row.error, /^Sent to ok2@ex\.net, but not delivered to bad@ex\.net \(.*User unknown.*\)\.$/);
    assert.throws(() => outbox.cancel(userId, bad.id), (err) => err.code === 'TOO_LATE');
    outbox.retry(userId, bad.id);
    await outbox.sendDue();
    await outbox.idle();
    assert.equal(rowOf(env, bad.id).status, 'failed');
    assert.deepEqual(deliveries.map((d) => d.to), [['ok2@ex.net']], 'ok2 got it once; bad was refused again');
    assert.equal(seen.get('ok2@ex.net'), 1, 'the retry did not go to ok2 again');
  } finally {
    await outbox.stop();
    env.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------------------------
// Uploads in use: an indexed lookup, no payload parsing
// ---------------------------------------------------------------------------------------------

test('uploads in use come from outbox_uploads (kept by a trigger), only while the row waits', () => {
  const env = makeEngineEnv();
  try {
    const userId = createUser(env.db);
    const account = createAccount(env.db, env.crypto, userId, {});
    const up = uploads.saveUpload(env, userId, { filename: 'a.txt', contentType: 'text/plain', buffer: Buffer.from('a') });
    const other = uploads.saveUpload(env, userId, { filename: 'b.txt', contentType: 'text/plain', buffer: Buffer.from('b') });
    const info = env.db
      .prepare("INSERT INTO outbox (user_id, account_id, payload, send_at, status, created_at) VALUES (?, ?, ?, ?, 'queued', ?)")
      .run(userId, account.id, JSON.stringify({ attachments: [{ uploadId: up.id }, { messageId: 5, index: 0 }] }), Date.now() + 1e9, Date.now());
    const id = Number(info.lastInsertRowid);
    assert.deepEqual(uploads.outboxUploadIds(env.db, id), [up.id]);
    assert.equal(uploads.uploadInUse(env.db, up.id), true);
    assert.equal(uploads.uploadInUse(env.db, other.id), false);
    uploads.recordOutboxUploads(env.db, id, [other.id, 'not an id']);
    assert.deepEqual(uploads.outboxUploadIds(env.db, id).sort(), [up.id, other.id].sort());
    env.db.prepare("UPDATE outbox SET status = 'sent' WHERE id = ?").run(id);
    assert.equal(uploads.uploadInUse(env.db, up.id), false, 'a sent message needs nothing');
    assert.equal(uploads.uploadsInUse(env.db).size, 0);
    env.db.prepare('DELETE FROM outbox WHERE id = ?').run(id);
    assert.deepEqual(uploads.outboxUploadIds(env.db, id), [], 'cascade');
  } finally {
    env.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Materialize: bounded downloads
// ---------------------------------------------------------------------------------------------

test('materialize refuses oversized sources before downloading anything, and drops oversized inline images', async () => {
  const env = makeEngineEnv();
  env.logger = quiet;
  try {
    const userId = createUser(env.db);
    // An IMAP port nobody listens on: any download attempt would fail with a connection error.
    const account = createAccount(env.db, env.crypto, userId, { imap_port: 1 });
    const folder = seedFolder(env.db, account.id, 'INBOX');
    const row = (size) => seedMessage(env.db, account.id, { folder_id: folder.id, size, attachments: [{ index: 0, filename: 'a.bin', contentType: 'application/octet-stream', size: 10 }] });
    const huge = row(50 * 1024 * 1024);
    await assert.rejects(drafts.materialize(env, userId, { attachments: [{ messageId: huge.id, index: 0 }], html: '' }), (err) => err.code === 'ATTACHMENTS_TOO_LARGE');
    const three = [row(30 * 1024 * 1024), row(30 * 1024 * 1024), row(30 * 1024 * 1024)];
    await assert.rejects(
      drafts.materialize(env, userId, { attachments: three.map((m) => ({ messageId: m.id, index: 0 })), html: '' }),
      (err) => err.code === 'ATTACHMENTS_TOO_LARGE',
      'more than 80 MB of sources for one message'
    );
    const out = await drafts.materialize(env, userId, { attachments: [], html: `<p>x<img src="/api/messages/${huge.id}/attachments/0"></p>` });
    assert.equal(out.attachments.length, 0);
    assert.doesNotMatch(out.payload.html, /\/api\/messages\//, 'the internal URL is never sent');
  } finally {
    env.close();
  }
});

test('materialize never holds more than the 25 MB of attachments (+25 MB of inline images) a message may have', async () => {
  const env = makeEngineEnv();
  env.logger = quiet;
  try {
    const userId = createUser(env.db);
    const carried = (messageId, index, mb, contentType = 'application/octet-stream') => {
      const up = uploads.saveUpload(env, userId, { filename: `p${messageId}.${index}`, contentType, buffer: Buffer.alloc(mb * 1024 * 1024, 1) });
      env.db.prepare('INSERT INTO carried_parts (message_id, part_index, user_id, upload_id) VALUES (?, ?, ?, ?)').run(messageId, index, userId, up.id);
    };
    carried(9001, 0, 10);
    carried(9002, 0, 10);
    carried(9003, 0, 10);
    await assert.rejects(
      drafts.materialize(env, userId, { attachments: [9001, 9002, 9003].map((messageId) => ({ messageId, index: 0 })), html: '' }),
      (err) => err.code === 'ATTACHMENTS_TOO_LARGE'
    );
    const up = uploads.saveUpload(env, userId, { filename: 'big.bin', contentType: 'application/octet-stream', buffer: Buffer.alloc(20 * 1024 * 1024, 2) });
    await assert.rejects(
      drafts.materialize(env, userId, { attachments: [{ uploadId: up.id }, { messageId: 9001, index: 0 }], html: '' }),
      (err) => err.code === 'ATTACHMENTS_TOO_LARGE',
      'uploads count against the same 25 MB'
    );
    for (const id of [9101, 9102, 9103]) carried(id, 0, 10, 'image/png');
    const html = [9101, 9102, 9103].map((id) => `<img src="/api/messages/${id}/attachments/0">`).join('');
    const out = await drafts.materialize(env, userId, { attachments: [], html });
    assert.equal(out.attachments.length, 2, 'inline images beyond their 25 MB are left out');
    assert.equal((out.payload.html.match(/cid:/g) || []).length, 2);
    assert.doesNotMatch(out.payload.html, /\/api\/messages\//);
  } finally {
    env.close();
  }
});

test('keyed limiter: at most N tasks per key at once, others wait their turn', async () => {
  const limit = createKeyedLimiter(2);
  let running = 0;
  let peak = 0;
  const task = () =>
    limit('user', async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 20));
      running -= 1;
      return 'done';
    });
  const results = await Promise.all([task(), task(), task(), task(), task()]);
  assert.equal(peak, 2);
  assert.deepEqual(results, ['done', 'done', 'done', 'done', 'done']);
  await assert.rejects(limit('user', async () => Promise.reject(new Error('boom'))), /boom/);
  assert.equal(await limit('user', async () => 'still works'), 'still works');
});

// ---------------------------------------------------------------------------------------------
// Sent copies, missing folders
// ---------------------------------------------------------------------------------------------

test('sent copy: the server files it only when IMAP and SMTP belong to the same provider', () => {
  const base = { auth_type: 'password', imap_user: 'me@example.org', email: 'me@example.org', smtp_user: null };
  assert.equal(sentCopyPolicy({ ...base, provider: 'imap', imap_host: 'mail.example.org', smtp_host: 'smtp.gmail.com' }), 'if-folder');
  assert.equal(sentCopyPolicy({ ...base, provider: 'imap', imap_host: 'mail.example.org', smtp_host: 'smtp.office365.com' }), 'if-folder');
  assert.equal(sentCopyPolicy({ ...base, provider: 'yahoo', imap_host: 'imap.mail.yahoo.com', smtp_host: 'smtp.gmail.com' }), 'append');
  assert.equal(sentCopyPolicy({ ...base, provider: 'gmail', imap_host: 'imap.gmail.com', smtp_host: 'smtp.gmail.com' }), 'server');
  assert.equal(sentCopyPolicy({ ...base, provider: 'gmail', imap_host: 'imap.gmail.com', smtp_host: null }), 'server');
  assert.equal(sentCopyPolicy({ ...base, provider: 'outlook', auth_type: 'oauth', imap_host: 'outlook.office365.com', smtp_host: null }), 'server');
  assert.equal(sentCopyPolicy({ ...base, provider: 'yahoo', imap_host: 'imap.mail.yahoo.com', smtp_host: null }), 'append');
});

test('missing folders are named in the error (imapflow does not say which)', async (t) => {
  if (!dovecot) return t.skip('Dovecot not available');
  const env = makeEngineEnv();
  try {
    const account = sendAccount(env, createUser(env.db), 's1', 2525);
    const err = await imap
      .withImap(env, account, async (client) => {
        await client.getMailboxLock('No such folder 42');
      })
      .then(() => null, (e) => e);
    assert.ok(err && err.mailboxMissing);
    assert.equal(err.path, 'No such folder 42');
    assert.match(imap.friendlyImapError(err), /^The folder "No such folder 42" was not found on the mail server/);
    assert.doesNotMatch(imap.friendlyImapError({ mailboxMissing: true }), /INBOX/);
  } finally {
    env.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Drafts: a reopened draft keeps its files and pictures across saves and sends
// ---------------------------------------------------------------------------------------------

/** A saved draft with an upload and a quoted inline image, stored like the sync would, then reopened. */
async function reopenedDraft(env, userId, account) {
  const original = buildMessage({
    from: 'Sender <sender@example.org>',
    to: 's1@test.local',
    subject: 'Pictures',
    html: '<p>Logo <img src="cid:logo@x"></p>',
    attachments: [{ filename: 'logo.png', contentType: 'image/png', content: TINY_PNG, cid: 'logo@x' }],
  });
  const at = await appendTo('s1', 'INBOX', original);
  const originalRow = await storeMessageRow(env, account, { mailbox: 'INBOX', uid: at.uid, uidValidity: at.uidValidity, raw: original });
  const up = uploads.saveUpload(env, userId, { filename: 'notes.txt', contentType: 'text/plain', buffer: Buffer.from('my notes') });
  const d0 = await drafts.saveDraft(
    env,
    account,
    { accountId: account.id, to: [{ name: '', address: 's2@test.local' }], subject: 'Draft with files', html: `<p>See</p><blockquote>${originalRow.html_body}</blockquote>`, attachments: [{ uploadId: up.id }] },
    null
  );
  const [onServer] = await messagesIn('s1', 'Drafts');
  const uidValidity = await withUser('s1', async (c) => Number((await c.status('Drafts', { uidValidity: true })).uidValidity));
  const row = await storeMessageRow(env, account, { mailbox: 'Drafts', uid: d0.uid, uidValidity, raw: onServer.source, folderId: d0.folderId });
  env.db.prepare('UPDATE messages SET is_draft = 1 WHERE id = ?').run(row.id);
  const { payload, draft } = await drafts.loadDraft(env, userId, row);
  return { payload, draft, row, uploadId: up.id };
}

const partNames = async (raw) => (await parse(raw)).attachments.map((a) => `${a.filename}:${a.contentType}`).sort();

test('a reopened draft keeps its attachment and inline image through repeated saves and the send', async (t) => {
  if (!dovecot) return t.skip('Dovecot not available');
  await resetUser('s1');
  await resetUser('s2');
  const delivered = [];
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    logger: false,
    onAuth: (auth, session, cb) => cb(null, { user: auth.username }),
    onData(stream, session, cb) {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        delivered.push(Buffer.concat(chunks));
        cb();
      });
    },
  });
  server.on('error', () => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const env = makeEngineEnv();
  env.logger = quiet;
  try {
    const userId = createUser(env.db);
    env.db.prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)').run(userId, JSON.stringify({ undoSendSeconds: 0 }));
    const account = sendAccount(env, userId, 's1', server.server.address().port);
    const { payload, draft, row } = await reopenedDraft(env, userId, account);
    assert.ok(payload.attachments.every((a) => a.messageId === row.id), 'refs point at the draft row');
    assert.match(payload.html, new RegExp(`/api/messages/${row.id}/attachments/\\d+`));

    // The composer keeps sending the same references (it never learns new ones).
    const save1 = await drafts.saveDraft(env, account, payload, draft);
    assert.equal(drafts.messageForUser(env.db, userId, row.id), null, 'the reopened draft row is gone');
    const save2 = await drafts.saveDraft(env, account, payload, save1);
    const onServer = await messagesIn('s1', 'Drafts');
    assert.equal(onServer.length, 1, 'still exactly one draft');
    assert.deepEqual(await partNames(onServer[0].source), ['logo.png:image/png', 'notes.txt:text/plain']);
    assert.ok(drafts.carriedUpload(env.db, userId, row.id, payload.attachments[0].index), 'the parts were kept');

    const outbox = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet, retryDelayMs: 0, sentCopyCheckDelayMs: 0 });
    const queued = outbox.queue(userId, payload, { draft: save2 });
    await outbox.sendDue();
    await outbox.idle();
    assert.equal(rowOf(env, queued.id).status, 'sent', rowOf(env, queued.id).error || '');
    assert.equal(delivered.length, 1);
    const sent = await parse(delivered[0]);
    assert.deepEqual(await partNames(delivered[0]), ['logo.png:image/png', 'notes.txt:text/plain']);
    const logo = sent.attachments.find((a) => a.filename === 'logo.png');
    assert.ok(logo.cid && sent.html.includes(`cid:${logo.cid}`), 'the picture is still inline');
    assert.deepEqual(await messagesIn('s1', 'Drafts'), [], 'the draft went with the send');
    assert.equal(drafts.carriedUpload(env.db, userId, row.id, payload.attachments[0].index), null, 'kept parts are removed after sending');
  } finally {
    env.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the composer can still show a replaced draft\'s pictures (attachment route falls back to the kept part)', async (t) => {
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  const user = await signupUser(alice, { email: 'alice@example.com' });
  await signupUser(mallory, { email: 'mallory@example.com' });
  const up = uploads.saveUpload({ db: srv.db, config: srv.config }, user.id, { filename: 'logo.png', contentType: 'image/png', buffer: TINY_PNG });
  srv.db.prepare('INSERT INTO carried_parts (message_id, part_index, user_id, upload_id) VALUES (?, ?, ?, ?)').run(987654, 1, user.id, up.id);
  const res = await alice.get('/api/messages/987654/attachments/1');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.match(res.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await mallory.get('/api/messages/987654/attachments/1')).status, 404, 'only the owner');
  assert.equal((await alice.get('/api/messages/987654/attachments/2')).status, 404);
});

// ---------------------------------------------------------------------------------------------
// Forwarded attachments survive moving the original
// ---------------------------------------------------------------------------------------------

test('a forward\'s attachments are found again after the original was archived (by location, then by Message-ID)', async (t) => {
  if (!dovecot) return t.skip('Dovecot not available');
  await resetUser('s1');
  const env = makeEngineEnv();
  env.logger = quiet;
  try {
    const userId = createUser(env.db);
    const account = sendAccount(env, userId, 's1', 2525);
    const raw = buildMessage({
      from: 'Sender <sender@example.org>',
      to: 's1@test.local',
      subject: 'Report',
      text: 'see attached',
      messageId: '<moved-report@example.org>',
      attachments: [{ filename: 'report.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.4 moved') }],
    });
    const at = await appendTo('s1', 'INBOX', raw);
    const inbox = folders.inboxFolder(env.db, account.id);
    const original = await storeMessageRow(env, account, { mailbox: 'INBOX', uid: at.uid, uidValidity: at.uidValidity, raw, folderId: inbox.id });
    const index = JSON.parse(original.attachments_json).find((a) => a.filename === 'report.pdf').index;
    const archive = seedFolder(env.db, account.id, 'Archive', { specialUse: '\\Archive' });

    // What POST /api/messages/bulk {action:'archive'} does.
    const result = await actions.moveToSpecial(env, account, 'INBOX', [at.uid], 'archive', { uidValidity: at.uidValidity });
    drafts.recordMoves(env.db, account.id, [original], { folderId: archive.id, uidMap: result.uidMap, uidValidity: result.uidValidity });
    env.db.prepare('DELETE FROM messages WHERE id = ?').run(original.id);

    const forward = { accountId: account.id, to: [{ name: '', address: 'x@example.org' }], subject: 'Fwd: Report', html: '<p>fyi</p>', attachments: [{ messageId: original.id, index }] };
    assert.equal(drafts.refAvailable(env.db, userId, forward.attachments[0]), true);
    let parts = await drafts.resolveAttachments(env, userId, forward.attachments);
    assert.deepEqual(parts.map((p) => [p.filename, p.content.toString()]), [['report.pdf', '%PDF-1.4 moved']], 'from where the move put it');

    // Once the Archive copy is stored, the reference leads to its row (and \Answered etc. follow).
    const newUid = Number(result.uidMap[at.uid]);
    const moved = await storeMessageRow(env, account, { mailbox: 'Archive', uid: newUid, uidValidity: result.uidValidity, raw, folderId: archive.id });
    assert.equal(drafts.currentMessageRow(env.db, userId, original.id).id, moved.id);
    parts = await drafts.resolveAttachments(env, userId, forward.attachments);
    assert.equal(parts[0].filename, 'report.pdf');
    assert.deepEqual(drafts.describeAttachments(env.db, userId, forward.attachments).map((a) => a.filename), ['report.pdf']);
    assert.equal(drafts.refAvailable(env.db, createUser(env.db), forward.attachments[0]), false, 'never for another user');
  } finally {
    env.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Scheduled sends and their drafts
// ---------------------------------------------------------------------------------------------

test('scheduling removes the draft from Drafts (keeping the parts it needs); later drafts are never deleted by a send', async (t) => {
  if (!dovecot) return t.skip('Dovecot not available');
  await resetUser('s1');
  await resetUser('s2');
  const delivered = [];
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    logger: false,
    onAuth: (auth, session, cb) => cb(null, { user: auth.username }),
    onData(stream, session, cb) {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        delivered.push(Buffer.concat(chunks));
        cb();
      });
    },
  });
  server.on('error', () => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const env = makeEngineEnv();
  env.logger = quiet;
  try {
    const userId = createUser(env.db);
    env.db.prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)').run(userId, JSON.stringify({ undoSendSeconds: 10 }));
    const account = sendAccount(env, userId, 's1', server.server.address().port);
    const outbox = new OutboxManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet, retryDelayMs: 0, sentCopyCheckDelayMs: 0 });

    // 1. Schedule a reopened draft (its files come from the draft itself) for tomorrow.
    const { payload, draft } = await reopenedDraft(env, userId, account);
    const scheduled = outbox.queue(userId, payload, { draft, sendAt: Date.now() + 24 * 3600 * 1000 });
    await outbox.idle();
    assert.deepEqual(await messagesIn('s1', 'Drafts'), [], 'a scheduled message is not a draft any more');
    assert.deepEqual([rowOf(env, scheduled.id).draft_folder_id, rowOf(env, scheduled.id).draft_uid], [null, null]);
    env.db.prepare('UPDATE outbox SET send_at = ? WHERE id = ?').run(Date.now() - 1, scheduled.id);
    await outbox.sendDue();
    await outbox.idle();
    assert.equal(rowOf(env, scheduled.id).status, 'sent', rowOf(env, scheduled.id).error || '');
    assert.deepEqual(await partNames(delivered[0]), ['logo.png:image/png', 'notes.txt:text/plain']);

    // 2. "Send" (undo window) from draft D1; the draft is edited elsewhere (D2) before it goes out.
    await resetUser('s1');
    const base = { accountId: account.id, to: [{ name: '', address: 's2@test.local' }], html: '<p>text</p>' };
    const d1 = await drafts.saveDraft(env, account, { ...base, subject: 'Report v1' }, null);
    const queued = outbox.queue(userId, { ...base, subject: 'Report v1' }, { draft: d1 });
    await new Promise((r) => setTimeout(r, 5));
    const d2 = await drafts.saveDraft(env, account, { ...base, subject: 'Report v2 (edited)' }, d1);
    env.db.prepare('UPDATE outbox SET send_at = ? WHERE id = ?').run(Date.now() - 1, queued.id);
    await outbox.sendDue();
    await outbox.idle();
    const left = await messagesIn('s1', 'Drafts');
    assert.deepEqual(left.map((m) => [m.uid, m.envelope.subject]), [[d2.uid, 'Report v2 (edited)']], 'the newer draft is the user\'s, kept');
  } finally {
    env.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------------------------
// Folders: a stale listing never undoes a rename
// ---------------------------------------------------------------------------------------------

test('a folder renamed while the account sync was listing keeps its id and its mail', async (t) => {
  if (!dovecot) return t.skip('Dovecot not available');
  await resetUser('s1');
  await withUser('s1', (c) => c.mailboxCreate('Proj'));
  for (let i = 0; i < 5; i += 1) await appendTo('s1', 'Proj', buildMessage({ to: 's1@test.local', subject: `Proj ${i}`, text: 'x' }));
  const env = makeEngineEnv();
  const realWithImap = imap.withImap;
  let delayList = false;
  imap.withImap = (deps, account, fn, limits) =>
    realWithImap(
      deps,
      account,
      (client) => {
        const list = client.list.bind(client);
        client.list = async (opts) => {
          const res = await list(opts);
          if (opts && opts.statusQuery && delayList) {
            delayList = false;
            await new Promise((r) => setTimeout(r, 1200)); // a slow STATUS-per-folder listing
          }
          return res;
        };
        return fn(client);
      },
      limits
    );
  try {
    const account = sendAccount(env, createUser(env.db), 's1', 2525);
    const sm = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet });
    await sm.syncAccount(account.id);
    const proj = env.db.prepare("SELECT * FROM folders WHERE account_id = ? AND path = 'Proj'").get(account.id);
    const stored = env.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(proj.id).n;
    assert.equal(stored, 5);

    delayList = true;
    const syncing = sm.syncAccount(account.id);
    await new Promise((r) => setTimeout(r, 400)); // the sync has its (soon stale) listing
    const renamed = await actions.renameFolder(env, env.db.prepare('SELECT * FROM accounts WHERE id = ?').get(account.id), 'Proj', 'Proj2');
    assert.equal(renamed.folder.id, proj.id);
    await syncing;
    const rows = env.db.prepare("SELECT id, path FROM folders WHERE account_id = ? AND path LIKE 'Proj%'").all(account.id);
    assert.deepEqual(rows, [{ id: proj.id, path: 'Proj2' }], 'no phantom "Proj", the renamed folder kept its id');
    assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(proj.id).n, 5, 'and its mail');
    await sm.syncAccount(account.id);
    assert.deepEqual(env.db.prepare("SELECT id, path FROM folders WHERE account_id = ? AND path LIKE 'Proj%'").all(account.id), [{ id: proj.id, path: 'Proj2' }]);
  } finally {
    imap.withImap = realWithImap;
    env.close();
  }
});

test('folder change marks: a listing taken before or during a change is stale', () => {
  const db = {};
  const mark = folders.folderChangeMark(db, 1);
  assert.equal(folders.folderListingStale(db, 1, mark), false);
  const end = folders.beginFolderChange(db, 1);
  assert.equal(folders.folderListingStale(db, 1, mark), true);
  assert.equal(folders.folderListingStale(db, 1, folders.folderChangeMark(db, 1)), true, 'while a change runs');
  end();
  end();
  const after = folders.folderChangeMark(db, 1);
  assert.equal(folders.folderListingStale(db, 1, after), false);
  assert.equal(folders.folderListingStale(db, 2, folders.folderChangeMark(db, 2)), false, 'per account');
});

// ---------------------------------------------------------------------------------------------
// Conversations for mail stored before v2
// ---------------------------------------------------------------------------------------------

test('mail synced before conversations existed gets its threading headers on the next sync', async (t) => {
  if (!dovecot) return t.skip('Dovecot not available');
  await resetUser('s1');
  await appendTo('s1', 'INBOX', buildMessage({ to: 's1@test.local', subject: 'Plan', text: 'first', messageId: '<root-v1@example.org>' }));
  const replyRaw = Buffer.from(
    buildMessage({ to: 's1@test.local', subject: 'Re: Plan', text: 'second', messageId: '<reply-v1@example.org>' })
      .toString('utf8')
      .replace('MIME-Version: 1.0', 'In-Reply-To: <root-v1@example.org>\r\nReferences: <root-v1@example.org>\r\nMIME-Version: 1.0')
  );
  await appendTo('s1', 'INBOX', replyRaw);
  const env = makeEngineEnv();
  try {
    const userId = createUser(env.db);
    const account = sendAccount(env, userId, 's1', 2525);
    const sm = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger: quiet });
    await sm.syncAccount(account.id);
    // What the v2 migration left on rows stored by v1.
    env.db.prepare("UPDATE messages SET in_reply_to = NULL, references_json = NULL, thread_key = 'mid:' || message_id WHERE account_id = ?").run(account.id);
    const reply = () => env.db.prepare("SELECT * FROM messages WHERE message_id = '<reply-v1@example.org>'").get();
    assert.equal(queries.threadMessages(env.db, userId, reply()).length, 1, 'the v1 reply stands alone');
    await sm.syncAccount(account.id);
    const r = reply();
    assert.equal(r.thread_key, 'mid:<root-v1@example.org>');
    assert.equal(r.in_reply_to, '<root-v1@example.org>');
    assert.deepEqual(JSON.parse(r.references_json), ['<root-v1@example.org>']);
    assert.deepEqual(queries.threadMessages(env.db, userId, r).map((m) => m.message_id), ['<root-v1@example.org>', '<reply-v1@example.org>']);
    assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE references_json IS NULL').get().n, 0);
  } finally {
    env.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Gmail: starred + archived mail is in Starred
// ---------------------------------------------------------------------------------------------

test('Starred view: mail stored only in All Mail or Gmail\'s Starred is listed; a real folder\'s copy wins', async (t) => {
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const user = await signupUser(alice, { email: 'alice@example.com' });
  const account = seedAccount(srv.db, srv.crypto, user.id, { provider: 'gmail' });
  const inbox = seedFolder(srv.db, account.id, 'INBOX');
  const all = seedFolder(srv.db, account.id, '[Gmail]/All Mail', { specialUse: '\\All', sync_mode: 'on_demand' });
  const starredView = seedFolder(srv.db, account.id, '[Gmail]/Starred', { specialUse: '\\Flagged' });
  const trash = seedFolder(srv.db, account.id, '[Gmail]/Trash', { specialUse: '\\Trash' });
  const msg = (folder, messageId, extra = {}) => seedMessage(srv.db, account.id, { mailbox: folder.path, folder_id: folder.id, is_starred: 1, message_id: messageId, ...extra });
  // Archived after starring: only in All Mail and Starred.
  msg(starredView, '<archived@x>', { date: 3000 });
  const archivedAll = msg(all, '<archived@x>', { date: 3000 });
  // Only in Gmail's Starred (All Mail never opened).
  const onlyStarred = msg(starredView, '<only-starred@x>', { date: 2000 });
  // Still in the inbox: the inbox copy is the one shown.
  msg(starredView, '<in-inbox@x>', { date: 1000 });
  const inInbox = msg(inbox, '<in-inbox@x>', { date: 1000 });
  msg(trash, '<trashed@x>', { date: 500 });
  const res = await alice.get('/api/messages?view=starred');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.messages.map((m) => m.id), [archivedAll.id, onlyStarred.id, inInbox.id]);
});

test('GET /api/outbox/:id: any status, to its owner only (the composer follows a send with it)', async (t) => {
  const srv = await startTestServer({}, { stubSync: true });
  t.after(() => srv.close());
  const alice = makeClient(srv.baseUrl);
  const mallory = makeClient(srv.baseUrl);
  const user = await signupUser(alice, { email: 'alice@example.com' });
  await signupUser(mallory, { email: 'mallory@example.com' });
  const account = seedAccount(srv.db, srv.crypto, user.id, {});
  const info = srv.db
    .prepare("INSERT INTO outbox (user_id, account_id, payload, send_at, status, created_at) VALUES (?, ?, ?, ?, 'cancelled', ?)")
    .run(user.id, account.id, JSON.stringify({ subject: 'Stopped', to: [{ name: '', address: 'x@example.org' }] }), Date.now(), Date.now());
  const id = Number(info.lastInsertRowid);
  const res = await alice.get(`/api/outbox/${id}`);
  assert.equal(res.status, 200);
  assert.deepEqual([res.body.outbox.id, res.body.outbox.status, res.body.outbox.subject], [id, 'cancelled', 'Stopped']);
  assert.equal((await alice.get('/api/outbox')).body.items.length, 0, 'not in the active list');
  assert.equal((await mallory.get(`/api/outbox/${id}`)).status, 404);
  assert.equal((await alice.get(`/api/outbox/${id + 100}`)).status, 404);
  assert.equal((await alice.get('/api/outbox/abc')).status, 400);
});
