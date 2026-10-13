<?php
/* ============================================================
   Mathub account server — Bo, the AI tutor, and "Bo writes my class" (Mathub Max)
   Routes: ai_status, ai_thread, ai_tutor, ai_forget, ai_class
   - Only Mathub Max members (and accounts listed in plan_grants) can use it; the plan is checked here.
   - This server is the only thing that talks to the AI (Anthropic's API; the key lives in config.local.php),
     and it keeps every request small so it costs as little as possible:
       * each class is turned into a compact text summary: its facts, grading, exams and one line per
         topic (from api/classdata/*.json for the built-in classes, packs/*.mathub.json, or the student's
         own class saved with their account);
       * the student's progress comes from the device as a short snapshot and is trimmed again here;
       * Bo's chat is kept here: only the last few turns go to the AI, plus up to 12 short notes Bo saved;
       * the parts that do not change (Bo's instructions, the class summary) are marked for prompt caching;
       * a class from a syllabus is written in steps: the syllabus is read once into an outline that is
         kept here, then each unit is written from that outline instead of the whole syllabus again.
   - The smallest model that does the job well: claude-haiku-5-5 by default (ai_model_tutor, ai_model_class).
   - Monthly limits per account (ai_tutor_monthly, ai_class_monthly) and per-minute rate limits.
   Rows are removed with the account (ON DELETE CASCADE).
   ============================================================ */

require_once __DIR__ . '/myclasses.php';

const MH_AI_TURNS_SENT = 6;      // chat turns sent to the AI with each question
const MH_AI_TURNS_KEPT = 40;     // chat turns kept for the screen
const MH_AI_NOTES = 12;          // notes Bo keeps about a student
const MH_AI_FILE_BYTES = 7000000; // a syllabus file (PDF or photo)
const MH_AI_IMAGE_BYTES = 2500000; // a photo in the chat

function mh_ai_db(): PDO {
  static $ready = false; $db = mh_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS ai_usage (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, ym TEXT NOT NULL, tutor INTEGER NOT NULL DEFAULT 0, classes INTEGER NOT NULL DEFAULT 0, tin INTEGER NOT NULL DEFAULT 0, tout INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, ym))');
    $db->exec('CREATE TABLE IF NOT EXISTS ai_threads (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cid TEXT NOT NULL, turns TEXT NOT NULL DEFAULT "[]", updated INTEGER NOT NULL, PRIMARY KEY (user_id, cid))');
    $db->exec('CREATE TABLE IF NOT EXISTS ai_notes (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, notes TEXT NOT NULL DEFAULT "[]", updated INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS ai_builds (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created INTEGER NOT NULL, outline TEXT NOT NULL, units INTEGER NOT NULL, steps INTEGER NOT NULL DEFAULT 0)');
    $ready = true;
  }
  return $db;
}

/** Rows whose account is gone, and class builds older than a day. */
function mh_ai_prune(): int {
  $db = mh_ai_db(); $n = 0;
  foreach (['ai_usage', 'ai_threads', 'ai_notes', 'ai_builds'] as $t) $n += (int)$db->exec("DELETE FROM $t WHERE user_id NOT IN (SELECT id FROM users)");
  $n += (int)$db->exec('DELETE FROM ai_builds WHERE created < ' . (time() - 86400));
  return $n;
}

function mh_ai_settings(array $cfg): array {
  return [
    'key' => trim((string)($cfg['anthropic_key'] ?? '')),
    'url' => (string)($cfg['anthropic_api'] ?? 'https://api.anthropic.com/v1/messages'),
    'tutor_model' => (string)($cfg['ai_model_tutor'] ?? 'claude-haiku-5-5'),
    'class_model' => (string)($cfg['ai_model_class'] ?? 'claude-haiku-5-5'),
    'tutor_monthly' => max(0, (int)($cfg['ai_tutor_monthly'] ?? 1500)),
    'class_monthly' => max(0, (int)($cfg['ai_class_monthly'] ?? 15)),
    'tutor_daily' => max(1, (int)($cfg['ai_tutor_daily'] ?? 300)),
  ];
}

/* ---------- usage ---------- */
function mh_ai_usage(int $uid): array {
  $st = mh_ai_db()->prepare('SELECT tutor, classes FROM ai_usage WHERE user_id = ? AND ym = ?'); $st->execute([$uid, gmdate('Y-m')]); $r = $st->fetch();
  return ['tutor' => $r ? (int)$r['tutor'] : 0, 'classes' => $r ? (int)$r['classes'] : 0];
}
function mh_ai_count(int $uid, string $what, int $tin, int $tout): void {
  $col = $what === 'classes' ? 'classes' : ($what === 'tutor' ? 'tutor' : '');
  $db = mh_ai_db(); $db->prepare('INSERT OR IGNORE INTO ai_usage (user_id, ym) VALUES (?, ?)')->execute([$uid, gmdate('Y-m')]);
  $db->prepare('UPDATE ai_usage SET ' . ($col ? "$col = $col + 1, " : '') . 'tin = tin + ?, tout = tout + ? WHERE user_id = ? AND ym = ?')->execute([$tin, $tout, $uid, gmdate('Y-m')]);
}

