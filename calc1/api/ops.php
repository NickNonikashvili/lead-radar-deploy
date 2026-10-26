<?php
/* ============================================================
   Mathub account server — running the site: what Bo costs, alerts when it costs too much, the weekly report to the
   administrators, and the usage numbers behind the admin panel's Growth tab.
   - What Bo costs Mathub is estimated from credit_use: every use is written down with its credits (administrators'
     too, at no charge), and credits ÷ credits_markup are cents. Calls count by the minute at their rate.
   - Cost alerts (Keys & settings → Plans and payments): cost_alert_daily and cost_alert_monthly, in dollars (0: off),
     and, while either is set, a spike: a day costing over three times the average of the 14 days before it (and
     over $1). Each alert is
     emailed to the administrators once for its day or month, and shows at the top of the admin panel until the day
     or month is over. Checked from housekeeping, at most every 15 minutes.
   - The weekly report (Keys & settings → Email: admin_report, on by default; admin_report_day, Monday by default):
     from 8:00 site time, one email to each administrator with the seven days before: members, sign-ups and who was
     active; Bo's use and cost by feature; credits sold; class requests by demand; open reports, problem reports and
     site errors; backups (here, off-site, the last restore test); the last answer test run; the alerts. The admin
     panel shows the same report (Overview) and can email it at once.
   - Usage (Growth tab): who signed up in the last 30 days and how far they got (confirmed, came back on another
     day, asked Bo, paid), and Bo's use by feature for the last 8 weeks.
   Routes: admin_ops (cost now, alerts, this week's report), admin_ops_send (email the report to me now)
   ============================================================ */
declare(strict_types=1);

require_once __DIR__ . '/credits.php';
require_once __DIR__ . '/social.php';   // mh_tz, mh_local_date

