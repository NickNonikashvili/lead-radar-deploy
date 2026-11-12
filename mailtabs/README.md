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

What you can do with a message: read it, star it, mark it read or unread, archive it, delete it, open
attachments, and search. These changes go back to your real mailbox, so Gmail or Outlook shows the same
state. Mailtabs reads the **Inbox** folder of each account. It doesn't send mail yet (see *Limitations*).

---

## Contents

1. [Run it on your computer](#1-run-it-on-your-computer)
2. [Connecting your email accounts](#2-connecting-your-email-accounts)
3. [Optional: "Sign in with Google" (Gmail)](#3-optional-sign-in-with-google-gmail)
4. [Optional: "Sign in with Microsoft" (Outlook, Hotmail, Microsoft 365)](#4-optional-sign-in-with-microsoft-outlook-hotmail-microsoft-365)
5. [Deploying it to the internet](#5-deploying-it-to-the-internet)
6. [Configuration reference](#6-configuration-reference)
7. [How it works and how your data is protected](#7-how-it-works-and-how-your-data-is-protected)
8. [Limitations](#8-limitations)
9. [Development and tests](#9-development-and-tests)

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
  (sections [3](#3-optional-sign-in-with-google-gmail) and [4](#4-optional-sign-in-with-microsoft-outlook-hotmail-microsoft-365)).
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
| **Anything else** | *Other (IMAP)* | Enter your provider's IMAP server, port (usually 993) and security (usually SSL/TLS). Your provider's help pages list them as "IMAP settings". |

While adding an account you can give it a name ("Work"), pick a colour, and attach it to tabs, or
create a tab for it on the spot. You can change all of that later in **Settings**.

## 3. Optional: "Sign in with Google" (Gmail)

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

## 4. Optional: "Sign in with Microsoft" (Outlook, Hotmail, Microsoft 365)

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
   **IMAP.AccessAsUser.All**, **offline_access**, **openid**, **email**, **profile** → *Add permissions*.
6. Restart Mailtabs.

Each Outlook.com user must also turn on **Settings → Mail → Forwarding and IMAP → "Let devices and apps
use IMAP"** (it's off by default). Work/school tenants may need an admin to grant consent or enable IMAP
for the mailbox.

## 5. Deploying it to the internet

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
6. Run **one** instance. The background sync and the rate limits live in that one process.

## 6. Configuration reference

All settings are environment variables (or lines in `.env`). See `.env.example` for a commented template.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port to listen on. |
| `APP_URL` | `http://localhost:PORT` | Public address, used for OAuth redirects and secure cookies. |
| `DATA_DIR` | `./data` | Where the SQLite database (and the generated secret key, if any) live. |
| `SECRET_KEY` | generated into `DATA_DIR/.secret-key` | Encrypts connected-account credentials. Set it explicitly in production. |
| `ALLOW_SIGNUPS` | `true` | Whether new people may sign up. The first user always can. |
| `SYNC_INTERVAL_MINUTES` | `3` | How often each inbox is checked for new mail. |
| `INITIAL_SYNC_LIMIT` | `200` | How many recent messages to download when an account is first connected. |
| `MAX_BODY_BYTES` | `5000000` | Bigger messages are downloaded only when you open them. |
| `SYNC_CONCURRENCY` | `4` | How many accounts sync at the same time. |
| `ALLOW_PRIVATE_IMAP_HOSTS` | `false` | Allow IMAP servers on localhost/private networks and unencrypted IMAP. Keep `false` on shared servers. |
| `TRUST_PROXY` | `false` | `true` or a number of proxy hops when behind a reverse proxy. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Enables *Sign in with Google*. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | – | Enables *Sign in with Microsoft*. |
| `MICROSOFT_TENANT` | `common` | `common` (personal + work), `consumers` (personal only), or your tenant ID. |

## 7. How it works and how your data is protected

- **Sync.** Every few minutes the server connects to each account over IMAP, downloads new Inbox
  messages, refreshes read and star flags, and drops messages that left the Inbox elsewhere (for example,
  archived on your phone). The first sync fetches the newest `INITIAL_SYNC_LIMIT` messages. The refresh
  button checks right away.
- **Credentials** are encrypted at rest with AES-256-GCM using `SECRET_KEY`. They are never sent to the
  browser.
- **Email content** is sanitised on the server and shown in a sandboxed frame that can't run scripts,
  under a strict Content-Security-Policy. **Remote images are blocked** until you click *Show images*,
  which stops tracking pixels. Links open in a new tab.
- **Your login**: passwords are hashed with scrypt. Sessions are random tokens in `HttpOnly`, `SameSite`
  cookies, stored only as hashes. Every change request needs an anti-CSRF header, and sign-in attempts are
  rate-limited.
- **Server safety**: on a shared server, users can't point an "Other (IMAP)" account at your private
  network (unless you set `ALLOW_PRIVATE_IMAP_HOSTS`).
- Removing an account in Mailtabs deletes only Mailtabs' copy. Your mail stays with your provider.

## 8. Limitations

- **Reading only.** There is no compose or reply yet. Replies open in your normal mail app via the sender's address.
- **Inbox only.** Other folders and labels aren't synced.
- **Single process.** Run one instance, not a cluster.
- Rules that ignore upper/lower case do so for plain A–Z letters. Search ignores case and accents for all languages.

## 9. Development and tests

```bash
npm test
```

The tests use Node's built-in test runner. The mail-sync tests need a local IMAP server at
`127.0.0.1:1143` with test users `alice@test.local` / `alicepw` and `bob@test.local` / `bobpw` (Dovecot
works well); without it they are skipped. Project layout:

```
server.js            entry point
src/
  app.js             Express app: headers, sessions, CSRF, routes
  routes/            auth, accounts, tabs, messages, oauth
  sync.js            background IMAP sync (imapflow)
  imap.js oauth.js   connections and Google/Microsoft sign-in
  mailparse.js       MIME parsing + HTML sanitising
  queries.js         tab filters, search, pagination
  db.js crypto.js    SQLite schema, encryption, password hashing
public/              the web app (Preact + htm, no build step)
test/                node:test suites
```