/* ---------- talking to the AI ---------- */
/** One request to Anthropic's Messages API. Returns text, why it stopped, and the tokens used. */
function mh_ai_call(array $A, string $model, array $system, array $messages, int $maxTokens, int $timeout): array {
  if ($A['key'] === '') mh_fail('Bo is not switched on yet. Please try again later.', 503);
  if (!function_exists('curl_init')) mh_fail('Bo cannot reach the AI from this server.', 503);
  $body = json_encode(['model' => $model, 'max_tokens' => $maxTokens, 'system' => $system, 'messages' => $messages], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  $ch = curl_init($A['url']);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_HTTPHEADER => ['x-api-key: ' . $A['key'], 'anthropic-version: 2023-06-01', 'content-type: application/json', 'accept: application/json']]);
  $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_errno($ch); curl_close($ch);
  if ($raw === false) mh_fail($err === CURLE_OPERATION_TIMEDOUT ? 'Bo took too long to answer. Please try again.' : 'Bo could not be reached. Please try again in a minute.', 504);
  $j = json_decode((string)$raw, true);
  if ($code === 429 || $code === 529 || $code === 503) mh_fail('Bo is very busy right now. Please try again in a minute.', 503);
  if ($code === 413) mh_fail('That is too much for Bo to read at once. Try a shorter text or a smaller file.', 413);
  if ($code < 200 || $code >= 300 || !is_array($j)) { error_log('mathub ai: ' . $code . ' ' . substr((string)$raw, 0, 300)); mh_fail($code === 400 ? 'Bo could not read that. Try a different file, or paste the text instead.' : 'Bo could not answer just now. Please try again.', 502); }
  $text = ''; foreach (($j['content'] ?? []) as $b) if (($b['type'] ?? '') === 'text') $text .= (string)$b['text'];
  $u = $j['usage'] ?? [];
  return ['text' => $text, 'stop' => (string)($j['stop_reason'] ?? ''), 'in' => (int)($u['input_tokens'] ?? 0) + (int)($u['cache_creation_input_tokens'] ?? 0) + (int)($u['cache_read_input_tokens'] ?? 0), 'out' => (int)($u['output_tokens'] ?? 0)];
}

/** The JSON object in a reply: inside a ```json block, or the outermost braces. */
function mh_ai_json(string $t): ?array {
  if (preg_match('/```(?:json)?\s*(\{[\s\S]*\})\s*```/i', $t, $m)) $t = $m[1];
  $a = strpos($t, '{'); $b = strrpos($t, '}'); if ($a === false || $b === false || $b <= $a) return null;
  $s = substr($t, $a, $b - $a + 1); $j = json_decode($s, true);
  if (!is_array($j)) $j = json_decode(preg_replace('/,(\s*[}\]])/', '$1', $s), true);
  return is_array($j) ? $j : null;
}

/* ---------- compact class summaries ---------- */
function mh_ai_plain($v, int $max = 0): string {
  $s = is_string($v) ? $v : (is_numeric($v) ? (string)$v : '');
  $s = html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '</li>', '</p>'], ' ', $s)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $s = trim(preg_replace('/\s+/u', ' ', $s));
  if ($max > 0 && mb_strlen($s) > $max) $s = rtrim(mb_substr($s, 0, $max - 1)) . '…';
  return $s;
}

/** Text the student typed or Bo wrote: kept as is (math like x < 3 included), without control characters, cut to $max. */
function mh_ai_clip($v, int $max): string {
  $s = is_string($v) ? $v : ''; $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s); $s = trim(preg_replace("/[ \t]+/u", ' ', preg_replace("/\n{3,}/", "\n\n", str_replace("\r", '', $s))));
  return mb_strlen($s) > $max ? rtrim(mb_substr($s, 0, $max - 1)) . '…' : $s;
}

/** The class as Mathub knows it: built-in (api/classdata), a class pack, or one the student made. */
function mh_ai_class(array $u, string $cid): ?array {
  if (preg_match('/^my\d{4,6}$/', $cid)) {
    $st = mh_myclass_db()->prepare('SELECT pack FROM my_classes WHERE user_id = ? AND cid = ?'); $st->execute([$u['id'], $cid]); $p = $st->fetchColumn();
    $j = $p ? json_decode((string)$p, true) : null; return is_array($j) ? $j : null;
  }
  if (!preg_match('/^[a-z0-9][a-z0-9_-]{0,40}$/', $cid)) return null;
  foreach ([__DIR__ . "/classdata/$cid.json", dirname(__DIR__) . "/packs/$cid.mathub.json"] as $f) {
    if (is_file($f)) { $j = json_decode((string)file_get_contents($f), true); if (is_array($j)) return $j; }
  }
  return null;
}

