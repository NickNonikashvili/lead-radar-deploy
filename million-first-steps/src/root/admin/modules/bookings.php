<?php
/*
 * Bookings (?p=bookings): every booking with its payments. Filters travel in the query string:
 *   status = quote|confirmed|completed|cancelled (tabs) · when = upcoming (default) | past | nodate | all
 *   pay = due | overdue | paid · sort = new (recently added; default: by trip date) · q = search · page = N
 * Shared helpers: modules/bookings-lib.php.
 */
$me = require_login();
require_once __DIR__ . '/bookings-lib.php';

$f = bk_filters();
$page = max(1, get_int('page', 1));
$from = 'FROM bookings b ' . BK_PAID_JOIN;

list($where, $args) = bk_where($f);
$total = (int) db_value("SELECT COUNT(*) $from WHERE $where", $args);
$pages = max(1, (int) ceil($total / BK_PER_PAGE));
$page = min($page, $pages);
$rows = db_all("SELECT b.*, COALESCE(pp.paid, 0) AS paid, COALESCE(pp.pay_n, 0) AS pay_n $from WHERE $where ORDER BY " . bk_order($f)
  . ' LIMIT ' . BK_PER_PAGE . ' OFFSET ' . (($page - 1) * BK_PER_PAGE), $args);

// Counts for the status tabs (same filters, any status).
list($w2, $a2) = bk_where($f, false);
$counts = ['' => 0];
foreach (BOOKING_STATUSES as $k => $label) $counts[$k] = 0;
foreach (db_all("SELECT b.status, COUNT(*) AS n $from WHERE $w2 GROUP BY b.status", $a2) as $r) {
  if (isset($counts[$r['status']])) $counts[$r['status']] = (int) $r['n'];
  $counts[''] += (int) $r['n'];
}

