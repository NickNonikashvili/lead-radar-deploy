/* ============================================================
   Mathub — M171 Calculus I course data
   Source: M171 Fall 2026 syllabus, calendar, and Exam 1 practice set.
   All math is written in TeX and rendered by MathJax.
   ============================================================ */
(function (global) {
  'use strict';
  const R = String.raw;

  /* ---------- Course facts ---------- */
  const COURSE = {
    code: 'M171',
    name: 'Calculus I',
    term: 'Fall 2026',
    school: 'Montana State University',
    credits: 4,
    weeklyHours: 12,
    textbook: { title: 'Active Calculus (Single Variable, 2nd ed.)', url: 'https://activecalculus.org/single/' },
    textbookBase: 'https://activecalculus.org/single/',
    webwork: 'https://webwork3.math.montana.edu/webwork2/F26M171',
    canvas: 'https://ecat.montana.edu/',
    pdf: 'active_calculus.pdf',
    links: [
      { eyebrow: 'Textbook', title: 'Active Calculus online', url: 'https://activecalculus.org/single/', desc: 'Active Calculus, single variable, 2nd edition (free).' },
      { eyebrow: 'Homework', title: 'WebWork F26 M171', url: 'https://webwork3.math.montana.edu/webwork2/F26M171', desc: 'Due 8:00 pm Mon / Tue / Thu. PreQuizzes live here too.' },
      { eyebrow: 'Course site', title: 'Canvas', url: 'https://ecat.montana.edu/', desc: 'Unit packets, preview activities, videos, Gradescope links.' }
    ],
    helpCenter: { name: 'Math & Stat Center', where: 'Romney 220', hours: 'Mon–Thu 9–6 · Fri 9–5' },
    tutoring: 'Smarty Cats',
    disability: { where: '137 Romney Hall', url: 'https://www.montana.edu/drv/disability/student.htm' },
    successCoordinator: 'Veronica Baker (contact before an exam conflict, ideally a week prior)',
    classDays: 'Mon · Wed · Fri lecture, plus one lab (Tue or Thu)',
    deadlines: [
      { name: 'WebWork (online HW)', rule: 'Due 8:00 pm on Mon, Tue and Thu. 50% credit until solutions post at noon the next day, then 0.' },
      { name: 'Written homework', rule: 'Due in Gradescope by 8:00 pm on Mondays. Graded on process, not just answers.' },
      { name: 'Lab sheet', rule: 'One per group, due in Gradescope by 8:00 pm the day after your lab.' },
      { name: 'Preview activity + PreQuiz', rule: 'Complete the preview activity, compare with posted solutions, then take the PreQuiz in WebWork before class.' }
    ]
  };

  /* ---------- Grading (syllabus) ---------- */
  const GRADING = {
    categories: [
      { id: 'prequiz',  name: 'PreQuiz (before-class activity and quiz)', weight: 3 },
      { id: 'prereq',   name: 'Prerequisite worksheets (written homework)', weight: 4 },
      { id: 'webwork',  name: 'WebWork (online homework per section)', weight: 7 },
      { id: 'labs',     name: 'Labs (weekly lab submissions)', weight: 7 },
      { id: 'quizzes',  name: 'Quizzes (in-class and take-home; lowest dropped)', weight: 7 },
      { id: 'exam1',    name: 'Unit 1 Exam (through §1.6)', weight: 10 },
      { id: 'exam2',    name: 'Unit 2 Exam (through §2.6)', weight: 14 },
      { id: 'exam3',    name: 'Unit 3 Exam (through §3.1, §3.5)', weight: 14 },
      { id: 'exam4',    name: 'Unit 4 Exam (through §5.2)', weight: 14 },
      { id: 'final',    name: 'Comprehensive Final Exam', weight: 20 }
    ],
    // percentage lower bounds
    finalId: 'final',
    scale: [
      { letter: 'A',  min: 93.75, fourPt: '3.75 – 4.0' },
      { letter: 'A-', min: 91.25, fourPt: '3.65 – 3.75' },
      { letter: 'B+', min: 88.75, fourPt: '3.55 – 3.65' },
      { letter: 'B',  min: 82.5,  fourPt: '3.3 – 3.55' },
      { letter: 'B-', min: 75,    fourPt: '3.0 – 3.3' },
      { letter: 'C+', min: 72.5,  fourPt: '2.9 – 3.0' },
      { letter: 'C',  min: 70,    fourPt: '2.8 – 2.9' },
      { letter: 'C-', min: 67.5,  fourPt: '2.7 – 2.8' },
      { letter: 'D',  min: 62.5,  fourPt: '2.5 – 2.7' },
      { letter: 'F',  min: 0,     fourPt: '0 – 2.5' }
    ],
    rubric: [
      { score: 4, name: 'Complete', desc: 'Comprehensive, thoughtful understanding. Organized and complete. Ideas and math thinking fully explained with correct notation. May contain a trivial error.' },
      { score: 3, name: 'Substantial', desc: 'Enough detail to show you understood the problem. Mostly organized. Explains ideas and thinking. May contain some errors.' },
      { score: 2, name: 'Developing', desc: 'Not enough detail to show understanding. Ideas not clearly explained. Significant gaps; unorganized or incomplete.' },
      { score: 1, name: 'Minimal', desc: 'No details, does not make sense, no explanation of ideas.' },
      { score: 0, name: 'No credit', desc: 'Not seriously attempted.' }
    ]
  };

  /* ---------- Exams ---------- */
  const EXAMS = [
    { id: 'exam1', n: 1, name: 'Exam 1', date: '2026-09-18', covers: 'through §1.6 and Lab 3', sections: ['1.1','1.2','1.3','1.4','1.5','1.6'], labs: [1,2,3], units: [1], weight: 10 },
    { id: 'exam2', n: 2, name: 'Exam 2', date: '2026-10-16', covers: 'through §2.6 (emphasis §1.7 – §2.6)', sections: ['1.7','1.8','2.1','2.2','2.3','2.4','2.5','2.6'], labs: [4,5,6,7], units: [1,2], weight: 14 },
    { id: 'exam3', n: 3, name: 'Exam 3', date: '2026-11-06', covers: 'through §3.1 and §3.5 (emphasis §2.7, §2.8, §3.1, §3.5)', sections: ['2.7','3.5','2.8','3.1'], labs: [8,9,10], units: [1,2,3], weight: 14 },
    { id: 'exam4', n: 4, name: 'Exam 4', date: '2026-12-09', covers: 'through §5.2 (emphasis §3.3 – §5.2)', sections: ['3.3','3.4','4.1','4.2','4.3','4.4','5.1','5.2'], labs: [11,12,13,14], units: [1,2,3,4], weight: 14 },
    { id: 'final', n: 5, name: 'Final Exam', date: '2026-12-14', endDate: '2026-12-18', dateLabel: 'Finals week (Dec 14 – 18), day and time TBD', covers: 'cumulative, through §5.2', sections: [], labs: [], units: [1,2,3,4], weight: 20, cumulative: true }
  ];

  /* ---------- Calendar ----------
     type: lecture | lab | exam | holiday | admin | review  */
  const CALENDAR = [
    ['2026-08-26','lecture','Syllabus · Modeling (Pre 1)'],
    ['2026-08-27','holiday','No lab'],
    ['2026-08-28','lecture','§1.1 Velocity'],
    ['2026-08-31','lecture','§1.2 The limit idea'],
    ['2026-09-01','lab','Lab 1 · Limit ideas'],
    ['2026-09-02','lecture','§1.3 Derivative at a point'],
    ['2026-09-03','lab','Lab 1 · Limit ideas'],
    ['2026-09-04','lecture','§1.4 The derivative function'],
    ['2026-09-07','holiday','Labor Day · no class'],
    ['2026-09-08','lab','Lab 2 · Definition of the derivative'],
    ['2026-09-09','lecture','§1.5 Interpreting and estimating'],
    ['2026-09-10','lab','Lab 2 · Definition of the derivative'],
    ['2026-09-11','lecture','§1.6 Second derivative'],
    ['2026-09-14','lecture','§1.6 Second derivative'],
    ['2026-09-15','lab','Lab 3 · Using derivatives'],
    ['2026-09-16','admin','Last day to drop without a W'],
    ['2026-09-16','lecture','§1.7 Limits and continuity'],
    ['2026-09-17','lab','Lab 3 · Using derivatives'],
    ['2026-09-18','exam','Exam 1 · through §1.6'],
    ['2026-09-21','lecture','§1.7 Differentiability · Trig (Pre 2)'],
    ['2026-09-22','lab','Lab 4 · Limits, continuity, differentiability'],
    ['2026-09-23','lecture','§1.8 Tangent lines'],
    ['2026-09-24','lab','Lab 4 · Limits, continuity, differentiability'],
    ['2026-09-25','lecture','§2.1 Elementary derivative rules'],
    ['2026-09-28','lecture','§2.2 Sine and cosine'],
    ['2026-09-29','lab','Lab 5 · Linearization'],
    ['2026-09-30','lecture','§2.3 Product and quotient rules'],
    ['2026-10-01','lab','Lab 5 · Linearization'],
    ['2026-10-02','lecture','§2.4 Other trig functions'],
    ['2026-10-05','lecture','§2.5 Chain rule · Inverse functions (Pre 3)'],
    ['2026-10-06','lab','Lab 6 · Derivatives and applications'],
    ['2026-10-07','lecture','§2.5 More derivative ideas'],
    ['2026-10-08','lab','Lab 6 · Derivatives and applications'],
    ['2026-10-09','lecture','§2.6 Derivatives of inverse functions'],
    ['2026-10-12','lecture','§2.7 Implicit differentiation'],
    ['2026-10-13','lab','Lab 7 · Derivative practice'],
    ['2026-10-14','lecture','§2.7 Implicit differentiation'],
    ['2026-10-15','lab','Lab 7 · Derivative practice'],
    ['2026-10-16','exam','Exam 2 · through §2.6'],
    ['2026-10-19','lecture','§3.5 Related rates · Algebra (Pre 4)'],
    ['2026-10-20','lab','Lab 8 · Related rates'],
    ['2026-10-21','lecture','§3.5 Related rates'],
    ['2026-10-22','lab','Lab 8 · Related rates'],
    ['2026-10-23','lecture',"§2.8 L'Hôpital's rule"],
    ['2026-10-26','lecture','§2.8 Dominating terms'],
    ['2026-10-27','lab','Lab 9 · Limits at infinity'],
    ['2026-10-28','lecture','§3.1 Local extrema · first derivative'],
    ['2026-10-29','lab','Lab 9 · Limits at infinity'],
    ['2026-10-30','lecture','§3.1 Local extrema · second derivative'],
    ['2026-11-02','lecture','§3.3 Global optimization'],
    ['2026-11-03','lab','Lab 10 · Graphing ideas'],
    ['2026-11-04','lecture','§3.4 Applied optimization'],
    ['2026-11-05','lab','Lab 10 · Graphing ideas'],
    ['2026-11-06','exam','Exam 3 · through §3.1, §3.5'],
    ['2026-11-09','lecture','§3.4 Applied optimization'],
    ['2026-11-10','lab','Lab 11 · Optimization'],
    ['2026-11-11','holiday',"Veterans Day · no class"],
    ['2026-11-12','lab','Lab 11 · Optimization'],
    ['2026-11-13','lecture','§4.1 Distance traveled'],
    ['2026-11-16','lecture','§4.2 Riemann sums'],
    ['2026-11-17','lab','Lab 12 · Area estimation'],
    ['2026-11-18','admin','Last day to drop with a W'],
    ['2026-11-18','lecture','§4.3 The definite integral'],
    ['2026-11-19','lab','Lab 12 · Area estimation'],
    ['2026-11-20','lecture','§4.4 First FTC · total change'],
    ['2026-11-23','holiday','Fall recess · no class'],
    ['2026-11-24','holiday','Fall recess · no class'],
    ['2026-11-25','holiday','Fall recess · no lab'],
    ['2026-11-26','holiday','Fall recess · no class'],
    ['2026-11-27','holiday','Fall recess · no lab'],
    ['2026-11-30','lecture','§5.1 Graphing antiderivatives'],
    ['2026-12-01','lab','Lab 13 · Total change'],
    ['2026-12-02','lecture','§5.1 Indefinite integrals'],
    ['2026-12-03','lab','Lab 13 · Total change'],
    ['2026-12-04','lecture','§5.2 Second FTC'],
    ['2026-12-07','lecture','§5.2 Second FTC'],
    ['2026-12-08','lab','Lab 14 · Semester review'],
    ['2026-12-09','exam','Exam 4 · through §5.2'],
    ['2026-12-10','lab','Lab 14 · Semester review'],
    ['2026-12-11','review','Review'],
    ['2026-12-14','exam','Finals week · cumulative final (day/time TBD)'],
    ['2026-12-15','exam','Finals week'],
    ['2026-12-16','exam','Finals week'],
    ['2026-12-17','exam','Finals week'],
    ['2026-12-18','exam','Finals week']
  ];
  const SEMESTER = { start: '2026-08-24', end: '2026-12-18' };

  /* ---------- Units ---------- */
  const UNITS = [
    { n: 1, title: 'Understanding the derivative', sections: ['1.1','1.2','1.3','1.4','1.5','1.6'], exam: 'exam1' },
    { n: 2, title: 'Computing derivatives', sections: ['1.7','1.8','2.1','2.2','2.3','2.4','2.5','2.6'], exam: 'exam2' },
    { n: 3, title: 'Implicit, limits & extrema', sections: ['2.7','3.5','2.8','3.1'], exam: 'exam3' },
    { n: 4, title: 'Optimization & the integral', sections: ['3.3','3.4','4.1','4.2','4.3','4.4','5.1','5.2'], exam: 'exam4' }
  ];

  /* ---------- Section notes ----------
     Each: id, title, unit, slug (Active Calculus page), ideas[], formulas[{n,t}],
     example{p,s}, pitfalls[], tip */
  const SECTIONS = [
    {
      id: '1.1', title: 'How do we measure velocity?', unit: 1, slug: 'sec-1-1-velocity.html',
      ideas: [
        R`A position function $s(t)$ tells where an object is at time $t$. <b>Average velocity</b> over $[a,b]$ is the change in position divided by the change in time, which is the slope of the <b>secant line</b> through $(a,s(a))$ and $(b,s(b))$.`,
        R`<b>Instantaneous velocity</b> at $t=a$ is what average velocity approaches as the interval $[a,a+h]$ shrinks ($h\to0$). Numerically: compute $AV_{[a,a+h]}$ for smaller and smaller $h$ on both sides of $a$.`,
        R`Units of a rate are always $\dfrac{\text{units of output}}{\text{units of input}}$, e.g. feet per second, dollars per year, mg per hour.`,
        R`On a graph: average rate $=$ slope of a secant; instantaneous rate $=$ slope of the tangent.`
      ],
      formulas: [
        { n: 'Average velocity', t: R`AV_{[a,b]} = \frac{s(b)-s(a)}{b-a}` },
        { n: 'Interval of width h', t: R`AV_{[a,a+h]} = \frac{s(a+h)-s(a)}{h}` }
      ],
      example: {
        p: R`A ball's height is $s(t) = 64 - 16(t-1)^2$ feet, $t$ in seconds. Find $AV_{[0.5,\,1]}$ and estimate the instantaneous velocity at $t=1$.`,
        s: R`$s(1)=64$ and $s(0.5)=64-16(0.25)=60$, so $AV_{[0.5,1]} = \frac{64-60}{1-0.5} = 8$ ft/s. For $t=1$: $AV_{[1,1+h]} = \frac{64-16h^2-64}{h} = -16h \to 0$ as $h\to0$. The instantaneous velocity at $t=1$ is $0$ ft/s (the peak of the flight).`
      },
      pitfalls: [
        'Forgetting units, or writing "per" backwards (seconds per foot).',
        'Reporting average speed (always ≥ 0) when the question asks for velocity (can be negative).',
        R`Writing $AV_{[a,b]}$ as $s(b)-s(a)$ without dividing by $b-a$.`
      ],
      tip: R`Always label your answer with proper notation, e.g. $AV_{[40,50]} = 0.3$ mi/min. The rubric rewards notation and explanation, not just the number.`
    },
    {
      id: '1.2', title: 'The notion of limit', unit: 1, slug: 'sec-1-2-lim.html',
      ideas: [
        R`$\displaystyle\lim_{x\to a} f(x) = L$ means $f(x)$ can be made as close to $L$ as we like by taking $x$ close enough to $a$ (but $x\neq a$). The value $f(a)$ is irrelevant: it may not exist, or may differ from $L$.`,
        R`The limit exists exactly when the left-hand limit $\lim_{x\to a^-}f(x)$ and right-hand limit $\lim_{x\to a^+}f(x)$ both exist and are equal.`,
        R`<b>Three kinds of "plug-in" outcomes.</b> If substituting gives $\frac{c}{d}$ with $d\neq0$: that is the limit (a <em>valid answer</em>). If it gives $\frac{c}{0}$ with $c\neq0$: <em>vertical asymptote</em>, the limit does not exist (it blows up to $\pm\infty$). If it gives $\frac{0}{0}$: <em>indeterminate form</em>, do more algebra.`,
        R`Algebra tools for $\frac00$: factor and cancel; multiply by a conjugate; combine fractions with a common denominator.`,
        R`Estimate limits from a table (approach from both sides) or a graph (follow the curve toward $x=a$ from each side).`
      ],
      formulas: [
        { n: 'Two-sided limit', t: R`\lim_{x\to a} f(x) = L \iff \lim_{x\to a^-} f(x) = \lim_{x\to a^+} f(x) = L` },
        { n: 'Factor and cancel', t: R`\lim_{x\to 2}\frac{x^2+3x-10}{x-2} = \lim_{x\to 2}\frac{(x+5)(x-2)}{x-2} = 7` },
        { n: 'Conjugate', t: R`\lim_{x\to 2}\frac{\sqrt{x+7}-3}{x-2} = \lim_{x\to 2}\frac{1}{\sqrt{x+7}+3} = \frac16` },
        { n: 'Common denominator', t: R`\lim_{x\to 4}\frac{\frac1x-\frac14}{x-4} = \lim_{x\to 4}\frac{-1}{4x} = -\frac1{16}` }
      ],
      example: {
        p: R`Classify the form and evaluate: (a) $\lim_{x\to0}\frac{x+4}{x}$, (b) $\lim_{x\to0}\frac{\sin x}{\cos x}$, (c) $\lim_{x\to1}\frac{x^2-1}{x-1}$.`,
        s: R`(a) Substituting gives $\frac40$: vertical asymptote, the limit does not exist. (b) Gives $\frac01 = 0$: a valid answer, the limit is $0$. (c) Gives $\frac00$: indeterminate. Factor: $\frac{(x-1)(x+1)}{x-1} = x+1 \to 2$.`
      },
      pitfalls: [
        R`Saying "$\frac00 = 0$" or "$\frac00$ is undefined so the limit does not exist." $\frac00$ means <em>keep working</em>.`,
        R`Confusing $\lim_{x\to a}f(x)$ with $f(a)$. A hole in the graph still has a limit.`,
        'Only checking one side of a piecewise function.'
      ],
      tip: R`On the exam, name the form first ("this is $\frac00$, indeterminate"), then show the algebra. Naming the form earns rubric points even if the algebra slips.`
    },
    {
      id: '1.3', title: 'The derivative of a function at a point', unit: 1, slug: 'sec-1-3-deriv-pt.html',
      ideas: [
        R`The derivative of $f$ at $x=a$ is the limit of average rates of change over $[a,a+h]$ as $h\to0$. It is the <b>slope of the tangent line</b> at $(a,f(a))$ and the <b>instantaneous rate of change</b> of $f$ at $a$.`,
        R`Equivalent form: $f'(a) = \lim_{x\to a}\dfrac{f(x)-f(a)}{x-a}$.`,
        R`Graphically, estimate $f'(a)$ by drawing the tangent line at $(a,f(a))$ and reading its rise over run.`,
        R`Working the limit definition always follows the same rhythm: write $f(a+h)$, subtract $f(a)$, simplify until every remaining term has a factor of $h$, cancel the $h$, then let $h\to0$.`
      ],
      formulas: [
        { n: 'Limit definition', t: R`f'(a) = \lim_{h\to0}\frac{f(a+h)-f(a)}{h}` },
        { n: 'Alternate form', t: R`f'(a) = \lim_{x\to a}\frac{f(x)-f(a)}{x-a}` },
        { n: 'Tangent line at a', t: R`y = f(a) + f'(a)(x-a)` }
      ],
      example: {
        p: R`Use the limit definition to find $f'(1)$ for $f(x) = \sqrt{2x-1}$.`,
        s: R`$f'(1) = \lim_{h\to0}\dfrac{\sqrt{2(1+h)-1}-1}{h} = \lim_{h\to0}\dfrac{\sqrt{1+2h}-1}{h}$. Multiply by the conjugate: $\dfrac{(1+2h)-1}{h(\sqrt{1+2h}+1)} = \dfrac{2}{\sqrt{1+2h}+1} \to \dfrac{2}{2} = 1$. So $f'(1)=1$.`
      },
      pitfalls: [
        R`Expanding $(a+h)^2$ as $a^2+h^2$. It is $a^2+2ah+h^2$.`,
        R`Dropping "$\lim_{h\to0}$" from lines where the limit has not been taken yet, or leaving it after $h$ is gone.`,
        R`Plugging $h=0$ before cancelling (gives $\frac00$).`
      ],
      tip: R`Write "$\lim_{h\to0}$" on every line until you cancel the $h$, then evaluate. Graders look for it.`
    },
    {
      id: '1.4', title: 'The derivative function', unit: 1, slug: 'sec-1-4-deriv-fn.html',
      ideas: [
        R`Letting the point vary gives a new function $f'(x)$, the <b>derivative function</b>: $f'(x) = \lim_{h\to0}\frac{f(x+h)-f(x)}{h}$.`,
        R`Reading $f'$ from the graph of $f$: where $f$ rises, $f'>0$; where $f$ falls, $f'<0$; at a peak or valley (smooth), $f'=0$; at a corner or cusp, $f'$ is undefined; steeper $f$ means larger $|f'|$.`,
        R`Sketching $f'$: mark the zeros first (where $f$ has horizontal tangents), decide the sign on each interval, then estimate steepness.`,
        R`Notation: $f'(x)$, $\dfrac{dy}{dx}$, $\dfrac{d}{dx}[f(x)]$, $y'$.`
      ],
      formulas: [
        { n: 'Derivative function', t: R`f'(x) = \lim_{h\to0}\frac{f(x+h)-f(x)}{h}` }
      ],
      example: {
        p: R`Find $r'(x)$ for $r(x) = 11 - 5x - 3x^2$ using the definition.`,
        s: R`$r(x+h) = 11 - 5x - 5h - 3x^2 - 6xh - 3h^2$. Subtract $r(x)$: $-5h - 6xh - 3h^2$. Divide by $h$: $-5 - 6x - 3h$. Let $h\to0$: $r'(x) = -5 - 6x$.`
      },
      pitfalls: [
        R`Sketching $f'$ as a shifted copy of $f$. The graph of $f'$ records <em>slopes</em>, not heights.`,
        R`Forgetting that $f'$ is undefined at sharp corners, e.g. $|x|$ at $x=0$.`
      ],
      tip: R`A helpful sentence to use: "Since $f$ is increasing on $(a,b)$, $f'(x)>0$ there." Connecting words like this are what the rubric calls explaining your thinking.`
    },
    {
      id: '1.5', title: 'Interpreting, estimating, and using the derivative', unit: 1, slug: 'sec-1-5-interp-deriv.html',
      ideas: [
        R`<b>Units:</b> $f'(a)$ has units of $f$ per unit of $x$. If $M(t)$ is mg at $t$ hours, $M'(t)$ is mg per hour.`,
        R`<b>The interpretation sentence.</b> "$f'(a)=c$" means: when the input is $a$ (units), the output is changing at a rate of $c$ (units of $f$ per unit of $x$). Include: the input value with units, the direction (increasing/decreasing), the rate with units.`,
        R`<b>Estimating from data:</b> use a difference quotient. Central difference (averaging both neighbors) is usually the best estimate when data on both sides is available.`,
        R`<b>Using the derivative:</b> for small $h$, $f(a+h)\approx f(a) + f'(a)\,h$ (a step along the tangent line).`
      ],
      formulas: [
        { n: 'Forward difference', t: R`f'(a) \approx \frac{f(a+h)-f(a)}{h}` },
        { n: 'Backward difference', t: R`f'(a) \approx \frac{f(a)-f(a-h)}{h}` },
        { n: 'Central difference', t: R`f'(a) \approx \frac{f(a+h)-f(a-h)}{2h}` },
        { n: 'Tangent step', t: R`f(a+h) \approx f(a) + f'(a)\,h` }
      ],
      example: {
        p: R`$W=f(c)$ is weight (lb) as a function of daily Calories $c$. Given $f(1600)=165$, $f(1700)=177$, $f(1800)=190$, estimate $f'(1700)$ three ways and interpret $f'(1500)=5$.`,
        s: R`Forward: $\frac{190-177}{100} = 0.13$. Backward: $\frac{177-165}{100} = 0.12$. Central: $\frac{190-165}{200} = 0.125$ lb per (Calorie/day). Interpretation of $f'(1500)=5$: when a person eats 1500 Calories per day, each additional Calorie per day raises their weight by about 5 pounds.`
      },
      pitfalls: [
        'Leaving units off the rate, or off the input value.',
        R`Reporting a central difference as $\frac{f(a+h)-f(a-h)}{h}$ (forgetting the $2$).`,
        'Describing the function value instead of the rate ("the weight is 5 pounds").'
      ],
      tip: R`Template: "At $x = a$ [units], $f$ is [increasing/decreasing] at a rate of $|c|$ [output units] per [input unit]."`
    },
    {
      id: '1.6', title: 'The second derivative', unit: 1, slug: 'sec-1-6-second-d.html',
      ideas: [
        R`$f''$ is the derivative of $f'$: it measures how the <em>rate of change</em> is changing. In motion, $s'$ is velocity and $s''$ is acceleration.`,
        R`$f'>0$: $f$ increasing. $f'<0$: $f$ decreasing. $f''>0$: $f'$ increasing, so $f$ is <b>concave up</b> (bends like $\cup$). $f''<0$: $f$ is <b>concave down</b> ($\cap$). An <b>inflection point</b> is where concavity changes.`,
        R`Language: "increasing at an increasing rate" means $f'>0$ and $f''>0$; "decreasing at a decreasing rate" (decreasing more slowly) means $f'<0$ and $f''>0$.`,
        R`From a graph of $f'$: $f$ is increasing where $f'$ is above the axis; $f$ is concave up where $f'$ is <em>rising</em>.`
      ],
      formulas: [
        { n: 'Second derivative', t: R`f''(x) = \frac{d}{dx}\big[f'(x)\big] = \frac{d^2y}{dx^2}` },
        { n: 'Concavity', t: R`f''>0 \Rightarrow \text{concave up},\qquad f''<0 \Rightarrow \text{concave down}` }
      ],
      example: {
        p: R`A car's value $V(m)$ in dollars after $m$ miles satisfies $V(25000)=23525$, $V'(25000)=-0.61$, $V''(25000)=0.017$. Explain in everyday language.`,
        s: R`After 25,000 miles the car is worth \$23,525. At that moment its value is dropping about 61 cents for each additional mile. Because $V''>0$, the rate of loss ($-0.61$ dollars/mile) is itself increasing (getting less negative): the car is still losing value, but more slowly with each mile, at a rate of $0.017$ dollars per mile per mile.`
      },
      pitfalls: [
        R`Treating $f''>0$ as "$f$ is increasing." It says $f'$ is increasing.`,
        R`Calling a point an inflection point when $f''=0$ but concavity does not change (e.g. $x^4$ at $0$).`,
        'Mixing up "decreasing at an increasing rate" (dropping faster) with "decreasing at a decreasing rate" (levelling off).'
      ],
      tip: R`Fill a sign chart with three rows ($f$, $f'$, $f''$) before writing sentences. Exam 1 practice problem 22 is exactly this.`
    },
    {
      id: '1.7', title: 'Limits, continuity, and differentiability', unit: 2, slug: 'sec-1-7-lim-cont-diff.html',
      ideas: [
        R`$f$ is <b>continuous at $a$</b> when three things hold: $f(a)$ is defined, $\lim_{x\to a}f(x)$ exists, and they are equal. Informally: no hole, no jump, no vertical asymptote at $a$.`,
        R`Discontinuities: removable (hole), jump (one-sided limits differ), infinite (vertical asymptote).`,
        R`$f$ is <b>differentiable at $a$</b> when $f'(a)$ exists (the difference-quotient limit). Not differentiable at a corner, a cusp, a vertical tangent, or any discontinuity.`,
        R`<b>Differentiable $\Rightarrow$ continuous.</b> The converse is false: $|x|$ is continuous but not differentiable at $0$.`,
        R`To make a piecewise function continuous at the break, set the two one-sided limits equal and solve for the unknown constant.`
      ],
      formulas: [
        { n: 'Continuity at a', t: R`\lim_{x\to a} f(x) = f(a)` },
        { n: 'Implication', t: R`\text{differentiable at } a \;\Longrightarrow\; \text{continuous at } a` }
      ],
      example: {
        p: R`Find $k$ so that $f(x)=\begin{cases} x^2 + k & x<2 \\ 3x - 1 & x\ge 2\end{cases}$ is continuous at $x=2$.`,
        s: R`Left limit: $4 + k$. Right limit and value: $3(2)-1 = 5$. Continuity needs $4+k=5$, so $k=1$.`
      },
      pitfalls: [
        'Claiming continuous implies differentiable.',
        R`Checking only that the limit exists, without comparing it to $f(a)$.`
      ],
      tip: 'When asked "is f differentiable at a?", first check continuity; if it fails, you are done.'
    },
    {
      id: '1.8', title: 'The tangent line approximation', unit: 2, slug: 'sec-1-8-tan-line-approx.html',
      ideas: [
        R`The <b>tangent line</b> (linearization) at $a$ is $L(x) = f(a) + f'(a)(x-a)$. Near $a$, $f(x)\approx L(x)$ because differentiable functions are <em>locally linear</em>.`,
        R`Concavity tells you the error's sign: if $f$ is concave up near $a$, the tangent line lies <em>below</em> the curve, so $L(x)$ <b>underestimates</b> $f(x)$. Concave down: overestimate.`,
        R`Farther from $a$ means a worse approximation.`
      ],
      formulas: [
        { n: 'Linearization', t: R`L(x) = f(a) + f'(a)(x-a)` },
        { n: 'Estimate', t: R`f(a+h) \approx f(a) + f'(a)\,h` }
      ],
      example: {
        p: R`Given $g(4)=2$, $g'(4)=0.25$ and $g''(x)<0$ for all $x$, estimate $g(4.4)$ and say whether it is an over- or underestimate.`,
        s: R`$L(4.4) = 2 + 0.25(0.4) = 2.1$. Since $g$ is concave down, the tangent line lies above the curve, so $2.1$ is an <b>overestimate</b>.`
      },
      pitfalls: [
        R`Using $f'(x)$ (a function) in the tangent line instead of the number $f'(a)$.`,
        'Forgetting to state over/underestimate when concavity is given: it is usually part of the question.'
      ],
      tip: R`Lab 5 is linearization. Practice writing $L(x)$ and evaluating it at a nearby point with a clean sentence about the error.`
    },
    {
      id: '2.1', title: 'Elementary derivative rules', unit: 2, slug: 'sec-2-1-elem-rules.html',
      ideas: [
        R`Constant, power, constant-multiple and sum/difference rules let you differentiate any polynomial term by term. The power rule works for <em>any</em> real exponent, so rewrite roots and reciprocals as powers first: $\sqrt{x}=x^{1/2}$, $\frac1{x^3} = x^{-3}$.`,
        R`Exponentials: $\frac{d}{dx}[e^x]=e^x$ and $\frac{d}{dx}[a^x] = a^x\ln a$. Note $e^x$ is its own derivative; $x^e$ uses the power rule.`,
        R`Derivatives of sums are sums of derivatives, but derivatives of products are <em>not</em> products of derivatives (see §2.3).`
      ],
      formulas: [
        { n: 'Power rule', t: R`\frac{d}{dx}\big[x^n\big] = n\,x^{n-1}` },
        { n: 'Constant / constant multiple', t: R`\frac{d}{dx}[c] = 0,\qquad \frac{d}{dx}[c\,f(x)] = c\,f'(x)` },
        { n: 'Sum / difference', t: R`\frac{d}{dx}[f\pm g] = f' \pm g'` },
        { n: 'Exponentials', t: R`\frac{d}{dx}[e^x] = e^x,\qquad \frac{d}{dx}[a^x] = a^x\ln a` }
      ],
      example: {
        p: R`Differentiate $f(x) = 4x^5 - \dfrac{3}{x^2} + 6\sqrt{x} - 2^x + 7$.`,
        s: R`Rewrite: $4x^5 - 3x^{-2} + 6x^{1/2} - 2^x + 7$. Then $f'(x) = 20x^4 + 6x^{-3} + 3x^{-1/2} - 2^x\ln 2$.`
      },
      pitfalls: [
        R`$\frac{d}{dx}[2^x] = x\,2^{x-1}$ is wrong; the base is constant, so the answer is $2^x\ln2$.`,
        R`Forgetting the derivative of a constant is $0$ (not the constant).`
      ],
      tip: 'Rewrite before you differentiate. Every fraction with x in the denominator and every root becomes a power.'
    },
    {
      id: '2.2', title: 'Sine and cosine', unit: 2, slug: 'sec-2-2-sin-cos.html',
      ideas: [
        R`$\frac{d}{dx}[\sin x] = \cos x$ and $\frac{d}{dx}[\cos x] = -\sin x$. These are true when $x$ is in <b>radians</b>.`,
        R`Remember the cycle: $\sin \to \cos \to -\sin \to -\cos \to \sin$.`,
        R`Know the unit-circle values at $0,\ \frac\pi6,\ \frac\pi4,\ \frac\pi3,\ \frac\pi2,\ \pi$ so you can evaluate $f'$ at specific points without a calculator.`
      ],
      formulas: [
        { n: 'Sine and cosine', t: R`\frac{d}{dx}[\sin x] = \cos x,\qquad \frac{d}{dx}[\cos x] = -\sin x` }
      ],
      example: {
        p: R`Find the tangent line to $f(x) = 3\sin x - 2\cos x$ at $x = 0$.`,
        s: R`$f(0) = -2$, $f'(x) = 3\cos x + 2\sin x$, $f'(0) = 3$. Tangent line: $y = -2 + 3x$.`
      },
      pitfalls: [
        R`Sign error on $\frac{d}{dx}[\cos x]$.`,
        'Using degrees. All calculus with trig functions is in radians.'
      ],
      tip: R`Sketch the unit circle in the margin on exam day: it is faster than trying to recall $\cos\frac{2\pi}{3}$ from memory.`
    },
    {
      id: '2.3', title: 'Product and quotient rules', unit: 2, slug: 'sec-2-3-prod-quot.html',
      ideas: [
        R`<b>Product rule:</b> derivative of the first times the second, plus the first times derivative of the second.`,
        R`<b>Quotient rule:</b> "low d-high minus high d-low, over the square of what's below." The order in the numerator matters.`,
        R`If a quotient has a constant denominator, or the numerator is a constant times a power, simplify first: $\frac{x^3}{5} = \frac15 x^3$, $\frac{4}{x^2} = 4x^{-2}$.`
      ],
      formulas: [
        { n: 'Product rule', t: R`\frac{d}{dx}[f\,g] = f'g + f g'` },
        { n: 'Quotient rule', t: R`\frac{d}{dx}\left[\frac{f}{g}\right] = \frac{f'g - f g'}{g^2}` }
      ],
      example: {
        p: R`Differentiate $h(x) = \dfrac{x^2 e^x}{\sin x}$ and $p(t) = t^3\cos t$.`,
        s: R`$p'(t) = 3t^2\cos t - t^3\sin t$. For $h$, let the numerator be $N = x^2e^x$ with $N' = 2xe^x + x^2e^x$ (product rule). Then $h'(x) = \dfrac{(2xe^x + x^2e^x)\sin x - x^2e^x\cos x}{\sin^2 x}$.`
      },
      pitfalls: [
        R`Writing $(fg)' = f'g'$.`,
        'Swapping the order in the quotient rule numerator (sign error).'
      ],
      tip: 'Label f, f′, g, g′ in the margin before assembling the rule. It prevents almost every order mistake.'
    },
    {
      id: '2.4', title: 'Derivatives of other trigonometric functions', unit: 2, slug: 'sec-2-4-other-trig.html',
      ideas: [
        R`All four come from the quotient rule applied to $\tan x = \frac{\sin x}{\cos x}$, $\cot x = \frac{\cos x}{\sin x}$, $\sec x = \frac1{\cos x}$, $\csc x = \frac1{\sin x}$.`,
        R`Pattern: every "co" function has a negative derivative.`
      ],
      formulas: [
        { n: 'tan / cot', t: R`\frac{d}{dx}[\tan x] = \sec^2 x,\qquad \frac{d}{dx}[\cot x] = -\csc^2 x` },
        { n: 'sec / csc', t: R`\frac{d}{dx}[\sec x] = \sec x\tan x,\qquad \frac{d}{dx}[\csc x] = -\csc x\cot x` }
      ],
      example: {
        p: R`Find $f'(x)$ for $f(x) = x\tan x + 5\sec x$.`,
        s: R`$f'(x) = \tan x + x\sec^2 x + 5\sec x\tan x$.`
      },
      pitfalls: [ R`Writing $\frac{d}{dx}[\tan x] = \sec x$ (missing the square).` ],
      tip: R`If you blank on one of these, rederive it from the quotient rule in two lines; e.g. $\frac{d}{dx}\frac{\sin x}{\cos x} = \frac{\cos^2x + \sin^2x}{\cos^2x} = \sec^2x$.`
    },
    {
      id: '2.5', title: 'The chain rule', unit: 2, slug: 'sec-2-5-chain.html',
      ideas: [
        R`For a composite $f(g(x))$: differentiate the <em>outside</em> function, evaluate it at the <em>inside</em>, then multiply by the derivative of the inside.`,
        R`Spot the inside function: anything "wrapped" in a power, root, exponential, log or trig function. $e^{3x^2}$ has inside $3x^2$; $(x^2+1)^5$ has inside $x^2+1$; $\sin(\cos x)$ has inside $\cos x$.`,
        R`Chain rule combines with every other rule: $\frac{d}{dx}[x^2 e^{5x}] = 2xe^{5x} + 5x^2e^{5x}$ (product rule with a chain inside).`
      ],
      formulas: [
        { n: 'Chain rule', t: R`\frac{d}{dx}\big[f(g(x))\big] = f'(g(x))\,g'(x)` },
        { n: 'Leibniz form', t: R`\frac{dy}{dx} = \frac{dy}{du}\cdot\frac{du}{dx}` },
        { n: 'Common shapes', t: R`\frac{d}{dx}[e^{kx}] = ke^{kx},\quad \frac{d}{dx}[\sin(kx)] = k\cos(kx),\quad \frac{d}{dx}[(u)^n] = n u^{n-1}u'` }
      ],
      example: {
        p: R`Differentiate $g(x) = \sin(3x^2)$ and $h(x) = (2x^3 - 5)^4$.`,
        s: R`$g'(x) = \cos(3x^2)\cdot 6x = 6x\cos(3x^2)$. $h'(x) = 4(2x^3-5)^3\cdot 6x^2 = 24x^2(2x^3-5)^3$.`
      },
      pitfalls: [
        'Forgetting to multiply by the inside derivative (the most common calculus error).',
        R`Differentiating the inside "in place": $\frac{d}{dx}[\sin(3x^2)] \ne \sin(6x)$.`
      ],
      tip: 'Say it out loud as you write: "derivative of the outside, inside unchanged, times derivative of the inside."'
    },
    {
      id: '2.6', title: 'Derivatives of inverse functions', unit: 2, slug: 'sec-2-6-inverse.html',
      ideas: [
        R`If $f$ has inverse $f^{-1}$, then $(f^{-1})'(x) = \dfrac{1}{f'\big(f^{-1}(x)\big)}$. The slope of the inverse at $(b,a)$ is the reciprocal of the slope of $f$ at $(a,b)$.`,
        R`This produces the derivatives of $\ln x$ (inverse of $e^x$), $\log_b x$, $\arcsin x$, $\arctan x$, $\arccos x$.`,
        R`With the chain rule: $\frac{d}{dx}[\ln(u)] = \frac{u'}{u}$, $\frac{d}{dx}[\arctan(u)] = \frac{u'}{1+u^2}$.`
      ],
      formulas: [
        { n: 'Inverse function rule', t: R`\big(f^{-1}\big)'(x) = \frac{1}{f'\!\left(f^{-1}(x)\right)}` },
        { n: 'Logarithms', t: R`\frac{d}{dx}[\ln x] = \frac1x,\qquad \frac{d}{dx}[\log_b x] = \frac{1}{x\ln b}` },
        { n: 'Inverse trig', t: R`\frac{d}{dx}[\arcsin x] = \frac{1}{\sqrt{1-x^2}},\quad \frac{d}{dx}[\arctan x] = \frac{1}{1+x^2},\quad \frac{d}{dx}[\arccos x] = -\frac{1}{\sqrt{1-x^2}}` }
      ],
      example: {
        p: R`Given $f(2) = 5$ and $f'(2) = 3$, find $(f^{-1})'(5)$. Also differentiate $y = \ln(x^2+1)$.`,
        s: R`$(f^{-1})'(5) = \dfrac{1}{f'(f^{-1}(5))} = \dfrac{1}{f'(2)} = \dfrac13$. For $y$: $y' = \dfrac{2x}{x^2+1}$.`
      },
      pitfalls: [
        R`Computing $(f^{-1})'(5)$ as $1/f'(5)$; you must evaluate $f'$ at $f^{-1}(5)$, not at $5$.`,
        R`Writing $\frac{d}{dx}[\ln(x^2+1)] = \frac{1}{x^2+1}$ without the chain factor $2x$.`
      ],
      tip: R`Think of $\ln$ as "the exponent": $\ln(x^2+1)$ asks what power of $e$ gives $x^2+1$, so its derivative is inside$'$ over inside.`
    },
    {
      id: '2.7', title: 'Implicit differentiation', unit: 3, slug: 'sec-2-7-implicit.html',
      ideas: [
        R`When $y$ is defined by an equation like $x^2 + y^2 = 25$ rather than a formula $y = f(x)$, differentiate both sides with respect to $x$, treating $y$ as a function of $x$: every $y$-term picks up a factor $\frac{dy}{dx}$ by the chain rule.`,
        R`Then collect the $\frac{dy}{dx}$ terms on one side and solve. The answer usually involves both $x$ and $y$; to find a slope at a point, substitute both coordinates.`,
        R`Product terms like $xy$ need the product rule: $\frac{d}{dx}[xy] = y + x\frac{dy}{dx}$.`
      ],
      formulas: [
        { n: 'Chain on y', t: R`\frac{d}{dx}\big[y^n\big] = n y^{n-1}\frac{dy}{dx}` },
        { n: 'Circle', t: R`x^2+y^2=r^2 \;\Rightarrow\; \frac{dy}{dx} = -\frac{x}{y}` }
      ],
      example: {
        p: R`Find the slope of $x^3 + y^3 = 9$ at $(1,2)$.`,
        s: R`$3x^2 + 3y^2 y' = 0 \Rightarrow y' = -\dfrac{x^2}{y^2}$. At $(1,2)$: $y' = -\dfrac14$.`
      },
      pitfalls: [
        R`Forgetting $\frac{dy}{dx}$ on $y$-terms.`,
        'Substituting the point before solving for y′ in the wrong spot, or substituting only x.'
      ],
      tip: 'Box every dy/dx as you produce it so none go missing when you collect terms.'
    },
    {
      id: '2.8', title: "L'Hôpital's rule and limits at infinity", unit: 3, slug: 'sec-2-8-lhopital.html',
      ideas: [
        R`<b>L'Hôpital:</b> if $\lim \frac{f(x)}{g(x)}$ has the form $\frac00$ or $\frac{\infty}{\infty}$, then it equals $\lim\frac{f'(x)}{g'(x)}$ (when that limit exists). Differentiate top and bottom <em>separately</em>, not with the quotient rule. Always verify the form first.`,
        R`<b>Limits at infinity</b> describe end behaviour and horizontal asymptotes. For rational functions compare degrees: numerator lower $\to 0$; equal $\to$ ratio of leading coefficients; numerator higher $\to \pm\infty$.`,
        R`<b>Dominating terms:</b> as $x\to\infty$, exponentials $e^{x}$ beat powers $x^n$, which beat logarithms $\ln x$. E.g. $\frac{x^{100}}{e^x}\to0$ and $\frac{\ln x}{\sqrt x}\to0$.`
      ],
      formulas: [
        { n: "L'Hôpital's rule", t: R`\lim_{x\to a}\frac{f(x)}{g(x)} = \lim_{x\to a}\frac{f'(x)}{g'(x)}\quad\text{for forms } \tfrac00,\ \tfrac\infty\infty` },
        { n: 'Rational end behaviour', t: R`\lim_{x\to\infty}\frac{3x^2 - x}{5x^2 + 4} = \frac35` },
        { n: 'Hierarchy', t: R`\ln x \ll x^p \ll e^{x}\quad (x\to\infty)` }
      ],
      example: {
        p: R`Evaluate $\lim_{x\to0}\dfrac{\sin 5x}{x}$ and $\lim_{x\to\infty}\dfrac{x^2}{e^x}$.`,
        s: R`First: form $\frac00$, so $\lim \frac{5\cos 5x}{1} = 5$. Second: form $\frac\infty\infty$; apply twice: $\lim\frac{2x}{e^x} = \lim\frac{2}{e^x} = 0$ (exponential dominates).`
      },
      pitfalls: [
        R`Applying L'Hôpital to a limit that is not $\frac00$ or $\frac\infty\infty$ (e.g. $\lim_{x\to0}\frac{\cos x}{x}$ is a vertical asymptote, not L'Hôpital).`,
        'Using the quotient rule instead of differentiating numerator and denominator separately.'
      ],
      tip: 'Write the form in words above the equals sign, "(0/0)", each time you apply the rule.'
    },
    {
      id: '3.1', title: 'Using derivatives to identify extreme values', unit: 3, slug: 'sec-3-1-extreme.html',
      ideas: [
        R`A <b>critical number</b> $c$ is a point in the domain where $f'(c)=0$ or $f'(c)$ is undefined. Local extrema of a continuous function can only occur at critical numbers (but not every critical number is an extremum).`,
        R`<b>First derivative test:</b> if $f'$ changes from $+$ to $-$ at $c$, local max; from $-$ to $+$, local min; no sign change, neither.`,
        R`<b>Second derivative test:</b> if $f'(c)=0$ and $f''(c)<0$, local max; $f''(c)>0$, local min; $f''(c)=0$, inconclusive (use the first derivative test).`,
        R`<b>Inflection points</b> occur where $f''$ changes sign (candidates: $f''=0$ or undefined).`
      ],
      formulas: [
        { n: 'Critical numbers', t: R`f'(c) = 0 \;\text{ or }\; f'(c)\ \text{undefined}` },
        { n: 'Second derivative test', t: R`f'(c)=0,\ f''(c)<0 \Rightarrow \text{local max};\qquad f''(c)>0 \Rightarrow \text{local min}` }
      ],
      example: {
        p: R`Classify the critical numbers of $f(x) = 2x^3 - 9x^2 + 12x$.`,
        s: R`$f'(x) = 6x^2 - 18x + 12 = 6(x-1)(x-2)$, critical at $1$ and $2$. Sign chart: $f'>0$ on $(-\infty,1)$, $<0$ on $(1,2)$, $>0$ on $(2,\infty)$. Local max at $x=1$ ($f(1)=5$), local min at $x=2$ ($f(2)=4$). Check: $f''(x) = 12x-18$, $f''(1)=-6<0$, $f''(2)=6>0$.`
      },
      pitfalls: [
        R`Reporting the critical <em>number</em> when the question wants the extreme <em>value</em> $f(c)$, or vice versa.`,
        R`Assuming $f''(c)=0$ means an inflection point without checking for a sign change.`
      ],
      tip: 'A sign chart with test points is the fastest complete answer; it also earns explanation credit.'
    },
    {
      id: '3.3', title: 'Global optimization', unit: 4, slug: 'sec-3-3-global.html',
      ideas: [
        R`<b>Extreme Value Theorem:</b> a continuous function on a closed interval $[a,b]$ attains an absolute maximum and minimum.`,
        R`<b>Closed interval method:</b> find critical numbers in $(a,b)$, evaluate $f$ at those and at the endpoints $a$, $b$; the largest value is the absolute max, the smallest the absolute min.`,
        R`On an open or infinite interval, use the shape of $f$ (sign of $f'$, limits at the ends) instead: a single critical number where $f'$ changes from $-$ to $+$ is a global min.`
      ],
      formulas: [
        { n: 'Candidates', t: R`\{a,\ b\}\ \cup\ \{c\in(a,b): f'(c)=0 \text{ or undefined}\}` }
      ],
      example: {
        p: R`Find the absolute extremes of $f(x) = x^3 - 3x$ on $[0,3]$.`,
        s: R`$f'(x) = 3x^2-3 = 0 \Rightarrow x = \pm1$; only $x=1$ is inside. $f(0)=0$, $f(1)=-2$, $f(3)=18$. Absolute max $18$ at $x=3$, absolute min $-2$ at $x=1$.`
      },
      pitfalls: [ 'Forgetting the endpoints.', 'Including critical numbers that lie outside the interval.' ],
      tip: 'Make a three-column table: candidate x, f(x), and why it is a candidate.'
    },
    {
      id: '3.4', title: 'Applied optimization', unit: 4, slug: 'sec-3-4-optimization.html',
      ideas: [
        R`Procedure: draw a picture and name variables; write the quantity to optimize (objective); write the constraint; use the constraint to make the objective a function of <em>one</em> variable; state the domain; find critical numbers; check endpoints or use a derivative test; answer the actual question with units.`,
        R`Classic set-ups: fencing a rectangle (perimeter constraint, area objective), open box from a sheet (cut corners), minimizing material for a can, shortest distance from a point to a curve.`
      ],
      formulas: [
        { n: 'Rectangle, fixed perimeter P', t: R`A(x) = x\left(\tfrac{P}{2}-x\right),\quad \text{max at } x = \tfrac P4` },
        { n: 'Three-sided fence, length F', t: R`A(x) = x(F-2x),\quad \text{max at } x = \tfrac F4,\ A = \tfrac{F^2}{8}` }
      ],
      example: {
        p: R`A farmer has 200 ft of fence for a rectangular pen against a straight river (no fence on the river side). Maximize the area.`,
        s: R`Let $x$ be the side perpendicular to the river: $2x + y = 200$, so $y = 200-2x$ and $A = x(200-2x) = 200x - 2x^2$ on $0\le x\le100$. $A' = 200 - 4x = 0 \Rightarrow x = 50$, $y = 100$. $A'' = -4 < 0$ so it is a max: $A = 5000$ ft$^2$.`
      },
      pitfalls: [ 'Optimizing the constraint instead of the objective.', 'Not stating the domain, so an endpoint answer gets missed.' ],
      tip: 'The last line of your answer should restate what was asked, with units: "The maximum area is 5000 ft² when the pen is 50 ft by 100 ft."'
    },
    {
      id: '3.5', title: 'Related rates', unit: 3, slug: 'sec-3-5-related-rates.html',
      ideas: [
        R`Several quantities change with time and are linked by an equation. Differentiate that equation with respect to $t$ (implicitly), then substitute the known values and rates to find the unknown rate.`,
        R`Steps: draw and label; list what is known (values and rates $\frac{d\square}{dt}$) and what is wanted; write the relating equation (geometry, Pythagoras, similar triangles, trig); differentiate with respect to $t$; substitute <em>after</em> differentiating; answer with units.`,
        R`Do not plug in a value that changes with time until after you differentiate.`
      ],
      formulas: [
        { n: 'Circle area', t: R`A=\pi r^2 \Rightarrow \frac{dA}{dt} = 2\pi r\frac{dr}{dt}` },
        { n: 'Sphere volume', t: R`V = \tfrac43\pi r^3 \Rightarrow \frac{dV}{dt} = 4\pi r^2\frac{dr}{dt}` },
        { n: 'Ladder / Pythagoras', t: R`x^2+y^2=L^2 \Rightarrow x\frac{dx}{dt} + y\frac{dy}{dt} = 0` }
      ],
      example: {
        p: R`A 10 ft ladder leans on a wall. Its base slides away at 2 ft/s. How fast is the top sliding down when the base is 6 ft from the wall?`,
        s: R`$x^2 + y^2 = 100$, so $2x x' + 2y y' = 0$. When $x=6$, $y=8$: $6(2) + 8y' = 0 \Rightarrow y' = -1.5$ ft/s. The top slides down at $1.5$ ft/s.`
      },
      pitfalls: [ 'Substituting the current length before differentiating (kills the rate).', 'Sign confusion: a decreasing quantity has a negative rate.' ],
      tip: 'Write "want: dy/dt when x = 6" at the top of your work so the goal stays visible.'
    },
    {
      id: '4.1', title: 'Determining distance traveled from velocity', unit: 4, slug: 'sec-4-1-dist.html',
      ideas: [
        R`If velocity $v(t)\ge0$, the distance traveled on $[a,b]$ is the <b>area under</b> the velocity graph. For simple shapes (rectangles, triangles, trapezoids) compute geometrically.`,
        R`When $v$ changes sign, area above the axis counts positive and below counts negative for <em>net</em> change in position; <em>total</em> distance adds the absolute areas.`,
        R`Approximate irregular areas with rectangles: this is the seed of the Riemann sum.`,
        R`Position is an antiderivative of velocity: if $s'=v$ then $s(b) - s(a) = $ net signed area under $v$.`
      ],
      formulas: [
        { n: 'Net change in position', t: R`s(b)-s(a) = \int_a^b v(t)\,dt` },
        { n: 'Total distance', t: R`D = \int_a^b |v(t)|\,dt` }
      ],
      example: {
        p: R`$v(t) = t - 2$ m/s on $[0,4]$. Find the net change in position and the total distance.`,
        s: R`The graph is a line crossing zero at $t=2$: a triangle of area $2$ below the axis and a triangle of area $2$ above. Net change $= -2 + 2 = 0$ m; total distance $= 2 + 2 = 4$ m.`
      },
      pitfalls: [ 'Reporting net change when total distance is asked.' ],
      tip: 'Sketch the velocity graph first; most 4.1 problems are areas of triangles and rectangles.'
    },
    {
      id: '4.2', title: 'Riemann sums', unit: 4, slug: 'sec-4-2-Riemann.html',
      ideas: [
        R`Divide $[a,b]$ into $n$ pieces of width $\Delta x = \frac{b-a}{n}$ with endpoints $x_i = a + i\Delta x$. A Riemann sum adds up rectangle areas $f(x_i^*)\Delta x$ using a chosen sample point in each piece.`,
        R`Left sum $L_n$ uses left endpoints, right sum $R_n$ uses right endpoints, midpoint sum $M_n$ uses midpoints. $M_n$ is usually most accurate.`,
        R`If $f$ is increasing, $L_n$ underestimates and $R_n$ overestimates the area; if decreasing, the reverse.`,
        R`Sigma notation: $\displaystyle\sum_{i=1}^{n} f(x_i)\Delta x$. As $n\to\infty$ all Riemann sums approach the definite integral.`
      ],
      formulas: [
        { n: 'Width', t: R`\Delta x = \frac{b-a}{n},\qquad x_i = a + i\,\Delta x` },
        { n: 'Left / right / midpoint', t: R`L_n = \sum_{i=0}^{n-1} f(x_i)\Delta x,\quad R_n = \sum_{i=1}^{n} f(x_i)\Delta x,\quad M_n = \sum_{i=1}^{n} f\!\left(\tfrac{x_{i-1}+x_i}{2}\right)\Delta x` }
      ],
      example: {
        p: R`Estimate $\int_0^2 x^2\,dx$ with $L_4$ and $R_4$.`,
        s: R`$\Delta x = 0.5$. $L_4 = 0.5\,(0 + 0.25 + 1 + 2.25) = 1.75$. $R_4 = 0.5\,(0.25 + 1 + 2.25 + 4) = 3.75$. The true value $\frac83\approx2.667$ lies between them because $x^2$ is increasing.`
      },
      pitfalls: [ R`Using $n+1$ rectangles (including both endpoints).`, R`Forgetting to multiply by $\Delta x$.` ],
      tip: 'Use the Riemann lab on this site to check your hand computation and see the rectangles.'
    },
    {
      id: '4.3', title: 'The definite integral', unit: 4, slug: 'sec-4-3-def-int.html',
      ideas: [
        R`$\displaystyle\int_a^b f(x)\,dx = \lim_{n\to\infty}\sum_{i=1}^n f(x_i)\Delta x$: the <b>net signed area</b> between the curve and the $x$-axis on $[a,b]$.`,
        R`Properties: linearity, splitting at a point, reversing limits changes the sign, $\int_a^a f = 0$.`,
        R`Average value of $f$ on $[a,b]$ is $\frac{1}{b-a}\int_a^b f(x)\,dx$: the height of the rectangle with the same area.`,
        R`Use geometry (triangles, semicircles) to evaluate integrals of simple graphs exactly.`
      ],
      formulas: [
        { n: 'Properties', t: R`\int_a^b (cf+g) = c\!\int_a^b f + \int_a^b g,\quad \int_a^b f = \int_a^c f + \int_c^b f,\quad \int_b^a f = -\int_a^b f` },
        { n: 'Average value', t: R`f_{\text{avg}} = \frac{1}{b-a}\int_a^b f(x)\,dx` }
      ],
      example: {
        p: R`Given $\int_0^3 f = 4$ and $\int_3^5 f = -1$, find $\int_0^5 2f(x)\,dx$, $\int_5^0 f$, and the average value of $f$ on $[0,5]$.`,
        s: R`$\int_0^5 2f = 2(4 + (-1)) = 6$. $\int_5^0 f = -3$. Average value $= \frac{1}{5}\cdot 3 = 0.6$.`
      },
      pitfalls: [ 'Treating the definite integral as always positive: below the axis counts negative.' ],
      tip: 'Draw the region. Net signed area questions are far easier with a sketch.'
    },
    {
      id: '4.4', title: 'The Fundamental Theorem of Calculus', unit: 4, slug: 'sec-4-4-FTC.html',
      ideas: [
        R`<b>FTC (evaluation):</b> if $F' = f$ on $[a,b]$, then $\int_a^b f(x)\,dx = F(b) - F(a)$. Any antiderivative works; the constant cancels.`,
        R`<b>Total change theorem:</b> $\int_a^b f'(x)\,dx = f(b) - f(a)$: integrating a rate gives the net change in the quantity.`,
        R`You need a table of basic antiderivatives (reverse the derivative rules). Check by differentiating.`
      ],
      formulas: [
        { n: 'FTC', t: R`\int_a^b f(x)\,dx = F(b) - F(a),\quad F' = f` },
        { n: 'Total change', t: R`\int_a^b f'(x)\,dx = f(b) - f(a)` },
        { n: 'Basic antiderivatives', t: R`\int x^n dx = \frac{x^{n+1}}{n+1} + C\ (n\ne-1),\ \int \frac1x dx = \ln|x| + C,\ \int e^x dx = e^x + C,\ \int \cos x\,dx = \sin x + C,\ \int\sin x\,dx = -\cos x + C` }
      ],
      example: {
        p: R`Water enters a tank at $r(t) = 6t + 2$ gal/min. If the tank holds 10 gal at $t=0$, how much is in it at $t=4$?`,
        s: R`Change $= \int_0^4 (6t+2)\,dt = \big[3t^2 + 2t\big]_0^4 = 48 + 8 = 56$ gal. Volume at $t=4$: $10 + 56 = 66$ gal.`
      },
      pitfalls: [ R`Computing $F(a) - F(b)$.`, R`Antidifferentiating $\frac1x$ as $\frac{x^0}{0}$; it is $\ln|x|$.` ],
      tip: 'Always differentiate your antiderivative in your head before evaluating. It takes five seconds and catches most errors.'
    },
    {
      id: '5.1', title: 'Constructing accurate graphs of antiderivatives', unit: 4, slug: 'sec-5-1-graphs.html',
      ideas: [
        R`If $F' = f$, then $F$ is increasing where $f>0$, decreasing where $f<0$, has local extrema where $f$ changes sign, and is concave up where $f$ is increasing.`,
        R`The integral function $F(x) = \int_a^x f(t)\,dt$ is the antiderivative of $f$ with $F(a)=0$; its values are net signed areas.`,
        R`The <b>indefinite integral</b> $\int f(x)\,dx = F(x) + C$ is the whole family of antiderivatives.`
      ],
      formulas: [
        { n: 'Integral function', t: R`F(x) = \int_a^x f(t)\,dt,\qquad F(a)=0,\ F'(x) = f(x)` },
        { n: 'Indefinite integral', t: R`\int f(x)\,dx = F(x) + C` }
      ],
      example: {
        p: R`$f$ is positive on $(0,2)$, zero at $2$, negative on $(2,4)$. Describe $F(x)=\int_0^x f(t)\,dt$ on $[0,4]$.`,
        s: R`$F(0)=0$; $F$ increases on $(0,2)$ to a local (here absolute) maximum at $x=2$, then decreases on $(2,4)$. Its maximum value is the area under $f$ on $[0,2]$.`
      },
      pitfalls: [ 'Forgetting + C on an indefinite integral.', 'Confusing where f is zero (F has extrema) with where f has extrema (F has inflection points).' ],
      tip: 'Graphing F from f is exactly the reverse of graphing f′ from f in §1.4. Same sign chart, read the other way.'
    },
    {
      id: '5.2', title: 'The second Fundamental Theorem of Calculus', unit: 4, slug: 'sec-5-2-FTC2.html',
      ideas: [
        R`<b>Second FTC:</b> $\dfrac{d}{dx}\displaystyle\int_a^x f(t)\,dt = f(x)$. Differentiating an integral function returns the integrand evaluated at the upper limit.`,
        R`With a variable upper limit $g(x)$, the chain rule applies: $\frac{d}{dx}\int_a^{g(x)} f(t)\,dt = f(g(x))\,g'(x)$.`,
        R`Every continuous function has an antiderivative, namely $\int_a^x f(t)dt$, even when no elementary formula exists (e.g. $\int_0^x e^{-t^2}dt$).`
      ],
      formulas: [
        { n: 'Second FTC', t: R`\frac{d}{dx}\int_a^x f(t)\,dt = f(x)` },
        { n: 'With chain rule', t: R`\frac{d}{dx}\int_a^{g(x)} f(t)\,dt = f\big(g(x)\big)\,g'(x)` }
      ],
      example: {
        p: R`Let $A(x) = \int_1^{x} (t^2 - 4)\,dt$. Find $A'(x)$, the critical numbers of $A$, and $\frac{d}{dx}\int_0^{x^2}\sin t\,dt$.`,
        s: R`$A'(x) = x^2 - 4$, so $A' = 0$ at $x=\pm2$. $A$ has a local min at $x=2$ (where $A'$ goes $-$ to $+$) and a local max at $x=-2$. Last part: $\sin(x^2)\cdot 2x$.`
      },
      pitfalls: [ R`Evaluating the integral first when the question only asks for the derivative.`, 'Missing the chain factor with a non-x upper limit.' ],
      tip: 'The second FTC turns "differentiate an integral" into "copy the integrand." Do not integrate.'
    }
  ];

  /* ---------- Formula sheet ---------- */
  const FORMULAS = [
    { group: 'Limits', items: [
      { n: 'Two-sided limit', t: R`\lim_{x\to a} f(x) = L \iff \lim_{x\to a^-}f(x)=\lim_{x\to a^+}f(x)=L` },
      { n: 'Limit laws', t: R`\lim(f\pm g)=\lim f\pm\lim g,\quad \lim(fg)=\lim f\cdot\lim g,\quad \lim\tfrac fg=\tfrac{\lim f}{\lim g}\ (\lim g\ne0)` },
      { n: 'Forms', t: R`\tfrac{c}{d}\ (d\neq0):\ \text{valid};\quad \tfrac{c}{0}\ (c\neq0):\ \text{vertical asymptote};\quad \tfrac00:\ \text{indeterminate}` },
      { n: 'Special limits', t: R`\lim_{x\to0}\frac{\sin x}{x}=1,\qquad \lim_{x\to0}\frac{1-\cos x}{x}=0,\qquad \lim_{x\to0}\frac{e^x-1}{x}=1` },
      { n: 'Continuity at a', t: R`f(a)\ \text{defined},\quad \lim_{x\to a}f(x)\ \text{exists},\quad \lim_{x\to a}f(x)=f(a)` },
      { n: "L'Hôpital", t: R`\lim\frac{f}{g}\ \big(\tfrac00\text{ or }\tfrac\infty\infty\big) = \lim\frac{f'}{g'}` },
      { n: 'Dominance as x→∞', t: R`\ln x \ll x^p \ll a^x\ (a>1)` }
    ]},
    { group: 'Rates of change', items: [
      { n: 'Average rate of change', t: R`AV_{[a,b]}=\frac{f(b)-f(a)}{b-a}` },
      { n: 'Derivative at a point', t: R`f'(a)=\lim_{h\to0}\frac{f(a+h)-f(a)}{h}=\lim_{x\to a}\frac{f(x)-f(a)}{x-a}` },
      { n: 'Derivative function', t: R`f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}{h}` },
      { n: 'Difference estimates', t: R`\text{fwd }\frac{f(a+h)-f(a)}{h},\quad \text{bwd }\frac{f(a)-f(a-h)}{h},\quad \text{ctr }\frac{f(a+h)-f(a-h)}{2h}` },
      { n: 'Tangent line', t: R`L(x)=f(a)+f'(a)(x-a)` },
      { n: 'Units', t: R`f'(a)\ \text{has units}\ \frac{\text{units of } f}{\text{units of } x}` }
    ]},
    { group: 'Shape of a graph', items: [
      { n: 'Increasing / decreasing', t: R`f'>0\Rightarrow f\uparrow,\qquad f'<0\Rightarrow f\downarrow` },
      { n: 'Concavity', t: R`f''>0\Rightarrow\text{concave up}\ (\cup),\qquad f''<0\Rightarrow\text{concave down}\ (\cap)` },
      { n: 'Critical numbers', t: R`f'(c)=0\ \text{or undefined}` },
      { n: 'First derivative test', t: R`f':\ +\to-\ \text{local max};\quad -\to+\ \text{local min}` },
      { n: 'Second derivative test', t: R`f'(c)=0:\ f''(c)<0\Rightarrow\text{max},\ f''(c)>0\Rightarrow\text{min}` },
      { n: 'Inflection point', t: R`f''\ \text{changes sign}` }
    ]},
    { group: 'Derivative rules', items: [
      { n: 'Power', t: R`\frac{d}{dx}x^n=nx^{n-1}` },
      { n: 'Constant multiple / sum', t: R`(cf)'=cf',\qquad (f\pm g)'=f'\pm g'` },
      { n: 'Product', t: R`(fg)'=f'g+fg'` },
      { n: 'Quotient', t: R`\left(\frac fg\right)'=\frac{f'g-fg'}{g^2}` },
      { n: 'Chain', t: R`\frac{d}{dx}f(g(x))=f'(g(x))\,g'(x)` },
      { n: 'Inverse function', t: R`(f^{-1})'(x)=\frac{1}{f'(f^{-1}(x))}` },
      { n: 'Implicit', t: R`\frac{d}{dx}[y^n]=ny^{n-1}\frac{dy}{dx}` }
    ]},
    { group: 'Derivatives of basic functions', items: [
      { n: 'Exponential', t: R`\frac{d}{dx}e^x=e^x,\qquad \frac{d}{dx}a^x=a^x\ln a` },
      { n: 'Logarithm', t: R`\frac{d}{dx}\ln x=\frac1x,\qquad \frac{d}{dx}\log_a x=\frac{1}{x\ln a}` },
      { n: 'Sine / cosine', t: R`\frac{d}{dx}\sin x=\cos x,\qquad \frac{d}{dx}\cos x=-\sin x` },
      { n: 'Tangent / cotangent', t: R`\frac{d}{dx}\tan x=\sec^2x,\qquad \frac{d}{dx}\cot x=-\csc^2x` },
      { n: 'Secant / cosecant', t: R`\frac{d}{dx}\sec x=\sec x\tan x,\qquad \frac{d}{dx}\csc x=-\csc x\cot x` },
      { n: 'Inverse trig', t: R`\frac{d}{dx}\arcsin x=\frac{1}{\sqrt{1-x^2}},\quad \frac{d}{dx}\arccos x=-\frac{1}{\sqrt{1-x^2}},\quad \frac{d}{dx}\arctan x=\frac{1}{1+x^2}` }
    ]},
    { group: 'Integrals', items: [
      { n: 'Riemann sums', t: R`\Delta x=\tfrac{b-a}{n};\quad L_n=\sum_{i=0}^{n-1}f(x_i)\Delta x,\quad R_n=\sum_{i=1}^{n}f(x_i)\Delta x,\quad M_n=\sum f(\bar x_i)\Delta x` },
      { n: 'Definite integral', t: R`\int_a^b f(x)\,dx=\lim_{n\to\infty}\sum_{i=1}^n f(x_i)\Delta x` },
      { n: 'Properties', t: R`\int_a^b(cf+g)=c\int_a^bf+\int_a^bg,\quad \int_a^b=\int_a^c+\int_c^b,\quad \int_b^a=-\int_a^b` },
      { n: 'Average value', t: R`f_{\text{avg}}=\frac{1}{b-a}\int_a^bf(x)\,dx` },
      { n: 'FTC (evaluation)', t: R`\int_a^bf(x)\,dx=F(b)-F(a)\quad(F'=f)` },
      { n: 'Total change', t: R`\int_a^bf'(x)\,dx=f(b)-f(a)` },
      { n: 'Second FTC', t: R`\frac{d}{dx}\int_a^xf(t)\,dt=f(x),\qquad \frac{d}{dx}\int_a^{g(x)}f(t)\,dt=f(g(x))\,g'(x)` }
    ]},
    { group: 'Basic antiderivatives', items: [
      { n: 'Power', t: R`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C\ (n\ne-1),\qquad \int\frac1x\,dx=\ln|x|+C` },
      { n: 'Exponential', t: R`\int e^{kx}\,dx=\frac1ke^{kx}+C,\qquad \int a^x\,dx=\frac{a^x}{\ln a}+C` },
      { n: 'Trig', t: R`\int\cos x\,dx=\sin x+C,\quad \int\sin x\,dx=-\cos x+C,\quad \int\sec^2x\,dx=\tan x+C` },
      { n: 'Inverse trig', t: R`\int\frac{1}{1+x^2}\,dx=\arctan x+C,\qquad \int\frac{1}{\sqrt{1-x^2}}\,dx=\arcsin x+C` },
      { n: 'Substitution (if covered)', t: R`\int f(g(x))\,g'(x)\,dx=\int f(u)\,du,\quad u=g(x)` }
    ]},
    { group: 'Related-rate geometry', items: [
      { n: 'Circle / sphere', t: R`A=\pi r^2,\quad C=2\pi r,\quad V=\tfrac43\pi r^3,\quad S=4\pi r^2` },
      { n: 'Cylinder / cone', t: R`V=\pi r^2h,\qquad V=\tfrac13\pi r^2h` },
      { n: 'Pythagoras', t: R`x^2+y^2=z^2\ \Rightarrow\ x\,x'+y\,y'=z\,z'` },
      { n: 'Unit circle values', t: R`\sin\tfrac\pi6=\tfrac12,\ \sin\tfrac\pi4=\tfrac{\sqrt2}{2},\ \sin\tfrac\pi3=\tfrac{\sqrt3}{2};\quad \cos\tfrac\pi6=\tfrac{\sqrt3}{2},\ \cos\tfrac\pi4=\tfrac{\sqrt2}{2},\ \cos\tfrac\pi3=\tfrac12` }
    ]}
  ];

  /* ---------- Flashcards ---------- */
  const FLASHCARDS = [
    // Unit 1
    { id: 'fc-aroc', unit: 1, sec: '1.1', f: R`Average rate of change of $f$ on $[a,b]$`, b: R`$AV_{[a,b]} = \dfrac{f(b)-f(a)}{b-a}$, the slope of the secant line through $(a,f(a))$ and $(b,f(b))$.` },
    { id: 'fc-inst', unit: 1, sec: '1.1', f: 'Instantaneous velocity at t = a (in words)', b: R`The limit of average velocities over $[a,a+h]$ as $h\to0$; the slope of the tangent line to the position graph at $t=a$.` },
    { id: 'fc-units', unit: 1, sec: '1.5', f: R`Units of $f'(a)$`, b: R`$\dfrac{\text{units of } f}{\text{units of } x}$ (e.g. mg per hour, dollars per mile).` },
    { id: 'fc-limdef', unit: 1, sec: '1.2', f: R`Meaning of $\lim_{x\to a} f(x) = L$`, b: R`$f(x)$ can be made as close to $L$ as we like by taking $x$ sufficiently close to (but not equal to) $a$. The value $f(a)$ does not matter.` },
    { id: 'fc-onesided', unit: 1, sec: '1.2', f: 'When does a two-sided limit exist?', b: R`Exactly when both one-sided limits exist and are equal: $\lim_{x\to a^-}f(x) = \lim_{x\to a^+}f(x)$.` },
    { id: 'fc-forms', unit: 1, sec: '1.2', f: R`Classify: $\frac{c}{d}$, $\frac{c}{0}$, $\frac{0}{0}$ after substitution`, b: R`$\frac cd$ ($d\ne0$): valid answer. $\frac c0$ ($c\ne0$): vertical asymptote, limit DNE. $\frac00$: indeterminate, do more algebra (factor, conjugate, common denominator).` },
    { id: 'fc-derivpt', unit: 1, sec: '1.3', f: R`Limit definition of $f'(a)$`, b: R`$f'(a) = \displaystyle\lim_{h\to0}\frac{f(a+h)-f(a)}{h}$, equivalently $\displaystyle\lim_{x\to a}\frac{f(x)-f(a)}{x-a}$.` },
    { id: 'fc-derivmeaning', unit: 1, sec: '1.3', f: R`Three meanings of $f'(a)$`, b: 'Slope of the tangent line at (a, f(a)); instantaneous rate of change of f at a; limit of average rates of change over shrinking intervals.' },
    { id: 'fc-derivfn', unit: 1, sec: '1.4', f: R`Limit definition of $f'(x)$`, b: R`$f'(x) = \displaystyle\lim_{h\to0}\frac{f(x+h)-f(x)}{h}$` },
    { id: 'fc-graphfp', unit: 1, sec: '1.4', f: R`Graph of $f$ has a smooth peak at $x=c$. What is $f'(c)$? What about a corner?`, b: R`Smooth peak: $f'(c)=0$ (horizontal tangent). Corner or cusp: $f'(c)$ is undefined.` },
    { id: 'fc-central', unit: 1, sec: '1.5', f: 'Central difference estimate of f′(a)', b: R`$f'(a)\approx\dfrac{f(a+h)-f(a-h)}{2h}$. Forward: $\frac{f(a+h)-f(a)}{h}$. Backward: $\frac{f(a)-f(a-h)}{h}$.` },
    { id: 'fc-interp', unit: 1, sec: '1.5', f: R`Template sentence for "$f'(a) = c$"`, b: 'When the input is a (units), the output f is increasing/decreasing at a rate of |c| (output units) per (input unit).' },
    { id: 'fc-tanstep', unit: 1, sec: '1.5', f: R`Approximate $f(a+h)$ using $f(a)$ and $f'(a)$`, b: R`$f(a+h)\approx f(a) + f'(a)\,h$ (step along the tangent line).` },
    { id: 'fc-concave', unit: 1, sec: '1.6', f: R`What does $f''(x) > 0$ tell you?`, b: R`$f'$ is increasing, so $f$ is concave up ($\cup$). It does <em>not</em> say $f$ is increasing.` },
    { id: 'fc-inflect', unit: 1, sec: '1.6', f: 'Definition of an inflection point', b: R`A point where $f$ changes concavity ($f''$ changes sign). $f''=0$ alone is not enough.` },
    { id: 'fc-incinc', unit: 1, sec: '1.6', f: '"Decreasing at a decreasing rate" means which signs?', b: R`$f'<0$ (decreasing) and $f''>0$ (the rate is becoming less negative, so the decrease is slowing). Concave up.` },
    { id: 'fc-accel', unit: 1, sec: '1.6', f: R`If $s(t)$ is position, what are $s'$ and $s''$?`, b: 'Velocity and acceleration.' },
    // Unit 2
    { id: 'fc-cont', unit: 2, sec: '1.7', f: R`Definition: $f$ is continuous at $a$`, b: R`$f(a)$ is defined, $\lim_{x\to a}f(x)$ exists, and $\lim_{x\to a}f(x) = f(a)$.` },
    { id: 'fc-diffcont', unit: 2, sec: '1.7', f: 'Differentiable vs. continuous: which implies which?', b: R`Differentiable $\Rightarrow$ continuous. Not the converse: $|x|$ is continuous at 0 but not differentiable there.` },
    { id: 'fc-nondiff', unit: 2, sec: '1.7', f: 'Four ways f can fail to be differentiable at a', b: 'A corner, a cusp, a vertical tangent, or a discontinuity.' },
    { id: 'fc-linear', unit: 2, sec: '1.8', f: R`Tangent line (linearization) at $x=a$`, b: R`$L(x) = f(a) + f'(a)(x-a)$. If $f$ is concave up near $a$, $L$ underestimates $f$; concave down, overestimates.` },
    { id: 'fc-power', unit: 2, sec: '2.1', f: R`$\dfrac{d}{dx}\big[x^n\big]$`, b: R`$n\,x^{n-1}$ for any real $n$. Rewrite roots and reciprocals as powers first.` },
    { id: 'fc-exp', unit: 2, sec: '2.1', f: R`$\dfrac{d}{dx}[e^x]$ and $\dfrac{d}{dx}[a^x]$`, b: R`$e^x$ and $a^x\ln a$.` },
    { id: 'fc-sincos', unit: 2, sec: '2.2', f: R`$\dfrac{d}{dx}[\sin x]$, $\dfrac{d}{dx}[\cos x]$`, b: R`$\cos x$ and $-\sin x$ (radians).` },
    { id: 'fc-product', unit: 2, sec: '2.3', f: 'Product rule', b: R`$(fg)' = f'g + fg'$` },
    { id: 'fc-quotient', unit: 2, sec: '2.3', f: 'Quotient rule', b: R`$\left(\dfrac fg\right)' = \dfrac{f'g - fg'}{g^2}$` },
    { id: 'fc-tan', unit: 2, sec: '2.4', f: R`$\dfrac{d}{dx}[\tan x]$, $\dfrac{d}{dx}[\sec x]$`, b: R`$\sec^2 x$ and $\sec x\tan x$.` },
    { id: 'fc-cot', unit: 2, sec: '2.4', f: R`$\dfrac{d}{dx}[\cot x]$, $\dfrac{d}{dx}[\csc x]$`, b: R`$-\csc^2 x$ and $-\csc x\cot x$.` },
    { id: 'fc-chain', unit: 2, sec: '2.5', f: 'Chain rule', b: R`$\dfrac{d}{dx}\big[f(g(x))\big] = f'(g(x))\,g'(x)$: outside derivative at the inside, times inside derivative.` },
    { id: 'fc-ln', unit: 2, sec: '2.6', f: R`$\dfrac{d}{dx}[\ln x]$ and $\dfrac{d}{dx}[\ln u]$`, b: R`$\dfrac1x$ and $\dfrac{u'}{u}$.` },
    { id: 'fc-invtrig', unit: 2, sec: '2.6', f: R`$\dfrac{d}{dx}[\arctan x]$, $\dfrac{d}{dx}[\arcsin x]$`, b: R`$\dfrac{1}{1+x^2}$ and $\dfrac{1}{\sqrt{1-x^2}}$.` },
    { id: 'fc-invfn', unit: 2, sec: '2.6', f: 'Derivative of an inverse function', b: R`$(f^{-1})'(x) = \dfrac{1}{f'\big(f^{-1}(x)\big)}$` },
    // Unit 3
    { id: 'fc-implicit', unit: 3, sec: '2.7', f: R`$\dfrac{d}{dx}[y^3]$ when $y$ depends on $x$`, b: R`$3y^2\,\dfrac{dy}{dx}$ (chain rule).` },
    { id: 'fc-lhop', unit: 3, sec: '2.8', f: "When may you use L'Hôpital's rule?", b: R`Only for the forms $\frac00$ or $\frac\infty\infty$. Then $\lim\frac fg = \lim\frac{f'}{g'}$ (differentiate top and bottom separately).` },
    { id: 'fc-dominate', unit: 3, sec: '2.8', f: R`Order of growth as $x\to\infty$`, b: R`$\ln x \ll x^p \ll e^x$. So $\dfrac{x^{100}}{e^x}\to0$ and $\dfrac{\ln x}{x}\to0$.` },
    { id: 'fc-rational', unit: 3, sec: '2.8', f: R`$\lim_{x\to\infty}$ of a rational function`, b: 'Compare degrees: lower on top → 0; equal → ratio of leading coefficients; higher on top → ±∞.' },
    { id: 'fc-critical', unit: 3, sec: '3.1', f: 'Definition of a critical number', b: R`A number $c$ in the domain of $f$ where $f'(c)=0$ or $f'(c)$ is undefined.` },
    { id: 'fc-fdt', unit: 3, sec: '3.1', f: 'First derivative test', b: R`If $f'$ changes from $+$ to $-$ at $c$: local max. From $-$ to $+$: local min. No change: neither.` },
    { id: 'fc-sdt', unit: 3, sec: '3.1', f: 'Second derivative test', b: R`If $f'(c)=0$: $f''(c)<0$ means local max, $f''(c)>0$ means local min, $f''(c)=0$ is inconclusive.` },
    { id: 'fc-rr', unit: 3, sec: '3.5', f: 'Related rates: the one rule about substituting values', b: 'Differentiate the relating equation with respect to t first; substitute the specific values only afterwards.' },
    { id: 'fc-rrcircle', unit: 3, sec: '3.5', f: R`$A = \pi r^2$: relate $\frac{dA}{dt}$ and $\frac{dr}{dt}$`, b: R`$\dfrac{dA}{dt} = 2\pi r\,\dfrac{dr}{dt}$` },
    // Unit 4
    { id: 'fc-evt', unit: 4, sec: '3.3', f: 'Extreme Value Theorem', b: R`A continuous function on a closed interval $[a,b]$ attains an absolute maximum and an absolute minimum.` },
    { id: 'fc-closed', unit: 4, sec: '3.3', f: 'Closed interval method', b: 'Evaluate f at the critical numbers inside (a,b) and at the endpoints a and b; largest value is the absolute max, smallest is the absolute min.' },
    { id: 'fc-opt', unit: 4, sec: '3.4', f: 'Applied optimization steps', b: 'Draw & name variables → objective → constraint → one-variable function → domain → critical numbers → test (endpoints / derivative test) → answer with units.' },
    { id: 'fc-dist', unit: 4, sec: '4.1', f: 'Distance traveled vs. net change in position', b: R`Net change $= \int_a^b v(t)\,dt$ (signed area). Total distance $= \int_a^b |v(t)|\,dt$.` },
    { id: 'fc-riemann', unit: 4, sec: '4.2', f: R`Left and right Riemann sums with $n$ rectangles`, b: R`$\Delta x = \frac{b-a}{n}$, $L_n = \sum_{i=0}^{n-1} f(x_i)\Delta x$, $R_n = \sum_{i=1}^{n} f(x_i)\Delta x$.` },
    { id: 'fc-overunder', unit: 4, sec: '4.2', f: R`$f$ increasing on $[a,b]$: is $L_n$ an over- or underestimate?`, b: R`Underestimate ($R_n$ overestimates). For decreasing $f$ it is reversed.` },
    { id: 'fc-defint', unit: 4, sec: '4.3', f: 'Definition of the definite integral', b: R`$\int_a^b f(x)\,dx = \lim_{n\to\infty}\sum_{i=1}^n f(x_i)\Delta x$: net signed area between the graph and the $x$-axis.` },
    { id: 'fc-avg', unit: 4, sec: '4.3', f: R`Average value of $f$ on $[a,b]$`, b: R`$f_{\text{avg}} = \dfrac{1}{b-a}\int_a^b f(x)\,dx$` },
    { id: 'fc-ftc', unit: 4, sec: '4.4', f: 'Fundamental Theorem of Calculus (evaluation form)', b: R`If $F'=f$ then $\int_a^b f(x)\,dx = F(b) - F(a)$.` },
    { id: 'fc-totalchange', unit: 4, sec: '4.4', f: 'Total change theorem', b: R`$\int_a^b f'(x)\,dx = f(b) - f(a)$: integrating a rate gives net change.` },
    { id: 'fc-antipow', unit: 4, sec: '4.4', f: R`$\int x^n\,dx$ and $\int \frac1x\,dx$`, b: R`$\dfrac{x^{n+1}}{n+1} + C$ ($n\ne-1$) and $\ln|x| + C$.` },
    { id: 'fc-antitrig', unit: 4, sec: '4.4', f: R`$\int\sin x\,dx$, $\int\cos x\,dx$, $\int e^{kx}\,dx$`, b: R`$-\cos x + C$, $\sin x + C$, $\frac1k e^{kx} + C$.` },
    { id: 'fc-ftc2', unit: 4, sec: '5.2', f: 'Second Fundamental Theorem of Calculus', b: R`$\dfrac{d}{dx}\int_a^x f(t)\,dt = f(x)$; with upper limit $g(x)$: $f(g(x))\,g'(x)$.` },
    { id: 'fc-intfn', unit: 4, sec: '5.1', f: R`$F(x) = \int_a^x f(t)\,dt$: where is $F$ increasing? concave up?`, b: R`Increasing where $f>0$; concave up where $f$ is increasing. $F(a) = 0$.` }
  ];

  /* ---------- Exam 1 practice set (from PQ_Exam1_Fall2026) ---------- */
  const PRACTICE_EXAM1 = {
    title: 'Exam 1 practice problems',
    subtitle: 'Through §1.6 and Lab 3. Check answers in WebWork; full solutions post there Wednesday at noon.',
    problems: [
      { n: 1, sec: '1.1', tags: ['rate-units'], q: R`The average cost of tuition and fees for in-state residents at public four-year colleges can be modeled by $T = 300x + 11{,}600$, where $T$ is the average cost for the school year ending $x$ years after 2024. What is the slope value? What are its units? In context, what does the slope represent?`,
        s: R`Slope $= 300$, with units <b>dollars per year</b>. It means tuition and fees increase by about \$300 each year after 2024. (The intercept $11{,}600$ is the cost in 2024.)` },
      { n: 2, sec: '1.1', tags: ['aroc'], graph: true, q: R`Calculate the slope of the secant line through the points on the graph (in the PDF) where $x=1$ and $x=3$.`,
        s: R`Read $f(1)$ and $f(3)$ from the graph, then $m_{\text{sec}} = \dfrac{f(3)-f(1)}{3-1}$. Show the two points you read and the subtraction; label the answer as a slope with the graph's units if any.` },
      { n: 3, sec: '1.1', tags: ['aroc'], graph: true, q: R`Use the graph of the piecewise function $f(x)$ in the PDF to find (a) $f(-6)$, (b) $f(3)$, (c) $AV_{[-6,3]}$.`,
        s: R`(a), (b): read the $y$-values at $x=-6$ and $x=3$ from the correct piece (a filled dot wins over an open circle). (c) $AV_{[-6,3]} = \dfrac{f(3)-f(-6)}{3-(-6)} = \dfrac{f(3)-f(-6)}{9}$.` },
      { n: 4, sec: '1.1', tags: ['aroc','velocity'], graph: true, q: R`The distance–time graph $D=f(t)$ shows a wrench falling from a mast to the station roof $P$ m below, with labeled points $Q_1,\dots,Q_4$ and $P$. Write the formula for $AV_{[0,P]}$ and $AV_{[Q_2,Q_4]}$; give the units of the rate of change; and decide which of $[0,Q_1]$, $[Q_2,Q_4]$, $[0,P]$ has the largest rate.`,
        s: R`$AV_{[0,P]} = \dfrac{f(P)-f(0)}{P-0}$ and $AV_{[Q_2,Q_4]} = \dfrac{f(Q_4)-f(Q_2)}{Q_4-Q_2}$. Units: meters per second. A falling object speeds up, so the secant over the <em>latest</em> interval is steepest: compare the slopes visually; the interval nearest the end of the fall ($[Q_2,Q_4]$) has the largest average velocity, while $[0,Q_1]$ (the start) has the smallest.` },
      { n: 5, sec: '1.1', tags: ['aroc'], q: R`Let $f(x) = 5 + \sqrt{x}$. Find the average rate of change of $f$ on $[1,4]$ and $[4,25]$.`,
        s: R`$AV_{[1,4]} = \dfrac{f(4)-f(1)}{3} = \dfrac{7-6}{3} = \dfrac13$. $AV_{[4,25]} = \dfrac{f(25)-f(4)}{21} = \dfrac{10-7}{21} = \dfrac17$.` },
      { n: 6, sec: '1.1', tags: ['aroc'], q: R`Let $g(t) = |2t-1|$. Find the average rate of change of $g$ on $[0,1]$ and $[-3,2]$.`,
        s: R`$g(0)=1$, $g(1)=1$, so $AV_{[0,1]} = \dfrac{1-1}{1} = 0$. $g(-3) = |-7| = 7$, $g(2) = 3$, so $AV_{[-3,2]} = \dfrac{3-7}{5} = -\dfrac45$.` },
      { n: 7, sec: '1.1', tags: ['velocity'], q: R`A diver's position (feet) at time $t$ (minutes) gives $AV_{[1,1.1]}=-21.6$, $AV_{[0.9,1]}=-21.62$, $AV_{[1,1.01]}=-20.16$, $AV_{[0.99,1]}=-20.19$, $AV_{[1,1.001]}=-20.016$, $AV_{[0.999,1]}=-20.013$. What conclusion can be drawn about the diver's velocity?`,
        s: R`As the intervals shrink from both sides, the average velocities approach $-20$. So the instantaneous velocity at $t=1$ minute is approximately $-20$ ft/min: the diver is descending at about 20 feet per minute at that instant.` },
      { n: 8, sec: '1.2', tags: ['limit-forms'], q: R`For each, decide whether the form is a "valid answer", a "vertical asymptote", or an "indeterminate form": (a) $\frac{\sin x}{x}$ as $x\to0$; (b) $\frac{\sin x}{\cos x}$ as $x\to0$; (c) $\frac{x+1}{x-1}$ as $x\to0$; (d) $\frac{x+4}{x}$ as $x\to0$; (e) $\frac{x}{\ln(x+1)}$ as $x\to0$; (f) $\frac{x^2+1}{x^2-1}$ as $x\to1$.`,
        s: R`(a) $\frac00$: indeterminate. (b) $\frac01 = 0$: valid answer. (c) $\frac{1}{-1} = -1$: valid answer. (d) $\frac40$: vertical asymptote. (e) $\frac{0}{\ln 1} = \frac00$: indeterminate. (f) $\frac20$: vertical asymptote.` },
      { n: 9, sec: '1.2', tags: ['limit-algebra'], q: R`Using only algebra, evaluate (a) $\displaystyle\lim_{x\to2}\frac{x^2+3x-10}{x-2}$ and (b) $\displaystyle\lim_{x\to2}\frac{\sqrt{x+7}-3}{x-2}$.`,
        s: R`(a) $\frac00$. Factor: $\dfrac{(x+5)(x-2)}{x-2} = x+5 \to 7$. (b) $\frac00$. Multiply by the conjugate: $\dfrac{(\sqrt{x+7}-3)(\sqrt{x+7}+3)}{(x-2)(\sqrt{x+7}+3)} = \dfrac{x-2}{(x-2)(\sqrt{x+7}+3)} = \dfrac{1}{\sqrt{x+7}+3} \to \dfrac16$.` },
      { n: 10, sec: '1.2', tags: ['limit-algebra'], q: R`Using only algebra, evaluate $\displaystyle\lim_{x\to4}\frac{\frac1x-\frac14}{x-4}$.`,
        s: R`Combine the numerator: $\dfrac{4-x}{4x}$. Then $\dfrac{4-x}{4x(x-4)} = \dfrac{-(x-4)}{4x(x-4)} = -\dfrac{1}{4x} \to -\dfrac{1}{16}$.` },
      { n: 11, sec: '1.2', tags: ['limits-graph-table'], q: R`Complete the table for $f(x) = \dfrac{x^2-4x-5}{x-5}$ at $x = 4.5,\ 4.9,\ 4.99,\ 5.01,\ 5.1,\ 5.5$. State $\lim_{x\to5}f(x)$ and explain.`,
        s: R`For $x\ne5$, $f(x) = \dfrac{(x-5)(x+1)}{x-5} = x+1$. Table: $5.5,\ 5.9,\ 5.99,\ 6.01,\ 6.1,\ 6.5$. From both sides the values approach $6$, so $\lim_{x\to5}f(x) = 6$ even though $f(5)$ is undefined (a hole).` },
      { n: 12, sec: '1.2', tags: ['limits-graph-table'], graph: true, q: R`From the graph of $f$ in the PDF, determine the one-sided and two-sided limits at $x=-2$, $x=1$, and $x=3$.`,
        s: R`For each $x$-value trace the curve from the left and from the right and report the height being approached (open circles still count; the filled dot is $f(a)$, not the limit). The two-sided limit exists only if both sides agree; if they differ, write "DNE"; if the curve runs off to $\pm\infty$, write $\infty$ or $-\infty$ and say the limit does not exist.` },
      { n: 13, sec: '1.3', tags: ['deriv-point'], graph: true, q: R`From the graph of $g$ in the PDF, estimate $g'(-3)$, $g'(1.5)$, $g'(3)$.`,
        s: R`At each point sketch the tangent line and read its rise over run using the grid. Sign check: where $g$ is rising the estimate is positive; at a peak or valley it is $0$.` },
      { n: 14, sec: '1.1', tags: ['aroc'], q: R`Fitbit data for a bike ride: $t$ (min) $= 0,10,20,30,40,50$ and $d(t)$ (miles) $= 0,\ 2.5,\ 6.5,\ 10,\ 14.5,\ 17.5$. Find the average velocity over the last 10 minutes, with proper notation and units.`,
        s: R`$AV_{[40,50]} = \dfrac{d(50)-d(40)}{50-40} = \dfrac{17.5-14.5}{10} = 0.3$ miles per minute (18 mph).` },
      { n: 15, sec: '1.3', tags: ['limit-def'], q: R`Use the limit definition of the derivative: (a) $r'(x)$ for $r(x) = 11-5x-3x^2$; (b) $f'(1)$ for $f(x) = \sqrt{2x-1}$; (c) $p'(u)$ for $p(u) = \dfrac{9}{2-u}$.`,
        s: R`(a) $r(x+h)-r(x) = -5h-6xh-3h^2$, so $r'(x) = \lim_{h\to0}(-5-6x-3h) = -5-6x$.<br>(b) $f'(1) = \lim_{h\to0}\dfrac{\sqrt{1+2h}-1}{h} = \lim_{h\to0}\dfrac{2}{\sqrt{1+2h}+1} = 1$.<br>(c) $p(u+h)-p(u) = \dfrac{9}{2-u-h}-\dfrac{9}{2-u} = \dfrac{9h}{(2-u-h)(2-u)}$, so $p'(u) = \lim_{h\to0}\dfrac{9}{(2-u-h)(2-u)} = \dfrac{9}{(2-u)^2}$.` },
      { n: 16, sec: '1.4', tags: ['derivative-function'], graph: true, q: R`For the function $f$ plotted in the PDF, sketch an accurate graph of $f'$.`,
        s: R`Mark the $x$-values where $f$ has horizontal tangents: those are the zeros of $f'$. Between them, $f'$ is positive where $f$ rises and negative where it falls. Where $f$ is steepest, $|f'|$ is largest. Corners of $f$ become jumps or holes in $f'$.` },
      { n: 17, sec: '1.5', tags: ['estimating'], q: R`Data: $t = 1,5,9,13,17,21,25$ and $f(t) = 27,26,24,21,18,16,15$. Estimate $f'(5)$ and $f'(17)$.`,
        s: R`Central differences ($h=4$): $f'(5)\approx\dfrac{f(9)-f(1)}{9-1} = \dfrac{24-27}{8} = -\dfrac38 = -0.375$. $f'(17)\approx\dfrac{f(21)-f(13)}{8} = \dfrac{16-21}{8} = -\dfrac58 = -0.625$.` },
      { n: 18, sec: '1.5', tags: ['interpretation','estimating'], q: R`Weight $W = f(c)$ (pounds) depends on daily Calories $c$. (a) If $f'(2000) = 0$, state the units of 2000 and of 0 and explain. (b) Given $f(1600)=165$, $f(1700)=177$, $f(1800)=190$, use forward, backward and central differences to estimate $f'(1700)$. (c) Explain $f'(1500) = 5$.`,
        s: R`(a) 2000 is in Calories per day; 0 is in pounds per (Calorie per day). At an intake of 2000 Cal/day, a small change in intake produces essentially no change in weight (a maintenance level).<br>(b) Forward $\frac{190-177}{100} = 0.13$; backward $\frac{177-165}{100}=0.12$; central $\frac{190-165}{200} = 0.125$ lb per Cal/day.<br>(c) At 1500 Calories per day, each additional Calorie per day increases weight by about 5 pounds.` },
      { n: 19, sec: '1.5', tags: ['interpretation'], q: R`$M(t)$ is the milligrams of ibuprofen in the body $t$ hours after a dose. Explain $M'(1.5) = -5.7$ with units.`,
        s: R`1.5 hours after taking the dose, the amount of ibuprofen in the body is decreasing at a rate of 5.7 milligrams per hour.` },
      { n: 20, sec: '1.6', tags: ['second-derivative'], graph: true, q: R`Sketch a graph of $y=g(x)$ with $g(-2)=-1$, $g'(-2)=\tfrac12$, $g'(x)>0$ for all $x$, $g''(x)>0$ for $x<-2$, $g''(x)<0$ for $x>-2$.`,
        s: R`Always increasing; concave up to the left of $x=-2$, concave down to the right, so $(-2,-1)$ is an inflection point where the slope is $\tfrac12$. The graph is an S-shape (like a stretched $\arctan$ or logistic curve) passing through $(-2,-1)$ with a gentle positive slope there.` },
      { n: 21, sec: '1.6', tags: ['second-derivative','derivative-function'], graph: true, q: R`Three graphs on $[-2,2]$ are $f$, $f'$, $f''$ in some order. Identify which is which.`,
        s: R`Pick the graph whose zeros line up with the peaks and valleys of another: that second graph is the original and the first is its derivative. Check both links: zeros of $f'$ at extrema of $f$, and zeros of $f''$ at extrema of $f'$. Also: where the candidate $f$ is concave up, the candidate $f''$ must be positive.` },
      { n: 22, sec: '1.6', tags: ['second-derivative'], graph: true, q: R`For $h(x)$ in the PDF with labeled points $x_1,\dots,x_5$ (exactly two have $h'=0$, $h''\ne0$ at all of them), fill in the sign chart for $h$, $h'$, $h''$.`,
        s: R`Row $h$: above the axis positive, below negative. Row $h'$: zero at the two peaks/valleys, positive where the curve rises, negative where it falls. Row $h''$: positive where the curve is cupped upward ($\cup$), negative where it is cupped downward ($\cap$).` },
      { n: 23, sec: '1.6', tags: ['second-derivative','interpretation'], q: R`A car's value $V(m)$ (dollars) after $m$ miles satisfies $V(25000) = 23525$, $V'(25000) = -0.61$, $V''(25000) = 0.017$. Explain in everyday language, citing all three with units.`,
        s: R`After 25,000 miles the car is worth \$23,525. At that mileage its value is falling by about \$0.61 per mile. Since $V''(25000) = 0.017$ dollars per mile per mile is positive, the rate of loss is becoming less negative: the car keeps losing value, but more slowly with each additional mile.` },
      { n: 24, sec: '1.6', tags: ['second-derivative'], graph: true, q: R`Graphs of $f'$ (curve) and $f''$ (line) are given. (a) Is $f$ increasing, decreasing, or can't tell at $x=2$? (b) Concave up, down, or can't tell at $x=2$?`,
        s: R`(a) Look at the sign of the <em>curve</em> ($f'$) at $x=2$: positive means $f$ is increasing, negative means decreasing. (b) Look at the sign of the <em>line</em> ($f''$) at $x=2$: positive means concave up, negative means concave down. You can tell both from the given graphs.` }
    ]
  };

  /* ---------- Study checklists per exam ---------- */
  const CHECKLISTS = {
    exam1: [
      'Re-read notes for §1.1 – §1.6 (this site)',
      'Redo Lab 1, Lab 2, Lab 3 sheets',
      'Work all 24 Exam 1 practice problems, then check in WebWork',
      'Flashcards: Unit 1 all mastered',
      'Quizzer: 20 questions on Unit 1 with ≥ 80% correct',
      'Practice writing interpretation sentences with units',
      'Do three limit-definition derivatives by hand (quadratic, square root, reciprocal)',
      'Review the four-point rubric: notation and explanation on every problem'
    ],
    exam2: [
      'Notes for §1.7 – §2.6',
      'Memorize the derivative table (Formula sheet)',
      'Redo Labs 4 – 7',
      'Flashcards: Unit 2 all mastered',
      'Quizzer: 20 questions on Unit 2 with ≥ 80% correct',
      'Chain-rule drill: 10 problems in a row without missing the inside derivative'
    ],
    exam3: [
      'Notes for §2.7, §2.8, §3.1, §3.5',
      'Redo Labs 8 – 10',
      'Flashcards: Unit 3 all mastered',
      'Quizzer: 20 questions on Unit 3 with ≥ 80% correct',
      'Related rates: write the "differentiate first, substitute after" checklist from memory'
    ],
    exam4: [
      'Notes for §3.3 – §5.2',
      'Redo Labs 11 – 14',
      'Flashcards: Unit 4 all mastered',
      'Quizzer: 20 questions on Unit 4 with ≥ 80% correct',
      'Riemann sums by hand for n = 4, then check in the Riemann lab',
      'Antiderivative table from memory'
    ],
    final: [
      'Print the formula sheet and rewrite it from memory',
      'One timed 50-minute mixed exam in the Quizzer per day for the week before',
      'Redo all four unit exams',
      'Flashcards: all units mastered'
    ]
  };

  /* ---------- derived fields for the shared shell ---------- */
  SECTIONS.forEach(s => { s.label = '§' + s.id; s.link = COURSE.textbookBase + s.slug; });
  CALENDAR.forEach(e => { if (e[1] === 'lecture') { const m = e[2].match(/§(\d\.\d)/); if (m) e[3] = m[1]; } });
  const RECURRING = [
    { dows: [1, 2, 4], time: '8:00 pm', title: 'WebWork due', skipHolidays: true },
    { dows: [1], time: '8:00 pm', title: 'Written homework due (Gradescope)', skipHolidays: true },
    { afterLabDay: true, time: '8:00 pm', title: 'Lab sheet due (Gradescope)' }
  ];
  const PRACTICE = { exam1: PRACTICE_EXAM1 };
  const INFO = [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
        <li><b>Credits:</b> ${COURSE.credits}. Plan on <b>${COURSE.weeklyHours}+ hours per week</b> including class.</li>
        <li><b>Format:</b> ${COURSE.classDays}. Bring a laptop to lab.</li>
        <li><b>Textbook:</b> <a href="${COURSE.textbook.url}" target="_blank" rel="noopener">${COURSE.textbook.title}</a> (free).</li>
        <li><b>Homework:</b> <a href="${COURSE.webwork}" target="_blank" rel="noopener">WebWork</a> for online work; written work through Gradescope; everything else in Canvas.</li>
        <li><b>Exams:</b> four unit exams in class plus a cumulative final in finals week. <b>No calculators, electronics, or phones.</b></li>
        <li><b>Exam conflicts:</b> contact ${COURSE.successCoordinator} with your name, section, reason, and exam. Work, travel, and long weekends do not count.</li>
        <li><b>Quizzes:</b> in-class and take-home, no make-ups, lowest score(s) dropped.</li></ul>` },
    { icon: 'clock', title: 'Deadlines', html: `<ul class="list-plain small">${COURSE.deadlines.map(x => `<li><b>${x.name}.</b> ${x.rule}</li>`).join('')}</ul>` },
    { icon: 'bulb', title: 'Where to get help', html: `<ul class="list-plain small">
        <li><b>${COURSE.helpCenter.name}</b> · ${COURSE.helpCenter.where} · ${COURSE.helpCenter.hours}.</li>
        <li><b>Office hours</b> with your instructor and lab assistants (strongly encouraged).</li>
        <li><b>${COURSE.tutoring}</b> tutoring support.</li>
        <li><b>Short videos</b> for each section, posted in Canvas modules.</li>
        <li><b>Study groups:</b> work together on concepts; submit your own work.</li>
        <li><b>Disability Services</b> · ${COURSE.disability.where} · <a href="${COURSE.disability.url}" target="_blank" rel="noopener">details</a>.</li></ul>` },
    { icon: 'flag', title: 'Exams and weights', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Exam</th><th>Date</th><th>Covers</th><th class="num">Weight</th></tr></thead><tbody>${EXAMS.map(e => `<tr><td><b>${e.name}</b></td><td>${e.dateLabel || e.date}</td><td class="small">${e.covers}</td><td class="num">${e.weight}%</td></tr>`).join('')}</tbody></table></div>` },
    { icon: 'list', title: 'Written work expectations', span2: true, html: `<p class="small">Show all work and explain your reasoning in clear, precise mathematical language. Equations without explanation do not receive full credit; answers alone receive little or none. Be neat and use correct notation. Graded on the four-point rubric (see the Grade calculator page).</p>
        <div class="divider"></div><div class="eyebrow mb-1">AI use policy (summary)</div><p class="small">Generative AI is allowed as a <em>support</em> for learning: clarifying concepts, generating practice questions, checking your work for errors, making study plans. It must not replace your own thinking or produce submitted work. Attempt problems first, ask specific questions, and verify everything: you are responsible for correctness. All submitted work must be your own.</p>
        <div class="divider"></div><div class="eyebrow mb-1">Academic integrity</div><p class="small">Cheating and plagiarism, including copying from solution manuals or answer sites when not allowed, lead to disciplinary action up to a failing grade. When collaboration is permitted, acknowledge your collaborators and cite sources.</p>` }
  ];
  const NAV = [
    { label: 'Today', items: [['dashboard', 'Dashboard', 'home'], ['calendar', 'Calendar', 'calendar']] },
    { label: 'Learn', items: [['notes', 'Section notes', 'book'], ['formulas', 'Formula sheet', 'sigma'], ['flashcards', 'Flashcards', 'cards'], ['textbook', 'Textbook & links', 'link']] },
    { label: 'Practice', items: [['practice', 'Quizzer', 'list'], ['exam', 'Exam prep', 'flag'], ['planner', 'Study planner', 'calendar']] },
    { label: 'Tools', items: [['grapher', 'Grapher', 'chart'], ['labs', 'Labs', 'flask'], ['grades', 'Grade calculator', 'calc'], ['scratchpad', 'Scratchpad', 'pen']] },
    { label: 'Community', items: [['forum', 'Discussions', 'chat']] },
    { label: 'Course', items: [['course', 'Syllabus & policies', 'info'], ['settings', 'Settings', 'sliders']] }
  ];
  global.Courses = global.Courses || {};
  global.Courses.calc = Object.assign(global.Courses.calc || {}, {
    id: 'calc', code: 'M171', name: 'Calculus I', short: 'Calc I', term: 'Fall 2026', tagline: 'Limits, derivatives and integrals with Active Calculus',
    quizNote: 'You can type 3/8, -0.375 or 2pi. Answers within 0.5% count.',
    COURSE, GRADING, EXAMS, CALENDAR, RECURRING, SEMESTER, UNITS, SECTIONS, FORMULAS, FLASHCARDS, PRACTICE, CHECKLISTS, INFO, NAV
  });
})(window);
