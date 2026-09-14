# M171 Study Hub

A self-contained study site for **M171 Calculus I, Fall 2026** (Montana State University, Active Calculus textbook).
No build step, no server code: plain HTML, CSS and JavaScript. Everything the student does (quiz history,
flashcard progress, checklists, grade entries, scratchpad) is saved in the browser's local storage.

## What's inside

| View | What it does |
| --- | --- |
| Dashboard | Exam countdown, today's class, due-soon list (WebWork / written HW / lab sheet rules), streak and mastery, this week's schedule, weakest topics |
| Calendar | The full Fall 2026 calendar from the syllabus, week by week, with today highlighted |
| Section notes | §1.1 – §5.2: big ideas, key formulas, a worked example, common mistakes and an exam tip per section |
| Formula sheet | Every rule from limits to the second FTC, filterable and printable |
| Flashcards | 55 cards with a 3-box mastery system and keyboard shortcuts |
| Quizzer | Endless procedurally generated problems across 32 topics (multiple choice and typed answers), practice mode or timed exam mode, per-topic accuracy |
| Exam prep | The 24 Exam 1 practice problems with worked solutions, plus a prep checklist for every exam |
| Grapher | Type any f(x); tangent line, secant line, f′ and f″; pan, zoom, click to move the point |
| Labs | Limit tables, difference-quotient tables, Riemann sums with a picture, derivative from data, average rate of change |
| Grade calculator | Syllabus weights, current letter grade, what you need on the final |
| Scratchpad | Handwriting canvas with colors, eraser, undo, grid and PNG export |
| Syllabus & policies | Deadlines, help resources, exam rules, rubric |

## Deploy (Hostinger or any static host)

Upload the contents of this folder so that `index.html` sits in `public_html` (or a subfolder):

```
public_html/
  index.html
  assets/
    styles.css
    data.js
    quiz.js
    app.js
    tools.js
  active_calculus.pdf   (optional: the hosted textbook PDF shown on the Textbook page)
```

It also runs straight from the file system: open `index.html` in a browser.

## Editing content

- `assets/data.js` holds the calendar, syllabus facts, section notes, formula sheet, flashcards, Exam 1 practice set and checklists.
- `assets/quiz.js` holds the question generators. Each function returns one question; add a function and list it in `GENERATORS`.
- `assets/app.js` is the app shell and reference views; `assets/tools.js` holds the interactive tools.
