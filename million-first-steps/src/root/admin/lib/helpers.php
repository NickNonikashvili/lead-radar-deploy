<?php
/*
 * Small general helpers: escaping, translation, URLs, input, flashes, dates, money, badges, pagination.
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

const UI_LANGS = ['en' => 'English', 'ka' => 'ქართული'];

/** Request statuses in workflow order: key => English label (translate with t()). */
const REQUEST_STATUSES = [
  'new' => 'New',
  'contacted' => 'Contacted',
  'quoted' => 'Quoted',
  'booked' => 'Booked',
  'lost' => 'Lost',
  'spam' => 'Spam',
];
/** Booking statuses: key => English label. */
const BOOKING_STATUSES = [
  'quote' => 'Quote',
  'confirmed' => 'Confirmed',
  'completed' => 'Completed',
  'cancelled' => 'Cancelled',
];
/** Request kinds (requests.kind): key => English label. */
const REQUEST_KINDS = [
  'trip' => 'Trip request',
  'contact' => 'Message',
  'partner' => 'Partner enquiry',
  'other' => 'Other',
];
/** Team roles: key => English label. */
const USER_ROLES = [
  'owner' => 'Owner',
  'staff' => 'Team member',
];

/** Text-direction override and isolate characters: a visitor could use them to disguise a name or flip the text around it. */
const MFS_BIDI_CONTROLS = ["\u{202A}", "\u{202B}", "\u{202C}", "\u{202D}", "\u{202E}", "\u{2066}", "\u{2067}", "\u{2068}", "\u{2069}"];

