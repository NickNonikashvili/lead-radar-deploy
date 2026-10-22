/* Stand-ins for a call in the browser (used by talk-web and max-free): live() replaces WebRTC and the
   microphone (window.__rt sends the server's events and records what the page sends), basic() replaces the
   browser's speech recognition and voices (window.__say, window.__spoken), quiet() skips the tour and the
   league pop-up. Each is passed to addInitScript. */
const live = () => {
  window.__rt = { sent: [], dc: null, pc: null, answer: '', emit(ev) { if (this.dc) this.dc._fire('message', { data: JSON.stringify(ev) }); } };
  const tone = () => { const ctx = new AudioContext(); ctx.resume(); const osc = ctx.createOscillator(); const g = ctx.createGain(); g.gain.value = 0; const dst = ctx.createMediaStreamDestination(); osc.connect(g); g.connect(dst); osc.start(); return { g, stream: dst.stream }; };
  class FakeDC { constructor() { this.readyState = 'connecting'; this.ls = {}; window.__rt.dc = this; } addEventListener(t, f) { (this.ls[t] = this.ls[t] || []).push(f); } send(s) { window.__rt.sent.push(JSON.parse(s)); } close() { this.readyState = 'closed'; } _fire(t, e) { (this.ls[t] || []).forEach(f => f(e)); } }
  class FakePC {
    constructor() { this.ls = {}; this.connectionState = 'new'; window.__rt.pc = this; }
    addTrack() {} createDataChannel(name) { window.__rt.channel = name; return new FakeDC(); }
    async createOffer() { return { type: 'offer', sdp: window.__badOffer ? 'x=bad' : 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=browser-offer\r\nt=0 0\r\n' }; }
    async setLocalDescription() {}
    async setRemoteDescription(d) { window.__rt.answer = d.sdp; setTimeout(() => { this.connectionState = 'connected'; const dc = window.__rt.dc; dc.readyState = 'open'; dc._fire('open', {}); const t = tone(); window.__rt.boGain = t.g; this.ontrack && this.ontrack({ streams: [t.stream] }); }, 100); }
    addEventListener(t, f) { (this.ls[t] = this.ls[t] || []).push(f); } close() { this.connectionState = 'closed'; window.__rt.closed = true; }
  }
  window.RTCPeerConnection = FakePC;
  navigator.mediaDevices.getUserMedia = async () => { if (window.__micDenied) { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; } const t = tone(); window.__rt.mic = t.stream; window.__rt.micGain = t.g; return t.stream; };
};
const basic = () => {
  window.__say = []; window.__spoken = [];
  class FakeSR {
    start() { const say = window.__say.shift(); if (!say) { setTimeout(() => this.onend && this.onend(), 300); return; } const words = say.split(' '); let i = 0; const step = () => { i++; const fin = i === words.length; const alt = [{ transcript: words.slice(0, i).join(' ') }]; alt.isFinal = fin; this.onresult && this.onresult({ resultIndex: 0, results: [alt] }); if (!fin) setTimeout(step, 60); }; setTimeout(step, 200); }
    stop() { setTimeout(() => this.onend && this.onend(), 10); } abort() { this.stop(); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  const synth = { speaking: false, paused: false, getVoices: () => [{ name: 'Microsoft Andrew Online (Natural)', lang: 'en-US' }, { name: 'Zarvox', lang: 'en-US', default: true }], speak(u) { if (!u.text.trim()) return; window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name }); setTimeout(() => u.onend && u.onend(), 120); }, cancel() {}, pause() {}, resume() {}, addEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};
const quiet = () => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); }); };
module.exports = { live, basic, quiet };
