# Mailtabs public demo kit

A live, shared demo of **Mailtabs** (self-hosted unified mail client with user-designed tabs) for
`mail-demo.evosoft.solutions`. Mailtabs has no demo mode, so this kit gives it something real to talk to:
a sandboxed demo mail server with four fictional mailboxes full of seeded mail, an outgoing-mail "sink"
that only delivers between those mailboxes, and a reverse proxy. Everything is wiped and reseeded on a
schedule.

```
 internet ──HTTPS──> caddy ─┐  (edge network: internet)
                            │
          ┌─────────────────┴───── demo network (internal: true, no route out) ───────────┐
          │  mailtabs :3301 ──IMAP──> dovecot :3343   (alias imap.demo.test)              │
          │                 └─SMTP──> smtp-sink :3325 (alias smtp.demo.test) ─APPEND─> dovecot │
          └────────────────────────────────────────────────────────────────────────────────┘
```

## For visitors

| | |
|---|---|
| **Mailtabs sign-in** | `demo@mailtabs.demo.test` / `mailtabs-demo` |
| Already connected | Work `alex@work.demo.test` (blue), Personal `alex.personal@demo.test` (green), Tidepool side project `alex@sideproject.demo.test` (amber) |
| Tabs | Work, Personal (no newsletters), Side project, **Receipts** (all accounts, subject contains receipt / order / invoice), **Newsletters** (all accounts, body contains "unsubscribe") |
| **Mailbox to add yourself** | `alex@runclub.demo.test`, password `mailtabs-demo` |
| "Add account" settings | **Other (IMAP)** → Advanced settings: IMAP server `imap.demo.test`, port `3343`, security **None**; SMTP server `smtp.demo.test`, port `3325`, security **None**; username = the full address, same password |

`imap.demo.test` / `smtp.demo.test` only exist inside the demo's private network: they work from the
demo's own "Add account" dialog, not from a visitor's phone or desktop mail app.

Things to try:

1. Click **Receipts**: one rule-based tab pulls orders and invoices out of three different mailboxes. Open its ⋯ → *Edit tab* to see (and change) the rules.
2. Open **Re: Homepage refresh: Q4 launch plan** (Work) for the conversation view, including your own reply from Sent and an attachment.
3. **Compose** from the Tidepool account to `alex.personal@demo.test`: watch the 10-second *Undo send*, then find it in the Personal tab a moment later. Replies to the fictional colleagues are accepted too; real-world addresses are refused and stay in the Outbox with the reason.
4. Tick a few messages for the bulk bar, archive one and press **Undo** (or `z`), or search for "contrast".
5. **Add account** → Other (IMAP) with the run-club mailbox above, give it a colour and a tab.

The demo resets every hour (fresh mail, dates relative to "now"); everyone shares the one login, so
other visitors' changes show up until the next reset.

## Hosting it (VPS with Docker)

1. A small VPS (1 vCPU / 1 GB RAM is plenty) with Docker Engine + the Compose plugin. Point the DNS
   record `mail-demo.evosoft.solutions` at it and open ports 80 and 443.
2. Copy this folder to the server, e.g. `/opt/mailtabs-demo`, and copy the Mailtabs source (the folder
   with `package.json`, `server.js`, `src/`, `public/`) into `/opt/mailtabs-demo/mailtabs-src/`.
3. `cp .env.example .env` and fill in `DEMO_HOSTNAME`, `ACME_EMAIL` and `SECRET_KEY` (`openssl rand -hex 32`).
4. `./reset-demo.sh` builds the images, starts everything and seeds the demo (first start and every reset are the same).
5. Reset hourly from the host's crontab: `7 * * * * cd /opt/mailtabs-demo && ./reset-demo.sh >> reset.log 2>&1`

Caddy gets the Let's Encrypt certificate by itself. During a reset (a few seconds to a minute,
mostly image checks) the site answers HTTP 503 "being reset", so nobody can reach the empty Mailtabs
and sign up as its first user before the seeder does.

## Files

