/* M 170 Trigonometry for Calculus, Fall 2026 (Shari Kepner). Built from the Fall 2026 syllabus.
   Build:  node scripts/make-pack.js packs/src/m170.js
   Notes, formulas, flashcards, practice and checklists live in m170/notes.js; the question bank in m170/quiz.js.
   The syllabus has no schedule: no exam dates and no topic-by-topic calendar. The two exam dates below are
   Mathub's estimates (agreed with the site admin) and are labeled as estimates everywhere; the weekly topics
   follow the textbook's order and are labeled as estimated pacing. Replace both when the real dates are known. */
const N = require('./m170/notes.js');
const QUIZ = require('./m170/quiz.js');

const CANVAS = 'https://montana.instructure.com/';
const BOOK = 'https://openstax.org/details/books/algebra-and-trigonometry-2e';
const WEBWORK = 'https://webwork3.math.montana.edu/webwork2/F26M170';
const GRADESCOPE = 'https://www.gradescope.com/';
const CLASS = (date, sec, topic) => [date, 'lecture', `Wednesday class: lecture and group activities (estimated topic: ${topic})`, sec];
const NO = (date, why) => [date, 'holiday', why];
const EST = 'The syllabus gives no date: this is Mathub’s estimate. Check Canvas or ask in class for the real date.';
const EXAM_FORMAT = 'In class, on paper. No calculators, electronics or phones. Show your work and explain it: answers alone get little or no credit.';

