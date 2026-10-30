/* Quick to answer (Interaction to Next Paint on the study pages):
   - practice: an answer repaints its own question and the score bar, not the whole set and its maths
   - the floating Bo's "missed one?" tip decides from a glance at the page's classes (bo-float.js glance()), with no
     measuring; bo-float-web.test.js checks the tip itself
   - confetti still flies and cleans up after itself (one transform per piece, fewer pieces on a small screen)
   - the "+XP" float is placed under the goal ring */
const T = require('./lib');
(async () => {
  const { mk, go, login, check } = await T.start({});
  const [c, p] = await mk(390, 844, { serviceWorkers: 'block', hasTouch: true });
  await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(p, '#/', 600); await login(p, 'alice.a@montana.edu'); await p.reload(); await p.waitForTimeout(2000);
  await p.evaluate(() => { location.hash = '#/calc/practice'; }); await p.waitForTimeout(2500);
  const start = await p.$('[data-action="start"]:visible') || await p.$('[data-action="new-set"]'); await start.click(); await p.waitForTimeout(800);
  const before = await p.evaluate(() => { const cards = [...document.querySelectorAll('#pq-session .q-card')]; window.__second = cards[1]; window.__bar = document.querySelector('#pq-session > .panel'); return { n: cards.length, mc: !!cards[0].querySelector('[data-action="mc"]') }; });
  // answer the first multiple-choice question (or the first number one with a wrong value)
  // the question watched for not being rebuilt is one other than the answered one (the questions are drawn at random, so the first multiple-choice one may be the second)
  const first = await p.evaluate(() => { const cards = [...document.querySelectorAll('#pq-session .q-card')]; const card = cards.find(c => c.querySelector('[data-action="mc"]')); if (card) window.__second = cards.find(c => c !== card); return card ? card.id : null; });
  check('a practice set has questions to answer', before.n >= 5 && !!first, before);
  await p.click(`#${first} [data-action="mc"] >> nth=0`); await p.waitForTimeout(400);
  const after = await p.evaluate(id => { const card = document.getElementById(id); const cards = [...document.querySelectorAll('#pq-session .q-card')]; return { graded: /correct|wrong/.test(card.className), feedback: !!card.querySelector('.q-feedback'), sameOther: cards.includes(window.__second) && window.__second.isConnected, sameBar: window.__bar.isConnected, bar: document.querySelector('#pq-session .score-bar').textContent.replace(/\s+/g, ' '), fill: document.querySelector('#pq-session .score-bar .bar-fill').style.width, n: cards.length }; }, first);
  check('the answered question shows its result and explanation', after.graded && after.feedback, after);
  check('the other questions are left as they were (not rebuilt), and the set is the same size', after.sameOther && after.n === before.n, after);
  check('the score bar counts the answer', /\/1\s*correct so far/.test(after.bar) && parseFloat(after.fill) > 0, after);

  // confetti: flies, then removes its canvas
  const conf = await p.evaluate(async () => { App.confetti({ count: 120 }); const on = !!document.querySelector('canvas.confetti'); await new Promise(r => setTimeout(r, 4500)); return { on, gone: !document.querySelector('canvas.confetti') }; });
  check('confetti flies and then cleans up after itself', conf.on && conf.gone, conf);
  // the +XP float: under the goal ring when there is one
  const fl = await p.evaluate(async () => { App.addXP(1); await new Promise(r => setTimeout(r, 250)); const f = document.querySelector('.xp-float'); const ring = [...document.querySelectorAll('.goal-ring')].find(e => e.offsetParent !== null); return { f: !!f, ok: !f || !ring || Math.abs(parseFloat(f.style.top) - (ring.getBoundingClientRect().bottom + 4)) < 2 }; });
  check('the +XP float appears where it should', fl.f && fl.ok, fl);
  await c.close();
  await T.finish();
})();
