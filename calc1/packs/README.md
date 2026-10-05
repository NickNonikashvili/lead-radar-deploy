# Class packs

A class pack is one JSON file that holds a whole class: syllabus facts, calendar, exams,
grading, topic notes, formulas, flashcards, practice problems and a question bank. An admin
uploads it in the admin panel and the class appears for everyone, with no new code and no
redeploy.

## The workflow

1. **Syllabus in.** Send the syllabus (PDF, Word or pasted text) to Claude. Students' syllabi
   from **Admin panel → Class requests** work too.
2. **Pack out.** Claude writes the class as `packs/src/<id>.js` and builds it:
   ```
   node scripts/make-pack.js packs/src/chmy121.js      →  packs/chmy121.mathub.json
   ```
   The builder runs every check the admin panel runs, then generates 400 questions from each
   question set. It writes nothing if anything fails.
3. **Ship or upload.** A pack in `packs/` installs itself with the next deploy (see *Bundled with
   the site* below). To add one without a deploy, open **Admin panel → Add a class** (`#/admin/packs`) and choose the
   `.mathub.json` file. The panel checks it again and shows the counts, any problems and three
   sample questions. Press **Add class**.
   - **Publish now** is ticked by default. Untick it to add the class hidden, so only admins
     see it while they look it over. Publish it later from the list.
   - If students asked for the class under that course code, **Tell the N students who asked**
     marks their requests as added. Each of them gets an inbox message and a phone
     notification with a link to the class.

Uploading a file with the same `id` updates the class. The previous version is kept, and
**Previous version** in the list switches back to it. Students get the new version the next
time they open the site.

**Hide** removes the class from the site for students and keeps it for admins. **Delete**
removes it for everyone. Either way, students' saved progress and the class's discussion
posts stay in the database, so uploading the class again brings them back.

## Bundled with the site

Every `packs/<id>.mathub.json` file ships in the deploy zip and installs itself: the first
request after a deploy that the server sees a new file, it checks the pack, installs it,
publishes it and posts "New class on Mathub" (`mh_packs_seed_bundled` in `api/lib.php`,
`mh_packs_apply_bundled` in `api/packs.php`). In **Admin panel → Classes** it shows as
uploaded by "bundled with the site". The rules, so the admin panel always wins:

- **Already uploaded** by an admin under that id: left as it is.
- **A newer bundled file** (the pack was rebuilt) updates the class only while it is still the
  bundled copy; the previous version is kept for rollback, as with an upload.
- **Deleted** by an admin: never re-added, even when the file is still in `packs/`.
- **Hidden** by an admin: stays hidden.

Students who requested the class are not messaged automatically; to tell them, hide the class
and publish it again with **Tell the N students who asked** ticked.

`packs/index.json` lists the bundled packs (the light part every page needs). It is written by
`node scripts/bundle-packs.js`, which `make-pack.js` runs after building into `packs/`. When
the account server cannot be reached (the static preview, or a first visit while the server is
down), the site lists the classes from that file and opens each one from its `.mathub.json`.
To ship a class only by upload, build it with `--out` somewhere other than `packs/`.

Bundled now: **PSCI 230D** (Introduction to International Relations), **EMEC 100**
(Introduction to Mechanical Engineering), **M 172** (Calculus II) and **JPNS 150D**
(Introduction to Japanese Culture and Civilization).

## Limits

- **Size:** a pack can be up to 3 MB. Real classes come to about 100–250 KB.
- **ID:** the `id` is letters followed by a course number, all lowercase, for example
  `chmy121`, `m273`, `stat216` or `biob170h`. It becomes the URL (`#/chmy121`). The built-in
  classes (`calc`, `physics`, `precalc`, `writ`, `csci`, `biob`, `kin`, `psyx`) cannot be
  replaced by a pack.
- **Views:** uploaded classes get the standard class views. These are the dashboard, calendar,
  topic notes, formulas, flashcards, textbook and links, quizzer, exam prep, study planner,
  grade calculator, scratchpad, discussions, syllabus and settings. They also get everything
  built on those views: the learning path, lessons, Blitz, mistakes, cheat sheet, daily
  challenge, mock exams, Today, the GPA calculator, leagues, the calendar feed and reminders.
- **Not available to packs:**
  - Custom tools, such as the graphers, solvers or Python playground. These need code, so the
    class would have to become a built-in.
  - Static `/learn/<id>/` SEO pages and share images. These are generated at build time for
    built-in classes only.

## Safety

A pack is data. Nothing in it ever runs as code.

**Text.** Every string is cleaned in the browser before it is shown.
- **Allowed tags:** `b strong i em u s sub sup br code kbd small span p ul ol li a div table
  thead tbody tr th td h3 h4 h5 blockquote hr mark abbr dl dt dd pre del ins q cite caption`.
- **Attributes:** `class` and `title`. Links keep `href` only for `http`, `https`, `mailto`
  or a path inside the site.
