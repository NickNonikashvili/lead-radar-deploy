<?php
/* ============================================================
   MatHub account server — shared helpers
   SQLite storage, JSON I/O, rate limits, email codes, login tokens.
   ============================================================ */
declare(strict_types=1);

function mh_config(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;
  $cfg = require __DIR__ . '/config.php';
  if (is_file(__DIR__ . '/config.local.php')) { $local = require __DIR__ . '/config.local.php'; if (is_array($local)) $cfg = array_merge($cfg, $local); }
  return $cfg;
}

function mh_json($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=UTF-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}
function mh_fail(string $message, int $status = 400, array $extra = []): void {
  mh_json(array_merge(['ok' => false, 'error' => $message], $extra), $status);
}

function mh_input(): array {
  static $in = null;
  if ($in !== null) return $in;
  $raw = file_get_contents('php://input') ?: '';
  $ct = $_SERVER['CONTENT_TYPE'] ?? '';
  if ($raw !== '' && stripos($ct, 'application/json') !== false) { $j = json_decode($raw, true); $in = is_array($j) ? $j : []; }
  elseif ($raw !== '' && ($j = json_decode($raw, true)) !== null && is_array($j)) { $in = $j; }
  else $in = $_POST;
  return $in;
}
function mh_str(array $in, string $k, int $max = 200): string { $v = $in[$k] ?? ''; return is_string($v) ? trim(mb_substr($v, 0, $max)) : ''; }

