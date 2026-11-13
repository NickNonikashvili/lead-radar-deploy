'use strict';

/**
 * Test helpers for the FOLDERS engine tests (and the engine tests that need every folder of a
 * Dovecot user reset). Not a test file itself.
 *
 * Dovecot (127.0.0.1:1143, plain): every user has INBOX, Sent, Drafts, Junk, Trash and Archive
 * (special-use flags come from the server config), hierarchy delimiter "/".
 * Users: f1, f2 belong to the FOLDERS area; alice and v2 to the older engine tests.
 */

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const nodeCrypto = require('crypto');
const { ImapFlow } = require('imapflow');

const HOST = '127.0.0.1';
const PORT = 1143;
const ALLOWED_USERS = new Set(['f1', 'f2', 'alice', 'v2']);
const DEFAULT_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Junk', 'Trash', 'Archive'];

function creds(name) {
  if (!ALLOWED_USERS.has(name)) throw new Error(`Test user "${name}" does not belong to the folders tests`);
  return { user: `${name}@test.local`, pass: `${name}pw` };
}

let reachablePromise = null;
function dovecotAvailable() {
  if (!reachablePromise) {
    reachablePromise = new Promise((resolve) => {
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
  return reachablePromise;
}

/** Run fn(client) as a test user; always logs out. */
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

/**
 * Empty every folder of a user, delete every folder that is not one of the defaults (deepest
 * first) and recreate any default folder a test deleted.
 */
async function resetUser(name) {
  await withUser(name, async (client) => {
    const list = await client.list();
    const extra = list
      .filter((box) => !DEFAULT_FOLDERS.includes(box.path))
      .sort((a, b) => b.path.split('/').length - a.path.split('/').length || b.path.localeCompare(a.path));
    for (const box of extra) {
      try {
        await client.mailboxDelete(box.path);
      } catch (_) {
        /* already gone */
      }
    }
    const present = new Set(list.map((box) => box.path));
    for (const box of DEFAULT_FOLDERS) {
      if (!present.has(box)) await client.mailboxCreate(box);
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

/**
 * Cross-process lock for one user's mailbox. Uses the same lock directory as the older helpers
 * (engine-helpers.lockAlice for alice, helpers.lockTestImapUser for the others), so every test
 * file touching that user waits for the others. Returns release().
 */
async function lockUser(name, { timeoutMs = 180000 } = {}) {
  creds(name);
  const dir = path.join(os.tmpdir(), `mailtabs-${name}-imap.lock`);
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
        /* owner has not written its pid yet */
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
      if (Date.now() > deadline) throw new Error(`Timed out waiting for the ${name} IMAP test lock`);
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

/** A raw RFC 822 message. */
function rawMessage({
  from = 'Sender <sender@example.com>',
  to = 'someone@test.local',
  subject = 'Test message',
  text = 'Hello',
  date = new Date(),
  messageId,
  inReplyTo,
  references,
  extraHeaders = [],
} = {}) {
  const head = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date(date).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${messageId || `<${nodeCrypto.randomBytes(8).toString('hex')}@folders.test>`}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    ...extraHeaders,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  return Buffer.from(`${head.join('\r\n')}\r\n\r\n${text}\r\n`, 'utf8');
}

/** APPEND messages to a folder of a user over one connection; returns their UIDs. */
async function appendMany(name, mailbox, messages) {
  return withUser(name, async (client) => {
    const uids = [];
    for (const m of messages) {
      const { flags = [], date, ...rest } = m;
      const res = await client.append(mailbox, rawMessage({ date, ...rest }), flags, date ? new Date(date) : undefined);
      if (!res || !res.uid) throw new Error(`APPEND to ${mailbox} returned no UID`);
      uids.push(res.uid);
    }
    return uids;
  });
}

async function append(name, mailbox, message = {}) {
  return (await appendMany(name, mailbox, [message]))[0];
}

/** Subjects in a folder (sorted). */
async function subjects(name, mailbox) {
  return withUser(name, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const out = [];
      if (!client.mailbox.exists) return out;
      for await (const msg of client.fetch('1:*', { envelope: true })) out.push(msg.envelope.subject);
      return out.sort();
    } finally {
      lock.release();
    }
  });
}

/** { uid -> Set(flags) } of a folder. */
async function flagsOf(name, mailbox) {
  return withUser(name, async (client) => {
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

/** UIDVALIDITY of a folder. */
async function uidValidityOf(name, mailbox) {
  return withUser(name, async (client) => {
    const status = await client.status(mailbox, { uidValidity: true });
    return Number(status.uidValidity);
  });
}

/** Account row fields for a Dovecot test user (for engine-helpers.createAccount overrides). */
function accountFor(name, extra = {}) {
  const { user, pass } = creds(name);
  return { email: user, imap_user: user, imap_host: HOST, imap_port: PORT, imap_security: 'none', password: pass, ...extra };
}

/** Rows of one folder (by path) of an account, ordered by UID. */
function rowsIn(db, accountId, folderPath) {
  return db
    .prepare('SELECT m.* FROM messages m JOIN folders f ON f.id = m.folder_id WHERE m.account_id = ? AND f.path = ? ORDER BY m.uid')
    .all(accountId, folderPath);
}

function folderRow(db, accountId, folderPath) {
  return db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(accountId, folderPath);
}

function folderState(db, accountId, folderPath) {
  const row = folderRow(db, accountId, folderPath);
  return row && row.sync_state ? JSON.parse(row.sync_state) : null;
}

module.exports = {
  DEFAULT_FOLDERS,
  dovecotAvailable,
  withUser,
  resetUser,
  lockUser,
  rawMessage,
  append,
  appendMany,
  subjects,
  flagsOf,
  uidValidityOf,
  accountFor,
  rowsIn,
  folderRow,
  folderState,
};
