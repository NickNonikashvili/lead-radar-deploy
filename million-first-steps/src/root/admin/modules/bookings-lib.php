<?php
/*
 * Shared by the Bookings pages: modules/bookings.php (list), booking.php (one booking: view, edit, new,
 * payments, notes) and calendar.php (month view). Not a page itself: index.php only runs the files it
 * lists, and modules/ is closed to the web.
 *
 *   bk_money($booking)            paid / balance / payment state of a row that has a 'paid' column
 *                                 (from BK_PAID_JOIN), with the next amount due and whether it's overdue
 *   bk_suggest($tour, $tier, $n)  the website calculator's price: per person rounded to €10, × travellers
 *   bk_new_ref($pdo)              next booking reference: B-<yymm>-<0001> (inside a write transaction)
 *   bk_parse_dates($text, $ref)   "12 May – 18 May", "12–18 May 2027", "5月12日" … → ['Y-m-d', 'Y-m-d'|'']
 *   bk_parse_party($text)         "2 adults, 1 child" (in any of the website's languages) → [adults, children]
 *   bk_match_tour($text)          a catalogue tour (and travel style) named in a request's interests
 *   bk_note_text($kind, $body)    timeline text in the user's language (system/status notes are English)
 *
 * Timeline entries written here (notes.kind / English body):
 *   booking  system  "Booking created" · "Booking created from request <ref>"
 *            status  "Status changed from Quote to Confirmed"
 *            system  "Payment recorded: €300 on 2026-11-12 (Bank transfer)" · "Payment deleted: €300 on 2026-11-12"
 *   request  status  "Status changed from Quoted to Booked"
 *            system  "Booking <ref> created" · "Booking <ref> deleted"
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
if (defined('MFS_BOOKINGS_LIB')) return;
define('MFS_BOOKINGS_LIB', 1);

const BK_PER_PAGE = 25;
/** Amounts closer than this count as equal (money is stored with 2 decimals). */
const BK_EPS = 0.004;
/** How payments were made: stored value => English label. */
const BK_PAYMENT_METHODS = [
  'Bank transfer' => 'Bank transfer',
  'Card' => 'Card',
  'Cash' => 'Cash',
  'Other' => 'Other',
];
/** Longest text the booking form keeps per field. */
const BK_TEXT_LIMITS = [
  'client_name' => 200, 'client_email' => 200, 'client_phone' => 60, 'client_country' => 100, 'tour_name' => 200,
  'guide' => 200, 'driver' => 200, 'vehicle' => 200, 'accommodation' => 2000, 'notes' => 5000,
];
/** Website language codes → English names (translated with t()). */
const BK_LANG_NAMES = [
  'en' => 'English', 'ru' => 'Russian', 'ka' => 'Georgian', 'es' => 'Spanish', 'fr' => 'French',
  'it' => 'Italian', 'pt' => 'Portuguese', 'de' => 'German', 'zh' => 'Chinese',
];
/** Total paid per booking: join it as `pp` and read COALESCE(pp.paid, 0). */
const BK_PAID_JOIN = 'LEFT JOIN (SELECT booking_id, SUM(amount) AS paid, COUNT(*) AS pay_n FROM payments GROUP BY booking_id) pp ON pp.booking_id = b.id';
/** A booking's last day as SQL (end date, else start date). */
const BK_END_SQL = "COALESCE(NULLIF(b.end_date, ''), b.start_date)";

// ── Small helpers ───────────────────────────────────────────────────────────

function bk_lc(string $s): string
{
  return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
}

function bk_len(string $s): int
{
  return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
}

/** A valid 'Y-m-d' between 2000 and 2100, or ''. */
function bk_valid_date($s): string
{
  $s = trim((string) $s);
  if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m)) return '';
  if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1]) || (int) $m[1] < 2000 || (int) $m[1] > 2100) return '';
  return $s;
}

/** 'Y-m-d' plus $n days ('' stays ''). */
function bk_add_days(string $ymd, int $n): string
{
  $d = DateTime::createFromFormat('!Y-m-d', $ymd, new DateTimeZone('UTC'));
  if (!$d) return '';
  if ($n !== 0) $d->modify(($n > 0 ? '+' : '') . $n . ' days');
  return $d->format('Y-m-d');
}

/** Whole days from $a to $b ('Y-m-d'); null if either is invalid. */
function bk_days_between(string $a, string $b): ?int
{
  $x = DateTime::createFromFormat('!Y-m-d', $a, new DateTimeZone('UTC'));
  $y = DateTime::createFromFormat('!Y-m-d', $b, new DateTimeZone('UTC'));
  if (!$x || !$y) return null;
  return (int) round(($y->getTimestamp() - $x->getTimestamp()) / 86400);
}

/** A booking's last day: end date, else the start date ('' without dates). */
function bk_end(array $b): string
{
  $e = bk_valid_date($b['end_date'] ?? '');
  return $e !== '' ? $e : bk_valid_date($b['start_date'] ?? '');
}

/** Short month name in the user's language: 1 → 'Jan'. */
function bk_month_short(int $m): string
{
  $n = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return t($n[max(1, min(12, $m)) - 1]);
}

/** Full month name in the user's language: 1 → 'January'. */
function bk_month_long(int $m): string
{
  $n = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return t($n[max(1, min(12, $m)) - 1]);
}

/** Short weekday name: 1 (Monday) … 7 (Sunday). */
function bk_weekday_short(int $n): string
{
  $d = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return t($d[max(1, min(7, $n)) - 1]);
}

