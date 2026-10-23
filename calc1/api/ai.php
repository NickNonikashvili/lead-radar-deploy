<?php
/* ============================================================
   Mathub account server — Bo, the AI tutor, talking with Bo out loud, and classes Bo writes from a syllabus
   Routes: ai_status, ai_thread, ai_tutor, ai_forget, ai_class, ai_speak, ai_listen, ai_live_start, ai_call_start, ai_live_tick, ai_live_log
   - Who can do what: any signed-in member can have Bo turn a syllabus into a class, which is checked first and then
     published for everyone (api/community.php). Everything else with Bo (asking him on any page or on his own page,
     talking out loud, calls, his pictures) works on any plan and is paid in credits (api/credits.php): each month's
     credits by plan, then credits bought. Max calls use the stronger model. (The free minutes, ai_trial, are retired;
     a call already on them when this changed finishes on them.)
   - This server is the only thing that talks to the AI (Anthropic's API; the key lives in config.local.php),
     and it keeps every request small so it costs as little as possible:
       * each class is turned into a compact text summary: its facts, grading, exams and one line per
         topic (from api/classdata/*.json for the built-in classes, packs/*.mathub.json, or the student's
         own class saved with their account);
       * the student's progress comes from the device as a short snapshot and is trimmed again here;
       * Bo's chat is kept here: only the last few turns go to the AI, plus up to 12 short notes Bo saved;
       * the parts that do not change (Bo's instructions, the class summary) are marked for prompt caching;
       * a class from a syllabus is written in steps: the syllabus is checked (is it a real course, and new
         to Mathub?) and read into an outline in two requests that share the cached syllabus, the outline is kept
         here, then each unit is written from that outline instead of the whole syllabus again (each unit is kept
         too, so the published class can be checked against what Bo wrote).
   - The smallest model that does the job well: claude-haiku-5-5 by default (ai_model_tutor, ai_model_class).
   - Answers can stream (stream: 1): the reply goes out line by line as JSON (NDJSON) while the AI writes it, so
     the chat fills in and Bo starts talking within a second or two. In voice mode (voice: 1) Bo answers the way
     a tutor talks, briefly and in words, and writes formulas on a whiteboard instead of reading them.
   - Bo's board: whatever he works out (the steps of a problem, a formula, the answer) he writes as a page of his
     whiteboard, a [board: Title] … [/board] block with step:, math:, answer:, tip:, text:, draw: and check: lines
     and ``` code blocks, which the website draws neatly beside the chat and on calls (on a call through his
     write_on_board, draw_on_board and ask_on_board tools). A draw: line is a picture as JSON: a graph (with
     tangent lines, Riemann sums and sliders the student drags), number line, figure, the unit circle, table, bar
     or pie chart, scatter plot with its best-fit line, box plot, normal curve, probability tree, Venn diagram or
     flow chart (MH_AI_DRAW; drawn by assets/board-draw.js). A check: line is a question the student answers on
     the board, and sees at once whether it's right.
   - The board on a call is the whole screen, shared (assets/bo-pad.js): the student writes on it and Bo sees it
     as a picture with a grid (columns A, B, C… across, rows 1, 2, 3… down): on a live call when they tap Show
     Bo and quietly as they write; in basic voice with their question (pad: {cols, rows}, MH_AI_PAD). He marks
     their writing at grid cells: mark_on_board on a live call, "mark: C3 circle note" lines otherwise.
   - How Bo teaches (MH_AI_TEACH, in the chat and voice instructions; calls have their own shorter rules in
     MH_AI_LIVE): what research on expert tutors and
     learning says works: find out where the student is, the big picture first, one idea at a time, concrete
     before abstract, a worked example and then fading, draw it, check with real questions, a hint ladder,
     mistakes as information, a different angle when it didn't land, close the loop. Sources: docs/bo-teaching.md.
   - Bo's natural voice and listening on any browser (optional, openai_key in config.local.php): ai_speak turns
     one or two of Bo's sentences into speech, ai_listen turns a short recording of the student into text. No
     audio is kept. Without the key the browser's own speech recognition and voices are used.
   - Live calls with Bo (optional, openai_key): a real-time voice conversation through OpenAI's Realtime API
     (speech to speech over WebRTC). The browser sends its connection offer here; this server adds Bo's
     instructions (his live persona, the class summary, the progress snapshot, his notes, the last few chat
     turns), sets the call up with OpenAI and returns the answer, so the key never reaches the browser. The
     browser reports the minutes (ai_live_tick); past a limit this server hangs the call up. What was said is
     saved in the chat (ai_live_log). Minutes per call, per day and per month: ai_live_call, _daily, _monthly.
     A dropped connection is rebuilt as the same call (resume: the call's id; the same row goes on with its minutes
     so far, the time it was down not counted, and Bo is told the call is back, MH_AI_LIVE_RESUME). What the student says is written down by ai_live_transcribe in
     their language, with the class's words as hints. See docs/bo-teaching.md, "Calls that hold up".
   - Monthly limits per account (ai_tutor_monthly, ai_class_monthly, ai_voice_monthly characters spoken,
     ai_listen_monthly seconds heard) and per-minute rate limits.
   Rows are removed with the account (ON DELETE CASCADE).
   ============================================================ */

require_once __DIR__ . '/myclasses.php';

const MH_AI_TURNS_SENT = 10;     // chat turns sent to the AI with each question; older ones are in the summary (api/students.php)
const MH_AI_TURNS_KEPT = 40;     // chat turns kept for the screen
const MH_AI_NOTES = 12;          // notes Bo keeps about a student
const MH_AI_FILE_BYTES = 7000000; // a syllabus file (PDF or photo)
const MH_AI_IMAGE_BYTES = 2500000; // a photo in the chat
const MH_AI_PDF_BYTES = 6500000;   // a problem set as a PDF in the chat
const MH_AI_SCREEN_CHARS = 9000;   // what is on the page the student asked from

function mh_ai_db(): PDO {
  static $ready = false; $db = mh_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS ai_usage (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, ym TEXT NOT NULL, tutor INTEGER NOT NULL DEFAULT 0, classes INTEGER NOT NULL DEFAULT 0, tin INTEGER NOT NULL DEFAULT 0, tout INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, ym))');
    $db->exec('CREATE TABLE IF NOT EXISTS ai_threads (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cid TEXT NOT NULL, turns TEXT NOT NULL DEFAULT "[]", updated INTEGER NOT NULL, PRIMARY KEY (user_id, cid))');
    $db->exec('CREATE TABLE IF NOT EXISTS ai_notes (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, notes TEXT NOT NULL DEFAULT "[]", updated INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS ai_builds (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created INTEGER NOT NULL, outline TEXT NOT NULL, units INTEGER NOT NULL, steps INTEGER NOT NULL DEFAULT 0)');
    $bc = array_column($db->query('PRAGMA table_info(ai_builds)')->fetchAll(), 'name');
    if (!in_array('screen', $bc, true)) $db->exec("ALTER TABLE ai_builds ADD COLUMN screen TEXT NOT NULL DEFAULT ''");          // what the check found: the course code, title, school and term
    if (!in_array('published', $bc, true)) $db->exec("ALTER TABLE ai_builds ADD COLUMN published TEXT NOT NULL DEFAULT ''");    // the pack id once it is on Mathub
    if (!in_array('req_code', $bc, true)) $db->exec("ALTER TABLE ai_builds ADD COLUMN req_code TEXT NOT NULL DEFAULT ''");      // built from a class request: its course code, so those who asked hear it is added
    $db->exec('CREATE TABLE IF NOT EXISTS ai_build_units (build TEXT NOT NULL, n INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (build, n))');   // each unit as Bo wrote it
    $cols = array_column($db->query('PRAGMA table_info(ai_usage)')->fetchAll(), 'name');
    if (!in_array('voice', $cols, true)) $db->exec('ALTER TABLE ai_usage ADD COLUMN voice INTEGER NOT NULL DEFAULT 0');     // characters Bo spoke
    if (!in_array('listen', $cols, true)) $db->exec('ALTER TABLE ai_usage ADD COLUMN listen INTEGER NOT NULL DEFAULT 0');   // seconds of the student heard
    if (!in_array('live', $cols, true)) $db->exec('ALTER TABLE ai_usage ADD COLUMN live INTEGER NOT NULL DEFAULT 0');       // seconds of live calls
    $db->exec('CREATE TABLE IF NOT EXISTS ai_trial (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, used INTEGER NOT NULL DEFAULT 0, first INTEGER NOT NULL DEFAULT 0)');   // the free minutes used
    $db->exec('CREATE TABLE IF NOT EXISTS ai_live (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cid TEXT NOT NULL DEFAULT "", call TEXT NOT NULL DEFAULT "", started INTEGER NOT NULL, last INTEGER NOT NULL, secs INTEGER NOT NULL DEFAULT 0, ended INTEGER NOT NULL DEFAULT 0)');
    $lc = array_column($db->query('PRAGMA table_info(ai_live)')->fetchAll(), 'name');
    if (!in_array('trial', $lc, true)) $db->exec('ALTER TABLE ai_live ADD COLUMN trial INTEGER NOT NULL DEFAULT 0');   // a call on the free minutes
    if (!in_array('rate', $lc, true)) $db->exec('ALTER TABLE ai_live ADD COLUMN rate REAL NOT NULL DEFAULT 0');   // credits a minute (api/credits.php)
    // answers a student marked as not right (the thumbs down under Bo's answers), for the admin's Bo quality tab
    $db->exec('CREATE TABLE IF NOT EXISTS ai_flags (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cid TEXT NOT NULL DEFAULT "", at INTEGER NOT NULL DEFAULT 0, q TEXT NOT NULL DEFAULT "", answer TEXT NOT NULL, why TEXT NOT NULL DEFAULT "", voice INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, status TEXT NOT NULL DEFAULT "open", UNIQUE (user_id, cid, at, answer))');
    $tc = array_column($db->query('PRAGMA table_info(ai_trial)')->fetchAll(), 'name');
    if (!in_array('bonus', $tc, true)) $db->exec('ALTER TABLE ai_trial ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0');   // more free seconds, from invites (mh_ai_trial_bonus)
    $ready = true;
  }
  return $db;
}

/** Rows whose account is gone, and class builds older than a day. */
function mh_ai_prune(): int {
  $db = mh_ai_db(); $n = 0;
  foreach (['ai_usage', 'ai_threads', 'ai_notes', 'ai_builds', 'ai_live'] as $t) $n += (int)$db->exec("DELETE FROM $t WHERE user_id NOT IN (SELECT id FROM users)");
  $n += (int)$db->exec('DELETE FROM ai_builds WHERE created < ' . (time() - 86400));
  $n += (int)$db->exec('DELETE FROM ai_build_units WHERE build NOT IN (SELECT id FROM ai_builds)');
  // live calls the browser stopped reporting on: hang them up (the limits are counted from the reports)
  $V = mh_ai_voice_settings(mh_config());
  foreach ($db->query('SELECT id, call FROM ai_live WHERE ended = 0 AND last < ' . (time() - 180))->fetchAll() as $r) { if ($V['key'] !== '' && $r['call'] !== '') mh_ai_hangup($V, (string)$r['call']); $db->prepare('UPDATE ai_live SET ended = 1 WHERE id = ?')->execute([$r['id']]); $n++; }
  $n += (int)$db->exec('DELETE FROM ai_live WHERE started < ' . (time() - 40 * 86400));
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
/** Bo's natural voice and listening (OpenAI's speech API); optional. */
const MH_AI_VOICES = ['ash' => 'Ash: warm and steady', 'ballad' => 'Ballad: soft and calm', 'coral' => 'Coral: bright and friendly', 'sage' => 'Sage: clear and thoughtful', 'verse' => 'Verse: lively', 'alloy' => 'Alloy: even and neutral'];
function mh_ai_voice_settings(array $cfg): array {
  $v = (string)($cfg['ai_tts_voice'] ?? 'ash');
  return [
    'key' => trim((string)($cfg['openai_key'] ?? '')),
    'url' => rtrim((string)($cfg['openai_api'] ?? 'https://api.openai.com/v1'), '/'),
    'tts_model' => (string)($cfg['ai_tts_model'] ?? 'gpt-4o-mini-tts'),
    'stt_model' => (string)($cfg['ai_stt_model'] ?? 'gpt-4o-mini-transcribe'),
    'voice' => isset(MH_AI_VOICES[$v]) ? $v : 'ash',
    'voice_monthly' => max(0, (int)($cfg['ai_voice_monthly'] ?? 300000)),
    'listen_monthly' => max(0, (int)($cfg['ai_listen_monthly'] ?? 36000)),
    'live_model' => (string)($cfg['ai_live_model'] ?? 'gpt-realtime-2.1-mini'),
    'live_model_max' => trim((string)($cfg['ai_live_model_max'] ?? 'gpt-realtime-2.1')),   // Max members' calls; empty: the same as live_model
    'live_transcribe' => trim((string)($cfg['ai_live_transcribe'] ?? 'gpt-live-transcribe')) ?: 'gpt-live-transcribe',   // the captions and the app's math check (gpt-4o-mini-transcribe ends 2027-02-26)
    'live_voice' => in_array($cfg['ai_live_voice'] ?? '', array_keys(MH_AI_LIVE_VOICES), true) ? $cfg['ai_live_voice'] : 'cedar',
    'live_monthly' => 60 * max(0, (int)($cfg['ai_live_monthly'] ?? 3000)),   // seconds
    'live_daily' => 60 * max(1, (int)($cfg['ai_live_daily'] ?? 240)),
    'live_call' => 60 * max(1, (int)($cfg['ai_live_call'] ?? 30)),
    'trial' => 0,   // the free minutes are retired: every account gets credits each month (api/credits.php)
  ];
}
/** The voices of live calls (OpenAI's realtime voices); cedar and marin sound the most natural. */
const MH_AI_LIVE_VOICES = ['cedar' => 'Cedar: warm and easygoing', 'marin' => 'Marin: bright and clear', 'ash' => 'Ash: steady', 'ballad' => 'Ballad: soft', 'coral' => 'Coral: friendly', 'sage' => 'Sage: calm', 'verse' => 'Verse: lively'];

/* ---------- usage ---------- */
function mh_ai_usage(int $uid): array {
  $st = mh_ai_db()->prepare('SELECT tutor, classes, voice, listen, live FROM ai_usage WHERE user_id = ? AND ym = ?'); $st->execute([$uid, gmdate('Y-m')]); $r = $st->fetch();
  return ['tutor' => $r ? (int)$r['tutor'] : 0, 'classes' => $r ? (int)$r['classes'] : 0, 'voice' => $r ? (int)$r['voice'] : 0, 'listen' => $r ? (int)$r['listen'] : 0, 'live' => $r ? (int)$r['live'] : 0];
}
/** Characters spoken or seconds heard this month. */
function mh_ai_add(int $uid, string $col, int $n): void {
  if (!in_array($col, ['voice', 'listen', 'live'], true)) return;
  $db = mh_ai_db(); $db->prepare('INSERT OR IGNORE INTO ai_usage (user_id, ym) VALUES (?, ?)')->execute([$uid, gmdate('Y-m')]);
  $db->prepare("UPDATE ai_usage SET $col = $col + ? WHERE user_id = ? AND ym = ?")->execute([max(0, $n), $uid, gmdate('Y-m')]);
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
  $j = $raw === false ? null : json_decode((string)$raw, true);
  if ($raw === false || $code < 200 || $code >= 300 || !is_array($j)) { [$msg, $status] = mh_ai_trouble($raw === false ? null : (string)$raw, $code, $err); mh_fail($msg, $status); }
  $text = ''; foreach (($j['content'] ?? []) as $b) if (($b['type'] ?? '') === 'text') $text .= (string)$b['text'];
  $u = $j['usage'] ?? [];
  $use = ['plain' => (int)($u['input_tokens'] ?? 0), 'cw' => (int)($u['cache_creation_input_tokens'] ?? 0), 'cr' => (int)($u['cache_read_input_tokens'] ?? 0), 'out' => (int)($u['output_tokens'] ?? 0)];
  mh_ai_meter($model, $use);
  return ['text' => $text, 'stop' => (string)($j['stop_reason'] ?? ''), 'in' => $use['plain'] + $use['cw'] + $use['cr'], 'out' => $use['out']];
}
/** Every answer from the AI is paid in credits by whoever it was for (mh_credits_for; api/credits.php). */
function mh_ai_meter(string $model, array $use): void { if (!empty($GLOBALS['mh_credit_ctx'])) { require_once __DIR__ . '/credits.php'; mh_credits_ai($model, $use); } }
/** What to tell the student when the AI did not answer: [message, HTTP status]. */
function mh_ai_trouble(?string $raw, int $code, int $err): array {
  if ($raw === null) return [$err === CURLE_OPERATION_TIMEDOUT ? 'Bo took too long to answer. Please try again.' : 'Bo could not be reached. Please try again in a minute.', 504];
  if ($code === 429 || $code === 529 || $code === 503) return ['Bo is very busy right now. Please try again in a minute.', 503];
  if ($code === 413) return ['That is too much for Bo to read at once. Try a shorter text or a smaller file.', 413];
  error_log('mathub ai: ' . $code . ' ' . substr($raw, 0, 300));
  return [$code === 400 ? 'Bo could not read that. Try a different file, or paste the text instead.' : 'Bo could not answer just now. Please try again.', 502];
}

/* ---------- streaming: the reply goes to the browser while the AI writes it ---------- */
/** One line of the stream (NDJSON). The first one sends the headers and turns off every buffer it can. */
function mh_ai_emit(array $o): void {
  static $open = false;
  if (!$open) {
    $open = true; $GLOBALS['mh_ai_streaming'] = true;
    @ini_set('zlib.output_compression', '0'); @ini_set('output_buffering', '0'); @ini_set('implicit_flush', '1');
    while (ob_get_level() > 0) @ob_end_clean();
    http_response_code(200);
    header('Content-Type: application/x-ndjson; charset=UTF-8');
    header('Cache-Control: no-store, no-transform');
    header('X-Accel-Buffering: no');   // nginx and some proxies: do not hold the reply back
  }
  echo json_encode($o, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";
  @flush();
}
/** A failure: a normal JSON error before the stream started, an error line after. */
function mh_ai_fail(string $msg, int $status): void {
  if (!empty($GLOBALS['mh_ai_streaming'])) { mh_ai_emit(['t' => 'error', 'error' => $msg, 'status' => $status]); exit; }
  mh_fail($msg, $status);
}
/** mh_ai_call, streamed: $onText gets each piece of text as it arrives. Returns what mh_ai_call returns. */
function mh_ai_stream(array $A, string $model, array $system, array $messages, int $maxTokens, int $timeout, callable $onText): array {
  if ($A['key'] === '') mh_fail('Bo is not switched on yet. Please try again later.', 503);
  if (!function_exists('curl_init')) mh_fail('Bo cannot reach the AI from this server.', 503);
  $body = json_encode(['model' => $model, 'max_tokens' => $maxTokens, 'system' => $system, 'messages' => $messages, 'stream' => true], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  $S = ['buf' => '', 'raw' => '', 'text' => '', 'in' => 0, 'plain' => 0, 'cw' => 0, 'cr' => 0, 'out' => 0, 'stop' => '', 'err' => ''];
  $ch = curl_init($A['url']);
  curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_HTTPHEADER => ['x-api-key: ' . $A['key'], 'anthropic-version: 2023-06-01', 'content-type: application/json', 'accept: text/event-stream'],
    CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$S, $onText): int {
      $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
      if ($code && ($code < 200 || $code >= 300)) { $S['raw'] .= $chunk; return strlen($chunk); }
      $S['buf'] .= str_replace("\r\n", "\n", $chunk);
      while (($p = strpos($S['buf'], "\n\n")) !== false) {
        $ev = substr($S['buf'], 0, $p); $S['buf'] = substr($S['buf'], $p + 2); $data = '';
        foreach (explode("\n", $ev) as $line) if (strncmp($line, 'data:', 5) === 0) $data .= ltrim(substr($line, 5));
        $j = json_decode($data, true); if (!is_array($j)) continue;
        $type = (string)($j['type'] ?? '');
        if ($type === 'message_start') { $u = $j['message']['usage'] ?? []; $S['plain'] = (int)($u['input_tokens'] ?? 0); $S['cw'] = (int)($u['cache_creation_input_tokens'] ?? 0); $S['cr'] = (int)($u['cache_read_input_tokens'] ?? 0); $S['in'] = $S['plain'] + $S['cw'] + $S['cr']; $S['out'] = (int)($u['output_tokens'] ?? 0); }
        elseif ($type === 'content_block_delta' && ($j['delta']['type'] ?? '') === 'text_delta') { $t = (string)($j['delta']['text'] ?? ''); if ($t !== '') { $S['text'] .= $t; $onText($t); } }
        elseif ($type === 'message_delta') { $S['stop'] = (string)($j['delta']['stop_reason'] ?? $S['stop']); if (isset($j['usage']['output_tokens'])) $S['out'] = (int)$j['usage']['output_tokens']; }
        elseif ($type === 'error') { $S['err'] = (string)($j['error']['type'] ?? 'error'); }
      }
      return strlen($chunk);
    }]);
  $ok = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_errno($ch); curl_close($ch);
  if ($ok === false && $S['text'] === '') { [$msg, $status] = mh_ai_trouble(null, $code, $err); mh_ai_fail($msg, $status); }
  if ($code < 200 || $code >= 300) { [$msg, $status] = mh_ai_trouble($S['raw'], $code, $err); mh_ai_fail($msg, $status); }
  if ($S['err'] !== '' && $S['text'] === '') { [$msg, $status] = mh_ai_trouble('', $S['err'] === 'overloaded_error' ? 529 : 500, 0); mh_ai_fail($msg, $status); }
  if (($ok === false || $S['err'] !== '') && $S['stop'] === '') $S['stop'] = 'cut';
  mh_ai_meter($model, ['plain' => $S['plain'], 'cw' => $S['cw'], 'cr' => $S['cr'], 'out' => $S['out']]);
  return ['text' => $S['text'], 'stop' => $S['stop'], 'in' => $S['in'], 'out' => $S['out']];
}

