<?php
/*
 * EvoSoft website settings for the chat assistant and the quote form.
 *
 * Copy this file to ONE of these places and fill it in:
 *   - two folders above api/, i.e. next to public_html, named evosoft-config.php   (recommended: never web-reachable)
 *   - api/config.php                                                               (blocked by api/.htaccess)
 * You only need the lines you change; anything left out keeps the default shown here.
 * Environment variables win over this file: ANTHROPIC_API_KEY, EVOSOFT_CHAT_MODEL, EVOSOFT_QUOTE_TO, EVOSOFT_MAIL_FROM,
 * EVOSOFT_SMTP_HOST, EVOSOFT_SMTP_PORT, EVOSOFT_SMTP_USER, EVOSOFT_SMTP_PASS.
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

    // Quote form: where requests are emailed. Every request is also saved in evosoft-data/quotes.jsonl next to
    // public_html (or api/data/quotes.jsonl if that folder can't be created), so none are lost if email fails.
    'quote_to' => 'contact@evosoft.solutions',
    'quote_per_ip_hour' => 5,

    // Sending the email (SMTP). The form signs in to a real mailbox and sends from it.
    // Hostinger email: keep smtp_host and smtp_port as they are (smtp.hostinger.com, port 465 with SSL),
    // put the full mailbox address in smtp_user and that mailbox's password in smtp_pass
    // (the one you use for webmail; hPanel -> Emails -> Email accounts can change it).
    // Another provider (Google Workspace, Microsoft 365, Zoho…): change smtp_host and smtp_port to theirs.
    // Port 465 uses SSL and any other port uses STARTTLS; set smtp_secure to 'ssl' or 'tls' only if yours differs.
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_user' => 'contact@evosoft.solutions',
    'smtp_pass' => '',

    // Without smtp_pass the form falls back to PHP mail(), sending from mail_from (empty = quote_to).
    // It must be a real mailbox on your domain. Many hosts, Hostinger included, often refuse this, so set smtp_pass.
    'mail_from' => '',
    'mail_mode' => 'mail',               // 'log' only saves requests and emails nothing (for testing)

    // Behind Cloudflare or another proxy, name the header with the visitor's IP, e.g. 'HTTP_CF_CONNECTING_IP'.
    'trust_proxy_header' => '',
];
