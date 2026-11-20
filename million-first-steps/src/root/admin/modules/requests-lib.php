<?php
/*
 * Shared by the Requests pages: modules/requests.php (inbox), request.php (one request) and export.php (CSV).
 * Not a page itself (index.php only runs the files it lists; modules/ is closed to the web).
 *
 * List filters travel in the query string, so the inbox, a request's previous/next links and the CSV export
 * all show the same selection:
 *   status = new|contacted|quoted|booked|lost|spam   (empty = everything except spam)
 *   kind   = trip|contact|partner|other
 *   q      = search text (name, email, phone, reference, message, company, interests, country)
 *   mine   = 1   only requests assigned to the signed-in person
 *   due    = 1   follow-up date today or earlier, still open (new / contacted / quoted)
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
if (defined('MFS_REQUESTS_LIB')) return;
define('MFS_REQUESTS_LIB', 1);

const REQ_PER_PAGE = 25;
/** Statuses that still need someone to act on them. */
const REQ_OPEN_STATUSES = ['new', 'contacted', 'quoted'];
/** Website language codes → English names (translated with t()). The native names come from the catalogue. */
const REQ_LANG_NAMES = [
  'en' => 'English', 'ru' => 'Russian', 'ka' => 'Georgian', 'es' => 'Spanish', 'fr' => 'French',
  'it' => 'Italian', 'pt' => 'Portuguese', 'de' => 'German', 'zh' => 'Chinese',
];

/** The list filters from the query string, validated (unknown values become ''). */
function req_filters(): array
{
  $s = get('status');
  $k = get('kind');
  $q = mfs_cut(get('q'), 100);
  return [
    'status' => isset(REQUEST_STATUSES[$s]) ? $s : '',
    'kind' => isset(REQUEST_KINDS[$k]) ? $k : '',
    'q' => $q,
    'mine' => get('mine') === '1' ? '1' : '',
    'due' => get('due') === '1' ? '1' : '',
  ];
}

/** True when any filter other than the status tab is in use. */
function req_has_filters(array $f): bool
{
  return $f['kind'] !== '' || $f['q'] !== '' || $f['mine'] !== '' || $f['due'] !== '';
}

/**
 * A case-insensitive lower() for SQLite that also knows Cyrillic, Georgian, accents … (SQLite's own only
 * does A–Z). Registered once per connection; false if the PHP build can't register functions.
 */
function req_lower_available(): bool
{
  static $ok = null;
  if ($ok !== null) return $ok;
  $ok = false;
  $fn = function ($s) {
    if ($s === null) return null;
    return function_exists('mb_strtolower') ? mb_strtolower((string) $s, 'UTF-8') : strtolower((string) $s);
  };
  try {
    $pdo = db();
    if (method_exists($pdo, 'createFunction')) $ok = (bool) $pdo->createFunction('mfs_lower', $fn, 1);
    elseif (method_exists($pdo, 'sqliteCreateFunction')) $ok = (bool) @$pdo->sqliteCreateFunction('mfs_lower', $fn, 1);
  } catch (Throwable $e) {
    $ok = false;
  }
  return $ok;
}

/** Escapes LIKE wildcards (ESCAPE '!'). */
function req_like(string $s): string
{
  return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $s) . '%';
}

/**
 * SQL condition + arguments for the filters (table alias r). $withStatus = false leaves out the status tab
 * (used for the tab counts).
 */
function req_where(array $f, int $meId, bool $withStatus = true): array
{
  $w = [];
  $a = [];
  if ($withStatus) {
    if ($f['status'] !== '') {
      $w[] = 'r.status = ?';
      $a[] = $f['status'];
    } else {
      $w[] = "r.status <> 'spam'";
    }
  }
  if ($f['kind'] !== '') {
    $w[] = 'r.kind = ?';
    $a[] = $f['kind'];
  }
  if ($f['mine'] !== '') {
    $w[] = 'r.assigned_to = ?';
    $a[] = $meId;
  }
  if ($f['due'] !== '') {
    $w[] = "r.follow_up_on IS NOT NULL AND r.follow_up_on <> '' AND r.follow_up_on <= ? AND r.status IN ('new','contacted','quoted')";
    $a[] = local_today();
  }
  if ($f['q'] !== '') {
    $lowerFn = req_lower_available();
    $needle = $lowerFn && function_exists('mb_strtolower') ? mb_strtolower($f['q'], 'UTF-8') : $f['q'];
    $or = [];
    foreach (['r.name', 'r.email', 'r.phone', 'r.ref', 'r.message', 'r.company', 'r.interests', 'r.country'] as $col) {
      $or[] = ($lowerFn ? "mfs_lower(COALESCE($col, ''))" : "COALESCE($col, '')") . " LIKE ? ESCAPE '!'";
      $a[] = req_like($needle);
    }
    // Phone numbers: "555 12 34" finds "+995 555-12-34" (spaces, dashes, dots and brackets ignored).
    $digits = preg_replace('/\D+/', '', $f['q']);
    if (strlen($digits) >= 4 && preg_match('/^[\d\s+().\/-]+$/', $f['q'])) {
      $or[] = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(r.phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '/', '') LIKE ?";
      $a[] = '%' . $digits . '%';
    }
    $w[] = '(' . implode(' OR ', $or) . ')';
  }
  return [$w ? implode(' AND ', $w) : '1 = 1', $a];
}

