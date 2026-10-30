/* Moving around (assets/app.js):
   - Back and Forward put you where you were on a page you saw (and a reload keeps your place); a new page starts at the top
   - a button whose action waits on the server is busy at once (a double tap sends it once), shows a spinner only if it
     takes a while, and is free again when the answer comes
   - leaving a class for a page outside the classes, the class page closes into its sidebar link like a Mac window into
     the Dock, and going into a class it opens out of it (assets/genie.js); on a phone, the menu button; any other
     change is plain; nothing moves with Reduce motion */
const T = require('./lib');
(async () => {
  const { mk, go, login, check } = await T.start({});
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
  await go(p, '#/resources', 1200);
  const tall = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await p.evaluate(() => window.scrollTo(0, 1100)); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/calc'; }); await p.waitForTimeout(1800);
  const atNew = await p.evaluate(() => Math.round(scrollY));
  check('a new page starts at the top', tall > 1200 && atNew === 0, { tall, atNew });
  await p.evaluate(() => window.scrollTo(0, 300)); await p.waitForTimeout(250);
  await p.goBack(); await p.waitForTimeout(1200);
  const back = await p.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash }));
  check('Back puts you where you were on the page you left', /^#\/resources/.test(back.hash) && Math.abs(back.y - 1100) <= 4, back);
  await p.goForward(); await p.waitForTimeout(1500);
  const fwd = await p.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash }));
  check('and Forward too', fwd.hash === '#/calc' && Math.abs(fwd.y - 300) <= 4, fwd);
  await p.goBack(); await p.waitForTimeout(1200); await p.evaluate(() => window.scrollTo(0, 800)); await p.waitForTimeout(250);
  await p.reload(); await p.waitForTimeout(2200);
  const rl = await p.evaluate(() => Math.round(scrollY));
  check('a reload keeps your place', Math.abs(rl - 800) <= 4, rl);
  await p.click('a[href="#/"]').catch(() => p.evaluate(() => { location.hash = '#/'; })); await p.waitForTimeout(1200);
  check('a link to another page still starts at its top', await p.evaluate(() => Math.round(scrollY)) === 0);

  // a button that waits on the server
  const b = await p.evaluate(async () => {
    const box = document.createElement('div'); box.id = 'zz-flow'; box.innerHTML = '<button type="button" class="btn" data-action="slow">Save</button><button type="button" class="btn" data-action="quick">Now</button>'; document.querySelector('#view').appendChild(box);
    window.__calls = 0; App.bind(box, { slow: () => { window.__calls++; return new Promise(r => setTimeout(r, 900)); }, quick: () => { window.__calls += 10; } });
    const s = box.querySelector('[data-action="slow"]'); s.click(); s.click();
    const at0 = { busy: s.getAttribute('aria-busy'), spin: s.classList.contains('is-busy') };
    await new Promise(r => setTimeout(r, 500)); const at500 = { busy: s.getAttribute('aria-busy'), spin: s.classList.contains('is-busy') };
    await new Promise(r => setTimeout(r, 600)); const after = { busy: s.getAttribute('aria-busy'), spin: s.classList.contains('is-busy') };
    const q = box.querySelector('[data-action="quick"]'); q.click(); q.click();
    return { calls: window.__calls, at0, at500, after, quickBusy: q.getAttribute('aria-busy'), label: s.textContent };
  });
  check('a double tap on a button that waits sends it once', b.calls === 1 + 20, b);
  check('busy at once, the spinner only after a moment, both gone when the answer comes', b.at0.busy === 'true' && !b.at0.spin && b.at500.spin && b.after.busy === null && !b.after.spin && b.label === 'Save', b);
  check('a button whose action is instant is never marked busy', b.quickBusy === null, b);
  await c.close();

  // in and out of a class (the genie, assets/genie.js): a class page closes into its sidebar link like a Mac window into
  // the Dock when you leave the class, and opens out of it when you go in; everything else is a plain change
  const [c2, q] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'no-preference' });
  await q.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.motion = 'on'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  // signed in (a visitor's home is the start page, with no sidebar); this account keeps Reduce motion on, so it is
  // switched off here and back on at the end (the setting follows the account, and other suites expect it on)
  const signIn = async pg => { await go(pg, '#/', 600); await login(pg, 'alice.a@montana.edu'); await pg.reload(); await pg.waitForTimeout(1200); if (await pg.$('.celebrate')) await pg.keyboard.press('Escape'); await pg.evaluate(() => { App.setSetting('motion', 'on'); if (App.applyMotion) App.applyMotion(); }); };
  await signIn(q); await go(q, '#/calc/path', 1500); await q.evaluate(() => { App.setSetting('motion', 'on'); if (App.applyMotion) App.applyMotion(); });
  const ghostNow = linkSel => q.evaluate(linkSel => {
    const g = document.querySelector('.genie-ghost'), u = document.querySelector('.genie-under'); const views = document.querySelectorAll('#view');
    const b = document.querySelector('.vt-bulge'); const link = linkSel && document.querySelector(linkSel);
    const strips = g ? Array.from(g.querySelectorAll(':scope > .genie-strip')) : [];
    return { ghost: !!g, under: !!u, hidden: g && g.getAttribute('aria-hidden'), inert: g && g.inert, strips: strips.length, m3: strips.every(s => /^matrix3d\(/.test(s.style.transform)),
      ids: g ? Array.from(g.querySelectorAll('[id]')).filter(n => n.id !== 'view' && !n.closest('svg')).length : -1, text: g ? g.textContent.replace(/\s+/g, ' ').slice(0, 400) : '',
      first: views[0] && !views[0].closest('.genie-ghost, .genie-under'), bulge: b ? Math.round(b.getBoundingClientRect().left) : null, rail: Math.round(document.querySelector('.sidebar').getBoundingClientRect().right),
      level: b && link ? Math.abs(parseFloat(b.style.top) - (link.getBoundingClientRect().top + link.getBoundingClientRect().height / 2)) : null, on: document.documentElement.classList.contains('genie-on') };
  }, linkSel || null);
  const shape = () => q.evaluate(() => Array.from(document.querySelectorAll('.genie-ghost > .genie-strip')).filter(s => s.style.visibility !== 'hidden').map(s => Math.round(s.getBoundingClientRect().height)));
  const curved = hs => { const n = hs.length, mid = Math.floor(n / 2); return n > 4 && hs[0] < 140 && hs[n - 1] > 600 && hs.every((h, i) => !i || h >= hs[i - 1] - 2) && Math.abs((hs[mid] - hs[0]) / mid - (hs[n - 2] - hs[mid]) / (n - 2 - mid)) > 3; };
  // within a class: a plain change
  await q.evaluate(() => { location.hash = '#/calc/notes'; }); await q.waitForTimeout(60);
  const plain = await ghostNow();
  check('from one class page to another the page simply changes', !plain.ghost && !plain.under && plain.bulge === null, plain);
  await q.waitForTimeout(900);
  // leaving the class for home: the page closes into the class's link in the sidebar
  await q.evaluate(() => { App.genieMs = 2400; location.hash = '#/'; });
  await q.waitForSelector('.vt-bulge', { timeout: 2000 }).catch(() => {});
  const g1 = await ghostNow('.sidebar a.sb-class[href="#/calc/dashboard"]');
  check('leaving a class for home: the class page goes into a ghost over home, cut into strips bent onto the funnel (hidden from screen readers, without its ids)', g1.ghost && g1.hidden === 'true' && g1.inert && g1.strips >= 6 && g1.m3 && g1.ids === 0 && /Understanding the derivative/.test(g1.text) && g1.first && g1.on, g1);
  check('it goes into the sidebar level with the class’s link, where the sidebar’s edge stretches out', g1.bulge !== null && Math.abs(g1.bulge - g1.rail) <= 2 && g1.level !== null && g1.level < 8, g1);
  await q.waitForTimeout(600);
  const hs1 = await shape();
  check('the page is squeezed into the neck between curved sides', curved(hs1), hs1);
  await q.waitForTimeout(2100);
  const g2 = await ghostNow();
  check('and when it is done, nothing is left of it: just home', !g2.ghost && !g2.under && g2.bulge === null && !g2.on && /^#\/?$/.test(await q.evaluate(() => location.hash)), g2);
  // going into a class: the class page comes out of its link, over the page you left, which stands still under it
  await q.evaluate(() => { location.hash = '#/calc/dashboard'; });
  await q.waitForSelector('.vt-bulge', { timeout: 2500 }).catch(() => {});
  const o1 = await ghostNow('.sidebar button[data-view="dashboard"]');
  check('going into a class: the class page comes out of its sidebar link over the page you left (held still under it)', o1.ghost && o1.under && o1.strips >= 6 && o1.ids === 0 && o1.first && o1.bulge !== null && Math.abs(o1.bulge - o1.rail) <= 2 && o1.level !== null && o1.level < 8, o1);
  await q.waitForTimeout(1000);
  const hs2 = await shape();
  check('it pours out of the neck between curved sides', curved(hs2), hs2);
  await q.waitForTimeout(2200);
  const o2 = await q.evaluate(() => ({ ghost: !!document.querySelector('.genie-ghost, .genie-under'), on: document.documentElement.classList.contains('genie-on'), view: !!document.querySelector('#view .xw, #view h1') }));
  check('and when it is out, the class page is just the page', !o2.ghost && !o2.on && o2.view, o2);
  await q.evaluate(() => { App.genieMs = 0; });
  // Back out of the class closes it again; between pages outside the classes, plain
  await q.goBack(); await q.waitForTimeout(40);
  const gBack = await ghostNow();
  check('Back out of the class closes the class page the same way', gBack.ghost && gBack.strips >= 6, gBack);
  await q.waitForTimeout(900);
  await q.evaluate(() => { location.hash = '#/forum'; }); await q.waitForTimeout(60);
  const gOut = await ghostNow();
  check('between pages outside the classes (home to discussions) the page simply changes', !gOut.ghost && !gOut.under, gOut);
  await q.waitForTimeout(600);
  await q.emulateMedia({ reducedMotion: 'reduce' });
  await q.evaluate(() => { location.hash = '#/calc/dashboard'; }); await q.waitForTimeout(60);
  const still = await ghostNow();
  check('with Reduce motion the page simply changes', !still.ghost && !still.under && still.bulge === null && await q.evaluate(() => !!document.querySelector('#view').children.length), still);
  const reduceAgain = async pg => { await pg.evaluate(() => { App.setSetting('motion', 'off'); }); await pg.waitForTimeout(3200); };   // sent to the account after 2.5 s
  await reduceAgain(q);
  await c2.close();
  // on a phone the sidebar is tucked away: the page goes up into the menu button (and comes out of it), which squashes and snaps back
  const [c4, ph] = await mk(390, 800, { serviceWorkers: 'block', reducedMotion: 'no-preference' });
  await ph.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.motion = 'on'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await signIn(ph); await go(ph, '#/calc/path', 1500); await ph.evaluate(() => { App.setSetting('motion', 'on'); if (App.applyMotion) App.applyMotion(); });
  await ph.evaluate(() => { App.genieMs = 1200; location.hash = '#/'; });
  await ph.waitForSelector('.genie-ghost', { timeout: 2000 }).catch(() => {});
  await ph.waitForTimeout(500);
  const up = await ph.evaluate(() => { const s = Array.from(document.querySelectorAll('.genie-ghost > .genie-strip')).filter(x => x.style.visibility !== 'hidden').map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }); const m = document.querySelector('#topbar .menu-btn').getBoundingClientRect(); return { s, menu: Math.round(m.left + m.width / 2) }; });
  let snapped = false; for (let i = 0; i < 30 && !snapped; i++) { snapped = await ph.evaluate(() => document.querySelector('#topbar .menu-btn').classList.contains('vt-snap')); if (!snapped) await ph.waitForTimeout(40); }
  const top0 = up.s[0];
  check('phone: the strips stand on top of each other, the top ones narrowed to the menu button, which squashes as the page goes in', up.s.length >= 6 && top0 && top0[1] < 200 && top0[0] < up.menu && top0[0] + top0[1] > up.menu - 30 && up.s[up.s.length - 1][1] > 340 && snapped, { up, snapped });
  await ph.waitForTimeout(1200);
  await ph.evaluate(() => { location.hash = '#/calc/path'; });
  await ph.waitForSelector('.genie-under', { timeout: 2500 }).catch(() => {});
  const pin = await ph.evaluate(() => ({ under: !!document.querySelector('.genie-under'), strips: document.querySelectorAll('.genie-ghost > .genie-strip').length }));
  check('phone: going into a class, the class page comes out of the menu button over the page you left', pin.under && pin.strips >= 6, pin);
  await ph.waitForTimeout(1500); await reduceAgain(ph);
  await c4.close();

  // a page starts loading before you click it: a class link you rest the pointer on, a page whose code loads the first time
  const [c3, w] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
  await w.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.courses = ['calc', 'physics']; s.boFloatSeen = 1; s.tourLayout = 9; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(w, '#/resources', 1500);
  const pre = await w.evaluate(() => ({ loaded: App.courseLoaded('physics'), link: !!document.querySelector('a[href^="#/physics"]'), lazy: !!(App.views.whatsnew && App.views.whatsnew.lazy) }));
  await w.hover('a[href^="#/physics"]'); await w.waitForTimeout(30);
  const early = await w.evaluate(() => App.courseLoaded('physics'));
  let bar = false; for (let i = 0; i < 20; i++) { bar = bar || await w.evaluate(() => { const b = document.querySelector('#loadbar'); return !!(b && b.classList.contains('on')); }); await w.waitForTimeout(40); }
  const post = await w.evaluate(() => ({ loaded: App.courseLoaded('physics'), hash: location.hash }));
  check('resting the pointer on a class link loads that class quietly (no loading bar), without opening it', pre.link && !pre.loaded && !early && post.loaded && !bar && /resources/.test(post.hash), { pre, early, bar, post });
  await w.evaluate(() => { const a = document.createElement('a'); a.href = '#/whatsnew'; a.id = 'zz-wn'; a.textContent = 'What is new'; a.style.cssText = 'position:fixed;top:120px;left:420px;z-index:999;padding:8px;background:#fff'; document.body.appendChild(a); });
  await w.hover('#zz-wn'); await w.waitForTimeout(800);
  const lz = await w.evaluate(() => ({ lazy: !!(App.views.whatsnew && App.views.whatsnew.lazy), hash: location.hash }));
  check('and a page whose code loads the first time (What’s new) is fetched ahead of the click', pre.lazy && !lz.lazy && /resources/.test(lz.hash), { pre, lz });
  await w.click('#zz-wn'); await w.waitForTimeout(500);
  check('so it opens at once', await w.evaluate(() => /whatsnew/.test(location.hash) && !/Loading…/.test(document.querySelector('#view').textContent) && document.querySelector('#view').textContent.length > 200));
  await c3.close();
  await T.finish();
})();
