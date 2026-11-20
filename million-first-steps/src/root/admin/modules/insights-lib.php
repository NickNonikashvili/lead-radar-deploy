<?php
/*
 * Shared by the Dashboard (modules/dashboard.php) and Statistics (modules/analytics.php) pages: date windows,
 * number formatting, friendly names for counted pages / referrers / languages, and the server-drawn charts.
 * Not a page itself: index.php only runs the files it lists, and modules/ is closed to the web.
 *
 *   ins_utc_day($offset = 0)            'Y-m-d' UTC day, $offset days from today (the stats_* tables use UTC days)
 *   ins_window($days, $back = 0)        [first, last] UTC days of the last $days days; $back = 1 → the $days before
 *   ins_utc_bounds($first, $last)       [from, to) UTC 'Y-m-d H:i:s' for comparing created_at with a window of days
 *   ins_local_midnight_utc($ymd)        UTC time of midnight in Tbilisi on a local date
 *   ins_num($n, $dec = 0) · ins_compact($n) · ins_share($part, $whole) · ins_rate($requests, $visitors)
 *   ins_trend($cur, $prev, $vsText)     KPI meta: "▲ 12%" pill + "vs previous 30 days"
 *   ins_month_short/long($m) · ins_weekday_short/long($n) · ins_day_label($ymd) · ins_long_date($ymd)
 *   ins_page_info($path)                counted page → ['name', 'lang', 'label', 'href', 'base'] (friendly name)
 *   ins_ref_info($host)                 referrer host → ['name', 'key'] ('google.de' → Google)
 *   ins_lang_name($code)                'ru' → 'Russian · Русский'
 *   ins_column_chart($opts)             columns / stacked columns / a line as inline SVG + HTML axis labels + table
 *   ins_bar_list($rows, $opts)          horizontal bars (.bars) with value and share
 *
 * Charts: the SVG is drawn in a 10-units-per-slot × 100 box and stretched to the card (preserveAspectRatio
 * none, strokes don't scale), so it always fits; the axis labels are HTML so they stay readable on phones.
 * charts.css styles them, charts.js adds hover/tap tooltips (without it, each slot still has an SVG <title>
 * and every chart has its numbers in a "Show as table" <details>).
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
if (defined('MFS_INSIGHTS_LIB')) return;
define('MFS_INSIGHTS_LIB', 1);

/** Website language codes → English names (translated with t()); native names come from the catalogue. */
const INS_LANG_NAMES = [
  'en' => 'English', 'ru' => 'Russian', 'ka' => 'Georgian', 'es' => 'Spanish', 'fr' => 'French',
  'it' => 'Italian', 'pt' => 'Portuguese', 'de' => 'German', 'zh' => 'Chinese',
];

/** The website's fixed pages (path without the language prefix) → English name. Tours and articles are added. */
const INS_PAGE_NAMES = [
  '/' => 'Home',
  '/tours/' => 'Tours',
  '/about' => 'About us',
  '/contact' => 'Contact',
  '/discover-georgia' => 'Discover Georgia',
  '/guide/' => 'Travel guide',
  '/partners' => 'Travel partners',
  '/privacy' => 'Privacy policy',
  '/terms' => 'Booking terms',
  '/cookies' => 'Cookies',
  '/credits' => 'Photo credits',
  '/404' => 'Page not found (error page)',
];

