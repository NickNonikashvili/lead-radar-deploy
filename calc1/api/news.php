<?php
/* ============================================================
   Mathub — news emails: one email the administrator writes and sends to every member (assets/admin.js, Email everyone).
   - Only verified members who have not turned news off get it (users.news_email, Settings → Account, or the link in the email).
   - Each email has a one-click way out: a link to #/unsubscribe (a page with one button, so mail scanners that open
     links do not unsubscribe anyone) and List-Unsubscribe headers for mail apps (a signed POST, no login needed).
   - Sending: news (one row per email), news_sent (one row per member it went to, so nobody gets it twice). The admin
     page sends a batch every few seconds while it is open; housekeeping (api/social.php) sends a few on every visit.
     Many failures in a row pause it, with the mail server's error.
   - Placeholders: {name} (first name, or "there"), {credits} (the credits every free account gets each month,
     credits_free) and {minutes} (about how many minutes of calls those make, at credits_call_light a minute).
   Routes: news_unsub (GET: is this link good; POST: stop or start news), admin_news (GET: the draft, how many get it,
   the last send), admin_news_preview, admin_news_test, admin_news_send, admin_news_step, admin_news_pause.
   ============================================================ */

function mh_news_db(): PDO {
  static $ok = false; $db = mh_db(); if ($ok) return $db; $ok = true;
  $db->exec('CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, body TEXT NOT NULL, button TEXT NOT NULL DEFAULT "", link TEXT NOT NULL DEFAULT "", created INTEGER NOT NULL, created_by INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT "")');
  $db->exec('CREATE TABLE IF NOT EXISTS news_sent (news_id INTEGER NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, at INTEGER NOT NULL, ok INTEGER NOT NULL DEFAULT -1, PRIMARY KEY (news_id, user_id))');
  return $db;
}
function mh_news_url(): string { $cfg = mh_config(); return rtrim((string)(($cfg['site_url'] ?? '') ?: ('https://' . ($_SERVER['HTTP_HOST'] ?? 'mathub.space'))), '/'); }
function mh_news_token(int $uid): string { return substr(hash_hmac('sha256', 'news-unsub:' . $uid, mh_secret()), 0, 32); }
function mh_news_credits(): int { require_once __DIR__ . '/credits.php'; return (int)mh_credits_cfg(mh_config())['free']; }
function mh_news_minutes(): int { require_once __DIR__ . '/credits.php'; $C = mh_credits_cfg(mh_config()); return $C['call_light'] > 0 ? (int)floor($C['free'] / $C['call_light']) : 0; }

