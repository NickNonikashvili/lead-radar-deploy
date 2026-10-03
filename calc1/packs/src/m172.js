/* M 172 Calculus II, Fall 2026 (Dr. Rob Malo; built from the 1 pm section's syllabus).
   Built from the Fall 2026 syllabus and its tentative calendar. Build:  node scripts/make-pack.js packs/src/m172.js
   Notes, formulas, flashcards, practice and checklists live in m172/notes.js; the question bank in m172/quiz.js.
   The section numbers follow Active Calculus: 5.3–7.4 match the current online edition, and chapter 8
   (sequences, geometric series, series, alternating series, Taylor, power series) matches the first edition,
   so chapter 8 links point there. "Euler" and "Fourier" at the end of the semester are not in the textbook. */
const N = require('./m172/notes.js');
const QUIZ = require('./m172/quiz.js');

const CANVAS = 'https://montana.instructure.com/';
const AC = 'https://activecalculus.org/single/';
const WEBWORK = 'https://webwork3.math.montana.edu/webwork2/';
const GRADESCOPE = 'https://www.gradescope.com/';
const L = (date, title, sec) => [date, 'lecture', title, sec];
const NO = (date, why) => [date, 'holiday', why];
const ADMIN = (date, title) => [date, 'admin', title];
const LAB = (n, tue, thu) => [[tue, 'lab', `Lab ${n} (Tuesday lab). Bring a laptop for your group; the group lab sheet goes to Gradescope`, '', 'tue'], [thu, 'lab', `Lab ${n} (Thursday lab). Bring a laptop for your group; the group lab sheet goes to Gradescope`, '', 'thu']];

const EXAM_FORMAT = 'In class, on paper. No calculators, phones, earbuds or other electronics. Answers with little or no supporting work get little or no credit, so write every step with correct notation. If you leave the room during the exam without checking in with the instructional team, you cannot continue.';

