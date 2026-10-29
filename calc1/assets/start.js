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

  // the three ridges of the Bridger Range (the welcome's shapes) and the sky above them
  const RIDGES = ['M0 300 L0 170 L120 110 L240 160 L380 70 L520 150 L640 100 L800 170 L930 80 L1080 150 L1220 90 L1360 160 L1480 100 L1600 140 L1600 300Z',
    'M0 300 L0 200 L160 140 L300 200 L460 120 L600 190 L760 130 L900 210 L1050 140 L1200 200 L1340 130 L1480 190 L1600 150 L1600 300Z',
    'M0 300 L0 240 L140 200 L260 236 L420 190 L560 240 L700 206 L860 250 L1000 210 L1160 246 L1300 214 L1460 244 L1600 220 L1600 300Z'];
  const scene = (clouds = true) => `<div class="mo-scene" aria-hidden="true"><span class="mo-sun"></span>${clouds ? '<span class="mo-cloud c1"></span><span class="mo-cloud c2"></span><span class="mo-cloud c3"></span>' : ''}${RIDGES.map((d, i) => `<svg class="mo-ridge r${i + 1}" viewBox="0 0 1600 300" preserveAspectRatio="none" focusable="false"><path d="${d}"/></svg>`).join('')}</div>`;
  const TRAIL = 'M40 40 C 200 4, 300 60, 500 34 S 800 6, 960 40';
  const fmt = n => { try { return Number(n).toLocaleString(document.documentElement.lang || 'en'); } catch (e) { return String(n); } };

  /* ---------- the page ---------- */
  // ctx: { when (the date line), picker (the class picker's HTML) }
  S.html = function (ctx) {
    const n = S.numbers(); const anim = !reduced();
    const num = v => `<b class="mo-num" data-count="${v}">${fmt(v)}</b>`;
    const card = (ic, h, p, extra = '') => `<article class="mo-card" data-mo><span class="mo-ic" aria-hidden="true">${icon(ic, 22)}</span><h3>${h}</h3><p>${p}</p>${extra}</article>`;
    const q = (h, a) => `<details><summary>${h}</summary><div class="mo-a"><p>${a}</p></div></details>`;
    return `<div class="landing-wrap mo-page${anim ? ' mo-anim' : ''}" data-mo-page>
      <header class="landing-top hero mo-hero" data-section="hero">
        <div class="mo-hero-copy">
          <p class="hero-when">${esc(ctx.when)}</p>
          <h1 class="landing-title mo-h1"><span class="mo-line" style="--i:0"><span>Every class you take,</span></span><span class="mo-line mo-accent" style="--i:1"><span>made simple.</span></span></h1>
          <p class="mo-sub">What is on the next exam, five-minute lessons and a tutor you can call. Free with a montana.edu email.</p>
          <div class="row gap-sm hero-actions"><button type="button" class="btn primary hero-today hero-pick" data-action="go-pick">${icon('cap', 16)} Pick your classes</button><a class="btn hero-faculty" href="#/teach" title="StudyCat Faculty: write your syllabus and run your class">${icon('file', 16)} For professors</a></div>
          <p class="small mo-note">No account needed to look around.</p>
        </div>
        ${scene()}
        <div class="mascot-slot hero-mascot mo-bo" data-size="104"></div><div class="px-skyline" aria-hidden="true"></div>
      </header>
      <div id="announcement-slot"></div>${ctx.banners || ''}
      <section class="mo-stats" data-section="stats" aria-label="StudyCat in numbers"><div class="mo-stat" data-mo>${num(n.classes)}<span>Montana State classes</span></div><div class="mo-stat" data-mo>${num(n.topics)}<span>topics with notes</span></div><div class="mo-stat" data-mo>${num(n.cards)}<span>flashcards to review</span></div><div class="mo-stat" data-mo>${num(n.langs)}<span>languages to choose from</span></div></section>
      <section class="mo-sec mo-how" data-section="how" aria-labelledby="mo-how-h">
        <h2 class="mo-h2" id="mo-how-h" data-mo>Three steps. The first takes a minute.</h2>
        <div class="mo-trail"><svg class="mo-trail-path" viewBox="0 0 1000 64" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><mask id="mo-trail-mask" maskUnits="userSpaceOnUse" x="0" y="-20" width="1000" height="110"><path class="mo-draw" d="${TRAIL}" pathLength="1"/></mask></defs><path class="mo-dots" d="${TRAIL}" mask="url(#mo-trail-mask)"/></svg>
          <ol class="mo-steps">
            <li class="mo-step" data-mo><span class="mo-step-n" aria-hidden="true">1</span><b>Pick your classes</b><small>StudyCat shows only your classes: their notes, practice, dates and Bo.</small></li>
            <li class="mo-step" data-mo><span class="mo-step-n" aria-hidden="true">2</span><b>Take a five-minute lesson</b><small>A few questions with worked answers. No setup.</small></li>
            <li class="mo-step" data-mo><span class="mo-step-n" aria-hidden="true">3</span><b>Sign up to keep it</b><small>A free montana.edu account saves your progress everywhere.</small></li>
          </ol></div>
      </section>
      ${ctx.picker}
      <section class="mo-sec mo-inside" data-section="inside" aria-labelledby="mo-in-h">
        <h2 class="mo-h2" id="mo-in-h" data-mo>Everything a class needs, in one place</h2>
        <div class="mo-cards">
          ${card('book', 'A lesson for every topic', 'The idea in plain words, a picture, a worked example and two quick checks.')}
          ${card('target', 'Practice that keeps going', 'The Quizzer builds new questions for your class and shows how each one is solved.')}
          ${card('chat', 'Bo, your tutor', 'Ask him anything, or call him and work it out together on a shared board.', '<a href="#/max">Try the one-minute demo</a>')}
          ${card('calendar', 'Every deadline', 'Exams, homework and labs from each syllabus, in one calendar.')}
          ${card('calc', 'Tools for each class', 'Grade calculators, graphers, simulators and more, picked for the class.')}
          ${card('sun', 'Your day, planned', 'Today puts the next thing to do first, so you always know where to start.')}
        </div>
        <p class="mo-more" data-mo>Want to read first? <a href="/learn/">Browse the free study guides</a>.</p>
      </section>
      <section class="mo-sec mo-faq" data-section="faq" aria-labelledby="mo-faq-h">
        <h2 class="mo-h2" id="mo-faq-h" data-mo>Questions</h2>
        <div data-mo>
          ${q('Is StudyCat free?', 'Yes. Everything built into StudyCat is free, and you get 100 credits a month for Bo: ask him anything, call him, have him draw it. StudyCat Pro gives you 1,000 credits a month, and StudyCat Max 2,000 with his stronger voice model on calls.')}
          ${q('Do I need an account?', 'No. Look around as much as you like. Sign up with a montana.edu email to keep your progress on every device.')}
          ${q('Who can join?', 'Only montana.edu addresses can join. We email a 6-digit code to confirm the address.')}
          ${q('Is StudyCat made by Montana State?', 'No. StudyCat is a free, independent study site made by a Montana State student. It is not affiliated with Montana State University; syllabus details come from each class and can change, so confirm dates on Canvas.')}
          ${q('My class is not on the list.', 'Make it from your syllabus: the class maker turns it into notes, practice and a calendar, in the same format as every other class.')}
          ${q('Which languages does it speak?', 'StudyCat is in English, Español, Русский, Français, Italiano, Português and Deutsch, and Bo speaks the language you pick.')}
        </div>
      </section>
      <section class="mo-final" data-section="final" aria-labelledby="mo-end-h">
        ${scene(false)}
        <div class="mo-final-card" data-mo><h2 class="mo-h2" id="mo-end-h">Start with one class today.</h2><p>Pick it, read one lesson, try one question. That is the whole first step.</p>
          <div class="row gap-sm"><button type="button" class="btn primary" data-action="go-pick">${icon('cap', 16)} Pick your classes</button><button type="button" class="btn" data-action="mo-signup">Sign up free</button></div></div>
      </section>
    </div>`;
  };

  // what the page's own buttons do (the hero's Pick your classes is bound by the start page with the rest)
  S.wire = function (root) {
    const page = $('.mo-page', root); if (!page) return;
    page.addEventListener('click', e => { if (e.target.closest('[data-action="mo-signup"]') && App.auth && App.auth.open) App.auth.open('signup'); });
    S.motion(page);
  };

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
        [['.mo-hero .mo-ridge.r1', -18], ['.mo-hero .mo-ridge.r2', -40], ['.mo-hero .mo-ridge.r3', -70]].forEach(([s, y]) => gsap.to(s, { y, ease: 'none', scrollTrigger: sc }));
        gsap.to('.mo-hero .mo-sun', { y: 70, ease: 'none', scrollTrigger: sc });
        gsap.to('.mo-hero .mo-cloud', { xPercent: -30, ease: 'none', scrollTrigger: sc });
        gsap.to('.mo-hero .mo-bo', { y: -70, ease: 'none', scrollTrigger: sc });
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
        gsap.fromTo('.mo-final .mo-sun', { y: -40 }, { y: 70, ease: 'none', scrollTrigger: { trigger: fin, start: 'top 90%', end: 'bottom 70%', scrub: 1.2 } });
        [['.mo-final .mo-ridge.r1', 20], ['.mo-final .mo-ridge.r2', 40], ['.mo-final .mo-ridge.r3', 60]].forEach(([s, y]) => gsap.from(s, { y, ease: 'none', scrollTrigger: { trigger: fin, start: 'top bottom', end: 'bottom bottom', scrub: 1.5 } }));
        gsap.from('.mo-final-card .btn', { scale: 0.88, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.08, clearProps: 'transform', scrollTrigger: { trigger: '.mo-final-card', start: 'top 80%', once: true } });
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
