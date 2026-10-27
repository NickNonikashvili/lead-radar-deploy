---
name: Mathub
description: Every class is a mountain and its next exam is the summit, drawn as a bright, illustrated climb.
colors:
  sky-ground: "#F4F7FB"
  surface: "#FFFFFF"
  surface-2: "#F0F4F9"
  surface-3: "#E3E9F2"
  border: "#E1E7EF"
  border-strong: "#CBD5E1"
  lip: "#D5DDE8"
  ink: "#14213D"
  ink-2: "#3B4A66"
  muted: "#536279"
  sky-top: "#BFDDFF"
  sky-mid: "#DDEEFF"
  sky-low: "#F3F9FF"
  big-sky-blue: "#1A64D6"
  big-sky-blue-deep: "#1450B0"
  big-sky-blue-soft: "#E3EEFD"
  sun: "#FFC629"
  sun-deep: "#E0A800"
  gold-text: "#8A5C00"
  gold-soft: "#FFF4D1"
  pine: "#22A447"
  pine-deep: "#178A39"
  good-text: "#137036"
  coral: "#F2564B"
  coral-deep: "#C9372D"
  coral-soft: "#FFE6E3"
  coral-ink: "#A82A21"
  run-blue: "#2F7BEA"
  diamond: "#1B2333"
  trail: "#A86B3C"
  trail-sign: "#8F5A30"
  bo-tan: "#D9A15B"
  bo-cream: "#F3DFB8"
  bo-brown: "#3B2A1C"
  night-ground: "#0D1626"
  night-surface: "#142036"
  night-ink: "#EEF3FA"
  night-accent: "#6EA8FF"
  class-calc: "#1D5BB5"
  class-physics: "#0F6E66"
  class-precalc: "#C2410C"
  class-writ: "#6B3FA0"
  class-csci: "#2E7D32"
  class-biob: "#4D7C0F"
  class-kin: "#B45309"
  class-psyx: "#BE185D"
typography:
  display:
    fontFamily: "Gabarito, Figtree, Helvetica Neue, Arial, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Gabarito, Figtree, Helvetica Neue, Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Gabarito, Figtree, Helvetica Neue, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Figtree, Helvetica Neue, Arial, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Figtree, Helvetica Neue, Arial, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.4
  button:
    fontFamily: "Figtree, Helvetica Neue, Arial, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  sm: "10px"
  md: "12px"
  control: "14px"
  tile: "16px"
  card: "20px"
  board: "24px"
  hero: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "22px"
  xl: "30px"
components:
  button-primary:
    backgroundColor: "{colors.big-sky-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    typography: "{typography.button}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "#3577DB"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.button}"
    padding: "9px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px 22px"
  tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  chip-exam:
    backgroundColor: "{colors.coral-soft}"
    textColor: "{colors.coral-ink}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    typography: "{typography.body}"
  nav-item-active:
    backgroundColor: "{colors.big-sky-blue-soft}"
    textColor: "{colors.big-sky-blue-deep}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  days-badge:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.surface}"
    rounded: "14px"
  you-are-here-pin:
    backgroundColor: "{colors.coral-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
---

# Design System: Mathub

