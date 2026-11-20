<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
/*
 * CSV downloads (owners only): ?p=export&type=requests|bookings|payments. Without a type: a small page that
 * offers the three files.
 *
 *   type=requests   the inbox's filters work here too (status, kind, q, mine, due — see requests-lib.php);
 *                   no status = everything except spam, status=spam = only spam
 *   type=bookings   status = quote|confirmed|completed|cancelled · when = upcoming|past (by the trip's last day,
 *                   Tbilisi date) · q = search in ref, client, email, phone, tour
 *   type=payments   from / to = Y-m-d (paid on, inclusive) · booking = a booking id
 *
 * Files are UTF-8 with a BOM (Excel opens them correctly), every cell quoted. Separator: sep=comma|semicolon;
 * by default a semicolon (with decimal commas) in the Georgian interface — Excel on a PC set to Georgian or
 * Russian formats splits files on ";" — else a comma. Text cells that start with = + - @ tab or CR get a leading '
 * so spreadsheet programs never run them as formulas; a phone number ("+995 …") gets an invisible word joiner
 * instead, so it reads cleanly. Each export writes one audit line (export.<type>).
 * The file is only sent for a click inside the team area (same-origin), or after the confirm page's POST: a link
 * on another website can't make a signed-in owner download every client's details.
 *
 * To add an export: write export_<type>(array $me): void (send the file with export_send()) and add the type
 * to EXPORT_TYPES.
 */
require_once __DIR__ . '/requests-lib.php';
require_once __DIR__ . '/bookings-lib.php';
$me = require_owner();

/** type => [title, description] (English; shown through t()). */
const EXPORT_TYPES = [
  'requests' => ['Requests', 'Everything sent from the website’s forms (spam left out), with status, who it’s assigned to and every field as sent.'],
  'bookings' => ['Bookings', 'Every booking with client, tour, dates, travellers, price, deposit, what’s been paid and what’s still due.'],
  'payments' => ['Payments', 'Every payment received, with its booking and client — handy for the accountant.'],
];

/** The separator for this download: ',' or ';' (see the top of this file). */
function export_sep(): string
{
  $sep = get('sep');
  if ($sep === 'semicolon') return ';';
  if ($sep === 'comma') return ',';
  return mfs_lang() === 'ka' ? ';' : ',';
}

/** One CSV cell: quoted, inner quotes doubled; text starting with a formula character is made harmless. */
function export_cell($v): string
{
  if ($v === null) return '""';
  if (is_int($v) || is_float($v)) {
    $n = is_float($v) ? rtrim(rtrim(number_format($v, 2, '.', ''), '0'), '.') : (string) $v;
    // With ";" files (comma-decimal formats) the decimal mark is a comma too, or 12.5 would turn into a date.
    return '"' . (export_sep() === ';' ? str_replace('.', ',', $n) : $n) . '"';
  }
  $s = (string) $v;
  if ($s !== '' && strpos("=+-@\t\r", $s[0]) !== false) {
    // A phone number can't hold a formula: a word joiner (U+2060, invisible) keeps it text without a visible '.
    $s = preg_match('~^\+[\d\s().\/-]{4,40}$~', $s) ? "\u{2060}" . $s : "'" . $s;
  }
  return '"' . str_replace('"', '""', $s) . '"';
}

function export_line(array $cells): string
{
  return implode(export_sep(), array_map('export_cell', $cells)) . "\r\n";
}

/** Sends a CSV download: headers + BOM + header row, then each row from $rows (any iterable) through $map. */
function export_send(string $type, array $header, iterable $rows, callable $map, string $auditDetails = ''): void
{
  @set_time_limit(120);
  while (ob_get_level() > 0) ob_end_clean();
  $file = 'million-first-steps-' . $type . '-' . local_today() . '.csv';
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="' . $file . '"');
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: no-store');
  echo "\xEF\xBB\xBF", export_line(array_map('t', $header));
  $n = 0;
  foreach ($rows as $r) {
    echo export_line($map($r));
    $n++;
  }
  audit('export.' . $type, '', trim($n . ' rows ' . $auditDetails));
  exit;
}

/** A lazily-read query (rows are streamed, not loaded all at once). */
function export_rows(string $sql, array $args): Generator
{
  $st = db()->prepare($sql);
  $st->execute($args);
  while (($r = $st->fetch(PDO::FETCH_ASSOC)) !== false) yield $r;
}

