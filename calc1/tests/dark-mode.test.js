/* Dark mode stays readable in the default look (assets/world.css, then assets/clean.css): the text colours flip
   with the background, by the dark setting and by the device's own dark mode, on the pages people use most.
   Contrast is measured like WCAG (4.5:1 for body text) against the background the text actually sits on. */
const T = require('./lib');
(async () => {
  const { mk, go, login, check } = await T.start();
  const measure = p => p.evaluate(() => {
    const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return 1; const [r, g, b] = m.slice(0, 3).map(v => { v = +v / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return getComputedStyle(document.body).backgroundColor; };
    const pick = sel => { const el = document.querySelector(sel); if (!el) return null; const c = getComputedStyle(el).color; return { sel, ratio: Math.round(ratio(c, bgOf(el)) * 10) / 10 }; };
    return ['.page-title', '.panel-title', '.nav-item', '.topbar-title', '.sec-title', 'p.muted, .page-sub', '.panel p'].map(pick).filter(Boolean);
  });
  for (const mode of ['dark', 'system']) {
    const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', colorScheme: 'dark' });
    await c.addInitScript(m => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; s.theme = m; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} }, mode);
    await go(p, '#/'); await login(p, 'alice.a@montana.edu'); await p.reload(); await p.waitForTimeout(1000);
    for (const h of ['#/', '#/calc/dashboard', '#/today', '#/usage', '#/plan']) {
      await go(p, h, 1500);
      const r = await measure(p); const low = r.filter(x => x.ratio < 4.5);
      check(`${mode === 'dark' ? 'dark setting' : 'device dark mode'}, ${h}: text is readable (4.5:1 or more)`, r.length >= 2 && !low.length, low.length ? low : r);
    }
    await c.close();
  }
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
