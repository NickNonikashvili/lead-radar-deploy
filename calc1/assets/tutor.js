/* ============================================================
   Mathub — Ask Bo (#/tutor, #/tutor/<class>): talk with Bo, an AI tutor who knows the class from its
   syllabus and how the student's studying is going. Part of Mathub Max. Website and apps.
   - Bo answers through Mathub's server (api/ai.php), which holds the AI key, keeps each request small
     (a compact class summary, a short progress snapshot, the last few turns, Bo's notes) and uses the
     smallest model that does the job. The chat and Bo's notes are kept with the account.
   - The progress snapshot is made here, from what this device knows: readiness for the next exam,
     the weakest and strongest topics, questions missed lately, flashcards due, what is due soon.
   - Before the first question the student is told what is sent to the AI provider and agrees.
   - Every answer can be copied, read aloud or reported; "What Bo knows" shows the snapshot and Bo's notes,
     which can be deleted one by one, with the chat.
   - Answers stream in as Bo writes them (App.boAsk). On the website, Talk opens a voice call with Bo
     (assets/talk.js); what is said there is saved in this chat too.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const Courses = global.Courses; if (!App) return;
  const { $, $$, esc, icon, toast, settings, setSetting } = App;
  const N = global.Native; const MA = global.MATHUB_APP; const NATIVE = !!(N && MA && MA.native);
  const API = 'api/index.php?r=';
  const safe = f => { try { return f(); } catch (e) { return null; } };
  const H = () => App.home;
  const user = () => { const a = App.auth; return a && a.user && !a.user.local && a.mode === 'server' ? a.user : null; };
  const haptic = k => { if (NATIVE && N.haptic) N.haptic(k); };
  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw Object.assign(new Error('Bo cannot be reached right now. Check your connection and try again.'), { network: true }); }
    if (!json || json.ok === false) throw Object.assign(new Error((json && json.error) || 'Something went wrong. Please try again.'), { status: res.status, data: json });
    return json;
  }
  const bo = n => (App.bobcatSvg ? App.bobcatSvg(n) : '');
  const talk = () => !!(App.boTalk && App.boTalk.supported());
  /* a question to Bo, his answer streamed: onDelta gets each piece as it is written; resolves with the whole answer */
  App.boAsk = async function (body, onDelta) {
    let res; try { res = await fetch(API + 'ai_tutor', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/x-ndjson, application/json', 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify(Object.assign({ stream: 1 }, body)) }); }
    catch (e) { throw Object.assign(new Error('Bo cannot be reached right now. Check your connection and try again.'), { network: true }); }
    if (!/ndjson/.test(res.headers.get('content-type') || '') || !res.body) { const j = await res.json().catch(() => null); if (!j || j.ok === false) throw Object.assign(new Error((j && j.error) || 'Bo could not answer just now. Please try again.'), { status: res.status, data: j }); return j; }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '', done = null;
    for (;;) {
      let r; try { r = await reader.read(); } catch (e) { break; }
      if (r.value) buf += dec.decode(r.value, { stream: true });
      let i; while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
        let o; try { o = JSON.parse(line); } catch (e) { continue; }
        if (o.t === 'd') { if (onDelta) onDelta(o.x || ''); } else if (o.t === 'done') done = o; else if (o.t === 'error') throw Object.assign(new Error(o.error || 'Bo could not answer just now.'), { status: o.status || 502 });
      }
      if (r.done) break;
    }
    if (!done) throw Object.assign(new Error('Bo was cut off. Please try again.'), { status: 502 });
    return done;
  };
  const plainHtml = h => { try { return (new DOMParser().parseFromString(String(h || ''), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { return String(h || ''); } };
  const short = id => { const C = Courses[id]; return C ? (C.short || C.code) : id; };

  /* ---------- what Bo is told about the student: a short snapshot of this device's progress ---------- */
  function snapshot(id) {
    const C = Courses[id]; const s = {}; const u = user(); if (!C) return s;
    if (u && u.name) s.name = String(u.name).split(/\s+/)[0];
    const st = safe(() => App.streakAll()); if (st) s.streak = st.n;
    const xp = safe(() => App.xpToday()); if (xp !== null) { s.xpToday = xp; s.goal = safe(() => App.dailyGoal()) || 30; }
    const lv = settings().lastVisit; if (lv && lv.label) s.page = lv.label;
    const rd = safe(() => App.readiness(id));
    if (rd && rd.ok) {
      const items = (C.CHECKLISTS && C.CHECKLISTS[rd.exam.id]) || [];
      s.readiness = { exam: rd.exam.name, date: rd.exam.date, days: rd.days, score: rd.score, label: rd.label };
      if (items.length && rd.checkPart !== null) s.readiness.checklist = `${Math.round(rd.checkPart / 100 * items.length)}/${items.length}`;
      const tops = rd.topics.slice().sort((a, b) => a.score - b.score || a.a - b.a);
      s.weak = tops.filter(x => x.score < 0.85).slice(0, 6).map(x => Object.assign({ t: x.label, n: x.a }, x.acc === null ? {} : { acc: Math.round(x.acc * 100) / 100 }));
      s.strong = tops.filter(x => x.score >= 0.85).slice(-4).map(x => x.label);
    } else { const ex = safe(() => H().examOf(C)); if (ex) s.readiness = { exam: ex.name, date: ex.date, days: H().daysTo(ex), score: 0, label: 'no practice topics' }; }
    const T = (C.quiz && C.quiz.TOPICS) || C.quizTopics || {};
    const answer = q => { const a = q.type === 'mc' && typeof q.answer === 'number' && Array.isArray(q.options) ? q.options[q.answer] : q.answer; return plainHtml(a == null ? '' : String(a)).slice(0, 80); };
    const ms = safe(() => App.mistakesAll(id)) || [];
    if (ms.length) s.missed = ms.slice().sort((a, b) => b.at - a.at).slice(0, 5).map(m => ({ t: (T[m.t] && T[m.t].label) || m.t || '', q: plainHtml(m.q && m.q.prompt).slice(0, 200), c: answer(m.q || {}) }));
    s.mistakes = (safe(() => App.mistakesDue(id)) || []).length;
    s.due = safe(() => { const d = App.dueCards(id); return d.count + (d.estimated || 0); }) || 0;
    const t = App.todayISO(); const ids = safe(() => H().myIds()) || [id];
    s.deadlines = ids.flatMap(x => (safe(() => App.upcomingDeadlinesOf(Courses[x], 6)) || []).map(d => ({ d: d.date, t: `${short(x)}: ${d.title}` }))).filter(d => d.d >= t && App.daysBetween(t, d.d) <= 7).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);
    s.others = ids.filter(x => x !== id && Courses[x]).map(x => { const ex = safe(() => H().examOf(Courses[x])); return ex ? { c: short(x), ex: ex.name, days: H().daysTo(ex) } : { c: short(x) }; }).slice(0, 5);
    return s;
  }
  App.tutorSnapshot = snapshot;

  /* ---------- Bo's answers: plain text with **bold**, lists and LaTeX; everything else escaped ---------- */
  function fmt(text) {
    const inline = x => x.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
    const t = String(text || '').replace(/\s*\[board:\s*([^\]]*)\]\s*/gi, (m, x) => `\n\n\u0001${x.trim()}\n\n`).replace(/\[(?:board|remember):[^\]]*$/i, '');
    return t.split(/\n{2,}/).filter(b => b.trim()).map(block => {
      if (block.startsWith('\u0001')) return `<div class="bo-board-line">${inline(esc(block.slice(1)))}</div>`;
      const lines = block.split('\n'); const li = l => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l);
      if (lines.every(li)) { const ol = /^\s*\d/.test(lines[0]); return `<${ol ? 'ol' : 'ul'}>${lines.map(l => `<li>${inline(esc(l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')))}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`; }
      return `<p>${lines.map(l => inline(esc(l))).join('<br>')}</p>`;
    }).join('');
  }
  const userHtml = (t, v) => { const photo = /^\[photo\]\s?/.test(t); const q = t.replace(/^\[photo\]\s?/, ''); return `${v ? `<span class="bo-photo-tag">${icon('mic', 13)} Said out loud</span>` : ''}${photo ? `<span class="bo-photo-tag">${icon('image', 13)} Photo</span>` : ''}${q ? `<p>${esc(q).replace(/\n/g, '<br>')}</p>` : ''}`; };
  const tools = () => `<div class="bo-tools">${talk() ? `<button type="button" class="bo-tool" data-bo-read aria-label="Read this answer aloud" title="Read aloud">${icon('volume', 15)}</button>` : ''}<button type="button" class="bo-tool" data-bo-copy aria-label="Copy this answer" title="Copy">${icon('copy', 14)}</button><button type="button" class="bo-tool" data-bo-report aria-label="Report this answer" title="Report">${icon('flag', 14)}</button></div>`;
  const msgHtml = (r, t, extra = '', v = false) => r === 'b'
    ? `<div class="bo-msg bo" data-src="${esc(t)}"><span class="bo-mini" aria-hidden="true">${bo(34)}</span><div class="bo-bubble"><div class="bo-text">${fmt(t)}</div>${tools()}${extra}</div></div>`
    : `<div class="bo-msg you"><div class="bo-bubble">${userHtml(t, v)}</div></div>`;

  /* ---------- a photo of a problem, shrunk on the device so it costs little to send ---------- */
  function shrink(file, max = 1280) {
    return new Promise((res, rej) => {
      if (!/^image\//.test(file.type)) return rej(new Error('Pick a photo (JPEG, PNG or WebP).'));
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); const d = c.toDataURL('image/jpeg', 0.82); res({ type: 'image/jpeg', data: d.split(',')[1], preview: d }); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That photo could not be read.')); };
      img.src = url;
    });
  }
  App.shrinkPhoto = shrink;

  /* ---------- the screen ---------- */
  const st = { cid: null, status: null, busy: false, photo: null, notes: [] };
  App.views.tutor = {
    title: 'Ask Bo',
    render(root, param, query) {
      const ids = (safe(() => H().myIds()) || []).filter(x => Courses[x] && !(App.classLocked && App.classLocked(x)));
      const want = param && Courses[param] ? param : ids.includes(settings().boClass) ? settings().boClass : safe(() => H().curClass());
      st.cid = want && Courses[want] ? want : ids[0] || null;
      if (st.cid && !ids.includes(st.cid)) ids.unshift(st.cid);
      root.innerHTML = `<div class="bo-shell"><div class="bo-page"><div class="bo-col">
        <header class="bo-head"><span class="bo-av" aria-hidden="true">${bo(52)}</span><div class="bo-title"><h1>Ask Bo</h1><p>Your tutor${st.cid ? ` for <b>${esc(short(st.cid))}</b>` : ''}. He knows your syllabus and how your studying is going.</p></div>${talk() ? `<button type="button" class="btn primary bo-talk-btn" data-bo-talk hidden>${icon('mic', 17)}<span>Talk with Bo</span></button>` : ''}<button type="button" class="icon-btn bo-knows-btn" data-bo="knows" aria-label="What Bo knows about you" title="What Bo knows">${icon('info', 18)}</button></header>
        ${ids.length > 1 ? `<div class="bo-classes" role="tablist" aria-label="Which class">${ids.map(x => `<button type="button" role="tab" class="wh-tab bo-class${x === st.cid ? ' on' : ''}" aria-selected="${x === st.cid}" data-bo-class="${esc(x)}" style="${App.classStyle ? App.classStyle(x) : ''}">${esc(short(x))}</button>`).join('')}</div>` : ''}
        <div class="bo-main" id="bo-main"><div class="bo-loading" aria-hidden="true"><i></i><i></i></div></div></div>
        <aside class="bo-side" id="bo-side" aria-label="What Bo knows"></aside></div></div>`;
      $('.bo-page', root).addEventListener('click', e => {
        const c = e.target.closest('[data-bo-class]'); if (c) { setSetting('boClass', c.dataset.boClass); location.hash = '#/tutor/' + c.dataset.boClass; return; }
        if (e.target.closest('[data-bo="knows"]')) knowsSheet();
        if (e.target.closest('[data-bo-talk]')) openTalk(true);
      });
      wireKnows($('#bo-side', root), () => paintSide());
      start($('#bo-main', root), query || {});
    }
  };

  async function start(main, query) {
    if (!user()) { main.innerHTML = gate('Sign in to talk with Bo', 'Bo is part of Mathub Max and works with your account, so he can follow your classes and progress on every device.', `<button type="button" class="btn primary lg" data-go="login">Log in</button><button type="button" class="btn" data-go="signup">Create an account</button>`); wireGate(main); return; }
    let s; try { s = st.status = await api('ai_status'); } catch (e) { main.innerHTML = gate('Bo cannot be reached', esc(e.message), `<button type="button" class="btn" data-go="retry">Try again</button>`); wireGate(main, () => start(main, query)); return; }
    st.notes = s.notes || []; if (App.boTalk) App.boTalk.setStatus(s);
    if (!s.enabled) { main.innerHTML = gate('Bo is getting ready', 'Bo is not switched on yet. He will be here soon.', ''); return; }
    if (!s.max) { main.innerHTML = intro(s.plan); wireGate(main, () => start(main, query)); return; }
    if (!settings().aiConsent) { main.innerHTML = consent(); wireGate(main, () => start(main, query)); return; }
    if (!st.cid) { main.innerHTML = gate('Pick a class first', 'Bo helps with a class you take. Choose your classes, or make one from a syllabus.', `<a class="btn primary" href="#/">Your classes</a><a class="btn" href="#/create">Create a class</a>`); return; }
    main.onclick = null; chat(main, query);
  }
  const gate = (h, p, acts) => `<section class="bo-gate"><span class="bo-gate-av" aria-hidden="true">${bo(96)}</span><h2>${h}</h2><p>${p}</p>${acts ? `<div class="bo-gate-acts">${acts}</div>` : ''}</section>`;
  function wireGate(main, again) {
    main.onclick = async e => {
      const b = e.target.closest('[data-go]'); if (!b) return; const g = b.dataset.go;
      if (g === 'login' || g === 'signup') { if (App.auth) App.auth.open(g); return; }
      if (g === 'retry') { again && again(); return; }
      if (g === 'max') { if (await App.paywall({ need: 'max', reason: 'bo' })) again && again(); return; }
      if (g === 'agree') { setSetting('aiConsent', Date.now()); haptic('success'); again && again(); return; }
      if (g === 'later') { location.hash = '#/'; }
    };
  }
  function intro(plan) {
    return `<section class="bo-gate bo-intro"><span class="bo-gate-av" aria-hidden="true">${bo(96)}</span><h2>Meet Bo, your tutor</h2>
      <p>Bo knows your classes from their syllabi and keeps up with how you are doing, so his help fits you.</p>
      <ul class="bo-perks"><li>${icon('chat', 18)}<span><b>Ask anything</b> about your classes, any time: “Why is the derivative of $\\sin x$ equal to $\\cos x$?”</span></li><li>${icon('target', 18)}<span><b>He knows where you are stuck</b>: your weakest topics, the questions you missed and your next exam.</span></li>${talk() ? `<li>${icon('mic', 18)}<span><b>Talk with him out loud</b>: he answers in a few seconds and writes the math on his board.</span></li>` : ''}<li>${icon('image', 18)}<span><b>Snap a problem</b> and he walks you through it, step by step.</span></li><li>${icon('flag', 18)}<span><b>Plans and quizzes</b> built on your real exam dates.</span></li></ul>
      <div class="bo-gate-acts"><button type="button" class="btn primary lg" data-go="max">${plan === 'pro' ? 'Move up to Max' : 'Get Mathub Max'}</button></div>
      <p class="small muted">Mathub Max includes everything in Pro: Bo also writes your classes from their syllabi.</p></section>`;
  }
  function consent() {
    return `<section class="bo-gate bo-consent" aria-labelledby="bo-consent-h"><span class="bo-gate-av" aria-hidden="true">${bo(80)}</span><h2 id="bo-consent-h">Before you start</h2>
      <p>To answer you, Bo sends what you ask (and any photo you add), a summary of your class's syllabus and a short summary of your progress (your scores by topic, questions you missed, flashcards due and your exam dates) to <b>Anthropic</b>, the company that makes the Claude AI Bo runs on. Anthropic uses it only to write Bo's answer and does not train its AI on it.</p>
      <p>Your chat with Bo and the notes he keeps about how you like to learn are saved with your Mathub account, so they are on all your devices. You can see and delete them any time under “What Bo knows”. <a href="#/policy/privacy">Privacy Policy</a></p>
      <div class="bo-gate-acts"><button type="button" class="btn primary lg" data-go="agree">I agree, let's start</button><button type="button" class="btn ghost" data-go="later">Not now</button></div></section>`;
  }

  function suggestions(id) {
    const C = Courses[id]; const s = snapshot(id); const out = [];
    if (s.weak && s.weak[0]) out.push(`Explain ${s.weak[0].t} to me`);
    if (s.readiness && s.readiness.exam && s.readiness.days >= 0) out.push(`Quiz me for ${s.readiness.exam}`);
    out.push('Make me a study plan for tonight');
    if (s.missed && s.missed[0]) out.push('Why did I get my last missed question wrong?');
    if (!s.weak || !s.weak.length) out.push(`What is ${C && C.SECTIONS && C.SECTIONS[0] ? C.SECTIONS[0].title : 'this class'} about?`);
    return out.slice(0, 4);
  }
  App.boSuggestions = suggestions;
  /* the voice call; when it ends, the chat shows what was said */
  function openTalk(gesture) {
    if (!talk() || !st.cid || !st.status || !st.status.max) return;
    App.boTalk.open({ cid: st.cid, status: st.status, gesture, onClose: changed => { if (changed && /^#\/tutor/.test(location.hash)) App.rerender(); } });
  }
  function greeting(id) {
    const s = snapshot(id); const name = s.name ? `Hi ${esc(s.name)}! ` : 'Hi! ';
    const ex = s.readiness && s.readiness.exam && s.readiness.days >= 0 ? `${s.readiness.exam} is ${s.readiness.days === 0 ? 'today' : s.readiness.days === 1 ? 'tomorrow' : `in ${s.readiness.days} days`}${s.readiness.score ? ` and you are ${s.readiness.score}% ready` : ''}. ` : '';
    const weak = s.weak && s.weak[0] ? `Your weakest topic right now is ${s.weak[0].t}. Want to start there? ` : '';
    return `${name}I'm Bo. I know ${short(id)} from its syllabus and how your studying is going. ${ex}${weak}Ask me anything, or snap a photo of a problem.`;
  }

  async function chat(main, query) {
    const id = st.cid;
    main.innerHTML = `<div class="bo-log" id="bo-log" role="log" aria-live="polite" aria-label="Chat with Bo"></div>
      <div class="bo-suggest" id="bo-suggest"></div>
      <form class="bo-compose" id="bo-compose"><div class="bo-photo-prev" id="bo-photo-prev" hidden></div>
        <div class="bo-row"><label class="icon-btn bo-photo" title="Add a photo of a problem" aria-label="Add a photo of a problem">${icon('image', 19)}<input type="file" id="bo-file" accept="image/*" hidden></label>
        <label class="sr-only" for="bo-q">Ask Bo</label><textarea id="bo-q" class="input bo-q" rows="1" maxlength="2000" placeholder="Ask Bo about ${esc(short(id))}…"></textarea>
        ${talk() ? `<button type="button" class="icon-btn bo-mic" data-bo-talk aria-label="Talk with Bo out loud" title="Talk with Bo">${icon('mic', 20)}</button>` : ''}<button type="submit" class="btn primary bo-send" aria-label="Send">${icon('send', 18)}</button></div>
        <p class="bo-foot" id="bo-foot">Bo is an AI and can be wrong. Check important answers against your notes or your instructor.</p></form>`;
    const log = $('#bo-log', main), q = $('#bo-q', main), form = $('#bo-compose', main), sug = $('#bo-suggest', main);
    const scroll = () => { const last = log.lastElementChild; if (last) last.scrollIntoView({ block: 'end', behavior: 'auto' }); };
    const typeset = el => { if (App.typeset) safe(() => App.typeset(el)); };
    const paintFoot = u => { if (!u) return; const left = Math.max(0, u.tutor_limit - u.tutor); $('#bo-foot', main).textContent = `Bo is an AI and can be wrong. Check important answers against your notes or your instructor. ${left} of ${u.tutor_limit} questions left this month.`; };
    paintFoot(st.status && st.status.usage);
    try { await App.loadCourse(id); } catch (e) {}
    paintSide();
    let turns = []; try { turns = (await api('ai_thread&class=' + encodeURIComponent(id))).turns || []; } catch (e) {}
    log.innerHTML = turns.length ? turns.map(t => msgHtml(t.r, t.t || '', '', !!t.v)).join('') : msgHtml('b', greeting(id));
    const tb = $('[data-bo-talk][hidden]'); if (tb) tb.hidden = false;
    typeset(log); scroll();
    sug.innerHTML = suggestions(id).map(x => `<button type="button" class="chip bo-chip" data-bo-say="${esc(x)}">${esc(x)}</button>`).join('');
    if (query.talk && talk()) setTimeout(() => openTalk(false), 300);
    if (query.q === 'quiz') { const s = snapshot(id); q.value = s.readiness && s.readiness.exam ? `Quiz me for ${s.readiness.exam}: one question at a time, starting with my weakest topic.` : 'Quiz me: one question at a time, starting with my weakest topic.'; }
    const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 168) + 'px'; }; q.addEventListener('input', grow); grow();
    const coarse = global.matchMedia && matchMedia('(pointer: coarse)').matches;
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !coarse) { e.preventDefault(); form.requestSubmit(); } });
    const prev = $('#bo-photo-prev', main);
    $('#bo-file', main).addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; try { st.photo = await shrink(f); prev.hidden = false; prev.innerHTML = `<img src="${st.photo.preview}" alt="Your photo"><button type="button" class="icon-btn" data-bo-unphoto aria-label="Remove the photo">${icon('x', 14)}</button>`; } catch (x) { toast(x.message); } });
    prev.addEventListener('click', e => { if (e.target.closest('[data-bo-unphoto]')) { st.photo = null; prev.hidden = true; prev.innerHTML = ''; } });
    sug.addEventListener('click', e => { const b = e.target.closest('[data-bo-say]'); if (!b) return; q.value = b.dataset.boSay; grow(); form.requestSubmit(); });
    log.addEventListener('click', async e => {
      const msg = e.target.closest('.bo-msg'); if (!msg) return; const text = ($('.bo-text', msg) || msg).innerText.trim();
      const rd = e.target.closest('[data-bo-read]'); if (rd) { App.boTalk.read(msg.dataset.src || text, rd, st.status); return; }
      if (e.target.closest('[data-bo-copy]')) { try { await (NATIVE ? N.copy(text) : navigator.clipboard.writeText(text)); toast('Copied.'); } catch (x) { toast('Copying is not available here.'); } return; }
      if (e.target.closest('[data-bo-report]')) { if (App.reportIssue) App.reportIssue({ title: 'Report this answer from Bo', view: 'Ask Bo', course: id, ref: 'Bo · ' + short(id), prompt: text.slice(0, 400), reason: 'wrong', placeholder: 'What is wrong with it? For example: a wrong fact, a wrong answer, or something inappropriate.' }); return; }
      if (e.target.closest('[data-bo-forget]')) { const i = st.notes.indexOf(e.target.closest('[data-bo-forget]').dataset.boForget); try { const r = await api('ai_forget', { what: 'note', i }); st.notes = r.notes || []; e.target.closest('.bo-remember').remove(); toast('Bo forgot it.'); paintSide(); } catch (x) { toast(x.message); } return; }
      if (e.target.closest('[data-bo-retry]')) { const t = msg.dataset.q || ''; msg.remove(); q.value = t; grow(); form.requestSubmit(); }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (st.busy) return;
      const text = q.value.trim(); const photo = st.photo; if (!text && !photo) { q.focus(); return; }
      st.busy = true; q.value = ''; grow(); st.photo = null; prev.hidden = true; prev.innerHTML = ''; sug.hidden = true;
      log.insertAdjacentHTML('beforeend', msgHtml('u', (photo ? '[photo] ' : '') + text));
      log.insertAdjacentHTML('beforeend', `<div class="bo-msg bo typing" id="bo-typing"><span class="bo-mini" aria-hidden="true">${bo(34)}</span><div class="bo-bubble" aria-label="Bo is thinking"><i></i><i></i><i></i></div></div>`); scroll();
      // the answer appears as Bo writes it
      let live = null, sofar = '', frame = 0;
      const paintLive = () => { frame = 0; if (!live) { const t = $('#bo-typing', log); if (t) t.remove(); log.insertAdjacentHTML('beforeend', `<div class="bo-msg bo live"><span class="bo-mini" aria-hidden="true">${bo(34)}</span><div class="bo-bubble"><div class="bo-text"></div></div></div>`); live = log.lastElementChild; } $('.bo-text', live).innerHTML = fmt(sofar.replace(/\[remember:[^\]]*\]?\s*$/i, '')); scroll(); };
      try {
        const r = await App.boAsk(Object.assign({ class: id, q: text, snapshot: snapshot(id), today: App.todayISO() }, photo ? { image: { type: photo.type, data: photo.data } } : {}), d => { sofar += d; if (!frame) frame = requestAnimationFrame(paintLive); });
        cancelAnimationFrame(frame); const t = $('#bo-typing', log); if (t) t.remove(); if (live) live.remove();
        if (r.remembered) st.notes.push(r.remembered);
        if (r.usage && st.status) st.status.usage = r.usage;
        log.insertAdjacentHTML('beforeend', msgHtml('b', r.reply, r.remembered ? `<p class="bo-remember">${icon('bulb', 13)} Bo will remember: ${esc(r.remembered)} <button type="button" class="linkbtn small" data-bo-forget="${esc(r.remembered)}">Forget it</button></p>` : ''));
        typeset(log.lastElementChild); haptic('light'); paintFoot(r.usage); paintSide();
      } catch (x) {
        cancelAnimationFrame(frame); if (live) live.remove();
        const t = $('#bo-typing', log); if (t) t.remove();
        if (x.status === 402) { App.rerender(); return; }
        log.insertAdjacentHTML('beforeend', `<div class="bo-msg bo err" data-q="${esc(text)}"><span class="bo-mini" aria-hidden="true">${bo(34)}</span><div class="bo-bubble"><p>${esc(x.message)}</p>${x.status === 429 ? '' : `<button type="button" class="btn sm" data-bo-retry>Try again</button>`}</div></div>`);
      }
      st.busy = false; scroll();
    });
  }

  /* ---------- What Bo knows: the snapshot in words, Bo's notes, and clearing. A side panel next to the chat
     on wide screens, a sheet (the i button) everywhere else. ---------- */
  function knowsHtml(id) {
    const s = id ? snapshot(id) : {}; const u = st.status && st.status.usage;
    const li = (h, v) => v ? `<li><b>${h}</b><span>${v}</span></li>` : '';
    const ready = s.readiness && s.readiness.exam ? `${esc(s.readiness.exam)}, ${s.readiness.days === 0 ? 'today' : s.readiness.days === 1 ? 'tomorrow' : `in ${s.readiness.days} days`}${s.readiness.score ? `<span class="bo-k-meter" aria-hidden="true"><i style="width:${Math.max(4, Math.min(100, s.readiness.score))}%"></i></span><small>${s.readiness.score}% ready</small>` : ''}` : '';
    const left = u ? Math.max(0, u.tutor_limit - u.tutor) : null;
    return `${id ? `<h3 class="bo-k-h">About ${esc(short(id))}</h3><p class="bo-k-sub">Sent with each question, so Bo's help fits you.</p><ul class="bo-k-list">
        ${li('The class', 'Its syllabus: dates, exams, grading and topics')}
        ${li('Next exam', ready)}
        ${li('Weakest topics', s.weak && s.weak.length ? esc(s.weak.slice(0, 3).map(w => w.t).join(', ')) : '')}
        ${li('Missed lately', s.missed && s.missed.length ? `${s.missed.length} question${s.missed.length === 1 ? '' : 's'}` : '')}
        ${li('To do', `${s.due || 0} flashcards due, ${s.mistakes || 0} missed questions to retry`)}
        ${li('Due soon', s.deadlines && s.deadlines.length ? esc(s.deadlines.slice(0, 3).map(d => d.t).join('; ')) : '')}</ul>` : ''}
      <h3 class="bo-k-h">Bo's notes about you</h3><div class="bo-k-notes">${st.notes.length ? `<ul class="bo-notes">${st.notes.map((n, i) => `<li><span>${esc(n)}</span><button type="button" class="icon-btn" data-k-note="${i}" aria-label="Delete this note">${icon('x', 14)}</button></li>`).join('')}</ul>` : '<p class="small muted">Nothing yet. When you tell Bo how you like to learn, he writes it down here.</p>'}</div>
      ${left !== null ? `<h3 class="bo-k-h">This month</h3><p class="bo-k-use"><span class="bo-k-meter" aria-hidden="true"><i style="width:${Math.round(left / Math.max(1, u.tutor_limit) * 100)}%"></i></span>${left} of ${u.tutor_limit} questions left</p>` : ''}
      <div class="bo-gate-acts">${id ? `<button type="button" class="btn sm" data-k="chat">Clear this chat</button>` : ''}<button type="button" class="btn sm ghost" data-k="all">Forget everything</button></div>`;
  }
  /* note deletes and clearing, for the panel and the sheet; after() repaints whichever asked */
  function wireKnows(el, after, close) {
    if (!el) return;
    el.addEventListener('click', async e => {
      const n = e.target.closest('[data-k-note]'); if (n) { try { const r = await api('ai_forget', { what: 'note', i: +n.dataset.kNote }); st.notes = r.notes || []; after(); } catch (x) { toast(x.message); } return; }
      const k = e.target.closest('[data-k]'); if (!k) return; const id = st.cid;
      if (!confirm(k.dataset.k === 'chat' ? `Clear your chat with Bo about ${short(id)}?` : 'Forget everything Bo knows about you: every chat and every note? Your classes and progress stay.')) return;
      try { await api('ai_forget', k.dataset.k === 'chat' ? { what: 'chat', class: id } : { what: 'all' }); if (k.dataset.k === 'all') st.notes = []; toast(k.dataset.k === 'chat' ? 'Chat cleared.' : 'Bo forgot everything.'); if (close) close(); App.rerender(); } catch (x) { toast(x.message); }
    });
  }
  function paintSide() {
    const side = $('#bo-side'); if (!side || !st.cid) return;
    side.innerHTML = `<h2 class="bo-side-h">${icon('info', 16)} What Bo knows</h2>${knowsHtml(st.cid)}<p class="small muted bo-side-foot">Your chat and these notes are saved with your Mathub account. <a href="#/policy/privacy">Privacy</a></p>`;
  }
  async function knowsSheet() {
    const id = st.cid;
    const old = $('#bo-knows'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'bo-knows'; el.className = NATIVE ? 'modal-backdrop sheet-backdrop' : 'modal-backdrop pw-backdrop';
    el.innerHTML = `<div class="${NATIVE ? 'sheet' : 'modal'} pw bo-knows" role="dialog" aria-modal="true" aria-labelledby="bo-knows-h">${NATIVE ? '<div class="sheet-grab" aria-hidden="true"></div>' : ''}
      <div class="sheet-h"><h2 id="bo-knows-h">What Bo knows</h2><button class="icon-btn" data-action="close" aria-label="Close">${icon('x', 18)}</button></div>
      <div class="bo-k-body">${knowsHtml(id)}</div>
      <p class="small muted">Your chat and these notes are saved with your Mathub account. Questions go to Anthropic's AI to be answered; see the <a href="#/policy/privacy">Privacy Policy</a>.</p></div>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('open'));
    const close = () => { document.removeEventListener('keydown', onKey); el.classList.remove('open'); setTimeout(() => el.remove(), 200); };
    const onKey = e => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', onKey);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-action="close"]')) return close(); if (e.target.closest('a[href]')) return close(); });
    wireKnows(el, () => { $('.bo-k-body', el).innerHTML = knowsHtml(id); paintSide(); }, close);
  }

  /* ---------- ways in: the website's top bar, and the class pages ---------- */
  App.onRender = App.onRender || [];
  App.onRender.push((root, r) => {
    const top = $('#topbar .topbar-actions');
    if (top && !NATIVE) { let a = $('#bo-top', top); if (!a) { a = document.createElement('a'); a.id = 'bo-top'; a.className = 'bo-top'; a.innerHTML = `<span class="bo-top-av" aria-hidden="true">${bo(22)}</span><span>Ask Bo</span>`; const s = $('.search-btn', top); top.insertBefore(a, s || top.firstChild); } a.href = r.course ? `#/tutor/${r.course}` : '#/tutor'; }
  });
})(window);
