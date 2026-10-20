/* ============================================================
   Calling Bo (assets/talk.js). A live call: WebRTC and OpenAI's side of it are stand-ins in the page
   (window.__rt sends the server's events and records what the page sends; the call is set up through
   api/ai.php against the stand-in in tests/pyodide/router.php). Covered: the first-call explanation, the
   call setup, Bo speaking first, captions like a video's (paced to his voice, cut where you cut in), talking
   over him, the board that is the whole screen (writing on it, Show Bo, quiet looks, his marks on your
   writing, his pages as cards beside it, graphs you move and open in the grapher, kept for the next call),
   his notes, mute, typing, settings that change the call, the transcript saved to the chat, a failed call
   falling back to basic voice, basic voice itself (browser speech recognition and voices are stand-ins:
   window.__say, window.__spoken) with Show Bo and mark: lines, a blocked microphone, phones, Write it out
   in the chat, and no Max.
   ============================================================ */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const F = n => path.join(__dirname, 'fixtures', n);
const readJ = (n, fb) => { try { return JSON.parse(fs.readFileSync(F(n), 'utf8')); } catch (e) { return fb; } };
const { live, basic, quiet } = require('./talk-fakes');
(async () => {
  const { mk, txt, login, api, go, hscroll, log, check } = await T.start({ audio: true });
  const ds = (p, k) => p.evaluate(k => { const t = document.querySelector('#bo-talk'); return t ? t.dataset[k] || '' : 'closed'; }, k);
  const waitFor = async (p, k, want, ms = 8000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await ds(p, k); if (want.includes(s)) return s; await p.waitForTimeout(60); } return s; };
  const until = async (p, fn, arg, ms = 6000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await p.evaluate(fn, arg); if (v) return v; await p.waitForTimeout(80); } return v; };
  const setup = async (w, h, extra, o = {}) => {
    const [c, p] = await mk(w, h, o); await c.addInitScript(quiet); await c.addInitScript(live); await c.addInitScript(basic); if (extra) await c.addInitScript(extra);
    await go(p, '#/'); await login(p, 'mod.user@montana.edu'); await p.reload(); await p.waitForTimeout(700);
    await api(p, 'ai_forget', { what: 'all' }); await p.evaluate(() => { App.setSetting('aiConsent', Date.now()); App.setSetting('boTalkOk', 0); App.setSetting('boMode', ''); App.setSetting('boEager', ''); App.setSetting('boLiveVoice', ''); App.setSetting('boCaptions', true); App.setSetting('boCcSize', ''); App.setSetting('boCcBg', ''); App.setSetting('boWatch', true); App.setSetting('boBoardDark', false); localStorage.removeItem('mh-pad:calc'); });
    return [c, p];
  };
  const E = (p, ev) => p.evaluate(ev => window.__rt.emit(ev), ev);
  const sent = p => p.evaluate(() => window.__rt.sent);
  const voice = (p, on) => p.evaluate(on => { if (window.__rt.boGain) window.__rt.boGain.gain.value = on ? 0.3 : 0; }, on);   // Bo's voice sounding, or not
  const capBo = p => p.evaluate(() => { const c = [...document.querySelectorAll('#bt-cc .cc-bo')].pop(); return c ? c.textContent.trim() : ''; });
  const capYou = p => p.evaluate(() => { const c = [...document.querySelectorAll('#bt-cc .cc-you')].pop(); return c ? c.textContent.trim() : ''; });
  const cards = p => p.evaluate(() => [...document.querySelectorAll('#bt-pad .bt-card')].map(c => ({ title: (c.querySelector('.bb-title') || {}).textContent || '', items: [...c.querySelectorAll('.bb-item')].map(x => x.className.replace(/bb-item|bb-new/g, '').trim()), text: c.textContent, hidden: c.hidden, x: parseFloat(c.style.left), y: parseFloat(c.style.top) })));
  const scr = (p, x, y) => p.evaluate(([x, y]) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(document.querySelector('#bt-pad .wb-world').style.transform); return [x * +m[3] + +m[1], y * +m[3] + +m[2]]; }, [x, y]);   // a place on the board, on the screen
  const board = p => p.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}'));
  const stroke = async (p, pts) => { await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(q[0], q[1], { steps: 3 }); await p.mouse.up(); };
  const write = async (p, ox, oy) => {   // "2x + 3 = 11", roughly
    await stroke(p, [[ox, oy + 10], [ox + 10, oy], [ox + 20, oy + 8], [ox, oy + 30], [ox + 22, oy + 30]]); await stroke(p, [[ox + 32, oy + 12], [ox + 48, oy + 30]]); await stroke(p, [[ox + 48, oy + 12], [ox + 32, oy + 30]]);
    await stroke(p, [[ox + 60, oy + 20], [ox + 78, oy + 20]]); await stroke(p, [[ox + 69, oy + 11], [ox + 69, oy + 29]]); await stroke(p, [[ox + 90, oy + 4], [ox + 106, oy + 4], [ox + 98, oy + 15], [ox + 108, oy + 22], [ox + 90, oy + 30]]);
    await stroke(p, [[ox + 120, oy + 14], [ox + 138, oy + 14]]); await stroke(p, [[ox + 120, oy + 22], [ox + 138, oy + 22]]); await stroke(p, [[ox + 150, oy + 2], [ox + 150, oy + 30]]); await stroke(p, [[ox + 160, oy + 2], [ox + 160, oy + 30]]);
  };
  for (const n of ['live-last.json', 'live-hangups.json', 'live-tries.json', 'tts-all.json']) try { fs.unlinkSync(F(n)); } catch (e) {}

  // a Max member calls Bo on a laptop
  const [cm, m] = await setup(1360, 900);
  await go(m, '#/tutor/calc', 2200);
  check('Ask Bo has Call Bo, and a call button in the message box', /Call Bo/.test(await txt(m, '.bo-talk-btn:not([hidden])')) && !!(await m.$('.bo-mic')));
  await m.click('.bo-talk-btn'); await m.waitForTimeout(500);
  const hello = await txt(m, '#bo-talk');
  check('the first call explains it is a real call, that the screen is a board you share, and that the voice and pictures of the board go to OpenAI, before anything is sent', /It’s a real call/.test(hello) && /cut in/.test(hello) && /board you share/.test(hello) && /Show Bo/.test(hello) && /OpenAI/.test(hello) && /pictures of the board/.test(hello) && /Nothing is recorded/.test(hello) && !fs.existsSync(F('live-last.json')), hello.slice(0, 300));
  check('the first-call card is readable: its heading is light on the night sky', await m.$eval('#bt-hello-h', h => { const c = getComputedStyle(h).color.match(/\d+/g).map(Number); return c[0] > 200 && c[1] > 200; }));
  check('the call is a dialog with a live status, mute, Show Bo, photo, type and end', await m.$eval('#bo-talk', e => e.getAttribute('role') === 'dialog' && e.getAttribute('aria-modal') === 'true') && !!(await m.$('#bt-status[role="status"]')) && !!(await m.$('#bt-mute')) && !!(await m.$('#bt-look')) && !!(await m.$('#bt-file')) && !!(await m.$('[data-t="type"]')) && !!(await m.$('.bt-end')));
  await m.click('#bt-start');
  const s1 = await waitFor(m, 'state', ['live'], 6000);
  const setupReq = readJ('live-last.json', {}); const sess = setupReq.session || {};
  check('Start: the page sends its offer to Mathub, which sets the call up with OpenAI and hands the answer back', s1 === 'live' && /browser-offer/.test(setupReq.sdp || '') && setupReq.accept === 'application/sdp' && /s=stand-in/.test(await m.evaluate(() => window.__rt.answer)) && (await m.evaluate(() => window.__rt.channel)) === 'oai-events', { s1, accept: setupReq.accept });
  check('the call is speech to speech, with semantic turn-taking, interruptions, the laptop noise filter and Professor Bo’s voice (ash, a little slower)', sess.type === 'realtime' && sess.model === 'gpt-realtime-2.1' && sess.audio.input.turn_detection.type === 'semantic_vad' && sess.audio.input.turn_detection.interrupt_response === true && sess.audio.input.noise_reduction.type === 'far_field' && sess.audio.output.voice === 'ash' && sess.audio.output.speed === 0.9 && sess.audio.input.transcription.keywords.includes('M171') && sess.max_output_tokens === 'inf', sess.audio);
  const ins = sess.instructions || '';
  check('Bo is told to talk like a person on a call, not an assistant, and knows the class and the student', /not an assistant/.test(ins) && /Not "How can I help you today"/.test(ins) && /If they cut in, stop and go with what they said/.test(ins) && /CLASS:/.test(ins) && /WEAKEST TOPICS/.test(ins) && /You speak first/.test(ins), ins.slice(0, 200));
  check('he has seven tools: writing, drawing and asking on the board, marking their writing, checking math exactly, his notes, and waiting when the audio was not for him', (sess.tools || []).map(t => t.name).join() === 'write_on_board,draw_on_board,ask_on_board,mark_on_board,check_math,remember,wait_for_user' && (sess.tools || []).filter(t => t.parameters.properties.near).length === 3);
  check('and he is told how to teach: short turns, a proper explanation of something new with the board, check with a real question', /# How you teach/.test(ins) && /Most turns are one to three short sentences/.test(ins) && /never "does that make sense\?"/.test(ins) && !/Ask more than you tell/.test(ins));
  check('and about the board you share: their writing comes as a picture with a grid, and he marks it at its cells', /The whole screen is a board you share/.test(ins) && /columns A, B, C… across the top and rows 1, 2, 3… down/.test(ins) && /mark_on_board: circle, check/.test(ins) && /find the first mistake/.test(ins) && /do not answer those, just know what is there/.test(ins));
  check('Bo speaks first: the page asks for a response as soon as the call opens', (await sent(m)).some(x => x.type === 'response.create'));
  check('the clock runs', /\d:\d\d/.test(await txt(m, '#bt-clock'))); await m.waitForTimeout(700);
  const lay0 = await m.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const b = r('#bt-pad .wb'), o = r('#bt-orb'), t = r('.wb-tools'); return { full: b.width >= innerWidth - 1 && b.height >= innerHeight - 1, sky: getComputedStyle(document.querySelector('.bt-scrim')).visibility, orb: o.width, corner: o.right > innerWidth - 40 && o.top < 160, tools: t.left < 40 && t.height > 300, cards: document.querySelectorAll('.bt-card').length }; });
  check('once the call is on, the whole screen is the board with its tools, and Bo moves to a tile in the corner', lay0.full && lay0.sky === 'hidden' && lay0.orb <= 70 && lay0.corner && lay0.tools && lay0.cards === 0, lay0);
  // Bo talks: captions like a video's, his words let out as he says them
  await E(m, { type: 'conversation.item.added', item: { id: 'b1', type: 'message', role: 'assistant', content: [] } });
  await E(m, { type: 'response.created', response: { id: 'r1' } }); await E(m, { type: 'output_audio_buffer.started' }); await voice(m, true);
  await E(m, { type: 'response.output_audio_transcript.delta', item_id: 'b1', delta: 'Hey! Exam two is Friday. ' }); await E(m, { type: 'response.output_audio_transcript.delta', item_id: 'b1', delta: 'Want to hit the chain rule?' });
  await m.waitForTimeout(500);
  const early = await capBo(m);
  check('while Bo talks: status follows him, and his captions come as he says them, not all at once', (await ds(m, 'who')) === 'bo' && /talking/.test(await txt(m, '#bt-status')) && /^Bo\s+Hey!/.test(early) && !/chain rule/.test(early), early);
  const all1 = await until(m, () => { const c = [...document.querySelectorAll('#bt-cc .cc-bo')].pop(); return c && /Want to hit the chain rule\?/.test(c.textContent) ? c.textContent : ''; }, null, 7000);
  check('and the rest follows at his pace', !!all1, await capBo(m));
  const look1 = await m.evaluate(() => { const t = [...document.querySelectorAll('#bt-cc .cc-t')].pop(); const cs = getComputedStyle(t); const r = t.getBoundingClientRect(); const bar = document.querySelector('.bt-bar').getBoundingClientRect(); return { bg: cs.backgroundColor, color: cs.color, centred: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 40, above: r.bottom <= bar.top, events: getComputedStyle(document.querySelector('#bt-caps')).pointerEvents }; });
  check('the captions look like a video player\'s: white on see-through black, centred above the buttons, never in the way of the board', /rgba\(8, 8, 8, 0\.75\)/.test(look1.bg) && look1.color === 'rgb(255, 255, 255)' && look1.centred && look1.above && look1.events === 'none', look1);
  // you cut in by talking: the server stops him (interrupt_response); the page follows
  await E(m, { type: 'input_audio_buffer.speech_started' });
  await E(m, { type: 'conversation.item.added', item: { id: 'u1', type: 'message', role: 'user', content: [{ type: 'input_audio' }] } });
  await E(m, { type: 'output_audio_buffer.cleared' }); await voice(m, false);
  await E(m, { type: 'response.output_audio_transcript.done', item_id: 'b1', transcript: 'Hey! Exam two is Friday. Want to hit the chain rule?' });
  await E(m, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u1', delta: 'yeah I keep mixing up' });
  check('when you talk over him, he stops and the page listens, with your words under his as you say them', (await ds(m, 'who')) === 'you' && /^You\s+yeah I keep mixing up/.test(await capYou(m)) && await m.evaluate(() => { const c = [...document.querySelectorAll('#bt-cc .cc-cue')]; return c.length >= 2 && c[c.length - 1].classList.contains('cc-you'); }));
  await E(m, { type: 'input_audio_buffer.speech_stopped' });
  check('then he thinks', (await ds(m, 'who')) === 'thinking');
  await E(m, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'Yeah, I keep mixing up which part goes inside.' });
  // his answer, with the board and a note
  await E(m, { type: 'response.created', response: { id: 'r2' } });
  // as OpenAI sends it: the item that starts the call has its name; the arguments come later without it, then the finished item
  const a1 = JSON.stringify({ title: 'The chain rule', page: 'new', items: [{ kind: 'math', text: "\\frac{d}{dx} f(g(x)) = f'(g(x))\\,g'(x)" }, { kind: 'tip', text: 'Outside first, then times the derivative of the inside' }] });
  await E(m, { type: 'response.output_item.added', response_id: 'r2', output_index: 0, item: { id: 'fc1', type: 'function_call', status: 'in_progress', name: 'write_on_board', call_id: 'c1', arguments: '' } });
  await E(m, { type: 'response.function_call_arguments.done', response_id: 'r2', item_id: 'fc1', output_index: 0, call_id: 'c1', arguments: a1 });
  await E(m, { type: 'response.output_item.done', response_id: 'r2', output_index: 0, item: { id: 'fc1', type: 'function_call', status: 'completed', name: 'write_on_board', call_id: 'c1', arguments: a1 } });
  await E(m, { type: 'response.function_call_arguments.done', name: 'write_on_board', call_id: 'c3', arguments: JSON.stringify({ page: 'add', items: [{ kind: 'step', text: 'For $\\sin(x^2)$: $\\cos(x^2)\\cdot 2x$' }] }) });
  await E(m, { type: 'response.function_call_arguments.done', name: 'remember', call_id: 'c2', arguments: JSON.stringify({ fact: 'Mixes up inside and outside functions' }) });
  await E(m, { type: 'conversation.item.added', item: { id: 'b2', type: 'message', role: 'assistant', content: [] } });
  await E(m, { type: 'output_audio_buffer.started' });
  await E(m, { type: 'response.output_audio_transcript.done', item_id: 'b2', transcript: 'Totally normal. Outside first, then times the derivative of the inside. I put it on the board.' });
  await E(m, { type: 'output_audio_buffer.stopped' });
  await E(m, { type: 'response.done', response: { output: [{ type: 'function_call' }, { type: 'function_call' }, { type: 'message' }] } });
  check('when he finishes, the rest of what he said is up at once', /I put it on the board\./.test(await capBo(m)), await capBo(m));
  const outs = (await sent(m)).filter(x => x.type === 'conversation.item.create' && x.item.type === 'function_call_output');
  const cb1 = await cards(m);
  check('he writes a neat page as a card on the board: a title, the formula, a tip, then a step added to the same page', cb1.length === 1 && cb1[0].title === 'The chain rule' && cb1[0].items.join() === 'bb-math,bb-tip,bb-step' && /frac\{d\}\{dx\}/.test(cb1[0].text) && (await txt(m, '#bt-pages-n')) === '1', cb1);
  const placed = await m.evaluate(() => { const c = document.querySelector('.bt-card').getBoundingClientRect(); const t = document.querySelector('.bt-who').getBoundingClientRect(), bar = document.querySelector('.bt-bar').getBoundingClientRect(), tools = document.querySelector('.wb-tools').getBoundingClientRect(); return c.left >= tools.right && c.right <= innerWidth && c.top >= t.bottom - 4 && c.left < c.right; });
  check('the card goes up where you can see it, clear of Bo\'s tile, the tools and the buttons', placed);
  check('the page answers both board tools, once each (the arguments and the finished item are one call)', outs.filter(o => o.item.call_id === 'c1').length === 1 && outs.some(o => o.item.call_id === 'c1' && /"written":2/.test(o.item.output)) && outs.some(o => o.item.call_id === 'c3' && /"written":1/.test(o.item.output)), outs.map(o => o.item.output));
  check('his note is kept, and the page answers that tool too', outs.some(o => o.item.call_id === 'c2' && /saved/.test(o.item.output)) && /Bo will remember/.test(await txt(m, '.toast')));
  // he draws, too: a graph on a new card; a drawing that makes no sense goes back to him to fix
  await E(m, { type: 'response.output_item.done', response_id: 'r3', output_index: 0, item: { id: 'fc4', type: 'function_call', status: 'completed', name: 'draw_on_board', call_id: 'c4', arguments: JSON.stringify({ title: 'y = sin(x^2)', page: 'new', caption: 'It wiggles faster as x grows', drawing: { type: 'graph', x: [0, 4], fns: [{ f: 'sin(x^2)', label: 'y = sin(x^2)' }], points: [{ x: 0, y: 0, label: 'O' }] } }) } });
  await E(m, { type: 'response.function_call_arguments.done', call_id: 'c5', arguments: JSON.stringify({ drawing: { type: 'graph', fns: [{ f: 'alert(1)' }] } }) });   // no name at all: known by its arguments
  await m.waitForTimeout(400);
  const cbd = await m.evaluate(() => { const b = [...document.querySelectorAll('.bt-card')].pop(); const svg = b.querySelector('.bb-draw svg'); return { n: document.querySelectorAll('.bt-card').length, title: (b.querySelector('.bb-title') || {}).textContent, role: svg && svg.getAttribute('role'), name: svg && svg.querySelector('title').textContent, curve: !!b.querySelector('.bd-curve'), dot: !!b.querySelector('.bd-dot'), cap: (b.querySelector('.bd-cap') || {}).textContent, anim: !!b.querySelector('.bd.bd-anim'), live: !!b.querySelector('.bd-live[tabindex="0"]') }; });
  check('he draws on the board too: a graph on a new card, drawn stroke by stroke, named for screen readers, with what to notice', cbd.n === 2 && cbd.title === 'y = sin(x^2)' && cbd.role === 'img' && /Graph of y = sin\(x²\)/.test(cbd.name) && cbd.curve && cbd.dot && /wiggles faster/.test(cbd.cap) && cbd.anim, cbd);
  check('his graph is one you can move, like the Calc I grapher', cbd.live);
  const outs2 = (await sent(m)).filter(x => x.type === 'conversation.item.create' && x.item.type === 'function_call_output');
  check('the page tells him what he drew, and sends a drawing that makes no sense back to him', outs2.some(o => o.item.call_id === 'c4' && /"drawn":"graph"/.test(o.item.output)) && outs2.some(o => o.item.call_id === 'c5' && /could not be drawn/.test(o.item.output)) && (await txt(m, '#bt-pages-n')) === '2', outs2.map(o => o.item.output));
  // the graph on the card: zoom it, then open it in the grapher, over the call
  const ticks = () => m.$$eval('.bt-card:last-of-type .bd-tick', t => t.map(x => x.textContent).join(' '));
  const tk0 = await ticks(); await m.click('.bt-card:last-of-type [data-bdz="in"]'); await m.waitForTimeout(250);
  check('its zoom buttons zoom it, and Back to the first view appears', (await ticks()) !== tk0 && await m.$eval('.bt-card:last-of-type [data-bdz="home"]', b => !b.hidden));
  await m.click('.bt-card:last-of-type [data-bdz="open"]'); await m.waitForTimeout(500);
  const gx = await m.evaluate(() => { const x = document.querySelector('.bdx'); return x && { above: +getComputedStyle(x).zIndex > +getComputedStyle(document.querySelector('#bo-talk')).zIndex, fns: [...x.querySelectorAll('.bdx-fn')].map(f => f.textContent.trim()), w: x.querySelector('.bdx-plot svg').getBoundingClientRect().width }; });
  check('Open in the grapher shows his graph on the whole screen, over the call, with his curve listed', gx && gx.above && gx.fns.length === 1 && /sin\(x²\)/.test(gx.fns[0]) && gx.w > 700, gx);
  await m.fill('#bdx-f', 'x^2'); await m.press('#bdx-f', 'Enter'); await m.check('#bdx-d'); await m.waitForTimeout(300);
  check('there you add your own function and the derivative next to his', (await m.$$eval('.bdx-fn', f => f.length)) === 3 && (await m.$$eval('.bdx-plot .bd-curve', c => c.length)) === 3);
  await m.keyboard.press('Escape'); await m.waitForTimeout(250);
  check('Esc closes the grapher, not the call', !(await m.$('.bdx')) && !!(await m.$('#bo-talk')) && (await ds(m, 'state')) === 'live');
  check('an answer that already spoke is not asked for again', (await sent(m)).filter(x => x.type === 'response.create').length === 1);
  await E(m, { type: 'response.done', response: { output: [{ type: 'function_call' }] } });
  check('a turn that only used a tool asks Bo to go on talking', (await sent(m)).filter(x => x.type === 'response.create').length === 2);
  const creates = async () => (await sent(m)).filter(x => x.type === 'response.create').length;
  await E(m, { type: 'response.created', response: { id: 'r5' } }); await E(m, { type: 'response.output_audio_transcript.delta', item_id: 'b5', delta: 'Let me sketch that.' });
  await E(m, { type: 'response.done', response: { output: [{ type: 'message' }, { type: 'function_call' }] } });
  check('after a few words and a drawing ("let me sketch that"), Bo goes on to walk them through it', (await creates()) === 3);
  await E(m, { type: 'response.created', response: { id: 'r6' } }); await E(m, { type: 'response.done', response: { output: [{ type: 'function_call' }] } });
  check('but not more than twice in a row without them saying anything (no loops)', (await creates()) === 3);
  await E(m, { type: 'input_audio_buffer.speech_started' }); await E(m, { type: 'response.created', response: { id: 'r7' } }); await E(m, { type: 'response.done', response: { output: [{ type: 'function_call' }] } });
  check('once they talk again, he can go on after his tools again', (await creates()) === 4);
  // what he did not get to say never shows: he is cut off a few words in
  await E(m, { type: 'response.created', response: { id: 'r7b' } }); await E(m, { type: 'output_audio_buffer.started' }); await voice(m, true);
  await E(m, { type: 'response.output_audio_transcript.delta', item_id: 'b7', delta: 'So the outside function here is sine, and the inside is x squared, which means' });
  await m.waitForTimeout(700); await E(m, { type: 'input_audio_buffer.speech_started' }); await E(m, { type: 'output_audio_buffer.cleared' }); await voice(m, false);
  await E(m, { type: 'response.output_audio_transcript.done', item_id: 'b7', transcript: 'So the outside function here is sine, and the inside is x squared, which means' });
  const cutBo = await m.evaluate(() => { const c = [...document.querySelectorAll('#bt-cc .cc-bo')].pop(); return c ? c.textContent : ''; });
  check('when you cut him off, the captions keep only what he got to say', /So the/.test(cutBo) && !/which means/.test(cutBo), cutBo);
  // tapping Bo while he talks stops him at once
  await E(m, { type: 'output_audio_buffer.started' });
  await m.click('#bt-orb');
  check('tapping Bo while he talks stops him (cancel, and clear what is still playing)', (await sent(m)).some(x => x.type === 'response.cancel') && (await sent(m)).some(x => x.type === 'output_audio_buffer.clear'));
  await E(m, { type: 'output_audio_buffer.stopped' });

  // the board: you write on it; Bo gets a quiet look when you stop, and a real one when you tap Show Bo
  await write(m, 160, 470); await m.waitForTimeout(700);
  const st1 = await board(m);
  check('you write on the board with the pen (ten strokes), and it is kept for the class', (st1.items || []).filter(i => i.t === 's').length === 10, (st1.items || []).length);
  const quiet1 = await until(m, () => window.__rt.sent.find(x => x.type === 'conversation.item.create' && x.item.id && /^look_/.test(x.item.id)), null, 5000);
  check('when you stop writing, Bo gets a quiet look at the board: a picture with its grid, and no answer asked for', !!quiet1 && quiet1.item.content[0].type === 'input_image' && /^data:image\/jpeg;base64,/.test(quiet1.item.content[0].image_url) && /as I write\. The picture has a grid: columns A–J, rows 1–\d+/.test(quiet1.item.content[1].text) && (await creates()) === 4, quiet1 && quiet1.item.content[1].text);
  await m.click('#bt-look'); await m.waitForTimeout(300);
  const all2 = await sent(m); const show = all2.find(x => x.type === 'conversation.item.create' && x.item.id && /^show_/.test(x.item.id));
  check('Show Bo sends him the board and asks him to help with what you wrote; the older picture is taken out of the call', !!show && show.item.content[0].type === 'input_image' && /^Look at what I wrote on our board and help me with it\. \(The picture has a grid: columns A–J/.test(show.item.content[1].text) && (await creates()) === 5 && all2.some(x => x.type === 'conversation.item.delete' && x.item_id === quiet1.item.id) && (await ds(m, 'who')) === 'thinking');
  await E(m, { type: 'conversation.item.added', item: { id: show.item.id, type: 'message', role: 'user', content: show.item.content } });
  await E(m, { type: 'conversation.item.added', item: { id: quiet1.item.id, type: 'message', role: 'user', content: quiet1.item.content } });
  // Bo marks your writing at places on that picture, and puts a page beside it
  await E(m, { type: 'response.function_call_arguments.done', name: 'mark_on_board', call_id: 'm1', arguments: JSON.stringify({ marks: [{ at: 'D4:E4', kind: 'circle', text: 'subtract 3 first' }, { at: 'G4', kind: 'check' }] }) });
  await E(m, { type: 'response.function_call_arguments.done', name: 'mark_on_board', call_id: 'm2', arguments: JSON.stringify({ marks: [{ at: 'Z9', kind: 'circle' }] }) });
  await E(m, { type: 'response.function_call_arguments.done', name: 'write_on_board', call_id: 'w9', arguments: JSON.stringify({ title: 'Solving 2x + 3 = 11', near: 'G4', items: [{ kind: 'step', text: 'Take 3 from both sides: $2x = 8$' }, { kind: 'answer', text: '$x = 4$' }] }) });
  await m.waitForTimeout(1200);
  const outs4 = (await sent(m)).filter(x => x.type === 'conversation.item.create' && x.item.type === 'function_call_output');
  check('his marks go up on your writing, and a place that is not on the picture goes back to him with the grid to use', outs4.some(o => o.item.call_id === 'm1' && /"marked":2/.test(o.item.output)) && outs4.some(o => o.item.call_id === 'm2' && /not on the picture/.test(o.item.output) && /columns A–J/.test(o.item.output)), outs4.filter(o => /^m/.test(o.item.call_id)).map(o => o.item.output));
  const mk1 = await m.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}'));
  check('the marks are kept with your writing', (mk1.marks || []).map(x => x.kind).join() === 'circle,check' && (mk1.marks || [])[0].v === 'subtract 3 first', mk1.marks);
  const near = await m.evaluate(() => { const L = [...document.querySelectorAll('.bt-card')].pop(); const r = L.getBoundingClientRect(); return { x: r.left, y: r.top, title: L.querySelector('.bb-title').textContent }; });
  check('a page he puts "near" a place goes right beside that part of your writing', near.title === 'Solving 2x + 3 = 11' && near.x > 300 && near.x < 520 && near.y > 380 && near.y < 520, near);
  // undo takes his marks away too, and redo brings them back
  await m.click('[data-wb="undo"]'); await m.waitForTimeout(200);
  const un = await m.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}')); await m.waitForTimeout(600);
  const un2 = await m.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}'));
  check('Undo takes the last thing off the board (his marks), Redo puts it back', (un2.marks || []).length === 0 && (un2.items || []).length === 10, { m: (un2.marks || []).length, i: (un2.items || []).length });
  await m.click('[data-wb="redo"]'); await m.waitForTimeout(700);
  check('…and Redo puts them back', ((await m.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}'))).marks || []).length === 2);
  // tools: the eraser takes a whole stroke; text goes on the board
  const p2 = st1.items[0].p; const two = await scr(m, p2[0] - 10, p2[1]); await m.keyboard.press('e'); await stroke(m, [two, [two[0] + 1, two[1] + 1]]); await m.waitForTimeout(700);
  check('E picks the eraser, which takes away a whole stroke it touches', ((await m.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}'))).items || []).filter(i => i.t === 's').length === 9);
  await m.keyboard.press('t'); await m.mouse.click(200, 600); await m.waitForTimeout(200); await m.keyboard.type('x^2 + 1'); await m.keyboard.press('Enter'); await m.waitForTimeout(700);
  const tx = ((await m.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}'))).items || []).filter(i => i.t === 'x');
  check('T types on the board where you tap', tx.length === 1 && tx[0].v === 'x^2 + 1' && (await ds(m, 'state')) === 'live');
  await m.keyboard.press('p');
  // a card can be folded and put away; Bo's pages brings it back
  await m.click('.bt-card:last-of-type [data-btc="hide"]'); await m.waitForTimeout(150);
  await m.click('[data-t="pages"]'); await m.waitForTimeout(150);
  const pl = await m.$$eval('#bt-pages .bt-page-i', b => b.map(x => x.textContent.trim()));
  check('Bo\'s pages lists every page he wrote, and says which you put away', pl.length === 3 && /Solving 2x \+ 3 = 11\s*put away/.test(pl[2]), pl);
  await m.click('#bt-pages [data-goto="2"]'); await m.waitForTimeout(300);
  check('and brings one back', !(await m.$eval('.bt-card:last-of-type', c => c.hidden)) && !!(await m.$('#bt-pages[hidden]')));
  // mute
  await m.click('#bt-mute');
  check('Mute turns the microphone off and says so', (await m.$eval('#bt-mute', b => b.getAttribute('aria-pressed'))) === 'true' && (await m.evaluate(() => window.__rt.mic.getAudioTracks().every(t => !t.enabled))) && /muted/.test(await txt(m, '#bt-status')));
  await m.keyboard.press('m');
  check('M unmutes', (await m.evaluate(() => window.__rt.mic.getAudioTracks().every(t => t.enabled))) && (await m.$eval('#bt-mute', b => b.getAttribute('aria-pressed'))) === 'false');
  // typing in the call
  const before = (await sent(m)).filter(x => x.type === 'response.create').length;
  await m.click('[data-t="type"]'); await m.fill('#bt-q', 'Can you quiz me?'); await m.press('#bt-q', 'Enter');
  const typed = (await sent(m)).filter(x => x.type === 'conversation.item.create' && x.item.type === 'message');
  check('typing in the call sends your words to Bo and asks him to answer', typed.some(x => x.item.content[0].text === 'Can you quiz me?') && (await sent(m)).filter(x => x.type === 'response.create').length === before + 1);
  check('and your words show in the captions', /^You\s+Can you quiz me\?/.test(await capYou(m)));
  await E(m, { type: 'conversation.item.added', item: { id: 'u2', type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Can you quiz me?' }] } });
  // a question on the board: they answer it there, and Bo hears what they picked
  await E(m, { type: 'response.output_item.done', response_id: 'r8', output_index: 0, item: { id: 'fc8', type: 'function_call', status: 'completed', name: 'ask_on_board', call_id: 'c8', arguments: JSON.stringify({ title: 'Quick check', question: 'What is the derivative of $x^2$?', choices: ['$x$', '$2x$', '$x^2$'], answer: '$2x$', why: 'Bring the 2 down and take one off the power.' }) } });
  // a drawing as a JSON string with LaTeX written with one backslash, added to that page; and a drawing given as a board line
  await E(m, { type: 'response.function_call_arguments.done', name: 'draw_on_board', call_id: 'c10', arguments: JSON.stringify({ page: 'add', drawing: '{"type":"graph","fns":[{"f":"\\frac{1}{x}"}],"asymptotes":["x = 0"]}' }) });
  await E(m, { type: 'response.function_call_arguments.done', name: 'write_on_board', call_id: 'c11', arguments: JSON.stringify({ page: 'add', items: [{ kind: 'code', text: 'def f(x):\n    return x ** 2', lang: 'python' }] }) });
  await m.waitForTimeout(400);
  const qb = await m.evaluate(() => { const b = [...document.querySelectorAll('.bt-card')].pop(); return { n: document.querySelectorAll('.bt-card').length, title: (b.querySelector('.bb-title') || {}).textContent, opts: b.querySelectorAll('.bb-chk-o').length, draws: b.querySelectorAll('.bb-draw svg .bd-curve').length, asym: /x = 0/.test((b.querySelector('.bb-draw svg') || {}).textContent || ''), code: (b.querySelector('.bb-code pre') || {}).textContent }; });
  check('he puts a question on the board (a new card), a drawing sent as text with one-backslash LaTeX, and code', qb.n === 4 && qb.title === 'Quick check' && qb.opts === 3 && qb.draws === 1 && qb.asym && qb.code === 'def f(x):\n    return x ** 2', qb);
  const outs3 = (await sent(m)).filter(x => x.type === 'conversation.item.create' && x.item.type === 'function_call_output');
  check('the page tells him the question is up and to wait for the answer', outs3.some(o => o.item.call_id === 'c8' && /"asked":true/.test(o.item.output) && /let them answer/.test(o.item.output)) && outs3.some(o => o.item.call_id === 'c10' && /"drawn":"graph"/.test(o.item.output)), outs3.map(o => o.item.output));
  const before2 = await creates();
  await m.click('.bt-card:last-of-type .bb-chk-o[data-chk-o="0"]'); await m.waitForTimeout(250);
  const told = (await sent(m)).filter(x => x.type === 'conversation.item.create' && x.item.type === 'message').pop();
  check('tapping an answer marks it on the board and tells Bo what they picked, so he can react', !!(await m.$('.bt-card:last-of-type .bb-chk-o.no[data-chk-o="0"]')) && /On the board I answered "\$x\$" to your question "What is the derivative of \$x\^2\$\?"\. That is not right; the answer is \$2x\$\./.test(told && told.item.content[0].text) && (await creates()) === before2 + 1, told && told.item.content[0].text);
  // settings
  await m.click('[data-t="settings"]'); await m.waitForTimeout(200);
  check('settings: his voices, speed, when he jumps in, captions (size, background, names), the board, and basic voice', (await m.$$('#bt-set input[name="bt-lv"]')).length >= 6 && !!(await m.$('#bt-set [data-eager="low"]')) && !!(await m.$('#bt-set [data-lrate="1.1"]')) && !!(await m.$('#bt-cp')) && !!(await m.$('#bt-set [data-ccsize="xl"]')) && !!(await m.$('#bt-set [data-ccbg="solid"]')) && !!(await m.$('#bt-ccn')) && !!(await m.$('#bt-bw')) && !!(await m.$('#bt-bd')) && !!(await m.$('#bt-bm')));
  await m.click('#bt-set [data-eager="low"]');
  const upd = (await sent(m)).filter(x => x.type === 'session.update').pop();
  check('"Lets me finish" tells the call to wait longer before Bo answers', upd && upd.session.audio.input.turn_detection.eagerness === 'low' && upd.session.audio.input.turn_detection.type === 'semantic_vad', upd);
  const fs0 = await m.$eval('#bt-caps', e => getComputedStyle(e).getPropertyValue('--cc-fs').trim());
  await m.click('#bt-set [data-ccsize="xl"]'); await m.click('#bt-set [data-ccbg="solid"]'); await m.waitForTimeout(150);
  const cc2 = await m.evaluate(() => ({ fs: getComputedStyle(document.querySelector('#bt-caps')).getPropertyValue('--cc-fs').trim(), bg: getComputedStyle([...document.querySelectorAll('.cc-t')].pop()).backgroundColor }));
  check('captions can be made bigger and solid black, like a video player\'s caption options', fs0 === '24px' && cc2.fs === '40px' && cc2.bg === 'rgb(0, 0, 0)' && (await m.evaluate(() => App.settings().boCcSize === 'xl' && App.settings().boCcBg === 'solid')), { fs0, cc2 });
  await m.click('#bt-set [data-ccsize="m"]'); await m.click('#bt-set [data-ccbg="box"]');
  await m.click('#bt-bd'); await m.waitForTimeout(150);
  check('the board can be dark', await m.$eval('#bt-pad .wb', b => b.classList.contains('dark')) && (await m.evaluate(() => App.settings().boBoardDark === true)));
  await m.click('#bt-bd');
  await m.click('#bt-set input[value="marin"]'); await m.keyboard.press('Escape'); await m.waitForTimeout(150);
  check('Esc closes the settings first', !!(await m.$('#bo-talk')) && !!(await m.$('#bt-set[hidden]')));
  await m.click('[data-t="cc"]');
  check('captions can be turned off', await m.$eval('#bt-caps', e => e.classList.contains('off')) && (await m.$eval('[data-t="cc"]', b => b.getAttribute('aria-pressed'))) === 'false');
  await m.keyboard.press('c');
  check('C turns them back on, as in a video player', !(await m.$eval('#bt-caps', e => e.classList.contains('off'))));
  check('no sideways scroll in the call at 1360px', await hscroll(m));
  // hang up: the transcript goes into the chat, the call is hung up on the server
  await m.click('.bt-end'); await m.waitForTimeout(1800);
  check('End closes the call and stops the connection', !(await m.$('#bo-talk')) && (await m.evaluate(() => window.__rt.closed === true)));
  check('the server hung the call up too', readJ('live-hangups.json', []).length >= 1);
  const chat = await m.$$eval('#bo-log .bo-msg', ms => ms.map(x => ({ bo: x.classList.contains('bo'), t: x.textContent.trim() })));
  const iB1 = chat.findIndex(x => x.bo && /Exam two is Friday/.test(x.t)), iU1 = chat.findIndex(x => !x.bo && /which part goes inside/.test(x.t)), iB2 = chat.findIndex(x => x.bo && /Totally normal/.test(x.t));
  check('the chat now has the call, in order, with what you said marked as said out loud', iB1 >= 0 && iU1 > iB1 && iB2 > iU1 && /Said out loud/.test(chat[iU1].t), chat.map(x => x.t.slice(0, 30)));
  check('Show Bo is in the chat as the board you showed him; the quiet looks are not', chat.some(x => !x.bo && /The board/.test(x.t) && /Look at what I wrote on our board/.test(x.t) && !/grid/.test(x.t)) && !chat.some(x => /as I write/.test(x.t)), chat.filter(x => !x.bo).map(x => x.t.slice(0, 60)));
  const cb2 = await m.evaluate(() => ({ links: [...document.querySelectorAll('#bo-log [data-bo-page]')].map(b => b.textContent.trim()), title: (document.querySelector('#bo-board .bb-title') || {}).textContent, items: document.querySelectorAll('#bo-board .bb-item').length }));
  check('his first page is in the chat (one link) and on the chat\'s board, and his note is saved', cb2.links.length >= 1 && /On the board: The chain rule/.test(cb2.links[0]) && ((await api(m, 'ai_status')).json.notes || []).includes('Mixes up inside and outside functions'), cb2);
  const sent0 = (await sent(m)).length;
  await go(m, '#/tutor/calc', 1500); await m.click('.bo-talk-btn'); await waitFor(m, 'state', ['live'], 6000); await m.waitForTimeout(300);
  check('the next call uses the voice picked, and Bo never asks for the first-call explanation again', (readJ('live-last.json', {}).session || {}).audio.output.voice === 'marin' && !(await m.$('#bt-start')));
  check('and he remembers: his note and the last call are in what he is told', /Mixes up inside and outside functions/.test(readJ('live-last.json', {}).session.instructions) && /YOUR LAST FEW MESSAGES/.test(readJ('live-last.json', {}).session.instructions) && /\[on the board: The chain rule\]/.test(readJ('live-last.json', {}).session.instructions) && !/\ntip: Outside first/.test(readJ('live-last.json', {}).session.instructions));
  const kept = (await sent(m)).slice(sent0).filter(x => x.type === 'conversation.item.create' && x.item.id && /^look_/.test(x.item.id)).length;
  check('your board is still there on the next call, and Bo gets a look at it as the call opens', kept === 1 && await m.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}').items.length === 10));
  // the math check (assets/mathcheck.js), on this second call: Bo never agrees with something wrong
  check('Bo is told to check before he judges, and that the app\'s notes are exact', /Before you tell them an answer, a step or a number is right or wrong, check it with check_math/.test(ins) && /A MATH CHECK note from the app is exact/.test(ins));
  const notes = async () => (await sent(m)).filter(x => x.type === 'conversation.item.create' && x.item.role === 'system').map(x => x.item.content[0].text);
  const cuts = async () => (await sent(m)).filter(x => x.type === 'response.cancel' || x.type === 'output_audio_buffer.clear').length;
  const rcs = async () => (await sent(m)).filter(x => x.type === 'response.create').length;
  const n0 = (await notes()).length; let c0 = await cuts(), r0;
  // they say it while he is already answering (the transcript comes after his answer has started): a note, not a cut
  await E(m, { type: 'response.created', response: { id: 'rm1' } });
  await E(m, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'um1', transcript: 'So x equals 11 minus 3, so x equals 6.' }); await m.waitForTimeout(150);
  const mn1 = (await notes()).slice(n0);
  check('they say x = 11 − 3 so x = 6: he gets a note saying exactly what is wrong, and is not cut off for it', mn1.length === 1 && /11 − 3 is 8, not 6/.test(mn1[0]) && /Do not agree/.test(mn1[0]) && (await cuts()) === c0, mn1);
  r0 = await rcs();
  await E(m, { type: 'response.output_audio_transcript.delta', item_id: 'bm1', delta: 'Yes, exactly, x is ' }); await m.waitForTimeout(150);
  const mn1b = (await notes()).slice(n0 + 1);
  check('but if he starts to agree with it, he is stopped in his first words, told why, and answers again', (await cuts()) > c0 && mn1b.length === 1 && /you just started to agree/.test(mn1b[0]) && (await rcs()) === r0 + 1, mn1b);
  await E(m, { type: 'response.done', response: { id: 'rm1', status: 'cancelled', status_details: { reason: 'client_cancelled' }, output: [] } });
  await E(m, { type: 'response.created', response: { id: 'rm2' } });
  c0 = await cuts();
  await E(m, { type: 'response.output_audio_transcript.done', item_id: 'bm2', transcript: 'Okay so seven times eight is fifty four, right?' }); await m.waitForTimeout(150);
  const mn2 = (await notes()).slice(n0 + 2); r0 = await rcs();
  check('Bo says 7 × 8 is 54: he is told to correct himself, without being cut off', mn2.length === 1 && /7 · 8 is 56, not 54/.test(mn2[0]) && /Correct yourself/.test(mn2[0]) && (await cuts()) === c0, mn2);
  await E(m, { type: 'response.done', response: { id: 'rm2', status: 'completed', output: [{ type: 'message' }] } }); await m.waitForTimeout(100);
  check('…and he does, as soon as that answer is done', (await rcs()) === r0 + 1);
  await E(m, { type: 'response.done', response: { output: [] } });
  await E(m, { type: 'response.output_audio_transcript.done', item_id: 'bm3', transcript: 'Quick one: what is 11 minus 3?' });
  await E(m, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'um3', transcript: 'six' }); await m.waitForTimeout(150);
  const mn3 = (await notes()).slice(n0 + 3);
  check('he asks what 11 − 3 is and they say six: the note says 8', mn3.length === 1 && /11 − 3 is 8, not 6/.test(mn3[0]), mn3);
  await E(m, { type: 'response.output_audio_transcript.done', item_id: 'bm4', transcript: 'Try this: what is 7 times 8?' });
  await E(m, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'um4', transcript: 'fifty six' }); await m.waitForTimeout(150);
  const mn4a = (await notes()).slice(n0 + 4);
  check('they say 56: he is told it is right, so he can say so without a check of his own', mn4a.length === 1 && /That is right/.test(mn4a[0]), mn4a);
  await E(m, { type: 'response.created', response: { id: 'rm5' } }); c0 = await cuts();
  await E(m, { type: 'response.output_audio_transcript.delta', item_id: 'bm5', delta: 'Hmm, not quite.' }); await m.waitForTimeout(150);
  const mn4 = (await notes()).slice(n0 + 5);
  check('and if he starts to say not quite, he is stopped and told they were right', (await cuts()) > c0 && mn4.length === 1 && /they were right/.test(mn4[0]), mn4);
  await E(m, { type: 'response.done', response: { id: 'rm5', status: 'cancelled', output: [] } }); await E(m, { type: 'response.done', response: { output: [] } });
  await E(m, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'um6', transcript: 'My exam is on Friday at 9 and it is worth 20 percent.' });
  await E(m, { type: 'response.output_audio_transcript.done', item_id: 'bm6', transcript: 'Got it, Friday at 9. We have time.' }); await m.waitForTimeout(150);
  check('plain talk about days, times and percents is left alone', (await notes()).length === n0 + 6);
  // a cough or an "mm-hmm" over him that the server took for a turn: he carries on instead of starting over
  await E(m, { type: 'response.created', response: { id: 'rm7' } });
  await E(m, { type: 'response.done', response: { id: 'rm7', status: 'cancelled', status_details: { reason: 'turn_detected' }, output: [] } });
  await E(m, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'um7', transcript: 'Mm-hmm.' }); await m.waitForTimeout(150);
  check('an "mm-hmm" that cut him off: he is told to carry on from where he stopped, without repeating', /Carry on from where you stopped, without repeating/.test((await notes()).pop()));
  await E(m, { type: 'response.done', response: { output: [] } }); await m.waitForTimeout(600);
  // what they said is often written down only after his answer to it has begun: "Yes, exactly…" under way is still caught
  await E(m, { type: 'input_audio_buffer.speech_started' }); await m.waitForTimeout(50);
  await E(m, { type: 'response.created', response: { id: 'rm8' } });
  await E(m, { type: 'response.output_audio_transcript.delta', item_id: 'bm8', delta: 'Yes, exactly, and then ' }); c0 = await cuts(); let nn = (await notes()).length;
  await E(m, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'um8', transcript: 'So 7 times 8 is 54.' }); await m.waitForTimeout(150);
  const mn8 = (await notes()).slice(nn);
  check('written down only after he has started to agree: he is still stopped, and told why', (await cuts()) > c0 && mn8.length === 1 && /you just started to agree/.test(mn8[0]), mn8);
  await E(m, { type: 'response.done', response: { id: 'rm8', status: 'cancelled', output: [] } }); await E(m, { type: 'response.done', response: { output: [] } }); await m.waitForTimeout(600);
  await E(m, { type: 'input_audio_buffer.speech_started' }); await m.waitForTimeout(50);
  await E(m, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'um9', transcript: 'So 7 times 8 is 54.' }); await m.waitForTimeout(100);
  await E(m, { type: 'response.created', response: { id: 'rm9' } }); c0 = await cuts();
  await E(m, { type: 'response.output_audio_transcript.delta', item_id: 'bm9', delta: 'Nice try, but seven times eight is a bit more.' }); await m.waitForTimeout(150);
  check('"Nice try, but…" is not agreeing: he is not stopped', (await cuts()) === c0);
  await E(m, { type: 'response.done', response: { id: 'rm9', status: 'completed', output: [{ type: 'message' }] } });
  await E(m, { type: 'response.function_call_arguments.done', name: 'check_math', call_id: 'k1', arguments: JSON.stringify({ kind: 'solves', equation: '2x + 3 = 11', values: 'x = 6' }) });
  await E(m, { type: 'response.function_call_arguments.done', call_id: 'k2', arguments: JSON.stringify({ kind: 'derivative', f: 'x^3', answer: '3x^2' }) });   // no name: known by its arguments
  const cardsBefore = await m.$$eval('.bt-card', c => c.length);
  await E(m, { type: 'response.function_call_arguments.done', name: 'write_on_board', call_id: 'k3', arguments: JSON.stringify({ title: 'Solving 2x + 3 = 11', page: 'new', items: [{ kind: 'step', text: 'Take 3 from both sides: $2x = 14$' }, { kind: 'answer', text: '$x = 7$' }] }) });
  await E(m, { type: 'response.function_call_arguments.done', name: 'ask_on_board', call_id: 'k4', arguments: JSON.stringify({ question: 'What is 11 - 3?', answer: '6' }) });
  await m.waitForTimeout(250);
  const K = Object.fromEntries((await sent(m)).filter(x => x.type === 'conversation.item.create' && x.item.type === 'function_call_output' && /^k/.test(x.item.call_id)).map(x => [x.item.call_id, JSON.parse(x.item.output)]));
  check('check_math: x = 6 does not solve 2x + 3 = 11, and 3x² is the derivative of x³', K.k1 && K.k1.ok === true && K.k1.solves === false && K.k1.left === '15' && K.k2 && K.k2.right === true, K);
  check('a page with a wrong step does not go up: he is told which line and why, to fix it quietly, never as an error', K.k3 && K.k3.ok === false && K.k3.retry === true && !K.k3.error && /line 1 does not hold/.test(K.k3.hint) && /2x = 14 does not follow from 2x \+ 3 = 11/.test(K.k3.hint) && /Do not mention this to the student/.test(K.k3.hint) && (await m.$$eval('.bt-card', c => c.length)) === cardsBefore, K.k3);
  check('nor does a question with a wrong answer', K.k4 && K.k4.retry === true && /its answer does not hold/.test(K.k4.hint), K.k4);
  await E(m, { type: 'response.function_call_arguments.done', name: 'write_on_board', call_id: 'k5', arguments: JSON.stringify({ title: 'Solving 2x + 3 = 11', page: 'new', items: [{ kind: 'step', text: 'Take 3 from both sides: $2x = 8$' }, { kind: 'step', text: 'Halve both sides: $x = 4$' }, { kind: 'answer', text: '$x = 4$' }] }) });
  await m.waitForTimeout(250);
  check('the fixed page goes up', (await m.$$eval('.bt-card', c => c.length)) === cardsBefore + 1);
  if (!(await m.isVisible('#bt-q'))) await m.click('[data-t="type"]');
  await m.fill('#bt-q', 'so 11 - 3 = 6?'); await m.press('#bt-q', 'Enter'); await m.waitForTimeout(150);
  const tailT = (await sent(m)).slice(-3).map(x => x.type + (x.item ? ':' + x.item.role : ''));
  check('typed in the call: checked too, the note goes in before he answers', tailT.join() === 'conversation.item.create:user,conversation.item.create:system,response.create' && /11 − 3 is 8, not 6/.test((await notes()).pop()), tailT);
  // the end of the call: the slips become practice in the mistakes notebook, and Bo leaves a recap (api ai_recap)
  await m.evaluate(() => { const d = Date.now.bind(Date); Date.now = () => d() + 60000; });   // a call of over a minute
  await m.keyboard.press('Escape'); await m.waitForTimeout(500);
  const toastT = await m.waitForFunction(() => { const t = document.querySelector('.toast'); return t && /recap/.test(t.textContent) && t.textContent; }, null, { timeout: 8000 }).then(h => h.jsonValue()).catch(() => '');
  check('hanging up: Professor Bo leaves a recap in the chat and the email, with three to try', /^Professor Bo left you a recap in the chat and in your email, with three to try\.$/.test(toastT), toastT);
  const rq = readJ('ai-last.json', {}); const rqText = String(((rq.messages || [])[0] || {}).content || '');
  check('he writes it from the call, with the slips the app caught and his character', (rq.system || []).some(b => /^THE CALL RECAP/.test(b.text)) && (rq.system || []).some(b => /^YOUR CHARACTER: Professor Bo/.test(b.text)) && /Them: So x equals 11 minus 3/.test(rqText) && /MATH CHECK caught on the call \(exact\): [^\n]*11 − 3 is 8, not 6/.test(rqText), rqText.slice(-400));
  await m.waitForTimeout(600);
  const rcp = await m.evaluate(() => ({ links: [...document.querySelectorAll('#bo-log [data-bo-page]')].map(b => b.textContent.trim()), nb: App.mistakesAll('calc').filter(x => x.t === 'From your call with Bo').map(x => ({ p: x.q.prompt, a: x.q.answer, due: x.due <= Date.now(), src: x.src })) }));
  check('the recap is a page in the chat', rcp.links.some(l => /Call recap: Solving linear equations/.test(l)), rcp.links);
  check('and the mistakes notebook has the slips to practise, due now: 11 − 3 from the call, and his three', rcp.nb.length >= 3 && rcp.nb.some(x => /11 - 3/.test(x.p) && x.a === 8) && rcp.nb.some(x => /2x = 14/.test(x.p) && x.a === 7) && rcp.nb.every(x => x.due && x.src === 'bo'), rcp.nb);
  // Write it out, in the chat: the same board on the whole screen; its picture goes with the question
  await m.click('[data-bo-draw]'); await m.waitForTimeout(400);
  check('Write it out opens the board on the whole screen, with your writing from the call', !!(await m.$('.wb-sheet .wb')) && (await m.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}').items.length)) === 10);
  await m.click('.wb-sheet [data-ps="send"]'); await m.waitForTimeout(300);
  check('Add to my question puts its picture with the next question', !(await m.$('.wb-sheet')) && !!(await m.$('#bo-photo-prev img')));
  await m.fill('#bo-q', 'Is my working right?'); await m.keyboard.press('Enter'); await m.waitForTimeout(2500);
  const lastU = await m.$$eval('#bo-log .bo-msg.you', ms => ms.pop().textContent), lastB = await m.$$eval('#bo-log .bo-msg.bo', ms => ms.pop().textContent);
  check('Bo reads it as your handwriting, and the chat shows it came from the board', /The board/.test(lastU) && /I read your writing/.test(lastB), { lastU, lastB });
  await cm.close();

  // a call that cannot be set up offers basic voice; basic voice works without the live service
  const [cf, f] = await setup(1360, 900, () => { window.__badOffer = true; });
  await f.evaluate(() => App.setSetting('boTalkOk', Date.now()));
  await go(f, '#/tutor/calc', 2200); await f.click('.bo-talk-btn');
  const f1 = await waitFor(f, 'state', ['error'], 6000);
  check('a call that fails says so, with Call again and Use basic voice', f1 === 'error' && !!(await f.$('[data-t="retry"]')) && !!(await f.$('[data-t="basic"]')), await txt(f, '#bt-extra'));
  await f.evaluate(() => { window.__say.push('What is the chain rule'); });
  await f.click('[data-t="basic"]');
  const f2 = await waitFor(f, 'who', ['you', 'thinking'], 8000); const f3 = await waitFor(f, 'who', ['bo'], 8000);
  check('basic voice: Bo greets, listens, hears the question and answers out loud', (await ds(f, 'mode')) === 'basic' && ['you', 'thinking'].includes(f2) && f3 === 'bo' && /What is the chain rule/.test(await capYou(f)), { f2, f3, you: await capYou(f) });
  await waitFor(f, 'who', ['listening'], 9000);
  check('basic voice: his answer is read out, sentence by sentence, without the formula', readJ('tts-all.json', []).some(x => /derivative of the outside/.test(x)) && !readJ('tts-all.json', []).some(x => /frac|board/.test(x)), readJ('tts-all.json', []).slice(-4));
  check('basic voice: his captions follow what he read out', /derivative of the inside/.test(await capBo(f)), await capBo(f));
  const fc = await cards(f);
  check('basic voice: the board shows the page from his answer, and the tip on it is not read out', fc.length === 1 && fc[0].title === 'The chain rule' && fc[0].items.includes('bb-tip') && !readJ('tts-all.json', []).some(x => /Outside first/.test(x)), fc);
  // Show Bo in basic voice: the picture goes with the question, and his mark: lines are drawn, never read out
  await write(f, 200, 300); await f.waitForTimeout(300);
  await f.click('#bt-look');
  await waitFor(f, 'who', ['bo'], 8000); await waitFor(f, 'who', ['listening', 'muted'], 12000);
  const said2 = readJ('tts-all.json', []).slice(-6).join(' | ');
  const fm = await f.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}')); const fc2 = await cards(f);
  check('basic voice: Show Bo sends the board with its grid, and he answers about it', /I see your board, grid \d+x\d+/.test(said2), said2);
  check('his mark: lines go on your writing (inside a page too) and are never read out', (fm.marks || []).map(x => x.kind).join() === 'circle,check,note' && !/mark:|sign slip|try this/.test(said2) && fc2.length === 2 && fc2[1].title === 'Fixing the sign' && fc2[1].items.join() === 'bb-step', { marks: fm.marks, said2, fc2 });
  await f.keyboard.press('Escape'); await f.waitForTimeout(400);
  const fchat = await f.$$eval('#bo-log .bo-msg', ms => ms.map(x => x.textContent.trim()));
  check('in the chat, the board you showed is tagged, and his marks are not shown as text', fchat.some(x => /The board/.test(x) && /Look at what I wrote/.test(x)) && !fchat.some(x => /mark:|sign slip/.test(x)), fchat.slice(-3).map(x => x.slice(0, 80)));
  await cf.close();

  // a blocked microphone
  const [cb, bl] = await setup(1360, 900, () => { window.__micDenied = true; });
  await bl.evaluate(() => App.setSetting('boTalkOk', Date.now()));
  await go(bl, '#/tutor/calc', 2200); await bl.click('.bo-talk-btn');
  await waitFor(bl, 'state', ['error'], 6000);
  check('a blocked microphone says how to allow it, and opens typing', /allow it/i.test(await txt(bl, '#bt-extra')) && !(await bl.$('#bt-type[hidden]')), await txt(bl, '#bt-extra'));
  await bl.keyboard.press('Escape'); await cb.close();

  // phones
  const [cp, ph] = await setup(390, 844, null, { isMobile: true, hasTouch: true });
  await ph.evaluate(() => App.setSetting('boTalkOk', Date.now()));
  await go(ph, '#/tutor/calc', 2200);
  check('phone: the call button in the message box starts the call (the header button steps aside)', (await ph.$eval('.bo-talk-btn', b => getComputedStyle(b).display)) === 'none' && await ph.$eval('.bo-mic', b => b.getBoundingClientRect().width >= 44));
  await ph.tap('.bo-mic'); await waitFor(ph, 'state', ['live'], 6000);
  await E(ph, { type: 'response.function_call_arguments.done', name: 'write_on_board', call_id: 'c9', arguments: JSON.stringify({ lines: ['x^2 + 3x'] }) });
  await E(ph, { type: 'response.created', response: { id: 'p1' } }); await E(ph, { type: 'output_audio_buffer.started' });
  await E(ph, { type: 'response.output_audio_transcript.delta', item_id: 'b9', delta: 'Okay so look at the board for a sec, what do you notice first about this one?' });
  await E(ph, { type: 'output_audio_buffer.stopped' }); await ph.waitForTimeout(300);
  const lay = await ph.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const t = r('.wb-tools'), bar = r('.bt-bar'), cap = r('.bt-caps'), card = r('.bt-card'); return { bar: bar.bottom, end: r('.bt-end').right, endW: r('.bt-end .bt-btn-ic').width, card: card.width, cardIn: card.left >= 0 && card.right <= innerWidth, toolsRow: t.height < 60 && t.bottom <= bar.top, capAbove: cap.bottom <= t.top + 1, h: innerHeight, w: innerWidth }; });
  check('phone: the call fits: the board\'s tools in a row over the call buttons, captions above them, his card on screen', lay.bar <= lay.h + 1 && lay.end <= lay.w && lay.endW >= 48 && lay.card >= 300 && lay.cardIn && lay.toolsRow && lay.capAbove, lay);
  await ph.touchscreen.tap(200, 520); await ph.waitForTimeout(700);
  check('phone: a tap with a finger draws a dot on the board', ((await ph.evaluate(() => JSON.parse(localStorage.getItem('mh-pad:calc') || '{}'))).items || []).length === 1);
  check('phone: no sideways scroll in the call', await hscroll(ph));
  await ph.keyboard.press('Escape'); await cp.close();

  // no Max: no call
  const [ca, a] = await mk(1360, 900); await a.addInitScript(quiet); await go(a, '#/'); await login(a, 'alice.a@montana.edu'); await a.reload(); await a.waitForTimeout(600);
  await api(a, 'create_status&refresh=1'); await go(a, '#/tutor/calc', 1800);
  check('without Max, Ask Bo shows Meet Bo and no way to call him', /Meet Bo/.test(await txt(a, '#bo-main')) && !(await a.$('.bo-talk-btn:not([hidden])')) && !(await a.$('.bo-mic')));
  await ca.close();

  const [cc, cl] = await mk(1360, 900); await go(cl, '#/'); await login(cl, 'mod.user@montana.edu'); await api(cl, 'ai_forget', { what: 'all' }); await cl.evaluate(() => localStorage.removeItem('mh-pad:calc')); await cc.close();
  log('calls checked');
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