/** The email that tells everyone Bo is on every account now, paid in free monthly credits, ready to send as it is. */
function mh_news_default(): array {
  return mh_news_credits() > 0 ? [
    'subject' => 'Bo is on every account now: {credits} free credits a month',
    'body' => "Hi {name},\n\nStuck on a problem? Bo, the tutor on Mathub, is now on every account.\n\nAsk him anything, call him and talk it through, or have him draw it: graphs, 3D surfaces, diagrams, even pictures.\n\nEvery month you get {credits} credits for him, free. That is about {minutes} minutes on a call, or plenty of questions. No card needed.",
    'button' => 'Call Bo', 'link' => '#/max',
  ] : [
    'subject' => 'New on Mathub: call Bo',
    'body' => "Hi {name},\n\nStuck on a problem? Now you can call Bo, the tutor on Mathub.\n\nYou talk. You write on a board you share. He shows you where it went wrong, like a tutor with a pen.\n\nSee a call in a minute:",
    'button' => 'Watch a call with Bo', 'link' => '#/max',
  ];
}
/** The draft from the admin page, checked. */
function mh_news_draft(array $in): array {
  $d = ['subject' => mh_str($in, 'subject', 140), 'body' => trim(mb_substr((string)($in['body'] ?? ''), 0, 4000)), 'button' => mh_str($in, 'button', 40), 'link' => mh_str($in, 'link', 300)];
  if ($d['subject'] === '') mh_fail('Write a subject.');
  if ($d['body'] === '') mh_fail('Write the message.');
  if ($d['button'] !== '' && !preg_match('~^(#/|/|https://)~', $d['link'])) mh_fail('The button needs a link on Mathub (like #/max) or one that starts with https://.');
  return $d;
}
/** Subject, plain text and HTML of one news email for one member. */
function mh_news_render(array $n, array $u): array {
  $cfg = mh_config(); $site = $cfg['site_name'] ?? 'Mathub'; $url = mh_news_url();
  $first = trim(explode(' ', trim((string)($u['name'] ?? '')))[0] ?? ''); if ($first === '' || str_contains($first, '@')) $first = 'there';
  $fill = fn(string $s) => strtr($s, ['{name}' => $first, '{credits}' => number_format(mh_news_credits()), '{minutes}' => (string)mh_news_minutes()]);
  $subject = $fill($n['subject']); $body = $fill($n['body']);
  $link = (string)($n['link'] ?? ''); if ($link !== '' && $link[0] === '#') $link = $url . '/' . $link; elseif ($link !== '' && $link[0] === '/') $link = $url . $link;
  $unsub = $url . '/#/unsubscribe?u=' . (int)$u['id'] . '&t=' . mh_news_token((int)$u['id']);
  $paras = array_values(array_filter(array_map('trim', preg_split('/\n\s*\n/', str_replace("\r", '', $body))), fn($p) => $p !== ''));
  $text = implode("\n\n", $paras) . ($n['button'] !== '' ? "\n\n" . $fill($n['button']) . ': ' . $link : '') . "\n\n— $site\n\nYou get this because you have a $site account. Stop these emails: $unsub (or in Settings → Account).";
  $p = fn(string $s) => '<p style="margin:0 0 14px">' . nl2br(htmlspecialchars($s, ENT_QUOTES)) . '</p>';
  $btn = $n['button'] !== '' ? '<p style="margin:22px 0 6px"><a href="' . htmlspecialchars($link, ENT_QUOTES) . '" style="display:inline-block;background:#1A64D6;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:14px 24px;border-radius:14px;border-bottom:4px solid #1450B0">' . htmlspecialchars($fill($n['button']), ENT_QUOTES) . ' &rarr;</a></p>' : '';
  $html = '<!doctype html><html><body style="margin:0;padding:0;background:#EEF4FF"><div style="background:#EEF4FF;padding:24px 12px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif">'
    . '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #D6E2F5;border-radius:20px;overflow:hidden">'
    . '<div style="background:#1A64D6;padding:16px 24px"><img src="' . $url . '/assets/icon-192.png" width="36" height="36" alt="" style="vertical-align:middle;border-radius:9px"> <span style="vertical-align:middle;margin-left:8px;color:#ffffff;font-size:20px;font-weight:800">' . htmlspecialchars($site, ENT_QUOTES) . '</span></div>'
    . '<div style="padding:26px 24px 20px;color:#0F172A;font-size:16px;line-height:1.55"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">' . htmlspecialchars($subject, ENT_QUOTES) . '</h1>' . implode('', array_map($p, $paras)) . $btn . '</div>'
    . '<div style="padding:14px 24px 18px;border-top:1px solid #E2E8F0;color:#64748B;font-size:13px;line-height:1.5">You get this because you have a ' . htmlspecialchars($site, ENT_QUOTES) . ' account. <a href="' . htmlspecialchars($unsub, ENT_QUOTES) . '" style="color:#64748B">Stop these emails</a>, or turn them off in Settings &rarr; Account.</div>'
    . '</div></div></body></html>';
  $headers = ['List-Unsubscribe' => '<' . $url . '/api/index.php?r=news_unsub&u=' . (int)$u['id'] . '&t=' . mh_news_token((int)$u['id']) . '>', 'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click'];
  return [$subject, $text, $html, $headers];
}
function mh_news_who(): string { return 'verified = 1 AND news_email = 1 AND email NOT LIKE "%@system.local"'; }
function mh_news_count(): int { return (int)mh_news_db()->query('SELECT COUNT(*) FROM users WHERE ' . mh_news_who())->fetchColumn(); }
function mh_news_current(): ?array { $r = mh_news_db()->query('SELECT * FROM news ORDER BY id DESC LIMIT 1')->fetch(); return $r ?: null; }
function mh_news_public(?array $n): ?array {
  if (!$n) return null;
  return ['id' => (int)$n['id'], 'subject' => $n['subject'], 'created' => (int)$n['created'], 'total' => (int)$n['total'], 'sent' => (int)$n['sent'], 'failed' => (int)$n['failed'], 'paused' => (int)$n['paused'] === 1, 'done' => (int)$n['done'] === 1, 'error' => $n['error']];
}
/** Sends the next few emails of the news being sent. Returns how many went out. */
function mh_news_tick(int $max): int {
  if ($max <= 0) return 0; $db = mh_news_db();
  $n = $db->query('SELECT * FROM news WHERE done = 0 AND paused = 0 ORDER BY id LIMIT 1')->fetch(); if (!$n) return 0;
  $st = $db->prepare('SELECT * FROM users u WHERE ' . mh_news_who() . ' AND u.created <= ? AND NOT EXISTS (SELECT 1 FROM news_sent s WHERE s.news_id = ? AND s.user_id = u.id) ORDER BY u.id LIMIT ?');
  $st->execute([$n['created'], $n['id'], $max]); $users = $st->fetchAll();
  if (!$users) { $db->prepare('UPDATE news SET done = 1 WHERE id = ?')->execute([$n['id']]); return 0; }
  require_once __DIR__ . '/mailer.php'; $cfg = mh_config(); $sent = 0; $fails = 0; $err = '';
  foreach ($users as $u) {
    $claim = $db->prepare('INSERT OR IGNORE INTO news_sent (news_id, user_id, at, ok) VALUES (?, ?, ?, -1)'); $claim->execute([$n['id'], $u['id'], time()]);
    if ($claim->rowCount() === 0) continue;   // another request took this one
    try { [$s, $t, $h, $x] = mh_news_render($n, $u); $r = mh_send_mail($cfg, $u['email'], $s, $t, $h, $x); } catch (Throwable $e) { $r = ['ok' => false, 'error' => $e->getMessage()]; }
    $db->prepare('UPDATE news_sent SET ok = ? WHERE news_id = ? AND user_id = ?')->execute([$r['ok'] ? 1 : 0, $n['id'], $u['id']]);
    $db->prepare('UPDATE news SET ' . ($r['ok'] ? 'sent = sent + 1' : 'failed = failed + 1') . ' WHERE id = ?')->execute([$n['id']]);
    if ($r['ok']) $sent++; else { $fails++; $err = (string)($r['error'] ?? 'The mail server said no.'); }
  }
  if ($fails >= 3 && $sent === 0) $db->prepare('UPDATE news SET paused = 1, error = ? WHERE id = ?')->execute([mb_substr($err, 0, 300), $n['id']]);   // the mail server is refusing: stop and say why
  return $sent;
}

