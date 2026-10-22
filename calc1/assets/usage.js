/* ============================================================
   Mathub — your credits and what you used them on (#/usage; #/calls goes here too)
   Like Claude's usage page: what is left (the month's credits first, then the ones you bought, which never expire),
   when the month's come back, this month by what you used them on, the last 30 days, what things cost, buying more
   (RevenueCat's web checkout, then "I paid" asks again), every use and every purchase, and how Bo sounds on calls.
   Server: api/credits.php (credits_status, credits_sync). The admin panel's Credits tab is the other side of it.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, toast } = App;
  const t = App.t || (s => s);
  const API = 'api/index.php?r=';
  const RATES = [0.9, 1, 1.1, 1.2];
  const NATIVE = !!(global.Native && global.MATHUB_APP && global.MATHUB_APP.native);   // the apps: buying is on the website, and the apps never link to its checkout
  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, j; try { res = await fetch(API + route, opts); j = await res.json(); } catch (e) { throw new Error('Cannot reach the server.'); }
    if (!j || j.ok === false) throw Object.assign(new Error((j && j.error) || 'Something went wrong.'), { status: res.status, data: j || {} });
    return j;
  }
  // 1,240 · 12.5 · 0
  const cr = n => { const v = Math.max(0, +n || 0); return v >= 100 || Number.isInteger(v) ? Math.round(v).toLocaleString() : v.toFixed(1); };
  const fmt = secs => { const m = Math.max(0, Math.round((secs || 0) / 60)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${m} min`; };
  const when = ts => new Date(ts * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const day = ts => new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const dayISO = iso => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString([], { month: 'long', day: 'numeric' }); };
  const FICON = { chat: 'chat', call: 'phone', image: 'image', voice: 'mic', recap: 'list', memory: 'bulb', class: 'book', other: 'zap' };
  const settings = () => App.settings(); const setSetting = (k, v) => App.setSetting(k, v);
  const planName = p => p === 'max' ? 'Mathub Max' : p === 'pro' ? 'Mathub Pro' : 'Free';

  /* ---------- the parts of the page ---------- */
  function leftHtml(S) {
    const used = S.allowance ? Math.min(100, Math.round(100 * S.month_used / S.allowance)) : 100; const out = S.left < 1 && !S.admin;
    return `<section class="panel us-left${out ? ' out' : ''}" aria-labelledby="us-left-h">
      <div class="us-big"><h2 class="sr-only" id="us-left-h">Credits left</h2><span class="us-big-n" id="us-left">${S.admin ? '∞' : cr(S.left)}</span><span class="us-big-l">${S.admin ? 'Administrators are never charged' : out ? 'You’re out of credits' : 'credits left'}</span></div>
      <div class="us-meters">
        <div class="us-m"><div class="us-m-h"><b>${esc(planName(S.plan))} · monthly credits</b><span><b>${cr(S.month_used)}</b> of ${cr(S.allowance)} used</span></div>
          <div class="us-bar${used >= 90 ? ' hot' : ''}" role="progressbar" aria-label="Monthly credits used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${used}"><i style="width:${used}%"></i></div>
          <p class="us-m-f">Back to ${cr(S.allowance)} on ${esc(dayISO(S.resets))}.</p></div>
        <div class="us-m"><div class="us-m-h"><b>Credits you bought</b><span><b>${cr(S.paid)}</b> left</span></div><p class="us-m-f">Used after the monthly ones. They never expire.</p></div>
      </div>
      <div class="us-buy" id="us-buy">${NATIVE ? `<p class="small muted">Credits are bought on the Mathub website, with the same account.</p>` : S.buy ? `<a class="btn primary lg" href="${esc(S.buy)}" target="_blank" rel="noopener" data-action="us-buy">${icon('plus', 17)} Buy ${cr(S.pack)} credits · ${esc(S.price)}</a><span class="small muted">Paid by card, on a page that opens in a new tab.</span>` : `<span class="small muted">Buying credits opens soon. Questions? <a href="#/contact">Write to us</a>.</span>`}
        <a class="btn ghost" href="#/plan">${icon('gem', 15)} ${S.plan === 'max' ? 'Your plan' : 'More credits every month'}</a></div>
      <div class="us-wait" id="us-wait" hidden><p>${icon('clock', 15)} Finish paying in the new tab, then come back here.</p><button type="button" class="btn" data-action="us-sync">${icon('rotate', 15)} I paid: check now</button></div>
    </section>`;
  }
  function byHtml(S) {
    const by = S.by || []; const max = Math.max(1, ...by.map(b => b.credits));
    if (!by.length) return `<div class="empty small">Nothing used yet this month.</div>`;
    return `<ul class="us-by">${by.map(b => `<li><span class="us-by-ic" aria-hidden="true">${icon(FICON[b.k] || 'zap', 16)}</span><span class="us-by-t">${esc(t(b.t))}<small>${b.n} ${b.n === 1 ? 'time' : 'times'}</small></span><span class="us-by-bar" aria-hidden="true"><i style="width:${Math.max(2, Math.round(100 * b.credits / max))}%"></i></span><b class="us-by-n">${cr(b.credits)}</b></li>`).join('')}</ul>`;
  }
  function daysHtml(S) {
    const map = new Map((S.days || []).map(d => [d.d, d.credits])); const out = []; const now = new Date();
    for (let k = 29; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; out.push([iso, map.get(iso) || 0, d]); }
    const max = Math.max(1, ...out.map(o => o[1])); const W = 600, H = 120, bw = W / out.length;
    const bars = out.map(([iso, v, d], i) => { const h = v ? Math.max(3, Math.round((H - 22) * v / max)) : 1; return `<rect x="${(i * bw + 2).toFixed(1)}" y="${H - 18 - h}" width="${(bw - 4).toFixed(1)}" height="${h}" rx="2" class="${v ? '' : 'z'}"><title>${esc(d.toLocaleDateString([], { month: 'short', day: 'numeric' }))}: ${cr(v)} credits</title></rect>`; }).join('');
    const ticks = [0, 7, 14, 21, 29].map(i => `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${esc(out[i][2].toLocaleDateString([], { month: 'short', day: 'numeric' }))}</text>`).join('');
    return `<svg class="us-days" viewBox="0 0 ${W} ${H}" role="img" aria-label="Credits used each day, the last 30 days">${bars}${ticks}</svg>`;
  }
  function pricesHtml(S) {
    return `<table class="us-prices"><tbody>${(S.prices || []).map(p => `<tr><th scope="row"><span aria-hidden="true">${icon(FICON[p.k] || 'zap', 15)}</span> ${esc(t(p.t))}</th><td><b>${cr(p.c)}</b> credits</td><td class="muted">${esc(t(p.per))}</td></tr>`).join('')}</tbody></table>
      <p class="small muted">A chat message depends on how long it is and how much of the class Bo reads for it. Pictures Bo already made for you are free to see again.</p>`;
  }
  function recentHtml(S) {
    const list = S.recent || []; if (!list.length) return `<div class="empty small">Nothing yet. Ask Bo something, or call him.</div>`;
    return `<ul class="us-list">${list.map(r => `<li><span class="us-when">${esc(when(r.at))}</span><span class="us-what"><span aria-hidden="true">${icon(FICON[r.k] || 'zap', 14)}</span> ${esc(r.detail || t(r.t))}</span><span class="us-n">${r.credits ? '−' + cr(r.credits) : '0'}</span></li>`).join('')}</ul>`;
  }
  function addsHtml(S) {
    const list = S.adds || [];
    return list.length ? `<ul class="us-list">${list.map(a => `<li><span class="us-when">${esc(day(a.at))}</span><span class="us-what">${esc(t(a.note))}</span><span class="us-n ${a.credits < 0 ? 'neg' : 'pos'}">${a.credits < 0 ? '−' : '+'}${cr(Math.abs(a.credits))}</span></li>`).join('')}</ul>` : `<div class="empty small">Nothing bought or given yet.</div>`;
  }
  function plansHtml(S) {
    const P = S.plans || {}; const row = (k, n, p) => `<li class="${S.plan === k || (!S.plan && k === 'free') ? 'on' : ''}"><b>${esc(n)}</b><span>${cr(P[k])} credits a month</span><small>${esc(p)}</small></li>`;
    return `<ul class="us-plans">${row('free', 'Free', '$0')}${row('pro', 'Pro', (P.pro_price || '$15') + ' a month')}${row('max', 'Max', (P.max_price || '$20') + ' a month · the stronger call model')}</ul>`;
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
    const box = $('#us', root); if (!box) return;
    box.innerHTML = `${leftHtml(S)}
      <div class="us-cols">
        <section class="panel" aria-labelledby="us-by-h"><div class="panel-h"><h2 class="panel-title" id="us-by-h">${icon('chart')} This month</h2></div>${byHtml(S)}</section>
        <section class="panel" aria-labelledby="us-days-h"><div class="panel-h"><h2 class="panel-title" id="us-days-h">${icon('calendar')} The last 30 days</h2></div>${daysHtml(S)}</section>
      </div>
      <div class="us-cols">
        <section class="panel" aria-labelledby="us-pr-h"><div class="panel-h"><h2 class="panel-title" id="us-pr-h">${icon('info')} What things cost</h2></div>${pricesHtml(S)}${plansHtml(S)}</section>
        <section class="panel" aria-labelledby="us-add-h"><div class="panel-h"><h2 class="panel-title" id="us-add-h">${icon('plus')} Bought and given</h2></div>${addsHtml(S)}<p class="small muted mt-1">Receipts for what you buy are emailed to you.</p></section>
      </div>
      <section class="panel" aria-labelledby="us-rec-h"><div class="panel-h"><h2 class="panel-title" id="us-rec-h">${icon('list')} Everything you used</h2></div>${recentHtml(S)}</section>
      ${S.enabled ? setHtml(S) : ''}
      <p class="cl-foot small muted"><a href="#/plan">Your plan</a> · <a href="#/policy/create">Terms</a> · <a href="#/policy/privacy">Privacy</a></p>`;
    const set = $('#cl-set', box); if (!set) return;
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

  App.views.usage = {
    title: 'Usage',
    async render(root) {
      const u = App.auth && App.auth.user;
      const head = App.pageHead('Usage', 'Your credits, what you used them on, and buying more.');
      if (!u || u.local) { root.innerHTML = head + App.lockCard('Sign in to see your credits', 'Credits come with your Mathub account: some every month, and more when you buy them.'); return; }
      root.innerHTML = `${head}<div class="us-page" id="us"><div class="panel"><div class="empty">Loading…</div></div></div>`;
      let S; try { S = await api(/[?&]paid=1\b/.test(location.hash) ? 'credits_status&refresh=1' : 'credits_status'); } catch (e) { const b = $('#us', root); if (b) b.innerHTML = `<div class="callout warn">${esc(e.message)}</div>`; return; }
      paint(root, S);
      bind(root, {
        'us-buy': () => { const w = $('#us-wait', root); if (w) w.hidden = false; },
        'us-sync': async b => {
          b.disabled = true;
          try { const r = await api('credits_sync', {}); S = r; paint(root, S); toast(r.added ? t('{1} credits added. Thank you!', cr(r.added * r.pack)) : t('No new purchase yet. If you just paid, give it a minute and check again.'), 4200); }
          catch (e) { toast(e.message, 4000); b.disabled = false; }
        }
      });
    }
  };
  App.views.calls = App.views.usage;   // the old Calls page lives here now
  /* for the start page, the call and the launcher: credits and minutes as words */
  App.credits = { fmt: cr };
  App.callTime = { fmt };
})(window);
