'use strict';

/**
 * Shared test helpers. CORE owns the base; other areas may append exports at the bottom.
 *
 *   const { startTestServer, makeClient, signupUser } = require('./helpers');
 *   const srv = await startTestServer({ ALLOW_SIGNUPS: 'false' }, { stubSync: true });
 *   const client = makeClient(srv.baseUrl);
 *   await signupUser(client, { email: 'me@example.com' });
 *   ...
 *   await srv.close();
 */

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const nodeCrypto = require('crypto');

const { loadConfig } = require('../src/config');
const { openDb } = require('../src/db');
const { createCrypto } = require('../src/crypto');
const { createApp } = require('../src/app');

const TEST_SECRET_KEY = 'test-secret-key-0123456789abcdef0123456789abcdef';
const DEFAULT_TEST_PASSWORD = 'correct horse battery staple';

// ---------------------------------------------------------------------------------------------
// Sync manager stub (for tests that do not touch IMAP)
// ---------------------------------------------------------------------------------------------

class StubSyncManager {
  constructor({ db } = {}) {
    this.db = db;
    this.calls = { syncAccount: [], syncUser: [], fetchBodyNow: [], syncFolder: [], backfillFolder: [] };
  }

  async syncFolder(folderId, { markOpened = true } = {}) {
    this.calls.syncFolder.push({ folderId, markOpened });
    const folder = this.db ? this.db.prepare('SELECT account_id FROM folders WHERE id = ?').get(folderId) : null;
    if (!folder) return { accountId: null, folderId, ok: false, newMessages: 0, removed: 0, updated: 0, error: 'Folder not found' };
    return { accountId: folder.account_id, folderId, ok: true, newMessages: 0, removed: 0, updated: 0 };
  }

  async backfillFolder(folderId, { count = 100 } = {}) {
    this.calls.backfillFolder.push({ folderId, count });
    return { added: 0, hasOlder: false };
  }

  start() {}

  async stop() {}

  async syncAccount(accountId) {
    this.calls.syncAccount.push(accountId);
    return { accountId, ok: true, newMessages: 0, removed: 0, updated: 0 };
  }

  async syncUser(userId) {
    this.calls.syncUser.push(userId);
    const rows = this.db ? this.db.prepare('SELECT id FROM accounts WHERE user_id = ? ORDER BY id').all(userId) : [];
    return rows.map((r) => ({ accountId: r.id, ok: true, newMessages: 0, removed: 0, updated: 0 }));
  }

  async fetchBodyNow(row) {
    this.calls.fetchBodyNow.push(row && row.id);
    return row;
  }

  isSyncing() {
    return false;
  }
}