function mh_ops_db(): PDO {
  static $ready = false; $db = mh_credits_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS ops_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, period TEXT NOT NULL, at INTEGER NOT NULL, usd REAL NOT NULL, limit_usd REAL NOT NULL, note TEXT NOT NULL DEFAULT \'\', UNIQUE (kind, period))');
    $db->exec('CREATE TABLE IF NOT EXISTS ops_state (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS credit_use_at ON credit_use (at)');
    $ready = true;
  }
  return $db;
}
function mh_ops_get(string $k): string { $st = mh_ops_db()->prepare('SELECT v FROM ops_state WHERE k = ?'); $st->execute([$k]); $v = $st->fetchColumn(); return $v === false ? '' : (string)$v; }
function mh_ops_set(string $k, string $v): void { mh_ops_db()->prepare('INSERT INTO ops_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute([$k, $v]); }

/* ---------- time in the site's time zone ---------- */
function mh_ops_day_start(int $ts = 0): int { $d = new DateTime('@' . ($ts ?: time())); $d->setTimezone(mh_tz()); $d->setTime(0, 0); return $d->getTimestamp(); }
function mh_ops_month_start(int $ts = 0): int { $d = new DateTime('@' . ($ts ?: time())); $d->setTimezone(mh_tz()); $d->modify('first day of this month'); $d->setTime(0, 0); return $d->getTimestamp(); }
function mh_ops_fmt(int $ts, string $f): string { $d = new DateTime('@' . $ts); $d->setTimezone(mh_tz()); return $d->format($f); }
function mh_ops_money(float $usd): string { return '$' . number_format($usd, $usd < 100 ? 2 : 0); }
function mh_ops_n(int $n, string $one, string $many): string { return $n . ' ' . ($n === 1 ? $one : $many); }

/* ---------- what Bo costs ---------- */
/** Estimated dollars spent on the AI between $from and $to (now when 0). */
function mh_ops_usd(int $from, int $to = 0): float {
  $db = mh_ops_db(); $C = mh_credits_cfg(mh_config());
  $st = $db->prepare('SELECT COALESCE(SUM(mc), 0) FROM credit_use WHERE at >= ?' . ($to ? ' AND at < ?' : '')); $st->execute($to ? [$from, $to] : [$from]);
  return round(((int)$st->fetchColumn() / 1000) / 100 / max(0.01, $C['markup']), 4);
}
/** By feature: [feature, title, usd, uses, people], most expensive first. */
function mh_ops_by_feature(int $from, int $to): array {
  $C = mh_credits_cfg(mh_config()); $st = mh_ops_db()->prepare('SELECT feature, COALESCE(SUM(mc), 0) AS mc, COUNT(*) AS n, COUNT(DISTINCT user_id) AS p FROM credit_use WHERE at >= ? AND at < ? GROUP BY feature ORDER BY mc DESC'); $st->execute([$from, $to]);
  return array_map(fn($r) => ['feature' => (string)$r['feature'], 'title' => MH_CREDIT_FEATURES[(string)$r['feature']] ?? 'Other', 'usd' => round(((int)$r['mc'] / 1000) / 100 / max(0.01, $C['markup']), 2), 'uses' => (int)$r['n'], 'people' => (int)$r['p']], $st->fetchAll());
}
/** Who cost the most between $from and $to: [email, usd, share]. */
function mh_ops_top_people(int $from, int $to, int $n = 3): array {
  $C = mh_credits_cfg(mh_config()); $db = mh_ops_db(); $total = 0;
  $st = $db->prepare('SELECT user_id, SUM(mc) AS mc FROM credit_use WHERE at >= ? AND at < ? GROUP BY user_id ORDER BY mc DESC'); $st->execute([$from, $to]); $rows = $st->fetchAll();
  foreach ($rows as $r) $total += (int)$r['mc']; $out = [];
  foreach (array_slice($rows, 0, $n) as $r) { $e = mh_db()->prepare('SELECT email FROM users WHERE id = ?'); $e->execute([(int)$r['user_id']]); $out[] = ['email' => (string)($e->fetchColumn() ?: 'a deleted account'), 'usd' => round(((int)$r['mc'] / 1000) / 100 / max(0.01, $C['markup']), 2), 'share' => $total ? (int)round(100 * (int)$r['mc'] / $total) : 0]; }
  return $out;
}

/* ---------- cost alerts ---------- */
function mh_ops_limits(?array $cfg = null): array { $cfg = $cfg ?? mh_config(); return ['day' => max(0.0, (float)($cfg['cost_alert_daily'] ?? 0)), 'month' => max(0.0, (float)($cfg['cost_alert_monthly'] ?? 0))]; }
/** The alerts still standing: today's, this month's. */
function mh_ops_alerts_now(): array {
  $day = mh_ops_fmt(time(), 'Y-m-d'); $month = mh_ops_fmt(time(), 'Y-m');
  $st = mh_ops_db()->prepare('SELECT * FROM ops_alerts WHERE period IN (?, ?) ORDER BY at DESC'); $st->execute([$day, $month]);
  return array_map(fn($r) => ['kind' => (string)$r['kind'], 'period' => (string)$r['period'], 'at' => (int)$r['at'], 'usd' => (float)$r['usd'], 'limit' => (float)$r['limit_usd'], 'note' => (string)$r['note']], $st->fetchAll());
}
function mh_ops_alert_tick(bool $force = false): array {
  if (!$force && !mh_rate('ops:cost', 1, 900)) return [];
  $L = mh_ops_limits(); $now = time(); $d0 = mh_ops_day_start($now); $did = [];
  $today = mh_ops_usd($d0);
  $raise = function (string $kind, string $period, float $usd, float $limit, string $note) use (&$did, $d0, $now): void {
    $st = mh_ops_db()->prepare('INSERT OR IGNORE INTO ops_alerts (kind, period, at, usd, limit_usd, note) VALUES (?, ?, ?, ?, ?, ?)'); $st->execute([$kind, $period, time(), $usd, $limit, $note]);
    if (!$st->rowCount()) return;
    $from = $kind === 'month' ? mh_ops_month_start($now) : $d0; $top = mh_ops_top_people($from, $now + 1);
    mh_ops_alert_email($kind, $usd, $limit, $note, $top); $did[] = "cost alert: $kind";
  };
  if ($L['day'] > 0 && $today >= $L['day']) $raise('day', mh_ops_fmt($now, 'Y-m-d'), $today, $L['day'], '');
  if ($L['month'] > 0) { $month = mh_ops_usd(mh_ops_month_start($now)); if ($month >= $L['month']) $raise('month', mh_ops_fmt($now, 'Y-m'), $month, $L['month'], ''); }
  $before = mh_ops_usd($d0 - 14 * 86400, $d0) / 14;
  if (($L['day'] > 0 || $L['month'] > 0) && $today >= 1.0 && $before >= 0.05 && $today > 3 * $before) $raise('spike', mh_ops_fmt($now, 'Y-m-d'), $today, round(3 * $before, 2), 'The 14 days before cost ' . mh_ops_money($before) . ' a day on average.');
  return $did;
}
function mh_ops_admin_emails(): array { return array_values(array_unique(array_filter(array_map(fn($e) => strtolower(trim((string)$e)), mh_config()['admins'] ?? []), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL)))); }
function mh_ops_site(): array { $cfg = mh_config(); return [(string)($cfg['site_name'] ?? 'Mathub'), rtrim((string)(($cfg['site_url'] ?? '') ?: ('https://' . ($_SERVER['HTTP_HOST'] ?? 'mathub.space'))), '/')]; }
function mh_ops_alert_email(string $kind, float $usd, float $limit, string $note, array $top): void {
  require_once __DIR__ . '/mailer.php'; [$site, $url] = mh_ops_site(); $cfg = mh_config();
  $what = ['day' => 'today', 'month' => 'this month', 'spike' => 'today, more than three times a usual day'][$kind] ?? '';
  $subject = "$site: Bo has cost " . mh_ops_money($usd) . " $what" . ($kind === 'spike' ? '' : ' (your alert: ' . mh_ops_money($limit) . ')');
  $lines = ["Bo’s estimated AI cost $what is " . mh_ops_money($usd) . ($kind === 'spike' ? '.' : ', over the ' . mh_ops_money($limit) . ' you set.')];
  if ($note !== '') $lines[] = $note;
  if ($top) $lines[] = 'Most of it: ' . implode('; ', array_map(fn($t) => "{$t['email']} " . mh_ops_money($t['usd']) . " ({$t['share']}%)", $top)) . '.';
  $lines[] = 'Credits and who used them: ' . $url . '/#/admin/credits';
  $lines[] = ($kind === 'spike' ? 'This alert comes with the cost alerts under Keys & settings → Plans and payments, and stops when both are 0.' : 'Change or turn off this alert under Keys & settings → Plans and payments.') . ' You get one alert like this a ' . ($kind === 'month' ? 'month' : 'day') . '.';
  $html = '<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1d2433">' . implode('', array_map(fn($l) => '<p>' . htmlspecialchars($l) . '</p>', $lines)) . '</div>';
  foreach (mh_ops_admin_emails() as $to) mh_send_mail($cfg, $to, $subject, implode("\n\n", $lines), $html);
}

/* ---------- the weekly report ---------- */
/** The seven days that end at $end: everything the report says. */
function mh_ops_report(int $end = 0): array {
  $end = $end ?: time() + 1; $from = $end - 7 * 86400; $pFrom = $from - 7 * 86400; $db = mh_db(); $C = mh_credits_cfg(mh_config());
  $one = function (string $sql, array $a = []) use ($db) { $st = $db->prepare($sql); $st->execute($a); return (int)$st->fetchColumn(); };
  $real = 'email NOT LIKE "%@system.local"';
  $dEnd = mh_local_date($end); $d7 = mh_local_date($end - 6 * 86400); $d14 = mh_local_date($end - 13 * 86400);
  $people = ['members' => $one("SELECT COUNT(*) FROM users WHERE verified = 1 AND $real"),
    'signups' => $one("SELECT COUNT(*) FROM users WHERE $real AND created >= ? AND created < ?", [$from, $end]), 'signups_prev' => $one("SELECT COUNT(*) FROM users WHERE $real AND created >= ? AND created < ?", [$pFrom, $from]),
    'confirmed' => $one("SELECT COUNT(*) FROM users WHERE verified = 1 AND $real AND created >= ? AND created < ?", [$from, $end]),
    'active' => $one('SELECT COUNT(DISTINCT user_id) FROM user_days WHERE day >= ? AND day <= ?', [$d7, $dEnd]), 'active_prev' => $one('SELECT COUNT(DISTINCT user_id) FROM user_days WHERE day >= ? AND day < ?', [$d14, $d7])];
  $cdb = mh_ops_db(); $c1 = function (string $sql, array $a) use ($cdb) { $st = $cdb->prepare($sql); $st->execute($a); return $st->fetch(); };
  $u = $c1('SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS p FROM credit_use WHERE at >= ? AND at < ?', [$from, $end]);
  $bo = ['usd' => mh_ops_usd($from, $end), 'usd_prev' => mh_ops_usd($pFrom, $from), 'uses' => (int)$u['n'], 'people' => (int)$u['p'], 'by' => array_slice(mh_ops_by_feature($from, $end), 0, 6)];
  $bo['per_active'] = $people['active'] ? round($bo['usd'] / $people['active'], 3) : 0;
  $s = $c1("SELECT COALESCE(SUM(kind = 'buy'), 0) AS sold, COALESCE(SUM(kind = 'refund'), 0) AS refunds FROM credit_add WHERE created >= ? AND created < ?", [$from, $end]);
  $money = ['packs' => (int)$s['sold'], 'refunds' => (int)$s['refunds'], 'revenue' => round(((int)$s['sold'] - (int)$s['refunds']) * $C['price_num'], 2), 'price' => $C['price']];
  $req = ['new' => 0, 'top' => []];
  try { require_once __DIR__ . '/requests.php'; mh_req_db(); $req['new'] = $one('SELECT COUNT(*) FROM class_requests WHERE created >= ? AND created < ? AND status <> "withdrawn"', [$from, $end]); $req['top'] = array_slice(mh_req_demand(), 0, 5); } catch (Throwable $e) {}
  $safe = ['reports' => 0, 'issues' => 0, 'errors' => 0, 'flags' => 0];
  foreach (['reports' => 'SELECT COUNT(*) FROM reports WHERE status = "open"', 'issues' => 'SELECT COUNT(*) FROM issues WHERE status = "open"', 'flags' => 'SELECT COUNT(*) FROM ai_flags WHERE status = "open"'] as $k => $sql) { try { $safe[$k] = (int)$db->query($sql)->fetchColumn(); } catch (Throwable $e) {} }
  try { $safe['errors'] = $one('SELECT COALESCE(SUM(count), 0) FROM client_errors WHERE last >= ?', [$from]); } catch (Throwable $e) {}
  require_once __DIR__ . '/extras.php'; $local = mh_backup_list();
  $backups = ['local' => $local ? ['name' => $local[0]['name'], 'at' => (int)$local[0]['mtime'], 'size' => (int)$local[0]['size']] : null, 'offsite' => null];
  try { require_once __DIR__ . '/offsite.php'; $o = mh_offsite_status(); $backups['offsite'] = ['ready' => $o['ready'], 'missing' => $o['missing'], 'last_sent' => $o['last_sent'], 'last_send' => $o['last_send'], 'last_test' => $o['last_test']]; } catch (Throwable $e) {}
  $eval = null; try { require_once __DIR__ . '/evals.php'; $eval = mh_eval_last(); } catch (Throwable $e) {}
  $st = $cdb->prepare('SELECT kind, period, usd, limit_usd, note FROM ops_alerts WHERE at >= ? AND at < ? ORDER BY at'); $st->execute([$from, $end]);
  $alerts = array_map(fn($r) => ['kind' => (string)$r['kind'], 'period' => (string)$r['period'], 'usd' => (float)$r['usd'], 'limit' => (float)$r['limit_usd'], 'note' => (string)$r['note']], $st->fetchAll());
  return ['from' => $from, 'end' => $end, 'label' => mh_ops_fmt($from, 'M j') . ' – ' . mh_ops_fmt($end - 1, 'M j'), 'people' => $people, 'bo' => $bo, 'money' => $money, 'requests' => $req, 'safety' => $safe, 'backups' => $backups, 'eval' => $eval, 'alerts' => $alerts];
}
/** The report as an email: [subject, text, html]. */
function mh_ops_report_mail(array $R): array {
  [$site, $url] = mh_ops_site(); $P = $R['people']; $B = $R['bo'];
  $ch = function (float $now, float $was): string { if ($was <= 0) return $now > 0 ? 'new' : 'same'; $d = (int)round(100 * ($now - $was) / $was); return ($d > 0 ? '+' : '') . $d . '%'; };
  $ago = function (int $ts): string { $h = (int)floor((time() - $ts) / 3600); return $h < 1 ? 'less than an hour ago' : ($h < 48 ? "$h hours ago" : intdiv($h, 24) . ' days ago'); };
  $S = [];
  $S['People'] = [mh_ops_n($P['members'], 'member', 'members') . '. ' . "{$P['signups']} signed up this week ({$ch($P['signups'], $P['signups_prev'])} on the week before), {$P['confirmed']} of them confirmed.", mh_ops_n($P['active'], 'person was', 'people were') . " active ({$ch($P['active'], $P['active_prev'])})."];
  $S['Bo'] = [mh_ops_n($B['uses'], 'use', 'uses') . ' by ' . mh_ops_n($B['people'], 'person', 'people') . ', costing about ' . mh_ops_money($B['usd']) . " ({$ch($B['usd'], $B['usd_prev'])}); " . mh_ops_money($B['per_active']) . ' per active member.'];
  foreach ($B['by'] as $f) $S['Bo'][] = "{$f['title']}: " . mh_ops_money($f['usd']) . ', ' . mh_ops_n($f['uses'], 'use', 'uses') . ' by ' . mh_ops_n($f['people'], 'person', 'people');
  $M = $R['money']; $S['Credits sold'] = [$M['packs'] ? "{$M['packs']} packs" . ($M['refunds'] ? ", {$M['refunds']} refunded" : '') . ', about ' . mh_ops_money($M['revenue']) . '.' : 'No packs sold this week.'];
  $Q = $R['requests']; $S['Class requests'] = [$Q['new'] . ' new this week.']; foreach ($Q['top'] as $t) $S['Class requests'][] = "{$t['code']}" . ($t['title'] !== '' ? " {$t['title']}" : '') . ": {$t['people']} " . ($t['people'] === 1 ? 'person' : 'people') . ($t['recent'] ? ", {$t['recent']} in the last 30 days" : '') . ($t['syllabus'] ? '' : ', no syllabus yet');
  $F = $R['safety']; $S['To look at'] = [mh_ops_n($F['reports'], 'open report', 'open reports') . ', ' . mh_ops_n($F['issues'], 'problem report', 'problem reports') . ', ' . mh_ops_n($F['flags'], 'answer', 'answers') . ' marked not right, ' . mh_ops_n($F['errors'], 'site error', 'site errors') . ' this week.'];
  $K = $R['backups']; $bk = [$K['local'] ? 'Newest copy on the server: ' . $ago($K['local']['at']) . '.' : 'No copy on the server yet.'];
  $o = $K['offsite']; if (!$o || !$o['ready']) $bk[] = 'Off-site copies are not set up' . ($o && $o['missing'] !== '' ? ': ' . $o['missing'] : '.');
  else { $bk[] = $o['last_sent'] ? 'Newest copy off-site: ' . $ago($o['last_sent']['at']) . '.' : 'No copy off-site yet.'; if ($o['last_send'] && !$o['last_send']['ok']) $bk[] = 'The last send failed: ' . $o['last_send']['note'];
    $bk[] = $o['last_test'] ? ($o['last_test']['ok'] ? 'Restore test passed ' . $ago($o['last_test']['at']) . " ({$o['last_test']['note']})." : 'The last restore test FAILED: ' . $o['last_test']['note']) : 'No restore test yet.'; }
  $S['Backups'] = $bk;
  $E = $R['eval']; $S['Answer tests'] = [$E ? "Last run " . mh_ops_fmt($E['started'], 'M j') . ": {$E['passed']} of {$E['done']} passed" . ($E['regressions'] ? ", {$E['regressions']} newly failing" : '') . " ({$E['model']})." : 'No run yet. Run them from the admin panel’s Answer tests tab.'];
  $S['Cost alerts'] = !$R['alerts'] ? ['None this week.'] : array_map(fn($a) => ['day' => 'Day', 'month' => 'Month', 'spike' => 'Spike'][$a['kind']] . " {$a['period']}: " . mh_ops_money($a['usd']) . ($a['kind'] === 'spike' ? '' : ' (alert at ' . mh_ops_money($a['limit']) . ')'), $R['alerts']);
  $subject = "$site this week ({$R['label']}): {$P['signups']} sign-ups, {$P['active']} active, Bo " . mh_ops_money($B['usd']);
  $text = "$site, {$R['label']}\n\n"; $html = '<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1d2433;max-width:620px"><h1 style="font-size:20px;margin:0 0 4px">' . htmlspecialchars($site) . ' this week</h1><p style="color:#5b6478;margin:0 0 16px">' . htmlspecialchars($R['label']) . '</p>';
  foreach ($S as $h => $lines) { $text .= strtoupper($h) . "\n" . implode("\n", array_map(fn($l) => '- ' . $l, $lines)) . "\n\n"; $html .= '<h2 style="font-size:15px;margin:18px 0 4px">' . htmlspecialchars($h) . '</h2><ul style="margin:0;padding-left:18px">' . implode('', array_map(fn($l) => '<li>' . htmlspecialchars($l) . '</li>', $lines)) . '</ul>'; }
  $text .= "The admin panel: $url/#/admin\nTurn this email off under Keys & settings → Email."; $html .= '<p style="margin-top:20px"><a href="' . htmlspecialchars($url) . '/#/admin">Open the admin panel</a></p><p style="color:#5b6478;font-size:13px">Turn this email off under Keys &amp; settings → Email.</p></div>';
  return [$subject, $text, $html, $S];
}
/** When this week's report is due (from 8:00 site time on admin_report_day), as a time; null when it is off. */
function mh_ops_report_due(?array $cfg = null): ?int {
  $cfg = $cfg ?? mh_config(); if (($cfg['admin_report'] ?? 'on') === 'off') return null;
  $day = (int)($cfg['admin_report_day'] ?? 1); $d = new DateTime('now', mh_tz()); $back = ((int)$d->format('w') - $day + 7) % 7;
  $d->modify("-$back days"); $d->setTime(8, 0); if ($d->getTimestamp() > time()) $d->modify('-7 days'); return $d->getTimestamp();
}
function mh_ops_report_tick(): array {
  $due = mh_ops_report_due(); if ($due === null || (int)mh_ops_get('report_sent') >= $due) return [];
  if (!mh_rate('ops:report', 1, 1800)) return [];
  mh_ops_set('report_sent', (string)time());   // marked first: two visits at once must not both send it
  require_once __DIR__ . '/mailer.php'; [$subject, $text, $html] = mh_ops_report_mail(mh_ops_report($due)); $n = 0;
  foreach (mh_ops_admin_emails() as $to) { $r = mh_send_mail(mh_config(), $to, $subject, $text, $html); if ($r['ok']) $n++; }
  return ["weekly report: $n sent"];
}
/** From housekeeping. */
function mh_ops_tick(bool $full = false): array {
  $did = [];
  try { $did = array_merge($did, mh_ops_alert_tick($full)); } catch (Throwable $e) { error_log('mathub ops alerts: ' . $e->getMessage()); }
  try { $did = array_merge($did, mh_ops_report_tick()); } catch (Throwable $e) { error_log('mathub ops report: ' . $e->getMessage()); }
  return $did;
}

/* ---------- usage, for the Growth tab ---------- */
function mh_ops_usage(): array {
  $db = mh_db(); $now = time(); $from = $now - 30 * 86400; $real = 'email NOT LIKE "%@system.local"';
  $st = $db->prepare("SELECT id, created, verified FROM users WHERE $real AND created >= ?"); $st->execute([$from]); $new = $st->fetchAll();
  $ids = array_map(fn($r) => (int)$r['id'], $new); $f = ['signed_up' => count($new), 'confirmed' => 0, 'returned' => 0, 'asked_bo' => 0, 'paid' => 0];
  if ($ids) {
    $in = implode(',', $ids); $cdb = mh_ops_db();
    $f['confirmed'] = count(array_filter($new, fn($r) => (int)$r['verified'] === 1));
    $days = []; foreach ($db->query("SELECT user_id, COUNT(*) AS n FROM user_days WHERE user_id IN ($in) GROUP BY user_id")->fetchAll() as $r) $days[(int)$r['user_id']] = (int)$r['n'];
    $f['returned'] = count(array_filter($ids, fn($id) => ($days[$id] ?? 0) >= 2));
    $f['asked_bo'] = (int)$cdb->query("SELECT COUNT(DISTINCT user_id) FROM credit_use WHERE user_id IN ($in)")->fetchColumn();
    $paid = array_flip(array_map('intval', $cdb->query("SELECT DISTINCT user_id FROM credit_add WHERE kind = 'buy' AND user_id IN ($in)")->fetchAll(PDO::FETCH_COLUMN)));
    try { require_once __DIR__ . '/myclasses.php'; foreach (mh_myclass_db()->query("SELECT user_id FROM create_status WHERE active = 1 AND user_id IN ($in)")->fetchAll(PDO::FETCH_COLUMN) as $id) $paid[(int)$id] = true; } catch (Throwable $e) {}
    $f['paid'] = count($paid);
  }
  $weeks = []; $w0 = mh_ops_day_start($now - ((int)mh_ops_fmt($now, 'N') - 1) * 86400);   // Monday of this week
  for ($i = 7; $i >= 0; $i--) { $a = $w0 - $i * 7 * 86400; $b = $a + 7 * 86400; $weeks[] = ['label' => mh_ops_fmt($a, 'M j'), 'usd' => mh_ops_usd($a, $b), 'by' => mh_ops_by_feature($a, $b)]; }
  return ['funnel' => $f, 'weeks' => $weeks];
}

function mh_ops_route(string $route, array $in, array $cfg): void {
  $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Admins only.', 403);
  switch ($route) {
    case 'admin_ops': {
      mh_method('GET'); $now = time(); $L = mh_ops_limits($cfg); $R = mh_ops_report(); [$subject, , , $S] = mh_ops_report_mail($R);
      mh_json(['ok' => true, 'cost' => ['today' => mh_ops_usd(mh_ops_day_start($now)), 'month' => mh_ops_usd(mh_ops_month_start($now)), 'limit_day' => $L['day'], 'limit_month' => $L['month']], 'alerts' => mh_ops_alerts_now(),
        'report' => ['subject' => $subject, 'label' => $R['label'], 'sections' => $S, 'on' => ($cfg['admin_report'] ?? 'on') !== 'off', 'sent' => (int)mh_ops_get('report_sent'), 'next' => ($due = mh_ops_report_due($cfg)) ? $due + 7 * 86400 : 0]]);
    }
    case 'admin_ops_send': {
      mh_method('POST'); mh_rate_or_fail("ops_send:{$u['id']}", 6, 3600, 'That is a lot of reports. Wait a little.');
      require_once __DIR__ . '/mailer.php'; [$subject, $text, $html] = mh_ops_report_mail(mh_ops_report());
      $r = mh_send_mail($cfg, (string)$u['email'], $subject, $text, $html); if (!$r['ok']) mh_fail('Sending failed: ' . ($r['error'] ?? 'unknown error'), 502);
      mh_json(['ok' => true, 'to' => $u['email'], 'logged' => mh_mail_mode($cfg) === 'log']);
    }
  }
  mh_fail('Not found.', 404);
}
