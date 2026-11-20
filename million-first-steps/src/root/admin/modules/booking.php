<?php
/*
 * One booking (?p=booking&id=N) — details form, payments, notes and history, the request it came from.
 * New booking: ?p=booking&new=1 [&from=<request id>] [&start=Y-m-d]. Creating it from a request copies the
 * request's details in and marks the request as booked (with a timeline entry on both).
 * POST actions: create · save · pay_add · pay_delete · note_add · delete (owners only).
 * Shared helpers: modules/bookings-lib.php · behaviour: assets/booking.js · styles: assets/bookings.css.
 */
$me = require_login();
require_once __DIR__ . '/bookings-lib.php';

$id = get_int('id');
$isNew = $id <= 0;
if ($isNew && get('new') !== '1') redirect(url('bookings'));
$tours = tours();
$tiers = tiers();
$today = local_today();
$uid = (int) $me['id'];

$loadBooking = function (int $id) {
  return db_row('SELECT b.*, COALESCE(pp.paid, 0) AS paid, u.name AS created_by_name FROM bookings b ' . BK_PAID_JOIN
    . ' LEFT JOIN users u ON u.id = b.created_by WHERE b.id = ?', [$id]);
};
$booking = null;
if (!$isNew) {
  $booking = $loadBooking($id);
  if (!$booking) {
    render_error(404, t('Booking not found'), t('This booking no longer exists — it may have been deleted.'),
      '<div class="btn-row btn-row--center"><a class="btn btn--secondary" href="' . h(url('bookings')) . '">' . icon('suitcase') . h(t('All bookings')) . '</a></div>');
  }
}

// The request a new booking is made from (or the one an existing booking came from).
$fromId = $isNew ? get_int('from') : (int) ($booking['request_id'] ?? 0);
$request = $fromId > 0 ? db_row('SELECT * FROM requests WHERE id = ?', [$fromId]) : null;
if ($isNew && $fromId > 0 && !$request) {
  flash('info', t('That request no longer exists, so the form starts empty.'));
  redirect(url('booking', ['new' => 1]));
}

// ── Form values ─────────────────────────────────────────────────────────────
$blank = [
  'client_name' => '', 'client_email' => '', 'client_phone' => '', 'client_country' => '', 'client_lang' => '',
  'tour' => '', 'tour_name' => '', 'tier' => '', 'start_date' => '', 'end_date' => '', 'adults' => '2', 'children' => '0',
  'total_price' => '', 'deposit_amount' => '', 'deposit_due' => '', 'balance_due' => '',
  'guide' => '', 'driver' => '', 'vehicle' => '', 'accommodation' => '', 'notes' => '', 'status' => 'quote',
];
$fromRow = function (array $b) use ($blank, $tours) {
  $v = $blank;
  foreach ($v as $k => $_) if (array_key_exists($k, $b)) $v[$k] = (string) $b[$k];
  $tid = (string) ($b['tour_id'] ?? '');
  if ($tid !== '' && isset($tours[$tid])) {
    $v['tour'] = $tid;
    $v['tour_name'] = '';
  } else {
    $v['tour'] = trim((string) $b['tour_name']) !== '' ? '_custom' : '';
    $v['tour_name'] = (string) $b['tour_name'];
  }
  $v['total_price'] = bk_money_input($b['total_price']);
  $v['deposit_amount'] = bk_money_input($b['deposit_amount']);
  return $v;
};
/** A money field: null if it isn't a number, 0.0 for empty. */
$money = function (string $s) {
  $c = str_replace(['€', ' ', "\xC2\xA0", "'", '−', '–'], ['', '', '', '', '-', '-'], $s);
  if ($c === '') return 0.0;
  if (!preg_match('/^-?(\d{1,3}(,\d{3})+|\d+)([.,]\d{1,2})?$/', $c)) return null;
  return money_value($c);
};

/** Checks the posted form. Returns [database values, errors by field]. */
$validate = function (array $in) use ($tours, $tiers, $money) {
  $e = [];
  $d = [];
  foreach (BK_TEXT_LIMITS as $k => $max) {
    $v = $in[$k];
    if (!in_array($k, ['accommodation', 'notes'], true)) $v = trim(str_replace("\n", ' ', $v));
    if (bk_len($v) > $max) $e[$k] = t('This is too long (at most {n} characters).', ['n' => number_format($max)]);
    $d[$k] = $v === '' ? null : $v;
  }
  if ($in['client_name'] === '') $e['client_name'] = t('Please enter the client’s name.');
  if ($in['client_email'] !== '') {
    $em = valid_email($in['client_email']);
    if ($em === '') $e['client_email'] = t('This doesn’t look like an email address.');
    else $d['client_email'] = $em;
  }
  $d['client_lang'] = in_array($in['client_lang'], bk_lang_codes(), true) ? $in['client_lang'] : null;

  $d['tour_id'] = null;
  if ($in['tour'] !== '' && $in['tour'] !== '_custom') {
    if (!isset($tours[$in['tour']])) $e['tour'] = t('Please choose a tour from the list.');
    else {
      $d['tour_id'] = $in['tour'];
      $d['tour_name'] = $tours[$in['tour']]['name'];
    }
  } elseif ($in['tour'] === '_custom') {
    if ($in['tour_name'] === '') $e['tour_name'] = t('Please give the custom trip a name, e.g. “Tbilisi and Kazbegi, 4 days”.');
  } else {
    $d['tour_name'] = null;
  }
  $d['tier'] = isset($tiers[$in['tier']]) ? $in['tier'] : null;

  foreach (['start_date', 'end_date', 'deposit_due', 'balance_due'] as $k) {
    $v = bk_valid_date($in[$k]);
    if ($in[$k] !== '' && $v === '') $e[$k] = t('Please enter a date (for example 2027-05-12).');
    $d[$k] = $v === '' ? null : $v;
  }
  if ($d['end_date'] && !$d['start_date'] && !isset($e['start_date'])) $e['start_date'] = t('Please add the first day of the trip too.');
  if ($d['start_date'] && $d['end_date'] && $d['end_date'] < $d['start_date']) $e['end_date'] = t('The last day can’t be before the first day.');
  if ($d['start_date'] && $d['end_date'] && !isset($e['end_date']) && bk_days_between($d['start_date'], $d['end_date']) > 120) $e['end_date'] = t('That’s more than 120 days — please check the dates.');
  if ($d['start_date'] && !$d['end_date'] && !isset($e['end_date'])) {
    $days = $d['tour_id'] ? (int) $tours[$d['tour_id']]['days'] : 0;
    $d['end_date'] = $days > 0 ? bk_add_days($d['start_date'], $days - 1) : $d['start_date'];
  }

  foreach (['adults' => [0, 99], 'children' => [0, 99]] as $k => $range) {
    $v = trim($in[$k]);
    if ($v === '') $v = '0';
    if (!preg_match('/^\d{1,3}$/', $v) || (int) $v < $range[0] || (int) $v > $range[1]) $e[$k] = t('Please enter a number from {min} to {max}.', ['min' => $range[0], 'max' => $range[1]]);
    $d[$k] = (int) $v;
  }
  if (!isset($e['adults']) && !isset($e['children']) && $d['adults'] + $d['children'] < 1) $e['adults'] = t('A trip needs at least one traveller.');

  foreach (['total_price', 'deposit_amount'] as $k) {
    $v = $money($in[$k]);
    if ($v === null) $e[$k] = t('Please enter an amount in euros, e.g. 2450 or 2450.50.');
    elseif ($v < 0) $e[$k] = t('The amount can’t be negative.');
    elseif ($v > 10000000) $e[$k] = t('That amount is too large — please check it.');
    $d[$k] = $v === null ? 0.0 : round($v, 2);
  }
  if (!isset($e['deposit_amount']) && !isset($e['total_price']) && $d['deposit_amount'] > $d['total_price'] + BK_EPS) {
    $e['deposit_amount'] = $d['total_price'] > BK_EPS ? t('The deposit is more than the total price.') : t('Please enter the total price first.');
  }
  $d['status'] = isset(BOOKING_STATUSES[$in['status']]) ? $in['status'] : 'quote';
  return [$d, $e];
};

