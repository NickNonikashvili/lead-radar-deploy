<?php
/* ============================================================
   StudyCat account server — the student file: one JSON file per student, everything Bo needs to know about them
   - api/data/students/<user id>.json (never served as a file; read through ai_student). What is in it:
       student   first name, school, language, Bo's character, the plan
       classes   each class they asked Bo about: its name, the next exam, readiness, weakest and strongest topics,
                 recent mistakes, grades (from the page's snapshot, which every chat and call sends)
       notes     what Bo remembers about them (his [remember: …] notes, ai_notes)
       memory    the short summaries that keep long chats and calls sharp (below), per class and for calls
       calls     the last recaps after calls (a line each)
       pictures  the last pictures Bo made for them (what they showed)
   - Chat, calls and pictures all read it: mh_student_context() is the block in Bo's instructions (with what the page
     knows right now), mh_student_image_context() a line for the image model.
   - Compaction, so Bo never gets lost in a long conversation: a chat sends Bo its last MH_AI_TURNS_SENT turns plus a
     summary of everything before them; when more than MH_STUDENT_COMPACT_AT turns have piled up behind that window,
     the cheap model folds them into the summary (mh_student_compact_chat, after the answer has gone out). A call does
     the same as it goes (ai_compact: the page sends its older messages, gets the summary, puts it in the call and
     takes the old messages out). Each summary costs a little credit ("Keeping Bo's memory short").
   - The file goes when the account goes (mh_student_prune, with the other tidying in api/social.php). "Forget" in
     Ask Bo's i sheet clears its memory, notes and pictures (ai_forget), and ai_student hands the whole file to them.
   ============================================================ */
declare(strict_types=1);

require_once __DIR__ . '/ai.php';

const MH_STUDENT_COMPACT_AT = 14;   // turns waiting behind the window before they are folded into the summary
const MH_STUDENT_SUMMARY_CHARS = 1600;

