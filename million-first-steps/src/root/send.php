<?php
/*
 * Million First Steps — receives the website's forms and emails them to us.
 * Runs on Hostinger and most PHP hosts (PHP 7.4+, uses PHP's mail()).
 * The recipient comes from src/config.mjs (formTo, or email) when the site is built.
 *
 * Spam protection: a hidden "website2" field bots fill in, a minimum time on the page,
 * a limit of 6 messages per visitor per hour, and same-site requests only.
 */
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
  $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
  $s = trim((string) $s);
  return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}
function site_host() {
  $h = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
  $h = preg_replace('/:\d+$/', '', $h);
  return preg_replace('/[^a-z0-9.-]/i', '', preg_replace('/^www\./i', '', $h));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405, ['ok' => false, 'error' => 'method']);
if (!$TO) reply(500, ['ok' => false, 'error' => 'not configured']);

// Same site only.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && strcasecmp(preg_replace('/^www\./i', '', (string) parse_url($origin, PHP_URL_HOST)), site_host()) !== 0) {
  reply(403, ['ok' => false, 'error' => 'origin']);
}

$ref = preg_replace('/[^A-Z0-9-]/', '', strtoupper((string) ($_POST['ref'] ?? '')));
if ($ref === '') $ref = 'MFS-' . random_int(1000, 9999);

// Bots: pretend all is well and send nothing.
if (!empty($_POST['website2'])) reply(200, ['ok' => true, 'ref' => $ref]);
$started = (int) ($_POST['started'] ?? 0);
if ($started > 0 && time() - $started < 3) reply(200, ['ok' => true, 'ref' => $ref]);

// At most 6 messages per visitor per hour.
$dir = sys_get_temp_dir() . '/mfs-forms';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
$bucket = $dir . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . gmdate('YmdH'));
$count = is_file($bucket) ? (int) @file_get_contents($bucket) : 0;
if ($count >= 6) reply(429, ['ok' => false, 'error' => 'too many']);
@file_put_contents($bucket, (string) ($count + 1), LOCK_EX);

// The message
$kind = clean($_POST['kind'] ?? 'Website form', 80);
$lang = clean($_POST['lang'] ?? '', 8);
$page = clean($_POST['page'] ?? '', 200);
$fields = $_POST['f'] ?? [];
if (!is_array($fields) || count($fields) > 40) reply(400, ['ok' => false, 'error' => 'fields']);
$lines = [];
foreach ($fields as $row) {
  if (!is_array($row)) continue;
  $label = clean($row['l'] ?? '', 80);
  $value = clean($row['v'] ?? '', 4000, true);
  if ($label === '' || $value === '') continue;
  $lines[] = $label . ': ' . (strpos($value, "\n") !== false ? "\n  " . str_replace("\n", "\n  ", $value) : $value);
}
if (!$lines) reply(400, ['ok' => false, 'error' => 'empty']);
$email = filter_var(clean($_POST['email'] ?? '', 200), FILTER_VALIDATE_EMAIL) ?: '';

$body = $kind . ' — ' . $ref . "\n\n" . implode("\n", $lines) . "\n\n--\n"
  . 'Language: ' . ($lang ?: 'en') . "\nPage: " . $page . "\nSent: " . gmdate('Y-m-d H:i') . " UTC\n";
$subject = '=?UTF-8?B?' . base64_encode('[' . $BRAND . '] ' . $kind . ' ' . $ref) . '?=';
$from = 'no-reply@' . site_host();
$headers = "From: =?UTF-8?B?" . base64_encode($BRAND) . "?= <" . $from . ">\r\n"
  . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n"
  . ($email ? "Reply-To: " . $email . "\r\n" : '');

$sent = @mail($TO, $subject, $body, $headers, '-f' . $from);
if (!$sent) $sent = @mail($TO, $subject, $body, $headers);
reply($sent ? 200 : 500, ['ok' => (bool) $sent, 'ref' => $ref]);