$in = null;          // the form's values (posted ones when the form is shown again with errors)
$errors = [];
$conflict = false;
$payIn = ['paid_on' => $today, 'amount' => '', 'method' => '', 'note' => ''];
$payErrors = [];
$noteIn = '';
$noteError = '';

// ── Actions ─────────────────────────────────────────────────────────────────
if (is_post()) {
  csrf_check();
  $action = post('action');
  $self = $isNew ? url('booking', ['new' => 1, 'from' => $fromId ?: null]) : url('booking', ['id' => $id]);

  if ($action === 'create' || $action === 'save') {
    if ($action === 'create' && !$isNew) redirect($self);
    if ($action === 'save' && $isNew) redirect($self);
    $in = $blank;
    foreach ($in as $k => $_) $in[$k] = post($k, $k === 'status' ? 'quote' : '');
    if (!$isNew && !isset(BOOKING_STATUSES[$in['status']])) $in['status'] = (string) $booking['status'];
    list($d, $errors) = $validate($in);

    if (!$errors && $action === 'create') {
      $result = db_tx(function (PDO $pdo) use ($d, $request, $uid) {
        $now = now_utc();
        $ref = bk_new_ref($pdo);
        $pdo->prepare('INSERT INTO bookings (ref, request_id, status, client_name, client_email, client_phone, client_country, client_lang,
            tour_id, tour_name, tier, start_date, end_date, adults, children, total_price, deposit_amount, deposit_due, balance_due,
            guide, driver, vehicle, accommodation, notes, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
          $ref, $request ? (int) $request['id'] : null, $d['status'], $d['client_name'], $d['client_email'], $d['client_phone'], $d['client_country'], $d['client_lang'],
          $d['tour_id'], $d['tour_name'], $d['tier'], $d['start_date'], $d['end_date'], $d['adults'], $d['children'], $d['total_price'], $d['deposit_amount'],
          $d['deposit_due'], $d['balance_due'], $d['guide'], $d['driver'], $d['vehicle'], $d['accommodation'], $d['notes'], $uid, $now, $now,
        ]);
        $bid = (int) $pdo->lastInsertId();
        $reqChange = null;
        if ($request) {
          bk_add_note($bid, 'Booking created from request ' . $request['ref'], 'system', $uid);
          $cur = (string) db_value('SELECT status FROM requests WHERE id = ?', [(int) $request['id']]);
          if ($cur !== '' && $cur !== 'booked') {
            db_exec("UPDATE requests SET status = 'booked', updated_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ?", [$now, $now, (int) $request['id']]);
            db_exec("INSERT INTO notes (request_id, user_id, kind, body, created_at) VALUES (?, ?, 'status', ?, ?)", [(int) $request['id'], $uid, bk_status_note($cur, 'booked', REQUEST_STATUSES), $now]);
            $reqChange = $cur;
          }
          db_exec("INSERT INTO notes (request_id, user_id, kind, body, created_at) VALUES (?, ?, 'system', ?, ?)", [(int) $request['id'], $uid, 'Booking ' . $ref . ' created', $now]);
        } else {
          bk_add_note($bid, 'Booking created', 'system', $uid);
        }
        return [$bid, $ref, $reqChange];
      });
      list($bid, $ref, $reqChange) = $result;
      audit('booking.create', 'booking:' . $bid, $ref . ($request ? ' from request ' . $request['ref'] : ''));
      if ($reqChange !== null) audit('request.status', 'request:' . (int) $request['id'], $request['ref'] . ': ' . $reqChange . ' → booked');
      flash('ok', $request
        ? t('Booking {ref} created. Request {req} is now marked as booked.', ['ref' => $ref, 'req' => $request['ref']])
        : t('Booking {ref} created.', ['ref' => $ref]));
      redirect(url('booking', ['id' => $bid]));
    }

    if (!$errors && $action === 'save') {
      $fresh = $loadBooking($id);
      if (!$fresh) redirect(url('bookings'));
      if (post('v') !== (string) $fresh['updated_at']) {
        // Someone saved this booking after this form was opened: show their version's time, keep this person's input.
        $conflict = true;
        $booking = $fresh;
      } else {
        $cols = ['status', 'client_name', 'client_email', 'client_phone', 'client_country', 'client_lang', 'tour_id', 'tour_name', 'tier',
          'start_date', 'end_date', 'adults', 'children', 'total_price', 'deposit_amount', 'deposit_due', 'balance_due',
          'guide', 'driver', 'vehicle', 'accommodation', 'notes'];
        $changed = [];
        foreach ($cols as $c) {
          $old = $fresh[$c];
          $new = $d[$c];
          if (in_array($c, ['total_price', 'deposit_amount'], true)) $same = abs((float) $old - (float) $new) < BK_EPS;
          elseif (in_array($c, ['adults', 'children'], true)) $same = (int) $old === (int) $new;
          else $same = (string) ($old ?? '') === (string) ($new ?? '');
          if (!$same) $changed[] = $c;
        }
        if (!$changed) {
          flash('info', t('Nothing to save — no changes were made.'));
          redirect($self);
        }
        $oldStatus = (string) $fresh['status'];
        db_tx(function () use ($cols, $d, $id, $uid, $oldStatus) {
          $set = implode(', ', array_map(function ($c) { return $c . ' = ?'; }, $cols));
          $vals = array_map(function ($c) use ($d) { return $d[$c]; }, $cols);
          $vals[] = now_utc();
          $vals[] = $id;
          db_exec("UPDATE bookings SET $set, updated_at = ? WHERE id = ?", $vals);
          if ($oldStatus !== $d['status']) bk_add_note($id, bk_status_note($oldStatus, $d['status'], BOOKING_STATUSES), 'status', $uid);
        });
        audit('booking.update', 'booking:' . $id, $fresh['ref'] . ': ' . implode(', ', $changed));
        if ($oldStatus !== $d['status']) audit('booking.status', 'booking:' . $id, $fresh['ref'] . ': ' . $oldStatus . ' → ' . $d['status']);
        flash('ok', $oldStatus !== $d['status']
          ? t('Saved. The booking is now “{status}”.', ['status' => t(BOOKING_STATUSES[$d['status']])])
          : t('Booking saved.'));
        redirect($self);
      }
    }
    // Errors (or a conflict): fall through and show the form again with what was typed.
  } elseif ($isNew) {
    redirect($self);
  } elseif ($action === 'pay_add') {
    $payIn = ['paid_on' => post('paid_on'), 'amount' => post('amount'), 'method' => post('method'), 'note' => post('note')];
    $date = bk_valid_date($payIn['paid_on']);
    if ($date === '') $payErrors['paid_on'] = t('Please enter the date it was paid.');
    elseif ($date > bk_add_days($today, 366)) $payErrors['paid_on'] = t('That date is more than a year away — please check it.');
    $amount = $money($payIn['amount']);
    if ($payIn['amount'] === '' || $amount === null) $payErrors['amount'] = t('Please enter the amount, e.g. 900 (or −200 for a refund).');
    elseif (abs($amount) < 0.01) $payErrors['amount'] = t('The amount can’t be zero.');
    elseif (abs($amount) > 10000000) $payErrors['amount'] = t('That amount is too large — please check it.');
    $method = isset(BK_PAYMENT_METHODS[$payIn['method']]) ? $payIn['method'] : '';
    $note = trim(str_replace("\n", ' ', $payIn['note']));
    if (bk_len($note) > 200) $payErrors['note'] = t('This is too long (at most {n} characters).', ['n' => 200]);
    if (!$payErrors) {
      $amount = round((float) $amount, 2);
      $pid = db_tx(function (PDO $pdo) use ($id, $date, $amount, $method, $note, $uid) {
        $pdo->prepare('INSERT INTO payments (booking_id, paid_on, amount, method, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          ->execute([$id, $date, $amount, $method !== '' ? $method : null, $note !== '' ? $note : null, $uid, now_utc()]);
        $pid = (int) $pdo->lastInsertId();
        bk_add_note($id, 'Payment recorded: ' . fmt_money($amount) . ' on ' . $date . ($method !== '' ? ' (' . $method . ')' : ''), 'system', $uid);
        return $pid;
      });
      audit('payment.add', 'payment:' . $pid, $booking['ref'] . ': ' . fmt_money($amount) . ' on ' . $date);
      $after = bk_money($loadBooking($id) ?: $booking);
      $msg = $amount < 0 ? t('Refund of {amount} recorded.', ['amount' => fmt_money(-$amount)]) : t('Payment of {amount} recorded.', ['amount' => fmt_money($amount)]);
      if ($after['state'] === 'paid') $msg .= ' ' . t('The booking is now paid in full.');
      elseif ($after['state'] === 'over') $msg .= ' ' . t('The payments are now {amount} more than the total price.', ['amount' => fmt_money($after['over_by'])]);
      flash('ok', $msg);
      redirect($self . '#payments');
    }
  } elseif ($action === 'pay_delete') {
    $pay = db_row('SELECT * FROM payments WHERE id = ? AND booking_id = ?', [(int) post('pay_id'), $id]);
    if (!$pay) {
      flash('info', t('That payment was already deleted.'));
    } elseif (!bk_can_delete_payment($pay, $me)) {
      flash('error', t('Only an owner can delete this payment. Payments can be deleted by the person who recorded them for 24 hours.'));
    } else {
      db_tx(function () use ($pay, $id, $uid) {
        db_exec('DELETE FROM payments WHERE id = ?', [(int) $pay['id']]);
        bk_add_note($id, 'Payment deleted: ' . fmt_money($pay['amount']) . ' on ' . $pay['paid_on'], 'system', $uid);
      });
      audit('payment.delete', 'payment:' . (int) $pay['id'], $booking['ref'] . ': ' . fmt_money($pay['amount']) . ' on ' . $pay['paid_on']);
      flash('ok', t('Payment of {amount} deleted.', ['amount' => fmt_money($pay['amount'])]));
    }
    redirect($self . '#payments');
  } elseif ($action === 'note_add') {
    $noteIn = post('body');
    if ($noteIn === '') $noteError = t('Please write the note first.');
    elseif (bk_len($noteIn) > 5000) $noteError = t('This is too long (at most {n} characters).', ['n' => number_format(5000)]);
    else {
      bk_add_note($id, $noteIn, 'note', $uid);
      audit('booking.note', 'booking:' . $id, $booking['ref']);
      flash('ok', t('Note added.'));
      redirect($self . '#notes');
    }
  } elseif ($action === 'delete') {
    require_owner();
    db_tx(function () use ($booking, $id, $uid) {
      if (!empty($booking['request_id'])) {
        db_exec("INSERT INTO notes (request_id, user_id, kind, body, created_at) SELECT id, ?, 'system', ?, ? FROM requests WHERE id = ?",
          [$uid, 'Booking ' . $booking['ref'] . ' deleted', now_utc(), (int) $booking['request_id']]);
      }
      db_exec('DELETE FROM bookings WHERE id = ?', [$id]);
    });
    audit('booking.delete', 'booking:' . $id, $booking['ref'] . ' · ' . $booking['client_name'] . ' · ' . fmt_money($booking['total_price']));
    flash('ok', t('Booking {ref} deleted.', ['ref' => $booking['ref']]));
    redirect(url('bookings'));
  } else {
    redirect($self);
  }
}