module.exports = {
  format: 'mathub-class-pack', version: 1,
  id: 'm170', code: 'M 170', name: 'Trigonometry for Calculus', short: 'Trig', term: 'Fall 2026', kind: 'math',
  tagline: 'Angles and radians, the unit circle, graphs, identities, inverse trig and the laws of sines and cosines',
  quizNote: 'Mathub wrote these questions from the course outcomes and the textbook; they are not the instructor’s. Exams allow no calculator, so work each one by hand. Type exact answers like sqrt(3)/2, 5pi/6 or -1/2, or a decimal; answers within 0.5% count.',
  formulasNote: 'The unit circle values, identities, graph features and triangle laws for M 170 on one page. Exams are closed-book with no calculator, so cover the right side and test yourself.',
  filterExample: 'unit circle, Law of Cosines',
  color: { light: '#A21CAF', dark: '#F0ABFC' },
  archetype: { name: 'Navigator', icon: 'compass', line: 'Finds any angle from two sides and a little trig.' },
  canvasMatch: ['M 170', 'M170', 'TRIGONOMETRY FOR CALCULUS', 'TRIG FOR CALC'],
  guides: ['math-exam', 'active-recall', 'webwork', 'office-hours'],
  resourcesBlurb: 'The free textbook and its videos, homework and grading sites, and second explanations for every topic.',
  resources: [
    { t: 'OpenStax Algebra and Trigonometry 2e (free textbook)', u: BOOK, d: 'The course textbook, chapters 7–10. Each section ends with links to short videos.', k: 'reading', tags: ['textbook', 'videos'], top: true },
    { t: 'WeBWorK F26 M170', u: WEBWORK, d: 'Online homework for every section, generally due Mondays at 8:00 pm. No late work: solutions post right away.', k: 'practice', tags: ['homework'], top: true },
    { t: 'Gradescope', u: GRADESCOPE, d: 'Weekly written homework goes to the M170 folder here.', k: 'app', tags: ['homework'] },
    { t: 'Paul’s Online Math Notes: trig cheat sheet (PDF)', u: 'https://tutorial.math.lamar.edu/pdf/trig_cheat_sheet.pdf', d: 'The unit circle, identities and inverse functions on two pages.', k: 'reference', tags: ['cheat sheet'], top: true },
    { t: 'Khan Academy: Trigonometry', u: 'https://www.khanacademy.org/math/trigonometry', d: 'Videos and practice on right triangles, the unit circle, graphs, identities and the laws of sines and cosines.', k: 'video', tags: ['videos', 'practice'] },
    { t: 'Desmos graphing calculator', u: 'https://www.desmos.com/calculator', d: 'Watch how A, B, C and D change a sine graph. Not allowed on exams.', k: 'tool', tags: ['graphing'] },
    { t: 'Math & Stat Center (Romney 220)', u: 'https://www.montana.edu/mathstatcenter/', d: 'Free drop-in help, Mon–Thu 9–6 and Fri 9–5.', k: 'msu', tags: ['tutoring'], top: true },
    { t: 'Smarty Cats', u: 'https://www.montana.edu/aycss/success/smartycats/', d: 'MSU peer study sessions, which offer some support for M 170.', k: 'msu', tags: ['tutoring'] },
    { t: 'Counseling & Psychological Services', u: 'https://www.montana.edu/counseling/', d: 'Free, confidential support, from the syllabus’s list of mental health resources.', k: 'wellbeing', tags: ['support'] },
    { t: 'WellTrack', u: 'https://montana.welltrack.com/', d: 'Self-guided wellbeing tools for MSU students.', k: 'wellbeing', tags: ['support'] }
  ],

  COURSE: {
    code: 'M 170', name: 'Trigonometry for Calculus', term: 'Fall 2026', school: 'Montana State University', credits: 1, section: '',
    instructor: 'Shari Kepner', instructorEmail: 'shari.kepner@montana.edu', instructorRoom: 'Wilson 1-112',
    officeHours: 'Tue 2:10–3:00 and Wed 1:10–2:00 in Wilson 1-112, or by appointment',
    lectures: 'Wednesdays: some lecture, mostly group activities', classDays: 'Wednesday', weeklyHours: 4,
    site: CANVAS, canvas: CANVAS,
    textbook: { title: 'OpenStax Algebra and Trigonometry 2e (free online)', url: BOOK },
    links: [
      { eyebrow: 'Textbook', title: 'Algebra and Trigonometry 2e', url: BOOK, desc: 'Free from OpenStax; chapters 7–10.' },
      { eyebrow: 'Homework', title: 'WeBWorK F26 M170', url: WEBWORK, desc: 'Due Mondays at 8:00 pm; no late work.' },
      { eyebrow: 'Written work', title: 'Gradescope', url: GRADESCOPE, desc: 'Weekly written homework, M170 folder.' },
      { eyebrow: 'Course site', title: 'Canvas', url: CANVAS, desc: 'All course material, worksheet solutions in Modules.' }
    ],
    helpCenter: { name: 'Math & Stat Center', where: 'Romney 220', hours: 'Mon–Thu 9–6 · Fri 9–5' },
    tutoring: 'Smarty Cats',
    disability: { where: '137 Romney Hall', url: 'https://www.montana.edu/drv/disability/student.htm' },
    deadlines: [
      { name: 'WeBWorK', rule: 'One assignment for each section covered in class, generally due Mondays at 8:00 pm. No late work is accepted, because solutions post immediately.' },
      { name: 'Written homework', rule: 'Weekly, done outside class and submitted to the M170 folder in Gradescope. 12 points: 8 for seriously attempting every part (skip one and you lose points), 4 for one question graded on the math you show. Solutions go up in Canvas Modules after the due date.' },
      { name: 'Quizzes', rule: 'In class. No make-ups unless you arrange a university-approved absence beforehand; your lowest quiz score(s) are dropped.' },
      { name: 'Exam conflicts', rule: 'Extreme circumstances only: contact your instructor before the exam, ideally a week ahead, with your full name, section, the reason and which exam. Work, travel and leaving early for holidays do not count.' }
    ]
  },

  GRADING: {
    categories: [
      { id: 'webwork', name: 'WeBWorK online homework', weight: 5 },
      { id: 'written1', name: 'Written homework and quizzes before Exam 1', weight: 10 },
      { id: 'exam1', name: 'Exam 1', weight: 35 },
      { id: 'written2', name: 'Written homework and quizzes before Exam 2', weight: 10 },
      { id: 'exam2', name: 'Exam 2', weight: 30 },
      { id: 'presentation', name: 'Final presentation', weight: 10 }
    ],
    finalId: 'exam2',
    note: 'Work is graded on a 4-point scale; a percentage here is your 4-point average divided by 4 (3.3 out of 4 is 82.5%).',
    scale: [
      { letter: 'A', min: 93.75, fourPt: '3.75 – 4.0' },
      { letter: 'A-', min: 91.25, fourPt: '3.65 – 3.75' },
      { letter: 'B+', min: 88.75, fourPt: '3.55 – 3.65' },
      { letter: 'B', min: 82.5, fourPt: '3.3 – 3.55' },
      { letter: 'B-', min: 75, fourPt: '3.0 – 3.3' },
      { letter: 'C+', min: 72.5, fourPt: '2.9 – 3.0' },
      { letter: 'C', min: 70, fourPt: '2.8 – 2.9' },
      { letter: 'C-', min: 67.5, fourPt: '2.7 – 2.8' },
      { letter: 'D', min: 62.5, fourPt: '2.5 – 2.7' },
      { letter: 'F', min: 0, fourPt: '0 – 2.5' }
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
  EXAMS: [
    { id: 'exam1', n: 1, name: 'Exam 1', date: '2026-10-14', dateLabel: 'Wed Oct 14, in class (estimated: the syllabus gives no date)', covers: 'Estimated from the textbook order: angles and radians, right triangle trigonometry and similar triangles, the unit circle, and the other trig functions. ' + EST, sections: ['angles', 'righttri', 'unitcircle', 'otherfns'], units: [1], weight: 35, format: EXAM_FORMAT },
    { id: 'exam2', n: 2, name: 'Exam 2', date: '2026-12-09', dateLabel: 'Wed Dec 9, in class (estimated: the syllabus gives no date)', covers: 'Estimated from the textbook order: graphs of sine and cosine, inverse trig functions, identities, sum, difference and double-angle formulas, and the Laws of Sines and Cosines. Ask whether it is cumulative. ' + EST, sections: ['graphs', 'inverse', 'identities', 'sumdiff', 'laws'], units: [2], weight: 30, format: EXAM_FORMAT }
  ],
  CALENDAR: [
    CLASS('2026-08-26', 'angles', 'angles, degrees and radians'),
    CLASS('2026-09-02', 'angles', 'arc length and coterminal angles'),
    NO('2026-09-07', 'Labor Day, no WeBWorK due'),
    CLASS('2026-09-09', 'righttri', 'right triangle trigonometry'),
    CLASS('2026-09-16', 'righttri', 'special triangles and similar triangles'),
    CLASS('2026-09-23', 'unitcircle', 'the unit circle'),
    CLASS('2026-09-30', 'unitcircle', 'reference angles'),
    CLASS('2026-10-07', 'otherfns', 'the other trig functions'),
    ['2026-10-14', 'exam', 'Exam 1, in class (estimated date; check Canvas)'],
    CLASS('2026-10-21', 'graphs', 'graphs of sine and cosine'),
    CLASS('2026-10-28', 'inverse', 'inverse trig functions'),
    CLASS('2026-11-04', 'identities', 'verifying identities'),
    NO('2026-11-11', 'Veterans Day, no class'),
    CLASS('2026-11-18', 'sumdiff', 'sum, difference and double-angle formulas'),
    NO('2026-11-23', 'Fall break, no WeBWorK due'), NO('2026-11-25', 'Fall break, no class'),
    CLASS('2026-12-02', 'laws', 'the Laws of Sines and Cosines'),
    ['2026-12-09', 'exam', 'Exam 2, in class (estimated date; check Canvas)']
  ],
  CALENDAR_NOTE: 'Class meets on Wednesdays. The syllabus has no schedule, so the weekly topics here follow the textbook’s order and the two exam dates are estimates: check Canvas for the real ones. WeBWorK is generally due Mondays at 8:00 pm.',
  RECURRING: [
    { dows: [1], time: '8:00 pm', title: 'WeBWorK due (no late work)', from: '2026-08-31', to: '2026-12-14', skipHolidays: true }
  ],

  UNITS: [
    { n: 1, title: 'Angles, triangles and the unit circle', sections: ['angles', 'righttri', 'unitcircle', 'otherfns'], exam: 'exam1' },
    { n: 2, title: 'Graphs, identities, inverses and the triangle laws', sections: ['graphs', 'inverse', 'identities', 'sumdiff', 'laws'], exam: 'exam2' }
  ],
  SECTIONS: N.SECTIONS,
  FORMULAS: N.FORMULAS,
  FLASHCARDS: N.FLASHCARDS,
  PRACTICE: N.PRACTICE,
  CHECKLISTS: N.CHECKLISTS,

  INFO: [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
      <li><b>Format:</b> one class a week, on Wednesdays: some lecture, mostly group activities. 1 credit: plan on at least 4 hours a week, including reading and homework.</li>
      <li><b>Instructor:</b> Shari Kepner, <a href="mailto:shari.kepner@montana.edu">shari.kepner@montana.edu</a>, Wilson 1-112. Office hours Tue 2:10–3:00, Wed 1:10–2:00, or by appointment.</li>
      <li><b>Textbook:</b> <a href="${BOOK}" target="_blank" rel="noopener">OpenStax Algebra and Trigonometry 2e</a>, free online. Canvas has all course material.</li>
      <li><b>Materials:</b> internet for the book, WeBWorK and Gradescope. A calculator helps with some homework and activities, but no electronics are allowed on quizzes or exams.</li></ul>` },
    { icon: 'calc', title: 'Grading', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th class="num">Share</th></tr></thead><tbody>
      <tr><td>Exam 1</td><td class="num">35%</td></tr><tr><td>Exam 2</td><td class="num">30%</td></tr><tr><td>Written homework and quizzes before Exam 1</td><td class="num">10%</td></tr><tr><td>Written homework and quizzes before Exam 2</td><td class="num">10%</td></tr><tr><td>Final presentation</td><td class="num">10%</td></tr><tr><td>WeBWorK</td><td class="num">5%</td></tr></tbody></table></div>
      <p class="small mt-1">Graded on a 4-point scale: A 3.75 (93.75%) · A- 3.65 · B+ 3.55 · B 3.3 · B- 3.0 · C+ 2.9 · C 2.8 · C- 2.7 · D 2.5 · F below 2.5.</p>` },
    { icon: 'flag', title: 'Exams and the final presentation', html: `<ul class="list-plain small">
      <li><b>Two exams, in class.</b> No calculators, no electronics, no phones.</li>
      <li><b>The syllabus gives no exam dates.</b> Mathub estimates Exam 1 on Wed Oct 14 and Exam 2 on Wed Dec 9; check Canvas or ask in class.</li>
      <li>The <b>final presentation</b> is 10% of your grade; its date and format will come from your instructor.</li>
      <li><b>Conflicts:</b> extreme circumstances only. Contact your instructor before the exam, ideally a week ahead, with your name, section, the reason and the exam. Work, travel and leaving early for holidays do not count; documentation may be requested.</li></ul>` },
    { icon: 'clock', title: 'Homework and quizzes', html: `<ul class="list-plain small">
      <li><b>WeBWorK:</b> an assignment for each section, generally due Mondays at 8:00 pm. No late work, since solutions post right away. Start early.</li>
      <li><b>Written homework:</b> weekly, to the M170 folder in Gradescope. You may work together and ask for help, but submit your own work. 8 of 12 points are for attempting every part; 4 are for one question graded on the math you show. Solutions go up in Canvas Modules afterwards: use them to study.</li>
      <li><b>Quizzes:</b> in class; no make-ups without an approved absence arranged beforehand. Your lowest quiz score(s) are dropped.</li></ul>` },
    { icon: 'list', title: 'Written work', html: `<p class="small">Show all your work, explain it in words as well as equations, use correct notation, and don’t hand in scratch paper. Equations without explanation do not get full credit, and answers alone get little or none. Each item is scored 4 (complete), 3 (substantial), 2 (developing), 1 (minimal) or 0 (not seriously attempted); the rubric is on the Grade calculator page.</p>` },
    { icon: 'shield', title: 'AI and academic integrity', html: `<ul class="list-plain small">
      <li><b>AI is allowed as a support tool for learning</b>, such as clarifying concepts, practice questions, checking your work or study plans, but not to replace your own thinking, problem solving or written work.</li>
      <li>The syllabus’s best practices: attempt the problem first, ask specific questions, and verify every result yourself.</li>
      <li>Answers from solution manuals or Q&amp;A sites count as cheating unless allowed; acknowledge collaborators and cite sources.</li>
      <li>Mathub fits the policy when you use it to practise and to check your understanding.</li></ul>` },
    { icon: 'users', title: 'Where to get help', html: `<ul class="list-plain small">
      <li><b>Textbook videos:</b> each section of the book ends with links to short videos.</li>
      <li><b>Office hours</b> with your instructor, which the syllabus strongly encourages.</li>
      <li><b>Math &amp; Stat Center</b>, Romney 220: Mon–Thu 9–6, Fri 9–5. <b>Smarty Cats</b> also supports M 170.</li>
      <li><b>Study groups:</b> work together on concepts and homework problems, but do your homework on your own.</li>
      <li><b>Accommodations:</b> Disability Services, 137 Romney Hall (<a href="https://www.montana.edu/drv/disability/student.htm" target="_blank" rel="noopener">details</a>). <b>Wellbeing:</b> <a href="https://www.montana.edu/counseling/" target="_blank" rel="noopener">Counseling &amp; Psychological Services</a>, <a href="https://www.montana.edu/oha/" target="_blank" rel="noopener">Health Advancement</a>, <a href="https://www.montana.edu/health/" target="_blank" rel="noopener">Medical Services</a>, <a href="https://montana.welltrack.com/" target="_blank" rel="noopener">WellTrack</a>.</li></ul>` },
    { icon: 'bulb', title: 'How to use Mathub for this class', html: `<p class="small">Learn the unit circle first: run its flashcards until you can write the first quadrant from memory and get the others by symmetry. After each Wednesday class, read that topic’s notes and do a few quizzer questions before the Monday WeBWorK. Exams are by hand with no calculator, so do the practice sets on paper and explain every step.</p>` }
  ],

  QUIZ
};
