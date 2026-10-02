# Mathub

A free study hub for eight Fall 2026 courses at Montana State University:

- **M151Q Precalculus** (Yoshiwara *Modeling, Functions, and Graphs* + *Trigonometry*)
- **M171 Calculus I** (Active Calculus)
- **PHSX 220 Physics I with Calculus** (OpenStax University Physics Vol. 1)
- **WRIT 101 College Writing I**
- **CSCI 127 Joy and Beauty of Data**
- **BIOB 160 Principles of Living Systems** (Campbell *Biology*)
- **KIN 322 Kinesiology** (Biel *Trail Guide to the Body*, suggested)
- **PSYX 340 Psychological Disorders** (Comer & Comer *Psychopathology*)

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
  keeps only events whose course name matches a Mathub class (`canvas_course_match` in `config.php`), and the
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

**My music** is a personal playlist of up to 10 MP3 files, each up to 8 minutes, that the student adds from their own device. Files are kept in the browser's IndexedDB and are never uploaded, so the site hosts no music and every student's playlist is private to that browser. Play/pause, previous/next, shuffle, repeat (all, one, off), seek, volume, reorder and remove; playback continues while moving around Mathub, and the phone's lock-screen media keys work through the Media Session API. Clearing site data removes the files.

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

### Interface rules (2026.10.02 audit)

The site was audited with the impeccable detector and the make-interfaces-feel-better and transitions.dev guides; the fixes live in the "POLISH 2026.10.02" block at the end of `assets/styles.css` and the matching block at the end of `assets/motion.css`. Keep to them when adding UI:

- No text a student has to read below 11 px (`.eyebrow` is 11.5 px). White text needs 4.5:1, so light-mode Physics and Precalc use teal-700 and orange-700, and the dark-mode exam hero mixes each class colour with the background.
- Every pressable control scales to 0.96 on press, never below 0.95. Small icon targets reach 40 px with a pseudo-element instead of growing.
- Close a dialog or toast with `App.dismiss(el)` (in `assets/motion.js`), never `el.remove()`: ids go at once, so lookups and tests treat it as closed, and it eases out over about 190 ms (instantly with Reduce motion).
- Tabs inside `.dash-tabs` get a sliding pill from `initTabs` in `assets/app.js`; sidebar groups wrap their items in `.nav-group-in` and open as a grid-rows accordion.
- On phones (under 900 px) the focus-sounds toggle is the `.amb-top` button in the top bar; the floating bubble only shows on pages without a top bar.

### GSAP

`assets/vendor/gsap.min.js` and `ScrollTrigger.min.js` (GSAP 3.15, standard no-charge license, see the header in each file) are loaded on demand by `assets/gsap-fx.js` and precached by the service worker; no page loads them up front. Two things use them: the weekly recap story in `assets/recap.js` (one timeline per slide, the segment bar drives the auto-advance, hold to pause) and `App.scrollProgress(el)`, a reading-progress line scrubbed to the article on study guides and section notes. With Reduce motion on, or if the scripts fail to load, both fall back to the CSS path. When an element animated by GSAP also has a CSS transition on the same property, turn the transition off while the tween runs (see `.gs-run`).

## CSCI 127 Joy and Beauty of Data and the Code playground

`assets/csci-data.js` adds CSCI 127 (Daniel DeFrance, Fall 2026) from the syllabus and the weekly schedule: every lecture, Tuesday lab, program deadline, the two in-class exams (Sept 23 and Nov 6) and the Dec 14 final on the calendar; the grade calculator with labs 45%, programs 25% and three equal exams at 10% each plus the syllabus scale; 18 topic notes across four units (data types, modules and turtle, functions, selection, strings, iteration, recursion, memory; lists, files, dictionaries; classes, inheritance, OOP principles; NumPy, matplotlib, pandas, Python vs C vs Java), each with big ideas, runnable code examples with expected output, a worked example, common mistakes and an exam tip; a cheat sheet (the "formula sheet" of a coding class, in code); 46 flashcards; practice sets for all three exams; the lab sections and TA table on the syllabus page. `assets/csci-quiz.js` has 17 generators of "what does this print" questions whose answers are computed with Python semantics, so the quizzer, lessons, learning path, daily challenge and mock exams all work for this class.

**Code playground** (`assets/pylab.js`, `assets/pyworker.js`) is the W3Schools-style "try it" editor at `#/csci/playground`: an editor with line numbers, Tab indent and auto-indent after a colon, Ctrl+Enter to run, a program-input box that feeds `input()`, a streamed console, Stop for runaway loops, an examples menu (course examples plus every code block in the notes, which have Try it buttons that open and run them), saved snippets, share links that carry the code, and 2 XP per successful run (10 a day). Python is Pyodide (CPython compiled to WebAssembly) running in a Web Worker, fetched from the jsDelivr CDN on first use (about 12 MB, cached by the browser); NumPy, pandas and matplotlib download the first time they are imported. The worker ships its own `turtle` module that records every move and renders the finished drawing as SVG (moves, turns, pen, colors, fills, circles, dots, stamps, write, Screen size and background); key, mouse and timer events are noted but need a real window. matplotlib figures come back as PNGs through the Agg backend. Nothing is uploaded; files written by a program exist only during that run.