// ── Page ────────────────────────────────────────────────────────────────────
if ($in === null) {
  if ($isNew) {
    $in = $blank;
    if ($request) $in = array_merge($in, bk_prefill_from_request($request));
    $s = bk_valid_date(get('start'));
    if ($s !== '' && $in['start_date'] === '') $in['start_date'] = $s;
  } else {
    $in = $fromRow($booking);
  }
}
$err = function ($k) use (&$errors) {
  return isset($errors[$k]) ? '<p class="field__error" id="err-' . h($k) . '">' . icon('alert') . '<span>' . h($errors[$k]) . '</span></p>' : '';
};
$aria = function ($k, $help = '') use (&$errors) {
  $ids = trim((isset($errors[$k]) ? 'err-' . $k : '') . ' ' . $help);
  return (isset($errors[$k]) ? ' aria-invalid="true"' : '') . ($ids !== '' ? ' aria-describedby="' . h($ids) . '"' : '');
};
$fc = function ($k) use (&$errors) {
  return 'field' . (isset($errors[$k]) ? ' has-error' : '');
};
$opt = '<span class="field__opt">' . h(t('optional')) . '</span>';
$v = function ($k) use (&$in) { return h($in[$k] ?? ''); };

$party = max(0, (int) $in['adults']) + max(0, (int) $in['children']);
$sug = bk_suggest($in['tour'], $in['tier'], $party);
$sugText = $sug
  ? t('Website price: {per} per person × {n} = {total}', ['per' => fmt_money($sug['per']), 'n' => $sug['party'], 'total' => fmt_money($sug['total'])])
  : t('Choose a tour and a travel style to see the website price.');
$tourDays = isset($tours[$in['tour']]) ? (int) $tours[$in['tour']]['days'] : 0;

ob_start();