function mh_db(): PDO {
  static $db = null;
  if ($db) return $db;
  $cfg = mh_config(); $path = $cfg['db_path'];
  $dir = dirname($path); if (!is_dir($dir)) @mkdir($dir, 0755, true);
  try { $db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]); }
  catch (Throwable $e) { mh_fail('The account database cannot be opened. Make sure api/data is writable (permissions 755) on the server.', 500); }
  $db->exec('PRAGMA journal_mode=WAL'); $db->exec('PRAGMA busy_timeout=4000'); $db->exec('PRAGMA foreign_keys=ON');
  $db->exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT "", pass_hash TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, last_login INTEGER)');
  $db->exec('CREATE TABLE IF NOT EXISTS codes (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, kind TEXT NOT NULL, code_hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)');
  $db->exec('CREATE INDEX IF NOT EXISTS codes_email ON codes(email, kind)');
  $db->exec('CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL, created INTEGER NOT NULL, ua TEXT NOT NULL DEFAULT "")');
  $db->exec('CREATE TABLE IF NOT EXISTS progress (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course TEXT NOT NULL, json TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user_id, course))');
  $db->exec('CREATE TABLE IF NOT EXISTS rate (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)');
  // discussions
  $cols = array_column($db->query('PRAGMA table_info(users)')->fetchAll(), 'name');
  if (!in_array('terms_accepted', $cols, true)) $db->exec('ALTER TABLE users ADD COLUMN terms_accepted INTEGER NOT NULL DEFAULT 0');
  $db->exec('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course TEXT NOT NULL, flair TEXT NOT NULL DEFAULT "question", title TEXT NOT NULL, body TEXT NOT NULL, anon INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, edited INTEGER, score INTEGER NOT NULL DEFAULT 0, ncomments INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0, ip TEXT NOT NULL DEFAULT "")');
  $db->exec('CREATE INDEX IF NOT EXISTS posts_course ON posts(course, removed, created)');
  $db->exec('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, parent_id INTEGER, body TEXT NOT NULL, anon INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, edited INTEGER, score INTEGER NOT NULL DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0, ip TEXT NOT NULL DEFAULT "")');
  $db->exec('CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id)');
  $db->exec('CREATE TABLE IF NOT EXISTS votes (user_id INTEGER NOT NULL, kind TEXT NOT NULL, item_id INTEGER NOT NULL, value INTEGER NOT NULL, PRIMARY KEY (user_id, kind, item_id))');
  $db->exec('CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, item_id INTEGER NOT NULL, user_id INTEGER NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL, status TEXT NOT NULL DEFAULT "open")');
  $db->exec('CREATE TABLE IF NOT EXISTS bans (user_id INTEGER PRIMARY KEY, until INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT "", created INTEGER NOT NULL)');
  // notifications, site settings (all additive: existing rows are never touched)
  if (!in_array('notify_email', $cols, true)) $db->exec('ALTER TABLE users ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1');
  $db->exec('CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, post_id INTEGER NOT NULL, comment_id INTEGER, actor_id INTEGER, actor TEXT NOT NULL DEFAULT "", title TEXT NOT NULL DEFAULT "", snippet TEXT NOT NULL DEFAULT "", created INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0)');
  $db->exec('CREATE INDEX IF NOT EXISTS notif_user ON notifications(user_id, read, created)');
  $db->exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL)');
  // community features (additive)
  foreach (['show_on_leaderboard' => 1, 'digest_email' => 1] as $col => $def) if (!in_array($col, $cols, true)) $db->exec("ALTER TABLE users ADD COLUMN $col INTEGER NOT NULL DEFAULT $def");
  if (!in_array('digest_sent', $cols, true)) $db->exec('ALTER TABLE users ADD COLUMN digest_sent INTEGER NOT NULL DEFAULT 0');
  $pcols = array_column($db->query('PRAGMA table_info(posts)')->fetchAll(), 'name');
  if (!in_array('accepted_id', $pcols, true)) $db->exec('ALTER TABLE posts ADD COLUMN accepted_id INTEGER');
  $db->exec('CREATE TABLE IF NOT EXISTS challenge_attempts (user_id INTEGER NOT NULL, course TEXT NOT NULL, date TEXT NOT NULL, ok INTEGER NOT NULL, ms INTEGER NOT NULL, points INTEGER NOT NULL, topic TEXT NOT NULL DEFAULT "", created INTEGER NOT NULL, PRIMARY KEY (user_id, course, date))');
  $db->exec('CREATE INDEX IF NOT EXISTS ca_course_date ON challenge_attempts(course, date)');
  $db->exec('CREATE TABLE IF NOT EXISTS badges (user_id INTEGER NOT NULL, code TEXT NOT NULL, earned INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, code))');
  $db->exec('CREATE TABLE IF NOT EXISTS presence (user_id INTEGER PRIMARY KEY, course TEXT NOT NULL DEFAULT "", view TEXT NOT NULL DEFAULT "", post_id INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL)');
  $db->exec('CREATE TABLE IF NOT EXISTS meets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, course TEXT NOT NULL, title TEXT NOT NULL, place TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL, note TEXT NOT NULL DEFAULT "", cancelled INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)');
  $db->exec('CREATE TABLE IF NOT EXISTS meet_rsvp (meet_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (meet_id, user_id))');
  $db->exec('CREATE TABLE IF NOT EXISTS polls (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL UNIQUE, question TEXT NOT NULL DEFAULT "", options TEXT NOT NULL, multi INTEGER NOT NULL DEFAULT 0, auto_key TEXT UNIQUE, created INTEGER NOT NULL)');
  $db->exec('CREATE TABLE IF NOT EXISTS poll_votes (poll_id INTEGER NOT NULL, user_id INTEGER NOT NULL, opt INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (poll_id, user_id, opt))');
  $db->exec('CREATE TABLE IF NOT EXISTS mocks (id INTEGER PRIMARY KEY AUTOINCREMENT, course TEXT NOT NULL, exam_id TEXT NOT NULL, title TEXT NOT NULL, start INTEGER NOT NULL, minutes INTEGER NOT NULL, count INTEGER NOT NULL, seed INTEGER NOT NULL, created_by INTEGER NOT NULL, created INTEGER NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0)');
  $db->exec('CREATE TABLE IF NOT EXISTS mock_reg (mock_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (mock_id, user_id))');
  $db->exec('CREATE TABLE IF NOT EXISTS mock_results (mock_id INTEGER NOT NULL, user_id INTEGER NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, ms INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (mock_id, user_id))');
  $db->exec('CREATE TABLE IF NOT EXISTS contributions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, course TEXT NOT NULL, kind TEXT NOT NULL, unit INTEGER NOT NULL DEFAULT 0, sec TEXT NOT NULL DEFAULT "", front TEXT NOT NULL, back TEXT NOT NULL, explanation TEXT NOT NULL DEFAULT "", status TEXT NOT NULL DEFAULT "pending", score INTEGER NOT NULL DEFAULT 0, anon INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)');
  $db->exec('CREATE INDEX IF NOT EXISTS contrib_course ON contributions(course, kind, status)');
  $db->exec('CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, course TEXT NOT NULL DEFAULT "", text TEXT NOT NULL, link TEXT NOT NULL DEFAULT "", created INTEGER NOT NULL)');
  $db->exec('CREATE TABLE IF NOT EXISTS roles (email TEXT PRIMARY KEY, role TEXT NOT NULL, updated INTEGER NOT NULL)');
  return $db;
}

