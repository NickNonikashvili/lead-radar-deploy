#!/usr/bin/env node
'use strict';

/**
 * Fill the demo mailboxes on the demo IMAP server with the seeded mail (lib/mail-content.js).
 *
 *   node seed-mail.js           append the demo mail (expects empty mailboxes, e.g. a fresh volume)
 *   node seed-mail.js --wipe    first empty every folder and delete custom folders, then seed
 *
 * DEMO_NOW=2026-11-13T15:00:00Z pins "now" (used for the marketing screenshots); normally the
 * dates are relative to the real time, spread over the last two weeks.
 *
 * Settings: DEMO_IMAP_HOST / DEMO_IMAP_PORT / DEMO_USERS_FILE (see lib/demo-env.js).
 */

const MailComposer = require('nodemailer/lib/mail-composer');
const { loadMailboxes, settings } = require('./lib/demo-env');
const { withMailbox, waitForImap } = require('./lib/imap');
const { buildDemoMail, BOX } = require('./lib/mail-content');

const SPECIAL = ['INBOX', 'Drafts', 'Sent', 'Archive', 'Junk', 'Trash'];

function compile(options) {
  return new Promise((resolve, reject) => {
    new MailComposer(options).compile().build((err, message) => (err ? reject(err) : resolve(message)));
  });
}

async function wipe(client) {
  const list = await client.list();
  // Children before parents.
  const custom = list.filter((b) => !SPECIAL.includes(b.path)).sort((a, b) => b.path.length - a.path.length);
  for (const box of custom) await client.mailboxDelete(box.path);
  for (const path of SPECIAL) {
    if (!list.some((b) => b.path === path)) continue;
    const lock = await client.getMailboxLock(path);
    try {
      if (client.mailbox.exists > 0) await client.messageDelete('1:*');
    } finally {
      lock.release();
    }
  }
  return custom.length;
}

async function main() {
  const doWipe = process.argv.includes('--wipe');
  const mailboxes = new Map(loadMailboxes().map((b) => [b.address, b]));
  for (const address of Object.values(BOX)) {
    if (!mailboxes.has(address)) throw new Error(`${address} is used by the seed mail but missing from ${settings.usersFile}`);
  }
  await waitForImap(mailboxes.get(BOX.work));

  const now = process.env.DEMO_NOW ? new Date(process.env.DEMO_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`DEMO_NOW is not a valid date: ${process.env.DEMO_NOW}`);
  const seedId = now.getTime().toString(36);
  const { folders, messages } = buildDemoMail(now);
  const byKey = new Map(messages.map((msg) => [msg.key, msg]));
  for (const msg of messages) {
    msg.messageId = `<${msg.key}.${seedId}@mail.demo.test>`;
  }
  for (const msg of messages) {
    const refs = [];
    for (let p = msg.replyTo && byKey.get(msg.replyTo); p; p = p.replyTo && byKey.get(p.replyTo)) refs.unshift(p.messageId);
    msg.references = refs;
  }

  let total = 0;
  for (const [boxKey, address] of Object.entries(BOX)) {
    await withMailbox(mailboxes.get(address), async (client) => {
      if (doWipe) {
        const removed = await wipe(client);
        console.log(`${address}: wiped${removed ? ` (and removed ${removed} custom folder(s))` : ''}`);
      }
      const existing = new Set((await client.list()).map((b) => b.path));
      for (const path of folders[boxKey] || []) {
        if (!existing.has(path)) await client.mailboxCreate(path);
        await client.mailboxSubscribe(path);
      }
      const mine = messages.filter((msg) => msg.box === boxKey).sort((a, b) => a.date - b.date);
      for (const msg of mine) {
        const raw = await compile({
          from: msg.from,
          to: msg.to,
          cc: msg.cc,
          subject: msg.subject,
          date: msg.date,
          messageId: msg.messageId,
          inReplyTo: msg.references.length ? msg.references[msg.references.length - 1] : undefined,
          references: msg.references.length ? msg.references : undefined,
          text: msg.text,
          html: msg.html,
          attachments: msg.attachments,
          icalEvent: msg.icalEvent,
          headers: { 'X-Mailtabs-Demo': 'seed', ...(msg.headers || {}) },
        });
        await client.append(msg.folder, raw, msg.flags, msg.date);
        total += 1;
      }
      const counts = mine.reduce((acc, msg) => ({ ...acc, [msg.folder]: (acc[msg.folder] || 0) + 1 }), {});
      console.log(`${address}: ${mine.length} messages (${Object.entries(counts).map(([f, n]) => `${f} ${n}`).join(', ')})`);
    });
  }
  console.log(`Seeded ${total} messages into ${Object.keys(BOX).length} demo mailboxes on ${settings.imapHost}:${settings.imapPort}.`);
}

main().catch((err) => {
  console.error('seed-mail failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