/**
 * Trip dates for people: "12–16 May 2027", "28 Apr – 3 May 2027", "28 Dec 2026 – 3 Jan 2027", "12 May 2027".
 * $year = false leaves out the year when both dates are in the current year.
 */
function bk_dates_label($start, $end = '', bool $year = true): string
{
  $s = bk_valid_date($start);
  $e = bk_valid_date($end);
  if ($s === '') return '';
  $ys = (int) substr($s, 0, 4);
  $ms = (int) substr($s, 5, 2);
  $ds = (int) substr($s, 8, 2);
  $thisYear = (int) substr(local_today(), 0, 4);
  if ($e === '' || $e <= $s) {
    return $ds . ' ' . bk_month_short($ms) . (($year || $ys !== $thisYear) ? ' ' . $ys : '');
  }
  $ye = (int) substr($e, 0, 4);
  $me = (int) substr($e, 5, 2);
  $de = (int) substr($e, 8, 2);
  $showYear = $year || $ys !== $thisYear || $ye !== $thisYear;
  if ($ys === $ye && $ms === $me) return $ds . '–' . $de . ' ' . bk_month_short($me) . ($showYear ? ' ' . $ye : '');
  if ($ys === $ye) return $ds . ' ' . bk_month_short($ms) . ' – ' . $de . ' ' . bk_month_short($me) . ($showYear ? ' ' . $ye : '');
  return $ds . ' ' . bk_month_short($ms) . ' ' . $ys . ' – ' . $de . ' ' . bk_month_short($me) . ' ' . $ye;
}

/** Number of days a trip lasts (both ends included); 0 without a start date. */
function bk_trip_days(array $b): int
{
  $s = bk_valid_date($b['start_date'] ?? '');
  if ($s === '') return 0;
  $n = bk_days_between($s, bk_end($b));
  return $n === null ? 1 : max(1, $n + 1);
}

/**
 * Where the trip stands compared with today: ['text', 'tone'] with tone soon|now|past|'' —
 * "Starts in 12 days", "Starts tomorrow", "On the trip · day 3 of 5", "Ended 4 days ago".
 */
function bk_when(array $b): array
{
  $s = bk_valid_date($b['start_date'] ?? '');
  if ($s === '' || ($b['status'] ?? '') === 'cancelled') return ['', ''];
  $d = days_until($s);
  $e = days_until(bk_end($b));
  if ($d === null || $e === null) return ['', ''];
  if ($d > 1) return [tp($d, 'Starts in {n} day', 'Starts in {n} days'), $d <= 7 ? 'soon' : ''];
  if ($d === 1) return [t('Starts tomorrow'), 'soon'];
  if ($d === 0) return [t('Starts today'), 'now'];
  if ($e >= 0) return [t('On the trip · day {day} of {days}', ['day' => 1 - $d, 'days' => bk_trip_days($b)]), 'now'];
  return [tp(-$e, 'Ended {n} day ago', 'Ended {n} days ago'), 'past'];
}

/** "2 adults, 1 child". */
function bk_party_label($adults, $children): string
{
  $a = (int) $adults;
  $c = (int) $children;
  $out = tp($a, '{n} adult', '{n} adults');
  if ($c > 0) $out .= ', ' . tp($c, '{n} child', '{n} children');
  return $out;
}

/** "The Cradle of Wine" (+ " · Explorer" when $withTier) — or "Custom trip" / "No tour chosen yet". */
function bk_tour_label(array $b, bool $withTier = true): string
{
  // A catalogue tour by its name in the interface language; a custom trip by the name it was given.
  $tid = trim((string) ($b['tour_id'] ?? ''));
  $name = $tid !== '' && isset(tours()[$tid]) ? tour_name($tid) : trim((string) ($b['tour_name'] ?? ''));
  if ($name === '' && $tid !== '') $name = tour_name($tid);
  if ($name === '') $name = t('No tour chosen yet');
  $tier = trim((string) ($b['tier'] ?? ''));
  return ($withTier && $tier !== '') ? $name . ' · ' . tier_name($tier) : $name;
}

/** "Russian · Русский" for a website language code ('' if none). */
function bk_lang_name($code): string
{
  $code = strtolower(trim((string) $code));
  if ($code === '') return '';
  $en = BK_LANG_NAMES[$code] ?? '';
  $native = '';
  foreach ((array) (catalog()['languages'] ?? []) as $l) {
    if (is_array($l) && (string) ($l['code'] ?? '') === $code) $native = (string) ($l['name'] ?? '');
  }
  if ($en === '') return $native !== '' ? $native : strtoupper($code);
  $label = t($en);
  return ($native !== '' && $native !== $label && $native !== $en) ? $label . ' · ' . $native : $label;
}

/** The website's language codes (from the catalogue), in website order. */
function bk_lang_codes(): array
{
  $out = [];
  foreach ((array) (catalog()['languages'] ?? []) as $l) {
    if (is_array($l) && preg_match('/^[a-z]{2}$/', (string) ($l['code'] ?? ''))) $out[] = (string) $l['code'];
  }
  return $out ?: array_keys(BK_LANG_NAMES);
}

/** A payment method's label in the user's language (unknown text shown as typed). */
function bk_method_label($m): string
{
  $m = trim((string) $m);
  return isset(BK_PAYMENT_METHODS[$m]) ? t(BK_PAYMENT_METHODS[$m]) : $m;
}

