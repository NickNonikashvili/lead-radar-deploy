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

A fixed sidebar beside one content column. Pages are stacks of white cards on the sky ground with 16-30px between them. Class lists are a responsive grid of tiles (auto-fill, 290px minimum). The class dashboard opens on the trail board at full width: the summit card in about a third, the illustrated climb in the rest; on a 1440x900 laptop the "Take the next run" button sits above the fold. Under 900px the board stacks (a compact summit card with the days badge beside the exam name, then the climb), nodes shrink and swing less, and every button that leads goes full width. Phones and laptops get the same content.

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
- **Top bar:** white with a 2px bottom border; the title in Gabarito; the exam as a coral pill.
- **Phones:** a bottom tab bar, white with a 2px top border; the active tab in the accent colour.

### The Trail Board (signature component)
The class dashboard's centrepiece. The summit card holds the exam name, its date, a coral days-left badge, what it covers, the readiness line with a green progress bar and "How to raise it", and the big "Take the next run" button (the section's name on a second line) with text links to exam prep, drilling every run and flashcards. Below the readiness bar, the next three unchecked items of the exam's prep checklist can be ticked right there. The climb beside it is an illustration: a sky with a sun and clouds, far ridges, and one big mountain in the class colour whose snowcapped peak sits under the summit flag, with the pixel Bridger Range along the bottom. The exam's sections are round nodes zig-zagging up the face of that mountain on a dotted trail, from a trailhead sign to the flag, each coloured like a ski run by the student's readiness on its topics, with a light label beside it (text with a sky-coloured halo, no box). The current node is larger, ringed in the accent with a slow pulse, has a 64px Bo standing beside it, and its label is the one filled card on the climb, with a "You are here" pin. On first view the trail draws upward, nodes pop in and Bo hops onto his node.

### Class Tiles
On the start page each class is a tile, four across on a laptop: a cover in the class colour with the course code in large white Gabarito, the next exam as a white pill and the class's own 8-bit sprite (an integral sign for Calculus, Newton's apple for Physics, a rising graph for Precalculus, a scroll for Writing, a computer for CSCI, a potion for Biology, a heart for Kinesiology, a brain for Psychology), then the course name, a line about it, what is being covered now and the next exam, and one soft-filled button to continue. The whole tile presses.

### Bo, the logo
The mark is Bo's head, the same drawing as the mascot, always in his own tan, cream and brown. Bare in the app (sidebar, page headers), on a navy rounded tile for icons, on a white tile on share cards. He tilts his head when pointed at.

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
