/* ============================================================
   StudyCat — Max, shown (#/max): what a call with Bo is like, for everyone, in under a minute.
   A short demo that plays by itself (no AI, no sound): a student writes a problem on the board, Bo
   circles the slip, says why in captions, puts the steps up and a graph you can move. Then one
   button: call Bo (the Call Bo sheet, assets/call-launch.js; every account gets credits each month), or sign up first.
   Plain, short words on purpose: one idea per block, big type, nothing to read twice.
   Reduce motion shows the end of the demo at once, with what was said written out.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, settings, toast } = App;
  const bo = n => (App.bobcatSvg ? App.bobcatSvg(n) : '');
  const still = () => (global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'off';
  const API = 'api/index.php?r=';
  const user = () => { const a = App.auth; return !!(a && a.user && !a.user.local && a.mode === 'server'); };
  async function status() { try { const r = await fetch(API + 'ai_status', { credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', Accept: 'application/json' } }); return await r.json(); } catch (e) { return null; } }

  /* ---------- handwriting: a few hand-drawn characters, in a 12 × 20 box ---------- */
  const G = {
    '2': 'M2 6C2 2 10 1 10 6C10 10 4 14 1 19L11 19', '3': 'M2 3C6 0 11 2 9 7C8 9 6 9.5 5 9.5C8 9.5 11 11 10 15C9 20 3 20 1 17',
    '1': 'M3 4L6 1L6 19', '4': 'M8 19L8 1L1 13L11 13', '7': 'M1 2L11 2L5 19', '8': 'M6 10C1 8 2 1 6 1C10 1 11 8 6 10C0 12 1 19 6 19C11 19 12 12 6 10',
    'x': 'M1 9L10 19M10 9L1 19', '+': 'M1 12L11 12M6 7L6 17', '=': 'M1 10L11 10M1 15L11 15'
  };
  // a line of handwriting: one path per stroke, each drawn in turn
  function hand(text, x, y, k, from) {
    let cx = x, i = from; const out = [];
    for (const ch of text) {
      if (ch === ' ') { cx += 7 * k; continue; }
      const d = G[ch]; if (d) d.split(/(?=M)/).forEach(seg => out.push(`<path d="${seg}" transform="translate(${cx} ${y}) scale(${k})" pathLength="1" class="mx-ink" style="--i:${i++}"/>`));
      cx += (ch === 'x' ? 13 : 14) * k;
    }
    return { svg: out.join(''), end: cx, next: i };
  }

  /* ---------- the story, scene by scene: who says what, and what appears ---------- */
  const SCRIPT = [
    { at: 300, who: 'you', say: 'Can you check my work?', show: 'l1' },
    { at: 3300, show: 'l2' },
    { at: 5300, who: 'you', say: 'I got x = 7.', show: 'l3' },
    { at: 7600, who: 'bo', say: 'Ooh, close! Look at the second line.', show: 'look' },
    { at: 9600, show: 'mark' },
    { at: 10400, who: 'bo', say: 'Take the 3 away first. 11 minus 3 is 8.' },
    { at: 13600, who: 'bo', say: 'Then cut it in half. So x is 4.', show: 'page' },
    { at: 17400, who: 'bo', say: 'Here it is as a picture: the lines meet at x = 4.', show: 'graph' },
    { at: 21800, who: 'bo', say: 'Drag the graph to look around. Want to try one on your own?', show: 'check' },
    { at: 26500, show: 'end' }
  ];
  const PAGE = { title: 'Solving 2x + 3 = 11', open: false, items: [{ k: 'step', t: 'Take 3 from both sides: $2x = 8$' }, { k: 'step', t: 'Cut both sides in half: $x = 4$' }, { k: 'answer', t: '$x = 4$' }] };
  const GRAPH = { title: 'Both sides as lines', open: false, items: [{ k: 'draw', t: JSON.stringify({ type: 'graph', x: [-1, 7], y: [-1, 16], fns: [{ f: '2x+3', label: 'y = 2x + 3' }, { f: '11', label: 'y = 11', color: 'red' }], points: [{ x: 4, y: 11, label: '(4, 11)' }] }) }] };

  function frame(tall) {
    const k = tall ? 2.3 : 2.2, x = tall ? 40 : 44;
    const l1 = hand('2x+3=11', x, tall ? 110 : 110, k, 0), l2 = hand('2x=14', x, tall ? 190 : 190, k, l1.next), l3 = hand('x=7', x, tall ? 270 : 270, k, l2.next);
    const n1 = l1.next, n2 = l2.next - l1.next, n3 = l3.next - l2.next;
    // where "14" sits on the second line (for Bo's circle and note)
    const c14x = x + 3 * 14 * k - 6, c14w = 2 * 14 * k + 8;
    return { l1: l1.svg, l2: l2.svg, l3: l3.svg, n1, n2, n3, mark: { x: c14x, y: 190 - 8, w: c14w, h: 20 * k + 16 }, end1: l1.end, W: tall ? 540 : 820, H: tall ? 900 : 560, tall };
  }
  function stageHtml(F) {
    const m = F.mark; const cx = m.x + m.w / 2, cy = m.y + m.h / 2, rx = m.w / 2 + 10, ry = m.h / 2 + 8;
    return `<div class="mx-call${F.tall ? ' tall' : ''}" style="--w:${F.W};--h:${F.H}">
      <div class="mx-top" aria-hidden="true"><span class="mx-chip">Calc I</span><span class="mx-clock"><i></i>0:12</span><span class="mx-sp"></span><span class="mx-st" data-mx-st>listening</span><span class="mx-orb"><i></i><i></i>${bo(46)}</span></div>
      <svg class="mx-board" viewBox="0 0 ${F.W} ${F.H}" aria-hidden="true">
        <g class="mx-l mx-l1">${F.l1}</g><g class="mx-l mx-l2">${F.l2}</g><g class="mx-l mx-l3">${F.l3}</g>
        <g class="mx-mark"><path d="M${cx - rx * 0.2} ${cy - ry}C${cx + rx * 1.1} ${cy - ry * 1.15} ${cx + rx * 1.15} ${cy + ry * 1.1} ${cx} ${cy + ry}C${cx - rx * 1.2} ${cy + ry} ${cx - rx * 1.15} ${cy - ry * 1.05} ${cx + rx * 0.15} ${cy - ry * 1.05}" pathLength="1" class="mx-circle"/>
          <text x="${m.x + m.w + 26}" y="${cy + 9}" class="mx-note">11 − 3 = 8</text></g>
        <g class="mx-checkmark"><path d="M${F.end1 + 16} 136l12 14 26-34" pathLength="1"/></g>
      </svg>
      <div class="mx-cards"><section class="bb mx-card mx-page" aria-label="Bo’s page"></section><section class="bb mx-card mx-graph" aria-label="Bo’s graph"></section></div>
      <div class="mx-caps" aria-hidden="true"><div class="mx-cc"></div></div>
      <div class="mx-dock" aria-hidden="true"><span>${icon('mic', 18)}</span><span class="mx-look">${icon('eye', 18)}</span><span>${icon('image', 18)}</span><span class="mx-hang">${icon('phoneoff', 19)}</span></div>
      <div class="mx-over" hidden><p>That’s a call with Bo.</p><div class="mx-over-acts"><button type="button" class="btn primary lg" data-mx="free">${icon('phone', 18)} Call Bo free</button><button type="button" class="btn lg" data-mx="replay">${icon('rotate', 16)} Watch again</button></div></div>
    </div>`;
  }

  /* ---------- playing it ---------- */
  const P = { timers: [], t0: 0, el: null, F: null, playing: false };
  function clear() { P.timers.forEach(clearTimeout); P.timers = []; }
  function caption(who, text, now) {
    const cc = $('.mx-cc', P.el); if (!cc) return; const words = text.split(' ');
    const line = document.createElement('p'); line.className = `cc-cue cc-${who}`; line.innerHTML = `<span class="cc-t"><b class="cc-who">${who === 'bo' ? 'Bo' : 'You'}</b> <span class="mx-w"></span></span>`;
    cc.appendChild(line); while (cc.children.length > 2) cc.firstElementChild.remove();
    const w = $('.mx-w', line); if (now) { w.textContent = text; return; }
    words.forEach((x, i) => P.timers.push(setTimeout(() => { w.textContent = words.slice(0, i + 1).join(' '); }, i * 300)));   // word by word, as he says it
    const st = $('[data-mx-st]', P.el); if (st) { st.textContent = who === 'bo' ? 'talking' : 'listening'; P.el.classList.toggle('mx-bo-talks', who === 'bo'); P.timers.push(setTimeout(() => { P.el.classList.remove('mx-bo-talks'); st.textContent = 'listening'; }, words.length * 300 + 400)); }
  }
  function show(k, now) {
    const el = P.el; if (!el) return;
    if (k === 'l1' || k === 'l2' || k === 'l3') el.classList.add('mx-' + k);
    if (k === 'look') el.classList.add('mx-looking');
    if (k === 'mark') el.classList.add('mx-marked');
    if (k === 'check') el.classList.add('mx-checked');
    if ((k === 'page' || k === 'graph') && App.boBoard) {
      const card = $(k === 'page' ? '.mx-page' : '.mx-graph', el); if (!card.firstChild) { card.innerHTML = App.boBoard.shell({ id: 'mx' + k, name: k === 'page' ? 'Bo · page 1' : 'Bo · page 2' }); App.boBoard.wire(card); }
      App.boBoard.paint(card, [k === 'page' ? PAGE : GRAPH], 0, !now); card.classList.add('on');
    }
    if (k === 'end') { const o = $('.mx-over', el); if (o) o.hidden = false; P.playing = false; paintPlay(); }
  }
  function build() {
    const host = $('#mx-stage'); if (!host) return;
    const tall = host.clientWidth < 540; P.F = frame(tall);
    host.innerHTML = stageHtml(P.F); P.el = $('.mx-call', host);
    const fit = () => { if (!P.el) return; const kx = host.clientWidth / P.F.W; P.el.style.setProperty('--k', kx.toFixed(4)); host.style.height = Math.round(P.F.H * kx) + 'px'; };
    fit(); host._fit = fit;
    // stroke timing: the three lines written one after another
    $$('.mx-l1 .mx-ink', P.el).forEach((p, i) => p.style.setProperty('--d', `${300 + i * 150}ms`));
    $$('.mx-l2 .mx-ink', P.el).forEach((p, i) => p.style.setProperty('--d', `${i * 150}ms`));
    $$('.mx-l3 .mx-ink', P.el).forEach((p, i) => p.style.setProperty('--d', `${i * 150}ms`));
  }
  function play() {
    clear(); build(); if (!P.el) return; P.playing = true; paintPlay();
    if (still()) { SCRIPT.forEach(s => { if (s.say) caption(s.who, s.say, true); if (s.show && s.show !== 'end') show(s.show, true); }); P.el.classList.add('mx-still'); show('end', true); return; }
    SCRIPT.forEach(s => P.timers.push(setTimeout(() => { if (s.say) caption(s.who, s.say); if (s.show) show(s.show); }, s.at)));
  }
  function pause() { clear(); P.playing = false; paintPlay(); if (P.el) P.el.classList.add('mx-paused'); }
  function paintPlay() { const b = $('[data-mx="toggle"]'); if (!b) return; b.innerHTML = P.playing ? `${icon('pause', 16)} Pause` : `${icon('play', 16)} Play`; b.setAttribute('aria-pressed', String(!P.playing)); }

  /* ---------- the button: call Bo (or sign up first); the Call Bo sheet picks the class and shows the credits ---------- */
  function callFree() {
    if (!user()) { if (App.auth) App.auth.open('signup'); return; }
    if (!(App.boTalk && App.boTalk.supported()) || !App.callBo) { toast('Calls with Bo are on the website. Open studycat.org on a computer or phone browser.', 4500); return; }
    let cid = settings().boClass; try { const ids = App.home.myIds() || []; if (!ids.includes(cid)) cid = App.home.curClass() || ids[0]; } catch (e) {}
    App.callBo({ cid: cid || '', onClose: () => App.rerender && App.rerender() });
  }

  App.views.max = {
    title: 'StudyCat Max',
    render(root) {
      root.innerHTML = `<div class="mx">
        <section class="mx-hero" aria-labelledby="mx-h">
          <div class="mx-copy">
            <p class="mx-kicker">${icon('phone', 16)} Calls with Bo</p>
            <h1 id="mx-h">Stuck? <span>Call Bo.</span></h1>
            <p class="mx-lede">Talk to him like a friend. Write on the board. He shows you what went wrong.</p>
            <div class="mx-acts"><button type="button" class="btn primary lg mx-free" data-mx="free">${icon('phone', 18)} <span data-mx-free>Call Bo</span></button></div>
            <p class="mx-fine" data-mx-fine>Every account gets free credits each month. No card.</p>
          </div>
          <figure class="mx-demo" aria-labelledby="mx-cap">
            <div class="mx-stage" id="mx-stage"></div>
            <figcaption class="mx-ctl"><span id="mx-cap">A call with Bo, in 25 seconds. No sound, just captions.</span><span class="mx-ctl-b"><button type="button" class="btn sm" data-mx="toggle" aria-pressed="false">${icon('pause', 16)} Pause</button><button type="button" class="btn sm ghost" data-mx="replay">${icon('rotate', 15)} Replay</button></span></figcaption>
            <details class="mx-script"><summary>Read what they say</summary><ol>${SCRIPT.filter(s => s.say).map(s => `<li><b>${s.who === 'bo' ? 'Bo' : 'You'}:</b> ${esc(s.say)}</li>`).join('')}</ol></details>
          </figure>
        </section>
        <section class="mx-how" aria-labelledby="mx-how-h"><h2 class="mx-h2" id="mx-how-h">How it works</h2>
          <ol class="mx-steps"><li><span class="mx-n">1</span><b>Call him.</b><span>One tap. Just talk.</span></li><li><span class="mx-n">2</span><b>Write it out.</b><span>The whole screen is your board.</span></li><li><span class="mx-n">3</span><b>He helps.</b><span>He circles the slip and shows the steps.</span></li></ol></section>
        <section class="mx-get" aria-labelledby="mx-get-h"><h2 class="mx-h2" id="mx-get-h">What you get</h2>
          <ul class="mx-tiles">
            <li>${icon('phone', 26)}<b>Calls with Bo</b><span>Any time, about any class.</span></li>
            <li>${icon('pen', 26)}<b>A board you share</b><span>You write. He marks it.</span></li>
            <li>${icon('chart', 26)}<b>Graphs you can move</b><span>Drag, zoom, add your own.</span></li>
            <li>${icon('chat', 26)}<b>Bo on every page</b><span>Ask about what you see.</span></li>
          </ul></section>
        <section class="mx-end" aria-labelledby="mx-end-h"><span class="mx-end-av" aria-hidden="true">${bo(84)}</span><h2 class="mx-h2" id="mx-end-h" data-mx-endh>Try it now. It’s free.</h2><p data-mx-endp>Every account gets credits for Bo each month, free.</p>
          <div class="mx-acts"><button type="button" class="btn primary lg" data-mx="free">${icon('phone', 18)} Call Bo</button><a class="btn lg" href="#/usage">Credits and plans</a></div></section>
      </div>`;
      root.onclick = e => {
        const b = e.target.closest('[data-mx]'); if (!b) return; const k = b.dataset.mx;
        if (k === 'free') callFree(b);
        else if (k === 'replay') play();
        else if (k === 'toggle') { if (P.playing) pause(); else play(); }
      };
      requestAnimationFrame(() => {
        play();
        const st = $('#mx-stage'); if (st && global.ResizeObserver) { let w = st.clientWidth; new ResizeObserver(() => { if (!$('#mx-stage')) return; const tall = st.clientWidth < 540; if (P.F && tall !== P.F.tall) { if (P.playing || still()) play(); else build(); } else if (st._fit) st._fit(); w = st.clientWidth; }).observe(st); }
      });
      // what the line under the button says: about how long their credits last on a call (api/credits.php, through ai_status)
      status().then(s => {
        const K = s && s.credits; if (!K) return; const fine = $$('[data-mx-fine]');
        if (s.admin) { fine.forEach(x => { x.textContent = 'Administrators are never charged.'; }); return; }
        const mins = Math.floor((K.left || 0) / (K.call_rate || 6)); const f = n => App.credits ? App.credits.fmt(n) : String(Math.floor(n));
        fine.forEach(x => { x.textContent = mins >= 1 ? `You have ${f(K.left)} credits: about ${mins} minute${mins === 1 ? '' : 's'} on a call.` : `You’re out of credits. They come back on the 1st.`; });
      });
    }
  };
  addEventListener('hashchange', () => { if (!/^#\/max/.test(location.hash)) clear(); });
})(window);
