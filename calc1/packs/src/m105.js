/* M 105 Contemporary Mathematics with M 005 (co-requisite section 903), Fall 2026 (Steven Durtka).
   Built from the Fall 2026 syllabus.  Build:  node scripts/make-pack.js packs/src/m105.js
   Notes, formulas, flashcards, practice and checklists live in m105/notes.js; the question bank in m105/quiz.js.
   The syllabus has no schedule: no unit list, no test dates and no class days. The four units follow the course
   description (numbers and units; linear and exponential relations; financial mathematics; probability and
   statistics), and the test dates and weekly topics are Mathub's estimates, labeled as estimates everywhere.
   Replace them when the Canvas schedule is known. */
const N = require('./m105/notes.js');
const QUIZ = require('./m105/quiz.js');

const CANVAS = 'https://montana.instructure.com/';
const MOM = 'https://www.myopenmath.com/';
const MSC = 'https://math.montana.edu/undergrad/msc/index.html';
const AYCSS = 'https://www.montana.edu/aycss/';
const DISABILITY = 'https://www.montana.edu/disabilityservices/';
const WEEK = (date, sec, topic) => [date, 'lecture', `This week (estimated): ${topic}`, sec];
const NO = (date, why) => [date, 'holiday', why];
const TEST_FORMAT = 'In class, at the scheduled time. Bring your TI-30XS MultiView: phones, smartwatches, smart glasses and any device with internet or recording are not allowed (a referral for academic dishonesty). One unit test can be retaken at the end of the semester; a missed test counts as zero until it becomes your retake.';