// ── Summary (existing bookings) ──
$summaryHtml = '';
if (!$isNew) {
  $m = bk_money($booking);
  list($whenText, $whenTone) = bk_when($booking);
  $pct = $m['total'] > BK_EPS ? max(0, min(100, round($m['paid'] / $m['total'] * 100))) : 0;
  $email = valid_email($booking['client_email']);
  $mailto = mailto_href($email, 'Million First Steps — ' . $booking['ref']);
  $tel = tel_href($booking['client_phone']);
  $wa = whatsapp_href($booking['client_phone']);
  $days = bk_trip_days($booking);
  ob_start(); ?>
  <section class="card bk-summary bk-o-1" aria-label="<?= h(t('Summary')) ?>">
    <div class="bk-summary__top">
      <span class="bk-ref bk-ref--lg"><?= h($booking['ref']) ?></span>
      <?= status_badge($booking['status'], 'booking') ?>
      <?php if ($whenText !== '') { ?><span class="bk-when bk-when--<?= h($whenTone ?: 'plain') ?>"><?= icon('clock') ?><?= h($whenText) ?></span><?php } ?>
    </div>
    <dl class="bk-facts">
      <div class="bk-fact bk-fact--wide"><dt><?= icon('map-pin') ?><?= h(t('Tour')) ?></dt><dd><?= h(bk_tour_label($booking)) ?></dd></div>
      <div class="bk-fact"><dt><?= icon('calendar') ?><?= h(t('Dates')) ?></dt><dd><?php if (bk_valid_date($booking['start_date']) !== '') { ?><?= h(bk_dates_label($booking['start_date'], $booking['end_date'])) ?> <span class="muted">· <?= h(tp($days, '{n} day', '{n} days')) ?></span><?php } else { ?><span class="muted"><?= h(t('No dates yet')) ?></span><?php } ?></dd></div>
      <div class="bk-fact"><dt><?= icon('users') ?><?= h(t('Travellers')) ?></dt><dd><?= h(bk_party_label($booking['adults'], $booking['children'])) ?></dd></div>
      <?php $who = array_filter([trim((string) $booking['client_country']), bk_lang_name($booking['client_lang'])]); if ($who) { ?>
      <div class="bk-fact"><dt><?= icon('globe') ?><?= h(t('Client')) ?></dt><dd><?= h(implode(' · ', $who)) ?></dd></div>
      <?php } ?>
    </dl>
    <div class="bk-money">
      <div class="bk-money__nums">
        <div><span><?= h(t('Total')) ?></span><b><?= h($m['total'] > BK_EPS ? fmt_money($m['total']) : '—') ?></b></div>
        <div><span><?= h(t('Paid')) ?></span><b><?= h(fmt_money($m['paid'])) ?></b></div>
        <div><span><?= h($m['state'] === 'over' ? t('Overpaid') : t('Balance')) ?></span><b class="<?= !empty($m['due']['overdue']) ? 'bk-balance--late' : '' ?>"><?= h($m['state'] === 'cancelled' ? '—' : fmt_money($m['state'] === 'over' ? $m['over_by'] : $m['balance'])) ?></b></div>
      </div>
      <?php if ($m['total'] > BK_EPS && $m['state'] !== 'cancelled') { ?>
        <div class="progress bk-money__bar" role="img" aria-label="<?= h(t('{pct}% paid', ['pct' => $pct])) ?>"><span class="progress__fill<?= $m['state'] === 'paid' || $m['state'] === 'over' ? '' : ' progress__fill--gold' ?>" style="width: <?= (int) $pct ?>%"></span></div>
      <?php } ?>
      <p class="bk-money__state"><?= bk_pay_pill($m) ?><?php if ($m['due'] !== null && empty($m['due']['overdue'])) { ?><span class="muted small"><?= h(bk_due_text($m['due'])) ?></span><?php } ?></p>
    </div>
    <?php if (!empty($m['due']['overdue'])) { ?>
      <div class="callout callout--danger"><?= icon('alert') ?><p><?= h(bk_due_text($m['due'])) ?></p></div>
    <?php } elseif (!empty($m['due']['soon'])) { ?>
      <div class="callout callout--warn"><?= icon('clock') ?><p><?= h(bk_due_text($m['due'])) ?></p></div>
    <?php }
    if ($booking['status'] === 'quote' && in_array($m['state'], ['deposit', 'paid', 'over'], true)) { ?>
      <div class="callout callout--ok"><?= icon('check') ?><p><?= h(t('The deposit is in. When everything is agreed, set the status to “Confirmed” below.')) ?></p></div>
    <?php }
    if ($booking['status'] === 'confirmed' && bk_end($booking) !== '' && bk_end($booking) < $today) { ?>
      <div class="callout callout--info"><?= icon('info') ?><p><?= h(t('This trip is over. Set the status to “Completed” once everything is settled.')) ?></p></div>
    <?php } ?>
    <?php if ($mailto !== '' || $tel !== '' || $wa !== '') { ?>
      <div class="btn-row bk-contact">
        <?php if ($mailto !== '') { ?><a class="btn btn--secondary btn--sm" href="<?= h($mailto) ?>"><?= icon('mail') ?><?= h(t('Email')) ?></a><?php } ?>
        <?php if ($tel !== '') { ?><a class="btn btn--secondary btn--sm" href="<?= h($tel) ?>"><?= icon('phone') ?><?= h(t('Call')) ?></a><?php } ?>
        <?php if ($wa !== '') { ?><a class="btn btn--secondary btn--sm" href="<?= h($wa) ?>" target="_blank" rel="noopener noreferrer"><?= icon('whatsapp') ?><?= h(t('WhatsApp')) ?></a><?php } ?>
        <?php if ($email !== '') { ?><button type="button" class="btn btn--ghost btn--sm" data-copy="<?= h($email) ?>" data-copied="<?= h(t('Copied')) ?>" aria-label="<?= h(t('Copy email address')) ?>"><?= icon('copy') ?><span data-copy-label><?= h(t('Copy email')) ?></span></button><?php } ?>
      </div>
    <?php } ?>
    <p class="bk-summary__meta">
      <?= h(t('Added by {name} on {date}', ['name' => trim((string) $booking['created_by_name']) !== '' ? $booking['created_by_name'] : t('someone who has left'), 'date' => fmt_date($booking['created_at'])])) ?>
      <?php if ($booking['updated_at'] !== $booking['created_at']) { ?> · <?= h(t('last changed {when}', ['when' => fmt_ago($booking['updated_at'])])) ?><?php } ?>
    </p>
  </section>
  <?php $summaryHtml = ob_get_clean();
}

