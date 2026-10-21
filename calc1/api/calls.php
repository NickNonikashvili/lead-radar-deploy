<?php
/* ============================================================
   Mathub account server — calls with Bo: what they cost and what is left
   - Mathub Max ($20 a month) includes call_included_minutes (60) of calls each month. More time is bought ahead, in
     packs of call_hour_minutes (60) for call_hour_price ($10): a one-time purchase through RevenueCat (the product
     call_hour_product, sold on the website through the Web Purchase Link call_hour_link). A call uses the month's
     included minutes first, then the hours bought, which never expire. Calls need Max; hours bought stay for when Max
     is back. Free minutes for everyone without Max stay in api/ai.php (ai_trial).
   - Purchases are read from RevenueCat's customer record (non_subscriptions) by their transaction id and counted
     once; one that is no longer there (refunded) is taken back. calls_sync asks at most once a minute, or at once after
     a checkout (refresh).
   - Administrators give or take minutes (admin_calls_grant), with a note only administrators see; the member is told
     in their inbox when they are given time.
   - call_credit: one row per purchase (+), gift (+ or -), refund (-) and call (-: the part of that call paid from the
     hours bought). call_month: the included minutes each member used each month.
   The pages: #/calls (assets/calls.js) for members, the admin panel's Calls tab (assets/admin.js).
   Routes: calls_status, calls_sync, admin_calls, admin_calls_grant
   Rows are removed with the account (ON DELETE CASCADE).
   ============================================================ */
declare(strict_types=1);

require_once __DIR__ . '/ai.php';

function mh_calls_db(): PDO {
  static $ready = false; $db = mh_ai_db();   // the calls themselves (ai_live) are Bo's tables
  if (!$ready) {
    $db->exec("CREATE TABLE IF NOT EXISTS call_credit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, secs INTEGER NOT NULL, ref TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', by_id INTEGER, created INTEGER NOT NULL, UNIQUE (user_id, kind, ref))");
    $db->exec('CREATE INDEX IF NOT EXISTS call_credit_user ON call_credit (user_id, created)');
    $db->exec('CREATE TABLE IF NOT EXISTS call_month (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, month TEXT NOT NULL, included_used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, month))');
    $ready = true;
  }
  return $db;
}
/** Rows whose account is gone (the cascade normally removes them). */
function mh_calls_prune(): int {
  $db = mh_calls_db(); $n = (int)$db->exec('DELETE FROM call_credit WHERE user_id NOT IN (SELECT id FROM users)');
  return $n + (int)$db->exec('DELETE FROM call_month WHERE user_id NOT IN (SELECT id FROM users)');
}