/** About 1,500 tokens for a whole class: facts, grading, exams, then every unit with one line per topic. */
function mh_ai_digest(array $C): string {
  $co = is_array($C['COURSE'] ?? null) ? $C['COURSE'] : [];
  $L = [];
  $L[] = 'CLASS: ' . mh_ai_plain($C['code'] ?? ($co['code'] ?? ''), 30) . ' ' . mh_ai_plain($C['name'] ?? ($co['name'] ?? ''), 80) . ' (' . mh_ai_plain($C['term'] ?? ($co['term'] ?? ''), 20) . (!empty($co['school']) ? ', ' . mh_ai_plain($co['school'], 40) : '') . ')';
  $who = !empty($co['instructor']) ? mh_ai_plain($co['instructor'], 60) : (is_array($co['instructors'] ?? null) ? implode(', ', array_map(fn($i) => mh_ai_plain(is_array($i) ? ($i['name'] ?? '') : $i, 40), array_slice($co['instructors'], 0, 3))) : '');
  if ($who !== '') $L[] = 'INSTRUCTOR: ' . $who . (!empty($co['officeHours']) ? ' | OFFICE HOURS: ' . mh_ai_plain($co['officeHours'], 100) : '');
  $meets = mh_ai_plain($co['lectures'] ?? ($co['meets'] ?? ($co['classDays'] ?? '')), 100); if ($meets !== '') $L[] = 'MEETS: ' . $meets;
  if (!empty($co['textbook'])) $L[] = 'TEXTBOOK: ' . mh_ai_plain(is_array($co['textbook']) ? ($co['textbook']['title'] ?? '') : $co['textbook'], 90);
  $G = is_array($C['GRADING'] ?? null) ? $C['GRADING'] : [];
  if (!empty($G['categories']) && is_array($G['categories'])) $L[] = 'GRADING: ' . implode('; ', array_map(fn($c) => mh_ai_plain($c['name'] ?? '', 45) . ' ' . (0 + ($c['weight'] ?? 0)) . '%', array_slice($G['categories'], 0, 14)));
  if (!empty($G['scale']) && is_array($G['scale'])) $L[] = 'SCALE: ' . implode(', ', array_map(fn($x) => mh_ai_plain($x['letter'] ?? '', 3) . '≥' . (0 + ($x['min'] ?? 0)), array_slice($G['scale'], 0, 13)));
  $ex = array_values(array_filter(is_array($C['EXAMS'] ?? null) ? $C['EXAMS'] : [], 'is_array'));
  if ($ex) $L[] = 'EXAMS: ' . implode(' | ', array_map(fn($e) => mh_ai_plain($e['name'] ?? '', 30) . ' ' . mh_ai_plain($e['date'] ?? '', 10) . ' (' . mh_ai_plain($e['covers'] ?? '', 70) . (!empty($e['weight']) ? '; ' . $e['weight'] . '%' : '') . ')', array_slice($ex, 0, 8)));
  $secs = []; foreach ((is_array($C['SECTIONS'] ?? null) ? $C['SECTIONS'] : []) as $s) if (is_array($s) && isset($s['id'])) $secs[(string)$s['id']] = $s;
  $units = is_array($C['UNITS'] ?? null) ? $C['UNITS'] : [];
  if ($units) {
    $L[] = 'TOPICS (in class order; each with its first idea):';
    foreach (array_slice($units, 0, 16) as $u) {
      if (!is_array($u)) continue;
      $exName = ''; foreach ($ex as $e) if (($e['id'] ?? '') === ($u['exam'] ?? null)) $exName = ' [' . mh_ai_plain($e['name'] ?? '', 30) . ']';
      $L[] = 'U' . (int)($u['n'] ?? 0) . ' ' . mh_ai_plain($u['title'] ?? '', 70) . $exName;
      foreach (array_slice(is_array($u['sections'] ?? null) ? $u['sections'] : [], 0, 20) as $sid) {
        $s = $secs[(string)$sid] ?? null; if (!$s) continue;
        $first = is_array($s['ideas'] ?? null) && $s['ideas'] ? $s['ideas'][0] : ($s['about'] ?? '');
        $label = (string)($s['label'] ?? (preg_match('/^\d+(\.\d+)*$/', (string)$s['id']) ? $s['id'] : ''));
        $L[] = '- ' . trim(mh_ai_plain($label, 10) . ' ' . mh_ai_plain($s['title'] ?? '', 70)) . ($first ? ': ' . mh_ai_plain($first, 110) : '');
      }
    }
  }
  return implode("\n", $L);
}

/** What happens in the class in the next two weeks (changes daily, so it is not cached). */
function mh_ai_upcoming(array $C, string $today): string {
  $end = gmdate('Y-m-d', strtotime($today . ' +14 days')); $rows = [];
  foreach ((is_array($C['CALENDAR'] ?? null) ? $C['CALENDAR'] : []) as $r) {
    if (!is_array($r) || !isset($r[0]) || !is_string($r[0])) continue; if ($r[0] < $today || $r[0] > $end) continue;
    $rows[] = substr($r[0], 5) . ' ' . mh_ai_plain($r[1] ?? '', 10) . ' ' . mh_ai_plain($r[2] ?? '', 60); if (count($rows) >= 12) break;
  }
  return $rows ? 'NEXT TWO WEEKS: ' . implode('; ', $rows) : '';
}

