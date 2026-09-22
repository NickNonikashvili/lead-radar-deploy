/* ============================================================
   MatHub — focus sounds
   A floating bubble in the bottom-right corner that opens into a
   panel of background sounds generated with the Web Audio API (no
   audio files): rain, thunderstorm, ocean, wind, fireplace, forest,
   night, coffee shop, white/pink/brown noise and a lo-fi beat
   generator. Sounds layer, each has a volume, there is a master
   volume and a sleep timer, and the mix is remembered. A second tab
   embeds Spotify playlists (or any pasted Spotify link).
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, settings, setSetting, toast } = App;

  /* ---------- catalog ---------- */
  const SOUNDS = [
    { id: 'rain', name: 'Rain', ic: 'rain', desc: 'Steady rain on a window' },
    { id: 'storm', name: 'Thunderstorm', ic: 'zap', desc: 'Rain with distant rumbles' },
    { id: 'ocean', name: 'Ocean waves', ic: 'wave', desc: 'Slow waves on a beach' },
    { id: 'wind', name: 'Wind', ic: 'wind', desc: 'Wind across an open field' },
    { id: 'fire', name: 'Fireplace', ic: 'fire', desc: 'Low crackle and warmth' },
    { id: 'forest', name: 'Forest', ic: 'leaf', desc: 'Breeze and birdsong' },
    { id: 'night', name: 'Summer night', ic: 'moon', desc: 'Crickets after dark' },
    { id: 'cafe', name: 'Coffee shop', ic: 'cup', desc: 'Murmur and cups' },
    { id: 'lofi', name: 'Lo-fi beats', ic: 'music', desc: 'Slow chords and a soft beat' },
    { id: 'brown', name: 'Brown noise', ic: 'sliders', desc: 'Deep, smooth hush' },
    { id: 'pink', name: 'Pink noise', ic: 'sliders', desc: 'Balanced hush' },
    { id: 'white', name: 'White noise', ic: 'sliders', desc: 'Bright hush' }
  ];
  const PLAYLISTS = [
    { name: 'Lofi Beats', id: '37i9dQZF1DWWQRwui0ExPn' }, { name: 'Deep Focus', id: '37i9dQZF1DWZeKCadgRdKQ' },
    { name: 'Peaceful Piano', id: '37i9dQZF1DX4sWSpwq3LiO' }, { name: 'Jazz Vibes', id: '37i9dQZF1DX0SM0LYsmbMT' }
  ];
  const EXTRA_ICONS = {
    rain: '<path d="M7 16a4 4 0 0 1-.5-8 6 6 0 0 1 11.3 1.5A3.5 3.5 0 0 1 17 16"/><path d="M8 19v2M12 18v3M16 19v2"/>',
    wave: '<path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h8a2 2 0 1 1-2 2"/>',
    leaf: '<path d="M4 20c0-9 6-15 16-16-1 10-7 16-16 16z"/><path d="M4 20c4-6 8-9 12-11"/>',
    cup: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2M7 3v2M11 3v2"/>',
    music: '<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'
  };
  const ic = (name, size = 18) => EXTRA_ICONS[name] ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EXTRA_ICONS[name]}</svg>` : icon(name, size);

  /* ---------- state ---------- */
  const A = { ctx: null, master: null, nodes: {}, timers: {}, open: false, tab: 'sounds', sleepAt: 0, sleepTimer: 0, el: null };
  const saved = () => Object.assign({ mix: {}, master: 0.7, tab: 'sounds', spotify: '' }, settings().ambient || {});
  const persist = patch => setSetting('ambient', Object.assign(saved(), patch));
  const activeIds = () => Object.keys(A.nodes);

  /* ---------- audio helpers ---------- */
  function ctx() {
    if (!A.ctx) { const C = global.AudioContext || global.webkitAudioContext; if (!C) return null; A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = saved().master; A.master.connect(A.ctx.destination); }
    if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
    return A.ctx;
  }
  function noiseBuffer(c, kind) {
    const len = c.sampleRate * 2; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    }
    return buf;
  }
  function noise(c, kind) { const s = c.createBufferSource(); s.buffer = noiseBuffer(c, kind); s.loop = true; s.start(); return s; }
  function filt(c, type, f, q) { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; return n; }
  function gain(c, v) { const g = c.createGain(); g.gain.value = v; return g; }
  function lfo(c, hz, depth, target, base) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz; const g = c.createGain(); g.gain.value = depth; o.connect(g).connect(target); if (base !== undefined) target.value = base; o.start(); return o; }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function burst(c, out, opts) {   // short filtered-noise or tone event with an envelope
    const t = c.currentTime; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + (opts.attack || 0.01) + opts.decay);
    let src; if (opts.tone) { src = c.createOscillator(); src.type = opts.type || 'sine'; src.frequency.setValueAtTime(opts.tone, t); if (opts.tone2) src.frequency.exponentialRampToValueAtTime(opts.tone2, t + opts.decay); } else { src = c.createBufferSource(); src.buffer = opts.buf; }
    let chain = src; if (opts.hp) { const h = filt(c, 'highpass', opts.hp); chain.connect(h); chain = h; } if (opts.lp) { const l = filt(c, 'lowpass', opts.lp); chain.connect(l); chain = l; } if (opts.bp) { const b = filt(c, 'bandpass', opts.bp, opts.q || 1); chain.connect(b); chain = b; }
    chain.connect(g).connect(out); src.start(t); src.stop(t + (opts.attack || 0.01) + opts.decay + 0.05);
  }
  function every(id, minMs, maxMs, fn) { const tick = () => { if (!A.nodes[id]) return; fn(); A.timers[id] = setTimeout(tick, rnd(minMs, maxMs)); }; A.timers[id] = setTimeout(tick, rnd(minMs, maxMs)); }

  /* ---------- generators: each returns { out (GainNode), stop() } ---------- */
  const GEN = {
    white(c) { const s = noise(c, 'white'); const out = gain(c, 0.25); s.connect(filt(c, 'lowpass', 9000)).connect(out); return { out, stop: () => s.stop() }; },
    pink(c) { const s = noise(c, 'pink'); const out = gain(c, 0.5); s.connect(out); return { out, stop: () => s.stop() }; },
    brown(c) { const s = noise(c, 'brown'); const out = gain(c, 0.5); s.connect(filt(c, 'lowpass', 500)).connect(out); return { out, stop: () => s.stop() }; },
    rain(c, id) {
      const s = noise(c, 'pink'); const bp = filt(c, 'bandpass', 2600, 0.6); const hp = filt(c, 'highpass', 500); const g = gain(c, 0.45); const out = gain(c, 1);
      s.connect(hp).connect(bp).connect(g).connect(out); const l = lfo(c, 0.13, 0.12, g.gain, 0.45); const drops = noiseBuffer(c, 'white');
      every(id, 60, 260, () => burst(c, out, { buf: drops, gain: rnd(0.05, 0.16), decay: rnd(0.02, 0.07), bp: rnd(1800, 5200), q: 2 }));
      return { out, stop: () => { s.stop(); l.stop(); } };
    },
    storm(c, id) {
      const r = GEN.rain(c, id + ':rain'); const out = gain(c, 1); r.out.connect(out); const rumble = noiseBuffer(c, 'brown');
      A.nodes[id + ':rain'] = { out: r.out, stop: r.stop, hidden: true };
      every(id, 7000, 22000, () => { burst(c, out, { buf: rumble, gain: rnd(0.6, 1.2), attack: rnd(0.2, 0.9), decay: rnd(2.5, 5), lp: rnd(90, 160) }); });
      return { out, stop: () => { r.stop(); const h = A.nodes[id + ':rain']; if (h) { clearTimeout(A.timers[id + ':rain']); delete A.nodes[id + ':rain']; } } };
    },
    ocean(c) {
      const s = noise(c, 'brown'); const lp = filt(c, 'lowpass', 700); const g = gain(c, 0.2); const out = gain(c, 1); s.connect(lp).connect(g).connect(out);
      const l1 = lfo(c, 0.09, 0.28, g.gain, 0.35); const l2 = lfo(c, 0.07, 300, lp.frequency, 700); const hiss = noise(c, 'pink'); const hg = gain(c, 0.05); hiss.connect(filt(c, 'highpass', 1500)).connect(hg).connect(out); const l3 = lfo(c, 0.09, 0.05, hg.gain, 0.06);
      return { out, stop: () => { s.stop(); hiss.stop(); l1.stop(); l2.stop(); l3.stop(); } };
    },
    wind(c) {
      const s = noise(c, 'pink'); const bp = filt(c, 'bandpass', 500, 0.8); const g = gain(c, 0.35); const out = gain(c, 1); s.connect(bp).connect(g).connect(out);
      const l1 = lfo(c, 0.05, 300, bp.frequency, 550); const l2 = lfo(c, 0.11, 0.18, g.gain, 0.4); const l3 = lfo(c, 0.023, 150, bp.frequency);
      return { out, stop: () => { s.stop(); l1.stop(); l2.stop(); l3.stop(); } };
    },
    fire(c, id) {
      const s = noise(c, 'brown'); const g = gain(c, 0.25); const out = gain(c, 1); s.connect(filt(c, 'lowpass', 300)).connect(g).connect(out); const l = lfo(c, 0.4, 0.08, g.gain, 0.25); const crackle = noiseBuffer(c, 'white');
      every(id, 40, 320, () => burst(c, out, { buf: crackle, gain: rnd(0.08, 0.35), decay: rnd(0.01, 0.05), hp: rnd(1500, 4000) }));
      return { out, stop: () => { s.stop(); l.stop(); } };
    },
    forest(c, id) {
      const w = GEN.wind(c); const wg = gain(c, 0.35); w.out.connect(wg); const out = gain(c, 1); wg.connect(out);
      every(id, 700, 3200, () => { const f = rnd(2200, 4200); const n = 1 + Math.floor(rnd(1, 4)); for (let k = 0; k < n; k++) setTimeout(() => { if (A.nodes[id]) burst(c, out, { tone: f * rnd(0.9, 1.1), tone2: f * rnd(0.7, 1.4), gain: rnd(0.04, 0.1), attack: 0.02, decay: rnd(0.08, 0.2) }); }, k * rnd(90, 180)); });
      return { out, stop: () => w.stop() };
    },
    night(c, id) {
      const s = noise(c, 'brown'); const g = gain(c, 0.12); const out = gain(c, 1); s.connect(filt(c, 'lowpass', 200)).connect(g).connect(out);
      const chirp = () => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = rnd(3800, 4600); const trem = c.createGain(); trem.gain.value = 0; const t = c.currentTime; const n = 4 + Math.floor(rnd(0, 6)); for (let k = 0; k < n; k++) { trem.gain.setValueAtTime(0.0001, t + k * 0.07); trem.gain.exponentialRampToValueAtTime(0.045, t + k * 0.07 + 0.015); trem.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.07 + 0.06); } o.connect(trem).connect(out); o.start(t); o.stop(t + n * 0.07 + 0.1); };
      every(id, 300, 1400, chirp);
      return { out, stop: () => s.stop() };
    },
    cafe(c, id) {
      const s = noise(c, 'pink'); const bp = filt(c, 'bandpass', 420, 0.7); const g = gain(c, 0.3); const out = gain(c, 1); s.connect(bp).connect(g).connect(out);
      const l1 = lfo(c, 0.7, 0.1, g.gain, 0.3); const l2 = lfo(c, 0.21, 120, bp.frequency, 420); const l3 = lfo(c, 1.9, 0.05, g.gain);
      every(id, 2500, 9000, () => burst(c, out, { tone: rnd(2200, 3400), gain: rnd(0.03, 0.08), decay: rnd(0.15, 0.4), type: 'triangle' }));
      return { out, stop: () => { s.stop(); l1.stop(); l2.stop(); l3.stop(); } };
    },
    lofi(c, id) {
      const out = gain(c, 0.8); const bpm = 74; const beat = 60 / bpm; const chords = [[43, 50, 55, 58, 62], [48, 55, 59, 62, 64], [41, 48, 53, 57, 60], [38, 45, 50, 53, 57]];   // Gm9 C9 Fmaj7 Dm7 (MIDI)
      const hz = m => 440 * Math.pow(2, (m - 69) / 12); const padLp = filt(c, 'lowpass', 1400, 0.7); const padG = gain(c, 0.16); padLp.connect(padG).connect(out); const drumG = gain(c, 0.5); drumG.connect(out);
      const crackle = noise(c, 'white'); const cg = gain(c, 0); crackle.connect(filt(c, 'highpass', 3000)).connect(cg).connect(out); const cl = lfo(c, 6.5, 0.006, cg.gain, 0.007);
      const noiseBuf = noiseBuffer(c, 'white'); let bar = 0; let next = c.currentTime + 0.1;
      const kick = t => { const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g).connect(drumG); o.start(t); o.stop(t + 0.3); };
      const snare = t => { const s = c.createBufferSource(); s.buffer = noiseBuf; const g = c.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(filt(c, 'bandpass', 1800, 0.8)).connect(g).connect(drumG); s.start(t); s.stop(t + 0.2); const o = c.createOscillator(); o.frequency.value = 190; const og = c.createGain(); og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og).connect(drumG); o.start(t); o.stop(t + 0.12); };
      const hat = (t, open) => { const s = c.createBufferSource(); s.buffer = noiseBuf; const g = c.createGain(); g.gain.setValueAtTime(open ? 0.12 : 0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.22 : 0.05)); s.connect(filt(c, 'highpass', 7000)).connect(g).connect(drumG); s.start(t); s.stop(t + 0.25); };
      const chord = (t, notes) => notes.forEach((m, i) => { const o = c.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine'; o.frequency.value = hz(m) * (1 + rnd(-0.002, 0.002)); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(i === 0 ? 0.5 : 0.28, t + 0.35); g.gain.setValueAtTime(i === 0 ? 0.5 : 0.28, t + beat * 3.2); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 4); o.connect(g).connect(padLp); o.start(t); o.stop(t + beat * 4.05); });
      const schedule = () => { if (!A.nodes[id]) return; while (next < c.currentTime + 0.6) { const t = next; chord(t, chords[bar % chords.length]); [0, 1, 2, 3].forEach(b => { const tb = t + b * beat; if (b === 0 || (b === 2 && Math.random() < 0.85)) kick(tb); if (b === 1 || b === 3) snare(tb + rnd(0, 0.012)); hat(tb, false); hat(tb + beat * 0.5 + 0.02, b === 3); if (b === 2 && Math.random() < 0.4) kick(tb + beat * 0.75); }); next += beat * 4; bar++; } A.timers[id] = setTimeout(schedule, 200); };
      schedule();
      return { out, stop: () => { crackle.stop(); cl.stop(); } };
    }
  };

  /* ---------- control ---------- */
  function start(id, vol) {
    const c = ctx(); if (!c) { toast('This browser cannot play generated sound.'); return false; }
    if (A.nodes[id]) return true; const gen = GEN[id]; if (!gen) return false;
    const node = gen(c, id); const v = gain(c, vol === undefined ? 0.7 : vol); node.out.connect(v).connect(A.master); A.nodes[id] = { out: node.out, stop: node.stop, vol: v };
    return true;
  }
  function stop(id) { const n = A.nodes[id]; if (!n) return; clearTimeout(A.timers[id]); delete A.timers[id]; try { n.stop(); } catch {} try { n.vol && n.vol.disconnect(); n.out.disconnect(); } catch {} delete A.nodes[id]; }
  function stopAll() { activeIds().forEach(stop); }
  function setVol(id, v) { const n = A.nodes[id]; if (n && n.vol) n.vol.gain.setTargetAtTime(v, A.ctx.currentTime, 0.05); const s = saved(); s.mix[id] = v; persist({ mix: s.mix }); }
  function toggle(id) {
    const s = saved(); if (A.nodes[id]) { stop(id); delete s.mix[id]; persist({ mix: s.mix }); }
    else { const v = s.mix[id] !== undefined ? s.mix[id] : 0.7; if (start(id, v)) { s.mix[id] = v; persist({ mix: s.mix }); } }
    paint();
  }
  function resumeMix() { const s = saved(); const ids = Object.keys(s.mix).filter(id => GEN[id]); if (!ids.length) return false; ids.forEach(id => start(id, s.mix[id])); paint(); return true; }
  function setSleep(min) { clearTimeout(A.sleepTimer); A.sleepAt = min ? Date.now() + min * 60000 : 0; if (min) A.sleepTimer = setTimeout(() => { fadeOut(); }, min * 60000); paint(); }
  function fadeOut() { if (!A.ctx) return; const t = A.ctx.currentTime; A.master.gain.setTargetAtTime(0, t, 4); setTimeout(() => { stopAll(); A.master.gain.setValueAtTime(saved().master, A.ctx.currentTime); A.sleepAt = 0; paint(); }, 14000); toast('Focus sounds fading out. Good night.', 4000); }
  const playing = () => activeIds().filter(id => !A.nodes[id].hidden);

  /* ---------- UI ---------- */
  function ensure() {
    if (A.el) return A.el; const el = document.createElement('div'); el.id = 'ambient'; el.innerHTML = `<div class="amb-panel" id="amb-panel" hidden></div><button class="amb-bubble" data-action="amb-toggle" aria-label="Focus sounds" title="Focus sounds">${ic('headphones', 22)}<span class="amb-eq" aria-hidden="true"><i></i><i></i><i></i></span></button>`;
    document.body.appendChild(el); A.el = el;
    bind(el, {
      'amb-toggle': () => { A.open = !A.open; paint(); },
      'amb-close': () => { A.open = false; paint(); },
      'amb-tab': b => { A.tab = b.dataset.tab; persist({ tab: A.tab }); paint(); },
      'amb-sound': b => toggle(b.dataset.id),
      'amb-stop': () => { stopAll(); persist({ mix: {} }); paint(); },
      'amb-resume': () => { if (!resumeMix()) toast('Pick a sound first.'); },
      'amb-sleep': b => { const m = +b.dataset.min; setSleep(A.sleepAt && !m ? 0 : m); toast(m ? `Sounds stop in ${m} minutes` : 'Timer off'); },
      'amb-spot': b => { persist({ spotify: b.dataset.id }); paint(); },
      'amb-paste': () => { const inp = $('#amb-link', el); const m = (inp.value || '').match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|episode|show)\/([A-Za-z0-9]+)/); if (!m) { toast('Paste a link that starts with open.spotify.com'); return; } persist({ spotify: `${m[1]}/${m[2]}` }); paint(); }
    });
    el.addEventListener('input', e => { if (e.target.id === 'amb-master') { const v = +e.target.value; persist({ master: v }); if (A.master) A.master.gain.setTargetAtTime(v, A.ctx.currentTime, 0.05); } else if (e.target.dataset && e.target.dataset.vol) setVol(e.target.dataset.vol, +e.target.value); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && A.open) { A.open = false; paint(); } });
    document.addEventListener('click', e => { if (A.open && !e.composedPath().includes(el)) { A.open = false; paint(); } });
    return el;
  }
  function paint() {
    const el = ensure(); const s = saved(); const on = playing(); const panel = $('#amb-panel', el); const bubble = $('.amb-bubble', el);
    bubble.classList.toggle('on', on.length > 0); bubble.classList.toggle('open', A.open); bubble.setAttribute('aria-expanded', String(A.open));
    panel.hidden = !A.open; if (!A.open) return;
    const tab = A.tab || s.tab || 'sounds'; const sleepLeft = A.sleepAt ? Math.max(1, Math.ceil((A.sleepAt - Date.now()) / 60000)) : 0;
    const soundsTab = `<div class="amb-grid">${SOUNDS.map(x => { const act = !!A.nodes[x.id]; const v = s.mix[x.id] !== undefined ? s.mix[x.id] : 0.7; return `<div class="amb-tile${act ? ' on' : ''}"><button class="amb-tbtn" data-action="amb-sound" data-id="${x.id}" title="${esc(x.desc)}"><span class="amb-ic">${ic(x.ic, 20)}</span><span class="amb-name">${esc(x.name)}</span></button>${act ? `<input type="range" class="amb-vol" min="0" max="1" step="0.02" value="${v}" data-vol="${x.id}" aria-label="${esc(x.name)} volume">` : ''}</div>`; }).join('')}</div>
      <div class="amb-foot"><label class="amb-master">${ic('sliders', 14)}<input type="range" id="amb-master" min="0" max="1" step="0.02" value="${s.master}" aria-label="Master volume"></label>
        <span class="amb-sleep">${ic('clock', 14)}${[15, 30, 60].map(m => `<button class="amb-chip${A.sleepAt && sleepLeft <= m && sleepLeft > (m === 15 ? 0 : m === 30 ? 15 : 30) ? ' on' : ''}" data-action="amb-sleep" data-min="${m}">${m}m</button>`).join('')}${A.sleepAt ? `<small>${sleepLeft} min left</small>` : ''}</span>
        ${on.length ? `<button class="btn xs" data-action="amb-stop">Stop all</button>` : Object.keys(s.mix).length ? `<button class="btn xs primary" data-action="amb-resume">${ic('play', 12)} Resume mix</button>` : ''}</div>
      <p class="amb-note">Everything here is generated on your device, nothing streams. Mix as many as you like.</p>`;
    const spot = s.spotify || `playlist/${PLAYLISTS[0].id}`;
    const spotifyTab = `<div class="amb-chips">${PLAYLISTS.map(p => `<button class="amb-chip${spot === 'playlist/' + p.id ? ' on' : ''}" data-action="amb-spot" data-id="playlist/${p.id}">${esc(p.name)}</button>`).join('')}</div>
      <iframe class="amb-spotify" src="https://open.spotify.com/embed/${esc(spot)}?theme=0" width="100%" height="232" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify player"></iframe>
      <div class="row gap-sm mt-1"><input class="input sm" id="amb-link" placeholder="Paste any Spotify playlist, album or track link" aria-label="Spotify link"><button class="btn sm" data-action="amb-paste">Load</button></div>
      <p class="amb-note">Full songs if you are logged into Spotify Premium in this browser; otherwise 30-second previews. Keeps playing while you move around MatHub.</p>`;
    panel.innerHTML = `<div class="amb-head"><div class="amb-tabs"><button class="amb-tab${tab === 'sounds' ? ' on' : ''}" data-action="amb-tab" data-tab="sounds">${ic('headphones', 14)} Focus sounds</button><button class="amb-tab${tab === 'spotify' ? ' on' : ''}" data-action="amb-tab" data-tab="spotify">${ic('music', 14)} Spotify</button></div><button class="icon-btn" data-action="amb-close" aria-label="Close">${icon('x', 14)}</button></div>${tab === 'sounds' ? soundsTab : spotifyTab}`;
  }
  App.ambient = { toggle, stop, stopAll, start, playing, open: () => { A.open = true; paint(); }, paint };
  document.addEventListener('DOMContentLoaded', () => { ensure(); paint(); });
  setInterval(() => { if (A.open && A.sleepAt) paint(); }, 30000);
})(window);
