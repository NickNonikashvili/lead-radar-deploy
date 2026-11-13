'use strict';

/**
 * FOLDERS engine — SyncManager over every folder, against the real Dovecot test server.
 * Uses ONLY f1@test.local (reset before every test). Skipped when Dovecot is not reachable.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const imap = require('../src/imap');
const { SyncManager } = require('../src/sync');
const h = require('./engine-helpers');
const fh = require('./folders-helpers');

const USER = 'f1';
let available = false;
let releaseLock = () => {};

test.before(async () => {
  available = await fh.dovecotAvailable();
  if (!available) return;
  releaseLock = await fh.lockUser(USER);
  await fh.resetUser(USER);
});

test.after(async () => {
  try {
    if (available) await fh.resetUser(USER);
  } finally {
    releaseLock();
  }
});

function imapTest(name, envOverrides, fn) {
  if (typeof envOverrides === 'function') {
    fn = envOverrides;
    envOverrides = {};
  }
  test(name, async (t) => {
    if (!available) return t.skip('IMAP test server (127.0.0.1:1143) not reachable');
    await fh.resetUser(USER);
    const env = h.makeEngineEnv(envOverrides);
    const logger = h.recordingLogger();
    const manager = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger });
    const userId = h.createUser(env.db);
    const account = h.createAccount(env.db, env.crypto, userId, fh.accountFor(USER));
    const rows = (path) => fh.rowsIn(env.db, account.id, path);
    const folder = (path) => fh.folderRow(env.db, account.id, path);
    try {
      await fn(t, { ...env, manager, logger, userId, account, rows, folder });
    } finally {
      await manager.stop();
      env.close();
    }
  });
}

/** Let a test look at / instrument every client the engine connects with. */
function onClient(t, hook) {
  const original = imap.withImap;
  imap.withImap = (deps, account, fn, limits) =>
    original(deps, account, async (client) => {
      await hook(client, account);
      return fn(client);
    }, limits);
  t.after(() => {
    imap.withImap = original;
  });
}

/** Record which folders each run opens. Returns an array of arrays (one per connection). */
function recordOpened(t) {
  const runs = [];
  onClient(t, (client) => {
    const opened = [];
    runs.push(opened);
    const realLock = client.getMailboxLock.bind(client);
    client.getMailboxLock = (path, opts) => {
      opened.push(path);
      return realLock(path, opts);
    };
  });
  return runs;
}

async function serverChange(mailbox, fn) {
  await fh.withUser(USER, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      await fn(client);
    } finally {
      lock.release();
    }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { timeoutMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await sleep(50);
  }
}

// ---------------------------------------------------------------------------------------------