/** A booking's tour: a catalogue tour by its name in the interface language, a custom trip by its own name. */
function export_tour(array $b): string
{
  static $known = null;
  if ($known === null) $known = tours();
  $tid = trim((string) ($b['tour_id'] ?? ''));
  return $tid !== '' && isset($known[$tid]) ? tour_name($tid) : trim((string) ($b['tour_name'] ?? ''));
}

/** Tbilisi local time for a UTC timestamp, 'Y-m-d H:i' ('' if empty). */
function export_local($utc): string
{
  $d = utc_to_local($utc);
  return $d ? $d->format('Y-m-d H:i') : '';
}

// ── Requests ─────────────────────────────────────────────────────────────────────────────────────────────────
function export_requests(array $me): void
{
  $f = req_filters();
  list($w, $a) = req_where($f, (int) $me['id']);
  $sql = "SELECT r.*, u.name AS assignee,
      (SELECT COUNT(*) FROM notes n WHERE n.request_id = r.id AND n.kind IN ('note','email')) AS note_count,
      (SELECT GROUP_CONCAT(b.ref, ' ') FROM bookings b WHERE b.request_id = r.id) AS booking_refs
    FROM requests r LEFT JOIN users u ON u.id = r.assigned_to WHERE $w ORDER BY r.created_at DESC, r.id DESC";
  $header = ['Reference', 'Received (Tbilisi time)', 'Status', 'Kind', 'Form', 'Name', 'Email', 'Phone', 'Country', 'Company',
    'Travel dates', 'Travellers', 'Would like to see', 'Tour', 'Travel style', 'Message', 'Website language', 'Sent from page',
    'Assigned to', 'Follow up on', 'Notes', 'Bookings', 'Last change (Tbilisi time)', 'All fields as sent'];
  $details = implode(' ', array_filter([
    $f['status'] !== '' ? 'status=' . $f['status'] : '', $f['kind'] !== '' ? 'kind=' . $f['kind'] : '',
    $f['q'] !== '' ? 'search' : '', $f['mine'] ? 'mine' : '', $f['due'] ? 'due' : '',
  ]));
  export_send('requests', $header, export_rows($sql, $a), function ($r) {
    $fields = req_fields($r);
    $all = [];
    foreach ($fields as $fi) $all[] = $fi['l'] . ': ' . $fi['v'];
    return [
      $r['ref'], export_local($r['created_at']), t(REQUEST_STATUSES[$r['status']] ?? $r['status']), t(REQUEST_KINDS[$r['kind']] ?? $r['kind']),
      $r['kind_label'], $r['name'], $r['email'], $r['phone'], req_country($r, $fields), $r['company'],
      $r['travel_dates'], $r['travellers'], $r['interests'], $r['tour_id'] ? tour_name($r['tour_id']) : '', $r['tier'] ? tier_name($r['tier']) : '',
      $r['message'], req_lang_name($r['lang'], false), $r['page'],
      $r['assignee'], $r['follow_up_on'], (int) $r['note_count'], (string) $r['booking_refs'], export_local($r['updated_at']), implode("\n", $all),
    ];
  }, $details);
}

