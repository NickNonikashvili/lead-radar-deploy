/* The math check, alone (assets/mathcheck.js in the browser, api/mathcheck.php on the server): the same cases
   through both (tests/fixtures/mathcheck-cases.json: plain and spoken arithmetic, a letter given two values, an
   answer that does not solve the problem, a bare answer to a question, calculus said in words, and everyday talk
   that must be left alone); then the pages Bo writes, his check_math tool, and the note the server gives Bo. */
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const M = require('../assets/mathcheck.js');
let n = 0, bad = 0; const check = (label, cond, extra) => { n++; if (!cond) bad++; console.log(`  ${cond ? '✓' : '✗'} ${label}${cond ? '' : ' ' + JSON.stringify(extra === undefined ? null : extra).slice(0, 400)}`); };
const CASES = path.join(__dirname, 'fixtures', 'mathcheck-cases.json'); const cases = JSON.parse(fs.readFileSync(CASES, 'utf8'));
const PHP = path.join(__dirname, '..', 'api', 'mathcheck.php');
const php = (code, ...args) => JSON.parse(execFileSync('php', ['-r', `require $argv[1]; ${code}`, PHP, ...args]).toString());
const P = php('$c = json_decode(file_get_contents($argv[2]), true); $o = []; foreach ($c as $x) { $r = mh_mc_claims($x["say"], ["eqs" => $x["eqs"] ?? [], "ask" => $x["ask"] ?? ""]); $o[] = ["w" => array_column($r["wrong"], "msg"), "r" => array_column($r["right"], "msg")]; } echo json_encode($o);', CASES);
for (const [i, c] of cases.entries()) {
  const j = M.claims(c.say, { eqs: c.eqs || [], ask: c.ask || '' }); const jw = j.wrong.length > 0, pw = P[i].w.length > 0;
  const want = c.wrong ? 'wrong' : c.right ? 'right' : 'left alone';
  check(`"${c.say}"${c.ask ? ` (after "${c.ask}?")` : ''}${c.eqs ? ` (working on ${c.eqs.join(', ')})` : ''}: ${want}, in the browser and on the server`, jw === c.wrong && pw === c.wrong && (c.right === undefined || ((j.right.length > 0) === c.right && (P[i].r.length > 0) === c.right)) && (!c.wrong || j.wrong[0].msg === P[i].w[0] || j.wrong[0].kind === 'derivative'), { js: j.wrong.map(w => w.msg), php: P[i].w });
}
// the user's own case, word for word
check('"x=11-3 so x=6" (as typed): the message says 11 − 3 is 8, not 6', /^x = 11 ?− ?3 is 8, not 6$/.test(M.claims('x=11-3 so x=6').wrong[0].msg), M.claims('x=11-3 so x=6').wrong);

// pages Bo writes
const b1 = M.board(['Take 3 from both sides: $2x = 14$', 'Halve both sides: $x = 7$'], 'Solving 2x + 3 = 11');
check('a page: a step that does not follow from the problem in its title is caught, with the line', b1[0] && b1[0].line === 1 && /2x = 14 does not follow from 2x \+ 3 = 11/.test(b1[0].msg), b1);
check('a page that is right passes', M.board(['Take 3 from both sides: $2x = 8$', 'Halve both sides: $x = 4$', 'answer: $x = 4$'], 'Solving 2x + 3 = 11').length === 0);
check('factoring keeps the solutions, and "x = 2 or x = 3" both solve it', M.board(['$x^2 - 5x + 6 = 0$', '$(x - 2)(x - 3) = 0$', '$x = 2$ or $x = 3$']).length === 0);
check('a false sum on a page is caught', (M.board(['Check: $2(4) + 3 = 12$'])[0] || {}).msg === '2(4) + 3 is 11, not 12', M.board(['Check: $2(4) + 3 = 12$']));
check('notation it cannot follow is left alone: f(x) =, f\'(x), d/dx, integrals, limits, inequalities', M.board(['$f(x) = x^2$', "$f'(x) = 2x$", '$\\frac{d}{dx} x^3 = 3x^2$', '$\\int_0^2 x\\,dx = 2$', '$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$', '$2x + 3 > 11$', '$x > 4$']).length === 0);
check('x² = 4 then x = 2 is fine (a root is kept), x = ±2 is not misread', M.board(['$x^2 = 4$', '$x = 2$', '$x = \\pm 2$']).length === 0);