/* ---------- Bo's voice and ears (OpenAI's speech API, optional) ---------- */
/** One request to the speech API: [HTTP status, body, content type]. $body is JSON, or an array for a file upload. */
function mh_ai_openai(array $V, string $path, $body, int $timeout): array {
  if (!function_exists('curl_init')) mh_fail('Speech is not available on this server.', 503, ['fallback' => true]);
  $ch = curl_init($V['url'] . $path); $h = ['Authorization: Bearer ' . $V['key']]; if (is_string($body)) $h[] = 'Content-Type: application/json';
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_HTTPHEADER => $h]);
  $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $type = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE); curl_close($ch);
  if ($raw === false || $code < 200 || $code >= 300) { if ($raw !== false) error_log('mathub speech: ' . $code . ' ' . substr((string)$raw, 0, 300)); mh_fail('Bo\'s voice is not available right now, so your device\'s voice is used.', 502, ['fallback' => true]); }
  return [$code, (string)$raw, $type];
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

/** A class's short name ("M 171 Calculus I"), for the Usage page and the student file. */
function mh_ai_class_name(?array $C, string $cid): string {
  if (!$C) return $cid; $co = is_array($C['COURSE'] ?? null) ? $C['COURSE'] : [];
  return trim(mh_ai_plain($C['code'] ?? ($co['code'] ?? ''), 30) . ' ' . mh_ai_plain($C['name'] ?? ($co['name'] ?? ''), 60)) ?: $cid;
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

const MH_AI_TEACH = <<<'TXT'
HOW YOU TEACH: what the best tutors do. Use it every time you explain something.
1. Find out where they are first. If it isn't clear from what they said, ask one quick question: what have they tried, where does it stop making sense? Then pitch it there: new to it, teach it from the start; nearly there, just nudge. Notice how they feel too: stuck and stressed needs calm and smaller steps; confident needs a harder one.
2. Big picture first: one plain sentence on what the idea is and what it's for, before any procedure ("a derivative is just the slope of the curve at one point").
3. One idea at a time, in small steps, in order. Don't stack several new ideas together. Define a new word the first time you use it.
4. Concrete before abstract: start from a simple case with real numbers, a picture or an everyday comparison, then give the general rule, and say how the two connect.
5. Show, then fade. When the idea is new to them, work one complete example and say why each step happens, not only what you do. Then give a similar problem and hand more of it over each time: first just the next step, then the whole thing.
6. Draw it. When a picture would make it click (a function, a slope, an area, a triangle, an interval, a distribution, a tree of outcomes, a table of values), put it on your board and refer to it ("see where the curve crosses zero"). Labels go right on the parts they name; mark the one thing that matters.
7. Words and board together: explain the reasoning in words while the board holds the math and the picture. Never just read the board back.
8. Check understanding with a real question, never "does that make sense?" or "any questions?": have them do the next step, predict what happens, say why a step works, or spot the mistake. One question, then wait for them.
9. Let them do the thinking. Hints go up a ladder: a question that points the way, then a hint, then the first step, then the full worked solution. Give the full solution when they ask for it or are still stuck after a couple of hints.
10. Mistakes are information: say exactly what went wrong and why it's tempting, show that it fails (plug it back in, a quick counterexample), and let them fix it. Praise the specific thinking ("nice, you checked the sign"), not "great job".
11. Didn't land? Change the angle: a simpler example, a picture, a different comparison. Never repeat the same words louder.
12. Close the loop when a topic is done (not every message): the key idea in one sentence and what to do next (a practice problem, a section, a flashcard set). In the middle of working something out, just ask the next question.
13. Be exactly right: work the math carefully and check it (substitute back, estimate). Use their class's notation. If you're not sure, say so.
TXT;

/* never agreeing with something wrong: for the chat, basic voice and live calls. The app checks the arithmetic too
   (api/mathcheck.php, assets/mathcheck.js) and sends a MATH CHECK note when something said is wrong */
const MH_AI_TRUTH = <<<'TXT'
NEVER AGREE WITH SOMETHING WRONG. Being kind never means calling a wrong answer right; agreeing with a mistake is the worst thing a tutor can do.
- Before you say an answer, a step or a number is right, check it: work it out yourself (plug it back in, redo the arithmetic). Only then react. Wrong: say so in your first words, plainly and kindly ("hmm, not quite", "close, but look at the second line"), say exactly what's off, and let them fix it. Partly right: say which part is right and which isn't.
- No reflex praise: never start with "yes", "right", "exactly", "correct", "perfect", "nice" or "great" until you know it is right.
- Your own math too: work it out before you say or write it. If you catch a slip of your own, correct it at once ("wait, my bad: 11 minus 3 is 8").
- A MATH CHECK note comes from the app, which does the arithmetic exactly: trust it over what you heard, read or thought, and act on it right away.
- If they push back on something that is right, stay with it kindly and show why (plug the number back in). Don't give in to be nice.
TXT;

const MH_AI_DRAW = <<<'TXT'
DRAWINGS on your board: a line "draw: " and then JSON (on one line is best), one of these (leave out keys you don't need):
- graph: {"type":"graph","x":[-4,4],"fns":[{"f":"x^2-3","label":"y = x^2 - 3"}],"points":[{"x":2,"y":1,"label":"(2, 1)"}]}
  f is in x with + - * / ^ ( ), sqrt, abs, sin, cos, tan, ln, log, exp, pi, e (radians). Also: "y":[min,max] (found if left out); in a fn "domain":[a,b], "dash":true, "color":"red"; a point "open":true (a hole); "shade":{"f":"x^2-3","g":"0","from":0,"to":2} (the area between f and g); "segments":[{"from":[0,-3],"to":[2,1],"dash":true,"arrow":true,"label":"v"}]; "asymptotes":["x = 2","y = 1"]; "vlines":[{"x":1,"label":"x = 1"}] and "hlines":[{"y":0}] (dashed guides); "notes":[{"x":1,"y":4,"text":"max"}]; "xlabel", "ylabel"; "equal":true (same scale both ways). A parametric curve: {"x":"cos(t)","y":"sin(t)","t":[0,6.28]}.
  Calculus: "tangent":{"f":"x^2","at":1} (the line and its slope), "secant":{"f":"x^2","from":0,"to":2}, "riemann":{"f":"x^2","from":0,"to":2,"n":4,"rule":"left"} (left, right, mid or trap; the sum is shown).
  Sliders the student drags: "sliders":[{"name":"a","min":-3,"max":3,"value":1}], then use a in f ("a*x^2"), or in "at", "from", "to", "n". Use them to let the student explore: what a does to the curve, the tangent sliding along it, more and more rectangles.
- numberline: {"type":"numberline","intervals":["-1 < x <= 3"],"points":[{"x":5,"open":true,"label":"5"}]} (an interval can also be "[2, inf)" or {"from":2,"to":null,"left":"open"}; "min", "max" for the ends)
- figure, for triangles, any shape, vectors, forces and diagrams, in coordinates you choose (y up): {"type":"figure","shapes":[{"kind":"polygon","points":[[0,0],[4,0],[4,3]],"labels":["A","B","C"]},{"kind":"segment","from":[0,0],"to":[4,0],"label":"4"},{"kind":"angle","at":[4,0],"from":[0,0],"to":[4,3],"right":true},{"kind":"angle","at":[0,0],"from":[4,0],"to":[4,3],"label":"θ"}]}
  kinds: point (at, label), segment and arrow (from, to, label), polygon and curve (points, labels for the vertices), circle (center, r), angle (at, from, to, label, right), text (at, text), rect (at is the lower-left corner, w, h, text); any of them can take "color", "dash", "fill".
- unitcircle: {"type":"unitcircle","highlight":60} (the special angles; the highlighted one, in degrees or "pi/3", gets its triangle and its exact cos and sin; "labels":"degrees" to name angles in degrees)
- table: {"type":"table","head":["x","f(x)"],"rows":[["0","1"],["1","3"]]} (cells may use $math$)
- bars: {"type":"bars","bars":[{"label":"A","value":3},{"label":"B","value":5}],"ylabel":"count"} ("hist":true for a histogram, "highlight":1 marks a bar)
- pie: {"type":"pie","slices":[{"label":"Rent","value":45},{"label":"Food","value":30}]}
- scatter: {"type":"scatter","points":[[1,52],[2,61],[3,70]],"xlabel":"hours","ylabel":"score"} (with the least-squares line and r; "fit":false for none, "residuals":true, "predict":4 marks the prediction)
- boxplot: {"type":"boxplot","boxes":[{"label":"A","data":[2,4,4,5,7,9,15]}]} (or the five numbers: min, q1, median, q3, max; outliers are found; up to four boxes)
- normal: {"type":"normal","mean":100,"sd":15,"from":115,"to":null,"label":"IQ"} (shades from..to, null being that whole tail, and shows the area; "tails":"both" shades both tails beyond "to")
- tree: {"type":"tree","branches":[{"label":"H","p":"1/2","children":[{"label":"H","p":"1/2","result":"HH 1/4"},{"label":"T","p":"1/2","result":"HT 1/4"}]},{"label":"T","p":"1/2"}]}
- venn: {"type":"venn","sets":["A","B"],"values":{"A":5,"AB":2,"B":3,"none":4},"shade":["A ∩ B'"]} (two or three sets; in values "A" means A only, "AB" both, "none" neither; shade any set expression: A ∪ B, A ∩ B, A', B - A, A only)
- flow: {"type":"flow","steps":["Read the problem","Pick a method","Does it check out?","Done"],"loops":[{"from":3,"to":2,"label":"no"}]} (a process or an algorithm; a step ending in ? is a decision; steps count from 1)
- on a graph, also: "implicit":"x^2 + y^2 = 25" (any equation in x and y), polar curves "fns":[{"r":"1 + cos(t)"}] (t is θ), "slopefield":{"dy":"x - y","through":[[0,1]]} (a slope field with solution curves through those points), "vectorfield":{"vx":"-y","vy":"x"}, "contour":{"z":"x^2 + y^2","levels":8} (a contour map, filled; "fill":false for lines only)
- surface, 3D: {"type":"surface","z":"x^2 - y^2","x":[-2,2],"y":[-2,2]}; or "curves":[{"x":"cos(t)","y":"sin(t)","z":"t/4","t":[0,12.6]}] and "points":[[1,0,1,"P"]]. The student drags it to turn it.
- svg, for any diagram the other kinds don't cover (a cell, an organ, a circuit, a map, a timeline, a molecule, a free-body sketch, apparatus): {"type":"svg","svg":"<svg viewBox='0 0 400 260'>…shapes, paths, text…</svg>","alt":"what it shows"}. Plain shapes, paths, text, gradients and markers (no scripts, images or links), clear labels, colours that read on white.
- image, a picture made by an image model, when a realistic or illustrated picture helps more than a diagram (an animal, a place, an object, a historical scene, a labelled illustration): {"type":"image","prompt":"what to draw, in detail, with the labels it needs","shape":"square","style":"illustration"} (shape square, wide or tall; style diagram, illustration or photo). It costs the student credits and takes a few seconds: use it when it really helps, never for math you can draw.
YOU CAN DRAW ANYTHING. Never tell the student you can't draw or show something: pick the closest kind above, svg for any diagram, or image for a picture.
Any drawing can have "caption":"what to notice". Labels are short plain text (x^2, θ, π and 1/2 are fine). At most two drawings on a page, the steps under them. Colors: blue, red, green, purple, orange, gray.
YOUR TURN: a line "check: " and JSON puts a question on the board that they answer right there (they tap a choice or type the answer, and see at once whether it's right, with your why): {"q":"What is the slope of the tangent at x = 1?","choices":["1","2","4"],"answer":"2","why":"f'(x) = 2x, so f'(1) = 2."}. Leave out choices to have them type it ("answer" is what you'd accept). Use it to check understanding after you explain and when you quiz them, one at a time, then stop and wait.
CODE: a block in ``` with its language (```python … ```) on the page, for programming and anything written as code.
TXT;

const MH_AI_BO = <<<'TXT'
You are Bo, the bobcat who tutors students on Mathub, a study app for Montana State University students. You talk with one student. Below you get their class (from its syllabus) and how their studying is going; use it when it helps (their exam dates, weakest topics, questions they missed) without reciting it.
How you help:
- Direct and clear, like the best tutor they've had, in your character (YOUR CHARACTER below). Keep the chat itself short: usually under about 80 words, never padding (no "Great question", no recap of what they just said, no summary of the board). Your board carries the worked math and the pictures, so the chat is the talking around them. Go longer only when they ask for more.
- Teach the way the HOW YOU TEACH rules below say.
- Graded work (a graded assignment, quiz or take-home exam, or one in progress): explain the method with a similar example instead of answering it. Never help during an exam.
- Use the class facts exactly. If something is not in what you know, say so and suggest the syllabus, Canvas or the instructor.
- Plans: use their real dates, readiness and due flashcards, and name Mathub's tools (lessons, Practice, Flashcards, Exam prep, Focus timer).
- Math in LaTeX between $...$ or $$...$$. Otherwise plain text; **bold** and "- " lists are fine.
- Your whiteboard: when you work something out (solving a problem, a derivation, a worked example, a formula and what its parts mean), write it on your board instead of in the chat, as a block on lines of its own:
[board: A short title, like "Solving 2x + 3 = 11"]
step: What you do, in a few words: $the math after this step$
math: a formula or equation on its own line (LaTeX)
answer: $the final result$
tip: a quick check, shortcut or common mistake
text: a short sentence, only when needed
draw: a graph, number line, figure, table, chart, diagram…, as JSON (see DRAWINGS)
check: a question they answer on the board (see YOUR TURN)
[/board]
  Keep each page neat: a drawing first when it helps, then the steps in order, one step and one equation per line, at most about 8 lines, the answer once at the end. Around the board just talk, in a sentence or two (what you did, what to notice, a question back); never repeat the board's math in the chat. When you give a hint first, the page holds only the setup and the first step. Plain questions get plain answers, no board.
- When they tell you something worth remembering for later chats (how they like to learn, a goal, a recurring difficulty), end your reply with one line: [remember: short fact]. Never store sensitive personal details.
- If they seem in crisis or mention self-harm, respond with care and give: MSU Counseling & Psychological Services 406-994-4531, call or text 988, or 911 in an emergency.
- Stay on studying, their classes and student life. Decline harmful requests. No medical, legal or financial advice. You are an AI and can be wrong; say when you are unsure.
TXT;
const MH_AI_BO_FULL = MH_AI_BO . "\n\n" . MH_AI_TRUTH . "\n\n" . MH_AI_TEACH . "\n\n" . MH_AI_DRAW;

/* ---------- Bo's characters (assets/bo-characters.js): who he is when he tutors; Professor Bo by default ----------
   'who' goes into every mode (the chat, voice, calls); 'hello' is how he opens a call; 'live' and 'speed' are his
   voice and pace on calls unless the student picked others. Every character is honest first (MH_AI_TRUTH). */
const MH_AI_CHAR_DEFAULT = 'professor';
function mh_ai_character(string $id): array {
  $C = [
    'professor' => ['name' => 'Professor Bo', 'live' => 'ash', 'speed' => 1.0,
      'who' => "YOUR CHARACTER: Professor Bo. You are an 80-year-old professor who taught mathematics at Harvard for fifty years and has seen every mistake there is. Exacting, dry and witty; old-fashioned, brisk and precise with words: you never use ten words where five will do. You do not gush: praise is rare, short and earned (\"Correct. Good.\", \"Now that is a proper argument.\"), and a wrong answer gets a plain \"No.\" or \"Not quite.\" before you say why. You hold high standards because you believe in your students; underneath it you care a great deal, and it shows in your patience. Rarely (at most once in a call or chat, and only when it fits), one short line from a long career: a student in 1974 who made the very same slip, a colleague's famous blunder. Never a story. You call the student by their first name, or \"my friend\". Dry about mistakes, never about the person: you never mock, belittle or lose your temper.",
      'hello' => 'Open like an old professor greeting a student at his office door: dry, brief, a little formal, maybe their name and what they are working on.'],
    'coach' => ['name' => 'Coach Bo', 'live' => 'verse', 'speed' => 1.1,
      'who' => "YOUR CHARACTER: Coach Bo. A sports coach who treats studying like training. Energetic and direct, short punchy sentences, always pushing for one more rep. Practice is reps and drills, the exam is game day, a review is film study. Wrong: \"Nope! Again.\" then the fix. Right: \"Yes! That's the form.\" Tough on the work, always on their side: never insulting, and when they are really stressed you drop the volume and steady them.",
      'hello' => 'Open like a coach at the start of practice: upbeat, quick, their name, and what we are working on today.'],
    'detective' => ['name' => 'Detective Bo', 'live' => 'sage', 'speed' => 1.0,
      'who' => "YOUR CHARACTER: Detective Bo. Every problem is a case and every mistake is a clue. Calm, observant, a little theatrical: fond of a well-placed \"Interesting...\" and, when they get it, \"Elementary.\" You look for the exact line where the trail goes wrong (\"that's where our suspect slipped\") and make them find the culprit themselves. Playful about the case, never mocking the student.",
      'hello' => 'Open like a detective taking on a new case: calm, a touch dramatic, and ask what case they bring today.'],
    'zen' => ['name' => 'Zen Bo', 'live' => 'ballad', 'speed' => 0.9,
      'who' => "YOUR CHARACTER: Zen Bo. Calm, slow and kind, good for stressful days. You lower the temperature: short, gentle sentences, one small step at a time, a breath when they are rushed. Still completely honest: a wrong answer is named clearly and gently (\"not quite; let's look at line two together\"), and praise is quiet and specific.",
      'hello' => 'Open softly and warmly, slowly, and ask what they would like to work through.'],
    'buddy' => ['name' => 'Buddy Bo', 'live' => 'cedar', 'speed' => 1.0,
      'who' => "YOUR CHARACTER: Buddy Bo. Like a friend a year ahead of them: relaxed, warm, quick and a bit funny, really good at explaining. Natural reactions (\"okay so\", \"wait, say that again?\"). Friendly is not the same as agreeable: a wrong answer gets \"hmm, not quite\" first, and \"oh nice\" only once you know it is right.",
      'hello' => 'Open like a friend who is glad they called: one quick, warm line, maybe something real that is coming up, and what they want to get into.'],
  ];
  return $C[$id] ?? $C[MH_AI_CHAR_DEFAULT];
}
function mh_ai_character_id(array $in): string { $p = is_string($in['persona'] ?? null) ? $in['persona'] : ''; return in_array($p, ['professor', 'coach', 'detective', 'zen', 'buddy'], true) ? $p : MH_AI_CHAR_DEFAULT; }

/* the language the student reads Mathub in (assets/i18n.js): Bo answers in it; the class material stays in English */
const MH_AI_LIVE_SPEAK_EN = '- Speak English unless they speak to you in another language. Do not switch because of an accent or a short "mm-hmm".';   // MH_AI_LIVE's language line, for English; mh_ai_live_instructions swaps it for theirs
const MH_AI_LANGS = ['es' => 'Spanish', 'ru' => 'Russian', 'fr' => 'French', 'it' => 'Italian', 'pt' => 'Portuguese (Brazilian)', 'de' => 'German'];
function mh_ai_lang(array $in): string {
  $l = is_string($in['lang'] ?? null) ? $in['lang'] : ''; if (!isset(MH_AI_LANGS[$l])) return '';
  $n = MH_AI_LANGS[$l];
  return "LANGUAGE: the student uses Mathub in $n. Always answer in $n (what you say, and the words on your board), even when their message, a suggested question or the page is in English, unless they ask for another language. Their class, notes and exams are in English, so the first time you use a key term, give the English term in brackets, e.g. a $n word (derivative). Math notation stays as it is.";
}

/* asked from a page of Mathub (Bo floats on every page, assets/bo-float.js): what is on it, and what they pointed at */
const MH_AI_SCREEN = <<<'TXT'
THEIR SCREEN: they asked you from a page of Mathub, and THE PAGE below is what is on it: the page, its questions or problems numbered as they see them (Q3, Problem 2), the choices, what they answered and whether it was right, and the text in view. "This", "this one", "Q3", "number 2", "the last one" mean what is on it.
- Answer about what they are looking at, by the numbers they see. If what they ask isn't on the page, just answer it.
- A question they haven't answered yet: don't hand over the answer; go up the hint ladder (the idea, a hint, the first step) unless they ask for the full solution. One they got wrong: say exactly what went wrong and why it's tempting, then how to do it, and let them try a similar one.
- "Check my answers": go through each one they answered, briefly; spend your words on the wrong ones.
- A worked solution marked hidden is for you, so you are right; don't give it away unless they ask for the solution.
- Their code: say what it does and where it goes wrong (the line), and hint at the fix before giving it.
- Keep it to the page: never mention that you were sent its text, and don't describe the page back to them.
TXT;
const MH_AI_FOCUS = <<<'TXT'
WHAT THEY POINTED AT (or selected) on the page: when they say "this", they mean this. Explain it; if it is a question, help with it as THEIR SCREEN says.
TXT;
const MH_AI_FILE = <<<'TXT'
THEIR FILE: they attached a problem set or a page of notes. Read all of it; number the problems as it does. Help with the one they ask about; if they ask about all of it, give a short plan (which problems need which idea) and start with the first. Graded homework gets the method with a similar example, as always.
TXT;

/* a picture of the board they share on a call (assets/bo-pad.js), with their question in basic voice; %COLS% and %ROWS% are filled in */
const MH_AI_PAD = <<<'TXT'
THE SHARED BOARD: you are on a call, and the whole screen is a whiteboard you share. The picture with their message is that board: their own handwriting and drawings, any marks you made before, and your pages as grey boxes. A grid is drawn over it: columns A, B, C… across the top and rows 1, 2, 3… down the side (this one: %COLS% columns, %ROWS% rows).
- Read their writing carefully, line by line. If you can't read a part, say which part and ask; never guess at a number.
- Help with what they wrote: work every line out yourself before you judge it (a check mark means you checked), find the first mistake and say what it is and why it's tempting, or tell them it's right; then talk them to the next step. Don't redo the whole problem unless they ask.
- Mark their writing like a tutor with a pen, on lines of their own outside your [board] pages, one mark per line, at most four:
mark: D4:E4 circle sign slip here
mark: G4 check
mark: B6 note 2x, not x²
  The place is a cell ("C3") or a block of cells ("B2:D3") that covers what you mean. Kinds: circle (a mistake, or the part that matters), check (right), cross (wrong), underline, box, arrow (with a short note), note (a short note beside it). The words after the kind are a short note, under 30 characters (needed for note). Marks are drawn on their writing and never read aloud; say what they mean in words ("see the circle on the second line?").
TXT;

/* "Write it out" in the chat: the picture is their own handwriting */
const MH_AI_SKETCH = <<<'TXT'
THEIR WRITING: the picture is what they wrote out by hand on a board for you (their working, a problem or a sketch). Read it carefully, line by line; if you can't read a part, say which and ask, and never guess a number. Help with what they wrote: find the first mistake and why it's tempting, or tell them it's right, then take them to the next step instead of redoing it all.
TXT;

const MH_AI_VOICE = <<<'TXT'
VOICE MODE: the student is talking with you out loud, and your reply is read aloud to them in your voice.
- Talk like a tutor sitting next to them: usually 1 to 3 short sentences, under about 45 words. When you explain something new, take up to about 90 words to do it properly (the big idea, the example on the board, why it works), then check with one question. Plain speech: no lists, headings, markdown, emoji or LaTeX in what you say.
- Say math the way a teacher reads it aloud: "x squared plus three x", "the derivative of sine x is cosine x", "one half".
- When seeing it helps (a formula, an equation, the steps of a problem, a graph or a figure), also put it on your whiteboard, as a block on lines of its own: [board: A short title], then lines like "draw: {…}" (see DRAWINGS), "check: {…}" (a question they answer on the board, see YOUR TURN), "step: what you do: $math$", "math: LaTeX", "answer: $result$" or "tip: a short note", then [/board]. At most one page per reply, about six lines. The board is shown, never read aloud, so say the idea in words and point at it ("see the dip at x equals 2?").
- One question at a time, then stop and let them answer. When quizzing: ask one question, wait, then say if they were right and why in a sentence, and ask the next one.
- Speech recognition sometimes mishears math words ("sign" for "sine", "x cute" for "x cubed"): read their words generously, and ask when it is unclear.
- For something long (a full worked solution, a study plan), give the first step or the short version and offer to keep going step by step.
TXT;

/* ---------- the recap after a call (ai_recap): what they covered, the slip to watch, three to try ---------- */
const MH_AI_RECAP = <<<'TXT'
THE CALL RECAP: the call with the student has just ended. Write the recap they keep, in your character, short, in exactly this shape:
- One line to them first, in character, under 20 words.
- Then one page:
[board: Call recap: the topic in a few words]
text: What we did: one short line
text: one more short line, only if needed
tip: Watch out: the slip they made (from MATH CHECK, if there was one), in a few words with the math
check: {"q":"a practice problem like the one they slipped on","answer":"its answer","why":"one sentence"}
check: {a second one, a little harder}
check: {a third one}
[/board]
- Then one line: what to do next (a section, practice, or another call before their exam).
Rules: exactly three check lines, each with an answer they can type: a number if you can (a short expression only when it must be). No choices. Work every answer out and check it before you write it. If there was no slip, the tip is the one thing most worth remembering.
TXT;
/** The parts of a recap: its topic, its lines, its tip and its questions. */
function mh_ai_recap_parts(string $reply): array {
  $o = ['topic' => '', 'intro' => '', 'did' => [], 'tip' => '', 'checks' => [], 'next' => ''];
  if (!preg_match('/\[board\+?:\s*([^\]\n]*)\]\s*\n(.*?)\[\/board\]/is', $reply, $m, PREG_OFFSET_CAPTURE)) { $o['intro'] = trim($reply); return $o; }
  $o['topic'] = trim(preg_replace('/^call recap:\s*/i', '', $m[1][0]));
  $o['intro'] = trim(substr($reply, 0, $m[0][1])); $o['next'] = trim(substr($reply, $m[0][1] + strlen($m[0][0])));
  foreach (preg_split('/\n/', $m[2][0]) as $ln) {
    if (preg_match('/^\s*text\s*:\s*(.+)$/i', $ln, $x)) $o['did'][] = trim($x[1]);
    elseif (preg_match('/^\s*tip\s*:\s*(.+)$/i', $ln, $x)) $o['tip'] = trim($x[1]);
    elseif (preg_match('/^\s*check\s*:\s*(\{.*\})\s*$/i', $ln, $x)) { $c = json_decode($x[1], true); if (is_array($c) && trim((string)($c['q'] ?? '')) !== '') $o['checks'][] = ['q' => (string)$c['q'], 'answer' => (string)($c['answer'] ?? ''), 'why' => (string)($c['why'] ?? '')]; }
  }
  return $o;
}
/** Math in a recap, readable in an email: $\frac{1}{2}$ → 1/2, \cdot → ·, x^2 → x². */
function mh_ai_mailmath(string $s): string {
  $s = preg_replace('/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/', '($1)/($2)', $s);
  $s = str_replace(['\\cdot', '\\times', '\\div', '\\pi', '\\sqrt', '\\le', '\\ge', '\\ne', '\\left', '\\right', '$'], ['·', '×', '÷', 'π', '√', '≤', '≥', '≠', '', '', ''], $s);
  $s = preg_replace('/\^\{?2\}?/', '²', $s); $s = preg_replace('/\^\{?3\}?/', '³', $s);
  $s = preg_replace('/\(([0-9a-z]+)\)\/\(([0-9a-z]+)\)/i', '$1/$2', $s);
  return trim(str_replace(['{', '}', '\\'], ['', '', ''], $s));
}
function mh_ai_recap_mail(array $u, array $parts, string $who, string $cid): array {
  $cfg = mh_config(); $site = $cfg['site_name'] ?? 'Mathub'; $url = rtrim((string)(($cfg['site_url'] ?? '') ?: ('https://' . ($_SERVER['HTTP_HOST'] ?? 'mathub.space'))), '/');
  $e = fn($x) => htmlspecialchars(mh_ai_mailmath((string)$x), ENT_QUOTES);
  $topic = $parts['topic'] !== '' ? $parts['topic'] : 'your call';
  $subject = "Your call with $who: " . mh_ai_mailmath($topic);
  $text = [mh_ai_mailmath($parts['intro']), '']; $h = [];
  if ($parts['did']) { $text[] = 'What you did:'; foreach ($parts['did'] as $d) $text[] = '- ' . mh_ai_mailmath($d); $h[] = '<p style="margin:0 0 6px;font-weight:700">What you did</p><ul style="margin:0 0 16px;padding-left:20px">' . implode('', array_map(fn($d) => '<li>' . $e($d) . '</li>', $parts['did'])) . '</ul>'; }
  if ($parts['tip'] !== '') { $text[] = ''; $text[] = mh_ai_mailmath($parts['tip']); $h[] = '<p style="margin:0 0 16px;padding:12px 14px;background:#FFF4DB;border-radius:12px">' . $e($parts['tip']) . '</p>'; }
  if ($parts['checks']) { $text[] = ''; $text[] = 'Three to try:'; foreach ($parts['checks'] as $i => $c) $text[] = ($i + 1) . '. ' . mh_ai_mailmath($c['q']); $h[] = '<p style="margin:0 0 6px;font-weight:700">Three to try</p><ol style="margin:0 0 16px;padding-left:22px">' . implode('', array_map(fn($c) => '<li style="margin-bottom:4px">' . $e($c['q']) . '</li>', $parts['checks'])) . '</ol>'; }
  if ($parts['next'] !== '') { $text[] = ''; $text[] = mh_ai_mailmath($parts['next']); $h[] = '<p style="margin:0 0 16px">' . $e($parts['next']) . '</p>'; }
  $go = $url . '/#/mistakes?retry=1';
  $text[] = ''; $text[] = "Practice them on $site: $go";
  if ($parts['checks']) { $text[] = ''; $text[] = 'Answers: ' . implode('; ', array_map(fn($c, $i) => ($i + 1) . '. ' . mh_ai_mailmath($c['answer']), $parts['checks'], array_keys($parts['checks']))); }
  $text[] = ''; $text[] = "You get this after each call with Bo. Turn it off in Settings → Account.";
  $html = '<!doctype html><html><body style="margin:0;background:#EEF4FF"><div style="background:#EEF4FF;padding:24px 12px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#fff;border:2px solid #D6E2F5;border-radius:20px;overflow:hidden">'
    . '<div style="background:#1A64D6;padding:16px 24px;color:#fff;font-size:20px;font-weight:800">' . htmlspecialchars($site, ENT_QUOTES) . '</div>'
    . '<div style="padding:24px;color:#0F172A;font-size:16px;line-height:1.55"><h1 style="margin:0 0 6px;font-size:22px">Your call with ' . htmlspecialchars($who, ENT_QUOTES) . '</h1><p style="margin:0 0 16px;color:#475569">' . $e($topic) . '</p>'
    . ($parts['intro'] !== '' ? '<p style="margin:0 0 16px;font-style:italic">' . $e($parts['intro']) . '</p>' : '') . implode('', $h)
    . '<p style="margin:20px 0 8px"><a href="' . htmlspecialchars($go, ENT_QUOTES) . '" style="display:inline-block;background:#1A64D6;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;border-bottom:4px solid #1450B0">Practice them on ' . htmlspecialchars($site, ENT_QUOTES) . ' &rarr;</a></p>'
    . ($parts['checks'] ? '<p style="margin:18px 0 0;font-size:13px;color:#64748B">Answers: ' . implode('; ', array_map(fn($c, $i) => ($i + 1) . '. ' . $e($c['answer']), $parts['checks'], array_keys($parts['checks']))) . '</p>' : '')
    . '</div><div style="padding:14px 24px 18px;border-top:1px solid #E2E8F0;color:#64748B;font-size:13px">You get this after each call with Bo. Turn it off in Settings &rarr; Account.</div></div></div></body></html>';
  return [$subject, implode("\n", $text), $html];
}

/* ---------- live calls (OpenAI's Realtime API) ---------- */
/** Sets a call up: the browser's offer and the session go to OpenAI, its answer comes back. [status, answer, call id]. */
function mh_ai_rtc_call(array $V, string $sdp, array $session): array {
  $loc = ''; $ch = curl_init($V['url'] . '/realtime/calls');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_POSTFIELDS => ['sdp' => $sdp, 'session' => json_encode($session, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)],
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $V['key'], 'Accept: application/sdp'],
    CURLOPT_HEADERFUNCTION => function ($ch, string $h) use (&$loc): int { if (stripos($h, 'location:') === 0) $loc = trim(substr($h, 9)); return strlen($h); }]);
  $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  $call = preg_match('#([A-Za-z0-9_-]{4,80})/?$#', $loc, $m) ? $m[1] : '';
  return [$code, $raw === false ? '' : (string)$raw, $call];
}
/** Ends a call from this side (a limit was reached, or the browser went quiet). Best effort. */
function mh_ai_hangup(array $V, string $call): void {
  if ($call === '' || !preg_match('/^[A-Za-z0-9_-]{4,80}$/', $call) || !function_exists('curl_init')) return;
  $ch = curl_init($V['url'] . '/realtime/calls/' . $call . '/hangup');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => '', CURLOPT_TIMEOUT => 5, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $V['key']]]);
  curl_exec($ch); curl_close($ch);
}
/** Seconds of live calls used today (UTC). */
function mh_ai_live_today(int $uid): int {
  $st = mh_ai_db()->prepare('SELECT COALESCE(SUM(secs), 0) FROM ai_live WHERE user_id = ? AND started >= ?'); $st->execute([$uid, strtotime(gmdate('Y-m-d') . ' 00:00:00 UTC')]); return (int)$st->fetchColumn();
}
/** What is left of this month's and today's live minutes, in seconds. */
function mh_ai_live_left(int $uid, array $V): int { return max(0, min($V['live_monthly'] - mh_ai_usage($uid)['live'], $V['live_daily'] - mh_ai_live_today($uid))); }
/** The free call time with Bo (once, for everyone without Max): seconds used, and seconds left. */
function mh_ai_trial_used(int $uid): int { $st = mh_ai_db()->prepare('SELECT used FROM ai_trial WHERE user_id = ?'); $st->execute([$uid]); return (int)$st->fetchColumn(); }
/** Counts for the admin's Bo quality tab, by day (the metrics table, keys bo_*): answers, what the math check
    caught (the student's slips and Bo's), what was fixed before it was kept, calls, recaps and thumbs down. */
function mh_ai_q(string $key, int $n = 1): void { if ($n <= 0) return; try { require_once __DIR__ . '/social.php'; require_once __DIR__ . '/growth.php'; mh_metric('bo_' . $key, $n); } catch (Throwable $e) {} }
const MH_AI_Q_KEYS = ['answers' => 'Answers in the chat and basic voice', 'chat_you' => 'Slips by students, caught (chat)', 'chat_bo' => 'Slips by Bo, caught (chat)', 'chat_fixed' => 'Rewritten before they saw it', 'call_you' => 'Slips by students, caught (calls)', 'call_bo' => 'Slips by Bo, caught (calls)', 'call_page' => 'Pages on calls held back until fixed', 'calls' => 'Live calls', 'reconnects' => 'Calls picked up again after a drop', 'drops' => 'Calls lost for good (no connection for a minute)', 'false_barge' => 'Bo cut off by noise or “mm-hmm”', 'call_barge' => 'Times students cut in on Bo (calls)', 'call_echo' => 'Bo’s own voice heard back and ignored (calls)', 'cut_client' => 'Bo stopped by the app', 'cut_limit' => 'Bo’s turns cut off by the length limit', 'call_errors' => 'Errors from OpenAI during calls', 'recaps' => 'Recaps after calls', 'recap_fixed' => 'Recaps rewritten before they were kept', 'flags' => 'Marked “not right” by students'];
/** The free seconds an account has: the free minutes everyone gets, plus what invites earned (none while the free minutes are off). */
function mh_ai_trial_total(int $uid, array $V): int { if ($V['trial'] <= 0) return 0; $st = mh_ai_db()->prepare('SELECT bonus FROM ai_trial WHERE user_id = ?'); $st->execute([$uid]); return $V['trial'] + (int)$st->fetchColumn(); }
function mh_ai_trial_left(int $uid, array $V): int { return max(0, mh_ai_trial_total($uid, $V) - mh_ai_trial_used($uid)); }
/** Invites: a classmate who joins through your link gives you both more free minutes with Bo (ai_invite_minutes each,
    up to MH_AI_INVITE_CAP seconds earned per account). Returns the seconds added. */
const MH_AI_INVITE_CAP = 3600;
function mh_ai_trial_bonus(int $uid, int $secs): int {
  $db = mh_ai_db(); $db->prepare('INSERT OR IGNORE INTO ai_trial (user_id, used, first) VALUES (?, 0, ?)')->execute([$uid, time()]);
  $st = $db->prepare('SELECT bonus FROM ai_trial WHERE user_id = ?'); $st->execute([$uid]); $add = max(0, min($secs, MH_AI_INVITE_CAP - (int)$st->fetchColumn()));
  if ($add) $db->prepare('UPDATE ai_trial SET bonus = bonus + ? WHERE user_id = ?')->execute([$add, $uid]);
  return $add;
}
function mh_ai_trial_add(int $uid, int $secs): void {
  $db = mh_ai_db(); $db->prepare('INSERT OR IGNORE INTO ai_trial (user_id, used, first) VALUES (?, 0, ?)')->execute([$uid, time()]);
  $db->prepare('UPDATE ai_trial SET used = used + ? WHERE user_id = ?')->execute([max(0, $secs), $uid]);
}
/** A basic-voice call on the free minutes that is still on (its lid), so Bo answers out loud without Max. */
function mh_ai_trial_call(int $uid, $lid, array $V): bool {
  $lid = preg_replace('/[^a-f0-9]/', '', is_string($lid) ? $lid : ''); if ($lid === '') return false;
  $st = mh_ai_db()->prepare('SELECT 1 FROM ai_live WHERE id = ? AND user_id = ? AND trial = 1 AND ended = 0 AND last >= ?'); $st->execute([$lid, $uid, time() - 120]);
  return (bool)$st->fetchColumn() && mh_ai_trial_left($uid, $V) > 0;
}
/** Without Max: a call goes on only while free minutes are left; otherwise the answer names Max. */
function mh_ai_trial_or_fail(int $uid, array $V): void {
  if ($V['trial'] <= 0) mh_fail('Talking with Bo is part of Mathub Max.', 402, ['plan' => 'max']);
  if (mh_ai_trial_left($uid, $V) <= 0) mh_fail('You have used your ' . intdiv(mh_ai_trial_total($uid, $V), 60) . ' free minutes with Bo. Calls with Bo are part of Mathub Max.', 402, ['plan' => 'max', 'trial_over' => true]);
}
/** Free minutes as the page shows them, for an account without Max. */
function mh_ai_trial_public(int $uid, array $V): array { $used = mh_ai_trial_used($uid); $all = mh_ai_trial_total($uid, $V); return ['minutes' => intdiv($all, 60), 'left' => max(0, $all - $used), 'used' => $used, 'bonus' => intdiv($all - $V['trial'], 60), 'invite' => intdiv(mh_ai_invite_secs($V), 60)]; }
/** A call's seconds in credits, at the rate it started with; one row a call on the Usage page ("Calc I · 12 min"). */
function mh_ai_call_charge(array $u, array $r, int $d, int $secs, array $cfg): void {
  if ($d <= 0) return; require_once __DIR__ . '/credits.php';
  $rate = (float)($r['rate'] ?? 0) ?: (float)mh_credits_cfg($cfg)['call_strong'];
  $name = (string)$r['cid'] !== '' ? mh_ai_class_name(mh_ai_class($u, (string)$r['cid']), (string)$r['cid']) : 'A call';
  mh_credits_spend($u, 'call', (int)round($d * $rate * 1000 / 60), (string)$r['id'], $name . ' · ' . max(1, (int)round($secs / 60)) . ' min · ' . rtrim(rtrim(number_format($rate, 1), '0'), '.') . ' credits a minute', $cfg);
}
/** The free seconds an invite gives each of you (ai_invite_minutes, 10 by default; 0 turns it off). */
function mh_ai_invite_secs(array $V): int { return $V['trial'] > 0 ? 60 * max(0, min(60, (int)(mh_config()['ai_invite_minutes'] ?? 10))) : 0; }

/* A live call (OpenAI Realtime): sections as OpenAI's realtime prompting guide lays them out, short rules (the 2.x
   models follow instructions literally, so fewer and plainer is better), the teaching moves the research behind
   docs/bo-teaching.md supports, and only the tools that are registered. Then YOUR CHARACTER, HOW YOU OPEN and what he
   knows about them (mh_ai_live_instructions). */
const MH_AI_LIVE = <<<'TXT'
# Role and objective
You are Bo, the bobcat tutor on Mathub, on a live voice call with a Montana State University student. Help them understand the math in their class and do it themselves. Success is them doing the next one on their own.

# Personality and tone
- Your character (YOUR CHARACTER below) sets your manner. It never changes the facts or these rules.
- Warm but demanding: kind, never fawning. Praise only what you have checked, and name the specific thing they did well.
- Talk like a person on a call, not an assistant. Not "How can I help you today", "Great question" or "As an AI".

# Length and pace
- Most turns are one or two short sentences, under about 30 words, with at most one question, at the end. Short turns keep it a conversation: they can always ask for more.
- Explaining something new: up to about four short sentences (about 50 words) while the board shows the math, then one question to check.
- No padding: no warm-up ("So,", "Alright, so", "Great question"), no repeating back what they just said unless you are checking what they meant, no summing up what is on the board.
- After you ask them a problem, stop and wait. Silence is them thinking.
- Say math the way people say it ("x squared", "a half", "the derivative of sine is cosine"), never symbols or LaTeX. Fractions inside fractions, or several steps, go on the board, and you talk through them a line at a time.
- Vary your wording. Do not repeat the same sentence or the same opening in a call.

# Unclear audio
- Only respond to clear speech. If you are unsure of the exact words (noise, cut off, mumbled), do not guess: ask them to say it again, in a few words, differently each time.
- If they cut in, stop and go with what they said. Do not start over from the top.
- If the audio was not meant for you (someone else talking, a TV), call wait_for_user.

# Understanding what they mean
- If what they said could mean two things, check with a short question: say it back as a question ("x squared plus three x, all over two?") or ask which line they mean ("your second line, or the answer?").
- Their work is on the board: refer to it by what is there ("your second line"). If you cannot read a part, ask. Never guess a number.

# Getting the math right
- Before you tell them an answer, a step or a number is right or wrong, check it with check_math, writing what you understood as math, and go by its verdict. Say "right" or "exactly" only after it passes.
- A MATH CHECK note from the app is exact: trust it over what you heard or thought. If they push back on something that is right, stay with it kindly and show why.
- Check your own numbers the same way before you say or write them. If you slip, correct it at once in a few words ("wait, eleven minus three is eight").

# How you teach
- If you do not know where they are, ask one quick question first.
- The big idea in one sentence, then one step at a time; a concrete example before the general rule.
- New to them: work one example fully and say why each step happens, then hand them the next one.
- A wrong answer: first work out what kind of mistake it is. A slip: point at it and let them fix it. A misunderstanding: one question that goes right at it. Wrong twice: work a similar problem with them, then let them redo theirs.
- "I don't know" twice, or "just tell me": work a similar example out loud on the board, then give them theirs to try. Do not give their answer away a piece at a time.
- Check understanding with a real question (do the next step, say why, spot the mistake), never "does that make sense?".
- Once they have it, stop quizzing and move on. If they ask you to slow down, repeat or skip ahead, do it.

# Tools
- write_on_board: steps, an equation, the answer. One step per line. Say something short while it goes up; never read it back symbol by symbol.
- draw_on_board: when a picture explains it better. You can draw anything: graphs, figures, charts, 3D surfaces, contour maps, slope fields, any diagram as SVG, or a picture from the image model. Never say you can't draw something. Draw first, then walk them through it ("see where the curve crosses zero?").
- ask_on_board: a check question they answer on the board. Ask it out loud in a few words, then stop: you will be told what they picked, then react.
- mark_on_board: circle, check, cross out, underline, box, an arrow or a short note on their own writing, at a cell of the latest board picture ("C3", or "B2:D3"). Then say it in words.
- check_math: before you judge an answer or a step, and for your own numbers that are not obvious.
- remember: something worth remembering for next time (how they learn, a goal, a recurring struggle). Never sensitive personal details.
- wait_for_user: audio that was not meant for you.
- Tool results are notes for you. If one says retry, fix it quietly and try once more; otherwise carry on in words. Never mention tools, errors or notes to the student.
- Use a short lead-in ("one sec") only when a tool takes a moment. When you can just answer, answer.

# The board
- The whole screen is a board you share. They write with a pen; your pages go up as cards beside their work (near: a cell, to put one next to the work it is about).
- You see it as a picture with a grid: columns A, B, C… across the top and rows 1, 2, 3… down the side. When they tap Show Bo, look at it and help. Pictures marked "our board right now" come while they write: do not answer those, just know what is there.
- When they show their work: read it line by line, check it (check_math, kind steps), find the first mistake and why it is tempting (or tell them it is right), and talk them to the next step. Do not redo the whole problem unless they ask.
- If you notice a mistake while they write, bring it up briefly the next time you talk, before they build on it.

# Context
- What you know about them below (class, exams, weakest topics, recent mistakes, your notes, your last messages) is background. Bring it up when it fits; never recite it.
- Graded work or an exam happening right now: help with a similar example, not their answer.
- Stay on studying, their classes and student life. If you are not sure of something, say so.
- If they sound really stressed or mention self-harm: be kind and calm, and give MSU Counseling & Psychological Services at 406-994-4531, or call or text 988 (911 in an emergency).

# Language
- Speak English unless they speak to you in another language. Do not switch because of an accent or a short "mm-hmm".

# Start of the call
You speak first, in character (HOW YOU OPEN below): their first name if you know it, under about 15 words.
TXT;
/** After a dropped connection: the same call, picked up again (assets/talk.js rebuilds it). */
const MH_AI_LIVE_RESUME = <<<'TXT'
# The call is back
The connection dropped for a few seconds and the call is back. Do not greet them again or start over. In one short sentence say you lost them for a second, then pick up exactly where you left off (YOUR LAST FEW MESSAGES below).
TXT;
/** Bo's instructions for a live call: his persona, then what he knows (class, today, progress, notes, the recent chat). */
function mh_ai_live_instructions(int $uid, string $cid, ?array $C, array $in): string {
  $today = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($in['today'] ?? '')) ? (string)$in['today'] : gmdate('Y-m-d');
  $notes = mh_ai_notes($uid); $ch = mh_ai_character(mh_ai_character_id($in)); $resume = !empty($in['resume']);
  $base = MH_AI_LIVE; $ln = MH_AI_LANGS[is_string($in['lang'] ?? null) ? $in['lang'] : ''] ?? '';
  if ($ln !== '') $base = str_replace(MH_AI_LIVE_SPEAK_EN, "- Speak $ln the whole call, from your first words, with a natural accent, even when they or the page use an English term. Switch only if they ask for another language.", $base);   // their language (assets/i18n.js), never English first
  $parts = [$base . "\n\n" . $ch['who'] . "\nHOW YOU OPEN: " . $ch['hello'] . ($ln !== '' ? " Say it in $ln." : '')];
  if ($resume) $parts[] = MH_AI_LIVE_RESUME;
  if (($in['focus'] ?? '') === 'exam') $parts[] = MH_AI_EXAM_CALL;
  if ($C) $parts[] = mh_ai_digest($C);
  require_once __DIR__ . '/students.php';
  $parts[] = implode("\n", array_filter(['TODAY: ' . $today, $C ? mh_ai_upcoming($C, $today) : '', mh_ai_snapshot($in['snapshot'] ?? null), $notes ? "WHAT YOU REMEMBER ABOUT THEM:\n- " . implode("\n- ", $notes) : '', mh_student_context(mh_student_load($uid), $cid)]));
  $turns = array_slice(mh_ai_turns($uid, $cid), $resume ? -10 : -6);   // after a drop, a little more of where they were
  if ($turns) { $L = ['YOUR LAST FEW MESSAGES WITH THEM (chat or calls):']; foreach ($turns as $t) $L[] = (($t['r'] ?? '') === 'b' ? 'Bo: ' : 'Them: ') . mh_ai_clip(mh_ai_unboard((string)($t['t'] ?? '')), 240); $parts[] = implode("\n", $L); }
  return implode("\n\n", $parts);
}
/** The review call that the heads-up before an exam opens (api/growth.php, mh_exam_nudge_tick; Ask Bo's ?call=exam). */
const MH_AI_EXAM_CALL = <<<'TXT'
THIS CALL IS AN EXAM REVIEW: they came from the heads-up that an exam is a few days away (UPCOMING and READINESS, in what you know about them, say which one and when). Open by naming the exam and its day in one line, in character, then go straight to their weakest topic for it (WEAKEST TOPICS). Teach by asking: one exam-style question at a time; they work it out on the board or out loud; check it (check_math) and fix what slipped, briefly; then the next weakest topic. Explain at length only what they get wrong. When they want to stop, or after about fifteen minutes, name the one topic to practise before the exam.
TXT;
/** A message without its board pages (each one becomes a mention of its title) or notes, for short recaps. */
function mh_ai_unboard(string $t): string {
  $t = preg_replace('/\[board\+?:\s*([^\]\n]*)\]\s*\n.*?\[\/board\]/is', ' [on the board: $1] ', $t);
  $t = preg_replace('/^\s*mark\s*:.*$/mi', '', $t);   // marks on their writing
  return trim(preg_replace('/\[(board\+?|remember):[^\]]*\]|\[\/board\]/i', ' ', $t));
}
/** The tools Bo has on a call: the board (writing, drawing and asking, see assets/board-draw.js; marking the student's writing, assets/bo-pad.js), and his notes. */
function mh_ai_live_tools(): array {
  // small and stable (OpenAI's realtime guides: large schemas cost attention and get cut off), each with when to use it.
  // The page reads the arguments leniently (assets/board-draw.js, assets/talk.js), so the drawing spec is one description.
  $place = ['near' => ['type' => 'string', 'description' => 'Optional: a cell from the latest board picture ("D2") to put a new page beside that work.'],
    'page' => ['type' => 'string', 'enum' => ['new', 'add'], 'description' => 'new: a fresh page. add: keep going on the page you are on.'],
    'title' => ['type' => 'string', 'description' => 'A short title for a new page, like "Solving 2x + 3 = 11".']];
  $obj = fn(array $props, array $req) => ['type' => 'object', 'properties' => $props, 'required' => $req];
  return [
    ['type' => 'function', 'name' => 'write_on_board', 'description' => 'Use when: the steps of a problem, an equation, a formula or the answer should be on the board while you talk. One step per line; a new problem gets a new page.',
      'parameters' => $obj($place + ['items' => ['type' => 'array', 'description' => 'One to six lines, in order.', 'items' => $obj([
        'kind' => ['type' => 'string', 'enum' => ['step', 'math', 'answer', 'tip', 'text', 'code']],
        'text' => ['type' => 'string', 'description' => 'step: a few words, then its math in $...$. math: just the LaTeX. answer: the result. tip, text: one short line. code: the code.'],
        'lang' => ['type' => 'string', 'description' => 'code only: its language.']], ['kind', 'text'])]], ['items'])],
    ['type' => 'function', 'name' => 'draw_on_board', 'description' => 'Use when: a picture explains it better than words. You can draw anything: a graph, number line, triangle or figure, unit circle, table, chart, normal curve, probability tree, Venn diagram, flow chart, a 3D surface, a contour map, a slope field, any diagram as SVG (a cell, a circuit, a map, a timeline, a molecule), or a picture made by an image model. Draw first, then talk them through it. Never say you cannot draw something.',
      'parameters' => $obj($place + ['caption' => ['type' => 'string', 'description' => 'One short line: what to notice.'],
        'drawing' => ['type' => 'object', 'description' => 'type, plus only the keys that type uses. Labels are short plain text (x^2, θ, π, 1/2). Functions are in x with + - * / ^ ( ) sqrt abs sin cos tan ln log exp pi e.'
          . ' graph: fns [{f:"x^2 - 3", label, color, dash, domain:[a,b]} or {x:"cos(t)", y:"sin(t)", t:[0,6.28]}], x:[min,max], y:[min,max], points [{x,y,label,open}], shade {f,g,from,to}, segments [{from:[x,y],to:[x,y],label,arrow,dash}], vlines [{x,label}], hlines [{y,label}], notes [{x,y,text}], asymptotes ["x = 2"], tangent {f,at}, secant {f,from,to}, riemann {f,from,to,n,rule:left|right|mid|trap}, sliders [{name,min,max,value,step}] (letters used in f, at or n), xlabel, ylabel, equal.'
          . ' numberline: min, max, points [{x,label,open}], intervals [{from,to,left:open|closed,right:open|closed}] (leave out from or to for a ray).'
          . ' figure: shapes [{kind:point|segment|arrow|polygon|curve|circle|angle|text|rect, at, from, to, points, labels, center, r, w, h, label, text, right}] in coordinates you choose, y up.'
          . ' unitcircle: highlight (degrees). table: head [..], rows [[..]]. bars: bars [{label,value}], hist, highlight. pie: slices [{label,value}], highlight.'
          . ' scatter: points [{x,y}], fit, residuals, predict. boxplot: boxes [{label, data} or {label,min,q1,median,q3,max}]. normal: mean, sd, from, to, tails:"both", label.'
          . ' tree: branches [{label, p:"1/2", children:[...], result:"HH 1/4"}]. venn: sets [2 or 3 names], values {"A":5,"AB":2,"B":3,"none":4}, shaded ["A ∩ B"]. flow: steps ["...", "Is it done?"], loops [{from,to,label}].'
          . ' A graph can also have: implicit "x^2 + y^2 = 25" (any equation in x and y), polar curves in fns [{r:"1 + cos(t)"}] (t is θ), slopefield {dy:"x - y", through:[[0,1]]} (solution curves through those points), vectorfield {vx:"-y", vy:"x"}, contour {z:"x^2 + y^2", levels:8, fill:true}.'
          . ' surface (3D): z:"x^2 - y^2", x:[a,b], y:[a,b], curves [{x:"cos(t)", y:"sin(t)", z:"t/4", t:[0,12.6]}], points [[x,y,z,"label"]]; they can turn it.'
          . ' svg: any diagram the other types do not cover: svg:"<svg viewBox=\'0 0 400 260\'>shapes, paths, text, gradients, markers</svg>", alt; no scripts, images or links; clear labels; it sits on white.'
          . ' image: a picture made by an image model, when a realistic or illustrated picture helps more than a diagram (an animal, a scene, an object, a labelled illustration): prompt (what to draw, in detail), shape square|wide|tall, style diagram|illustration|photo. It costs the student credits and takes a few seconds, so only when it really helps.',
          'properties' => ['type' => ['type' => 'string', 'enum' => ['graph', 'numberline', 'figure', 'unitcircle', 'table', 'bars', 'pie', 'scatter', 'boxplot', 'normal', 'tree', 'venn', 'flow', 'surface', 'svg', 'image']]], 'required' => ['type']]], ['drawing'])],
    ['type' => 'function', 'name' => 'ask_on_board', 'description' => 'Use when: you want them to answer a check question right on the board, by tapping a choice or typing. Ask it out loud in a few words too, then stop: you will be told what they picked.',
      'parameters' => $obj($place + ['question' => ['type' => 'string', 'description' => 'Short; math in $...$.'], 'choices' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Two to four choices; leave out for a typed answer.'],
        'answer' => ['type' => 'string', 'description' => 'The right choice exactly as written, or the typed answer you accept.'], 'why' => ['type' => 'string', 'description' => 'One sentence on why, shown once they answer.']], ['question', 'answer'])],
    ['type' => 'function', 'name' => 'mark_on_board', 'description' => 'Use when: pointing at their own writing, like a tutor with a pen: circle a mistake, check what is right, cross out, underline, box, an arrow, or a short note. Places are cells of the grid on the latest board picture.',
      'parameters' => $obj(['marks' => ['type' => 'array', 'description' => 'One to four marks.', 'items' => $obj(['at' => ['type' => 'string', 'description' => 'A cell ("C3") or a block ("B2:D3").'],
        'kind' => ['type' => 'string', 'enum' => ['circle', 'check', 'cross', 'underline', 'box', 'arrow', 'note']], 'text' => ['type' => 'string', 'description' => 'note: under 30 characters.']], ['at', 'kind'])]], ['marks'])],
    ['type' => 'function', 'name' => 'check_math', 'description' => 'Use when: before you say whether their answer or step is right, and for your own numbers that are not obvious. Write what you understood as math. Exact and instant; go by its verdict.',
      'parameters' => $obj(['kind' => ['type' => 'string', 'enum' => ['value', 'equal', 'solves', 'solve', 'derivative', 'antiderivative', 'limit', 'steps'], 'description' => 'value: what expression is. equal: left vs right. solves: do values solve equation. solve: the solutions of equation. derivative, antiderivative: is answer that of f. limit: is answer the limit of f as x goes to at. steps: does each of lines follow from the one before.'],
        'expression' => ['type' => 'string', 'description' => 'value: like "11 - 3" or "sqrt(50)"; LaTeX is fine.'], 'left' => ['type' => 'string'], 'right' => ['type' => 'string'],
        'equation' => ['type' => 'string', 'description' => 'Like "2x + 3 = 11".'], 'values' => ['type' => 'string', 'description' => 'Like "x = 6".'],
        'f' => ['type' => 'string', 'description' => 'In x, like "x^3 - 2x".'], 'answer' => ['type' => 'string', 'description' => 'What they say it is; for a limit a number, "inf", "-inf" or "dne".'],
        'at' => ['type' => 'string', 'description' => 'limit: what x goes to.'], 'lines' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'steps: the lines in order, like ["2x + 3 = 11", "2x = 8", "x = 4"].']], ['kind'])],
    ['type' => 'function', 'name' => 'remember', 'description' => 'Use when: they tell you something worth remembering next time (how they learn best, a goal, a recurring struggle). Never sensitive personal details.', 'parameters' => $obj(['fact' => ['type' => 'string', 'description' => 'Under 20 words.']], ['fact'])],
    ['type' => 'function', 'name' => 'wait_for_user', 'description' => 'Use when: the audio was not meant for you (someone else talking, a TV, background noise). Ends your turn without speaking. Do not use it when they talk to you, even if it was unclear: ask them to repeat instead.', 'parameters' => ['type' => 'object', 'properties' => new stdClass()]],
  ];
}

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

/** A stored photo for the AI: as it is when it is small enough, otherwise made smaller (at most 2000 px, as a JPEG). */
function mh_ai_photo(string $bin, string $type): array {
  if (strlen($bin) <= 3500000 || !function_exists('imagecreatefromstring')) return ['type' => $type, 'data' => base64_encode($bin)];
  $im = @imagecreatefromstring($bin); if (!$im) return ['type' => $type, 'data' => base64_encode($bin)];
  $w = imagesx($im); $h = imagesy($im); $k = min(1, 2000 / max($w, $h)); $out = imagescale($im, max(1, (int)round($w * $k)), max(1, (int)round($h * $k)));
  ob_start(); imagejpeg($out ?: $im, null, 85); $jpg = (string)ob_get_clean();
  return ['type' => 'image/jpeg', 'data' => base64_encode($jpg)];
}
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
  if ($route === 'ai_image' || $route === 'ai_image_file') { require_once __DIR__ . '/images.php'; mh_img_route($route, $in, $cfg); }   // Bo's pictures
  if ($route === 'ai_compact' || $route === 'ai_student') { require_once __DIR__ . '/students.php'; mh_student_route($route, $in, $cfg); }   // the student file, and long calls kept short
  require_once __DIR__ . '/credits.php'; require_once __DIR__ . '/students.php';   // everything with Bo is paid in credits, and reads the student file
  $A = mh_ai_settings($cfg); $db = mh_ai_db();
  switch ($route) {
    case 'ai_status': {
      mh_method('GET'); $u = mh_current_user();
      $plan = $u ? mh_plan($u, $cfg) : '';
      $out = ['ok' => true, 'enabled' => $A['key'] !== '', 'signed_in' => (bool)$u, 'plan' => $plan, 'pro' => $plan !== '', 'max' => $plan === 'max'];
      $V = mh_ai_voice_settings($cfg); $out['trial_minutes'] = $A['key'] !== '' ? intdiv($V['trial'], 60) : 0; $out['voice'] = ['natural' => $V['key'] !== '', 'voices' => MH_AI_VOICES, 'default' => $V['voice'], 'live' => $V['key'] !== '', 'live_voices' => MH_AI_LIVE_VOICES, 'live_default' => $V['live_voice']];
      if ($u) {
        $use = mh_ai_usage((int)$u['id']); $out['notes'] = mh_ai_notes((int)$u['id']);
        $out['usage'] = ['tutor' => $use['tutor'], 'tutor_limit' => $A['tutor_monthly'], 'classes' => $use['classes'], 'class_limit' => $A['class_monthly'], 'voice' => $use['voice'], 'voice_limit' => $V['voice_monthly'], 'listen' => $use['listen'], 'listen_limit' => $V['listen_monthly'], 'live' => $use['live'], 'live_limit' => $V['live_monthly'], 'live_left' => mh_ai_live_left((int)$u['id'], $V)];
        // credits (api/credits.php): everything with Bo is paid from them, on any plan
        require_once __DIR__ . '/credits.php'; $CL = mh_credits_left($u, $cfg, $plan); $CC = mh_credits_cfg($cfg);
        $out['admin'] = $CL['admin'];
        $out['credits'] = ['left' => round($CL['left'] / 1000, 1), 'allowance' => round($CL['allowance'] / 1000), 'month_left' => round($CL['month_left'] / 1000, 1), 'paid' => round(max(0, $CL['paid']) / 1000, 1), 'resets' => gmdate('Y-m-d', (int)strtotime('first day of next month 00:00 UTC')), 'call_rate' => $plan === 'max' ? $CC['call_strong'] : $CC['call_light'], 'image' => $CC['image'], 'pack' => $CC['pack'], 'price' => $CC['price'], 'plans' => ['free' => $CC['free'], 'pro' => $CC['pro'], 'max' => $CC['max']], 'out' => !$CL['admin'] && $CL['left'] < 1000];
        $out['voice']['live'] = $out['voice']['live'] && $out['usage']['live_left'] > 0;   // out of credits: the call says how to get more
        $out['voice']['natural'] = $out['voice']['natural'] && $use['voice'] < $V['voice_monthly']; $out['voice']['listen'] = $V['key'] !== '' && $use['listen'] < $V['listen_monthly'];

      } else $out['voice']['listen'] = $V['key'] !== '';
      mh_json($out);
    }
    case 'ai_thread': {
      mh_method('GET'); $u = mh_require_user(); $cid = mh_ai_cid($_GET['class'] ?? '');
      mh_json(['ok' => true, 'turns' => mh_ai_turns((int)$u['id'], $cid), 'notes' => mh_ai_notes((int)$u['id'])]);
    }
    case 'ai_forget': {
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id']; $what = (string)($in['what'] ?? '');
      require_once __DIR__ . '/students.php'; $SF = mh_student_load($uid);
      if ($what === 'chat') { $c0 = mh_ai_cid($in['class'] ?? ''); $db->prepare('DELETE FROM ai_threads WHERE user_id = ? AND cid = ?')->execute([$uid, $c0]); unset($SF['memory']['chat'][$c0]); mh_student_save($uid, $SF); }
      elseif ($what === 'note') { $notes = mh_ai_notes($uid); $i = (int)($in['i'] ?? -1); if (isset($notes[$i])) { array_splice($notes, $i, 1); mh_ai_save_notes($uid, $notes); } }
      elseif ($what === 'notes') { $db->prepare('DELETE FROM ai_notes WHERE user_id = ?')->execute([$uid]); }
      elseif ($what === 'all') { foreach (['ai_threads', 'ai_notes', 'ai_flags'] as $t) $db->prepare("DELETE FROM $t WHERE user_id = ?")->execute([$uid]); mh_student_save($uid, mh_student_blank()); }
      else mh_fail('Nothing to forget.', 400);
      mh_json(['ok' => true, 'notes' => mh_ai_notes($uid)]);
    }
    case 'ai_tutor': {
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id'];
      // Bo on every page (the floating Bo) comes with Pro; Ask Bo's own page with Max
      $plan = mh_plan($u, $cfg); $float = !empty($in['float']);
      require_once __DIR__ . '/credits.php'; mh_credits_need($u, 1000, $cfg, 'a message');   // any plan: paid in credits
      $use = mh_ai_usage($uid); if ($use['tutor'] >= $A['tutor_monthly']) mh_fail('You have used this month\'s ' . $A['tutor_monthly'] . ' questions for Bo. They start again on the 1st.', 429);
      $cid = mh_ai_cid($in['class'] ?? ''); $q = mh_ai_clip($in['q'] ?? '', 2000);
      $img = isset($in['image']) ? mh_ai_file($in['image'], ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], MH_AI_IMAGE_BYTES) : null;
      $pdf = isset($in['file']) ? mh_ai_file($in['file'], ['application/pdf'], MH_AI_PDF_BYTES) : null;   // a problem set
      $pdfName = $pdf ? (mh_ai_plain($in['file']['name'] ?? '', 60) ?: 'PDF') : '';
      // the photo is the board they share on a call, with its grid (assets/bo-pad.js): how many columns and rows
      $pad = $img && is_array($in['pad'] ?? null) ? ['cols' => max(1, min(12, (int)($in['pad']['cols'] ?? 0))), 'rows' => max(1, min(12, (int)($in['pad']['rows'] ?? 0)))] : null;
      // asked from a page (the floating Bo): what is on it, what they pointed at, and the page's name for the chat
      $screen = mh_ai_clip($in['screen'] ?? '', MH_AI_SCREEN_CHARS); $focus = mh_ai_clip($in['focus'] ?? '', 3000); $from = mh_ai_plain($in['where'] ?? '', 80);
      if ($q === '' && !$img && !$pdf) mh_fail('Ask Bo something first.', 400);
      mh_rate_or_fail("ai_tutor:$uid", 12, 60, 'Slow down a little: Bo answers up to 12 questions a minute.');
      mh_rate_or_fail("ai_tutor_day:$uid", $A['tutor_daily'], 86400, 'That is a lot of questions for one day. Bo will be back tomorrow.');
      $C = mh_ai_class($u, $cid);
      mh_credits_for($u, $cfg, 'chat', mh_ai_class_name($C, $cid) . ' · ' . (!empty($in['voice']) ? 'voice' : ($float ? 'on a page' : 'chat')));
      $today = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($in['today'] ?? '')) ? (string)$in['today'] : gmdate('Y-m-d');
      $system = [['type' => 'text', 'text' => MH_AI_BO_FULL]];
      if ($C) $system[] = ['type' => 'text', 'text' => mh_ai_digest($C), 'cache_control' => ['type' => 'ephemeral']];
      else $system[0]['cache_control'] = ['type' => 'ephemeral'];
      $voice = !empty($in['voice']); $stream = !empty($in['stream']);
      $notes = mh_ai_notes($uid);
      require_once __DIR__ . '/students.php'; $SF = mh_student_update($u, $cfg, $in, $cid, $C);   // the student file: kept up to date, and read
      $now = array_filter(['TODAY: ' . $today, $C ? mh_ai_upcoming($C, $today) : '', mh_ai_snapshot($in['snapshot'] ?? null), $notes ? "WHAT BO REMEMBERS ABOUT THEM:\n- " . implode("\n- ", $notes) : '', mh_student_context($SF, $cid)]);
      $system[] = ['type' => 'text', 'text' => implode("\n", $now)];
      $system[] = ['type' => 'text', 'text' => mh_ai_character(mh_ai_character_id($in))['who']];   // who he is (assets/bo-characters.js)
      if ($voice) $system[] = ['type' => 'text', 'text' => MH_AI_VOICE];
      if ($voice && ($in['focus'] ?? '') === 'exam') $system[] = ['type' => 'text', 'text' => MH_AI_EXAM_CALL];
      if ($pad) $system[] = ['type' => 'text', 'text' => str_replace(['%COLS%', '%ROWS%'], [(string)$pad['cols'], (string)$pad['rows']], MH_AI_PAD)];
      elseif ($img && !empty($in['sketch'])) $system[] = ['type' => 'text', 'text' => MH_AI_SKETCH];
      if (($lang = mh_ai_lang($in)) !== '') $system[] = ['type' => 'text', 'text' => $lang];
      if ($screen !== '' || $focus !== '' || $pdf) $system[] = ['type' => 'text', 'text' => implode("\n\n", array_filter([$screen !== '' ? MH_AI_SCREEN . "\n\nTHE PAGE:\n" . $screen : '', $focus !== '' ? MH_AI_FOCUS . "\n" . $focus : '', $pdf ? MH_AI_FILE : '']))];
      // the last few turns, oldest first, starting with the student
      $turns = mh_ai_turns($uid, $cid); $msgs = [];
      foreach (array_slice($turns, -MH_AI_TURNS_SENT) as $t) { $role = ($t['r'] ?? '') === 'b' ? 'assistant' : 'user'; $txt = mh_ai_clip($t['t'] ?? '', $role === 'assistant' ? 2400 : 900); if ($txt === '') continue; if ($msgs && end($msgs)['role'] === $role) { $msgs[count($msgs) - 1]['content'] .= "\n" . $txt; continue; } $msgs[] = ['role' => $role, 'content' => $txt]; }
      while ($msgs && $msgs[0]['role'] !== 'user') array_shift($msgs);
      if ($msgs && end($msgs)['role'] === 'user') array_pop($msgs);
      $content = []; if ($img) $content[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $img['type'], 'data' => $img['data']]];
      if ($pdf) $content[] = ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $pdf['data']]];
      $mcWrong = [];
      // the math check (api/mathcheck.php): what they wrote or said, checked exactly, with the problem and question from Bo's last message
      if ($q !== '') { require_once __DIR__ . '/mathcheck.php'; $lastBo = ''; foreach (array_reverse($turns) as $t) if (($t['r'] ?? '') === 'b') { $lastBo = (string)($t['t'] ?? ''); break; } $mcr = mh_mc_check_message($q, $lastBo); $mcWrong = $mcr['wrong']; mh_ai_q($voice ? 'call_you' : 'chat_you', count($mcWrong)); if ($mcr['note'] !== '') $system[] = ['type' => 'text', 'text' => $mcr['note']]; }
      $content[] = ['type' => 'text', 'text' => $q !== '' ? $q : 'Can you help me with this?'];
      $msgs[] = ['role' => 'user', 'content' => $content];
      @set_time_limit(90);
      $max = $voice ? 800 : ($pdf ? 2000 : 1500);   // room for a page of the board, with a drawing (more for a whole problem set)
      if ($stream) { @ignore_user_abort(true); $r = mh_ai_stream($A, $A['tutor_model'], $system, $msgs, $max, 60, function (string $t): void { mh_ai_emit(['t' => 'd', 'x' => $t]); }); }
      else $r = mh_ai_call($A, $A['tutor_model'], $system, $msgs, $max, 60);
      $reply = trim($r['text']); $remembered = null;
      if (preg_match_all('/^\s*\[remember:\s*(.+?)\]\s*$/mi', $reply, $mm)) {
        foreach ($mm[1] as $fact) { $fact = mh_ai_clip($fact, 140); if ($fact !== '' && !in_array($fact, $notes, true)) { $notes[] = $fact; $remembered = $fact; } }
        mh_ai_save_notes($uid, $notes); $reply = trim(preg_replace('/^\s*\[remember:.*\]\s*$/mi', '', $reply));
      }
      // his own math, checked (api/mathcheck.php): a slip on a page or in what he says is fixed before it is kept.
      // Typed: he writes the reply again with the slip named (the chat shows the fixed one). Out loud: it was spoken as it
      // streamed, so he says the correction too.
      if ($reply !== '') { require_once __DIR__ . '/mathcheck.php'; $slips = mh_mc_reply_slips($reply);
        if ($slips) mh_ai_q($voice ? 'call_bo' : 'chat_bo');
        if ($slips && $voice) { $fix = 'Wait, my slip: ' . mh_mc_say($slips[0]) . '.'; if ($stream) mh_ai_emit(['t' => 'd', 'x' => "\n\n" . $fix]); $reply .= "\n\n" . $fix; }
        elseif ($slips) {
          $again = $msgs; $again[] = ['role' => 'assistant', 'content' => $reply]; $again[] = ['role' => 'user', 'content' => 'MATH CHECK (exact, worked out by the app) on your reply: ' . implode('; ', $slips) . '. Write your whole reply again with that fixed, in the same format. Do not mention this note.'];
          try { $r2 = mh_ai_call($A, $A['tutor_model'], $system, $again, $max, 60); $t2 = trim(preg_replace('/^\s*\[remember:.*\]\s*$/mi', '', (string)$r2['text'])); $r['in'] += $r2['in']; $r['out'] += $r2['out']; if ($t2 !== '' && !mh_mc_reply_slips($t2)) { $reply = $t2; mh_ai_q('chat_fixed'); } } catch (Throwable $e) {}
        }
      }
      if ($reply === '') $reply = 'Sorry, I lost my train of thought. Could you ask that again?';
      $turns[] = array_merge(['r' => 'u', 't' => ($img ? ($pad || !empty($in['sketch']) ? '[board] ' : '[photo] ') : '') . ($pdf ? '[pdf: ' . str_replace(']', ')', $pdfName) . '] ' : '') . ($from !== '' ? '[from: ' . str_replace(']', ')', $from) . '] ' : '') . $q, 'at' => time()], $voice ? ['v' => 1] : []); $turns[] = array_merge(['r' => 'b', 't' => $reply, 'at' => time()], $voice ? ['v' => 1] : []);
      mh_ai_save_turns($uid, $cid, $turns); mh_ai_count($uid, 'tutor', $r['in'], $r['out']); mh_ai_q('answers');
      $out = ['ok' => true, 'reply' => $reply, 'at' => $turns[count($turns) - 1]['at'], 'remembered' => $remembered, 'cut' => in_array($r['stop'], ['max_tokens', 'cut'], true), 'usage' => ['tutor' => $use['tutor'] + 1, 'tutor_limit' => $A['tutor_monthly']]];
      try { $CLx = mh_credits_left($u, $cfg, $plan); $out['credits'] = ['left' => round($CLx['left'] / 1000, 1), 'admin' => $CLx['admin']]; } catch (Throwable $e) {}   // what is left after this answer
      if (!empty($mcWrong)) { $out['slips'] = array_column($mcWrong, 'msg'); $out['practice'] = mh_mc_practice($mcWrong); }   // what the math check caught: for the call's recap and the mistakes notebook
      // once the answer is out: a long chat's older turns are folded into its summary (api/students.php)
      register_shutdown_function(function () use ($u, $cfg, $cid) { if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request(); elseif (function_exists('litespeed_finish_request')) @litespeed_finish_request(); try { mh_student_compact_chat($u, $cfg, $cid); } catch (Throwable $e) { error_log('mathub compact: ' . $e->getMessage()); } });
      if ($stream) { mh_ai_emit(['t' => 'done'] + $out); exit; }
      mh_json($out);
    }
    case 'ai_speak': {
      // a sentence or two of Bo's reply, spoken in his natural voice; the browser plays it (no audio is kept)
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id'];
      $V = mh_ai_voice_settings($cfg);
      require_once __DIR__ . '/credits.php'; mh_credits_need($u, 1000, $cfg, 'Bo’s voice'); if ($V['key'] === '') mh_fail('Bo\'s natural voice is not switched on, so your device\'s voice is used.', 503, ['fallback' => true]);
      $text = mh_ai_clip($in['text'] ?? '', 700); if ($text === '') mh_fail('Nothing to say.', 400);
      $voice = is_string($in['voice'] ?? null) && isset(MH_AI_VOICES[$in['voice']]) ? $in['voice'] : $V['voice'];
      $use = mh_ai_usage($uid); if ($use['voice'] + mb_strlen($text) > $V['voice_monthly']) mh_fail('Bo\'s natural voice has been used a lot this month, so your device\'s voice takes over until the 1st.', 429, ['fallback' => true]);
      mh_rate_or_fail("ai_speak:$uid", 90, 60, 'Bo is talking a lot. Your device\'s voice takes over for a minute.');
      @set_time_limit(45);
      [, $audio, $type] = mh_ai_openai($V, '/audio/speech', json_encode(['model' => $V['tts_model'], 'voice' => $voice, 'input' => $text, 'response_format' => 'mp3',
        'instructions' => 'You are Bo, a friendly bobcat who tutors college students. Voice: warm, upbeat and encouraging, like a favourite tutor. Pace: natural and relaxed, a little slower through math. Read math the way a teacher says it aloud. Never sound robotic.' . (is_string($in['lang'] ?? null) && isset(MH_AI_LANGS[$in['lang']]) ? ' Speak ' . MH_AI_LANGS[$in['lang']] . ' with a natural native accent.' : '')], JSON_UNESCAPED_UNICODE), 40);
      mh_ai_add($uid, 'voice', mb_strlen($text)); mh_credits_spend($u, 'voice', (int)ceil(mb_strlen($text) * mh_credits_cfg($cfg)['tts']), 'speak-' . gmdate('YmdH'), 'Bo’s voice, read out', $cfg);   // per 1,000 characters
      http_response_code(200); header('Content-Type: ' . (preg_match('#^audio/[a-z0-9.+-]+$#i', $type) ? $type : 'audio/mpeg')); header('Cache-Control: no-store'); header('Content-Length: ' . strlen($audio));
      echo $audio; exit;
    }
    case 'ai_listen': {
      // a short recording of the student, turned into text (for browsers without their own speech recognition)
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id'];
      $V = mh_ai_voice_settings($cfg);
      require_once __DIR__ . '/credits.php'; mh_credits_need($u, 500, $cfg, 'listening'); if ($V['key'] === '') mh_fail('Listening is not switched on here. Type your question instead.', 503, ['fallback' => true]);
      $a = is_array($in['audio'] ?? null) ? $in['audio'] : []; $type = strtolower(trim(explode(';', (string)($a['type'] ?? ''))[0]));
      $ext = ['audio/webm' => 'webm', 'audio/ogg' => 'ogg', 'audio/mp4' => 'mp4', 'audio/x-m4a' => 'm4a', 'audio/aac' => 'm4a', 'audio/mpeg' => 'mp3', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav'][$type] ?? '';
      if ($ext === '') mh_fail('That recording could not be read.', 400);
      $data = preg_replace('/\s+/', '', (string)($a['data'] ?? '')); if ($data === '' || !preg_match('/^[A-Za-z0-9+\/]+=*$/', $data)) mh_fail('That recording could not be read.', 400);
      if ((int)(strlen($data) * 3 / 4) > 4000000) mh_fail('That was a long one. Keep it under two minutes.', 413);
      $secs = max(1, min(120, (int)($in['secs'] ?? 10)));
      $use = mh_ai_usage($uid); if ($use['listen'] + $secs > $V['listen_monthly']) mh_fail('Bo has listened a lot this month. Type your questions until the 1st.', 429);
      mh_rate_or_fail("ai_listen:$uid", 30, 60, 'Slow down a little: Bo listens to up to 30 questions a minute.');
      // the class's own words help it hear math and topic names right
      $C = isset($in['class']) && is_string($in['class']) && preg_match('/^[a-z0-9][a-z0-9_-]{0,40}$/', $in['class']) ? mh_ai_class($u, $in['class']) : null;
      $hint = 'A college student talking with their tutor about math and their class.';
      if ($C) { $words = [mh_ai_plain($C['code'] ?? '', 20), mh_ai_plain($C['name'] ?? '', 60)]; foreach (array_slice((array)($C['SECTIONS'] ?? []), 0, 40) as $sec) if (is_array($sec)) $words[] = mh_ai_plain($sec['title'] ?? '', 40); $hint .= ' Topics: ' . mb_substr(implode(', ', array_filter($words)), 0, 600); }
      $bin = base64_decode($data); @set_time_limit(60);
      $file = class_exists('CURLStringFile') ? new CURLStringFile($bin, 'speech.' . $ext, $type) : null;
      $tmp = null; if (!$file) { $tmp = tempnam(sys_get_temp_dir(), 'mhs'); file_put_contents($tmp, $bin); $file = new CURLFile($tmp, $type, 'speech.' . $ext); }
      try { [, $raw] = mh_ai_openai($V, '/audio/transcriptions', ['model' => $V['stt_model'], 'file' => $file, 'language' => is_string($in['lang'] ?? null) && isset(MH_AI_LANGS[$in['lang']]) ? $in['lang'] : 'en', 'prompt' => $hint, 'response_format' => 'json'], 50); }
      finally { if ($tmp) @unlink($tmp); }
      $j = json_decode($raw, true); $text = mh_ai_clip(is_array($j) ? ($j['text'] ?? '') : '', 2000);
      mh_ai_add($uid, 'listen', $secs); mh_credits_spend($u, 'voice', (int)ceil($secs * mh_credits_cfg($cfg)['stt'] * 1000 / 60), 'listen-' . gmdate('YmdH'), 'Bo listening', $cfg);
      mh_json(['ok' => true, 'text' => $text]);
    }
    case 'ai_live_start': {
      // a live call: the browser's WebRTC offer in, OpenAI's answer out, with Bo's instructions added here
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id']; $V = mh_ai_voice_settings($cfg);
      $plan = mh_plan($u, $cfg); $trial = false;   // every call is paid in credits (api/credits.php), on any plan
      if ($V['key'] === '') mh_fail('Live calls are not switched on yet.', 503, ['fallback' => true]);
      $left = mh_ai_live_left($uid, $V); if ($left <= 0) mh_fail(mh_ai_usage($uid)['live'] >= $V['live_monthly'] ? 'That is all the live call time for this month. It starts again on the 1st.' : 'That is a lot of calling for one day. Bo is around again tomorrow.', 429, ['fallback' => true]);
      // credits: at least a minute's worth, and the call ends when they run out (ai_live_tick)
      require_once __DIR__ . '/credits.php'; $CC = mh_credits_cfg($cfg);
      $strong = $V['live_model_max'] !== '' ? $V['live_model_max'] : $V['live_model'];
      $model = $plan === 'max' ? $strong : $V['live_model'];   // Max: the stronger model; the others: the light one
      $rate = mh_credits_call_rate($model, $V, $CC);
      mh_credits_need($u, (int)ceil($rate * 1000), $cfg, 'a call (' . rtrim(rtrim(number_format($rate, 1), '0'), '.') . ' credits a minute)');
      if (!mh_is_admin($u)) $left = min($left, (int)floor(mh_credits_left($u, $cfg, $plan)['left'] / ($rate * 1000) * 60));
      // a call that dropped and is being picked up again (assets/talk.js): the same call, with its minutes so far
      $prev = null; $resume = preg_replace('/[^a-f0-9]/', '', (string)($in['resume'] ?? ''));
      if ($resume !== '') { $st = $db->prepare('SELECT * FROM ai_live WHERE id = ? AND user_id = ? AND started >= ?'); $st->execute([$resume, $uid, time() - 7200]); $prev = $st->fetch() ?: null; }
      if ($prev && $V['live_call'] - (int)$prev['secs'] <= 30) $prev = null;   // that call had reached its length anyway: a new one
      if ($prev) mh_rate_or_fail("ai_live_resume:$uid", 40, 3600, 'The connection keeps dropping. Try the call again in a bit.');
      else mh_rate_or_fail("ai_live:$uid", 30, 3600, 'That is a lot of calls in an hour. Try again in a bit.');
      $sdp = str_replace("\r\n", "\n", (string)($in['sdp'] ?? '')); if (strncmp($sdp, 'v=0', 3) !== 0 || strlen($sdp) > 30000) mh_fail('The call could not start.', 400);
      $sdp = str_replace("\n", "\r\n", $sdp);
      $cid = mh_ai_cid($in['class'] ?? ''); $C = mh_ai_class($u, $cid);
      $ch = mh_ai_character(mh_ai_character_id($in));   // his character: his voice and pace unless they picked others
      $voice = is_string($in['voice'] ?? null) && isset(MH_AI_LIVE_VOICES[$in['voice']]) ? $in['voice'] : $ch['live'];
      $speed = round(max(0.8, min(1.25, (float)($in['speed'] ?? $ch['speed']))), 2); $eager = in_array($in['eagerness'] ?? '', ['low', 'auto', 'high'], true) ? $in['eagerness'] : 'auto';
      $headset = ($in['mic'] ?? '') === 'headset';   // the page guesses from the microphone's name, or they said so in the call's settings
      // what is said is also written down (captions, the app's math check): in their language, with the class's words
      $lc = is_string($in['lang'] ?? null) && isset(MH_AI_LANGS[$in['lang']]) ? $in['lang'] : 'en';
      $kw = ['derivative', 'integral', 'limit', 'squared', 'cubed', 'square root', 'fraction', 'denominator', 'numerator', 'exponent', 'logarithm', 'sine', 'cosine', 'tangent', 'slope', 'asymptote', 'chain rule', 'Mathub', 'Bo'];
      if ($C) { $w = mh_ai_plain($C['code'] ?? '', 20); if ($w !== '') $kw[] = $w; foreach (array_slice((array)($C['SECTIONS'] ?? []), 0, 40) as $sec) if (is_array($sec)) { $w = mh_ai_plain($sec['title'] ?? '', 40); if ($w !== '' && mb_strlen($w) <= 32) $kw[] = $w; } }
      $kw = array_slice(array_values(array_unique($kw)), 0, 40);
      $tm = $V['live_transcribe'];
      $transcribe = str_starts_with($tm, 'gpt-4o') || $tm === 'whisper-1'
        ? ['model' => $tm, 'language' => $lc, 'prompt' => 'A college student on a call with their tutor about math. ' . implode(', ', $kw)]
        : ['model' => $tm, 'languages' => array_values(array_unique([$lc, 'en'])), 'keywords' => $kw];
      require_once __DIR__ . '/students.php'; mh_student_update($u, $cfg, $in, $cid, $C);
      $sys = mh_ai_live_instructions($uid, $cid, $C, ['resume' => $prev ? 1 : 0] + $in);
      if (($lang = mh_ai_lang($in)) !== '') $sys .= "\n\n" . $lang . ' On the call, speak it with a natural accent.';
      // Max: the stronger model. Free minutes: the light one, except without headphones, where the light one is more
      // easily cut off by its own voice coming back from the speakers (docs/bo-teaching.md)
      // ($model was chosen above, with what a minute costs)
      $noise = ['type' => $headset ? 'near_field' : 'far_field'];   // near_field is for headsets; laptops and phones are far_field
      $full = ['type' => 'realtime', 'model' => $model, 'instructions' => $sys, 'output_modalities' => ['audio'], 'max_output_tokens' => 'inf',
        'truncation' => ['type' => 'retention_ratio', 'retention_ratio' => 0.8],
        'audio' => ['input' => ['noise_reduction' => $noise, 'transcription' => $transcribe,
                      'turn_detection' => ['type' => 'semantic_vad', 'eagerness' => $eager, 'create_response' => false, 'interrupt_response' => false]],   // the page answers and cuts in (assets/talk.js, Live.listen)
                    'output' => array_merge(['voice' => $voice], $speed != 1.0 ? ['speed' => $speed] : [])],
        'tools' => mh_ai_live_tools(), 'tool_choice' => 'auto'];
      if (str_contains($model, 'realtime-2')) $full['reasoning'] = ['effort' => 'low'];   // what OpenAI says to start with for voice
      // the fewest settings that still make a good call, in case the account refuses one of the others
      $lean = ['type' => 'realtime', 'model' => $model, 'instructions' => $sys, 'audio' => ['input' => ['noise_reduction' => $noise, 'transcription' => ['model' => 'gpt-4o-mini-transcribe'], 'turn_detection' => ['type' => 'semantic_vad', 'create_response' => false, 'interrupt_response' => false]], 'output' => ['voice' => $voice]], 'tools' => mh_ai_live_tools()];
      // one call at a time per account
      foreach ($db->query('SELECT id, call FROM ai_live WHERE ended = 0 AND user_id = ' . $uid)->fetchAll() as $r) { mh_ai_hangup($V, (string)$r['call']); $db->prepare('UPDATE ai_live SET ended = 1 WHERE id = ?')->execute([$r['id']]); }
      @set_time_limit(60);
      [$code, $answer, $call] = mh_ai_rtc_call($V, $sdp, $full);
      if ($code >= 400 && $code < 500 && $code !== 401 && $code !== 429) { error_log('mathub live: ' . $code . ' ' . substr($answer, 0, 300)); [$code, $answer, $call] = mh_ai_rtc_call($V, $sdp, $lean); }
      // the account cannot use the Max model: the usual one, so the call still happens
      if ($code >= 400 && $code < 500 && $code !== 401 && $code !== 429 && $model !== $V['live_model']) { error_log('mathub live: ' . $model . ' refused, using ' . $V['live_model']); $full['model'] = $V['live_model']; unset($full['reasoning']); [$code, $answer, $call] = mh_ai_rtc_call($V, $sdp, $full); if ($code >= 400 && $code < 500 && $code !== 401 && $code !== 429) { $lean['model'] = $V['live_model']; [$code, $answer, $call] = mh_ai_rtc_call($V, $sdp, $lean); } }
      if ($code < 200 || $code >= 300 || strncmp(ltrim($answer), 'v=0', 3) !== 0) { error_log('mathub live: ' . $code . ' ' . substr($answer, 0, 300)); mh_fail($code === 429 ? 'Bo is very busy right now. Try the call again in a minute.' : 'Bo could not pick up just now. Try again, or use basic voice.', 502, ['fallback' => true]); }
      $now = time(); $secs0 = $prev ? (int)$prev['secs'] : 0;
      if ($prev) {   // the same call goes on: its id, its length so far (Minutes per call), the time it was down not counted
        $lid = (string)$prev['id']; $db->prepare('UPDATE ai_live SET call = ?, last = ?, ended = 0 WHERE id = ?')->execute([$call, $now, $lid]); mh_ai_q('reconnects');
      } else { $lid = bin2hex(random_bytes(12)); $db->prepare('INSERT INTO ai_live (id, user_id, cid, call, started, last, trial, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$lid, $uid, $cid, $call, $now, $now, 0, $rate]); }
      if ($prev) $db->prepare('UPDATE ai_live SET rate = ? WHERE id = ?')->execute([$rate, $lid]);
      mh_json(['ok' => true, 'sdp' => $answer, 'lid' => $lid, 'left' => max(0, min($left, $V['live_call'] - $secs0, $trial ? mh_ai_trial_left($uid, $V) : PHP_INT_MAX)), 'voice' => $voice, 'trial' => $trial, 'resumed' => (bool)$prev]);
    }
    case 'ai_call_start': {
      // a basic voice call: Bo answers through ai_tutor, ai_speak and ai_listen, and credits pay for each of those as it
      // happens (api/credits.php), so this only checks there are some left before the call opens.
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id']; $V = mh_ai_voice_settings($cfg);
      require_once __DIR__ . '/credits.php'; mh_credits_need($u, 1000, $cfg, 'talking with Bo');
      mh_json(['ok' => true, 'lid' => '', 'trial' => false]);   // credits pay for each answer, his voice and listening
    }
    case 'ai_live_tick': {
      // the browser reports the call every half minute; the minutes are counted here and the limits kept
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id']; $V = mh_ai_voice_settings($cfg);
      $lid = preg_replace('/[^a-f0-9]/', '', (string)($in['lid'] ?? '')); $st = $db->prepare('SELECT * FROM ai_live WHERE id = ? AND user_id = ?'); $st->execute([$lid, $uid]); $r = $st->fetch();
      if (!$r) mh_fail('That call is over.', 404);
      if ((int)$r['ended']) mh_json(['ok' => true, 'left' => 0, 'end' => true]);
      $now = time(); $d = max(0, min(45, $now - (int)$r['last'])); $secs = (int)$r['secs'] + $d;
      $db->prepare('UPDATE ai_live SET secs = ?, last = ? WHERE id = ?')->execute([$secs, $now, $lid]);
      $trial = (int)($r['trial'] ?? 0) === 1;
      if ($trial) { mh_ai_trial_add($uid, $d); if ((string)$r['call'] !== '') mh_ai_add($uid, 'live', $d); }
      else { mh_ai_add($uid, 'live', $d); mh_ai_call_charge($u, $r, $d, $secs, $cfg); }   // credits, per second at the call's rate
      $left = min(mh_ai_live_left($uid, $V), $V['live_call'] - $secs); if ($trial) $left = (string)$r['call'] === '' ? mh_ai_trial_left($uid, $V) : min($left, mh_ai_trial_left($uid, $V));
      $outOfTime = false;
      if (!$trial && !mh_is_admin($u)) {   // out of credits: the call ends (a pack bought a moment ago counts)
        $rate = (float)($r['rate'] ?? 0) ?: (float)mh_credits_cfg($cfg)['call_strong']; $CL = mh_credits_left($u, $cfg);
        if ($CL['left'] < 1000 && mh_credits_sync($u, $cfg) > 0) $CL = mh_credits_left($u, $cfg);
        $can = (int)floor($CL['left'] / ($rate * 1000) * 60); $outOfTime = $can <= 0; $left = min($left, $can);
      }
      if ($trial && (string)$r['call'] === '' && !empty($in['end'])) { $db->prepare('UPDATE ai_live SET ended = 1 WHERE id = ?')->execute([$lid]); mh_json(['ok' => true, 'left' => mh_ai_trial_left($uid, $V), 'end' => true]); }   // a basic voice call hung up
      if ($trial && mh_ai_trial_left($uid, $V) <= 0) {   // the free minutes are up
        mh_ai_hangup($V, (string)$r['call']); $db->prepare('UPDATE ai_live SET ended = 1 WHERE id = ?')->execute([$lid]);
        mh_json(['ok' => true, 'left' => 0, 'end' => true, 'trial_over' => true, 'why' => 'That was your ' . intdiv(mh_ai_trial_total($uid, $V), 60) . ' free minutes with Bo. Get Mathub Max to keep calling him.']);
      }
      if ($left <= 0) {
        mh_ai_hangup($V, (string)$r['call']); $db->prepare('UPDATE ai_live SET ended = 1 WHERE id = ?')->execute([$lid]);
        mh_json(['ok' => true, 'left' => 0, 'end' => true, 'credits' => $outOfTime, 'hours' => $outOfTime, 'why' => $V['live_call'] - $secs <= 0 ? 'That was a long one: calls end after ' . round($V['live_call'] / 60) . ' minutes. Call Bo again any time.' : ($outOfTime ? 'That was all your credits. Get more on the Usage page to keep talking.' : 'That is all the live call time for now. It comes back tomorrow, or on the 1st for the monthly limit.')]);
      }
      mh_json(['ok' => true, 'left' => $left]);
    }
    case 'ai_flag': {
      // a thumbs down under one of Bo's answers: the answer and the question before it go to the admin's Bo quality tab
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id'];
      mh_rate_or_fail("ai_flag:$uid", 30, 86400, 'Thanks, that is plenty for today.');
      $cid = mh_ai_cid($in['class'] ?? ''); $at = (int)($in['at'] ?? 0); $turns = mh_ai_turns($uid, $cid); $i = -1;
      $start = mb_substr(is_string($in['text'] ?? null) ? $in['text'] : '', 0, 60);   // the start of the answer, when several share a second (a call)
      foreach ($turns as $k => $t) if (($t['r'] ?? '') === 'b' && (int)($t['at'] ?? 0) === $at && ($i < 0 || $start !== '' && str_starts_with((string)($t['t'] ?? ''), $start))) $i = $k;
      if ($i < 0) mh_fail('That answer is not in your chat any more.', 404);
      $q = ''; for ($k = $i - 1; $k >= 0; $k--) if (($turns[$k]['r'] ?? '') === 'u') { $q = (string)($turns[$k]['t'] ?? ''); break; }
      $ans = mh_ai_clip((string)$turns[$i]['t'], 4000); $why = mh_ai_clip(is_string($in['why'] ?? null) ? $in['why'] : '', 500);
      $st = $db->prepare('SELECT id FROM ai_flags WHERE user_id = ? AND cid = ? AND at = ? AND answer = ?'); $st->execute([$uid, $cid, $at, $ans]); $fid = (int)$st->fetchColumn();
      if ($fid) { if ($why !== '') $db->prepare('UPDATE ai_flags SET why = ?, status = "open" WHERE id = ?')->execute([$why, $fid]); }   // what was wrong, added after the thumbs down
      else { $db->prepare('INSERT INTO ai_flags (user_id, cid, at, q, answer, why, voice, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$uid, $cid, $at, mh_ai_clip($q, 2000), $ans, $why, empty($turns[$i]['v']) ? 0 : 1, time()]); mh_ai_q('flags'); }
      mh_json(['ok' => true]);
    }
    case 'ai_admin_quality': {
      // the admin's Bo quality tab: the counts by week for the last eight weeks, and the answers marked not right
      $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        $id = (int)($in['id'] ?? 0); $status = in_array($in['status'] ?? '', ['open', 'done'], true) ? $in['status'] : 'done';
        $db->prepare('UPDATE ai_flags SET status = ? WHERE id = ?')->execute([$status, $id]);
      }
      require_once __DIR__ . '/social.php'; $from = mh_local_date(time() - 55 * 86400);
      $st = $db->prepare("SELECT day, key, n FROM metrics WHERE key LIKE 'bo\_%' ESCAPE '\' AND day >= ? ORDER BY day"); $st->execute([$from]);
      $weeks = []; $total = array_fill_keys(array_keys(MH_AI_Q_KEYS), 0);
      foreach ($st->fetchAll() as $m) { $k = substr($m['key'], 3); if (!isset($total[$k])) continue; $w = (new DateTime($m['day']))->modify('monday this week')->format('Y-m-d'); $weeks[$w][$k] = ($weeks[$w][$k] ?? 0) + (int)$m['n']; $total[$k] += (int)$m['n']; }
      ksort($weeks); $open = (int)$db->query("SELECT COUNT(*) FROM ai_flags WHERE status = 'open'")->fetchColumn();
      $rows = $db->query("SELECT f.*, u.name, u.email FROM ai_flags f LEFT JOIN users u ON u.id = f.user_id ORDER BY f.status = 'open' DESC, f.created DESC LIMIT 60")->fetchAll();
      $flags = array_map(fn($f) => ['id' => (int)$f['id'], 'cid' => $f['cid'], 'q' => $f['q'], 'answer' => $f['answer'], 'why' => $f['why'], 'voice' => (int)$f['voice'] === 1, 'created' => (int)$f['created'], 'status' => $f['status'], 'who' => trim((string)($f['name'] ?? '')) ?: (string)($f['email'] ?? 'a deleted account'), 'email' => (string)($f['email'] ?? '')], $rows);
      mh_json(['ok' => true, 'labels' => MH_AI_Q_KEYS, 'total' => $total, 'weeks' => $weeks, 'open' => $open, 'flags' => $flags]);
    }
    case 'ai_recap': {
      // after a call (live or basic voice): Bo writes the recap they keep, saves it in the chat, emails it, and hands back
      // its practice problems for the mistakes notebook
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id']; $now = time();
      require_once __DIR__ . '/credits.php'; mh_credits_need($u, 500, $cfg, 'a recap');   // paid in credits, like everything with Bo
      mh_rate_or_fail("ai_recap:$uid", 24, 86400, 'That is a lot of recaps for one day.');
      $cid = mh_ai_cid($in['class'] ?? ''); $C = mh_ai_class($u, $cid); $since = max($now - 10800, (int)($in['since'] ?? 0)) - 5;
      mh_credits_for($u, $cfg, 'recap', mh_ai_class_name($C, $cid) . ' · recap after a call');
      $turns = mh_ai_turns($uid, $cid); $call = array_values(array_filter($turns, fn($t) => !empty($t['v']) && (int)($t['at'] ?? 0) >= $since && empty($t['recap'])));
      if (count(array_filter($call, fn($t) => ($t['r'] ?? '') === 'u')) < 1 || count($call) < 2) mh_json(['ok' => true, 'recap' => null]);
      $slips = array_values(array_filter(array_map(fn($x) => mh_ai_clip(is_string($x) ? $x : '', 200), array_slice((array)($in['slips'] ?? []), 0, 6)), 'strlen'));
      $ch = mh_ai_character(mh_ai_character_id($in));
      $system = [['type' => 'text', 'text' => MH_AI_BO_FULL]]; if ($C) $system[] = ['type' => 'text', 'text' => mh_ai_digest($C)];
      $system[] = ['type' => 'text', 'text' => $ch['who']]; $system[] = ['type' => 'text', 'text' => MH_AI_RECAP];
      if (($lang = mh_ai_lang($in)) !== '') $system[] = ['type' => 'text', 'text' => $lang];
      $L = []; foreach (array_slice($call, -40) as $t) $L[] = (($t['r'] ?? '') === 'b' ? 'Bo: ' : 'Them: ') . mh_ai_clip(mh_ai_unboard((string)($t['t'] ?? '')), 400);
      $msg = "THE CALL (oldest first):\n" . implode("\n", $L) . ($slips ? "\n\nMATH CHECK caught on the call (exact): " . implode('; ', $slips) : "\n\nMATH CHECK caught nothing wrong on the call.") . "\n\nWrite the recap now.";
      @set_time_limit(90);
      $r = mh_ai_call($A, $A['tutor_model'], $system, [['role' => 'user', 'content' => $msg]], 900, 60); $reply = trim($r['text']);
      require_once __DIR__ . '/mathcheck.php';
      if ($reply !== '' && ($bad = mh_mc_reply_slips($reply))) {   // his answers are checked like any page of his
        try { $r2 = mh_ai_call($A, $A['tutor_model'], $system, [['role' => 'user', 'content' => $msg], ['role' => 'assistant', 'content' => $reply], ['role' => 'user', 'content' => 'MATH CHECK (exact, worked out by the app) on your recap: ' . implode('; ', $bad) . '. Write the whole recap again with that fixed, in the same shape. Do not mention this note.']], 900, 60); $t2 = trim($r2['text']); $r['in'] += $r2['in']; $r['out'] += $r2['out']; if ($t2 !== '' && !mh_mc_reply_slips($t2)) { $reply = $t2; mh_ai_q('recap_fixed'); } } catch (Throwable $e) {}
      }
      if ($reply === '') mh_fail('Bo could not write the recap just now.', 502);
      mh_ai_q('recaps');
      $turns[] = ['r' => 'b', 't' => $reply, 'at' => $now, 'v' => 1, 'recap' => 1]; mh_ai_save_turns($uid, $cid, $turns); mh_ai_count($uid, 'tutor', $r['in'], $r['out']);
      $parts = mh_ai_recap_parts($reply);
      try { require_once __DIR__ . '/students.php'; mh_student_note_call($u, $cid, trim((string)($parts['topic'] ?? '') . ': ' . mb_substr(preg_replace('/\s+/u', ' ', mh_ai_unboard($reply)), 0, 220), ': ')); } catch (Throwable $e) {}   // the student file keeps a line per call
      // the practice problems with an answer that is a number, for the mistakes notebook
      $practice = [];
      foreach ($parts['checks'] as $c) { $v = mh_mc_val(mh_mc_edge(mh_mc_norm($c['answer']), false)); if (is_finite($v)) $practice[] = ['prompt' => $c['q'], 'answer' => $v, 'tex' => mh_mc_fmt_tex($v), 'why' => $c['why']]; }
      $emailed = false;
      if (($cfg['recap_emails'] ?? 'on') !== 'off' && (int)($u['recap_email'] ?? 1) === 1 && (int)($u['verified'] ?? 0) === 1 && !str_ends_with((string)$u['email'], '@system.local')) {
        require_once __DIR__ . '/mailer.php'; [$sub, $txt, $html] = mh_ai_recap_mail($u, $parts, $ch['name'], $cid); $emailed = mh_send_mail($cfg, $u['email'], $sub, $txt, $html)['ok'];
      }
      mh_json(['ok' => true, 'recap' => $reply, 'topic' => $parts['topic'], 'practice' => $practice, 'emailed' => $emailed]);
    }
    case 'ai_live_log': {
      // what was said on the call goes into the chat with Bo, his new notes into his notes; end: the call is over
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id']; $V = mh_ai_voice_settings($cfg);
      $lid = preg_replace('/[^a-f0-9]/', '', (string)($in['lid'] ?? '')); $st = $db->prepare('SELECT * FROM ai_live WHERE id = ? AND user_id = ?'); $st->execute([$lid, $uid]); $r = $st->fetch();
      if (!$r) mh_fail('That call is over.', 404);
      $new = [];
      foreach (array_slice(is_array($in['turns'] ?? null) ? $in['turns'] : [], 0, 80) as $t) {
        if (!is_array($t)) continue; $txt = mh_ai_clip($t['t'] ?? '', 3000); if ($txt === '') continue;   // room for the pages Bo wrote
        $new[] = ['r' => ($t['r'] ?? '') === 'b' ? 'b' : 'u', 't' => $txt, 'at' => time(), 'v' => 1];
      }
      if ($new) mh_ai_save_turns($uid, (string)$r['cid'], array_merge(mh_ai_turns($uid, (string)$r['cid']), $new));
      $notes = mh_ai_notes($uid); $added = false;
      foreach (array_slice(is_array($in['notes'] ?? null) ? $in['notes'] : [], 0, 4) as $f) { $f = mh_ai_clip(is_string($f) ? $f : '', 140); if ($f !== '' && !in_array($f, $notes, true)) { $notes[] = $f; $added = true; } }
      if ($added) mh_ai_save_notes($uid, $notes);
      if (!empty($in['end']) && !(int)$r['ended']) {
        $mc = is_array($in['mc'] ?? null) ? $in['mc'] : [];   // what the math check caught on the call (assets/talk.js)
        mh_ai_q('calls'); foreach (['you' => 'call_you', 'bo' => 'call_bo', 'page' => 'call_page', 'false_barge' => 'false_barge', 'barge' => 'call_barge', 'echo' => 'call_echo', 'cut_client' => 'cut_client', 'cut_limit' => 'cut_limit', 'errors' => 'call_errors', 'drops' => 'drops'] as $k => $key) mh_ai_q($key, max(0, min(50, (int)($mc[$k] ?? 0))));
        $now = time(); $d = max(0, min(45, $now - (int)$r['last'])); mh_ai_add($uid, 'live', $d);
        if (!(int)($r['trial'] ?? 0) && (string)$r['call'] !== '') mh_ai_call_charge($u, $r, $d, (int)$r['secs'] + $d, $cfg);   // the last seconds of the call
        $db->prepare('UPDATE ai_live SET secs = secs + ?, last = ?, ended = 1 WHERE id = ?')->execute([$d, $now, $lid]);
        mh_ai_hangup($V, (string)$r['call']);
      }
      mh_json(['ok' => true, 'saved' => count($new), 'notes' => mh_ai_notes($uid)]);
    }
    case 'ai_class': {
      // classes are added by Mathub's team: students request them (api/requests.php), and an administrator has Bo build
      // one from a request's syllabus in the admin panel (request: its id), or from a syllabus given here
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id'];
      if (!mh_is_admin($u)) mh_fail('Classes are added by the Mathub team now. Request your class with its syllabus, and we will tell you when it is ready.', 403, ['request' => true]);
      require_once __DIR__ . '/credits.php'; mh_credits_for($u, $cfg, 'class', 'Building a class');   // written down at 0 for administrators
      mh_rate_or_fail("ai_class:$uid", 40, 3600, 'Bo is writing a lot of classes for you. Try again in a while.');
      $step = (string)($in['step'] ?? ''); $Z = mh_ai_sizes((string)($in['size'] ?? 'full'));
      @set_time_limit(200);
      if ($step === 'outline') {
        $S = is_array($in['syllabus'] ?? null) ? $in['syllabus'] : []; $text = trim((string)($S['text'] ?? ''));
        $file = isset($S['file']) ? mh_ai_file($S['file'], ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain'], MH_AI_FILE_BYTES) : null;
        $reqCode = '';
        if (!empty($in['request'])) {   // the syllabus a student sent with a request (checked for malware when it came in, and again below)
          require_once __DIR__ . '/requests.php'; $q = mh_req_db()->prepare('SELECT * FROM class_requests WHERE id = ?'); $q->execute([(int)$in['request']]); $R = $q->fetch();
          if (!$R) mh_fail('That request is not there any more.', 404);
          $reqCode = (string)$R['code']; $text = trim((string)$R['text']); $path = $R['file'] !== '' ? mh_req_file_path((string)$R['file']) : null;
          if ($path) {
            $bin = (string)file_get_contents($path);
            if ($R['file_type'] === 'docx') { require_once __DIR__ . '/community.php'; $t = mh_cc_docx_text($bin); if ($t === '') mh_fail('Bo could not read that Word file. Download it, save it as a PDF and build the class from the Create page.', 422); $text = trim($text . "\n" . $t); }
            elseif ($R['file_type'] === 'pdf') $file = ['type' => 'application/pdf', 'data' => base64_encode($bin)];
            else $file = mh_ai_photo($bin, MH_REQ_KINDS[$R['file_type']] ?? 'image/jpeg');
          }
        }
        if ($text === '' && !$file) mh_fail($reqCode !== '' ? 'That request has no syllabus. Ask the student for it, or find it and build the class from the Create page.' : 'Paste your syllabus or attach it first.', 400);
        if (mb_strlen($text) > 120000) mh_fail('That syllabus is very long. Paste the parts with the schedule, topics, exams and grading.', 413);
        require_once __DIR__ . '/community.php';
        // 1. the file: what it says it is, and nothing harmful in it (it is never kept)
        if ($file) { $why = mh_cc_scan($file, $cfg); if ($why !== '') mh_fail($why, 422, ['check' => 'file']); }
        $doc = [];
        if ($file && $file['type'] === 'application/pdf') $doc[] = ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $file['data']]];
        elseif ($file && $file['type'] === 'text/plain') $text = trim($text . "\n" . mb_substr((string)base64_decode($file['data']), 0, 120000));
        elseif ($file) $doc[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $file['type'], 'data' => $file['data']]];
        if ($text !== '') $doc[] = ['type' => 'text', 'text' => "THE SYLLABUS:\n" . $text];
        $doc[count($doc) - 1]['cache_control'] = ['type' => 'ephemeral'];   // the two requests below share the syllabus, so the second reads it from the cache
        $sys = [['type' => 'text', 'text' => MH_AI_CLASS_SYS]];
        // 2. a real course, with nothing in it that cannot be published, and not on Mathub already
        mh_rate_or_fail("ai_class_check:$uid", 30, 86400, 'That is a lot of syllabi for one day. Try again tomorrow.');
        $r0 = mh_ai_call($A, $A['class_model'], $sys, [['role' => 'user', 'content' => array_merge($doc, [['type' => 'text', 'text' => MH_CC_SCREEN]])]], 600, 90);
        mh_ai_count($uid, '', $r0['in'], $r0['out']);
        $K = mh_ai_json($r0['text']); if (!$K || !array_key_exists('syllabus', $K)) mh_fail('Bo could not check this syllabus just now. Please try again.', 502);
        $why = mh_ai_plain($K['reason'] ?? '', 200);
        if (!($K['syllabus'] === true || $K['syllabus'] === 'true')) mh_fail('This does not look like a course syllabus' . ($why !== '' ? ': ' . rtrim($why, '.') . '.' : '.') . ' Bo makes classes only from the syllabus of a real course.', 422, ['check' => 'syllabus']);
        $worry = mh_ai_plain($K['concerns'] ?? '', 200); if ($worry !== '') mh_fail('This syllabus has something in it that cannot be published for everyone: ' . rtrim($worry, '.') . '.', 422, ['check' => 'content']);
        $code = mh_ai_plain($K['code'] ?? '', 40); $school = mh_ai_plain($K['school'] ?? '', 120);
        if (mh_cc_code($code) === '') mh_fail('Bo could not find the course code (like CHMY 121) in this syllabus. Every class on Mathub has one: add the page that shows it.', 422, ['check' => 'code']);
        if ($dup = mh_cc_find($code, $school)) mh_fail("{$dup['code']} {$dup['name']} is already on Mathub, so it was not added again.", 409, ['exists' => $dup]);
        // 3. the outline
        $r = mh_ai_call($A, $A['class_model'], $sys, [['role' => 'user', 'content' => array_merge($doc, [['type' => 'text', 'text' => 'Today is ' . gmdate('Y-m-d') . ".\n" . mh_ai_outline_prompt($Z)]])]], 8000, 170);
        $O = mh_ai_json($r['text']);
        if (!$O || empty($O['UNITS']) || empty($O['SECTIONS']) || !is_array($O['UNITS']) || !is_array($O['SECTIONS'])) { mh_ai_count($uid, '', $r['in'], $r['out']); mh_fail($r['stop'] === 'max_tokens' ? 'That syllabus made a very long outline. Choose "Shorter class" and try again.' : 'Bo could not find the topics and dates in that. Try the syllabus PDF itself, or paste its text.', 422); }
        $units = array_values(array_filter(array_map(fn($x) => is_array($x) ? (int)($x['n'] ?? 0) : 0, $O['UNITS'])));
        if (!$units || count($units) > 16 || count($O['SECTIONS']) > 40) mh_fail('That syllabus did not split into units Bo could use. Try pasting its schedule and topics.', 422);
        // the course that was checked: the outline keeps its code, and a different code in it is checked again
        if (mh_cc_code((string)($O['code'] ?? '')) !== mh_cc_code($code)) { if (mh_cc_code((string)($O['code'] ?? '')) !== '' && ($dup = mh_cc_find((string)$O['code'], $school))) mh_fail("{$dup['code']} {$dup['name']} is already on Mathub, so it was not added again.", 409, ['exists' => $dup]); $O['code'] = $code; if (is_array($O['COURSE'] ?? null)) $O['COURSE']['code'] = $code; }
        if (trim((string)($O['name'] ?? '')) === '') $O['name'] = mh_ai_plain($K['name'] ?? '', 120);
        $screen = ['code' => $code, 'name' => mh_ai_plain($K['name'] ?? '', 120), 'school' => $school, 'term' => mh_ai_plain($K['term'] ?? '', 40)];
        $id = bin2hex(random_bytes(12));
        $db->prepare('INSERT INTO ai_builds (id, user_id, created, outline, units, screen, req_code) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$id, $uid, time(), json_encode($O, JSON_UNESCAPED_UNICODE), count($units), json_encode($screen, JSON_UNESCAPED_UNICODE), $reqCode]);
        mh_ai_count($uid, 'classes', $r['in'], $r['out']);
        mh_json(['ok' => true, 'build' => $id, 'outline' => $O, 'units' => $units, 'checked' => $screen]);
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
        $db->prepare('INSERT OR REPLACE INTO ai_build_units (build, n, data) VALUES (?, ?, ?)')->execute([$bid, $n, json_encode($J, JSON_UNESCAPED_UNICODE)]);   // the published class is checked against it
        mh_json(['ok' => true, 'unit' => $n, 'data' => $J]);
      }
      mh_fail('Unknown step.', 400);
    }
  }
  mh_fail('Not found.', 404);
}