imapTest('an account sync lists every folder, syncs them, then opens only the ones that changed', async (t, ctx) => {
  await fh.appendMany(USER, 'INBOX', [{ subject: 'in-1' }, { subject: 'in-2', flags: ['\\Seen'] }]);
  const sentUid = await fh.append(USER, 'Sent', { subject: 'sent-1', flags: ['\\Seen'] });
  await fh.append(USER, 'Archive', { subject: 'arch-1' });
  await fh.withUser(USER, (client) => client.mailboxCreate('Work/Clients'));
  await fh.append(USER, 'Work/Clients', { subject: 'client-1' });
  const opened = recordOpened(t);

  const first = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(first.ok, true, first.error);
  assert.equal(first.newMessages, 5);
  assert.deepEqual(first.folders.map((f) => f.path), ['INBOX', 'Sent', 'Drafts', 'Archive', 'Junk', 'Trash', 'Work/Clients']);
  assert.deepEqual(opened[0], ['INBOX', 'Sent', 'Drafts', 'Archive', 'Junk', 'Trash', 'Work/Clients'], 'INBOX, Sent, Drafts first; never the container');

  const all = ctx.db.prepare('SELECT * FROM folders WHERE account_id = ? ORDER BY path').all(ctx.account.id);
  assert.deepEqual(all.map((f) => [f.path, f.special_use, f.selectable]), [
    ['Archive', '\\Archive', 1],
    ['Drafts', '\\Drafts', 1],
    ['INBOX', '\\Inbox', 1],
    ['Junk', '\\Junk', 1],
    ['Sent', '\\Sent', 1],
    ['Trash', '\\Trash', 1],
    ['Work', null, 0],
    ['Work/Clients', null, 1],
  ]);
  const inbox = ctx.folder('INBOX');
  assert.deepEqual([inbox.total_count, inbox.unread_count], [2, 1], 'STATUS counts');
  assert.ok(inbox.last_synced_at > 0);
  assert.ok(ctx.db.prepare('SELECT folders_synced_at FROM accounts WHERE id = ?').get(ctx.account.id).folders_synced_at > 0);
  const acc = h.getAccount(ctx.db, ctx.account.id);
  assert.equal(acc.status, 'ok');
  assert.equal(acc.sync_state, null, 'the legacy account column is not used any more');

  for (const [path, subjects] of [['INBOX', ['in-1', 'in-2']], ['Sent', ['sent-1']], ['Archive', ['arch-1']], ['Work/Clients', ['client-1']]]) {
    const rows = ctx.rows(path);
    assert.deepEqual(rows.map((r) => r.subject), subjects, path);
    assert.ok(rows.every((r) => r.mailbox === path && r.folder_id === ctx.folder(path).id));
  }
  const state = fh.folderState(ctx.db, ctx.account.id, 'Sent');
  assert.equal(state.uidValidity, await fh.uidValidityOf(USER, 'Sent'));
  assert.deepEqual([state.lastUid, state.uidNext, state.messages, state.oldestUid], [sentUid, sentUid + 1, 1, sentUid]);
  assert.match(String(state.highestModseq), /^\d+$/);

  // Nothing changed: only INBOX is opened.
  const idle = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(idle.ok, true);
  assert.deepEqual(opened[1], ['INBOX']);
  assert.equal(idle.flagRefresh, 'condstore');

  // New mail in Archive, a star in Sent, an expunge in Work/Clients — each from another app.
  await fh.append(USER, 'Archive', { subject: 'arch-2' });
  await serverChange('Sent', (c) => c.messageFlagsAdd('1:*', ['\\Flagged']));
  await serverChange('Work/Clients', (c) => c.messageDelete('1:*'));
  const changed = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(changed.ok, true);
  assert.deepEqual(opened[2], ['INBOX', 'Sent', 'Archive', 'Work/Clients']);
  assert.equal(changed.newMessages, 1);
  assert.equal(changed.updated, 1);
  assert.equal(changed.removed, 1);
  assert.deepEqual(ctx.rows('Archive').map((r) => r.subject), ['arch-1', 'arch-2']);
  assert.equal(ctx.rows('Sent')[0].is_starred, 1);
  assert.equal(ctx.rows('Work/Clients').length, 0);

  assert.deepEqual((await ctx.manager.syncAccount(ctx.account.id)).folders.map((f) => f.path), ['INBOX']);
});

imapTest('first sync windows (INBOX: INITIAL_SYNC_LIMIT, others: 50), has_older and backfillFolder', { INITIAL_SYNC_LIMIT: '3' }, async (t, ctx) => {
  const base = Date.now() - 1000 * 3600;
  const inboxUids = await fh.appendMany(USER, 'INBOX', Array.from({ length: 5 }, (_, i) => ({ subject: `in-${i}`, date: base + i * 1000 })));
  const archUids = await fh.appendMany(USER, 'Archive', Array.from({ length: 56 }, (_, i) => ({ subject: `arch-${i}`, date: base + i * 1000 })));

  const result = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(ctx.rows('INBOX').map((r) => r.uid), inboxUids.slice(-3));
  assert.deepEqual(ctx.rows('Archive').map((r) => r.uid), archUids.slice(-50));
  const archive = ctx.folder('Archive');
  assert.equal(archive.has_older, 1);
  assert.equal(ctx.folder('INBOX').has_older, 1);
  assert.equal(fh.folderState(ctx.db, ctx.account.id, 'Archive').oldestUid, archUids[6]);
  assert.equal(ctx.folder('Sent').has_older, 0);

  // Newest of the older ones first.
  assert.deepEqual(await ctx.manager.backfillFolder(archive.id, { count: 4 }), { added: 4, hasOlder: true });
  assert.deepEqual(ctx.rows('Archive').map((r) => r.uid), archUids.slice(2));
  assert.equal(fh.folderState(ctx.db, ctx.account.id, 'Archive').oldestUid, archUids[2]);
  assert.deepEqual(await ctx.manager.backfillFolder(archive.id), { added: 2, hasOlder: false });
  assert.equal(ctx.rows('Archive').length, 56);
  assert.equal(ctx.folder('Archive').has_older, 0);
  assert.deepEqual(await ctx.manager.backfillFolder(archive.id), { added: 0, hasOlder: false });
  assert.deepEqual(await ctx.manager.backfillFolder(ctx.folder('INBOX').id, { count: 10 }), { added: 2, hasOlder: false });
  assert.ok(ctx.rows('Archive').every((r) => r.folder_id === archive.id && r.body_state === 'ready'));

  // Later syncs keep backfilled mail and refresh its flags.
  await serverChange('Archive', (c) => c.messageFlagsAdd(String(archUids[0]), ['\\Seen'], { uid: true }));
  const again = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(again.ok, true);
  assert.equal(ctx.rows('Archive').length, 56);
  assert.equal(ctx.rows('Archive')[0].is_read, 1);

  await assert.rejects(ctx.manager.backfillFolder(999999), (err) => err.status === 404);
  // Unreachable server: a friendly 502.
  ctx.db.prepare('UPDATE accounts SET imap_port = 1 WHERE id = ?').run(ctx.account.id);
  await assert.rejects(ctx.manager.backfillFolder(archive.id), (err) => err.status === 502 && err.code === 'IMAP_ERROR' && /refused/.test(err.message));
});

