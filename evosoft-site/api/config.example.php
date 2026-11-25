<?php
/*
 * EvoSoft website settings for the chat assistant, the quote form and the admin panel.
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
    // Quote requests are deleted from the data folder this many months after they were sent (the privacy policy
    // says 12: change both together, in site-builder/data/site.mjs too). Delete the emails on the same schedule.
    'quote_keep_months' => 12,

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

    // Admin panel (https://evosoft.solutions/admin/): every quote request, its status and your notes.
    // It stays locked until admin_password_hash is set. To make it, open /admin/ once: it asks for a password and shows
    // the exact line to paste here (it saves nothing itself). The line holds a one-way hash, never the password.
    // To change the password later, sign in and open Security, or delete this line and open /admin/ again.
    'admin_password_hash' => '',
    // Optional second step at sign-in: a 6-digit code from an authenticator app (Google Authenticator, 1Password,
    // Aegis…). /admin/ (or Security, once signed in) makes a secret for you; paste its line here. Empty = off.
    'admin_totp_secret' => '',
    // Signed out after this many minutes without using the panel (5 to 720). Every sign-in ends after 12 hours anyway.
    'admin_session_minutes' => 30,
    // The panel only opens over https:// (a password must never travel in the clear). Only set this to false if your
    // host serves the site over https but PHP can't tell (the panel then says "Open it over https").
    'admin_require_https' => true,

    // Client finder (/admin/?view=finder): businesses that could use a website, saved leads, Upwork jobs, EU tenders.
    // Its AI steps (web search, research, draft emails) use anthropic_api_key above.
    'finder_model' => 'claude-opus-5-5',  // the model for the finder's AI steps
    'finder_effort' => 'medium',          // low, medium, high, xhigh or max: more effort is slower and costs more
    'finder_ai_daily_limit' => 40,        // AI calls a day in all (a search or research is usually one, sometimes two or three)
    // Saved leads are deleted this many months after they were found, unless their status is "won" (0 = keep).
    // The do-not-contact list keeps only hashes and is never deleted, so those businesses never come back.
    'leads_keep_months' => 6,
    // OpenStreetMap search goes through the public Overpass API. The finder keeps to about 80 searches and 10 MB a day
    // and caches each search for 24 hours. Change the address only to another Overpass server whose rules you've read.
    'overpass_url' => 'https://overpass-api.de/api/interpreter',
    // Sent with every request to OpenStreetMap, TED and Upwork, so they know who is asking. Keep it honest and real.
    'finder_user_agent' => 'EvoSoft-ClientFinder/1.0 (+https://evosoft.solutions/legal)',
    // Upwork job search (optional): Upwork's official API needs a key from https://www.upwork.com/developer/keys/apply
    // (the Upwork tab lists the requirements). Key type OAuth 2.0, scopes "Common Entities - Read-Only Access" and
    // "Read marketplace Job Postings". The callback URL registered with the key must be exactly upwork_redirect_uri.
    // The secret also encrypts the saved Upwork sign-in: after changing it, connect Upwork again.
    'upwork_client_id' => '',
    'upwork_client_secret' => '',
    'upwork_redirect_uri' => 'https://evosoft.solutions/admin/?view=finder&tab=upwork',
];