## BIOB 160, KIN 322 and PSYX 340

Three classes built from their Fall 2026 syllabi, each with the full set: calendar, exams and exam prep, topic notes, flashcards, a formulas or criteria sheet, a quizzer, practice sets, the syllabus page and a grade calculator.

- **BIOB 160 Principles of Living Systems** (`assets/biob-data.js`, `assets/biob-quiz.js`; Dlakic and Dyer). 22 topics following the lecture schedule, from the chemistry of life through energy and cells, cell division and genetics, to DNA, gene expression and DNA technology, with Campbell reading pages in each tip and free OpenStax Biology 2e links. The three 5-hour-window exams and the cumulative final (Dec 16) are on the calendar; the grade calculator uses the 400-point breakdown. The quizzer generates Punnett squares, the product rule, sex linkage, recombination and map order, Hardy–Weinberg, pH and molarity, isotopes and half-lives, complementary strands, transcription and translation with the full codon table, mutation types, chromosome counts, respiration bookkeeping, tonicity, coupled ΔG, PCR and restriction fragments, all with computed answers.
- **KIN 322 Kinesiology** (`assets/kin-data.js`, `assets/kin-quiz.js`; Jim Becker). 14 topics from planes and axes to gait. Lectures, homework, the five review-quiz windows, the two-part exams (Tuesday closed-note, Thursday open-note) and the Dec 15 final are on the calendar. Labs run in six sections, so the class uses **variants**: pick your lab section in Settings and every lab and lab practical moves to your day (unset, each lab shows as a weekly item). The grade calculator applies the syllabus's **six exam-weighting options** (`GRADING.options`) and uses whichever gives the highest grade. The quizzer covers planes and axes, lever classes, torque and muscle force, mechanical advantage, stress and strain, contraction type, the convex–concave rule, spinal cord levels, scapulohumeral rhythm, carpals, ROM norms, knee tests, leg compartments, Trendelenburg and gait timing.
- **PSYX 340 Psychological Disorders** (`assets/psyx-data.js`, `assets/psyx-quiz.js`; Barbara Drescher). 18 topics on the disorders in the syllabus, summarized from the DSM-5-TR in our own words. The two sections meet on different days (Tue/Thu and Mon/Wed), so calendar rows and exam dates follow the section chosen in Settings (or typed on the account). The quizzer includes timing and counting rules: mood episodes, PTSD vs acute stress disorder, substance use severity, the psychosis duration ladder, anorexia BMI severity, ADHD thresholds and personality clusters.

**How variants work.** A class may define `VARIANTS = { label, default, options: [{ id, label }], hint?, saved? }`. Calendar rows carry the variant id in their fifth field (`[date, type, title, topicId, variantId]`; the fourth field stays the topic id that drives "current topic"), and exams may carry `dates` and `dateLabels` keyed by variant. `App.applyVariant(C)` filters the calendar and sets the exam dates at boot, after the class loads and after account preferences sync.

Also new for every class: definition lines (`{ n, d }`) on the formulas sheet and the cheat-sheet builder, an exam `format` line on exam prep (defaults to "Closed book, no devices."), a class-specific title and note on the formulas page (`formulasNote`, `filterExample`), and the new colours (lime, amber, rose) in light and dark.

## Request a class

`#/request` (`assets/requests.js`, `api/requests.php`). Students who don't see their class send its course code (normalised to MSU style, e.g. `chmy121` → `CHMY 121`), optional name, term and instructor, and the syllabus as a PDF or Word file (up to 10 MB) or pasted text, with a consent box. Links lead there from the start page (under Your classes), the class picker, Settings, and search (typing an unknown course code offers "Request CHMY 999"). Codes already on Mathub are caught as you type.

- **Storage.** Requests live in the `class_requests` table (created on first use). Files go to `api/data/syllabi/` under random names, with `Require all denied`, and are only served to administrators through `admin_classreq_file` as attachments. `api/.user.ini` raises PHP's upload limit to 12 MB for the API.
- **Demand.** Requests for the same code are grouped. The page shows a public **Most requested** list (codes and counts only, never names or files) with a one-click **Me too**, and each student's own requests with their status.
- **Admin panel → Class requests.** Groups sorted by demand, with each requester, their note, and the syllabus download. Buttons set the status for everyone who asked: **Working on it**, **Mark added** (asks for the Mathub class id, so the inbox message links to it), **Can't add** (with a reason) or **Back to new**. Each change sends an inbox message (and a push when added); admins get an inbox alert for a new class or a first syllabus. A delete button removes spam.
- **Limits.** 8 requests per student per day, 10 open at once, one open request per class per student; banned accounts cannot request. Students can withdraw a request while it is new, which deletes the file.
- **Sidebar.** Inside any class, a full-width **Request a class** link sits under the class switcher.