function mh_news_route(string $route, array $in, array $cfg, string $ip): void {
  $db = mh_news_db(); $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if ($route === 'news_unsub') {
    // a signed link: no login. GET says whether it is good (the #/unsubscribe page); POST stops (or, with on: 1, starts) news.
    // Mail apps' one-click unsubscribe POSTs here without the site's header, so this route checks the signature instead.
    $uid = (int)($in['u'] ?? $_GET['u'] ?? 0); $tok = (string)($in['t'] ?? $_GET['t'] ?? '');
    $st = $db->prepare('SELECT id, email, news_email FROM users WHERE id = ?'); $st->execute([$uid]); $u = $st->fetch();
    if (!$u || !hash_equals(mh_news_token($uid), $tok)) mh_fail('This link does not work any more. Turn emails off in Settings → Account instead.', 404);
    [$local, $dom] = array_pad(explode('@', (string)$u['email'], 2), 2, ''); $masked = mb_substr($local, 0, 2) . '…@' . $dom;
    if ($method === 'GET') mh_json(['ok' => true, 'email' => $masked, 'on' => (int)$u['news_email'] === 1]);
    if ($method !== 'POST') mh_fail('Method not allowed.', 405);
    mh_rate_or_fail('news_unsub:' . $ip, 30, 3600);
    $on = !empty($in['on']) ? 1 : 0; $db->prepare('UPDATE users SET news_email = ? WHERE id = ?')->execute([$on, $uid]);
    mh_json(['ok' => true, 'email' => $masked, 'on' => $on === 1]);
  }
  if (!str_starts_with($route, 'admin_news')) return;
  $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
  switch ($route) {
    case 'admin_news':
      mh_method('GET');
      mh_json(['ok' => true, 'draft' => mh_news_default(), 'recipients' => mh_news_count(), 'minutes' => mh_news_minutes(), 'credits' => mh_news_credits(), 'news' => mh_news_public(mh_news_current()), 'mail' => (function () use ($cfg) { require_once __DIR__ . '/mailer.php'; return mh_mail_mode($cfg); })(), 'me' => $u['email']]);
    case 'admin_news_preview': {
      mh_method('POST'); $d = mh_news_draft($in); [$s, $t, $h] = mh_news_render($d, $u);
      mh_json(['ok' => true, 'subject' => $s, 'text' => $t, 'html' => $h]);
    }
    case 'admin_news_test': {
      mh_method('POST'); mh_rate_or_fail('news_test:' . $u['id'], 20, 3600); $d = mh_news_draft($in);
      require_once __DIR__ . '/mailer.php'; [$s, $t, $h, $x] = mh_news_render($d, $u); $r = mh_send_mail($cfg, $u['email'], $s, $t, $h, $x);
      if (!$r['ok']) mh_fail('Could not send: ' . ($r['error'] ?? 'unknown error'), 502);
      mh_json(['ok' => true, 'message' => 'Test sent to ' . $u['email']]);
    }
    case 'admin_news_send': {
      mh_method('POST'); $d = mh_news_draft($in);
      if (($in['confirm'] ?? '') !== 'send') mh_fail('Confirm the send first.');
      $cur = mh_news_current(); if ($cur && !(int)$cur['done']) mh_fail('An email is still being sent. Let it finish (or stop it) first.', 409);
      $total = mh_news_count(); if (!$total) mh_fail('Nobody would get it: no verified member has news emails on.');
      $db->prepare('INSERT INTO news (subject, body, button, link, created, created_by, total) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$d['subject'], $d['body'], $d['button'], $d['link'], time(), $u['id'], $total]);
      mh_news_tick(10);
      mh_json(['ok' => true, 'news' => mh_news_public(mh_news_current())]);
    }
    case 'admin_news_step': {
      mh_method('POST'); mh_news_tick(max(1, min(25, (int)($in['n'] ?? 10))));
      mh_json(['ok' => true, 'news' => mh_news_public(mh_news_current())]);
    }
    case 'admin_news_pause': {
      mh_method('POST'); $cur = mh_news_current(); if (!$cur || (int)$cur['done']) mh_fail('Nothing is being sent.');
      $p = !empty($in['paused']) ? 1 : 0; $stop = !empty($in['stop']);
      $db->prepare('UPDATE news SET paused = ?, done = ?, error = "" WHERE id = ?')->execute([$stop ? 1 : $p, $stop ? 1 : 0, $cur['id']]);
      mh_json(['ok' => true, 'news' => mh_news_public(mh_news_current())]);
    }
  }
  mh_fail('Unknown route.', 404);
}
