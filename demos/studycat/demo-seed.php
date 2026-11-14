<?php
/* ============================================================
   StudyCat PUBLIC DEMO: seed and nightly reset (command line only)

   Put this file in the DEMO copy's api/ folder (next to lib.php), with the demo
   api/config.local.php beside it, then run it with PHP's command line:

       php api/demo-seed.php            wipe the demo database, then create the demo accounts and demo content
       php api/demo-seed.php --repair   keep everything, only put the demo accounts back (exist, verified, demo
                                        password, roles, not banned) and clear their shared sign-in rate limit:
                                        cheap enough to run every 10 minutes
       php api/demo-seed.php --check    print what is there and whether the lockdown is in place; changes nothing

   It uses StudyCat's own schema and helpers (api/lib.php, teach.php, packs.php), the same password hashing
   (password_hash, PASSWORD_DEFAULT) and the same rows the API writes. It refuses to run:
     - from the web (it is CLI only; api/.htaccess also blocks every file but index.php),
     - unless api/config.local.php is the demo one (mail_mode log, only @studycat.test staff and sign-ups,
       no API keys, a database called studycat-demo.sqlite), so it can never wipe a production database.
   ============================================================ */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

const DEMO_PASSWORD = 'demo-study-2026';
const DEMO_DOMAIN = 'studycat.test';

$opts = getopt('', ['api:', 'repair', 'check', 'quiet', 'help']);
if (isset($opts['help'])) { fwrite(STDOUT, "php demo-seed.php [--repair|--check] [--quiet] [--api=/path/to/public_html/api]\n"); exit(0); }
$apiDir = rtrim((string)($opts['api'] ?? (is_file(__DIR__ . '/lib.php') ? __DIR__ : __DIR__ . '/api')), '/');
if (!is_file("$apiDir/lib.php") || !is_file("$apiDir/config.php")) { fwrite(STDERR, "demo-seed: StudyCat's api/ folder not found at $apiDir (use --api=...)\n"); exit(2); }
if (!is_file("$apiDir/config.local.php")) { fwrite(STDERR, "demo-seed: $apiDir/config.local.php is missing. Copy the demo config.local.php there first.\n"); exit(2); }
$QUIET = isset($opts['quiet']);
function say(string $s): void { global $QUIET; if (!$QUIET) fwrite(STDOUT, $s . "\n"); }

// StudyCat's helpers answer errors with mh_fail() -> JSON + exit. Turn that into a failing exit code for cron.
$GLOBALS['demo_done'] = false;
register_shutdown_function(function () { if (!$GLOBALS['demo_done']) { fwrite(STDERR, "\ndemo-seed: FAILED (see the message above)\n"); exit(1); } });
$_SERVER['REMOTE_ADDR'] = '127.0.0.1'; $_SERVER['HTTP_HOST'] = $_SERVER['HTTP_HOST'] ?? 'localhost'; $_SERVER['REQUEST_METHOD'] = 'GET';

require_once "$apiDir/lib.php";
$cfg = mh_config();

/* ---------- safety: only ever touch a demo install ---------- */
$problems = [];
$staff = array_merge((array)($cfg['admins'] ?? []), (array)($cfg['moderators'] ?? []));
if (($cfg['mail_mode'] ?? '') !== 'log') $problems[] = "mail_mode must be 'log'";
if ((array)($cfg['allowed_domains'] ?? []) !== [DEMO_DOMAIN]) $problems[] = "allowed_domains must be ['" . DEMO_DOMAIN . "']";
foreach (array_merge($staff, (array)($cfg['extra_allowed_emails'] ?? []), array_keys((array)($cfg['plan_grants'] ?? []))) as $e) if (!str_ends_with(strtolower((string)$e), '@' . DEMO_DOMAIN)) $problems[] = "$e is not a demo (@" . DEMO_DOMAIN . ") address";
foreach (['anthropic_key', 'openai_key', 'virustotal_key', 'revenuecat_secret', 'revenuecat_v2_key', 'smtp_pass', 'offsite_secret'] as $k) if (trim((string)($cfg[$k] ?? '')) !== '') $problems[] = "$k must be empty in the demo";
if (basename((string)$cfg['db_path']) !== 'studycat-demo.sqlite') $problems[] = 'db_path must point at a file called studycat-demo.sqlite (the demo database)';
if ($problems) { fwrite(STDERR, "demo-seed: refusing to run, this does not look like the demo configuration:\n  - " . implode("\n  - ", $problems) . "\n"); $GLOBALS['demo_done'] = true; exit(3); }

$dbPath = (string)$cfg['db_path']; $dataDir = dirname($dbPath);
if (!is_dir($dataDir) && !@mkdir($dataDir, 0750, true)) { fwrite(STDERR, "demo-seed: cannot create $dataDir\n"); $GLOBALS['demo_done'] = true; exit(2); }
$apiData = "$apiDir/data";

