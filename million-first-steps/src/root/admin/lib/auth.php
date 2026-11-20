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

/** Session settings: own folder, cookie limited to the admin folder, HttpOnly, SameSite=Strict, Secure on HTTPS. */
function mfs_session_config(): void
{
  static $done = false;
  if ($done) return;
  $done = true;
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
}

/**
 * Opens the signed-in person's session. Only people who are signed in have a session (a file in the data
 * folder): for everyone else the form token, the messages and the language travel in small signed cookies,
 * so visits that aren't signed in leave nothing behind on the server.
 */
function mfs_session_start(): void
{
  if (session_status() === PHP_SESSION_ACTIVE) return;
  $sid = $_COOKIE[MFS_SESSION_NAME] ?? '';
  if (!is_string($sid) || $sid === '') return;
  if (!preg_match('/^[A-Za-z0-9,-]{22,256}$/', $sid)) {
    mfs_clear_session_cookie();
    return;
  }
  mfs_session_config();
  session_start();
  // An unknown or expired session id (PHP gave it a fresh, empty one): keep nothing.
  if (empty($_SESSION['uid'])) mfs_end_session();
}

/** Removes the session cookie from the browser. */
function mfs_clear_session_cookie(): void
{
  if (!isset($_COOKIE[MFS_SESSION_NAME])) return;
  mfs_set_cookie(MFS_SESSION_NAME, '', time() - 86400);
}

/** Ends the session completely: its file goes, and the cookie with it. */
function mfs_end_session(): void
{
  if (session_status() === PHP_SESSION_ACTIVE) {
    $_SESSION = [];
    @session_destroy();
  }
  mfs_clear_session_cookie();
  $GLOBALS['mfs_user'] = null;
}

// ── Small cookies for people who aren't signed in ──────────────────────────────
// mfs_pre (form token), mfs_flash (messages for the next page), mfs_lang (interface language) and mfs_dev
// (this device has signed in before). All are limited to the admin folder; the signed ones carry an HMAC with a
// random secret kept in the database (setting cookie_secret), so they can't be made up.

