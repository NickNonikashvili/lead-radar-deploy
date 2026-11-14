<?php
/*
 * EvoSoft website settings for the chat assistant and the quote form.
 *
 * Copy this file to ONE of these places and fill it in:
 *   - two folders above api/, i.e. next to public_html, named evosoft-config.php   (recommended: never web-reachable)
 *   - api/config.php                                                               (blocked by api/.htaccess)
 * Environment variables win over this file: ANTHROPIC_API_KEY, EVOSOFT_CHAT_MODEL, EVOSOFT_QUOTE_TO, EVOSOFT_MAIL_FROM.
 *
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

return [
    // Chat assistant. Create a key at https://console.anthropic.com (Settings → API keys).
    // Without a key the assistant still works, using the built-in answers generated from the site.
    'anthropic_api_key' => '',
    'chat_model' => 'claude-opus-5-5',   // e.g. 'claude-haiku-5-5' costs much less per message
    'chat_effort' => 'low',              // low is right for short chat answers
    'chat_per_ip_10min' => 20,           // messages per visitor per 10 minutes
    'chat_per_ip_day' => 120,            // messages per visitor per day
    'chat_global_day' => 2000,           // assistant replies per day for the whole site (spend ceiling)

    // Quote form.
    'quote_to' => 'contact@evosoft.solutions',
    'mail_from' => 'no-reply@evosoft.solutions',  // a mailbox or alias on your domain sends best
    'mail_mode' => 'mail',               // 'log' saves requests to api/data only (for testing)
    'quote_per_ip_hour' => 5,

    // Behind Cloudflare or another proxy, name the header with the visitor's IP, e.g. 'HTTP_CF_CONNECTING_IP'.
    'trust_proxy_header' => '',
];
