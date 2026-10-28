/* An email to every member (api/news.php, admin Email everyone, #/unsubscribe, Settings → Account → News from StudyCat).
   Covered: only admins, the draft about Bo on every account (free monthly credits), the preview ({name}, {credits}, {minutes}, the button's link,
   the way out), a test to yourself, the send itself (confirmed, once per member, in batches, nobody twice, not to
   members who turned news off or are not verified), a mail server that refuses (it pauses and says why), stop,
   the unsubscribe link (a page with one button; mail apps' one-click POST without the site's header; a bad
   signature), the setting, and the admin page. Mail is in log mode here (api/data/mail.log). */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const LOG = path.join(__dirname, '..', 'api', 'data', 'mail.log');
const sqlite = q => require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'), q]);
const ask = q => { const r = require('child_process').spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); echo json_encode($d->query($argv[2])->fetchAll(PDO::FETCH_ASSOC));', path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'), q]); return JSON.parse(String(r.stdout) || '[]'); };
(async () => {
  const { mk, txt, login, api, go, base, log, check } = await T.start({}); const root = base.replace(/index\.html$/, '');
  const clean = () => sqlite("DELETE FROM news_sent; DELETE FROM news; UPDATE users SET news_email = 1 WHERE email IN ('bob.bmu6j92pq@montana.edu', 'alice.a@montana.edu'); DELETE FROM rate WHERE key LIKE 'news_%'");
  const [c, a] = await mk(1360, 900, { serviceWorkers: 'block' });
  await go(a, '#/', 600); await login(a, 'admin.user@montana.edu'); await a.reload(); await a.waitForTimeout(800);
  await api(a, 'admin_news'); clean();   // the tables exist after the first call

  // only administrators
  const [cm, m] = await mk(1360, 900); await go(m, '#/', 500); await login(m, 'mod.user@montana.edu');
  check('a moderator cannot send news', (await api(m, 'admin_news')).status === 403 && (await api(m, 'admin_news_send', { subject: 'x', body: 'y', confirm: 'send' })).status === 403);
  await cm.close();

  let r = (await api(a, 'admin_news')).json; const d = r.draft; log('draft:', JSON.stringify({ subject: d.subject, recipients: r.recipients, minutes: r.minutes, mail: r.mail }));
  check('the draft is the email about Bo on every account and the free monthly credits, with a button to the demo', /\{credits\}/.test(d.subject) && /Bo is on every account/.test(d.subject) && /\{name\}/.test(d.body) && /\{minutes\} minutes on a call/.test(d.body) && d.button === 'Call Bo' && d.link === '#/max', d);
  const who = ask("SELECT COUNT(*) AS n FROM users WHERE verified = 1 AND news_email = 1 AND email NOT LIKE '%@system.local'")[0].n;
  check('it goes to every verified member with news on', r.recipients === +who && r.recipients > 2, { api: r.recipients, db: who });
  r = (await api(a, 'admin_news_preview', d)).json;
  check('the preview fills in the credits, the minutes and the name', r.subject === `Bo is on every account now: ${(await api(a, 'admin_news')).json.credits} free credits a month` && /about \d+ minutes on a call/.test(r.text) && /Hi [A-Z][a-z]+,/.test(r.text) && !/\{name\}|\{minutes\}|\{credits\}/.test(r.html + r.text), r.subject);
  check('its button opens the demo on the site, and the bottom has a way out', /href="https?:\/\/[^"]+\/#\/max"/.test(r.html) && /#\/unsubscribe\?u=\d+&amp;t=[0-9a-f]{32}/.test(r.html) && /Stop these emails: https?:\/\/\S+#\/unsubscribe\?u=\d+&t=[0-9a-f]{32}/.test(r.text), r.text.slice(-200));
  check('a link that is not on StudyCat or https is refused', (await api(a, 'admin_news_preview', Object.assign({}, d, { link: 'javascript:alert(1)' }))).status === 400);
  const before = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').length : 0;
  r = await api(a, 'admin_news_test', d);
  const tail = () => fs.readFileSync(LOG, 'utf8').slice(before);
  check('Send me a test goes to the admin only', r.status === 200 && /to=admin\.user@montana\.edu subject="Bo is on every account/.test(tail()) && (tail().match(/^\[.*\] to=/gm) || []).length === 1, r.json);

  // the send
  sqlite("UPDATE users SET news_email = 0 WHERE email = 'alice.a@montana.edu'");
  check('it needs a confirmation', (await api(a, 'admin_news_send', d)).status === 400);
  const mark = fs.readFileSync(LOG, 'utf8').length;
  r = await api(a, 'admin_news_send', Object.assign({}, d, { confirm: 'send' }));
  const total = r.json.news && r.json.news.total;
  check('sending starts with the first batch', r.status === 200 && total === who - 1 && r.json.news.sent >= 1 && r.json.news.sent <= 10, r.json.news);
  check('a second send waits for this one', (await api(a, 'admin_news_send', Object.assign({}, d, { confirm: 'send' }))).status === 409);
  for (let i = 0; i < 30; i++) { r = await api(a, 'admin_news_step', { n: 25 }); if (r.json.news.done) break; }
  r = (await api(a, 'admin_news_step', { n: 25 })).json.news; log('sent:', JSON.stringify(r));
  const sentTo = (fs.readFileSync(LOG, 'utf8').slice(mark).match(/^\[[^\]]+\] to=(\S+) subject="Bo is on every account/gm) || []).map(x => x.split('to=')[1].split(' ')[0]);
  check('every member got it once, and it is done', r.done && r.sent === total && r.failed === 0 && sentTo.length === total && new Set(sentTo).size === total, { r, n: sentTo.length });
  check('not members who turned news off', !sentTo.includes('alice.a@montana.edu'));
  check('each one is written to news_sent', ask('SELECT COUNT(*) AS n FROM news_sent WHERE ok = 1')[0].n === total);

  // pause, resume and stop
  sqlite("DELETE FROM news_sent; UPDATE news SET done = 1");
  await api(a, 'admin_news_send', Object.assign({}, d, { confirm: 'send' }));
  r = (await api(a, 'admin_news_pause', { paused: 1 })).json.news; const held = r.sent;
  await api(a, 'admin_news_step', { n: 10 }); r = (await api(a, 'admin_news')).json.news;
  check('Pause holds it where it is', r.paused && !r.done && r.sent === held, r);
  r = (await api(a, 'admin_news_pause', { paused: 0 })).json.news; await api(a, 'admin_news_step', { n: 5 }); r = (await api(a, 'admin_news')).json.news;
  check('Resume carries on', !r.paused && r.sent > held, r);
  r = (await api(a, 'admin_news_pause', { stop: 1 })).json.news;
  check('Stop for good ends it', r.done, r);

  // the way out
  const bob = ask("SELECT id FROM users WHERE email = 'bob.bmu6j92pq@montana.edu'")[0].id;
  const tok = (fs.readFileSync(LOG, 'utf8').match(new RegExp(`#/unsubscribe\\?u=${bob}&t=([0-9a-f]{32})`)) || [])[1];
  check('the email to Bob has his own link', !!tok, tok);
  r = await (await fetch(`${root}api/index.php?r=news_unsub&u=${bob}&t=${tok}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' })).json();
  check('a mail app\'s one-click unsubscribe works without the site\'s header', r.ok && r.on === false && ask(`SELECT news_email FROM users WHERE id = ${bob}`)[0].news_email === 0, r);
  r = await (await fetch(`${root}api/index.php?r=news_unsub&u=${bob}&t=${'0'.repeat(32)}`, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).json();
  check('a wrong signature changes nothing', r.ok === false);
  sqlite(`UPDATE users SET news_email = 1 WHERE id = ${bob}`);
  const [cu, u] = await mk(390, 844, { serviceWorkers: 'block' });
  await go(u, `#/unsubscribe?u=${bob}&t=${tok}`, 1400);
  check('the link in the email opens a page with one question and one button (opening it changes nothing)', /Stop news emails\?/.test(await txt(u, '#uns-h')) && /bo…@montana\.edu/.test(await txt(u, '.uns')) && ask(`SELECT news_email FROM users WHERE id = ${bob}`)[0].news_email === 1);
  await u.click('[data-uns="0"]'); await u.waitForTimeout(700);
  check('Stop news emails turns them off', /No more news emails/.test(await txt(u, '#uns-h')) && ask(`SELECT news_email FROM users WHERE id = ${bob}`)[0].news_email === 0);
  await u.click('[data-uns="1"]'); await u.waitForTimeout(700);
  check('and Turn them back on undoes it', /Stop news emails\?/.test(await txt(u, '#uns-h')) && ask(`SELECT news_email FROM users WHERE id = ${bob}`)[0].news_email === 1);
  await go(u, `#/unsubscribe?u=${bob}&t=nope`, 1000); check('a broken link says so and points to Settings', /does not work/.test(await txt(u, '#uns-h')) && !!(await u.$('.uns a[href="#/settings"]')));
  await cu.close();
  // the setting
  await go(a, '#/settings', 1200);
  const box = await a.$('#acct-news'); check('Settings has News from StudyCat, on', !!box && await box.isChecked());
  await box.uncheck(); await a.waitForTimeout(700); check('turning it off is saved', ask("SELECT news_email FROM users WHERE email = 'admin.user@montana.edu'")[0].news_email === 0);
  await box.check(); await a.waitForTimeout(700);

  // the admin page
  clean();
  await go(a, '#/admin/email', 1800);
  const page = await a.evaluate(() => ({ subj: document.querySelector('#nw-subject').value, go: document.querySelector('#nw-go').textContent.trim(), frame: ((document.querySelector('#nw-frame').shadowRoot || {}).innerHTML || '').length, shown: document.querySelector('#nw-subj').textContent }));
  check('the admin page: the draft, what they get beside it, and Send to N members', /\{credits\}/.test(page.subj) && /^Send to \d+ members$/.test(page.go) && page.frame > 500 && /^Bo is on every account now: \d+ free credits a month$/.test(page.shown), page);
  await a.fill('#nw-subject', 'Hello {name}'); await a.waitForTimeout(1200);
  check('the preview follows what you type', /^Hello [A-Z]/.test(await txt(a, '#nw-subj')), await txt(a, '#nw-subj'));
  await c.close(); clean();
  await T.finish();
})().catch(e => { console.error(e); process.exit(1); });