function mh_secret(): string {
  static $s = null; if ($s) return $s;
  $f = dirname(mh_config()['db_path']) . '/secret.key';
  if (!is_file($f)) { @file_put_contents($f, bin2hex(random_bytes(32)), LOCK_EX); @chmod($f, 0600); }
  $s = trim((string)@file_get_contents($f));
  if ($s === '') mh_fail('The server cannot write to api/data. Give that folder write permission (755 or 775) and retry.', 500);
  return $s;
}

function mh_client_ip(): string {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  return substr(preg_replace('/[^0-9a-fA-F:.]/', '', $ip), 0, 45);
}

/** Sliding window counter. Returns true when the action is allowed. */
function mh_rate(string $key, int $limit, int $windowSec): bool {
  $db = mh_db(); $now = time();
  if (random_int(1, 50) === 1) $db->exec('DELETE FROM rate WHERE window_start < ' . ($now - 86400));
  $row = $db->prepare('SELECT window_start, count FROM rate WHERE key = ?'); $row->execute([$key]); $r = $row->fetch();
  if (!$r || $r['window_start'] + $windowSec < $now) { $db->prepare('INSERT OR REPLACE INTO rate (key, window_start, count) VALUES (?, ?, 1)')->execute([$key, $now]); return true; }
  if ((int)$r['count'] >= $limit) return false;
  $db->prepare('UPDATE rate SET count = count + 1 WHERE key = ?')->execute([$key]);
  return true;
}
function mh_rate_or_fail(string $key, int $limit, int $windowSec, string $msg = 'Too many attempts. Please wait a while and try again.'): void {
  if (!mh_rate($key, $limit, $windowSec)) mh_fail($msg, 429);
}

/** Normalizes an email and checks the domain rule. Returns [email|null, error|null]. */
function mh_email_check(string $email): array {
  $email = strtolower(trim($email));
  if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) return [null, 'Enter a valid email address.'];
  $domain = substr($email, strrpos($email, '@') + 1);
  $ok = in_array($email, array_map('strtolower', mh_config()['extra_allowed_emails'] ?? []), true);
  foreach (mh_config()['allowed_domains'] as $d) { $d = strtolower($d); if ($domain === $d || str_ends_with($domain, '.' . $d)) { $ok = true; break; } }
  if (!$ok) return [null, 'MatHub is for Montana State students: sign up with your @montana.edu address.'];
  return [$email, null];
}

