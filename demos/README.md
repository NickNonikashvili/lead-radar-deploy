# Live demo kits

One folder per product. Each sets up a public, self-resetting demo with the exact accounts listed on
`evosoft.solutions/demos`. None of them changes the product's code.

| Product | Demo address | Host | Resets | Kit |
|---|---|---|---|---|
| Evo | `evo-demo.evosoft.solutions` | Linux VPS with Node.js 24 LTS (22.13+ works) + Caddy | every 3 hours | [`evo/`](evo/README.md) |
| Mailtabs | `mail-demo.evosoft.solutions` | Linux VPS with Docker Compose | every hour | [`mailtabs/`](mailtabs/README.md) |
| StudyCat | `studycat-demo.evosoft.solutions` | The same Linux VPS with PHP 8.3-FPM + Caddy (recommended), or Hostinger (PHP 8.1+) as a separate subdomain from studycat.org | nightly, repair every 10 min | [`studycat/`](studycat/README.md) |

**One server for all three:** `one-server/` installs Evo, Mailtabs and StudyCat on a single Ubuntu 24.04 server with
one command (`one-server/setup-server.sh`; StudyCat when its `calc1-deploy-….zip` is in `apps/`). The server's own
Caddy takes HTTPS for all of them; the Mailtabs stack's Caddy listens only on `127.0.0.1:8081` behind it, and StudyCat
runs on its own PHP-FPM pool, with its `.htaccess` rules written out for Caddy in `one-server/studycat-demo.caddy`.
`one-server/README.md` is the full step-by-step guide, including the website and, as the alternative, the StudyCat
demo on Hostinger.

## Accounts at a glance

| Product | Sign in with | Password |
|---|---|---|
| Evo | `hr@evo.test` (owner), `grace.liu@evo.test` (HR), `payroll@evo.test`, `employee@evo.test`, `omar.haddad@evo.test` (store manager), `jordan.lee@evo.test` (supervisor), `marcus.johnson@evo.test` (warehouse) | `demo1234` (register / handheld PIN `1234`) |
| Mailtabs | `demo@mailtabs.demo.test`; mailbox to add yourself: `alex@runclub.demo.test` | `mailtabs-demo` |
| StudyCat | `student@`, `max@`, `classmate@`, `moderator@`, `admin@`, `instructor@studycat.test` | `demo-study-2026` |

## What was tested

- **Evo:** the release ran with demo data. All 7 accounts and every register and handheld ID were checked, a full
  register sale was rung with an override, and the reset script ran against a live copy.
- **Mailtabs:** ran against a real Dovecot with seeded mailboxes, plus the SMTP sink, the seeders and Caddy, all
  checked with no internet access. The Docker Compose stack itself could not be run in the build environment; its
  README says what to check after the first deploy.
- **StudyCat:** ran under PHP 8.3 with the demo config. All 6 accounts were checked through the real login form. The
  seed/reset ran twice in a row with identical results, and mail, AI and payment settings can't be switched on from
  inside the demo. On the one-server setup, the script's StudyCat step and `studycat-demo.caddy` ran with Caddy 2.6.2
  and PHP-FPM 8.3 (details in `one-server/README.md`, "What's been tested").

## Copyright notice

Every demo shows a small card on every page: **"© 2026 EvoSoft Solutions. All rights reserved."** and
**"{Product} demo · fictional data · evosoft.solutions"**, with a close button that hides it until the visitor's next
browser session. The shared files are in [`_branding/`](_branding/README.md) (one stylesheet, one script, and a helper
that adds the two tags to a page); each kit puts them on its pages without changing the product's code:

| Product | How | Re-applied |
|---|---|---|
| Evo | `evo/brand-evo.sh` writes copies of Evo's 4 HTML entry pages with the tags, outside the release; Caddy sends the copy as the body of those pages and keeps all of Evo's headers (CSP, Trusted Types, HSTS…). The release stays byte-for-byte as signed, so Evo's code check still passes. | before every Evo start and in every reset |
| Mailtabs | `mailtabs/docker/brand-mailtabs.sh` runs in the image build on the image's copy of the source (`public/__evosoft/` + one line in `public/index.html`). | every reset (it rebuilds the image) |
| StudyCat | `php api/demo-seed.php --brand`: `__evosoft/` + one line in `index.html` and every study guide; the site banner also ends with the copyright line. | every nightly reset |

The files are served from each demo's own address, so no Content-Security-Policy had to change. Placement is chosen per
app and screen size so the card doesn't cover the app's own controls (Evo's top bar / above its phone tab bar, the
register's top bar; Mailtabs bottom right, left of the Compose button on phones; StudyCat next to Bo's button). Details
and test notes in each kit's README, section "Copyright notice".

## Things to know before going public

- All demo logins are shared. Visitors see each other's changes until the next reset.
- Evo has no read-only mode. A visitor could set up two-step sign-in or change a password on a shared account and
  lock others out until the next reset. The site asks people not to.
- Mailtabs relies on the Docker `internal` network to keep the demo off the real internet. A ~10-line host
  allowlist patch is described in `mailtabs/README.md` as a second layer.
- StudyCat's content is the real Fall 2026 Montana State course data, so after December 2026 the classes show as
  finished. Each kit's README has the details and the fixes.