// ── The details form ──
ob_start(); ?>
<form method="post" action="<?= h($isNew ? url('booking', ['new' => 1, 'from' => $fromId ?: null]) : url('booking', ['id' => $id])) ?>" class="bk-form stack bk-o-3" id="booking-form" data-once data-bk-form
  data-prices="<?= h(json_encode(bk_price_data(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>"
  data-t-price="<?= h(t('Website price: {per} per person × {n} = {total}')) ?>"
  data-t-noprice="<?= h(t('Choose a tour and a travel style to see the website price.')) ?>"
  data-t-days="<?= h(t('{n} days')) ?>" data-t-day="<?= h(t('{n} day')) ?>"
  data-t-unsaved="<?= h(t('The booking details have changes that aren’t saved yet. Go on without saving them?')) ?>">
  <?= csrf_field() ?>
  <input type="hidden" name="action" value="<?= $isNew ? 'create' : 'save' ?>">
  <noscript><style>.bk-form [data-bk-custom][hidden] { display: flex !important; }</style></noscript>
  <?php if (!$isNew) { ?><input type="hidden" name="v" value="<?= h($booking['updated_at']) ?>"><?php } ?>

  <?php if ($conflict) { ?>
    <div class="callout callout--warn" role="alert"><?= icon('alert') ?><div><p class="strong"><?= h(t('Someone else saved this booking while you were editing it.')) ?></p><p><?= h(t('Your changes are below but are not saved yet. The summary above shows their version. Saving again replaces it with everything in this form — check it first.')) ?></p></div></div>
  <?php } elseif ($errors) { ?>
    <div class="callout callout--danger" role="alert"><?= icon('alert') ?><p><?= h(tp(count($errors), 'Please check the highlighted field.', 'Please check the {n} highlighted fields.')) ?></p></div>
  <?php } ?>

  <section class="card">
    <div class="card__head"><h2 class="card__title"><?= h(t('Status')) ?></h2></div>
    <div class="card__body">
      <fieldset class="fieldset">
        <legend class="sr-only"><?= h(t('Booking status')) ?></legend>
        <div class="choice-row">
          <?php foreach (BOOKING_STATUSES as $k => $label) { ?>
            <label class="choice"><input type="radio" name="status" value="<?= h($k) ?>"<?= $in['status'] === $k ? ' checked' : '' ?>><span class="choice__box"><span class="dot dot--<?= h($k) ?>" aria-hidden="true"></span><?= h(t($label)) ?></span></label>
          <?php } ?>
        </div>
        <p class="field__help"><?= h(t('Quote: offered, not yet agreed · Confirmed: agreed (usually once the deposit is in) · Completed: the trip has happened · Cancelled.')) ?></p>
      </fieldset>
    </div>
  </section>

  <section class="card">
    <div class="card__head"><h2 class="card__title"><?= h(t('Client')) ?></h2></div>
    <div class="card__body">
      <div class="<?= $fc('client_name') ?>">
        <label class="field__label" for="bk-name"><?= h(t('Name')) ?></label>
        <input class="input" id="bk-name" name="client_name" value="<?= $v('client_name') ?>" maxlength="200" required autocomplete="off"<?= $aria('client_name') ?>>
        <?= $err('client_name') ?>
      </div>
      <div class="form-row">
        <div class="<?= $fc('client_email') ?>">
          <label class="field__label" for="bk-email"><?= h(t('Email')) ?> <?= $opt ?></label>
          <input class="input" type="email" id="bk-email" name="client_email" value="<?= $v('client_email') ?>" maxlength="200" autocomplete="off" inputmode="email"<?= $aria('client_email') ?>>
          <?= $err('client_email') ?>
        </div>
        <div class="<?= $fc('client_phone') ?>">
          <label class="field__label" for="bk-phone"><?= h(t('Phone')) ?> <?= $opt ?></label>
          <input class="input" type="tel" id="bk-phone" name="client_phone" value="<?= $v('client_phone') ?>" maxlength="60" autocomplete="off" placeholder="+44 7700 900123"<?= $aria('client_phone', 'bk-phone-h') ?>>
          <p class="field__help" id="bk-phone-h"><?= h(t('With the country code, so the WhatsApp button works.')) ?></p>
          <?= $err('client_phone') ?>
        </div>
      </div>
      <div class="form-row">
        <div class="<?= $fc('client_country') ?>">
          <label class="field__label" for="bk-country"><?= h(t('Country')) ?> <?= $opt ?></label>
          <input class="input" id="bk-country" name="client_country" value="<?= $v('client_country') ?>" maxlength="100" autocomplete="off"<?= $aria('client_country') ?>>
          <?= $err('client_country') ?>
        </div>
        <div class="field">
          <label class="field__label" for="bk-lang"><?= h(t('Language')) ?> <?= $opt ?></label>
          <select class="select" id="bk-lang" name="client_lang">
            <option value=""><?= h(t('Not set')) ?></option>
            <?php foreach (bk_lang_codes() as $code) { ?>
              <option value="<?= h($code) ?>"<?= $in['client_lang'] === $code ? ' selected' : '' ?>><?= h(bk_lang_name($code)) ?></option>
            <?php } ?>
          </select>
        </div>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card__head"><h2 class="card__title"><?= h(t('Trip')) ?></h2></div>
    <div class="card__body">
      <div class="form-row">
        <div class="<?= $fc('tour') ?>">
          <label class="field__label" for="bk-tour"><?= h(t('Tour')) ?></label>
          <select class="select" id="bk-tour" name="tour" data-bk-tour<?= $aria('tour', 'bk-days') ?>>
            <option value=""><?= h(t('Not chosen yet')) ?></option>
            <?php foreach ($tours as $tid => $tr) { ?>
              <option value="<?= h($tid) ?>"<?= $in['tour'] === $tid ? ' selected' : '' ?>><?= h($tr['name'] . ($tr['hidden'] ? ' (' . t('hidden on the website') . ')' : '')) ?></option>
            <?php } ?>
            <option value="_custom"<?= $in['tour'] === '_custom' ? ' selected' : '' ?>><?= h(t('Custom trip…')) ?></option>
          </select>
          <p class="field__help" id="bk-days" data-bk-days><?= $tourDays > 0 ? h(tp($tourDays, '{n} day', '{n} days')) : '' ?></p>
          <?= $err('tour') ?>
        </div>
        <div class="field">
          <label class="field__label" for="bk-tier"><?= h(t('Travel style')) ?></label>
          <select class="select" id="bk-tier" name="tier" data-bk-tier>
            <option value=""><?= h(t('Not chosen yet')) ?></option>
            <?php foreach ($tiers as $tk => $tn) { ?>
              <option value="<?= h($tk) ?>"<?= $in['tier'] === $tk ? ' selected' : '' ?>><?= h($tn) ?></option>
            <?php } ?>
          </select>
        </div>
      </div>
      <div class="<?= $fc('tour_name') ?>" data-bk-custom<?= $in['tour'] === '_custom' || isset($errors['tour_name']) ? '' : ' hidden' ?>>
        <label class="field__label" for="bk-tour-name"><?= h(t('Name of the custom trip')) ?></label>
        <input class="input" id="bk-tour-name" name="tour_name" value="<?= $v('tour_name') ?>" maxlength="200" autocomplete="off" placeholder="<?= h(t('e.g. Tbilisi and Kazbegi, 4 days')) ?>"<?= $aria('tour_name') ?>>
        <?= $err('tour_name') ?>
      </div>
      <div class="form-row">
        <div class="<?= $fc('start_date') ?>">
          <label class="field__label" for="bk-start"><?= h(t('First day')) ?></label>
          <input class="input" type="date" id="bk-start" name="start_date" value="<?= $v('start_date') ?>" min="2000-01-01" max="2100-12-31" data-bk-start<?= $aria('start_date') ?>>
          <?= $err('start_date') ?>
        </div>
        <div class="<?= $fc('end_date') ?>">
          <label class="field__label" for="bk-end"><?= h(t('Last day')) ?></label>
          <input class="input" type="date" id="bk-end" name="end_date" value="<?= $v('end_date') ?>" min="<?= $in['start_date'] !== '' ? $v('start_date') : '2000-01-01' ?>" max="2100-12-31" data-bk-end<?= $aria('end_date', 'bk-end-h') ?>>
          <p class="field__help" id="bk-end-h"><?= h(t('Left empty, it follows from the tour’s length.')) ?></p>
          <?= $err('end_date') ?>
        </div>
      </div>
      <div class="form-row">
        <div class="<?= $fc('adults') ?>">
          <label class="field__label" for="bk-adults"><?= h(t('Adults')) ?></label>
          <input class="input" type="number" id="bk-adults" name="adults" value="<?= $v('adults') ?>" min="0" max="99" step="1" inputmode="numeric" data-bk-party<?= $aria('adults') ?>>
          <?= $err('adults') ?>
        </div>
        <div class="<?= $fc('children') ?>">
          <label class="field__label" for="bk-children"><?= h(t('Children')) ?></label>
          <input class="input" type="number" id="bk-children" name="children" value="<?= $v('children') ?>" min="0" max="99" step="1" inputmode="numeric" data-bk-party<?= $aria('children') ?>>
          <?= $err('children') ?>
        </div>
      </div>
      <?php if ($isNew && $request && (trim((string) $request['travel_dates']) !== '' || trim((string) $request['travellers']) !== '' || trim((string) $request['interests']) !== '')) { ?>
        <div class="callout callout--info bk-asked"><?= icon('inbox') ?><div>
          <p class="strong"><?= h(t('What the request said')) ?></p>
          <?php foreach (['travel_dates' => t('When'), 'travellers' => t('Travellers'), 'interests' => t('Would like to see')] as $k => $label) {
            if (trim((string) $request[$k]) === '') continue; ?>
            <p><span class="muted"><?= h($label) ?>:</span> <?= h($request[$k]) ?></p>
          <?php } ?>
          <p class="small muted"><?= h(t('The form above was filled in from this — please check the dates and party size.')) ?></p>
        </div></div>
      <?php } ?>
    </div>
  </section>

  <section class="card">
    <div class="card__head"><h2 class="card__title"><?= h(t('Price and payment dates')) ?></h2></div>
    <div class="card__body">
      <div class="<?= $fc('total_price') ?>">
        <label class="field__label" for="bk-total"><?= h(t('Total price')) ?></label>
        <div class="bk-price-row">
          <div class="input-group"><span class="input-group__addon">€</span><input class="input" id="bk-total" name="total_price" value="<?= $v('total_price') ?>" inputmode="decimal" autocomplete="off" placeholder="0" data-bk-total<?= $aria('total_price', 'bk-sug') ?>></div>
          <button type="button" class="btn btn--secondary" data-bk-suggest hidden><?= icon('tag') ?><?= h(t('Suggest from website price')) ?></button>
        </div>
        <p class="field__help" id="bk-sug" data-bk-suggest-text><?= h($sugText) ?></p>
        <?= $err('total_price') ?>
      </div>
      <div class="form-row">
        <div class="<?= $fc('deposit_amount') ?>">
          <label class="field__label" for="bk-deposit"><?= h(t('Deposit')) ?> <?= $opt ?></label>
          <div class="input-group"><span class="input-group__addon">€</span><input class="input" id="bk-deposit" name="deposit_amount" value="<?= $v('deposit_amount') ?>" inputmode="decimal" autocomplete="off" placeholder="0"<?= $aria('deposit_amount') ?>></div>
          <?= $err('deposit_amount') ?>
        </div>
        <div class="<?= $fc('deposit_due') ?>">
          <label class="field__label" for="bk-deposit-due"><?= h(t('Deposit due by')) ?> <?= $opt ?></label>
          <input class="input" type="date" id="bk-deposit-due" name="deposit_due" value="<?= $v('deposit_due') ?>" min="2000-01-01" max="2100-12-31"<?= $aria('deposit_due') ?>>
          <?= $err('deposit_due') ?>
        </div>
      </div>
      <div class="form-row">
        <div class="<?= $fc('balance_due') ?>">
          <label class="field__label" for="bk-balance-due"><?= h(t('Balance due by')) ?> <?= $opt ?></label>
          <input class="input" type="date" id="bk-balance-due" name="balance_due" value="<?= $v('balance_due') ?>" min="2000-01-01" max="2100-12-31"<?= $aria('balance_due', 'bk-bal-h') ?>>
          <p class="field__help" id="bk-bal-h"><?= h(t('Usually a few weeks before arrival.')) ?></p>
          <?= $err('balance_due') ?>
        </div>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card__head"><div><h2 class="card__title"><?= h(t('Team and logistics')) ?></h2><p class="card__sub"><?= h(t('Only the team sees this.')) ?></p></div></div>
    <div class="card__body">
      <div class="form-row">
        <div class="<?= $fc('guide') ?>">
          <label class="field__label" for="bk-guide"><?= h(t('Guide')) ?> <?= $opt ?></label>
          <input class="input" id="bk-guide" name="guide" value="<?= $v('guide') ?>" maxlength="200" autocomplete="off"<?= $aria('guide') ?>>
          <?= $err('guide') ?>
        </div>
        <div class="<?= $fc('driver') ?>">
          <label class="field__label" for="bk-driver"><?= h(t('Driver')) ?> <?= $opt ?></label>
          <input class="input" id="bk-driver" name="driver" value="<?= $v('driver') ?>" maxlength="200" autocomplete="off"<?= $aria('driver') ?>>
          <?= $err('driver') ?>
        </div>
      </div>
      <div class="<?= $fc('vehicle') ?>">
        <label class="field__label" for="bk-vehicle"><?= h(t('Vehicle')) ?> <?= $opt ?></label>
        <input class="input" id="bk-vehicle" name="vehicle" value="<?= $v('vehicle') ?>" maxlength="200" autocomplete="off"<?= $aria('vehicle') ?>>
        <?= $err('vehicle') ?>
      </div>
      <div class="<?= $fc('accommodation') ?>">
        <label class="field__label" for="bk-stay"><?= h(t('Accommodation')) ?> <?= $opt ?></label>
        <textarea class="textarea bk-textarea--sm" id="bk-stay" name="accommodation" rows="3" maxlength="2000"<?= $aria('accommodation') ?>><?= $v('accommodation') ?></textarea>
        <?= $err('accommodation') ?>
      </div>
      <div class="<?= $fc('notes') ?>">
        <label class="field__label" for="bk-notes"><?= h(t('Notes for the trip')) ?> <?= $opt ?></label>
        <textarea class="textarea" id="bk-notes" name="notes" rows="4" maxlength="5000"<?= $aria('notes', 'bk-notes-h') ?>><?= $v('notes') ?></textarea>
        <p class="field__help" id="bk-notes-h"><?= h(t('Dietary needs, celebrations, flight times… For conversations with the client, use “Notes and history”.')) ?></p>
        <?= $err('notes') ?>
      </div>
    </div>
  </section>

  <div class="bk-savebar">
    <button type="submit" class="btn btn--primary"><?= icon('check') ?><?= h($isNew ? t('Create booking') : t('Save changes')) ?></button>
    <a class="btn btn--ghost" href="<?= h($isNew ? ($request ? url('request', ['id' => (int) $request['id']]) : url('bookings')) : url('booking', ['id' => $id])) ?>"><?= h($isNew ? t('Cancel') : t('Undo changes')) ?></a>
  </div>