/** A money amount for an input field: 1250 → '1250', 1250.5 → '1250.50', 0 → ''. */
function bk_money_input($n, bool $keepZero = false): string
{
  $n = round((float) $n, 2);
  if (abs($n) < BK_EPS && !$keepZero) return '';
  return number_format($n, (abs($n - floor($n)) > BK_EPS) ? 2 : 0, '.', '');
}

// ── Money ───────────────────────────────────────────────────────────────────

/**
 * The money side of a booking row (needs a 'paid' column, e.g. COALESCE(pp.paid, 0) AS paid):
 *   total, paid, balance (total − paid, never below 0), deposit,
 *   state:  none (no price yet) | unpaid | part (some paid, less than the deposit) | deposit (deposit received)
 *           | paid (paid in full) | over (overpaid) | cancelled
 *   label, pill (css modifier), over_by (overpaid amount),
 *   due:    null or ['what' => 'deposit'|'balance', 'amount', 'date' ('' if none), 'days' (null if no date),
 *           'overdue' => bool, 'soon' => bool (within 14 days)]
 */
function bk_money(array $b): array
{
  $total = round((float) ($b['total_price'] ?? 0), 2);
  $paid = round((float) ($b['paid'] ?? 0), 2);
  $deposit = round((float) ($b['deposit_amount'] ?? 0), 2);
  $balance = max(0.0, round($total - $paid, 2));
  $status = (string) ($b['status'] ?? '');
  $m = ['total' => $total, 'paid' => $paid, 'balance' => $balance, 'deposit' => $deposit, 'over_by' => 0.0, 'due' => null];

  if ($status === 'cancelled') {
    $m['balance'] = 0.0;
    $m['state'] = 'cancelled';
    $m['label'] = $paid > BK_EPS ? t('{amount} received', ['amount' => fmt_money($paid)]) : ($paid < -BK_EPS ? t('{amount} refunded', ['amount' => fmt_money(-$paid)]) : t('Nothing paid'));
    $m['pill'] = 'muted';
    return $m;
  }
  if ($total <= BK_EPS && abs($paid) <= BK_EPS) {
    $m['state'] = 'none';
    $m['label'] = t('No price yet');
    $m['pill'] = 'muted';
  } elseif ($paid > $total + BK_EPS) {
    $m['state'] = 'over';
    $m['over_by'] = round($paid - $total, 2);
    $m['label'] = t('Overpaid by {amount}', ['amount' => fmt_money($m['over_by'])]);
    $m['pill'] = 'blue';
  } elseif ($total > BK_EPS && abs($total - $paid) <= BK_EPS) {
    $m['state'] = 'paid';
    $m['label'] = t('Paid in full');
    $m['pill'] = 'green';
  } elseif ($paid <= BK_EPS) {
    $m['state'] = 'unpaid';
    $m['label'] = t('Unpaid');
    $m['pill'] = 'gold';
  } elseif ($deposit > BK_EPS && $paid + BK_EPS >= $deposit) {
    $m['state'] = 'deposit';
    $m['label'] = t('Deposit received');
    $m['pill'] = 'blue';
  } else {
    $m['state'] = 'part';
    $m['label'] = t('Part paid');
    $m['pill'] = 'quoted';
  }

  // What's due next: the deposit until it's in (when it has its own due date, or nothing else has one), then
  // the balance. Once the balance date has passed — or, without one, the trip is over — everything still unpaid
  // is overdue, whether or not the deposit ever came in.
  if ($balance > BK_EPS) {
    $today = local_today();
    $balDate = bk_valid_date($b['balance_due'] ?? '');
    $depDate = bk_valid_date($b['deposit_due'] ?? '');
    $tripOver = $balDate === '' && bk_end($b) !== '' && bk_end($b) < $today;
    $balLate = ($balDate !== '' && $balDate < $today) || $tripOver;
    $depPending = $deposit > BK_EPS && $paid + BK_EPS < $deposit;
    if ($depPending && !$balLate && ($depDate !== '' || $balDate === '')) {
      $m['due'] = ['what' => 'deposit', 'amount' => round(min($deposit, $total) - $paid, 2), 'date' => $depDate];
    } else {
      $m['due'] = ['what' => 'balance', 'amount' => $balance, 'date' => $balDate, 'late_by_trip' => $tripOver];
    }
    $days = $m['due']['date'] !== '' ? days_until($m['due']['date']) : null;
    $m['due']['days'] = $days;
    $m['due']['overdue'] = ($days !== null && $days < 0) || !empty($m['due']['late_by_trip']);
    $m['due']['soon'] = $days !== null && $days >= 0 && $days <= 14;
    if ($m['due']['overdue']) $m['pill'] = 'spam';
  }
  return $m;
}

/** A small coloured pill for the payment state. */
function bk_pay_pill(array $m): string
{
  $label = $m['label'];
  if (!empty($m['due']['overdue'])) $label = $m['due']['what'] === 'deposit' ? t('Deposit overdue') : t('Balance overdue');
  return '<span class="pill pill--' . h($m['pill']) . '">' . h($label) . '</span>';
}

