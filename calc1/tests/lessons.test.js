/* Section notes are lessons (revamp, October 2026).
   - Every topic of the 13 Montana State classes has a lesson (assets/lessons/<id>.js, laid over the notes when the
     class loads): the idea in plain words, a picture, worked examples and a self-check. Every picture draws.
   - A topic's page reads in that order: The idea, the picture (its caption once), Key points, Worked examples (the
     notes' own and the lesson's extra ones), Common mistakes, Check yourself (answers hidden until asked).
   - Visitors see the idea of a locked topic above the sign-up card.
   - On a phone the lesson comes first and nothing scrolls sideways, even with a wide table or code.
   (A student's own class gets the same format from Bo: maker.test.js.) */
const T = require('./lib'); const fs = require('fs'); const path = require('path'); const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const IDS = ['calc', 'physics', 'precalc', 'writ', 'csci', 'biob', 'kin', 'psyx', 'emec100', 'jpns150d', 'm170', 'm172', 'psci230d'];
(async () => {
  const { mk, go, login, check, hscroll } = await T.start();

  /* ---------- the files ---------- */
  const box = { window: {} }; vm.createContext(box);
  const bad = [];
  IDS.forEach(id => { const f = path.join(ROOT, 'assets', 'lessons', id + '.js'); if (!fs.existsSync(f)) return bad.push(id + ': no file'); try { vm.runInContext(fs.readFileSync(f, 'utf8'), box); } catch (e) { bad.push(id + ': ' + e.message); } });
  check('every class has a lesson file that loads', bad.length === 0, bad);
  const L = box.window.MathubLessons || {};
  const thin = []; IDS.forEach(id => Object.entries(L[id] || {}).forEach(([s, x]) => { if (!x.plain || x.plain.length < 120 || !Array.isArray(x.check) || x.check.length < 2) thin.push(id + ' ' + s); }));
  check('and every lesson has the idea in a few sentences and at least two self-check questions', thin.length === 0, thin);
  const app = fs.readFileSync(path.join(ROOT, 'assets', 'app.js'), 'utf8');
  check('a class kept offline keeps its lessons with it (App.warmClasses saves them with the class)', /App\.warmClasses = [\s\S]{0,900}LESSON_IDS\.has\(id\) \? \['lessons\/' \+ id \+ '\.js'\]/.test(app));

  /* ---------- every topic of every class, in the page ---------- */
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' });
  await go(p, '#/', 900); await login(p, 'alice.a@montana.edu'); await p.reload(); await p.waitForTimeout(1200);
  const all = await p.evaluate(async ids => {
    const out = { missing: [], figs: 0, broken: [], topics: 0 };
    for (const id of ids) {
      const F = await App.loadCourse(id);
      F.SECTIONS.forEach(s => {
        out.topics++;
        const qs = (s.check || []).length;
        if (!s.plain || qs < 2) out.missing.push(id + ' ' + s.id);
        if (s.figure) { out.figs++; try { const sp = App.boDraw.parse(s.figure); const d = document.createElement('div'); d.innerHTML = sp ? App.boDraw.html(sp, false) : ''; if (!sp || d.querySelectorAll('path,circle,line,rect,polygon,td,th,text').length < 3) out.broken.push(id + ' ' + s.id); } catch (e) { out.broken.push(id + ' ' + s.id + ' ' + e.message); } }
      });
    }
    return out;
  }, IDS);
  check(`all ${all.topics} topics of the 13 classes carry a lesson`, all.topics > 240 && all.missing.length === 0, all.missing);
  check(`and all ${all.figs} pictures draw`, all.figs > 200 && all.broken.length === 0, all.broken);

  /* ---------- one topic's page ---------- */
  await go(p, '#/calc/notes/1.1', 2000);
  const pg = await p.evaluate(() => {
    const art = document.querySelector('article.is-lesson'); const order = [...art.querySelectorAll(':scope > section, :scope > .note-block')].map(e => e.id || e.className);
    const cap = 'The secant line from t = 0.5 to t = 1 has slope 8 ft/s';
    return { order, toc: [...art.querySelectorAll('.lesson-toc a')].map(a => a.textContent.trim()), svg: !!art.querySelector('.lesson-fig svg'), caps: [...art.querySelectorAll('.lesson-fig figcaption, .lesson-fig .bd-cap')].filter(e => e.textContent.includes(cap)).length,   // (the drawing's description for screen readers repeats it, unseen)
 examples: art.querySelectorAll('.lesson-ex').length, qs: art.querySelectorAll('.lesson-qs > li').length, hidden: [...art.querySelectorAll('.lesson-qs [id^="ans-"]')].every(a => !a.classList.contains('open')) };
  });
  check('a topic opens with the idea, then the picture, then the key points', pg.order.indexOf('ls-idea') === 0 && pg.order.indexOf('ls-picture') === 1 && pg.order.indexOf('ls-points') === 2, pg.order);
  check('with a contents row that jumps to each part', ['The idea', 'Picture', 'Key points', 'Check yourself'].every(t => pg.toc.includes(t)), pg.toc);
  check('the picture draws, with its caption once', pg.svg && pg.caps === 1, pg.caps);
  check('the notes\' worked example and the lesson\'s extra one', pg.examples === 2, pg.examples);
  check('and a self-check with the answers hidden', pg.qs === 3 && pg.hidden, pg);
  await p.click('.lesson-qs > li:first-child [data-action="answer"]'); await p.waitForTimeout(250);
  check('one tap shows an answer', await p.evaluate(() => document.querySelector('.lesson-qs > li:first-child [id^="ans-"]').classList.contains('open')));
  await go(p, '#/writ/notes/w5', 1500);
  check('a writing class\'s weeks are lessons too, with a worked example of their own', await p.evaluate(() => !!document.querySelector('.lesson-idea') && document.querySelectorAll('.lesson-ex').length >= 1 && document.querySelectorAll('.lesson-qs > li').length === 3));

  /* ---------- a visitor ---------- */
  const [cv, v] = await mk(1360, 900, { serviceWorkers: 'block' });
  await go(v, '#/calc/notes/2.7', 2500);
  const lock = await v.evaluate(() => ({ idea: (document.querySelector('.lesson-plain') || {}).textContent || '', lock: !!document.querySelector('.lock-card, [class*="lock"]'), qs: document.querySelectorAll('.lesson-qs > li').length }));
  check('a visitor sees the idea of a locked topic above the sign-up card, not the whole lesson', /differentiate both sides/.test(lock.idea) && lock.lock && lock.qs === 0, lock);
  await cv.close();

  /* ---------- phones ---------- */
  const [cm, m] = await mk(390, 844, { serviceWorkers: 'block' });
  await go(m, '#/', 900); await login(m, 'alice.a@montana.edu'); await m.reload(); await m.waitForTimeout(1200);
  for (const h of ['#/csci/notes/types', '#/physics/notes/vectors', '#/m172/notes/euler', '#/psci230d/notes/igos']) { await go(m, h, 2200); check(`no sideways scroll on ${h} at 390px`, await hscroll(m)); }
  check('on a phone the lesson comes before the list of topics', await m.evaluate(() => document.querySelector('article.is-lesson').getBoundingClientRect().top < document.querySelector('.sec-nav').getBoundingClientRect().top));
  await cm.close(); await c.close();
  await T.finish();
})();
