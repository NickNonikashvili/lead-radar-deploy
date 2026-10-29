/* You always know whether your work is saved (assets/auth.js, Auth.net; the planner's hook in assets/life.js):
   - offline, a status line says so, and that what you do is kept on this device (a live region, role=status)
   - a class's progress and the planner changed while offline go up when the connection is back, and the line says
     "Back online · everything is synced", then goes away
   - a flaky network that never fires the browser's online event still recovers: the server is asked again on a timer
   - coming back does not stack the account check or its listeners, and does not redraw the page under your typing
   - signed out, offline: StudyCat keeps working with what is saved on this device
   - phone: the line fits beside the floating Bo button; axe finds nothing serious in it, by day and by night */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const AXE = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
(async () => {
  const { mk, go, login, api, check } = await T.start({});
  const line = p => p.evaluate(() => { const el = document.querySelector('#net-status'); const pill = el && el.querySelector('.net-pill'); return { text: pill ? pill.textContent.trim() : '', role: el ? el.getAttribute('role') : null, kind: el ? el.dataset.kind || '' : '' }; });
  const until = async (p, fn, ms = 9000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await p.waitForTimeout(200); } return v; };
  // count what Auth.init sets up: the minute-and-a-half account check and the online listeners
  const counters = c => c.addInitScript(() => { window.__iv = 0; window.__on = 0; const si = window.setInterval; window.setInterval = function (f, ms, ...a) { if (ms === 90000) window.__iv++; return si.call(this, f, ms, ...a); }; const ael = window.addEventListener; window.addEventListener = function (type, ...a) { if (type === 'online') window.__on++; return ael.call(this, type, ...a); }; });

  const [c, p] = await mk(1360, 860, { serviceWorkers: 'block' }); await counters(c);
  await go(p, '#/', 600); await login(p, 'alice.a@montana.edu'); await p.reload(); await p.waitForTimeout(1800);
  await p.evaluate(() => { location.hash = '#/calc'; }); await p.waitForTimeout(1500);
  check('online: no status line', (await line(p)).text === '');
  const set0 = await p.evaluate(() => ({ iv: window.__iv, on: window.__on }));

  // offline: say so; then change a class's progress and the planner
  await c.setOffline(true); await p.waitForTimeout(400);
  let L = await line(p);
  check('offline: a status line says so, and that what you do is kept on this device', /^You’re offline\. What you do is kept on this device and syncs when you’re back\.$/.test(L.text) && L.role === 'status' && L.kind === 'off', L);
  const mark = 'net-' + Date.now();
  await p.evaluate(m => { App.store.poke('calc', d => { d.netTest = m; }); App.life.add('tasks', { title: m, kind: 'task', course: 'calc', priority: 'medium' }); }, mark);
  await p.waitForTimeout(2600);
  check('the changes are waiting on this device', await p.evaluate(() => App.auth.net.pending()));
  // a probe input in the page, with focus and text: coming back must not redraw it away
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'probe'; i.setAttribute('aria-label', 'probe'); document.querySelector('#view').prepend(i); i.focus(); i.value = 'half a thought'; });

  await c.setOffline(false);
  L = await until(p, async () => { const x = await line(p); return /everything is synced/.test(x.text) ? x : null; });
  check('back online: what waited goes up, and the line says everything is synced', !!L && L.kind === 'done' && L.text === 'Back online · everything is synced.', L || await line(p));
  const server = (await api(p, 'data&course=calc')).json || {}; const life = (await api(p, 'life')).json || {};
  check('the class’s progress reached the account', server.data && server.data.netTest === mark, server.data && server.data.netTest);
  check('and so did the planner', ((life.life || {}).tasks || []).some(t => t && t.title === mark && !t.del));
  check('the page was not redrawn under your typing', await p.evaluate(() => { const i = document.querySelector('#probe'); return !!(i && i.isConnected && i.value === 'half a thought'); }));
  await p.waitForTimeout(3600);
  check('then the line goes away', (await line(p)).text === '');

  // a flaky network: the server stops answering, but the browser never says offline
  await p.evaluate(() => { App.auth.net.wait = 1200; document.querySelector('#probe').remove(); });
  await p.route('**/api/index.php?r=*', r => r.abort('connectionfailed'));
  await p.evaluate(() => App.store.poke('calc', d => { d.netTest2 = 1; })); await p.waitForTimeout(2400);
  L = await line(p); check('a save that cannot reach the server shows the line too', L.kind === 'off', L);
  await p.unroute('**/api/index.php?r=*');
  L = await until(p, async () => { const x = await line(p); return x.kind === 'done' ? x : null; }, 12000);
  check('and it recovers by itself, without the browser’s online event', !!L && /Back online/.test(L.text), L || await line(p));
  const set1 = await p.evaluate(() => ({ iv: window.__iv, on: window.__on }));
  check('coming back twice did not add another account check or online listener', set1.iv === set0.iv && set1.on === set0.on && set0.iv <= 1, { set0, set1 });
  await c.close();

  // signed out, offline
  const [c2, q] = await mk(1280, 800, { serviceWorkers: 'block' }); await go(q, '#/', 1500);
  await c2.setOffline(true); await q.waitForTimeout(400);
  check('signed out and offline: StudyCat keeps working with what is saved here', (await line(q)).text === 'You’re offline. StudyCat keeps working with what is saved on this device.', await line(q));
  await c2.setOffline(false); await q.waitForTimeout(500);
  check('and says when it is back', /^Back online\.$/.test((await line(q)).text), await line(q));
  await c2.close();

  // phone: beside the floating Bo button, inside the screen; axe by day and by night
  for (const scheme of ['light', 'dark']) {
    const [c3, m] = await mk(390, 844, { serviceWorkers: 'block', bypassCSP: true, colorScheme: scheme, reducedMotion: 'reduce', hasTouch: true });
    await go(m, '#/', 600); await login(m, 'alice.a@montana.edu'); await m.reload(); await m.waitForTimeout(1800);
    await c3.setOffline(true); await m.waitForTimeout(500);
    const box = await m.evaluate(() => { const r = document.querySelector('#net-status .net-pill').getBoundingClientRect(); const f = document.querySelector('.bf-fab'); const fr = f && f.offsetParent ? f.getBoundingClientRect() : null; return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight, fab: fr && { l: fr.left, t: fr.top, b: fr.bottom } }; });
    const clear = !box.fab || box.r <= box.fab.l || box.b <= box.fab.t || box.t >= box.fab.b;
    check(`phone (${scheme}): the line is on screen and clear of the floating Bo button`, box.l >= 0 && box.r <= box.w && box.b <= box.h && clear, box);
    await m.addScriptTag({ content: AXE });
    const v = await m.evaluate(async () => (await axe.run('#net-status', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id));
    check(`axe finds nothing serious in the line (${scheme})`, v.length === 0, v);
    await c3.setOffline(false); await c3.close();
  }
  await T.finish();
})();
