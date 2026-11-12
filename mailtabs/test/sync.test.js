'use strict';

/**
 * SyncManager tests against the real Dovecot test server (alice@test.local only).
 * Skipped when the server is not reachable.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const imap = require('../src/imap');
const { SyncManager, createLimiter, pickDate, structureHasAttachments } = require('../src/sync');
const { HttpError } = require('../src/errors');
const h = require('./engine-helpers');

let available = false;
let releaseLock = () => {};

test.before(async () => {
  available = await h.aliceAvailable();
  if (!available) return;
  releaseLock = await h.lockAlice();
  await h.resetAlice();
});

test.after(async () => {
  try {
    if (available) await h.resetAlice();
  } finally {
    releaseLock();
  }
});

/** IMAP test: skips without Dovecot, resets alice first, gives a fresh env + manager. */
function imapTest(name, envOverrides, fn) {
  if (typeof envOverrides === 'function') {
    fn = envOverrides;
    envOverrides = {};
  }
  test(name, async (t) => {
    if (!available) return t.skip('IMAP test server (127.0.0.1:1143) not reachable');
    await h.resetAlice();
    const env = h.makeEngineEnv(envOverrides);
    const logger = h.recordingLogger();
    const manager = new SyncManager({ db: env.db, crypto: env.crypto, config: env.config, logger });
    const userId = h.createUser(env.db);
    try {
      await fn(t, { ...env, manager, logger, userId });
    } finally {
      await manager.stop();
      env.close();
    }
  });
}

/** Wrap imap.withImap (sync.js calls it through the module object) for the duration of a test. */
function wrapWithImap(t, wrapper) {
  const original = imap.withImap;
  imap.withImap = (deps, account, fn) => wrapper(original, deps, account, fn);
  t.after(() => {
    imap.withImap = original;
  });
}

const ago = (ms) => new Date(Date.now() - ms);

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

test('createLimiter never runs more than N tasks at once', async () => {
  const limit = createLimiter(2);
  let active = 0;
  let max = 0;
  const task = () =>
    limit(async () => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 10));
      active -= 1;
      return 'done';
    });
  const results = await Promise.all([task(), task(), task(), task(), task()]);
  assert.deepEqual(results, ['done', 'done', 'done', 'done', 'done']);
  assert.equal(max, 2);
  await assert.rejects(limit(async () => { throw new Error('boom'); }), /boom/);
  assert.equal(limit.active, 0);
});

test('pickDate prefers a sane Date header, else internal date', () => {
  const now = Date.now();
  assert.equal(pickDate(now - 1000, now), now - 1000);
  assert.equal(pickDate(now + 3 * 24 * 3600 * 1000, now - 5), now - 5, 'far future header rejected');
  assert.equal(pickDate(NaN, now - 5), now - 5);
  assert.equal(pickDate(null, now - 5), now - 5);
  assert.ok(Math.abs(pickDate(null, null) - now) < 1000);
});

test('structureHasAttachments inspects BODYSTRUCTURE', () => {
  assert.equal(structureHasAttachments(null), false);
  assert.equal(structureHasAttachments({ type: 'text/plain' }), false);
  assert.equal(
    structureHasAttachments({ type: 'multipart/mixed', childNodes: [{ type: 'text/plain' }, { type: 'application/pdf', disposition: 'attachment' }] }),
    true
  );
  assert.equal(structureHasAttachments({ type: 'multipart/related', childNodes: [{ type: 'text/html' }, { type: 'image/png', disposition: 'inline', parameters: { name: 'a.png' } }] }), false);
  assert.equal(structureHasAttachments({ type: 'application/zip', parameters: { name: 'x.zip' } }), true);
});

// ---------------------------------------------------------------------------------------------
// Initial + incremental sync
// ---------------------------------------------------------------------------------------------

