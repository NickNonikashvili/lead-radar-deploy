'use strict';

/**
 * Test helpers for the SENDING area (smtp, compose, uploads, drafts, outbox).
 *
 * IMAP tests use ONLY s1@test.local and s2@test.local on the local Dovecot (127.0.0.1:1143,
 * plain text). SMTP tests start an in-process smtp-server on a random port that records every
 * message (and can deliver it to s2's INBOX to simulate a real delivery).
 */

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { ImapFlow } = require('imapflow');
const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');

const { makeEngineEnv, createUser, createAccount, buildMessage, TINY_PNG } = require('./engine-helpers');

const IMAP = Object.freeze({ host: '127.0.0.1', port: 1143 });
const USERS = Object.freeze({
  s1: Object.freeze({ user: 's1@test.local', pass: 's1pw' }),
  s2: Object.freeze({ user: 's2@test.local', pass: 's2pw' }),
});
const SPECIAL_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Archive', 'Junk', 'Trash'];

function creds(name) {
  const c = USERS[name];
  if (!c) throw new Error(`send-helpers: unknown test user ${name} (only s1, s2)`);
  return c;
}

let available = null;
function imapAvailable() {
  if (!available) {
    available = new Promise((resolve) => {
      const socket = net.connect(IMAP);
      const done = (ok) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(1000, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  }
  return available;
}

async function withUser(name, fn) {
  const { user, pass } = creds(name);
  const client = new ImapFlow({
    ...IMAP,
    secure: false,
    doSTARTTLS: false,
    auth: { user, pass },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  });
  client.on('error', () => {});
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch (_) {
      client.close();
    }
  }
}

/** Empty every special folder of a test user and delete any other folder it has. */
async function resetUser(name) {
  await withUser(name, async (client) => {
    for (const box of await client.list()) {
      if (!SPECIAL_FOLDERS.includes(box.path)) {
        await client.mailboxDelete(box.path).catch(() => {});
      }
    }
    for (const box of SPECIAL_FOLDERS) {
      let lock;
      try {
        lock = await client.getMailboxLock(box);
      } catch (_) {
        continue;
      }
      try {
        if (client.mailbox.exists > 0) await client.messageDelete('1:*');
      } finally {
        lock.release();
      }
    }
  });
}

/** APPEND to a test user's mailbox; returns { uid, uidValidity }. */
async function appendTo(name, mailbox, raw, flags = []) {
  return withUser(name, async (client) => {
    const res = await client.append(mailbox, raw, flags);
    return { uid: res.uid, uidValidity: Number(res.uidValidity) };
  });
}

/** [{ uid, flags:Set, source:Buffer, envelope }] of one of a user's mailboxes. */
async function messagesIn(name, mailbox) {
  return withUser(name, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const out = [];
      if (!client.mailbox.exists) return out;
      for await (const msg of client.fetch('1:*', { uid: true, flags: true, source: true, envelope: true })) {
        out.push({ uid: msg.uid, flags: msg.flags, source: msg.source, envelope: msg.envelope });
      }
      return out;
    } finally {
      lock.release();
    }
  });
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/** Cross-process lock for s1/s2 (test files may run in parallel). Returns release(). */
async function lockUsers({ timeoutMs = 180000 } = {}) {
  const dir = path.join(os.tmpdir(), 'mailtabs-sending-s1s2.lock');
  const pidFile = path.join(dir, 'pid');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(pidFile, String(process.pid));
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let pid = 0;
      try {
        pid = Number(fs.readFileSync(pidFile, 'utf8')) || 0;
      } catch (_) {
        /* being written */
      }
      let stale = pid ? !processAlive(pid) : false;
      if (!pid) {
        try {
          stale = Date.now() - fs.statSync(dir).mtimeMs > 10000;
        } catch (_) {
          stale = false;
        }
      }
      if (stale) {
        fs.rmSync(dir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error('Timed out waiting for the s1/s2 IMAP test lock');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      if (Number(fs.readFileSync(pidFile, 'utf8')) === process.pid) fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      /* gone */
    }
  };
}

// ---------------------------------------------------------------------------------------------
// In-process SMTP server
// ---------------------------------------------------------------------------------------------

/**
 * Start an SMTP server (no TLS) that requires AUTH (PLAIN/LOGIN/XOAUTH2).
 * @param {{ passwords?: {[user]: string}, tokens?: {[user]: string}, deliver?: (raw, envelope) => Promise,
 *   rejectRecipients?: string[], authError?: string, size?: number }} opts
 * @returns {Promise<{ port, messages: Array<{ from, to, raw, auth }>, opts, close() }>}
 */
async function startSmtpServer(opts = {}) {
  const messages = [];
  const state = { opts, messages, auths: [] };
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    authMethods: ['PLAIN', 'LOGIN', 'XOAUTH2'],
    size: opts.size || 0,
    logger: false,
    onAuth(auth, session, cb) {
      state.auths.push({ method: auth.method, username: auth.username, accessToken: auth.accessToken });
      if (state.opts.authError) {
        const err = new Error(state.opts.authError);
        err.responseCode = 535;
        return cb(err);
      }
      if (auth.method === 'XOAUTH2') {
        const want = (state.opts.tokens || {})[auth.username];
        if (want && auth.accessToken === want) return cb(null, { user: auth.username });
        return cb(null, { data: { status: '401', schemes: 'bearer', scope: 'https://mail.google.com/' } });
      }
      const want = (state.opts.passwords || {})[auth.username];
      if (want !== undefined && auth.password === want) return cb(null, { user: auth.username });
      const err = new Error('Authentication credentials invalid');
      err.responseCode = 535;
      return cb(err);
    },
    onRcptTo(address, session, cb) {
      if ((state.opts.rejectRecipients || []).includes(address.address)) {
        const err = new Error(`5.1.1 <${address.address}>: Recipient address rejected: User unknown`);
        err.responseCode = 550;
        return cb(err);
      }
      cb();
    },
    onData(stream, session, cb) {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', async () => {
        if (stream.sizeExceeded) {
          const err = new Error('5.3.4 Message size exceeds fixed maximum message size');
          err.responseCode = 552;
          return cb(err);
        }
        const raw = Buffer.concat(chunks);
        const envelope = { from: session.envelope.mailFrom.address, to: session.envelope.rcptTo.map((r) => r.address) };
        messages.push({ ...envelope, raw, auth: session.user });
        try {
          if (state.opts.deliver) await state.opts.deliver(raw, envelope);
        } catch (_) {
          /* delivery simulation only */
        }
        cb(null, 'Queued as test');
      });
    },
  });
  server.on('error', () => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  state.port = server.server.address().port;
  state.close = () => new Promise((resolve) => server.close(resolve));
  return state;
}

