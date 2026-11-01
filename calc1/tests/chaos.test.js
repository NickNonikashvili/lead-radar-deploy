/* Chaos: StudyCat under faults, in the spirit of Netflix's Chaos Monkey (principlesofchaos.org) and gremlins.js.
   The steady state: every page shows something (never a blank page), nothing throws uncaught, nothing is left stuck
   on the screen (a page-change ghost, a hidden page, a spinner that never ends), and the page you see is the address
   you are at. Then faults, in small doses and seeded (CHAOS_SEED=<n> replays a run):
   - the account server fails: 500s, dropped and timed-out connections, garbled and slow replies; writes never reach
     the server (they fail, or are answered with a stand-in), so the test account is left as it was
   - a class's file, then a page's code, fails to load; once it is back, Try again brings the page; the math renderer's
     CDN is out of reach (StudyCat's own copy draws), then our copy is (the CDN is asked)
   - the browser's storage is garbled, then full (every write throws)
   - fast clicking around: page changes on top of page changes, Back and Forward, into and out of classes
   - a monkey (a visitor, writes blocked) clicks, types, scrolls and presses Escape at random on the busiest pages
   After each, the steady state must hold, and once the faults stop, the app is back to normal. */
const T = require('./lib');
const SEED = Number(process.env.CHAOS_SEED) || (Date.now() % 100000);
const rngOf = s => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rnd = rngOf(SEED);
const pick = a => a[Math.floor(rnd() * a.length)];
(async () => {
  const H = await T.start({});
  const { mk, go, login, check, log, errors } = H;
  log(`chaos seed ${SEED} (CHAOS_SEED=${SEED} replays it)`);
  const sleep = (p, ms) => p.waitForTimeout(ms);

  // every uncaught error on a page, kept apart from the console noise the faults themselves cause
  const watch = p => { const errs = []; p.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 220))); return errs; };
  // the console errors from failed requests are expected under chaos: keep them out of the run's error count
  const quiet = () => { for (let i = errors.length - 1; i >= 0; i--) if (/^CONSOLE /.test(errors[i])) errors.splice(i, 1); };
  // the steady state, as the page sees it
  const steady = p => p.evaluate(() => {
    const v = document.querySelector('.main > main#view') || document.querySelector('#view');
    const raw = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
    const C = window.Courses || {}; const name = !raw.length ? 'home' : C[raw[0]] ? (raw[1] || 'dashboard') : raw[0];
    const view = App.views && App.views[name];
    const matches = name === 'home' || !view || App.current === view || App.current === App.views.off || (C[raw[0]] && !C[raw[0]].loaded) || !App.current;
    return {
      hash: location.hash, text: v ? v.innerText.replace(/\s+/g, ' ').trim().length : 0, opacity: v ? getComputedStyle(v).opacity : '1',
      ghosts: document.querySelectorAll('.genie-ghost, .genie-under').length, stuck: ['genie-on', 'genie-hold'].filter(c => document.documentElement.classList.contains(c)),
      busy: Array.from(document.querySelectorAll('#view [aria-busy="true"]')).filter(e => e.offsetParent).length, matches, current: App.current ? App.current.title : null
    };
  });
  const holds = (s, extra) => s.text > 30 && s.opacity === '1' && !s.ghosts && !s.stuck.length && s.matches && (!extra || extra(s));

  /* ---------- 1. the account server fails (signed in) ---------- */
  {
    const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
    const errs = watch(p);
    await go(p, '#/', 600); await login(p, 'alice.a@montana.edu'); await p.reload(); await sleep(p, 1500);
    if (await p.$('.celebrate')) await p.keyboard.press('Escape');
    let chaos = true; const tally = { fail: 0, drop: 0, garble: 0, slow: 0, ok: 0, write: 0 };
    await p.route('**/api/index.php**', async route => {
      const req = route.request();
      if (!chaos) return route.continue().catch(() => {});
      if (req.method() !== 'GET') { tally.write++; const r = rnd(); if (r < 0.45) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"The server is busy. Try again in a moment."}' }); if (r < 0.75) return route.abort('failed'); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      const r = rnd();
      if (r < 0.22) { tally.fail++; return route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"Something went wrong on the server."}' }); }
      if (r < 0.36) { tally.drop++; return route.abort(rnd() < 0.5 ? 'failed' : 'timedout'); }
      if (r < 0.46) { tally.garble++; return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Bad gateway' }); }
      if (r < 0.60) { tally.slow++; await new Promise(res => setTimeout(res, 900 + rnd() * 1600)); return route.continue().catch(() => {}); }
      tally.ok++; return route.continue().catch(() => {});
    });
    const pages = ['#/', '#/calc/dashboard', '#/calc/notes', '#/calc/practice', '#/calc/flashcards', '#/calc/path', '#/calc/formulas', '#/calc/exam', '#/today', '#/plan', '#/tasks', '#/forum', '#/leagues', '#/settings', '#/customize', '#/tutor', '#/focus', '#/gpa', '#/recap', '#/whatsnew', '#/calls', '#/mistakes', '#/resources', '#/physics/dashboard'];
    const bad = [];
    for (const h of pages) {
      await p.evaluate(h => { location.hash = h; }, h); await sleep(p, 2600);
      if (await p.$('.celebrate')) await p.keyboard.press('Escape');
      const s = await steady(p); if (!holds(s)) bad.push(s);
    }
    check(`server failing at random (${JSON.stringify(tally)}): every page still shows itself, nothing stuck`, !bad.length, bad);
    check('and nothing threw', !errs.length, errs);
    // the faults stop: the next request goes through and the app says it is back
    chaos = false;
    await p.evaluate(() => { location.hash = '#/calc/dashboard'; }); await sleep(p, 1500);
    const back = await p.evaluate(async () => { try { await App.auth.prefsPull(); } catch (e) {} return { unreachable: !!App.auth.unreachable, user: !!(App.auth.user) }; });
    const s = await steady(p);
    check('once the server is back, StudyCat is signed in, reachable and on the page', back.user && !back.unreachable && holds(s), { back, s });
    // a list whose data will not come says so plainly, with Try again; when it is the connection, it asks again by itself once back online
    let deny = 'err';
    await p.route('**/api/index.php?r=forum_posts**', r => deny === 'err' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"Request failed."}' }) : deny === 'net' ? r.abort('failed') : r.continue().catch(() => {}));
    const fail = () => p.evaluate(() => { const f = document.querySelector('#view .fail-state'); return f ? { kind: f.dataset.fail, retry: !!f.querySelector('[data-fail-retry]'), text: f.innerText.replace(/\s+/g, ' ') } : null; });
    await p.evaluate(() => { location.hash = '#/forum'; }); await sleep(p, 1600);
    const f1 = await fail();
    check('a list that will not load says what happened, with Try again (not a dead end)', !!f1 && f1.kind === 'err' && f1.retry && /didn’t load/.test(f1.text), f1);
    deny = 'ok'; await p.click('#view [data-fail-retry]'); await sleep(p, 1600);
    check('Try again asks again, and the list comes', !(await fail()) && (await steady(p)).text > 100);
    deny = 'net'; await p.evaluate(() => App.rerender()); await sleep(p, 1600);
    const f2 = await fail();
    check('when it is the connection, it says you are offline and that it will load by itself', !!f2 && f2.kind === 'net' && /offline/i.test(f2.text), f2);
    deny = 'ok'; await p.evaluate(() => dispatchEvent(new Event('mathub-online'))); await sleep(p, 1600);
    check('and once StudyCat is back online, it loads by itself', !(await fail()) && (await steady(p)).text > 100);
    quiet(); await c.close();
  }

  /* ---------- 2. a class's file, then a page's code, fails to load; Try again brings it ---------- */
  {
    const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
    const errs = watch(p);
    await go(p, '#/', 800);
    await p.route('**/assets/physics-data.js*', r => r.abort('failed'));
    await p.evaluate(() => { location.hash = '#/physics/dashboard'; }); await sleep(p, 2500);
    const failed = await p.evaluate(() => ({ text: (document.querySelector('#view') || {}).innerText || '', retry: !!document.querySelector('#view [data-action="retry"]') }));
    check('a class whose file will not load says so, with Try again (not a blank page or a spinner forever)', failed.retry && failed.text.trim().length > 20, failed);
    await p.unroute('**/assets/physics-data.js*');
    await p.click('#view [data-action="retry"]'); await sleep(p, 2500);
    const s = await steady(p);
    check('once the file is back, Try again opens the class', holds(s) && /physics/.test(s.hash) && !(await p.$('#view .page-load')), s);
    await p.route('**/assets/changelog.js*', r => r.abort('failed'));
    await p.evaluate(() => { location.hash = '#/whatsnew'; }); await sleep(p, 1500);
    const lazy = await p.evaluate(() => ({ text: (document.querySelector('#view') || {}).innerText || '', retry: !!document.querySelector('#view [data-action="lazy-retry"]') }));
    check('a page whose code will not load says so, with Try again', lazy.retry && /could not load/i.test(lazy.text), lazy);
    await p.unroute('**/assets/changelog.js*');
    await p.click('#view [data-action="lazy-retry"]'); await sleep(p, 1500);
    const s2 = await steady(p);
    check('and Try again brings the page once it can', holds(s2) && !(await p.$('#view [data-action="lazy-retry"]')), s2);
    check('nothing threw while files failed', !errs.length, errs);
    quiet(); await c.close();
    // the math renderer: StudyCat's own copy draws the equations with the CDN out of reach; with our copy out of reach too, the CDN is asked
    const [c2, p2] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
    await p2.route('**/cdn.jsdelivr.net/**', r => r.abort('failed'));
    await go(p2, '#/calc/notes', 3500);
    const mj = await p2.evaluate(() => ({ drawn: document.querySelectorAll('#view mjx-container').length, raw: (document.querySelector('#view').innerText.match(/\$[^$\n]{1,60}\$/g) || []).length }));
    check('with the CDN blocked, the equations still draw (StudyCat ships its own MathJax)', mj.drawn >= 1 && mj.raw === 0, mj);
    await c2.close();
    const [c3, p3] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
    await p3.route('**/assets/vendor/mathjax/tex-svg.js', r => r.abort('failed'));
    await go(p3, '#/calc/notes', 1500);
    const fb = await p3.evaluate(() => Array.from(document.scripts).map(s => s.src).filter(s => /mathjax/.test(s)));
    check('with our copy out of reach, the CDN is asked instead', fb.some(s => /cdn\.jsdelivr\.net\/npm\/mathjax@3\.2\.2/.test(s)), fb);
    quiet(); await c3.close();
  }

  /* ---------- 3. storage garbled, then full ---------- */
  {
    const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
    const errs = watch(p);
    await c.addInitScript(() => {
      if (sessionStorage.getItem('chaos-garbled')) return; sessionStorage.setItem('chaos-garbled', '1');
      ['studyhub-settings', 'studyhub-progress-calc', 'studyhub-life', 'studyhub-scroll', 'studyhub-account-meta', 'studyhub-flash-calc', 'studyhub-home-grid'].forEach(k => localStorage.setItem(k, k.length % 2 ? '{broken' : '"a string, not an object"'));
    });
    const bad = [];
    for (const h of ['#/', '#/calc/dashboard', '#/calc/flashcards', '#/calc/practice', '#/today', '#/plan', '#/settings']) {
      await go(p, h, 1800); const s = await steady(p); if (!holds(s)) bad.push(s);
    }
    check('with the saved data garbled, every page still opens', !bad.length, bad);
    check('and nothing threw', !errs.length, errs);
    await c.close();
    const [c2, p2] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
    const errs2 = watch(p2);
    await go(p2, '#/', 800);
    await p2.evaluate(() => { const real = Storage.prototype.setItem; window.__realSet = real; Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); }; });
    const bad2 = [];
    for (const h of ['#/calc/dashboard', '#/calc/flashcards', '#/calc/practice', '#/today', '#/']) {
      await p2.evaluate(h => { location.hash = h; }, h); await sleep(p2, 1500);
      const b = await p2.$('#view button:not([disabled]):visible'); if (b) { try { await b.click({ timeout: 1500 }); } catch (e) {} await sleep(p2, 400); }
      const s = await steady(p2); if (!holds(s)) bad2.push(s);
    }
    try { await p2.click('.theme-btn', { timeout: 1500 }); } catch (e) {}
    await sleep(p2, 400);
    check('with storage full (every save throws), pages still open and buttons still work', !bad2.length, bad2);
    check('and nothing threw', !errs2.length, errs2);
    await c2.close();
  }

  /* ---------- 4. fast clicking around: page changes on top of page changes ---------- */
  {
    const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'no-preference' });
    const errs = watch(p);
    await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.motion = 'on'; s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });
    await go(p, '#/resources', 1200);
    const routes = ['#/resources', '#/calc/dashboard', '#/calc/notes', '#/calc/practice', '#/forum', '#/focus', '#/calc/flashcards', '#/today', '#/physics/dashboard', '#/precalc/notes', '#/gpa', '#/calc/path'];
    const site = H.base.replace(/#.*$/, ''); let left = 0;
    for (let i = 0; i < 70; i++) {
      const r = rnd();
      if (r < 0.15) { await p.goBack({ timeout: 2000 }).catch(() => {}); if (!p.url().startsWith(site)) { left++; await p.goForward({ timeout: 3000 }).catch(() => {}); if (!p.url().startsWith(site)) await go(p, '#/resources', 800); } }   // Back past the first page leaves the site, as it should: step back in
      else if (r < 0.25) await p.goForward({ timeout: 2000 }).catch(() => {});
      else await p.evaluate(h => { location.hash = h; }, pick(routes));
      await sleep(p, Math.floor(rnd() * 160));
    }
    await sleep(p, 2600); if (left) log(`(Back left the site ${left} time${left === 1 ? '' : 's'}; stepped back in)`);
    const s = await steady(p);
    check('after 70 page changes in quick succession (into and out of classes, Back, Forward): no ghost left, the page is the address', holds(s), s);
    check('and nothing threw', !errs.length, errs);
    await c.close();
  }

  /* ---------- 5. the monkey: random clicks, typing, scrolling and Escape on the busiest pages (a visitor; writes blocked) ---------- */
  {
    const [c, p] = await mk(1360, 900, { serviceWorkers: 'block', reducedMotion: 'reduce' });
    const errs = watch(p);
    await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} window.open = () => null; });
    await p.route('**/api/index.php**', route => route.request().method() === 'GET' ? route.continue().catch(() => {}) : route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"Writes are off in this test."}' }));
    const base = H.base.replace(/#.*$/, '');
    const NOT = /log ?out|sign ?out|delete|remove|reset|erase|wipe|clear|download|print|export|install|call bo|start (a )?call|microphone|record|share|language|English|Español|Русский|Français|Italiano|Português|Deutsch|admin/i;
    const pages = ['#/calc/dashboard', '#/calc/practice', '#/calc/flashcards', '#/calc/notes', '#/', '#/focus', '#/today', '#/calc/path', '#/plan', '#/customize'];
    const bad = []; let acts = 0;
    for (const h of pages) {
      await go(p, h, 1500);
      for (let i = 0; i < 30; i++) {
        if (!p.url().startsWith(base)) { await go(p, h, 1200); continue; }
        const r = rnd();
        try {
          if (r < 0.08) { await p.keyboard.press('Escape'); }
          else if (r < 0.14) { await p.mouse.wheel(0, Math.floor((rnd() - 0.3) * 1600)); }
          else {
            const n = await p.evaluate(NOT => {
              const re = new RegExp(NOT, 'i');
              const els = Array.from(document.querySelectorAll('button, a[href^="#/"], [role="button"], [role="tab"], summary, input[type="checkbox"], input[type="radio"], input[type="text"], input[type="number"], input:not([type]), textarea, select'))
                .filter(e => { const b = e.getBoundingClientRect(); if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight || e.disabled) return false; if (e.closest('#lang-top, .lang-menu, [data-chaos-skip], .acct-dd')) return false; const t = (e.innerText || e.value || e.getAttribute('aria-label') || e.title || '') + ' ' + (e.dataset.action || ''); return !re.test(t); });
              document.querySelectorAll('[data-monkey]').forEach(e => e.removeAttribute('data-monkey'));
              els.forEach((e, i) => e.setAttribute('data-monkey', i)); return els.length;
            }, NOT.source);
            if (!n) continue;
            const el = await p.$(`[data-monkey="${Math.floor(rnd() * n)}"]`); if (!el) continue;
            const tag = await el.evaluate(e => e.tagName + (e.type ? ':' + e.type : ''));
            if (/^(INPUT:(text|number|search|email)|TEXTAREA)/.test(tag) || tag === 'INPUT:') await el.fill(pick(['42', 'x^2+1', 'hello', '', '3/8', '<b>bold</b>', '-0.375', 'ü✓∞']), { timeout: 1200 });
            else if (/^SELECT/.test(tag)) { const opts = await el.evaluate(e => Array.from(e.options).map(o => o.value)); if (opts.length) await el.selectOption(pick(opts), { timeout: 1200 }); }
            else await el.click({ timeout: 1200 });
          }
          acts++;
        } catch (e) {}
        await sleep(p, 60 + Math.floor(rnd() * 120));
        if (i % 10 === 9) { const s = await steady(p).catch(() => null); if (s && !holds(s, x => x.text > 0) && !/^#\/?$/.test(s.hash)) bad.push(Object.assign({ at: h, step: i }, s)); }
      }
    }
    await go(p, '#/calc/dashboard', 1500);
    const s = await steady(p);
    check(`the monkey (${acts} random clicks, typing, scrolls and Escapes on ${pages.length} pages): every check of the page held`, !bad.length, bad.slice(0, 6));
    check('and nothing threw', !errs.length, errs.slice(0, 8));
    check('and afterwards the app still works: a class page opens', holds(s), s);
    quiet(); await c.close();
  }
  /* ---------- 6. the monkey on a phone, signed in (every write is answered with a failure, so the account is untouched) ---------- */
  {
    const [c, p] = await mk(390, 844, { serviceWorkers: 'block', reducedMotion: 'reduce', hasTouch: true });
    const errs = watch(p);
    await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.boFloatSeen = 1; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} window.open = () => null; });
    await go(p, '#/', 600); await login(p, 'alice.a@montana.edu');
    await p.route('**/api/index.php**', route => route.request().method() === 'GET' ? route.continue().catch(() => {}) : route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"Writes are off in this test."}' }));
    await p.reload(); await sleep(p, 1500); if (await p.$('.celebrate')) await p.keyboard.press('Escape');
    const base = H.base.replace(/#.*$/, '');
    const NOT = /log ?out|sign ?out|delete|remove|reset|erase|wipe|clear|download|print|export|install|call bo|start (a )?call|microphone|record|share|language|English|Español|Русский|Français|Italiano|Português|Deutsch|admin|unsubscribe|cancel (my )?plan|buy|checkout|upgrade|pay/i;
    const pages = ['#/', '#/calc/dashboard', '#/calc/practice', '#/calc/flashcards', '#/today', '#/tasks', '#/settings', '#/forum'];
    const bad = []; let acts = 0;
    for (const h of pages) {
      await go(p, h, 1500);
      for (let i = 0; i < 30; i++) {
        if (!p.url().startsWith(base)) { await go(p, h, 1200); continue; }
        const r = rnd();
        try {
          if (r < 0.08) await p.keyboard.press('Escape');
          else if (r < 0.16) await p.mouse.wheel(0, Math.floor((rnd() - 0.3) * 1400));
          else {
            const n = await p.evaluate(NOT => {
              const re = new RegExp(NOT, 'i');
              const els = Array.from(document.querySelectorAll('button, a[href^="#/"], [role="button"], [role="tab"], summary, input[type="checkbox"], input[type="text"], input:not([type]), textarea, select'))
                .filter(e => { const b = e.getBoundingClientRect(); if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight || e.disabled) return false; if (e.closest('#lang-top, .lang-menu, .acct-dd')) return false; const t = (e.innerText || e.value || e.getAttribute('aria-label') || e.title || '') + ' ' + (e.dataset.action || ''); return !re.test(t); });
              document.querySelectorAll('[data-monkey]').forEach(e => e.removeAttribute('data-monkey'));
              els.forEach((e, i) => e.setAttribute('data-monkey', i)); return els.length;
            }, NOT.source);
            if (!n) continue;
            const el = await p.$(`[data-monkey="${Math.floor(rnd() * n)}"]`); if (!el) continue;
            const tag = await el.evaluate(e => e.tagName + (e.type ? ':' + e.type : ''));
            if (/^(INPUT:(text|number|search|email)|TEXTAREA)/.test(tag) || tag === 'INPUT:') await el.fill(pick(['2', 'derivative', '', '1/2', 'ok']), { timeout: 1200 });
            else if (/^SELECT/.test(tag)) { const opts = await el.evaluate(e => Array.from(e.options).map(o => o.value)); if (opts.length) await el.selectOption(pick(opts), { timeout: 1200 }); }
            else await el.tap({ timeout: 1200 });
          }
          acts++;
        } catch (e) {}
        await sleep(p, 60 + Math.floor(rnd() * 120));
        if (i % 10 === 9) { const s = await steady(p).catch(() => null); if (s && !holds(s, x => x.text > 0)) bad.push(Object.assign({ at: h, step: i }, s)); }
      }
    }
    check(`the monkey on a phone, signed in (${acts} random taps, typing, scrolls): every check of the page held`, !bad.length, bad.slice(0, 6));
    check('and nothing threw', !errs.length, errs.slice(0, 8));
    const h = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check('and the page never got wider than the phone', h <= 1, h);
    quiet(); await c.close();
  }
  log(`chaos seed ${SEED}`);
  await T.finish();
})();