/** Referrer hosts → a name owners recognise. Pattern on the host (without www.); first match wins. */
const INS_REF_NAMES = [
  ['~(^|\.)gemini\.google\.com$~', 'Gemini'],
  ['~(^|\.)mail\.google\.com$~', 'Gmail'],
  ['~(^|\.)google(\.com?)?\.[a-z]{2,3}$|(^|\.)google\.com$~', 'Google'],
  ['~(^|\.)bing\.com$~', 'Bing'],
  ['~(^|\.)duckduckgo\.com$~', 'DuckDuckGo'],
  ['~(^|\.)yandex\.[a-z.]{2,6}$|(^|\.)ya\.ru$~', 'Yandex'],
  ['~(^|\.)yahoo\.[a-z.]{2,6}$~', 'Yahoo'],
  ['~(^|\.)baidu\.com$~', 'Baidu'],
  ['~(^|\.)ecosia\.org$~', 'Ecosia'],
  ['~(^|\.)search\.brave\.com$~', 'Brave Search'],
  ['~(^|\.)(chatgpt\.com|chat\.openai\.com)$~', 'ChatGPT'],
  ['~(^|\.)perplexity\.ai$~', 'Perplexity'],
  ['~(^|\.)copilot\.microsoft\.com$~', 'Copilot'],
  ['~(^|\.)claude\.ai$~', 'Claude'],
  ['~(^|\.)(facebook\.com|fb\.com|fb\.me)$~', 'Facebook'],
  ['~(^|\.)instagram\.com$~', 'Instagram'],
  ['~(^|\.)(t\.co|x\.com|twitter\.com)$~', 'X (Twitter)'],
  ['~(^|\.)(linkedin\.com|lnkd\.in)$~', 'LinkedIn'],
  ['~(^|\.)(youtube\.com|youtu\.be)$~', 'YouTube'],
  ['~(^|\.)tiktok\.com$~', 'TikTok'],
  ['~(^|\.)pinterest\.[a-z.]{2,6}$~', 'Pinterest'],
  ['~(^|\.)reddit\.com$~', 'Reddit'],
  ['~(^|\.)(vk\.com|vk\.ru)$~', 'VK'],
  ['~(^|\.)ok\.ru$~', 'Odnoklassniki'],
  ['~(^|\.)(t\.me|telegram\.org|web\.telegram\.org)$~', 'Telegram'],
  ['~(^|\.)(wa\.me|whatsapp\.com)$~', 'WhatsApp'],
  ['~(^|\.)tripadvisor\.[a-z.]{2,6}$~', 'Tripadvisor'],
  ['~(^|\.)booking\.com$~', 'Booking.com'],
  ['~(^|\.)getyourguide\.[a-z.]{2,6}$~', 'GetYourGuide'],
  ['~(^|\.)viator\.com$~', 'Viator'],
];

// ── Days and windows ────────────────────────────────────────────────────────

/** A UTC day 'Y-m-d', $offset days from today (negative = in the past). */
function ins_utc_day(int $offset = 0): string
{
  return gmdate('Y-m-d', strtotime(gmdate('Y-m-d') . ' 00:00:00 UTC') + $offset * 86400 + 43200);
}

/**
 * The last $days UTC days ending today: [first, last]. $back = 1 gives the $days days before those
 * (for "vs previous 30 days"), $back = 2 the ones before that …
 */
function ins_window(int $days, int $back = 0): array
{
  $last = -$back * $days;
  return [ins_utc_day($last - $days + 1), ins_utc_day($last)];
}

/** The UTC days from $first to $last, oldest first. */
function ins_days_list(string $first, string $last): array
{
  $out = [];
  $t = strtotime($first . ' 12:00:00 UTC');
  $end = strtotime($last . ' 12:00:00 UTC');
  for ($i = 0; $t <= $end && $i < 4000; $i++, $t += 86400) $out[] = gmdate('Y-m-d', $t);
  return $out;
}

/** [from, to) bounds for UTC 'Y-m-d H:i:s' columns (created_at) covering the UTC days $first…$last. */
function ins_utc_bounds(string $first, string $last): array
{
  return [$first . ' 00:00:00', gmdate('Y-m-d', strtotime($last . ' 12:00:00 UTC') + 86400) . ' 00:00:00'];
}

/** The UTC 'Y-m-d H:i:s' of midnight in Tbilisi at the start of a local date 'Y-m-d'. */
function ins_local_midnight_utc(string $ymd): string
{
  $d = DateTime::createFromFormat('!Y-m-d', $ymd, mfs_tz());
  if (!$d) return $ymd . ' 00:00:00';
  $d->setTimezone(new DateTimeZone('UTC'));
  return $d->format('Y-m-d H:i:s');
}

/** A local date 'Y-m-d' shifted by $n days. */
function ins_local_add_days(string $ymd, int $n): string
{
  $d = DateTime::createFromFormat('!Y-m-d', $ymd, mfs_tz());
  if (!$d) return $ymd;
  if ($n !== 0) $d->modify(($n > 0 ? '+' : '') . $n . ' days');
  return $d->format('Y-m-d');
}

/** The Tbilisi date of a UTC 'Y-m-d H:i:s' ('' if invalid). */
function ins_local_date_of($utc): string
{
  $d = utc_to_local($utc);
  return $d ? $d->format('Y-m-d') : '';
}

// ── Names of months and days (translated) ───────────────────────────────────

