# Mailtabs

**One inbox for all your email accounts, organised into tabs you design.**

Mailtabs is a small website you run yourself. Connect Gmail, Outlook / Hotmail / Microsoft 365, Yahoo,
iCloud, AOL, Fastmail, Zoho, GMX, Yandex, or any other mail server that speaks IMAP. All of their
incoming mail lands in one place, and you can make tabs for whatever you like:

- a **Work** tab with your work address attached, so it only shows work mail;
- a **Personal** tab with your Gmail and iCloud;
- a **Receipts** tab across *all* accounts that only shows mail whose subject contains "receipt" or "order".

A tab is a set of accounts plus optional rules ("from contains @company.com", "subject doesn't contain
newsletter", …). **All inboxes** is always there and shows everything.

It is a complete mail client, not just a reader:

- **Write, reply, reply all and forward** from any connected account, with attachments, Cc/Bcc,
  formatting, a choice of *From* account and address suggestions as you type.
- **Undo send** for a few seconds after you click Send, **scheduled send** ("tomorrow 8 AM"), an
  **Outbox**, and a **signature** and sender name per account.
- **Drafts** save themselves to your provider's real Drafts folder, so you can finish them on your phone.
- **Every folder**: Sent, Drafts, Spam, Trash, Archive, your own folders and subfolders, Gmail labels.
  Create, rename and delete folders, move mail between them, mark spam / not spam, delete forever and
  empty Trash.
- **Unified views** across all accounts: Inbox (with your tabs), Starred, Sent, Drafts, Outbox, Spam and Trash.
- **Conversation view**, **select many** messages at once, **Undo** for archive / delete / move,
  desktop notifications, print, download the original `.eml`, load older mail, search, and
  keyboard shortcuts.

Everything you do goes back to your real mailbox, so Gmail or Outlook on your phone shows the same state.

---

## Contents

1. [Run it on your computer](#1-run-it-on-your-computer)
2. [Connecting your email accounts](#2-connecting-your-email-accounts)
3. [Sending mail](#3-sending-mail)
4. [Using Mailtabs](#4-using-mailtabs)
5. [Optional: "Sign in with Google" (Gmail)](#5-optional-sign-in-with-google-gmail)
6. [Optional: "Sign in with Microsoft" (Outlook, Hotmail, Microsoft 365)](#6-optional-sign-in-with-microsoft-outlook-hotmail-microsoft-365)
7. [Deploying it to the internet](#7-deploying-it-to-the-internet)
8. [Configuration reference](#8-configuration-reference)
9. [How it works and how your data is protected](#9-how-it-works-and-how-your-data-is-protected)
10. [Limitations](#10-limitations)
11. [Development and tests](#11-development-and-tests)

---

## 1. Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd mailtabs
npm install
npm start
```

Open <http://localhost:3000>, create your login (the first person to sign up can always do so), and
click **Add account**.

To change settings, copy `.env.example` to `.env` and edit it. Every value is optional for local use.

## 2. Connecting your email accounts

Each account connects in one of two ways:

- **Sign in with Google / Microsoft (OAuth).** You approve access on Google's or Microsoft's own page,
  and Mailtabs never sees your password. Whoever runs the site has to set this up once
  (sections [5](#5-optional-sign-in-with-google-gmail) and [6](#6-optional-sign-in-with-microsoft-outlook-hotmail-microsoft-365)).
- **An app password.** This is a separate password that your provider generates just for mail apps.
  Your normal password almost never works any more. Mailtabs checks the login **before** saving it, so a
  wrong password is never stored.

| Provider | How to connect | Where to create the app password / what to switch on first |
|---|---|---|
| **Gmail** | *Sign in with Google* (if set up), or an app password | <https://myaccount.google.com/apppasswords>. Needs 2-Step Verification. Not offered for security-key-only or Advanced Protection accounts, or most work/school accounts. Revoked if you change your Google password. |
| **Outlook.com, Hotmail, Live, Microsoft 365** | *Sign in with Microsoft* only | Microsoft has switched off password and app-password access to mail for every account. Outlook.com users must also turn on **Settings → Mail → Forwarding and IMAP → "Let devices and apps use IMAP"**. |
| **Yahoo** | App password | <https://login.yahoo.com/account/security> → *Generate app password*. Yahoo may refuse until your browser has been signed in for a few days. |
| **iCloud** (icloud.com, me.com, mac.com) | App-specific password | <https://account.apple.com> → *Sign-In and Security* → *App-Specific Passwords*. Needs two-factor authentication. |
| **AOL** | App password | <https://login.aol.com/myaccount/security> → *Generate app password*. |
| **Fastmail** | App password | Settings → Privacy & Security → *Manage app passwords and access*. The Basic plan has no IMAP. |
| **Zoho** | Password, or an app password if you use 2FA | Turn on *Settings → Mail Accounts → IMAP Access* first. Paid custom-domain plans use `imappro.zoho.com`. Your exact server is shown under *Server Configuration Details* in Zoho. |
| **GMX** | Password / app password | Turn on *Settings → POP3 & IMAP* first. GMX.net turns it off again after long inactivity. |
| **Yandex** | App password | Turn on *Mail settings → Email clients → IMAP* and *App passwords and OAuth tokens*. Create the password at <https://id.yandex.com/security>. New app passwords can take 2–3 hours to start working. |
| **Anything else** | *Other (IMAP)* | Enter your provider's IMAP server, port (usually 993) and security (usually SSL/TLS), and for sending its SMTP server (usually port 465 SSL/TLS or 587 STARTTLS). Your provider's help pages list them as "IMAP settings" and "SMTP settings". |

While adding an account you can give it a name ("Work"), pick a colour, and attach it to tabs, or
create a tab for it on the spot. You can change all of that later in **Settings**.

## 3. Sending mail

For the providers in the table above, Mailtabs fills in the outgoing (SMTP) server by itself and
sends with the same app password or Google/Microsoft sign-in, so there is nothing extra to set up.
For *Other (IMAP)* accounts, enter the SMTP server while adding the account, or later under
**Settings → Accounts → Outgoing server (SMTP)**. If the outgoing server can't be reached, the account is still
added and Mailtabs tells you why sending isn't available yet.

A few provider notes:

- **Gmail** files a copy of everything you send in *Sent* itself. Limits: about 500 messages a day on
  a personal account (2,000 on paid Workspace), at most 100 recipients per message.
- **Outlook.com / Hotmail.** Accounts connected before sending existed must click *Reconnect* once,
  so Microsoft asks for the new "send email" permission. Microsoft has turned SMTP sending off for
  many newer Outlook.com mailboxes; for those, Mailtabs sends through Microsoft Graph instead (needs the
  *Mail.Send* permission from [section 6](#6-optional-sign-in-with-microsoft-outlook-hotmail-microsoft-365);
  messages up to about 3.5 MB).
- **Microsoft 365 work/school** accounts: *Authenticated SMTP* must be on for your mailbox. An admin
  turns it on in the Microsoft 365 admin center → *Users → Active users →* your user *→ Mail →
  Manage email apps*. It is off in organisations created after January 2020 and with Security defaults.
  Without it Mailtabs falls back to Microsoft Graph as above.
- **iCloud** sends with your full address (`name@icloud.com`) as the username, even if you signed in
  with just the name.
- **Zoho** files sent mail itself. Paid plans on your own domain use `smtppro.zoho.com`.
- For everyone else, Mailtabs puts a copy of each sent message in your *Sent* folder (and checks
  first that the provider didn't already do it, so you never get two).

How sending works in Mailtabs:

- **Undo send.** After you click Send, the message waits 10 seconds (change it in **Settings →
  Sending**, 0–30 s) and you can click *Undo* to get back to editing.
- **Scheduled send.** Use the arrow next to *Send*. Scheduled messages wait in the **Outbox**, where
  you can edit, retry or delete them. They are sent by the Mailtabs server, so it must be running at
  that time (the browser doesn't need to be open). A message that fails stays in the Outbox with the
  reason and a *Retry* button.
- **Drafts** save a few seconds after you stop typing, into the account's real Drafts folder.
- **Attachments** up to 25 MB per message in total (most providers' own limit).
- **Signature and sender name** are set per account in **Settings → Sending**.

## 4. Using Mailtabs

- The **sidebar** has your unified views (Inbox, Starred, Sent, Drafts, Outbox, Spam, Trash) and,
  under *Accounts*, every folder of every account. Use the ⋯ next to a folder to rename, delete or
  empty it, or *New folder…* to create one (subfolders too).
- **Inbox** keeps your tabs at the top. Tabs only show inbox mail; open a folder for everything else.
- **Select many**: tick the boxes (Shift-click selects a range), then use the bar that appears to
  archive, delete, move, mark spam, star or mark read.
- **Undo**: archive, delete, move and spam show *Undo* for 10 seconds (or press <kbd>z</kbd>).
- Older mail: folders first download the newest messages; *Load older messages* fetches more.
- **Notifications**: turn them on in **Settings → Notifications**. They work while a Mailtabs tab
  is open (it can be in the background).

Keyboard shortcuts (also listed in **Settings → Shortcuts**):

| Key | Action | Key | Action |
|---|---|---|---|
| <kbd>c</kbd> | Compose | <kbd>j</kbd> / <kbd>k</kbd> | Next / previous message |
| <kbd>r</kbd> | Reply | <kbd>Enter</kbd> | Open |
| <kbd>a</kbd> | Reply all | <kbd>e</kbd> | Archive |
| <kbd>f</kbd> | Forward | <kbd>#</kbd> | Delete |
| <kbd>v</kbd> | Move to folder | <kbd>!</kbd> | Spam |
| <kbd>s</kbd> | Star | <kbd>u</kbd> | Mark unread |
| <kbd>x</kbd> | Select | <kbd>z</kbd> | Undo |
| <kbd>/</kbd> | Search | <kbd>Esc</kbd> | Close / clear selection |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> | Send (in the composer) | | |

## 5. Optional: "Sign in with Google" (Gmail)

Without this, Gmail still works with an app password. Set it up if you'd rather click *Sign in with Google*.

1. Go to <https://console.cloud.google.com> and create a project (for example "Mailtabs").
2. *APIs & Services → Library* → enable **Gmail API**.
3. Menu → **Google Auth platform** → *Branding* → *Get started*. Enter an app name and your email,
   choose **External** as the audience (or *Internal* if this is your company's Google Workspace),
   then finish.
4. *Branding → Authorized domains*: add your site's domain (for example `example.com`). Skip this for `localhost`.
5. *Data Access → Add or remove scopes*: add `https://mail.google.com/`, `openid`, `.../auth/userinfo.email`
   and `.../auth/userinfo.profile`. Save. Gmail's scope shows up as *restricted*, which is expected.
6. *Audience*: choose one:
   - **Testing.** Add each Gmail address under *Test users* (up to 100). ⚠️ In Testing mode Google
     **expires the access every 7 days**, so each account must click *Reconnect* weekly.
   - **Publish app** ("In production") without verification. For personal use with fewer than 100 users
     this avoids the 7-day expiry. Each user clicks through a "Google hasn't verified this app" warning
     once. Opening the site to the public would require Google's verification and a yearly security
     assessment.
7. *Clients → Create client* → **Web application** → *Authorized redirect URIs* → add exactly:
   `<APP_URL>/api/oauth/google/callback` (for example `https://mail.example.com/api/oauth/google/callback`,
   or `http://localhost:3000/api/oauth/google/callback` locally).
8. Copy the **Client ID** and **Client secret** right away; Google shows the secret only once. Put them in `.env`:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
   Restart Mailtabs. On startup it prints the exact redirect URI it expects.

Good to know: Google rejects redirect URIs that use plain `http://` (except `localhost`), a raw IP
address, or a made-up domain like `.lan`. Google deletes OAuth clients that go unused for 6 months.
Company Google Workspace accounts may need their admin to allow IMAP and this app.

## 6. Optional: "Sign in with Microsoft" (Outlook, Hotmail, Microsoft 365)

This is the **only** way to connect Microsoft mail accounts.

1. Sign in to the Microsoft Entra admin center: <https://entra.microsoft.com> (a free Azure account works).
2. *Entra ID → App registrations → New registration*.
   - Name: `Mailtabs`
   - Supported account types: **Any Entra ID Tenant + Personal Microsoft accounts**. This covers
     Outlook.com/Hotmail and work accounts and goes with `MICROSOFT_TENANT=common`.
   - Redirect URI: platform **Web** (not "Single-page application"), value
     `<APP_URL>/api/oauth/microsoft/callback`
3. Copy the **Application (client) ID** from *Overview* into `MICROSOFT_CLIENT_ID`.
4. *Certificates & secrets → New client secret*. Copy the **Value** (not the Secret ID) into
   `MICROSOFT_CLIENT_SECRET`. Secrets expire after at most 24 months, so set a reminder to replace it.
   Otherwise every Outlook account stops syncing on that day.
5. *API permissions → Add a permission → Microsoft Graph → Delegated permissions* → tick
   **IMAP.AccessAsUser.All**, **SMTP.Send**, **Mail.Send**, **offline_access**, **openid**, **email**,
   **profile** → *Add permissions*. (*SMTP.Send* lets Mailtabs send over SMTP; *Mail.Send* is the
   fallback for mailboxes where Microsoft has turned SMTP off.)
6. Restart Mailtabs.

Each Outlook.com user must also turn on **Settings → Mail → Forwarding and IMAP → "Let devices and apps
use IMAP"** (it's off by default). Work/school tenants may need an admin to grant consent or enable IMAP
for the mailbox. Organisations that only allow admin-approved apps must approve all the permissions
above, including *Mail.Send*; otherwise sign-in shows "Need admin approval".

If you set this up before Mailtabs could send mail, add the two new permissions above and have each
Outlook user click *Reconnect* on their account once.

## 7. Deploying it to the internet

Mailtabs is a normal Node app: start command `npm start`, and it listens on `PORT`. Any host that runs
Node with a **persistent disk** works: Render, Railway, Fly.io, a VPS, and so on.

> This repository also contains another app at its root. If your host deploys from this repo, set the
> service's **root directory** to `mailtabs`.

Checklist:

1. **Persistent storage.** Mount a disk/volume and point `DATA_DIR` at it. The database lives there.
   Hosts that wipe the filesystem on every deploy will lose your mail cache and connected accounts.
2. **`SECRET_KEY`**: set a long random value in the host's environment, for example from `openssl rand -hex 32`.
   It encrypts the stored passwords and tokens. If you lose it, every account has to be reconnected.
3. **`APP_URL`**: the exact `https://` address people use. Cookies become `Secure` automatically, and
   Google/Microsoft redirect back to this address.
4. **`TRUST_PROXY=1`** if the host puts a proxy or load balancer in front (most do). Without it, rate
   limits treat all visitors as one.
5. After creating your own login, set **`ALLOW_SIGNUPS=false`** so strangers can't create accounts on your server.
6. Run **one** instance. The background sync, the outbox (undo send and scheduled send) and the rate
   limits live in that one process. Keep it running: scheduled messages are sent by the server.

## 8. Configuration reference

All settings are environment variables (or lines in `.env`). See `.env.example` for a commented template.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port to listen on. |
| `APP_URL` | `http://localhost:PORT` | Public address, used for OAuth redirects and secure cookies. |
| `DATA_DIR` | `./data` | Where the SQLite database (and the generated secret key, if any) live. |
| `SECRET_KEY` | generated into `DATA_DIR/.secret-key` | Encrypts connected-account credentials. Set it explicitly in production. |
| `ALLOW_SIGNUPS` | `true` | Whether new people may sign up. The first user always can. |
| `SYNC_INTERVAL_MINUTES` | `3` | How often each account is checked for new mail. |
| `INITIAL_SYNC_LIMIT` | `200` | How many recent messages to download when an account is first connected. |
| `MAX_BODY_BYTES` | `5000000` | Bigger messages are downloaded only when you open them. |
| `SYNC_CONCURRENCY` | `4` | How many accounts sync at the same time. |
| `ALLOW_PRIVATE_IMAP_HOSTS` | `false` | Allow IMAP and SMTP servers on localhost/private networks, and unencrypted connections. Keep `false` on shared servers. |
| `TRUST_PROXY` | `false` | Number of reverse proxies in front of Mailtabs (`true` = 1). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Enables *Sign in with Google*. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | – | Enables *Sign in with Microsoft*. |
| `MICROSOFT_TENANT` | `common` | `common` (personal + work), `consumers` (personal only), or your tenant ID. |

## 9. How it works and how your data is protected

- **Sync.** Every few minutes the server connects to each account over IMAP, asks which folders
  changed, and downloads new messages, read/star changes and deletions only for those (so a quiet
  account costs one short connection). The Inbox is always checked. A first sync fetches the newest
  `INITIAL_SYNC_LIMIT` inbox messages and the newest 50 of every other folder; *Load older messages*
  fetches more. Gmail's huge *All Mail* and *Important* views are only synced while you look at them.
  Opening a folder or clicking refresh checks right away.
- **Sending** goes through each provider's own SMTP server (or Microsoft Graph, see above), signed in
  with the account's own credentials. Messages wait in a server-side outbox that survives restarts.
  (If the server is killed in the very second a message is being handed to the provider, that one
  message is sent again after the restart, rather than lost.)
- **Outgoing HTML** (what you type, signatures, quoted replies) is cleaned to a safe subset before it is
  sent. Attachments you upload are kept only until the message is sent or discarded (at most a day).
- **Credentials** are encrypted at rest with AES-256-GCM using `SECRET_KEY`. They are never sent to the
  browser.
- **Email content** is sanitised on the server and shown in a sandboxed frame that can't run scripts,
  under a strict Content-Security-Policy. **Remote images are blocked** until you click *Show images*,
  which stops tracking pixels. Links open in a new tab.
- **Your login**: passwords are hashed with scrypt. Sessions are random tokens in `HttpOnly`, `SameSite`
  cookies, stored only as hashes. Every change request needs an anti-CSRF header, and sign-in attempts are
  rate-limited.
- **Server safety**: on a shared server, users can't point an "Other (IMAP)" account or its SMTP server
  at your private network (unless you set `ALLOW_PRIVATE_IMAP_HOSTS`). Sending is rate-limited per user.
- Removing an account in Mailtabs deletes only Mailtabs' copy. Your mail stays with your provider.

## 10. Limitations

- **Not included:** calendar, contacts sync, server-side filters/rules, vacation auto-reply, snooze,
  read receipts, and sending from aliases (you send as the account's own address). Use your
  provider's website for those.
- **Notifications** need an open Mailtabs tab; there are no push notifications to a closed browser.
- **Undo for moves** needs the mail server to report the moved messages' new IDs (the IMAP *UIDPLUS*
  feature, which most big providers support). On servers that don't, Undo isn't offered for moves.
- **Gmail**: when Mailtabs replaces a draft, some Gmail settings keep the old copy in Trash for 30 days.
- **Some Outlook.com mailboxes** can't send over SMTP at all; Mailtabs uses Microsoft Graph for
  those, which is limited to messages of about 3.5 MB.
- **Single process.** Run one instance, not a cluster.
- Rules that ignore upper/lower case do so for plain A–Z letters. Search ignores case and accents for all languages.

## 11. Development and tests

```bash
npm test
```

The tests use Node's built-in test runner. The mail tests need a local IMAP server at
`127.0.0.1:1143` (plain, no TLS) with test users `alice`, `bob`, `v2`, `f1`, `f2`, `s1`, `s2`, `r1`
and `r2` at `@test.local`, each with the password `<name>pw` (for example `alice@test.local` /
`alicepw`). Dovecot works well; without it those tests are skipped. Sending is tested against an
SMTP server the tests start themselves. Project layout:

```
server.js            entry point
src/
  app.js             Express app: headers, sessions, CSRF, routes
  routes/            auth, accounts, tabs, messages, folders, compose, settings, oauth
  sync.js folders.js background IMAP sync of every folder (imapflow)
  actions.js         flags, moves, folder create/rename/delete on the server
  smtp.js compose.js sending, building replies/forwards, outgoing HTML
  outbox.js drafts.js undo/scheduled send, drafts in the Drafts folder
  uploads.js         attachments waiting to be sent
  imap.js oauth.js   connections and Google/Microsoft sign-in
  mailparse.js       MIME parsing + HTML sanitising
  queries.js         tab filters, views, threads, search, pagination
  db.js crypto.js    SQLite schema, encryption, password hashing
public/              the web app (Preact + htm, no build step; the composer is in public/js/compose)
test/                node:test suites
```
