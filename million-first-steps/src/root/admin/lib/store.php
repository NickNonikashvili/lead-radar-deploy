<?php
/*
 * Keeps the website's requests in the admin database. Used by send.php (site root):
 *   require_once __DIR__ . '/admin/lib/store.php';
 *   $id = mfs_store_request(['kind' => …, 'ref' => …, 'lang' => …, 'page' => …, 'email' => …,
 *                            'fields' => [['l' => label, 'n' => form name, 'v' => value], …]]);
 * Also loaded by boot.php, so admin modules can use the same functions.
 */
if (!defined('MFS_BOOTED')) {
  if (isset($_SERVER['SCRIPT_FILENAME']) && @realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) { http_response_code(404); exit; }
  require_once __DIR__ . '/boot.php';
}

/** Kind of request from the form's kind label: partner / trip / contact / other. */
function mfs_request_kind(string $label): string
{
  $l = strtolower($label);
  if (strpos($l, 'partner') !== false) return 'partner';
  if (strpos($l, 'trip request') !== false) return 'trip';
  if (strpos($l, 'contact') !== false) return 'contact';
  return 'other';
}

/** Cuts a string to $max characters (multibyte safe). */
function mfs_cut(string $s, int $max): string
{
  return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}

/**
 * Stores one request from the website. Maps fields by form name to columns, keeps everything in fields_json,
 * finds the tour (and travel style) named in "Would like to see", makes the ref unique (-2, -3 …).
 * Returns the new request id, or null when nothing could be stored (never throws).
 */
