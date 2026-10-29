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
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; const Courses = global.Courses; if (!App) return;
  const { $, $$, esc, icon, settings, setSetting } = App;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s);
  const LEN = 5, TRIES = 6, XP = 20;
  const FIRST = '2026-10-29';   // puzzle #1

  // the words, class by class, each with what it means there
  const WORDS = {
    calc: [['LIMIT', 'The value f(x) gets close to as x gets close to a.'], ['SLOPE', 'Rise over run. The derivative at a point is the slope of the tangent line there.'], ['CHAIN', 'The chain rule: the derivative of f(g(x)) is f′(g(x))·g′(x).'], ['GRAPH', 'The picture of every point (x, f(x)).'], ['POWER', 'The power rule: the derivative of xⁿ is n·xⁿ⁻¹.'], ['DELTA', 'Δ, a change in a quantity, as in Δx.'], ['SIGMA', 'Σ, the sign for a sum, as in a Riemann sum.'], ['BOUND', 'A number a function never goes above (upper bound) or below (lower bound).'], ['LOCAL', 'A local maximum is higher than every point near it, not necessarily the highest overall.'], ['PRIME', 'f′, read “f prime”: the derivative of f.'], ['ROOTS', 'The x-values where f(x) = 0.'], ['SPEED', 'The absolute value of velocity: how fast, without the direction.'], ['UNITS', 'The units of f′(x) are the units of f per unit of x, such as metres per second.'], ['RATES', 'Related rates: how fast one quantity changes when a linked one changes.'], ['ERROR', 'The gap between an estimate, such as a tangent line approximation, and the true value.'], ['CURVE', 'A graph that bends. Its concavity says which way it bends.']],
    precalc: [['RANGE', 'Every output value a function takes.'], ['SLOPE', 'The rate of change of a line: change in y over change in x.'], ['DECAY', 'Exponential decay: a quantity shrinks by the same factor in each equal step of time.'], ['MODEL', 'A function that describes a real situation, such as a population over time.'], ['ACUTE', 'An acute angle is less than 90°.'], ['ANGLE', 'The turn between two rays from one point, measured in degrees or radians.'], ['SINES', 'The law of sines: a/sin A = b/sin B = c/sin C in any triangle.'], ['THETA', 'θ, the letter usually used for an angle.'], ['ROOTS', 'The solutions of f(x) = 0, where the graph meets the x-axis.'], ['ZEROS', 'The inputs where a function equals 0.'], ['SHIFT', 'Moving a graph left, right, up or down without changing its shape.'], ['PHASE', 'A phase shift slides a sine or cosine graph left or right.'], ['RATIO', 'A trigonometric ratio, such as opposite over hypotenuse for sine.'], ['POWER', 'A power function has the form f(x) = kxᵖ.'], ['INPUT', 'A value you put into a function; the domain is every allowed input.']],
    physics: [['FORCE', 'A push or a pull, measured in newtons. Net force equals mass times acceleration.'], ['SPEED', 'How fast something moves: the size of the velocity.'], ['POWER', 'The rate of doing work, measured in watts.'], ['JOULE', 'The unit of work and energy: one newton over one metre.'], ['WATTS', 'The unit of power: one joule per second.'], ['ORBIT', 'The path of a body held by gravity, such as a satellite around the Earth.'], ['RANGE', 'How far a projectile lands from where it was launched, on level ground.'], ['HOOKE', 'Hooke’s law: a spring’s force is proportional to its stretch, F = −kx.'], ['LEVER', 'A rigid bar turning about a pivot; force times lever arm gives torque.'], ['PIVOT', 'The point an object rotates about.'], ['FLUID', 'A substance that flows: a liquid or a gas.'], ['DEPTH', 'In a fluid at rest, pressure grows with depth: P = P₀ + ρgh.'], ['WAVES', 'Disturbances that carry energy, not matter, from place to place.'], ['SLOPE', 'The slope of a position–time graph is the velocity.'], ['ANGLE', 'Launch angle: on level ground and without air drag, 45° gives the longest range.']],
    writ: [['ESSAY', 'A short piece of writing that develops one idea.'], ['CLAIM', 'The position an argument asks the reader to accept.'], ['PROSE', 'Ordinary written language in sentences and paragraphs, as opposed to verse.'], ['VOICE', 'The writer’s personality as it comes through on the page.'], ['THEME', 'The central idea a piece of writing explores.'], ['GENRE', 'A kind of writing with its own conventions: an op-ed, a profile, a lab report.'], ['TOPIC', 'What a piece of writing is about.'], ['QUOTE', 'Someone else’s exact words, in quotation marks and cited.'], ['DRAFT', 'A version of a piece of writing on its way to a final one.'], ['STYLE', 'How something is written: word choice, sentence length, tone.'], ['ETHOS', 'An appeal to the writer’s credibility and character.'], ['LOGOS', 'An appeal to logic and evidence.'], ['IRONY', 'Saying one thing and meaning another, or an outcome opposite to what was expected.'], ['FOCUS', 'What a piece keeps returning to; a focused draft does not wander.']],
    csci: [['INPUT', 'input() reads a line the user types, as a string.'], ['PRINT', 'print() shows values on the screen.'], ['WHILE', 'A while loop repeats as long as its condition is true.'], ['FALSE', 'One of Python’s two Boolean values, with True.'], ['SPLIT', 'str.split() breaks a string into a list of pieces.'], ['ARRAY', 'A NumPy array: a grid of values of one type, fast to compute with.'], ['CLASS', 'A blueprint for objects: their data and their methods.'], ['FLOAT', 'A number with a decimal point, such as 3.14.'], ['TUPLE', 'An ordered collection that cannot be changed once made.'], ['RANGE', 'range(n) gives the whole numbers 0 to n − 1, often used in for loops.'], ['BREAK', 'break leaves the loop it is in at once.'], ['INDEX', 'The position of an item in a list, counting from 0.'], ['DEBUG', 'Finding and fixing what makes a program go wrong.'], ['SCOPE', 'Where in a program a variable can be used.'], ['STACK', 'The call stack: the functions waiting for the one running now to return.']],
    biob: [['CELLS', 'The smallest units of life; every living thing is made of one or more.'], ['GENES', 'Stretches of DNA that code for a product, usually a protein.'], ['AMINO', 'Amino acids are the building blocks of proteins.'], ['BONDS', 'Chemical bonds hold atoms together: covalent, ionic, hydrogen.'], ['POLAR', 'A polar molecule, such as water, has a slightly positive and a slightly negative end.'], ['HELIX', 'DNA’s shape: two strands twisted into a double helix.'], ['DOGMA', 'The central dogma: DNA is transcribed to RNA, RNA is translated to protein.'], ['GOLGI', 'The Golgi apparatus modifies, sorts and ships proteins made in the ER.'], ['CYCLE', 'The cell cycle: growth, DNA copying, then division.'], ['FLUID', 'The fluid mosaic model: a membrane is a moving sea of lipids with proteins in it.'], ['YIELD', 'Cellular respiration yields up to about 30–32 ATP per glucose.'], ['LIPID', 'Lipids, such as fats and phospholipids, do not mix with water.'], ['SUGAR', 'Sugars, such as glucose, are carbohydrates cells burn for energy.'], ['TRAIT', 'A trait is a feature that varies, such as flower colour.'], ['HARDY', 'Hardy–Weinberg: allele and genotype frequencies stay the same in a population that is not evolving.']],
    kin: [['PLANE', 'Anatomical planes: sagittal, frontal and transverse.'], ['JOINT', 'Where two or more bones meet.'], ['LEVER', 'Bones act as levers; joints are the pivots and muscles pull to turn them.'], ['FORCE', 'A muscle’s pull on a bone, with a size and a direction.'], ['ELBOW', 'The elbow joint: a hinge between the humerus and the ulna.'], ['WRIST', 'The joint between the forearm and the hand.'], ['ANKLE', 'The joint between the leg and the foot.'], ['CREEP', 'Creep: tissue keeps lengthening under a steady load.'], ['WOLFF', 'Wolff’s law: bone remodels to suit the loads placed on it.'], ['SQUAT', 'A squat bends the hips, knees and ankles together.'], ['CHAIN', 'A kinetic chain: linked joints moving together, open or closed.'], ['NERVE', 'A bundle of fibres carrying signals between the body and the spinal cord.'], ['TRIAD', 'The unhappy triad: an ACL, MCL and meniscus injury together.'], ['SWING', 'The swing phase of gait: the foot is off the ground.'], ['SCREW', 'The screw-home mechanism: the tibia turns outward as the knee straightens fully, locking it.']],
    psyx: [['MORAL', 'Moral treatment: the 1800s reform that cared for patients humanely.'], ['MODEL', 'A model of abnormality explains how disorders arise: biological, psychodynamic, cognitive.'], ['PANIC', 'Panic disorder: repeated unexpected panic attacks and fear of more.'], ['MANIA', 'A state of high energy, little sleep and racing thoughts, as in bipolar I.'], ['BINGE', 'Eating far more than most people would in a short time, with a sense of no control.'], ['ACUTE', 'Acute stress disorder: symptoms that start soon after a trauma and last up to a month.'], ['TESTS', 'Psychological tests: standardised measures, such as personality inventories.'], ['PURGE', 'Purging: vomiting or misusing laxatives after a binge, as in bulimia nervosa.'], ['MAJOR', 'Major depressive disorder: at least two weeks of low mood or lost interest.'], ['TRIAD', 'The cognitive triad: negative views of oneself, the world and the future.'], ['FEARS', 'Phobias are intense, lasting fears of a specific object or situation.'], ['MOODS', 'Mood disorders: depressive and bipolar disorders.'], ['TRAIT', 'A lasting pattern of thinking and behaving, as in personality disorders.']],
    _: [['STUDY', 'What you are doing right now.'], ['LEARN', 'To come to know something new.'], ['NOTES', 'What you write down to remember a class.'], ['GRADE', 'A mark for your work.'], ['FOCUS', 'Attention on one thing at a time.'], ['SKILL', 'Something you get better at with practice.'], ['THINK', 'To reason something through.'], ['RECAP', 'A short summary of what was covered.']]
  };
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

  /* ---------- the home card ---------- */
  function card(moreBtn) {
    const s = state(); const n = dayNo(s.d); const C = Courses[s.c];
    // the tiles: your last try and the next empty row (two empty rows before you start)
    const tiles = (g, res) => `<span class="wp-trow">${Array.from({ length: LEN }, (_, i) => `<span class="wp-tile ${g ? res[i] : 'blank'}">${g ? esc(g[i]) : ''}</span>`).join('')}</span>`;
    const last = s.g[s.g.length - 1];
    const preview = last ? tiles(last, mark(last, s.w)) + (s.done ? '' : tiles()) : tiles() + tiles();
    const lead = s.done ? (s.won ? t('Solved in {1} of 6.', s.g.length) : t('Not this time. The word was {1}.', s.w)) : s.g.length ? t('{1} of 6 tries used. Keep going.', s.g.length) : t('Guess today’s word in six tries');
    const sub = s.done ? `<b>${esc(s.w)}</b>${C ? ` · ${esc(C.short || C.name)}` : ''}: ${esc(s.m)}`
      : esc(s.streak > 0 ? t('Day {1} of your streak. Keep it going.', s.streak + 1) : C ? t('A word from {1}.', C.name) : t('A word about studying.'));
    return `<section class="hg-card hg-puzzle w-full" data-hg="puzzle" aria-labelledby="hg-puzzle-t">${moreBtn || ''}
      <div class="wp-text"><span class="wp-eyebrow">${esc(t('Daily challenge · #{1}', n))}</span><h2 id="hg-puzzle-t">${esc(lead)}</h2><p class="wp-sub">${sub}</p>${s.done && s.streak > 1 ? `<p class="wp-streak">${icon('fire', 14)} ${esc(t('{1}-day streak', s.streak))}</p>` : ''}</div>
      <div class="wp-preview" aria-hidden="true">${preview}</div>
      <div class="wp-side">${s.done ? (s.won ? `<span class="wp-pts">+${XP} XP</span>` : '') : `<span class="wp-pts">+${XP} XP</span>`}<span class="small muted">${esc(t('New puzzle in {1}', untilTomorrow()))}</span>
        ${s.done ? (C ? `<a class="wp-btn" href="#/${esc(s.c)}/dashboard">${esc(t('Open {1}', C.short || C.name))}</a>` : '') : `<button type="button" class="wp-btn" data-wp="open">${esc(s.g.length ? t('Keep playing') : t('Play today’s puzzle'))}</button>`}</div></section>`;
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
      const end = s.done ? `<div class="wp-end"><p class="wp-lead">${esc(s.won ? t('Solved in {1} of 6. +{2} XP', s.g.length, XP) : t('The word was {1}.', s.w))}</p><p class="wp-word"><b>${esc(s.w)}</b>${C ? ` · ${esc(C.short || C.name)}` : ''}: ${esc(s.m)}</p><p class="small muted">${esc(t('Streak: {1} · Solved {2} of {3}', s.streak, s.wins, s.played))} · ${esc(t('New puzzle in {1}', untilTomorrow()))}</p></div>` : '';
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
    m.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { press(b.dataset.k); if (e.detail > 0 && b.dataset.k !== 'close' && m.isConnected) dlg().focus(); return; } if (e.target === m) close(); });
    const dlg = () => m.querySelector('.wp-modal'); dlg().focus();
  }

  App.wordPuzzle = {
    card, open, mark, pick, pool, state, WORDS,
    // after the game the card is drawn again with the result, and focus goes to it
    wire(root) { root.addEventListener('click', e => { if (!e.target.closest('[data-wp="open"]')) return; open(() => { const c = $('.hg-puzzle', root); if (!c) return; const tmp = document.createElement('div'); const m = c.querySelector('.hg-more'); tmp.innerHTML = card(m ? m.outerHTML.replace(' aria-expanded="true"', ' aria-expanded="false"') : ''); const n = tmp.firstElementChild; c.replaceWith(n); const f = n.querySelector('.wp-btn') || n.querySelector('h2'); if (f) { if (f.tagName === 'H2') f.setAttribute('tabindex', '-1'); f.focus(); } }); }); }
  };
})(window);
