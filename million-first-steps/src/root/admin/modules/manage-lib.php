<?php
/*
 * Shared helpers for the owners' "Manage" pages: tours.php (Tours & prices), settings.php, users.php (Team) and
 * activity.php. Loaded with require_once by those modules (modules/ is closed to the web by its .htaccess).
 *
 *   mg_posted(['price', $tourId, $tier])   one value from a nested POST array (price[tour][tier]) as clean,
 *                                          single-line text ('' when missing or not text)
 *   mg_posted_on([...])                    a nested checkbox was ticked
 *   mg_err($errors, $key) / mg_inv(...) / mg_cls(...)   field error text, aria attributes, .has-error class
 *   mg_error_summary($errors)              the "Please check the highlighted fields" box above a form
 *   mg_parse_euros($raw, &$why)            whole-euro price typed by a person → int | null (empty) | false
 *   mg_parse_factor($raw, &$why)           party-size factor ("0.93", "0,93") → float | null | false
 *   mg_num($f)                             a factor for people: 0.9 → "0.9", 1.0 → "1"
 *   mg_size($bytes)                        a file size for people: "1.4 MB"
 *   mg_publish()                           write_live_json(); on failure flashes a calm explanation
 *   mg_live_json_info()                    ['exists' => bool, 'updated' => UTC time|'', 'path' => …]
 *   mg_suggest_password()                  a readable random temporary password (14 characters)
 *   mg_user_name($id)                      a team member's name (cached), '' if unknown
 *   TOUR_STYLE_NAMES                       travel-style ids → English names (as on the website)
 *
 *   Activity log (audit_log, written by every module through audit()):
 *   MG_AREAS                               area key => [English label, icon, action prefixes]
 *   MG_ACTIONS                             action code => English description ("Signed in", …)
 *   mg_action_area($action)                'request' | 'booking' | … ('' when unknown)
 *   mg_action_title($action, $target, $details)   readable, translated description of one log line
 *   mg_action_details($action, $details)   the details made readable (status labels, tour names, euros)
 *   mg_actor_name($row)                    who did it: a name, "Automatic", "Not signed in", "A former team member"
 *   mg_target_links(array $rows)           [rowId => url] for log lines whose record still exists (checked by ref)
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

/** Travel styles as the website names them (src/data/tours.mjs STYLES). */
const TOUR_STYLE_NAMES = [
  'history' => 'History & culture',
  'wine' => 'Wine & food',
  'mountains' => 'Mountains & hiking',
  'short' => 'Short breaks',
  'coast' => 'Coast & nature',
];

/** One value from a nested POST array as clean single-line text: mg_posted(['c', 'email']) reads c[email]. */
function mg_posted(array $path): string
{
  $v = $_POST;
  foreach ($path as $k) {
    if (!is_array($v) || !array_key_exists((string) $k, $v)) return '';
    $v = $v[(string) $k];
  }
  return is_string($v) ? mfs_clean_text($v, false) : '';
}

/** True when a nested POST checkbox (e.g. show[tourId]) was ticked. */
function mg_posted_on(array $path): bool
{
  return mg_posted($path) !== '';
}

/** A safe id for a field key ('price.cradle-of-wine.explorer' → 'price-cradle-of-wine-explorer'). */
function mg_id(string $key): string
{
  return trim((string) preg_replace('/[^A-Za-z0-9_-]+/', '-', $key), '-');
}

/** The error line under a field (or ''). */
function mg_err(array $errors, string $key): string
{
  if (!isset($errors[$key])) return '';
  return '<p class="field__error" id="err-' . h(mg_id($key)) . '">' . icon('alert') . '<span>' . h($errors[$key]) . '</span></p>';
}

/** aria-invalid + aria-describedby for a field with an error (or ''). $also: ids the field is described by anyway. */
function mg_inv(array $errors, string $key, string $also = ''): string
{
  if (!isset($errors[$key])) return $also !== '' ? ' aria-describedby="' . h($also) . '"' : '';
  return ' aria-invalid="true" aria-describedby="' . h(trim('err-' . mg_id($key) . ' ' . $also)) . '"';
}

/** ' has-error' for the .field wrapper (or ''). */
function mg_cls(array $errors, string $key): string
{
  return isset($errors[$key]) ? ' has-error' : '';
}

