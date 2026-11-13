'use strict';

/**
 * Helpers for the backend-gaps tests (test/gaps-*.test.js) that need the Dovecot test server.
 * Only q1@test.local and q2@test.local are used, behind a cross-process lock; resetUser() puts
 * a user back to the default folders (INBOX Sent Drafts Junk Trash Archive), all empty.
 */

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { ImapFlow } = require('imapflow');

const HOST = '127.0.0.1';
const PORT = 1143;
const USERS = new Set(['q1', 'q2']);
const DEFAULT_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Junk', 'Trash', 'Archive'];

function creds(name) {
  if (!USERS.has(name)) throw new Error(`gaps-helpers: "${name}" is not a backend-gaps test user (q1, q2)`);
  return { user: `${name}@test.local`, pass: `${name}pw` };
}

let reachable = null;
function dovecotAvailable() {
  if (!reachable) {
    reachable = new Promise((resolve) => {
      const socket = net.connect({ host: HOST, port: PORT });
      const done = (ok) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(1000, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  }
  return reachable;
}

async function withUser(name, fn) {
  const { user, pass } = creds(name);
  const client = new ImapFlow({
    host: HOST,
    port: PORT,
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

/** Delete extra folders (deepest first), recreate the defaults, delete every message. */
async function resetUser(name) {
  await withUser(name, async (client) => {
    const extra = (await client.list())
      .filter((box) => !DEFAULT_FOLDERS.includes(box.path))
      .sort((a, b) => b.path.split(b.delimiter || '/').length - a.path.split(a.delimiter || '/').length || b.path.localeCompare(a.path));
    for (const box of extra) await client.mailboxDelete(box.path).catch(() => {});
    const existing = new Set((await client.list()).map((box) => box.path));
    for (const box of DEFAULT_FOLDERS) if (!existing.has(box)) await client.mailboxCreate(box).catch(() => {});
    for (const box of DEFAULT_FOLDERS) {
      const lock = await client.getMailboxLock(box);
      try {
        if (client.mailbox.exists > 0) await client.messageDelete('1:*');
      } finally {
        lock.release();
      }
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

/** Cross-process lock for q1/q2 (test files may run in parallel). Returns release(). */
async function lockUsers({ timeoutMs = 180000 } = {}) {
  const dir = path.join(os.tmpdir(), 'mailtabs-gaps-q1q2.lock');
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
      if (Date.now() > deadline) throw new Error('Timed out waiting for the q1/q2 IMAP test lock');
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

let seq = 0;
function rawMessage({ subject = 'Test', from = 'Sender <sender@example.com>', to = 'someone@test.local', body = 'Hello', messageId } = {}) {
  seq += 1;
  const id = messageId || `<gaps-${process.pid}-${Date.now()}-${seq}@mailtabs.test>`;
  return Buffer.from(
    [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, `Message-ID: ${id}`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', body, ''].join('\r\n')
  );
}

async function append(name, mailbox, message = {}, flags = []) {
  return withUser(name, async (client) => {
    const res = await client.append(mailbox, rawMessage(message), flags);
    return res && res.uid;
  });
}

/** [{ uid, flags, source }] of one mailbox. */
async function messagesIn(name, mailbox) {
  return withUser(name, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const out = [];
      if (!client.mailbox.exists) return out;
      for await (const msg of client.fetch('1:*', { uid: true, flags: true, source: true })) {
        out.push({ uid: msg.uid, flags: msg.flags, source: msg.source });
      }
      return out;
    } finally {
      lock.release();
    }
  });
}

/** Account row fields for a q user on the local Dovecot (password auth, SMTP via the dev relay port given). */
function accountFields(name, extra = {}) {
  const { user, pass } = creds(name);
  return { email: user, imap_user: user, password: pass, display_name: name, imap_host: HOST, imap_port: PORT, imap_security: 'none', ...extra };
}

module.exports = { dovecotAvailable, withUser, resetUser, lockUsers, rawMessage, append, messagesIn, accountFields, creds, DEFAULT_FOLDERS };