/** The prices and the purchase: minutes included with Max, minutes in a pack, its price, the products and the link. */
function mh_calls_cfg(array $cfg): array {
  $price = trim((string)($cfg['call_hour_price'] ?? '$10')) ?: '$10';
  return [
    'included' => 60 * max(0, (int)($cfg['call_included_minutes'] ?? 60)),
    'pack' => 60 * max(1, (int)($cfg['call_hour_minutes'] ?? 60)),
    'price' => $price, 'price_num' => (float)preg_replace('/[^0-9.]/', '', $price),
    'products' => array_values(array_filter(array_map('trim', explode(',', (string)($cfg['call_hour_product'] ?? 'mathub_call_hour'))))),
    'link' => trim((string)($cfg['call_hour_link'] ?? '')),
    'max_price' => (string)($cfg['max_web_price'] ?? '$20'),
  ];
}
function mh_calls_month(): string { return gmdate('Y-m'); }
/** Seconds of the month's included minutes this member has used. */
function mh_calls_included_used(int $uid): int {
  $st = mh_calls_db()->prepare('SELECT included_used FROM call_month WHERE user_id = ? AND month = ?'); $st->execute([$uid, mh_calls_month()]); return (int)$st->fetchColumn();
}
/** Seconds of call time bought or given, less what calls used and refunds took back. */
function mh_calls_balance(int $uid): int {
  $st = mh_calls_db()->prepare('SELECT COALESCE(SUM(secs), 0) FROM call_credit WHERE user_id = ?'); $st->execute([$uid]); return (int)$st->fetchColumn();
}
/** What is left for a Max member: the month's included minutes, the hours bought, and both together (seconds). */
function mh_calls_left(int $uid, array $cfg): array {
  $C = mh_calls_cfg($cfg); $used = mh_calls_included_used($uid); $inc = max(0, $C['included'] - $used); $bal = max(0, mh_calls_balance($uid));
  return ['included' => $C['included'], 'included_used' => min($used, $C['included']), 'included_left' => $inc, 'balance' => $bal, 'left' => $inc + $bal];
}
/** A call's minutes, as it goes: the month's included minutes first, then the hours bought (one row per call). */
function mh_calls_charge(int $uid, string $lid, int $d, array $cfg): void {
  if ($d <= 0) return; $db = mh_calls_db(); $C = mh_calls_cfg($cfg);
  $inc = min($d, max(0, $C['included'] - mh_calls_included_used($uid))); $paid = $d - $inc;
  if ($inc > 0) $db->prepare('INSERT INTO call_month (user_id, month, included_used) VALUES (?, ?, ?) ON CONFLICT(user_id, month) DO UPDATE SET included_used = included_used + excluded.included_used')->execute([$uid, mh_calls_month(), $inc]);
  if ($paid > 0) $db->prepare("INSERT INTO call_credit (user_id, kind, secs, ref, created) VALUES (?, 'use', ?, ?, ?) ON CONFLICT(user_id, kind, ref) DO UPDATE SET secs = secs + excluded.secs")->execute([$uid, -$paid, $lid, time()]);
}

/** Purchases of call hours, from RevenueCat: each new transaction adds a pack, one that is gone (refunded) takes it
    back. At most once a minute unless $force. Returns how many packs were added (-1 when RevenueCat was not asked). */
function mh_calls_sync(array $u, array $cfg, bool $force = false): int {
  $C = mh_calls_cfg($cfg); $uid = (int)$u['id'];
  if (trim((string)($cfg['revenuecat_secret'] ?? '')) === '' || !$C['products']) return -1;
  if (!mh_rate("calls_sync:$uid", $force ? 60 : 30, 3600) || (!$force && !mh_rate("calls_sync_min:$uid", 1, 60))) return -1;
  require_once __DIR__ . '/myclasses.php';
  $sub = mh_rc_subscriber($cfg, 'mh_' . $uid); if ($sub === null || !array_key_exists('non_subscriptions', $sub)) return -1;
  $db = mh_calls_db(); $seen = []; $added = 0; $ns = is_array($sub['non_subscriptions']) ? $sub['non_subscriptions'] : [];
  foreach ($C['products'] as $pid) foreach ((array)($ns[$pid] ?? []) as $t) {
    if (!is_array($t)) continue; $ref = mb_substr((string)($t['id'] ?? $t['store_transaction_id'] ?? ''), 0, 120); if ($ref === '') continue; $seen[$ref] = true;
    $at = !empty($t['purchase_date']) ? (int)strtotime((string)$t['purchase_date']) : time();
    $st = $db->prepare("INSERT OR IGNORE INTO call_credit (user_id, kind, secs, ref, note, created) VALUES (?, 'buy', ?, ?, ?, ?)"); $st->execute([$uid, $C['pack'], $ref, mb_substr($pid . ' · ' . (string)($t['store'] ?? ''), 0, 120), $at ?: time()]);
    if ($st->rowCount()) $added++;
  }
  // a purchase RevenueCat no longer lists was refunded: its time is taken back, once
  $st = $db->prepare("SELECT ref, secs FROM call_credit WHERE user_id = ? AND kind = 'buy'"); $st->execute([$uid]);
  foreach ($st->fetchAll() as $b) if (!isset($seen[$b['ref']])) $db->prepare("INSERT OR IGNORE INTO call_credit (user_id, kind, secs, ref, note, created) VALUES (?, 'refund', ?, ?, 'refunded', ?)")->execute([$uid, -(int)$b['secs'], $b['ref'], time()]);
  return $added;
}

