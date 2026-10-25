<?php
/* ============================================================
   Mathub account server — credits: what everything with AI costs, metered like Claude's usage
   - 1 credit is about 1¢. Every plan gets credits each month, back to full on the 1st (UTC): credits_free (100),
     credits_pro (1,000), credits_max (2,000). More are bought ahead, credits_pack (1,000) for credits_pack_price ($10):
     a one-time purchase through RevenueCat (credits_product, sold on the website through credits_link). Bought and
     given credits never expire. Everything uses the month's credits first, then the ones bought.
   - What things cost comes from what they really cost Mathub, times credits_markup (1 credit = 1¢):
       chat, voice answers, recaps, summaries: by their tokens, at the model's price (credits_prices; cache reads
         at a tenth, cache writes at 1.25×), through mh_credits_ai(), which every call to Anthropic goes through
       calls: per minute, by the call's model (credits_call_strong 17 for Max's model, credits_call_light 6)
       pictures: credits_image (15) a picture, credits_image_big (22) wide or tall
       Bo's voice: credits_tts per 1,000 characters (1.5); listening: credits_stt per minute (1)
     Administrators are never charged (what they use is still written down, at 0).
   - credit_use: one row per use (feature, credits in thousandths, the part from the month and the part from the
     bought ones, a short detail; a call is one row that grows). credit_add: purchases (+), gifts (+ or −) and refunds
     (−). Call hours bought before 2026.10.22 (call_credit) became credits once, 1,000 an hour.
   The pages: #/usage (assets/usage.js) and the admin panel's Credits tab (assets/admin.js).
   Routes: credits_status, credits_sync, admin_credits, admin_credits_grant. Rows go with the account (ON DELETE CASCADE).
   ============================================================ */
declare(strict_types=1);

require_once __DIR__ . '/ai.php';

const MH_CREDIT_FEATURES = ['chat' => 'Chat with Bo', 'call' => 'Calls with Bo', 'image' => 'Pictures', 'voice' => 'Bo’s voice and listening', 'recap' => 'Recaps after calls', 'memory' => 'Keeping Bo’s memory short', 'class' => 'Building classes', 'draft' => 'Draft feedback', 'other' => 'Other'];

function mh_credits_db(): PDO {
  static $ready = false; $db = mh_ai_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS credit_use (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, at INTEGER NOT NULL, feature TEXT NOT NULL, mc INTEGER NOT NULL, month_mc INTEGER NOT NULL DEFAULT 0, paid_mc INTEGER NOT NULL DEFAULT 0, ref TEXT NOT NULL DEFAULT \'\', detail TEXT NOT NULL DEFAULT \'\')');
    $db->exec('CREATE INDEX IF NOT EXISTS credit_use_user ON credit_use (user_id, at)');
    $db->exec('CREATE INDEX IF NOT EXISTS credit_use_ref ON credit_use (user_id, feature, ref)');
    $db->exec("CREATE TABLE IF NOT EXISTS credit_add (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, mc INTEGER NOT NULL, ref TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', by_id INTEGER, created INTEGER NOT NULL, UNIQUE (user_id, kind, ref))");
    $ready = true;
  }
  return $db;
}
function mh_credits_prune(): int {
  $db = mh_credits_db(); $old = time() - 400 * 86400;   // what was used is kept about 13 months (the privacy policy says so); what was added stays, it is the balance
  $n = (int)$db->exec('DELETE FROM credit_use WHERE user_id NOT IN (SELECT id FROM users)') + (int)$db->exec('DELETE FROM credit_add WHERE user_id NOT IN (SELECT id FROM users)');
  // the bought credits those old uses took stay taken: one 'used' row each, so the balance (added − used) does not change
  $db->beginTransaction();
  try {
    foreach ($db->query("SELECT user_id, SUM(paid_mc) AS p FROM credit_use WHERE at < $old GROUP BY user_id HAVING p > 0")->fetchAll() as $r)
      $db->prepare("INSERT OR IGNORE INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'used', ?, ?, 'Bought credits used over a year ago', ?)")->execute([(int)$r['user_id'], -(int)$r['p'], 'old:' . $old, time()]);
    $n += (int)$db->exec("DELETE FROM credit_use WHERE at < $old"); $db->commit();
  } catch (Throwable $e) { $db->rollBack(); error_log('mathub credits prune: ' . $e->getMessage()); }
  return $n;
}

