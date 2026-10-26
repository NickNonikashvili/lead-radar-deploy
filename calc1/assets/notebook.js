/* ============================================================
   Mathub — the writer's notebook (D.NOTEBOOK; api/notebook.php). A writing class's numbered entries (WRIT 101: fifteen,
   reviewed weekly and handed in together at the end), written here and kept with the account. Private, and no AI:
   Bo is not part of it. Each entry has the prompt the student copies in from class and their writing, saved as they
   type (a copy stays on this device until the server has it, so nothing is lost offline). The whole notebook downloads
   as one Word file or plain text, or prints, for handing in. A reflection entry links to its project's revision
   history (assets/drafts.js). View: notebook (the list), notebook/<n> (one entry).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, on, toast } = App;
  const API = 'api/index.php?r=';
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const user = () => { const a = App.auth; return a && a.user && !a.user.local && a.mode === 'server' ? a.user : null; };
  const NB = () => (App.D && App.D.NOTEBOOK) || null;
  const cid = () => (App.D ? App.D.id : '');
  const num = n => Number(n).toLocaleString(App.lang || 'en');
  const wordsOf = s => (String(s || '').trim().match(/\S+/g) || []).length;
  const wordsLabel = n => n === 1 ? t('1 word') : t('{1} words', num(n));
  const S = { cid: '', loaded: false, entries: {}, dirty: {}, busy: {}, timer: {}, retry: 0, root: null, conflicts: {} };

  async function api(route, body, keepalive) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store', keepalive: !!keepalive };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw Object.assign(new Error('Mathub cannot be reached right now.'), { network: true }); }
    if (!json || json.ok === false) throw Object.assign(new Error((json && json.error) || 'Something went wrong. Please try again.'), { status: res.status, data: json });
    return json;
  }
  /* what was typed but not yet on the server, by entry: { n: { prompt, text, at, base } } (base: the saved version it was written on) */
  const LOCAL = () => 'mathub-notebook-' + cid();
  const local = () => { try { return JSON.parse(localStorage.getItem(LOCAL()) || '{}') || {}; } catch (e) { return {}; } };
  const setLocal = o => { try { if (Object.keys(o).length) localStorage.setItem(LOCAL(), JSON.stringify(o)); else localStorage.removeItem(LOCAL()); } catch (e) {} };
  /* a device copy the server refused (the entry changed on another device) waits here, apart, until they pick one */
  const CONF = () => 'mathub-notebook-conflicts-' + cid();
  const conflicts = () => { try { return JSON.parse(localStorage.getItem(CONF()) || '{}') || {}; } catch (e) { return {}; } };
  const setConflicts = o => { try { if (Object.keys(o).length) localStorage.setItem(CONF(), JSON.stringify(o)); else localStorage.removeItem(CONF()); } catch (e) {} };
  /* this browser, so the server can tell its own saves from another device's */
  let devId = '';
  function DEV() {
    if (devId) return devId;
    try { devId = localStorage.getItem('mathub-device') || ''; } catch (e) {}
    if (!/^[a-z0-9]{8,32}$/.test(devId)) { const b = new Uint8Array(10); (global.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256; }); devId = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('mathub-device', devId); } catch (e) {} }
    return devId;
  }

  const entryInfo = n => { const e = (NB().entries || []).find(x => x.n === n) || { n }; return e; };
  const weekOf = id => { const s = ((App.D && App.D.SECTIONS) || []).find(x => x.id === id); return s ? `${s.label}: ${s.title}` : ''; };
  function thisWeek() {   // the week the calendar is in (its latest class meeting)
    const today = App.todayISO(); const lec = ((App.D && App.D.CALENDAR) || []).filter(e => e[1] === 'lecture' && e[3] && e[0] <= today).pop();
    return lec ? lec[3] : ((App.D.SECTIONS || [])[0] || {}).id;
  }
  const titleOf = n => { const e = entryInfo(n); return e.title ? t('Notebook {1}: {2}', n, e.title) : t('Notebook {1}', n); };

  /* the saved entries, fetched each time the notebook opens (another device may have written since); entries with
     unsaved typing keep it. The first time, what this device typed and the server never confirmed (offline, or the
     tab closed mid-save) goes up: the server takes it, or refuses it when the entry changed on another device. */
  async function load() {
    if (S.cid !== cid()) { S.cid = cid(); S.entries = {}; S.dirty = {}; S.busy = {}; S.loaded = false; }
    const j = await api('notebook_list&class=' + encodeURIComponent(cid())); const srv = {};
    j.entries.forEach(e => { srv[e.n] = Object.assign(e, { base: e.updated }); });
    Object.keys(S.entries).forEach(k => { if (!srv[k] && !S.dirty[k]) delete S.entries[k]; });
    Object.keys(srv).forEach(k => { if (!S.dirty[k]) S.entries[k] = srv[k]; });
    if (!S.loaded) {
      const L = local();
      Object.keys(L).forEach(k => {
        const n = +k, x = L[k], s = srv[n];
        if (!x || !(n >= 1 && n <= NB().count) || (s && s.text === x.text && (s.prompt || '') === (x.prompt || ''))) { delete L[k]; return; }
        S.entries[n] = Object.assign({ n, updated: 0 }, s || {}, { prompt: x.prompt || '', text: x.text || '', words: wordsOf(x.text), base: x.base || 0 }); S.dirty[n] = true;
      });
      setLocal(L);
    }
    const C = conflicts(); Object.keys(C).forEach(k => { const s = S.entries[+k]; if (!C[k] || (s && s.text === C[k].text)) delete C[k]; }); setConflicts(C); S.conflicts = C;
    S.loaded = true;
    Object.keys(S.dirty).forEach(n => { if (S.dirty[n]) save(+n); });
  }
  async function save(n, keepalive) {
    clearTimeout(S.timer[n]); const e = S.entries[n]; if (!e || !S.dirty[n]) return;
    if (S.busy[n] && !keepalive) return;   // one save at a time; when it answers, anything typed since goes next
    const sent = { prompt: e.prompt || '', text: e.text || '' }; const at = Date.now(); S.busy[n] = true; state(t('Saving…'));
    try {
      const j = await api('notebook_save', { class: cid(), n, prompt: sent.prompt, text: sent.text, base: e.base || 0, dev: DEV() }, keepalive);
      const cur = S.entries[n]; if (cur) { cur.base = cur.updated = j.entry.updated; }
      const L = local();
      if (cur && cur.text === sent.text && (cur.prompt || '') === sent.prompt) { S.dirty[n] = false; cur.words = j.entry.words; if (L[n] && L[n].at <= at) delete L[n]; }
      else if (L[n]) L[n].base = j.entry.updated;   // typed more meanwhile: that builds on what was just saved
      setLocal(L);
      state(S.dirty[n] ? t('Saving…') : t('Saved')); paintList();
    } catch (err) {
      S.busy[n] = false;
      if (err.status === 409 && err.data && err.data.entry) { conflict(n, err.data.entry); return; }
      state(err.network ? t('Offline: kept on this device, saved when you are back') : err.message, true);
      clearTimeout(S.retry); S.retry = setTimeout(() => Object.keys(S.dirty).forEach(k => { if (S.dirty[k]) save(+k); }), 20000);
      return;
    }
    S.busy[n] = false;
    if (S.dirty[n]) S.timer[n] = setTimeout(() => save(n), 400);
  }
  /* the server has a different version from another device: it becomes the entry; this device's waits beside it */
  function conflict(n, srv) {
    const e = S.entries[n] || {}; const C = conflicts(); C[n] = { prompt: e.prompt || '', text: e.text || '', at: Date.now() }; setConflicts(C); S.conflicts = C;
    S.entries[n] = Object.assign(srv, { base: srv.updated }); S.dirty[n] = false;
    const L = local(); delete L[n]; setLocal(L);
    const list = S.root && $('#nb-list', S.root);
    if (list && App.current === App.views.notebook && +list.dataset.cur === n) App.views.notebook.render(S.root, String(n)); else paintList();
  }
  function edited(n, patch) {
    const e = S.entries[n] = Object.assign(S.entries[n] || { n, prompt: '', text: '', words: 0, updated: 0, base: 0 }, patch);
    e.words = wordsOf(e.text); S.dirty[n] = true;
    const L = local(); L[n] = { prompt: e.prompt || '', text: e.text || '', at: Date.now(), base: e.base || 0 }; setLocal(L);
    clearTimeout(S.timer[n]); S.timer[n] = setTimeout(() => save(n), 900); state(t('Editing…'));
  }
  function state(msg, bad) { const el = S.root && $('#nb-state', S.root); if (el) { el.textContent = msg; el.classList.toggle('bad', !!bad); } }
  const flushAll = () => Object.keys(S.dirty).forEach(k => { if (S.dirty[k]) save(+k, true); });
  global.addEventListener('pagehide', flushAll);
  global.addEventListener('online', () => { clearTimeout(S.retry); Object.keys(S.dirty).forEach(k => { if (S.dirty[k]) save(+k); }); });   // back online: what waited goes up now

  /* ---------- the page ---------- */
  const total = () => { let w = 0, done = 0; for (let n = 1; n <= NB().count; n++) { const e = S.entries[n]; if (e && e.words) { done++; w += e.words; } } return { w, done }; };
  function listHtml(cur) {
    const wk = thisWeek();
    return `<ol class="nb-ol">${Array.from({ length: NB().count }, (_, i) => i + 1).map(n => { const info = entryInfo(n), e = S.entries[n]; const w = e ? e.words : 0; const now = info.week === wk;
      return `<li><a class="nb-item${n === cur ? ' cur' : ''}${w ? ' has' : ''}${now ? ' now' : ''}" href="${App.link('notebook', n)}"${n === cur ? ' aria-current="page"' : ''}><span class="nb-n" aria-hidden="true">${w ? icon('check', 13) : n}</span><span class="nb-item-b"><b>${esc(info.title ? `${n}. ${info.title}` : t('Notebook {1}', n))}</b><small>${esc(weekOf(info.week).split(':')[0])}${w ? ` · ${wordsLabel(w)}` : ''}${now ? ` · ${esc(t('this week'))}` : ''}</small></span></a></li>`; }).join('')}</ol>`;
  }
  function paintList() {
    const box = S.root && $('#nb-list', S.root); if (!box) return; const cur = +(box.dataset.cur || 0); box.innerHTML = listHtml(cur);
    const T = total(); const sum = $('#nb-sum', S.root); if (sum) sum.textContent = t('{1} of {2} written · {3}', T.done, NB().count, wordsLabel(T.w));
  }
  function editorHtml(n) {
    const info = entryInfo(n), e = S.entries[n] || {}; const p = info.reflect && App.D.DRAFTS && App.D.DRAFTS.find(x => x.id === info.reflect);
    return `<div class="nb-ed">
        <a class="btn sm nb-back" href="${App.link('notebook')}">${icon('left', 13)} All entries</a>
        <div class="eyebrow">${esc(t('Notebook {1}', n))} · ${esc(weekOf(info.week))}</div>
        <h2 class="nb-title">${esc(info.title || t('Notebook {1}', n))}</h2>
        ${p ? `<div class="callout small nb-reflect">${icon('rotate', 14)} <span>Your revision history for ${esc(p.short)} shows every version you shared and what changed, if you want it beside you.</span> <a href="${App.link('draft-history', p.id)}">Open it</a></div>` : ''}
        ${S.conflicts[n] ? `<div class="callout warn small nb-conflict" role="alert"><span>${esc(t('This entry was changed on another device, so what you typed here ({1}) was not saved over it. The one below is the saved one.', new Date(S.conflicts[n].at).toLocaleString(App.lang || 'en')))}</span><span class="row gap-sm mt-1"><button type="button" class="btn xs" data-action="nb-use-local" data-n="${n}">Use this device’s version</button><button type="button" class="btn xs ghost" data-action="nb-keep-saved" data-n="${n}">Keep the saved one</button></span></div>` : ''}
        <div class="field"><label for="nb-prompt">The prompt</label><textarea class="input nb-prompt" id="nb-prompt" rows="2" maxlength="2000" placeholder="Copy the prompt from class or Canvas, so it stays with your entry." translate="no"></textarea></div>
        <div class="field"><label for="nb-text">Your entry</label><textarea class="input nb-text" id="nb-text" spellcheck="true" placeholder="Write here. It saves as you type." translate="no"></textarea></div>
        <div class="nb-foot"><span id="nb-words" class="small">${wordsLabel(e.words || 0)}</span><span id="nb-state" class="small muted" role="status" aria-live="polite">${e.updated ? esc(t('Saved')) : ''}</span>
          <span class="nb-step">${n > 1 ? `<a class="btn sm ghost" href="${App.link('notebook', n - 1)}" aria-label="${esc(t('Notebook {1}', n - 1))}">${icon('left', 13)} ${n - 1}</a>` : ''}${n < NB().count ? `<a class="btn sm ghost" href="${App.link('notebook', n + 1)}" aria-label="${esc(t('Notebook {1}', n + 1))}">${n + 1} ${icon('right', 13)}</a>` : ''}</span></div>
      </div>`;
  }
  /* the whole notebook, for handing in: Word, plain text, or printed */
  function written() { const out = []; for (let n = 1; n <= NB().count; n++) { const e = S.entries[n]; if (e && e.words) out.push({ n, e, info: entryInfo(n) }); } return out; }
  const handInNote = got => { const missing = NB().count - got; return !missing ? t('All {1} entries are in the file.', got) : got === 1 ? t('1 entry in the file; {1} still empty.', missing) : t('{1} entries in the file; {2} still empty.', got, missing); };
  async function downloadWord() {
    const W = written(); if (!W.length) { toast('Write an entry first.'); return; }
    const u = user(); const D = App.D;
    const blocks = [{ style: 'title', text: t('Writer’s notebook') }, { style: 'note', text: [u && u.name, `${D.code} ${D.name}`, D.term].filter(Boolean).join(' · ') }];
    W.forEach(({ n, e }, i) => { if (i) blocks.push({ style: 'pagebreak' }); blocks.push({ style: 'h1', text: titleOf(n) }); if (e.prompt) blocks.push({ style: 'note', text: e.prompt }); e.text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).forEach(x => blocks.push({ style: 'p', text: x })); });
    try { const data = await App.Office.docx(blocks, { title: `${D.code} writer's notebook`, author: u && u.name, double: true }); App.Office.download(data, App.Office.safeName(`${D.code} writer's notebook`) + '.docx', App.Office.DOCX); toast(handInNote(W.length), 4000); }
    catch (e) { toast('That file could not be made here. Download it as text instead.', 4000); }
  }
  function downloadText() {
    const W = written(); if (!W.length) { toast('Write an entry first.'); return; }
    const D = App.D; const u = user();
    const txt = [[t('Writer’s notebook'), [u && u.name, `${D.code} ${D.name}`, D.term].filter(Boolean).join(' · ')].join('\n')].concat(W.map(({ n, e }) => [titleOf(n), e.prompt ? `(${e.prompt})` : ''].filter(Boolean).join('\n') + '\n\n' + e.text.trim())).join('\n\n\n') + '\n';
    App.Office.download(new Blob([txt], { type: 'text/plain;charset=utf-8' }), App.Office.safeName(`${D.code} writer's notebook`) + '.txt'); toast(handInNote(W.length), 4000);
  }
  function printAll() {
    const W = written(); if (!W.length) { toast('Write an entry first.'); return; }
    const box = $('#nb-print', S.root); box.innerHTML = `<h1>${esc(t('Writer’s notebook'))}</h1>` + W.map(({ n, e }) => `<section><h2>${esc(titleOf(n))}</h2>${e.prompt ? `<p class="nb-pr">${esc(e.prompt)}</p>` : ''}${e.text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('')}</section>`).join('');
    document.body.classList.add('nb-printing'); const done = () => { document.body.classList.remove('nb-printing'); global.removeEventListener('afterprint', done); }; global.addEventListener('afterprint', done); global.print(); setTimeout(done, 60000);
  }

  App.views.notebook = {
    title: 'Writer’s notebook',
    async render(root, param) {
      if (!NB()) { App.go('dashboard'); return; }
      S.root = root;
      const head = App.pageHead('Writer’s notebook', 'Your entries, reviewed every week and handed in together at the end. Private: only you can read them, and Bo is not part of your notebook.', `<button class="btn" data-action="nb-word">${icon('download', 14)} Word</button><button class="btn ghost" data-action="nb-text">${icon('file', 14)} Plain text</button><button class="btn ghost" data-action="nb-print">${icon('print', 14)} Print</button>`);
      if (!user()) { root.innerHTML = head + `<div class="mt-3">${App.lockCard('The notebook is for members', 'Sign up with your montana.edu email to keep your notebook with your account, on every device.')}</div>`; if (App.auth) App.auth.bindLocks(root); return; }
      const had = S.loaded && S.cid === cid(); const tok = S.tok = (S.tok || 0) + 1;
      if (!had) root.innerHTML = head + `<div class="empty mt-3">${esc(t('Opening your notebook…'))}</div>`;
      try { await load(); } catch (e) { if (!had) { root.innerHTML = head + `<div class="empty mt-3">${esc(e.message)}</div>`; return; } }   // offline later on: what is here already
      if (App.current !== App.views.notebook || tok !== S.tok) return;
      let n = Math.max(0, Math.min(NB().count, parseInt(param, 10) || 0));
      const wide = global.matchMedia('(min-width: 821px)').matches;
      if (!n && wide) { const wk = thisWeek(); const here = (NB().entries || []).filter(e => e.week === wk).map(e => e.n); n = here.find(k => !(S.entries[k] && S.entries[k].words)) || here[0] || 1; }
      const due = (App.D.EXAMS || []).find(e => e.id === NB().due);
      root.innerHTML = head + `<p class="small muted nb-sum-row"><span id="nb-sum"></span>${due ? ` · ${esc(t('hand in all of them with {1}, {2}', due.name, due.dateLabel || App.fmtDate(due.date)))}` : ''}</p>
        <div class="nb-wrap${n ? ' editing' : ''}"><nav class="nb-list panel" id="nb-list" data-cur="${n}" aria-label="${esc(t('Entries'))}"></nav>
        <section class="nb-main panel" id="nb-main">${n ? editorHtml(n) : `<div class="empty">${esc(t('Pick an entry to write.'))}</div>`}</section>
        <div class="nb-print" id="nb-print" aria-hidden="true"></div></div>`;
      paintList();
      if (n) {
        const e = S.entries[n] || {}; const pr = $('#nb-prompt', root), tx = $('#nb-text', root);
        pr.value = e.prompt != null && e.prompt !== '' ? e.prompt : (entryInfo(n).prompt || ''); tx.value = e.text || '';
        const grow = () => { tx.style.height = 'auto'; tx.style.height = Math.max(360, tx.scrollHeight + 4) + 'px'; }; grow();
        pr.addEventListener('input', () => edited(n, { prompt: pr.value, text: tx.value }));
        tx.addEventListener('input', () => { edited(n, { prompt: pr.value, text: tx.value }); $('#nb-words', root).textContent = wordsLabel(wordsOf(tx.value)); grow(); });
        if (S.dirty[n]) state(t('Saving…'));
        if (wide && param) setTimeout(() => tx.focus({ preventScroll: true }), 30);
      }
      bind(root, { 'nb-word': downloadWord, 'nb-text': downloadText, 'nb-print': printAll,
        'nb-use-local': el => { const k = +el.dataset.n, x = S.conflicts[k]; if (!x) return; delete S.conflicts[k]; setConflicts(S.conflicts); edited(k, { prompt: x.prompt || '', text: x.text || '' }); App.views.notebook.render(root, String(k)); },
        'nb-keep-saved': el => { const k = +el.dataset.n; delete S.conflicts[k]; setConflicts(S.conflicts); App.views.notebook.render(root, String(k)); } });
    },
    unmount() { flushAll(); }
  };
})(window);