// his tool
const t = M.tool;
check('check_math value: 3/4 · 8 is 6 (LaTeX too)', t({ kind: 'value', expression: '\\frac{3}{4} \\cdot 8' }).value === '6');
check('check_math solves: x = 6 does not solve 2x + 3 = 11 (15 ≠ 11)', JSON.stringify(t({ kind: 'solves', equation: '2x + 3 = 11', values: 'x = 6' })) === '{"solves":false,"left":"15","right":"11"}');
check('check_math solves with two letters', t({ kind: 'solves', equation: 'x + y = 10', values: 'x = 3, y = 7' }).solves === true);
check('check_math solve: x² − 5x + 6 = 0 gives 2 and 3', t({ kind: 'solve', equation: 'x^2 - 5x + 6 = 0' }).solutions.join() === 'x = 2,x = 3');
check('check_math equal: (x + 1)² is not x² + 1, and is x² + 2x + 1', t({ kind: 'equal', left: '(x+1)^2', right: 'x^2+1' }).equal === false && t({ kind: 'equal', left: '(x+1)^2', right: 'x^2+2x+1' }).equal === true);
check('check_math derivative: 3x² for x³ is right, 2x² is not', t({ kind: 'derivative', f: 'x^3', answer: '3x^2' }).right === true && t({ kind: 'derivative', f: 'x^3', answer: '2x^2' }).right === false);
check('check_math derivative: the chain rule', t({ kind: 'derivative', f: 'sin(x^2)', answer: '2x cos(x^2)' }).right === true && t({ kind: 'derivative', f: 'sin(x^2)', answer: 'cos(x^2)' }).right === false);
check('check_math antiderivative: x² + 5 for 2x (any + C)', t({ kind: 'antiderivative', f: '2x', answer: 'x^2 + 5' }).right === true);
check('check_math limit: sin x / x → 1 at 0; 1/x has none at 0; (2x + 1)/(x − 3) → 2 at infinity', t({ kind: 'limit', f: 'sin(x)/x', at: '0', answer: '1' }).right === true && t({ kind: 'limit', f: '1/x', at: '0', answer: 'dne' }).right === true && t({ kind: 'limit', f: '(2x+1)/(x-3)', at: 'inf', answer: '2' }).right === true);
check('check_math steps: the first wrong line', (t({ kind: 'steps', lines: ['2x + 3 = 11', '2x = 14', 'x = 7'] }).first_wrong || {}).line === 2);
check('check_math says what it could not read instead of guessing', !!t({ kind: 'value', expression: 'banana' }).error);

// the note the server gives Bo
const note = (q, bo) => php('echo json_encode(mh_mc_note($argv[2], $argv[3]));', q, bo || '');
check('server note: wrong, with what to do', /^MATH CHECK/.test(note('x = 11 - 3 so x = 6')) && /11 − 3 is 8, not 6/.test(note('x = 11 - 3 so x = 6')) && /Do not agree/.test(note('x = 11 - 3 so x = 6')));
check('server note: a bare answer to his last question ("What is 7 times 8?" … "54")', /7 · 8 is 56, not 54/.test(note('54', 'Nice! Next one: what is 7 times 8?')));
check('server note: an answer to the problem on his last page ([board: Solving 2x + 3 = 11] … "x = 6")', /x = 6 does not solve 2x (\+ 3 = 11|= 8)/.test(note('so x = 6?', 'Let\'s do it together.\n[board: Solving 2x + 3 = 11]\nstep: Take 3 from both sides: $2x = 8$\n[/board]\nWhat do you get for x?')));
check('server note: right is said to be right', /is right/.test(note('eleven minus three is eight')));
check('server note: nothing for plain talk', note('When is my next exam? It is worth 20 percent.', 'What is 11 minus 3?') === '');
console.log(`\nchecks: ${n - bad}/${n} passed`); if (bad) { console.log('FAILED'); process.exit(1); }
