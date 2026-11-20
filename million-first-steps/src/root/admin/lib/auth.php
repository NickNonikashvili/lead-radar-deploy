<?php
/*
 * Sessions, signing in and out, roles, CSRF protection, login throttling and password resets.
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

const MFS_SESSION_NAME = 'mfs_admin';
const MFS_IDLE_SHORT = 43200;      // 12 hours
const MFS_IDLE_LONG = 2592000;     // 30 days ("Keep me signed in")
const MFS_THROTTLE_MAX = 5;        // failed attempts …
const MFS_THROTTLE_WINDOW = 900;   // … within 15 minutes → wait 15 minutes
const MFS_PASSWORD_MIN = 10;
const MFS_PASSWORD_MAX = 200;

/** Starts the admin session: own folder, cookie limited to the admin folder, HttpOnly, SameSite=Strict, Secure on HTTPS. */
function mfs_session_start(): void
{
  if (session_status() === PHP_SESSION_ACTIVE) return;
  $dir = mfs_data_dir() . '/sessions';
  if (!@is_dir($dir)) @mkdir($dir, 0700, true);
  ini_set('session.save_handler', 'files');
  session_save_path($dir);
  ini_set('session.use_strict_mode', '1');
  ini_set('session.use_only_cookies', '1');
  ini_set('session.use_trans_sid', '0');
  ini_set('session.gc_maxlifetime', (string) MFS_IDLE_LONG);
  ini_set('session.gc_probability', '1');
  ini_set('session.gc_divisor', '200');
  session_name(MFS_SESSION_NAME);
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => mfs_admin_url_path(),
    'domain' => '',
    'secure' => mfs_is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
  ]);
  session_cache_limiter('');
  session_start();
}

/**
 * Links in emails (new request, password reset) open from another site, so the browser holds back our
 * SameSite=Strict cookie on that first request. Answer such a request with a tiny page that reloads the same
 * address from our own site — then the cookie comes along and the person stays signed in.
 */
function mfs_bounce_cross_site(): void
{
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || isset($_COOKIE[MFS_SESSION_NAME]) || isset($_GET['_b'])) return;
  if (strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')) !== 'cross-site') return;
  $q = $_GET;
  $q['_b'] = '1';
  $to = 'index.php?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
    . '<meta http-equiv="refresh" content="0;url=' . h($to) . '"><title>Million First Steps</title></head>'
    . '<body style="font-family:system-ui,sans-serif;background:#FBF6EE;color:#2B2320;padding:40px">'
    . '<p><a href="' . h($to) . '">' . h(t('Continue to the team area')) . '</a></p></body></html>';
  exit;
}

/** A fingerprint of the password hash, kept in the session: changing the password signs out every other session. */
function mfs_pw_fingerprint(string $hash): string
{
  return hash('sha256', 'mfs-session|' . $hash);
}

/** The signed-in user's row from `users`, or null. */
function current_user(): ?array
{
  if (array_key_exists('mfs_user', $GLOBALS)) return $GLOBALS['mfs_user'];
  $GLOBALS['mfs_user'] = null;
  if (session_status() !== PHP_SESSION_ACTIVE || empty($_SESSION['uid'])) return null;
  $idle = !empty($_SESSION['remember']) ? MFS_IDLE_LONG : MFS_IDLE_SHORT;
  if (time() - (int) ($_SESSION['seen'] ?? 0) > $idle) {
    mfs_forget_session();
    flash('info', t('You were signed out after a period of inactivity. Please sign in again.'));
    return null;
  }
  $u = db_row('SELECT * FROM users WHERE id = ? AND active = 1', [(int) $_SESSION['uid']]);
  if (!$u || !hash_equals((string) ($_SESSION['pwh'] ?? ''), mfs_pw_fingerprint((string) $u['password_hash']))) {
    mfs_forget_session();
    return null;
  }
  $_SESSION['seen'] = time();
  // "Keep me signed in": slide the cookie's expiry forward once a day.
  if (!empty($_SESSION['remember']) && time() - (int) ($_SESSION['cookie_at'] ?? 0) > 86400) mfs_set_session_cookie(true);
  $u['id'] = (int) $u['id'];
  $u['active'] = (int) $u['active'];
  $GLOBALS['mfs_user'] = $u;
  return $u;
}

/** The signed-in user's id, or null (safe to call anywhere, also outside the admin). */
function current_user_id(): ?int
{
  if (!array_key_exists('mfs_user', $GLOBALS) && session_status() !== PHP_SESSION_ACTIVE) return null;
  $u = current_user();
  return $u ? (int) $u['id'] : null;
}

function is_owner(): bool
{
  $u = current_user();
  return $u && $u['role'] === 'owner';
}

