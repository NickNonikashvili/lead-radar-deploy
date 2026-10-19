<?php
/* ============================================================
   Mathub — the math check on the server: the same rules as assets/mathcheck.js, for what students type to Bo or say
   in basic voice (api/ai.php, ai_tutor). What is wrong in their message (arithmetic, a letter given two values, an
   answer that does not solve the problem being worked, a bare number answering Bo's last question, a derivative or
   antiderivative said in words) becomes a MATH CHECK note for Bo, so he never agrees with something wrong.
   Anything it cannot read is left alone. Pure PHP, no dependencies.
   ============================================================ */

const MH_MC_ONES = ['zero' => 0, 'oh' => 0, 'one' => 1, 'two' => 2, 'three' => 3, 'four' => 4, 'five' => 5, 'six' => 6, 'seven' => 7, 'eight' => 8, 'nine' => 9, 'ten' => 10, 'eleven' => 11, 'twelve' => 12, 'thirteen' => 13, 'fourteen' => 14, 'fifteen' => 15, 'sixteen' => 16, 'seventeen' => 17, 'eighteen' => 18, 'nineteen' => 19];
const MH_MC_TENS = ['twenty' => 20, 'thirty' => 30, 'forty' => 40, 'fourty' => 40, 'fifty' => 50, 'sixty' => 60, 'seventy' => 70, 'eighty' => 80, 'ninety' => 90];
const MH_MC_FRACW = ['half' => 2, 'halves' => 2, 'third' => 3, 'thirds' => 3, 'quarter' => 4, 'quarters' => 4, 'fourth' => 4, 'fourths' => 4, 'fifth' => 5, 'fifths' => 5];
const MH_MC_FUNS = ['arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'exp', 'abs', 'log', 'ln'];
const MH_MC_LETTERS = 'abcdfghjkmnpqrstuvwxyz';
const MH_MC_ANSWERW = ['it', 'the', 'answer', 'is', 'i', 'so', 'that', 'would', 'be', 'its', 'thats', 'get', 'got', 'a', 'an', 'my', 'final', 'we', 'you', 'oh', 'well', 'number', 'equal', 'to', "it's", "that's"];
const MH_MC_EN2 = ['am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'ha', 'he', 'hi', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'oh', 'ok', 'on', 'or', 'so', 'to', 'up', 'us', 'we', 'ya', 'yo'];

/* ---------- words and notation into plain math ---------- */
function mh_mc_norm(string $src): string {
  $s = ' ' . $src . ' ';
  $s = preg_replace('/\$\$?/', ' ', $s);
  $s = preg_replace('/\\\\left|\\\\right|\\\\[bB]igg?[lr]?|\\\\displaystyle|\\\\,|\\\\;|\\\\!|\\\\ /', ' ', $s);
  $s = str_replace('!=', ' ≠ ', $s); $s = preg_replace('/([0-9)])!/', '$1¡', $s);   // 5! is a factorial, not the end of a sentence
  $s = str_replace(['−', '–', '—', '×', '·', '⋅', '∙', '✕', '÷', 'π', '√', '≈', '≠', '²', '³', '¹', '⁴'], ['-', '-', '-', '*', '*', '*', '*', '*', '/', ' pi ', ' sqrt ', ' ~= ', ' != ', '^2', '^3', '^1', '^4'], $s);
  $s = preg_replace('/[≤≥<>]|⇒|→|⟹|∴/u', ' ; ', $s);
  $s = preg_replace('/\\\\(?:cdot|times|ast)\b/', '*', $s); $s = preg_replace('/\\\\div\b/', '/', $s); $s = preg_replace('/\\\\pi\b/', ' pi ', $s);
  $s = preg_replace('/\\\\approx\b/', ' ~= ', $s); $s = preg_replace('/\\\\(?:ne|neq)\b/', ' != ', $s);
  $s = preg_replace('/\\\\(?:Rightarrow|implies|to|rightarrow|Longrightarrow|therefore|quad|qquad|text\{[^}]*\}|le|ge|leq|geq|lt|gt)\b/', ' ; ', $s);
  for ($k = 0; $k < 10; $k++) {
    $t = preg_replace('/\^\{([^{}]*)\}/', '^($1)', $s);
    $t = preg_replace('/\\\\sqrt\s*\[([^\[\]{}]*)\]\s*\{([^{}]*)\}/', '(($2)^(1/($1)))', $t);
    $t = preg_replace('/\\\\sqrt\s*\{([^{}]*)\}/', ' sqrt($1)', $t);
    $t = preg_replace('/\\\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/', '(($1)/($2))', $t);
    if ($t === $s) break; $s = $t;
  }
  $s = preg_replace('/\\\\(sin|cos|tan|ln|log|exp|sqrt)\b/', ' $1 ', $s);
  $s = mb_strtolower($s);
  $s = preg_replace('/(\d),(\d{3})\b/', '$1$2', $s);
  $s = preg_replace_callback('/\b(an?|one)\s+(half|third|quarter|fourth|fifth)\b/', fn($m) => ' (1/' . MH_MC_FRACW[$m[2]] . ') ', $s);
  $W = implode('|', array_merge(array_keys(MH_MC_ONES), array_keys(MH_MC_TENS), ['hundred', 'thousand']));
  $s = preg_replace_callback("/\\b(?:$W)(?:(?:[\\s-]+(?:and\\s+)?)(?:$W))*\\b/", function ($m) {
    $total = 0; $cur = 0; $ok = false;
    foreach (preg_split('/[\s-]+/', $m[0]) as $w) {
      if ($w === 'and') continue;
      if (isset(MH_MC_ONES[$w])) { $cur += MH_MC_ONES[$w]; $ok = true; } elseif (isset(MH_MC_TENS[$w])) { $cur += MH_MC_TENS[$w]; $ok = true; }
      elseif ($w === 'hundred') { $cur = ($cur ?: 1) * 100; $ok = true; } elseif ($w === 'thousand') { $total += ($cur ?: 1) * 1000; $cur = 0; $ok = true; }
    }
    return $ok ? ' ' . ($total + $cur) . ' ' : $m[0];
  }, $s);
  $s = preg_replace_callback('/(\d+)\s+(halves|thirds|quarters|fourths|fifths)\b/', fn($m) => ' (' . $m[1] . '/' . MH_MC_FRACW[$m[2]] . ') ', $s);
  $s = preg_replace('/(\d)\s+point\s+(\d+)/', '$1.$2', $s); $s = preg_replace('/\bpoint\s+(\d+)/', '0.$1', $s);
  $s = preg_replace('/\b(?:the\s+)?absolute\s+value\s+of\b/', ' abs ', $s); $s = preg_replace('/\bsquare\s+root\s+of\b/', ' sqrt ', $s); $s = preg_replace('/\bcube\s+root\s+of\b/', ' cbrt ', $s); $s = preg_replace('/\bsquared\b/', '^2', $s); $s = preg_replace('/\bcubed\b/', '^3', $s);
  $s = preg_replace('/\bto\s+the\s+power\s+of\b|\braised\s+to(?:\s+the)?\b|\bto\s+the\s+(?=\d)/', '^', $s); $s = preg_replace('/(\d+)(?:st|nd|rd|th)\s+power\b/', '$1', $s);
  $s = preg_replace('/\bplus\b/', '+', $s); $s = preg_replace('/\bminus\b|\btake\s+away\b|\bless\b(?!\s+than)/', '-', $s); $s = preg_replace('/\bnegative\b/', ' -', $s);
  $s = preg_replace('/\bmultiplied\s+by\b|\btimes\b/', '*', $s); $s = preg_replace('/\bdivided\s+by\b|\bover\b/', '/', $s);
  $s = preg_replace('/(\d)\s*%\s*of\b/', '$1/100*', $s); $s = preg_replace('/(\d)\s*%/', '($1/100)', $s); $s = preg_replace('/\bpercent\s+of\b/', '/100*', $s);
  $s = preg_replace('/\bx\s+to\s+the\s+/', 'x^', $s);
  $s = preg_replace_callback("/\\b(?:um+|uh+|erm|like|basically|actually|just|probably|maybe|literally|kind\\s+of|sort\\s+of|i\\s+think|i\\s+guess|i\\s+believe|pretty\\s+sure|it'?s|that'?s|i\\s+got|i\\s+get|you\\s+get|we\\s+get)\\b/", fn($m) => preg_match('/^(it|that)/', $m[0]) ? ' is ' : ' ', $s);
  $s = preg_replace('/[!?;]|\.(?!\d)|,(?!\d{3})|\b(?:so|then|therefore|thus|hence|and\s+so|which\s+means|that\s+means|means|meaning|because|since|but|and|or|if|when|right|okay|ok|yeah|yes|no|wait|hmm+)\b/', ' ; ', $s);
  $s = str_replace(['~=', '¡'], [' ≈ ', '!'], $s);
  $s = preg_replace('/\b(?:is\s+equal\s+to|equals?\s+to|equals?|equal|is|are|was|gives\s+(?:you|me|us)?|gives|makes|comes\s+(?:out\s+)?to|would\s+be|will\s+be|should\s+be|be)\b/', ' = ', $s);
  $s = preg_replace('/={2,}/', '=', $s);
  return trim(preg_replace('/\s+/u', ' ', $s));
}

/* ---------- a small parser into a tree, and its value ---------- */
function mh_mc_letters(string $m): ?array {
  if (in_array($m, MH_MC_FUNS, true)) return [['f', $m]];
  if ($m === 'pi' || $m === 'e') return [['c', $m]];
  foreach (MH_MC_FUNS as $f) if (strlen($m) > strlen($f) && strncmp($m, $f, strlen($f)) === 0) { $rest = mh_mc_letters(substr($m, strlen($f))); return $rest ? array_merge([['f', $f]], $rest) : null; }
  if (strlen($m) === 1) return strpos(MH_MC_LETTERS, $m) !== false ? [['v', $m]] : null;
  if (strlen($m) === 2 && !in_array($m, MH_MC_EN2, true) && strpos(MH_MC_LETTERS, $m[0]) !== false && strpos(MH_MC_LETTERS, $m[1]) !== false) return [['v', $m[0]], ['v', $m[1]]];
  return null;
}
function mh_mc_tokens(string $s): ?array {
  $out = []; $i = 0; $n = strlen($s);
  while ($i < $n) {
    $c = $s[$i];
    if ($c === ' ') { $i++; continue; }
    if (ctype_digit($c) || $c === '.') { if (!preg_match('/^(\d+\.?\d*|\.\d+)/', substr($s, $i), $m)) return null; $out[] = ['n', (float)$m[1]]; $i += strlen($m[1]); continue; }
    if (ctype_lower($c)) { preg_match('/^[a-z]+/', substr($s, $i), $m); $run = mh_mc_letters($m[0]); if (!$run) return null; foreach ($run as $r) $out[] = $r; $i += strlen($m[0]); continue; }
    if (strpos('+-*/^()|!', $c) !== false) { $out[] = [$c]; $i++; continue; }
    return null;
  }
  return $out;
}
/** ['ast' => tree, 'vars' => [...], 'ops' => bool], or null when it is not math */
function mh_mc_parse(string $src): ?array {
  $T = mh_mc_tokens($src); if (!$T) return null;
  $i = 0; $vars = []; $abs = 0;
  $is = function ($t) use (&$T, &$i) { return isset($T[$i]) && $T[$i][0] === $t; };
  $expr = $term = $unary = $power = $post = $atom = null;
  $expr = function () use (&$T, &$i, $is, &$term) { $l = $term(); while ($is('+') || $is('-')) { $op = $T[$i++][0]; $l = [$op, $l, $term()]; } return $l; };
  $term = function () use (&$T, &$i, $is, &$unary, &$abs) {
    $l = $unary();
    while (true) {
      if ($is('*') || $is('/')) { $op = $T[$i++][0]; $l = [$op, $l, $unary()]; continue; }
      $p = $T[$i] ?? null; if (!$p) break;
      if (in_array($p[0], ['v', 'c', 'f', '('], true) || ($p[0] === '|' && $abs === 0)) { $l = ['*', $l, $unary()]; continue; }
      break;
    }
    return $l;
  };
  $unary = function () use (&$i, $is, &$unary, &$power) { if ($is('-')) { $i++; return ['neg', $unary()]; } if ($is('+')) { $i++; return $unary(); } return $power(); };
  $power = function () use (&$i, $is, &$unary, &$post) { $b = $post(); if ($is('^')) { $i++; return ['^', $b, $unary()]; } return $b; };
  $post = function () use (&$i, $is, &$atom) { $a = $atom(); while ($is('!')) { $i++; $a = ['!', $a]; } return $a; };
  $atom = function () use (&$T, &$i, $is, &$expr, &$unary, &$vars, &$abs) {
    $p = $T[$i++] ?? null; if (!$p) throw new Exception('end');
    if ($p[0] === 'n') { if (isset($T[$i]) && $T[$i][0] === 'n') throw new Exception('two numbers'); return ['n', $p[1]]; }
    if ($p[0] === 'c') return ['c', $p[1]];
    if ($p[0] === 'v') { $vars[$p[1]] = true; return ['v', $p[1]]; }
    if ($p[0] === 'f') { if ($is('(')) { $i++; $a = $expr(); if (!$is(')')) throw new Exception(')'); $i++; } else $a = $unary(); return ['f', $p[1], $a]; }
    if ($p[0] === '(') { $a = $expr(); if (!$is(')')) throw new Exception(')'); $i++; return $a; }
    if ($p[0] === '|') { $abs++; $a = $expr(); $abs--; if (!$is('|')) throw new Exception('|'); $i++; return ['abs', $a]; }
    throw new Exception('unexpected');
  };
  try { $ast = $expr(); if ($i < count($T)) return null; } catch (Throwable $e) { return null; }
  $ops = false; $plain = 0; foreach ($T as $t) { if (in_array($t[0], ['+', '-', '*', '/', '^', '!', 'f', 'c'], true)) $ops = true; if ($t[0] !== '(' && $t[0] !== ')') $plain++; }
  return ['ast' => $ast, 'vars' => array_keys($vars), 'ops' => $ops || $plain > 1];
}
function mh_mc_eval(array $a, array $env = []): float {
  switch ($a[0]) {
    case 'n': return (float)$a[1];
    case 'c': return $a[1] === 'pi' ? M_PI : M_E;
    case 'v': return isset($env[$a[1]]) ? (float)$env[$a[1]] : NAN;
    case 'neg': return -mh_mc_eval($a[1], $env);
    case 'abs': return abs(mh_mc_eval($a[1], $env));
    case '+': return mh_mc_eval($a[1], $env) + mh_mc_eval($a[2], $env);
    case '-': return mh_mc_eval($a[1], $env) - mh_mc_eval($a[2], $env);
    case '*': return mh_mc_eval($a[1], $env) * mh_mc_eval($a[2], $env);
    case '/': { $d = mh_mc_eval($a[2], $env); return $d == 0.0 ? NAN : mh_mc_eval($a[1], $env) / $d; }
    case '^': { $b = mh_mc_eval($a[1], $env); $x = mh_mc_eval($a[2], $env); if ($b < 0 && abs($x - round($x)) > 1e-12) return NAN; $r = @pow($b, $x); return is_finite($r) ? $r : NAN; }
    case '!': { $n = mh_mc_eval($a[1], $env); if ($n < 0 || $n > 170 || abs($n - round($n)) > 1e-9) return NAN; $r = 1.0; for ($k = 2; $k <= (int)round($n); $k++) $r *= $k; return $r; }
    case 'f': {
      $x = mh_mc_eval($a[2], $env);
      switch ($a[1]) {
        case 'sqrt': return $x < 0 ? NAN : sqrt($x); case 'cbrt': return $x < 0 ? -pow(-$x, 1 / 3) : pow($x, 1 / 3);
        case 'sin': return sin($x); case 'cos': return cos($x); case 'tan': return tan($x); case 'sec': return 1 / cos($x); case 'csc': return 1 / sin($x); case 'cot': return 1 / tan($x);
        case 'arcsin': case 'asin': return asin($x); case 'arccos': case 'acos': return acos($x); case 'arctan': case 'atan': return atan($x);
        case 'sinh': return sinh($x); case 'cosh': return cosh($x); case 'tanh': return tanh($x);
        case 'ln': return $x <= 0 ? NAN : log($x); case 'log': return $x <= 0 ? NAN : log10($x); case 'exp': return exp($x); case 'abs': return abs($x);
      }
    }
  }
  return NAN;
}

/* ---------- numbers ---------- */
function mh_mc_close(float $a, float $b, float $rel = 1e-9): bool { return is_finite($a) && is_finite($b) && abs($a - $b) <= $rel * max(1, abs($a), abs($b)); }
function mh_mc_same(float $truth, float $said, string $text): bool {
  if (mh_mc_close($truth, $said)) return true;
  if (!preg_match('/(\d)\.(\d+)\s*\)?\s*$/', $text, $m) || !is_finite($truth)) return false;
  return abs($truth - $said) <= 0.5 * pow(10, -strlen($m[2])) + 1e-12;
}
function mh_mc_fmt(float $v): string {
  if (is_nan($v)) return 'undefined'; if (!is_finite($v)) return $v > 0 ? 'infinity' : '-infinity';
  if (abs($v - round($v)) < 1e-9) return (string)(int)round($v);
  for ($q = 2; $q <= 12; $q++) { $p = $v * $q; if (abs($p - round($p)) < 1e-9 * $q) return (int)round($p) . '/' . $q . ' (' . rtrim(rtrim(sprintf('%.6g', $v), '0'), '.') . ')'; }
  return rtrim(rtrim(sprintf('%.8g', $v), '0'), '.');
}
function mh_mc_pretty(string $s): string { return trim(str_replace(['*', '-'], ['·', '−'], preg_replace('/\s+/', ' ', $s))); }

/* ---------- the parts of a claim ---------- */
function mh_mc_edge(string $words, bool $atEnd): string {
  $w = array_values(array_filter(explode(' ', trim($words)), 'strlen')); if (!$w) return '';
  $best = '';
  for ($k = 1; $k <= count($w); $k++) {
    $part = implode(' ', $atEnd ? array_slice($w, count($w) - $k) : array_slice($w, 0, $k));
    if (!preg_match('/^[0-9a-z.+\-*\/^()|!\s]+$/', $part)) break;
    if (mh_mc_parse($part)) $best = $part;
  }
  if (preg_match('/^[a-z]$/', $best) && strpos('xyznkmtpqrsuvw', $best) === false) return '';
  return $best;
}
function mh_mc_isdef(string $s): bool { return (bool)preg_match('/^[a-z]\s*\(\s*[a-z]\s*\)/', $s); }
function mh_mc_val(string $s): float { $p = mh_mc_parse($s); return $p && !$p['vars'] ? mh_mc_eval($p['ast']) : NAN; }
function mh_mc_roots(array $L, array $R, string $v): array {
  $f = fn($x) => mh_mc_eval($L, [$v => $x]) - mh_mc_eval($R, [$v => $x]);
  $out = []; $add = function ($x) use (&$out) { foreach ($out as $y) if (abs($y - $x) < 1e-6 * max(1, abs($x))) return; $out[] = $x; };
  $px = -200.0; $pv = $f($px);
  for ($k = 1; $k <= 8000; $k++) {
    $x = -200 + $k * 0.05; $y = $f($x);
    if (is_finite($y) && abs($y) < 1e-10) $add(round($x, 10));
    elseif (is_finite($pv) && is_finite($y) && $pv * $y < 0) {
      $a = $px; $b = $x; $fa = $pv; for ($it = 0; $it < 80; $it++) { $m = ($a + $b) / 2; $fm = $f($m); if (!is_finite($fm)) break; if ($fa * $fm <= 0) $b = $m; else { $a = $m; $fa = $fm; } }
      $r = ($a + $b) / 2; if (abs($f($r)) < 1e-6 * max(1, abs($r))) $add($r);
    }
    $px = $x; $pv = $y;
  }
  sort($out); return $out;
}
function mh_mc_equation(string $text): ?array {
  foreach (explode(';', mh_mc_norm($text)) as $c) {
    if (substr_count($c, '=') !== 1) continue;
    [$a, $b] = explode('=', $c); $l = mh_mc_edge($a, true); $r = mh_mc_edge($b, false); if ($l === '' || $r === '' || mh_mc_isdef($l)) continue;
    $P = mh_mc_parse($l); $Q = mh_mc_parse($r); if (!$P || !$Q) continue;
    $vs = array_values(array_unique(array_merge($P['vars'], $Q['vars']))); if (count($vs) !== 1) continue;
    if (preg_match('/^[a-z]$/', trim($l)) && !$Q['vars']) continue;
    return ['L' => $P['ast'], 'R' => $Q['ast'], 'v' => $vs[0], 'text' => mh_mc_pretty($l) . ' = ' . mh_mc_pretty($r)];
  }
  return null;
}
function mh_mc_equations(string $text): array { $o = []; foreach (explode(';', implode(';', array_map('mh_mc_norm', preg_split('/\n|:\s|\[\/?board\+?:?|\]/', $text)))) as $c) { if (substr_count($c, '=') !== 1) continue; [$a, $b] = explode('=', $c); $l = mh_mc_edge($a, true); $r = mh_mc_edge($b, false); if ($l !== '' && $r !== '' && mh_mc_equation("$l = $r")) $o[] = "$l = $r"; } return $o; }
/** The question in something Bo said: the last sentence with "?" holding a sum ("So what's 11 minus 3?"). */
function mh_mc_question(string $text): string {
  $qs = array_reverse(array_filter(preg_split('/(?<=\?)/', $text), fn($s) => preg_match('/\?\s*$/', $s)));
  foreach ($qs as $q) {
    $n = mh_mc_norm(preg_replace("/\\bwhat'?s\\b|\\bwhat\\s+is\\b|\\bwhat\\s+do\\s+you\\s+get\\s+(?:for|from)?\\b/i", ' ', $q));
    foreach (explode(';', $n) as $c) { $c = trim(str_replace('=', ' ', $c)); $e = mh_mc_edge($c, false) ?: mh_mc_edge($c, true); $p = $e !== '' ? mh_mc_parse($e) : null; if ($p && $p['ops'] && !$p['vars']) return $e; }
  }
  return '';
}
/** What is wrong (and right) in a message. ctx: ['eqs' => [the problem being worked…], 'ask' => '11 - 3'] */
function mh_mc_claims(string $text, array $ctx = []): array {
  $wrong = []; $right = []; $sets = []; $eqs = [];
  foreach (explode(';', mh_mc_norm($text)) as $clause) {
    if (strpos($clause, '=') === false && strpos($clause, '≈') === false) continue;
    $raw = preg_split('/\s*(=|≈|≠)\s*/u', $clause, -1, PREG_SPLIT_DELIM_CAPTURE); $sides = [];
    for ($k = 0, $n = count($raw); $k < $n; $k += 2) {
      $s = $raw[$k]; $s = $k === 0 ? mh_mc_edge($s, true) : ($k === $n - 1 ? mh_mc_edge($s, false) : (mh_mc_parse(trim($s)) ? trim($s) : mh_mc_edge($s, false)));
      $sides[] = ['s' => $s, 'op' => $k > 0 ? $raw[$k - 1] : ''];
    }
    for ($k = 1; $k < count($sides); $k++) {
      $a = $sides[$k - 1]['s']; $b = $sides[$k]['s']; $op = $sides[$k]['op']; if ($a === '' || $b === '' || $op === '≠' || mh_mc_isdef($a)) continue;
      $A = mh_mc_parse($a); $B = mh_mc_parse($b); if (!$A || !$B) continue;
      if (preg_match('/^[a-z]$/', trim($a)) && !$B['vars']) {
        $v = trim($a); $val = mh_mc_eval($B['ast']); if (!is_finite($val)) continue;
        if (isset($sets[$v]) && $sets[$v]['ops'] && !mh_mc_same($sets[$v]['val'], $val, $b) && !mh_mc_same($val, $sets[$v]['val'], $sets[$v]['src'])) $wrong[] = ['kind' => 'reassign', 'v' => $v, 'expr' => $sets[$v]['src'], 'is' => $sets[$v]['val'], 'msg' => "$v = " . mh_mc_pretty($sets[$v]['src']) . ' is ' . mh_mc_fmt($sets[$v]['val']) . ', not ' . mh_mc_pretty($b)];
        elseif (!isset($sets[$v]) || $B['ops']) $sets[$v] = ['val' => $val, 'src' => $b, 'ops' => $B['ops']];
        continue;
      }
      if ($A['vars'] || $B['vars']) { $vs = array_values(array_unique(array_merge($A['vars'], $B['vars']))); if (count($vs) === 1 && !(preg_match('/^[a-z]$/', trim($b)) && !$A['vars'])) $eqs[] = ['L' => $A['ast'], 'R' => $B['ast'], 'v' => $vs[0], 'text' => mh_mc_pretty($a) . ' = ' . mh_mc_pretty($b)]; continue; }
      if (!$A['ops'] && !$B['ops']) continue;
      $va = mh_mc_eval($A['ast']); $vb = mh_mc_eval($B['ast']); if (!is_finite($va) || !is_finite($vb)) continue;
      $swap = $B['ops'] && !$A['ops'];
      $ok0 = $op === '≈' ? abs($va - $vb) <= 0.02 * max(abs($va), abs($vb), 1e-9) : ($B['ops'] ? (mh_mc_close($va, $vb) || mh_mc_same($vb, $va, $a)) : mh_mc_same($va, $vb, $b));
      if (!$ok0 && $op !== '≈') { $alt = fn($x) => preg_replace('/^\s*-\s*(\d+(?:\.\d+)?)(?=\s*\^)/', '(-$1)', $x); $A2 = $alt($a) !== $a ? mh_mc_parse($alt($a)) : null; $B2 = $alt($b) !== $b ? mh_mc_parse($alt($b)) : null; if (($A2 && mh_mc_close(mh_mc_eval($A2['ast']), $vb)) || ($B2 && mh_mc_close($va, mh_mc_eval($B2['ast'])))) continue; }   // "negative 3 squared is 9": (−3)² said aloud
      $ok = $op === '≈' ? abs($va - $vb) <= 0.02 * max(abs($va), abs($vb), 1e-9) : ($B['ops'] ? (mh_mc_close($va, $vb) || mh_mc_same($vb, $va, $a)) : mh_mc_same($va, $vb, $b));
      if ($ok) $right[] = ['kind' => 'arith', 'msg' => mh_mc_pretty($a) . ' = ' . mh_mc_pretty($b) . ' is right'];
      else $wrong[] = ['kind' => 'arith', 'expr' => $swap ? $b : $a, 'is' => $swap ? $vb : $va, 'msg' => mh_mc_pretty($swap ? $b : $a) . ' is ' . mh_mc_fmt($swap ? $vb : $va) . ', not ' . mh_mc_pretty($swap ? $a : $b)];
    }
  }
  // calculus in words: "the derivative of x squared is 2x"
  foreach (explode(';', mh_mc_norm($text)) as $clause) {
    if (!preg_match('/\b(derivative|antiderivative|integral)\s+of\s+(.+?)\s*=\s*(.+)$/', $clause, $m)) continue;
    $f = mh_mc_edge($m[2], false); $g = mh_mc_edge($m[3], false); if ($f === '' || $g === '') continue;
    $F = mh_mc_parse($f); $G = mh_mc_parse($g); if (!$F || !$G) continue;
    $vs = array_values(array_unique(array_merge($F['vars'], $G['vars']))); if (count($vs) > 1) continue; $v = $vs[0] ?? 'x';
    $d = function ($ast, $x) use ($v) { $h = 1e-5 * max(1, abs($x)); return (mh_mc_eval($ast, [$v => $x + $h]) - mh_mc_eval($ast, [$v => $x - $h])) / (2 * $h); };
    $bad = false; foreach ([0.37, 1.13, -0.71, 2.29, -1.61] as $x) { $want = $m[1] === 'derivative' ? $d($F['ast'], $x) : mh_mc_eval($F['ast'], [$v => $x]); $got = $m[1] === 'derivative' ? mh_mc_eval($G['ast'], [$v => $x]) : $d($G['ast'], $x); if (!is_finite($want) || !is_finite($got)) continue; if (abs($want - $got) > 1e-4 * max(1, abs($want))) { $bad = true; break; } }
    $kind = $m[1] === 'derivative' ? 'derivative' : 'antiderivative';
    if ($bad) $wrong[] = ['kind' => $kind, 'msg' => "the $kind of " . mh_mc_pretty($f) . ' is not ' . mh_mc_pretty($g)]; else $right[] = ['kind' => $kind, 'msg' => "the $kind of " . mh_mc_pretty($f) . ' is ' . mh_mc_pretty($g)];
  }
  // an answer for a letter, against the equation it is meant to solve
  $problems = $eqs; foreach (array_reverse($ctx['eqs'] ?? []) as $e) { $q = mh_mc_equation((string)$e); if ($q) $problems[] = $q; }
  foreach ($sets as $v => $set) {
    $eq = null; foreach ($problems as $p) if ($p['v'] === $v) { $eq = $p; break; } if (!$eq) continue;
    $x = $set['val']; $l = mh_mc_eval($eq['L'], [$v => $x]); $r = mh_mc_eval($eq['R'], [$v => $x]); if (!is_finite($l) || !is_finite($r)) continue;
    $done = false; foreach ($wrong as $w) if (($w['v'] ?? '') === $v) $done = true;
    if (!mh_mc_close($l, $r, 1e-7) && !$done) {
      $near = mh_mc_roots($eq['L'], $eq['R'], $v); foreach ($near as $z) if (mh_mc_same($z, $x, $set['src'])) continue 2;
      $wrong[] = ['kind' => 'solve', 'v' => $v, 'eq' => $eq['text'], 'roots' => $near, 'msg' => "$v = " . mh_mc_pretty($set['src']) . ' does not solve ' . $eq['text'] . ': the left side is ' . mh_mc_fmt($l) . ' and the right side is ' . mh_mc_fmt($r) . ($near && count($near) <= 3 ? " ($v = " . implode(' or ', array_map('mh_mc_fmt', $near)) . ' does)' : '')];
    } elseif (mh_mc_close($l, $r, 1e-7)) $right[] = ['kind' => 'solve', 'msg' => "$v = " . mh_mc_fmt($x) . ' solves ' . $eq['text']];
  }
  // a bare number answering the question just asked
  if (!empty($ctx['ask']) && !$wrong && !$sets) {
    $q = mh_mc_parse((string)$ctx['ask']);
    // only an answer that is just a number ("six", "it's 6", "the answer is 6"), not a number in other talk ("worth 20 percent")
    $words = array_values(array_filter(explode(' ', str_replace([';', '='], ' ', mh_mc_norm($text))), fn($w) => $w !== '' && !in_array($w, MH_MC_ANSWERW, true)));
    if ($q && !$q['vars'] && $q['ops'] && count($words) === 1 && preg_match('/^(?:-?\d+(?:\.\d+)?|\(\d+\/\d+\))$/', $words[0])) {
      $want = mh_mc_eval($q['ast']); $said = $words[0]; $got = mh_mc_val($said);
      if (is_finite($want) && is_finite($got)) { if (mh_mc_same($want, $got, $said)) $right[] = ['kind' => 'answer', 'msg' => mh_mc_fmt($got) . ' is right: ' . mh_mc_pretty($ctx['ask']) . ' is ' . mh_mc_fmt($want)]; else $wrong[] = ['kind' => 'answer', 'expr' => (string)$ctx['ask'], 'is' => $want, 'msg' => mh_mc_pretty($ctx['ask']) . ' is ' . mh_mc_fmt($want) . ', not ' . mh_mc_pretty($said)]; }
    }
  }
  return ['wrong' => $wrong, 'right' => $right];
}

/** A page Bo wrote, line by line: a false equality, or a step that does not follow from the one before (same as board() in assets/mathcheck.js). */
function mh_mc_board(array $lines, string $title = ''): array {
  $out = []; $prev = $title !== '' ? mh_mc_equation($title) : null;
  foreach ($lines as $i => $raw) {
    $text = (string)$raw; preg_match_all('/\$\$?[^$]+\$\$?/', $text, $mm); $parts = $mm[0] ?: (strpos($text, '=') !== false ? [preg_replace('/^[^:=]*:\s*/', '', $text)] : []);
    foreach ($parts as $part) {
      $c = mh_mc_claims($part); if ($c['wrong']) { $out[] = ['line' => $i + 1, 'msg' => $c['wrong'][0]['msg']]; continue 2; }
      $eq = mh_mc_equation($part);
      if ($eq) {
        if ($prev && $prev['v'] === $eq['v']) { $A = mh_mc_roots($prev['L'], $prev['R'], $eq['v']); $B = mh_mc_roots($eq['L'], $eq['R'], $eq['v']); $share = false; foreach ($A as $a) foreach ($B as $b) if (abs($a - $b) < 1e-6 * max(1, abs($a))) $share = true; if ($A && $B && !$share) { $out[] = ['line' => $i + 1, 'msg' => $eq['text'] . ' does not follow from ' . $prev['text']]; continue 2; } }
        $prev = $eq;
      } elseif ($prev && preg_match('/^\s*([a-z])\s*=\s*(.+)$/', (string)(array_values(array_filter(explode(';', mh_mc_norm($part)), fn($x) => strpos($x, '=') !== false))[0] ?? ''), $m) && $m[1] === $prev['v']) {
        $x = mh_mc_val(mh_mc_edge($m[2], false)); if (!is_finite($x)) continue;
        $l = mh_mc_eval($prev['L'], [$m[1] => $x]); $r = mh_mc_eval($prev['R'], [$m[1] => $x]);
        if (is_finite($l) && is_finite($r) && !mh_mc_close($l, $r, 1e-7)) { $ok = false; foreach (mh_mc_roots($prev['L'], $prev['R'], $m[1]) as $z) if (mh_mc_same($z, $x, $m[2])) $ok = true; if (!$ok) { $out[] = ['line' => $i + 1, 'msg' => $m[1] . ' = ' . mh_mc_fmt($x) . ' does not solve ' . $prev['text']]; continue 2; } }
      }
    }
  }
  return $out;
}
/** Slips in a reply of Bo's: his pages, and what he says outside them. A sentence that quotes or corrects something
    ("you wrote 11 − 3 = 6", "not 6", "a common mistake is…") is not his own claim and is left alone. */
function mh_mc_reply_slips(string $reply): array {
  $out = []; $quote = "/\b(not|isn'?t|wasn'?t|aren'?t|wrong|mistake|slip|instead|careful|common|tempting|you\s+(wrote|said|got|had|put|have)|they\s+(wrote|said)|if\s+you)\b|≠|\\ne/i";
  if (preg_match_all('/\[board\+?:\s*([^\]\n]*)\]\s*\n(.*?)\[\/board\]/is', $reply, $pages, PREG_SET_ORDER)) foreach ($pages as $pg) {
    $lines = []; foreach (preg_split('/\n/', $pg[2]) as $ln) { if (preg_match('/^\s*check\s*:\s*(\{.*\})\s*$/i', $ln, $cm)) { $bad = mh_mc_check_line($cm[1]); if ($bad !== '') $out[] = 'on your page "' . trim($pg[1]) . '": ' . $bad; continue; } if (!preg_match('/^\s*(step|math|answer|text|tip)\s*:\s*(.*)$/i', $ln, $m)) continue; $lines[] = preg_match($quote, $m[2]) || strtolower($m[1]) === 'tip' ? '' : $m[2]; }
    foreach (mh_mc_board($lines, $pg[1]) as $b) $out[] = 'on your page "' . trim($pg[1]) . '", line ' . $b['line'] . ': ' . $b['msg'];
  }
  $plain = preg_replace('/\[board\+?:.*?\[\/board\]/is', ' ', $reply);
  foreach (preg_split('/(?<=[.!?])\s+|\n+/', $plain) as $sen) { if (trim($sen) === '' || preg_match($quote, $sen)) continue; foreach (mh_mc_claims($sen)['wrong'] as $w) $out[] = $w['msg']; }
  return array_values(array_unique($out));
}
/** A practice question for each thing that was wrong: "What is 11 − 3?" (8), "Solve 2x + 3 = 11." (4). For the mistakes notebook. */
function mh_mc_tex(string $s): string { return trim(str_replace(['*', '·', '−'], [' \\cdot ', ' \\cdot ', '-'], preg_replace('/\s+/', ' ', $s))); }
function mh_mc_practice(array $wrong): array {
  $out = [];
  foreach ($wrong as $w) {
    if (in_array($w['kind'], ['arith', 'answer', 'reassign'], true) && isset($w['expr'], $w['is']) && is_finite((float)$w['is'])) $out[] = ['prompt' => 'What is $' . mh_mc_tex((string)$w['expr']) . '$?', 'answer' => (float)$w['is'], 'tex' => mh_mc_fmt_tex((float)$w['is']), 'why' => mh_mc_pretty((string)$w['expr']) . ' is ' . mh_mc_fmt((float)$w['is']) . '.'];
    elseif ($w['kind'] === 'solve' && count($w['roots'] ?? []) === 1) $out[] = ['prompt' => 'Solve $' . mh_mc_tex($w['eq']) . '$ for $' . $w['v'] . '$.', 'answer' => (float)$w['roots'][0], 'tex' => mh_mc_fmt_tex((float)$w['roots'][0]), 'why' => $w['v'] . ' = ' . mh_mc_fmt((float)$w['roots'][0]) . ' makes both sides equal.'];
  }
  return array_slice($out, 0, 4);
}
function mh_mc_fmt_tex(float $v): string { if (abs($v - round($v)) < 1e-9) return (string)(int)round($v); for ($q = 2; $q <= 12; $q++) { $p = $v * $q; if (abs($p - round($p)) < 1e-9 * $q) return ($p < 0 ? '-' : '') . '\\frac{' . abs((int)round($p)) . '}{' . $q . '}'; } return rtrim(rtrim(sprintf('%.6g', $v), '0'), '.'); }
/** A question on one of Bo's pages ("check: {q, answer}"): when it asks for a sum, is his answer right? '' or what is wrong. */
function mh_mc_check_line(string $json): string {
  $o = json_decode($json, true); if (!is_array($o)) return '';
  $q = (string)($o['q'] ?? $o['question'] ?? ''); $a = (string)($o['answer'] ?? ''); if ($q === '' || $a === '') return '';
  $ask = mh_mc_question(rtrim($q, " ?") . '?'); if ($ask === '') return '';
  $r = mh_mc_claims($a, ['ask' => $ask]); return $r['wrong'] ? 'the answer to "' . $q . '" is wrong: ' . $r['wrong'][0]['msg'] : '';
}
/** A slip said out loud: "7 · 8 is 56, not 54" → "7 times 8 is 56, not 54". */
function mh_mc_say(string $s): string { return trim(preg_replace('/\s+/', ' ', str_replace(['·', '−', '/', '^2', '^3', '^', '='], [' times ', ' minus ', ' over ', ' squared', ' cubed', ' to the ', ' equals '], $s))); }

/** The note for Bo about what the student just wrote or said (with the problem and question from his last message), or ''. */
function mh_mc_note(string $q, string $lastBo = ''): string { return mh_mc_check_message($q, $lastBo)['note']; }
/** The note, and what was wrong (for practice and the call's recap). */
function mh_mc_check_message(string $q, string $lastBo = ''): array {
  if (trim($q) === '' || mb_strlen($q) > 2000) return ['note' => '', 'wrong' => []];
  // the problem: equations in his last message, his pages' titles and lines included; the question: what he asked outside his pages
  $r = mh_mc_claims($q, ['eqs' => array_slice(mh_mc_equations($lastBo), -6), 'ask' => mh_mc_question(preg_replace('/\[board\+?:.*?\[\/board\]/is', ' ', $lastBo))]);
  if ($r['wrong']) return ['wrong' => $r['wrong'], 'note' => 'MATH CHECK (exact, worked out by the app from their message): ' . implode('; ', array_column($r['wrong'], 'msg')) . '. So what they wrote is wrong. Do not agree with it or call it right. Say kindly that it\'s not quite, point at the exact slip, and let them fix it (give the right value only if they ask or are stuck).' . (array_filter($r['wrong'], fn($w) => $w['kind'] === 'solve') ? ' (If they mean a different problem than the one you were working on, check that one instead.)' : '')];
  if ($r['right']) return ['wrong' => [], 'note' => 'MATH CHECK (exact, worked out by the app from their message): ' . implode('; ', array_column($r['right'], 'msg')) . '. Tell them so; do not say it is wrong.'];
  return ['note' => '', 'wrong' => []];
}
