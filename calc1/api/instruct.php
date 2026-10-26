<?php
/* ============================================================
   Mathub account server — instructors in a class (#/<class>/instructor; assets/instruct.js)
   Who teaches a class on Mathub (mh_course_staff): an administrator, the instructor whose email the class's syllabus
   gives (COURSE.email), or the teaching team (owner, co-instructors, TAs) of a confirmed Mathub Faculty class that is
   this class or is linked to it (api/teach.php). For their class they can:
   - set how Bo works in it (class_ai): hints only, notes for Bo, and for each project an assignment sheet and a rubric
     Bo reads drafts against; turn peer review swaps on (api/peer.php) and draft sharing off. Draft feedback itself is
     switched on and off with ai_draft_switch (api/drafts.php);
   - read the draft versions students choose to share with them (draft_shares), and reply;
   - see patterns in Bo's draft feedback across the class: only from students who let their drafts count, only once
     five have, and never a name, a quote or a draft;
   - give credits to the students in their Mathub Faculty class, out of credits they bought.
   Routes: instruct_me, instruct_get, instruct_save, instruct_shares, instruct_share_get, instruct_reply,
           instruct_patterns, instruct_roster, instruct_sponsor.
   ============================================================ */
declare(strict_types=1);

const MH_PATTERN_MIN = 5;         // students who let their drafts count before a project's patterns show
const MH_SPONSOR_MAX = 2000;      // credits for each student in one gift
const MH_CLASS_HINTS = <<<'TXT'
YOUR INSTRUCTOR'S SETTING FOR THIS CLASS: HINTS ONLY.
- Do not give final answers or finished solutions to problems from this class (homework, quizzes, exams, or anything they bring that looks like graded work), not even when they ask twice.
- Give one hint at a time, ask what they tried, check their steps and point at the first slip, and let them reach the answer themselves. A worked example of the same idea with different numbers is fine.
- If they ask why, say kindly that their instructor set Bo to hints for this class.
TXT;

function mh_instruct_db(): PDO {
  static $ready = false; $db = mh_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS class_ai (course TEXT PRIMARY KEY, json TEXT NOT NULL DEFAULT \'{}\', user_id INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL)');
    $ready = true;
  }
  return $db;
}

/* ---------- who teaches a class ---------- */
/** The class's own instructor email from its syllabus data, lower case ('' when it has none). */
function mh_course_email(?array $C): string { $co = is_array($C['COURSE'] ?? null) ? $C['COURSE'] : []; return strtolower(trim((string)($co['email'] ?? ($co['instructorEmail'] ?? '')))); }
/** Classes this person teaches through Mathub Faculty: each confirmed class's own id and the class it is linked to. */
function mh_course_staff_teach(array $u): array {
  static $memo = []; $uid = (int)$u['id']; if (isset($memo[$uid])) return $memo[$uid];
  require_once __DIR__ . '/teach.php';
  $st = mh_teach_db()->prepare("SELECT c.* FROM teach_classes c LEFT JOIN teach_members m ON m.class_id = c.id AND m.user_id = ? AND m.role = 'ta' WHERE c.owner_id = ? OR m.user_id IS NOT NULL");
  $st->execute([$uid, $uid]); $ids = [];
  foreach ($st->fetchAll() as $c) { if (!mh_teach_verified($c)) continue; foreach ([(string)$c['pack_id'], (string)$c['link_course']] as $x) if ($x !== '') $ids[] = $x; }
  return $memo[$uid] = array_values(array_unique($ids));
}
function mh_course_staff(?array $u, string $cid, ?array $C = null): bool {
  if (!$u || $cid === '') return false;
  if (mh_is_admin($u)) return true;
  $mail = mh_course_email($C ?? mh_ai_class($u, $cid));
  if ($mail !== '' && strtolower((string)$u['email']) === $mail) return true;
  return in_array($cid, mh_course_staff_teach($u), true);
}
/** Does anyone teach this class on Mathub (so a shared draft reaches someone)? */
function mh_course_has_staff(string $cid, ?array $C): bool {
  if (mh_course_email($C) !== '') return true;
  require_once __DIR__ . '/teach.php';
  $st = mh_teach_db()->prepare("SELECT * FROM teach_classes WHERE (pack_id = ? OR link_course = ?) AND status = 'published'"); $st->execute([$cid, $cid]);
  foreach ($st->fetchAll() as $c) if (mh_teach_verified($c)) return true;
  return false;
}
function mh_course_staff_or_fail(array $u, string $cid, ?array $C = null): void { if (!mh_course_staff($u, $cid, $C)) mh_fail('Only this class’s instructors can see this.', 403); }
/** The names students see for "your instructor": the syllabus's instructor, else the Faculty class's teaching team. */
function mh_course_staff_name(?array $C): string { $co = is_array($C['COURSE'] ?? null) ? $C['COURSE'] : []; return mh_ai_plain($co['instructor'] ?? '', 60) ?: 'your instructor'; }
/** Everyone who teaches the class and has an account: the syllabus email's account and the Faculty teaching teams (for notifications). */
function mh_course_staff_ids(string $cid, ?array $C): array {
  $ids = []; $mail = mh_course_email($C);
  if ($mail !== '') { $st = mh_db()->prepare('SELECT id FROM users WHERE lower(email) = ?'); $st->execute([$mail]); if ($id = $st->fetchColumn()) $ids[] = (int)$id; }
  require_once __DIR__ . '/teach.php';
  $st = mh_teach_db()->prepare("SELECT * FROM teach_classes WHERE pack_id = ? OR link_course = ?"); $st->execute([$cid, $cid]);
  foreach ($st->fetchAll() as $c) {
    if (!mh_teach_verified($c)) continue; $ids[] = (int)$c['owner_id'];
    $m = mh_teach_db()->prepare("SELECT user_id FROM teach_members WHERE class_id = ? AND role = 'ta'"); $m->execute([$c['id']]); foreach ($m->fetchAll(PDO::FETCH_COLUMN) as $x) $ids[] = (int)$x;
  }
  return array_values(array_unique($ids));
}