/** "Deposit of €900 due in 5 days" / "Balance of €2,100 overdue by 3 days" / "Balance of €2,100 due 12 May 2027". */
function bk_due_text(array $due): string
{
  $amount = fmt_money($due['amount']);
  $isDep = $due['what'] === 'deposit';
  $days = $due['days'];
  if ($days === null) {
    if (!empty($due['late_by_trip'])) return t('Balance of {amount} still to collect — the trip is over', ['amount' => $amount]);
    return $isDep ? t('Deposit of {amount} to collect (no due date set)', ['amount' => $amount]) : t('Balance of {amount} to collect (no due date set)', ['amount' => $amount]);
  }
  if ($days < 0) {
    return $isDep ? tp(-$days, 'Deposit of {amount} overdue by {n} day', 'Deposit of {amount} overdue by {n} days', ['amount' => $amount])
      : tp(-$days, 'Balance of {amount} overdue by {n} day', 'Balance of {amount} overdue by {n} days', ['amount' => $amount]);
  }
  if ($days === 0) return $isDep ? t('Deposit of {amount} due today', ['amount' => $amount]) : t('Balance of {amount} due today', ['amount' => $amount]);
  if ($days <= 14) {
    return $isDep ? tp($days, 'Deposit of {amount} due in {n} day', 'Deposit of {amount} due in {n} days', ['amount' => $amount])
      : tp($days, 'Balance of {amount} due in {n} day', 'Balance of {amount} due in {n} days', ['amount' => $amount]);
  }
  return $isDep ? t('Deposit of {amount} due {date}', ['amount' => $amount, 'date' => fmt_date($due['date'])])
    : t('Balance of {amount} due {date}', ['amount' => $amount, 'date' => fmt_date($due['date'])]);
}

// ── Prices ──────────────────────────────────────────────────────────────────

/**
 * The website calculator's price for a party (tour page: per person = price × party factor, rounded to €10;
 * total = per person × travellers; parties above 8 use the factor for 8). null if the tour/style has no price.
 */
function bk_suggest(string $tourId, string $tier, int $party): ?array
{
  if ($party < 1 || $tourId === '' || $tier === '') return null;
  $tours = tours();
  if (!isset($tours[$tourId]['prices'][$tier])) return null;
  $price = (float) $tours[$tourId]['prices'][$tier];
  if ($price <= 0) return null;
  $f = party_factors();
  $factor = (float) ($f[(string) min(8, $party)] ?? 1);
  $per = round($price * $factor / 10) * 10;
  return ['price' => $price, 'factor' => $factor, 'per' => $per, 'party' => $party, 'total' => $per * $party];
}

/** For booking.js: {tourId: {days, prices: {tier: €}}} and the party factors. */
function bk_price_data(): array
{
  $tours = [];
  foreach (tours() as $id => $t) {
    $p = [];
    foreach ($t['prices'] as $tier => $v) $p[$tier] = (float) $v;
    $tours[$id] = ['days' => (int) $t['days'], 'prices' => $p];
  }
  return ['tours' => $tours, 'factors' => party_factors()];
}

// ── References ──────────────────────────────────────────────────────────────

/**
 * The next free booking reference, B-<yy><mm>-<0001> by Tbilisi month. Call inside db_tx().
 * Numbers of deleted bookings are never given out again (the activity log remembers them), so a reference
 * already sent to a client always means one booking.
 */
function bk_new_ref(PDO $pdo): string
{
  $prefix = 'B-' . (new DateTime('now', mfs_tz()))->format('ym') . '-';
  $st = $pdo->prepare("SELECT ref FROM bookings WHERE ref LIKE ? UNION ALL SELECT details FROM audit_log WHERE action = 'booking.create' AND details LIKE ?");
  $st->execute([$prefix . '%', $prefix . '%']);
  $max = 0;
  foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $r) {
    if (preg_match('/^B-\d{4}-(\d+)/', (string) $r, $m)) $max = max($max, (int) $m[1]);
  }
  $exists = $pdo->prepare('SELECT 1 FROM bookings WHERE ref = ?');
  for ($n = $max + 1; ; $n++) {
    $ref = $prefix . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    $exists->execute([$ref]);
    $taken = $exists->fetchColumn();
    $exists->closeCursor();
    if (!$taken) return $ref;
  }
}

// ── Timeline ────────────────────────────────────────────────────────────────

/** Adds an entry to a booking's timeline (inside or outside a transaction). */
function bk_add_note(int $bookingId, string $body, string $kind = 'note', ?int $userId = null): void
{
  if (!in_array($kind, ['note', 'status', 'system', 'email'], true)) $kind = 'system';
  db_exec('INSERT INTO notes (booking_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', [$bookingId, $userId, $kind, $body, now_utc()]);
}

/** The English text stored for a status change. */
function bk_status_note(string $from, string $to, array $labels): string
{
  return 'Status changed from ' . ($labels[$from] ?? $from) . ' to ' . ($labels[$to] ?? $to);
}

/** A status label (booking or request) in the user's language, from its English label. */
function bk_status_from_en(string $en): string
{
  foreach ([BOOKING_STATUSES, REQUEST_STATUSES] as $list) {
    foreach ($list as $label) if (strcasecmp($label, $en) === 0) return t($label);
  }
  return $en;
}

