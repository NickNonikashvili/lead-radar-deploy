/* The first-visit start page and the study guides in motion (motion-web-design: assets/start.js, assets/start.css,
   assets/learn-motion.js, the end of assets/seo.css):
   - a newcomer (not signed in, no class) gets the story: the Big Sky hero, real numbers, three steps, the class picker,
     what is inside, questions and a last call; a signed-in student or one with classes gets their home
   - wide screens: GSAP + ScrollTrigger reveal every part on the way down, count the numbers, draw the trail and ease the
     questions open; phones get the light IntersectionObserver version and never load GSAP
   - nothing on screen at load is hidden, nothing jumps (CLS under 0.1), and a part reached by Tab shows at once
   - with Reduce motion nothing is hidden or animated
   - the study guides: parts below the fold lift in, the class cards count, a topic page has a reading line */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const AXE = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
(async () => {
  const { mk, go, base, login, check, log } = await T.start({ freeHome: true });
  const root = base.replace(/index\.html$/, '');
  const clsWatch = c => c.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {} });
  const scrollAll = async (p, w) => { await p.mouse.move(Math.round(w * 0.6), 400); const H = await p.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y < H; y += 450) { await p.mouse.wheel(0, 450); await p.waitForTimeout(180); } await p.waitForTimeout(1500); };
  const hiddenParts = p => p.evaluate(() => [...document.querySelectorAll('[data-mo]')].filter(e => +getComputedStyle(e).opacity < 0.99).map(e => e.className + ' @' + Math.round(e.getBoundingClientRect().top) + ' op ' + getComputedStyle(e).opacity));

  // a newcomer on a wide screen
  const [c, p] = await mk(1440, 900, { serviceWorkers: 'block' }); await clsWatch(c);
  await go(p, '#/', 2500);
  const s = await p.evaluate(() => { const n = App.startPitch.numbers(); return { story: !!document.querySelector('.mo-page'), h1: document.querySelector('.mo-hero h1').textContent, sections: [...document.querySelectorAll('.mo-page [data-section]')].map(x => x.dataset.section), picker: !!document.querySelector('.mo-page #pick-classes'), nums: [...document.querySelectorAll('.mo-num')].map(x => +x.dataset.count), n, cards: document.querySelectorAll('.gl-card').length, tabs: document.querySelectorAll('.gl-tabs [role="tab"]').length, head: !!document.querySelector('#topbar .gl-head') && getComputedStyle(document.querySelector('.sidebar')).display === 'none', faq: document.querySelectorAll('.mo-faq details').length, widgets: document.querySelectorAll('#dash-canvas').length, hero: document.querySelector('.hero-actions .btn.primary').textContent.trim(), onScreenHidden: [...document.querySelectorAll('[data-mo]')].filter(e => e.getBoundingClientRect().top < innerHeight && +getComputedStyle(e).opacity < 0.99).length }; });
  log(JSON.stringify(s));
  check('a newcomer gets the landing: its own header (no sidebar), hero, numbers, three steps in tabs with the picker, practice, Bo, professors, questions and a last call', s.story && s.head && /Every class you take,\s*made simple\./.test(s.h1) && s.sections.join() === 'hero,stats,how,practice,bo,prof,faq,final' && s.picker && s.tabs === 3 && s.cards === 3 && s.faq === 6 && s.widgets === 0 && /Pick your classes/.test(s.hero), s);
  check('the numbers are real: the classes on offer, their topics and flashcards, the languages', s.nums.join() === [s.n.classes, s.n.topics, s.n.cards, s.n.langs].join() && s.n.classes >= 8 && s.n.topics > 100 && s.n.langs === 7, s.nums);
  check('nothing on screen at load is hidden', s.onScreenHidden === 0, s.onScreenHidden);
  await scrollAll(p, 1440);
  const d = await p.evaluate(() => ({ gsap: !!window.gsap, hidden: [...document.querySelectorAll('[data-mo]')].filter(e => +getComputedStyle(e).opacity < 0.99).length, counted: [...document.querySelectorAll('.mo-num')].every(x => x.textContent.replace(/\D/g, '') === x.dataset.count), cls: +window.__cls.toFixed(3), wide: document.documentElement.scrollWidth <= innerWidth + 1 }));
  check('wide screen: GSAP reveals every part on the way down and the numbers reach their value', d.gsap && d.hidden === 0 && d.counted, d);
  check('and nothing jumps or scrolls sideways', d.cls < 0.1 && d.wide, d);
  await p.click('.mo-faq summary >> nth=1'); await p.waitForTimeout(130);
  const mid = await p.evaluate(() => { const x = document.querySelectorAll('.mo-faq details')[1]; return { open: x.open, h: x.querySelector('.mo-a').getBoundingClientRect().height, full: x.querySelector('.mo-a p').getBoundingClientRect().height }; });
  await p.waitForTimeout(600);
  const end = await p.evaluate(() => { const x = document.querySelectorAll('.mo-faq details')[1]; return { open: x.open, h: x.querySelector('.mo-a').getBoundingClientRect().height }; });
  check('a question eases open (part way after a moment, all the way after)', mid.open && mid.h > 0 && mid.h < mid.full + 18 && end.h >= mid.h, { mid, end });
  await p.click('[data-action="mo-signup"]'); await p.waitForTimeout(500);
  check('Sign up free opens sign-up', !!(await p.$('#auth-modal #au-pass[autocomplete="new-password"]')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // after picking a class: their home, and the page's scroll triggers are gone
  await p.evaluate(() => scrollTo(0, 0)); await p.click('.hero-actions [data-action="go-pick"]'); await p.waitForTimeout(1200);
  await p.click('#pick-classes .pk-c'); await p.click('#pk-save'); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ story: !!document.querySelector('.mo-page'), home: !!document.querySelector('#dash-canvas'), triggers: window.ScrollTrigger ? ScrollTrigger.getAll().filter(t => t.trigger && t.trigger.closest && t.trigger.closest('.mo-page')).length : 0 }));
  check('once a class is picked: their home, and none of the story\'s scroll triggers stay behind', !after.story && after.home && after.triggers === 0, after);
  await c.close();

  // a phone: the light version, GSAP never fetched; a part reached by Tab shows at once
  const [c2, m] = await mk(390, 844, { serviceWorkers: 'block', hasTouch: true }); await clsWatch(c2);
  const got = []; m.on('request', r => { if (/vendor\/(gsap|ScrollTrigger)/.test(r.url())) got.push(r.url()); });
  await go(m, '#/', 2500);
  await m.evaluate(() => { const l = [...document.querySelectorAll('#pick-classes input, #pick-classes a, #pick-classes button')].pop(); l.focus(); });
  await m.keyboard.press('Tab'); await m.waitForTimeout(60);
  const tab = await m.evaluate(() => { const a = document.activeElement; let el = a, op = 1; while (el && el !== document.body) { op *= +getComputedStyle(el).opacity; el = el.parentElement; } return { what: a.textContent.trim(), op }; });
  check('phone: a part reached by Tab is fully shown at once', tab.op > 0.99 && /quiz/.test(tab.what), tab);
  await scrollAll(m, 390);
  const ph = await m.evaluate(() => ({ io: document.querySelector('.mo-page').classList.contains('mo-io'), cls: +window.__cls.toFixed(3), wide: document.documentElement.scrollWidth <= 391 }));
  const hid = await hiddenParts(m);
  check('phone: every part shown by the light version, without GSAP, nothing jumps or scrolls sideways', ph.io && hid.length === 0 && got.length === 0 && ph.cls < 0.1 && ph.wide, { ph, got, hid });
  await c2.close();

  // Reduce motion: nothing hidden, nothing animated
  const [c3, r] = await mk(1440, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
  await go(r, '#/', 2000);
  const rm = await r.evaluate(() => ({ cls: document.querySelector('.mo-page').className, hidden: [...document.querySelectorAll('[data-mo]')].filter(e => +getComputedStyle(e).opacity < 0.99).length, anim: getComputedStyle(document.querySelector('.mo-line > span')).animationName }));
  check('Reduce motion: the page is simply there', !/mo-anim|mo-on/.test(rm.cls) && rm.hidden === 0 && rm.anim === 'none', rm);
  await c3.close();

  // axe over the story, by day and by night (motion off, so colours are measured at rest)
  for (const scheme of ['light', 'dark']) {
    const [ca, a] = await mk(1440, 900, { serviceWorkers: 'block', bypassCSP: true, colorScheme: scheme, reducedMotion: 'reduce' });
    await go(a, '#/', 2200); await a.addScriptTag({ content: AXE });
    const v = await a.evaluate(async () => (await axe.run('.mo-page', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ': ' + x.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')));
    check(`axe finds nothing serious on the story (${scheme})`, v.length === 0, v);
    await ca.close();
  }

  // signed in, or with classes: their home, not the story
  const [c4, q] = await mk(1280, 860, { serviceWorkers: 'block' }); await go(q, '#/', 800); await login(q, 'alice.a@montana.edu'); await q.reload(); await q.waitForTimeout(1500);
  const signed = await q.evaluate(() => !!document.querySelector('.mo-page'));
  check('a signed-in student does not get the story', !signed);
  await c4.close();

  // the study guides
  for (const [w, page, what] of [[1440, 'learn/index.html', 'index'], [390, 'learn/calc/1-1-how-do-we-measure-velocity.html', 'topic']]) {
    const [c5, g] = await mk(w, 900, {}); await clsWatch(c5);
    await g.goto(root + page); await g.waitForTimeout(1500);
    const before = await g.evaluate(() => ({ on: document.documentElement.classList.contains('s-mo-on'), seen: [...document.querySelectorAll('.s-wrap > section, .s-card')].filter(e => e.getBoundingClientRect().top < innerHeight && +getComputedStyle(e).opacity < 0.99).length }));
    await scrollAll(g, w);
    const after2 = await g.evaluate(() => ({ hidden: [...document.querySelectorAll('.s-wrap > section, .s-card')].filter(e => +getComputedStyle(e).opacity < 0.99).length, counts: [...document.querySelectorAll('[data-count]')].every(x => x.textContent === x.dataset.count), n: document.querySelectorAll('[data-count]').length, read: document.querySelector('.s-read') ? document.querySelector('.s-read').style.transform : null, head: document.querySelector('.s-head').classList.contains('is-scrolled'), cls: +window.__cls.toFixed(3) }));
    check(`study guide (${what}, ${w}px): nothing on screen hidden, every part shown by the end, the header settles`, before.on && before.seen === 0 && after2.hidden === 0 && after2.head && after2.cls < 0.1, { before, after2 });
    if (what === 'index') check('the class cards\' counts reach their numbers', after2.n >= 8 && after2.counts, after2);
    else check('a topic page has a reading line that is full at the end', after2.read === 'scaleX(1)', after2.read);
    await c5.close();
  }
  await T.finish();
})();