- **Removed with their contents:** `script`, `style`, `iframe`, `svg` and similar elements.
- **Unwrapped:** any other tag is dropped and its text kept.
- **Unclosed tags** are closed, so a pack cannot break the page around it.
- **Straight double quotes** become curly ones.

**Fields:**
- **URLs** in `url`, `link`, `u`, `href`, `site` and `canvas` must be `http`, `https`,
  `mailto` or a site path.
- **TeX** in `t` has `<` and `>` turned into `\lt` and `\gt`.

**Questions** are built from the declarative specs below. Calculated questions use a small
expression language with no access to anything outside the question. There is no `eval`.

## Format

The builder accepts a `.js` file that exports one object (`module.exports = { … }`), or a
`.json` file. Loops and helper functions in the `.js` source are handy for calendars, and they
disappear in the JSON. `tests/fixtures/zzp101.js` is a complete small example that uses every
feature.

### Top-level keys

| Key | Required | What it is |
| --- | --- | --- |
| `format`, `version` | yes | Always `"mathub-class-pack"` and `1`. |
| `id` | yes | The URL id, for example `chmy121`. |
| `code`, `name`, `term` | yes | `"CHMY 121"`, `"Introduction to General Chemistry"`, `"Fall 2026"`. |
| `short` | no | Sidebar label, up to about 12 characters. Defaults to `code`. |
| `tagline` | no | One line for the class card. |
| `kind` | no | `math`, `science`, `writing`, `code` and so on. Changes some wording. |
| `quizNote` | no | Shown above the quizzer. |
| `formulasNote`, `filterExample` | no | Shown on the formula sheet. |
| `formulasTitle` | no | Sidebar name for the formula sheet. Default: "Formulas & key terms". |
| `color` | yes | `{ light: "#0F766E", dark: "#5EEAD4" }`. The light shade needs 4.5:1 contrast with white text; the checker warns when it doesn't. Every other shade is derived from these two. |
| `archetype` | no | `{ name, icon, line }` for the character sheet, for example `{ name: "Alchemist", icon: "flask", line: "…" }`. |
| `resources` | no | `[{ t, u, d, k, tags, top }]`: title, link, one line, kind (`video practice tool reading reference msu community app wellbeing`), tags, and whether to pin it at the top. |
| `resourcesBlurb` | no | One sentence under the class name on the Resources page. |
| `guides` | no | Ids of study guides to recommend, for example `["math-exam"]`. |
| `canvasMatch` | no | Strings that identify the class in the Canvas calendar feed. Defaults to the code with and without its space. |
| `COURSE` | yes | Syllabus facts (below). |
| `GRADING` | yes | Grade categories, letter scale and optional weighting options. |
| `EXAMS`, `CALENDAR`, `RECURRING`, `SEMESTER`, `VARIANTS` | | Dates (below). |
| `UNITS`, `SECTIONS` | yes | Units and the topics in them, with the notes. |
| `FORMULAS`, `FLASHCARDS`, `PRACTICE`, `CHECKLISTS`, `INFO` | no | Study material. |
| `NAV` | no | The sidebar. Leave it out to get the standard one, built from what the pack has. |
| `QUIZ` | no | The question bank. Without it the class has no quizzer, challenge or mock exams. |

### Syllabus and grading

```js
COURSE: { code, name, term, school, credits, instructor, instructorEmail, instructorRoom, officeHours,
  lectures, classDays, weeklyHours, site, canvas,
  textbook: { title, url },
  links: [{ eyebrow, title, url, desc }],
  helpCenter: { name, where, hours },
  deadlines: [{ name, rule }] },
GRADING: { categories: [{ id, name, weight }], scale: [{ letter, min }], finalId, note,
  options: [{ label, weights: { categoryId: weight } }] }   // optional: the calculator uses whichever option is best
```

### Dates

```js
SEMESTER: { start: '2026-08-24', end: '2026-12-18' },
EXAMS: [{ id: 'exam1', n: 1, name: 'Exam 1', date: '2026-10-02', endDate?, dateLabel?, covers, sections: [ids],
  units: [n], weight, format?,
  dates?: { variantId: 'YYYY-MM-DD' }, dateLabels?: { variantId: '…' } }],
CALENDAR: [['2026-09-02', 'lecture', 'Atoms and moles', 'sectionId?', 'variantId?'], …],
  // type is one of: lecture, lab, exam, review, holiday, admin
RECURRING: [{ dows: [1, 3], time: '8:00 pm', title: 'Homework due', from: '2026-08-26', to?, skipHolidays: true, quiet? }],
VARIANTS: { label: 'Your section', default: '1', hint?, saved?, options: [{ id: '1', label: 'Section 001 · MWF 9:00' }] },
CALENDAR_NOTE: 'Shown above the calendar.'
```

A calendar row's fourth slot links a lecture to a topic, which drives "current topic". The
fifth slot tags the row for one section, so each student sees only their own section's rows.

### Notes and study material