function mh_user_by_email(string $email): ?array {
  $st = mh_db()->prepare('SELECT * FROM users WHERE email = ?'); $st->execute([$email]); $u = $st->fetch(); return $u ?: null;
}
function mh_is_admin(?array $u): bool { return $u ? in_array(strtolower($u['email']), array_map('strtolower', mh_config()['admins'] ?? []), true) : false; }
function mh_is_mod(?array $u): bool { return $u ? (mh_is_admin($u) || in_array(strtolower($u['email']), array_map('strtolower', mh_config()['moderators'] ?? []), true)) : false; }
function mh_user_public(array $u): array {
  $unread = 0; try { $st = mh_db()->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0'); $st->execute([$u['id']]); $unread = (int)$st->fetchColumn(); } catch (Throwable $e) {}
  return ['id' => (int)$u['id'], 'email' => $u['email'], 'name' => $u['name'], 'verified' => (bool)$u['verified'], 'created' => (int)$u['created'], 'mod' => mh_is_mod($u), 'admin' => mh_is_admin($u), 'terms' => (int)($u['terms_accepted'] ?? 0) > 0, 'notify_email' => (int)($u['notify_email'] ?? 1) === 1, 'unread' => $unread,
    'show_on_leaderboard' => (int)($u['show_on_leaderboard'] ?? 1) === 1, 'digest_email' => (int)($u['digest_email'] ?? 1) === 1, 'role' => mh_role($u['email'])];
}
/** Display name: the chosen name, else the part of the email before the @. */
function mh_display_name(array $row, string $prefix = ''): string {
  $name = trim((string)($row[$prefix . 'name'] ?? '')); if ($name !== '') return mb_substr($name, 0, 40);
  $email = (string)($row[$prefix . 'email'] ?? ''); return $email !== '' ? substr($email, 0, strrpos($email, '@') ?: null) : 'student';
}
/** Staff role for an email: from the roles table (admin panel) or the config 'staff' map. Returns 'Instructor', 'TA', or ''. */
function mh_role(string $email): string {
  static $cache = [];
  $email = strtolower($email); if (isset($cache[$email])) return $cache[$email];
  $cfg = mh_config(); $r = '';
  foreach ($cfg['staff'] ?? [] as $e => $role) if (strtolower((string)$e) === $email) $r = (string)$role;
  if ($r === '') { try { $st = mh_db()->prepare('SELECT role FROM roles WHERE email = ?'); $st->execute([$email]); $v = $st->fetchColumn(); if ($v) $r = (string)$v; } catch (Throwable $e) {} }
  return $cache[$email] = $r;
}

/* ---------- one-time codes ---------- */
function mh_code_hash(string $email, string $kind, string $code): string { return hash_hmac('sha256', "$email|$kind|$code", mh_secret()); }
function mh_code_issue(string $email, string $kind): string {
  $db = mh_db(); $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  $ttl = (int)(mh_config()['code_ttl_minutes'] ?? 15) * 60;
  $db->prepare('DELETE FROM codes WHERE email = ? AND kind = ?')->execute([$email, $kind]);
  $db->prepare('INSERT INTO codes (email, kind, code_hash, expires, created) VALUES (?, ?, ?, ?, ?)')->execute([$email, $kind, mh_code_hash($email, $kind, $code), time() + $ttl, time()]);
  return $code;
}
/** Returns null on success, or an error message. */
function mh_code_consume(string $email, string $kind, string $code): ?string {
  $db = mh_db(); $code = preg_replace('/\D/', '', $code);
  if (strlen($code) !== 6) return 'Enter the 6-digit code from the email.';
  $st = $db->prepare('SELECT * FROM codes WHERE email = ? AND kind = ? ORDER BY id DESC LIMIT 1'); $st->execute([$email, $kind]); $row = $st->fetch();
  if (!$row) return 'No code is pending for that address. Request a new one.';
  if ((int)$row['expires'] < time()) { $db->prepare('DELETE FROM codes WHERE id = ?')->execute([$row['id']]); return 'That code has expired. Request a new one.'; }
  if ((int)$row['attempts'] >= 6) { $db->prepare('DELETE FROM codes WHERE id = ?')->execute([$row['id']]); return 'Too many wrong tries. Request a new code.'; }
  if (!hash_equals($row['code_hash'], mh_code_hash($email, $kind, $code))) { $db->prepare('UPDATE codes SET attempts = attempts + 1 WHERE id = ?')->execute([$row['id']]); return 'That code is not right. Check the email and try again.'; }
  $db->prepare('DELETE FROM codes WHERE id = ?')->execute([$row['id']]);
  return null;
}

/* ---------- login tokens (cookie) ---------- */
const MH_COOKIE = 'mathub_session';
function mh_https(): bool { return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') || (($_SERVER['SERVER_PORT'] ?? '') == 443); }
function mh_token_issue(int $userId): void {
  $db = mh_db(); $tok = bin2hex(random_bytes(32)); $days = (int)(mh_config()['session_days'] ?? 180); $exp = time() + $days * 86400;
  $db->prepare('INSERT INTO tokens (hash, user_id, expires, created, ua) VALUES (?, ?, ?, ?, ?)')->execute([hash('sha256', $tok), $userId, $exp, time(), substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)]);
  if (random_int(1, 20) === 1) $db->exec('DELETE FROM tokens WHERE expires < ' . time());
  setcookie(MH_COOKIE, $tok, ['expires' => $exp, 'path' => '/', 'secure' => mh_https(), 'httponly' => true, 'samesite' => 'Lax']);
  $_COOKIE[MH_COOKIE] = $tok;
}
function mh_token_clear(): void {
  $tok = $_COOKIE[MH_COOKIE] ?? '';
  if ($tok !== '') mh_db()->prepare('DELETE FROM tokens WHERE hash = ?')->execute([hash('sha256', $tok)]);
  setcookie(MH_COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => mh_https(), 'httponly' => true, 'samesite' => 'Lax']);
  unset($_COOKIE[MH_COOKIE]);
}
function mh_current_user(): ?array {
  static $u = false; if ($u !== false) return $u;
  $tok = $_COOKIE[MH_COOKIE] ?? ''; if (!preg_match('/^[0-9a-f]{64}$/', $tok)) return $u = null;
  $st = mh_db()->prepare('SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ? AND t.expires > ?'); $st->execute([hash('sha256', $tok), time()]);
  $row = $st->fetch(); return $u = ($row && (int)$row['verified'] === 1 ? $row : null);
}
function mh_require_user(): array { $u = mh_current_user(); if (!$u) mh_fail('Please log in.', 401, ['auth' => false]); return $u; }

