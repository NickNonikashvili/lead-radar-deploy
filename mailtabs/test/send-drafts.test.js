'use strict';

/**
 * Drafts on a real IMAP server (Dovecot, user s1 only).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const drafts = require('../src/drafts');
const uploads = require('../src/uploads');
const {
  imapAvailable,
  lockUsers,
  resetUser,
  appendTo,
  messagesIn,
  sendAccount,
  storeMessageRow,
  makeEngineEnv,
  createUser,
  buildMessage,
  parse,
  headerLines,
  TINY_PNG,
} = require('./send-helpers');

let skip = false;
let release = () => {};
test.before(async () => {
  skip = !(await imapAvailable());
  if (!skip) release = await lockUsers();
});
test.after(() => release());

function setup() {
  const env = makeEngineEnv();
  const userId = createUser(env.db);
  env.db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Sam One', userId);
  const synced = [];
  env.syncManager = { syncFolder: (id, opts) => (synced.push({ id, opts }), Promise.resolve({ ok: true })) };
  env.logger = { warn() {}, error() {}, info() {}, debug() {}, log() {} };
  const account = sendAccount(env, userId, 's1', 2525);
  return { env, userId, account, synced };
}

function payload(extra = {}) {
  return {
    accountId: 0,
    to: [{ name: 'Sam Two', address: 's2@test.local' }],
    bcc: [{ name: '', address: 'secret@example.org' }],
    subject: 'Draft one',
    html: '<p>First <b>version</b></p>',
    ...extra,
  };
}

test('saveDraft APPENDs to \\Drafts (found by LIST) with \\Draft \\Seen and keeps Bcc', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  await resetUser('s1');
  const { env, account, synced } = setup();
  try {
    const saved = await drafts.saveDraft(env, account, payload(), null);
    assert.ok(Number.isInteger(saved.folderId) && saved.uid > 0);
    const folder = env.db.prepare('SELECT * FROM folders WHERE id = ?').get(saved.folderId);
    assert.deepEqual([folder.account_id, folder.path, folder.special_use, folder.selectable], [account.id, 'Drafts', '\\Drafts', 1]);
    const onServer = await messagesIn('s1', 'Drafts');
    assert.equal(onServer.length, 1);
    assert.equal(onServer[0].uid, saved.uid);
    assert.ok(onServer[0].flags.has('\\Draft') && onServer[0].flags.has('\\Seen'));
    assert.deepEqual(headerLines(onServer[0].source, 'Bcc'), ['Bcc: secret@example.org'], 'a reopened draft keeps its Bcc');
    const parsed = await parse(onServer[0].source);
    assert.equal(parsed.subject, 'Draft one');
    assert.equal(parsed.from.value[0].name, 'Sam One', 'From name falls back to the user name');
    assert.equal(parsed.from.value[0].address, 's1@test.local');
    assert.match(parsed.html, /<b>version<\/b>/);
    assert.deepEqual(synced.map((s) => s.id), [saved.folderId], 'Drafts folder synced in the background');

    // A saved folder row is used directly the next time (no LIST needed), and the
    // account's sender name wins over the user name.
    env.db.prepare('UPDATE accounts SET sender_name = ? WHERE id = ?').run('S. One', account.id);
    const again = await drafts.saveDraft(env, { ...account, sender_name: 'S. One' }, payload({ to: [] }), null);
    assert.equal(again.folderId, saved.folderId);
    const second = (await messagesIn('s1', 'Drafts')).find((m) => m.uid === again.uid);
    assert.equal((await parse(second.source)).from.value[0].name, 'S. One');
  } finally {
    env.close();
  }
});

test('saving again replaces the previous draft; racing autosaves leave exactly one', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  await resetUser('s1');
  const { env, account } = setup();
  try {
    const first = await drafts.saveDraft(env, account, payload(), null);
    const second = await drafts.saveDraft(env, account, payload({ subject: 'Draft two' }), first);
    let onServer = await messagesIn('s1', 'Drafts');
    assert.deepEqual(onServer.map((m) => m.uid), [second.uid]);
    assert.equal(onServer[0].envelope.subject, 'Draft two');

    // Two saves that both think `second` is the previous one (an autosave raced a manual save).
    const [a, b] = await Promise.all([
      drafts.saveDraft(env, account, payload({ subject: 'Race A' }), second),
      drafts.saveDraft(env, account, payload({ subject: 'Race B' }), second),
    ]);
    onServer = await messagesIn('s1', 'Drafts');
    assert.equal(onServer.length, 1, 'no duplicate drafts');
    assert.ok([a.uid, b.uid].includes(onServer[0].uid));

    // A late save that still names a superseded draft removes the newest one too.
    const late = await drafts.saveDraft(env, account, payload({ subject: 'Late' }), a);
    onServer = await messagesIn('s1', 'Drafts');
    assert.deepEqual(onServer.map((m) => m.uid), [late.uid]);
    assert.equal(onServer[0].envelope.subject, 'Late');

    // deleteDraft follows the chain as well.
    await drafts.deleteDraft(env, account, first);
    assert.deepEqual(await messagesIn('s1', 'Drafts'), []);
  } finally {
    env.close();
  }
});

test('deleteDraft never deletes real mail, even with a forged reference', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  await resetUser('s1');
  const { env, userId, account } = setup();
  try {
    const { uid } = await appendTo('s1', 'INBOX', buildMessage({ to: 's1@test.local', subject: 'Real mail' }));
    env.db
      .prepare("INSERT INTO folders (account_id, path, name, special_use, created_at) VALUES (?, 'INBOX', 'Inbox', '\\Inbox', ?)")
      .run(account.id, Date.now());
    const inbox = env.db.prepare("SELECT id FROM folders WHERE account_id = ? AND path = 'INBOX'").get(account.id);
    await drafts.deleteDraft(env, account, { folderId: inbox.id, uid });
    assert.equal((await messagesIn('s1', 'INBOX')).length, 1, 'a message without \\Draft outside Drafts is kept');

    // Another user's folder: not found.
    const other = createUser(env.db);
    const otherAccount = sendAccount(env, other, 's1', 2525, { email: 'other@test.local' });
    await assert.rejects(drafts.deleteDraft(env, otherAccount, { folderId: inbox.id, uid }), (err) => err.status === 404);
    await assert.rejects(drafts.deleteDraft(env, account, { folderId: 'x', uid: 1 }), (err) => err.code === 'INVALID_DRAFT');
    assert.equal(userId > 0, true);
  } finally {
    env.close();
  }
});

test('drafts carry uploads, forwarded attachments and quoted inline images; loadDraft reopens them', async (t) => {
  if (skip) return t.skip('Dovecot not available');
  await resetUser('s1');
  const { env, userId, account } = setup();
  try {
    // An incoming message with a PDF and an inline logo, as the sync would have stored it.
    const raw = buildMessage({
      from: 'Sender <sender@example.org>',
      to: 's1@test.local',
      subject: 'Report',
      html: '<p>Report attached <img src="cid:logo@x"></p>',
      messageId: '<report@example.org>',
      attachments: [
        { filename: 'report.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.4 report') },
        { filename: 'logo.png', contentType: 'image/png', content: TINY_PNG, cid: 'logo@x' },
      ],
    });
    const { uid, uidValidity } = await appendTo('s1', 'INBOX', raw);
    const original = await storeMessageRow(env, account, { mailbox: 'INBOX', uid, uidValidity, raw });
    const pdfIndex = JSON.parse(original.attachments_json).find((a) => a.filename === 'report.pdf').index;
    assert.match(original.html_body || '', /\/api\/messages\/\d+\/attachments\/\d+/, 'stored body points at the inline image');

    const up = uploads.saveUpload(env, userId, { filename: 'notes.txt', contentType: 'text/plain', buffer: Buffer.from('my notes') });
    const saved = await drafts.saveDraft(
      env,
      account,
      payload({
        subject: 'Fwd: Report',
        html: `<p>See below</p><blockquote>${original.html_body}</blockquote>`,
        attachments: [{ uploadId: up.id }, { messageId: original.id, index: pdfIndex }],
        inReplyTo: '<report@example.org>',
        references: ['<report@example.org>'],
      }),
      null
    );
    const [draftOnServer] = await messagesIn('s1', 'Drafts');
    const parsed = await parse(draftOnServer.source);
    const names = parsed.attachments.map((a) => a.filename).sort();
    assert.deepEqual(names, ['logo.png', 'notes.txt', 'report.pdf']);
    assert.equal(parsed.attachments.find((a) => a.filename === 'report.pdf').content.toString(), '%PDF-1.4 report');
    const logo = parsed.attachments.find((a) => a.filename === 'logo.png');
    assert.ok(logo.cid && parsed.html.includes(`cid:${logo.cid}`), 'quoted inline image embedded as a cid part');
    assert.ok(!parsed.html.includes('/api/messages/'));
    assert.equal(parsed.inReplyTo, '<report@example.org>');

    // Reopen: the sync would store the draft row; loadDraft rebuilds the payload from the server copy.
    const draftRow = await storeMessageRow(env, account, { mailbox: 'Drafts', uid: saved.uid, uidValidity: uidValidityOf(await folderUidValidity('Drafts')), raw: draftOnServer.source, folderId: saved.folderId });
    env.db.prepare('UPDATE messages SET is_draft = 1 WHERE id = ?').run(draftRow.id);
    const { payload: reopened, draft } = await drafts.loadDraft(env, userId, draftRow);
    assert.deepEqual(draft, { folderId: saved.folderId, uid: saved.uid });
    assert.deepEqual(reopened.to, [{ name: 'Sam Two', address: 's2@test.local' }]);
    assert.deepEqual(reopened.bcc, [{ name: '', address: 'secret@example.org' }]);
    assert.equal(reopened.subject, 'Fwd: Report');
    assert.equal(reopened.inReplyTo, '<report@example.org>');
    assert.equal(reopened.replyToMessageId, original.id, 'the original is found by its Message-ID');
    assert.deepEqual(reopened.attachments.map((a) => a.filename).sort(), ['notes.txt', 'report.pdf']);
    assert.ok(reopened.attachments.every((a) => a.messageId === draftRow.id));
    assert.match(reopened.html, new RegExp(`/api/messages/${draftRow.id}/attachments/\\d`), 'inline image shown from the draft');

    // Opening a message that is not a draft gives a copy without a draft reference to replace.
    const notDraft = await drafts.loadDraft(env, userId, original);
    assert.equal(notDraft.draft, null);
    assert.equal(notDraft.payload.subject, 'Report');

    // Attachments of other users' messages can't be pulled in.
    const mallory = createUser(env.db);
    await assert.rejects(drafts.resolveAttachments(env, mallory, [{ messageId: original.id, index: pdfIndex }]), (err) => err.status === 410);
    await assert.rejects(drafts.resolveAttachments(env, mallory, [{ uploadId: up.id }]), (err) => err.status === 410 && err.code === 'ATTACHMENT_GONE');
    await assert.rejects(drafts.resolveAttachments(env, userId, [{ messageId: original.id, index: 9 }]), (err) => err.code === 'ATTACHMENT_GONE');
  } finally {
    env.close();
  }
});

async function folderUidValidity(path) {
  const { withUser } = require('./send-helpers');
  return withUser('s1', async (client) => (await client.status(path, { uidValidity: true })).uidValidity);
}

function uidValidityOf(v) {
  return Number(v);
}
