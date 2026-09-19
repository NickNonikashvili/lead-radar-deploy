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
  'moderators' => ['nikoloz.nonikashvili@student.montana.edu'],

  // Administrators (account emails). Everything a moderator can do, plus permanently delete any post or comment,
  // see the member list, and ban, unban or delete any account. Administrators are moderators automatically.
  'admins' => ['nikoloz.nonikashvili@student.montana.edu'],

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

  // Public address of the site, used in notification emails. Leave blank to use the current host.
  'site_url'        => '',

  // Canvas calendar feed (Calendar → Calendar Feed in Canvas). Easiest is to paste it in the admin panel (#/forum/admin);
  // setting it here instead overrides the admin panel. Events are matched to classes by the course name in [brackets].
  'canvas_feed'     => '',
  'canvas_course_match' => ['calc' => ['M 171', 'M171', 'Calculus I'], 'physics' => ['PHSX 220', 'PHSX220', 'Physics I'], 'precalc' => ['M 151', 'M151', 'Precalc']],
  'timezone'        => 'America/Denver',

  // Verified staff, shown with a badge on the board: 'email' => 'Instructor' or 'TA'. Can also be managed in the admin panel.
  'staff'           => [],

  // Weekly digest emails go out on Sunday evening. They are sent a few at a time whenever the site is used, or all at once
  // when a Hostinger cron job calls  api/index.php?r=cron&key=<cron_key>  (leave blank to rely on site traffic).
  'cron_key'        => '',
  'digest_day'      => 0,    // 0 = Sunday … 6 = Saturday (local time, see 'timezone')
  'digest_hour'     => 17,   // send from 5 pm local time

  // Optional. If set, GET api/index.php?r=stats with header X-Admin-Key: <this value> returns sign-up counts.
  'admin_key'       => '',

  // Storage. Keep the database inside api/data (protected by .htaccess) or move it above public_html.
  'db_path'         => __DIR__ . '/data/mathub.sqlite',

  // Security tuning (sensible defaults).
  'code_ttl_minutes'    => 15,   // how long a 6-digit email code stays valid
  'session_days'        => 180,  // how long a login lasts on a device
  'max_data_bytes'      => 600000, // per course per user progress blob
];