/** The filters as URL parameters (empty ones are dropped by url()). */
function req_params(array $f, array $extra = []): array
{
  return array_merge(['status' => $f['status'], 'kind' => $f['kind'], 'q' => $f['q'], 'mine' => $f['mine'], 'due' => $f['due']], $extra);
}

/** The request's form fields as sent: [['l' => label, 'n' => name, 'v' => value], …] (invalid JSON → []). */
function req_fields(array $r): array
{
  $d = json_decode((string) ($r['fields_json'] ?? ''), true);
  if (!is_array($d)) return [];
  $out = [];
  foreach ($d as $f) {
    if (!is_array($f)) continue;
    $v = isset($f['v']) && is_scalar($f['v']) ? (string) $f['v'] : '';
    if ($v === '') continue;
    $l = isset($f['l']) && is_scalar($f['l']) ? (string) $f['l'] : '';
    $n = isset($f['n']) && is_scalar($f['n']) ? (string) $f['n'] : '';
    $out[] = ['l' => $l !== '' ? $l : $n, 'n' => $n, 'v' => $v];
  }
  return $out;
}

/** A field's value by form name ('' if not sent). */
function req_field(array $fields, string $name): string
{
  foreach ($fields as $f) if (strcasecmp($f['n'], $name) === 0) return $f['v'];
  return '';
}

/** The visitor's country: the country column, else the country picked with the phone code ("Germany (+49)"). */
function req_country(array $r, array $fields): string
{
  $c = trim((string) ($r['country'] ?? ''));
  if ($c !== '') return $c;
  $cc = req_field($fields, 'country_code');
  if ($cc !== '') {
    $name = trim(preg_replace('/\s*\(?\+\d[\d\s-]*\)?\s*$/', '', $cc));
    if ($name !== '' && !preg_match('/^\+?\d+$/', $name)) return $name;
  }
  return '';
}

/** "Russian · Русский" for a website language code ('' if none). */
function req_lang_name($code, bool $withNative = true): string
{
  $code = strtolower(trim((string) $code));
  if ($code === '') return '';
  $en = REQ_LANG_NAMES[$code] ?? '';
  $native = '';
  foreach ((array) (catalog()['languages'] ?? []) as $l) {
    if (is_array($l) && (string) ($l['code'] ?? '') === $code) $native = (string) ($l['name'] ?? '');
  }
  if ($en === '') return $native !== '' ? $native : strtoupper($code);
  $label = t($en);
  return ($withNative && $native !== '' && $native !== $label && $native !== $en) ? $label . ' · ' . $native : $label;
}

/** Who the request is from, for titles: name, else company, else email, else the reference. */
function req_display_name(array $r): string
{
  foreach (['name', 'company', 'email'] as $k) {
    $v = trim((string) ($r[$k] ?? ''));
    if ($v !== '') return $v;
  }
  return t('Request {ref}', ['ref' => (string) $r['ref']]);
}

/** A one-line summary for the inbox: the tour wanted, else interests, else the message. */
function req_summary(array $r): string
{
  if (!empty($r['tour_id'])) {
    $s = tour_name($r['tour_id']);
    if (!empty($r['tier'])) $s .= ' · ' . tier_name($r['tier']);
    return $s;
  }
  if ($r['kind'] === 'partner' && trim((string) $r['company']) !== '') {
    return trim($r['company'] . (trim((string) $r['country']) !== '' ? ' · ' . $r['country'] : ''));
  }
  foreach (['interests', 'message'] as $k) {
    if (trim((string) ($r[$k] ?? '')) !== '') return excerpt($r[$k], 90);
  }
  return '';
}

/** Total travellers from "2 adults, 1 child" (0 if it can't be read). */
function req_party_size($travellers): int
{
  if (!preg_match_all('/\d+/', (string) $travellers, $m)) return 0;
  $n = 0;
  foreach ($m[0] as $x) $n += (int) $x;
  return ($n >= 1 && $n <= 60) ? $n : 0;
}