/** Escape for HTML text and attributes. Use on EVERY value you print. */
function h($s): string
{
  return htmlspecialchars(str_replace(MFS_BIDI_CONTROLS, '', (string) $s), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * The interface language of this request: the signed-in user's, else the session's, else the one picked on the
 * sign-in pages (remembered on this device in the mfs_lang cookie). mfs_with_lang() can switch it for a moment.
 */
function mfs_lang(): string
{
  if (!empty($GLOBALS['mfs_lang_force'])) {
    $l = (string) $GLOBALS['mfs_lang_force'];
  } else {
    $u = isset($GLOBALS['mfs_user']) && is_array($GLOBALS['mfs_user']) ? $GLOBALS['mfs_user'] : null;
    if ($u) $l = (string) $u['lang'];
    elseif (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['lang'])) $l = (string) $_SESSION['lang'];
    elseif (isset($GLOBALS['mfs_lang_pick'])) $l = (string) $GLOBALS['mfs_lang_pick'];
    else $l = isset($_COOKIE['mfs_lang']) && is_string($_COOKIE['mfs_lang']) ? $_COOKIE['mfs_lang'] : 'en';
  }
  return isset(UI_LANGS[$l]) ? $l : 'en';
}

/** Runs $fn with the interface language set to $lang (e.g. to write an email in its recipient's language). */
function mfs_with_lang(string $lang, callable $fn)
{
  $prev = $GLOBALS['mfs_lang_force'] ?? null;
  $GLOBALS['mfs_lang_force'] = isset(UI_LANGS[$lang]) ? $lang : 'en';
  try {
    return $fn();
  } finally {
    $GLOBALS['mfs_lang_force'] = $prev;
  }
}

/**
 * UI text in the user's language. Returns PLAIN text — always print it as h(t('…')).
 * {name} placeholders are filled from $vars: t('Hello, {name}', ['name' => $u['name']]).
 * Georgian strings live in lib/lang/ka.php as ['English text' => 'ქართული', …]; missing ones stay English.
 */
function t($english, array $vars = []): string
{
  static $dicts = [];
  $s = (string) $english;
  $lang = mfs_lang();
  if ($lang !== 'en') {
    if (!isset($dicts[$lang])) {
      $f = MFS_LIB . '/lang/' . $lang . '.php';
      $d = is_file($f) ? include $f : [];
      $dicts[$lang] = is_array($d) ? $d : [];
    }
    if (isset($dicts[$lang][$s]) && $dicts[$lang][$s] !== '') $s = (string) $dicts[$lang][$s];
  }
  if ($vars) {
    $r = [];
    foreach ($vars as $k => $v) $r['{' . $k . '}'] = (string) $v;
    $s = strtr($s, $r);
  }
  return $s;
}

/** Plural-aware t(): tp($n, '{n} request', '{n} requests'). {n} is filled in for you. */
function tp($n, string $one, string $many, array $vars = []): string
{
  return t(((int) $n === 1) ? $one : $many, $vars + ['n' => number_format((float) $n)]);
}

/** Link to an admin page, relative to admin/: url('request', ['id' => 5]) → 'index.php?p=request&id=5'. Empty/null params are dropped. */
function url($page, array $params = []): string
{
  $q = ['p' => (string) $page];
  foreach ($params as $k => $v) {
    if ($v === null || $v === '' || $v === false) continue;
    $q[$k] = $v;
  }
  return 'index.php?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986);
}

/** 303 redirect and stop. Use after every POST (POST-redirect-GET). */
function redirect($url)
{
  $url = str_replace(["\r", "\n", "\0"], '', (string) $url);
  if (!headers_sent()) header('Location: ' . $url, true, 303);
  else echo '<p><a href="' . h($url) . '">' . h(t('Continue')) . '</a></p>';
  exit;
}

function is_post(): bool
{
  return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

/** Remove control characters (keeps new lines and tabs), normalise line ends, trim. */
function mfs_clean_text($s, bool $multiline = true): string
{
  if (!is_string($s)) $s = is_scalar($s) ? (string) $s : '';
  if (function_exists('mb_check_encoding') && !mb_check_encoding($s, 'UTF-8')) $s = mb_convert_encoding($s, 'UTF-8', 'UTF-8');
  $s = str_replace(["\r\n", "\r"], "\n", $s);
  if (!$multiline) $s = str_replace(["\n", "\t"], ' ', $s);
  $s = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
  $s = str_replace(MFS_BIDI_CONTROLS, '', $s);
  return trim($s);
}

/** A POST value as a trimmed, cleaned string ($default if missing or not a string). */
function post($key, $default = ''): string
{
  if (!isset($_POST[$key]) || is_array($_POST[$key])) return (string) $default;
  return mfs_clean_text($_POST[$key]);
}

/** A GET value as a trimmed, cleaned single-line string. */
function get($key, $default = ''): string
{
  if (!isset($_GET[$key]) || is_array($_GET[$key])) return (string) $default;
  return mfs_clean_text($_GET[$key], false);
}

/** A GET value as an integer. */
function get_int($key, int $default = 0): int
{
  $v = get($key, '');
  return preg_match('/^-?\d{1,12}$/', $v) ? (int) $v : $default;
}

/** Checked ids from a bulk form (name="ids[]") as unique positive integers. */
function post_ids($key = 'ids'): array
{
  $v = $_POST[$key] ?? [];
  if (!is_array($v)) return [];
  $out = [];
  foreach ($v as $x) if (is_scalar($x) && preg_match('/^\d{1,12}$/', (string) $x) && (int) $x > 0) $out[(int) $x] = (int) $x;
  return array_values($out);
}

/**
 * A message shown once on the next rendered page. $type: 'ok' | 'error' | 'info'.
 * Signed in: kept in the session. Otherwise: in a small signed cookie (mfs_flash), so no session is needed.
 */
function flash($type, $message): void
{
  $type = in_array($type, ['ok', 'error', 'info'], true) ? $type : 'info';
  if (session_status() === PHP_SESSION_ACTIVE) {
    $_SESSION['flash'][] = [$type, (string) $message];
    return;
  }
  $q = &mfs_cookie_flashes();
  $q[] = [$type, (string) $message];
  $q = array_slice($q, -4);
  mfs_signed_cookie_set('mfs_flash', $q);
}

/** The messages waiting in the mfs_flash cookie (plus the ones added during this request). */
function &mfs_cookie_flashes(): array
{
  if (!isset($GLOBALS['mfs_flash_queue'])) {
    $q = [];
    $d = isset($_COOKIE['mfs_flash']) ? mfs_signed_cookie_get('mfs_flash') : null;
    if (is_array($d)) foreach ($d as $f) if (is_array($f) && isset($f[0], $f[1]) && is_string($f[0]) && is_string($f[1])) $q[] = [$f[0], $f[1]];
    $GLOBALS['mfs_flash_queue'] = $q;
  }
  return $GLOBALS['mfs_flash_queue'];
}

/** Takes the waiting flash messages (render() does this for you). */
function mfs_take_flashes(): array
{
  $out = [];
  if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['flash'])) {
    $out = is_array($_SESSION['flash']) ? $_SESSION['flash'] : [];
    unset($_SESSION['flash']);
  }
  if (isset($_COOKIE['mfs_flash']) || !empty($GLOBALS['mfs_flash_queue'])) {
    $q = &mfs_cookie_flashes();
    $out = array_merge($q, $out);
    $q = [];
    mfs_set_cookie('mfs_flash', '', time() - 86400);
  }
  return $out;
}

