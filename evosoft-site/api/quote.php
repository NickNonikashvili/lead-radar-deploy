<?php
/*
 * EvoSoft website: handler for the "Get a quote" form (/contact) and the quote builder (/estimate).
 * Saves each request in the data folder (evosoft-data/quotes.jsonl next to public_html, or api/data), then emails it to
 * the team (quote_to) with the visitor as Reply-To: over SMTP when smtp_pass is set, otherwise with PHP mail().
 * A request from the quote builder also carries the website the visitor designed ("design"); the estimate is worked
 * out again here from api/pricing.json (evo_estimate() in lib.php), so the email and the admin panel never show a
 * price the visitor's browser made up.
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
const QUOTE_LANGS = ['en' => 'English', 'es' => 'Spanish (Español)'];

$cfg = evo_config();
evo_housekeeping($cfg);
$req = evo_read_request(32000);
if (isset($req['__health'])) {
    evo_json(['ok' => true, 'mail' => evo_mail_method($cfg), 'last_send' => evo_mail_last()]);
}

// Honeypot: a field people never see. Bots that fill it get a polite "ok" and nothing is sent.
if (trim((string)($req['website'] ?? '')) !== '') {
    evo_json(['ok' => true]);
}

// a field sent as a list or an object counts as empty (rather than becoming the word "Array")
$str = static fn($v): string => is_string($v) ? $v : (is_int($v) || is_float($v) ? (string)$v : '');
$name = evo_clean_line($str($req['name'] ?? ''), 100);
$email = evo_clean_line($str($req['email'] ?? ''), 200);
$phone = evo_clean_line($str($req['phone'] ?? ''), 40);
$company = evo_clean_line($str($req['company'] ?? ''), 120);
$timeline = in_array($req['timeline'] ?? '', QUOTE_TIMELINES, true) ? $req['timeline'] : 'Flexible';
$types = array_values(array_intersect(QUOTE_TYPES, array_filter(is_array($req['types'] ?? null) ? $req['types'] : [], 'is_string')));
$lang = is_string($req['lang'] ?? null) ? strtolower(trim($req['lang'])) : '';
$lang = isset(QUOTE_LANGS[$lang]) ? $lang : 'en';
$message = evo_clean_text($str($req['message'] ?? ''), 5000);
$source = ($req['source'] ?? '') === 'estimate' ? 'estimate' : 'contact';
// the website designed on /estimate: made safe and priced again here (anything the browser sent as a price is ignored)
$pricing = evo_pricing();
$design = is_array($req['design'] ?? null) && $pricing !== [] ? evo_normalise_design($req['design'], $pricing) : [];
$estimate = $design !== [] ? evo_estimate($design, $pricing) : [];
if (is_array($req['design'] ?? null) && $pricing === []) {
    error_log('EvoSoft quote: api/pricing.json is missing or broken, so the design was not saved (rebuild the site)');
}

$errors = [];
if ($name === '') {
    $errors['name'] = 'Please tell us your name.';
}
// A plain address only: FILTER_VALIDATE_EMAIL also takes quoted forms such as "boss@other.example,"@x.example, which
// a mail app can split into two recipients when the owner replies (Reply-To, and "Reply by email" in the admin panel).
if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false || preg_match('/["\s(),:;<>\[\\\\\]]/', $email)) {
    $errors['email'] = 'Please check your email address.';
}
if ($source !== 'estimate' && mb_strlen($message) < 10) { // on /estimate the design says it, so a message is optional
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
$id = evo_new_quote_id(); // the admin panel's address for it: /admin/?r=<id>
$record = compact('id', 'when', 'source', 'name', 'email', 'phone', 'company', 'types', 'timeline', 'lang', 'message');
if ($design !== []) {
    $record['design'] = $design;
    $record['estimate'] = $estimate;
}
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
    $fromBuilder = ($q['source'] ?? '') === 'estimate';
    $design = is_array($q['design'] ?? null) ? $q['design'] : null;
    $est = is_array($q['estimate'] ?? null) ? $q['estimate'] : null;
    $rows = [['Name', $q['name'], ''], ['Email', $q['email'], 'mailto:' . str_replace('%40', '@', rawurlencode($q['email']))]];
    if ($q['phone'] !== '') {
        $rows[] = ['Phone', $q['phone'], $digits !== '' ? 'tel:' . $digits : ''];
    }
    if ($q['company'] !== '') {
        $rows[] = ['Company', $q['company'], ''];
    }
    if (!$fromBuilder || $q['types']) {
        $rows[] = ['Needs', $q['types'] ? implode(', ', $q['types']) : 'Not specified', ''];
    }
    if (!$fromBuilder) {
        $rows[] = ['Timeline', $q['timeline'], ''];
    }
    $rows[] = ['Language', QUOTE_LANGS[$q['lang']], ''];
    $rows[] = ['Sent', $q['when'], ''];
    if ($fromBuilder) {
        $rows[] = ['From', 'The quote builder (evosoft.solutions/estimate)', ''];
    }
    $admin = EVO_SITE_URL . '/admin/?r=' . rawurlencode((string)$q['id']);

    $label = 'padding:6px 16px 6px 0;color:#667085;white-space:nowrap;vertical-align:top;';
    $value = 'padding:6px 0;color:#101828;vertical-align:top;';
    $table = static function (array $rows) use ($h, $label, $value): string {
        $cells = '';
        foreach ($rows as $r) {
            [$l, $v, $link] = $r + [2 => ''];
            $shown = $link !== '' ? '<a href="' . $h($link) . '" style="color:#2563eb;text-decoration:none;">' . $h($v) . '</a>' : $h($v);
            $cells .= '<tr><td style="' . $label . '">' . $h($l) . '</td><td style="' . $value . 'overflow-wrap:anywhere;word-break:break-word;">' . $shown . "</td></tr>\n";
        }
        return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.5;">' . "\n" . $cells . '</table>';
    };
    $heading = static fn(string $t): string => '<div style="font-size:13px;color:#667085;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;">' . $t . '</div>';

    $text = ($fromBuilder ? "New website request from evosoft.solutions\n\n" : "New quote request from evosoft.solutions\n\n");
    foreach ($rows as [$l, $v]) {
        $text .= "$l: $v\n";
    }
    $extra = '';
    if ($design) {
        $designRows = evo_design_rows($design);
        $text .= "\nWEBSITE DESIGN\n";
        foreach ($designRows as [$l, $v]) {
            $text .= "$l: $v\n";
        }
        $extra .= '<tr><td style="padding:14px 24px 6px;border-top:1px solid #e4e7ec;">' . $heading('Website design') . $table($designRows) . "</td></tr>\n";
    }
    if ($design && $est) {
        $sum = [['Estimated price', evo_money((int)$est['low']) . ' – ' . evo_money((int)$est['high'])]];
        if ((int)$est['monthly'] > 0) {
            $sum[] = ['Care plan', evo_money((int)$est['monthly']) . ' a month'];
        }
        $sum[] = ['Time', 'about ' . (int)$est['weeks'][0] . '–' . (int)$est['weeks'][1] . ' weeks'];
        $text .= "\nESTIMATE (worked out by the website from its price list; not an offer)\n";
        foreach ($sum as [$l, $v]) {
            $text .= "$l: $v\n";
        }
        $text .= "Breakdown:\n";
        $lines = '';
        foreach ((array)$est['lines'] as $line) {
            $name = evo_estimate_line_label((array)$line, $design);
            $amount = evo_money((int)($line['amount'] ?? 0));
            $text .= "  $name: $amount\n";
            $lines .= '<tr><td style="padding:4px 16px 4px 0;color:#344054;">' . $h($name) . '</td><td style="padding:4px 0;color:#101828;text-align:right;white-space:nowrap;">' . $h($amount) . "</td></tr>\n";
        }
        $text .= '  Total: ' . evo_money((int)$est['total']) . "\n";
        $lines .= '<tr><td style="padding:6px 16px 4px 0;color:#101828;font-weight:600;border-top:1px solid #e4e7ec;">Total</td><td style="padding:6px 0 4px;color:#101828;font-weight:600;text-align:right;border-top:1px solid #e4e7ec;">' . $h(evo_money((int)$est['total'])) . "</td></tr>\n";
        $extra .= '<tr><td style="padding:14px 24px 6px;border-top:1px solid #e4e7ec;">' . $heading('Estimate') . $table($sum)
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.45;margin-top:10px;max-width:460px;">' . "\n" . $lines . '</table>'
            . '<div style="font-size:13px;color:#667085;margin-top:8px;">Worked out by the website from its price list (the visitor saw the same range). It is not an offer: your written quote is.</div>'
            . "</td></tr>\n";
    }
    $message = $q['message'] !== '' ? $q['message'] : '(no message)';
    $text .= "\nMessage:\n$message\n\nOpen it in the admin panel: $admin\n\n-- \nReply to this email to answer {$q['name']} directly. A copy of this request is saved on the website.\n";

    $html = '<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . ($fromBuilder ? 'New website request' : 'New quote request') . '</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f4f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e7ec;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#101828;">
<tr><td style="padding:20px 24px 16px;border-bottom:1px solid #e4e7ec;">
<div style="font-size:13px;color:#667085;">evosoft.solutions</div>
<div style="font-size:20px;font-weight:600;margin-top:2px;">' . ($fromBuilder ? 'New website request' : 'New quote request') . '</div>
</td></tr>
<tr><td style="padding:14px 24px 6px;">
' . $table($rows) . '
</td></tr>
' . $extra . '<tr><td style="padding:10px 24px 20px;">
<div style="font-size:13px;color:#667085;margin-bottom:6px;">Message</div>
<div style="background:#f9fafb;border:1px solid #e4e7ec;border-radius:8px;padding:12px 14px;color:#101828;overflow-wrap:anywhere;word-break:break-word;">' . nl2br($h($message), false) . '</div>
</td></tr>
<tr><td style="padding:0 24px 20px;"><a href="' . $h($admin) . '" style="display:inline-block;background:#14213D;color:#F4EDE0;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:8px;">Open it in the admin panel</a></td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e4e7ec;font-size:13px;color:#667085;">Reply to this email to answer ' . $h($q['name']) . ' directly. A copy of this request is saved on the website.</td></tr>
</table>
</td></tr></table>
</body></html>
';
    if ($fromBuilder && $design) {
        $what = evo_label('types', (string)$design['type']);
        $subject = $est ? "New website request: $what, " . evo_money((int)$est['low']) . '–' . evo_money((int)$est['high']) . " ({$q['name']})" : "New website request: $what ({$q['name']})";
    } else {
        $subject = $q['types'] ? "New quote request: {$q['types'][0]} ({$q['name']})" : "New quote request from {$q['name']}";
    }
    return ['subject' => $subject, 'html' => $html, 'text' => $text, 'reply_email' => $q['email'], 'reply_name' => $q['name']];
}
