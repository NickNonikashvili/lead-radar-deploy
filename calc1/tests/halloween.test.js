/* Halloween (2026.11.01.2): from October 1 to November 8 every year the website dresses up (assets/season.js,
   assets/halloween.css, the Halloween pieces of assets/pixel.js and the block at the end of assets/seo.css).
   - the dates: on from October 1 to November 8, off the rest of the year; switched off for a year in Settings it comes
     back the next October; settings.season forces it either way
   - from the first paint: the attribute is on <html> before the page's own script runs, the tab icon is Bo in a witch's
     hat and the phone's browser bar is the night colour
   - night and day: the pumpkin accent on the one filled button, the page colours, every text colour readable (WCAG AA)
   - Bo wears a witch's hat (the logo and the mascot); the hero has a moon, bats and the range at night; a spider hangs in
     the sidebar; empty boxes get a pumpkin, a ghost or a bat; a bat and a jack-o'-lantern sign the footer
   - the bats fly only with motion on, and nothing moves with Reduce motion
   - Settings: a switch turns it off for the year (synced) and back on; it is restored at the end
   - not in the other looks; nothing wider than a phone; the study guides dress up too
   - the other suites see the everyday look (tests/lib.js sets settings.season = 'none' unless a suite asks) */
const T = require('./lib');
(async () => {
  const { mk, go, login, check, hscroll, base } = await T.start({ season: true });
  const force = (c, v) => c.addInitScript(v => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); if (v === null) delete s.season; else s.season = v; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} }, v);
  const rgb = h => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;

  /* ---------- the dates (StudySeason.of, the same function the page uses) ---------- */
  const [c0, p0] = await mk(1280, 800, { serviceWorkers: 'block' }); await force(c0, null);
  await go(p0, '#/', 1200);
  const dates = await p0.evaluate(() => { const of = (y, m, d, s) => window.StudySeason.of(new Date(y, m - 1, d, 12), s || {}) || 'off';
    return [of(2026, 9, 30), of(2026, 10, 1), of(2026, 10, 31), of(2026, 11, 8), of(2026, 11, 9), of(2027, 3, 1), of(2026, 10, 31, { seasonOff: 2026 }), of(2027, 10, 15, { seasonOff: 2026 }), of(2027, 3, 1, { season: 'halloween' }), of(2026, 10, 31, { season: 'none' })].join(','); });
  check('on from October 1 to November 8, off the rest of the year; off for this year comes back next October; forced either way', dates === 'off,halloween,halloween,halloween,off,off,off,halloween,halloween,off', dates);
  await c0.close();

  /* ---------- night, motion on (as a guest: alice keeps Reduce motion on in her account) ---------- */
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', colorScheme: 'dark', reducedMotion: 'no-preference' }); await force(c, 'halloween');
  await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.motion = 'on'; s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} document.addEventListener('DOMContentLoaded', () => { window.__seasonAtParse = document.documentElement.getAttribute('data-season'); }); });
  await go(p, '#/', 2400);
  const head = await p.evaluate(() => ({ parse: window.__seasonAtParse, icon: document.querySelector('link[rel="icon"][type="image/svg+xml"]').getAttribute('href'), bar: document.querySelector('meta[name="theme-color"]').content, motion: document.documentElement.getAttribute('data-motion') }));
  check('it is on before the page draws: on <html> when the document is parsed, the tab icon is Bo in a witch’s hat, the browser bar is the night colour', head.parse === 'halloween' && /icon-halloween\.svg/.test(head.icon) && head.bar === '#1A1026' && head.motion === 'on', head);
  const hero = await p.evaluate(() => { const h = document.querySelector('.hg-hero'); const b = getComputedStyle(h, '::before'), a = getComputedStyle(h, '::after'); const sky = getComputedStyle(h.querySelector('.px-skyline')).backgroundImage; const hat = h.querySelector('.bobcat .bo-hat');
    return { moon: b.content !== 'none' && /svg/.test(b.backgroundImage) && parseFloat(b.width) > 50, bats: a.content !== 'none' && /svg/.test(a.backgroundImage), hover: a.animationName, stars: /radial-gradient/.test(getComputedStyle(h).backgroundImage), range: /3B2C5A/i.test(sky), hat: !!hat && getComputedStyle(hat).display !== 'none' }; });
  check('the start page hero: stars, a harvest moon with bats in front of it (hovering), the pixel range at night, Bo in a witch’s hat', hero.moon && hero.bats && hero.hover === 'hw-hover' && hero.stars && hero.range && hero.hat, hero);
  await go(p, '#/calc/dashboard', 2600);
  const look = await p.evaluate(() => { const btn = document.querySelector('#view .btn.primary');
    return { bg: getComputedStyle(document.body).backgroundColor, btn: btn ? getComputedStyle(btn).backgroundColor : '', btnInk: btn ? getComputedStyle(btn).color : '', side: getComputedStyle(document.querySelector('.sidebar')).backgroundColor }; });
  check('night: the aubergine page and sidebar, the one filled button pumpkin with dark text (on a class page too)', look.bg === rgb('#120C1C') && look.side === rgb('#150E20') && look.btn === rgb('#FF7A1A') && look.btnInk === rgb('#1A0B00'), look);
  const bo = await p.evaluate(() => { const shown = s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 4; }; return { logo: shown('.sidebar .brand-logo .hw-hat'), foot: shown('.site-foot .hw-hat') }; });
  check('Bo wears a witch’s hat in the logo too: the sidebar and the footer', bo.logo && bo.foot, bo);
  const frame = await p.evaluate(() => { const sp = getComputedStyle(document.querySelector('.sb-head'), '::after'); const bats = [...document.querySelectorAll('.hw-bats .px-bat')];
    return { spider: sp.content !== 'none' && /svg/.test(sp.backgroundImage), dangle: sp.animationName, bats: bats.length, fly: bats.length ? getComputedStyle(bats[0]).animationName : '', clicks: bats.length ? getComputedStyle(document.querySelector('.hw-bats')).pointerEvents : '' }; });
  check('a spider dangles in the sidebar, and three pixel bats fly across the top now and then without catching a click', frame.spider && frame.dangle === 'hw-dangle' && frame.bats === 3 && frame.fly === 'hw-fly' && frame.clicks === 'none', frame);
  const friends = await p.evaluate(async () => { const v = document.querySelector('#view'); const names = []; for (const t of ['Nothing here yet.', 'No mistakes to retry.', 'No posts yet.', 'Nothing due today.']) { const d = document.createElement('div'); d.className = 'empty'; d.textContent = t; v.appendChild(d); await new Promise(r => setTimeout(r, 60)); const s = d.querySelector('.bo-mini svg'); names.push(s ? s.getAttribute('class').split(' ')[1] : '-'); d.remove(); } return names; });
  check('empty boxes get a Halloween friend: a pumpkin, a ghost, a bat (or Bo)', friends.length === 4 && friends.every(n => ['px-pumpkin', 'px-ghost', 'px-bat', 'px-bo'].includes(n)) && friends.some(n => n !== 'px-bo'), friends);
  const sig = await p.evaluate(() => { const s = document.querySelector('.px-sig'); return s ? [...s.querySelectorAll('svg')].map(x => x.getAttribute('class').split(' ')[1]).join(',') : ''; });
  check('a bat and a jack-o’-lantern sign the footer', sig === 'px-bat,px-pumpkin', sig);
  // every text colour on its usual backgrounds, read from the page (WCAG AA, 4.5:1)
  const contrast = await p.evaluate(() => {
    const cs = getComputedStyle(document.documentElement); const v = n => cs.getPropertyValue('--' + n).trim();
    const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const r = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const low = []; [['ink', 'bg'], ['ink', 'd-card'], ['ink-2', 'd-card'], ['muted', 'bg'], ['muted', 'd-card'], ['muted', 'd-inner'], ['muted', 'd-side'], ['link', 'd-card'], ['link', 'bg'], ['accent', 'd-card'], ['accent-ink', 'accent'], ['d-nav-on-fg', 'd-nav-on']].forEach(([f, b]) => { const x = r(v(f), v(b)); if (!(x >= 4.5)) low.push(`${f} on ${b} ${x.toFixed(2)}`); });
    return low; });
  check('night: every text colour reads at 4.5:1 or more on its backgrounds', contrast.length === 0, contrast);
  // Reduce motion: nothing moves
  await p.evaluate(() => { document.documentElement.setAttribute('data-motion', 'off'); }); await p.waitForTimeout(200);
  const still = await p.evaluate(() => ({ bats: getComputedStyle(document.querySelector('.hw-bats')).display, spider: getComputedStyle(document.querySelector('.sb-head'), '::after').animationName }));
  await go(p, '#/', 2000); await p.evaluate(() => { document.documentElement.setAttribute('data-motion', 'off'); }); await p.waitForTimeout(200);
  still.hover = await p.evaluate(() => getComputedStyle(document.querySelector('.hg-hero'), '::after').animationName);
  check('with Reduce motion nothing moves: no bats, the spider and the hovering bats hold still', still.bats === 'none' && still.spider === 'none' && still.hover === 'none', still);
  await c.close();

  /* ---------- day, and the switch in Settings (the clock fixed on Halloween, so the dates decide) ---------- */
  const [c2, d] = await mk(1360, 900, { serviceWorkers: 'block', colorScheme: 'light' }); await force(c2, null);
  await d.clock.setFixedTime(new Date('2026-10-31T15:00:00'));
  await go(d, '#/', 900); await login(d, 'alice.a@montana.edu'); await d.reload(); await d.waitForTimeout(2000);
  const day = await d.evaluate(() => ({ season: document.documentElement.getAttribute('data-season'), bg: getComputedStyle(document.body).backgroundColor, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));
  check('day on October 31: the harvest dusk (parchment page, burnt-orange accent with white text)', day.season === 'halloween' && day.bg === rgb('#FBF3E8') && day.accent.toUpperCase() === '#C2410C', day);
  await go(d, '#/settings', 2200);
  const sw0 = await d.evaluate(() => { const i = document.querySelector('#s-season'); return i ? { on: i.checked, label: i.closest('label').textContent.replace(/\s+/g, ' ').trim() } : null; });
  check('Settings has a Halloween look switch, on', !!sw0 && sw0.on && /Halloween look/.test(sw0.label) && /November 8/.test(sw0.label), sw0);
  await d.click('#s-season'); await d.waitForTimeout(400);
  const off = await d.evaluate(() => ({ season: document.documentElement.getAttribute('data-season'), bats: !!document.querySelector('.hw-bats'), icon: document.querySelector('link[rel="icon"][type="image/svg+xml"]').getAttribute('href'), seasonOff: JSON.parse(localStorage.getItem('studyhub-settings')).seasonOff, hat: getComputedStyle(document.querySelector('.sidebar .hw-hat')).display, sig: (document.querySelector('.px-sig svg') || { getAttribute: () => '' }).getAttribute('class') }));
  check('switched off: the everyday look at once (no bats, no hat, the usual icon and footer), off for this year', off.season === null && !off.bats && /icon\.svg/.test(off.icon) && !/halloween/.test(off.icon) && off.seasonOff === 2026 && off.hat === 'none' && /px-invader/.test(off.sig), off);
  await d.reload(); await d.waitForTimeout(1800);
  check('and it stays off after a reload', (await d.evaluate(() => document.documentElement.getAttribute('data-season'))) === null);
  await d.click('#s-season'); await d.waitForTimeout(400);
  const back = await d.evaluate(() => ({ season: document.documentElement.getAttribute('data-season'), bats: !!document.querySelector('.hw-bats'), seasonOff: JSON.parse(localStorage.getItem('studyhub-settings')).seasonOff }));
  check('switched back on: the costume again', back.season === 'halloween' && back.bats && !back.seasonOff, back);
  await d.waitForTimeout(2600);   // the preference reaches the account (pushed a moment after the change), so alice stays in costume
  await c2.close();

  /* ---------- the other looks keep theirs; nothing wider than a phone ---------- */
  const [c3, r] = await mk(1280, 800, { serviceWorkers: 'block' }); await force(c3, 'halloween');
  await c3.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.skin = 'realm'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(r, '#/', 2000);
  const realm = await r.evaluate(() => ({ skin: document.documentElement.getAttribute('data-skin'), bats: !!document.querySelector('.hw-bats'), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));
  check('another look (Realm) keeps its own colours and has no bats', realm.skin === 'realm' && !realm.bats && !/^#(FF7A1A|C2410C)$/i.test(realm.accent), realm);
  await c3.close();
  const wide = [];
  for (const w of [390, 320]) {
    const [c4, m] = await mk(w, 760, { serviceWorkers: 'block', colorScheme: 'dark', hasTouch: true }); await force(c4, 'halloween');
    await go(m, '#/', 900); await login(m, 'alice.a@montana.edu'); await m.reload(); await m.waitForTimeout(1800);
    for (const h of ['#/', '#/calc/flashcards', '#/settings']) { await go(m, h, 1800); if (!(await hscroll(m))) wide.push(`${w} ${h}`); }
    if (w === 390) { await go(m, '#/', 1800); const moon = await m.evaluate(() => { const h = document.querySelector('.hg-hero'); const t = h.querySelector('.hg-title').getBoundingClientRect(); const hb = h.getBoundingClientRect(); const b = getComputedStyle(h, '::before'); const top = hb.bottom - parseFloat(b.bottom) - parseFloat(b.height); return { below: top > t.bottom, top: Math.round(top), title: Math.round(t.bottom) }; }); check('on a phone the moon rises low beside the hills, never behind the words', moon.below, moon); }
    await c4.close();
  }
  check('in costume nothing is wider than the phone (390 and 320 px)', wide.length === 0, wide);

  /* ---------- the study guides dress up too ---------- */
  const [c5, g] = await mk(1280, 800, { serviceWorkers: 'block', colorScheme: 'dark' }); await force(c5, 'halloween');
  await g.goto(base.replace(/index\.html$/, '') + 'learn/index.html'); await g.waitForTimeout(800);
  const guide = await g.evaluate(() => ({ season: document.documentElement.getAttribute('data-season'), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), bats: /svg/.test(getComputedStyle(document.querySelector('.s-head'), '::after').backgroundImage) }));
  check('the study guides: in season too, with the pumpkin accent and bats by the title bar', guide.season === 'halloween' && /^#FF8A2E$/i.test(guide.accent) && guide.bats, guide);
  await c5.close();

  /* ---------- the other suites see the everyday look ---------- */
  const [c6, q] = await mk(1280, 800, { serviceWorkers: 'block' });
  await c6.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.season = 'none'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
  await go(q, '#/', 1500);
  const none = await q.evaluate(() => ({ season: document.documentElement.getAttribute('data-season'), hat: getComputedStyle(document.querySelector('.hw-hat')).display, bats: !!document.querySelector('.hw-bats') }));
  check('with the season set to none (what tests/lib.js gives every other suite): the everyday look, no hat, no bats', none.season === null && none.hat === 'none' && !none.bats, none);
  await c6.close();
  await T.finish();
})();