/* ---------- how Bo works in the class ---------- */
const MH_CLASS_AI_DEFAULT = ['hints' => false, 'notes' => '', 'share' => true, 'peer' => false, 'peer_days' => 4, 'projects' => []];
function mh_class_ai(string $cid): array {
  $st = mh_instruct_db()->prepare('SELECT json, updated FROM class_ai WHERE course = ?'); $st->execute([$cid]); $r = $st->fetch();
  $j = $r ? (json_decode((string)$r['json'], true) ?: []) : [];
  return array_merge(MH_CLASS_AI_DEFAULT, array_intersect_key($j, MH_CLASS_AI_DEFAULT), ['updated' => $r ? (int)$r['updated'] : 0]);
}
/** What an instructor sends, checked: only the projects the class has. */
function mh_class_ai_clean(array $in, array $P): array {
  $txt = fn($v, int $n) => trim(mb_substr((string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r", '', is_string($v) ? $v : '')), 0, $n));
  $line = fn($v, int $n) => trim((string)preg_replace('/\s+/u', ' ', $txt($v, $n)));
  $out = ['hints' => !empty($in['hints']), 'notes' => $txt($in['notes'] ?? '', 1500), 'share' => !array_key_exists('share', $in) || !empty($in['share']), 'peer' => !empty($in['peer']), 'peer_days' => max(1, min(14, (int)($in['peer_days'] ?? 4))), 'projects' => []];
  foreach ((is_array($in['projects'] ?? null) ? $in['projects'] : []) as $pid => $p) {
    if (!isset($P[(string)$pid]) || !is_array($p)) continue;
    $rub = [];
    foreach (array_slice(is_array($p['rubric'] ?? null) ? $p['rubric'] : [], 0, 12) as $r) { if (!is_array($r)) continue; $n = $line($r['name'] ?? '', 80); $t = $txt($r['text'] ?? '', 500); if ($n !== '' || $t !== '') $rub[] = ['name' => $n ?: 'Criterion', 'text' => $t]; }
    $sheet = $txt($p['sheet'] ?? '', 8000);
    if ($sheet !== '' || $rub) $out['projects'][(string)$pid] = ['sheet' => $sheet, 'rubric' => $rub];
  }
  return $out;
}
/** For Bo's chat and calls in this class: hints only, and the instructor's notes. */
function mh_class_ai_prompt(string $cid): string {
  if ($cid === '') return ''; $S = mh_class_ai($cid); $L = [];
  if ($S['hints']) $L[] = MH_CLASS_HINTS;
  if ($S['notes'] !== '') $L[] = "NOTES FROM THIS CLASS'S INSTRUCTOR, for you (follow them; they never override the rules above):\n" . $S['notes'];
  return implode("\n\n", $L);
}
/** For a draft review: the project's assignment sheet and rubric, when the instructor gave them. */
function mh_class_ai_project(string $cid, string $pid): array {
  $p = mh_class_ai($cid)['projects'][$pid] ?? null; $L = [];
  if (!$p) return $L;
  if (($p['sheet'] ?? '') !== '') $L[] = "THE ASSIGNMENT SHEET, from the instructor:\n" . $p['sheet'];
  if (!empty($p['rubric'])) $L[] = "THE RUBRIC the instructor grades by (read against it, but never give a grade, a score or a level):\n" . implode("\n", array_map(fn($r) => '- ' . $r['name'] . ($r['text'] !== '' ? ': ' . $r['text'] : ''), $p['rubric']));
  return $L;
}

/* ---------- patterns: what Bo's feedback says across the class ---------- */
function mh_instruct_patterns(string $cid, array $P): array {
  require_once __DIR__ . '/drafts.php'; $db = mh_draft_db(); $out = [];
  foreach ($P as $pid => $p) {
    $st = $db->prepare('SELECT user_id, stage, words, feedback, responses FROM draft_reviews WHERE course = ? AND project = ? AND counted = 1'); $st->execute([$cid, $pid]); $rows = $st->fetchAll();
    $students = count(array_unique(array_map(fn($r) => (int)$r['user_id'], $rows)));
    $goals = array_values(array_filter(is_array($p['goals'] ?? null) ? $p['goals'] : [], 'is_string'));
    $o = ['id' => (string)$pid, 'name' => mh_ai_plain($p['name'] ?? $pid, 120), 'students' => $students, 'enough' => $students >= MH_PATTERN_MIN, 'min' => MH_PATTERN_MIN];
    if ($o['enough']) {
      $byGoal = array_fill(0, count($goals) + 1, 0); $since = ['done' => 0, 'partly' => 0, 'not yet' => 0]; $answers = ['done' => 0, 'disagree' => 0]; $words = []; $first = 0; $revised = 0; $titles = [];
      foreach ($rows as $r) {
        $f = json_decode((string)$r['feedback'], true) ?: []; $words[] = (int)$r['words']; $r['stage'] === 'revised' ? $revised++ : $first++;
        $seen = [];
        foreach ($f['revisions'] ?? [] as $x) { $g = (int)($x['goal'] ?? 0); if ($g < 0 || $g > count($goals)) $g = 0; if (!isset($seen[$g])) { $seen[$g] = 1; $byGoal[$g]++; } }
        foreach ($f['since'] ?? [] as $x) if (isset($since[$x['status'] ?? ''])) $since[$x['status']]++;
        foreach ((json_decode((string)$r['responses'], true) ?: []) as $x) if (is_array($x) && isset($answers[$x['s'] ?? ''])) $answers[$x['s']]++;
      }
      sort($words); $n = count($words);
      $o += ['drafts' => count($rows), 'first' => $first, 'revised' => $revised, 'words' => $n ? ($n % 2 ? $words[intdiv($n, 2)] : (int)round(($words[$n / 2 - 1] + $words[$n / 2]) / 2)) : 0,
        'goals' => array_map(fn($g, $i) => ['goal' => mh_ai_plain($g, 160), 'drafts' => $byGoal[$i + 1]], $goals, array_keys($goals)), 'other' => $byGoal[0], 'since' => $since, 'answers' => $answers];
    }
    $out[] = $o;
  }
  return $out;
}

/* ---------- the roster: students in the Faculty classes linked to this class that this person teaches ---------- */
function mh_instruct_roster(array $u, string $cid): array {
  require_once __DIR__ . '/teach.php'; $db = mh_teach_db(); $admin = mh_is_admin($u); $uid = (int)$u['id'];
  $st = $db->prepare("SELECT c.* FROM teach_classes c LEFT JOIN teach_members m ON m.class_id = c.id AND m.user_id = ? AND m.role = 'ta' WHERE (c.pack_id = ? OR c.link_course = ?) AND (? OR c.owner_id = ? OR m.user_id IS NOT NULL)");
  $st->execute([$uid, $cid, $cid, $admin ? 1 : 0, $uid]); $classes = []; $people = [];
  foreach ($st->fetchAll() as $c) {
    if (!mh_teach_verified($c)) continue; $classes[] = ['id' => (int)$c['id'], 'code' => (string)$c['code'], 'title' => (string)$c['title'], 'section' => (string)$c['section']];
    $m = $db->prepare("SELECT u.id, u.name, u.email FROM teach_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND m.role = 'student'"); $m->execute([$c['id']]);
    foreach ($m->fetchAll() as $p) $people[(int)$p['id']] = ['id' => (int)$p['id'], 'name' => mh_display_name($p), 'email' => (string)$p['email']];
  }
  unset($people[$uid]);
  usort($people, fn($a, $b) => strcasecmp($a['name'], $b['name']));
  return ['classes' => $classes, 'students' => array_values($people)];
}

function mh_instruct_notify(int $to, string $kind, array $actor, string $title, string $snippet, string $link): void {
  try { mh_db()->prepare('INSERT INTO notifications (user_id, kind, post_id, comment_id, actor_id, actor, title, snippet, link, created) VALUES (?, ?, 0, NULL, ?, ?, ?, ?, ?, ?)')->execute([$to, $kind, (int)$actor['id'], mh_display_name($actor), mb_substr($title, 0, 140), mb_substr($snippet, 0, 200), $link, time()]); } catch (Throwable $e) { error_log('Mathub notify: ' . $e->getMessage()); }
}

function mh_instruct_route(string $route, array $in, array $cfg): void {
  $u = mh_require_user();
  if ($route === 'instruct_me') {   // the classes this person teaches (the sidebar's Instructor item); administrators teach every class
    mh_method('GET');
    $mine = mh_course_staff_teach($u); $mail = strtolower((string)$u['email']);
    foreach (glob(__DIR__ . '/classdata/*.json') ?: [] as $f) { $j = json_decode((string)file_get_contents($f), true); if (is_array($j) && mh_course_email($j) === $mail) $mine[] = basename($f, '.json'); }
    $st = mh_pack_db()->prepare('SELECT id, json FROM class_packs WHERE enabled = 1 AND json LIKE ?'); $st->execute(['%' . str_replace(['%', '_'], '', $mail) . '%']);
    foreach ($st->fetchAll() as $r) { $j = json_decode((string)$r['json'], true); if (is_array($j) && mh_course_email($j) === $mail) $mine[] = (string)$r['id']; }
    mh_json(['ok' => true, 'admin' => mh_is_admin($u), 'courses' => array_values(array_unique($mine))]);
  }
  $cid = mh_ai_cid($in['class'] ?? ($_GET['class'] ?? '')); $C = mh_ai_class($u, $cid);
  if (!$C) mh_fail('That class is not on Mathub.', 404);
  mh_course_staff_or_fail($u, $cid, $C);
  require_once __DIR__ . '/drafts.php'; $P = mh_draft_projects($C); $db = mh_draft_db();
  switch ($route) {
    case 'instruct_get': {
      mh_method('GET');
      $shares = $db->prepare('SELECT COUNT(*) FROM draft_shares WHERE course = ? AND seen = 0'); $shares->execute([$cid]);
      mh_json(['ok' => true, 'settings' => mh_class_ai($cid), 'drafts_off' => mh_draft_off($cid), 'admin' => mh_is_admin($u),
        'projects' => array_values(array_map(fn($p) => ['id' => (string)$p['id'], 'short' => mh_ai_plain($p['short'] ?? $p['id'], 40), 'name' => mh_ai_plain($p['name'] ?? $p['id'], 120), 'goals' => array_values(array_map(fn($g) => mh_ai_plain($g, 160), array_filter(is_array($p['goals'] ?? null) ? $p['goals'] : [], 'is_string')))], $P)),
        'unseen' => (int)$shares->fetchColumn(), 'writing' => mh_ai_writing_class($C)]);
    }
    case 'instruct_save': {
      mh_method('POST'); $S = mh_class_ai_clean(is_array($in['settings'] ?? null) ? $in['settings'] : [], $P);
      mh_instruct_db()->prepare('INSERT INTO class_ai (course, json, user_id, updated) VALUES (?, ?, ?, ?) ON CONFLICT(course) DO UPDATE SET json = excluded.json, user_id = excluded.user_id, updated = excluded.updated')
        ->execute([$cid, json_encode($S, JSON_UNESCAPED_UNICODE), (int)$u['id'], time()]);
      mh_json(['ok' => true, 'settings' => mh_class_ai($cid)]);
    }
    case 'instruct_shares': {   // the versions students shared, newest first
      mh_method('GET');
      $st = $db->prepare('SELECT s.review_id, s.note, s.created, s.seen, s.reply, s.replied, r.project, r.version, r.stage, r.words, u.name, u.email FROM draft_shares s JOIN draft_reviews r ON r.id = s.review_id JOIN users u ON u.id = s.user_id WHERE s.course = ? ORDER BY s.created DESC LIMIT 400');
      $st->execute([$cid]);
      mh_json(['ok' => true, 'shares' => array_map(fn($r) => ['id' => (int)$r['review_id'], 'project' => (string)$r['project'], 'version' => (int)$r['version'], 'stage' => (string)$r['stage'], 'words' => (int)$r['words'], 'note' => (string)$r['note'], 'created' => (int)$r['created'], 'seen' => (bool)$r['seen'], 'replied' => (int)$r['replied'], 'student' => ['name' => mh_display_name($r), 'email' => (string)$r['email']]], $st->fetchAll())]);
    }
    case 'instruct_share_get': {   // one shared version, with the student's other shared versions of that project
      mh_method('GET'); $id = (int)($_GET['id'] ?? 0);
      $st = $db->prepare('SELECT r.*, s.note AS share_note, s.created AS shared, s.reply, s.replied, u.name, u.email FROM draft_shares s JOIN draft_reviews r ON r.id = s.review_id JOIN users u ON u.id = s.user_id WHERE s.review_id = ? AND s.course = ?');
      $st->execute([$id, $cid]); $r = $st->fetch(); if (!$r) mh_fail('That draft is not shared with you.', 404);
      $db->prepare('UPDATE draft_shares SET seen = 1 WHERE review_id = ?')->execute([$id]);
      $o = $db->prepare('SELECT r.id, r.version, r.stage, r.words, r.created FROM draft_shares s JOIN draft_reviews r ON r.id = s.review_id WHERE s.user_id = ? AND s.course = ? AND r.project = ? ORDER BY r.version'); $o->execute([$r['user_id'], $cid, $r['project']]);
      mh_json(['ok' => true, 'review' => mh_draft_row($r, true), 'share' => ['note' => (string)$r['share_note'], 'created' => (int)$r['shared'], 'reply' => (string)$r['reply'], 'replied' => (int)$r['replied']], 'student' => ['name' => mh_display_name($r), 'email' => (string)$r['email']],
        'shared' => array_map(fn($x) => ['id' => (int)$x['id'], 'version' => (int)$x['version'], 'stage' => (string)$x['stage'], 'words' => (int)$x['words'], 'created' => (int)$x['created']], $o->fetchAll())]);
    }
    case 'instruct_reply': {   // a short reply the student sees on that version (and in their inbox)
      mh_method('POST'); $id = (int)($in['id'] ?? 0); $text = trim(mb_substr((string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r", '', is_string($in['text'] ?? null) ? $in['text'] : '')), 0, 3000));
      $st = $db->prepare('SELECT s.user_id, r.project, r.version FROM draft_shares s JOIN draft_reviews r ON r.id = s.review_id WHERE s.review_id = ? AND s.course = ?'); $st->execute([$id, $cid]); $s = $st->fetch();
      if (!$s) mh_fail('That draft is not shared with you.', 404);
      mh_rate_or_fail('instruct_reply:' . $u['id'], 300, 3600, 'Slow down a little.');
      $db->prepare('UPDATE draft_shares SET reply = ?, reply_by = ?, replied = ?, seen = 1 WHERE review_id = ?')->execute([$text, (int)$u['id'], $text === '' ? 0 : time(), $id]);
      if ($text !== '') mh_instruct_notify((int)$s['user_id'], 'draft_reply', $u, mh_ai_plain($P[$s['project']]['short'] ?? $s['project'], 40) . ', version ' . (int)$s['version'], mb_substr($text, 0, 180), '#/' . $cid . '/drafts/' . $id);
      mh_json(['ok' => true, 'reply' => $text, 'replied' => $text === '' ? 0 : time()]);
    }
    case 'instruct_patterns': {
      mh_method('GET');
      mh_json(['ok' => true, 'projects' => mh_instruct_patterns($cid, $P)]);
    }
    case 'instruct_roster': {   // who a gift of credits would reach, and the gifts already given
      mh_method('GET'); $R = mh_instruct_roster($u, $cid);
      require_once __DIR__ . '/credits.php';
      $h = mh_credits_db()->prepare("SELECT mc, note, created FROM credit_add WHERE user_id = ? AND kind = 'sponsor' AND ref LIKE ? ORDER BY created DESC LIMIT 50"); $h->execute([(int)$u['id'], 'sponsor:' . $cid . ':%']);
      $L = mh_credits_left($u, $cfg);
      mh_json(['ok' => true, 'classes' => $R['classes'], 'students' => $R['students'], 'paid' => intdiv(max(0, $L['paid']), 1000), 'admin' => mh_is_admin($u), 'max' => MH_SPONSOR_MAX,
        'given' => array_map(fn($r) => ['credits' => intdiv(-(int)$r['mc'], 1000), 'note' => (string)$r['note'], 'created' => (int)$r['created']], $h->fetchAll())]);
    }
    case 'instruct_sponsor': {   // credits for every student in the roster, paid from the instructor's bought credits (administrators: given)
      mh_method('POST'); require_once __DIR__ . '/credits.php';
      $each = (int)($in['credits'] ?? 0); if ($each < 1 || $each > MH_SPONSOR_MAX) mh_fail('Give each student between 1 and ' . number_format(MH_SPONSOR_MAX) . ' credits.', 400);
      $R = mh_instruct_roster($u, $cid); $n = count($R['students']);
      if (!$n) mh_fail('No students have joined your Mathub Faculty class for this course yet.', 400);
      if ((int)($in['expect'] ?? -1) !== $n) mh_fail('The class list changed. Check the number of students and try again.', 409, ['students' => $n]);
      $total = $each * $n; $admin = mh_is_admin($u);
      mh_rate_or_fail('instruct_sponsor:' . $u['id'], 20, 3600, 'Slow down a little.');
      $cdb = mh_credits_db(); $cdb->beginTransaction();
      try {
        if (!$admin) { $paid = mh_credits_paid((int)$u['id']); if ($paid < 1000 * $total) { $cdb->rollBack(); mh_fail('That takes ' . number_format($total) . ' credits, and you have ' . number_format(max(0, intdiv($paid, 1000))) . ' you bought or were given (the month’s free credits cannot be given). Get more on the Usage page.', 402, ['credits' => true]); } }
        $batch = 'sponsor:' . $cid . ':' . (int)$u['id'] . ':' . time() . ':' . bin2hex(random_bytes(3)); $name = mh_display_name($u); $cname = mh_ai_class_name($C, $cid);
        if (!$admin) $cdb->prepare("INSERT INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'sponsor', ?, ?, ?, ?)")->execute([(int)$u['id'], -1000 * $total, $batch, "$each each for $n students in $cname", time()]);
        $add = $cdb->prepare("INSERT INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'gift', ?, ?, ?, ?)");
        foreach ($R['students'] as $s) $add->execute([$s['id'], 1000 * $each, $batch . ':' . $s['id'], "From $name for $cname", time()]);
        if ($admin) $cdb->prepare("INSERT INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'sponsor', 0, ?, ?, ?)")->execute([(int)$u['id'], $batch, "$each each for $n students in $cname (given by Mathub)", time()]);
        $cdb->commit();
      } catch (Throwable $e) { if ($cdb->inTransaction()) $cdb->rollBack(); throw $e; }
      foreach ($R['students'] as $s) mh_instruct_notify($s['id'], 'credits', $u, $cname, number_format($each) . ' credits for Bo. They never expire.', '#/usage');
      mh_json(['ok' => true, 'students' => $n, 'each' => $each, 'total' => $total]);
    }
  }
  mh_fail('Unknown request.', 404);
}
