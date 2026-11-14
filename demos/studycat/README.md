# StudyCat public demo kit

A separate, throw-away copy of StudyCat for the EvoSoft portfolio, at e.g.
`https://studycat-demo.evosoft.solutions`. Visitors sign in with shared demo accounts; nothing they do can send
email, spend money on AI or payments, or touch the real site (studycat.org). The whole demo goes back to its
starting point every night.

| File | Goes to (in the demo copy) | What it does |
| --- | --- | --- |
| `config.local.php` | `api/config.local.php` | Demo settings: only `@studycat.test` addresses, mail in `log` mode, no AI/RevenueCat keys, dead AI/payment endpoints, a separate `studycat-demo.sqlite` database, demo staff and the Max tester plan. |
| `demo-seed.php` | `api/demo-seed.php` | Command line only. Wipes and rebuilds the demo (accounts, discussions, report queue, a published StudyCat Faculty class with students, practice history), or with `--repair` only puts the demo accounts back. It refuses to run against anything that is not the demo config, so it cannot wipe production. |
| `robots.txt` | `robots.txt` (replace the site's) | Keeps the demo out of search results (it duplicates studycat.org's pages). |

No StudyCat code is changed. Every file above is either new or is a file StudyCat itself loads (`config.local.php`).

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

## Put it on Hostinger

1. **Subdomain.** hPanel → Websites → evosoft.solutions → Domains → Subdomains: create `studycat-demo`. Note its folder
   (for example `/home/u123456789/domains/evosoft.solutions/public_html/studycat-demo`). Turn on its SSL certificate
   (hPanel → Security → SSL) before uploading: StudyCat's `.htaccess` sends every visit to HTTPS. PHP must be 8.1 or newer.
2. **Upload the site.** In File Manager, open the subdomain folder, upload the StudyCat deploy zip
   (`calc1-deploy-<build>.zip`, the same zip as production) and extract it there, replacing files. Turn on
   "Show hidden files" and check that `.htaccess`, `api/.htaccess` and `.well-known/` arrived. Delete the zip afterwards.
3. **Add the demo files.** Upload `config.local.php` and `demo-seed.php` into the subdomain's `api/` folder, and
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
   `"domains":["studycat.test"]`. Then `php api/demo-seed.php --check` (lockdown yes, all six accounts ok), and sign in on
   the site as `student@studycat.test` / `demo-study-2026`.

## Nightly reset (Hostinger cron)

hPanel → Advanced → Cron Jobs → Custom. Use the full paths of your account; the PHP binary must be 8.1+ (over SSH,
`php -v` and `which php` tell you which one; `/usr/bin/php` is the usual answer on Hostinger).

| When | Command | Why |
| --- | --- | --- |
| Every night, e.g. 03:17 | `/usr/bin/php /home/u123456789/domains/evosoft.solutions/public_html/studycat-demo/api/demo-seed.php --quiet` | Full reset: wipes everything visitors did and rebuilds the demo with fresh dates (streaks, "2 days ago", due dates stay current). |
| Every 10 minutes (`*/10 * * * *`) | `/usr/bin/php /home/u123456789/domains/evosoft.solutions/public_html/studycat-demo/api/demo-seed.php --repair --quiet` | Cheap. StudyCat allows only 12 sign-ins per address per 15 minutes, and every visitor shares the same six addresses: this clears those counters. It also brings back a demo account a visitor deleted, banned or locked (the demo password and roles), within minutes. Content stays until the nightly reset. |

Cron's clock is the server's (usually UTC); 03:17 UTC is the middle of the night in Montana. StudyCat's own
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

## Keep the demo away from production

- Its own subdomain folder, its own `config.local.php`, its own database file name (`studycat-demo.sqlite`), its own
  `secret.key`. Never copy production's `api/data` or `config.local.php` into the demo, or the other way round.
- `demo-seed.php` checks the config before touching anything: `mail_mode` must be `log`, sign-ups only `@studycat.test`,
  every staff/tester address `@studycat.test`, no AI/RevenueCat/SMTP/backup secrets, and the database must be called
  `studycat-demo.sqlite`. Otherwise it stops with exit code 3 and changes nothing.
- Never upload `demo-seed.php` to studycat.org.

## Updating the demo to a new StudyCat build

Extract the new deploy zip over the subdomain folder (replace files; `api/config.local.php`, `api/demo-seed.php` and the
data folder are not in the zip, so they survive), put the demo `robots.txt` back, then run `php api/demo-seed.php` once.

## Things to know

- The content is StudyCat's real Fall 2026 Montana State course data. After the term ends (December 2026) the classes show
  "semester complete" until a new term's data ships; Settings → "Preview the site as of a date" (or `?asof=2026-11-10` on
  any page) shows it mid-term.
- The demo class "M 171 Calculus I (demo section)", Dr. Casey Morgan and the other people are sample data made for the demo.
- Sign-up cannot be completed in the demo (the code is never emailed); the site banner and this page tell visitors to use
  the demo accounts.
- Bo (the AI tutor), live calls, voice and pictures are not connected in the demo.
