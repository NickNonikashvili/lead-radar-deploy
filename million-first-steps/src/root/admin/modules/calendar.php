<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
/*
 * Calendar (?p=calendar[&m=YYYY-MM][&cancelled=1]): the month's trips as bars across their days (Monday
 * first), coloured by status; on phones an agenda list of the month instead. Below: the next departures
 * and the payments due that month. Shared helpers: modules/bookings-lib.php · styles: assets/calendar.css.
 */
$me = require_login();
require_once __DIR__ . '/bookings-lib.php';

$today = local_today();
$m = get('m');
if (!preg_match('/^(\d{4})-(\d{2})$/', $m, $mm) || (int) $mm[2] < 1 || (int) $mm[2] > 12 || (int) $mm[1] < 2000 || (int) $mm[1] > 2099) $m = substr($today, 0, 7);
$year = (int) substr($m, 0, 4);
$month = (int) substr($m, 5, 2);
$first = sprintf('%04d-%02d-01', $year, $month);
$utc = new DateTimeZone('UTC');
$firstDt = DateTime::createFromFormat('!Y-m-d', $first, $utc);
$last = sprintf('%04d-%02d-%02d', $year, $month, (int) $firstDt->format('t'));
$lastDt = DateTime::createFromFormat('!Y-m-d', $last, $utc);
$gridStart = bk_add_days($first, -((int) $firstDt->format('N') - 1));
$gridEnd = bk_add_days($last, 7 - (int) $lastDt->format('N'));
$prevM = substr(bk_add_days($first, -1), 0, 7);
$nextM = substr(bk_add_days($last, 1), 0, 7);
$isThisMonth = $m === substr($today, 0, 7);
$showCancelled = get('cancelled') === '1';
$monthTitle = bk_month_long($month) . ' ' . $year;

$rows = db_all('SELECT b.*, COALESCE(pp.paid, 0) AS paid FROM bookings b ' . BK_PAID_JOIN
  . " WHERE b.start_date IS NOT NULL AND b.start_date <> '' AND b.start_date <= ? AND " . BK_END_SQL . ' >= ?'
  . ($showCancelled ? '' : " AND b.status <> 'cancelled'")
  . ' ORDER BY b.start_date, b.id', [$gridEnd, $gridStart]);
// Every trip's first and last day (a last day before the first, from old data, counts as one day).
foreach ($rows as &$r) {
  $r['_s'] = bk_valid_date($r['start_date']);
  $e = bk_end($r);
  $r['_e'] = ($e === '' || $e < $r['_s']) ? $r['_s'] : $e;
}
unset($r);
$inMonth = array_values(array_filter($rows, function ($r) use ($first, $last) { return $r['_s'] <= $last && $r['_e'] >= $first; }));
$cancelledCount = $showCancelled ? 0 : (int) db_value("SELECT COUNT(*) FROM bookings b WHERE b.status = 'cancelled' AND b.start_date IS NOT NULL AND b.start_date <> '' AND b.start_date <= ? AND " . BK_END_SQL . ' >= ?', [$last, $first]);
$noDates = (int) db_value("SELECT COUNT(*) FROM bookings WHERE status <> 'cancelled' AND (start_date IS NULL OR start_date = '')");

$barLabel = function (array $b) {
  return $b['ref'] . ' · ' . $b['client_name'] . ' · ' . bk_tour_label($b) . ' · ' . bk_dates_label($b['_s'], $b['_e'])
    . ' · ' . bk_party_label($b['adults'], $b['children']) . ' · ' . t(BOOKING_STATUSES[$b['status']] ?? $b['status']);
};
$statusClass = function ($s) { return isset(BOOKING_STATUSES[$s]) ? $s : 'quote'; };

$filterParams = ['cancelled' => $showCancelled ? 1 : null];
$actions = '<a class="btn btn--secondary" href="' . h(url('bookings')) . '">' . icon('suitcase') . h(t('All bookings')) . '</a>'
  . '<a class="btn btn--primary" href="' . h(url('booking', ['new' => 1])) . '">' . icon('plus') . h(t('New booking')) . '</a>';

