# Live demo kits

One folder per product. Each sets up a public, self-resetting demo with the exact accounts listed on
`evosoft.solutions/demos.html`. None of them changes the product's code.

| Product | Demo address | Host | Resets | Kit |
|---|---|---|---|---|
| Evo | `evo-demo.evosoft.solutions` | Linux VPS with Node.js 24 LTS (22.13+ works) + Caddy | every 3 hours | [`evo/`](evo/README.md) |
| Mailtabs | `mail-demo.evosoft.solutions` | Linux VPS with Docker Compose | every hour | [`mailtabs/`](mailtabs/README.md) |
| StudyCat | `studycat-demo.evosoft.solutions` | Hostinger (PHP 8.1+), a separate subdomain from studycat.org | nightly, repair every 10 min | [`studycat/`](studycat/README.md) |

Both the Evo and Mailtabs kits put Caddy on ports 80/443. To run both on one server, give them a single shared
reverse proxy instead (route `evo-demo.` to Evo on 127.0.0.1:3101 and `mail-demo.` to the Mailtabs stack).

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
  inside the demo.

## Things to know before going public

- All demo logins are shared. Visitors see each other's changes until the next reset.
- Evo has no read-only mode. A visitor could set up two-step sign-in or change a password on a shared account and
  lock others out until the next reset. The site asks people not to.
- Mailtabs relies on the Docker `internal` network to keep the demo off the real internet. A ~10-line host
  allowlist patch is described in `mailtabs/README.md` as a second layer.
- StudyCat's content is the real Fall 2026 Montana State course data, so after December 2026 the classes show as
  finished. Each kit's README has the details and the fixes.