```js
UNITS: [{ n: 1, title: 'Atoms and molecules', sections: ['atoms', 'moles'], exam: 'exam1' }],
SECTIONS: [{ id: 'atoms', label: '1.1', title: 'Atoms and isotopes', unit: 1, link?, linkLabel?,
  ideas: ['HTML string', …], formulas?: [{ n, t }], example?: { p, s }, pitfalls?: […], tip? }],
FORMULAS: [{ group: 'Stoichiometry', items: [{ n: 'Moles', t: 'n = \\frac{m}{M}' } | { n, d: 'definition' } | { n, c: 'code' }] }],
FLASHCARDS: [{ id: 'c-mole', unit: 1, sec: 'moles', f: 'front', b: 'back' }],
PRACTICE: { exam1: { title, subtitle, problems: [{ n: 1, sec, tags: [], q: 'question', s: 'solution' }] } },
CHECKLISTS: { exam1: ['I can …', …] },
INFO: [{ icon: 'info', title: 'Course facts', html: '<ul class="list-plain small"><li>…</li></ul>' }]
```

Use `$…$` or `\(…\)` for inline math in any text, and `t` for display formulas.

### Questions

```js
QUIZ: {
  hint: 'Default first hint.',
  topics: { atoms: { unit: 1, sec: 'atoms', label: 'Atoms & isotopes' }, … },
  ladders: { atoms: ['A way to think about it', 'The procedure', 'The nearly-there nudge'] },
  questions: [ …question sets… ]
}
```

Every question set has a `topic` and a `type`. `weight` (1–5) makes a set come up more often.
`hint` overrides the topic's first hint, and `options` (2–6) sets how many choices to show.

**`bank`: written multiple choice.** Each item is
`[prompt, correct, [wrong answers], explanation, hint?]`. A random four of the wrong answers
are shown.

```js
{ type: 'bank', topic: 'atoms', items: [
  ['Isotopes of an element differ in their number of', 'neutrons', ['protons', 'electrons', 'charges'], 'Same protons, different neutrons.']
] }
```

**`mc`: one fixed question.** It takes `prompt`, `answer`, `distractors` and `explain`.

**`table`: questions from a table.** Each ask fills a prompt from a random row and asks for
another column. Wrong answers come from the same column in other rows. Rows that give the
same values would also be right, so they are never used as wrong answers.

```js
{ type: 'table', topic: 'muscles', columns: ['Muscle', 'Action', 'Nerve'],
  rows: [['Biceps brachii', 'Elbow flexion', 'Musculocutaneous'], …],
  asks: [{ prompt: 'Which nerve supplies the {{Muscle}}?', answer: 'Nerve' },
         { prompt: 'Which muscle does {{Action}} and is supplied by the {{Nerve}} nerve?', answer: 'Muscle', explain: '…' }] }
```

**`calc`: a calculated question with a typed numeric answer.**

```js
{ type: 'calc', topic: 'moles',
  vars: { m: { min: 5, max: 50, step: 5 }, M: [18.02, 44.01, 58.44], cmp: [{ name: 'water', M: 18.02 }, …] },
  let: { n: 'm / M' },                         // computed in order; later ones can use earlier ones
  where: 'n > 0.1',                            // optional: redraw until true
  prompt: 'How many moles are in {{m}} g of a compound with molar mass {{M}} g/mol?',
  answer: 'n', round: 3,                       // round the answer to 3 decimals (optional)
  decimals: 3, unit: 'mol',                    // how the answer is shown (optional)
  tol: 0.01,                                   // relative tolerance (default 0.5%)
  explain: 'n = m / M = {{m}} / {{M}} = {{= n | 3}} mol.' }
```

`vars` take a list of values, a range `{ min, max, step }`, or a list of objects. With a list
of objects, one is picked and its fields become variables, which keeps values that belong
together paired.

**`calc-mc`: a calculated question with multiple choice.** It is like `calc`, plus
`distractors`, a list of expressions for the wrong answers, which are usually the classic
mistakes. `format` shows each value, for example `'{} N·m'`. Numbers and words both work.

### Expressions and templates

**Expressions:**
- **Values:** numbers, `"strings"` and variable names.
- **Operators:** `+ - * / % ^`, the comparisons `== != < <= > >=`, `&& || !` and `a ? b : c`.
  `+` joins strings.
- **Functions:** `abs sqrt cbrt exp ln log log2 logb sin cos tan asin acos atan atan2`, the
  degree versions `sind cosd tand asind acosd atand atan2d`, then `round(x, n) sig(x, n) floor
  ceil trunc sign min max pow hypot clamp fact comb perm gcd lcm sum mean sd str fixed`.
- **Constants:** `pi` and `e`.

**Templates** in prompts, explanations and table asks:
- `{{name}}` inserts a variable.
- `{{name | 2}}` rounds it to 2 decimals.
- `{{= expression}}` inserts a computed value, and `{{= expression | 3s}}` rounds it to 3
  significant figures.
- In a table question, `{{Column name}}` inserts a cell.
- Braces that are not a variable, such as TeX's `\frac{a}{b}`, are left alone.
