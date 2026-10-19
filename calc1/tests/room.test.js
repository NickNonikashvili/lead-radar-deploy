/* Study rooms (api/room.php, assets/room.js, the people button on a call in assets/talk.js). A Max member on a
   call (the stand-in from tests/talk-fakes.js) opens a room; a classmate joins with the code in another browser.
   Covered: the code and link; joining (wrong code, your own room); the board both ways (what the host writes
   shows for the classmate, and back), Bo's captions and pages for the classmate, a classmate's question that
   Bo hears with their name, people coming and going, the end of the call closing the room; and on a phone. */
const T = require('./lib'); const path = require('path');
const { live, quiet } = require('./talk-fakes');
const sh = (code, ...a) => require('child_process').spawnSync('php', ['-r', code, ...a]);
const sqlite = q => sh('$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'), q);
(async () => {
  const { mk, login, api, go, txt, check, log } = await T.start({ audio: true });
  const E = (p, ev) => p.evaluate(ev => window.__rt.emit(ev), ev);
  const sent = p => p.evaluate(() => window.__rt.sent);
  const stroke = async (p, pts) => { await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(q[0], q[1], { steps: 3 }); await p.mouse.up(); };
  const until = async (p, fn, arg, ms = 6000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await p.evaluate(fn, arg); if (v) return v; await p.waitForTimeout(200); } return v; };
  sqlite("DELETE FROM rate WHERE key LIKE 'room_%' OR key LIKE 'ai_live:%'");

  // the host: a Max member on a call
  const [ch, h] = await mk(1360, 900, { serviceWorkers: 'block' }); await ch.addInitScript(quiet); await ch.addInitScript(live);
  await go(h, '#/', 500); await login(h, 'mod.user@montana.edu'); await h.reload(); await h.waitForTimeout(700);
  await h.evaluate(() => { App.setSetting('aiConsent', Date.now()); App.setSetting('boTalkOk', Date.now()); App.setSetting('boMode', ''); localStorage.removeItem('mh-pad:calc'); });
  await go(h, '#/tutor/calc', 2000); await h.click('.bo-talk-btn'); await h.waitForTimeout(400);
  if (await h.$('#bt-start')) await h.click('#bt-start');
  await until(h, () => document.querySelector('#bo-talk') && document.querySelector('#bo-talk').dataset.state === 'live');
  check('the call has a study room button', !!(await h.$('#bo-talk [data-t="room"]')));
  await h.click('#bo-talk [data-t="room"]'); await h.waitForTimeout(200);
  check('it says what a study room is before opening one', /Up to three classmates can join this call/.test(await txt(h, '#bt-room')) && /type questions that Bo answers/.test(await txt(h, '#bt-room')));
  await h.click('#bt-room [data-room="open"]'); await h.waitForTimeout(700);
  const code = await h.evaluate(() => App.boTalk._room().code);
  check('Open a study room: a six-letter code, shown big, and a link to copy', /^[A-Z0-9]{6}$/.test(code) && (await txt(h, '.bt-room-code')).replace(/\s/g, '') === code && (await h.$eval('#bt-room-link', i => i.value)).endsWith(`#/room/${code}`), code);
  check('nobody has joined yet', /Nobody has joined yet/.test(await txt(h, '#bt-room')));
  check('the host cannot join their own room', (await api(h, 'room_join', { code })).status === 400);
  // the host writes before anyone joins
  await h.keyboard.press('Escape'); await h.waitForTimeout(150);
  await stroke(h, [[500, 400], [540, 380], [580, 420], [620, 400]]); await h.waitForTimeout(500);
  await E(h, { type: 'response.output_audio_transcript.done', item_id: 'rb0', transcript: 'Good afternoon. We begin with limits.' }); await h.waitForTimeout(400);

  // a classmate on another computer
  const [cg, g] = await mk(1360, 900, { serviceWorkers: 'block' }); await cg.addInitScript(quiet);
  await go(g, '#/', 500); await login(g, 'alice.a@montana.edu'); await g.reload(); await g.waitForTimeout(700);
  await go(g, '#/room', 900);
  check('#/room asks for the code', !!(await g.$('#rm-code')) && /Join a study room/.test(await txt(g, '.rm-box')));
  await g.fill('#rm-code', 'ZZZZZZ'); await g.click('#rm-join button[type="submit"]'); await g.waitForTimeout(900);
  check('a wrong code says so', /not open/.test(await txt(g, '.rm-err')), await txt(g, '.rm-box'));
  await go(g, `#/room/${code}`, 1500);
  const gin = await until(g, () => App._room());
  check('with the code: the board on the whole screen, who it is with, captions and a box to ask Bo', !!gin && /Study room with/.test(await txt(g, '#rm-h')) && !!(await g.$('.rm .wb')) && !!(await g.$('#rm-q')), await txt(g, '#rm-h'));
  const gotSnap = await until(g, () => App._room() && App._room().items >= 1);
  check('what the host wrote before is on the classmate’s board', !!gotSnap, await g.evaluate(() => App._room()));
  await g.waitForTimeout(2200);
  check('what Bo said just before shows once in their captions', (await g.evaluate(() => App._room().caps)).filter(c => /We begin with limits/.test(c)).length === 1, await g.evaluate(() => App._room().caps));
  const joined = await until(h, () => App.boTalk._room().people === 1);
  check('the host sees them join', !!joined && /1/.test(await txt(h, '#bt-room-n')));

  // the board both ways
  const n0 = await h.evaluate(() => App.boTalk._room().items);
  await stroke(g, [[700, 300], [740, 330], [780, 300]]); await g.waitForTimeout(300);
  check('what the classmate writes shows on the host’s board', !!(await until(h, n => App.boTalk._room().items > n, n0)));
  const m0 = await g.evaluate(() => App._room().items);
  await stroke(h, [[400, 600], [440, 640]]);
  check('and what the host writes shows on theirs', !!(await until(g, n => App._room().items > n, m0)));

  // Bo: his captions and his pages
  await E(h, { type: 'response.output_audio_transcript.done', item_id: 'rb1', transcript: 'Hmm. Show me your second line, slowly.' });
  check('Bo’s words show up as captions for the classmate', !!(await until(g, () => App._room().caps.some(c => /second line, slowly/.test(c)))), await g.evaluate(() => App._room().caps));
  await E(h, { type: 'response.function_call_arguments.done', name: 'write_on_board', call_id: 'rw1', arguments: JSON.stringify({ title: 'Solving 2x + 3 = 11', page: 'new', items: [{ kind: 'step', text: 'Take 3 from both sides: $2x = 8$' }, { kind: 'answer', text: '$x = 4$' }] }) });
  check('his pages go up on their board too', !!(await until(g, () => App._room().cards >= 1)) && /Solving 2x \+ 3 = 11/.test(await txt(g, '.rm-card')));

  // a classmate's question: Bo hears it, with their name
  const s0 = (await sent(h)).length;
  await g.fill('#rm-q', 'Why do we take the 3 away first?'); await g.press('#rm-q', 'Enter');
  const heard = await until(h, s0 => window.__rt.sent.slice(s0).some(x => x.type === 'conversation.item.create' && x.item.role === 'user' && /a classmate watching this call/.test(x.item.content[0].text) && /take the 3 away first/.test(x.item.content[0].text)), s0);
  check('a question typed in the room reaches Bo on the call, with who asked, and he answers', !!heard && (await sent(h)).slice(s0).some(x => x.type === 'response.create'));
  check('the classmate sees their question in the captions', (await g.evaluate(() => App._room().caps)).some(c => /You asked Bo: Why do we take/.test(c)));

  // phones: the same room
  const [cp, ph] = await mk(390, 844, { serviceWorkers: 'block' }); await cp.addInitScript(quiet);
  await go(ph, '#/', 500); await login(ph, 'bob.bmu6j92pq@montana.edu'); await ph.reload(); await ph.waitForTimeout(700);
  await go(ph, `#/room/${code}`, 1800); await until(ph, () => App._room());
  const lay = await ph.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { pad: r('.rm-pad').height, ask: r('.rm-ask').bottom <= innerHeight + 1, wide: document.documentElement.scrollWidth <= innerWidth + 1 }; });
  check('on a phone: the board takes the screen, the ask box stays on it, nothing scrolls sideways', lay.pad > 380 && lay.ask && lay.wide, lay);
  check('two classmates are in now', !!(await until(h, () => App.boTalk._room().people === 2)));
  await ph.click('[data-rm="leave"]'); await ph.waitForTimeout(500);
  check('Leave takes them out', !(await ph.$('.rm')) && !!(await until(h, () => App.boTalk._room().people === 1, null, 25000)));
  await cp.close();

  // the end of the call closes the room
  await h.click('.bt-end'); await h.waitForTimeout(500);
  check('when the call ends, the classmate is told and the room closes', !!(await until(g, () => !document.querySelector('.rm') && /The call has ended/.test(document.body.textContent), null, 8000)));
  check('and the room cannot be joined again', (await api(g, 'room_join', { code })).status === 404);
  check('someone who was never in it cannot read it', (await api(g, 'room_poll', { code: 'ABCDEF' })).status === 404);
  await cg.close(); await ch.close();
  sqlite("DELETE FROM ai_live WHERE user_id = (SELECT id FROM users WHERE email = 'mod.user@montana.edu')");
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