imapTest('initial sync takes the newest INITIAL_SYNC_LIMIT messages with correct fields', { INITIAL_SYNC_LIMIT: '3' }, async (t, ctx) => {
  const uids = [];
  for (let i = 1; i <= 5; i++) {
    uids.push(await h.appendAlice(h.buildMessage({ subject: `Message ${i}`, text: `Body number ${i}`, date: ago((10 - i) * 60000) })));
  }
  // Flags on two of the newest three.
  await h.withAlice(async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageFlagsAdd(String(uids[3]), ['\\Seen'], { uid: true });
      await client.messageFlagsAdd(String(uids[4]), ['\\Flagged'], { uid: true });
    } finally {
      lock.release();
    }
  });

  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  const result = await ctx.manager.syncAccount(account.id);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.accountId, account.id);
  assert.equal(result.newMessages, 3);
  assert.equal(result.removed, 0);

  const rows = h.messagesOf(ctx.db, account.id);
  assert.deepEqual(rows.map((r) => r.uid), uids.slice(2));
  assert.deepEqual(rows.map((r) => r.subject), ['Message 3', 'Message 4', 'Message 5']);
  const [m3, m4, m5] = rows;
  assert.equal(m3.is_read, 0);
  assert.equal(m4.is_read, 1);
  assert.equal(m5.is_starred, 1);
  assert.equal(m3.from_name, 'Sender');
  assert.equal(m3.from_address, 'sender@example.com');
  assert.deepEqual(JSON.parse(m3.to_json), [{ name: '', address: 'alice@test.local' }]);
  assert.equal(m3.snippet, 'Body number 3');
  assert.equal(m3.text_body, 'Body number 3');
  assert.equal(m3.body_state, 'ready');
  assert.equal(m3.mailbox, 'INBOX');
  assert.ok(m3.size > 0);
  assert.ok(m3.message_id.endsWith('@engine.test>'));
  assert.ok(Math.abs(m3.date - ago(7 * 60000).getTime()) < 5000, 'Date header used');
  assert.ok(m5.date > m4.date && m4.date > m3.date);

  const acc = h.getAccount(ctx.db, account.id);
  assert.equal(acc.status, 'ok');
  assert.equal(acc.last_error, null);
  assert.ok(acc.last_synced_at > Date.now() - 60000);
  const state = JSON.parse(acc.sync_state);
  assert.equal(typeof state.uidValidity, 'number');
  assert.equal(state.lastUid, uids[4]);
  assert.match(String(state.highestModseq), /^\d+$/, 'Dovecot has CONDSTORE');
});

imapTest('incremental sync fetches only new UIDs (and the `*` quirk does not refetch the last one)', async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'first' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  assert.equal((await ctx.manager.syncAccount(account.id)).newMessages, 1);

  // Nothing new: `lastUid+1:*` still matches the last message on the server.
  const again = await ctx.manager.syncAccount(account.id);
  assert.equal(again.ok, true);
  assert.equal(again.newMessages, 0);
  assert.equal(h.messagesOf(ctx.db, account.id).length, 1);

  await h.appendAlice(h.buildMessage({ subject: 'second' }));
  await h.appendAlice(h.buildMessage({ subject: 'third' }));
  const third = await ctx.manager.syncAccount(account.id);
  assert.equal(third.newMessages, 2);
  assert.deepEqual(h.messagesOf(ctx.db, account.id).map((r) => r.subject), ['first', 'second', 'third']);
});

imapTest('a Date header far in the future falls back to the server arrival time', async (t, ctx) => {
  const arrival = ago(3600 * 1000);
  await h.appendAlice(h.buildMessage({ subject: 'from the future', date: new Date('2099-01-01T00:00:00Z') }), { date: arrival });
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);
  const [row] = h.messagesOf(ctx.db, account.id);
  assert.ok(Math.abs(row.date - arrival.getTime()) < 2000, `${new Date(row.date).toISOString()} vs ${arrival.toISOString()}`);
});

// ---------------------------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------------------------

async function setServerFlags(changes) {
  await h.withAlice(async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for (const { uid, add = [], remove = [] } of changes) {
        if (add.length) await client.messageFlagsAdd(String(uid), add, { uid: true });
        if (remove.length) await client.messageFlagsRemove(String(uid), remove, { uid: true });
      }
    } finally {
      lock.release();
    }
  });
}

