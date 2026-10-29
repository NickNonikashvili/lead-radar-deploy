/* ============================================================
   StudyCat — the start page for a first visit (motion-web-design)
   Someone who has not signed in and has not picked a class yet gets
   the whole story on one page (assets/start.css): the Big Sky hero,
   real numbers, three steps on a trail, the class picker, what is
   inside, questions and a last call. The page is drawn at once and
   works without any of the motion below.

   Motion, in three tiers:
   - the hero's entrance is CSS (.mo-anim), so the headline paints
     straight away: it is the page's largest content
   - on a wide screen, GSAP + ScrollTrigger (assets/vendor, fetched by
     App.gsapLoad) choreograph the scroll: ridges in parallax, sections
     lifting in, numbers counting, the trail drawing itself, the sun
     setting behind the range at the end, questions easing open
   - on a phone, or if GSAP does not arrive in 2.5 s, a light
     IntersectionObserver version (.mo-io): fades and the trail only
   With Reduce motion (the OS or Settings) nothing is hidden or moved.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon } = App;
  const reduced = () => !!(App.motionReduced && App.motionReduced());
  const wide = () => (global.innerWidth || 0) >= 768;
  const S = App.startPitch = {};

  // the start page tells the story only to a newcomer on the website: not signed in, no class picked yet
  // (before the sign-in check answers, a device that has never been signed in counts as a newcomer: no swap of the page later)
  const signedInBefore = () => { try { const l = JSON.parse(localStorage.getItem('mathub-last-user') || 'null'); return !!(l && l.user); } catch (e) { return false; } };
  S.needed = () => !document.documentElement.hasAttribute('data-app') && !App.myCourses().length && (App.auth && App.auth.ready ? !App.auth.user : !signedInBefore());

  // real numbers from the class index: the classes on offer, their topics and flashcards, the languages
  S.numbers = function () {
    const C = global.Courses || {}; const ids = App.catalogIds().filter(id => C[id]);
    const topics = ids.reduce((n, id) => n + (C[id].sectionCount || (C[id].SECTIONS || []).length || 0), 0);
    const cards = ids.reduce((n, id) => n + (C[id].flashcardCount || 0), 0);
    const langs = global.I18N && Array.isArray(global.I18N.codes) ? global.I18N.codes.length : 7;
    return { classes: ids.length, topics, cards, langs };
  };

  const fmt = n => { try { return Number(n).toLocaleString(document.documentElement.lang || 'en'); } catch (e) { return String(n); } };

  /* ---------- the page (the October 2026 redesign: the designer's landing, 1-landing.html) ---------- */
  // ctx: { when (the date line), picker (the class picker's HTML) }
  // While it is on screen the frame steps aside (<html data-surface="guest">): no sidebar, and the header is the
  // site's own: the sections of this page, the language, Log in and Sign up free (assets/design.css, .gl-*).
  S.html = function (ctx) {
    const n = S.numbers(); const anim = !reduced(); const H = App.homeGrid;
    const num = v => `<b class="mo-num" data-count="${v}">${fmt(v)}</b>`;
    const stat = (ic, v, l) => `<div class="mo-stat gl-stat" data-mo><span class="gl-stat-ic" aria-hidden="true">${icon(ic, 20)}</span>${num(v)}<span>${l}</span></div>`;
    const q = (h, a) => `<details><summary>${h}<span class="gl-plus" aria-hidden="true">${icon('plus', 16)}</span></summary><div class="mo-a"><p>${a}</p></div></details>`;
    const tab = (k, i, h, sub, on) => `<button type="button" role="tab" class="gl-tab" id="gl-t${k}" aria-controls="gl-p${k}" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-gltab="${k}"><span class="gl-tab-n" aria-hidden="true">${i}</span><span class="gl-tab-t"><b>${h}</b><small>${sub}</small></span></button>`;
    const col = (h, items) => `<div class="gl-col" data-mo><h3>${h}</h3><ul>${items.map(x => `<li>${icon('check', 14)}${x}</li>`).join('')}</ul></div>`;
    const feat = (ic, h, p) => `<div class="gl-feat" data-mo><span class="gl-feat-ic" aria-hidden="true">${icon(ic, 18)}</span><span><b>${h}</b><small>${p}</small></span></div>`;
    const stack = (cls, ic, tone, h, p, tag = '') => `<article class="gl-card ${cls}"><div class="gl-card-h"><span class="hg-ic tone-${tone}" aria-hidden="true">${icon(ic, 20)}</span><h3>${h}</h3>${tag}</div><p>${p}</p></article>`;
    const art = H ? H.art.replace('mascot-slot hg-bo', 'mascot-slot hg-bo mo-bo') : '';
    return `<div class="landing-wrap mo-page gl-page${anim ? ' mo-anim' : ''}" data-mo-page>
      <header class="hg-hero mo-hero gl-hero" data-section="hero">
        <div class="hg-hero-in mo-hero-copy">
          <p class="hg-when">${esc(ctx.when)}</p>
          <h1 class="hg-title mo-h1"><span class="mo-line" style="--i:0"><span>Every class you take,</span></span> <em class="mo-line" style="--i:1"><span>made simple.</span></em></h1>
          <p class="hg-sub mo-sub">What is on the next exam, five-minute lessons and a tutor you can call. Free with a montana.edu email.</p>
          <div class="hg-cta hero-actions"><button type="button" class="btn primary lg hero-pick" data-action="go-pick">${icon('cap', 16)} Pick your classes</button><a class="btn lg hero-faculty" href="#/teach" title="StudyCat Faculty: write your syllabus, run the class from it">${icon('bulb', 16)} For professors</a></div>
          <p class="small mo-note">No account needed to look around.</p>
        </div>${art}
      </header>
      <div id="announcement-slot"></div>${ctx.banners || ''}
      <section class="mo-stats gl-stats" data-section="stats" aria-label="StudyCat in numbers">${stat('cap', n.classes, 'Montana State classes')}${stat('book', n.topics, 'topics with notes')}${stat('cards', n.cards, 'flashcards to review')}${stat('globe', n.langs, 'languages to choose from')}</section>
      <section class="mo-sec gl-steps" id="gl-how" data-section="how" aria-labelledby="gl-how-h">
        <h2 class="mo-h2" id="gl-how-h" data-mo>Start in three steps</h2>
        <div data-mo>
          <div class="gl-tabs" role="tablist" aria-label="How it works">${tab(1, 1, 'Pick a class', `Choose from ${n.classes} classes`, true)}${tab(2, 2, 'Take a five-minute quiz', 'Each answer solved step by step', false)}${tab(3, 3, 'Sign up to keep it', 'Free with montana.edu', false)}</div>
          <div class="gl-panel" role="tabpanel" id="gl-p1" aria-labelledby="gl-t1" tabindex="0">${ctx.picker}<div class="gl-p-foot"><button type="button" class="linkbtn" data-gltab="2">See what a quiz looks like</button></div></div>
          <div class="gl-panel" role="tabpanel" id="gl-p2" aria-labelledby="gl-t2" tabindex="0" hidden><div class="gl-split">
            <div class="gl-split-t"><h3>Five questions, about five minutes</h3><p>Questions come from your class’s topics. After each answer you see why it is right, and Bo can walk you through anything you missed.</p><button type="button" class="btn primary" data-gltab="1">Pick a class to start</button></div>
            <div class="gl-q" role="group" aria-labelledby="gl-q-h"><div class="gl-q-top"><span class="hg-code">Calc I</span><span>Limits</span><small>An example</small></div>
              <p class="gl-q-h" id="gl-q-h">What is the limit of sin(x) / x as x approaches 0?</p>
              <div class="gl-q-opts">${['0', '1', '∞', 'It does not exist'].map((o, i) => `<button type="button" class="gl-opt" data-glq="${i}"><span class="gl-opt-k" aria-hidden="true">${'ABCD'[i]}</span>${o}</button>`).join('')}</div>
              <p class="gl-q-say" id="gl-q-say" role="status"></p></div></div></div>
          <div class="gl-panel" role="tabpanel" id="gl-p3" aria-labelledby="gl-t3" tabindex="0" hidden><div class="gl-split">
            <div class="gl-split-t"><h3>Keep your progress everywhere</h3><p>A free account with your montana.edu email keeps your classes, streak and answers on every device. We email a 6-digit code to confirm the address.</p></div>
            <form class="gl-join" id="gl-join"><label for="gl-email">Your montana.edu email</label><div class="gl-join-row"><input class="input" id="gl-email" type="email" autocomplete="email" placeholder="you@montana.edu" required><button type="submit" class="btn primary">Sign up free</button></div><p class="small muted">Already have an account? <button type="button" class="linkbtn" data-action="auth-login">Log in</button></p></form></div></div>
        </div>
      </section>
      <section class="mo-sec gl-practice" id="gl-features" data-section="practice" aria-labelledby="gl-pr-h">
        <div class="gl-practice-t" data-mo><h2 class="mo-h2" id="gl-pr-h">Practice first. The rest is one tap away.</h2><p>Every class you pick comes with three ways to practice: a quick quiz, five-minute lessons and flashcards. Notes, a plan and tools for that class are right beside them.</p><button type="button" class="linkbtn gl-go" data-action="go-pick">Try a free quiz</button></div>
        <div class="gl-stack" data-mo aria-label="Three ways to practice">${stack('back', 'cards', 'violet', 'Flashcards', 'Key terms and formulas, brought back right before you would forget them.')}${stack('mid', 'book', 'orange', 'Five-minute lessons', 'The idea in plain words, a picture, a worked example and two quick checks.')}${stack('front', 'list', 'blue', 'Quizzer', 'New questions for your class every time, each one solved step by step.', '<span class="gl-tag">Most used</span>')}</div>
        <div class="gl-cols">${col('Learn', ['Notes for every topic', 'Formula sheets', 'Exam checklists'])}${col('Plan', ['Calendar', 'Study planner', 'Daily challenge'])}${col('Tools', ['Grade and GPA calculators', 'Grapher', 'Discussions'])}</div>
        <p class="mo-more gl-more" data-mo>Want to read first? <a href="/learn/">Browse the free study guides</a>.</p>
      </section>
      <section class="mo-sec gl-bo" data-section="bo" aria-labelledby="gl-bo-h"><div class="gl-bo-card" data-mo>
        <div class="mascot-slot gl-bo-face" data-size="88" aria-hidden="true"></div>
        <div class="gl-bo-t"><h2 class="mo-h2" id="gl-bo-h">Stuck? Call Bo.</h2><p>Talk it through out loud, like with a tutor next to you. Bo listens, asks questions and works it out with you on a shared board. Prefer typing? Ask him anything.</p>
          <div class="hg-cta"><a class="btn primary" href="#/tutor">${icon('chat', 16)} Ask Bo</a><a class="hg-link" href="#/max">Try the one-minute demo</a></div></div></div></section>
      <section class="mo-sec gl-prof" id="gl-prof" data-section="prof" aria-labelledby="gl-prof-h"><div class="gl-prof-card">
        <div class="gl-prof-t" data-mo><span class="gl-eyebrow">For professors</span><h2 class="mo-h2" id="gl-prof-h">See how your class is doing, without extra grading.</h2><p>Write the syllabus once; StudyCat turns it into practice, dates and a class board, and you see what your students work on.</p><a class="btn gl-gold" href="#/teach">Start a syllabus</a></div>
        <div class="gl-feats">${feat('chart', 'Follow class progress', 'See which topics students practice and where they get stuck.')}${feat('file', 'Build the syllabus once', 'From the Montana State template: publish it and the class has its calendar, exam countdowns and grading.')}${feat('check', 'Attendance by code', 'Show a 4-digit code in the lecture; students type it on StudyCat to check in.')}</div></div></section>
      <section class="mo-sec mo-faq gl-faq" data-section="faq" aria-labelledby="mo-faq-h">
        <h2 class="mo-h2" id="mo-faq-h" data-mo>Questions</h2>
        <div class="gl-faq-grid" data-mo>
          ${q('Is StudyCat free?', 'Yes. Everything built into StudyCat is free, and you get 100 credits a month for Bo: ask him anything, call him, have him draw it. StudyCat Pro gives you 1,000 credits a month, and StudyCat Max 2,000 with his stronger voice model.')}
          ${q('Do I need an account?', 'No. Look around as much as you like. Sign up with a montana.edu email to keep your progress on every device.')}
          ${q('Who can join?', 'Only montana.edu addresses can join. We email a 6-digit code to confirm the address.')}
          ${q('Is StudyCat made by Montana State?', 'No. StudyCat is a free, independent study site made by a Montana State student. It is not affiliated with Montana State University; syllabus details come from each class and can change, so confirm dates on Canvas.')}
          ${q('My class is not on the list.', 'Make it from your syllabus: the class maker turns it into notes, practice and a calendar, in the same format as every other class.')}
          ${q('Which languages does it speak?', 'StudyCat is in English, Español, Русский, Français, Italiano, Português and Deutsch, and Bo speaks the language you pick.')}
        </div>
      </section>
      <section class="hg-hero mo-final gl-final" data-section="final" aria-labelledby="mo-end-h">
        <div class="hg-hero-in mo-final-card" data-mo><h2 class="hg-title" id="mo-end-h">Start with one class <em>today.</em></h2><p class="hg-sub">Pick it, take one quiz. That is the whole first step.</p>
          <div class="hg-cta"><button type="button" class="btn primary lg" data-action="go-pick">${icon('cap', 16)} Try a free quiz</button><button type="button" class="btn lg" data-action="mo-signup">Sign up free</button></div></div>${art.replace(' data-size="96"', ' data-size="80"')}
      </section>
    </div>`;
  };
  // the header while the landing is on screen: the page's sections, then the language, Log in and Sign up free
  S.top = on => { const tb = document.getElementById('topbar'); if (!tb) return; let h = tb.querySelector('.gl-head'); if (on && !h) { h = document.createElement('div'); h.className = 'gl-head'; h.innerHTML = S.topHtml(); tb.insertBefore(h, tb.querySelector('.topbar-title')); } else if (!on && h) h.remove(); };
  S.topHtml = () => `<a class="gl-brand" href="#/" aria-label="StudyCat, home">${App.logoSvg ? App.logoSvg(26) : ''}<b>StudyCat</b></a><nav class="gl-nav" aria-label="On this page"><button type="button" data-glgo="gl-how">How it works</button><button type="button" data-glgo="gl-features">Features</button><button type="button" data-glgo="gl-prof">For professors</button><a href="/learn/">Study guides</a></nav>`;

  // what the page's own buttons do (the hero's Pick your classes is bound by the start page with the rest)
  S.wire = function (root) {
    const page = $('.mo-page', root); if (!page) return;
    const tabs = $$('.gl-tab', page);
    const pick = (k, focus) => { tabs.forEach(t => { const on = t.dataset.gltab === String(k); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; const p = $('#' + t.getAttribute('aria-controls'), page); if (p) p.hidden = !on; if (on && focus) t.focus(); }); };
    page.addEventListener('click', e => {
      if (e.target.closest('[data-action="mo-signup"]') && App.auth && App.auth.open) App.auth.open('signup');
      // Pick your classes, anywhere on the page: the first step, its tab open (the start page then scrolls to the picker)
      if (e.target.closest('[data-action="go-pick"]')) pick(1);
      const tb = e.target.closest('[data-gltab]'); if (tb) { pick(tb.dataset.gltab, !tb.classList.contains('gl-tab')); if (!tb.classList.contains('gl-tab')) { const t = $(`#gl-t${tb.dataset.gltab}`, page); if (t) t.focus(); } }
      // the example question: right or wrong, and why
      const o = e.target.closest('[data-glq]');
      if (o) { const ok = o.dataset.glq === '1'; $$('.gl-opt', page).forEach(b => { b.classList.toggle('ok', b.dataset.glq === '1'); b.classList.toggle('no', b === o && !ok); b.setAttribute('aria-pressed', String(b === o)); });
        $('#gl-q-say', page).textContent = (ok ? 'Right. ' : 'Not quite: it is 1. ') + 'As x gets close to 0, sin x and x get close together, so their ratio goes to 1. The derivative of sin x is built on this limit.'; }
    });
    // the tabs by keyboard: arrows move between them, Home and End jump to the ends
    page.addEventListener('keydown', e => { const t = e.target.closest('.gl-tab'); if (!t) return; const i = tabs.indexOf(t); const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (k === undefined) return; e.preventDefault(); const n = (k + tabs.length) % tabs.length; pick(tabs[n].dataset.gltab, true); });
    const f = $('#gl-join', page); if (f) f.addEventListener('submit', e => { e.preventDefault(); if (App.auth && App.auth.open) App.auth.open('signup', $('#gl-email', f).value.trim()); });
    S.motion(page);
  };
  // the landing's header: its links scroll to the parts of the page (the page's address stays #/)
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-glgo]'); if (!b) return; const el = document.getElementById(b.dataset.glgo); if (!el) return; const tb = document.getElementById('topbar'); const y = el.getBoundingClientRect().top + global.scrollY - ((tb && tb.offsetHeight) || 0) - 12; global.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' }); const h = el.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } });

  /* ---------- motion ---------- */
  let ctx = null;   // the GSAP context of the page now on screen, reverted when it goes
  const done = new Map();   // a section (or the picker) → finishes its entrance at once
  const clear = () => { if (ctx) { try { ctx.revert(); } catch (e) {} ctx = null; } done.clear(); };
  S.clear = clear;   // the start page calls it before every render
  global.addEventListener('hashchange', clear);

  S.motion = function (page) {
    clear(); if (reduced()) return;
    const items = $$('[data-mo]', page); const trail = $('.mo-trail', page); const vh = global.innerHeight || 800;
    // already on screen: shown as they are (the hero has its own entrance); the rest waits below the fold
    const onScreen = el => el.getBoundingClientRect().top < vh * 0.9;
    items.concat(trail ? [trail] : []).forEach(el => { if (onScreen(el)) el.classList.add('mo-in'); });
    page.classList.add('mo-on');
    // a keyboard user who tabs into a part not yet in view sees it at once
    page.addEventListener('focusin', e => { const el = e.target.closest('[data-mo]'); if (el && !el.classList.contains('mo-now') && (!el.classList.contains('mo-in') || getComputedStyle(el).opacity < 1)) { el.classList.add('mo-now'); show(el); } const sec = e.target.closest('[data-section], #pick-classes'); if (sec && done.has(sec)) { done.get(sec)(); done.delete(sec); } });
    if (!wide()) return light(page, items, trail);
    App.gsapWithin(2500, true).then(g => { if (!page.isConnected) return; if (g && global.ScrollTrigger) choreograph(g, global.ScrollTrigger, page, items, trail); else light(page, items, trail); });
  };
  function show(el) { el.classList.add('mo-in'); if (global.gsap) global.gsap.set(el, { clearProps: 'opacity,transform' }); }

  // phones and the fallback: fades as each part comes into view, the trail draws, the numbers count once
  // (a scroll check rather than an IntersectionObserver: a jump past a part, by Tab or a link, still shows it)
  function light(page, items, trail) {
    page.classList.add('mo-io');
    let wait = items.concat(trail ? [trail] : []).filter(el => { if (!el.classList.contains('mo-in')) return true; $$('[data-count]', el).forEach(count); return false; });
    let ticking = false;
    const check = () => {
      ticking = false; if (!page.isConnected) { global.removeEventListener('scroll', onScroll); return; }
      const line = (global.innerHeight || 800) * 0.92;
      wait = wait.filter(el => { if (el.getBoundingClientRect().top >= line) return true;
        const sibs = el.parentElement ? [...el.parentElement.children].filter(x => x.hasAttribute('data-mo')) : []; el.style.setProperty('--k', Math.max(0, sibs.indexOf(el)));
        el.classList.add('mo-in'); $$('[data-count]', el).forEach(count); return false; });
      if (!wait.length) global.removeEventListener('scroll', onScroll);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
    global.addEventListener('scroll', onScroll, { passive: true }); check();
  }
  // COUNT without GSAP: from 0 to the number in about a second
  function count(el) {
    const to = +el.dataset.count; if (!to || el.dataset.counted) return; el.dataset.counted = '1';
    const t0 = performance.now(), dur = 1100; const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // wide screens: the full choreography (ORGANIC ODYSSEY timings: LIFT 0.7 s, cards 120 ms apart, lines 140 ms)
  function choreograph(gsap, ST, page, items, trail) {
    ctx = gsap.context(() => {
      const hero = $('.mo-hero', page);
      // the signature: three ridges at their own depths, the sun sinking and the clouds drifting as you leave the hero
      if (hero) {
        const sc = { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1.5 };
        // the ranges at their own depths and Bo rising as you leave the hero (the redesign's peaks: .hg-peaks)
        [['.mo-hero .hg-peaks .far', -12], ['.mo-hero .hg-peaks .near', -26], ['.mo-hero .hg-peaks .hill', -40]].forEach(([s, y]) => { if ($(s, page)) gsap.to(s, { y, ease: 'none', scrollTrigger: sc }); });
        if ($('.mo-hero .mo-bo', page)) gsap.to('.mo-hero .mo-bo', { y: -40, ease: 'none', scrollTrigger: sc });
      }
      // LIFT, per section: the heading first, then its parts one after another; the cards come in from alternate sides
      $$('[data-section]', page).forEach(sec => {
        const els = items.filter(el => el.closest('[data-section]') === sec && !el.classList.contains('mo-in')); if (!els.length) return;
        const cards = sec.classList.contains('mo-inside') ? els.filter(el => el.classList.contains('mo-card')) : [];
        const rest = els.filter(el => !cards.includes(el));
        const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 78%', once: true }, onComplete: () => els.forEach(show) });
        done.set(sec, () => { if (tl.scrollTrigger) tl.scrollTrigger.kill(); tl.progress(1); });
        if (rest.length) tl.fromTo(rest, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.14 });
        if (cards.length) cards.forEach((c, i) => tl.fromTo(c, { opacity: 0, x: i % 2 ? 30 : -30, y: 20 }, { opacity: 1, x: 0, y: 0, duration: 0.6, ease: 'power2.out' }, i ? '-=0.48' : '-=0.3'));
        els.forEach(el => el.classList.add('mo-in'));   // GSAP holds them hidden from here: the CSS state steps aside
      });
      // COUNT: each number climbs to its value once, as the numbers come into view
      $$('[data-count]', page).forEach(el => { const to = +el.dataset.count; if (!to) return; const o = { v: 0 };
        ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(Math.round(o.v)); } }) }); });
      // the trail draws itself as you scroll through the steps, and each step's number pops when it arrives
      if (trail) {
        const draw = $('.mo-draw', trail); trail.classList.add('mo-in');
        if (draw) gsap.fromTo(draw, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: trail, start: 'top 82%', end: 'bottom 45%', scrub: 1 } });
        $$('.mo-step-n', trail).forEach(n => gsap.from(n, { scale: 0.6, duration: 0.5, ease: 'back.out(2)', scrollTrigger: { trigger: n, start: 'top 80%', once: true } }));
      }
      // the class picker: its classes cascade in
      const tiles = $$('#pick-classes .pk-c', page);
      if (tiles.length && tiles[0].getBoundingClientRect().top > (global.innerHeight || 800) * 0.9) { const tw = gsap.from(tiles, { opacity: 0, y: 24, duration: 0.5, ease: 'power2.out', stagger: 0.04, clearProps: 'opacity,transform', scrollTrigger: { trigger: '#pick-classes', start: 'top 80%', once: true } }); done.set($('#pick-classes', page), () => { if (tw.scrollTrigger) tw.scrollTrigger.kill(); tw.progress(1); }); }
      // the end: the sun goes down behind the range while the card comes up; the buttons spring in (PULSE)
      const fin = $('.mo-final', page);
      if (fin) {
        [['.mo-final .hg-peaks .far', 16], ['.mo-final .hg-peaks .near', 30], ['.mo-final .hg-peaks .hill', 44]].forEach(([s, y]) => { if ($(s, page)) gsap.from(s, { y, ease: 'none', scrollTrigger: { trigger: fin, start: 'top bottom', end: 'bottom bottom', scrub: 1.5 } }); });
        if ($('.mo-final-card .btn', page)) gsap.from('.mo-final-card .btn', { scale: 0.88, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.08, clearProps: 'transform', scrollTrigger: { trigger: '.mo-final-card', start: 'top 80%', once: true } });
      }
      // questions ease open and shut (a native <details>: without this it simply opens)
      $$('.mo-faq details', page).forEach(d => {
        const sum = $('summary', d), body = $('.mo-a', d); if (!sum || !body) return;
        sum.addEventListener('click', e => {
          e.preventDefault(); gsap.killTweensOf(body);
          if (d.open) gsap.to(body, { height: 0, duration: 0.3, ease: 'power2.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height' }); } });
          else { d.open = true; const h = body.offsetHeight; gsap.fromTo(body, { height: 0 }, { height: h, duration: 0.4, ease: 'power2.out', onComplete: () => gsap.set(body, { clearProps: 'height' }) }); }
        });
      });
    }, page);
    // parts above change height after they are drawn (the announcement, the picker, fonts): keep the triggers in place
    let t = null; const ro = 'ResizeObserver' in global ? new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => ST.refresh(), 200); }) : null;
    if (ro) { ro.observe(page); ctx.add(() => () => ro.disconnect()); }
  }
})(window);
