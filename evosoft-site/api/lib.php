<?php
/*
 * EvoSoft website: shared helpers for api/chat.php and api/quote.php.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

const EVO_DATA_DIR = __DIR__ . '/data'; // the old place for saved data; see evo_data_dir()

/**
 * Settings, from (first match wins per key):
 *   1. environment variables (ANTHROPIC_API_KEY, EVOSOFT_CHAT_MODEL, EVOSOFT_QUOTE_TO, EVOSOFT_MAIL_FROM,
 *      EVOSOFT_SMTP_HOST, EVOSOFT_SMTP_PORT, EVOSOFT_SMTP_USER, EVOSOFT_SMTP_PASS)
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
        'mail_mode' => 'mail',             // 'mail' = send (SMTP when smtp_pass is set, else PHP mail()), 'log' = only save (testing)
        'smtp_host' => 'smtp.hostinger.com',
        'smtp_port' => 465,
        'smtp_secure' => null,             // 'ssl', 'tls' (STARTTLS) or '' (none, local tests only); null = 'ssl' on port 465, else 'tls'
        'smtp_user' => '',                 // the full mailbox address; '' = quote_to
        'smtp_pass' => '',                 // the mailbox password; without it, PHP mail() is used
        'mail_from' => '',                 // sender for PHP mail(), a real mailbox on the domain; '' = quote_to
        'quote_per_ip_hour' => 5,
        'quote_keep_months' => 12,         // quote requests older than this are deleted from the data folder (0 = keep)
        'trust_proxy_header' => '',        // e.g. 'HTTP_CF_CONNECTING_IP' behind Cloudflare
        'admin_password_hash' => '',       // the admin panel (/admin/) stays locked until this is set; /admin/ shows how
        'admin_totp_secret' => '',         // optional second factor (base32), for an authenticator app
        'admin_session_minutes' => 30,     // signed out after this long without using the panel (at most 12 hours in all)
        'admin_require_https' => true,     // the panel refuses plain http:// (except on this computer, for testing)
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
        'EVOSOFT_SMTP_HOST' => 'smtp_host',
        'EVOSOFT_SMTP_PORT' => 'smtp_port',
        'EVOSOFT_SMTP_USER' => 'smtp_user',
        'EVOSOFT_SMTP_PASS' => 'smtp_pass',
    ];
    foreach ($env as $var => $key) {
        $v = getenv($var);
        if (is_string($v) && $v !== '') {
            $cfg[$key] = $v;
        }
    }
    $cfg['smtp_port'] = (int)$cfg['smtp_port'];
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

/**
 * The folder for saved quote requests, the mail status and the rate-limit counters.
 * Preferred: evosoft-data next to public_html (two folders above this one), so replacing or deleting the site's files
 * never touches it. If it can't be created there, api/data is used instead.
 */
function evo_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $outside = dirname(__DIR__, 2) . '/evosoft-data';
    if (!@is_dir($outside) && @is_writable(dirname($outside))) {
        @mkdir($outside, 0700);
    }
    if (@is_dir($outside) && @is_writable($outside)) {
        $dir = $outside;
        evo_move_old_quotes($dir);
    } else {
        if (!is_dir(EVO_DATA_DIR)) {
            @mkdir(EVO_DATA_DIR, 0700, true);
        }
        $dir = EVO_DATA_DIR;
    }
    evo_deny_web($dir); // evosoft-data is normally out of the web's reach anyway; this covers a site in a subfolder
    return $dir;
}