> **2026.10.22.3, Big Sky, calmer** (`assets/clean.css`, loaded last, website default look only): the owner asked
> for a clean, modern, uncluttered site that is still Big Sky. The sky, mountains, Bo and class colours stay; the
> chrome changes: 1px borders everywhere (a generated rule thins every 2px border), a faint 1px edge under buttons
> instead of the 3–4px lip, headings at 700 and smaller (page titles 32px, the start page's 36px), borderless icons
> in the top bar with Call Bo as its one coloured button (Ask Bo leaves the top bar), the sidebar clock as one line
> and New without its six shortcut tiles. Where this file and clean.css disagree, clean.css wins.
> Dark mode (2026.10.22.4): clean.css loads after world.css at the same specificity, so its dark blocks must restate
> every text token it sets (--ink, --ink-2, --muted), and the start page's hero swaps to a night sky; tests/dark-mode.test.js
> checks 4.5:1 text contrast on the main pages in both the dark setting and the device's own dark mode.

## Overview

**Creative North Star: "Big Sky"**

Mathub looks like a bright Montana day. Every class is a mountain and its next exam is the summit; the class dashboard draws that literally, as an illustrated climb with the exam's sections as stops on a winding trail, Bo the bobcat standing at the one you are on. The rest of the product carries the same daylight: white cards on a faint sky-blue page, each class in its own saturated colour, friendly bold lettering, and controls that feel physical because they have a chunky edge and sink when pressed.

The craft bar is the most-used learning sites (Khan Academy, Duolingo, Brilliant): bright, warm, tactile and illustrated, with progress shown in plain colours. Mathub takes that level of craft, not their faces. Its own material is Montana State and Bozeman: Bo, the 8-bit Bridger Range, MSU gold for rewards, mountains drawn in the class colour, and ski-run difficulty marks for how a student is doing on each topic. Two earlier looks were rejected by the owner and stay rejected: purple and blue gradients with glow and generic soft-shadow cards (read as AI-made), and a flat, near-colourless printed map (read as a downgrade with no soul).

Density is comfortable: generous padding, one level of cards, never a card inside a card. Motion is used once per screen, where it means something: the trail draws itself and Bo hops onto his node.

**Key Characteristics:**
- White cards with 2px borders on a sky-blue ground; no gradients in the interface, no glow, no glass.
- Anything you can press has a darker lip under it and sinks when pressed; static containers have none.
- Gabarito for headings and numbers, Figtree for text.
- Every class wears its own colour on its pages and tiles.
- Gold means reward, coral means the exam is close, green means mastered.
- Bo is the logo and the guide; the Bridger Range (vector ridges and 8-bit pixels) is the scenery.

## Colors

A daylight palette: navy on white over a sky tint, a full set of class colours, and three meaning colours (gold, coral, pine).

### Primary
- **Big Sky Blue** (#1A64D6): the accent on pages that belong to no class (start page, Today, Settings, board). Primary buttons, active navigation, links (in its deep shade #1450B0). On a class page it is replaced by that class's colour.
- **Class colours**: calc #1D5BB5, physics #0F6E66, precalc #C2410C, writing #6B3FA0, CSCI #2E7D32, BIOB #4D7C0F, KIN #B45309, PSYX #BE185D. Each has soft, line and deep companions. They fill class tile covers, primary buttons on class pages, the mountains on the trail board and the class switcher.

### Secondary
- **Sun Gold** (#FFC629, lip #E0A800): rewards. Streak days, XP, level badges, the numbered steps of "Start here", the sun in the illustrations, the loading bar, text selection. Text on gold is dark (#3D2C00). For gold-coloured text use the text-safe Gold Text (#8A5C00).
- **Sunrise Coral** (#F2564B, deep #C9372D): the exam is close. The days-left badge, the exam chip in the top bar and on tiles (on Coral Soft #FFE6E3 with Coral Ink #A82A21), the summit flag, the "You are here" pin (on the deep shade so white text passes AA).

### Tertiary
- **Pine** (#22A447, deep #178A39): mastery. Solid runs on the trail, the readiness bar, finished path nodes, correct answers. Green text uses Good Text (#137036).
- **Ski-run marks**: green circle (Pine), blue square (Run Blue #2F7BEA), black diamond (Diamond #1B2333), white ring (not tried). They are the only difficulty language in the product.
- **Trail** (#A86B3C) for the dotted path; the trailhead sign sits on Trail Sign brown (#8F5A30) with white text.

### Neutral
- **Sky Ground** (#F4F7FB): the page. **Surface** (#FFFFFF): cards and tiles. **Surface 2** (#F0F4F9) and **Surface 3** (#E3E9F2): chips, tracks, segmented controls.
- **Border** (#E1E7EF) for every 2px outline; **Border Strong** (#CBD5E1) for hover and untried nodes; **Lip** (#D5DDE8) under neutral pressable things.
- **Ink** (#14213D) headings and body, **Ink 2** (#3B4A66) secondary text, **Muted** (#536279) captions.
- **Sky** (#BFDDFF to #DDEEFF to #F3F9FF): the illustrated skies of the hero and the trail board only.
- **Night sky** in dark mode: ground #0D1626, cards #142036, ink #EEF3FA, accent #6EA8FF; the sun becomes a moon and white numbers on coral turn dark.

### Named Rules
**The Meaning Colour Rule.** Gold is only for rewards, coral only for exam urgency, pine only for mastery. A colour that means something is never decoration.

**The Own Colour Rule.** A class page and a class tile wear that class's colour; pages that belong to no class wear Big Sky Blue.

**The No Glow Rule.** No gradient on any button, card, title or number, no coloured glow, no glass. The only soft gradients are the painted skies of illustrations.

## Typography

**Display Font:** Gabarito (with Figtree, Helvetica Neue, Arial)
**Body Font:** Figtree (with Helvetica Neue, Arial, system-ui)
**Label/Mono Font:** the existing monospace stack, for code only

**Character:** Gabarito is a bold, round-shouldered geometric face that is friendly without being childish; it carries the headings and every number that matters. Figtree is a clean, open text face that stays readable at 13px on a phone. Both are variable fonts, self-hosted.

### Hierarchy
- **Display** (800, 46px, 1.06, -0.025em): the start page question ("Which class is giving you trouble this morning?"); 34px on phones.
- **Headline** (800, 40px, 1.08): page titles, which on a class dashboard are a sentence ("14 days to Exam 2. Here's the way up."); the exam name on the trail board is 44px.
- **Title** (800, 21px): card titles, course names on tiles, section headings in notes.
- **Body** (400, 16px, 1.6): reading text, capped near 68ch; notes use 1.7.
- **Label** (600, 13.5px): captions and data labels in sentence case. Buttons are Figtree 700 at 15px.

### Named Rules
**The Sentence Case Rule.** No tracked uppercase labels and no kicker above a heading; a heading carries its own weight.

**The Gabarito Numbers Rule.** Counts that matter (days left, readiness percent, section numbers, stat numbers) are set in Gabarito with tabular figures.

## Layout

A fixed sidebar beside one content column, on every page of the website: the start page and the planner pages get the same frame as a class (only the apps and Mathub Faculty keep their own). Pages are stacks of white cards on the sky ground with 16-30px between them. Class lists are a responsive grid of tiles (auto-fill, 290px minimum). The class dashboard opens on the trail board at full width: the summit card in about a third, the illustrated climb in the rest; on a 1440x900 laptop the "Take the next run" button sits above the fold. Under 900px the board stacks (a compact summit card with the days badge beside the exam name, then the climb), nodes shrink and swing less, and every button that leads goes full width. Phones and laptops get the same content.

## Elevation & Depth

Depth comes from borders and lips, not from floating shadows. Static cards have a 2px border and no shadow. Pressable things (buttons, tiles, chips that toggle, quiz answers, trail nodes, class tiles) sit on a solid darker lip directly below them and drop onto it when pressed. Soft shadows are reserved for things that truly float: dialogs, popovers, toasts and Bo's speech bubble.

### Shadow Vocabulary
- **Lip, neutral** (`box-shadow: 0 3px 0 #D5DDE8`): secondary buttons, tiles, answers; 2px on small controls, 4px on class tiles and the board.
- **Lip, coloured** (`box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 66%, #0A1428)`): primary buttons and trail nodes, in a darker shade of their own colour.
- **Float** (`box-shadow: 0 18px 40px -18px rgba(20, 33, 61, 0.35), 0 3px 8px -3px rgba(20, 33, 61, 0.12)`): dialogs, popovers, toasts.

### Named Rules
**The Press Rule.** If it has a lip it can be pressed, and if it can be pressed it has a lip. Badges, pins, signs and labels never get one. Pressing moves it down by the lip's height; nothing lifts or glows on hover.

## Shapes

Soft and friendly: 10-14px corners on controls, 16px on tiles, 20px on cards, 24px on the trail board, 28px on the start-page hero, full pills for chips, progress bars and badges. Borders are always 2px. Progress bars are 12-14px pills with a pale highlight stripe across the fill. The trail nodes are circles; the difficulty marks are a circle, a square, a diamond (a square turned 45°) and a ring. Illustrations are flat layered shapes: ridges, a snowcap, clouds, a sun, plus the 8-bit pixel ridge.

## Components

### Buttons
- **Shape:** soft corners (14px; 12px small, 16px large).
- **Primary:** the page's accent with white text (dark text in dark mode), Figtree 700, on a darker lip of its own colour.
- **Hover / Focus:** hover lightens the fill slightly; focus shows a 3px accent ring; pressing drops it onto its lip.
- **Secondary:** white with a 2px border and a neutral lip. **Ghost:** no border, no lip.

### Chips
- **Style:** full pills, Figtree 700 at 12.5px, on Surface 2. Toggle chips are white with a 2px border and a small lip; the on state takes the soft accent.
- **State:** the exam chip is coral (Coral Soft and Coral Ink); good and bad chips use pine and coral tints.

### Cards / Containers
- **Corner Style:** 20px (16px for tiles).
- **Background:** white on the sky ground.
- **Shadow Strategy:** none for static cards; a lip for anything clickable (see Elevation & Depth).
- **Border:** 2px Border.
- **Internal Padding:** 20px 22px.

### Inputs / Fields
- **Style:** white, 2px border, 12px corners, 16px text.
- **Focus:** the border turns the accent with a 4px accent ring at 20%.

### Navigation
- **Sidebar:** white with a 2px right border. Bo's head and the wordmark at the top, the class switcher as small pressable pills (the current class filled in its colour), then grouped items in Figtree 600; the active item has the soft accent ground, a 2px accent outline and deep-accent text and icon.
- **Top bar:** white with a 2px bottom border; the title in Gabarito; the exam as a coral pill. On global pages the crumb names the section ("Plan › Tasks") and the coral pill is the soonest exam across your classes, a link to its class.
- **Sidebar outside a class:** the same white rail, top to bottom: the date in Gabarito with a clock button (tabular figures), progress bars (88px label, a 6px track in accent, the percent in Gabarito), the New button (accent, on its lip) over a 3-column grid of quick-add tiles, the navigation groups (folding, remembered), then a month calendar of day cells up to 32px: today a 24px accent circle, a 5px accent dot under a busy day, a coral dot under an exam day, days outside the month in muted.
- **Phones:** a bottom tab bar, white with a 2px top border; the active tab in the accent colour. The top bar keeps only the menu, where you are, Call Bo, the inbox, search, sounds, the language globe (without its code) and the account (its avatar alone), with 36px touch targets: the title is two lines (the section in 11.5px muted above the page name in Gabarito 17px, each ellipsised), the streak and daily goal move into the menu beside the logo, and Bo is the bubble in the corner.
- **The tour of the layout:** the spotlight's 4px accent ring cuts the dim layer around one part; the card (white, 16px radius) sits beside a part of the sidebar with its arrow pointing left, and above or below anything else with its arrow on the part's centre; a step counter in accent caps, the title in Gabarito, Skip as a ghost button, Back and Next (accent) on the right; dots along the bottom.

### The Trail Board (signature component)
The class dashboard's centrepiece. The summit card holds the exam name, its date, a coral days-left badge, what it covers, the readiness line with a green progress bar and "How to raise it", and the big "Take the next run" button (the section's name on a second line) with text links to exam prep, drilling every run and flashcards. Below the readiness bar, the next three unchecked items of the exam's prep checklist can be ticked right there. The climb beside it is an illustration: a sky with a sun and clouds, far ridges, and one big mountain in the class colour whose snowcapped peak sits under the summit flag, with the pixel Bridger Range along the bottom. The exam's sections are round nodes zig-zagging up the face of that mountain on a dotted trail, from a trailhead sign to the flag, each coloured like a ski run by the student's readiness on its topics, with a light label beside it (text with a sky-coloured halo, no box). The current node is larger, ringed in the accent with a slow pulse, has a 64px Bo standing beside it, and its label is the one filled card on the climb, with a "You are here" pin. On first view the trail draws upward, nodes pop in and Bo hops onto his node.

### Class Tiles
On the start page each class is a tile, four across on a laptop: a cover in the class colour with the course code in large white Gabarito, the next exam as a white pill and the class's own 8-bit sprite (an integral sign for Calculus, Newton's apple for Physics, a rising graph for Precalculus, a scroll for Writing, a computer for CSCI, a potion for Biology, a heart for Kinesiology, a brain for Psychology), then the course name (with a two-line description for visitors only) and one soft-filled button to continue. Nothing else: what is covered now, the numbers and the dates are on the class page. On a phone the tiles go two to a row, with a shorter cover and the sprite in its top corner. The whole tile presses.

### Bo, the logo
The mark is Bo's head, the same drawing as the mascot, always in his own tan, cream and brown. Bare in the app (sidebar, page headers), on a navy rounded tile for icons, on a white tile on share cards. He tilts his head when pointed at.

### Bo's characters
Where Bo appears as the tutor (Ask Bo, calls, the floating Bo, study rooms) he wears the touch of the character the student picked, drawn over the same bobcat in flat shapes: Professor Bo's white eyebrows, round dark glasses and a deep red bow tie; Coach Bo's blue cap and whistle; Detective Bo's tan deerstalker; Zen Bo's closed eyes and a green leaf; Buddy Bo bare. The logo itself never changes. The picker is a radio group of cards (avatar, name, one line, a sample in italics; "default" chip on Professor Bo); compact in a call's settings, with no samples.

### Study rooms
A classmate in a study room gets the call's whiteboard on the whole screen in the light surface (not the call's night sky: they are watching and writing, not on the call): a top bar with Bo's face, "Study room with {name}" and Leave; the board with its usual tools; the captions in a quiet band above a full-width "Type a question for Bo" box. The host's room panel matches the call's settings panel; the code is set large in mono, in two groups of three.

### Draft feedback (writing classes)
A review reads like a marked-up paper, not a report card. On a computer the draft sits on the left on a white sheet in the display face (17.5px, line height 1.8), Bo's notes on the right; on a phone his read and the biggest revisions come first, then the paper, then the margin comments. A commented passage gets a soft tint by kind (praise on Good Soft, a question on Accent Soft, a revision on Warn Soft, a source on Gold Soft) and a small round pin with its number in front of it; the two or three biggest revisions are lettered and underlined with a dashed Warn line instead of tinted, so they read as the larger moves. Pins and the numbers beside the notes are outlined in the kind's colour on the surface, with ink text, so they pass contrast in both themes. Bo's read opens on Accent Soft with his face. The form uses pill radios (selected: Accent Soft with an Accent ring and ink text) and a tall textarea in the display face, so pasting a draft already looks like the paper it becomes.

Under each note, a row of small pill buttons answers it: **Done** (on: Good Soft with a Good ring), **I disagree** (on: Warn Soft with a Warn ring, and a one-line "Why?" field opens under it) and **Ask Bo about this** (a dashed outline: it opens something else rather than setting a state). A note marked done has its title struck through and its text in the muted ink, so what is left to do stands out. Above the paper, **Read it aloud** is a small button with the speed menu beside it; while it reads, the sentence is marked with a Gold wash (the CSS Highlight API, so the draft's own marks stay as they are) and the button reads Pause, pressed.

### Revision history
The versions run along the top as small cards (version, draft stage, words and date), each opening its review. The comparison is one panel: "Compare [version] with [version]" and a Side by side / In one text switch, a sentence of numbers, then the two texts in the display face. Side by side puts each paragraph beside its other version (unchanged ones muted so the changes stand out); added words are underlined on Good Soft, taken-out ones struck through on Bad Soft, never colour alone. On a phone the old version sits above the new one. "What became of Bo's notes" lists each lettered revision with two small tags, Bo's word and the student's; the reflection questions say "no AI: the answers are yours".

### Writer's notebook
A quiet two-column page: the fifteen entries in a sticky list on the left (a numbered circle that turns to a Good check when written, an Accent ring for this week's), the entry on the right with the prompt in a short field and the writing on a tall sheet in the display face (17px, line height 1.75) that grows as they write. The word count and "Saved" sit under the sheet in tabular numbers, never in a toast. On a phone it is the list, then one entry with "All entries" to go back. No Bo here: the floating button is hidden, because the notebook has no AI.

### The Instructor page
A working page, not a dashboard: four tabs (Settings, Shared with you, Patterns, Credits), the shared-drafts tab only when the class has projects. Settings is a stack of plain panels, each switch a checkbox row with its explanation under the label; each project is a disclosure (its summary says what is set: "assignment sheet · 3 criteria") holding the goals from the syllabus, the sheet and a rubric of name and description rows. Save sits in a sticky bar at the bottom of the form, with "Saved" or "Not saved yet" beside it in the muted ink, never only a toast. A shared draft opens on the draft review's own paper and cards (read-only), with the student's note and the reply box under it. Patterns are horizontal bars in Accent on a Surface-2 track with the count in tabular numbers beside each goal, and a sentence of totals; below five students the tab says how many have let drafts count and why it waits. Credits is one number field, the sum written out ("12 students × 50 credits = 600 credits in all"), and a confirm.

### Peer review swaps
The list page is a row of offers (a project picker and "Find me a partner") and the swaps as rows with small status chips (yours sent / theirs back, in Good when done). A swap is two columns: the partner's draft on the review paper, under a sticky bar that says what to do and holds "Comment on the selected words"; on the right, the comments as a list (the quoted words in italic muted ink, the note under them) and the note on the whole draft. Selected passages stay marked with an Accent wash through the CSS Highlight API, so the draft's text is never re-wrapped. Report and "Never pair us again" sit in a closed "Something wrong?" disclosure at the end, out of the way. On a phone the draft comes first, then the comments.

### Learning tools
**Check my work** is two columns: the photo picker as a dashed drop area on Surface-2 with the photo shown under it, and the result. The result is the lines as a numbered list in the mono face: right lines with a small Good check, the first wrong one on Bad Soft with a Bad border and a solid Bad mark (it takes focus, so a screen reader starts there), the lines after it dimmed. Why and the hint follow in a Surface-2 box, with "checked exactly" when the arithmetic confirmed the line. **Notes from slides** is the study notes on the left (a heading per section, bullet points, terms in a two-column definition list) and one flashcard on the right, sticky on a computer: a large button with "Question" or "Answer" in small uppercase letters, turned to Accent Soft with an Accent border on its answer side. **Office-hours prep** is a short page: when and where the office hours are (from the syllabus), the mistakes it starts from, an optional "stuck on" field, and the three questions as a numbered list in a larger size, each with its topic as an eyebrow and what to bring. All three print cleanly without their buttons.

### Running the site (admin panel, English only)
The admin's running pages share one vocabulary. A fact is a Surface-2 tile: an eyebrow, the number in a larger bold tabular face, and one or two muted small lines of detail (the copy's name in mono). A standing problem (a cost alert, a failed send or restore test) is a callout on Bad Soft with a Bad border, at the top of the tab it belongs to; nothing turns red that is not wrong. Amounts against a limit are a thin pill meter, Accent on a Surface track, turning Bad only past the limit. The weekly report on the Overview is short sections in an auto-fill grid (a small heading and plain bullet lines), the same words as the email. **Answer tests** are rows of three columns: the result (a Good or Bad mark, "newly failing" first), the question with its checks as chips, the actions; during a run an Accent bar fills test by test and each result appears under it as a row with a Good or Bad left rule, Bo's answer in a scrolling box. **Growth's** sign-up funnel is a list of meters with the count and the share beside each step, tabular numbers right-aligned. On a phone the rows stack and the meters take their own line.

### Docs, Slides and Sheets
Two layers. The page around a file follows the site's theme, light or dark; the file itself always looks as it will print and as Word, PowerPoint and Excel show it: a white page, the slide's own theme colours, a white grid with grey headers in Calibri (Carlito where Calibri is missing). Each kind has one colour, used only for its icon chip: blue for documents, orange for presentations, green for spreadsheets. **The lists** start with "Start a new one": templates as 4:3 tiles on Surface-2, each a small drawing of what it makes (a page with its heading and lines, a slide in its theme, a grid with a chart), the open-a-file tile dashed in Accent; then "Your files" as one bordered list of rows (icon chip, the name in semibold, "Edited …" and the size muted beneath, a menu button at the end). **An open file** has one quiet top bar (back to the list, the name as an input that only shows a border on hover and focus, the saved state in muted small text, turning Bad only when a save failed, the File menu and the kind's main action) and the toolbar under it: groups of 32 px icon buttons parted by thin rules, a pressed button on Accent Soft; it wraps on a computer and scrolls sideways on a phone. **Docs** is the page on Surface-2: 8.5 × 11 in (or A4) at 96 px an inch with an inch of margin, a soft shadow and an Accent ring while it is being written in; page breaks are a dashed rule with "Page break" small in its middle. **Slides** puts the slides down the side (the one open ringed in Accent, numbered) and the slide in the middle at the largest size that fits, with the speaker notes under it; the selected box has an Accent outline with eight round handles, and dashed orange guides appear when it lines up with the middle or an edge; on a phone the slides become a strip under the slide. Presenting is black around the slide, with a bar that appears when the pointer moves. **Sheets** is the formula bar (the cell's address, then fx and its contents in mono), the grid (the chosen cells tinted Accent with a 2 px Accent border round the active one and the square fill handle at its corner), and a foot with the sheet tabs and Sum · Average · Count of what is chosen. Dialogs, menus and colour pickers are the site's own, so the three feel like one app.

## Do's and Don'ts

### Do:
- **Do** put white cards with 2px borders on the sky ground, one level deep.
- **Do** give everything pressable a darker lip and a press-down state, and nothing else.
- **Do** colour class pages, tiles and illustrations with the class's own colour.
- **Do** keep gold for rewards, coral for exam urgency and pine for mastery.
- **Do** show progress with the ski-run marks and thick pill bars.
- **Do** give each class its own 8-bit sprite, drawn in the pixel style of Bo's world.
- **Do** keep Bo and the pixel Bridger Range in the scenery, and Bo as the logo.
- **Do** honour Reduce motion: every entrance and the node pulse have a still version.

### Don't:
- **Don't** use gradients, glow or glass on buttons, cards, titles or numbers; the only gradients are painted skies.
- **Don't** fall back to the flat, near-colourless printed look: the owner rejected it as having no soul.
- **Don't** put a card inside a card, or tiny tracked uppercase labels and kickers above headings.
- **Don't** lift or glow things on hover; press them down instead.
- **Don't** copy Khan Academy's, Duolingo's or Brilliant's faces, colours or mascots; match their craft.
- **Don't** spend gold, coral or pine on decoration.

## The planner pages and Your day

The planner (tasks, timetable, calendar, time tracker, projects, habits, goals, wheel of life, journal, money, career, portfolio) is Operate surface: scanability first, Big Sky in the details. Styles live in `assets/life.css`.

- **Page head:** the title in Gabarito, one muted line of what the page is for, the main action on the right (accent, on its lip). Below, a row of up to four stat tiles (white, 2px border, 18px radius, a 38px accent-soft icon tile, the number in Gabarito 24px, a muted label; warn or good tints only when the number means that) when the page has numbers worth knowing.
- **Class colour is the only colour a record carries:** a pill chip in the soft colour with deep-colour text and an 8px square of the class colour, from `App.classStyle(id)` (`--cc`, `--cc-soft`, `--cc-line`, `--cc-deep`). Records without a class stay neutral. Gold stays for streaks, coral for exams, pine for done; priority and late use the warn amber.
- **Lists and boards:** rows are 2px-bordered white cards with a 16px radius (a late row's border tinted warn); a 26px rounded-square check on its lip on the left, pine once done, the title then struck through in muted, never faded below contrast; the board's columns are surface-2 wells with a 20px radius, the dragged card dims and the column under it turns accent-soft with an accent dashed outline.
- **Timetable and calendar:** an hour grid with 2px column rules; blocks in their class's soft colour with a 2px border and lip in its line colour and the title in its deep colour; overlapping blocks share the column in lanes, and a clash is drawn dashed; a 2px accent now line with a dot on today. Month cells show up to three chips in the class's soft colour and "+N more".
- **Classes made from a syllabus, for everyone** (Create a class): under the drop zone three checks in small type, each with a pine icon (scanned for malware, a real course new to Mathub, for everyone without your name); a refusal is a warn callout with the reason; a class that is there already is an accent-soft callout with Open and Add it to your classes; the finished preview ends with Add CODE to Mathub (accent) and one muted line on who sees it.
- **The add dialog** (`Life.form`): one centred card (22px radius, 2px border on a lip), fields in two columns where they pair (date and time, class and priority), segmented controls for small choices, required fields named in the error ("Title is needed."). Quick add has the type tabs on top and keeps what you typed when you switch.
- **Clocks:** analog faces drawn in SVG with a coral second hand (left out on the small faces); your home time zone gets a second face beside it with the zone name and the difference in hours.
- **Your day (start page):** a compact hero (the date, one greeting line, Today and For professors) above a 12-column grid of panel cards (`.dw`, 3 to 5 columns wide on a wide screen with the week across the full width, a 6-column grid under 1280px): schedule, due, clock, pomodoro, to-dos, events, habits, goals, wheel, week. It starts with three (schedule, due, week); Customize brings back the rest. Cards keep their own height (no stretching to the tallest in the row). Each card has an icon, a Gabarito title and a link to its page; empty cards say what to add with one button.
- **Kept simple (start page):** one thing per group, top to bottom: the hero, Bo, the next step, the classes, Your day, then More to explore, a closed card with a chevron that opens the week, classmates and study guides as tabs. No row of extra buttons. Visitors get one Bo line (Bo on a soft tile, "Stuck on a problem? Call Bo.", a solid "Watch a 1-minute demo" button) instead of the Bo card.
- **The Max page (#/max):** a persuasion page in the night-sky call register: "Stuck? Call Bo." in display type with Bo in sun yellow, one plain line, one primary button and its small print; beside it (above it on phones) a call that plays by itself, drawn upright on a phone. Then three numbered steps, four tiles and a closing card. Short sentences, no paragraphs.
- **Moods** run along a scale of sky blues, never red to green; the wheel of life is a radar in accent over last month's outline in a dashed neutral.

## Mathub Faculty (a separate register)

The instructors' workspace at `#/teach` deliberately leaves Big Sky. It is an Operate tool for professors, and the owner asked for it to feel more grown-up than the student site, so none of the rules above about lips, Gabarito, mascots or class colours apply there. It is switched on by `<html data-surface="faculty">` and styled only in `assets/teach.css` (`.fx-*`).

- **Frame.** A navy rail (#142A4C) with the wordmark "Mathub" in Source Serif 4 and "Faculty" in Montana gold (#E1B43F), the page list grouped as Syllabus and Class; a white top bar with breadcrumbs, the save state, Print / PDF and Publish. Under 900px the rail becomes a drawer.
- **Type.** Source Serif 4 at 600 for page titles, section titles and the syllabus itself; Source Sans 3 for every control, label and table. Tabular numbers in tables. Codes (join code, course code in the rail) in JetBrains Mono.
- **Colour.** Restrained: cool neutrals, one ink blue (#1F4C91) for primary actions, links and focus; gold only as the mark of where you are (the active rail icon, the change bar). Red, amber and green only for what must be fixed, suggestions and done.
- **Controls.** 1px borders, 6px corners, 38px fields and buttons, no lips and no press-down; hover changes the fill, focus gets a 3px ring in the accent at 22%.
- **The page.** The syllabus is a white sheet on a grey desk, set in Source Serif 4, exactly as it prints. In the editor it sits beside the form and updates as you type; the part being edited carries a 3px gold change bar in the left margin, the way revised passages are marked in printed documents. Empty parts wait as italic placeholders.
- **Don't** bring the student site's pieces in (Bo, XP, confetti, pixel art, chunky buttons, class colours), and don't use tracked uppercase labels or eyebrows here either.

## The iPhone, iPad and Android apps (the app shell)

Inside the apps (`<html data-app="ios|android">`, `assets/app-native.js` and `assets/app.css`, never loaded by the website) the site's frame is replaced by an app's own frame, so the app does not read as the website in a wrapper. The pages themselves (class dashboard, notes, quizzer, settings) stay as they are; only the frame and the start page change. Same Big Sky tokens, fonts, lips and class colours.

- **Top bar** (`#appbar`, fixed under the status bar, 60px): on the left a Back button on pages below the tabs, then the current class as a chip in its colour that opens the class sheet; on the right the streak (flame) and today's XP against the daily goal (bolt, "12/30"), each opening a small note, and the account: the member's initial in a round avatar (to Settings), or a Sign in button. The website's top bar, sidebar and footer are hidden.
- **Start page** (`App.homeView`), top to bottom, so nothing the website's start page and class page show is lost:
  - *Your classes*: a row of class cards (132 × 118, class colour, its sprite, code, "Exam 2 in 3 days", a thin bar of topics mastered, a 5px lip; the chosen one ringed) and an Add a class card. Tapping a card switches everything below it.
  - *The class you picked*: a white card with the class name, the week and what the class is covering now, its next exam (a coral days-left badge, the date, what it covers and its weight, a pine readiness bar with "0% ready · Not started"; the whole row opens exam prep) and one big Continue button in the class colour naming the next lesson; under it, topics mastered. A "Class page" link opens the full dashboard (trail board and all).
  - *Today, all classes*: the daily goal bar, then at most three rows: flashcards to review, missed questions to retry, and what is due soonest (title, class, time, "Today"/"Tomorrow"), with "N more due this week" and "Full plan" to the Today tab.
  - *Study tools*: the class's seven most used tools as labelled tiles (Notes, Practice, Flashcards, Formulas, Exam prep, Calendar, Grades) and All tools, which opens the class sheet at that class's tools.
  - *Your path*: one sentence on how it works, then one banner per unit in the class colour (title, mastered count and a bar, the unit's exam, a labelled Notes button) that sticks under the top bar, and the lessons as 76px round buttons in a gentle zig-zag, each with its name and state beside it on the roomier side ("§1.1 · Up next", "Not started", "Mastered · 3 of 5 crowns", "Coming up in class"). Mastered lessons are pine, the next one has a bobbing Start bubble and Bo, later ones grey; each exam is a coral checkpoint with its date. Tapping a lesson (button or name) opens a card in the class colour with Start lesson, Practice and Notes.
- **Class sheet** (from the class chip or Add a class): a bottom sheet with your classes, Create a class from a syllabus, Choose Montana State classes, every tool of the current class, and everything else (Today, Focus room, Resources, Study guides, Tools, GPA, Leagues, Badges, Search, Focus sounds). It replaces the website's sidebar. The website's floating sounds bubble stays hidden in the apps until something plays, so it never covers the page.
- **The plans (Pro and Max)**: the same bottom sheet as the class sheet. Bo on a soft accent tile beside "Pick your plan" and both prices, one plain sentence on why it opened, then the plans as two selectable cards (name and price in Gabarito, pine-checked lines on what each unlocks; the picked one on the accent with an accent lip), a full-width button naming the plan and price ("Get Pro for $14.99 a month"), Restore purchases, and the renewal terms with links in small muted type. Where Bo is needed only Max shows ("Move up to Max" for Pro members). No countdowns, no crossed-out prices, no pressure copy.
- **Calling Bo** (website): the whole screen is the board you share. Before the call a night sky covers it (a deep navy radial gradient, a few faint stars, white text) with Bo large in the middle on a pale disc and the first-call card under him; once you are talking the sky lifts (.55s) and Bo becomes a tile in the top right corner: a 64px disc (52px on a phone) with a dark status pill beside it, three rings behind him moving with whoever is talking (blue for you, pine for him; still when motion is off). Over the board everything is dark glass on navy (rgba(10,22,44,.92)) so it reads on white paper: the class chip and clock top left, Bo's pages (a count badge in pine), CC (a red bar under it when captions are on, as in a video player) and settings top right; the call's round buttons in a dock at the bottom (Mute, Show Bo in accent blue, Photo, Type, End in coral); the board's tools in a dock on the left (a row over the call's dock on a phone). Captions sit centred above the dock: Figtree 600 at 24px (18px on a phone; small, large and huge in settings), white on rgba(8,8,8,.75) boxes per line, two lines that roll up, the speaker's name in front (Bo in light pine, You in light blue); solid black or a shadow outline instead in settings; they never take taps and fade after seven quiet seconds.
- **The shared board** (calls and Write it out): squared paper (#FBFCFE with dots every 32 units; a dark board #13213A with light ink in settings). Ink in near-black, blue, red, green and purple, three sizes; a highlighter in yellow (multiply). Bo's pages are paper cards (white, light tokens on either board, a 14px shadow, 420px wide, 340px on a phone) with "Bo · page n", copy, fold and put away in their bar, which drags them. Bo's marks are his pen: 3.4px orange-red strokes (#E8590C) with a slight hand wobble, checks in green and crosses in red, notes in italic 800 with a white halo, each drawn over 0.9s.
- **The grapher** (a graph of Bo's, opened from its corner button): the surface with a 2px divider, a side panel on the page colour (Curves with their colour swatches and show/hide, Add your own as "y =" and a mono field, Calculus options, his sliders, the readout) and the plot filling the rest with zoom buttons stacked top right; on a phone the plot on top and the panel under it. Inline graphs show small zoom, back and open buttons on hover, focus or touch, a dashed guide with a dot and "(x, y) slope m" where you point, and a dark pill "Click the graph, then scroll to zoom" when the wheel would otherwise get stuck.
- **Ask Bo** (`#/tutor`, the Bo tab, which shows Bo himself on a soft accent tile in the middle of the tab bar): Bo's 64px tile, "Ask Bo" and the class he is helping with, an info button for "What Bo knows", class pills; then the chat: Bo's answers on white cards with a 2px border (his 40px tile beside them, Copy and Report as quiet icons), the student's on the accent; a gold-soft strip when Bo saves a note ("Bo will remember: …", Forget it); suggestion chips; and a rounded composer with a photo button, the text box and a 44px send button, held above the tab bar, with one muted line that Bo can be wrong and how many questions are left. Before the first question a plain consent page says what goes to Anthropic. Without Max: "Meet Bo, your tutor" with four bordered perks and Get Mathub Max.
- **Bo's board** (Ask Bo and calls): a whiteboard by day and a slate board at night (the theme's surface with a faint 22px dot grid), 2px border and lip. A bar with a pen icon, "Bo’s board", Page n of N with round prev/next, Copy. Each page: a Gabarito 800 title with a short accent marker stroke under it; steps as numbered 30px ink-ringed circles, the words in ink-2 and the step's math on its own line, left-aligned; standalone math centred and large; the answer in a 2px pine box with a small "✓ Answer" label; tips on gold-soft with a bulb. Each new line wipes in left to right as Bo writes it (the one motion; none when motion is off), with "Bo is writing…" and a nodding pen while a page is open. In the chat, Bo's message has an accent "On the board: Title" button where the page goes. Wide screens: the board is a tall sticky column beside the chat. Narrow: it sits above the chat, sticky under the top, at most a third of the screen, and folds to its bar. On calls it is white in both themes.
- **Your plan** (`#/plan`): the plan on one big card (Max wears the sun: gold-soft wash, a sun-yellow gem tile, a gold lip; Pro the sky: accent wash and tile; free: Bo on an accent-soft tile), a state chip (Active in pine, Ends … in amber, Given to your account in accent), the plan name in Gabarito 800, a facts row (price, renews or ends, paid through, account), and the actions in a column on the right: Manage billing (primary for Max), Move up to Max (Pro), Cancel plan as a quiet coral text button, Check again. This month: three bordered meters (pine bars, coral past 90%, "n left" in Gabarito) and when they start again. The plans: three cards, the student's outlined in accent with a "Your plan" chip. Questions: a bordered list of details. Cancel plan opens one dialog: when it ends, a soft list of what stops and what is kept, optional reason chips and a note, and Keep my plan (focused) beside a coral-outlined Cancel my plan.
- **The welcome** (after sign-up, website): a full-screen Big Sky that goes from dawn to day as you move on: the sun rises from behind the range, clouds drift, and three ridges glide past at their own depths with every step while a small Bo on a white disc walks a pine trail of eight waypoints at the top. Big Gabarito 800 headlines (32–52px) with one calm paragraph and big pressable Back and Next on the sky; the picture on the left draws its own small story: Bo popping onto a pale disc with "Hi Riley!"; a class-coloured mountain whose white trail draws itself to the summit flag, sun-gold checkpoints popping in and an "Exam 2 · in 9 days" coral chip; a fan of flashcards, a quiz answered in pine with +10 XP floating up and a flickering streak; Bo's chat bubble typing, then his board writing three lines and a pine call button ringing; a syllabus flying into Bo and a teal class card shining out. The choices are pressable cards on the sky: classes with their pixel sprite, colours and a round tick; Free, Pro and Max with Max in sun gold when picked; the actions sit in a frosted dock. At night it is the night sky with a moon. Everything rests on its final look when motion is off.
- **Bo on the start page** (website, signed in): one card under the hero, Bo on a white tile, "Bo, your tutor" with what is left this month and a "Your plan · Max ›" pill; beside it three big pressable tiles (icon on a soft square, a Gabarito label and a small line), the first filled with the accent: Call Bo, Ask Bo, Write a class with Max; Write a class with Pro; Get Mathub Max and Get Mathub Pro without a plan. Max's card wears the sun like the plan card.
- **A locked class**: a white card with a lock on the class's soft colour, "CHMY 121 is locked", what is kept, then Subscribe to open it, Restore purchases and Back. On the start page its card turns grey with a lock and "Locked".
- **Exam week** (from 7 days before an exam, under the class card; the class card then drops its own exam row): a white card with a 2px coral border on a coral lip, a coral days-left tile, "Exam week: Exam 2 in 3 days", the date, what it covers and the readiness, a pine readiness bar, then *Today* (at most four rows with coral-soft icon tiles: the weakest topic as a lesson, flashcards due, a timed practice exam in the last three days, the prep checklist) and a folded "The plan for each day until the exam", one row per day, exam day in coral.
- **Tab bar**: Learn, Practice, Today, Discuss, Me; 70px plus the home-indicator area; the active tab on the soft accent ground with an accent outline.
- **Buttons** are chunkier in the apps (46px, small 40px, large 54px) for thumbs.
- **Don't** bring the website's hero, sign-up buttons or sidebar back into the apps. **Don't** leave a lesson, a number or an icon unexplained on the start page: every lesson is named, every count says what it counts.

## Classes students make, sharing and the start page on the website

The pieces above live in `assets/create.css` and `assets/home.css` and are shared by the website, in the website's frame.

- **Create a class** (`#/create`): one big card first, "Bo writes it from your syllabus": an accent border on a 5px accent lip and a soft sky wash from the top left; on the left Bo's 104px tile, the heading and three lines of what you get (book, cards, calendar icons in accent-deep); on the right the syllabus drop zone (2px dashed, 20px radius, an upload tile; solid accent while a file is dragged over; a solid chip with the file's name, size and an x once attached), "or paste its text" between two hairlines, the text box, Full or Shorter class, and Write my class (large, wand icon); one shield-marked line on what is sent, and how many classes are left this month. Below it "Other ways to add a class": one panel of rows (a 42px accent-soft icon tile, a bold line and a muted line, the action on the right): the example class, a share code, a class file, and "Use the AI you already use", a disclosure row whose chevron turns and opens the three copy-and-paste steps (accent-deep numerals, dashed dividers, no panels inside the panel). Then Classes you created, each row led by a tile in the class's own colour with its code on two lines. Guests see a plain callout ("Sign in to add a class") with Log in and Create an account.
- **Bo at work** (inside the Create card, full width): a surface-2 panel with Bo's small tile, what he is doing now in display type and "Step 2 of 6", a 12px progress bar that eases to each step (the page's one authored motion; pine when done, coral on a stop), and every step as a two-column checklist (pine ticks for done, a spinning ring for the current one, coral for a stop); then the class preview (its colour on the left, a lip under it) with Add. Without a plan, Write my class opens the plans card with Pro picked.
- **The plans on the website**: the paywall's content in a centred card (480px, 22px radius, 2px border on a lip) instead of a bottom sheet. Subscribe is a link to the checkout in a new tab; once clicked, an accent-soft note says to finish paying there and the second button becomes "I paid: check now". "I already subscribed" replaces Restore purchases. Same rules: the price, the renewal terms, Terms and Privacy, no pressure copy.
- **Share sheet**: the QR code on a white tile beside one sentence on who sees what ("They do not see your name or your progress"), the link in a read-only field, the code in two groups of four in mono, Copy link (and Send… where the system share sheet exists), and Stop sharing as a small coral text button at the bottom. On phones the QR sits centred above the text.
- **A shared class** (`#/c/CODE`): the class preview card (its colour, code and term, chips for what is in it, exam dates) with Add to my classes and a ghost Report, and one muted line on what adding needs. Never the owner's name.
- **The website's start page** for students who have studied here: under "Your next step", a row of pill tabs (one per class, the chosen one filled in its colour), then two columns from 1000px: the class card, exam week and the unit you are in on the left; Today, the study tools, where you left off and the quick buttons on the right (sticky). The path shows only the current unit on the website, with "The whole path" to the class page. A first visit keeps the hero, the class grid and the three steps.
- **Exam week on the class page**: right under the page heading, the same card made wide (from 900px): Today on the left, the day-by-day plan open on the right.