## Add a class from the admin panel (class packs)

The workflow is syllabus in, one file out, upload, done. Full format: [`packs/README.md`](packs/README.md).

1. Claude turns a syllabus into `packs/src/<id>.js` and runs `node scripts/make-pack.js packs/src/<id>.js`. The script checks everything and generates 400 questions from each question set. It then writes `packs/<id>.mathub.json`.
2. In **Admin panel → Add a class** (`#/admin/packs`), choose that file. The panel checks it again and shows the counts, any problems and sample questions. Press **Add class**. It can tell every student who requested the course code, with an inbox message and a push, and it can add the class hidden for review first.
3. The class appears for everyone, including on the start page, sidebar switcher, search, Today, resources, the calendar feed, reminders, discussions, leagues and Canvas matching. It gets every standard class view, the quizzer and everything built on it.

How it works:
- **Data only.** A pack is JSON and never code. `assets/classpacks.js` cleans every string to a short list of formatting tags and safe links. It builds questions from four declarative types: `bank`, `table`, `calc` and `calc-mc`. Calculated answers use a small expression language with no `eval`.
- **Storage.** Packs live in the `class_packs` table (`api/packs.php`), so database backups include them. The previous version is kept for **Previous version** (rollback). **Hide** keeps a class for admins only, and **Delete** asks for the course code.
- **Saved progress survives.** Students' progress and discussion posts are stored under the class id, so they come back if the class is re-uploaded.
- **Loading.** Browsers fetch the list of packs (`classpack_list`, light stubs) on every visit and keep a copy for offline use. A class's full file is fetched the first time it is opened and cached by version. An update reaches students on their next visit.
- **Server class lists.** Lists that used to be hard-coded (discussions, goals, profile classes, emails, the ICS feed, Canvas matching) now come from `mh_course_ids()` and `mh_course_names()` in `api/lib.php`, which add the installed packs to the built-in classes.
- **Not available to uploaded classes:** custom tools (graphers, solvers, the Python playground) and the static `/learn/<id>/` pages and share images. Those still need a built-in class.

## GPA calculator

`assets/gpa.js` adds a GPA calculator at `#/gpa` (also under Course in every class sidebar, in the account menu, on the account settings page and from each grade calculator). It uses Montana State's 4.0 scale with plus and minus grades (A 4.00, A- 3.67, B+ 3.33 … D- 0.67, F 0). The semester table starts with the student's chosen classes and their credits, and each row shows the letter that class's grade calculator projects from the scores entered there, with a one-click "use it". Add or remove classes, mark one P/W so it is not counted, and see semester GPA, graded credits and quality points, with a Dean's List (3.50 on 12+ credits) or below-good-standing flag. Enter the GPA and graded credits from before this semester for the cumulative GPA and its change; set a goal to see the semester GPA it needs (and roughly which letter in every class), or how many more credits at 4.0 it would take when it is out of reach this semester. A what-if table shows how one grade step up or down in each class moves the result. Everything is saved in the browser.

## Today: one plan across every class

`#/today` (Today in the account menu, the mobile tab bar and the hero button) builds one checklist for the day from all your classes: flashcards that are due on a spacing schedule (a card you get right comes back after 1, 3 and then 14 days; one you miss returns tomorrow; up to ten new cards per class), a lesson on your weakest topic (lowest accuracy over at least four questions, otherwise where the class is right now), the daily challenge, and anything due in the next 48 hours. The review player runs across classes inline (space flips, 1 = again, 2 = got it) and counts toward XP, quests and the streak. A summary card on the landing page shows what is left. Today's counts work from the light class index even before a class has been downloaded; pressing Start downloads what it needs.

## Report a problem

A small flag sits on every practice question, lesson step, flashcard (in the control row) and topic page. It opens a dialog with the reason (wrong answer, typo, unclear, bug, other), an optional comment and, for questions, the student's own answer. Reports go to `issues` in the database (guests can report too; twenty per hour per address) and appear under **Problems** in the admin panel (moderators and admins), with open/resolved/all filters, the page link and the build. Resolving a report with a note sends the reporter an inbox notification; the same prompt reported by several people is counted.

## Only the class you open is downloaded