function evo_deny_web(string $dir): void
{
    if (!is_file($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    }
}

/** Requests saved by older versions in api/data/quotes.jsonl are added to the new file once, then the old copy is deleted. */
function evo_move_old_quotes(string $dir): void
{
    $old = EVO_DATA_DIR . '/quotes.jsonl';
    if (!@is_file($old)) {
        return;
    }
    $moved = $old . '.moved';
    if (@file_exists($moved)) {
        $moved .= '-' . gmdate('Ymd-His');
    }
    // Rename first: only one request can win it, so the old requests are never copied twice.
    if (!@rename($old, $moved)) {
        return;
    }
    evo_deny_web(EVO_DATA_DIR);
    $data = @file_get_contents($moved);
    if (!is_string($data) || trim($data) === '') {
        return;
    }
    if (!str_ends_with($data, "\n")) {
        $data .= "\n";
    }
    if (@file_put_contents($dir . '/quotes.jsonl', $data, FILE_APPEND | LOCK_EX) !== strlen($data)) {
        error_log("EvoSoft: could not copy the old quote requests into $dir/quotes.jsonl; they are still in $moved");
        return;
    }
    @unlink($moved); // no second copy: the privacy policy promises one copy, deleted on schedule
}

/**
 * The key that scrambles IP addresses in the rate-limit counters. A new random one is made each UTC day and deleted
 * two days later (evo_housekeeping), so once it's gone nobody, including us, can tell which address a counter was for.
 * Every rate-limit window (10 minutes, 1 hour, 1 day) falls inside one UTC day, so counting still works.
 */
function evo_day_salt(string $dir): string
{
    $file = $dir . '/.salt-' . gmdate('Ymd');
    $salt = @file_get_contents($file);
    if (is_string($salt) && strlen($salt) === 64) {
        return $salt;
    }
    $new = bin2hex(random_bytes(32));
    $fh = @fopen($file, 'x'); // only the first request of the day creates it
    if ($fh !== false) {
        fwrite($fh, $new);
        fclose($fh);
        return $new;
    }
    usleep(20000);
    $salt = @file_get_contents($file);
    return is_string($salt) && strlen($salt) === 64 ? $salt : $new;
}

/**
 * Deletes what the privacy policy says we don't keep, at most once an hour (api/quote.php and api/chat.php call it,
 * and so does api/housekeeping.php, which a daily cron job runs so it happens on quiet days too):
 *   - rate-limit counters and daily keys older than two days;
 *   - quote requests older than quote_keep_months (the email copy is deleted by hand on the same schedule);
 *   - any leftover quotes.jsonl.moved copy from an old version that is past the same age;
 *   - the admin panel's status and notes (quote-meta.json) for requests that no longer exist;
 *   - admin sign-in sessions past their 12-hour limit (PHP's own clean-up is often off on shared hosts);
 *   - the client finder's old leads and expired search cache (evo_finder_housekeeping, below).
 * The quotes file is rewritten in place under the same lock quote.php appends with, so no request is ever lost.
 */
function evo_housekeeping(array $cfg, bool $force = false): void
{
    $dir = evo_data_dir();
    $stamp = $dir . '/housekeeping-stamp';
    clearstatcache();
    if (!$force && @is_file($stamp) && @filemtime($stamp) > time() - 3600) {
        return;
    }
    @touch($stamp);
    $limits = $dir . '/limits';
    // Every rate-limit window ends with its UTC day and each day has its own key, so anything older than a day is no
    // longer used. With api/housekeeping.php run daily (README), nothing here lives longer than two days.
    $old = time() - 86400;
    $files = array_merge(glob($limits . '/*') ?: [], glob($limits . '/.salt-*') ?: []);
    if ($dir !== EVO_DATA_DIR) { // DT-2: counters the first version left in api/data/limits
        $files = array_merge($files, glob(EVO_DATA_DIR . '/limits/*') ?: []);
    }
    foreach ($files as $f) {
        if (@filemtime($f) < $old) {
            @unlink($f);
        }
    }
    // admin sessions: idle ones end after admin_session_minutes, and every one after 12 hours
    foreach (glob($dir . '/sessions/sess_*') ?: [] as $f) {
        if (@filemtime($f) < time() - 13 * 3600) {
            @unlink($f);
        }
    }
    $months = (int)($cfg['quote_keep_months'] ?? 0);
    $cutoff = $months > 0 ? gmdate('Y-m-d H:i', strtotime("-$months months")) : '';
    $file = $dir . '/quotes.jsonl';
    if (@is_file($file) && ($fh = @fopen($file, 'c+')) !== false) {
        if (flock($fh, LOCK_EX)) {
            $keep = '';
            $dropped = 0;
            $ids = [];
            while (($line = fgets($fh)) !== false) {
                $q = json_decode($line, true);
                $when = is_array($q) && is_string($q['when'] ?? null) ? substr($q['when'], 0, 16) : '';
                // keep anything it can't date, rather than guess
                if ($cutoff !== '' && $when !== '' && preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $when) && strcmp($when, $cutoff) < 0) {
                    $dropped++;
                    continue;
                }
                $keep .= $line;
                if (is_array($q)) {
                    $ids[evo_quote_id($q, $line)] = true;
                }
            }
            if ($dropped) {
                ftruncate($fh, 0);
                rewind($fh);
                fwrite($fh, $keep);
                fflush($fh);
            }
            // still holding the requests' lock, so no request can be added or deleted meanwhile
            evo_quote_meta_change(static function (array $meta) use ($ids): array {
                return array_intersect_key($meta, $ids);
            });
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    } elseif (!@is_file($file) && @is_file($dir . '/quote-meta.json')) {
        evo_quote_meta_change(static fn(array $meta): array => []);
    }
    if ($months > 0) {
        foreach (glob(EVO_DATA_DIR . '/quotes.jsonl.moved*') ?: [] as $f) {
            if (@filemtime($f) < strtotime("-$months months")) {
                @unlink($f);
            }
        }
    }
    evo_finder_housekeeping($dir, $cfg);
}

/**
 * The admin panel's client finder (admin/inc/finder.php), part of the hourly clean-up above:
 *   - saved leads found more than leads_keep_months ago (default 6; 0 = keep), unless their status is "won";
 *   - cached search results past their time: Upwork content after 1 hour (Upwork allows 24 at most, and the daily
 *     cron makes sure of that on quiet days), everything else after 24 hours; and any left-over temporary files;
 *   - usage counters older than a week.
 * The do-not-contact list (leads-suppressed.json) is kept: it holds only hashes, so those businesses never come back.
 */
function evo_finder_housekeeping(string $dir, array $cfg): void
{
    $now = time();
    foreach (glob($dir . '/finder-cache/*.json') ?: [] as $f) {
        $ttl = str_starts_with(basename($f), 'upwork-') ? 3600 : 86400;
        if (@filemtime($f) < $now - $ttl) {
            @unlink($f);
        }
    }
    foreach (array_merge(glob($dir . '/finder-cache/*.tmp') ?: [], glob($dir . '/*.json.*.tmp') ?: []) as $f) {
        if (@filemtime($f) < $now - 3600) {
            @unlink($f);
        }
    }
    $months = (int)($cfg['leads_keep_months'] ?? 6);
    $file = $dir . '/leads.json';
    if ($months > 0 && @is_file($file) && ($fh = @fopen($file, 'c+')) !== false) {
        $cutoff = gmdate('Y-m-d\TH:i:s\Z', (int)strtotime("-$months months", $now));
        if (flock($fh, LOCK_EX)) {
            $data = json_decode((string)stream_get_contents($fh), true);
            if (is_array($data) && is_array($data['leads'] ?? null)) {
                $keep = array_values(array_filter($data['leads'], static function ($l) use ($cutoff): bool {
                    $found = is_array($l) && is_string($l['found_at'] ?? null) ? $l['found_at'] : '';
                    // keep a lead that was won, or that can't be dated (rather than guess)
                    return !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $found) || strcmp($found, $cutoff) >= 0 || ($l['status'] ?? '') === 'won';
                }));
                if (count($keep) !== count($data['leads'])) {
                    $data['leads'] = $keep;
                    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\n";
                    ftruncate($fh, 0);
                    rewind($fh);
                    fwrite($fh, $json);
                    fflush($fh);
                }
            }
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    }
    $usage = $dir . '/finder-usage.json';
    if (@is_file($usage) && ($fh = @fopen($usage, 'c+')) !== false) {
        if (flock($fh, LOCK_EX)) {
            $u = json_decode((string)stream_get_contents($fh), true);
            if (is_array($u) && is_array($u['days'] ?? null)) {
                $week = gmdate('Y-m-d', $now - 7 * 86400);
                $days = array_filter($u['days'], static fn($k): bool => is_string($k) && $k >= $week, ARRAY_FILTER_USE_KEY);
                if (count($days) !== count($u['days'])) {
                    $u['days'] = $days;
                    $json = json_encode($u, JSON_UNESCAPED_SLASHES) . "\n";
                    ftruncate($fh, 0);
                    rewind($fh);
                    fwrite($fh, $json);
                    fflush($fh);
                }
            }
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    }
}

/**
 * Fixed-window counter stored in the data folder. Returns false when the limit is reached.
 * $key is hashed with the day's key (evo_day_salt), so no IP addresses are written to disk.
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
    $file = $dir . '/' . $bucket . '-' . substr(hash('sha256', $key . '|' . $window . '|' . evo_day_salt($dir)), 0, 24);
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
    return $ok; // old counters are deleted by evo_housekeeping()
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

// ---- email (used by quote.php) ----

/** How emails go out: 'smtp' (smtp_pass is set and PHPMailer is installed), 'mail' (PHP mail()) or 'log' (not sent). */
function evo_mail_method(array $cfg): string
{
    if (($cfg['mail_mode'] ?? 'mail') === 'log') {
        return 'log';
    }
    return (string)$cfg['smtp_pass'] !== '' && evo_phpmailer_loaded() ? 'smtp' : 'mail';
}

/**
 * Loads PHPMailer's own files rather than vendor/autoload.php: Composer's autoloader also checks the PHP version the
 * chat's libraries need, and stops the whole request when it's too old. The quote form shouldn't depend on that.
 */
function evo_phpmailer_loaded(): bool
{
    if (!class_exists(\PHPMailer\PHPMailer\PHPMailer::class, false)) {
        $src = __DIR__ . '/vendor/phpmailer/phpmailer/src/';
        if (!is_file($src . 'PHPMailer.php')) {
            return false;
        }
        require_once $src . 'Exception.php';
        require_once $src . 'SMTP.php';
        require_once $src . 'PHPMailer.php';
    }
    return true;
}

/** Valid addresses from a comma- or semicolon-separated list. */
function evo_addresses(string $list): array
{
    $out = [];
    foreach (preg_split('/[,;]/', $list) ?: [] as $a) {
        $a = trim($a);
        if ($a !== '' && filter_var($a, FILTER_VALIDATE_EMAIL) !== false) {
            $out[] = $a;
        }
    }
    return $out;
}

/**
 * Emails $m (subject, html, text, reply_email, reply_name) to quote_to. Returns the method used, 'smtp' or 'mail'.
 * Throws RuntimeException with a short reason (never a password) when it can't be sent.
 */
function evo_send_mail(array $cfg, array $m): string
{
    $to = evo_addresses((string)$cfg['quote_to']);
    if (!$to) {
        throw new RuntimeException('quote_to is not a valid email address');
    }
    if (evo_mail_method($cfg) === 'smtp') {
        evo_send_smtp($cfg, $to, $m);
        return 'smtp';
    }
    if ((string)$cfg['smtp_pass'] !== '') {
        error_log('EvoSoft mail: smtp_pass is set but PHPMailer is missing (run composer install in api/); using PHP mail() instead.');
    }
    evo_send_phpmail($cfg, $to, $m);
    return 'mail';
}

/** Signs in to the mailbox and sends from it, as Hostinger (and most providers) require. */
function evo_send_smtp(array $cfg, array $to, array $m): void
{
    if (!evo_phpmailer_loaded()) {
        throw new RuntimeException('PHPMailer is not installed (run composer install in api/)');
    }
    $user = trim((string)$cfg['smtp_user']) !== '' ? trim((string)$cfg['smtp_user']) : $to[0];
    $pass = (string)$cfg['smtp_pass'];
    $from = filter_var($user, FILTER_VALIDATE_EMAIL) !== false ? $user : (evo_addresses((string)$cfg['mail_from'])[0] ?? $to[0]);
    $port = (int)$cfg['smtp_port'];
    $secure = is_string($cfg['smtp_secure'] ?? null) ? strtolower(trim($cfg['smtp_secure'])) : null;
    $secure = in_array($secure, ['ssl', 'tls', ''], true) ? $secure : ($port === 465 ? 'ssl' : 'tls');

    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = trim((string)$cfg['smtp_host']);
        $mail->Port = $port;
        $mail->SMTPSecure = $secure;   // 'ssl' = PHPMailer::ENCRYPTION_SMTPS, 'tls' = ENCRYPTION_STARTTLS
        $mail->SMTPAutoTLS = $secure !== '';
        $mail->SMTPAuth = true;
        $mail->Username = $user;
        $mail->Password = $pass;
        $mail->Timeout = 15;                         // connecting
        $mail->getSMTPInstance()->Timelimit = 15;    // waiting for each server reply
        $mail->CharSet = \PHPMailer\PHPMailer\PHPMailer::CHARSET_UTF8;
        $mail->Encoding = \PHPMailer\PHPMailer\PHPMailer::ENCODING_QUOTED_PRINTABLE;
        $mail->XMailer = ' ';                        // no X-Mailer header
        $mail->MessageID = evo_message_id($from);
        $mail->setFrom($from, 'EvoSoft website');
        foreach ($to as $a) {
            $mail->addAddress($a);
        }
        $mail->addReplyTo((string)$m['reply_email'], (string)$m['reply_name']);
        $mail->Subject = (string)$m['subject'];
        $mail->isHTML(true);
        $mail->Body = evo_crlf((string)$m['html']);   // PHPMailer would otherwise encode bare LFs as =0A
        $mail->AltBody = evo_crlf((string)$m['text']);
        $mail->send();
    } catch (\PHPMailer\PHPMailer\Exception $e) {
        $why = $mail->ErrorInfo !== '' ? $mail->ErrorInfo : $e->getMessage();
        throw new RuntimeException(evo_short_error("SMTP {$mail->Host}:$port: $why", [$pass, base64_encode($pass), base64_encode("\0$user\0$pass")]));
    }
}

/** PHP mail(), sending from mail_from (or quote_to): an existing mailbox, also passed to sendmail as -f. */
function evo_send_phpmail(array $cfg, array $to, array $m): void
{
    $from = evo_addresses((string)$cfg['mail_from'])[0] ?? $to[0];
    $boundary = '=_evo_' . bin2hex(random_bytes(12));
    $headers = [
        'From: ' . evo_mail_address($from, 'EvoSoft website'),
        'Reply-To: ' . evo_mail_address((string)$m['reply_email'], (string)$m['reply_name']),
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: ' . evo_message_id($from),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ];
    $body = "This is a multi-part message in MIME format.\r\n\r\n";
    foreach (['plain' => (string)$m['text'], 'html' => (string)$m['html']] as $type => $content) {
        $body .= "--$boundary\r\nContent-Type: text/$type; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
            . quoted_printable_encode(evo_crlf($content)) . "\r\n";
    }
    $body .= "--$boundary--\r\n";
    // Only plain addresses go on the sendmail command line.
    $params = preg_match('/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/', $from) ? '-f' . $from : '';
    error_clear_last();
    if (!@mail(implode(', ', $to), evo_mime_words((string)$m['subject']), $body, implode("\r\n", $headers), $params)) {
        $err = error_get_last()['message'] ?? '';
        throw new RuntimeException(evo_short_error('PHP mail() failed' . ($err !== '' ? ": $err" : ' (the server refused it)')));
    }
}

/** "Name" <address>, with the name MIME-encoded when it isn't plain ASCII. Line breaks can't get through. */
function evo_mail_address(string $email, string $name): string
{
    $email = evo_clean_line($email, 254);
    $name = evo_clean_line($name, 200);
    if ($name === '') {
        return $email;
    }
    if (!preg_match('/[^\x20-\x7E]/', $name)) {
        return '"' . addcslashes($name, '"\\') . '" <' . $email . '>';
    }
    return evo_mime_words($name) . ' <' . $email . '>';
}

/** RFC 2047 encoded words (UTF-8, base64) for header text that isn't plain ASCII; whole characters per word. */
function evo_mime_words(string $s): string
{
    $s = evo_clean_line($s, 998);
    if (!preg_match('/[^\x20-\x7E]/', $s)) {
        return $s;
    }
    $words = [];
    $chunk = '';
    foreach (mb_str_split($s, 1, 'UTF-8') as $ch) {
        if (strlen($chunk) + strlen($ch) > 45) {
            $words[] = $chunk;
            $chunk = '';
        }
        $chunk .= $ch;
    }
    $words[] = $chunk;
    return implode("\r\n ", array_map(static fn(string $w): string => '=?UTF-8?B?' . base64_encode($w) . '?=', $words));
}

function evo_crlf(string $s): string
{
    return str_replace("\n", "\r\n", str_replace(["\r\n", "\r"], "\n", $s));
}

function evo_message_id(string $from): string
{
    $domain = preg_replace('/[^a-z0-9.-]/i', '', substr((string)strrchr($from, '@'), 1)) ?: 'evosoft.solutions';
    return '<' . bin2hex(random_bytes(16)) . '@' . $domain . '>';
}

/** One line, at most 300 characters, with any of $secrets blanked out. */
function evo_short_error(string $s, array $secrets = []): string
{
    foreach ($secrets as $secret) {
        if ($secret !== '') {
            $s = str_replace($secret, '***', $s);
        }
    }
    return evo_clean_line($s, 300);
}

/** mail-status.json in the data folder: how the last send went (for ?health=1 and for the owner). */
function evo_mail_status_write(bool $ok, string $via, string $error = ''): void
{
    $status = ['last' => $ok ? 'ok' : 'failed', 'when' => gmdate('Y-m-d H:i:s') . ' UTC', 'via' => $via, 'error' => $ok ? '' : $error];
    @file_put_contents(evo_data_dir() . '/mail-status.json', json_encode($status, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n", LOCK_EX);
}

/** 'ok', 'failed' or 'never'. */
function evo_mail_last(): string
{
    $raw = @file_get_contents(evo_data_dir() . '/mail-status.json');
    $status = is_string($raw) ? json_decode($raw, true) : null;
    $last = is_array($status) ? ($status['last'] ?? '') : '';
    return $last === 'ok' || $last === 'failed' ? $last : 'never';
}

// ---- the quote builder (/estimate): prices, the design a visitor builds, and its estimate ----
// The same rules as evosoft-site/assets/js/estimate.js; both follow site-builder/data/pricing.mjs, which the build
// writes to api/pricing.json (blocked from the web by api/.htaccess). Change a rule in both places.

const EVO_SITE_URL = 'https://evosoft.solutions';

/** The prices (api/pricing.json, written by the build), or [] when the file is missing or broken. */
function evo_pricing(): array
{
    static $pricing = null;
    if ($pricing === null) {
        $raw = @file_get_contents(__DIR__ . '/pricing.json');
        $data = is_string($raw) ? json_decode($raw, true) : null;
        $ok = is_array($data) && is_array($data['types'] ?? null) && $data['types'] !== [] && is_array($data['features'] ?? null)
            && is_array($data['pages'] ?? null) && is_array($data['range'] ?? null);
        $pricing = $ok ? $data : [];
    }
    return $pricing;
}

/** Rounds halves up, like estimate.js (Math.floor(x + 0.5)); PHP's own round() pre-rounds and can differ by 1. */
function evo_round_half_up(float $x): int
{
    return (int)floor($x + 0.5);
}

/** A product snapped to 6 decimals, so 1724.9999999999998 counts as the 1725 it really is (snap() in estimate.js). */
function evo_snap(float $x): float
{
    return floor($x * 1e6 + 0.5) / 1e6;
}

/**
 * The characters JavaScript's \s and String.prototype.trim() treat as white space, spelled out: PCRE's own \s differs
 * (it takes U+0085 and, depending on its version, not U+FEFF), and estimate.js must clean text exactly as this file does.
 */
const EVO_JS_SPACE = '\x{0009}-\x{000D}\x{0020}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';

/** trim() as JavaScript does it (see EVO_JS_SPACE). */
function evo_js_trim(string $s): string
{
    return (string)preg_replace('/^[' . EVO_JS_SPACE . ']+|[' . EVO_JS_SPACE . ']+$/u', '', $s);
}

/** Text for a design field, as estimate.js cleans it: control characters and runs of spaces become one space, cut. */
function evo_design_text($v, int $max): string
{
    if (!is_string($v)) {
        return '';
    }
    $v = (string)preg_replace('/[\x00-\x1F\x7F]/u', ' ', $v);
    $v = (string)preg_replace('/[' . EVO_JS_SPACE . ']+/u', ' ', $v);
    return evo_js_trim(mb_substr(evo_js_trim($v), 0, $max));
}

/**
 * A number from a design: a JSON number, or a plain decimal number written as text (estimate.js uses the same pattern
 * on the same trimmed text: no hex, no "Infinity", ASCII digits only). NAN when it is neither.
 */
function evo_design_number($v): float
{
    if (is_int($v) || is_float($v)) {
        return (float)$v;
    }
    if (is_string($v)) {
        $t = evo_js_trim($v);
        if (preg_match('/^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$/', $t)) {
            return (float)$t;
        }
    }
    return NAN;
}

/**
 * The design config the /estimate page builds, made safe: unknown keys and values are dropped, numbers are clamped,
 * "home" is always a page, lists keep the order of pricing.json. Never rejects: anything unusable becomes the default.
 * Returns [] only when the prices are missing.
 */
function evo_normalise_design(array $d, ?array $pricing = null): array
{
    $p = $pricing ?? evo_pricing();
    if ($p === []) {
        return [];
    }
    $pick = static function ($v, array $allowed, string $default): string {
        $allowed = array_values(array_map('strval', $allowed));
        if (is_string($v) && in_array($v, $allowed, true)) {
            return $v;
        }
        return in_array($default, $allowed, true) ? $default : ($allowed[0] ?? '');
    };
    $int = static function ($v, int $min, int $max, int $default): int { // clamp first, then drop the fraction
        $n = evo_design_number($v);
        return is_finite($n) ? (int)max($min, min($max, $n)) : $default;
    };
    $yes = static fn($v): bool => $v === true;
    $set = static function ($v, array $allowed): array { // the allowed ones, once each, in the order of $allowed
        $given = is_array($v) ? array_filter($v, 'is_string') : [];
        return array_values(array_filter($allowed, static fn($a): bool => in_array($a, $given, true)));
    };
    $obj = static fn($v): array => is_array($v) ? $v : [];

    $types = array_map('strval', array_keys($p['types']));
    $type = $pick($d['type'] ?? null, $types, 'business');
    $business = $obj($d['business'] ?? null);
    $look = $obj($d['look'] ?? null);
    $content = $obj($d['content'] ?? null);
    $accent = is_string($look['accent'] ?? null) && preg_match('/^#[0-9a-fA-F]{6}$/', $look['accent']) ? strtolower($look['accent']) : '#ff6b5b';

    $pages = array_merge(['home'], $set($d['pages'] ?? null, array_values(array_diff(array_map('strval', $p['pages']), ['home']))));
    $features = $set($d['features'] ?? null, array_map('strval', array_keys($p['features'])));
    $multi = in_array('multilingual', $features, true);
    return [
        'v' => 1,
        'type' => $type,
        'business' => [
            'name' => evo_design_text($business['name'] ?? null, 60),
            'industry' => $pick($business['industry'] ?? null, (array)($p['industries'] ?? ['other']), 'other'),
            'tagline' => evo_design_text($business['tagline'] ?? null, 120),
        ],
        'look' => [
            'palette' => $pick($look['palette'] ?? null, (array)($p['palettes'] ?? ['navy']), 'navy'),
            'accent' => $accent,
            'font' => $pick($look['font'] ?? null, (array)($p['fonts'] ?? ['modern']), 'modern'),
            'layout' => $pick($look['layout'] ?? null, (array)($p['layouts'] ?? ['clean']), 'clean'),
            'mode' => $pick($look['mode'] ?? null, (array)($p['modes'] ?? ['light']), 'light'),
        ],
        'pages' => $pages,
        'extraPages' => $int($d['extraPages'] ?? 0, 0, (int)($p['maxExtraPages'] ?? 0), 0),
        'features' => $features,
        'languages' => $multi ? $int($d['languages'] ?? null, 1, max(1, (int)($p['maxLanguages'] ?? 1)), 1) : 1,
        'products' => $type === 'store' ? $pick($d['products'] ?? null, array_map('strval', array_keys((array)($p['products'] ?? []))), 'small') : 'small',
        'content' => [
            'copywriting' => $yes($content['copywriting'] ?? false),
            'logo' => $yes($content['logo'] ?? false),
            'photos' => $yes($content['photos'] ?? false),
        ],
        'care' => $pick($d['care'] ?? null, array_map('strval', array_keys((array)($p['care'] ?? []))), 'none'),
        'timeline' => $pick($d['timeline'] ?? null, array_map('strval', array_keys((array)($p['timeline'] ?? []))), 'standard'),
    ];
}

/**
 * The estimate for a design, by the rules in site-builder/data/pricing.mjs (the same as estimate() in
 * assets/js/estimate.js). Every amount is a whole number of dollars (halves up) before the lines are summed.
 * Products that feed a rounding (the rush total, the range, rush weeks) are first snapped to 6 decimals (evo_snap).
 * Returns { currency, total, low, high, monthly, weeks: [min, max], pages, extraPages, lines: [{key, amount, qty?}] },
 * or [] when the prices are missing.
 */
function evo_estimate(array $design, array $pricing): array
{
    $d = evo_normalise_design($design, $pricing);
    if ($d === []) {
        return [];
    }
    $p = $pricing;
    $type = $d['type'];
    $t = $p['types'][$type];
    $lines = [['key' => 'base', 'amount' => evo_round_half_up((float)$t['base'])]];

    // 2. pages: those picked plus extra ones; beyond what the type includes, each costs extraPage
    $pages = count($d['pages']) + $d['extraPages'];
    $extra = max(0, $pages - (int)$t['pages']);
    $amount = evo_round_half_up($extra * (float)$t['extraPage']);
    if ($extra > 0 && $amount > 0) { // no row when extra pages cost nothing, as in estimate.js
        $lines[] = ['key' => 'extraPages', 'amount' => $amount, 'qty' => $extra];
    }
    // 3. features (included ones and multilingual with one language cost nothing and get no line)
    $paid = 0;
    foreach ($d['features'] as $f) {
        $fp = $p['features'][$f];
        if (in_array($type, (array)($fp['includedIn'] ?? []), true)) {
            continue;
        }
        $qty = $f === 'multilingual' ? $d['languages'] - 1 : null;
        $raw = (float)$fp['price'] * ($qty ?? 1);
        if ($raw <= 0) {
            continue;
        }
        $paid++; // counts for the weeks even if it rounds to nothing, as in estimate.js
        $amount = evo_round_half_up($raw);
        if ($amount > 0) {
            $lines[] = $qty === null ? ['key' => "feature:$f", 'amount' => $amount] : ['key' => "feature:$f", 'amount' => $amount, 'qty' => $qty];
        }
    }
    // 4. a store's product count
    if ($type === 'store') {
        $amount = evo_round_half_up((float)($p['products'][$d['products']]['price'] ?? 0));
        if ($amount > 0) {
            $lines[] = ['key' => 'products', 'amount' => $amount];
        }
    }
    // 5. content help
    if ($d['content']['copywriting']) {
        $amount = evo_round_half_up((float)$p['content']['copywriting']['perPage'] * $pages);
        if ($amount > 0) {
            $lines[] = ['key' => 'copywriting', 'amount' => $amount, 'qty' => $pages];
        }
    }
    foreach (['logo', 'photos'] as $c) {
        $amount = $d['content'][$c] ? evo_round_half_up((float)$p['content'][$c]['price']) : 0;
        if ($amount > 0) {
            $lines[] = ['key' => $c, 'amount' => $amount];
        }
    }
    // 6. rush: the whole subtotal times the factor; the line is the difference
    $subtotal = array_sum(array_column($lines, 'amount'));
    $tl = (array)($p['timeline'][$d['timeline']] ?? []);
    $factor = (float)($tl['factor'] ?? 1);
    if ($factor !== 1.0) {
        $rush = evo_round_half_up(evo_snap($subtotal * $factor)) - $subtotal;
        if ($rush !== 0) {
            $lines[] = ['key' => 'rush', 'amount' => $rush];
        }
    }
    $total = array_sum(array_column($lines, 'amount'));
    // 7. the range, to the nearest 50 (halves up)
    $low = evo_round_half_up(evo_snap($total * (float)$p['range']['low']) / 50) * 50;
    $high = evo_round_half_up(evo_snap($total * (float)$p['range']['high']) / 50) * 50;
    // 9. weeks
    $add = (int)ceil($extra / 5) + intdiv($paid, 3);
    $min = (int)$t['weeks'][0] + $add;
    $max = (int)$t['weeks'][1] + $add;
    if (isset($tl['weeksFactor'])) {
        $min = (int)ceil(evo_snap($min * (float)$tl['weeksFactor']));
        $max = (int)ceil(evo_snap($max * (float)$tl['weeksFactor']));
    }
    $min = max(1, $min);
    $max = max($max, $min + 1);
    return [
        'currency' => (string)($p['currency'] ?? 'USD'),
        'total' => $total,
        'low' => $low,
        'high' => $high,
        'monthly' => (int)($p['care'][$d['care']]['monthly'] ?? 0), // 8. the care plan, per month
        'weeks' => [$min, $max],
        'pages' => $pages,
        'extraPages' => $extra,
        'lines' => $lines,
    ];
}

/** English names for the choices in a design (the email and the admin panel are in English). */
function evo_design_labels(): array
{
    return [
        'types' => ['landing' => 'Landing page', 'portfolio' => 'Portfolio', 'business' => 'Business website', 'store' => 'Online store', 'webapp' => 'Web app'],
        'industries' => [
            'restaurant' => 'Restaurant or café', 'clinic' => 'Clinic or health', 'beauty' => 'Beauty and wellness',
            'construction' => 'Construction and trades', 'consulting' => 'Consulting and services',
            'retail' => 'Shop or retail', 'tourism' => 'Travel and tourism', 'education' => 'Education', 'fitness' => 'Fitness and sport',
            'realestate' => 'Real estate', 'tech' => 'Tech or software', 'other' => 'Something else',
        ],
        'palettes' => ['navy' => 'Midnight', 'forest' => 'Forest', 'sunset' => 'Sunset', 'ocean' => 'Ocean', 'mono' => 'Black and white', 'blush' => 'Blush', 'custom' => 'Your own colour'],
        'fonts' => ['modern' => 'Modern', 'elegant' => 'Elegant', 'friendly' => 'Friendly', 'bold' => 'Bold'],
        'layouts' => ['clean' => 'Clean', 'bold' => 'Bold', 'classic' => 'Classic'],
        'modes' => ['light' => 'Light', 'dark' => 'Dark'],
        'pages' => [
            'home' => 'Home', 'about' => 'About', 'services' => 'Services', 'gallery' => 'Gallery', 'pricing' => 'Pricing',
            'team' => 'Team', 'blog' => 'Blog', 'faq' => 'FAQ', 'contact' => 'Contact', 'testimonials' => 'Reviews',
            'careers' => 'Careers', 'locations' => 'Locations',
        ],
        'features' => [
            'booking' => 'Online booking', 'payments' => 'Online payments', 'cms' => 'Edit it yourself',
            'multilingual' => 'More languages', 'accounts' => 'Customer accounts', 'search' => 'Site search', 'newsletter' => 'Newsletter sign-up',
            'livechat' => 'Live chat', 'maps' => 'Map and directions', 'reviews' => 'Reviews section', 'seo' => 'SEO setup',
            'analytics' => 'Visitor statistics',
        ],
        'products' => ['small' => 'Up to 50 products', 'medium' => '50 to 200 products', 'large' => '200 to 1,000 products', 'huge' => 'More than 1,000 products'],
        'content' => ['copywriting' => 'We write the text', 'logo' => 'A logo', 'photos' => 'Photos'],
        'care' => ['none' => 'No care plan', 'basic' => 'Basic care', 'standard' => 'Standard care', 'pro' => 'Pro care'],
        'timeline' => ['flexible' => 'Flexible', 'standard' => 'Standard', 'rush' => 'Rush'],
    ];
}

/** A label from evo_design_labels(), or the raw value when it has none. */
function evo_label(string $group, string $value): string
{
    return evo_design_labels()[$group][$value] ?? $value;
}

/** '$1,250' (US dollars, whole). */
function evo_money(int $amount): string
{
    return ($amount < 0 ? '-$' : '$') . number_format(abs($amount));
}

/** The English name of one line of an estimate, e.g. 'Extra pages (3)'. */
function evo_estimate_line_label(array $line, array $design = []): string
{
    $key = (string)($line['key'] ?? '');
    $qty = isset($line['qty']) ? (int)$line['qty'] : null;
    if (str_starts_with($key, 'feature:')) {
        $f = substr($key, 8);
        if ($f === 'multilingual' && $qty !== null) {
            return 'More languages (' . $qty . ($qty === 1 ? ' extra language)' : ' extra languages)');
        }
        return evo_label('features', $f);
    }
    return match ($key) {
        'base' => evo_label('types', (string)($design['type'] ?? '')) . ' (base price)',
        'extraPages' => 'Extra pages' . ($qty !== null ? " ($qty)" : ''),
        'products' => evo_label('products', (string)($design['products'] ?? '')),
        'copywriting' => 'Writing the text' . ($qty !== null ? " ($qty " . ($qty === 1 ? 'page)' : 'pages)') : ''),
        'logo' => 'Logo design',
        'photos' => 'Photos',
        'rush' => 'Rush timeline',
        default => $key,
    };
}

/** A normalised design as [label, value] rows in English, for the email and the admin panel. */
function evo_design_rows(array $d): array
{
    $l = static fn(string $g, string $v): string => evo_label($g, $v);
    $rows = [['Website', $l('types', $d['type'])]];
    $business = trim(($d['business']['name'] !== '' ? $d['business']['name'] . ', ' : '') . $l('industries', $d['business']['industry']));
    $rows[] = ['Business', $business];
    if ($d['business']['tagline'] !== '') {
        $rows[] = ['Tagline', $d['business']['tagline']];
    }
    $palette = $l('palettes', $d['look']['palette']) . ($d['look']['palette'] === 'custom' ? ' (' . $d['look']['accent'] . ')' : '');
    $rows[] = ['Look', $palette . ' colours, ' . strtolower($l('fonts', $d['look']['font'])) . ' type, ' . strtolower($l('layouts', $d['look']['layout']))
        . ' layout, ' . strtolower($l('modes', $d['look']['mode'])) . ' background'];
    $pages = implode(', ', array_map(static fn($x) => $l('pages', $x), $d['pages']));
    if ($d['extraPages'] > 0) {
        $pages .= ', plus ' . $d['extraPages'] . ($d['extraPages'] === 1 ? ' more page' : ' more pages');
    }
    $rows[] = ['Pages', $pages];
    $features = [];
    foreach ($d['features'] as $f) {
        $features[] = $f === 'multilingual' ? $l('features', $f) . ' (' . $d['languages'] . ' in all)' : $l('features', $f);
    }
    $rows[] = ['Features', $features ? implode(', ', $features) : 'None'];
    if ($d['type'] === 'store') {
        $rows[] = ['Products', $l('products', $d['products'])];
    }
    $help = array_keys(array_filter($d['content']));
    $rows[] = ['Content help', $help ? implode(', ', array_map(static fn($x) => $l('content', $x), $help)) : 'None'];
    $rows[] = ['Timeline', $l('timeline', $d['timeline'])];
    $rows[] = ['Care plan', $l('care', $d['care'])];
    return $rows;
}

// ---- saved quote requests (evosoft-data/quotes.jsonl) and the admin panel's notes on them (quote-meta.json) ----

const EVO_QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];

/** 12 hex characters, for a new request. */
function evo_new_quote_id(): string
{
    return bin2hex(random_bytes(6));
}

/**
 * A request's id: its own (12 hex characters, saved since the quote builder came), or for older requests the first
 * 12 characters of the sha1 of its line in quotes.jsonl (without the line break). Lines are never rewritten, only
 * kept or dropped, so this never changes.
 */
function evo_quote_id(array $q, string $rawLine): string
{
    $id = $q['id'] ?? null;
    if (is_string($id) && preg_match('/^[0-9a-f]{12}$/', $id)) {
        return $id;
    }
    return substr(sha1(rtrim($rawLine, "\r\n")), 0, 12);
}

/** A saved request with every field present and of the right type (old requests lack the newer ones). */
function evo_quote_shape(array $q, string $id): array
{
    $s = static fn($v): string => is_string($v) ? $v : (is_int($v) || is_float($v) ? (string)$v : '');
    return [
        'id' => $id,
        'when' => $s($q['when'] ?? ''),
        'source' => ($q['source'] ?? '') === 'estimate' ? 'estimate' : 'contact',
        'name' => $s($q['name'] ?? ''),
        'email' => $s($q['email'] ?? ''),
        'phone' => $s($q['phone'] ?? ''),
        'company' => $s($q['company'] ?? ''),
        'types' => is_array($q['types'] ?? null) ? array_values(array_filter($q['types'], 'is_string')) : [],
        'timeline' => $s($q['timeline'] ?? ''),
        'lang' => $s($q['lang'] ?? ''),
        'message' => $s($q['message'] ?? ''),
        'design' => is_array($q['design'] ?? null) ? $q['design'] : null,
        'estimate' => is_array($q['estimate'] ?? null) ? $q['estimate'] : null,
    ];
}

/** Every saved request, in the order they were sent (oldest first), each with its id. */
function evo_quotes_all(): array
{
    $file = evo_data_dir() . '/quotes.jsonl';
    $out = [];
    if (!@is_file($file) || ($fh = @fopen($file, 'r')) === false) {
        return $out;
    }
    if (flock($fh, LOCK_SH)) {
        while (($line = fgets($fh)) !== false) {
            $q = json_decode($line, true);
            if (is_array($q)) {
                $out[] = evo_quote_shape($q, evo_quote_id($q, $line));
            }
        }
        flock($fh, LOCK_UN);
    }
    fclose($fh);
    return $out;
}

/** One saved request by id, or null. */
function evo_quote_find(string $id): ?array
{
    foreach (evo_quotes_all() as $q) {
        if ($q['id'] === $id) {
            return $q;
        }
    }
    return null;
}

/** The admin panel's data per request: [id => ['status' => ..., 'notes' => ..., 'updated_at' => ...]]. */
function evo_quote_meta_all(): array
{
    // read under a shared lock: a save in progress empties the file before writing it again
    $fh = @fopen(evo_data_dir() . '/quote-meta.json', 'r');
    if ($fh === false) {
        return [];
    }
    $raw = flock($fh, LOCK_SH) ? stream_get_contents($fh) : false;
    flock($fh, LOCK_UN);
    fclose($fh);
    $meta = is_string($raw) ? json_decode($raw, true) : null;
    return is_array($meta) ? $meta : [];
}

/** The admin data of one request, with defaults (status "new", no notes). */
function evo_quote_meta(array $all, string $id): array
{
    $m = is_array($all[$id] ?? null) ? $all[$id] : [];
    $status = is_string($m['status'] ?? null) && in_array($m['status'], EVO_QUOTE_STATUSES, true) ? $m['status'] : 'new';
    return ['status' => $status, 'notes' => is_string($m['notes'] ?? null) ? $m['notes'] : '', 'updated_at' => is_string($m['updated_at'] ?? null) ? $m['updated_at'] : ''];
}

/** Changes quote-meta.json under an exclusive lock: $change gets the whole array and returns the new one. */
function evo_quote_meta_change(callable $change): bool
{
    $file = evo_data_dir() . '/quote-meta.json';
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return false;
    }
    $ok = false;
    if (flock($fh, LOCK_EX)) {
        $meta = json_decode((string)stream_get_contents($fh), true);
        $meta = is_array($meta) ? $meta : [];
        $new = $change($meta);
        if (is_array($new) && $new !== $meta) {
            $json = json_encode((object)$new, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
            ftruncate($fh, 0);
            rewind($fh);
            $ok = fwrite($fh, $json) === strlen($json);
            fflush($fh);
        } else {
            $ok = true;
        }
        flock($fh, LOCK_UN);
    }
    fclose($fh);
    return $ok;
}

/**
 * Sets a request's status and/or notes (only the keys given). Returns false when the request doesn't exist (or the
 * file can't be written). Takes the requests' lock first, like evo_quote_delete(), so the two can't cross.
 */
function evo_quote_meta_update(string $id, array $changes): bool
{
    $file = evo_data_dir() . '/quotes.jsonl';
    if (!@is_file($file) || ($fh = @fopen($file, 'r')) === false) {
        return false;
    }
    $ok = false;
    if (flock($fh, LOCK_SH)) {
        $found = false;
        while (!$found && ($line = fgets($fh)) !== false) {
            $q = json_decode($line, true);
            $found = is_array($q) && evo_quote_id($q, $line) === $id;
        }
        if ($found) {
            $ok = evo_quote_meta_change(static function (array $meta) use ($id, $changes): array {
                $m = evo_quote_meta($meta, $id);
                if (isset($changes['status']) && in_array($changes['status'], EVO_QUOTE_STATUSES, true)) {
                    $m['status'] = $changes['status'];
                }
                if (isset($changes['notes']) && is_string($changes['notes'])) {
                    $m['notes'] = evo_clean_text($changes['notes'], 5000);
                }
                $m['updated_at'] = gmdate('Y-m-d H:i') . ' UTC';
                $meta[$id] = $m;
                return $meta;
            });
        }
        flock($fh, LOCK_UN);
    }
    fclose($fh);
    return $ok;
}

/**
 * Deletes a request for good (for example when someone asks to be forgotten): its line in quotes.jsonl, rewritten in
 * place under the same exclusive lock quote.php appends with, and its admin data. Returns false when it wasn't there.
 */
function evo_quote_delete(string $id): bool
{
    $file = evo_data_dir() . '/quotes.jsonl';
    if (!@is_file($file) || ($fh = @fopen($file, 'c+')) === false) {
        return false;
    }
    $found = false;
    if (flock($fh, LOCK_EX)) {
        $keep = '';
        while (($line = fgets($fh)) !== false) {
            $q = json_decode($line, true);
            if (is_array($q) && evo_quote_id($q, $line) === $id) {
                $found = true;
                continue;
            }
            $keep .= $line;
        }
        if ($found) {
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, $keep);
            fflush($fh);
        }
        evo_quote_meta_change(static function (array $meta) use ($id): array {
            unset($meta[$id]);
            return $meta;
        });
        flock($fh, LOCK_UN);
    }
    fclose($fh);
    return $found;
}