/** A port nothing listens on (for connection-refused tests). */
async function closedPort() {
  const srv = net.createServer();
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address();
  await new Promise((resolve) => srv.close(resolve));
  return port;
}

// ---------------------------------------------------------------------------------------------
// Accounts / messages
// ---------------------------------------------------------------------------------------------

/** Password account for s1/s2 on the local Dovecot, sending through the given SMTP port. */
function sendAccount(env, userId, name, smtpPort, overrides = {}) {
  const { user, pass } = creds(name);
  return createAccount(env.db, env.crypto, userId, {
    email: user,
    imap_user: user,
    display_name: name,
    password: pass,
    smtp_host: '127.0.0.1',
    smtp_port: smtpPort,
    smtp_security: 'none',
    ...overrides,
  });
}

/**
 * Store a row for a message already on the server (what the sync would have stored), with its
 * body parsed like the sync does.
 */
async function storeMessageRow(env, account, { mailbox = 'INBOX', uid, uidValidity, raw, folderId = null }) {
  const { parseRawMessage } = require('../src/mailparse');
  const parsed = await parseRawMessage(raw);
  const row = {
    account_id: account.id,
    mailbox,
    folder_id: folderId,
    uid,
    uid_validity: uidValidity,
    message_id: parsed.messageId,
    from_name: parsed.from ? parsed.from.name : null,
    from_address: parsed.from ? parsed.from.address : null,
    to_json: JSON.stringify(parsed.to),
    cc_json: JSON.stringify(parsed.cc),
    reply_to_json: JSON.stringify(parsed.replyTo),
    subject: parsed.subject,
    snippet: parsed.snippet,
    date: parsed.date || Date.now(),
    body_state: 'ready',
    text_body: parsed.text,
    html_body: parsed.html,
    attachments_json: JSON.stringify(parsed.attachments.map(({ content, ...meta }) => meta)),
    has_attachments: parsed.hasAttachments ? 1 : 0,
    references_json: JSON.stringify(parsed.references || []),
    in_reply_to: parsed.inReplyTo || null,
    created_at: Date.now(),
  };
  const cols = Object.keys(row);
  const info = env.db.prepare(`INSERT INTO messages (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`).run(row);
  const id = Number(info.lastInsertRowid);
  // Like the sync: cid: links point at the attachment endpoint once the row id is known.
  if (parsed.html) {
    const { rewriteCidLinks } = require('../src/mailparse');
    env.db.prepare('UPDATE messages SET html_body = ? WHERE id = ?').run(rewriteCidLinks(parsed.html, id, parsed.attachments), id);
  }
  return env.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

function parse(raw) {
  return simpleParser(raw, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true });
}

/** The header block of a raw message (unfolded lines). */
function headerBlock(raw) {
  const s = Buffer.from(raw).toString('utf8');
  const end = s.indexOf('\r\n\r\n');
  return (end >= 0 ? s.slice(0, end) : s).replace(/\r\n[ \t]+/g, ' ');
}

function headerLines(raw, name) {
  return headerBlock(raw)
    .split('\r\n')
    .filter((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`));
}

function waitFor(fn, { timeoutMs = 10000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return (async () => {
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > deadline) throw new Error('waitFor: timed out');
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
}

module.exports = {
  USERS,
  imapAvailable,
  withUser,
  resetUser,
  appendTo,
  messagesIn,
  lockUsers,
  startSmtpServer,
  closedPort,
  sendAccount,
  storeMessageRow,
  parse,
  headerBlock,
  headerLines,
  waitFor,
  makeEngineEnv,
  createUser,
  createAccount,
  buildMessage,
  TINY_PNG,
};
