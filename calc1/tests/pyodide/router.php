<?php
// Serves the local Pyodide package with CORS for Mathub tests.
header('Access-Control-Allow-Origin: *');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// a stand-in for RevenueCat's GET /v1/subscribers/{id}, for the Mathub Pro and Max tests (config.local.php: revenuecat_api,
// revenuecat_secret 'sk_test'); who is subscribed, and to which plan, comes from tests/fixtures/rc-state.json, written by the test
if (preg_match('#^/revenuecat/v1/subscribers/(.+)$#', $path, $m)) {
  header('Content-Type: application/json');
  if (($_SERVER['HTTP_AUTHORIZATION'] ?? '') !== 'Bearer sk_test') { http_response_code(401); echo '{"code":7225,"message":"Invalid API key."}'; exit; }
  $id = rawurldecode($m[1]); $state = json_decode((string)@file_get_contents(__DIR__ . '/../fixtures/rc-state.json'), true) ?: []; $s = $state[$id] ?? null;
  $plan = $s ? ($s['plan'] ?? 'pro') : ''; $prod = $plan === 'max' ? 'mathub_max_monthly' : 'mathub_pro_monthly';
  $e = ['expires_date' => $s['expires'] ?? null, 'grace_period_expires_date' => null, 'product_identifier' => $prod, 'purchase_date' => gmdate('c')];
  $ent = $s ? ($plan === 'max' ? ['pro' => $e, 'max' => $e] : ['pro' => $e]) : [];
  echo json_encode(['request_date' => gmdate('c'), 'subscriber' => ['original_app_user_id' => $id, 'entitlements' => $ent, 'subscriptions' => $s ? [$prod => ['store' => $s['store'] ?? 'rc_billing', 'expires_date' => $s['expires'] ?? null, 'unsubscribe_detected_at' => $s['cancelled'] ?? null]] : (object)[], 'management_url' => $s ? 'https://billing.example/manage' : null]]);
  exit;
}
// a stand-in for Anthropic's POST /v1/messages, for Bo's tests (config.local.php: anthropic_api, anthropic_key 'sk-ant-test').
// It keeps the last request in tests/fixtures/ai-last.json so the tests can check what the server sends.
if ($path === '/anthropic/v1/messages') {
  header('Content-Type: application/json');
  if (($_SERVER['HTTP_X_API_KEY'] ?? '') !== 'sk-ant-test' || ($_SERVER['HTTP_ANTHROPIC_VERSION'] ?? '') === '') { http_response_code(401); echo '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}'; exit; }
  $raw = (string)file_get_contents('php://input'); $req = json_decode($raw, true) ?: [];
  @file_put_contents(__DIR__ . '/../fixtures/ai-last.json', $raw);
  $sys = implode("\n", array_map(fn($b) => $b['text'] ?? '', (array)($req['system'] ?? [])));
  $last = end($req['messages']); $content = is_array($last['content'] ?? null) ? $last['content'] : [['type' => 'text', 'text' => (string)($last['content'] ?? '')]];
  $utext = implode("\n", array_map(fn($b) => $b['text'] ?? '', array_filter($content, fn($b) => ($b['type'] ?? '') === 'text')));
  $hasImage = (bool)array_filter($content, fn($b) => ($b['type'] ?? '') === 'image');
  if (str_contains($sys, 'course syllabus') && str_contains($utext, 'Read the syllabus')) {
    $o = ['code' => 'TEST 101', 'name' => 'Testing Bo', 'term' => 'Fall 2026', 'color' => ['light' => '#0F766E'],
      'COURSE' => ['code' => 'TEST 101', 'name' => 'Testing Bo', 'term' => 'Fall 2026', 'school' => 'Montana State University', 'instructor' => 'Dr. Stand In', 'officeHours' => 'Mon 2-3'],
      'GRADING' => ['categories' => [['id' => 'hw', 'name' => 'Homework', 'weight' => 40], ['id' => 'ex', 'name' => 'Exams', 'weight' => 60]], 'scale' => [['letter' => 'A', 'min' => 90], ['letter' => 'B', 'min' => 80], ['letter' => 'C', 'min' => 70], ['letter' => 'D', 'min' => 60], ['letter' => 'F', 'min' => 0]]],
      'SEMESTER' => ['start' => '2026-08-24', 'end' => '2026-12-18'],
      'EXAMS' => [['id' => 'exam1', 'name' => 'Exam 1', 'date' => '2026-10-20', 'covers' => 'Units 1 and 2', 'units' => [1, 2], 'weight' => 30]],
      'CALENDAR' => [['2026-09-01', 'lecture', 'Ratios', 'ratios'], ['2026-10-20', 'exam', 'Exam 1']],
      'UNITS' => [['n' => 1, 'title' => 'Numbers', 'sections' => ['ratios', 'percents'], 'exam' => 'exam1'], ['n' => 2, 'title' => 'Change', 'sections' => ['rates', 'growth'], 'exam' => 'exam1']],
      'SECTIONS' => [['id' => 'ratios', 'label' => '1.1', 'title' => 'Ratios', 'unit' => 1, 'about' => 'Comparing quantities.'], ['id' => 'percents', 'label' => '1.2', 'title' => 'Percents', 'unit' => 1, 'about' => 'Parts of a hundred.'], ['id' => 'rates', 'label' => '2.1', 'title' => 'Rates', 'unit' => 2, 'about' => 'Change per unit.'], ['id' => 'growth', 'label' => '2.2', 'title' => 'Growth', 'unit' => 2, 'about' => 'Repeated change.']]];
    $text = "```json\n" . json_encode($o) . "\n```";
  } elseif (str_contains($sys, 'course syllabus') && preg_match('/Write the study material for unit (\d+)/', $utext, $mm)) {
    preg_match_all('/^- ([a-z0-9-]+) \(/m', $utext, $ids); $secs = []; $cards = []; $qs = [];
    foreach ($ids[1] as $k => $sid) {
      $secs[] = ['id' => $sid, 'ideas' => ["$sid explained simply.", "More about $sid."], 'pitfalls' => ["Mixing up $sid."], 'example' => ['p' => "A $sid problem", 's' => 'Its solution']];
      $cards[] = ['id' => "c$k", 'sec' => $sid, 'f' => "What is $sid?", 'b' => "The idea of $sid."];
      $qs[] = ['topic' => $sid, 'items' => [["Which one is $sid?", 'This one', ['That one', 'Neither', 'Both'], "Because it is $sid."], ["Is $sid useful?", 'Yes', ['No', 'Never', 'Only on Sundays'], 'It is.']]];
    }
    $text = "Here you go:\n```json\n" . json_encode(['SECTIONS' => $secs, 'FLASHCARDS' => $cards, 'QUIZ' => ['questions' => $qs]]) . "\n```";
  } elseif (str_contains($sys, 'VOICE MODE')) {
    // talking out loud: a short spoken answer with a line for the whiteboard
    $weak = preg_match('/WEAKEST TOPICS: ([^;\n]+?) \d+%|WEAKEST TOPICS: ([^;\n]+?) not practised/', $sys, $w) ? trim($w[1] ?: $w[2]) : '';
    $text = 'You said: ' . rtrim(mb_substr($utext, 0, 60), '?.!') . '. The chain rule says: take the derivative of the outside, then multiply by the derivative of the inside. [board: $\\frac{d}{dx}f(g(x)) = f\'(g(x))\\,g\'(x)$] ' . ($weak ? "Since $weak is your weakest topic, want to try one together?" : 'Want to try one together?');
    if (stripos($utext, 'remember') !== false) $text .= "\n[remember: Likes to talk things through]";
  } else {
    $weak = preg_match('/WEAKEST TOPICS: ([^;\n]+?) \d+%|WEAKEST TOPICS: ([^;\n]+?) not practised/', $sys, $w) ? trim($w[1] ?: $w[2]) : '';
    $text = 'Bo here. ' . ($weak ? "Your weakest topic is $weak. " : '') . (str_contains($sys, 'CLASS: ') ? 'I know your class. ' : '') . ($hasImage ? 'I see your photo. ' : '') . 'You asked: ' . mb_substr($utext, 0, 80) . ' (turns: ' . count($req['messages']) . ')';
    if (stripos($utext, 'remember') !== false) $text .= "\n[remember: Likes worked examples first]";
    if (stripos($utext, 'math') !== false) $text .= "\nThe slope is $\\frac{\\Delta y}{\\Delta x}$ and x < 3 here.";
  }
  if (!empty($req['stream'])) {
    // the streaming form: server-sent events, the text in small pieces
    header('Content-Type: text/event-stream'); header('Cache-Control: no-cache');
    $ev = function (string $type, array $data): void { echo "event: $type\ndata: " . json_encode(['type' => $type] + $data) . "\n\n"; @ob_flush(); flush(); };
    $ev('message_start', ['message' => ['id' => 'msg_test', 'type' => 'message', 'role' => 'assistant', 'content' => [], 'model' => $req['model'] ?? '', 'usage' => ['input_tokens' => (int)(strlen($raw) / 4), 'output_tokens' => 1]]]);
    $ev('content_block_start', ['index' => 0, 'content_block' => ['type' => 'text', 'text' => '']]);
    $ev('ping', []);
    foreach (mb_str_split($text, 14) as $piece) { $ev('content_block_delta', ['index' => 0, 'delta' => ['type' => 'text_delta', 'text' => $piece]]); usleep(12000); }
    $ev('content_block_stop', ['index' => 0]);
    $ev('message_delta', ['delta' => ['stop_reason' => 'end_turn', 'stop_sequence' => null], 'usage' => ['output_tokens' => (int)(strlen($text) / 4)]]);
    $ev('message_stop', []);
    exit;
  }
  echo json_encode(['id' => 'msg_test', 'type' => 'message', 'role' => 'assistant', 'model' => $req['model'] ?? '', 'content' => [['type' => 'text', 'text' => $text]], 'stop_reason' => 'end_turn', 'usage' => ['input_tokens' => (int)(strlen($raw) / 4), 'output_tokens' => (int)(strlen($text) / 4)]]);
  exit;
}
// a stand-in for OpenAI's speech API (config.local.php: openai_api, openai_key 'sk-openai-test'): /audio/speech answers
// with a short silent WAV and keeps the request in tests/fixtures/tts-last.json; /audio/transcriptions hears the same
// question every time and keeps what it was sent in tests/fixtures/stt-last.json
if (preg_match('#^/openai/v1/audio/(speech|transcriptions)$#', $path, $m)) {
  if (($_SERVER['HTTP_AUTHORIZATION'] ?? '') !== 'Bearer sk-openai-test') { http_response_code(401); header('Content-Type: application/json'); echo '{"error":{"message":"Incorrect API key"}}'; exit; }
  if ($m[1] === 'speech') {
    $raw = (string)file_get_contents('php://input'); @file_put_contents(__DIR__ . '/../fixtures/tts-last.json', $raw);
    $n = 2400; $wav = 'RIFF' . pack('V', 36 + 2 * $n) . 'WAVEfmt ' . pack('VvvVVvv', 16, 1, 1, 8000, 16000, 2, 16) . 'data' . pack('V', 2 * $n) . str_repeat("\0", 2 * $n);
    header('Content-Type: audio/wav'); echo $wav; exit;
  }
  @file_put_contents(__DIR__ . '/../fixtures/stt-last.json', json_encode(['post' => $_POST, 'file' => isset($_FILES['file']) ? ['name' => $_FILES['file']['name'], 'type' => $_FILES['file']['type'], 'size' => $_FILES['file']['size']] : null]));
  header('Content-Type: application/json'); echo json_encode(['text' => 'What is the chain rule?']); exit;
}
$file = __DIR__ . '/package' . $path;
if ($path === '/' || !is_file($file)) { http_response_code(404); echo 'not found'; exit; }
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
$types = ['js' => 'text/javascript', 'mjs' => 'text/javascript', 'wasm' => 'application/wasm', 'json' => 'application/json', 'zip' => 'application/zip', 'whl' => 'application/octet-stream', 'ts' => 'text/plain', 'map' => 'application/json'];
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($file));
readfile($file);