/** The prices: monthly credits per plan, the pack, what things cost. */
function mh_credits_cfg(array $cfg): array {
  $n = fn(string $k, float $d) => is_numeric($cfg[$k] ?? null) ? max(0.0, (float)$cfg[$k]) : $d;
  $price = trim((string)($cfg['credits_pack_price'] ?? '$10')) ?: '$10';
  $prices = ['claude-haiku-5-5' => [1.0, 5.0], 'claude-sonnet-5-5' => [3.0, 15.0], 'claude-opus-5-5' => [5.0, 25.0]];   // USD per million tokens, in and out
  if (is_array($cfg['credits_prices'] ?? null)) foreach ($cfg['credits_prices'] as $m => $p) if (is_array($p) && count($p) >= 2) $prices[(string)$m] = [(float)$p[0], (float)$p[1]];
  return [
    'free' => (int)$n('credits_free', 100), 'pro' => (int)$n('credits_pro', 1000), 'max' => (int)$n('credits_max', 2000),
    'pack' => max(1, (int)$n('credits_pack', 1000)), 'price' => $price, 'price_num' => (float)preg_replace('/[^0-9.]/', '', $price),
    'products' => array_values(array_filter(array_map('trim', explode(',', (string)($cfg['credits_product'] ?? 'mathub_credits'))))),
    'hour_products' => array_values(array_filter(array_map('trim', explode(',', (string)($cfg['call_hour_product'] ?? 'mathub_call_hour'))))),   // bought before as call hours: 1,000 credits each
    'link' => trim((string)($cfg['credits_link'] ?? ($cfg['call_hour_link'] ?? ''))),
    'markup' => $n('credits_markup', 2.0), 'prices' => $prices,
    'call_strong' => $n('credits_call_strong', 17), 'call_light' => $n('credits_call_light', 6),
    'image' => $n('credits_image', 15), 'image_big' => $n('credits_image_big', 22), 'tts' => $n('credits_tts', 1.5), 'stt' => $n('credits_stt', 1),
    'pro_price' => (string)($cfg['pro_web_price'] ?? '$15'), 'max_price' => (string)($cfg['max_web_price'] ?? '$20'),
  ];
}
function mh_credits_month_start(): int { return (int)strtotime(gmdate('Y-m-01 00:00:00') . ' UTC'); }
/** A plan's credits for the month, in thousandths. */
function mh_credits_allowance(string $plan, array $C): int { return 1000 * ($plan === 'max' ? $C['max'] : ($plan !== '' ? $C['pro'] : $C['free'])); }
function mh_credits_month_used(int $uid): int {
  $st = mh_credits_db()->prepare('SELECT COALESCE(SUM(month_mc), 0) FROM credit_use WHERE user_id = ? AND at >= ?'); $st->execute([$uid, mh_credits_month_start()]); return (int)$st->fetchColumn();
}
function mh_credits_paid(int $uid): int {
  mh_credits_migrate($uid);
  $db = mh_credits_db(); $a = $db->prepare('SELECT COALESCE(SUM(mc), 0) FROM credit_add WHERE user_id = ?'); $a->execute([$uid]);
  $b = $db->prepare('SELECT COALESCE(SUM(paid_mc), 0) FROM credit_use WHERE user_id = ?'); $b->execute([$uid]);
  return (int)$a->fetchColumn() - (int)$b->fetchColumn();
}
/** What is left: the month's credits, the bought ones, and both (thousandths; the bought ones can be below 0 after a refund). */
function mh_credits_left(array $u, array $cfg, ?string $plan = null): array {
  $C = mh_credits_cfg($cfg); $uid = (int)$u['id']; $plan = $plan ?? mh_plan($u, $cfg); $all = mh_credits_allowance($plan, $C);
  $used = mh_credits_month_used($uid); $month = max(0, $all - $used); $paid = mh_credits_paid($uid);
  return ['plan' => $plan, 'allowance' => $all, 'month_used' => min($used, $all), 'month_left' => $month, 'paid' => $paid, 'left' => $month + max(0, $paid), 'admin' => mh_is_admin($u)];
}
/** Call hours bought before credits (call_credit) become credits, once: 1,000 an hour, so 16⅔ a minute. */
function mh_credits_migrate(int $uid): void {
  static $done = [];
  if (isset($done[$uid])) return; $done[$uid] = true; $db = mh_credits_db();
  if (!$db->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'call_credit'")->fetchColumn()) return;
  $st = $db->prepare("SELECT 1 FROM credit_add WHERE user_id = ? AND kind = 'gift' AND ref = 'call-hours'"); $st->execute([$uid]); if ($st->fetchColumn()) return;
  $st = $db->prepare('SELECT COALESCE(SUM(secs), 0) FROM call_credit WHERE user_id = ?'); $st->execute([$uid]); $secs = (int)$st->fetchColumn();
  if ($secs > 0) $db->prepare("INSERT OR IGNORE INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'gift', ?, 'call-hours', 'Call time bought before, as credits', ?)")->execute([$uid, (int)round($secs * 1000 * 1000 / 3600), time()]);
}

/** Spend: the month's credits first, then the bought ones. A ref (a call) makes one row that grows. Returns thousandths spent. */
function mh_credits_spend(array $u, string $feature, int $mc, string $ref, string $detail, array $cfg): int {
  if ($mc <= 0) return 0; $uid = (int)$u['id']; $db = mh_credits_db(); $feature = isset(MH_CREDIT_FEATURES[$feature]) ? $feature : 'other';
  if (mh_is_admin($u)) { $fromMonth = $fromPaid = 0; }   // administrators: written down, never charged
  else { $L = mh_credits_left($u, $cfg); $fromMonth = min($mc, $L['month_left']); $fromPaid = $mc - $fromMonth; }
  $detail = mb_substr(trim(preg_replace('/\s+/u', ' ', $detail)), 0, 160);
  if ($ref !== '') {
    $st = $db->prepare('SELECT id FROM credit_use WHERE user_id = ? AND feature = ? AND ref = ? ORDER BY id DESC LIMIT 1'); $st->execute([$uid, $feature, $ref]); $id = $st->fetchColumn();
    if ($id) { $db->prepare('UPDATE credit_use SET mc = mc + ?, month_mc = month_mc + ?, paid_mc = paid_mc + ?, detail = CASE WHEN ? <> \'\' THEN ? ELSE detail END WHERE id = ?')->execute([$mc, $fromMonth, $fromPaid, $detail, $detail, $id]); return $mc; }
  }
  $db->prepare('INSERT INTO credit_use (user_id, at, feature, mc, month_mc, paid_mc, ref, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$uid, time(), $feature, $mc, $fromMonth, $fromPaid, $ref, $detail]);
  return $mc;
}
/** Credits Mathub gives (an invite, a thank-you): once per ref; up to $cap credits in all for refs starting with $capRef. */
function mh_credits_gift(int $uid, int $credits, string $ref, string $note, int $cap = 0, string $capRef = ''): int {
  if ($credits <= 0) return 0; $db = mh_credits_db();
  if ($cap > 0) { $st = $db->prepare("SELECT COALESCE(SUM(mc), 0) FROM credit_add WHERE user_id = ? AND kind = 'gift' AND ref LIKE ?"); $st->execute([$uid, $capRef . '%']); $credits = min($credits, max(0, $cap - intdiv((int)$st->fetchColumn(), 1000))); if ($credits <= 0) return 0; }
  $st = $db->prepare("INSERT OR IGNORE INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'gift', ?, ?, ?, ?)"); $st->execute([$uid, 1000 * $credits, $ref, $note, time()]);
  return $st->rowCount() ? $credits : 0;
}
/** Stop here when they cannot pay for $mc (thousandths): 402, credits. Administrators always can. */
function mh_credits_need(array $u, int $mc, array $cfg, string $what = 'that'): void {
  if (mh_is_admin($u)) return;
  $L = mh_credits_left($u, $cfg); if ($L['left'] >= $mc) return;
  if (mh_credits_sync($u, $cfg) > 0) { $L = mh_credits_left($u, $cfg); if ($L['left'] >= $mc) return; }   // bought a moment ago
  mh_fail($L['left'] <= 0 ? 'You’re out of credits. Get more on the Usage page, or wait for the 1st, when your monthly credits come back.' : "You don’t have enough credits for $what. Get more on the Usage page.", 402, ['credits' => true, 'left' => intdiv($L['left'], 1000)]);
}

/* ---------- what Anthropic's answers cost: every call to the AI says who it was for (mh_credits_for) ---------- */
function mh_credits_for(?array $u, array $cfg, string $feature, string $detail = '', string $ref = ''): void { $GLOBALS['mh_credit_ctx'] = $u ? ['u' => $u, 'cfg' => $cfg, 'feature' => $feature, 'detail' => $detail, 'ref' => $ref] : null; }
/** Thousandths of a credit for tokens: in (plain), cache writes, cache reads, out, at the model's price. */
function mh_credits_tokens(string $model, int $in, int $cw, int $cr, int $out, array $C): int {
  $p = $C['prices'][$model] ?? null; if (!$p) foreach ($C['prices'] as $m => $q) if (str_starts_with($model, preg_replace('/-\d[\d-]*$/', '', $m))) { $p = $q; break; }
  $p = $p ?: [1.0, 5.0];
  $usd = ($in * $p[0] + $cw * $p[0] * 1.25 + $cr * $p[0] * 0.1 + $out * $p[1]) / 1e6;
  return (int)ceil($usd * 100 * $C['markup'] * 1000);
}
function mh_credits_ai(string $model, array $usage): void {
  $X = $GLOBALS['mh_credit_ctx'] ?? null; if (!$X) return;
  try {
    $cfg = $X['cfg']; $C = mh_credits_cfg($cfg);
    $mc = mh_credits_tokens($model, (int)($usage['plain'] ?? 0), (int)($usage['cw'] ?? 0), (int)($usage['cr'] ?? 0), (int)($usage['out'] ?? 0), $C);
    mh_credits_spend($X['u'], $X['feature'], max(1, $mc), $X['ref'], $X['detail'], $cfg);
  } catch (Throwable $e) { error_log('mathub credits: ' . $e->getMessage()); }
}
/** Credits a minute for a call on $model. */
function mh_credits_call_rate(string $model, array $V, array $C): float { return $model !== '' && $model === $V['live_model'] && $V['live_model'] !== ($V['live_model_max'] ?: $V['live_model']) ? $C['call_light'] : $C['call_strong']; }

/** Credit packs (and call hours bought before) from RevenueCat: a new transaction adds credits once; one that is gone
    (refunded) takes them back. At most once a minute unless $force. Returns how many purchases were added (-1: not asked). */
function mh_credits_sync(array $u, array $cfg, bool $force = false): int {
  $C = mh_credits_cfg($cfg); $uid = (int)$u['id'];
  if (trim((string)($cfg['revenuecat_secret'] ?? '')) === '' || (!$C['products'] && !$C['hour_products'])) return -1;
  if (!mh_rate("credits_sync:$uid", $force ? 60 : 30, 3600) || (!$force && !mh_rate("credits_sync_min:$uid", 1, 60))) return -1;
  require_once __DIR__ . '/myclasses.php';
  $sub = mh_rc_subscriber($cfg, 'mh_' . $uid); if ($sub === null || !array_key_exists('non_subscriptions', $sub)) return -1;
  $db = mh_credits_db(); $seen = []; $added = 0; $ns = is_array($sub['non_subscriptions']) ? $sub['non_subscriptions'] : [];
  $each = array_fill_keys($C['products'], $C['pack']) + array_fill_keys($C['hour_products'], 1000);
  foreach ($each as $pid => $credits) foreach ((array)($ns[$pid] ?? []) as $t) {
    if (!is_array($t)) continue; $ref = mb_substr((string)($t['id'] ?? $t['store_transaction_id'] ?? ''), 0, 120); if ($ref === '') continue; $seen[$ref] = true;
    $at = !empty($t['purchase_date']) ? (int)strtotime((string)$t['purchase_date']) : time();
    $st = $db->prepare("INSERT OR IGNORE INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'buy', ?, ?, ?, ?)"); $st->execute([$uid, 1000 * $credits, $ref, mb_substr($pid . ' · ' . (string)($t['store'] ?? ''), 0, 120), $at ?: time()]);
    if ($st->rowCount()) $added++;
  }
  $st = $db->prepare("SELECT ref, mc FROM credit_add WHERE user_id = ? AND kind = 'buy'"); $st->execute([$uid]);
  foreach ($st->fetchAll() as $b) if (!isset($seen[$b['ref']])) $db->prepare("INSERT OR IGNORE INTO credit_add (user_id, kind, mc, ref, note, created) VALUES (?, 'refund', ?, ?, 'refunded', ?)")->execute([$uid, -(int)$b['mc'], $b['ref'], time()]);
  return $added;
}

/** A plan as last known, without asking RevenueCat (for long lists). */
function mh_credits_plan_known(array $u, array $cfg): string {
  require_once __DIR__ . '/myclasses.php'; $g = mh_plan_grant($u, $cfg); if ($g === 'max') return 'max';
  $st = mh_myclass_db()->prepare('SELECT active, tier, expires FROM create_status WHERE user_id = ?'); $st->execute([(int)$u['id']]); $r = $st->fetch();
  $p = $r && (int)$r['active'] === 1 && ((int)$r['expires'] === 0 || (int)$r['expires'] > time()) ? ((string)$r['tier'] ?: 'pro') : '';
  return $p === 'max' ? 'max' : ($g ?: $p);
}
/** What things cost, to show: [what, credits, per]. */
function mh_credits_prices(array $C, array $V, string $plan): array {
  $chat = round(mh_credits_tokens('claude-haiku-5-5', 1500, 0, 9000, 450, $C) / 1000, 1);
  return [
    ['k' => 'chat', 't' => 'A message to Bo', 'c' => $chat, 'per' => 'about, each'],
    ['k' => 'call', 't' => $plan === 'max' ? 'A call with Bo (Max’s model)' : 'A call with Bo', 'c' => $plan === 'max' ? $C['call_strong'] : $C['call_light'], 'per' => 'a minute'],
    ['k' => 'image', 't' => 'A picture Bo makes', 'c' => $C['image'], 'per' => 'each (' . (int)$C['image_big'] . ' wide or tall)'],
    ['k' => 'voice', 't' => 'Bo’s voice in a chat', 'c' => $C['tts'], 'per' => 'a minute of reading, about'],
  ];
}
/** Everything the Usage page shows. */
function mh_credits_status(array $u, array $cfg): array {
  $uid = (int)$u['id']; $C = mh_credits_cfg($cfg); $V = mh_ai_voice_settings($cfg); $L = mh_credits_left($u, $cfg); $db = mh_credits_db(); $from = mh_credits_month_start();
  $k = fn(int $mc) => round($mc / 1000, 1);
  $st = $db->prepare('SELECT feature, COALESCE(SUM(mc), 0) AS mc, COUNT(*) AS n FROM credit_use WHERE user_id = ? AND at >= ? GROUP BY feature ORDER BY mc DESC'); $st->execute([$uid, $from]);
  $by = array_map(fn($r) => ['k' => (string)$r['feature'], 't' => MH_CREDIT_FEATURES[(string)$r['feature']] ?? 'Other', 'credits' => $k((int)$r['mc']), 'n' => (int)$r['n']], $st->fetchAll());
  $st = $db->prepare("SELECT strftime('%Y-%m-%d', at, 'unixepoch') AS d, COALESCE(SUM(mc), 0) AS mc FROM credit_use WHERE user_id = ? AND at >= ? GROUP BY d ORDER BY d"); $st->execute([$uid, time() - 30 * 86400]);
  $days = array_map(fn($r) => ['d' => (string)$r['d'], 'credits' => $k((int)$r['mc'])], $st->fetchAll());
  $st = $db->prepare('SELECT at, feature, mc, detail FROM credit_use WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT 60'); $st->execute([$uid]);
  $recent = array_map(fn($r) => ['at' => (int)$r['at'], 'k' => (string)$r['feature'], 't' => MH_CREDIT_FEATURES[(string)$r['feature']] ?? 'Other', 'detail' => (string)$r['detail'], 'credits' => $k((int)$r['mc'])], $st->fetchAll());
  $st = $db->prepare("SELECT kind, mc, note, created FROM credit_add WHERE user_id = ? AND kind <> 'used' ORDER BY created DESC LIMIT 40"); $st->execute([$uid]);
  $label = fn($r) => (string)$r['kind'] === 'buy' ? 'Bought' : ((string)$r['kind'] === 'refund' ? 'Refunded' : ((string)$r['note'] === 'Call time bought before, as credits' ? (string)$r['note'] : 'From Mathub'));
  $adds = array_map(fn($r) => ['kind' => (string)$r['kind'], 'credits' => $k((int)$r['mc']), 'note' => $label($r), 'at' => (int)$r['created']], $st->fetchAll());
  $customer = 'mh_' . $uid;
  return ['ok' => true, 'plan' => $L['plan'], 'admin' => $L['admin'],
    'allowance' => $k($L['allowance']), 'month_used' => $k($L['month_used']), 'month_left' => $k($L['month_left']), 'paid' => $k(max(0, $L['paid'])), 'left' => $k($L['left']),
    'resets' => gmdate('Y-m-d', (int)strtotime('first day of next month 00:00 UTC')), 'month' => gmdate('Y-m'),
    'plans' => ['free' => $C['free'], 'pro' => $C['pro'], 'max' => $C['max'], 'pro_price' => $C['pro_price'], 'max_price' => $C['max_price']],
    'pack' => $C['pack'], 'price' => $C['price'], 'buy' => $C['link'] !== '' ? rtrim($C['link'], '/') . '/' . rawurlencode($customer) : '', 'customer' => $customer,
    'prices' => mh_credits_prices($C, $V, $L['plan']), 'by' => $by, 'days' => $days, 'recent' => $recent, 'adds' => $adds,
    'call_rate' => $L['plan'] === 'max' ? $C['call_strong'] : $C['call_light'], 'image_cost' => $C['image'],
    'voices' => MH_AI_LIVE_VOICES, 'voice_default' => $V['live_voice'], 'enabled' => $V['key'] !== ''];
}

function mh_credits_route(string $route, array $in, array $cfg, string $ip): void {
  $db = mh_credits_db();
  switch ($route) {
    case 'credits_status': {
      mh_method('GET'); $u = mh_require_user();
      mh_credits_sync($u, $cfg, !empty($_GET['refresh']));
      mh_json(mh_credits_status($u, $cfg));
    }
    case 'credits_sync': {   // back from the checkout, or "I paid": ask RevenueCat now
      mh_method('POST'); $u = mh_require_user();
      $n = mh_credits_sync($u, $cfg, true);
      mh_json(mh_credits_status($u, $cfg) + ['added' => max(0, $n), 'asked' => $n >= 0]);
    }

    /* the admin panel's Credits tab: this month by feature, what was sold, everyone using credits, giving credits */
    case 'admin_credits': {
      mh_method('GET'); $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      $C = mh_credits_cfg($cfg); $from = mh_credits_month_start(); $k = fn($mc) => round((int)$mc / 1000, 1);
      $by = array_map(fn($r) => ['k' => (string)$r['feature'], 't' => MH_CREDIT_FEATURES[(string)$r['feature']] ?? 'Other', 'credits' => $k($r['mc']), 'n' => (int)$r['n'], 'people' => (int)$r['p']],
        $db->query("SELECT feature, COALESCE(SUM(mc), 0) AS mc, COUNT(*) AS n, COUNT(DISTINCT user_id) AS p FROM credit_use WHERE at >= $from GROUP BY feature ORDER BY mc DESC")->fetchAll());
      $t = $db->query("SELECT COALESCE(SUM(mc), 0) AS mc, COALESCE(SUM(month_mc), 0) AS m, COALESCE(SUM(paid_mc), 0) AS p, COUNT(DISTINCT user_id) AS people FROM credit_use WHERE at >= $from")->fetch();
      $s = $db->query("SELECT COALESCE(SUM(kind = 'buy'), 0) AS sold, COALESCE(SUM(kind = 'refund'), 0) AS refunds, COALESCE(SUM(CASE WHEN kind = 'gift' THEN mc ELSE 0 END), 0) AS given FROM credit_add WHERE created >= $from")->fetch();
      $all = $db->query("SELECT COALESCE(SUM(kind = 'buy'), 0) AS sold, COALESCE(SUM(kind = 'refund'), 0) AS refunds FROM credit_add")->fetch();
      $rows = mh_db()->query("SELECT id, email, name FROM users WHERE id IN (SELECT user_id FROM credit_use WHERE at >= $from UNION SELECT user_id FROM credit_add) LIMIT 400")->fetchAll();
      $people = [];
      foreach ($rows as $r) {
        $st = $db->prepare('SELECT COALESCE(SUM(mc), 0) AS mc, COUNT(*) AS n FROM credit_use WHERE user_id = ? AND at >= ?'); $st->execute([(int)$r['id'], $from]); $m = $st->fetch();
        $plan = mh_credits_plan_known($r, $cfg); $L = mh_credits_left($r, $cfg, $plan);
        $people[] = ['id' => (int)$r['id'], 'email' => (string)$r['email'], 'name' => (string)$r['name'], 'plan' => $plan, 'month' => $k($m['mc']), 'uses' => (int)$m['n'], 'month_left' => $k($L['month_left']), 'paid' => $k($L['paid']), 'left' => $k($L['left'])];
      }
      usort($people, fn($a, $b) => $b['month'] <=> $a['month']);
      $log = array_map(fn($r) => ['kind' => (string)$r['kind'], 'credits' => $k($r['mc']), 'note' => (string)$r['note'], 'at' => (int)$r['created'], 'email' => (string)($r['email'] ?? ''), 'by' => (string)($r['by_email'] ?? '')],
        $db->query("SELECT c.kind, c.mc, c.note, c.created, u.email, a.email AS by_email FROM credit_add c LEFT JOIN users u ON u.id = c.user_id LEFT JOIN users a ON a.id = c.by_id WHERE c.kind <> 'used' ORDER BY c.created DESC LIMIT 60")->fetchAll());
      $net = (int)$s['sold'] - (int)$s['refunds'];
      mh_json(['ok' => true, 'month' => gmdate('Y-m'), 'by' => $by,
        'totals' => ['credits' => $k($t['mc']), 'month' => $k($t['m']), 'paid' => $k($t['p']), 'people' => (int)$t['people'], 'packs_sold' => (int)$s['sold'], 'refunds' => (int)$s['refunds'], 'given' => $k($s['given']), 'revenue' => round($net * $C['price_num'], 2), 'all_packs' => (int)$all['sold'] - (int)$all['refunds'],
          'cost' => round(((int)$t['mc'] / 1000) / 100 / max(0.01, $C['markup']), 2)],   // about what it cost Mathub, in dollars
        'settings' => ['free' => $C['free'], 'pro' => $C['pro'], 'max' => $C['max'], 'pack' => $C['pack'], 'price' => $C['price'], 'markup' => $C['markup'], 'call_strong' => $C['call_strong'], 'call_light' => $C['call_light'], 'image' => $C['image'], 'image_big' => $C['image_big'], 'products' => $C['products'], 'link' => $C['link'] !== '', 'revenuecat' => trim((string)($cfg['revenuecat_secret'] ?? '')) !== ''],
        'people' => array_slice($people, 0, 300), 'log' => $log]);
    }
    case 'admin_credits_grant': {
      mh_method('POST'); $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      $email = strtolower(trim((string)($in['email'] ?? ''))); $n = (int)($in['credits'] ?? 0); $note = mb_substr(trim((string)($in['note'] ?? '')), 0, 200);
      if ($n === 0 || abs($n) > 100000) mh_fail('Give between 1 and 100,000 credits (or take some back with a minus sign).');
      $st = mh_db()->prepare('SELECT * FROM users WHERE lower(email) = ?'); $st->execute([$email]); $m = $st->fetch(); if (!$m) mh_fail('No member with that email.', 404);
      if ($n < 0 && mh_credits_paid((int)$m['id']) + 1000 * $n < 0) mh_fail('They do not have that many bought or given credits to take back.');
      $db->prepare("INSERT INTO credit_add (user_id, kind, mc, ref, note, by_id, created) VALUES (?, 'gift', ?, ?, ?, ?, ?)")->execute([(int)$m['id'], 1000 * $n, bin2hex(random_bytes(8)), $note, (int)$u['id'], time()]);
      if ($n > 0 && !empty($in['tell'])) {
        try { require_once __DIR__ . '/forum.php'; require_once __DIR__ . '/requests.php'; mh_req_notify((int)$m['id'], ['id' => (int)mh_system_user()['id'], 'name' => 'Mathub'], 'credits', 'Credits for Bo', 'Mathub gave you ' . number_format($n) . ' credits to use with Bo.', '#/usage'); } catch (Throwable $e) {}
      }
      mh_json(['ok' => true, 'paid' => round(mh_credits_paid((int)$m['id']) / 1000, 1)]);
    }
  }
  mh_fail('Not found.', 404);
}
