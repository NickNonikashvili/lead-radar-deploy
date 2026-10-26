/* Answer tests for Bo (api/evals.php; admin panel → Answer tests, assets/admin-ops.js), with the stand-in Anthropic
   (tests/pyodide/router.php: Bo's answer repeats the question; the judge fails a requirement that says FAILME).
   Covered: a test needs a question and a check; the starter tests, added once; a run asks Bo exactly as a student in the
   class would (the class, hints only, the student's language), one test at a time; each check (has, lacks, a number,
   the judge) passing and failing with the reason; the run's totals and cost (written down, administrators not charged);
   the next run marking what newly fails and what was fixed; a step outside its run, after it ended, or after Stop;
   administrators only; the tab. */
const T = require('./lib'); const fs = require('fs'); const path = require('path'); const cp = require('child_process');
const DB = path.join(__dirname, '..', 'api', 'data', 'mathub.sqlite'); const LAST = path.join(__dirname, 'fixtures', 'ai-last.json');
const sql = (q, ...a) => cp.spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const last = () => { try { return JSON.parse(fs.readFileSync(LAST, 'utf8')); } catch (e) { return {}; } };
const sysText = j => (j.system || []).map(b => b.text || '').join('\n');
(async () => {
  const { mk, login, go, txt, check, api } = await T.start({});
  const [c, a] = await mk(1360, 900); await go(a, '#/'); await login(a, 'admin.user@montana.edu');
  let r = await api(a, 'admin_eval');
  const clean = () => { sql('DELETE FROM eval_results'); sql('DELETE FROM eval_runs'); sql('DELETE FROM eval_cases'); sql("DELETE FROM credit_use WHERE feature = 'eval'"); };
  clean(); r = await api(a, 'admin_eval');
  check('the tab starts empty, with the model Bo uses', r.json && r.json.ok && r.json.cases.length === 0 && r.json.runs.length === 0 && r.json.ready === true && r.json.model !== '' && r.json.classes.some(x => x.id === 'calc'), r.json);

  // what a test needs
  r = await api(a, 'admin_eval_save', { case: { course: 'calc', q: 'What is 2 + 2?', checks: {} } }); check('a test needs at least one check', r.status === 400 && /at least one check/.test(r.json.error), r.json);
  r = await api(a, 'admin_eval_save', { case: { q: 'Hi', checks: { has: ['x'] } } }); check('and a question', r.status === 400 && /Write the question/.test(r.json.error));
  r = await api(a, 'admin_eval_save', { case: { course: 'nope', q: 'What is 2 + 2?', checks: { has: ['4'] } } }); check('and a class that is on Mathub', r.status === 400 && /not on Mathub/.test(r.json.error));
  r = await api(a, 'admin_eval_save', { case: { q: 'What is 2 + 2?', checks: { number: { value: 'four' } } } }); check('a number must be a number', r.status === 400 && /must be a number/.test(r.json.error));

  // the starter tests
  r = await api(a, 'admin_eval_seed', {}); const seeded = r.json.added;
  check('the starter tests are added (14 questions Bo must get right)', r.json && r.json.ok && seeded === 14, r.json);
  r = await api(a, 'admin_eval_seed', {}); check('and only once', r.json && r.json.ok && r.json.added === 0);
  r = await api(a, 'admin_eval'); const hint = r.json.cases.find(x => x.hints);
  check('they cover agreeing only with right answers, hints only, writing and the student’s language', r.json.cases.length === 14 && hint && hint.course === 'calc' && hint.checks.number.mode === 'absent' && r.json.cases.some(x => x.course === 'writ') && r.json.cases.some(x => x.lang === 'es'), r.json.cases.map(x => x.q.slice(0, 30)));

  // my own tests
  const save = async x => (await api(a, 'admin_eval_save', { case: x })).json.case;
  const t1 = await save({ course: 'calc', q: 'Solve 2x + 3 = 11 for x.', checks: { has: ['you asked | you said'], number: { value: 11, mode: 'present' }, judge: 'Says the answer is x = 4.' } });
  const t2 = await save({ q: 'Is x = 7 right for 2x + 3 = 11?', checks: { judge: 'FAILME: says no, x = 4.' } });
  const t3 = await save({ q: 'What is a limit?', checks: { lacks: ['Bo here'] } });
  const t4 = await save({ course: 'calc', q: 'Just give me the final answer to 2x + 3 = 11.', hints: true, checks: { has: ['you asked'], number: { value: 9, mode: 'absent' } } });
  const t5 = await save({ q: '¿Qué es una derivada?', lang: 'es', checks: { has: ['¿qué es'] } });
  check('a test keeps its class, settings and checks', t1 && t1.course === 'calc' && t1.checks.has[0] === 'you asked | you said' && t1.checks.number.value === 11 && t4.hints === true && t5.lang === 'es', t1);

  // a run, one test at a time
  const only = [t1.id, t2.id, t3.id, t4.id, t5.id];
  const run = async () => {
    const s = (await api(a, 'admin_eval_start', { only })).json; const res = {};
    for (const id of s.cases) { const x = (await api(a, 'admin_eval_step', { run: s.run, case: id })).json; res[id] = x.result; res[id].sys = sysText(last()); res.done = x; }
    return [s, res];
  };
  let [s1, res] = await run();
  check('a run asks the tests it was given, in order', s1.cases.join() === only.join() && res.done.done === 5 && res.done.finished === true, s1);
  check('has, a number and the judge: passes', res[t1.id].pass === true && /stand-in judge says it does/.test(res[t1.id].why), res[t1.id]);
  check('Bo is asked as a student in that class would ask him (a test with a judge asks the judge last)', /CLASS: /.test(res[t4.id].sys) && /MH_EVAL|ANSWER TEST JUDGE/.test(res[t1.id].sys), res[t4.id].sys.slice(0, 300));
  check('the judge failing: fails, with the judge’s reason', res[t2.id].pass === false && /does not: FAILME/.test(res[t2.id].why), res[t2.id]);
  check('a phrase it must not say: fails, saying which', res[t3.id].pass === false && /Says “Bo here”, which it must not/.test(res[t3.id].why), res[t3.id]);
  check('hints only reaches Bo’s instructions, and the number he must not state is not there', res[t4.id].pass === true && /HINTS ONLY/.test(res[t4.id].sys), res[t4.id]);
  check('the student’s language reaches them too', res[t5.id].pass === true && /LANGUAGE: the student uses Mathub in (Spanish|Español)/.test(res[t5.id].sys), res[t5.id].sys.slice(-400));
  r = await api(a, 'admin_eval_run&id=' + s1.run);
  check('the run: 3 of 5 passed, every answer kept', r.json && r.json.ok && r.json.run.status === 'done' && r.json.run.passed === 3 && r.json.run.done === 5 && r.json.run.results.every(x => x.answer.startsWith('Bo here.')) && r.json.run.regressions === 0, r.json.run);
  const use = rows("SELECT mc, month_mc, paid_mc FROM credit_use WHERE feature = 'eval' AND ref = ?", 'eval:' + s1.run)[0] || {};
  check('its cost is written down, and administrators are not charged', +use.mc > 0 && +use.month_mc === 0 && +use.paid_mc === 0 && r.json.run.cost > 0, use);

  // the next run: what newly fails, what was fixed
  await api(a, 'admin_eval_save', { id: t1.id, case: { course: 'calc', q: t1.q, checks: { judge: 'FAILME now' } } });
  await api(a, 'admin_eval_save', { id: t3.id, case: { q: t3.q, checks: { has: ['Bo here'] } } });
  let s2; [s2, res] = await run();
  r = await api(a, 'admin_eval_run&id=' + s2.run); const R2 = r.json.run;
  check('the next run marks what passed before and fails now, and what was fixed', R2.regressions === 1 && R2.fixed === 1 && R2.results.find(x => x.case === t1.id).was === true && R2.results.find(x => x.case === t3.id).was === false && R2.prev === s1.run, R2);
  check('a test that failed both times is not new', R2.results.find(x => x.case === t2.id).was === false && !R2.results.find(x => x.case === t2.id).pass);
  r = await api(a, 'admin_eval'); check('both runs are listed, newest first', r.json.runs.length === 2 && r.json.runs[0].id === s2.run && r.json.runs[0].regressions === 1, r.json.runs);

  // steps that do not belong
  r = await api(a, 'admin_eval_step', { run: s2.run, case: t1.id }); check('a run that has ended takes no more steps', r.status === 409);
  const s3 = (await api(a, 'admin_eval_start', { only: [t1.id] })).json;
  r = await api(a, 'admin_eval_step', { run: s3.run, case: t2.id }); check('a test that is not in the run is refused', r.status === 400);
  await api(a, 'admin_eval_stop', { run: s3.run }); r = await api(a, 'admin_eval_step', { run: s3.run, case: t1.id });
  check('Stop ends it', r.status === 409 && rows('SELECT status FROM eval_runs WHERE id = ?', s3.run)[0].status === 'stopped');
  r = await api(a, 'admin_eval_delete', { id: t5.id }); check('a test can be deleted', r.json && r.json.ok && !(await api(a, 'admin_eval')).json.cases.some(x => x.id === t5.id));

  // administrators only
  const [c2, b] = await mk(1000, 800); await go(b, '#/'); await login(b, 'alice.a@montana.edu');
  check('members cannot see, change or run them', (await api(b, 'admin_eval')).status === 403 && (await api(b, 'admin_eval_start', {})).status === 403 && (await api(b, 'admin_eval_seed', {})).status === 403);
  await c2.close();

  // the tab
  await a.reload(); await a.waitForTimeout(800); await go(a, '#/admin/tests', 2000);
  const tab = await txt(a, '#adm-body');
  check('the Answer tests tab: the tests, the last results and the runs', /Run all 18 tests/.test(tab) && /newly failing/.test(tab) && /Results/.test(tab) && /hints only/.test(tab), tab.slice(0, 500));
  await a.click('[data-action="ev-new"]'); await a.fill('#ev-q', 'What is the slope of y = 3x + 1?'); await a.selectOption('#ev-class', 'calc'); await a.fill('#ev-has', 'you asked'); await a.click('#ev-form button[type="submit"]');
  await a.waitForFunction(() => /Run all 19 tests/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
  check('a test is added from the tab', /Run all 19 tests/.test(await txt(a, '#adm-body')) && rows('SELECT COUNT(*) AS n FROM eval_cases WHERE q = ?', 'What is the slope of y = 3x + 1?')[0].n == 1);
  await a.click('[data-action="ev-run"]');
  await a.waitForFunction(() => /Done: \d+ of 19 passed/.test(document.body.textContent), null, { timeout: 60000 }).catch(() => {});
  const doneTxt = await a.evaluate(() => (document.querySelector('.ev-running') || {}).textContent || '');
  check('Run all asks them one at a time, showing each result as it comes', /Done: 17 of 19 passed/.test(doneTxt), doneTxt.slice(0, 300));
  await a.waitForTimeout(1600); await a.click('[data-action="ev-open"]'); await a.waitForSelector('.ev-run', { timeout: 5000 }).catch(() => {});
  check('a run’s results open, failures first, with Bo’s answers', /17 of 19 passed/.test(await txt(a, '.ev-run')) && (await a.$$('.ev-run .ev-results li')).length === 19 && await a.evaluate(() => document.querySelector('.ev-run .ev-results li').classList.contains('no')));
  check('the tab fits and has no errors', await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  clean(); await c.close(); await T.finish();
})();