imapTest('backfillFolder on a folder that was never synced does a first sync', async (t, ctx) => {
  await fh.appendMany(USER, 'Junk', Array.from({ length: 3 }, (_, i) => ({ subject: `junk-${i}` })));
  await ctx.manager.syncAccount(ctx.account.id);
  const junk = ctx.folder('Junk');
  ctx.db.prepare('DELETE FROM messages WHERE folder_id = ?').run(junk.id);
  ctx.db.prepare('UPDATE folders SET sync_state = NULL WHERE id = ?').run(junk.id);
  assert.deepEqual(await ctx.manager.backfillFolder(junk.id), { added: 3, hasOlder: false });
});

imapTest('syncFolder runs one folder now, waits for a running account sync, and is deduplicated', async (t, ctx) => {
  await fh.append(USER, 'Junk', { subject: 'junk-1' });
  await ctx.manager.syncAccount(ctx.account.id);
  const junk = ctx.folder('Junk');
  assert.equal(junk.last_opened_at, null);

  let active = 0;
  let maxActive = 0;
  const kinds = [];
  const realWithImap = imap.withImap;
  imap.withImap = async (deps, account, fn, limits) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    try {
      return await realWithImap(deps, account, async (client) => {
        const list = client.list.bind(client);
        client.list = (opts) => {
          kinds.push('account');
          return list(opts);
        };
        const status = client.status.bind(client);
        client.status = (...args) => {
          kinds.push('folder');
          return status(...args);
        };
        return fn(client);
      }, limits);
    } finally {
      active -= 1;
    }
  };
  t.after(() => {
    imap.withImap = realWithImap;
  });

  await fh.append(USER, 'Junk', { subject: 'junk-2' });
  const p1 = ctx.manager.syncAccount(ctx.account.id);
  const p2 = ctx.manager.syncFolder(junk.id);
  assert.equal(ctx.manager.syncFolder(junk.id), p2, 'same folder: one run');
  assert.notEqual(p1, p2);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true, r2.error);
  assert.equal(r2.folderId, junk.id);
  assert.deepEqual(r2.folders.map((f) => f.path), ['Junk']);
  assert.equal(maxActive, 1, 'never two connections for one account');
  assert.deepEqual(kinds, ['account', 'folder'], 'the folder run waited for the account run');
  assert.equal(ctx.rows('Junk').length, 2);
  assert.ok(ctx.folder('Junk').last_opened_at > Date.now() - 60000);

  // An account sync asked for during a folder run is queued after it, not merged into it.
  await fh.append(USER, 'INBOX', { subject: 'in-later' });
  kinds.length = 0;
  const f = ctx.manager.syncFolder(junk.id, { markOpened: false });
  const a = ctx.manager.syncAccount(ctx.account.id);
  assert.notEqual(a, f);
  assert.equal(ctx.manager.syncAccount(ctx.account.id), a, 'later account calls join the queued run');
  await Promise.all([a, f]);
  assert.deepEqual(kinds, ['folder', 'account']);
  assert.deepEqual(ctx.rows('INBOX').map((r) => r.subject), ['in-later']);
  assert.equal(ctx.manager.isSyncing(ctx.account.id), false);

  const missing = await ctx.manager.syncFolder(987654);
  assert.equal(missing.ok, false);
  assert.equal(missing.error, 'Folder not found');
});