ob_start(); ?>
<section class="card bk-cal-card" aria-labelledby="cal-title">
  <div class="cal bk-cal">
    <div class="cal__nav bk-cal__nav">
      <div class="bk-cal__heading">
        <h2 class="cal__title" id="cal-title"><?= h($monthTitle) ?></h2>
        <p class="bk-cal__count"><?php
          $people = 0;
          foreach ($inMonth as $b) if ($b['status'] !== 'cancelled') $people += (int) $b['adults'] + (int) $b['children'];
          $trips = count(array_filter($inMonth, function ($b) { return $b['status'] !== 'cancelled'; }));
          echo $trips ? h(tp($trips, '{n} trip', '{n} trips') . ' · ' . tp($people, '{n} traveller', '{n} travellers')) : h(t('No trips this month'));
        ?></p>
      </div>
      <div class="btn-row bk-cal__steps">
        <a class="btn btn--secondary btn--icon" href="<?= h(url('calendar', ['m' => $prevM] + $filterParams)) ?>" rel="prev" aria-label="<?= h(t('Previous month')) ?>" title="<?= h(t('Previous month')) ?>"><?= icon('chevron-left') ?></a>
        <a class="btn btn--secondary<?= $isThisMonth ? ' is-current' : '' ?>" href="<?= h(url('calendar', $filterParams)) ?>"<?= $isThisMonth ? ' aria-current="date"' : '' ?>><?= h(t('Today')) ?></a>
        <a class="btn btn--secondary btn--icon" href="<?= h(url('calendar', ['m' => $nextM] + $filterParams)) ?>" rel="next" aria-label="<?= h(t('Next month')) ?>" title="<?= h(t('Next month')) ?>"><?= icon('chevron-right') ?></a>
      </div>
    </div>

    <form class="bk-cal__tools" method="get" action="index.php">
      <input type="hidden" name="p" value="calendar">
      <div class="bk-cal__jump">
        <label class="field__label" for="cal-m"><?= h(t('Go to month')) ?></label>
        <input class="input input--sm" type="month" id="cal-m" name="m" value="<?= h($m) ?>" min="2000-01" max="2099-12" data-autosubmit>
        <noscript><button type="submit" class="btn btn--secondary btn--sm"><?= h(t('Show')) ?></button></noscript>
      </div>
      <label class="check bk-cal__check"><input type="checkbox" name="cancelled" value="1"<?= $showCancelled ? ' checked' : '' ?> data-autosubmit><span class="check__box"><?= icon('check') ?></span><span class="check__label"><?= h(t('Show cancelled trips')) ?><?php if ($cancelledCount) { ?><span class="check__help"><?= h(tp($cancelledCount, '{n} this month', '{n} this month')) ?></span><?php } ?></span></label>
      <ul class="bk-cal__legend" aria-label="<?= h(t('Colours')) ?>">
        <?php foreach (BOOKING_STATUSES as $k => $label) { if ($k === 'cancelled' && !$showCancelled) continue; ?>
          <li><span class="bk-key bk-key--<?= h($k) ?>" aria-hidden="true"></span><?= h(t($label)) ?></li>
        <?php } ?>
      </ul>
    </form>

    <?php // ── Month grid (tablets and computers) ── ?>
    <div class="bk-month" role="group" aria-label="<?= h(t('Trips in {month}', ['month' => $monthTitle])) ?>">
      <div class="bk-month__dows" aria-hidden="true">
        <?php for ($i = 1; $i <= 7; $i++) echo '<div class="cal__dow' . ($i >= 6 ? ' is-weekend' : '') . '">' . h(bk_weekday_short($i)) . '</div>'; ?>
      </div>
      <?php
      for ($ws = $gridStart; $ws <= $gridEnd; $ws = bk_add_days($ws, 7)) {
        $we = bk_add_days($ws, 6);
        // This week's pieces of each trip, placed in the first free lane.
        $segs = [];
        foreach ($rows as $b) {
          if ($b['_s'] > $we || $b['_e'] < $ws) continue;
          $s = max($b['_s'], $ws);
          $e = min($b['_e'], $we);
          $segs[] = ['b' => $b, 'col' => bk_days_between($ws, $s) + 1, 'span' => bk_days_between($s, $e) + 1, 'start' => $b['_s'] >= $ws, 'end' => $b['_e'] <= $we];
        }
        usort($segs, function ($x, $y) { return [$x['col'], -$x['span']] <=> [$y['col'], -$y['span']]; });
        $laneEnd = [];
        foreach ($segs as &$sg) {
          $lane = 0;
          while (isset($laneEnd[$lane]) && $laneEnd[$lane] >= $sg['col']) $lane++;
          $laneEnd[$lane] = $sg['col'] + $sg['span'] - 1;
          $sg['lane'] = $lane;
        }
        unset($sg);
        $lanes = count($laneEnd);
        echo '<div class="bk-month__week" style="grid-template-rows: 36px' . ($lanes ? ' repeat(' . $lanes . ', 28px)' : '') . ' minmax(12px, 1fr)">';
        for ($i = 0; $i < 7; $i++) {
          $day = bk_add_days($ws, $i);
          $cls = 'bk-month__day';
          if (substr($day, 0, 7) !== $m) $cls .= ' is-other';
          if ($i >= 5) $cls .= ' is-weekend';
          if ($day === $today) $cls .= ' is-today';
          $label = t('New booking starting {date}', ['date' => fmt_date($day)]);
          echo '<div class="' . $cls . '" style="grid-column: ' . ($i + 1) . '">'
            . '<a class="cal__num bk-month__num" href="' . h(url('booking', ['new' => 1, 'start' => $day])) . '" title="' . h($label) . '" aria-label="' . h($label) . '"'
            . ($day === $today ? ' aria-current="date"' : '') . '>' . (int) substr($day, 8, 2) . '</a></div>';
        }
        foreach ($segs as $sg) {
          $b = $sg['b'];
          $cls = 'cal__bar cal__bar--' . $statusClass($b['status']) . ($sg['start'] ? ' is-start' : '') . ($sg['end'] ? ' is-end' : '');
          $text = $b['client_name'];
          if ($sg['span'] >= 2) $text .= ' · ' . bk_tour_label($b, false);
          echo '<a class="' . $cls . ' bk-bar" href="' . h(url('booking', ['id' => (int) $b['id']])) . '" style="grid-column: ' . $sg['col'] . ' / span ' . $sg['span'] . '; grid-row: ' . ($sg['lane'] + 2) . '"'
            . ' title="' . h($barLabel($b)) . '" aria-label="' . h($barLabel($b)) . '">'
            . (!$sg['start'] ? '<span class="bk-bar__cont" aria-hidden="true">' . icon('chevron-left') . '</span>' : '')
            . '<span class="bk-bar__text">' . h($text) . '</span></a>';
        }
        echo '</div>';
      } ?>
    </div>

    <p class="bk-cal__tip"><?= icon('info') ?><?= h(t('Tip: click the number of a day to start a new booking on that date.')) ?></p>

    <?php // ── Agenda (phones) ── ?>
    <div class="cal__list bk-agenda-wrap">
      <?php if ($inMonth) { ?>
        <ol class="bk-agenda" aria-label="<?= h(t('Trips in {month}', ['month' => $monthTitle])) ?>">
          <?php foreach ($inMonth as $b) {
            $s = $b['_s'];
            $before = $s < $first;
            $sd = DateTime::createFromFormat('!Y-m-d', $s, $utc);
            list($whenText, $whenTone) = bk_when($b);
            $mo = bk_money($b); ?>
            <li>
              <a class="bk-agenda__item bk-agenda__item--<?= h($statusClass($b['status'])) ?>" href="<?= h(url('booking', ['id' => (int) $b['id']])) ?>">
                <span class="bk-datebadge<?= $before ? ' bk-datebadge--before' : '' ?><?= $s === $today ? ' is-today' : '' ?>" aria-hidden="true">
                  <span class="bk-datebadge__wd"><?= h($before ? t('since') : bk_weekday_short((int) $sd->format('N'))) ?></span>
                  <span class="bk-datebadge__d"><?= (int) $sd->format('j') ?></span>
                  <span class="bk-datebadge__m"><?= h(bk_month_short((int) $sd->format('n'))) ?></span>
                </span>
                <span class="bk-agenda__main">
                  <span class="bk-agenda__title"><?= h($b['client_name']) ?></span>
                  <span class="bk-agenda__meta"><?= h(bk_tour_label($b)) ?></span>
                  <span class="bk-agenda__meta"><?= h(bk_dates_label($b['_s'], $b['_e'], false)) ?> · <?= h(tp(bk_trip_days($b), '{n} day', '{n} days')) ?> · <?= h(tp((int) $b['adults'] + (int) $b['children'], '{n} traveller', '{n} travellers')) ?></span>
                  <span class="bk-agenda__pills"><?= status_badge($b['status'], 'booking') ?><?php if (!empty($mo['due']['overdue'])) echo bk_pay_pill($mo); ?><?php if ($whenText !== '' && $whenTone !== 'past') { ?><span class="bk-when bk-when--<?= h($whenTone ?: 'plain') ?>"><?= h($whenText) ?></span><?php } ?></span>
                </span>
                <span class="bk-agenda__go" aria-hidden="true"><?= icon('chevron-right') ?></span>
              </a>
            </li>
          <?php } ?>
        </ol>
      <?php } else { ?>
        <div class="empty empty--sm">
          <div class="empty__mark" aria-hidden="true"><?= icon('calendar') ?></div>
          <p class="empty__title"><?= h(t('No trips in {month}', ['month' => $monthTitle])) ?></p>
          <p class="empty__text"><?= h(t('Use the arrows to look at other months.')) ?></p>
        </div>
      <?php } ?>
    </div>
  </div>
