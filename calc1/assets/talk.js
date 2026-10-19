/* ============================================================
   Mathub — Talk with Bo (assets/talk.js): a voice call with Bo, the AI tutor, on the website.
   The student talks; Bo listens, thinks, answers out loud and writes the math on a whiteboard.
   - Hearing: the browser's own speech recognition (Chrome, Edge, Safari), with live captions. Where there is
     none (Firefox) and the server has speech switched on, a short recording is turned into text by the
     server (api/ai.php, ai_listen). Bo never listens while he talks, so he does not hear himself.
   - Answers stream from the server (ai_tutor with voice and stream): Bo starts talking as soon as his first
     sentence is written. What he works out goes on his board (a [board: …] page, App.boBoard) and is never read aloud.
   - Bo's voice: a natural voice from the server (ai_speak) when it is switched on, otherwise the best voice
     this device has. Speed, voice, hands-free and captions are in the call's settings.
   - Hands-free: after Bo talks he listens again. Tap Bo, the big button or Space to talk, to send what you
     said, or to interrupt him; Esc ends the call. Every turn is saved in the chat with Bo.
   - The whole screen is a board you share (assets/bo-pad.js): you write and draw on it, his pages go up on it as
     cards next to your work, Show Bo sends him a picture of it (with a grid, so he can say where) and he marks
     your writing (mark_on_board, or mark: lines in basic voice). On a live call he also sees it quietly as you write.
   - Captions like a video's: white on black at the bottom, two lines that roll up, Bo's words appearing as he
     says them (paced to his voice), yours as you are heard; size, background and names in the call's settings, C.
   - Also here: "Read aloud" for any answer in the chat (App.boTalk.read).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const SPEECH = { es: 'es-ES', ru: 'ru-RU', fr: 'fr-FR', it: 'it-IT', pt: 'pt-BR', de: 'de-DE' };   // the language Bo listens and speaks in (assets/i18n.js)
  const { $, $$, esc, icon, toast, settings, setSetting } = App;
  const N = global.Native; const MA = global.MATHUB_APP; const NATIVE = !!(N && MA && MA.native);
  const SR = global.SpeechRecognition || global.webkitSpeechRecognition || null;
  const synth = global.speechSynthesis || null;
  const API = 'api/index.php?r=';
  const HDR = { 'X-Requested-With': 'MatHub', 'Accept': 'application/json', 'Content-Type': 'application/json' };
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  const bo = n => (App.bobcatSvg ? App.bobcatSvg(n) : '');
  const still = () => (global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'off';
  const short = id => { const C = global.Courses && global.Courses[id]; return C ? (C.short || C.code) : id; };
  const RATES = [0.9, 1, 1.15, 1.3];

  /* ---------- what Bo says out loud: his words without the board, notes, markdown or LaTeX ---------- */
  const FN = { sin: 'sine', cos: 'cosine', tan: 'tangent', sec: 'secant', csc: 'cosecant', cot: 'cotangent', ln: 'natural log of', log: 'log of', arcsin: 'arc sine', arccos: 'arc cosine', arctan: 'arc tangent' };
  const MATH = [
    [/\\left|\\right|\\,|\\;|\\!|\\quad/g, ' '], [/\\lim_\{([^{}]+)\}/g, ' the limit as $1 of '], [/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, ' $1 over $2 '], [/\\sqrt\{([^{}]+)\}/g, ' the square root of $1 '],
    [/\^(?:\{2\}|2)/g, ' squared '], [/\^(?:\{3\}|3)/g, ' cubed '], [/\^\{([^{}]+)\}/g, ' to the $1 '], [/\^(\w)/g, ' to the $1 '], [/_\{([^{}]+)\}|_(\w)/g, ' sub $1$2 '],
    [/\\(?:cdot|times)/g, ' times '], [/\\div/g, ' divided by '], [/\\pm/g, ' plus or minus '], [/\\leq?\b/g, ' is at most '], [/\\geq?\b/g, ' is at least '],
    [/\\neq?\b/g, ' is not equal to '], [/\\approx/g, ' is about '], [/\\infty/g, ' infinity '], [/\\to\b|\\rightarrow/g, ' goes to '], [/\\lim/g, ' the limit '],
    [/\\int/g, ' the integral of '], [/\\sum/g, ' the sum of '], [/\\Delta\s*/g, ' change in '], [/\\(pi|theta|alpha|beta|lambda|mu|sigma|omega)\b/g, ' $1 '],
    [/\\(arcsin|arccos|arctan|sin|cos|tan|sec|csc|cot|ln|log)\b/g, (m, f) => ` ${FN[f]} `], [/\\[a-zA-Z]+/g, ' '], [/\b([a-zA-Z]'*)\(/g, '$1 of ('], [/[{}()]/g, ' '],
    [/'/g, ' prime '], [/</g, ' is less than '], [/>/g, ' is greater than '], [/=/g, ' equals '], [/\+/g, ' plus '], [/(\w)\s*-\s*/g, '$1 minus '], [/-/g, ' negative '],
    [/\//g, ' over '], [/\*/g, ' times ']
  ];
  const mathWords = x => ' ' + MATH.reduce((s, [re, to]) => s.replace(re, to), String(x)).replace(/\s+/g, ' ').trim() + ' ';
  const sayable = t => String(t || '').replace(/^\s*mark\s*:.*$/gim, ' ').replace(/\[\/?(board\+?|remember)(:[^\]]*)?\]/gi, ' ').replace(/\$\$?([^$]+)\$\$?/g, (m, x) => mathWords(x))
    .replace(/\*\*|__|`/g, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '').replace(/\s+/g, ' ').trim();
  const shown = t => String(t || '').replace(/\[\/?(board\+?|remember)(:[^\]]*)?\]/gi, ' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  /* reads a reply that is still being written, line by line: whole sentences of what Bo says go to onSentence
     (from a line still coming in too, so he starts talking early); a page for the board ([board: Title] …
     [/board], see App.boBoard) goes to onPage as it fills, with isNew the first time. Pages are never spoken. */
  /* a mark: line in basic voice ("mark: C3 circle sign slip here") → {at, kind, text} for the board */
  const MARK = /^\s*mark\s*:\s*(.+)$/i;
  const markOf = t => { const m = /^\s*([a-l]\s*\d{1,2}(?:\s*[:\-–]\s*[a-l]\s*\d{1,2})?)\s*(circle|check|cross|underline|arrow|box|note)?\s*[:,-]?\s*(.*)$/i.exec(String(t || '')); return m ? { at: m[1].replace(/\s+/g, ''), kind: (m[2] || (m[3] ? 'note' : 'circle')).toLowerCase(), text: m[3].trim().replace(/^["“]|["”]$/g, '') } : null; };
  function splitter(onSentence, onPage, onMark) {
    const BB = App.boBoard || {}; const KIND = BB.KIND || /^$/, OPEN = BB.OPEN || /^$/, CLOSE = BB.CLOSE || /^$/;
    const dep = App.boDraw ? App.boDraw.depth : () => 0;
    let buf = '', cur = null, wait = null, said = 0, loose = null, grab = null, fence = null, skipFence = false;
    const page = (p, isNew) => { if (onPage) onPage(p, isNew); };
    const add = (p, k, t, x) => BB.add ? BB.add(p, k, t, x) : (p.items.push(Object.assign({ k, t }, x || {})), p.items[p.items.length - 1]);
    const looseOf = () => { const isNew = !loose; if (isNew) loose = { title: '', items: [], open: false }; return [loose, isNew]; };
    const looseLine = x => { x = String(x || '').trim(); if (!x) return; const [p, isNew] = looseOf(); p.items.push(BB.oneLine ? BB.oneLine(x) : { k: 'text', t: x }); page(p, isNew); };
    // a draw: or check: whose JSON goes on over the next lines (or sits in a ``` block): it goes up once its brackets close
    const finish = () => { const g = grab; grab = null; const t = g.t.replace(/\s*```\s*$/, '').trim(); if (!t) return; let p = g.p, isNew = false; if (!p) [p, isNew] = looseOf(); add(p, g.k, t); page(p, isNew); };
    const startGrab = (p, k, rest) => { grab = { p, k, t: '' }; const t = String(rest || '').replace(/^\s*```\w*\s*/, ''); if (t.trim()) { grab.t = t; if (dep(t) <= 0) { finish(); skipFence = true; } } };
    const emit = s => { s = s.replace(/\[board\+?:\s*([^\]]*)\]/gi, (m, x) => { looseLine(x); return ' '; }).replace(/\[(?:\/board|remember:[^\]]*)\]/gi, ' ').trim(); if (s) onSentence(s); };
    // the whole sentences in a line from position from; final: the line is complete, so the rest is a sentence too
    function sentences(line, from, final) {
      const open = line.lastIndexOf('['); const hold = !final && open >= 0 && line.indexOf(']', open) < 0 ? open : line.length;
      let start = from, math = false;
      for (let i = from; i < hold; i++) {
        const c = line[i]; if (c === '$') math = !math; if (math) continue;
        if (/[.!?]/.test(c) && (i + 1 < hold ? /\s/.test(line[i + 1]) : false)) { emit(line.slice(start, i + 1)); start = i + 1; }
      }
      if (final && start < line.length) { emit(line.slice(start)); start = line.length; }
      return start;
    }
    function line(l) {
      if (skipFence) { skipFence = false; if (/^\s*```\s*$/.test(l)) return; }
      if (grab) {
        if (!grab.t) { if (!l.trim() || /^\s*```\w*\s*$/.test(l)) return; if (/^\s*\{/.test(l)) { grab.t = l; if (dep(l) <= 0) { finish(); skipFence = true; } return; } grab = null; }
        else { if (/^\s*```\s*$/.test(l)) { finish(); return; } grab.t += '\n' + l; if (dep(grab.t) <= 0) { finish(); skipFence = true; } return; }
      }
      if (fence) { if (/^\s*```\s*$/.test(l)) { fence = null; return; } fence.it.t += (fence.it.t ? '\n' : '') + l.replace(/\s+$/, ''); page(fence.p, false); return; }   // code, a line at a time
      if (wait) {   // a page title: the next line says whether a page follows (or it was a one-line board)
        if (!l.trim()) return; const w = wait; wait = null;
        if (KIND.test(l) || CLOSE.test(l)) { cur = { title: w.title, cont: w.cont, items: [], open: true }; page(cur, true); } else looseLine(w.title);
      }
      if (cur) {
        if (CLOSE.test(l)) { cur.open = false; page(cur, false); cur = null; return; }
        if (/^\s*```/.test(l)) { const lang = l.replace(/^\s*```/, '').trim().slice(0, 20); if (/^json$/i.test(lang)) grab = { p: cur, k: 'draw', t: '' }; else { fence = { p: cur, it: add(cur, 'code', '', { lang }) }; page(cur, false); } return; }
        const mk0 = MARK.exec(l); if (mk0) { const m = markOf(mk0[1]); if (m && onMark) onMark(m); return; }   // a mark written inside a page
        const k = KIND.exec(l);
        if (k) {
          const kind = BB.kind ? BB.kind(k[1]) : 'text';
          if (kind === 'check' && k[2].trim() && !/^\s*(\{|```)/.test(k[2])) { add(cur, 'tip', k[2].trim()); page(cur, false); return; }   // "check: plug it back in" is a tip
          if (kind === 'draw' || kind === 'check') { startGrab(cur, kind, k[2]); return; }
          if (kind === 'code') { add(cur, 'code', k[2].replace(/\s+$/, '')); page(cur, false); return; }
          const t = k[2].trim(); if (t) { add(cur, kind, t); page(cur, false); } return;
        }
        if (!l.trim()) return;
        cur.open = false; page(cur, false); cur = null;
      }
      const o = OPEN.exec(l); if (o) { wait = { title: o[2].trim(), cont: !!o[1] }; said = 0; return; }
      const mk = MARK.exec(l); if (mk) { const m = markOf(mk[1]); if (m && onMark) onMark(m); said = 0; return; }   // marks on their writing are never spoken
      const dm = /^\s*(draw|check)\s*:\s?(.*)$/i.exec(l); if (dm && (!dm[2].trim() || /^\s*(\{|```)/.test(dm[2]))) { startGrab(null, dm[1].toLowerCase(), dm[2]); said = 0; return; }   // a drawing or a question is never spoken
      sentences(l, said, true); said = 0;
    }
    return {
      push(t) {
        buf += t; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); line(l); }
        if (!cur && !wait && !grab && !fence && buf && !/^\s*\[/.test(buf) && !/^\s*(draw|check)\s*:\s*(\{|```|$)/i.test(buf) && !/^\s*m(a(r(k)?)?)?\s*(:|$)/i.test(buf)) said = sentences(buf, said, false);
      },
      end() { if (buf) { const l = buf; buf = ''; line(l); } if (grab) finish(); fence = null; if (wait) { const w = wait; wait = null; looseLine(w.title); } if (cur) { cur.open = false; page(cur, false); cur = null; } }
    };
  }

  /* ---------- the voices this device has: the most natural-sounding English one first ---------- */
  const deviceVoices = () => (synth ? synth.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang)) : []);
  const NOVELTY = /(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy|princess|fred)/i;
  function bestVoice() {
    const vs = deviceVoices(); if (!vs.length) return null;
    const want = vs.find(v => v.name === settings().boDeviceVoice); if (want) return want;
    const score = v => (/natural|neural/i.test(v.name) ? 60 : 0) + (/online/i.test(v.name) ? 15 : 0) + (/premium|enhanced/i.test(v.name) ? 45 : 0) + (/google us english/i.test(v.name) ? 35 : 0)
      + (/(andrew|guy|christopher|eric|davis|brian|aaron|evan|alex|daniel|tom|samantha|aria|jenny|ava|zoe|emma|michelle)/i.test(v.name) ? 12 : 0) + (/en-US/i.test(v.lang) ? 8 : 0) + (v.default ? 2 : 0) - (NOVELTY.test(v.name) ? 200 : 0);
    return vs.slice().sort((a, b) => score(b) - score(a))[0];
  }
  /* ---------- Bo's mouth: one sentence after another, in his natural voice or this device's ---------- */
  const Speaker = {
    queue: [], busy: false, gen: 0, audio: null, ctx: null, analyser: null, natural: false, voice: 'ash', onStart: null, onIdle: null, onLevel: null, fellBack: false,
    rate: () => RATES.includes(+settings().boRate) ? +settings().boRate : 1,
    /* audio can only start from a tap: called from one, it opens the way for the whole call */
    unlock() {
      if (this.unlocked) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
      this.unlocked = true;
      try { if (!this.audio) { this.audio = new Audio(); this.audio.preload = 'auto'; } this.audio.src = SILENT; const p = this.audio.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      try { if (synth && !synth.speaking) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } } catch (e) {}
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (AC && !this.ctx && !still()) { this.ctx = new AC(); this.ctx.resume().then(() => { if (this.ctx.state === 'running' && !this.analyser) { const src = this.ctx.createMediaElementSource(this.audio); this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 512; src.connect(this.analyser); this.analyser.connect(this.ctx.destination); } }).catch(() => {}); }
        else if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      } catch (e) {}
    },
    say(text, meta) {
      const said = sayable(text); if (!said) return;
      const item = { said, meta, gen: this.gen };
      if (this.natural) { item.ctl = new AbortController(); item.url = this.fetchAudio(said, item.ctl.signal); item.url.catch(() => {}); }
      this.queue.push(item); this.pump();
    },
    fetchAudio(text, signal) {
      return fetch(API + 'ai_speak', { method: 'POST', credentials: 'same-origin', headers: HDR, body: JSON.stringify(Object.assign({ text, voice: this.voice }, T.lid ? { lid: T.lid } : {})), signal })
        .then(async r => { if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || 'Bo\'s voice is not available.'), { status: r.status }); } return URL.createObjectURL(await r.blob()); });
    },
    stop() { this.gen++; this.cur = null; this.queue.forEach(q => { if (q.ctl) q.ctl.abort(); }); this.queue = []; this.busy = false; try { if (this.audio) this.audio.pause(); } catch (e) {} try { if (synth) synth.cancel(); } catch (e) {} },
    idle() { return !this.busy && !this.queue.length; },
    async pump() {
      if (this.busy) return; const item = this.queue.shift(); if (!item) { if (this.onIdle) this.onIdle(); return; }
      this.busy = true; const g = this.gen; this.cur = item; this.t0 = performance.now(); this.chars = -1; if (this.onStart) this.onStart(item);
      try {
        if (item.url) { let url; try { url = await item.url; } catch (e) { if (g !== this.gen) return; this.fallBack(e); } if (g !== this.gen) return; if (url) await this.play(url); else await this.speak(item.said); }
        else await this.speak(item.said);
      } catch (e) { if (g === this.gen && item.url) { this.fallBack(e); await this.speak(item.said).catch(() => {}); } }
      if (g !== this.gen) return;
      if (this.onEnd) this.onEnd(item);
      this.busy = false; this.cur = null; this.pump();
    },
    fallBack(e) { if (this.natural) { this.natural = false; this.queue.forEach(q => { if (q.ctl) q.ctl.abort(); q.url = null; }); if (!this.fellBack) { this.fellBack = true; toast((e && e.status === 429 ? e.message : 'Bo\'s natural voice is not available right now, so your device\'s voice is used.'), 4000); } } },
    play(url) {
      return new Promise((res, rej) => {
        const a = this.audio; let done = false, wd = 0;
        const fin = err => { if (done) return; done = true; clearTimeout(wd); a.onended = a.onerror = a.onpause = null; setTimeout(() => URL.revokeObjectURL(url), 1000); err ? rej(err) : res(); };
        a.onended = () => fin(); a.onerror = () => fin(new Error('The audio could not be played.')); a.onpause = () => { if (!a.ended) fin(); };
        a.src = url; a.playbackRate = this.rate(); a.preservesPitch = true;
        const p = a.play(); (p && p.then ? p : Promise.resolve()).then(() => { wd = setTimeout(() => fin(), ((isFinite(a.duration) && a.duration > 0 ? a.duration : 25) / this.rate()) * 1000 + 2500); }).catch(err => fin(err));
      });
    },
    speak(text) {
      return new Promise(res => {
        if (!synth || !global.SpeechSynthesisUtterance) return res();
        const u = new SpeechSynthesisUtterance(text); const v = bestVoice(); if (v) u.voice = v; u.lang = (v && v.lang) || SPEECH[App.lang] || 'en-US'; u.rate = this.rate();
        let done = false; const fin = () => { if (done) return; done = true; clearTimeout(wd); res(); };
        u.onend = fin; u.onerror = fin; u.onboundary = e => { if (e && e.charIndex >= 0) this.chars = e.charIndex; if (this.onLevel) this.onLevel(0.55 + Math.random() * 0.45); };
        const wd = setTimeout(fin, 3000 + text.split(/\s+/).length * 520 / this.rate());   // some browsers never say they finished
        synth.speak(u);
      });
    },
    /* how much of the sentence being said is said (0 to 1): from the audio's clock, the voice's word marks, or its pace */
    progress() {
      const it = this.cur; if (!it) return 0; const a = this.audio;
      if (it.url && a && !a.paused && isFinite(a.duration) && a.duration > 0) return Math.min(1, a.currentTime / a.duration);
      if (this.chars >= 0) return Math.min(1, (this.chars + 1) / Math.max(1, it.said.length));
      return Math.min(1, ((performance.now() - this.t0) / 1000) * 2.6 * this.rate() / Math.max(1, it.said.split(/\s+/).length));
    },
    level() { if (!this.analyser || !this.busy || !this.audio || this.audio.paused) return 0; const d = new Uint8Array(this.analyser.fftSize); this.analyser.getByteTimeDomainData(d); let s = 0; for (const x of d) { const v = (x - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / d.length) * 5); }
  };

  /* ---------- Bo's ears ---------- */
  /* the browser's own speech recognition: live words, and the turn ends after a short silence */
  function srListen(h) {
    const rec = new SR(); rec.lang = SPEECH[App.lang] || 'en-US'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    let finals = '', interim = '', ended = false, heard = false, timer = 0;
    const clear = () => { clearTimeout(timer); clearTimeout(cap); clearTimeout(longest); };
    const finish = () => { if (ended) return; ended = true; clear(); try { rec.stop(); } catch (e) {} const t = (finals + ' ' + interim).replace(/\s+/g, ' ').trim(); if (t) h.onFinal(t); else h.onNothing(); };
    rec.onresult = e => { finals = ''; interim = ''; for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finals += r[0].transcript + ' '; else interim += r[0].transcript; } heard = true; h.onInterim((finals + interim).replace(/\s+/g, ' ').trim(), !interim); h.onLevel(0.8); clearTimeout(timer); timer = setTimeout(finish, interim ? 1700 : 1100); };
    rec.onerror = e => { if (ended || e.error === 'no-speech' || e.error === 'aborted') return; ended = true; clear(); h.onError(e.error || 'error'); };
    rec.onend = () => { if (ended) return; if (heard) finish(); else { try { rec.start(); } catch (x) { ended = true; clear(); h.onNothing(); } } };
    const cap = setTimeout(() => { if (!heard && !ended) { ended = true; clear(); try { rec.abort(); } catch (e) {} h.onNothing(); } }, 12000);
    const longest = setTimeout(finish, 60000);
    try { rec.start(); } catch (e) { ended = true; clear(); h.onError('start'); }
    return { send() { finish(); }, cancel() { if (ended) return; ended = true; clear(); try { rec.abort(); } catch (e) {} } };
  }
  /* no speech recognition in this browser: record until a short silence, and the server turns it into text */
  async function recListen(h) {
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); } catch (e) { h.onError(e && e.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture'); return { send() {}, cancel() {} }; }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); const chunks = [];
    const AC = global.AudioContext || global.webkitAudioContext; const ctx = AC ? new AC() : null; let an = null;
    if (ctx) { an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an); }
    const buf = new Float32Array(1024); const t0 = Date.now(); let spoke = 0, loud = 0, done = false, dropped = false;
    const end = () => { if (done) return; done = true; clearInterval(tick); try { rec.stop(); } catch (e) {} };
    const tick = setInterval(() => {
      const now = Date.now(); let rms = 0;
      if (an) { an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x; rms = Math.sqrt(s / buf.length); h.onLevel(Math.min(1, rms * 9)); }
      if (rms > 0.02) { if (!spoke) spoke = now; loud = now; }
      if (spoke && now - loud > 1300) end(); else if (!spoke && now - t0 > 10000 && an) { dropped = true; end(); } else if (now - t0 > 60000) end();
    }, 60);
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); if (ctx) ctx.close().catch(() => {});
      if (dropped || !chunks.length) return h.onNothing();
      h.onHearing();
      try {
        const blob = new Blob(chunks, { type: (rec.mimeType || type || 'audio/webm') }); const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(blob); });
        const r = await post('ai_listen', Object.assign({ audio: { type: blob.type, data }, secs: Math.max(1, Math.round(((loud || Date.now()) - t0) / 1000) + 1), class: T.cid }, T.lid ? { lid: T.lid } : {}));
        if ((r.text || '').trim()) h.onFinal(r.text.trim()); else h.onNothing();
      } catch (e) { h.onError(e.message || 'transcribe'); }
    };
    rec.start(250);
    return { send() { end(); }, cancel() { dropped = true; end(); } };
  }
  async function post(route, body) {
    let res, j; try { res = await fetch(API + route, { method: 'POST', credentials: 'same-origin', headers: HDR, body: JSON.stringify(body) }); j = await res.json(); } catch (e) { throw new Error('Bo cannot be reached right now. Check your connection.'); }
    if (!j || j.ok === false) throw Object.assign(new Error((j && j.error) || 'Something went wrong.'), { status: res.status });
    return j;
  }

  /* ============================================================
     The call. One screen, two engines:
     - live (default when the server has the speech key): a real-time voice conversation through OpenAI's
       Realtime API over WebRTC, set up by api/ai.php (ai_live_start). Bo hears you as you talk, answers in
       about half a second in a natural voice, waits until you are actually done, and stops when you talk over
       him, like a phone call. Formulas go on the board and he draws graphs and figures there (tools he calls),
       marks your writing, and keeps notes through another.
     - basic: when live calls are not switched on or cannot connect: the browser hears, Bo's answer streams from
       the chat, and he reads it out sentence by sentence.
     The screen is the board (assets/bo-pad.js); before the call starts a night sky covers it with Bo in the middle.
     ============================================================ */
  const T = { el: null, mode: 'live', cid: null, status: null, state: 'idle', who: 'listening', onClose: null, back: null, changed: false, lock: null, raf: 0, lvl: 0, pages: [], cards: new Map(), pad: null, photo: null, board: false, muted: false, t0: 0, clock: 0, listener: null, turn: 0, done: true, trial: false, lid: '', free: 0, freeAt: 0, freeTick: 0 };
  /* without Max, a call runs on the free minutes (once per account; api/ai.php counts them): how many are left now */
  const freeLeft = () => Math.max(0, T.free - (Date.now() - T.freeAt) / 1000);
  const liveOn = () => !!(T.status && T.status.voice && T.status.voice.live) && !!global.RTCPeerConnection && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && settings().boMode !== 'basic';
  const canHear = () => !!SR || !!(T.status && T.status.voice && T.status.voice.listen && navigator.mediaDevices && global.MediaRecorder);
  const naturalOn = () => !!(T.status && T.status.voice && T.status.voice.natural) && settings().boVoice !== 'device';
  const caps = () => settings().boCaptions !== false;
  const LIVE_RATES = [0.9, 1, 1.1, 1.2];
  const liveRate = () => LIVE_RATES.includes(+settings().boLiveRate) ? +settings().boLiveRate : 1;
  const eager = () => ['low', 'auto', 'high'].includes(settings().boEager) ? settings().boEager : 'auto';
  const liveVoices = () => (T.status && T.status.voice && T.status.voice.live_voices) || {};
  const liveVoice = () => liveVoices()[settings().boLiveVoice] ? settings().boLiveVoice : ((T.status && T.status.voice && T.status.voice.live_default) || 'cedar');
  const basicVoice = () => (T.status && T.status.voice && T.status.voice.voices && T.status.voice.voices[settings().boVoice]) ? settings().boVoice : ((T.status && T.status.voice && T.status.voice.default) || 'ash');
  const watching = () => settings().boWatch !== false;
  const CC_SIZES = ['s', 'm', 'l', 'xl'], CC_BGS = ['box', 'solid', 'outline'];
  const ccSize = () => CC_SIZES.includes(settings().boCcSize) ? settings().boCcSize : 'm';
  const ccBg = () => CC_BGS.includes(settings().boCcBg) ? settings().boCcBg : 'box';
  const snap = () => (App.tutorSnapshot ? App.tutorSnapshot(T.cid) : {});
  const clockText = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* levels of Bo's voice and of yours: for the rings, and for letting his captions out while he is actually talking */
  let ACX = null;
  function audioCtx() { const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null; if (!ACX) { try { ACX = new AC(); } catch (e) { return null; } } if (ACX.state === 'suspended') ACX.resume().catch(() => {}); return ACX; }
  function meter(stream) { const ctx = audioCtx(); if (!ctx) return null; try { const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an); return an; } catch (e) { return null; } }
  function levelOf(an) { if (!an) return 0; const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let s = 0; for (const x of d) { const v = (x - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / d.length) * 4.5); }

  /* where the board's edges are hidden behind the call's bars, tile and captions (for placing Bo's pages) */
  function insets() {
    if (!T.el) return {}; const r = s => { const e = $(s, T.el); return e && e.offsetParent !== null ? e.getBoundingClientRect() : null; };
    const H = global.innerHeight, wide = global.innerWidth > 760; const top = r('.bt-top'), bar = r('.bt-bar'), tools = r('.wb-tools'), tile = r('.bt-who');
    const t = Math.max(top ? top.bottom : 60, T.state === 'live' && tile ? tile.bottom : 0) + 8;
    const b = H - Math.min(bar ? bar.top : H, !wide && tools ? tools.top : H) + 96;   // and room for two lines of captions
    return { top: t, left: wide && tools ? tools.right + 12 : 10, right: 12, bottom: b };
  }

  function open(o = {}) {
    if (NATIVE || T.el) return;
    Object.assign(T, { cid: o.cid || 'calc', status: o.status || T.status, onClose: o.onClose || null, changed: false, back: document.activeElement, pages: [], cards: new Map(), photo: null, board: false, muted: false, t0: 0, state: 'idle', who: 'listening', lid: '' });
    T.trial = !!(T.status && !T.status.max && T.status.trial && T.status.trial.left > 0); T.free = T.trial ? T.status.trial.left : 0; T.freeAt = Date.now();
    T.mode = liveOn() ? 'live' : 'basic'; CC.cues = []; Pace.reset();
    const el = T.el = document.createElement('div'); el.id = 'bo-talk'; el.className = 'bt'; el.dataset.mode = T.mode; el.dataset.ccSize = ccSize(); el.dataset.ccBg = ccBg();
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'bt-h');
    el.innerHTML = `<div class="bt-pad" id="bt-pad"></div><div class="bt-scrim" aria-hidden="true"></div>
      <header class="bt-top"><h2 class="sr-only" id="bt-h">Call with Bo about ${esc(short(T.cid))}</h2>
        <span class="bt-class" style="${App.classStyle ? App.classStyle(T.cid) : ''}">${esc(short(T.cid))}</span><span class="bt-clock" id="bt-clock"><i aria-hidden="true"></i><span id="bt-clock-t"></span></span><span class="bt-spacer"></span>
        <button type="button" class="bt-icon bt-pages-b" data-t="pages" aria-expanded="false" aria-controls="bt-pages" hidden title="Bo’s pages">${icon('file', 19)}<span class="bt-pages-n" id="bt-pages-n"></span><span class="sr-only">Bo’s pages</span></button>
        <button type="button" class="bt-icon bt-cc" data-t="cc" aria-pressed="${caps()}" aria-label="Captions (C)" title="Captions (C)">${icon('cc', 20)}</button><button type="button" class="bt-icon" data-t="settings" aria-label="Call settings" title="Call settings" aria-expanded="false" aria-controls="bt-set">${icon('sliders', 19)}</button></header>
      <div class="bt-set" id="bt-set" hidden></div><div class="bt-pages" id="bt-pages" hidden></div>
      <main class="bt-stage">
        <div class="bt-who"><button type="button" class="bt-orb" data-t="orb" id="bt-orb" aria-describedby="bt-status"><span class="bt-ring r3" aria-hidden="true"></span><span class="bt-ring r2" aria-hidden="true"></span><span class="bt-ring r1" aria-hidden="true"></span><span class="bt-face" aria-hidden="true">${bo(140)}</span></button>
          <p class="bt-name">Bo</p><p class="bt-status" id="bt-status" role="status" aria-live="polite"></p></div>
        <div class="bt-extra" id="bt-extra"></div>
      </main>
      <div class="bt-caps" id="bt-caps"><div class="cc-win" id="bt-cc"></div></div>
      <form class="bt-type" id="bt-type" hidden><label class="sr-only" for="bt-q">Type to Bo</label><input class="input" id="bt-q" maxlength="2000" autocomplete="off" placeholder="Type to Bo…"><button type="submit" class="btn primary" aria-label="Send">${icon('send', 17)}</button></form>
      <footer class="bt-bar">
        <button type="button" class="bt-btn" data-t="mute" id="bt-mute" aria-pressed="false"><span class="bt-btn-ic">${icon('mic', 22)}</span><span class="bt-btn-l">Mute</span></button>
        <button type="button" class="bt-btn bt-look" data-t="look" id="bt-look" title="Bo looks at what you wrote and helps"><span class="bt-btn-ic">${icon('eye', 22)}</span><span class="bt-btn-l">Show Bo</span></button>
        <label class="bt-btn" title="Put a photo of a problem on the board and show it to Bo"><span class="bt-btn-ic">${icon('image', 21)}</span><span class="bt-btn-l">Photo</span><input type="file" id="bt-file" class="sr-only" accept="image/*"></label>
        <button type="button" class="bt-btn" data-t="type" aria-expanded="false" aria-controls="bt-type"><span class="bt-btn-ic">${icon('keyboard', 22)}</span><span class="bt-btn-l">Type</span></button>
        <button type="button" class="bt-btn bt-end" data-t="end"><span class="bt-btn-ic">${icon('phoneoff', 24)}</span><span class="bt-btn-l">End</span></button>
      </footer>`;
    document.body.appendChild(el); document.documentElement.classList.add('bt-lock');
    // the board: yours for this class, kept for the next call
    T.pad = App.boPad ? App.boPad.create($('#bt-pad', el), { store: 'mh-pad:' + T.cid, dark: settings().boBoardDark === true, insets, onIdle: rev => Live.glance(rev), center: false }) : null;
    requestAnimationFrame(() => el.classList.add('open'));
    el.addEventListener('click', onClick); document.addEventListener('keydown', onKey, true);
    $('#bt-type', el).addEventListener('submit', e => { e.preventDefault(); const q = $('#bt-q', el); const t = q.value.trim(); if (!t) { q.focus(); return; } q.value = ''; sayTyped(t); });
    $('#bt-file', el).addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f || !App.shrinkPhoto) return; try { const p = await small(await App.shrinkPhoto(f, 900)); if (T.pad) T.pad.addImage(p); if (T.state === 'live') sendPhoto(p); else { T.photo = p; paintExtra(); } } catch (x) { toast(x.message); } });
    document.addEventListener('visibilitychange', onHidden); addEventListener('pagehide', onLeave);
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { T.lock = l; }).catch(() => {}); } catch (e) {}
    paintCaps(); loop();
    if (!settings().boTalkOk) { setState('idle'); hello(); return; }
    if (o.gesture !== false) begin(); else setState('idle');
    $('#bt-orb', el).focus();
  }
  /* a photo small enough for a live call's data channel (about 140 KB): smaller and softer until it fits */
  async function small(p) {
    if (!p || String(p.data || '').length < 190000) return p;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = p.preview; });
    let url = p.preview; for (const k of [0.8, 0.64, 0.5, 0.4]) { const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); url = c.toDataURL('image/jpeg', 0.76); if (url.length < 190000) break; }
    return { type: 'image/jpeg', data: url.split(',')[1] || '', preview: url };
  }
  function close() {
    if (!T.el) return; const el = T.el;
    if (T.mode === 'live') Live.stop(); else Basic.stop();
    T.el = null; clearInterval(T.clock); cancelAnimationFrame(T.raf); clearTimeout(CC.idle);
    document.removeEventListener('visibilitychange', onHidden); document.removeEventListener('keydown', onKey, true); removeEventListener('pagehide', onLeave); document.documentElement.classList.remove('bt-lock');
    try { if (T.lock) T.lock.release(); } catch (e) {} T.lock = null;
    const pad = T.pad; T.pad = null;
    el.classList.remove('open'); setTimeout(() => { if (pad) pad.destroy(); el.remove(); }, still() ? 0 : 220);
    if (T.back && T.back.focus) try { T.back.focus(); } catch (e) {}
    if (T.onClose) T.onClose(T.changed);
  }
  const onHidden = () => { if (document.visibilityState === 'hidden' && T.mode === 'basic' && T.who === 'listening') { stopListening(); who('muted'); } };
  const onLeave = () => { if (T.mode === 'live') Live.stop(); };
  function begin() {
    if (!T.el) return; $('#bt-extra', T.el).innerHTML = ''; audioCtx(); Speaker.unlock();
    if (T.mode === 'live') Live.start(); else Basic.start();
  }

  /* ---------- what the screen shows ---------- */
  function setState(s, msg) {
    T.state = s; if (!T.el) return; T.el.dataset.state = s; T.el.dataset.mode = T.mode;
    clearInterval(T.clock);
    if (s === 'live') { if (!T.t0) T.t0 = Date.now(); const tick = () => { if (T.el) $('#bt-clock-t', T.el).textContent = clockText((Date.now() - T.t0) / 1000) + (T.trial ? ` · ${Math.max(0, Math.ceil(freeLeft() / 60))} free min left` : Live.soon() ? ` · ${Math.max(1, Math.ceil(Live.leftNow() / 60))} min left` : ''); }; tick(); T.clock = setInterval(tick, 1000); }
    else $('#bt-clock-t', T.el).textContent = s === 'connecting' ? 'Calling…' : s === 'ended' ? 'Call ended' : '';
    paintStatus(msg); paintExtra();
  }
  function who(w) { T.who = w; if (!T.el) return; T.el.dataset.who = w; paintStatus(); }
  function paintStatus(msg) {
    if (!T.el) return; const L = T.mode === 'live';
    const live = { listening: L ? 'listening' : 'listening · tap Bo to send', you: 'listening…', thinking: 'thinking…', bo: L ? 'talking' : 'talking · tap Bo to cut in', muted: L ? 'you’re muted' : 'not listening · tap Bo to talk' };
    $('#bt-status', T.el).textContent = msg != null && msg !== '' ? msg : T.state === 'connecting' ? 'calling…' : T.state === 'idle' ? (settings().boTalkOk ? 'tap Bo to start the call' : '') : T.state === 'live' ? live[T.who] || '' : '';
    $('#bt-orb', T.el).setAttribute('aria-label', T.state !== 'live' ? 'Start the call' : T.who === 'bo' ? (L ? 'Stop Bo talking' : 'Cut in') : T.who === 'muted' ? 'Unmute' : L ? 'Bo' : 'Send what you said');
    const m = $('#bt-mute', T.el); m.setAttribute('aria-pressed', String(T.muted)); m.disabled = T.state !== 'live';
    $('#bt-look', T.el).disabled = T.state !== 'live';
    $('.bt-btn-ic', m).innerHTML = icon(T.muted ? 'micoff' : 'mic', 22); $('.bt-btn-l', m).textContent = T.muted ? 'Unmute' : 'Mute';
  }

  /* ---------- captions, like a video's ----------
     White on black at the bottom, two lines that roll up as the words come, who is talking in front. A cue is one
     stretch of talk by one of you; Bo's run on across his answers until you talk. They fade after a quiet spell. */
  const CC = { cues: [], idle: 0 };
  const capText = t => { t = shown(t); return App.boDraw && App.boDraw.pretty && /[$\\^]/.test(t) ? t.replace(/\$\$?([^$]+)\$\$?/g, (m, x) => App.boDraw.pretty(x)) : t; };
  const words = (t, n) => { const w = String(t).split(/\s+/).filter(Boolean); return n >= w.length ? w.join(' ') : w.slice(0, Math.max(0, n)).join(' '); };
  const nWords = t => String(t).split(/\s+/).filter(Boolean).length;
  function cue(k, text, upto, fresh) {
    if (!T.el) return; let c = CC.cues[CC.cues.length - 1];
    if (!c || c.who !== k || fresh) { c = { who: k, text: '', upto: Infinity }; CC.cues.push(c); if (CC.cues.length > 3) CC.cues.shift(); }
    c.text = String(text || ''); c.upto = upto == null ? Infinity : upto; paintCC();
  }
  function paintCC() {
    if (!T.el) return; const win = $('#bt-cc', T.el); const names = settings().boCcNames !== false;
    win.innerHTML = CC.cues.map(c => { let t = capText(c.text); if (c.upto !== Infinity) t = words(t, c.upto); t = t.trim(); if (!t) return ''; return `<p class="cc-cue cc-${c.who}"><span class="cc-t">${names ? `<b class="cc-who">${c.who === 'bo' ? 'Bo' : 'You'}</b> ` : ''}${esc(t)}</span></p>`; }).join('');
    const box = $('#bt-caps', T.el); box.classList.remove('idle'); clearTimeout(CC.idle);
    CC.idle = setTimeout(() => { if (T.el && !['bo', 'you'].includes(T.who) && !Live.talking) box.classList.add('idle'); }, 7000);
  }
  /* what you or Bo said, all of it at once (yours as you are heard; a typed message; Bo's greeting) */
  function caption(k, text) { if (k === 'you' && Pace.on) Pace.stop(true); cue(k, text, null); }
  function paintCaps() { if (!T.el) return; $('#bt-caps', T.el).classList.toggle('off', !caps()); const b = $('[data-t="cc"]', T.el); b.setAttribute('aria-pressed', String(caps())); T.el.dataset.ccSize = ccSize(); T.el.dataset.ccBg = ccBg(); paintCC(); }
  /* on a live call his transcript comes in ahead of his voice, so his words are let out at his pace while his voice
     is sounding, and all at once when he stops; when you cut in, what he did not get to say never shows */
  const Pace = {
    text: '', base: '', n: 0, all: false, cut: false, t: 0, loud: 0, began: 0, on: false,
    reset() { Object.assign(this, { text: '', base: '', n: 0, all: false, cut: false, t: 0, loud: 0, began: 0, on: false }); },
    start() {   // a new answer: it runs on from what he said just before, if you have not talked since
      const last = CC.cues[CC.cues.length - 1]; const runOn = last && last.who === 'bo';
      this.base = runOn ? words(last.text, last.upto) : ''; this.text = this.base; this.n = nWords(this.base); this.all = false; this.cut = false; this.t = 0; this.on = true;
      if (!runOn) cue('bo', '', 0, true);
    },
    add(d) { if (this.cut) return; this.text = (this.base ? this.base + ' ' : '') + (Live.boText || ''); if (!this.all) this.tick(); },
    done(said) { if (!this.cut) this.text = (this.base ? this.base + ' ' : '') + said; this.tick(); },
    stop(cut) { if (cut) { this.text = words(this.text, Math.ceil(this.n)); this.cut = true; } this.all = true; this.tick(); },
    tick() {
      if (!T.el || T.mode !== 'live' || !this.on) return; const now = performance.now(); const dt = this.t ? Math.min(0.25, (now - this.t) / 1000) : 0; this.t = now; const total = nWords(this.text);
      if (this.all) this.n = total;
      else if (Live.talking) {
        const lv = levelOf(Live.anBo); if (lv > 0.012) this.loud = now;
        const hearing = !Live.anBo || now - this.loud < 380 || now - Math.max(this.loud, this.began) > 1400;   // no sound to go by: by time
        if (hearing) this.n = Math.min(total, this.n + dt * 2.8 * liveRate());
      }
      const c = CC.cues[CC.cues.length - 1]; const show = Math.floor(this.n);
      if (!c || c.who !== 'bo' || c.text !== this.text || c.upto !== show) cue('bo', this.text, show);
      if (this.all) this.on = false;   // all of it is up: until his next answer, the captions are yours to change
    }
  };
  /* in basic voice, his words follow the sentence being read out */
  let said = '';
  function basicCaption() {
    const it = Speaker.cur; if (!T.el || T.mode !== 'basic' || !it || !it.meta || it.meta.turn !== T.turn || !it.meta.text) return;
    const sent = capText(it.meta.text); const n = nWords(said) + Math.round(nWords(sent) * Speaker.progress());
    const c = CC.cues[CC.cues.length - 1]; const text = (said ? said + ' ' : '') + sent; if (!c || c.who !== 'bo' || c.text !== text || c.upto !== n) cue('bo', text, n);
  }

  /* ---------- Bo's pages: cards on the board, next to your work ---------- */
  function card(p) {
    const n = T.pages.length; const el = document.createElement('section'); el.className = 'bb bt-card'; el.dataset.page = n; el.setAttribute('aria-label', `Bo’s page ${n}`);
    el.innerHTML = App.boBoard.shell({ id: `btc${n}`, name: `Bo · page ${n}`, extra: `<button type="button" class="bb-btn" data-btc="fold" aria-expanded="true" aria-label="Fold this page" title="Fold">${icon('minus', 16)}</button><button type="button" class="bb-btn" data-btc="hide" aria-label="Put this page away" title="Put away (Bo’s pages brings it back)">${icon('x', 16)}</button>` });
    App.boBoard.wire(el);
    // a question Bo put on the board: he hears what they picked (and the Explain / Another one buttons ask him)
    el._onAsk = t => sayTyped(t);
    el._onAnswer = r => { if (T.state !== 'live') return; const t = `(On the board I answered "${r.said}" to your question "${r.q}". ${r.ok === true ? 'That is right.' : r.ok === false ? `That is not right; the answer is ${r.answer}.` : 'Is it right?'})`; if (T.mode === 'live') Live.tell(t); else { stopListening(); Speaker.stop(); ask(t); } };
    el.addEventListener('click', e => { const b = e.target.closest('[data-btc]'); if (!b) return; if (b.dataset.btc === 'fold') { const f = el.classList.toggle('folded'); b.setAttribute('aria-expanded', String(!f)); b.setAttribute('aria-label', f ? 'Open this page' : 'Fold this page'); } else { el.hidden = true; paintPages(); } });
    return el;
  }
  /* a page Bo is writing goes up on the board (a new card, or more lines on the one he is writing); near: a place on
     the board from his last look ("D2"), to put it beside that part of your work */
  function boardPage(p, isNew, near) {
    if (!T.el || !p || !App.boBoard) return;
    let el = T.cards.get(p);
    if (isNew || !el) { if (!T.pages.includes(p)) T.pages.push(p); el = card(p); T.cards.set(p, el); if (T.pad) T.pad.addCard(el, near); else $('#bt-pad', T.el).appendChild(el); }
    App.boBoard.paint(el, [p], 0, true); el.hidden = false; el.classList.remove('folded');
    if (T.pad && !isNew) T.pad.reveal(el);
    paintPages();
  }
  function paintPages() {
    if (!T.el) return; const b = $('[data-t="pages"]', T.el); b.hidden = !T.pages.length; $('#bt-pages-n', T.el).textContent = T.pages.length || '';
    const list = $('#bt-pages', T.el); if (!list.hidden) list.innerHTML = `<h3 class="bt-set-h">Bo’s pages</h3><ul>${T.pages.map((p, i) => { const el = T.cards.get(p); return `<li><button type="button" class="bt-page-i" data-goto="${i}">${icon('pen', 14)}<span>${esc(p.title || (p.items[0] && p.items[0].k === 'draw' ? 'A drawing' : p.items[0] && p.items[0].k === 'check' ? 'A question for you' : `Page ${i + 1}`))}</span>${el && el.hidden ? '<em>put away</em>' : ''}</button></li>`; }).join('')}</ul>`;
  }
  function paintExtra() {
    if (!T.el || !settings().boTalkOk) return; const ex = $('#bt-extra', T.el);
    if (T.state === 'error' || T.state === 'ended') return;
    const photo = T.photo ? `<span class="bt-photo"><img src="${T.photo.preview}" alt="${T.board ? 'Your board' : 'Your photo'}"><span>Bo sees ${T.board ? 'the board' : 'this'} with what you say next</span><button type="button" class="bt-icon sm" data-t="unphoto" aria-label="Remove the photo">${icon('x', 14)}</button></span>` : '';
    const sug = T.state === 'live' && T.mode === 'basic' && T.who === 'muted' && App.boSuggestions ? `<div class="bt-chips">${App.boSuggestions(T.cid).slice(0, 3).map(x => `<button type="button" class="chip bt-chip" data-say="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '';
    ex.innerHTML = photo + sug;
  }
  function failed(msg, canBasic) {
    setState('error', ''); if (!T.el) return;
    $('#bt-status', T.el).textContent = 'couldn’t connect';
    $('#bt-extra', T.el).innerHTML = `<div class="bt-msg" role="alert"><p>${esc(msg)}</p><div class="bt-msg-acts"><button type="button" class="btn primary" data-t="retry">${icon('phone', 16)} Call again</button>${canBasic ? `<button type="button" class="btn" data-t="basic">Use basic voice</button>` : ''}</div></div>`;
  }
  function ended(msg, over) {
    setState('ended'); if (!T.el) return;
    // the free minutes are up: what Max is, instead of calling again
    $('#bt-extra', T.el).innerHTML = over ? `<div class="bt-msg" role="status"><p>${esc(msg)}</p><div class="bt-msg-acts"><a class="btn primary" href="#/max">${icon('zap', 16)} See Mathub Max</a><button type="button" class="btn" data-t="end">Close</button></div></div>`
      : `<div class="bt-msg" role="status"><p>${esc(msg)}</p><div class="bt-msg-acts"><button type="button" class="btn primary" data-t="retry">${icon('phone', 16)} Call again</button><button type="button" class="btn" data-t="end">Close</button></div></div>`;
  }
  // a call that may not happen (no Max, or the free minutes are gone)
  const noPlan = x => { if (x.status !== 402) return false; T.trial = false; ended(x.message, true); return true; };
  function showType(on) { if (!T.el) return; const f = $('#bt-type', T.el); f.hidden = !on; T.el.classList.toggle('typing', !!on); const b = $('[data-t="type"]', T.el); if (b) b.setAttribute('aria-expanded', String(on)); if (on) setTimeout(() => { const q = $('#bt-q', T.el); if (q) q.focus(); }, 30); }
  function micTrouble(code) {
    const msg = code === 'not-allowed' || code === 'service-not-allowed' ? 'Mathub can’t use your microphone. Allow it from the icon in the address bar, then call again. You can also type to Bo.'
      : code === 'audio-capture' ? 'No microphone was found. Plug one in, or type to Bo.' : code === 'network' ? 'Speech recognition needs the internet. Check your connection and try again.' : /^Bo |^Slow|month|long one/.test(code) ? code : 'Bo couldn’t hear that. Tap him to try again, or type.';
    if (T.mode === 'live') { failed(msg, false); showType(true); return; }
    who('muted'); paintStatus(msg); if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') showType(true);
  }

  /* first call: how it works and where your voice goes; the tap on Start lets audio play */
  function hello() {
    if (!T.el) return; const ex = $('#bt-extra', T.el);
    const live = T.mode === 'live';
    const where = live ? 'Your voice goes straight to OpenAI, whose real-time voice model Bo talks with, together with what Bo knows about your class and how you’re doing, and pictures of the board. Nothing is recorded.'
      : (SR ? 'Your browser turns what you say into text (Chrome uses Google’s speech service, Edge Microsoft’s, Safari Apple’s).' : canHear() ? 'What you say is recorded only while Bo listens, written down by OpenAI through Mathub’s server, and not kept.' : 'This browser can’t listen, so you type and Bo talks.') + (naturalOn() ? ' Bo’s voice is made by OpenAI from his written answer.' : '');
    ex.innerHTML = `<section class="bt-hello" aria-labelledby="bt-hello-h"><h3 id="bt-hello-h">${live ? 'It’s a real call' : 'Talk with Bo out loud'}</h3>
      <p>${live ? 'Just talk. Bo answers right away, waits until you’re done, and you can cut in whenever you want, like with a friend. Mute pauses your mic.' : 'Ask anything and Bo answers out loud, writing the math on the board. Tap Bo to send what you said, or to cut in.'}</p>
      <p>The whole screen is a board you share: write your work on it and tap <b>Show Bo</b>, and he reads it, marks it and helps you through it${live ? '; he also sees it as you write' : ''}.</p>
      ${T.trial ? `<p class="bt-free">${icon('zap', 16)} <b>${Math.max(1, Math.ceil(T.free / 60))} free minutes</b> with Bo, on us. No card needed.</p>` : ''}
      <p class="bt-fine">${where} ${live ? 'What you both say is saved in your chat with Bo.' : 'As in the chat, your words go to Anthropic’s AI for Bo’s reply, and what you both say is saved in your chat with Bo.'} <a href="#/policy/privacy">Privacy</a></p>
      <button type="button" class="btn primary lg" id="bt-start" data-t="start">${icon(live ? 'phone' : 'mic', 18)} ${live ? 'Start the call' : 'Start talking'}</button></section>`;
    $('#bt-start', T.el).focus();
  }

  /* the rings follow whoever is talking (still when motion is off); captions follow Bo */
  function loop() {
    cancelAnimationFrame(T.raf); if (!T.el) return;
    const tick = () => {
      if (!T.el) return;
      if (T.mode === 'live') Pace.tick(); else basicCaption();
      if (!still()) {
        const b = T.mode === 'live' ? levelOf(Live.anBo) : T.who === 'bo' ? Speaker.level() : 0, y = T.mode === 'live' && !T.muted ? levelOf(Live.anYou) : 0;
        const target = Math.max(T.target || 0, b, y * 0.9); T.target = (T.target || 0) * 0.9;
        T.lvl += (target - T.lvl) * 0.3; T.el.style.setProperty('--lvl', T.lvl.toFixed(3));
        if (T.mode === 'live' && T.state === 'live') { const k = b > 0.08 ? 'bo' : y > 0.12 ? 'you' : ''; if (k && T.el.dataset.voice !== k) T.el.dataset.voice = k; }
      }
      T.raf = requestAnimationFrame(tick);
    };
    T.raf = requestAnimationFrame(tick);
  }
  const bump = l => { T.target = Math.max(T.target || 0, l); };

  /* ---------- live: the real-time call ---------- */
  const Live = {
    pc: null, dc: null, mic: null, audio: null, anBo: null, anYou: null, lid: null, left: 0, at: 0, tick: 0, save: 0, items: new Map(), order: [], notes: [], boards: [], boText: '', youText: '', talking: false, ended: true, fns: new Map(), ran: new Set(), auto: 0, toolErr: false, looks: 0, lookAt: 0, lastLook: '', glanceT: 0,
    reset() { Object.assign(this, { pc: null, dc: null, mic: null, anBo: null, anYou: null, lid: null, left: 0, at: 0, items: new Map(), order: [], notes: [], boards: [], boText: '', youText: '', talking: false, ended: false, fns: new Map(), ran: new Set(), auto: 0, toolErr: false, looks: 0, lookAt: 0, lastLook: '' }); clearTimeout(this.glanceT); },
    leftNow() { return this.left - (Date.now() - this.at) / 1000; },
    soon() { return T.mode === 'live' && !!this.lid && this.at > 0 && this.leftNow() < 180; },
    async start() {
      const L = this; L.reset(); T.t0 = 0; setState('connecting'); who('listening');
      try { L.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { L.ended = true; return micTrouble(e && e.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture'); }
      if (!T.el) return L.stop();
      try {
        const pc = L.pc = new RTCPeerConnection();
        L.audio = L.audio || new Audio(); L.audio.autoplay = true;
        pc.ontrack = e => { const s = e.streams[0]; L.audio.srcObject = s; const p = L.audio.play && L.audio.play(); if (p && p.catch) p.catch(() => {}); L.anBo = meter(s); };
        L.mic.getTracks().forEach(t => pc.addTrack(t, L.mic)); L.anYou = meter(L.mic);
        const dc = L.dc = pc.createDataChannel('oai-events');
        dc.addEventListener('open', () => { if (!T.el || L.ended) return; T.t0 = Date.now(); setState('live'); who(T.muted ? 'muted' : 'listening'); if (T.pad && T.pad.hasInk() && watching()) L.look(false); L.send({ type: 'response.create' }); });   // Bo says hi first (and sees what is already on the board)
        dc.addEventListener('message', e => { let ev; try { ev = JSON.parse(e.data); } catch (x) { return; } L.on(ev); });
        pc.addEventListener('connectionstatechange', () => { if (['failed', 'disconnected'].includes(pc.connectionState) && T.el && T.state === 'live' && !L.ended) { L.stop(); ended('The call dropped. Check your connection and call Bo again.'); } });
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        const r = await post('ai_live_start', { lang: App.lang, class: T.cid, sdp: offer.sdp, voice: liveVoice(), speed: liveRate(), eagerness: eager(), snapshot: snap(), today: App.todayISO() });
        L.lid = r.lid; L.left = r.left; L.at = Date.now(); if (r.trial) { T.trial = true; T.free = r.left; T.freeAt = Date.now(); }
        if (!T.el || L.ended) return L.stop();
        await pc.setRemoteDescription({ type: 'answer', sdp: r.sdp });
        L.tick = setInterval(() => L.report(), 30000); L.save = setInterval(() => L.flush(false), 40000);
      } catch (x) {
        L.stop();
        if (noPlan(x)) return;
        failed(x.message && !/^Something/.test(x.message) ? x.message : 'Bo couldn’t pick up just now.', true);
      }
    },
    send(o) { const dc = this.dc; if (dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(o)); } catch (e) {} } },
    turn(id, r) { let t = this.items.get(id); if (!t) { t = { r, t: '', done: false, saved: false }; this.items.set(id || 'x' + Math.random(), t); this.order.push(id); } return t; },
    /* the pages written while Bo said this, as text for the chat ([board+: …] for more on a page from before) */
    takeBoards() { const b = this.boards.splice(0).reduce((a, x) => { const prev = a[a.length - 1]; if (x.cont && prev && prev.title === x.title) prev.items = prev.items.concat(x.items); else a.push(Object.assign({}, x)); return a; }, []); const one = x => String(x || '').replace(/\s+/g, ' ').trim(); return b.map(x => `\n[board${x.cont ? '+' : ''}: ${one(x.title)}]\n${x.items.map(it => it.k === 'code' ? `\`\`\`${it.lang || ''}\n${String(it.t || '').replace(/```/g, "'''")}\n\`\`\`` : `${it.k}: ${one(it.t)}`).join('\n')}\n[/board]`).join(''); },
    /* a tool call from Bo, run once. The name comes with the item that starts the call (response.output_item.added),
       not always with the arguments, so it is looked up by the item's id; failing that, guessed from the arguments */
    call(name, id, args) {
      if (!id || this.ran.has(id)) return; this.ran.add(id);
      if (!name) { let a = {}; try { a = JSON.parse(args || '{}'); } catch (e) {} name = a.drawing || a.drawings || (a.type && !a.items) ? 'draw_on_board' : a.question ? 'ask_on_board' : a.marks ? 'mark_on_board' : a.items || a.lines ? 'write_on_board' : a.fact ? 'remember' : ''; }
      this.tool(name, id, args);
    },
    on(ev) {
      const L = this; if (!T.el || L.ended) return;
      const fn = ev.item && ev.item.type === 'function_call' ? ev.item : null;
      if (fn) { if (fn.name) { if (fn.id) L.fns.set(fn.id, fn.name); if (fn.call_id) L.fns.set(fn.call_id, fn.name); } if (ev.type === 'response.output_item.done' || ev.type === 'conversation.item.done') L.call(fn.name, fn.call_id, fn.arguments); return; }
      switch (ev.type) {
        case 'conversation.item.added': case 'conversation.item.created': {
          const it = ev.item || {}; if (it.type !== 'message' || !it.id || L.items.has(it.id) || /^look_/.test(it.id)) break;   // a quiet look at the board is not part of the chat
          const r = it.role === 'assistant' ? 'b' : it.role === 'user' ? 'u' : ''; if (!r) break;
          const c = Array.isArray(it.content) ? it.content : []; const spoken = c.some(x => x.type === 'input_audio');
          let typed = c.map(x => x.type === 'input_text' ? x.text : x.type === 'input_image' ? '[photo]' : '').filter(Boolean).join(' ').trim();
          if (/^show_/.test(it.id)) typed = '[board] ' + c.filter(x => x.type === 'input_text').map(x => x.text).join(' ').replace(/\s*\(The picture has a grid[^)]*\)\s*$/, '').trim();
          L.items.set(it.id, { r, t: r === 'u' && !spoken ? typed : '', done: r === 'u' && !spoken, saved: false }); L.order.push(it.id); break;
        }
        case 'input_audio_buffer.speech_started': L.auto = 0; L.youText = ''; if (L.talking) Pace.stop(true); caption('you', '…'); who('you'); break;
        case 'input_audio_buffer.speech_stopped': if (!T.muted) who('thinking'); break;
        case 'conversation.item.input_audio_transcription.delta': L.youText += ev.delta || ''; caption('you', L.youText); break;
        case 'conversation.item.input_audio_transcription.completed': { const t = L.turn(ev.item_id, 'u'); t.t = String(ev.transcript || '').trim(); t.done = true; caption('you', t.t || L.youText); break; }
        case 'conversation.item.input_audio_transcription.failed': L.turn(ev.item_id, 'u').done = true; break;
        case 'response.created': L.boText = ''; Pace.start(); break;
        case 'response.output_audio_transcript.delta': case 'response.audio_transcript.delta': L.boText += ev.delta || ''; Pace.add(); break;
        case 'response.output_audio_transcript.done': case 'response.audio_transcript.done': { const said = String(ev.transcript || L.boText).trim(); L.boText = said; const t = L.turn(ev.item_id, 'b'); t.t = said + L.takeBoards(); t.done = !!said; Pace.done(said); T.changed = true; break; }
        case 'output_audio_buffer.started': L.talking = true; Pace.began = performance.now(); Pace.t = 0; who('bo'); break;
        case 'output_audio_buffer.stopped': L.talking = false; Pace.stop(false); if (T.who === 'bo' || T.who === 'thinking') who(T.muted ? 'muted' : 'listening'); break;
        case 'output_audio_buffer.cleared': L.talking = false; Pace.stop(true); if (T.who === 'bo' || T.who === 'thinking') who(T.muted ? 'muted' : 'listening'); break;
        case 'response.function_call_arguments.done': { const name = ev.name || L.fns.get(ev.item_id) || L.fns.get(ev.call_id); if (name || !ev.item_id) L.call(name, ev.call_id, ev.arguments); break; }   // without a name yet: response.output_item.done brings it
        case 'response.done': {
          // after his tools, Bo goes on: when he only used tools, when one failed (so he can fix it), or when he only said a
          // few words first ("let me sketch that"), so he walks them through what he put up. At most twice in a row.
          const out = (ev.response && ev.response.output) || []; const calls = out.some(o => o.type === 'function_call'), spoke = out.some(o => o.type === 'message');
          if (calls && (!spoke || L.toolErr || String(L.boText || '').trim().length < 70) && L.auto < 2) { L.auto++; L.send({ type: 'response.create' }); }
          L.toolErr = false; if (T.who === 'thinking' && !L.talking) who(T.muted ? 'muted' : 'listening'); break;
        }
        case 'error': if (ev.error && ev.error.message) console.warn('Bo live:', ev.error.message); break;
      }
    },
    tool(name, id, args) {
      const D = App.boDraw, BB = App.boBoard;
      let a = D ? D.json(args) : null; if (!a) { try { a = JSON.parse(args || '{}'); } catch (e) { a = {}; } }   // leniently: LaTeX with one backslash, a cut-off string…
      let out;
      // a drawing as it comes: an object, a JSON string, or its fields at the top
      const drawingOf = v => { const o = v && typeof v === 'object' ? v : typeof v === 'string' && D ? D.json(v) : null; const sp = o && D ? D.parse(o) : null; const json = sp ? JSON.stringify(o) : ''; return sp && json.length <= 8000 ? { sp, o, json } : null; };
      // lines go on the page he is writing (page: add) or a new one, beside the work it is about (near); the chat keeps them as [board] text
      const put = items => {
        const title = String(a.title || '').trim().slice(0, 90); const last = T.pages[T.pages.length - 1]; const more = a.page === 'add' && !!last && (!title || title === last.title);
        if (more) { last.items.push(...items); boardPage(last, false); } else boardPage({ title, items: items.slice(), open: false }, true, typeof a.near === 'string' ? a.near : '');
        this.boards.push({ title: more ? last.title : title, items: items.slice(), cont: more });
      };
      if (name === 'write_on_board') {
        let items = (Array.isArray(a.items) ? a.items : []).slice(0, 10).map(x => {
          if (!x || typeof x !== 'object') return typeof x === 'string' && x.trim() ? { k: 'text', t: x.trim().slice(0, 300) } : null;
          const k = BB ? BB.kind(x.kind ?? x.type) : 'text';
          if (k === 'draw') { const d = drawingOf(x.drawing ?? x.text ?? x); return d ? { k, t: d.json } : null; }
          if (k === 'check') { const o = (typeof x.text === 'string' && D && D.json(x.text)) || x; return BB && BB.check(o) ? { k, t: JSON.stringify(o) } : null; }
          if (k === 'code') return { k, t: String(x.text ?? '').replace(/\s+$/, '').slice(0, 3000), lang: String(x.lang || '').slice(0, 20) };
          return { k, t: String(x.text ?? '').trim().slice(0, 300) };
        }).filter(x => x && x.t);
        if (!items.length && a.lines) items = [].concat(a.lines).map(x => ({ k: 'math', t: String(x || '').replace(/^\$+|\$+$/g, '').trim() })).filter(x => x.t);   // the first version of the tool
        items = items.slice(0, 8); if (items.length) put(items);
        out = items.length ? { written: items.length, page: T.pages.length } : { error: 'Nothing to write: give one to six items.' };
      }
      else if (name === 'draw_on_board') {
        // a drawing (assets/board-draw.js), or a few; a bad one is refused, so he can fix it
        const top = a.type ? Object.assign({}, a, { title: undefined, page: undefined, caption: undefined, near: undefined }) : null;
        const want = Array.isArray(a.drawings) ? a.drawings.slice(0, 3) : [a.drawing ?? top];
        const ds = want.map(drawingOf).filter(Boolean);
        if (ds.length === 1 && a.caption && !ds[0].o.caption) { ds[0].o = Object.assign({}, ds[0].o, { caption: a.caption }); ds[0].json = JSON.stringify(ds[0].o); }
        if (ds.length) { put(ds.map(d => ({ k: 'draw', t: d.json }))); out = { drawn: ds.map(d => d.sp.type).join(', '), page: T.pages.length }; }
        else out = { error: `That drawing could not be drawn. Give drawing.type (one of ${(D ? D.TYPES : ['graph']).join(', ')}) and its numbers; functions use x, like "x^2 - 3".` };
      }
      else if (name === 'ask_on_board') {
        // a question on the board for the student to answer there; what they pick comes back to him as a message
        const o = { q: a.question ?? a.q, choices: a.choices, answer: a.answer, why: a.why ?? a.explanation, hint: a.hint };
        if (BB && BB.check(o)) { put([{ k: 'check', t: JSON.stringify(o) }]); out = { asked: true, page: T.pages.length, note: 'It is on the board. Stop talking and let them answer; you will be told what they picked.' }; }
        else out = { error: 'Nothing to ask: give question, and choices with the right answer (or just answer, for them to type).' };
      }
      else if (name === 'mark_on_board') {
        // marks on their own writing, at places on his last picture of the board
        const r = T.pad ? T.pad.mark(a.marks ?? a.mark ?? (a.at ? [a] : [])) : { error: 'The board is not open.' };
        out = r.marked ? Object.assign({ marked: r.marked }, r.error ? { note: r.error } : {}) : { error: r.error || 'Nothing to mark: give marks, each with at (a place like "C3") and kind.' };
      }
      else if (name === 'remember') { const f = String(a.fact || '').trim().slice(0, 140); if (f) { this.notes.push(f); toast(`Bo will remember: ${f}`, 3500); } out = { saved: !!f }; }
      else out = { error: 'There is no such tool.' };
      if (out && out.error) this.toolErr = true;
      this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: id, output: JSON.stringify(out) } });
    },
    /* Bo looks at the board: ask, he answers about it (Show Bo); otherwise he only sees it, quietly, as you write.
       Only the newest picture stays in the call, so the call does not fill up with old ones */
    look(ask, text) {
      const p = T.pad && T.pad.look(); if (!p) { if (ask) toast('Write something on the board first, then show it to Bo.', 3200); return false; }
      const id = `${ask ? 'show' : 'look'}_${++this.looks}`; const grid = T.pad.range();
      const words = ask ? `${text || 'Look at what I wrote on our board and help me with it.'} (The picture has a grid: ${grid}.)` : `(Our board right now, as I write. The picture has a grid: ${grid}.)`;
      this.send({ type: 'conversation.item.create', item: { id, type: 'message', role: 'user', content: [{ type: 'input_image', image_url: `data:${p.type};base64,${p.data}` }, { type: 'input_text', text: words }] } });
      if (this.lastLook) this.send({ type: 'conversation.item.delete', item_id: this.lastLook });
      this.lastLook = id; this.lookAt = Date.now();
      if (ask) { this.auto = 0; if (this.talking) this.hush(); this.send({ type: 'response.create' }); caption('you', 'Look at what I wrote'); who('thinking'); }
      return true;
    },
    /* you stopped writing for a moment: he gets a fresh look (at most every 9 seconds, and 80 times a call) */
    glance(rev) {
      clearTimeout(this.glanceT); if (T.mode !== 'live' || T.state !== 'live' || this.ended || !watching() || !T.pad || T.pad.lookedAt() === T.pad.rev() || this.looks >= 80) return;
      const wait = 9000 - (Date.now() - this.lookAt); if (wait > 0) { this.glanceT = setTimeout(() => this.glance(), wait); return; }
      this.look(false);
    },
    async report() {
      if (!this.lid || this.ended) return;
      try { const r = await post('ai_live_tick', { lid: this.lid }); if (r.end) { this.flush(false); this.stop(); ended(r.why || 'The call ended.', !!r.trial_over); return; } this.left = r.left; this.at = Date.now(); if (T.trial) { T.free = r.left; T.freeAt = Date.now(); } } catch (e) {}
    },
    /* what was said goes into the chat: in order, and only once it is written down (all of it when the call ends) */
    flush(end) {
      const turns = [];
      for (const id of this.order) { const t = this.items.get(id); if (!t || t.saved) continue; if (!t.done && !end) break; if (t.t) turns.push({ r: t.r, t: t.t }); t.saved = true; }
      const notes = this.notes.splice(0);
      if (!this.lid || (!turns.length && !notes.length && !end)) return;
      try { fetch(API + 'ai_live_log', { method: 'POST', credentials: 'same-origin', headers: HDR, body: JSON.stringify({ lid: this.lid, turns, notes, end: end ? 1 : 0 }), keepalive: true }).catch(() => {}); } catch (e) {}
      if (turns.length) T.changed = true;
    },
    stop() {
      const L = this; clearInterval(L.tick); clearInterval(L.save); clearTimeout(L.glanceT);
      if (!L.ended) { L.ended = true; if (L.lid) L.flush(true); }
      try { if (L.dc) L.dc.close(); } catch (e) {} try { if (L.pc) L.pc.close(); } catch (e) {}
      if (L.mic) L.mic.getTracks().forEach(t => t.stop()); if (L.audio) { try { L.audio.pause(); } catch (e) {} L.audio.srcObject = null; }
      L.pc = L.dc = L.mic = null; L.anBo = L.anYou = null; L.talking = false;
    },
    mute(on) { if (this.mic) this.mic.getAudioTracks().forEach(t => { t.enabled = !on; }); },
    hush() { this.send({ type: 'response.cancel' }); this.send({ type: 'output_audio_buffer.clear' }); },
    say(text) { this.auto = 0; this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }); this.send({ type: 'response.create' }); caption('you', text); who('thinking'); },
    /* what the student did on the board (answered his question), for Bo to pick up from; not shown as a caption */
    tell(text) { this.auto = 0; if (this.talking) this.hush(); this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }); this.send({ type: 'response.create' }); who('thinking'); },
    photo(p) { this.auto = 0; this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: `data:${p.type};base64,${p.data}` }, { type: 'input_text', text: 'Take a look at this. (I put it on our board too.)' }] } }); this.send({ type: 'response.create' }); caption('you', 'Sent a photo'); who('thinking'); },
    tune() { this.send({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: { type: 'semantic_vad', eagerness: eager(), create_response: true, interrupt_response: true } }, output: { speed: liveRate() } } } }); }
  };

  /* ---------- basic: the browser hears, the chat answers, Bo reads it out ---------- */
  const Basic = {
    async start() {
      Speaker.natural = naturalOn(); Speaker.voice = basicVoice(); Speaker.fellBack = false;
      if (T.trial) {   // without Max: the call runs on the free minutes, so it is started and reported like a live one
        setState('connecting');
        try { const r = await post('ai_call_start', { class: T.cid }); T.lid = r.lid || ''; if (r.trial) { T.free = r.left; T.freeAt = Date.now(); } } catch (x) { if (!noPlan(x)) failed(x.message, false); return; }
        if (!T.el) return; clearInterval(T.freeTick); T.freeTick = setInterval(() => Basic.report(), 30000);
      }
      T.t0 = Date.now(); setState('live'); if (!canHear()) showType(true); greet();
    },
    async report() {
      if (!T.lid || !T.el) return;
      try { const r = await post('ai_live_tick', { lid: T.lid }); if (r.end) { Basic.stop(); ended(r.why || 'The call ended.', !!r.trial_over); return; } T.free = r.left; T.freeAt = Date.now(); } catch (e) {}
    },
    stop() { T.turn++; stopListening(); Speaker.stop(); clearInterval(T.freeTick); if (T.lid) { const lid = T.lid; T.lid = ''; post('ai_live_tick', { lid, end: 1 }).catch(() => {}); } },
    orb() { if (T.who === 'bo') return interrupt(); if (T.who === 'listening' && T.listener) return T.listener.send(); if (T.who === 'thinking') { T.turn++; Speaker.stop(); return who('muted'); } T.muted = false; listen(); },
    mute(on) { if (on) { stopListening(); who('muted'); } else listen(); }
  };
  function greet() {
    const s = snap(); const name = s.name ? ` ${s.name}` : '';
    const r = s.readiness; const ex = r && r.exam && r.days >= 0 && r.days <= 14 ? ` ${r.exam} is ${r.days === 0 ? 'today' : r.days === 1 ? 'tomorrow' : `in ${r.days} days`}.` : '';
    const w = s.weak && s.weak[0] ? ` Want to go over ${s.weak[0].t}, or ask me anything?` : ' What are we working on?';
    const text = `Hey${name}! It's Bo.${ex}${w}`; T.done = false; who('bo'); said = ''; cue('bo', text, 0, true);
    Speaker.say(text, { i: 0, turn: T.turn, text }); T.done = true;
  }
  Speaker.onLevel = bump;
  Speaker.onStart = item => { if (T.mode === 'basic' && T.who === 'thinking') who('bo'); };
  Speaker.onEnd = item => { if (T.mode === 'basic' && item.meta && item.meta.turn === T.turn && item.meta.text) { said = (said ? said + ' ' : '') + capText(item.meta.text); cue('bo', said, null); } };
  Speaker.onIdle = () => {
    if (reading) { reading.classList.remove('on'); reading = null; }
    if (T.el && T.mode === 'basic' && T.who === 'bo' && T.done) after();
  };
  function after() { if (!T.el) return; if (!T.muted && canHear()) listen(); else who('muted'); }
  function stopListening() { if (T.listener) { T.listener.cancel(); T.listener = null; } }
  async function listen() {
    if (!T.el || T.mode !== 'basic') return; stopListening(); Speaker.stop();
    if (!canHear()) { showType(true); who('muted'); paintStatus('type to Bo below · he answers out loud'); return; }
    who('listening');
    const turn = T.turn;
    const h = {
      onInterim: (t, fin) => { if (turn === T.turn) { caption('you', t); if (T.who !== 'you') who('you'); } },
      onFinal: t => { if (turn !== T.turn) return; T.listener = null; ask(t); },
      onNothing: () => { if (turn !== T.turn) return; T.listener = null; who('muted'); paintStatus('didn’t catch that · tap Bo when you’re ready'); },
      onHearing: () => { if (turn === T.turn) who('thinking'); },
      onError: code => { if (turn !== T.turn) return; T.listener = null; micTrouble(code); },
      onLevel: bump
    };
    T.listener = SR && settings().boEar !== 'server' ? srListen(h) : await recListen(h);
  }
  async function ask(text) {
    if (!T.el) return;
    const turn = ++T.turn; const photo = T.photo, board = T.board; T.photo = null; T.board = false; paintExtra();
    T.done = false; caption('you', (photo ? (board ? 'With the board: ' : 'With your photo: ') : '') + text); said = ''; cue('bo', '', 0, true);
    who('thinking'); let n = 0;
    const sp = splitter(s => { if (turn !== T.turn) return; Speaker.say(s, { i: n++, turn, text: s }); }, (p, isNew) => { if (turn === T.turn) boardPage(p, isNew); }, m => { if (turn === T.turn && T.pad) T.pad.mark([m]); });
    try {
      const look = board && T.pad ? T.pad.state().look : null;
      const r = await App.boAsk(Object.assign({ class: T.cid, q: text, voice: 1, snapshot: snap(), today: App.todayISO() }, photo ? { image: { type: photo.type, data: photo.data } } : {}, look ? { pad: { cols: look.cols, rows: look.rows } } : {}, T.lid ? { lid: T.lid } : {}), d => { if (turn === T.turn) sp.push(d); });
      T.changed = true; if (turn !== T.turn) return;
      sp.end(); T.done = true;
      if (r.remembered) toast(`Bo will remember: ${r.remembered}`, 3500);
      if (!n) { const parts = []; const rs = splitter(x => parts.push(x)); rs.push(r.reply || ''); rs.end(); parts.forEach((x, i) => Speaker.say(x, { i, turn, text: x })); }
      if (Speaker.idle()) after();
    } catch (x) {
      if (turn !== T.turn) return; Speaker.stop(); T.done = true;
      if (noPlan(x)) return;
      who('muted'); paintStatus(x.message || 'Bo couldn’t answer just now · tap him to try again');
    }
  }
  function interrupt() { T.turn++; Speaker.stop(); T.muted = false; listen(); }

  /* ---------- the controls ---------- */
  function orb() {
    if (T.state === 'idle' || T.state === 'error' || T.state === 'ended') { if (!settings().boTalkOk) return; return begin(); }
    if (T.state !== 'live') return;
    if (T.mode === 'live') { if (T.muted) return mute(false); if (T.who === 'bo' || Live.talking) return Live.hush(); return; }
    Basic.orb();
  }
  function mute(on) {
    if (T.state !== 'live') return; T.muted = on === undefined ? !T.muted : on;
    if (T.mode === 'live') { Live.mute(T.muted); who(T.muted ? 'muted' : Live.talking ? 'bo' : 'listening'); } else Basic.mute(T.muted);
    paintStatus();
  }
  function sayTyped(t) {
    if (T.state !== 'live') { toast('Start the call first.'); return; }
    if (T.mode === 'live') Live.say(t); else { stopListening(); Speaker.stop(); ask(t); }
  }
  function sendPhoto(p) { if (T.mode === 'live') Live.photo(p); else { T.photo = p; T.board = false; paintExtra(); if (T.who === 'muted' || T.who === 'listening') listen(); } }
  /* Show Bo: he looks at what you wrote and helps you with it */
  function showBo() {
    if (T.state !== 'live' || !T.pad) return;
    if (T.mode === 'live') { Live.look(true); return; }
    const p = T.pad.look(); if (!p) { toast('Write something on the board first, then show it to Bo.', 3200); return; }
    T.photo = p; T.board = true; stopListening(); Speaker.stop(); ask('Look at what I wrote on our board and help me with it.');
  }

  function onClick(e) {
    if (!e.target.isConnected) return;   // a control the settings just redrew
    const say = e.target.closest('[data-say]'); if (say) { sayTyped(say.dataset.say); return; }
    const go = e.target.closest('[data-goto]'); if (go) { const p = T.pages[+go.dataset.goto]; const el = p && T.cards.get(p); if (el) { el.hidden = false; el.classList.remove('folded'); if (T.pad) T.pad.reveal(el, true); } togglePages(false); return; }
    const t = e.target.closest('[data-t]');
    if (!t) { if (!e.target.closest('#bt-set, [data-t="settings"]')) toggleSettings(false); if (!e.target.closest('#bt-pages')) togglePages(false); return; }
    const k = t.dataset.t;
    if (k === 'end') return close();
    if (k === 'orb') return orb();
    if (k === 'mute') return mute();
    if (k === 'look') return showBo();
    if (k === 'start') { setSetting('boTalkOk', Date.now()); begin(); $('#bt-orb', T.el).focus(); return; }
    if (k === 'retry') return begin();
    if (k === 'basic') { T.mode = 'basic'; return begin(); }
    if (k === 'type') { const f = $('#bt-type', T.el); showType(f.hidden); return; }
    if (k === 'cc') { setSetting('boCaptions', !caps()); paintCaps(); return; }
    if (k === 'settings') { togglePages(false); return toggleSettings(); }
    if (k === 'pages') { toggleSettings(false); return togglePages(); }
    if (k === 'unphoto') { T.photo = null; T.board = false; paintExtra(); return; }
  }
  function onKey(e) {
    if (!T.el) return;
    if (e.key === 'Escape') {
      if (e.target.closest && e.target.closest('.wb-tin')) return;   // typing on the board: Esc only stops that
      e.preventDefault(); e.stopPropagation(); const s = $('#bt-set', T.el), pg = $('#bt-pages', T.el); if (!s.hidden) toggleSettings(false); else if (!pg.hidden) togglePages(false); else close(); return;
    }
    const typing = e.target.closest && e.target.closest('input, textarea, select');
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === 'm' || e.key === 'M') { mute(); return; }
      if (e.key === 'c' || e.key === 'C') { setSetting('boCaptions', !caps()); paintCaps(); return; }
    }
    if ((e.key === ' ' || e.code === 'Space') && !typing && !e.target.closest('button, label, a, summary, .bd-live')) { e.preventDefault(); orb(); return; }
    if (e.key === 'Tab') {   // keep focus inside the call
      const f = $$('button:not([disabled]), [href], input, select, [tabindex="0"]', T.el).filter(x => x.offsetParent !== null && !x.closest('[hidden]')); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  function togglePages(on) {
    if (!T.el) return; const s = $('#bt-pages', T.el); const b = $('[data-t="pages"]', T.el); const show = on === undefined ? s.hidden : on; if (show === !s.hidden) return;
    s.hidden = !show; b.setAttribute('aria-expanded', String(show)); if (show) { paintPages(); const f = $('button', s); if (f) f.focus(); }
  }

  /* ---------- the call's settings ---------- */
  function toggleSettings(on) {
    if (!T.el) return; const s = $('#bt-set', T.el); const b = $('[data-t="settings"]', T.el); const show = on === undefined ? s.hidden : on;
    const had = s.contains(document.activeElement);
    s.hidden = !show; b.setAttribute('aria-expanded', String(show)); if (show) { paintSettings(); const f = $('input, select, button', s); if (f) f.focus(); } else if (had) b.focus();
  }
  function paintSettings() {
    if (!T.el) return; const s = $('#bt-set', T.el); if (s.hidden) return;
    const V = (T.status && T.status.voice) || {}; const live = T.mode === 'live';
    const radios = (name, entries, cur) => entries.map(([k, l]) => `<label class="bt-opt"><input type="radio" name="${name}" value="${esc(k)}"${cur === k ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('');
    const chips = (list, cur, attr, fmt) => list.map(r => `<button type="button" role="radio" class="chip toggle${cur === r ? ' on' : ''}" aria-checked="${cur === r}" ${attr}="${r}">${fmt(r)}</button>`).join('');
    let html;
    if (live) {
      html = `<h3 class="bt-set-h">Bo’s voice</h3><div class="bt-opts" role="radiogroup" aria-label="Bo's voice">${radios('bt-lv', Object.entries(liveVoices()), liveVoice())}</div><p class="bt-fine">A new voice starts with your next call.</p>
        <h3 class="bt-set-h">How fast he talks</h3><div class="bt-speed" role="radiogroup" aria-label="Speed">${chips(LIVE_RATES, liveRate(), 'data-lrate', r => r === 1 ? 'Normal' : r + '×')}</div>
        <h3 class="bt-set-h">When Bo jumps in</h3><div class="bt-speed" role="radiogroup" aria-label="When Bo jumps in">${chips(['low', 'auto', 'high'], eager(), 'data-eager', r => ({ low: 'Lets me finish', auto: 'Normal', high: 'Quick' })[r])}</div>`;
    } else {
      const cur = settings().boVoice === 'device' || !V.natural ? 'device' : basicVoice();
      const dv = deviceVoices(); const best = bestVoice();
      html = `<h3 class="bt-set-h">Bo’s voice</h3><div class="bt-opts" role="radiogroup" aria-label="Bo's voice">${V.natural ? radios('bt-voice', Object.entries(V.voices || {}), cur) : ''}<label class="bt-opt"><input type="radio" name="bt-voice" value="device"${cur === 'device' ? ' checked' : ''}><span>This device’s voice</span></label></div>
        ${cur === 'device' && dv.length ? `<label class="bt-set-l" for="bt-dv">Device voice</label><select class="input" id="bt-dv">${dv.map(v => `<option value="${esc(v.name)}"${best && v.name === best.name ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : ''}
        <h3 class="bt-set-h">How fast he talks</h3><div class="bt-speed" role="radiogroup" aria-label="Speed">${chips(RATES, Speaker.rate(), 'data-rate', r => r === 1 ? 'Normal' : r + '×')}</div>
        ${!V.live ? '<p class="bt-fine">Live calls, with Bo’s natural real-time voice, are not switched on here yet, so this is basic voice.</p>' : ''}`;
    }
    html += `<h3 class="bt-set-h">Captions</h3><label class="bt-switch"><input type="checkbox" id="bt-cp"${caps() ? ' checked' : ''}><span><b>Captions</b> What you and Bo say, at the bottom (C)</span></label>
      <div class="bt-cc-opts"${caps() ? '' : ' hidden'}><span class="bt-set-l">Size</span><div class="bt-speed" role="radiogroup" aria-label="Caption size">${chips(CC_SIZES, ccSize(), 'data-ccsize', r => ({ s: 'Small', m: 'Normal', l: 'Large', xl: 'Huge' })[r])}</div>
        <span class="bt-set-l">Background</span><div class="bt-speed" role="radiogroup" aria-label="Caption background">${chips(CC_BGS, ccBg(), 'data-ccbg', r => ({ box: 'See-through', solid: 'Solid', outline: 'None' })[r])}</div>
        <label class="bt-switch"><input type="checkbox" id="bt-ccn"${settings().boCcNames !== false ? ' checked' : ''}><span><b>Names</b> Show who is talking</span></label></div>
      <h3 class="bt-set-h">The board</h3>
      ${live ? `<label class="bt-switch"><input type="checkbox" id="bt-bw"${watching() ? ' checked' : ''}><span><b>Bo sees it as I write</b> A picture of the board goes to Bo when you stop writing for a moment, so he can follow along</span></label>` : ''}
      <label class="bt-switch"><input type="checkbox" id="bt-bd"${settings().boBoardDark === true ? ' checked' : ''}><span><b>Dark board</b> Light ink on a dark board</span></label>
      ${V.live && global.RTCPeerConnection ? `<h3 class="bt-set-h">The call</h3><label class="bt-switch"><input type="checkbox" id="bt-bm"${settings().boMode === 'basic' ? ' checked' : ''}><span><b>Basic voice</b> For slow connections: Bo answers in turns instead of live (from your next call)</span></label>` : ''}
      ${!live ? `<button type="button" class="btn sm" id="bt-try">${icon('play', 14)} Hear Bo</button>` : ''}`;
    s.innerHTML = html;
    s.onchange = e => {
      const t = e.target;
      if (t.name === 'bt-lv') { setSetting('boLiveVoice', t.value); }
      if (t.name === 'bt-voice') { setSetting('boVoice', t.value); Speaker.natural = naturalOn(); if (t.value !== 'device') Speaker.voice = t.value; paintSettings(); }
      if (t.id === 'bt-dv') setSetting('boDeviceVoice', t.value);
      if (t.id === 'bt-cp') { setSetting('boCaptions', t.checked); paintCaps(); const o = $('.bt-cc-opts', s); if (o) o.hidden = !t.checked; }
      if (t.id === 'bt-ccn') { setSetting('boCcNames', t.checked); paintCC(); }
      if (t.id === 'bt-bw') setSetting('boWatch', t.checked);
      if (t.id === 'bt-bd') { setSetting('boBoardDark', t.checked); if (T.pad) T.pad.dark(t.checked); }
      if (t.id === 'bt-bm') setSetting('boMode', t.checked ? 'basic' : '');
    };
    s.onclick = e => {
      const pick = (attr, key, cast) => { const r = e.target.closest(`[${attr}]`); if (!r) return false; setSetting(key, cast(r.getAttribute(attr))); $$(`[${attr}]`, s).forEach(x => { const on = x === r; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); return true; };
      if (pick('data-lrate', 'boLiveRate', Number)) { Live.tune(); return; }
      if (pick('data-eager', 'boEager', String)) { Live.tune(); return; }
      if (pick('data-rate', 'boRate', Number)) return;
      if (pick('data-ccsize', 'boCcSize', String) || pick('data-ccbg', 'boCcBg', String)) { paintCaps(); if (!CC.cues.length) cue('bo', 'This is how captions look.', null, true); return; }
      if (e.target.closest('#bt-try')) { Speaker.unlock(); Speaker.stop(); Speaker.say('Hi, I’m Bo. This is how I sound.', { i: -1, turn: -1 }); }
    };
  }
  if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', () => { if (T.el) paintSettings(); });

  /* ---------- Read aloud, for answers in the chat ---------- */
  let reading = null;
  function read(text, btn, status) {
    if (status) T.status = status;
    if (reading) { const was = reading; reading = null; Speaker.stop(); was.classList.remove('on'); if (was === btn) return; }
    Speaker.natural = naturalOn(); Speaker.voice = basicVoice();
    Speaker.unlock(); Speaker.stop(); reading = btn; if (btn) btn.classList.add('on');
    const parts = []; const sp = splitter(s => parts.push(s), () => {}); sp.push(text); sp.end();
    parts.forEach((s, i) => Speaker.say(s, { i, turn: -1 }));
  }
  // leaving the page ends the call and stops reading aloud
  addEventListener('hashchange', () => { if (T.el) close(); else if (reading) { reading.classList.remove('on'); reading = null; Speaker.stop(); } });

  App.boTalk = { supported: () => !NATIVE, open, close, read, isOpen: () => !!T.el, setStatus: s => { T.status = s; }, _sayable: sayable, _splitter: splitter, _markOf: markOf };
})(window);
