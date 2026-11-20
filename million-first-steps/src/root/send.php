<?php
/*
 * Million First Steps — receives the website's forms, keeps them in the team area (admin panel)
 * and emails them to us. Runs on Hostinger and most PHP hosts (PHP 7.4+, uses PHP's mail()).
 * The recipient comes from src/config.mjs (formTo, or email) when the site is built; the owners can
 * change it in the team area (Settings → Form emails).
 *
 * Spam protection: a hidden "website2" field bots fill in, a minimum time on the page,
 * a limit of 6 messages per visitor per hour, and same-site requests only.
 * Storing and emailing are independent: a storage problem never stops the email, and a failed
 * email never loses a stored request.
 */
ini_set('display_errors', '0');   // never show a warning (or the server's paths) to a visitor
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$TO = '__TO__';
$BRAND = '__BRAND__';

function reply($code, $data) { http_response_code($code); echo json_encode($data); exit; }
function clean($s, $max, $multiline = false) {
  $s = is_string($s) ? $s : '';
  $s = str_replace("\r", '', $s);
  if (!$multiline) $s = str_replace("\n", ' ', $s);
  $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]|\xE2\x80[\xAA-\xAE]|\xE2\x81[\xA6-\xA9]/', '', $s);  // + text-direction overrides
  $s = trim((string) $s);
  return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}
function site_host() {
  $h = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
  $h = preg_replace('/:\d+$/', '', $h);
  return preg_replace('/[^a-z0-9.-]/i', '', preg_replace('/^www\./i', '', $h));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405, ['ok' => false, 'error' => 'method']);
$admin = __DIR__ . '/admin/lib/store.php';
$hasAdmin = is_file($admin);
if (!$TO && !$hasAdmin) reply(500, ['ok' => false, 'error' => 'not configured']);

// Same site only.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && strcasecmp(preg_replace('/^www\./i', '', (string) parse_url($origin, PHP_URL_HOST)), site_host()) !== 0) {
  reply(403, ['ok' => false, 'error' => 'origin']);
}

$ref = isset($_POST['ref']) && is_string($_POST['ref']) ? substr(preg_replace('/[^A-Z0-9-]/', '', strtoupper($_POST['ref'])), 0, 40) : '';
if ($ref === '') $ref = 'MFS-' . random_int(1000, 9999);

// Bots: pretend all is well and send (and keep) nothing.
if (!empty($_POST['website2'])) reply(200, ['ok' => true, 'ref' => $ref]);
// Time trap. The website always sends when the form was opened ("started", the visitor's clock) and, newer
// pages, how many seconds it was open ("elapsed", immune to a wrong clock). A post without them is a script.
$started = isset($_POST['started']) && is_string($_POST['started']) && preg_match('/^\d{9,11}$/', $_POST['started']) ? (int) $_POST['started'] : 0;
$elapsed = isset($_POST['elapsed']) && is_string($_POST['elapsed']) && preg_match('/^\d{1,9}$/', $_POST['elapsed']) ? (int) $_POST['elapsed'] : -1;
if ($started === 0) reply(200, ['ok' => true, 'ref' => $ref]);
if ($elapsed >= 0 ? $elapsed < 3 : (time() - $started >= 0 && time() - $started < 3)) reply(200, ['ok' => true, 'ref' => $ref]);
// (A "started" in the future only means the visitor's clock is fast: that's a person.)

// At most 6 messages per visitor per hour. Read and write the counter under one lock, so simultaneous posts
// can't all read the same old number.
$dir = sys_get_temp_dir() . '/mfs-forms';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
$bucket = $dir . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . gmdate('YmdH'));
$fh = @fopen($bucket, 'c+');
if ($fh && @flock($fh, LOCK_EX)) {
  $count = (int) stream_get_contents($fh);
  if ($count >= 6) {
    flock($fh, LOCK_UN);
    fclose($fh);
    reply(429, ['ok' => false, 'error' => 'too many']);
  }
  ftruncate($fh, 0);
  rewind($fh);
  fwrite($fh, (string) ($count + 1));
  fflush($fh);
  flock($fh, LOCK_UN);
}
if ($fh) fclose($fh);
// Now and then, remove the counters of past hours.
if (random_int(1, 50) === 1) {
  foreach ((array) @glob($dir . '/*') as $old) if (is_string($old) && @filemtime($old) < time() - 7200) @unlink($old);
}

