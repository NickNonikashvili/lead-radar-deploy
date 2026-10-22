/* ============================================================
   Mathub — your calls with Bo (#/calls)
   What is left (with Mathub Max: the month's included hour first, then the hours you bought, which never expire),
   buying an hour (RevenueCat's web checkout, then "I paid" asks again), this month, every call and what it used,
   every purchase and gift, and how Bo sounds on calls (the same settings as the call's own sheet, assets/talk.js).
   Without Max: what calls cost, the free minutes, and hours bought before, kept. Server: api/calls.php.
   The admin panel's Calls tab is the other side of it (assets/admin.js).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, toast } = App;
  const t = App.t || (s => s);
  const API = 'api/index.php?r=';
  const RATES = [0.9, 1, 1.1, 1.2];
  const NATIVE = !!(global.Native && global.MATHUB_APP && global.MATHUB_APP.native);   // the apps: calls are on the website, and the apps never link to its checkout
  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, j; try { res = await fetch(API + route, opts); j = await res.json(); } catch (e) { throw new Error('Cannot reach the server.'); }
    if (!j || j.ok === false) throw Object.assign(new Error((j && j.error) || 'Something went wrong.'), { status: res.status, data: j || {} });
    return j;
  }
  // 3 h 5 min, 45 min, 0 min
  const fmt = secs => { const m = Math.max(0, Math.round((secs || 0) / 60)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${m} min`; };
  const when = ts => new Date(ts * 1000).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const day = ts => new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const dayISO = iso => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString([], { month: 'long', day: 'numeric' }); };
  const cname = cid => { const C = global.Courses && global.Courses[cid]; return C ? (C.short || C.code) : cid || 'Bo'; };
  const settings = () => App.settings(); const setSetting = (k, v) => App.setSetting(k, v);

  /* ---------- the parts of the page ---------- */
  function timeHtml(S) {
    if (!S.max) {
      const trial = S.trial && S.trial.left > 0 ? S.trial.left : 0;
      return `<section class="panel cl-time cl-up" aria-labelledby="cl-up-h"><div class="cl-up-t"><h2 id="cl-up-h">Calls with Bo come with Mathub Max</h2>
        <p>${esc(S.max_price)} a month, with <b>${fmt(S.included)} of calls every month</b>. More time is ${esc(S.price)} for ${fmt(S.pack)}, and what you buy never runs out at the end of the month.</p></div>
        <div class="row gap-sm cl-acts"><button type="button" class="btn primary lg" data-action="cl-max">${icon('gem', 17)} Get Mathub Max</button>${trial ? `<a class="btn lg" href="#/">${icon('phone', 17)} Call Bo free: ${fmt(trial)} on us</a>` : ''}</div>
        ${S.balance ? `<p class="cl-kept">${icon('check', 14)} You have <b>${fmt(S.balance)}</b> of call time you bought, kept for when Max is back.</p>` : ''}</section>`;
    }
    const pct = S.included ? Math.round(100 * (S.included - S.included_left) / S.included) : 100;
    const out = S.left <= 0;
    return `<section class="panel cl-time${out ? ' out' : ''}" aria-labelledby="cl-left-h">
      <div class="cl-big"><h2 class="sr-only" id="cl-left-h">Call time left</h2><span class="cl-big-n" id="cl-left">${fmt(S.left)}</span><span class="cl-big-l">${out ? 'You are out of call time' : 'of calls with Bo left'}</span></div>
      <div class="cl-parts">
        <div class="pl-m${S.included_left <= 0 ? ' low' : ''}"><div class="pl-m-h"><b>This month’s hour</b><span><b>${fmt(S.included_left)}</b> of ${fmt(S.included)} left</span></div><div class="pl-bar" role="progressbar" aria-label="This month’s hour" aria-valuemin="0" aria-valuemax="${S.included}" aria-valuenow="${S.included - S.included_left}"><i style="width:${pct}%"></i></div><p class="pl-m-f">Comes back on ${esc(dayISO(S.resets))}. Calls use it first.</p></div>
        <div class="pl-m"><div class="pl-m-h"><b>Hours you bought</b><span><b>${fmt(S.balance)}</b> left</span></div><p class="pl-m-f">Used after this month’s hour. They never run out at the end of the month.</p></div>
      </div>
      <div class="cl-buy" id="cl-buy">${S.buy ? `<a class="btn primary lg" href="${esc(S.buy)}" target="_blank" rel="noopener" data-action="cl-buy">${icon('plus', 17)} Buy ${fmt(S.pack)} · ${esc(S.price)}</a><span class="small muted">Paid by card through Stripe, on a page that opens in a new tab.</span>` : '<p class="small muted">Buying more call time is not open yet. If you need more, write to us from the <a href="#/contact">Contact page</a>.</p>'}</div>
      <div class="cl-wait" id="cl-wait" hidden><p>${icon('clock', 15)} Finish paying in the new tab, then come back here.</p><button type="button" class="btn" data-action="cl-sync">${icon('rotate', 15)} I paid: check now</button></div>
      <p class="cl-fine small muted">A call lasts up to ${fmt(S.per_call)}, and you can call again right away. ${S.daily ? `At most ${fmt(S.daily)} a day.` : ''}</p></section>`;
  }
  function monthHtml(S) {
    const m = S.this_month || { calls: 0, secs: 0 };
    return `<div class="cl-stats"><div><b>${m.calls}</b><span>call${m.calls === 1 ? '' : 's'} this month</span></div><div><b>${fmt(m.secs)}</b><span>talking with Bo this month</span></div><div><b>${fmt(S.max ? S.included - S.included_left : 0)}</b><span>of this month’s hour used</span></div></div>`;
  }
  function callsHtml(S) {
    const list = S.calls || [];
    if (!list.length) return `<div class="empty small">No calls yet. Call Bo from the start page or from Ask Bo.</div>`;
    return `<ul class="cl-list">${list.map(c => `<li><span class="cl-when">${esc(when(c.at))}</span><span class="cl-cls">${esc(cname(c.cid))}</span><span class="cl-len">${esc(fmt(c.secs))}</span><span class="cl-from">${c.free ? 'free minutes' : c.paid ? `${esc(fmt(c.paid))} from your hours` : 'this month’s hour'}</span></li>`).join('')}</ul>`;
  }
  function creditsHtml(S) {
    const list = S.credits || [];
    return list.length ? `<ul class="cl-list cl-credits">${list.map(c => `<li><span class="cl-when">${esc(day(c.at))}</span><span class="cl-cls">${esc(t(c.note))}</span><span class="cl-len ${c.secs < 0 ? 'neg' : 'pos'}">${c.secs < 0 ? '−' : '+'}${esc(fmt(Math.abs(c.secs)))}</span></li>`).join('')}</ul>` : '<div class="empty small">Nothing bought yet.</div>';
  }
  /* how Bo sounds on calls: the call sheet's settings (assets/talk.js), here too */
  function setHtml(S) {
    const s = settings(); const ch = App.boCharInfo ? App.boCharInfo() : null;
    const voice = S.voices[s.boLiveVoice] ? s.boLiveVoice : ch && S.voices[ch.live] ? ch.live : S.voice_default;
    const rate = RATES.includes(+s.boLiveRate) ? +s.boLiveRate : ch && RATES.includes(ch.rate) ? ch.rate : 1;
    const eager = ['low', 'auto', 'high'].includes(s.boEager) ? s.boEager : 'auto';
    const chips = (list, cur, attr, label) => list.map(v => `<button type="button" role="radio" class="chip toggle${cur === v ? ' on' : ''}" aria-checked="${cur === v}" ${attr}="${v}">${esc(label(v))}</button>`).join('');
    return `<section class="panel cl-set" id="cl-set" aria-labelledby="cl-set-h"><div class="panel-h"><h2 class="panel-title" id="cl-set-h">${icon('sliders')} How Bo sounds on calls</h2></div>
      ${App.boCharPicker ? `<h3 class="cl-set-h">Who Bo is</h3>${App.boCharPicker({ name: 'cl-char', compact: true })}` : ''}
      <h3 class="cl-set-h">His voice</h3><div class="cl-opts" role="radiogroup" aria-label="Bo's voice">${Object.entries(S.voices).map(([k, l]) => `<label class="bt-opt"><input type="radio" name="cl-voice" value="${esc(k)}"${voice === k ? ' checked' : ''}><span>${esc(t(l))}</span></label>`).join('')}</div>
      <h3 class="cl-set-h">How fast he talks</h3><div class="cl-chips" role="radiogroup" aria-label="Speed">${chips(RATES.map(String), String(rate), 'data-cl-rate', r => +r === 1 ? 'Normal' : r + '×')}</div>
      <h3 class="cl-set-h">When he jumps in</h3><div class="cl-chips" role="radiogroup" aria-label="When Bo jumps in">${chips(['low', 'auto', 'high'], eager, 'data-cl-eager', v => ({ low: 'Lets me finish', auto: 'Normal', high: 'Quick' })[v])}</div>
      <label class="bt-switch"><input type="checkbox" id="cl-hs"${s.boHeadset === true ? ' checked' : ''}><span><b>I’m wearing headphones</b> Bo listens for a voice close to the mic</span></label>
      <label class="bt-switch"><input type="checkbox" id="cl-hd"${s.boHalf === true ? ' checked' : ''}><span><b>My speakers echo</b> Bo waits for a clearly louder voice before he stops for you. You can always tap him to stop him</span></label>
      <label class="bt-switch"><input type="checkbox" id="cl-cp"${s.boCaptions !== false ? ' checked' : ''}><span><b>Captions</b> What you and Bo say, at the bottom of the call</span></label>
      <p class="small muted">These apply from your next call. Recap emails after calls are in <a href="#/settings">Settings</a>.</p></section>`;
  }

  function paint(root, S) {
    const box = $('#cl', root); if (!box) return;
    box.innerHTML = `${timeHtml(S)}
      <div class="cl-cols"><section class="panel" aria-labelledby="cl-calls-h"><div class="panel-h"><h2 class="panel-title" id="cl-calls-h">${icon('phone')} Your calls</h2></div>${monthHtml(S)}${callsHtml(S)}</section>
      <section class="panel" aria-labelledby="cl-cred-h"><div class="panel-h"><h2 class="panel-title" id="cl-cred-h">${icon('list')} Bought and given</h2></div>${creditsHtml(S)}<p class="small muted mt-1">Receipts for what you buy are emailed to you by Stripe. A question about a charge? <a href="#/contact">Write to us</a>.</p></section></div>
      ${setHtml(S)}
      <p class="cl-foot small muted"><a href="#/plan">Your plan</a> · <a href="#/policy/create">Terms</a> · <a href="#/policy/privacy">Privacy</a></p>`;
    const set = $('#cl-set', box);
    if (App.boCharWire) App.boCharWire(set, () => paint(root, S));   // a character brings his own voice and pace
    set.addEventListener('change', e => {
      const x = e.target;
      if (x.name === 'cl-voice') { setSetting('boLiveVoice', x.value); toast(t('Bo’s voice is set for your next call.'), 2200); }
      if (x.id === 'cl-hs') setSetting('boHeadset', x.checked);
      if (x.id === 'cl-hd') setSetting('boHalf', x.checked);
      if (x.id === 'cl-cp') setSetting('boCaptions', x.checked);
    });
    set.addEventListener('click', e => {
      const r = e.target.closest('[data-cl-rate], [data-cl-eager]'); if (!r) return;
      if (r.dataset.clRate) setSetting('boLiveRate', +r.dataset.clRate); else setSetting('boEager', r.dataset.clEager);
      const attr = r.dataset.clRate ? 'data-cl-rate' : 'data-cl-eager';
      $$(`[${attr}]`, set).forEach(b => { const on = b === r; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    });
  }

  App.views.calls = {
    title: 'Calls with Bo',
    async render(root) {
      const u = App.auth && App.auth.user;
      const head = App.pageHead('Calls with Bo', 'Your call time, buying more, every call, and how Bo sounds.');
      if (NATIVE) { root.innerHTML = `${head}<div class="panel"><p>Calls with Bo are on the Mathub website, with the same account.</p></div>`; return; }
      if (!u || u.local) { root.innerHTML = head + App.lockCard('Sign in to see your calls', 'Your call time and your calls with Bo are kept with your Mathub account.'); return; }
      root.innerHTML = `${head}<div class="cl-page" id="cl"><div class="panel"><div class="empty">Loading…</div></div></div>`;
      let S; try { S = await api(/[?&]paid=1\b/.test(location.hash) ? 'calls_status&refresh=1' : 'calls_status'); } catch (e) { const b = $('#cl', root); if (b) b.innerHTML = `<div class="callout warn">${esc(e.message)}</div>`; return; }
      paint(root, S);
      bind(root, {
        'cl-max': async () => { if (App.paywall && await App.paywall({ need: 'max', reason: 'bo' })) App.rerender(); },
        'cl-buy': () => { const w = $('#cl-wait', root); if (w) w.hidden = false; },
        'cl-sync': async b => {
          b.disabled = true;
          try { const r = await api('calls_sync', {}); S = r; paint(root, S); toast(r.added ? t('{1} added. Thank you!', fmt(r.added * r.pack)) : t('No new purchase yet. If you just paid, give it a minute and check again.'), 4200); }
          catch (e) { toast(e.message, 4000); b.disabled = false; }
        }
      });
    }
  };
  /* for the start page and the call: what is left, as words */
  App.callTime = { fmt };
})(window);
