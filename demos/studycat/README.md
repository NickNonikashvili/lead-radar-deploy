# StudyCat public demo kit

A separate, throw-away copy of StudyCat for the EvoSoft portfolio, at e.g.
`https://studycat-demo.evosoft.solutions`. Visitors sign in with shared demo accounts; nothing they do can send
email, spend money on AI or payments, or touch the real site (studycat.org). The whole demo goes back to its
starting point every night.

| File | Goes to (in the demo copy) | What it does |
| --- | --- | --- |
| `config.local.php` | `api/config.local.php` | Demo settings: only `@studycat.test` addresses, mail in `log` mode, no AI/RevenueCat keys, dead AI/payment endpoints, a separate `studycat-demo.sqlite` database, demo staff and the Max tester plan. |
| `demo-seed.php` | `api/demo-seed.php` | Command line only. Wipes and rebuilds the demo (accounts, discussions, report queue, a published StudyCat Faculty class with students, practice history), or with `--repair` only puts the demo accounts back, or with `--brand` only adds the copyright notice. It refuses to run against anything that is not the demo config, so it cannot wipe production. |
| `../_branding/evosoft-notice.css`, `../_branding/evosoft-notice.js` | `api/` (next to `demo-seed.php`) | The EvoSoft copyright notice. `demo-seed.php` copies them to `__evosoft/` and adds them to the demo's pages (see "Copyright notice"). |
| `robots.txt` | `robots.txt` (replace the site's) | Keeps the demo out of search results (it duplicates studycat.org's pages). |

No StudyCat code is changed. Every file above is either new or is a file StudyCat itself loads (`config.local.php`); the
copyright notice adds one line to the demo copy's `index.html` and study guide pages (not to StudyCat's source).

## Demo accounts

Password for every account: **`demo-study-2026`**. `studycat.test` is a reserved, undeliverable domain (RFC 2606), so no
real person can be emailed or impersonated.

| Email | Role | What to try |
| --- | --- | --- |
| `student@studycat.test` (Alex Rivera) | Student, Free plan | Calc I dashboard (exam countdown, readiness, "the summit" learning path); Practice (Quizzer) with worked answers; Flashcards; Notes; Precalc Unit circle and Physics Projectile simulator; Discussions; the instructor's class at `#/class` (assignments, announcements, office hours). |
| `max@studycat.test` (Jordan Lee) | Student with **StudyCat Max** (given via `plan_grants`) | Same as the student, plus the Max-only areas (Bo, the class maker); the plan shows as "Max · tester" in the admin panel. Bo answers "isn't switched on yet" because no AI key is set. |
| `classmate@studycat.test` (Riley Chen) | Student, Free plan | A second student (author of the reported posts in the moderator queue). |
| `moderator@studycat.test` (Sam Patel) | Moderator, and TA of the Faculty class | Report queue at `#/forum/reports` (Remove / Ban / Dismiss with Undo); pin, lock or remove posts; sees real authors of anonymous posts. |
| `admin@studycat.test` (Taylor Brooks) | Administrator | Admin panel `#/admin`: Overview, Members (plans, ban, delete, add a member), Instructors, Reports, Site settings, Backups. Keys & settings are read-only in the demo (see Lockdown). |
| `instructor@studycat.test` (Dr. Casey Morgan) | Confirmed instructor (StudyCat Faculty) | `#/teach`: the published "M 171 Calculus I (demo section)" syllabus editor with live preview, students and roster, announcements, practice assignments and results, attendance, office hours, Share with students (join code `MATH26`). |

Signed out, a visitor gets StudyCat's own preview: every class page and dashboard, the first three topics of notes,
3 questions per quiz set, 5 flashcards per deck, discussion titles only; the class tools ask for an account.

## Put it on the EvoSoft demo server (recommended)

`../one-server/setup-server.sh` does all of the Hostinger steps below by itself when StudyCat's deploy zip (`calc1-deploy-<build>.zip`)
is in the bundle's `apps/` folder (`../one-server/README.md`, Parts 2 and 3). It installs PHP 8.3 (FPM, with SQLite,
mbstring, curl, gd, zip, xml), unpacks the site into `/var/www/studycat-demo` (owned by root, read-only for PHP), adds
the files above plus `api/demo-data-path.php`, so the database lives in `/var/lib/studycat-demo` outside the web root
(`api/data`, where StudyCat keeps `mail.log` and Bo's files, is a link into that folder too), adds the copyright
notice, runs the seed once as the PHP user `studycat-demo`, and installs both cron jobs below as that user
(`/etc/cron.d/studycat-demo`). Caddy serves it with `../one-server/studycat-demo.caddy`: Caddy doesn't read `.htaccess`
files, so that file writes out every rule StudyCat's `.htaccess` files give on Apache (only `api/index.php` runs;
config, database, logs, hidden and build files are refused; the same security and caching headers), plus
`X-Robots-Tag: noindex`. Running the setup again replaces the program files and keeps the database.

## Put it on Hostinger (the alternative)