function ins_month_short(int $m): string
{
  $n = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return t($n[max(1, min(12, $m)) - 1]);
}

function ins_month_long(int $m): string
{
  $n = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return t($n[max(1, min(12, $m)) - 1]);
}

/** 1 = Monday … 7 = Sunday. */
function ins_weekday_short(int $n): string
{
  $d = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return t($d[max(1, min(7, $n)) - 1]);
}

function ins_weekday_long(int $n): string
{
  $d = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return t($d[max(1, min(7, $n)) - 1]);
}

/** '2026-11-02' → '2 Nov' (+ year when $year). */
function ins_day_label(string $ymd, bool $year = false): string
{
  $d = DateTime::createFromFormat('!Y-m-d', $ymd, new DateTimeZone('UTC'));
  if (!$d) return $ymd;
  return $d->format('j') . ' ' . ins_month_short((int) $d->format('n')) . ($year ? ' ' . $d->format('Y') : '');
}

/** '2026-11-20' → 'Fri 20 Nov'. */
function ins_weekday_day_label(string $ymd): string
{
  $d = DateTime::createFromFormat('!Y-m-d', $ymd, new DateTimeZone('UTC'));
  if (!$d) return $ymd;
  return ins_weekday_short((int) $d->format('N')) . ' ' . $d->format('j') . ' ' . ins_month_short((int) $d->format('n'));
}

/** '2026-11-20' → 'Friday, 20 November 2026'. */
function ins_long_date(string $ymd): string
{
  $d = DateTime::createFromFormat('!Y-m-d', $ymd, new DateTimeZone('UTC'));
  if (!$d) return $ymd;
  return t('{weekday}, {day} {month} {year}', [
    'weekday' => ins_weekday_long((int) $d->format('N')), 'day' => $d->format('j'),
    'month' => ins_month_long((int) $d->format('n')), 'year' => $d->format('Y'),
  ]);
}

/** "22 Oct – 20 Nov 2026" for a window of days. */
function ins_range_label(string $first, string $last): string
{
  if ($first === $last) return ins_day_label($last, true);
  $sameYear = substr($first, 0, 4) === substr($last, 0, 4);
  return ins_day_label($first, !$sameYear) . ' – ' . ins_day_label($last, true);
}

// ── Numbers ─────────────────────────────────────────────────────────────────

function ins_num($n, int $dec = 0): string
{
  return number_format((float) $n, $dec, '.', ',');
}

/** Short numbers for chart axes: 950 → '950', 12500 → '12.5k', 250000 → '250k'. */
function ins_compact($n): string
{
  $n = (float) $n;
  if (abs($n) < 10000) return ins_num($n);
  $k = $n / 1000;
  return (abs($k) < 100 ? rtrim(rtrim(number_format($k, 1, '.', ''), '0'), '.') : number_format($k, 0, '.', ',')) . 'k';
}

/** A share in per cent for display: '42%', '0.4%', '<0.1%' ('' when $whole is 0). */
function ins_share($part, $whole): string
{
  $whole = (float) $whole;
  if ($whole <= 0) return '';
  $p = (float) $part / $whole * 100;
  if ($p <= 0) return '0%';
  if ($p < 0.1) return '<0.1%';
  if ($p < 9.95) return rtrim(rtrim(number_format($p, 1, '.', ''), '0'), '.') . '%';
  return number_format($p, 0) . '%';
}

/** Request rate: requests ÷ visitors as '1.8%' (null when there were no visitors). */
function ins_rate($requests, $visitors): ?string
{
  $v = (float) $visitors;
  if ($v <= 0) return null;
  $p = (float) $requests / $v * 100;
  if ($p > 0 && $p < 0.05) return '<0.1%';
  return number_format($p, $p >= 10 ? 0 : 1, '.', ',') . '%';
}

/**
 * KPI meta line comparing two periods: a coloured "▲ 12%" / "▼ 4%" / "± 0%" pill and $vsText
 * (e.g. "vs previous 30 days"). Without a previous figure it says so instead of inventing a percentage.
 * $upIsGood = false swaps the colours (e.g. for overdue money). Returns HTML.
 */
