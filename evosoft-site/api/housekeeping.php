<?php
// © 2026 EvoSoft Solutions
// Runs the clean-up the privacy policy promises (old rate-limit counters, daily keys and quote requests) even on days
// when nobody uses the chat or the quote form. Command line only: run it once a day from a cron job (README,
// "Deleted on schedule"). The web server refuses it (api/.htaccess lets only chat.php and quote.php through).
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/lib.php';
evo_housekeeping(evo_config(), true);
echo 'EvoSoft housekeeping done ' . gmdate('Y-m-d H:i') . " UTC\n";