1. **Subdomain.** hPanel → Websites → evosoft.solutions → Domains → Subdomains: create `studycat-demo`. Note its folder
   (for example `/home/u123456789/domains/evosoft.solutions/public_html/studycat-demo`). Turn on its SSL certificate
   (hPanel → Security → SSL) before uploading: StudyCat's `.htaccess` sends every visit to HTTPS. PHP must be 8.1 or newer.
2. **Upload the site.** In File Manager, open the subdomain folder, upload the StudyCat deploy zip
   (`calc1-deploy-<build>.zip`, the same zip as production) and extract it there, replacing files. Turn on
   "Show hidden files" and check that `.htaccess`, `api/.htaccess` and `.well-known/` arrived. Delete the zip afterwards.
3. **Add the demo files.** Upload `config.local.php`, `demo-seed.php`, `evosoft-notice.css` and `evosoft-notice.js` (the
   last two from `demos/_branding/`) into the subdomain's `api/` folder, and
   replace the site's `robots.txt` with the one here. Optional but recommended (keeps search engines off the copy): add
   this to the end of the subdomain's `.htaccess`:
   `<IfModule mod_headers.c>` / `Header set X-Robots-Tag "noindex, nofollow"` / `</IfModule>` (three lines).
4. **Where the demo database lives.** By default it is `api/data-demo/studycat-demo.sqlite` (denied by `api/.htaccess`, and
   StudyCat writes its own deny-all `.htaccess` there too). Safer: keep it outside the web root. Create a folder such as
   `/home/u123456789/domains/evosoft.solutions/studycat-demo-data/` and a file `api/demo-data-path.php` containing
   `<?php return '/home/u123456789/domains/evosoft.solutions/studycat-demo-data';`
   (`config.local.php` picks it up). Never point it at production's `api/data`.
5. **Seed it once.** With SSH (hPanel → Advanced → SSH access):
   `cd ~/domains/evosoft.solutions/public_html/studycat-demo && php api/demo-seed.php`
   Without SSH, add the nightly cron job below and set it to run once a few minutes from now, then change it back.
6. **Check.** Open `https://studycat-demo.evosoft.solutions/api/index.php?r=health`: it must say `"mail":"log"` and
   `"domains":["studycat.test"]`. Then `php api/demo-seed.php --check` (lockdown yes, all six accounts ok, "Copyright
   notice: N of N pages"), and sign in on the site as `student@studycat.test` / `demo-study-2026`.

## Nightly reset (Hostinger cron)

hPanel → Advanced → Cron Jobs → Custom. Use the full paths of your account; the PHP binary must be 8.1+ (over SSH,
`php -v` and `which php` tell you which one; `/usr/bin/php` is the usual answer on Hostinger).

| When | Command | Why |
| --- | --- | --- |
| Every night, e.g. 03:17 | `/usr/bin/php /home/u123456789/domains/evosoft.solutions/public_html/studycat-demo/api/demo-seed.php --quiet` | Full reset: wipes everything visitors did and rebuilds the demo with fresh dates (streaks, "2 days ago", due dates stay current), and puts the copyright notice back on the pages if a new build replaced them. |
| Every 10 minutes (`*/10 * * * *`) | `/usr/bin/php /home/u123456789/domains/evosoft.solutions/public_html/studycat-demo/api/demo-seed.php --repair --quiet` | Cheap. StudyCat allows only 12 sign-ins per address per 15 minutes, and every visitor shares the same six addresses: this clears those counters. It also brings back a demo account a visitor deleted, banned or locked (the demo password and roles), within minutes. Content stays until the nightly reset. |

Cron's clock is the server's (usually UTC). 03:17 UTC is 8:17 pm in Montana; for the middle of the night there, pick
about 09:17 UTC (2:17 am MST), which is what the demo server uses. StudyCat's own
`php api/index.php cron` housekeeping job is not needed for the demo (its emails would only go to the log anyway).
The seed exits non-zero on failure, so Hostinger's cron email (if you turn it on) tells you when a reset failed.

## Lockdown: what is switched off and how

- **Email: impossible.** `mail_mode` is `log` (codes and notices are appended to `api/data/mail.log`, which is never served),
  the SMTP host is `smtp.invalid` with no password, and only `@studycat.test` addresses can sign up or sign in, so even a
  sign-up or password reset request goes nowhere. Recap, exam heads-up and weekly admin report emails are off; every demo
  account has every email preference off.
- **Keys & settings in the admin panel cannot override the file.** Normally what an administrator saves there goes to
  `site-config.json` next to the database and wins over `config.local.php` (mail mode, SMTP password, AI and RevenueCat keys,
  purchase links, staff lists, allowed domains). `demo-seed.php` puts a *folder* named `site-config.json` there: StudyCat
  reads nothing from it (`is_file` is false) and every save fails with "The settings could not be saved." Tested: saving
  `mail_mode=smtp`, an Anthropic key or a purchase link is refused and the values stay as the file says. "Add a member"
  works for `@studycat.test` addresses (no email is sent) and fails for outside addresses.
- **AI (Bo, voice, pictures, malware lookups): no keys** and the API endpoints point at `127.0.0.1:9`, so even a key could
  not spend money. Bo shows "isn't switched on yet."
- **Payments: no RevenueCat keys, no purchase links**, endpoints dead. The Max plan is a free tester grant.
- **Off-site backups, cron/stats keys: empty.** The Canvas feed is empty; an admin could paste a public calendar URL
  (StudyCat blocks private/internal addresses), which costs nothing.
- **Web push** still works for visitors who allow it (browser push services are free); it only reaches demo visitors.

What visitors *can* still do, by design of a writable demo: post and comment, upload a class pack, change the site banner,
ban or delete non-admin demo accounts, add `@studycat.test` members. The 10-minute `--repair` and the nightly reset undo it.
If that is too open, a two-line code change (not applied) would make the demo read-only for staff actions:
in `api/siteconfig.php`, `mh_siteconfig_route()`, and in `api/forum.php` for `admin_user` / `admin_user_add`, start with
`if (!empty(mh_config()['demo_readonly'])) mh_fail('Not available in the demo.', 403);` and set `'demo_readonly' => true`
in `config.local.php`.

## Copyright notice

Every page of the demo shows a small card, **"© 2026 EvoSoft Solutions. All rights reserved. · StudyCat demo · fictional
data · evosoft.solutions"**, with a close button that hides it for the browser session, and the site banner the seed sets
ends with "© 2026 EvoSoft Solutions. All rights reserved."

**How.** `php api/demo-seed.php --brand` (and every full reset) copies `evosoft-notice.css` / `.js` from `api/` (or
`--assets=DIR`) to the site's `__evosoft/` folder and puts one line before `</head>` in `index.html` and in every study
guide (`learn/…`, 193 pages in the current build) that loads them, with `?v=<hash>` so the site's 7-day cache for
`.css`/`.js` never serves an old copy. It removes its own line first, so running it again changes nothing, and it
refuses to write a page if anything else in it would change. Like the seed, it refuses to run unless
`api/config.local.php` is the demo one (exit 3), so it can never touch studycat.org. Same-origin files: the page's
`<meta>` CSP (`script-src 'self' …`, `style-src 'self' 'unsafe-inline'`) allows them unchanged.

StudyCat's own checks don't object: the service worker only pre-caches the `assets/…?v=<build>` files `index.html` names
(the notice files are fetched normally, so offline the page simply opens without the card), and `build-check.js` compares
build numbers, which the line doesn't touch. After uploading a new StudyCat build, run `php api/demo-seed.php --brand`
(or wait for the nightly reset); `--check` tells whether every page has it.

Where it sits: in the app on computers and tablets, bottom right next to Bo's round button (the focus timer and the
account card are at the bottom of the left sidebar); on phones, bottom left on three short lines, clear of Bo's button,
in the room StudyCat leaves for it at the end of each page; study guides, bottom left. StudyCat's own floating parts
(lesson feedback bar, install banner, Bo, dialogs, toasts) go over it.