imapTest('a folder run leaves the account status alone, except for a login failure', async (t, ctx) => {
  await ctx.manager.syncAccount(ctx.account.id);
  const sent = ctx.folder('Sent');
  let statusDuringRun = null;
  onClient(t, () => {
    statusDuringRun = h.getAccount(ctx.db, ctx.account.id).status;
  });
  assert.equal((await ctx.manager.syncFolder(sent.id)).ok, true);
  assert.equal(statusDuringRun, 'ok', 'not "syncing"');
  assert.equal(h.getAccount(ctx.db, ctx.account.id).status, 'ok');

  ctx.db.prepare('UPDATE accounts SET imap_port = 1 WHERE id = ?').run(ctx.account.id);
  const down = await ctx.manager.syncFolder(sent.id);
  assert.equal(down.ok, false);
  assert.match(down.error, /refused the connection/);
  assert.equal(h.getAccount(ctx.db, ctx.account.id).status, 'ok', 'a connection problem of one folder run is not recorded');

  ctx.db.prepare('UPDATE accounts SET imap_port = 1143, secret_enc = ? WHERE id = ?').run(ctx.crypto.encryptJson({ password: 'wrong' }), ctx.account.id);
  const denied = await ctx.manager.syncFolder(sent.id);
  assert.equal(denied.ok, false);
  const acc = h.getAccount(ctx.db, ctx.account.id);
  assert.equal(acc.status, 'auth_error');
  assert.match(acc.last_error, /Wrong email or password/);
});

imapTest('on-demand folders (\\All and friends) are synced only while recently opened', async (t, ctx) => {
  await fh.withUser(USER, (client) => client.mailboxCreate('Everything'));
  await fh.appendMany(USER, 'Everything', [{ subject: 'e-1' }, { subject: 'e-2' }]);
  // Dovecot has no virtual All Mail folder: present "Everything" as one.
  onClient(t, (client) => {
    const list = client.list.bind(client);
    client.list = async (opts) => {
      const entries = await list(opts);
      for (const e of entries) {
        if (e.path === 'Everything') {
          e.flags.add('\\All');
          e.specialUse = '\\All';
          e.specialUseSource = 'extension';
        }
      }
      return entries;
    };
  });

  const first = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(first.ok, true);
  const everything = ctx.folder('Everything');
  assert.deepEqual([everything.special_use, everything.sync_mode], ['\\All', 'on_demand']);
  assert.equal(ctx.rows('Everything').length, 0, 'not synced until opened');
  assert.equal(everything.total_count, 2, 'counts still come from STATUS');

  const opened = await ctx.manager.syncFolder(everything.id);
  assert.equal(opened.ok, true);
  assert.equal(ctx.rows('Everything').length, 2);

  await fh.append(USER, 'Everything', { subject: 'e-3' });
  await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(ctx.rows('Everything').length, 3, 'opened recently: kept up to date');

  ctx.db.prepare('UPDATE folders SET last_opened_at = ? WHERE id = ?').run(Date.now() - 31 * 60 * 1000, everything.id);
  await fh.append(USER, 'Everything', { subject: 'e-4' });
  const later = await ctx.manager.syncAccount(ctx.account.id);
  assert.deepEqual(later.folders.map((f) => f.path), ['INBOX']);
  assert.equal(ctx.rows('Everything').length, 3);
});

imapTest('folders deleted or renamed in another app disappear locally with their messages', async (t, ctx) => {
  await fh.withUser(USER, async (client) => {
    await client.mailboxCreate('Temp');
    await client.mailboxCreate('Old');
  });
  await fh.append(USER, 'Temp', { subject: 'temp-1' });
  await fh.append(USER, 'Old', { subject: 'old-1' });
  await ctx.manager.syncAccount(ctx.account.id);
  const temp = ctx.folder('Temp');
  assert.equal(ctx.rows('Temp').length, 1);
  assert.equal(ctx.rows('Old').length, 1);

  await fh.withUser(USER, async (client) => {
    await client.mailboxDelete('Temp');
    await client.mailboxRename('Old', 'New');
  });
  const result = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(result.ok, true);
  assert.equal(result.foldersRemoved, 2);
  assert.equal(ctx.folder('Temp'), undefined);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE folder_id = ?').get(temp.id).n, 0);
  assert.equal(ctx.folder('Old'), undefined);
  assert.deepEqual(ctx.rows('New').map((r) => [r.subject, r.mailbox]), [['old-1', 'New']]);
});