/* ---------- request guards ---------- */
function mh_guard_mutation(): void {
  if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'MatHub') mh_fail('Bad request.', 400);
  $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
  if ($site !== '' && !in_array($site, ['same-origin', 'same-site', 'none'], true)) mh_fail('Cross-site request blocked.', 403);
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin !== '' && $origin !== 'null') { $oh = strtolower((string)parse_url($origin, PHP_URL_HOST)); $host = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]); if ($oh !== $host) mh_fail('Cross-site request blocked.', 403); }
}
function mh_method(string ...$allowed): void {
  if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', $allowed, true)) mh_fail('Method not allowed.', 405);
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') mh_guard_mutation();
}

/* ---------- emails ---------- */
function mh_send_code(string $email, string $kind, string $code): void {
  require_once __DIR__ . '/mailer.php';
  $cfg = mh_config(); $site = $cfg['site_name'] ?? 'MatHub'; $ttl = (int)($cfg['code_ttl_minutes'] ?? 15);
  $what = $kind === 'reset' ? 'password reset' : 'sign-up';
  $subject = "$site $what code: $code";
  $text = "Your $site $what code is $code\n\nIt expires in $ttl minutes. If you did not request this, you can ignore this email.\n\n— $site";
  $html = "<div style=\"font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#131C2E\">"
        . "<p style=\"font-size:15px;margin:0 0 12px\">Your <b>$site</b> $what code is</p>"
        . "<p style=\"font-size:34px;letter-spacing:8px;font-weight:700;margin:0 0 16px;font-family:Consolas,Menlo,monospace\">$code</p>"
        . "<p style=\"font-size:14px;color:#64718A;margin:0\">It expires in $ttl minutes. If you did not request this, you can ignore this email.</p></div>";
  $r = mh_send_mail($cfg, $email, $subject, $text, $html);
  if (!$r['ok']) mh_fail('The code could not be emailed right now. ' . ($r['error'] ?? ''), 502);
}