// ── Time ────────────────────────────────────────────────────────────────────
// The database stores times as UTC 'Y-m-d H:i:s' and calendar dates (trip dates, due dates) as plain 'Y-m-d'.

function mfs_tz(): DateTimeZone
{
  static $tz = null;
  if (!$tz) $tz = new DateTimeZone(MFS_TZ);
  return $tz;
}

/** Now as UTC 'Y-m-d H:i:s' — use for created_at / updated_at. */
function now_utc(): string
{
  return gmdate('Y-m-d H:i:s');
}

/** Today's date in Tbilisi, 'Y-m-d'. */
function local_today(): string
{
  $d = new DateTime('now', mfs_tz());
  return $d->format('Y-m-d');
}

/** UTC 'Y-m-d H:i:s' → DateTime in Tbilisi time (null if empty/invalid). */
function utc_to_local($utc): ?DateTime
{
  $utc = trim((string) $utc);
  if ($utc === '') return null;
  try {
    $d = new DateTime($utc, new DateTimeZone('UTC'));
  } catch (Exception $e) {
    return null;
  }
  $d->setTimezone(mfs_tz());
  return $d;
}

/**
 * "20 Nov 2026" or, with $withTime, "20 Nov 2026, 14:05" in Tbilisi time.
 * A plain 'Y-m-d' date (trip dates, due dates) is shown as is, without a time-zone shift. Empty → ''.
 */
function fmt_date($utc, $withTime = false): string
{
  $s = trim((string) $utc);
  if ($s === '') return '';
  if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
    $d = DateTime::createFromFormat('!Y-m-d', $s, mfs_tz());
    $withTime = false;
  } else {
    $d = utc_to_local($s);
  }
  if (!$d) return '';
  $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  $out = $d->format('j') . ' ' . t($months[(int) $d->format('n') - 1]) . ' ' . $d->format('Y');
  return $withTime ? $out . ', ' . $d->format('H:i') : $out;
}

/** "just now", "5 min ago", "3 hours ago", "yesterday, 14:05", else fmt_date($utc, true). */
function fmt_ago($utc): string
{
  $d = utc_to_local($utc);
  if (!$d) return '';
  $secs = time() - $d->getTimestamp();
  if ($secs < 0) return fmt_date($utc, true);
  if ($secs < 60) return t('just now');
  if ($secs < 3600) return tp((int) floor($secs / 60), '{n} min ago', '{n} min ago');
  $today = local_today();
  if ($d->format('Y-m-d') === $today && $secs < 86400) return tp((int) floor($secs / 3600), '{n} hour ago', '{n} hours ago');
  $y = new DateTime('yesterday', mfs_tz());
  if ($d->format('Y-m-d') === $y->format('Y-m-d')) return t('yesterday, {time}', ['time' => $d->format('H:i')]);
  return fmt_date($utc, true);
}

