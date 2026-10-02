---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

## Scope

The whole app shell and every view share one world; the first surface that has to prove it is the class dashboard (#/<class>/dashboard), with the start page (#/) close behind. Visitor mode: Operate (dashboards, quizzer, tools), Read (notes, guides). Phone and laptop equally.

## Audience and job

Montana State students in a hard class, opening it to answer: when is the exam, what is on it, how ready am I, what do I do now. Constraint: every existing feature, route and test hook stays; Bo and the pixel art stay; the trail board, its run markers and the "You are here" pin with Bo stay (the owner likes them).

## Direction contract

THESIS: Big Sky. Every class is a mountain and its next exam is the summit, drawn as a bright, illustrated climb with a winding path of chunky run nodes; studying should feel like play, not paperwork. Craft bar: the category leaders the owner named (Khan Academy, Duolingo, Brilliant), never a copy of any. It refuses both earlier misses: the indigo-gradient glow SaaS look and the flat, colourless printed map.

OWN-WORLD: Montana daylight. White surfaces on a faint sky ground, deep Bobcat navy ink, each class in its own saturated colour, MSU gold for stars, streaks and XP, pine green for mastery, sunrise coral for urgency. Gabarito (bold, friendly geometric) for headings and numbers, Figtree for text. Soft 16px corners, 2px borders; anything you can press has a chunky darker lip and sinks when pressed. Layered illustrated ridges, Bo and the 8-bit Bridger Range are the art. Night-sky dark mode.

STORY: A student opens Calc I and sees the mountain: Exam 2 at the summit flag with days left, the exam's sections as round nodes climbing a winding trail, coloured by how they are doing, Bo standing at the next one saying you are here, and one big button to take it. Practising turns nodes green and moves Bo up.

FIRST VIEWPORT: Title sentence ("14 days to Exam 2. Here's the way up."), then the board at full width: a summit card on the left (exam name 48px, date, days-left badge, what it covers, chunky readiness bar, the big "Take the next run" button), the illustrated climb on the right (sky, layered ridges in the class colour, pixel ridge on the horizon, flag at the top, nodes zig-zagging up a dashed trail with labels beside them, Bo at the current node). Signature motion, once: the trail draws upward, nodes pop in, Bo hops in. Mobile: summit card, then the climb, button full width.

FORM: the category standard played straight at full craft (the owner's own words chose it: take inspiration from Khan Academy and similar high-traffic learning sites, do not copy them); keeps the trail-map mechanism from seed key eb47baac.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

The M-arrow logo stays. The extra looks (Realm, Bobcat, Paper, Forest, Midnight) stay opt-in; geek mode and the drifting background stay opt-in.
