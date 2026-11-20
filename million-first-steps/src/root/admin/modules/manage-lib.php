<?php
/*
 * Shared helpers for the owners' "Manage" pages: tours.php (Tours & prices), settings.php, users.php (Team) and
 * activity.php. Loaded with require_once by those modules (modules/ is closed to the web by its .htaccess).
 *
 *   mg_posted(['price', $tourId, $tier])   one value from a nested POST array (price[tour][tier]) as clean,
 *                                          single-line text ('' when missing or not text)
 *   mg_err($errors, $key) / mg_inv(...) / mg_cls(...)   field error text, aria attributes, .has-error class
 *   mg_error_summary($errors)              the "Please check the highlighted fields" box above a form
 *   mg_parse_euros($raw, &$why)            whole-euro price typed by a person → int | null (empty) | false
 *   mg_parse_factor($raw, &$why)           party-size factor ("0.93", "0,93") → float | null | false
 *   mg_publish()                           write_live_json(); on failure flashes a calm explanation
 *   mg_live_json_info()                    ['exists' => bool, 'updated' => UTC time|'', 'path' => …]
 *   mg_suggest_password()                  a readable random temporary password (14 characters)
 *   mg_user_name($id)                      a team member's name (cached), '' if unknown
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

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

/** aria-invalid + aria-describedby for a field with an error (or ''). */
function mg_inv(array $errors, string $key): string
{
  return isset($errors[$key]) ? ' aria-invalid="true" aria-describedby="err-' . h(mg_id($key)) . '"' : '';
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
  return '<div class="flash flash--error mg-summary" role="alert"><span class="flash__icon">' . icon('alert') . '</span><p class="flash__text">' . h($msg) . '</p></div>';
}

/**
 * A whole-euro price typed by a person: "1290", "1,290", "1.290", "€ 1 290" → 1290.
 * Returns null for an empty value, false when it isn't a usable price ($why says why, translated).
 */
function mg_parse_euros(string $raw, ?string &$why = null, int $min = 1, int $max = 1000000)
{
  $why = '';
  $s = trim(str_replace(['€', 'EUR', 'eur', ' ', "\xC2\xA0", "\xE2\x80\xAF", "'", '’'], '', $raw));
  if ($s === '') return null;
  if (preg_match('/^\d{1,3}([,.])\d{3}(\1\d{3})*$/', $s)) {
    $n = (int) preg_replace('/\D/', '', $s);
  } elseif (preg_match('/^\d{1,7}$/', $s)) {
    $n = (int) $s;
  } elseif (preg_match('/^\d+[.,]\d{1,2}$/', $s)) {
    $why = t('Please use whole euros, without cents.');
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