function mfs_store_request(array $data): ?int
{
  try {
    $fields = [];
    foreach ((array) ($data['fields'] ?? []) as $row) {
      if (!is_array($row)) continue;
      $l = mfs_cut(mfs_clean_text($row['l'] ?? '', false), 120);
      $n = mfs_cut(preg_replace('/[^A-Za-z0-9_\-\[\]]/', '', (string) ($row['n'] ?? '')), 60);
      $v = mfs_cut(mfs_clean_text($row['v'] ?? ''), 4000);
      if ($v === '' || ($l === '' && $n === '')) continue;
      $fields[] = ['l' => $l !== '' ? $l : $n, 'n' => $n, 'v' => $v];
      if (count($fields) >= 40) break;
    }
    if (!$fields) return null;

    $col = ['name' => '', 'email' => '', 'phone' => '', 'country' => '', 'company' => '', 'travel_dates' => '', 'travellers' => '', 'interests' => '', 'message' => ''];
    $map = [
      'name' => 'name', 'c-nm' => 'name',
      'email' => 'email', 'c-em' => 'email',
      'phone' => 'phone', 'c-ph' => 'phone',
      'when' => 'travel_dates', 'people' => 'travellers',
      'likes' => 'interests', 'c-likes' => 'interests',
      'message' => 'message', 'c-msg' => 'message',
      'company' => 'company', 'country' => 'country',
    ];
    // Older pages (cached site.js) send labels only: recognise the English labels the website uses.
    $byLabel = [
      'passenger' => 'name', 'full name' => 'name', 'contact person' => 'name', 'name' => 'name',
      'email' => 'email', 'work email' => 'email', 'phone' => 'phone', 'country code' => 'country_code',
      'when' => 'when', 'travellers' => 'people', 'would like to see' => 'likes',
      'message' => 'message', 'message (optional)' => 'message', 'anything else?' => 'message',
      'company' => 'company', 'country' => 'country',
    ];
    $dial = '';
    foreach ($fields as $f) {
      $n = strtolower($f['n']);
      if ($n === '') $n = $byLabel[strtolower($f['l'])] ?? '';
      if ($n === 'country_code') {
        if (preg_match('/\+\d{1,4}/', $f['v'], $m)) $dial = $m[0];
        continue;
      }
      if (isset($map[$n]) && $col[$map[$n]] === '') $col[$map[$n]] = $f['v'];
    }
    if ($col['phone'] !== '' && $dial !== '' && !preg_match('/^\s*(\+|00)/', $col['phone'])) $col['phone'] = $dial . ' ' . $col['phone'];
    $email = valid_email($col['email']);
    if ($email === '') $email = valid_email((string) ($data['email'] ?? ''));
    if ($email !== '') $col['email'] = $email;
    $col['name'] = mfs_cut(str_replace("\n", ' ', $col['name']), 200);
    $col['phone'] = mfs_cut(str_replace("\n", ' ', $col['phone']), 60);

    // A tour named in the interests (e.g. "The Cradle of Wine (Explorer)" from a tour page's link — the travel
    // style comes in the page's language: "(ოქროს საწმისი)", "(Золотое руно)").
    $tourId = '';
    $tier = '';
    if ($col['interests'] !== '') {
      $tourId = mfs_find_tour($col['interests']);
      if ($tourId !== '') $tier = mfs_find_tier($col['interests']);
    }

    $label = mfs_cut(mfs_clean_text($data['kind'] ?? '', false), 80);
    $kind = mfs_request_kind($label);
    $ref = strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', (string) ($data['ref'] ?? '')));
    $ref = mfs_cut($ref, 40);
    if ($ref === '') $ref = 'MFS-' . gmdate('ym') . '-' . random_int(1000, 9999);
    $lang = strtolower(mfs_cut(preg_replace('/[^A-Za-z-]/', '', (string) ($data['lang'] ?? '')), 8));
    $page = mfs_cut(mfs_clean_text($data['page'] ?? '', false), 200);
    $now = now_utc();
    $json = json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $id = db_tx(function (PDO $pdo) use ($ref, $kind, $label, $col, $tourId, $tier, $json, $lang, $page, $now) {
      $final = $ref;
      $exists = $pdo->prepare('SELECT 1 FROM requests WHERE ref = ?');
      for ($i = 2; ; $i++) {
        $exists->execute([$final]);
        if (!$exists->fetchColumn()) break;
        $final = $ref . '-' . $i;
        if ($i > 500) { $final = $ref . '-' . bin2hex(random_bytes(3)); break; }
      }
      // A new id, never one a deleted request had: an old email's "Open in the admin panel" link can't open
      // somebody else's request.
      $newId = db_next_id('requests');
      $st = $pdo->prepare('INSERT INTO requests (id, ref, kind, kind_label, status, name, email, phone, country, company, travel_dates,
        travellers, interests, tour_id, tier, message, fields_json, lang, page, created_at, updated_at)
        VALUES (?, ?, ?, ?, \'new\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $nz = function ($v) { return $v === '' ? null : $v; };
      $st->execute([$newId, $final, $kind, $label, $nz($col['name']), $nz($col['email']), $nz($col['phone']), $nz($col['country']),
        $nz($col['company']), $nz($col['travel_dates']), $nz($col['travellers']), $nz($col['interests']), $nz($tourId), $nz($tier),
        $nz($col['message']), $json, $nz($lang), $nz($page), $now, $now]);
      return $newId;
    });
    mfs_housekeeping();
    return $id > 0 ? $id : null;
  } catch (Throwable $e) {
    error_log('[mfs-admin] storing a request failed: ' . $e->getMessage());
    return null;
  }
}

/** The stored reference of a request ('' if unknown). */
function mfs_request_ref(int $id): string
{
  try {
    return (string) db_value('SELECT ref FROM requests WHERE id = ?', [$id]);
  } catch (Throwable $e) {
    return '';
  }
}

/** Adds a note to a request's timeline. $kind: note | status | system | email. Never throws. */
function mfs_store_note(int $requestId, string $body, string $kind = 'system', ?int $userId = null): void
{
  try {
    if (!in_array($kind, ['note', 'status', 'system', 'email'], true)) $kind = 'system';
    db_exec('INSERT INTO notes (request_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', [$requestId, $userId, $kind, $body, now_utc()]);
  } catch (Throwable $e) {
    error_log('[mfs-admin] note failed: ' . $e->getMessage());
  }
}

/** Absolute link to a request in the admin panel (for notification emails). */
function mfs_admin_request_url(int $id): string
{
  return mfs_admin_base_url() . 'index.php?p=request&id=' . $id;
}

/** For send.php: who to email and whether to email at all. ['to' => [addresses], 'notify' => bool]. Never throws. */
function mfs_notify_settings(string $builtIn): array
{
  try {
    return ['to' => form_recipients($builtIn), 'notify' => (bool) setting('notify_new_request')];
  } catch (Throwable $e) {
    return ['to' => mfs_parse_emails($builtIn), 'notify' => true];
  }
}