/** Days from today (Tbilisi) to a 'Y-m-d' date: 0 today, 1 tomorrow, -1 yesterday; null if invalid. */
function days_until($ymd): ?int
{
  $a = DateTime::createFromFormat('!Y-m-d', local_today(), mfs_tz());
  $b = DateTime::createFromFormat('!Y-m-d', (string) $ymd, mfs_tz());
  if (!$a || !$b) return null;
  return (int) round(($b->getTimestamp() - $a->getTimestamp()) / 86400);
}

/** Money in euros: 1250 → '€1,250', 1250.5 → '€1,250.50', -40 → '−€40'. */
function fmt_money($n): string
{
  $n = round((float) $n, 2);
  $neg = $n < 0;
  $n = abs($n);
  $s = '€' . number_format($n, (abs($n - floor($n)) > 0.004) ? 2 : 0, '.', ',');
  return $neg ? '−' . $s : $s;
}

/** A number for the database: rounds to 2 decimals. Accepts "1 250,50", "€1,250.50". */
function money_value($s): float
{
  $s = trim(str_replace(['€', ' ', "\xC2\xA0"], '', (string) $s));
  if (preg_match('/^-?\d{1,3}(,\d{3})+(\.\d+)?$/', $s)) $s = str_replace(',', '', $s);
  elseif (preg_match('/^-?\d+,\d{1,2}$/', $s)) $s = str_replace(',', '.', $s);
  return is_numeric($s) ? round((float) $s, 2) : 0.0;
}

/** A coloured status pill with the translated label. $type: 'request' | 'booking'. */
function status_badge($status, $type = 'request'): string
{
  $list = $type === 'booking' ? BOOKING_STATUSES : REQUEST_STATUSES;
  $s = (string) $status;
  if (!isset($list[$s])) return '<span class="pill pill--muted">' . h($s !== '' ? $s : '—') . '</span>';
  return '<span class="pill pill--' . h($s) . '">' . h(t($list[$s])) . '</span>';
}

/** A valid email address, trimmed — or '' if it isn't one. */
function valid_email($s): string
{
  $s = trim((string) $s);
  if (strlen($s) > 200) return '';
  $v = filter_var($s, FILTER_VALIDATE_EMAIL);
  return $v ? (string) $v : '';
}

/** A phone number reduced to digits, keeping a leading + (or 00): '+995 555 12-34-56' → '+995555123456'. */
function phone_digits($s): string
{
  $s = trim((string) $s);
  $plus = substr($s, 0, 1) === '+' || substr($s, 0, 2) === '00';
  $d = preg_replace('/\D+/', '', $s);
  if (substr($s, 0, 2) === '00') $d = substr($d, 2);
  return $d === '' ? '' : ($plus ? '+' : '') . $d;
}

/** Safe tel: link target for a visitor-supplied number ('' if it doesn't look like a phone number). */
function tel_href($phone): string
{
  $d = phone_digits($phone);
  return preg_match('/^\+?\d{6,16}$/', $d) ? 'tel:' . $d : '';
}

/** WhatsApp link for a number with country code ('' if not plausible). */
function whatsapp_href($phone): string
{
  $d = preg_replace('/\D+/', '', phone_digits($phone));
  return preg_match('/^\d{8,15}$/', $d) && strpos(phone_digits($phone), '+') === 0 ? 'https://wa.me/' . $d : '';
}

/** Safe mailto: link target for a visitor-supplied address ('' if invalid). */
function mailto_href($email, $subject = ''): string
{
  $e = valid_email($email);
  if ($e === '') return '';
  return 'mailto:' . str_replace('%40', '@', rawurlencode($e)) . ($subject !== '' ? '?subject=' . rawurlencode((string) $subject) : '');
}

/** Initials for an avatar: "Nino Kapanadze" → "NK". */
function initials($name): string
{
  $parts = preg_split('/\s+/u', trim((string) $name)) ?: [];
  $out = '';
  foreach (array_slice($parts, 0, 2) as $p) $out .= function_exists('mb_substr') ? mb_substr($p, 0, 1) : substr($p, 0, 1);
  return function_exists('mb_strtoupper') ? mb_strtoupper($out) : strtoupper($out);
}

