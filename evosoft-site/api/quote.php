<?php
/*
 * EvoSoft website: "Get a quote" form handler.
 * Saves each request in the data folder (evosoft-data/quotes.jsonl next to public_html, or api/data), then emails it to
 * the team (quote_to) with the visitor as Reply-To: over SMTP when smtp_pass is set, otherwise with PHP mail().
 * Once a request is saved the visitor always gets {"ok":true}; a failed send is logged, written to mail-status.json
 * and shown by ?health=1.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

require __DIR__ . '/lib.php';

// The page sends these English values whatever its language; only the labels are translated.
const QUOTE_TYPES = [
    'Website', 'Online store', 'Web app or custom software', 'Business system (POS, HR, inventory)',
    'Integration or automation', 'SEO or redesign', 'Branding or graphic design', 'Microsoft 365, email or IT', 'Something else',
];
const QUOTE_TIMELINES = ['Flexible', 'As soon as possible', 'Within a month', 'In 1 to 3 months', 'Later this year'];
// The language the visitor used the site in, so the reply can be in it too.
const QUOTE_LANGS = ['en' => 'English', 'ka' => 'Georgian (ქართული)', 'ru' => 'Russian (Русский)', 'es' => 'Spanish (Español)'];

$cfg = evo_config();
evo_housekeeping($cfg);
$req = evo_read_request(20000);
if (isset($req['__health'])) {
    evo_json(['ok' => true, 'mail' => evo_mail_method($cfg), 'last_send' => evo_mail_last()]);
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
$types = array_values(array_intersect(QUOTE_TYPES, array_filter(is_array($req['types'] ?? null) ? $req['types'] : [], 'is_string')));
$lang = is_string($req['lang'] ?? null) ? strtolower(trim($req['lang'])) : '';
$lang = isset(QUOTE_LANGS[$lang]) ? $lang : 'en';
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

// Save first, so a request is never lost whatever happens to the email.
$when = gmdate('Y-m-d H:i') . ' UTC';
$record = compact('when', 'name', 'email', 'phone', 'company', 'types', 'timeline', 'lang', 'message');
$file = evo_data_dir() . '/quotes.jsonl';
$saved = @file_put_contents($file, json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX) !== false;
if (!$saved) {
    error_log("EvoSoft quote: could not save the request to $file");
}

$method = evo_mail_method($cfg);
if ($method === 'log') {
    evo_json($saved ? ['ok' => true] : ['error' => 'not_saved'], $saved ? 200 : 500);
}

try {
    evo_mail_status_write(true, evo_send_mail($cfg, quote_email($record)));
} catch (\Throwable $e) {
    $reason = evo_short_error($e->getMessage(), [(string)$cfg['smtp_pass']]);
    evo_mail_status_write(false, $method, $reason);
    if (!$saved) {
        error_log("EvoSoft quote: sending failed ($reason) and the request could not be saved");
        evo_json(['error' => 'not_saved'], 500);
    }
    error_log("EvoSoft quote: sending failed ($reason); the request is saved in $file");
}
evo_json(['ok' => true]);

/** The email to the team: subject, HTML and plain text, plus who to reply to. */
function quote_email(array $q): array
{
    $h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $digits = preg_replace('/[^0-9+]/', '', $q['phone']) ?? '';
    $rows = [['Name', $q['name'], ''], ['Email', $q['email'], 'mailto:' . str_replace('%40', '@', rawurlencode($q['email']))]];
    if ($q['phone'] !== '') {
        $rows[] = ['Phone', $q['phone'], $digits !== '' ? 'tel:' . $digits : ''];
    }
    if ($q['company'] !== '') {
        $rows[] = ['Company', $q['company'], ''];
    }
    $rows[] = ['Needs', $q['types'] ? implode(', ', $q['types']) : 'Not specified', ''];
    $rows[] = ['Timeline', $q['timeline'], ''];
    $rows[] = ['Language', QUOTE_LANGS[$q['lang']], ''];
    $rows[] = ['Sent', $q['when'], ''];

    $text = "New quote request from evosoft.solutions\n\n";
    $cells = '';
    foreach ($rows as [$label, $value, $link]) {
        $text .= "$label: $value\n";
        $shown = $link !== '' ? '<a href="' . $h($link) . '" style="color:#2563eb;text-decoration:none;">' . $h($value) . '</a>' : $h($value);
        $cells .= '<tr><td style="padding:6px 16px 6px 0;color:#667085;white-space:nowrap;vertical-align:top;">' . $label . '</td>'
            . '<td style="padding:6px 0;color:#101828;vertical-align:top;">' . $shown . "</td></tr>\n";
    }
    $text .= "\nMessage:\n{$q['message']}\n\n-- \nReply to this email to answer {$q['name']} directly. A copy of this request is saved on the website.\n";

    $html = '<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New quote request</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f4f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e7ec;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#101828;">
<tr><td style="padding:20px 24px 16px;border-bottom:1px solid #e4e7ec;">
<div style="font-size:13px;color:#667085;">evosoft.solutions</div>
<div style="font-size:20px;font-weight:600;margin-top:2px;">New quote request</div>
</td></tr>
<tr><td style="padding:14px 24px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.5;">
' . $cells . '</table>
</td></tr>
<tr><td style="padding:10px 24px 20px;">
<div style="font-size:13px;color:#667085;margin-bottom:6px;">Message</div>
<div style="background:#f9fafb;border:1px solid #e4e7ec;border-radius:8px;padding:12px 14px;color:#101828;overflow-wrap:anywhere;word-break:break-word;">' . nl2br($h($q['message']), false) . '</div>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e4e7ec;font-size:13px;color:#667085;">Reply to this email to answer ' . $h($q['name']) . ' directly. A copy of this request is saved on the website.</td></tr>
</table>
</td></tr></table>
</body></html>
';
    $subject = $q['types'] ? "New quote request: {$q['types'][0]} ({$q['name']})" : "New quote request from {$q['name']}";
    return ['subject' => $subject, 'html' => $html, 'text' => $text, 'reply_email' => $q['email'], 'reply_name' => $q['name']];
}
