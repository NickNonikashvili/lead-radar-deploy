<?php
/*
 * EvoSoft admin panel: signing in and out, sessions, and the optional authenticator-app code (TOTP, RFC 6238).
 * © 2026 EvoSoft Solutions. All rights reserved.
 *
 * - One owner, one password: admin_password_hash in the settings file (password_hash / password_verify).
 * - Optional second step: admin_totp_secret (base32), 6-digit codes, 30-second steps, one step either side allowed,
 *   and a code that was used once is refused after that.
 * - 5 sign-in attempts per IP address per 15 minutes, 30 for everyone together (evo_rate_ok, IPs are never stored).
 * - Sessions: cookie "evo_admin" on /admin/ only, HttpOnly, SameSite=Strict, Secure over https, files in
 *   evosoft-data/sessions (0700). A new id at sign-in; signed out after admin_session_minutes idle, and 12 hours
 *   after signing in whatever happens. Changing the password or the TOTP secret signs every session out.
 * - Visitors who aren't signed in get no session at all (no file on the server); the sign-in form is tied to their
 *   browser with a random cookie (evo_admin_pre) and an HMAC of it, instead.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

/** 'ok', 'missing' (not set yet: the setup page shows) or 'invalid' (set, but not a password hash). */
function admin_hash_state(array $cfg): string
{
    $hash = trim((string)($cfg['admin_password_hash'] ?? ''));
    if ($hash === '') {
        return 'missing';
    }
    return (password_get_info($hash)['algoName'] ?? 'unknown') !== 'unknown' ? 'ok' : 'invalid';
}

/** The TOTP key (raw bytes) when admin_totp_secret is set and valid, '' when it isn't set, null when it's broken. */
function admin_totp_key(array $cfg): ?string
{
    $secret = (string)($cfg['admin_totp_secret'] ?? '');
    if (trim($secret) === '') {
        return '';
    }
    $key = admin_base32_decode($secret);
    return $key !== null && strlen($key) >= 10 ? $key : null; // at least 80 bits
}

function admin_base32_encode(string $bin): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    foreach (str_split($bin) as $c) {
        $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 5) as $chunk) {
        $out .= $alphabet[bindec(str_pad($chunk, 5, '0'))];
    }
    return $out;
}

/** RFC 4648 base32 (spaces, dashes, '=' padding and lower case are fine); null when it isn't base32. */
function admin_base32_decode(string $s): ?string
{
    $s = strtoupper((string)preg_replace('/[\s\-=]+/', '', $s));
    if ($s === '' || !preg_match('/^[A-Z2-7]+$/', $s)) {
        return null;
    }
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    foreach (str_split($s) as $c) {
        $bits .= str_pad(decbin(strpos($alphabet, $c)), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 8) as $byte) {
        if (strlen($byte) === 8) {
            $out .= chr(bindec($byte));
        }
    }
    return $out;
}

/** HOTP (RFC 4226): the 6-digit code for one counter value. */
function admin_hotp(string $key, int $counter): string
{
    $hmac = hash_hmac('sha1', pack('J', $counter), $key, true);
    $offset = ord($hmac[19]) & 0x0F;
    $value = ((ord($hmac[$offset]) & 0x7F) << 24) | (ord($hmac[$offset + 1]) << 16) | (ord($hmac[$offset + 2]) << 8) | ord($hmac[$offset + 3]);
    return str_pad((string)($value % 1000000), 6, '0', STR_PAD_LEFT);
}

/** The 30-second step a code belongs to (now, or one step either side), or null when it matches none. */
function admin_totp_match(string $key, string $code, int $time): ?int
{
    $code = (string)preg_replace('/\s+/', '', $code);
    if (!preg_match('/^\d{6}$/', $code)) {
        return null;
    }
    $now = intdiv($time, 30);
    $hit = null;
    foreach ([$now - 1, $now, $now + 1] as $step) {
        if (hash_equals(admin_hotp($key, $step), $code) && $hit === null) { // check all three, so timing tells nothing
            $hit = $step;
        }
    }
    return $hit;
}

/** Marks a code's step as used; false when it (or a later one) was used before, so a code works once. */
function admin_totp_claim(int $step): bool
{
    $fh = @fopen(evo_data_dir() . '/admin-totp-step', 'c+');
    if ($fh === false) {
        return false;
    }
    $ok = false;
    if (flock($fh, LOCK_EX)) {
        $last = (int)trim((string)stream_get_contents($fh));
        if ($step > $last) {
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, (string)$step);
            fflush($fh);
            $ok = true;
        }
        flock($fh, LOCK_UN);
    }
    fclose($fh);
    return $ok;
}

