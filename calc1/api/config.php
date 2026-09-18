<?php
/* ============================================================
   MatHub account server — configuration
   Edit this file after uploading to Hostinger. Nothing else needs
   changing. Keep it out of version control if you add a password.
   ============================================================ */
return [
  // Who may sign up. Exact domain or any subdomain (student.montana.edu, msu.montana.edu…).
  'allowed_domains' => ['montana.edu'],
  // Individual addresses allowed in addition to the domains above (for example your own non-MSU address).
  'extra_allowed_emails' => [],

  // Discussion moderators (account emails). Moderators can pin, lock, remove posts and comments, ban users and see the report queue.
  'moderators' => [],

  // Sender for verification / reset emails. Must be a mailbox that exists on your domain.
  'mail_from'       => 'info@mathub.space',
  'mail_from_name'  => 'MatHub',
  'site_name'       => 'MatHub',

  // How to send mail:
  //   'auto' = use SMTP when smtp_pass is filled in, otherwise PHP mail()
  //   'smtp' = always SMTP, 'mail' = always PHP mail(), 'log' = do not send, write codes to data/mail.log (testing only)
  'mail_mode'       => 'auto',

  // Hostinger mailbox SMTP (hPanel → Emails → Manage → Configuration). Fill smtp_pass with the password of info@mathub.space.
  'smtp_host'       => 'smtp.hostinger.com',
  'smtp_port'       => 465,          // 465 = SSL (recommended on Hostinger), 587 = STARTTLS
  'smtp_user'       => 'info@mathub.space',
  'smtp_pass'       => '',

  // Optional. If set, GET api/index.php?r=stats with header X-Admin-Key: <this value> returns sign-up counts.
  'admin_key'       => '',

  // Storage. Keep the database inside api/data (protected by .htaccess) or move it above public_html.
  'db_path'         => __DIR__ . '/data/mathub.sqlite',

  // Security tuning (sensible defaults).
  'code_ttl_minutes'    => 15,   // how long a 6-digit email code stays valid
  'session_days'        => 180,  // how long a login lasts on a device
  'max_data_bytes'      => 600000, // per course per user progress blob
];