/** The student's progress, as sent by their device, cut down to a few short lines. */
function mh_ai_snapshot($s): string {
  if (!is_array($s)) return '';
  $p = fn($v, $n) => mh_ai_plain($v, $n); $L = [];
  $who = []; if (!empty($s['name'])) $who[] = 'name ' . $p($s['name'], 30); if (isset($s['streak'])) $who[] = 'streak ' . (int)$s['streak'] . ' days'; if (isset($s['xpToday'])) $who[] = 'XP today ' . (int)$s['xpToday'] . '/' . (int)($s['goal'] ?? 30); if (!empty($s['page'])) $who[] = 'now on ' . $p($s['page'], 50);
  if ($who) $L[] = 'STUDENT: ' . implode(', ', $who);
  if (is_array($s['readiness'] ?? null)) { $r = $s['readiness']; $L[] = 'READINESS: ' . $p($r['exam'] ?? '', 30) . ' on ' . $p($r['date'] ?? '', 10) . ' (' . (int)($r['days'] ?? 0) . ' days): ' . (int)($r['score'] ?? 0) . '% ' . $p($r['label'] ?? '', 20) . (isset($r['checklist']) ? ', prep checklist ' . $p($r['checklist'], 10) : ''); }
  $topic = fn($t) => $p($t['t'] ?? '', 50) . ' ' . (isset($t['acc']) ? round(100 * (float)$t['acc']) . '% right of ' . (int)($t['n'] ?? 0) : 'not practised');
  if (!empty($s['weak']) && is_array($s['weak'])) $L[] = 'WEAKEST TOPICS: ' . implode('; ', array_map($topic, array_slice($s['weak'], 0, 6)));
  if (!empty($s['strong']) && is_array($s['strong'])) $L[] = 'STRONG: ' . implode('; ', array_map(fn($x) => $p($x, 40), array_slice($s['strong'], 0, 4)));
  if (!empty($s['missed']) && is_array($s['missed'])) { $L[] = 'RECENTLY MISSED:'; foreach (array_slice($s['missed'], 0, 5) as $m) if (is_array($m)) $L[] = '- [' . $p($m['t'] ?? '', 30) . '] ' . $p($m['q'] ?? '', 140) . ' | they said ' . $p($m['a'] ?? '', 40) . ' | answer ' . $p($m['c'] ?? '', 40); }
  $nums = []; if (isset($s['due'])) $nums[] = (int)$s['due'] . ' flashcards due'; if (isset($s['mistakes'])) $nums[] = (int)$s['mistakes'] . ' missed questions to retry'; if ($nums) $L[] = 'TO DO: ' . implode(', ', $nums);
  if (!empty($s['grades']) && is_array($s['grades'])) $L[] = 'GRADES SO FAR: ' . implode('; ', array_map(fn($g) => $p($g['c'] ?? '', 30) . ' ' . $p($g['s'] ?? '', 10), array_slice($s['grades'], 0, 8)));
  if (!empty($s['deadlines']) && is_array($s['deadlines'])) $L[] = 'DUE SOON (all classes): ' . implode('; ', array_map(fn($d) => $p($d['d'] ?? '', 10) . ' ' . $p($d['t'] ?? '', 50), array_slice($s['deadlines'], 0, 6)));
  if (!empty($s['others']) && is_array($s['others'])) $L[] = 'OTHER CLASSES: ' . implode('; ', array_map(fn($o) => $p($o['c'] ?? '', 20) . ($o['ex'] ?? '' ? ' ' . $p($o['ex'], 25) . ' in ' . (int)($o['days'] ?? 0) . ' days' : ''), array_slice($s['others'], 0, 5)));
  return implode("\n", $L);
}

const MH_AI_BO = <<<'TXT'
You are Bo, the bobcat who tutors students on Mathub, a study app for Montana State University students. You talk with one student. Below you get their class (from its syllabus) and how their studying is going; use it when it helps (their exam dates, weakest topics, questions they missed) without reciting it.
How you help:
- Warm, direct, brief: short paragraphs, under about 150 words unless they ask for more or a worked solution needs it.
- Teach, don't just tell: check what they know, give a hint first on problems, then the full worked solution if they ask or stay stuck. Often end with one short question or a quick practice problem.
- Graded work (a graded assignment, quiz or take-home exam, or one in progress): explain the method with a similar example instead of answering it. Never help during an exam.
- Use the class facts exactly. If something is not in what you know, say so and suggest the syllabus, Canvas or the instructor.
- Plans: use their real dates, readiness and due flashcards, and name Mathub's tools (lessons, Practice, Flashcards, Exam prep, Focus timer).
- Math in LaTeX between $...$ or $$...$$. Otherwise plain text; **bold** and "- " lists are fine.
- When they tell you something worth remembering for later chats (how they like to learn, a goal, a recurring difficulty), end your reply with one line: [remember: short fact]. Never store sensitive personal details.
- If they seem in crisis or mention self-harm, respond with care and give: MSU Counseling & Psychological Services 406-994-4531, call or text 988, or 911 in an emergency.
- Stay on studying, their classes and student life. Decline harmful requests. No medical, legal or financial advice. You are an AI and can be wrong; say when you are unsure.
TXT;

