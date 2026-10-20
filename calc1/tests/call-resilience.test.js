/* A call with Bo through network trouble and echo (assets/talk.js, Live; the research is in docs/bo-teaching.md).
   Covered, on the stand-in call from tests/talk-fakes.js: a blip ("disconnected" that heals) changes nothing; one that
   lasts shows Reconnecting… and the call is rebuilt as the same call (resume: the last call's id, the board and the
   clock kept, Bo picks up instead of greeting); "failed" rebuilds at once; offline waits for the network; a minute
   without any connection ends the call, saying so; his greeting can't be cut off by his own voice (the mic waits);
   with "My speakers echo" the mic waits while he talks; the response queue (no two at once, a harmless race is not
   shown); a tool to retry quietly brings him back, wait_for_user does not. */
const T = require('./lib'); const path = require('path');
const { live, quiet } = require('./talk-fakes');
const sqlite = q => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'), q]);
(async () => {
  const { mk, login, api, go, txt, check } = await T.start({ audio: true });
  const E = (p, ev) => p.evaluate(ev => window.__rt.emit(ev), ev);
  const sent = p => p.evaluate(() => window.__rt.sent);
  const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await p.evaluate(fn, arg); if (v) return v; await p.waitForTimeout(150); } return v; };
  sqlite("DELETE FROM rate WHERE key LIKE 'ai_live%'");
  const counter = () => { window.__starts = []; const f = window.fetch; window.fetch = (u, o) => { if (/ai_live_start/.test(String(u))) { try { window.__starts.push(JSON.parse(o.body)); } catch (e) {} } return f(u, o); }; };
  const [c, p] = await mk(1360, 900, { serviceWorkers: 'block' }); await c.addInitScript(quiet); await c.addInitScript(live); await c.addInitScript(counter);
  await go(p, '#/', 500); await login(p, 'mod.user@montana.edu'); await p.reload(); await p.waitForTimeout(700);
  await api(p, 'ai_forget', { what: 'all' });
  await p.evaluate(() => { App.setSetting('aiConsent', Date.now()); App.setSetting('boTalkOk', Date.now()); App.setSetting('boMode', ''); App.setSetting('boHalf', false); App.setSetting('boEager', ''); });
  await go(p, '#/tutor/calc', 2000); await p.click('.bo-talk-btn');
  await until(p, () => document.querySelector('#bo-talk') && document.querySelector('#bo-talk').dataset.state === 'live');
  const mic = () => p.evaluate(() => window.__rt.mic.getAudioTracks()[0].enabled);

  // his greeting: the mic waits until he has said it (the echo canceller is weakest in the first seconds)
  check('as the call opens, he speaks first, and the mic waits while he greets', (await sent(p)).some(x => x.type === 'response.create') && (await mic()) === false);
  await E(p, { type: 'response.created', response: { id: 'g1' } }); await E(p, { type: 'output_audio_buffer.started' });
  await E(p, { type: 'response.done', response: { id: 'g1', status: 'completed', output: [{ type: 'message' }] } }); await E(p, { type: 'output_audio_buffer.stopped' });
  check('and opens when he is done', !!(await until(p, () => window.__rt.mic.getAudioTracks()[0].enabled === true)));
  check('the call starts as a new call, on the laptop noise filter', (await p.evaluate(() => window.__starts)).length === 1 && (await p.evaluate(() => window.__starts[0].resume)) === '' && (await p.evaluate(() => window.__starts[0].mic)) === 'speaker');

  // the queue: one response at a time; the harmless race the server reports is not shown
  const rc = async () => (await sent(p)).filter(x => x.type === 'response.create').length;
  await E(p, { type: 'response.created', response: { id: 'q1' } }); const r0 = await rc();
  if (!(await p.isVisible('#bt-q'))) await p.click('[data-t="type"]');
  await E(p, { type: 'error', error: { code: 'conversation_already_has_active_response', message: 'Conversation already has an active response' } });
  await E(p, { type: 'response.done', response: { id: 'q1', status: 'completed', output: [{ type: 'message' }] } }); await p.waitForTimeout(150);
  check('a request that met an answer still going is sent again once that answer is done, and nothing is shown', (await rc()) === r0 + 1 && !/active response/i.test(await txt(p, '#bo-talk')));
  await E(p, { type: 'response.done', response: { output: [] } });
  const r1 = await rc(); await E(p, { type: 'error', error: { code: 'conversation_already_has_active_response', message: 'Conversation already has an active response' } }); await p.waitForTimeout(1600);
  check('and one that met an answer just ending, with none going now, is sent again a moment later', (await rc()) === r1 + 1);
  await E(p, { type: 'response.done', response: { output: [] } });
  // tools: a quiet retry brings him back; wait_for_user ends his turn
  const before = await rc();
  await E(p, { type: 'response.function_call_arguments.done', name: 'write_on_board', call_id: 't1', arguments: '{}' });
  const out1 = (await sent(p)).filter(x => x.type === 'conversation.item.create' && x.item.type === 'function_call_output' && x.item.call_id === 't1').map(x => JSON.parse(x.item.output))[0];
  check('a tool given nothing to do answers "retry quietly", never as an error to read out', out1 && out1.ok === false && out1.retry === true && !out1.error && /Do not mention this to the student/.test(out1.hint), out1);
  await E(p, { type: 'response.done', response: { status: 'completed', output: [{ type: 'function_call', name: 'write_on_board', call_id: 't1' }, { type: 'message' }] } }); await p.waitForTimeout(100);
  check('and he comes back to fix it', (await rc()) === before + 1);
  await E(p, { type: 'response.done', response: { output: [] } });
  const b2 = await rc();
  await E(p, { type: 'response.function_call_arguments.done', name: 'wait_for_user', call_id: 't2', arguments: '{}' });
  await E(p, { type: 'response.done', response: { status: 'completed', output: [{ type: 'function_call', name: 'wait_for_user', call_id: 't2' }] } }); await p.waitForTimeout(100);
  check('audio that was not for him (wait_for_user): he stays quiet', (await rc()) === b2);

  // a blip: "disconnected" that heals by itself within a second or two changes nothing
  await p.evaluate(() => { window.__rt.pc.connectionState = 'disconnected'; }); await p.waitForTimeout(1200);
  await p.evaluate(() => { window.__rt.pc.connectionState = 'connected'; }); await p.waitForTimeout(1500);
  check('a short blip: no new call, nothing shown', (await p.evaluate(() => window.__starts.length)) === 1 && !(await p.$('#bo-talk[data-rc="1"]')) && (await p.$eval('#bo-talk', e => e.dataset.state)) === 'live');

  // a real drop: Reconnecting…, then the same call on a new connection
  await p.evaluate(() => { window.__rt.oldPc = window.__rt.pc; window.__rt.pc.connectionState = 'disconnected'; });
  const shown = await until(p, () => !!document.querySelector('#bo-talk[data-rc="1"]') && /reconnecting/.test(document.querySelector('#bt-status').textContent), null, 5000);
  check('after a couple of seconds it says Reconnecting…, and the call stays on the screen', !!shown && (await p.$eval('#bo-talk', e => e.dataset.state)) === 'live');
  const back = await until(p, () => window.__starts.length === 2 && window.__rt.pc !== window.__rt.oldPc && !document.querySelector('#bo-talk[data-rc="1"]'), null, 12000);
  const st2 = await p.evaluate(() => window.__starts[1]);
  check('a few seconds later the call is rebuilt as the same call (the last call\'s id goes with it), and Reconnecting… goes away', !!back && /^[a-f0-9]{24}$/.test(st2.resume), st2 && st2.resume);
  check('the board, the clock and the captions are still there, and he speaks first again (to pick up, not to greet)', !!(await p.$('#bt-pad .wb')) && /\d:\d\d/.test(await txt(p, '#bt-clock')) && (await sent(p)).slice(-3).some(x => x.type === 'response.create') && (await mic()) === true);
  const ins = require('fs').readFileSync(path.join(__dirname, 'fixtures', 'live-last.json'), 'utf8');
  check('and he is told the call dropped and is back, so he does not start over', /The call is back/.test(ins) && /Do not greet them again/.test(ins));

  // "failed": rebuilt at once
  await p.evaluate(() => { window.__rt.oldPc = window.__rt.pc; window.__rt.pc.connectionState = 'failed'; });
  check('"failed" rebuilds the call right away', !!(await until(p, () => window.__starts.length === 3 && window.__rt.pc !== window.__rt.oldPc, null, 6000)));

  // offline: it waits for the network, then comes back
  await c.setOffline(true); await p.evaluate(() => { window.__rt.oldPc = window.__rt.pc; window.__rt.pc.connectionState = 'disconnected'; });
  check('offline: it says so and waits', !!(await until(p, () => /offline/.test(document.querySelector('#bt-status').textContent), null, 6000)));
  await c.setOffline(false);
  check('back online: the call comes back by itself', !!(await until(p, () => window.__starts.length >= 4 && window.__rt.pc !== window.__rt.oldPc && !document.querySelector('#bo-talk[data-rc="1"]'), null, 15000)));

  // echo: "My speakers echo" keeps the mic closed while he talks, and opens it after
  await p.evaluate(() => App.setSetting('boHalf', true));
  await E(p, { type: 'response.created', response: { id: 'h1' } }); await E(p, { type: 'output_audio_buffer.started' }); await p.waitForTimeout(100);
  check('with "My speakers echo", the mic is closed while he talks', (await mic()) === false);
  await E(p, { type: 'output_audio_buffer.stopped' }); await E(p, { type: 'response.done', response: { id: 'h1', status: 'completed', output: [{ type: 'message' }] } });
  check('and opens again a moment after he stops', !!(await until(p, () => window.__rt.mic.getAudioTracks()[0].enabled === true, null, 3000)));
  await E(p, { type: 'response.created', response: { id: 'h2' } }); await E(p, { type: 'output_audio_buffer.started' }); await p.waitForTimeout(100);
  await p.click('#bt-orb'); await p.waitForTimeout(150);
  check('tapping Bo stops him (the manual stop) and opens the mic', (await sent(p)).slice(-3).some(x => x.type === 'output_audio_buffer.clear') && (await mic()) === true);
  await E(p, { type: 'output_audio_buffer.cleared' }); await E(p, { type: 'response.done', response: { id: 'h2', status: 'cancelled', output: [] } });
  await p.evaluate(() => App.setSetting('boHalf', false));
  await p.click('[data-t="settings"]'); await p.waitForTimeout(200);
  check('the call\'s settings have "I’m wearing headphones" and "My speakers echo"', !!(await p.$('#bt-hs')) && !!(await p.$('#bt-hd')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);

  // no connection at all for a minute: the call ends, and says so
  await p.evaluate(() => { window.__badOffer = true; window.__rt.oldPc = window.__rt.pc; window.__rt.pc.connectionState = 'failed'; });
  await until(p, () => window.__starts.length >= 6, null, 8000);
  await p.evaluate(() => { const d = Date.now.bind(Date); Date.now = () => d() + 61000; });
  const gone = await until(p, () => document.querySelector('#bo-talk') && document.querySelector('#bo-talk').dataset.state === 'ended' && document.querySelector('#bt-extra').textContent, null, 15000);
  check('a minute without any connection ends the call, saying what happened, with Call again', !!gone && /lost the connection/.test(gone) && !!(await p.$('#bt-extra [data-t="retry"]')), gone);
  await p.click('.bt-end'); await c.close();
  sqlite("DELETE FROM ai_live WHERE user_id = (SELECT id FROM users WHERE email = 'mod.user@montana.edu'); DELETE FROM rate WHERE key LIKE 'ai_live%'");
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
