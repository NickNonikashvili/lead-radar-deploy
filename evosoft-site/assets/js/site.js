/* EvoSoft website behaviour. © 2026 EvoSoft Solutions. All rights reserved.
   No dependencies. Without JavaScript every link still works and nothing is hidden. */
(() => {
  'use strict';
  const doc = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

  // Words in the page's language (written by the site builder).
  const S = Object.assign({
    lang: 'en', copy: 'copy', copied: 'copied',
    copyFail: 'Couldn’t copy automatically. Select the text and copy it instead.',
    copiedLogin: 'Copied {login}. Password: {password}', signInWith: 'Sign in with {login}. Password: {password}',
    live: 'Live', offline: 'Offline right now',
    formMissing: 'Please add your name, your email and a few words about the project.',
    formEmail: 'Please check your email address.',
    formRate: 'That’s a lot of requests in a short time. Please try again in a few minutes, or email us.',
    formFail: 'Sorry, your request couldn’t be sent just now. Please try again in a minute, or email us at {email}.',
    sending: 'Sending…',
  }, (() => { try { return JSON.parse($('#evo-i18n').textContent); } catch (e) { return {}; } })());
  window.EVO_I18N = S;

  const motion = doc.classList.contains('motion') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* theme */
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  $$('.theme-toggle').forEach((b) => b.addEventListener('click', () => {
    const now = doc.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
    const next = now === 'dark' ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    store.set('evo-theme', next);
  }));

  /* header: shadow and reading progress */
  const header = $('.topbar');
  const bar = $('.progress');
  let scrollRaf = 0;
  const onScroll = () => {
    scrollRaf = 0;
    const y = window.scrollY;
    if (header) header.classList.toggle('scrolled', y > 4);
    if (bar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
    }
    if (motion) tiltShots();
  };
  window.addEventListener('scroll', () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(onScroll); }, { passive: true });
  window.addEventListener('resize', () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(onScroll); });

  /* mobile menu */
  const menuBtn = $('.menu-toggle');
  const setMenu = (open) => {
    document.body.classList.toggle('nav-open', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? (S.close || 'Close menu') : (menuBtn.dataset.open || menuBtn.getAttribute('aria-label')));
    }
  };
  if (menuBtn) {
    menuBtn.dataset.open = menuBtn.getAttribute('aria-label');
    menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('nav-open')));
    $$('#site-nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  }

  /* language menu */
  const langBtn = $('.lang-btn');
  const langMenu = $('#lang-menu');
  const setLang = (open) => {
    if (!langBtn || !langMenu) return;
    langMenu.hidden = !open;
    langBtn.setAttribute('aria-expanded', String(open));
    if (open) { const cur = $('[aria-current]', langMenu) || $('a', langMenu); if (cur) cur.focus(); }
  };
  if (langBtn && langMenu) {
    langBtn.addEventListener('click', (e) => { e.stopPropagation(); setLang(langMenu.hidden); });
    document.addEventListener('click', (e) => { if (!langMenu.hidden && !e.target.closest('.lang')) setLang(false); });
    langMenu.addEventListener('keydown', (e) => {
      const items = $$('a', langMenu);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    setMenu(false);
    if (langMenu && !langMenu.hidden) { setLang(false); langBtn.focus(); }
  });
  // Remember a language someone picks, so we never suggest another one.
  document.addEventListener('click', (e) => { const a = e.target.closest('a[data-lang]'); if (a) store.set('evo-lang', a.dataset.lang); });

  /* English pages: offer the visitor's own language once, in that language */
  const hint = $('.lang-hint');
  if (hint && S.suggest && !store.get('evo-lang')) {
    let pick = null;
    for (const l of navigator.languages || [navigator.language || '']) {
      const code = String(l).slice(0, 2).toLowerCase();
      if (code === 'en') break;
      if (S.suggest[code]) { pick = code; break; }
    }
    const alt = pick && $(`link[rel="alternate"][hreflang="${pick}"]`);
    if (alt) {
      const s = S.suggest[pick];
      $('p', hint).textContent = s.text;
      hint.setAttribute('lang', pick);
      const go = $('a', hint);
      go.textContent = s.go;
      go.href = alt.href;
      go.addEventListener('click', () => store.set('evo-lang', pick));
      const no = $('button', hint);
      no.textContent = s.no;
      no.addEventListener('click', () => { store.set('evo-lang', 'en'); hint.hidden = true; });
      setTimeout(() => { hint.hidden = false; }, 1200);
    }
  }

  /* toast */
  const toastEl = $('.toast');
  let toastTimer;
  function toast(html, ms = 3200) {
    if (!toastEl) return;
    toastEl.innerHTML = html;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }
  window.evoToast = toast;

  /* copy */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall through */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy');
    if (!btn) return;
    const ok = await copyText(btn.dataset.copy);
    if (ok) {
      btn.classList.add('done');
      setTimeout(() => btn.classList.remove('done'), 1600);
    } else {
      toast(esc(S.copyFail));
    }
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.acc-go');
    if (!a) return;
    copyText(a.dataset.login).then((ok) => toast(fill(esc(ok ? S.copiedLogin : S.signInWith), { login: `<code>${esc(a.dataset.login)}</code>`, password: `<code>${esc(a.dataset.pass)}</code>` }), 6000));
  });

  /* live demo status */
  const cache = new Map();
  function ping(url) {
    if (cache.has(url)) return cache.get(url);
    const p = new Promise((resolve) => {
      const ctrl = 'AbortController' in window ? new AbortController() : null;
      const t = setTimeout(() => { if (ctrl) ctrl.abort(); resolve(false); }, 8000);
      fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
        .then(() => { clearTimeout(t); resolve(true); })
        .catch(() => { clearTimeout(t); resolve(false); });
    });
    cache.set(url, p);
    return p;
  }
  $$('[data-status-url]').forEach((el) => ping(el.dataset.statusUrl).then((up) => {
    el.dataset.state = up ? 'online' : 'offline';
    const label = $('span', el);
    if (label) label.textContent = up ? S.live : S.offline;
  }));

  /* tabs (the live-demo card on the home page); it turns its own pages until someone takes over */
  $$('[data-tabs]').forEach((box) => {
    const tabs = $$('[role="tab"]', box);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    const stop = () => box.classList.remove('autoplay', 'paused');
    tabs.forEach((t, i) => {
      t.addEventListener('click', (e) => { if (e.isTrusted) stop(); select(t); });
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        stop();
        select(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true);
      });
    });
    if (!motion || !box.hasAttribute('data-autoplay') || tabs.length < 2) return;
    // decode every page's picture up front, so a page never turns to an empty frame
    $$('img', box).forEach((im) => { if (im.decode) im.decode().catch(() => {}); });
    box.classList.add('autoplay');
    box.addEventListener('animationend', (e) => {
      if (!e.target.classList.contains('dc-progress') || !box.classList.contains('autoplay')) return;
      const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      select(tabs[(i + 1) % tabs.length]);
    });
    const hold = new Set();
    const sync = () => box.classList.toggle('paused', hold.size > 0);
    box.addEventListener('pointerenter', () => { hold.add('hover'); sync(); });
    box.addEventListener('pointerleave', () => { hold.delete('hover'); sync(); });
    box.addEventListener('focusin', () => { hold.add('focus'); sync(); });
    box.addEventListener('focusout', () => { hold.delete('focus'); sync(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) hold.add('hidden'); else hold.delete('hidden'); sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { if (en.isIntersecting) hold.delete('away'); else hold.add('away'); sync(); }).observe(box);
    }
  });

  /* lightbox */
  const lb = $('.lightbox');
  const shots = $$('[data-lightbox]');
  if (lb && shots.length && typeof lb.showModal === 'function') {
    const img = $('img', lb), cap = $('figcaption', lb);
    let idx = 0;
    const show = (i) => {
      idx = (i + shots.length) % shots.length;
      img.src = shots[idx].dataset.lightbox;
      img.alt = shots[idx].dataset.caption || '';
      cap.textContent = shots[idx].dataset.caption || '';
    };
    shots.forEach((s, i) => s.addEventListener('click', () => { show(i); lb.showModal(); }));
    $('.lb-close', lb).addEventListener('click', () => lb.close());
    $('.lb-prev', lb).addEventListener('click', () => show(idx - 1));
    $('.lb-next', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close(); });
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(idx + 1); if (e.key === 'ArrowLeft') show(idx - 1); });
    if (shots.length < 2) $$('.lb-prev, .lb-next', lb).forEach((b) => (b.hidden = true));
  }

  /* client thumbnails: show the name if the preview service fails */
  $$('.client-shot img').forEach((im) => {
    const hide = () => { im.style.visibility = 'hidden'; };
    im.addEventListener('error', hide);
    if (im.complete && im.naturalWidth === 0) hide();
  });

  /* quote form: sends to api/quote.php, which emails the team. It never opens the visitor's email app. */
  const form = $('#quote');
  if (form) {
    const err = $('.form-error', form);
    const done = $('.form-done', form);
    const btn = $('button[type="submit"]', form);
    const label = $('.btn-label', btn) || btn;
    const idle = label.textContent;
    const email = form.dataset.email;
    const pre = new URLSearchParams(location.search).get('need');
    if (pre) $$('input[name="types"]', form).forEach((c) => { if (c.value === pre) c.checked = true; });
    const values = () => {
      const f = form.elements;
      return {
        name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), company: f.company.value.trim(),
        types: $$('input[name="types"]:checked', form).map((c) => c.value), timeline: f.timeline.value,
        message: f.message.value.trim(), website: f.website.value, lang: S.lang,
      };
    };
    const showError = (html) => { err.innerHTML = html; err.hidden = false; };
    const busy = (on) => { btn.disabled = on; label.textContent = on ? S.sending : idle; form.classList.toggle('sending', on); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = values();
      const bad = [];
      if (!v.name) bad.push('name');
      if (!/^\S+@\S+\.\S+$/.test(v.email)) bad.push('email');
      if (v.message.length < 10) bad.push('message');
      ['name', 'email', 'message'].forEach((n) => form.elements[n].setAttribute('aria-invalid', String(bad.includes(n))));
      if (bad.length) {
        showError(esc(bad.includes('email') && v.email ? S.formEmail : S.formMissing));
        form.elements[bad[0]].focus();
        return;
      }
      err.hidden = true;
      busy(true);
      let res = null, data = {};
      try {
        res = await fetch(form.getAttribute('action'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(v) });
        data = await res.json().catch(() => ({}));
      } catch (ex) { res = null; }
      busy(false);
      if (res && res.ok && data.ok) {
        $$('.row2, .field, .form-foot, .hp', form).forEach((el) => (el.hidden = true));
        done.hidden = false;
        done.setAttribute('tabindex', '-1');
        done.focus();
        return;
      }
      if (res && res.status === 422 && data.fields) {
        Object.keys(data.fields).forEach((n) => { if (form.elements[n]) form.elements[n].setAttribute('aria-invalid', 'true'); });
        showError(esc(data.fields.email ? S.formEmail : S.formMissing));
        return;
      }
      if (res && res.status === 429) { showError(esc(S.formRate)); return; }
      showError(fill(esc(S.formFail), { email: `<a href="mailto:${esc(email)}">${esc(email)}</a>` }));
    });
  }

  if (!motion) { onScroll(); return; }

  /* ===================== motion (skipped entirely when the visitor prefers less motion) ===================== */

  /* reveal on scroll: only things below the fold, so nothing on screen blinks */
  const REVEAL = ['.sec-head', '.tiles > *', '.svc-grid > *', '.svc-detail > *', '.trail > li', '.clients > *', '.faq > details', '.cta-card', '.work-list > *', '.feat-grid > *', '.gallery > *', '.phones-card', '.next-card', '.about-grid > *', '.legal > *', '.quote-grid > *', '.stats > *', '.marquee', '.accts > *', '.notes > *', '.db-facts > *', '.db-head', '.more'];
  const ZOOM = new Set(['.gallery > *', '.cta-card', '.phones-card']);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        el.classList.add('in');
        const clean = (ev) => { if (ev.target !== el || ev.propertyName !== 'opacity') return; el.classList.remove('rv', 'in', 'rv-zoom'); el.style.removeProperty('--i'); el.removeEventListener('transitionend', clean); };
        el.addEventListener('transitionend', clean);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    const fold = window.innerHeight * 0.95;
    REVEAL.forEach((sel) => {
      $$(sel).forEach((el) => {
        if (el.classList.contains('rv') || el.getBoundingClientRect().top < fold) return;
        const sibs = el.parentElement ? Array.from(el.parentElement.children) : [el];
        el.style.setProperty('--i', String(Math.min(sibs.indexOf(el), 8) % 9));
        el.classList.add('rv');
        if (ZOOM.has(sel)) el.classList.add('rv-zoom');
        io.observe(el);
      });
    });

    /* numbers count up when they come into view */
    const countIo = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        countIo.unobserve(en.target);
        const el = en.target;
        const end = Number(el.dataset.count);
        const t0 = performance.now();
        const dur = 900 + Math.min(end, 20) * 40;
        const step = (now) => {
          const k = Math.max(0, Math.min(1, (now - t0) / dur));
          el.textContent = String(Math.round(end * (1 - Math.pow(1 - k, 3))));
          if (k < 1) requestAnimationFrame(step);
        };
        el.textContent = '0';
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach((el) => countIo.observe(el));

    /* the process line draws itself */
    const trailIo = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('drawn'); trailIo.unobserve(en.target); } }), { threshold: 0.35 });
    $$('.trail').forEach((el) => trailIo.observe(el));
  }

  /* "We build …" types out what we build */
  const word = $('.typer-word');
  if (word) {
    let words = [];
    try { words = JSON.parse(word.dataset.words || '[]'); } catch (e) { words = []; }
    if (words.length > 1) {
      let wi = 0, ci = Array.from(words[0]).length, deleting = false;
      const tick = () => {
        const chars = Array.from(words[wi]);
        if (document.hidden) { setTimeout(tick, 500); return; }
        if (!deleting && ci >= chars.length) { deleting = true; setTimeout(tick, 1700); return; }
        if (deleting && ci <= 0) { deleting = false; wi = (wi + 1) % words.length; setTimeout(tick, 260); return; }
        ci += deleting ? -1 : 1;
        word.textContent = Array.from(words[wi]).slice(0, ci).join('');
        setTimeout(tick, deleting ? 32 : 62 + Math.random() * 40);
      };
      setTimeout(tick, 2200);
    }
  }

  /* the home page: the burgundy mark behind the slogan drifts a little against the pointer */
  const mono = $('.monolith');
  if (mono && finePointer) {
    window.addEventListener('pointermove', (e) => {
      mono.style.setProperty('--px', `${((e.clientX / innerWidth) - 0.5) * -28}px`);
      mono.style.setProperty('--py', `${((e.clientY / innerHeight) - 0.5) * -18}px`);
    }, { passive: true });
  }

  /* cards: a soft light follows the pointer; product tiles and the demo card tilt a little */
  if (finePointer) {
    $$('.svc, .feat, .acct, .stat, .trail li, .note, .tile, .client, .p-side, .quote-side .card, .faq details').forEach((el) => el.classList.add('spot'));
    let spotRaf = 0, last = null;
    document.addEventListener('pointermove', (e) => {
      last = e;
      if (spotRaf) return;
      spotRaf = requestAnimationFrame(() => {
        spotRaf = 0;
        const el = last.target.closest && last.target.closest('.spot');
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${last.clientX - r.left}px`);
        el.style.setProperty('--my', `${last.clientY - r.top}px`);
      });
    }, { passive: true });
    $$('.tile:not(.tile-new), .stage .demo-card').forEach((el) => {
      const max = el.classList.contains('demo-card') ? 4 : 7;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add('tilt');
        el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* product pages: the big screenshot starts tilted back and lies flat as you scroll */
  const heroShots = $$('.hero-shot');
  function tiltShots() {
    const vh = window.innerHeight;
    heroShots.forEach((el) => {
      const top = el.getBoundingClientRect().top;
      const rx = Math.max(0, Math.min(12, ((top - vh * 0.18) / vh) * 22));
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    });
  }
  onScroll();
})();