module.exports = {
  format: 'mathub-class-pack', version: 1,
  id: 'm172', code: 'M 172', name: 'Calculus II', short: 'Calc II', term: 'Fall 2026', kind: 'math',
  tagline: 'Integration techniques, volumes and work, differential equations, and sequences, series and Taylor series',
  quizNote: 'Mathub wrote these questions from the syllabus topics; they are not the instructor’s. Exams allow no calculator, so work each one by hand first. Type answers as exact values or decimals: 2pi/15, 14/3, e^2-1 and 0.419 all work, and answers within 0.5% count.',
  formulasNote: 'Every integration technique, application formula, convergence test and Maclaurin series from the course on one page. Exams are closed-book with no calculator, so cover the right side and test yourself.',
  filterExample: 'ratio test, washers',
  color: { light: '#4338CA', dark: '#A5B4FC' },
  archetype: { name: 'Integrator', icon: 'sigma', line: 'Breaks any area, volume or infinite sum into pieces it can add up.' },
  canvasMatch: ['M 172', 'M172', 'CALCULUS II', 'CALC II'],
  guides: ['math-exam', 'active-recall', 'office-hours', 'study-group'],
  resourcesBlurb: 'The free textbook, homework and grading sites, plus second explanations for every technique and series test.',
  resources: [
    { t: 'Active Calculus (free online textbook)', u: AC, d: 'The course textbook. Sections 5.3 through 7.4 follow it directly.', k: 'reading', tags: ['textbook'], top: true },
    { t: 'Active Calculus, first edition: chapter 8', u: 'https://activecalculus.org/single1e/C-8.html', d: 'Sequences, geometric series, series, the alternating series test, Taylor and power series, numbered 8.1–8.6 exactly as on the syllabus.', k: 'reading', tags: ['textbook', 'series'], top: true },
    { t: 'WeBWorK', u: WEBWORK, d: 'Online homework for every section, due 8:00 pm Tuesdays and Fridays. Pick the M 172 course from the list or use the link on Canvas.', k: 'practice', tags: ['homework'], top: true },
    { t: 'Gradescope', u: GRADESCOPE, d: 'Group lab sheets are turned in here.', k: 'app', tags: ['labs'] },
    { t: 'Paul’s Online Math Notes: Calculus II', u: 'https://tutorial.math.lamar.edu/Classes/CalcII/CalcII.aspx', d: 'Clear notes and many worked examples for every technique, application and series test.', k: 'reading', tags: ['notes', 'examples'], top: true },
    { t: 'Paul’s common derivatives and integrals (PDF)', u: 'https://tutorial.math.lamar.edu/pdf/Common_Derivatives_Integrals.pdf', d: 'A two-page sheet of the integrals worth memorizing before Exam 1.', k: 'reference', tags: ['integrals'] },
    { t: 'OpenStax Calculus Volume 2 (free)', u: 'https://openstax.org/details/books/calculus-volume-2', d: 'A second free textbook covering the same course, with many exercises and answers.', k: 'reading', tags: ['textbook', 'exercises'] },
    { t: 'Khan Academy: Calculus 2', u: 'https://www.khanacademy.org/math/calculus-2', d: 'Short videos and practice on integration techniques, applications, differential equations and series.', k: 'video', tags: ['videos', 'practice'] },
    { t: '3Blue1Brown: Essence of calculus', u: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr', d: 'Visual intuition for integrals and, in chapter 11, Taylor series.', k: 'video', tags: ['intuition', 'Taylor'] },
    { t: '3Blue1Brown: But what is a Fourier series?', u: 'https://www.youtube.com/watch?v=r6sGWTCMz2k', d: 'A visual introduction to the last topic of the semester.', k: 'video', tags: ['Fourier'] },
    { t: 'Desmos graphing calculator', u: 'https://www.desmos.com/calculator', d: 'Sketch regions before setting up area and volume integrals, and watch Taylor polynomials hug a function. Not allowed on exams.', k: 'tool', tags: ['graphing'] },
    { t: 'Wolfram Alpha', u: 'https://www.wolframalpha.com/', d: 'Check an antiderivative or a sum after you have worked it by hand.', k: 'tool', tags: ['checking'] },
    { t: 'Math & Stat Center (Romney 220)', u: 'https://www.montana.edu/mathstatcenter/', d: 'Free drop-in help with M 172, face to face.', k: 'msu', tags: ['tutoring'], top: true },
    { t: 'Smarty Cats', u: 'https://www.montana.edu/aycss/success/smartycats/', d: 'MSU’s peer study sessions, which offer some support for M 172.', k: 'msu', tags: ['tutoring'] }
  ],

  COURSE: {
    code: 'M 172', name: 'Calculus II', term: 'Fall 2026', school: 'Montana State University', credits: 4, section: '1 pm',
    instructor: 'Dr. Rob Malo', instructorEmail: 'malo@montana.edu', instructorRoom: 'Wilson Hall 2-252',
    officeHours: 'Mon and Wed 9:15–10:45, and by appointment (Wilson Hall 2-252)',
    lectures: 'Class Mon · Wed · Fri (this syllabus is the 1 pm section’s), plus a required lab on Tuesday or Thursday', classDays: 'Mon · Wed · Fri, plus lab on Tue or Thu', weeklyHours: 12,
    site: CANVAS, canvas: CANVAS,
    textbook: { title: 'Active Calculus (free online)', url: AC },
    links: [
      { eyebrow: 'Textbook', title: 'Active Calculus', url: AC, desc: 'Free online. Chapters 5–7 follow it directly.' },
      { eyebrow: 'Textbook', title: 'Active Calculus chapter 8 (first edition)', url: 'https://activecalculus.org/single1e/C-8.html', desc: 'Sequences and series, numbered 8.1–8.6 as on the syllabus.' },
      { eyebrow: 'Homework', title: 'WeBWorK', url: WEBWORK, desc: 'One assignment per section, due 8:00 pm Tuesdays and Fridays.' },
      { eyebrow: 'Labs', title: 'Gradescope', url: GRADESCOPE, desc: 'Turn in each group lab sheet here.' },
      { eyebrow: 'Course site', title: 'Canvas', url: CANVAS, desc: 'Announcements, the textbook and homework links, and grades.' }
    ],
    helpCenter: { name: 'Math & Stat Center', where: 'Romney Hall 220', hours: 'Face-to-face help; hours on its website' },
    disability: { where: 'Romney Hall 137', url: 'https://www.montana.edu/disabilityservices/' },
    deadlines: [
      { name: 'WeBWorK', rule: 'One assignment per section, typically due Tuesdays and Fridays at 8:00 pm. Work turned in by 11:59 pm the same day still gets full credit; after that, none. Most solutions appear at noon the next day.' },
      { name: 'Lab sheets', rule: 'Labs are group work on Tuesday or Thursday, with at least one laptop per group. Each group turns in one lab sheet with its written work in Gradescope. Lab material is often new, and it is on the exams.' },
      { name: 'Quizzes', rule: 'Given in class. No make-ups without a university-approved absence arranged beforehand; your lowest two quiz scores are dropped.' },
      { name: 'Exam conflicts', rule: 'Only for extreme circumstances: email Dr. Rob Malo (malo@montana.edu), the Assistant Calculus Coordinator, before the exam, ideally a week ahead, with your full name, section, the reason and which exams. Work and travel do not count.' }
    ]
  },

  GRADING: {
    categories: [
      { id: 'exam1', name: 'Exam 1 (5.3–6.1)', weight: 19 },
      { id: 'exam2', name: 'Exam 2 (6.2–6.5)', weight: 19 },
      { id: 'exam3', name: 'Exam 3 (7.1–8.3)', weight: 19 },
      { id: 'exam4', name: 'Exam 4 (finals week)', weight: 19 },
      { id: 'prework', name: 'Prework', weight: 3 },
      { id: 'quizzes', name: 'Quizzes (lowest two dropped)', weight: 7 },
      { id: 'webwork', name: 'WeBWorK', weight: 7 },
      { id: 'labs', name: 'Labs', weight: 7 }
    ],
    finalId: 'exam4',
    note: 'Work is graded on a 4-point scale; a percentage here is your 4-point average divided by 4 (3.3 out of 4 is 82.5%).',
    scale: [
      { letter: 'A', min: 93.75, fourPt: '3.75 – 4.00' },
      { letter: 'A-', min: 90, fourPt: '3.60 – 3.74' },
      { letter: 'B+', min: 87.5, fourPt: '3.50 – 3.59' },
      { letter: 'B', min: 82.5, fourPt: '3.30 – 3.49' },
      { letter: 'B-', min: 75, fourPt: '3.00 – 3.29' },
      { letter: 'C+', min: 72.5, fourPt: '2.90 – 2.99' },
      { letter: 'C', min: 70, fourPt: '2.80 – 2.89' },
      { letter: 'C-', min: 67.5, fourPt: '2.70 – 2.79' },
      { letter: 'D', min: 62.5, fourPt: '2.50 – 2.69' },
      { letter: 'F', min: 0, fourPt: '0 – 2.49' }
    ],
    rubric: [
      { score: 4, name: 'Complete', desc: 'Comprehensive, thoughtful understanding. Organized and complete, with your ideas and math thinking fully explained and correct notation. May contain a trivial error.' },
      { score: 3, name: 'Substantial', desc: 'Enough detail to show you understood the problem. Mostly organized, explains your ideas and thinking. May contain some errors.' },
      { score: 2, name: 'Developing', desc: 'Not enough detail to show understanding, or your thinking is not clearly explained. May have significant gaps, be unorganized or unclear, or be incomplete.' },
      { score: 1, name: 'Minimal', desc: 'No details, does not make sense, or has no explanation of ideas or math thinking.' },
      { score: 0, name: 'No credit', desc: 'Not seriously attempted.' }
    ]
  },

  SEMESTER: { start: '2026-08-24', end: '2026-12-18' },
  VARIANTS: { label: 'Your lab day', default: 'tue', hint: 'Pick the day of your lab so the calendar shows only your lab.', options: [{ id: 'tue', label: 'Tuesday lab' }, { id: 'thu', label: 'Thursday lab' }] },
  EXAMS: [
    { id: 'exam1', n: 1, name: 'Exam 1', date: '2026-09-23', dateLabel: 'Wed Sept 23, in class', covers: '5.3–6.1: substitution, integration by parts, partial fractions, trigonometric substitution, and area and arc length', sections: ['sub', 'parts', 'pfd', 'trigsub', 'area', 'arclength'], units: [1], weight: 19, format: EXAM_FORMAT },
    { id: 'exam2', n: 2, name: 'Exam 2', date: '2026-10-14', dateLabel: 'Wed Oct 14, in class', covers: '6.2–6.5: volumes by washers and shells, density and center of mass, work and fluid force, and improper integrals', sections: ['washers', 'shells', 'density', 'work', 'fluid', 'improper'], units: [2], weight: 19, format: EXAM_FORMAT },
    { id: 'exam3', n: 3, name: 'Exam 3', date: '2026-11-09', dateLabel: 'Mon Nov 9, in class', covers: '7.1–8.3: differential equations (slope fields, equilibria, Euler’s method, separable equations), sequences, geometric series and series of real numbers', sections: ['odes', 'qualitative', 'euler', 'separable', 'sequences', 'geometric', 'series'], units: [3, 4], weight: 19, format: EXAM_FORMAT },
    { id: 'exam4', n: 4, name: 'Exam 4', date: '2026-12-14', endDate: '2026-12-17', dateLabel: 'Finals week (Dec 14–17), at the common-hour time; day and time to be announced', covers: 'The syllabus does not list Exam 4’s sections. Following the first three exams, expect 8.4 onward: alternating series, Taylor series, power series, Euler’s formula and Fourier series. Ask in class whether it is cumulative.', sections: ['ast', 'taylor', 'power', 'eulerformula', 'fourier'], units: [5], weight: 19, format: 'In finals week at its common-hour time. No calculators, phones, earbuds or other electronics, and show all your work.' }
  ],
  CALENDAR: [
    L('2026-08-26', 'Syllabus and prerequisites'),
    ADMIN('2026-08-27', 'No lab this week'),
    L('2026-08-28', '5.3 Substitution', 'sub'),
    L('2026-08-31', '5.3 Substitution, continued', 'sub'),
    ...LAB(1, '2026-09-01', '2026-09-03'),
    L('2026-09-02', '5.4 Integration by parts', 'parts'),
    L('2026-09-04', '5.4 Integration by parts, continued', 'parts'),
    NO('2026-09-07', 'Labor Day, no class'),
    ...LAB(2, '2026-09-08', '2026-09-10'),
    L('2026-09-09', '5.5 Other options: partial fractions', 'pfd'),
    L('2026-09-11', '5.5 Partial fractions, continued', 'pfd'),
    L('2026-09-14', '5.5 Other options: trigonometric substitution', 'trigsub'),
    ...LAB(3, '2026-09-15', '2026-09-17'),
    L('2026-09-16', '6.1 Area between curves', 'area'),
    ADMIN('2026-09-16', 'Last day to drop without a W'),
    L('2026-09-18', '6.1 Arc length', 'arclength'),
    L('2026-09-21', '6.2 Volume by washers', 'washers'),
    ...LAB(4, '2026-09-22', '2026-09-24'),
    ['2026-09-23', 'exam', 'Exam 1 (5.3–6.1), in class'],
    L('2026-09-25', '6.2 Volume by shells', 'shells'),
    L('2026-09-28', '6.3 Density, mass and center of mass', 'density'),
    ...LAB(5, '2026-09-29', '2026-10-01'),
    L('2026-09-30', '6.3 Density, continued', 'density'),
    L('2026-10-02', '6.4 Work', 'work'),
    L('2026-10-05', '6.4 Fluid force', 'fluid'),
    ...LAB(6, '2026-10-06', '2026-10-08'),
    L('2026-10-07', '6.5 Improper integrals', 'improper'),
    L('2026-10-09', '6.5 Improper integrals, continued', 'improper'),
    L('2026-10-12', '7.1 Introduction to differential equations', 'odes'),
    ...LAB(7, '2026-10-13', '2026-10-15'),
    ['2026-10-14', 'exam', 'Exam 2 (6.2–6.5), in class'],
    L('2026-10-16', '7.2 Qualitative behavior of solutions', 'qualitative'),
    L('2026-10-19', '7.2/7.3 Slope fields and Euler’s method', 'euler'),
    ...LAB(8, '2026-10-20', '2026-10-22'),
    L('2026-10-21', '7.4 Separable differential equations', 'separable'),
    L('2026-10-23', '7.4 Separable equations, continued', 'separable'),
    L('2026-10-26', '8.1 Sequences', 'sequences'),
    ...LAB(9, '2026-10-27', '2026-10-29'),
    L('2026-10-28', '8.2 Geometric series', 'geometric'),
    L('2026-10-30', '8.3 Series of real numbers', 'series'),
    L('2026-11-02', '8.3 Series, continued', 'series'),
    ...LAB(10, '2026-11-03', '2026-11-05'),
    L('2026-11-04', '8.3 Series, continued', 'series'),
    L('2026-11-06', '8.4 Alternating series test', 'ast'),
    ['2026-11-09', 'exam', 'Exam 3 (7.1–8.3), in class'],
    ...LAB(11, '2026-11-10', '2026-11-12'),
    NO('2026-11-11', 'Veterans Day, no class'),
    L('2026-11-13', '8.4 Alternating series, continued', 'ast'),
    L('2026-11-16', '8.5 Taylor polynomials and Taylor series', 'taylor'),
    ...LAB(12, '2026-11-17', '2026-11-19'),
    L('2026-11-18', '8.5 Taylor series, continued', 'taylor'),
    ADMIN('2026-11-18', 'Last day to drop with a W'),
    L('2026-11-20', '8.6 Power series', 'power'),
    NO('2026-11-23', 'Fall break'), NO('2026-11-24', 'Fall break'), NO('2026-11-25', 'Fall break'), NO('2026-11-26', 'Fall break (Thanksgiving)'), NO('2026-11-27', 'Fall break'),
    L('2026-11-30', '8.6 Power series, continued', 'power'),
    ...LAB(13, '2026-12-01', '2026-12-03'),
    L('2026-12-02', 'Euler’s formula', 'eulerformula'),
    L('2026-12-04', 'Euler’s formula, continued', 'eulerformula'),
    L('2026-12-07', 'Fourier series', 'fourier'),
    ...LAB(14, '2026-12-08', '2026-12-10'),
    L('2026-12-09', 'Fourier series, continued', 'fourier'),
    L('2026-12-11', 'Fourier series, continued', 'fourier'),
    ['2026-12-14', 'exam', 'Finals week: Exam 4 at its common-hour time (day and time to be announced, Dec 14–17)']
  ],
  CALENDAR_NOTE: 'Class meets Mon · Wed · Fri, and your lab meets Tuesday or Thursday (choose your lab day in Settings). The calendar is the syllabus’s tentative one: your instructor may change it, and Canvas wins. WeBWorK is typically due at 8:00 pm on Tuesdays and Fridays.',
  RECURRING: [
    { dows: [2, 5], time: '8:00 pm', title: 'WeBWorK due (full credit until 11:59 pm)', from: '2026-09-01', to: '2026-12-11', skipHolidays: true }
  ],

  UNITS: [
    { n: 1, title: 'Integration techniques, area and arc length', sections: ['sub', 'parts', 'pfd', 'trigsub', 'area', 'arclength'], exam: 'exam1' },
    { n: 2, title: 'Volume, mass, work, force and improper integrals', sections: ['washers', 'shells', 'density', 'work', 'fluid', 'improper'], exam: 'exam2' },
    { n: 3, title: 'Differential equations', sections: ['odes', 'qualitative', 'euler', 'separable'], exam: 'exam3' },
    { n: 4, title: 'Sequences and series', sections: ['sequences', 'geometric', 'series'], exam: 'exam3' },
    { n: 5, title: 'Alternating, Taylor, power and Fourier series', sections: ['ast', 'taylor', 'power', 'eulerformula', 'fourier'], exam: 'exam4' }
  ],
  SECTIONS: N.SECTIONS,
  FORMULAS: N.FORMULAS,
  FLASHCARDS: N.FLASHCARDS,
  PRACTICE: N.PRACTICE,
  CHECKLISTS: N.CHECKLISTS,

  INFO: [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
      <li><b>Format:</b> active-learning class Mon · Wed · Fri plus a required lab on Tuesday or Thursday. Labs often bring new material, and it is on the exams. 4 credits: plan on at least 12 hours a week.</li>
      <li><b>Instructor:</b> Dr. Rob Malo, <a href="mailto:malo@montana.edu">malo@montana.edu</a>, Wilson Hall 2-252. Office hours Mon and Wed 9:15–10:45 and by appointment.</li>
      <li><b>Graduate assistant:</b> Ziyal Jandrasi, <a href="mailto:ziyaljandrasi@montana.edu">ziyaljandrasi@montana.edu</a>, Wilson Hall 1-136. Office hours Tue and Thu 2:35–3:25, Fri 2:40–3:30, and by appointment.</li>
      <li><b>Materials:</b> the free <a href="${AC}" target="_blank" rel="noopener">Active Calculus</a> textbook online, internet access for WeBWorK, and at least one laptop per lab group. A calculator or computer helps with some homework, but no electronics are allowed on quizzes or exams.</li>
      <li>These details are from the 1 pm section’s syllabus. In another section, check your own syllabus for your instructor and office hours.</li></ul>` },
    { icon: 'calc', title: 'Grading', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th class="num">Share</th></tr></thead><tbody>
      <tr><td>Four exams (19% each)</td><td class="num">76%</td></tr><tr><td>Quizzes (lowest two dropped)</td><td class="num">7%</td></tr><tr><td>WeBWorK</td><td class="num">7%</td></tr><tr><td>Labs</td><td class="num">7%</td></tr><tr><td>Prework</td><td class="num">3%</td></tr></tbody></table></div>
      <p class="small mt-1">Everything is graded on a 4-point scale. A 3.75–4.00 · A- 3.60 · B+ 3.50 · B 3.30 · B- 3.00 · C+ 2.90 · C 2.80 · C- 2.70 · D 2.50 · F below 2.50. <b>Correct answers with little or no supporting work get little or no credit.</b></p>` },
    { icon: 'flag', title: 'Exams', html: `<ul class="list-plain small">
      <li><b>Exam 1</b> Wed Sept 23 (5.3–6.1) · <b>Exam 2</b> Wed Oct 14 (6.2–6.5) · <b>Exam 3</b> Mon Nov 9 (7.1–8.3), all in class.</li>
      <li><b>Exam 4</b> is in finals week (Dec 14–17) at its assigned common-hour time.</li>
      <li><b>No electronics:</b> no calculators, phones, computers or earbuds during quizzes and exams. If you leave the room without checking in with the instructional team, you cannot continue the exam.</li>
      <li><b>Conflicts:</b> extreme circumstances only. Email Dr. Rob Malo before the exam, ideally a week ahead, with your full name, section, the reason and which exams. Work schedules and travel plans do not count.</li></ul>` },
    { icon: 'clock', title: 'Homework, labs and quizzes', html: `<ul class="list-plain small">
      <li><b>WeBWorK:</b> an assignment for each section, typically due Tuesdays and Fridays at 8:00 pm, with full credit until 11:59 pm that day and nothing after. Most solutions appear at noon the next day. Start early and spread each assignment over a couple of days.</li>
      <li><b>Labs:</b> small groups, at least one laptop per group, free software. Each group turns in one lab sheet of written work in Gradescope.</li>
      <li><b>Quizzes:</b> several, in class. No make-ups unless you arrange a university-approved absence beforehand; the lowest two are dropped.</li>
      <li><b>Prework:</b> 3% of your grade; follow Canvas for what each class asks you to do beforehand.</li></ul>` },
    { icon: 'list', title: 'Written work', html: `<p class="small">Show all your work, explain your reasoning in words as well as equations, use correct notation, and keep problems neat and in order. Do not hand in scratch paper. Equations without explanation do not get full credit, and answers alone get little or none. Each item is scored 4 (complete), 3 (substantial), 2 (developing), 1 (minimal) or 0 (not seriously attempted); the rubric is on the Grade calculator page.</p>` },
    { icon: 'shield', title: 'AI and academic integrity', html: `<ul class="list-plain small">
      <li><b>AI is allowed as a support tool for learning</b>, but it must not replace your own thinking, problem solving or written work. Everything you submit must show your own understanding.</li>
      <li>Answers from solution manuals or Q&amp;A sites count as cheating unless the instructor allows them; acknowledge collaborators and cite sources. Copying another student’s finished work makes both of you responsible.</li>
      <li>Mathub fits the policy when you use it to practise and to check your understanding: attempt each problem yourself first.</li></ul>` },
    { icon: 'users', title: 'Where to get help', html: `<ul class="list-plain small">
      <li><b>Office hours</b> with Dr. Malo or Ziyal Jandrasi, which the syllabus strongly encourages.</li>
      <li><b>Math & Stat Center</b>, Romney Hall 220 (<a href="https://www.montana.edu/mathstatcenter/" target="_blank" rel="noopener">montana.edu/mathstatcenter</a>), and <b>Smarty Cats</b> study sessions.</li>
      <li><b>Study groups:</b> work with classmates on concepts and homework as much as you can.</li>
      <li><b>Accommodations:</b> Disability Services, Romney Hall 137 (<a href="https://www.montana.edu/disabilityservices/" target="_blank" rel="noopener">montana.edu/disabilityservices</a>). Ask as early as possible.</li>
      <li><b>If you are ill,</b> stay home, email your instructor as soon as you can, and use the course materials online.</li></ul>` },
    { icon: 'bulb', title: 'How to use Mathub for this class', html: `<p class="small">After each class, read that topic’s notes and do the flashcards the same day. Before WeBWorK, run a few quizzer questions on the section. Exams are by hand with no calculator and graded on your work, so do the practice sets on paper, writing every step and the sentence that explains it, before you open the solutions.</p>` }
  ],

  QUIZ
};
