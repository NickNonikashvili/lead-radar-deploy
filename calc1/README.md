# MatHub

A free study hub for three Fall 2026 courses at Montana State University:

- **M151Q Precalculus** (Yoshiwara *Modeling, Functions, and Graphs* + *Trigonometry*)
- **M171 Calculus I** (Active Calculus)
- **PHSX 220 Physics I with Calculus** (OpenStax University Physics Vol. 1)

The site is plain HTML, CSS and JavaScript with a small PHP + SQLite account server (`api/`).
Anyone can preview it; students sign up with a **montana.edu** email to unlock everything and
keep their progress in sync across devices.

## What's inside (every class)

| View | What it does |
| --- | --- |
| Landing page | Pick a class; each card shows the next exam, current topic, due-soon items and your stats; merged seven-day deadline list |
| Dashboard | Exam countdown, today's class, due-soon rules from the syllabus, streak and mastery, this week, weakest topics |
| Calendar | Full semester, week by week, today highlighted |
| Notes | Every topic: big ideas, key formulas, worked example, common mistakes, exam tip, textbook link |
| Formula sheet | Filterable and printable |
| Flashcards | 3-box mastery system with keyboard shortcuts |
| Quizzer | Endless procedurally generated problems (multiple choice and typed answers), practice or timed-exam mode, per-topic accuracy |
| Exam prep | Practice sets with worked solutions plus a checklist per exam |
| Grade calculator | Syllabus weights, current letter grade, what you need on the final |
| Scratchpad | Handwriting canvas with colors, eraser, undo, grid, PNG export |
| Syllabus & policies | Deadlines, help, exam rules |

Every class also has **Discussions** (see below).

Class-specific tools:

- **Precalculus:** Function explorer (parent functions with a·f(b(x − h)) + k sliders, domain/range/description), Unit circle & triangles (draggable unit circle with exact values, right-triangle solver, Law of Sines / Cosines solver with the ambiguous case), Grapher.
- **Calculus:** Grapher (tangent/secant, f′, f″), Labs (limit tables, difference quotients, Riemann sums, derivative from data, average rate of change).
- **Physics:** Projectile simulator, motion graphs x(t) → v(t) → a(t), kinematics solver, vector calculator, incline & friction solver, unit converter and constants.

## Discussions

A members-only board (Reddit style) at `#/forum` and inside every class under **Community → Discussions**:
posts with a class and a type (question, discussion, resource, study group, exam, other), threaded
comments, up/down votes, hot / new / top sorting, search, anonymous posting (moderators still see the
author), reports, and a language filter that censors curse words and slurs (server side, in
`api/filter.php`, with a matching preview in `assets/forum.js`). Math renders with `$…$`.

Before the first post every member accepts the Community Rules. The full **Terms of Use, Community
Rules, Privacy Policy and Disclaimer** live at `#/policy` (`assets/policy.js`); they put responsibility
for user content on the person who posts it, prohibit illegal activity, and disclaim liability. Have a
lawyer look them over if the site grows.

**Moderators.** Add account emails to `moderators` in `api/config.php`. Moderators see real authors,
can pin, lock, remove and restore posts and comments, ban users for a number of days, and work the
report queue at `#/forum/reports`.

## Preview vs. members

Without an account a visitor can browse the dashboards, calendars, syllabus pages, the first three
topics of each class's notes, two formula groups, five flashcards per deck, three questions per
quiz set and the first two exam-prep solutions. Grade calculators, scratchpads and all interactive
tools ask for an account. Everything unlocks after sign-up. The rules live in `assets/auth.js`
(`HARD` and `LIMITS`).

## Always current

Nothing needs editing during the semester. Every countdown, "next exam", "now covering", due list and
week number is computed from today's date and the calendars in the data files. After an exam passes
the site moves on to the next one; after the final it shows a "semester complete" state. To see what
the site will look like on a later date, open Settings → *Preview the site as of a date* (or add
`?asof=2026-11-01` to any page address). When a new semester starts, update the dates in the three
`*-data.js` files.

## Deploy to Hostinger

Upload the contents of this folder into `public_html` (or a subfolder). Keep the structure:

```
public_html/
  index.html
  .htaccess                 no-cache for the page, long cache for versioned assets
  assets/                   styles, scripts, icons, manifest
  api/
    index.php               account endpoints (sign-up, verify, login, reset, progress sync)
    lib.php, mailer.php     helpers (blocked from the web by api/.htaccess)
    forum.php, filter.php   discussion board endpoints and the language filter
    config.php              <-- edit this one
    data/                   SQLite database is created here automatically (blocked from the web)
```

Then in **hPanel**:

1. **PHP version** 8.1 or newer (Websites → Manage → PHP configuration). SQLite is enabled by default.
2. **Email.** Codes are sent from `info@mathub.space`. For reliable delivery open `api/config.php` and
   put that mailbox's password in `smtp_pass` (SMTP host `smtp.hostinger.com`, port 465). Leave it
   blank and the server falls back to PHP `mail()`, which also works on Hostinger but is more likely
   to land in spam.
3. **Permissions.** `api/data` must be writable (755 is normally enough on Hostinger).
4. Visit `https://your-domain/api/index.php?r=health`. You should see `{"ok":true,...,"mail":"smtp"}`.
   If it reports a database error, fix the folder permission.
5. If a device still shows an old version, purge the cache in hPanel (Websites → Advanced → Cache
   Manager) and hard-refresh once. From then on the page is served with no-cache headers and a
   stale copy repairs itself automatically.

Optional: set `admin_key` in `config.php` and call `api/index.php?r=stats` with the header
`X-Admin-Key: <key>` to see how many students have signed up.

## Editing content

- Course facts, calendars, notes, formula sheets, flashcards, practice sets and checklists live in
  `assets/calc-data.js`, `assets/physics-data.js` and `assets/precalc-data.js`.
- Question generators live in `*-quiz.js`. Each function returns one question; add a function and list
  it in `GENERATORS`.
- Week-by-week lecture topics for physics and precalculus are estimated from the syllabus topic order
  and the exam dates; adjust `CALENDAR` when Canvas modules differ.
- When you change any file in `assets/`, bump the build string at the top of `index.html`
  (`data-build` and `MATHUB_BUILD` and the `?v=` suffixes) so browsers fetch the new files.