/** Makes sure someone is signed in (else: to the login page, coming back here afterwards). Returns the user. */
function require_login(): array
{
  $u = current_user();
  if ($u) return $u;
  $next = mfs_next_param();
  redirect(url('login', ['next' => $next !== 'p=dashboard' ? $next : null]));
}

/** Like require_login(), and shows a "for owners only" page (403) to team members. */
function require_owner(): array
{
  $u = require_login();
  if ($u['role'] !== 'owner') {
    render_error(403, t('For owners only'), t('This part of the team area is only open to the owners. If you need something here, please ask them.'));
  }
  return $u;
}

/** This page's address as a safe "come back here" value (only for GET requests). */
function mfs_next_param(): string
{
  if (is_post()) return '';
  $q = $_GET;
  unset($q['_b'], $q['next']);
  if (!isset($q['p'])) $q['p'] = 'dashboard';
  return http_build_query($q, '', '&', PHP_QUERY_RFC3986);
}

/** Validates a "next" value from the login form; returns an admin-relative URL. */
function mfs_safe_next($next): string
{
  $next = (string) $next;
  if ($next === '' || strlen($next) > 600 || !preg_match('/^p=[a-z_]+(&[A-Za-z0-9_\-.~%=&+]*)?$/', $next)) return url('dashboard');
  parse_str($next, $q);
  if (in_array($q['p'] ?? '', ['login', 'logout', 'setup', 'forgot', 'reset'], true)) return url('dashboard');
  return 'index.php?' . $next;
}

function mfs_set_session_cookie(bool $remember): void
{
  $_SESSION['cookie_at'] = time();
  setcookie(session_name(), session_id(), [
    'expires' => $remember ? time() + MFS_IDLE_LONG : 0,
    'path' => mfs_admin_url_path(),
    'domain' => '',
    'secure' => mfs_is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
  ]);
}

/** Signs a user in: new session id, fresh CSRF token, password fingerprint, last login time. */
function mfs_login_user(array $user, bool $remember): void
{
  $lang = (string) ($user['lang'] ?? 'en');
  session_regenerate_id(true);
  $_SESSION = [
    'uid' => (int) $user['id'],
    'pwh' => mfs_pw_fingerprint((string) $user['password_hash']),
    'remember' => $remember ? 1 : 0,
    'seen' => time(),
    'since' => time(),
    'lang' => $lang,
    'csrf' => bin2hex(random_bytes(32)),
  ];
  mfs_set_session_cookie($remember);
  db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [now_utc(), (int) $user['id']]);
  unset($GLOBALS['mfs_user']);
  current_user();
}

/** Ends the signed-in session (keeps an empty one so a flash message can still be shown). */
function mfs_forget_session(): void
{
  if (session_status() !== PHP_SESSION_ACTIVE) return;
  $lang = $_SESSION['lang'] ?? 'en';
  $flash = $_SESSION['flash'] ?? [];
  $_SESSION = [];
  session_regenerate_id(true);
  $_SESSION['lang'] = $lang;
  if ($flash) $_SESSION['flash'] = $flash;
  if (!empty($_COOKIE[session_name()])) mfs_set_session_cookie(false);
  $GLOBALS['mfs_user'] = null;
}

/** After the user changed their own password: keep this session signed in with the new fingerprint. */
function mfs_refresh_session_password(string $newHash): void
{
  $_SESSION['pwh'] = mfs_pw_fingerprint($newHash);
  session_regenerate_id(true);
  if (!empty($_SESSION['remember'])) mfs_set_session_cookie(true);
  unset($GLOBALS['mfs_user']);
}

// ── CSRF ────────────────────────────────────────────────────────────────────

function csrf_token(): string
{
  if (session_status() !== PHP_SESSION_ACTIVE) return '';
  if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
  return $_SESSION['csrf'];
}

/** The hidden token input. Put it in EVERY POST form. */
function csrf_field(): string
{
  return '<input type="hidden" name="_csrf" value="' . h(csrf_token()) . '">';
}

/** True when the Origin (or else Referer) header, if the browser sent one, names this same host. */
function mfs_same_origin(): bool
{
  $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
  $src = $origin !== '' ? $origin : (string) ($_SERVER['HTTP_REFERER'] ?? '');
  if ($src === '') return true;
  if ($src === 'null') return false;
  $p = parse_url($src);
  if (!is_array($p) || empty($p['host'])) return false;
  $host = strtolower($p['host']) . (isset($p['port']) ? ':' . $p['port'] : '');
  $own = mfs_host();
  $strip = function ($h) {
    return preg_replace('/:(80|443)$/', '', $h);
  };
  return $strip($host) === $strip($own);
}

/** Call first in every POST handler. Stops with a calm 400 page when the token is missing/wrong or the form came from another site. */
function csrf_check(): void
{
  $sent = isset($_POST['_csrf']) && is_string($_POST['_csrf']) ? $_POST['_csrf'] : '';
  $have = session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['csrf']) && is_string($_SESSION['csrf']) ? $_SESSION['csrf'] : '';
  if (!is_post() || $sent === '' || $have === '' || !hash_equals($have, $sent) || !mfs_same_origin()) {
    render_error(400, t('Please try that again'), t('For your safety this form could not be sent — it may have been open for too long. Go back, reload the page and try again.'));
  }
}