imapTest('flag changes made elsewhere are picked up via CONDSTORE', async (t, ctx) => {
  const a = await h.appendAlice(h.buildMessage({ subject: 'a' }), { flags: ['\\Seen'] });
  const b = await h.appendAlice(h.buildMessage({ subject: 'b' }));
  const c = await h.appendAlice(h.buildMessage({ subject: 'c' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);

  // No changes: the CONDSTORE path short-circuits.
  const idle = await ctx.manager.syncAccount(account.id);
  assert.equal(idle.flagRefresh, 'condstore');
  assert.equal(idle.updated, 0);

  await setServerFlags([
    { uid: a, remove: ['\\Seen'] },
    { uid: b, add: ['\\Seen', '\\Flagged'] },
  ]);
  const result = await ctx.manager.syncAccount(account.id);
  assert.equal(result.ok, true);
  assert.equal(result.flagRefresh, 'condstore');
  assert.equal(result.updated, 2);
  const byUid = Object.fromEntries(h.messagesOf(ctx.db, account.id).map((r) => [r.uid, r]));
  assert.equal(byUid[a].is_read, 0);
  assert.equal(byUid[b].is_read, 1);
  assert.equal(byUid[b].is_starred, 1);
  assert.equal(byUid[c].is_read, 0);
});

imapTest('flag refresh falls back to a FLAGS fetch over the known UID range without a stored modseq', async (t, ctx) => {
  const a = await h.appendAlice(h.buildMessage({ subject: 'a' }));
  const b = await h.appendAlice(h.buildMessage({ subject: 'b' }), { flags: ['\\Flagged'] });
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);

  // Force the non-CONDSTORE path by forgetting the stored HIGHESTMODSEQ.
  const forget = () => {
    const state = JSON.parse(h.getAccount(ctx.db, account.id).sync_state);
    state.highestModseq = null;
    ctx.db.prepare('UPDATE accounts SET sync_state = ? WHERE id = ?').run(JSON.stringify(state), account.id);
  };
  forget();
  await setServerFlags([
    { uid: a, add: ['\\Seen'] },
    { uid: b, remove: ['\\Flagged'] },
  ]);
  const result = await ctx.manager.syncAccount(account.id);
  assert.equal(result.flagRefresh, 'fallback');
  assert.equal(result.updated, 2);
  const byUid = Object.fromEntries(h.messagesOf(ctx.db, account.id).map((r) => [r.uid, r]));
  assert.equal(byUid[a].is_read, 1);
  assert.equal(byUid[b].is_starred, 0);
  // The modseq is stored again, so the next sync is back on CONDSTORE.
  assert.match(String(JSON.parse(h.getAccount(ctx.db, account.id).sync_state).highestModseq), /^\d+$/);

  forget();
  const unchanged = await ctx.manager.syncAccount(account.id);
  assert.equal(unchanged.flagRefresh, 'fallback');
  assert.equal(unchanged.updated, 0);
  assert.equal((await ctx.manager.syncAccount(account.id)).flagRefresh, 'condstore');
});

// ---------------------------------------------------------------------------------------------
// Removal and UIDVALIDITY
// ---------------------------------------------------------------------------------------------

imapTest('messages deleted, flagged \\Deleted or moved elsewhere are removed locally', async (t, ctx) => {
  const keep = await h.appendAlice(h.buildMessage({ subject: 'keep' }));
  const del = await h.appendAlice(h.buildMessage({ subject: 'delete me' }));
  const moved = await h.appendAlice(h.buildMessage({ subject: 'archive me' }));
  const flagged = await h.appendAlice(h.buildMessage({ subject: 'flag deleted' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);
  assert.equal(h.messagesOf(ctx.db, account.id).length, 4);

  await h.withAlice(async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageDelete(String(del), { uid: true });
      await client.messageMove(String(moved), 'Archive', { uid: true });
      await client.messageFlagsAdd(String(flagged), ['\\Deleted'], { uid: true }); // not expunged
    } finally {
      lock.release();
    }
  });
  const result = await ctx.manager.syncAccount(account.id);
  assert.equal(result.ok, true);
  assert.equal(result.removed, 3);
  assert.deepEqual(h.messagesOf(ctx.db, account.id).map((r) => r.uid), [keep]);
  // FTS stays consistent with the table (delete trigger ran).
  const fts = ctx.db.prepare("SELECT rowid FROM messages_fts WHERE messages_fts MATCH 'archive'").all();
  assert.equal(fts.length, 0);
});

imapTest('an emptied mailbox removes everything locally', async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'x' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);
  await h.resetAlice();
  const result = await ctx.manager.syncAccount(account.id);
  assert.equal(result.removed, 1);
  assert.equal(h.messagesOf(ctx.db, account.id).length, 0);
});