/** A timeline entry's text in the user's language (status/system entries are stored in English). */
function bk_note_text(string $kind, string $body): string
{
  if ($kind !== 'status' && $kind !== 'system') return $body;
  if (preg_match('/^Status changed from (.+) to (.+)$/u', $body, $m)) {
    return t('Status changed from {from} to {to}', ['from' => bk_status_from_en($m[1]), 'to' => bk_status_from_en($m[2])]);
  }
  if (preg_match('/^Booking created from request (\S+)$/u', $body, $m)) return t('Booking created from request {ref}', ['ref' => $m[1]]);
  if (preg_match('/^Payment (recorded|deleted): (.+?) on (\d{4}-\d{2}-\d{2})(?: \((.+)\))?$/u', $body, $m)) {
    $vars = ['amount' => $m[2], 'date' => fmt_date($m[3])];
    $txt = $m[1] === 'recorded' ? t('Payment recorded: {amount} on {date}', $vars) : t('Payment deleted: {amount} on {date}', $vars);
    return isset($m[4]) && $m[4] !== '' ? $txt . ' (' . bk_method_label($m[4]) . ')' : $txt;
  }
  if (preg_match('/^Booking (\S+) (created|deleted)$/u', $body, $m)) {
    return $m[2] === 'created' ? t('Booking {ref} created', ['ref' => $m[1]]) : t('Booking {ref} deleted', ['ref' => $m[1]]);
  }
  return t($body);
}

/** One timeline entry as HTML (.tl-item). $who: the person's name ('' = automatic). */
function bk_timeline_item(array $n): string
{
  $kind = in_array($n['kind'], ['note', 'status', 'system', 'email'], true) ? $n['kind'] : 'system';
  $ico = ['note' => 'note', 'status' => 'refresh', 'system' => 'info', 'email' => 'mail'][$kind];
  $who = trim((string) ($n['user_name'] ?? ''));
  if ($who === '') $who = $kind === 'note' ? t('Someone who has left') : t('Automatic');
  if (strpos((string) $n['body'], 'Payment ') === 0 && $kind === 'system') $ico = 'euro';
  return '<li class="tl-item tl-item--' . h($kind) . '"><span class="tl-item__dot" aria-hidden="true">' . icon($ico) . '</span>'
    . '<div class="tl-item__head"><span class="tl-item__who">' . h($who) . '</span>'
    . '<time class="tl-item__time" datetime="' . h(str_replace(' ', 'T', (string) $n['created_at']) . 'Z') . '" title="' . h(fmt_date($n['created_at'], true)) . '">' . h(fmt_ago($n['created_at'])) . '</time></div>'
    . '<div class="tl-item__body">' . h(bk_note_text($kind, (string) $n['body'])) . '</div></li>';
}

// ── Reading requests (creating a booking from one) ──────────────────────────

/** Month number from a month word in any of the website's languages (abbreviated or full); 0 if none. */
function bk_month_from_word(string $w): int
{
  static $map = [
    'juin' => 6, 'juil' => 7,
    'jan' => 1, 'feb' => 2, 'mar' => 3, 'apr' => 4, 'may' => 5, 'jun' => 6, 'jul' => 7, 'aug' => 8, 'sep' => 9, 'oct' => 10, 'nov' => 11, 'dec' => 12,
    'ene' => 1, 'abr' => 4, 'ago' => 8, 'dic' => 12, 'set' => 9, 'out' => 10, 'dez' => 12,
    'fév' => 2, 'fev' => 2, 'avr' => 4, 'mai' => 5, 'aoû' => 8, 'aou' => 8, 'déc' => 12,
    'gen' => 1, 'mag' => 5, 'giu' => 6, 'lug' => 7, 'ott' => 10, 'mär' => 3, 'okt' => 10,
    'янв' => 1, 'фев' => 2, 'мар' => 3, 'апр' => 4, 'мая' => 5, 'май' => 5, 'июн' => 6, 'июл' => 7,
    'авг' => 8, 'сен' => 9, 'окт' => 10, 'ноя' => 11, 'дек' => 12,
    'იან' => 1, 'თებ' => 2, 'მარ' => 3, 'აპრ' => 4, 'მაი' => 5, 'ივნ' => 6, 'ივლ' => 7, 'აგვ' => 8,
    'სექ' => 9, 'ოქტ' => 10, 'ნოე' => 11, 'დეკ' => 12,
  ];
  if (!function_exists('mb_substr')) return 0;
  $w = trim(bk_lc($w), '.');
  $n = mb_strlen($w, 'UTF-8');
  if ($n < 3 || $n > 12) return 0;
  $p4 = mb_substr($w, 0, 4, 'UTF-8');
  if (isset($map[$p4])) return $map[$p4];
  return $map[mb_substr($w, 0, 3, 'UTF-8')] ?? 0;
}

/**
 * Reads trip dates typed or picked on the website ("12 May – 18 May", "12 May (±3)", "12–18 May 2027",
 * "28 Dec – 3 Jan 2027", "12. Mai – 18. Mai", "12/05 – 18/05", "5月12日 – 5月18日", "2027-05-12") into
 * ['Y-m-d', 'Y-m-d' or '']. Dates without a year are the next ones on or after $refYmd (the day the request
 * came in). Flexible answers ("A week in May") give ['', ''].
 */