/* ---------- the demo accounts ---------- */
// role: what it shows. plan: from config.local.php plan_grants (kept in step here only for the summary).
$ACCOUNTS = [
  'student'    => ['email' => 'student@' . DEMO_DOMAIN,    'name' => 'Alex Rivera',      'courses' => ['calc', 'physics', 'precalc'], 'plan' => 'free'],
  'max'        => ['email' => 'max@' . DEMO_DOMAIN,        'name' => 'Jordan Lee',       'courses' => ['calc', 'csci', 'writ'],       'plan' => 'max'],
  'classmate'  => ['email' => 'classmate@' . DEMO_DOMAIN,  'name' => 'Riley Chen',       'courses' => ['physics', 'calc', 'biob'],    'plan' => 'free'],
  'moderator'  => ['email' => 'moderator@' . DEMO_DOMAIN,  'name' => 'Sam Patel',        'courses' => ['precalc', 'calc'],            'plan' => 'free'],
  'admin'      => ['email' => 'admin@' . DEMO_DOMAIN,      'name' => 'Taylor Brooks',    'courses' => ['calc', 'physics'],            'plan' => 'free'],
  'instructor' => ['email' => 'instructor@' . DEMO_DOMAIN, 'name' => 'Dr. Casey Morgan', 'courses' => [],                             'plan' => 'free'],
];
$INSTRUCTOR_EMAIL = $ACCOUNTS['instructor']['email'];

function demo_lockdown(string $dataDir, string $apiData): void {
  // Keys & settings in the admin panel are saved to <data>/site-config.json and win over config.local.php.
  // A folder in its place makes the panel's saves fail ("The settings could not be saved") and its reads find
  // nothing (is_file() is false), so mail, keys, purchase links and staff lists stay as config.local.php says.
  $sc = "$dataDir/site-config.json";
  if (is_file($sc) || is_link($sc)) @unlink($sc);
  if (!is_dir($sc)) @mkdir($sc, 0750);
  @file_put_contents("$sc/README.txt", "StudyCat demo: this folder stands where the admin panel would save Keys & settings, so they cannot be changed in the public demo. Made by api/demo-seed.php.\n");
  foreach ([$dataDir, $apiData] as $d) if (is_dir($d) && !is_file("$d/.htaccess")) @file_put_contents("$d/.htaccess", "Require all denied\n");
}
function demo_rmtree(string $dir): void {
  if (!is_dir($dir) || is_link($dir)) return;
  foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST) as $f) { $f->isDir() && !$f->isLink() ? @rmdir($f->getPathname()) : @unlink($f->getPathname()); }
  @rmdir($dir);
}
function demo_lockdown_ok(string $dataDir): bool { return is_dir("$dataDir/site-config.json") && !is_file("$dataDir/site-config.json"); }