/* ---------- Bo's chat and notes ---------- */
function mh_ai_turns(int $uid, string $cid): array {
  $st = mh_ai_db()->prepare('SELECT turns FROM ai_threads WHERE user_id = ? AND cid = ?'); $st->execute([$uid, $cid]); $j = json_decode((string)$st->fetchColumn(), true);
  return is_array($j) ? $j : [];
}
function mh_ai_save_turns(int $uid, string $cid, array $turns): void {
  $turns = array_slice($turns, -MH_AI_TURNS_KEPT);
  mh_ai_db()->prepare('INSERT INTO ai_threads (user_id, cid, turns, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, cid) DO UPDATE SET turns = excluded.turns, updated = excluded.updated')->execute([$uid, $cid, json_encode($turns, JSON_UNESCAPED_UNICODE), time()]);
}
function mh_ai_notes(int $uid): array {
  $st = mh_ai_db()->prepare('SELECT notes FROM ai_notes WHERE user_id = ?'); $st->execute([$uid]); $j = json_decode((string)$st->fetchColumn(), true);
  return is_array($j) ? array_values(array_filter($j, 'is_string')) : [];
}
function mh_ai_save_notes(int $uid, array $notes): void {
  mh_ai_db()->prepare('INSERT INTO ai_notes (user_id, notes, updated) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET notes = excluded.notes, updated = excluded.updated')->execute([$uid, json_encode(array_slice(array_values($notes), -MH_AI_NOTES), JSON_UNESCAPED_UNICODE), time()]);
}
function mh_ai_cid($v): string { $c = is_string($v) ? strtolower(trim($v)) : ''; if (!preg_match('/^[a-z0-9][a-z0-9_-]{0,40}$/', $c)) mh_fail('Pick a class first.', 400); return $c; }

/** A file sent as base64: checked against the types the AI reads and the size limit. */
function mh_ai_file($f, array $types, int $max): ?array {
  if (!is_array($f)) return null;
  $type = strtolower((string)($f['type'] ?? '')); if (!in_array($type, $types, true)) mh_fail('Bo reads PDFs, photos (JPEG, PNG, WebP) and plain text.', 400);
  $data = preg_replace('/\s+/', '', (string)($f['data'] ?? '')); if ($data === '' || !preg_match('/^[A-Za-z0-9+\/]+=*$/', $data)) mh_fail('That file could not be read.', 400);
  if ((int)(strlen($data) * 3 / 4) > $max) mh_fail('That file is too large. Keep it under ' . round($max / 1e6) . ' MB.', 413);
  return ['type' => $type, 'data' => $data];
}

