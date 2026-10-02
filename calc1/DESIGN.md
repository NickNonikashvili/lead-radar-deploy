---
name: Mathub
description: Every class is a mountain and its next exam is the summit, drawn as a printed Bridger Bowl trail map.
colors:
  paper: "#F6F8FA"
  surface: "#FFFFFF"
  surface-2: "#EEF2F6"
  surface-3: "#E0E7EE"
  border: "#D7DFE7"
  border-strong: "#AEBCCA"
  ink: "#0F2236"
  ink-2: "#33475C"
  muted: "#566779"
  run-blue: "#1D5BB5"
  run-blue-deep: "#164A95"
  run-blue-soft: "#E3ECF8"
  pine: "#1E6B45"
  lift-red: "#C9352B"
  diamond: "#10161D"
  trail-sign: "#F2C230"
  trail-sign-ink: "#1B1500"
  warn: "#9E5300"
  gold: "#8A5C00"
  night-paper: "#0B1420"
  night-surface: "#101C2A"
  night-ink: "#E8EEF6"
  night-muted: "#93A6BA"
  night-run: "#82B1F5"
  night-pine: "#5FC690"
  night-lift: "#FF8676"
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
    fontFamily: "Barlow Condensed, Arial Narrow, Helvetica Neue, Arial, sans-serif"
    fontSize: "60px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, Helvetica Neue, Arial, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, Helvetica Neue, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.08
  body:
    fontFamily: "Barlow, Helvetica Neue, Arial, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Barlow, Helvetica Neue, Arial, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  sign:
    fontFamily: "Barlow Condensed, Arial Narrow, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.02em"
rounded:
  sign: "3px"
  sm: "4px"
  md: "6px"
  dialog: "8px"
components:
  button-primary:
    backgroundColor: "{colors.run-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    typography: "{typography.body}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.run-blue-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  exam-sign:
    backgroundColor: "{colors.trail-sign}"
    textColor: "{colors.trail-sign-ink}"
    rounded: "{rounded.sign}"
    typography: "{typography.sign}"
    padding: "5px 10px"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sign}"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    typography: "{typography.body}"
  you-are-here-pin:
    backgroundColor: "{colors.lift-red}"
    textColor: "{colors.surface}"
    rounded: "2px"
    padding: "2px 6px"
  nav-item-active:
    backgroundColor: "{colors.run-blue-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
---

# Design System: Mathub

## Overview

**Creative North Star: "The Trail Map"**

Mathub's default look is a printed ski-area trail map of the Bridger Range, the mountains on the horizon from the MSU campus. Every class is a mountain and its next exam is the summit; the sections on that exam are the runs up to it, marked the way a trail map marks them (green circle, blue square, black diamond). A student opens a class and reads it like a map at the base lodge: where the summit is, how far, which run they are on, and which one to take next.

The world is flat ink on plain paper. Snow-white ground, navy lettering, a handful of map inks (run blue, pine green, lift red, trail-sign yellow) and nothing that glows, shimmers or wears a gradient. Structure comes from hairline rules and whitespace, the way a printed map divides its legend, not from rounded floating cards. Each screen gets at most one solid plate (on the class dashboard, the trail board). The hand-made layer is Bo the bobcat and the 8-bit pixel art: the pixel Bridger skyline sits on the horizon of the start page and the trail board. Dark mode is the night map: the same inks re-mixed for a navy ground.

The look was chosen to replace an earlier world the owner felt read as AI-generated: purple and blue gradients and glow, every block a soft-shadow card (cards inside cards, tiny tracked capitals over everything), and generic voice and icons.

**Key Characteristics:**
- Flat map inks on white paper; no gradients, glow, blur or glass.
- Hairline rules and whitespace instead of cards; one solid plate per screen.
- Barlow Condensed for signage and numbers, Barlow for reading.
- Difficulty glyphs are the only ornament; Bo and the pixel art are the only illustration.
- Each class wears its own ink on its own pages.
- The exam is a yellow trail sign everywhere it appears.

## Colors

A printed map's palette: navy type on white, four working inks, and one ink per class.

