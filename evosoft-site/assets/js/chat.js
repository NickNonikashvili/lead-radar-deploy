/* EvoSoft website chat assistant. © 2026 EvoSoft Solutions. All rights reserved.
   Uses api/chat.php (Claude) when it is configured; otherwise, or if it fails, answers from
   assets/data/chat-kb.json, which site-builder/build.mjs generates from the site's own content. */
(() => {
  'use strict';
  const root = document.querySelector('.chat');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const launch = $('.chat-launch'), panel = $('.chat-panel'), log = $('.chat-log'), form = $('.chat-form');
  const input = $('#chat-input'), suggest = $('.chat-suggest'), closeBtn = $('.chat-close');
  const endpoint = root.dataset.endpoint, kbUrl = root.dataset.kb, base = root.dataset.root || '';
  const KEY = `evo-chat-v2-${document.documentElement.lang || 'en'}`;
  const S = window.EVO_I18N || (() => { try { return JSON.parse(document.getElementById('evo-i18n').textContent); } catch (e) { return {}; } })();
  const say = (k, fallback) => S[k] || fallback;
  const ss = {
    get() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage off */ } },
  };
  let kb = null, ai = null, busy = false;
  let history = (ss.get() || {}).history || [];

  // ---------- safe Markdown (escape first, then a small allow-list) ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function href(url) {
    let u = url.trim();
    // a full link to this site counts as a site page, so it opens in the visitor's language like the short ones
    const own = u.match(/^https?:\/\/(?:www\.)?evosoft\.solutions(\/[^\s]*)?$/i);
    if (own) u = own[1] || '/';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (u.startsWith('/')) u = '/' + u.replace(/^\/(?:ka|ru|es)(?=\/|$|[?#])/, '').replace(/^\/+/, '');
    // site pages: /contact -> contact in this language (an older /contact.html or /index.html still works)
    if (u.startsWith('/')) return base + u.replace(/^\/+/, '').replace(/(^|\/)index\.html(?=$|[?#])/, '$1home').replace(/\.html(?=$|[?#])/, '').replace(/^(?=$|[?#])/, 'home');
    if (u.startsWith('#')) return u;
    return null;
  }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
        const h = href(url.replace(/&amp;/g, '&'));
        if (!h) return text;
        const ext = /^https?:/i.test(h) && !h.includes(location.host);
        return `<a href="${esc(h)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
      });
  }
  function md(text) {
    const out = [];
    let list = null;
    const flush = () => { if (list) { out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`); list = null; } };
    let para = [];
    const flushP = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
    for (const raw of String(text).split('\n')) {
      const line = raw.trimEnd();
      const ul = line.match(/^\s*[-*•]\s+(.*)$/), ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        flushP();
        const type = ul ? 'ul' : 'ol';
        if (!list || list.type !== type) { flush(); list = { type, items: [] }; }
        list.items.push((ul || ol)[1]);
      } else if (!line.trim()) { flushP(); flush(); }
      else { flush(); para.push(line.replace(/^#+\s*/, '')); }
    }
    flushP(); flush();
    return out.join('');
  }

  // ---------- rendering ----------
  function add(role, text, { save = true } = {}) {
    const el = document.createElement('div');
    el.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
    if (role === 'user') el.textContent = text; else el.innerHTML = md(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    if (save) { history.push({ role: role === 'user' ? 'user' : 'assistant', content: text }); ss.set({ history: history.slice(-30) }); }
  }
  function typing(on) {
    let el = log.querySelector('.typing');
    if (on && !el) {
      el = document.createElement('div');
      el.className = 'msg bot typing';
      el.innerHTML = '<span class="sr-only">' + esc(say('chatTyping', 'The assistant is typing')) + '</span><span></span><span></span><span></span>';
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    } else if (!on && el) el.remove();
  }
  function showSuggestions() {
    suggest.innerHTML = '';
    if (!kb || history.some((m) => m.role === 'user')) return;
    kb.suggestions.forEach((q) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', () => send(q));
      suggest.appendChild(b);
    });
  }

  // ---------- answers ----------
  async function loadKb() {
    if (kb) return kb;
    try { kb = await (await fetch(kbUrl, { cache: 'force-cache' })).json(); }
    catch (e) { kb = { greeting: 'EvoSoft', suggestions: [], entries: [], fallback: say('chatError', 'Sorry, I can’t answer right now. Please email {email}.').replace('{email}', 'contact@evosoft.solutions') }; }
    return kb;
  }
  async function aiReady() {
    if (ai !== null) return ai;
    const cached = (() => { try { return sessionStorage.getItem('evo-chat-ai'); } catch (e) { return null; } })();
    if (cached !== null) return (ai = cached === '1');
    try {
      const r = await fetch(`${endpoint}?health=1`, { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      ai = !!(j && j.ai);
    } catch (e) { ai = false; }
    try { sessionStorage.setItem('evo-chat-ai', ai ? '1' : '0'); } catch (e) { /* ignore */ }
    return ai;
  }
  const norm = (s) => ` ${String(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}@.+]+/gu, ' ').trim()} `;
  function hit(t, k) {
    k = k.toLowerCase();
    if (k.includes(' ')) return t.includes(` ${k}`);
    return k.length >= 4 ? t.includes(` ${k}`) : t.includes(` ${k} `);
  }
  function localAnswer(q) {
    const t = norm(q);
    let pick = null, score = 0;
    for (const e of kb.entries) {
      if (!e.k) continue;
      if (e.need && !e.need.every((n) => t.includes(` ${n} `))) continue;
      if (e.needAny && !e.needAny.some((n) => hit(t, n))) continue;
      let s = 0;
      for (const k of e.k) if (hit(t, k)) s += k.split(' ').length;
      if (!s) continue;
      if (e.need) s += 1.5;
      s *= e.w || 1;
      if (/^(hello|thanks)$/.test(e.id)) s *= 0.6;
      if (e.id === 'about') s *= 0.8;
      if (s > score) { score = s; pick = e; }
    }
    return pick ? pick.a : kb.fallback;
  }

  async function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true;
    form.querySelector('button').disabled = true;
    suggest.innerHTML = '';
    add('user', text);
    input.value = '';
    grow();
    typing(true);
    let reply = null;
    if (await aiReady()) {
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history.slice(-12), lang: document.documentElement.lang || 'en' }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.reply) reply = j.reply;
        else if (r.status === 429) reply = say('chatRate', 'You’re sending messages quickly, so I’ll take a short break. Meanwhile, here’s what I can tell you:') + '\n\n' + localAnswer(text);
        else if (j.error === 'not_configured') ai = false;
      } catch (e) { /* use the built-in answers */ }
    }
    if (!reply) {
      await new Promise((r) => setTimeout(r, 350));
      reply = localAnswer(text);
    }
    typing(false);
    add('assistant', reply);
    busy = false;
    form.querySelector('button').disabled = false;
    input.focus();
  }

  // ---------- open / close ----------
  // On a phone the panel covers the whole page, so the page behind it is taken out of reach until it closes; on a
  // wider screen it's a side panel and the page stays usable.
  const behind = () => document.querySelectorAll('.skip, .topbar, main, .footer');
  const setInert = (on) => behind().forEach((el) => { el.inert = on; });
  async function open() {
    const full = window.matchMedia('(max-width: 560px)').matches;
    panel.setAttribute('aria-modal', String(full));
    if (full) setInert(true);
    panel.hidden = false;
    document.body.classList.add('chat-open');
    launch.setAttribute('aria-expanded', 'true');
    await loadKb();
    if (!log.childElementCount) {
      add('assistant', kb.greeting, { save: false });
      history.forEach((m) => add(m.role === 'user' ? 'user' : 'assistant', m.content, { save: false }));
    }
    showSuggestions();
    input.focus();
    aiReady().then((on) => {
      const note = root.querySelector('.chat-note span');
      if (note && !on) note.textContent = say('chatNoAi', 'Automatic answers from this website. For anything else, contact us directly.');
    });
  }
  function close() {
    setInert(false);
    panel.setAttribute('aria-modal', 'false');
    panel.hidden = true;
    document.body.classList.remove('chat-open');
    launch.setAttribute('aria-expanded', 'false');
    launch.focus();
  }
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; };

  // A one-time hello bubble next to the button, a little while after the page settles.
  const teaser = root.querySelector('.chat-teaser');
  const seen = () => { try { return sessionStorage.getItem('evo-chat-teaser'); } catch (e) { return '1'; } };
  const markSeen = () => { try { sessionStorage.setItem('evo-chat-teaser', '1'); } catch (e) { /* ignore */ } };
  if (teaser && S.teaser && !seen() && !history.length) {
    teaser.querySelector('p').textContent = S.teaser;
    // never on top of the home hero's buttons: it shows only while the hero is off screen, and steps away again
    // whenever the visitor scrolls back up to it, until it is closed or the chat is opened
    let done = false, due = false, heroIn = false;
    const sync = () => {
      const want = due && !done && !heroIn && panel.hidden && !document.querySelector('.lang-hint:not([hidden])');
      if (want && teaser.hidden) markSeen();
      teaser.hidden = !want;
    };
    const hero = document.querySelector('.hero');
    if (hero && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => { heroIn = e.isIntersecting; sync(); }).observe(hero);
    setTimeout(() => { due = true; sync(); }, 9000);
    teaser.addEventListener('click', (e) => { done = true; teaser.hidden = true; markSeen(); if (!e.target.closest('.chat-teaser-close')) open(); });
    launch.addEventListener('click', () => { done = true; });
    // keyboard users: once focus moves anywhere else on the page, the bubble goes, so it never covers what has focus
    document.addEventListener('focusin', (e) => {
      if (root.contains(e.target) || teaser.hidden) return;
      let kb = true;
      try { kb = e.target.matches(':focus-visible'); } catch (x) { /* older browsers: treat as keyboard */ }
      if (kb) { done = true; teaser.hidden = true; }
    });
  }

  launch.addEventListener('click', () => { if (teaser) teaser.hidden = true; open(); });
  closeBtn.addEventListener('click', close);
  // Escape closes the panel wherever focus is (but leaves an open screenshot viewer to close first)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) close(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-chat]');
    if (t) { e.preventDefault(); open(); if (t.dataset.openChat) send(t.dataset.openChat); }
  });
})();