imapTest('conversations: thread_key, in_reply_to, references, \\Draft and \\Answered (deferred bodies too)', { MAX_BODY_BYTES: '10000' }, async (t, ctx) => {
  const [rootUid] = await fh.appendMany(USER, 'INBOX', [
    { subject: 'Plan', messageId: '<root@t>', flags: ['\\Answered', '\\Seen'] },
    { subject: 'Re: Plan', messageId: '<reply@t>', inReplyTo: '<root@t>', references: '<root@t>' },
    { subject: 'Re: Re: Plan', messageId: '<big@t>', inReplyTo: '<reply@t>', references: '<root@t> <reply@t>', text: 'x'.repeat(20000) },
    { subject: 'Lonely reply', messageId: '<lonely@t>', inReplyTo: '<elsewhere@t>' },
  ]);
  await fh.append(USER, 'Drafts', { subject: 'Re: Plan (draft)', messageId: '<draft@t>', references: '<root@t>', flags: ['\\Draft', '\\Seen'] });
  await fh.append(USER, 'Sent', { subject: 'Re: Plan', messageId: '<mine@t>', inReplyTo: '<root@t>', references: '<root@t>', flags: ['\\Seen'] });

  assert.equal((await ctx.manager.syncAccount(ctx.account.id)).ok, true);
  const bySubject = Object.fromEntries(ctx.rows('INBOX').map((r) => [r.subject, r]));
  const root = bySubject.Plan;
  assert.deepEqual([root.thread_key, root.in_reply_to, root.references_json, root.is_answered, root.is_draft], ['mid:<root@t>', null, '[]', 1, 0]);
  const reply = bySubject['Re: Plan'];
  assert.deepEqual([reply.thread_key, reply.in_reply_to, reply.references_json], ['mid:<root@t>', '<root@t>', '["<root@t>"]']);
  const big = bySubject['Re: Re: Plan'];
  assert.equal(big.body_state, 'deferred');
  assert.deepEqual([big.thread_key, big.in_reply_to, big.references_json], ['mid:<root@t>', '<reply@t>', '["<root@t>","<reply@t>"]']);
  assert.equal(bySubject['Lonely reply'].thread_key, 'mid:<elsewhere@t>');
  const [draft] = ctx.rows('Drafts');
  assert.deepEqual([draft.is_draft, draft.thread_key], [1, 'mid:<root@t>']);
  assert.equal(ctx.rows('Sent')[0].thread_key, 'mid:<root@t>', 'my reply in Sent is in the same conversation');

  await serverChange('INBOX', (c) => c.messageFlagsRemove(String(rootUid), ['\\Answered'], { uid: true }));
  const refreshed = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(refreshed.updated, 1);
  assert.equal(ctx.rows('INBOX').find((r) => r.uid === rootUid).is_answered, 0);
});

imapTest('a UIDVALIDITY change of one folder resets only that folder', async (t, ctx) => {
  await fh.append(USER, 'INBOX', { subject: 'stays' });
  await fh.appendMany(USER, 'Archive', [{ subject: 'a-1' }, { subject: 'a-2' }]);
  await ctx.manager.syncAccount(ctx.account.id);
  const inboxIds = ctx.rows('INBOX').map((r) => r.id);
  const archive = ctx.folder('Archive');
  ctx.db.prepare('UPDATE messages SET uid_validity = 1 WHERE folder_id = ?').run(archive.id);
  ctx.db.prepare('UPDATE folders SET sync_state = ? WHERE id = ?').run(JSON.stringify({ uidValidity: 1, lastUid: 2, uidNext: 3, messages: 2 }), archive.id);

  const result = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(result.ok, true);
  const arch = result.folders.find((f) => f.path === 'Archive');
  assert.deepEqual([arch.removed, arch.newMessages], [2, 2]);
  assert.deepEqual(ctx.rows('INBOX').map((r) => r.id), inboxIds);
  const real = await fh.uidValidityOf(USER, 'Archive');
  assert.ok(ctx.rows('Archive').every((r) => r.uid_validity === real));
});