// ── Passwords and throttling ────────────────────────────────────────────────

/** '' if the password is acceptable, else the reason (translated). */
function password_problem(string $pw, ?string $confirm = null): string
{
  $len = function_exists('mb_strlen') ? mb_strlen($pw) : strlen($pw);
  if ($len < MFS_PASSWORD_MIN) return t('Use at least {n} characters.', ['n' => MFS_PASSWORD_MIN]);
  if ($len > MFS_PASSWORD_MAX) return t('That password is too long.');
  if ($confirm !== null && !hash_equals($pw, $confirm)) return t('The two passwords are not the same.');
  return '';
}

/** The raw password field (passwords are not trimmed or cleaned). */
function post_password($key): string
{
  $v = $_POST[$key] ?? '';
  return is_string($v) ? substr($v, 0, 1000) : '';
}

function mfs_hash_password(string $pw): string
{
  return password_hash($pw, PASSWORD_DEFAULT);
}

/** sha256 of the visitor's IP with the daily salt — IPs are never stored. */
function mfs_ip_hash(): string
{
  return hash('sha256', mfs_daily_salt() . '|' . mfs_client_ip());
}

/** Failed attempts within the window since the last successful one, by IP hash and by email. */
function mfs_login_throttled(string $email): bool
{
  $since = time() - MFS_THROTTLE_WINDOW;
  $ip = mfs_ip_hash();
  $n = (int) db_value('SELECT COUNT(*) FROM login_attempts WHERE ip_hash = ? AND ok = 0 AND at > ?
    AND id > COALESCE((SELECT MAX(id) FROM login_attempts WHERE ip_hash = ? AND ok = 1), 0)', [$ip, $since, $ip]);
  if ($n >= MFS_THROTTLE_MAX) return true;
  $email = strtolower(trim($email));
  if ($email === '') return false;
  $m = (int) db_value('SELECT COUNT(*) FROM login_attempts WHERE email = ? AND ok = 0 AND at > ?
    AND id > COALESCE((SELECT MAX(id) FROM login_attempts WHERE email = ? AND ok = 1), 0)', [$email, $since, $email]);
  return $m >= MFS_THROTTLE_MAX;
}

function mfs_record_attempt(string $email, bool $ok): void
{
  db_exec('INSERT INTO login_attempts (ip_hash, email, ok, at) VALUES (?, ?, ?, ?)', [mfs_ip_hash(), strtolower(trim($email)), $ok ? 1 : 0, time()]);
}

/**
 * Checks an email + password. Returns the user row, or null (same answer for unknown email,
 * wrong password or a switched-off account). Rehashes the password when PHP's default changes.
 */
function mfs_check_password(string $email, string $password): ?array
{
  $u = db_row('SELECT * FROM users WHERE email = ?', [trim($email)]);
  if (!$u) {
    password_verify($password, '$2y$10$rA2XQwJgvlfWLOiQPjwGculLHssJcQTReP7a59J178GFEzq.LpiYK');
    return null;
  }
  if (!password_verify($password, (string) $u['password_hash']) || (int) $u['active'] !== 1) return null;
  if (password_needs_rehash((string) $u['password_hash'], PASSWORD_DEFAULT)) {
    $u['password_hash'] = mfs_hash_password($password);
    db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [$u['password_hash'], (int) $u['id']]);
  }
  return $u;
}

function mfs_user_count(): int
{
  return (int) db_value('SELECT COUNT(*) FROM users');
}

// ── Setup key and password reset ────────────────────────────────────────────

/** The setup key from lib/setup-key.php (written by the build), or '' if missing. */
function mfs_setup_key(): string
{
  $f = MFS_LIB . '/setup-key.php';
  if (!is_file($f)) return '';
  $k = include $f;
  return is_string($k) ? strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $k)) : '';
}

/** Creates a single-use reset token (valid 1 hour) and returns the link to email. */
function mfs_create_reset_link(int $userId): string
{
  $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
  db_exec('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [$userId, hash('sha256', $token), time() + 3600]);
  return mfs_admin_base_url() . 'index.php?p=reset&token=' . $token;
}

/** The waiting reset (joined with its user) for a token from a link, or null if unknown, used or expired. */
function mfs_find_reset(string $token): ?array
{
  if (!preg_match('/^[A-Za-z0-9_-]{40,64}$/', $token)) return null;
  return db_row('SELECT r.id AS reset_id, u.* FROM password_resets r JOIN users u ON u.id = r.user_id
    WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ? AND u.active = 1', [hash('sha256', $token), time()]);
}
