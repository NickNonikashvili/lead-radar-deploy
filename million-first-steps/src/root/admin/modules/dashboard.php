<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
/*
 * Dashboard (?p=dashboard, the team area's home page): greeting, key figures, "Needs attention" (new requests,
 * follow-ups due, payments due or overdue, trips starting within 7 days — each item links to its request or
 * booking), latest requests, upcoming trips, requests per week, visitors per day and the most requested tours.
 *
 * Definitions (so the figures can be checked):
 *   - "Last 30 days" = the last 30 UTC days including today, like the visitor counts (stats_* use UTC days);
 *     "previous 30 days" = the 30 days before. Spam is never counted as a request.
 *   - "This year" = the calendar year in Tbilisi. Confirmed bookings / booked revenue: bookings with status
 *     confirmed or completed that were created this year. Payments received: paid_on from 1 January to today.
 *   - Outstanding balances: total − paid of confirmed and completed bookings (quotes aren't owed yet).
 *     What's due and whether it's overdue follows the Bookings page (bk_money in bookings-lib.php).
 *   - Requests per week: weeks run Monday–Sunday in Tbilisi time; the current week is drawn lighter.
 * Read-only page: nothing is changed here (a POST is answered with a redirect after the CSRF check).
 */
$me = require_login();
if (is_post()) {
  csrf_check();
  redirect(url('dashboard'));
}
require_once __DIR__ . '/insights-lib.php';
require_once __DIR__ . '/requests-lib.php';
require_once __DIR__ . '/bookings-lib.php';

$today = local_today();
$year = (int) substr($today, 0, 4);
$owner = is_owner();
$statsOn = (bool) setting('analytics_enabled');
$openIn = "'new','contacted','quoted'";
$dueSql = "r.follow_up_on IS NOT NULL AND r.follow_up_on <> '' AND r.follow_up_on <= ?";

// ── Key figures ─────────────────────────────────────────────────────────────

$newRow = db_row("SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM requests WHERE status = 'new'") ?: ['n' => 0, 'oldest' => null];
$newCount = (int) $newRow['n'];

list($w30a, $w30b) = ins_window(30);
list($wPa, $wPb) = ins_window(30, 1);
list($r30from, $r30to) = ins_utc_bounds($w30a, $w30b);
list($rPfrom, $rPto) = ins_utc_bounds($wPa, $wPb);
$req30 = (int) db_value("SELECT COUNT(*) FROM requests WHERE status <> 'spam' AND created_at >= ? AND created_at < ?", [$r30from, $r30to]);
$reqPrev = (int) db_value("SELECT COUNT(*) FROM requests WHERE status <> 'spam' AND created_at >= ? AND created_at < ?", [$rPfrom, $rPto]);

