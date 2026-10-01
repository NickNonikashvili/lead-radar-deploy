/* EMEC 100 Introduction to Mechanical Engineering, Fall 2026 (Dr. Scott Monfort).
   Built from the Fall 2026 syllabus (v1.0). The syllabus asks that class materials, including the syllabus,
   not be posted without the instructor's written permission, so this pack carries the course facts only,
   in Mathub's own words, and points to Canvas for the full policies. Upload it hidden until the instructor
   agrees. The syllabus has no weekly schedule and the class has no exams, so the topics follow the nine
   course objectives. Build:  node scripts/make-pack.js packs/src/emec100.js */
const N = require('./emec100/notes.js');
const QUIZ = require('./emec100/quiz.js');

const CANVAS = 'https://www.montana.edu/ecat/';
const ROOM = 'Gaines Hall 101';
const wednesdays = () => { const out = []; for (let d = new Date('2026-08-26T12:00:00Z'); d <= new Date('2026-12-09T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 7)) out.push(d.toISOString().slice(0, 10)); return out; };
const OFF = { '2026-11-11': 'Veterans Day, no class', '2026-11-25': 'Thanksgiving break, no class' };

module.exports = {
  format: 'mathub-class-pack', version: 1,
  id: 'emec100', code: 'EMEC 100', name: 'Introduction to Mechanical Engineering', short: 'EMEC 100', term: 'Fall 2026', kind: 'science',
  tagline: 'What mechanical engineers do: problem solving, units, design, manufacturing, communication and ethics',
  quizNote: 'Mathub wrote these questions from the course objectives; they are not the instructor’s. EMEC 100 has no exams: grades come from assignments and quizzes in class and on Canvas, so use this to get comfortable with the ideas and the unit conversions.',
  formulasNote: 'The units, conversions and first formulas of mechanical engineering, plus the vocabulary of the profession, on one page.',
  filterExample: 'stress, FE exam',
  color: { light: '#475569', dark: '#94A3B8' },
  archetype: { name: 'Tinkerer', icon: 'gear', line: 'Turns a sketch on a napkin into a part that works.' },
  canvasMatch: ['EMEC 100', 'EMEC100', 'INTRODUCTION TO MECHANICAL ENGINEERING'],
  guides: ['active-recall', 'office-hours', 'study-group', 'semester-plan'],
  resources: [
    { t: 'MSU B.S. in Mechanical Engineering (catalog)', u: 'https://catalog.montana.edu/undergraduate/engineering/mechanical-industrial-engineering/mechanical-engineering/', d: 'The official curriculum, course sequence and degree requirements.', k: 'msu', tags: ['curriculum'], top: true },
    { t: 'MSU Mechanical & Industrial Engineering Department', u: 'https://www.montana.edu/mie/', d: 'Advising, student resources, clubs and news from the department.', k: 'msu', tags: ['department'] },
    { t: 'NSPE Code of Ethics: the Fundamental Canons', u: 'https://www.nspe.org/categories/code-ethics/i-fundamental-canons', d: 'The six canons every engineer is held to, starting with the public’s safety, health and welfare.', k: 'reference', tags: ['ethics'], top: true },
    { t: 'NCEES FE exam', u: 'https://ncees.org/exams/fe-exam/', d: 'The Fundamentals of Engineering exam: the first step toward a PE license. Most students take it near graduation.', k: 'reference', tags: ['licensure'] },
    { t: 'FE Mechanical exam specifications (PDF)', u: 'https://ncees.org/wp-content/uploads/FE-Mechanical-CBT-specs.pdf', d: 'The knowledge areas on the FE Mechanical exam: a map of what the ME curriculum covers.', k: 'reference', tags: ['licensure', 'curriculum'] },
    { t: 'BLS: Mechanical engineers', u: 'https://www.bls.gov/ooh/architecture-and-engineering/mechanical-engineers.htm', d: 'What mechanical engineers do, where they work, pay and job outlook, from the U.S. Bureau of Labor Statistics.', k: 'reference', tags: ['careers'] },
    { t: 'ASME', u: 'https://www.asme.org/', d: 'The American Society of Mechanical Engineers: student sections, codes and standards, and career resources.', k: 'community', tags: ['societies'] },
    { t: 'MSU Writing Center', u: 'https://www.montana.edu/writingcenter/', d: 'Free help with reports and citations at any stage of writing.', k: 'msu', tags: ['writing'] }
  ],

  COURSE: {
    code: 'EMEC 100', name: 'Introduction to Mechanical Engineering', term: 'Fall 2026', school: 'Montana State University', credits: 1, section: '',
    instructor: 'Dr. Scott Monfort', instructorEmail: 'scott.monfort@montana.edu', instructorRoom: 'Roberts Hall 303',
    officeHours: 'Wed 4:00–5:00 pm and Thu 11:00 am–noon in Roberts Hall 303, or by appointment',
    lectures: `Wednesdays 3:10–4:00 pm, ${ROOM}`, classDays: 'Wednesday', weeklyHours: 3,
    site: CANVAS, canvas: CANVAS,
    textbook: { title: 'No required textbook; readings are posted on Canvas as PDFs', url: CANVAS },
    links: [
      { eyebrow: 'Course site', title: 'Canvas', url: CANVAS, desc: 'Assignments, quizzes, readings, point values and announcements. Everything is submitted here, individually.' },
      { eyebrow: 'Curriculum', title: 'B.S. in Mechanical Engineering', url: 'https://catalog.montana.edu/undergraduate/engineering/mechanical-industrial-engineering/mechanical-engineering/', desc: 'MSU’s catalog page for the degree this course introduces.' },
      { eyebrow: 'Ethics', title: 'NSPE Code of Ethics', url: 'https://www.nspe.org/categories/code-ethics/i-fundamental-canons', desc: 'The Fundamental Canons of engineering ethics.' }
    ],
    helpCenter: { name: 'Student (office) hours', where: 'Roberts Hall 303', hours: 'Wed 4–5 pm · Thu 11 am–noon · or by appointment' },
    disability: { where: '137 Romney Hall', url: 'https://www.montana.edu/disabilityservices/' },
    deadlines: [
      { name: 'Assignments and quizzes', rule: 'Some are done in class, others are posted on Canvas. Due dates and point values are on Canvas, and every submission goes to Canvas individually. Nothing is accepted by email.' },
      { name: 'Email', rule: 'Start the subject line with “EMEC 100-x:” where x is your section; emails without it are disregarded. Late work and quizzes are discussed in person at office hours, not by email.' },
      { name: 'Absences', rule: 'Email the instructor as soon as you can if you will miss class. Making up missed content is your job; missing more than 20% of the course can lower your grade or fail you.' }
    ]
  },

  GRADING: {
    categories: [{ id: 'points', name: 'Assignments and quizzes (your Canvas percentage)', weight: 100 }],
    finalId: 'points',
    note: 'There are no exams and no final. Your grade is your share of the total points from assignments and quizzes, with the point values set in Canvas. Enter your Canvas percentage to see the letter it earns.',
    scale: [{ letter: 'A', min: 93 }, { letter: 'A-', min: 90 }, { letter: 'B+', min: 87 }, { letter: 'B', min: 83 }, { letter: 'B-', min: 80 }, { letter: 'C+', min: 77 }, { letter: 'C', min: 73 }, { letter: 'C-', min: 70 }, { letter: 'D+', min: 67 }, { letter: 'D', min: 63 }, { letter: 'D-', min: 60 }, { letter: 'F', min: 0 }]
  },

  SEMESTER: { start: '2026-08-24', end: '2026-12-18' },
  EXAMS: [],
  CALENDAR: wednesdays().map(d => OFF[d] ? [d, 'holiday', OFF[d]] : [d, 'lecture', `EMEC 100 class, 3:10–4:00 pm, ${ROOM}`]),
  CALENDAR_NOTE: `Class meets on Wednesdays, 3:10–4:00 pm in ${ROOM}. The syllabus has no topic schedule, and there are no exams; check Canvas each week for assignments, quizzes and readings.`,
  RECURRING: [],

  UNITS: [
    { n: 1, title: 'The profession and the program', sections: ['profession', 'program', 'careers'] },
    { n: 2, title: 'Problem solving, analysis and modeling', sections: ['problem-solving', 'core-areas', 'modeling'] },
    { n: 3, title: 'Design and manufacturing', sections: ['design', 'manufacturing'] },
    { n: 4, title: 'Communication, teamwork and ethics', sections: ['communication', 'teamwork', 'ethics'] }
  ],
  SECTIONS: N.SECTIONS,
  FORMULAS: N.FORMULAS,
  FLASHCARDS: N.FLASHCARDS,

  NAV: [
    { label: 'Today', items: [['dashboard', 'Dashboard', 'home'], ['calendar', 'Calendar', 'calendar']] },
    { label: 'Learn', items: [['notes', 'Topic notes', 'book'], ['formulas', 'Units, formulas & terms', 'sigma'], ['flashcards', 'Flashcards', 'cards']] },
    { label: 'Practice', items: [['practice', 'Quizzer', 'list']] },
    { label: 'Tools', items: [['grades', 'Grade calculator', 'calc'], ['scratchpad', 'Scratchpad', 'pen']] },
    { label: 'Community', items: [['forum', 'Discussions', 'chat']] },
    { label: 'Course', items: [['course', 'Syllabus & policies', 'info'], ['settings', 'Settings', 'sliders']] }
  ],

  INFO: [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
      <li><b>Class:</b> Wednesdays 3:10–4:00 pm, ${ROOM}. 1 credit (one lecture hour a week), with work outside class to match.</li>
      <li><b>Instructor:</b> Dr. Scott Monfort, <a href="mailto:scott.monfort@montana.edu">scott.monfort@montana.edu</a>. Student hours Wed 4–5 pm and Thu 11 am–noon in Roberts Hall 303, or by appointment.</li>
      <li><b>Co-requisite:</b> M 151Q. You are expected to be comfortable with algebra and with Word, Excel and PowerPoint.</li>
      <li><b>Textbook:</b> none. Readings are posted on Canvas as PDFs when needed.</li>
      <li><b>Canvas</b> is the official channel, along with your MSU email; check both at least twice a week.</li></ul>` },
    { icon: 'calc', title: 'Grading', html: `<p class="small">No exams and no final. Your grade is your total points from assignments and quizzes, most of them tied to in-class discussion and group activities. Point values are in Canvas.</p>
      <p class="small mt-1">A 93+ · A- 90 · B+ 87 · B 83 · B- 80 · C+ 77 · C 73 · C- 70 · D+ 67 · D 63 · D- 60 · F below 60.</p>` },
    { icon: 'pen', title: 'Assignments and email', html: `<ul class="list-plain small">
      <li>Some assignments happen in class; others come through Canvas. <b>Everything is submitted individually on Canvas</b> (small-group work only when stated). Nothing goes to the instructor by email.</li>
      <li>Written work is checked with Turnitin.</li>
      <li><b>Email subject lines must start with “EMEC 100-x:”</b> (x = your section) or the email is disregarded; the class has over 250 students. Late work and quizzes are discussed in person at student hours.</li></ul>` },
    { icon: 'calendar', title: 'Attendance', html: `<ul class="list-plain small">
      <li>Participation and in-class activities are central and cannot be repeated outside class.</li>
      <li>If you are sick, email the instructor as soon as you can; catching up on missed content is up to you (classmates help).</li>
      <li>Missing more than 20% of the course can affect your grade, up to failing.</li>
      <li>For university-sponsored absences, tell the instructor ahead of time.</li></ul>` },
    { icon: 'shield', title: 'Integrity, AI and course materials', html: `<ul class="list-plain small">
      <li>The department requires instructors to report all academic misconduct; plagiarism can mean an F and a report to the Dean of Students.</li>
      <li><b>AI and writing tools</b> are fine as a complement, as discussed in class, but not as a replacement for your own work. Work that reads far above your level can lead to a one-on-one oral check and deductions up to 100%.</li>
      <li>Course materials are copyrighted: do not post or share them (including on sites like Chegg or Course Hero) without the instructor’s written permission. No recording in class without permission or an approved accommodation.</li>
      <li>The full policies are in the syllabus on Canvas.</li></ul>` },
    { icon: 'users', title: 'Support', html: `<ul class="list-plain small">
      <li><b>Accommodations:</b> Disability Services, 137 Romney Hall, 406-994-2824, <a href="mailto:disabilityservices@montana.edu">disabilityservices@montana.edu</a>. Bring your Accommodation Notification to student hours.</li>
      <li><b>Writing:</b> the MSU Writing Center (<a href="https://www.montana.edu/writingcenter/" target="_blank" rel="noopener">montana.edu/writingcenter</a>).</li></ul>` },
    { icon: 'bulb', title: 'How to use Mathub for this class', html: `<p class="small">There are no exams, so use Mathub to get ahead: learn the units and conversions until they are automatic (they come back in every ME course), read the topic notes before the matching discussion, and use the quizzer to check the vocabulary of design, manufacturing and ethics. The notes follow the course objectives; Canvas and lecture decide each week’s topic.</p>` }
  ],

  QUIZ
};
