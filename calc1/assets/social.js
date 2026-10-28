/* ============================================================
   Mathub — community features (front-end)
   Daily challenge + leaderboards, the people directory, live presence, activity
   feed, and the landing/dashboard widgets that surface them.
   Server: api/social.php.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, on, toast, store, typeset, pageHead } = App;
  const API = 'api/index.php?r=';
  const auth = () => App.auth || {}; const user = () => auth().user || null; const offline = () => auth().mode !== 'server' || auth().unreachable;
  const NAMES = { calc: 'Calc I', physics: 'Physics I', precalc: 'Precalc', writ: 'WRIT 101', csci: 'CSCI 127', biob: 'BIOB 160', kin: 'KIN 322', psyx: 'PSYX 340', general: 'General' };
  const courseName = id => (global.Courses[id] && global.Courses[id].short) || NAMES[id] || id;
  const courseChip = id => `<span class="chip course-${esc(id)}">${esc(courseName(id))}</span>`;
  const fmtWhen = ts => { const d = new Date(ts * 1000); const t = App.todayISO(); const iso = App.toISO(d); const day = iso === t ? 'Today' : iso === App.toISO(App.addDays(App.parseISO(t), 1)) ? 'Tomorrow' : App.fmtDate(iso); return `${day} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; };
  const timeAgo = ts => { const s = Math.max(0, Date.now() / 1000 - ts); if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };
  const fmtMs = ms => ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  async function api(route, body, method) {
    const opts = { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw Object.assign(new Error('Cannot reach the server right now.'), { network: true }); }
    if (!json || json.ok === false) { const err = new Error((json && json.error) || 'Request failed.'); err.data = json; err.status = res.status; throw err; }
    return json;
  }
  const S = { presence: null };
  App.social = S;
  const lockCard = (t, x, o) => App.lockCard(t, x, o);
  const needLogin = (t, x) => lockCard(t, x, { compact: true });

  /* ---------- people directory ---------- */
  const PP = { q: '', sort: 'helpful', page: 0, rows: [], total: 0, online: 0, more: false };
  const hue = id => Math.round((id * 137.508) % 360);
  App.views.people = {
    title: 'People', blurb: 'Everyone on Mathub, and how they have helped on the class boards. Names follow each person’s privacy setting.',
    render(root, param, query, standalone) {
      const wrap = standalone ? `<div class="landing-wrap"><header class="landing-top"><div><div class="eyebrow">Mathub</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>People</h1><p class="muted">${this.blurb}</p></div><div class="row gap-sm"><span id="landing-account"></span><a class="btn" href="#/">${icon('left', 14)} All classes</a></div></header><div id="pp-root"></div></div>` : pageHead('People', this.blurb, ``) + '<div id="pp-root"></div>';
      root.innerHTML = wrap; const el = $('#pp-root', root); const slot = $('#landing-account', root); if (slot && App.auth && App.auth.ready) App.auth.paintLandingAccount(slot);
      if (!user()) { el.innerHTML = lockCard('The People page is for members', 'Sign up free with your montana.edu email to see who is studying with you.'); return; }
      if (offline()) { el.innerHTML = '<div class="empty">The People page needs a connection to the server.</div>'; return; }
      PP.q = query && query.q !== undefined ? String(query.q) : ''; PP.page = 0;
      el.innerHTML = `<div class="panel people-panel"><div class="people-bar"><label class="people-search">${icon('search', 15)}<input class="input" id="pp-q" placeholder="Search by name" value="${esc(PP.q)}" maxlength="60" aria-label="Search people"></label><select class="select" id="pp-sort" aria-label="Sort">${[['helpful', 'Most helpful'], ['active', 'Online now'], ['new', 'Newest members'], ['name', 'Name A–Z']].map(([v, l]) => `<option value="${v}"${PP.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select><span class="people-count" id="pp-count"></span></div><div id="pp-list"><div class="empty">Loading…</div></div><div id="pp-more" class="mt-2" style="text-align:center"></div></div>`;
      const inp = $('#pp-q', el); let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { PP.q = inp.value.trim(); PP.page = 0; this.load(el); }, 250); });
      $('#pp-sort', el).addEventListener('change', e => { PP.sort = e.target.value; PP.page = 0; this.load(el); });
      bind(el, { 'pp-more': () => { PP.page++; this.load(el, true); } });
      PP.page = 0; this.load(el);
    },
    async load(el, append) {
      const list = $('#pp-list', el); if (!list) return; if (!append) list.innerHTML = '<div class="empty">Loading…</div>';
      try { const r = await api(`people&q=${encodeURIComponent(PP.q)}&sort=${encodeURIComponent(PP.sort)}&page=${PP.page}`); PP.rows = append ? PP.rows.concat(r.people) : r.people; PP.total = r.total; PP.online = r.online; PP.more = r.more; }
      catch (e) { list.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      this.paintList(el);
    },
    paintList(el) {
      const list = $('#pp-list', el); if (!list) return;
      $('#pp-count', el).innerHTML = `<b>${PP.total}</b> member${PP.total === 1 ? '' : 's'} · <span class="online-dot"></span> ${PP.online} online now`;
      if (!PP.rows.length) { list.innerHTML = `<div class="empty">${PP.q ? 'Nobody matches that name.' : 'No members yet.'}</div>`; $('#pp-more', el).innerHTML = ''; return; }
      list.innerHTML = `<div class="people-grid">${PP.rows.map(p => {
        const initial = p.anon ? '?' : (p.name.trim()[0] || '?').toUpperCase(); const joined = App.fmtDate(App.toISO(new Date(p.joined * 1000)));
        return `<div class="person${p.me ? ' me' : ''}${p.anon ? ' anon' : ''}">
          <div class="person-head"><div class="avatar" style="--hue:${hue(p.id)}">${esc(initial)}</div><div class="person-id"><div class="person-name">${esc(p.name)}${p.me ? ' <span class="chip accent">you</span>' : ''}${p.role ? ` <span class="chip staff">${esc(p.role)}</span>` : ''}${p.admin ? ' <span class="chip accent">admin</span>' : p.mod ? ' <span class="chip accent">mod</span>' : ''}${p.online ? ' <span class="online-dot" title="Online now"></span>' : ''}</div><div class="small muted">Joined ${esc(joined)}${p.courses.length ? ' · ' + p.courses.map(c => esc(courseName(c))).join(', ') : ''}</div></div>${p.accepted ? `<span class="chip gold" title="${p.accepted} accepted answer${p.accepted === 1 ? '' : 's'}">${icon('check', 12)} ${p.accepted}</span>` : ''}</div>
          <div class="person-stats small muted">${p.posts} post${p.posts === 1 ? '' : 's'} · ${p.comments} ${p.comments === 1 ? 'reply' : 'replies'} · ${p.accepted} accepted answer${p.accepted === 1 ? '' : 's'}</div>
        </div>`; }).join('')}</div>`;
      $('#pp-more', el).innerHTML = PP.more ? `<button class="btn sm" data-action="pp-more">Show more</button>` : '';
    }
  };

  /* ---------- presence (heartbeat) ---------- */
  function presencePing() {
    if (!user() || offline()) return;
    const D = App.D; const hashParts = location.hash.replace(/^#\/?/, '').split('/');
    const view = D ? hashParts[1] || 'dashboard' : hashParts[0] || 'home'; const post = /forum/.test(location.hash) && /\/forum\/(\d+)/.test(location.hash) ? +RegExp.$1 : 0;
    api('presence', { course: D ? D.id : '', view, post_id: post }).then(r => { S.presence = r; paintPresence(); }).catch(() => {});
  }
  function paintPresence() {
    const p = S.presence; const off = App.moduleOn && !App.moduleOn('presence'); const pill = $('#presence-pill'); if (pill) { if (!p || !user() || off) pill.hidden = true; else { pill.hidden = false; const D = App.D; const n = D ? (p.by_course[D.id] || 0) : p.online; pill.innerHTML = `<span class="dot"></span>${n} studying${D ? ' ' + esc(D.short) : ''} now`; pill.title = `${p.online} online across Mathub`; } }
    const lp = $('#landing-presence'); if (lp && off) lp.innerHTML = ''; else if (lp && p) lp.innerHTML = `<span class="presence-inline"><span class="dot"></span>${p.online} studying right now${Object.keys(p.by_course).filter(k => k !== 'home' && p.by_course[k]).length ? ' · ' + Object.entries(p.by_course).filter(([k, v]) => k !== 'home' && v).map(([k, v]) => `${v} in ${esc(courseName(k))}`).join(', ') : ''}</span>`;
    const here = $('#fa-here'); if (here && p) here.textContent = p.here > 1 ? `${p.here} people are reading this` : '';
  }
  S.presencePing = presencePing;
  setInterval(() => { if (document.visibilityState === 'visible') presencePing(); }, 60000);
  window.addEventListener('hashchange', () => setTimeout(presencePing, 300));
  // auth.js loads after this file, so hook up once the page has finished loading scripts
  document.addEventListener('DOMContentLoaded', () => { if (App.auth) App.auth.onChange(() => { setTimeout(presencePing, 200); }); });

  /* ---------- daily challenge ---------- */
  const Challenge = {
    question(course, date) {
      const C = global.Courses[course]; if (!C || !C.quiz) return null;
      const covered = new Set(); const lec = C.CALENDAR.filter(e => e[1] === 'lecture' && e[3] && e[0] <= date).pop(); const curId = lec ? lec[3] : C.SECTIONS[0].id; const idx = Math.max(0, C.SECTIONS.findIndex(s => s.id === curId));
      C.SECTIONS.slice(0, idx + 1).forEach(s => covered.add(s.id));
      const topics = Object.keys(C.quiz.TOPICS).filter(t => covered.has(C.quiz.TOPICS[t].sec)); if (!topics.length) return null;
      const seed = hash(course + ':' + date); const QZsave = App.Q; // seededSet uses the current course's quiz module
      const rnd = mulberry(seed); const topic = topics[Math.floor(rnd() * topics.length)];
      const gens = C.quiz.BY_TOPIC[topic]; if (!gens || !gens.length) return null;
      const orig = Math.random; const realNow = Date.now; Math.random = mulberry(seed + 7); Date.now = () => 1700000000000;
      try { let q = null; for (let k = 0; k < 6 && !q; k++) { try { q = gens[Math.floor(Math.random() * gens.length)](); } catch (e) { q = null; } } if (q) q.id = 'ch' + seed.toString(36); return q; } finally { Math.random = orig; Date.now = realNow; }
    }
  };
  function mulberry(seed) { let s = (seed >>> 0) || 1; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const CH = { started: {}, answered: {}, hint: 0 };
  App.views.challenge = {
    title: 'Daily challenge', blurb: 'One problem per class per day, the same for everyone. Solve it fast for bonus points and climb the weekly board.',
    render(root, param, query, standalone) {
      const courses = App.COURSE_ORDER.filter(id => global.Courses[id] && (global.Courses[id].quiz || global.Courses[id].hasQuiz)); const cid = standalone ? (query.course && courses.includes(query.course) ? query.course : courses[0]) : App.D.id;
      const head = standalone ? `<div class="landing-wrap"><header class="landing-top"><div><div class="eyebrow">Mathub</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>Daily challenge</h1><p class="muted">${this.blurb}</p></div><div class="row gap-sm"><span id="landing-account"></span><a class="btn" href="#/">${icon('left', 14)} All classes</a></div></header><div class="chips mb-2">${courses.map(c => `<a class="chip toggle${c === cid ? ' on' : ''}" href="#/challenge?course=${c}">${esc(courseName(c))}</a>`).join('')}</div><div id="ch-root"></div></div>` : pageHead('Daily challenge', this.blurb) + '<div id="ch-root"></div>';
      root.innerHTML = head; const slot = $('#landing-account', root); if (slot && App.auth && App.auth.ready) App.auth.paintLandingAccount(slot);
      this.paint($('#ch-root', root), cid);
    },
    async paint(el, cid) {
      el.innerHTML = `<div class="grid cols-3"><div class="panel span-2" id="ch-q"><div class="empty">Loading…</div></div><div class="stack" id="ch-side"></div></div>`;
      if (App.loadCourse) { try { await App.loadCourse(cid); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; } }
      let stats = null; if (!offline()) { try { stats = await api('challenge_stats&course=' + cid); } catch (e) { stats = null; } }
      const date = stats && stats.date ? stats.date : App.todayISO(); const q = Challenge.question(cid, date);
      if (!q) { el.innerHTML = '<div class="empty">No challenge available for this class yet.</div>'; return; }
      this.paintQuestion($('#ch-q', el), cid, date, q, stats); this.paintSide($('#ch-side', el), cid, stats);
    },
    paintQuestion(box, cid, date, q, stats) {
      const done = stats && stats.mine; const key = cid + date; const answered = CH.answered[key];
      const T = global.Courses[cid].quiz.TOPICS[q.topic];
      const secLabel = (() => { const s = global.Courses[cid].SECTIONS.find(x => x.id === (T && T.sec)); return s ? s.label : ''; })();
      box.innerHTML = `<div class="panel-h"><div><div class="eyebrow">${esc(courseName(cid))} · ${esc(App.fmtDate(date, true))}</div><div class="panel-title">${icon('target')} Today’s problem</div></div><span class="chip">${esc(secLabel)} · ${esc(T ? T.label : q.topic)}</span></div>
        ${stats ? `<p class="small muted mb-2">${stats.attempts} student${stats.attempts === 1 ? '' : 's'} tried it today${stats.attempts ? ` · ${Math.round(100 * stats.correct / stats.attempts)}% got it right` : ''}.</p>` : ''}
        <div class="q-card${done || answered ? (done ? (done.ok ? ' correct' : ' wrong') : (answered.ok ? ' correct' : ' wrong')) : ''}"><div class="q-prompt">${q.prompt}</div>
          ${done || answered ? `<div class="q-feedback ${(done ? done.ok : answered.ok) ? 'ok' : 'no'}"><b class="res">${(done ? done.ok : answered.ok) ? '✓ Correct' : '✕ Not quite'}${done ? ` · ${done.points} points · ${fmtMs(done.ms)}` : ''}${q.type === 'num' ? ` · the answer is $${q.answerTex}$` : ` · the answer is ${'ABCD'[q.answer]}`}</b><div>${q.explanation}</div><p class="small muted mt-1">Come back tomorrow for a new one.</p></div>`
          : q.type === 'mc' ? `<div class="q-opts">${q.options.map((o, k) => `<button class="q-opt" data-action="ch-mc" data-i="${k}"><span class="letter">${'ABCDEF'[k]}</span><span>${o}</span></button>`).join('')}</div>`
          : `<div class="q-numrow"><input class="input mono" id="ch-num" placeholder="e.g. 3/8, -0.375, 2pi"><button class="btn primary" data-action="ch-num">${icon('check', 14)} Submit</button></div>`}
          ${!(done || answered) ? `<div class="row mt-2 between"><span class="small muted" id="ch-timer">${user() ? 'Timer starts when you answer the first time. Faster correct answers earn up to 5 bonus points.' : 'Sign in to record your answer and earn points.'}</span><button class="btn xs ghost" data-action="ch-hint">${icon('bulb', 12)} Hint</button></div><div id="ch-hints" class="ladder"></div>` : ''}
        </div>`;
      typeset(box); if (!CH.started[key]) CH.started[key] = Date.now(); CH.hint = 0;
      const submit = async (ok, raw) => {
        if (!user()) { auth().open('signup'); return; }
        const ms = Math.max(1000, Date.now() - (CH.started[key] || Date.now())); CH.answered[key] = { ok, raw };
        App.recordAnswer(q.topic, ok); if (!ok && App.recordMistake) App.recordMistake(q, cid, 'challenge');
        if (offline()) { toast('Offline: your answer was not recorded on the board.'); this.paintQuestion(box, cid, date, q, stats); return; }
        App.setSetting('challengeDone', Object.assign({}, App.settings().challengeDone || {}, { [cid]: date })); try { const r = await api('challenge_submit', { course: cid, date, ok, ms, topic: q.topic }); toast(ok ? `Correct! +${r.points} points` : '+2 points for trying', 3000); if (App.addXP) App.addXP(r.points || (ok ? 10 : 2), { course: cid }); if (App.quest) App.quest('challenge'); if (ok && App.confetti) App.confetti({ count: 90 }); const st = await api('challenge_stats&course=' + cid); this.paintQuestion(box, cid, date, q, st); this.paintSide($('#ch-side'), cid, st); } catch (e) { toast(e.message, 3500); this.paintQuestion(box, cid, date, q, stats); }
      };
      bind(box, {
        'ch-mc': el => { if (CH.answered[key]) return; submit(+el.dataset.i === q.answer); },
        'ch-num': () => { if (CH.answered[key]) return; const raw = $('#ch-num', box).value.trim(); const v = App.parseNumber(raw); if (isNaN(v)) { toast('Enter a number, fraction or expression like 2pi'); return; } const tol = q.tol ? Math.max(q.tol * Math.abs(q.answer), 1e-9) : Math.max(0.011, 0.005 * Math.abs(q.answer)); submit(Math.abs(v - q.answer) <= tol, raw); },
        'ch-hint': el => { const L = (global.MathubLadders && global.MathubLadders[cid] || {})[q.topic] || []; const hints = L.slice(0, 3); if (q.hint) { if (hints.length >= 3) hints[2] = q.hint; else hints.push(q.hint); } const n = CH.hint = (CH.hint || 0) + 1; const h = $('#ch-hints', box); if (!h) return; h.innerHTML = hints.slice(0, n).map((x, i) => `<div class="rung hint"><span class="rung-label">${icon('bulb', 12)} Hint ${i + 1} of ${hints.length}</span><div>${x}</div></div>`).join(''); typeset(h); if (n >= hints.length) el.remove(); }
      });
      const inp = $('#ch-num', box); if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('[data-action="ch-num"]', box).click(); });
    },
    paintSide(side, cid, stats) {
      if (!side) return;
      if (!stats) { side.innerHTML = `<div class="panel">${user() ? '<div class="empty">Leaderboards need a connection to the server.</div>' : needLogin('Join the leaderboard', 'Members earn points for every daily challenge and appear on the weekly board.')}</div>`; return; }
      const lb = (rows, cols) => rows.length ? `<table class="table compact lb"><tbody>${rows.map((r, i) => `<tr${r.me ? ' class="me"' : ''}><td class="rank">${i + 1}</td><td>${esc(r.name)}</td><td class="num">${cols(r)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty small">Nobody yet. Be first.</div>';
      side.innerHTML = `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('clock')} Fastest today</div></div>${lb(stats.today, r => fmtMs(r.ms))}</div>
        <div class="panel"><div class="panel-h"><div class="panel-title">${icon('fire')} This week · ${esc(courseName(cid))}</div>${user() ? `<span class="chip accent">you: ${stats.my_week_points} pts</span>` : ''}</div>${lb(stats.week, r => `${r.points} pts · ${r.days}d`)}</div>
        <div class="panel"><div class="panel-h"><div class="panel-title">${icon('grid')} This week · all classes</div></div>${lb(stats.overall, r => `${r.points} pts`)}<p class="small muted mt-2">10 points for a correct answer, up to 5 more for speed, 2 for trying. Hide your name in Settings.</p></div>`;
    }
  };

  /* ---------- widgets: landing + dashboard ---------- */
  S.fillLanding = async function (root) {
    const el = $('#landing-social', root); if (!el) return;
    const courses = (App.myCourses ? App.myCourses() : App.COURSE_ORDER.filter(id => global.Courses[id])).filter(id => global.Courses[id] && (global.Courses[id].quiz || global.Courses[id].hasQuiz));
    el.innerHTML = `<div class="grid cols-3"><div class="panel span-2"><div class="panel-h"><div class="panel-title">${icon('target')} Today’s challenges</div><a class="btn sm" href="#/challenge">${icon('target', 13)} Play</a></div><div class="challenge-row" id="ls-ch">${courses.map(c => `<a class="card-link ch-card" href="#/challenge?course=${c}"><div class="eyebrow">${esc(courseName(c))}</div><h4 id="lsc-${c}">Loading…</h4><p class="small muted">Same problem for everyone · beat the clock</p></a>`).join('')}</div></div>
      <div class="panel"><div class="panel-h"><div class="panel-title">${icon('bulb')} Happening now</div></div><div id="ls-act"><div class="empty small">Loading…</div></div></div></div>`;
    if (offline()) { $('#ls-act', el).innerHTML = '<div class="empty small">Needs the server.</div>'; courses.forEach(c => { const q = global.Courses[c].quiz ? Challenge.question(c, App.todayISO()) : true; $('#lsc-' + c, el).textContent = q ? 'Today’s problem is ready' : 'No challenge yet'; }); return; }
    courses.forEach(c => api('challenge_stats&course=' + c).then(s => { const h = $('#lsc-' + c, el); if (h) h.innerHTML = s.mine ? `${s.mine.ok ? '✓ Solved' : 'Tried'} · ${s.attempts} student${s.attempts === 1 ? '' : 's'} today` : `${s.attempts} tried today${s.attempts ? ` · ${Math.round(100 * s.correct / s.attempts)}% correct` : ''}`; }).catch(() => {}));
    api('class_goal').then(r => { const host = $('#ls-ch', el); if (!host || !r.courses) return; const mine = (App.myCourses ? App.myCourses() : []).filter(c => r.courses[c] && r.courses[c].members); if (!mine.length) return; host.insertAdjacentHTML('afterend', `<div class="goal-row">${mine.map(c => { const g = r.courses[c]; const pct = Math.min(100, Math.round(100 * g.answered / g.goal)); return `<a class="goal-mini" href="#/${c}/dashboard"><div class="row between small"><span class="chip course-${c}">${esc(courseName(c))}</span><span class="muted">${g.answered} / ${g.goal}</span></div><div class="bar sm mt-1"><div class="bar-fill ${pct >= 100 ? 'good' : ''}" style="width:${pct}%"></div></div><small class="muted">class goal this week · ${g.active} practicing</small></a>`; }).join('')}</div>`); }).catch(() => {});
    api('activity').then(r => { const a = $('#ls-act', el); if (!a) return; a.innerHTML = r.items.length ? `<div class="act-feed">${r.items.filter(i => !['meet', 'mock', 'contrib', 'badge'].includes(i.kind)).slice(0, 8).map(i => `<a class="act-row" href="${esc(i.link || '#/')}"><span class="act-ic">${icon({ post: 'chat', solved: 'check', challenge: 'target', poll: 'list', class: 'book', invite: 'users' }[i.kind] || 'bulb', 13)}</span><span class="act-text">${esc(i.text)}</span><span class="act-when">${timeAgo(i.created)}</span></a>`).join('')}</div>` : '<div class="empty small">Quiet so far today.</div>'; }).catch(() => { const a = $('#ls-act', el); if (a) a.innerHTML = ''; });
  };
  /* course announcements (instructors, TAs, moderators) + the class-wide goal bar, prepended to the dashboard community panel */
  S.extras = async function (el, courseId) {
    if (!el || offline()) return; if (!$('#dc-ann', el)) el.insertAdjacentHTML('afterbegin', '<div id="dc-ann"></div><div id="dc-goal"></div>');
    api('ann_list&course=' + courseId).then(r => { const box = $('#dc-ann', el); if (!box) return; const me = user(); const canPost = r.can_post || (me && (me.staff || me.mod));
      box.innerHTML = (r.items.length ? `<div class="panel ann-panel"><div class="panel-h"><div class="panel-title">${icon('bell')} From your instructors</div>${canPost ? `<button class="btn xs" data-action="ann-new">${icon('pen', 12)} Post</button>` : ''}</div><div class="stack-sm">${r.items.map(a => `<div class="ann"><div class="ann-body">${esc(a.text)}${a.link ? ` <a href="${esc(a.link)}"${/^https?:/.test(a.link) ? ' target="_blank" rel="noopener"' : ''}>${icon('external', 11)} link</a>` : ''}</div><div class="ann-meta small muted">${esc(a.author)}${a.role ? ` · <span class="chip staff xs">${esc(a.role)}</span>` : ''} · ${timeAgo(a.created)}${a.mine || (me && me.mod) ? ` · <button class="linkish" data-action="ann-del" data-id="${a.id}">delete</button>` : ''}</div></div>`).join('')}</div></div>` : (canPost ? `<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn xs" data-action="ann-new">${icon('bell', 12)} Post an announcement to ${esc(courseName(courseId))}</button></div>` : ''));
      bind(box, { 'ann-new': () => S.announce(courseId, () => S.extras(el, courseId)), 'ann-del': async b => { if (!confirm('Delete this announcement?')) return; try { await api('ann_delete', { id: +b.dataset.id }); S.extras(el, courseId); } catch (e) { toast(e.message); } } });
    }).catch(() => {});
    api('class_goal').then(r => { const g = r.courses && r.courses[courseId]; const box = $('#dc-goal', el); if (!box || !g || !g.members) return; const pct = Math.min(100, Math.round(100 * g.answered / g.goal));
      box.innerHTML = `<div class="panel goal-panel"><div class="panel-h"><div class="panel-title">${icon('target')} ${esc(courseName(courseId))} this week, all of us</div><span class="small muted">${g.active} student${g.active === 1 ? '' : 's'} practicing</span></div><div class="row between small"><span><b class="count" data-count="${g.answered}">${g.answered}</b> of ${g.goal} questions answered together</span><span class="muted">${g.prev ? `last week ${g.prev}` : ''}</span></div><div class="bar mt-1"><div class="bar-fill ${pct >= 100 ? 'good' : ''}" style="width:${pct}%"></div></div><p class="small muted mt-1">${pct >= 100 ? 'Goal reached. Every answer still counts toward next week.' : `${g.goal - g.answered} to go. Your practice sets, lessons and Blitz rounds all count.`}${g.cards ? ` · ${g.cards} flashcards` : ''}${g.focus ? ` · ${Math.round(g.focus / 60)} h of focus` : ''}</p></div>`; if (App.countUp) App.countUp(box);
    }).catch(() => {});
  };
  S.announce = function (courseId, done) {
    const el = document.createElement('div'); el.className = 'modal-backdrop'; el.innerHTML = `<form class="modal" style="padding:18px 20px" role="dialog" aria-label="Post an announcement"><div class="row between mb-1"><div class="panel-title">${icon('bell')} Announcement</div><button type="button" class="icon-btn" data-action="close" aria-label="Close">${icon('x', 14)}</button></div><div class="field"><label for="an-course">Class</label><select class="select" id="an-course">${App.COURSE_ORDER.filter(c => global.Courses[c]).map(c => `<option value="${c}"${c === courseId ? ' selected' : ''}>${esc(courseName(c))}</option>`).join('')}<option value="all">Every class</option></select></div><div class="field mt-1"><label for="an-text">Text</label><textarea class="input" id="an-text" rows="3" maxlength="300" placeholder="Office hours moved to Thursday 2 pm this week."></textarea></div><div class="grid cols-2 mt-1"><div class="field"><label for="an-link">Link (optional)</label><input class="input" id="an-link" placeholder="https://… or #/calc/calendar"></div><div class="field"><label for="an-days">Show for</label><select class="select" id="an-days">${[1, 3, 7, 14, 30].map(d => `<option value="${d}"${d === 7 ? ' selected' : ''}>${d} day${d === 1 ? '' : 's'}</option>`).join('')}</select></div></div><div class="row mt-2" style="justify-content:flex-end"><button class="btn primary" type="submit">Post</button></div></form>`;
    document.body.appendChild(el); const close = () => App.dismiss(el); el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-action="close"]')) close(); });
    $('form', el).addEventListener('submit', async e => { e.preventDefault(); try { await api('ann_post', { course: $('#an-course', el).value, text: $('#an-text', el).value.trim(), link: $('#an-link', el).value.trim(), days: +$('#an-days', el).value }); close(); toast('Posted. Students see it on their dashboard.', 3000); if (done) done(); } catch (err) { toast(err.message, 3500); } });
  };
  S.fillDashboard = async function (el, courseId) {
    if (!el) return; const D = global.Courses[courseId]; const t = App.todayISO(); setTimeout(() => S.extras(el, courseId), 0);
    if (!D.quiz) { el.innerHTML = `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('chat')} Latest discussions</div><a class="btn sm" href="${App.link('forum')}">${icon('chat', 13)} Open discussions</a></div><div id="ws-forum"><div class="empty small">Loading…</div></div></div>`; if (App.forumLatest) App.forumLatest($('#ws-forum', el)); return; }
    const q = Challenge.question(courseId, t);   // preview topic only; the page itself uses the server date
    el.innerHTML = `<div class="panel ch-panel"><div class="panel-h"><div class="panel-title">${icon('target')} Daily challenge</div><a class="btn sm primary" href="${App.link('challenge')}">Play</a></div><div id="dc-body">${q ? `<p class="small muted">Today: ${esc((D.quiz.TOPICS[q.topic] || {}).label || q.topic)}. Same problem for everyone, points for speed.</p>` : '<p class="small muted">No challenge yet.</p>'}</div></div><div id="dc-extra"></div>`;
    if (offline()) return;
    api('challenge_stats&course=' + courseId).then(s => { const b = $('#dc-body', el); if (!b) return; b.innerHTML = (s.mine ? `<p><span class="chip ${s.mine.ok ? 'good' : 'warn'}">${s.mine.ok ? '✓ Solved today' : 'Tried today'} · ${s.mine.points} pts</span></p>` : '') + `<p class="small muted mt-1">${s.attempts} student${s.attempts === 1 ? '' : 's'} tried today${s.attempts ? ` · ${Math.round(100 * s.correct / s.attempts)}% correct` : ''}. Your week: ${s.my_week_points} pts${s.week.length ? ` · leader: ${esc(s.week[0].name)} (${s.week[0].points})` : ''}.</p>`; }).catch(() => {});
    // exam poll: create/open the anonymous "how did it go" poll for the most recent exam
    const past = D.EXAMS.filter(e => (e.endDate || e.date) < t && App.daysBetween(e.endDate || e.date, t) <= 21); const ex = past[past.length - 1];
    if (ex && user()) { const k = 'mathub-exampoll-' + courseId + '-' + ex.id; let pid = 0; try { pid = +localStorage.getItem(k) || 0; } catch {} const show = id => { const x = $('#dc-extra', el); if (x) x.innerHTML = `<a class="card-link mt-2" href="#/${courseId}/forum/${id}"><div class="eyebrow">${icon('list', 12)} Exam poll</div><h4>How did ${esc(ex.name)} go?</h4><p>Anonymous. See how the class did and share what worked.</p></a>`; }; if (pid) show(pid); else api('poll_exam', { course: courseId, exam_id: ex.id, exam_name: ex.name, date: ex.endDate || ex.date }).then(r => { try { localStorage.setItem(k, String(r.post_id)); } catch {} show(r.post_id); }).catch(() => {}); }
  };
})(window);
