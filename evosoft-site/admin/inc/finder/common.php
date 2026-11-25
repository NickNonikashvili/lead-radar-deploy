<?php
/*
 * EvoSoft admin panel, client finder: settings, data files, daily budgets, the 24-hour cache, HTTP and input checks.
 * © 2026 EvoSoft Solutions. All rights reserved.
 *
 * Data (all in evo_data_dir(), outside public_html, JSON, 0600, changed under flock):
 *   leads.json              saved leads                      (leads.php)
 *   leads-suppressed.json   "do not contact" hashes only     (leads.php)
 *   finder-usage.json       per-day counters per source       (finder_usage_*)
 *   finder-cache/           search results, 24 hours at most  (finder_cache_*; Upwork entries 1 hour, encrypted)
 *   upwork-token.json       the Upwork sign-in, encrypted     (upwork.php)
 * api/lib.php's evo_housekeeping() deletes old leads, expired cache files and old counters.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

const FINDER_STATUSES = ['new' => 'New', 'contacted' => 'Contacted', 'replied' => 'Replied', 'won' => 'Won', 'lost' => 'Lost', 'not_interested' => 'Not interested'];
const FINDER_SOURCES = ['osm' => 'OpenStreetMap', 'web' => 'AI web search', 'tender' => 'Tender (TED)', 'manual' => 'Added by hand', 'upwork-track' => 'Upwork (tracked)'];
const FINDER_WEB_STATUSES = ['none' => 'No website', 'social_only' => 'Social page only', 'weak' => 'Weak website', 'ok' => 'Has a website', 'unknown' => 'Not checked'];
const FINDER_OSM_DAILY = 80;                    // Overpass queries a day (fair use for a regular tool: under ~100)
const FINDER_OSM_DAILY_BYTES = 10 * 1024 * 1024; // and under ~10 MB a day
const FINDER_TED_DAILY = 100;
const FINDER_UPWORK_DAILY = 60;
const FINDER_CACHE_SECONDS = 86400;
const FINDER_UPWORK_CACHE_SECONDS = 3600;       // Upwork content: kept briefly, never past 24 hours (housekeeping)

/** The finder's settings (api/config.example.php), with defaults and made safe. */
function finder_cfg(): array
{
    static $c = null;
    if ($c !== null) {
        return $c;
    }
    $cfg = evo_config();
    $str = static fn(string $k, string $default = ''): string => is_string($cfg[$k] ?? null) && trim($cfg[$k]) !== '' ? trim($cfg[$k]) : $default;
    $int = static fn(string $k, int $default, int $min, int $max): int => max($min, min($max, is_numeric($cfg[$k] ?? null) ? (int)$cfg[$k] : $default));
    $url = static function (string $k, string $default) use ($str): string {
        $u = $str($k, $default);
        return preg_match('#^https?://[^\s/?#]+[^\s]*$#i', $u) ? $u : $default;
    };
    $effort = $str('finder_effort', 'medium');
    $c = [
        'api_key' => $str('anthropic_api_key'),
        'base_url' => $str('anthropic_base_url') !== '' ? $str('anthropic_base_url') : null,
        'model' => $str('finder_model', 'claude-opus-5-5'),
        'effort' => in_array($effort, ['low', 'medium', 'high', 'xhigh', 'max'], true) ? $effort : 'medium',
        'ai_daily' => $int('finder_ai_daily_limit', 40, 0, 1000),
        'keep_months' => $int('leads_keep_months', 6, 0, 120),
        'overpass_url' => $url('overpass_url', 'https://overpass-api.de/api/interpreter'),
        'user_agent' => (string)preg_replace('/[^\x20-\x7E]/', '', $str('finder_user_agent', 'EvoSoft-ClientFinder/1.0 (+https://evosoft.solutions/legal)')),
        'upwork_client_id' => $str('upwork_client_id'),
        'upwork_client_secret' => $str('upwork_client_secret'),
        'upwork_redirect_uri' => $url('upwork_redirect_uri', 'https://evosoft.solutions/admin/?view=finder&tab=upwork'),
    ];
    return $c;
}

