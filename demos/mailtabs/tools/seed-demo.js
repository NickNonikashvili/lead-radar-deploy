#!/usr/bin/env node
'use strict';

/**
 * Set up the shared demo login in a FRESH Mailtabs, using only Mailtabs' public HTTP API
 * (exactly what the web app does), so it keeps working as Mailtabs changes:
 *
 *   1. sign up the demo login (the first user of an empty Mailtabs may always sign up, even with
 *      ALLOW_SIGNUPS=false; if it already exists, sign in instead)
 *   2. connect three demo mailboxes as "Other (IMAP)" accounts, with names, colours, sender
 *      names and signatures (the fourth mailbox is left for visitors to add themselves)
 *   3. create the tabs (Work, Personal, Side project, Receipts, Newsletters) with their rules
 *   4. wait until every account has synced, then check that sign-ups are closed
 *
 * Settings: MAILTABS_URL, DEMO_LOGIN_EMAIL, DEMO_LOGIN_PASSWORD, DEMO_PUBLIC_IMAP_HOST,
 * DEMO_PUBLIC_SMTP_HOST, DEMO_IMAP_PORT, DEMO_SMTP_PORT, DEMO_USERS_FILE (see lib/demo-env.js).
 * Exit code 0 = the demo is ready.
 */

const { settings, loadMailboxes } = require('./lib/demo-env');
const { BOX, ME } = require('./lib/mail-content');

const ACCOUNTS = [
  {
    key: 'work',
    displayName: 'Work',
    color: '#2563eb',
    senderName: 'Alex Morgan',
    signatureHtml:
      '<p>Alex Morgan<br><strong>Product Designer</strong> · Fernhill Labs<br><span style="color:#64748b">fernhill.demo.test</span></p>',
  },
  {
    key: 'personal',
    displayName: 'Personal',
    color: '#059669',
    senderName: 'Alex',
    signatureHtml: '<p>– Alex</p>',
  },
  {
    key: 'side',
    displayName: 'Tidepool',
    color: '#d97706',
    senderName: 'Alex from Tidepool',
    signatureHtml: '<p>Alex · <em>Tidepool, the calm habit tracker</em></p>',
  },
];

const TABS = [
  { name: 'Work', color: '#2563eb', accounts: ['work'] },
  {
    name: 'Personal',
    color: '#059669',
    accounts: ['personal'],
    rules: { match: 'all', conditions: [{ field: 'body', op: 'not_contains', value: 'unsubscribe' }] },
  },
  { name: 'Side project', color: '#d97706', accounts: ['side'] },
  {
    name: 'Receipts',
    color: '#7c3aed',
    allAccounts: true,
    rules: {
      match: 'any',
      conditions: [
        { field: 'subject', op: 'contains', value: 'receipt' },
        { field: 'subject', op: 'contains', value: 'order' },
        { field: 'subject', op: 'contains', value: 'invoice' },
      ],
    },
  },
  {
    name: 'Newsletters',
    color: '#0891b2',
    allAccounts: true,
    rules: { match: 'any', conditions: [{ field: 'body', op: 'contains', value: 'unsubscribe' }] },
  },
];

// --- a tiny API client with a cookie jar and the anti-CSRF header -------------------------------