/** Creates or repairs one account: verified, demo password, welcomed, rules accepted, every email switched off. */
function demo_account(array $a, int $created): int {
  $db = mh_db(); $email = strtolower($a['email']); $now = time();
  $st = $db->prepare('SELECT id FROM users WHERE email = ?'); $st->execute([$email]); $id = (int)$st->fetchColumn(); $st->closeCursor();
  $hash = password_hash(DEMO_PASSWORD, PASSWORD_DEFAULT);
  if (!$id) {
    $db->prepare('INSERT INTO users (email, name, pass_hash, verified, created, last_login) VALUES (?, ?, ?, 1, ?, ?)')->execute([$email, $a['name'], $hash, $created, $now - 3600]);
    $id = (int)$db->lastInsertId();
    $db->prepare('UPDATE users SET courses = ? WHERE id = ?')->execute([json_encode(array_values($a['courses'])), $id]);
  }
  $db->prepare('UPDATE users SET name = ?, pass_hash = ?, verified = 1, terms_accepted = CASE WHEN terms_accepted > 0 THEN terms_accepted ELSE ? END, welcomed = CASE WHEN welcomed > 0 THEN welcomed ELSE ? END, plan_choice = ?,
      notify_email = 0, digest_email = 0, reminder_email = 0, planning_email = 0, news_email = 0, recap_email = 0, exam_nudge = 0, show_on_leaderboard = 1, focus_public = 1 WHERE id = ?')
     ->execute([$a['name'], $hash, $created, $created, $a['plan'], $id]);
  $db->prepare('DELETE FROM bans WHERE user_id = ?')->execute([$id]);
  $db->prepare('DELETE FROM codes WHERE email = ?')->execute([$email]);
  return $id;
}
function demo_instructor_role(string $email, int $uid, string $name): void {
  require_once $GLOBALS['apiDir'] . '/teach.php';
  $db = mh_teach_db(); $now = time();
  // exactly what Admin panel -> Instructors -> Approve writes: role Instructor, scope teach (their own classes only)
  $db->prepare('INSERT INTO roles (email, role, updated, scope) VALUES (?, \'Instructor\', ?, \'teach\') ON CONFLICT(email) DO UPDATE SET role = \'Instructor\', scope = \'teach\', updated = excluded.updated')->execute([strtolower($email), $now]);
  $st = $db->prepare('SELECT COUNT(*) FROM teach_requests WHERE user_id = ?'); $st->execute([$uid]); $has = (int)$st->fetchColumn(); $st->closeCursor();
  if (!$has) $db->prepare('INSERT INTO teach_requests (user_id, name, title, department, courses, message, status, created, decided, decided_by) VALUES (?, ?, ?, ?, ?, ?, \'approved\', ?, ?, 0)')
    ->execute([$uid, $name, 'Instructor (demo)', 'Mathematical Sciences (demo)', 'Calculus I (demo section)', 'Demo account for the public StudyCat demo.', $now - 9 * 86400, $now - 8 * 86400]);
}

/* ---------- --check ---------- */
if (isset($opts['check'])) {
  $db = mh_db();
  say('Demo database: ' . $dbPath);
  say('Lockdown (site-config.json is a folder): ' . (demo_lockdown_ok($dataDir) ? 'yes' : 'NO, run the seed'));
  say('Mail: ' . ($cfg['mail_mode'] ?? '?') . ' | AI key: ' . (($cfg['anthropic_key'] ?? '') === '' ? 'none' : 'SET') . ' | RevenueCat: ' . (($cfg['revenuecat_secret'] ?? '') === '' ? 'none' : 'SET'));
  foreach ($ACCOUNTS as $k => $a) { $u = mh_user_by_email($a['email']); say(sprintf('  %-10s %-26s %s', $k, $a['email'], $u ? (((int)$u['verified'] === 1 && password_verify(DEMO_PASSWORD, $u['pass_hash'])) ? 'ok' : 'NEEDS REPAIR') : 'MISSING')); }
  foreach (['users', 'posts', 'comments', 'reports', 'progress'] as $t) say("  $t: " . (int)$db->query("SELECT COUNT(*) FROM $t")->fetchColumn());
  $GLOBALS['demo_done'] = true; exit(0);
}

/* ---------- --repair: accounts only ---------- */
if (isset($opts['repair'])) {
  demo_lockdown($dataDir, $apiData);
  $ids = []; foreach ($ACCOUNTS as $k => $a) $ids[$k] = demo_account($a, time() - 30 * 86400);
  demo_instructor_role($INSTRUCTOR_EMAIL, $ids['instructor'], $ACCOUNTS['instructor']['name']);
  // StudyCat allows 12 sign-ins per address per 15 minutes (api/index.php, login). Many visitors share these accounts,
  // so the shared counters are cleared here; run --repair every few minutes to keep the demo accounts usable.
  $n = mh_db()->exec("DELETE FROM rate WHERE key LIKE 'login:email:%@" . DEMO_DOMAIN . "'");
  say('Demo accounts repaired (' . count($ids) . '); sign-in limits cleared (' . (int)$n . ').');
  $GLOBALS['demo_done'] = true; exit(0);
}

/* ============================================================
   Full reset
   ============================================================ */
say("StudyCat demo reset: $dbPath");

// 1) wipe: every table dropped in place (the next request recreates the schema), and the files beside the database
if (is_file($dbPath)) {
  $raw = new PDO('sqlite:' . $dbPath, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $raw->exec('PRAGMA busy_timeout=15000'); $raw->exec('PRAGMA foreign_keys=OFF'); $raw->exec('BEGIN IMMEDIATE');
  foreach ($raw->query("SELECT type, name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_ASSOC) as $r) $raw->exec('DROP ' . strtoupper($r['type']) . ' IF EXISTS "' . str_replace('"', '""', $r['name']) . '"');
  $raw->exec('COMMIT'); $raw->exec('VACUUM'); $raw = null;
}
foreach (['canvas.json'] as $f) @unlink("$dataDir/$f");
foreach (['backups', 'syllabi', 'students', 'ai-img', 'offsite-tmp'] as $d) { demo_rmtree("$dataDir/$d"); if ($apiData !== $dataDir) demo_rmtree("$apiData/$d"); }
if (!is_dir($apiData)) @mkdir($apiData, 0750, true);   // where api/mailer.php writes mail.log in 'log' mode (blocked from the web)
if (is_file("$apiData/mail.log")) @file_put_contents("$apiData/mail.log", '');
demo_lockdown($dataDir, $apiData);

// 2) schema: StudyCat makes its own tables (core, class packs incl. the bundled ones, Faculty, plans, ledger)
$db = mh_db(); mh_secret(); mh_pack_db(); mh_ledger_db();
require_once "$apiDir/filter.php"; require_once "$apiDir/social.php"; require_once "$apiDir/growth.php"; require_once "$apiDir/forum.php";
require_once "$apiDir/teach.php"; require_once "$apiDir/packs.php"; require_once "$apiDir/myclasses.php"; require_once "$apiDir/canvas.php";
mh_teach_db(); mh_myclass_db();
$now = time(); $DAY = 86400;

// 3) accounts
$ids = []; $i = 0;
foreach ($ACCOUNTS as $k => $a) $ids[$k] = demo_account($a, $now - (40 - 3 * $i++) * $DAY);
demo_instructor_role($INSTRUCTOR_EMAIL, $ids['instructor'], $ACCOUNTS['instructor']['name']);
say('  accounts: ' . implode(', ', array_map(fn($a) => $a['email'], $ACCOUNTS)));

// 4) the site banner (Admin -> Site settings -> Announcement), so visitors know what they are looking at
mh_setting_set('announcement', 'This is a demo of StudyCat with sample accounts. Sign-up and email are switched off, Bo (the AI tutor) is not connected, and everything resets every night.');

/* ---------- 5) discussions ---------- */
$U = fn(string $k) => $ids[$k];
$post = function (string $who, string $course, string $flair, string $title, string $body, float $daysAgo, array $o = []) use ($db, $U, $now, $DAY): int {
  $t = (int)($now - $daysAgo * $DAY);
  $db->prepare('INSERT INTO posts (user_id, course, flair, title, body, anon, created, pinned, locked, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([$U($who), $course, $flair, mh_censor($title), mh_censor($body), (int)($o['anon'] ?? 0), $t, (int)($o['pinned'] ?? 0), (int)($o['locked'] ?? 0), '127.0.0.1']);
  $id = (int)$db->lastInsertId();
  $db->prepare('INSERT OR REPLACE INTO votes (user_id, kind, item_id, value) VALUES (?, "p", ?, 1)')->execute([$U($who), $id]);
  mh_activity($flair === 'question' ? 'post' : 'post', $course, ($flair === 'question' ? 'New question: ' : 'New post: ') . $title, '#/forum/' . $id);
  $db->prepare('UPDATE activity SET created = ? WHERE id = ?')->execute([$t, (int)$db->lastInsertId()]);
  return $id;
};
$comment = function (int $postId, string $who, string $body, float $daysAgo, ?int $parent = null) use ($db, $U, $now, $DAY): int {
  $t = (int)($now - $daysAgo * $DAY);
  $db->prepare('INSERT INTO comments (post_id, user_id, parent_id, body, anon, created, ip) VALUES (?, ?, ?, ?, 0, ?, ?)')->execute([$postId, $U($who), $parent, mh_censor($body), $t, '127.0.0.1']);
  $id = (int)$db->lastInsertId();
  $db->prepare('INSERT OR REPLACE INTO votes (user_id, kind, item_id, value) VALUES (?, "c", ?, 1)')->execute([$U($who), $id]);
  $db->prepare('UPDATE posts SET ncomments = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND removed = 0) WHERE id = ?')->execute([$postId, $postId]);
  // the inbox line the post's author gets (api/forum.php, mh_notify_reply), unread
  $st = $db->prepare('SELECT user_id, title FROM posts WHERE id = ?'); $st->execute([$postId]); $p = $st->fetch(PDO::FETCH_ASSOC); $st->closeCursor();
  if ($p && (int)$p['user_id'] !== $U($who)) { $st = $db->prepare('SELECT name, email FROM users WHERE id = ?'); $st->execute([$U($who)]); $actor = $st->fetch(PDO::FETCH_ASSOC); $st->closeCursor();
    $db->prepare('INSERT INTO notifications (user_id, kind, post_id, comment_id, actor_id, actor, title, snippet, created) VALUES (?, \'comment\', ?, ?, ?, ?, ?, ?, ?)')->execute([(int)$p['user_id'], $postId, $id, $U($who), mh_display_name($actor), mb_substr($p['title'], 0, 120), mb_substr($body, 0, 140), $t]); }
  return $id;
};
$vote = function (string $who, string $kind, int $id, int $v = 1) use ($db, $U): void { $db->prepare('INSERT OR REPLACE INTO votes (user_id, kind, item_id, value) VALUES (?, ?, ?, ?)')->execute([$U($who), $kind, $id, $v]); };
$report = function (string $who, string $kind, int $id, string $reason, float $daysAgo) use ($db, $U, $now, $DAY): void { $db->prepare('INSERT INTO reports (kind, item_id, user_id, reason, created) VALUES (?, ?, ?, ?, ?)')->execute([$kind, $id, $U($who), $reason, (int)($now - $daysAgo * $DAY)]); };

$p0 = $post('admin', 'general', 'discussion', 'Welcome to the StudyCat demo board',
  "This board is part of a public demo. Everyone you see here is a sample account, and the whole site goes back to this starting point every night.\n\nTry it out: vote, comment, ask a question with math like \$\\int_0^1 x^2\\,dx = \\tfrac13\$, or report something to see the moderator side.", 6.2, ['pinned' => 1]);
$p1 = $post('student', 'calc', 'question', 'Product rule or chain rule first for f(x) = x² sin(3x)?',
  "I keep mixing these up. For \$f(x) = x^2\\sin(3x)\$ I used the product rule and then the chain rule on the sine and got\n\n\$\$f'(x) = 2x\\sin(3x) + 3x^2\\cos(3x)\$\$\n\nIs that right, or should the chain rule come first?", 2.3);
$c11 = $comment($p1, 'instructor', "That is right. The outside structure is a product, so the product rule comes first; the chain rule only shows up inside, when you differentiate \$\\sin(3x)\$ and get \$3\\cos(3x)\$.\n\nA quick self-check: at \$x = 0\$ both your answer and the original slope are 0.", 2.1);
$c12 = $comment($p1, 'moderator', "What helps me: write \$u = x^2\$ and \$v = \\sin(3x)\$, list \$u' = 2x\$ and \$v' = 3\\cos(3x)\$ first, then plug into \$u'v + uv'\$.", 1.9);
$c13 = $comment($p1, 'student', 'Thanks both, the u/v list makes it click.', 1.8, $c12);
$db->prepare('UPDATE posts SET accepted_id = ? WHERE id = ?')->execute([$c11, $p1]);

$p2 = $post('max', 'calc', 'study-group', 'Exam 3 review group: Sunday 4 pm, library 2nd floor',
  "Going over related rates and optimization before Exam 3. Bring a practice exam and questions you got stuck on. Anyone in?", 1.4);
$c21 = $comment($p2, 'student', "I'm in. Can we do a couple of the sliding-ladder related rates problems?", 1.3);
$c22 = $comment($p2, 'classmate', 'Count me in, I will bring the whiteboard markers.', 1.1);
$c23 = $comment($p2, 'classmate', 'Need help? Cheap essay and homework writing, $20 a page, message me for a price.', 0.9);

$p3 = $post('classmate', 'physics', 'question', 'Why does 45° give the longest projectile range?',
  "The range formula is \$R = \\dfrac{v_0^2 \\sin(2\\theta)}{g}\$. I get that it depends on the angle, but why exactly 45°?", 3.0);
$c31 = $comment($p3, 'student', "Because \$\\sin(2\\theta)\$ is largest (equal to 1) when \$2\\theta = 90^\\circ\$, so \$\\theta = 45^\\circ\$. That only holds with no air resistance and when it lands at the height it was launched from. The projectile simulator under Physics > Tools shows it nicely.", 2.8);
$c32 = $comment($p3, 'max', 'And angles that add up to 90° (like 30° and 60°) land in the same spot. Took me way too long to notice that.', 2.6);

$p4 = $post('moderator', 'precalc', 'resource', 'Unit circle: remembering sin and cos of 30°, 45°, 60°',
  "The pattern I use: the sines of \$0^\\circ, 30^\\circ, 45^\\circ, 60^\\circ, 90^\\circ\$ are\n\n\$\$\\frac{\\sqrt0}{2},\\ \\frac{\\sqrt1}{2},\\ \\frac{\\sqrt2}{2},\\ \\frac{\\sqrt3}{2},\\ \\frac{\\sqrt4}{2}\$\$\n\nand the cosines are the same list backwards. The Unit circle tool under Precalculus lets you drag the angle and check.", 4.5);
$c41 = $comment($p4, 'student', 'This is so much easier than memorizing the table, thank you!', 4.2);

$p5 = $post('max', 'writ', 'discussion', 'How do you start a draft when you are stuck?',
  "I always stare at a blank page for the first half hour. What do you do to get the first paragraph down?", 1.0);
$c51 = $comment($p5, 'classmate', 'I write the middle first. Introductions are easier once you know what you are introducing.', 0.8);

$p6 = $post('classmate', 'calc', 'exam', 'Anyone have the Exam 3 answer key?', 'Will trade my notes for it. Message me before Tuesday.', 0.6);

foreach ([['student', $p0], ['max', $p0], ['classmate', $p0], ['moderator', $p0], ['instructor', $p0], ['max', $p1], ['classmate', $p1], ['admin', $p1], ['student', $p2], ['classmate', $p2], ['student', $p3], ['max', $p3], ['admin', $p3], ['student', $p4], ['max', $p4], ['classmate', $p4], ['admin', $p4], ['student', $p5]] as [$w, $id]) $vote($w, 'p', $id);
foreach ([['student', $c11], ['max', $c11], ['classmate', $c11], ['student', $c12], ['max', $c12], ['classmate', $c31], ['max', $c31], ['admin', $c31], ['student', $c32], ['max', $c21]] as [$w, $id]) $vote($w, 'c', $id);
$vote('student', 'c', $c23, -1); $vote('max', 'c', $c23, -1);
foreach ($db->query('SELECT id FROM posts')->fetchAll(PDO::FETCH_COLUMN) as $id) mh_recount('p', (int)$id);
foreach ($db->query('SELECT id FROM comments')->fetchAll(PDO::FETCH_COLUMN) as $id) mh_recount('c', (int)$id);

// reports for the moderator queue (the reasons are the dialog's choices, assets/forum.js)
$report('student', 'p', $p6, 'Exam answers or cheating: asking for the answer key before the exam', 0.5);
$report('max', 'p', $p6, 'Exam answers or cheating', 0.4);
$report('student', 'c', $c23, 'Spam or advertising: selling homework', 0.7);
say('  discussions: ' . (int)$db->query('SELECT COUNT(*) FROM posts')->fetchColumn() . ' posts, ' . (int)$db->query('SELECT COUNT(*) FROM comments')->fetchColumn() . ' comments, 3 open reports');

/* ---------- 6) StudyCat Faculty: a published demo class with students ---------- */
$tz = new DateTimeZone((string)($cfg['timezone'] ?? 'America/Denver'));
$owner = mh_user_by_email($INSTRUCTOR_EMAIL);
$topics = [   // week starting => [Mon, Wed, Fri] lecture titles (Active Calculus order); this is a sample syllabus for a demo section
  '2026-08-24' => ['Course intro; velocity and position (1.1)', 'Average rate of change (1.1)', 'Limits (1.2)'],
  '2026-08-31' => ['Limits by algebra (1.2)', 'The derivative at a point (1.3)', 'The derivative function (1.4)'],
  '2026-09-07' => ['', 'Interpreting the derivative (1.5)', 'Second derivative and concavity (1.6)'],
  '2026-09-14' => ['Review', 'Continuity (1.7)', ''],
  '2026-09-21' => ['Tangent line approximation (1.8)', 'Power, sum and exponential rules (2.1)', 'Trig derivatives (2.2)'],
  '2026-09-28' => ['Product and quotient rules (2.3)', 'Derivatives of other trig functions (2.4)', 'The chain rule (2.5)'],
  '2026-10-05' => ['Chain rule practice (2.5)', 'Inverse functions (2.6)', 'Implicit differentiation (2.7)'],
  '2026-10-12' => ['Review', 'L\'Hôpital\'s rule (2.8)', ''],
  '2026-10-19' => ['Using derivatives: extrema (3.1)', 'First and second derivative tests (3.1)', 'Global optimization (3.3)'],
  '2026-10-26' => ['Applied optimization (3.4)', 'Applied optimization (3.4)', 'Related rates (3.5)'],
  '2026-11-02' => ['Related rates (3.5)', 'Related rates practice (3.5)', 'Review'],
  '2026-11-09' => ['Determining distance traveled (4.1)', '', 'Riemann sums (4.2)'],
  '2026-11-16' => ['Review for Exam 3', '', 'The definite integral (4.3)'],
  '2026-11-23' => ['The Fundamental Theorem (4.4)', '', ''],
  '2026-11-30' => ['Antiderivatives (5.1)', 'Antiderivatives (5.1)', 'Second FTC (5.2)'],
  '2026-12-07' => ['Substitution (5.3)', 'Review', 'Review for the final'],
];
$rows = [];
foreach ($topics as $mon => $days) foreach ([0, 2, 4] as $j => $off) {
  $d = (new DateTime($mon . ' 12:00:00', $tz))->modify("+$off days")->format('Y-m-d');
  if ($days[$j] === '') { $hol = ['2026-09-07' => 'Labor Day: no class', '2026-11-11' => 'Veterans Day: no class', '2026-11-25' => 'Thanksgiving break', '2026-11-27' => 'Thanksgiving break'][$d] ?? null; if ($hol) $rows[] = ['date' => $d, 'type' => 'holiday', 'title' => $hol, 'notes' => '']; continue; }
  $rows[] = ['date' => $d, 'type' => str_starts_with($days[$j], 'Review') ? 'review' : 'lecture', 'title' => $days[$j], 'notes' => ''];
}
$rows[] = ['date' => '2026-11-23', 'type' => 'due', 'title' => 'Written homework 10 due', 'notes' => 'Upload to the course site by 8 pm.'];
$syl = mh_teach_starter($owner, ['id' => 0, 'code' => 'M 171', 'title' => 'Calculus I (demo section)', 'term' => 'Fall 2026', 'section' => 'D1']);
$syl['course'] = array_merge($syl['course'], [
  'credits' => '4', 'modality' => 'In person',
  'meets' => [['days' => 'MWF', 'start' => '10:00', 'end' => '10:50', 'room' => 'Demo Hall 101', 'kind' => 'Lecture'], ['days' => 'Tu', 'start' => '13:00', 'end' => '13:50', 'room' => 'Demo Hall 014', 'kind' => 'Lab']],
  'prereqs' => 'M 151 Precalculus or a placement score (sample text for the demo).',
  'description' => "A sample syllabus made in StudyCat Faculty for the public demo.\n\nLimits, derivatives and their uses, and an introduction to integrals, taught from the free Active Calculus textbook. Class time is spent working problems in small groups; the lecture notes and practice live on StudyCat.",
  'outcomes' => ['Compute limits and derivatives of algebraic, exponential and trigonometric functions.', 'Interpret a derivative as a rate of change in context, with units.', 'Solve related rates and optimization problems and justify the answer.', 'Estimate and compute definite integrals with Riemann sums and the Fundamental Theorem.'],
]);
$syl['people'] = [['role' => 'Instructor', 'name' => 'Dr. Casey Morgan', 'email' => $INSTRUCTOR_EMAIL, 'office' => 'Demo Hall 210', 'hours' => 'Mon and Wed 1–2 pm, or by appointment', 'pronouns' => 'they/them'], ['role' => 'TA', 'name' => 'Sam Patel', 'email' => $ACCOUNTS['moderator']['email'], 'office' => 'Math help room', 'hours' => 'Thu 3–5 pm', 'pronouns' => '']];
$syl['materials'] = [['title' => 'Active Calculus, single variable (free online)', 'url' => 'https://activecalculus.org/single/', 'required' => true, 'note' => 'We follow chapters 1–5.'], ['title' => 'A graphing calculator (optional)', 'url' => '', 'required' => false, 'note' => 'Not allowed on exams.']];
$syl['exams'] = [
  ['name' => 'Exam 1', 'date' => '2026-09-18', 'time' => '10:00', 'place' => 'In class', 'covers' => 'Sections 1.1–1.6'],
  ['name' => 'Exam 2', 'date' => '2026-10-16', 'time' => '10:00', 'place' => 'In class', 'covers' => 'Sections 1.7–2.8'],
  ['name' => 'Exam 3', 'date' => '2026-11-18', 'time' => '10:00', 'place' => 'In class', 'covers' => 'Sections 3.1–4.2'],
  ['name' => 'Final exam', 'date' => '2026-12-15', 'time' => '08:00', 'place' => 'Demo Hall 101', 'covers' => 'Everything, with extra weight on chapters 4–5'],
];
$syl['schedule'] = ['start' => '2026-08-24', 'end' => '2026-12-11', 'rows' => $rows];
$syl['policies']['attendance'] = 'Come to class: group work counts toward the participation part of the quiz grade. Check in with the 4-digit code shown at the start of class.';
$syl['policies']['late'] = 'Homework is accepted up to 24 hours late for half credit. Each student may skip one lab without penalty.';
$syl['policies']['communication'] = 'Announcements go out on StudyCat. Email me from your school address and expect an answer within one working day.';
$syl = mh_teach_clean_syllabus($syl);
$json = json_encode($syl, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$tdb = mh_teach_db();
$tdb->prepare('INSERT INTO teach_classes (owner_id, code, title, term, section, join_code, link_course, syllabus, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$ids['instructor'], 'M 171', 'Calculus I (demo section)', 'Fall 2026', 'D1', 'MATH26', 'calc', $json, $now - 20 * $DAY, $now - 2 * $DAY]);
$classId = (int)$tdb->lastInsertId();
// publish exactly as teach_class_publish does: the syllabus becomes a class pack only its students get
$c = mh_teach_class($classId);
$errs = array_values(array_filter(mh_teach_lint($syl), fn($x) => $x[0] === 'error')); if ($errs) { fwrite(STDERR, 'demo syllabus has errors: ' . json_encode($errs) . "\n"); exit(1); }
$pid = mh_teach_pack_id($c); $pack = mh_teach_pack($c, $syl, $pid); $err = mh_pack_check($pack); if ($err !== '') { fwrite(STDERR, "demo class pack: $err\n"); exit(1); }
mh_pack_store(mh_pack_db(), $pack, json_encode($pack, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'teach:' . $classId . ' ' . mb_substr(mh_display_name($owner), 0, 60), 1);
$tdb->prepare('UPDATE teach_classes SET pack_id = ?, status = \'published\', published = ?, published_at = ?, version = 1 WHERE id = ?')->execute([$pid, $json, $now - 15 * $DAY, $classId]);
// students and the TA
foreach (['student' => 14, 'max' => 13, 'classmate' => 12] as $k => $ago) { $tdb->prepare('INSERT OR IGNORE INTO teach_members (class_id, user_id, role, joined) VALUES (?, ?, \'student\', ?)')->execute([$classId, $ids[$k], $now - $ago * $DAY]); mh_teach_add_course($ids[$k], $pid); }
$tdb->prepare('INSERT OR IGNORE INTO teach_members (class_id, user_id, role, joined) VALUES (?, ?, \'ta\', ?)')->execute([$classId, $ids['moderator'], $now - 15 * $DAY]);
$tdb->prepare('INSERT OR IGNORE INTO roles (email, role, updated, scope) VALUES (?, \'TA\', ?, \'teach\')')->execute([strtolower($ACCOUNTS['moderator']['email']), $now]);   // as teach_staff_add does
// announcements
$tp = $tdb->prepare('INSERT INTO teach_posts (class_id, user_id, title, body, pinned, created, publish_at, sent) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
$tp->execute([$classId, $ids['instructor'], 'Welcome to Calculus I (demo section)', "Hi everyone! The syllabus, schedule and exam dates are on the class page. Practice for each topic is in StudyCat's Calc I class, and I will post practice sets here before each exam.", 0, $now - 14 * $DAY, $now - 14 * $DAY]);
$tp->execute([$classId, $ids['instructor'], 'Exam 3 is on Wednesday', "Exam 3 covers sections 3.1 to 4.2: extrema, optimization, related rates and Riemann sums. The practice set below is a good warm-up; your best score counts.", 1, $now - 1 * $DAY, $now - 1 * $DAY]);
// a practice assignment from StudyCat's Calc I question bank, with results
$due = (new DateTime('now', $tz))->modify('+3 days')->setTime(23, 59)->getTimestamp();
$tdb->prepare('INSERT INTO teach_assignments (class_id, title, course, topics, count, minutes, due, note, seed, created_by, created, picks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'\')')
    ->execute([$classId, 'Exam 3 warm-up: extrema, optimization and related rates', 'calc', json_encode(['extrema', 'related-rates', 'chain-rule']), 10, 0, $due, 'Retakes are fine; your best score counts.', 424242, $ids['instructor'], $now - 1 * $DAY]);
$aid = (int)$tdb->lastInsertId();
$tdb->prepare('INSERT INTO teach_assignments (class_id, title, course, topics, count, minutes, due, note, seed, created_by, created, picks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'\')')
    ->execute([$classId, 'Derivative rules check-in', 'calc', json_encode(['basic-rules', 'product-quotient', 'chain-rule']), 8, 15, (new DateTime('now', $tz))->modify('-20 days')->setTime(23, 59)->getTimestamp(), '', 171717, $ids['instructor'], $now - 27 * $DAY]);
$aid0 = (int)$tdb->lastInsertId();
$sub = $tdb->prepare('INSERT INTO teach_submissions (assignment_id, user_id, score, total, best, seconds, attempts, topics, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$sub->execute([$aid0, $ids['student'], 7, 8, 7, 610, 2, json_encode(['basic-rules' => [3, 3], 'product-quotient' => [2, 3], 'chain-rule' => [2, 2]]), $now - 22 * $DAY, $now - 21 * $DAY]);
$sub->execute([$aid0, $ids['max'], 6, 8, 6, 744, 1, json_encode(['basic-rules' => [3, 3], 'product-quotient' => [2, 3], 'chain-rule' => [1, 2]]), $now - 21 * $DAY, $now - 21 * $DAY]);
$sub->execute([$aid0, $ids['classmate'], 8, 8, 8, 530, 1, json_encode(['basic-rules' => [3, 3], 'product-quotient' => [3, 3], 'chain-rule' => [2, 2]]), $now - 23 * $DAY, $now - 23 * $DAY]);
$sub->execute([$aid, $ids['classmate'], 8, 10, 8, 820, 1, json_encode(['extrema' => [3, 4], 'related-rates' => [3, 3], 'chain-rule' => [2, 3]]), (int)($now - 0.5 * $DAY), (int)($now - 0.5 * $DAY)]);
// attendance: three past check-ins
$att = $tdb->prepare('INSERT INTO teach_attendance (class_id, label, code, opens, closes, created_by) VALUES (?, ?, ?, ?, ?, ?)'); $chk = $tdb->prepare('INSERT OR IGNORE INTO teach_checkins (session_id, user_id, created) VALUES (?, ?, ?)');
foreach ([[9, 'Mon lecture', ['student', 'max', 'classmate']], [7, 'Wed lecture', ['student', 'classmate']], [2, 'Mon lecture', ['student', 'max', 'classmate']]] as [$ago, $label, $who]) {
  $o = $now - $ago * $DAY; $att->execute([$classId, $label, (string)random_int(1000, 9999), $o, $o + 300, $ids['instructor']]); $sid = (int)$tdb->lastInsertId();
  foreach ($who as $k) $chk->execute([$sid, $ids[$k], $o + 60]);
}
// office hours: next Monday and Wednesday, 1-2 pm, four 15-minute slots, one taken by the student
$slot = $tdb->prepare('INSERT INTO teach_slots (class_id, starts, minutes, place, note, cap, created_by, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
$firstSlot = 0;
foreach (['next monday', 'next wednesday'] as $when) { $d0 = (new DateTime($when, $tz))->setTime(13, 0)->getTimestamp(); for ($k = 0; $k < 4; $k++) { $slot->execute([$classId, $d0 + $k * 900, 15, 'Demo Hall 210', '', 1, $ids['instructor'], $now - $DAY]); if (!$firstSlot) $firstSlot = (int)$tdb->lastInsertId(); } }
$tdb->prepare('INSERT OR IGNORE INTO teach_slot_claims (slot_id, user_id, created) VALUES (?, ?, ?)')->execute([$firstSlot + 1, $ids['student'], $now - 3600]);
say("  Faculty: class 'M 171 Calculus I (demo section)', join code MATH26, pack $pid, 3 students, 2 announcements, 2 assignments");

/* ---------- 7) some Calc I practice history, so dashboards, streaks and weakest topics are not empty ----------
   The same shape the page saves through the data route (assets/app.js): per-topic counts, a history of answers by
   local date, active days, XP per day and flashcard boxes. Dates are relative to today, so streaks stay current. */
$day = fn(int $ago) => (new DateTime('now', $tz))->modify("-$ago days")->format('Y-m-d');
$cards = []; if (preg_match_all('/id:"(fc-[a-z0-9-]+)"/', (string)@file_get_contents(dirname($apiDir) . '/assets/calc-data.js'), $m)) $cards = array_values(array_unique($m[1]));
// topic => how often this student gets it right
$skill = [
  'student'   => ['velocity' => .9, 'aroc' => .9, 'limit-algebra' => .8, 'limit-def' => .85, 'derivative-function' => .8, 'second-derivative' => .75, 'basic-rules' => .95, 'trig' => .85, 'product-quotient' => .8, 'chain-rule' => .75, 'implicit' => .7, 'lhopital' => .65, 'extrema' => .7, 'related-rates' => .55, 'optimization' => .45, 'distance' => .7, 'riemann' => .6, 'definite-integral' => .65, 'ftc' => .6, 'antiderivatives' => .7, 'ftc2' => .55],
  'max'       => ['aroc' => .8, 'limit-algebra' => .7, 'deriv-point' => .8, 'basic-rules' => .9, 'product-quotient' => .75, 'chain-rule' => .8, 'implicit' => .65, 'extrema' => .75, 'related-rates' => .7, 'optimization' => .6],
  'classmate' => ['basic-rules' => .95, 'chain-rule' => .9, 'implicit' => .85, 'related-rates' => .8, 'optimization' => .75, 'riemann' => .7],
];
$plan = ['student' => [0 => 14, 1 => 12, 2 => 10, 3 => 13, 4 => 11, 6 => 9, 7 => 12, 8 => 8, 11 => 10, 13 => 8, 15 => 9, 18 => 10], 'max' => [0 => 8, 1 => 10, 3 => 9, 4 => 7, 5 => 6, 9 => 8], 'classmate' => [0 => 10, 1 => 6, 2 => 9, 5 => 8, 6 => 7]];
mt_srand(2026);
$ud = $db->prepare('INSERT OR IGNORE INTO user_days (user_id, day) VALUES (?, ?)');
foreach ($plan as $k => $days) {
  $topics = array_keys($skill[$k]); $hist = []; $prog = []; $act = []; $xp = []; $ti = 0;
  krsort($days);
  foreach ($days as $ago => $n) {
    $d = $day($ago); $act[$d] = true; $ok = 0;
    for ($q = 0; $q < $n; $q++) {
      $t = $topics[$ti++ % count($topics)]; $right = mt_rand(0, 999) < $skill[$k][$t] * 1000;
      $hist[] = ['t' => $t, 'ok' => $right, 'd' => $d, 'k' => base_convert((string)mt_rand(), 10, 36) . base_convert((string)mt_rand(), 10, 36)];
      $prog[$t] = ['a' => ($prog[$t]['a'] ?? 0) + 1, 'c' => ($prog[$t]['c'] ?? 0) + ($right ? 1 : 0)]; $ok += $right ? 1 : 0;
    }
    $xp[] = ['d' => $d, 'n' => $n * 5 + $ok * 2 + 10];
    $ud->execute([$ids[$k], $d]);
  }
  $data = ['progress' => $prog, 'history' => array_slice($hist, -400), 'activity' => $act, 'xp' => $xp];
  if ($cards && $k === 'student') {   // flashcard boxes (0-4) and when each was last reviewed (ms)
    $fc = []; $at = []; foreach (array_slice($cards, 0, 28) as $j => $cid) { $fc[$cid] = [3, 2, 4, 1, 2, 3, 0][$j % 7]; $at[$cid] = (int)(($now - (($j % 6) * $DAY) - $j * 300) * 1000); }
    $data['flashcards'] = $fc; $data['fcAt'] = $at;
  }
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  $db->prepare('INSERT OR REPLACE INTO progress (user_id, course, json, updated) VALUES (?, ?, ?, ?)')->execute([$ids[$k], 'calc', $json, $now * 1000]);
  mh_weekly_stats_update($ids[$k], 'calc', $data);   // this week's totals for class goals, as the data route does
}
say('  practice history: Calc I for student, max and classmate');

$GLOBALS['demo_done'] = true;
say('Done. Demo password for every account: ' . DEMO_PASSWORD);
