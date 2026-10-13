/* ============================================================
   Mathub app — what only the app does (loaded only in the iOS and Android apps, after every other script)
   - Create a class (#/create): Mathub writes instructions for an AI; the student gives them,
     with their syllabus, to the AI chat they already use, pastes the answer back, and Mathub
     checks it, repairs what it safely can, shows a preview and adds the class. The class is
     data, cleaned like every other class pack, and it is saved in the app's own folder on
     this device. Nothing is sent to Mathub or to any AI by the app.
   - classes you made: open, send the file to a classmate (share sheet), delete; import a file
   - reminders: exam reminders and a daily study reminder as local notifications, only after
     the student turns them on and allows them
   - haptics on right and wrong answers, finished lessons and level-ups
   - an "On this device" panel in Settings
   The website never loads this file (see app/scripts/build-www.js).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const N = global.Native; const MA = global.MATHUB_APP; const Packs = global.MathubPacks;
  if (!App || !N || !MA || !MA.native || !Packs || !App.packs) return;
  const { $, $$, esc, icon, bind, toast, settings, setSetting } = App;
  const Courses = global.Courses;
  const ANDROID = !!(window.MATHUB_APP && window.MATHUB_APP.platform === 'android');
  const DEVICE = ANDROID ? (Math.min(screen.width, screen.height) >= 600 ? 'tablet' : 'phone') : /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : 'iPhone';

  /* ---------- haptics follow the sound cues ---------- */
  const HAPTIC = { correct: 'success', wrong: 'error', complete: 'medium', levelup: 'success', tap: 'select' };
  if (App.sfx && typeof App.sfx.play === 'function') { const play = App.sfx.play.bind(App.sfx); App.sfx.play = name => { N.haptic(HAPTIC[name] || 'light'); return play(name); }; }

  /* ---------- website-only pieces step aside ---------- */
  App.installAvailable = () => false;
  /* every study tool works without an account in the app (App Store guideline 5.1.1(v)): an account only adds sync,
     discussions and classes with an instructor, and sign-up is limited to Montana State addresses */
  if (App.auth) App.auth.gate = () => 'open';
  App.views.teach = {
    title: 'Mathub Faculty',
    render(root) {
      root.innerHTML = `<div class="landing-wrap"><header class="landing-top"><div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>Mathub Faculty</h1><p class="muted">The syllabus editor for instructors is on the web, where there is room for the form and the page side by side.</p></div></header>
        <div class="row gap-sm" style="flex-wrap:wrap"><button class="btn primary" data-action="open-web">${icon('external', 14)} Open Mathub Faculty</button><a class="btn" href="#/">${icon('left', 14)} Back to your classes</a></div></div>`;
      bind(root, { 'open-web': () => N.open(MA.api + '#/teach') });
    }
  };

  /* ============================================================
     Classes made on this device
     ============================================================ */
  const IDX = 'mh-my-classes';
  const readIdx = () => { try { const v = JSON.parse(localStorage.getItem(IDX) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const writeIdx = list => { try { localStorage.setItem(IDX, JSON.stringify(list)); return true; } catch (e) { return false; } };
  const fileOf = id => `classes/${id}.mathub.json`;
  const local = App.packs.local;
  const newId = () => { let id; do { id = 'my' + String(1000 + Math.floor(Math.random() * 9000)); } while (Courses[id] || local.has(id)); return id; };
  function registerLocal(entry) { local.add(entry.id); App.packs.register(entry.stub, true); }
  const Mine = App.myClasses = {
    list: () => readIdx(),
    has: id => local.has(id),
    async read(id) { return JSON.parse(await N.fs.read(fileOf(id))); },
    async add(pack) {
      const text = JSON.stringify(pack);
      await N.fs.write(fileOf(pack.id), text);
      const entry = { id: pack.id, code: pack.code, name: pack.name, term: pack.term, added: Date.now(), bytes: text.length, stub: App.packs.stubOf(pack) };
      const list = readIdx().filter(e => e.id !== pack.id).concat([entry]);
      if (!writeIdx(list)) { writeIdx(list.map(e => e.id === pack.id ? e : Object.assign({}, e))); }
      registerLocal(entry);
      const s = settings(); if (Array.isArray(s.courses) && s.courses.length && !s.courses.includes(pack.id)) setSetting('courses', s.courses.concat([pack.id]));
      if (App.rebuildNav) App.rebuildNav();
      Reminders.sync();
      return entry;
    },
    async remove(id) {
      if (App.D && App.D.id === id && App.forgetCourse) App.forgetCourse();
      await N.fs.remove(fileOf(id)); writeIdx(readIdx().filter(e => e.id !== id)); local.delete(id); App.packs.unregister(id);
      const s = settings(); if (Array.isArray(s.courses) && s.courses.includes(id)) setSetting('courses', s.courses.filter(x => x !== id));
      if (App.rebuildNav) App.rebuildNav();
      Reminders.sync();
    }
  };
  /* registered before the first render, from the light copy kept in the index; the full class is read from its file when opened */
  readIdx().forEach(e => { try { if (e && e.stub && Packs.ID_RE.test(e.id)) registerLocal(e); } catch (err) {} });
  /* if the index was lost (storage cleared) the files are still there: rebuild it from them */
  (async () => {
    const files = await N.fs.list('classes'); const known = new Set(readIdx().map(e => e.id)); let added = 0;
    for (const f of files) { const m = /^(my\d{4})\.mathub\.json$/.exec(f); if (!m || known.has(m[1])) continue;
      try { const pack = await Mine.read(m[1]); const entry = { id: pack.id, code: pack.code, name: pack.name, term: pack.term, added: Date.now(), bytes: 0, stub: App.packs.stubOf(pack) }; writeIdx(readIdx().concat([entry])); registerLocal(entry); added++; } catch (e) {} }
    if (added && App.rerender) App.rerender();
  })();
  const baseLoad = App.packs.load;
  App.packs.load = async id => {
    if (!local.has(id)) return baseLoad(id);
    let raw; try { raw = await Mine.read(id); } catch (e) { throw new Error(`This class is not saved on this ${DEVICE} any more.`); }
    return App.packs.install(id, raw);
  };

  /* ============================================================
     The instructions for the AI, and reading its answer
     ============================================================ */
  const SIZES = {
    full: { sections: '8 to 16', ideas: '3 to 5', cards: 'about 60', questions: '6 to 8' },
    short: { sections: '6 to 10', ideas: '2 or 3', cards: 'about 25', questions: '4' }
  };
  function prompt(size) {
    const Z = SIZES[size] || SIZES.full;
    return `You are turning a college course syllabus into a study class for Mathub, a study app. The syllabus is attached or pasted after these instructions.

Reply with ONE JSON object and nothing else: no greeting and no explanation, just the JSON in a single \`\`\`json code block.

WHAT TO WRITE
1. Course facts from the syllabus: code, title, term, instructor, email, office hours, meeting times, textbook, grading categories and weights, the letter-grade scale, exam dates, holidays and deadlines. Copy dates and numbers exactly. Never invent a date: if an exam has no date in the syllabus, leave it out of EXAMS and list it in COURSE.deadlines instead.
2. Study material you write yourself from the topics the syllabus covers, accurate and at the level of the course:
   - SECTIONS: one per main topic, ${Z.sections} in total, grouped into UNITS (one unit per exam period when the course has exams).
   - Each section: ${Z.ideas} "ideas" (short paragraphs that teach the topic), one or two "pitfalls" (common mistakes), and an "example" ({ "p": a problem, "s": its worked solution }) when the subject has problems to solve.
   - FLASHCARDS: ${Z.cards} cards, front "f" and back "b".
   - QUIZ: one topic per section with ${Z.questions} multiple-choice questions each.
3. Plain text only: no HTML and no Markdown inside the strings. Write math as LaTeX between dollar signs, and double every backslash inside JSON strings, for example "$\\\\frac{a}{b}$".

FORMAT (ids use lowercase letters, digits and dashes)
{
  "format": "mathub-class-pack",
  "version": 1,
  "id": "chmy121",
  "code": "CHMY 121",
  "name": "Introduction to General Chemistry",
  "term": "Fall 2026",
  "color": { "light": "#0F766E" },
  "COURSE": {
    "code": "CHMY 121", "name": "Introduction to General Chemistry", "term": "Fall 2026",
    "school": "Montana State University",
    "instructor": "Dr. Jane Smith", "instructorEmail": "jane.smith@montana.edu",
    "officeHours": "Tue 2-3 pm, Gaines 210", "lectures": "MWF 9:00-9:50, Gaines 101",
    "textbook": { "title": "Chemistry: The Central Science", "url": "" },
    "deadlines": [{ "name": "Last day to drop", "rule": "Oct 30" }]
  },
  "GRADING": {
    "categories": [{ "id": "hw", "name": "Homework", "weight": 20 }, { "id": "exams", "name": "Midterms", "weight": 50 }, { "id": "final", "name": "Final exam", "weight": 30 }],
    "scale": [{ "letter": "A", "min": 93 }, { "letter": "B", "min": 83 }, { "letter": "C", "min": 73 }, { "letter": "D", "min": 63 }, { "letter": "F", "min": 0 }]
  },
  "SEMESTER": { "start": "2026-08-24", "end": "2026-12-18" },
  "EXAMS": [{ "id": "exam1", "name": "Exam 1", "date": "2026-09-30", "covers": "Units 1 and 2", "units": [1, 2], "weight": 15 }],
  "CALENDAR": [
    ["2026-08-24", "lecture", "Atoms and isotopes", "atoms"],
    ["2026-09-07", "holiday", "Labor Day, no class"],
    ["2026-09-30", "exam", "Exam 1"],
    ["2026-10-30", "admin", "Last day to drop"]
  ],
  "UNITS": [{ "n": 1, "title": "Atoms and molecules", "sections": ["atoms", "moles"], "exam": "exam1" }],
  "SECTIONS": [{
    "id": "atoms", "label": "1.1", "title": "Atoms and isotopes", "unit": 1,
    "ideas": ["An atom has protons and neutrons in its nucleus...", "..."],
    "pitfalls": ["The mass number is protons plus neutrons, not protons plus electrons."],
    "example": { "p": "How many neutrons are in carbon-14?", "s": "14 - 6 = 8 neutrons." }
  }],
  "FLASHCARDS": [{ "id": "c1", "unit": 1, "sec": "atoms", "f": "Isotopes", "b": "Atoms of one element with different numbers of neutrons." }],
  "QUIZ": {
    "topics": { "atoms": { "unit": 1, "sec": "atoms", "label": "Atoms and isotopes" } },
    "questions": [{ "type": "bank", "topic": "atoms", "items": [
      ["Isotopes of an element differ in their number of", "neutrons", ["protons", "electrons", "charges"], "Same element means same protons; isotopes differ in neutrons."]
    ] }]
  }
}

RULES THAT MATTER
- CALENDAR rows are ["YYYY-MM-DD", type, title] with an optional fourth value, the id of the section taught that day. type is one of lecture, lab, exam, review, holiday, admin (use admin for deadlines). Include every exam, holiday and deadline in the syllabus, and one lecture row per topic when the syllabus has a schedule.
- Every section has a "unit" that is one of the UNITS "n" values, and every id in a unit's "sections" exists in SECTIONS.
- An exam's "units" lists the unit numbers it covers. Its "weight" is its percent of the final grade; leave "weight" out when the syllabus does not say.
- GRADING weights add up to 100. Use the syllabus's own letter scale when it has one.
- Each question item is [question, correct answer, [three or four wrong answers], a one-sentence explanation]. Wrong answers are plausible but clearly wrong, and the question never gives the answer away.
- color.light is a deep colour that white text can sit on, as #RRGGBB.
- If the answer would get too long, write fewer flashcards and questions, but always finish with a complete, valid JSON object.

THE SYLLABUS:
`;
  }
  const fixPrompt = problems => `The JSON you wrote for Mathub has problems. Fix them and send the complete corrected JSON again, in one \`\`\`json code block and nothing else:\n${problems.map(p => '- ' + p).join('\n')}`;
  const cutPrompt = () => 'Your answer was cut off before the JSON ended, so Mathub cannot read it. Write the whole class again, shorter this time: 6 to 10 SECTIONS with 2 ideas each, about 25 FLASHCARDS and 4 questions per topic. Send only the JSON, in one ```json code block, and make sure it is complete.';

  /* finds the JSON in whatever was pasted: a code block, text around it, or the bare object */
  function extract(text) {
    let t = String(text || '').replace(/^﻿/, '').trim();
    if (!t) return { error: 'empty' };
    const fence = /```[a-zA-Z]*\s*\n?([\s\S]*?)```/.exec(t);
    if (fence && fence[1].includes('{')) t = fence[1].trim(); else t = t.replace(/^```[a-zA-Z]*\s*/, '');
    const s = t.indexOf('{'); if (s < 0) return { error: 'none' };
    t = t.slice(s);
    let depth = 0, inStr = false, escp = false, end = -1;
    for (let i = 0; i < t.length; i++) { const ch = t[i];
      if (inStr) { if (escp) escp = false; else if (ch === '\\') escp = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') { depth--; if (depth === 0) { end = i; break; } } }
    if (end < 0) return { error: 'cut' };
    const body = t.slice(0, end + 1);
    try { return { data: JSON.parse(body) }; } catch (e) {
      try { return { data: JSON.parse(body.replace(/,(\s*[}\]])/g, '$1')) }; } catch (e2) {
        const at = Number((/position (\d+)/.exec(e.message) || [])[1]); const near = Number.isFinite(at) ? body.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' ') : '';
        return { error: 'syntax', message: e.message.replace(/^JSON\.parse: /, ''), near };
      }
    }
  }

  /* safe, mechanical repairs: missing ids, unknown calendar types, units and topics left implied */
  const KEY = /^[a-z0-9][a-z0-9_.-]{0,40}$/i; const ISO = /^\d{4}-\d{2}-\d{2}$/; const HEX = /^#[0-9a-f]{6}$/i;
  const COLORS = ['#1D4ED8', '#0F766E', '#B91C1C', '#6D28D9', '#B45309', '#0E7490', '#BE185D', '#4D7C0F', '#9333EA', '#C2410C'];
  const str = v => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').trim();
  const arr = v => (Array.isArray(v) ? v : []);
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  const slug = (s, fb) => { const x = String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s.-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); return KEY.test(x) ? x : fb; };
  const realDate = d => ISO.test(d || '') && !isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const CAL = { lecture: 'lecture', class: 'lecture', lesson: 'lecture', discussion: 'lecture', seminar: 'lecture', topic: 'lecture', recitation: 'lab', lab: 'lab', laboratory: 'lab', studio: 'lab', exam: 'exam', midterm: 'exam', final: 'exam', test: 'exam', quiz: 'admin', review: 'review', holiday: 'holiday', break: 'holiday', 'no class': 'holiday', 'no-class': 'holiday', admin: 'admin', deadline: 'admin', due: 'admin', assignment: 'admin', homework: 'admin', project: 'admin' };
  function termGuess() { const d = new Date(); const m = d.getMonth() + 1, y = d.getFullYear(); return m >= 8 ? `Fall ${y}` : m <= 5 ? `Spring ${y}` : `Summer ${y}`; }
  function termDates(term) {
    const m = /(fall|autumn|spring|summer|winter)\s+(\d{4})/i.exec(term || ''); const y = m ? m[2] : String(new Date().getFullYear()); const k = m ? m[1].toLowerCase() : '';
    return k === 'spring' || k === 'winter' ? { start: `${y}-01-12`, end: `${y}-05-08` } : k === 'summer' ? { start: `${y}-05-18`, end: `${y}-08-07` } : { start: `${y}-08-24`, end: `${y}-12-18` };
  }
  function repair(input, id) {
    const notes = []; const P = obj(input) ? input : {};
    const C = P.COURSE = obj(P.COURSE) ? P.COURSE : {};
    P.format = 'mathub-class-pack'; P.version = 1; P.id = id;
    P.code = str(P.code) || str(C.code) || 'MY CLASS'; P.name = str(P.name) || str(C.name) || str(P.title) || P.code; P.term = str(P.term) || str(C.term);
    if (!P.term) { P.term = termGuess(); notes.push(`The answer had no term, so it is set to ${P.term}.`); }
    P.short = (str(P.short) || P.code).slice(0, 12);
    C.code = str(C.code) || P.code; C.name = str(C.name) || P.name; C.term = str(C.term) || P.term;
    if (!obj(P.color) || !HEX.test(P.color.light || '')) P.color = { light: COLORS[hash(P.code) % COLORS.length] };
    if (P.color.dark && !HEX.test(P.color.dark)) delete P.color.dark;
    ['NAV', 'title', 'notes', 'hidden', 'preview', 'file'].forEach(k => delete P[k]);
    const keep = new Set(Packs.DATA_KEYS.concat(['format', 'version', 'id', 'color', 'archetype', 'resources', 'resourcesBlurb', 'guides', 'canvasMatch', 'QUIZ', 'formulasTitle']));
    Object.keys(P).forEach(k => { if (!keep.has(k)) delete P[k]; });
    // sections, with a map from the ids the AI wrote to the ids used here
    const secMap = {}; const used = new Set();
    P.SECTIONS = arr(P.SECTIONS).filter(obj).map((s, i) => {
      const was = str(s.id); let sid = KEY.test(was) ? was : slug(was || s.title, `topic-${i + 1}`); let n = 2; while (used.has(sid)) sid = `${sid.replace(/-\d+$/, '')}-${n++}`; used.add(sid); if (was) secMap[was] = sid; secMap[sid] = sid;
      s.id = sid; s.title = str(s.title) || str(s.name) || `Topic ${i + 1}`; s.unit = Number(s.unit) || 1;
      if (typeof s.ideas === 'string') s.ideas = [s.ideas]; s.ideas = arr(s.ideas || s.bullets || s.notes).map(x => (typeof x === 'string' ? x : str(x && (x.text || x.idea)))).filter(Boolean);
      if (typeof s.pitfalls === 'string') s.pitfalls = [s.pitfalls]; s.pitfalls = arr(s.pitfalls).map(str).filter(Boolean);
      if (!(obj(s.example) && s.example.p && s.example.s)) delete s.example;
      if (s.formulas && !Array.isArray(s.formulas)) delete s.formulas;
      delete s.bullets; delete s.notes; delete s.name; return s;
    });
    const mapSec = x => secMap[str(x)] || '';
    // units
    let units = arr(P.UNITS).filter(obj).map((u, i) => ({ n: Number(u.n) || Number(u.unit) || i + 1, title: str(u.title) || str(u.name) || `Unit ${Number(u.n) || i + 1}`, sections: arr(u.sections).map(mapSec).filter(Boolean), exam: str(u.exam) || undefined }));
    const seen = new Set(); units = units.filter(u => (seen.has(u.n) ? false : seen.add(u.n)));
    P.SECTIONS.forEach(s => { let u = units.find(x => x.n === s.unit); if (!u) { u = { n: s.unit, title: `Unit ${s.unit}`, sections: [] }; units.push(u); } if (!u.sections.includes(s.id)) u.sections.push(s.id); });
    units.forEach(u => { u.sections = u.sections.filter(id => P.SECTIONS.some(s => s.id === id && s.unit === u.n)); });
    P.UNITS = units.sort((a, b) => a.n - b.n);
    P.SECTIONS.forEach(s => { if (!str(s.label)) { const u = P.UNITS.find(x => x.n === s.unit); s.label = `${s.unit}.${u ? u.sections.indexOf(s.id) + 1 : 1}`; } });
    // exams: an exam without a real date cannot have a countdown
    const exIds = new Set(); let dropped = 0;
    P.EXAMS = arr(P.EXAMS).filter(obj).map((e, i) => { let eid = KEY.test(str(e.id)) ? str(e.id) : slug(e.name, `exam${i + 1}`); while (exIds.has(eid)) eid += 'b'; exIds.add(eid); e.id = eid; e.name = str(e.name) || `Exam ${i + 1}`; e.date = str(e.date).slice(0, 10); e.units = arr(e.units).map(Number).filter(n => P.UNITS.some(u => u.n === n)); e.sections = arr(e.sections).map(mapSec).filter(Boolean); const w = Number(e.weight); if (w > 0 && w <= 100) e.weight = Math.round(w * 10) / 10; else delete e.weight; e.covers = str(e.covers) || (e.units.length ? `Unit${e.units.length > 1 ? 's' : ''} ${e.units.join(', ')}` : 'the material before it'); if (e.endDate && !realDate(e.endDate)) delete e.endDate; ['dates', 'dateLabels', 'n'].forEach(k => delete e[k]); return e; })
      .filter(e => { if (realDate(e.date)) return true; dropped++; return false; });
    if (dropped) notes.push(`${dropped} exam${dropped === 1 ? ' had' : 's had'} no date in the answer and ${dropped === 1 ? 'is' : 'are'} left out.`);
    P.UNITS.forEach(u => { if (u.exam && !P.EXAMS.some(e => e.id === u.exam)) delete u.exam; });
    // calendar
    let badRows = 0;
    P.CALENDAR = arr(P.CALENDAR).map(r => (Array.isArray(r) ? r : obj(r) ? [r.date, r.type, r.title || r.name, r.section || r.sec] : null)).filter(Boolean).map(r => {
      const d = str(r[0]).slice(0, 10); const type = CAL[str(r[1]).toLowerCase()] || (str(r[1]) ? 'lecture' : 'lecture'); const title = str(r[2]) || (type === 'holiday' ? 'No class' : 'Class');
      if (!realDate(d)) { badRows++; return null; } const sec = r[3] ? mapSec(r[3]) : ''; return sec ? [d, type, title, sec] : [d, type, title];
    }).filter(Boolean).sort((a, b) => a[0].localeCompare(b[0]));
    if (badRows) notes.push(`${badRows} calendar row${badRows === 1 ? '' : 's'} without a real date ${badRows === 1 ? 'was' : 'were'} left out.`);
    delete P.RECURRING; delete P.VARIANTS;
    if (!obj(P.SEMESTER) || !realDate(P.SEMESTER.start) || !realDate(P.SEMESTER.end)) { const ds = P.CALENDAR.map(r => r[0]).concat(P.EXAMS.map(e => e.date)).sort(); P.SEMESTER = ds.length > 1 ? { start: ds[0], end: ds[ds.length - 1] } : termDates(P.term); if (!ds.length) notes.push(`The answer had no dates, so the term is set to ${P.SEMESTER.start} to ${P.SEMESTER.end}.`); }
    // grading
    const G = P.GRADING = obj(P.GRADING) ? P.GRADING : {}; const catIds = new Set();
    G.categories = arr(G.categories).filter(obj).map((c, i) => { let cid = KEY.test(str(c.id)) ? str(c.id) : slug(c.name, `cat${i + 1}`); while (catIds.has(cid)) cid += '2'; catIds.add(cid); return { id: cid, name: str(c.name) || `Category ${i + 1}`, weight: Number(c.weight) || 0 }; }).filter(c => c.weight > 0);
    if (!G.categories.length) { G.categories = [{ id: 'course', name: 'Course grade', weight: 100 }]; notes.push('The answer had no grading categories, so the grade calculator uses one overall grade.'); }
    G.scale = arr(G.scale).filter(obj).map(x => ({ letter: str(x.letter), min: Number(x.min) })).filter(x => x.letter && Number.isFinite(x.min)).sort((a, b) => b.min - a.min);
    if (!G.scale.length) { G.scale = [['A', 90], ['B', 80], ['C', 70], ['D', 60], ['F', 0]].map(([letter, min]) => ({ letter, min })); notes.push('The answer had no letter-grade scale, so A 90, B 80, C 70, D 60 is used.'); }
    if (G.options && !Array.isArray(G.options)) delete G.options;
    // flashcards
    const cardIds = new Set();
    P.FLASHCARDS = arr(P.FLASHCARDS).filter(obj).map((c, i) => { const f = str(c.f || c.front || c.q || c.term), b = str(c.b || c.back || c.a || c.definition); if (!f || !b) return null; let cid = KEY.test(str(c.id)) ? str(c.id) : `c${i + 1}`; while (cardIds.has(cid)) cid += 'x'; cardIds.add(cid); const sec = mapSec(c.sec || c.section); const s = sec && P.SECTIONS.find(x => x.id === sec); return Object.assign({ id: cid, unit: Number(c.unit) || (s ? s.unit : 1), f, b }, sec ? { sec } : {}); }).filter(Boolean);
    P.FORMULAS = arr(P.FORMULAS).filter(g => obj(g) && str(g.group)).map(g => ({ group: str(g.group), items: arr(g.items).filter(it => obj(it) && it.n && (it.t || it.d || it.c)) })).filter(g => g.items.length);
    if (!obj(P.PRACTICE)) delete P.PRACTICE; else Object.keys(P.PRACTICE).forEach(k => { const v = P.PRACTICE[k]; if (!exIds.has(k) || !obj(v) || !Array.isArray(v.problems)) { delete P.PRACTICE[k]; return; } v.title = str(v.title) || k; v.problems = v.problems.filter(p => obj(p) && p.q && p.s).map((p, i) => Object.assign(p, { n: i + 1 })); if (!v.problems.length) delete P.PRACTICE[k]; });
    if (!obj(P.CHECKLISTS)) delete P.CHECKLISTS; else Object.keys(P.CHECKLISTS).forEach(k => { if (!exIds.has(k) || !Array.isArray(P.CHECKLISTS[k])) delete P.CHECKLISTS[k]; });
    P.INFO = arr(P.INFO).filter(x => obj(x) && str(x.title) && str(x.html));
    // the question bank
    if (obj(P.QUIZ)) {
      const Q = P.QUIZ; let topics = Q.topics; if (Array.isArray(topics)) topics = Object.fromEntries(topics.filter(obj).map((t, i) => [str(t.id) || slug(t.label, `t${i + 1}`), t]));
      topics = obj(topics) ? topics : {}; const T = {}; const tMap = {};
      Object.entries(topics).forEach(([k, t], i) => { const tk = KEY.test(k) ? k : slug(k, `t${i + 1}`); tMap[k] = tk; const sec = mapSec((t && t.sec) || k); const s = sec && P.SECTIONS.find(x => x.id === sec); T[tk] = Object.assign({ unit: Number(t && t.unit) || (s ? s.unit : 1), label: str(t && t.label) || (s ? s.title : tk) }, sec ? { sec } : {}); });
      let badItems = 0;
      const qs = arr(Q.questions).filter(obj).map(q => {
        let tk = tMap[str(q.topic)] || str(q.topic); if (!T[tk]) { const sec = mapSec(q.topic); if (sec) { const s = P.SECTIONS.find(x => x.id === sec); T[sec] = { unit: s.unit, label: s.title, sec }; tk = sec; } else return null; }
        q.topic = tk;
        if (q.type === 'bank' || (!q.type && Array.isArray(q.items))) {
          q.type = 'bank';
          q.items = arr(q.items).map(it => Array.isArray(it) ? it : obj(it) ? [it.q || it.question || it.prompt, it.a || it.answer || it.correct, it.wrong || it.distractors || it.options, it.why || it.explanation || it.explain || ''] : null)
            .filter(it => { const ok = it && str(it[0]) && it[1] != null && str(it[1]) !== '' && Array.isArray(it[2]) && it[2].filter(x => str(x) && str(x) !== str(it[1])).length; if (!ok) badItems++; return ok; })
            .map(it => [str(it[0]), str(it[1]), it[2].map(str).filter(x => x && x !== str(it[1])).slice(0, 6), str(it[3])]);
          return q.items.length ? q : null;
        }
        if (q.type === 'mc') return q.prompt && q.answer != null && arr(q.distractors).length ? q : null;
        if (q.type === 'table') return Array.isArray(q.columns) && Array.isArray(q.rows) && Array.isArray(q.asks) ? q : null;
        return null;   // calculated questions need the expression language; the instructions only ask for multiple choice
      }).filter(Boolean);
      if (badItems) notes.push(`${badItems} question${badItems === 1 ? ' was' : 's were'} incomplete and left out.`);
      const usedT = new Set(qs.map(q => q.topic)); Object.keys(T).forEach(k => { if (!usedT.has(k)) delete T[k]; });
      if (qs.length) P.QUIZ = Object.assign({ topics: T, questions: qs }, Q.hint ? { hint: str(Q.hint) } : {}); else { delete P.QUIZ; notes.push('The answer had no usable questions, so the class has no quizzer.'); }
    } else delete P.QUIZ;
    return { pack: P, notes };
  }

  /* ============================================================
     #/create
     ============================================================ */
  const fmtDay = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return d; } };
  const fmtSize = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1000)) + ' KB';
  let pending = null;   // the checked class waiting for "Add"
  App.views.create = {
    title: 'Create a class',
    render(root) {
      const size = settings().mkSize === 'short' ? 'short' : 'full'; pending = null;
      root.innerHTML = `<div class="landing-wrap mk-wrap">
        <header class="landing-top"><div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>Create a class</h1><p class="muted mk-lede">Any class with a syllabus: notes, flashcards, practice questions, its calendar and your grade calculator, written from the syllabus by the AI you already use. The class is saved on this ${DEVICE} and works offline.</p></div><div class="row gap-sm"><a class="btn" href="#/">${icon('left', 14)} Your classes</a></div></header>
        <ol class="mk-steps">
          <li class="panel mk-step"><span class="mk-n" aria-hidden="true">1</span><div class="mk-body"><h2 class="mk-h">Copy the instructions</h2>
            <p>Mathub writes instructions that tell an AI exactly how to turn a syllabus into a class.</p>
            <div class="mk-size" role="radiogroup" aria-label="How long should the answer be?"><button type="button" role="radio" class="chip toggle${size === 'full' ? ' on' : ''}" aria-checked="${size === 'full'}" data-action="size" data-size="full">Full class</button><button type="button" role="radio" class="chip toggle${size === 'short' ? ' on' : ''}" aria-checked="${size === 'short'}" data-action="size" data-size="short">Shorter answer</button><span class="small muted">Choose “Shorter answer” if your AI stops partway through long replies.</span></div>
            <div class="row gap-sm mt-2" style="flex-wrap:wrap"><button type="button" class="btn primary" data-action="copy-prompt">${icon('copy', 15)} Copy instructions</button><button type="button" class="btn" data-action="show-prompt" aria-expanded="false" aria-controls="mk-prompt">${icon('eye', 15)} Read them</button></div>
            <pre class="mk-prompt" id="mk-prompt" hidden></pre></div></li>
          <li class="panel mk-step"><span class="mk-n" aria-hidden="true">2</span><div class="mk-body"><h2 class="mk-h">Ask your AI</h2>
            <p>Open the AI chat you use, in its app or on the web. Paste the instructions, attach your syllabus (a PDF, a photo of it, or its text) and send.</p>
            <p class="small muted">${icon('shield', 13)} Mathub never sees or sends your syllabus. You choose which AI to give it to, and that AI's own privacy terms apply to what you send it.</p></div></li>
          <li class="panel mk-step"><span class="mk-n" aria-hidden="true">3</span><div class="mk-body"><h2 class="mk-h">Paste the answer</h2>
            <p>Copy the AI's whole answer and paste it here. Mathub checks it, fixes small slips and shows you the class before adding it.</p>
            <label class="sr-only" for="mk-text">The AI's answer</label>
            <textarea class="input mono mk-text" id="mk-text" rows="7" placeholder="Paste the AI's answer here" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea>
            <div class="row gap-sm mt-1" style="flex-wrap:wrap"><button type="button" class="btn" data-action="paste">${icon('download', 15)} Paste</button><button type="button" class="btn primary" data-action="check">${icon('check', 15)} Check the answer</button><button type="button" class="btn ghost" data-action="clear">Clear</button></div>
            <div id="mk-result" class="mk-result" aria-live="polite"></div></div></li>
        </ol>
        <p class="small muted mk-alt">No syllabus handy? <button type="button" class="linkbtn small" data-action="example">Try an example class</button>. Got a class file from a classmate? <label class="linkbtn small mk-file">Import it<input type="file" id="mk-file" accept=".json,application/json" hidden></label>.</p>
        <section class="land-sec" aria-labelledby="mk-mine-h"><h2 class="sec-title" id="mk-mine-h">Classes you created</h2><div id="mk-mine"></div></section>
      </div>`;
      const ta = $('#mk-text', root), out = $('#mk-result', root);
      paintMine($('#mk-mine', root));
      const check = () => { pending = null; out.innerHTML = resultHtml(ta.value); wireResult(out, ta); };
      ta.addEventListener('paste', () => setTimeout(check, 30));
      bind(root, {
        size: b => { setSetting('mkSize', b.dataset.size); $$('[data-action="size"]', root).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); const pre = $('#mk-prompt', root); if (!pre.hidden) pre.textContent = prompt(b.dataset.size); },
        'copy-prompt': async () => { try { await N.copy(prompt(settings().mkSize === 'short' ? 'short' : 'full')); N.haptic('success'); toast('Instructions copied. Paste them into your AI with your syllabus.', 3500); } catch (e) { toast(e.message); } },
        'show-prompt': b => { const pre = $('#mk-prompt', root); pre.hidden = !pre.hidden; b.setAttribute('aria-expanded', String(!pre.hidden)); if (!pre.hidden) pre.textContent = prompt(settings().mkSize === 'short' ? 'short' : 'full'); },
        paste: async () => { try { const t = await N.paste(); if (!t) { toast('The clipboard is empty. Copy the AI’s answer first.'); return; } ta.value = t; check(); } catch (e) { toast(e.message, 4000); } },
        check,
        clear: () => { ta.value = ''; out.innerHTML = ''; pending = null; ta.focus(); },
        example: async () => { try { const t = await (await fetch('assets/app-sample-class.json')).text(); ta.value = t; check(); } catch (e) { toast('The example could not be opened.'); } }
      });
      $('#mk-file', root).addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 3e6) { toast('That file is too large to be a class.'); return; } ta.value = await f.text(); e.target.value = ''; check(); });
    }
  };
  function resultHtml(text) {
    const x = extract(text);
    const copyBtn = msg => `<button type="button" class="btn sm" data-copy="${esc(msg)}">${icon('copy', 13)} Copy a message for your AI</button>`;
    if (x.error === 'empty') return `<p class="small muted">Paste the AI's answer first.</p>`;
    if (x.error === 'none') return `<div class="callout warn"><b>No class in that text.</b> Paste the AI's whole answer, including the part that starts with <code>{</code>. If it only wrote a summary, send it the instructions again.</div>`;
    if (x.error === 'cut') return `<div class="callout warn"><b>The answer stops before the end.</b> The AI ran out of room partway through. Send it this message, or choose “Shorter answer” in step 1 and start again.<div class="mt-1">${copyBtn(cutPrompt())}</div></div>`;
    if (x.error === 'syntax') { const msg = `Mathub could not read your JSON: ${x.message}${x.near ? ` (near: ${x.near})` : ''}. Send the complete corrected JSON again, in one \`\`\`json code block and nothing else.`; return `<div class="callout warn"><b>The answer has a typo in it</b>, so it cannot be read${x.near ? `, near “${esc(x.near.slice(0, 60))}”` : ''}. Send the AI this message and paste its new answer.<div class="mt-1">${copyBtn(msg)}</div></div>`; }
    const id = newId(); const { pack, notes } = repair(x.data, id); const v = Packs.validate(pack);
    const bytes = JSON.stringify(pack).length;
    if (bytes > 3e6) return `<div class="callout warn"><b>This class is too large</b> (${fmtSize(bytes)}; the limit is 3 MB). Choose “Shorter answer” in step 1 and ask again.</div>`;
    if (v.errors.length) return `<div class="callout warn"><b>Almost there: ${v.errors.length} thing${v.errors.length === 1 ? '' : 's'} to fix.</b><ul class="mk-list">${v.errors.slice(0, 6).map(m => `<li>${esc(m)}</li>`).join('')}</ul>${v.errors.length > 6 ? `<p class="small">…and ${v.errors.length - 6} more.</p>` : ''}<div class="mt-1">${copyBtn(fixPrompt(v.errors.slice(0, 20)))}</div></div>`;
    pending = pack;
    const st = v.stats || {}; const chip = (n, l) => n ? `<span class="chip">${n} ${l}</span>` : '';
    const later = notes.concat(v.warnings.filter(w => !/^Unknown key/.test(w)));
    const exams = pack.EXAMS.slice(0, 6);
    return `<div class="mk-preview course-card-like" style="--mk:${esc(pack.color.light)}">
      <div class="mk-cover"><span class="mk-code">${esc(pack.code)}</span><span class="mk-term">${esc(pack.term)}</span></div>
      <div class="mk-pv-body"><h3 class="mk-pv-name">${esc(pack.name)}</h3>
        <div class="row gap-sm mk-chips" style="flex-wrap:wrap">${chip(st.sections, st.sections === 1 ? 'topic' : 'topics')}${chip(st.flashcards, 'flashcards')}${chip(st.bankItems || st.questions, 'practice questions')}${chip(st.exams, st.exams === 1 ? 'exam' : 'exams')}${chip(st.calendar, 'calendar dates')}</div>
        ${exams.length ? `<ul class="mk-exams">${exams.map(e => `<li><b>${esc(e.name)}</b> · ${esc(fmtDay(e.date))}</li>`).join('')}</ul>` : '<p class="small muted">No exam dates in the syllabus.</p>'}
        ${later.length ? `<details class="mk-notes"><summary>${later.length} note${later.length === 1 ? '' : 's'} about this class</summary><ul class="mk-list">${later.slice(0, 12).map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
        <p class="small muted">Written by an AI from your syllabus: check dates and grading against the syllabus itself.</p>
        <div class="row gap-sm mt-1"><button type="button" class="btn primary" data-add>${icon('plus', 15)} Add ${esc(pack.code)}</button></div></div></div>`;
  }
  function wireResult(out, ta) {
    out.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => { try { await N.copy(b.dataset.copy); N.haptic('success'); toast('Copied. Paste it into the same AI chat.', 3000); } catch (e) { toast(e.message); } }));
    const add = $('[data-add]', out); if (!add) { N.haptic('warning'); return; }
    add.addEventListener('click', async () => {
      if (!pending) return; add.disabled = true;
      try { const entry = await Mine.add(pending); pending = null; ta.value = ''; N.haptic('success'); toast(`${entry.code} is ready. It is saved on this ${DEVICE}.`, 4000); location.hash = `#/${entry.id}/dashboard`; }
      catch (e) { add.disabled = false; toast('The class could not be saved: ' + e.message, 5000); }
    });
  }
  function paintMine(el) {
    const list = Mine.list();
    el.innerHTML = list.length ? `<ul class="mk-mine">${list.map(e => `<li class="panel mk-row"><div class="mk-row-main"><b>${esc(e.code)}</b> <span>${esc(e.name)}</span><div class="small muted">${esc(e.term || '')} · added ${esc(new Date(e.added).toLocaleDateString())}</div></div>
        <div class="row gap-sm mk-row-act"><a class="btn sm primary" href="#/${esc(e.id)}/dashboard">Open</a><button type="button" class="btn sm" data-share="${esc(e.id)}">${icon('external', 13)} Send</button><button type="button" class="btn sm ghost" data-del="${esc(e.id)}" aria-label="Delete ${esc(e.code)}">${icon('trash', 13)} Delete</button></div></li>`).join('')}</ul>`
      : `<p class="small muted">None yet. Classes you create show up here and with your other classes.</p>`;
    $$('[data-share]', el).forEach(b => b.addEventListener('click', async () => { const id = b.dataset.share; const e = list.find(x => x.id === id); try { const pack = await Mine.read(id); const name = `${String(e.code || id).replace(/[^A-Za-z0-9]+/g, '')}.mathub.json`; await N.shareFile(name, JSON.stringify(pack), `${e.code} for Mathub`); } catch (err) { if (!/cancel/i.test(err.message || '')) toast('Could not share the class: ' + err.message); } }));
    $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => { const id = b.dataset.del; const e = list.find(x => x.id === id); if (!confirm(`Delete ${e.code} from this ${DEVICE}? Your progress in it is deleted too.`)) return; try { await Mine.remove(id); try { localStorage.removeItem('studyhub-' + id); } catch (er) {} toast(`${e.code} deleted.`); paintMine(el); } catch (err) { toast(err.message); } }));
  }

  /* ============================================================
     Reminders: local notifications, only when turned on
     ============================================================ */
  const Reminders = App.reminders = {
    timer: null,
    sync() { clearTimeout(this.timer); this.timer = setTimeout(() => this.apply().catch(() => {}), 400); },
    async apply() {
      if (!N.notify.available()) return;
      const s = settings(); const pend = await N.notify.pending(); const ours = pend.filter(n => n.extra && n.extra.mh === 1).map(n => n.id);
      if (ours.length) await N.notify.cancel(ours);
      if (!s.examReminders && !s.dailyReminder) return;
      if ((await N.notify.permission()) !== 'granted') return;
      const list = []; const now = Date.now();
      if (s.examReminders) {
        // the classes the student chose, plus the ones they made; until they choose, only the ones they made (not every class on Mathub)
        const mine = [...new Set((Array.isArray(s.courses) && s.courses.length ? s.courses : []).concat([...local]))].filter(id => Courses[id] && !Courses[id].preview);
        const items = [];
        mine.forEach(id => { const C = Courses[id]; if (!C) return; (C.EXAMS || []).forEach(e => { if (!e.date || !ISO.test(e.date)) return; const [y, m, d] = e.date.split('-').map(Number);
          [[3, 'in 3 days'], [1, 'tomorrow']].forEach(([before, when]) => { const at = new Date(y, m - 1, d - before, 18, 0, 0); if (at.getTime() > now + 60000 && at.getTime() - now < 120 * 86400000) items.push({ at, title: `${C.short || C.code}: ${e.name} is ${when}`, body: before === 1 ? 'A last look at what it covers, and a few practice questions.' : 'What it covers, the topics to review and practice for each one.', hash: `#/${id}/exam` }); }); }); });
        items.sort((a, b) => a.at - b.at).slice(0, 56).forEach((it, i) => list.push({ id: 1000 + i, title: it.title, body: it.body, schedule: { at: it.at, allowWhileIdle: true }, extra: { mh: 1, hash: it.hash } }));
      }
      if (s.dailyReminder) { const [h, mi] = String(s.reminderTime || '19:00').split(':').map(Number); list.push({ id: 999, title: 'A few minutes of study?', body: 'Your plan for today is ready: flashcards that are due and a short lesson.', schedule: { on: { hour: h || 19, minute: mi || 0 }, repeats: true, allowWhileIdle: true }, extra: { mh: 1, hash: '#/today' } }); }
      await N.notify.schedule(list);
    },
    /* asks the first time a reminder is turned on; true when notifications are allowed */
    async enable() {
      if (!N.notify.available()) return false;
      let p = await N.notify.permission(); if (p === 'prompt' || p === 'prompt-with-rationale') p = await N.notify.request();
      if (p !== 'granted') { toast(ANDROID ? 'Notifications are off for Mathub. Turn them on in Settings › Apps › Mathub › Notifications.' : 'Notifications are off for Mathub. Turn them on in the Settings app: Mathub › Notifications.', 6000); return false; }
      return true;
    }
  };
  N.notify.onTap(extra => { if (extra && typeof extra.hash === 'string' && /^#\//.test(extra.hash)) location.hash = extra.hash; });
  N.onResume(() => Reminders.sync());

  /* ---------- Settings: an "On this device" panel ---------- */
  function devicePanel() {
    const s = settings(); const mine = Mine.list().length;
    return `<div class="panel span-2 app-panel" id="app-panel"><div class="panel-h"><div class="panel-title">${icon('bell')} On this ${DEVICE}</div></div>
      <div class="grid cols-2"><div>
        <label class="check" style="padding:0"><input type="checkbox" id="ap-exams" ${s.examReminders ? 'checked' : ''}><span>Exam reminders <span class="muted small">(3 days before and the evening before each exam in your classes${Array.isArray(s.courses) && s.courses.length ? '' : '; choose your classes above so Mathub knows which ones'})</span></span></label>
        <label class="check" style="padding:0"><input type="checkbox" id="ap-daily" ${s.dailyReminder ? 'checked' : ''}><span>Daily study reminder</span></label>
        <div class="field mt-1" style="max-width:220px"><label for="ap-time">Remind me at</label><input class="input" type="time" id="ap-time" value="${esc(s.reminderTime || '19:00')}" ${s.dailyReminder ? '' : 'disabled'}></div>
      </div><div>
        <label class="check" style="padding:0"><input type="checkbox" id="ap-haptics" ${s.haptics === false ? '' : 'checked'}><span>Haptics <span class="muted small">(a tap when an answer is right or wrong)</span></span></label>
        <p class="small mt-1">${mine ? `${mine} class${mine === 1 ? '' : 'es'} you created ${mine === 1 ? 'is' : 'are'} saved on this ${DEVICE}.` : 'Classes you create from a syllabus are saved on this device.'} <a href="#/create">Create a class</a></p>
        <p class="small muted">Mathub ${esc(MA.version)} · <a href="#/policy">Terms and privacy</a> · <a href="#/contact">Contact</a></p>
      </div></div></div>`;
  }
  function wireDevicePanel(el) {
    const ex = $('#ap-exams', el), dy = $('#ap-daily', el), tm = $('#ap-time', el), hp = $('#ap-haptics', el);
    const turnOn = async (box, key) => { if (box.checked && !(await Reminders.enable())) { box.checked = false; return; } setSetting(key, box.checked); if (key === 'dailyReminder') tm.disabled = !box.checked; Reminders.sync(); if (box.checked) toast(key === 'examReminders' ? 'Exam reminders are on.' : `You will get a reminder every day at ${tm.value}.`); };
    ex.addEventListener('change', () => turnOn(ex, 'examReminders'));
    dy.addEventListener('change', () => turnOn(dy, 'dailyReminder'));
    tm.addEventListener('change', () => { setSetting('reminderTime', tm.value || '19:00'); Reminders.sync(); });
    hp.addEventListener('change', () => { setSetting('haptics', hp.checked); if (hp.checked) N.haptic('success'); });
  }

  /* ============================================================
     The app's own shell (the website keeps its sidebar, top bar and start page):
     - an app bar: the class you are in (tap to switch, add a class or open its tools), your streak,
       today's XP and the account button
     - the start page: your classes as a row of cards, and the winding path through the one you picked
     - a tab bar: Learn, Practice, Today, Board, Me
     ============================================================ */
  const myIds = () => App.myCourses().filter(id => Courses[id] && !Courses[id].preview);
  const curClass = () => { const mine = myIds(); const s = settings().appClass; return mine.includes(s) ? s : App.D && mine.includes(App.D.id) ? App.D.id : mine[0] || null; };
  const setClass = id => { if (id) setSetting('appClass', id); };
  // each class's colours, read from the site's own class rules (works for built-in classes, packs and classes made in the app)
  const probe = (() => { let el = null; return id => { if (!el) { el = document.createElement('i'); el.hidden = true; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); } el.className = 'course-card ' + id; const cs = getComputedStyle(el); const v = n => cs.getPropertyValue(n).trim(); return { c: v('--accent'), ink: v('--accent-ink') || '#fff', soft: v('--accent-soft'), line: v('--accent-line'), deep: v('--accent-deep') || v('--accent') }; }; })();
  const ccStyle = id => { const k = probe(id); return k.c ? `--cc:${k.c};--cc-ink:${k.ink};--cc-soft:${k.soft};--cc-line:${k.line};--cc-deep:${k.deep}` : ''; };
  const examOf = C => { try { return App.nextExamOf(C); } catch (e) { return null; } };
  const daysTo = ex => ex && ex.date ? App.daysBetween(App.todayISO(), ex.date) : null;
  const inDays = d => d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
  const goSearch = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  const ROOTS = r => (!r.course && ['home', 'today', 'forum', 'settings'].includes(r.view)) || (r.course && ['practice', 'flashcards'].includes(r.view));
  const practiceHref = id => { const C = Courses[id]; if (!C) return '#/'; return (C.quiz || C.hasQuiz || C.quizTopics || C.QUIZ) ? `#/${id}/practice` : `#/${id}/flashcards`; };

  /* ---------- app bar ---------- */
  function paintAppBar(r) {
    let bar = $('#appbar'); if (!bar) { bar = document.createElement('header'); bar.id = 'appbar'; bar.className = 'appbar'; document.body.prepend(bar); bar.addEventListener('click', onBar); }
    const id = (r && r.course && Courses[r.course]) ? r.course : curClass(); const C = id ? Courses[id] : null;
    const st = App.streakAll ? App.streakAll() : { n: 0, activeToday: false }; const xp = App.xpToday ? App.xpToday() : 0; const goal = App.dailyGoal ? App.dailyGoal() : 30;
    const u = App.auth && App.auth.user; const name = u ? (u.name || u.email.split('@')[0]) : '';
    const back = r && !ROOTS(r) ? `<button class="ab-back" data-ab="back" aria-label="Back">${icon('left', 22)}</button>` : '';
    bar.innerHTML = `<div class="ab-l">${back}${C ? `<button class="ab-class" data-ab="classes" style="${ccStyle(id)}" aria-label="${esc(C.short || C.code)}: switch class or open its tools" aria-haspopup="dialog"><span class="ab-class-code">${esc(C.short || C.code)}</span>${icon('chevron', 14)}</button>` : `<button class="ab-class none" data-ab="classes" aria-haspopup="dialog">${icon('plus', 16)}<span class="ab-class-code">Add a class</span></button>`}</div>
      <div class="ab-r"><button class="ab-stat ab-streak${st.activeToday ? ' on' : ''}" data-ab="streak" aria-label="${st.n} day streak${st.activeToday ? ', studied today' : ''}">${icon('fire', 20)}<b>${st.n}</b></button>
      <button class="ab-stat ab-xp${xp >= goal ? ' on' : ''}" data-ab="xp" aria-label="${xp} of ${goal} XP today">${icon('zap', 20)}<b>${xp}</b><small>/${goal}</small></button>
      ${u ? `<a class="ab-acct" href="#/settings" aria-label="Your account, ${esc(name)}"><span class="ab-avatar">${esc(name.trim()[0].toUpperCase())}</span></a>` : `<button class="ab-signin" data-ab="signin">Sign in</button>`}</div>`;
  }
  function onBar(e) {
    const b = e.target.closest('[data-ab]'); if (!b) return; const a = b.dataset.ab; N.haptic('select');
    if (a === 'back') { if (history.length > 1) history.back(); else location.hash = '#/'; }
    else if (a === 'classes') openSheet();
    else if (a === 'signin') { if (App.auth) App.auth.open('login'); }
    else if (a === 'streak' || a === 'xp') pop(a, b);
  }
  function pop(kind, anchor) {
    const old = $('.ab-pop'); if (old) { const same = old.dataset.kind === kind; old.remove(); if (same) return; }
    const el = document.createElement('div'); el.className = 'ab-pop'; el.dataset.kind = kind; el.setAttribute('role', 'status');
    if (kind === 'streak') { const st = App.streakAll(); const fz = App.freezeBank ? App.freezeBank() : 0;
      el.innerHTML = `<b>${st.n} day${st.n === 1 ? '' : 's'} in a row</b><span>${st.activeToday ? 'You studied today. Come back tomorrow to keep it going.' : st.n ? 'Answer a question or review a card today to keep it.' : 'Answer a question or review a card to start a streak.'}</span><span class="ab-pop-meta">Longest ${st.longest || st.n} · ${fz} streak freeze${fz === 1 ? '' : 's'} saved</span>`; }
    else { const xp = App.xpToday(), goal = App.dailyGoal(), lv = App.level ? App.level() : null; const pct = Math.min(100, Math.round(100 * xp / goal));
      el.innerHTML = `<b>${xp} of ${goal} XP today</b><span class="ab-bar" role="presentation"><i style="width:${pct}%"></i></span><span class="ab-pop-meta">${lv ? `Level ${lv.n}${lv.name ? ' · ' + esc(lv.name) : ''} · ${lv.toNext} XP to the next` : ''}</span>`; }
    document.body.appendChild(el); const r = anchor.getBoundingClientRect(), w = el.offsetWidth;   // centred under its button, kept 12 px inside the screen
    el.style.top = (r.bottom + 8) + 'px'; el.style.left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 12)) + 'px';
    setTimeout(() => document.addEventListener('click', function off(ev) { if (!el.contains(ev.target)) { el.remove(); document.removeEventListener('click', off, true); } }, true), 0);
  }

  /* ---------- the class sheet: switch class, add one, and this class's tools ---------- */
  function openSheet(focus) {
    if ($('#class-sheet')) return; const id = curClass(); const C = id ? Courses[id] : null; const mine = myIds();
    const all = App.COURSE_ORDER.filter(x => Courses[x] && !Courses[x].preview && !local.has(x));
    const tools = C && C.NAV && App.groupNav ? App.groupNav(C.NAV).flatMap(g => g.items) : [];
    const more = [['#/today', 'Today', 'flag'], ['#/focus', 'Focus room', 'clock'], ['#/resources', 'Resources', 'book'], ['#/guides', 'Study guides', 'bulb'], ['#/tools', 'Tools', 'calc'], ['#/gpa', 'GPA', 'chart'], ['#/leagues', 'Leagues', 'trophy'], ['#/badges', 'Badges', 'award']];
    const el = document.createElement('div'); el.className = 'modal-backdrop sheet-backdrop'; el.id = 'class-sheet';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Your classes"><div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-h"><h2>Your classes</h2><button class="icon-btn" data-action="close" aria-label="Close">${icon('x', 18)}</button></div>
      <div class="sheet-classes">${mine.map(x => { const K = Courses[x]; const ex = examOf(K); const d = daysTo(ex); return `<a class="sc-row${x === id ? ' on' : ''}" href="#/" data-pick="${x}" style="${ccStyle(x)}"><span class="sc-badge">${esc((K.short || K.code).replace(/\s+/g, ' '))}</span><span class="sc-main"><b>${esc(K.name)}</b><small>${ex && d !== null && d >= 0 ? `${esc(ex.name)} ${inDays(d)}` : local.has(x) ? 'Made from your syllabus' : 'No exam ahead'}</small></span>${x === id ? icon('check', 18) : icon('right', 16)}</a>`; }).join('')}</div>
      <div class="sheet-actions"><a class="btn primary" href="#/create">${icon('plus', 15)} Create a class from a syllabus</a><button class="btn" data-action="pick">${icon('grid', 15)} Choose Montana State classes</button></div>
      <div class="sheet-pick" hidden><p class="small muted">Tick the classes you take. The rest stay out of your way.</p><div class="pick-list">${all.map(x => `<label class="check pick-row" style="${ccStyle(x)}"><input type="checkbox" data-c="${x}"${mine.includes(x) ? ' checked' : ''}><span class="sc-badge">${esc(Courses[x].short || Courses[x].code)}</span><span>${esc(Courses[x].name)}</span></label>`).join('')}</div><div class="row gap-sm mt-1"><button class="btn primary" data-action="save-pick">Save</button>${App.views.request ? `<a class="btn ghost" href="#/request">Not listed? Request it</a>` : ''}</div></div>
      ${C ? `<h3 class="sheet-sub sheet-tools-h">In ${esc(C.short || C.code)}</h3><div class="sheet-grid" style="${ccStyle(id)}"><a class="sg-item" href="#/${id}/dashboard">${icon('home', 20)}<span>Class page</span></a>${tools.filter(t => t[0] !== 'dashboard').map(([v, l, ic]) => `<a class="sg-item" href="#/${id}/${v}">${icon(ic || 'book', 20)}<span>${esc(l)}</span></a>`).join('')}</div>` : ''}
      <h3 class="sheet-sub">Everything else</h3><div class="sheet-grid">${more.map(([h, l, ic]) => `<a class="sg-item" href="${h}">${icon(ic, 20)}<span>${l}</span></a>`).join('')}<button class="sg-item" data-action="search">${icon('search', 20)}<span>Search</span></button>${App.ambient ? `<button class="sg-item" data-action="sounds"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg><span>Focus sounds</span></button>` : ''}</div></div>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('open'));
    if (focus === 'tools') { const h = $('.sheet-tools-h', el); if (h) requestAnimationFrame(() => { const sh = $('.sheet', el); sh.scrollTop += h.getBoundingClientRect().top - sh.getBoundingClientRect().top - 12; }); }   // "All tools" on the start page opens the sheet at the class's tools
    const close = () => { document.removeEventListener('keydown', onKey); el.classList.remove('open'); setTimeout(() => el.remove(), N.reduceMotion() ? 0 : 220); };
    const onKey = e => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', onKey);
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-action="close"]')) return close();
      const pick = e.target.closest('[data-pick]'); if (pick) { e.preventDefault(); setClass(pick.dataset.pick); N.haptic('select'); close(); if (location.hash === '#/' || location.hash === '' || location.hash === '#') App.rerender(); else location.hash = '#/'; return; }
      if (e.target.closest('[data-action="pick"]')) { const box = $('.sheet-pick', el); box.hidden = !box.hidden; return; }
      if (e.target.closest('[data-action="save-pick"]')) { const ids = $$('input[data-c]', el).filter(i => i.checked).map(i => i.dataset.c).concat([...local].filter(x => Courses[x])); if (!ids.length) { toast('Pick at least one class.'); return; } setSetting('courses', ids); if (App.auth && App.auth.user && App.auth.savePrefs) App.auth.savePrefs({ courses: ids }).catch(() => {}); if (App.rebuildNav) App.rebuildNav(); if (!ids.includes(settings().appClass)) setClass(ids[0]); close(); App.rerender(); return; }
      if (e.target.closest('[data-action="search"]')) { close(); setTimeout(goSearch, 50); return; }
      if (e.target.closest('[data-action="sounds"]')) { close(); setTimeout(() => App.ambient.open(), 50); return; }   // the sounds bubble stays out of the way in the app until something plays
      if (e.target.closest('a[href]')) close();
    });
  }

  /* ---------- the start page ----------
     Your classes as cards; under them the one you picked: where the class is, its next exam and how ready
     you are, and the next lesson; then today across all your classes (daily goal, flashcards, missed
     questions, what is due); then the class's tools and its path with every lesson named. Nothing the
     website's start page and class page show is left out. */
  const safe = f => { try { return f(); } catch (e) { return null; } };
  const NODE_IC = { done: 'check', current: 'play', open: 'play', soon: 'book' };
  const TOOL_ORDER = ['notes', 'readings', 'practice', 'flashcards', 'formulas', 'exam', 'calendar', 'grades', 'playground', 'mistakes', 'planner', 'course'];
  const TOOL_NAME = { notes: 'Notes', readings: 'Readings', practice: 'Practice', flashcards: 'Flashcards', formulas: 'Formulas', exam: 'Exam prep', calendar: 'Calendar', grades: 'Grades', playground: 'Python', mistakes: 'Mistakes', planner: 'Planner', course: 'Syllabus' };
  const SIDE_X = [-44, -14, 14, 44, 14, -14];   // the path's gentle zig-zag; each lesson's name sits on the roomier side of its button
  const nodesOf = C => (C && C.kind !== 'writing' && App.pathNodes ? safe(() => App.pathNodes(C)) : null) || [];
  const whenTxt = n => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
  const bar = (pct, cls = '', label = '') => `<span class="ah-bar${cls ? ' ' + cls : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"${label ? ` aria-label="${esc(label)}"` : ''}><i style="width:${pct}%"></i></span>`;

  function todayHtml() {
    const ids = myIds(); const t = App.todayISO();
    const due = ids.map(x => ({ x, n: safe(() => { const d = App.dueCards(x); return d.count + (d.estimated || 0); }) || 0 })).filter(o => o.n); const dueN = due.reduce((s, o) => s + o.n, 0);
    const mist = ids.map(x => ({ x, n: (safe(() => App.mistakesDue(x)) || []).length })).filter(o => o.n); const mistN = mist.reduce((s, o) => s + o.n, 0);
    const dls = ids.flatMap(x => (safe(() => App.upcomingDeadlinesOf(Courses[x], 8)) || []).map(d => Object.assign({ c: x, n: App.daysBetween(t, d.date) }, d))).filter(d => d.n >= 0 && d.n <= 7).sort((a, b) => a.date.localeCompare(b.date));
    const xp = App.xpToday ? App.xpToday() : 0, goal = App.dailyGoal ? App.dailyGoal() : 30; const pct = Math.min(100, Math.round(100 * xp / goal));
    const row = (href, ic, tone, title, sub, end) => `<a class="ah-item ${tone}" href="${href}"><span class="ah-ic" aria-hidden="true">${icon(ic, 19)}</span><span class="ah-item-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${end ? `<span class="ah-end">${end}</span>` : icon('right', 16)}</a>`;
    const rows = [];
    if (dueN) rows.push(row('#/today?review=1', 'cards', 'blue', `${dueN} flashcard${dueN === 1 ? '' : 's'} to review`, esc(due.map(o => `${Courses[o.x].short || Courses[o.x].code} ${o.n}`).join(' · ')), ''));
    if (mistN) rows.push(row(`#/${mist[0].x}/mistakes`, 'undo', 'coral', `Retry ${mistN} missed question${mistN === 1 ? '' : 's'}`, 'Back with their explanations', ''));
    const shown = dls.slice(0, Math.max(1, 3 - rows.length));
    shown.forEach(d => rows.push(row(`#/${d.c}/calendar`, d.type === 'exam' ? 'flag' : 'clock', d.type === 'exam' ? 'coral' : 'gold', esc(d.title), `${esc(Courses[d.c].short || Courses[d.c].code)}${d.n > 1 ? ' · ' + esc(App.fmtDate(d.date)) : ''}${d.time ? ' · ' + esc(d.time) : ''}`, whenTxt(d.n))));
    const more = dls.length > shown.length ? `<a class="ah-more-row" href="#/today">${dls.length - shown.length} more due this week ${icon('right', 14)}</a>` : '';
    return `<section class="ah-today" aria-labelledby="ah-today-h"><div class="ah-sec-h"><h2 id="ah-today-h">Today, all classes</h2><a class="ah-link" href="#/today">Full plan ${icon('right', 14)}</a></div>
      <div class="ah-goal"><span>${icon('zap', 16)} <b>${xp}</b> of ${goal} XP</span>${bar(pct, 'gold', 'Daily goal')}</div>
      ${rows.length ? `<div class="ah-list">${rows.join('')}</div>${more}` : `<p class="ah-quiet">Nothing due this week. One lesson below keeps your streak going.</p>`}</section>`;
  }

  function classRow(mine, id) {
    return `<div class="ah-sec-h"><h2>Your classes</h2></div><div class="ah-row" role="list" aria-label="Your classes">${mine.map(x => { const K = Courses[x]; const ex = examOf(K); const d = daysTo(ex); const ns = nodesOf(K); const done = ns.filter(n => n.state === 'done').length;
      return `<button class="ah-card${x === id ? ' on' : ''}" role="listitem" data-cid="${x}" style="${ccStyle(x)}" aria-pressed="${x === id}"><span class="ah-art" aria-hidden="true">${App.classSprite ? App.classSprite(x, 3) : ''}</span><b class="ah-code">${esc(K.short || K.code)}</b><span class="ah-exam">${ex && d !== null && d >= 0 ? `${esc(ex.name)} ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}` : local.has(x) ? 'Your class' : 'No exam ahead'}</span>${ns.length ? `<span class="ah-cbar" aria-label="${done} of ${ns.length} topics mastered"><i style="width:${Math.round(100 * done / ns.length)}%"></i></span>` : ''}</button>`; }).join('')}<button class="ah-card ah-add" data-ab-add="1" aria-label="Add a class">${icon('plus', 26)}<span class="ah-exam">Add a class</span></button></div>`;
  }

  function heroHtml(C) {
    const id = C.id; const writing = C.kind === 'writing';
    const ss = safe(() => App.semesterStateOf(C)); const cur = safe(() => App.currentSectionOf(C));
    const ex = examOf(C); const es = ex ? safe(() => App.examStatus(ex)) : null; const rd = ex && !writing ? safe(() => App.readiness(id)) : null;
    const ns = nodesOf(C); const done = ns.filter(n => n.state === 'done').length; const next = ns.find(n => n.state === 'current') || ns.find(n => n.state === 'open');
    const rp = writing && App.readingProgress ? safe(() => App.readingProgress(C)) : null;
    const go = writing ? (rp && rp.next ? [`#/${id}/reading/${rp.next.id}`, rp.started ? 'Keep listening' : 'Next reading', rp.next.title] : [`#/${id}/readings`, 'Readings', 'Browse the readings'])
      : next ? [`#/${id}/lesson?topics=${encodeURIComponent(next.t)}`, done || next.n ? 'Continue · 5-minute lesson' : 'Start here · 5-minute lesson', next.label]
      : cur ? [`#/${id}/notes/${cur.id}`, 'This week in class', cur.title] : [`#/${id}/dashboard`, 'Open the class', C.name];
    const when = ss ? (ss.phase === 'before' ? `Starts ${App.fmtDate(C.SEMESTER.start, true)}` : ss.phase === 'after' ? 'Semester over' : ss.phase === 'finals' ? 'Finals week' : `Week ${ss.week}${ss.weeks ? ' of ' + ss.weeks : ''}`) : '';
    const now = cur && ss && ss.phase !== 'after' ? `${ss.phase === 'before' ? 'first up' : 'now covering'} ${cur.label} ${cur.title}` : '';
    const exHtml = ex && es ? `<a class="ah-ex" href="#/${id}/${writing ? 'course' : 'exam/' + encodeURIComponent(ex.id)}">
        <span class="ah-days">${es.n > 0 ? `<b>${es.n}</b> <small>${es.n === 1 ? 'day' : 'days'}</small>` : `<b class="sm">${esc(es.big)}</b>`}</span>
        <span class="ah-ex-t"><b>${esc(ex.name)} · ${esc(ex.dateLabel || App.fmtDate(ex.date))}</b><small>${[ex.covers ? `${writing ? 'Turn in' : 'Covers'} ${ex.covers}` : '', ex.weight ? `${ex.weight}% of the grade` : ''].filter(Boolean).map(esc).join(' · ')}</small>
        ${rd && rd.ok ? `<span class="ah-ready">${bar(rd.score, 'pine', 'Ready for ' + ex.name)}<em>${rd.score}% ready · ${esc(rd.label)}</em></span>` : ''}</span>${icon('right', 18)}</a>`
      : `<p class="ah-quiet">${(C.EXAMS || []).length ? 'No exams left this semester.' : 'No exams in this class.'}</p>`;
    return `<section class="ah-hero" aria-labelledby="ah-hero-h">
      <div class="ah-hero-h"><div><h2 id="ah-hero-h">${esc(C.name)}</h2>${when || now ? `<p>${esc([when, now].filter(Boolean).join(' · '))}</p>` : ''}</div><a class="ah-link" href="#/${id}/dashboard">Class page ${icon('right', 14)}</a></div>
      ${exHtml}
      <a class="ah-go" href="${go[0]}"><span class="ah-go-ic" aria-hidden="true">${icon('play', 22)}</span><span class="ah-go-t"><small>${esc(go[1])}</small><b>${esc(go[2])}</b></span></a>
      ${ns.length ? `<p class="ah-mast">${bar(Math.round(100 * done / ns.length), 'pine', 'Topics mastered')}<span>${done} of ${ns.length} topics mastered</span></p>` : ''}</section>`;
  }

  function toolsHtml(C) {
    const id = C.id; const all = C.NAV && App.groupNav ? App.groupNav(C.NAV).flatMap(g => g.items) : [];
    const pick = TOOL_ORDER.map(v => all.find(x => x[0] === v)).filter(Boolean).slice(0, 7);
    if (!pick.length) return '';
    return `<section class="ah-tools" aria-labelledby="ah-tools-h"><div class="ah-sec-h"><h2 id="ah-tools-h">Study tools</h2></div><div class="ah-tgrid">${pick.map(([v, l, ic]) => `<a class="ah-tool" href="#/${id}/${v}"><span class="ah-tool-ic" aria-hidden="true">${icon(ic || 'book', 22)}</span><span>${esc(TOOL_NAME[v] || l)}</span></a>`).join('')}<button class="ah-tool" data-ab-tools="1"><span class="ah-tool-ic" aria-hidden="true">${icon('grid', 22)}</span><span>All tools</span></button></div></section>`;
  }

  function pathHtml(C) {
    const id = C.id; const nodes = nodesOf(C);
    const units = (C.UNITS || []).map(u => ({ u, ns: nodes.filter(n => n.unit && n.unit.n === u.n) }));
    // classes without practice topics get a path of their sections (each opens its notes)
    const cur = safe(() => App.currentSectionOf(C));
    const secPath = !nodes.length ? (C.UNITS || []).map(u => ({ u, ns: (C.SECTIONS || []).filter(s => s.unit === u.n).map(s => ({ sec: s, label: s.title || s.label, state: cur && cur.id === s.id ? 'current' : 'open', href: `#/${id}/notes/${s.id}` })) })) : null;
    const list = (secPath || units).filter(x => x.ns.length);
    if (!list.length) return '';
    const today = App.todayISO(); let k = 0; const all = list.flatMap(x => x.ns); const done = all.filter(n => n.state === 'done').length;
    const html = list.map(({ u, ns }) => {
      const ex = (C.EXAMS || []).find(e => e.id === u.exam); const d = ex ? daysTo(ex) : null; const udone = ns.filter(n => n.state === 'done').length; const firstSec = (ns[0] && ns[0].sec && ns[0].sec.id) || '';
      const items = ns.map(n => { const x = SIDE_X[k++ % SIDE_X.length]; const side = x <= 0 ? 'r' : 'l'; const st = n.state; const sec = n.sec || {};
        const href = n.href || `#/${id}/lesson?topics=${encodeURIComponent(n.t)}`; const prac = n.t ? `#/${id}/practice?topics=${encodeURIComponent(n.t)}` : ''; const notes = `#/${id}/notes/${sec.id}`;
        const sub = secPath ? (st === 'current' ? 'This week in class' : 'Notes') : st === 'done' ? `Mastered · ${n.crowns} of 5 crowns` : st === 'current' ? (n.n ? `Up next · ${n.n} answered` : 'Up next') : st === 'soon' ? (n.n ? `Coming up in class · ${n.n} answered` : 'Coming up in class') : n.n ? `${n.n} answered · ${n.crowns} of 5 crowns` : 'Not started';
        return `<li class="ap-li ${st}" style="--x:${x}px" data-side="${side}">${st === 'current' ? `<span class="ap-start" aria-hidden="true">${secPath ? 'Read' : 'Start'}</span><span class="ap-bo" aria-hidden="true">${App.bobcatSvg ? App.bobcatSvg(52) : ''}</span>` : ''}<button class="ap-row" data-node aria-expanded="false"><span class="ap-node" aria-hidden="true">${icon(NODE_IC[st] || 'play', 28)}</span><span class="ap-label"><b>${esc(n.label)}</b><small>${sec.label ? esc(sec.label) + ' · ' : ''}${sub}</small></span></button>
          <div class="ap-pop" hidden><b>${esc(n.label)}</b><span>${esc([sec.label, n.t ? sec.title : ''].filter(Boolean).join(' '))}${n.n ? ` · ${n.n} answered` : ''}</span><div class="ap-pop-acts"><a class="btn primary" href="${href}">${icon('play', 15)} ${n.t ? 'Start lesson' : 'Read the notes'}</a>${prac ? `<a class="btn" href="${prac}">Practice</a><a class="btn ghost" href="${notes}">Notes</a>` : ''}</div></div></li>`; }).join('');
      const exNode = ex ? `<li class="ap-li exam${ex.date < today ? ' past' : ''}"><a class="ap-exam" href="#/${id}/exam/${encodeURIComponent(ex.id)}" aria-label="${esc(ex.name)}, ${ex.date < today ? 'done' : inDays(d)}">${icon(ex.date < today ? 'check' : 'flag', 30)}</a><span class="ap-exam-label"><b>${esc(ex.name)}</b>${esc(ex.dateLabel || App.fmtDate(ex.date, true))} · ${ex.date < today ? 'done' : inDays(d)}</span></li>` : '';
      return `<section class="ap-unit"><header class="ap-banner"><div class="ap-banner-txt"><h3>${esc(u.title)}</h3><p>Unit ${u.n} · ${udone} of ${ns.length} ${secPath ? 'topics' : 'mastered'}${ex ? ` · ${esc(ex.name)} ${ex.date < today ? 'done' : inDays(d)}` : ''}</p>${secPath ? '' : `<span class="ap-ubar" aria-hidden="true"><i style="width:${Math.round(100 * udone / ns.length)}%"></i></span>`}</div><a class="ap-guide" href="#/${id}/notes${firstSec ? '/' + firstSec : ''}">${icon('book', 18)}<span>Notes</span></a></header><ol class="ap-nodes">${items}${exNode}</ol></section>`;
    }).join('');
    return `<section class="ah-pathsec" aria-labelledby="ah-path-h"><div class="ah-sec-h"><h2 id="ah-path-h">Your path</h2>${secPath ? '' : `<span class="ah-count">${done} of ${all.length} mastered</span>`}</div><p class="ah-hint">Every topic in the order the class covers it. Tap one to ${secPath ? 'read its notes' : 'start a lesson, practise it or read its notes'}.</p>${html}</section>`;
  }

  App.homeView = {
    title: 'Learn',
    render(root) {
      const mine = myIds(); const id = curClass();
      const banners = [App.inviteBanner ? safe(() => App.inviteBanner()) : '', App.recapBanner ? safe(() => App.recapBanner()) : ''].filter(Boolean).join('');
      root.innerHTML = `<div class="ah"><h1 class="sr-only">Learn</h1><div id="announcement-slot"></div>${banners ? `<div class="ah-banners">${banners}</div>` : ''}
        ${mine.length ? classRow(mine, id) : ''}
        <div class="ah-main" id="ah-main" aria-busy="${id ? 'true' : 'false'}">${id ? '<div class="ah-loading" aria-hidden="true"><i></i><i></i><i></i></div>' : `<div class="ah-empty"><span class="ah-empty-bo" aria-hidden="true">${App.bobcatSvg ? App.bobcatSvg(96) : ''}</span><h2>Which classes are you taking?</h2><p>Pick yours, or make one from any syllabus.</p><div class="row gap-sm"><button class="btn primary" data-ab-add="1">Add a class</button></div></div>`}</div></div>`;
      const row = $('.ah-row', root); const on = row && $('.ah-card.on', row); if (on) row.scrollLeft = Math.max(0, on.offsetLeft - 16);
      if (App.paintAnnouncement) safe(() => App.paintAnnouncement(root));
      const closePops = () => { $$('.ap-pop', root).forEach(x => { x.hidden = true; }); $$('[data-node]', root).forEach(x => x.setAttribute('aria-expanded', 'false')); $$('.ap-li.open', root).forEach(x => x.classList.remove('open')); document.body.classList.remove('ap-open'); };
      root.addEventListener('click', e => {
        if (e.target.closest('[data-ab-add]')) { N.haptic('select'); openSheet(); return; }
        if (e.target.closest('[data-ab-tools]')) { N.haptic('select'); openSheet('tools'); return; }
        const card = e.target.closest('.ah-card[data-cid]'); if (card) { N.haptic('select'); setClass(card.dataset.cid); App.homeView.scrolled = false; App.rerender(); return; }
        const node = e.target.closest('[data-node]'); if (node) { N.haptic('select'); const li = node.closest('.ap-li'); const p = $('.ap-pop', li); const open = p.hidden; closePops(); p.hidden = !open; li.classList.toggle('open', open); document.body.classList.toggle('ap-open', open); node.setAttribute('aria-expanded', String(open));
          if (open) { const lim = innerHeight - ($('#tabbar') || { offsetHeight: 0 }).offsetHeight - 16, below = p.getBoundingClientRect().bottom - lim; if (below > 0) scrollBy({ top: below, behavior: N.reduceMotion() ? 'auto' : 'smooth' }); }   // the card opens fully in view, above the tab bar
          return; }
        if (!e.target.closest('.ap-pop')) closePops();
      });
      if (!id) return;
      App.loadCourse(id).then(C => {
        const box = $('#ah-main'); if (!box || !root.isConnected) return;
        box.setAttribute('style', ccStyle(id)); box.innerHTML = heroHtml(C) + todayHtml() + toolsHtml(C) + pathHtml(C); box.setAttribute('aria-busy', 'false');
        // the class's cards can now show its progress, and the plan its flashcards
        const card = $(`.ah-card[data-cid="${id}"]`, root); if (card && !$('.ah-cbar', card)) { const ns = nodesOf(C); if (ns.length) { const dn = ns.filter(n => n.state === 'done').length; card.insertAdjacentHTML('beforeend', `<span class="ah-cbar" aria-label="${dn} of ${ns.length} topics mastered"><i style="width:${Math.round(100 * dn / ns.length)}%"></i></span>`); } }
        if (App.typeset) safe(() => App.typeset(box));
      }).catch(() => { const box = $('#ah-main'); if (box) { box.setAttribute('aria-busy', 'false'); box.innerHTML = `<div class="ah-empty"><p>This class could not be opened.</p><a class="btn" href="#/${id}/dashboard">Try its class page</a></div>`; } });
    }
  };

  /* ---------- tab bar ---------- */
  function paintTabs(r) {
    const bar = $('#tabbar'); if (!bar) return; const id = (r.course && Courses[r.course]) ? r.course : curClass();
    const tabs = [['#/', 'Learn', 'home', !r.course && r.view === 'home'], [id ? practiceHref(id) : '#/', 'Practice', 'list', !!r.course && ['practice', 'flashcards', 'lesson', 'blitz', 'exam'].includes(r.view)], ['#/today', 'Today', 'flag', r.view === 'today'], ['#/forum', 'Discuss', 'chat', r.view === 'forum'], ['#/settings', 'Me', 'user', r.view === 'settings']];
    bar.className = 'app-tabs'; bar.setAttribute('aria-label', 'Main');
    bar.innerHTML = tabs.map(([h, l, ic, a]) => `<a class="tab-item${a ? ' active' : ''}" href="${h}"${a ? ' aria-current="page"' : ''}><span class="tab-ic">${icon(ic, 26)}</span><span>${l}</span></a>`).join('');
  }
  // the app bar follows XP and streak changes as they happen
  if (App.paintStats) { const ps = App.paintStats; App.paintStats = function () { const out = ps.apply(this, arguments); try { if ($('#appbar')) paintAppBar(lastRoute); } catch (e) {} return out; }; }
  let lastRoute = { course: null, view: 'home' };
  if (App.auth && App.auth.onChange) App.auth.onChange(() => { try { paintAppBar(lastRoute); } catch (e) {} });

  /* ---------- where the app's own pieces join the pages ---------- */
  App.onRender = App.onRender || [];
  App.onRender.push((root, r) => {
    /* web push needs a home-screen web app; the app has its own reminders in the panel below */
    if (r.view === 'settings') { const push = $('#acct-push', root); if (push && push.closest('section')) push.closest('section').remove(); }
    if (r.view === 'settings') { const acct = $('#acct-panel', root) || $('.acct-panel', root); const grid = $('.grid.cols-2', root); if (grid && !$('#app-panel', root)) { (acct ? acct : grid.firstElementChild || grid).insertAdjacentHTML(acct ? 'afterend' : 'beforebegin', devicePanel()); wireDevicePanel($('#app-panel', root)); } }
    lastRoute = r; document.body.classList.remove('ap-open'); paintAppBar(r); paintTabs(r); const p = $('.ab-pop'); if (p) p.remove(); const sh = $('#class-sheet'); if (sh) sh.remove();
    if (r.course && r.view === 'dashboard' && local.has(r.course) && !$('.mk-strip', root)) root.insertAdjacentHTML('afterbegin', `<p class="mk-strip small">${icon('file', 13)} A class you created from your syllabus, saved on this ${DEVICE}. <a href="#/create">Manage it</a></p>`);
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => Reminders.sync(), 1500));
})(window);
