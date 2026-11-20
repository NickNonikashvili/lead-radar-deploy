<?php
/*
 * Daily clean-up (at most once a Tbilisi day, on any admin page or send.php call):
 * - requests still new/contacted/quoted/lost, with no booking, untouched for retention_months (0 = keep forever)
 * - spam untouched for spam_retention_days (0 = keep forever)
 * - login attempts older than 7 days, expired password-reset links, visitor hashes of past days
 * One audit_log line ("system.cleanup") lists what was removed.
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

function mfs_housekeeping(bool $force = false): ?array
{
  try {
    $today = local_today();
    if (!$force && mfs_setting_fresh('housekeeping_day') === $today) return null;
    $claimed = db_tx(function () use ($today, $force) {
      if (!$force && mfs_setting_fresh('housekeeping_day') === $today) return false;
      set_setting('housekeeping_day', $today);
      return true;
    });
    if (!$claimed) return null;

    $months = (int) setting('retention_months');
    $spamDays = (int) setting('spam_retention_days');
    $counts = ['requests' => 0, 'spam' => 0, 'login_attempts' => 0, 'password_resets' => 0];
    db_tx(function () use ($months, $spamDays, &$counts) {
      if ($months > 0) {
        $cut = gmdate('Y-m-d H:i:s', strtotime('-' . $months . ' months'));
        $counts['requests'] = db_exec("DELETE FROM requests WHERE status IN ('new','contacted','quoted','lost')
          AND MAX(created_at, updated_at) < ? AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.request_id = requests.id)", [$cut]);
      }
      if ($spamDays > 0) {
        $cut = gmdate('Y-m-d H:i:s', time() - $spamDays * 86400);
        $counts['spam'] = db_exec("DELETE FROM requests WHERE status = 'spam' AND MAX(created_at, updated_at) < ?
          AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.request_id = requests.id)", [$cut]);
      }
      $counts['login_attempts'] = db_exec('DELETE FROM login_attempts WHERE at < ?', [time() - 7 * 86400]);
      $counts['password_resets'] = db_exec('DELETE FROM password_resets WHERE expires_at < ?', [time()]);
      db_exec('DELETE FROM stats_seen WHERE day < ?', [gmdate('Y-m-d')]);
    });
    if (array_sum($counts) > 0) {
      audit('system.cleanup', '', sprintf('Removed %d old requests, %d spam, %d login attempts, %d reset links (keeping requests %s, spam %s)',
        $counts['requests'], $counts['spam'], $counts['login_attempts'], $counts['password_resets'],
        $months > 0 ? $months . ' months' : 'forever', $spamDays > 0 ? $spamDays . ' days' : 'forever'));
    }
    return $counts;
  } catch (Throwable $e) {
    error_log('[mfs-admin] housekeeping: ' . $e->getMessage());
    return null;
  }
}
