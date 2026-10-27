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
author), reports, **blocking** (Block under any post or comment hides that member's posts, comments, study
sessions and notifications from you at once, files the item in the report queue, and is undone under
**Settings → Blocked members**; table `member_blocks`, routes `forum_block`, `forum_blocks`, `forum_unblock`;
blocking from an anonymous post hides only that member's anonymous posts, so a block never reveals who wrote one),
and a language filter that censors curse words and slurs (server side, in
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
- **Draft feedback** (`#/writ/drafts`; `assets/drafts.js`, `assets/drafts.css`, `api/drafts.php`). A student pastes a project draft (or opens a .docx, .pdf, .odt or .txt file, read in the browser by `assets/officekit.js`; a Google Doc is downloaded as Word or pasted), picks the project and whether it is a first or revised draft, and can say what they want feedback on and paste their peer review comments. Bo reads it like a writing-center tutor against that project's goals (`DRAFTS` in `assets/writ-data.js`, copied to `api/classdata` by `scripts/build-classdata.js`) and sends back JSON: his overall read, one or two strengths, the two or three biggest revisions (each with where it shows and a question), four to ten margin comments, and three next steps. The page shows the draft on paper with each commented passage highlighted (numbers for comments, letters for revisions; click either way between a passage and its note) and Bo's notes beside it, stacked on a phone. **He only comments**, because the syllabus allows AI only where the instructor says so: the prompt (`MH_DRAFT_SYS`) forbids writing any of it for them, and the server drops a comment whose quote is not in the draft or that writes wording for the student (`mh_draft_unwrite`: "you could write…", or a quoted passage of six words or more the draft does not have). Each review is kept with the account as a version of its project (twelve at most); the next one is given the earlier feedback and says what changed, and the page counts the paragraphs new or changed. Paid in credits ("Draft feedback" on Usage; the model is `ai_model_draft`, else Bo's chat model). The class's instructor (the syllabus email, `COURSE.email`) or an administrator can switch it off for the class on the page (`ai_draft_switch`); students then see a note and keep their past reviews. The writing dashboard's deadline tile offers "Get feedback on your draft" when a project draft is due next. Drafts are in Download my data and are deleted with the account. Tests: `tests/drafts.test.js`.
- **Working with Bo's notes.** Under each revision and margin comment the student can press **Done** or **I disagree** (with an optional reason, `ai_draft_respond`; kept with that version). The next review is given their answers (`THEIR ANSWERS TO YOUR EARLIER NOTES`): Bo drops a point when their reason holds, says in one sentence why it still matters when it does not, and treats "done" as done only when the draft shows it. **Ask Bo about this** opens the floating Bo on that note (the quote and the note go with the question, with "What do you mean here?" ready to send). In a writing class (`kind: 'writing'` or any class with `DRAFTS`) Bo's chat and calls also get `MH_AI_WRITING`: the words in their papers stay theirs, so he teaches with examples from the readings and questions instead of writing sentences for them.
- **Read your draft aloud.** The review has the same sentence-by-sentence reader as the Readings: the browser's own voice, the sentence marked in the draft (the CSS Highlight API, a paragraph tint where it is missing), speed from 0.8× to 1.5×, click a paragraph to jump there. No credits; nothing leaves the device.
- **Revision history** (`#/writ/draft-history/<project>`, `ai_draft_history`). Every version of a project, oldest first; any two compared side by side or in one text (paragraphs matched first, then the words of the ones that changed, both by longest common subsequence); what became of each of Bo's biggest revisions at the next version (his word: done, partly, not yet; theirs: done or disagreed); four reflection questions with no AI; and a Word file of all of it (`App.Office.docx`) or print. Linked from each review and from the drafts list, and from the notebook's reflection entries.
- **Writer's notebook** (`#/writ/notebook`; `assets/notebook.js`, `api/notebook.php`). The fifteen notebook entries (`NOTEBOOK` in `assets/writ-data.js`: the count, the deadline they are handed in with, each entry's week, and titles or prompts where the syllabus gives them). A list with this week's entries marked, and an editor with the prompt the student copies in and their entry, saved as they type with a word count. Private and with no AI: only the writer reads it, and the floating Bo is not on the page. A copy of unsaved typing stays in the browser until the server confirms it (offline, a closed tab), and goes up when the page opens again. Each save names the version it was written on and the device (`base`, `dev`): when another device changed the entry since, the server refuses it (409) with the saved one, and the page keeps both and asks which to keep. The whole notebook downloads as one double-spaced Word file (an entry per page, with its prompt), as plain text, or prints. Deleted with the account. Tests: `tests/notebook.test.js`.
- **Any class with papers.** Draft feedback and the notebook are class data, not WRIT 101 code: a class pack (or built-in class) with `DRAFTS` (projects: `id`, `short`, `name`, `brief`, `goals`, and the exam ids of the `draft` and `revised` deadlines) and `NOTEBOOK` (`count`, `due`, `entries`) gets both pages in its sidebar. The class-pack checker validates them. Packs uploaded in the admin panel now reach the server's AI routes too (`mh_ai_class` reads the `class_packs` table, with the same visibility as `classpack_get`), so Bo also knows the class's syllabus in its chat.
- **Office files in the browser** (`assets/officekit.js`, `App.Office`). Zip and unzip (with the browser's own deflate), the text of a .docx, .odt or PDF, and a .docx written from paragraphs and headings. PDFs are read with pdf.js (`assets/vendor/pdfjs/`, Apache-2.0, the legacy build, loaded only when a PDF is opened): lines by position, a new paragraph where the gap between lines is wider than usual or a line is indented, page numbers and running heads ("Smith 2") left out, a hyphen at a line end kept. A scanned or password-protected PDF says what to do instead. Nothing is uploaded to read a file.

## For instructors (`#/<class>/instructor`, `#/instructors`)

`api/instruct.php`, `assets/instruct.js`, `assets/instruct.css`. A class's instructors are the email on its syllabus (`COURSE.instructorEmail`, or the owner and TAs of a Mathub Faculty class linked to it, `mh_course_staff`); admins count everywhere. The sidebar gets a **Teaching** group with the Instructor page of each class they teach (`instruct_me`, `App.teaches`).

- **Bo in this class** (`class_ai`, `instruct_save`). **Hints only**: Bo gives one hint at a time and never the final answer to a problem from the class (`MH_CLASS_HINTS`). **Notes for Bo** (up to 1,500 characters), read in every chat and call in the class; his own rules come first. Both reach the chat (`ai_tutor`), the live call's instructions and the draft review (`mh_class_ai_prompt`). Unsaved edits stay in the browser (`mathub-instr-<class>`) until saved.
- **Draft feedback per project**: on or off for the class (`ai_draft_switch`), and for each project an **assignment sheet** (pasted, or opened from a .docx/.pdf/.odt/.txt) and a **rubric** of up to 12 criteria. The review reads the draft against them as well as the project's goals (`mh_class_ai_project`); Bo never grades.
- **Shared with you.** A student can share one version of a draft with the class's instructors, with a note (`ai_draft_share`, `draft_shares`; off with the class's Sharing switch). The instructor sees that version, Bo's review of it, the student's answers to his notes and their name and email, and can reply (`instruct_reply`); the reply shows on the student's review and in their inbox. Unsharing removes the instructor's access and the reply.
- **Patterns** (`instruct_patterns`). Per project, from drafts whose writers ticked **Let this draft count** (`counted`): how often Bo named each goal among the biggest revisions, how many drafts were first or revised, their median length, what became of his revisions at the next version and how his notes were answered. Nothing shows until five students have let a draft count for that project (`MH_PATTERN_MIN`), and never a name, a quote or a draft.
- **Credits for your students** (`instruct_sponsor`). The students who joined the class's Mathub Faculty class (`instruct_roster`) each get the same number of credits (1 to 2,000), taken from credits the instructor bought or was given (never the month's free ones), in one transaction: a `sponsor` row for the giver and a gift with the instructor's name for each student, who gets a notification. An admin gives them from Mathub.
- **Peer review swaps** (`api/peer.php`, `assets/peer.js`, `#/<class>/peer`; on per class, with the days to write back). A student offers a version they shared with Bo and is paired with a classmate offering one for the same project, never someone they blocked or reported and preferring someone new. Each reads the other's draft (not Bo's review) with their display name, comments on selected words (up to 30; a quote must be in the draft) and writes a note on the whole draft; sending is final. What a partner sent shows on the writer's review under **From peer review**, and goes to Bo with the next revision. A draft can be reported (the moderators see it in the report queue as a peer review draft) or a swap ended so the two are never paired again.
- **Papers in Mathub Faculty** (`#/teach/<id>/papers`). A syllabus can list papers (name, brief, goals one per line, first and revised draft dates) and a writer's notebook (entries and the date they are handed in); the published class then gets draft feedback, the revision history and the notebook, with the due dates in its calendar.
- **For instructors** (`#/instructors`): one page for anyone saying what Bo does, what an instructor controls, what they see (and never see), credits and how to start.

## Learning tools: Check my work, Notes from slides, Office-hours prep

`api/learn.php`, `assets/learn.js`, `assets/learn.css`; members only, paid in credits (`check`, `slides`, `officehours` in `MH_CREDIT_FEATURES`).

- **Check my work** (`#/<class>/checkwork`, math and science classes). A photo of the work on one problem (and the problem typed, optionally). Bo writes out the lines as written and names the first wrong one; the server then checks each step with the exact math checker (`mh_mc_board`), and when it finds a different first slip Bo is asked again about that line, so the line marked is the one the arithmetic says. The page shows the photo, the lines (right, the first wrong one, the ones after), why and a hint, never the answer; **Ask Bo about this line** opens the floating Bo on it. Neither the photo nor the result is kept.
- **Notes from slides** (`#/<class>/slides`). A .pptx (each slide's text in the presentation's order with its speaker notes, `App.Office.pptxSlides`) or a PDF of slides (page by page) is read on the device; only the text goes to Bo, who writes study notes by section, key terms and flashcards from what the slides say. Sets are kept by class (`slide_sets`, 30 at most, 80,000 characters each). Cards flip with a tap or Space and the arrow keys; notes download as Word, cards as a CSV for Anki or Quizlet, or print.
- **Office-hours prep** (`#/<class>/officehours`). From the mistakes saved in the class (`App.mistakesAll`) and what the student says they are stuck on, Bo picks three questions worth asking, each with why and what to bring, and an opener. The class's office hours show when its syllabus has them. The questions are kept on the device (`mathub-officehours-<class>`); copy or print.

## Docs, Slides and Sheets (`#/docs`, `#/decks`, `#/sheets`)