/** Shortens text to $max characters with an ellipsis. */
function excerpt($s, int $max = 120): string
{
  $s = trim(preg_replace('/\s+/u', ' ', (string) $s));
  $len = function_exists('mb_strlen') ? mb_strlen($s) : strlen($s);
  if ($len <= $max) return $s;
  $cut = function_exists('mb_substr') ? mb_substr($s, 0, $max - 1) : substr($s, 0, $max - 1);
  return rtrim($cut) . '…';
}

/**
 * Pagination links. $params are the current page's query parameters including 'p'
 * (e.g. ['p' => 'requests', 'status' => 'new']); the page number travels as 'page'.
 * Returns '' when everything fits on one page.
 */
function pager(int $total, int $page, int $per, array $params): string
{
  $per = max(1, $per);
  $pages = (int) max(1, ceil($total / $per));
  if ($pages <= 1) return '';
  $page = min(max(1, $page), $pages);
  $p = isset($params['p']) ? (string) $params['p'] : get('p', 'dashboard');
  unset($params['p'], $params['page']);
  $link = function ($n) use ($p, $params) {
    return url($p, $params + ['page' => $n > 1 ? $n : null]);
  };
  $from = ($page - 1) * $per + 1;
  $to = min($total, $page * $per);
  $nums = [1, $pages];
  for ($i = $page - 1; $i <= $page + 1; $i++) if ($i >= 1 && $i <= $pages) $nums[] = $i;
  $nums = array_values(array_unique($nums));
  sort($nums);
  $items = '';
  if ($page > 1) $items .= '<li><a class="pager__link pager__step" rel="prev" href="' . h($link($page - 1)) . '">' . icon('chevron-left') . '<span>' . h(t('Previous')) . '</span></a></li>';
  $prev = 0;
  foreach ($nums as $n) {
    if ($prev && $n > $prev + 1) $items .= '<li class="pager__gap" aria-hidden="true">…</li>';
    $items .= $n === $page
      ? '<li><span class="pager__link is-current" aria-current="page">' . $n . '</span></li>'
      : '<li><a class="pager__link" href="' . h($link($n)) . '" aria-label="' . h(t('Page {n}', ['n' => $n])) . '">' . $n . '</a></li>';
    $prev = $n;
  }
  if ($page < $pages) $items .= '<li><a class="pager__link pager__step" rel="next" href="' . h($link($page + 1)) . '"><span>' . h(t('Next')) . '</span>' . icon('chevron-right') . '</a></li>';
  return '<nav class="pager" aria-label="' . h(t('Pages')) . '"><p class="pager__info">'
    . h(t('Showing {from}–{to} of {total}', ['from' => number_format($from), 'to' => number_format($to), 'total' => number_format($total)]))
    . '</p><ul class="pager__list">' . $items . '</ul></nav>';
}

// ── Request context ─────────────────────────────────────────────────────────

function mfs_is_https(): bool
{
  if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') return true;
  if ((string) ($_SERVER['SERVER_PORT'] ?? '') === '443') return true;
  if (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') return true;
  if (strtolower((string) ($_SERVER['REQUEST_SCHEME'] ?? '')) === 'https') return true;
  return false;
}

/** The Host header, validated ("example.com" or "127.0.0.1:8101"). */
function mfs_host(): string
{
  $h = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? 'localhost')));
  return preg_match('/^[a-z0-9.-]{1,253}(:\d{1,5})?$/', $h) ? $h : 'localhost';
}

