<?php
/*
 * The website's catalogue (tours, travel styles, built-in contact details — written by the build into
 * lib/catalog.json), the owners' overrides on top of it, and api/live.json for the public site.
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

/** Contact fields the website shows, in the order of the settings page (keys as in api/live.json). */
const CONTACT_FIELDS = [
  'email' => 'Email',
  'phone' => 'Phone',
  'whatsapp' => 'WhatsApp number',
  'telegram' => 'Telegram username',
  'signal' => 'Signal link',
  'instagram' => 'Instagram',
  'facebook' => 'Facebook',
  'address' => 'Address',
  'officeHours' => 'Office hours',
  'legalName' => 'Company name',
  'registrationNumber' => 'Identification code',
];

/** The decoded lib/catalog.json (cached). Missing file → an empty but well-formed catalogue. */
function catalog(): array
{
  static $cat = null;
  if ($cat !== null) return $cat;
  $raw = @file_get_contents(MFS_LIB . '/catalog.json');
  $d = $raw !== false ? json_decode($raw, true) : null;
  if (!is_array($d)) $d = [];
  $d += ['brand' => 'Million First Steps', 'languages' => [['code' => 'en', 'name' => 'English']], 'tiers' => [], 'tours' => [], 'partyFactors' => [], 'contact' => []];
  if (!$d['tiers']) {
    $d['tiers'] = [['id' => 'wanderer', 'name' => 'Wanderer'], ['id' => 'explorer', 'name' => 'Explorer'], ['id' => 'golden-fleece', 'name' => 'Golden Fleece']];
  }
  if (!$d['partyFactors']) $d['partyFactors'] = ['1' => 1.65, '2' => 1, '3' => 0.93, '4' => 0.87, '5' => 0.84, '6' => 0.82, '7' => 0.8, '8' => 0.79];
  return $cat = $d;
}

/** Tier ids => names, in website order: ['wanderer' => 'Wanderer', …]. */
function tiers(): array
{
  $out = [];
  foreach (catalog()['tiers'] as $t) $out[(string) $t['id']] = (string) $t['name'];
  return $out;
}

/**
 * The catalogue's tours keyed by id, in website order, each:
 * ['id', 'name', 'days', 'styles', 'prices' => effective {tier: €}, 'built_in_prices' => {tier: €},
 *  'price_overridden' => bool, 'hidden' => bool]
 */
function tours(): array
{
  $over = setting('tour_prices');
  $hidden = setting('tours_hidden');
  $hidden = is_array($hidden) ? array_map('strval', $hidden) : [];
  $out = [];
  foreach (catalog()['tours'] as $t) {
    $id = (string) $t['id'];
    $base = is_array($t['prices'] ?? null) ? $t['prices'] : [];
    $prices = [];
    $changed = false;
    foreach (array_keys(tiers()) as $tier) {
      $b = isset($base[$tier]) ? (float) $base[$tier] : 0.0;
      $o = is_array($over) && isset($over[$id][$tier]) && is_numeric($over[$id][$tier]) && (float) $over[$id][$tier] > 0 ? (float) $over[$id][$tier] : null;
      $prices[$tier] = $o !== null ? $o : $b;
      if ($o !== null && $o != $b) $changed = true;
    }
    $out[$id] = [
      'id' => $id,
      'name' => (string) $t['name'],
      'days' => (int) ($t['days'] ?? 0),
      'styles' => is_array($t['styles'] ?? null) ? $t['styles'] : [],
      'prices' => $prices,
      'built_in_prices' => $base,
      'price_overridden' => $changed,
      'hidden' => in_array($id, $hidden, true),
    ];
  }
  return $out;
}

/** A catalogue tour's or travel style's name as the website shows it in the interface language (else English). */
function mfs_local_name(array $item): string
{
  $lang = mfs_lang();
  $names = is_array($item['names'] ?? null) ? $item['names'] : [];
  if ($lang !== 'en' && isset($names[$lang]) && is_string($names[$lang]) && $names[$lang] !== '') return $names[$lang];
  return (string) ($item['name'] ?? '');
}

/** Every name of a catalogue tour or travel style: English first, then the website's other languages. */
function mfs_all_names(array $item): array
{
  $out = [(string) ($item['name'] ?? '')];
  foreach ((array) ($item['names'] ?? []) as $n) if (is_string($n) && $n !== '') $out[] = $n;
  return array_values(array_unique(array_filter($out, 'strlen')));
}

