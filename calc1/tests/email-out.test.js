/* A way out of every email (MH_UNSUB and mh_unsub in api/lib.php, news_unsub in api/news.php, #/unsubscribe):
   - each kind (news, exam reminders, call recaps, the digest, the Sunday plan, evening reminders, reply emails) has its
     own signed link and List-Unsubscribe headers; a link for one kind does not switch off another
   - the page names the kind and changes nothing until its button is pressed (mail scanners open links)
   - a mail app's one-click POST works without signing in
   - the usage report counts real changes (email_off_<kind>), not visits to the page
   - the exam, recap, digest, plan, reminder and reply emails carry the link (checked in their code) */
const T = require('./lib'); const fs = require('fs'); const path = require('path');
const API = path.join(__dirname, '..', 'api'); const DB = path.join(API, 'data', 'mathub.sqlite');
const sh = (code, ...a) => require('child_process').spawnSync('php', ['-r', code, ...a]);
const ask = q => JSON.parse(String(sh('$d = new PDO("sqlite:" . $argv[1]); echo json_encode($d->query($argv[2])->fetchAll(PDO::FETCH_ASSOC));', DB, q).stdout) || '[]');
const run = q => sh('$d = new PDO("sqlite:" . $argv[1]); $d->exec($argv[2]);', DB, q);
const BOB = 'bob.bmu6j92pq@montana.edu';
(async () => {
  const { mk, go, txt, login, base, check } = await T.start({}); const root = base.replace(/index\.html$/, '');
  const [c0, p0] = await mk(1200, 800, { serviceWorkers: 'block' }); await go(p0, '#/', 500); await login(p0, BOB); await c0.close();
  const bob = ask(`SELECT id FROM users WHERE email = '${BOB}'`)[0].id;
  const KINDS = { news: 'news_email', exam: 'exam_nudge', recap: 'recap_email', digest: 'digest_email', planning: 'planning_email', reminder: 'reminder_email', replies: 'notify_email' };
  const links = JSON.parse(String(sh('chdir($argv[1]); require "lib.php"; $o = []; foreach (array_keys(MH_UNSUB) as $k) { [$url, $h] = mh_unsub(["id" => (int)$argv[2]], $k); $o[$k] = ["url" => $url, "h" => $h]; } echo json_encode($o);', API, String(bob)).stdout) || '{}');
  check('every kind of email has its own link and one-click headers', Object.keys(KINDS).every(k => links[k] && new RegExp(`#/unsubscribe\\?k=${k}&u=${bob}&t=[0-9a-f]{32}$`).test(links[k].url) && /^<https?:\/\/\S+api\/index\.php\?r=news_unsub&k=/.test(links[k].h['List-Unsubscribe']) && links[k].h['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click'), Object.keys(links));
  const tok = k => new URL(links[k].url.replace('#/unsubscribe?', 'x?')).searchParams.get('t');
  check('the tokens differ by kind', new Set(Object.keys(KINDS).map(tok)).size === Object.keys(KINDS).length);
  const all = Object.values(KINDS).map(c => `${c} = 1`).join(', '); run(`UPDATE users SET ${all} WHERE id = ${bob}`);
  const metric = k => (ask(`SELECT COALESCE(SUM(n), 0) AS n FROM metrics WHERE key = '${k}'`)[0] || {}).n || 0;

  // a mail app's one-click unsubscribe, for a call recap
  const off0 = metric('email_off_recap');
  let r = await (await fetch(`${root}api/index.php?r=news_unsub&k=recap&u=${bob}&t=${tok('recap')}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' })).json();
  const row = () => ask(`SELECT ${Object.values(KINDS).join(', ')} FROM users WHERE id = ${bob}`)[0];
  check('one click from a mail app stops call recaps, and only those', r.ok && r.on === false && row().recap_email === 0 && row().exam_nudge === 1 && row().news_email === 1, r);
  check('and the usage report counts it', metric('email_off_recap') === off0 + 1);
  r = await (await fetch(`${root}api/index.php?r=news_unsub&k=exam&u=${bob}&t=${tok('recap')}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' })).json();
  check('a recap link cannot switch off exam reminders', r.ok === false && row().exam_nudge === 1);

  // the page, for exam reminders
  const [c, p] = await mk(390, 844, { serviceWorkers: 'block' }); const off1 = metric('email_off_exam');
  await go(p, `#/unsubscribe?k=exam&u=${bob}&t=${tok('exam')}`, 1400);
  check('the page asks about exam reminders, and opening it changes nothing', /Stop exam reminders\?/.test(await txt(p, '#uns-h')) && /3 days before each exam/.test(await txt(p, '.uns')) && row().exam_nudge === 1 && metric('email_off_exam') === off1);
  await p.click('[data-uns="0"]'); await p.waitForTimeout(700);
  check('its button stops them', /will not get these/.test(await txt(p, '#uns-h')) && row().exam_nudge === 0 && metric('email_off_exam') === off1 + 1);
  await p.click('[data-uns="1"]'); await p.waitForTimeout(700);
  check('and Turn them back on undoes it', /Stop exam reminders\?/.test(await txt(p, '#uns-h')) && row().exam_nudge === 1 && metric('email_on_exam') >= 1);
  await go(p, `#/unsubscribe?k=digest&u=${bob}&t=${tok('digest')}`, 1200);
  check('the digest’s page names the digest', /Stop the weekly digest\?/.test(await txt(p, '#uns-h')));
  await c.close();

  // every email that is not a sign-in code carries the link
  const src = f => fs.readFileSync(path.join(API, f), 'utf8');
  const uses = { exam: src('growth.php'), planning: src('growth.php'), recap: src('ai.php'), digest: src('social.php'), reminder: src('social.php'), replies: src('forum.php'), news: src('news.php') };
  check('the exam, plan, recap, digest, reminder, reply and news emails use it', Object.entries(uses).every(([k, s]) => s.includes(`mh_unsub($u, '${k}')`) || s.includes(`mh_unsub($to, '${k}')`)), Object.entries(uses).filter(([k, s]) => !s.includes(`'${k}')`)).map(x => x[0]));
  check('and no email still says only "Turn it off in Settings"', !/Turn (it|them|these (emails|reminders)) off in Settings/.test(Object.values(uses).join('\n')));
  run(`UPDATE users SET ${all} WHERE id = ${bob}`);
  await T.finish();
})();