</form>
<?php
$formHtml = ob_get_clean();

// ── Payments ──
$paymentsHtml = '';
if (!$isNew) {
  $m = bk_money($booking);
  $payments = db_all('SELECT p.*, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id = p.created_by WHERE p.booking_id = ? ORDER BY p.paid_on DESC, p.id DESC', [$id]);
  $fills = [];
  if ($m['due'] !== null) {
    $fills[] = [$m['due']['what'] === 'deposit' ? t('Deposit {amount}', ['amount' => fmt_money($m['due']['amount'])]) : t('Balance {amount}', ['amount' => fmt_money($m['due']['amount'])]), $m['due']['amount']];
    if ($m['due']['what'] === 'deposit' && abs($m['due']['amount'] - $m['balance']) > BK_EPS) $fills[] = [t('Everything {amount}', ['amount' => fmt_money($m['balance'])]), $m['balance']];
  }
  $payOpen = $payErrors || (!$payments && $booking['status'] !== 'cancelled' && $m['total'] > BK_EPS);
  $pe = function ($k) use (&$payErrors) {
    return isset($payErrors[$k]) ? '<p class="field__error" id="pay-err-' . h($k) . '">' . icon('alert') . '<span>' . h($payErrors[$k]) . '</span></p>' : '';
  };
  ob_start(); ?>
  <section class="card bk-o-2" id="payments" aria-labelledby="pay-h">
    <div class="card__head">
      <div><h2 class="card__title" id="pay-h"><?= h(t('Payments')) ?></h2>
        <p class="card__sub"><?= $m['total'] > BK_EPS ? h(t('{paid} of {total} paid', ['paid' => fmt_money($m['paid']), 'total' => fmt_money($m['total'])])) : h(t('{paid} paid', ['paid' => fmt_money($m['paid'])])) ?></p></div>
    </div>
    <div class="card__body">
      <?php if ($payments) { ?>
        <ul class="bk-pays">
          <?php foreach ($payments as $p) {
            $meta = array_filter([fmt_date($p['paid_on']), bk_method_label($p['method']), trim((string) $p['note'])]); ?>
            <li class="bk-pay<?= (float) $p['amount'] < 0 ? ' bk-pay--refund' : '' ?>">
              <span class="bk-pay__icon" aria-hidden="true"><?= icon((float) $p['amount'] < 0 ? 'refresh' : 'euro') ?></span>
              <div class="bk-pay__main">
                <span class="bk-pay__amount"><?= h(fmt_money($p['amount'])) ?><?php if ((float) $p['amount'] < 0) { ?> <span class="pill pill--muted pill--plain"><?= h(t('Refund')) ?></span><?php } ?></span>
                <span class="bk-pay__meta"><?= h(implode(' · ', $meta)) ?></span>
                <span class="bk-pay__by"><?= h(t('Recorded by {name}', ['name' => trim((string) $p['user_name']) !== '' ? $p['user_name'] : t('someone who has left')])) ?></span>
              </div>
              <?php if (bk_can_delete_payment($p, $me)) { ?>
                <form method="post" action="<?= h(url('booking', ['id' => $id])) ?>" class="bk-pay__del" data-confirm="<?= h(t('Delete the payment of {amount} from {date}?', ['amount' => fmt_money($p['amount']), 'date' => fmt_date($p['paid_on'])])) ?>">
                  <?= csrf_field() ?><input type="hidden" name="action" value="pay_delete"><input type="hidden" name="pay_id" value="<?= (int) $p['id'] ?>">
                  <button type="submit" class="btn btn--ghost btn--icon btn--sm" aria-label="<?= h(t('Delete the payment of {amount} from {date}', ['amount' => fmt_money($p['amount']), 'date' => fmt_date($p['paid_on'])])) ?>" title="<?= h(t('Delete payment')) ?>"><?= icon('trash') ?></button>
                </form>
              <?php } ?>
            </li>
          <?php } ?>
        </ul>
      <?php } else { ?>
        <p class="bk-empty-line"><?= h(t('No payments recorded yet.')) ?></p>
      <?php } ?>

      <details class="disclosure bk-pay-add"<?= $payOpen ? ' open' : '' ?>>
        <summary><span class="row"><?= icon('plus') ?><?= h(t('Record a payment')) ?></span></summary>
        <div class="disclosure__body">
          <form method="post" action="<?= h(url('booking', ['id' => $id])) ?>#payments" class="form" data-once>
            <?= csrf_field() ?><input type="hidden" name="action" value="pay_add">
            <?php if ($payErrors) { ?><div class="callout callout--danger" role="alert"><?= icon('alert') ?><p><?= h(t('The payment wasn’t saved — please check it.')) ?></p></div><?php } ?>
            <div class="field<?= isset($payErrors['amount']) ? ' has-error' : '' ?>">
              <label class="field__label" for="pay-amount"><?= h(t('Amount')) ?></label>
              <div class="input-group"><span class="input-group__addon">€</span><input class="input" id="pay-amount" name="amount" value="<?= h($payIn['amount']) ?>" inputmode="decimal" autocomplete="off" required<?= isset($payErrors['amount']) ? ' aria-invalid="true" aria-describedby="pay-err-amount"' : ' aria-describedby="pay-amount-h"' ?>></div>
              <?php if ($fills) { ?>
                <div class="chips bk-fills" hidden data-bk-fills>
                  <?php foreach ($fills as $fl) { ?><button type="button" class="chip" data-fill-amount="<?= h(bk_money_input($fl[1], true)) ?>"><?= h($fl[0]) ?></button><?php } ?>
                </div>
              <?php } ?>
              <p class="field__help" id="pay-amount-h"><?= h(t('For a refund, put a minus sign in front, e.g. −200.')) ?></p>
              <?= $pe('amount') ?>
            </div>
            <div class="form-row">
              <div class="field<?= isset($payErrors['paid_on']) ? ' has-error' : '' ?>">
                <label class="field__label" for="pay-date"><?= h(t('Paid on')) ?></label>
                <input class="input" type="date" id="pay-date" name="paid_on" value="<?= h($payIn['paid_on']) ?>" min="2000-01-01" max="2100-12-31" required<?= isset($payErrors['paid_on']) ? ' aria-invalid="true" aria-describedby="pay-err-paid_on"' : '' ?>>
                <?= $pe('paid_on') ?>
              </div>
              <div class="field">
                <label class="field__label" for="pay-method"><?= h(t('How')) ?> <?= $opt ?></label>
                <select class="select" id="pay-method" name="method">
                  <option value=""><?= h(t('Not set')) ?></option>
                  <?php foreach (BK_PAYMENT_METHODS as $k => $label) { ?><option value="<?= h($k) ?>"<?= $payIn['method'] === $k ? ' selected' : '' ?>><?= h(t($label)) ?></option><?php } ?>
                </select>
              </div>
            </div>
            <div class="field<?= isset($payErrors['note']) ? ' has-error' : '' ?>">
              <label class="field__label" for="pay-note"><?= h(t('Note')) ?> <?= $opt ?></label>
              <input class="input" id="pay-note" name="note" value="<?= h($payIn['note']) ?>" maxlength="200" autocomplete="off" placeholder="<?= h(t('e.g. Deposit, Balance, Extra night')) ?>">
              <?= $pe('note') ?>
            </div>
            <div class="form-actions"><button type="submit" class="btn btn--primary"><?= icon('check') ?><?= h(t('Save payment')) ?></button></div>
          </form>
        </div>
      </details>
    </div>
  </section>
  <?php $paymentsHtml = ob_get_clean();
}