$yearFrom = ins_local_midnight_utc($year . '-01-01');
$yearTo = ins_local_midnight_utc(($year + 1) . '-01-01');
$bkYear = db_row("SELECT COUNT(*) AS n, COALESCE(SUM(total_price), 0) AS value FROM bookings
  WHERE status IN ('confirmed','completed') AND created_at >= ? AND created_at < ?", [$yearFrom, $yearTo]) ?: ['n' => 0, 'value' => 0];
$bkYearN = (int) $bkYear['n'];
$bkYearValue = round((float) $bkYear['value'], 2);
$quotesOpen = (int) db_value("SELECT COUNT(*) FROM bookings WHERE status = 'quote'");

$payYear = db_row('SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM payments WHERE paid_on >= ? AND paid_on <= ?', [$year . '-01-01', $today]) ?: ['n' => 0, 'total' => 0];
$payYearN = (int) $payYear['n'];
$payYearTotal = round((float) $payYear['total'], 2);

// Money still to come from confirmed / completed trips, and what of it is due soon or overdue.
$owing = db_all("SELECT b.*, COALESCE(pp.paid, 0) AS paid FROM bookings b " . BK_PAID_JOIN . "
  WHERE b.status IN ('confirmed','completed') AND b.total_price - COALESCE(pp.paid, 0) > " . BK_EPS);
$outstanding = 0.0;
$overdueAmount = 0.0;
$owingN = 0;
$payItems = [];
foreach ($owing as $b) {
  $m = bk_money($b);
  if ($m['balance'] <= BK_EPS) continue;
  $outstanding += $m['balance'];
  $owingN++;
  if (!$m['due']) continue;
  if ($m['due']['overdue']) $overdueAmount += $m['due']['amount'];
  if ($m['due']['overdue'] || $m['due']['soon']) $payItems[] = ['b' => $b, 'm' => $m];
}
$outstanding = round($outstanding, 2);
$overdueAmount = round($overdueAmount, 2);
// Most overdue first, then the soonest due.
usort($payItems, function ($x, $y) {
  $dx = $x['m']['due']['days'];
  $dy = $y['m']['due']['days'];
  $kx = $dx === null ? -100000 : $dx;
  $ky = $dy === null ? -100000 : $dy;
  if ($kx !== $ky) return $kx < $ky ? -1 : 1;
  return (int) $x['b']['id'] <=> (int) $y['b']['id'];
});

$vis = db_row('SELECT COALESCE(SUM(visitors), 0) AS v, COALESCE(SUM(views), 0) AS pv FROM stats_daily WHERE day >= ? AND day <= ?', [$w30a, $w30b]) ?: ['v' => 0, 'pv' => 0];
$visPrev = (int) db_value('SELECT COALESCE(SUM(visitors), 0) FROM stats_daily WHERE day >= ? AND day <= ?', [$wPa, $wPb]);
$vis30 = (int) $vis['v'];
$views30 = (int) $vis['pv'];
$rate30 = ins_rate($req30, $vis30);

// ── Needs attention ─────────────────────────────────────────────────────────

$followN = (int) db_value("SELECT COUNT(*) FROM requests r WHERE r.status IN ($openIn) AND $dueSql", [$today]);
$follow = db_all("SELECT r.*, u.name AS assignee FROM requests r LEFT JOIN users u ON u.id = r.assigned_to
  WHERE r.status IN ($openIn) AND $dueSql ORDER BY r.follow_up_on ASC, r.created_at ASC, r.id ASC LIMIT 5", [$today]);
// New requests that aren't already listed under follow-ups.
$newOnlyN = (int) db_value("SELECT COUNT(*) FROM requests r WHERE r.status = 'new' AND NOT ($dueSql)", [$today]);
$newList = db_all("SELECT r.*, u.name AS assignee FROM requests r LEFT JOIN users u ON u.id = r.assigned_to
  WHERE r.status = 'new' AND NOT ($dueSql) ORDER BY r.created_at ASC, r.id ASC LIMIT 5", [$today]);
// Open requests handed to the person looking (a personal view: not added to the total, which counts each item once).
$mineN = (int) db_value("SELECT COUNT(*) FROM requests r WHERE r.status IN ($openIn) AND r.assigned_to = ?", [(int) $me['id']]);
$mineList = $mineN > 0 ? db_all("SELECT r.*, u.name AS assignee FROM requests r LEFT JOIN users u ON u.id = r.assigned_to
  WHERE r.status IN ($openIn) AND r.assigned_to = ? ORDER BY r.updated_at DESC, r.id DESC LIMIT 5", [(int) $me['id']]) : [];
$tripsSoon = db_all("SELECT b.*, COALESCE(pp.paid, 0) AS paid FROM bookings b " . BK_PAID_JOIN . "
  WHERE b.status IN ('quote','confirmed') AND b.start_date >= ? AND b.start_date <= ? ORDER BY b.start_date, b.id", [$today, ins_local_add_days($today, 7)]);
$payN = count($payItems);
$tripsN = count($tripsSoon);
$attnTotal = $newOnlyN + $followN + $payN + $tripsN;

// ── Lists ───────────────────────────────────────────────────────────────────

$latest = db_all("SELECT r.*, u.name AS assignee FROM requests r LEFT JOIN users u ON u.id = r.assigned_to
  WHERE r.status <> 'spam' ORDER BY r.created_at DESC, r.id DESC LIMIT 6");
$upTo = ins_local_add_days($today, 60);
$upWhere = "b.status IN ('quote','confirmed') AND b.start_date IS NOT NULL AND b.start_date <> '' AND b.start_date <= ? AND " . BK_END_SQL . ' >= ?';
$upN = (int) db_value("SELECT COUNT(*) FROM bookings b WHERE $upWhere", [$upTo, $today]);
$upcoming = db_all("SELECT b.*, COALESCE(pp.paid, 0) AS paid FROM bookings b " . BK_PAID_JOIN . " WHERE $upWhere ORDER BY b.start_date, b.id LIMIT 8", [$upTo, $today]);

$anyRequest = (int) db_value('SELECT COUNT(*) FROM requests') > 0;
$anyBooking = (int) db_value('SELECT COUNT(*) FROM bookings') > 0;

// Most requested tours over the last 12 months (all catalogue tours, so the quiet ones show too).
$since12m = ins_local_midnight_utc(ins_local_add_days($today, -364));
$tourReq = [];
foreach (db_all("SELECT tour_id, COUNT(*) AS n FROM requests WHERE status <> 'spam' AND tour_id IS NOT NULL AND tour_id <> '' AND created_at >= ? GROUP BY tour_id", [$since12m]) as $r) {
  $tourReq[(string) $r['tour_id']] = (int) $r['n'];
}
$tourBooked = [];
foreach (db_all("SELECT tour_id, COUNT(*) AS n FROM bookings WHERE status IN ('confirmed','completed') AND tour_id IS NOT NULL AND tour_id <> '' AND created_at >= ? GROUP BY tour_id", [$since12m]) as $r) {
  $tourBooked[(string) $r['tour_id']] = (int) $r['n'];
}

// ── Requests per week (12 weeks, Monday–Sunday in Tbilisi) ─────────────────

$dow = (int) DateTime::createFromFormat('!Y-m-d', $today, mfs_tz())->format('N');
$thisMonday = ins_local_add_days($today, -($dow - 1));
$firstMonday = ins_local_add_days($thisMonday, -77);
$weekReq = array_fill(0, 12, 0);
$weekBooked = array_fill(0, 12, 0);
$t0 = strtotime($firstMonday . ' 00:00:00 UTC');
foreach (db_all("SELECT created_at, status FROM requests WHERE status <> 'spam' AND created_at >= ?", [ins_local_midnight_utc($firstMonday)]) as $r) {
  $ld = ins_local_date_of($r['created_at']);
  if ($ld === '') continue;
  $idx = (int) floor((strtotime($ld . ' 00:00:00 UTC') - $t0) / 86400 / 7);
  if ($idx < 0 || $idx > 11) continue;
  if ($r['status'] === 'booked') $weekBooked[$idx]++;
  else $weekReq[$idx]++;
}
$weekLabels = [];
$weekAxis = [];
for ($i = 0; $i < 12; $i++) {
  $mon = ins_local_add_days($firstMonday, $i * 7);
  $weekLabels[] = t('Week of {date}', ['date' => ins_day_label($mon)]);
  $weekAxis[] = ins_day_label($mon);
}
$weekTotals = [];
for ($i = 0; $i < 12; $i++) $weekTotals[$i] = $weekReq[$i] + $weekBooked[$i];
$req12w = array_sum($weekTotals);

// ── Visitors per day (30 UTC days) ──────────────────────────────────────────

$days30 = ins_days_list($w30a, $w30b);
$visByDay = [];
foreach (db_all('SELECT day, visitors, views FROM stats_daily WHERE day >= ? AND day <= ?', [$w30a, $w30b]) as $r) $visByDay[$r['day']] = [(int) $r['visitors'], (int) $r['views']];
$visVals = [];
$dayLabels = [];
$dayAxis = [];
foreach ($days30 as $d) {
  $visVals[] = isset($visByDay[$d]) ? $visByDay[$d][0] : 0;
  $dayLabels[] = ins_weekday_day_label($d);
  $dayAxis[] = ins_day_label($d);
}

// ── Output helpers ──────────────────────────────────────────────────────────

/**
 * One list row linking to a request or booking. $o: href, title, icon (or lead = HTML in front, e.g. a date
 * badge), tone (late|today|soon), sub (line under the title), facts (strings, [text, tone] or ['html' => …];
 * wrap cleanly, separated by dots), note (muted text, at most two lines), aside (HTML on the right).
 */
$item = function (array $o) {
  $facts = '';
  foreach ((array) ($o['facts'] ?? []) as $f) {
    if (is_array($f) && isset($f['html'])) $facts .= '<span class="dash-fact dash-fact--html">' . $f['html'] . '</span>';
    elseif (is_array($f)) $facts .= '<span class="dash-fact' . ($f[1] !== '' ? ' dash-fact--' . h($f[1]) : '') . '">' . h($f[0]) . '</span>';
    elseif ((string) $f !== '') $facts .= '<span class="dash-fact">' . h($f) . '</span>';
  }
  $tone = (string) ($o['tone'] ?? '');
  $lead = isset($o['lead']) ? $o['lead'] : '<span class="list__icon dash-item__icon" aria-hidden="true">' . icon((string) ($o['icon'] ?? 'inbox')) . '</span>';
  return '<li><a class="list__item dash-item' . ($tone !== '' ? ' dash-item--' . h($tone) : '') . (!empty($o['class']) ? ' ' . h($o['class']) : '') . '" href="' . h($o['href']) . '">'
    . $lead
    . '<span class="list__main"><span class="list__title">' . ($o['title_html'] ?? '') . h($o['title']) . '</span>'
    . (!empty($o['sub']) ? '<span class="dash-item__sub">' . h($o['sub']) . '</span>' : '')
    . ($facts !== '' ? '<span class="dash-item__meta"><span class="dash-item__facts">' . $facts . '</span></span>' : '')
    . (!empty($o['note']) ? '<span class="dash-item__note">' . h($o['note']) . '</span>' : '') . '</span>'
    . '<span class="list__aside">' . ($o['aside'] ?? '') . '<span class="dash-item__go" aria-hidden="true">' . icon('chevron-right') . '</span></span></a></li>';
};
/** Small initials bubble for whoever a request is assigned to. */
$assignee = function (array $r) {
  if (empty($r['assignee'])) return '';
  $who = t('Assigned to {name}', ['name' => $r['assignee']]);
  return '<span class="avatar avatar--sm" title="' . h($who) . '" aria-hidden="true">' . h(initials($r['assignee'])) . '</span><span class="sr-only">' . h($who) . '</span>';
};
/** "Balance overdue by 3 days" / "Deposit due in 5 days" / "Balance due today" (the amount is shown beside it). */
$dueShort = function (array $due) {
  $dep = $due['what'] === 'deposit';
  $d = $due['days'];
  if ($d === null) return !empty($due['late_by_trip']) ? t('Balance still to collect — the trip is over') : ($dep ? t('Deposit to collect') : t('Balance to collect'));
  if ($d < 0) return $dep ? tp(-$d, 'Deposit overdue by {n} day', 'Deposit overdue by {n} days') : tp(-$d, 'Balance overdue by {n} day', 'Balance overdue by {n} days');
  if ($d === 0) return $dep ? t('Deposit due today') : t('Balance due today');
  if ($d === 1) return $dep ? t('Deposit due tomorrow') : t('Balance due tomorrow');
  return $dep ? tp($d, 'Deposit due in {n} day', 'Deposit due in {n} days') : tp($d, 'Balance due in {n} day', 'Balance due in {n} days');
};
$kindIcon = ['trip' => 'map-pin', 'contact' => 'mail', 'partner' => 'users', 'other' => 'note'];
$kpi = function (string $tone, string $icon, string $label, string $value, string $metaHtml, string $href, string $key, $raw) {
  $long = strlen($value) > 8 ? ' dash-kpi__value--long' : '';
  $inner = '<span class="kpi__icon" aria-hidden="true">' . icon($icon) . '</span><p class="kpi__label">' . h($label) . '</p>'
    . '<p class="kpi__value' . $long . '" data-kpi="' . h($key) . '" data-value="' . h((string) $raw) . '">' . h($value) . '</p>'
    . '<p class="kpi__meta">' . $metaHtml . '</p>';
  return $href !== ''
    ? '<a class="kpi kpi--' . h($tone) . ' dash-kpi" href="' . h($href) . '">' . $inner . '</a>'
    : '<div class="kpi kpi--' . h($tone) . ' dash-kpi">' . $inner . '</div>';
};
/** A group inside "Needs attention": heading, rows, and a link to the full list when there are more. */
$group = function (string $id, string $icon, string $title, int $count, string $hint, string $rows, int $shown, string $moreText, string $moreHref) {
  return '<div class="dash-group" id="attn-' . h($id) . '" data-group="' . h($id) . '" data-count="' . $count . '">'
    . '<h3 class="dash-group__title">' . icon($icon) . '<span>' . h($title) . '</span><span class="dash-group__count">' . ins_num($count) . '</span>'
    . ($hint !== '' ? '<span class="dash-group__hint">' . h($hint) . '</span>' : '') . '</h3>'
    . '<ul class="list">' . $rows . '</ul>'
    . ($count > $shown ? '<a class="dash-group__more" href="' . h($moreHref) . '">' . h($moreText) . icon('arrow') . '</a>' : '')
    . '</div>';
};

// ── Page header ─────────────────────────────────────────────────────────────

$hour = (int) (new DateTime('now', mfs_tz()))->format('G');
$first = trim((string) (preg_split('/\s+/u', trim((string) $me['name'])) ?: [''])[0]);
$greet = $hour >= 5 && $hour < 12 ? 'Good morning, {name}' : ($hour >= 12 && $hour < 18 ? 'Good afternoon, {name}' : 'Good evening, {name}');
$greeting = $first !== '' ? t($greet, ['name' => $first]) : t('Welcome');
if ($attnTotal > 0) $lead = tp($attnTotal, '{n} thing needs your attention.', '{n} things need your attention.');
elseif ($anyRequest || $anyBooking) $lead = t('Nothing needs your attention right now.');
else $lead = t('Welcome to the team area. Here’s everything at a glance once requests start coming in.');
$dayOne = !$anyRequest && !$anyBooking;

ob_start();
?>
<header class="page-head dash-head">
  <div class="page-head__text">
    <p class="dash-head__date"><?= icon('calendar') ?><span><?= h(ins_long_date($today)) ?></span></p>
    <h1 class="page-head__title"><?= h($greeting) ?></h1>
    <p class="page-head__lead" data-attn-total="<?= $attnTotal ?>"><?php if ($attnTotal > 0): ?><a class="dash-head__jump" href="#attention"><?= h($lead) ?><?= icon('chevron-down') ?></a><?php else: ?><?= h($lead) ?><?php endif; ?></p>
  </div>
  <div class="page-head__actions">
    <a class="btn btn--secondary" href="<?= h(url('requests')) ?>"><?= icon('inbox') ?><?= h(t('Requests')) ?></a>
    <a class="btn btn--primary" href="<?= h(url('booking', ['new' => 1])) ?>"><?= icon('plus') ?><?= h(t('New booking')) ?></a>
  </div>
</header>

<div class="dash<?= $dayOne ? ' dash--new' : '' ?>">
<?php if ($dayOne): ?>
  <section class="card card--accent dash-start" aria-labelledby="dash-start-t">
    <div class="card__head"><div><h2 class="card__title" id="dash-start-t"><?= h(t('Getting started')) ?></h2>
      <p class="card__sub"><?= h(t('Requests sent through the website’s forms arrive here automatically. A few things to check first:')) ?></p></div></div>
    <div class="card__body">
      <ol class="dash-steps">
        <?php if ($owner): ?>
        <li><a href="<?= h(url('settings')) ?>"><span class="dash-steps__icon" aria-hidden="true"><?= icon('settings') ?></span><span><strong><?= h(t('Check your contact details')) ?></strong><span class="muted small"><?= h(t('Email, phone and messengers shown on the website, and who receives the form emails.')) ?></span></span></a></li>
        <li><a href="<?= h(url('tours')) ?>"><span class="dash-steps__icon" aria-hidden="true"><?= icon('tag') ?></span><span><strong><?= h(t('Check tours and prices')) ?></strong><span class="muted small"><?= h(t('Change a price or hide a tour — the website updates within a minute.')) ?></span></span></a></li>
        <li><a href="<?= h(url('users')) ?>"><span class="dash-steps__icon" aria-hidden="true"><?= icon('users') ?></span><span><strong><?= h(t('Invite your team')) ?></strong><span class="muted small"><?= h(t('Give everyone who answers requests their own sign-in.')) ?></span></span></a></li>
        <?php endif; ?>
        <li><a href="../contact" target="_blank" rel="noopener"><span class="dash-steps__icon" aria-hidden="true"><?= icon('send') ?></span><span><strong><?= h(t('Send yourself a test request')) ?></strong><span class="muted small"><?= h(t('Fill in the contact form on the website — it appears under Requests a moment later.')) ?></span></span></a></li>
        <li><a href="<?= h(url('booking', ['new' => 1])) ?>"><span class="dash-steps__icon" aria-hidden="true"><?= icon('suitcase') ?></span><span><strong><?= h(t('Add a booking')) ?></strong><span class="muted small"><?= h(t('Trips agreed by phone or email can be added by hand.')) ?></span></span></a></li>
      </ol>
    </div>
  </section>
<?php endif; ?>

  <section class="dash__kpis" aria-label="<?= h(t('Key figures')) ?>">
    <div class="kpis dash-kpis">
<?php
$newMeta = $newCount > 0 && $newRow['oldest']
  ? '<span>' . h(t('Oldest: {ago}', ['ago' => fmt_ago($newRow['oldest'])])) . '</span>'
  : '<span>' . h($anyRequest ? t('All answered') : t('None yet')) . '</span>';
echo $kpi('gold', 'inbox', t('New requests waiting'), ins_num($newCount), $newMeta, url('requests', ['status' => 'new']), 'new', $newCount);

echo $kpi('wine', 'chart', t('Requests, last 30 days'), ins_num($req30), ins_trend($req30, $reqPrev, t('vs previous 30 days')), url('requests'), 'req30', $req30);

$bkMeta = $quotesOpen > 0 ? '<span>' . h(tp($quotesOpen, '+ {n} quote waiting for an answer', '+ {n} quotes waiting for an answer')) . '</span>'
  : '<span>' . h(t('Booked in {year}', ['year' => $year])) . '</span>';
echo $kpi('green', 'suitcase', t('Confirmed bookings in {year}', ['year' => $year]), ins_num($bkYearN), $bkMeta, url('bookings', ['when' => 'all']), 'bookings', $bkYearN);

$revMeta = $bkYearN > 0 ? '<span>' . h(t('Average {amount} per booking', ['amount' => fmt_money(round($bkYearValue / $bkYearN))])) . '</span>'
  : '<span>' . h(t('Total of confirmed and completed trips')) . '</span>';
echo $kpi('green', 'euro', t('Booked revenue in {year}', ['year' => $year]), fmt_money($bkYearValue), $revMeta, url('bookings', ['when' => 'all']), 'revenue', $bkYearValue);

$payMeta = '<span>' . h(tp($payYearN, '{n} payment since 1 January', '{n} payments since 1 January')) . '</span>';
echo $kpi('green', 'check', t('Payments received in {year}', ['year' => $year]), fmt_money($payYearTotal), $payMeta, '', 'payments', $payYearTotal);

$owMeta = $overdueAmount > BK_EPS
  ? '<span class="trend trend--down">' . h(t('{amount} overdue', ['amount' => fmt_money($overdueAmount)])) . '</span>'
  : '<span>' . h($owingN > 0 ? tp($owingN, 'from {n} confirmed trip', 'from {n} confirmed trips') : t('Nothing owed')) . '</span>';
echo $kpi('gold', 'clock', t('Outstanding balances'), fmt_money($outstanding), $owMeta, url('bookings', ['pay' => $overdueAmount > BK_EPS ? 'overdue' : 'due', 'when' => 'all']), 'outstanding', $outstanding);

if ($vis30 > 0 || $visPrev > 0) $visMeta = ins_trend($vis30, $visPrev, t('vs previous 30 days'));
else $visMeta = '<span>' . h($statsOn ? t('No visits counted yet') : t('Visitor counting is switched off')) . '</span>';
echo $kpi('blue', 'users', t('Visitors, last 30 days'), ins_num($vis30), $visMeta, url('analytics', ['d' => 30]), 'visitors', $vis30);

$rateMeta = '<span>' . h(ins_rate_note($req30, $vis30)) . '</span>';
echo $kpi('blue', 'star', t('Request rate'), $rate30 !== null ? $rate30 : '—', $rateMeta, url('analytics', ['d' => 30]), 'rate', $rate30 !== null ? $rate30 : '');
?>
    </div>
  </section>

  <div class="dash__cols">
  <div class="dash__main">
  <section class="card card--flush dash-attn" id="attention" aria-labelledby="dash-attn-t">
    <div class="card__head">
      <div><h2 class="card__title" id="dash-attn-t"><?= h(t('Needs attention')) ?><?php if ($attnTotal > 0): ?> <span class="badge"><?= ins_num($attnTotal) ?></span><?php endif; ?></h2>
      <p class="card__sub"><?= h($attnTotal > 0 ? t('Open an item to deal with it.') : t('Everything that needs someone to act shows up here.')) ?></p></div>
    </div>
<?php if ($attnTotal === 0 && $mineN === 0): ?>
    <div class="card__body"><?= ins_empty('check', t('You’re all caught up'), $anyRequest || $anyBooking
      ? t('No new requests, follow-ups, payments or departures need you right now.')
      : t('New requests from the website, follow-ups you set, payments falling due and trips about to start will appear here.')) ?></div>
<?php else: ?>
    <nav class="chips dash-attn__chips" aria-label="<?= h(t('Jump to')) ?>">
      <?php if ($newOnlyN): ?><a class="chip" href="#attn-new"><?= h(tp($newOnlyN, '{n} new request', '{n} new requests')) ?></a><?php endif; ?>
      <?php if ($followN): ?><a class="chip" href="#attn-follow"><?= h(tp($followN, '{n} follow-up', '{n} follow-ups')) ?></a><?php endif; ?>
      <?php if ($mineN): ?><a class="chip" href="#attn-mine"><?= h(tp($mineN, '{n} assigned to you', '{n} assigned to you')) ?></a><?php endif; ?>
      <?php if ($payN): ?><a class="chip" href="#attn-pay"><?= h(tp($payN, '{n} payment', '{n} payments')) ?></a><?php endif; ?>
      <?php if ($tripsN): ?><a class="chip" href="#attn-trips"><?= h(tp($tripsN, '{n} trip this week', '{n} trips this week')) ?></a><?php endif; ?>
    </nav>
<?php
  // New requests, oldest first: they've waited longest.
  if ($newOnlyN > 0) {
    $rows = '';
    foreach ($newList as $r) {
      $age = days_until(ins_local_date_of($r['created_at']));
      $waited = $age !== null ? max(0, -$age) : 0;
      $tone = $waited >= 2 ? 'late' : ($waited === 1 ? 'today' : '');
      $rows .= $item([
        'href' => url('request', ['id' => $r['id']]), 'icon' => $kindIcon[$r['kind']] ?? 'inbox', 'tone' => $tone,
        'title' => req_display_name($r),
        'facts' => [
          $waited >= 1 ? [tp($waited, 'Waiting {n} day', 'Waiting {n} days'), $tone] : [t('Received {ago}', ['ago' => fmt_ago($r['created_at'])]), ''],
          t(REQUEST_KINDS[$r['kind']] ?? 'Other'),
        ],
        'note' => req_summary($r), 'aside' => $assignee($r),
      ]);
    }
    echo $group('new', 'inbox', t('New requests to answer'), $newOnlyN, t('oldest first'), $rows, count($newList),
      tp($newOnlyN - count($newList), 'Show {n} more new request', 'Show {n} more new requests'), url('requests', ['status' => 'new']));
  }

  // Follow-ups due today or overdue.
  if ($followN > 0) {
    $rows = '';
    foreach ($follow as $r) {
      $d = days_until($r['follow_up_on']);
      $tone = ($d !== null && $d < 0) ? 'late' : 'today';
      $rows .= $item([
        'href' => url('request', ['id' => $r['id']]), 'icon' => 'clock', 'tone' => $tone,
        'title' => t('Follow up with {name}', ['name' => req_display_name($r)]),
        'facts' => [[req_follow_label((string) $r['follow_up_on']), $tone], ['html' => status_badge($r['status'])]],
        'note' => req_summary($r), 'aside' => $assignee($r),
      ]);
    }
    echo $group('follow', 'clock', t('Follow-ups due'), $followN, '', $rows, count($follow),
      tp($followN - count($follow), 'Show {n} more follow-up', 'Show {n} more follow-ups'), url('requests', ['due' => 1]));
  }

  // Requests someone handed to this person.
  if ($mineN > 0) {
    $rows = '';
    foreach ($mineList as $r) {
      $due = trim((string) $r['follow_up_on']) !== '' ? days_until($r['follow_up_on']) : null;
      $rows .= $item([
        'href' => url('request', ['id' => $r['id'], 'mine' => 1]), 'icon' => 'user', 'tone' => $due !== null && $due < 0 ? 'late' : '',
        'title' => req_display_name($r),
        'facts' => array_values(array_filter([['html' => status_badge($r['status'])],
          trim((string) $r['follow_up_on']) !== '' ? [req_follow_label((string) $r['follow_up_on']), $due !== null && $due < 0 ? 'late' : ''] : null])),
        'note' => req_summary($r),
      ]);
    }
    echo $group('mine', 'user', t('Assigned to you'), $mineN, '', $rows, count($mineList),
      tp($mineN - count($mineList), 'Show {n} more', 'Show {n} more'), url('requests', ['mine' => 1]));
  }

  // Payments: overdue, or due within 14 days (confirmed and completed trips).
  if ($payN > 0) {
    $rows = '';
    $anyLate = false;
    foreach ($payItems as $p) if ($p['m']['due']['overdue']) $anyLate = true;
    foreach (array_slice($payItems, 0, 5) as $p) {
      $b = $p['b'];
      $due = $p['m']['due'];
      $tone = $due['overdue'] ? 'late' : (($due['days'] !== null && $due['days'] <= 3) ? 'today' : 'soon');
      $dates = bk_dates_label($b['start_date'], $b['end_date'], false);
      $rows .= $item([
        'href' => url('booking', ['id' => $b['id']]), 'icon' => 'euro', 'tone' => $tone,
        'title' => (string) $b['client_name'],
        'sub' => bk_tour_label($b, false) . ($dates !== '' ? ' · ' . $dates : ''),
        'facts' => [[$dueShort($due), $tone === 'soon' ? '' : $tone], (string) $b['ref']],
        'aside' => '<span class="dash-amount" data-amount="' . h(ins_c((float) $due['amount'])) . '">' . h(fmt_money($due['amount'])) . '</span>',
      ]);
    }
    echo $group('pay', 'euro', t('Payments due or overdue'), $payN, t('next 14 days'), $rows, min(5, $payN),
      tp($payN - 5, 'Show {n} more payment', 'Show {n} more payments'), url('bookings', ['pay' => $anyLate ? 'overdue' : 'due', 'when' => 'all']));
  }

  // Trips starting within 7 days, with what still needs doing.
  if ($tripsN > 0) {
    $rows = '';
    foreach (array_slice($tripsSoon, 0, 5) as $b) {
      $d = days_until($b['start_date']);
      $m = bk_money($b);
      $when = $d === 0 ? t('Starts today') : ($d === 1 ? t('Starts tomorrow') : tp((int) $d, 'Starts in {n} day', 'Starts in {n} days'));
      $tone = $d !== null && $d <= 1 ? 'today' : 'soon';
      $facts = [[$when, $tone === 'today' ? 'today' : ''], bk_dates_label($b['start_date'], $b['end_date'], false), bk_party_label($b['adults'], $b['children'])];
      if ($b['status'] === 'quote') {
        $facts[] = [t('Not confirmed yet'), 'late'];
        $tone = 'late';
      }
      if (trim((string) $b['guide']) === '') $facts[] = [t('No guide yet'), 'warn'];
      if ($m['balance'] > BK_EPS) $facts[] = [t('{amount} still to pay', ['amount' => fmt_money($m['balance'])]), $m['due'] && $m['due']['overdue'] ? 'late' : 'warn'];
      $rows .= $item([
        'href' => url('booking', ['id' => $b['id']]), 'icon' => 'suitcase', 'tone' => $tone,
        'title' => (string) $b['client_name'], 'sub' => bk_tour_label($b), 'facts' => $facts,
      ]);
    }
    echo $group('trips', 'suitcase', t('Trips starting within 7 days'), $tripsN, '', $rows, min(5, $tripsN),
      tp($tripsN - 5, 'Show {n} more trip', 'Show {n} more trips'), url('calendar'));
  }
endif; ?>
  </section>

  <section class="card card--flush dash-latest" aria-labelledby="dash-latest-t">
    <div class="card__head">
      <div><h2 class="card__title" id="dash-latest-t"><?= h(t('Latest requests')) ?></h2><p class="card__sub"><?= h(t('Newest first · spam left out')) ?></p></div>
      <div class="card__actions"><a class="btn btn--ghost btn--sm" href="<?= h(url('requests')) ?>"><?= icon('inbox') ?><?= h(t('All requests')) ?></a></div>
    </div>
<?php if (!$latest): ?>
    <div class="card__body"><?= ins_empty('inbox', t('No requests yet'), t('When someone sends a form on the website, it appears here and under Requests, and you get an email.')) ?></div>
<?php else: ?>
    <ul class="list">
<?php foreach ($latest as $r) {
  $unread = empty($r['read_at']);
  echo $item([
    'href' => url('request', ['id' => $r['id']]), 'icon' => $kindIcon[$r['kind']] ?? 'inbox', 'class' => 'dash-req' . ($unread ? ' is-unread' : ''),
    'title_html' => $unread ? '<span class="dash-unread" aria-hidden="true"></span><span class="sr-only">' . h(t('Not opened yet')) . ': </span>' : '',
    'title' => req_display_name($r),
    'facts' => [['html' => status_badge($r['status'])], t(REQUEST_KINDS[$r['kind']] ?? 'Other'), fmt_ago($r['created_at'])],
    'note' => req_summary($r), 'aside' => $assignee($r),
  ]);
} ?>
    </ul>
<?php endif; ?>
  </section>
  </div>

  <div class="dash__side">
  <section class="card card--flush dash-trips" aria-labelledby="dash-trips-t">
    <div class="card__head">
      <div><h2 class="card__title" id="dash-trips-t"><?= h(t('Upcoming trips')) ?></h2><p class="card__sub"><?= h(t('Next 60 days')) ?><?= $upN ? ' · ' . h(tp($upN, '{n} trip', '{n} trips')) : '' ?></p></div>
      <div class="card__actions"><a class="btn btn--ghost btn--sm" href="<?= h(url('calendar')) ?>"><?= icon('calendar') ?><?= h(t('Calendar')) ?></a></div>
    </div>
<?php if (!$upcoming): ?>
    <div class="card__body"><?= ins_empty('suitcase', t('No trips in the next 60 days'), t('Confirmed bookings and quotes with dates show up here.'),
      '<div class="btn-row btn-row--center"><a class="btn btn--secondary btn--sm" href="' . h(url('booking', ['new' => 1])) . '">' . icon('plus') . h(t('New booking')) . '</a></div>') ?></div>
<?php else: ?>
    <ul class="list">
<?php foreach ($upcoming as $b) {
  list($whenText, $whenTone) = bk_when($b);
  $sd = DateTime::createFromFormat('!Y-m-d', (string) $b['start_date'], mfs_tz());
  $badge = '<span class="dash-date' . ($whenTone === 'now' ? ' dash-date--now' : '') . '" aria-hidden="true"><span class="dash-date__d">' . ($sd ? h($sd->format('j')) : '?')
    . '</span><span class="dash-date__m">' . ($sd ? h(ins_month_short((int) $sd->format('n'))) : '') . '</span></span>';
  $facts = [['html' => status_badge($b['status'], 'booking')], bk_dates_label($b['start_date'], $b['end_date'], false), bk_party_label($b['adults'], $b['children'])];
  if ($whenText !== '') $facts[] = [$whenText, $whenTone === 'now' ? 'now' : ($whenTone === 'soon' ? 'today' : '')];
  echo $item([
    'href' => url('booking', ['id' => $b['id']]), 'lead' => $badge, 'class' => 'dash-trip',
    'title' => (string) $b['client_name'], 'sub' => bk_tour_label($b), 'facts' => $facts,
  ]);
} ?>
    </ul>
<?php if ($upN > count($upcoming)): ?>
    <div class="card__foot"><a class="btn btn--link" href="<?= h(url('bookings')) ?>"><?= h(tp($upN - count($upcoming), 'Show {n} more upcoming trip', 'Show {n} more upcoming trips')) ?><?= icon('arrow') ?></a></div>
<?php endif; ?>
<?php endif; ?>
  </section>

  <section class="card dash-tours" aria-labelledby="dash-tours-t">
    <div class="card__head"><div><h2 class="card__title" id="dash-tours-t"><?= h(t('Most requested tours')) ?></h2><p class="card__sub"><?= h(t('Requests naming a tour, last 12 months')) ?></p></div></div>
    <div class="card__body">
<?php
$tourRows = [];
$cat = tours();
foreach ($cat as $id => $tr) {
  $n = $tourReq[$id] ?? 0;
  $bkd = $tourBooked[$id] ?? 0;
  $tourRows[] = ['label' => tour_name($id), 'value' => $n, 'note' => $bkd > 0 ? tp($bkd, '{n} booked', '{n} booked') : '',
    'sub' => $tr['hidden'] ? t('Hidden on the website') : '', 'muted' => $n === 0, 'href' => url('requests', ['q' => $tr['name']])];
}
foreach ($tourReq as $id => $n) {
  if (isset($cat[$id])) continue;
  $bkd = $tourBooked[$id] ?? 0;
  $tourRows[] = ['label' => tour_name($id), 'value' => $n, 'note' => $bkd > 0 ? tp($bkd, '{n} booked', '{n} booked') : '', 'sub' => t('No longer on the website'), 'muted' => false];
}
usort($tourRows, function ($a, $b) {
  if ($a['value'] !== $b['value']) return $a['value'] > $b['value'] ? -1 : 1;
  return strcasecmp($a['label'], $b['label']);
});
if (array_sum(array_column($tourRows, 'value')) === 0) {
  echo ins_empty('tag', t('No tour requests yet'), t('When a request names one of your tours, it’s counted here.'));
} else {
  echo ins_bar_list($tourRows, ['tone' => 'wine', 'unit' => function ($n) { return tp((int) $n, '{n} request', '{n} requests'); }]);
}
?>
    </div>
  </section>
  </div>
  </div>

  <div class="dash__charts grid grid--2">
    <section class="card dash-chart">
      <?= ins_column_chart([
        'id' => 'dash-weeks',
        'title' => t('Requests per week'),
        'sub' => tp($req12w, '{n} in the last 12 weeks', '{n} in the last 12 weeks'),
        'desc' => t('Requests received each week over the last 12 weeks: {total} in all, {booked} of them now booked. This week so far: {now}.', [
          'total' => ins_num($req12w), 'booked' => ins_num(array_sum($weekBooked)), 'now' => ins_num($weekTotals[11]),
        ]),
        'labels' => $weekLabels,
        'axis' => $weekAxis,
        'steps' => [2, 2, 1],
        'series' => [
          ['name' => t('Became bookings'), 'values' => $weekBooked, 'type' => 'bar', 'tone' => 'green'],
          ['name' => t('Other requests'), 'values' => $weekReq, 'type' => 'bar', 'tone' => 'gold'],
        ],
        'partial' => 11,
        'partial_label' => t('This week so far'),
        'table_head' => t('Week starting'),
        'tip' => function ($i) use ($weekLabels, $weekTotals, $weekBooked) {
          $lead = $i === 11 ? t('This week so far') : $weekLabels[$i];
          return $lead . ' — ' . tp($weekTotals[$i], '{n} request', '{n} requests') . ($weekBooked[$i] > 0 ? ' · ' . tp($weekBooked[$i], '{n} became a booking', '{n} became bookings') : '');
        },
        'empty' => t('No requests in the last 12 weeks yet.'),
      ]) ?>
    </section>
    <section class="card dash-chart">
      <?= ins_column_chart([
        'id' => 'dash-visits',
        'title' => t('Visitors per day'),
        'sub' => t('{visitors} visitors · {views} page views in 30 days', ['visitors' => ins_num($vis30), 'views' => ins_num($views30)]),
        'desc' => t('Visitors to the website each day over the last 30 days: {total} in all.', ['total' => ins_num($vis30)]),
        'labels' => $dayLabels,
        'axis' => $dayAxis,
        'steps' => [7, 7, 7],
        'series' => [['name' => t('Visitors'), 'values' => $visVals, 'type' => 'bar', 'tone' => 'blue']],
        'partial' => 29,
        'partial_label' => t('Today so far'),
        'table_head' => t('Day'),
        'tip' => function ($i) use ($dayLabels, $visVals) {
          return ($i === 29 ? t('Today so far') : $dayLabels[$i]) . ' — ' . tp($visVals[$i], '{n} visitor', '{n} visitors');
        },
        'empty' => $statsOn ? t('No visits counted in the last 30 days yet.') : t('Visitor counting is switched off.'),
        'empty_html' => (!$statsOn && $owner) ? '<a class="btn btn--secondary btn--sm" href="' . h(url('settings')) . '">' . icon('settings') . h(t('Open settings')) . '</a>' : '',
      ]) ?>
      <p class="dash-chart__foot"><a href="<?= h(url('analytics')) ?>"><?= h(t('More statistics')) ?><?= icon('arrow') ?></a></p>
    </section>
  </div>
</div>
<?php
render(t('Dashboard'), ob_get_clean(), [
  'nav' => 'dashboard',
  'head' => false,
  'css' => ['charts.css', 'dashboard.css'],
  'js' => ['charts.js'],
]);
