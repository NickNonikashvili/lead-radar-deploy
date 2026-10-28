/* The upload check (build-check.js) and the release command (scripts/release.js):
   - the page, assets/ (scripts and styles) and learn/ carry the same build, and release.js --check says so
   - all the same: nothing shows and the page does not reload
   - assets/ behind (an upload that did not replace it): the page drops its saved copies and reloads once, then a
     strip says the site is being updated; an admin also reads which folder is behind and what to upload again
   - learn/ behind: named the same way
   On localhost the check stays off unless a test turns it on (window.MATHUB_BUILDCHECK). */
const T = require('./lib'); const path = require('path'); const { execFileSync } = require('child_process');
(async () => {
  const { mk, go, login, check, log } = await T.start({});
  const ROOT = path.join(__dirname, '..');
  let ok = true, out = '';
  try { out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'release.js'), '--check'], { cwd: ROOT, encoding: 'utf8' }); } catch (e) { ok = false; out = String(e.stdout || e.message); }
  log(out.trim());
  check('release.js --check: the page, the scripts, the styles, build-check.js and learn/ carry one build', ok, out);

  const on = c => c.addInitScript(() => { window.MATHUB_BUILDCHECK = 1; });
  const strip = p => p.evaluate(() => { const s = document.getElementById('build-strip'); return s ? s.textContent : ''; });
  const loads = p => { let n = 0; p.on('load', () => { n++; }); return () => n; };

  // all in place
  { const [c, p] = await mk(1200, 800, { serviceWorkers: 'block' }); await on(c); const n = loads(p);
    await go(p, '#/', 3800);
    check('when everything is from one build, nothing shows and the page loads once', (await strip(p)) === '' && n() === 1, { strip: await strip(p), loads: n() });
    await c.close(); }

  // assets/ left behind: the old scripts carry an older stamp
  const staleScripts = async c => c.route(/assets\/app\.js/, async r => { const res = await r.fetch(); const body = (await res.text()).replace(/MATHUB_ASSETS_BUILD = '[^']*'/, "MATHUB_ASSETS_BUILD = '2026.10.28.2'"); r.fulfill({ response: res, body }); });
  { const [c, p] = await mk(1200, 800, { serviceWorkers: 'block' }); await on(c); await staleScripts(c); const n = loads(p);
    await go(p, '#/', 5200);
    const s = await strip(p);
    check('scripts behind: one reload to drop saved copies, then the strip, plain for a visitor', n() === 2 && /StudyCat is being updated/.test(s) && !/Upload incomplete/.test(s), { loads: n(), s });
    await p.click('#build-strip button'); check('the strip can be hidden', (await strip(p)) === '');
    await c.close(); }
  { const [c, p] = await mk(1200, 800, { serviceWorkers: 'block' }); await on(c); await staleScripts(c);
    await go(p, '#/', 600); await login(p, 'admin.user@montana.edu');
    await p.evaluate(() => { try { sessionStorage.setItem('mathub-buildcheck-' + MathubBuildCheck.BUILD, '1'); } catch (e) {} }); await p.reload(); await p.waitForTimeout(3400);
    const s = await strip(p);
    check('an admin reads which folder is behind and what to do', /Upload incomplete/.test(s) && /assets\/ \(scripts\) is 2026\.10\.28\.2/.test(s) && /Upload the whole zip again/.test(s) && !/learn\//.test(s.replace('inside assets/ and learn/', '')), s);
    await c.close(); }

  // learn/ left behind
  { const [c, p] = await mk(1200, 800, { serviceWorkers: 'block' }); await on(c);
    await c.route(/learn\/build\.json/, r => r.fulfill({ status: 404, body: 'Not found' }));
    await go(p, '#/', 600); await login(p, 'admin.user@montana.edu');
    await p.evaluate(() => { try { sessionStorage.setItem('mathub-buildcheck-' + MathubBuildCheck.BUILD, '1'); } catch (e) {} }); await p.reload(); await p.waitForTimeout(3400);
    const s = await strip(p);
    check('study guides behind: named as learn/', /learn\/ is older/.test(s) && !/assets\/ \(scripts\) is/.test(s), s);
    await c.close(); }
  await T.finish();
})();
