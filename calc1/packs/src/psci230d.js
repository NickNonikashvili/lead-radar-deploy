/* PSCI 230D Introduction to International Relations, Fall 2026 (section 001, Susanne Redwood).
   Built from the Fall 2026 syllabus. Build:  node scripts/make-pack.js packs/src/psci230d.js
   Notes, key terms, flashcards and practice live in psci230d/notes.js; the question bank in psci230d/quiz.js. */
const N = require('./psci230d/notes.js');
const QUIZ = require('./psci230d/quiz.js');

const CANVAS = 'https://montana.instructure.com/';
const ROOM = 'Norm Asbjornson Hall 165';
const L = (date, title, sec) => [date, 'lecture', title, sec];
const NO = (date, why) => [date, 'holiday', why];
const DUE = (date, title) => [date, 'admin', title];

module.exports = {
  format: 'mathub-class-pack', version: 1,
  id: 'psci230d', code: 'PSCI 230D', name: 'Introduction to International Relations', short: 'PSCI 230D', term: 'Fall 2026', kind: 'reading',
  tagline: 'Why states fight and cooperate: theories, war, international organizations, law and the global economy',
  quizNote: 'Mathub wrote these questions to help you study; they are not from the instructor. Midterms are closed-book multiple choice on the material since the last exam, so check anything surprising against your lecture notes and the readings.',
  formulasTitle: 'Key terms & thinkers',
  formulasNote: 'Every concept, thinker and treaty on one page. The midterms are closed-book multiple choice, so cover the definitions and test whether you can name each one.',
  filterExample: 'anarchy, Fearon',
  color: { light: '#B91C1C', dark: '#F87171' },
  archetype: { name: 'Diplomat', icon: 'scroll', line: 'Wins the war before it starts, at the negotiating table.' },
  canvasMatch: ['PSCI 230D', 'PSCI230D', 'INTRODUCTION TO INTERNATIONAL RELATIONS', 'INTRO TO IR'],
  guides: ['active-recall', 'science-exam', 'notes', 'office-hours'],
  resources: [
    { t: 'UN Charter (full text)', u: 'https://www.un.org/en/about-us/un-charter/full-text', d: 'Assigned for International Organizations. Know Articles 2(4) and 51 and Chapter VII.', k: 'reference', tags: ['readings', 'UN'], top: true },
    { t: 'Universal Declaration of Human Rights', u: 'https://www.un.org/en/about-us/universal-declaration-of-human-rights', d: 'Assigned for International Law & Human Rights: 30 articles, adopted December 10, 1948.', k: 'reference', tags: ['readings', 'human rights'], top: true },
    { t: 'How do nuclear weapons work? (video 1)', u: 'https://www.youtube.com/watch?v=zVhQOhxb1Mc', d: 'Assigned for Weapons of Mass Destruction (Oct 16–23).', k: 'video', tags: ['readings', 'nuclear'] },
    { t: 'How do nuclear weapons work? (video 2)', u: 'https://www.youtube.com/watch?v=MnW7DxsJth0', d: 'The second assigned video on nuclear weapons.', k: 'video', tags: ['readings', 'nuclear'] },
    { t: 'E-IR: International Relations (free textbook)', u: 'https://www.e-ir.info/publication/beginners-textbook-international-relations/', d: 'A free, short beginner’s textbook from E-International Relations. A second explanation; the exams follow Mingst and lecture.', k: 'reading', tags: ['free', 'textbook'], top: true },
    { t: 'E-IR: International Relations Theory (free)', u: 'https://www.e-ir.info/publication/international-relations-theory/', d: 'Short free chapters on realism, liberalism, constructivism, feminism, Marxism and more.', k: 'reading', tags: ['free', 'theory'] },
    { t: 'CFR Global Conflict Tracker', u: 'https://www.cfr.org/global-conflict-tracker', d: 'Background and the latest news on today’s wars, by the Council on Foreign Relations. Useful for linking theory to current events.', k: 'reference', tags: ['current events', 'war'] },
    { t: 'BBC World News', u: 'https://www.bbc.com/news/world', d: 'One of the international news sources the syllabus recommends reading regularly (with the NYT, Washington Post, WSJ, FT and The Economist).', k: 'reading', tags: ['news'] },
    { t: 'MSU Writing Center', u: 'https://www.montana.edu/writingcenter/', d: 'Free help at any stage of writing, including integrating and citing sources.', k: 'msu', tags: ['writing'] },
    { t: 'MSU Library citation guides', u: 'https://guides.lib.montana.edu/citationstyles', d: 'The syllabus’s link for citing sources correctly and avoiding plagiarism.', k: 'msu', tags: ['citations'] },
    { t: 'iClicker', u: 'https://www.iclicker.com/', d: 'Required for attendance and in-class polls. Sign in with your MSU NetID.', k: 'app', tags: ['attendance'] }
  ],

  COURSE: {
    code: 'PSCI 230D', name: 'Introduction to International Relations', term: 'Fall 2026', school: 'Montana State University', credits: 3, section: '001',
    instructor: 'Susanne Redwood (she/her/hers)', instructorEmail: 's.muellerredwood@montana.edu', instructorRoom: 'Wilson Hall 2-141',
    officeHours: 'Mon noon–3:00 pm in Wilson Hall 2-141 (drop-in), or by appointment',
    lectures: `Mon · Wed · Fri 9:00–9:50 am, ${ROOM}`, classDays: 'Mon · Wed · Fri', weeklyHours: 9,
    site: CANVAS, canvas: CANVAS,
    textbook: { title: 'Mingst & McKibben, Essentials of International Relations, 10th ed. (Norton, 2026), required. The schedule cites it as “Mingst & Elko”; other readings are on Canvas', url: CANVAS },
    links: [
      { eyebrow: 'Course site', title: 'Canvas', url: CANVAS, desc: 'Slides, readings, reading quizzes, activity uploads and announcements. All work is submitted here.' },
      { eyebrow: 'Assigned reading', title: 'UN Charter', url: 'https://www.un.org/en/about-us/un-charter/full-text', desc: 'For International Organizations (Oct 26–Nov 2).' },
      { eyebrow: 'Assigned reading', title: 'Universal Declaration of Human Rights', url: 'https://www.un.org/en/about-us/universal-declaration-of-human-rights', desc: 'For International Law & Human Rights (Nov 4–9).' },
      { eyebrow: 'Free reading', title: 'E-IR International Relations', url: 'https://www.e-ir.info/publication/beginners-textbook-international-relations/', desc: 'A free beginner’s IR textbook, for a second explanation of any topic.' },
      { eyebrow: 'Attendance', title: 'iClicker', url: 'https://www.iclicker.com/', desc: 'Attendance is taken at the start of class in the iClicker app. Sign in with your NetID.' }
    ],
    helpCenter: { name: 'Office hours', where: 'Wilson Hall 2-141 (instructor) · Political Science Commons, Wilson Hall 2nd floor, outside 2-143 (TAs)', hours: 'Mon noon–3 (Susanne Redwood) · Tue 1–4 (Cale Thatcher) · Wed 1–3 and Fri 10:10–11:10 (Homa Masood)' },
    disability: { where: '137 Romney Hall', url: 'https://www.montana.edu/disabilityservices/' },
    deadlines: [
      { name: 'Reading quizzes', rule: 'Five short online multiple-choice quizzes on the readings (10–15 minutes each), one per part of the course. You have a week to take each; due Sept 18, Oct 7, Oct 14, Nov 6 and Dec 4. Your lowest is dropped, so only four count.' },
      { name: 'In-class activities', rule: 'Five group worksheets in class (Sept 23, Oct 16, Oct 28, Nov 9, Dec 2). Upload a photo of your work to Canvas within 24 hours. Pass/fail, 5% each; you need four of the five. No copies are sent to people who miss class.' },
      { name: 'Exams', rule: 'Three closed-book multiple-choice midterms in class (Sept 30, Oct 21, Nov 16), each on the material since the previous exam; the lowest is dropped. The final (Mon Dec 14) is multiple choice plus short answer and covers the whole semester.' },
      { name: 'Late work', rule: '50% penalty within 24 hours of the deadline; at most 25% of the points within 48 hours; not accepted after that.' },
      { name: 'Attendance', rule: 'Taken with iClicker at the start of class. Missing less than 2 weeks of classes adds 5 points to your grade; 2–3 weeks, no change; more than 3 and up to 4 weeks, minus 5; more than 4 weeks fails the class.' }
    ]
  },

  GRADING: {
    categories: [
      { id: 'exam1', name: 'Midterm 1', weight: 10 }, { id: 'exam2', name: 'Midterm 2', weight: 10 }, { id: 'exam3', name: 'Midterm 3', weight: 10 },
      { id: 'final', name: 'Final exam', weight: 30 },
      { id: 'quizzes', name: 'Reading quizzes (average of your best 4 of 5)', weight: 20 },
      { id: 'activities', name: 'In-class activities (4 of 5 passed = 100%)', weight: 20 }
    ],
    options: [
      { label: 'Midterm 3 dropped', weights: { exam1: 15, exam2: 15, exam3: 0 } },
      { label: 'Midterm 2 dropped', weights: { exam1: 15, exam2: 0, exam3: 15 } },
      { label: 'Midterm 1 dropped', weights: { exam1: 0, exam2: 15, exam3: 15 } }
    ],
    finalId: 'final',
    note: 'Your lowest midterm is dropped and the other two count 15% each, so the calculator tries each drop and keeps the best. The final (30%) cannot be dropped or replaced. Attendance is not in the calculator: missing less than 2 weeks of classes adds 5 points to your final grade, 2–3 weeks changes nothing, 3–4 weeks subtracts 5, and more than 4 weeks fails the class. Grades round up from .5.',
    scale: [{ letter: 'A', min: 93 }, { letter: 'A-', min: 90 }, { letter: 'B+', min: 87 }, { letter: 'B', min: 83 }, { letter: 'B-', min: 80 }, { letter: 'C+', min: 77 }, { letter: 'C', min: 73 }, { letter: 'C-', min: 70 }, { letter: 'D', min: 60 }, { letter: 'F', min: 0 }]
  },

  SEMESTER: { start: '2026-08-24', end: '2026-12-18' },
  EXAMS: [
    { id: 'exam1', n: 1, name: 'Midterm 1', date: '2026-09-30', dateLabel: `Wed Sept 30, in class (9:00 am, ${ROOM})`, covers: 'Parts I and II: basic concepts, history and current challenges, anarchy, realism, liberalism, constructivism and other frameworks', sections: ['basics', 'history', 'challenges', 'anarchy', 'realism', 'liberalism', 'constructivism'], units: [1, 2], weight: 15, format: 'Closed-book multiple choice in one class period, on everything since the start of the semester. Your lowest midterm is dropped.' },
    { id: 'exam2', n: 2, name: 'Midterm 2', date: '2026-10-21', dateLabel: `Wed Oct 21, in class (9:00 am, ${ROOM})`, covers: 'Part III so far: causes of interstate war (Fearon), civil wars, and weapons of mass destruction (Tannenwald, Waltz)', sections: ['interstate-war', 'civil-war', 'wmd'], units: [3], weight: 15, format: 'Closed-book multiple choice on the material since Midterm 1. Your lowest midterm is dropped.' },
    { id: 'exam3', n: 3, name: 'Midterm 3', date: '2026-11-16', dateLabel: `Mon Nov 16, in class (9:00 am, ${ROOM})`, covers: 'Everything since Midterm 2: the end of weapons of mass destruction, international organizations and the UN Charter, international law and human rights (UDHR, Rwanda), and the first trade class', sections: ['wmd', 'igos', 'law-rights', 'trade'], units: [4], weight: 15, format: 'Closed-book multiple choice on the material since Midterm 2. Your lowest midterm is dropped.' },
    { id: 'final', n: 4, name: 'Final exam', date: '2026-12-14', dateLabel: 'Mon Dec 14 (check the MSU final exam schedule and Canvas for the time and room)', covers: 'The whole semester, including trade and globalization, monetary relations and financial crises, and environment and population', sections: ['basics', 'history', 'challenges', 'anarchy', 'realism', 'liberalism', 'constructivism', 'interstate-war', 'civil-war', 'wmd', 'igos', 'law-rights', 'trade', 'money', 'environment'], units: [1, 2, 3, 4, 5], weight: 30, format: 'Multiple choice and short answer, cumulative. It counts 30% and cannot be dropped or replaced by a midterm.' }
  ],
  CALENDAR: [
    L('2026-08-26', 'Course introduction (Mingst ch. 1)', 'basics'),
    L('2026-08-28', 'Basic concepts and issues in IR (Mingst ch. 1)', 'basics'),
    L('2026-08-31', 'Historical overview (Mingst ch. 2)', 'history'),
    L('2026-09-02', 'Historical overview, continued (Mingst ch. 2)', 'history'),
    NO('2026-09-04', 'No class'),
    NO('2026-09-07', 'Labor Day, no class'),
    L('2026-09-09', 'Current challenges (Mingst ch. 4)', 'challenges'),
    L('2026-09-11', 'International anarchy (Mingst pp. 69–74; Thucydides, Melian Dialogue; Hobbes, Leviathan)', 'anarchy'),
    L('2026-09-14', 'Realist theories (Mingst ch. 3 pp. 75–81; Mearsheimer)', 'realism'),
    L('2026-09-16', 'Realist theories, continued (Mearsheimer, “Anarchy and the Struggle for Power”)', 'realism'),
    L('2026-09-18', 'Liberalism and international cooperation (Mingst ch. 3 pp. 82–86)', 'liberalism'),
    DUE('2026-09-18', 'Reading quiz 1 due (online, Canvas)'),
    L('2026-09-21', 'Liberalism and international cooperation, continued (Kant, Perpetual Peace)', 'liberalism'),
    L('2026-09-23', 'Constructivism and other theoretical frameworks (Mingst ch. 3 pp. 87–112)', 'constructivism'),
    DUE('2026-09-23', 'In-class activity 1 (upload a photo of your worksheet within 24 hours)'),
    L('2026-09-25', 'Constructivism and other frameworks, continued', 'constructivism'),
    L('2026-09-28', 'Constructivism and other frameworks, continued', 'constructivism'),
    ['2026-09-30', 'exam', 'Midterm 1 (in class, closed book)'],
    L('2026-10-02', 'Causes of war I: interstate wars (Mingst ch. 6; Fearon 1995)', 'interstate-war'),
    L('2026-10-05', 'Causes of war I: interstate wars, continued', 'interstate-war'),
    L('2026-10-07', 'Causes of war I: interstate wars, continued', 'interstate-war'),
    DUE('2026-10-07', 'Reading quiz 2 due (online, Canvas)'),
    L('2026-10-09', 'Causes of war II: civil wars (Levy & Thompson, ch. 7)', 'civil-war'),
    L('2026-10-12', 'Causes of war II: civil wars, continued', 'civil-war'),
    L('2026-10-14', 'Causes of war II: civil wars, continued', 'civil-war'),
    DUE('2026-10-14', 'Reading quiz 3 due (online, Canvas)'),
    L('2026-10-16', 'Weapons of mass destruction and other threats (Tannenwald 1999; videos)', 'wmd'),
    DUE('2026-10-16', 'In-class activity 2 (upload a photo of your worksheet within 24 hours)'),
    L('2026-10-19', 'Weapons of mass destruction, continued (Waltz 2012)', 'wmd'),
    ['2026-10-21', 'exam', 'Midterm 2 (in class, closed book)'],
    L('2026-10-23', 'Weapons of mass destruction and other threats, continued', 'wmd'),
    L('2026-10-26', 'International organizations (Mingst ch. 7 pp. 235–47, ch. 9; UN Charter)', 'igos'),
    L('2026-10-28', 'International organizations, continued', 'igos'),
    DUE('2026-10-28', 'In-class activity 3 (upload a photo of your worksheet within 24 hours)'),
    L('2026-10-30', 'International organizations, continued', 'igos'),
    L('2026-11-02', 'International organizations, continued', 'igos'),
    L('2026-11-04', 'International law and human rights (Mingst ch. 7 pp. 248–274, ch. 10; UDHR)', 'law-rights'),
    L('2026-11-06', 'International law and human rights, continued (Power, “Bystanders to Genocide”)', 'law-rights'),
    DUE('2026-11-06', 'Reading quiz 4 due (online, Canvas)'),
    L('2026-11-09', 'International law and human rights, continued', 'law-rights'),
    DUE('2026-11-09', 'In-class activity 4 (upload a photo of your worksheet within 24 hours)'),
    NO('2026-11-11', 'Veterans Day, no class'),
    L('2026-11-13', 'International trade and globalization (Mingst ch. 8)', 'trade'),
    ['2026-11-16', 'exam', 'Midterm 3 (in class, closed book)'],
    L('2026-11-18', 'International trade and globalization, continued', 'trade'),
    L('2026-11-20', 'International trade and globalization, continued', 'trade'),
    NO('2026-11-23', 'Fall break, no class'), NO('2026-11-25', 'Fall break, no class'), NO('2026-11-27', 'Fall break, no class'),
    L('2026-11-30', 'International monetary relations and financial crises (Frieden, Currency Politics ch. 1)', 'money'),
    L('2026-12-02', 'International monetary relations and financial crises, continued', 'money'),
    DUE('2026-12-02', 'In-class activity 5 (upload a photo of your worksheet within 24 hours)'),
    L('2026-12-04', 'International monetary relations and financial crises, continued', 'money'),
    DUE('2026-12-04', 'Reading quiz 5 due (online, Canvas)'),
    L('2026-12-07', 'Other topics: environment and population (Mingst ch. 11 & 12)', 'environment'),
    L('2026-12-09', 'Environment and population, continued', 'environment'),
    ['2026-12-11', 'review', 'Wrap-up and review'],
    ['2026-12-14', 'exam', 'Final exam (cumulative)']
  ],
  CALENDAR_NOTE: `Class meets Mon · Wed · Fri 9:00–9:50 am in ${ROOM}. Read before class. The instructor may change the schedule; Canvas announcements win over this calendar.`,
  RECURRING: [],

  UNITS: [
    { n: 1, title: 'Introduction: tools, concepts and history', sections: ['basics', 'history', 'challenges'], exam: 'exam1' },
    { n: 2, title: 'Contending perspectives in IR', sections: ['anarchy', 'realism', 'liberalism', 'constructivism'], exam: 'exam1' },
    { n: 3, title: 'International security', sections: ['interstate-war', 'civil-war', 'wmd'], exam: 'exam2' },
    { n: 4, title: 'International organizations and international law', sections: ['igos', 'law-rights'], exam: 'exam3' },
    { n: 5, title: 'International political economy', sections: ['trade', 'money', 'environment'], exam: 'final' }
  ],
  SECTIONS: N.SECTIONS,
  FORMULAS: N.FORMULAS,
  FLASHCARDS: N.FLASHCARDS,
  PRACTICE: N.PRACTICE,
  CHECKLISTS: N.CHECKLISTS,

  INFO: [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
      <li><b>Class:</b> Mon · Wed · Fri 9:00–9:50 am, ${ROOM}. Section 001, 3 credits.</li>
      <li><b>Instructor:</b> Susanne Redwood (she/her/hers), <a href="mailto:s.muellerredwood@montana.edu">s.muellerredwood@montana.edu</a>. Drop-in office hours Mon noon–3:00 pm in Wilson Hall 2-141, or by appointment. Replies within about 24 hours; slower on weekends, so email at least a day before a deadline.</li>
      <li><b>TAs:</b> Cale Thatcher (<a href="mailto:cale.thatcher@student.montana.edu">cale.thatcher@student.montana.edu</a>), Tue 1–4 pm; Homa Masood (<a href="mailto:homa.masood@student.montana.edu">homa.masood@student.montana.edu</a>), Wed 1–3 pm and Fri 10:10–11:10 am. Both in the Political Science Commons, Wilson Hall 2nd floor, outside 2-143.</li>
      <li><b>Textbook (required):</b> Mingst &amp; McKibben, <i>Essentials of International Relations</i>, 10th ed. (Norton, 2026). Other readings are on Canvas.</li>
      <li><b>News:</b> read a major outlet with international coverage regularly (NYT, Washington Post, WSJ, Financial Times, The Economist, BBC); foreign outlets such as FAZ or Le Monde give other perspectives.</li></ul>` },
    { icon: 'calc', title: 'Grading', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th class="num">Share</th></tr></thead><tbody>
      <tr><td>Midterms (best 2 of 3, 15% each)</td><td class="num">30%</td></tr><tr><td>Final exam</td><td class="num">30%</td></tr><tr><td>Reading quizzes (best 4 of 5)</td><td class="num">20%</td></tr><tr><td>In-class activities (4 of 5, pass/fail)</td><td class="num">20%</td></tr><tr><td>Attendance</td><td class="num">±5</td></tr></tbody></table></div>
      <p class="small mt-1">A 93+ · A- 90 · B+ 87 · B 83 · B- 80 · C+ 77 · C 73 · C- 70 · D 60 · F below 60, rounding up from .5. Attendance moves your final grade: under 2 weeks missed +5, 2–3 weeks no change, 3–4 weeks −5, more than 4 weeks fails the class.</p>` },
    { icon: 'flag', title: 'Exams', html: `<ul class="list-plain small">
      <li><b>Midterms</b> Wed Sept 30, Wed Oct 21 and Mon Nov 16, in class: closed-book multiple choice on the material since the previous exam. The lowest is dropped.</li>
      <li><b>Final</b> Mon Dec 14: multiple choice and short answer on the whole semester, 30%. A midterm cannot replace it.</li>
      <li>Come to class and take your own notes: the exams draw on lecture as well as the readings.</li>
      <li><b>Conflicts</b> must be discussed with the instructor <b>before</b> the exam. Serious illness or a family emergency qualify; job conflicts and travel plans generally do not.</li></ul>` },
    { icon: 'pen', title: 'Quizzes and activities', html: `<ul class="list-plain small">
      <li><b>Reading quizzes:</b> five online multiple-choice quizzes on the assigned readings, 10–15 minutes each, with a week to take each. Due Sept 18, Oct 7, Oct 14, Nov 6 and Dec 4. You may miss one: the best four are averaged (20%).</li>
      <li><b>In-class activities:</b> group worksheets on Sept 23, Oct 16, Oct 28, Nov 9 and Dec 2. Ask classmates, the instructor and TAs for help, then upload a photo of your work within 24 hours. Pass/fail, 5% each; four of five gives full credit.</li></ul>` },
    { icon: 'calendar', title: 'Attendance, late work and recording', html: `<ul class="list-plain small">
      <li><b>Attendance</b> is taken at the start of class in the iClicker app (required; sign in with your NetID). Do the readings before class and bring pen and paper; phones and laptops stay away unless there is an iClicker poll.</li>
      <li><b>Late work:</b> 50% off within 24 hours of the deadline, at most 25% of the points within 48 hours, not accepted after 48 hours.</li>
      <li>If you will be missing class for medical or other reasons, contact the instructor as early as possible.</li>
      <li><b>No audio or video recording</b> in class without the instructor's written permission or an approved accommodation.</li></ul>` },
    { icon: 'shield', title: 'Academic integrity and AI', html: `<ul class="list-plain small">
      <li>Academic misconduct (plagiarism, cheating, multiple submissions, helping others cheat) gets the maximum sanction: a <b>zero on the assignment</b>, which generally means failing the course. Ask the instructor if you are unsure how to cite.</li>
      <li><b>AI:</b> using generative AI text tools for your writing counts as academic dishonesty in this course. Do not use AI tools during in-class activities or assignments.</li>
      <li>Use Mathub to study and test yourself, not to produce graded work.</li></ul>` },
    { icon: 'users', title: 'Support', html: `<ul class="list-plain small">
      <li><b>Accommodations:</b> Office of Disability Services, 137 Romney Hall (<a href="https://www.montana.edu/disabilityservices/" target="_blank" rel="noopener">montana.edu/disabilityservices</a>). Talk with the instructor early about your plan.</li>
      <li><b>Well-being:</b> Counseling and Psychological Services (<a href="https://www.montana.edu/counseling/index.html" target="_blank" rel="noopener">montana.edu/counseling</a>), confidential.</li>
      <li><b>Writing:</b> the MSU Writing Center (<a href="https://www.montana.edu/writingcenter/" target="_blank" rel="noopener">montana.edu/writingcenter</a>).</li>
      <li><b>Content note:</b> the course covers war, torture and death. Let the instructor know if you have concerns.</li></ul>` },
    { icon: 'bulb', title: 'How to use Mathub for this class', html: `<p class="small">Do the reading, then open that day's topic notes and test yourself with the flashcards the same day. The key terms sheet lists every concept, thinker and treaty; cover the definitions and name them. Before each midterm, run the quizzer on that unit and work the short-answer practice set; the final adds short answers, so practise explaining a theory or a reading in three or four sentences.</p>` }
  ],

  QUIZ
};
