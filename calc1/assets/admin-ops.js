/* ============================================================
   StudyCat — running the site, in the admin panel (assets/admin.js calls these):
   - Backups: the off-site copies (api/offsite.php): where they go, the newest, the last restore test, send or test now
   - Answer tests (its own tab; api/evals.php): the tests, running them one at a time, every run and what changed
   - Overview: the cost alerts standing and this week's report (api/ops.php), emailed on demand
   - Credits: what Bo cost today and this month against the alerts
   - Growth: how far the last 30 days' sign-ups got, and Bo's cost by feature for 8 weeks
   English only, like the rest of the admin panel.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, esc, icon, bind, toast } = App;
  const API = 'api/index.php?r=';
  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw new Error('Cannot reach the server.'); }
    if (!json || json.ok === false) { const err = new Error((json && json.error) || 'Request failed.'); err.data = json; throw err; }
    return json;
  }
  const ago = ts => ts ? App.ago(ts * 1000) : 'never';
  const size = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const money = v => '$' + (v < 100 ? Number(v || 0).toFixed(2) : Math.round(v).toLocaleString());
  const when = ts => new Date(ts * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const LANGS = [['en', 'English'], ['es', 'Español'], ['ru', 'Русский'], ['fr', 'Français'], ['it', 'Italiano'], ['pt', 'Português'], ['de', 'Deutsch']];

  const Ops = {
    /* ---------- Backups → Off-site copies ---------- */
    async offsite(box) {
      let r; try { r = await api('admin_offsite'); } catch (e) { box.innerHTML = `<div class="panel mb-2"><div class="empty">${esc(e.message)}</div></div>`; return; }
      const res = x => !x ? '' : x.ok ? '<span class="chip xs good">ok</span>' : '<span class="chip xs bad">failed</span>';
      const failed = r.last_send && !r.last_send.ok ? r.last_send : null; const tst = r.last_test;
      box.innerHTML = `<section class="panel mb-2 ops-off" aria-labelledby="ops-off-h"><div class="panel-h"><h2 class="panel-title" id="ops-off-h">${icon('shield')} Off-site copies</h2>${r.ready ? `<div class="row gap-sm"><button type="button" class="btn sm" data-action="off-test">${icon('rotate', 13)} Test a restore now</button><button type="button" class="btn sm primary" data-action="off-now">${icon('upload', 13)} Send the newest copy now</button></div>` : ''}</div>
        ${r.ready ? `<p class="small muted">Each day’s copy is encrypted here, with your passphrase (AES-256), and sent to <b>${esc(r.where)}</b>, which keeps the newest ${r.keep}. Once a week the newest is downloaded again, decrypted and opened, to prove it restores. Keep the passphrase somewhere other than this server: without it nobody can open the copies, you included.</p>`
          : `<div class="callout small mb-2">${icon('bell', 14)} <span>${esc(r.missing)} <a href="#/admin/config">Open Keys &amp; settings</a></span></div><p class="small muted">A copy that stays on this server is lost with it. Off-site copies go to a storage bucket you own with any S3-compatible service (Amazon S3, Cloudflare R2, Backblaze B2, Wasabi), encrypted before they leave, so the storage company cannot read them.</p>`}
        ${r.ready || r.last_sent ? `<div class="ops-off-grid">
          <div class="ops-fact"><span class="eyebrow">Newest copy off-site</span><b>${r.last_sent ? ago(r.last_sent.at) : 'None yet'}</b>${r.last_sent ? `<small class="mono">${esc(r.last_sent.name)}</small><small>${size(r.last_sent.size)} · ${r.last_sent.users} members · ${esc(r.last_sent.note)}</small>` : '<small>The first goes within a day, or send it now.</small>'}</div>
          <div class="ops-fact"><span class="eyebrow">Last restore test</span><b>${tst ? (tst.ok ? 'Passed' : 'Failed') : 'Not yet'}</b>${tst ? `<small>${ago(tst.at)}${tst.name ? ` · <span class="mono">${esc(tst.name)}</span>` : ''}</small><small>${esc(tst.note)}</small>` : '<small>Runs once a week, after the first copy is sent.</small>'}</div></div>` : ''}
        ${failed ? `<div class="callout small mt-2 ops-bad">${icon('flag', 14)} <span>The last send failed ${ago(failed.at)}: ${esc(failed.note)}</span></div>` : ''}
        ${r.log.length ? `<details class="mt-2"><summary class="small">History</summary><div class="table-wrap"><table class="table compact small"><thead><tr><th>What</th><th>When</th><th>Result</th><th>Copy</th><th class="num">Took</th></tr></thead><tbody>${r.log.map(x => `<tr><td>${x.kind === 'send' ? 'Sent' : 'Restore test'}</td><td>${when(x.at)}</td><td>${res(x)}</td><td><span class="mono">${esc(x.name || '–')}</span>${x.note ? `<div class="muted">${esc(x.note)}</div>` : ''}</td><td class="num">${(x.ms / 1000).toFixed(1)} s</td></tr>`).join('')}</tbody></table></div></details>` : ''}
        <p class="small muted mt-2">To open a copy on any computer with PHP: put <code>api/backup-tool.php</code> and <code>api/backupcrypto.php</code> beside it and run <code>php backup-tool.php decrypt copy.sqlite.mhbak restored.sqlite</code>. It asks for the passphrase.</p></section>`;
      const run = async (b, route, done) => {
        const bs = box.querySelectorAll('[data-action^="off-"]'); bs.forEach(x => { x.disabled = true; }); const label = b.innerHTML; b.textContent = route === 'admin_offsite_now' ? 'Sending…' : 'Restoring…';
        try { const x = await api(route, {}); toast(`${icon('check', 14)} ${done(x)}`, 4500); } catch (e) { toast(e.message, 6000); }
        b.innerHTML = label; this.offsite(box);
      };
      bind(box, {
        'off-now': b => run(b, 'admin_offsite_now', x => `Sent ${x.sent.name} (${size(x.sent.size)}) and checked it`),
        'off-test': b => run(b, 'admin_offsite_test', x => `Restore test passed: ${x.tested.note}`)
      });
    },

    /* ---------- Answer tests ---------- */
    async tests(el, state = {}) {
      let r; try { r = await api('admin_eval'); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const S = { cases: r.cases, runs: r.runs, classes: r.classes, model: r.model, ready: r.ready };
      const last = r.runs.find(x => x.status === 'done' || x.status === 'stopped');
      let lastRes = {}; if (last) { try { const d = await api('admin_eval_run&id=' + last.id); d.run.results.forEach(x => { lastRes[x.case] = x; }); } catch (e) { lastRes = {}; } }
      const cname = id => (S.classes.find(c => c.id === id) || {}).name || id;
      const checksOf = c => { const k = c.checks || {}; const out = [];
        if (c.hints) out.push('<span class="chip xs warn">hints only</span>'); if (c.lang && c.lang !== 'en') out.push(`<span class="chip xs">${esc((LANGS.find(l => l[0] === c.lang) || [c.lang, c.lang])[1])}</span>`);
        (k.has || []).forEach(p => out.push(`<span class="chip xs good" title="must contain">has “${esc(p)}”</span>`)); (k.lacks || []).forEach(p => out.push(`<span class="chip xs bad" title="must not contain">not “${esc(p)}”</span>`));
        if (k.number) out.push(`<span class="chip xs" title="a number">${k.number.mode === 'absent' ? 'never states' : 'states'} ${esc(String(k.number.value))}</span>`); if (k.judge) out.push(`<span class="chip xs accent" title="${esc(k.judge)}">judged</span>`);
        return out.join(''); };
      el.innerHTML = `<div class="callout small mb-2">Questions with what a good answer must do, put to Bo exactly as a new student in that class would ask them: the same instructions, class and settings. Run them after changing the model, Bo’s instructions or a class’s settings; a test that passed last time and fails now is marked <b>newly failing</b>. Each run is paid like any use of Bo (about a cent a test), and checks with a judge ask Claude a second time.</div>
        <div class="row between mb-2" style="flex-wrap:wrap;gap:8px"><div class="row gap-sm" style="flex-wrap:wrap"><button type="button" class="btn primary" data-action="ev-run"${S.cases.length && S.ready ? '' : ' disabled'}>${icon('play', 14)} Run all ${S.cases.length} test${S.cases.length === 1 ? '' : 's'}</button><button type="button" class="btn" data-action="ev-new">${icon('plus', 14)} Add a test</button>${S.cases.length < 14 ? '<button type="button" class="btn ghost" data-action="ev-seed">Add the starter tests</button>' : ''}</div><span class="small muted">Model: <span class="mono">${esc(S.model)}</span>${S.ready ? '' : ' · <b>Bo is not set up: add the Anthropic key in Keys &amp; settings</b>'}</span></div>
        <div id="ev-live" aria-live="polite"></div><div id="ev-form"></div>
        <section class="panel mb-2" aria-labelledby="ev-h"><div class="panel-h"><h2 class="panel-title" id="ev-h">${icon('list')} Tests <span class="chip xs">${S.cases.length}</span></h2>${last ? `<span class="small muted">Results from the run ${ago(last.started)}</span>` : ''}</div>
          ${S.cases.length ? `<ul class="ev-list">${S.cases.map(c => { const L = lastRes[c.id]; return `<li class="ev-case"><div class="ev-res">${L ? (L.pass ? `<span class="chip xs good">${icon('check', 11)} passed</span>` : '<span class="chip xs bad">failed</span>') : '<span class="chip xs">not run</span>'}</div><div class="ev-main"><div class="small muted">${c.course ? esc(cname(c.course)) : 'No class'}</div><p class="ev-q">${esc(c.q)}</p><div class="ev-chips">${checksOf(c)}</div>${L && !L.pass ? `<p class="small ev-why">${esc(L.why)}</p>` : ''}</div><div class="row gap-sm"><button type="button" class="btn xs" data-action="ev-edit" data-id="${c.id}">Edit</button><button type="button" class="btn xs ghost" data-action="ev-del" data-id="${c.id}" aria-label="Delete this test">${icon('trash', 12)}</button></div></li>`; }).join('')}</ul>`
            : '<div class="empty">No tests yet. Add the starter tests (questions Bo must get right in Calculus, Physics and Writing), or write your own.</div>'}</section>
        <section class="panel" aria-labelledby="ev-runs-h"><div class="panel-h"><h2 class="panel-title" id="ev-runs-h">${icon('clock')} Runs</h2></div>
          ${S.runs.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>When</th><th>Model</th><th class="num">Passed</th><th>Changes</th><th class="num">Cost</th><th></th></tr></thead><tbody>${S.runs.map(x => `<tr><td>${when(x.started)}${x.status === 'running' ? ' <span class="chip xs warn">running</span>' : x.status === 'stopped' ? ' <span class="chip xs">stopped</span>' : ''}</td><td class="mono small">${esc(x.model)}</td><td class="num"><b>${x.passed}</b> of ${x.done}${x.done < x.n ? ` (${x.n} planned)` : ''}</td><td>${x.regressions ? `<span class="chip xs bad">${x.regressions} newly failing</span> ` : ''}${x.fixed ? `<span class="chip xs good">${x.fixed} fixed</span>` : ''}${!x.regressions && !x.fixed ? '<span class="muted small">–</span>' : ''}</td><td class="num">${money(x.cost)}</td><td><button type="button" class="btn xs" data-action="ev-open" data-id="${x.id}">Results</button></td></tr>`).join('')}</tbody></table></div><div id="ev-run-view"></div>`
            : '<div class="empty">No runs yet.</div>'}</section>`;
      const form = $('#ev-form', el); const live = $('#ev-live', el);
      const editor = c => {
        const k = (c && c.checks) || {}; const N = k.number || {};
        form.innerHTML = `<form class="panel mb-2 ev-edit" aria-labelledby="ev-edit-h"><div class="panel-h"><h2 class="panel-title" id="ev-edit-h">${c ? 'Edit the test' : 'A new test'}</h2></div>
          <div class="grid cols-3 gap-sm"><div class="field"><label for="ev-class">Class</label><select class="select" id="ev-class"><option value="">No class</option>${S.classes.map(x => `<option value="${esc(x.id)}"${c && c.course === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="ev-lang">The student’s language</label><select class="select" id="ev-lang">${LANGS.map(([v, l]) => `<option value="${v}"${(c ? c.lang : 'en') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
            <label class="ev-check"><input type="checkbox" id="ev-hints"${c && c.hints ? ' checked' : ''}> <span>The class is set to hints only</span></label></div>
          <div class="field"><label for="ev-q">The student’s question</label><textarea class="input" id="ev-q" rows="3" maxlength="2000" required>${esc(c ? c.q : '')}</textarea></div>
          <p class="small muted">Give at least one check. A test passes when every check it has passes.</p>
          <div class="grid cols-2 gap-sm"><div class="field"><label for="ev-has">The answer must contain <span class="muted">(one per line; “right | correct” means either)</span></label><textarea class="input mono" id="ev-has" rows="3">${esc((k.has || []).join('\n'))}</textarea></div>
            <div class="field"><label for="ev-lacks">It must not contain <span class="muted">(one per line)</span></label><textarea class="input mono" id="ev-lacks" rows="3">${esc((k.lacks || []).join('\n'))}</textarea></div></div>
          <div class="row gap-sm ev-num" style="flex-wrap:wrap;align-items:flex-end"><div class="field"><label for="ev-nmode">A number</label><select class="select" id="ev-nmode"><option value="present"${N.mode !== 'absent' ? ' selected' : ''}>It must state</option><option value="absent"${N.mode === 'absent' ? ' selected' : ''}>It must never state</option></select></div><div class="field"><label for="ev-nval">The value</label><input class="input" id="ev-nval" inputmode="decimal" value="${N.value != null ? esc(String(N.value)) : ''}" placeholder="for example 9"></div><div class="field"><label for="ev-ntol">Within</label><input class="input" id="ev-ntol" inputmode="decimal" value="${N.tol != null ? esc(String(N.tol)) : '0.0001'}"></div></div>
          <div class="field"><label for="ev-judge">What a good answer does <span class="muted">(Claude judges it)</span></label><textarea class="input" id="ev-judge" rows="2" maxlength="600" placeholder="For example: says x = 7 is not correct and does not agree with it.">${esc(k.judge || '')}</textarea></div>
          <div class="row gap-sm"><button type="submit" class="btn primary">Save the test</button><button type="button" class="btn ghost" data-action="ev-cancel">Cancel</button></div></form>`;
        const f = $('form', form); $('#ev-q', f).focus();
        f.addEventListener('submit', async e => {
          e.preventDefault(); const lines = id => $(id, f).value.split('\n').map(s => s.trim()).filter(Boolean);
          const body = { id: c ? c.id : 0, case: { course: $('#ev-class', f).value, lang: $('#ev-lang', f).value, hints: $('#ev-hints', f).checked, q: $('#ev-q', f).value, checks: { has: lines('#ev-has'), lacks: lines('#ev-lacks'), judge: $('#ev-judge', f).value, number: { value: $('#ev-nval', f).value.trim(), mode: $('#ev-nmode', f).value, tol: $('#ev-ntol', f).value.trim() } } } };
          try { await api('admin_eval_save', body); toast(`${icon('check', 14)} Saved`); this.tests(el); } catch (err) { toast(err.message, 5000); }
        });
        form.scrollIntoView({ block: 'nearest' });
      };
      const showRun = async id => {
        const box = $('#ev-run-view', el); box.innerHTML = '<div class="empty">Opening…</div>';
        let d; try { d = (await api('admin_eval_run&id=' + id)).run; } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
        const order = d.results.slice().sort((a, b) => (Number(b.was === true && !b.pass) - Number(a.was === true && !a.pass)) || (Number(a.pass) - Number(b.pass)));
        box.innerHTML = `<div class="ev-run mt-2"><div class="row between"><h3 class="ev-run-h">Run of ${when(d.started)}: ${d.passed} of ${d.done} passed</h3><button type="button" class="btn xs ghost" data-action="ev-close">Close</button></div>
          <ul class="ev-results">${order.map(x => `<li class="${x.pass ? 'ok' : 'no'}"><div class="row gap-sm" style="flex-wrap:wrap">${x.pass ? `<span class="chip xs good">${icon('check', 11)} passed</span>` : '<span class="chip xs bad">failed</span>'}${x.was === true && !x.pass ? '<span class="chip xs bad">newly failing</span>' : x.was === false && x.pass ? '<span class="chip xs good">fixed</span>' : ''}<span class="small muted">${(x.ms / 1000).toFixed(1)} s</span></div><p class="ev-q">${esc(x.q)}</p><p class="small">${esc(x.why)}</p>${x.answer ? `<details><summary class="small">Bo’s answer</summary><pre class="bq-a">${esc(x.answer)}</pre></details>` : ''}</li>`).join('')}</ul></div>`;
        bind(box, { 'ev-close': () => { box.innerHTML = ''; } });
      };
      let stop = false;
      bind(el, {
        'ev-new': () => editor(null),
        'ev-edit': b => editor(S.cases.find(c => c.id === +b.dataset.id)),
        'ev-cancel': () => { form.innerHTML = ''; },
        'ev-del': async b => { if (!confirm('Delete this test? Past runs keep its results.')) return; try { await api('admin_eval_delete', { id: +b.dataset.id }); this.tests(el); } catch (e) { toast(e.message); } },
        'ev-seed': async b => { b.disabled = true; try { const x = await api('admin_eval_seed', {}); toast(`${icon('check', 14)} Added ${x.added} test${x.added === 1 ? '' : 's'}`); } catch (e) { toast(e.message); } this.tests(el); },
        'ev-open': b => showRun(+b.dataset.id),
        'ev-stop': () => { stop = true; },
        'ev-run': async b => {
          let s; try { s = await api('admin_eval_start', {}); } catch (e) { toast(e.message, 5000); return; }
          b.disabled = true; stop = false; const n = s.cases.length; let done = 0, passed = 0; const rows = [];
          const paint = (cur) => { live.innerHTML = `<section class="panel mb-2 ev-running" aria-label="The run"><div class="row between"><b>${cur ? `Asking Bo test ${done + 1} of ${n}…` : `Done: ${passed} of ${done} passed`}</b>${cur ? '<button type="button" class="btn xs" data-action="ev-stop">Stop</button>' : ''}</div><div class="ev-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${done}" aria-label="Tests run"><i style="width:${Math.round(100 * done / Math.max(1, n))}%"></i></div>
            ${rows.length ? `<ul class="ev-results small">${rows.map(x => `<li class="${x.pass ? 'ok' : 'no'}">${x.pass ? `<span class="chip xs good">${icon('check', 11)} passed</span>` : '<span class="chip xs bad">failed</span>'}${x.was === true && !x.pass ? ' <span class="chip xs bad">newly failing</span>' : ''} ${esc(x.q.length > 110 ? x.q.slice(0, 110) + '…' : x.q)}${x.pass ? '' : `<div class="muted">${esc(x.why)}</div>`}</li>`).join('')}</ul>` : ''}</section>`; };
          paint(true);
          for (const id of s.cases) {
            if (stop) { try { await api('admin_eval_stop', { run: s.run }); } catch (e) { /* the run stays running until the next one starts */ } break; }
            try { const x = await api('admin_eval_step', { run: s.run, case: id }); done = x.done; passed = x.passed; rows.push(x.result); }
            catch (e) { toast(e.message, 5000); try { await api('admin_eval_stop', { run: s.run }); } catch (e2) { /* as above */ } break; }
            paint(true);
          }
          paint(false); toast(stop ? 'Stopped' : `${icon('check', 14)} ${passed} of ${done} passed`, 4000);
          setTimeout(() => this.tests(el), 1200);
        }
      });
    },

    /* ---------- Overview: alerts and this week's report ---------- */
    alertLine(a) { const what = { day: 'today', month: 'this month', spike: 'today, over three times a usual day' }[a.kind] || ''; return `Bo has cost ${money(a.usd)} ${what}${a.kind === 'spike' ? '' : ` (your alert: ${money(a.limit)})`}.${a.note ? ' ' + a.note : ''}`; },
    async report(box) {
      let r; try { r = await api('admin_ops'); } catch (e) { box.innerHTML = ''; return; }
      const R = r.report;
      box.innerHTML = `${r.alerts.length ? `<div class="callout mb-2 ops-alert" role="status">${icon('bell', 15)} <div>${r.alerts.map(a => `<p>${esc(this.alertLine(a))}</p>`).join('')}<a href="#/admin/credits" class="small">Who used what</a></div></div>` : ''}
        <section class="panel mb-2 ops-week" aria-labelledby="ops-week-h"><div class="panel-h"><h2 class="panel-title" id="ops-week-h">${icon('calendar')} The last seven days <span class="small muted">${esc(R.label)}</span></h2><button type="button" class="btn sm" data-action="ops-send">${icon('send', 13)} Email me this report</button></div>
          <div class="ops-sections">${Object.entries(R.sections).map(([h, lines]) => `<div class="ops-sec"><h3>${esc(h)}</h3><ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')}</div>
          <p class="small muted mt-2">${R.on ? `Every administrator gets this by email each week${R.next ? `; the next on ${esc(when(R.next))}` : ''}${R.sent ? ` (the last went ${ago(R.sent)})` : ''}.` : 'The weekly email is off.'} Change it under <a href="#/admin/config">Keys &amp; settings → Email</a>.</p></section>`;
      bind(box, { 'ops-send': async b => { b.disabled = true; try { const x = await api('admin_ops_send', {}); toast(`${icon('check', 14)} ${x.logged ? 'Written to the mail log (mail_mode is log)' : 'Sent to ' + esc(x.to)}`, 4500); } catch (e) { toast(e.message, 5000); } b.disabled = false; } });
    },

    /* ---------- Credits: cost against the alerts ---------- */
    async cost(box) {
      let r; try { r = await api('admin_ops'); } catch (e) { box.innerHTML = ''; return; }
      const C = r.cost; const bar = (v, lim) => lim > 0 ? `<span class="ops-meter" role="img" aria-label="${money(v)} of ${money(lim)}"><i style="width:${Math.min(100, Math.round(100 * v / lim))}%"${v >= lim ? ' class="over"' : ''}></i></span>` : '';
      box.innerHTML = `${r.alerts.length ? `<div class="callout mb-2 ops-alert" role="status">${icon('bell', 15)} <div>${r.alerts.map(a => `<p>${esc(this.alertLine(a))}</p>`).join('')}</div></div>` : ''}
        <div class="ops-cost mb-2"><div class="ops-fact"><span class="eyebrow">Bo’s cost today</span><b>${money(C.today)}</b>${bar(C.today, C.limit_day)}<small>${C.limit_day > 0 ? `alert at ${money(C.limit_day)}` : 'no daily alert set'}</small></div>
          <div class="ops-fact"><span class="eyebrow">This month</span><b>${money(C.month)}</b>${bar(C.month, C.limit_month)}<small>${C.limit_month > 0 ? `alert at ${money(C.limit_month)}` : 'no monthly alert set'}</small></div>
          <p class="small muted">Estimated from the credits used (credits ÷ the markup = cents), administrators’ use included. Set the alerts under <a href="#/admin/config">Keys &amp; settings → Plans and payments</a>; a day that costs over three times the usual also sends one.</p></div>`;
    },

    /* ---------- Growth: how far new members get, and Bo's cost by feature ---------- */
    usage(box, U) {
      if (!U) { box.innerHTML = ''; return; }
      const F = U.funnel; const top = Math.max(1, F.signed_up);
      const steps = [['signed_up', 'Signed up'], ['confirmed', 'Confirmed their email'], ['returned', 'Came back another day'], ['asked_bo', 'Asked Bo something'], ['paid', 'Bought credits or a plan']];
      const maxW = Math.max(0.01, ...U.weeks.map(w => w.usd)); const feats = []; U.weeks.forEach(w => w.by.forEach(b => { if (!feats.includes(b.title)) feats.push(b.title); }));
      box.innerHTML = `<div class="grid cols-2 mt-2"><section class="panel" aria-labelledby="ops-fun-h"><div class="panel-h"><h2 class="panel-title" id="ops-fun-h">${icon('path')} How far new members get</h2><span class="small muted">signed up in the last 30 days</span></div>
          ${F.signed_up ? `<ol class="ops-funnel">${steps.map(([k, l]) => `<li><span>${l}</span><span class="ops-meter" aria-hidden="true"><i style="width:${Math.round(100 * F[k] / top)}%"></i></span><b>${F[k]}</b><small>${Math.round(100 * F[k] / top)}%</small></li>`).join('')}</ol>` : '<div class="empty">Nobody signed up in the last 30 days.</div>'}</section>
        <section class="panel" aria-labelledby="ops-boc-h"><div class="panel-h"><h2 class="panel-title" id="ops-boc-h">${icon('chart')} What Bo cost, by week</h2><span class="small muted">estimated</span></div>
          <div class="table-wrap"><table class="table compact small"><thead><tr><th>Week of</th><th class="num">Cost</th><th>Most of it</th></tr></thead><tbody>${U.weeks.map(w => `<tr><td>${esc(w.label)}</td><td class="num"><span class="ops-meter sm" aria-hidden="true"><i style="width:${Math.round(100 * w.usd / maxW)}%"></i></span> ${money(w.usd)}</td><td>${w.by.slice(0, 2).map(b => `${esc(b.title)} ${money(b.usd)}`).join(' · ') || '<span class="muted">–</span>'}</td></tr>`).join('')}</tbody></table></div></section></div>`;
    }
  };
  App.adminOps = Ops;
})(window);
