#!/usr/bin/env node
'use strict';

/**
 * Outgoing mail server for the PUBLIC Mailtabs demo. It never relays anything anywhere:
 *
 *   - Sign-in is required (AUTH PLAIN/LOGIN) with a demo mailbox and its password, and the
 *     envelope sender must be that same mailbox.
 *   - Recipients outside @demo.test (and its subdomains) are refused at RCPT TO with a clear
 *     message, so Mailtabs shows the visitor that the demo can't email the real world.
 *   - Mail to one of the demo mailboxes is delivered into that mailbox's INBOX with IMAP APPEND.
 *   - Mail to any other @*.demo.test address (the fictional colleagues and shops in the seeded
 *     mail) is accepted and thrown away, so replying to the seeded threads "works".
 *
 * There is no code path that opens a connection to anything except the demo IMAP server.
 * Run: node smtp-sink.js   (settings: see lib/demo-env.js)
 */

const os = require('os');
const { SMTPServer } = require('smtp-server');
const { settings, loadMailboxes, isDemoDomain } = require('./lib/demo-env');
const { withMailbox } = require('./lib/imap');

const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;
const MAX_RECIPIENTS = 20;
// Whole-server flood guard: at most this many accepted messages per rolling minute.
const MAX_MESSAGES_PER_MINUTE = 30;

const mailboxes = new Map(loadMailboxes().map((m) => [m.address, m]));
const recent = [];

function log(...args) {
  console.log(new Date().toISOString(), '[smtp-sink]', ...args);
}

function smtpError(code, message) {
  const err = new Error(message);
  err.responseCode = code;
  return err;
}

const server = new SMTPServer({
  name: settings.publicSmtpHost,
  banner: 'Mailtabs demo SMTP sink: delivers only to the demo mailboxes',
  size: MAX_MESSAGE_BYTES,
  authMethods: ['PLAIN', 'LOGIN'],
  authOptional: false,
  allowInsecureAuth: true, // internal network only, like the demo IMAP server
  disabledCommands: ['STARTTLS'],
  maxClients: 20,
  socketTimeout: 60 * 1000,
  logger: false,

  onAuth(auth, session, callback) {
    const box = mailboxes.get(String(auth.username || '').trim().toLowerCase());
    if (!box || auth.password !== box.password) {
      return callback(smtpError(535, 'Authentication failed: use one of the demo mailboxes and the demo password.'));
    }
    return callback(null, { user: box.address });
  },

  onMailFrom(address, session, callback) {
    const from = String(address.address || '').toLowerCase();
    if (from !== session.user) {
      return callback(smtpError(553, `This demo only sends as the signed-in mailbox (${session.user}).`));
    }
    const now = Date.now();
    while (recent.length && recent[0] < now - 60000) recent.shift();
    if (recent.length >= MAX_MESSAGES_PER_MINUTE) {
      return callback(smtpError(451, 'The demo mail server is busy. Try again in a minute.'));
    }
    return callback();
  },

  onRcptTo(address, session, callback) {
    const rcpt = String(address.address || '').toLowerCase();
    if (session.envelope.rcptTo.length >= MAX_RECIPIENTS) {
      return callback(smtpError(452, `At most ${MAX_RECIPIENTS} recipients per message in this demo.`));
    }
    if (!isDemoDomain(rcpt)) {
      log(`refused recipient ${rcpt} (not @${settings.demoDomain})`);
      return callback(
        smtpError(
          550,
          `This is a sandboxed demo and cannot email the real world. Send to one of the demo mailboxes instead: ${[...mailboxes.keys()].join(', ')}.`
        )
      );
    }
    return callback();
  },

  onData(stream, session, callback) {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('error', (err) => callback(err));
    stream.on('end', async () => {
      if (stream.sizeExceeded) return callback(smtpError(552, `Messages are limited to ${MAX_MESSAGE_BYTES / 1024 / 1024} MB in this demo.`));
      const raw = Buffer.concat(chunks);
      const recipients = session.envelope.rcptTo.map((r) => String(r.address).toLowerCase());
      const deliverTo = [...new Set(recipients.filter((r) => mailboxes.has(r)))];
      const discarded = recipients.filter((r) => !mailboxes.has(r));
      try {
        for (const rcpt of deliverTo) {
          const trace =
            `Received: from ${session.clientHostname || 'client'} by ${settings.publicSmtpHost} (Mailtabs demo sink)\r\n` +
            `\tfor <${rcpt}>; ${new Date().toUTCString()}\r\n` +
            `Delivered-To: ${rcpt}\r\n`;
          await withMailbox(mailboxes.get(rcpt), (client) => client.append('INBOX', Buffer.concat([Buffer.from(trace), raw]), []));
        }
      } catch (err) {
        log(`delivery failed: ${err.message}`);
        return callback(smtpError(451, 'The demo mailbox could not be reached. Try again in a moment.'));
      }
      recent.push(Date.now());
      log(
        `from ${session.user}: delivered to ${deliverTo.join(', ') || '(none)'}` +
          (discarded.length ? `; discarded for fictional ${discarded.join(', ')}` : '') +
          ` (${raw.length} bytes)`
      );
      return callback(null, deliverTo.length ? 'Delivered to the demo mailbox' : 'Accepted (fictional recipient, discarded)');
    });
  },
});

server.on('error', (err) => log('error:', err.message));
server.listen(settings.smtpPort, settings.smtpListenHost, () => {
  log(`listening on ${settings.smtpListenHost}:${settings.smtpPort} (${os.hostname()}), mailboxes: ${[...mailboxes.keys()].join(', ')}`);
});

function stop() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
