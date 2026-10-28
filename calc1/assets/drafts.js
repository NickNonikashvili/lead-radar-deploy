/* ============================================================
   StudyCat — draft feedback for a writing class (D.DRAFTS; api/drafts.php)
   A student pastes a project draft (or opens a .docx, .pdf, .odt or .txt file, read in the browser by
   assets/officekit.js), picks the project and its stage, and Bo reads it like a writing tutor: margin comments on exact
   passages, highlighted in the draft; the two or three biggest revisions with a question each; what works; the next
   steps; and, from the second version on, what changed since the last one. He only comments: the words stay theirs.
   They can mark each note done or say they disagree (Bo's next review is told), ask Bo about a note (the floating Bo,
   with the note pinned), and have the draft read aloud to them, sentence by sentence. Each review is kept with the
   account, version after version, per project; the revision history puts the versions side by side for the
   portfolio's evidence of revision. Bo's words and the draft are marked translate="no": the page's translator
   leaves them as they are.
   Views: drafts (the form and past reviews), drafts/<id> (one review), draft-history/<project> (the versions).
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
  const wordsLabel = n => n === 1 ? t('1 word') : t('{1} words', num(n));
  const dateOf = ts => App.fmtDate(new Date(ts * 1000).toLocaleDateString('en-CA'));
  const stageLabel = s => s === 'revised' ? 'Revised draft' : 'First draft';
  const bo = n => (App.boCharSvg && App.boChar ? App.boCharSvg(App.boChar(), n) : App.bobcatSvg ? App.bobcatSvg(n) : '');
  const LETTERS = 'ABCD';
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
  const paragraphs = text => { const out = []; const re = /\n\s*\n/g; let last = 0, m; while ((m = re.exec(text))) { out.push([last, m.index]); last = m.index + m[0].length; } out.push([last, text.length]); return out.filter(([a, b]) => text.slice(a, b).trim()); };
  /* the draft, with the passages Bo commented on marked: comments by number, the biggest revisions by letter */
  function paperHtml(text, fb) {
    const P = plain(text); const marks = []; const alias = {};
    const add = (key, label, kind, quote) => {
      const r = locate(P, quote); if (!r) return;
      const hit = marks.find(m => r[0] < m.e && m.s < r[1]); if (hit) { alias[key] = hit.key; return; }
      marks.push({ key, label, kind, s: r[0], e: r[1] });
    };
    (fb.comments || []).forEach((c, i) => add('c' + (i + 1), String(i + 1), c.kind, c.quote));
    (fb.revisions || []).forEach((r, i) => { if (r.where) add('r' + i, LETTERS[i], 'rev', r.where); });
    marks.sort((a, b) => a.s - b.s);
    const seg = (a, b) => esc(text.slice(a, b)).replace(/\n/g, '<br>');
    const html = paragraphs(text).map(([a, b], pi) => {
      let h = '', pos = a;
      marks.filter(mk => mk.s < b && mk.e > a).forEach(mk => {
        const s = Math.max(a, mk.s), e = Math.min(b, mk.e); if (s > pos) h += seg(pos, s);
        const lead = mk.s >= a; const what = mk.kind === 'rev' ? t('Revision {1}', mk.label) : t('Comment {1}', mk.label);
        h += `${lead ? `<button type="button" class="df-pin k-${mk.kind}" data-action="df-pin" data-k="${mk.key}" aria-label="${esc(what)}">${esc(mk.label)}</button>` : ''}<mark class="df-mark k-${mk.kind}" data-k="${mk.key}"${lead ? ` id="dfm-${mk.key}"` : ''}>${seg(s, e)}</mark>`;
        pos = Math.max(pos, e);
      });
      if (pos < b) h += seg(pos, b);
      return `<p data-p="${pi}">${h}</p>`;
    }).join('');
    return { html, marked: new Set(marks.map(x => x.key)), alias };
  }

  /* ---------- reading the draft aloud: one sentence at a time, highlighted (CSS highlights where the browser has
     them, else the paragraph), with the voice and speed of the readings player (assets/reader.js) ---------- */
  const synth = () => global.speechSynthesis || null;
  const RA = { on: false, p: 0, s: 0, paras: [], u: null, root: null };
  const RATES = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
  const rate = () => { const r = +settings().readerRate; return RATES.includes(r) ? r : 1; };
  function voice() {
    const sy = synth(); if (!sy) return null; const vs = (sy.getVoices() || []).filter(v => /^en/i.test(v.lang)); if (!vs.length) return null;
    return vs.find(v => v.name === settings().readerVoice) || vs.find(v => /natural|premium|enhanced|neural/i.test(v.name)) || vs.find(v => /en-US/i.test(v.lang)) || vs[0];
  }
  function sentencesAt(text) {   // [start, end] of each sentence in a paragraph's text
    const out = []; const re = /[^.!?]+[.!?]+["”’)\]]*\s*|[^.!?]+$/g; let m;
    while ((m = re.exec(text))) { const s = m.index, e = m.index + m[0].trimEnd().length; if (e <= s) continue; if (out.length && (e - s < 14 || /^\s*[a-z]/.test(m[0]))) out[out.length - 1][1] = e; else out.push([s, e]); }
    return out;
  }
  function paraNodes(p) {   // a paragraph's text nodes (not the comment pins), with where each starts
    const nodes = []; let n = 0; const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, { acceptNode: x => x.parentNode.closest('.df-pin') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let x = w.nextNode(); x; x = w.nextNode()) { nodes.push({ node: x, at: n }); n += x.nodeValue.length; }
    return { nodes, text: nodes.map(x => x.node.nodeValue).join('') };
  }
  function mark() {
    const root = RA.root; if (!root) return; $$('.df-paper p.df-now', root).forEach(x => x.classList.remove('df-now'));
    if (global.CSS && CSS.highlights) CSS.highlights.delete('df-read');
    if (!RA.on) return; const P = RA.paras[RA.p]; if (!P) return; const [s, e] = P.sents[RA.s] || [0, 0];
    if (global.CSS && CSS.highlights && global.Highlight) {
      const find = off => { for (let i = P.nodes.length - 1; i >= 0; i--) if (P.nodes[i].at <= off) return [P.nodes[i].node, Math.min(off - P.nodes[i].at, P.nodes[i].node.nodeValue.length)]; return [P.nodes[0].node, 0]; };
      try { const r = new Range(); const a = find(s), b = find(e); r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); CSS.highlights.set('df-read', new Highlight(r)); } catch (x) { P.el.classList.add('df-now'); }
    } else P.el.classList.add('df-now');
    const r = P.el.getBoundingClientRect(); if (r.top < 90 || r.bottom > innerHeight - 90) P.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function speakNext() {
    const sy = synth(); if (!sy || !RA.on) return;
    const P = RA.paras[RA.p]; if (!P) { stopReading(true); return; }
    const se = P.sents[RA.s]; if (!se) { RA.p++; RA.s = 0; speakNext(); return; }
    const u = new SpeechSynthesisUtterance(P.text.slice(se[0], se[1])); const v = voice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US'; u.rate = rate();
    u.onend = () => { if (!RA.on || RA.u !== u) return; RA.s++; speakNext(); };
    u.onerror = e => { if (!e || e.error === 'interrupted' || e.error === 'canceled') return; stopReading(); toast('The voice stopped. Press Read it aloud to go on.', 3500); };
    RA.u = u; mark(); sy.speak(u);
  }
  function paintListen() { const b = RA.root && $('[data-action="df-listen"]', RA.root); if (!b) return; b.setAttribute('aria-pressed', String(RA.on)); b.innerHTML = `${icon(RA.on ? 'pause' : 'play', 14)} ${RA.on ? esc(t('Pause')) : esc(t('Read it aloud'))}`; }
  function startReading(root, from) {
    const sy = synth(); if (!sy) { toast('This browser cannot read aloud.', 3500); return; }
    RA.root = root; RA.paras = $$('.df-paper p', root).map(el => { const x = paraNodes(el); return { el, nodes: x.nodes, text: x.text, sents: sentencesAt(x.text) }; });
    if (from != null) { RA.p = from; RA.s = 0; } else if (RA.p >= RA.paras.length) { RA.p = 0; RA.s = 0; }
    sy.cancel(); RA.on = true; RA.u = null; paintListen(); speakNext();
  }
  function stopReading(done) {
    RA.on = false; RA.u = null; const sy = synth(); if (sy) sy.cancel(); if (done) { RA.p = 0; RA.s = 0; }
    mark(); paintListen();
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
          <div class="df-tools"><label class="btn sm" for="df-file">${icon('upload', 14)} Open a file</label><input type="file" id="df-file" class="sr-only" accept=".docx,.pdf,.odt,.txt,.md,text/plain,application/pdf"><span class="small muted">.docx, .pdf, .odt or .txt</span><span class="df-count small" id="df-count" aria-live="polite"></span></div></div>
        <div class="field"><label for="df-ask">What do you want feedback on? <span class="muted">(optional)</span></label><input class="input" id="df-ask" maxlength="600" placeholder="For example: does my ending land?"></div>
        <details class="df-peer"${f.peer ? ' open' : ''}><summary>Add comments from peer review <span class="muted">(optional)</span></summary><textarea class="input mt-1" id="df-peer" rows="4" maxlength="4000" aria-label="Comments from peer review" placeholder="Paste what your classmates said. Bo weighs it with his own reading." translate="no"></textarea></details>
        <label class="check df-count-row" id="df-count-row" hidden><input type="checkbox" id="df-counted"${settings().draftCount ? ' checked' : ''}><span class="small">Let this draft count, without your name, in the patterns your instructor sees across the class <span class="muted">(only once five students have; never your words)</span></span></label>
        <div class="df-go" id="df-go"><button type="submit" class="btn primary lg" id="df-send">${icon('send', 15)} Get Bo’s feedback</button><p class="small muted">Uses a few credits, more for a longer draft. Your draft is kept with your account so Bo can say what changed next time; you can delete it any time.</p></div>
      </form>
      <div id="df-past" class="mt-3"></div>`;
    const form = $('#df-form', root), ta = $('#df-text', root), ask = $('#df-ask', root), peer = $('#df-peer', root), cnt = $('#df-count', root);
    ta.value = f.text; ask.value = f.ask; peer.value = f.peer;
    const read = () => ({ project: (form.querySelector('[name="df-p"]:checked') || {}).value || f.project, stage: (form.querySelector('[name="df-stage"]:checked') || {}).value || 'draft', text: ta.value, ask: ask.value, peer: peer.value });
    const count = () => { cnt.textContent = wordsLabel(wordsOf(ta.value)); };
    count();
    let tm = 0; const keep = () => { clearTimeout(tm); tm = setTimeout(() => saveForm(read()), 400); };
    [ta, ask, peer].forEach(el => el.addEventListener('input', () => { if (el === ta) count(); keep(); }));
    form.addEventListener('change', e => { if (e.target.name === 'df-p') $('#df-brief', root).innerHTML = projectBrief(projectOf(e.target.value)); if (e.target.name === 'df-p' || e.target.name === 'df-stage') keep(); });
    $('#df-file', root).addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
      const was = cnt.textContent; cnt.textContent = t('Opening {1}…', file.name);
      try { const text = (await App.Office.fileText(file)).trim(); if (!text) throw new Error('That file has no text Bo can read. Copy the text from it and paste it here.'); ta.value = text; count(); saveForm(read()); toast(t('Opened {1}: {2} words', file.name, num(wordsOf(text)))); ta.focus(); }
      catch (err) { cnt.textContent = was; toast(err.message, 5500); }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault(); const v = read();
      if (wordsOf(v.text) < 60) { toast('Paste the draft first: Bo needs at least 60 words to give useful feedback.', 4000); ta.focus(); return; }
      saveForm(v); const go = $('#df-go', root); const was = go.innerHTML;
      go.innerHTML = `<div class="df-reading" role="status"><span class="df-bo" aria-hidden="true">${bo(52)}</span><div><b>Bo is reading your draft</b><p class="small muted">${wordsOf(v.text) > 2500 ? 'A long draft takes him about a minute.' : 'This takes him about half a minute.'} Stay on this page.</p><div class="df-reading-bar"><span></span></div></div></div>`;
      $$('input, textarea, button', form).forEach(el => { el.disabled = true; });
      try {
        const cnt = $('#df-counted', root); const counted = !!(cnt && !cnt.closest('[hidden]') && cnt.checked);
        const r = await api('ai_draft_review', { class: cid(), project: v.project, stage: v.stage, text: v.text, ask: v.ask, peer: v.peer, count: counted ? 1 : 0, lang: App.lang || 'en', persona: App.boChar ? App.boChar() : '' });
        ST.cache[r.review.id] = r.review; ST.list = null; clearForm();
        if (App.sfx) App.sfx.play('complete'); location.hash = App.link('drafts', r.review.id);
      } catch (err) {
        $$('input, textarea, button', form).forEach(el => { el.disabled = false; }); go.innerHTML = was;
        if (err.data && err.data.credits) go.insertAdjacentHTML('afterbegin', `<div class="callout small mb-2">${esc(err.message)} <a href="#/usage">Get credits</a></div>`);
        else toast(err.message, 5000);
      }
    });
    bind(root, { 'df-del': el => del(root, +el.dataset.id, () => past(root)), 'df-del-all': () => delAll(root), 'df-switch': el => toggle(root, el.dataset.off === '1') });
    on(root, 'change', '#df-counted', el => setSetting('draftCount', el.checked));
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
    if (L.staff && staff) staff.firstElementChild.insertAdjacentHTML('beforeend', `<a class="btn sm" href="${App.link('instructor')}">${icon('gear', 13)} ${esc(t('Instructor page'))}</a>`);
    const cr = $('#df-count-row', root); if (cr) cr.hidden = !L.count_ok;
    const by = {}; L.reviews.forEach(r => { (by[r.project] = by[r.project] || []).push(r); });
    const have = projects().filter(p => by[p.id]);
    box.innerHTML = `<section class="panel"><div class="panel-h"><div class="panel-title">${icon('file')} Your drafts</div><div class="row gap-sm">${L.peer_on ? `<a class="btn xs" href="${App.link('peer')}">${icon('swap', 13)} Peer review</a>` : ''}${L.reviews.length ? '<button type="button" class="btn xs ghost" data-action="df-del-all">Delete all</button>' : ''}</div></div>
      ${have.length ? have.map(p => `<div class="df-proj"><div class="df-proj-row"><h3 class="df-proj-h">${esc(p.short)} <span class="muted">· ${esc(p.name.replace(/^[^:]*:\s*/, ''))}</span></h3><a class="btn xs" href="${App.link('draft-history', p.id)}">${icon('rotate', 13)} Revision history</a></div><ul class="df-vers">${by[p.id].map(r => `<li class="df-ver">
          <a class="df-ver-link" href="${App.link('drafts', r.id)}"><span class="df-vn" aria-hidden="true">v${r.version}</span><span class="df-ver-body"><b>${stageLabel(r.stage)} · version ${r.version}</b><small>${wordsLabel(r.words)} · ${esc(dateOf(r.created))}</small><span class="df-ver-ov small muted" translate="no">${esc(r.overall)}</span></span></a>
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
  async function getReview(id, fresh) {
    if (!fresh && ST.cache[id] && ST.cache[id].text != null) return ST.cache[id];
    const j = await api(`ai_draft_get&class=${encodeURIComponent(cid())}&id=${encodeURIComponent(id)}`);
    ST.flags = { can_share: !!j.can_share, staff_name: j.staff_name || '', peer_on: !!j.peer_on };   // what the class allows (api/drafts.php mh_draft_flags)
    return (ST.cache[id] = j.review);
  }
  /* how a version changed from the one before: paragraphs rewritten or new, and words */
  function changed(now, before) {
    const ps = s => String(s).split(/\n\s*\n/).map(x => plain(x).s.trim()).filter(Boolean);
    const a = ps(now), b = new Set(ps(before.text)); const diff = a.filter(x => !b.has(x)).length; const dw = wordsOf(now) - wordsOf(before.text);
    const w = dw === 1 ? t('1 more word') : dw === -1 ? t('1 fewer word') : dw > 0 ? t('{1} more words', num(dw)) : dw < 0 ? t('{1} fewer words', num(-dw)) : t('the same length');
    return t('Since version {1}: {2} of {3} paragraphs new or changed, {4}.', before.version, diff, a.length, w);
  }
  function copyText(r, p) {
    const fb = r.feedback || {}; const L = [t('{1} · {2} · version {3}', p ? p.name : r.project, t(r.stage === 'revised' ? 'revised draft' : 'first draft'), r.version), '', fb.overall || ''];   // plain text for the clipboard, so translated here
    if ((fb.revisions || []).length) { L.push('', t('The biggest revisions:')); fb.revisions.forEach((x, i) => L.push(`${LETTERS[i]}. ${x.title}: ${x.why}${x.where ? ` ("${x.where}")` : ''}${x.ask ? ` ${x.ask}` : ''}`)); }
    if ((fb.comments || []).length) { L.push('', t('In the margins:')); fb.comments.forEach((c, i) => L.push(`${i + 1}. "${c.quote}": ${c.note}`)); }
    if ((fb.next || []).length) { L.push('', t('Next steps:')); fb.next.forEach(x => L.push('- ' + x)); }
    return L.join('\n');
  }
  /* what classmates wrote in a peer review swap, as the peer review comments a revised version sends Bo */
  const peerText = list => (list || []).map(x => [x.overall ? `${x.name}: ${x.overall}` : `${x.name}:`].concat((x.comments || []).map(c => `- ${c.quote ? `“${c.quote}”: ` : ''}${c.note}`)).join('\n')).join('\n\n');
  /* their answer to one note: Done, I disagree (with a reason Bo reads next time), and Ask Bo about it */
  function respHtml(key, resp, what) {
    const s = resp && resp.s || '';
    return `<div class="df-resp" data-key="${key}" role="group" aria-label="${esc(what)}">
        <button type="button" class="df-rb${s === 'done' ? ' on' : ''}" data-action="df-resp" data-state="done" aria-pressed="${s === 'done'}">${icon('check', 13)} Done</button>
        <button type="button" class="df-rb${s === 'disagree' ? ' on' : ''}" data-action="df-resp" data-state="disagree" aria-pressed="${s === 'disagree'}">I disagree</button>
        <button type="button" class="df-rb ask" data-action="df-ask" data-k="${key}">${icon('chat', 13)} Ask Bo about this</button>
      </div>
      <div class="df-why"${s === 'disagree' ? '' : ' hidden'}><label class="small muted" for="dfw-${key}">Why? Bo reads this next time (optional)</label><input class="input" id="dfw-${key}" data-why="${key}" maxlength="300" value="${esc(resp && resp.why || '')}" translate="no"></div>`;
  }
  async function reviewView(root, id) {
    if (!user()) { formView(root, {}); return; }
    root.innerHTML = `<div class="df-review"><a class="btn sm" href="${App.link('drafts')}">${icon('left', 13)} All drafts</a><div class="empty mt-3">Opening Bo’s feedback…</div></div>`;
    let r; try { r = await getReview(id, true); } catch (e) { root.innerHTML = `<div class="df-review"><a class="btn sm" href="${App.link('drafts')}">${icon('left', 13)} All drafts</a><div class="empty mt-3">${esc(e.message)}</div></div>`; return; }
    if (App.current !== App.views.drafts) return;
    const p = projectOf(r.project); const fb = r.feedback || {}; const P = paperHtml(r.text, fb); const R = r.responses || (r.responses = {});
    let before = null; if (r.before) { try { before = await getReview(r.before); } catch (e) {} }
    const nextKey = 'mathub-draft-next-' + r.id; let ticks = {}; try { ticks = JSON.parse(localStorage.getItem(nextKey) || '{}') || {}; } catch (e) {}
    const jump = key => (P.marked.has(key) ? key : P.alias[key] && P.marked.has(P.alias[key]) ? P.alias[key] : null);
    const quoteBtn = (key, q) => { const k = jump(key); return k ? `<button type="button" class="df-where" data-action="df-show" data-k="${k}" title="${esc(t('Show it in the draft'))}"><span translate="no">“${esc(q)}”</span><span class="sr-only"> (${esc(t('Show it in the draft'))})</span></button>` : `<q class="df-where off" translate="no">${esc(q)}</q>`; };
    RA.on = false; RA.p = 0; RA.s = 0;
    root.innerHTML = `<div class="df-review">
      <div class="df-top"><div class="row gap-sm"><a class="btn sm" href="${App.link('drafts')}">${icon('left', 13)} All drafts</a><a class="btn sm" href="${App.link('draft-history', r.project)}">${icon('rotate', 13)} Revision history</a></div>
        <div class="eyebrow mt-2">${esc(p ? p.short : r.project)} · ${stageLabel(r.stage)} · version ${r.version}</div>
        <h1 class="page-title">${esc(p ? p.name : r.project)}</h1>
        <p class="small muted">${wordsLabel(r.words)} · ${esc(dateOf(r.created))}${before ? ` · ${esc(changed(r.text, before))}` : ''}</p></div>
      <div class="df-cols">
        <div class="df-side df-side-top">
          <section class="df-card df-overall"><span class="df-bo" aria-hidden="true">${bo(48)}</span><div><h2 class="df-h">Bo’s read</h2><p translate="no">${esc(fb.overall || '')}</p></div></section>
          ${(fb.since || []).length ? `<section class="df-card"><h2 class="df-h">${icon('rotate', 15)} Since last time</h2><ul class="df-since">${fb.since.map(x => `<li><span class="df-st st-${x.status.replace(' ', '-')}">${esc(STATUS[x.status] || x.status)}</span><div><b translate="no">${esc(x.point)}</b>${x.note ? `<p class="small" translate="no">${esc(x.note)}</p>` : ''}</div></li>`).join('')}</ul></section>` : ''}
          <section class="df-card"><h2 class="df-h">${icon('target', 15)} The biggest revisions</h2><ol class="df-revs">${(fb.revisions || []).map((x, i) => `<li id="dfr-r${i}" tabindex="-1" class="${R['r' + i] && R['r' + i].s === 'done' ? 'is-done' : ''}"><span class="df-letter" aria-hidden="true">${LETTERS[i]}</span><div><h3 translate="no">${esc(x.title)}</h3><p translate="no">${esc(x.why)}</p>${x.where ? `<p class="small">Where: ${quoteBtn('r' + i, x.where)}</p>` : ''}${x.ask ? `<p class="df-ask" translate="no">${esc(x.ask)}</p>` : ''}${respHtml('r' + i, R['r' + i], t('Revision {1}', LETTERS[i]))}</div></li>`).join('')}</ol></section>
        </div>
        <div class="df-paper-wrap">
          <div class="df-paper-bar"><button type="button" class="btn sm" data-action="df-listen" aria-pressed="false">${icon('play', 14)} Read it aloud</button><label class="df-rate small"><span>Speed</span><select class="select sm" id="df-rate">${RATES.map(x => `<option value="${x}"${rate() === x ? ' selected' : ''}>${x}×</option>`).join('')}</select></label><span class="small muted df-listen-tip">Hearing it helps you catch what reads oddly. While it reads, click a paragraph to jump there.</span></div>
          <article class="panel df-paper" aria-label="Your draft" translate="no" lang="en">${P.html}</article>
        </div>
        <div class="df-side df-side-rest">
          ${(fb.comments || []).length ? `<section class="df-card"><h2 class="df-h">${icon('chat', 15)} In the margins</h2><ol class="df-notes">${fb.comments.map((c, i) => `<li id="dfc-c${i + 1}" tabindex="-1" class="k-${c.kind}${R['c' + (i + 1)] && R['c' + (i + 1)].s === 'done' ? ' is-done' : ''}"><span class="df-num" aria-hidden="true">${i + 1}</span><div><span class="df-kind">${esc(KIND[c.kind] || c.kind)}</span><p class="df-q">${quoteBtn('c' + (i + 1), c.quote)}</p><p translate="no">${esc(c.note)}</p>${respHtml('c' + (i + 1), R['c' + (i + 1)], t('Comment {1}', i + 1))}</div></li>`).join('')}</ol></section>` : ''}
          ${(fb.strengths || []).length ? `<section class="df-card"><h2 class="df-h">${icon('check', 15)} What works</h2><ul class="df-good">${fb.strengths.map(x => `<li>${x.quote ? `<q translate="no">${esc(x.quote)}</q>` : ''}<p translate="no">${esc(x.why)}</p></li>`).join('')}</ul></section>` : ''}
          ${(fb.next || []).length ? `<section class="df-card"><h2 class="df-h">${icon('list', 15)} Next steps</h2>${fb.next.map((x, i) => `<label class="check"><input type="checkbox" data-n="${i}"${ticks[i] ? ' checked' : ''}><span translate="no">${esc(x)}</span></label>`).join('')}</section>` : ''}
          ${(r.peers || []).length ? `<section class="df-card df-peer-got"><h2 class="df-h">${icon('users', 15)} From peer review</h2>${r.peers.map(x => `<div class="df-peer-one"><b>${esc(x.name)}</b>${x.overall ? `<blockquote translate="no">${esc(x.overall).replace(/\n/g, '<br>')}</blockquote>` : ''}${x.comments.length ? `<ol>${x.comments.map(c => `<li>${c.quote ? `<q translate="no">${esc(c.quote)}</q> ` : ''}<span translate="no">${esc(c.note)}</span></li>`).join('')}</ol>` : ''}</div>`).join('')}<p class="small muted">Send a revised version and these go to Bo with it, as peer review comments.</p></section>` : ''}
          ${(ST.flags || {}).can_share || r.share ? `<section class="df-card df-share-box" id="df-share-box"></section>` : ''}
          <div class="df-acts"><a class="btn primary" href="${App.link('drafts', null, { p: r.project, stage: 'revised' })}" data-action="df-again">${icon('pen', 14)} Send a revised version</a>${(ST.flags || {}).peer_on ? `<a class="btn" href="${App.link('peer', null, { review: r.id })}">${icon('swap', 14)} Swap with a classmate</a>` : ''}<button type="button" class="btn" data-action="df-copy">${icon('copy', 14)} Copy the feedback</button><button type="button" class="btn ghost" data-action="df-del" data-id="${r.id}">${icon('trash', 14)} Delete</button></div>
          <p class="small muted">Bo’s feedback is a second reader, not a grade. Your instructor’s comments and the assignment on Canvas come first.</p>
        </div>
      </div></div>`;
    const flash = el => { if (!el) return; el.classList.remove('df-flash'); void el.offsetWidth; el.classList.add('df-flash'); };
    const noteOf = key => key[0] === 'r' ? (fb.revisions || [])[+key.slice(1)] : (fb.comments || [])[+key.slice(1) - 1];
    const respond = async (key, state, why) => {
      const prev = R[key]; R[key] = state ? { s: state, why: why || '' } : undefined; if (!state) delete R[key];
      try { const j = await api('ai_draft_respond', { class: cid(), id: r.id, key, state, why: why || '' }); r.responses = Object.assign(R, j.responses || {}); Object.keys(R).forEach(k => { if (!(j.responses || {})[k]) delete R[k]; }); }
      catch (e) { if (prev) R[key] = prev; else delete R[key]; toast(e.message, 4000); }
      paintResp(key);
    };
    const paintResp = key => {
      const box = $(`.df-resp[data-key="${key}"]`, root); if (!box) return; const s = (R[key] || {}).s || '';
      $$('[data-action="df-resp"]', box).forEach(b => { const on = b.dataset.state === s; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      const why = box.nextElementSibling; if (why && why.classList.contains('df-why')) why.hidden = s !== 'disagree';
      const li = box.closest('li'); if (li) li.classList.toggle('is-done', s === 'done');
    };
    bind(root, {
      'df-pin': el => { const k = el.dataset.k; const li = k[0] === 'c' ? $('#dfc-' + k, root) : $('#dfr-' + k, root); if (li) { li.scrollIntoView({ block: 'center', behavior: 'smooth' }); li.focus && li.focus({ preventScroll: true }); flash(li); } },
      'df-show': el => { const k = el.dataset.k; const pin = $(`.df-pin[data-k="${k}"]`, root); const marks = $$(`.df-mark[data-k="${k}"]`, root); if (marks[0]) marks[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); marks.forEach(flash); if (pin) pin.focus({ preventScroll: true }); },
      'df-resp': el => {
        const key = el.closest('.df-resp').dataset.key; const state = el.dataset.state; const cur = (R[key] || {}).s || '';
        const next = cur === state ? '' : state; const why = next === 'disagree' ? (($(`[data-why="${key}"]`, root) || {}).value || '') : '';
        respond(key, next, why); if (next === 'disagree') setTimeout(() => { const w = $(`[data-why="${key}"]`, root); if (w) w.focus(); }, 30);
      },
      'df-ask': el => {
        const key = el.dataset.k; const n = noteOf(key); if (!n) return;
        const quote = key[0] === 'r' ? n.where : n.quote; const note = key[0] === 'r' ? `${n.title}: ${n.why}${n.ask ? ' ' + n.ask : ''}` : n.note;
        const focus = { text: `Your note on my draft (${p ? p.name : r.project}, version ${r.version})${quote ? ` at "${quote}"` : ''}: ${note}`, short: quote ? `“${quote}”` : note, tag: t('Your note'), quick: [t('What do you mean here?'), t('I disagree. Here is why.'), t('Show me an example from the readings.')] };
        if (App.boFloat && settings().boFloat !== false) App.boFloat.open({ focus, q: t('What do you mean here?') });
        else { toast('Turn on Bo on every page in Settings to ask him about a note.', 4500); }
      },
      'df-listen': () => { if (RA.on) stopReading(); else startReading(root); },
      'df-copy': async () => { try { await navigator.clipboard.writeText(copyText(r, p)); toast('Feedback copied'); } catch (e) { toast('Copying is blocked here. Select the feedback and copy it instead.', 4000); } },
      'df-again': (el, e) => { e.preventDefault(); stopReading(); saveForm({ project: r.project, stage: 'revised', text: r.text, ask: '', peer: peerText(r.peers).slice(0, 4000) }); location.hash = el.getAttribute('href'); },
      'df-share': () => { const f = $('#df-share-form', root); f.hidden = false; $('#df-share-note', root).focus(); },
      'df-share-cancel': () => { $('#df-share-form', root).hidden = true; $('[data-action="df-share"]', root).focus(); },
      'df-share-send': async el => {
        el.disabled = true;
        try { const j = await api('ai_draft_share', { class: cid(), id: r.id, note: $('#df-share-note', root).value.trim() }); r.share = j.share; paintShare(); toast(t('Shared with {1}', who())); }
        catch (e) { el.disabled = false; toast(e.message, 4500); }
      },
      'df-unshare': async () => {
        if (!confirm(t('Stop sharing this version with {1}? Their reply goes too.', who()))) return;
        try { await api('ai_draft_unshare', { class: cid(), id: r.id }); r.share = null; paintShare(); toast('No longer shared'); } catch (e) { toast(e.message, 4500); }
      },
      'df-del': el => del(root, +el.dataset.id, () => App.go('drafts'))
    });
    const who = () => (ST.flags && ST.flags.staff_name) || t('your instructor');
    function paintShare() {
      const box = $('#df-share-box', root); if (!box) return; const s = r.share;
      box.innerHTML = `<h2 class="df-h">${icon('users', 15)} ${esc(t('Your instructor'))}</h2>` + (s
        ? `<p class="small">${esc(t('Shared with {1} on {2}.', who(), dateOf(s.created)))}${s.note ? ` ${esc(t('Your note:'))} <span translate="no">“${esc(s.note)}”</span>` : ''}</p>
           ${s.reply ? `<div class="callout df-reply"><span><b>${esc(t('{1} replied', who()))}</b> <span translate="no">${esc(s.reply).replace(/\n/g, '<br>')}</span></span></div>` : ''}
           <button type="button" class="btn sm ghost" data-action="df-unshare">${esc(t('Stop sharing'))}</button>`
        : `<p class="small muted">${esc(t('Share this version with {1}: they see your draft, Bo’s feedback and your answers to his notes, and can reply.', who()))}</p>
           <button type="button" class="btn sm" data-action="df-share">${icon('send', 13)} ${esc(t('Share with your instructor'))}</button>
           <div class="df-share-form mt-2" id="df-share-form" hidden><label class="small" for="df-share-note">${esc(t('A note for them'))} <span class="muted">${esc(t('(optional)'))}</span></label><textarea class="input" id="df-share-note" rows="3" maxlength="1000" placeholder="${esc(t('For example: is my ending too quiet?'))}" translate="no"></textarea>
             <div class="row gap-sm mt-1"><button type="button" class="btn primary sm" data-action="df-share-send">${esc(t('Share'))}</button><button type="button" class="btn ghost sm" data-action="df-share-cancel">${esc(t('Cancel'))}</button></div></div>`);
    }
    paintShare();
    on(root, 'change', '.df-side input[type="checkbox"][data-n]', cb => { ticks[cb.dataset.n] = cb.checked; try { localStorage.setItem(nextKey, JSON.stringify(ticks)); } catch (x) {} });
    on(root, 'change', '[data-why]', el => { const key = el.dataset.why; if ((R[key] || {}).s === 'disagree') respond(key, 'disagree', el.value.trim()); });
    on(root, 'change', '#df-rate', el => { setSetting('readerRate', +el.value); if (RA.on) { const sy = synth(); RA.u = null; if (sy) sy.cancel(); speakNext(); } });
    on(root, 'click', '.df-paper p', (el, e) => { if (e.target.closest('.df-pin')) return; if (!RA.on) return; startReading(root, +el.dataset.p); });
  }

  /* ---------- the revision history: every version, what changed between two of them, and what became of Bo's notes ---------- */
  const tokens = s => String(s).match(/\S+\s*/g) || [];
  /* word-level differences inside one paragraph pair (an LCS; a paragraph is a few hundred words at most) */
  function wordDiff(a, b) {
    const A = tokens(a), B = tokens(b); const n = A.length, m = B.length; const key = x => x.trim().toLowerCase();
    if (n * m > 4e6) return { ops: [{ t: '-', s: a }, { t: '+', s: b }], add: m, del: n };
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = key(A[i]) === key(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ops = []; let i = 0, j = 0, add = 0, del = 0;
    const push = (t, s) => { const last = ops[ops.length - 1]; if (last && last.t === t) last.s += s; else ops.push({ t, s }); };
    while (i < n && j < m) { if (key(A[i]) === key(B[j])) { push('=', B[j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { push('-', A[i]); i++; del++; } else { push('+', B[j]); j++; add++; } }
    while (i < n) { push('-', A[i++]); del++; } while (j < m) { push('+', B[j++]); add++; }
    return { ops, add, del };
  }
  /* paragraphs matched first (unchanged ones line up), then the words of the ones that changed */
  function diffTexts(oldText, newText) {
    const pa = String(oldText).split(/\n\s*\n/).map(x => x.trim()).filter(Boolean), pb = String(newText).split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    const k = x => plain(x).s.trim(); const n = pa.length, m = pb.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = k(pa[i]) === k(pb[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const rows = []; let i = 0, j = 0; let dels = [], adds = [];
    const flush = () => { const c = Math.min(dels.length, adds.length); for (let x = 0; x < c; x++) rows.push({ t: 'changed', a: dels[x], b: adds[x] }); dels.slice(c).forEach(a => rows.push({ t: 'del', a })); adds.slice(c).forEach(b => rows.push({ t: 'add', b })); dels = []; adds = []; };
    while (i < n && j < m) { if (k(pa[i]) === k(pb[j])) { flush(); rows.push({ t: 'same', a: pa[i], b: pb[j] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) dels.push(pa[i++]); else adds.push(pb[j++]); }
    while (i < n) dels.push(pa[i++]); while (j < m) adds.push(pb[j++]); flush();
    let added = 0, removed = 0;
    rows.forEach(r => { if (r.t === 'changed') { r.d = wordDiff(r.a, r.b); added += r.d.add; removed += r.d.del; } else if (r.t === 'add') added += tokens(r.b).length; else if (r.t === 'del') removed += tokens(r.a).length; });
    return { rows, added, removed, changed: rows.filter(r => r.t !== 'same').length, paras: m };
  }
  const opsHtml = (ops, side) => ops.map(o => o.t === '=' ? esc(o.s) : o.t === '+' ? (side === 'old' ? '' : `<ins>${esc(o.s)}</ins>`) : (side === 'new' ? '' : `<del>${esc(o.s)}</del>`)).join('');
  function diffHtml(D, mode) {
    if (mode === 'inline') return `<div class="dh-inline" translate="no" lang="en">${D.rows.map(r => `<p class="dh-${r.t}">${r.t === 'same' ? esc(r.b) : r.t === 'add' ? `<ins>${esc(r.b)}</ins>` : r.t === 'del' ? `<del>${esc(r.a)}</del>` : opsHtml(r.d.ops, 'both')}</p>`).join('')}</div>`;
    return `<div class="dh-sides" translate="no" lang="en">${D.rows.map(r => `<div class="dh-row dh-${r.t}"><p class="dh-old">${r.t === 'add' ? '' : r.t === 'same' ? esc(r.a) : r.t === 'del' ? `<del>${esc(r.a)}</del>` : opsHtml(r.d.ops, 'old')}</p><p class="dh-new">${r.t === 'del' ? '' : r.t === 'same' ? esc(r.b) : r.t === 'add' ? `<ins>${esc(r.b)}</ins>` : opsHtml(r.d.ops, 'new')}</p></div>`).join('')}</div>`;
  }
  /* what became of each version's biggest revisions: Bo's word at the next version, and theirs */
  function notesFate(V) {
    return V.slice(0, -1).map((v, i) => {
      const nx = V[i + 1]; const since = (nx.feedback && nx.feedback.since) || []; const R = v.responses || {}; const revs = (v.feedback && v.feedback.revisions) || [];
      const same = (y, x) => plain(y.point).s.toLowerCase() === plain(x.title).s.toLowerCase();
      return { v, items: revs.map((x, k) => { const s = since.find(y => same(y, x)) || (since[k] && !revs.some(z => same(since[k], z)) ? since[k] : null); return { letter: LETTERS[k], title: x.title, bo: s ? s.status : '', note: s ? s.note : '', you: (R['r' + k] || {}).s || '' }; }) };
    });
  }
  async function historyView(root, pid) {
    const p = projectOf(pid);
    if (!user()) { formView(root, {}); return; }
    root.innerHTML = `<div class="dh"><a class="btn sm" href="${App.link('drafts')}">${icon('left', 13)} All drafts</a><div class="empty mt-3">Opening your versions…</div></div>`;
    let V; try { V = (await api(`ai_draft_history&class=${encodeURIComponent(cid())}&project=${encodeURIComponent(pid)}`)).versions; } catch (e) { $('.empty', root).textContent = e.message; return; }
    if (App.current !== App.views['draft-history']) return;
    V.forEach(v => { ST.cache[v.id] = v; });
    const head = `<a class="btn sm" href="${App.link('drafts')}">${icon('left', 13)} All drafts</a><div class="eyebrow mt-2">${esc(p ? p.short : pid)} · Revision history</div><h1 class="page-title">${esc(p ? p.name : pid)}</h1>`;
    if (!V.length) { root.innerHTML = `<div class="dh">${head}<div class="empty mt-3">No versions of this project yet. Share a draft with Bo and each version you send is kept here.</div><a class="btn primary mt-2" href="${App.link('drafts', null, { p: pid })}">${icon('pen', 14)} Share a draft</a></div>`; return; }
    const st = { a: 0, b: V.length - 1, mode: 'sides' };
    const fate = notesFate(V);
    const verLabel = v => `${t('Version {1}', v.version)} · ${t(stageLabel(v.stage))}`;
    root.innerHTML = `<div class="dh">${head}
      <p class="page-sub">Every version you shared, what changed between them, and what became of Bo’s notes. Use it as evidence of revision for your portfolio; the reflection is yours to write.</p>
      <ol class="dh-time">${V.map(v => `<li><a href="${App.link('drafts', v.id)}"><b>${esc(t('Version {1}', v.version))}</b><span>${esc(stageLabel(v.stage))}</span><small>${wordsLabel(v.words)} · ${esc(dateOf(v.created))}</small></a></li>`).join('')}</ol>
      ${V.length > 1 ? `<section class="panel mt-3">
        <div class="dh-pick"><label class="field"><span>Compare</span><select class="select" id="dh-a">${V.map((v, i) => `<option value="${i}"${i === st.a ? ' selected' : ''}>${esc(verLabel(v))}</option>`).join('')}</select></label>
          <label class="field"><span>with</span><select class="select" id="dh-b">${V.map((v, i) => `<option value="${i}"${i === st.b ? ' selected' : ''}>${esc(verLabel(v))}</option>`).join('')}</select></label>
          <div class="df-seg dh-mode" role="radiogroup" aria-label="How to show the changes"><label class="df-opt"><input type="radio" name="dh-mode" value="sides" checked><span>Side by side</span></label><label class="df-opt"><input type="radio" name="dh-mode" value="inline"><span>In one text</span></label></div></div>
        <p class="small muted dh-stats" id="dh-stats" aria-live="polite"></p>
        <div class="dh-key small muted"><span><ins>${esc(t('added'))}</ins></span><span><del>${esc(t('taken out'))}</del></span></div>
        <div id="dh-diff"></div></section>` : `<section class="panel mt-3"><p class="small muted">One version so far. Send Bo a revised draft and this page shows what changed.</p></section>`}
      ${fate.some(f => f.items.length) ? `<section class="panel mt-3"><div class="panel-h"><div class="panel-title">${icon('target')} What became of Bo’s notes</div></div>${fate.map(f => `<div class="dh-fate"><h2>${esc(t('Version {1}', f.v.version))} → ${esc(t('Version {1}', f.v.version + 1))}</h2><ul>${f.items.map(x => `<li><span class="df-letter" aria-hidden="true">${x.letter}</span><div><b translate="no">${esc(x.title)}</b><div class="dh-tags">${x.bo ? `<span class="df-st st-${x.bo.replace(' ', '-')}">${esc(t('Bo: {1}', t(STATUS[x.bo] || x.bo)))}</span>` : ''}${x.you ? `<span class="df-st${x.you === 'done' ? ' st-done' : ''}">${esc(x.you === 'done' ? t('You: done') : t('You: disagreed'))}</span>` : ''}</div>${x.note ? `<p class="small" translate="no">${esc(x.note)}</p>` : ''}</div></li>`).join('')}</ul></div>`).join('')}</section>` : ''}
      <section class="panel mt-3 dh-reflect"><div class="panel-h"><div class="panel-title">${icon('bulb')} Questions for your reflection</div><span class="small muted">no AI: the answers are yours</span></div>
        <ul class="small"><li>Which change made the biggest difference, and why did you make it?</li><li>Which piece of feedback did you not take, and why?</li><li>What does the first draft do that the last one does better?</li><li>What would you change next if you had another week?</li></ul></section>
      <div class="row gap-sm mt-3 dh-acts"><button type="button" class="btn" data-action="dh-word">${icon('download', 14)} Download as Word</button><button type="button" class="btn ghost" data-action="dh-print">${icon('print', 14)} Print or save as PDF</button></div>
    </div>`;
    const paint = () => {
      if (V.length < 2) return; const A = V[Math.min(st.a, st.b)], B = V[Math.max(st.a, st.b)];
      if (A === B) { $('#dh-diff', root).innerHTML = `<p class="small muted">${esc(t('Pick two different versions.'))}</p>`; $('#dh-stats', root).textContent = ''; return; }
      const D = diffTexts(A.text, B.text);
      $('#dh-stats', root).textContent = t('From version {1} to version {2}: {3} of {4} paragraphs new or changed, {5} words added and {6} taken out.', A.version, B.version, D.changed, D.paras, num(D.added), num(D.removed));
      $('#dh-diff', root).innerHTML = (st.mode === 'sides' ? `<div class="dh-heads"><b>${esc(verLabel(A))}</b><b>${esc(verLabel(B))}</b></div>` : '') + diffHtml(D, st.mode);
    };
    paint();
    on(root, 'change', '#dh-a, #dh-b, [name="dh-mode"]', () => { st.a = +$('#dh-a', root).value; st.b = +$('#dh-b', root).value; st.mode = (root.querySelector('[name="dh-mode"]:checked') || {}).value || 'sides'; paint(); });
    bind(root, {
      'dh-print': () => global.print(),
      'dh-word': async () => {
        const blocks = [{ style: 'title', text: p ? p.name : pid }, { style: 'note', text: t('Revision history from StudyCat: every version shared with Bo, and what became of his notes.') }];
        if (V.length > 1) { const D = diffTexts(V[0].text, V[V.length - 1].text); blocks.push({ style: 'p', text: t('From version {1} to version {2}: {3} of {4} paragraphs new or changed, {5} words added and {6} taken out.', V[0].version, V[V.length - 1].version, D.changed, D.paras, num(D.added), num(D.removed)) }); }
        fate.forEach(f => { if (!f.items.length) return; blocks.push({ style: 'h2', text: `${t('Version {1}', f.v.version)} → ${t('Version {1}', f.v.version + 1)}` }); f.items.forEach(x => blocks.push({ style: 'p', runs: [{ t: `${x.letter}. ${x.title}`, b: true }, { t: (x.bo ? ` · ${t('Bo: {1}', t(STATUS[x.bo] || x.bo))}` : '') + (x.you ? ` · ${x.you === 'done' ? t('You: done') : t('You: disagreed')}` : '') + (x.note ? `\n${x.note}` : '') }] })); });
        V.forEach(v => { blocks.push({ style: 'pagebreak' }); blocks.push({ style: 'h1', text: `${verLabel(v)} · ${dateOf(v.created)}` }); v.text.split(/\n\s*\n/).filter(x => x.trim()).forEach(x => blocks.push({ style: 'p', text: x.trim() })); });
        try { const data = await App.Office.docx(blocks, { title: (p ? p.name : pid) + ' · revision history' }); App.Office.download(data, App.Office.safeName(`${p ? p.short : pid} revision history`) + '.docx', App.Office.DOCX); }
        catch (e) { toast('That file could not be made here. Use Print or save as PDF instead.', 4000); }
      }
    });
  }

  App.views.drafts = {
    title: 'Draft feedback',
    render(root, param, query) {
      if (!projects().length) { App.go('dashboard'); return; }
      stopReading(true);
      if (param) reviewView(root, param); else formView(root, query || {});
    },
    unmount() { stopReading(true); RA.root = null; }
  };
  App.views['draft-history'] = {
    title: 'Revision history',
    render(root, param) { if (!projects().length) { App.go('dashboard'); return; } historyView(root, param || (projects()[0] || {}).id); }
  };
  App.draftsNext = nextUp;   // the writing dashboard's button (assets/app.js)
  App.draftDiff = diffTexts;  // the tests check it
  App.draftPaper = (text, fb) => paperHtml(text, fb || {}).html;   // a shared draft on the instructor's page (assets/instruct.js)
  App.draftDiffHtml = diffHtml;
  global.addEventListener('beforeunload', () => { const sy = synth(); if (sy && RA.on) sy.cancel(); });
})(window);
