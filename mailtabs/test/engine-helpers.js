'use strict';

/**
 * Test helpers for the ENGINE area (providers, netguard, oauth, imap, mailparse, sync, actions).
 * Deliberately independent of the HTTP app (test/helpers.js requires src/app.js).
 *
 * IMAP tests use ONLY alice@test.local on the local Dovecot (127.0.0.1:1143, plain text).
 */

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const nodeCrypto = require('crypto');
const { ImapFlow } = require('imapflow');

const { loadConfig } = require('../src/config');
const { openDb } = require('../src/db');
const { createCrypto } = require('../src/crypto');

const ALICE = Object.freeze({ host: '127.0.0.1', port: 1143, user: 'alice@test.local', pass: 'alicepw' });

/** Build { config, db, crypto } for unit tests; call close() when done. */
function makeEngineEnv(envOverrides = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailtabs-engine-'));
  const config = loadConfig({
    DATA_DIR: dataDir,
    SECRET_KEY: 'x'.repeat(40),
    ALLOW_PRIVATE_IMAP_HOSTS: 'true',
    DISABLE_SYNC_SCHEDULER: 'true',
    APP_URL: 'http://localhost:3999',
    ...envOverrides,
  });
  const db = openDb(':memory:');
  const crypto = createCrypto(config.secretKey);
  return {
    config,
    db,
    crypto,
    dataDir,
    close() {
      try {
        db.close();
      } catch (_) {
        /* already closed */
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

let userSeq = 0;
function createUser(db, email) {
  userSeq += 1;
  const info = db
    .prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(email || `engine-user-${userSeq}-${nodeCrypto.randomBytes(3).toString('hex')}@example.com`, 'Engine Tester', 'x', Date.now());
  return Number(info.lastInsertRowid);
}

/** Insert an account row (defaults: alice on the local Dovecot, password auth). Returns the row. */
function createAccount(db, crypto, userId, overrides = {}) {
  const { password = ALICE.pass, secret, ...rest } = overrides;
  const row = {
    user_id: userId,
    provider: 'imap',
    auth_type: 'password',
    email: ALICE.user,
    display_name: 'Alice',
    color: '#4f46e5',
    imap_host: ALICE.host,
    imap_port: ALICE.port,
    imap_security: 'none',
    imap_user: ALICE.user,
    secret_enc: crypto.encryptJson(secret || { password }),
    mailbox: 'INBOX',
    sync_state: null,
    status: 'pending',
    created_at: Date.now(),
    ...rest,
  };
  const cols = Object.keys(row);
  const info = db.prepare(`INSERT INTO accounts (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`).run(row);
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(Number(info.lastInsertRowid));
}

function getAccount(db, id) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

function messagesOf(db, accountId) {
  return db.prepare('SELECT * FROM messages WHERE account_id = ? ORDER BY uid').all(accountId);
}

/** A logger that records warnings/errors instead of printing them. */
function recordingLogger() {
  const lines = [];
  const rec = (level) => (...args) => lines.push({ level, text: args.map(String).join(' ') });
  return { lines, debug() {}, info() {}, log() {}, warn: rec('warn'), error: rec('error') };
}

// ---------------------------------------------------------------------------------------------
// IMAP (alice only)
// ---------------------------------------------------------------------------------------------

let availablePromise = null;
function aliceAvailable() {
  if (!availablePromise) {
    availablePromise = new Promise((resolve) => {
      const socket = net.connect({ host: ALICE.host, port: ALICE.port });
      const done = (ok) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(1000, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  }
  return availablePromise;
}

async function withAlice(fn) {
  const client = new ImapFlow({
    host: ALICE.host,
    port: ALICE.port,
    secure: false,
    doSTARTTLS: false,
    auth: { user: ALICE.user, pass: ALICE.pass },
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

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Cross-process lock so test files that use alice's mailbox never run at the same time
 * (`node --test` runs files in parallel unless --test-concurrency=1). Returns a release function.
 */
async function lockAlice({ timeoutMs = 180000 } = {}) {
  const dir = path.join(os.tmpdir(), 'mailtabs-alice-imap.lock');
  const pidFile = path.join(dir, 'pid');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.mkdirSync(dir); // atomic: only one process can create it
      fs.writeFileSync(pidFile, String(process.pid));
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let pid = 0;
      try {
        pid = Number(fs.readFileSync(pidFile, 'utf8')) || 0;
      } catch (_) {
        /* owner is between mkdir and writing its pid */
      }
      let stale = pid ? !processAlive(pid) : false;
      if (!pid) {
        try {
          stale = Date.now() - fs.statSync(dir).mtimeMs > 10000;
        } catch (_) {
          stale = false; // just released
        }
      }
      if (stale) {
        fs.rmSync(dir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error('Timed out waiting for the alice IMAP test lock');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      if (Number(fs.readFileSync(pidFile, 'utf8')) === process.pid) fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      /* already gone */
    }
  };
}

/** Empty alice's INBOX, Archive and Trash. */
async function resetAlice() {
  await withAlice(async (client) => {
    for (const box of ['INBOX', 'Archive', 'Trash']) {
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

/** APPEND a raw message (Buffer/string) to one of alice's mailboxes; returns the UID. */
async function appendAlice(raw, { flags = [], mailbox = 'INBOX', date } = {}) {
  return withAlice(async (client) => {
    const res = await client.append(mailbox, raw, flags, date);
    if (!res || !res.uid) throw new Error(`APPEND to ${mailbox} returned no UID`);
    return res.uid;
  });
}

/** { uid -> Set(flags) } for one of alice's mailboxes. */
async function aliceFlags(mailbox = 'INBOX') {
  return withAlice(async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const out = new Map();
      if (!client.mailbox.exists) return out;
      for await (const msg of client.fetch('1:*', { uid: true, flags: true })) out.set(msg.uid, msg.flags);
      return out;
    } finally {
      lock.release();
    }
  });
}

/** Subjects of the messages in one of alice's mailboxes. */
async function aliceSubjects(mailbox) {
  return withAlice(async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const out = [];
      if (!client.mailbox.exists) return out;
      for await (const msg of client.fetch('1:*', { uid: true, envelope: true })) out.push(msg.envelope.subject);
      return out;
    } finally {
      lock.release();
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Tiny MIME builder
// ---------------------------------------------------------------------------------------------

function encodeWord(value) {
  const s = String(value);
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function b64(buf) {
  return Buffer.from(buf).toString('base64').replace(/.{1,76}/g, '$&\r\n');
}

function leaf(contentType, content, extra = []) {
  return [`Content-Type: ${contentType}`, 'Content-Transfer-Encoding: base64', ...extra, '', b64(content)].join('\r\n');
}

function multipart(subtype, parts) {
  const boundary = `=_eng_${nodeCrypto.randomBytes(10).toString('hex')}`;
  return `Content-Type: multipart/${subtype}; boundary="${boundary}"\r\n\r\n${parts.map((p) => `--${boundary}\r\n${p}`).join('\r\n')}\r\n--${boundary}--\r\n`;
}

function attachmentPart(att) {
  const content = Buffer.isBuffer(att.content) ? att.content : Buffer.from(String(att.content || ''), 'utf8');
  const headers = [`Content-Disposition: ${att.cid ? 'inline' : 'attachment'}; filename="${att.filename}"`];
  if (att.cid) headers.push(`Content-ID: <${att.cid}>`);
  return leaf(`${att.contentType || 'application/octet-stream'}; name="${att.filename}"`, content, headers);
}

/**
 * Build a raw RFC 822 message (Buffer).
 * { from, to, subject, text, html, date, messageId, attachments: [{filename, contentType, content, cid?}] }
 */
function buildMessage({
  from = 'Sender <sender@example.com>',
  to = ALICE.user,
  cc,
  subject = 'Test message',
  text,
  html,
  date = new Date(),
  messageId,
  attachments = [],
} = {}) {
  const head = [
    `From: ${from}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${encodeWord(subject)}`,
    `Date: ${new Date(date).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${messageId || `<${nodeCrypto.randomBytes(8).toString('hex')}@engine.test>`}`,
    'MIME-Version: 1.0',
  ];
  if (text === undefined && html === undefined) text = '';
  const inline = attachments.filter((a) => a.cid);
  const files = attachments.filter((a) => !a.cid);
  const textPart = text !== undefined ? leaf('text/plain; charset=utf-8', Buffer.from(text, 'utf8')) : null;
  let htmlPart = html !== undefined ? leaf('text/html; charset=utf-8', Buffer.from(html, 'utf8')) : null;
  if (htmlPart && inline.length) htmlPart = multipart('related', [htmlPart, ...inline.map(attachmentPart)]);
  let body = textPart && htmlPart ? multipart('alternative', [textPart, htmlPart]) : textPart || htmlPart;
  if (files.length) body = multipart('mixed', [body, ...files.map(attachmentPart)]);
  return Buffer.from(`${head.join('\r\n')}\r\n${body}`, 'utf8');
}

/** A 1x1 transparent PNG. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

module.exports = {
  ALICE,
  makeEngineEnv,
  createUser,
  createAccount,
  getAccount,
  messagesOf,
  recordingLogger,
  aliceAvailable,
  lockAlice,
  withAlice,
  resetAlice,
  appendAlice,
  aliceFlags,
  aliceSubjects,
  buildMessage,
  TINY_PNG,
};