// ── Notes and history ──
$notesHtml = '';
if (!$isNew) {
  $notes = db_all('SELECT n.*, u.name AS user_name FROM notes n LEFT JOIN users u ON u.id = n.user_id WHERE n.booking_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT 300', [$id]);
  ob_start(); ?>
  <section class="card bk-o-4" id="notes" aria-labelledby="notes-h">
    <div class="card__head"><h2 class="card__title" id="notes-h"><?= h(t('Notes and history')) ?></h2></div>
    <div class="card__body">
      <form method="post" action="<?= h(url('booking', ['id' => $id])) ?>#notes" class="form bk-note-form" data-once>
        <?= csrf_field() ?><input type="hidden" name="action" value="note_add">
        <div class="field<?= $noteError !== '' ? ' has-error' : '' ?>">
          <label class="sr-only" for="note-body"><?= h(t('New note')) ?></label>
          <textarea class="textarea bk-textarea--sm" id="note-body" name="body" rows="3" maxlength="5000" placeholder="<?= h(t('Add a note for the team: a call, an email, a change of plan…')) ?>"<?= $noteError !== '' ? ' aria-invalid="true" aria-describedby="note-err"' : '' ?>><?= h($noteIn) ?></textarea>
          <?php if ($noteError !== '') { ?><p class="field__error" id="note-err"><?= icon('alert') ?><span><?= h($noteError) ?></span></p><?php } ?>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn--secondary btn--sm"><?= icon('note') ?><?= h(t('Add note')) ?></button></div>
      </form>
      <?php if ($notes) { ?>
        <ol class="timeline bk-timeline"><?php foreach ($notes as $n) echo bk_timeline_item($n); ?></ol>
      <?php } else { ?>
        <p class="bk-empty-line"><?= h(t('Nothing here yet.')) ?></p>
      <?php } ?>
    </div>
  </section>
  <?php $notesHtml = ob_get_clean();
}