function finder_ai_ready(): bool
{
    return finder_cfg()['api_key'] !== '' && is_file(dirname(__DIR__, 3) . '/api/vendor/autoload.php');
}

// ---- small text and input helpers ----

/** One line of text: no control characters, trimmed, at most $max characters (UTF-8 made valid). */
function finder_line($v, int $max): string
{
    if (!is_string($v) && !is_int($v) && !is_float($v)) {
        return '';
    }
    $s = mb_convert_encoding((string)$v, 'UTF-8', 'UTF-8');
    $s = (string)preg_replace('/[\x00-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]+/u', ' ', $s);
    $s = trim((string)preg_replace('/\s{2,}/u', ' ', $s));
    return mb_substr($s, 0, $max);
}

/** Several lines (notes, email text). */
function finder_text($v, int $max): string
{
    if (!is_string($v)) {
        return '';
    }
    $s = mb_convert_encoding($v, 'UTF-8', 'UTF-8');
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $s = (string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]+/u', '', $s);
    $s = (string)preg_replace("/\n{4,}/", "\n\n\n", $s);
    return mb_substr(trim($s), 0, $max);
}

/** A web address that is safe to link to: http(s) only, a real host name, no user:password, at most 400 characters. */
function finder_url($v): string
{
    $u = finder_line($v, 400);
    if ($u === '' || !preg_match('#^https?://#i', $u) || filter_var($u, FILTER_VALIDATE_URL) === false) {
        return '';
    }
    $p = parse_url($u);
    $host = strtolower((string)($p['host'] ?? ''));
    if (!is_array($p) || isset($p['user']) || isset($p['pass']) || $host === '' || !str_contains($host, '.')
        || !preg_match('/^[a-z0-9.-]+$/', $host) || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
        return '';
    }
    return $u;
}

function finder_email($v): string
{
    $e = strtolower(finder_line($v, 254));
    return $e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL) !== false ? $e : '';
}

/** A phone number kept as text: digits and + ( ) - . / spaces, at least 5 digits. */
function finder_phone($v): string
{
    $p = finder_line($v, 40);
    if ($p === '' || !preg_match('#^[0-9+()\-./\s]+$#', $p) || preg_match_all('/\d/', $p) < 5) {
        return '';
    }
    return $p;
}

/** The items of a posted list that are in $allowed (strings only, no duplicates, in $allowed's order). */
function finder_pick_list($v, array $allowed): array
{
    $given = is_array($v) ? array_filter($v, 'is_string') : [];
    return array_values(array_filter($allowed, static fn($a): bool => in_array((string)$a, $given, true)));
}

function finder_int($v, int $default, int $min, int $max): int
{
    return is_numeric($v) ? max($min, min($max, (int)$v)) : $default;
}

/** The host of a URL without "www.", or ''. */
function finder_host(string $url): string
{
    $h = strtolower((string)parse_url($url, PHP_URL_HOST));
    return (string)preg_replace('/^www\./', '', $h);
}

/** Lower case, letters and digits only (any script), single spaces: for comparing names. */
function finder_norm(string $s): string
{
    $s = mb_strtolower($s, 'UTF-8');
    if (class_exists('Normalizer')) {
        $s = (string)\Normalizer::normalize($s, \Normalizer::FORM_KD);
        $s = (string)preg_replace('/\p{Mn}+/u', '', $s);
    }
    $s = (string)preg_replace('/[^\p{L}\p{N}]+/u', ' ', $s);
    return trim($s);
}

function finder_h(string $s): string
{
    return admin_h($s);
}

/** A link to an outside page: escaped, opens in a new tab, sends no referrer. '' when the URL isn't safe. */
function finder_link(string $url, string $text, string $class = ''): string
{
    $u = finder_url($url);
    if ($u === '') {
        return admin_h($text);
    }
    return '<a href="' . admin_h($u) . '"' . ($class !== '' ? ' class="' . admin_h($class) . '"' : '') . ' target="_blank" rel="noopener noreferrer nofollow">'
        . admin_h($text) . '<span class="sr-only"> (opens in a new tab)</span></a>';
}

// ---- data files: JSON under flock, 0600 ----

function finder_data_file(string $name): string
{
    return evo_data_dir() . '/' . $name;
}

