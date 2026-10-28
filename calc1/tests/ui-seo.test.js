const T = require('./lib');
(async () => {
  const { browser, base, errors, mk, txt, login, api, hscroll, go, log, check } = await T.start({});

  const [c, p] = await mk(); await go(p, '#/'); await login(p, 'alice.a@montana.edu'); await p.reload(); await p.waitForTimeout(1500); if (await p.$('.celebrate')) await p.keyboard.press('Escape');
  await p.evaluate(() => { const s = App.settings(); delete s.lastVisit; s.courses = ['calc', 'physics', 'precalc', 'writ', 'csci']; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  await go(p, '#/'); await p.waitForTimeout(400); log('landing: stat strip (guests only):', !!(await p.$('.stat-strip')), '| resume card (none yet):', !(await p.$('.resume-card')), '| no tab bar:', !(await p.$('#tabbar')));
  await go(p, '#/calc/notes/1.3'); await p.waitForTimeout(600); log('breadcrumb:', await txt(p, '#topbar-title'), '| crumb link:', await p.$eval('#topbar-title .crumb', e => e.getAttribute('href')), '| lastVisit:', JSON.stringify(await p.evaluate(() => { const l = App.settings().lastVisit; return { hash: l.hash, label: l.label, detail: l.detail }; })));
  log('switcher dots:', await p.$$eval('.switch-btn', b => b.map(x => x.dataset.c || 'home').join(',')));
  // "Pick up where you left off" is a widget a student adds to their home (it is not in the first layout)
  const homeBefore = await p.evaluate(() => App.settings().homeLayout || null);
  await p.evaluate(() => { const s = App.settings(); s.lastVisit.t = Date.now() - 3600000; const L = App.dash.layout(); if (!L.items.some(i => i.id === 'resume')) L.items.unshift({ id: 'resume', x: 0, y: 0, w: 6, h: 4, z: 99 }); s.homeLayout = { v: 1, items: L.items, note: L.note || '' }; localStorage.setItem('studyhub-settings', JSON.stringify(s)); });
  await go(p, '#/'); await p.waitForTimeout(500); log('resume card:', await txt(p, '.resume-card'), '| href:', await p.$eval('.resume-card', e => e.getAttribute('href')));
  await p.click('.resume-card'); await p.waitForTimeout(500); log('resume goes to notes:', await txt(p, '.note-title'));
  await p.evaluate(h => App.setSetting('homeLayout', h), homeBefore);   // her home as it was, for the suites after this one
  await p.keyboard.press('?'); await p.waitForTimeout(200); log('shortcuts modal:', !!(await p.$('#shortcuts-modal')), '| rows:', (await p.$$('.shortcut')).length); await p.keyboard.press('Escape'); await p.waitForTimeout(150); log('closed:', !(await p.$('#shortcuts-modal')));
  await p.focus('#topbar-title'); await p.evaluate(() => window.scrollTo(0, 1200)); await p.waitForTimeout(400); log('back-to-top shown after scroll:', await p.$eval('#totop', e => e.classList.contains('show')));
  await go(p, '#/writ/readings'); await p.waitForTimeout(400); log('writ breadcrumb:', await txt(p, '#topbar-title'));
  await c.close();

  // mobile: no tab bar on the website (the menu and the header carry it); the footer is never under a bar
  const [cm, m] = await mk(390, 760); await m.goto(base + '#/'); await m.waitForTimeout(700); await m.evaluate(() => { const s = App.settings(); s.courses = ['calc', 'writ', 'csci']; localStorage.setItem('studyhub-settings', JSON.stringify(s)); }); await m.reload(); await m.waitForTimeout(900);
  log('mobile landing: no tab bar:', !(await m.$('#tabbar')), '| no hscroll:', await hscroll(m));
  const geo = await m.evaluate(() => { const b = document.querySelector('#ambient .amb-bubble'); return { bubbleHidden: !b || getComputedStyle(b).display === 'none', vh: innerHeight }; }); log('no floating bubble over the page until something plays:', geo.bubbleHidden, JSON.stringify(geo));
  for (const h of ['#/calc', '#/csci', '#/writ']) { await m.goto(base + h); await m.waitForTimeout(600); log(h, 'no tab bar:', !(await m.$('#tabbar')), '| no hscroll:', await hscroll(m)); }
  await m.goto(base + '#/calc/lesson?n=3'); await m.waitForTimeout(700); log('lesson foot present:', !!(await m.$('.lesson-foot')));
  log('mobile footer ends above the lesson bar:', await m.evaluate(() => { const f = document.querySelector('.sf-base'), lf = document.querySelector('.lesson-foot'); if (!f || !lf) return 'missing'; window.scrollTo(0, 1e6); return f.getBoundingClientRect().bottom <= lf.getBoundingClientRect().top + 1; }));
  await cm.close();

  // static SEO pages
  const [cs, s] = await mk(); await s.goto('http://127.0.0.1:8766/learn/'); await s.waitForTimeout(400); log('hub:', await txt(s, 'h1'), '| cards:', (await s.$$('.s-card')).length, '| css loaded:', await s.$eval('.s-head', e => getComputedStyle(e).position === 'sticky'));
  await s.goto('http://127.0.0.1:8766/learn/calc/'); await s.waitForTimeout(300); log('calc page:', await txt(s, 'h1'), '| topics:', (await s.$$('.s-topics a')).length, '| exam rows:', (await s.$$('table tbody tr')).length, '| ld json valid:', await s.$$eval('script[type="application/ld+json"]', e => e.every(x => { try { JSON.parse(x.textContent); return true; } catch { return false; } })));
  const first = await s.$eval('.s-topics a', a => a.getAttribute('href')); await s.goto('http://127.0.0.1:8766' + first); await s.waitForTimeout(300); log('topic page:', await txt(s, 'h1'), '| sections:', (await s.$$('main section')).length, '| details:', !!(await s.$('details')), '| cta links:', await s.$$eval('.s-cta a', a => a.map(x => x.getAttribute('href')).join(' ')), '| prev/next:', (await s.$$('.s-prevnext a')).length, '| canonical:', await s.$eval('link[rel=canonical]', e => e.href));
  await s.goto('http://127.0.0.1:8766/learn/csci/1-3-functions.html'); await s.waitForTimeout(300); log('csci topic code blocks:', (await s.$$('.s-code')).length, '| title:', await s.title(), '| desc len:', await s.$eval('meta[name=description]', e => e.content.length));
  await s.goto('http://127.0.0.1:8766/learn/writ/'); await s.waitForTimeout(300); log('writ page topics:', (await s.$$('.s-topics a')).length, '| no reading text leaked:', !(await txt(s, 'body')).includes('Idlewild'));
  const sm = await s.evaluate(async () => { const r = await fetch('/sitemap.xml'); const t = await r.text(); return { status: r.status, urls: (t.match(/<loc>/g) || []).length, first: (t.match(/<loc>([^<]+)/) || [])[1] }; }); log('sitemap:', JSON.stringify(sm)); log('robots:', await s.evaluate(async () => (await (await fetch('/robots.txt')).text()).replace(/\n/g, ' | ')));
  log('index head:', await s.evaluate(async () => { const t = await (await fetch('/index.html')).text(); return ['rel="canonical"', 'og:image', 'application/ld+json', '<noscript>', 'href="learn/"'].map(k => k + ':' + t.includes(k)).join(' '); }));
  await s.goto('http://127.0.0.1:8766/learn/physics/'); await s.waitForTimeout(300); log('mobile-ish check skipped; physics topics:', (await s.$$('.s-topics a')).length, '| accent class:', await s.$eval('body', e => e.className));
  await cs.close();
  const [cm2, m2] = await mk(390, 760); await m2.goto('http://127.0.0.1:8766/learn/calc/1-3-the-derivative-of-a-function-at-a-point.html'); await m2.waitForTimeout(300); log('static topic mobile no hscroll:', await hscroll(m2)); await cm2.close();
  await T.finish();
})();