/** A tour's name from the catalogue, in the interface language ('' for empty, the id itself for an unknown/removed tour). */
function tour_name($id): string
{
  $id = (string) $id;
  if ($id === '') return '';
  foreach (catalog()['tours'] as $t) if ((string) $t['id'] === $id) return mfs_local_name($t);
  return $id;
}

/** A travel style's name in the interface language ('Explorer', 'მკვლევარი'); unknown ids come back as given. */
function tier_name($id): string
{
  $id = (string) $id;
  foreach (catalog()['tiers'] as $t) if ((string) $t['id'] === $id) return mfs_local_name($t);
  return $id;
}

/** Lower case, straight apostrophes, single spaces — for finding names in what visitors sent. */
function mfs_name_key(string $s): string
{
  $s = str_replace(['’', '‘', 'ʼ', "\u{00A0}"], ["'", "'", "'", ' '], $s);
  $s = (string) preg_replace('/\s+/u', ' ', trim($s));
  return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
}

/**
 * The catalogue tour named in free text (e.g. "The Cradle of Wine (Explorer)" from a tour page's link, in any of
 * the website's languages); '' when none.
 */
function mfs_find_tour(string $text): string
{
  $hay = mfs_name_key($text);
  if ($hay === '') return '';
  foreach (catalog()['tours'] as $t) {
    foreach (mfs_all_names($t) as $name) {
      $name = mfs_name_key($name);
      $short = (string) preg_replace('/^the\s+/u', '', $name);
      if ($name !== '' && (strpos($hay, $name) !== false || ($short !== '' && strpos($hay, $short) !== false))) return (string) $t['id'];
    }
  }
  return '';
}

/** The travel style named in free text, in any of the website's languages ('' when none). A name in brackets wins. */
function mfs_find_tier(string $text): string
{
  $hay = mfs_name_key($text);
  if ($hay === '') return '';
  if (preg_match_all('/\(([^()]{2,60})\)/u', $hay, $m)) {
    foreach ($m[1] as $inner) {
      foreach (catalog()['tiers'] as $t) foreach (mfs_all_names($t) as $name) if (mfs_name_key($name) === trim($inner)) return (string) $t['id'];
    }
  }
  foreach (catalog()['tiers'] as $t) {
    foreach (mfs_all_names($t) as $name) {
      $name = mfs_name_key($name);
      if ($name !== '' && strpos($hay, $name) !== false) return (string) $t['id'];
    }
  }
  return '';
}

/** Party-size price factors {"1".."8": factor}: the owners' overrides on top of the built-in ones. */
function party_factors(): array
{
  $base = catalog()['partyFactors'];
  $over = setting('party_factors');
  $out = [];
  for ($i = 1; $i <= 8; $i++) {
    $k = (string) $i;
    $b = isset($base[$k]) ? (float) $base[$k] : 1.0;
    $out[$k] = is_array($over) && isset($over[$k]) && is_numeric($over[$k]) && (float) $over[$k] > 0 ? (float) $over[$k] : $b;
  }
  return $out;
}

/**
 * The website-style price suggestion for a party: per-person price × party factor × travellers
 * (children count as travellers; parties above 8 use the factor for 8). Rounded to whole euros.
 */
function suggest_price(string $tourId, string $tier, int $travellers): float
{
  $tours = tours();
  if (!isset($tours[$tourId]['prices'][$tier]) || $travellers < 1) return 0.0;
  $f = party_factors();
  $factor = $f[(string) min(8, $travellers)] ?? 1.0;
  // Same as the website calculator (tour.js): the price per person is rounded to €10, then × travellers.
  return round($tours[$tourId]['prices'][$tier] * $factor / 10) * 10 * $travellers;
}

/** Contact details as the website shows them now: built-in (catalog) values with the owners' overrides on top. */
function effective_contact(): array
{
  $base = catalog()['contact'];
  $over = setting('contact');
  $out = [];
  foreach (array_keys(CONTACT_FIELDS) as $k) {
    $out[$k] = is_array($over) && array_key_exists($k, $over) ? trim((string) $over[$k]) : trim((string) ($base[$k] ?? ''));
  }
  return $out;
}