A document editor, a presentation editor and a spreadsheet, like Word, PowerPoint and Excel, for every member (sidebar → Office). `api/office.php`; `assets/office.js` (the file lists, saving, what the three share), `office-docs.js`, `office-slides.js`, `office-sheets.js` (the editors), `office-ooxml.js`, `office-pptx.js`, `office-xlsx.js` (Word, PowerPoint and Excel files, read and written in the browser), `office-formula.js` (the formulas), `office-chart.js` (charts), `office.css`. The editors and the file code load the first time one opens, so the rest of the site does not carry them.

- **The lists.** Each page starts new files blank or from a template (Docs: an MLA essay with the name block, page numbers and double spacing filled in, a lab report, class notes; Slides: a class presentation, a lab talk; Sheets: a grade tracker, lab data with a fitted line, a monthly budget), and opens a Word (.docx) or text file, a PowerPoint file (.pptx), or an Excel (.xlsx, .xlsm) or CSV file as a new one. Files are listed newest first with a search; each can be renamed, copied, downloaded or deleted. An old .doc, .ppt or .xls says to save it in the newer format first.
- **Docs.** Styles (normal text, three headings, quote), fonts and sizes, bold, italic, underline, strikethrough, superscript and subscript, text colour and highlight, alignment, bulleted and numbered lists (nested with Tab), indents, links, pictures (sized by the page width, with a description for screen readers that Word keeps), tables (rows and columns added or deleted, a header row), page breaks, find and replace, a word count (of the selection too), Letter or A4, line spacing and page numbers (MLA's "Lastname 1" at the top right, or at the bottom). Text pasted from a web page or Word keeps its formats but not scripts, outside pictures or javascript: links. Downloads as Word or text, or PDF by printing (the page size, margins and page numbers as set). **Get Bo's feedback** hands the document's text to draft feedback in a writing class (a paper to pick, nothing sent until the student sends it there).
- **Slides.** 16:9 slides (960 × 540 points, PowerPoint's own size) with the slides down the side (drag or Alt+↑/↓ to reorder). Six layouts, six themes, a background per slide; text boxes (fonts, sizes, colours, alignment, bullets and numbering with five levels), pictures, rectangles, rounded boxes, ellipses, triangles, lines and arrows; move, resize, snap to the middle and the edges, nudge with the arrow keys (Shift for 10 points), front and back, copy and paste, speaker notes. **Present** fills the screen (arrows, Space, a click; B for black, N for the notes, Esc to end). Downloads as PowerPoint, or PDF by printing (a slide a page).
- **Sheets.** A grid as in Excel: up to 10,000 rows and columns A to ZZ, with 99 functions (SUM, AVERAGE, IF, VLOOKUP, INDEX and MATCH, COUNTIFS and SUMIFS, the statistics a lab needs: STDEV.S, SLOPE, INTERCEPT, RSQ, CORREL, and dates and text). What is typed is kept as typed, and everything is worked out again after each change, across sheets too. Copy and paste with Excel and Google Sheets both ways; the fill handle copies or counts on and moves references as Excel does; insert and delete rows and columns (every formula follows); sort with the header row kept; freeze the top row; AutoSum (Alt+=); number, percent, money and date formats; colours, wrapping, column widths; several sheets (renaming one rewrites the formulas that use it); column, line, scatter (with the line of best fit, its equation and R²) and pie charts over the cells. Only the rows in view are drawn, so a long sheet stays quick. Downloads as Excel (charts included, as real Excel charts on the same cells) or CSV, or PDF by printing. A CSV's separator is found (comma, semicolon or tab), and nothing in it becomes a formula or loses its leading zeros.
- **Saving.** A moment after each change, and when the page closes. Until the server has it, a file under 1.8 MB is also kept on the device (`mathub-office-<id>`), so a closed tab or a lost connection loses nothing: offline, it says so and saves when the connection is back. Each save names the version it was written on; if the file changed on another device meanwhile, nothing is overwritten and the page asks: keep both (this one saved as a copy), keep mine, or open the other.
- **Limits** (`api/office.php`): 300 files, 8 MB each (pictures included), 200 MB in all; saves are limited to 240 in ten minutes. A file over a limit is not saved and the page says why.
- **Private.** Files are their owner's alone (`office_files`, `ON DELETE CASCADE`: deleted with the account). Nothing in them is sent to Bo or anyone else, except a document's text when its owner picks Get Bo's feedback. They are in Download my data with what is in them readable.
- **Accessible.** The toolbars are one tab stop each (arrow keys inside), every button has its name and shortcut, the grid is an ARIA grid with the active cell announced, slides have a keyboard way to do everything the mouse does, and charts and pictures carry descriptions. The person's own words are never translated by the site's languages (`translate="no"`).
- **Tests:** `tests/office.test.js` (100 checks): the server's limits, conflicts and privacy; each editor by keyboard and mouse; every file written is unzipped and checked part by part, opened by python-docx, python-pptx and openpyxl (when `MATHUB_OFFICE_PY` names a Python with them) and by LibreOffice (when it is installed); files from python-docx, python-pptx, openpyxl and LibreOffice open; accessibility (axe), phones, and no English left in Spanish.

## SEO: static study guides, sitemap and metadata

The app is a hash-routed single page, which search engines index as one URL. `node scripts/build-seo.js` (run from `calc1/`) renders every topic of every class into a plain HTML page under `learn/` (`learn/<course>/<topic>.html`, about 110 pages), a class page per course with facts, exam dates and the topic list, a hub page at `learn/index.html`, plus `sitemap.xml` and `robots.txt`. The pages use `assets/seo.css`, MathJax for formulas, breadcrumbs, previous/next links, JSON-LD (`LearningResource`, `CollectionPage`, `BreadcrumbList`) and Open Graph tags, and every page links into the app (notes, practice on that topic, flashcards, playground). Rerun the script whenever course data changes and ship the `learn/` folder, `sitemap.xml` and `robots.txt` with the site. The app's `index.html` carries a canonical link, Open Graph and Twitter cards (`assets/og.png`), JSON-LD for the site and its study guides, and a `<noscript>` block with links to the guides; the service worker leaves `/learn/` pages alone. After deploying, submit `https://mathub.space/sitemap.xml` in Google Search Console.

## UI polish

A mobile tab bar (Home, Learn, Practice or Code, Board, Me) appears under 900 px, adapting to the class; the top bar shows a breadcrumb (class › page); the landing page has a "pick up where you left off" card that remembers the last page visited in any of your classes and a stats strip; class switcher buttons carry their class color; `?` opens a keyboard-shortcuts dialog; a back-to-top button appears after scrolling; pages fade in; keyboard focus rings are visible.

### Big Sky (default look since 2026.10.02.3)

The default look is a bright, illustrated climb: every class is a mountain and its next exam is the summit. It replaced the flat printed trail map of 2026.10.02.2, which the owner found too bare, and holds the craft level of the most-used learning sites (Khan Academy, Duolingo, Brilliant) without copying any of them. Product truth is in `PRODUCT.md`; the direction contract is in `.impeccable/surfaces/index-html.md`; the built system is documented in `DESIGN.md` (and `.impeccable/design.json`). The whole world is one stylesheet, `assets/world.css`, loaded last and scoped to `:root:not([data-skin])`, so the other looks in Settings keep their own styling.

- Colour: white surfaces on a faint sky ground (`--bg`), Bobcat navy text (`--ink`), each class in its own colour (`--accent` on class pages and class tiles), bright MSU gold (`--sun`) for streaks, XP, badges and the loading bar, pine (`--pine`) for mastery, sunrise coral (`--coral`) for exam urgency. `--gold` stays a text-safe dark gold for older rules that colour text with it. Night sky in dark mode.
- Type: Gabarito (headings, numbers) and Figtree (text), variable fonts self-hosted in `assets/fonts/` (SIL Open Font License).
- Shape: 2px borders, 12-24px corners. Anything you can press has a chunky lip (`box-shadow: 0 3px 0` in a darker shade) and sinks when pressed (`translateY`); static containers have no lip. One level of white cards; a panel inside a panel loses its border.
- The class dashboard opens on the trail board (`trailTile` in `assets/app.js`): a summit card (exam, date, days left in a coral badge, what it covers, a readiness bar, the "Take the next run" button) beside an illustrated climb (sky, sun, clouds and layered ridges drawn in the class colour, the pixel Bridger Range along the bottom, a flag at the summit). The exam's sections are round nodes zig-zagging up a dotted trail (`drawTrail` measures the nodes after layout and draws the path through them), coloured like ski runs from the readiness score of their topics: green circle (solid), blue square (getting there), black diamond (hard for you), white ring (not tried). The weakest section is the current node, with a pulsing ring, Bo standing beside it and a "You are here" pin; a section with no practice questions still appears ("notes only") and links to its notes. Exams with more than nine sections get a denser climb (`tb-many`). On first view the trail draws up, the nodes pop in and Bo hops onto his node; with Reduce motion it simply appears.
- Start page: an illustrated sky-and-mountains hero with Bo standing on the pixel ridge, then the classes as bright tiles, four across on a laptop (class-colour cover with the class's own 8-bit sprite from `App.classSprite(id)` in `assets/pixel.js`: integral, apple, graph, scroll, computer, potion, heart, brain; class packs get the book), what is covered now, next exam, one soft-filled button. When the hero offers Sign up, Today steps back to a secondary button so there is one primary.
- The climb: one big mountain (`.tb-peak`, an SVG stretched under the band of nodes) puts its peak under the summit flag, so the trail climbs it; labels are plain text with a sky-coloured halo except the current one; the summit card lists the next three unchecked prep items as live checkboxes (hidden on phones). Lips only on things you press; badges, pins and signs are flat.
- The drifting background (`liveBg`) and geek mode are opt-in (`settings.liveBg === true`, `settings.geek === true`).
- Start page: a first visit shows Your classes before Start here (moved in the DOM, so reading and tab order follow); class tiles show the progress ring only once there is progress.
- Sidebar: Study planner uses the `path` icon and GPA calculator the `award` icon (`NAV_ICON` in `app.js`), so no two items share a mark.

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

## The welcome after sign-up

`assets/welcome.js`, `assets/welcome.css`, website only. A new account gets it right after verifying its email: a
full-screen Big Sky where the range glides past and Bo walks the trail at the top, five short scenes (welcome,
every class is a climb, practice that sticks, Bo with his board and calls, any class from its syllabus), then two
choices it must make: its classes (at least one) and a membership (Free, Pro or Max; Pro and Max open the
checkout, and closing it leaves the account on Free), then You're all set. `api welcome_done` saves the classes,
`users.welcomed` and `users.plan_choice`; until then it comes back at every visit (`user.welcomed === false`).
Accounts from before it count as welcomed. Skip the tour (or Esc) jumps to the choices; Back, the arrow keys and
Log out work; it is still when motion is off or reduced, and the tour of the layout waits until it is closed.

## Adding members from the admin panel

Admin panel → Members → **Add a member** (`api admin_user_add`): any email address, also outside montana.edu
(it is added to "Also allowed to sign up" in Keys & settings so it can sign in), with a name, a role (student, TA,
instructor) and a plan given without paying (Pro or Max, given like below). The account is verified at once.
Either the administrator sets the password, or the person gets an email with a link (`#/?setpw=<email>`, which
opens "choose your password" with the address filled in) and a code good for 7 days. Mathub's welcome greets them
at their first sign-in. Duplicates and weak passwords are refused.

## Giving members a membership

Admin panel → Members: every member shows their plan (Free, Pro or Max) and where it comes from (given, paid, or
tester), and "With Pro or Max" lists only them. Pressing the plan opens **Membership for …** under the row
(`api admin_plan`): Free, Pro or Max; for how long (no end date, 1, 3 or 6 months, a year, or until a day); a note
only administrators see; and "Tell them in their inbox". It is kept in `plan_gifts` (by email, with who gave it and
when) and counts at once everywhere a plan does (Bo, making classes, Your plan, which shows its last day). It never
charges anything and does not touch a plan the member pays for: Your plan still offers Manage billing and Cancel for
that one. Taking it back (Free) leaves whatever they pay for. Picking a plan here replaces a tester plan for the same
address saved in Keys & settings; one in `config.local.php` stays. Housekeeping removes given memberships of deleted
accounts and ones that ended three months ago.

## Floating buttons

The focus-sounds bubble floats only while something plays (or its panel is open); the sounds start from the top
bar's button on class pages, the start page's button next to search, or the Focus room. Back to top is hidden on
phones and tablets and keeps clear of the sidebar on wide screens. The admin panel's tabs are one scrolling row on
narrow screens. Ask Bo has "Your classes" and "Open <class>" at the top.

## Keys and settings from the admin panel

Admin panel → **Keys & settings** (`assets/admin.js`, `api/siteconfig.php`): the API keys (Anthropic, OpenAI,
RevenueCat v1 and v2), the email password and mail server, plans and prices, plans given without paying, Bo's
limits and models, who may sign up, moderators and administrators, and site settings. What is saved there goes to
`api/data/site-config.json` (next to the database, never in the zip) and wins over `config.local.php`; "Use the
file's value" goes back. Keys and passwords never come back to the browser (only set or not, where from and the
last four characters), saving needs the administrator's password, every change is logged in `config_log` (which
setting, who, when; never the value), and an administrator cannot remove themselves. Check buttons try the AI
keys, RevenueCat and email (a test email to you).

## Request a class

Classes are added by Mathub's team, so this is how a class gets onto Mathub. `#/request` (`assets/requests.js`,
`api/requests.php`) is for **every signed-in member** (`mh_can_request`, `user.can_request`; guests are asked to sign
in). A member sends the course code (normalised to MSU style, e.g. `chmy121` → `CHMY 121`), an optional name, term
and instructor, and the syllabus as a PDF, a Word file (.docx) or a photo (JPEG, PNG, WebP), up to 10 MB, or pasted
text, with a consent box. Links lead there from the start page (under Your classes, and the Bo card's Request a
class), the sidebar (Request a class where administrators see Add a class), the class picker, Settings, Bo's "Pick a
class first", a shared class link, and search (typing an unknown course code offers "Request CHMY 999"). Codes
already on Mathub are caught as you type. Classes a student made before (their own classes) are listed there too,
with Open, Download and Delete (`App.paintMyClasses`).

