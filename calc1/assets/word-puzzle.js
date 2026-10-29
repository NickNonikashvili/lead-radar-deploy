/* ============================================================
   StudyCat — the daily word (the home's Daily challenge card, assets/home-grid.js)
   - One five-letter word a day from the vocabulary of your classes (below, with what each word means in that class);
     the same word all day, even if you change your classes. Six tries.
   - Each try colours its letters: right letter in the right place, in the word but elsewhere, not in the word
     (the standard rules: a letter that appears once is marked once). The colours also carry a mark (a bar, a dot)
     and every try is read out in words, so neither colour vision nor sight is needed to play.
   - Solve it: +20 XP, the streak grows by a day (it counts days in a row you solved it), and the word's meaning in
     its class, with a link to the class. Miss it: the word and its meaning, and the streak starts again.
   - Saved with the account (settings.wordPuzzle, assets/auth.js PREF_KEYS). Typed on a keyboard or with the
     on-screen keys.
   - Share your result: the coloured squares only (no letters, so nothing is given away), the try count and your
     invite link (a classmate who signs up through it gets Bo credits, and so do you). The share sheet on a phone
     and in the apps, the clipboard on a computer, and a box to copy by hand where neither works.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const Courses = global.Courses; if (!App) return;
  const { $, $$, esc, icon, settings, setSetting, toast } = App;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const LEN = 5, TRIES = 6, XP = 20;
  const FIRST = '2026-10-29';   // puzzle #1

  // the words, class by class, each with what it means there (assets/word-puzzle-words.js)
  const WORDS = global.StudyCatWords || { _: [['STUDY', 'What you are doing right now.']] };
  const dayNo = d => App.daysBetween(FIRST, d) + 1;
  const pool = () => {
    const ids = App.myCourses().filter(id => WORDS[id]); const seen = new Set(); const out = [];
    (ids.length ? ids : ['_']).forEach(id => WORDS[id].forEach(([w, m]) => { if (!seen.has(w) && /^[A-Z]{5}$/.test(w)) { seen.add(w); out.push({ w, m, c: id }); } }));
    return out;
  };
  // the same pool gives a different word every day for as many days as it has words (7919 is prime)
  const pick = d => { const P = pool(); return P[((dayNo(d) * 7919) % P.length + P.length) % P.length]; };
  const fresh = () => ({ streak: 0, best: 0, played: 0, wins: 0 });
  function state() {
    const d0 = App.todayISO(); const s = Object.assign(fresh(), settings().wordPuzzle || {});
    if (s.d !== d0) { const p = pick(d0); Object.assign(s, { d: d0, w: p.w, m: p.m, c: p.c, g: [], done: false, won: false }); }
    if (s.lastWon && App.daysBetween(s.lastWon, d0) > 1) s.streak = 0;   // a day was missed
    return s;
  }
  const save = s => setSetting('wordPuzzle', s);
  // the standard marking: greens first, then each remaining letter of the word can mark one yellow
  function mark(guess, word) {
    const res = Array(LEN).fill('no'); const left = {};
    for (let i = 0; i < LEN; i++) { if (guess[i] === word[i]) res[i] = 'ok'; else left[word[i]] = (left[word[i]] || 0) + 1; }
    for (let i = 0; i < LEN; i++) if (res[i] !== 'ok' && left[guess[i]]) { res[i] = 'in'; left[guess[i]]--; }
    return res;
  }
  const SAY = { ok: 'right place', in: 'in the word, wrong place', no: 'not in the word' };
  const sayTry = (g, r) => g.split('').map((L, i) => `${L} ${t(SAY[r[i]])}`).join(', ');
  const untilTomorrow = () => { const n = new Date(); const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const min = Math.max(1, Math.round((m - n) / 60000)); const h = Math.floor(min / 60); return h ? t('{1}h {2}m', h, min % 60) : t('{1}m', min); };

  /* ---------- share the result ---------- */
  const SQ = { ok: '\u{1F7E9}', in: '\u{1F7E8}', no: '\u2B1C' };   // green, yellow and white squares, as the daily word games post them
  let invite = '';   // your invite link, fetched once before you share (a share sheet must open straight from the tap)
  function getInvite() {
    const A = App.auth; if (invite || getInvite.busy || !A || !A.user || A.user.local || A.mode !== 'server' || A.unreachable) return; getInvite.busy = true;
    fetch('api/index.php?r=invite_mine', { credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j && j.ok && j.code) invite = `${App.siteBase()}#/join?ref=${encodeURIComponent(j.code)}`; }).catch(() => {}).then(() => { getInvite.busy = false; });
  }
  function shareText(s) {
    const head = t('StudyCat daily word #{1} · {2}/6', dayNo(s.d), s.won ? s.g.length : 'X') + (s.won && s.streak > 1 ? ' · \u{1F525} ' + t('{1}-day streak', s.streak) : '');
    return head + '\n\n' + s.g.map(g => mark(g, s.w).map(r => SQ[r]).join('')).join('\n');
  }
  async function share(btn) {
    const s = state(); if (!s.done) return; const text = shareText(s); const url = invite || App.siteBase();
    try {
      if (global.Native && Native.share) { await Native.share({ title: 'StudyCat', text, url }); return; }   // the apps (assets/app-boot.js)
      if (navigator.share && global.matchMedia && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'StudyCat', text, url }); return; }
      await navigator.clipboard.writeText(text + '\n' + url); toast(t('Copied. Paste it in your group chat.'), 3000);
    } catch (e) {
      if (e && e.name === 'AbortError') return;   // the share sheet was closed
      // no clipboard here: the text in a box, selected, to copy by hand
      const host = btn.closest('.wp-end, .wp-side') || btn.parentNode; const box = host.querySelector('.wp-share-box') || document.createElement('textarea');
      box.className = 'input wp-share-box'; box.readOnly = true; box.rows = s.g.length + 4; box.value = text + '\n' + url; box.setAttribute('aria-label', t('Your result, to copy'));
      if (!box.isConnected) host.appendChild(box); box.focus(); box.select();
    }
  }
  const shareBtn = () => `<button type="button" class="wp-btn wp-share" data-wp="share">${icon('send', 16)} ${esc(t('Share your result'))}</button>`;

  /* ---------- the home card ---------- */
  function card(moreBtn) {
    const s = state(); const n = dayNo(s.d); const C = Courses[s.c]; if (s.done) getInvite();
    // the tiles: your last try and the next empty row (two empty rows before you start)
    const tiles = (g, res) => `<span class="wp-trow">${Array.from({ length: LEN }, (_, i) => `<span class="wp-tile ${g ? res[i] : 'blank'}">${g ? esc(g[i]) : ''}</span>`).join('')}</span>`;
    const last = s.g[s.g.length - 1];
    const preview = last ? tiles(last, mark(last, s.w)) + (s.done ? '' : tiles()) : tiles() + tiles();
    const lead = s.done ? (s.won ? t('Solved in {1} of 6.', s.g.length) : t('Not this time. The word was {1}.', s.w)) : s.g.length ? t('{1} of 6 tries used. Keep going.', s.g.length) : t('Guess today’s word in six tries');
    const sub = s.done ? `<span translate="no"><b>${esc(s.w)}</b>${C ? ` · ${esc(C.short || C.name)}` : ''}: ${esc(s.m)}</span>`
      : esc(s.streak > 0 ? t('Day {1} of your streak. Keep it going.', s.streak + 1) : C ? t('A word from {1}.', C.name) : t('A word about studying.'));
    return `<section class="hg-card hg-puzzle w-full" data-hg="puzzle" aria-labelledby="hg-puzzle-t">${moreBtn || ''}
      <div class="wp-text"><span class="wp-eyebrow">${esc(t('Daily challenge · #{1}', n))}</span><h2 id="hg-puzzle-t">${esc(lead)}</h2><p class="wp-sub">${sub}</p>${s.done && s.streak > 1 ? `<p class="wp-streak">${icon('fire', 14)} ${esc(t('{1}-day streak', s.streak))}</p>` : ''}</div>
      <div class="wp-preview" aria-hidden="true">${preview}</div>
      <div class="wp-side">${s.done ? (s.won ? `<span class="wp-pts">+${XP} XP</span>` : '') : `<span class="wp-pts">+${XP} XP</span>`}<span class="small muted">${esc(t('New puzzle in {1}', untilTomorrow()))}</span>
        ${s.done ? shareBtn() + (C ? `<a class="hg-link" href="#/${esc(s.c)}/dashboard">${esc(t('Open {1}', C.short || C.name))}</a>` : '') : `<button type="button" class="wp-btn" data-wp="open">${esc(s.g.length ? t('Keep playing') : t('Play today’s puzzle'))}</button>`}</div></section>`;
  }

  /* ---------- the game ---------- */
  const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  function open(onClose) {
    if ($('#wp-modal')) return; const back = document.activeElement; let s = state(); let cur = '';
    const m = document.createElement('div'); m.className = 'modal-backdrop wp-back'; m.id = 'wp-modal';
    const known = () => { const k = {}; s.g.forEach(g => mark(g, s.w).forEach((r, i) => { const L = g[i]; const rank = { ok: 3, in: 2, no: 1 }; if (!k[L] || rank[r] > rank[k[L]]) k[L] = r; })); return k; };
    function paint() {
      const k = known();
      const rows = Array.from({ length: TRIES }, (_, r) => {
        const g = s.g[r]; const res = g ? mark(g, s.w) : null; const typing = !g && r === s.g.length && !s.done;
        const letters = g || (typing ? cur.padEnd(LEN) : ' '.repeat(LEN));
        const label = g ? t('Try {1}: {2}', r + 1, sayTry(g, res)) : typing ? t('Try {1}, typing: {2}', r + 1, cur ? cur.split('').join(' ') : t('empty')) : t('Try {1}, not used yet', r + 1);
        return `<div class="wp-row${typing ? ' now' : ''}" role="img" aria-label="${esc(label)}">${letters.split('').map((L, i) => `<span class="wp-cell ${res ? res[i] : L.trim() ? 'typed' : ''}">${esc(L.trim())}</span>`).join('')}</div>`;
      }).join('');
      const kb = KEYS.map((row, i) => `<div class="wp-krow">${i === 2 ? `<button type="button" class="wp-key wide" data-k="Enter">${esc(t('Enter'))}</button>` : ''}${row.split('').map(L => `<button type="button" class="wp-key ${k[L] || ''}" data-k="${L}" aria-label="${L}${k[L] ? ', ' + esc(t(SAY[k[L]])) : ''}">${L}</button>`).join('')}${i === 2 ? `<button type="button" class="wp-key wide" data-k="Backspace" aria-label="${esc(t('Delete a letter'))}">${icon('undo', 16)}</button>` : ''}</div>`).join('');
      const C = Courses[s.c];
      const end = s.done ? `<div class="wp-end"><p class="wp-lead">${esc(s.won ? t('Solved in {1} of 6. +{2} XP', s.g.length, XP) : t('The word was {1}.', s.w))}</p><p class="wp-word" translate="no"><b>${esc(s.w)}</b>${C ? ` · ${esc(C.short || C.name)}` : ''}: ${esc(s.m)}</p><p class="small muted">${esc(t('Streak: {1} · Solved {2} of {3}', s.streak, s.wins, s.played))} · ${esc(t('New puzzle in {1}', untilTomorrow()))}</p><div class="wp-end-act">${shareBtn()}</div></div>` : '';
      if (s.done) getInvite();
      $('.wp-body', m).innerHTML = `<div class="wp-board">${rows}</div>${end}${s.done ? '' : `<div class="wp-kb">${kb}</div>`}`;
    }
    m.innerHTML = `<div class="modal wp-modal" role="dialog" aria-modal="true" aria-labelledby="wp-h" aria-describedby="wp-how" tabindex="-1"><div class="row between wp-top"><h2 id="wp-h">${esc(t('Daily word · #{1}', dayNo(s.d)))}</h2><button type="button" class="icon-btn" data-k="close" aria-label="${esc(t('Close'))}">${icon('plus', 18)}</button></div>
      <p class="small muted wp-how" id="wp-how">${esc(t('Five letters, six tries. A letter turns green with a bar in the right place, gold with a dot if it is in the word somewhere else, grey if it is not in the word.'))}</p>
      <div class="wp-body"></div><p class="sr-only" aria-live="polite" id="wp-say"></p></div>`;
    document.body.appendChild(m); paint();
    const say = x => { const el = $('#wp-say', m); el.textContent = ''; setTimeout(() => { el.textContent = x; }, 40); };
    const close = () => { document.removeEventListener('keydown', onKey, true); m.remove(); if (back && back.isConnected) back.focus(); if (onClose) onClose(); };   // onClose may draw the card again and move focus to it
    function press(k) {
      if (k === 'close') return close(); if (s.done) return;
      if (k === 'Backspace') cur = cur.slice(0, -1);
      else if (k === 'Enter') {
        if (cur.length < LEN) { say(t('Five letters, please.')); m.querySelector('.wp-row.now').classList.add('shake'); setTimeout(() => { const r = m.querySelector('.wp-row.now'); if (r) r.classList.remove('shake'); }, 400); return; }
        s = state(); s.g.push(cur); const res = mark(cur, s.w); const won = cur === s.w; cur = '';
        if (won || s.g.length >= TRIES) {
          s.done = true; s.won = won; s.played++;
          if (won) { s.wins++; s.streak = s.lastWon && App.daysBetween(s.lastWon, s.d) === 1 ? s.streak + 1 : 1; s.best = Math.max(s.best, s.streak); s.lastWon = s.d; } else s.streak = 0;
        }
        save(s); paint();
        say(sayTry(s.g[s.g.length - 1], res) + '. ' + (s.done ? (s.won ? t('Solved. The word is {1}: {2}', s.w, s.m) : t('No tries left. The word was {1}: {2}', s.w, s.m)) : t('{1} tries left.', TRIES - s.g.length)));
        if (s.done && s.won) { if (App.addXP) App.addXP(XP); if (App.confetti && !(App.motionReduced && App.motionReduced())) App.confetti({ count: 90 }); }
        if (s.done) dlg().focus();   // the keyboard is gone; the result is read out
        return;
      } else if (/^[A-Z]$/.test(k) && cur.length < LEN) cur += k;
      paint(); say(cur ? cur.split('').join(' ') : t('empty'));
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); return close(); }
      if (e.key === 'Tab') { const f = $$('button', m).filter(b => b.offsetParent); const i = f.indexOf(document.activeElement); if (i < 0) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); return; } if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key === 'Enter' || e.key === 'Backspace' ? e.key : e.key.length === 1 ? e.key.toUpperCase() : '';
      if (k === 'Enter' && document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-k]')) return;   // Enter on a focused on-screen key presses that key
      if (k && (k === 'Enter' || k === 'Backspace' || /^[A-Z]$/.test(k))) { e.preventDefault(); press(k); }
    }
    document.addEventListener('keydown', onKey, true);
    // a tapped or clicked key gives focus back to the game, so the keyboard's Enter sends the word (not that key again)
    m.addEventListener('click', e => { const sh = e.target.closest('[data-wp="share"]'); if (sh) { share(sh); return; } const b = e.target.closest('[data-k]'); if (b) { press(b.dataset.k); if (e.detail > 0 && b.dataset.k !== 'close' && m.isConnected) dlg().focus(); return; } if (e.target === m) close(); });
    const dlg = () => m.querySelector('.wp-modal'); dlg().focus();
  }

  App.wordPuzzle = {
    card, open, mark, pick, pool, state, shareText, WORDS,
    // after the game the card is drawn again with the result, and focus goes to it
    wire(root) { root.addEventListener('click', e => { const sh = e.target.closest('[data-wp="share"]'); if (sh) { share(sh); return; } if (!e.target.closest('[data-wp="open"]')) return; open(() => { const c = $('.hg-puzzle', root); if (!c) return; const tmp = document.createElement('div'); const m = c.querySelector('.hg-more'); tmp.innerHTML = card(m ? m.outerHTML.replace(' aria-expanded="true"', ' aria-expanded="false"') : ''); const n = tmp.firstElementChild; c.replaceWith(n); const f = n.querySelector('[data-wp="open"]') || n.querySelector('h2'); if (f) { if (f.tagName === 'H2') f.setAttribute('tabindex', '-1'); f.focus(); } }); }); }
  };
})(window);
