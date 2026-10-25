/* ============================================================
   Mathub — draft feedback for a writing class (D.DRAFTS; api/drafts.php)
   A student pastes a project draft (or opens a .docx, .odt or .txt file), picks the project and its stage, and Bo
   reads it like a writing tutor: margin comments on exact passages, highlighted in the draft; the two or three
   biggest revisions with a question each; what works; the next steps; and, from the second version on, what changed
   since the last one. He only comments: the words stay theirs. Each review is kept with the account, version after
   version, per project. Bo's words and the draft are marked translate="no": the page's translator leaves them as they are.
   Views: drafts (the form and past reviews), drafts/<id> (one review).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, on, toast, settings, setSetting } = App;
  const API = 'api/index.php?r=';
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const user = () => { const a = App.auth; return a && a.user && !a.user.local && a.mode === 'server' ? a.user : null; };
  const cid = () => (App.D ? App.D.id : '');
  const projects = () => (App.D && App.D.DRAFTS) || [];
  const projectOf = id => projects().find(p => p.id === id) || null;
  const num = n => Number(n).toLocaleString(App.lang || 'en');
  const wordsOf = s => (String(s || '').trim().match(/\S+/g) || []).length;
  const dateOf = ts => App.fmtDate(new Date(ts * 1000).toLocaleDateString('en-CA'));
  const bo = n => (App.boCharSvg && App.boChar ? App.boCharSvg(App.boChar(), n) : App.bobcatSvg ? App.bobcatSvg(n) : '');
  const ST = { cache: {}, list: null };   // reviews already fetched, by id; the last list from the server

  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw Object.assign(new Error('Bo cannot be reached right now. Check your connection and try again.'), { network: true }); }
    if (!json || json.ok === false) throw Object.assign(new Error((json && json.error) || 'Something went wrong. Please try again.'), { status: res.status, data: json });
    return json;
  }

  /* ---------- what they were writing, kept on this device until it is sent (never synced) ---------- */
  const FORM = () => 'mathub-draft-form-' + cid();
  const loadForm = () => { try { return JSON.parse(localStorage.getItem(FORM()) || 'null') || {}; } catch (e) { return {}; } };
  const saveForm = f => { try { localStorage.setItem(FORM(), JSON.stringify(f)); } catch (e) {} };
  const clearForm = () => { try { localStorage.removeItem(FORM()); } catch (e) {} };

  /* the project and stage due next: what the form starts on */
  function nextUp() {
    const today = App.todayISO(); const ex = (App.D && App.D.EXAMS) || []; let best = null;
    projects().forEach(p => ['draft', 'revised'].forEach(stage => { const e = ex.find(x => x.id === p[stage]); if (!e) return; const end = e.endDate || e.date; if (end >= today && (!best || end < best.end)) best = { project: p.id, stage, end, exam: e }; }));
    const last = projects()[projects().length - 1];
    return best || { project: last ? last.id : '', stage: 'revised', end: '', exam: null };
  }

  /* ---------- opening a file: .docx and .odt are zip files; their text is read here, in the browser ---------- */
  async function unzip(buf, want) {
    const dv = new DataView(buf); let eo = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
    if (eo < 0) throw new Error('bad');
    let p = dv.getUint32(eo + 16, true); const n = dv.getUint16(eo + 10, true); const dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nl));
      if (name === want) {
        const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true); const raw = new Uint8Array(buf, start, size);
        if (method === 0) return dec.decode(raw);
        if (method !== 8 || typeof DecompressionStream !== 'function') throw new Error('inflate');
        const out = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
        return dec.decode(out);
      }
      p += 46 + nl + xl + cl;
    }
    throw new Error('bad');
  }
  function xmlText(xml, paraNames, map) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml'); const out = [];
    const walk = (node, acc) => { for (const c of node.childNodes) { if (c.nodeType === 3) { if (map.text(c.parentNode)) acc.push(c.nodeValue); continue; } if (c.nodeType !== 1) continue; const m = map.el(c); if (m != null) { acc.push(m); continue; } walk(c, acc); } };
    for (const el of doc.getElementsByTagName('*')) {
      if (!paraNames.includes(el.localName)) continue; if (el.parentNode && paraNames.includes(el.parentNode.localName)) continue;
      const acc = []; walk(el, acc); out.push(acc.join('').replace(/[ \t]+/g, ' ').trim());
    }
    return out.filter(Boolean).join('\n\n');
  }
  async function readFile(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (f.size > 15 * 1024 * 1024) throw new Error('That file is too big. Paste the text instead.');
    if (['txt', 'md', 'markdown', 'text'].includes(ext) || f.type === 'text/plain') return (await f.text()).replace(/\r\n?/g, '\n');
    if (ext === 'docx' || ext === 'odt') {
      try {
        const buf = await f.arrayBuffer();
        if (ext === 'docx') return xmlText(await unzip(buf, 'word/document.xml'), ['p'], { text: el => el.localName === 't', el: c => c.localName === 'tab' ? ' ' : c.localName === 'br' || c.localName === 'cr' ? '\n' : ['delText', 'instrText'].includes(c.localName) ? '' : null });
        return xmlText(await unzip(buf, 'content.xml'), ['p', 'h'], { text: () => true, el: c => c.localName === 's' ? ' '.repeat(+(c.getAttribute('text:c') || 1)) : c.localName === 'tab' ? ' ' : c.localName === 'line-break' ? '\n' : c.localName === 'note' ? '' : null });
      } catch (e) { throw new Error(e.message === 'inflate' ? 'This browser cannot open that file. Copy the text from it and paste it here.' : 'That file could not be read. Copy the text from it and paste it here.'); }
    }
    throw new Error('Bo reads .docx, .odt and .txt files. For a PDF or a Google Doc, copy the text and paste it here (in Google Docs, File › Download › Microsoft Word also works).');
  }

  /* ---------- finding Bo's quotes in the draft: the same plain form as api/drafts.php, with a map back to the draft ---------- */
  const PLAIN = { '‘': "'", '’': "'", '‛': "'", '`': "'", '´': "'", '“': '"', '”': '"', '„': '"', '‟': '"', '–': '-', '—': '-', '−': '-', ' ': ' ', '…': '...' };
  function plain(s) {
    let out = ''; const at = []; let sp = true;
    for (let i = 0; i < s.length; i++) {
      let c = PLAIN[s[i]] != null ? PLAIN[s[i]] : s[i];
      if (/\s/.test(c)) { if (sp) continue; c = ' '; sp = true; } else sp = false;
      for (const ch of c.toLowerCase()) { out += ch; at.push(i); }
    }
    return { s: out, at };
  }
  function locate(P, quote) {
    const q = plain(String(quote || '')).s.trim(); if (q.length < 4) return null;
    const k = P.s.indexOf(q); if (k < 0) return null;
    return [P.at[k], P.at[k + q.length - 1] + 1];
  }
  /* the draft, with the passages Bo commented on marked: comments by number, the biggest revisions by letter */
  function paperHtml(text, fb) {
    const P = plain(text); const marks = []; const alias = {};
    const add = (key, label, kind, quote) => {
      const r = locate(P, quote); if (!r) return;
      const hit = marks.find(m => r[0] < m.e && m.s < r[1]); if (hit) { alias[key] = hit.key; return; }
      marks.push({ key, label, kind, s: r[0], e: r[1] });
    };
    (fb.comments || []).forEach((c, i) => add('c' + (i + 1), String(i + 1), c.kind, c.quote));
    (fb.revisions || []).forEach((r, i) => { if (r.where) add('r' + i, 'ABCD'[i], 'rev', r.where); });
    marks.sort((a, b) => a.s - b.s);
    const paras = []; const re = /\n\s*\n/g; let last = 0, m;
    while ((m = re.exec(text))) { paras.push([last, m.index]); last = m.index + m[0].length; }
    paras.push([last, text.length]);
    const seg = (a, b) => esc(text.slice(a, b)).replace(/\n/g, '<br>');
    const html = paras.filter(([a, b]) => text.slice(a, b).trim()).map(([a, b]) => {
      let h = '', pos = a;
      marks.filter(mk => mk.s < b && mk.e > a).forEach(mk => {
        const s = Math.max(a, mk.s), e = Math.min(b, mk.e); if (s > pos) h += seg(pos, s);
        const lead = mk.s >= a; const what = mk.kind === 'rev' ? t('Revision {1}', mk.label) : t('Comment {1}', mk.label);
        h += `${lead ? `<button type="button" class="df-pin k-${mk.kind}" data-action="df-pin" data-k="${mk.key}" aria-label="${esc(what)}">${esc(mk.label)}</button>` : ''}<mark class="df-mark k-${mk.kind}" data-k="${mk.key}"${lead ? ` id="dfm-${mk.key}"` : ''}>${seg(s, e)}</mark>`;
        pos = Math.max(pos, e);
      });
      if (pos < b) h += seg(pos, b);
      return `<p>${h}</p>`;
    }).join('');
    return { html, marked: new Set(marks.map(x => x.key)), alias };
  }

  /* ---------- the page: a new draft, and the ones Bo has read ---------- */
  const HEAD = () => App.pageHead('Draft feedback', 'Share a draft of a project and Bo reads it like a writing tutor: he marks passages, names the biggest revisions for the project and asks you questions. He never writes it for you: the words stay yours.');
  function gateConsent(root, again) {
    root.innerHTML = HEAD() + `<div class="df-gate" id="df-gate">${App.boGateHtml.consent()}</div>`;
    $('#df-gate', root).addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; if (b.dataset.go === 'agree') { setSetting('aiConsent', Date.now()); again(); } else App.go('dashboard'); });
  }
  function projectBrief(p) {
    if (!p) return '';
    return `<p class="small">${esc(p.brief)}</p><div class="eyebrow mt-1">What Bo reads for</div><ul class="df-goals small">${(p.goals || []).map(g => `<li>${esc(g)}</li>`).join('')}</ul>`;
  }
  async function formView(root, query) {
    if (!user()) { root.innerHTML = HEAD() + `<div class="mt-3">${App.lockCard('Draft feedback is for members', 'Sign up with your montana.edu email to get Bo’s feedback on your drafts. Every account gets credits for Bo each month, free.')}</div>`; if (App.auth) App.auth.bindLocks(root); return; }
    if (!settings().aiConsent && App.boGateHtml) { gateConsent(root, () => formView(root, query)); return; }
    const up = nextUp(); const saved = loadForm();
    const f = { project: (query && query.p && projectOf(query.p) ? query.p : saved.project) || up.project, stage: (query && query.stage) || saved.stage || up.stage, text: saved.text || '', ask: saved.ask || '', peer: saved.peer || '' };
    if (!projectOf(f.project)) f.project = up.project;
    root.innerHTML = HEAD() + `<div id="df-staff"></div>
      <form class="panel df-form" id="df-form" novalidate>
        <div class="panel-h"><div class="panel-title">${icon('pen')} A new draft</div>${up.exam ? `<span class="small muted">Next: ${esc(up.exam.name)} · ${esc(up.exam.dateLabel || App.fmtDate(up.exam.date))}</span>` : ''}</div>
        <fieldset class="df-field"><legend>Which project?</legend><div class="df-seg">${projects().map(p => `<label class="df-opt"><input type="radio" name="df-p" value="${esc(p.id)}"${p.id === f.project ? ' checked' : ''}><span>${esc(p.short)}</span></label>`).join('')}</div></fieldset>
        <div class="df-brief" id="df-brief">${projectBrief(projectOf(f.project))}</div>
        <fieldset class="df-field"><legend>Which draft is it?</legend><div class="df-seg"><label class="df-opt"><input type="radio" name="df-stage" value="draft"${f.stage !== 'revised' ? ' checked' : ''}><span>First draft</span></label><label class="df-opt"><input type="radio" name="df-stage" value="revised"${f.stage === 'revised' ? ' checked' : ''}><span>Revised draft</span></label></div></fieldset>
        <div class="field"><label for="df-text">Your draft</label><textarea class="input df-text" id="df-text" rows="14" spellcheck="true" placeholder="Paste your draft here, or open a file." translate="no"></textarea>
          <div class="df-tools"><label class="btn sm" for="df-file">${icon('upload', 14)} Open a file</label><input type="file" id="df-file" class="sr-only" accept=".docx,.odt,.txt,.md,text/plain"><span class="small muted">.docx, .odt or .txt</span><span class="df-count small" id="df-count" aria-live="polite"></span></div></div>
        <div class="field"><label for="df-ask">What do you want feedback on? <span class="muted">(optional)</span></label><input class="input" id="df-ask" maxlength="600" placeholder="For example: does my ending land?"></div>
        <details class="df-peer"${f.peer ? ' open' : ''}><summary>Add comments from peer review <span class="muted">(optional)</span></summary><textarea class="input mt-1" id="df-peer" rows="4" maxlength="4000" aria-label="Comments from peer review" placeholder="Paste what your classmates said. Bo weighs it with his own reading." translate="no"></textarea></details>
        <div class="df-go" id="df-go"><button type="submit" class="btn primary lg" id="df-send">${icon('send', 15)} Get Bo’s feedback</button><p class="small muted">Uses a few credits, more for a longer draft. Your draft is kept with your account so Bo can say what changed next time; you can delete it any time.</p></div>
      </form>
      <div id="df-past" class="mt-3"></div>`;
    const form = $('#df-form', root), ta = $('#df-text', root), ask = $('#df-ask', root), peer = $('#df-peer', root), cnt = $('#df-count', root);
    ta.value = f.text; ask.value = f.ask; peer.value = f.peer;
    const read = () => ({ project: (form.querySelector('[name="df-p"]:checked') || {}).value || f.project, stage: (form.querySelector('[name="df-stage"]:checked') || {}).value || 'draft', text: ta.value, ask: ask.value, peer: peer.value });
    const count = () => { const n = wordsOf(ta.value); cnt.textContent = n === 1 ? t('1 word') : t('{1} words', num(n)); };
    count();
    let tm = 0; const keep = () => { clearTimeout(tm); tm = setTimeout(() => saveForm(read()), 400); };
    [ta, ask, peer].forEach(el => el.addEventListener('input', () => { if (el === ta) count(); keep(); }));
    form.addEventListener('change', e => { if (e.target.name === 'df-p') $('#df-brief', root).innerHTML = projectBrief(projectOf(e.target.value)); if (e.target.name === 'df-p' || e.target.name === 'df-stage') keep(); });
    $('#df-file', root).addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
      try { const text = (await readFile(file)).trim(); if (!text) throw new Error('That file has no text Bo can read. Copy the text from it and paste it here.'); ta.value = text; count(); saveForm(read()); toast(t('Opened {1}: {2} words', file.name, num(wordsOf(text)))); ta.focus(); }
      catch (err) { toast(err.message, 5000); }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault(); const v = read();
      if (wordsOf(v.text) < 60) { toast('Paste the draft first: Bo needs at least 60 words to give useful feedback.', 4000); ta.focus(); return; }
      saveForm(v); const go = $('#df-go', root); const was = go.innerHTML;
      go.innerHTML = `<div class="df-reading" role="status"><span class="df-bo" aria-hidden="true">${bo(52)}</span><div><b>Bo is reading your draft</b><p class="small muted">${wordsOf(v.text) > 2500 ? 'A long draft takes him about a minute.' : 'This takes him about half a minute.'} Stay on this page.</p><div class="df-reading-bar"><span></span></div></div></div>`;
      $$('input, textarea, button', form).forEach(el => { el.disabled = true; });
      try {
        const r = await api('ai_draft_review', { class: cid(), project: v.project, stage: v.stage, text: v.text, ask: v.ask, peer: v.peer, lang: App.lang || 'en', persona: App.boChar ? App.boChar() : '' });
        ST.cache[r.review.id] = r.review; ST.list = null; clearForm();
        if (App.sfx) App.sfx.play('complete'); location.hash = App.link('drafts', r.review.id);
      } catch (err) {
        $$('input, textarea, button', form).forEach(el => { el.disabled = false; }); go.innerHTML = was;
        if (err.data && err.data.credits) go.insertAdjacentHTML('afterbegin', `<div class="callout small mb-2">${esc(err.message)} <a href="#/usage">Get credits</a></div>`);
        else toast(err.message, 5000);
      }
    });
    bind(root, { 'df-del': el => del(root, +el.dataset.id, () => past(root)), 'df-del-all': () => delAll(root), 'df-switch': el => toggle(root, el.dataset.off === '1') });
    past(root);
  }
  /* the reviews they have, by project, newest version first; and the instructor's switch */
  async function past(root) {
    const box = $('#df-past', root); if (!box) return;
    let L; try { L = ST.list = await api('ai_draft_list&class=' + encodeURIComponent(cid())); } catch (e) { box.innerHTML = `<div class="empty small">${esc(e.message)}</div>`; return; }
    const staff = $('#df-staff', root);
    if (staff) staff.innerHTML = L.staff ? `<div class="callout df-switch row between">${L.off ? `<span>${icon('lock', 14)} Bo’s draft feedback is off for this class. Students see a note instead of the form.</span><button type="button" class="btn sm" data-action="df-switch" data-off="0">Turn it on</button>` : `<span>${icon('shield', 14)} You teach this class: Bo’s draft feedback is on for your students.</span><button type="button" class="btn sm" data-action="df-switch" data-off="1">Turn it off for the class</button>`}</div>`
      : L.off ? `<div class="callout df-switch">${icon('lock', 14)} Your instructor has turned off Bo’s draft feedback for this class. Your past reviews are still here.</div>` : '';
    if (L.off && !L.staff) { const fm = $('#df-form', root); if (fm) fm.hidden = true; }
    const by = {}; L.reviews.forEach(r => { (by[r.project] = by[r.project] || []).push(r); });
    const have = projects().filter(p => by[p.id]);
    box.innerHTML = `<section class="panel"><div class="panel-h"><div class="panel-title">${icon('file')} Your drafts</div>${L.reviews.length ? '<button type="button" class="btn xs ghost" data-action="df-del-all">Delete all</button>' : ''}</div>
      ${have.length ? have.map(p => `<div class="df-proj"><h3 class="df-proj-h">${esc(p.short)} <span class="muted">· ${esc(p.name.replace(/^[^:]*:\s*/, ''))}</span></h3><ul class="df-vers">${by[p.id].map(r => `<li class="df-ver">
          <a class="df-ver-link" href="${App.link('drafts', r.id)}"><span class="df-vn" aria-hidden="true">v${r.version}</span><span class="df-ver-body"><b>${r.stage === 'revised' ? 'Revised draft' : 'First draft'} · version ${r.version}</b><small>${r.words === 1 ? '1 word' : `${num(r.words)} words`} · ${esc(dateOf(r.created))}</small><span class="df-ver-ov small muted" translate="no">${esc(r.overall)}</span></span></a>
          <button type="button" class="icon-btn" data-action="df-del" data-id="${r.id}" aria-label="Delete version ${r.version}" title="Delete">${icon('trash', 15)}</button></li>`).join('')}</ul></div>`).join('')
        : '<div class="empty small">No drafts yet. Bo keeps each review here, version by version, so you can see a project grow.</div>'}</section>`;
  }
  async function del(root, id, then) {
    if (!confirm('Delete this version of your draft and Bo’s feedback on it? This cannot be undone.')) return;
    try { await api('ai_draft_delete', { class: cid(), id }); delete ST.cache[id]; toast('Deleted'); then(); } catch (e) { toast(e.message, 4000); }
  }
  async function delAll(root) {
    if (!confirm('Delete every draft you shared for this class, with Bo’s feedback? This cannot be undone.')) return;
    try { await api('ai_draft_delete', { class: cid(), all: 1 }); ST.cache = {}; toast('Deleted'); past(root); } catch (e) { toast(e.message, 4000); }
  }
  async function toggle(root, off) {
    try { await api('ai_draft_switch', { class: cid(), off: off ? 1 : 0 }); toast(off ? 'Draft feedback is off for the class' : 'Draft feedback is on for the class'); past(root); } catch (e) { toast(e.message, 4000); }
  }

  /* ---------- one review ---------- */
  const KIND = { praise: 'Works well', question: 'Question', revise: 'Revise', source: 'Sources' };
  const STATUS = { done: 'Done', partly: 'Partly', 'not yet': 'Not yet' };
  async function getReview(id) { if (ST.cache[id] && ST.cache[id].text != null) return ST.cache[id]; const j = await api(`ai_draft_get&class=${encodeURIComponent(cid())}&id=${encodeURIComponent(id)}`); return (ST.cache[id] = j.review); }
  /* how a version changed from the one before: paragraphs rewritten or new, and words */
  function changed(now, before) {
    const ps = s => String(s).split(/\n\s*\n/).map(x => plain(x).s.trim()).filter(Boolean);
    const a = ps(now), b = new Set(ps(before.text)); const diff = a.filter(x => !b.has(x)).length; const dw = wordsOf(now) - wordsOf(before.text);
    const w = dw === 1 ? t('1 more word') : dw === -1 ? t('1 fewer word') : dw > 0 ? t('{1} more words', num(dw)) : dw < 0 ? t('{1} fewer words', num(-dw)) : t('the same length');
    return t('Since version {1}: {2} of {3} paragraphs new or changed, {4}.', before.version, diff, a.length, w);
  }
  function copyText(r, p) {
    const fb = r.feedback || {}; const L = [t('{1} · {2} · version {3}', p ? p.name : r.project, t(r.stage === 'revised' ? 'revised draft' : 'first draft'), r.version), '', fb.overall || ''];   // plain text for the clipboard, so translated here
    if ((fb.revisions || []).length) { L.push('', t('The biggest revisions:')); fb.revisions.forEach((x, i) => L.push(`${'ABCD'[i]}. ${x.title}: ${x.why}${x.where ? ` ("${x.where}")` : ''}${x.ask ? ` ${x.ask}` : ''}`)); }
    if ((fb.comments || []).length) { L.push('', t('In the margins:')); fb.comments.forEach((c, i) => L.push(`${i + 1}. "${c.quote}": ${c.note}`)); }
    if ((fb.next || []).length) { L.push('', t('Next steps:')); fb.next.forEach(x => L.push('- ' + x)); }
    return L.join('\n');
  }
  async function reviewView(root, id) {
    if (!user()) { formView(root, {}); return; }
    root.innerHTML = `<div class="df-review"><a class="btn sm" href="${App.link('drafts')}">${icon('left', 13)} All drafts</a><div class="empty mt-3">Opening Bo’s feedback…</div></div>`;
    let r; try { r = await getReview(id); } catch (e) { root.innerHTML = `<div class="df-review"><a class="btn sm" href="${App.link('drafts')}">${icon('left', 13)} All drafts</a><div class="empty mt-3">${esc(e.message)}</div></div>`; return; }
    if (App.current !== App.views.drafts) return;
    const p = projectOf(r.project); const fb = r.feedback || {}; const P = paperHtml(r.text, fb);
    let before = null; if (r.before) { try { before = await getReview(r.before); } catch (e) {} }
    const nextKey = 'mathub-draft-next-' + r.id; let ticks = {}; try { ticks = JSON.parse(localStorage.getItem(nextKey) || '{}') || {}; } catch (e) {}
    const jump = key => (P.marked.has(key) ? key : P.alias[key] && P.marked.has(P.alias[key]) ? P.alias[key] : null);
    const quoteBtn = (key, q) => { const k = jump(key); return k ? `<button type="button" class="df-where" data-action="df-show" data-k="${k}" title="${esc(t('Show it in the draft'))}"><span translate="no">“${esc(q)}”</span><span class="sr-only"> (${esc(t('Show it in the draft'))})</span></button>` : `<q class="df-where off" translate="no">${esc(q)}</q>`; };
    root.innerHTML = `<div class="df-review">
      <div class="df-top"><a class="btn sm" href="${App.link('drafts')}">${icon('left', 13)} All drafts</a>
        <div class="eyebrow mt-2">${esc(p ? p.short : r.project)} · ${r.stage === 'revised' ? 'Revised draft' : 'First draft'} · version ${r.version}</div>
        <h1 class="page-title">${esc(p ? p.name : r.project)}</h1>
        <p class="small muted">${r.words === 1 ? '1 word' : `${num(r.words)} words`} · ${esc(dateOf(r.created))}${before ? ` · ${esc(changed(r.text, before))}` : ''}</p></div>
      <div class="df-cols">
        <div class="df-side df-side-top">
          <section class="df-card df-overall"><span class="df-bo" aria-hidden="true">${bo(48)}</span><div><h2 class="df-h">Bo’s read</h2><p translate="no">${esc(fb.overall || '')}</p></div></section>
          ${(fb.since || []).length ? `<section class="df-card"><h2 class="df-h">${icon('rotate', 15)} Since last time</h2><ul class="df-since">${fb.since.map(x => `<li><span class="df-st st-${x.status.replace(' ', '-')}">${esc(STATUS[x.status] || x.status)}</span><div><b translate="no">${esc(x.point)}</b>${x.note ? `<p class="small" translate="no">${esc(x.note)}</p>` : ''}</div></li>`).join('')}</ul></section>` : ''}
          <section class="df-card"><h2 class="df-h">${icon('target', 15)} The biggest revisions</h2><ol class="df-revs">${(fb.revisions || []).map((x, i) => `<li id="dfr-r${i}"><span class="df-letter" aria-hidden="true">${'ABCD'[i]}</span><div><h3 translate="no">${esc(x.title)}</h3><p translate="no">${esc(x.why)}</p>${x.where ? `<p class="small">Where: ${quoteBtn('r' + i, x.where)}</p>` : ''}${x.ask ? `<p class="df-ask" translate="no">${esc(x.ask)}</p>` : ''}</div></li>`).join('')}</ol></section>
        </div>
        <article class="panel df-paper" aria-label="Your draft" translate="no" lang="en">${P.html}</article>
        <div class="df-side df-side-rest">
          ${(fb.comments || []).length ? `<section class="df-card"><h2 class="df-h">${icon('chat', 15)} In the margins</h2><ol class="df-notes">${fb.comments.map((c, i) => `<li id="dfc-c${i + 1}" tabindex="-1" class="k-${c.kind}"><span class="df-num" aria-hidden="true">${i + 1}</span><div><span class="df-kind">${esc(KIND[c.kind] || c.kind)}</span><p class="df-q">${quoteBtn('c' + (i + 1), c.quote)}</p><p translate="no">${esc(c.note)}</p></div></li>`).join('')}</ol></section>` : ''}
          ${(fb.strengths || []).length ? `<section class="df-card"><h2 class="df-h">${icon('check', 15)} What works</h2><ul class="df-good">${fb.strengths.map(x => `<li>${x.quote ? `<q translate="no">${esc(x.quote)}</q>` : ''}<p translate="no">${esc(x.why)}</p></li>`).join('')}</ul></section>` : ''}
          ${(fb.next || []).length ? `<section class="df-card"><h2 class="df-h">${icon('list', 15)} Next steps</h2>${fb.next.map((x, i) => `<label class="check"><input type="checkbox" data-n="${i}"${ticks[i] ? ' checked' : ''}><span translate="no">${esc(x)}</span></label>`).join('')}</section>` : ''}
          <div class="df-acts"><a class="btn primary" href="${App.link('drafts', null, { p: r.project, stage: 'revised' })}" data-action="df-again">${icon('pen', 14)} Send a revised version</a><button type="button" class="btn" data-action="df-copy">${icon('copy', 14)} Copy the feedback</button><button type="button" class="btn ghost" data-action="df-del" data-id="${r.id}">${icon('trash', 14)} Delete</button></div>
          <p class="small muted">Bo’s feedback is a second reader, not a grade. Your instructor’s comments and the assignment on Canvas come first.</p>
        </div>
      </div></div>`;
    const flash = el => { if (!el) return; el.classList.remove('df-flash'); void el.offsetWidth; el.classList.add('df-flash'); };
    bind(root, {
      'df-pin': el => { const k = el.dataset.k; const li = k[0] === 'c' ? $('#dfc-' + k, root) : $('#dfr-' + k, root); if (li) { li.scrollIntoView({ block: 'center', behavior: 'smooth' }); li.focus && li.focus({ preventScroll: true }); flash(li); } },
      'df-show': el => { const k = el.dataset.k; const pin = $(`.df-pin[data-k="${k}"]`, root); const marks = $$(`.df-mark[data-k="${k}"]`, root); if (marks[0]) marks[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); marks.forEach(flash); if (pin) pin.focus({ preventScroll: true }); },
      'df-copy': async () => { try { await navigator.clipboard.writeText(copyText(r, p)); toast('Feedback copied'); } catch (e) { toast('Copying is blocked here. Select the feedback and copy it instead.', 4000); } },
      'df-again': (el, e) => { e.preventDefault(); saveForm({ project: r.project, stage: 'revised', text: r.text, ask: '', peer: '' }); location.hash = el.getAttribute('href'); },
      'df-del': el => del(root, +el.dataset.id, () => App.go('drafts'))
    });
    on(root, 'change', '.df-side input[type="checkbox"][data-n]', cb => { ticks[cb.dataset.n] = cb.checked; try { localStorage.setItem(nextKey, JSON.stringify(ticks)); } catch (x) {} });
  }

  App.views.drafts = {
    title: 'Draft feedback',
    render(root, param, query) {
      if (!projects().length) { App.go('dashboard'); return; }
      if (param) reviewView(root, param); else formView(root, query || {});
    }
  };
  App.draftsNext = nextUp;   // the writing dashboard's button (assets/app.js)
})(window);
