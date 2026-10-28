/* Bo draws anything (assets/board-draw-more.js, on top of assets/board-draw.js): his own SVG (cleaned before it is
   shown), pictures an image model makes (api/images.php, through the stand-in in tests/pyodide/router.php), 3D
   surfaces turned by dragging or the arrow keys, implicit and polar curves, slope and vector fields with solution
   curves, contour maps and heat maps, and View large for any drawing. Also the board's math lines (assets/tutor.js):
   words with $math$ in them stay one line, and graph labels stay readable on a phone. */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite');
const sqlite = q => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', DB, q]);
const IMGDIR = path.join(__dirname, '..', 'api', 'data', 'ai-img');
(async () => {
  const { mk, go, login, txt, hscroll, check, log } = await T.start();
  const MOD = 'mod.user@montana.edu';
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await go(p, '#/', 500); await login(p, MOD); await p.reload(); await p.waitForTimeout(1500);
  // a place on the page to draw into
  const draw = (o, id = 'dm') => p.evaluate(([o, id]) => { let host = document.getElementById(id); if (!host) { host = document.createElement('div'); host.id = id; host.style.cssText = 'position:fixed;left:20px;top:80px;width:560px;z-index:9999;background:var(--surface);padding:10px'; document.body.appendChild(host); } const D = App.boDraw; const sp = D.parse(typeof o === 'string' ? o : JSON.stringify(o)); host.innerHTML = sp ? D.html(sp, false) : ''; return { ok: !!sp, type: sp && sp.type, html: host.innerHTML, plain: sp ? D.plain(sp) : '' }; }, [o, id]);
  const clean = r => r.ok && !/NaN|undefined|Infinity/.test(r.html) && r.plain.length > 8;

  // ---- the new kinds, each drawn cleanly, with words for screen readers ----
  const kinds = [];
  for (const [name, o, want] of [
    ['implicit curve', { type: 'implicit', implicit: ['x^2 + y^2 = 4', 'x^2/9 + y^2/4 = 1'] }, /bd-imp/],
    ['polar curve', { type: 'polar', r: '1 + cos(t)' }, /bd-curve/],
    ['slope field with a solution', { type: 'slopefield', slopefield: { dy: 'x - y', through: [[0, 1]] }, x: [-3, 3], y: [-3, 3] }, /bd-field/],
    ['vector field', { type: 'vectorfield', field: { P: '-y', Q: 'x' }, x: [-2, 2], y: [-2, 2] }, /bd-field/],
    ['contour map', { type: 'contour', contour: { f: 'x^2 + y^2', levels: [1, 2, 4] }, x: [-3, 3], y: [-3, 3] }, /bd-level/],
    ['heat map', { type: 'heatmap', contour: { f: 'sin(x)*cos(y)', fill: true }, x: [-3, 3], y: [-3, 3] }, /<rect/],
    ['3D surface', { type: 'surface', z: 'x^2 - y^2', x: [-2, 2], y: [-2, 2] }, /bd-3dsurf/],
    ['3D curve (a helix)', { type: 'surface', curves: [{ x: 'cos(t)', y: 'sin(t)', z: 't/6', t: [0, 12.6] }] }, /bd-curve/],
    ['his own SVG', { type: 'svg', svg: '<svg viewBox="0 0 200 100"><rect x="10" y="10" width="80" height="40" fill="#cde"/><text x="20" y="35">Nucleus</text><circle cx="150" cy="50" r="30"/></svg>', alt: 'A cell, with its nucleus' }, /<rect/]
  ]) { const r = await draw(o); kinds.push([name, r.ok, clean(r), want.test(r.html), r.plain.slice(0, 60)]); }
  check('every new kind draws cleanly, with words for screen readers: implicit and polar curves, slope and vector fields, contour and heat maps, 3D surfaces and curves, his own SVG', kinds.every(k => k[1] && k[2] && k[3]), kinds.filter(k => !(k[1] && k[2] && k[3])));
  const circ = await draw({ type: 'implicit', implicit: 'x^2 + y^2 = 4' });
  check('an implicit curve with no range gets a window that fits it, square', /bd-imp/.test(circ.html) && /x² \+ y² = 4/.test(circ.plain) && !/Graph of lines/.test(circ.plain), circ.plain);

  // ---- his SVG is cleaned: no scripts, handlers, links out or foreign content; ids made his own ----
  const bad = await draw({ type: 'svg', svg: '<svg viewBox="0 0 100 100" onload="alert(1)"><script>alert(2)</script><foreignObject><div>hi</div></foreignObject><a href="javascript:alert(3)"><circle id="c" cx="50" cy="50" r="20" onclick="alert(4)" style="fill:red;background:url(http://evil.example/x)"/></a><image href="https://evil.example/p.png" width="10" height="10"/><use href="#c" x="10"/><text x="5" y="90">ok</text></svg>' });
  check('his SVG is cleaned: no script, event handlers, javascript links, foreign content, outside images or url() styles; what was inside a link stays', bad.ok && !/script|onload|onclick|javascript:|foreignObject|evil\.example|url\(/i.test(bad.html) && /<circle/.test(bad.html) && /ok<\/text>/.test(bad.html), bad.html.slice(0, 400));
  check('and its ids are made his own, so two drawings never clash', /id="sv\d+-c"/.test(bad.html) && /href="#sv\d+-c"/.test(bad.html), bad.html.match(/id="[^"]+"|href="[^"]+"/g));

  // ---- a 3D surface turns by dragging, and with the arrow keys ----
  await draw({ type: 'surface', z: 'x^2 - y^2' });
  const d0 = await p.$eval('#dm .bd-surface .bd-3dsurf path', e => e.getAttribute('d'));
  const box = await p.$eval('#dm .bd-surface > svg', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x + 80, box.y + 10, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  const d1 = await p.$eval('#dm .bd-surface .bd-3dsurf path', e => e.getAttribute('d'));
  check('a 3D surface turns when it is dragged', d0 !== d1);
  await p.focus('#dm .bd-surface > svg'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  const d2 = await p.$eval('#dm .bd-surface .bd-3dsurf path', e => e.getAttribute('d'));
  check('and with the arrow keys', d2 !== d1);

  // ---- View large ----
  await draw({ type: 'venn', sets: [{ label: 'A' }, { label: 'B' }], regions: { '1': 'only A', '2': 'only B', '3': 'both' } });
  check('a drawing that does not move has View large (a moving graph has its own Expand)', !!(await p.$('#dm .bd-view[data-bdv]')));
  await p.click('#dm .bd-view'); await p.waitForTimeout(400);
  check('View large opens it over the page, large, with zoom and close', !!(await p.$('.bdv.open .bdv-stage svg')) && (await p.$$('.bdv .bdv-b')).length === 4 && (await p.getAttribute('.bdv', 'role')) === 'dialog');
  await p.click('.bdv [data-bdv-z="in"]'); await p.waitForTimeout(150);
  check('zoom in makes it bigger', /scale\(1\.[1-9]/.test(await p.$eval('.bdv-art', e => e.style.transform)), await p.$eval('.bdv-art', e => e.style.transform));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check('Escape closes it, and focus goes back to the button', !(await p.$('.bdv')) && await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('bd-view')));

  // ---- pictures: made once, shown from the server; refused politely ----
  const prompt = 'A labelled diagram of the unit circle, test ' + Date.now();
  await draw({ type: 'image', prompt, style: 'diagram' });
  check('a picture shows Bo drawing it while it is made', /Bo is drawing this picture/.test(await txt(p, '#dm .bd-imgbox')) || !!(await p.$('#dm .bd-imgbox.ok img')));
  await p.waitForSelector('#dm .bd-imgbox.ok img', { timeout: 15000 }).catch(() => {});
  const img = await p.$eval('#dm .bd-imgbox img', e => ({ src: e.getAttribute('src'), w: e.naturalWidth, alt: e.alt })).catch(() => null);
  check('then the picture itself, from StudyCat (not a link to elsewhere), with its alt text', img && /^blob:/.test(img.src) && img.w > 0 && /unit circle/.test(img.alt), img);
  await draw({ type: 'image', prompt: 'REFUSE-SAFETY a picture', style: 'photo' }, 'dm2');
  await p.waitForSelector('#dm2 .bd-img-wait.bad', { timeout: 15000 }).catch(() => {});
  check('a picture the safety check turns down says so, and offers to try again', /safety check/.test(await txt(p, '#dm2 .bd-imgbox')) && !!(await p.$('#dm2 [data-img-retry]')), await txt(p, '#dm2 .bd-imgbox'));
  for (const f of fs.existsSync(IMGDIR) ? fs.readdirSync(IMGDIR) : []) if (f.endsWith('.webp')) { try { const st = fs.statSync(path.join(IMGDIR, f)); if (Date.now() - st.mtimeMs < 10 * 60000) fs.unlinkSync(path.join(IMGDIR, f)); } catch (e) {} }   // the ones this run made

  // ---- the board's math lines ----
  const lines = await p.evaluate(() => { const host = document.createElement('div'); host.id = 'bbtest'; document.body.appendChild(host); const B = App.boBoard; const pg = { title: 'Lines', items: [{ k: 'answer', t: '$x = 2$ or $x = 3$' }, { k: 'answer', t: 'x = 3 or x = -2' }, { k: 'math', t: '$x=2$ or $x=3$' }, { k: 'answer', t: '$x = 4$' }, { k: 'math', t: '2x + 3 = 7' }] }; host.innerHTML = B.pageHtml(pg); return [...host.querySelectorAll('.bb-item')].map(e => ({ k: e.className, disp: !!e.querySelector('.bb-math'), mixed: !!e.querySelector('.bb-mixed'), text: e.textContent.trim() })); });
  log('board lines:', JSON.stringify(lines));
  check('the board draws all five lines', lines.length === 5, lines.length);
  if (lines.length === 5) {
    check('words with $math$ in them stay one line, the math inline (no stray $$)', lines[0].mixed && !lines[0].disp && lines[2].mixed && !lines[2].disp, lines);
    check('words and bare math ("x = 3 or x = -2") stay words, not one garbled formula', !lines[1].disp, lines[1]);
    check('a single formula is still shown big', lines[3].disp && lines[4].disp, [lines[3], lines[4]]);
  }
  await c.close();

  // ---- phones: graph numbers and labels stay readable ----
  const [cp, ph] = await mk(390, 844, { serviceWorkers: 'block' }); await go(ph, '#/', 600);
  const sizes = await ph.evaluate(() => { const host = document.createElement('div'); host.style.cssText = 'width:330px'; document.body.appendChild(host); const D = App.boDraw; host.innerHTML = D.html(D.parse({ type: 'graph', fns: [{ f: 'x^2 - 3', label: 'y = x^2 - 3' }], x: [-4, 4] }), false); const px = sel => { const e = host.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height * 10) / 10 : 0; }; return { tick: px('.bd-tick'), lab: px('.bd-lab') }; });
  check('on a phone, a graph\'s numbers are at least about 9px tall and its labels bigger', sizes.tick >= 8.5 && sizes.lab >= sizes.tick, sizes);
  check('no sideways scroll', await hscroll(ph));
  await cp.close();
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
