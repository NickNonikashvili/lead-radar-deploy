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

**Moderators and administrators.** Account emails listed under `moderators` in `api/config.php` see
real authors, can pin, lock, remove and restore posts and comments, ban users for a number of days, and
work the report queue at `#/forum/reports`. Emails under `admins` (the site owner) can do all of that
plus permanently delete any post or comment, and manage members at `#/forum/admin`: search, ban,
unban, verify or delete any account. Both lists ship with nikoloz.nonikashvili@student.montana.edu.

## Canvas sync, notifications, planner, offline

- **Canvas calendar feed.** In Canvas open Calendar → *Calendar Feed* and copy the link. Paste it in the admin
  panel (`#/forum/admin` → Site settings). The server (`api/canvas.php`) downloads the feed at most once an hour,
  keeps only events whose course name matches a MatHub class (`canvas_course_match` in `config.php`), and the
  site shows them as "From Canvas" on the landing page, each dashboard and the calendar. Real Canvas due dates
  replace the estimated standing rules in the due-soon lists. The admin panel also has an announcement banner.
- **Reply notifications.** Members get an inbox (bell in the top bar, `#/forum/inbox`) whenever someone comments on
  their post or replies to their comment, and an email at most once per post every six hours. The email can be
  turned off in Settings → Account.
- **Smart review.** "Review for me" in the Quizzer (and the dashboard card) builds a set weighted toward weak,
  stale and never-tried topics from the sections covered so far.
- **Study planner.** Practice → Study planner: pick an exam and study days; the plan spreads notes, drills,
  flashcards, the practice set and a final review across those days as a synced checklist. Today's tasks also
  show on the dashboard.
- **Offline.** `sw.js` caches the site so notes, formula sheets, flashcards and tools open without a connection,
  and the site can be installed to a phone's home screen. A logged-in member stays logged in while offline;
  progress syncs when the connection returns. The account server itself is never cached.

## Community

- **Daily challenge** (`#/challenge`, and in every class): one problem per class per day, the same for everyone,
  generated from a seed of the date so no question bank is stored. 10 points for a correct answer, up to 5 for
  speed, 2 for trying; today's fastest, this week's board per class and across classes. Names can be hidden in
  Settings.
- **Badges** (`#/badges`): streaks, questions answered, accepted answers, challenges, mock exams, contributions,
  founders. Computed on the server from progress and board data; a toast announces new ones.
- **Live presence**: a heartbeat every minute shows "N studying now" in the top bar, on the landing page and
  on open threads.
- **Study sessions** (`#/meet`): post where and when you are studying; classmates RSVP; sessions vanish an hour
  after they end.