/** Translated status label from its English label ("Contacted" → t('Contacted')); unknown text as is. */
function req_status_label_from_en(string $en): string
{
  foreach (REQUEST_STATUSES as $label) if (strcasecmp($label, $en) === 0) return t($label);
  return $en;
}

/** The English text stored in the timeline for a status change (the seed and the bookings page use the same). */
function req_status_note(string $from, string $to): string
{
  if ($to === 'spam') return 'Marked as spam';
  return 'Status changed from ' . (REQUEST_STATUSES[$from] ?? $from) . ' to ' . (REQUEST_STATUSES[$to] ?? $to);
}

/** A timeline entry's text in the user's language: status/system notes are stored in English. */
function req_note_text(string $kind, string $body): string
{
  if ($kind !== 'status' && $kind !== 'system') return $body;
  if (preg_match('/^Status changed from (.+) to (.+)$/u', $body, $m)) {
    return t('Status changed from {from} to {to}', ['from' => req_status_label_from_en($m[1]), 'to' => req_status_label_from_en($m[2])]);
  }
  if (preg_match('/^Assigned to (.+)$/u', $body, $m)) return t('Assigned to {name}', ['name' => $m[1]]);
  // Written by the bookings pages (bookings-lib.php).
  if (preg_match('/^Booking (\S+) (created|deleted)$/u', $body, $m)) {
    return $m[2] === 'created' ? t('Booking {ref} created', ['ref' => $m[1]]) : t('Booking {ref} deleted', ['ref' => $m[1]]);
  }
  return t($body);
}

/**
 * Changes the status of requests, with a timeline entry for each one that actually changes.
 * Also marks them as read. Returns the references that changed.
 */
function req_set_status(array $ids, string $to, ?int $userId): array
{
  if (!isset(REQUEST_STATUSES[$to]) || !$ids) return [];
  return db_tx(function (PDO $pdo) use ($ids, $to, $userId) {
    $now = now_utc();
    $sel = $pdo->prepare('SELECT id, ref, status FROM requests WHERE id = ?');
    $upd = $pdo->prepare('UPDATE requests SET status = ?, updated_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ?');
    $note = $pdo->prepare("INSERT INTO notes (request_id, user_id, kind, body, created_at) VALUES (?, ?, 'status', ?, ?)");
    $changed = [];
    foreach ($ids as $id) {
      $sel->execute([(int) $id]);
      $row = $sel->fetch(PDO::FETCH_ASSOC);
      $sel->closeCursor();
      if (!$row || $row['status'] === $to) continue;
      $upd->execute([$to, $now, $now, (int) $id]);
      $note->execute([(int) $id, $userId, req_status_note((string) $row['status'], $to), $now]);
      $changed[(int) $id] = (string) $row['ref'];
    }
    return $changed;
  });
}

/** "Follow up today" / "Follow up tomorrow" / "Follow-up 3 days overdue" / "Follow up on 25 Nov 2026". */
function req_follow_label(string $ymd): string
{
  $d = days_until($ymd);
  if ($d === null) return '';
  if ($d === 0) return t('Follow up today');
  if ($d === 1) return t('Follow up tomorrow');
  if ($d < 0) return tp(-$d, 'Follow-up {n} day overdue', 'Follow-up {n} days overdue');
  return t('Follow up on {date}', ['date' => fmt_date($ymd)]);
}

/** A small follow-up marker (only for open requests). */
function req_follow_html(array $r): string
{
  $f = trim((string) ($r['follow_up_on'] ?? ''));
  if ($f === '' || !in_array($r['status'], REQ_OPEN_STATUSES, true)) return '';
  $d = days_until($f);
  if ($d === null) return '';
  $cls = $d < 0 ? 'req-follow--late' : ($d === 0 ? 'req-follow--today' : '');
  return '<span class="req-follow ' . $cls . '">' . icon('clock') . '<span>' . h(req_follow_label($f)) . '</span></span>';
}

/** A valid 'Y-m-d' (between 2000 and 2100) or ''. */
function req_valid_date(string $s): string
{
  $s = trim($s);
  if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m)) return '';
  if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1]) || (int) $m[1] < 2000 || (int) $m[1] > 2100) return '';
  return $s;
}

/** Tbilisi date $n days from today, 'Y-m-d'. */
function req_days_from_today(int $n): string
{
  $d = new DateTime('now', mfs_tz());
  $d->modify(($n >= 0 ? '+' : '') . $n . ' days');
  return $d->format('Y-m-d');
}

/** Active team members (and $alsoId, e.g. someone already assigned who has since left) for the "Assigned to" list. */
function req_team(?int $alsoId = null): array
{
  return db_all('SELECT id, name, active FROM users WHERE active = 1 OR id = ? ORDER BY active DESC, name COLLATE NOCASE', [(int) $alsoId]);
}