`assets/courses-index.js` is a generated light index of every class (facts, exams, calendar, unit and topic titles, quiz topic names, counts, and the list of files the class needs). The shell loads only that; `App.loadCourse(id)` fetches a class's data, question generators and tools the first time it is opened (a skeleton shows while it loads, with a retry button if the download fails) and merges them into the same object. The landing page, Today, search, GPA and calendars work from the index. Search downloads your other classes in the background the first time it opens so results cover everything; the class you visited last is prefetched when the landing page is idle. The service worker still precaches every class for offline use. **After editing any `*-data.js` or `*-quiz.js` file, run `node scripts/build-course-index.js`** so the index (titles, counts, calendars) matches.

## Push notifications

Settings → Account → "Notifications on this device" turns on web push (Chrome, Edge, Firefox, Safari 16.4+; on iPhone the app must be added to the home screen first). The server signs pushes with VAPID keys it generates once into `api/data/vapid.json` (PHP's OpenSSL, no extra library) and sends an empty push; the service worker then asks the server what is pending and shows it. Reminders go out in the evening before something is due and when a streak is at risk, at most once a day per account, from the same housekeeping pass that sends digest emails (any request triggers it; a cron hitting `api/index.php?r=health` every 15 minutes keeps it timely on a quiet site). "Send a test" checks the device end to end. Subscriptions that a browser has dropped are removed automatically.

## Install prompt, global search, synced preferences

- **Add to home screen.** From the second visit a banner offers to install Mathub: the native prompt on Chrome and Edge (Android and desktop), and step-by-step Share → Add to Home Screen instructions on iPhone and iPad. Dismissing hides it for a month; "Install the app" also lives in the account menu whenever installing is possible. The manifest has shortcuts (Today, Discussions, GPA) and a maskable icon.
- **Search everywhere.** Ctrl/⌘ K (or the search icon on the landing page) searches notes, formulas, flashcards, calendars, practice topics and pages across every class, with class chips to narrow it; each result shows its class.
- **Preferences follow your account.** GPA calculator entries, focus-sound choices, daily goal, theme, phonetics and reader voices, seen-changelog and Today state sync through `prefs` (newest wins). Course progress already synced.

## Backups

The server copies the SQLite database once a day (SQLite's own `VACUUM INTO`, consistent while in use) into `api/data/backups/`, which the web server cannot serve, and keeps the last fourteen automatic copies; manual copies are kept until deleted. The admin panel's **Backups** tab lists them, makes one on demand and downloads any of them. Restore = stop, replace `api/data/mathub.sqlite` with a backup, start.

## Empty states, accessibility, what's new

- Empty panels get Bo and a short line; loading placeholders become skeleton bars automatically.
- Accessibility: a skip link is the first tab stop, every control has a name, dialogs are announced, small text and chips meet WCAG AA contrast in both themes, and `tests/a11y.test.js` runs axe-core over the main pages so it stays that way.
- `#/whatsnew` lists every release (a dot in the account menu until you have seen the latest); `learn/whats-new.html` is the public copy for search engines and links.
- Every class has its own social card (`assets/og-<class>.png`, made by `node scripts/build-og.js`) used by its study-guide pages.

## Tests

`tests/` holds headless Chromium checks (Playwright) that cover the classes, the Python playground, phonetics, GPA, the SEO pages, Today, problem reports, the admin tabs, push and preference routes, on-demand loading, the accessibility audit, the motion layer and skins, resources and guides, the focus room, Blitz, tools, the weekly recap, the tour and printing, the geek mode, the Realm look, pixel art, the simpler layout (`simple-layout.test.js`: the start page groups, the sidebar groups, the dashboard tabs and what newcomers see) and the interface polish (`polish.test.js`: the type floor, class-colour contrast, the tab pill, the sidebar accordion, dialog and toast exits, the phone focus-sounds button, the GSAP recap and reading line, and Reduce motion). One-time setup: `cd tests && npm install` (Playwright downloads its Chromium). Then `node tests/run.js` starts PHP's built-in server on 127.0.0.1:8766 if nothing is listening, runs every `*.test.js` and prints a summary; `node tests/run.js today` runs the suites whose names contain "today". The playground test uses the Pyodide CDN unless a local mirror is unpacked into `tests/pyodide/package/` (a PHP router for it is included). The suites log in with the seeded test accounts (`alice.a@montana.edu`, `mod.user@montana.edu`, `admin.user@montana.edu`, password `password123`), which exist only in a development database.

## Focus room, resources, guides, readiness, Blitz, your week, tools

- **Focus room** (`#/focus`, the hero button, the account menu, the mobile tab bar). One task, one timer (25, 50, 90 minutes or custom), the sound bubble one tap away, full-screen option, space to pause. Leave the page and a pill keeps the time; finish and the block is logged into the class's `sessions` (synced), your streak, the focus quest and XP (one per minute, up to 90). A daily focus goal (Settings or "change goal") shows as a bar. Sessions per day live in `settings.focusLog` and `focusSessions` (synced).
- **Resources** (`#/resources`, `#/<class>/resources`, "Resources & guides" in every class sidebar). `assets/resources-data.js` holds about 130 curated links in groups (every class, Montana State, one per class, wellbeing) with a kind (videos, practice, tools, free books, reference, MSU, community, apps, wellbeing) and tags. Search, kind chips, and a pin on every item saves it to `settings.savedResources` (synced). Links open in a new tab; every item carries a flag ("A link is broken or has moved") and "Suggest a resource" opens the report form with that reason, so suggestions land under Problems in the admin panel. Links could not be verified from the build environment, so the flag matters: fix a moved link in the data file.
- **Study guides** (`#/guides`, `#/guides/<id>`). Sixteen original guides in `assets/guides-data.js` as simple blocks (heading, paragraph, lists, tip, quote, with **bold** and [links]). "Mark as read" gives 5 XP once and shows a check; three guides rotate daily on the landing page; the search index includes them; each guide is also a static page under `learn/guides/` for search engines.
- **Exam readiness** (`assets/readiness.js`). `App.readiness(class)` scores the next exam from practice accuracy and volume per topic on that exam (60%), flashcard boxes for those sections (25%) and the prep checklist (15%), and names the three weakest topics with a link to the lesson (under five questions) or practice. Shown as a gauge and panel on the class dashboard, as a column in Today and on the landing countdown.
- **Blitz** (`#/<class>/blitz`, under Practice). Ninety seconds of multiple-choice questions from the topics covered so far; ×2 after three in a row, ×3 after six, ×4 after nine; a miss resets the combo. Answers count toward progress and quests; XP is awarded once at the end (2 per correct answer, +10 for a new best, cap 50). Best score and plays are stored in the class data (`blitz`).
- **Your week** (`#/recap`, "Your week" in the account menu). Five animated slides from local data: days studied, XP per day, questions and accuracy, cards and focus minutes, verdict and streak. The share button renders a 1080×1080 card on a canvas and uses the Web Share API where available, otherwise downloads a PNG. A banner offers last week's recap once on the landing page.
- **Tools** (`#/tools`). Scientific calculator on the app's expression engine (degrees or radians, factorial, history, `ans`), a unit converter for fourteen quantities including temperature, a citation builder for websites, books and journal articles in MLA 9 and APA 7, a word counter with sentences, reading and speaking time, reading ease and most-used words, and a significant-figures helper.

## Motion, looks, tour, print

`assets/motion.css` and `assets/motion.js` add staggered card entrances, ring and progress-bar fills, a top loading bar while a class downloads, button and chip micro-interactions, feedback on answers, a theme fade, and hover polish. Settings → Appearance offers five looks (Classic, Bobcat, Paper, Forest, Midnight) via `data-skin` on the root, and a Reduce motion switch (`data-motion="off"`, also honored from the OS setting) that turns every animation off. Both are applied before first paint by the inline script in `index.html` and follow the account. A five-step tour runs once on the landing page (`assets/tour.js`, "Show the tour again" in Settings). Notes, formula sheets, calendars, planners, exam prep and the GPA page have a Print button, and the print stylesheet drops the chrome.

## Mistakes notebook, streak freezes, cheat sheets, personal notes

- **Mistakes** (`#/mistakes` for every class, `#/<class>/mistakes` under Practice). `App.recordMistake(question, class)` runs whenever an answer is wrong in practice, a lesson, Blitz or the daily challenge and stores the question with its explanation in the class data (`mistakes`, synced; 120 per class). The retry player brings each one back the day after a miss and three days after a hit; two hits in a row clear it. Today shows a "Retry N mistakes" row.
- **Streak freezes.** Hitting the daily XP goal on three days of an ISO week earns one freeze (bank of two, `settings.freezeBank`, synced). When yesterday was missed and the day before was not, a freeze is applied automatically: the day is marked `freeze` in the class activity so the streak count, the server's streak-at-risk logic and the popover all agree. The streak popover shows the bank and the goal-day count.
- **Cheat sheet** (`#/<class>/cheatsheet` under Learn). Tick formulas from the formula sheet and the key formulas, big ideas and pitfalls of any topic, add your own lines, pick columns and size, print. "Suggest for next exam" pre-selects the formulas for the sections on the next exam. Saved per class (`cheatsheet`, synced).
- **My notes and highlights.** Every topic page ends with a notes box (saved as you type) and a highlighter: select text in the notes and tap Highlight. `#/<class>/mynotes` lists them per topic with print and export. Stored as `mynotes`, `mynotesAt` and `highlights` in the class data.

## Calendar feed, focus together, invites, announcements, growth

- **Calendar subscription.** Settings → Calendar subscription shows a private link (`api/index.php?r=ics&t=<token>`) that serves every deadline and exam of the member's classes as an iCalendar feed, all-day events with the time in the title, plus Canvas events, with a reminder a week before each exam. Subscribe from Google Calendar (From URL), Apple Calendar or Outlook; the feed refreshes every few hours. "New link" invalidates the old one. The server reads class calendars from the generated `assets/courses-index.js`.
- **Focus together.** While a focus block runs the client pings `focus_ping` every 30 seconds; the room lists everyone in a block (name, task, time left) and the site's focus minutes for the day. Members can hide themselves in Settings ("Show me in Focus together"); members hidden from leaderboards appear as "Anonymous student".
- **Class goals and section boards.** Every progress save updates `weekly_stats`; `class_goal` sums each class's questions answered this week against a goal that scales with members. The dashboard and landing page show the bar. `league_section` ranks the week's XP among members who set the same section for a class (Settings → classes and sections), shown at the bottom of the Leagues page.
- **Announcements.** Members with a staff role (Instructor, TA, via the admin panel's role editor) and moderators can post an announcement to a class or to everyone (text, optional link, days to show); it appears at the top of the class dashboard's community panel. Staff can also pin and lock threads and mark a mock exam official.
- **Invite links.** Settings → Invite a classmate gives each member a code; `#/join?ref=CODE` greets the visitor with the inviter's first name and stores the code. A sign-up that carries it records `invited_by`, and verification awards the Invited badge to the newcomer and the Recruiter badge to the inviter.
- **Sunday planning email.** Opt in under Settings → Plan the week. Sundays after 3 pm the housekeeping pass emails next week's deadlines by day, a link to the recap and one suggested focus block.
- **Growth tab** (admin). Sign-ups per week, active members per day, retention by sign-up week (seen again after 1, 7 and 30 days) and a table of what people use (page views and key actions, this week vs. last). Activity is recorded from any signed-in request (`user_days`) and counted events (`metrics`); the client batches page views and posts them quietly.

## The look

The logo is the Mathub mark: a navy M whose right diagonal is a rising blue arrow, the wordmark "Mathub" in Poppins, and the line "Learn / Practice / Excel" with blue slashes. `assets/mark.svg` is the bare mark, `assets/icon.svg` the mark on a white tile (favicon, home-screen icon), `assets/logo.svg` the full lockup, `assets/logo.png` a 1200px raster of it for places that cannot take SVG. In the app the mark is drawn by `App.logoSvg(size, tile)` from `App.LOGO_PATHS`, so its colours follow the theme (`--brand-navy`, `--brand-blue`: navy and #1F5EFF in light mode, white and a lighter blue in dark mode). `node scripts/build-icons.js` renders the PNG sizes plus a maskable 512 with the safe-zone padding, `node scripts/build-og.js` the social cards, `node scripts/build-seo.js` the static pages, which share the lockup.

Pages that belong to no class (start page, Today, Focus, Settings, board, resources) use the brand blue as their accent; every class keeps its own hue. The colour system in `styles.css` ("Look v3") gives every other hue a meaning: indigo for learning, green for progress and readiness, amber for XP and rewards, coral for deadlines and mistakes, teal for focus, violet for community and creative tools. Sidebar groups, panel icons, the mobile tab bar and calls to action follow it, a four-hue wash sits behind the page, and the floating background carries glyphs from every subject in that subject's hue.

## Pixel art

`assets/pixel.js` holds hand-drawn sprites as character grids (one letter per colour, `.` for transparent; symmetric sprites are drawn as a left half and mirrored) and draws them as crisp SVG, one path per colour with horizontal runs merged, so each sprite is a few hundred bytes and stays sharp at any size. `App.pixel(name, scale, { still, cls, label })` returns the SVG; sprites with a second frame (Bo blinking, the invader marching, the terminal cursor) swap frames with CSS `steps()` and hold their first frame when motion is reduced. The skyline (the Bridger Range, pines, a sun and clouds) is generated so it tiles seamlessly and is exposed as `--px-skyline` for the start page hero. Sprites appear in empty states (`App.pixelFor(text)` picks a stable friend per message), the XP pop-up, the streak chip, level-up toasts, quest and lesson celebrations, class loading, the "game over" load error, the footer signature, Blitz and the character sheet. Small arcade labels use Press Start 2P, loaded from Google Fonts like Poppins (its licence reserves the name, so it is not self-hosted). `tests/pixel.test.js` covers it.

## The Realm look and the tabletop layer

Classic is the default look (`App.skinOf()` returns `default` when nothing is saved); Realm is an opt-in skin in Settings → Look. `assets/realm.css` (generated by `node scripts/build-realm-css.js`, edit that script) holds the whole look, scoped to `:root[data-skin="realm"]`: parchment tokens by day and dungeon tokens by night (pages outside a class use crimson, or gold with dark text at night), Cinzel for display type while body text stays Helvetica Neue, gold corner ornaments on panels, gem-style primary buttons, a map and compass on the start page by day and a night sky by night, and a flourish under page headings. The ornaments and textures are inline SVG generated once and defined as `--img-*` variables. Fonts live in `assets/fonts`: Cinzel (display) and a runic subset of Noto Sans Runic, both SIL OFL.

`assets/realm.js` adds the tabletop features, which work in every look: class archetypes (`App.archetype(id)`), the d20 quest roller (any element with `data-roll="all"` or a class id; `App.rollOutcome(r, ids)` is the pure rule: a natural 20 links to a Blitz, a natural 1 to the weakest topic with 3+ answers, other rolls pick a topic weighted towards weak ones and set a DC; XP never changes), and the character sheet at `#/sheet` (`App.abilities()`: STR from the streak, DEX from the best Blitz, CON from focus minutes this week, INT from 30-day accuracy once there are 10 answers, WIS from flashcards reviewed in two weeks, CHA from days studied in thirty; scores are clamped to 3 to 20 with the tabletop modifier). `gami.js` gives Bo a hat that only shows in Realm, Realm level names, and runes, marks and dice in the animated background; `geek.js` decodes with runes and teleports in Realm. `tests/realm.test.js` covers it.

## Geek mode

`assets/geek.js` (styles at the end of `assets/motion.css`) layers terminal and CRT style transitions on the motion system. After each route change it sweeps a scanline across the screen, types the route into a status line with the real time the navigation took, and decodes the page heading, the breadcrumb and the first panel titles from random glyphs into their text. The decode starts in a microtask after the router has read the heading (for "pick up where you left off"), keeps the real text in `aria-label` while it runs, locks the heading height so the page does not jump, and skips headings with math. Opening a class prints a boot log from the `mh:load`, `mh:file` and `mh:loaded` events that `App.loadCourse` dispatches. Dialogs power on like a monitor, toasts read like shell output, dashboard tabs swap with a stepped wipe, cards materialise, primary buttons shed bits and the Konami code rains glyphs. The setting is `geek` (synced; on unless set to false), and `html[data-geek]` is only "on" when motion is not reduced. The browser tests turn it off by default so text checks never race a decode; `tests/geek-mode.test.js` turns it on, and `MATHUB_GEEK=1 node tests/run.js` runs every suite with it on.

## Typography

The whole site is set in Helvetica Neue (`--font-sans` in `styles.css`, also used for `--font-display` and `--font-body`). Macs, iPhones and iPads render their built-in Helvetica Neue; other devices fall back to TeX Gyre Heros, a free Helvetica-metric family from the GUST e-foundry served from `assets/fonts` (regular, bold, italic, bold italic as WOFF2, licence in the same folder). The two exceptions are the logo wordmark, which stays Poppins because it is part of the logo, and code, which stays JetBrains Mono. Emails use the same stack, and the social cards embed the fallback so they render identically on the build machine.

## Layout: what lives where

The layout is built for someone opening Mathub for the first time: a few groups per screen, the rest one tap away.

- **Header.** Class title, next-exam chip, search, theme and the account menu. The streak flame and the daily goal ring (level inside; tap it for XP, level, goal and today's quests) appear after your first bit of studying; the inbox bell only for signed-in members. Double XP shows as a chip only while it is on. Visitors get a one-line preview note with a sign-up link; closing it is remembered on that device.
- **Sidebar.** Five groups by intent: Study (dashboard, notes, formulas, flashcards, practice, exam prep), Plan (calendar, learning path, planner, grade and GPA calculators), More tools (mistakes, Blitz, cheat sheet, my notes, textbook, class tools), Community (discussions, challenge, study sessions, mock exams, contribute, leagues, people) and Class info (syllabus, resources, settings). Study and Plan start open, the rest fold away and remember what you choose; the group holding the page you are on always opens. `App.groupNav` builds the groups from each class's own `NAV`, and any tool not named in the plan lands in More tools.
- **Dashboard.** The page head with the d20, a Getting started checklist for new users, a streak warning when one is at risk, then the exam card with a one-line readiness summary ("How to raise it" opens the Readiness tab). Below it two panels: Today (classes, due soon, current topic) and Keep going (continue on your path, smart review). Five tabs hold the rest: This week (with Canvas), Readiness, Progress (goal, streak, hours, accuracy, cards, unit mastery, daily quests and your league), Planner and Community. The tab you pick is remembered.
- **Start page.** Four groups: the header (date, logo, one sentence, the next-exam countdown, Today, search, account, theme), *Your next step* (today's plan or, for first-time visitors, three numbered steps, the resume card, and a row of quick actions: Focus timer, Roll a quest, GPA calculator, Choose classes), *Your classes* (cards with what is being covered, the next exam, one Continue button, Open class and a progress ring) and *Explore* with tabs: This week (next seven days across classes and Canvas), Community (who is studying, your league, challenges, sessions, latest discussions), Guides, and for visitors What is inside.

## Lessons, quests, leagues and sound

- **Lesson mode** (`#/<class>/lesson?topics=…`, also `unit=`, `exam=` or `smart=1`). One question at a time with a progress bar: pick an answer or type one, press Check, read the green or red feedback with the explanation, press Continue. Hints are one tap away; a solution shown before answering marks the question assisted. Keys 1–4 and Enter work. The end screen shows XP earned, accuracy, time and best combo with confetti at 80%+, and offers another lesson, a review of the missed topics, or the path. Every path stop, the dashboard's Continue button, the landing cards and the quizzer's Lesson mode button start one. Guests get five-question previews.
- **Quests.** Three daily quests picked from a pool (answer N questions, get N right, N in a row, N flashcards, N focus minutes, the daily challenge, N different topics, finish a lesson) at +15 XP each, plus two weekly quests (300 XP, five study days) at +60 XP. Finishing all three daily quests turns on double XP for 15 minutes, shown as a chip in the header. Quests live in the header target button, on the dashboard and in the settings-free popover; they reset at midnight on the device.
- **Leagues** (`#/leagues`, also under Community). Ten tiers from Bronze to Diamond. Everyone competes on a weekly XP board inside their league; every Monday the server settles the week: the top 7 move up (if they earned any XP) and, in leagues of 15 or more, the bottom 5 move down. Promotions get a celebration screen. XP comes from the synced progress blobs, so it counts across classes and devices; the board is cached for 90 seconds. Requires the `league` column and `league_history` table, both added automatically.
- **Celebrations and sound.** A full-screen card with Bo for double XP and promotions; short synthesized cues for right, wrong and finished lessons (no audio files). Sound can be muted in the lesson header or in Settings.
- **Landing.** Course cards show the mastered-topics ring and a Continue button that opens a lesson on your next path stop; recent activity, your league and rank sit in the Community tab. The sidebar shows your level and progress to the next one.

## Hint ladders

Every generated quiz problem has a "Walk me through it" ladder in practice mode: three progressive hints
(a way to think about it, the procedure, the nearly-there nudge; the problem's own hint is used when it has
one), then the first step of the worked solution, then the full solution. Answering after revealing the full
solution is marked *assisted* and does not count toward accuracy. The hints per topic live in
`assets/ladders.js`; the first step is the first sentence of the explanation (`App.splitSteps`). Exam-prep
solutions reveal step by step, and the daily challenge offers the three hints without the solution.

## Admin panel

`#/admin` (also in the sidebar for staff): Overview with stats and the activity feed, Members (search, ban,
unban, verify, delete), Add a class (class packs), Class requests, Reports, Problems (flagged questions and notes), Contributions queue, Mock exams
(schedule and cancel), Site settings (Canvas feed, announcement banner, Instructor/TA badges), Backups
and Digest & cron. Moderators see Reports, Problems, Contributions and Mock exams; administrators see
everything.

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
    push.php, extras.php    web push (VAPID), problem reports, backups, synced preferences
    growth.php              calendar feed, focus together, metrics, class goals, announcements, invites, planning email
  learn/                    static study guides (generated), sitemap.xml, robots.txt
  tests/                    browser checks (not needed on the server; safe to leave out of the upload)
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
  `assets/calc-data.js`, `assets/physics-data.js`, `assets/precalc-data.js`, `assets/writ-data.js` and
  `assets/csci-data.js`. After editing them run `node scripts/build-course-index.js` (the light index
  the shell loads) and `node scripts/build-seo.js` (the static study pages).
- Question generators live in `*-quiz.js`. Each function returns one question; add a function and list
  it in `GENERATORS`.
- Week-by-week lecture topics for physics and precalculus are estimated from the syllabus topic order
  and the exam dates; adjust `CALENDAR` when Canvas modules differ.
- When you change any file in `assets/`, bump the build string at the top of `index.html`
  (`data-build` and `MATHUB_BUILD` and the `?v=` suffixes) so browsers fetch the new files, and add
  an entry to `assets/changelog.js` so What's new and `learn/whats-new.html` mention it.
- Adding a class: the quick way is a class pack uploaded in the admin panel (see "Add a class from the admin panel" above). For a built-in class with custom tools, write `<id>-data.js` (and `-quiz.js`, `-tools.js` as needed), list its files in
  `scripts/build-course-index.js`, add the id to `COURSE_ORDER` in `assets/app.js` and to the service
  worker's shell list, then run the three build scripts (`build-course-index`, `build-og`, `build-seo`).