/** The box above a form that failed validation. */
function mg_error_summary(array $errors, string $text = ''): string
{
  if (!$errors) return '';
  $n = count($errors);
  $msg = $text !== '' ? $text : ($n === 1 ? t('Please check the highlighted field — nothing has been saved yet.') : t('Please check the {n} highlighted fields — nothing has been saved yet.', ['n' => $n]));
  return '<div class="flash flash--error mg-summary" role="alert" data-error-summary><span class="flash__icon">' . icon('alert') . '</span><p class="flash__text">' . h($msg) . '</p></div>';
}

/**
 * A whole-euro price typed by a person: "1290", "1,290", "1.290", "€ 1 290", "1290.00" → 1290.
 * Returns null for an empty value, false when it isn't a usable price ($why says why, translated).
 */
function mg_parse_euros(string $raw, ?string &$why = null, int $min = 1, int $max = 1000000)
{
  $why = '';
  $s = trim(str_replace(['€', 'EUR', 'Eur', 'eur', ' ', "\xC2\xA0", "\xE2\x80\xAF", "\xE2\x80\x89", "'", '’'], '', $raw));
  if ($s === '') return null;
  $s = (string) preg_replace('/[.,]00?$/', '', $s);
  if (preg_match('/^\d{1,3}([,.])\d{3}(\1\d{3})*$/', $s)) {
    $n = (int) preg_replace('/\D/', '', $s);
  } elseif (preg_match('/^\d{1,7}$/', $s)) {
    $n = (int) $s;
  } elseif (preg_match('/^\d+[.,]\d{1,2}$/', $s)) {
    $why = t('Please use whole euros, without cents.');
    return false;
  } elseif (preg_match('/^[-−]/u', $s)) {
    $why = t('A price can’t be below zero.');
    return false;
  } else {
    $why = t('Please enter the price as a number of euros, like 1290.');
    return false;
  }
  if ($n < $min || $n > $max) {
    $why = t('Please enter a price between {min} and {max}.', ['min' => fmt_money($min), 'max' => fmt_money($max)]);
    return false;
  }
  return $n;
}

/** A party-size factor ("0.93", "0,93", ".9", "1") → float with 2 decimals; null when empty; false when invalid. */
function mg_parse_factor(string $raw, ?string &$why = null, float $min = 0.3, float $max = 3.0)
{
  $why = '';
  $s = str_replace([' ', ','], ['', '.'], trim($raw));
  if ($s === '') return null;
  if (!preg_match('/^(\d{1,2}(\.\d{0,3})?|\.\d{1,3})$/', $s)) {
    $why = t('Please enter a number like 0.93.');
    return false;
  }
  $f = round((float) $s, 2);
  if ($f < $min || $f > $max) {
    $why = t('Please choose a factor between {min} and {max}.', ['min' => number_format($min, 2), 'max' => number_format($max, 2)]);
    return false;
  }
  return $f;
}

/** A factor for people: 0.9 → "0.9", 1.0 → "1", 0.875 → "0.88". */
function mg_num(float $f): string
{
  return rtrim(rtrim(number_format($f, 2, '.', ''), '0'), '.');
}

/** A file size for people: "830 bytes", "84 KB", "1.4 MB". */
function mg_size(int $bytes): string
{
  if ($bytes < 1024) return t('{n} bytes', ['n' => $bytes]);
  if ($bytes < 1048576) return t('{n} KB', ['n' => number_format($bytes / 1024, 0)]);
  return t('{n} MB', ['n' => number_format($bytes / 1048576, 1)]);
}

/** Rewrites api/live.json. When that fails, says so in a calm flash message. */
function mg_publish(): bool
{
  $ok = write_live_json();
  if (!$ok) {
    error_log('[mfs-admin] api/live.json could not be written');
    flash('error', t('Your changes are saved here, but the website could not be updated: the server did not let us write the file api/live.json. Please make sure the “api” folder on the server can be written to, then press “Update the website again” under Settings.'));
  }
  return $ok;
}

/** About api/live.json: whether it exists and when it was last written (UTC). */
function mg_live_json_info(): array
{
  $f = MFS_SITE_ROOT . '/api/live.json';
  clearstatcache(true, $f);
  $t = @filemtime($f);
  return ['exists' => @is_file($f), 'updated' => $t ? gmdate('Y-m-d H:i:s', $t) : '', 'path' => $f];
}

/** A readable random temporary password like "k7Rm-qPa3-xWe9": 14 characters, no look-alike letters or digits. */
function mg_suggest_password(): string
{
  $alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  $out = '';
  for ($i = 0; $i < 12; $i++) {
    if ($i === 4 || $i === 8) $out .= '-';
    $out .= $alpha[random_int(0, strlen($alpha) - 1)];
  }
  return $out;
}