- **Polls**: any post can carry an anonymous poll. After each exam the site itself posts an anonymous
  "How did it go?" poll with score buckets (created the first time a member opens that class's dashboard).
- **Accepted answers and helpers**: the asker (or a moderator) marks the answer that solved it; the board
  filters by Unanswered / Solved / Polls and shows the week's top helpers.
- **Community mock exams** (`#/mock`): moderators schedule a timed set from the admin panel; everyone gets the
  same seeded questions inside the Quizzer; rankings unlock when the window closes.
- **Contributions** (Contribute in every class): students submit practice problems and flashcards, moderators
  approve them in the admin panel, members vote; approved flashcards can be mixed into the Flashcards deck with
  the "Community cards" button.
- **Activity feed** on the landing page and admin overview: new posts, solved questions, challenge solves,
  badges, sessions, mocks, polls and approved contributions (anonymized except for posts).
- **Weekly digest**: Sunday evening email with what is due (Canvas), the top posts, the member's own stats
  against the class average, and upcoming sessions and mocks. Sent in small batches from normal traffic, or
  all at once by a cron call (`api/index.php?r=cron&key=<cron_key>`; see the admin panel's Digest tab).
- **Verified staff**: emails marked Instructor or TA (admin panel → Site settings, or `staff` in config) get a
  badge next to their posts.

## Personalization, reminders, streaks, focus time

- **Your classes and sections.** After sign-up (and any time from Settings → *Choose classes and sections*) a
  member picks the classes they take, their section number, lecture/exam time and, for Calc I, their lab day.
  Only those classes show on the landing page, in the course switcher, in reminders and in the digest; the
  section and time appear on the dashboard's exam tile.
- **Evening reminders.** Opt-in (Settings, or the one-click card on the dashboard): from 6 pm local time
  (`reminder_hour`) members get an email listing tomorrow's Canvas due dates for their classes, study sessions
  they joined, and a warning if their streak ends at midnight. Sent like the digest: a few per request, or all
  at once by the cron call.
- **Streak protection.** The dashboard warns when today has no activity yet and the streak is at risk, and
  offers one *freeze* per class per week when a streak broke yesterday.
- **Focus time.** Completed pomodoro minutes are logged per day and synced; the dashboard shows hours this
  week next to the class median (from `stats_week`), and the digest includes it.

## Account menu, settings and the People page

- **Account menu in the header.** Once signed in, your avatar sits in the top bar of every class page, in the landing hero and on every standalone page (badges, discussions, study sessions, mock exams, admin). It opens a menu with Account settings, Your badges, People, Inbox (with the unread count), the admin panel for staff, and Log out. Guests see Sign up and Log in there instead.
- **Settings from the start page.** `#/settings` works without picking a class: account, notifications, privacy, your classes and sections, theme and a preview-as-of date. Per-class backups (export, import, reset) stay on each class's own settings page, linked from there.
- **Clearer account panel.** A header with your name, email, role and sync state, then large icon tiles for Your badges (with your earned count), People, Inbox and the admin panel, then Profile, Email me and Privacy sections, and the account actions at the bottom.
- **People page** (`#/people`, members only, also under Community in every class). Every verified member with their badges, role, classes, join date, an online dot when they are on the site right now, and post, reply and accepted-answer counts. Search by name, sort by most badges, online now, newest or name. Anyone who turned off "Show my name on leaderboards" appears as "Anonymous student" and is left out of name search.

## Streaks, XP, daily goals, the learning path and Bo

- **Class picker.** The choose-your-classes dialog scrolls inside itself, so the Save button stays reachable however many classes and sections you fill in.
- **Header widgets.** Every header (class top bar, landing hero, standalone pages) shows a streak flame that lights up once you have studied today, and a daily goal ring with your level number in the middle. Tap the flame for the last seven days, your longest streak and this week's freeze; tap the ring for today's XP, your level and the goal picker.
- **XP.** A correct answer is 10 XP, an attempt 2, a flashcard you know 2, a focus minute 1, a daily challenge its points, and every 5 correct in a row a 5 XP bonus. XP is stored per class alongside your progress and synced to your account. Levels grow with the square root of total XP (level 2 at 100, level 3 at 400, level 4 at 900...), each with a name from Newcomer to Grandmaster.
- **Daily goal.** 10, 30, 50 or 100 XP a day, chosen at sign-up and in Settings. Reaching it fires confetti once a day; so does levelling up, a daily challenge solved, an exam set at 80% or better, and a new badge.
- **Learning path** (first item under Today in every class). One stop per topic in syllabus order, grouped by unit with the unit's exam. Stops earn up to five crowns from your accuracy and question count; three crowns marks a topic mastered. The next stop to work on bounces with a START tag and the dashboard links straight to it.
- **Bo the bobcat** sits in the landing hero and above the dashboard with a one-line nudge: how much XP is left today, a warning when a streak is about to end, congratulations when the goal is done.
- **Live background.** Math and physics glyphs drift slowly behind every page over soft moving colour. It pauses in background tabs, follows the theme, and switches off under "reduce motion" or in Settings.
- **Motion.** Panels and cards rise in, the quizzer pops on a correct answer and shakes on a wrong one, a combo chip counts answers in a row, numbers count up, and every menu opens as a page-level popover so headers never clip it.

## Focus sounds and My music

A headphones bubble floats in the bottom-right corner of every page and opens into a panel with two tabs.

**Focus sounds** are soundscapes synthesised on the device with the Web Audio API, so nothing streams and nothing is hosted: rain (layered body, hiss, drops with random panning, gusts), thunderstorm (rain plus rolling rumbles and the occasional close crack), ocean waves (each wave scheduled with its own swell, crash and foam), wind (gusts with a whistle), fireplace (roar, crackle clusters, pops), forest (breeze, rustling leaves and four kinds of birdsong), summer night (three crickets, a katydid, a distant owl), coffee shop (murmuring voices, cup clinks, someone typing, the espresso machine), lo-fi beats (a Rhodes-style chord loop with wow and flutter, bass, swung drums, sparse melody and vinyl crackle), soft piano (slow generative piano in a random key), an ambient drone and white, pink and brown noise. Everything runs through a synthetic reverb and a limiter. Sounds layer, each has its own volume, there is a master volume, a 15, 30 or 60 minute sleep timer that fades everything (music included) out, and the mix is remembered; browsers require a click before audio starts, so a saved mix waits for Resume.

**My music** is a personal playlist of up to 10 MP3 files, each up to 8 minutes, that the student adds from their own device. Files are kept in the browser's IndexedDB and are never uploaded, so the site hosts no music and every student's playlist is private to that browser. Play/pause, previous/next, shuffle, repeat (all, one, off), seek, volume, reorder and remove; playback continues while moving around MatHub, and the phone's lock-screen media keys work through the Media Session API. Clearing site data removes the files.

## English Phonetics Lab

`assets/phonetics.js` is a native port of the English Phonetics Lab, driven by `assets/phonetics-data.js` (134 practice words with British and American IPA, syllables and stress; 96 sentences; 96 minimal pairs; a 49-symbol library; phoneme features; an IPA keyboard layout; a dictionary of about 950 further words for the transcription tool; guides and reference charts). WRIT 101 shows it under Learn as Phonetics lab, at `#/writ/phonetics/<section>`:

- **Practice**: word → IPA, IPA → word, sentence → IPA, IPA → sentence, syllabification (transcribe first, then mark the boundaries), word stress (tap the stressed syllable) and phoneme features (symbol → place/manner/voicing or height/backness/rounding, or the reverse). British RP or American, three levels, an IPA keyboard that types into whichever box has focus, a Listen button, feedback with the expected answer and a Cambridge Dictionary link, session score and streak.
- **Minimal pairs**: two words one sound apart, listen to each, transcribe both, then see which sound changes.
- **Symbols**: a card per symbol with its name, description and example; play the sound or the word; the grid ticks the symbols you have opened.
- **Charts**: consonant chart, vowel positions, monophthongs, diphthongs, place, manner, voicing and vowel features. Every symbol is a button that speaks.
- **Transcribe**: any English text to IPA, British or American, with optional weak forms, three layouts, copy, edit, listen and a YouGlish link. Unknown words are looked up on the free Dictionary API when online.
- **Word explorer**: look up any dictionary word or open a random one: both accents, weak form, syllables, stress, word type, Cambridge and YouGlish links.

Speech uses the browser's speech synthesis with a voice picker per accent and a speed slider. Every graded answer is 5 XP (1 for a try, +5 for every five in a row), counts toward quests and streaks, and the lab's all-time stats show on the WRIT 101 dashboard.

## WRIT 101 College Writing I and the read-along audiobooks

- **The class.** `assets/writ-data.js` holds Dr. Nicole J. Hall's section 030 syllabus as course data: meeting times, office hours, the five learning outcomes, the four major assignments, the 1000-point grading breakdown and letter scale, the late-work, attendance and AI policies, MSU resources, and the 15-week schedule as calendar entries with the major deadlines (draft, peer review and revised draft for each project, the portfolio, and finals week). Exact days are TBD on the syllabus, so deadlines sit on the Friday of their week and the dashboard says so. There are no quiz generators, so the app shows a writing layout: a next-deadline tile with a prep checklist, this week's plan, readings progress, the grade calculator, and Community without the challenge and mock-exam items.
- **Readings as audiobooks.** The four handouts (Tommy Orange's prologue to *There There*, James Baldwin's "The Creative Process", Dr. Hall's "Welcomed Home", and the excerpt of Joan Didion's "Goodbye to All That" with its discussion questions) live in the Readings library. The player uses the browser's own speech synthesis, so there are no audio files to host: it reads one sentence at a time, highlights the sentence, auto-scrolls, offers speed and voice menus, skips by paragraph, remembers where you stopped, and pays 1 XP per paragraph and 20 XP for finishing. Space plays and pauses; the arrow keys skip. Guests see the first paragraphs and a sign-up card; the full texts are members-only.
- **Copyright.** The Orange excerpt carries the publisher's notice that it may not be reproduced without permission, and Baldwin's essay is still in copyright; "Welcomed Home" belongs to Dr. Hall and the Didion excerpt was published by NPR. The texts are gated behind montana.edu sign-in and attributed, but hosting them is your call: if in doubt, ask Dr. Hall or remove an entry from `READINGS` in `assets/writ-data.js`.

## SEO: static study guides, sitemap and metadata

The app is a hash-routed single page, which search engines index as one URL. `node scripts/build-seo.js` (run from `calc1/`) renders every topic of every class into a plain HTML page under `learn/` (`learn/<course>/<topic>.html`, about 110 pages), a class page per course with facts, exam dates and the topic list, a hub page at `learn/index.html`, plus `sitemap.xml` and `robots.txt`. The pages use `assets/seo.css`, MathJax for formulas, breadcrumbs, previous/next links, JSON-LD (`LearningResource`, `CollectionPage`, `BreadcrumbList`) and Open Graph tags, and every page links into the app (notes, practice on that topic, flashcards, playground). Rerun the script whenever course data changes and ship the `learn/` folder, `sitemap.xml` and `robots.txt` with the site. The app's `index.html` carries a canonical link, Open Graph and Twitter cards (`assets/og.png`), JSON-LD for the site and its study guides, and a `<noscript>` block with links to the guides; the service worker leaves `/learn/` pages alone. After deploying, submit `https://mathub.space/sitemap.xml` in Google Search Console.

## UI polish

A mobile tab bar (Home, Learn, Practice or Code, Board, Me) appears under 900 px, adapting to the class; the top bar shows a breadcrumb (class › page); the landing page has a "pick up where you left off" card that remembers the last page visited in any of your classes and a stats strip; class switcher buttons carry their class color; `?` opens a keyboard-shortcuts dialog; a back-to-top button appears after scrolling; pages fade in; keyboard focus rings are visible.

## CSCI 127 Joy and Beauty of Data and the Code playground

`assets/csci-data.js` adds CSCI 127 (Daniel DeFrance, Fall 2026) from the syllabus and the weekly schedule: every lecture, Tuesday lab, program deadline, the two in-class exams (Sept 23 and Nov 6) and the Dec 14 final on the calendar; the grade calculator with labs 45%, programs 25% and three equal exams at 10% each plus the syllabus scale; 18 topic notes across four units (data types, modules and turtle, functions, selection, strings, iteration, recursion, memory; lists, files, dictionaries; classes, inheritance, OOP principles; NumPy, matplotlib, pandas, Python vs C vs Java), each with big ideas, runnable code examples with expected output, a worked example, common mistakes and an exam tip; a cheat sheet (the "formula sheet" of a coding class, in code); 46 flashcards; practice sets for all three exams; the lab sections and TA table on the syllabus page. `assets/csci-quiz.js` has 17 generators of "what does this print" questions whose answers are computed with Python semantics, so the quizzer, lessons, learning path, daily challenge and mock exams all work for this class.

**Code playground** (`assets/pylab.js`, `assets/pyworker.js`) is the W3Schools-style "try it" editor at `#/csci/playground`: an editor with line numbers, Tab indent and auto-indent after a colon, Ctrl+Enter to run, a program-input box that feeds `input()`, a streamed console, Stop for runaway loops, an examples menu (course examples plus every code block in the notes, which have Try it buttons that open and run them), saved snippets, share links that carry the code, and 2 XP per successful run (10 a day). Python is Pyodide (CPython compiled to WebAssembly) running in a Web Worker, fetched from the jsDelivr CDN on first use (about 12 MB, cached by the browser); NumPy, pandas and matplotlib download the first time they are imported. The worker ships its own `turtle` module that records every move and renders the finished drawing as SVG (moves, turns, pen, colors, fills, circles, dots, stamps, write, Screen size and background); key, mouse and timer events are noted but need a real window. matplotlib figures come back as PNGs through the Agg backend. Nothing is uploaded; files written by a program exist only during that run.

## GPA calculator

`assets/gpa.js` adds a GPA calculator at `#/gpa` (also under Course in every class sidebar, in the account menu, on the account settings page and from each grade calculator). It uses Montana State's 4.0 scale with plus and minus grades (A 4.00, A- 3.67, B+ 3.33 … D- 0.67, F 0). The semester table starts with the student's chosen classes and their credits, and each row shows the letter that class's grade calculator projects from the scores entered there, with a one-click "use it". Add or remove classes, mark one P/W so it is not counted, and see semester GPA, graded credits and quality points, with a Dean's List (3.50 on 12+ credits) or below-good-standing flag. Enter the GPA and graded credits from before this semester for the cumulative GPA and its change; set a goal to see the semester GPA it needs (and roughly which letter in every class), or how many more credits at 4.0 it would take when it is out of reach this semester. A what-if table shows how one grade step up or down in each class moves the result. Everything is saved in the browser.

## Layout: what lives where

- **Header.** Class title, next-exam chip, streak flame, daily goal ring (level inside; tap it for XP, level, goal and today's quests), search, inbox, theme and the account menu. Double XP shows as a chip only while it is on.
- **Sidebar.** Collapsible groups: Today (Dashboard, Learning path, Calendar), Learn, Practice, Tools and Community. Today, Learn and Practice start open; Tools and Community start closed and remember what you choose. The group holding the page you are on always opens. Your level and progress sit under your name; the Pomodoro timer stays at the bottom.
- **Dashboard.** The exam tile, then three panels: Today (classes, due soon, current topic), Your progress (goal, streak, hours, accuracy, cards, unit mastery) and Keep going (Continue on your path, smart review, today's quests). Everything else is behind tabs: This week, Planner, Canvas, League, Community and Tools. The tab you pick is remembered. New users see a Getting started checklist until it is complete or hidden.
- **Landing page.** Hero with your stats, Bo and the league pill, the activity ticker, class cards with Continue, then two tabs: This week (due dates and Canvas) and Community (challenges, boards, latest discussions). Guests get a third tab, What is inside.

## Lessons, quests, leagues and sound

- **Lesson mode** (`#/<class>/lesson?topics=…`, also `unit=`, `exam=` or `smart=1`). One question at a time with a progress bar: pick an answer or type one, press Check, read the green or red feedback with the explanation, press Continue. Hints are one tap away; a solution shown before answering marks the question assisted. Keys 1–4 and Enter work. The end screen shows XP earned, accuracy, time and best combo with confetti at 80%+, and offers another lesson, a review of the missed topics, or the path. Every path stop, the dashboard's Continue button, the landing cards and the quizzer's Lesson mode button start one. Guests get five-question previews.
- **Quests.** Three daily quests picked from a pool (answer N questions, get N right, N in a row, N flashcards, N focus minutes, the daily challenge, N different topics, finish a lesson) at +15 XP each, plus two weekly quests (300 XP, five study days) at +60 XP. Finishing all three daily quests turns on double XP for 15 minutes, shown as a chip in the header. Quests live in the header target button, on the dashboard and in the settings-free popover; they reset at midnight on the device.
- **Leagues** (`#/leagues`, also under Community). Ten tiers from Bronze to Diamond. Everyone competes on a weekly XP board inside their league; every Monday the server settles the week: the top 7 move up (if they earned any XP) and, in leagues of 15 or more, the bottom 5 move down. Promotions get a celebration screen. XP comes from the synced progress blobs, so it counts across classes and devices; the board is cached for 90 seconds. Requires the `league` column and `league_history` table, both added automatically.
- **Celebrations and sound.** A full-screen card with Bo for double XP and promotions; short synthesized cues for right, wrong and finished lessons (no audio files). Sound can be muted in the lesson header or in Settings.
- **Landing.** Course cards show the mastered-topics ring and a Continue button that opens a lesson on your next path stop, a live ticker of recent activity runs under the hero, and the hero shows your league and rank. The sidebar shows your level and progress to the next one.

## Hint ladders

Every generated quiz problem has a "Walk me through it" ladder in practice mode: three progressive hints
(a way to think about it, the procedure, the nearly-there nudge; the problem's own hint is used when it has
one), then the first step of the worked solution, then the full solution. Answering after revealing the full
solution is marked *assisted* and does not count toward accuracy. The hints per topic live in
`assets/ladders.js`; the first step is the first sentence of the explanation (`App.splitSteps`). Exam-prep
solutions reveal step by step, and the daily challenge offers the three hints without the solution.

## Admin panel

`#/admin` (also in the sidebar for staff): Overview with stats and the activity feed, Members (search, ban,
unban, verify, delete), Reports, Contributions queue, Mock exams (schedule and cancel), Site settings
(Canvas feed, announcement banner, Instructor/TA badges) and Digest & cron. Moderators see Reports,
Contributions and Mock exams; administrators see everything.

- **Badges.** On the Members tab, the badge count next to each member opens an editor: click any of the fifteen badges to award or remove it, or use Award all / Remove all. This works on your own account too. Awarded badges show on the member's shelf and on the People page, the member gets an inbox notification, and the automatic badge check never removes them.

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
    canvas.php              Canvas calendar feed sync
    social.php              challenges, badges, presence, sessions, polls, mocks, contributions, digest
  sw.js                     service worker for offline use
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

**Updating without losing users.** Accounts, posts and progress live only in `api/data/` (the SQLite
database and `secret.key`). Those files are never in the zip. Upload a new zip over the old files and
choose "overwrite"; never delete `public_html` or `api/data` first. The PHP files may be overwritten
freely; new tables and columns are added on first request and existing rows are untouched. Put your
own settings (SMTP password, moderators, admins, Canvas feed) in `api/config.local.php`, which is also
never in the zip, so uploads cannot erase them.

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