// The message
$kind = clean($_POST['kind'] ?? 'Website form', 80);
$lang = clean($_POST['lang'] ?? '', 8);
$page = clean($_POST['page'] ?? '', 200);
$fields = $_POST['f'] ?? [];
if (!is_array($fields) || count($fields) > 40) reply(400, ['ok' => false, 'error' => 'fields']);
$lines = [];
$rows = [];
foreach ($fields as $row) {
  if (!is_array($row)) continue;
  $label = clean($row['l'] ?? '', 80);
  $name = clean($row['n'] ?? '', 60);
  $value = clean($row['v'] ?? '', 4000, true);
  if ($label === '' || $value === '') continue;
  // Indented under "What they sent", so nothing a visitor types can pass for one of our own lines.
  $lines[] = '  ' . $label . ': ' . (strpos($value, "\n") !== false ? "\n    " . str_replace("\n", "\n    ", $value) : $value);
  $rows[] = ['l' => $label, 'n' => $name, 'v' => $value];
}
if (!$lines) reply(400, ['ok' => false, 'error' => 'empty']);
$email = filter_var(clean($_POST['email'] ?? '', 200), FILTER_VALIDATE_EMAIL) ?: '';

// The email. Built before storing, so that it still goes out even if storing breaks badly.
function mfs_send_email($recipients, $ref, $adminLine) {
  global $kind, $lines, $lang, $page, $email, $BRAND;
  $body = $kind . ' — ' . $ref . "\n" . ($adminLine !== '' ? $adminLine . "\n" : '') . "\nWhat they sent:\n" . implode("\n", $lines) . "\n\n--\n"
    . 'Language: ' . ($lang ?: 'en') . "\nPage: " . $page . "\nSent: " . gmdate('Y-m-d H:i') . " UTC\n";
  $subject = '=?UTF-8?B?' . base64_encode('[' . $BRAND . '] ' . $kind . ' ' . $ref) . '?=';
  $from = 'no-reply@' . site_host();
  // With the team area: its sender (an existing mailbox on the site's own domain, or the one set in Settings).
  if (function_exists('mfs_mail_from')) {
    try { $from = mfs_mail_from(); } catch (Throwable $e) { /* keep the default */ }
  }
  $headers = "From: =?UTF-8?B?" . base64_encode($BRAND) . "?= <" . $from . ">\r\n"
    . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n"
    . ($email ? "Reply-To: " . $email . "\r\n" : '');
  $to = implode(', ', $recipients);
  $sent = @mail($to, $subject, $body, $headers, '-f' . $from);
  if (!$sent) $sent = @mail($to, $subject, $body, $headers);
  return (bool) $sent;
}
$GLOBALS['mfs_mail_state'] = 'pending';
register_shutdown_function(function () use ($TO, $ref) {
  // Storing died with a fatal error (which try/catch can't catch): still email the request.
  if ($GLOBALS['mfs_mail_state'] !== 'pending') return;
  $GLOBALS['mfs_mail_state'] = 'done';
  $sent = $TO ? mfs_send_email([$TO], $ref, '') : false;
  if (!headers_sent()) {
    http_response_code($sent ? 200 : 500);
    header('Content-Type: application/json; charset=utf-8');
  }
  echo json_encode(['ok' => $sent, 'ref' => $ref]);
});

// Keep it in the team area. Any problem here is logged and the email still goes out.
$stored = null;
$recipients = $TO ? [$TO] : [];
$notify = true;
if ($hasAdmin) {
  try {
    require_once $admin;
    $stored = mfs_store_request(['kind' => $kind, 'ref' => $ref, 'lang' => $lang, 'page' => $page, 'email' => $email, 'fields' => $rows]);
    if ($stored) {
      $storedRef = mfs_request_ref($stored);
      if ($storedRef !== '') $ref = $storedRef;
    }
    $ns = mfs_notify_settings($TO);
    if ($ns['to']) $recipients = $ns['to'];
    $notify = $ns['notify'];
  } catch (Throwable $e) {
    error_log('[mfs-send] storing failed: ' . $e->getMessage());
  }
}
$GLOBALS['mfs_mail_state'] = 'done';

// Stored and the owners switched notifications off: done.
if ($stored && !$notify) reply(200, ['ok' => true, 'ref' => $ref]);
if (!$recipients) reply($stored ? 200 : 500, ['ok' => (bool) $stored, 'ref' => $ref]);

$adminLine = '';
if ($stored) {
  // The link uses the website's own address (not this request's Host header, which anyone can set).
  try {
    $adminLine = 'Open in the admin panel: ' . mfs_admin_request_url($stored);
  } catch (Throwable $e) {
    error_log('[mfs-send] admin link failed: ' . $e->getMessage());
  }
}

$sent = mfs_send_email($recipients, $ref, $adminLine);
if (!$sent && $stored) {
  try {
    mfs_store_note($stored, 'Email notification could not be sent', 'system');
  } catch (Throwable $e) {
    error_log('[mfs-send] note failed: ' . $e->getMessage());
  }
}
reply($sent || $stored ? 200 : 500, ['ok' => (bool) ($sent || $stored), 'ref' => $ref]);
