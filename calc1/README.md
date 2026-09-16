# Study Hub

A self-contained study site for two Fall 2026 courses at Montana State University:

- **M171 Calculus I** (Active Calculus textbook)
- **PHSX 220 Physics I with Calculus** (OpenStax University Physics Vol. 1)

Plain HTML, CSS and JavaScript. No build step, no server code. Open `index.html` and choose a class.
Everything the student does (quiz history, flashcard progress, checklists, grade entries, scratchpad)
is saved in the browser's local storage, separately for each class.

## What's inside (both classes)

| View | What it does |
| --- | --- |
| Landing page | Pick a class; see each class's next exam, current topic, due-soon items and stats; a merged seven-day deadline list |
| Dashboard | Exam countdown, today's class, due-soon rules from the syllabus, streak and mastery, this week, weakest topics |
| Calendar | Full semester, week by week, today highlighted |
| Notes | Every topic: big ideas, key formulas, worked example, common mistakes, exam tip, textbook link |
| Formula sheet | Filterable and printable |
| Flashcards | 3-box mastery system with keyboard shortcuts |
| Quizzer | Endless procedurally generated problems (multiple choice and typed answers), practice or timed-exam mode, per-topic accuracy |
| Exam prep | Practice sets with worked solutions plus a checklist per exam |
| Grade calculator | Syllabus weights, current letter grade, what you need on the final (physics applies the drop-lowest-exam rule) |
| Scratchpad | Handwriting canvas with colors, eraser, undo, grid, PNG export |
| Syllabus & policies | Deadlines, help, exam rules |

Class-specific tools:

- **Calculus:** Grapher (tangent/secant, f′, f″), Labs (limit tables, difference quotients, Riemann sums, derivative from data, average rate of change).
- **Physics:** Projectile simulator (animated, with velocity components and a complementary-angle comparison), motion graphs x(t) → v(t) → a(t), kinematics solver (enter any three of Δx, v₀, v, a, t), vector calculator with drawing, incline & friction solver with a free-body diagram, unit converter and constants.

## Deploy (Hostinger or any static host)

Upload the contents of this folder so that `index.html` sits in `public_html` (or a subfolder):

```
public_html/
  index.html
  assets/
    styles.css
    app.js              shell: routing, storage, landing page, shared views
    tools.js            shared tools: quizzer, exam prep, scratchpad
    calc-data.js        M171 content
    calc-quiz.js        M171 question generators
    calc-tools.js       grapher and labs
    physics-data.js     PHSX 220 content
    physics-quiz.js     PHSX 220 question generators
    physics-tools.js    projectile simulator, motion graphs, solvers
  active_calculus.pdf   (optional: hosted calculus textbook PDF)
```

## Editing content

- Course facts, calendars, notes, formula sheets, flashcards, practice sets and checklists live in `calc-data.js` and `physics-data.js`.
- Question generators live in `calc-quiz.js` and `physics-quiz.js`. Each function returns one question; add a function and list it in `GENERATORS`.
- The physics week-by-week lecture topics are estimated from the syllabus topic order and exam weeks; adjust `CALENDAR` in `physics-data.js` when Canvas modules differ.