### Primary
- **Run Blue** (#1D5BB5): the default accent. Primary buttons, links, the active nav item's icon, progress fills and the "blue square" run. On a class page it is replaced by that class's ink.

### Secondary
- **Trail-Sign Yellow** (#F2C230) with **Sign Ink** (#1B1500): the exam. The top-bar exam chip, exam chips in lists, announcements, lit streak days. Yellow never carries body text other than its own black lettering.
- **Lift Red** (#C9352B): urgency and position. The days-to-exam count, the "You are here" pin, error text and "bad" chips (darkened to #A82A21 for small text on tinted grounds).

### Tertiary
- **Pine** (#1E6B45): the green-circle run, "good" states, completed path nodes.
- **Diamond Black** (#10161D): the black-diamond run only.
- **Class inks**: calc #1D5BB5, physics #0F6E66, precalc #C2410C, WRIT #6B3FA0, CSCI #2E7D32, BIOB #4D7C0F, KIN #B45309, PSYX #BE185D. Each has soft, line and deep companions; class chips use the deep tone so small text passes AA.

### Neutral
- **Snow Paper** (#F6F8FA): the page ground.
- **Surface** (#FFFFFF) / **Surface 2** (#EEF2F6) / **Surface 3** (#E0E7EE): the trail board plate, chips and callouts, bar tracks.
- **Hairline** (#D7DFE7) and **Strong Rule** (#AEBCCA): section rules, row dividers, control outlines, the dashed trail line.
- **Navy Ink** (#0F2236), **Ink 2** (#33475C), **Muted** (#566779): headings, body, secondary text.
- **Night map**: ground #0B1420, plate #101C2A, ink #E8EEF6, muted #93A6BA, with lightened inks (#82B1F5, #5FC690, #FF8676). Yellow stays the same by night.

### Named Rules
**The Flat Ink Rule.** Every fill is one solid colour. No gradient, glow, inner shine or coloured shadow on any surface, button, number or title.

**The Sign Rule.** Trail-sign yellow means "exam". Do not spend it on anything else that is not an exam, a streak or a notice.

**The Own Ink Rule.** On a class page the accent is that class's ink, not run blue; on cross-class pages it is run blue.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, Helvetica Neue, Arial)
**Body Font:** Barlow (with Helvetica Neue, Arial, system-ui)
**Label/Mono Font:** the existing monospace stack, for code only

**Character:** Barlow is drawn from highway and trail signage: plain, sturdy and legible at a distance. The condensed cut does the shouting (exam names, countdowns, section numbers); the regular cut does the reading. Both are self-hosted (OFL).

### Hierarchy
- **Display** (700, 60px, 0.95; 46px on phones): the exam name at the top of the trail board, uppercase. The days count beside it is 72px (56px on phones) in lift red.
- **Headline** (700, 44px, 1.08): page titles, which on a class dashboard read as a sentence ("12 days to Exam 2. Here's the way up.").
- **Title** (700, 22px): panel titles, top-bar title, start-page course names; section titles on the start page are 28px.
- **Body** (400, 16px, 1.55): all reading text, capped near 62–68ch.
- **Label** (500, 14px): context lines that used to be tracked capitals. Sentence case, no letter-spacing. Small text never goes under 12px.

### Named Rules
**The No Tiny Capitals Rule.** Labels are sentence case at 13–14px. Uppercase is reserved for sign lettering (the exam chip, the summit row, the pin), set in Barlow Condensed.

**The Condensed Numbers Rule.** Counts that matter (days left, readiness %, section numbers) are set in Barlow Condensed with tabular figures.

## Layout

Fixed sidebar plus a single content column. Sections are separated by a 1px top rule with about 16px above the content (start-page sections by a 2px navy rule), not by boxed cards. Nested sections use a dashed rule. Lists of classes read like the lift board at the base area: one ruled row per class with its code, name, meta and action in columns.

The class dashboard opens on the trail board: the summit block (exam, date, days left, what it covers, readiness) in the left third, the trail (pixel ridge, summit row, runs, trailhead, legend, next-run actions) in the right two-thirds. The board sits directly under the page title (announcements, onboarding and streak notes come after it), so on a 1440x900 laptop the pin and the button are above the fold. Under 900px the board stacks: a compact summit block (exam and date beside the days left), then the trail, and the main "Take the next run" button spans the full width. Dates and week numbers sit under a title, never as a kicker above it. Phones and laptops get the same content, never a reduced phone version; there is no sideways scroll at 390px.

## Elevation & Depth

Flat by default. Surfaces sit on the page with a hairline, not a shadow. A shadow exists only for things that genuinely float above the page: dialogs, popovers, the account menu, toasts and Bo's speech bubble.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 14px 30px -14px rgba(15, 34, 54, 0.32), 0 2px 6px -2px rgba(15, 34, 54, 0.12)`): dialogs, popovers, toasts.
- **Hairline lift** (`box-shadow: 0 1px 2px rgba(15, 34, 54, 0.07)`): the sliding tab pill only, together with a 1px border ring.

### Named Rules
**The One Plate Rule.** A screen has at most one solid plate (the trail board on the class dashboard). Everything else is ruled sections on the paper.

## Shapes

Square-shouldered, like printed signs: 3px on signs and chips, 4px on buttons, inputs and small boxes, 6px on the tab track and popovers, 8px on dialogs. Panels have no radius at all, because they are ruled sections, not boxes. The difficulty glyphs are the only round or rotated forms: a 14px circle, a 14px square, a 12px square turned 45° and a hollow ring. The summit is a small solid triangle. The trail itself is a 2px dashed line.

## Components

### Buttons
- **Shape:** sign-plate corners (4px).
- **Primary:** the page's accent ink with white lettering, 15px Barlow 600 (16px on the trail board).
- **Hover / Focus:** hover darkens to the deep accent; no lift, scale or glow. Focus keeps the global visible focus ring.
- **Secondary:** white with a strong-rule outline; hover fills Surface 2. **Ghost:** no outline.

### Chips
- **Style:** 3px corners, Surface 2 ground, Ink 2 lettering, 13px Barlow 600, no border.
- **State:** an "on" chip inverts to navy with white lettering. The exam chip is a trail sign (yellow, uppercase condensed). Good and bad chips use pine and lift red on their soft grounds.

### Cards / Containers
- **Corner Style:** none for panels (ruled sections); 4px for the few remaining boxed items (link tiles, start steps).
- **Background:** transparent on the paper; white for boxed items.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px top rule for panels; 1px hairline around boxed items.
- **Internal Padding:** 16px above, 6px below for panels.

### Inputs / Fields
- **Style:** white, 1px strong-rule outline, 4px corners, 16px text (no zoom on iOS).
- **Focus:** the outline turns to the accent with a 3px accent ring at 22% strength.

### Navigation
- **Sidebar:** white, right hairline. Items are 15px Barlow 500 in Ink 2 with muted icons; hover fills Surface 2; the active item gets the soft accent ground, navy text at 600 and an accent icon. Group toggles are 16px Barlow Condensed in sentence case. Home's icon is a mountain with a flag.
- **Top bar:** near-opaque white with a bottom hairline, no blur. The title is 22px Barlow Condensed. The exam chip sits here as a yellow sign.
- **Phones:** a bottom tab bar, white with a top hairline; the active tab is the accent colour, nothing else.

### Trail Board (signature component)
The class dashboard's one plate. Summit block: uppercase exam name, date, the days count in lift red, what the exam covers, the prep checklist and the readiness line ("62% ready", with "How to raise it"). Trail: the pixel Bridger ridge across the top, a summit row with a triangle, then the exam's sections as runs from the trailhead (bottom) up to the summit. Each run is a ruled row: difficulty glyph on a dashed trail line, condensed section number, topic name, score. A run is graded from practice: green circle at 65% or better, blue square at 35% or better, black diamond below, hollow ring when not yet tried. The weakest section carries the lift-red "You are here" pin with Bo standing beside it, and the one primary button ("Take the next run", with the section's name on a second line) links to practice on exactly that section; exam prep, "Drill every run" and flashcards are plain underlined links beside it. A section with no practice questions is still a run (hollow ring, "notes only") and links to its notes. On first view the trail draws upward, the glyphs stamp in and the pin drops; with reduced motion all of it simply appears.

### Run markers
The same four glyphs appear beside every section in the notes contents, so a student sees which runs they have skied wherever they are.

## Do's and Don'ts

### Do:
- **Do** separate content with 1px rules and whitespace; reserve the plate for the trail board.
- **Do** set exams as trail signs: yellow ground, black uppercase Barlow Condensed lettering.
- **Do** mark progress with the four difficulty glyphs (green circle, blue square, black diamond, hollow ring) and nothing invented.
- **Do** let each class page wear its own ink; use the deep tone for small text so it passes AA.
- **Do** keep Bo and the pixel art as the only illustration, and keep the pixel ridge on the horizon.
- **Do** write labels in sentence case at 13–14px, and say things the way a fellow student would.
- **Do** keep one solid primary button per screen region; secondary actions are outlined buttons or underlined links.
- **Do** honour Reduce motion: every entrance (trail draw, glyph stamp, pin drop) has a no-motion path.

### Don't:
- **Don't** use gradients, glow, gradient text, glass or blur anywhere in the default look.
- **Don't** wrap sections in rounded soft-shadow cards, and never put a card inside a card.
- **Don't** put tiny tracked uppercase labels over blocks.
- **Don't** use purple-to-blue as a brand colour; purple exists only as WRIT 101's class ink.
- **Don't** lift, scale or glow buttons and rows on hover; darken or tint them instead.
- **Don't** spend trail-sign yellow on decoration.
- **Don't** put stock icons in front of section headings; a heading is its words.