/** The random secret for signed cookies (created on first use, never shown, left out of backups). */
function mfs_cookie_secret(): string
{
  static $secret = null;
  if ($secret !== null) return $secret;
  $v = mfs_setting_fresh('cookie_secret');
  if (!is_string($v) || strlen($v) < 32) {
    db_exec('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['cookie_secret', json_encode(bin2hex(random_bytes(32))), now_utc()]);
    $v = mfs_setting_fresh('cookie_secret');
  }
  return $secret = (string) $v;
}

/** HMAC of $data for one purpose (a cookie name, 'csrf' …). */
function mfs_sign(string $purpose, string $data): string
{
  return hash_hmac('sha256', $purpose . '|' . $data, mfs_cookie_secret());
}

/** Sets (or, with an expiry in the past, removes) a cookie for the admin folder; $_COOKIE follows along. */
function mfs_set_cookie(string $name, string $value, int $expires = 0): void
{
  if ($expires > 0 && $expires < time()) unset($_COOKIE[$name]);
  else $_COOKIE[$name] = $value;
  if (headers_sent()) return;
  setcookie($name, $value, [
    'expires' => $expires,
    'path' => mfs_admin_url_path(),
    'domain' => '',
    'secure' => mfs_is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
  ]);
}

/** Stores a JSON value in a signed cookie. */
function mfs_signed_cookie_set(string $name, $value, int $expires = 0): void
{
  $d = rtrim(strtr(base64_encode((string) json_encode($value, JSON_UNESCAPED_UNICODE)), '+/', '-_'), '=');
  mfs_set_cookie($name, $d . '.' . mfs_sign($name, $d), $expires);
}

/** The JSON value of a signed cookie, or null when it is missing or has been tampered with. */
function mfs_signed_cookie_get(string $name)
{
  $v = $_COOKIE[$name] ?? '';
  if (!is_string($v) || $v === '' || strlen($v) > 3800 || !preg_match('/^([A-Za-z0-9_-]+)\.([0-9a-f]{64})$/', $v, $m)) return null;
  if (!hash_equals(mfs_sign($name, $m[1]), $m[2])) return null;
  $raw = base64_decode(strtr($m[1], '-_', '+/'), true);
  return $raw === false ? null : json_decode($raw, true);
}

/** Remembers the interface language on this device (for the sign-in pages), and uses it for this request. */
function mfs_remember_lang($lang): void
{
  $lang = (string) $lang;
  if (!isset(UI_LANGS[$lang])) return;
  $GLOBALS['mfs_lang_pick'] = $lang;
  if (($_COOKIE['mfs_lang'] ?? '') !== $lang) mfs_set_cookie('mfs_lang', $lang, time() + 365 * 86400);
}

/** The ids of the accounts that have signed in on this device (signed cookie mfs_dev). */
function mfs_known_device_ids(): array
{
  $d = mfs_signed_cookie_get('mfs_dev');
  if (!is_array($d)) return [];
  return array_values(array_filter(array_map('intval', $d), function ($id) { return $id > 0; }));
}

/** Marks this device as one that $userId signs in on: a stranger's failed attempts then can't lock it out. */
function mfs_remember_device(int $userId): void
{
  $ids = array_values(array_unique(array_merge([$userId], mfs_known_device_ids())));
  mfs_signed_cookie_set('mfs_dev', array_slice($ids, 0, 4), time() + 400 * 86400);
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

/**
 * A fingerprint kept in the session: the password hash plus the account's session generation. Changing the
 * password, or switching access off (which raises the generation), signs out every session for good.
 */
function mfs_session_fingerprint(array $user): string
{
  $gen = (int) ($user['session_gen'] ?? 0);
  return hash('sha256', 'mfs-session|' . (string) ($user['password_hash'] ?? '') . ($gen > 0 ? '|' . $gen : ''));
}

/** A fingerprint of a password hash alone (sessions of accounts whose access was never switched off). */
function mfs_pw_fingerprint(string $hash): string
{
  return mfs_session_fingerprint(['password_hash' => $hash]);
}

/** Signs a person out of every device for good (e.g. when their access is switched off). */
function mfs_end_all_sessions(int $userId): void
{
  db_exec('UPDATE users SET session_gen = session_gen + 1 WHERE id = ?', [$userId]);
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
  $u = db_row('SELECT * FROM users WHERE id = ?', [(int) $_SESSION['uid']]);
  if (!$u || (int) $u['active'] !== 1 || !hash_equals((string) ($_SESSION['pwh'] ?? ''), mfs_session_fingerprint($u))) {
    // Switched off, removed, or the password was changed elsewhere: say so calmly on the sign-in page.
    mfs_forget_session();
    flash('info', t('You have been signed out. If you can’t sign in, please ask the owners.'));
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
  mfs_set_cookie(session_name(), session_id(), $remember ? time() + MFS_IDLE_LONG : 0);
}

/** Signs a user in: new session (id), fresh CSRF token, password fingerprint, last login time. */
function mfs_login_user(array $user, bool $remember): void
{
  $lang = (string) ($user['lang'] ?? 'en');
  if (session_status() !== PHP_SESSION_ACTIVE) {
    mfs_session_config();
    unset($_COOKIE[MFS_SESSION_NAME]);
    session_start();
  }
  session_regenerate_id(true);
  $_SESSION = [
    'uid' => (int) $user['id'],
    'pwh' => mfs_session_fingerprint($user),
    'remember' => $remember ? 1 : 0,
    'seen' => time(),
    'since' => time(),
    'lang' => $lang,
    'csrf' => bin2hex(random_bytes(32)),
  ];
  mfs_set_session_cookie($remember);
  mfs_remember_lang($lang);
  mfs_remember_device((int) $user['id']);
  mfs_remember_site_url();
  db_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [now_utc(), (int) $user['id']]);
  unset($GLOBALS['mfs_user']);
  current_user();
}

/** Ends the signed-in session. Waiting messages and the language carry over to the sign-in page. */
function mfs_forget_session(): void
{
  $lang = mfs_lang();
  $flash = session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['flash']) && is_array($_SESSION['flash']) ? $_SESSION['flash'] : [];
  mfs_end_session();
  mfs_remember_lang($lang);
  foreach ($flash as $f) if (is_array($f) && isset($f[0], $f[1])) flash((string) $f[0], (string) $f[1]);
}

/** After the user changed their own password: keep this session signed in with the new fingerprint. */
function mfs_refresh_session_password(string $newHash): void
{
  $u = current_user();
  $_SESSION['pwh'] = mfs_session_fingerprint(['password_hash' => $newHash, 'session_gen' => $u['session_gen'] ?? 0]);
  session_regenerate_id(true);
  if (!empty($_SESSION['remember'])) mfs_set_session_cookie(true);
  unset($GLOBALS['mfs_user']);
}

// ── CSRF ────────────────────────────────────────────────────────────────────

function csrf_token(): string
{
  if (session_status() === PHP_SESSION_ACTIVE) {
    if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
  }
  return mfs_pre_token(true);
}

/** The form token for someone who isn't signed in: an HMAC of a random cookie (mfs_pre) — no session needed. */
function mfs_pre_token(bool $create): string
{
  $pre = $_COOKIE['mfs_pre'] ?? '';
  if (!is_string($pre) || !preg_match('/^[0-9a-f]{32}$/', $pre)) {
    if (!$create) return '';
    $pre = bin2hex(random_bytes(16));
    mfs_set_cookie('mfs_pre', $pre, 0);
  }
  return mfs_sign('csrf', $pre);
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
  $ok = false;
  if ($sent !== '') {
    $session = session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['csrf']) && is_string($_SESSION['csrf']) ? $_SESSION['csrf'] : '';
    $pre = mfs_pre_token(false);
    $ok = ($session !== '' && hash_equals($session, $sent)) || ($pre !== '' && hash_equals($pre, $sent));
  }
  if (!is_post() || !$ok || !mfs_same_origin()) {
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

/** True when this IP (hash) has had too many failed attempts in the last 15 minutes since its last success. */
function mfs_ip_throttled(): bool
{
  $since = time() - MFS_THROTTLE_WINDOW;
  $ip = mfs_ip_hash();
  $n = (int) db_value('SELECT COUNT(*) FROM login_attempts WHERE ip_hash = ? AND ok = 0 AND at > ?
    AND id > COALESCE((SELECT MAX(id) FROM login_attempts WHERE ip_hash = ? AND ok = 1), 0)', [$ip, $since, $ip]);
  return $n >= MFS_THROTTLE_MAX;
}

/**
 * Failed attempts within the window since the last successful one: by IP hash, and by email ($emailMax from
 * anywhere). A device the account has signed in on before isn't held back by the per-email count, so a stranger
 * who knows the address can't keep its owner out.
 */
function mfs_login_throttled(string $email, int $emailMax = MFS_THROTTLE_MAX): bool
{
  if (mfs_ip_throttled()) return true;
  $since = time() - MFS_THROTTLE_WINDOW;
  $email = strtolower(trim($email));
  if ($email === '') return false;
  $m = (int) db_value('SELECT COUNT(*) FROM login_attempts WHERE email = ? AND ok = 0 AND at > ?
    AND id > COALESCE((SELECT MAX(id) FROM login_attempts WHERE email = ? AND ok = 1), 0)', [$email, $since, $email]);
  if ($m < $emailMax) return false;
  $known = mfs_known_device_ids();
  if ($known) {
    $uid = (int) db_value('SELECT id FROM users WHERE email = ?', [$email]);
    if ($uid > 0 && in_array($uid, $known, true)) return false;
  }
  return true;
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
    // Same work as for a real account, so the time taken doesn't tell which addresses have one.
    password_verify($password, mfs_dummy_hash());
    return null;
  }
  if (!password_verify($password, (string) $u['password_hash']) || (int) $u['active'] !== 1) return null;
  if (password_needs_rehash((string) $u['password_hash'], PASSWORD_DEFAULT)) {
    $u['password_hash'] = mfs_hash_password($password);
    db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [$u['password_hash'], (int) $u['id']]);
  }
  return $u;
}

/** A password hash made with PHP's current defaults (cost included), checked for unknown addresses. */
function mfs_dummy_hash(): string
{
  $h = mfs_setting_fresh('dummy_hash');
  if (!is_string($h) || $h === '' || password_needs_rehash($h, PASSWORD_DEFAULT)) {
    $h = password_hash(bin2hex(random_bytes(12)), PASSWORD_DEFAULT);
    db_exec('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['dummy_hash', json_encode($h), now_utc()]);
  }
  return $h;
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

/** Creates a single-use reset token (valid 1 hour) and returns the link to email (opening in $lang). */
function mfs_create_reset_link(int $userId, string $lang = ''): string
{
  $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
  db_exec('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [$userId, hash('sha256', $token), time() + 3600]);
  return mfs_admin_base_url() . 'index.php?p=reset&token=' . $token . (isset(UI_LANGS[$lang]) && $lang !== 'en' ? '&lang=' . $lang : '');
}

/** The waiting reset (joined with its user) for a token from a link, or null if unknown, used or expired. */
function mfs_find_reset(string $token): ?array
{
  if (!preg_match('/^[A-Za-z0-9_-]{40,64}$/', $token)) return null;
  return db_row('SELECT r.id AS reset_id, u.* FROM password_resets r JOIN users u ON u.id = r.user_id
    WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ? AND u.active = 1', [hash('sha256', $token), time()]);
}