/** Reads a JSON file under a shared lock; [] when it's missing or broken. */
function finder_json_read(string $file): array
{
    $fh = @fopen($file, 'r');
    if ($fh === false) {
        return [];
    }
    $raw = flock($fh, LOCK_SH) ? stream_get_contents($fh) : false;
    flock($fh, LOCK_UN);
    fclose($fh);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    return is_array($data) ? $data : [];
}

/**
 * Changes a JSON file under an exclusive lock: $change gets the data and returns [newData, result].
 * The file is created 0600. Returns $change's result, or null when the file couldn't be opened or written.
 */
function finder_json_change(string $file, callable $change)
{
    $old = umask(0077);
    $fh = @fopen($file, 'c+');
    umask($old);
    if ($fh === false) {
        error_log('EvoSoft finder: cannot open ' . basename($file));
        return null;
    }
    @chmod($file, 0600);
    $result = null;
    if (flock($fh, LOCK_EX)) {
        $raw = stream_get_contents($fh);
        $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
        $data = is_array($data) ? $data : [];
        [$new, $result] = $change($data);
        if (is_array($new) && $new !== $data) {
            $json = json_encode($new, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\n";
            ftruncate($fh, 0);
            rewind($fh);
            if (fwrite($fh, $json) !== strlen($json)) {
                error_log('EvoSoft finder: could not write ' . basename($file));
                $result = null;
            }
            fflush($fh);
        }
        flock($fh, LOCK_UN);
    }
    fclose($fh);
    return $result;
}

/** Writes a whole file atomically (temp file + rename), created 0600. */
function finder_write_atomic(string $file, string $data): bool
{
    $tmp = $file . '.' . bin2hex(random_bytes(6)) . '.tmp';
    $old = umask(0077);
    try {
        $ok = @file_put_contents($tmp, $data, LOCK_EX) === strlen($data) && @rename($tmp, $file);
    } finally {
        umask($old);
    }
    if (!$ok) {
        @unlink($tmp);
    }
    return $ok;
}

/** One request at a time per source (Overpass, for one, rejects a duplicate query sent while the first runs). */
function finder_lock(string $name)
{
    $old = umask(0077);
    $fh = @fopen(evo_data_dir() . '/finder-' . $name . '.lock', 'c');
    umask($old);
    if ($fh === false) {
        return true; // can't lock: carry on rather than break the finder
    }
    if (!flock($fh, LOCK_EX | LOCK_NB)) {
        fclose($fh);
        return false;
    }
    return $fh;
}

// ---- daily budgets (finder-usage.json) ----

function finder_today(): string
{
    return gmdate('Y-m-d');
}

/** Today's counters: ['ai' => n, 'overpass' => n, 'overpass_bytes' => n, 'ted' => n, 'upwork' => n]. */
function finder_usage(): array
{
    $u = finder_json_read(finder_data_file('finder-usage.json'));
    $day = is_array($u['days'][finder_today()] ?? null) ? $u['days'][finder_today()] : [];
    $out = [];
    foreach (['ai', 'overpass', 'overpass_bytes', 'ted', 'upwork'] as $k) {
        $out[$k] = (int)($day[$k] ?? 0);
    }
    $out['overpass_pause_until'] = (int)($u['overpass_pause_until'] ?? 0);
    $out['overpass_pause_why'] = is_string($u['overpass_pause_why'] ?? null) ? $u['overpass_pause_why'] : '';
    return $out;
}

/** The limit for a counter. */
function finder_limit(string $source): int
{
    return match ($source) {
        'ai' => finder_cfg()['ai_daily'],
        'overpass' => FINDER_OSM_DAILY,
        'overpass_bytes' => FINDER_OSM_DAILY_BYTES,
        'ted' => FINDER_TED_DAILY,
        'upwork' => FINDER_UPWORK_DAILY,
        default => 0,
    };
}

/**
 * Takes $n from today's budget for $source. False (and nothing taken) when that would go over the limit.
 * With $force the amount is added anyway (bytes, counted after the download).
 */
function finder_usage_take(string $source, int $n = 1, bool $force = false): bool
{
    $limit = finder_limit($source);
    $ok = finder_json_change(finder_data_file('finder-usage.json'), static function (array $u) use ($source, $n, $force, $limit): array {
        $day = finder_today();
        $u['days'] = is_array($u['days'] ?? null) ? $u['days'] : [];
        foreach (array_keys($u['days']) as $d) { // keep a week
            if (!is_string($d) || $d < gmdate('Y-m-d', time() - 7 * 86400)) {
                unset($u['days'][$d]);
            }
        }
        $now = (int)($u['days'][$day][$source] ?? 0);
        if (!$force && $now + $n > $limit) {
            return [$u, false];
        }
        $u['days'][$day][$source] = $now + $n;
        return [$u, true];
    });
    return $ok === true;
}

/** Pauses Overpass for $seconds (after a 429, or a day after a 406), with the reason to show. */
function finder_overpass_pause(int $seconds, string $why): void
{
    finder_json_change(finder_data_file('finder-usage.json'), static function (array $u) use ($seconds, $why): array {
        $u['overpass_pause_until'] = time() + $seconds;
        $u['overpass_pause_why'] = $why;
        return [$u, true];
    });
}

// ---- the 24-hour cache (finder-cache/) ----

function finder_cache_dir(): string
{
    $dir = evo_data_dir() . '/finder-cache';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir;
}

/** The cache file for a key; $source is one of osm, web, ted, upwork. */
function finder_cache_file(string $source, string $key): string
{
    return finder_cache_dir() . '/' . $source . '-' . substr(hash('sha256', $source . '|' . $key), 0, 40) . '.json';
}

/** A cached search by its id ('<source>-<40 hex>'), or null when it's missing or expired (expired files are deleted). */
function finder_cache_get_id(string $id): ?array
{
    if (!preg_match('/^(osm|web|ted|upwork)-[0-9a-f]{40}$/', $id, $m)) {
        return null;
    }
    $file = finder_cache_dir() . '/' . $id . '.json';
    clearstatcache(true, $file);
    if (!is_file($file)) {
        return null;
    }
    $ttl = $m[1] === 'upwork' ? FINDER_UPWORK_CACHE_SECONDS : FINDER_CACHE_SECONDS;
    $entry = finder_json_read($file);
    $at = (int)($entry['at'] ?? 0);
    if ($at <= 0 || $at < time() - $ttl || @filemtime($file) < time() - $ttl) {
        @unlink($file);
        return null;
    }
    if (($entry['enc'] ?? false) === true) {
        $plain = finder_decrypt((string)($entry['data'] ?? ''));
        $data = $plain !== null ? json_decode($plain, true) : null;
        if (!is_array($data)) {
            @unlink($file);
            return null;
        }
        $entry['data'] = $data;
    }
    $entry['id'] = $id;
    return is_array($entry['data'] ?? null) ? $entry : null;
}

function finder_cache_get(string $source, string $key): ?array
{
    $file = finder_cache_file($source, $key);
    return finder_cache_get_id(basename($file, '.json'));
}

/** Stores a search result; returns its id. Upwork content is encrypted. */
function finder_cache_put(string $source, string $key, array $data): string
{
    $file = finder_cache_file($source, $key);
    $entry = ['at' => time(), 'source' => $source, 'enc' => false, 'data' => $data];
    if ($source === 'upwork') {
        $sealed = finder_encrypt(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE));
        if ($sealed === null) {
            return ''; // no key, no cache: Upwork content is never stored in the clear
        }
        $entry['enc'] = true;
        $entry['data'] = $sealed;
    }
    finder_write_atomic($file, json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE));
    return basename($file, '.json');
}

