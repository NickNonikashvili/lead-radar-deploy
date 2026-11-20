<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
/*
 * Settings (?p=settings) — owners only. One page, separate forms (each saves on its own):
 *
 *   #contact   contact details the website shows (setting "contact": only overridden fields; "" = hidden).
 *              Built-in values are the placeholders; "Use the built-in value" per field; "Don't show" per field.
 *              → write_live_json() + audit settings.contact / settings.contact_reset
 *   #emails    where form emails go (form_recipients), notify on/off (notify_new_request), "Send a test email"
 *              → audit settings.emails / settings.test_email
 *   #notice    the website notice: on/off + text per website language, English required (setting "notice")
 *              → write_live_json() + audit settings.notice
 *   #data      visit statistics on/off (analytics_enabled), retention (retention_months, spam_retention_days)
 *              → audit settings.data
 *   #backup    database backup download (VACUUM INTO a temp file in the data folder, stream, delete),
 *              CSV exports (links to ?p=export), "Update the website again" (rewrites api/live.json)
 *              → audit settings.backup / settings.publish
 * A form that doesn't pass the checks is shown again with what was typed and a message under each field.
 */
require_once __DIR__ . '/manage-lib.php';
$me = require_owner();

const ST_RETENTION_MONTHS = [3, 120];
const ST_SPAM_DAYS = [7, 365];
const ST_NOTICE_MAX = 240;
const ST_CONTACT_MAX = ['address' => 200, 'officeHours' => 120, 'legalName' => 120, 'registrationNumber' => 40];

/** Example values for empty built-in fields (placeholders). */
const ST_CONTACT_EXAMPLES = [
  'email' => 'hello@example.ge',
  'phone' => '+995 555 12 34 56',
  'whatsapp' => '+995 555 12 34 56',
  'telegram' => '@millionfirststeps',
  'signal' => 'https://signal.me/#eu/…',
  'instagram' => '@millionfirststeps',
  'facebook' => 'https://facebook.com/…',
  'address' => 'Tbilisi, Georgia',
  'officeHours' => 'Mon–Fri, 10:00–19:00',
  'legalName' => 'Million First Steps LLC',
  'registrationNumber' => '405123456',
];

/** Contact fields grouped as on the page: group title => keys. */
const ST_CONTACT_GROUPS = [
  'How to reach you' => ['email', 'phone', 'address', 'officeHours'],
  'Messaging apps and social media' => ['whatsapp', 'telegram', 'signal', 'instagram', 'facebook'],
  'Company' => ['legalName', 'registrationNumber'],
];

/** True for a full https:// link with a proper host name. */
function st_https_url(string $v): bool
{
  if (strlen($v) > 300 || !preg_match('~^https://[^\s"\'<>\\\\`{}|^]+$~i', $v)) return false;
  $host = parse_url($v, PHP_URL_HOST);
  return is_string($host) && (bool) preg_match('/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i', $host);
}

/** A social-media link: a full https link, the site's address without https://, or just @username. */
function st_social_url(string $v, string $domains, string $handleRe, string $base, ?string &$why): ?string
{
  if (preg_match('~^http://~i', $v)) {
    $why = t('Please use the secure link, starting with https://');
    return null;
  }
  if (!preg_match('~^https://~i', $v) && preg_match('~^(?:www\.|m\.)?(?:' . $domains . ')(?:/|$)~i', $v)) $v = 'https://' . $v;
  elseif (preg_match($handleRe, $v)) return $base . ltrim($v, '@');
  if (!st_https_url($v)) {
    $why = t('Please paste the full link, starting with https://, or just your @username.');
    return null;
  }
  return $v;
}

/**
 * A contact value as typed → the value to store ('' for empty), or null when it isn't usable ($why = reason).
 * Phone and WhatsApp need the country code; Telegram is a username; Signal/Instagram/Facebook are https links.
 */
function st_contact_clean(string $key, string $raw, ?string &$why): ?string
{
  $why = '';
  $v = trim((string) preg_replace('/\s+/u', ' ', $raw));
  if ($v === '') return '';
  $len = function_exists('mb_strlen') ? mb_strlen($v) : strlen($v);
  switch ($key) {
    case 'email':
      $e = valid_email($v);
      if ($e === '') $why = t('Please enter a valid email address, like hello@example.ge.');
      return $e !== '' ? $e : null;

    case 'phone':
      $s = (string) preg_replace('/^00\s*/', '+', $v);
      $digits = (string) preg_replace('/\D/', '', $s);
      if (!preg_match('~^\+[\d\s().\-/]+$~', $s)) {
        $why = t('Please enter the number with its country code, starting with +, like +995 555 12 34 56.');
        return null;
      }
      if (strlen($digits) < 7 || strlen($digits) > 15) {
        $why = t('That number looks too short or too long. Please check it, with the country code, like +995 555 12 34 56.');
        return null;
      }
      return $s;

    case 'whatsapp':
      $s = $v;
      if (preg_match('~^(?:https?://)?(?:api\.|www\.)?(?:wa\.me|whatsapp\.com)/(?:send/?\?phone=)?\+?([\d\s-]+)~i', $s, $m)) $s = '+' . $m[1];
      $s = (string) preg_replace('/^00\s*/', '+', $s);
      $digits = (string) preg_replace('/\D/', '', $s);
      if (!preg_match('/^\+?[\d\s().-]+$/', $s) || strlen($digits) < 8 || strlen($digits) > 15) {
        $why = t('Please enter the WhatsApp number with its country code, like +995 555 12 34 56.');
        return null;
      }
      if ($digits[0] === '0') {
        $why = t('Please start with the country code (995 for Georgia) instead of 0.');
        return null;
      }
      // Kept as typed (spaces help people read it); the website's link uses the digits only.
      return '+' . ltrim(trim($s), '+');

    case 'telegram':
      $s = (string) preg_replace('~^(?:https?://)?(?:www\.)?(?:t\.me|telegram\.me)/~i', '', $v);
      $s = rtrim(ltrim($s, '@'), '/');
      if (!preg_match('/^[A-Za-z][A-Za-z0-9_]{4,31}$/', $s)) {
        $why = t('Please enter your Telegram username (5 to 32 letters, digits or _), like @millionfirststeps.');
        return null;
      }
      return $s;

    case 'signal':
      if (preg_match('~^http://~i', $v)) {
        $why = t('Please use the secure link, starting with https://');
        return null;
      }
      if (!st_https_url($v)) {
        $why = t('Please paste your Signal link, starting with https:// (in Signal: Settings → Profile → Username → QR code or link).');
        return null;
      }
      return $v;

    case 'instagram':
      return st_social_url($v, 'instagram\.com|instagr\.am', '/^@?[A-Za-z0-9._]{1,30}$/', 'https://instagram.com/', $why);

    case 'facebook':
      return st_social_url($v, 'facebook\.com|fb\.com|fb\.me', '/^@?[A-Za-z0-9.]{5,50}$/', 'https://facebook.com/', $why);

    case 'registrationNumber':
      if ($len > ST_CONTACT_MAX[$key] || !preg_match('~^[\p{L}\p{N}][\p{L}\p{N} .\-/]*$~u', $v)) {
        $why = t('Please use only letters, digits, spaces, dots, dashes or slashes (at most {n} characters).', ['n' => ST_CONTACT_MAX[$key]]);
        return null;
      }
      return $v;

    default:
      $max = ST_CONTACT_MAX[$key] ?? 200;
      if ($len > $max) {
        $why = t('Please keep it to {n} characters at most.', ['n' => $max]);
        return null;
      }
      return $v;
  }
}