/** The public link for a messaging channel value (same formula as the website build). '' stays ''. */
function contact_channel_url(string $key, string $value): string
{
  $v = trim($value);
  if ($v === '') return '';
  if ($key === 'whatsapp') {
    if (preg_match('~^https?://~i', $v)) return $v;
    $d = preg_replace('/\D+/', '', $v);
    return $d !== '' ? 'https://wa.me/' . $d : '';
  }
  if ($key === 'telegram') return preg_match('~^https?://~i', $v) ? $v : 'https://t.me/' . ltrim($v, '@');
  return $v;
}

/** Who gets the website's form emails: the form_recipients setting, else the built-in address(es). */
function form_recipients(string $builtIn = ''): array
{
  $list = mfs_parse_emails((string) setting('form_recipients', ''));
  if ($list) return $list;
  if ($builtIn === '') {
    $c = catalog()['contact'];
    $builtIn = (string) (($c['formTo'] ?? '') !== '' ? $c['formTo'] : ($c['email'] ?? ''));
  }
  return mfs_parse_emails($builtIn);
}

/** Splits "a@x.ge, b@y.ge" into valid, unique addresses (max 10). */
function mfs_parse_emails(string $s): array
{
  $out = [];
  foreach (preg_split('/[\s,;]+/', $s) ?: [] as $e) {
    $v = valid_email($e);
    if ($v !== '') $out[strtolower($v)] = $v;
  }
  return array_slice(array_values($out), 0, 10);
}

/** The data for api/live.json (see the spec §2): only what the owners changed. */
function live_json_data(): array
{
  $cat = catalog();
  $live = [];

  $over = setting('contact');
  if (is_array($over)) {
    $c = [];
    foreach (array_keys(CONTACT_FIELDS) as $k) {
      if (!array_key_exists($k, $over)) continue;
      $v = trim((string) $over[$k]);
      $c[$k] = in_array($k, ['whatsapp', 'telegram'], true) ? contact_channel_url($k, $v) : $v;
    }
    if ($c) $live['contact'] = $c;
  }

  $prices = [];
  foreach (tours() as $id => $t) {
    if (!$t['price_overridden']) continue;
    $p = [];
    foreach ($t['prices'] as $tier => $v) $p[$tier] = (floor($v) == $v) ? (int) $v : round($v, 2);
    $prices[$id] = $p;
  }
  if ($prices) $live['prices'] = $prices;

  $known = array_map(function ($t) { return (string) $t['id']; }, $cat['tours']);
  $hidden = setting('tours_hidden');
  $hidden = is_array($hidden) ? array_values(array_intersect($known, array_map('strval', $hidden))) : [];
  if ($hidden) $live['hidden'] = $hidden;

  $pf = setting('party_factors');
  if (is_array($pf) && $pf) {
    $f = [];
    foreach (party_factors() as $k => $v) $f[$k] = (floor($v) == $v) ? (int) $v : $v;
    $live['partyFactors'] = $f;
  }

  $notice = setting('notice');
  if (is_array($notice) && !empty($notice['enabled']) && is_array($notice['text'] ?? null)) {
    $texts = [];
    foreach ($notice['text'] as $lang => $txt) {
      $txt = trim((string) $txt);
      if ($txt !== '' && preg_match('/^[a-z]{2}$/', (string) $lang)) $texts[(string) $lang] = $txt;
    }
    if (isset($texts['en'])) $live['notice'] = ['en' => $texts['en']] + $texts;
  }

  $rev = substr(sha1((string) json_encode($live)), 0, 8);
  return ['rev' => $rev] + $live;
}

/**
 * Rewrites <site root>/api/live.json from the settings (atomically: temp file + rename).
 * Call after saving any of: contact, tour_prices, tours_hidden, party_factors, notice. Returns false on failure.
 */
function write_live_json(): bool
{
  try {
    $json = json_encode(live_json_data(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) return false;
    $dir = MFS_SITE_ROOT . '/api';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) return false;
    $tmp = $dir . '/.live-' . bin2hex(random_bytes(6)) . '.tmp';
    if (@file_put_contents($tmp, $json . "\n", LOCK_EX) === false) return false;
    @chmod($tmp, 0644);
    if (!@rename($tmp, $dir . '/live.json')) {
      @unlink($tmp);
      return false;
    }
    return true;
  } catch (Throwable $e) {
    error_log('[mfs-admin] write_live_json: ' . $e->getMessage());
    return false;
  }
}