</section>

<?php if ($noDates) { ?>
  <div class="callout callout--info bk-cal__nodates"><?= icon('info') ?><p><?= h(tp($noDates, '{n} booking has no dates yet, so it isn’t on the calendar.', '{n} bookings have no dates yet, so they aren’t on the calendar.')) ?> <a href="<?= h(url('bookings', ['when' => 'nodate'])) ?>"><?= h(t('Show them')) ?></a></p></div>
<?php }

// ── Next departures & payments due ──
$next = db_all('SELECT b.*, COALESCE(pp.paid, 0) AS paid FROM bookings b ' . BK_PAID_JOIN
  . " WHERE b.start_date >= ? AND b.status IN ('quote', 'confirmed') ORDER BY b.start_date, b.id LIMIT 6", [$today]);
$dueRows = db_all('SELECT b.*, COALESCE(pp.paid, 0) AS paid FROM bookings b ' . BK_PAID_JOIN
  . " WHERE b.status <> 'cancelled' AND b.total_price - COALESCE(pp.paid, 0) > " . BK_EPS
  . " AND ((b.deposit_due BETWEEN ? AND ?) OR (b.balance_due BETWEEN ? AND ?) OR ? = 1)", [$first, $last, $first, $last, $isThisMonth ? 1 : 0]);