function ins_trend($cur, $prev, string $vsText, bool $upIsGood = true): string
{
  $cur = (float) $cur;
  $prev = (float) $prev;
  if ($prev <= 0) {
    if ($cur <= 0) return '<span>' . h(t('Nothing yet in either period')) . '</span>';
    return '<span class="trend trend--' . ($upIsGood ? 'up' : 'down') . '">▲ ' . h(t('new')) . '</span><span>' . h(t('none in the period before')) . '</span>';
  }
  $pct = ($cur - $prev) / $prev * 100;
  if (abs($pct) < 0.5) {
    $pill = '<span class="trend trend--flat">± 0%</span>';
  } else {
    $up = $pct > 0;
    $good = $up === $upIsGood;
    $pill = '<span class="trend trend--' . ($good ? 'up' : 'down') . '" title="' . h(ins_num($prev)) . ' → ' . h(ins_num($cur)) . '">'
      . ($up ? '▲ ' : '▼ ') . h(number_format(abs($pct), 0)) . '%</span>';
  }
  return $pill . '<span>' . h($vsText) . '</span>';
}

/** Turns "georgia-in-ten-points" into "Georgia in Ten Points". */
function ins_title_case(string $slug): string
{
  $small = ['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'];
  $upper = ['sim', 'faq', 'atm', 'vat', 'usd', 'eur', 'gel', 'unesco'];
  $words = preg_split('/[-_]+/', strtolower(trim($slug)), -1, PREG_SPLIT_NO_EMPTY) ?: [];
  foreach ($words as $i => $w) {
    if (in_array($w, $upper, true)) $words[$i] = strtoupper($w);
    elseif ($i > 0 && in_array($w, $small, true)) $words[$i] = $w;
    else $words[$i] = ucfirst($w);
  }
  return implode(' ', $words);
}

// ── Friendly names ──────────────────────────────────────────────────────────

/** The website's language codes (from the catalogue), in website order. */
function ins_site_langs(): array
{
  static $codes = null;
  if ($codes !== null) return $codes;
  $codes = [];
  foreach ((array) (catalog()['languages'] ?? []) as $l) {
    if (is_array($l) && preg_match('/^[a-z]{2}$/', (string) ($l['code'] ?? ''))) $codes[] = (string) $l['code'];
  }
  if (!$codes) $codes = array_keys(INS_LANG_NAMES);
  return $codes;
}

/** "Russian · Русский" for a website language code; 'other' → "Other languages". */
function ins_lang_name($code, bool $withNative = true): string
{
  $code = strtolower(trim((string) $code));
  if ($code === '' || $code === 'other') return t('Other languages');
  $en = INS_LANG_NAMES[$code] ?? '';
  $native = '';
  foreach ((array) (catalog()['languages'] ?? []) as $l) {
    if (is_array($l) && (string) ($l['code'] ?? '') === $code) $native = (string) ($l['name'] ?? '');
  }
  if ($en === '') return $native !== '' ? $native : strtoupper($code);
  $label = t($en);
  return ($withNative && $native !== '' && $native !== $label && $native !== $en) ? $label . ' · ' . $native : $label;
}

/**
 * A counted page path ('/', '/ru/tours/cradle-of-wine', '(not found)') as people know it:
 *   name   'The Cradle of Wine'            lang  'ru' ('' for English, the site's default)
 *   label  'The Cradle of Wine · RU'       base  '/tours/cradle-of-wine' (path without the language)
 *   href   '../ru/tours/cradle-of-wine' for known pages (relative to admin/), else ''
 *   known  true for pages the website has; 'notfound' true for '(not found)'
 */
function ins_page_info(string $path): array
{
  static $tours = null;
  if ($tours === null) {
    $tours = [];
    foreach ((array) (catalog()['tours'] ?? []) as $t) if (is_array($t) && isset($t['id'])) $tours[(string) $t['id']] = (string) $t['name'];
  }
  if ($path === '(not found)') {
    return ['name' => t('Addresses that don’t exist'), 'lang' => '', 'label' => t('Addresses that don’t exist'), 'base' => $path, 'href' => '', 'known' => false, 'notfound' => true];
  }
  $lang = '';
  $base = $path;
  if (preg_match('~^/([a-z]{2})(/.*)?$~', $path, $m) && $m[1] !== 'en' && in_array($m[1], ins_site_langs(), true)) {
    $lang = $m[1];
    $base = isset($m[2]) && $m[2] !== '' ? $m[2] : '/';
  }
  $name = '';
  if (isset(INS_PAGE_NAMES[$base])) {
    $name = t(INS_PAGE_NAMES[$base]);
  } elseif (preg_match('~^/tours/([a-z0-9-]{1,80})$~', $base, $m)) {
    $name = isset($tours[$m[1]]) ? $tours[$m[1]] : ins_title_case($m[1]);
  } elseif (preg_match('~^/guide/([a-z0-9-]{1,80})$~', $base, $m)) {
    $name = t('Guide: {title}', ['title' => ins_title_case($m[1])]);
  }
  $known = $name !== '';
  if (!$known) $name = $base;
  // Only paths that matched a known pattern (letters, digits, dashes, slashes) become links to the website.
  $href = $known ? '..' . $path : '';
  return [
    'name' => $name, 'lang' => $lang, 'label' => $lang !== '' ? $name . ' · ' . strtoupper($lang) : $name,
    'base' => $base, 'href' => $href, 'known' => $known, 'notfound' => false,
  ];
}

