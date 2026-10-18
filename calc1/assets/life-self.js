/* ============================================================
   Mathub — your planner, life and future pages (data: assets/life.js)
   #/habits     Habits: tick today, a week of squares, twelve weeks
                of history, day and week streaks
   #/goals      Goals: a few per quarter, each with steps to tick
   #/wheel      Wheel of life: eight parts of life scored 1-10 once a
                month, on a radar with last month behind it
   #/journal    Journal: a page a day (mood, what happened, three good
                things), a weekly reflection, every page searchable
   #/money      Money: what came in, what went out, budgets per
                category, six months at a glance
   #/career     Internships & jobs: applications from wishlist to offer
   #/portfolio  Portfolio: your best work on one printable page
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const L = App && App.life; if (!App || !L) return;
  const { $, $$, esc, icon, toast, settings, setSetting } = App;
  const Courses = global.Courses;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const tIso = () => L.today();
  const head = (title, sub, actions = '') => App.pageHead(esc(t(title)), sub ? esc(t(sub)) : '', actions);
  const empty = (ic, title, text, action = '') => `<div class="lf-empty">${icon(ic, 28)}<b>${esc(t(title))}</b><p>${esc(t(text))}</p>${action}</div>`;
  const keepScroll = fn => { const y = window.scrollY; fn(); window.scrollTo(0, y); };

  /* ======================================================
     HABITS
     ====================================================== */
  const HABIT_IC = [['repeat', 'Loop'], ['book', 'Book'], ['heart', 'Heart'], ['fire', 'Flame'], ['sun', 'Sun'], ['moon', 'Moon'], ['cards', 'Cards'], ['pen', 'Pen'], ['users', 'People'], ['phone', 'Phone'], ['timer', 'Timer'], ['smile', 'Smile']];
  const IDEAS = [['Read 20 minutes', 'book', 7], ['Work out', 'heart', 3], ['Review flashcards', 'cards', 7], ['In bed by midnight', 'moon', 7], ['Walk outside', 'sun', 5], ['Call home', 'phone', 2], ['No phone in class', 'timer', 5], ['Write in my journal', 'pen', 7]];
  const dayStreak = h => { const log = h.log || {}; let d = tIso(); if (!log[d]) d = L.addDaysISO(d, -1); let n = 0; while (log[d] && n < 4000) { n++; d = L.addDaysISO(d, -1); } return n; };
  const weekCount = (h, ws) => { const log = h.log || {}; let n = 0; for (let i = 0; i < 7; i++) if (log[L.addDaysISO(ws, i)]) n++; return n; };
  const weekStreak = h => { const target = h.target || 7; let ws = L.weekStart(tIso()); let n = weekCount(h, ws) >= target ? 1 : 0; ws = L.addDaysISO(ws, -7); let guard = 0; while (weekCount(h, ws) >= target && guard++ < 520) { n++; ws = L.addDaysISO(ws, -7); } return n; };
  const bestStreak = h => { const days = Object.keys(h.log || {}).filter(k => h.log[k]).sort(); let best = 0, run = 0, prev = null; days.forEach(d => { run = prev && L.addDaysISO(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }); return best; };
  L.habitStats = h => ({ day: dayStreak(h), week: weekStreak(h), best: bestStreak(h), thisWeek: weekCount(h, L.weekStart(tIso())) });
  L.toggleHabit = (id, iso = tIso()) => { const h = L.get('habits', id); if (!h) return; const log = Object.assign({}, h.log || {}); if (log[iso]) delete log[iso]; else log[iso] = 1; L.put('habits', id, { log }); return !!log[iso]; };
  const habitFields = () => [{ k: 'name', label: 'Habit', req: true, auto: true, max: 60, ph: 'Read 20 minutes' }, { k: 'target', label: 'Days a week', type: 'select', options: [7, 6, 5, 4, 3, 2, 1].map(n => [n, n === 7 ? 'Every day' : `${n} days a week`]), half: true }, { k: 'icon', label: 'Mark', type: 'select', options: HABIT_IC, half: true }];
  App.views.habits = {
    title: 'Habits', blurb: 'Small things, most days. Tick them off and watch the streak grow.',
    render(root) {
      root.innerHTML = `<div class="lf-page hb-page">${head('Habits', this.blurb, `<button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('New habit'))}</button>`)}<div id="hb-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      App.bind(root, {
        new: () => L.form({ title: 'New habit', icon: 'repeat', fields: habitFields(), values: { target: 7, icon: 'repeat' }, submit: 'Add', onSave: v => { L.add('habits', { name: v.name, target: +v.target || 7, icon: v.icon || 'repeat', log: {} }); paint(); } }),
        idea: el => { const [n, ic, tg] = IDEAS[+el.dataset.i]; L.add('habits', { name: t(n), target: tg, icon: ic, log: {} }); toast(t('Habit added')); paint(); },
        tick: el => { const on = L.toggleHabit(el.dataset.id, el.dataset.d || tIso()); if (on && (!el.dataset.d || el.dataset.d === tIso())) { const h = L.get('habits', el.dataset.id); const s = L.habitStats(h); toast(s.day > 1 ? t('{1} days in a row', s.day) : t('Done for today')); if (App.celebrate && s.day && s.day % 7 === 0) try { App.celebrate(); } catch (e) {} } paint(); },
        edit: el => { const h = L.get('habits', el.dataset.id); if (!h) return; L.form({ title: 'Edit habit', icon: 'pen', fields: habitFields().concat([{ k: 'archived', label: 'Pause it (hide from today)', type: 'check' }]), values: h, onSave: v => { L.put('habits', h.id, { name: v.name, target: +v.target || 7, icon: v.icon, archived: v.archived }); paint(); }, onDelete: () => { L.drop('habits', h.id, t('Habit deleted')); paint(); } }); }
      });
    },
    paint(root) {
      const all = L.all('habits'); const list = all.filter(h => !h.archived); const iso = tIso(); const ws = L.weekStart(iso); const body = $('#hb-body', root);
      if (!all.length) { body.innerHTML = `<div class="panel hb-ideas"><h2>${esc(t('Pick a first habit'))}</h2><p class="muted">${esc(t('Start with one or two. You can change them any time.'))}</p><div class="hb-idea-grid">${IDEAS.map(([n, ic, tg], i) => `<button class="hb-idea" type="button" data-action="idea" data-i="${i}">${icon(ic, 18)}<b>${esc(t(n))}</b><small>${esc(tg === 7 ? t('Every day') : t('{1} days a week', tg))}</small></button>`).join('')}</div></div>`; return; }
      const doneToday = list.filter(h => (h.log || {})[iso]).length;
      body.innerHTML = `<div class="panel hb-today"><div class="hb-today-h"><div><h2>${esc(t('Today'))}</h2><p class="muted">${esc(t('{1} of {2} done', doneToday, list.length))}</p></div><div class="sb-track hb-today-bar"><i style="width:${list.length ? Math.round(doneToday / list.length * 100) : 0}%"></i></div></div>
        <div class="hb-tiles">${list.map(h => { const on = !!(h.log || {})[iso]; const s = L.habitStats(h); return `<button class="hb-tile${on ? ' on' : ''}" type="button" data-action="tick" data-id="${esc(h.id)}" role="checkbox" aria-checked="${on}"><span class="hb-ic">${icon(on ? 'check' : h.icon || 'repeat', 20)}</span><b>${esc(h.name)}</b><small>${(h.target || 7) === 7 ? (s.day ? `${icon('fire', 12)} ${esc(t('{1} days', s.day))}` : esc(t('Start a streak'))) : esc(t('{1} of {2} this week', s.thisWeek, h.target))}</small></button>`; }).join('')}</div></div>
        <div class="hb-cards">${all.map(h => { const s = L.habitStats(h); const log = h.log || {}; const target = h.target || 7;
          const week = Array.from({ length: 7 }, (_, i) => { const d = L.addDaysISO(ws, i); const on = !!log[d]; const fut = d > iso; return `<button class="hb-sq${on ? ' on' : ''}${d === iso ? ' today' : ''}" type="button" ${fut ? 'disabled' : `data-action="tick" data-id="${esc(h.id)}" data-d="${d}"`} role="checkbox" aria-checked="${on}" aria-label="${esc(t(L.DOW_LONG[L.dowOf(d)]))}"><span>${esc(t(L.DOW[L.dowOf(d)]).slice(0, 2))}</span>${on ? icon('check', 12) : ''}</button>`; }).join('');
          const start = L.addDaysISO(ws, -77); const heat = Array.from({ length: 84 }, (_, i) => { const d = L.addDaysISO(start, i); return `<i class="${log[d] ? 'on' : ''}${d > iso ? ' fut' : ''}" title="${esc(App.shortDate(d))}"></i>`; }).join('');
          return `<article class="panel hb-card${h.archived ? ' paused' : ''}"><div class="hb-card-h"><span class="hb-ic">${icon(h.icon || 'repeat', 18)}</span><div><b>${esc(h.name)}</b><small>${esc(target === 7 ? t('Every day') : t('{1} days a week', target))}${h.archived ? ' · ' + esc(t('paused')) : ''}</small></div><button class="icon-btn" type="button" data-action="edit" data-id="${esc(h.id)}" aria-label="${esc(t('Edit'))}">${icon('pen', 14)}</button></div>
            <div class="hb-streaks"><span class="hb-st gold">${icon('fire', 14)}<b>${target === 7 ? s.day : s.week}</b><small>${esc(target === 7 ? t('day streak') : t('week streak'))}</small></span><span class="hb-st"><b>${s.best}</b><small>${esc(t('best run'))}</small></span><span class="hb-st"><b>${s.thisWeek}/${target}</b><small>${esc(t('this week'))}</small></span></div>
            <div class="hb-week">${week}</div><div class="hb-heat" aria-label="${esc(t('The last twelve weeks'))}">${heat}</div></article>`; }).join('')}</div>`;
    }
  };

  /* ======================================================
     WHEEL OF LIFE
     ====================================================== */
  const AREAS = [['health', 'Health & fitness'], ['mind', 'Mind & mood'], ['study', 'Studies'], ['career', 'Career'], ['money', 'Money'], ['family', 'Family'], ['friends', 'Friends & fun'], ['growth', 'Growth']];
  L.AREAS = AREAS;
  const monthKey = (iso = tIso()) => iso.slice(0, 7);
  const lastWheel = () => L.all('wheel').sort((a, b) => b.id.localeCompare(a.id))[0] || null;
  L.wheelNow = () => L.get('wheel', monthKey()) || lastWheel();
  L.radar = (scores, opts = {}) => {
    const S = opts.size || 300; const c = S / 2; const R = c - (opts.labels === false ? 8 : 52); const n = AREAS.length;
    const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * v / 10, c + Math.sin(a) * R * v / 10]; };
    const poly = sc => AREAS.map(([k], i) => pt(i, Math.max(0.3, +(sc || {})[k] || 0)).map(x => x.toFixed(1)).join(',')).join(' ');
    const rings = [2, 4, 6, 8, 10].map(v => `<polygon class="rd-ring" points="${AREAS.map((_, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ')}"/>`).join('');
    const spokes = AREAS.map((_, i) => { const [x, y] = pt(i, 10); return `<line class="rd-spoke" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
    const labels = opts.labels === false ? '' : AREAS.map(([k, l], i) => { const [x, y] = pt(i, 12.6); const anchor = Math.abs(x - c) < 4 ? 'middle' : x < c ? 'end' : 'start'; return `<text class="rd-label" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}">${esc(t(l))}<tspan class="rd-val" x="${x.toFixed(1)}" dy="15">${scores && scores[k] ? esc(String(scores[k])) : '–'}</tspan></text>`; }).join('');
    const dots = scores ? AREAS.map(([k], i) => { const [x, y] = pt(i, Math.max(0.3, +scores[k] || 0)); return `<circle class="rd-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${opts.labels === false ? 2.6 : 4}"/>`; }).join('') : '';
    return `<svg class="radar" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${esc(t('Wheel of life'))}: ${esc(AREAS.map(([k, l]) => `${t(l)} ${(scores || {})[k] || '–'}`).join(', '))}">${rings}${spokes}${opts.prev ? `<polygon class="rd-prev" points="${poly(opts.prev)}"/>` : ''}${scores ? `<polygon class="rd-area" points="${poly(scores)}"/>` : ''}${dots}${labels}</svg>`;
  };
  App.views.wheel = {
    title: 'Wheel of life', blurb: 'Score each part of your life from 1 to 10, once a month. The lowest one is where a goal helps most.',
    render(root) {
      root.innerHTML = `<div class="lf-page wl-page">${head('Wheel of life', this.blurb)}<div id="wl-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      root.addEventListener('input', e => { const r = e.target.closest('input[data-area]'); if (!r) return; const out = r.closest('.wl-row').querySelector('output'); if (out) out.textContent = r.value; const shown = {}; $$('input[data-area]', root).forEach(x => { shown[x.dataset.area] = +x.value; }); const cur = L.get('wheel', monthKey()) || { id: monthKey(), scores: shown }; const scores = Object.assign({}, shown, cur.scores, { [r.dataset.area]: +r.value }); /* the first score of a month keeps what the other sliders show */ clearTimeout(this.saveT); this.live = scores; const svg = $('#wl-radar', root); if (svg) svg.innerHTML = L.radar(scores, { prev: this.prev, size: 340 }); this.saveT = setTimeout(() => { if (L.get('wheel', monthKey())) L.put('wheel', monthKey(), { scores }); else L.add('wheel', { id: monthKey(), scores }); }, 500); });
      App.bind(root, { goal: el => { App.quickAddGoal({ area: el.dataset.area }); } });
    },
    paint(root) {
      const key = monthKey(); const cur = L.get('wheel', key); const hist = L.all('wheel').sort((a, b) => b.id.localeCompare(a.id)); const prevRec = hist.find(h => h.id < key) || null;
      const scores = cur ? cur.scores : (prevRec ? Object.assign({}, prevRec.scores) : null); this.prev = prevRec && cur ? prevRec.scores : null;
      const vals = scores ? AREAS.map(([k]) => +scores[k] || 0) : []; const avg = vals.length && vals.some(Boolean) ? (vals.reduce((a, b) => a + b, 0) / vals.filter(Boolean).length) : 0;
      const low = scores ? AREAS.filter(([k]) => scores[k]).sort((a, b) => scores[a[0]] - scores[b[0]])[0] : null;
      const [y, m] = key.split('-').map(Number);
      $('#wl-body', root).innerHTML = `<div class="wl-grid"><div class="panel wl-chart"><div class="lf-label-row">${icon('wheel', 15)} <b>${esc(L.monthName(m - 1))} ${y}</b>${prevRec && cur ? `<span class="wl-key"><i class="now"></i>${esc(t('this month'))} <i class="prev"></i>${esc(t('last time'))}</span>` : ''}</div><div id="wl-radar">${L.radar(scores, { prev: this.prev, size: 340 })}</div>${avg ? `<p class="wl-avg"><b>${avg.toFixed(1)}</b> ${esc(t('average'))}</p>` : ''}</div>
        <div class="panel wl-sliders"><div class="lf-label-row">${icon('sliders', 15)} <b>${esc(cur ? t('Your scores this month') : prevRec ? t('Start from last time, then move what changed') : t('How is each part of life going?'))}</b></div>${AREAS.map(([k, l]) => `<div class="wl-row"><label for="wl-${k}">${esc(t(l))}</label><input type="range" id="wl-${k}" data-area="${k}" min="1" max="10" step="1" value="${scores && scores[k] ? scores[k] : 5}"><output for="wl-${k}">${scores && scores[k] ? scores[k] : 5}</output></div>`).join('')}<p class="muted small">${esc(t('Saved as you move them. 1 is as bad as it gets, 10 is as good as it gets.'))}</p>
        ${low ? `<div class="wl-low"><span>${esc(t('Lowest right now: {1} ({2})', t(low[1]), scores[low[0]]))}</span><button class="btn sm primary" type="button" data-action="goal" data-area="${low[0]}">${icon('target', 13)} ${esc(t('Set a goal for it'))}</button></div>` : ''}</div></div>
        ${hist.length > 1 ? `<div class="panel mt-2"><div class="lf-label-row">${icon('chart', 15)} <b>${esc(t('Month by month'))}</b></div><div class="wl-hist">${hist.slice(0, 12).map(h => { const [yy, mm] = h.id.split('-').map(Number); const v = AREAS.map(([k]) => +h.scores[k] || 0).filter(Boolean); return `<div class="wl-h">${L.radar(h.scores, { size: 96, labels: false })}<b>${esc(L.monthName(mm - 1, true))} ${yy}</b><small>${v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'}</small></div>`; }).join('')}</div></div>` : ''}`;
    }
  };

  /* ======================================================
     GOALS
     ====================================================== */
  const qOf = iso => `${iso.slice(0, 4)}-Q${Math.floor((+iso.slice(5, 7) - 1) / 3) + 1}`;
  const Q_NAME = ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'];
  const goalPct = g => { const krs = g.krs || []; if (g.done) return 100; if (krs.length) return Math.round(krs.filter(k => k.done).length / krs.length * 100); return +g.progress || 0; };
  L.goalPct = goalPct; L.quarterOf = qOf;
  const goalFields = () => [{ k: 'title', label: 'Goal', req: true, auto: true, max: 120, ph: 'Get a B+ or better in Calculus I' }, { k: 'q', label: 'Quarter', type: 'select', options: (() => { const y = +tIso().slice(0, 4); const o = []; [y, y + 1].forEach(yy => [1, 2, 3, 4].forEach(q => o.push([`${yy}-Q${q}`, `Q${q} ${yy} · ${Q_NAME[q - 1]}`]))); return o; })(), half: true }, { k: 'area', label: 'Part of life', type: 'select', options: [['', 'None']].concat(AREAS), half: true }, { k: 'why', label: 'Why it matters', opt: true, max: 200 }, { k: 'krs', label: 'Steps, one per line', type: 'textarea', opt: true, rows: 4, ph: 'Do every WebWork on time\nGo to office hours twice\nScore 85% on Exam 2' }];
  const saveGoal = (v, id) => { const old = id ? L.get('goals', id) : null; const lines = String(v.krs || '').split('\n').map(x => x.trim()).filter(Boolean); const krs = lines.map(title => { const was = old && (old.krs || []).find(k => k.title === title); return { id: was ? was.id : L.uid(), title, done: was ? !!was.done : false }; }); const rec = { title: v.title, q: v.q, area: v.area || '', why: v.why || '', krs }; return id ? L.put('goals', id, rec) : L.add('goals', Object.assign(rec, { done: false, progress: 0 })); };
  App.quickAddGoal = (preset = {}) => L.form({ title: 'New goal', icon: 'target', fields: goalFields(), values: Object.assign({ q: qOf(tIso()) }, preset), submit: 'Add', onSave: v => { saveGoal(v); toast(t('Goal added')); if (App.current && App.current.repaint) App.current.repaint(); } });
  App.views.goals = {
    title: 'Goals', blurb: 'A few goals for each quarter, each broken into steps you can tick.',
    render(root) {
      this.year = this.year || +tIso().slice(0, 4);
      root.innerHTML = `<div class="lf-page gl-page">${head('Goals', this.blurb, `<span class="lf-seg-btns"><button type="button" data-action="year" data-d="-1" aria-label="${esc(t('Previous year'))}">${icon('left', 13)}</button><button type="button" class="on" id="gl-year" aria-live="polite">${this.year}</button><button type="button" data-action="year" data-d="1" aria-label="${esc(t('Next year'))}">${icon('right', 13)}</button></span><button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('New goal'))}</button>`)}<div id="gl-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      App.bind(root, { new: el => App.quickAddGoal({ q: el.dataset.q || qOf(tIso()) }), year: el => { this.year += +el.dataset.d; $('#gl-year', root).textContent = this.year; paint(); },
        kr: el => { const g = L.get('goals', el.dataset.g); if (!g) return; const krs = (g.krs || []).map(k => k.id === el.dataset.k ? Object.assign({}, k, { done: !k.done }) : k); L.put('goals', g.id, { krs }); if (krs.length && krs.every(k => k.done)) toast(t('Every step done. Nice work.')); paint(); },
        done: el => { const g = L.get('goals', el.dataset.g); if (!g) return; L.put('goals', g.id, { done: !g.done }); if (!g.done) toast(t('Goal reached')); paint(); },
        edit: el => { const g = L.get('goals', el.dataset.g); if (!g) return; L.form({ title: 'Edit goal', icon: 'pen', fields: goalFields(), values: Object.assign({}, g, { krs: (g.krs || []).map(k => k.title).join('\n') }), onSave: v => { saveGoal(v, g.id); paint(); }, onDelete: () => { L.drop('goals', g.id, t('Goal deleted')); paint(); } }); } });
    },
    paint(root) {
      const goals = L.all('goals'); const cur = qOf(tIso());
      $('#gl-body', root).innerHTML = `<div class="gl-quarters">${[1, 2, 3, 4].map(q => { const key = `${this.year}-Q${q}`; const list = goals.filter(g => g.q === key); const pc = list.length ? Math.round(list.reduce((n, g) => n + goalPct(g), 0) / list.length) : 0;
        return `<section class="panel gl-q${key === cur ? ' now' : ''}${key < cur ? ' past' : ''}"><div class="gl-q-h"><div><b>Q${q}</b><span>${esc(t(Q_NAME[q - 1]))}</span></div>${key === cur ? `<span class="lf-chip now">${esc(t('now'))}</span>` : ''}<span class="gl-q-pc">${list.length ? pc + '%' : ''}</span></div>${list.length ? `<div class="sb-track"><i style="width:${pc}%"></i></div>` : ''}
          ${list.map(g => { const p = goalPct(g); const area = AREAS.find(a => a[0] === g.area); return `<div class="gl-goal${g.done ? ' done' : ''}"><div class="gl-goal-h"><button class="tk-check" type="button" data-action="done" data-g="${esc(g.id)}" role="checkbox" aria-checked="${!!g.done}" aria-label="${esc(t('Goal reached'))}: ${esc(g.title)}">${icon('check', 13)}</button><button class="gl-goal-t" type="button" data-action="edit" data-g="${esc(g.id)}"><b>${esc(g.title)}</b>${area ? `<small>${esc(t(area[1]))}</small>` : ''}</button><span class="gl-pc">${p}%</span></div>${(g.krs || []).length ? `<ul class="gl-krs">${g.krs.map(k => `<li><button class="gl-kr${k.done ? ' on' : ''}" type="button" data-action="kr" data-g="${esc(g.id)}" data-k="${esc(k.id)}" role="checkbox" aria-checked="${!!k.done}">${icon(k.done ? 'check' : 'todo', 13)}<span>${esc(k.title)}</span></button></li>`).join('')}</ul>` : ''}</div>`; }).join('') || `<p class="muted small">${esc(t(key < cur ? 'No goals this quarter.' : 'No goals yet.'))}</p>`}
          ${key >= cur ? `<button class="btn sm ghost gl-add" type="button" data-action="new" data-q="${key}">${icon('plus', 13)} ${esc(t('Add a goal'))}</button>` : ''}</section>`; }).join('')}</div>`;
    }
  };

  /* ======================================================
     JOURNAL
     ====================================================== */
  const MOODS = [[1, 'Rough'], [2, 'Meh'], [3, 'Okay'], [4, 'Good'], [5, 'Great']];
  // a small drawn face per mood, from a deep frown to a wide smile
  const MOUTH = { 1: 'M8.5 16.5q3.5-3.2 7 0', 2: 'M8.8 16q3.2-1.4 6.4 0', 3: 'M9 15.2h6', 4: 'M8.8 14.4q3.2 2 6.4 0', 5: 'M8 13.6q4 4.4 8 0z' };
  const face = v => `<svg class="jr-face" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle class="e" cx="9" cy="10" r="1.1"/><circle class="e" cx="15" cy="10" r="1.1"/><path class="m${v === 5 ? ' open' : ''}" d="${MOUTH[v]}"/></svg>`;
  L.moodFace = face;
  const PROMPTS = ['What made today better than yesterday?', 'What did you learn today that surprised you?', 'What is one thing you are looking forward to?', 'Who helped you today, and how?', 'What would make tomorrow great?', 'What drained your energy today?', 'What are you proud of this week?'];
  const isoWeek = iso => (App.isoWeek ? App.isoWeek(App.parseISO(iso)) : iso);
  App.views.journal = {
    title: 'Journal', blurb: 'A page a day: how it went and three good things. Saved to your account; nobody else on Mathub sees it.',
    render(root) {
      this.day = this.day || tIso(); if (this.day > tIso()) this.day = tIso();
      root.innerHTML = `<div class="lf-page jr-page">${head('Journal', this.blurb)}
        <div class="dash-tabs" data-store="journalTab" role="tablist">${[['day', 'Today’s page', 'pen'], ['week', 'Weekly reflection', 'repeat'], ['all', 'Every page', 'book']].map(([k, l, ic]) => `<button class="tab" type="button" data-tab="${k}" role="tab">${icon(ic, 14)}<span>${esc(t(l))}</span></button>`).join('')}</div>
        <div class="panes"><div class="pane" data-pane="day" id="jr-day"></div><div class="pane" data-pane="week" id="jr-week"></div><div class="pane" data-pane="all" id="jr-all"></div></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      const saveDay = () => { const f = $('#jr-form', root); if (!f) return; const mood = +(($('input[name="mood"]:checked', f) || {}).value || 0); const rec = { mood, text: f.text.value, grat: [f.g1.value, f.g2.value, f.g3.value].map(x => x.trim()) }; const has = rec.mood || rec.text.trim() || rec.grat.some(Boolean); L.setDay('journal', this.day, has ? rec : null); const st = $('#jr-saved', root); if (st) { st.textContent = t('Saved'); clearTimeout(this.stT); this.stT = setTimeout(() => { st.textContent = ''; }, 1600); } };
      root.addEventListener('input', e => { if (e.target.closest('#jr-form')) { clearTimeout(this.saveT); this.saveT = setTimeout(saveDay, 700); } if (e.target.closest('#jr-wform')) { clearTimeout(this.wT); this.wT = setTimeout(() => this.saveWeek(root), 700); } if (e.target.id === 'jr-q') this.paintAll(root); });
      root.addEventListener('change', e => { if (e.target.name === 'mood') saveDay(); });
      App.bind(root, { 'day-prev': () => { saveDay(); this.day = L.addDaysISO(this.day, -1); this.paintDay(root); }, 'day-next': () => { saveDay(); if (this.day < tIso()) { this.day = L.addDaysISO(this.day, 1); this.paintDay(root); } }, 'day-today': () => { saveDay(); this.day = tIso(); this.paintDay(root); }, open: el => { this.day = el.dataset.d; const tb = $('.dash-tabs .tab[data-tab="day"]', root); if (tb) tb.click(); this.paintDay(root); window.scrollTo(0, 0); }, prompt: () => { const f = $('#jr-form', root); if (!f) return; const p = t(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]); f.text.value = (f.text.value.trim() ? f.text.value.trimEnd() + '\n\n' : '') + p + '\n'; f.text.focus(); f.text.setSelectionRange(f.text.value.length, f.text.value.length); saveDay(); } });
    },
    paint(root) { this.paintDay(root); this.paintWeek(root); this.paintAll(root); },
    paintDay(root) {
      const d = this.day; const rec = L.day('journal', d) || {}; const g = rec.grat || [];
      const days = L.days('journal'); let streak = 0; { let x = tIso(); if (!L.day('journal', x)) x = L.addDaysISO(x, -1); while (L.day('journal', x) && streak < 2000) { streak++; x = L.addDaysISO(x, -1); } }
      $('#jr-day', root).innerHTML = `<form class="panel jr-sheet" id="jr-form" autocomplete="off" onsubmit="return false"><div class="jr-date"><button class="icon-btn" type="button" data-action="day-prev" aria-label="${esc(t('The day before'))}">${icon('left', 14)}</button><div><b>${esc(L.relDay(d))}</b><span>${esc(App.fmtDate(d, true))}</span></div><button class="icon-btn" type="button" data-action="day-next" aria-label="${esc(t('The day after'))}" ${d >= tIso() ? 'disabled' : ''}>${icon('right', 14)}</button>${d !== tIso() ? `<button class="btn sm" type="button" data-action="day-today">${esc(t('Today'))}</button>` : ''}<span class="jr-meta">${streak > 1 ? `<span class="lf-chip gold">${icon('fire', 12)} ${esc(t('{1} days in a row', streak))}</span>` : ''}<span class="muted small" id="jr-saved" aria-live="polite"></span></span></div>
        <fieldset class="jr-moods"><legend>${esc(t('How was it?'))}</legend>${MOODS.map(([v, l]) => `<label class="jr-mood m${v}"><input type="radio" name="mood" value="${v}"${rec.mood === v ? ' checked' : ''}><span>${face(v)}${esc(t(l))}</span></label>`).join('')}</fieldset>
        <label class="lf-label" for="jr-text">${esc(t('What happened'))}</label><textarea id="jr-text" name="text" rows="9" placeholder="${esc(t('Write anything. A sentence is enough.'))}">${esc(rec.text || '')}</textarea><button class="btn sm ghost jr-prompt" type="button" data-action="prompt">${icon('bulb', 13)} ${esc(t('Give me a question'))}</button>
        <div class="jr-grat"><span class="lf-label">${esc(t('Three good things'))}</span>${[0, 1, 2].map(i => `<div class="jr-g"><b>${i + 1}</b><input name="g${i + 1}" maxlength="140" value="${esc(g[i] || '')}" aria-label="${esc(t('Good thing {1}', i + 1))}"></div>`).join('')}</div></form>
        ${days.length ? `<p class="muted small mt-1">${esc(t('{1} pages so far.', days.length))}</p>` : ''}`;
    },
    saveWeek(root) { const f = $('#jr-wform', root); if (!f) return; const id = isoWeek(tIso()); const rec = { well: f.well.value, hard: f.hard.value, change: f.change.value, learned: f.learned.value }; if (L.get('reflect', id)) L.put('reflect', id, rec); else L.add('reflect', Object.assign({ id }, rec)); const st = $('#jr-wsaved', root); if (st) { st.textContent = t('Saved'); setTimeout(() => { st.textContent = ''; }, 1600); } },
    paintWeek(root) {
      const id = isoWeek(tIso()); const rec = L.get('reflect', id) || {}; const ws = L.weekStart(tIso());
      const tasksDone = L.all('tasks').filter(x => x.status === 'done' && (x.doneAt || 0) >= App.parseISO(ws).getTime()).length;
      const mins = L.all('timelog').filter(x => x.date >= ws).reduce((n, x) => n + x.mins, 0) + Array.from({ length: 7 }, (_, i) => (settings().focusLog || {})[L.addDaysISO(ws, i)] || 0).reduce((a, b) => a + b, 0);
      const habitTicks = L.all('habits').reduce((n, h) => n + Array.from({ length: 7 }, (_, i) => (h.log || {})[L.addDaysISO(ws, i)] ? 1 : 0).reduce((a, b) => a + b, 0), 0);
      const moods = Array.from({ length: 7 }, (_, i) => (L.day('journal', L.addDaysISO(ws, i)) || {}).mood || 0).filter(Boolean);
      const past = L.all('reflect').filter(r => r.id !== id).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);
      $('#jr-week', root).innerHTML = `<div class="lf-stats">${[[tasksDone, 'tasks done', 'check'], [L.fmtDur ? L.fmtDur(mins) : mins + ' min', 'studied', 'timer'], [habitTicks, 'habit ticks', 'repeat'], [moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) + ' / 5' : '–', 'average mood', 'smile']].map(([n, l, ic]) => `<div class="lf-stat"><span class="lf-stat-ic">${icon(ic, 16)}</span><b>${esc(String(n))}</b><span>${esc(t(l))}</span></div>`).join('')}</div>
        <form class="panel jr-sheet" id="jr-wform" onsubmit="return false"><div class="jr-date"><div><b>${esc(t('This week'))}</b><span>${esc(App.shortDate(ws))} – ${esc(App.shortDate(L.addDaysISO(ws, 6)))}</span></div><span class="jr-meta muted small" id="jr-wsaved" aria-live="polite"></span></div>
          ${[['well', 'What went well?'], ['hard', 'What was hard?'], ['change', 'What will you do differently next week?'], ['learned', 'What did you learn about yourself?']].map(([k, q]) => `<label class="lf-label" for="jr-w-${k}">${esc(t(q))}</label><textarea id="jr-w-${k}" name="${k}" rows="3">${esc(rec[k] || '')}</textarea>`).join('')}</form>
        ${past.length ? `<div class="panel mt-2"><div class="lf-label-row">${icon('repeat', 15)} <b>${esc(t('Earlier weeks'))}</b></div>${past.map(r => `<details class="jr-past"><summary>${esc(r.id.replace('-W', ' · ' + t('week') + ' '))}</summary>${[['well', 'Went well'], ['hard', 'Was hard'], ['change', 'Do differently'], ['learned', 'Learned']].filter(([k]) => r[k]).map(([k, l]) => `<p><b>${esc(t(l))}:</b> ${esc(r[k])}</p>`).join('')}</details>`).join('')}</div>` : ''}`;
    },
    paintAll(root) {
      const box = $('#jr-all', root); const q = ($('#jr-q', root) || {}).value || ''; const days = L.days('journal').reverse();
      const hit = days.filter(d => !q || [(d.text || ''), ...(d.grat || [])].join(' ').toLowerCase().includes(q.toLowerCase()));
      const last30 = Array.from({ length: 30 }, (_, i) => { const d = L.addDaysISO(tIso(), i - 29); const r = L.day('journal', d); return `<i class="m${r && r.mood ? r.mood : 0}" style="height:${r && r.mood ? r.mood * 20 : 6}%" title="${esc(App.shortDate(d))}${r && r.mood ? ' · ' + esc(t(MOODS[r.mood - 1][1])) : ''}"></i>`; }).join('');
      const keepQ = document.activeElement && document.activeElement.id === 'jr-q';
      const list = hit.length ? `<div class="jr-list">${hit.slice(0, 120).map(d => `<button class="jr-row" type="button" data-action="open" data-d="${esc(d.key)}"><span class="jr-dot m${d.mood || 0}"></span><span class="jr-row-d"><b>${esc(App.shortDate(d.key))}</b><small>${esc(t(L.DOW[L.dowOf(d.key)]))}</small></span><span class="jr-row-t">${esc((d.text || (d.grat || []).filter(Boolean).join(' · ') || '').slice(0, 140))}</span></button>`).join('')}</div>` : (days.length ? `<p class="muted">${esc(t('No page has those words.'))}</p>` : empty('book', 'No pages yet', 'Write your first page today. One sentence is a good start.'));
      if (keepQ) { const holder = $('#jr-results', box); if (holder) holder.innerHTML = list; return; }
      box.innerHTML = `<div class="panel jr-moodchart"><div class="lf-label-row">${icon('smile', 15)} <b>${esc(t('Mood, last 30 days'))}</b></div><div class="jr-bars">${last30}</div></div><div class="lf-search"><span>${icon('search', 15)}</span><input id="jr-q" type="search" placeholder="${esc(t('Search your pages'))}" aria-label="${esc(t('Search your pages'))}" value="${esc(q)}"></div><div id="jr-results">${list}</div>`;
    }
  };

  /* ======================================================
     MONEY
     ====================================================== */
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'MXN', 'BRL', 'RUB', 'UAH', 'GEL', 'KZT', 'TRY', 'INR', 'CNY', 'JPY', 'KRW', 'NGN', 'AUD'];
  const money = (n, cur) => { cur = cur || L.cfg('currency', 'USD'); try { return new Intl.NumberFormat(App.lang === 'en' ? 'en-US' : App.lang, { style: 'currency', currency: cur, maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 }).format(n); } catch (e) { return `${cur} ${n.toFixed(2)}`; } };
  L.money = money;
  App.views.money = {
    title: 'Money', blurb: 'What came in, what went out, and how much is left this month.',
    render(root) {
      this.month = this.month || tIso().slice(0, 7);
      const cur = L.cfg('currency', 'USD');
      root.innerHTML = `<div class="lf-page mn-page">${head('Money', this.blurb, `<label class="mn-cur"><span class="sr-only">${esc(t('Currency'))}</span><select id="mn-cur" aria-label="${esc(t('Currency'))}">${CURRENCIES.map(c => `<option${c === cur ? ' selected' : ''}>${c}</option>`).join('')}</select></label><button class="btn" type="button" data-action="budgets">${icon('pie', 14)} ${esc(t('Budgets'))}</button><button class="btn primary" type="button" data-action="add">${icon('plus', 14)} ${esc(t('Add'))}</button>`)}<div id="mn-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      $('#mn-cur', root).addEventListener('change', e => { L.setCfg('currency', e.target.value); paint(); });
      App.bind(root, { add: el => App.quickAdd('money', { type: el.dataset.type || 'out', date: this.month === tIso().slice(0, 7) ? tIso() : this.month + '-01' }), prev: () => { const [y, m] = this.month.split('-').map(Number); this.month = App.toISO(new Date(y, m - 2, 1)).slice(0, 7); paint(); }, next: () => { const [y, m] = this.month.split('-').map(Number); this.month = App.toISO(new Date(y, m, 1)).slice(0, 7); paint(); },
        tx: el => { const x = L.get('tx', el.dataset.id); if (!x) return; L.form({ title: 'Edit', icon: 'wallet', fields: L.txFields(x.type), values: x, onSave: v => { L.put('tx', x.id, { type: v.type, amount: Math.round(Math.abs(v.amount) * 100) / 100, date: v.date, cat: v.cat, note: v.note }); paint(); }, onDelete: () => { L.drop('tx', x.id, t('Deleted')); paint(); } }); },
        budgets: () => { const b = (L.rec('budgets').cats) || {}; L.form({ title: 'Monthly budgets', icon: 'pie', fields: L.SPEND.map((c, i) => ({ k: 'b' + i, label: c, type: 'number', min: 0, opt: true, half: true, ph: '0' })), values: Object.fromEntries(L.SPEND.map((c, i) => ['b' + i, b[c] || ''])), onSave: v => { const cats = {}; L.SPEND.forEach((c, i) => { if (v['b' + i] > 0) cats[c] = v['b' + i]; }); L.setRec('budgets', { cats }); toast(t('Budgets saved')); paint(); } }); } });
    },
    paint(root) {
      const all = L.all('tx'); const mo = this.month; const list = all.filter(x => (x.date || '').slice(0, 7) === mo).sort((a, b) => b.date.localeCompare(a.date) || (b.c || 0) - (a.c || 0));
      const inn = list.filter(x => x.type === 'in').reduce((n, x) => n + x.amount, 0), out = list.filter(x => x.type !== 'in').reduce((n, x) => n + x.amount, 0); const left = inn - out;
      const budgets = (L.rec('budgets').cats) || {}; const btotal = Object.values(budgets).reduce((a, b) => a + (+b || 0), 0); const bspent = list.filter(x => x.type !== 'in' && budgets[x.cat || 'Other']).reduce((n, x) => n + x.amount, 0);   // only the categories with a budget count against it
      const byCat = {}; list.filter(x => x.type !== 'in').forEach(x => { byCat[x.cat || 'Other'] = (byCat[x.cat || 'Other'] || 0) + x.amount; });
      const cats = [...new Set(Object.keys(byCat).concat(Object.keys(budgets)))].sort((a, b) => (byCat[b] || 0) - (byCat[a] || 0)); const catMax = Math.max(1, ...cats.map(c => Math.max(byCat[c] || 0, budgets[c] || 0)));
      const [y, m] = mo.split('-').map(Number);
      const six = Array.from({ length: 6 }, (_, i) => App.toISO(new Date(y, m - 6 + i, 1)).slice(0, 7)); const sixVals = six.map(k => { const l2 = all.filter(x => (x.date || '').slice(0, 7) === k); return { k, inn: l2.filter(x => x.type === 'in').reduce((n, x) => n + x.amount, 0), out: l2.filter(x => x.type !== 'in').reduce((n, x) => n + x.amount, 0) }; }); const sixMax = Math.max(1, ...sixVals.map(v => Math.max(v.inn, v.out)));
      const isNow = mo === tIso().slice(0, 7); const dim = new Date(y, m, 0).getDate(); const dayN = isNow ? +tIso().slice(8, 10) : dim;
      $('#mn-body', root).innerHTML = `<div class="ag-bar"><button class="icon-btn" type="button" data-action="prev" aria-label="${esc(t('Previous month'))}">${icon('left', 15)}</button><h2>${esc(L.monthName(m - 1))} ${y}</h2><button class="icon-btn" type="button" data-action="next" aria-label="${esc(t('Next month'))}">${icon('right', 15)}</button></div>
        <div class="lf-stats">${[[money(inn), 'Came in', 'good', 'download'], [money(out), 'Went out', '', 'upload'], [money(left), left < 0 ? 'Short this month' : 'Left', left < 0 ? 'warn' : 'good', 'wallet'], btotal ? [money(btotal - bspent), btotal - bspent < 0 ? 'Over budget' : 'Budget left', btotal - bspent < 0 ? 'warn' : '', 'pie'] : [isNow && dayN ? money(out / dayN) : money(out / dim), 'A day on average', '', 'chart']].map(([n, l, c, ic]) => `<div class="lf-stat ${c}"><span class="lf-stat-ic">${icon(ic, 16)}</span><b>${esc(n)}</b><span>${esc(t(l))}</span></div>`).join('')}</div>
        <div class="grid cols-2 mt-2"><div class="panel"><div class="lf-label-row">${icon('pie', 15)} <b>${esc(t('Where it went'))}</b>${btotal ? '' : `<button class="btn sm ghost" type="button" data-action="budgets">${esc(t('Set budgets'))}</button>`}</div>${cats.length ? cats.map(c => { const s = byCat[c] || 0, b = +budgets[c] || 0; const over = b && s > b; return `<div class="mn-cat${over ? ' over' : ''}"><span>${esc(t(c))}</span><div class="mn-track"><i style="width:${Math.round(s / catMax * 100)}%"></i>${b ? `<em style="left:${Math.min(100, Math.round(b / catMax * 100))}%" title="${esc(t('Budget'))}"></em>` : ''}</div><b>${esc(money(s))}${b ? `<small> / ${esc(money(b))}</small>` : ''}</b></div>`; }).join('') : `<p class="muted small">${esc(t('Nothing spent this month yet.'))}</p>`}</div>
        <div class="panel"><div class="lf-label-row">${icon('chart', 15)} <b>${esc(t('Six months'))}</b><span class="mn-key"><i class="in"></i>${esc(t('in'))} <i class="out"></i>${esc(t('out'))}</span></div><div class="mn-six">${sixVals.map(v => { const [yy, mm] = v.k.split('-').map(Number); void yy; return `<div class="mn-m${v.k === mo ? ' sel' : ''}"><div class="mn-bars"><i class="in" style="height:${Math.round(v.inn / sixMax * 100)}%" title="${esc(money(v.inn))}"></i><i class="out" style="height:${Math.round(v.out / sixMax * 100)}%" title="${esc(money(v.out))}"></i></div><b>${esc(L.monthName(mm - 1, true))}</b></div>`; }).join('')}</div></div></div>
        <div class="panel mt-2"><div class="lf-label-row">${icon('list', 15)} <b>${esc(t('This month'))}</b><span class="row gap-sm"><button class="btn sm" type="button" data-action="add" data-type="in">${icon('plus', 12)} ${esc(t('Money in'))}</button><button class="btn sm" type="button" data-action="add" data-type="out">${icon('plus', 12)} ${esc(t('Spending'))}</button></span></div>${list.length ? `<div class="mn-list">${list.map(x => `<button class="mn-row" type="button" data-action="tx" data-id="${esc(x.id)}"><span class="mn-d">${esc(App.shortDate(x.date))}</span><span class="lf-chip">${esc(t(x.cat || 'Other'))}</span><span class="mn-note">${esc(x.note || '')}</span><b class="${x.type === 'in' ? 'in' : 'out'}">${x.type === 'in' ? '+' : '−'}${esc(money(x.amount))}</b></button>`).join('')}</div>` : `<p class="muted small">${esc(t('Add what you spend as you go; it takes five seconds.'))}</p>`}</div>`;
    }
  };

  /* ======================================================
     INTERNSHIPS & JOBS
     ====================================================== */
  const STAGES = [['wish', 'Wishlist'], ['applied', 'Applied'], ['interview', 'Interview'], ['offer', 'Offer'], ['rejected', 'Not this time']];
  const APP_KIND = [['internship', 'Internship'], ['job', 'Job'], ['research', 'Research'], ['scholarship', 'Scholarship'], ['grad', 'Grad school'], ['other', 'Other']];
  const appFields = () => [{ k: 'company', label: 'Where', req: true, auto: true, max: 80, ph: 'Boeing' }, { k: 'role', label: 'Role', max: 100, ph: 'Software engineering intern', opt: true }, { k: 'kind', label: 'Kind', type: 'select', options: APP_KIND, half: true }, { k: 'status', label: 'Stage', type: 'select', options: STAGES, half: true }, { k: 'deadline', label: 'Deadline', type: 'date', half: true, opt: true }, { k: 'next', label: 'Next date (interview, follow-up)', type: 'date', half: true, opt: true }, { k: 'link', label: 'Link to the posting', type: 'url', opt: true, ph: 'https://' }, { k: 'contact', label: 'Contact', opt: true, max: 100, ph: 'Recruiter name or email' }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, opt: true }];
  App.views.career = {
    title: 'Internships & jobs', blurb: 'Every application in one place, from the wishlist to the offer.',
    render(root) {
      root.innerHTML = `<div class="lf-page cr-page">${head('Internships & jobs', this.blurb, `<a class="btn" href="#/portfolio">${icon('star', 14)} ${esc(t('Your portfolio'))}</a><button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('New application'))}</button>`)}<div id="cr-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      App.bind(root, { new: el => L.form({ title: 'New application', icon: 'briefcase', fields: appFields(), values: { kind: 'internship', status: el.dataset.st || 'wish' }, submit: 'Add', onSave: v => { L.add('apps', Object.assign({}, v, { link: /^https?:\/\//i.test(v.link) ? v.link : '' })); paint(); } }),
        open: el => { const a = L.get('apps', el.dataset.id); if (!a) return; L.form({ title: 'Application', icon: 'briefcase', fields: appFields(), values: a, onSave: v => { L.put('apps', a.id, Object.assign({}, v, { link: /^https?:\/\//i.test(v.link) ? v.link : '' })); paint(); }, onDelete: () => { L.drop('apps', a.id, t('Application deleted')); paint(); } }); },
        move: el => { const a = L.get('apps', el.dataset.id); if (!a) return; L.put('apps', a.id, { status: el.dataset.to }); if (el.dataset.to === 'offer') toast(t('An offer. Congratulations!')); paint(); } });
      let drag = null;
      root.addEventListener('dragstart', e => { const c = e.target.closest('.kb-card'); if (c) { drag = c.dataset.id; try { e.dataTransfer.setData('text/plain', drag); } catch (x) {} } });
      root.addEventListener('dragover', e => { const z = e.target.closest('.kb-drop'); if (z && drag) { e.preventDefault(); z.classList.add('over'); } });
      root.addEventListener('dragleave', e => { const z = e.target.closest('.kb-drop'); if (z) z.classList.remove('over'); });
      root.addEventListener('drop', e => { const z = e.target.closest('.kb-drop'); if (!z || !drag) return; e.preventDefault(); L.put('apps', drag, { status: z.dataset.drop }); drag = null; paint(); });
    },
    paint(root) {
      const apps = L.all('apps'); const today = tIso();
      if (!apps.length) { $('#cr-body', root).innerHTML = `<div class="panel cr-start"><div class="tt-start-in">${icon('briefcase', 34)}<div><h2>${esc(t('Track your applications'))}</h2><p>${esc(t('Add the internships, jobs, research spots and scholarships you want. Move each one along as you hear back, and never miss a deadline: they show up in your calendar.'))}</p><div class="row gap-sm mt-2" style="flex-wrap:wrap"><button class="btn primary" type="button" data-action="new">${icon('plus', 14)} ${esc(t('Add the first one'))}</button><a class="btn" href="#/portfolio">${icon('star', 14)} ${esc(t('Build your portfolio'))}</a></div></div></div></div>`; return; }
      const soon = apps.filter(a => (a.deadline && a.deadline >= today && ['wish'].includes(a.status)) || (a.next && a.next >= today)).map(a => ({ a, d: a.status === 'wish' ? a.deadline : a.next || a.deadline })).filter(x => x.d).sort((x, y) => x.d.localeCompare(y.d)).slice(0, 5);
      const col = (st, label) => { const list = apps.filter(a => (a.status || 'wish') === st).sort((x, y) => (x.deadline || '9').localeCompare(y.deadline || '9')); const i = STAGES.findIndex(s => s[0] === st);
        return `<div class="kb-col cr-${st}" data-status="${st}"><div class="kb-h"><b>${esc(t(label))}</b><small>${list.length}</small></div><div class="kb-drop" data-drop="${st}">${list.map(a => { const left = a.deadline ? App.daysBetween(today, a.deadline) : null; return `<div class="kb-card" draggable="true" data-id="${esc(a.id)}"><button class="kb-open" type="button" data-action="open" data-id="${esc(a.id)}"><span class="tk-title">${esc(a.company)}</span>${a.role ? `<span class="cr-role">${esc(a.role)}</span>` : ''}<span class="tk-meta"><span class="lf-chip">${esc(t((APP_KIND.find(k => k[0] === a.kind) || ['', 'Other'])[1]))}</span>${left != null && st === 'wish' ? `<span class="tk-due${left < 0 ? ' late' : left <= 7 ? ' soon' : ''}">${esc(left < 0 ? t('closed') : left === 0 ? t('due today') : t('{1} days left', left))}</span>` : ''}${a.next && a.next >= today ? `<span class="tk-due">${esc(t('next: {1}', L.relDay(a.next)))}</span>` : ''}</span></button><span class="kb-move">${i > 0 ? `<button class="icon-btn xs" type="button" data-action="move" data-id="${esc(a.id)}" data-to="${STAGES[i - 1][0]}" aria-label="${esc(t('Move back'))}">${icon('left', 12)}</button>` : ''}${a.link ? `<a class="icon-btn xs" href="${esc(a.link)}" target="_blank" rel="noopener" aria-label="${esc(t('Open the posting'))}">${icon('external', 12)}</a>` : ''}${i < STAGES.length - 1 ? `<button class="icon-btn xs" type="button" data-action="move" data-id="${esc(a.id)}" data-to="${STAGES[i + 1][0]}" aria-label="${esc(t('Move on'))}">${icon('right', 12)}</button>` : ''}</span></div>`; }).join('') || `<p class="kb-none">${esc(t('Nothing here'))}</p>`}</div>${st === 'wish' ? `<button class="btn sm ghost" type="button" data-action="new" data-st="wish">${icon('plus', 12)} ${esc(t('Add'))}</button>` : ''}</div>`; };
      $('#cr-body', root).innerHTML = `<div class="lf-stats">${[[apps.filter(a => a.status === 'applied' || a.status === 'interview' || a.status === 'offer').length, 'applied', 'send'], [apps.filter(a => a.status === 'interview').length, 'interviews', 'chat'], [apps.filter(a => a.status === 'offer').length, 'offers', 'star', 'good'], [apps.filter(a => a.status === 'wish').length, 'on the wishlist', 'bookmark']].map(([n, l, ic, c]) => `<div class="lf-stat ${c || ''}"><span class="lf-stat-ic">${icon(ic === 'bookmark' ? 'flag' : ic, 16)}</span><b>${n}</b><span>${esc(t(l))}</span></div>`).join('')}</div>
        ${soon.length ? `<div class="panel cr-soon"><div class="lf-label-row">${icon('clock', 15)} <b>${esc(t('Coming up'))}</b></div>${soon.map(({ a, d }) => `<button class="cr-soon-row" type="button" data-action="open" data-id="${esc(a.id)}"><b>${esc(L.relDay(d))}</b><span>${esc(a.company)}${a.role ? ' · ' + esc(a.role) : ''}</span><small>${esc(a.status === 'wish' ? t('application deadline') : t('next step'))}</small></button>`).join('')}</div>` : ''}
        <div class="kb cr-board">${STAGES.map(([st, l]) => col(st, l)).join('')}</div>`;
    }
  };

  /* ======================================================
     PORTFOLIO
     ====================================================== */
  const workFields = () => [{ k: 'title', label: 'Project', req: true, auto: true, max: 100, ph: 'Bridge load simulator' }, { k: 'summary', label: 'What it is and what you did', type: 'textarea', rows: 3, max: 600 }, { k: 'when', label: 'When', max: 40, half: true, ph: 'Fall 2026', opt: true }, { k: 'course', label: 'Class', type: 'class', half: true }, { k: 'skills', label: 'Skills, comma separated', max: 200, opt: true, ph: 'Python, teamwork, CAD' }, { k: 'link', label: 'Link', type: 'url', opt: true, ph: 'https://github.com/…' }];
  App.views.portfolio = {
    title: 'Portfolio', blurb: 'Your best work on one page you can print, save as a PDF or send with an application.',
    render(root) {
      root.innerHTML = `<div class="lf-page pf-page">${head('Portfolio', this.blurb, `<button class="btn" type="button" data-action="profile">${icon('user', 14)} ${esc(t('Edit your details'))}</button><button class="btn" type="button" data-action="print">${icon('print', 14)} ${esc(t('Print or PDF'))}</button><button class="btn primary" type="button" data-action="work">${icon('plus', 14)} ${esc(t('Add a project'))}</button>`)}<div id="pf-body"></div></div>`;
      const paint = () => keepScroll(() => this.paint(root)); this.repaint = paint; paint();
      const clean = v => Object.assign({}, v, { link: /^https?:\/\//i.test(v.link || '') ? v.link : '', skills: String(v.skills || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 12) });
      App.bind(root, { print: () => global.print(),
        profile: () => { const p = L.rec('profile'); const u = App.auth && App.auth.user; L.form({ title: 'Your details', icon: 'user', fields: [{ k: 'name', label: 'Name', req: true, max: 80 }, { k: 'headline', label: 'One line about you', max: 120, ph: 'Mechanical engineering student who loves building things' }, { k: 'about', label: 'About', type: 'textarea', rows: 4, max: 800, opt: true }, { k: 'email', label: 'Email', type: 'email', opt: true, half: true }, { k: 'city', label: 'Where', opt: true, half: true, ph: 'Bozeman, MT' }, { k: 'school', label: 'School and degree', opt: true, ph: 'Montana State University · B.S. Mechanical Engineering, 2029' }, { k: 'links', label: 'Links, one per line', type: 'textarea', rows: 3, opt: true, ph: 'https://linkedin.com/in/…\nhttps://github.com/…' }, { k: 'skills', label: 'Skills, comma separated', opt: true, max: 300 }], values: Object.assign({ name: u ? u.name || '' : '', email: u ? u.email : '', school: 'Montana State University' }, p, { links: (p.links || []).join('\n'), skills: (p.skills || []).join(', ') }), wide: true, onSave: v => { L.setRec('profile', Object.assign({}, v, { links: String(v.links || '').split('\n').map(x => x.trim()).filter(x => /^https?:\/\//i.test(x)).slice(0, 6), skills: String(v.skills || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 24) })); paint(); } }); },
        work: () => L.form({ title: 'Add a project', icon: 'star', fields: workFields(), values: {}, submit: 'Add', onSave: v => { L.add('works', clean(v)); paint(); } }),
        'edit-work': el => { const w = L.get('works', el.dataset.id); if (!w) return; L.form({ title: 'Edit project', icon: 'pen', fields: workFields(), values: Object.assign({}, w, { skills: (w.skills || []).join(', ') }), onSave: v => { L.put('works', w.id, clean(v)); paint(); }, onDelete: () => { L.drop('works', w.id, t('Project removed')); paint(); } }); } });
    },
    paint(root) {
      const p = L.rec('profile'); const works = L.all('works'); const u = App.auth && App.auth.user; const name = p.name || (u && u.name) || '';
      const classes = L.mine().map(id => Courses[id]).filter(Boolean);
      $('#pf-body', root).innerHTML = `<article class="panel pf-sheet">${name || p.headline ? `<header class="pf-h"><div class="pf-avatar" aria-hidden="true">${esc((name || '?').trim()[0].toUpperCase())}</div><div><h2>${esc(name || t('Your name'))}</h2>${p.headline ? `<p class="pf-head">${esc(p.headline)}</p>` : ''}<p class="pf-contact">${[p.email ? `${icon('send', 12)} ${esc(p.email)}` : '', p.city ? `${icon('pin', 12)} ${esc(p.city)}` : ''].concat((p.links || []).map(l => `${icon('link', 12)} <a href="${esc(l)}" target="_blank" rel="noopener">${esc(l.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`)).filter(Boolean).join('<span class="pf-sep">·</span>')}</p></div></header>` : `<div class="pf-h empty"><p>${esc(t('Start with your name and one line about you.'))}</p><button class="btn sm primary" type="button" data-action="profile">${icon('user', 13)} ${esc(t('Add your details'))}</button></div>`}
        ${p.about ? `<section><h3>${esc(t('About'))}</h3><p>${esc(p.about)}</p></section>` : ''}
        <section><h3>${esc(t('Education'))}</h3><p><b>${esc(p.school || 'Montana State University')}</b></p>${classes.length ? `<p class="muted small">${esc(t('This term: {1}', classes.map(C => `${C.code} ${C.name}`).join(', ')))}</p>` : ''}</section>
        ${(p.skills || []).length ? `<section><h3>${esc(t('Skills'))}</h3><div class="pf-skills">${p.skills.map(s => `<span class="lf-chip">${esc(s)}</span>`).join('')}</div></section>` : ''}
        <section><h3>${esc(t('Projects'))}</h3>${works.length ? `<div class="pf-works">${works.map(w => `<div class="pf-work"><div class="pf-work-h"><b>${esc(w.title)}</b>${w.when ? `<small>${esc(w.when)}</small>` : ''}<button class="icon-btn xs pf-edit" type="button" data-action="edit-work" data-id="${esc(w.id)}" aria-label="${esc(t('Edit'))}">${icon('pen', 11)}</button></div>${w.summary ? `<p>${esc(w.summary)}</p>` : ''}<div class="pf-work-f">${(w.skills || []).map(s => `<span class="lf-chip">${esc(s)}</span>`).join('')}${w.course && Courses[w.course] ? `<span class="lf-chip">${esc(Courses[w.course].code)}</span>` : ''}${w.link ? `<a href="${esc(w.link)}" target="_blank" rel="noopener">${icon('external', 12)} ${esc(w.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48))}</a>` : ''}</div></div>`).join('')}</div>` : `<p class="muted">${esc(t('Add a class project, a lab, a club build or anything you made. Two or three good ones are enough.'))}</p>`}</section></article>`;
    }
  };
})(window);