imapTest('a UIDVALIDITY change wipes local mail and resyncs from scratch', async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'one' }));
  await h.appendAlice(h.buildMessage({ subject: 'two' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);
  const real = JSON.parse(h.getAccount(ctx.db, account.id).sync_state);

  // Pretend everything we have came from an older UIDVALIDITY generation.
  ctx.db.prepare('UPDATE messages SET uid_validity = 1, uid = uid + 1000 WHERE account_id = ?').run(account.id);
  ctx.db.prepare('UPDATE accounts SET sync_state = ? WHERE id = ?').run(JSON.stringify({ uidValidity: 1, lastUid: 99999, highestModseq: '1' }), account.id);

  const result = await ctx.manager.syncAccount(account.id);
  assert.equal(result.ok, true);
  assert.equal(result.removed, 2);
  assert.equal(result.newMessages, 2);
  const rows = h.messagesOf(ctx.db, account.id);
  assert.deepEqual(rows.map((r) => r.subject), ['one', 'two']);
  assert.ok(rows.every((r) => r.uid_validity === real.uidValidity));
  assert.deepEqual(JSON.parse(h.getAccount(ctx.db, account.id).sync_state).uidValidity, real.uidValidity);
});

// ---------------------------------------------------------------------------------------------
// Bodies, cid links, deferred bodies
// ---------------------------------------------------------------------------------------------

imapTest('inline cid: images are rewritten to the new row id during sync', async (t, ctx) => {
  await h.appendAlice(
    h.buildMessage({
      subject: 'with logo',
      text: 'plain',
      html: '<p>Hi</p><img src="cid:logo@ex"><img src="https://tracker.example/p.gif">',
      attachments: [
        { filename: 'logo.png', contentType: 'image/png', content: h.TINY_PNG, cid: 'logo@ex' },
        { filename: 'notes.txt', contentType: 'text/plain', content: 'attached notes' },
      ],
    })
  );
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);
  const [row] = h.messagesOf(ctx.db, account.id);
  assert.ok(row.html_body.includes(`src="/api/messages/${row.id}/attachments/0"`), row.html_body);
  assert.doesNotMatch(row.html_body, /cid:/);
  const atts = JSON.parse(row.attachments_json);
  assert.deepEqual(
    atts.map(({ index, filename, contentType, cid, inline }) => ({ index, filename, contentType, cid, inline })),
    [
      { index: 0, filename: 'logo.png', contentType: 'image/png', cid: 'logo@ex', inline: true },
      { index: 1, filename: 'notes.txt', contentType: 'text/plain', cid: null, inline: false },
    ]
  );
  assert.ok(atts.every((a) => !('content' in a)), 'attachment bytes are never stored');
  assert.equal(row.has_attachments, 1);
  assert.equal(row.remote_image_count, 1);
});

