# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is here

Two unrelated projects share this repository:

- **`calc1/`: StudyCat** (studycat.org, formerly Mathub), the study site for Montana State University classes, with
  Bo the bobcat as its AI tutor. Nearly all work happens here. Plain HTML, CSS and JavaScript with no framework and no
  bundler, plus a PHP 8.1 + SQLite API in `calc1/api/`, deployed by uploading a release zip to Hostinger. The reference
  docs are `calc1/PRODUCT.md` (who it is for, brand commitments), `calc1/DESIGN.md` (the design system and the rules
  each redesign added) and `calc1/README.md` (every feature and the Hostinger deploy; long, so search it by heading).
- **Repository root: Lead Radar**, a small separate Node/Express app (`server.js`, `public/`, `data/leads.json`;
  `npm install && npm start`, with `ANTHROPIC_API_KEY` in `.env`). It shares nothing with StudyCat.

Everything below is about StudyCat. Run commands from `calc1/`.

## Commands

Node 18+ and PHP 8.1+ must be on PATH. There is no linter or formatter; for a quick syntax check use
`node --check assets/<file>.js` and `php -l api/<file>.php`.

- **Run locally:** `php -S 127.0.0.1:8766 -t .`, then open http://127.0.0.1:8766/index.html. The test runner starts
  this server itself when nothing answers on :8766.
- **Tests** (Playwright with headless Chromium; once: `cd tests && npm install`):
  - `node tests/run.js` runs every `tests/*.test.js` in turn (about 85 suites, roughly an hour) and prints PASS or
    FAIL per suite.
  - `node tests/run.js halloween lighter` runs only the suites whose file names contain those words. A suite is one
    file and always runs whole.
  - `tests/chaos.test.js` injects failures (API errors, offline, bad storage, random clicks). It takes about ten
    minutes and stops the shared server when it ends, so run it alone. `CHAOS_SEED=3 node tests/run.js chaos` replays
    a run.