**Tested** under PHP 8.3 (`php -S` with a router that mimics the `.htaccess` rules): `--brand` twice (194 pages, then 0
changed), the full reset (notice kept, banner text with the copyright line), `--check`, refusal with a non-demo config
(exit 3, pages untouched); in the browser the notice on the landing page, the dashboard, a class page and a study guide
on desktop, at 1024 px and on a phone, no CSP errors in the console.

## Keep the demo away from production

- Its own subdomain folder, its own `config.local.php`, its own database file name (`studycat-demo.sqlite`), its own
  `secret.key`. Never copy production's `api/data` or `config.local.php` into the demo, or the other way round.
- `demo-seed.php` checks the config before touching anything: `mail_mode` must be `log`, sign-ups only `@studycat.test`,
  every staff/tester address `@studycat.test`, no AI/RevenueCat/SMTP/backup secrets, and the database must be called
  `studycat-demo.sqlite`. Otherwise it stops with exit code 3 and changes nothing.
- Never upload `demo-seed.php` to studycat.org.

## Updating the demo to a new StudyCat build

On the demo server: put the new `calc1-deploy-<build>.zip` in `apps/` and run the setup again (the newest zip there is
used; the database is kept and the notice is added to the new pages).

On Hostinger: extract the new deploy zip over the subdomain folder (replace files; `api/config.local.php`, `api/demo-seed.php`, the
notice files in `api/` and `__evosoft/`, and the data folder are not in the zip, so they survive), put the demo
`robots.txt` back, then run `php api/demo-seed.php` once (it also puts the copyright notice back on the new pages).

## Things to know

- The content is StudyCat's real Fall 2026 Montana State course data. After the term ends (December 2026) the classes show
  "semester complete" until a new term's data ships; Settings → "Preview the site as of a date" (or `?asof=2026-11-10` on
  any page) shows it mid-term.
- The demo class "M 171 Calculus I (demo section)", Dr. Casey Morgan and the other people are sample data made for the demo.
- Sign-up cannot be completed in the demo (the code is never emailed); the site banner and this page tell visitors to use
  the demo accounts.
- Bo (the AI tutor), live calls, voice and pictures are not connected in the demo.