/** A member's plan as last known (given, or what RevenueCat said last), without asking RevenueCat: for long lists. */
function mh_calls_plan_known(array $u, array $cfg): string {
  require_once __DIR__ . '/myclasses.php'; $g = mh_plan_grant($u, $cfg); if ($g === 'max') return 'max';
  $st = mh_myclass_db()->prepare('SELECT active, tier, expires FROM create_status WHERE user_id = ?'); $st->execute([(int)$u['id']]); $r = $st->fetch();
  $p = $r && (int)$r['active'] === 1 && ((int)$r['expires'] === 0 || (int)$r['expires'] > time()) ? ((string)$r['tier'] ?: 'pro') : '';
  return $p === 'max' ? 'max' : ($g ?: $p);
}
/** Everything the Calls page shows: the plan, what is left, the purchase, this month, the calls and the purchases. */
function mh_calls_status(array $u, array $cfg): array {
  $uid = (int)$u['id']; $C = mh_calls_cfg($cfg); $V = mh_ai_voice_settings($cfg); $plan = mh_plan($u, $cfg); $max = $plan === 'max';
  $L = mh_calls_left($uid, $cfg); $today = $V['live_daily'] - mh_ai_live_today($uid);
  $customer = 'mh_' . $uid;
  $out = ['ok' => true, 'plan' => $plan, 'max' => $max, 'enabled' => $V['key'] !== '', 'month' => mh_calls_month(), 'resets' => gmdate('Y-m-01', strtotime('first day of next month')),
    'included' => $L['included'], 'included_used' => $L['included_used'], 'included_left' => $max ? $L['included_left'] : 0, 'balance' => $L['balance'], 'left' => $max ? max(0, min($L['left'], $today)) : 0,
    'daily' => $V['live_daily'], 'today_left' => max(0, $today), 'per_call' => $V['live_call'],
    'price' => $C['price'], 'pack' => $C['pack'], 'max_price' => $C['max_price'],
    'buy' => $C['link'] !== '' ? rtrim($C['link'], '/') . '/' . rawurlencode($customer) : '', 'customer' => $customer,
    'voices' => MH_AI_LIVE_VOICES, 'voice_default' => $V['live_voice']];
  if (!$max && $V['trial'] > 0) $out['trial'] = mh_ai_trial_public($uid, $V);
  $db = mh_calls_db();
  // this month and the calls (newest first), with the part of each paid from the hours bought
  $from = (int)strtotime(gmdate('Y-m-01 00:00:00') . ' UTC');
  $st = $db->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(secs), 0) AS s FROM ai_live WHERE user_id = ? AND started >= ? AND call <> ""'); $st->execute([$uid, $from]); $m = $st->fetch();
  $out['this_month'] = ['calls' => (int)$m['n'], 'secs' => (int)$m['s']];
  $st = $db->prepare("SELECT l.id, l.cid, l.started, l.secs, l.trial, COALESCE(-c.secs, 0) AS paid FROM ai_live l LEFT JOIN call_credit c ON c.user_id = l.user_id AND c.kind = 'use' AND c.ref = l.id WHERE l.user_id = ? AND l.call <> '' ORDER BY l.started DESC LIMIT 40"); $st->execute([$uid]);
  $out['calls'] = array_map(fn($r) => ['at' => (int)$r['started'], 'cid' => (string)$r['cid'], 'secs' => (int)$r['secs'], 'paid' => (int)$r['paid'], 'free' => (int)$r['trial'] === 1], $st->fetchAll());
  $st = $db->prepare("SELECT kind, secs, note, created FROM call_credit WHERE user_id = ? AND kind <> 'use' ORDER BY created DESC LIMIT 40"); $st->execute([$uid]);
  $out['credits'] = array_map(fn($r) => ['kind' => $r['kind'], 'secs' => (int)$r['secs'], 'note' => $r['kind'] === 'grant' ? 'From Mathub' : ($r['kind'] === 'refund' ? 'Refunded' : 'Bought'), 'at' => (int)$r['created']], $st->fetchAll());
  return $out;
}

