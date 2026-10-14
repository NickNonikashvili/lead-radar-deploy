/* ============================================================
   Mathub — Talk with Bo (assets/talk.js): a voice call with Bo, the AI tutor, on the website.
   The student talks; Bo listens, thinks, answers out loud and writes the math on a whiteboard.
   - Hearing: the browser's own speech recognition (Chrome, Edge, Safari), with live captions. Where there is
     none (Firefox) and the server has speech switched on, a short recording is turned into text by the
     server (api/ai.php, ai_listen). Bo never listens while he talks, so he does not hear himself.
   - Answers stream from the server (ai_tutor with voice and stream): Bo starts talking as soon as his first
     sentence is written. Formulas go on the board ([board: ...]) and are never read aloud.
   - Bo's voice: a natural voice from the server (ai_speak) when it is switched on, otherwise the best voice
     this device has. Speed, voice, hands-free and captions are in the call's settings.
   - Hands-free: after Bo talks he listens again. Tap Bo, the big button or Space to talk, to send what you
     said, or to interrupt him; Esc ends the call. Every turn is saved in the chat with Bo.
   - Also here: "Read aloud" for any answer in the chat (App.boTalk.read).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
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
  const sayable = t => String(t || '').replace(/\[(board|remember):[^\]]*\]/gi, ' ').replace(/\$\$?([^$]+)\$\$?/g, (m, x) => mathWords(x))
    .replace(/\*\*|__|`/g, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '').replace(/\s+/g, ' ').trim();
  const shown = t => String(t || '').replace(/\[(board|remember):[^\]]*\]/gi, ' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  /* splits a reply that is still being written into whole sentences; a finished [board: …] goes on the board at once */
  function splitter(onSentence, onBoard) {
    let buf = '';
    function drain(final) {
      let b; while ((b = /\[board:\s*([^\]]*)\]/i.exec(buf))) { onBoard(b[1].trim()); buf = buf.slice(0, b.index) + ' ' + buf.slice(b.index + b[0].length); }
      buf = buf.replace(/\[remember:[^\]]*\]/gi, ' ');
      const open = buf.lastIndexOf('['); const hold = open >= 0 && buf.indexOf(']', open) < 0 ? open : buf.length;
      let start = 0, math = false;
      for (let i = 0; i < hold; i++) {
        const c = buf[i]; if (c === '$') math = !math; if (math) continue;
        if (c === '\n' || (/[.!?]/.test(c) && i + 1 < hold && /\s/.test(buf[i + 1]))) { const s = buf.slice(start, i + 1).trim(); if (s) onSentence(s); start = i + 1; }
      }
      buf = buf.slice(start);
      if (final) { const rest = buf.replace(/\[[^\]]*$/, '').trim(); if (rest) onSentence(rest); buf = ''; }
    }
    return { push(t) { buf += t; drain(false); }, end() { drain(true); } };
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
  if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', () => { if (T.el) paintSettings(); });

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
      return fetch(API + 'ai_speak', { method: 'POST', credentials: 'same-origin', headers: HDR, body: JSON.stringify({ text, voice: this.voice }), signal })
        .then(async r => { if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || 'Bo\'s voice is not available.'), { status: r.status }); } return URL.createObjectURL(await r.blob()); });
    },
    stop() { this.gen++; this.queue.forEach(q => { if (q.ctl) q.ctl.abort(); }); this.queue = []; this.busy = false; try { if (this.audio) this.audio.pause(); } catch (e) {} try { if (synth) synth.cancel(); } catch (e) {} },
    idle() { return !this.busy && !this.queue.length; },
    async pump() {
      if (this.busy) return; const item = this.queue.shift(); if (!item) { if (this.onIdle) this.onIdle(); return; }
      this.busy = true; const g = this.gen; if (this.onStart) this.onStart(item);
      try {
        if (item.url) { let url; try { url = await item.url; } catch (e) { if (g !== this.gen) return; this.fallBack(e); } if (g !== this.gen) return; if (url) await this.play(url); else await this.speak(item.said); }
        else await this.speak(item.said);
      } catch (e) { if (g === this.gen && item.url) { this.fallBack(e); await this.speak(item.said).catch(() => {}); } }
      if (g !== this.gen) return;
      this.busy = false; this.pump();
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
        const u = new SpeechSynthesisUtterance(text); const v = bestVoice(); if (v) u.voice = v; u.lang = (v && v.lang) || 'en-US'; u.rate = this.rate();
        let done = false; const fin = () => { if (done) return; done = true; clearTimeout(wd); res(); };
        u.onend = fin; u.onerror = fin; u.onboundary = () => { if (this.onLevel) this.onLevel(0.55 + Math.random() * 0.45); };
        const wd = setTimeout(fin, 3000 + text.split(/\s+/).length * 520 / this.rate());   // some browsers never say they finished
        synth.speak(u);
      });
    },
    level() { if (!this.analyser || !this.busy || !this.audio || this.audio.paused) return 0; const d = new Uint8Array(this.analyser.fftSize); this.analyser.getByteTimeDomainData(d); let s = 0; for (const x of d) { const v = (x - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / d.length) * 5); }
  };

  /* ---------- Bo's ears ---------- */
  /* the browser's own speech recognition: live words, and the turn ends after a short silence */
  function srListen(h) {
    const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
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
        const r = await post('ai_listen', { audio: { type: blob.type, data }, secs: Math.max(1, Math.round(((loud || Date.now()) - t0) / 1000) + 1), class: T.cid });
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

  /* ---------- the call ---------- */
  const T = { el: null, cid: null, state: 'idle', status: null, listener: null, turn: 0, done: true, caption: [], now: -1, board: [], boardTurn: -1, photo: null, changed: false, onClose: null, back: null, lvl: 0, target: 0, raf: 0, lock: null };
  const canHear = () => !!SR || !!(T.status && T.status.voice && T.status.voice.listen && navigator.mediaDevices && global.MediaRecorder);
  const naturalOn = () => !!(T.status && T.status.voice && T.status.voice.natural) && settings().boVoice !== 'device';
  const hands = () => settings().boHands !== false;
  const caps = () => settings().boCaptions !== false;
  const ear = () => (SR ? 'browser' : 'server');

  function open(o = {}) {
    if (NATIVE || T.el) return;
    T.cid = o.cid; T.status = o.status || T.status; T.onClose = o.onClose || null; T.changed = false; T.back = document.activeElement; T.caption = []; T.board = []; T.boardTurn = -1; T.photo = null; T.turn++;
    Speaker.natural = naturalOn(); Speaker.voice = (T.status && T.status.voice && T.status.voice.voices && T.status.voice.voices[settings().boVoice]) ? settings().boVoice : ((T.status && T.status.voice && T.status.voice.default) || 'ash'); Speaker.fellBack = false;
    const el = T.el = document.createElement('div'); el.id = 'bo-talk'; el.className = 'bt'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'bt-h');
    el.innerHTML = `<header class="bt-top"><h2 class="sr-only" id="bt-h">Talking with Bo about ${esc(short(T.cid))}</h2><span class="bt-class" style="${App.classStyle ? App.classStyle(T.cid) : ''}">${esc(short(T.cid))}</span><span class="bt-mode" id="bt-mode"></span>
        <button type="button" class="bt-icon" data-t="settings" aria-label="Voice settings" aria-expanded="false" aria-controls="bt-set">${icon('sliders', 19)}</button><button type="button" class="bt-icon" data-t="end" aria-label="End the call">${icon('x', 20)}</button></header>
      <div class="bt-set" id="bt-set" hidden></div>
      <main class="bt-stage">
        <button type="button" class="bt-orb" data-t="main" id="bt-orb" aria-describedby="bt-status"><span class="bt-ring r2" aria-hidden="true"></span><span class="bt-ring r1" aria-hidden="true"></span><span class="bt-face" aria-hidden="true">${bo(132)}</span></button>
        <p class="bt-status" id="bt-status" role="status" aria-live="polite"></p>
        <section class="bt-board" id="bt-board" hidden aria-labelledby="bt-board-h"><div class="bt-board-h"><span id="bt-board-h">${icon('pen', 15)} Bo's board</span><button type="button" class="bt-icon sm" data-t="board-x" aria-label="Hide the board">${icon('x', 15)}</button></div><div class="bt-board-body" id="bt-board-body"></div></section>
        <div class="bt-caps" id="bt-caps"><p class="bt-you" id="bt-you"></p><p class="bt-bo" id="bt-bo"></p></div>
        <div class="bt-extra" id="bt-extra"></div>
      </main>
      <form class="bt-type" id="bt-type" hidden><label class="sr-only" for="bt-q">Type to Bo</label><input class="input" id="bt-q" maxlength="2000" autocomplete="off" placeholder="Type to Bo…"><button type="submit" class="btn primary" aria-label="Send">${icon('send', 17)}</button></form>
      <footer class="bt-bar">
        <label class="bt-btn" title="Show Bo a photo of a problem"><span class="bt-btn-ic">${icon('image', 22)}</span><span>Photo</span><input type="file" id="bt-file" class="sr-only" accept="image/*"></label>
        <button type="button" class="bt-btn bt-main" data-t="main" id="bt-main"><span class="bt-btn-ic" id="bt-main-ic">${icon('mic', 30)}</span><span id="bt-main-l">Talk</span></button>
        <button type="button" class="bt-btn" data-t="type" aria-controls="bt-type" aria-expanded="false"><span class="bt-btn-ic">${icon('pen', 21)}</span><span>Type</span></button>
        <button type="button" class="bt-btn bt-end" data-t="end"><span class="bt-btn-ic">${icon('x', 24)}</span><span>End</span></button>
      </footer>`;
    document.body.appendChild(el); document.documentElement.classList.add('bt-lock');
    requestAnimationFrame(() => el.classList.add('open'));
    el.addEventListener('click', onClick); document.addEventListener('keydown', onKey, true);
    $('#bt-type', el).addEventListener('submit', e => { e.preventDefault(); const q = $('#bt-q', el); const t = q.value.trim(); if (!t) { q.focus(); return; } q.value = ''; Speaker.unlock(); stopListening(); ask(t); });
    $('#bt-file', el).addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f || !App.shrinkPhoto) return; try { T.photo = await App.shrinkPhoto(f); paintExtra(); if (T.state === 'idle' || T.state === 'error') { Speaker.unlock(); listen(); } } catch (x) { toast(x.message); } });
    document.addEventListener('visibilitychange', onHidden);
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { T.lock = l; }).catch(() => {}); } catch (e) {}
    paintMode(); loop();
    if (!canHear()) showType(true);
    if (!settings().boTalkOk) { setState('idle'); hello(); $('#bt-status', el).textContent = ''; $('#bt-start', el).focus(); return; }
    if (o.gesture !== false) { Speaker.unlock(); greet(); } else setState('idle');
    $('#bt-main', el).focus();
  }
  function close() {
    if (!T.el) return; const el = T.el; T.el = null; T.turn++;
    stopListening(); Speaker.stop(); cancelAnimationFrame(T.raf);
    document.removeEventListener('visibilitychange', onHidden); document.removeEventListener('keydown', onKey, true); document.documentElement.classList.remove('bt-lock');
    try { if (T.lock) T.lock.release(); } catch (e) {} T.lock = null;
    el.classList.remove('open'); setTimeout(() => el.remove(), still() ? 0 : 200);
    if (T.back && T.back.focus) try { T.back.focus(); } catch (e) {}
    if (T.onClose) T.onClose(T.changed);
  }
  const onHidden = () => { if (document.visibilityState === 'hidden' && T.state === 'listening') { stopListening(); setState('idle'); } };

  /* first time: what talking does and where the words go; the tap on Start also lets audio play */
  function hello() {
    const ex = $('#bt-extra', T.el); $('#bt-caps', T.el).hidden = true;
    const hear = SR ? 'Your browser turns what you say into text (Chrome uses Google’s speech service, Edge Microsoft’s, Safari Apple’s).' : canHear() ? 'What you say is recorded only while Bo listens, turned into text by OpenAI through Mathub’s server, and not kept.' : 'This browser cannot listen, so you type and Bo talks.';
    ex.innerHTML = `<section class="bt-hello" aria-labelledby="bt-hello-h"><h3 id="bt-hello-h">Talk with Bo out loud</h3>
      <p>Ask anything and Bo answers out loud, writing the math on his board. The microphone is on only while the ring is blue.</p>
      <p class="bt-fine">${hear} ${naturalOn() ? 'Bo’s voice is made by OpenAI from his written answer. ' : ''}As in the chat, your words go to Anthropic’s AI for Bo’s reply, and the conversation is saved in your chat with Bo. <a href="#/policy/privacy">Privacy</a></p>
      <button type="button" class="btn primary lg" id="bt-start" data-t="start">${icon('mic', 18)} Start talking</button></section>`;
  }
  function greet() {
    const s = App.tutorSnapshot ? App.tutorSnapshot(T.cid) : {}; const name = s.name ? ` ${s.name}` : '';
    const r = s.readiness; const ex = r && r.exam && r.days >= 0 && r.days <= 14 ? ` ${r.exam} is ${r.days === 0 ? 'today' : r.days === 1 ? 'tomorrow' : `in ${r.days} days`}.` : '';
    const w = s.weak && s.weak[0] ? ` Want to go over ${s.weak[0].t}, or ask me anything?` : ' What are we working on?';
    const text = `Hey${name}! It's Bo.${ex}${w}`;
    T.caption = [text]; T.now = 0; paintCaps(''); T.done = false; setState('speaking');
    Speaker.say(text, { i: 0, turn: T.turn }); T.done = true;
  }

  function setState(s, msg) {
    T.state = s; if (!T.el) return; T.el.dataset.state = s;
    const L = { idle: ['Tap Bo or the button to talk', 'mic', 'Talk'], listening: ['Listening…', 'send', 'Send'], hearing: ['Got it. One moment…', 'mic', 'Talk'], thinking: ['Bo is thinking…', 'stop', 'Stop'], speaking: ['Bo is talking. Tap him to cut in.', 'mic', 'Cut in'], error: ['', 'rotate', 'Try again'] }[s];
    $('#bt-status', T.el).textContent = msg != null && msg !== '' ? msg : L[0];
    $('#bt-main-ic', T.el).innerHTML = icon(L[1], 30); $('#bt-main-l', T.el).textContent = L[2];
    $('#bt-orb', T.el).setAttribute('aria-label', s === 'listening' ? 'Send what you said' : s === 'speaking' ? 'Cut in and talk' : s === 'thinking' ? 'Stop waiting' : 'Talk to Bo');
    $('#bt-main', T.el).disabled = s === 'hearing';
    paintExtra();
  }
  function paintMode() { if (!T.el) return; $('#bt-mode', T.el).textContent = hands() ? 'Hands-free' : ''; $('#bt-caps', T.el).classList.toggle('off', !caps()); }
  function you(text, live) { if (!T.el) return; const y = $('#bt-you', T.el); y.textContent = text; y.classList.toggle('live', !!live); }
  function paintCaps(youText) {
    if (!T.el) return; if (youText !== undefined) you(youText, false);
    const b = $('#bt-bo', T.el); b.innerHTML = T.caption.map((s, i) => `<span class="${i < T.now ? 'said' : i === T.now ? 'now' : 'next'}">${esc(shown(s))}</span>`).join(' ');
    if (T.caption.some(s => s.includes('$')) && App.typeset) App.typeset(b);
  }
  function board(line) {
    if (!T.el || !line) return;
    if (T.boardTurn !== T.turn) { T.board = []; T.boardTurn = T.turn; }
    T.board.push(line); T.board = T.board.slice(-4);
    const box = $('#bt-board', T.el); box.hidden = false; T.el.classList.add('has-board');
    const body = $('#bt-board-body', T.el); body.innerHTML = T.board.map(l => `<div class="bt-board-line">${esc(l)}</div>`).join('');
    if (App.typeset) App.typeset(body);
  }
  function paintExtra() {
    if (!T.el || !settings().boTalkOk) return; const ex = $('#bt-extra', T.el); $('#bt-caps', T.el).hidden = false;
    const photo = T.photo ? `<span class="bt-photo"><img src="${T.photo.preview}" alt="Your photo"><span>Bo sees this with your next question</span><button type="button" class="bt-icon sm" data-t="unphoto" aria-label="Remove the photo">${icon('x', 14)}</button></span>` : '';
    const sug = (T.state === 'idle' || T.state === 'error') && App.boSuggestions ? `<div class="bt-chips">${App.boSuggestions(T.cid).slice(0, 3).map(x => `<button type="button" class="chip bt-chip" data-say="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '';
    ex.innerHTML = photo + sug;
  }
  function showType(on) { if (!T.el) return; const f = $('#bt-type', T.el); f.hidden = !on; const b = $('[data-t="type"]', T.el); if (b) b.setAttribute('aria-expanded', String(on)); if (on) setTimeout(() => { const q = $('#bt-q', T.el); if (q && document.activeElement !== q && !canHear()) q.focus(); }, 50); }

  /* the level of the voice or the microphone moves the rings (not when motion is off) */
  function loop() {
    cancelAnimationFrame(T.raf); if (!T.el) return;
    const tick = () => {
      if (!T.el) return;
      if (!still()) { const sp = T.state === 'speaking' ? Speaker.level() : 0; T.target = Math.max(T.target * 0.92, sp); T.lvl += (T.target - T.lvl) * 0.35; T.el.style.setProperty('--lvl', T.lvl.toFixed(3)); }
      T.raf = requestAnimationFrame(tick);
    };
    T.raf = requestAnimationFrame(tick);
  }
  const bump = l => { T.target = Math.max(T.target, l); };
  Speaker.onLevel = bump;
  Speaker.onStart = item => { if (item.meta && item.meta.turn === T.turn) { T.now = item.meta.i; paintCaps(); if (T.state === 'thinking') setState('speaking'); } };
  Speaker.onIdle = () => {
    if (reading) { reading.classList.remove('on'); reading = null; }
    if (T.el && T.state === 'speaking' && T.done) { T.now = T.caption.length; paintCaps(); after(); }
  };
  function after() { if (!T.el) return; if (hands() && canHear()) listen(); else setState('idle'); }

  function stopListening() { if (T.listener) { T.listener.cancel(); T.listener = null; } }
  async function listen() {
    if (!T.el) return; stopListening(); Speaker.stop();
    if (!canHear()) { showType(true); setState('idle', 'Type to Bo below. He answers out loud.'); return; }
    setState('listening'); you('', true);
    const turn = T.turn;
    const h = {
      onInterim: (t, fin) => { if (turn === T.turn) you(t, !fin); },
      onFinal: t => { if (turn !== T.turn) return; T.listener = null; ask(t); },
      onNothing: () => { if (turn !== T.turn) return; T.listener = null; you(''); setState('idle', 'I didn’t catch that. Tap Bo when you’re ready.'); },
      onHearing: () => { if (turn === T.turn) setState('hearing'); },
      onError: code => { if (turn !== T.turn) return; T.listener = null; micTrouble(code); },
      onLevel: bump
    };
    T.listener = SR && settings().boEar !== 'server' ? srListen(h) : await recListen(h);
  }
  function micTrouble(code) {
    const msg = code === 'not-allowed' || code === 'service-not-allowed' ? 'Mathub can’t use your microphone. Allow it from the icon in the address bar, then tap Bo. You can also type.'
      : code === 'audio-capture' ? 'No microphone was found. Plug one in, or type to Bo.' : code === 'network' ? 'Speech recognition needs the internet. Check your connection and tap Bo again.' : /^Bo |^Slow|month|long one/.test(code) ? code : 'Bo couldn’t hear that. Tap him to try again, or type.';
    setState('error', msg); if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') showType(true);
  }

  async function ask(text) {
    if (!T.el) return;
    const turn = ++T.turn; const photo = T.photo; T.photo = null;
    T.caption = []; T.now = -1; T.done = false; you((photo ? 'With your photo: ' : '') + text, false); paintCaps();
    setState('thinking');
    const sp = splitter(s => { if (turn !== T.turn) return; const i = T.caption.length; T.caption.push(s); paintCaps(); Speaker.say(s, { i, turn }); }, b => { if (turn === T.turn) board(b); });
    try {
      const r = await App.boAsk(Object.assign({ class: T.cid, q: text, voice: 1, snapshot: App.tutorSnapshot ? App.tutorSnapshot(T.cid) : {}, today: App.todayISO() }, photo ? { image: { type: photo.type, data: photo.data } } : {}), d => { if (turn === T.turn) sp.push(d); });
      T.changed = true; if (turn !== T.turn) return;
      sp.end(); T.done = true;
      if (r.remembered) toast(`Bo will remember: ${r.remembered}`, 3500);
      if (!T.caption.length) { T.caption = [shown(r.reply)]; paintCaps(); Speaker.say(r.reply, { i: 0, turn }); }
      if (Speaker.idle()) { T.now = T.caption.length; paintCaps(); after(); }
    } catch (x) {
      if (turn !== T.turn) return; Speaker.stop(); T.done = true;
      if (x.status === 402) { setState('error', x.message); setTimeout(() => { close(); App.rerender(); }, 2500); return; }
      setState('error', x.message || 'Bo could not answer just now. Tap him to try again.');
    }
  }
  function interrupt() { T.turn++; Speaker.stop(); T.now = T.caption.length; paintCaps(); listen(); }
  function main() {
    Speaker.unlock();
    if (T.state === 'listening') { if (T.listener) T.listener.send(); return; }
    if (T.state === 'hearing') return;
    if (T.state === 'thinking') { T.turn++; Speaker.stop(); setState('idle', 'Stopped. Tap Bo to talk.'); return; }
    if (T.state === 'speaking') { interrupt(); return; }
    listen();
  }

  function onClick(e) {
    if (!e.target.isConnected) return;   // a control the settings just redrew
    const t = e.target.closest('[data-t]'); const say = e.target.closest('[data-say]');
    if (say) { Speaker.unlock(); stopListening(); ask(say.dataset.say); return; }
    if (!t) { if (!e.target.closest('#bt-set, [data-t="settings"]')) toggleSettings(false); return; }
    const k = t.dataset.t;
    if (k === 'end') return close();
    if (k === 'main') return main();
    if (k === 'start') { setSetting('boTalkOk', Date.now()); Speaker.unlock(); $('#bt-caps', T.el).hidden = false; paintExtra(); greet(); $('#bt-main', T.el).focus(); return; }
    if (k === 'type') { const f = $('#bt-type', T.el); showType(f.hidden); if (!f.hidden) $('#bt-q', T.el).focus(); return; }
    if (k === 'settings') return toggleSettings();
    if (k === 'board-x') { $('#bt-board', T.el).hidden = true; T.el.classList.remove('has-board'); return; }
    if (k === 'unphoto') { T.photo = null; paintExtra(); return; }
  }
  function onKey(e) {
    if (!T.el) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const s = $('#bt-set', T.el); if (!s.hidden) toggleSettings(false); else close(); return; }
    const typing = e.target.closest && e.target.closest('input, textarea, select');
    if ((e.key === ' ' || e.code === 'Space') && !typing && !e.target.closest('button, label, a, summary')) { e.preventDefault(); main(); return; }
    if (e.key === 'Tab') {   // keep focus inside the call
      const f = $$('button:not([disabled]), [href], input, select', T.el).filter(x => x.offsetParent !== null && !x.closest('[hidden]')); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  /* ---------- the call's settings: voice, speed, hands-free, captions ---------- */
  function toggleSettings(on) {
    if (!T.el) return; const s = $('#bt-set', T.el); const b = $('[data-t="settings"]', T.el); const show = on === undefined ? s.hidden : on;
    const had = s.contains(document.activeElement);
    s.hidden = !show; b.setAttribute('aria-expanded', String(show)); if (show) { paintSettings(); const f = $('input, select, button', s); if (f) f.focus(); } else if (had) b.focus();
  }
  function paintSettings() {
    if (!T.el) return; const s = $('#bt-set', T.el); if (s.hidden) return;
    const V = (T.status && T.status.voice) || {}; const cur = settings().boVoice === 'device' || !V.natural ? 'device' : (V.voices && V.voices[settings().boVoice] ? settings().boVoice : V.default || 'ash');
    const nat = V.natural ? Object.entries(V.voices || {}).map(([k, l]) => `<label class="bt-opt"><input type="radio" name="bt-voice" value="${esc(k)}"${cur === k ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('') : '';
    const dv = deviceVoices(); const best = bestVoice();
    s.innerHTML = `<h3 class="bt-set-h">Bo’s voice</h3><div class="bt-opts" role="radiogroup" aria-label="Bo's voice">${nat}<label class="bt-opt"><input type="radio" name="bt-voice" value="device"${cur === 'device' ? ' checked' : ''}><span>This device’s voice</span></label></div>
      ${cur === 'device' && dv.length ? `<label class="bt-set-l" for="bt-dv">Device voice</label><select class="input" id="bt-dv">${dv.map(v => `<option value="${esc(v.name)}"${best && v.name === best.name ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : ''}
      ${!V.natural ? '<p class="bt-fine">Bo’s natural voice is not switched on, so he uses the best voice this device has.</p>' : ''}
      <h3 class="bt-set-h">Speed</h3><div class="bt-speed" role="radiogroup" aria-label="Speed">${RATES.map(r => `<button type="button" role="radio" class="chip toggle${Speaker.rate() === r ? ' on' : ''}" aria-checked="${Speaker.rate() === r}" data-rate="${r}">${r === 1 ? 'Normal' : r + '×'}</button>`).join('')}</div>
      <label class="bt-switch"><input type="checkbox" id="bt-hf"${hands() ? ' checked' : ''}><span><b>Hands-free</b> Bo listens again after he talks</span></label>
      <label class="bt-switch"><input type="checkbox" id="bt-cp"${caps() ? ' checked' : ''}><span><b>Captions</b> Show what you and Bo say</span></label>
      <button type="button" class="btn sm" id="bt-try">${icon('play', 14)} Hear Bo</button>`;
    s.onchange = e => {
      const t = e.target;
      if (t.name === 'bt-voice') { setSetting('boVoice', t.value); Speaker.natural = naturalOn(); if (t.value !== 'device') Speaker.voice = t.value; paintSettings(); }
      if (t.id === 'bt-dv') setSetting('boDeviceVoice', t.value);
      if (t.id === 'bt-hf') { setSetting('boHands', t.checked); paintMode(); }
      if (t.id === 'bt-cp') { setSetting('boCaptions', t.checked); paintMode(); }
    };
    s.onclick = e => {
      const r = e.target.closest('[data-rate]'); if (r) { setSetting('boRate', +r.dataset.rate); $$('[data-rate]', s).forEach(x => { const on = x === r; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); return; }
      if (e.target.closest('#bt-try')) { Speaker.unlock(); if (T.state === 'listening') { stopListening(); setState('idle'); } Speaker.stop(); Speaker.say('Hi, I’m Bo. This is how I sound.', { i: -1, turn: -1 }); }
    };
  }

  /* ---------- Read aloud, for answers in the chat ---------- */
  let reading = null;
  function read(text, btn, status) {
    if (status) T.status = status;
    if (reading) { const was = reading; reading = null; Speaker.stop(); was.classList.remove('on'); if (was === btn) return; }
    Speaker.natural = naturalOn(); Speaker.voice = settings().boVoice && T.status && T.status.voice && T.status.voice.voices && T.status.voice.voices[settings().boVoice] ? settings().boVoice : ((T.status && T.status.voice && T.status.voice.default) || 'ash');
    Speaker.unlock(); Speaker.stop(); reading = btn; if (btn) btn.classList.add('on');
    const parts = []; const sp = splitter(s => parts.push(s), () => {}); sp.push(text); sp.end();
    parts.forEach((s, i) => Speaker.say(s, { i, turn: -1 }));
  }
  // leaving the page ends the call and stops reading aloud
  addEventListener('hashchange', () => { if (T.el) close(); else if (reading) { reading.classList.remove('on'); reading = null; Speaker.stop(); } });

  App.boTalk = { supported: () => !NATIVE, open, close, read, isOpen: () => !!T.el, setStatus: s => { T.status = s; }, _sayable: sayable, _splitter: splitter };
})(window);