module.exports = {
  format: 'mathub-class-pack', version: 1,
  id: 'm105', code: 'M 105', name: 'Contemporary Mathematics', short: 'M 105', term: 'Fall 2026', kind: 'math',
  tagline: 'Units and big numbers, percentages, linear and exponential growth, money, probability and statistics',
  quizNote: 'Mathub wrote these questions from the course description; they are not the instructor’s. Tests allow the TI-30XS MultiView, so use a calculator like it. Type plain numbers (no commas, $ or % signs); fractions like 13/52 work, and answers within 0.5% count.',
  formulasNote: 'The conversions, percent rules, growth, money, statistics and probability formulas for M 105 on one page. Cover the right side and test yourself.',
  filterExample: 'APY, half-life, z-score',
  color: { light: '#047857', dark: '#6EE7B7' },
  archetype: { name: 'Analyst', icon: 'chart', line: 'Reads the numbers in the news and asks what they really mean.' },
  canvasMatch: ['M 105', 'M105', 'M 005', 'M005', 'CONTEMPORARY MATHEMATICS', 'CONTEMPORARY MATH'],
  guides: ['math-exam', 'active-recall', 'office-hours'],
  resourcesBlurb: 'Homework, help on campus and second explanations for every topic.',
  resources: [
    { t: 'Canvas', u: CANVAS, d: 'Course modules, the Daily and Unit Homework Schedules, lecture videos, notes uploads and grades.', k: 'msu', tags: ['course site'], top: true },
    { t: 'MyOpenMath (through Canvas)', u: MOM, d: 'Online homework, linked in Canvas: three attempts on most questions, due the next class day at 11 pm, open until 8 am on test day.', k: 'practice', tags: ['homework'], top: true },
    { t: 'Math & Stat Center (Romney 220)', u: MSC, d: 'Free drop-in help Mon–Thu 9–6 and Fri 9–5. Bring your student ID and your packet.', k: 'msu', tags: ['tutoring'], top: true },
    { t: 'Allen Yarnell Center for Student Success', u: AYCSS, d: 'SmartyCats tutors, MathUp (FlowZone) sessions, workshops and success advisors. SUB 177, 406-994-7627.', k: 'msu', tags: ['tutoring'] },
    { t: 'Khan Academy: Statistics and probability', u: 'https://www.khanacademy.org/math/statistics-probability', d: 'Videos and practice on describing data, the normal distribution, studies and probability.', k: 'video', tags: ['videos', 'practice'] },
    { t: 'Khan Academy: Exponential growth and decay', u: 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:exponential-growth-decay', d: 'Growth factors, decay and comparing linear with exponential growth.', k: 'video', tags: ['videos'] },
    { t: 'Desmos graphing calculator', u: 'https://www.desmos.com/calculator', d: 'See linear and exponential models side by side. Not allowed on tests.', k: 'tool', tags: ['graphing'] },
    { t: 'Counseling & Psychological Services', u: 'https://www.montana.edu/counseling/', d: 'Free, confidential support, from the syllabus’s list of mental health resources.', k: 'wellbeing', tags: ['support'] },
    { t: 'WellTrack', u: 'https://montana.welltrack.com/', d: 'Self-guided wellbeing tools for MSU students.', k: 'wellbeing', tags: ['support'] }
  ],

  COURSE: {
    code: 'M 105', name: 'Contemporary Mathematics', term: 'Fall 2026', school: 'Montana State University', credits: 3, section: '903',
    instructor: 'Steven Durtka, M.S.', instructorEmail: 'steven.durtka@montana.edu', instructorRoom: 'Hamilton Hall 201',
    officeHours: 'Tue and Thu 11:00 am–12:00 pm in Hamilton 201 (tentative), or by appointment',
    lectures: 'Section 903, with the M 005 co-requisite: a prep video and notes before most classes, then the rest of the lesson in class', classDays: 'Your section’s class days (see your schedule)', weeklyHours: 8,
    site: CANVAS, canvas: CANVAS,
    textbook: { title: 'M 005/105 Class Notes and Worksheets packet (MSU Bookstore, white cover, sections 891, 901–907, 991)' },
    links: [
      { eyebrow: 'Course site', title: 'Canvas', url: CANVAS, desc: 'Modules, homework schedules, lecture videos and grades.' },
      { eyebrow: 'Homework', title: 'MyOpenMath', url: MOM, desc: 'Linked in Canvas; no fee.' },
      { eyebrow: 'Help', title: 'Math & Stat Center', url: MSC, desc: 'Romney 220: Mon–Thu 9–6, Fri 9–5.' },
      { eyebrow: 'Tutoring', title: 'Center for Student Success', url: AYCSS, desc: 'SmartyCats, MathUp (FlowZone), workshops.' }
    ],
    helpCenter: { name: 'Math & Stat Center', where: 'Romney 220', hours: 'Mon–Thu 9–6 · Fri 9–5' },
    tutoring: 'SmartyCats and MathUp (FlowZone) at the Center for Student Success',
    disability: { where: '137 Romney Hall', url: DISABILITY },
    deadlines: [
      { name: 'Notes', rule: 'Before most classes, watch the first part of the lecture video and take notes on the problems in the Daily Work Schedule; your instructor checks them at the start of class. Missed it? Come anyway, finish the notes, and upload them in Canvas within three class days. Up to eight uploads count (scored 4.99, which does not hurt your grade).' },
      { name: 'Online homework (MyOpenMath)', rule: 'Usually due the next M 105 class day at 11 pm; it stays open, and can be improved, until 8 am on the day of the unit test. Three attempts on most questions; after that use "Similar Question", but get help first.' },
      { name: 'Written homework (worksheets)', rule: 'Worksheets from the notes packet, usually due at 11 pm the next class day. Each problem is 1 point (fully acceptable) or 0 (circled: needs improvement). On-time worksheets can be corrected and resubmitted once by the final submission date; late ones may not be correctable.' },
      { name: 'Unit tests', rule: 'In class at the scheduled time; exceptions must be arranged with your instructor before the test. A missed test counts as zero, and becomes the one test you retake at the end of the semester.' },
      { name: 'Final exam', rule: 'Comprehensive, at a common hour, not in your classroom. Time, date and room are announced later in the semester.' },
      { name: 'Dropping', rule: 'Last day to drop without a grade: Wednesday, September 16. Last day to withdraw with a W: Wednesday, November 18.' }
    ]
  },

  GRADING: {
    categories: [
      { id: 'online', name: 'Online homework (MyOpenMath)', weight: 5 },
      { id: 'written', name: 'Written homework (worksheets)', weight: 15 },
      { id: 'notes', name: 'Notes', weight: 5 },
      { id: 'tests', name: 'Unit tests', weight: 50 },
      { id: 'final', name: 'Final exam', weight: 25 }
    ],
    finalId: 'final',
    note: 'M 005 is pass/fail: a C or higher in M 105 passes M 005; a D or F in M 105 gives an F* in M 005. M 005 does not count toward college credit or your GPA.',
    scale: [
      { letter: 'A', min: 90 },
      { letter: 'B+', min: 87 },
      { letter: 'B', min: 80 },
      { letter: 'C+', min: 77 },
      { letter: 'C', min: 70 },
      { letter: 'D', min: 60 },
      { letter: 'F', min: 0 }
    ]
  },

  SEMESTER: { start: '2026-08-24', end: '2026-12-18' },
  EXAMS: [
    { id: 'test1', n: 1, name: 'Test 1', date: '2026-09-17', dateLabel: 'Thu Sep 17, in class (estimated: the syllabus gives no date)', covers: 'units and conversions, percentages and relative change, and large numbers and estimation (estimated date: check Canvas)', sections: ['units', 'percent', 'bignum'], units: [1], weight: 12.5, format: TEST_FORMAT },
    { id: 'test2', n: 2, name: 'Test 2', date: '2026-10-08', dateLabel: 'Thu Oct 8, in class (estimated: the syllabus gives no date)', covers: 'linear relations, exponential growth and decay, and doubling time and half-life (estimated date: check Canvas)', sections: ['linear', 'expgrowth', 'doubling'], units: [2], weight: 12.5, format: TEST_FORMAT },
    { id: 'test3', n: 3, name: 'Test 3', date: '2026-10-29', dateLabel: 'Thu Oct 29, in class (estimated: the syllabus gives no date)', covers: 'budgets, simple and compound interest, savings plans and loans (estimated date: check Canvas)', sections: ['budget', 'interest', 'savings', 'loans'], units: [3], weight: 12.5, format: TEST_FORMAT },
    { id: 'test4', n: 4, name: 'Test 4', date: '2026-12-10', dateLabel: 'Thu Dec 10, in class (estimated: the syllabus gives no date)', covers: 'statistical studies, describing data, the normal distribution, probability and expected value (estimated date: check Canvas)', sections: ['studies', 'describe', 'normal', 'prob', 'expected'], units: [4], weight: 12.5, format: TEST_FORMAT },
    { id: 'final', n: 5, name: 'Final exam', date: '2026-12-16', dateLabel: 'Finals week, Dec 14–18 (estimated: the common-hour time and room are announced later, not in your classroom)', covers: 'everything in the course (the final is comprehensive)', sections: ['units', 'percent', 'bignum', 'linear', 'expgrowth', 'doubling', 'budget', 'interest', 'savings', 'loans', 'studies', 'describe', 'normal', 'prob', 'expected'], units: [1, 2, 3, 4], weight: 25, format: 'Comprehensive, at a common hour for all sections, not in your regular classroom. Bring your TI-30XS MultiView; no phones or smart devices.' }
  ],
  CALENDAR: [
    WEEK('2026-08-24', 'units', 'units and unit conversions'),
    WEEK('2026-08-31', 'percent', 'percentages and relative change'),
    NO('2026-09-07', 'Labor Day: no classes'),
    WEEK('2026-09-08', 'bignum', 'large numbers, scientific notation and estimation'),
    ['2026-09-14', 'review', 'Review for Test 1 (estimated)', 'bignum'],
    ['2026-09-16', 'admin', 'Last day to drop without a grade'],
    ['2026-09-17', 'exam', 'Test 1, in class (estimated date; check Canvas)'],
    WEEK('2026-09-21', 'linear', 'linear relations and rates of change'),
    WEEK('2026-09-28', 'expgrowth', 'exponential growth and decay'),
    WEEK('2026-10-05', 'doubling', 'doubling time and half-life'),
    ['2026-10-08', 'exam', 'Test 2, in class (estimated date; check Canvas)'],
    WEEK('2026-10-12', 'budget', 'budgets and the cost of habits'),
    ['2026-10-14', 'lecture', 'Later this week (estimated): simple and compound interest, APY', 'interest'],
    WEEK('2026-10-19', 'savings', 'savings plans'),
    WEEK('2026-10-26', 'loans', 'loans, credit cards and mortgages'),
    ['2026-10-29', 'exam', 'Test 3, in class (estimated date; check Canvas)'],
    WEEK('2026-11-02', 'studies', 'statistical studies and the news'),
    WEEK('2026-11-09', 'describe', 'describing data: center and spread'),
    NO('2026-11-11', 'Veterans Day: no classes'),
    WEEK('2026-11-16', 'normal', 'the normal distribution'),
    ['2026-11-18', 'admin', 'Last day to withdraw with a W'],
    NO('2026-11-23', 'Fall break (Nov 23–27): no classes'),
    WEEK('2026-11-30', 'prob', 'probability basics'),
    WEEK('2026-12-07', 'expected', 'expected value and the law of large numbers'),
    ['2026-12-10', 'exam', 'Test 4, in class (estimated date; check Canvas)'],
    ['2026-12-14', 'review', 'Finals week: the common-hour final and the one unit-test retake (dates announced later)'],
    ['2026-12-16', 'exam', 'Final exam (estimated date; time and room announced later)']
  ],
  CALENDAR_NOTE: 'The syllabus has no schedule, so the weekly topics follow the course description and the test dates are estimates: check Canvas (the Daily and Unit Homework Schedules) for the real ones. Online and written homework is usually due at 11 pm the next class day.',

  UNITS: [
    { n: 1, title: 'Numbers in context: units, percentages and large numbers', sections: ['units', 'percent', 'bignum'], exam: 'test1' },
    { n: 2, title: 'Linear and exponential relations', sections: ['linear', 'expgrowth', 'doubling'], exam: 'test2' },
    { n: 3, title: 'Financial mathematics', sections: ['budget', 'interest', 'savings', 'loans'], exam: 'test3' },
    { n: 4, title: 'Probability and statistics', sections: ['studies', 'describe', 'normal', 'prob', 'expected'], exam: 'test4' }
  ],
  SECTIONS: N.SECTIONS,
  FORMULAS: N.FORMULAS,
  FLASHCARDS: N.FLASHCARDS,
  PRACTICE: N.PRACTICE,
  CHECKLISTS: N.CHECKLISTS,

  INFO: [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
      <li><b>M 105 with M 005, section 903.</b> M 105 is 3 college credits (Core 2.0 Quantitative Reasoning, Q). M 005 is 1 credit that does not count toward a degree or your GPA, but can count for financial aid.</li>
      <li><b>Instructor:</b> Steven Durtka, M.S., <a href="mailto:steven.durtka@montana.edu">steven.durtka@montana.edu</a>, Hamilton Hall 201. Office hours Tue and Thu 11 am–12 pm (tentative), or by appointment. Check your email daily.</li>
      <li><b>Materials:</b> the M 005/105 Class Notes and Worksheets packet from the MSU Bookstore (white cover; keep it in a 3-ring binder) and a <b>TI-30XS MultiView</b> calculator (not the TI-30X IIS). MyOpenMath is free through Canvas.</li>
      <li><b>Time:</b> plan on about 2 hours after each class day for homework and the next prep video.</li></ul>` },
    { icon: 'calc', title: 'Grading', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th class="num">Share</th></tr></thead><tbody>
      <tr><td>Unit tests</td><td class="num">50%</td></tr><tr><td>Final exam</td><td class="num">25%</td></tr><tr><td>Written homework (worksheets)</td><td class="num">15%</td></tr><tr><td>Online homework (MyOpenMath)</td><td class="num">5%</td></tr><tr><td>Notes</td><td class="num">5%</td></tr></tbody></table></div>
      <p class="small mt-1">A 90–100 · B+ 87–89 · B 80–86 · C+ 77–79 · C 70–76 · D 60–69 · F 0–59. M 005 is pass/fail: a C or higher in M 105 passes it; a D or F gives an F* in M 005.</p>` },
    { icon: 'flag', title: 'Tests and the final', html: `<ul class="list-plain small">
      <li><b>Unit tests</b> are in class at the scheduled time; arrange any exception before the test. A missed test is a zero until your end-of-semester retake.</li>
      <li><b>One retake:</b> everyone may retake one unit test at the end of the semester. If you miss a test, that is the one you retake.</li>
      <li><b>The final</b> is comprehensive, at a common hour, and not in your classroom; its time and place come later.</li>
      <li><b>No phones, smartwatches or smart glasses</b> during tests: use your TI-30XS.</li>
      <li><b>The syllabus gives no test dates.</b> Mathub estimates four unit tests (one per topic area, in the order of the course description) on Sep 17, Oct 8, Oct 29 and Dec 10; check Canvas for the real dates.</li></ul>` },
    { icon: 'clock', title: 'Notes and homework', html: `<ul class="list-plain small">
      <li><b>Notes:</b> before most classes, watch the first part of the lecture video and fill in the prep problems; they are checked at the start of class. If you can’t, come anyway, finish the notes in class and upload them in Canvas within three class days. Eight uploads are allowed for the semester (scored 4.99: search "4.99" in the gradebook to count them).</li>
      <li><b>MyOpenMath:</b> work every problem on paper. Three attempts on most questions; if you need all three, go back to your notes or ask for help instead of guessing. Due the next class day at 11 pm, open until 8 am on test day.</li>
      <li><b>Worksheets:</b> 1 point per acceptable problem, 0 (circled) when the answer is wrong or the work isn’t shown. Turn them in on time and you can correct and resubmit once.</li></ul>` },
    { icon: 'shield', title: 'AI and academic integrity', html: `<ul class="list-plain small">
      <li><b>Use AI only if it helps you understand the material.</b> You may not submit anything generated by AI as your own work; ask your instructor if you are unsure.</li>
      <li>Collaborate only as your instructor allows, and give credit where it is due.</li>
      <li>Mathub fits the policy when you use it to practise and to check your understanding, not to produce answers you hand in.</li></ul>` },
    { icon: 'users', title: 'Where to get help', html: `<ul class="list-plain small">
      <li><b>Office hours</b> with your instructor, or email to set up another time.</li>
      <li><b>Math &amp; Stat Center</b>, Romney 220: Mon–Thu 9–6, Fri 9–5 (bring your student ID and your packet). Fill in the prep and lesson pages first: tutors may ask you to before helping.</li>
      <li><b>Center for Student Success</b>, SUB 177: SmartyCats tutors, MathUp (FlowZone), workshops and success advisors.</li>
      <li><b>Accommodations:</b> Office of Disability Services, 137 Romney, 406-994-2824 (<a href="${DISABILITY}" target="_blank" rel="noopener">details</a>).</li>
      <li><b>Wellbeing:</b> <a href="https://www.montana.edu/counseling/" target="_blank" rel="noopener">Counseling &amp; Psychological Services</a>, <a href="https://www.montana.edu/counseling/letstalk.html" target="_blank" rel="noopener">Let’s Talk</a> drop-ins, <a href="https://montana.welltrack.com/" target="_blank" rel="noopener">WellTrack</a>, <a href="https://www.montana.edu/health/medical.html" target="_blank" rel="noopener">Medical Services</a>.</li></ul>` },
    { icon: 'bulb', title: 'How to use Mathub for this class', html: `<p class="small">After each class, read that topic’s notes here and do a few quizzer questions on paper with your TI-30XS, the same way you do MyOpenMath. Learn the formula sheet with the flashcards (the money formulas take practice). Before each test, run its practice set and checklist, and keep a list of the problems you missed for your end-of-semester retake and the final.</p>` }
  ],

  QUIZ
};