function mh_calls_route(string $route, array $in, array $cfg, string $ip): void {
  $db = mh_calls_db();
  switch ($route) {
    case 'calls_status': {
      mh_method('GET'); $u = mh_require_user();
      mh_calls_sync($u, $cfg, !empty($_GET['refresh']));
      mh_json(mh_calls_status($u, $cfg));
    }
    case 'calls_sync': {   // back from the checkout, or "I paid": ask RevenueCat now
      mh_method('POST'); $u = mh_require_user();
      $n = mh_calls_sync($u, $cfg, true);
      mh_json(mh_calls_status($u, $cfg) + ['added' => max(0, $n), 'asked' => $n >= 0]);
    }

    /* the admin panel's Calls tab: this month, everyone who called or has time, the purchases, and giving time */
    case 'admin_calls': {
      mh_method('GET'); $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      $C = mh_calls_cfg($cfg); $from = (int)strtotime(gmdate('Y-m-01 00:00:00') . ' UTC'); $month = mh_calls_month();
      $t = $db->query("SELECT COUNT(*) AS n, COALESCE(SUM(secs), 0) AS s, COALESCE(SUM(CASE WHEN trial = 1 THEN secs ELSE 0 END), 0) AS free, COUNT(DISTINCT user_id) AS people FROM ai_live WHERE call <> '' AND started >= $from")->fetch();
      $b = $db->query("SELECT COALESCE(SUM(kind = 'buy'), 0) AS sold, COALESCE(SUM(CASE WHEN kind = 'refund' THEN 1 ELSE 0 END), 0) AS refunds, COALESCE(SUM(CASE WHEN kind = 'grant' THEN secs ELSE 0 END), 0) AS given, COALESCE(SUM(CASE WHEN kind = 'use' THEN -secs ELSE 0 END), 0) AS paid_used FROM call_credit WHERE created >= $from")->fetch();
      $inc = $db->prepare('SELECT COALESCE(SUM(included_used), 0) FROM call_month WHERE month = ?'); $inc->execute([$month]);
      $all = $db->query("SELECT COALESCE(SUM(kind = 'buy'), 0) AS sold, COALESCE(SUM(kind = 'refund'), 0) AS refunds FROM call_credit")->fetch();
      $net = (int)$b['sold'] - (int)$b['refunds'];
      // members: who called this month, or has time bought or given
      $rows = $db->query("SELECT u.id, u.email, u.name,
          (SELECT COALESCE(SUM(secs), 0) FROM ai_live l WHERE l.user_id = u.id AND l.call <> '' AND l.started >= $from) AS month_secs,
          (SELECT COUNT(*) FROM ai_live l WHERE l.user_id = u.id AND l.call <> '' AND l.started >= $from) AS month_calls,
          (SELECT COALESCE(SUM(secs), 0) FROM call_credit c WHERE c.user_id = u.id) AS balance,
          (SELECT COALESCE(SUM(kind = 'buy'), 0) FROM call_credit c WHERE c.user_id = u.id) AS bought,
          (SELECT included_used FROM call_month m WHERE m.user_id = u.id AND m.month = " . $db->quote($month) . ") AS inc_used
        FROM users u WHERE u.id IN (SELECT user_id FROM ai_live WHERE call <> '' AND started >= $from UNION SELECT user_id FROM call_credit)
        ORDER BY month_secs DESC, balance DESC LIMIT 300")->fetchAll();
      $people = array_map(fn($r) => ['id' => (int)$r['id'], 'email' => (string)$r['email'], 'name' => (string)$r['name'], 'plan' => mh_calls_plan_known($r, $cfg), 'month_secs' => (int)$r['month_secs'], 'month_calls' => (int)$r['month_calls'], 'included_used' => min((int)$r['inc_used'], $C['included']), 'balance' => max(0, (int)$r['balance']), 'bought' => (int)$r['bought']], $rows);
      $st = $db->query("SELECT c.kind, c.secs, c.note, c.created, u.email, a.email AS by_email FROM call_credit c LEFT JOIN users u ON u.id = c.user_id LEFT JOIN users a ON a.id = c.by_id WHERE c.kind <> 'use' ORDER BY c.created DESC LIMIT 60");
      $log = array_map(fn($r) => ['kind' => $r['kind'], 'secs' => (int)$r['secs'], 'note' => (string)$r['note'], 'at' => (int)$r['created'], 'email' => (string)($r['email'] ?? ''), 'by' => (string)($r['by_email'] ?? '')], $st->fetchAll());
      mh_json(['ok' => true, 'month' => $month,
        'settings' => ['included_minutes' => intdiv($C['included'], 60), 'pack_minutes' => intdiv($C['pack'], 60), 'price' => $C['price'], 'max_price' => $C['max_price'], 'products' => $C['products'], 'link' => $C['link'] !== '', 'revenuecat' => trim((string)($cfg['revenuecat_secret'] ?? '')) !== '', 'daily_minutes' => intdiv(mh_ai_voice_settings($cfg)['live_daily'], 60), 'per_call_minutes' => intdiv(mh_ai_voice_settings($cfg)['live_call'], 60)],
        'totals' => ['calls' => (int)$t['n'], 'secs' => (int)$t['s'], 'free_secs' => (int)$t['free'], 'people' => (int)$t['people'], 'included_secs' => (int)$inc->fetchColumn(), 'paid_secs' => (int)$b['paid_used'], 'hours_sold' => (int)$b['sold'], 'refunds' => (int)$b['refunds'], 'given_secs' => (int)$b['given'], 'revenue' => round($net * $C['price_num'], 2), 'all_hours_sold' => (int)$all['sold'] - (int)$all['refunds']],
        'people' => $people, 'log' => $log]);
    }
    case 'admin_calls_grant': {
      mh_method('POST'); $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      $email = strtolower(trim((string)($in['email'] ?? ''))); $min = (int)($in['minutes'] ?? 0); $note = mb_substr(trim((string)($in['note'] ?? '')), 0, 200);
      if ($min === 0 || abs($min) > 6000) mh_fail('Give between 1 and 6000 minutes (or take some back with a minus sign).');
      $st = mh_db()->prepare('SELECT * FROM users WHERE lower(email) = ?'); $st->execute([$email]); $m = $st->fetch(); if (!$m) mh_fail('No member with that email.', 404);
      if ($min < 0 && mh_calls_balance((int)$m['id']) + 60 * $min < 0) mh_fail('They do not have that much time to take back.');
      $db->prepare("INSERT INTO call_credit (user_id, kind, secs, ref, note, by_id, created) VALUES (?, 'grant', ?, ?, ?, ?, ?)")->execute([(int)$m['id'], 60 * $min, bin2hex(random_bytes(8)), $note, (int)$u['id'], time()]);
      if ($min > 0 && !empty($in['tell'])) {
        try { require_once __DIR__ . '/forum.php'; require_once __DIR__ . '/requests.php'; mh_req_notify((int)$m['id'], ['id' => (int)mh_system_user()['id'], 'name' => 'Mathub'], 'calls', 'Time with Bo', "Mathub gave you $min minutes of calls with Bo.", '#/calls'); } catch (Throwable $e) {}
      }
      mh_json(['ok' => true, 'balance' => max(0, mh_calls_balance((int)$m['id']))]);
    }
  }
  mh_fail('Not found.', 404);
}
