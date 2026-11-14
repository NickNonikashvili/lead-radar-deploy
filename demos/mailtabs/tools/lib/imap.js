'use strict';

const { ImapFlow } = require('imapflow');
const { settings } = require('./demo-env');

/** Run fn(client) logged in as one demo mailbox on the demo IMAP server; always logs out. */
async function withMailbox({ address, password }, fn) {
  const client = new ImapFlow({
    host: settings.imapHost,
    port: settings.imapPort,
    secure: false,
    doSTARTTLS: false,
    auth: { user: address, pass: password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  });
  client.on('error', () => {}); // surfaced through the awaited calls
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

/** Wait until the IMAP server accepts connections (used by the seeders right after a reset). */
async function waitForImap(mailbox, { timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await withMailbox(mailbox, async () => {});
      return;
    } catch (err) {
      if (Date.now() > deadline) throw new Error(`IMAP server ${settings.imapHost}:${settings.imapPort} not reachable: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

module.exports = { withMailbox, waitForImap };