/** A team member's name by id (cached per request); '' when there is no such person. */
function mg_user_name($id): string
{
  static $names = null;
  if ($names === null) {
    $names = [];
    foreach (db_all('SELECT id, name FROM users') as $u) $names[(int) $u['id']] = (string) $u['name'];
  }
  return $names[(int) $id] ?? '';
}

// ── Activity log ─────────────────────────────────────────────────────────────────────────────────────────

/** Areas of the activity log (the filter on the Activity page): key => [English label, icon, action prefixes]. */
const MG_AREAS = [
  'request' => ['Requests', 'inbox', ['request.']],
  'booking' => ['Bookings', 'suitcase', ['booking.']],
  'payment' => ['Payments', 'euro', ['payment.']],
  'tours' => ['Tours & prices', 'tag', ['tours.']],
  'settings' => ['Settings', 'settings', ['settings.']],
  'user' => ['Team', 'users', ['user.']],
  'auth' => ['Sign-ins and accounts', 'key', ['auth.', 'account.']],
  'export' => ['Spreadsheet downloads', 'download', ['export.']],
  'system' => ['Automatic clean-up', 'refresh', ['system.']],
];

/** What each action code written by the modules means (English; shown through t()). */
const MG_ACTIONS = [
  'auth.setup' => 'Set up the team area and created the first owner account',
  'auth.login' => 'Signed in',
  'auth.logout' => 'Signed out',
  'auth.locked' => 'Sign-in paused for 15 minutes after too many wrong passwords',
  'auth.reset_requested' => 'Asked for a link to choose a new password',
  'auth.password_reset' => 'Chose a new password from an emailed link',
  'account.update' => 'Changed their own details',
  'account.password' => 'Changed their own password',
  'request.status' => 'Changed the status of a request',
  'request.update' => 'Updated a request',
  'request.note_delete' => 'Deleted a note from a request',
  'request.delete' => 'Deleted a request',
  'booking.create' => 'Created a booking',
  'booking.update' => 'Edited a booking',
  'booking.status' => 'Changed the status of a booking',
  'booking.note' => 'Added a note to a booking',
  'booking.delete' => 'Deleted a booking',
  'payment.add' => 'Recorded a payment',
  'payment.delete' => 'Deleted a payment',
  'export.requests' => 'Downloaded the requests spreadsheet',
  'export.bookings' => 'Downloaded the bookings spreadsheet',
  'export.payments' => 'Downloaded the payments spreadsheet',
  'tours.prices' => 'Changed tour prices',
  'tours.visibility' => 'Changed which tours are on the website',
  'tours.factors' => 'Changed the party-size factors',
  'tours.reset' => 'Put every tour back to the built-in prices',
  'settings.contact' => 'Changed the contact details',
  'settings.contact_reset' => 'Put a contact detail back to the built-in value',
  'settings.emails' => 'Changed the form emails',
  'settings.test_email' => 'Sent a test email',
  'settings.notice' => 'Changed the website notice',
  'settings.data' => 'Changed the statistics and data settings',
  'settings.backup' => 'Downloaded a database backup',
  'settings.publish' => 'Updated the website settings file',
  'user.create' => 'Added a team member',
  'user.update' => 'Changed a team member’s details',
  'user.role' => 'Changed a team member’s role',
  'user.password' => 'Set a new password for a team member',
  'user.deactivate' => 'Switched off a team member’s access',
  'user.reactivate' => 'Switched a team member’s access back on',
  'user.delete' => 'Removed a team member',
  'system.cleanup' => 'Daily clean-up removed old records',
];

/** The area key of an action code ('' when it belongs to none). */
function mg_action_area(string $action): string
{
  foreach (MG_AREAS as $key => $area) {
    foreach ($area[2] as $prefix) if (strpos($action, $prefix) === 0) return $key;
  }
  return '';
}