$due = [];
foreach ($dueRows as $b) {
  $mo = bk_money($b);
  if ($mo['due'] === null) continue;
  $d = $mo['due']['date'];
  $inThis = $d !== '' && $d >= $first && $d <= $last;
  if (!$inThis && !($isThisMonth && $mo['due']['overdue'])) continue;
  $due[] = ['b' => $b, 'm' => $mo, 'sort' => $d !== '' ? $d : '0000'];
}
usort($due, function ($x, $y) { return strcmp($x['sort'], $y['sort']); });
$dueTotal = count($due);
$due = array_slice($due, 0, 8);
?>
<div class="grid grid--2 bk-cal__below">
  <section class="card" aria-labelledby="next-h">
    <div class="card__head"><div><h2 class="card__title" id="next-h"><?= h(t('Next departures')) ?></h2><p class="card__sub"><?= h(t('Quotes and confirmed trips from today')) ?></p></div></div>
    <?php if ($next) { ?>
      <ul class="list">
        <?php foreach ($next as $b) {
          $sd = DateTime::createFromFormat('!Y-m-d', $b['start_date'], $utc);
          list($whenText, $whenTone) = bk_when($b); ?>
          <li><a class="list__item" href="<?= h(url('booking', ['id' => (int) $b['id']])) ?>">
            <span class="bk-datebadge bk-datebadge--sm<?= $b['start_date'] === $today ? ' is-today' : '' ?>" aria-hidden="true"><span class="bk-datebadge__d"><?= (int) $sd->format('j') ?></span><span class="bk-datebadge__m"><?= h(bk_month_short((int) $sd->format('n'))) ?></span></span>
            <span class="list__main"><span class="list__title"><?= h($b['client_name']) ?></span><span class="list__meta"><?= h(bk_tour_label($b, false)) ?> · <?= h(tp((int) $b['adults'] + (int) $b['children'], '{n} traveller', '{n} travellers')) ?></span></span>
            <span class="list__aside bk-next__aside"><?= status_badge($b['status'], 'booking') ?><span class="bk-when bk-when--<?= h($whenTone ?: 'plain') ?>"><?= h($whenText) ?></span></span>
          </a></li>
        <?php } ?>
      </ul>
    <?php } else { ?>
      <div class="card__body"><p class="bk-empty-line"><?= h(t('No trips coming up yet. Quotes and confirmed bookings with dates appear here.')) ?></p></div>
    <?php } ?>
  </section>

  <section class="card" aria-labelledby="due-h">
    <div class="card__head"><div><h2 class="card__title" id="due-h"><?= h(t('Payments due in {month}', ['month' => $monthTitle])) ?></h2><p class="card__sub"><?= h($isThisMonth ? t('Deposits and balances to collect this month, and any that are late') : t('Deposits and balances with a due date this month')) ?></p></div></div>
    <?php if ($due) { ?>
      <ul class="list">
        <?php foreach ($due as $it) {
          $b = $it['b'];
          $mo = $it['m']; ?>
          <li><a class="list__item" href="<?= h(url('booking', ['id' => (int) $b['id']])) ?>#payments">
            <span class="list__icon<?= $mo['due']['overdue'] ? ' bk-icon--late' : '' ?>" aria-hidden="true"><?= icon($mo['due']['overdue'] ? 'alert' : 'euro') ?></span>
            <span class="list__main"><span class="list__title"><?= h($b['client_name']) ?> <span class="muted small">· <?= h($b['ref']) ?></span></span><span class="list__meta"><?= h(bk_due_text($mo['due'])) ?></span></span>
            <span class="list__aside"><span class="strong<?= $mo['due']['overdue'] ? ' bk-balance--late' : '' ?>"><?= h(fmt_money($mo['due']['amount'])) ?></span></span>
          </a></li>
        <?php } ?>
      </ul>
      <?php if ($dueTotal > count($due)) { ?>
        <div class="card__foot card__foot--between"><span class="muted small"><?= h(t('{shown} of {n} shown', ['shown' => count($due), 'n' => $dueTotal])) ?></span><a class="btn btn--secondary btn--sm" href="<?= h(url('bookings', ['when' => 'all', 'pay' => $isThisMonth ? 'overdue' : 'due'])) ?>"><?= h($isThisMonth ? t('All overdue payments') : t('All money to collect')) ?></a></div>
      <?php } ?>
    <?php } else { ?>
      <div class="card__body"><p class="bk-empty-line"><?= h(t('Nothing due this month.')) ?></p></div>
    <?php } ?>
  </section>
</div>
<?php
render(t('Calendar'), ob_get_clean(), [
  'nav' => 'calendar',
  'css' => ['bookings.css', 'calendar.css'],
  'actions' => $actions,
]);