/** Format help for a contact field. */
function st_contact_hint(string $key): string
{
  $hints = [
    'email' => 'Shown on the website behind a “Show email” button, so robots can’t collect it.',
    'phone' => 'With the country code, like +995 555 12 34 56.',
    'whatsapp' => 'The number with its country code. Visitors get a link that opens a WhatsApp chat.',
    'telegram' => 'Your username, like @millionfirststeps.',
    'signal' => 'Your Signal link, starting with https://',
    'instagram' => 'Your profile link, or just @username.',
    'facebook' => 'Your page link, or just the page’s username.',
    'address' => 'One line, like Tbilisi, Georgia.',
    'officeHours' => 'Shown on the contact page.',
    'legalName' => 'Shown in the footer and on the About page.',
    'registrationNumber' => 'Your company’s identification code, shown in the footer.',
  ];
  return isset($hints[$key]) ? t($hints[$key]) : '';
}

/** "phone: (built-in) → +995 …" style lines for the activity log. */
function st_describe_value(array $over, string $k): string
{
  if (!array_key_exists($k, $over)) return '(built-in)';
  return $over[$k] === '' ? '(hidden)' : (string) $over[$k];
}

/** Requests that a retention of $months would remove at the next clean-up (same rule as housekeeping.php). */
function st_would_remove(int $months, int $spamDays): array
{
  $out = ['requests' => 0, 'spam' => 0];
  if ($months > 0) {
    $out['requests'] = (int) db_value("SELECT COUNT(*) FROM requests WHERE status IN ('new','contacted','quoted','lost')
      AND MAX(created_at, updated_at) < ? AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.request_id = requests.id)", [gmdate('Y-m-d H:i:s', strtotime('-' . $months . ' months'))]);
  }
  if ($spamDays > 0) {
    $out['spam'] = (int) db_value("SELECT COUNT(*) FROM requests WHERE status = 'spam' AND MAX(created_at, updated_at) < ?
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.request_id = requests.id)", [gmdate('Y-m-d H:i:s', time() - $spamDays * 86400)]);
  }
  return $out;
}

/**
 * A consistent copy of the database in $tmp. VACUUM INTO (SQLite 3.27+) makes a compact snapshot while others keep
 * working; on an older SQLite the files are copied while writers wait (BEGIN IMMEDIATE), and the copy's WAL is
 * folded into it. Returns '' or what went wrong.
 */