imapTest('large messages are deferred and fetchBodyNow downloads them on demand', { MAX_BODY_BYTES: '10000' }, async (t, ctx) => {
  const big = Buffer.alloc(40000, 'a');
  await h.appendAlice(h.buildMessage({ subject: 'small one', text: 'tiny body' }));
  const bigUid = await h.appendAlice(
    h.buildMessage({
      subject: 'big one',
      html: '<p>Quarterly zebrafish numbers</p><img src="cid:chart@ex">',
      attachments: [
        { filename: 'chart.png', contentType: 'image/png', content: h.TINY_PNG, cid: 'chart@ex' },
        { filename: 'data.bin', contentType: 'application/octet-stream', content: big },
      ],
    })
  );
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  const result = await ctx.manager.syncAccount(account.id);
  assert.equal(result.newMessages, 2);
  const rows = Object.fromEntries(h.messagesOf(ctx.db, account.id).map((r) => [r.subject, r]));
  assert.equal(rows['small one'].body_state, 'ready');
  const deferred = rows['big one'];
  assert.equal(deferred.uid, bigUid);
  assert.equal(deferred.body_state, 'deferred');
  assert.equal(deferred.html_body, null);
  assert.equal(deferred.text_body, null);
  assert.equal(deferred.snippet, null);
  assert.equal(deferred.has_attachments, 1, 'known from BODYSTRUCTURE');
  assert.ok(deferred.size > 40000);
  assert.equal(deferred.from_address, 'sender@example.com');

  const [updated, again] = await Promise.all([ctx.manager.fetchBodyNow(deferred), ctx.manager.fetchBodyNow(deferred)]);
  assert.equal(updated.id, deferred.id);
  assert.equal(updated.body_state, 'ready');
  assert.equal(again.body_state, 'ready');
  assert.match(updated.snippet, /Quarterly zebrafish numbers/);
  assert.ok(updated.html_body.includes(`/api/messages/${deferred.id}/attachments/0`), updated.html_body);
  const atts = JSON.parse(updated.attachments_json);
  assert.equal(atts.length, 2);
  assert.equal(atts[1].size, 40000);
  // Full-text search sees the downloaded body.
  const hits = ctx.db.prepare("SELECT rowid FROM messages_fts WHERE messages_fts MATCH 'zebrafish'").all();
  assert.deepEqual(hits.map((r) => r.rowid), [deferred.id]);

  // Already ready: returned straight from the database.
  const ready = await ctx.manager.fetchBodyNow(updated);
  assert.equal(ready.body_state, 'ready');
});

imapTest('fetchBodyNow reports a message that is gone from the server', { MAX_BODY_BYTES: '10000' }, async (t, ctx) => {
  const uid = await h.appendAlice(h.buildMessage({ subject: 'big', text: 'x'.repeat(20000) }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);
  const [row] = h.messagesOf(ctx.db, account.id);
  assert.equal(row.body_state, 'deferred');
  await h.withAlice(async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageDelete(String(uid), { uid: true });
    } finally {
      lock.release();
    }
  });
  await assert.rejects(ctx.manager.fetchBodyNow(row), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 404);
    assert.equal(err.code, 'MESSAGE_GONE');
    return true;
  });
  await assert.rejects(ctx.manager.fetchBodyNow({ id: 999999 }), (err) => err.status === 404);
  await assert.rejects(ctx.manager.fetchBodyNow(null), (err) => err.status === 404);
});

imapTest('fetchBodyNow wraps connection failures in a friendly 502', { MAX_BODY_BYTES: '10000' }, async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'big', text: 'y'.repeat(20000) }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  await ctx.manager.syncAccount(account.id);
  const [row] = h.messagesOf(ctx.db, account.id);
  ctx.db.prepare('UPDATE accounts SET imap_port = 1 WHERE id = ?').run(account.id);
  await assert.rejects(ctx.manager.fetchBodyNow(row), (err) => {
    assert.equal(err.status, 502);
    assert.equal(err.code, 'IMAP_ERROR');
    assert.match(err.message, /refused the connection/);
    return true;
  });
});

// ---------------------------------------------------------------------------------------------
// Errors and status
// ---------------------------------------------------------------------------------------------

imapTest('wrong password -> auth_error with a friendly message', async (t, ctx) => {
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { password: 'definitely-wrong' });
  const result = await ctx.manager.syncAccount(account.id);
  assert.equal(result.ok, false);
  assert.match(result.error, /Wrong email or password/);
  const acc = h.getAccount(ctx.db, account.id);
  assert.equal(acc.status, 'auth_error');
  assert.equal(acc.last_error, result.error);
  assert.equal(acc.last_synced_at, null);
});

imapTest('unreachable server -> status error; a later success clears it', async (t, ctx) => {
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { imap_port: 1 });
  const failed = await ctx.manager.syncAccount(account.id);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /refused the connection/);
  let acc = h.getAccount(ctx.db, account.id);
  assert.equal(acc.status, 'error');
  assert.match(acc.last_error, /127\.0\.0\.1:1/);
  assert.ok(ctx.logger.lines.some((l) => l.level === 'warn' && /refused/.test(l.text)));

  ctx.db.prepare('UPDATE accounts SET imap_port = 1143 WHERE id = ?').run(account.id);
  const ok = await ctx.manager.syncAccount(account.id);
  assert.equal(ok.ok, true);
  acc = h.getAccount(ctx.db, account.id);
  assert.equal(acc.status, 'ok');
  assert.equal(acc.last_error, null);
});

