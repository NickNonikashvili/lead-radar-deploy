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
 * Deletes what the privacy policy says we don't keep, at most once an hour (api/quote.php and api/chat.php call it):
 *   - rate-limit counters and daily keys older than two days;
 *   - quote requests older than quote_keep_months (the email copy is deleted by hand on the same schedule);
 *   - any leftover quotes.jsonl.moved copy from an old version that is past the same age.
 * The quotes file is rewritten in place under the same lock quote.php appends with, so no request is ever lost.
 */
function evo_housekeeping(array $cfg): void
{
    $dir = evo_data_dir();
    $stamp = $dir . '/housekeeping-stamp';
    clearstatcache();
    if (@is_file($stamp) && @filemtime($stamp) > time() - 3600) {
        return;
    }
    @touch($stamp);
    $limits = $dir . '/limits';
    $old = time() - 2 * 86400;
    foreach (array_merge(glob($limits . '/*') ?: [], glob($limits . '/.salt-*') ?: []) as $f) {
        if (@filemtime($f) < $old) {
            @unlink($f);
        }
    }
    $months = (int)($cfg['quote_keep_months'] ?? 0);
    if ($months <= 0) {
        return;
    }
    $cutoff = gmdate('Y-m-d H:i', strtotime("-$months months"));
    $file = $dir . '/quotes.jsonl';
    if (@is_file($file) && ($fh = @fopen($file, 'c+')) !== false) {
        if (flock($fh, LOCK_EX)) {
            $keep = '';
            $dropped = 0;
            while (($line = fgets($fh)) !== false) {
                $q = json_decode($line, true);
                $when = is_array($q) && is_string($q['when'] ?? null) ? substr($q['when'], 0, 16) : '';
                // keep anything it can't date, rather than guess
                if ($when !== '' && preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $when) && strcmp($when, $cutoff) < 0) {
                    $dropped++;
                    continue;
                }
                $keep .= $line;
            }
            if ($dropped) {
                ftruncate($fh, 0);
                rewind($fh);
                fwrite($fh, $keep);
                fflush($fh);
            }
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    }
    foreach (glob(EVO_DATA_DIR . '/quotes.jsonl.moved*') ?: [] as $f) {
        if (@filemtime($f) < strtotime("-$months months")) {
            @unlink($f);
        }
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
