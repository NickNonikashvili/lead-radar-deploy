<?php
/*
 * EvoSoft website: shared helpers for api/chat.php and api/quote.php.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

const EVO_DATA_DIR = __DIR__ . '/data';

/**
 * Settings, from (first match wins per key):
 *   1. environment variables (ANTHROPIC_API_KEY, EVOSOFT_CHAT_MODEL, EVOSOFT_QUOTE_TO, EVOSOFT_MAIL_FROM)
 *   2. evosoft-config.php two folders above this one (outside public_html on Hostinger/cPanel) — recommended
 *   3. api/config.php next to this file (blocked from the web by api/.htaccess)
 * See api/config.example.php for every setting.
 */
function evo_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $cfg = [
        'anthropic_api_key' => '',
        'anthropic_base_url' => null,      // only for local testing
        'chat_model' => 'claude-opus-5-5',
        'chat_effort' => 'low',
        'chat_max_tokens' => 2048,
        'chat_per_ip_10min' => 20,
        'chat_per_ip_day' => 120,
        'chat_global_day' => 2000,         // hard cap on assistant replies per day, to bound spend
        'quote_to' => 'contact@evosoft.solutions',
        'mail_from' => '',                 // e.g. no-reply@evosoft.solutions; default no-reply@<this host>
        'mail_mode' => 'mail',             // 'mail' = PHP mail(), 'log' = only save to api/data (testing)
        'quote_per_ip_hour' => 5,
        'trust_proxy_header' => '',        // e.g. 'HTTP_CF_CONNECTING_IP' behind Cloudflare
    ];
    $files = [dirname(__DIR__, 2) . '/evosoft-config.php', __DIR__ . '/config.php'];
    foreach ($files as $file) {
        if (is_file($file)) {
            $loaded = require $file;
            if (is_array($loaded)) {
                $cfg = array_merge($cfg, $loaded);
            }
            break;
        }
    }
    $env = [
        'ANTHROPIC_API_KEY' => 'anthropic_api_key',
        'EVOSOFT_CHAT_MODEL' => 'chat_model',
        'EVOSOFT_QUOTE_TO' => 'quote_to',
        'EVOSOFT_MAIL_FROM' => 'mail_from',
    ];
    foreach ($env as $var => $key) {
        $v = getenv($var);
        if (is_string($v) && $v !== '') {
            $cfg[$key] = $v;
        }
    }
    return $cfg;
}

function evo_json(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** Only POST with a JSON body, and only from pages on this same site. */
function evo_read_request(int $maxBytes = 32000): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['health'])) {
        return ['__health' => true];
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        evo_json(['error' => 'method_not_allowed'], 405);
    }
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '' && strtolower((string)parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '')) !== $host) {
        evo_json(['error' => 'forbidden'], 403);
    }
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) {
        evo_json(['error' => 'too_large'], 413);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        evo_json(['error' => 'bad_request'], 400);
    }
    return $data;
}

function evo_client_ip(): string
{
    $header = (string)(evo_config()['trust_proxy_header'] ?? '');
    $ip = $header !== '' ? (string)($_SERVER[$header] ?? '') : '';
    if ($ip === '' || filter_var(trim(explode(',', $ip)[0]), FILTER_VALIDATE_IP) === false) {
        $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }
    return trim(explode(',', $ip)[0]);
}

function evo_data_dir(): string
{
    if (!is_dir(EVO_DATA_DIR)) {
        @mkdir(EVO_DATA_DIR, 0700, true);
    }
    if (!is_file(EVO_DATA_DIR . '/.htaccess')) {
        @file_put_contents(EVO_DATA_DIR . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    }
    return EVO_DATA_DIR;
}

/**
 * Fixed-window counter stored in api/data. Returns false when the limit is reached.
 * $key is hashed, so no IP addresses are written to disk.
 */
function evo_rate_ok(string $bucket, string $key, int $limit, int $windowSeconds): bool
{
    if ($limit <= 0) {
        return true;
    }
    $dir = evo_data_dir() . '/limits';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $window = intdiv(time(), $windowSeconds);
    $file = $dir . '/' . $bucket . '-' . substr(hash('sha256', $key . '|' . $window . '|' . __DIR__), 0, 24);
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return true; // fail open rather than break the site if the folder is not writable
    }
    flock($fh, LOCK_EX);
    $count = (int)stream_get_contents($fh);
    $ok = $count < $limit;
    if ($ok) {
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, (string)($count + 1));
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    // Tidy up old windows now and then.
    if (random_int(1, 200) === 1) {
        foreach (glob($dir . '/*') ?: [] as $old) {
            if (filemtime($old) < time() - 2 * 86400) {
                @unlink($old);
            }
        }
    }
    return $ok;
}

function evo_clean_line(string $s, int $max): string
{
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

function evo_clean_text(string $s, int $max): string
{
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}
