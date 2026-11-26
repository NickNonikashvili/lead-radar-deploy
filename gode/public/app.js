/* Gode web app: plain browser JavaScript on the vendored React 18 UMD build (window.React,
 * window.ReactDOM). No build step.
 *
 * Why React.createElement (aliased `h`) instead of JSX: Babel standalone runs compiled JSX by
 * injecting an inline <script> and calling eval, which the server's CSP (script-src 'self' only:
 * no 'unsafe-eval', no 'unsafe-inline') refuses, so a text/babel page never boots. It would also
 * cost a 3 MB download plus a compile on every page load and print a console warning. Plain JS
 * avoids all three.
 *
 * Rendering rule: every piece of server or model text is rendered as React text nodes (escaped).
 * There is no dangerouslySetInnerHTML anywhere in this file.
 */
(function () {
  'use strict';

  const React = globalThis.React;
  if (!React) throw new Error('React must be loaded before app.js');
  const {
    createElement: h,
    Fragment,
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    useReducer,
    useContext,
    createContext,
    useLayoutEffect,
  } = React;

  // ---------------------------------------------------------------------------------------------
  // Vocabulary (mirrors docs/ARCHITECTURE.md "Core vocabulary")
  // ---------------------------------------------------------------------------------------------

  const JOBS = ['chat', 'code', 'image', 'video', 'music', 'voice', 'action'];
  const MEDIA_JOBS = new Set(['image', 'video', 'music', 'voice']);
  const TIERS = ['quality', 'balanced', 'budget', 'private'];
  const EFFORTS = ['none', 'low', 'medium', 'high'];
  const JOB_LABEL = { chat: 'Chat', code: 'Code', image: 'Image', video: 'Video', music: 'Music', voice: 'Voice', action: 'Action' };
  const TIER_LABEL = { quality: 'Quality', balanced: 'Balanced', budget: 'Budget', private: 'Private' };
  const REGION_LABEL = { us: 'United States', eu: 'European Union', cn: 'China', self: "Gode's own servers" };
  const REGION_SHORT = { us: 'US', eu: 'EU', cn: 'China', self: 'Our servers' };
  const UNIT_LABEL = {
    image: 'image',
    megapixel: 'megapixel',
    second: 'second',
    song: 'song',
    '1k_chars': '1K characters',
    minute: 'minute',
    request: 'generation',
  };
  const PLANS = [
    { id: 'saver', name: 'Saver', blurb: 'The cheapest model that does the job well. Great for everyday questions.' },
    { id: 'balanced', name: 'Balanced', blurb: 'Cheap models for easy requests, stronger ones when it gets hard.' },
    { id: 'best', name: 'Best', blurb: 'Top models for almost everything. Answers cost more.' },
  ];
  const LEDGER_LABEL = {
    signup_bonus: 'Welcome credit',
    purchase: 'Credit purchase',
    charge: 'Usage',
    hold: 'Reserved for an answer',
    release: 'Reservation released',
    dev_topup: 'Developer top-up',
    admin_adjust: 'Adjustment',
  };
  const SUGGESTIONS = [
    { job: 'chat', label: 'Explain it simply', text: 'Explain how compound interest works, like I’m 12.' },
    { job: 'code', label: 'Write some code', text: 'Write a Python script that renames my photos by the date they were taken.' },
    { job: 'image', label: 'Make an image', text: 'An image of a cozy reading nook on a rainy afternoon, soft watercolor style.' },
    { job: 'video', label: 'Make a video', text: 'A 5-second video of waves rolling onto a beach at sunset.' },
    { job: 'music', label: 'Make music', text: 'A calm lo-fi track with soft piano for studying.' },
    { job: 'voice', label: 'Read it aloud', text: 'Read this aloud in a warm voice: Good morning, everyone, and welcome!' },
  ];

  // ---------------------------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------------------------

  function toNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /** Same rule as the server's chip: >= 1 cent -> 2 dp; smaller -> up to 4 dp ("$0.0031"). */
  function formatCost(usd) {
    const n = toNumber(usd);
    if (n === null || n <= 0) return '$0.00';
    if (n >= 0.01) return '$' + n.toFixed(2);
    if (n < 0.0001) return '<$0.0001';
    return '$' + n.toFixed(4).replace(/0+$/, '');
  }

  /** Ledger and log amounts: exact down to a micro-dollar, because a single answer can cost $0.000013. */
  function formatPrecise(usd) {
    const n = toNumber(usd);
    if (n === null || n === 0) return '$0.00';
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 0.01) return sign + '$' + abs.toFixed(2);
    if (abs < 0.000001) return sign + '<$0.000001';
    return sign + '$' + abs.toFixed(6).replace(/0+$/, '');
  }

  const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  function formatMoney(usd) {
    return MONEY.format(toNumber(usd) ?? 0);
  }

  /** Balances under $10 keep sub-cent precision so a $0.0013 answer visibly moves the number. */
  function formatBalance(usd) {
    const n = toNumber(usd) ?? 0;
    const abs = Math.abs(n);
    if (abs >= 10 || abs === 0) return MONEY.format(n);
    const s = abs.toFixed(4).replace(/0{1,2}$/, '');
    return (n < 0 ? '−$' : '$') + s;
  }

  function signedAmount(usd) {
    const n = toNumber(usd) ?? 0;
    return (n > 0 ? '+' : '') + formatPrecise(n);
  }

  function effortText(effort) {
    return !effort || effort === 'none' ? 'no thinking' : effort + ' effort';
  }

  function countRedactions(redactions) {
    const r = typeof redactions === 'string' ? safeJsonParse(redactions, {}) : redactions;
    if (!r || typeof r !== 'object') return 0;
    return Object.values(r).reduce((sum, n) => sum + (Number(n) > 0 ? Number(n) : 0), 0);
  }

  function hiddenDetailsText(n) {
    return n + ' personal detail' + (n === 1 ? '' : 's') + ' hidden from the model';
  }

  /** Chip while an answer is still being produced (or when the server sent none); done.chip wins. */
  function liveChipText(request) {
    if (!request) return '';
    const parts = [request.model_label || 'Model', effortText(request.effort)];
    if (toNumber(request.cost_usd) !== null) parts.push(formatCost(request.cost_usd));
    else if (toNumber(request.est_cost_usd) !== null) parts.push('est. ' + formatCost(request.est_cost_usd));
    return parts.join(' · ');
  }

  function trimNumber(n) {
    return String(Number(Number(n).toFixed(4)));
  }

  function priceText(m) {
    if (!m) return '';
    if (m.price_unit) {
      const p = toNumber(m.price_per_unit);
      return p === null ? '' : '$' + trimNumber(p) + ' / ' + (UNIT_LABEL[m.price_unit] || m.price_unit);
    }
    const pin = toNumber(m.price_in);
    const pout = toNumber(m.price_out);
    if (pin === null && pout === null) return '';
    return '$' + trimNumber(pin ?? 0) + ' / $' + trimNumber(pout ?? 0) + ' per 1M tokens';
  }

  function formatPct(v) {
    const n = toNumber(v);
    return n === null ? '—' : n.toFixed(1).replace(/\.0$/, '') + '%';
  }

  function formatRate(v) {
    const n = toNumber(v);
    return n === null ? '—' : formatPct(n * 100);
  }

  function formatDateTime(ms) {
    const d = new Date(Number(ms));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function dayGroup(ms, nowMs) {
    const DAY = 86400000;
    const start = new Date(nowMs === undefined ? Date.now() : nowMs);
    start.setHours(0, 0, 0, 0);
    const t = Number(ms);
    if (t >= start.getTime()) return 'Today';
    if (t >= start.getTime() - DAY) return 'Yesterday';
    if (t >= start.getTime() - 7 * DAY) return 'Previous 7 days';
    return 'Older';
  }

  function safeJsonParse(s, fallback) {
    if (typeof s !== 'string' || s === '') return fallback;
    try {
      return JSON.parse(s);
    } catch (e) {
      return fallback;
    }
  }

  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
  }

  function readLocal(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null; // storage blocked (private mode): fall back to defaults
    }
  }

  function writeLocal(key, value) {
    try {
      if (value === null || value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) {
      // Storage blocked: these are conveniences only, so nothing to do.
    }
  }

  // ---------------------------------------------------------------------------------------------
  // HTTP API client
  // ---------------------------------------------------------------------------------------------

  class ApiError extends Error {
    constructor(status, code, message) {
      super(message || 'Request failed.');
      this.name = 'ApiError';
      this.status = status;
      this.code = code || 'error';
    }
  }

  const FALLBACK_MESSAGES = {
    0: "Can't reach Gode. Check your connection and try again.",
    401: 'Please sign in.',
    403: "You don't have access to that.",
    404: 'Not found.',
    413: 'That message is too long.',
    429: 'Too many requests. Wait a moment and try again.',
  };

  const authLostListeners = new Set();
  function onAuthLost(fn) {
    authLostListeners.add(fn);
    return () => authLostListeners.delete(fn);
  }
  function emitAuthLost() {
    authLostListeners.forEach((fn) => fn());
  }

  async function readJson(res) {
    const text = await res.text();
    return safeJsonParse(text, null);
  }

  function errorFromResponse(res, data, redirectOn401) {
    // A 401 anywhere means the session is gone: every screen drops back to sign-in.
    if (res.status === 401 && redirectOn401) emitAuthLost();
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      FALLBACK_MESSAGES[res.status] ||
      (res.status >= 500 ? 'Something went wrong on our side. Please try again.' : 'Request failed.');
    return new ApiError(res.status, (data && data.code) || 'http_' + res.status, message);
  }

  const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

  async function api(path, { method = 'GET', body, signal, redirectOn401 = true } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: JSON_HEADERS,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new ApiError(0, 'network', FALLBACK_MESSAGES[0]);
    }
    const data = await readJson(res);
    if (!res.ok) throw errorFromResponse(res, data, redirectOn401);
    return data || {};
  }

  /**
   * Incremental Server-Sent Events parser. Lines and events may be split across network chunks at
   * any byte, including between the CR and LF of a CRLF pair.
   * @param {(event: string, data: string) => void} onEvent
   */
  function createSSEParser(onEvent) {
    let buffer = '';
    let eventName = '';
    let dataLines = [];
    let started = false;

    function dispatch() {
      if (dataLines.length) onEvent(eventName || 'message', dataLines.join('\n'));
      eventName = '';
      dataLines = [];
    }

    function processLine(line) {
      if (line === '') return dispatch();
      if (line.charCodeAt(0) === 58) return; // ":" comment, e.g. the server's ": ping" keepalive
      const i = line.indexOf(':');
      const field = i < 0 ? line : line.slice(0, i);
      let value = i < 0 ? '' : line.slice(i + 1);
      if (value.charCodeAt(0) === 32) value = value.slice(1);
      if (field === 'event') eventName = value;
      else if (field === 'data') dataLines.push(value);
      // id/retry only matter for EventSource reconnects; a POST stream is never resumed.
    }

    return {
      push(chunk) {
        if (!chunk) return;
        buffer += chunk;
        if (!started) {
          started = true;
          if (buffer.charCodeAt(0) === 0xfeff) buffer = buffer.slice(1);
        }
        const re = /\r\n|\r|\n/g;
        let start = 0;
        let m;
        while ((m = re.exec(buffer))) {
          // A CR at the very end may be the first half of a CRLF split across chunks: wait.
          if (m[0] === '\r' && m.index === buffer.length - 1) break;
          processLine(buffer.slice(start, m.index));
          start = re.lastIndex;
        }
        buffer = buffer.slice(start);
      },
      end() {
        if (buffer) processLine(buffer.replace(/\r$/, ''));
        buffer = '';
        dispatch();
      },
    };
  }

  /** POST a JSON body and consume the SSE answer. Pre-stream failures arrive as JSON errors. */
  async function streamApi(path, body, { signal, onEvent }) {
    let res;
    try {
      res = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
        signal,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new ApiError(0, 'network', FALLBACK_MESSAGES[0]);
    }
    if (!res.ok) throw errorFromResponse(res, await readJson(res), true);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/event-stream') || !res.body) {
      const data = await readJson(res);
      if (data && data.error) throw new ApiError(res.status, data.code, data.error);
      throw new ApiError(502, 'bad_stream', 'The server sent an unexpected response.');
    }
    const parser = createSSEParser((event, raw) => onEvent(event, safeJsonParse(raw, {}) || {}));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.end();
  }

  // ---------------------------------------------------------------------------------------------
  // Markdown-lite: block + inline parsing to plain tokens, rendered as React text (always escaped)
  // ---------------------------------------------------------------------------------------------

  const FENCE_RE = /^\s{0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/;
  const UL_RE = /^\s*[-*+]\s+(.*)$/;
  const OL_RE = /^\s*(\d{1,9})[.)]\s+(.*)$/;
  const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
  const HR_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

  /** Split text into blocks. An unclosed fence (mid-stream) runs to the end as a code block. */
  function parseBlocks(src) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let para = [];
    const flush = () => {
      if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
      para = [];
    };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(FENCE_RE);
      if (fence) {
        flush();
        const marker = fence[1];
        const body = [];
        i++;
        while (i < lines.length && !(lines[i].trim().startsWith(marker) && lines[i].trim().replace(/[`~]/g, '') === '')) {
          body.push(lines[i]);
          i++;
        }
        blocks.push({ type: 'code', lang: fence[2] || '', code: body.join('\n'), closed: i < lines.length });
        i++;
        continue;
      }
      if (!line.trim()) {
        flush();
        i++;
        continue;
      }
      const heading = line.match(HEADING_RE);
      if (heading) {
        flush();
        blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
        i++;
        continue;
      }
      if (HR_RE.test(line)) {
        flush();
        blocks.push({ type: 'hr' });
        i++;
        continue;
      }
      const ul = line.match(UL_RE);
      const ol = !ul && line.match(OL_RE);
      if (ul || ol) {
        flush();
        const ordered = Boolean(ol);
        const items = [];
        while (i < lines.length) {
          const l = lines[i];
          const m = ordered ? l.match(OL_RE) : l.match(UL_RE);
          if (m) {
            items.push(ordered ? m[2] : m[1]);
            i++;
          } else if (items.length && /^\s{2,}\S/.test(l)) {
            items[items.length - 1] += '\n' + l.trim(); // indented continuation of the last item
            i++;
          } else break;
        }
        blocks.push({ type: ordered ? 'ol' : 'ul', start: ordered ? Number(ol[1]) : 1, items });
        continue;
      }
      if (/^\s{0,3}>/.test(line)) {
        flush();
        const quote = [];
        while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
          i++;
        }
        blocks.push({ type: 'quote', text: quote.join('\n') });
        continue;
      }
      para.push(line);
      i++;
    }
    flush();
    return blocks;
  }

  // Alternatives, earliest match wins: `code`, [text](url), **bold**, bare URL, *em*, newline.
  // No lookbehind: older Safari versions reject it and would refuse the whole script.
  const INLINE_SOURCE =
    '`([^`\\n]+)`' +
    '|\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)' +
    '|\\*\\*(?=\\S)([\\s\\S]*?\\S)\\*\\*' +
    '|(https?:\\/\\/[^\\s<>()]*[^\\s<>().,;:!?\'"\\])])' +
    '|\\*(?=[^\\s*])([^*\\n]*?[^\\s*])\\*' +
    '|\\n';

  function safeHref(url) {
    const u = String(url || '').trim();
    return /^(https?:\/\/|mailto:)\S+$/i.test(u) ? u : null;
  }

  function parseInline(text) {
    const src = String(text || '');
    const out = [];
    const re = new RegExp(INLINE_SOURCE, 'g');
    let last = 0;
    let m;
    while ((m = re.exec(src))) {
      if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) });
      if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
      else if (m[2] !== undefined) {
        const href = safeHref(m[3]);
        // Unsafe schemes (javascript:, data:) are shown as plain text, never linked.
        out.push(href ? { t: 'link', href, children: [{ t: 'text', v: m[2] }] } : { t: 'text', v: m[0] });
      } else if (m[4] !== undefined) out.push({ t: 'strong', children: parseInline(m[4]) });
      else if (m[5] !== undefined) out.push({ t: 'link', href: m[5], children: [{ t: 'text', v: m[5] }] });
      else if (m[6] !== undefined) out.push({ t: 'em', children: parseInline(m[6]) });
      else out.push({ t: 'br' });
      last = re.lastIndex;
    }
    if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
    return out;
  }

  function renderTokens(tokens) {
    return tokens.map((tk, i) => {
      switch (tk.t) {
        case 'code':
          return h('code', { key: i, className: 'md-code' }, tk.v);
        case 'strong':
          return h('strong', { key: i }, renderTokens(tk.children));
        case 'em':
          return h('em', { key: i }, renderTokens(tk.children));
        case 'link':
          return h('a', { key: i, href: tk.href, target: '_blank', rel: 'noopener noreferrer nofollow' }, renderTokens(tk.children));
        case 'br':
          return h('br', { key: i });
        default:
          return h(Fragment, { key: i }, tk.v);
      }
    });
  }

  function renderInline(text) {
    return renderTokens(parseInline(text));
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Plain-http dev servers have no async clipboard API.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('Copy is not available in this browser.');
  }

  function safeMediaUrl(url) {
    const u = String(url || '').trim();
    if (/^(https:\/\/|blob:|\/(?!\/))/i.test(u)) return u;
    if (/^data:(image|video|audio)\/[\w.+-]+[;,]/i.test(u)) return u;
    return null;
  }

  // ---------------------------------------------------------------------------------------------
  // Hash routing: #/ chat, #/c/<id> a conversation, #/settings, #/billing, #/admin, #/privacy
  // ---------------------------------------------------------------------------------------------

  const PAGES = ['settings', 'billing', 'admin', 'privacy'];

  function parseHash(hash) {
    const raw = String(hash || '').replace(/^#\/?/, '');
    const q = raw.indexOf('?');
    const path = q < 0 ? raw : raw.slice(0, q);
    const params = new URLSearchParams(q < 0 ? '' : raw.slice(q + 1));
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'c' && parts[1]) {
      let id = parts[1];
      try {
        id = decodeURIComponent(id);
      } catch (e) {
        // Malformed escape: use the raw segment, the API answers 404 for an unknown id.
      }
      return { page: 'chat', conversationId: id, params };
    }
    return { page: PAGES.includes(parts[0]) ? parts[0] : 'chat', conversationId: null, params };
  }

  const routeListeners = new Set();
  function notifyRoute() {
    const route = parseHash(window.location.hash);
    routeListeners.forEach((fn) => fn(route));
  }

  /** replace: rewrite the URL without a history entry (e.g. a new chat getting its id mid-stream). */
  function navigate(hash, { replace = false } = {}) {
    if (replace) {
      window.history.replaceState(null, '', hash);
      notifyRoute();
    } else if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      notifyRoute();
    }
  }

  function useHashRoute() {
    const [route, setRoute] = useState(() => parseHash(window.location.hash));
    useEffect(() => {
      routeListeners.add(setRoute);
      window.addEventListener('hashchange', notifyRoute);
      return () => {
        routeListeners.delete(setRoute);
        window.removeEventListener('hashchange', notifyRoute);
      };
    }, []);
    return route;
  }

  // ---------------------------------------------------------------------------------------------
  // Small shared components
  // ---------------------------------------------------------------------------------------------

  const ICONS = {
    plus: ['M12 5v14', 'M5 12h14'],
    x: ['M18 6 6 18', 'm6 6 12 12'],
    menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
    'chevron-down': ['m6 9 6 6 6-6'],
    check: ['M20 6 9 17l-5-5'],
    copy: [{ tag: 'rect', attrs: { x: 9, y: 9, width: 13, height: 13, rx: 2 } }, 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
    trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    lock: [{ tag: 'rect', attrs: { x: 4, y: 11, width: 16, height: 10, rx: 2 } }, 'M8 11V7a4 4 0 0 1 8 0v4'],
    shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'm9 12 2 2 4-4'],
    refresh: ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'],
    'thumbs-up': [
      'M7 10v12',
      'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z',
    ],
    'thumbs-down': [
      'M17 14V2',
      'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z',
    ],
    sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M2 14h4', 'M10 8h4', 'M18 16h4'],
    card: [{ tag: 'rect', attrs: { x: 2, y: 5, width: 20, height: 14, rx: 2 } }, 'M2 10h20'],
    chart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
    'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
    'arrow-up': ['M12 19V5', 'm5 12 7-7 7 7'],
    stop: [{ tag: 'rect', attrs: { x: 7, y: 7, width: 10, height: 10, rx: 1.5, fill: 'currentColor' } }],
    'eye-off': [
      'M9.88 9.88a3 3 0 1 0 4.24 4.24',
      'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68',
      'M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61',
      'm2 2 20 20',
    ],
    download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
    upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
    sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 16.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z'],
    message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
    alert: ['M12 9v4', 'M12 17h.01', 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'],
    server: [
      { tag: 'rect', attrs: { x: 2, y: 3, width: 20, height: 8, rx: 2 } },
      { tag: 'rect', attrs: { x: 2, y: 13, width: 20, height: 8, rx: 2 } },
      'M6 7h.01',
      'M6 17h.01',
    ],
    eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z', { tag: 'circle', attrs: { cx: 12, cy: 12, r: 3 } }],
    user: [{ tag: 'circle', attrs: { cx: 12, cy: 8, r: 4 } }, 'M4 21a8 8 0 0 1 16 0'],
    globe: [
      { tag: 'circle', attrs: { cx: 12, cy: 12, r: 10 } },
      'M2 12h20',
      'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    ],
    info: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 10 } }, 'M12 16v-4', 'M12 8h.01'],
    arrow: ['M5 12h14', 'm12 5 7 7-7 7'],
  };

  function Icon({ name, size = 18, className }) {
    const parts = ICONS[name] || [];
    return h(
      'svg',
      {
        className: cx('icon', className),
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      parts.map((p, i) => (typeof p === 'string' ? h('path', { key: i, d: p }) : h(p.tag, Object.assign({ key: i }, p.attrs))))
    );
  }

  /** The Gode mark: a "G" drawn as a route that ends on its destination. Same as favicon.svg. */
  function BrandMark({ size = 28, className }) {
    return h(
      'svg',
      { className: cx('brand-mark', className), width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': 'true', focusable: 'false' },
      h('rect', { width: 32, height: 32, rx: 9, className: 'brand-mark-bg' }),
      h('path', {
        d: 'M21.4 11.4A7 7 0 1 0 23 16h-6.2',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: 'brand-mark-fg',
      })
    );
  }

  function Brand({ size = 28 }) {
    return h('span', { className: 'brand' }, h(BrandMark, { size }), h('span', { className: 'brand-name' }, 'Gode'));
  }

  function Spinner({ size = 16, label }) {
    return h('span', { className: 'spinner', style: { width: size, height: size }, role: label ? 'status' : undefined, 'aria-label': label });
  }

  function Dots() {
    return h('span', { className: 'dots', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'));
  }

  function Toggle({ id, label, description, checked, onChange, disabled }) {
    return h(
      'div',
      { className: 'toggle-row' },
      h(
        'div',
        { className: 'toggle-text' },
        h('label', { htmlFor: id, className: 'toggle-label' }, label),
        description && h('p', { className: 'toggle-desc', id: id + '-desc' }, description)
      ),
      h(
        'button',
        {
          id,
          type: 'button',
          role: 'switch',
          className: 'switch',
          'aria-checked': Boolean(checked),
          'aria-describedby': description ? id + '-desc' : undefined,
          disabled,
          onClick: () => onChange(!checked),
        },
        h('span', { className: 'switch-thumb' })
      )
    );
  }

  function Notice({ tone = 'info', icon, title, children, actions, role }) {
    return h(
      'div',
      { className: cx('notice', 'notice-' + tone), role },
      h(Icon, { name: icon || (tone === 'error' || tone === 'warn' ? 'alert' : tone === 'success' ? 'check' : 'info'), size: 18, className: 'notice-icon' }),
      h(
        'div',
        { className: 'notice-body' },
        title && h('strong', { className: 'notice-title' }, title),
        children && h('div', { className: 'notice-text' }, children),
        actions && h('div', { className: 'notice-actions' }, actions)
      )
    );
  }

  function EmptyRow({ colSpan, children }) {
    return h('tr', null, h('td', { colSpan, className: 'table-empty' }, children));
  }

  function LoadError({ error, onRetry }) {
    return h(
      Notice,
      { tone: 'error', title: "Couldn't load this", role: 'alert', actions: onRetry && h('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: onRetry }, 'Try again') },
      error && error.message
    );
  }

  /**
   * A render bug in one screen must not blank the whole app (React unmounts the tree on an
   * uncaught render error). Keyed by page in Shell, so navigating away resets it.
   */
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error };
    }
    componentDidCatch(error) {
      // Message only: never log props/state, which can hold the user's chat text.
      console.error('Gode UI error:', error && error.message);
    }
    render() {
      if (!this.state.error) return this.props.children;
      return h(
        'div',
        { className: 'page' },
        h(
          'div',
          { className: 'page-inner' },
          h(
            Notice,
            {
              tone: 'error',
              title: 'This screen hit a problem',
              role: 'alert',
              actions: h('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => window.location.reload() }, 'Reload Gode'),
            },
            'Your chats are safe. Reload to continue.'
          )
        )
      );
    }
  }

  const ToastContext = createContext(() => {});
  let toastSeq = 0;

  function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());
    // The same message again (e.g. "Saved" after each toggle) restarts its timer instead of stacking.
    const notify = useCallback((message, tone = 'info') => {
      const key = tone + '|' + message;
      setToasts((list) => (list.some((t) => t.key === key) ? list : list.slice(-2).concat({ id: ++toastSeq, key, message, tone })));
      window.clearTimeout(timers.current.get(key));
      timers.current.set(
        key,
        window.setTimeout(() => {
          timers.current.delete(key);
          setToasts((list) => list.filter((t) => t.key !== key));
        }, tone === 'error' ? 6000 : 3200)
      );
    }, []);
    return h(
      ToastContext.Provider,
      { value: notify },
      children,
      h(
        'div',
        { className: 'toast-stack', role: 'status', 'aria-live': 'polite' },
        toasts.map((t) => h('div', { key: t.id, className: cx('toast', 'toast-' + t.tone) }, h(Icon, { name: t.tone === 'error' ? 'alert' : 'check', size: 16 }), t.message))
      )
    );
  }

  function useToast() {
    return useContext(ToastContext);
  }

  function useUid(prefix) {
    const ref = useRef(null);
    if (ref.current === null) ref.current = prefix + '-' + Math.random().toString(36).slice(2, 8);
    return ref.current;
  }

  /** Close a popover on outside click or Escape. */
  function useDismiss(open, refs, onClose) {
    useEffect(() => {
      if (!open) return undefined;
      const onDown = (e) => {
        if (refs.every((r) => !r.current || !r.current.contains(e.target))) onClose();
      };
      const onKey = (e) => {
        if (e.key === 'Escape') onClose(true);
      };
      document.addEventListener('mousedown', onDown);
      document.addEventListener('touchstart', onDown, { passive: true });
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onDown);
        document.removeEventListener('touchstart', onDown);
        document.removeEventListener('keydown', onKey);
      };
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  }

  // ---------------------------------------------------------------------------------------------
  // Markdown + media components
  // ---------------------------------------------------------------------------------------------

  function CodeBlock({ lang, code }) {
    const [copied, setCopied] = useState(false);
    const notify = useToast();
    const onCopy = async () => {
      try {
        await copyText(code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch (e) {
        notify(e.message || 'Copy failed.', 'error');
      }
    };
    return h(
      'div',
      { className: 'code-block' },
      h(
        'div',
        { className: 'code-head' },
        h('span', { className: 'code-lang' }, lang || 'code'),
        h(
          'button',
          { type: 'button', className: 'code-copy', onClick: onCopy, 'aria-label': copied ? 'Copied' : 'Copy code' },
          h(Icon, { name: copied ? 'check' : 'copy', size: 14 }),
          copied ? 'Copied' : 'Copy'
        )
      ),
      h('pre', null, h('code', null, code))
    );
  }

  function renderBlock(b, i) {
    switch (b.type) {
      case 'code':
        return h(CodeBlock, { key: i, lang: b.lang, code: b.code });
      case 'h':
        return h('h' + Math.min(b.level + 2, 6), { key: i, className: 'md-h md-h' + Math.min(b.level, 3) }, renderInline(b.text));
      case 'ul':
        return h('ul', { key: i }, b.items.map((it, j) => h('li', { key: j }, renderInline(it))));
      case 'ol':
        return h('ol', { key: i, start: b.start !== 1 ? b.start : undefined }, b.items.map((it, j) => h('li', { key: j }, renderInline(it))));
      case 'quote':
        return h('blockquote', { key: i }, renderInline(b.text));
      case 'hr':
        return h('hr', { key: i });
      default:
        return h('p', { key: i }, renderInline(b.text));
    }
  }

  function Markdown({ text }) {
    const blocks = useMemo(() => parseBlocks(text), [text]);
    return h('div', { className: 'md' }, blocks.map(renderBlock));
  }

  function MediaItem({ item }) {
    const url = safeMediaUrl(item && item.url);
    if (!url) return h('div', { className: 'media-missing' }, 'This file could not be shown.');
    const type = item.type || String(item.mime || '').split('/')[0];
    let el;
    if (type === 'video') el = h('video', { src: url, controls: true, playsInline: true, preload: 'metadata' });
    else if (type === 'audio') el = h('audio', { src: url, controls: true, preload: 'metadata' });
    else el = h('img', { src: url, alt: 'Generated image', loading: 'lazy', decoding: 'async' });
    return h(
      'figure',
      { className: cx('media', 'media-' + (type || 'image')) },
      el,
      h(
        'figcaption',
        null,
        h('a', { href: url, download: 'gode-' + (type || 'file'), target: '_blank', rel: 'noopener noreferrer' }, h(Icon, { name: 'download', size: 14 }), 'Download')
      )
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Chat engine: conversations, optimistic messages and SSE streams, kept above the views so an
  // answer keeps streaming while you look at Settings or another chat.
  // ---------------------------------------------------------------------------------------------

  let keySeq = 0;
  const localKey = (prefix) => prefix + ':' + Date.now().toString(36) + ':' + ++keySeq;
  const isDraftKey = (key) => typeof key === 'string' && key.startsWith('draft:');

  function messageFromServer(m) {
    return {
      key: m.id,
      id: m.id,
      role: m.role,
      text: m.text || '',
      media: Array.isArray(m.media) ? m.media : [],
      created_at: m.created_at,
      parent_id: m.parent_id || null,
      request: m.request || null,
      phase: null,
      progress: null,
      error: null,
      stopped: false,
    };
  }

  function requestFromRoute(r) {
    const model = r.model || {};
    return {
      id: r.request_id,
      job: r.job,
      tier: r.tier,
      model_id: model.id,
      model_label: model.label,
      model_vendor: model.vendor,
      model_region: model.region,
      effort: r.effort,
      est_cost_usd: r.est_cost_usd,
      cost_usd: null,
      chip: null,
      private: Boolean(r.private),
      zdr: Boolean(r.zdr),
      redactions: r.redactions || {},
      feedback: null,
      pinned: Boolean(r.pinned),
      status: 'streaming',
    };
  }

  function updateThread(state, key, fn) {
    const current = state.threads[key];
    const next = fn(current);
    if (next === current || next === undefined) return state;
    return Object.assign({}, state, { threads: Object.assign({}, state.threads, { [key]: next }) });
  }

  function withoutKey(obj, key) {
    const copy = Object.assign({}, obj);
    delete copy[key];
    return copy;
  }

  function chatReducer(state, a) {
    switch (a.type) {
      case 'load_start':
        return updateThread(state, a.key, (t) => Object.assign({ messages: [] }, t, { status: 'loading', error: null }));
      case 'load_ok':
        return updateThread(state, a.key, () => ({ status: 'ready', error: null, messages: a.messages }));
      case 'load_fail':
        return updateThread(state, a.key, (t) => Object.assign({ messages: [] }, t, { status: 'error', error: a.error }));
      case 'append':
        return updateThread(state, a.key, (t) => ({ status: 'ready', error: null, messages: (t ? t.messages : []).concat(a.messages) }));
      case 'patch':
        return updateThread(state, a.key, (t) => {
          if (!t) return t;
          return Object.assign({}, t, {
            messages: t.messages.map((m) => (m.key === a.msgKey ? Object.assign({}, m, typeof a.patch === 'function' ? a.patch(m) : a.patch) : m)),
          });
        });
      case 'remove':
        return updateThread(state, a.key, (t) => t && Object.assign({}, t, { messages: t.messages.filter((m) => !a.msgKeys.includes(m.key)) }));
      case 'rename': {
        const thread = state.threads[a.from];
        const stream = state.streams[a.from];
        const threads = withoutKey(state.threads, a.from);
        if (thread) threads[a.to] = thread;
        const streams = withoutKey(state.streams, a.from);
        if (stream) streams[a.to] = stream;
        return { threads, streams };
      }
      case 'stream_start':
        return Object.assign({}, state, { streams: Object.assign({}, state.streams, { [a.key]: { kind: a.kind, msgKey: a.msgKey } }) });
      case 'stream_end':
        return Object.assign({}, state, { streams: withoutKey(state.streams, a.key) });
      case 'drop':
        return { threads: withoutKey(state.threads, a.key), streams: withoutKey(state.streams, a.key) };
      default:
        return state;
    }
  }

  /**
   * @param {{ current: { setUser, notify, onConversationCreated, onConversationTouched, onStreamSettled } }} hooksRef
   */
  function useChatEngine(hooksRef) {
    const [state, dispatch] = useReducer(chatReducer, { threads: {}, streams: {} });
    const controllers = useRef(new Map()); // msgKey -> AbortController
    const modelsCache = useRef(new Map()); // "job|conversation" -> { at, models }

    // Leaving the app (sign-out, account deleted) cancels every running answer.
    useEffect(() => () => controllers.current.forEach((c) => c.abort()), []);

    const patch = useCallback((key, msgKey, p) => dispatch({ type: 'patch', key, msgKey, patch: p }), []);

    const loadThread = useCallback(async (id) => {
      dispatch({ type: 'load_start', key: id });
      try {
        const data = await api('/api/conversations/' + encodeURIComponent(id));
        dispatch({ type: 'load_ok', key: id, messages: (data.messages || []).map(messageFromServer) });
      } catch (e) {
        dispatch({ type: 'load_fail', key: id, error: { code: e.code, message: e.message, status: e.status } });
      }
    }, []);

    const runStream = useCallback(
      async ({ threadKey, msgKey, kind, url, body, onRoute }) => {
        const controller = new AbortController();
        controllers.current.set(msgKey, controller);
        const keyRef = { current: threadKey };
        let settled = false;
        dispatch({ type: 'stream_start', key: threadKey, kind, msgKey });

        // A regenerate/switch that fails or is stopped puts the previous (saved) answer back: the
        // partial new one was never stored. A new answer keeps its partial text, marked unsaved.
        const finish = (extra) =>
          patch(keyRef.current, msgKey, (m) => {
            const base = { phase: null, progress: null, switchingTo: null };
            if (m.prev) return Object.assign(base, m.prev, { prev: null }, extra);
            return Object.assign(base, extra);
          });

        const handlers = {
          route(d) {
            if (onRoute) onRoute(d, keyRef);
            patch(keyRef.current, msgKey, {
              id: d.message_id || null,
              phase: MEDIA_JOBS.has(d.job) ? 'generating' : 'writing',
              request: requestFromRoute(d),
            });
            hooksRef.current.onConversationTouched(d.conversation_id || keyRef.current, d.title);
          },
          delta(d) {
            if (typeof d.text === 'string' && d.text) patch(keyRef.current, msgKey, (m) => ({ text: m.text + d.text, phase: 'writing' }));
          },
          replace(d) {
            if (typeof d.text === 'string') patch(keyRef.current, msgKey, { text: d.text });
          },
          progress(d) {
            patch(keyRef.current, msgKey, { progress: { status: d.status, position: d.position } });
          },
          media(d) {
            if (d && d.url) patch(keyRef.current, msgKey, (m) => ({ media: (m.media || []).concat({ type: d.type, url: d.url, mime: d.mime }) }));
          },
          done(d) {
            settled = true;
            patch(keyRef.current, msgKey, (m) => ({
              id: d.message_id || m.id,
              unsaved: false,
              phase: null,
              progress: null,
              prev: null,
              switchingTo: null,
              request: Object.assign({}, m.request, {
                id: d.request_id || (m.request && m.request.id),
                cost_usd: d.cost_usd,
                chip: d.chip || null,
                status: 'ok',
                feedback: null,
              }),
            }));
            if (toNumber(d.balance_usd) !== null) hooksRef.current.setUser({ balance_usd: d.balance_usd });
          },
          error(d) {
            settled = true;
            finish({ error: { code: d.code || 'error', message: d.error || 'Something went wrong.', kind } });
            if (d.code === 'insufficient_credits') hooksRef.current.refreshUser();
          },
        };

        try {
          await streamApi(url, body, { signal: controller.signal, onEvent: (event, data) => handlers[event] && handlers[event](data) });
          if (!settled) finish({ error: { code: 'interrupted', message: 'The connection closed before the answer finished.', kind } });
        } catch (e) {
          if (e && e.name === 'AbortError') finish(kind === 'chat' ? { stopped: true } : {});
          else finish({ error: { code: e.code || 'error', message: e.message, kind } });
        } finally {
          controllers.current.delete(msgKey);
          dispatch({ type: 'stream_end', key: keyRef.current });
          hooksRef.current.onStreamSettled(keyRef.current);
        }
      },
      [patch, hooksRef]
    );

    const send = useCallback(
      (threadKey, text, modelId) => {
        const draft = isDraftKey(threadKey);
        const userKey = localKey('u');
        const asstKey = localKey('a');
        const nowMs = Date.now();
        dispatch({
          type: 'append',
          key: threadKey,
          messages: [
            { key: userKey, id: null, role: 'user', text, media: [], created_at: nowMs },
            { key: asstKey, id: null, role: 'assistant', text: '', media: [], created_at: nowMs, phase: 'routing', request: null, unsaved: true, userKey, sentText: text, sentModelId: modelId },
          ],
        });
        runStream({
          threadKey,
          msgKey: asstKey,
          kind: 'chat',
          url: '/api/chat',
          body: { conversation_id: draft ? undefined : threadKey, text, model_id: modelId || undefined },
          onRoute(d, keyRef) {
            patch(keyRef.current, userKey, { id: d.user_message_id || null });
            if (draft && d.conversation_id && keyRef.current === threadKey) {
              dispatch({ type: 'rename', from: threadKey, to: d.conversation_id });
              keyRef.current = d.conversation_id;
              hooksRef.current.onConversationCreated(d.conversation_id, d.title, threadKey);
            }
          },
        });
      },
      [runStream, patch, hooksRef]
    );

    const retry = useCallback(
      (threadKey, msg) => {
        dispatch({ type: 'remove', key: threadKey, msgKeys: [msg.key, msg.userKey] });
        send(threadKey, msg.sentText, msg.sentModelId);
      },
      [send]
    );

    const snapshot = (m) => ({ id: m.id, text: m.text, media: m.media, request: m.request, error: null, stopped: false, unsaved: false });

    const regenerate = useCallback(
      (threadKey, msg) => {
        patch(threadKey, msg.key, { prev: snapshot(msg), text: '', media: [], request: null, error: null, stopped: false, unsaved: true, phase: 'routing', switchingTo: null });
        runStream({ threadKey, msgKey: msg.key, kind: 'regenerate', url: '/api/messages/' + encodeURIComponent(msg.id) + '/regenerate', body: {} });
      },
      [patch, runStream]
    );

    const switchModel = useCallback(
      (threadKey, msg, model) => {
        modelsCache.current.clear(); // the conversation's pins change with a switch
        patch(threadKey, msg.key, { prev: snapshot(msg), text: '', media: [], request: null, error: null, stopped: false, unsaved: true, phase: 'routing', switchingTo: model.label });
        runStream({
          threadKey,
          msgKey: msg.key,
          kind: 'switch',
          url: '/api/messages/' + encodeURIComponent(msg.id) + '/switch',
          body: { model_id: model.id },
        });
      },
      [patch, runStream]
    );

    const feedback = useCallback(
      async (threadKey, msg, value) => {
        const before = (msg.request && msg.request.feedback) || 0;
        const next = before === value ? 0 : value; // pressing the active thumb again clears it
        patch(threadKey, msg.key, (m) => ({ request: Object.assign({}, m.request, { feedback: next || null }) }));
        try {
          await api('/api/messages/' + encodeURIComponent(msg.id) + '/feedback', { method: 'POST', body: { value: next } });
        } catch (e) {
          patch(threadKey, msg.key, (m) => ({ request: Object.assign({}, m.request, { feedback: before || null }) }));
          hooksRef.current.notify(e.message || "Couldn't save your rating.", 'error');
        }
      },
      [patch, hooksRef]
    );

    const stop = useCallback(
      (threadKey) => {
        const s = state.streams[threadKey];
        const c = s && controllers.current.get(s.msgKey);
        if (c) c.abort();
      },
      [state.streams]
    );

    const drop = useCallback((key) => dispatch({ type: 'drop', key }), []);

    const abortThread = useCallback(
      (key) => {
        const s = state.streams[key];
        const c = s && controllers.current.get(s.msgKey);
        if (c) c.abort();
      },
      [state.streams]
    );

    const fetchModels = useCallback(async (job, conversationId) => {
      const cacheKey = job + '|' + (conversationId || '');
      const hit = modelsCache.current.get(cacheKey);
      if (hit && Date.now() - hit.at < 60000) return hit.models;
      const q = new URLSearchParams({ job });
      if (conversationId && !isDraftKey(conversationId)) q.set('conversation_id', conversationId);
      const data = await api('/api/models?' + q.toString());
      const models = Array.isArray(data.models) ? data.models : [];
      modelsCache.current.set(cacheKey, { at: Date.now(), models });
      return models;
    }, []);

    return {
      threads: state.threads,
      streams: state.streams,
      loadThread,
      send,
      retry,
      regenerate,
      switchModel,
      feedback,
      stop,
      drop,
      abortThread,
      fetchModels,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Chat view
  // ---------------------------------------------------------------------------------------------

  function errorCopy(err) {
    const code = err && err.code;
    const message = err && err.message;
    const verb = err && err.kind === 'regenerate' ? "Couldn't regenerate" : err && err.kind === 'switch' ? "Couldn't switch models" : null;
    switch (code) {
      case 'insufficient_credits':
        return { title: "You're out of credits", body: 'Add credits to keep going. Every answer shows exactly what it cost.', cta: 'billing' };
      case 'private_blocked':
        return { title: 'Kept private, not sent', body: message || 'This looks private and no private model is available right now, so it was not sent to any AI provider.' };
      case 'no_model':
        return { title: 'No model available', body: message || 'No model can do this job right now. Try again later.', retry: true };
      case 'rate_limited':
        return { title: 'Slow down a little', body: message || 'Too many requests. Wait a moment and try again.', retry: true };
      case 'upstream_error':
      case 'gateway_not_configured':
        return { title: verb || "The model didn't answer", body: "The AI provider had a problem, so you weren't charged for this. Try again or switch to another model.", detail: message, retry: true };
      case 'interrupted':
      case 'network':
        return { title: verb || 'Connection lost', body: message, retry: true };
      case 'bad_request':
        return { title: verb || "Couldn't send that", body: message };
      default:
        return { title: verb || 'Something went wrong', body: message || 'Please try again.', retry: true };
    }
  }

  function ErrorNotice({ error, onRetry }) {
    const copy = errorCopy(error);
    const actions = [];
    if (copy.cta === 'billing') actions.push(h('a', { key: 'buy', className: 'btn btn-primary btn-sm', href: '#/billing' }, h(Icon, { name: 'card', size: 15 }), 'Buy credits'));
    if (copy.retry && onRetry) actions.push(h('button', { key: 'retry', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onRetry }, h(Icon, { name: 'refresh', size: 15 }), 'Try again'));
    return h(
      Notice,
      { tone: copy.cta === 'billing' || error.code === 'private_blocked' ? 'warn' : 'error', title: copy.title, role: 'alert', actions: actions.length ? actions : null },
      copy.body,
      copy.detail && h('span', { className: 'notice-detail' }, copy.detail)
    );
  }

  function PrivacyBadge({ request }) {
    const self = request.model_region === 'self';
    const label = self ? 'Ran on our servers' : request.private ? 'Private' : 'Zero retention';
    const title = self
      ? 'This answer ran on a model hosted by Gode. Nothing left our servers.'
      : request.private
        ? 'Treated as private: only zero-retention or self-hosted models were allowed.'
        : 'Zero data retention: the provider does not keep this request.';
    return h('span', { className: 'badge badge-private', title }, h(Icon, { name: 'lock', size: 13 }), label);
  }

  function SwitchMenu({ request, conversationId, disabled, fetchModels, onPick, children, label }) {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState({ status: 'idle', models: [], error: null });
    const [placement, setPlacement] = useState({ up: false, maxHeight: 440 });
    const wrapRef = useRef(null);
    const btnRef = useRef(null);
    const menuRef = useRef(null);
    const menuId = useUid('switch');

    const close = useCallback((refocus) => {
      setOpen(false);
      if (refocus && btnRef.current) btnRef.current.focus();
    }, []);
    useDismiss(open, [wrapRef], close);

    useEffect(() => {
      if (!open) return undefined;
      let alive = true;
      // Open towards the side with more room inside the message list, sized to fit it.
      const rect = btnRef.current.getBoundingClientRect();
      const scroller = btnRef.current.closest('.messages');
      const bounds = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const below = bounds.bottom - rect.bottom - 14;
      const above = rect.top - bounds.top - 14;
      const up = below < 320 && above > below;
      setPlacement({ up, maxHeight: Math.max(180, Math.min(440, up ? above : below)) });
      setState((s) => Object.assign({}, s, { status: 'loading', error: null }));
      fetchModels(request.job === 'action' ? 'chat' : request.job, conversationId)
        .then((models) => alive && setState({ status: 'ready', models, error: null }))
        .catch((e) => alive && setState({ status: 'error', models: [], error: e }));
      return () => {
        alive = false;
      };
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (open && state.status === 'ready' && menuRef.current) {
        const first = menuRef.current.querySelector('[aria-checked="true"]') || menuRef.current.querySelector('.menu-item');
        if (first) first.focus();
      }
    }, [open, state.status]);

    const onMenuKey = (e) => {
      const items = Array.from(menuRef.current.querySelectorAll('.menu-item'));
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        (items[i + 1] || items[0]).focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        (items[i - 1] || items[items.length - 1]).focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (items[0]) items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        if (items.length) items[items.length - 1].focus();
      } else if (e.key === 'Tab') {
        setOpen(false);
      }
    };

    const picked = TIER_LABEL[request.tier] ? 'Picked for ' + (JOB_LABEL[request.job] || request.job).toLowerCase() + ' · ' + TIER_LABEL[request.tier].toLowerCase() + ' tier' : null;

    return h(
      'div',
      { className: 'switch-wrap', ref: wrapRef },
      h(
        'button',
        {
          ref: btnRef,
          type: 'button',
          className: 'chip chip-button',
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-controls': open ? menuId : undefined,
          'aria-label': label + '. Switch model',
          title: picked ? picked + '. Click to answer with another model.' : 'Answer with another model',
          disabled,
          onClick: () => setOpen((o) => !o),
        },
        children,
        h(Icon, { name: 'chevron-down', size: 14, className: 'chip-caret' })
      ),
      open && h('div', { className: 'menu-scrim', 'aria-hidden': 'true', onClick: () => close(false) }),
      open &&
        h(
          'div',
          {
            id: menuId,
            ref: menuRef,
            className: cx('menu', placement.up && 'menu-up'),
            style: { maxHeight: placement.maxHeight },
            role: 'menu',
            'aria-label': 'Answer again with another model',
            onKeyDown: onMenuKey,
          },
          h('div', { className: 'menu-head' }, h('span', null, 'Answer again with'), picked && h('span', { className: 'menu-sub' }, picked + (request.pinned ? ', pinned for this chat' : ''))),
          state.status === 'loading' && h('div', { className: 'menu-empty' }, h(Spinner, { size: 14 }), 'Finding models…'),
          state.status === 'error' && h('div', { className: 'menu-empty menu-error' }, state.error.message),
          state.status === 'ready' && !state.models.length && h('div', { className: 'menu-empty' }, 'No other model can do this right now.'),
          state.models.map((m) => {
            const current = m.id === request.model_id;
            return h(
              'button',
              {
                key: m.id,
                type: 'button',
                role: 'menuitemradio',
                'aria-checked': current,
                className: cx('menu-item', current && 'is-current'),
                onClick: () => {
                  setOpen(false);
                  if (!current) onPick(m);
                },
              },
              h(
                'span',
                { className: 'menu-item-text' },
                h('span', { className: 'menu-item-label' }, m.label, (m.zdr || m.self_hosted) && h(Icon, { name: 'lock', size: 12, className: 'menu-lock' })),
                h('span', { className: 'menu-item-sub' }, [m.vendor, REGION_SHORT[m.region] || m.region, priceText(m)].filter(Boolean).join(' · '))
              ),
              current ? h('span', { className: 'menu-current' }, h(Icon, { name: 'check', size: 15 }), 'Current') : null
            );
          })
        )
    );
  }

  function RoutingState({ switchingTo }) {
    return h(
      'div',
      { className: 'routing-state', role: 'status' },
      h('span', { className: 'chip chip-skeleton' }, h(Icon, { name: 'sparkle', size: 14, className: 'chip-icon' }), switchingTo ? 'Switching to ' + switchingTo : 'Picking the best model', h(Dots))
    );
  }

  const MAKING = { image: 'Making your image', video: 'Making your video', music: 'Composing your track', voice: 'Recording the voice' };

  function GeneratingState({ job, progress }) {
    let detail = job === 'video' ? 'Videos can take a few minutes.' : 'This usually takes a few seconds.';
    if (progress && progress.status) {
      const s = String(progress.status).toUpperCase();
      const pos = toNumber(progress.position);
      if (s === 'IN_QUEUE') detail = pos === null ? 'Waiting in line…' : pos <= 0 ? "You're next in line." : pos + ' ahead of you in line.';
      else if (s === 'IN_PROGRESS') detail = 'Generating now…';
      else detail = String(progress.status).replace(/_/g, ' ').toLowerCase();
    }
    return h(
      'div',
      { className: 'generating', role: 'status' },
      h('div', { className: 'generating-art', 'aria-hidden': 'true' }),
      h('div', null, h('strong', null, (MAKING[job] || 'Working on it') + '…'), h('span', null, detail))
    );
  }

  function MessageActions({ msg, disabled, onFeedback, onRegenerate }) {
    const notify = useToast();
    const fb = (msg.request && msg.request.feedback) || 0;
    const onCopy = async () => {
      try {
        await copyText(msg.text);
        notify('Answer copied');
      } catch (e) {
        notify(e.message || 'Copy failed.', 'error');
      }
    };
    return h(
      'div',
      { className: 'msg-actions' },
      h(
        'button',
        { type: 'button', className: cx('action-btn', fb === 1 && 'is-on'), 'aria-pressed': fb === 1, 'aria-label': 'Good answer', title: 'Good answer', disabled, onClick: () => onFeedback(1) },
        h(Icon, { name: 'thumbs-up', size: 16 })
      ),
      h(
        'button',
        { type: 'button', className: cx('action-btn', fb === -1 && 'is-on is-down'), 'aria-pressed': fb === -1, 'aria-label': 'Bad answer', title: 'Bad answer', disabled, onClick: () => onFeedback(-1) },
        h(Icon, { name: 'thumbs-down', size: 16 })
      ),
      h(
        'button',
        { type: 'button', className: 'action-btn', 'aria-label': 'Regenerate with the same model', title: 'Regenerate', disabled, onClick: onRegenerate },
        h(Icon, { name: 'refresh', size: 16 })
      ),
      msg.text && h('button', { type: 'button', className: 'action-btn', 'aria-label': 'Copy answer', title: 'Copy', onClick: onCopy }, h(Icon, { name: 'copy', size: 16 }))
    );
  }

  function AssistantMessage({ msg, busy, conversationId, engine, threadKey }) {
    // A failed send is re-sent; a failed regenerate is regenerated again. A failed switch has no
    // retry button: the chip menu is right there to pick a model again.
    const retryFor = (m) => {
      if (busy) return null;
      if (m.error.kind === 'chat' && m.sentText) return () => engine.retry(threadKey, m);
      if (m.error.kind === 'regenerate' && m.id && m.request) return () => engine.regenerate(threadKey, m);
      return null;
    };
    const req = msg.request;
    const live = Boolean(msg.phase);
    const hidden = countRedactions(req && req.redactions);
    // Feedback, regenerate and switch need the answer to exist server-side.
    const saved = Boolean(msg.id) && Boolean(req) && !msg.unsaved;
    const canAct = !live && !busy && saved;
    const chipText = req ? req.chip || liveChipText(req) : '';
    return h(
      'article',
      { className: cx('msg', 'msg-assistant', live && 'is-live'), 'aria-busy': live || undefined },
      h('div', { className: 'msg-avatar' }, h(BrandMark, { size: 28 })),
      h(
        'div',
        { className: 'msg-body' },
        msg.phase === 'routing' && h(RoutingState, { switchingTo: msg.switchingTo }),
        msg.text ? h(Markdown, { text: msg.text }) : null,
        msg.phase === 'writing' && !msg.text && h('div', { className: 'writing' }, h(Dots)),
        msg.media && msg.media.length > 0 && h('div', { className: 'media-list' }, msg.media.map((m, i) => h(MediaItem, { key: i, item: m }))),
        msg.phase === 'generating' && h(GeneratingState, { job: req && req.job, progress: msg.progress }),
        msg.stopped &&
          h(
            'p',
            { className: 'msg-stopped' },
            msg.text || (msg.media && msg.media.length) ? 'Stopped.' : 'Stopped before the answer started.',
            msg.sentText && !busy && h('button', { type: 'button', className: 'link-btn', onClick: () => engine.retry(threadKey, msg) }, 'Try again')
          ),
        msg.error && h(ErrorNotice, { error: msg.error, onRetry: retryFor(msg) }),
        req &&
          h(
            'div',
            { className: 'msg-meta' },
            h(
              'div',
              { className: 'msg-meta-left' },
              h(
                SwitchMenu,
                {
                  request: req,
                  conversationId,
                  disabled: !canAct,
                  fetchModels: engine.fetchModels,
                  label: chipText,
                  onPick: (model) => engine.switchModel(threadKey, msg, model),
                },
                h(Icon, { name: 'sparkle', size: 14, className: 'chip-icon' }),
                h('span', { className: 'chip-text' }, chipText),
                live && h('span', { className: 'chip-pulse', 'aria-hidden': 'true' })
              ),
              (req.private || req.zdr) && h(PrivacyBadge, { request: req }),
              hidden > 0 && h('span', { className: 'badge badge-hidden', title: 'Replaced with placeholders before the request left Gode, then restored in this answer.' }, h(Icon, { name: 'eye-off', size: 13 }), hiddenDetailsText(hidden))
            ),
            saved && !live && h(MessageActions, { msg, disabled: !canAct, onFeedback: (v) => engine.feedback(threadKey, msg, v), onRegenerate: () => engine.regenerate(threadKey, msg) })
          )
      )
    );
  }

  function UserMessage({ msg }) {
    return h('div', { className: 'msg msg-user' }, h('div', { className: 'bubble' }, msg.text));
  }

  function EmptyState({ onPick, user }) {
    return h(
      'div',
      { className: 'empty-state' },
      h(BrandMark, { size: 44 }),
      h('h1', null, 'What can I help with?'),
      h(
        'p',
        { className: 'empty-sub' },
        user.auto_pick
          ? 'Ask anything, or ask for an image, video, music or a voice. Gode picks the best model for each job and shows what every answer cost.'
          : 'Auto-pick is off, so you choose the model below. Every answer shows what it cost.'
      ),
      h(
        'div',
        { className: 'suggestions' },
        SUGGESTIONS.map((s) =>
          h(
            'button',
            { key: s.job, type: 'button', className: 'suggestion', onClick: () => onPick(s.text) },
            h('span', { className: 'suggestion-job' }, s.label),
            h('span', { className: 'suggestion-text' }, s.text)
          )
        )
      ),
      h('p', { className: 'empty-privacy' }, h(Icon, { name: 'shield', size: 15 }), 'Names, emails, numbers and other personal details are hidden before anything leaves Gode. ', h('a', { href: '#/privacy' }, 'How it works'))
    );
  }

  function ModelPicker({ models, value, onChange, disabled }) {
    const id = useUid('model');
    return h(
      'div',
      { className: 'model-picker' },
      h('label', { htmlFor: id, className: 'sr-only' }, 'Model'),
      h(
        'select',
        { id, className: 'select select-sm', value: value || '', onChange: (e) => onChange(e.target.value), disabled },
        !models.length && h('option', { value: '' }, 'Loading models…'),
        models.map((m) => h('option', { key: m.id, value: m.id }, m.label + (m.zdr || m.self_hosted ? ' (zero retention)' : '')))
      ),
      h('a', { className: 'model-picker-link', href: '#/settings' }, 'Turn on auto-pick')
    );
  }

  function Composer({ value, onChange, onSubmit, onStop, streaming, inputRef, manual }) {
    useLayoutEffect(() => {
      const el = inputRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 240) + 'px';
    }, [value, inputRef]);
    const canSend = !streaming && value.trim().length > 0;
    const onKeyDown = (e) => {
      // Enter sends; Shift+Enter adds a newline; never send mid IME composition.
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (canSend) onSubmit();
      }
    };
    return h(
      'form',
      {
        className: 'composer',
        onSubmit: (e) => {
          e.preventDefault();
          if (canSend) onSubmit();
        },
      },
      h(
        'div',
        { className: cx('composer-box', streaming && 'is-streaming') },
        h('label', { htmlFor: 'composer-input', className: 'sr-only' }, 'Message Gode'),
        h('textarea', {
          id: 'composer-input',
          ref: inputRef,
          className: 'composer-input',
          rows: 1,
          value,
          maxLength: 50000,
          placeholder: streaming ? 'Gode is answering… you can type your next message.' : 'Message Gode',
          onChange: (e) => onChange(e.target.value),
          onKeyDown,
          'aria-describedby': 'composer-hint',
        }),
        h(
          'div',
          { className: 'composer-row' },
          manual,
          h('span', { id: 'composer-hint', className: 'composer-hint' }, streaming ? 'Answering…' : 'Enter to send · Shift+Enter for a new line'),
          streaming
            ? h('button', { type: 'button', className: 'send-btn is-stop', onClick: onStop, 'aria-label': 'Stop answering', title: 'Stop' }, h(Icon, { name: 'stop', size: 18 }))
            : h('button', { type: 'submit', className: 'send-btn', disabled: !canSend, 'aria-label': 'Send message', title: 'Send' }, h(Icon, { name: 'arrow-up', size: 18 }))
        )
      )
    );
  }

  function ChatView({ engine, threadKey, user, draft, setDraft }) {
    const thread = engine.threads[threadKey];
    const stream = engine.streams[threadKey];
    const draftMode = isDraftKey(threadKey);
    const scrollRef = useRef(null);
    const stickRef = useRef(true);
    const inputRef = useRef(null);
    const [models, setModels] = useState([]);
    const [modelId, setModelIdState] = useState(() => readLocal('gode.manualModel'));
    const notify = useToast();

    useEffect(() => {
      if (!draftMode && (!thread || (thread.status === 'error' && !thread.messages.length && thread.error.status !== 404))) engine.loadThread(threadKey);
      stickRef.current = true;
      if (inputRef.current && window.matchMedia('(min-width: 861px)').matches) inputRef.current.focus();
    }, [threadKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Manual mode: the composer offers a model select (chat candidates).
    useEffect(() => {
      if (user.auto_pick) return undefined;
      let alive = true;
      engine
        .fetchModels('chat', null)
        .then((list) => {
          if (!alive) return;
          setModels(list);
          setModelIdState((cur) => (list.some((m) => m.id === cur) ? cur : list[0] ? list[0].id : null));
        })
        .catch((e) => alive && notify(e.message, 'error'));
      return () => {
        alive = false;
      };
    }, [user.auto_pick]); // eslint-disable-line react-hooks/exhaustive-deps

    const setModelId = (id) => {
      setModelIdState(id);
      writeLocal('gode.manualModel', id);
    };

    const onScroll = () => {
      const el = scrollRef.current;
      if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    };
    useLayoutEffect(() => {
      const el = scrollRef.current;
      if (el && stickRef.current) el.scrollTop = el.scrollHeight;
    });

    const submit = () => {
      const text = draft.trim();
      if (!text || stream) return;
      if (!user.auto_pick && !modelId) {
        notify('Choose a model first, or turn on auto-pick in Settings.', 'error');
        return;
      }
      stickRef.current = true;
      engine.send(threadKey, text, user.auto_pick ? null : modelId);
      setDraft('');
    };

    const messages = thread ? thread.messages : [];
    const loading = !draftMode && (!thread || (thread.status === 'loading' && !messages.length));
    let body;
    if (loading) {
      body = h('div', { className: 'thread-loading', role: 'status', 'aria-label': 'Loading conversation' }, h('div', { className: 'skeleton skeleton-user' }), h('div', { className: 'skeleton skeleton-line' }), h('div', { className: 'skeleton skeleton-line short' }));
    } else if (thread && thread.status === 'error' && !messages.length) {
      body =
        thread.error.status === 404
          ? h(Notice, { tone: 'info', title: "This chat doesn't exist anymore", actions: h('a', { className: 'btn btn-secondary btn-sm', href: '#/' }, 'Start a new chat') }, 'It may have been deleted.')
          : h(LoadError, { error: thread.error, onRetry: () => engine.loadThread(threadKey) });
    } else if (!messages.length) {
      body = h(EmptyState, {
        user,
        onPick: (text) => {
          setDraft(text);
          if (inputRef.current) inputRef.current.focus();
        },
      });
    } else {
      body = messages.map((m) =>
        m.role === 'user'
          ? h(UserMessage, { key: m.key, msg: m })
          : h(AssistantMessage, { key: m.key, msg: m, busy: Boolean(stream), conversationId: draftMode ? null : threadKey, engine, threadKey })
      );
    }

    return h(
      'div',
      { className: 'chat' },
      h('div', { className: 'messages', ref: scrollRef, onScroll }, h('div', { className: cx('messages-inner', !messages.length && 'is-empty') }, body)),
      h(Composer, {
        value: draft,
        onChange: setDraft,
        onSubmit: submit,
        onStop: () => engine.stop(threadKey),
        streaming: Boolean(stream),
        inputRef,
        manual: user.auto_pick ? null : h(ModelPicker, { models, value: modelId, onChange: setModelId }),
      })
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------------------------

  function ConversationItem({ conv, active, streaming, onDelete }) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const title = conv.title || 'New chat';
    if (confirming) {
      return h(
        'li',
        { className: 'conv-item is-confirming' },
        h('span', { className: 'conv-confirm-text' }, 'Delete this chat?'),
        h(
          'span',
          { className: 'conv-confirm-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-danger btn-xs',
              disabled: busy,
              onClick: async () => {
                setBusy(true);
                const ok = await onDelete(conv);
                if (!ok) {
                  setBusy(false);
                  setConfirming(false);
                }
              },
            },
            busy ? 'Deleting…' : 'Delete'
          ),
          h('button', { type: 'button', className: 'btn btn-ghost btn-xs', autoFocus: true, onClick: () => setConfirming(false) }, 'Cancel')
        )
      );
    }
    return h(
      'li',
      { className: cx('conv-item', active && 'is-active') },
      h(
        'a',
        { className: 'conv-link', href: '#/c/' + encodeURIComponent(conv.id), 'aria-current': active ? 'page' : undefined, title },
        streaming ? h(Spinner, { size: 12 }) : h(Icon, { name: 'message', size: 15, className: 'conv-icon' }),
        h('span', { className: 'conv-title' }, title)
      ),
      h('button', { type: 'button', className: 'conv-delete', 'aria-label': 'Delete chat: ' + title, title: 'Delete chat', onClick: () => setConfirming(true) }, h(Icon, { name: 'trash', size: 15 }))
    );
  }

  function Sidebar({ user, config, convs, activeId, streams, page, open, onNewChat, onDelete, onLogout, onClose }) {
    const groups = useMemo(() => {
      const out = [];
      const nowMs = Date.now();
      convs.items.forEach((c) => {
        const g = dayGroup(c.updated_at, nowMs);
        let bucket = out.find((x) => x.label === g);
        if (!bucket) out.push((bucket = { label: g, items: [] }));
        bucket.items.push(c);
      });
      return out;
    }, [convs.items]);
    const balance = toNumber(user.balance_usd) ?? 0;
    const nav = (href, icon, label, current) =>
      h('a', { className: cx('nav-link', current && 'is-active'), href, 'aria-current': current ? 'page' : undefined }, h(Icon, { name: icon, size: 17 }), label);

    return h(
      'aside',
      { className: cx('sidebar', open && 'is-open'), 'aria-label': 'Chats and settings', id: 'sidebar' },
      h(
        'div',
        { className: 'sidebar-head' },
        h('a', { href: '#/', className: 'brand-link', 'aria-label': 'Gode home' }, h(Brand, { size: 28 })),
        h('button', { type: 'button', className: 'icon-btn sidebar-close', 'aria-label': 'Close menu', onClick: onClose }, h(Icon, { name: 'x', size: 18 }))
      ),
      h('div', { className: 'sidebar-new' }, h('button', { type: 'button', className: 'btn btn-primary btn-block', onClick: onNewChat }, h(Icon, { name: 'plus', size: 17 }), 'New chat')),
      h(
        'nav',
        { className: 'conv-nav', 'aria-label': 'Conversations' },
        convs.status === 'loading' && !convs.items.length && h('div', { className: 'conv-loading' }, h('div', { className: 'skeleton skeleton-line' }), h('div', { className: 'skeleton skeleton-line short' })),
        convs.status === 'error' && h('p', { className: 'conv-empty' }, "Couldn't load your chats."),
        convs.status === 'ready' && !convs.items.length && h('p', { className: 'conv-empty' }, 'Your chats will show up here.'),
        groups.map((g) =>
          h(
            'div',
            { className: 'conv-group', key: g.label },
            h('h2', { className: 'conv-group-label' }, g.label),
            h(
              'ul',
              { className: 'conv-list' },
              g.items.map((c) => h(ConversationItem, { key: c.id, conv: c, active: page === 'chat' && c.id === activeId, streaming: Boolean(streams[c.id]), onDelete }))
            )
          )
        )
      ),
      h(
        'div',
        { className: 'sidebar-foot' },
        h(
          'div',
          { className: cx('balance-card', balance < 0.05 && 'is-low') },
          h('div', { className: 'balance-text' }, h('span', { className: 'balance-label' }, 'Balance'), h('span', { className: 'balance-value' }, formatBalance(balance))),
          h('a', { className: 'btn btn-secondary btn-sm', href: '#/billing' }, 'Buy credits')
        ),
        config && config.mock && h('p', { className: 'mock-note' }, h(Icon, { name: 'info', size: 13 }), 'Demo mode: answers come from a built-in test model.'),
        h(
          'div',
          { className: 'nav-links' },
          nav('#/settings', 'sliders', 'Settings', page === 'settings'),
          user.is_admin && nav('#/admin', 'chart', 'Admin', page === 'admin'),
          nav('#/privacy', 'shield', 'Privacy', page === 'privacy'),
          h('button', { type: 'button', className: 'nav-link', onClick: onLogout }, h(Icon, { name: 'log-out', size: 17 }), 'Log out')
        ),
        h('p', { className: 'sidebar-user', title: user.email }, user.email)
      )
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------------------------

  function TransparencyLog() {
    const [state, setState] = useState({ status: 'loading', rows: [], error: null });
    const load = useCallback(async () => {
      setState((s) => Object.assign({}, s, { status: 'loading', error: null }));
      try {
        const data = await api('/api/transparency?limit=50');
        setState({ status: 'ready', rows: data.requests || [], error: null });
      } catch (e) {
        setState({ status: 'error', rows: [], error: e });
      }
    }, []);
    useEffect(() => {
      load();
    }, [load]);
    return h(
      'section',
      { className: 'card', 'aria-labelledby': 'log-title' },
      h(
        'div',
        { className: 'card-head' },
        h('div', null, h('h2', { id: 'log-title', className: 'card-title' }, 'Transparency log'), h('p', { className: 'card-sub' }, 'Every request you made: which model got it, where it ran, whether the provider keeps it, and what it cost. We never log the text itself.')),
        h('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: load, disabled: state.status === 'loading' }, h(Icon, { name: 'refresh', size: 15 }), 'Refresh')
      ),
      state.status === 'error'
        ? h(LoadError, { error: state.error, onRetry: load })
        : h(
            'div',
            { className: 'table-wrap' },
            h(
              'table',
              { className: 'table table-compact table-log' },
              // Cost sits next to the model so it stays in view when a narrow card scrolls the table.
              h('thead', null, h('tr', null, ['Time', 'Job', 'Model', 'Cost', 'Hidden details', 'Zero retention', 'Gateway / provider'].map((c) => h('th', { key: c, scope: 'col', className: c === 'Cost' ? 'num' : undefined }, c)))),
              h(
                'tbody',
                null,
                state.status === 'loading' && !state.rows.length && h(EmptyRow, { colSpan: 7 }, h(Spinner, { size: 14 }), ' Loading…'),
                state.status === 'ready' && !state.rows.length && h(EmptyRow, { colSpan: 7 }, 'No requests yet. Send a message and it shows up here.'),
                state.rows.map((r) => {
                  const hidden = countRedactions(r.redactions);
                  return h(
                    'tr',
                    { key: r.id, className: r.status === 'error' ? 'is-error' : undefined },
                    h('td', { className: 'nowrap' }, formatDateTime(r.created_at)),
                    h('td', null, JOB_LABEL[r.job] || r.job || '—', r.private ? h('span', { className: 'tag tag-private' }, 'private') : null),
                    h('td', { className: 'nowrap' }, r.model_label || '—', r.status === 'error' ? h('span', { className: 'tag tag-error' }, 'failed') : null),
                    h('td', { className: 'num' }, formatPrecise(r.cost_usd)),
                    h('td', null, hidden ? String(hidden) : h('span', { className: 'muted' }, '0')),
                    h('td', null, r.zdr ? h('span', { className: 'yes' }, h(Icon, { name: 'lock', size: 13 }), 'Yes') : h('span', { className: 'muted' }, 'No')),
                    h('td', null, [r.gateway, r.upstream_provider].filter(Boolean).join(' → ') || '—')
                  );
                })
              )
            )
          )
    );
  }

  function DeleteEverything({ onDeleted }) {
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const submit = async (e) => {
      e.preventDefault();
      if (!password) {
        setError('Enter your password to confirm.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        // A wrong password must show here, not sign the user out: no global 401 redirect.
        await api('/api/me', { method: 'DELETE', body: { password }, redirectOn401: false });
        onDeleted();
      } catch (err) {
        setBusy(false);
        setError(err.status === 401 || err.status === 403 ? err.message && err.message !== 'Please sign in.' ? err.message : 'That password is not right.' : err.message);
      }
    };
    return h(
      'section',
      { className: 'card card-danger', 'aria-labelledby': 'danger-title' },
      h('h2', { id: 'danger-title', className: 'card-title' }, 'Delete everything'),
      h('p', { className: 'card-sub' }, 'Permanently deletes your account, every chat, your settings and your request history. Your remaining credit is forfeited. This cannot be undone.'),
      !open
        ? h('button', { type: 'button', className: 'btn btn-danger-outline', onClick: () => setOpen(true) }, h(Icon, { name: 'trash', size: 16 }), 'Delete my account and data')
        : h(
            'form',
            { className: 'danger-form', onSubmit: submit, noValidate: true },
            h('label', { htmlFor: 'delete-password', className: 'field-label' }, 'Type your password to confirm'),
            h(
              'div',
              { className: 'danger-row' },
              h('input', {
                id: 'delete-password',
                type: 'password',
                className: cx('input', error && 'is-invalid'),
                autoComplete: 'current-password',
                value: password,
                autoFocus: true,
                onChange: (e) => setPassword(e.target.value),
                'aria-invalid': Boolean(error),
                'aria-describedby': error ? 'delete-error' : undefined,
              }),
              h('button', { type: 'submit', className: 'btn btn-danger', disabled: busy }, busy ? 'Deleting…' : 'Delete everything'),
              h(
                'button',
                {
                  type: 'button',
                  className: 'btn btn-ghost',
                  onClick: () => {
                    setOpen(false);
                    setPassword('');
                    setError(null);
                  },
                },
                'Cancel'
              )
            ),
            error && h('p', { id: 'delete-error', className: 'field-error', role: 'alert' }, error)
          )
    );
  }

  function SettingsView({ user, setUser, onDeleted }) {
    const notify = useToast();
    const update = async (patch) => {
      const before = {};
      Object.keys(patch).forEach((k) => (before[k] = user[k]));
      setUser(patch); // optimistic; reverted below if the server says no
      try {
        const data = await api('/api/me', { method: 'PATCH', body: patch });
        if (data.user) setUser(data.user);
        notify('Saved');
      } catch (e) {
        setUser(before);
        notify(e.message || "Couldn't save that setting.", 'error');
      }
    };
    return h(
      'div',
      { className: 'page' },
      h(
        'div',
        { className: 'page-inner' },
        h('header', { className: 'page-head' }, h('h1', null, 'Settings'), h('p', null, 'Choose how Gode picks models for you and how strictly it guards your privacy.')),
        h(
          'section',
          { className: 'card', 'aria-labelledby': 'plan-title' },
          h('h2', { id: 'plan-title', className: 'card-title' }, 'Plan'),
          h('p', { className: 'card-sub' }, 'Your plan decides which column of the routing table Gode uses. You only ever pay for what each answer costs.'),
          h(
            'div',
            { className: 'plan-grid', role: 'radiogroup', 'aria-labelledby': 'plan-title' },
            PLANS.map((p) =>
              h(
                'label',
                { key: p.id, className: cx('plan-card', user.plan === p.id && 'is-selected') },
                h('input', { type: 'radio', name: 'plan', value: p.id, checked: user.plan === p.id, onChange: () => update({ plan: p.id }), className: 'plan-radio' }),
                h('span', { className: 'plan-name' }, p.name, p.id === 'balanced' && h('span', { className: 'tag' }, 'Recommended')),
                h('span', { className: 'plan-blurb' }, p.blurb)
              )
            )
          ),
          h(Toggle, {
            id: 'auto-pick',
            label: 'Auto-pick the best model',
            description: 'Gode reads each request and picks the model for the job. Turn off to choose the model yourself.',
            checked: Boolean(user.auto_pick),
            onChange: (v) => update({ auto_pick: v }),
          })
        ),
        h(
          'section',
          { className: 'card', 'aria-labelledby': 'privacy-title' },
          h('h2', { id: 'privacy-title', className: 'card-title' }, 'Privacy'),
          h('p', { className: 'card-sub' }, 'Personal details are always hidden before a request leaves Gode. These options go further. ', h('a', { href: '#/privacy' }, 'Read our privacy promise')),
          h(Toggle, {
            id: 'strict-privacy',
            label: 'Strict privacy',
            description: 'Only use models whose provider keeps nothing (zero data retention) or that run on our own servers. Some jobs may have fewer models.',
            checked: Boolean(user.strict_privacy),
            onChange: (v) => update({ strict_privacy: v }),
          }),
          h(Toggle, {
            id: 'eu-only',
            label: 'EU-only text models',
            description: 'Chat and code requests only go to models hosted in the European Union or on our servers.',
            checked: Boolean(user.eu_only),
            onChange: (v) => update({ eu_only: v }),
          }),
          h(Toggle, {
            id: 'share-prompts',
            label: 'Share prompts to improve the router',
            description: 'Off by default. When on, your prompts, with personal details removed, may be used to test which models answer best. Your answers and account are never shared.',
            checked: Boolean(user.share_prompts),
            onChange: (v) => update({ share_prompts: v }),
          })
        ),
        h(TransparencyLog),
        h(DeleteEverything, { onDeleted })
      )
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Billing
  // ---------------------------------------------------------------------------------------------

  function BillingView({ user, config, setUser, route }) {
    const notify = useToast();
    const [ledger, setLedger] = useState({ status: 'loading', entries: [], error: null });
    const [buying, setBuying] = useState(null);
    const [buyError, setBuyError] = useState(null);
    const [topup, setTopup] = useState('5');
    const [topupState, setTopupState] = useState({ busy: false, error: null });
    const paidParam = route.params.get('paid') === '1' || new URLSearchParams(window.location.search).get('paid') === '1';
    const [paid, setPaid] = useState(paidParam);

    const load = useCallback(async () => {
      try {
        const data = await api('/api/billing/ledger');
        setLedger({ status: 'ready', entries: data.entries || [], error: null });
        if (toNumber(data.balance_usd) !== null) setUser({ balance_usd: data.balance_usd });
        return data;
      } catch (e) {
        setLedger((l) => Object.assign({}, l, { status: 'error', error: e }));
        return null;
      }
    }, [setUser]);

    useEffect(() => {
      load();
    }, [load]);

    // Back from Stripe: the webhook may land a moment after the redirect, so look again briefly.
    useEffect(() => {
      if (!paidParam) return undefined;
      setPaid(true);
      let tries = 0;
      const t = window.setInterval(() => {
        tries += 1;
        load();
        if (tries >= 5) window.clearInterval(t);
      }, 2000);
      return () => window.clearInterval(t);
    }, [paidParam, load]);

    const buy = async (pack) => {
      setBuying(pack);
      setBuyError(null);
      try {
        const data = await api('/api/billing/checkout', { method: 'POST', body: { pack_usd: pack } });
        // Only ever navigate to an http(s) URL (Stripe in production, a local stub in tests).
        if (!data.url || !/^https?:\/\//i.test(data.url)) throw new Error('Checkout is not available right now.');
        window.location.assign(data.url);
      } catch (e) {
        setBuying(null);
        setBuyError(e.message);
      }
    };

    const devTopup = async (e) => {
      e.preventDefault();
      const usd = Number(topup);
      // Same bounds as the server (POST /api/billing/dev-topup accepts up to $100).
      if (!Number.isFinite(usd) || usd <= 0 || usd > 100) {
        setTopupState({ busy: false, error: 'Enter an amount between $0.01 and $100.' });
        return;
      }
      setTopupState({ busy: true, error: null });
      try {
        const data = await api('/api/billing/dev-topup', { method: 'POST', body: { usd } });
        if (toNumber(data.balance_usd) !== null) setUser({ balance_usd: data.balance_usd });
        setTopupState({ busy: false, error: null });
        notify('Added ' + formatMoney(usd) + ' of test credit');
        load();
      } catch (err) {
        setTopupState({ busy: false, error: err.message });
      }
    };

    const margin = toNumber(config && config.margin) ?? 0;
    const marginPct = Math.round(margin * 100);
    const packs = (config && Array.isArray(config.packs_usd) && config.packs_usd.length ? config.packs_usd : [5, 10, 25]).filter((p) => toNumber(p) > 0);
    const stripeOn = Boolean(config && config.stripe_enabled);
    const example = 0.1;

    return h(
      'div',
      { className: 'page' },
      h(
        'div',
        { className: 'page-inner' },
        h('header', { className: 'page-head' }, h('h1', null, 'Billing'), h('p', null, 'Prepaid credits. No subscription, no surprises.')),
        paid &&
          h(
            Notice,
            {
              tone: 'success',
              title: 'Payment received. Thank you!',
              role: 'status',
              actions: h(
                'button',
                {
                  type: 'button',
                  className: 'btn btn-ghost btn-sm',
                  onClick: () => {
                    setPaid(false);
                    navigate('#/billing', { replace: true });
                  },
                },
                'Dismiss'
              ),
            },
            'Your credits are added as soon as the payment is confirmed, usually within a few seconds.'
          ),
        h(
          'section',
          { className: 'card balance-hero' },
          h('div', null, h('span', { className: 'balance-hero-label' }, 'Your balance'), h('span', { className: 'balance-hero-value' }, formatBalance(user.balance_usd))),
          h('p', { className: 'balance-hero-note' }, 'Every answer shows exactly what it cost on its chip.')
        ),
        h(
          'section',
          { className: 'card', 'aria-labelledby': 'packs-title' },
          h('h2', { id: 'packs-title', className: 'card-title' }, 'Buy credits'),
          h(
            'p',
            { className: 'card-sub' },
            'Credits are charged at API cost + margin',
            marginPct ? ' (' + marginPct + '%)' : '',
            '. If the AI provider charges us ',
            formatMoney(example),
            ' for your request, you pay ',
            formatMoney(example * (1 + margin)),
            '. Credits never expire.'
          ),
          h(
            'div',
            { className: 'pack-grid' },
            packs.map((p) =>
              h(
                'button',
                { key: p, type: 'button', className: 'pack', disabled: !stripeOn || buying !== null, onClick: () => buy(Number(p)) },
                h('span', { className: 'pack-amount' }, Number.isInteger(Number(p)) ? '$' + Number(p) : formatMoney(p)),
                h('span', { className: 'pack-sub' }, buying === Number(p) ? 'Opening checkout…' : 'of credits'),
                h('span', { className: 'pack-cta' }, buying === Number(p) ? h(Spinner, { size: 14 }) : h(Icon, { name: 'arrow', size: 16 }))
              )
            )
          ),
          !stripeOn && h('p', { className: 'muted small' }, 'Card payments are not set up on this server yet.'),
          stripeOn && h('p', { className: 'muted small' }, 'You pay securely on Stripe. Gode never sees your card number.'),
          buyError && h('p', { className: 'field-error', role: 'alert' }, buyError)
        ),
        config &&
          config.dev_topup &&
          h(
            'section',
            { className: 'card card-dev', 'aria-labelledby': 'dev-title' },
            h('h2', { id: 'dev-title', className: 'card-title' }, 'Developer top-up'),
            h('p', { className: 'card-sub' }, 'Test mode only: adds free credit without a payment. Disabled in production.'),
            h(
              'form',
              { className: 'inline-form', onSubmit: devTopup, noValidate: true },
              h('label', { htmlFor: 'topup', className: 'sr-only' }, 'Amount in US dollars'),
              h('span', { className: 'input-prefix' }, '$', h('input', { id: 'topup', className: 'input', type: 'number', min: '0.01', max: '100', step: '0.01', inputMode: 'decimal', value: topup, onChange: (e) => setTopup(e.target.value), 'aria-invalid': Boolean(topupState.error) })),
              h('button', { type: 'submit', className: 'btn btn-secondary', disabled: topupState.busy }, topupState.busy ? 'Adding…' : 'Add test credit')
            ),
            topupState.error && h('p', { className: 'field-error', role: 'alert' }, topupState.error)
          ),
        h(
          'section',
          { className: 'card', 'aria-labelledby': 'ledger-title' },
          h('h2', { id: 'ledger-title', className: 'card-title' }, 'History'),
          ledger.status === 'error'
            ? h(LoadError, { error: ledger.error, onRetry: load })
            : h(
                'div',
                { className: 'table-wrap' },
                h(
                  'table',
                  { className: 'table' },
                  h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Date'), h('th', { scope: 'col' }, 'What'), h('th', { scope: 'col', className: 'num' }, 'Amount'))),
                  h(
                    'tbody',
                    null,
                    ledger.status === 'loading' && h(EmptyRow, { colSpan: 3 }, h(Spinner, { size: 14 }), ' Loading…'),
                    ledger.status === 'ready' && !ledger.entries.length && h(EmptyRow, { colSpan: 3 }, 'Nothing here yet.'),
                    ledger.entries.map((e, i) =>
                      h(
                        'tr',
                        { key: i },
                        h('td', { className: 'nowrap' }, formatDateTime(e.created_at)),
                        h('td', null, LEDGER_LABEL[e.kind] || e.kind),
                        h('td', { className: cx('num', toNumber(e.delta_usd) > 0 && 'pos') }, signedAmount(e.delta_usd))
                      )
                    )
                  )
                )
              )
        )
      )
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------------

  function StatCard({ label, value, hint, tone }) {
    return h('div', { className: cx('stat-card', tone && 'is-' + tone) }, h('span', { className: 'stat-label' }, label), h('span', { className: 'stat-value' }, value), hint && h('span', { className: 'stat-hint' }, hint));
  }

  function AdminOverview({ labels }) {
    const [days, setDays] = useState(28);
    const [state, setState] = useState({ status: 'loading', gate: null, models: [], error: null });
    const load = useCallback(async () => {
      setState((s) => Object.assign({}, s, { status: 'loading', error: null }));
      try {
        const data = await api('/api/admin/stats?days=' + days);
        setState({ status: 'ready', gate: data.gate || {}, models: data.models || [], error: null });
      } catch (e) {
        setState({ status: 'error', gate: null, models: [], error: e });
      }
    }, [days]);
    useEffect(() => {
      load();
    }, [load]);
    const g = state.gate || {};
    const rows = useMemo(() => [...state.models].sort((a, b) => JOBS.indexOf(a.job) - JOBS.indexOf(b.job) || b.n - a.n), [state.models]);
    return h(
      Fragment,
      null,
      h(
        'div',
        { className: 'section-bar' },
        h('h2', { className: 'section-title' }, 'Gate metrics'),
        h(
          'div',
          { className: 'segmented', role: 'group', 'aria-label': 'Time window' },
          [7, 28, 90].map((d) => h('button', { key: d, type: 'button', className: cx('seg', days === d && 'is-active'), 'aria-pressed': days === d, onClick: () => setDays(d) }, d + ' days'))
        )
      ),
      state.status === 'error'
        ? h(LoadError, { error: state.error, onRetry: load })
        : h(
            'div',
            { className: cx('stat-grid', state.status === 'loading' && 'is-loading') },
            h(StatCard, { label: 'Auto-pick on', value: formatPct(g.auto_pick_on_pct), hint: (g.users ?? 0) + ' active user' + (g.users === 1 ? '' : 's') }),
            h(StatCard, { label: 'Override rate', value: formatRate(g.override_rate), hint: 'Auto-picked answers switched to another model' }),
            h(StatCard, { label: 'Gross margin', value: formatPct(g.gross_margin_pct), hint: 'Charged minus API cost', tone: g.credits_cover_api_costs === false ? 'bad' : null }),
            h(StatCard, { label: 'Thumbs-up rate', value: formatRate(g.thumbs_up_rate), hint: 'Of answers that were rated' }),
            h(StatCard, { label: 'Requests', value: (g.requests ?? 0).toLocaleString(), hint: 'Last ' + days + ' days' }),
            h(StatCard, {
              label: 'API cost vs charged',
              value: formatPrecise(g.api_cost_usd) + ' → ' + formatPrecise(g.charged_usd),
              hint: g.credits_cover_api_costs === false ? 'Charged less than the API cost!' : 'What providers billed us, then what users paid',
              tone: g.credits_cover_api_costs === false ? 'bad' : null,
            })
          ),
      h('h2', { className: 'section-title' }, 'Per-model results'),
      h(
        'div',
        { className: 'table-wrap' },
        h(
          'table',
          { className: 'table table-compact' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              ['Job', 'Model', 'Answers', 'Up', 'Down', 'Regenerated', 'Switched away', 'Avg cost', 'Avg latency', 'Score'].map((c, i) => h('th', { key: c, scope: 'col', className: i >= 2 ? 'num' : undefined }, c))
            )
          ),
          h(
            'tbody',
            null,
            state.status === 'ready' && !rows.length && h(EmptyRow, { colSpan: 10 }, 'No answers in this window yet.'),
            rows.map((r) =>
              h(
                'tr',
                { key: r.job + '|' + r.model_id },
                h('td', null, JOB_LABEL[r.job] || r.job),
                h('td', null, labels[r.model_id] || r.model_id),
                h('td', { className: 'num' }, r.n),
                h('td', { className: 'num' }, r.up),
                h('td', { className: 'num' }, r.down),
                h('td', { className: 'num' }, r.regenerated),
                h('td', { className: 'num' }, r.overridden),
                h('td', { className: 'num' }, formatPrecise((toNumber(r.avg_cost_micros) ?? 0) / 1e6)),
                h('td', { className: 'num' }, toNumber(r.avg_latency_ms) === null ? '—' : (r.avg_latency_ms / 1000).toFixed(1) + ' s'),
                h('td', { className: 'num' }, h('span', { className: 'score' }, h('span', { className: 'score-bar', style: { width: Math.max(2, Math.round((toNumber(r.score) ?? 0) * 48)) + 'px' } }), (toNumber(r.score) ?? 0).toFixed(2)))
              )
            )
          )
        )
      )
    );
  }

  function modelOptionLabel(m) {
    return m.label + (m.self_hosted ? ' · self-hosted' : m.zdr ? ' · ZDR' : '') + (m.enabled === false ? ' (disabled)' : '');
  }

  function RouteCell({ job, tier, route, models, onSaved }) {
    const [status, setStatus] = useState({ s: 'idle', msg: null });
    const options = useMemo(() => {
      const list = models.filter((m) => (m.jobs || []).includes(job));
      if (route && !list.some((m) => m.id === route.model_id)) list.unshift(models.find((m) => m.id === route.model_id) || { id: route.model_id, label: route.model_id });
      return list;
    }, [models, job, route]);
    useEffect(() => {
      if (status.s !== 'saved') return undefined;
      const t = window.setTimeout(() => setStatus({ s: 'idle', msg: null }), 1800);
      return () => window.clearTimeout(t);
    }, [status.s]);
    const save = async (next) => {
      setStatus({ s: 'saving', msg: null });
      try {
        await api('/api/admin/routes/' + encodeURIComponent(job) + '/' + encodeURIComponent(tier), { method: 'PUT', body: next });
        setStatus({ s: 'saved', msg: null });
        onSaved(Object.assign({ job, tier, source: 'admin' }, next));
      } catch (e) {
        setStatus({ s: 'error', msg: e.message });
      }
    };
    const modelId = route ? route.model_id : '';
    const effort = route && route.effort_override ? route.effort_override : '';
    const label = JOB_LABEL[job] + ' ' + TIER_LABEL[tier];
    return h(
      'td',
      { className: cx('route-cell', status.s === 'error' && 'is-error') },
      h(
        'select',
        {
          className: 'select select-sm',
          'aria-label': label + ' model',
          value: modelId,
          disabled: status.s === 'saving',
          onChange: (e) => save({ model_id: e.target.value, effort_override: effort || null }),
        },
        !modelId && h('option', { value: '' }, 'Choose a model'),
        options.map((m) => h('option', { key: m.id, value: m.id }, modelOptionLabel(m)))
      ),
      !MEDIA_JOBS.has(job) &&
        h(
          'select',
          {
            className: 'select select-sm select-effort',
            'aria-label': label + ' effort override',
            value: effort,
            disabled: status.s === 'saving' || !modelId,
            onChange: (e) => save({ model_id: modelId, effort_override: e.target.value || null }),
          },
          h('option', { value: '' }, 'Effort: by difficulty'),
          EFFORTS.map((ef) => h('option', { key: ef, value: ef }, 'Effort: ' + ef))
        ),
      h(
        'span',
        { className: 'route-status', 'aria-live': 'polite' },
        status.s === 'saving' && h(Fragment, null, h(Spinner, { size: 11 }), ' Saving'),
        status.s === 'saved' && h(Fragment, null, h(Icon, { name: 'check', size: 12 }), ' Saved'),
        status.s === 'error' && status.msg,
        status.s === 'idle' && route && route.source && h('span', { className: 'muted' }, route.source)
      )
    );
  }

  function RoutingGrid({ models, routes, onSaved }) {
    const byKey = useMemo(() => {
      const map = {};
      routes.forEach((r) => (map[r.job + '/' + r.tier] = r));
      return map;
    }, [routes]);
    return h(
      'div',
      { className: 'table-wrap' },
      h(
        'table',
        { className: 'table table-grid' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Job'), TIERS.map((t) => h('th', { key: t, scope: 'col' }, TIER_LABEL[t])))),
        h(
          'tbody',
          null,
          JOBS.map((job) =>
            h(
              'tr',
              { key: job },
              h('th', { scope: 'row' }, h('span', { className: 'job-name' }, JOB_LABEL[job]), h('span', { className: 'job-kind' }, job === 'action' ? 'routes as chat' : MEDIA_JOBS.has(job) ? 'media' : 'text')),
              TIERS.map((tier) => h(RouteCell, { key: tier, job, tier, route: byKey[job + '/' + tier], models, onSaved }))
            )
          )
        )
      )
    );
  }

  function LearnPanel({ labels, onApplied }) {
    const notify = useToast();
    const [state, setState] = useState({ s: 'idle', proposals: [], applied: null, error: null });
    const run = async (apply) => {
      setState((st) => Object.assign({}, st, { s: apply ? 'applying' : 'running', error: null }));
      try {
        const data = await api('/api/admin/learn', { method: 'POST', body: { apply } });
        const proposals = data.proposals || [];
        setState({ s: 'done', proposals, applied: apply ? Number(data.applied) || 0 : null, error: null });
        if (apply) {
          notify('Applied ' + (Number(data.applied) || 0) + ' route change' + (Number(data.applied) === 1 ? '' : 's'));
          onApplied();
        }
      } catch (e) {
        setState((st) => Object.assign({}, st, { s: 'error', error: e }));
      }
    };
    const busy = state.s === 'running' || state.s === 'applying';
    const score = (v) => (toNumber(v) === null ? '—' : Number(v).toFixed(2));
    return h(
      'section',
      { className: 'card', 'aria-labelledby': 'learn-title' },
      h(
        'div',
        { className: 'card-head' },
        h(
          'div',
          null,
          h('h2', { id: 'learn-title', className: 'card-title' }, 'Learner'),
          h('p', { className: 'card-sub' }, 'Reads thumbs, regenerations and switches from the last 28 days and proposes better picks. Nothing changes until you apply. The private tier is never touched.')
        ),
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: () => run(false), disabled: busy }, state.s === 'running' ? h(Spinner, { size: 14 }) : h(Icon, { name: 'sparkle', size: 16 }), 'Run learner')
      ),
      state.error && h(LoadError, { error: state.error }),
      state.s === 'done' &&
        state.applied === null &&
        (state.proposals.length
          ? h(
              Fragment,
              null,
              h(
                'div',
                { className: 'table-wrap' },
                h(
                  'table',
                  { className: 'table table-compact' },
                  h('thead', null, h('tr', null, ['Job', 'Tier', 'Current', 'Proposed', 'Score', 'Why'].map((c) => h('th', { key: c, scope: 'col' }, c)))),
                  h(
                    'tbody',
                    null,
                    state.proposals.map((p, i) =>
                      h(
                        'tr',
                        { key: i },
                        h('td', null, JOB_LABEL[p.job] || p.job),
                        h('td', null, TIER_LABEL[p.tier] || p.tier),
                        h('td', null, labels[p.current_model_id] || p.current_model_id || '—'),
                        h('td', null, h('strong', null, labels[p.proposed_model_id] || p.proposed_model_id)),
                        h('td', { className: 'nowrap num' }, score(p.current_score) + ' → ' + score(p.proposed_score)),
                        h('td', { className: 'reason' }, p.reason)
                      )
                    )
                  )
                )
              ),
              h(
                'div',
                { className: 'card-actions' },
                h('button', { type: 'button', className: 'btn btn-primary', onClick: () => run(true), disabled: busy }, state.s === 'applying' ? 'Applying…' : 'Apply ' + state.proposals.length + ' change' + (state.proposals.length === 1 ? '' : 's'))
              )
            )
          : h(Notice, { tone: 'info', title: 'No changes proposed' }, 'Either the current picks are the best, or there is not enough feedback yet.')),
      state.s === 'done' && state.applied !== null && h(Notice, { tone: 'success', title: 'Routing table updated' }, 'Applied ' + state.applied + ' change' + (state.applied === 1 ? '' : 's') + '. Every change is recorded in the route history.')
    );
  }

  function numStr(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  function ModelRow({ model, onSaved }) {
    const media = Boolean(model.price_unit);
    const initial = useMemo(
      () => ({ price_in: numStr(model.price_in), price_out: numStr(model.price_out), price_per_unit: numStr(model.price_per_unit), zdr: Boolean(model.zdr), enabled: model.enabled !== false }),
      [model]
    );
    const [form, setForm] = useState(initial);
    const [status, setStatus] = useState({ s: 'idle', msg: null });
    useEffect(() => setForm(initial), [initial]);
    const changed = Object.keys(initial).filter((k) => form[k] !== initial[k]);
    const set = (k) => (e) => setForm(Object.assign({}, form, { [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

    const save = async () => {
      const patch = {};
      for (const k of changed) {
        if (k === 'zdr' || k === 'enabled') patch[k] = form[k];
        else {
          const n = form[k] === '' ? null : Number(form[k]);
          if (n !== null && (!Number.isFinite(n) || n < 0)) {
            setStatus({ s: 'error', msg: 'Prices must be zero or more.' });
            return;
          }
          patch[k] = n;
        }
      }
      setStatus({ s: 'saving', msg: null });
      try {
        await api('/api/admin/models/' + encodeURIComponent(model.id), { method: 'PUT', body: patch });
        setStatus({ s: 'saved', msg: null });
        onSaved(model.id, patch);
      } catch (e) {
        setStatus({ s: 'error', msg: e.message });
      }
    };

    const priceInput = (k, label) =>
      h('input', { className: 'input input-sm input-num', type: 'number', min: '0', step: 'any', inputMode: 'decimal', value: form[k], onChange: set(k), 'aria-label': model.label + ' ' + label });
    // The server bills a missing price as $0, so an enabled model without one gives answers away.
    const unpriced = initial.enabled && (media ? initial.price_per_unit === '' : initial.price_in === '' || initial.price_out === '');

    return h(
      'tr',
      { className: cx(!form.enabled && 'is-disabled', status.s === 'error' && 'is-error') },
      h('td', null, h('span', { className: 'model-name' }, model.label), h('span', { className: 'model-id' }, model.id)),
      h('td', { className: 'nowrap' }, h('span', { className: 'muted' }, [model.vendor, REGION_SHORT[model.region] || model.region].filter(Boolean).join(' · '))),
      h('td', null, (model.jobs || []).map((j) => h('span', { key: j, className: 'tag' }, j))),
      h(
        'td',
        { className: 'price-cell' },
        media
          ? h('span', { className: 'price-edit' }, '$', priceInput('price_per_unit', 'price per ' + model.price_unit), h('span', { className: 'muted' }, '/ ' + (UNIT_LABEL[model.price_unit] || model.price_unit)))
          : h('span', { className: 'price-edit' }, '$', priceInput('price_in', 'input price'), '/', priceInput('price_out', 'output price'), h('span', { className: 'muted' }, 'per 1M')),
        unpriced && h('span', { className: 'tag tag-warn', title: 'Enabled with no price: its usage is billed as $0.' }, 'No price')
      ),
      h('td', { className: 'center' }, h('input', { type: 'checkbox', className: 'checkbox', checked: form.zdr, onChange: set('zdr'), 'aria-label': model.label + ' zero data retention' })),
      h('td', { className: 'center' }, h('input', { type: 'checkbox', className: 'checkbox', checked: form.enabled, onChange: set('enabled'), 'aria-label': model.label + ' enabled' })),
      h(
        'td',
        { className: 'nowrap' },
        h('button', { type: 'button', className: 'btn btn-secondary btn-xs', disabled: !changed.length || status.s === 'saving', onClick: save }, status.s === 'saving' ? 'Saving…' : 'Save'),
        status.s === 'saved' && !changed.length && h('span', { className: 'row-status ok' }, h(Icon, { name: 'check', size: 12 }), ' Saved'),
        status.s === 'error' && h('span', { className: 'row-status bad', role: 'alert' }, status.msg)
      )
    );
  }

  function ModelCatalog({ models, onSaved }) {
    const [query, setQuery] = useState('');
    const [job, setJob] = useState('');
    const visible = useMemo(() => {
      const q = query.trim().toLowerCase();
      return models.filter((m) => (!job || (m.jobs || []).includes(job)) && (!q || (m.label + ' ' + m.id + ' ' + (m.vendor || '')).toLowerCase().includes(q)));
    }, [models, query, job]);
    return h(
      'section',
      { 'aria-labelledby': 'catalog-title' },
      h(
        'div',
        { className: 'section-bar' },
        h('h2', { id: 'catalog-title', className: 'section-title' }, 'Model catalog ', h('span', { className: 'muted' }, '(' + models.length + ')')),
        h(
          'div',
          { className: 'filters' },
          h('input', { className: 'input input-sm', type: 'search', placeholder: 'Search models', value: query, onChange: (e) => setQuery(e.target.value), 'aria-label': 'Search models' }),
          h('select', { className: 'select select-sm', value: job, onChange: (e) => setJob(e.target.value), 'aria-label': 'Filter by job' }, h('option', { value: '' }, 'All jobs'), JOBS.map((j) => h('option', { key: j, value: j }, JOB_LABEL[j])))
        )
      ),
      h('p', { className: 'muted small' }, 'Prices are what we pay the provider; the margin is added at billing time. Text prices are USD per 1M input / output tokens.'),
      h(
        'div',
        { className: 'table-wrap' },
        h(
          'table',
          { className: 'table table-compact' },
          h('thead', null, h('tr', null, ['Model', 'Vendor', 'Jobs', 'Price', 'ZDR', 'Enabled', ''].map((c, i) => h('th', { key: i, scope: 'col', className: c === 'ZDR' || c === 'Enabled' ? 'center' : undefined }, c)))),
          h('tbody', null, !visible.length && h(EmptyRow, { colSpan: 7 }, 'No models match.'), visible.map((m) => h(ModelRow, { key: m.id, model: m, onSaved })))
        )
      )
    );
  }

  function CatalogIO({ onImported }) {
    const notify = useToast();
    const [pending, setPending] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);

    const doExport = async () => {
      setError(null);
      try {
        const data = await api('/api/admin/catalog/export');
        const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gode-catalog-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        setError(e.message);
      }
    };

    const onFile = async (e) => {
      setError(null);
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setError('That file is too large for a catalog (over 2 MB).');
        return;
      }
      const data = safeJsonParse(await file.text(), null);
      if (!data || !Array.isArray(data.models) || !Array.isArray(data.routes)) {
        setError('Not a catalog file: expected JSON with "models" and "routes" arrays.');
        return;
      }
      setPending({ name: file.name, models: data.models, routes: data.routes });
    };

    const doImport = async () => {
      setBusy(true);
      try {
        await api('/api/admin/catalog/import', { method: 'POST', body: { models: pending.models, routes: pending.routes } });
        notify('Catalog imported');
        setPending(null);
        onImported();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    };

    return h(
      'section',
      { className: 'card', 'aria-labelledby': 'io-title' },
      h('h2', { id: 'io-title', className: 'card-title' }, 'Import and export'),
      h('p', { className: 'card-sub' }, 'The catalog and routing table as one JSON file. Importing updates models with the same id and records every route change in the history.'),
      h(
        'div',
        { className: 'card-actions' },
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: doExport }, h(Icon, { name: 'download', size: 16 }), 'Export JSON'),
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: () => fileRef.current && fileRef.current.click() }, h(Icon, { name: 'upload', size: 16 }), 'Import JSON'),
        h('input', { ref: fileRef, type: 'file', accept: 'application/json,.json', className: 'sr-only', tabIndex: -1, 'aria-hidden': 'true', onChange: onFile })
      ),
      pending &&
        h(
          Notice,
          {
            tone: 'warn',
            title: 'Import ' + pending.name + '?',
            actions: [
              h('button', { key: 'go', type: 'button', className: 'btn btn-primary btn-sm', onClick: doImport, disabled: busy }, busy ? 'Importing…' : 'Import'),
              h('button', { key: 'no', type: 'button', className: 'btn btn-ghost btn-sm', onClick: () => setPending(null), disabled: busy }, 'Cancel'),
            ],
          },
          pending.models.length + ' models and ' + pending.routes.length + ' routes will be written to the live catalog.'
        ),
      error && h('p', { className: 'field-error', role: 'alert' }, error)
    );
  }

  const ADMIN_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'routing', label: 'Routing' },
    { id: 'catalog', label: 'Catalog' },
  ];

  function AdminView() {
    const [tab, setTabState] = useState(() => (ADMIN_TABS.some((t) => t.id === readLocal('gode.adminTab')) ? readLocal('gode.adminTab') : 'overview'));
    const [catalog, setCatalog] = useState({ status: 'loading', models: [], routes: [], classifier: null, error: null });
    const load = useCallback(async () => {
      try {
        const data = await api('/api/admin/routing');
        setCatalog({ status: 'ready', models: data.models || [], routes: data.routes || [], classifier: data.classifier_model_id || null, error: null });
      } catch (e) {
        setCatalog((c) => Object.assign({}, c, { status: 'error', error: e }));
      }
    }, []);
    useEffect(() => {
      load();
    }, [load]);
    const setTab = (id) => {
      setTabState(id);
      writeLocal('gode.adminTab', id);
    };
    const onTabKey = (e) => {
      const i = ADMIN_TABS.findIndex((t) => t.id === tab);
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = ADMIN_TABS[(i + step + ADMIN_TABS.length) % ADMIN_TABS.length].id;
      setTab(next);
      const el = document.getElementById('tab-' + next);
      if (el) el.focus();
    };
    const labels = useMemo(() => {
      const map = {};
      catalog.models.forEach((m) => (map[m.id] = m.label));
      return map;
    }, [catalog.models]);
    const onRouteSaved = (r) =>
      setCatalog((c) => {
        const routes = c.routes.filter((x) => !(x.job === r.job && x.tier === r.tier)).concat(r);
        return Object.assign({}, c, { routes });
      });
    const onModelSaved = (id, patch) => setCatalog((c) => Object.assign({}, c, { models: c.models.map((m) => (m.id === id ? Object.assign({}, m, patch) : m)) }));

    let content;
    if (tab === 'overview') content = h(AdminOverview, { labels });
    else if (catalog.status === 'error') content = h(LoadError, { error: catalog.error, onRetry: load });
    else if (catalog.status === 'loading') content = h('div', { className: 'page-loading' }, h(Spinner, { size: 20, label: 'Loading' }));
    else if (tab === 'routing')
      content = h(
        Fragment,
        null,
        h(
          'div',
          { className: 'section-bar' },
          h('h2', { className: 'section-title' }, 'Routing table'),
          h('span', { className: 'muted small' }, 'Classifier: ', h('strong', { className: 'classifier' }, catalog.classifier ? labels[catalog.classifier] || catalog.classifier : 'heuristic'))
        ),
        h('p', { className: 'muted small' }, 'Each job has a pick per tier. The user’s plan and the request’s difficulty choose the column; private requests use the private tier. Changes apply to the next request.'),
        h(RoutingGrid, { models: catalog.models, routes: catalog.routes, onSaved: onRouteSaved }),
        h(LearnPanel, { labels, onApplied: load })
      );
    else content = h(Fragment, null, h(ModelCatalog, { models: catalog.models, onSaved: onModelSaved }), h(CatalogIO, { onImported: load }));

    return h(
      'div',
      { className: 'page page-wide' },
      h(
        'div',
        { className: 'page-inner' },
        h('header', { className: 'page-head' }, h('h1', null, 'Admin'), h('p', null, 'Routing table, model catalog and the numbers that decide phase 2.')),
        h(
          'div',
          { className: 'tabs', role: 'tablist', 'aria-label': 'Admin sections', onKeyDown: onTabKey },
          ADMIN_TABS.map((t) =>
            h(
              'button',
              {
                key: t.id,
                type: 'button',
                role: 'tab',
                id: 'tab-' + t.id,
                tabIndex: tab === t.id ? 0 : -1,
                'aria-selected': tab === t.id,
                'aria-controls': 'admin-panel',
                className: cx('tab', tab === t.id && 'is-active'),
                onClick: () => setTab(t.id),
              },
              t.label
            )
          )
        ),
        h('div', { id: 'admin-panel', role: 'tabpanel', 'aria-labelledby': 'tab-' + tab, className: 'tab-panel' }, content)
      )
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Privacy (in-app #/privacy and the standalone /privacy.html share this content)
  // ---------------------------------------------------------------------------------------------

  function usePublicProviders() {
    const [state, setState] = useState({ status: 'loading', models: [], presidio: false, error: null });
    const load = useCallback(async () => {
      try {
        const data = await api('/api/public/providers', { redirectOn401: false });
        setState({ status: 'ready', models: data.models || [], presidio: Boolean(data.redaction && data.redaction.presidio), error: null });
      } catch (e) {
        setState({ status: 'error', models: [], presidio: false, error: e });
      }
    }, []);
    useEffect(() => {
      load();
    }, [load]);
    return [state, load];
  }

  function ProvidersTable({ state, onRetry }) {
    const rows = useMemo(
      () =>
        [...state.models].sort((a, b) => {
          const ja = Math.min.apply(null, (a.jobs || ['action']).map((j) => JOBS.indexOf(j)));
          const jb = Math.min.apply(null, (b.jobs || ['action']).map((j) => JOBS.indexOf(j)));
          return ja - jb || Number(Boolean(b.self_hosted)) - Number(Boolean(a.self_hosted)) || Number(Boolean(b.zdr)) - Number(Boolean(a.zdr)) || String(a.label).localeCompare(String(b.label));
        }),
      [state.models]
    );
    if (state.status === 'error') return h(LoadError, { error: state.error, onRetry });
    return h(
      'div',
      { className: 'table-wrap' },
      h(
        'table',
        { className: 'table table-providers' },
        h('thead', null, h('tr', null, ['Model', 'Made by', 'Used for', 'Runs in', 'Zero retention', 'What they keep'].map((c) => h('th', { key: c, scope: 'col' }, c)))),
        h(
          'tbody',
          null,
          state.status === 'loading' && h(EmptyRow, { colSpan: 6 }, h(Spinner, { size: 14 }), ' Loading providers…'),
          state.status === 'ready' && !rows.length && h(EmptyRow, { colSpan: 6 }, 'No models are enabled right now.'),
          rows.map((m, i) =>
            h(
              'tr',
              { key: i },
              h('td', { 'data-label': 'Model' }, h('strong', null, m.label)),
              h('td', { 'data-label': 'Made by' }, m.vendor || '—'),
              h('td', { 'data-label': 'Used for' }, (m.jobs || []).filter((j) => j !== 'action').map((j) => JOB_LABEL[j] || j).join(', ')),
              h('td', { 'data-label': 'Runs in' }, REGION_LABEL[m.region] || m.region || '—'),
              h(
                'td',
                { 'data-label': 'Zero retention' },
                m.self_hosted ? h('span', { className: 'yes' }, h(Icon, { name: 'server', size: 13 }), 'Our servers') : m.zdr ? h('span', { className: 'yes' }, h(Icon, { name: 'lock', size: 13 }), 'Yes') : h('span', { className: 'no' }, 'No')
              ),
              h('td', { 'data-label': 'What they keep', className: 'retention' }, m.retention_note || '—')
            )
          )
        )
      )
    );
  }

  const PROMISES = [
    {
      icon: 'user',
      title: 'AI companies never learn who you are',
      body: 'Every request goes out under Gode’s own account. We never send your name, email or account details to a model provider, so they see “Gode”, not you.',
    },
    {
      icon: 'eye-off',
      title: 'Personal details are removed before anything leaves',
      body: 'Names, email addresses, phone numbers, card and bank numbers, ID numbers and passwords are swapped for placeholders like [PERSON_1] before a request is sent. The real values are put back into the answer on our side, and answers are checked so a model can’t echo sensitive data back.',
    },
    {
      icon: 'lock',
      title: 'Zero data retention where it’s offered',
      body: 'Some providers promise not to keep your request at all. Each model below is marked. Turn on Strict privacy in Settings and Gode only uses zero-retention or self-hosted models.',
    },
    {
      icon: 'server',
      title: 'Sensitive requests stay on our servers',
      body: 'When a request looks private, such as money, health, passwords or legal matters, Gode sends it to an open-weight model on servers we control, so it never leaves. If that model is unavailable, we only fall back to a zero-retention model, after removing your personal details.',
    },
    {
      icon: 'shield',
      title: 'Your chats are encrypted',
      body: 'Conversations are stored encrypted with a key that belongs to your account. Our logs never contain the text of your requests, only which model answered, what it cost and how many details were hidden.',
    },
    {
      icon: 'trash',
      title: 'Delete everything, any time',
      body: 'One button in Settings permanently deletes your account, every chat and your request history.',
    },
    {
      icon: 'eye',
      title: 'See where every request went',
      body: 'Your transparency log in Settings lists the model, provider, retention and cost of every request you have made.',
    },
  ];

  function PrivacyContent({ inApp }) {
    const [providers, reload] = usePublicProviders();
    return h(
      'div',
      { className: 'privacy' },
      h(
        'header',
        { className: 'page-head privacy-head' },
        h('span', { className: 'eyebrow' }, h(Icon, { name: 'shield', size: 15 }), 'Privacy'),
        h('h1', null, 'What we can honestly promise'),
        h('p', null, 'Gode sends your requests to the best AI model for each job. Here is exactly what happens to your data on the way, and the one thing we can’t promise.')
      ),
      h(
        'ul',
        { className: 'promise-grid' },
        PROMISES.map((p) =>
          h(
            'li',
            { key: p.title, className: 'promise' },
            h('span', { className: 'promise-icon' }, h(Icon, { name: p.icon, size: 18 })),
            h('h2', null, p.title),
            h('p', null, p.body)
          )
        )
      ),
      h(
        Notice,
        { tone: 'warn', title: 'What we can’t promise' },
        'Unless a request runs on a model we host ourselves, the AI company that runs the model still sees the text of that request, with your personal details removed. Zero retention means they don’t keep it, not that they never see it.'
      ),
      providers.status === 'ready' &&
        h(
          'p',
          { className: 'muted small detection-note' },
          'Personal details are detected on our own servers using ',
          providers.presidio ? 'Microsoft Presidio together with our built-in checks' : 'our built-in checks',
          '. Nothing is sent to a third party to find them.'
        ),
      h(
        'section',
        { className: 'providers', 'aria-labelledby': 'providers-title' },
        h('h2', { id: 'providers-title', className: 'section-title' }, 'Where your requests can go'),
        h('p', { className: 'muted' }, 'Every model Gode may use right now, where it runs and what its provider keeps. This list comes straight from our live routing table.'),
        h(ProvidersTable, { state: providers, onRetry: reload })
      ),
      inApp && h('p', { className: 'privacy-foot muted small' }, 'Change your privacy options in ', h('a', { href: '#/settings' }, 'Settings'), '.')
    );
  }

  function PrivacyView() {
    return h('div', { className: 'page' }, h('div', { className: 'page-inner' }, h(PrivacyContent, { inApp: true })));
  }

  /** /privacy.html and #/privacy for signed-out visitors: same content, public chrome. */
  function PublicPrivacyPage() {
    const standalone = document.body.dataset.page === 'privacy';
    return h(
      'div',
      { className: 'public-page' },
      h(
        'header',
        { className: 'public-bar' },
        h('a', { href: standalone ? '/' : '#/', className: 'brand-link', 'aria-label': 'Gode home' }, h(Brand, { size: 28 })),
        h('a', { href: standalone ? '/' : '#/', className: 'btn btn-primary btn-sm' }, 'Open Gode')
      ),
      h('main', { className: 'public-main' }, h(PrivacyContent, { inApp: false })),
      h('footer', { className: 'public-foot muted small' }, '© ' + new Date().getFullYear() + ' Gode')
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------------------------

  function AuthScreen({ onAuthed }) {
    const [mode, setMode] = useState(() => (readLocal('gode.returning') ? 'login' : 'signup'));
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const signup = mode === 'signup';

    const switchMode = (m) => {
      setMode(m);
      setErrors({});
    };

    const submit = async (e) => {
      e.preventDefault();
      const errs = {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
      if (!password) errs.password = 'Enter your password.';
      else if (signup && password.length < 8) errs.password = 'Use at least 8 characters.';
      setErrors(errs);
      if (Object.keys(errs).length) return;
      setBusy(true);
      try {
        await api('/api/auth/' + (signup ? 'signup' : 'login'), { method: 'POST', body: { email: email.trim(), password }, redirectOn401: false });
        writeLocal('gode.returning', '1');
        await onAuthed();
      } catch (err) {
        setBusy(false);
        setErrors({ form: err.message });
      }
    };

    const field = (id, label, input, error, hint) =>
      h(
        'div',
        { className: 'field' },
        h('label', { htmlFor: id, className: 'field-label' }, label),
        input,
        error ? h('p', { id: id + '-error', className: 'field-error', role: 'alert' }, error) : hint ? h('p', { id: id + '-hint', className: 'field-hint' }, hint) : null
      );

    return h(
      'div',
      { className: 'auth' },
      h(
        'section',
        { className: 'auth-hero' },
        h(Brand, { size: 34 }),
        h('h1', null, 'The best AI for every job, picked for you.'),
        h('p', { className: 'auth-lead' }, 'Chat, code, images, video, music and voice in one place. Gode chooses the right model for each request.'),
        h(
          'ul',
          { className: 'auth-points' },
          h('li', null, h(Icon, { name: 'sparkle', size: 18 }), h('span', null, h('strong', null, 'Auto-picks the best model. '), 'Easy questions go to fast, cheap models; hard ones get the strongest.')),
          h('li', null, h(Icon, { name: 'card', size: 18 }), h('span', null, h('strong', null, 'Honest cost. '), 'Every answer shows the model, effort and exactly what it cost.')),
          h('li', null, h(Icon, { name: 'shield', size: 18 }), h('span', null, h('strong', null, 'Private by default. '), 'Your personal details are stripped before anything leaves.'))
        ),
        h(
          'div',
          { className: 'auth-sample', 'aria-hidden': 'true' },
          h('span', { className: 'chip' }, h(Icon, { name: 'sparkle', size: 14, className: 'chip-icon' }), 'Claude Opus 5.5 · high effort · $0.04'),
          h('span', { className: 'badge badge-hidden' }, h(Icon, { name: 'eye-off', size: 13 }), '2 personal details hidden from the model')
        )
      ),
      h(
        'main',
        { className: 'auth-main' },
        h(
          'div',
          { className: 'auth-card' },
          h('div', { className: 'auth-card-brand' }, h(Brand, { size: 30 })),
          h('h2', null, signup ? 'Create your account' : 'Welcome back'),
          h('p', { className: 'muted' }, signup ? 'Free to start. You get a little credit to try it.' : 'Log in to pick up where you left off.'),
          h(
            'div',
            { className: 'auth-tabs', role: 'group', 'aria-label': 'Sign up or log in' },
            h('button', { type: 'button', 'aria-pressed': signup, className: cx('auth-tab', signup && 'is-active'), onClick: () => switchMode('signup') }, 'Sign up'),
            h('button', { type: 'button', 'aria-pressed': !signup, className: cx('auth-tab', !signup && 'is-active'), onClick: () => switchMode('login') }, 'Log in')
          ),
          h(
            'form',
            { onSubmit: submit, noValidate: true, className: 'auth-form' },
            errors.form && h('div', { className: 'form-error', role: 'alert' }, h(Icon, { name: 'alert', size: 16 }), errors.form),
            field(
              'auth-email',
              'Email',
              h('input', {
                id: 'auth-email',
                className: cx('input', errors.email && 'is-invalid'),
                type: 'email',
                autoComplete: 'email',
                inputMode: 'email',
                value: email,
                onChange: (e) => setEmail(e.target.value),
                'aria-invalid': Boolean(errors.email),
                'aria-describedby': errors.email ? 'auth-email-error' : undefined,
                autoFocus: true,
              }),
              errors.email
            ),
            field(
              'auth-password',
              'Password',
              h(
                'div',
                { className: 'input-with-action' },
                h('input', {
                  id: 'auth-password',
                  className: cx('input', errors.password && 'is-invalid'),
                  type: show ? 'text' : 'password',
                  autoComplete: signup ? 'new-password' : 'current-password',
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                  'aria-invalid': Boolean(errors.password),
                  'aria-describedby': errors.password ? 'auth-password-error' : signup ? 'auth-password-hint' : undefined,
                }),
                h('button', { type: 'button', className: 'input-action', onClick: () => setShow((s) => !s), 'aria-label': show ? 'Hide password' : 'Show password', 'aria-pressed': show }, h(Icon, { name: show ? 'eye-off' : 'eye', size: 17 }))
              ),
              errors.password,
              signup ? 'At least 8 characters.' : null
            ),
            h('button', { type: 'submit', className: 'btn btn-primary btn-block btn-lg', disabled: busy }, busy ? h(Spinner, { size: 16 }) : null, busy ? (signup ? 'Creating account…' : 'Logging in…') : signup ? 'Create account' : 'Log in')
          ),
          h('p', { className: 'auth-foot' }, h(Icon, { name: 'shield', size: 14 }), 'We never share who you are with AI providers. ', h('a', { href: '#/privacy' }, 'Our privacy promise'))
        )
      )
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Shell + App
  // ---------------------------------------------------------------------------------------------

  const PAGE_TITLE = { settings: 'Settings', billing: 'Billing', admin: 'Admin', privacy: 'Privacy' };

  function Shell({ user, config, route, setUser, refreshUser, onSignedOut }) {
    const notify = useToast();
    const [convs, setConvs] = useState({ status: 'loading', items: [] });
    const [draftKey, setDraftKey] = useState(() => localKey('draft'));
    const [drafts, setDrafts] = useState({});
    const [drawer, setDrawer] = useState(false);
    const activeKey = route.page === 'chat' ? route.conversationId || draftKey : null;
    const activeKeyRef = useRef(activeKey);
    activeKeyRef.current = activeKey;

    const refreshConversations = useCallback(async () => {
      try {
        const data = await api('/api/conversations');
        setConvs({ status: 'ready', items: data.conversations || [] });
      } catch (e) {
        setConvs((c) => Object.assign({}, c, { status: c.items.length ? 'ready' : 'error' }));
      }
    }, []);
    useEffect(() => {
      refreshConversations();
    }, [refreshConversations]);

    const upsertConversation = (id, title) =>
      setConvs((c) => {
        const existing = c.items.find((x) => x.id === id);
        const item = Object.assign({ id, title: null }, existing, { updated_at: Date.now() }, title ? { title } : null);
        return Object.assign({}, c, { status: 'ready', items: [item].concat(c.items.filter((x) => x.id !== id)) });
      });

    // Engine callbacks read the latest Shell state through this ref.
    const hooksRef = useRef(null);
    hooksRef.current = {
      setUser,
      refreshUser,
      notify,
      onConversationCreated(id, title, fromDraft) {
        upsertConversation(id, title);
        setDrafts((d) => {
          if (!(fromDraft in d)) return d;
          const next = withoutKey(d, fromDraft);
          next[id] = d[fromDraft];
          return next;
        });
        if (activeKeyRef.current === fromDraft) navigate('#/c/' + encodeURIComponent(id), { replace: true });
      },
      onConversationTouched(id, title) {
        if (id && !isDraftKey(id)) upsertConversation(id, title);
      },
      onStreamSettled(key) {
        // The first answer gives the chat its server-side title.
        const item = convs.items.find((x) => x.id === key);
        if (isDraftKey(key) || !item || !item.title) refreshConversations();
      },
    };
    const engine = useChatEngine(hooksRef);

    useEffect(() => setDrawer(false), [route.page, route.conversationId]);
    useEffect(() => {
      if (!drawer) return undefined;
      const onKey = (e) => e.key === 'Escape' && setDrawer(false);
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [drawer]);

    const current = route.conversationId ? convs.items.find((c) => c.id === route.conversationId) : null;
    const title = route.page === 'chat' ? (current && current.title) || 'New chat' : PAGE_TITLE[route.page];
    useEffect(() => {
      document.title = title && title !== 'New chat' ? title + ' · Gode' : 'Gode';
    }, [title]);

    const newChat = () => {
      if (route.page === 'chat' && !route.conversationId && !(engine.threads[draftKey] && engine.threads[draftKey].messages.length)) {
        setDrawer(false);
        const el = document.getElementById('composer-input');
        if (el) el.focus();
        return;
      }
      setDraftKey(localKey('draft'));
      navigate('#/');
    };

    const deleteConversation = async (conv) => {
      try {
        await api('/api/conversations/' + encodeURIComponent(conv.id), { method: 'DELETE' });
        engine.abortThread(conv.id);
        engine.drop(conv.id);
        setConvs((c) => Object.assign({}, c, { items: c.items.filter((x) => x.id !== conv.id) }));
        if (route.conversationId === conv.id) navigate('#/');
        notify('Chat deleted');
        return true;
      } catch (e) {
        notify(e.message || "Couldn't delete that chat.", 'error');
        return false;
      }
    };

    const logout = async () => {
      try {
        await api('/api/auth/logout', { method: 'POST', body: {} });
      } catch (e) {
        // The session is dropped client-side either way; the cookie expires on its own.
      }
      onSignedOut();
    };

    let main;
    if (route.page === 'settings') main = h(SettingsView, { user, setUser, onDeleted: () => onSignedOut({ deleted: true }) });
    else if (route.page === 'billing') main = h(BillingView, { user, config, setUser, route });
    else if (route.page === 'admin')
      main = user.is_admin
        ? h(AdminView)
        : h('div', { className: 'page' }, h('div', { className: 'page-inner' }, h(Notice, { tone: 'info', title: 'Admins only' }, 'This page is for Gode administrators.')));
    else if (route.page === 'privacy') main = h(PrivacyView);
    else
      main = h(ChatView, {
        engine,
        threadKey: activeKey,
        user,
        draft: drafts[activeKey] || '',
        setDraft: (v) => setDrafts((d) => Object.assign({}, d, { [activeKey]: v })),
      });

    const modePill =
      route.page === 'chat' &&
      h(
        'a',
        { className: 'mode-pill', href: '#/settings', title: 'Change how Gode picks models' },
        h(Icon, { name: user.auto_pick ? 'sparkle' : 'sliders', size: 14 }),
        h('span', null, user.auto_pick ? 'Auto-pick' : 'Manual'),
        h('span', { className: 'mode-pill-sep' }, '·'),
        h('span', null, (PLANS.find((p) => p.id === user.plan) || PLANS[1]).name),
        user.strict_privacy && h(Icon, { name: 'lock', size: 13, className: 'mode-pill-lock' })
      );

    return h(
      'div',
      { className: 'app-shell' },
      h('a', { href: '#main', className: 'skip-link' }, 'Skip to content'),
      h(Sidebar, {
        user,
        config,
        convs,
        activeId: route.conversationId,
        streams: engine.streams,
        page: route.page,
        open: drawer,
        onNewChat: newChat,
        onDelete: deleteConversation,
        onLogout: logout,
        onClose: () => setDrawer(false),
      }),
      drawer && h('div', { className: 'scrim', onClick: () => setDrawer(false), 'aria-hidden': 'true' }),
      h(
        'div',
        { className: 'main' },
        h(
          'header',
          { className: 'topbar' },
          h('button', { type: 'button', className: 'icon-btn menu-btn', 'aria-label': 'Open menu', 'aria-controls': 'sidebar', 'aria-expanded': drawer, onClick: () => setDrawer(true) }, h(Icon, { name: 'menu', size: 20 })),
          h('h1', { className: 'topbar-title' }, title),
          h('div', { className: 'topbar-right' }, modePill, h('a', { className: 'topbar-balance', href: '#/billing', title: 'Balance' }, formatBalance(user.balance_usd)))
        ),
        h('main', { id: 'main', className: 'main-content', tabIndex: -1 }, h(ErrorBoundary, { key: route.page }, main))
      )
    );
  }

  function BootScreen() {
    return h('div', { className: 'boot' }, h(BrandMark, { size: 40 }), h(Spinner, { size: 18, label: 'Loading Gode' }));
  }

  function App() {
    const route = useHashRoute();
    const notify = useToast();
    const [session, setSession] = useState({ status: 'loading', user: null, config: null, error: null });

    const loadMe = useCallback(async () => {
      try {
        const data = await api('/api/me', { redirectOn401: false });
        setSession({ status: 'ready', user: data.user, config: data.config || {}, error: null });
      } catch (e) {
        setSession(e.status === 401 ? { status: 'anon', user: null, config: null, error: null } : { status: 'error', user: null, config: null, error: e });
      }
    }, []);
    useEffect(() => {
      loadMe();
    }, [loadMe]);
    useEffect(() => onAuthLost(() => setSession({ status: 'anon', user: null, config: null, error: null })), []);

    const setUser = useCallback((patch) => setSession((s) => (s.user ? Object.assign({}, s, { user: Object.assign({}, s.user, patch) }) : s)), []);
    // Best effort (e.g. the balance after an out-of-credits answer): a 401 is handled globally and
    // any other failure just leaves the current numbers on screen.
    const refreshUser = useCallback(async () => {
      try {
        const data = await api('/api/me');
        setSession((s) => (s.user && data.user ? Object.assign({}, s, { user: data.user, config: data.config || s.config }) : s));
      } catch (e) {
        if (e.status !== 401) console.warn('Gode: could not refresh the account:', e.message);
      }
    }, []);
    const signedOut = useCallback(
      (opts) => {
        writeLocal('gode.manualModel', null);
        writeLocal('gode.adminTab', null);
        if (opts && opts.deleted) {
          writeLocal('gode.returning', null);
          notify('Your account and all your data were deleted.');
        }
        setSession({ status: 'anon', user: null, config: null, error: null });
        navigate('#/');
      },
      [notify]
    );

    if (session.status === 'loading') return h(BootScreen);
    if (session.status === 'error')
      return h(
        'div',
        { className: 'boot' },
        h(BrandMark, { size: 40 }),
        h(Notice, { tone: 'error', title: "Can't reach Gode", actions: h('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: loadMe }, 'Try again') }, session.error.message)
      );
    if (session.status === 'anon') return route.page === 'privacy' ? h(PublicPrivacyPage) : h(AuthScreen, { onAuthed: loadMe });
    return h(Shell, { user: session.user, config: session.config, route, setUser, refreshUser, onSignedOut: signedOut });
  }

  // ---------------------------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------------------------

  const lib = {
    createSSEParser,
    parseBlocks,
    parseInline,
    safeHref,
    safeMediaUrl,
    formatCost,
    formatPrecise,
    formatBalance,
    effortText,
    countRedactions,
    hiddenDetailsText,
    liveChipText,
    priceText,
    parseHash,
    dayGroup,
    errorCopy,
    chatReducer,
    requestFromRoute,
  };

  // Lets node:test exercise the pure helpers without a browser; the browser never has `module`.
  if (typeof module === 'object' && module && module.exports) {
    module.exports = lib;
    return;
  }

  function mount() {
    const root = document.getElementById('root');
    if (!root || !window.ReactDOM) return;
    const page = document.body.dataset.page === 'privacy' ? h(PublicPrivacyPage) : h(App);
    window.ReactDOM.createRoot(root).render(h(ToastProvider, null, h(ErrorBoundary, null, page)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
