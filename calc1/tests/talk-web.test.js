/* ============================================================
   Talk with Bo (assets/talk.js): a voice call with Bo on the website. The browser's speech recognition and
   voices are replaced by scripted stand-ins (what the student "says" is queued in window.__say; what the
   device "speaks" lands in window.__spoken); the AI and the speech API are the stand-ins in
   tests/pyodide/router.php. Covered: the first-time explanation, Bo's greeting in his natural voice, a spoken
   question and a streamed spoken answer with the board, hands-free listening, cutting in, the device's voice,
   typing in the call, a browser without speech recognition (recorded and transcribed by the server), a blocked
   microphone, phones, and the chat afterwards (said out loud, the board, Read aloud).
   ============================================================ */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const TTS = path.join(__dirname, 'fixtures', 'tts-last.json'); const LAST = path.join(__dirname, 'fixtures', 'ai-last.json');
const tts = () => { try { return JSON.parse(fs.readFileSync(TTS, 'utf8')); } catch (e) { return {}; } };
const fakes = () => {
  window.__say = []; window.__srStarts = 0; window.__spoken = []; window.__cancels = 0; window.__micDenied = false; window.__speakMs = 150;
  class FakeSR {
    start() {
      window.__srStarts++;
      if (window.__micDenied) { setTimeout(() => { this.onerror && this.onerror({ error: 'not-allowed' }); this.onend && this.onend(); }, 50); return; }
      const say = window.__say.shift(); if (!say) { setTimeout(() => this.onend && this.onend(), 300); return; }
      const words = say.split(' '); let i = 0;
      const step = () => { i++; const fin = i === words.length; const alt = [{ transcript: words.slice(0, i).join(' ') }]; alt.isFinal = fin; this.onresult && this.onresult({ resultIndex: 0, results: [alt] }); if (!fin) setTimeout(step, 60); };
      setTimeout(step, 200);
    }
    stop() { setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.stop(); }
  }
  if (!window.__noSR) { window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR; } else { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }
  const synth = { speaking: false, paused: false, getVoices: () => [{ name: 'Microsoft Andrew Online (Natural)', lang: 'en-US', default: false, localService: false }, { name: 'Zarvox', lang: 'en-US', default: true, localService: true }], speak(u) { if (!u.text.trim()) return; window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, rate: u.rate }); u.__t = setTimeout(() => { u.onboundary && u.onboundary({}); u.__t = setTimeout(() => u.onend && u.onend(), window.__speakMs); }, 20); synth.__u = u; }, cancel() { window.__cancels++; }, pause() {}, resume() {}, addEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.tourDone = true; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {}
  document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.celebrate{display:none!important}'; document.head.appendChild(st); });
};
(async () => {
  const { mk, txt, login, api, go, hscroll, log, check } = await T.start({ audio: true });
  const state = p => p.evaluate(() => { const t = document.querySelector('#bo-talk'); return t ? t.dataset.state : 'closed'; });
  const waitFor = async (p, want, ms = 8000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await state(p); if (want.includes(s)) return s; await p.waitForTimeout(60); } return s; };
  const setup = async (w, h, extra) => {
    const [c, p] = await mk(w, h); if (extra) await c.addInitScript(extra); await c.addInitScript(fakes);
    await go(p, '#/'); await login(p, 'mod.user@montana.edu'); await p.reload(); await p.waitForTimeout(700);
    await api(p, 'ai_forget', { what: 'all' }); await p.evaluate(() => { App.setSetting('aiConsent', Date.now()); App.setSetting('boTalkOk', 0); App.setSetting('boVoice', ''); App.setSetting('boHands', true); App.setSetting('boRate', 1); });
    return [c, p];
  };

  // a Max member on a laptop
  const [cm, m] = await setup(1360, 900);
  await go(m, '#/tutor/calc', 2200);
  check('Ask Bo has Talk with Bo, and a mic in the message box', !!(await m.$('.bo-talk-btn:not([hidden])')) && !!(await m.$('.bo-mic')) && /Talk with Bo/.test(await txt(m, '.bo-talk-btn')));
  check('every answer from Bo has Read aloud', !!(await m.$('#bo-log .bo-msg.bo [data-bo-read]')));
  await m.click('.bo-talk-btn'); await m.waitForTimeout(600);
  const hello = await txt(m, '#bo-talk');
  check('the first time, the call explains what happens to what you say before the microphone turns on', /Talk with Bo out loud/.test(hello) && /Google/.test(hello) && /OpenAI/.test(hello) && /Anthropic/.test(hello) && !!(await m.$('#bt-start')) && (await m.evaluate(() => window.__srStarts)) === 0, hello.slice(0, 300));
  check('the call is a dialog with a live status', await m.$eval('#bo-talk', e => e.getAttribute('role') === 'dialog' && e.getAttribute('aria-modal') === 'true') && await m.$eval('#bt-status', e => e.getAttribute('role') === 'status'));
  fs.writeFileSync(TTS, '{}');
  await m.evaluate(() => { window.__say.push('What is the chain rule'); });
  await m.click('#bt-start');
  const s1 = await waitFor(m, ['listening'], 6000);
  check('Start: Bo greets you in his natural voice, then listens (hands-free)', s1 === 'listening' && /It's Bo/.test(tts().input || '') && (await m.evaluate(() => window.__spoken.length)) === 0, { s1, tts: tts().input });
  const s2 = await waitFor(m, ['speaking', 'thinking'], 6000);
  check('what you say shows as you say it, then Bo thinks and talks', ['speaking', 'thinking'].includes(s2) && /What is the chain rule/.test(await txt(m, '#bt-you')), { s2, you: await txt(m, '#bt-you') });
  const s3 = await waitFor(m, ['listening'], 9000);
  const q = JSON.parse(fs.readFileSync(LAST, 'utf8'));
  check('the question went to Bo in voice mode, streamed, for this class', q.stream === true && /VOICE MODE/.test(q.system.map(b => b.text).join('')) && /What is the chain rule/.test(JSON.stringify(q.messages[q.messages.length - 1])));
  check('Bo\'s spoken answer is in the captions, without the board or LaTeX', /derivative of the outside/.test(await txt(m, '#bt-bo')) && !/\[board/.test(await txt(m, '#bt-bo')));
  check('the formula is on Bo\'s board (beside him on a wide screen)', !(await m.$('#bt-board[hidden]')) && /frac\{d\}\{dx\}|d\s*dx/.test(await txt(m, '#bt-board')) && await m.$eval('#bo-talk', e => e.classList.contains('has-board')));
  check('he said it in his natural voice, a sentence at a time, and the board was not read out', /derivative of the inside|try one together/.test(tts().input || '') && !/frac|board/.test(tts().input || ''), tts().input);
  check('hands-free: after he talks, he listens again', s3 === 'listening');
  check('no sideways scroll in the call at 1360px', await hscroll(m));

  // cutting in while he talks (the device's voice, slowed down so there is time)
  await m.click('[data-t="settings"]'); await m.waitForTimeout(300);
  check('the call\'s settings: his natural voices, this device\'s voice, speed, hands-free and captions', (await m.$$('#bt-set input[name="bt-voice"]')).length >= 6 && !!(await m.$('#bt-set [data-rate="1.15"]')) && !!(await m.$('#bt-hf')) && !!(await m.$('#bt-cp')));
  await m.click('#bt-set input[value="device"]'); await m.waitForTimeout(250);
  check('picking this device\'s voice lists the device voices, the natural-sounding one first', (await m.$eval('#bt-dv', s => s.value)) === 'Microsoft Andrew Online (Natural)');
  await m.click('#bt-set [data-rate="1.15"]'); await m.keyboard.press('Escape'); await m.waitForTimeout(200);
  check('Esc first closes the settings, not the call', !!(await m.$('#bo-talk')) && !!(await m.$('#bt-set[hidden]')));
  await m.evaluate(() => { window.__speakMs = 2500; window.__say.push('Give me an example'); });
  if ((await state(m)) !== 'listening') await m.click('#bt-main');   // still listening (hands-free): the next words are heard
  const s4 = await waitFor(m, ['speaking'], 8000);
  const spoke = await m.evaluate(() => window.__spoken.slice(-1)[0] || {});
  check('the answer is spoken by this device\'s best voice at the speed picked', s4 === 'speaking' && spoke.voice === 'Microsoft Andrew Online (Natural)' && spoke.rate === 1.15, { s4, spoke });
  const cancels = await m.evaluate(() => window.__cancels);
  await m.click('#bt-orb');
  const s5 = await waitFor(m, ['listening'], 3000);
  check('tapping Bo while he talks cuts him off and listens', s5 === 'listening' && (await m.evaluate(() => window.__cancels)) > cancels, { s5 });
  await m.evaluate(() => { window.__speakMs = 150; });
  // typing in the call
  await m.click('[data-t="type"]'); await m.fill('#bt-q', 'Quiz me on the chain rule'); await m.press('#bt-q', 'Enter');
  await waitFor(m, ['speaking', 'listening'], 8000);
  check('you can also type in the call, and Bo answers out loud', /Quiz me on the chain rule/.test(await txt(m, '#bt-you')) && /Quiz me on the chain rule/.test(JSON.stringify(JSON.parse(fs.readFileSync(LAST, 'utf8')).messages.slice(-1))));
  await waitFor(m, ['listening'], 8000);
  // ending the call: the chat has everything
  await m.keyboard.press('Escape'); await m.waitForTimeout(1800);
  check('Esc ends the call', !(await m.$('#bo-talk')));
  const chat = await m.$$eval('#bo-log .bo-msg', ms => ms.map(x => ({ bo: x.classList.contains('bo'), t: x.textContent.trim() })));
  check('the chat now has the spoken questions, marked as said out loud, and Bo\'s answers', chat.filter(x => !x.bo && /Said out loud/.test(x.t)).length >= 2 && chat.some(x => x.bo && /derivative of the outside/.test(x.t)), chat.map(x => x.t.slice(0, 40)));
  check('the board lines show in the chat as their own blocks', (await m.$$('#bo-log .bo-board-line')).length >= 1);
  const before = await m.evaluate(() => window.__spoken.length);
  await m.click('#bo-log .bo-msg.bo:last-child [data-bo-read]'); await m.waitForTimeout(400);
  check('Read aloud speaks an answer (here in the device\'s voice that was picked)', (await m.evaluate(() => window.__spoken.length)) > before && await m.$eval('#bo-log .bo-msg.bo:last-child [data-bo-read]', b => b.classList.contains('on')));
  await m.click('#bo-log .bo-msg.bo:last-child [data-bo-read]'); await m.waitForTimeout(200);
  check('a second tap stops it', !(await m.$eval('#bo-log .bo-msg.bo:last-child [data-bo-read]', b => b.classList.contains('on'))));
  // the chat streams too
  await m.fill('#bo-q', 'What is a limit?'); await m.click('.bo-send'); await m.waitForTimeout(2500);
  check('a typed question streams in the chat as well', JSON.parse(fs.readFileSync(LAST, 'utf8')).stream === true && /You asked: What is a limit/.test(await txt(m, '#bo-log .bo-msg.bo:last-child')) && !(await m.$('#bo-log .bo-msg.live')));
  await cm.close();

  // a browser without speech recognition: the call records, and the server turns it into text
  const quiet = () => { window.__noSR = true; navigator.mediaDevices.getUserMedia = async () => { const ctx = new AudioContext(); await ctx.resume(); const osc = ctx.createOscillator(); const g = ctx.createGain(); g.gain.value = 0.6; const dst = ctx.createMediaStreamDestination(); osc.connect(g); g.connect(dst); osc.start(); setTimeout(() => { g.gain.value = 0; }, 900); return dst.stream; }; };
  const [cf, f] = await setup(1360, 900, quiet);
  await f.evaluate(() => App.setSetting('boTalkOk', Date.now()));
  await go(f, '#/tutor/calc', 2200);
  fs.writeFileSync(path.join(__dirname, 'fixtures', 'stt-last.json'), '{}');
  await f.click('.bo-talk-btn');
  const f1 = await waitFor(f, ['listening'], 6000); const f2 = await waitFor(f, ['hearing', 'thinking', 'speaking'], 8000); await waitFor(f, ['speaking', 'listening'], 9000);
  const stt = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'stt-last.json'), 'utf8'));
  check('without speech recognition, Bo records until you stop, the server writes it down, and he answers', f1 === 'listening' && ['hearing', 'thinking', 'speaking'].includes(f2) && stt.file && stt.file.size > 0 && /What is the chain rule/.test(await txt(f, '#bt-you')), { f1, f2, stt: stt.file, you: await txt(f, '#bt-you') });
  await f.keyboard.press('Escape'); await cf.close();

  // a blocked microphone: say so, and offer typing
  const [cb, bl] = await setup(1360, 900, () => { window.__micBlock = true; });
  await bl.evaluate(() => { App.setSetting('boTalkOk', Date.now()); App.setSetting('boVoice', 'device'); });
  await go(bl, '#/tutor/calc', 2200); await bl.evaluate(() => { window.__micDenied = true; });
  await bl.click('.bo-talk-btn'); const b1 = await waitFor(bl, ['error'], 6000);
  check('a blocked microphone says how to allow it, and opens typing', b1 === 'error' && /allow it/i.test(await txt(bl, '#bt-status')) && !(await bl.$('#bt-type[hidden]')), await txt(bl, '#bt-status'));
  await bl.keyboard.press('Escape'); await cb.close();

  // phones
  const [cp, ph] = await setup(390, 844);
  await ph.evaluate(() => App.setSetting('boTalkOk', Date.now()));
  await go(ph, '#/tutor/calc', 2200);
  check('phone: the mic in the message box starts the call (the header button steps aside)', (await ph.$eval('.bo-talk-btn', b => getComputedStyle(b).display)) === 'none' && await ph.$eval('.bo-mic', b => b.getBoundingClientRect().width >= 44));
  await ph.evaluate(() => { window.__say.push('What is the chain rule'); });
  await ph.click('.bo-mic'); await waitFor(ph, ['listening'], 6000); await waitFor(ph, ['speaking', 'thinking'], 6000); await waitFor(ph, ['listening'], 9000);
  const lay = await ph.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { bar: r('.bt-bar').bottom, main: r('#bt-main').width, end: r('.bt-end').right, board: r('#bt-board').width, h: innerHeight, w: innerWidth }; });
  check('phone: the call fits, with the board, and the big buttons are on screen', lay.bar <= lay.h + 1 && lay.end <= lay.w && lay.main >= 76 && lay.board > 300, lay);
  check('phone: no sideways scroll in the call', await hscroll(ph));
  await ph.keyboard.press('Escape'); await cp.close();

  // no Max: no call
  const [ca, a] = await mk(1360, 900); await a.addInitScript(fakes); await go(a, '#/'); await login(a, 'alice.a@montana.edu'); await a.reload(); await a.waitForTimeout(600);
  await api(a, 'create_status&refresh=1'); await go(a, '#/tutor/calc', 1800);
  check('without Max, Ask Bo shows Meet Bo and no way to call him', /Meet Bo/.test(await txt(a, '#bo-main')) && !(await a.$('.bo-talk-btn:not([hidden])')) && !(await a.$('.bo-mic')));
  await ca.close();

  const [cc, cl] = await mk(1360, 900); await go(cl, '#/'); await login(cl, 'mod.user@montana.edu'); await api(cl, 'ai_forget', { what: 'all' }); await cc.close();
  log('voice call checked');
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
