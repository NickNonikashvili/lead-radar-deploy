/* Sign-in and sign-up that help you get it right (assets/auth.js, paintModal and submit):
   - the message under the form is announced (role=status, aria-live), and the field it is about is marked
     (aria-invalid, described by the message) and gets focus; typing in it clears the mark
   - what can be checked before the server is: an empty or malformed email, a password under 8 characters, a code
     that is not 6 digits (a pasted "123 456" counts as 6)
   - a near miss of montana.edu is suggested ("Did you mean …?"), one tap fixes it; other addresses are left alone
   - the password has a Show button (aria-pressed), and Caps Lock is pointed out
   - while the server answers, the button says what is happening and the form is aria-busy */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const AXE = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
(async () => {
  const { mk, go, txt, check, log } = await T.start({});
  const [c, p] = await mk(390, 844, { hasTouch: true, serviceWorkers: 'block', bypassCSP: true });
  await c.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('studyhub-settings') || '{}'); s.motion = 'off'; localStorage.setItem('studyhub-settings', JSON.stringify(s)); } catch (e) {} });   // no entrance animations: axe measures colours mid-fade otherwise
  await go(p, '#/', 1500);
  const state = () => p.evaluate(() => { const a = document.activeElement; const m = document.querySelector('#auth-msg'); return { msg: m.textContent, live: m.getAttribute('aria-live'), role: m.getAttribute('role'), focus: a && a.id, bad: [...document.querySelectorAll('#auth-form [aria-invalid="true"]')].map(x => x.id), desc: a && a.getAttribute('aria-describedby') }; });

  // sign up: nothing typed
  await p.evaluate(() => App.auth.open('signup')); await p.waitForTimeout(300);
  await p.click('#auth-form button[type="submit"]'); await p.waitForTimeout(200);
  let s = await state();
  check('an empty email is named, announced, marked and focused', /Enter your email address/.test(s.msg) && s.live === 'polite' && s.role === 'status' && s.focus === 'au-email' && s.bad.join() === 'au-email' && s.desc === 'auth-msg', s);
  await p.fill('#au-email', 'bob'); await p.click('#auth-form button[type="submit"]'); await p.waitForTimeout(200);
  s = await state(); check('an address without @ and a domain says what it needs', /needs an @ and a domain/.test(s.msg) && s.focus === 'au-email', s.msg);
  await p.type('#au-email', 'x'); s = await state();
  check('typing in the marked field clears the mark and the message', s.bad.length === 0 && s.msg === '', s);

  // a near miss of montana.edu
  await p.fill('#au-email', 'bob.smith@montanna.edu'); await p.click('#au-pass'); await p.waitForTimeout(150);
  const h = await p.evaluate(() => { const x = document.querySelector('#au-email-hint'); return { shown: !x.hidden, text: x.textContent }; });
  check('a mistyped montana.edu is suggested when the field is left', h.shown && h.text === 'Did you mean bob.smith@montana.edu?', h);
  await p.click('[data-action="au-fix"]'); await p.waitForTimeout(100);
  check('one tap fixes it', (await p.inputValue('#au-email')) === 'bob.smith@montana.edu' && await p.evaluate(() => document.querySelector('#au-email-hint').hidden));
  const typo = await p.evaluate(() => ['a@montana.edu', 'a@cs.montana.edu', 'a@gmail.com', 'a@montana.ed', 'a@montana.edu.com', 'a@montana', 'a@motnana.edu'].map(x => App.auth.emailTypo(x)));
  check('only near misses are suggested: a real montana.edu address, a department one or another provider is left alone', typo.join('|') === ['', '', '', 'a@montana.edu', 'a@montana.edu', 'a@montana.edu', 'a@montana.edu'].join('|'), typo);

  // the password
  await p.fill('#au-pass', 'short'); await p.click('#auth-form button[type="submit"]'); await p.waitForTimeout(200);
  s = await state(); check('a password under 8 characters is named and focused', /at least 8 characters/.test(s.msg) && s.focus === 'au-pass' && s.bad.join() === 'au-pass', s);
  // axe over the dialog as it is now: an error on the password, a suggestion under the email
  await p.addScriptTag({ content: AXE });
  const ax = await p.evaluate(async () => (await axe.run('#auth-modal', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(', ')));
  check('axe finds nothing serious in the dialog with an error and a suggestion showing', ax.length === 0, ax);
  await p.click('[data-action="pw-eye"]');
  const eye = await p.evaluate(() => { const b = document.querySelector('[data-action="pw-eye"]'); return { type: document.querySelector('#au-pass').type, pressed: b.getAttribute('aria-pressed'), text: b.textContent, name: b.getAttribute('aria-label'), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }; });
  check('Show reveals the password (pressed, now Hide), and is big enough to tap', eye.type === 'text' && eye.pressed === 'true' && eye.text === 'Hide' && eye.name === 'Hide password' && eye.w >= 24 && eye.h >= 24, eye);
  await p.click('[data-action="pw-eye"]');
  check('and Hide hides it again', (await p.evaluate(() => document.querySelector('#au-pass').type)) === 'password');
  // headless Chromium does not toggle Caps Lock on a key press: send the key event with it on, then off
  const key = on => p.evaluate(on => document.querySelector('#au-pass').dispatchEvent(new KeyboardEvent('keydown', { key: 'A', modifierCapsLock: on, bubbles: true })), on);
  await key(true); const caps = await p.evaluate(() => !document.querySelector('#au-caps').hidden); await key(false);
  check('Caps Lock is pointed out, and the note goes when it is off', caps && await p.evaluate(() => document.querySelector('#au-caps').hidden), caps);

  // log in: the server's answer, with the button saying what is happening meanwhile
  await p.evaluate(() => App.auth.open('login')); await p.waitForTimeout(300);
  await p.route(/r=login\b/, async r => { await new Promise(x => setTimeout(x, 900)); await r.continue(); });
  await p.fill('#au-email', 'bob.bmu6j92pq@montana.edu'); await p.fill('#au-pass', 'not-the-password-9');
  await p.click('#auth-form button[type="submit"]'); await p.waitForTimeout(300);
  const wait = await p.evaluate(() => ({ text: document.querySelector('#auth-form button[type="submit"]').textContent, busy: document.querySelector('#auth-form').getAttribute('aria-busy') }));
  check('while the server answers, the button says Logging in… and the form is busy', wait.text === 'Logging in…' && wait.busy === 'true', wait);
  await p.waitForTimeout(1400); s = await state(); log('server says:', s.msg);
  check('a wrong password: the server’s message, on the password field, and the button is back', s.msg.length > 0 && s.focus === 'au-pass' && s.bad.join() === 'au-pass' && (await txt(p, '#auth-form button[type="submit"]')) === 'Log in', s);
  await p.unroute(/r=login\b/);

  // the code: 6 digits, spaces and dashes ignored
  await p.evaluate(() => App.auth.open('verify', 'nobody.here@montana.edu')); await p.waitForTimeout(300);
  await p.fill('#au-code', '12'); await p.click('#auth-form button[type="submit"]'); await p.waitForTimeout(200);
  s = await state(); check('a short code is named and focused', /6-digit code/.test(s.msg) && s.focus === 'au-code', s);
  let sent = null; await p.route(/r=verify\b/, async r => { sent = JSON.parse(r.request().postData() || '{}'); await r.continue(); });
  await p.fill('#au-code', '123 456'); await p.click('#auth-form button[type="submit"]'); await p.waitForTimeout(900);
  check('a pasted "123 456" is sent as 123456', sent && sent.code === '123456', sent);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  check('Escape closes the dialog', !(await p.$('#auth-modal')));
  await c.close();
  await T.finish();
})();