function st_snapshot(string $tmp): string
{
  try {
    db()->exec('VACUUM INTO ' . db()->quote($tmp));
    return '';
  } catch (Throwable $e) {
    $why = $e->getMessage();
  }
  foreach (['', '-wal', '-shm', '-journal'] as $sfx) if (@is_file($tmp . $sfx)) @unlink($tmp . $sfx);
  $src = mfs_data_dir() . '/mfs.sqlite';
  try {
    db_tx(function () use ($src, $tmp) {
      if (!@copy($src, $tmp)) throw new RuntimeException('copy failed');
      if (@is_file($src . '-wal') && !@copy($src . '-wal', $tmp . '-wal')) throw new RuntimeException('copy of the WAL failed');
    });
    $c = new PDO('sqlite:' . $tmp, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $c->query('PRAGMA wal_checkpoint(TRUNCATE)')->fetchAll();
    $c = null;
    return '';
  } catch (Throwable $e) {
    return 'VACUUM INTO: ' . $why . '; copy: ' . $e->getMessage();
  }
}

/** Makes a consistent copy of the database (VACUUM INTO a temp file), checks it, streams it, deletes it. Exits. */
function st_send_backup(): void
{
  @set_time_limit(300);
  ignore_user_abort(true);
  $tmp = mfs_data_dir() . '/backup-' . bin2hex(random_bytes(8)) . '.sqlite';
  $cleanup = function () use ($tmp) {
    foreach (['', '-wal', '-shm', '-journal'] as $sfx) if (@is_file($tmp . $sfx)) @unlink($tmp . $sfx);
  };
  register_shutdown_function($cleanup);
  $fail = function (string $why) use ($cleanup) {
    $cleanup();
    error_log('[mfs-admin] backup failed: ' . $why);
    flash('error', t('The backup could not be made just now. Please try again in a minute; if it keeps failing, tell whoever looks after the website (the details are in the server’s error log).'));
    redirect(url('settings') . '#backup');
  };
  $why = st_snapshot($tmp);
  if ($why !== '') $fail($why);
  $ok = false;
  try {
    // One self-contained file (no -wal beside it), checked before anyone relies on it.
    $chk = new PDO('sqlite:' . $tmp, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $chk->query('PRAGMA journal_mode = DELETE')->fetchAll();
    // The copy leaves out the panel's secrets and today's IP-hashing salt with the hashes it protects (visitor
    // hashes, sign-in attempts): they are short-lived, of no use in a backup, and could re-identify today's
    // visitors. VACUUM then rewrites the file so nothing deleted stays readable in it.
    $chk->exec("DELETE FROM settings WHERE key IN ('daily_salt', 'housekeeping_day', 'cookie_secret', 'dummy_hash')");
    $chk->exec('DELETE FROM stats_seen');
    $chk->exec('DELETE FROM login_attempts');
    $chk->exec('VACUUM');
    $ok = $chk->query('PRAGMA quick_check')->fetchColumn() === 'ok' && (int) $chk->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
    $chk = null;
  } catch (Throwable $e) {
    $ok = false;
  }
  clearstatcache(true, $tmp);
  $size = (int) @filesize($tmp);
  if (!$ok || $size <= 0) $fail('the copy did not pass its check');
  audit('settings.backup', '', 'Database backup downloaded (' . $size . ' bytes)');
  // The download can take a while on a phone: don't keep this person's other pages waiting for the session.
  if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
  while (ob_get_level() > 0) ob_end_clean();
  $name = 'million-first-steps-backup-' . (new DateTime('now', mfs_tz()))->format('Y-m-d-Hi') . '.sqlite';
  header('Content-Type: application/vnd.sqlite3');
  header('Content-Disposition: attachment; filename="' . $name . '"');
  header('Content-Length: ' . $size);
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: no-store');
  $fh = @fopen($tmp, 'rb');
  if ($fh) {
    while (!feof($fh)) {
      echo fread($fh, 65536);
      flush();
      if (connection_aborted()) break;
    }
    fclose($fh);
  }
  $cleanup();
  exit;
}

// ── Current values ─────────────────────────────────────────────────────────
$cat = catalog();
$builtContact = [];
foreach (array_keys(CONTACT_FIELDS) as $k) $builtContact[$k] = trim((string) ($cat['contact'][$k] ?? ''));
$contactOver = setting('contact');
$contactOver = is_array($contactOver) ? $contactOver : [];
$builtRecipients = trim((string) (($cat['contact']['formTo'] ?? '') !== '' ? $cat['contact']['formTo'] : ($cat['contact']['email'] ?? '')));
$langs = [];
foreach ((array) $cat['languages'] as $l) if (isset($l['code'])) $langs[(string) $l['code']] = (string) ($l['name'] ?? $l['code']);
if (!isset($langs['en'])) $langs = ['en' => 'English'] + $langs;
$langs = ['en' => $langs['en']] + $langs;
$notice = setting('notice');
$notice = is_array($notice) ? $notice + ['enabled' => false, 'text' => []] : ['enabled' => false, 'text' => []];
$noticeText = is_array($notice['text']) ? $notice['text'] : [];

$errors = [];
$form = '';

// ── Saving ─────────────────────────────────────────────────────────────────
if (is_post()) {
  csrf_check();
  $form = post('action');

  if ($form === 'contact') {
    $new = [];
    foreach (array_keys(CONTACT_FIELDS) as $k) {
      $built = $builtContact[$k];
      if (mg_posted_on(['hide', $k])) {
        if ($built !== '') $new[$k] = '';
        continue;
      }
      $why = '';
      $v = st_contact_clean($k, mg_posted(['c', $k]), $why);
      if ($v === null) {
        $errors['c.' . $k] = $why;
        continue;
      }
      // Same as built in (ignoring spacing and capitals where they don't matter) = no change of its own.
      if ($v === '' || $v === $built) continue;
      if (in_array($k, ['phone', 'whatsapp'], true) && $built !== '' && preg_replace('/\D/', '', $built) === preg_replace('/\D/', '', $v)) continue;
      if (in_array($k, ['email', 'telegram'], true) && strcasecmp(ltrim($built, '@'), $v) === 0) continue;
      $new[$k] = $v;
    }
    if (!$errors) {
      $lines = [];
      foreach (array_keys(CONTACT_FIELDS) as $k) {
        $a = st_describe_value($contactOver, $k);
        $b = st_describe_value($new, $k);
        if ($a !== $b) $lines[] = $k . ': ' . $a . ' → ' . $b;
      }
      set_setting('contact', $new);
      if ($lines) audit('settings.contact', 'settings:contact', implode('; ', $lines));
      if (mg_publish()) {
        flash($lines ? 'ok' : 'info', $lines
          ? t('Contact details saved. The website follows within a minute.')
          : t('Nothing had changed, so everything stays as it was.'));
      }
      redirect(url('settings') . '#contact');
    }
  } elseif ($form === 'contact_reset') {
    $k = post('field');
    if (isset(CONTACT_FIELDS[$k]) && array_key_exists($k, $contactOver)) {
      $old = st_describe_value($contactOver, $k);
      unset($contactOver[$k]);
      set_setting('contact', $contactOver);
      audit('settings.contact_reset', 'settings:contact', $k . ': ' . $old . ' → (built-in)');
      if (mg_publish()) {
        flash('ok', $builtContact[$k] !== ''
          ? t('{field} is back to the website’s built-in value: {value}', ['field' => t(CONTACT_FIELDS[$k]), 'value' => $builtContact[$k]])
          : t('{field} is back to how the website was built: not shown.', ['field' => t(CONTACT_FIELDS[$k])]));
      }
    }
    redirect(url('settings') . '#contact');
  } elseif ($form === 'emails') {
    $raw = post('recipients');
    $list = [];
    foreach (preg_split('/[\s,;]+/', $raw) ?: [] as $part) {
      if ($part === '') continue;
      $e = valid_email($part);
      if ($e === '') {
        $errors['recipients'] = t('“{value}” isn’t a valid email address. Separate several addresses with commas.', ['value' => excerpt($part, 60)]);
        break;
      }
      $list[strtolower($e)] = $e;
    }
    if (!$errors && count($list) > 10) $errors['recipients'] = t('Please use at most 10 addresses.');
    $notify = post('notify') !== '';
    $fromRaw = post('mail_from');
    $from = $fromRaw === '' ? '' : valid_email($fromRaw);
    if ($fromRaw !== '' && $from === '') $errors['mail_from'] = t('“{value}” isn’t a valid email address.', ['value' => excerpt($fromRaw, 60)]);
    if (!$errors) {
      $value = implode(', ', array_values($list));
      $oldValue = (string) setting('form_recipients', '');
      $oldNotify = (bool) setting('notify_new_request');
      $oldFrom = (string) setting('mail_from', '');
      set_setting('form_recipients', $value);
      set_setting('notify_new_request', $notify);
      set_setting('mail_from', $from);
      $lines = [];
      if ($oldValue !== $value) $lines[] = 'recipients: ' . ($oldValue !== '' ? $oldValue : '(built-in)') . ' → ' . ($value !== '' ? $value : '(built-in)');
      if ($oldNotify !== $notify) $lines[] = 'email on new requests: ' . ($notify ? 'on' : 'off');
      if ($oldFrom !== $from) $lines[] = 'sender: ' . ($oldFrom !== '' ? $oldFrom : '(automatic)') . ' → ' . ($from !== '' ? $from : '(automatic)');
      if ($lines) audit('settings.emails', 'settings:form_recipients', implode('; ', $lines));
      flash($lines ? 'ok' : 'info', $lines ? ($notify
        ? t('Saved. New requests are emailed to {to}.', ['to' => implode(', ', form_recipients())])
        : t('Saved. New requests are no longer emailed — you’ll find them under Requests.'))
        : t('Nothing had changed, so everything stays as it was.'));
      redirect(url('settings') . '#emails');
    }
  } elseif ($form === 'test_email') {
    $to = form_recipients();
    $last = (int) ($_SESSION['mg_test_mail_at'] ?? 0);
    if (!$to) {
      flash('error', t('There is no address to send to. Enter one under “Send the website’s forms to” and save first.'));
    } elseif (time() - $last < 20) {
      flash('info', t('A test email was sent a moment ago. Please wait a little before sending another.'));
    } else {
      $_SESSION['mg_test_mail_at'] = time();
      $when = (new DateTime('now', mfs_tz()))->format('j M Y, H:i');
      $body = t('Hello,') . "\n\n"
        . t('This is a test email from the Million First Steps team area, sent by {name} on {when} (Tbilisi time).', ['name' => $me['name'], 'when' => $when]) . "\n\n"
        . t('If you can read this, the website’s request forms reach this address. If it arrived in the spam folder, mark it as “not spam” so real requests arrive in the inbox.') . "\n\n"
        . t('Team area: {url}', ['url' => mfs_admin_base_url()]) . "\n";
      $ok = send_mail($to, t('Test email from your website'), $body, (string) $me['email']);
      audit('settings.test_email', '', ($ok ? 'Sent to ' : 'Could not send to ') . implode(', ', $to));
      if ($ok) flash('ok', t('Test email sent to {to}. If it hasn’t arrived within a few minutes, look in the spam folder.', ['to' => implode(', ', $to)]));
      else flash('error', t('The server could not send the email. On Hostinger, check that the address under “Send emails from” ({from}) is an email account that exists for your domain, then try again.', ['from' => mfs_mail_from()]));
    }
    redirect(url('settings') . '#emails');
  } elseif ($form === 'notice') {
    $on = post('notice_on') !== '';
    $texts = [];
    foreach ($langs as $code => $name) {
      $v = mg_posted(['notice', $code]);
      $len = function_exists('mb_strlen') ? mb_strlen($v) : strlen($v);
      if ($len > ST_NOTICE_MAX) $errors['notice.' . $code] = t('Please keep it to {n} characters at most (now {len}).', ['n' => ST_NOTICE_MAX, 'len' => $len]);
      elseif ($v !== '') $texts[$code] = $v;
    }
    if ($on && !isset($texts['en']) && !isset($errors['notice.en'])) $errors['notice.en'] = t('Please write the notice in English — visitors in other languages see it when their language is empty.');
    if (!$errors) {
      $newNotice = ['enabled' => $on, 'text' => $texts];
      $lines = [];
      if ((bool) $notice['enabled'] !== $on) $lines[] = $on ? 'switched on' : 'switched off';
      if ($noticeText != $texts) $lines[] = 'text changed (' . ($texts ? implode(', ', array_keys($texts)) : 'none') . ')';
      set_setting('notice', $newNotice);
      if ($lines) audit('settings.notice', 'settings:notice', implode('; ', $lines) . (isset($texts['en']) ? ': “' . excerpt($texts['en'], 120) . '”' : ''));
      if (mg_publish()) {
        flash($lines ? 'ok' : 'info', !$lines ? t('Nothing had changed, so everything stays as it was.')
          : ($on ? t('Saved. The notice appears at the top of every page of the website within a minute.') : t('Saved. The notice is switched off — the website stops showing it within a minute.')));
      }
      redirect(url('settings') . '#notice');
    }
  } elseif ($form === 'data') {
    $analytics = post('analytics') !== '';
    $months = post('retention_months');
    $days = post('spam_days');
    $mInt = preg_match('/^\d{1,4}$/', $months) ? (int) $months : -1;
    $dInt = preg_match('/^\d{1,4}$/', $days) ? (int) $days : -1;
    if (!($mInt === 0 || ($mInt >= ST_RETENTION_MONTHS[0] && $mInt <= ST_RETENTION_MONTHS[1]))) {
      $errors['retention_months'] = t('Please choose between {min} and {max} months, or 0 to keep them for ever.', ['min' => ST_RETENTION_MONTHS[0], 'max' => ST_RETENTION_MONTHS[1]]);
    }
    if (!($dInt === 0 || ($dInt >= ST_SPAM_DAYS[0] && $dInt <= ST_SPAM_DAYS[1]))) {
      $errors['spam_days'] = t('Please choose between {min} and {max} days, or 0 to keep it for ever.', ['min' => ST_SPAM_DAYS[0], 'max' => ST_SPAM_DAYS[1]]);
    }
    if (!$errors) {
      $old = [(bool) setting('analytics_enabled'), (int) setting('retention_months'), (int) setting('spam_retention_days')];
      set_setting('analytics_enabled', $analytics);
      set_setting('retention_months', $mInt);
      set_setting('spam_retention_days', $dInt);
      $lines = [];
      if ($old[0] !== $analytics) $lines[] = 'visit statistics: ' . ($analytics ? 'on' : 'off');
      if ($old[1] !== $mInt) $lines[] = 'keep requests: ' . ($old[1] ?: 'for ever') . ' → ' . ($mInt ?: 'for ever') . ($mInt ? ' months' : '');
      if ($old[2] !== $dInt) $lines[] = 'keep spam: ' . ($old[2] ?: 'for ever') . ' → ' . ($dInt ?: 'for ever') . ($dInt ? ' days' : '');
      if ($lines) audit('settings.data', 'settings:data', implode('; ', $lines));
      flash($lines ? 'ok' : 'info', $lines ? t('Saved.') : t('Nothing had changed, so everything stays as it was.'));
      if (($mInt && $mInt !== $old[1]) || ($dInt && $dInt !== $old[2])) {
        $gone = st_would_remove($mInt, $dInt);
        if ($gone['requests'] + $gone['spam'] > 0) {
          flash('info', t('At the next daily clean-up (within a day), {requests} and {spam} older than this will be deleted.', [
            'requests' => tp($gone['requests'], '{n} request', '{n} requests'), 'spam' => tp($gone['spam'], '{n} spam message', '{n} spam messages'),
          ]));
        }
      }
      redirect(url('settings') . '#data');
    }
  } elseif ($form === 'backup') {
    st_send_backup();
  } elseif ($form === 'publish') {
    if (write_live_json()) {
      audit('settings.publish', 'file:api/live.json', 'Website settings file written again');
      flash('ok', t('Done — the website has the latest prices, contact details and notice.'));
    } else {
      error_log('[mfs-admin] api/live.json could not be written');
      flash('error', t('The website could not be updated: the server did not let us write the file api/live.json. Please make sure the “api” folder on the server can be written to, then try again.'));
    }
    redirect(url('settings') . '#backup');
  } else {
    redirect(url('settings'));
  }
}

// ── The page ───────────────────────────────────────────────────────────────
$sent = function ($path, $current) use ($form, $errors) {
  // What to show in a field: what was just typed (when that form needs fixing), else the saved value.
  if ($errors && $form !== '' && $path[0] === $form) return mg_posted(array_slice($path, 1));
  return $current;
};
$contactFailed = $errors && $form === 'contact';
$recipients = $errors && $form === 'emails' ? post('recipients') : (string) setting('form_recipients', '');
$notify = $errors && $form === 'emails' ? post('notify') !== '' : (bool) setting('notify_new_request');
$mailFrom = $errors && $form === 'emails' ? post('mail_from') : (string) setting('mail_from', '');
$noticeOn = $errors && $form === 'notice' ? post('notice_on') !== '' : (bool) $notice['enabled'];
$analytics = $errors && $form === 'data' ? post('analytics') !== '' : (bool) setting('analytics_enabled');
$months = $errors && $form === 'data' ? post('retention_months') : (string) (int) setting('retention_months');
$spamDays = $errors && $form === 'data' ? post('spam_days') : (string) (int) setting('spam_retention_days');
$live = mg_live_json_info();
$dbFile = mfs_data_dir() . '/mfs.sqlite';
$dbSize = (int) @filesize($dbFile) + (int) @filesize($dbFile . '-wal');
$lastBackup = db_row("SELECT at, user_id FROM audit_log WHERE action = 'settings.backup' ORDER BY id DESC LIMIT 1");
$csvCounts = [
  'requests' => (int) db_value("SELECT COUNT(*) FROM requests WHERE status <> 'spam'"),
  'bookings' => (int) db_value('SELECT COUNT(*) FROM bookings'),
  'payments' => (int) db_value('SELECT COUNT(*) FROM payments'),
];
// "Other languages" starts open when any of them has text (saved, or just typed into a form that needs fixing).
$noticeOther = false;
foreach ($langs as $code => $name) {
  if ($code === 'en') continue;
  if ((string) $sent(['notice', 'notice', $code], (string) ($noticeText[$code] ?? '')) !== '' || isset($errors['notice.' . $code])) $noticeOther = true;
}

$sections = [
  'contact' => t('Contact details'),
  'emails' => t('Form emails'),
  'notice' => t('Website notice'),
  'data' => t('Statistics & data'),
  'backup' => t('Backups & downloads'),
];

ob_start(); ?>
<div class="st-layout">
  <nav class="st-nav" aria-label="<?= h(t('On this page')) ?>">
    <p class="st-nav__title"><?= h(t('On this page')) ?></p>
    <ul class="st-nav__list">
      <?php foreach ($sections as $id => $label) { ?><li><a class="st-nav__link" href="#<?= h($id) ?>"><?= h($label) ?></a></li><?php } ?>
      <li class="st-nav__sep"><a class="st-nav__link" href="<?= h(url('activity')) ?>"><?= icon('history') ?><?= h(t('Activity log')) ?></a></li>
      <li><a class="st-nav__link" href="<?= h(url('export')) ?>"><?= icon('download') ?><?= h(t('Export')) ?></a></li>
    </ul>
  </nav>

  <div class="st-main stack stack--lg">

  <!-- Contact details ------------------------------------------------------------------------------------- -->
  <section class="st-section" id="contact" aria-labelledby="contact-h">
    <form method="post" action="<?= h(url('settings')) ?>" class="card form" id="contact-form" data-once data-dirty-form novalidate>
      <div class="card__head"><div>
        <h2 class="card__title" id="contact-h"><?= h(t('Contact details')) ?></h2>
        <p class="card__sub"><?= h(t('How visitors reach you, as shown across the website. An empty field keeps what the website was built with (shown in grey).')) ?></p>
      </div></div>
      <div class="card__body stack">
        <?= $contactFailed ? mg_error_summary($errors) : '' ?>
        <?= csrf_field() ?><input type="hidden" name="action" value="contact">
        <?php foreach (ST_CONTACT_GROUPS as $groupTitle => $keys) { ?>
          <fieldset class="fieldset st-group">
            <legend class="section-title"><?= h(t($groupTitle)) ?></legend>
            <div class="form-row">
              <?php foreach ($keys as $k) {
                $key = 'c.' . $k;
                $built = $builtContact[$k];
                $has = array_key_exists($k, $contactOver);
                $hiddenNow = $has && $contactOver[$k] === '';
                $ownNow = $has && $contactOver[$k] !== '';
                $hideChecked = $contactFailed ? mg_posted_on(['hide', $k]) : $hiddenNow;
                $value = $contactFailed ? mg_posted(['c', $k]) : ($ownNow ? (string) $contactOver[$k] : '');
                $fid = 'c-' . $k;
                $type = $k === 'email' ? 'email' : ($k === 'phone' || $k === 'whatsapp' ? 'tel' : 'text');
                $placeholder = $built !== '' ? ($k === 'telegram' ? '@' . ltrim($built, '@') : $built) : t('e.g. {example}', ['example' => ST_CONTACT_EXAMPLES[$k]]);
                $canHide = $built !== '' || $ownNow; ?>
                <div class="field st-cfield<?= mg_cls($errors, $key) ?><?= $hideChecked ? ' is-hidden' : '' ?>" data-cfield="<?= h($k) ?>">
                  <div class="field__top">
                    <label class="field__label" for="<?= h($fid) ?>"><?= h(t(CONTACT_FIELDS[$k])) ?></label>
                    <?php if ($hiddenNow) { ?><span class="pill pill--muted pill--plain st-state"><?= h(t('Hidden')) ?></span>
                    <?php } elseif ($ownNow) { ?><span class="pill pill--gold pill--plain st-state"><?= h(t('Changed')) ?></span><?php } ?>
                  </div>
                  <input class="input" type="<?= $type ?>" id="<?= h($fid) ?>" name="c[<?= h($k) ?>]" value="<?= h($value) ?>" placeholder="<?= h($hideChecked ? t('Not shown on the website') : $placeholder) ?>"
                    autocomplete="off" spellcheck="false"<?= $type === 'email' ? ' inputmode="email" autocapitalize="none"' : '' ?><?= in_array($k, ['signal', 'instagram', 'facebook', 'telegram'], true) ? ' autocapitalize="none"' : '' ?>
                    maxlength="<?= (int) (ST_CONTACT_MAX[$k] ?? 300) ?>" data-builtin="<?= h($built) ?>"<?= $hideChecked ? ' disabled' : '' ?>
                    data-placeholder="<?= h($placeholder) ?>" data-hidden-placeholder="<?= h(t('Not shown on the website')) ?>"<?= mg_inv($errors, $key, 'help-' . $fid) ?>>
                  <p class="field__help" id="help-<?= h($fid) ?>">
                    <?= h(st_contact_hint($k)) ?>
                    <span class="st-built"><?= h($built !== ''
                      ? t('Built in: {value}', ['value' => $k === 'telegram' ? '@' . ltrim($built, '@') : $built])
                      : t('Not on the website as built — fill it in to show it.')) ?></span>
                  </p>
                  <?= mg_err($errors, $key) ?>
                  <?php if ($canHide || $has) { ?>
                    <div class="st-cfield__tools">
                      <?php if ($canHide) { ?>
                        <label class="check st-hide">
                          <input type="checkbox" name="hide[<?= h($k) ?>]" value="1"<?= $hideChecked ? ' checked' : '' ?> data-hide-toggle="#<?= h($fid) ?>">
                          <span class="check__box"><?= icon('check') ?></span>
                          <span class="check__label"><?= h(t('Don’t show on the website')) ?></span>
                        </label>
                      <?php } ?>
                      <?php if ($has) { ?>
                        <button type="submit" class="btn btn--link st-reset" form="reset-<?= h($k) ?>" data-reset-field="#<?= h($fid) ?>"
                          data-reset-note="<?= h(t('Will go back to the built-in value when you save.')) ?>"><?= icon('refresh') ?><?= h(t('Use the built-in value')) ?></button>
                      <?php } ?>
                    </div>
                  <?php } ?>
                </div>
              <?php } ?>
            </div>
          </fieldset>
        <?php } ?>
        <div class="callout callout--warn">
          <?= icon('info') ?>
          <p><?= h(t('The privacy policy and booking terms show the company name and identification code as they were when the website was built. After changing those two, ask for the website to be rebuilt so the legal pages match. Everything else changes on the website within a minute.')) ?></p>
        </div>
      </div>
      <div class="card__foot">
        <span class="st-dirty" data-dirty-text hidden><?= icon('alert') ?><?= h(t('Unsaved changes')) ?></span>
        <button type="submit" class="btn btn--primary"><?= icon('check') ?><?= h(t('Save contact details')) ?></button>
      </div>
    </form>
    <?php foreach (array_keys(CONTACT_FIELDS) as $k) if (array_key_exists($k, $contactOver)) { ?>
      <form method="post" action="<?= h(url('settings')) ?>" id="reset-<?= h($k) ?>" hidden><?= csrf_field() ?><input type="hidden" name="action" value="contact_reset"><input type="hidden" name="field" value="<?= h($k) ?>"></form>
    <?php } ?>
  </section>

  <!-- Form emails ----------------------------------------------------------------------------------------- -->
  <section class="st-section" id="emails" aria-labelledby="emails-h">
    <form method="post" action="<?= h(url('settings')) ?>" class="card form" data-once data-dirty-form novalidate>
      <div class="card__head"><div>
        <h2 class="card__title" id="emails-h"><?= h(t('Form emails')) ?></h2>
        <p class="card__sub"><?= h(t('Where requests from the website’s forms are emailed. They are always kept here under Requests too.')) ?></p>
      </div></div>
      <div class="card__body">
        <?= $errors && $form === 'emails' ? mg_error_summary($errors) : '' ?>
        <?= csrf_field() ?><input type="hidden" name="action" value="emails">
        <div class="field<?= mg_cls($errors, 'recipients') ?>">
          <label class="field__label" for="recipients"><?= h(t('Send the website’s forms to')) ?></label>
          <input class="input" type="text" id="recipients" name="recipients" value="<?= h($recipients) ?>" placeholder="<?= h($builtRecipients !== '' ? $builtRecipients : t('e.g. {example}', ['example' => 'hello@example.ge'])) ?>"
            autocomplete="off" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="1000"<?= mg_inv($errors, 'recipients', 'recipients-help') ?>>
          <p class="field__help" id="recipients-help"><?= h($builtRecipients !== ''
            ? t('Several addresses: separate them with commas. Empty = the built-in address, {email}.', ['email' => $builtRecipients])
            : t('Several addresses: separate them with commas.')) ?></p>
          <?= mg_err($errors, 'recipients') ?>
        </div>
        <label class="switch">
          <input type="checkbox" role="switch" name="notify" value="1"<?= $notify ? ' checked' : '' ?>>
          <span class="switch__track"></span>
          <span class="switch__label"><?= h(t('Email us about every new request')) ?></span>
        </label>
        <p class="field__help st-switch-help"><?= h(t('When this is off, nothing is emailed — new requests wait for you under Requests (with a count in the menu).')) ?></p>
        <div class="field<?= mg_cls($errors, 'mail_from') ?>">
          <label class="field__label" for="mail_from"><?= h(t('Send emails from')) ?> <span class="field__opt"><?= h(t('optional')) ?></span></label>
          <?php $autoFrom = mfs_mail_from_auto(); ?>
          <input class="input" type="email" id="mail_from" name="mail_from" value="<?= h($mailFrom) ?>" placeholder="<?= h($autoFrom) ?>"
            autocomplete="off" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="200"<?= mg_inv($errors, 'mail_from', 'mail_from-help') ?>>
          <p class="field__help" id="mail_from-help"><?= h(t('The sender of the website’s emails. Use an email account that exists for your domain — many hosts, Hostinger among them, won’t send from an address that doesn’t exist. Empty = {email}.', ['email' => $autoFrom])) ?></p>
          <?= mg_err($errors, 'mail_from') ?>
        </div>
        <p class="st-testnote small muted"><?= icon('send') ?><span><?= h(t('“Send a test email” writes to the saved addresses: {to}.', ['to' => implode(', ', form_recipients()) ?: t('none yet')])) ?></span></p>
        <p class="st-testnote small" data-dirty-text hidden><?= icon('alert') ?><span><?= h(t('Save first: the test email goes to the saved addresses, not to what you’ve just typed.')) ?></span></p>
      </div>
      <div class="card__foot card__foot--between">
        <button type="submit" class="btn btn--secondary" form="test-email-form" data-clean-only><?= icon('send') ?><?= h(t('Send a test email')) ?></button>
        <span class="st-foot-end">
          <span class="st-dirty" data-dirty-text hidden><?= icon('alert') ?><?= h(t('Unsaved changes')) ?></span>
          <button type="submit" class="btn btn--primary"><?= icon('check') ?><?= h(t('Save')) ?></button>
        </span>
      </div>
    </form>
    <form method="post" action="<?= h(url('settings')) ?>" id="test-email-form" hidden><?= csrf_field() ?><input type="hidden" name="action" value="test_email"></form>
  </section>

  <!-- Website notice -------------------------------------------------------------------------------------- -->
  <section class="st-section" id="notice" aria-labelledby="notice-h">
    <form method="post" action="<?= h(url('settings')) ?>" class="card form" data-once data-dirty-form novalidate data-notice-form>
      <div class="card__head"><div>
        <h2 class="card__title" id="notice-h"><?= h(t('Website notice')) ?></h2>
        <p class="card__sub"><?= h(t('A short message in a slim bar at the top of every page — for holidays, slower replies or news. Visitors can close it.')) ?></p>
      </div></div>
      <div class="card__body">
        <?= $errors && $form === 'notice' ? mg_error_summary($errors) : '' ?>
        <?= csrf_field() ?><input type="hidden" name="action" value="notice">
        <label class="switch">
          <input type="checkbox" role="switch" name="notice_on" value="1"<?= $noticeOn ? ' checked' : '' ?> data-notice-on>
          <span class="switch__track"></span>
          <span class="switch__label"><?= h(t('Show the notice on the website')) ?></span>
        </label>
        <?php $enKey = 'notice.en'; ?>
        <div class="field<?= mg_cls($errors, $enKey) ?>">
          <label class="field__label" for="notice-en"><?= h(t('Notice in English')) ?> <span class="field__opt"><?= h(t('needed when the notice is on')) ?></span></label>
          <input class="input" type="text" id="notice-en" name="notice[en]" lang="en" value="<?= h($sent(['notice', 'notice', 'en'], (string) ($noticeText['en'] ?? ''))) ?>"
            placeholder="<?= h(t('e.g. {example}', ['example' => 'We’re on holiday 1–10 January; replies may be a little slower.'])) ?>" maxlength="<?= ST_NOTICE_MAX + 40 ?>" data-maxchars="<?= ST_NOTICE_MAX ?>" data-notice-text="en"<?= mg_inv($errors, $enKey, 'notice-en-help') ?>>
          <p class="field__help" id="notice-en-help"><?= h(t('One or two short sentences, at most {n} characters.', ['n' => ST_NOTICE_MAX])) ?></p>
          <?= mg_err($errors, $enKey) ?>
        </div>
        <details class="disclosure st-langs"<?= $noticeOther ? ' open' : '' ?>>
          <summary><span><?= h(t('Other languages')) ?> <span class="field__opt"><?= h(t('optional — empty ones show the English text')) ?></span></span></summary>
          <div class="disclosure__body">
            <div class="form-row">
              <?php foreach ($langs as $code => $name) { if ($code === 'en') continue; $key = 'notice.' . $code; ?>
                <div class="field<?= mg_cls($errors, $key) ?>">
                  <label class="field__label" for="notice-<?= h($code) ?>"><span lang="<?= h($code) ?>"><?= h($name) ?></span></label>
                  <input class="input" type="text" id="notice-<?= h($code) ?>" name="notice[<?= h($code) ?>]" lang="<?= h($code) ?>" maxlength="<?= ST_NOTICE_MAX + 40 ?>" data-maxchars="<?= ST_NOTICE_MAX ?>"
                    value="<?= h($sent(['notice', 'notice', $code], (string) ($noticeText[$code] ?? ''))) ?>"<?= mg_inv($errors, $key) ?>>
                  <?= mg_err($errors, $key) ?>
                </div>
              <?php } ?>
            </div>
          </div>
        </details>
        <div class="st-preview" aria-hidden="true">
          <p class="st-preview__label"><?= h(t('Preview')) ?></p>
          <div class="st-preview__bar<?= $noticeOn ? '' : ' is-off' ?>" data-notice-preview>
            <span class="st-preview__text" data-notice-preview-text data-empty="<?= h(t('Your notice will appear here.')) ?>"><?= h(($sent(['notice', 'notice', 'en'], (string) ($noticeText['en'] ?? ''))) ?: t('Your notice will appear here.')) ?></span>
            <span class="st-preview__x"><?= icon('close') ?></span>
          </div>
          <p class="st-preview__off small muted" data-notice-off-note<?= $noticeOn ? ' hidden' : '' ?>><?= h(t('Switched off: the website doesn’t show it. The text is kept for next time.')) ?></p>
        </div>
      </div>
      <div class="card__foot">
        <span class="st-dirty" data-dirty-text hidden><?= icon('alert') ?><?= h(t('Unsaved changes')) ?></span>
        <button type="submit" class="btn btn--primary"><?= icon('check') ?><?= h(t('Save notice')) ?></button>
      </div>
    </form>
  </section>

  <!-- Statistics & data ----------------------------------------------------------------------------------- -->
  <section class="st-section" id="data" aria-labelledby="data-h">
    <form method="post" action="<?= h(url('settings')) ?>" class="card form" data-once data-dirty-form novalidate>
      <div class="card__head"><div>
        <h2 class="card__title" id="data-h"><?= h(t('Statistics & data')) ?></h2>
        <p class="card__sub"><?= h(t('Visit counting, and how long old requests are kept.')) ?></p>
      </div></div>
      <div class="card__body">
        <?= $errors && $form === 'data' ? mg_error_summary($errors) : '' ?>
        <?= csrf_field() ?><input type="hidden" name="action" value="data">
        <div>
          <label class="switch">
            <input type="checkbox" role="switch" name="analytics" value="1"<?= $analytics ? ' checked' : '' ?>>
            <span class="switch__track"></span>
            <span class="switch__label"><?= h(t('Count visits to the website')) ?></span>
          </label>
          <p class="field__help st-switch-help"><?= h(t('Anonymous counts for Statistics: no cookies, no IP addresses stored, and visitors who ask not to be tracked are skipped. Switching it off stops counting; the numbers so far stay.')) ?></p>
        </div>
        <div class="form-row">
          <div class="field<?= mg_cls($errors, 'retention_months') ?>">
            <label class="field__label" for="retention_months"><?= h(t('Keep requests without a booking for')) ?></label>
            <div class="input-group st-num">
              <input class="input" type="number" id="retention_months" name="retention_months" value="<?= h($months) ?>" min="0" max="<?= ST_RETENTION_MONTHS[1] ?>" step="1" inputmode="numeric"<?= mg_inv($errors, 'retention_months', 'rm-help') ?>>
              <span class="input-group__addon"><?= h(t('months')) ?></span>
            </div>
            <p class="field__help" id="rm-help"><?= h(t('Counted from the last change. Requests that became a booking are always kept. 0 = keep for ever.')) ?></p>
            <?= mg_err($errors, 'retention_months') ?>
          </div>
          <div class="field<?= mg_cls($errors, 'spam_days') ?>">
            <label class="field__label" for="spam_days"><?= h(t('Keep spam for')) ?></label>
            <div class="input-group st-num">
              <input class="input" type="number" id="spam_days" name="spam_days" value="<?= h($spamDays) ?>" min="0" max="<?= ST_SPAM_DAYS[1] ?>" step="1" inputmode="numeric"<?= mg_inv($errors, 'spam_days', 'sd-help') ?>>
              <span class="input-group__addon"><?= h(t('days')) ?></span>
            </div>
            <p class="field__help" id="sd-help"><?= h(t('Messages marked as spam are deleted after this. 0 = keep for ever.')) ?></p>
            <?= mg_err($errors, 'spam_days') ?>
          </div>
        </div>
      </div>
      <div class="card__foot">
        <span class="st-dirty" data-dirty-text hidden><?= icon('alert') ?><?= h(t('Unsaved changes')) ?></span>
        <button type="submit" class="btn btn--primary"><?= icon('check') ?><?= h(t('Save')) ?></button>
      </div>
    </form>
  </section>

  <!-- Backups & downloads (danger zone) -------------------------------------------------------------------- -->
  <section class="st-section" id="backup" aria-labelledby="backup-h">
    <div class="danger-zone">
      <h2 class="danger-zone__title" id="backup-h"><?= icon('shield') ?><?= h(t('Backups & downloads')) ?></h2>
      <p class="danger-zone__text"><?= h(t('These files hold your clients’ names, emails and phone numbers. Keep them somewhere private, and delete copies you no longer need.')) ?></p>
      <div class="danger-zone__row">
        <div class="st-dz__text">
          <p class="strong"><?= h(t('Database backup')) ?></p>
          <p class="small muted"><?= h(t('Everything in the team area — requests, bookings, payments, notes, the team and settings — in one file ({size}).', ['size' => mg_size($dbSize)])) ?>
            <?= $lastBackup ? h(t('Last downloaded {when} by {who}.', ['when' => fmt_ago($lastBackup['at']), 'who' => mg_user_name($lastBackup['user_id']) ?: t('a former team member')])) : h(t('Not downloaded yet.')) ?></p>
        </div>
        <form method="post" action="<?= h(url('settings')) ?>" class="st-dz__action">
          <?= csrf_field() ?><input type="hidden" name="action" value="backup">
          <button type="submit" class="btn btn--secondary btn--sm"><?= icon('download') ?><?= h(t('Download backup')) ?></button>
        </form>
      </div>
      <div class="danger-zone__row">
        <div class="st-dz__text">
          <p class="strong"><?= h(t('Spreadsheets (CSV)')) ?></p>
          <p class="small muted"><?= h(t('Requests, bookings and payments as files for Excel, Numbers or Google Sheets.')) ?></p>
          <p class="st-dz__quick small">
            <?php foreach (['requests' => [t('Requests'), $csvCounts['requests']], 'bookings' => [t('Bookings'), $csvCounts['bookings']], 'payments' => [t('Payments'), $csvCounts['payments']]] as $type => $info) { ?>
              <?php if ($info[1] > 0) { ?><a href="<?= h(url('export', ['type' => $type])) ?>"><?= icon('download') ?><?= h($info[0]) ?> <span class="muted">(<?= h(number_format($info[1])) ?>)</span></a>
              <?php } else { ?><span class="muted"><?= h($info[0]) ?> (0)</span><?php } ?>
            <?php } ?>
          </p>
        </div>
        <a class="btn btn--secondary btn--sm st-dz__action" href="<?= h(url('export')) ?>"><?= icon('download') ?><?= h(t('Open the export page')) ?></a>
      </div>
    </div>

    <div class="card card--muted st-maint">
      <div class="st-maint__row">
        <div class="st-dz__text">
          <p class="strong"><?= h(t('Website update')) ?></p>
          <p class="small muted"><?= h($live['exists']
            ? t('The website shows the prices, contact details and notice you set here. Last sent to the website {when}.', ['when' => fmt_ago($live['updated'])])
            : t('Nothing sent yet — the website shows everything as it was built. Your changes go to the website the first time you save one here.')) ?></p>
        </div>
        <form method="post" action="<?= h(url('settings')) ?>" class="st-dz__action" data-once>
          <?= csrf_field() ?><input type="hidden" name="action" value="publish">
          <button type="submit" class="btn btn--secondary btn--sm"><?= icon('refresh') ?><?= h(t('Send the latest changes to the website again')) ?></button>
        </form>
      </div>
      <div class="st-maint__row">
        <div class="st-dz__text">
          <p class="strong"><?= h(t('Activity log')) ?></p>
          <p class="small muted"><?= h(t('Who changed what, and when — sign-ins, prices, bookings, settings and more.')) ?></p>
        </div>
        <a class="btn btn--secondary btn--sm st-dz__action" href="<?= h(url('activity')) ?>"><?= icon('history') ?><?= h(t('Open the activity log')) ?></a>
      </div>
    </div>
  </section>
  </div>
</div>
<?php
render(t('Settings'), ob_get_clean(), [
  'nav' => 'settings',
  'css' => ['manage.css'],
  'js' => ['manage.js'],
  'lead' => t('Contact details, form emails, the website notice, statistics and backups.'),
  'actions' => '<a class="btn btn--secondary" href="' . h(url('activity')) . '">' . icon('history') . h(t('Activity log')) . '</a>'
    . '<a class="btn btn--secondary" href="' . h(url('export')) . '">' . icon('download') . h(t('Export')) . '</a>',
  'status' => $errors ? 422 : 200,
]);