/* ---------- writing a class from a syllabus ---------- */
const MH_AI_CLASS_SYS = <<<'TXT'
You turn a college course syllabus into a study class for Mathub, a study app for Montana State University students. Reply with ONE JSON object in a ```json code block and nothing else. Strings are plain text (no HTML, no Markdown); write math as LaTeX between $ signs and double every backslash. Copy names, dates and numbers from the syllabus exactly; never invent a date.
TXT;

function mh_ai_sizes(string $size): array {
  return $size === 'short' ? ['sections' => '6 to 10', 'ideas' => '2 or 3', 'cards' => 3, 'questions' => 4] : ['sections' => '8 to 16', 'ideas' => '3 to 5', 'cards' => 5, 'questions' => 6];
}
function mh_ai_outline_prompt(array $Z): string {
  return <<<TXT
Read the syllabus and write the class's facts and structure as this JSON (ids use lowercase letters, digits and dashes):
{"code":"CHMY 121","name":"…","term":"Fall 2026","color":{"light":"#0F766E"},
"COURSE":{"code":"…","name":"…","term":"…","school":"…","instructor":"…","instructorEmail":"…","officeHours":"…","lectures":"…","textbook":{"title":"…","url":""},"deadlines":[{"name":"…","rule":"…"}]},
"GRADING":{"categories":[{"id":"hw","name":"Homework","weight":20}],"scale":[{"letter":"A","min":93}]},
"SEMESTER":{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"},
"EXAMS":[{"id":"exam1","name":"Exam 1","date":"YYYY-MM-DD","covers":"Units 1 and 2","units":[1,2],"weight":15}],
"CALENDAR":[["YYYY-MM-DD","lecture","Atoms and isotopes","atoms"]],
"UNITS":[{"n":1,"title":"…","sections":["atoms"],"exam":"exam1"}],
"SECTIONS":[{"id":"atoms","label":"1.1","title":"Atoms and isotopes","unit":1,"about":"one sentence on what this topic covers"}]}
Rules: {$Z['sections']} SECTIONS in total, one per main topic, grouped in UNITS (one unit per exam period when the course has exams). An exam with no date in the syllabus goes in COURSE.deadlines, not EXAMS. CALENDAR types: lecture, lab, exam, review, holiday, admin (deadlines); include every exam, holiday and deadline, and one lecture row per topic when there is a schedule. GRADING weights add up to 100; use the syllabus's own letter scale when it has one. Leave out an exam's weight when the syllabus does not give it. color.light is a deep colour that white text can sit on.
TXT;
}
function mh_ai_unit_prompt(array $O, int $n, array $Z): string {
  $lines = ['CLASS: ' . mh_ai_plain($O['code'] ?? '', 30) . ' ' . mh_ai_plain($O['name'] ?? '', 80)];
  $secs = []; foreach ((array)($O['SECTIONS'] ?? []) as $s) if (is_array($s) && isset($s['id'])) $secs[(string)$s['id']] = $s;
  $unit = null; foreach ((array)($O['UNITS'] ?? []) as $u) if (is_array($u) && (int)($u['n'] ?? 0) === $n) $unit = $u;
  if (!$unit) mh_fail('That unit is not in the outline.', 400);
  foreach ((array)($O['UNITS'] ?? []) as $u) { if (!is_array($u)) continue; $lines[] = 'U' . (int)($u['n'] ?? 0) . ' ' . mh_ai_plain($u['title'] ?? '', 70) . ': ' . implode(', ', array_map(fn($id) => mh_ai_plain(($secs[(string)$id]['title'] ?? $id), 50), (array)($u['sections'] ?? []))); }
  $mine = []; foreach ((array)($unit['sections'] ?? []) as $id) { $s = $secs[(string)$id] ?? null; if ($s) $mine[] = '- ' . mh_ai_plain($s['id'], 40) . ' (' . mh_ai_plain($s['label'] ?? '', 10) . ' ' . mh_ai_plain($s['title'] ?? '', 70) . '): ' . mh_ai_plain($s['about'] ?? '', 160); }
  $outline = implode("\n", $lines); $list = implode("\n", $mine); $title = mh_ai_plain($unit['title'] ?? '', 70);
  return <<<TXT
The class outline:
$outline

Write the study material for unit $n "$title", these sections:
$list

Reply with this JSON:
{"SECTIONS":[{"id":"section id","ideas":["a short paragraph that teaches part of the topic"],"pitfalls":["a common mistake"],"example":{"p":"a problem","s":"its worked solution"}}],
"FLASHCARDS":[{"id":"c1","sec":"section id","f":"front","b":"back"}],
"QUIZ":{"questions":[{"topic":"section id","items":[["question","correct answer",["wrong","wrong","wrong"],"one-sentence explanation"]]}]}}
Per section: {$Z['ideas']} ideas, one or two pitfalls, an example when the subject has problems to solve, {$Z['cards']} flashcards and {$Z['questions']} questions. Accurate and at the level of the course. Wrong answers are plausible but clearly wrong, and a question never gives its answer away.
TXT;
}

/* ---------- routes ---------- */
function mh_ai_route(string $route, array $in, array $cfg, string $ip): void {
  $A = mh_ai_settings($cfg); $db = mh_ai_db();
  switch ($route) {
    case 'ai_status': {
      mh_method('GET'); $u = mh_current_user();
      $plan = $u ? mh_plan($u, $cfg) : '';
      $out = ['ok' => true, 'enabled' => $A['key'] !== '', 'signed_in' => (bool)$u, 'plan' => $plan, 'max' => $plan === 'max'];
      if ($u) { $use = mh_ai_usage((int)$u['id']); $out['usage'] = ['tutor' => $use['tutor'], 'tutor_limit' => $A['tutor_monthly'], 'classes' => $use['classes'], 'class_limit' => $A['class_monthly']]; $out['notes'] = mh_ai_notes((int)$u['id']); }
      mh_json($out);
    }
    case 'ai_thread': {
      mh_method('GET'); $u = mh_require_user(); $cid = mh_ai_cid($_GET['class'] ?? '');
      mh_json(['ok' => true, 'turns' => mh_ai_turns((int)$u['id'], $cid), 'notes' => mh_ai_notes((int)$u['id'])]);
    }
    case 'ai_forget': {
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id']; $what = (string)($in['what'] ?? '');
      if ($what === 'chat') { $db->prepare('DELETE FROM ai_threads WHERE user_id = ? AND cid = ?')->execute([$uid, mh_ai_cid($in['class'] ?? '')]); }
      elseif ($what === 'note') { $notes = mh_ai_notes($uid); $i = (int)($in['i'] ?? -1); if (isset($notes[$i])) { array_splice($notes, $i, 1); mh_ai_save_notes($uid, $notes); } }
      elseif ($what === 'notes') { $db->prepare('DELETE FROM ai_notes WHERE user_id = ?')->execute([$uid]); }
      elseif ($what === 'all') { foreach (['ai_threads', 'ai_notes'] as $t) $db->prepare("DELETE FROM $t WHERE user_id = ?")->execute([$uid]); }
      else mh_fail('Nothing to forget.', 400);
      mh_json(['ok' => true, 'notes' => mh_ai_notes($uid)]);
    }
    case 'ai_tutor': {
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id'];
      if (mh_plan($u, $cfg) !== 'max') mh_fail('Talking with Bo is part of Mathub Max.', 402, ['plan' => 'max']);
      $use = mh_ai_usage($uid); if ($use['tutor'] >= $A['tutor_monthly']) mh_fail('You have used this month\'s ' . $A['tutor_monthly'] . ' questions for Bo. They start again on the 1st.', 429);
      $cid = mh_ai_cid($in['class'] ?? ''); $q = mh_ai_clip($in['q'] ?? '', 2000);
      $img = isset($in['image']) ? mh_ai_file($in['image'], ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], MH_AI_IMAGE_BYTES) : null;
      if ($q === '' && !$img) mh_fail('Ask Bo something first.', 400);
      mh_rate_or_fail("ai_tutor:$uid", 12, 60, 'Slow down a little: Bo answers up to 12 questions a minute.');
      mh_rate_or_fail("ai_tutor_day:$uid", $A['tutor_daily'], 86400, 'That is a lot of questions for one day. Bo will be back tomorrow.');
      $C = mh_ai_class($u, $cid);
      $today = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($in['today'] ?? '')) ? (string)$in['today'] : gmdate('Y-m-d');
      $system = [['type' => 'text', 'text' => MH_AI_BO]];
      if ($C) $system[] = ['type' => 'text', 'text' => mh_ai_digest($C), 'cache_control' => ['type' => 'ephemeral']];
      else $system[0]['cache_control'] = ['type' => 'ephemeral'];
      $notes = mh_ai_notes($uid);
      $now = array_filter(['TODAY: ' . $today, $C ? mh_ai_upcoming($C, $today) : '', mh_ai_snapshot($in['snapshot'] ?? null), $notes ? "WHAT BO REMEMBERS ABOUT THEM:\n- " . implode("\n- ", $notes) : '']);
      $system[] = ['type' => 'text', 'text' => implode("\n", $now)];
      // the last few turns, oldest first, starting with the student
      $turns = mh_ai_turns($uid, $cid); $msgs = [];
      foreach (array_slice($turns, -MH_AI_TURNS_SENT) as $t) { $role = ($t['r'] ?? '') === 'b' ? 'assistant' : 'user'; $txt = mh_ai_clip($t['t'] ?? '', 900); if ($txt === '') continue; if ($msgs && end($msgs)['role'] === $role) { $msgs[count($msgs) - 1]['content'] .= "\n" . $txt; continue; } $msgs[] = ['role' => $role, 'content' => $txt]; }
      while ($msgs && $msgs[0]['role'] !== 'user') array_shift($msgs);
      if ($msgs && end($msgs)['role'] === 'user') array_pop($msgs);
      $content = []; if ($img) $content[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $img['type'], 'data' => $img['data']]];
      $content[] = ['type' => 'text', 'text' => $q !== '' ? $q : 'Can you help me with this?'];
      $msgs[] = ['role' => 'user', 'content' => $content];
      @set_time_limit(90);
      $r = mh_ai_call($A, $A['tutor_model'], $system, $msgs, 700, 60);
      $reply = trim($r['text']); $remembered = null;
      if (preg_match_all('/^\s*\[remember:\s*(.+?)\]\s*$/mi', $reply, $mm)) {
        foreach ($mm[1] as $fact) { $fact = mh_ai_clip($fact, 140); if ($fact !== '' && !in_array($fact, $notes, true)) { $notes[] = $fact; $remembered = $fact; } }
        mh_ai_save_notes($uid, $notes); $reply = trim(preg_replace('/^\s*\[remember:.*\]\s*$/mi', '', $reply));
      }
      if ($reply === '') $reply = 'Sorry, I lost my train of thought. Could you ask that again?';
      $turns[] = ['r' => 'u', 't' => ($img ? '[photo] ' : '') . $q, 'at' => time()]; $turns[] = ['r' => 'b', 't' => $reply, 'at' => time()];
      mh_ai_save_turns($uid, $cid, $turns); mh_ai_count($uid, 'tutor', $r['in'], $r['out']);
      mh_json(['ok' => true, 'reply' => $reply, 'remembered' => $remembered, 'cut' => $r['stop'] === 'max_tokens', 'usage' => ['tutor' => $use['tutor'] + 1, 'tutor_limit' => $A['tutor_monthly']]]);
    }
    case 'ai_class': {
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id'];
      if (mh_plan($u, $cfg) !== 'max') mh_fail('Having Bo write your class is part of Mathub Max.', 402, ['plan' => 'max']);
      mh_rate_or_fail("ai_class:$uid", 40, 3600, 'Bo is writing a lot of classes for you. Try again in a while.');
      $step = (string)($in['step'] ?? ''); $Z = mh_ai_sizes((string)($in['size'] ?? 'full'));
      @set_time_limit(200);
      if ($step === 'outline') {
        $use = mh_ai_usage($uid); if ($use['classes'] >= $A['class_monthly']) mh_fail('You have used this month\'s ' . $A['class_monthly'] . ' classes written by Bo. They start again on the 1st, and you can still make classes with your own AI.', 429);
        $S = is_array($in['syllabus'] ?? null) ? $in['syllabus'] : []; $text = trim((string)($S['text'] ?? ''));
        $file = isset($S['file']) ? mh_ai_file($S['file'], ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain'], MH_AI_FILE_BYTES) : null;
        if ($text === '' && !$file) mh_fail('Paste your syllabus or attach it first.', 400);
        if (mb_strlen($text) > 120000) mh_fail('That syllabus is very long. Paste the parts with the schedule, topics, exams and grading.', 413);
        $doc = [];
        if ($file && $file['type'] === 'application/pdf') $doc[] = ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $file['data']]];
        elseif ($file && $file['type'] === 'text/plain') $text = trim($text . "\n" . mb_substr((string)base64_decode($file['data']), 0, 120000));
        elseif ($file) $doc[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $file['type'], 'data' => $file['data']]];
        if ($text !== '') $doc[] = ['type' => 'text', 'text' => "THE SYLLABUS:\n" . $text];
        $doc[] = ['type' => 'text', 'text' => 'Today is ' . gmdate('Y-m-d') . ".\n" . mh_ai_outline_prompt($Z)];
        $r = mh_ai_call($A, $A['class_model'], [['type' => 'text', 'text' => MH_AI_CLASS_SYS]], [['role' => 'user', 'content' => $doc]], 8000, 170);
        $O = mh_ai_json($r['text']);
        if (!$O || empty($O['UNITS']) || empty($O['SECTIONS']) || !is_array($O['UNITS']) || !is_array($O['SECTIONS'])) { mh_ai_count($uid, '', $r['in'], $r['out']); mh_fail($r['stop'] === 'max_tokens' ? 'That syllabus made a very long outline. Choose "Shorter class" and try again.' : 'Bo could not find the topics and dates in that. Try the syllabus PDF itself, or paste its text.', 422); }
        $units = array_values(array_filter(array_map(fn($x) => is_array($x) ? (int)($x['n'] ?? 0) : 0, $O['UNITS'])));
        if (!$units || count($units) > 16 || count($O['SECTIONS']) > 40) mh_fail('That syllabus did not split into units Bo could use. Try pasting its schedule and topics.', 422);
        $id = bin2hex(random_bytes(12));
        $db->prepare('INSERT INTO ai_builds (id, user_id, created, outline, units) VALUES (?, ?, ?, ?, ?)')->execute([$id, $uid, time(), json_encode($O, JSON_UNESCAPED_UNICODE), count($units)]);
        mh_ai_count($uid, 'classes', $r['in'], $r['out']);
        mh_json(['ok' => true, 'build' => $id, 'outline' => $O, 'units' => $units]);
      }
      if ($step === 'unit') {
        $bid = preg_replace('/[^a-f0-9]/', '', (string)($in['build'] ?? '')); $n = (int)($in['unit'] ?? 0);
        $st = $db->prepare('SELECT * FROM ai_builds WHERE id = ? AND user_id = ?'); $st->execute([$bid, $uid]); $b = $st->fetch();
        if (!$b || (int)$b['created'] < time() - 3 * 3600) mh_fail('This class is no longer being written. Start again.', 404);
        if ((int)$b['steps'] >= 2 * (int)$b['units'] + 2) mh_fail('Bo has already written this class. Start a new one.', 429);
        $db->prepare('UPDATE ai_builds SET steps = steps + 1 WHERE id = ?')->execute([$bid]);
        $O = json_decode((string)$b['outline'], true);
        $r = mh_ai_call($A, $A['class_model'], [['type' => 'text', 'text' => MH_AI_CLASS_SYS]], [['role' => 'user', 'content' => mh_ai_unit_prompt($O, $n, $Z)]], 10000, 170);
        mh_ai_count($uid, '', $r['in'], $r['out']);
        $J = mh_ai_json($r['text']);
        if (!$J) mh_fail($r['stop'] === 'max_tokens' ? 'Unit ' . $n . ' came out too long. Choose "Shorter class" and try again.' : 'Bo stumbled writing unit ' . $n . '. Try again.', 422);
        mh_json(['ok' => true, 'unit' => $n, 'data' => $J]);
      }
      mh_fail('Unknown step.', 400);
    }
  }
  mh_fail('Not found.', 404);
}