/** A referrer host as stored ('google.de', '(direct)') → ['key' => grouping key, 'name' => display name, 'direct' => bool]. */
function ins_ref_info(string $host): array
{
  $host = strtolower(trim($host));
  if ($host === '' || $host === '(direct)') return ['key' => '(direct)', 'name' => t('Direct, bookmarks and apps'), 'direct' => true];
  foreach (INS_REF_NAMES as $r) {
    if (preg_match($r[0], $host)) return ['key' => $r[1], 'name' => $r[1], 'direct' => false];
  }
  return ['key' => $host, 'name' => $host, 'direct' => false];
}

// ── Charts ──────────────────────────────────────────────────────────────────

/** A "nice" axis: [top, step] with whole-number steps of 1, 2, 2.5 (from 25), 5 × 10ⁿ and about $ticks steps. */
function ins_nice_scale(float $max, int $ticks = 4): array
{
  if ($max <= 0) return [4.0, 1.0];
  $raw = $max / $ticks;
  $mag = pow(10, floor(log10($raw)));
  $cands = [1 * $mag, 2 * $mag, 5 * $mag, 10 * $mag];
  if ($mag >= 10) $cands[] = 2.5 * $mag;
  sort($cands);
  $step = 10 * $mag;
  foreach ($cands as $s) {
    if ($s < 1) continue;
    if ($s * $ticks >= $max - 1e-9) {
      $step = $s;
      break;
    }
  }
  $step = max(1.0, $step);
  $top = ceil($max / $step - 1e-9) * $step;
  return [(float) $top, (float) $step];
}

/** Coordinates for the SVG: trims trailing zeros ('12.50' → '12.5'). */
function ins_c(float $v): string
{
  $s = number_format($v, 2, '.', '');
  return rtrim(rtrim($s, '0'), '.') ?: '0';
}

/**
 * A column chart as HTML (<figure class="chart ins-chart">). Options:
 *   id        unique id (letters, digits, dashes)            title   chart title (plain text)
 *   desc      one-sentence summary for screen readers        sub     small text next to the title (optional)
 *   labels    full name of each slot, oldest first ("Week of 2 Nov") — used in tooltips and the table
 *   axis      short label under each slot ("2 Nov")         steps   [narrow, medium, wide] label spacing,
 *             counted back from the newest slot; each must divide the one before (e.g. [28, 14, 7])
 *   series    [['name' => 'Requests', 'values' => [...], 'type' => 'bar'|'line', 'tone' => gold|green|wine|muted], …]
 *             bar series stack in the given order (first at the bottom); line series are drawn on top
 *   partial   index of a slot still in progress (drawn lighter, named in the tooltip)
 *   partial_label  e.g. "This week so far"
 *   table_head     first column heading of the table ("Week starting")
 *   tip       optional callable($i): string for the tooltip text of slot $i
 *   empty     message shown instead of the chart when every value is 0 ('' = draw it anyway)
 *   empty_html  extra HTML under the empty message (e.g. a link)
 */