// Sync logs are useful when debugging but noisy in normal runs: set MAILTABS_TEST_LOG=1 to see them.
const quietLogger = {
  log() {},
  info() {},
  debug() {},
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

// ---------------------------------------------------------------------------------------------
// Test server
// ---------------------------------------------------------------------------------------------

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

/**
 * Start the real app on a random port with a throwaway data directory.
 * @param {Record<string,string>} envOverrides  env vars passed to loadConfig (merged over test defaults)
 * @param {{ stubSync?: boolean, publicDir?: string, logger?: object,
 *           outbox?: 'manual'|'auto'|object, outboxOptions?: object }} options
 *   outbox: 'manual' (default) = the real OutboxManager, not started: messages are queued and
 *   only sent when the test calls `srv.outboxManager.sendDue()`; 'auto' = started (sends when due,
 *   like the server); an object = use it as the outbox manager (a stub). outboxOptions are passed
 *   to the OutboxManager constructor (e.g. { retryDelayMs, sentCopyCheckDelayMs }).
 * @returns {Promise<{ baseUrl, config, db, crypto, syncManager, outboxManager, app, server, dataDir, close }>}
 */
async function startTestServer(envOverrides = {}, { stubSync = false, publicDir, logger, outbox = 'manual', outboxOptions = {} } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailtabs-test-'));
  // Listen first so APP_URL can contain the real port (OAuth redirect URIs depend on it).
  const server = http.createServer();
  let db;
  let syncManager;
  let outboxManager;
  try {
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    // A clean env (not process.env) so a developer's own .env / OAuth keys never leak into tests.
    const env = {
      DATA_DIR: dataDir,
      SECRET_KEY: TEST_SECRET_KEY,
      PORT: String(port),
      APP_URL: baseUrl,
      DISABLE_SYNC_SCHEDULER: 'true',
      ALLOW_PRIVATE_IMAP_HOSTS: 'true',
      ...envOverrides,
    };
    const config = loadConfig(env);
    db = openDb(path.join(dataDir, 'mailtabs.db'));
    const crypto = createCrypto(config.secretKey);

    if (stubSync) {
      syncManager = new StubSyncManager({ db });
    } else {
      // Required lazily so stubbed tests do not depend on the sync engine at all.
      const { SyncManager } = require('../src/sync');
      syncManager = new SyncManager({ db, crypto, config, logger: process.env.MAILTABS_TEST_LOG ? console : quietLogger });
    }

    if (outbox && typeof outbox === 'object') {
      outboxManager = outbox;
    } else {
      const { OutboxManager } = require('../src/outbox');
      outboxManager = new OutboxManager({ db, crypto, config, syncManager, logger: quietLogger, sentCopyCheckDelayMs: 0, ...outboxOptions });
    }

    const app = createApp({ db, config, crypto, syncManager, outboxManager, publicDir, logger });
    server.on('request', app);
    syncManager.start();
    if (outbox === 'auto') outboxManager.start();

    let closed = false;
    async function close() {
      if (closed) return;
      closed = true;
      try {
        if (typeof outboxManager.stop === 'function') await outboxManager.stop();
      } catch (err) {
        console.error('test server: outboxManager.stop failed:', err);
      }
      try {
        await syncManager.stop();
      } catch (err) {
        console.error('test server: syncManager.stop failed:', err);
      }
      await new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      try {
        db.close();
      } catch (_) {
        /* already closed */
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    }

    return { baseUrl, config, db, crypto, syncManager, outboxManager, app, server, dataDir, close };
  } catch (err) {
    // Do not leak a listening socket or temp dir when setup fails.
    if (outboxManager && typeof outboxManager.stop === 'function') await Promise.resolve(outboxManager.stop()).catch(() => {});
    if (syncManager && typeof syncManager.stop === 'function') await Promise.resolve(syncManager.stop()).catch(() => {});
    server.close();
    if (db) db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// HTTP client with a cookie jar
// ---------------------------------------------------------------------------------------------

function parseSetCookie(line) {
  const [pair, ...attrParts] = line.split(';');
  const eq = pair.indexOf('=');
  if (eq < 0) return null;
  const attrs = {};
  for (const part of attrParts) {
    const i = part.indexOf('=');
    const k = (i < 0 ? part : part.slice(0, i)).trim().toLowerCase();
    attrs[k] = i < 0 ? true : part.slice(i + 1).trim();
  }
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), attrs };
}

/**
 * makeClient(baseUrl) -> { get, post, patch, put, del, raw, cookies, cookieHeader, setCookie, clearCookies }
 * Every method resolves to { status, headers, body, buffer, setCookies } where `body` is parsed JSON
 * for JSON responses and text otherwise. Redirects are NOT followed (inspect `headers.get('location')`).
 * Non-GET requests made through get/post/patch/put/del automatically carry `X-Mailtabs: 1`.
 * `raw(path, init, { csrf = false })` sends exactly the headers you give it (plus cookies).
 */
function makeClient(baseUrl) {
  const jar = new Map(); // cookie name -> value

  function storeCookies(res) {
    const lines = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    const parsed = [];
    for (const line of lines) {
      const c = parseSetCookie(line);
      if (!c) continue;
      parsed.push(c);
      const maxAge = c.attrs['max-age'] !== undefined ? Number(c.attrs['max-age']) : undefined;
      const expires = c.attrs.expires ? Date.parse(c.attrs.expires) : undefined;
      const expired = (maxAge !== undefined && maxAge <= 0) || (expires !== undefined && expires <= Date.now());
      if (expired || c.value === '') jar.delete(c.name);
      else jar.set(c.name, c.value);
    }
    return parsed;
  }

  function cookieHeader() {
    return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async function raw(urlPath, init = {}, { csrf = false } = {}) {
    const headers = new Headers(init.headers || {});
    if (jar.size && !headers.has('cookie')) headers.set('cookie', cookieHeader());
    const method = (init.method || 'GET').toUpperCase();
    if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers.has('x-mailtabs')) {
      headers.set('x-mailtabs', '1');
    }
    const res = await fetch(new URL(urlPath, baseUrl), { redirect: 'manual', ...init, method, headers });
    const setCookies = storeCookies(res);
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = buffer.toString('utf8');
    let body = text;
    if ((res.headers.get('content-type') || '').includes('json') && text) {
      try {
        body = JSON.parse(text);
      } catch (_) {
        body = text;
      }
    }
    return { status: res.status, headers: res.headers, body, buffer, setCookies };
  }

  function withJson(method) {
    return (urlPath, body, init = {}) => {
      const headers = { ...(init.headers || {}) };
      const opts = { ...init, method, headers };
      if (body !== undefined) {
        headers['content-type'] = headers['content-type'] || 'application/json';
        opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      return raw(urlPath, opts, { csrf: true });
    };
  }

  return {
    get: (urlPath, init = {}) => raw(urlPath, { ...init, method: 'GET' }),
    post: withJson('POST'),
    patch: withJson('PATCH'),
    put: withJson('PUT'),
    del: withJson('DELETE'),
    raw,
    cookies: jar,
    cookieHeader,
    setCookie: (name, value) => jar.set(name, value),
    clearCookies: () => jar.clear(),
  };
}

let userCounter = 0;
/** Sign up (and thereby sign in) a user. Throws with the server's message if it fails. */
async function signupUser(client, { email, password = DEFAULT_TEST_PASSWORD, name } = {}) {
  userCounter += 1;
  const payload = {
    email: email || `user${userCounter}-${nodeCrypto.randomBytes(3).toString('hex')}@example.com`,
    password,
  };
  if (name !== undefined) payload.name = name;
  const res = await client.post('/api/auth/signup', payload);
  if (res.status !== 201) {
    throw new Error(`signupUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { ...res.body.user, password };
}

// ---------------------------------------------------------------------------------------------
// IMAP test server helpers (Dovecot on 127.0.0.1:1143, plain text)
// ---------------------------------------------------------------------------------------------

const IMAP_TEST = Object.freeze({
  host: '127.0.0.1',
  port: 1143,
  security: 'none',
  users: Object.freeze({
    alice: Object.freeze({ user: 'alice@test.local', pass: 'alicepw' }),
    bob: Object.freeze({ user: 'bob@test.local', pass: 'bobpw' }),
    // ROUTES v2 tests (test/v2-*.test.js) only.
    r1: Object.freeze({ user: 'r1@test.local', pass: 'r1pw' }),
    r2: Object.freeze({ user: 'r2@test.local', pass: 'r2pw' }),
  }),
});

let imapAvailablePromise = null;
/** Resolves true when the test IMAP server accepts TCP connections (cached per process). */
function imapAvailable() {
  if (!imapAvailablePromise) {
    imapAvailablePromise = new Promise((resolve) => {
      const socket = net.connect({ host: IMAP_TEST.host, port: IMAP_TEST.port });
      const done = (ok) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(1000, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  }
  return imapAvailablePromise;
}

function testUser(userKey) {
  const creds = IMAP_TEST.users[userKey];
  if (!creds) throw new Error(`Unknown IMAP test user "${userKey}" (use one of: ${Object.keys(IMAP_TEST.users).join(', ')})`);
  return creds;
}

/** Run fn(client) with a logged-in ImapFlow client for a test user; always logs out. */
async function withTestImap(userKey, fn) {
  const { ImapFlow } = require('imapflow');
  const creds = testUser(userKey);
  const client = new ImapFlow({
    host: IMAP_TEST.host,
    port: IMAP_TEST.port,
    secure: false,
    doSTARTTLS: false,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
    emitLogs: false,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  });
  client.on('error', () => {}); // errors surface through the awaited calls below
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

/** Delete every message in INBOX, Archive and Trash of a test user. */
async function resetMailbox(userKey) {
  await withTestImap(userKey, async (client) => {
    for (const box of ['INBOX', 'Archive', 'Trash']) {
      let lock;
      try {
        lock = await client.getMailboxLock(box);
      } catch (_) {
        continue; // mailbox does not exist on this server
      }
      try {
        if (client.mailbox && client.mailbox.exists > 0) {
          await client.messageDelete('1:*');
        }
      } finally {
        lock.release();
      }
    }
  });
}

// --- tiny RFC 5322 / MIME builder (tests only) ---------------------------------------------------

function encodeHeaderWord(value) {
  const s = String(value);
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function formatAddress(addr) {
  if (!addr) return '';
  if (Array.isArray(addr)) return addr.map(formatAddress).filter(Boolean).join(', ');
  if (typeof addr === 'string') return addr;
  const { name, address } = addr;
  if (!name) return address;
  const quoted = /^[\x20-\x7e]*$/.test(name) ? `"${String(name).replace(/(["\\])/g, '\\$1')}"` : encodeHeaderWord(name);
  return `${quoted} <${address}>`;
}

function base64Lines(buf) {
  return Buffer.from(buf).toString('base64').replace(/.{1,76}/g, '$&\r\n');
}

function leafPart(contentType, content, extraHeaders = []) {
  return [`Content-Type: ${contentType}`, 'Content-Transfer-Encoding: base64', ...extraHeaders, '', base64Lines(content)].join('\r\n');
}

function multipart(subtype, parts) {
  const boundary = `----=_mt_${nodeCrypto.randomBytes(12).toString('hex')}`;
  const body = parts.map((p) => `--${boundary}\r\n${p}`).join('\r\n') + `\r\n--${boundary}--\r\n`;
  return `Content-Type: multipart/${subtype}; boundary="${boundary}"\r\n\r\n${body}`;
}

function attachmentPart(att) {
  const filename = att.filename || 'attachment.bin';
  const contentType = att.contentType || 'application/octet-stream';
  const content = Buffer.isBuffer(att.content) ? att.content : Buffer.from(String(att.content ?? ''), 'utf8');
  const inline = att.inline ?? !!att.cid;
  const encodedName = encodeHeaderWord(filename).replace(/"/g, '');
  const headers = [`Content-Disposition: ${inline ? 'inline' : 'attachment'}; filename="${encodedName}"`];
  if (att.cid) headers.push(`Content-ID: <${att.cid}>`);
  return leafPart(`${contentType}; name="${encodedName}"`, content, headers);
}

/**
 * Build a raw RFC 822 message (Buffer). Options:
 *   { from, to, cc, subject, text, html, date, messageId, headers: {X-Foo: 'bar'},
 *     attachments: [{ filename, contentType, content: Buffer|string, cid?, inline? }] }
 * Addresses may be 'Name <a@b>' strings, { name, address } objects, or arrays of either.
 */
function buildRawMessage({
  from = { name: 'Test Sender', address: 'sender@example.com' },
  to = 'bob@test.local',
  cc,
  subject = 'Test message',
  text,
  html,
  date = new Date(),
  messageId,
  headers = {},
  attachments = [],
} = {}) {
  const when = date instanceof Date ? date : new Date(date);
  const head = [
    `From: ${formatAddress(from)}`,
    `To: ${formatAddress(to)}`,
    ...(cc ? [`Cc: ${formatAddress(cc)}`] : []),
    `Subject: ${encodeHeaderWord(subject)}`,
    `Date: ${when.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${messageId || `<${nodeCrypto.randomBytes(8).toString('hex')}@mailtabs.test>`}`,
    'MIME-Version: 1.0',
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
  ];

  if (text === undefined && html === undefined) text = '';
  const inlineAtts = attachments.filter((a) => a.cid);
  const fileAtts = attachments.filter((a) => !a.cid);

  const textPart = text !== undefined ? leafPart('text/plain; charset=utf-8', Buffer.from(text, 'utf8')) : null;
  let htmlPart = html !== undefined ? leafPart('text/html; charset=utf-8', Buffer.from(html, 'utf8')) : null;
  if (htmlPart && inlineAtts.length) htmlPart = multipart('related', [htmlPart, ...inlineAtts.map(attachmentPart)]);

  let bodyPart = textPart && htmlPart ? multipart('alternative', [textPart, htmlPart]) : textPart || htmlPart;
  const extra = [...fileAtts, ...(htmlPart ? [] : inlineAtts)].map(attachmentPart);
  if (extra.length) bodyPart = multipart('mixed', [bodyPart, ...extra]);

  return Buffer.from(`${head.join('\r\n')}\r\n${bodyPart}`, 'utf8');
}

/**
 * APPEND a message to a test user's mailbox (INBOX by default). Returns the new UID.
 * Accepts buildRawMessage options plus { flags: ['\\Seen'], mailbox: 'INBOX' }.
 */
async function appendMessage(userKey, options = {}) {
  const { flags = [], mailbox = 'INBOX', ...messageOptions } = options;
  const raw = buildRawMessage(messageOptions);
  const date = messageOptions.date ? new Date(messageOptions.date) : undefined;
  return withTestImap(userKey, async (client) => {
    const result = await client.append(mailbox, raw, flags, date);
    if (!result || !result.uid) throw new Error(`APPEND to ${mailbox} did not return a UID`);
    return result.uid;
  });
}

module.exports = {
  startTestServer,
  makeClient,
  signupUser,
  StubSyncManager,
  TEST_SECRET_KEY,
  DEFAULT_TEST_PASSWORD,
  IMAP_TEST,
  imapAvailable,
  withTestImap,
  resetMailbox,
  buildRawMessage,
  appendMessage,
};

// ---------------------------------------------------------------------------------------------
// ROUTES additions: direct DB seeding and a cross-process lock per IMAP test user
// ---------------------------------------------------------------------------------------------

let seedSeq = 0;

/**
 * Insert an account row directly (no IMAP login check). Returns the row.
 * Defaults to a password account for bob on the local Dovecot.
 */
function seedAccount(db, crypto, userId, overrides = {}) {
  seedSeq += 1;
  const { password = IMAP_TEST.users.bob.pass, secret, ...rest } = overrides;
  const row = {
    user_id: userId,
    provider: 'imap',
    auth_type: 'password',
    email: `seed${seedSeq}-${nodeCrypto.randomBytes(3).toString('hex')}@example.com`,
    display_name: null,
    color: '#4f46e5',
    imap_host: IMAP_TEST.host,
    imap_port: IMAP_TEST.port,
    imap_security: IMAP_TEST.security,
    imap_user: IMAP_TEST.users.bob.user,
    secret_enc: crypto.encryptJson(secret || { password }),
    mailbox: 'INBOX',
    sync_state: null,
    status: 'ok',
    created_at: Date.now() + seedSeq, // strictly increasing so ORDER BY created_at is stable
    ...rest,
  };
  const cols = Object.keys(row);
  const info = db.prepare(`INSERT INTO accounts (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`).run(row);
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(Number(info.lastInsertRowid));
}

/**
 * The folder row of an account for a mailbox path, created when missing (INBOX gets
 * special_use '\\Inbox'; others get `specialUse` when given). Returns the row.
 */
function seedFolder(db, accountId, path = 'INBOX', { specialUse = null, delimiter = '/', ...rest } = {}) {
  const folders = require('../src/folders');
  if (path.toUpperCase() === 'INBOX') return folders.inboxFolder(db, accountId);
  const existing = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(accountId, path);
  if (existing) return existing;
  const segments = delimiter ? path.split(delimiter) : [path];
  const row = {
    account_id: accountId,
    path,
    name: segments[segments.length - 1],
    delimiter,
    parent_path: segments.length > 1 ? segments.slice(0, -1).join(delimiter) : null,
    special_use: specialUse,
    selectable: 1,
    sync_mode: 'auto',
    created_at: Date.now(),
    ...rest,
  };
  const cols = Object.keys(row);
  const info = db.prepare(`INSERT INTO folders (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`).run(row);
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(Number(info.lastInsertRowid));
}

/**
 * Insert a message row directly. `to`/`cc` may be [{name, address}] arrays. Returns the row.
 * The row gets the folder of its mailbox (created when missing) unless folder_id is given.
 */
function seedMessage(db, accountId, overrides = {}) {
  seedSeq += 1;
  const { to = [], cc = [], replyTo = [], attachments = null, ...rest } = overrides;
  if (!('folder_id' in rest)) rest.folder_id = seedFolder(db, accountId, rest.mailbox || 'INBOX').id;
  const row = {
    account_id: accountId,
    mailbox: 'INBOX',
    uid: seedSeq,
    uid_validity: 1,
    message_id: `<seed-${seedSeq}@mailtabs.test>`,
    from_name: 'Seed Sender',
    from_address: 'sender@example.com',
    to_json: JSON.stringify(to),
    cc_json: JSON.stringify(cc),
    reply_to_json: JSON.stringify(replyTo),
    subject: `Seeded message ${seedSeq}`,
    snippet: 'Seeded snippet',
    date: Date.now(),
    is_read: 0,
    is_starred: 0,
    has_attachments: attachments && attachments.some((a) => !a.inline) ? 1 : 0,
    size: 1000,
    body_state: 'ready',
    text_body: 'Seeded body',
    html_body: null,
    attachments_json: attachments ? JSON.stringify(attachments) : '[]',
    remote_image_count: 0,
    created_at: Date.now(),
    ...rest,
  };
  const cols = Object.keys(row);
  const info = db.prepare(`INSERT INTO messages (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`).run(row);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(info.lastInsertRowid));
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Cross-process lock for one IMAP test user's mailbox, so test files that reset/append to it
 * never run at the same time (node --test runs files in parallel by default).
 * Resolves to a release() function. Stale locks of dead processes are taken over.
 */
async function lockTestImapUser(userKey, { timeoutMs = 180000 } = {}) {
  testUser(userKey);
  const dir = path.join(os.tmpdir(), `mailtabs-${userKey}-imap.lock`);
  const pidFile = path.join(dir, 'pid');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.mkdirSync(dir); // atomic
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
      let stale = pid ? !pidAlive(pid) : false;
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
      if (Date.now() > deadline) throw new Error(`Timed out waiting for the ${userKey} IMAP test lock`);
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

/** { uid -> Set(flags) } of a test user's mailbox (INBOX by default). */
async function mailboxFlags(userKey, mailbox = 'INBOX') {
  return withTestImap(userKey, async (client) => {
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

module.exports.seedAccount = seedAccount;
module.exports.seedMessage = seedMessage;
module.exports.seedFolder = seedFolder;
module.exports.lockTestImapUser = lockTestImapUser;
module.exports.mailboxFlags = mailboxFlags;

// ---------------------------------------------------------------------------------------------
// ROUTES v2 additions: whole-mailbox reset, an in-process SMTP server, small waiting helpers
// ---------------------------------------------------------------------------------------------

const DOVECOT_SPECIAL_FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Archive', 'Junk', 'Trash'];

/** Empty every special folder of a test user and delete every other folder it has. */
async function resetAllFolders(userKey) {
  await withTestImap(userKey, async (client) => {
    const boxes = await client.list();
    // Deepest first, so a parent is never deleted before its children.
    const custom = boxes
      .filter((box) => !DOVECOT_SPECIAL_FOLDERS.includes(box.path))
      .sort((a, b) => b.path.split(boxDelimiter(b)).length - a.path.split(boxDelimiter(a)).length);
    for (const box of custom) await client.mailboxDelete(box.path).catch(() => {});
    for (const box of DOVECOT_SPECIAL_FOLDERS) {
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

function boxDelimiter(box) {
  return box.delimiter || '/';
}

/** [{ uid, flags, envelope, source }] of a test user's mailbox. */
async function mailboxMessages(userKey, mailbox = 'INBOX') {
  return withTestImap(userKey, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const out = [];
      if (!client.mailbox.exists) return out;
      for await (const msg of client.fetch('1:*', { uid: true, flags: true, envelope: true, source: true })) {
        out.push({ uid: msg.uid, flags: msg.flags, envelope: msg.envelope, source: msg.source });
      }
      return out;
    } finally {
      lock.release();
    }
  });
}

/**
 * An SMTP server on 127.0.0.1 (random port, no TLS, AUTH PLAIN/LOGIN required) that records
 * every message. With `deliverToDovecot`, a message for a known test user (IMAP_TEST.users) is
 * APPENDed to that user's INBOX before the server answers, like a real delivery.
 * @param {{ users?: {[username]: password}, deliverToDovecot?: boolean, rejectRecipients?: string[] }} opts
 * @returns {Promise<{ port, messages: Array<{ from, to, raw, user }>, close() }>}
 */
async function startSmtpCapture({ users = {}, deliverToDovecot = false, rejectRecipients = [] } = {}) {
  const { SMTPServer } = require('smtp-server');
  const messages = [];
  const byAddress = new Map(Object.entries(IMAP_TEST.users).map(([key, c]) => [c.user.toLowerCase(), key]));
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    authMethods: ['PLAIN', 'LOGIN'],
    logger: false,
    onAuth(auth, session, cb) {
      if (Object.prototype.hasOwnProperty.call(users, auth.username) && users[auth.username] === auth.password) {
        return cb(null, { user: auth.username });
      }
      const err = new Error('5.7.8 Authentication credentials invalid');
      err.responseCode = 535;
      return cb(err);
    },
    onRcptTo(address, session, cb) {
      if (rejectRecipients.includes(address.address)) {
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
        const raw = Buffer.concat(chunks);
        const to = session.envelope.rcptTo.map((r) => r.address);
        messages.push({ from: session.envelope.mailFrom.address, to, raw, user: session.user });
        if (deliverToDovecot) {
          for (const address of to) {
            const key = byAddress.get(String(address).toLowerCase());
            if (!key) continue;
            try {
              await withTestImap(key, (client) => client.append('INBOX', raw, []));
            } catch (err) {
              console.error(`test SMTP: delivery to ${address} failed:`, err && err.message);
            }
          }
        }
        cb(null, 'Queued as test');
      });
    },
  });
  server.on('error', () => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.server.address().port,
    messages,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Poll fn() until it returns something truthy (or throw after timeoutMs). */
async function waitUntil(fn, { timeoutMs = 15000, intervalMs = 100, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

module.exports.resetAllFolders = resetAllFolders;
module.exports.mailboxMessages = mailboxMessages;
module.exports.startSmtpCapture = startSmtpCapture;
module.exports.waitUntil = waitUntil;
