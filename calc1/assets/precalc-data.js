/* ============================================================
   Mathub — M151Q Precalculus course data
   Source: M151Q Fall 2026 syllabus (Jenna Stitt) and the Yoshiwara
   textbooks Modeling, Functions, and Graphs (MFG) and Trigonometry (TRIG).
   Week-by-week topics are estimated from the syllabus topic list and exam
   dates; Canvas is authoritative.
   ============================================================ */
(function (global) {
  'use strict';
  const R = String.raw;
  const MFG = 'https://yoshiwarabooks.org/mfg-no-webwork/frontmatter.html';
  const TRIG = 'https://yoshiwaramath.org/trig/frontmatter.html';

  const COURSE = {
    code: 'M151Q', name: 'Precalculus', term: 'Fall 2026', school: 'Montana State University', credits: 4,
    instructor: 'Jenna Stitt', instructorRoom: 'Wilson 1-136', instructorEmail: 'jennastitt@montana.edu',
    officeHours: 'Tue & Thu 10–11 am · Fri 1–2 pm',
    classDays: 'In-class sessions with quizzes and worksheets; exams on Thursdays',
    textbook: { title: 'Modeling, Functions, and Graphs + Trigonometry (Yoshiwara, free online)', url: MFG },
    webwork: 'https://webwork3.math.montana.edu/webwork2/F26M151',
    links: [
      { eyebrow: 'Textbook 1', title: 'Modeling, Functions, and Graphs (MFG)', url: MFG, desc: 'Katherine Yoshiwara. Chapters 1–7 of the course: functions, models, exponents, exponentials and logs, quadratics, polynomials, rational functions.' },
      { eyebrow: 'Textbook 2', title: 'Trigonometry (TRIG)', url: TRIG, desc: 'Katherine Yoshiwara. Triangles, trig ratios, laws of sines and cosines, circular functions, identities, inverse trig.' },
      { eyebrow: 'Homework', title: 'WebWork F26 M151', url: 'https://webwork3.math.montana.edu/webwork2/F26M151', desc: 'Due Monday and Thursday at 11:59 pm; 50% credit for 24 hours after.' },
      { eyebrow: 'Written work', title: 'Gradescope (via Canvas)', url: 'https://ecat.montana.edu/', desc: 'Worksheets and written homework are submitted here.' },
      { eyebrow: 'Help', title: 'Math & Stat Center · Romney 220', url: 'https://www.montana.edu/mathstatcenter/', desc: 'Drop-in help; bring your notebook and CatCard.' },
      { eyebrow: 'Tutoring', title: 'SmartyCats', url: 'https://www.montana.edu/aycss/success/smartycats/', desc: 'Longer tutoring sessions for this class.' }
    ],
    helpCenter: { name: 'Math & Stat Center', where: 'Romney 220', hours: 'bring your notebook and CatCard' },
    tutoring: 'SmartyCats',
    deadlines: [
      { name: 'WebWork', rule: 'Due Monday and Thursday at 11:59 pm. Submissions in the next 24 hours earn 50% credit. Treat it as pencil-and-paper work: keep an organized homework notebook.' },
      { name: 'Quizzes / worksheets', rule: 'In class, sometimes partly outside class, individual or group. No make-ups; your two lowest scores are dropped.' },
      { name: 'Exams', rule: 'Thursday Sep 24, Thursday Oct 22, Thursday Nov 19 in class; the final in finals week at your section’s assigned time. Dates are firm. No calculators or internet devices from start to hand-in.' }
    ]
  };

  const GRADING = {
    categories: [
      { id: 'hw', name: 'WebWork homework, quizzes and worksheets (two lowest quiz scores dropped)', weight: 20 },
      { id: 'exam1', name: 'Semester Exam 1 (Thu Sep 24)', weight: 20 },
      { id: 'exam2', name: 'Semester Exam 2 (Thu Oct 22)', weight: 20 },
      { id: 'exam3', name: 'Semester Exam 3 (Thu Nov 19)', weight: 20 },
      { id: 'final', name: 'Final Exam (finals week)', weight: 20 }
    ],
    finalId: 'final',
    note: 'You must take all four exams to earn a C- or better. One missed exam (for an approved reason) can be replaced by your final exam percent.',
    scale: [
      { letter: 'A', min: 93.75 }, { letter: 'A-', min: 91.25 }, { letter: 'B+', min: 88.75 }, { letter: 'B', min: 82.5 }, { letter: 'B-', min: 75 },
      { letter: 'C+', min: 72.5 }, { letter: 'C', min: 70 }, { letter: 'C-', min: 67.5 }, { letter: 'D', min: 62.5 }, { letter: 'F', min: 0 }
    ],
    rubric: [
      { score: 4, name: 'Complete', desc: 'Comprehensive, thoughtful understanding. Organized and complete. Ideas and math thinking fully explained with correct notation. May contain a trivial error.' },
      { score: 3, name: 'Substantial', desc: 'Some details show you understood the problem. Mostly organized. Ideas explained. May contain some errors.' },
      { score: 2, name: 'Developing', desc: 'Not enough detail to show understanding. Ideas not clearly explained. Significant gaps; unorganized or incomplete.' },
      { score: 1, name: 'Minimal', desc: 'No details, does not make sense, no explanation of ideas.' },
      { score: 0, name: 'No credit', desc: 'Not seriously attempted.' }
    ]
  };

  const EXAMS = [
    { id: 'exam1', n: 1, name: 'Exam 1', date: '2026-09-24', dateLabel: 'Thursday, September 24 (in class)', covers: 'functions and graphs, rate of change, linear functions, nonlinear models, transformations, absolute value, domain and range (MFG 1.2 – 2.6)', sections: ['fn', 'rate', 'models', 'transform', 'absdom'], units: [1], weight: 20 },
    { id: 'exam2', n: 2, name: 'Exam 2', date: '2026-10-22', dateLabel: 'Thursday, October 22 (in class)', covers: 'variation, exponents and radicals, exponential functions, logarithms, exponential models, inverse functions, logarithmic functions (MFG 3.1 – 5.3)', sections: ['variation', 'exponents', 'expgrowth', 'logs', 'expmodels', 'inverse', 'logfn'], units: [2], weight: 20 },
    { id: 'exam3', n: 3, name: 'Exam 3', date: '2026-11-19', dateLabel: 'Thursday, November 19 (in class)', covers: 'quadratic, polynomial and rational functions, complex numbers, triangles, right-triangle trigonometry (MFG 6.1 – 7.5, TRIG 1.1 – 2.3)', sections: ['quadratics', 'poly', 'complex', 'rational', 'triangles', 'righttri'], units: [3], weight: 20 },
    { id: 'final', n: 4, name: 'Final Exam', date: '2026-12-14', endDate: '2026-12-18', dateLabel: 'Finals week (Dec 14 – 18), at your section’s assigned time', covers: 'laws of sines and cosines, trigonometric and circular functions, identities, radians, sinusoids, inverse trig, quadratic-in-form equations (TRIG 3.1 – 8.3), plus earlier material', sections: ['laws', 'trigfn', 'identities', 'radians', 'sinusoid', 'invtrig', 'quadform'], units: [4], weight: 20, cumulative: true }
  ];

  const SEMESTER = { start: '2026-08-24', end: '2026-12-18' };

  const CALENDAR = [
    ['2026-08-24', 'lecture', 'Week 1 · MFG 1.2–1.3 Functions and their graphs', 'fn'],
    ['2026-08-31', 'lecture', 'Week 2 · MFG 1.4–1.5 Slope, rate of change, linear functions', 'rate'],
    ['2026-09-07', 'holiday', 'Labor Day · no class'],
    ['2026-09-08', 'lecture', 'Week 3 · MFG 2.1–2.3 Nonlinear models, basic functions, transformations', 'transform'],
    ['2026-09-14', 'lecture', 'Week 4 · MFG 2.5–2.6 Absolute value, domain and range', 'absdom'],
    ['2026-09-16', 'admin', 'Last day to drop without a W'],
    ['2026-09-21', 'lecture', 'Week 5 · Review; MFG 3.1 Variation', 'variation'],
    ['2026-09-24', 'exam', 'Exam 1 · MFG 1.2 – 2.6 (in class)'],
    ['2026-09-28', 'lecture', 'Week 6 · MFG 3.2–3.4 Integer exponents, radicals, rational exponents', 'exponents'],
    ['2026-10-05', 'lecture', 'Week 7 · MFG 4.1–4.3 Exponential growth and decay, exponential functions, logarithms', 'logs'],
    ['2026-10-12', 'lecture', 'Week 8 · MFG 4.4–4.5 Properties of logarithms, exponential models', 'expmodels'],
    ['2026-10-19', 'lecture', 'Week 9 · MFG 5.1–5.3 Inverse functions, logarithmic functions, the natural base', 'logfn'],
    ['2026-10-22', 'exam', 'Exam 2 · MFG 3.1 – 5.3 (in class)'],
    ['2026-10-26', 'lecture', 'Week 10 · MFG 6.1–6.3 Factors, solving quadratics, graphing parabolas', 'quadratics'],
    ['2026-11-02', 'lecture', 'Week 11 · MFG 7.1–7.3 Polynomial functions, complex numbers', 'poly'],
    ['2026-11-09', 'lecture', 'Week 12 · MFG 7.4–7.5 Rational functions and equations', 'rational'],
    ['2026-11-11', 'holiday', 'Veterans Day · no class'],
    ['2026-11-16', 'lecture', 'Week 13 · TRIG 1–2 Triangles, circles, trig ratios, solving right triangles', 'righttri'],
    ['2026-11-18', 'admin', 'Last day to drop with a W'],
    ['2026-11-19', 'exam', 'Exam 3 · MFG 6.1 – 7.5, TRIG 1.1 – 2.3 (in class)'],
    ['2026-11-23', 'holiday', 'Fall recess · no class'],
    ['2026-11-24', 'holiday', 'Fall recess · no class'],
    ['2026-11-25', 'holiday', 'Fall recess · no class'],
    ['2026-11-26', 'holiday', 'Fall recess · no class'],
    ['2026-11-27', 'holiday', 'Fall recess · no class'],
    ['2026-11-30', 'lecture', 'Week 15 · TRIG 3–4 Laws of Sines and Cosines, trig functions and graphs', 'laws'],
    ['2026-12-07', 'lecture', 'Week 16 · TRIG 5–8 Identities, radians, sinusoids, inverse trig; quadratic-in-form', 'sinusoid'],
    ['2026-12-11', 'review', 'Review'],
    ['2026-12-14', 'exam', 'Finals week · Final Exam at your section’s assigned time'],
    ['2026-12-15', 'exam', 'Finals week'],
    ['2026-12-16', 'exam', 'Finals week'],
    ['2026-12-17', 'exam', 'Finals week'],
    ['2026-12-18', 'exam', 'Finals week']
  ];
  const CALENDAR_NOTE = 'Weekly topics are estimated from the syllabus topic list and the firm exam dates. Canvas announcements are authoritative; check them daily.';

  const RECURRING = [
    { dows: [1, 4], time: '11:59 pm', title: 'WebWork due', from: '2026-08-27', skipHolidays: true }
  ];

  const UNITS = [
    { n: 1, title: 'Functions, graphs, models', sections: ['fn', 'rate', 'models', 'transform', 'absdom'], exam: 'exam1' },
    { n: 2, title: 'Powers, exponentials, logarithms', sections: ['variation', 'exponents', 'expgrowth', 'logs', 'expmodels', 'inverse', 'logfn'], exam: 'exam2' },
    { n: 3, title: 'Quadratics, polynomials, triangles', sections: ['quadratics', 'poly', 'complex', 'rational', 'triangles', 'righttri'], exam: 'exam3' },
    { n: 4, title: 'Trigonometric functions', sections: ['laws', 'trigfn', 'identities', 'radians', 'sinusoid', 'invtrig', 'quadform'], exam: 'final' }
  ];

  /* ---------- Topic notes ---------- */
  const SECTIONS = [
    {
      id: 'fn', label: 'MFG 1.2–1.3', title: 'Functions and their graphs', unit: 1, link: MFG,
      ideas: [
        R`A <b>function</b> assigns exactly one output to each input. Inputs form the <b>domain</b>, outputs the <b>range</b>. Notation $y = f(x)$: $f$ is the rule, $x$ the input, $f(x)$ the output. $f(3)$ is a number, not a product.`,
        R`Functions come four ways: a table, a graph, a formula, a description in words. Move between them fluently; exams ask you to read one and produce another.`,
        R`<b>Vertical line test:</b> a graph is a function if no vertical line meets it twice. A table is a function if no input repeats with different outputs.`,
        R`Reading graphs: $f(a)$ is the height at $x = a$. Solving $f(x) = c$ means finding the $x$-values where the height is $c$ (possibly several). Intercepts: $y$-intercept is $f(0)$; $x$-intercepts solve $f(x) = 0$.`,
        R`Increasing/decreasing, maximum/minimum values, and where $f(x) > 0$ are all read off the graph as intervals of $x$.`,
        R`Evaluate expressions like $f(a+h)$ by substituting the entire input for every $x$ and simplifying; keep parentheses.`
      ],
      formulas: [
        { n: 'Function notation', t: R`y = f(x):\quad \text{input } x \ \longrightarrow\ \text{output } f(x)` },
        { n: 'Intercepts', t: R`y\text{-intercept: } (0, f(0)),\qquad x\text{-intercepts: solve } f(x) = 0` },
        { n: 'Evaluating', t: R`f(x) = x^2 - 3x + 1 \Rightarrow f(a+1) = (a+1)^2 - 3(a+1) + 1 = a^2 - a - 1` }
      ],
      example: { p: R`For $f(x) = x^2 - 3x + 1$, find $f(-2)$, $f(a+1)$, and all $x$ with $f(x) = 1$.`, s: R`$f(-2) = 4 + 6 + 1 = 11$. $f(a+1) = (a+1)^2 - 3(a+1) + 1 = a^2 - a - 1$. $f(x) = 1 \Rightarrow x^2 - 3x = 0 \Rightarrow x(x-3) = 0$, so $x = 0$ or $x = 3$.` },
      pitfalls: [R`Writing $f(a+1) = f(a) + 1$ or $f(a) + f(1)$. Substitute the whole expression.`, R`Confusing "find $f(2)$" (plug in) with "solve $f(x) = 2$" (find inputs).`, 'Answering an "on what interval is f increasing" question with y-values instead of x-values.'],
      tip: 'Every answer about a graph should say whether it is an x-value, a y-value, a point, or an interval. Graders look for that precision.'
    },
    {
      id: 'rate', label: 'MFG 1.4–1.5', title: 'Slope, rate of change, and linear functions', unit: 1, link: MFG,
      ideas: [
        R`<b>Average rate of change</b> of $f$ on $[a,b]$ is $\dfrac{f(b)-f(a)}{b-a} = \dfrac{\Delta y}{\Delta x}$: the slope of the line through the two points. Units are output units per input unit.`,
        R`A <b>linear function</b> has a constant rate of change: $f(x) = b + mx$ (Yoshiwara's order) or $y = mx + b$. $m$ is the slope, $b$ the starting value ($y$-intercept).`,
        R`Find a line from two points: slope first, then point–slope $y - y_1 = m(x - x_1)$. From a table: check that equal steps in $x$ give equal steps in $y$; if so it is linear.`,
        R`Intercepts of a line: $y$-intercept $(0,b)$, $x$-intercept $(-b/m, 0)$. Parallel lines share slope; perpendicular slopes multiply to $-1$.`,
        R`In context: slope tells "how much $y$ changes per one unit of $x$"; the intercept is the value when $x = 0$. Always write the sentence with units.`
      ],
      formulas: [
        { n: 'Average rate of change', t: R`\frac{\Delta y}{\Delta x} = \frac{f(b)-f(a)}{b-a}` },
        { n: 'Linear function', t: R`f(x) = b + mx,\qquad m = \frac{y_2-y_1}{x_2-x_1},\qquad y - y_1 = m(x - x_1)` },
        { n: 'Intercepts', t: R`(0,\,b)\quad\text{and}\quad\left(-\tfrac{b}{m},\,0\right)` }
      ],
      example: { p: R`A taxi charges \$3.50 plus \$2.25 per mile. Write $C(m)$, find the cost of 8 miles, and how far \$30 takes you.`, s: R`$C(m) = 3.50 + 2.25m$. $C(8) = 3.5 + 18 = \$21.50$. $30 = 3.5 + 2.25m \Rightarrow m = 26.5/2.25 \approx 11.8$ miles. The slope 2.25 means each extra mile costs \$2.25.` },
      pitfalls: ['Swapping Δx and Δy in the slope.', 'Reporting a rate without units.', 'Using y = mx + b with the intercept and slope reversed when the table starts at x ≠ 0.'],
      tip: 'Before computing a slope from a table, look at the x-spacing. If the steps are unequal, compute Δy/Δx for each pair; a constant ratio is the test for linearity.'
    },
    {
      id: 'models', label: 'MFG 2.1–2.2', title: 'Nonlinear models and the basic functions', unit: 1, link: MFG,
      ideas: [
        R`Many quantities are not linear. Build a model from a geometric or verbal relationship, then use the graph or algebra: area of a square from its perimeter $A = (P/4)^2$, volume of a box from its side, revenue from price.`,
        R`Solve nonlinear equations by extraction of roots ($x^2 = 20 \Rightarrow x = \pm\sqrt{20}$), by factoring, or graphically (intersection of $y = f(x)$ with $y = c$). Keep both roots unless the context excludes one.`,
        R`<b>Library of basic functions</b> you must know by shape, domain and range: $y = x^2$, $x^3$, $\sqrt{x}$, $\sqrt[3]{x}$, $1/x$, $1/x^2$, $|x|$. Know which are even/odd, increasing/decreasing, and their asymptotes.`,
        R`Piecewise functions use different formulas on different intervals; evaluate with the piece whose condition holds. A jump where the pieces do not meet means the graph is discontinuous there.`
      ],
      formulas: [
        { n: 'Basic functions', t: R`x^2\ [0,\infty);\quad x^3\ \mathbb R;\quad \sqrt x\ [0,\infty)\to[0,\infty);\quad \sqrt[3]{x}\ \mathbb R;\quad \tfrac1x\ x\ne0;\quad \tfrac1{x^2}\ y>0;\quad |x|\ y\ge0` },
        { n: 'Extraction of roots', t: R`x^2 = k\ (k>0) \Rightarrow x = \pm\sqrt k` }
      ],
      example: { p: R`Let $f(x) = \begin{cases} x + 2 & x < 1 \\ 4 - x & x \ge 1\end{cases}$. Find $f(0)$, $f(1)$, $f(3)$ and decide whether the graph has a break at $x = 1$.`, s: R`$f(0) = 2$ (first piece), $f(1) = 3$ (second piece, since $1 \ge 1$), $f(3) = 1$. Near $x=1$ the first piece approaches $3$ and the second equals $3$: the pieces meet, no break.` },
      pitfalls: ['Dropping the negative root when solving x² = k with no context.', 'Using the wrong piece at the boundary of a piecewise function (check ≤ vs <).', 'Confusing 1/x (odd, two branches) with 1/x² (even, both branches above the axis).'],
      tip: 'Sketch the seven basic functions from memory once a week until it is automatic. Every transformation question starts from one of them.'
    },
    {
      id: 'transform', label: 'MFG 2.3', title: 'Transformations of graphs', unit: 1, link: MFG,
      ideas: [
        R`Starting from a basic graph $y = f(x)$: $f(x) + k$ shifts <b>up</b> $k$; $f(x - h)$ shifts <b>right</b> $h$ (note the sign); $af(x)$ stretches vertically by $a$ (compresses if $0<a<1$); $-f(x)$ reflects across the $x$-axis; $f(-x)$ reflects across the $y$-axis.`,
        R`Order matters: apply stretches and reflections before shifts. $g(x) = -2(x+3)^2 + 4$: shift left 3, stretch by 2, reflect over the $x$-axis, shift up 4. Vertex $(-3, 4)$.`,
        R`Read the transformation from a graph by locating where the "anchor" point of the parent (vertex, corner, origin) landed and how the heights scaled.`,
        R`Transformations move the domain and range along: $\sqrt{x-2} - 5$ has domain $[2,\infty)$ and range $[-5,\infty)$.`
      ],
      formulas: [
        { n: 'Vertical', t: R`y = f(x) + k\ (\text{up } k),\qquad y = a f(x)\ (\text{stretch by } a),\qquad y = -f(x)\ (\text{flip over } x\text{-axis})` },
        { n: 'Horizontal', t: R`y = f(x - h)\ (\text{right } h),\qquad y = f(-x)\ (\text{flip over } y\text{-axis})` },
        { n: 'General form', t: R`y = a\,f(x - h) + k` }
      ],
      example: { p: R`Write the formula for the graph of $y = \sqrt x$ shifted right 2 and down 5, reflected across the $x$-axis. State its domain and range.`, s: R`$y = -\sqrt{x - 2} - 5$. Domain $[2,\infty)$ (inside the root must be $\ge 0$). The root part is $\le 0$ after the reflection, so the range is $(-\infty, -5]$.` },
      pitfalls: [R`Reading $f(x - 2)$ as a shift left. Inside the parentheses, the sign is reversed.`, 'Shifting before stretching when the formula stretches first (a·f(x) + k).', 'Forgetting that a reflection flips the range.'],
      tip: 'Name each transformation in the order the formula applies it, then move one anchor point step by step. Write the final anchor point on your graph.'
    },
    {
      id: 'absdom', label: 'MFG 2.5–2.6', title: 'Absolute value, domain, and range', unit: 1, link: MFG,
      ideas: [
        R`$|x|$ is the distance from $x$ to 0, so $|x - c|$ is the distance from $x$ to $c$. Graph: a V with corner at $c$. Equations: $|u| = k$ (with $k>0$) means $u = k$ or $u = -k$. Inequalities: $|u| < k \iff -k < u < k$; $|u| > k \iff u < -k \text{ or } u > k$.`,
        R`<b>Domain</b> from a formula: exclude values that make a denominator zero or an even root negative; everything else is allowed. Write the answer in interval notation.`,
        R`<b>Range</b> is easiest from the graph: the set of heights reached. Use transformations of the basic functions, or the vertex of a parabola.`,
        R`In applications the domain is also limited by sense: lengths are positive, people are whole numbers, time starts at 0.`
      ],
      formulas: [
        { n: 'Absolute value', t: R`|u| = k \Rightarrow u = \pm k;\qquad |u| < k \iff -k < u < k;\qquad |u| > k \iff u < -k\ \text{or}\ u > k` },
        { n: 'Domain rules', t: R`\text{denominator} \ne 0,\qquad \text{even radicand} \ge 0` }
      ],
      example: { p: R`Find the domain of $h(x) = \dfrac{\sqrt{6 - 2x}}{x + 1}$ and solve $|2x - 5| = 7$ and $|x + 3| < 4$.`, s: R`Domain: $6 - 2x \ge 0 \Rightarrow x \le 3$ and $x \ne -1$: $(-\infty,-1)\cup(-1,3]$. $|2x-5| = 7 \Rightarrow 2x - 5 = \pm7 \Rightarrow x = 6$ or $x = -1$. $|x+3| < 4 \Rightarrow -4 < x+3 < 4 \Rightarrow -7 < x < 1$.` },
      pitfalls: ['Forgetting the second case of an absolute value equation.', 'Flipping the inequality for |u| > k incorrectly (it is an "or", two rays).', 'Including an endpoint in the domain where the denominator is zero.'],
      tip: 'Say "distance" out loud: |x − 3| < 2 means "x is within 2 of 3", so the answer is (1, 5) with no algebra.'
    },
    {
      id: 'variation', label: 'MFG 3.1', title: 'Variation', unit: 2, link: MFG,
      ideas: [
        R`<b>Direct variation:</b> $y = kx^n$: $y$ scales with a power of $x$; the graph passes through the origin. Doubling $x$ multiplies $y$ by $2^n$.`,
        R`<b>Inverse variation:</b> $y = k/x^n$: as $x$ grows, $y$ shrinks; the graph never touches the axes.`,
        R`Find $k$ from one data point, then use the formula. Check a table for variation by testing whether $y/x^n$ (direct) or $yx^n$ (inverse) is constant.`,
        R`Scaling arguments: if $y \propto x^2$ and $x$ triples, $y$ becomes $9$ times as large; if $y \propto 1/x^2$, it becomes $1/9$.`
      ],
      formulas: [
        { n: 'Direct / inverse', t: R`y = kx^n\qquad y = \frac{k}{x^n}` },
        { n: 'Scaling', t: R`x \to cx \ \Rightarrow\ y \to c^n y\ (\text{direct}),\quad y \to c^{-n}y\ (\text{inverse})` }
      ],
      example: { p: R`The weight a beam can support varies inversely with its length. A 4 m beam supports 600 kg. What can a 10 m beam support?`, s: R`$W = k/L$, $600 = k/4 \Rightarrow k = 2400$. $W(10) = 240$ kg.` },
      pitfalls: ['Treating "varies with" as linear when a power is stated.', 'Forgetting that direct variation has no constant term (y = kx, not y = kx + b).'],
      tip: 'Write the variation equation with k before touching the numbers; then one data point gives k.'
    },
    {
      id: 'exponents', label: 'MFG 3.2–3.4', title: 'Exponents, roots, radicals, and rational exponents', unit: 2, link: MFG,
      ideas: [
        R`Laws: $a^ma^n = a^{m+n}$, $a^m/a^n = a^{m-n}$, $(a^m)^n = a^{mn}$, $(ab)^n = a^nb^n$, $a^0 = 1$, $a^{-n} = 1/a^n$. Negative exponents mean reciprocals, not negative numbers.`,
        R`Radicals are exponents: $\sqrt[n]{a} = a^{1/n}$ and $a^{m/n} = \sqrt[n]{a^m} = (\sqrt[n]{a})^m$. Evaluate $8^{2/3}$ as $(\sqrt[3]{8})^2 = 4$.`,
        R`Even roots of negatives are not real; odd roots are fine. $\sqrt{x^2} = |x|$.`,
        R`Solve power equations by isolating the power and applying the reciprocal exponent: $x^{3/2} = 27 \Rightarrow x = 27^{2/3} = 9$. Check for extraneous solutions with even powers.`,
        R`Simplify radicals by pulling out perfect powers; rationalize denominators when asked.`
      ],
      formulas: [
        { n: 'Laws of exponents', t: R`a^ma^n = a^{m+n},\quad \frac{a^m}{a^n} = a^{m-n},\quad (a^m)^n = a^{mn},\quad a^{-n} = \frac1{a^n},\quad a^0 = 1` },
        { n: 'Rational exponents', t: R`a^{1/n} = \sqrt[n]{a},\qquad a^{m/n} = \left(\sqrt[n]{a}\right)^m` },
        { n: 'Power equations', t: R`x^{p} = k \Rightarrow x = k^{1/p}\ (\text{with } \pm \text{ if } p \text{ has even numerator})` }
      ],
      example: { p: R`Simplify $\dfrac{(2x^3)^2\,x^{-4}}{4x}$ and evaluate $16^{-3/4}$.`, s: R`$\dfrac{4x^6x^{-4}}{4x} = \dfrac{4x^2}{4x} = x$. $16^{-3/4} = \dfrac{1}{(\sqrt[4]{16})^3} = \dfrac{1}{2^3} = \dfrac18$.` },
      pitfalls: [R`$a^{-2} = -a^2$ (wrong). It is $1/a^2$.`, R`$(a+b)^2 = a^2 + b^2$ (wrong).`, R`Taking $\sqrt{x^2 + 9}$ as $x + 3$.`],
      tip: 'Rewrite every radical as a rational exponent before simplifying; the exponent laws then do all the work.'
    },
    {
      id: 'expgrowth', label: 'MFG 4.1–4.2', title: 'Exponential growth, decay, and exponential functions', unit: 2, link: MFG,
      ideas: [
        R`Exponential change multiplies by the same factor each period: $A(t) = A_0 b^t$ with growth factor $b = 1 + r$ (growth) or $b = 1 - r$ (decay). Percent change per period, not a fixed amount.`,
        R`Linear vs exponential from a table: constant <em>differences</em> mean linear; constant <em>ratios</em> mean exponential.`,
        R`$f(x) = ab^x$ with $b>0$, $b\ne1$: domain all reals, range $(0,\infty)$, horizontal asymptote $y = 0$, $y$-intercept $a$. $b>1$ increases; $0<b<1$ decreases. Larger $b$ is steeper.`,
        R`Find $a$ and $b$ from two points: divide the equations to eliminate $a$, solve for $b$, then back-substitute.`,
        R`Solve $b^x = b^y$ by matching bases: $8^x = 32 \Rightarrow 2^{3x} = 2^5 \Rightarrow x = 5/3$.`
      ],
      formulas: [
        { n: 'Exponential model', t: R`A(t) = A_0 b^t,\qquad b = 1 + r\ \text{(growth)},\quad b = 1 - r\ \text{(decay)}` },
        { n: 'Two points', t: R`\frac{ab^{x_2}}{ab^{x_1}} = \frac{y_2}{y_1} \Rightarrow b = \left(\frac{y_2}{y_1}\right)^{1/(x_2-x_1)}` }
      ],
      example: { p: R`A population is 5000 and grows 6% per year. Write $P(t)$, find $P(10)$, and the growth factor over a decade.`, s: R`$P(t) = 5000(1.06)^t$. $P(10) = 5000(1.06)^{10} \approx 8954$. Decade factor $1.06^{10} \approx 1.79$: about 79% growth per decade, not 60%.` },
      pitfalls: ['Adding 6% ten times instead of multiplying by 1.06 ten times.', 'Using b = 0.06 for "6% growth" (it is 1.06).', 'Assuming exponential graphs reach zero: they approach the asymptote but never touch it.'],
      tip: 'Growth factor = 1 + rate. Decay of 15% is a factor of 0.85. Say the factor before writing the formula.'
    },
    {
      id: 'logs', label: 'MFG 4.3–4.4', title: 'Logarithms and their properties', unit: 2, link: MFG,
      ideas: [
        R`A logarithm is an exponent: $\log_b x = y \iff b^y = x$. $\log_2 8 = 3$ because $2^3 = 8$. $\log x$ means base 10; $\ln x$ means base $e$.`,
        R`Use logs to solve for an exponent: $3^x = 20 \Rightarrow x = \log_3 20 = \dfrac{\log 20}{\log 3} \approx 2.727$ (change of base).`,
        R`<b>Properties</b> (products become sums, quotients differences, powers multipliers): $\log_b(MN) = \log_bM + \log_bN$; $\log_b(M/N) = \log_bM - \log_bN$; $\log_b M^p = p\log_bM$. Also $\log_b b = 1$, $\log_b 1 = 0$, $b^{\log_b x} = x$.`,
        R`There is <em>no</em> rule for $\log(M + N)$. $\log(x+2) \ne \log x + \log 2$.`,
        R`Logs of numbers $\le 0$ are undefined; the argument must be positive.`
      ],
      formulas: [
        { n: 'Definition', t: R`\log_b x = y \iff b^y = x` },
        { n: 'Properties', t: R`\log_b(MN) = \log_bM + \log_bN,\quad \log_b\frac MN = \log_bM - \log_bN,\quad \log_bM^p = p\log_bM` },
        { n: 'Change of base', t: R`\log_b x = \frac{\log x}{\log b} = \frac{\ln x}{\ln b}` }
      ],
      example: { p: R`Solve $5\cdot 2^{x} = 80$ and write $\log\dfrac{x^3\sqrt y}{10}$ in terms of $\log x$ and $\log y$.`, s: R`$2^x = 16 \Rightarrow x = 4$ (or $x = \log 16/\log 2 = 4$). $\log\dfrac{x^3\sqrt y}{10} = 3\log x + \tfrac12\log y - 1$.` },
      pitfalls: [R`$\log(a+b) = \log a + \log b$ (wrong).`, R`$\dfrac{\log a}{\log b} = \log a - \log b$ (wrong; it is $\log_b a$).`, 'Taking the log of both sides before isolating the exponential term.'],
      tip: 'Translate every log statement into the exponential statement it means. Most "hard" log problems are one translation away from easy.'
    },
    {
      id: 'expmodels', label: 'MFG 4.5', title: 'Exponential models', unit: 2, link: MFG,
      ideas: [
        R`<b>Doubling time</b> and <b>half-life</b> characterize exponential growth and decay: $A(t) = A_0\,2^{t/D}$ or $A(t) = A_0\left(\tfrac12\right)^{t/H}$.`,
        R`Convert between forms: $2^{t/D} = b^t$ with $b = 2^{1/D}$; conversely $D = \dfrac{\log 2}{\log b}$.`,
        R`Fit an exponential to two data points (divide to find $b$), then answer questions with logs: "when does it reach 10,000?" means solve $A_0b^t = 10000$.`,
        R`Compound interest: $A = P(1 + r/n)^{nt}$; continuous compounding $A = Pe^{rt}$ (§5.3).`
      ],
      formulas: [
        { n: 'Doubling / half-life', t: R`A = A_0\,2^{t/D},\qquad A = A_0\left(\tfrac12\right)^{t/H},\qquad D = \frac{\log 2}{\log b},\quad H = \frac{\log 2}{\log(1/b)}` },
        { n: 'Solving for time', t: R`A_0b^t = A \Rightarrow t = \frac{\log(A/A_0)}{\log b}` }
      ],
      example: { p: R`A drug's half-life is 6 hours. Starting at 200 mg, when is 25 mg left? What is the hourly decay factor?`, s: R`$200(\tfrac12)^{t/6} = 25 \Rightarrow (\tfrac12)^{t/6} = \tfrac18 \Rightarrow t/6 = 3 \Rightarrow t = 18$ h. Hourly factor $b = (1/2)^{1/6} \approx 0.891$ (about 10.9% lost per hour).` },
      pitfalls: ['Dividing the half-life by 2 to get a "quarter-life" (it takes two half-lives).', 'Forgetting to isolate the exponential before taking a log.'],
      tip: 'Half-life questions often need no calculator: count the halvings. 200 → 100 → 50 → 25 is three half-lives.'
    },
    {
      id: 'inverse', label: 'MFG 5.1', title: 'Inverse functions', unit: 2, link: MFG,
      ideas: [
        R`The inverse $f^{-1}$ undoes $f$: if $f(a) = b$ then $f^{-1}(b) = a$. Inputs and outputs swap, so the domain of $f^{-1}$ is the range of $f$. The graph of $f^{-1}$ is the reflection of $f$ across $y = x$.`,
        R`Find a formula: write $y = f(x)$, swap $x$ and $y$, solve for $y$. Check with $f(f^{-1}(x)) = x$.`,
        R`Only <b>one-to-one</b> functions (horizontal line test) have inverses. $x^2$ fails; restrict to $x \ge 0$ and the inverse is $\sqrt x$.`,
        R`$f^{-1}(x)$ is <em>not</em> $1/f(x)$.`
      ],
      formulas: [
        { n: 'Inverse relationship', t: R`f(a) = b \iff f^{-1}(b) = a,\qquad f(f^{-1}(x)) = x,\quad f^{-1}(f(x)) = x` },
        { n: 'Finding the formula', t: R`y = f(x)\ \xrightarrow{\ \text{swap}\ }\ x = f(y)\ \xrightarrow{\ \text{solve}\ }\ y = f^{-1}(x)` }
      ],
      example: { p: R`Find $f^{-1}(x)$ for $f(x) = \dfrac{2x - 1}{3}$ and state the value of $f^{-1}(5)$.`, s: R`$x = \dfrac{2y-1}{3} \Rightarrow 3x = 2y - 1 \Rightarrow y = \dfrac{3x+1}{2}$. $f^{-1}(5) = 8$; check $f(8) = 15/3 = 5$.` },
      pitfalls: ['Writing 1/f(x) for the inverse.', 'Forgetting to swap x and y before solving.', 'Claiming every function has an inverse.'],
      tip: 'To read f⁻¹(b) from a table or graph of f, find where the output is b and report the input.'
    },
    {
      id: 'logfn', label: 'MFG 5.2–5.3', title: 'Logarithmic functions and the natural base', unit: 2, link: MFG,
      ideas: [
        R`$y = \log_b x$ is the inverse of $y = b^x$: domain $(0,\infty)$, range all reals, vertical asymptote $x = 0$, passes through $(1,0)$ and $(b,1)$. Increasing for $b>1$, slowly.`,
        R`$e \approx 2.718$ is the natural base; $\ln x = \log_e x$. $e^x$ and $\ln x$ are inverses: $e^{\ln x} = x$, $\ln e^x = x$.`,
        R`Continuous growth $A = A_0e^{kt}$ with continuous rate $k$; the ordinary growth factor is $b = e^k$, so $k = \ln b$. Doubling time $= \ln 2/k$.`,
        R`Solve exponential equations with $\ln$: $e^{0.3t} = 5 \Rightarrow t = \ln 5/0.3$. Solve log equations by rewriting in exponential form; reject solutions that make any log argument $\le 0$.`
      ],
      formulas: [
        { n: 'Natural exponential and log', t: R`y = e^x \iff x = \ln y,\qquad \ln e = 1,\quad \ln 1 = 0` },
        { n: 'Continuous growth', t: R`A = A_0e^{kt},\qquad b = e^k,\qquad t_{\text{double}} = \frac{\ln 2}{k}` },
        { n: 'Log equations', t: R`\log_b(\text{expr}) = c \Rightarrow \text{expr} = b^c` }
      ],
      example: { p: R`Solve $\ln(2x - 3) = 2$ and find the doubling time for $A = 300e^{0.045t}$.`, s: R`$2x - 3 = e^2 \Rightarrow x = \dfrac{e^2 + 3}{2} \approx 5.19$ (argument $2x-3 = e^2 > 0$ ✓). Doubling time $= \ln 2/0.045 \approx 15.4$ years.` },
      pitfalls: ['Keeping a solution that makes a log argument negative or zero.', 'Mixing up ln (base e) and log (base 10) on a calculator.'],
      tip: 'When a problem says "continuous", the model is e^{kt}. When it says "per year", the model is b^t. Convert with k = ln b.'
    },
    {
      id: 'quadratics', label: 'MFG 6.1–6.3', title: 'Quadratic functions: factors, roots, and parabolas', unit: 3, link: MFG,
      ideas: [
        R`$x$-intercepts of $y = ax^2 + bx + c$ are the solutions of $ax^2 + bx + c = 0$. Factor when possible ($x^2 - 5x + 6 = (x-2)(x-3)$); otherwise complete the square or use the quadratic formula. The discriminant $b^2 - 4ac$ tells how many real roots: positive two, zero one, negative none.`,
        R`<b>Vertex</b> at $x = -\dfrac{b}{2a}$ (midway between the roots); the vertex is the maximum if $a<0$, minimum if $a>0$. Vertex form $y = a(x-h)^2 + k$ shows the vertex $(h,k)$ directly.`,
        R`Graph a parabola from its intercepts, vertex, and axis of symmetry $x = h$. Range: $[k,\infty)$ or $(-\infty,k]$.`,
        R`Factored form $y = a(x - r_1)(x - r_2)$ is fastest when the roots are known. Applications: maximum revenue or area, projectile height.`
      ],
      formulas: [
        { n: 'Quadratic formula', t: R`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}` },
        { n: 'Vertex', t: R`x_v = -\frac{b}{2a},\qquad y = a(x-h)^2 + k` },
        { n: 'Completing the square', t: R`x^2 + bx = \left(x + \tfrac b2\right)^2 - \tfrac{b^2}{4}` }
      ],
      example: { p: R`For $y = -2x^2 + 8x + 10$, find the intercepts, vertex, and range.`, s: R`$-2(x^2 - 4x - 5) = -2(x-5)(x+1)$: $x$-intercepts $5$ and $-1$, $y$-intercept $10$. Vertex at $x = 2$: $y = -8 + 16 + 10 = 18$, so $(2, 18)$, a maximum. Range $(-\infty, 18]$.` },
      pitfalls: ['Sign errors in the quadratic formula (−b, and the whole numerator over 2a).', 'Reporting the vertex x-value as the maximum value.', 'Factoring out a leading coefficient and then forgetting it.'],
      tip: 'The vertex is halfway between the x-intercepts. If you have the roots, you have the axis of symmetry for free.'
    },
    {
      id: 'poly', label: 'MFG 7.1–7.2', title: 'Polynomial functions and their graphs', unit: 3, link: MFG,
      ideas: [
        R`A polynomial $a_nx^n + \dots + a_0$ has degree $n$ and leading coefficient $a_n$. <b>End behavior</b> depends only on the leading term: even degree, both ends go the same way (up if $a_n>0$); odd degree, opposite ways (like $x^3$ if $a_n>0$).`,
        R`Zeros come from factors: $(x - r)^k$ gives a zero at $r$ of multiplicity $k$. Odd multiplicity crosses the axis; even multiplicity touches and turns. A degree-$n$ polynomial has at most $n$ real zeros and at most $n-1$ turning points.`,
        R`To sketch: find zeros and multiplicities, the $y$-intercept, end behavior; then connect smoothly. To write a formula from a graph: use the zeros for factors and one extra point to find the constant $a$.`,
        R`Products and powers of binomials: expand carefully; $(x-2)^3 \ne x^3 - 8$.`
      ],
      formulas: [
        { n: 'End behavior', t: R`\text{leading term } a_nx^n \text{ decides: } n \text{ even} \Rightarrow \text{same ends};\ n \text{ odd} \Rightarrow \text{opposite ends}` },
        { n: 'Zeros and multiplicity', t: R`(x-r)^k:\ k \text{ odd crosses},\ k \text{ even bounces}` },
        { n: 'From a graph', t: R`y = a(x-r_1)(x-r_2)\cdots,\quad \text{use one more point to find } a` }
      ],
      example: { p: R`Write a polynomial with zeros $-2$ (multiplicity 1) and $3$ (multiplicity 2) whose $y$-intercept is $-18$.`, s: R`$y = a(x+2)(x-3)^2$. At $x = 0$: $a(2)(9) = -18 \Rightarrow a = -1$. $y = -(x+2)(x-3)^2$, degree 3, falls to the right, touches at 3, crosses at $-2$.` },
      pitfalls: ['Deciding end behavior from the constant term or a middle term.', 'Drawing a crossing at an even-multiplicity zero.'],
      tip: 'Sketch the end behavior arrows first, then place the zeros; the picture usually fills itself in.'
    },
    {
      id: 'complex', label: 'MFG 7.3', title: 'Complex numbers', unit: 3, link: MFG,
      ideas: [
        R`$i = \sqrt{-1}$, $i^2 = -1$. Every complex number is $a + bi$. Square roots of negatives: $\sqrt{-20} = 2i\sqrt5$.`,
        R`Add and subtract componentwise; multiply like binomials and replace $i^2$ with $-1$; divide by multiplying top and bottom by the conjugate $a - bi$ (which makes the denominator $a^2 + b^2$).`,
        R`Quadratics with negative discriminant have two complex conjugate roots: $x^2 - 2x + 5 = 0 \Rightarrow x = 1 \pm 2i$. Every polynomial of degree $n$ has exactly $n$ zeros counting multiplicity and complex zeros.`
      ],
      formulas: [
        { n: 'Arithmetic', t: R`(a+bi)(c+di) = (ac - bd) + (ad + bc)i,\qquad \frac{a+bi}{c+di} = \frac{(a+bi)(c-di)}{c^2+d^2}` },
        { n: 'Powers of i', t: R`i^2 = -1,\quad i^3 = -i,\quad i^4 = 1` }
      ],
      example: { p: R`Compute $(3 - 2i)(1 + 4i)$ and $\dfrac{2 + i}{3 - i}$, then solve $x^2 + 4x + 13 = 0$.`, s: R`$(3-2i)(1+4i) = 3 + 12i - 2i - 8i^2 = 11 + 10i$. $\dfrac{(2+i)(3+i)}{9+1} = \dfrac{5 + 5i}{10} = \dfrac12 + \dfrac12 i$. $x = \dfrac{-4\pm\sqrt{16-52}}{2} = -2 \pm 3i$.` },
      pitfalls: [R`Writing $i^2 = 1$.`, R`$\sqrt{-4}\sqrt{-9} = \sqrt{36} = 6$ (wrong; it is $(2i)(3i) = -6$).`],
      tip: 'Treat i like a variable when multiplying, then clean up i² = −1 at the end.'
    },
    {
      id: 'rational', label: 'MFG 7.4–7.5', title: 'Rational functions and equations with algebraic fractions', unit: 3, link: MFG,
      ideas: [
        R`$f(x) = \dfrac{p(x)}{q(x)}$. <b>Vertical asymptotes</b> where $q = 0$ and $p \ne 0$ (after cancelling common factors; a cancelled factor makes a hole instead). $x$-intercepts where $p = 0$.`,
        R`<b>Horizontal asymptote</b> from the degrees: $\deg p < \deg q$: $y = 0$; equal: $y =$ ratio of leading coefficients; $\deg p > \deg q$: none (the graph follows the quotient).`,
        R`Sketch using intercepts, asymptotes, and a sign check in each interval. Near a vertical asymptote the graph shoots up or down; test a point on each side.`,
        R`Solve equations with fractions by multiplying through by the LCD, then check that no solution makes a denominator zero (extraneous solutions).`
      ],
      formulas: [
        { n: 'Asymptotes', t: R`\text{VA: } q(x) = 0;\qquad \text{HA: } \deg p<\deg q \Rightarrow y = 0;\ \deg p = \deg q \Rightarrow y = \frac{a_n}{b_n}` },
        { n: 'Clearing fractions', t: R`\frac{A}{x} + \frac{B}{x-2} = C \ \xrightarrow{\ \times x(x-2)\ }\ A(x-2) + Bx = Cx(x-2)` }
      ],
      example: { p: R`Find the intercepts and asymptotes of $f(x) = \dfrac{2x^2 - 8}{x^2 - x - 6}$.`, s: R`Factor: $\dfrac{2(x-2)(x+2)}{(x-3)(x+2)} = \dfrac{2(x-2)}{x-3}$ for $x \ne -2$: hole at $x=-2$, VA $x = 3$, $x$-intercept $2$, $y$-intercept $\tfrac{-8}{-6} = \tfrac43$, HA $y = 2$ (equal degrees, $2/1$).` },
      pitfalls: ['Calling a hole a vertical asymptote.', 'Reading the horizontal asymptote from the constant terms instead of the leading coefficients.', 'Keeping an extraneous solution after clearing fractions.'],
      tip: 'Factor everything first. Cancelled factors are holes; leftover denominator factors are asymptotes.'
    },
    {
      id: 'triangles', label: 'TRIG 1.1–1.3', title: 'Angles, triangles, similar triangles, and circles', unit: 3, link: TRIG,
      ideas: [
        R`Angles in a triangle add to $180^\circ$. Right triangles obey the Pythagorean theorem $a^2 + b^2 = c^2$. Isosceles triangles have equal base angles.`,
        R`<b>Similar triangles</b> have equal angles and proportional sides: corresponding sides are in the same ratio. Set up proportions with matching positions (short/short = long/long). Common sources: parallel lines, shadows, nested right triangles.`,
        R`Special right triangles: $45^\circ$–$45^\circ$–$90^\circ$ sides $1 : 1 : \sqrt2$; $30^\circ$–$60^\circ$–$90^\circ$ sides $1 : \sqrt3 : 2$.`,
        R`Circles: circumference $2\pi r$, area $\pi r^2$; the equation of a circle centered at $(h,k)$ is $(x-h)^2 + (y-k)^2 = r^2$. Distance formula is the Pythagorean theorem in coordinates.`
      ],
      formulas: [
        { n: 'Triangles', t: R`A + B + C = 180^\circ,\qquad a^2 + b^2 = c^2` },
        { n: 'Similar triangles', t: R`\frac{a}{a'} = \frac{b}{b'} = \frac{c}{c'}` },
        { n: 'Circles', t: R`(x-h)^2 + (y-k)^2 = r^2,\qquad d = \sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}` }
      ],
      example: { p: R`A 1.8 m person casts a 2.4 m shadow while a tree casts a 14 m shadow. How tall is the tree?`, s: R`Similar triangles: $\dfrac{h}{14} = \dfrac{1.8}{2.4} \Rightarrow h = 10.5$ m.` },
      pitfalls: ['Matching non-corresponding sides in a proportion.', 'Using the Pythagorean theorem on a triangle with no right angle.'],
      tip: 'Redraw the two similar triangles separately and in the same orientation before writing the proportion.'
    },
    {
      id: 'righttri', label: 'TRIG 2.1–2.3', title: 'Trigonometric ratios and solving right triangles', unit: 3, link: TRIG,
      ideas: [
        R`For an acute angle $\theta$ in a right triangle: $\sin\theta = \dfrac{\text{opp}}{\text{hyp}}$, $\cos\theta = \dfrac{\text{adj}}{\text{hyp}}$, $\tan\theta = \dfrac{\text{opp}}{\text{adj}}$ (SOH-CAH-TOA). The ratios depend only on the angle, not the triangle's size (similarity).`,
        R`Exact values: $\sin30^\circ = \tfrac12$, $\cos30^\circ = \tfrac{\sqrt3}2$, $\tan30^\circ = \tfrac{1}{\sqrt3}$; $\sin45^\circ = \cos45^\circ = \tfrac{\sqrt2}2$, $\tan45^\circ = 1$; $\sin60^\circ = \tfrac{\sqrt3}2$, $\cos60^\circ = \tfrac12$, $\tan60^\circ = \sqrt3$.`,
        R`<b>Solve a triangle</b> = find all sides and angles. From one side and one acute angle: the other angle is $90^\circ - \theta$; use the ratio that links the known side to the wanted side. From two sides: find the third by Pythagoras and an angle by an inverse ratio ($\theta = \tan^{-1}(\text{opp}/\text{adj})$).`,
        R`Applications: angle of elevation/depression, ladders, ramps. Draw, label the right angle, mark which side is opposite the known angle.`,
        R`Cofunctions: $\sin\theta = \cos(90^\circ - \theta)$.`
      ],
      formulas: [
        { n: 'Ratios', t: R`\sin\theta = \frac{\text{opp}}{\text{hyp}},\quad \cos\theta = \frac{\text{adj}}{\text{hyp}},\quad \tan\theta = \frac{\text{opp}}{\text{adj}} = \frac{\sin\theta}{\cos\theta}` },
        { n: 'Inverse ratios', t: R`\theta = \sin^{-1}\frac{\text{opp}}{\text{hyp}},\quad \theta = \cos^{-1}\frac{\text{adj}}{\text{hyp}},\quad \theta = \tan^{-1}\frac{\text{opp}}{\text{adj}}` }
      ],
      example: { p: R`A 6 m ladder leans against a wall making $68^\circ$ with the ground. How high does it reach, and how far is its base from the wall?`, s: R`Height $= 6\sin68^\circ \approx 5.56$ m; base $= 6\cos68^\circ \approx 2.25$ m. Check: $5.56^2 + 2.25^2 \approx 36$ ✓.` },
      pitfalls: ['Using the wrong side as "opposite" (opposite is across from the angle, never the hypotenuse).', 'Calculator in radian mode when the angle is in degrees.', 'Rounding intermediate values, then failing the Pythagorean check.'],
      tip: 'Label the triangle O, A, H relative to the angle you are using before choosing a ratio. Relabel if you switch angles.'
    },
    {
      id: 'laws', label: 'TRIG 3.1–3.3', title: 'Obtuse angles, Law of Sines, Law of Cosines', unit: 4, link: TRIG,
      ideas: [
        R`Coordinate definitions extend the ratios to any angle: for a point $(x,y)$ at distance $r$ from the origin on the terminal side, $\sin\theta = y/r$, $\cos\theta = x/r$, $\tan\theta = y/x$. Obtuse angles have negative cosine and positive sine: $\sin(180^\circ - \theta) = \sin\theta$, $\cos(180^\circ - \theta) = -\cos\theta$.`,
        R`<b>Law of Sines</b> $\dfrac{a}{\sin A} = \dfrac{b}{\sin B} = \dfrac{c}{\sin C}$: use with two angles and a side (AAS/ASA) or two sides and a non-included angle (SSA, the <em>ambiguous case</em>: check for a second triangle with $180^\circ - B$).`,
        R`<b>Law of Cosines</b> $c^2 = a^2 + b^2 - 2ab\cos C$: use with two sides and the included angle (SAS) or three sides (SSS). It reduces to Pythagoras when $C = 90^\circ$.`,
        R`Area of any triangle: $\tfrac12 ab\sin C$.`
      ],
      formulas: [
        { n: 'Law of Sines', t: R`\frac{\sin A}{a} = \frac{\sin B}{b} = \frac{\sin C}{c}` },
        { n: 'Law of Cosines', t: R`c^2 = a^2 + b^2 - 2ab\cos C,\qquad \cos C = \frac{a^2 + b^2 - c^2}{2ab}` },
        { n: 'Area', t: R`\text{Area} = \tfrac12 ab\sin C` }
      ],
      example: { p: R`In triangle $ABC$, $a = 8$, $b = 5$, $C = 60^\circ$. Find $c$ and angle $A$.`, s: R`$c^2 = 64 + 25 - 80\cos60^\circ = 49 \Rightarrow c = 7$. Law of Sines: $\sin A = 8\sin60^\circ/7 \approx 0.990 \Rightarrow A \approx 81.8^\circ$ (since $a$ is the longest side, $A$ is the largest angle; acute here).` },
      pitfalls: ['Using the Law of Sines with SSS or SAS (it needs a matched side–angle pair).', 'Missing the second triangle in the ambiguous case.', 'Sign error in the −2ab cos C term for obtuse angles (cos is negative, the term adds).'],
      tip: 'Count the givens: two angles → Law of Sines; two sides with the included angle or three sides → Law of Cosines first.'
    },
    {
      id: 'trigfn', label: 'TRIG 4.1–4.3', title: 'Angles, rotation, and the graphs of trigonometric functions', unit: 4, link: TRIG,
      ideas: [
        R`Angles in <b>standard position</b> open counterclockwise from the positive $x$-axis; negative angles go clockwise; coterminal angles differ by $360^\circ$. The <b>reference angle</b> is the acute angle to the $x$-axis; trig values of any angle equal those of its reference angle up to sign, and the quadrant fixes the sign (All Students Take Calculus: I all positive, II sine, III tangent, IV cosine).`,
        R`On the unit circle $(\cos\theta, \sin\theta)$ is the point at angle $\theta$. So $\sin$ and $\cos$ are periodic with period $360^\circ$, bounded between $-1$ and $1$.`,
        R`Graphs: $y = \sin\theta$ starts at 0 rising; $y = \cos\theta$ starts at 1; both have amplitude 1 and period $360^\circ$. $y = \tan\theta$ has period $180^\circ$ with vertical asymptotes at $\pm90^\circ$.`,
        R`Use the graphs to solve $\sin\theta = k$ over a range: two solutions per period for $|k| < 1$, found from the reference angle.`
      ],
      formulas: [
        { n: 'Reference angles', t: R`\text{QII: } 180^\circ - \theta,\quad \text{QIII: } \theta - 180^\circ,\quad \text{QIV: } 360^\circ - \theta` },
        { n: 'Unit circle', t: R`P(\theta) = (\cos\theta,\ \sin\theta),\qquad \sin^2\theta + \cos^2\theta = 1` },
        { n: 'Solving', t: R`\sin\theta = k \Rightarrow \theta = \sin^{-1}k\ \text{or}\ 180^\circ - \sin^{-1}k\ (+360^\circ n)` }
      ],
      example: { p: R`Find all $\theta$ in $[0^\circ, 360^\circ)$ with $\cos\theta = -\tfrac12$, and evaluate $\sin 210^\circ$ exactly.`, s: R`Reference angle $60^\circ$; cosine negative in QII and QIII: $\theta = 120^\circ, 240^\circ$. $\sin210^\circ$: QIII, reference $30^\circ$, sine negative: $-\tfrac12$.` },
      pitfalls: ['Reporting only the calculator’s answer (one solution) when the range has two.', 'Wrong sign for the quadrant.', 'Confusing period (horizontal) with amplitude (vertical).'],
      tip: 'Draw the angle. A five-second sketch of the quadrant beats memorizing sign rules.'
    },
    {
      id: 'identities', label: 'TRIG 5.1, 5.3', title: 'Algebra with trig ratios and trigonometric identities', unit: 4, link: TRIG,
      ideas: [
        R`Treat $\sin\theta$ and $\cos\theta$ like variables when simplifying: $\sin\theta\cos\theta + 2\sin\theta = \sin\theta(\cos\theta + 2)$. Careful: $\sin 2\theta \ne 2\sin\theta$ and $\sin^2\theta$ means $(\sin\theta)^2$.`,
        R`Fundamental identities: $\tan\theta = \dfrac{\sin\theta}{\cos\theta}$, $\sin^2\theta + \cos^2\theta = 1$ (and its forms $1 - \cos^2\theta = \sin^2\theta$), $\sin(-\theta) = -\sin\theta$, $\cos(-\theta) = \cos\theta$.`,
        R`Prove an identity by transforming one side into the other (usually the messier side): convert everything to sine and cosine, combine fractions, factor, use the Pythagorean identity.`,
        R`Solve equations by isolating one trig function, using identities to reduce to a single function, then finding all angles in the interval.`
      ],
      formulas: [
        { n: 'Fundamental identities', t: R`\tan\theta = \frac{\sin\theta}{\cos\theta},\qquad \sin^2\theta + \cos^2\theta = 1,\qquad 1 + \tan^2\theta = \sec^2\theta` },
        { n: 'Negative angles', t: R`\sin(-\theta) = -\sin\theta,\quad \cos(-\theta) = \cos\theta,\quad \tan(-\theta) = -\tan\theta` }
      ],
      example: { p: R`Simplify $\dfrac{1 - \cos^2\theta}{\sin\theta\cos\theta}$ and solve $2\sin^2\theta = 1$ for $0^\circ \le \theta < 360^\circ$.`, s: R`$\dfrac{\sin^2\theta}{\sin\theta\cos\theta} = \dfrac{\sin\theta}{\cos\theta} = \tan\theta$. $\sin^2\theta = \tfrac12 \Rightarrow \sin\theta = \pm\tfrac{\sqrt2}{2} \Rightarrow \theta = 45^\circ, 135^\circ, 225^\circ, 315^\circ$.` },
      pitfalls: [R`Dividing an equation by $\sin\theta$ and losing the solutions where $\sin\theta = 0$.`, R`Writing $\sin\theta + \cos\theta = 1$ as an identity (only $\sin^2 + \cos^2 = 1$).`],
      tip: 'When stuck on an identity, write everything in sines and cosines and combine into a single fraction. It almost always unlocks.'
    },
    {
      id: 'radians', label: 'TRIG 6.1–6.3', title: 'Arclength, radians, and the circular functions', unit: 4, link: TRIG,
      ideas: [
        R`A <b>radian</b> is the angle that cuts an arc equal to the radius. $180^\circ = \pi$ rad, so multiply degrees by $\pi/180$ to get radians. Arclength $s = r\theta$ and sector area $A = \tfrac12 r^2\theta$ need $\theta$ in radians.`,
        R`Know the unit-circle values in radians: $\pi/6 = 30^\circ$, $\pi/4 = 45^\circ$, $\pi/3 = 60^\circ$, $\pi/2 = 90^\circ$, $\pi = 180^\circ$, $3\pi/2 = 270^\circ$, $2\pi = 360^\circ$.`,
        R`The circular functions $\sin t$, $\cos t$ take a real number $t$ (an arc length on the unit circle) as input, which is what calculus uses. Graphs have period $2\pi$; $\tan t$ has period $\pi$.`,
        R`Reference numbers work like reference angles: $t$ in QII has reference $\pi - t$, QIII $t - \pi$, QIV $2\pi - t$.`
      ],
      formulas: [
        { n: 'Conversion', t: R`\theta_{\text{rad}} = \theta_{\deg}\cdot\frac{\pi}{180},\qquad \theta_{\deg} = \theta_{\text{rad}}\cdot\frac{180}{\pi}` },
        { n: 'Arclength and sector area', t: R`s = r\theta,\qquad A = \tfrac12 r^2\theta\quad(\theta\ \text{in radians})` },
        { n: 'Key values', t: R`\sin\tfrac\pi6 = \tfrac12,\ \cos\tfrac\pi4 = \tfrac{\sqrt2}2,\ \tan\tfrac\pi3 = \sqrt3,\ \sin\tfrac{3\pi}{2} = -1` }
      ],
      example: { p: R`A 12 cm pendulum swings through $40^\circ$. How long is the arc? Then evaluate $\cos\dfrac{5\pi}{6}$.`, s: R`$40^\circ = \dfrac{2\pi}{9}$ rad; $s = 12\cdot\dfrac{2\pi}{9} \approx 8.38$ cm. $\dfrac{5\pi}{6}$ is in QII with reference $\dfrac\pi6$: $\cos = -\dfrac{\sqrt3}{2}$.` },
      pitfalls: ['Plugging degrees into s = rθ.', 'Calculator mode mismatches.', 'Thinking 1 radian is a "small" or "special" angle: it is about 57.3°.'],
      tip: 'Relabel the unit circle in radians until π/6 and 30° feel identical. Calculus will only speak radians.'
    },
    {
      id: 'sinusoid', label: 'TRIG 7.1–7.3', title: 'Transformations, the general sinusoid, and solving equations', unit: 4, link: TRIG,
      ideas: [
        R`General sinusoid $y = A\sin(B(x - h)) + k$ (or cosine): <b>amplitude</b> $|A|$, <b>period</b> $2\pi/B$ (or $360^\circ/B$), horizontal shift $h$, midline $y = k$. Maximum $k + |A|$, minimum $k - |A|$.`,
        R`Model periodic data (tides, temperature, Ferris wheels): midline is the average of max and min, amplitude is half the difference, period from the cycle, shift from where the cycle starts.`,
        R`Graph in one period: mark five key points (start, quarter, half, three-quarter, end) using the period, then apply amplitude and midline.`,
        R`Solve $A\sin(Bx) + k = c$: isolate the sine, find the reference angle, list all solutions of the inner angle in the needed range, then divide by $B$. More solutions appear when $B > 1$.`
      ],
      formulas: [
        { n: 'General sinusoid', t: R`y = A\sin\big(B(x - h)\big) + k,\quad \text{amp } |A|,\ \text{period } \frac{2\pi}{B},\ \text{midline } y = k` },
        { n: 'From max and min', t: R`k = \frac{\max + \min}{2},\qquad |A| = \frac{\max - \min}{2}` }
      ],
      example: { p: R`Water depth at a dock varies from 2 m to 8 m with a 12-hour cycle, high tide at $t = 3$. Write $d(t)$ with cosine.`, s: R`Midline $5$, amplitude $3$, period 12 so $B = 2\pi/12 = \pi/6$, cosine peaks at the shift: $d(t) = 3\cos\!\left(\dfrac{\pi}{6}(t - 3)\right) + 5$.` },
      pitfalls: ['Using B as the period instead of 2π/B.', 'Applying the horizontal shift before factoring out B: sin(2x − π) has shift π/2, not π.', 'Forgetting the extra solutions when the period is shortened.'],
      tip: 'Write the four numbers (amplitude, period, shift, midline) before the formula. The formula is just bookkeeping.'
    },
    {
      id: 'invtrig', label: 'TRIG 8.2–8.3', title: 'Inverse trigonometric functions and the reciprocal functions', unit: 4, link: TRIG,
      ideas: [
        R`Sine, cosine and tangent are not one-to-one, so their inverses use <b>restricted domains</b>: $\sin^{-1}x$ returns angles in $[-\pi/2, \pi/2]$, $\cos^{-1}x$ in $[0,\pi]$, $\tan^{-1}x$ in $(-\pi/2, \pi/2)$. Inputs to $\sin^{-1}$ and $\cos^{-1}$ must lie in $[-1,1]$.`,
        R`Consequence: $\sin^{-1}(\sin\theta) = \theta$ only when $\theta$ is in the restricted range. $\sin^{-1}(\sin 150^\circ) = 30^\circ$.`,
        R`Solving $\sin\theta = k$ over a full circle needs the inverse value <em>and</em> its partner ($180^\circ - $ value for sine, $360^\circ -$ value for cosine, $+180^\circ$ for tangent).`,
        R`Reciprocal functions: $\sec\theta = 1/\cos\theta$, $\csc\theta = 1/\sin\theta$, $\cot\theta = 1/\tan\theta$; undefined where the denominator is 0. Identities $1 + \tan^2\theta = \sec^2\theta$, $1 + \cot^2\theta = \csc^2\theta$.`,
        R`Exact evaluations: $\cos(\sin^{-1}\tfrac35)$: draw the right triangle with opposite 3, hypotenuse 5, adjacent 4, so $\tfrac45$.`
      ],
      formulas: [
        { n: 'Restricted ranges', t: R`\sin^{-1}: [-\tfrac\pi2, \tfrac\pi2],\qquad \cos^{-1}: [0, \pi],\qquad \tan^{-1}: (-\tfrac\pi2, \tfrac\pi2)` },
        { n: 'Reciprocals', t: R`\sec\theta = \frac{1}{\cos\theta},\quad \csc\theta = \frac1{\sin\theta},\quad \cot\theta = \frac{1}{\tan\theta}` }
      ],
      example: { p: R`Evaluate $\cos^{-1}(-\tfrac{\sqrt2}{2})$, $\sin^{-1}(\sin 200^\circ)$, and $\tan(\cos^{-1}\tfrac{5}{13})$.`, s: R`$\cos^{-1}(-\tfrac{\sqrt2}2) = 135^\circ$ (QII, in $[0,180^\circ]$). $\sin 200^\circ = -\sin 20^\circ$, so $\sin^{-1}$ gives $-20^\circ$. Triangle with adjacent 5, hypotenuse 13, opposite 12: $\tan = \tfrac{12}{5}$.` },
      pitfalls: ['Returning an angle outside the restricted range.', 'Writing sin⁻¹x as 1/sin x (that is csc x).'],
      tip: 'For sin⁻¹ and tan⁻¹ think "between −90° and 90°"; for cos⁻¹ think "between 0° and 180°". Then pick the quadrant from the sign of the input.'
    },
    {
      id: 'quadform', label: 'Quadratic-in-form', title: 'Quadratic-in-form equations, trigonometric and algebraic', unit: 4, link: MFG,
      ideas: [
        R`An equation is <b>quadratic in form</b> when a substitution $u = (\text{something})$ turns it into $au^2 + bu + c = 0$: $x^4 - 5x^2 + 4 = 0$ with $u = x^2$; $x^{2/3} - x^{1/3} - 6 = 0$ with $u = x^{1/3}$; $2\sin^2\theta - \sin\theta - 1 = 0$ with $u = \sin\theta$.`,
        R`Solve for $u$ by factoring or the quadratic formula, then <em>undo</em> the substitution for each $u$ value and keep only valid results ($|\sin\theta| \le 1$, radicands non-negative, domain of the original equation).`,
        R`Trig versions may need an identity first to get a single function: $2\cos^2\theta + \sin\theta = 2$ becomes $2(1 - \sin^2\theta) + \sin\theta = 2$.`,
        R`Report trig solutions for the required interval, using reference angles, and check for solutions where you divided by something.`
      ],
      formulas: [
        { n: 'Substitution', t: R`x^4 - 5x^2 + 4 = 0 \xrightarrow{u = x^2} u^2 - 5u + 4 = 0 \Rightarrow u = 1, 4 \Rightarrow x = \pm1, \pm2` },
        { n: 'Trig form', t: R`2\sin^2\theta - \sin\theta - 1 = 0 \Rightarrow (2\sin\theta + 1)(\sin\theta - 1) = 0` }
      ],
      example: { p: R`Solve $2\sin^2\theta - \sin\theta - 1 = 0$ for $0^\circ \le \theta < 360^\circ$, and $x - 5\sqrt x + 6 = 0$.`, s: R`$(2\sin\theta + 1)(\sin\theta - 1) = 0$: $\sin\theta = -\tfrac12 \Rightarrow 210^\circ, 330^\circ$; $\sin\theta = 1 \Rightarrow 90^\circ$. With $u = \sqrt x$: $u^2 - 5u + 6 = 0 \Rightarrow u = 2, 3 \Rightarrow x = 4, 9$ (both check).` },
      pitfalls: ['Stopping at the u-values.', 'Accepting sin θ = 2 as a solution.', 'Losing the negative root when u = x².'],
      tip: 'Write "let u = …" explicitly on the exam. It shows the method and keeps you from forgetting to substitute back.'
    }
  ];

  /* ---------- Formula sheet ---------- */
  const FORMULAS = [
    { group: 'Functions and lines', items: [
      { n: 'Average rate of change', t: R`\frac{\Delta y}{\Delta x} = \frac{f(b)-f(a)}{b-a}` },
      { n: 'Linear function', t: R`f(x) = b + mx,\quad m = \frac{y_2 - y_1}{x_2 - x_1},\quad y - y_1 = m(x - x_1)` },
      { n: 'Domain rules', t: R`\text{denominator} \ne 0,\qquad \text{even radicand} \ge 0,\qquad \log \text{ argument} > 0` },
      { n: 'Absolute value', t: R`|u| = k \Rightarrow u = \pm k;\quad |u| < k \iff -k < u < k;\quad |u| > k \iff u < -k \text{ or } u > k` },
      { n: 'Transformations', t: R`y = a\,f(x - h) + k:\ \text{stretch } a,\ \text{right } h,\ \text{up } k;\quad -f(x)\ \text{flips vertically},\ f(-x)\ \text{horizontally}` },
      { n: 'Inverse', t: R`f(a) = b \iff f^{-1}(b) = a;\quad \text{swap } x \text{ and } y \text{ and solve}` }
    ]},
    { group: 'Basic functions', items: [
      { n: 'Library', t: R`x^2,\ x^3,\ \sqrt x,\ \sqrt[3]{x},\ \frac1x,\ \frac1{x^2},\ |x|,\ b^x,\ \log_b x` },
      { n: 'Variation', t: R`y = kx^n\ (\text{direct}),\qquad y = \frac{k}{x^n}\ (\text{inverse})` }
    ]},
    { group: 'Exponents and radicals', items: [
      { n: 'Laws', t: R`a^ma^n = a^{m+n},\ \frac{a^m}{a^n} = a^{m-n},\ (a^m)^n = a^{mn},\ (ab)^n = a^nb^n,\ a^{-n} = \frac1{a^n},\ a^0 = 1` },
      { n: 'Rational exponents', t: R`a^{1/n} = \sqrt[n]{a},\qquad a^{m/n} = (\sqrt[n]{a})^m,\qquad \sqrt{x^2} = |x|` }
    ]},
    { group: 'Exponential and logarithmic', items: [
      { n: 'Exponential model', t: R`A(t) = A_0b^t,\quad b = 1 \pm r;\qquad A = A_0 2^{t/D};\qquad A = A_0(\tfrac12)^{t/H};\qquad A = A_0e^{kt}` },
      { n: 'Logarithm definition', t: R`\log_b x = y \iff b^y = x,\qquad \ln x = \log_e x,\qquad e \approx 2.71828` },
      { n: 'Properties', t: R`\log_b MN = \log_b M + \log_b N,\quad \log_b\frac MN = \log_bM - \log_bN,\quad \log_bM^p = p\log_bM` },
      { n: 'Change of base / solving', t: R`\log_b x = \frac{\log x}{\log b},\qquad b^t = c \Rightarrow t = \frac{\log c}{\log b},\qquad t_{\text{double}} = \frac{\ln 2}{k}` },
      { n: 'Compound interest', t: R`A = P\left(1 + \frac rn\right)^{nt},\qquad A = Pe^{rt}` }
    ]},
    { group: 'Quadratic, polynomial, rational', items: [
      { n: 'Quadratic formula', t: R`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a},\qquad x_v = -\frac{b}{2a},\qquad y = a(x - h)^2 + k` },
      { n: 'Polynomials', t: R`\text{end behavior from } a_nx^n;\quad (x-r)^k:\ k \text{ odd crosses, even bounces};\quad \le n \text{ zeros},\ \le n-1 \text{ turns}` },
      { n: 'Complex numbers', t: R`i^2 = -1,\qquad \frac{a+bi}{c+di} = \frac{(a+bi)(c-di)}{c^2+d^2}` },
      { n: 'Rational functions', t: R`\text{VA where denominator} = 0\ (\text{after cancelling; cancelled} = \text{hole});\quad \text{HA: } y=0,\ y = \tfrac{a_n}{b_n},\ \text{or none}` }
    ]},
    { group: 'Triangles', items: [
      { n: 'Basics', t: R`A + B + C = 180^\circ,\qquad a^2 + b^2 = c^2,\qquad \text{similar: } \frac{a}{a'} = \frac{b}{b'}` },
      { n: 'Special triangles', t: R`45^\circ\text{–}45^\circ\text{–}90^\circ:\ 1:1:\sqrt2;\qquad 30^\circ\text{–}60^\circ\text{–}90^\circ:\ 1:\sqrt3:2` },
      { n: 'Right-triangle ratios', t: R`\sin\theta = \frac{\text{opp}}{\text{hyp}},\quad \cos\theta = \frac{\text{adj}}{\text{hyp}},\quad \tan\theta = \frac{\text{opp}}{\text{adj}}` },
      { n: 'Law of Sines / Cosines', t: R`\frac{\sin A}{a} = \frac{\sin B}{b} = \frac{\sin C}{c},\qquad c^2 = a^2 + b^2 - 2ab\cos C,\qquad \text{Area} = \tfrac12ab\sin C` }
    ]},
    { group: 'Unit circle and radians', items: [
      { n: 'Exact values', t: R`\begin{array}{c|ccccc} \theta & 0 & 30^\circ,\tfrac\pi6 & 45^\circ,\tfrac\pi4 & 60^\circ,\tfrac\pi3 & 90^\circ,\tfrac\pi2 \\ \hline \sin & 0 & \tfrac12 & \tfrac{\sqrt2}2 & \tfrac{\sqrt3}2 & 1 \\ \cos & 1 & \tfrac{\sqrt3}2 & \tfrac{\sqrt2}2 & \tfrac12 & 0 \\ \tan & 0 & \tfrac1{\sqrt3} & 1 & \sqrt3 & \text{undef} \end{array}` },
      { n: 'Signs by quadrant', t: R`\text{I: all}+,\quad \text{II: } \sin+,\quad \text{III: } \tan+,\quad \text{IV: } \cos+` },
      { n: 'Reference angle', t: R`\text{II: } 180^\circ-\theta,\quad \text{III: } \theta-180^\circ,\quad \text{IV: } 360^\circ-\theta` },
      { n: 'Radians', t: R`\pi\ \text{rad} = 180^\circ,\qquad s = r\theta,\qquad A = \tfrac12r^2\theta` }
    ]},
    { group: 'Trig functions and identities', items: [
      { n: 'Sinusoid', t: R`y = A\sin(B(x-h)) + k:\ \text{amp } |A|,\ \text{period } \tfrac{2\pi}{B},\ \text{shift } h,\ \text{midline } k` },
      { n: 'Fundamental identities', t: R`\tan\theta = \frac{\sin\theta}{\cos\theta},\quad \sin^2\theta + \cos^2\theta = 1,\quad 1 + \tan^2\theta = \sec^2\theta,\quad 1 + \cot^2\theta = \csc^2\theta` },
      { n: 'Even / odd', t: R`\sin(-\theta) = -\sin\theta,\qquad \cos(-\theta) = \cos\theta` },
      { n: 'Reciprocals', t: R`\sec\theta = \frac1{\cos\theta},\quad \csc\theta = \frac1{\sin\theta},\quad \cot\theta = \frac1{\tan\theta}` },
      { n: 'Inverse trig ranges', t: R`\sin^{-1}: [-90^\circ, 90^\circ],\qquad \cos^{-1}: [0^\circ, 180^\circ],\qquad \tan^{-1}: (-90^\circ, 90^\circ)` },
      { n: 'Quadratic in form', t: R`\text{let } u = x^2,\ x^{1/3},\ \sin\theta,\dots;\ \text{solve } au^2 + bu + c = 0;\ \text{substitute back}` }
    ]}
  ];

  /* ---------- Flashcards ---------- */
  const FLASHCARDS = [
    { id: 'pc-fn', unit: 1, sec: 'fn', f: 'Definition of a function', b: 'A rule assigning exactly one output to each input. Graph test: no vertical line hits it twice.' },
    { id: 'pc-eval', unit: 1, sec: 'fn', f: R`$f(x) = x^2 - 3x$. What is $f(a + h)$?`, b: R`$(a+h)^2 - 3(a+h) = a^2 + 2ah + h^2 - 3a - 3h$. Substitute the whole input.` },
    { id: 'pc-int', unit: 1, sec: 'fn', f: 'How do you find intercepts of y = f(x)?', b: R`$y$-intercept: $f(0)$. $x$-intercepts: solve $f(x) = 0$.` },
    { id: 'pc-aroc', unit: 1, sec: 'rate', f: 'Average rate of change on [a, b]', b: R`$\dfrac{f(b) - f(a)}{b - a}$, the slope of the secant line, in output units per input unit.` },
    { id: 'pc-line', unit: 1, sec: 'rate', f: 'Line through two points', b: R`$m = \dfrac{y_2 - y_1}{x_2 - x_1}$, then $y - y_1 = m(x - x_1)$.` },
    { id: 'pc-lintest', unit: 1, sec: 'rate', f: 'How do you tell from a table that a function is linear?', b: 'Δy/Δx is the same for every pair of points (constant rate of change).' },
    { id: 'pc-lib', unit: 1, sec: 'models', f: 'Domain and range of √x and 1/x', b: R`$\sqrt x$: domain $[0,\infty)$, range $[0,\infty)$. $1/x$: domain and range both $x \ne 0$.` },
    { id: 'pc-shift', unit: 1, sec: 'transform', f: R`How does $y = f(x - 3) + 2$ move the graph of $f$?`, b: 'Right 3, up 2. The sign inside is reversed.' },
    { id: 'pc-refl', unit: 1, sec: 'transform', f: R`$-f(x)$ vs $f(-x)$`, b: R`$-f(x)$ reflects across the $x$-axis; $f(-x)$ reflects across the $y$-axis.` },
    { id: 'pc-order', unit: 1, sec: 'transform', f: R`Order of transformations in $y = a f(x - h) + k$`, b: 'Shift horizontally by h, stretch/reflect by a, then shift vertically by k.' },
    { id: 'pc-absineq', unit: 1, sec: 'absdom', f: R`Solve $|u| < k$ and $|u| > k$`, b: R`$|u| < k \iff -k < u < k$. $|u| > k \iff u < -k$ or $u > k$.` },
    { id: 'pc-dom', unit: 1, sec: 'absdom', f: 'Three things that restrict a domain', b: 'Division by zero, even roots of negatives, logs of non-positive numbers (plus context).' },
    { id: 'pc-var', unit: 2, sec: 'variation', f: 'Direct vs inverse variation', b: R`Direct: $y = kx^n$ (through the origin). Inverse: $y = k/x^n$. Find $k$ from one data point.` },
    { id: 'pc-negexp', unit: 2, sec: 'exponents', f: R`$a^{-n}$ means`, b: R`$\dfrac{1}{a^n}$, a reciprocal, not a negative number.` },
    { id: 'pc-ratexp', unit: 2, sec: 'exponents', f: R`$a^{m/n}$`, b: R`$(\sqrt[n]{a})^m$. Example: $8^{2/3} = (\sqrt[3]{8})^2 = 4$.` },
    { id: 'pc-laws', unit: 2, sec: 'exponents', f: 'Three exponent laws', b: R`$a^ma^n = a^{m+n}$, $(a^m)^n = a^{mn}$, $a^m/a^n = a^{m-n}$.` },
    { id: 'pc-growth', unit: 2, sec: 'expgrowth', f: 'Growth factor for 7% growth; for 12% decay', b: R`$1.07$ and $0.88$. $A(t) = A_0b^t$.` },
    { id: 'pc-expvslin', unit: 2, sec: 'expgrowth', f: 'Table test: linear vs exponential', b: 'Equal x-steps: constant differences → linear; constant ratios → exponential.' },
    { id: 'pc-expfeat', unit: 2, sec: 'expgrowth', f: R`Features of $y = ab^x$`, b: R`Domain all reals, range $(0,\infty)$, horizontal asymptote $y=0$, $y$-intercept $a$; increasing if $b>1$.` },
    { id: 'pc-logdef', unit: 2, sec: 'logs', f: R`$\log_b x = y$ means`, b: R`$b^y = x$. A log is an exponent.` },
    { id: 'pc-logprop', unit: 2, sec: 'logs', f: 'Three log properties', b: R`$\log MN = \log M + \log N$; $\log\frac MN = \log M - \log N$; $\log M^p = p\log M$.` },
    { id: 'pc-lognot', unit: 2, sec: 'logs', f: R`Is $\log(a + b) = \log a + \log b$?`, b: 'No. There is no rule for the log of a sum.' },
    { id: 'pc-cob', unit: 2, sec: 'logs', f: 'Change of base', b: R`$\log_b x = \dfrac{\log x}{\log b} = \dfrac{\ln x}{\ln b}$.` },
    { id: 'pc-half', unit: 2, sec: 'expmodels', f: 'Half-life model', b: R`$A = A_0\left(\tfrac12\right)^{t/H}$. Doubling: $A = A_0 2^{t/D}$.` },
    { id: 'pc-inv', unit: 2, sec: 'inverse', f: 'How to find f⁻¹(x)', b: 'Write y = f(x), swap x and y, solve for y. Check f(f⁻¹(x)) = x.' },
    { id: 'pc-invgraph', unit: 2, sec: 'inverse', f: 'Graph relationship of f and f⁻¹', b: 'Reflections of each other across the line y = x; domain and range swap.' },
    { id: 'pc-ln', unit: 2, sec: 'logfn', f: R`$\ln x$ and $e$`, b: R`$\ln x = \log_e x$ with $e \approx 2.718$; $e^{\ln x} = x$, $\ln e^x = x$.` },
    { id: 'pc-cont', unit: 2, sec: 'logfn', f: 'Continuous growth model and doubling time', b: R`$A = A_0e^{kt}$; doubling time $\ln 2 / k$; $b = e^k$.` },
    { id: 'pc-quad', unit: 3, sec: 'quadratics', f: 'Quadratic formula', b: R`$x = \dfrac{-b \pm \sqrt{b^2 - 4ac}}{2a}$; discriminant $b^2 - 4ac$ counts real roots.` },
    { id: 'pc-vertex', unit: 3, sec: 'quadratics', f: R`Vertex of $y = ax^2 + bx + c$`, b: R`$x = -\dfrac{b}{2a}$ (midway between the roots); plug in for $y$. Max if $a<0$, min if $a>0$.` },
    { id: 'pc-end', unit: 3, sec: 'poly', f: 'End behavior of a polynomial', b: 'Determined by the leading term only. Even degree: ends match. Odd degree: ends opposite. Sign of aₙ decides up/down on the right.' },
    { id: 'pc-mult', unit: 3, sec: 'poly', f: 'Multiplicity and the graph', b: 'Odd multiplicity: crosses the axis. Even multiplicity: touches and turns around.' },
    { id: 'pc-i', unit: 3, sec: 'complex', f: R`$i^2$, and how to divide complex numbers`, b: R`$i^2 = -1$. Multiply numerator and denominator by the conjugate $c - di$.` },
    { id: 'pc-va', unit: 3, sec: 'rational', f: 'Vertical asymptote vs hole', b: 'Factor first. A factor that cancels makes a hole; a denominator factor that remains makes a vertical asymptote.' },
    { id: 'pc-ha', unit: 3, sec: 'rational', f: 'Horizontal asymptote rule', b: 'Compare degrees: top smaller → y = 0; equal → ratio of leading coefficients; top larger → none.' },
    { id: 'pc-sim', unit: 3, sec: 'triangles', f: 'Similar triangles', b: 'Equal angles, proportional corresponding sides. Set up ratios position by position.' },
    { id: 'pc-special', unit: 3, sec: 'triangles', f: 'Side ratios of the special right triangles', b: R`$45$–$45$–$90$: $1:1:\sqrt2$. $30$–$60$–$90$: $1:\sqrt3:2$ (short leg opposite $30^\circ$).` },
    { id: 'pc-sohcahtoa', unit: 3, sec: 'righttri', f: 'SOH-CAH-TOA', b: R`$\sin = \frac{\text{opp}}{\text{hyp}}$, $\cos = \frac{\text{adj}}{\text{hyp}}$, $\tan = \frac{\text{opp}}{\text{adj}}$.` },
    { id: 'pc-exact', unit: 3, sec: 'righttri', f: R`$\sin 30^\circ$, $\cos 45^\circ$, $\tan 60^\circ$`, b: R`$\tfrac12$, $\tfrac{\sqrt2}{2}$, $\sqrt3$.` },
    { id: 'pc-solve', unit: 3, sec: 'righttri', f: 'Find an acute angle from two sides', b: R`Use the inverse of the ratio that uses those sides, e.g. $\theta = \tan^{-1}(\text{opp}/\text{adj})$.` },
    { id: 'pc-sines', unit: 4, sec: 'laws', f: 'Law of Sines and when to use it', b: R`$\dfrac{\sin A}{a} = \dfrac{\sin B}{b} = \dfrac{\sin C}{c}$; use with AAS, ASA, or SSA (ambiguous: check $180^\circ - B$).` },
    { id: 'pc-cosines', unit: 4, sec: 'laws', f: 'Law of Cosines and when to use it', b: R`$c^2 = a^2 + b^2 - 2ab\cos C$; use with SAS or SSS.` },
    { id: 'pc-obtuse', unit: 4, sec: 'laws', f: R`$\sin(180^\circ - \theta)$ and $\cos(180^\circ - \theta)$`, b: R`$\sin\theta$ and $-\cos\theta$.` },
    { id: 'pc-ref', unit: 4, sec: 'trigfn', f: 'Reference angle in each quadrant', b: R`II: $180^\circ - \theta$; III: $\theta - 180^\circ$; IV: $360^\circ - \theta$.` },
    { id: 'pc-signs', unit: 4, sec: 'trigfn', f: 'Which trig functions are positive in each quadrant?', b: 'I: all. II: sine. III: tangent. IV: cosine. ("All Students Take Calculus")' },
    { id: 'pc-unit', unit: 4, sec: 'trigfn', f: 'Point on the unit circle at angle θ', b: R`$(\cos\theta, \sin\theta)$.` },
    { id: 'pc-pyth', unit: 4, sec: 'identities', f: 'Pythagorean identity and two rearrangements', b: R`$\sin^2\theta + \cos^2\theta = 1$; $1 - \sin^2\theta = \cos^2\theta$; $1 + \tan^2\theta = \sec^2\theta$.` },
    { id: 'pc-tan', unit: 4, sec: 'identities', f: R`$\tan\theta$ in terms of sine and cosine`, b: R`$\dfrac{\sin\theta}{\cos\theta}$, undefined where $\cos\theta = 0$.` },
    { id: 'pc-rad', unit: 4, sec: 'radians', f: 'Degrees to radians', b: R`Multiply by $\pi/180$. $180^\circ = \pi$, $90^\circ = \pi/2$, $60^\circ = \pi/3$, $45^\circ = \pi/4$, $30^\circ = \pi/6$.` },
    { id: 'pc-arc', unit: 4, sec: 'radians', f: 'Arclength and sector area', b: R`$s = r\theta$, $A = \tfrac12 r^2\theta$, θ in radians.` },
    { id: 'pc-sinusoid', unit: 4, sec: 'sinusoid', f: R`Amplitude, period, midline of $y = A\sin(B(x - h)) + k$`, b: R`$|A|$, $2\pi/B$, $y = k$; horizontal shift $h$.` },
    { id: 'pc-midline', unit: 4, sec: 'sinusoid', f: 'Midline and amplitude from max and min', b: R`$k = \frac{\max + \min}{2}$, $|A| = \frac{\max - \min}{2}$.` },
    { id: 'pc-invrange', unit: 4, sec: 'invtrig', f: 'Ranges of sin⁻¹, cos⁻¹, tan⁻¹', b: R`$[-90^\circ, 90^\circ]$, $[0^\circ, 180^\circ]$, $(-90^\circ, 90^\circ)$.` },
    { id: 'pc-recip', unit: 4, sec: 'invtrig', f: 'sec, csc, cot', b: R`$1/\cos$, $1/\sin$, $1/\tan$. Not the inverse functions.` },
    { id: 'pc-qform', unit: 4, sec: 'quadform', f: 'Quadratic-in-form strategy', b: 'Substitute u for the repeated expression, solve the quadratic in u, substitute back, discard impossible values.' }
  ];

  /* ---------- Exam 1 practice set ---------- */
  const PRACTICE = {
    exam1: {
      title: 'Exam 1 practice problems',
      subtitle: 'Fourteen exam-style problems on MFG 1.2 – 2.6 with full solutions. Show work and use correct notation: exams are graded on the four-point scale.',
      problems: [
        { n: 1, sec: 'fn', tags: ['fn-eval'], q: R`Let $f(x) = x^2 - 3x + 1$. Find $f(-2)$, $f(a + 1)$ (simplified), and all $x$ with $f(x) = 1$.`, s: R`$f(-2) = 4 + 6 + 1 = 11$. $f(a+1) = (a+1)^2 - 3(a+1) + 1 = a^2 + 2a + 1 - 3a - 3 + 1 = a^2 - a - 1$. $f(x) = 1 \Rightarrow x^2 - 3x = 0 \Rightarrow x(x - 3) = 0 \Rightarrow x = 0, 3$.` },
        { n: 2, sec: 'fn', tags: ['fn-eval'], q: R`Decide whether each relation is a function of $x$, and explain: (a) the table $(1, 2), (2, 5), (1, 3)$; (b) $y^2 = x$; (c) $y = 2x^2 - 7$.`, s: R`(a) No: input 1 has two outputs. (b) No: $x = 4$ gives $y = \pm2$ (fails the vertical line test). (c) Yes: each $x$ produces one $y$.` },
        { n: 3, sec: 'absdom', tags: ['domain'], q: R`Find the domain of $h(x) = \dfrac{\sqrt{6 - 2x}}{x + 1}$ in interval notation.`, s: R`Need $6 - 2x \ge 0 \Rightarrow x \le 3$ and $x + 1 \ne 0 \Rightarrow x \ne -1$. Domain: $(-\infty, -1) \cup (-1, 3]$.` },
        { n: 4, sec: 'rate', tags: ['aroc'], q: R`Find the average rate of change of $f(x) = x^2 - 4x$ on $[1, 4]$ and on $[-1, 1]$. Interpret the sign of each.`, s: R`$f(4) = 0$, $f(1) = -3$: $\dfrac{0 - (-3)}{3} = 1$ (rising on average). $f(1) = -3$, $f(-1) = 5$: $\dfrac{-3 - 5}{2} = -4$ (falling on average).` },
        { n: 5, sec: 'rate', tags: ['linear'], q: R`Find the linear function through $(2, 5)$ and $(6, -3)$. Give its slope, both intercepts, and $f(10)$.`, s: R`$m = \dfrac{-3 - 5}{6 - 2} = -2$. $y - 5 = -2(x - 2) \Rightarrow f(x) = 9 - 2x$. $y$-intercept $(0, 9)$; $x$-intercept $x = 4.5$. $f(10) = -11$.` },
        { n: 6, sec: 'rate', tags: ['linear'], q: R`A taxi charges \$3.50 plus \$2.25 per mile. Write $C(m)$, find the cost of an 8-mile ride, find how far \$30 takes you, and interpret the slope and intercept.`, s: R`$C(m) = 3.50 + 2.25m$. $C(8) = 21.50$ dollars. $30 = 3.5 + 2.25m \Rightarrow m = 11.8$ miles. Slope: \$2.25 per mile; intercept: the \$3.50 charged before any distance.` },
        { n: 7, sec: 'rate', tags: ['linear'], q: R`The table gives $x = 0, 2, 4, 6$ and $y = 11, 8, 5, 2$. Is $y$ a linear function of $x$? If so, write the formula.`, s: R`Equal $x$-steps of 2 give equal $y$-steps of $-3$: linear with slope $-3/2$ and intercept 11: $y = 11 - \tfrac32 x$.` },
        { n: 8, sec: 'models', tags: ['models'], q: R`Sketch $y = 1/x$ and $y = \sqrt x$ on the same axes. Give the domain and range of each and state which one is decreasing for $x > 0$.`, s: R`$1/x$: domain and range $x \ne 0$, two branches, decreasing on $(0,\infty)$. $\sqrt x$: domain $[0,\infty)$, range $[0,\infty)$, increasing. Only $1/x$ is decreasing.` },
        { n: 9, sec: 'models', tags: ['models'], q: R`The area of a square is a function of its perimeter $P$. Write $A(P)$, find $A(20)$, and find the perimeter of a square with area 36.`, s: R`Side $= P/4$, so $A(P) = (P/4)^2 = P^2/16$. $A(20) = 25$. $P^2/16 = 36 \Rightarrow P^2 = 576 \Rightarrow P = 24$ (positive root only).` },
        { n: 10, sec: 'transform', tags: ['transform'], q: R`Describe, in order, the transformations that take $y = x^2$ to $g(x) = -2(x + 3)^2 + 4$, and give the vertex and range of $g$.`, s: R`Shift left 3, stretch vertically by 2, reflect across the $x$-axis, shift up 4. Vertex $(-3, 4)$; since the parabola opens down, range $(-\infty, 4]$.` },
        { n: 11, sec: 'transform', tags: ['transform'], q: R`Write a formula for the graph of $y = \sqrt x$ shifted right 2 and down 5. State its domain and range. Then do the same for $y = |x|$ reflected across the $x$-axis and shifted up 3.`, s: R`$y = \sqrt{x - 2} - 5$: domain $[2, \infty)$, range $[-5, \infty)$. $y = -|x| + 3$: domain all reals, range $(-\infty, 3]$.` },
        { n: 12, sec: 'absdom', tags: ['absval'], q: R`Solve: (a) $|2x - 5| = 7$; (b) $|x + 3| < 4$; (c) $|x - 1| \ge 2$. Give (b) and (c) in interval notation.`, s: R`(a) $2x - 5 = 7$ or $2x - 5 = -7$: $x = 6$ or $x = -1$. (b) $-4 < x + 3 < 4 \Rightarrow (-7, 1)$. (c) $x - 1 \le -2$ or $x - 1 \ge 2$: $(-\infty, -1] \cup [3, \infty)$.` },
        { n: 13, sec: 'models', tags: ['models'], q: R`Let $f(x) = \begin{cases} x + 2 & x < 1 \\ 4 - x & x \ge 1 \end{cases}$. Find $f(0)$, $f(1)$, $f(3)$, sketch the graph, and state the range.`, s: R`$f(0) = 2$, $f(1) = 3$, $f(3) = 1$. The left piece is a line rising to height 3 at $x = 1$ (open), the right piece starts at $(1, 3)$ and falls. The graph is connected. Range: $(-\infty, 3]$.` },
        { n: 14, sec: 'absdom', tags: ['domain'], q: R`For $f(x) = |x - 3|$: on what intervals is $f$ increasing and decreasing? What is the average rate of change on $[1, 2]$ and on $[1, 5]$?`, s: R`Corner at $x = 3$: decreasing on $(-\infty, 3)$, increasing on $(3, \infty)$. On $[1, 2]$: $\dfrac{1 - 2}{1} = -1$. On $[1, 5]$: $\dfrac{2 - 2}{4} = 0$ (the secant is flat even though the function is not constant).` }
      ]
    }
  };

  const CHECKLISTS = {
    exam1: ['Notes for MFG 1.2 – 2.6 on this site', 'Redo every WebWork set from the first four weeks on paper', 'Work the 14 practice problems on the Exam prep page with full written explanations', 'Sketch the seven basic functions from memory with domain and range', 'Flashcards: Unit 1 mastered', 'Quizzer: 20 Unit 1 questions at ≥ 80%', 'Practice writing interpretation sentences for slope and intercept with units'],
    exam2: ['Notes for MFG 3.1 – 5.3', 'Exponent laws and log properties from memory', 'Redo WebWork sets on exponentials and logs', 'Flashcards: Unit 2 mastered', 'Quizzer: 20 Unit 2 questions at ≥ 80%', 'Ten "solve for the exponent" problems in a row without a calculator'],
    exam3: ['Notes for MFG 6.1 – 7.5 and TRIG 1.1 – 2.3', 'Quadratic formula, vertex, end behavior, asymptote rules from memory', 'Exact trig values for 30°, 45°, 60°', 'Flashcards: Unit 3 mastered', 'Quizzer: 20 Unit 3 questions at ≥ 80%', 'Solve five right triangles and five rational-function sketches by hand'],
    final: ['Notes for TRIG 3.1 – 8.3', 'Unit circle in degrees and radians from memory', 'Laws of Sines and Cosines: one problem of each case (AAS, SSA, SAS, SSS)', 'Flashcards: all units mastered', 'Quizzer: one timed 50-minute mixed set per day in finals week', 'Redo all three semester exams']
  };

  const INFO = [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
        <li><b>Instructor:</b> ${COURSE.instructor} · ${COURSE.instructorRoom} · <a href="mailto:${COURSE.instructorEmail}">${COURSE.instructorEmail}</a></li>
        <li><b>Office hours:</b> ${COURSE.officeHours}</li>
        <li><b>Prerequisite:</b> M 121Q or Math Level 400. Prepares you for M171Q / M165Q.</li>
        <li><b>Textbooks:</b> <a href="${MFG}" target="_blank" rel="noopener">Modeling, Functions, and Graphs</a> and <a href="${TRIG}" target="_blank" rel="noopener">Trigonometry</a> by Katherine Yoshiwara (free).</li>
        <li><b>Homework:</b> <a href="${COURSE.webwork}" target="_blank" rel="noopener">WebWork</a> due Mon and Thu 11:59 pm; written work through Gradescope.</li>
        <li><b>Time:</b> plan on 8–12 hours per week outside class. Check Canvas announcements daily.</li>
        <li><b>Exams:</b> three in class on Thursdays plus the final. No calculators or internet devices from start to hand-in. Dates are firm; conflicts need a week's notice.</li>
      </ul>` },
    { icon: 'clock', title: 'Deadlines', html: `<ul class="list-plain small">${COURSE.deadlines.map(d => `<li><b>${d.name}.</b> ${d.rule}</li>`).join('')}</ul>` },
    { icon: 'bulb', title: 'Where to get help', html: `<ul class="list-plain small">
        <li><b>Office hours</b> with your instructor, an M151Q "expert" who wants to help. Asking for help is a sign of a good student.</li>
        <li><b>Math &amp; Stat Center</b> · Romney 220 · short help segments; bring your notebook and CatCard.</li>
        <li><b>SmartyCats</b> for longer tutoring sessions.</li>
        <li><b>Study groups:</b> start problems on your own, discuss, then write your own solutions.</li>
        <li><b>Disability Services</b> · Romney 137 · <a href="https://www.montana.edu/disabilityservices/" target="_blank" rel="noopener">montana.edu/disabilityservices</a>. Contact them early; accommodations take weeks to arrange.</li>
      </ul>` },
    { icon: 'flag', title: 'Exams and weights', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Exam</th><th>When</th><th>Weight</th></tr></thead><tbody>${EXAMS.map(e => `<tr><td><b>${e.name}</b></td><td>${e.dateLabel}</td><td class="num">${e.weight}%</td></tr>`).join('')}<tr><td><b>Homework, quizzes, worksheets</b></td><td>all semester</td><td class="num">20%</td></tr></tbody></table></div><p class="small muted mt-1">Aim for a B or better: students who earn a C or C- often need to repeat M171Q.</p>` },
    { icon: 'list', title: 'Written work, AI, and integrity', span2: true, html: `<p class="small">This course emphasizes clear, precise mathematical language and explaining <em>why</em>, not just <em>how</em>. Quizzes, worksheets and exams use the four-point scale (see the Grade calculator page): organized, complete, explained, with correct notation.</p>
      <div class="divider"></div><div class="eyebrow mb-1">AI policy (summary)</div><p class="small">AI is permitted as a support tool: concept clarification, Socratic questioning, generating practice questions, checking your work, study plans. It must not replace your own thinking or produce submitted work. Attempt first, ask specific questions, verify everything. All submitted work must be your own.</p>
      <div class="divider"></div><div class="eyebrow mb-1">Academic integrity</div><p class="small">Any academic dishonesty leads to disciplinary action up to a failing grade (MSU policy 330.10). Devices during an exam mean a score of 0 and a referral.</p>` }
  ];

  const NAV = [
    { label: 'Today', items: [['dashboard', 'Dashboard', 'home'], ['calendar', 'Calendar', 'calendar']] },
    { label: 'Learn', items: [['notes', 'Topic notes', 'book'], ['formulas', 'Formula sheet', 'sigma'], ['flashcards', 'Flashcards', 'cards'], ['textbook', 'Textbooks & links', 'link']] },
    { label: 'Practice', items: [['practice', 'Quizzer', 'list'], ['exam', 'Exam prep', 'flag'], ['planner', 'Study planner', 'calendar']] },
    { label: 'Tools', items: [['explorer', 'Function explorer', 'chart'], ['unitcircle', 'Unit circle & triangles', 'target'], ['grapher', 'Grapher', 'flask'], ['grades', 'Grade calculator', 'calc'], ['scratchpad', 'Scratchpad', 'pen']] },
    { label: 'Community', items: [['forum', 'Discussions', 'chat']] },
    { label: 'Course', items: [['course', 'Syllabus & policies', 'info'], ['settings', 'Settings', 'sliders']] }
  ];

  global.Courses = global.Courses || {};
  global.Courses.precalc = Object.assign(global.Courses.precalc || {}, {
    id: 'precalc', code: 'M151Q', name: 'Precalculus', short: 'Precalc', term: 'Fall 2026', tagline: 'Functions, models, exponentials, logs and trigonometry with the Yoshiwara texts',
    quizNote: 'Angles are in degrees unless a problem says radians. You can type 3/8, sqrt(2)/2, 2pi or 1.5e3. Answers within 1% count.',
    COURSE, GRADING, EXAMS, CALENDAR, CALENDAR_NOTE, RECURRING, SEMESTER, UNITS, SECTIONS, FORMULAS, FLASHCARDS, PRACTICE, CHECKLISTS, INFO, NAV
  });
})(window);