function ins_column_chart(array $o): string
{
  $id = preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($o['id'] ?? 'chart'))) ?: 'chart';
  $title = (string) ($o['title'] ?? '');
  $labels = array_values((array) ($o['labels'] ?? []));
  $axis = array_values((array) ($o['axis'] ?? $labels));
  $n = count($labels);
  $series = array_values((array) ($o['series'] ?? []));
  $steps = array_values((array) ($o['steps'] ?? [1, 1, 1])) + [1, 1, 1];
  $partial = isset($o['partial']) && $o['partial'] !== null ? (int) $o['partial'] : -1;
  $partialLabel = (string) ($o['partial_label'] ?? '');

  // Legend.
  $legend = '';
  foreach ($series as $s) {
    $tone = preg_replace('/[^a-z]/', '', (string) ($s['tone'] ?? 'gold'));
    $legend .= '<span><i class="chart__key ins-key ins-key--' . h($tone) . (($s['type'] ?? 'bar') === 'line' ? ' ins-key--line' : '') . '" aria-hidden="true"></i>' . h($s['name']) . '</span>';
  }
  if ($partial >= 0 && $partialLabel !== '') {
    $pTone = 'gold';
    foreach ($series as $s) if (($s['type'] ?? 'bar') === 'bar') $pTone = preg_replace('/[^a-z]/', '', (string) ($s['tone'] ?? 'gold'));
    $legend .= '<span><i class="chart__key ins-key ins-key--' . h($pTone) . ' ins-key--partial" aria-hidden="true"></i>' . h($partialLabel) . '</span>';
  }
  $head = '<figcaption class="chart__head"><span class="chart__title" id="' . h($id) . '-cap">' . h($title) . '</span>'
    . (!empty($o['sub']) ? '<span class="ins-chart__sub">' . h($o['sub']) . '</span>' : '')
    . ($legend !== '' ? '<span class="chart__legend">' . $legend . '</span>' : '') . '</figcaption>';

  // Scale.
  $stack = array_fill(0, $n, 0.0);
  $max = 0.0;
  foreach ($series as $s) {
    $vals = array_values((array) $s['values']);
    for ($i = 0; $i < $n; $i++) {
      $v = max(0.0, (float) ($vals[$i] ?? 0));
      if (($s['type'] ?? 'bar') === 'bar') $stack[$i] += $v;
      else $max = max($max, $v);
    }
  }
  $max = max($max, $stack ? max($stack) : 0.0);
  if ($n === 0 || ($max <= 0 && (string) ($o['empty'] ?? '') !== '')) {
    $head = '<figcaption class="chart__head"><span class="chart__title" id="' . h($id) . '-cap">' . h($title) . '</span>'
      . (!empty($o['sub']) ? '<span class="ins-chart__sub">' . h($o['sub']) . '</span>' : '') . '</figcaption>';
    return '<figure class="chart ins-chart ins-chart--empty" aria-labelledby="' . h($id) . '-cap">' . $head
      . '<div class="ins-chart__empty"><span class="ins-chart__empty-icon" aria-hidden="true">' . icon('chart') . '</span>'
      . '<p>' . h((string) ($o['empty'] ?? '')) . '</p>' . ($o['empty_html'] ?? '') . '</div></figure>';
  }
  list($top, $step) = ins_nice_scale($max);
  $W = $n * 10;
  $y = function ($v) use ($top) { return 100 - (max(0.0, (float) $v) / $top) * 100; };

  // Tooltip texts.
  $tips = [];
  for ($i = 0; $i < $n; $i++) {
    if (isset($o['tip']) && is_callable($o['tip'])) {
      $tips[] = (string) call_user_func($o['tip'], $i);
      continue;
    }
    $parts = [];
    foreach ($series as $s) $parts[] = $s['name'] . ': ' . ins_num(((array) $s['values'])[$i] ?? 0);
    $tips[] = ($i === $partial && $partialLabel !== '' ? $partialLabel : $labels[$i]) . ' — ' . implode(', ', $parts);
  }

  // SVG body: grid, bars, lines, hover targets.
  $svg = '';
  $ticks = [];
  for ($v = 0.0; $v <= $top + 1e-9; $v += $step) $ticks[] = $v;
  foreach ($ticks as $v) {
    $yy = ins_c($y($v));
    $svg .= '<line class="ins-grid' . ($v == 0 ? ' ins-grid--base' : '') . '" x1="0" x2="' . $W . '" y1="' . $yy . '" y2="' . $yy . '" vector-effect="non-scaling-stroke"/>';
  }
  $pad = $n <= 14 ? 1.8 : ($n <= 45 ? 1.4 : 1.0);
  $base = array_fill(0, $n, 0.0);
  foreach ($series as $s) {
    if (($s['type'] ?? 'bar') !== 'bar') continue;
    $tone = preg_replace('/[^a-z]/', '', (string) ($s['tone'] ?? 'gold'));
    $vals = array_values((array) $s['values']);
    $g = '';
    for ($i = 0; $i < $n; $i++) {
      $v = max(0.0, (float) ($vals[$i] ?? 0));
      if ($v <= 0) continue;
      $y1 = $y($base[$i] + $v);
      $y0 = $y($base[$i]);
      $base[$i] += $v;
      $g .= '<rect class="ins-bar ins-bar--' . h($tone) . ($i === $partial ? ' ins-bar--partial' : '') . '" x="' . ins_c($i * 10 + $pad) . '" y="' . ins_c($y1)
        . '" width="' . ins_c(10 - 2 * $pad) . '" height="' . ins_c(max(0.0, $y0 - $y1)) . '"/>';
    }
    $svg .= '<g>' . $g . '</g>';
  }
  foreach ($series as $s) {
    if (($s['type'] ?? 'bar') !== 'line') continue;
    $tone = preg_replace('/[^a-z]/', '', (string) ($s['tone'] ?? 'wine'));
    $vals = array_values((array) $s['values']);
    $pts = [];
    for ($i = 0; $i < $n; $i++) $pts[] = ins_c($i * 10 + 5) . ',' . ins_c($y($vals[$i] ?? 0));
    if ($n > 1) {
      $svg .= '<path class="ins-area ins-area--' . h($tone) . '" d="M' . ins_c(5) . ',100 L' . implode(' L', $pts) . ' L' . ins_c(($n - 1) * 10 + 5) . ',100 Z"/>';
    }
    $svg .= '<polyline class="ins-line ins-line--' . h($tone) . '" points="' . implode(' ', $pts) . '" vector-effect="non-scaling-stroke"/>';
  }
  for ($i = 0; $i < $n; $i++) {
    $svg .= '<rect class="ins-hit" data-i="' . $i . '" x="' . ($i * 10) . '" y="0" width="10" height="100"><title>' . h($tips[$i]) . '</title></rect>';
  }

  // HTML axes.
  $yl = '';
  $sizer = '';
  foreach ($ticks as $v) {
    $txt = ins_compact($v);
    if (strlen($txt) > strlen($sizer)) $sizer = $txt;
    $yl .= '<span style="bottom:' . ins_c($v / $top * 100) . '%">' . h($txt) . '</span>';
  }
  list($sN, $sM, $sW) = [max(1, (int) $steps[0]), max(1, (int) $steps[1]), max(1, (int) $steps[2])];
  $xl = '';
  for ($i = 0; $i < $n; $i++) {
    $j = $n - 1 - $i;
    if ($j % $sN === 0) $lv = 0;
    elseif ($j % $sM === 0) $lv = 1;
    elseif ($j % $sW === 0) $lv = 2;
    else continue;
    $txt = (string) ($axis[$i] ?? '');
    if ($txt === '') continue;
    // With many narrow slots the outermost labels are pinned to the edges so they can't stick out of the card.
    $pin = $n > 14;
    $cls = 'lv' . $lv . ($pin && $i === 0 ? ' is-start' : '') . ($pin && $i === $n - 1 ? ' is-end' : '') . ($i === $partial ? ' is-partial' : '');
    $pos = $pin && $i === $n - 1 ? 'left:100%' : ($pin && $i === 0 ? 'left:0' : 'left:' . ins_c(($i + 0.5) / $n * 100) . '%');
    $xl .= '<span class="' . $cls . '" style="' . $pos . '">' . h($txt) . '</span>';
  }

  $desc = (string) ($o['desc'] ?? '');
  $html = '<figure class="chart ins-chart" aria-labelledby="' . h($id) . '-cap">' . $head
    . '<div class="ins-chart__frame">'
    . '<div class="ins-chart__y" aria-hidden="true"><span class="ins-chart__sizer">' . h($sizer) . '</span>' . $yl . '</div>'
    . '<div class="ins-chart__plot" data-tips="' . h((string) json_encode($tips, JSON_UNESCAPED_UNICODE)) . '">'
    . '<svg class="ins-chart__svg" viewBox="0 0 ' . $W . ' 100" preserveAspectRatio="none" role="img" focusable="false" aria-labelledby="' . h($id) . '-t' . ($desc !== '' ? ' ' . h($id) . '-d' : '') . '">'
    . '<title id="' . h($id) . '-t">' . h($title) . '</title>' . ($desc !== '' ? '<desc id="' . h($id) . '-d">' . h($desc) . '</desc>' : '')
    . $svg . '</svg>'
    . '<div class="ins-chart__x" aria-hidden="true">' . $xl . '</div>'
    . '</div></div>';

  // Table fallback.
  $th = '<th scope="col">' . h((string) ($o['table_head'] ?? t('Period'))) . '</th>';
  foreach ($series as $s) $th .= '<th scope="col" class="num">' . h($s['name']) . '</th>';
  $rows = '';
  for ($i = 0; $i < $n; $i++) {
    $rows .= '<tr><th scope="row">' . h($labels[$i]) . ($i === $partial && $partialLabel !== '' ? ' <span class="muted">(' . h(t('so far')) . ')</span>' : '') . '</th>';
    foreach ($series as $s) $rows .= '<td class="num">' . h(ins_num(((array) $s['values'])[$i] ?? 0)) . '</td>';
    $rows .= '</tr>';
  }
  $html .= '<details class="chart__table"><summary>' . h(t('Show as table')) . '</summary><div class="table-wrap">'
    . '<table class="table table--compact table--keep ins-table"><thead><tr>' . $th . '</tr></thead><tbody>' . $rows . '</tbody></table></div></details>'
    . '</figure>';
  return $html;
}