// ── Bookings ─────────────────────────────────────────────────────────────────────────────────────────────────
function export_bookings(array $me): void
{
  $w = [];
  $a = [];
  $status = get('status');
  if (isset(BOOKING_STATUSES[$status])) {
    $w[] = 'b.status = ?';
    $a[] = $status;
  }
  $when = get('when');
  if ($when === 'upcoming' || $when === 'past') {
    $w[] = "COALESCE(NULLIF(b.end_date, ''), NULLIF(b.start_date, ''), '9999-12-31') " . ($when === 'upcoming' ? '>=' : '<') . ' ?';
    $a[] = local_today();
  }
  $q = mfs_cut(get('q'), 100);
  if ($q !== '') {
    $lowerFn = req_lower_available();
    $needle = $lowerFn && function_exists('mb_strtolower') ? mb_strtolower($q, 'UTF-8') : $q;
    $or = [];
    foreach (['b.ref', 'b.client_name', 'b.client_email', 'b.client_phone', 'b.tour_name'] as $col) {
      $or[] = ($lowerFn ? "mfs_lower(COALESCE($col, ''))" : "COALESCE($col, '')") . " LIKE ? ESCAPE '!'";
      $a[] = req_like($needle);
    }
    $w[] = '(' . implode(' OR ', $or) . ')';
  }
  $where = $w ? implode(' AND ', $w) : '1 = 1';
  $sql = "SELECT b.*, r.ref AS request_ref, u.name AS creator,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.booking_id = b.id), 0) AS paid
    FROM bookings b LEFT JOIN requests r ON r.id = b.request_id LEFT JOIN users u ON u.id = b.created_by
    WHERE $where ORDER BY COALESCE(NULLIF(b.start_date, ''), '9999-12-31'), b.id";
  $header = ['Reference', 'Status', 'Client', 'Email', 'Phone', 'Country', 'Language', 'Tour', 'Travel style', 'Start date', 'End date',
    'Adults', 'Children', 'Total price (EUR)', 'Deposit (EUR)', 'Deposit due', 'Balance due', 'Paid (EUR)', 'Still to pay (EUR)',
    'Guide', 'Driver', 'Vehicle', 'Accommodation', 'Notes', 'From request', 'Created by', 'Created (Tbilisi time)', 'Last change (Tbilisi time)'];
  $details = implode(' ', array_filter([isset(BOOKING_STATUSES[$status]) ? 'status=' . $status : '', in_array($when, ['upcoming', 'past'], true) ? 'when=' . $when : '', $q !== '' ? 'search' : '']));
  export_send('bookings', $header, export_rows($sql, $a), function ($b) {
    $total = round((float) $b['total_price'], 2);
    $paid = round((float) $b['paid'], 2);
    // Still to pay as the panel shows it: nothing for cancelled bookings, never below zero.
    $money = bk_money($b);
    $lang = (string) $b['client_lang'];
    return [
      $b['ref'], t(BOOKING_STATUSES[$b['status']] ?? $b['status']), $b['client_name'], $b['client_email'], $b['client_phone'], $b['client_country'],
      $lang !== '' ? req_lang_name($lang, false) : '', export_tour($b),
      $b['tier'] ? tier_name($b['tier']) : '', $b['start_date'], $b['end_date'], (int) $b['adults'], (int) $b['children'],
      $total, round((float) $b['deposit_amount'], 2), $b['deposit_due'], $b['balance_due'], $paid, round((float) $money['balance'], 2),
      $b['guide'], $b['driver'], $b['vehicle'], $b['accommodation'], $b['notes'], $b['request_ref'], $b['creator'],
      export_local($b['created_at']), export_local($b['updated_at']),
    ];
  }, $details);
}

// ── Payments ─────────────────────────────────────────────────────────────────────────────────────────────────
function export_payments(array $me): void
{
  $w = [];
  $a = [];
  $from = req_valid_date(get('from'));
  $to = req_valid_date(get('to'));
  if ($from !== '') { $w[] = 'p.paid_on >= ?'; $a[] = $from; }
  if ($to !== '') { $w[] = 'p.paid_on <= ?'; $a[] = $to; }
  $bid = get_int('booking');
  if ($bid > 0) { $w[] = 'p.booking_id = ?'; $a[] = $bid; }
  $where = $w ? implode(' AND ', $w) : '1 = 1';
  $sql = "SELECT p.*, b.ref AS booking_ref, b.client_name, b.tour_id, b.tour_name, b.start_date, b.status AS booking_status, u.name AS recorder
    FROM payments p JOIN bookings b ON b.id = p.booking_id LEFT JOIN users u ON u.id = p.created_by
    WHERE $where ORDER BY p.paid_on, p.id";
  $header = ['Paid on', 'Amount (EUR)', 'Method', 'Note', 'Booking', 'Booking status', 'Client', 'Tour', 'Trip starts', 'Recorded by', 'Recorded (Tbilisi time)'];
  $details = implode(' ', array_filter([$from !== '' ? 'from=' . $from : '', $to !== '' ? 'to=' . $to : '', $bid > 0 ? 'booking:' . $bid : '']));
  export_send('payments', $header, export_rows($sql, $a), function ($p) {
    return [
      $p['paid_on'], round((float) $p['amount'], 2), $p['method'], $p['note'], $p['booking_ref'], t(BOOKING_STATUSES[$p['booking_status']] ?? $p['booking_status']),
      $p['client_name'], export_tour($p), $p['start_date'], $p['recorder'],
      export_local($p['created_at']),
    ];
  }, $details);
}

// ── Dispatch ─────────────────────────────────────────────────────────────────────────────────────────────────
/** True when this GET is a click inside the team area (not a link on another website, nor a bounced one). */
function export_same_origin_click(): bool
{
  if (isset($_GET['_b'])) return false;
  $site = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
  // same-origin: a link in the team area; none: typed into the address bar or a bookmark (no other site involved).
  if ($site !== '') return $site === 'same-origin' || $site === 'none';
  // Older browsers: the Referer (sent for same-origin pages, see Referrer-Policy) must be ours.
  return (string) ($_SERVER['HTTP_REFERER'] ?? '') !== '' && mfs_same_origin();
}

