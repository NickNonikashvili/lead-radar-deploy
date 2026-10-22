/* ============================================================
   Mathub — Call Bo: one clear way to start a call (App.callBo)
   The phone button in the top bar (every page), the start page's Bo card and each class's page open this sheet:
   pick the class to talk about (or "Anything else"), see the credits you have and about how many minutes they
   make, who Bo is today, and start. The call itself is assets/talk.js. The first time, the sheet says what a
   call sends where (the same consent as Ask Bo's), and starting counts as agreeing; the call then opens on how a call
   works (assets/talk.js), once.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon } = App;
  const t = App.t || (s => s);
  const API = 'api/index.php?r=';
  const NATIVE = !!(global.Native && global.MATHUB_APP && global.MATHUB_APP.native);
  const settings = () => App.settings(); const setSetting = (k, v) => App.setSetting(k, v);
  const user = () => App.auth && App.auth.user && !App.auth.user.local ? App.auth.user : null;
  const can = () => !!(App.boTalk && App.boTalk.supported()) && !NATIVE;
  async function status() { const r = await fetch(API + 'ai_status', { credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' }); const j = await r.json(); if (!j || j.ok === false) throw new Error((j && j.error) || 'Bo cannot be reached right now.'); return j; }
  const cr = n => App.credits ? App.credits.fmt(n) : String(Math.round(n));
  const classes = () => { const C = global.Courses || {}; const ids = App.myCourses ? App.myCourses().filter(id => C[id]) : []; return ids.map(id => ({ id, short: C[id].short || C[id].code || id, name: C[id].name || '', style: App.life && App.life.ccStyle ? App.life.ccStyle(id) : '' })); };
  const routeCid = () => { const m = /^#\/([a-z0-9_-]+)/i.exec(location.hash || ''); const C = global.Courses || {}; if (m && C[m[1]]) return m[1]; const t2 = /^#\/tutor\/([a-z0-9_-]+)/i.exec(location.hash || ''); return t2 && C[t2[1]] ? t2[1] : ''; };

  const L = { el: null, cid: '', S: null, back: null };
  function close() { if (!L.el) return; L.el.remove(); L.el = null; document.documentElement.classList.remove('cb-lock'); removeEventListener('keydown', keys, true); if (L.back && L.back.focus) try { L.back.focus({ preventScroll: true }); } catch (e) {} }
  function keys(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }
  function paint() {
    const S = L.S; const box = $('.cb-body', L.el); if (!box) return;
    if (!S) { box.innerHTML = `<div class="cb-wait" role="status"><span class="cb-dot"></span> ${esc(t('Getting Bo…'))}</div>`; return; }
    if (S.error) { box.innerHTML = `<p class="callout warn">${esc(S.error)}</p>`; return; }
    if (!S.enabled || !(S.voice && S.voice.live !== undefined)) { box.innerHTML = `<p>${esc(t('Calls with Bo are not switched on yet. He will be here soon.'))}</p>`; return; }
    const K = S.credits || { left: 0, call_rate: 6 }; const rate = K.call_rate || 6; const mins = S.admin ? Infinity : Math.floor((K.left || 0) / rate);
    const list = classes(); if (!L.cid || (L.cid !== 'general' && !list.some(c => c.id === L.cid))) L.cid = routeCid() || (list[0] ? list[0].id : 'general');
    const ch = App.boCharInfo ? App.boCharInfo() : null;
    const out = !S.admin && mins < 1;
    box.innerHTML = `
      <h3 class="cb-h" id="cb-pick-h">${esc(t('What do you want to talk about?'))}</h3>
      <div class="cb-classes" role="radiogroup" aria-labelledby="cb-pick-h">${list.map(c => `<button type="button" role="radio" class="cb-class${L.cid === c.id ? ' on' : ''}" aria-checked="${L.cid === c.id}" data-cb-cid="${esc(c.id)}" style="${esc(c.style)}"><i class="cb-dot2" aria-hidden="true"></i><b>${esc(c.short)}</b><small>${esc(c.name)}</small></button>`).join('')}
        <button type="button" role="radio" class="cb-class cb-any${L.cid === 'general' ? ' on' : ''}" aria-checked="${L.cid === 'general'}" data-cb-cid="general"><i class="cb-dot2" aria-hidden="true"></i><b>${esc(t('Anything else'))}</b><small>${esc(t('Study plans, another subject, any question'))}</small></button></div>
      ${list.length ? '' : `<p class="small muted">${esc(t('Add your classes on the start page and they show up here.'))}</p>`}
      <div class="cb-meta">
        ${ch ? `<p class="cb-who"><span>${esc(t('You’re talking with'))} <b>${esc(ch.name)}</b></span> <a class="linkbtn" href="#/usage" data-cb-close>${esc(t('Change'))}</a></p>` : ''}
        <p class="cb-credits${out ? ' out' : ''}">${S.admin ? esc(t('Administrators are never charged.')) : `<b>${cr(K.left)}</b> ${esc(t('credits'))} · ${out ? esc(t('not enough for a call')) : `${esc(t('about'))} <b>${mins}</b> ${esc(mins === 1 ? t('minute') : t('minutes'))} ${esc(t('at'))} ${cr(rate)} ${esc(t('a minute'))}`}`}</p>
      </div>
      ${!settings().aiConsent ? `<p class="cb-consent small">${icon('shield', 14)} ${esc(t('On a call, what you say, your board and Bo’s answers go to OpenAI, so Bo can hear you and talk back. Nothing is used to train their models.'))} <a href="#/policy/privacy" data-cb-close>${esc(t('Privacy'))}</a></p>` : ''}
      <div class="cb-acts">${out ? `<a class="btn primary lg" href="#/usage" data-cb-close>${icon('plus', 17)} ${esc(t('Get credits'))}</a>` : `<button type="button" class="btn primary lg cb-go" data-cb-go>${icon('phone', 18)} ${esc(t('Start the call'))}</button>`}<button type="button" class="btn ghost" data-cb-close>${esc(t('Not now'))}</button></div>`;
  }
  async function open(o = {}) {
    if (!can()) { if (App.toast) App.toast(t('Calls with Bo are on the Mathub website. Open mathub.space in a browser.'), 4000); return; }
    if (!user()) { if (App.auth) App.auth.open('signup'); return; }
    if (L.el) return;
    L.cid = o.cid || ''; L.S = null; L.back = document.activeElement;
    const el = L.el = document.createElement('div'); el.className = 'cb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'cb-h');
    el.innerHTML = `<div class="cb-scrim" data-cb-close></div><section class="cb-sheet"><header class="cb-top"><span class="cb-av" aria-hidden="true">${App.bobcatSvg ? App.bobcatSvg(44) : ''}</span><div><h2 id="cb-h">${esc(t('Call Bo'))}</h2><p class="small muted">${esc(t('Talk it through out loud, and write on the board together.'))}</p></div><button type="button" class="icon-btn cb-x" data-cb-close aria-label="${esc(t('Close'))}">${icon('x', 18)}</button></header><div class="cb-body"></div></section>`;
    document.body.appendChild(el); document.documentElement.classList.add('cb-lock'); addEventListener('keydown', keys, true);
    paint(); requestAnimationFrame(() => { el.classList.add('open'); const x = $('.cb-x', el); if (x) x.focus(); });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-cb-close]')) { if (e.target.closest('a')) setTimeout(close, 0); else close(); return; }
      const c = e.target.closest('[data-cb-cid]'); if (c) { L.cid = c.dataset.cbCid; $$('[data-cb-cid]', el).forEach(b => { const on = b === c; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); return; }
      if (e.target.closest('[data-cb-go]')) {
        if (!settings().aiConsent) setSetting('aiConsent', Date.now());   // the first call still opens on how a call works, then Start
        const cid = L.cid || 'general', S = L.S; close();
        App.boTalk.open({ cid, status: S, gesture: true, onClose: o.onClose || null });
      }
    });
    try { L.S = await status(); } catch (e) { L.S = { error: e.message }; }
    if (L.S && App.boTalk && App.boTalk.setStatus && !L.S.error) App.boTalk.setStatus(L.S);
    paint(); const go = $('[data-cb-go]', el); if (go) go.focus();
  }
  App.callBo = open; App.callBo.ok = () => can() && !!user();   // calls work here and someone is signed in
  // the top bar's phone button, on every page (shown when calls work here and someone is signed in)
  if (global.document) {
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-action="call-bo"]'); if (!b) return; e.preventDefault(); open({ cid: b.dataset.cid || '' }); });
    const show = () => { const b = document.getElementById('call-top'); if (b) b.hidden = !can() || !user(); };
    App.onRender = App.onRender || []; App.onRender.push(show); addEventListener('mathub-auth', show); setTimeout(show, 0);   // every page, and signing in or out (assets/auth.js)
  }
})(window);
