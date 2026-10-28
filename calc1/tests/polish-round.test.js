/* What the usage report pointed at (2026.10.28.5):
   - the start page for someone with no classes yet: the hero's button is Pick your classes and goes to the picker,
     and neither the tour nor Bo's first tip covers the page before they have picked
   - the Quizzer on a phone: the presets in one sideways row, so the first question shows on the first screen
   - Tools → Ask Bo about this: what the student typed and what the tool shows go to Bo
   - Today: this week's topic in each class, ticked off once its lesson was read to the end */
const T = require('./lib');
(async () => {
  const { mk, go, login, check, log } = await T.start({ tour: true });
  const BOB = 'bob.bmu6j92pq@montana.edu';

  // a first visit on a phone, no classes picked
  { const [c, p] = await mk(390, 844, { isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await go(p, '#/', 4500);
    const s = await p.evaluate(() => ({ btn: (document.querySelector('.hero-actions .btn.primary') || {}).textContent, over: [...document.querySelectorAll('.tour, .bf-tip:not([hidden])')].length }));
    check('no classes yet: the hero’s button is Pick your classes, with no tour or tip over the page', /Pick your classes/.test(s.btn || '') && s.over === 0, s);
    await p.tap('[data-action="go-pick"]'); await p.waitForTimeout(900);
    const top = await p.evaluate(() => Math.round(document.querySelector('#pick-classes').getBoundingClientRect().top));
    check('it scrolls to the picker, just under the top bar, and the first class has focus', top >= 56 && top <= 120 && await p.evaluate(() => document.activeElement && document.activeElement.closest('.pk-c') !== null), top);
    await p.tap('.pk-c'); await p.tap('#pk-save'); await p.waitForTimeout(600);
    check('after picking, the picker is gone', !(await p.$('#pick-classes')));
    await c.close(); }

  // the Quizzer on a phone (wider than 391px, not innerWidth: a phone lays a too-wide page out wider)
  { const [c, p] = await mk(390, 844, { isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); Object.assign(s, { courses: ['calc'], boFloatSeen: 1, tourLayout: 99 }); localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
    await go(p, '#/calc/practice', 2500);
    const q = await p.evaluate(() => { const row = document.querySelector('[data-action="smart"]').parentElement; const sub = document.querySelector('#pq-setup .panel-h p'); const panel = sub && sub.closest('.panel'); const first = document.querySelector('#pq-session .q-num'); return { wrap: getComputedStyle(row).flexWrap, firstTop: first ? Math.round(first.getBoundingClientRect().top) : null, subInside: sub && panel ? sub.getBoundingClientRect().right <= panel.getBoundingClientRect().right + 1 : true, hs: document.documentElement.scrollWidth <= 391 }; });
    check('phone Quizzer: presets in one row, the current set inside its panel, nothing scrolls sideways', q.wrap === 'nowrap' && q.subInside && q.hs, q);
    check('and the first question starts on the first screen', q.firstTop !== null && q.firstTop < 844, q.firstTop);
    await c.close(); }

  // Ask Bo about a tool's result
  { const [c, p] = await mk(1280, 860, { serviceWorkers: 'block' });
    await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); Object.assign(s, { courses: ['biob'], boFloatSeen: 1, tourLayout: 99 }); localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
    await go(p, '#/biob/toolkit?t=punnett', 2200); await p.fill('#ctp-1', 'Aa'); await p.fill('#ctp-2', 'Aa'); await p.waitForTimeout(400);
    await p.click('[data-action="ct-ask"]'); await p.waitForTimeout(700);
    const h = decodeURIComponent(new URL(p.url()).hash); log(h.slice(0, 260));
    check('Ask Bo about this sends what was entered and the result, laid out in lines', /^#\/tutor\/biob\?q=/.test(h) && /Punnett square/.test(h) && /Parent 1 Aa; Parent 2 Aa/.test(h) && /AA: 1\/4 \(25%\); Aa: 2\/4 \(50%\)/.test(h) && /by hand/.test(h), h.slice(0, 300));
    await c.close(); }

  // Today: this week's topics
  { const [c, p] = await mk(1280, 860, { serviceWorkers: 'block' });
    await go(p, '#/', 800); await login(p, BOB); await p.reload(); await p.waitForTimeout(1500);
    const keep = await p.evaluate(() => App.settings().courses);
    await p.evaluate(async () => { App.setSetting('courses', ['calc', 'writ']); try { await App.auth.savePrefs({ courses: ['calc', 'writ'] }); } catch (e) {} });
    await p.evaluate(() => { for (const id of ['calc', 'writ']) { const k = Object.keys(localStorage).find(x => x.endsWith(id) && /study/.test(x)); if (k) { const d = JSON.parse(localStorage.getItem(k) || '{}'); delete d.lessonsRead; localStorage.setItem(k, JSON.stringify(d)); } } });
    const item = () => p.evaluate(() => { const it = [...document.querySelectorAll('.td-item')].find(x => /topic/.test(x.textContent)); return it ? { done: it.classList.contains('done'), text: it.textContent.replace(/\s+/g, ' ').trim(), href: it.querySelector('a') ? it.querySelector('a').getAttribute('href') : '' } : null; });
    await go(p, '#/today', 2200); const a = await item();
    check('Today lists this week’s topic in each class, with a Read button', a && !a.done && /0 of [2-9] done/.test(a.text) && /Calc I/.test(a.text) && /Writing/.test(a.text) && /^#\/calc\/notes\//.test(a.href), a);
    await go(p, a.href.replace(/^#/, '#'), 2400); await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(900);
    await go(p, '#/today', 2000); const b2 = await item();
    check('reading the lesson to its end ticks it off, and Read moves to the next class', b2 && /1 of [2-9] done/.test(b2.text) && /✓ Calc I/.test(b2.text) && /^#\/writ\/notes\//.test(b2.href), b2);
    await p.evaluate(async k => { App.setSetting('courses', k); try { await App.auth.savePrefs({ courses: k }); } catch (e) {} }, keep || []);
    await c.close(); }
  await T.finish();
})();