- **The malware check** (`mh_cc_scan` in `api/community.php`, before anything is kept): the file must be what its
  first bytes say (programs, archives, scripts and old Office files are refused); a PDF with active content
  (JavaScript, launch actions, embedded files, rich media, XFA, submit or import actions, also inside compressed
  streams and behind `#xx` escapes) or a password is refused; a Word file is opened as the zip it is
  (`mh_cc_docx_check`): macros (`vbaProject.bin`), ActiveX, embedded files and objects, programs inside, a
  template, frame or object loaded from outside (`TargetMode="External"`), `altChunk` and DDE fields are refused,
  and so is a zip that unpacks to far more than it is; a photo must decode as the picture it says, with nothing
  hidden after it. ClamAV scans it too when the server has it; with `virustotal_key` its SHA-256 is looked up. What
  was checked is kept with the request (`class_requests.scan`) for the admin panel. A refused file is not kept.
- **Storage.** Requests live in the `class_requests` table. Files go to `api/data/syllabi/` under random names, with
  `Require all denied`, and are only served to administrators (`admin_classreq_file`). `api/.user.ini` raises PHP's
  upload limit to 12 MB for the API.
- **Demand.** Requests for the same code are grouped. The page shows a public **Most requested** list (codes and
  counts only, never names or files) with a one-click **Me too**, and each student's own requests with their status.
