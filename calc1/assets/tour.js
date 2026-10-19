/* ============================================================
   Mathub — the tour of the layout
   Coach marks on the start page for the frame every page shares: the
   clock and time bars, quick add, the sidebar's groups, the month
   calendar, the header, Your day and Bo. On a phone the sidebar is the
   menu, so the phone gets its own steps (the menu, search, Your day,
   the tab bar). Steps whose part is not on the screen are left out.
   A spotlight cuts a hole in a dim overlay around each part; Next, Back,
   Skip, arrow keys and Escape all work.
   Every account sees it once, people who took the older first-visit
   tour too: settings.tourLayout holds the version of the layout seen
   (synced with the account), and a new layout raises LAYOUT so everyone
   sees the tour again. Settings → "Show the tour again" replays it.
   Not in the apps, which have a layout of their own.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, settings, setSetting } = App;
  const LAYOUT = 1;   // the layout of 2026.10.18 (the sidebar and header on every page)
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const STEPS = [
    { sel: '#sb-now', wide: true, title: 'The time, and where you are in the term', text: 'Today’s date and a live clock: tap the time for clock faces and the time back home. The bars show how far you are through the semester, the month and the week.' },
    { sel: '#sb-quick', wide: true, title: 'Add anything, from any page', text: 'New opens one box for a task, an assignment, an exam, an event, a to-do or a class time; the small buttons go straight to one. Alt+N works anywhere.' },
    { sel: '#sb-nav', wide: true, title: 'Everything is in the sidebar', text: 'Your classes, with the days left until each exam, then School (tasks, timetable, calendar, projects), Life (habits, goals, journal, money), Future (internships and your portfolio) and Explore. Groups fold and stay the way you leave them.' },
    { sel: '#sb-cal', wide: true, title: 'Your month at a glance', text: 'Dots mark busy days and exams. Tap a day to see everything on it.' },
    { sel: '#topbar .topbar-actions', wide: true, title: 'The header, on every page', text: 'Your next exam, search (Ctrl K, or ⌘ K on a Mac), focus sounds, your streak and daily goal, and your account.' },
    { sel: '#topbar [data-action="menu"]', phone: true, title: 'Everything is in the menu', text: 'Your classes with the days until each exam, the planner pages, quick add, the month calendar, the clock and your streak.' },
    { sel: '#topbar .search-btn', phone: true, title: 'Search everything', text: 'Any topic, formula, flashcard, resource or page across all your classes.' },
    { sel: '#dash .dash-grid, #dash', title: 'Your day', text: 'Today’s classes, what is due, a pomodoro timer, to-dos, events, habits and goals. Customize picks the cards you want here.' },
    { sel: '#bo-fab', title: 'Bo, on every page', text: 'Ask him about whatever you are looking at: tap a question and he walks you through it. Part of Mathub Pro.' },
    { sel: '#tabbar', phone: true, title: 'Down here', text: 'Home, Today, the Focus room, the board and your account, one tap away.' },
    { sel: '#sb-hide', wide: true, title: 'Need more room?', text: 'Tuck the sidebar away here and the clock moves into the header. The menu button brings it back.' }
  ];
  const T = { i: 0, el: null, on: false, steps: [] };
  const phone = () => global.innerWidth <= 760;
  const visible = el => { if (!el || el.hidden) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const target = step => { for (const s of step.sel.split(',')) { const el = $(s.trim()); if (visible(el)) return el; } return null; };
  const seen = () => (+settings().tourLayout || 0) >= LAYOUT;
  const landing = () => location.hash.startsWith('#/') && !location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || location.hash === '' || location.hash === '#';
  function layout() {
    if (!T.on || !T.el) return; const step = T.steps[T.i]; const tg = target(step); const spot = $('.tour-spot', T.el); const card = $('.tour-card', T.el);
    card.classList.remove('above', 'side'); card.style.removeProperty('--tx');
    if (!tg) { const cw = Math.min(360, global.innerWidth - 24); spot.style.display = 'none'; card.style.width = cw + 'px'; card.style.top = Math.round(global.innerHeight * 0.2) + 'px'; card.style.left = Math.round((global.innerWidth - cw) / 2) + 'px'; return; }
    const tall = tg.offsetHeight > global.innerHeight * 0.55;
    tg.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'auto' });
    if (tall && !tg.closest('.sidebar')) global.scrollBy(0, -90);   // keep the sticky header out of the way
    setTimeout(() => {
      const vw = global.innerWidth, vh = global.innerHeight, pad = 8; const r = tg.getBoundingClientRect();
      const top = Math.max(4, r.top - pad), bottom = Math.min(vh - 4, r.bottom + pad);
      spot.style.display = 'block'; spot.style.left = (r.left - pad) + 'px'; spot.style.top = top + 'px'; spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = Math.max(0, bottom - top) + 'px';
      const cw = Math.min(360, vw - 24); card.style.transform = 'none'; card.style.width = cw + 'px';
      const ch = card.offsetHeight || 200;
      // a part of the sidebar: the card sits to its right
      if (r.right + 18 + cw < vw && r.left < vw * 0.3 && r.width < vw * 0.4) { card.classList.add('side'); card.style.left = (r.right + 18) + 'px'; card.style.top = Math.max(12, Math.min(vh - ch - 12, top)) + 'px'; return; }
      const below = bottom + 14 + ch < vh, above = top - 14 - ch > 0;
      if (below) card.style.top = (bottom + 14) + 'px'; else if (above) { card.style.top = (top - 14 - ch) + 'px'; card.classList.add('above'); } else { card.style.top = Math.max(12, vh - ch - 24) + 'px'; card.classList.add('above'); }
      const left = Math.max(12, Math.min(vw - cw - 12, r.left + r.width / 2 - cw / 2)); card.style.left = left + 'px';
      card.style.setProperty('--tx', Math.max(22, Math.min(cw - 22, r.left + r.width / 2 - left)) + 'px');   // the arrow points at the part
    }, 40);
  }
  let scrollT = null; function onScroll() { if (!T.on) return; clearTimeout(scrollT); scrollT = setTimeout(layout, 80); }
  function paint() {
    // a part that went away meanwhile (a panel closed, the screen turned) is left out
    while (T.steps.length > 1 && !target(T.steps[T.i])) { T.steps.splice(T.i, 1); if (T.i >= T.steps.length) T.i = T.steps.length - 1; $$('.tour-dots i', T.el).slice(T.steps.length).forEach(d => d.remove()); }
    const step = T.steps[T.i]; const card = $('.tour-card', T.el); const last = T.i === T.steps.length - 1;
    card.innerHTML = `<div class="tour-step">${esc(t('{1} of {2}', T.i + 1, T.steps.length))}</div><h3 id="tour-h">${esc(t(step.title))}</h3><p>${esc(t(step.text))}</p><div class="tour-btns"><button class="btn xs ghost" data-action="tour-skip">${esc(t('Skip'))}</button><span style="flex:1"></span>${T.i > 0 ? `<button class="btn xs" data-action="tour-back">${icon('left', 12)} ${esc(t('Back'))}</button>` : ''}<button class="btn xs primary" data-action="tour-next">${esc(t(last ? 'Done' : 'Next'))} ${icon(last ? 'check' : 'right', 12)}</button></div>`;
    $$('.tour-dots i', T.el).forEach((d, i) => d.classList.toggle('on', i <= T.i)); layout();
    const nx = $('[data-action="tour-next"]', card); if (nx) try { nx.focus({ preventScroll: true }); } catch (e) {}
  }
  function close() { T.on = false; if (T.el) T.el.remove(); T.el = null; document.removeEventListener('keydown', keys); global.removeEventListener('resize', layout); global.removeEventListener('scroll', onScroll, true); }
  /* done: the last step was reached; otherwise skipped or left. Either way it is not shown again (the older tour counts as seen too) */
  function stop(done) { if (!T.on) return; close(); setSetting('tourLayout', LAYOUT); setSetting('tourDone', true); if (done && App.toast) App.toast(`${icon('check', 14)} ${esc(t('That is the tour. Settings can show it again.'))}`, 3200); }
  /* something else needs the screen (the welcome): put the tour away without counting it as seen */
  function pause() { if (!T.on) return; close(); try { sessionStorage.removeItem('mh-tour'); } catch (e) {} }
  function keys(e) { if (e.key === 'Escape') { e.preventDefault(); stop(false); } else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); } }
  function next() { if (T.i >= T.steps.length - 1) return stop(true); T.i++; paint(); }
  function back() { if (T.i === 0) return; T.i--; paint(); }
  function start(force) {
    if (T.on || document.documentElement.hasAttribute('data-app')) return false;
    let tried = false; try { tried = !!sessionStorage.getItem('mh-tour'); } catch (e) {}
    if (!force && (seen() || tried)) return false;
    if (!landing()) return false;   // the start page only
    if ($('.modal-backdrop, .celebrate, #install-banner, #report-modal, #welcome, .pop, #paywall')) return false;
    const steps = STEPS.filter(s => (phone() ? !s.wide : !s.phone) && target(s));
    if (steps.length < 2) return false;
    try { sessionStorage.setItem('mh-tour', '1'); } catch (e) {}
    T.steps = steps; T.i = 0; T.on = true;
    const el = document.createElement('div'); el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tour-h');
    el.innerHTML = `<div class="tour-spot"></div><div class="tour-card"></div><div class="tour-dots" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</div>`; document.body.appendChild(el); T.el = el;
    el.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (!b) { if (e.target === el) stop(false); return; } const a = b.dataset.action; if (a === 'tour-next') next(); else if (a === 'tour-back') back(); else if (a === 'tour-skip') stop(false); });
    document.addEventListener('keydown', keys); global.addEventListener('resize', layout); global.addEventListener('scroll', onScroll, { passive: true, capture: true }); paint(); return true;
  }
  /* settings → "Show the tour again" */
  function replay() { setSetting('tourLayout', 0); try { sessionStorage.removeItem('mh-tour'); } catch (e) {} if (!landing()) location.hash = '#/'; setTimeout(() => start(true), 900); }
  App.tour = { start, stop, pause, replay, steps: STEPS, version: LAYOUT };
  global.addEventListener('hashchange', () => { if (T.on) stop(false); });
  // try once the start page is drawn, and again after each visit to it (the welcome or a dialog may be in the way at first)
  let wait = null; const later = () => { clearTimeout(wait); if (!T.on && !seen() && landing()) wait = setTimeout(() => start(false), 1600); };
  App.onRender = App.onRender || []; App.onRender.push(later);
  document.addEventListener('DOMContentLoaded', later);
})(window);