imapTest('a folder the server refuses to open is skipped; an INBOX refusal fails the run', async (t, ctx) => {
  await fh.append(USER, 'INBOX', { subject: 'in' });
  await fh.append(USER, 'Archive', { subject: 'arch' });
  await fh.append(USER, 'Sent', { subject: 'sent' });
  let refuse = 'Archive';
  onClient(t, (client) => {
    const realLock = client.getMailboxLock.bind(client);
    client.getMailboxLock = (path, opts) => {
      if (path === refuse) {
        return Promise.reject(Object.assign(new Error('Command failed'), { responseStatus: 'NO', responseText: 'Mailbox is locked by another process' }));
      }
      return realLock(path, opts);
    };
  });
  const result = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.folderErrors.map((e) => e.path), ['Archive']);
  assert.match(result.folderErrors[0].error, /locked by another process/);
  assert.equal(ctx.rows('Sent').length, 1, 'the other folders still sync');
  assert.equal(ctx.rows('Archive').length, 0);
  assert.equal(h.getAccount(ctx.db, ctx.account.id).status, 'ok');
  assert.ok(ctx.logger.lines.some((l) => l.level === 'warn' && /skipped folder "Archive"/.test(l.text)));

  refuse = null;
  await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(ctx.rows('Archive').length, 1, 'tried again next time');

  refuse = 'INBOX';
  const failed = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /locked by another process/);
  assert.equal(h.getAccount(ctx.db, ctx.account.id).status, 'error');
});

imapTest('a run stops starting folders at ~70% of its deadline and the rest follows right after', async (t, ctx) => {
  await fh.append(USER, 'Sent', { subject: 'sent' });
  await fh.append(USER, 'Archive', { subject: 'arch' });
  ctx.manager.syncDeadlineMs = 2000;
  let slow = true;
  onClient(t, (client) => {
    const realLock = client.getMailboxLock.bind(client);
    client.getMailboxLock = async (path, opts) => {
      if (path === 'INBOX' && slow) {
        slow = false;
        await sleep(1500);
      }
      return realLock(path, opts);
    };
  });
  const first = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(first.ok, true, first.error);
  assert.equal(first.more, true);
  assert.deepEqual(first.folders.map((f) => f.path), ['INBOX']);
  await waitFor(() => ctx.rows('Sent').length === 1 && ctx.rows('Archive').length === 1 && !ctx.manager.isSyncing(ctx.account.id));
});

imapTest('a folder removed locally mid-sync is skipped without writing into it', async (t, ctx) => {
  await fh.appendMany(USER, 'Archive', [{ subject: 'a-1' }, { subject: 'a-2' }]);
  let removeOnce = true;
  onClient(t, (client) => {
    const realLock = client.getMailboxLock.bind(client);
    client.getMailboxLock = (path, opts) => {
      if (path === 'Archive' && removeOnce) {
        removeOnce = false;
        // What a folder delete in the UI does while this sync runs.
        ctx.db.prepare("DELETE FROM folders WHERE account_id = ? AND path = 'Archive'").run(ctx.account.id);
      }
      return realLock(path, opts);
    };
  });
  const result = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(result.ok, true, result.error);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS n FROM messages WHERE account_id = ? AND mailbox = 'Archive'").get(ctx.account.id).n, 0);
  // Still on the server: the next listing brings it back.
  await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(ctx.rows('Archive').length, 2);
});

imapTest('a server that refuses LIST still gets its INBOX synced', async (t, ctx) => {
  await fh.append(USER, 'INBOX', { subject: 'in' });
  await fh.append(USER, 'Sent', { subject: 'sent' });
  onClient(t, (client) => {
    client.list = () => Promise.reject(Object.assign(new Error('Command failed'), { responseStatus: 'BAD', responseText: 'LIST not allowed' }));
  });
  const result = await ctx.manager.syncAccount(ctx.account.id);
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.folders.map((f) => f.path), ['INBOX']);
  assert.deepEqual(ctx.db.prepare('SELECT path FROM folders WHERE account_id = ?').all(ctx.account.id).map((r) => r.path), ['INBOX']);
  assert.deepEqual(ctx.rows('INBOX').map((r) => r.subject), ['in']);
  assert.ok(ctx.logger.lines.some((l) => /refused to list folders/.test(l.text)));
});