| File | What it is |
|---|---|
| `docker-compose.yml` | caddy (edge + demo networks), mailtabs / dovecot / smtp-sink (demo network only, `internal: true`), one-shot `seed` service |
| `Caddyfile` | TLS, maintenance switch, shared-login protections, upload size cap, reverse proxy |
| `docker/mailtabs.Dockerfile` | Builds Mailtabs from `mailtabs-src/` (Node 22, `npm ci --omit=dev`, runs as `node`) |
| `dovecot/dovecot.conf`, `dovecot/demo-users`, `dovecot/Dockerfile` | Demo IMAP server: Dovecot 2.3 (Ubuntu 24.04 package), the four mailboxes, 100 MB quota each |
| `tools/smtp-sink.js` | Outgoing server that never relays: AUTH required, sender must be the signed-in mailbox, non-`demo.test` recipients refused (550), demo mailboxes get the mail via IMAP APPEND, fictional `*.demo.test` people accepted and discarded, 10 MB / 20 recipients / 30 messages per minute caps |
| `tools/seed-mail.js`, `tools/lib/mail-content.js`, `tools/lib/attachments.js` | Seeds 58 messages: a 5-message work thread with a Sent reply, a calendar invite (.ics), receipts with HTML layouts, newsletters (one with a blocked tracking pixel), PDF and PNG attachments generated in code, starred/unread mail, Sent, Drafts, Archive, Junk and custom folders (`Clients/Saltmarsh`, `Feedback`). `--wipe` empties existing mailboxes first; `DEMO_NOW=…` pins the clock (used for the marketing screenshots) |
| `tools/seed-demo.js` | Sets up Mailtabs only through its public HTTP API, like the web app: demo login, three "Other (IMAP)" accounts with names, colours, sender names and signatures, five tabs with rules, undo-send 10 s; waits for the first sync; checks sign-ups are closed. Safe to re-run |
| `reset-demo.sh` | Maintenance on → remove mailtabs/dovecot/sink containers and both data volumes → start dovecot + sink → seed mail → start Mailtabs → seed Mailtabs → maintenance off |

All people, companies and domains in the seed mail are invented and use the reserved `.test` TLD;
no real brands or logos.

## Safety design (one shared login, open to the public)

1. **No internet for Mailtabs.** Mailtabs, Dovecot and the sink sit only on the `internal: true`
   network. A visitor who tries "Add account" with Gmail, any IMAP host or a raw IP gets an immediate
   error ("Could not find the mail server…" / "the network is unreachable"), so no real mailbox can be
   connected and nothing can be sent to the real world. Only Caddy is on both networks.
2. **Outgoing mail never leaves.** The sink has no relay code at all; see the table above.
3. **Caddy rules for the shared login:** changing the login password (`POST /api/auth/password`) and
   deleting the seeded accounts (ids 1–3) or seeded tabs (ids 1–5) are refused with a message Mailtabs
   shows in its UI; `/api/oauth/*` is blocked; uploads are capped at 12 MB. The seeder warns if a fresh
   database ever gives different ids.
4. **Mailtabs settings:** `ALLOW_SIGNUPS=false` (the seeder is the first user, which Mailtabs always
   allows), Google/Microsoft sign-in left unset, `TRUST_PROXY=1` so rate limits see real client IPs.
5. **Dovecot:** only the four demo users exist, 100 MB quota per mailbox; containers have memory limits.
6. **Hourly reset** wipes both volumes, so anything a visitor changed or sent is gone within the hour.

**Why the network isolation is essential:** the plaintext demo mail server needs
`ALLOW_PRIVATE_IMAP_HOSTS=true`, and that flag turns off *all* of Mailtabs' own outbound checks: it
skips the SSRF guard entirely (no DNS check, no private-address check, any host and any port) and
allows unencrypted IMAP/SMTP. Mailtabs has **no host allowlist**, so the Docker network is the only
thing keeping it in the sandbox.

### Not enforceable without a code change

