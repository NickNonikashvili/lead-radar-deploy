/* A lighter first visit (and a lighter visit after every release):
   - the admin panel, What's new and the terms load the first time one opens (App.lazyView), not with every page
   - the service worker saves what index.html loads, not every class: a class's files are saved when it is used, and
     the student's own classes in the background (App.warmClasses)
   - the list of classes comes back as "same" when this device already has it (classpack_list with its tag)
   - the planner and personal pages (tasks, habits, goals, journal, money …), the notebook, peer review, the study room,
     GPA, the class tools and drafts load the first time one opens too (App.LAZY_PAGES): their names and one-line
     descriptions are known before, so menus and search show them the same
   - after Bo's first moves nothing animates without end: the page rests, and Bo still blinks now and then */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
(async () => {
  const { mk, go, check, log, api } = await T.start({});
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const LAZY = ['admin.js', 'admin-ops.js', 'changelog.js', 'policy.js'];
  check('index.html does not load the admin panel, What’s new or the terms', LAZY.every(f => !html.includes('assets/' + f)), LAZY.filter(f => html.includes('assets/' + f)));
  const PAGES = ['life-school.js', 'life-self.js', 'notebook.js', 'peer.js', 'room.js', 'gpa.js', 'class-tools.js', 'drafts.js'];
  check('nor the planner, personal, notebook, peer review, study room, GPA, class tools or drafts pages', PAGES.every(f => !html.includes('assets/' + f + '?')), PAGES.filter(f => html.includes('assets/' + f + '?')));

  const [c, p] = await mk(390, 844, { isMobile: true });
  await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); if (!s.courses) { s.courses = ['calc']; s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } } catch (e) {} });
  const got = new Set(); p.on('request', r => { const m = /assets\/([a-z0-9/-]+\.js)/.exec(r.url()); if (m) got.add(m[1]); });
  await go(p, '#/', 2500);
  check('the start page fetches none of them', LAZY.every(f => !got.has(f)) && PAGES.every(f => !got.has(f)), [...got].filter(f => LAZY.includes(f) || PAGES.includes(f)));
  // what menus and search know before a page's file arrives is what the page itself says once it has
  const names = await p.evaluate(async () => { const before = App.LAZY_PAGES.map(([n]) => [n, App.views[n].title, App.views[n].blurb || '', !!App.views[n].lazy]); await App.need([...new Set(App.LAZY_PAGES.map(x => x[1]))]); return before.map(([n, t, b, lazy]) => ({ n, lazy, same: t === App.views[n].title && b === (App.views[n].blurb || ''), now: [App.views[n].title, App.views[n].blurb || ''], t, b })); });
  check('every lazy page has its real name and description before its file loads', names.length >= 18 && names.every(x => x.lazy && x.same), names.filter(x => !x.lazy || !x.same));
  await go(p, '#/', 300); await p.evaluate(() => { location.hash = '#/habits'; }); await p.waitForTimeout(1500);
  check('#/habits opens and shows the page', await p.evaluate(() => !App.current.lazy && /habit/i.test(document.querySelector('#view').textContent)));
  for (const [h, f, word] of [['#/policy', 'policy.js', 'Terms'], ['#/whatsnew', 'changelog.js', 'new']]) {
    await go(p, h, 1800);
    const r = await p.evaluate(() => ({ lazy: !!(App.current && App.current.lazy), text: document.querySelector('#view').textContent }));
    check(`${h} loads ${f} when it opens and shows the page`, got.has(f) && !r.lazy && r.text.includes(word), { got: got.has(f), lazy: r.lazy });
  }
  check('opening What’s new clears the account menu’s dot', await p.evaluate(() => !App.changelogUnseen()));

  // what the service worker saved: this build's page files, no class it was not asked for
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  const cache1 = await p.evaluate(async () => { const out = []; for (const k of await caches.keys()) { const cc = await caches.open(k); (await cc.keys()).forEach(q => out.push(new URL(q.url).pathname.replace(/^\//, ''))); } return out; });
  log('saved by the service worker:', cache1.length, 'files');
  check('the service worker saved the page’s own files', cache1.includes('assets/app.js') && cache1.includes('assets/styles.css') && cache1.includes('build-check.js'), cache1.length);
  check('and not every class, nor the pages that load when opened', !cache1.includes('assets/physics-data.js') && !cache1.includes('assets/admin.js') && cache1.length < 115, cache1.filter(f => /physics-data|admin\.js/.test(f)));
  // the worker files each copy a moment after the fetch returns: wait for them
  const warm = await p.evaluate(async () => { localStorage.removeItem('mathub-warm'); await App.warmClasses(); const list = async () => { const out = []; for (const k of await caches.keys()) { const cc = await caches.open(k); (await cc.keys()).forEach(q => out.push(new URL(q.url).pathname.replace(/^\//, ''))); } return out; }; let out = await list(); for (let i = 0; i < 25 && !(out.includes('assets/calc-data.js') && out.includes('assets/lessons/calc.js')); i++) { await new Promise(r => setTimeout(r, 200)); out = await list(); } return { files: out, done: JSON.parse(localStorage.getItem('mathub-warm') || 'null') }; });
  check('the student’s own class is saved in the background, its lessons too', warm.files.includes('assets/calc-data.js') && warm.files.includes('assets/lessons/calc.js') && warm.done && warm.done.ids.includes('calc'), warm.done);
  check('and only that class', !warm.files.includes('assets/physics-data.js'));
  check('the pages that load when opened are saved in the background too, so they open offline', PAGES.every(f => warm.files.includes('assets/' + f)) && warm.done.pages === 1, PAGES.filter(f => !warm.files.includes('assets/' + f)));
  await c.close();

  // after Bo's first moves the page rests: no endless animation, so no restyle or repaint while the student reads
  for (const [w, h] of [[390, '#/calc'], [1360, '#/']]) {
    const [c3, r] = await mk(w, 850, { serviceWorkers: 'block' });
    await c3.addInitScript(() => { try { localStorage.setItem('studyhub-settings', JSON.stringify({ courses: ['calc'], boFloatSeen: 1, tourLayout: 99, tourDone: true, geek: false })); } catch (e) {} });
    await go(r, h, 10500);
    const rest = await r.evaluate(async () => { const endless = document.getAnimations().filter(a => a.playState === 'running' && a.effect.getTiming().iterations === Infinity && !(a.effect.pseudoElement)).map(a => a.animationName); let blinked = false; const mo = new MutationObserver(() => { if (document.querySelector('.bob-lids.blink, .px-bo.blink')) blinked = true; }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); await new Promise(ok => setTimeout(ok, 8200)); mo.disconnect(); return { endless, bo: document.querySelectorAll('.bob-lids, .px-bo.px-anim').length, blinked }; });
    check(`${h} (${w}px): nothing animates without end once Bo has settled, and Bo still blinks now and then`, rest.endless.length === 0 && rest.bo > 0 && rest.blinked, rest);
    await c3.close();
  }

  // the list of classes: the full list once, then "same"
  const [c2, q] = await mk(1200, 800, { serviceWorkers: 'block' }); await go(q, '#/', 1500);
  const first = (await api(q, 'classpack_list')).json || {}; const again = (await api(q, 'classpack_list&tag=' + encodeURIComponent(first.tag || ''))).json || {};
  check('the list of classes carries a tag, and the same tag gets "same" back without the list', !!first.tag && Array.isArray(first.packs) && again.same === true && !again.packs, { tag: first.tag, again });
  const other = (await api(q, 'classpack_list&tag=nottheone')).json || {};
  check('an old tag gets the whole list', Array.isArray(other.packs) && !other.same);
  await c2.close();
  await T.finish();
})();