/** A key only this server knows (from the settings), for the sign-in form's token and the session's mark. */
function admin_secret(array $cfg, string $purpose): string
{
    return hash_hmac('sha256', $purpose, 'evo-admin|' . (string)$cfg['admin_password_hash'] . '|' . (string)($cfg['admin_totp_secret'] ?? ''));
}

function admin_idle_seconds(array $cfg): int
{
    return 60 * max(5, min(720, (int)($cfg['admin_session_minutes'] ?? 30)));
}

function admin_cookie_options(int $expires = 0): array
{
    return ['expires' => $expires, 'path' => admin_base(), 'secure' => admin_is_https(), 'httponly' => true, 'samesite' => 'Strict'];
}

/** Opens the session, from the cookie (or a new one when $create). False when there is none or it can't be stored. */
function admin_session_open(bool $create): bool
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return true;
    }
    if (!$create && !isset($_COOKIE[ADMIN_COOKIE])) {
        return false;
    }
    $dir = evo_data_dir() . '/sessions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    @chmod($dir, 0700);
    if (!is_dir($dir) || !is_writable($dir)) {
        error_log("EvoSoft admin: can't write sessions to $dir");
        return false;
    }
    ini_set('session.save_handler', 'files');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_cookies', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.lazy_write', '1');
    ini_set('session.gc_maxlifetime', (string)(ADMIN_MAX_SECONDS + 3600));
    ini_set('session.gc_probability', '1');
    ini_set('session.gc_divisor', '50');
    session_save_path($dir);
    session_name(ADMIN_COOKIE);
    session_cache_limiter('');
    session_set_cookie_params(admin_cookie_options());
    if (!@session_start()) {
        return false;
    }
    return true;
}

function admin_session_end(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = [];
        @session_destroy();
    }
    if (isset($_COOKIE[ADMIN_COOKIE]) && !headers_sent()) {
        setcookie(ADMIN_COOKIE, '', admin_cookie_options(time() - 86400));
    }
}

/**
 * 'in' (signed in: the session is valid and now counts as used), 'out' (no session) or 'expired' (it was signed in,
 * but sat idle too long or is over 12 hours old: it's ended here).
 */
function admin_session_state(array $cfg): string
{
    if (!isset($_COOKIE[ADMIN_COOKIE])) {
        return 'out';
    }
    if (!admin_session_open(false)) {
        admin_session_end();
        return 'out';
    }
    $s = $_SESSION;
    if (($s['ok'] ?? false) !== true || !is_string($s['mark'] ?? null) || !hash_equals(admin_secret($cfg, 'session'), $s['mark'])) {
        admin_session_end(); // an empty or foreign session: leave no file behind
        return 'out';
    }
    $now = time();
    if ($now - (int)($s['seen'] ?? 0) > admin_idle_seconds($cfg) || $now - (int)($s['since'] ?? 0) > ADMIN_MAX_SECONDS) {
        admin_session_end();
        return 'expired';
    }
    $_SESSION['seen'] = $now;
    return 'in';
}

/** The sign-in form's token: an HMAC of a random cookie, so a form only works in the browser it was shown in. */
function admin_login_token(array $cfg): string
{
    $nonce = $_COOKIE[ADMIN_PRE_COOKIE] ?? '';
    if (!is_string($nonce) || !preg_match('/^[0-9a-f]{32}$/', $nonce)) {
        $nonce = bin2hex(random_bytes(16));
        if (!headers_sent()) {
            setcookie(ADMIN_PRE_COOKIE, $nonce, admin_cookie_options());
        }
        $_COOKIE[ADMIN_PRE_COOKIE] = $nonce;
    }
    return admin_secret($cfg, 'login|' . $nonce);
}

function admin_login_token_ok(array $cfg, $sent): bool
{
    $nonce = $_COOKIE[ADMIN_PRE_COOKIE] ?? '';
    return is_string($sent) && is_string($nonce) && preg_match('/^[0-9a-f]{32}$/', $nonce)
        && hash_equals(admin_secret($cfg, 'login|' . $nonce), $sent);
}

/** A request id from user input (12 hex characters), or ''. */
function admin_clean_id($v): string
{
    return is_string($v) && preg_match('/^[0-9a-f]{12}$/', $v) ? $v : '';
}