function bk_parse_dates(string $text, string $refYmd = ''): array
{
  $none = ['', ''];
  $s = bk_lc(trim($text));
  if ($s === '' || strlen($s) > 200) return $none;
  if (bk_valid_date($refYmd) === '') $refYmd = local_today();
  $s = (string) preg_replace('/\(\s*±\s*\d+\s*\)/u', ' ', $s);
  // A browser without month names for the page's language writes "M12 12 – M12 18" (month 12, day 12).
  $s = (string) preg_replace_callback('/(?<!\p{L})m(\d{1,2})(?![\d\p{L}])/u', function ($m) {
    $n = (int) $m[1];
    return $n >= 1 && $n <= 12 ? ' ' . ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][$n - 1] . ' ' : $m[0];
  }, $s);
  $s = str_replace(['–', '—', '−', '‒', '~', '～', '至'], '-', $s);
  if (!preg_match_all('/(\d{4})-(\d{1,2})-(\d{1,2})|(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?|(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?(?![\d])|(\d+)|(\p{L}+)|(-)/u', $s, $tok, PREG_SET_ORDER)) return $none;

  // Tokens → a flat list: ['date', d, m, y|null] | ['day', d] | ['month', m] | ['year', y] | ['dash'] | ['word']
  $t = [];
  foreach ($tok as $x) {
    if (($x[1] ?? '') !== '') $t[] = ['date', (int) $x[3], (int) $x[2], (int) $x[1]];
    elseif (($x[6] ?? '') !== '') $t[] = ['date', (int) $x[6], (int) $x[5], ($x[4] ?? '') !== '' ? (int) $x[4] : null];
    elseif (($x[7] ?? '') !== '') {
      $y = ($x[9] ?? '') !== '' ? (int) $x[9] : null;
      if ($y !== null && $y < 100) $y += 2000;
      $t[] = ['date', (int) $x[7], (int) $x[8], $y];
    } elseif (($x[10] ?? '') !== '') {
      $n = (int) $x[10];
      if (strlen($x[10]) === 4 && $n >= 2000 && $n <= 2100) $t[] = ['year', $n];
      elseif ($n >= 1 && $n <= 31 && strlen($x[10]) <= 2) $t[] = ['day', $n];
      else $t[] = ['word'];
    } elseif (($x[11] ?? '') !== '') {
      $w = $x[11];
      if (in_array($w, ['de', 'del', 'di', 'du', 'the', 'of'], true)) continue;
      $m = bk_month_from_word($w);
      $t[] = $m ? ['month', $m] : ['word'];
    } elseif (($x[12] ?? '') !== '') $t[] = ['dash'];
  }

  $parts = [];
  $pending = [];
  $n = count($t);
  for ($i = 0; $i < $n; $i++) {
    $k = $t[$i][0];
    if ($k === 'date') {
      foreach ($pending as $d) $parts[] = [$d, $t[$i][2], $t[$i][3], true];
      $pending = [];
      $parts[] = [$t[$i][1], $t[$i][2], $t[$i][3], false];
    } elseif ($k === 'day') {
      if ($i + 1 < $n && $t[$i + 1][0] === 'month') {
        $y = ($i + 2 < $n && $t[$i + 2][0] === 'year') ? $t[$i + 2][1] : null;
        foreach ($pending as $d) $parts[] = [$d, $t[$i + 1][1], $y, true];
        $pending = [];
        $parts[] = [$t[$i][1], $t[$i + 1][1], $y, false];
        $i += $y !== null ? 2 : 1;
      } else {
        $pending[] = $t[$i][1];
      }
    } elseif ($k === 'month') {
      // "May 12" (month first)
      if ($i + 1 < $n && $t[$i + 1][0] === 'day' && !($i + 2 < $n && $t[$i + 2][0] === 'month')) {
        $y = ($i + 2 < $n && $t[$i + 2][0] === 'year') ? $t[$i + 2][1] : null;
        $parts[] = [$t[$i + 1][1], $t[$i][1], $y, false];
        $i += $y !== null ? 2 : 1;
      }
      $pending = [];
    } elseif ($k === 'year') {
      foreach ($parts as &$p) if ($p[2] === null) $p[2] = $t[$i][1];
      unset($p);
      $pending = [];
    } elseif ($k === 'word') {
      $pending = [];
    }
    if (count($parts) >= 2) break;
  }
  if (!$parts) return $none;
  $parts = array_slice($parts, 0, 2);

  // A year given only at the end belongs to the start too ("28 Dec – 3 Jan 2027" starts in 2026).
  if (count($parts) === 2 && $parts[0][2] === null && $parts[1][2] !== null) {
    $parts[0][2] = $parts[1][2];
    if (sprintf('%02d-%02d', $parts[0][1], $parts[0][0]) > sprintf('%02d-%02d', $parts[1][1], $parts[1][0])) $parts[0][2]--;
  }
  $mk = function ($d, $m, $y) {
    if ($m < 1 || $m > 12 || $d < 1 || $d > 31 || !checkdate($m, $d, $y)) return '';
    return sprintf('%04d-%02d-%02d', $y, $m, $d);
  };
  list($d0, $m0, $y0) = $parts[0];
  if ($y0 === null) {
    $y0 = (int) substr($refYmd, 0, 4);
    $start = $mk($d0, $m0, $y0);
    if ($start !== '' && $start < bk_add_days($refYmd, -1)) $start = $mk($d0, $m0, $y0 + 1);
  } else {
    $start = $mk($d0, $m0, $y0);
  }
  if ($start === '') return $none;
  $end = '';
  if (count($parts) === 2) {
    list($d1, $m1, $y1) = $parts[1];
    if ($y1 === null) {
      $y1 = (int) substr($start, 0, 4);
      $end = $mk($d1, $m1, $y1);
      if ($end !== '' && $end < $start) $end = $mk($d1, $m1, $y1 + 1);
    } else {
      $end = $mk($d1, $m1, $y1);
    }
    if ($end !== '' && ($end < $start || bk_days_between($start, $end) > 120)) $end = '';
  }
  return [$start, $end];
}

/**
 * Travellers as written on the website ("2 adults, 1 child, 1 infant" in any of its languages) →
 * [adults, children]; infants count as children. [0, 0] when there's no number in it.
 */
