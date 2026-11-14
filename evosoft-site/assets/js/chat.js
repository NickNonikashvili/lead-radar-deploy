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
  const KEY = 'evo-chat-v1';
  const ss = {
    get() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage off */ } },
  };
  let kb = null, ai = null, busy = false;
  let history = (ss.get() || {}).history || [];

  // ---------- safe Markdown (escape first, then a small allow-list) ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function href(url) {
    const u = url.trim();
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (u.startsWith('/')) return base + u.replace(/^\/+/, '');
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
      el.setAttribute('aria-label', 'The assistant is typing');
      el.innerHTML = '<span></span><span></span><span></span>';
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
    catch (e) { kb = { greeting: 'Hi! Ask me about EvoSoft.', suggestions: [], entries: [], fallback: 'Sorry, I can’t answer right now. Please email contact@evosoft.solutions.' }; }
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
    if (/ (best|top|recommend\w*|good|which) /.test(t) && / (develop\w*|compan\w*|agenc\w*|studio\w*|website\w*|web|software|apps?|projects?|programmer\w*|firm\w*|team\w*|devs?) /.test(t)) {
      const best = kb.entries.find((e) => e.id === 'best');
      if (best) return best.a;
    }
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
          body: JSON.stringify({ messages: history.slice(-12) }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.reply) reply = j.reply;
        else if (r.status === 429) reply = 'You’re sending messages quickly, so I’ll take a short break. Meanwhile, here’s what I can tell you:\n\n' + localAnswer(text);
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
  async function open() {
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
      const note = root.querySelector('.chat-note');
      if (note && !on) note.firstChild.textContent = 'Automatic answers from this website. For anything else, contact us directly. ';
    });
  }
  function close() {
    panel.hidden = true;
    document.body.classList.remove('chat-open');
    launch.setAttribute('aria-expanded', 'false');
    launch.focus();
  }
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; };

  launch.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-chat]');
    if (t) { e.preventDefault(); open(); if (t.dataset.openChat) send(t.dataset.openChat); }
  });
})();
