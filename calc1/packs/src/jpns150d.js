/* JPNS 150D Introduction to Japanese Culture & Civilization, Fall 2026 (Professor Peter Tillack).
   Built from the Fall 2026 syllabus, version 3 (revised 10/4/26). Build:  node scripts/make-pack.js packs/src/jpns150d.js
   Notes, key terms, flashcards, essay practice and checklists live in jpns150d/notes.js; the question bank in jpns150d/quiz.js.
   The syllabus lists each reading under the class day before it is due, so here each class shows what to
   read before it. Week 2 (Aug 31–Sept 4) and Mon 9/28–Wed 9/30 have no topic in the syllabus. */
const N = require('./jpns150d/notes.js');
const QUIZ = require('./jpns150d/quiz.js');

const CANVAS = 'https://montana.instructure.com/';
const JW = 'https://www.justwatch.com/';
const ROOM = 'LIN 113';
const L = (date, title, sec, read) => [date, 'lecture', read ? `${title}. Before class: ${read}` : title, sec];
const NO = (date, why) => [date, 'holiday', why];
const ADMIN = (date, title) => [date, 'admin', title];
const ESSAY = 'Multiple choice on the assigned readings, lectures and films (seen for the first time at the exam), plus one essay question, which the professor hands out the class day before. Study for the essay any way you like and with anyone, but the exam itself is closed book.';