function mh_student_dir(): string { $d = __DIR__ . '/data/students'; if (!is_dir($d)) { @mkdir($d, 0770, true); @file_put_contents($d . '/.htaccess', "Require all denied\n"); } return $d; }
function mh_student_path(int $uid): string { return mh_student_dir() . '/' . $uid . '.json'; }
function mh_student_blank(): array { return ['v' => 1, 'updated' => 0, 'student' => [], 'classes' => [], 'notes' => [], 'memory' => ['chat' => [], 'calls' => []], 'calls' => [], 'pictures' => []]; }
function mh_student_load(int $uid): array {
  $f = mh_student_path($uid); $j = is_file($f) ? json_decode((string)@file_get_contents($f), true) : null;
  return is_array($j) ? array_replace_recursive(mh_student_blank(), $j) : mh_student_blank();
}
function mh_student_save(int $uid, array $S): void {
  $S['updated'] = time();
  foreach (['calls' => 8, 'pictures' => 12] as $k => $n) $S[$k] = array_slice(array_values($S[$k] ?? []), -$n);
  $S['memory']['calls'] = array_slice(array_values($S['memory']['calls'] ?? []), -4);
  $json = json_encode($S, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT); if ($json === false) return;
  if (strlen($json) > 120000) { $S['classes'] = array_slice($S['classes'], -12, null, true); $json = json_encode($S, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
  $f = mh_student_path($uid); $tmp = $f . '.tmp' . bin2hex(random_bytes(3)); if (@file_put_contents($tmp, $json) !== false) @rename($tmp, $f);
}
function mh_student_prune(): int {
  $n = 0; $ids = array_flip(array_map('intval', mh_db()->query('SELECT id FROM users')->fetchAll(PDO::FETCH_COLUMN)));
  foreach (glob(mh_student_dir() . '/*.json') ?: [] as $f) { $id = (int)basename($f, '.json'); if (!isset($ids[$id])) { @unlink($f); $n++; } }
  return $n;
}

/** What the page knows right now (its snapshot), and who they are, into the file. Returns the file. */
function mh_student_update(array $u, array $cfg, array $in, string $cid, ?array $C): array {
  $uid = (int)$u['id']; $S = mh_student_load($uid); $s = is_array($in['snapshot'] ?? null) ? $in['snapshot'] : [];
  $p = fn($v, $n) => mh_ai_plain($v, $n);
  $first = trim(explode(' ', (string)($s['name'] ?? $u['name'] ?? ''))[0] ?? '');
  $S['student'] = array_filter(['name' => $p($first, 30), 'school' => 'Montana State University', 'language' => $p($in['lang'] ?? ($S['student']['language'] ?? ''), 8), 'character' => mh_ai_character_id($in), 'plan' => mh_plan($u, $cfg) ?: 'free'], fn($v) => $v !== '');
  if ($cid !== '') {
    $k = $S['classes'][$cid] ?? []; $k['name'] = mh_ai_class_name($C, $cid); $k['seen'] = time();
    if (is_array($s['readiness'] ?? null)) { $r = $s['readiness']; $k['next_exam'] = ['name' => $p($r['exam'] ?? '', 40), 'date' => $p($r['date'] ?? '', 10), 'readiness' => (int)($r['score'] ?? 0)]; }
    $topic = fn($t) => is_array($t) ? $p($t['t'] ?? '', 50) . (isset($t['acc']) ? ' (' . round(100 * (float)$t['acc']) . '% right)' : '') : $p($t, 50);
    if (!empty($s['weak']) && is_array($s['weak'])) $k['weakest'] = array_map($topic, array_slice($s['weak'], 0, 5));
    if (!empty($s['strong']) && is_array($s['strong'])) $k['strongest'] = array_map(fn($x) => $p(is_array($x) ? ($x['t'] ?? '') : $x, 50), array_slice($s['strong'], 0, 4));
    if (!empty($s['missed']) && is_array($s['missed'])) $k['recent_mistakes'] = array_map(fn($m) => is_array($m) ? $p($m['q'] ?? '', 120) . ' → they said ' . $p($m['a'] ?? '', 30) : '', array_slice($s['missed'], 0, 4));
    if (!empty($s['grades']) && is_array($s['grades'])) $k['grades'] = array_map(fn($g) => is_array($g) ? $p($g['c'] ?? '', 30) . ' ' . $p($g['s'] ?? '', 10) : '', array_slice($s['grades'], 0, 6));
    $S['classes'][$cid] = $k;
  }
  if (!empty($s['others']) && is_array($s['others'])) $S['other_classes'] = array_map(fn($o) => is_array($o) ? trim($p($o['c'] ?? '', 30) . (!empty($o['ex']) ? ' (' . $p($o['ex'], 25) . ' in ' . (int)($o['days'] ?? 0) . ' days)' : '')) : '', array_slice($s['others'], 0, 8));
  $S['notes'] = mh_ai_notes($uid);
  mh_student_save($uid, $S); return $S;
}

/** The block in Bo's instructions: who they are, their other classes, what he remembers, the summaries, recent calls. */
function mh_student_context(array $S, string $cid): string {
  $L = ['THE STUDENT FILE (what StudyCat keeps about them; use it, never recite it):'];
  $st = $S['student'] ?? [];
  if ($st) $L[] = '- ' . implode(', ', array_filter([isset($st['name']) ? 'Name: ' . $st['name'] : '', isset($st['school']) ? $st['school'] : '', isset($st['plan']) ? 'plan: ' . $st['plan'] : '']));
  $others = array_filter($S['classes'] ?? [], fn($k, $id) => $id !== $cid, ARRAY_FILTER_USE_BOTH);
  if ($others) $L[] = '- Other classes they asked you about: ' . implode('; ', array_map(fn($k) => ($k['name'] ?? '') . (!empty($k['weakest']) ? ' (weakest: ' . implode(', ', array_slice($k['weakest'], 0, 2)) . ')' : ''), array_slice($others, -5)));
  $mem = $S['memory']['chat'][$cid]['summary'] ?? '';
  if ($mem !== '') $L[] = "- EARLIER IN YOUR CHATS ABOUT THIS CLASS (a summary; those older messages are not shown):\n  " . str_replace("\n", "\n  ", $mem);
  $calls = array_slice(array_values(array_filter($S['calls'] ?? [], fn($c) => ($c['cid'] ?? '') === $cid || $cid === '')), -2);
  foreach ($calls as $c) $L[] = '- A call on ' . gmdate('M j', (int)($c['at'] ?? 0)) . ': ' . ($c['line'] ?? '');
  $pics = array_slice($S['pictures'] ?? [], -3); if ($pics) $L[] = '- Pictures you made for them lately: ' . implode('; ', array_map(fn($x) => $x['what'] ?? '', $pics));
  return count($L) > 1 ? implode("\n", $L) : '';
}
/** A line for the image model: the class and what helps this student. */
function mh_student_image_context(array $u, string $cid, array $cfg): string {
  $S = mh_student_load((int)$u['id']); $k = $cid !== '' ? ($S['classes'][$cid] ?? null) : null;
  $bits = [];
  if ($k && !empty($k['name'])) $bits[] = 'it is for their class ' . $k['name'];
  // only notes about how they learn, and never one that could name them (the privacy policy promises no name or email)
  $first = (string)($S['student']['name'] ?? ''); $named = fn($n) => preg_match('/\b(name|called|call me|nickname)\b|@|\d{3}/i', $n) || ($first !== '' && mb_stripos($n, $first) !== false);
  $prefs = array_filter($S['notes'] ?? [], fn($n) => preg_match('/visual|picture|diagram|colou?r|simple|detail|learn|prefer|like/i', (string)$n) && !$named((string)$n));
  if ($prefs) $bits[] = 'about how they learn: ' . implode('; ', array_slice($prefs, 0, 2));
  return mh_ai_plain(implode('; ', $bits), 300);
}
function mh_student_note_image(array $u, string $cid, string $prompt): void {
  $uid = (int)$u['id']; $S = mh_student_load($uid); $S['pictures'][] = ['at' => time(), 'cid' => $cid, 'what' => mh_ai_plain($prompt, 120)]; mh_student_save($uid, $S);
}
function mh_student_note_call(array $u, string $cid, string $line): void {
  $uid = (int)$u['id']; $S = mh_student_load($uid); $S['calls'][] = ['at' => time(), 'cid' => $cid, 'line' => mh_ai_plain($line, 300)]; mh_student_save($uid, $S);
}

/* ---------- compaction ---------- */
const MH_STUDENT_SUM = <<<'TXT'
You keep the running memory of a tutor (Bo) and one student. Fold the OLDER MESSAGES into the SUMMARY SO FAR and write the new summary: under 220 words, plain text, short lines. Keep what matters for tutoring them next: what they worked on and where they got to, what they got wrong and why, what finally clicked, how they like to be taught, anything they asked to do next, and open questions. Drop greetings, small talk and the full worked math (keep only the results that matter). Write about the student in the third person. Never invent anything.
TXT;
/** A summary of $old turns ([r, t]) folded into $prev, by the cheap model; '' when it could not be made. */
function mh_student_summarize(array $u, array $cfg, string $prev, array $old, string $what): string {
  $A = mh_ai_settings($cfg); if ($A['key'] === '' || !$old) return $prev;
  $lines = []; foreach ($old as $t) { $who = ($t['r'] ?? '') === 'b' ? 'Bo' : 'Student'; $txt = mh_ai_clip(mh_ai_unboard((string)($t['t'] ?? '')), 700); if ($txt !== '') $lines[] = "$who: $txt"; }
  if (!$lines) return $prev;
  require_once __DIR__ . '/credits.php'; $X = $GLOBALS['mh_credit_ctx'] ?? null; mh_credits_for($u, $cfg, 'memory', $what);
  try {
    $r = mh_ai_call($A, $A['tutor_model'], [['type' => 'text', 'text' => MH_STUDENT_SUM]], [['role' => 'user', 'content' => "SUMMARY SO FAR:\n" . ($prev !== '' ? $prev : '(none yet)') . "\n\nOLDER MESSAGES:\n" . implode("\n", $lines)]], 600, 45);
    $out = trim((string)$r['text']); return $out !== '' ? mb_substr($out, 0, MH_STUDENT_SUMMARY_CHARS) : $prev;
  } catch (Throwable $e) { return $prev; }
  finally { $GLOBALS['mh_credit_ctx'] = $X; }
}
/** After a chat answer: the turns piled up behind the window become part of the class's summary. */
function mh_student_compact_chat(array $u, array $cfg, string $cid): void {
  $uid = (int)$u['id']; $turns = mh_ai_turns($uid, $cid); $S = mh_student_load($uid);
  $m = $S['memory']['chat'][$cid] ?? ['summary' => '', 'upto' => 0];
  $behind = array_values(array_filter(array_slice($turns, 0, max(0, count($turns) - MH_AI_TURNS_SENT)), fn($t) => (int)($t['at'] ?? 0) > (int)$m['upto']));
  if (count($behind) < MH_STUDENT_COMPACT_AT) return;
  $sum = mh_student_summarize($u, $cfg, (string)$m['summary'], $behind, mh_ai_class_name(mh_ai_class($u, $cid), $cid) . ' · summary of a long chat');
  if ($sum === '' || $sum === $m['summary']) return;
  $S = mh_student_load($uid); $S['memory']['chat'][$cid] = ['summary' => $sum, 'upto' => (int)(end($behind)['at'] ?? time()), 'at' => time()]; mh_student_save($uid, $S);
}
/** The summary block for a chat request, and whether older turns are folded into it. */
function mh_student_chat_memory(int $uid, string $cid): string { $S = mh_student_load($uid); return (string)($S['memory']['chat'][$cid]['summary'] ?? ''); }

function mh_student_route(string $route, array $in, array $cfg): void {
  switch ($route) {
    case 'ai_compact': {   // a long call: its older messages in, a summary out (assets/talk.js puts it in the call)
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id'];
      mh_rate_or_fail("ai_compact:$uid", 20, 3600, 'Too many summaries in an hour.');
      $cid = mh_ai_cid($in['class'] ?? ''); $items = is_array($in['items'] ?? null) ? array_slice($in['items'], 0, 80) : [];
      $old = array_values(array_filter(array_map(fn($x) => is_array($x) ? ['r' => ($x['r'] ?? '') === 'b' ? 'b' : 'u', 't' => mh_ai_clip((string)($x['t'] ?? ''), 900)] : null, $items), fn($x) => $x && $x['t'] !== ''));
      if (count($old) < 4) mh_json(['ok' => true, 'summary' => '']);
      $prev = mh_ai_clip((string)($in['summary'] ?? ''), MH_STUDENT_SUMMARY_CHARS);
      require_once __DIR__ . '/credits.php'; mh_credits_need($u, 200, $cfg, 'keeping the call’s memory short');
      $sum = mh_student_summarize($u, $cfg, $prev, $old, mh_ai_class_name(mh_ai_class($u, $cid), $cid) . ' · summary of a long call');
      if ($sum !== '' && $sum !== $prev) { $S = mh_student_load($uid); $S['memory']['calls'][] = ['at' => time(), 'cid' => $cid, 'summary' => $sum]; mh_student_save($uid, $S); }
      mh_json(['ok' => true, 'summary' => $sum]);
    }
    case 'ai_student': {   // their whole file (the i sheet in Ask Bo), or cleared
      $u = mh_require_user(); $uid = (int)$u['id'];
      if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        mh_method('POST'); $what = (string)($in['what'] ?? '');
        $S = mh_student_load($uid);
        if ($what === 'memory') $S['memory'] = ['chat' => [], 'calls' => []];
        elseif ($what === 'all') $S = mh_student_blank();
        else mh_fail('Nothing to clear.', 400);
        mh_student_save($uid, $S); mh_json(['ok' => true, 'file' => $S]);
      }
      mh_method('GET'); mh_json(['ok' => true, 'file' => mh_student_load($uid)]);
    }
  }
  mh_fail('Not found.', 404);
}
