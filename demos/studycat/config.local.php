<?php
/* ============================================================
   StudyCat PUBLIC DEMO settings (studycat-demo.evosoft.solutions)
   Goes in api/config.local.php of the DEMO copy only. Never use it on studycat.org.
   It is merged over api/config.php (api/lib.php, mh_config). The admin panel's
   Keys & settings would normally win over this file (api/data/site-config.json);
   demo-seed.php makes that impossible by putting a folder where that file would be
   (see the demo README, "Lockdown"), so these values are final.
   ============================================================ */

// The demo database lives outside public_html when STUDYCAT_DEMO_DATA is set (recommended on Hostinger, see README);
// otherwise in api/data-demo/ next to this file (blocked from the web by api/.htaccess and its own .htaccess).
$demoData = rtrim((string)(getenv('STUDYCAT_DEMO_DATA') ?: __DIR__ . '/data-demo'), '/');
if (is_file(__DIR__ . '/demo-data-path.php')) { $p = require __DIR__ . '/demo-data-path.php'; if (is_string($p) && $p !== '') $demoData = rtrim($p, '/'); }

return [
  // --- who can sign in -------------------------------------------------------
  // Only the reserved, undeliverable .test domain (RFC 2606): no real person can sign up or be emailed.
  'allowed_domains'      => ['studycat.test'],
  'extra_allowed_emails' => [],
  'moderators'           => ['moderator@studycat.test'],
  'admins'               => ['admin@studycat.test'],
  'staff'                => [],                       // the instructor is confirmed in the database (roles, scope teach) by demo-seed.php
  // plans given without paying (no RevenueCat involved)
  'plan_grants'          => ['max@studycat.test' => 'max'],

  // --- email: never sent -----------------------------------------------------
  'mail_mode'      => 'log',                          // codes and notices are written to api/data/mail.log (never served); nothing leaves the server
  'mail_from'      => 'noreply@studycat.test',
  'mail_from_name' => 'StudyCat demo',
  'smtp_host'      => 'smtp.invalid',                 // .invalid never resolves, even if mail_mode were changed
  'smtp_port'      => 465,
  'smtp_user'      => '',
  'smtp_pass'      => '',
  'recap_emails'   => 'off',
  'exam_emails'    => 'off',
  'admin_report'   => 'off',

  // --- AI (Bo), voice, pictures, malware lookups: no keys, dead endpoints -----
  'anthropic_key'  => '',
  'openai_key'     => '',
  'virustotal_key' => '',
  'anthropic_api'  => 'http://127.0.0.1:9/disabled-in-demo',
  'openai_api'     => 'http://127.0.0.1:9/disabled-in-demo',
  'virustotal_api' => 'http://127.0.0.1:9/disabled-in-demo/',
  'ai_invite_credits' => 0,

  // --- payments: no RevenueCat, no purchase links ------------------------------
  'revenuecat_secret'  => '',
  'revenuecat_v2_key'  => '',
  'revenuecat_project' => '',
  'revenuecat_api'     => 'http://127.0.0.1:9/disabled-in-demo/',
  'revenuecat_v2_api'  => 'http://127.0.0.1:9/disabled-in-demo',
  'pro_web_link'       => '',
  'max_web_link'       => '',
  'credits_link'       => '',
  'call_hour_link'     => '',

  // --- off-site backups, Canvas, cron/stats keys: off -------------------------
  'offsite_endpoint'   => '',
  'offsite_bucket'     => '',
  'offsite_key_id'     => '',
  'offsite_secret'     => '',
  'offsite_passphrase' => '',
  'cron_key'           => '',
  'admin_key'          => '',

  // --- site ---------------------------------------------------------------------
  'site_name' => 'StudyCat',
  'site_url'  => getenv('STUDYCAT_DEMO_URL') ?: '',   // blank = the address people open (fine for the demo)
  'db_path'   => $demoData . '/studycat-demo.sqlite', // a separate demo database, never production's mathub.sqlite
  'session_days' => 7,
];