imapTest('status is "syncing" while a sync runs', async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'x' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  let seen = null;
  wrapWithImap(t, (original, deps, acc, fn) =>
    original(deps, acc, (client) => {
      seen = h.getAccount(ctx.db, account.id).status;
      return fn(client);
    })
  );
  assert.equal(ctx.manager.isSyncing(account.id), false);
  const p = ctx.manager.syncAccount(account.id);
  assert.equal(ctx.manager.isSyncing(account.id), true);
  await p;
  assert.equal(seen, 'syncing');
  assert.equal(ctx.manager.isSyncing(account.id), false);
});

imapTest('fixing the password while a sync with the old one runs: stale result ignored, synced again', async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'after the fix' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { password: 'old-wrong-password' });
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let runs = 0;
  wrapWithImap(t, async (original, ...args) => {
    runs += 1;
    if (runs === 1) await gate; // hold the first (stale) run until the "user" has saved the fix
    return original(...args);
  });
  const first = ctx.manager.syncAccount(account.id);
  await new Promise((r) => setTimeout(r, 20));
  // What PATCH /api/accounts/:id does after re-verifying the login: new secret, status 'pending', sync.
  ctx.db.prepare("UPDATE accounts SET secret_enc = ?, status = 'pending' WHERE id = ?").run(ctx.crypto.encryptJson({ password: 'alicepw' }), account.id);
  assert.equal(ctx.manager.syncAccount(account.id), first, 'joins the running sync');
  release();
  const stale = await first;
  assert.equal(stale.ok, false);
  assert.notEqual(h.getAccount(ctx.db, account.id).status, 'auth_error', 'stale failure must not overwrite the fix');

  const deadline = Date.now() + 10000;
  while (h.getAccount(ctx.db, account.id).status !== 'ok' && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  assert.equal(h.getAccount(ctx.db, account.id).status, 'ok');
  assert.equal(runs, 2);
  assert.deepEqual(h.messagesOf(ctx.db, account.id).map((m) => m.subject), ['after the fix']);
});

imapTest('unknown account resolves (never rejects) with ok:false', async (t, ctx) => {
  const result = await ctx.manager.syncAccount(424242);
  assert.equal(result.ok, false);
  assert.equal(result.accountId, 424242);
});

imapTest('deleting the account mid-sync does not crash or leave rows behind', async (t, ctx) => {
  for (let i = 0; i < 6; i++) await h.appendAlice(h.buildMessage({ subject: `m${i}`, text: 'body' }));

  // Deterministic: delete right after the connection is made, before anything is stored.
  const first = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { email: 'gone-1@test.local' });
  wrapWithImap(t, (original, deps, acc, fn) =>
    original(deps, acc, (client) => {
      if (acc.id === first.id) ctx.db.prepare('DELETE FROM accounts WHERE id = ?').run(acc.id);
      return fn(client);
    })
  );
  const r1 = await ctx.manager.syncAccount(first.id);
  assert.equal(r1.ok, false);
  assert.equal(r1.error, 'Account was removed');
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(first.id).n, 0);

  // Timing-based: delete at various moments of a real sync.
  for (const delay of [0, 1, 3, 8, 15, 30, 60]) {
    const acc = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { email: `gone-${delay}@test.local` });
    const p = ctx.manager.syncAccount(acc.id);
    await new Promise((r) => setTimeout(r, delay));
    ctx.db.prepare('DELETE FROM accounts WHERE id = ?').run(acc.id);
    const result = await p;
    assert.equal(typeof result.ok, 'boolean');
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE account_id = ?').get(acc.id).n, 0, `delay ${delay}`);
    assert.equal(h.getAccount(ctx.db, acc.id), undefined);
  }
});

// ---------------------------------------------------------------------------------------------
// Dedupe, concurrency, syncUser
// ---------------------------------------------------------------------------------------------

