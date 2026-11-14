'use strict';

/**
 * Shared settings for the demo tools (SMTP sink, mail seeder, Mailtabs seeder).
 * Everything comes from environment variables so the same code runs locally and in Docker.
 */

const fs = require('fs');
const path = require('path');

const env = process.env;

const settings = Object.freeze({
  // The demo mail server as the TOOLS reach it.
  imapHost: env.DEMO_IMAP_HOST || '127.0.0.1',
  imapPort: Number(env.DEMO_IMAP_PORT || 3343),
  smtpListenHost: env.DEMO_SMTP_LISTEN || '127.0.0.1',
  smtpPort: Number(env.DEMO_SMTP_PORT || 3325),
  // The demo mail server as MAILTABS reaches it (what a visitor types into "Add account").
  publicImapHost: env.DEMO_PUBLIC_IMAP_HOST || 'imap.demo.test',
  publicSmtpHost: env.DEMO_PUBLIC_SMTP_HOST || 'smtp.demo.test',
  usersFile: env.DEMO_USERS_FILE || path.join(__dirname, '..', '..', 'dovecot', 'demo-users'),
  // Mailtabs itself.
  mailtabsUrl: (env.MAILTABS_URL || 'http://127.0.0.1:3301').replace(/\/+$/, ''),
  loginEmail: env.DEMO_LOGIN_EMAIL || 'demo@mailtabs.demo.test',
  loginPassword: env.DEMO_LOGIN_PASSWORD || 'mailtabs-demo',
  loginName: env.DEMO_LOGIN_NAME || 'Alex Morgan',
  // Mail to these domains is accepted by the sink; anything else is refused.
  demoDomain: (env.DEMO_DOMAIN || 'demo.test').toLowerCase(),
});

/** The demo mailboxes from Dovecot's passwd-file: [{ address, password }]. */
function loadMailboxes(file = settings.usersFile) {
  const out = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [user, pass] = line.split(':');
    const m = /^\{PLAIN\}(.*)$/.exec(pass || '');
    if (!user || !m) throw new Error(`demo-users: unsupported line "${line}" (use user:{PLAIN}password::::::)`);
    out.push({ address: user.toLowerCase(), password: m[1] });
  }
  if (!out.length) throw new Error(`demo-users: no mailboxes in ${file}`);
  return out;
}

/** True for demo.test and any subdomain of it. */
function isDemoDomain(address) {
  const domain = String(address || '').toLowerCase().split('@').pop();
  return domain === settings.demoDomain || domain.endsWith(`.${settings.demoDomain}`);
}

module.exports = { settings, loadMailboxes, isDemoDomain };
