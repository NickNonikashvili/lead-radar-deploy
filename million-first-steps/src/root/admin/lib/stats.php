<?php
/*
 * Cookieless visit counting for api/hit.php, and the daily salt used to hash IPs.
 * Days in the stats_* tables are UTC days (gmdate('Y-m-d')).
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

const MFS_BOT_UA = '/bot|crawl|spider|slurp|preview|headless|lighthouse|python|curl|wget|facebookexternalhit|monitor/i';

/** Today's random salt (setting daily_salt = {day, salt}); replaced when the UTC day changes, and old stats_seen rows go. */
function mfs_daily_salt(): string
{
  static $memo = null;
  $today = gmdate('Y-m-d');
  if (is_array($memo) && $memo['day'] === $today) return $memo['salt'];
  $cur = mfs_setting_fresh('daily_salt');
  if (!(is_array($cur) && ($cur['day'] ?? '') === $today && !empty($cur['salt']))) {
    $cur = db_tx(function () use ($today) {
      $c = mfs_setting_fresh('daily_salt');
      if (is_array($c) && ($c['day'] ?? '') === $today && !empty($c['salt'])) return $c;
      $c = ['day' => $today, 'salt' => bin2hex(random_bytes(16))];
      set_setting('daily_salt', $c);
      db_exec('DELETE FROM stats_seen WHERE day < ?', [$today]);
      return $c;
    });
  }
  $memo = ['day' => $today, 'salt' => (string) $cur['salt']];
  return $memo['salt'];
}

/** Turns a page address into its counted form: strips ".html", "index" → "", lower case. '' if not acceptable. */
function mfs_stats_path(string $path): string
{
  $p = strtolower(trim($path));
  $base = strtolower(mfs_site_url_path());
  if ($base !== '' && strpos($p, $base . '/') === 0) $p = substr($p, strlen($base));
  if (!preg_match('~^/[a-z0-9/_.-]{0,150}$~', $p) || strpos($p, '..') !== false || strpos($p, '//') !== false) return '';
  if (substr($p, -5) === '.html') $p = substr($p, 0, -5);
  if (substr($p, -6) === '/index') $p = substr($p, 0, -5);
  if (preg_match('~^/(admin|api|assets)(/|$)~', $p)) return '';
  return $p;
}

/** The page as the website really has it ("/tours/" for a folder), or "(not found)" when no such page exists. */
function mfs_stats_resolve(string $p): string
{
  $root = MFS_SITE_ROOT;
  if (substr($p, -1) === '/') return is_file($root . $p . 'index.html') ? $p : '(not found)';
  if (is_file($root . $p . '.html')) return $p;
  if (is_dir($root . $p) && is_file($root . $p . '/index.html')) return $p . '/';
  return '(not found)';
}

/** Referrer → host ("google.com"), "(direct)" for none; null when it is this site itself. */
function mfs_stats_referrer(string $ref): ?string
{
  $ref = trim($ref);
  if ($ref === '') return '(direct)';
  $host = strtolower((string) parse_url($ref, PHP_URL_HOST));
  if ($host === '' || !preg_match('/^[a-z0-9.-]{1,120}$/', $host)) return '(direct)';
  $host = preg_replace('/^www\./', '', $host);
  $own = preg_replace('/^www\./', '', preg_replace('/:\d+$/', '', mfs_host()));
  if ($host === $own) return null;
  return $host;
}

/** Device from the window width: phone < 640, tablet < 1024, else desktop ("unknown" without a width). */
function mfs_stats_device($w): string
{
  $w = is_numeric($w) ? (int) $w : 0;
  if ($w <= 0) return 'unknown';
  return $w < 640 ? 'phone' : ($w < 1024 ? 'tablet' : 'desktop');
}

/** True if this request must not be counted (bot user agent, Do Not Track / Global Privacy Control). */
function mfs_stats_skip_request(): bool
{
  $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
  if ($ua === '' || preg_match(MFS_BOT_UA, $ua)) return true;
  if ((string) ($_SERVER['HTTP_DNT'] ?? '') === '1' || (string) ($_SERVER['HTTP_SEC_GPC'] ?? '') === '1') return true;
  return false;
}

/**
 * Counts one page view from the beacon {"p": path, "l": lang, "r": referrer, "w": width}.
 * Returns true when counted. All counters change in one transaction.
 */
function mfs_record_hit(array $j): bool
{
  if (!setting('analytics_enabled')) return false;
  $path = mfs_stats_path((string) ($j['p'] ?? ''));
  if ($path === '') return false;
  $path = mfs_stats_resolve($path);
  $lang = strtolower((string) ($j['l'] ?? ''));
  $langs = array_map(function ($l) { return (string) $l['code']; }, catalog()['languages']);
  if (!in_array($lang, $langs, true)) $lang = preg_match('/^[a-z]{2}$/', $lang) ? $lang : 'other';
  $ref = mfs_stats_referrer((string) ($j['r'] ?? ''));
  $device = mfs_stats_device($j['w'] ?? 0);
  $day = gmdate('Y-m-d');
  $salt = mfs_daily_salt();
  $hash = hash('sha256', $salt . mfs_client_ip() . (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));

  db_tx(function (PDO $pdo) use ($day, $hash, $path, $lang, $ref, $device) {
    $pdo->prepare('INSERT OR IGNORE INTO stats_daily (day, views, visitors) VALUES (?, 0, 0)')->execute([$day]);
    $seen = $pdo->prepare('INSERT OR IGNORE INTO stats_seen (day, hash) VALUES (?, ?)');
    $seen->execute([$day, $hash]);
    $isNew = $seen->rowCount() > 0;
    $pdo->prepare('UPDATE stats_daily SET views = views + 1' . ($isNew ? ', visitors = visitors + 1' : '') . ' WHERE day = ?')->execute([$day]);
    $pdo->prepare('INSERT OR IGNORE INTO stats_pages (day, path, views) VALUES (?, ?, 0)')->execute([$day, $path]);
    $pdo->prepare('UPDATE stats_pages SET views = views + 1 WHERE day = ? AND path = ?')->execute([$day, $path]);
    $dims = ['lang' => $lang, 'device' => $device];
    if ($ref !== null) $dims['ref'] = $ref;
    $ins = $pdo->prepare('INSERT OR IGNORE INTO stats_dims (day, dim, value, views) VALUES (?, ?, ?, 0)');
    $upd = $pdo->prepare('UPDATE stats_dims SET views = views + 1 WHERE day = ? AND dim = ? AND value = ?');
    foreach ($dims as $dim => $value) {
      $ins->execute([$day, $dim, $value]);
      $upd->execute([$day, $dim, $value]);
    }
  });
  return true;
}
