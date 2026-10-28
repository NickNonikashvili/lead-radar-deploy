/* ============================================================
   Mathub — learning tools with Bo (api/learn.php). Two pages in a class:
   - #/<class>/checkwork: a photo of handwritten work on one problem. Bo writes the lines down as they were written,
     the math check finds the first one that does not follow, and Bo says why with a hint, never the finished answer.
   - #/<class>/slides: lecture slides (.pptx or PDF, read in the browser) become study notes and flashcards, kept with
     the account; #/<class>/slides/<id> is one set: the notes, the cards to flip, Word, print and a CSV for Anki or
     Quizlet.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, toast } = App;
  const API = 'api/index.php?r=';
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : String(s).replace(/\{(\d+)\}/g, (m, n) => v[n - 1] != null ? v[n - 1] : m));
  const user = () => { const a = App.auth; return a && a.user && !a.user.local && a.mode === 'server' ? a.user : null; };
  const settings = () => App.settings();
  const cid = () => (App.D ? App.D.id : '');
  const num = n => Number(n).toLocaleString(App.lang || 'en');
  const dateOf = ts => App.fmtDate(new Date(ts * 1000).toLocaleDateString('en-CA'));
  const q = s => encodeURIComponent(s);
  async function api(route, body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw new Error('Mathub cannot be reached right now.'); }
    if (!json || json.ok === false) throw Object.assign(new Error((json && json.error) || 'Something went wrong. Please try again.'), { status: res.status, data: json });
    return json;
  }
  const extra = () => ({ lang: App.lang || 'en', persona: App.boChar ? App.boChar() : '' });
  /* the gates every Bo page has: members, then the AI consent */
  function gate(root, head, again) {
    if (!user()) { root.innerHTML = head + `<div class="mt-3">${App.lockCard('This is for members', 'Sign up with your montana.edu email. Every account gets credits for Bo each month, free.')}</div>`; if (App.auth) App.auth.bindLocks(root); return true; }
    if (!settings().aiConsent && App.boGateHtml) {
      root.innerHTML = head + `<div class="df-gate">${App.boGateHtml.consent()}</div>`;
      $('.df-gate', root).addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; if (b.dataset.go === 'agree') { App.setSetting('aiConsent', Date.now()); again(); } else App.go('dashboard'); });
      return true;
    }
    return false;
  }
  const creditsNote = err => err.data && err.data.credits ? `<div class="callout small mb-2">${esc(err.message)} <a href="#/usage">${esc(t('Get credits'))}</a></div>` : '';

  /* ---------- Check my work ---------- */
  const CW_HEAD = () => App.pageHead('Check my work', 'Take a photo of your work on one problem. Bo finds the first line that goes wrong, says why and gives you a hint to fix it yourself. He never writes the answer.');
  function checkView(root) {
    if (gate(root, CW_HEAD(), () => checkView(root))) return;
    let photo = null;
    root.innerHTML = CW_HEAD() + `<div class="lw-wrap">
      <form class="panel lw-form" id="lw-form" novalidate>
        <div class="lw-drop" id="lw-drop"><label class="btn primary" for="lw-file">${icon('image', 15)} ${esc(t('Take or choose a photo'))}</label><input type="file" id="lw-file" class="sr-only" accept="image/*" capture="environment"><p class="small muted">${esc(t('One problem, written clearly, top to bottom. A photo of a screen works too.'))}</p><img class="lw-prev" id="lw-prev" alt="" hidden></div>
        <div class="field"><label for="lw-problem">What was the problem? <span class="muted">(optional)</span></label><input class="input" id="lw-problem" maxlength="600" placeholder="${esc(t('For example: solve 2x + 3 = 11'))}" translate="no"></div>
        <div class="row gap-sm"><button type="submit" class="btn primary" id="lw-go" disabled>${icon('check', 15)} ${esc(t('Check it'))}</button><span class="small muted">${esc(t('Uses a few credits. The photo is not kept.'))}</span></div>
      </form>
      <div id="lw-out" aria-live="polite"></div></div>`;
    const go = $('#lw-go', root), prev = $('#lw-prev', root), out = $('#lw-out', root);
    $('#lw-file', root).addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      if (!/^image\//.test(f.type)) { toast('Choose a photo (JPEG, PNG or WebP).', 4000); return; }
      try { photo = await App.shrinkPhoto(f, 1800); prev.src = photo.preview; prev.hidden = false; prev.alt = t('Your photo: {1}', f.name || t('photo')); go.disabled = false; go.focus(); }
      catch (err) { toast('That photo could not be opened. Try another.', 4000); }
    });
    $('#lw-form', root).addEventListener('submit', async e => {
      e.preventDefault(); if (!photo) return; go.disabled = true;
      out.innerHTML = `<div class="df-reading" role="status"><div><b>${esc(t('Bo is reading your work'))}</b><p class="small muted">${esc(t('About twenty seconds. Stay on this page.'))}</p><div class="df-reading-bar"><span></span></div></div></div>`;
      try {
        const r = await api('learn_check', Object.assign({ class: cid(), image: { type: photo.type, data: photo.data }, problem: $('#lw-problem', root).value.trim() }, extra()));
        if (App.current !== App.views.checkwork) return; paintCheck(out, r, root);
      } catch (err) { out.innerHTML = creditsNote(err) || `<div class="callout small">${esc(err.message)}</div>`; }
      go.disabled = false;
    });
  }
  function paintCheck(out, r, root) {
    if (r.unreadable) { out.innerHTML = `<section class="panel lw-res"><h2 class="lw-h">${icon('eye', 16)} ${esc(t('Bo could not read it'))}</h2><p>${esc(t('Try a brighter photo, closer up, with one problem on it, or type the problem in too.'))}</p></section>`; return; }
    const wrong = r.lines.find(l => l.state === 'wrong');
    out.innerHTML = `<section class="panel lw-res">
      ${r.problem ? `<div class="eyebrow">${esc(t('The problem'))}</div><p class="lw-problem" translate="no">${esc(r.problem)}</p>` : ''}
      <ol class="lw-lines">${r.lines.map(l => `<li class="lw-${l.state}"${l.state === 'wrong' ? ' id="lw-wrong" tabindex="-1"' : ''}><span class="lw-mark" aria-hidden="true">${l.state === 'ok' ? icon('check', 13) : l.state === 'wrong' ? icon('x', 13) : ''}</span><code translate="no">${esc(l.text)}</code><span class="sr-only">${esc(l.state === 'ok' ? t('follows') : l.state === 'wrong' ? t('the first line that goes wrong') : t('after the slip'))}</span></li>`).join('')}</ol>
      ${r.all_right ? `<div class="callout good mt-2">${icon('check', 15)} <span><b>${esc(t('Every line follows.'))}</b> ${r.hint ? `<span translate="no">${esc(r.hint)}</span>` : ''}</span></div>`
        : `<div class="lw-why mt-2"><h2 class="lw-h">${icon('target', 16)} ${esc(t('Line {1}', r.first_wrong))}${r.exact ? ` <span class="chip good">${esc(t('checked exactly'))}</span>` : ''}</h2><p translate="no">${esc(r.why)}</p>${r.hint ? `<p class="lw-hint"><b>${esc(t('Hint'))}</b> <span translate="no">${esc(r.hint)}</span></p>` : ''}</div>`}
      <div class="row gap-sm mt-2">${wrong ? `<button type="button" class="btn" data-action="lw-ask">${icon('chat', 14)} ${esc(t('Ask Bo about this line'))}</button>` : ''}<button type="button" class="btn ghost" data-action="lw-again">${icon('rotate', 14)} ${esc(t('Check another'))}</button></div>
    </section>`;
    const w = $('#lw-wrong', out); if (w) w.focus({ preventScroll: false });
    bind(out, {
      'lw-ask': () => {
        const focus = { text: `My work on ${r.problem || 'a problem'}:\n${r.lines.map(l => `${l.n}. ${l.text}`).join('\n')}\nYou said line ${r.first_wrong} goes wrong: ${r.why}`, short: wrong.text, tag: t('Line {1}', r.first_wrong), quick: [t('Why is that wrong?'), t('Give me another hint.'), t('Show me a similar example.')] };
        if (App.boFloat && settings().boFloat !== false) App.boFloat.open({ focus, q: t('Why is that wrong?') }); else toast('Turn on Bo on every page in Settings to ask him about a line.', 4500);
      },
      'lw-again': () => { checkView(root); const b = $('[for="lw-file"]', root); if (b) b.focus(); }
    });
  }

  /* ---------- Notes from slides ---------- */
  const SL_HEAD = () => App.pageHead('Notes from slides', 'Open your lecture slides and Bo turns them into study notes and flashcards, from what the slides say. They are kept with your account.');
  async function slidesView(root) {
    if (gate(root, SL_HEAD(), () => slidesView(root))) return;
    root.innerHTML = SL_HEAD() + `<div class="sl-wrap">
      <section class="panel"><div class="panel-h"><div class="panel-title">${icon('upload')} ${esc(t('New notes'))}</div></div>
        <div class="row gap-sm"><label class="btn primary" for="sl-file">${icon('file', 15)} ${esc(t('Open slides'))}</label><input type="file" id="sl-file" class="sr-only" accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"><span class="small muted">${esc(t('.pptx or .pdf. Read on this device; only the text is sent to Bo.'))}</span></div>
        <div id="sl-status" class="mt-2" aria-live="polite"></div></section>
      <div id="sl-list" class="mt-3"></div></div>`;
    const status = $('#sl-status', root);
    $('#sl-file', root).addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      status.innerHTML = `<p class="small">${esc(t('Opening {1}…', f.name))}</p>`;
      let slides; try { slides = await App.Office.slideText(f); } catch (err) { status.innerHTML = `<div class="callout small">${esc(err.message)}</div>`; return; }
      const words = slides.reduce((n, s) => n + (s.text.match(/\S+/g) || []).length, 0);
      if (!slides.length) { status.innerHTML = `<div class="callout small">${esc(t('Those slides have no text to read. Slides that are only pictures need the words typed in.'))}</div>`; return; }
      status.innerHTML = `<div class="df-reading" role="status"><div><b>${esc(t('Bo is reading {1} slides ({2} words)', num(slides.length), num(words)))}</b><p class="small muted">${esc(t('This takes him about a minute. Stay on this page.'))}</p><div class="df-reading-bar"><span></span></div></div></div>`;
      try { const r = await api('learn_slides', Object.assign({ class: cid(), source: f.name, slides }, extra())); if (App.current !== App.views.slides) return; toast(t('{1} flashcards made', num(r.set.count))); location.hash = App.link('slides', r.set.id); }
      catch (err) { status.innerHTML = creditsNote(err) || `<div class="callout small">${esc(err.message)}</div>`; }
    });
    const box = $('#sl-list', root);
    try {
      const j = await api('learn_slides_list&class=' + q(cid())); if (App.current !== App.views.slides) return;
      box.innerHTML = `<section class="panel"><div class="panel-h"><div class="panel-title">${icon('book')} ${esc(t('Your notes'))}</div></div>${j.sets.length ? `<ul class="sl-sets">${j.sets.map(s => `<li><a href="${App.link('slides', s.id)}"><b translate="no">${esc(s.title)}</b><small>${esc(t('{1} slides · {2} flashcards · {3}', num(s.slides), num(s.count), dateOf(s.created)))}</small></a><button type="button" class="icon-btn" data-action="sl-del" data-id="${s.id}" aria-label="${esc(t('Delete {1}', s.title))}" title="${esc(t('Delete'))}">${icon('trash', 15)}</button></li>`).join('')}</ul>` : `<div class="empty small">${esc(t('No notes yet. Open the slides from a lecture to start.'))}</div>`}</section>`;
      bind(box, { 'sl-del': async el => { if (!confirm(t('Delete these notes and their flashcards?'))) return; try { await api('learn_slides_delete', { class: cid(), id: +el.dataset.id }); el.closest('li').remove(); toast('Deleted'); } catch (e) { toast(e.message, 4000); } } });
    } catch (e) { box.innerHTML = `<div class="empty small">${esc(e.message)}</div>`; }
  }
  async function setView(root, id) {
    root.innerHTML = `<div class="sl-set"><a class="btn sm" href="${App.link('slides')}">${icon('left', 13)} ${esc(t('All notes'))}</a><div class="empty mt-3">${esc(t('Opening…'))}</div></div>`;
    let S; try { S = (await api(`learn_slides_get&class=${q(cid())}&id=${q(id)}`)).set; } catch (e) { $('.empty', root).textContent = e.message; return; }
    if (App.current !== App.views.slides) return;
    const N = S.notes || {}; const cards = S.cards || [];
    root.innerHTML = `<div class="sl-set">
      <a class="btn sm" href="${App.link('slides')}">${icon('left', 13)} ${esc(t('All notes'))}</a>
      <div class="eyebrow mt-2">${esc(t('{1} slides · {2}', num(S.slides), S.source || dateOf(S.created)))}</div>
      <h1 class="page-title" translate="no">${esc(S.title)}</h1>
      ${N.summary ? `<p class="page-sub" translate="no">${esc(N.summary)}</p>` : ''}
      <div class="row gap-sm mt-2 sl-acts"><button type="button" class="btn" data-action="sl-word">${icon('download', 14)} ${esc(t('Download as Word'))}</button><button type="button" class="btn ghost" data-action="sl-csv">${icon('cards', 14)} ${esc(t('Flashcards for Anki or Quizlet'))}</button><button type="button" class="btn ghost" data-action="sl-print">${icon('print', 14)} ${esc(t('Print'))}</button></div>
      <div class="sl-cols mt-3">
        <article class="panel sl-notes" translate="no">${(N.sections || []).map(s => `<section><h2>${esc(s.heading)}</h2>${s.points.length ? `<ul>${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}${s.terms.length ? `<dl>${s.terms.map(x => `<dt>${esc(x.term)}</dt><dd>${esc(x.def)}</dd>`).join('')}</dl>` : ''}</section>`).join('')}</article>
        ${cards.length ? `<section class="panel sl-cards" aria-label="${esc(t('Flashcards'))}"><div class="panel-h"><div class="panel-title">${icon('cards')} ${esc(t('Flashcards'))}</div><span class="small muted" id="sl-pos"></span></div>
          <button type="button" class="sl-card" id="sl-card" aria-live="polite"></button>
          <div class="row gap-sm mt-2 sl-nav"><button type="button" class="btn sm" data-action="sl-prev">${icon('left', 13)} ${esc(t('Back'))}</button><button type="button" class="btn sm primary" data-action="sl-flip">${esc(t('Show the answer'))}</button><button type="button" class="btn sm" data-action="sl-next">${esc(t('Next'))} ${icon('right', 13)}</button></div>
          <p class="small muted">${esc(t('Tap the card or press Space to turn it over; the arrow keys go back and on.'))}</p></section>` : ''}
      </div></div>`;
    App.typeset && App.typeset(root);
    let i = 0, back = false;
    const card = $('#sl-card', root);
    const paint = () => { if (!card) return; const c = cards[i]; card.classList.toggle('back', back); card.innerHTML = `<span class="sl-side">${esc(back ? t('Answer') : t('Question'))}</span><span class="sl-text" translate="no">${esc(back ? c.back : c.front)}</span>`; $('#sl-pos', root).textContent = t('{1} of {2}', i + 1, cards.length); const f = $('[data-action="sl-flip"]', root); f.textContent = back ? t('Show the question') : t('Show the answer'); App.typeset && App.typeset(card); };
    const flip = () => { back = !back; paint(); }; const step = d => { i = (i + d + cards.length) % cards.length; back = false; paint(); };
    if (card) { paint(); card.addEventListener('click', flip); }
    const keys = e => { if (App.current !== App.views.slides || !card || /input|textarea|select/i.test((e.target.tagName || ''))) return; if (e.key === ' ' && document.activeElement === card) { e.preventDefault(); flip(); } else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); };
    document.addEventListener('keydown', keys); App.views.slides._off = () => document.removeEventListener('keydown', keys);
    bind(root, {
      'sl-flip': flip, 'sl-next': () => step(1), 'sl-prev': () => step(-1),
      'sl-print': () => global.print(),
      'sl-csv': () => {   // front, back: what Anki and Quizlet import
        const cell = s => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        App.Office.download(new Blob(['﻿' + cards.map(c => cell(c.front) + ',' + cell(c.back)).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }), App.Office.safeName(S.title + ' flashcards') + '.csv');
      },
      'sl-word': async () => {
        const blocks = [{ style: 'title', text: S.title }]; if (N.summary) blocks.push({ style: 'note', text: N.summary });
        (N.sections || []).forEach(s => { blocks.push({ style: 'h1', text: s.heading }); s.points.forEach(p => blocks.push({ style: 'p', text: '• ' + p })); s.terms.forEach(x => blocks.push({ style: 'p', runs: [{ t: x.term, b: true }, { t: ': ' + x.def }] })); });
        if (cards.length) { blocks.push({ style: 'pagebreak' }); blocks.push({ style: 'h1', text: t('Flashcards') }); cards.forEach((c, k) => blocks.push({ style: 'p', runs: [{ t: `${k + 1}. ${c.front}`, b: true }, { t: '\n' + c.back }] })); }
        try { App.Office.download(await App.Office.docx(blocks, { title: S.title }), App.Office.safeName(S.title) + '.docx', App.Office.DOCX); } catch (e) { toast('That file could not be made here. Use Print instead.', 4000); }
      }
    });
  }

  const off = () => { if (App.views.slides._off) { App.views.slides._off(); App.views.slides._off = null; } };
  App.views.checkwork = { title: 'Check my work', render(root) { checkView(root); } };
  App.views.slides = { title: 'Notes from slides', render(root, param) { off(); if (param) setView(root, param); else slidesView(root); }, unmount: off };
})(window);