/** URL path of the website root ('' at the domain root, '/sub' in a subfolder). */
function mfs_site_url_path(): string
{
  $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
  $urlDir = rtrim(str_replace('\\', '/', dirname($script)), '/');
  $fsDir = @realpath(dirname((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')));
  $root = @realpath(MFS_SITE_ROOT);
  if ($fsDir && $root && strpos($fsDir . '/', $root . '/') === 0) {
    $rel = str_replace('\\', '/', substr($fsDir, strlen($root)));
    if ($rel === '') return $urlDir;
    if (substr($urlDir, -strlen($rel)) === $rel) return substr($urlDir, 0, -strlen($rel));
  }
  return '';
}

/** URL path of the admin folder, with a trailing slash ('/admin/'). */
function mfs_admin_url_path(): string
{
  return mfs_site_url_path() . '/' . basename(MFS_ADMIN_DIR) . '/';
}

/** 'https://example.com' (scheme, host and port only) from a configured address, or '' if it isn't one. */
function mfs_origin_of($url): string
{
  $p = is_string($url) && $url !== '' ? parse_url(trim($url)) : false;
  if (!is_array($p) || !in_array(strtolower((string) ($p['scheme'] ?? '')), ['http', 'https'], true) || empty($p['host'])) return '';
  $host = strtolower((string) $p['host']);
  if (!preg_match('/^[a-z0-9.-]{1,253}$/', $host)) return '';
  return strtolower((string) $p['scheme']) . '://' . $host . (isset($p['port']) ? ':' . (int) $p['port'] : '');
}

/**
 * The website's own address for links in emails and the sender's domain — never just whatever Host header a
 * request carried. In order: MFS_SITE_URL in admin/config.local.php, the build's siteUrl (catalog.json), the
 * address the owners last signed in at (setting site_url), and only then this request's host.
 */
function mfs_site_origin(): string
{
  if (defined('MFS_SITE_URL') && ($o = mfs_origin_of((string) MFS_SITE_URL)) !== '') return $o;
  try {
    $o = mfs_origin_of((string) (catalog()['siteUrl'] ?? ''));
    if ($o === '') $o = mfs_origin_of((string) setting('site_url', ''));
    if ($o !== '') return $o;
  } catch (Throwable $e) {
    // No database: fall back to this request's host.
  }
  return (mfs_is_https() ? 'https' : 'http') . '://' . mfs_host();
}

/**
 * Remembers the address the first owner signed in (or set up the panel) at, for links in emails. Kept once set:
 * a later sign-in through another hostname (or a crafted Host header) can't re-point reset links or the sender.
 */
function mfs_remember_site_url(array $user): void
{
  if (($user['role'] ?? '') !== 'owner' || mfs_host() === 'localhost' || setting('site_url', '') !== '') return;
  set_setting('site_url', (mfs_is_https() ? 'https' : 'http') . '://' . mfs_host());
}

/** Absolute URL of the admin folder for emails: 'https://example.com/admin/'. */
function mfs_admin_base_url(): string
{
  return mfs_site_origin() . mfs_admin_url_path();
}

/**
 * Sends a 303 to $url and closes the connection, then lets the script carry on (e.g. to send an email): the
 * person doesn't wait for the mail server, and the response time doesn't tell what happened afterwards.
 */
function mfs_redirect_and_continue(string $url): void
{
  $url = str_replace(["\r", "\n", "\0"], '', $url);
  ignore_user_abort(true);
  if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
  if (!headers_sent()) {
    header('Location: ' . $url, true, 303);
    header('Content-Length: 0');
    header('Connection: close');
  }
  while (ob_get_level() > 0) @ob_end_flush();
  @flush();
  if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
  elseif (function_exists('litespeed_finish_request')) litespeed_finish_request();
}

/** The visitor's IP address (only ever stored hashed). */
function mfs_client_ip(): string
{
  return mfs_ip_key((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
}

/**
 * The address to count limits by: IPv4 as is, IPv6 cut to its /64 network (one connection usually holds a whole
 * /64, so counting single IPv6 addresses would let one visitor rotate past every per-IP limit).
 */
function mfs_ip_key(string $ip): string
{
  if (strpos($ip, ':') === false || !function_exists('inet_pton')) return $ip;
  $bin = @inet_pton($ip);
  if ($bin === false || strlen($bin) !== 16) return $ip;
  return (string) inet_ntop(substr($bin, 0, 8) . str_repeat("\0", 8)) . '/64';
}