// ── The request it came from ──
$requestHtml = '';
if ($request) {
  $other = db_all('SELECT id, ref FROM bookings WHERE request_id = ?' . ($isNew ? '' : ' AND id <> ?') . ' ORDER BY id', $isNew ? [(int) $request['id']] : [(int) $request['id'], $id]);
  ob_start(); ?>
  <section class="card card--accent bk-o-5" aria-labelledby="req-h">
    <div class="card__head"><div><h2 class="card__title" id="req-h"><?= h(t('From the website')) ?></h2>
      <p class="card__sub"><?= h(t('Request {ref} · received {date}', ['ref' => $request['ref'], 'date' => fmt_date($request['created_at'])])) ?></p></div></div>
    <div class="card__body">
      <dl class="kv kv--compact">
        <?php foreach (['name' => t('Name'), 'email' => t('Email'), 'travel_dates' => t('When'), 'travellers' => t('Travellers'), 'interests' => t('Would like to see')] as $k => $label) {
          if (trim((string) $request[$k]) === '') continue; ?>
          <div class="kv__row"><dt class="kv__key"><?= h($label) ?></dt><dd class="kv__val"><?= h($request[$k]) ?></dd></div>
        <?php } ?>
      </dl>
      <?php if (trim((string) $request['message']) !== '') { ?><blockquote class="bk-quote"><?= h(excerpt($request['message'], 400)) ?></blockquote><?php } ?>
      <?php if ($other) { ?>
        <div class="callout callout--warn bk-other"><?= icon('info') ?><p><?= h(tp(count($other), 'This request already has another booking:', 'This request already has {n} other bookings:')) ?>
          <?php foreach ($other as $i => $o) { ?><?= $i ? ', ' : ' ' ?><a href="<?= h(url('booking', ['id' => (int) $o['id']])) ?>"><?= h($o['ref']) ?></a><?php } ?></p></div>
      <?php } ?>
      <div class="btn-row"><a class="btn btn--secondary btn--sm" href="<?= h(url('request', ['id' => (int) $request['id']])) ?>"><?= icon('inbox') ?><?= h(t('Open the request')) ?></a></div>
    </div>
  </section>
  <?php $requestHtml = ob_get_clean();
}

// ── Delete (owners) ──
$dangerHtml = '';
if (!$isNew && is_owner()) {
  ob_start(); ?>
  <section class="danger-zone bk-o-6" aria-labelledby="del-h">
    <h2 class="danger-zone__title" id="del-h"><?= icon('trash') ?><?= h(t('Delete this booking')) ?></h2>
    <p class="danger-zone__text"><?= h(t('Deletes the booking with its payments and notes. This can’t be undone. To keep the history, set the status to “Cancelled” instead.')) ?></p>
    <form method="post" action="<?= h(url('booking', ['id' => $id])) ?>" data-confirm="<?= h(t('Delete booking {ref} for {name}, with its payments and notes? This can’t be undone.', ['ref' => $booking['ref'], 'name' => $booking['client_name']])) ?>">
      <?= csrf_field() ?><input type="hidden" name="action" value="delete">
      <button type="submit" class="btn btn--danger btn--sm"><?= icon('trash') ?><?= h(t('Delete booking')) ?></button>
    </form>
  </section>
  <?php $dangerHtml = ob_get_clean();
}

// ── Tips for a new booking ──
$tipsHtml = '';
if ($isNew) {
  ob_start(); ?>
  <section class="card card--muted bk-o-6">
    <div class="card__body bk-tips">
      <p class="strong"><?= icon('info') ?> <?= h(t('Good to know')) ?></p>
      <ul>
        <li><?= h(t('The reference (like B-2611-0001) is given when you create the booking.')) ?></li>
        <li><?= h(t('Payments and notes can be added once the booking is created.')) ?></li>
        <li><?= h(t('“Suggest from website price” uses the same prices and group discounts as the website.')) ?></li>
      </ul>
    </div>
  </section>
  <?php $tipsHtml = ob_get_clean();
}

echo '<div class="bk-page' . ($isNew ? ' bk-page--new' : '') . '"><div class="bk-page__main">' . $summaryHtml . $formHtml . '</div>'
  . '<aside class="bk-page__aside" aria-label="' . h(t('Payments and notes')) . '">' . $paymentsHtml . $requestHtml . $notesHtml . $dangerHtml . $tipsHtml . '</aside></div>';

if ($isNew) {
  $title = t('New booking');
  $crumbs = [[t('Bookings'), url('bookings')], [t('New booking'), '']];
  $lead = $request ? t('From request {ref}. Check the details, then create the booking.', ['ref' => $request['ref']]) : '';
  $actions = '';
} else {
  $title = (string) $booking['client_name'];
  $crumbs = [[t('Bookings'), url('bookings')], [(string) $booking['ref'], '']];
  $lead = '';
  $actions = '';
  if (bk_valid_date($booking['start_date']) !== '') {
    $actions .= '<a class="btn btn--secondary" href="' . h(url('calendar', ['m' => substr((string) $booking['start_date'], 0, 7)])) . '">' . icon('calendar') . h(t('Show in calendar')) . '</a>';
  }
}
render($title, ob_get_clean(), [
  'nav' => 'bookings',
  'css' => ['bookings.css'],
  'js' => ['booking.js'],
  'crumbs' => $crumbs,
  'lead' => $lead,
  'actions' => $actions,
  'status' => $errors || $payErrors || $noteError !== '' ? 422 : 200,
]);
