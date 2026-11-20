<?php
/*
 * Million First Steps — cookieless visit counter. site.js sends one beacon per page view:
 *   POST text/plain {"p": location.pathname, "l": language, "r": document.referrer, "w": innerWidth}
 * No cookies, no IP addresses stored: a visitor is a hash of (daily random salt + IP + browser), kept only for
 * the current day. Bots, "Do Not Track" and "Global Privacy Control" are not counted. Always answers 204.
 */
ignore_user_abort(true);
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  header('Allow: POST');
  exit;
}
http_response_code(204);

try {
  $boot = dirname(__DIR__) . '/admin/lib/boot.php';
  if (!is_file($boot)) exit;
  require $boot;
  if (mfs_stats_skip_request()) exit;

  // Only beacons from our own pages (browsers send Origin with POST).
  $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
  if ($origin !== '' && !mfs_same_origin()) exit;

  $raw = (string) file_get_contents('php://input', false, null, 0, 4096);
  $j = json_decode($raw, true);
  if (!is_array($j)) exit;
  mfs_record_hit($j);
} catch (Throwable $e) {
  error_log('[mfs-hit] ' . $e->getMessage());
}
exit;