- **Admin panel → Class requests.** Groups sorted by demand, with each requester, their note and the syllabus.
  **Preview and build** shows the syllabus on the page: a PDF in a frame and a photo as a picture (both from a copy
  fetched by the page, a `blob:` URL, so the file is never a page of its own; the page's CSP allows `frame-src
  blob:`), a Word file as its text (`admin_classreq_preview`), the pasted text, and what the malware check looked at.
  **Build the class with Bo** (Full or Shorter) runs `ai_class` with the request's id (the stored file is read on
  the server; a Word file goes as its text, a big photo is made smaller) and shows his steps and the class; **Add to
  Mathub** publishes it (`community_publish`), and everyone who asked is told (by the pack's code, and by the
  request's code when they differ, `ai_builds.req_code`). Already on Mathub: one button marks the request added as
  that class. The status buttons still work by hand: **Working on it**, **Mark added** (asks for the class id),
  **Can't add** (with a reason) or **Back to new**; each change sends an inbox message (and a push when added).
- **Limits.** 8 requests per student per day, 10 open at once, one open request per class per student; banned
  accounts cannot request. Students can withdraw a request while it is new, which deletes the file.

## Add a class from the admin panel (class packs)

The workflow is syllabus in, one file out, upload, done. Full format: [`packs/README.md`](packs/README.md). Packs kept in `packs/` ship with the site and install themselves on the server after a deploy (an admin's upload, hide or delete always wins); `packs/index.json` lets the static preview show them without a server. Bundled now: PSCI 230D, EMEC 100, M 170 (Trigonometry for Calculus, with estimated exam dates), M 172 (Calculus II) and JPNS 150D (Japanese Culture and Civilization).

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

## Mathub Faculty (#/teach) and the class pages for students (#/class)

`assets/teach.js`, `assets/teach.css`, `api/teach.php`. A workspace for instructors, separate from the student site: a **For professors** button on the start page (and a footer link) opens it. It sets `<html data-surface="faculty">`, which hides the student chrome (sidebar, tab bar, sounds button, footer) and switches to its own look: a navy rail, a white top bar, 1px lines and 6px corners, Source Serif 4 for titles and the syllabus, Source Sans 3 for the interface (both self-hosted). Light and dark follow the site's theme.

- **Who can do what.** Anyone signed in can write syllabi: drafts, the live page and Print / PDF are private to their author (up to 15 drafts before confirmation). Publishing to students, joining, the roster, announcements, assignments, attendance and insights need **confirmed faculty status**: the instructor asks at `#/teach/verify` (name, title, department, courses) and an administrator confirms in **Admin panel → Instructors**, which gives the role `Instructor` with scope `teach` (their own classes only). Administrators count as confirmed. The server enforces all of it (`mh_teach_tools_or_fail`).
- **The syllabus editor** (`#/teach/<id>/<page>`). One page each for course details, people and office hours, description and outcomes, materials, schedule, exams, grading and policies, with the finished syllabus beside the form (`docHtml`), updating as you type; a gold change bar in its margin marks the part being edited. The rail marks pages with something to fix. It saves itself as you type (Ctrl/⌘ S saves now). MSU's accommodations, integrity and wellbeing statements are pre-filled; three AI-policy presets. **Fill in class meetings** builds the term from the meeting days and marks Labor Day, Veterans Day, Thanksgiving week and the Monday holidays; **Paste topics** fills them. Under 1240px wide the page moves behind a **Preview** button.
- **Overview** (`#/teach/<id>`): draft or published, the checklist grouped by page, the join code, links to the public syllabus page (`#/syllabus/<CODE>`) and to the class as students see it. **Class settings**: the default question bank, unpublish, delete (type the course code).
- **Publishing.** The server turns the plain-text syllabus into a class pack (weeks become topics, exams split the units, the grading becomes the grade calculator, the policies become the syllabus page) with an id from the course code (`m171`, else `m171b`, else `tc0042`). It is added to its students' class lists and never to the teaching team's: `classpack_list` sends it to them with `preview: true`, so it opens as a preview (with a strip back to Mathub Faculty) but stays out of their own classes. Nobody else gets it. Re-publishing updates the class and can tell students what changed.
- **Running the class.** Join code and link, roster with CSV export, co-instructors and TAs; announcements (inbox + push); practice assignments from any Mathub question bank (each student gets their own seeded version, retakes count their best score, results by student and by topic); attendance check-in with a 4-digit code that stays open a few minutes, with a full-screen view for the projector; insights (completion, averages, weakest topics, attendance).
- **Students.** `#/class/join/<CODE>` shows the class and exactly what the instructor will see before they join. `#/class/<id>` is the class hub: links to the class pages, assignments, announcements and check-in. The class dashboard links back to the hub.
- **Privacy.** Instructors see a student's name, email, results on that class's assignments and check-ins, nothing else. Deleting a class (owner types the course code) removes its pack and its rows; student accounts are never touched.
- **Tests.** `tests/teach.test.js` (the whole flow in a browser) and `tests/teach-api.test.js` (permissions and boundaries over HTTP).

## Mathub for iPhone, iPad and Android (`app/`)

Native iOS and Android apps built with Capacitor from this same site. It carries the whole site inside it and
works offline: MathJax and the Python runtime are bundled, nothing is downloaded at runtime. Account
calls go to `https://mathub.space/api/` (the server accepts the app's origin, `capacitor://localhost`).

- **Create a class** (`#/create`, `assets/create.js`, on the website and in the apps): see "Classes students
  make" below. In the apps classes are saved as files on the device (`classes/my####.mathub.json`) and, when
  signed in, with the account; "Try an example class" adds `assets/app-sample-class.json` with no AI needed.
- **Its own frame** (`assets/app-native.js`, `assets/app.css`; see "The iPhone, iPad and Android apps" in
  DESIGN.md): the website's top bar, sidebar and footer are hidden. A top bar holds the class button, the
  streak, today's XP against the daily goal and the account (or Sign in); the start page (`App.homeView`,
  hooked in `app.js`, built from the shared pieces in `assets/home.js`) is a row of class cards, then the chosen
  class (the week and what it covers now, its next exam with days left and readiness, a Continue button into
  the next lesson), exam week when an exam is 7 days away or closer, today across all classes (daily goal,
  flashcards, missed questions, what is due), the class's tools, and its path with every lesson named, unit by
  unit, with exam checkpoints; the class button opens a sheet with your classes, Create a class and every tool;
  the tab bar is Learn, Practice, Today, Discuss, Me.
- **Mathub Pro and Max** (`assets/create.js`, setup in `docs/app-subscriptions.md`): two monthly plans, sold
  through the App Store and Google Play via RevenueCat (`@revenuecat/purchases-capacitor`) and on the website
  through RevenueCat Web Purchase Links; a plan works everywhere the student signs in. Bo, the AI tutor, is a tab.
- **On the phone:** exam and daily reminders as local notifications, haptics, the share sheet (classes, data
  export, any file the page makes), outside links in the Safari sheet, safe areas and the status bar.
- **No account needed:** every study tool is open in the app; an account adds sync and discussions.
- **Files:** `app/` (Capacitor project, `scripts/build-www.js` builds `app/www` from this folder),
  `assets/app-boot.js`, `assets/app-native.js`, `assets/app.css` (loaded only in the app; the website never
  loads them), `ios/App/App/PrivacyInfo.xcprivacy`. `assets/create.js`, `assets/home.js` and their CSS are
  shared with the website.
- **Android:** the same app in `app/android` (target API 36, edge to edge, Bo adaptive and themed icons, back
  button and gesture, reminders in their own notification channel and inexact, so no exact-alarm permission).
- **Build iOS:** `cd app && npm ci && npm run sync:ios && npm run open`, then archive in Xcode 26.
  `.github/workflows/ios-build.yml` builds it for the simulator on every change.
- **Build Android:** `npm run sync:android && npm run open:android` (Android Studio, SDK 36, JDK 21), or
  `cd android && ./gradlew bundleRelease`. `.github/workflows/android-build.yml` builds a debug APK (kept as a
  download on the workflow run, to install on a phone) and the release bundle, and checks the target SDK and permissions.
- **Art:** `node app/scripts/make-art.js` redraws every icon, launch image and the Play listing art from Bo.
- **App Review:** what gets apps rejected, what Mathub does about each guideline, the App Store Connect
  answers, the review account and the reviewer notes are in [`docs/ios-app-review.md`](docs/ios-app-review.md);
  the same for Google Play (Data safety, content rating, the closed test, signing) in
  [`docs/android-play-review.md`](docs/android-play-review.md). Store art is in `app/store/`.
- **Account deletion link** (Google Play asks for one): `https://mathub.space/#/policy/delete`.

The Hostinger zip never includes `app/`.

## Classes students make, Mathub Pro and Max, and sharing

`assets/create.js`, `assets/create.css`, `api/myclasses.php`; setup and store details in
`docs/app-subscriptions.md`.

- **Create a class** (`#/create`): on the website for **administrators only** (`App.canMakeClasses`; everyone else
  who opens it lands on Request a class, and the server refuses students `ai_class` and `community_publish`); the
  apps (on hold) still make a class of your own on the device, without Bo. Copy the instructions, give them to any
  AI with your syllabus, paste the answer back. Mathub finds the JSON in the answer, repairs what it safely can, validates
  it with the class-pack checker and shows a preview before adding it. Mathub never sends the syllabus anywhere.
  On the website adding a class needs an account; the page itself is open to guests.
- **Where classes live.** With the account (`my_classes`: the class pack, up to 40 classes of 3 MB each), so
  they are on the website and in the apps wherever the student signs in. The website caches them in IndexedDB
  and clears them on sign-out; the apps keep a file per class and work offline. A class made in the app while
  signed out goes up at the next sign-in. `App.classSync` keeps both sides the same (new ones up, the account's
  down, deleted ones gone everywhere; an id clash gets a new id). Rows go with the account through
  `ON DELETE CASCADE`, and Download my data includes them.
- **Mathub Pro ($15) and Mathub Max ($20)** (`App.subscription`, `App.paywall({ need })`): with Pro, Bo is on every
  page (the floating Bo, `assets/bo-float.js`); Max adds Ask Bo's own page, talking out loud and calls, with an hour
  of calls each month and more time bought ahead (Calls with Bo, below). The apps buy them through the App Store or
  Google Play; the website opens the plan's RevenueCat Web Purchase Link (Stripe) in a new tab and waits for it
  (`create_status`, which asks RevenueCat's REST API and keeps the answer for 10 minutes unless asked to refresh).
  All use the RevenueCat customer `mh_<account id>` and the entitlements `pro` and `max` (a Max product unlocks
  both). `plan_grants` in `config.local.php` gives testers a plan without paying. The example class and classes
  made before the plans existed are free; when a plan ends, classes are kept, locked (`App.courseGate`), until it
  is back. Settings has a Your plan panel (website) or row (apps) leading to **Your plan** (`#/plan`, also in the
  account menu): the plan and how it is paid, when it renews or ends, their credits (this month's, as a meter, and the bought
  ones, linking to Usage), the three plans side by side, Manage billing (RevenueCat's customer portal or the store)
  and **Cancel plan**: one dialog (what changes and when, an optional reason kept in `plan_feedback`, Keep my plan),
  then `plan_cancel` cancels a website plan through RevenueCat's API v2 when `revenuecat_v2_key` and
  `revenuecat_project` are set, or opens its billing page; App Store and Google Play plans go to the store.
- **Bo on the start page** (website, signed in): one card under the hero with Call Bo (the Call Bo sheet), Ask Bo
  and Request a class on every plan (administrators see Add a class); out of credits, Get credits comes first. It
  says how many credits are left and about how many minutes on a call they make, the plan a click from Your plan
  and the credits a click from Usage.
- **Sharing** (administrators on the website; students no longer share). Share gives `https://mathub.space/#/c/CODE`,
  the 8-character code and a QR code (`assets/vendor/qrcode.js`, qrcode-generator, MIT, loaded on demand). `#/c/CODE`
  shows the class to anyone, without the owner's name, with Report, and Request it for students (Add a copy for
  administrators). Links students shared before keep working until their owner stops sharing. Moderators can stop a reported
  share from Admin → Problems. The owner can stop sharing at any time.
- **Create a class** (`#/create`, administrators): "Bo writes it from your syllabus" first (drop in a PDF, photo or text file, or
  paste the text; Full or Shorter class; Write my class, then his steps and the class preview with Add to Mathub;
  see Classes anyone adds from a syllabus), then Classes you added to Mathub, then
  "Other ways to add a class": the free example class, a share code, a class file, and "Use the AI you already
  use" (the three copy-and-paste steps, folded away).
- **Server keys** (in `api/config.local.php` only): `revenuecat_secret`, `pro_web_link`, `max_web_link`,
  `anthropic_key`, `openai_key` (optional: Bo's natural voice), and `plan_grants` for testers.

## Languages (English, Español, Русский, Français, Italiano, Português, Deutsch)

`assets/i18n.js`, `assets/i18n/<lang>.js`, `i18n/`, `scripts/i18n-extract.js`, `scripts/build-i18n.js`. The interface
is shown in the language picked from the globe in the top bar (EN, ES… with a menu of all seven, each in its own
words; arrow keys, Home/End and Escape work), at the foot of every page or in Settings (kept with the account, `lang`
in the preferences), else the browser's language if Mathub has it, else English. The code stays in English: `assets/i18n.js`
loads the language's dictionary before the page and swaps the words as the page is drawn (text, title, aria-label,
placeholder, alt, confirm/prompt/alert, the tab's title), so nothing a page does changes. An entry with `{1}` is a
pattern ("{1} questions left"); `{1|вопрос|вопроса|вопросов}` picks a plural; text that fits no entry stays English.
Dates and numbers follow the language. Class material (notes, questions, flashcards) stays in the class's language.
Bo is told the language (`lang` with each question, `MH_AI_LANGS` in `api/ai.php`) and answers in it, with the English
term for key words. Calls speak it from the first word (`MH_AI_LIVE_SPEAK_EN` is swapped for the language, and his
hello is said in it) and write down what is said in it; reading aloud (`ai_speak`) asks for a native accent, listening
(`ai_listen`) expects the language, the device voice is one for the language, and math is read out in its words
(`assets/talk.js`). A picture he makes (`ai_image`) has its words and labels in the language, kept apart from the
English one. A class's sidebar labels come from its `*-data.js` and are read by the extractor too.
To add words: `node scripts/i18n-extract.js` (new words get new numbers in `i18n/catalog.json`; text the reader can't
follow goes in `i18n/extra.txt`), translate the numbers in `i18n/<lang>.tsv`, then `node scripts/build-i18n.js`.
Every language has every entry; `node scripts/build-i18n.js` says how many each has and checks each `{1}`.

## Classes Bo writes from a syllabus, for everyone

`api/community.php`, `api/ai.php` (`ai_class`), `assets/create.js` (`App.boClass`, shared with the admin panel).
Mathub's administrators have Bo turn a syllabus into a class that is published for every student (one class per
course, so its notes, practice and board stay in one place): from a class request in the admin panel (`ai_class` with
`request`, the stored syllabus) or from a file or text on the Create page. Students request classes instead (Request a
class, above); the server refuses them `ai_class` and `community_publish` (403, `request: true`).

- **The file is checked for malware first** (`mh_cc_scan`): it must be what it says it is by its first bytes (a PDF,
  a JPEG/PNG/WebP/GIF photo, or UTF-8 text) and is never a program, archive or script under another name; a photo
  with a script or an archive hidden after the picture is refused; a PDF with active content (JavaScript, launch
  actions, embedded files, rich media, XFA, submit or import actions) is refused, names written with `#xx` escapes
  and compressed (FlateDecode) streams included, and a password-protected PDF cannot be read. ClamAV scans it too
  when the server has `clamdscan`/`clamscan`; with `virustotal_key` (Keys & settings) VirusTotal is asked about
  its SHA-256 only. A file given on the Create page is never stored; a request's file is kept with the request.
- **Then Bo checks the document** (`MH_CC_SCREEN`, one small request): the syllabus of one real course (a course
  code and title, real content), nothing that must not be published (hateful or sexual content, students' private
  details, text aimed at the AI), its code, title, school and term. Not a syllabus, or something unpublishable:
  refused with the reason (422). No course code: refused. The check and the outline share the syllabus through
  prompt caching (the same system prompt and the syllabus block marked `ephemeral`).
- **Not on Mathub already** (`mh_cc_find`): the same code (subject letters and number: `M 171`, `M171` and `M 171Q`
  are one course) at the same school as a built-in class or a published pack is refused (409) with a link to it
  and Add it to your classes. A different school's course with the same code is a different class.
- **Publishing** (`community_publish`): Bo writes the outline and each unit as before; each unit is kept
  (`ai_build_units`) next to the outline and what the check found (`ai_builds.screen`). The browser puts the class
  together and sends it with its build; the server publishes it only if it is the course that was checked and
  every piece of its text is text Bo wrote for that build (labels the browser makes up, like "Unit 3" and ids,
  aside), checks for duplicates again inside a transaction, gives it the pack id of its code (`chmy121`, or with a
  letter when taken), the tagline "Made with Bo from the syllabus" and `uploaded_by` `community:<account id>`, and
  stores it as a class pack, published. The students who requested that class are told, it appears in the
  activity feed, and the browser adds it to the maker's classes and opens it. `community_mine` lists a member's
  classes on the Create page. Admin → Classes lists them as "Made with Bo · email" (looked up when listed),
  where they can be hidden, rolled back or deleted like any pack. Limits: 30 checks a day and 20 publishes an hour
  per account.

## Bo, the AI tutor (Pro and Max), classes Bo writes, and the AI server

`assets/tutor.js`, `assets/tutor.css`, `api/ai.php`; details and costs in `docs/app-subscriptions.md`.

- **Calling Bo** (`assets/talk.js`, website): a **live call** through OpenAI's Realtime API over WebRTC, set up by
  the server (`ai_live_start`: the browser's offer plus Bo's live persona and what he knows; the key stays on the
  server). Speech to speech: Bo answers in about half a second, waits until the student is done, stops when talked
  over, writes neat pages on his board (`write_on_board`: a title and step, math, answer, tip, text and code lines),
  draws on it (`draw_on_board`: any of the thirteen kinds of drawing below), puts a question on it for the student
  to answer there (`ask_on_board`; what they pick goes back to him as a message, so he reacts to it) and keeps
  notes through tools; tool arguments are read leniently (a drawing sent as text, LaTeX with one backslash); minutes are reported (`ai_live_tick`) and limited, the
  transcript is saved to the chat (`ai_live_log`). Without the speech key, or if a call can't connect, **basic
  voice**: the browser hears, the answer streams from `ai_tutor` in voice mode, and Bo reads it out (`ai_speak` or
  the device's voice). Mute (M), tap Bo to stop him, Show Bo, Photo, Type, captions (C), Esc ends the call.
  - **Calls that hold up** (`docs/bo-teaching.md`, "Calls that hold up"): the server decides when he's been
    interrupted and the app never cuts him off for a check (a MATH CHECK goes in as a note), one answer at a time,
    tools answer "fix it quietly and try again" instead of an error he would read out, the mic waits while he greets,
    the far-field noise filter on laptops (near-field with headphones). A dropped connection shows "reconnecting…"
    and comes back as the same call (`ai_live_start` with `resume`: board, clock and captions kept, Bo picks up where
    he was); a minute with no connection ends it and says so. Call settings: I'm wearing headphones, My speakers echo
    (the mic stays closed while he talks). What the student says is written down by `gpt-live-transcribe` in their
    language, with the class's words as hints (`ai_live_transcribe` in Site settings).
  - **The whole screen is a board you share** (`assets/bo-pad.js`, `App.boPad`): squared paper you write on with a
    pen (a stylus's pressure; with a stylus, fingers only move the board), a highlighter, an eraser that takes whole
    strokes, typed text (`x^2` shows as x²) and photos (Photo puts the picture on the board too); five colours,
    three sizes, undo and redo (Clear can be undone), drag/two fingers/wheel to move, pinch or Ctrl + wheel to zoom,
    Fit; keys P, H, E, T, V, Ctrl Z, Ctrl Shift Z. Bo's pages go up as paper cards beside your work, in free space
    you can see (or `near` a place he names), and can be dragged, folded and put away (Bo's pages lists and brings
    them back). **Show Bo** sends him a picture of it, cropped to your writing, with a grid over it (columns A, B, C…
    across, rows 1, 2, 3… down; at most 1,280 px, made smaller until it fits a call's data channel); on a live call
    he also gets a quiet look when you stop writing (at most every 9 seconds, 80 a call, only the newest picture kept
    in the call; Settings → "Bo sees it as I write"), never answered on its own. He marks your writing at cells of
    that grid, like a tutor with a pen (circle, check, cross, underline, box, arrow, note), drawn stroke by stroke
    where it covers the least of your writing: `mark_on_board` on a live call, `mark: C3 circle note` lines in
    basic voice (`ai_tutor` with `pad: {cols, rows}` adds `MH_AI_PAD`; marks are never spoken or shown in the chat).
    Your writing and his marks are kept on the device for the class (`mh-pad:<class>`, not photos) for the next call;
    the chat tags a board you showed as "The board". Settings → Dark board.
  - **Captions like a video's**: white on see-through black, centred at the bottom over the board, two lines that
    roll up, who is talking in front (Bo, You). Bo's transcript arrives ahead of his voice, so his words are let out
    at his pace while his voice is actually sounding (all at once when he stops; what he did not get to say when you
    cut in never shows); in basic voice they follow the sentence being read (the audio's clock or the voice's word
    marks). Settings: on/off (C), size (small to huge), background (see-through, solid, none) and names; they fade
    after a quiet spell.
- **Write it out** (Ask Bo, website): the same board on the whole screen (the class's board from calls); Add to my
  question sends its picture with the next question (`sketch: 1` tells Bo it is their handwriting, `MH_AI_SKETCH`).
- **Ask Bo** (`#/tutor`, `#/tutor/<class>`): a chat with Bo for the class you pick; answers stream in as he writes them. He knows the class from its
  syllabus and how the student is doing: the device sends a short progress snapshot with each question (next exam
  and readiness, weakest topics, recent mistakes, flashcards due, deadlines). The first message and the suggestions
  are made on the device (free). Photos of problems are shrunk on the device and sent with the question. Bo keeps up
  to 12 short notes about the student (`[remember: …]`), shown under his answer and in "What Bo knows", where they
  and the chat can be deleted ("What Bo knows" is a sheet from the i button). Every answer has Copy and Report,
  and after each one there are one-tap ways to go on: Explain it more simply, Show me another example, Quiz me on
  this (or Give me another question), Draw it on the board (or Walk me through the drawing).
- **Bo on every page** (`assets/bo-float.js`, website): Bo floats in a corner of every page (not on Ask Bo, the
  welcome, admin or teaching pages, during a call or the tour; Settings → "Bo on every page" turns him off). One tap
  (or Alt+B) opens a small chat that knows what is on the screen: `App.boScreen()` reads the page as text, with the
  math back as TeX (MathJax keeps it), its questions and problems numbered as the student sees them (choices, what
  they answered, right or wrong, the feedback, a worked solution that is still hidden marked as such), a flashcard
  and whether it is flipped, their code, what is in view on a long page; menus and buttons are left out, and it is
  capped at 9,000 characters. The ways in fit the page: the questions as chips (Q3 asks "Help me with Q3" with Q3
  attached; wrong ones are marked), Go over what I missed, Check my answers, Explain the topic, A question like
  these, Explain a topic…; "Point at it" (tap any part of the page; quick asks follow: Explain this, Give me a hint,
  Show me the steps); select any text and Explain / Ask Bo… appear beside it; a photo or a PDF of a problem set. It
  goes to `ai_tutor` as `screen`, `focus` (what was pointed at or selected), `where` and `file` (a PDF, sent as a
  document); the eye chip turns the page off ("Bo isn't looking at this page"). Answers stream in with the board's
  pages inline (drawings, sliders, questions to answer), Copy and the one-tap follow-ups. It is the class's chat with
  Bo, so Ask Bo shows it, each question tagged with where it came from (`[from: Calc I › Quizzer · Q2]`). When the
  page changes during a chat, a small card offers the ways in for the new page. A one-time hello, and now and then
  (at most three a visit, never twice for a page; Settings → "Tips from Bo") a short nudge on a page of questions.
  Drag him to either side (or Alt+arrows); he stays where he is put. On a phone he sits above the tab bar and opens
  as a sheet. The apps keep Bo as a tab.
- **Ask Bo about this**: under a question missed in the Quizzer or the mistakes notebook (`App.askBoButton`), a link
  to `#/tutor/<class>?ask=…` that opens Ask Bo and sends him the question, the choices, what the student answered
  and the right answer, once (the address drops it after).
- **Bo never agrees with something wrong** (`docs/bo-teaching.md`, `MH_AI_TRUTH`): the app checks the math exactly,
  in the browser (`assets/mathcheck.js`) and on the server (`api/mathcheck.php`): what the student says, types or
  answers (spoken numbers and LaTeX too), what Bo says, the pages and questions he puts up, and his chat replies.
  On a call an exact note goes in for his next turn (he is stopped only if he starts to agree with something wrong);
  he also has a `check_math` tool.
- **How Bo teaches** (`docs/bo-teaching.md`, `MH_AI_TEACH` in `api/ai.php`): the same thirteen rules in the chat,
  voice mode and calls, from research on expert tutors and learning: find out where the student is, the big picture
  first, one idea at a time, concrete before abstract, a worked example then fading, draw it, words and board
  together, real checks instead of "does that make sense?", a hint ladder, mistakes as information, a new angle when
  it didn't land, close the loop, be exactly right. On a call (shorter call rules, `MH_AI_LIVE`) most turns are short
  and he takes a proper turn to explain something new.
- **Bo's board** (`App.boBoard` in `assets/tutor.js`, also on calls): Bo works problems out on a whiteboard instead
  of in the chat bubble. In his replies a page is a block, `[board: Title]` then `step:`, `math:`, `answer:`,
  `tip:`, `text:`, `draw:`, `check:` and `code:` lines (or a ``` block of code) and `[/board]`. A `draw:` line is a
  picture as JSON (it may run on over several lines, or sit in a ``` block), drawn by `assets/board-draw.js`
  (`App.boDraw`): a graph (functions, parametric curves, points, shaded areas, segments, vectors, asymptotes,
  tangent and secant lines with their slopes, Riemann sums with their total, and sliders the student drags, which
  redraw it), a number line (intervals also as "x > 2" or "[1, 4)"), a figure (shapes, angles, circles, arrows,
  boxes), the unit circle (exact cos and sin of the angle he points at), a table, a bar chart or histogram, a pie
  chart, a scatter plot (least-squares line, r and r², residuals, a prediction), box plots (from data, with
  outliers), a normal curve (with the shaded area worked out), a probability tree, a Venn diagram (counts in the
  regions, any set expression shaded) or a flow chart. What he writes is read the way a model writes it (code
  fences, single or smart quotes, bare keys, trailing commas, comments, LaTeX with one backslash, a reply cut short,
  synonyms like "plot" or "bar chart", points as [x, y], "y = \frac{1}{x}", "x²"); a drawing that still makes no
  sense says so on the board. A `check:` line is a question the student answers on the board (choices to tap, or a
  box to type in; numbers compared as numbers): marked at once with the right answer and why, with Explain it and
  Another one to ask Bo more. **His graphs move like the Calc I grapher**: drag to pan, the wheel zooms around the
  pointer once you have clicked the graph (or with Ctrl; so scrolling past one in a chat never gets stuck), pinch on
  a phone, + and −, arrow keys and 0, a double click or Back to the first view; point at a curve (or tap one) to
  read the point and the slope there. **Open in the grapher** shows one on the whole screen with his curves listed
  (show or hide each), your own functions (up to four), the derivative and a tangent line you slide along a curve,
  his sliders, and a readout of where you point (`App.boDraw.open`; a copy, so his page keeps his view). It is data, never code (functions go through `App.compileExpr`,
  sizes are capped, labels escaped); it is drawn stroke by stroke, with labels placed clear of the ink, and named
  for screen readers; the chat shows "On the board: Title" where it goes, and the board draws
  the page neatly (numbered steps with their math, the answer boxed, tips on gold), each line written in as it
  arrives. Every page of the chat is kept, to flip back through. The board sits beside the chat on a wide screen,
  and above it, sticky and foldable, on a narrow one; it is never read aloud. The student agrees to what is sent to Anthropic
  before the first question. Bo is a tab in the apps, a button in the website's top bar, and "Ask Bo to quiz you"
  in exam week.
- **Bo on every page with Pro**: `ai_tutor` answers a Pro member when the question comes from the floating Bo
  (`float: 1`); Ask Bo's own page, talking and calls stay Max, so the panel's link to the full chat shows for Max only.
- **Let Bo write it** (Create a class, no plan needed): paste or attach a syllabus (PDF, photo or text); after the
  checks above Bo reads it into an outline, then writes each unit, with the steps shown as they happen; the class is
  checked like any other and published with Add to Mathub.
- **The AI server** (`api/ai.php`, routes `ai_status`, `ai_thread`, `ai_tutor`, `ai_forget`, `ai_class`): the only
  thing that talks to the AI (Anthropic's Messages API; `anthropic_key` in `config.local.php`). It checks the plan,
  enforces limits (1,500 questions and 15 classes a month per account), and keeps requests small: compact class
  summaries (`api/classdata/*.json` from `scripts/build-classdata.js`, packs, or the student's own class), the
  trimmed snapshot, the last 6 turns, prompt caching on the fixed parts, and `claude-haiku-5-5` by default.
  Chats, notes, usage and day-old class outlines live in `ai_threads`, `ai_notes`, `ai_usage` and `ai_builds`
  (removed with the account; included in Download my data).

## The start page and exam week

`assets/home.js`, `assets/home.css`. The apps' Learn page and the website's start page share the same pieces:
class cards, the class card (where the class is, its next exam with days left and readiness, the next lesson),
Today across all classes, the class's study tools, and the labelled path. On the website, students who have
studied here get them under "Your next step": a tab per class, the class card and the unit they are in, beside
Today, the tools and where they left off (two columns on wide screens). A first visit keeps the intro and the
three steps.

**Kept simple (2026.10.19.4).** The start page reads top to bottom in a few groups: the hero (the day, the next
exam, Today), Bo (the Bo card for members, one line and the one-minute demo for visitors), the next step, Your
classes, Your day, and More to explore. Class cards show the class, its next exam and one button (the details are
on the class page). Your day starts with three cards (today's schedule, what is due, the week); Customize brings
back the rest (`settings.homeHide`; an account that never customized gets `START_HIDE` in `assets/dash.js`). The
week across classes, classmates and study guides are a closed `<details>` (`#land-more`), remembered open or shut
(`settings.landMore`) and filled only when opened, so the start page makes no discussion, Canvas or community
requests until then. Phones get the class cards two to a row. A class page shows no From Canvas box when Canvas
has nothing coming up.

**Exam week.** From 7 days before an exam (`App.home.examWeek`), the start page (website and apps) and the class
page show a plan for today (the weakest topic as a 5-minute lesson, flashcards due, a timed practice exam in the
last three days, the prep checklist) and one for each day until the exam (weak topics spread over the days, the
practice exam the day before, a light review on exam day). It is built from readiness, so it follows what the
student has practised. The quizzer takes `?exam=ID&timed=1` to open in exam mode on that exam's topics.

## The call demo page (#/max)

`assets/max.js`, `assets/max.css`, `#/max`, for everyone (signed in or not). A call with Bo that plays by itself in
about 27 seconds: you write 2x + 3 = 11 by hand, Bo looks, circles the slip, then puts up a page with the steps and a
graph (the real board, `App.boBoard`). Captions come word by word; Pause, Replay and "Read what they say" (the whole
script as text); reduced motion shows the finished call. Under it: how it works (three steps), what you get (four
tiles), and Try it now. Its Call Bo opens the Call Bo sheet (below), or asks a visitor to sign up; the small print says
how long the member's credits last on a call (`ai_status`). Linked from the visitor's start page and Ask Bo.

## Credits: everything with Bo is paid in them

`api/credits.php`, `assets/usage.js` (`#/usage`; `#/calls` opens it too), the admin panel's Credits tab
(`assets/admin.js`). Like Claude's plans: **every account gets credits each month** (`credits_free` 100, `credits_pro`
1,000, `credits_max` 2,000) and **more are bought ahead**, 1,000 (`credits_pack`) for $10 (`credits_pack_price`), as a
one-time RevenueCat product (`credits_product`, `mathub_credits`) sold on the website through its Web Purchase Link
(`credits_link`, opened with the member's RevenueCat id). All of these are in Site settings → Payments. 1 credit is
about 1¢; the server counts thousandths.

- **What uses them.** Every answer (chat, the floating Bo, basic voice, recaps, building a class, keeping long chats
  short) by the tokens it took (`mh_ai_meter` → `mh_credits_ai`: Anthropic's price for the model × `credits_markup`, 2);
  a live call by the minute at its rate (`credits_call_strong` 17 on Max's stronger model, `credits_call_light` 6
  otherwise, kept on the call as `ai_live.rate`, one row per call that grows as `ai_live_tick` reports it); Bo's
  voice and listening; a picture (`credits_image` 15, `credits_image_big` 22 wide or tall). `credit_use` keeps each
  use (feature, credits, how much came from the month's and the bought ones, a short description), about 13 months.
- **Order and limits.** The month's credits first, then the bought ones (`credit_add`: + per purchase and gift, − per
  refund). `mh_credits_need` refuses anything that cannot be paid (402, `credits: true`; the page says how to get
  more); a call ends when the credits run out ("That was all your credits…"). `ai_live_daily` (240) and
  `ai_live_monthly` (3000) stay as safety limits only. Administrators are never charged (their use is written down at
  zero). Call hours bought before credits became credits once, 1,000 an hour (`mh_credits_migrate`). The free
  minutes (`ai_trial`) are retired; invites give both members `ai_invite_credits` (100, up to 1,000 per account).
- **Purchases** (`credits_sync`): the server reads the member's RevenueCat record (`non_subscriptions`) and adds a
  pack for each transaction it has not seen (old `mathub_call_hour` ones are 1,000 each); a transaction that is gone
  (refunded) is taken back once. It asks at most once a minute, or at once after the checkout (`#/usage?paid=1`, set
  as the link's success page) or "I paid", and when someone runs out mid-call.
- **#/usage** (account menu → Usage & credits; the Bo card's Credits; Your plan): credits left as one big number, the
  month's (a meter, and when they come back) and the bought ones, Buy 1,000 credits (opens the checkout in a new tab,
  then I paid), this month by feature, the last 30 days as bars, what things cost, everything used, what was bought,
  refunded and given, and how Bo sounds on calls (the same settings as the call's own sheet). In the apps the page
  only says credits are bought on the website.
- **Admin → Credits** (`admin_credits`): this month by feature, from the monthly and the bought credits, about what
  it cost, packs sold and refunded and what they brought in (before fees), credits given; what things cost with a
  link to Site settings and whether the purchase link and RevenueCat are set; every member who used or has credits;
  **Give credits** (`admin_credits_grant`: a minus sign takes them back, a note only administrators see, and an inbox
  message to the member); and every purchase, refund and gift.

## Call Bo: one clear way to start a call

`assets/call-launch.js` (`App.callBo`). The phone button in the top bar (every page, signed in, on the website), the
start page's Bo card, each class page ("Call Bo about Calc I") and the demo page open one sheet: pick the class to
talk about (the member's classes as radio cards in their colours, or Anything else), see the credits and about how
many minutes they make at their rate, who Bo is today (Change goes to his settings), and Start. The first time it
also says what a call sends where, and Start counts as agreeing; the first call then opens on how a call works. Out
of credits, Get credits takes Start's place. On a phone the sheet comes up from the bottom.

## The student file, and long chats kept short

`api/students.php`. One JSON file per member in `api/data/students/<id>.json` (denied to the web like the rest of
`api/data`): their classes and how they are doing in each (from the progress summaries the devices send), how they
like to learn (Bo's notes), short summaries of long chats per class and of long calls, a line per recent call and the
pictures Bo made. A short part of it goes with every question and call (`mh_student_context`), and the picture model
gets one line from it (class and level, never a name or email). **Compaction:** a chat sends its last 10 turns
(`MH_AI_TURNS_SENT`) plus its summary; once 14 or more turns (`MH_STUDENT_COMPACT_AT`) pile up behind them, the
cheap model folds them into the summary after the answer has gone out (a shutdown function). A live call does the
same in the browser: past 24 turns, all but the last 10 go to `ai_compact`, the summary is put first in the call
(`conversation.item.create`, `previous_item_id: root`) and the old turns are taken out (`conversation.item.delete`);
the chat still gets every word. Ask Bo → What Bo knows shows the file (See it) and downloads it; Forget everything
empties it; it is in Download my data; files of deleted accounts are removed by housekeeping.

## Bo draws anything

`assets/board-draw-more.js` adds to `assets/board-draw.js` (`App.boDraw.kind` for new kinds, `graphPart` for new
parts of a graph): **implicit curves** (an equation in x and y, marching squares), **polar curves**, **slope and
vector fields** with solution curves (RK4), **contour and heat maps**, **3D surfaces and curves** (painter's
algorithm, turned by dragging or the arrow keys), **his own SVG** (parsed and rebuilt from an allowlist of elements,
attributes and styles: no scripts, handlers, links out or foreign content; ids made unique) and **pictures**
(`api/images.php`: `ai_image` asks OpenAI's image model, `ai_image_model` gpt-image-2, falling back to gpt-image-1;
the picture is kept in `api/data/ai-img/` under a hash of what was asked, so the same one is never made or paid for
twice, and served to members by `ai_image_file`). Any drawing that does not move has View large (zoom, pan, Escape).
The prompts tell Bo he can draw anything and how (MH_AI_DRAW, the draw_on_board tool).

## Bo's characters, recaps, exam review calls, study rooms and Bo quality

- **Characters** (`assets/bo-characters.js`, `mh_ai_character` in `api/ai.php`): Professor Bo (the default, an
  80-year-old Harvard professor), Coach, Detective, Zen and Buddy Bo. Each has his own manner, opening, live voice and
  pace (a student's own voice and speed win) and look (glasses and a bow tie, a cap, a deerstalker, closed eyes and a
  leaf). Picked in Settings, at the top of Ask Bo and in a call's settings (`settings.boPersona`); every request to
  Bo carries `persona`. See docs/bo-teaching.md.
- **The recap after a call** (`ai_recap`): a page with what you covered, the slip, three problems (checked by the
  math check), saved in the chat, emailed (`users.recap_email`, Settings → Account) and put in the mistakes notebook
  with the slips the app caught on the call, due now.
- **The heads-up before an exam** (`mh_exam_nudge_tick` in `api/growth.php`, from 9 am, a few members per visit):
  an exam in 2 or 3 days in the classes a member picked gets one email and push (`exam_nudges`;
  `users.exam_nudge`; admin → Site settings → Email → `exam_emails` turns them off for everyone, and `recap_emails`
  does the same for the recap emails). Its link, `#/tutor/<class>?call=exam`, opens a review call (MH_AI_EXAM_CALL) for anyone
  with credits for about five minutes of it; others get the exam prep page.
- **Max calls use the stronger model** (`ai_live_model_max`, `gpt-realtime-2.1` by default, at `credits_call_strong`
  a minute; everyone else gets `ai_live_model` at `credits_call_light`). If OpenAI refuses it, the call goes ahead on
  `ai_live_model`.
- **Study rooms** (`api/room.php`, `assets/room.js`, `#/room/CODE`): on a call, the people button opens a room;
  up to three classmates join with its code, see the board (both ways, `App.boPad` `onOp`/`remote`/`snap`), Bo's
  pages and the captions, and type questions Bo hears with their name. Each side posts changes and polls once a
  second (no peer-to-peer, no TURN server needed). Events are kept three hours, rooms a day.
- **Bo quality** (admin → Bo quality, `ai_admin_quality`): by week, answers, the students' and Bo's slips the math
  check caught, rewrites, pages held back, calls and recaps (`metrics`, keys `bo_*`), and the answers students
  marked not right with the thumbs down in Ask Bo and the floating Bo (`ai_flag`, `ai_flags`), with Done.

## News emails (Email everyone)

`api/news.php`, the admin panel's Email everyone tab, `#/unsubscribe`. The administrator writes one email (subject,
paragraphs, a button and its link; `{name}`, `{credits}` and `{minutes}` are filled in), sees it as members will, sends a test to
themselves, then sends it to every verified member who has news on (`users.news_email`, on by default; Settings →
Account → News from Mathub). It is ready with the email about Bo on every account and the free monthly credits. Sending goes in batches of
ten every few seconds while the admin page is open, and a few on every visit to the site otherwise
(`mh_news_tick` in housekeeping); `news_sent` makes sure nobody gets it twice. Three failures in a row with nothing
sent pause it with the mail server's error. Each email ends with a link to `#/unsubscribe?u=…&t=…` (a signed link:
a page with one button, so mail scanners that open links change nothing) and carries `List-Unsubscribe` and
`List-Unsubscribe-Post` headers, so mail apps can unsubscribe in one click (`news_unsub`, checked by its signature,
no login).

## Security, privacy and quality

The October 2026 audit against what careful, large sites do (and where AI-built sites usually fall short), with sources and what changed, is in [`docs/quality-audit.md`](docs/quality-audit.md). In short:

- **Headers.** `index.html` and the static pages carry a Content-Security-Policy with no inline scripts (startup code is `assets/boot.js`, MathJax settings for static pages `assets/mathjax-static.js`); scripts come only from this site and `cdn.jsdelivr.net/npm/mathjax@3.2.2/`. `.htaccess` adds HSTS, frame protection, Permissions-Policy, Cross-Origin-Opener-Policy and an HTTPS redirect. `api/.htaccess` allows only `api/index.php`.
- **Fonts** are self-hosted (`assets/fonts.css`, licences in `assets/fonts/`); no Google Fonts request.
- **No tracking.** No ads, analytics, tracking pixels (Meta, Google, TikTok…), session recorders or third-party cookies; the only cookie is the sign-in session, and emails carry no pictures or tracked links. The pages' policy allows scripts only from Mathub and the pinned MathJax, pictures only from Mathub (`data:`/`blob:` too), and connections only to Mathub and the services the privacy policy names (jsDelivr for MathJax and Pyodide, the Free Dictionary API). `tests/privacy.test.js` fails if any of that changes: a tracker's script, pixel or global in any shipped file, a looser policy on the app or any static page, a second cookie, a picture in an email, or a fetch to a host the policy does not name.
- **Accounts.** Common passwords are refused, logins take the same time whether or not the account exists, **Settings → Signed-in devices** can sign out every other device, and **Settings → Download my data** exports everything stored about the account (secrets left out).
- **Errors.** Unexpected server errors show a reference code and log the details. Browser errors are reported without personal data (`client_error`) and grouped in **Admin panel → Site errors** for 45 days.
- **Staff scope.** Instructors and TAs act only on the classes they teach; only moderators post to every class.
- **Contact.** `/.well-known/security.txt`; the policy page has an accessibility statement (target: WCAG 2.2 AA, checked by `tests/a11y.test.js`).

## GPA calculator

`assets/gpa.js` adds a GPA calculator at `#/gpa` (also under Course in every class sidebar, in the account menu, on the account settings page and from each grade calculator). It uses Montana State's 4.0 scale with plus and minus grades (A 4.00, A- 3.67, B+ 3.33 … D- 0.67, F 0). The semester table starts with the student's chosen classes and their credits, and each row shows the letter that class's grade calculator projects from the scores entered there, with a one-click "use it". Add or remove classes, mark one P/W so it is not counted, and see semester GPA, graded credits and quality points, with a Dean's List (3.50 on 12+ credits) or below-good-standing flag. Enter the GPA and graded credits from before this semester for the cumulative GPA and its change; set a goal to see the semester GPA it needs (and roughly which letter in every class), or how many more credits at 4.0 it would take when it is out of reach this semester. A what-if table shows how one grade step up or down in each class moves the result. Everything is saved in the browser.

## Today: one plan across every class

`#/today` (Today in the account menu, the mobile tab bar and the hero button) builds one checklist for the day from all your classes: flashcards that are due on a spacing schedule (a card you get right comes back after 1, 3 and then 14 days; one you miss returns tomorrow; up to ten new cards per class), a lesson on your weakest topic (lowest accuracy over at least four questions, otherwise where the class is right now), the daily challenge, and anything due in the next 48 hours. The review player runs across classes inline (space flips, 1 = again, 2 = got it) and counts toward XP, quests and the streak. A summary card on the landing page shows what is left. Today's counts work from the light class index even before a class has been downloaded; pressing Start downloads what it needs.

## The planner: school, life and what's next

Mathub plans the whole semester, not only the classes. The pages live in `assets/life.js` (the store, sync, the add dialog and quick add), `assets/life-school.js`, `assets/life-self.js` and `assets/dash.js`, styled by `assets/life.css`; the frame is `assets/shell.js` and `assets/shell.css`.

- **The frame on every page.** The sidebar and the top bar now show on the start page and every global page too (the apps and Mathub Faculty keep their own frames). The sidebar has the date, a clock (tap it for clock faces and your home time zone), progress bars for the semester ("Week 8 of 16") or the year, month and week, New and six quick-add buttons, the navigation in groups (Home, Today and Ask Bo; Your classes with the days left until each exam; School; Life; Future; Explore) and a month calendar with dots on busy days and exams marked. The button at its top hides it (remembered). Alt+N opens quick add anywhere.
- **School.** Tasks and assignments (`#/tasks`: this week, open, a drag-and-drop board and done; filter by class; priority, estimate and notes; "Add class deadlines" copies each class's deadlines in), Timetable (`#/timetable`: built from the classes' lecture, lab and recitation times in one dialog, overlapping blocks side by side, a now line, "Add to your phone" as an .ics file repeating weekly until the semester ends, and Print), Calendar (`#/agenda`: month, week and list, everything dated from your tasks, events, to-dos and projects plus every class's exams, deadlines and holidays and Canvas), Time tracker (`#/timelog`: a running timer per class, manual entries, hours this week by class, focus-timer minutes counted in) and Projects (`#/projects`: thesis, paper, lab report and talk templates whose steps are spread until the due date; a word count, sources and notes).
- **Life.** Habits (`#/habits`: every day or a number of days a week, streaks, the last weeks as dots), Goals (`#/goals`: by quarter, with steps and progress), Wheel of life (`#/wheel`: eight areas scored monthly, drawn as a radar against last month), Journal (`#/journal`: a page and a mood per day, a mood strip for the month) and Money (`#/money`: income and spending by category, budgets per category, what is left this month).
- **Future.** Career (`#/career`: internships and jobs on a five-stage board, from interested to offer) and Portfolio (`#/portfolio`: projects, skills and links on a sheet that prints cleanly; only http(s) links are kept).
- **Your day on the start page.** Cards for today's classes, what is due, a clock, the pomodoro (it shares its timer with the sidebar), to-dos, events, habits, goals, the wheel and the week. Customize hides cards; the choice follows your account (`homeHide` in `prefs`). Each class card shows its open tasks and next exam.
- **Saved with your account, offline first.** Everything is one document in the browser (`mathub-life`), so it works offline, and syncs through `api/index.php?r=life` (GET; PUT merges). The server and the page merge the same way: records with an `id` merge one by one and the newer change (`u`) wins, so two devices editing different things both keep their edits; deleted records leave a marker for 90 days so a deletion syncs too. A planner over 600 KB is refused with a clear message. A guest's planner is adopted by the account on sign-in; signing out clears it from a shared browser. Download my data includes it. Events can have a reminder (a toast and, if allowed, a notification while Mathub is open).

## Report a problem

A small flag sits on every practice question, lesson step, flashcard (in the control row) and topic page. It opens a dialog with the reason (wrong answer, typo, unclear, bug, other), an optional comment and, for questions, the student's own answer. Reports go to `issues` in the database (guests can report too; twenty per hour per address) and appear under **Problems** in the admin panel (moderators and admins), with open/resolved/all filters, the page link and the build. Resolving a report with a note sends the reporter an inbox notification; the same prompt reported by several people is counted.

## Only the class you open is downloaded

`assets/courses-index.js` is a generated light index of every class (facts, exams, calendar, unit and topic titles, quiz topic names, counts, and the list of files the class needs). The shell loads only that; `App.loadCourse(id)` fetches a class's data, question generators and tools the first time it is opened (a skeleton shows while it loads, with a retry button if the download fails) and merges them into the same object. The landing page, Today, search, GPA and calendars work from the index. Search downloads your other classes in the background the first time it opens so results cover everything; the class you visited last is prefetched when the landing page is idle. The service worker still precaches every class for offline use. **After editing any `*-data.js` or `*-quiz.js` file, run `node scripts/build-course-index.js`** so the index (titles, counts, calendars) matches.

## Push notifications

Settings → Account → "Notifications on this device" turns on web push (Chrome, Edge, Firefox, Safari 16.4+; on iPhone the app must be added to the home screen first). The server signs pushes with VAPID keys it generates once into `api/data/vapid.json` (PHP's OpenSSL, no extra library) and sends an empty push; the service worker then asks the server what is pending and shows it. Reminders go out in the evening before something is due and when a streak is at risk, at most once a day per account, from the same housekeeping pass that sends digest emails (any request triggers it; a cron hitting `api/index.php?r=health` every 15 minutes keeps it timely on a quiet site). "Send a test" checks the device end to end. Subscriptions that a browser has dropped are removed automatically.

## Install prompt, global search, synced preferences

- **Add to home screen.** From the second visit a banner offers to install Mathub: the native prompt on Chrome and Edge (Android and desktop), and step-by-step Share → Add to Home Screen instructions on iPhone and iPad. Dismissing hides it for a month; "Install the app" also lives in the account menu whenever installing is possible. The manifest has shortcuts (Today, Discussions, GPA) and a maskable icon.
- **Search everywhere.** Ctrl/⌘ K (or the search icon on the landing page) searches notes, formulas, flashcards, calendars, practice topics and pages across every class, with class chips to narrow it; each result shows its class.
- **Preferences follow your account.** GPA calculator entries, focus-sound choices, daily goal, theme, phonetics and reader voices, seen-changelog, Today state and the start page's hidden cards sync through `prefs` (newest wins). The planner syncs through `life` (see The planner). Course progress already synced.

## Backups

The server copies the SQLite database once a day (SQLite's own `VACUUM INTO`, consistent while in use) into `api/data/backups/`, which the web server cannot serve, and keeps the last fourteen automatic copies; manual copies are kept for 90 days. The admin panel's **Backups** tab lists them, makes one on demand and downloads any of them. Restore = stop, replace `api/data/mathub.sqlite` with a backup, start.

**Off-site copies** (`api/offsite.php`, `api/backupcrypto.php`). A copy that stays on the server is lost with it, so each day's copy also goes to a storage bucket you own on any service that speaks the S3 API (Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO):

- **Set up:** admin panel → Keys & settings → Off-site backups: the storage address, region, bucket, an optional folder, an access key that may only read, write, list and delete in that bucket, and an encryption passphrase of at least 12 characters. **Check** writes, reads, lists and deletes a small test file and says which step failed. Write the passphrase down somewhere other than the server: without it nobody can open the copies, you included.
- **Encrypted before it leaves:** gzip, then AES-256-GCM in 1 MB chunks, with a key made from the passphrase (PBKDF2-SHA256, 200,000 rounds, a new salt for every copy). A copy that was cut short, reordered or changed does not open.
- **Checked:** after each send the bucket must report the size and SHA-256 Mathub sent. Once a week (and from the Backups tab, **Restore test**) the newest copy is downloaded, decrypted and opened with SQLite: the integrity check must say ok and it must hold as many members as the copy that was sent. The Backups tab shows the newest copy off-site, the last restore test and the history; a failure shows there and in the weekly report.
- **Kept:** the newest 30 (`offsite_keep`, 1–90), and none older than 90 days, as the privacy policy says. Only Mathub's own copies are deleted; nothing else in the bucket is touched.
- **Opening a copy anywhere** (a computer with PHP 8): put `api/backup-tool.php` and `api/backupcrypto.php` in one folder and run `php backup-tool.php decrypt mathub-20261026-0300.sqlite.mhbak mathub.sqlite`. It asks for the passphrase (or reads `MATHUB_BACKUP_PASSPHRASE`) and never overwrites a file; `php backup-tool.php check mathub.sqlite` runs SQLite's integrity check and counts the members. To put it back: stop the site, replace `api/data/mathub.sqlite` with it (deleting `mathub.sqlite-wal` and `-shm` beside it), start. The tool does nothing on the web.
- The work runs from housekeeping after the page that started it has its answer, or in the cron route; never while someone waits.

## Running the site: answer tests, cost alerts, the weekly report, usage

- **Answer tests** (`api/evals.php`, admin panel → **Answer tests**). Real questions with what a good answer must and must not do, put to Bo exactly as a new student in that class would get him (the same instructions, class, character and instructor settings). A test has a class (or none), the question, the student's language, whether the class is hints only, and checks: phrases it must say ("a | b" for either), phrases it must not say, a number it must or must not state, and a sentence for a second AI call to judge it by. **Add the starter tests** adds 14: agreeing only with right answers, catching the wrong step, hints only meaning no final answer, never writing a student's paper, answering in the student's language. **Run all** asks them one at a time and shows each result as it comes; every run is kept (the last 50) and compared with the one before, so a test that passed then and fails now is marked newly failing and listed first. Runs cost credits like any use of Bo (feature "Answer tests"); administrators are not charged, but the cost is written down.
- **Cost alerts** (Keys & settings → Plans and payments: `cost_alert_daily`, `cost_alert_monthly`, in dollars, 0 = off). Bo's estimated AI cost comes from the credits used (credits ÷ `credits_markup`). When a day or the month passes its alert, each administrator gets one email saying how much and who used most, and the alert stands at the top of the Overview until the day or month is over. While either is set, a day costing over three times the average of the 14 days before it (and over $1) sends a spike alert too. The Credits tab shows today and this month against them.
- **The weekly report** (Keys & settings → Email: `admin_report` on or off, `admin_report_day`, Monday by default). From 8:00 site time that day each administrator gets the seven days before in one email: members, sign-ups and who was active (against the week before); Bo's use and cost by feature; credits sold; class requests by demand; open reports, problem reports and site errors; backups here and off-site and the last restore test; the last answer test run; the alerts. The Overview shows the same report, with **Email me this report**.
- **Class requests by demand.** The Class requests tab and the report list the most wanted first: by how many people asked, then by how many asked in the last 30 days, then by the first request.
- **Usage** (Growth tab). How far the last 30 days' sign-ups got (confirmed their email, came back on another day, asked Bo, paid) and what Bo cost, by week, for the last eight weeks.

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

`assets/motion.css` and `assets/motion.js` add staggered card entrances, ring and progress-bar fills, a top loading bar while a class downloads, button and chip micro-interactions, feedback on answers, a theme fade, and hover polish. Settings → Appearance offers five looks (Classic, Bobcat, Paper, Forest, Midnight) via `data-skin` on the root, and a Reduce motion switch (`data-motion="off"`, also honored from the OS setting) that turns every animation off. Both are applied before first paint by the inline script in `index.html` and follow the account. The tour of the layout (`assets/tour.js`) runs once for every account on the start page, people who took the older first-visit tour included (`tourLayout`, the layout version seen, synced with the account): on a computer the sidebar's clock and bars, quick add, the groups, the month calendar, the header, Your day, Bo and hiding the sidebar; on a phone the menu, search, Your day, Bo and the tab bar. Steps whose part is not on screen are left out, the card sits beside sidebar parts and its arrow points at the part, it waits for the welcome and dialogs, and Settings → Show the tour again replays it. Notes, formula sheets, calendars, planners, exam prep and the GPA page have a Print button, and the print stylesheet drops the chrome.

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

The logo is Bo the bobcat's head: the same drawing as the mascot (ears, face, eyes, nose and whiskers), in his own tan and brown in every theme, beside the wordmark "Mathub" in Gabarito. `assets/mark.svg` is the bare mark, `assets/icon.svg` Bo on a navy rounded tile (favicon, home-screen icon), `assets/logo.svg` the lockup and `assets/logo.png` a 1200px raster of it for places that cannot take SVG. In the app the mark is drawn by `App.logoSvg(size, tile)` from `App.LOGO_PATHS` (`assets/app.js`); `index.html` carries a static copy in the sidebar. `node scripts/build-icons.js` renders the PNG sizes plus a maskable 512 with Bo inside the safe zone, `node scripts/build-og.js` the social cards (flat class colour, a white mountain range, Bo on a white tile, fonts embedded from `assets/fonts`), `node scripts/build-seo.js` the static pages, which share the mark.

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
- **On every page.** Outside a class the same sidebar and header frame the start page and the planner pages: the clock and time bars, quick add, the planner's groups and the month calendar (see The planner).
- **Sidebar.** Inside a class, five groups by intent: Study (dashboard, notes, formulas, flashcards, practice, exam prep), Plan (calendar, learning path, planner, grade and GPA calculators), More tools (mistakes, Blitz, cheat sheet, my notes, textbook, class tools), Community (discussions, challenge, study sessions, mock exams, contribute, leagues, people) and Class info (syllabus, resources, settings). Study and Plan start open, the rest fold away and remember what you choose; the group holding the page you are on always opens. `App.groupNav` builds the groups from each class's own `NAV`, and any tool not named in the plan lands in More tools.
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
(here and off-site), Digest & cron, Bo quality, Answer tests, Credits and Growth. Moderators see Reports, Problems, Contributions and Mock exams; administrators see
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
  .htaccess                 caching, security headers (HSTS, frame protection) and the HTTPS redirect
  .well-known/security.txt  security contact (upload it too: it is a hidden folder)
  assets/                   styles, scripts, icons, manifest
  api/
    index.php               account endpoints (sign-up, verify, login, reset, progress sync)
    lib.php, mailer.php     helpers (blocked from the web by api/.htaccess)
    forum.php, filter.php   discussion board endpoints and the language filter
    canvas.php              Canvas calendar feed sync
    social.php              challenges, badges, presence, sessions, polls, mocks, contributions, digest
    push.php, extras.php    web push (VAPID), problem reports, backups, synced preferences
    growth.php              calendar feed, focus together, metrics, class goals, announcements, invites, planning email
    teach.php               the professors' section: syllabus builder, publishing, roster, announcements, assignments, attendance
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

**HTTPS.** `.htaccess` sends every `http://` visit to `https://` and tells browsers to stay on HTTPS for a year, so the site needs its SSL certificate active (hPanel → Security → SSL) before this build goes up. Hidden files and folders (`.htaccess`, `.well-known`) must be uploaded too; File Manager shows them when "Show hidden files" is on.

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