/** A readable, translated description of one activity-log line. */
function mg_action_title(string $action, string $target = '', string $details = ''): string
{
  if ($action === 'request.status' && $target === 'requests') return t('Changed the status of several requests');
  if ($action === 'request.delete' && $target === 'requests') return t('Deleted several requests');
  if ($action === 'tours.visibility') {
    $off = strpos($details, 'Taken off the website:') !== false;
    $on = strpos($details, 'Back on the website:') !== false;
    if ($off && !$on) return t('Took a tour off the website');
    if ($on && !$off) return t('Put a tour back on the website');
  }
  if ($action === 'settings.test_email' && strpos($details, 'Could not send') === 0) return t('Tried to send a test email (it could not be sent)');
  if (isset(MG_ACTIONS[$action])) return t(MG_ACTIONS[$action]);
  if (preg_match('/^export\.([a-z_]+)$/', $action, $m)) return t('Downloaded a spreadsheet ({type})', ['type' => $m[1]]);
  return $action;
}

/** The details of a log line made readable: status labels, tour and tier names, euros, contact field names. */
function mg_action_details(string $action, string $details): string
{
  $d = trim($details);
  if ($d === '') return '';
  if ($action === 'request.status' || $action === 'request.update') {
    $d = mg_arrow_labels($d, REQUEST_STATUSES);
    if ($action === 'request.update') {
      $d = (string) preg_replace_callback('/\bassigned user:(\d+)/', function ($m) {
        $n = mg_user_name($m[1]);
        return t('assigned to {name}', ['name' => $n !== '' ? $n : t('a former team member')]);
      }, $d);
    }
  } elseif ($action === 'booking.status') {
    $d = mg_arrow_labels($d, BOOKING_STATUSES);
  } elseif ($action === 'tours.prices') {
    $tiers = tiers();
    $d = (string) preg_replace_callback('~([a-z0-9-]+)/([a-z0-9-]+): (\d+) → (\d+)( \(built-in\))?~', function ($m) use ($tiers) {
      return tour_name($m[1]) . ', ' . t($tiers[$m[2]] ?? $m[2]) . ': ' . fmt_money((int) $m[3]) . ' → ' . fmt_money((int) $m[4])
        . (isset($m[5]) && $m[5] !== '' ? ' (' . t('built-in') . ')' : '');
    }, $d);
  } elseif ($action === 'tours.visibility') {
    $names = [];
    foreach (catalog()['tours'] as $t) $names[(string) $t['id']] = (string) $t['name'];
    $d = strtr($d, ['Taken off the website:' => t('Taken off the website:'), 'Back on the website:' => t('Back on the website:')]);
    $d = (string) preg_replace_callback('/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/', function ($m) use ($names) {
      return $names[$m[0]] ?? $m[0];
    }, $d);
  } elseif ($action === 'tours.factors') {
    $d = (string) preg_replace_callback('/(?<=^|; )(\d): /', function ($m) {
      return ($m[1] === '8' ? t('8 or more') : tp((int) $m[1], '{n} traveller', '{n} travellers')) . ': ';
    }, $d);
  } elseif ($action === 'settings.contact' || $action === 'settings.contact_reset') {
    $d = (string) preg_replace_callback('/(?<=^|; )([a-zA-Z]+): /', function ($m) {
      return isset(CONTACT_FIELDS[$m[1]]) ? t(CONTACT_FIELDS[$m[1]]) . ': ' : $m[0];
    }, $d);
    $d = strtr($d, ['(built-in)' => '(' . t('built-in') . ')', '(hidden)' => '(' . t('hidden') . ')']);
  } elseif ($action === 'settings.backup') {
    $d = (string) preg_replace_callback('/\((\d+) bytes\)/', function ($m) {
      return '(' . mg_size((int) $m[1]) . ')';
    }, $d);
    $d = strtr($d, ['Database backup downloaded' => t('Database backup downloaded')]);
  } elseif ($action === 'user.role') {
    $d = mg_arrow_labels($d, USER_ROLES);
  } elseif ($action === 'user.create' || $action === 'user.delete') {
    // "Name <email> as staff; …" / "Name <email> (owner)": only the role word, never inside an address.
    $d = (string) preg_replace_callback('/(?<=> as )(owner|staff)\b|(?<=\()(owner|staff)(?=\)$)/', function ($m) {
      $k = $m[1] !== '' ? $m[1] : $m[2];
      return t(USER_ROLES[$k]);
    }, $d);
  }
  return $d;
}

/** Status/role keys written around arrows ("new → contacted", "→ lost: …") as their translated labels. */
function mg_arrow_labels(string $d, array $labels): string
{
  $keys = implode('|', array_map(function ($k) { return preg_quote((string) $k, '/'); }, array_keys($labels)));
  $label = function ($k) use ($labels) { return t($labels[$k]); };
  $d = (string) preg_replace_callback('/\b(' . $keys . ')( → )(' . $keys . ')\b/', function ($m) use ($label) {
    return $label($m[1]) . $m[2] . $label($m[3]);
  }, $d);
  return (string) preg_replace_callback('/(^|[^\p{L}])(→ )(' . $keys . ')\b/u', function ($m) use ($label) {
    return $m[1] . $m[2] . $label($m[3]);
  }, $d);
}