module.exports = {
  format: 'mathub-class-pack', version: 1,
  id: 'jpns150d', code: 'JPNS 150D', name: 'Introduction to Japanese Culture and Civilization', short: 'JPNS 150D', term: 'Fall 2026', kind: 'reading',
  tagline: 'Japan from its myths to the present, through history, religion, Noh, haiku, novels, film and anime',
  quizNote: 'Mathub wrote these questions from the syllabus readings and standard background on Japanese history and literature; they are not the professor’s. The exams’ multiple choice also draws on lectures and films, so check anything surprising against your notes.',
  formulasTitle: 'Key terms, people & works',
  formulasNote: 'Every period, term, author and work from the syllabus on one page. Cover the right side and test yourself, then practise using the terms in an essay sentence.',
  filterExample: 'mono no aware, Bashō',
  color: { light: '#155E75', dark: '#67E8F9' },
  archetype: { name: 'Poet', icon: 'quill', line: 'Captures a whole season in seventeen syllables.' },
  canvasMatch: ['JPNS 150D', 'JPNS150D', 'JAPANESE CULTURE', 'JAPANESE CULTURE & CIVILIZATION'],
  guides: ['active-recall', 'notes', 'read-textbook', 'office-hours'],
  resourcesBlurb: 'Where the readings and films are, plus background on Japanese history and literature.',
  resources: [
    { t: 'Canvas', u: CANVAS, d: 'Craig, The Heritage of Japanese Civilization (scanned in full) and the other course readings marked “Canvas” in the schedule.', k: 'msu', tags: ['readings'], top: true },
    { t: 'JustWatch', u: JW, d: 'The syllabus’s guide to where the rental films can be streamed or rented.', k: 'app', tags: ['films'], top: true },
    { t: 'Grave of the Fireflies (where to watch)', u: 'https://www.justwatch.com/us/movie/hotaru-no-haka', d: 'Watch before Wed Nov 4 (War and Pathos).', k: 'video', tags: ['films', 'war'] },
    { t: 'The Family Game (1983)', u: 'https://archive.org/embed/the-family-game-1983-720p-blu-ray-x-264-aac-shiniori', d: 'The syllabus’s link. Watch before Fri Nov 20 (Family Games).', k: 'video', tags: ['films'] },
    { t: 'Akira (where to watch)', u: 'https://www.justwatch.com/us/movie/akira', d: 'Watch before Wed Dec 2 (“Akira” and the Nuclear Sublime).', k: 'video', tags: ['films', 'anime'] },
    { t: 'Ghost in the Shell (where to watch)', u: 'https://www.justwatch.com/us/movie/ghost-in-the-shell', d: 'Watch before Fri Dec 4 (Animated Questions).', k: 'video', tags: ['films', 'anime'] },
    { t: 'History of Japan (Wikipedia)', u: 'https://en.wikipedia.org/wiki/History_of_Japan', d: 'A quick second explanation of each period, to set beside Craig.', k: 'reading', tags: ['history'] },
    { t: 'Japanese literature (Wikipedia)', u: 'https://en.wikipedia.org/wiki/Japanese_literature', d: 'An overview of the authors and works, era by era.', k: 'reading', tags: ['literature'] },
    { t: 'MSU Library', u: 'https://www.lib.montana.edu/', d: 'Find the required books and anything else you need for your presentation questions.', k: 'msu', tags: ['books'] },
    { t: 'MSU Writing Center', u: 'https://www.montana.edu/writingcenter/', d: 'Free help planning your exam essays, at any stage.', k: 'msu', tags: ['writing'] }
  ],

  COURSE: {
    code: 'JPNS 150D', name: 'Introduction to Japanese Culture and Civilization', term: 'Fall 2026', school: 'Montana State University', credits: 3, section: '',
    instructor: 'Professor Peter Tillack', instructorEmail: 'tillack@montana.edu', instructorRoom: 'Gaines 118D',
    officeHours: 'Mon · Wed · Fri 2:00–3:00 pm in Gaines 118D, and by appointment (phone 994-6441)',
    lectures: `Mon · Wed · Fri 11:00–11:50 am, ${ROOM}`, classDays: 'Mon · Wed · Fri', weeklyHours: 6,
    site: CANVAS, canvas: CANVAS,
    textbook: { title: 'Craig, The Heritage of Japanese Civilization (scanned in full on Canvas), plus Keene’s anthology and four novels', url: CANVAS },
    links: [
      { eyebrow: 'Course site', title: 'Canvas', url: CANVAS, desc: 'Craig, the Canvas readings and announcements.' },
      { eyebrow: 'Films', title: 'JustWatch', url: JW, desc: 'Where to stream or rent the films watched outside class.' },
      { eyebrow: 'Email', title: 'tillack@montana.edu', url: 'mailto:tillack@montana.edu', desc: 'Presentation questions go here by 10 pm the day before your slot.' }
    ],
    helpCenter: { name: 'Office hours', where: 'Gaines 118D', hours: 'Mon · Wed · Fri 2–3 pm · or by appointment' },
    disability: { where: 'Disability Services', url: 'https://www.montana.edu/disabilityservices/' },
    deadlines: [
      { name: 'Readings and films', rule: 'Each reading or film is due by the class it is listed for here. Most films are watched outside class; several are rentals (see JustWatch).' },
      { name: 'Presentation questions', rule: 'Twice in the term, on the days you signed up for, email one well thought-out question about the reading or film plus a paragraph on why it is a good question to tillack@montana.edu by 10 pm the day before, then come to class to be asked about it. 30 points each, no make-ups.' },
      { name: 'Exam essays', rule: 'Each exam’s essay question is handed out the class day before the exam; the final’s two essay questions are given out ahead of time too.' },
      { name: 'Missed class', rule: 'Get the material you missed from classmates.' }
    ]
  },

  GRADING: {
    categories: [
      { id: 'participation', name: 'Participation: attendance, discussion (60 pts)', weight: 15.79 },
      { id: 'presentations', name: 'Presentations: two questions, 30 pts each (60 pts)', weight: 15.79 },
      { id: 'exam1', name: 'Exam 1 (60 pts)', weight: 15.79 },
      { id: 'exam2', name: 'Exam 2 (60 pts)', weight: 15.79 },
      { id: 'exam3', name: 'Exam 3 (60 pts)', weight: 15.79 },
      { id: 'final', name: 'Final exam (80 pts)', weight: 21.05 }
    ],
    finalId: 'final',
    note: 'The course has 380 points. Enter each as a percentage. The syllabus gives no letter cut-offs, so these are MSU’s usual ones; check with the professor.',
    scale: [{ letter: 'A', min: 93 }, { letter: 'A-', min: 90 }, { letter: 'B+', min: 87 }, { letter: 'B', min: 83 }, { letter: 'B-', min: 80 }, { letter: 'C+', min: 77 }, { letter: 'C', min: 73 }, { letter: 'C-', min: 70 }, { letter: 'D+', min: 67 }, { letter: 'D', min: 63 }, { letter: 'D-', min: 60 }, { letter: 'F', min: 0 }]
  },

  SEMESTER: { start: '2026-08-24', end: '2026-12-18' },
  EXAMS: [
    { id: 'exam1', n: 1, name: 'Exam 1', date: '2026-09-16', dateLabel: `Wed Sept 16, in class (11:00 am, ${ROOM})`, covers: 'Origins to the Heian court: Craig’s early chapters, the Kojiki, Shinto and Buddhism, The Tale of Genji (“Yūgao”) and The Pillow Book', sections: ['intro', 'origins', 'religions', 'genji', 'pillow'], units: [1], weight: 15.79, format: ESSAY },
    { id: 'exam2', n: 2, name: 'Exam 2', date: '2026-10-16', dateLabel: `Fri Oct 16, in class (11:00 am, ${ROOM})`, covers: 'The samurai to the end of the shogunate: The Tales of the Heike, Hōjōki, Essays in Idleness, Noh and Zen aesthetics, the Tokugawa peace, Saikaku, Chikamatsu, Bashō and the Bakumatsu', sections: ['samurai', 'heike', 'hojoki', 'kenko', 'noh', 'tokugawa', 'saikaku', 'chikamatsu', 'basho', 'bakumatsu'], units: [2, 3], weight: 15.79, format: ESSAY },
    { id: 'exam3', n: 3, name: 'Exam 3', date: '2026-11-16', dateLabel: `Mon Nov 16, in class (11:00 am, ${ROOM})`, covers: 'Meiji to the Occupation: the Meiji revolution, Sōseki’s And Then, Taishō modernism and “Lemon”, In Praise of Shadows, Japan in World War II, Hiroshima and its memory, and the Occupation', sections: ['meiji', 'soseki', 'taisho', 'tanizaki', 'ww2', 'hiroshima', 'occupation'], units: [4], weight: 15.79, format: ESSAY },
    { id: 'final', n: 4, name: 'Final exam', date: '2026-12-14', dateLabel: `Mon Dec 14, 10:00–11:50 am, ${ROOM}`, covers: 'Everything since Exam 3: “American Hijiki”, The Family Game, Kitchen and Somehow, Crystal, Akira and Ghost in the Shell, The Thief and “Eating the City”. The syllabus does not say whether the multiple choice is cumulative; ask in class.', sections: ['hijiki', 'familygame', 'kitchen', 'anime', 'thief', 'murata'], units: [5], weight: 21.05, format: 'Multiple choice plus two essay questions, which are given out ahead of time. Closed book, in our usual classroom.' }
  ],
  CALENDAR: [
    L('2026-08-26', 'Introduction and course overview', 'intro'),
    L('2026-08-28', 'Origins, mythological and archaeological', 'origins', 'Craig pp. 1–11 and the Kojiki excerpts (Canvas)'),
    L('2026-08-31', 'Class (the syllabus lists no topic this week)', 'origins', 'Craig pp. 12–32'),
    ADMIN('2026-08-31', 'Presentation sign-up sheet goes around this week: note your two dates'),
    L('2026-09-02', 'Class (the syllabus lists no topic)', 'origins'),
    L('2026-09-04', 'Class (the syllabus lists no topic)', 'origins'),
    NO('2026-09-07', 'Labor Day, no class'),
    L('2026-09-09', 'Religions', 'religions'),
    L('2026-09-11', 'Murasaki Shikibu’s shining Genji', 'genji', '“Yūgao” from The Tale of Genji (Keene)'),
    L('2026-09-14', 'Sei Shōnagon: Murasaki’s courtly rival', 'pillow', 'excerpts from The Pillow Book (Keene)'),
    ADMIN('2026-09-14', 'Exam 1 essay question handed out'),
    ['2026-09-16', 'exam', 'Exam 1 (in class, closed book)'],
    L('2026-09-18', 'Rise of the samurai', 'samurai', 'Craig pp. 33–43'),
    L('2026-09-21', 'Warfare into literature', 'heike', 'excerpts from The Tales of the Heike (Keene)'),
    L('2026-09-23', 'Transcending chaos? Kamo no Chōmei’s Hōjōki', 'hojoki', '“The Ten-Foot Square Hut” (Keene)'),
    L('2026-09-25', 'A worldly ascetic', 'kenko', 'Yoshida Kenkō, Essays in Idleness (Keene); Craig pp. 43–62'),
    L('2026-09-28', 'Class (the syllabus lists no topic)', 'noh', '“Plan of the Noh Stage” and “Atsumori” (both in Keene)'),
    L('2026-09-30', 'Class (the syllabus lists no topic)', 'noh'),
    L('2026-10-02', 'Zen aesthetics; short film on Noh drama', 'noh'),
    L('2026-10-05', 'The transition to Pax Tokugawa', 'tokugawa', 'Craig pp. 62–80'),
    L('2026-10-07', 'Saikaku and the chōnin ethos', 'saikaku', 'Ihara Saikaku, “What the Seasons Brought the Almanac Maker” and “The Eternal Storehouse of Japan” (Keene)'),
    L('2026-10-09', 'Short film on bunraku; Chikamatsu’s domestic dramas', 'chikamatsu', 'Craig pp. 80–92; Chikamatsu, “The Love Suicides at Sonezaki” (Keene)'),
    L('2026-10-12', 'Bashō and the birth of haiku', 'basho', 'Matsuo Bashō, selected haiku (Keene)'),
    L('2026-10-14', 'Bakumatsu: decline of the shogunate', 'bakumatsu', 'Craig pp. 92–101; excerpts from Japan’s Discovery of America (Canvas)'),
    ADMIN('2026-10-14', 'Exam 2 essay question handed out'),
    ['2026-10-16', 'exam', 'Exam 2 (in class, closed book)'],
    L('2026-10-19', 'Video: “Meiji Revolution”', 'meiji', 'Craig pp. 101–119; start Sōseki, And Then'),
    L('2026-10-21', 'The life and times of Natsume Sōseki', 'soseki', 'the first two thirds of And Then'),
    L('2026-10-23', 'And Then', 'soseki', 'the rest of And Then'),
    L('2026-10-26', 'Taishō modernism', 'taisho', 'Kajii Motojirō, “Lemon”'),
    L('2026-10-28', 'Reactionary aesthetics?', 'tanizaki', 'Tanizaki Jun’ichirō, In Praise of Shadows'),
    L('2026-10-30', 'Japan and World War II', 'ww2', 'Craig pp. 124–140'),
    L('2026-11-02', 'Victimizers?', 'ww2', 'Hirabayashi Taiko, “Blind Chinese Soldiers”; Kojima Nobuo, “The Rifle” (both Canvas)'),
    L('2026-11-04', 'War and pathos', 'hiroshima', 'watch Grave of the Fireflies'),
    L('2026-11-06', 'Victims? Film: Hiroshima, Nagasaki, August 1945', 'hiroshima', 'Hara Tamiki, from Summer Flowers (Canvas)'),
    L('2026-11-09', 'War and representation', 'hiroshima', 'Hogan, “The Enola Gay Controversy” (Canvas)'),
    NO('2026-11-11', 'Veterans Day, no class'),
    L('2026-11-13', 'Occupation and beyond', 'occupation', 'Craig pp. 140–159'),
    ADMIN('2026-11-13', 'Exam 3 essay question handed out'),
    ['2026-11-16', 'exam', 'Exam 3 (in class, closed book)'],
    L('2026-11-18', 'A bitter feast', 'hijiki', 'Nosaka Akiyuki, “American Hijiki” (Canvas)'),
    L('2026-11-20', 'Family games', 'familygame', 'watch Morita Yoshimitsu’s The Family Game'),
    NO('2026-11-23', 'Fall break'), NO('2026-11-25', 'Fall break'), NO('2026-11-27', 'Fall break'),
    L('2026-11-30', 'Banana’s world', 'kitchen', 'Craig pp. 159–172; Yoshimoto Banana, Kitchen; excerpt from Tanaka Yasuo, Somehow, Crystal (Canvas)'),
    L('2026-12-02', '“Akira” and the nuclear sublime', 'anime', 'Napier, “Why Anime?” and “Anime and Local/Global”; watch Ōtomo Katsuhiro’s Akira'),
    L('2026-12-04', 'Animated questions', 'anime', 'Brown, “Posthumanism after ‘Akira’” (Canvas); watch Oshii Mamoru’s Ghost in the Shell'),
    L('2026-12-07', 'Post-bubble blues', 'thief', 'the first two thirds of Nakamura Fuminori, The Thief'),
    L('2026-12-09', 'Fuminori Nakamura’s Japan', 'thief', 'the rest of The Thief'),
    L('2026-12-11', '“Eating the City”; course wrap-up', 'murata', 'Murata Sayaka, “Eating the City” (Canvas)'),
    ['2026-12-14', 'exam', `Final exam, 10:00–11:50 am, ${ROOM}`]
  ],
  CALENDAR_NOTE: `Class meets Mon · Wed · Fri 11:00–11:50 am in ${ROOM}. Each class shows what to read or watch before it. The syllabus is version 3 (revised Oct 4); the professor may change it, and Canvas wins.`,
  RECURRING: [],

  UNITS: [
    { n: 1, title: 'Origins to the Heian court', sections: ['intro', 'origins', 'religions', 'genji', 'pillow'], exam: 'exam1' },
    { n: 2, title: 'Samurai, recluses and Noh', sections: ['samurai', 'heike', 'hojoki', 'kenko', 'noh'], exam: 'exam2' },
    { n: 3, title: 'The Tokugawa peace and its end', sections: ['tokugawa', 'saikaku', 'chikamatsu', 'basho', 'bakumatsu'], exam: 'exam2' },
    { n: 4, title: 'Modern Japan: Meiji to the Occupation', sections: ['meiji', 'soseki', 'taisho', 'tanizaki', 'ww2', 'hiroshima', 'occupation'], exam: 'exam3' },
    { n: 5, title: 'Postwar and contemporary Japan', sections: ['hijiki', 'familygame', 'kitchen', 'anime', 'thief', 'murata'], exam: 'final' }
  ],
  SECTIONS: N.SECTIONS,
  FORMULAS: N.FORMULAS,
  FLASHCARDS: N.FLASHCARDS,
  PRACTICE: N.PRACTICE,
  CHECKLISTS: N.CHECKLISTS,

  INFO: [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
      <li><b>Class:</b> Mon · Wed · Fri 11:00–11:50 am, ${ROOM}. 3 credits; counts for CORE diversity (D) credit.</li>
      <li><b>Professor:</b> Peter Tillack, <a href="mailto:tillack@montana.edu">tillack@montana.edu</a>, Gaines 118D, 994-6441. Office hours Mon · Wed · Fri 2:00–3:00 pm and by appointment.</li>
      <li><b>Goals:</b> know the chronology of Japanese history and what mattered culturally in each period; understand Japanese aesthetics in religion, art, drama, literature and anime; know representative works of Japanese literature; discuss social issues in contemporary Japan.</li>
      <li>The course is a gateway to MSU’s upper-division courses on Japan in History &amp; Philosophy and in Modern Languages &amp; Literatures.</li></ul>` },
    { icon: 'calc', title: 'Grading', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th class="num">Points</th><th class="num">Share</th></tr></thead><tbody>
      <tr><td>Participation</td><td class="num">60</td><td class="num">≈16%</td></tr><tr><td>Presentations (2 × 30)</td><td class="num">60</td><td class="num">≈16%</td></tr><tr><td>Exam 1</td><td class="num">60</td><td class="num">≈16%</td></tr><tr><td>Exam 2</td><td class="num">60</td><td class="num">≈16%</td></tr><tr><td>Exam 3</td><td class="num">60</td><td class="num">≈16%</td></tr><tr><td>Final exam</td><td class="num">80</td><td class="num">≈21%</td></tr><tr><td><b>Total</b></td><td class="num"><b>380</b></td><td class="num">100%</td></tr></tbody></table></div>
      <p class="small mt-1">Participation is attendance, joining class discussion and the questions you present. Credit goes only to relevant observations, so keep up with the readings.</p>` },
    { icon: 'flag', title: 'Exams', html: `<ul class="list-plain small">
      <li><b>Exam 1</b> Wed Sept 16 · <b>Exam 2</b> Fri Oct 16 · <b>Exam 3</b> Mon Nov 16, in class. <b>Final</b> Mon Dec 14, 10:00–11:50 am, ${ROOM}.</li>
      <li>Each exam has a <b>multiple-choice</b> part on the readings, lectures and films, which you first see at the exam, and an <b>essay</b>. Exams 1–3 have one essay question; the final has two.</li>
      <li>You get the essay question the class day before the exam (ahead of time for the final). Prepare however you like, with whomever you like; the exam itself is closed book.</li></ul>` },
    { icon: 'chat', title: 'Presentations', html: `<ul class="list-plain small">
      <li>Two presentations, 30 points each. A sign-up sheet goes around in the second week of class; you are responsible for remembering your dates.</li>
      <li>By <b>10 pm the day before</b> your date, email tillack@montana.edu one well thought-out question about the reading or film plus a paragraph explaining why it is a good question.</li>
      <li>Come to class that day: the professor and classmates will ask you about your question. You must be there to get credit, and missed presentations cannot be made up.</li></ul>` },
    { icon: 'book', title: 'Readings and films', html: `<ul class="list-plain small">
      <li><b>Craig</b>, The Heritage of Japanese Civilization (scanned in full on Canvas).</li>
      <li><b>Keene</b>, ed., anthology of Japanese literature from the earliest era to the mid-19th century.</li>
      <li>Nakamura Fuminori, <i>The Thief</i> · Natsume Sōseki, <i>And Then</i> (trans. Norma Field) · Tanizaki Jun’ichirō, <i>In Praise of Shadows</i> · Yoshimoto Banana, <i>Kitchen</i>.</li>
      <li>Plus readings on Canvas and films, most watched outside class. Several are rentals; <a href="${JW}" target="_blank" rel="noopener">JustWatch</a> shows where.</li></ul>` },
    { icon: 'shield', title: 'Class policies', html: `<ul class="list-plain small">
      <li><b>Content:</b> class material may contain violence, sexual content and adult language.</li>
      <li><b>Original work:</b> passing off someone else’s work as your own, or not citing it properly, earns an F on the assignment and a report to the Dean of Students.</li>
      <li>Phones off, no texting and no eating in class; disruptive students will be asked to leave.</li>
      <li>If you miss class, get the material from classmates.</li>
      <li><b>Accommodations:</b> contact the professor and Disability Services (<a href="https://www.montana.edu/disabilityservices/" target="_blank" rel="noopener">montana.edu/disabilityservices</a>) as soon as possible.</li></ul>` },
    { icon: 'bulb', title: 'How to use Mathub for this class', html: `<p class="small">Before each class, do the reading listed for it, then read that topic’s notes and run its flashcards the same day. When an essay question comes out, use the essay practice for that exam to plan an answer with three points, each tied to a specific reading or film. For the multiple choice, run the quizzer on the exam’s units and keep the key terms sheet’s timeline straight.</p>` }
  ],

  QUIZ
};
