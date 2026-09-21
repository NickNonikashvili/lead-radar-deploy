<?php
/* ============================================================
   MatHub account server — endpoints
   Called as api/index.php?r=<route>. Responses are JSON.
   Routes: health, me, signup, verify, resend, login, logout, forgot,
           reset, profile, data, data_all, account_delete, stats
   ============================================================ */
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
error_reporting(E_ALL); ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e) { mh_fail('Server error: ' . $e->getMessage(), 500); });

$route = preg_replace('/[^a-z_]/', '', (string)($_GET['r'] ?? ''));
$ip = mh_client_ip(); $in = mh_input(); $cfg = mh_config();

switch ($route) {

  case 'health':
    mh_method('GET');
    require_once __DIR__ . '/mailer.php';
    $db = mh_db(); mh_secret();
    try { require_once __DIR__ . '/social.php'; mh_housekeeping(); } catch (Throwable $e) { /* never block the site */ }
    mh_json(['ok' => true, 'site' => $cfg['site_name'] ?? 'MatHub', 'domains' => $cfg['allowed_domains'], 'mail' => mh_mail_mode($cfg), 'user' => ($u = mh_current_user()) ? mh_user_public($u) : null]);

  case 'me':
    mh_method('GET');
    $u = mh_current_user();
    mh_json(['ok' => true, 'user' => $u ? mh_user_public($u) : null]);

  case 'signup':
    mh_method('POST');
    mh_rate_or_fail("signup:ip:$ip", 30, 3600);
    [$email, $err] = mh_email_check(mh_str($in, 'email')); if ($err) mh_fail($err);
    $pass = (string)($in['password'] ?? ''); $name = mh_str($in, 'name', 60);
    if (strlen($pass) < 8) mh_fail('Use a password of at least 8 characters.');
    if (strlen($pass) > 200) mh_fail('That password is too long.');
    mh_rate_or_fail("signup:email:$email", 6, 3600, 'Too many sign-up emails for that address. Try again in an hour.');
    $db = mh_db(); $u = mh_user_by_email($email);
    if ($u && (int)$u['verified'] === 1) mh_fail('That address already has an account. Log in instead.', 409, ['exists' => true]);
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    if ($u) $db->prepare('UPDATE users SET pass_hash = ?, name = ?, created = ? WHERE id = ?')->execute([$hash, $name, time(), $u['id']]);
    else $db->prepare('INSERT INTO users (email, name, pass_hash, verified, created) VALUES (?, ?, ?, 0, ?)')->execute([$email, $name, $hash, time()]);
    $code = mh_code_issue($email, 'verify'); mh_send_code($email, 'verify', $code);
    mh_json(['ok' => true, 'pending' => true, 'email' => $email]);

  case 'resend':
    mh_method('POST');
    mh_rate_or_fail("resend:ip:$ip", 30, 3600);
    [$email, $err] = mh_email_check(mh_str($in, 'email')); if ($err) mh_fail($err);
    mh_rate_or_fail("signup:email:$email", 6, 3600, 'Too many emails for that address. Try again in an hour.');
    $u = mh_user_by_email($email);
    if (!$u) mh_fail('No sign-up is pending for that address. Sign up first.', 404);
    if ((int)$u['verified'] === 1) mh_fail('That address is already verified. Log in instead.', 409, ['exists' => true]);
    $code = mh_code_issue($email, 'verify'); mh_send_code($email, 'verify', $code);
    mh_json(['ok' => true, 'pending' => true]);

  case 'verify':
    mh_method('POST');
    mh_rate_or_fail("verify:ip:$ip", 60, 900);
    [$email, $err] = mh_email_check(mh_str($in, 'email')); if ($err) mh_fail($err);
    $u = mh_user_by_email($email); if (!$u) mh_fail('No sign-up is pending for that address.', 404);
    if ((int)$u['verified'] === 1) mh_fail('That address is already verified. Log in instead.', 409, ['exists' => true]);
    $e = mh_code_consume($email, 'verify', mh_str($in, 'code', 12)); if ($e) mh_fail($e);
    $db = mh_db(); $db->prepare('UPDATE users SET verified = 1, last_login = ? WHERE id = ?')->execute([time(), $u['id']]);
    $u['verified'] = 1; mh_token_issue((int)$u['id']);
    mh_json(['ok' => true, 'user' => mh_user_public($u)]);

  case 'login':
    mh_method('POST');
    [$email, $err] = mh_email_check(mh_str($in, 'email')); if ($err) mh_fail($err);
    $pass = (string)($in['password'] ?? '');
    mh_rate_or_fail("login:ip:$ip", 80, 3600); mh_rate_or_fail("login:email:$email", 12, 900, 'Too many login attempts. Wait 15 minutes or reset your password.');
    $u = mh_user_by_email($email);
    if (!$u || !password_verify($pass, $u['pass_hash'])) mh_fail('Wrong email or password.', 401);
    if ((int)$u['verified'] !== 1) {
      if (mh_rate("signup:email:$email", 6, 3600)) { $code = mh_code_issue($email, 'verify'); mh_send_code($email, 'verify', $code); }
      mh_json(['ok' => true, 'pending' => true, 'email' => $email, 'message' => 'That address has not been verified yet. We sent a new code.']);
    }
    mh_db()->prepare('UPDATE users SET last_login = ? WHERE id = ?')->execute([time(), $u['id']]);
    mh_token_issue((int)$u['id']);
    mh_json(['ok' => true, 'user' => mh_user_public($u)]);

  case 'logout':
    mh_method('POST');
    mh_token_clear();
    mh_json(['ok' => true]);

  case 'forgot':
    mh_method('POST');
    mh_rate_or_fail("forgot:ip:$ip", 30, 3600);
    [$email, $err] = mh_email_check(mh_str($in, 'email')); if ($err) mh_fail($err);
    mh_rate_or_fail("forgot:email:$email", 5, 3600, 'Too many reset emails for that address. Try again in an hour.');
    $u = mh_user_by_email($email);
    if ($u && (int)$u['verified'] === 1) { $code = mh_code_issue($email, 'reset'); mh_send_code($email, 'reset', $code); }
    // Same answer whether or not the account exists.
    mh_json(['ok' => true, 'message' => 'If that address has an account, a reset code is on its way.']);

  case 'reset':
    mh_method('POST');
    mh_rate_or_fail("reset:ip:$ip", 60, 900);
    [$email, $err] = mh_email_check(mh_str($in, 'email')); if ($err) mh_fail($err);
    $pass = (string)($in['password'] ?? ''); if (strlen($pass) < 8) mh_fail('Use a password of at least 8 characters.');
    $u = mh_user_by_email($email); if (!$u || (int)$u['verified'] !== 1) mh_fail('That code is not right.', 400);
    $e = mh_code_consume($email, 'reset', mh_str($in, 'code', 12)); if ($e) mh_fail($e);
    $db = mh_db(); $db->prepare('UPDATE users SET pass_hash = ?, last_login = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), time(), $u['id']]);
    $db->prepare('DELETE FROM tokens WHERE user_id = ?')->execute([$u['id']]);   // log out every other device
    mh_token_issue((int)$u['id']);
    mh_json(['ok' => true, 'user' => mh_user_public($u)]);

  case 'profile':
    mh_method('POST');
    $u = mh_require_user(); $name = array_key_exists('name', $in) ? mh_str($in, 'name', 60) : $u['name'];
    $notify = array_key_exists('notify_email', $in) ? (!empty($in['notify_email']) ? 1 : 0) : (int)($u['notify_email'] ?? 1);
    $lb = array_key_exists('show_on_leaderboard', $in) ? (!empty($in['show_on_leaderboard']) ? 1 : 0) : (int)($u['show_on_leaderboard'] ?? 1);
    $dg = array_key_exists('digest_email', $in) ? (!empty($in['digest_email']) ? 1 : 0) : (int)($u['digest_email'] ?? 1);
    $rm = array_key_exists('reminder_email', $in) ? (!empty($in['reminder_email']) ? 1 : 0) : (int)($u['reminder_email'] ?? 0);
    $courses = $u['courses'] ?? null; if (array_key_exists('courses', $in)) { $c = is_array($in['courses']) ? array_values(array_unique(array_filter($in['courses'], fn($x) => in_array($x, ['calc', 'physics', 'precalc'], true)))) : []; $courses = json_encode($c); }
    $sections = $u['sections'] ?? null; if (array_key_exists('sections', $in) && is_array($in['sections'])) { $sec = []; foreach ($in['sections'] as $cid => $v) { if (!in_array($cid, ['calc', 'physics', 'precalc'], true) || !is_array($v)) continue; $sec[$cid] = ['section' => mb_substr(trim((string)($v['section'] ?? '')), 0, 20), 'examTime' => mb_substr(trim((string)($v['examTime'] ?? '')), 0, 60), 'labDay' => in_array($v['labDay'] ?? '', ['tue', 'thu'], true) ? $v['labDay'] : '']; } $sections = json_encode($sec); }
    mh_db()->prepare('UPDATE users SET name = ?, notify_email = ?, show_on_leaderboard = ?, digest_email = ?, reminder_email = ?, courses = ?, sections = ? WHERE id = ?')->execute([$name, $notify, $lb, $dg, $rm, $courses, $sections, $u['id']]);
    $u['name'] = $name; $u['notify_email'] = $notify; $u['show_on_leaderboard'] = $lb; $u['digest_email'] = $dg; $u['reminder_email'] = $rm; $u['courses'] = $courses; $u['sections'] = $sections;
    mh_json(['ok' => true, 'user' => mh_user_public($u)]);

  case 'canvas':
    mh_method('GET');
    require_once __DIR__ . '/canvas.php';
    $r = mh_canvas_events(!empty($_GET['refresh']) && mh_is_admin(mh_current_user()));
    header('Cache-Control: private, max-age=300');
    mh_json(['ok' => true, 'configured' => $r['configured'], 'fetched' => $r['fetched'], 'error' => $r['error'], 'events' => $r['events'], 'announcement' => (string)mh_setting('announcement', '')]);

  case 'data':
    mh_method('GET', 'POST', 'PUT');
    $u = mh_require_user(); $db = mh_db();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
      $course = preg_replace('/[^a-z0-9_-]/', '', (string)($_GET['course'] ?? ''));
      $st = $db->prepare('SELECT json, updated FROM progress WHERE user_id = ? AND course = ?'); $st->execute([$u['id'], $course]); $row = $st->fetch();
      mh_json(['ok' => true, 'course' => $course, 'data' => $row ? json_decode($row['json'], true) : null, 'updated' => $row ? (int)$row['updated'] : 0]);
    }
    mh_rate_or_fail("data:user:{$u['id']}", 1200, 3600);
    $course = preg_replace('/[^a-z0-9_-]/', '', (string)($in['course'] ?? '')); if ($course === '') mh_fail('Missing course.');
    $data = $in['data'] ?? null; if (!is_array($data)) mh_fail('Missing data.');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (strlen($json) > (int)($cfg['max_data_bytes'] ?? 600000)) mh_fail('Progress data is too large to save.', 413);
    $updated = isset($in['updated']) && is_numeric($in['updated']) ? (int)$in['updated'] : (int)round(microtime(true) * 1000);
    $st = $db->prepare('SELECT updated FROM progress WHERE user_id = ? AND course = ?'); $st->execute([$u['id'], $course]); $cur = $st->fetchColumn();
    if ($cur !== false && (int)$cur > $updated && empty($in['force'])) mh_json(['ok' => true, 'stale' => true, 'updated' => (int)$cur]);
    $db->prepare('INSERT INTO progress (user_id, course, json, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, course) DO UPDATE SET json = excluded.json, updated = excluded.updated')->execute([$u['id'], $course, $json, $updated]);
    mh_json(['ok' => true, 'updated' => $updated]);

  case 'data_all':
    mh_method('GET');
    $u = mh_require_user();
    $st = mh_db()->prepare('SELECT course, json, updated FROM progress WHERE user_id = ?'); $st->execute([$u['id']]);
    $out = []; foreach ($st->fetchAll() as $r) $out[$r['course']] = ['data' => json_decode($r['json'], true), 'updated' => (int)$r['updated']];
    mh_json(['ok' => true, 'courses' => $out]);

  case 'account_delete':
    mh_method('POST');
    $u = mh_require_user();
    if (!password_verify((string)($in['password'] ?? ''), $u['pass_hash'])) mh_fail('Wrong password.', 401);
    mh_db()->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]);
    mh_token_clear();
    mh_json(['ok' => true]);

  case 'stats':
    mh_method('GET');
    $key = (string)($cfg['admin_key'] ?? '');
    if ($key === '' || !hash_equals($key, (string)($_SERVER['HTTP_X_ADMIN_KEY'] ?? ''))) mh_fail('Not found.', 404);
    $db = mh_db();
    mh_json(['ok' => true, 'users' => (int)$db->query('SELECT COUNT(*) FROM users WHERE verified = 1')->fetchColumn(), 'pending' => (int)$db->query('SELECT COUNT(*) FROM users WHERE verified = 0')->fetchColumn(),
      'active_7d' => (int)$db->query('SELECT COUNT(*) FROM users WHERE last_login > ' . (time() - 7 * 86400))->fetchColumn(), 'progress_rows' => (int)$db->query('SELECT COUNT(*) FROM progress')->fetchColumn()]);

  default:
    if (str_starts_with($route, 'forum_') || str_starts_with($route, 'admin_') || str_starts_with($route, 'notif_') || $route === 'terms_accept') { require_once __DIR__ . '/forum.php'; mh_forum_route($route, $in, $cfg, $ip); }
    foreach (['challenge_', 'badges', 'presence', 'meet_', 'poll_', 'mock_', 'contrib_', 'activity', 'cron', 'helpers', 'people', 'league', 'stats_'] as $pre) if (str_starts_with($route, $pre)) { require_once __DIR__ . '/social.php'; mh_social_route($route, $in, $cfg, $ip); }
    mh_fail('Not found.', 404);
}