- **Release:** write the entry in `assets/changelog.js` first, then `node scripts/release.js <build> --zip`. Builds
  are `YYYY.MM.DD.N` (N counts that day's releases). The script stamps the build everywhere: `data-build` and every
  `?v=` in `index.html`, `MATHUB_ASSETS_BUILD` in `assets/app.js`, `--assets-build` in `assets/styles.css`,
  `build-check.js` and `learn/build.json`. It then rebuilds the translations and study guides and writes
  `../calc1-deploy-<build>.zip` (gitignored). It checks that no data, config, test or app file is in the zip and says
  whether anything in `api/` changed since the last zip. `node scripts/release.js --check` only compares the stamps.
  Never edit build stamps by hand.
- **Translations:**
  1. `node scripts/i18n-extract.js` gives new text new numbers in `i18n/catalog.json`.
  2. Add those numbers to each `i18n/<lang>.tsv` (es, ru, fr, it, pt, de).
  3. `node scripts/build-i18n.js` builds the dictionaries and lists what is still missing.

  `--pseudo` builds a test language (open `index.html?lang=qps`) that shows untranslated text; never ship it.
- **Class data:** after editing `assets/<id>-data.js`, run `node scripts/build-course-index.js`,
  `node scripts/build-classdata.js` (the copy Bo's server reads) and `node scripts/build-seo.js`. For a class pack,
  `node scripts/make-pack.js packs/src/<id>.js` writes `packs/<id>.mathub.json` (see `packs/README.md`).
- **Apps:** `cd app && node scripts/build-www.js && npx cap sync ios` (or `android`).

Generated files, never edited by hand:

| File | Built by |
|---|---|
| `learn/`, `sitemap.xml`, `robots.txt` | `build-seo.js` |
| `assets/i18n/*.js` | `build-i18n.js` |
| `assets/courses-index.js` | `build-course-index.js` |
| `api/classdata/` | `build-classdata.js` |
| `packs/*.mathub.json` | `make-pack.js`, from `packs/src/` |
| `assets/realm.css` | `build-realm-css.js` |
| `app/www/` | `app/scripts/build-www.js` |

### Test harness

- **Accounts:** suites sign in as `alice.a@montana.edu`, `mod.user@montana.edu` or `admin.user@montana.edu` (password
  `password123`). These accounts exist only in the local development database `api/data/mathub.sqlite`, which is
  gitignored, and the repository has no seed script.
- **One run at a time:** all suites share the :8766 server and that database, and `run.js` clears rate limits and
  credit use before each suite.
- **Writing a suite:** start with `const T = require('./lib'); const { mk, go, login, api, check, hscroll } = await
  T.start(opts)`.
  - `T.finish()` fails a suite on any console error or uncaught page error, not only on failed checks.
  - By default every browser context gets geek mode off, the tour done and the Halloween season off. A suite turns
    them on with `T.start({ geek: true, tour: true, season: true })`.
- **Motion:** alice keeps Reduce motion on in her synced account. A check that needs motion uses a guest context
  (`reducedMotion: 'no-preference'` and `settings.motion = 'on'`) or restores her setting afterwards.
- **Dates:** most pages depend on the date. `?asof=YYYY-MM-DD` on any page moves the class calendars (countdowns, the
  next exam). Playwright's `page.clock.setFixedTime` also moves the Halloween season, which reads the real date.

## Architecture

- **One page, hash routes.** `index.html` is the whole app: `#/<class>/<view>/<param>` inside a class, `#/<view>`
  outside one. It loads about 25 stylesheets and 65 scripts in a fixed order, each with `?v=<build>`.
  - Each script is an IIFE. Most add to the global `App`, which `assets/app.js` defines. The scripts in `<head>`
    (`boot.js`, `season.js`, `i18n.js`) run before it and set their own globals, such as `StudySeason` and
    `MathubI18n`.
  - There are no modules or imports, so load order matters: `app.js` comes before every script that extends `App`.
- **Views.** A page is `App.views.<name> = { title, render(root, param), unmount }`, registered in about 45 files.
  - `render()` in `assets/app.js` parses the hash, replaces `#view` with a fresh element and calls the view.
  - Clicks are delegated: `bind(root, { name: fn })` handles every `data-action="name"` inside `root`. A handler that
    returns a promise marks its button busy.
  - Rarely used pages load on first open: `App.lazyView` and `App.LAZY_PAGES` in `app.js`, loaded through
    `App.need(files)`.
- **Classes** are `window.Courses[id]`.
  - The shell ships light stubs (`assets/courses-index.js`). Opening a class loads `assets/<id>-data.js` (facts,
    calendar, exams, notes, flashcards), `<id>-quiz.js` (question generators, listed in `GENERATORS`),
    `<id>-tools.js` and `assets/lessons/<id>.js`.
  - Built-in class ids are `COURSE_ORDER` in `app.js`. Every other class is a class pack: one JSON file, either bundled
    from `packs/` and seeded into the database by the server, or uploaded in the admin panel.
  - Countdowns, "now covering" and the next exam are computed from today's date and the class calendars.
- **State.** Settings live in localStorage `studyhub-settings` (`App.settings()`, `App.setSetting(k, v)`).
  - The keys listed in `PREF_KEYS` in `assets/auth.js` sync to the account.
  - Progress is stored per class and synced.
  - Visitors without an account get a preview limited by `HARD` and `LIMITS` in `assets/auth.js`.
- **API.** `api/index.php?r=<route>` answers JSON.
  - The core account routes are handled in `index.php`. Its `default:` branch sends the rest to the other `api/*.php`
    files by route prefix (`ai_` to `ai.php`, `forum_` and `admin_` to `forum.php`, and so on).
  - `api/lib.php` holds the helpers (`mh_db`, `mh_json`, `mh_fail`, `mh_current_user`). It rejects any request
    without the header `X-Requested-With: MatHub`.
  - Tables and columns are created on first use (`CREATE TABLE IF NOT EXISTS`). There is no migration step, and
    existing rows are never touched.
  - Config is layered, the later winning: `api/config.php` (defaults, in git), then `api/config.local.php` (the
    owner's secrets, gitignored), then `api/data/site-config.json` (Admin → Keys & settings).
- **Bo, the AI tutor.** Chat and live voice calls (WebRTC, OpenAI Realtime) run through `api/ai.php`, with
  `assets/tutor.js`, `assets/talk.js` and `assets/bo-float.js` in the page. Bo is paid for in credits
  (`api/credits.php`).
- **Styling.** CSS is layered by load order, later files winning: `styles.css` first, then the feature sheets, then the
  redesign layers (`design.css`, `quiet.css`, `refine.css`), with `halloween.css` last.
  - Attributes on `<html>` select variants: `data-theme`, `data-skin` (the optional looks, such as Realm), `data-app`
    (inside the native apps), `data-course` (the class colour), `data-motion="off"` (Reduce motion), `data-geek` and
    `data-season`.
  - Rules for the website's own look are scoped `:root:not([data-skin]):not([data-app])`, so the other looks and the
    apps keep theirs. A rule meant to override one of them needs at least the same specificity.
- **Security policy.** The page's Content-Security-Policy is a `<meta>` tag in `index.html` (`.htaccess` adds only
  `frame-ancestors`, `base-uri` and `object-src`). Scripts load only from the site, plus the jsDelivr MathJax fallback,
  so inline scripts never run. Third-party code is vendored in `assets/vendor/` (GSAP, MathJax, pdf.js, qrcode).
- **Offline and uploads.**
  - `sw.js` precaches the `assets/…?v=<build>` files that `index.html` references (a new file needs no list edit) and
    caches the rest on first fetch. The build names the cache.
  - `build-check.js` compares the build stamps on the live site. When an upload was only half extracted, it drops the
    device's saved copies and reloads, and if they still differ it shows that the site is being updated.
  - `learn/` holds the static study guides for search engines, styled by `assets/seo.css`.
- **Translations.** The code is written in English.
  - `assets/i18n.js` translates the rendered page by matching its English text against `assets/i18n/<lang>.js`. Use
    `App.t('…')` for text that never reaches the page.
  - A new interface script must be added to `FILES` in `scripts/i18n-extract.js`.
  - Not translated: course material, what people write, the admin panel, `changelog.js` and `policy.js`.
- **Native apps** (`app/`, Capacitor). They are on hold, but must keep building.
  - `app/scripts/build-www.js` copies the site into `app/www` and adds `assets/app-boot.js`, `assets/app-native.js` and
    `assets/app.css`, which load only there.
  - `.github/workflows/android-build.yml` and `ios-build.yml` build both apps on every push that touches
    `calc1/assets`, `calc1/index.html`, `calc1/packs` or `calc1/app`.

## Rules from the owner

- Never delete or reset `api/data/`: the database and `secret.key` hold every account, post and bit of progress.
  Never read `api/config.local.php`. Secrets live only there or in `api/data/site-config.json`, never in code, git
  or a zip.
- Keep `X-Requested-With: MatHub` on every API request.
- Never add anything that deletes users, or their saved work without their consent. Discussions take no media or
  photo uploads.
- The admin panel, the terms (`assets/policy.js`) and What's new (`assets/changelog.js`) are English only.
- Never commit the Android keystore.
- Every feature survives a redesign. Never invent testimonials, user counts or results (PRODUCT.md).
- Read DESIGN.md before UI work. Test suites enforce part of it:
  - No decorative animation runs without end (`lighter.test.js`).
  - Every motion stops with Reduce motion.
  - Text meets WCAG AA contrast, and the axe audit stays clean (`a11y.test.js`).
  - Nothing is wider than a 320px phone (`steady-phone.test.js`): card grids use `minmax(min(Npx, 100%), 1fr)`.
- Write each changelog entry for students, in plain words. Send the release zip to the owner with a note on whether
  `api/` changed.
- **Code style:** long, dense lines with plain-English comments, and a header comment on each file that says what it is
  for (keep it current). A `//` comment must end its line, because code after it on the same line is silently
  commented out.