imapTest('concurrent syncAccount calls for one account share a single run', async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'x' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  let connections = 0;
  wrapWithImap(t, (original, ...args) => {
    connections += 1;
    return original(...args);
  });
  const p1 = ctx.manager.syncAccount(account.id);
  const p2 = ctx.manager.syncAccount(account.id);
  assert.equal(p1, p2, 'same promise');
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, r2);
  assert.equal(connections, 1);
  // Once finished, a new call starts a new run.
  await ctx.manager.syncAccount(account.id);
  assert.equal(connections, 2);
});

imapTest('SYNC_CONCURRENCY caps simultaneous syncs; syncUser returns one result per account', { SYNC_CONCURRENCY: '2' }, async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'shared' }));
  const accounts = [1, 2, 3, 4, 5].map((i) => h.createAccount(ctx.db, ctx.crypto, ctx.userId, { email: `alias${i}@test.local` }));
  let active = 0;
  let max = 0;
  wrapWithImap(t, async (original, ...args) => {
    active += 1;
    max = Math.max(max, active);
    try {
      await new Promise((r) => setTimeout(r, 30));
      return await original(...args);
    } finally {
      active -= 1;
    }
  });
  const results = await ctx.manager.syncUser(ctx.userId);
  assert.equal(max, 2);
  assert.deepEqual(results.map((r) => r.accountId), accounts.map((a) => a.id));
  assert.ok(results.every((r) => r.ok && r.newMessages === 1), JSON.stringify(results));
  assert.deepEqual(await ctx.manager.syncUser(987654), []);
});

imapTest('syncUser reports accounts still running at the timeout as pending', async (t, ctx) => {
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  wrapWithImap(t, async (original, ...args) => {
    await gate;
    return original(...args);
  });
  const results = await ctx.manager.syncUser(ctx.userId, { timeoutMs: 50 });
  assert.deepEqual(results, [{ accountId: account.id, ok: false, pending: true }]);
  assert.equal(ctx.manager.isSyncing(account.id), true);
  release();
  const done = await ctx.manager.syncAccount(account.id); // joins the running sync
  assert.equal(done.ok, true);
});

// ---------------------------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------------------------

imapTest('start() with the scheduler disabled schedules nothing but resets stale "syncing" rows', async (t, ctx) => {
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { status: 'syncing' });
  let calls = 0;
  wrapWithImap(t, (original, ...args) => {
    calls += 1;
    return original(...args);
  });
  ctx.manager.start();
  assert.equal(h.getAccount(ctx.db, account.id).status, 'pending');
  await new Promise((r) => setTimeout(r, 2300));
  assert.equal(calls, 0);
});

imapTest('the scheduler syncs accounts shortly after start, skipping ones that need reconnecting', { DISABLE_SYNC_SCHEDULER: 'false' }, async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'scheduled' }));
  const good = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { email: 'good@test.local' });
  const broken = h.createAccount(ctx.db, ctx.crypto, ctx.userId, { email: 'broken@test.local', status: 'auth_error' });
  const synced = [];
  wrapWithImap(t, (original, deps, acc, fn) => {
    synced.push(acc.id);
    return original(deps, acc, fn);
  });
  ctx.manager.start();
  const deadline = Date.now() + 10000;
  while (h.getAccount(ctx.db, good.id).status !== 'ok' && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  await ctx.manager.stop();
  assert.equal(h.getAccount(ctx.db, good.id).status, 'ok');
  assert.equal(h.messagesOf(ctx.db, good.id).length, 1);
  assert.ok(!synced.includes(broken.id), 'auth_error accounts are not retried automatically');
  assert.equal(h.getAccount(ctx.db, broken.id).status, 'auth_error');
});

imapTest('stop() waits for an in-flight sync', async (t, ctx) => {
  await h.appendAlice(h.buildMessage({ subject: 'x' }));
  const account = h.createAccount(ctx.db, ctx.crypto, ctx.userId);
  const p = ctx.manager.syncAccount(account.id);
  await ctx.manager.stop();
  assert.equal(ctx.manager.isSyncing(account.id), false);
  assert.equal((await p).ok, true);
});