// Totals of the current selection (cancelled bookings don't count towards money or travellers).
$sum = db_row("SELECT COUNT(*) AS n,
    SUM(CASE WHEN b.status <> 'cancelled' THEN b.adults + b.children ELSE 0 END) AS people,
    SUM(CASE WHEN b.status <> 'cancelled' THEN b.total_price ELSE 0 END) AS value,
    SUM(CASE WHEN b.status <> 'cancelled' THEN COALESCE(pp.paid, 0) ELSE 0 END) AS paid,
    SUM(CASE WHEN b.status <> 'cancelled' AND b.total_price - COALESCE(pp.paid, 0) > " . BK_EPS . " THEN b.total_price - COALESCE(pp.paid, 0) ELSE 0 END) AS outstanding
  $from WHERE $where", $args) ?: [];
$anyBooking = (int) db_value('SELECT COUNT(*) FROM bookings') > 0;
$isDefault = $f['status'] === '' && $f['when'] === 'upcoming' && $f['pay'] === '' && $f['q'] === '' && $f['sort'] === '';

$actions = '<a class="btn btn--secondary" href="' . h(url('calendar')) . '">' . icon('calendar') . h(t('Calendar')) . '</a>'
  . '<a class="btn btn--primary" href="' . h(url('booking', ['new' => 1])) . '">' . icon('plus') . h(t('New booking')) . '</a>';

ob_start();

if (!$anyBooking) { ?>
  <section class="card empty">
    <div class="empty__mark" aria-hidden="true"><?= icon('suitcase') ?></div>
    <h2 class="empty__title"><?= h(t('No bookings yet')) ?></h2>
    <p class="empty__text"><?= h(t('When a request turns into a trip, open it and choose “Create booking” — or add a booking here yourself. Payments, dates and the team for each trip are kept with it.')) ?></p>
    <div class="btn-row btn-row--center">
      <a class="btn btn--primary" href="<?= h(url('booking', ['new' => 1])) ?>"><?= icon('plus') ?><?= h(t('New booking')) ?></a>
      <a class="btn btn--secondary" href="<?= h(url('requests')) ?>"><?= icon('inbox') ?><?= h(t('Go to requests')) ?></a>
    </div>
  </section>
<?php
} else {
  // ── Status tabs ──
  $tabs = ['' => t('All')];
  foreach (BOOKING_STATUSES as $k => $label) $tabs[$k] = t($label);
  echo '<nav class="tabs" aria-label="' . h(t('Booking status')) . '">';
  foreach ($tabs as $k => $label) {
    $on = $f['status'] === $k;
    echo '<a class="tab' . ($on ? ' is-active' : '') . '" href="' . h(url('bookings', bk_params($f, ['status' => $k]))) . '"' . ($on ? ' aria-current="page"' : '') . '>'
      . h($label) . ' <span class="tab__count">' . number_format($counts[$k]) . '</span></a>';
  }
  echo '</nav>';

  // ── Filters ── ?>
  <form class="toolbar" method="get" action="index.php" role="search">
    <input type="hidden" name="p" value="bookings">
    <?php if ($f['status'] !== '') { ?><input type="hidden" name="status" value="<?= h($f['status']) ?>"><?php } ?>
    <div class="toolbar__search search">
      <?= icon('search') ?>
      <label class="sr-only" for="bk-q"><?= h(t('Search bookings')) ?></label>
      <input class="input" type="search" id="bk-q" name="q" value="<?= h($f['q']) ?>" placeholder="<?= h(t('Client, ref, phone, tour, guide…')) ?>" autocomplete="off" enterkeyhint="search">
    </div>
    <div class="toolbar__group">
      <label class="sr-only" for="bk-when"><?= h(t('Trip dates')) ?></label>
      <select class="select" id="bk-when" name="when" data-autosubmit>
        <?php foreach (['upcoming' => t('Upcoming'), 'past' => t('Past trips'), 'nodate' => t('No dates yet'), 'all' => t('All dates')] as $k => $label) { ?>
          <option value="<?= h($k) ?>"<?= $f['when'] === $k ? ' selected' : '' ?>><?= h($label) ?></option>
        <?php } ?>
      </select>
      <label class="sr-only" for="bk-pay"><?= h(t('Payments')) ?></label>
      <select class="select" id="bk-pay" name="pay" data-autosubmit>
        <?php foreach (['' => t('Any payment'), 'due' => t('To collect'), 'overdue' => t('Overdue'), 'paid' => t('Paid in full')] as $k => $label) { ?>
          <option value="<?= h($k) ?>"<?= $f['pay'] === $k ? ' selected' : '' ?>><?= h($label) ?></option>
        <?php } ?>
      </select>
      <label class="sr-only" for="bk-sort"><?= h(t('Order')) ?></label>
      <select class="select" id="bk-sort" name="sort" data-autosubmit>
        <option value=""<?= $f['sort'] === '' ? ' selected' : '' ?>><?= h(t('By trip date')) ?></option>
        <option value="new"<?= $f['sort'] === 'new' ? ' selected' : '' ?>><?= h(t('Newest first')) ?></option>
      </select>
    </div>
    <span class="toolbar__spacer"></span>
    <button class="btn btn--secondary hide-sm" type="submit"><?= icon('search') ?><?= h(t('Search')) ?></button>
    <?php if (!$isDefault) { ?><a class="btn btn--ghost" href="<?= h(url('bookings')) ?>"><?= icon('close') ?><?= h(t('Clear filters')) ?></a><?php } ?>
  </form>

  <?php if ($total > 0) {
    $sumItems = [
      [tp((int) $sum['n'], '{n} booking', '{n} bookings') . ' · ' . tp((int) $sum['people'], '{n} traveller', '{n} travellers'), ''],
      [t('Booked value'), fmt_money($sum['value'] ?? 0)],
      [t('Paid'), fmt_money($sum['paid'] ?? 0)],
      [t('To collect'), fmt_money($sum['outstanding'] ?? 0)],
    ]; ?>
    <dl class="bk-sum" aria-label="<?= h(t('Totals for this list')) ?>">
      <?php foreach ($sumItems as $i => $it) {
        $isDue = $i === count($sumItems) - 1;
        if ($it[1] === '') { echo '<div class="bk-sum__item bk-sum__item--count"><dt class="sr-only">' . h(t('Count')) . '</dt><dd>' . h($it[0]) . '</dd></div>'; continue; } ?>
        <div class="bk-sum__item<?= $isDue && (float) $sum['outstanding'] > BK_EPS ? ' bk-sum__item--due' : '' ?>"><dt><?= h($it[0]) ?></dt><dd><?= h($it[1]) ?></dd></div>
      <?php } ?>
    </dl>
    <p class="sr-only"><?= h(t('Cancelled bookings are not counted in these totals.')) ?></p>

    <section class="card card--flush">
      <div class="table-wrap">
        <table class="table bk-table">
          <caption class="sr-only"><?= h(t('Bookings')) ?></caption>
          <thead><tr>
            <th scope="col"><?= h(t('Client')) ?></th>
            <th scope="col"><?= h(t('Tour')) ?></th>
            <th scope="col"><?= h(t('Dates')) ?></th>
            <th scope="col" class="num"><?= h(t('Total')) ?></th>
            <th scope="col" class="num"><?= h(t('Balance')) ?></th>
            <th scope="col" class="bk-col-status"><?= h(t('Status')) ?></th>
          </tr></thead>
          <tbody>
          <?php foreach ($rows as $b) {
            $m = bk_money($b);
            $href = url('booking', ['id' => (int) $b['id']]);
            list($whenText, $whenTone) = bk_when($b);
            $party = (int) $b['adults'] + (int) $b['children'];
            $country = trim((string) $b['client_country']);
            $tier = trim((string) $b['tier']);
            $tourSub = array_filter([$tier !== '' ? tier_name($tier) : '', tp($party, '{n} traveller', '{n} travellers')]); ?>
            <tr data-href="<?= h($href) ?>"<?= $b['status'] === 'cancelled' ? ' class="bk-row--cancelled"' : '' ?>>
              <td class="cell-primary" data-label="<?= h(t('Client')) ?>">
                <a class="cell-main" href="<?= h($href) ?>"><?= h($b['client_name']) ?></a>
                <span class="cell-sub"><span class="bk-ref"><?= h($b['ref']) ?></span><?php if ($country !== '') { ?> · <?= h($country) ?><?php } ?></span>
                <span class="bk-status-inline"><?= status_badge($b['status'], 'booking') ?></span>
              </td>
              <td data-label="<?= h(t('Tour')) ?>"><span class="bk-cell-tour"><?= h(bk_tour_label($b, false)) ?></span><span class="cell-sub" title="<?= h(bk_party_label($b['adults'], $b['children'])) ?>"><?= h(implode(' · ', $tourSub)) ?></span></td>
              <td data-label="<?= h(t('Dates')) ?>">
                <?php if (bk_valid_date($b['start_date']) !== '') { ?>
                  <span class="bk-dates"><span class="nowrap"><?= str_replace(' – ', '</span> – <span class="nowrap">', h(bk_dates_label($b['start_date'], $b['end_date']))) ?></span></span>
                  <?php if ($whenText !== '') { ?><span class="cell-sub bk-when bk-when--<?= h($whenTone ?: 'plain') ?>"><?= h($whenText) ?></span><?php } ?>
                <?php } else { ?>
                  <span class="muted"><?= h(t('No dates yet')) ?></span>
                <?php } ?>
              </td>
              <td class="num" data-label="<?= h(t('Total')) ?>">
                <?php if ($m['total'] > BK_EPS) { ?>
                  <span class="bk-total"><?= h(fmt_money($m['total'])) ?></span>
                  <span class="cell-sub"><?= h(abs($m['paid']) > BK_EPS ? t('{amount} paid', ['amount' => fmt_money($m['paid'])]) : t('nothing paid')) ?></span>
                <?php } else { ?>
                  <span class="muted"><?= h(t('No price yet')) ?></span>
                  <?php if (abs($m['paid']) > BK_EPS) { ?><span class="cell-sub"><?= h(t('{amount} paid', ['amount' => fmt_money($m['paid'])])) ?></span><?php } ?>
                <?php } ?>
              </td>
              <td class="num" data-label="<?= h(t('Balance')) ?>">
                <?php if ($m['state'] === 'cancelled') { ?>
                  <span class="muted">—</span><?php if (abs($m['paid']) > BK_EPS) { ?><span class="cell-sub"><?= h($m['label']) ?></span><?php } ?>
                <?php } elseif ($m['state'] === 'none') { ?>
                  <span class="muted">—</span>
                <?php } elseif ($m['balance'] > BK_EPS) { ?>
                  <span class="bk-balance<?= !empty($m['due']['overdue']) ? ' bk-balance--late' : '' ?>"><?= h(fmt_money($m['balance'])) ?></span>
                  <span class="cell-sub<?= !empty($m['due']['overdue']) ? ' bk-balance--late' : '' ?>"><?= h(!empty($m['due']['overdue']) ? ($m['due']['what'] === 'deposit' ? t('Deposit overdue') : t('Balance overdue')) : $m['label']) ?></span>
                <?php } else { ?>
                  <span class="bk-paid"><?= icon('check') ?><?= h(t('Paid')) ?></span>
                  <?php if ($m['state'] === 'over') { ?><span class="cell-sub"><?= h($m['label']) ?></span><?php } ?>
                <?php } ?>
              </td>
              <td class="bk-col-status" data-label="<?= h(t('Status')) ?>"><?= status_badge($b['status'], 'booking') ?></td>
            </tr>
          <?php } ?>
          </tbody>
        </table>
      </div>
    </section>
    <?= pager($total, $page, BK_PER_PAGE, ['p' => 'bookings'] + bk_params($f)) ?>
  <?php } else { ?>
    <section class="card empty empty--sm">
      <div class="empty__mark" aria-hidden="true"><?= icon('search') ?></div>
      <h2 class="empty__title"><?= h($f['q'] !== '' ? t('No bookings match “{q}”', ['q' => $f['q']]) : t('No bookings here')) ?></h2>
      <p class="empty__text"><?= h($f['when'] === 'upcoming' && $f['q'] === '' && $f['pay'] === '' ? t('There are no upcoming trips with this status. Past trips are under “Past trips”.') : t('Try another filter, or clear the filters to see every booking.')) ?></p>
      <div class="btn-row btn-row--center">
        <a class="btn btn--secondary" href="<?= h(url('bookings', ['when' => 'all'])) ?>"><?= h(t('Show all bookings')) ?></a>
      </div>
    </section>
  <?php }

  if (is_owner()) { ?>
    <p class="bk-export"><?= icon('download') ?><span><?= h(t('Download for a spreadsheet:')) ?></span>
      <a href="<?= h(url('export', ['type' => 'bookings'])) ?>"><?= h(t('All bookings (CSV)')) ?></a>
      <span aria-hidden="true">·</span>
      <a href="<?= h(url('export', ['type' => 'payments'])) ?>"><?= h(t('All payments (CSV)')) ?></a>
    </p>
  <?php }
}

render(t('Bookings'), ob_get_clean(), [
  'nav' => 'bookings',
  'css' => ['bookings.css'],
  'actions' => $actions,
]);