$type = get('type');
if (isset(EXPORT_TYPES[$type])) {
  if (is_post()) csrf_check();
  if (is_post() || export_same_origin_click()) {
    $fn = 'export_' . $type;
    $fn($me);
  }
  // Opened from somewhere else: ask first, with a button that sends the form.
  $q = $_GET;
  unset($q['_b'], $q['p']);
  ob_start(); ?>
  <section class="card">
    <div class="card__body stack">
      <p><?= h(t('Download the {file} spreadsheet? It holds clients’ personal details — keep it somewhere private.', ['file' => t(EXPORT_TYPES[$type][0])])) ?></p>
      <form method="post" action="<?= h(url('export', $q)) ?>" class="btn-row">
        <?= csrf_field() ?>
        <button type="submit" class="btn btn--primary"><?= icon('download') ?><?= h(t('Download CSV')) ?></button>
        <a class="btn btn--secondary" href="<?= h(url('export')) ?>"><?= h(t('Not now')) ?></a>
      </form>
    </div>
  </section>
  <?php
  render(t('Export'), ob_get_clean(), ['nav' => 'settings', 'crumbs' => [[t('Settings'), url('settings')], [t('Export'), url('export')], [t(EXPORT_TYPES[$type][0]), '']]]);
}

// No (or an unknown) type: the choice of files.
$counts = [
  'requests' => (int) db_value("SELECT COUNT(*) FROM requests WHERE status <> 'spam'"),
  'bookings' => (int) db_value('SELECT COUNT(*) FROM bookings'),
  'payments' => (int) db_value('SELECT COUNT(*) FROM payments'),
];
$icons = ['requests' => 'inbox', 'bookings' => 'suitcase', 'payments' => 'euro'];
$units = [
  'requests' => ['{n} request', '{n} requests'],
  'bookings' => ['{n} booking', '{n} bookings'],
  'payments' => ['{n} payment', '{n} payments'],
];
ob_start(); ?>
<div class="stack">
  <?php if ($type !== ''): ?>
    <div class="callout callout--warn"><?= icon('alert') ?><p><?= h(t('There is no export called “{type}”. Choose one of these instead.', ['type' => $type])) ?></p></div>
  <?php endif; ?>
  <div class="grid grid--3 req-exports">
    <?php foreach (EXPORT_TYPES as $k => $meta): ?>
    <section class="card req-export">
      <div class="card__head"><div class="req-export__head"><span class="list__icon" aria-hidden="true"><?= icon($icons[$k]) ?></span><h2 class="card__title"><?= h(t($meta[0])) ?></h2></div></div>
      <div class="card__body"><p><?= h(t($meta[1])) ?></p><p class="muted small req-export__count"><?= h(tp($counts[$k], $units[$k][0], $units[$k][1])) ?></p></div>
      <div class="card__foot">
        <?php if ($counts[$k] > 0): ?>
          <a class="btn btn--primary btn--block" href="<?= h(url('export', ['type' => $k])) ?>"><?= icon('download') ?><?= h(t('Download CSV')) ?></a>
        <?php else: ?>
          <span class="btn btn--secondary btn--block" aria-disabled="true"><?= icon('download') ?><?= h(t('Nothing to export yet')) ?></span>
        <?php endif; ?>
      </div>
    </section>
    <?php endforeach; ?>
  </div>
  <div class="callout callout--info"><?= icon('info') ?><p><?= h(t('The files open in Excel, Numbers or Google Sheets. They contain clients’ personal details — keep them somewhere safe and delete them when you no longer need them.')) ?></p></div>
  <?php $other = export_sep() === ';' ? 'comma' : 'semicolon'; ?>
  <p class="muted small"><?= h(export_sep() === ';'
    ? t('These files use semicolons between columns, as Excel expects on computers set to Georgian or Russian formats. Everything in one column? Download with commas:')
    : t('Excel shows everything in one column? Your computer probably expects semicolons — download with semicolons:')) ?>
    <?php foreach (EXPORT_TYPES as $k => $meta) if ($counts[$k] > 0) { ?><a href="<?= h(url('export', ['type' => $k, 'sep' => $other])) ?>"><?= h(t($meta[0])) ?></a> <?php } ?>
  </p>
</div>
<?php
render(t('Export'), ob_get_clean(), [
  'nav' => 'settings',
  'css' => ['requests.css'],
  'crumbs' => [[t('Settings'), url('settings')], [t('Export'), '']],
  'lead' => t('Download your data as spreadsheet files.'),
]);
