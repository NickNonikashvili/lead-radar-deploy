/* ============================================================
   StudyCat — a study room, for the classmates who join a call with Bo (#/room/CODE; api/room.php).
   The student on the call shares a code (assets/talk.js, the people button). Here, on the whole screen: the
   board as they write on it (and yours: what you write shows on theirs), Bo's pages, the captions of what Bo
   and they say, and a box to type a question that Bo hears and answers out loud on their call. You don't
   hear the call, and they don't hear you. News is asked for about once a second; it ends when the call does.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, esc, icon, toast } = App;
  const API = 'api/index.php?r=';
  const HDR = { 'Content-Type': 'application/json', 'X-Requested-With': 'MatHub' };
  async function post(route, body) {
    let res, j; try { res = await fetch(API + route, { method: 'POST', credentials: 'same-origin', headers: HDR, body: JSON.stringify(body) }); j = await res.json(); } catch (e) { throw new Error('StudyCat cannot be reached right now. Check your connection.'); }
    if (!j || j.ok === false) throw Object.assign(new Error((j && j.error) || 'Something went wrong.'), { status: res.status });
    return j;
  }
  const user = () => (App.auth && App.auth.user) || null;
  const short = id => { const C = global.Courses && global.Courses[id]; return C ? (C.short || C.code) : ''; };

  // the room you are in (one at a time)
  let R = null;
  function stop() { if (!R) return; clearTimeout(R.timer); clearTimeout(R.sendT); if (R.pad) R.pad.destroy(); if (R.el) R.el.remove(); document.documentElement.classList.remove('wb-lock'); global.removeEventListener('keydown', R.keys, true); R = null; }
  addEventListener('hashchange', () => { if (R && !/^#\/room\b/.test(location.hash)) { post('room_leave', { code: R.code }).catch(() => {}); stop(); } });

  function enter(root, j) {
    stop();
    const el = document.createElement('div'); el.className = 'rm'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'rm-h');
    el.innerHTML = `<header class="rm-top"><span class="rm-av" aria-hidden="true">${App.boCharSvg ? App.boCharSvg(App.boChar(), 40) : ''}</span><div class="rm-t"><h2 id="rm-h">Study room with ${esc(j.host || 'a classmate')}</h2><p id="rm-who">${short(j.cid) ? `${esc(short(j.cid))} · ` : ''}<span id="rm-people"></span></p></div><span class="rm-sp"></span><button type="button" class="btn" data-rm="leave">${icon('x', 15)} Leave</button></header>
      <div class="rm-pad" id="rm-pad"></div>
      <div class="rm-caps" id="rm-caps" role="log" aria-live="polite" aria-label="What is said on the call"></div>
      <form class="rm-ask" id="rm-ask"><label class="sr-only" for="rm-q">A question for Bo</label><input class="input" id="rm-q" maxlength="500" autocomplete="off" placeholder="Type a question for Bo…"><button type="submit" class="btn primary">${icon('send', 16)} Ask Bo</button></form>`;
    document.body.appendChild(el); document.documentElement.classList.add('wb-lock');
    R = { code: j.code, host: j.host || 'Your classmate', cid: j.cid, last: j.last || 0, el, out: [], caps: [], seen: new Set(), cards: new Map(), people: j.people || [], timer: 0, sendT: 0, sending: false };
    R.pad = App.boPad ? App.boPad.create($('#rm-pad', el), { insets: () => (global.innerWidth > 760 ? { left: 76 } : { bottom: 70 }), onOp: op => queue('op', op) }) : null;
    if (j.snap && R.pad) R.pad.loadSnap(j.snap);
    (j.pages || []).forEach(page);
    (j.caps || []).forEach(capOf);
    paintCaps(); paintPeople();
    R.keys = e => { if (e.key === 'Escape' && !e.target.closest('.wb-tin, input')) { e.preventDefault(); leave(root); } };
    global.addEventListener('keydown', R.keys, true);
    el.addEventListener('click', e => { if (e.target.closest('[data-rm="leave"]')) leave(root); });
    $('#rm-ask', el).addEventListener('submit', e => {
      e.preventDefault(); const q = $('#rm-q', el); const t = q.value.trim(); if (!t) { q.focus(); return; } q.value = '';
      queue('ask', { t }); R.caps.push({ who: 'me', t: `You asked Bo: ${t}` }); paintCaps();
    });
    setTimeout(() => { if (R && R.pad) R.pad.fit(); }, 60);
    loop();
  }
  function queue(kind, data) { if (!R) return; R.out.push({ kind, data }); clearTimeout(R.sendT); R.sendT = setTimeout(flush, kind === 'op' ? 300 : 60); }
  async function flush() {
    if (!R || R.sending || !R.out.length) return; R.sending = true; const r0 = R, ev = R.out.splice(0, 30);
    try { await post('room_post', { code: r0.code, events: ev }); } catch (e) { if (e.status === 404 || e.status === 403) ended(); else if (e.status === 429) toast(e.message); }
    r0.sending = false; if (R === r0 && R.out.length) flush();
  }
  function loop() { if (!R) return; clearTimeout(R.timer); R.timer = setTimeout(poll, 1000); }
  async function poll() {
    if (!R) return; const r0 = R;
    try {
      const j = await post('room_poll', { code: r0.code, after: r0.last }); if (R !== r0) return;
      R.last = j.last || R.last; R.people = j.people || R.people; paintPeople();
      (j.events || []).forEach(take);
      if (j.ended) return ended();
    } catch (e) { if (e.status === 404 || e.status === 403) return ended(); }
    loop();
  }
  function take(e) {
    const d = e.data || {};
    if (e.kind === 'op' && R.pad) R.pad.remote(d);
    else if (e.kind === 'snap' && R.pad && e.from === 'host') R.pad.loadSnap(d);
    else if (e.kind === 'page') page(d);
    else if (e.kind === 'cap') { capOf(Object.assign({ id: e.id, name: e.name }, d)); paintCaps(); }
    else if (e.kind === 'ask') { R.caps.push({ who: 'guest', t: `${e.name} asked Bo: ${d.t}` }); paintCaps(); }
    else if (e.kind === 'sys' && d.t === 'ended') ended();
    else if (e.kind === 'sys' && e.name) toast(`${e.name} ${d.t === 'joined' ? 'joined' : 'left'}.`, 2200);
  }
  // a caption from the call: Bo, the student on the call (by name), or a classmate's question
  function capOf(d) { if (!R || !d || !d.t || R.seen.has(d.id)) return; if (d.id) R.seen.add(d.id); R.caps.push({ who: d.who === 'bo' ? 'bo' : 'you', t: d.who === 'bo' ? d.t : d.who === 'guest' ? d.t : `${R.host}: ${d.t}` }); }
  function paintCaps() {
    if (!R) return; R.caps = R.caps.slice(-5);
    $('#rm-caps', R.el).innerHTML = R.caps.length ? R.caps.map(c => `<p class="rm-cap ${c.who}">${c.who === 'bo' ? `<b>Bo</b> ` : ''}${esc(c.t)}</p>`).join('') : `<p class="rm-cap hint">What Bo and ${esc(R.host)} say shows up here.</p>`;
  }
  function paintPeople() { if (!R) return; const n = R.people.map(p => p.name); $('#rm-people', R.el).textContent = n.length ? `With you: ${n.join(', ')}` : 'You are the first one here'; }
  // one of Bo's pages, as a card on the board (the same index: a page he added to)
  function page(d) {
    if (!R || !d || !App.boBoard) return; const p = { title: String(d.title || ''), items: Array.isArray(d.items) ? d.items.filter(x => x && typeof x.t === 'string').map(x => ({ k: String(x.k || 'text'), t: x.t })) : [] };
    let el = R.cards.get(d.i);
    if (!el) {
      el = document.createElement('section'); el.className = 'bb bt-card rm-card'; el.setAttribute('aria-label', `Bo’s page ${(+d.i || 0) + 1}`);
      el.innerHTML = App.boBoard.shell({ id: `rmc${+d.i || 0}`, name: `Bo · page ${(+d.i || 0) + 1}`, extra: '' }); App.boBoard.wire(el);
      R.cards.set(d.i, el); if (R.pad) R.pad.addCard(el); else $('#rm-pad', R.el).appendChild(el);
    }
    App.boBoard.paint(el, [p], 0, true); if (App.typeset) try { App.typeset(el); } catch (e) {}
  }
  function ended() {
    if (!R) return; const host = R.host; stop();
    const v = $('#view .rm-page') || $('.rm-page'); if (v) v.innerHTML = `<div class="rm-box"><h1>The call has ended</h1><p class="muted">${esc(host)}’s call with Bo is over, so the study room closed.</p><div class="row gap-sm"><a class="btn primary" href="#/tutor">Ask Bo yourself</a><a class="btn" href="#/">Your classes</a></div></div>`;
  }
  async function leave(root) {
    if (!R) return; const code = R.code; await flush(); post('room_leave', { code }).catch(() => {}); stop();
    location.hash = '#/room';
  }

  App.views.room = {
    title: 'Study room',
    async render(root, param) {
      const code = String(param || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (!user()) { root.innerHTML = `<div class="rm-page">${App.lockCard ? App.lockCard('Log in to join the study room', 'A classmate on a call with Bo shared this room. Log in or sign up with your school email to join them.') : ''}</div>`; if (App.auth && App.auth.bindLocks) App.auth.bindLocks(root); return; }
      const form = (msg = '') => `<div class="rm-page"><form class="rm-box" id="rm-join"><span class="rm-join-av" aria-hidden="true">${App.boCharSvg ? App.boCharSvg(App.boChar(), 72) : ''}</span><h1>Join a study room</h1><p class="muted">A classmate on a call with Bo gives you a code. You see the board and what is said, write on the board with them, and type questions for Bo.</p>
        <label class="field"><span>The code</span><input class="input rm-code" id="rm-code" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC123" value="${esc(code)}" required></label>${msg ? `<p class="rm-err" role="alert">${esc(msg)}</p>` : ''}<button type="submit" class="btn primary lg">${icon('users', 17)} Join</button></form></div>`;
      const wire = () => { const f = $('#rm-join', root); if (f) f.addEventListener('submit', e => { e.preventDefault(); const c = $('#rm-code', root).value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 6) { root.innerHTML = form('A code has six letters and numbers.'); wire(); return; } if (location.hash !== `#/room/${c}`) location.hash = `#/room/${c}`; else join(c); }); };
      const join = async c => {
        root.innerHTML = `<div class="rm-page"><div class="rm-box"><p class="muted">Joining…</p></div></div>`;
        try { const j = await post('room_join', { code: c }); root.innerHTML = `<div class="rm-page"><div class="rm-box"><h1>In the study room</h1><p class="muted">With ${esc(j.host || 'your classmate')} and Bo.</p></div></div>`; enter(root, j); }
        catch (e) { root.innerHTML = form(e.message); wire(); }
      };
      if (R && R.code === code) return;   // already in
      if (code.length === 6) return join(code);
      root.innerHTML = form(); wire(); const i = $('#rm-code', root); if (i) i.focus();
    }
  };
  App._room = () => R ? { code: R.code, items: R.pad ? R.pad.state().items : 0, caps: R.caps.map(c => c.t), cards: R.cards.size, people: R.people.length } : null;   // for the tests
})(window);