/** POST ?action=login. Signs in and redirects, or shows the form again with a message. */
function admin_handle_login(array $cfg): never
{
    $next = admin_clean_id($_POST['r'] ?? '');
    if (!admin_same_origin() || !admin_login_token_ok($cfg, $_POST['csrf'] ?? null)) {
        $why = isset($_COOKIE[ADMIN_PRE_COOKIE]) ? 'This sign-in form had expired. Please try again.'
            : 'Please allow cookies for this page (the panel needs one to keep you signed in), then try again.';
        admin_login_page($cfg, $why, 403, $next);
    }
    $ip = evo_client_ip();
    if (!evo_rate_ok('admin-login', $ip, 5, 900) || !evo_rate_ok('admin-login-all', 'all', 30, 900)) {
        header('Retry-After: 900');
        admin_login_page($cfg, 'Too many sign-in attempts. Please wait 15 minutes, then try again.', 429, $next);
    }
    $password = $_POST['password'] ?? '';
    $password = is_string($password) && strlen($password) <= 1024 ? $password : '';
    $hash = (string)$cfg['admin_password_hash'];
    $passwordOk = $password !== '' && password_verify($password, $hash);
    $key = admin_totp_key($cfg);
    $step = null;
    if ($key !== '' && $key !== null) {
        $code = $_POST['code'] ?? '';
        $step = admin_totp_match($key, is_string($code) ? $code : '', time());
    }
    $ok = $passwordOk && ($key === '' || ($step !== null && admin_totp_claim($step)));
    if (!$ok) {
        usleep(random_int(100000, 300000));
        admin_login_page($cfg, $key === '' ? 'That password didn’t work. Please try again.' : 'That password or code didn’t work. Please try again.', 401, $next);
    }

    if (!admin_session_open(true)) {
        admin_login_page($cfg, 'Signed in, but the server couldn’t save the session (evosoft-data/sessions isn’t writable).', 500, $next);
    }
    session_regenerate_id(true);
    $now = time();
    $_SESSION = ['ok' => true, 'since' => $now, 'seen' => $now, 'mark' => admin_secret($cfg, 'session'), 'csrf' => bin2hex(random_bytes(32))];
    if (password_needs_rehash($hash, PASSWORD_DEFAULT, ['cost' => 12])) {
        $_SESSION['rehash'] = password_hash($password, PASSWORD_DEFAULT, ['cost' => 12]);
    }
    if (!headers_sent()) {
        setcookie(ADMIN_PRE_COOKIE, '', admin_cookie_options(time() - 86400));
    }
    $GLOBALS['admin_signed_in'] = true;
    admin_redirect($next !== '' ? ['r' => $next] : []);
}

/** POST ?action=logout (after admin_require_post_csrf). */
function admin_logout(): never
{
    admin_session_end();
    http_response_code(303);
    admin_send_headers();
    header('Location: ' . admin_url(['bye' => 1]));
    exit;
}

/** The sign-in page; $error is shown above the form (and $code sent with it). */
function admin_login_page(array $cfg, string $error = '', int $code = 200, string $next = '', string $note = ''): never
{
    http_response_code($code);
    $totp = admin_totp_key($cfg);
    $hasCode = is_string($totp) && $totp !== '';
    $describe = $error !== '' ? ' aria-describedby="login-error" aria-invalid="true"' : '';
    $body = '<div class="login">
<div class="card login-card">
<h1>Sign in</h1>
<p class="muted">The EvoSoft admin panel, for the owner only.</p>
' . ($note !== '' ? '<p class="flash flash-ok" role="status">' . admin_h($note) . '</p>' : '')
        . ($error !== '' ? '<p class="flash flash-error" id="login-error" role="alert">' . admin_h($error) . '</p>' : '') . '
<form method="post" action="' . admin_h(admin_url(['action' => 'login'])) . '" class="stack">
<input type="hidden" name="csrf" value="' . admin_h(admin_login_token($cfg)) . '">
' . ($next !== '' ? '<input type="hidden" name="r" value="' . admin_h($next) . '">' : '') . '
<div class="field"><label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required autofocus' . $describe . '></div>
' . ($hasCode ? '<div class="field"><label for="code">Code from your authenticator app</label>
<input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" required maxlength="9" aria-describedby="code-hint' . ($error !== '' ? ' login-error" aria-invalid="true' : '') . '">
<p class="hint" id="code-hint">6 digits. It changes every 30 seconds.</p></div>' : '') . '
<button class="btn primary" type="submit">Sign in</button>
</form>
</div>
</div>';
    admin_layout('Sign in', $body, '');
    exit;
}