function bk_parse_party(string $text): array
{
  $adults = 0;
  $children = 0;
  $found = false;
  $pos = 0;
  foreach (preg_split('/[,;，、+&和]|\s(?:and|und|et|y|e|и|და)\s/u', bk_lc($text)) ?: [] as $part) {
    if (!preg_match('/(\d{1,3})/', $part, $m)) continue;
    $n = (int) $m[1];
    $found = true;
    if (preg_match('/infant|baby|kleinkind|bébé|bebé|bebe|neonat|ჩვილ|младен|婴/u', $part)) $children += $n;
    elseif (preg_match('/adult|erwachsen|მოზრდ|взросл|成人/u', $part)) $adults += $n;
    elseif (preg_match('/child|kid|kind|niñ|nino|enfant|bambin|ბავშვ|crianç|crianc|ребён|ребен|дет|儿童/u', $part)) $children += $n;
    elseif ($pos === 0) $adults += $n;
    else $children += $n;
    $pos++;
  }
  if (!$found) return [0, 0];
  return [min(99, $adults), min(99, $children)];
}

/** A catalogue tour (and travel style) named in free text, in any of the website's languages: ['tourId', 'tierId'] ('' when none). */
function bk_match_tour(string $text): array
{
  if (trim($text) === '') return ['', ''];
  return [mfs_find_tour($text), mfs_find_tier($text)];
}

/** A request's fields_json as [['l', 'n', 'v'], …]. */
function bk_request_fields(array $r): array
{
  $d = json_decode((string) ($r['fields_json'] ?? ''), true);
  if (!is_array($d)) return [];
  $out = [];
  foreach ($d as $f) {
    if (!is_array($f)) continue;
    $v = isset($f['v']) && is_scalar($f['v']) ? trim((string) $f['v']) : '';
    if ($v === '') continue;
    $out[] = ['l' => isset($f['l']) && is_scalar($f['l']) ? (string) $f['l'] : '', 'n' => isset($f['n']) && is_scalar($f['n']) ? (string) $f['n'] : '', 'v' => $v];
  }
  return $out;
}

/** The visitor's country from a request: the country column, else the country picked with the phone code. */
function bk_request_country(array $r): string
{
  $c = trim((string) ($r['country'] ?? ''));
  if ($c !== '') return $c;
  foreach (bk_request_fields($r) as $f) {
    if (strcasecmp($f['n'], 'country_code') !== 0) continue;
    $name = trim((string) preg_replace('/\s*\(?\+\d[\d\s-]*\)?\s*$/', '', $f['v']));
    if ($name !== '' && !preg_match('/^\+?\d+$/', $name)) return $name;
  }
  return '';
}

/**
 * Booking form values prefilled from a request: client details, tour + travel style, dates, party, language,
 * and the website price when the tour, style and party are known.
 */
function bk_prefill_from_request(array $r): array
{
  $tourId = trim((string) ($r['tour_id'] ?? ''));
  $tier = trim((string) ($r['tier'] ?? ''));
  $tours = tours();
  if ($tourId === '' || !isset($tours[$tourId])) {
    list($mt, $mtier) = bk_match_tour((string) ($r['interests'] ?? ''));
    if ($mt !== '') $tourId = $mt;
    if ($tier === '' && $mtier !== '') $tier = $mtier;
  }
  if (!isset($tours[$tourId])) $tourId = '';
  if (!isset(tiers()[$tier])) $tier = '';
  $created = utc_to_local($r['created_at'] ?? '');
  list($start, $end) = bk_parse_dates((string) ($r['travel_dates'] ?? ''), $created ? $created->format('Y-m-d') : local_today());
  if ($start !== '' && $end === '' && $tourId !== '' && $tours[$tourId]['days'] > 0) $end = bk_add_days($start, $tours[$tourId]['days'] - 1);
  list($adults, $children) = bk_parse_party((string) ($r['travellers'] ?? ''));
  if ($adults < 1) $adults = $children > 0 ? 1 : 2;
  $lang = strtolower(trim((string) ($r['lang'] ?? '')));
  if (!in_array($lang, bk_lang_codes(), true)) $lang = '';
  $name = trim((string) ($r['name'] ?? ''));
  $company = trim((string) ($r['company'] ?? ''));
  if ($name === '') $name = $company;
  elseif ($company !== '' && ($r['kind'] ?? '') === 'partner') $name .= ' (' . $company . ')';
  $sug = bk_suggest($tourId, $tier, $adults + $children);
  return [
    'client_name' => $name,
    'client_email' => valid_email($r['email'] ?? ''),
    'client_phone' => trim((string) ($r['phone'] ?? '')),
    'client_country' => bk_request_country($r),
    'client_lang' => $lang,
    'tour' => $tourId,
    'tour_name' => '',
    'tier' => $tier,
    'start_date' => $start,
    'end_date' => $end,
    'adults' => (string) $adults,
    'children' => (string) $children,
    'total_price' => $sug ? bk_money_input($sug['total']) : '',
  ];
}

// ── The list's filters ──────────────────────────────────────────────────────

/** The list filters from the query string, validated. when: upcoming (default) | past | nodate | all. */
function bk_filters(): array
{
  $s = get('status');
  $w = get('when');
  $p = get('pay');
  $o = get('sort');
  $q = get('q');
  if (bk_len($q) > 100) $q = function_exists('mb_substr') ? mb_substr($q, 0, 100, 'UTF-8') : substr($q, 0, 100);
  return [
    'status' => isset(BOOKING_STATUSES[$s]) ? $s : '',
    'when' => in_array($w, ['past', 'nodate', 'all'], true) ? $w : 'upcoming',
    'pay' => in_array($p, ['due', 'overdue', 'paid'], true) ? $p : '',
    'sort' => $o === 'new' ? 'new' : '',
    'q' => $q,
  ];
}