/**
 * Horizontal bars (.bars). $rows: [['label' => …, 'value' => n, 'sub' => small text, 'href' => link,
 * 'note' => text after the value, 'muted' => bool, 'title' => tooltip], …] (already sorted).
 * $opts: 'tone' => gold|wine|green|blue, 'total' => for shares (default: sum of values), 'share' => bool,
 * 'unit' => callable($n): string for the value text, 'max' => bar scale (default: largest value).
 */
function ins_bar_list(array $rows, array $opts = []): string
{
  $tone = in_array($opts['tone'] ?? '', ['wine', 'green', 'blue'], true) ? ' bar-row__fill--' . $opts['tone'] : '';
  $sum = 0.0;
  $max = 0.0;
  foreach ($rows as $r) {
    $sum += (float) $r['value'];
    $max = max($max, (float) $r['value']);
  }
  $total = isset($opts['total']) ? (float) $opts['total'] : $sum;
  if (isset($opts['max'])) $max = max($max, (float) $opts['max']);
  $out = '';
  foreach ($rows as $r) {
    $v = (float) $r['value'];
    $w = $max > 0 ? max(0.0, min(100.0, $v / $max * 100)) : 0.0;
    $valText = isset($opts['unit']) && is_callable($opts['unit']) ? (string) call_user_func($opts['unit'], $v) : ins_num($v);
    $share = !empty($opts['share']) ? ins_share($v, $total) : '';
    $label = h((string) $r['label']);
    if (!empty($r['href'])) $label = '<a href="' . h((string) $r['href']) . '"' . (!empty($r['external']) ? ' target="_blank" rel="noopener"' : '') . '>' . $label . '</a>';
    $out .= '<li class="bar-row ins-bar-row' . (!empty($r['muted']) ? ' is-muted' : '') . '" data-value="' . h(ins_c($v)) . '"' . (!empty($r['title']) ? ' title="' . h((string) $r['title']) . '"' : '') . '>'
      . '<span class="bar-row__label">' . $label . (!empty($r['sub']) ? '<span class="ins-bar-row__sub">' . h((string) $r['sub']) . '</span>' : '') . '</span>'
      . '<span class="bar-row__value">' . h($valText)
      . ($share !== '' ? '<span class="ins-bar-row__share">' . h($share) . '</span>' : '')
      . (!empty($r['note']) ? '<span class="ins-bar-row__note">' . h((string) $r['note']) . '</span>' : '') . '</span>'
      . '<span class="bar-row__track"><span class="bar-row__fill' . $tone . '" style="width:' . ins_c($w) . '%"></span></span></li>';
  }
  return '<ul class="bars ins-bars">' . $out . '</ul>';
}

/** A small "nothing here yet" block for a card. */
function ins_empty(string $icon, string $title, string $text = '', string $extraHtml = ''): string
{
  return '<div class="empty empty--sm ins-empty"><div class="empty__mark" aria-hidden="true">' . icon($icon) . '</div>'
    . '<p class="empty__title">' . h($title) . '</p>' . ($text !== '' ? '<p class="empty__text">' . h($text) . '</p>' : '') . $extraHtml . '</div>';
}