/** Who did it: their name, or what kind of entry it is when no one was signed in. */
function mg_actor_name(array $row): string
{
  $uid = $row['user_id'];
  if ($uid !== null && $uid !== '') {
    $n = mg_user_name($uid);
    return $n !== '' ? $n : t('A former team member');
  }
  $area = mg_action_area((string) $row['action']);
  if ($area === 'system') return t('Automatic');
  if ($area === 'auth') return t('Not signed in');
  return t('Automatic');
}

/**
 * Links for log lines whose record still exists: [audit_log id => admin URL]. Requests and bookings are only
 * linked when the record's reference appears in the details (row ids can be reused after a deletion).
 */
function mg_target_links(array $rows): array
{
  $want = ['request' => [], 'booking' => [], 'payment' => [], 'user' => []];
  foreach ($rows as $r) {
    if (preg_match('/^(request|booking|payment|user):(\d{1,12})$/', (string) $r['target'], $m)) $want[$m[1]][(int) $m[2]] = true;
  }
  $found = ['request' => [], 'booking' => [], 'payment' => [], 'user' => []];
  $in = function (array $ids) { return implode(',', array_map('intval', array_keys($ids))); };
  if ($want['request']) foreach (db_all('SELECT id, ref FROM requests WHERE id IN (' . $in($want['request']) . ')') as $x) $found['request'][(int) $x['id']] = (string) $x['ref'];
  if ($want['booking']) foreach (db_all('SELECT id, ref FROM bookings WHERE id IN (' . $in($want['booking']) . ')') as $x) $found['booking'][(int) $x['id']] = (string) $x['ref'];
  if ($want['payment']) foreach (db_all('SELECT p.id, b.id AS bid, b.ref FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.id IN (' . $in($want['payment']) . ')') as $x) $found['payment'][(int) $x['id']] = [(int) $x['bid'], (string) $x['ref']];
  if ($want['user']) foreach (db_all('SELECT id, name, email FROM users WHERE id IN (' . $in($want['user']) . ')') as $x) $found['user'][(int) $x['id']] = [(string) $x['name'], (string) $x['email']];

  $sections = [
    'settings:contact' => ['settings', 'contact'], 'settings:form_recipients' => ['settings', 'emails'],
    'settings:notice' => ['settings', 'notice'], 'settings:data' => ['settings', 'data'], 'file:api/live.json' => ['settings', 'backup'],
    'settings:tour_prices' => ['tours', ''], 'settings:tours_hidden' => ['tours', ''], 'settings:party_factors' => ['tours', 'factors'],
  ];
  $out = [];
  foreach ($rows as $r) {
    $target = (string) $r['target'];
    $details = (string) $r['details'];
    $id = (int) $r['id'];
    if (isset($sections[$target])) {
      $out[$id] = url($sections[$target][0]) . ($sections[$target][1] !== '' ? '#' . $sections[$target][1] : '');
      continue;
    }
    if (!preg_match('/^(request|booking|payment|user):(\d{1,12})$/', $target, $m)) continue;
    $n = (int) $m[2];
    if ($m[1] === 'request' && isset($found['request'][$n]) && $found['request'][$n] !== '' && strpos($details, $found['request'][$n]) !== false) {
      $out[$id] = url('request', ['id' => $n]);
    } elseif ($m[1] === 'booking' && isset($found['booking'][$n]) && $found['booking'][$n] !== '' && strpos($details, $found['booking'][$n]) !== false) {
      $out[$id] = url('booking', ['id' => $n]);
    } elseif ($m[1] === 'payment' && isset($found['payment'][$n]) && strpos($details, $found['payment'][$n][1]) === 0) {
      $out[$id] = url('booking', ['id' => $found['payment'][$n][0]]);
    } elseif ($m[1] === 'user' && isset($found['user'][$n]) && strpos((string) $r['action'], 'user.') === 0
      && (stripos($details, $found['user'][$n][0]) !== false || stripos($details, $found['user'][$n][1]) !== false)) {
      $out[$id] = url('users', ['id' => $n]);
    }
  }
  return $out;
}
