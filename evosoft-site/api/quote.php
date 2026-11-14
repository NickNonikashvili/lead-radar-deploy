<?php
/*
 * EvoSoft website: "Get a quote" form handler. Emails each request to the team (quote_to),
 * and keeps a copy in api/data/quotes.jsonl so nothing is lost if mail fails.
 * The page falls back to opening the visitor's email app if this endpoint is unavailable.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

require __DIR__ . '/lib.php';

const QUOTE_TYPES = [
    'Website', 'Online store', 'Web app or custom software', 'Business system (POS, HR, inventory)',
    'Integration or automation', 'SEO or redesign', 'Branding or graphic design', 'Microsoft 365, email or IT', 'Something else',
];
const QUOTE_TIMELINES = ['Flexible', 'As soon as possible', 'Within a month', 'In 1 to 3 months', 'Later this year'];

$cfg = evo_config();
$req = evo_read_request(20000);
if (isset($req['__health'])) {
    evo_json(['ok' => true]);
}

// Honeypot: a field people never see. Bots that fill it get a polite "ok" and nothing is sent.
if (trim((string)($req['website'] ?? '')) !== '') {
    evo_json(['ok' => true]);
}

$name = evo_clean_line((string)($req['name'] ?? ''), 100);
$email = evo_clean_line((string)($req['email'] ?? ''), 200);
$phone = evo_clean_line((string)($req['phone'] ?? ''), 40);
$company = evo_clean_line((string)($req['company'] ?? ''), 120);
$timeline = in_array($req['timeline'] ?? '', QUOTE_TIMELINES, true) ? $req['timeline'] : 'Flexible';
$types = array_values(array_intersect(QUOTE_TYPES, is_array($req['types'] ?? null) ? $req['types'] : []));
$message = evo_clean_text((string)($req['message'] ?? ''), 5000);

$errors = [];
if ($name === '') {
    $errors['name'] = 'Please tell us your name.';
}
if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $errors['email'] = 'Please check your email address.';
}
if (mb_strlen($message) < 10) {
    $errors['message'] = 'Please add a few words about the project.';
}
if ($errors) {
    evo_json(['error' => 'invalid', 'fields' => $errors], 422);
}

if (!evo_rate_ok('quote', evo_client_ip(), (int)$cfg['quote_per_ip_hour'], 3600)) {
    evo_json(['error' => 'rate_limited'], 429);
}

$when = gmdate('Y-m-d H:i') . ' UTC';
$record = compact('when', 'name', 'email', 'phone', 'company', 'types', 'timeline', 'message');
@file_put_contents(evo_data_dir() . '/quotes.jsonl', json_encode($record, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

$body = "New quote request from evosoft.solutions\n\n"
    . "Name: $name\nEmail: $email\n"
    . ($phone !== '' ? "Phone: $phone\n" : '')
    . ($company !== '' ? "Company: $company\n" : '')
    . 'Needs: ' . ($types ? implode(', ', $types) : 'Not specified') . "\n"
    . "Timeline: $timeline\nSent: $when\n\n$message\n";

if (($cfg['mail_mode'] ?? 'mail') === 'log') {
    evo_json(['ok' => true]);
}

$host = preg_replace('/[^a-z0-9.-]/i', '', (string)($_SERVER['HTTP_HOST'] ?? 'evosoft.solutions')) ?: 'evosoft.solutions';
$from = (string)$cfg['mail_from'] !== '' ? (string)$cfg['mail_from'] : 'no-reply@' . preg_replace('/^www\./', '', $host);
$subject = mb_encode_mimeheader('Quote request: ' . ($types[0] ?? 'New project') . ' (' . $name . ')', 'UTF-8');
$headers = [
    'From: EvoSoft website <' . evo_clean_line($from, 200) . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
$sent = @mail((string)$cfg['quote_to'], $subject, $body, implode("\r\n", $headers));
if (!$sent) {
    error_log('EvoSoft quote: mail() failed; the request is saved in api/data/quotes.jsonl');
    evo_json(['error' => 'mail_failed'], 502);
}
evo_json(['ok' => true]);