const jar = new Map();
async function api(method, path, body) {
  const headers = { accept: 'application/json' };
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  if (method !== 'GET') headers['x-mailtabs'] = '1';
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(settings.mailtabsUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const line of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

function must(res, what, ok = [200, 201]) {
  if (!ok.includes(res.status)) throw new Error(`${what} failed: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForMailtabs(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await api('GET', '/api/config');
      if (res.status === 200) return res.body;
    } catch (_) {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`Mailtabs did not answer at ${settings.mailtabsUrl}`);
    await sleep(1000);
  }
}

async function signIn() {
  const creds = { email: settings.loginEmail, password: settings.loginPassword };
  const signup = await api('POST', '/api/auth/signup', { ...creds, name: settings.loginName || ME });
  if (signup.status === 201) {
    console.log(`Created the demo login ${settings.loginEmail}.`);
    return true;
  }
  if (![403, 409].includes(signup.status)) must(signup, 'Sign-up');
  must(await api('POST', '/api/auth/login', creds), `Sign-in as ${settings.loginEmail} (sign-up said ${signup.body && signup.body.code})`);
  console.log(`Signed in as the existing demo login ${settings.loginEmail}.`);
  return false;
}

async function main() {
  const passwords = new Map(loadMailboxes().map((b) => [b.address, b.password]));
  await waitForMailtabs();
  const created = await signIn();

  // --- accounts ---
  const existing = must(await api('GET', '/api/accounts'), 'Listing accounts').accounts;
  const ids = {};
  for (const spec of ACCOUNTS) {
    const email = BOX[spec.key];
    const found = existing.find((a) => a.email.toLowerCase() === email);
    if (found) {
      ids[spec.key] = found.id;
      console.log(`Account ${email} already connected (id ${found.id}).`);
      continue;
    }
    const res = await api('POST', '/api/accounts', {
      provider: 'imap',
      email,
      password: passwords.get(email),
      imapHost: settings.publicImapHost,
      imapPort: settings.imapPort,
      imapSecurity: 'none',
      smtpHost: settings.publicSmtpHost,
      smtpPort: settings.smtpPort,
      smtpSecurity: 'none',
      displayName: spec.displayName,
      color: spec.color,
      senderName: spec.senderName,
      signatureHtml: spec.signatureHtml,
    });
    const body = must(res, `Connecting ${email}`);
    if (body.warnings && body.warnings.length) throw new Error(`Connecting ${email}: ${body.warnings.join(' ')}`);
    if (!body.account.canSend) throw new Error(`Connecting ${email}: sending is not available (${body.account.sendBlockedReason})`);
    ids[spec.key] = body.account.id;
    console.log(`Connected ${email} as "${spec.displayName}" (id ${body.account.id}).`);
  }

  // --- tabs ---
  const tabsNow = must(await api('GET', '/api/tabs'), 'Listing tabs');
  const tabList = Array.isArray(tabsNow) ? tabsNow : tabsNow.tabs || [];
  for (const tab of TABS) {
    if (tabList.some((t) => t.name === tab.name)) {
      console.log(`Tab "${tab.name}" already exists.`);
      continue;
    }
    must(
      await api('POST', '/api/tabs', {
        name: tab.name,
        color: tab.color,
        allAccounts: !!tab.allAccounts,
        accountIds: (tab.accounts || []).map((k) => ids[k]),
        rules: tab.rules || null,
      }),
      `Creating tab ${tab.name}`
    );
    console.log(`Created tab "${tab.name}".`);
  }

  // --- settings: the default 10 s undo-send window, notifications off ---
  must(await api('PUT', '/api/settings', { undoSendSeconds: 10, notifications: false }), 'Saving settings');

  // --- wait for the first sync of every account ---
  const deadline = Date.now() + 120000;
  for (;;) {
    const accounts = must(await api('GET', '/api/accounts'), 'Listing accounts').accounts;
    const pending = accounts.filter((a) => a.status !== 'ok');
    const failed = accounts.filter((a) => a.status === 'error' || a.status === 'auth_error');
    if (failed.length) throw new Error(`Sync failed: ${failed.map((a) => `${a.email}: ${a.lastError}`).join('; ')}`);
    if (!pending.length) {
      for (const a of accounts) console.log(`  ${a.displayName.padEnd(9)} ${a.email.padEnd(28)} ${a.messageCount} messages, ${a.unreadCount} unread`);
      break;
    }
    if (Date.now() > deadline) throw new Error(`Still syncing after 2 minutes: ${pending.map((a) => a.email).join(', ')}`);
    await sleep(1500);
  }

  // The reverse proxy protects the seeded accounts by id (see Caddyfile); fresh data dirs give 1, 2, 3.
  const seededIds = Object.values(ids).sort((a, b) => a - b).join(',');
  if (created && seededIds !== '1,2,3') {
    console.warn(`WARNING: the seeded accounts got ids ${seededIds}, not 1,2,3: update the account-delete rule in the Caddyfile.`);
  }

  const config = must(await api('GET', '/api/config'), 'Reading config');
  if (config.allowSignups) {
    console.warn('WARNING: sign-ups are still open. Run Mailtabs with ALLOW_SIGNUPS=false for the public demo.');
    process.exitCode = 2;
  }
  await api('POST', '/api/auth/logout');
  console.log(`Demo ready: sign in at ${settings.mailtabsUrl} as ${settings.loginEmail} / ${settings.loginPassword}`);
}

main().catch((err) => {
  console.error('seed-demo failed:', err && err.message ? err.message : err);
  process.exit(1);
});
