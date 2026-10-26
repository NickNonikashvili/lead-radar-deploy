/* ============================================================
   Mathub — peer review swaps (api/peer.php). #/<class>/peer lists a student's swaps and lets them offer a draft
   version (#/<class>/peer?review=<id> picks it); #/<class>/peer/<id> is one swap: the classmate's draft on paper,
   comments on passages they select, a note on the whole, and Send (final). What the classmate wrote back shows on the
   student's own review of that version (assets/drafts.js). Report and "never pair us again" end a swap.
   Only in a class whose instructor turned swaps on (api/instruct.php).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, toast } = App;
  const API = 'api/index.php?r=';
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const user = () => { const a = App.auth; return a && a.user && !a.user.local && a.mode === 'server' ? a.user : null; };
  const cid = () => (App.D ? App.D.id : '');
  const projects = () => (App.D && App.D.DRAFTS) || [];
  const projOf = id => projects().find(p => p.id === id);
  const num = n => Number(n).toLocaleString(App.lang || 'en');
  const dateOf = ts => App.fmtDate(new Date(ts * 1000).toLocaleDateString('en-CA'));
  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw new Error('Mathub cannot be reached right now.'); }
    if (!json || json.ok === false) throw Object.assign(new Error((json && json.error) || 'Something went wrong. Please try again.'), { status: res.status, data: json });
    return json;
  }
  const due = s => { const left = s.due - Date.now() / 1000; return left < 0 ? t('was due {1}', dateOf(s.due)) : left < 86400 ? t('due today') : t('due {1}', dateOf(s.due)); };
  const HEAD = () => App.pageHead('Peer review', 'Swap drafts with a classmate working on the same project: each of you reads the other’s and writes back, the way you would in class.');

  /* ---------- the list: offer a draft, waiting, swaps ---------- */
  async function listView(root, query) {
    root.innerHTML = HEAD() + `<div class="empty mt-3">${esc(t('Opening…'))}</div>`;
    let S, L; try { [S, L] = await Promise.all([api('peer_status&class=' + encodeURIComponent(cid())), api('ai_draft_list&class=' + encodeURIComponent(cid()))]); } catch (e) { root.innerHTML = HEAD() + `<div class="empty mt-3">${esc(e.message)}</div>`; return; }
    if (App.current !== App.views.peer) return;
    // the newest version of each project, the ones a swap can offer
    const latest = {}; L.reviews.forEach(r => { if (!latest[r.project] || latest[r.project].version < r.version) latest[r.project] = r; });
    const busy = new Set(S.waiting.map(w => w.project).concat(S.swaps.filter(s => !s.closed && !(s.gave.sent && s.got.sent)).map(s => s.project)));
    const offer = projects().map(p => latest[p.id]).filter(r => r && !busy.has(r.project));
    const want = query && +query.review; const pre = offer.find(r => r.id === want) || offer[0];
    root.innerHTML = HEAD() + `<div class="pr-page">
      ${S.on ? '' : `<div class="callout">${icon('lock', 14)} <span>Your instructor has not turned on peer review swaps for this class. ${L.staff ? `You teach it: turn them on on the <a href="${App.link('instructor')}">Instructor page</a>.` : ''}</span></div>`}
      ${S.on ? `<section class="panel"><div class="panel-h"><div class="panel-title">${icon('swap')} Offer a draft</div></div>
        ${offer.length ? `<form id="pr-offer" class="pr-offer" novalidate><div class="field"><label for="pr-pick">Your draft</label><select class="select" id="pr-pick">${offer.map(r => `<option value="${r.id}"${pre && r.id === pre.id ? ' selected' : ''}>${esc((projOf(r.project) || {}).short || r.project)} · ${esc(t('version {1}', r.version))}</option>`).join('')}</select></div>
          <button type="submit" class="btn primary">${icon('users', 14)} Find me a partner</button></form>
          <p class="small muted">${esc(t('You are paired with a classmate who offers a draft of the same project. You read each other’s draft (not Bo’s feedback) and write back within {1} days. Your name shows to your partner.', S.days))}</p>`
        : `<p class="small muted">${L.reviews.length ? 'Each of your projects is already in a swap, or waiting for one.' : `Share a draft with Bo first: a swap offers the version you shared. <a href="${App.link('drafts')}">Draft feedback</a>`}</p>`}
      </section>` : ''}
      ${S.waiting.length ? `<section class="panel mt-3"><div class="panel-h"><div class="panel-title">${icon('clock')} Waiting for a partner</div></div><ul class="pr-list">${S.waiting.map(w => `<li><span><b>${esc((projOf(w.project) || {}).short || w.project)}</b> · ${esc(t('version {1}', w.version))}<small class="muted"> · ${esc(t('since {1}', dateOf(w.since)))}</small></span><button type="button" class="btn xs ghost" data-action="pr-leave" data-p="${esc(w.project)}">Stop waiting</button></li>`).join('')}</ul><p class="small muted">You get a notification when a classmate is paired with you.</p></section>` : ''}
      <section class="panel mt-3"><div class="panel-h"><div class="panel-title">${icon('users')} Your swaps</div></div>
        ${S.swaps.length ? `<ul class="pr-list">${S.swaps.map(s => `<li class="pr-swap${s.closed ? ' closed' : ''}"><div><b>${esc((projOf(s.project) || {}).short || s.project)}</b> ${esc(t('with {1}', s.name))}<small class="muted"> · ${esc(s.closed ? t('ended') : s.gave.sent && s.got.sent ? t('done') : due(s))}</small>
            <div class="pr-tags">${s.closed ? '' : `<span class="df-st${s.gave.sent ? ' st-done' : ''}">${esc(s.gave.sent ? t('You sent yours') : s.gave.started ? t('Yours is started') : t('Yours: not started'))}</span><span class="df-st${s.got.sent ? ' st-done' : ''}">${esc(s.got.sent ? t('Theirs came back') : t('Theirs: not yet'))}</span>`}</div></div>
            <div class="row gap-sm">${s.closed ? '' : `<a class="btn xs${s.gave.sent ? ' ghost' : ' primary'}" href="${App.link('peer', s.id)}">${esc(s.gave.sent ? t('See what you sent') : t('Read their draft'))}</a>`}${s.got.sent ? `<a class="btn xs" href="${App.link('drafts', s.my_review)}">${esc(t('See what they wrote'))}</a>` : ''}</div></li>`).join('')}</ul>`
        : '<div class="empty small">No swaps yet.</div>'}</section>
    </div>`;
    const form = $('#pr-offer', root);
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault(); const b = $('button[type="submit"]', form); b.disabled = true;
      try { const j = await api('peer_join', { class: cid(), review_id: +$('#pr-pick', form).value }); if (j.paired) { toast('You have a partner'); location.hash = App.link('peer', j.paired); } else { toast('Waiting for a classmate'); listView(root, {}); } }
      catch (err) { b.disabled = false; toast(err.message, 4500); }
    });
    bind(root, { 'pr-leave': async el => { try { await api('peer_leave', { class: cid(), project: el.dataset.p }); listView(root, {}); } catch (e) { toast(e.message, 4000); } } });
  }

  /* ---------- one swap: their draft, comments on passages, a note on the whole ---------- */
  const KEY = id => `mathub-peer-${cid()}-${id}`;
  function swapView(root, id) {
    root.innerHTML = `<div class="pr-sw"><a class="btn sm" href="${App.link('peer')}">${icon('left', 13)} Peer review</a><div class="empty mt-3">${esc(t('Opening…'))}</div></div>`;
    api(`peer_get&class=${encodeURIComponent(cid())}&id=${encodeURIComponent(id)}`).then(j => { if (App.current === App.views.peer) paintSwap(root, j); }).catch(e => { const x = $('.empty', root); if (x) x.textContent = e.message; });
  }
  function paintSwap(root, j) {
    if (App.views.peer._off) { App.views.peer._off(); App.views.peer._off = null; }
    const s = j.swap; const p = projOf(s.project); const sent = !!j.mine.sent;
    let local = null; try { local = JSON.parse(localStorage.getItem(KEY(s.id)) || 'null'); } catch (e) {}
    const N = { overall: j.mine.overall, comments: j.mine.comments.slice() };
    if (!sent && local && local.at > j.mine.updated * 1000) { N.overall = local.overall || ''; N.comments = Array.isArray(local.comments) ? local.comments : []; }
    const back = `<a class="btn sm" href="${App.link('peer')}">${icon('left', 13)} Peer review</a>`;
    if (s.closed || !j.draft) { root.innerHTML = `<div class="pr-sw">${back}<div class="callout mt-3">${icon('lock', 14)} <span>${esc(s.closed_by_me ? t('You ended this swap. You will not be paired with {1} again.', j.name) : t('This swap has ended.'))}</span></div></div>`; return; }
    const paras = j.draft.text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    root.innerHTML = `<div class="pr-sw">
      <div class="df-top">${back}
        <div class="eyebrow mt-2">${esc(p ? p.short : s.project)} · ${esc(t('version {1}', j.draft.version))} · ${esc(due(s))}</div>
        <h1 class="page-title">${esc(t('{1}’s draft', j.name))}</h1>
        <p class="small muted">${esc(t('{1} words', num(j.draft.words)))}. ${sent ? esc(t('You sent your peer review {1}.', dateOf(j.mine.sent))) : esc(t('Select words in the draft to comment on them, then write a note on the whole draft and send it.'))}</p></div>
      <div class="pr-cols">
        <div class="pr-paper-wrap">
          ${sent ? '' : `<div class="pr-bar"><button type="button" class="btn sm" data-action="pr-add" disabled aria-describedby="pr-hint">${icon('chat', 14)} Comment on the selected words</button><span class="small muted" id="pr-hint">Select a passage first.</span></div>`}
          <article class="panel df-paper pr-paper" id="pr-paper" aria-label="${esc(t('Their draft'))}" translate="no" lang="en">${paras.map(x => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('')}</article>
        </div>
        <div class="pr-side">
          <section class="df-card"><h2 class="df-h">${icon('chat', 15)} ${esc(t('Your comments'))}</h2><ol class="pr-comments" id="pr-comments"></ol><p class="small muted pr-empty" id="pr-none">${sent ? '' : esc(t('None yet. Select a passage in the draft and press Comment.'))}</p></section>
          <section class="df-card"><h2 class="df-h">${icon('pen', 15)} ${esc(t('On the whole draft'))}</h2>
            ${sent ? `<p translate="no">${esc(N.overall).replace(/\n/g, '<br>') || '<span class="muted">—</span>'}</p>` : `<textarea class="input" id="pr-overall" rows="7" maxlength="4000" aria-label="${esc(t('On the whole draft'))}" placeholder="${esc(t('What works best for you as a reader? Where did you get lost or want more? One thing you would try next.'))}" translate="no">${esc(N.overall)}</textarea>`}</section>
          ${sent ? '' : `<div class="pr-acts"><button type="button" class="btn primary" data-action="pr-send">${icon('send', 14)} ${esc(t('Send to {1}', j.name))}</button><button type="button" class="btn" data-action="pr-save">${icon('check', 14)} ${esc(t('Save for later'))}</button><span class="small muted" id="pr-state" role="status" aria-live="polite"></span></div>`}
          ${j.got ? `<section class="df-card"><h2 class="df-h">${icon('users', 15)} ${esc(t('What {1} wrote about yours', j.name))}</h2><p class="small"><a href="${App.link('drafts', s.my_review)}">${esc(t('Open it beside your draft'))}</a></p></section>` : ''}
          <details class="pr-more small"><summary>${esc(t('Something wrong?'))}</summary>
            <p class="muted">${esc(t('If this draft is offensive or not a draft at all, report it: the moderators read it and the swap ends. Or end the swap so you are never paired with {1} again.', j.name))}</p>
            <div class="row gap-sm"><button type="button" class="btn xs danger" data-action="pr-report">${icon('flag', 13)} ${esc(t('Report this draft'))}</button><button type="button" class="btn xs ghost" data-action="pr-block">${esc(t('Never pair us again'))}</button></div></details>
        </div>
      </div></div>`;
    const paper = $('#pr-paper', root), list = $('#pr-comments', root), none = $('#pr-none', root);
    const keep = () => { try { localStorage.setItem(KEY(s.id), JSON.stringify({ overall: N.overall, comments: N.comments, at: Date.now() })); } catch (e) {} };
    // the passages they commented on, marked in the draft (one highlight; the CSS Highlight API where there is one)
    const markAll = () => {
      if (!(global.CSS && CSS.highlights && global.Highlight)) return; const ranges = [];
      N.comments.forEach(c => { if (!c.quote) return; const r = findRange(paper, c.quote); if (r) ranges.push(r); });
      if (ranges.length) CSS.highlights.set('pr-quote', new Highlight(...ranges)); else CSS.highlights.delete('pr-quote');
    };
    const paint = () => {
      list.innerHTML = N.comments.map((c, i) => `<li data-i="${i}">${c.quote ? `<q class="small" translate="no">${esc(c.quote)}</q>` : ''}${sent ? `<p translate="no">${esc(c.note)}</p>` : `<textarea class="input" rows="3" maxlength="1000" data-note="${i}" aria-label="${esc(t('Your comment on “{1}”', c.quote.slice(0, 60)))}" placeholder="${esc(t('What do you notice here as a reader?'))}" translate="no">${esc(c.note)}</textarea><button type="button" class="btn xs ghost" data-action="pr-del" data-i="${i}">${icon('trash', 12)} ${esc(t('Remove'))}</button>`}</li>`).join('');
      if (none) none.hidden = !!N.comments.length; markAll();
    };
    paint();
    if (sent) return;
    const addBtn = $('[data-action="pr-add"]', root), hint = $('#pr-hint', root);
    const selected = () => { const sel = global.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return ''; const r = sel.getRangeAt(0); if (!paper.contains(r.commonAncestorContainer)) return ''; return sel.toString().replace(/\s+/g, ' ').trim(); };
    const onSel = () => { const q = selected(); addBtn.disabled = !q; hint.textContent = q ? t('“{1}”', q.length > 60 ? q.slice(0, 60) + '…' : q) : t('Select a passage first.'); };
    document.addEventListener('selectionchange', onSel); App.views.peer._off = () => document.removeEventListener('selectionchange', onSel);
    addBtn.addEventListener('mousedown', e => e.preventDefault());   // keep the selection when the button is pressed
    const dirty = () => { keep(); $('#pr-state', root).textContent = t('Not sent yet'); };
    bind(root, {
      'pr-add': () => {
        const qt = selected(); if (!qt) return; if (N.comments.length >= 30) { toast('Up to 30 comments.'); return; }
        N.comments.push({ quote: qt.slice(0, 300), note: '' }); global.getSelection().removeAllRanges(); onSel(); paint(); dirty();
        const ta = $(`[data-note="${N.comments.length - 1}"]`, list); if (ta) ta.focus();
      },
      'pr-del': el => { N.comments.splice(+el.dataset.i, 1); paint(); dirty(); },
      'pr-save': async () => { try { await save(false); toast('Saved'); } catch (e) { toast(e.message, 4500); } },
      'pr-send': async () => {
        if (!N.overall.trim() && !N.comments.some(c => c.note.trim())) { toast('Write a comment or a note on the whole draft first.', 4000); return; }
        if (!confirm(t('Send your peer review to {1}? You cannot change it after.', j.name))) return;
        try { await save(true); try { localStorage.removeItem(KEY(s.id)); } catch (e) {} toast(t('Sent to {1}', j.name)); swapView(root, s.id); } catch (e) { toast(e.message, 4500); }
      },
      'pr-report': async () => { const why = prompt(t('What is wrong with this draft? The moderators read your note and the draft.')); if (!why || !why.trim()) return; try { await api('peer_report', { class: cid(), id: s.id, reason: why.trim() }); toast('Reported. Thank you.'); swapView(root, s.id); } catch (e) { toast(e.message, 4500); } },
      'pr-block': async () => { if (!confirm(t('End this swap? You will not be paired with {1} again.', j.name))) return; try { await api('peer_block', { class: cid(), id: s.id }); swapView(root, s.id); } catch (e) { toast(e.message, 4500); } }
    });
    list.addEventListener('input', e => { const i = e.target.dataset.note; if (i == null) return; N.comments[+i].note = e.target.value; dirty(); });
    $('#pr-overall', root).addEventListener('input', e => { N.overall = e.target.value; dirty(); });
    const save = async send => {
      const st = $('#pr-state', root); st.textContent = t('Saving…');
      const j2 = await api('peer_save', { class: cid(), id: s.id, overall: N.overall, comments: N.comments.filter(c => c.note.trim()), send: send ? 1 : 0 });
      st.textContent = send ? t('Sent') : t('Saved'); return j2;
    };
  }
  /* a Range over the first place a quote appears in the paper, ignoring differences in spaces */
  function findRange(root, quote) {
    const nodes = []; let text = ''; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { nodes.push({ n, at: text.length }); text += n.nodeValue; }
    const norm = []; let flat = ''; let sp = false;
    for (let i = 0; i < text.length; i++) { const c = text[i]; if (/\s/.test(c)) { if (sp) continue; sp = true; flat += ' '; norm.push(i); } else { sp = false; flat += c; norm.push(i); } }
    const k = flat.indexOf(quote.replace(/\s+/g, ' ').trim()); if (k < 0) return null;
    const a = norm[k], b = norm[k + quote.replace(/\s+/g, ' ').trim().length - 1] + 1;
    const at = off => { for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].at <= off) return [nodes[i].n, Math.min(off - nodes[i].at, nodes[i].n.nodeValue.length)]; return [nodes[0].n, 0]; };
    try { const r = new Range(); const x = at(a), y = at(b); r.setStart(x[0], x[1]); r.setEnd(y[0], y[1]); return r; } catch (e) { return null; }
  }

  App.views.peer = {
    title: 'Peer review',
    render(root, param, query) {
      if (App.views.peer._off) { App.views.peer._off(); App.views.peer._off = null; }
      if (!projects().length) { App.go('dashboard'); return; }
      if (!user()) { root.innerHTML = HEAD() + `<div class="mt-3">${App.lockCard('Peer review is for members', 'Sign up with your montana.edu email to swap drafts with classmates.')}</div>`; if (App.auth) App.auth.bindLocks(root); return; }
      if (param) swapView(root, param); else listView(root, query || {});
    },
    unmount() { if (App.views.peer._off) { App.views.peer._off(); App.views.peer._off = null; } if (global.CSS && CSS.highlights) CSS.highlights.delete('pr-quote'); }
  };
})(window);