/** The filters as URL parameters (defaults left out). */
function bk_params(array $f, array $extra = []): array
{
  return array_merge([
    'status' => $f['status'], 'when' => $f['when'] === 'upcoming' ? '' : $f['when'],
    'pay' => $f['pay'], 'sort' => $f['sort'], 'q' => $f['q'],
  ], $extra);
}

/** mb-aware lower() for SQLite searches (SQLite's own only knows A–Z). False if it can't be registered. */
function bk_lower_available(): bool
{
  static $ok = null;
  if ($ok !== null) return $ok;
  $ok = false;
  $fn = function ($s) {
    return $s === null ? null : bk_lc((string) $s);
  };
  try {
    $pdo = db();
    if (method_exists($pdo, 'createFunction')) $ok = (bool) $pdo->createFunction('bk_lower', $fn, 1);
    elseif (method_exists($pdo, 'sqliteCreateFunction')) $ok = (bool) @$pdo->sqliteCreateFunction('bk_lower', $fn, 1);
  } catch (Throwable $e) {
    $ok = false;
  }
  return $ok;
}

/** SQL condition + arguments for the filters (bookings b joined with BK_PAID_JOIN). */
function bk_where(array $f, bool $withStatus = true): array
{
  $w = [];
  $a = [];
  $today = local_today();
  $paid = 'COALESCE(pp.paid, 0)';
  if ($withStatus && $f['status'] !== '') {
    $w[] = 'b.status = ?';
    $a[] = $f['status'];
  }
  $noDate = "(b.start_date IS NULL OR b.start_date = '')";
  if ($f['when'] === 'upcoming') {
    $w[] = "($noDate OR " . BK_END_SQL . ' >= ?)';
    $a[] = $today;
  } elseif ($f['when'] === 'past') {
    $w[] = "(NOT $noDate AND " . BK_END_SQL . ' < ?)';
    $a[] = $today;
  } elseif ($f['when'] === 'nodate') {
    $w[] = $noDate;
  }
  if ($f['pay'] === 'due') {
    $w[] = "b.status <> 'cancelled' AND b.total_price - $paid > " . BK_EPS;
  } elseif ($f['pay'] === 'paid') {
    $w[] = "b.status <> 'cancelled' AND b.total_price > " . BK_EPS . " AND ABS(b.total_price - $paid) <= " . BK_EPS;
  } elseif ($f['pay'] === 'overdue') {
    // The same rule as bk_money(): a deposit past its own date, or anything unpaid after the balance date (or,
    // without one, after the trip), deposit paid or not.
    $w[] = "b.status <> 'cancelled' AND b.total_price - $paid > " . BK_EPS . " AND ("
      . "(b.deposit_amount > " . BK_EPS . " AND $paid < b.deposit_amount - " . BK_EPS . " AND b.deposit_due IS NOT NULL AND b.deposit_due <> '' AND b.deposit_due < ?)"
      . " OR (b.balance_due IS NOT NULL AND b.balance_due <> '' AND b.balance_due < ?)"
      . " OR ((b.balance_due IS NULL OR b.balance_due = '') AND NOT $noDate AND " . BK_END_SQL . ' < ?))';
    array_push($a, $today, $today, $today);
  }
  if ($f['q'] !== '') {
    $lower = bk_lower_available();
    $needle = $lower ? bk_lc($f['q']) : $f['q'];
    $like = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $needle) . '%';
    $or = [];
    foreach (['b.ref', 'b.client_name', 'b.client_email', 'b.client_phone', 'b.client_country', 'b.tour_name', 'b.guide', 'b.driver'] as $col) {
      $or[] = ($lower ? "bk_lower(COALESCE($col, ''))" : "COALESCE($col, '')") . " LIKE ? ESCAPE '!'";
      $a[] = $like;
    }
    $digits = preg_replace('/\D+/', '', $f['q']);
    if (strlen($digits) >= 4 && preg_match('/^[\d\s+().\/-]+$/', $f['q'])) {
      $or[] = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(b.client_phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') LIKE ?";
      $a[] = '%' . $digits . '%';
    }
    $w[] = '(' . implode(' OR ', $or) . ')';
  }
  return [$w ? implode(' AND ', $w) : '1 = 1', $a];
}

/** ORDER BY for the list (whitelisted). */
function bk_order(array $f): string
{
  if ($f['sort'] === 'new') return 'b.created_at DESC, b.id DESC';
  $noDate = "CASE WHEN b.start_date IS NULL OR b.start_date = '' THEN 1 ELSE 0 END";
  if ($f['when'] === 'upcoming') return "$noDate, b.start_date ASC, b.id ASC";
  if ($f['when'] === 'nodate') return 'b.created_at DESC, b.id DESC';
  return "$noDate DESC, b.start_date DESC, b.id DESC";
}

/** Whether this person may delete this payment: owners always; the person who recorded it, for 24 hours. */
function bk_can_delete_payment(array $pay, array $me): bool
{
  if (($me['role'] ?? '') === 'owner') return true;
  if ((int) ($pay['created_by'] ?? 0) !== (int) $me['id']) return false;
  $at = strtotime((string) $pay['created_at'] . ' UTC');
  return $at !== false && time() - $at < 86400;
}