// ---- encryption for Upwork data (key from the settings file, never from the data folder) ----

function finder_crypto_key(): ?string
{
    $secret = finder_cfg()['upwork_client_secret'];
    return $secret !== '' ? hash_hkdf('sha256', $secret, 32, 'evosoft-finder-upwork-v1') : null;
}

function finder_encrypt(string $plain): ?string
{
    $key = finder_crypto_key();
    if ($key === null) {
        return null;
    }
    if (function_exists('sodium_crypto_secretbox')) {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        return 's1:' . base64_encode($nonce . sodium_crypto_secretbox($plain, $nonce, $key));
    }
    $iv = random_bytes(12);
    $tag = '';
    $c = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return $c === false ? null : 'g1:' . base64_encode($iv . $tag . $c);
}

function finder_decrypt(string $sealed): ?string
{
    $key = finder_crypto_key();
    if ($key === null || strlen($sealed) < 4) {
        return null;
    }
    $bin = base64_decode(substr($sealed, 3), true);
    if ($bin === false) {
        return null;
    }
    if (str_starts_with($sealed, 's1:') && function_exists('sodium_crypto_secretbox_open')) {
        if (strlen($bin) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            return null;
        }
        $p = sodium_crypto_secretbox_open(substr($bin, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), substr($bin, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $key);
        return $p === false ? null : $p;
    }
    if (str_starts_with($sealed, 'g1:') && strlen($bin) > 28) {
        $p = openssl_decrypt(substr($bin, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($bin, 0, 12), substr($bin, 12, 16));
        return $p === false ? null : $p;
    }
    return null;
}

// ---- HTTP (curl): no redirects, http(s) only, a size cap, one timeout for the whole call ----

/**
 * @return array{status:int, body:string, headers:array<string,string>, error:string, bytes:int}
 * status 0 = no answer (network error or timeout: see error). The body is cut at $maxBytes (error 'too_large').
 */
function finder_http(string $method, string $url, array $headers, ?string $body, float $timeout, int $maxBytes = 5242880): array
{
    $out = ['status' => 0, 'body' => '', 'headers' => [], 'error' => '', 'bytes' => 0];
    if (!function_exists('curl_init')) {
        $out['error'] = 'curl_missing';
        return $out;
    }
    $buf = '';
    $tooLarge = false;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_CONNECTTIMEOUT => (int)max(2, min(10, $timeout)),
        CURLOPT_TIMEOUT => (int)max(2, ceil($timeout)),
        CURLOPT_ENCODING => '', // gzip, deflate: the Overpass manual asks for it
        CURLOPT_USERAGENT => finder_cfg()['user_agent'],
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$out): int {
            $p = strpos($line, ':');
            if ($p !== false) {
                $out['headers'][strtolower(trim(substr($line, 0, $p)))] = trim(substr($line, $p + 1));
            }
            return strlen($line);
        },
        CURLOPT_WRITEFUNCTION => static function ($ch, string $chunk) use (&$buf, &$tooLarge, $maxBytes): int {
            if (strlen($buf) + strlen($chunk) > $maxBytes) {
                $tooLarge = true;
                return 0; // stops the download
            }
            $buf .= $chunk;
            return strlen($chunk);
        },
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $ok = curl_exec($ch);
    $out['status'] = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $out['bytes'] = (int)curl_getinfo($ch, CURLINFO_SIZE_DOWNLOAD);
    if ($tooLarge) {
        $out['error'] = 'too_large';
    } elseif ($ok === false) {
        $out['error'] = curl_errno($ch) === CURLE_OPERATION_TIMEDOUT ? 'timeout' : 'network';
        $out['status'] = 0;
    }
    curl_close($ch);
    $out['body'] = $buf;
    return $out;
}

/** Time left before $deadline (microtime), in seconds. */
function finder_left(float $deadline): float
{
    return $deadline - microtime(true);
}

/** Lets a long step run (and frees the session so other pages of the panel keep working meanwhile). */
function finder_long_request(int $seconds): void
{
    @set_time_limit($seconds);
    ignore_user_abort(false);
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
}

/** A JSON error for scripts: ['error' => message] plus extra fields. */
function finder_fail(string $message, int $code = 400, array $extra = []): never
{
    admin_json(['ok' => false, 'error' => $message] + $extra, $code);
}

/** "3 minutes ago" style text for a timestamp (UTC). */
function finder_ago(int $ts): string
{
    $d = time() - $ts;
    if ($d < 90) {
        return 'just now';
    }
    if ($d < 5400) {
        return (int)round($d / 60) . ' minutes ago';
    }
    if ($d < 129600) {
        return (int)round($d / 3600) . ' hours ago';
    }
    return (int)round($d / 86400) . ' days ago';
}