- **Host allowlist** (recommended second layer). Minimal patch, not applied: add
  `mailHostAllowlist` to `src/config.js` from a comma-separated `MAIL_HOST_ALLOWLIST` env var; give
  `netguard.assertAllowedHost(host, { allowPrivate, allowlist })` a check right after `normalizeHost()`
  that throws `HttpError(400, …, 'HOST_NOT_ALLOWED')` when the list is non-empty and the host isn't in
  it (before the `allowPrivate` early return); pass `allowlist: config.mailHostAllowlist` at the two call
  sites that every IMAP and SMTP connection goes through (`src/imap.js` `buildConnectionOptions`,
  `src/smtp.js` `connectionOptions`). About ten lines; the demo would set
  `MAIL_HOST_ALLOWLIST=imap.demo.test,smtp.demo.test`.
- A "demo/read-only" switch: visitors can still rename/recolour the seeded accounts and tabs, edit tab
  rules and signatures, delete or move mail, empty Trash, delete folders, change the undo-send delay,
  and send unpleasant text to the demo mailboxes. Everyone sees that until the next reset.
- The proxy rules match by id/path; they're a convenience, not a security boundary.

### Hardening on the VPS

On an `internal` network containers still reach the host itself through the bridge address. Make sure
nothing private listens on all interfaces, or drop that traffic at the host (the subnet is fixed in
`docker-compose.yml`): `iptables -I INPUT -s 172.31.250.0/24 -j DROP` (persist it with your
distribution's firewall tool). Traffic between the containers is bridged and unaffected.

## What was tested locally, and what wasn't

The build machine had no Docker daemon, so the kit was exercised piece by piece on Ubuntu 24.04 with
Node 22:

| Tested locally | How |
|---|---|
| `dovecot/dovecot.conf` + `demo-users` | Dovecot 2.3.21 (the Ubuntu 24.04 package the Dockerfile installs), same file with paths rewritten by `sed`, on 127.0.0.1:3343 |
| `tools/smtp-sink.js` | Bad password (535), spoofed sender (553), real-world recipient (550), mixed recipients (partial), fictional `*.demo.test` (accepted, discarded), demo mailbox (delivered) |
| `tools/seed-mail.js` | On empty maildirs (like fresh volumes) and with `--wipe`; 58 messages |
| `tools/seed-demo.js` | Against fresh Mailtabs on port 3301 with `ALLOW_SIGNUPS=false`, re-run on a seeded one, and against Mailtabs with the production settings (`APP_URL=https://…`, `TRUST_PROXY=1`) over plain HTTP as the `seed` container does |
| Mailtabs through the real UI (Playwright) | Sign-in, sync, tab filtering, conversation view, compose + send to another demo mailbox and see it arrive, undo-send toast, archive + Undo, search, external recipient refused (Outbox "Not sent"), visitor "Add account" with the run-club mailbox |
| No-egress behaviour | Mailtabs in a Linux network namespace with only loopback: Gmail / IMAP-by-name / IMAP-by-IP account adds all fail fast with clear errors |
| `Caddyfile` | `caddy validate` + running it with Ubuntu's Caddy 2.6.2 in front of Mailtabs: maintenance 503, password change / seeded account / seeded tab / OAuth refused (and the UI shows the message), other requests pass, 13 MB upload refused (2.6.2 answers 502) |
| Reset sequence | Same steps as `reset-demo.sh` without Docker: about 6 s for wipe + seed |
| Images' `npm ci --omit=dev` | Both lockfiles install cleanly; Mailtabs loads without its devDependencies |

**Not tested:** building and running the Docker images, the compose networks (that `internal: true`
really blocks egress on your Docker version, the `imap.demo.test` / `smtp.demo.test` aliases), named
volumes and the `chown` of `/srv/mail`, healthchecks, `reset-demo.sh` itself (only `bash -n` and
`docker compose config`), Caddy 2.9.1 (the image tag) and Let's Encrypt. After the first deploy, check
egress from inside the Mailtabs container, e.g.
`docker compose exec mailtabs node -e "fetch('https://example.com').then(()=>console.log('EGRESS OPEN'),e=>console.log('blocked:',e.cause&&e.cause.code))"`
should print `blocked: …`.

Image tags: `caddy:2.9.1`, `ubuntu:24.04`, `node:22-bookworm-slim` (major-pinned so it picks up Node
security fixes; pin a digest if you want byte-for-byte rebuilds).
