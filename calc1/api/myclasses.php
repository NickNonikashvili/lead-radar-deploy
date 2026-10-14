<?php
/* ============================================================
   Mathub account server — classes students make, sharing them, and the Pro and Max plans
   Routes: myclasses, myclass, myclass_save, myclass_delete, myclass_share, myclass_unshare,
           shared_class (public, by share code), create_status
   - A student's own classes (made from a syllabus or a class file) are kept with their account, so they
     open on the website and on every phone they sign in on. The app keeps its own copy in files on the
     device and syncs; the website keeps a copy in the browser.
   - Share codes: the owner can turn on a link (mathub.space/#/c/CODE) that lets anyone open the class
     and add a copy; turning it off makes the link stop working at once.
   - The plans: Mathub Pro (classes Bo writes from a syllabus, api/ai.php, and making classes) and Mathub Max
     (Pro, plus Bo the AI tutor). App purchases (App Store, Google Play) and web purchases (RevenueCat web
     checkout) belong to the RevenueCat customer "mh_<user id>", with the entitlements "pro" and "max" (a Max
     product unlocks both). The server asks RevenueCat with the secret key in config.local.php and keeps the
     answer for ten minutes. Accounts in plan_grants (config.local.php) get a plan without paying, for testing.
   Rows are removed with the account (ON DELETE CASCADE); housekeeping clears any left behind.
   ============================================================ */

const MH_MYCLASS_MAX = 40;            // classes per account
const MH_MYCLASS_BYTES = 3000000;     // per class, the same limit as the app
const MH_SHARE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function mh_myclass_db(): PDO {
  static $ready = false; $db = mh_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS my_classes (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cid TEXT NOT NULL, code TEXT NOT NULL DEFAULT "", name TEXT NOT NULL DEFAULT "", term TEXT NOT NULL DEFAULT "", pack TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0, free INTEGER NOT NULL DEFAULT 0, share TEXT UNIQUE, created INTEGER NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user_id, cid))');
    $db->exec('CREATE TABLE IF NOT EXISTS create_status (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, active INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL DEFAULT 0, store TEXT NOT NULL DEFAULT "", manage TEXT NOT NULL DEFAULT "", renews INTEGER NOT NULL DEFAULT 1, checked INTEGER NOT NULL)');
    $cols = array_column($db->query('PRAGMA table_info(create_status)')->fetchAll(), 'name');
    if (!in_array('renews', $cols, true)) $db->exec('ALTER TABLE create_status ADD COLUMN renews INTEGER NOT NULL DEFAULT 1');
    if (!in_array('tier', $cols, true)) $db->exec("ALTER TABLE create_status ADD COLUMN tier TEXT NOT NULL DEFAULT ''");
    $ready = true;
  }
  return $db;
}

/** Rows whose account is gone (the cascade normally removes them; this covers databases from before foreign keys were on). */
function mh_myclass_prune(): int {
  $db = mh_myclass_db();
  $n = $db->exec('DELETE FROM my_classes WHERE user_id NOT IN (SELECT id FROM users)');
  $db->exec('DELETE FROM create_status WHERE user_id NOT IN (SELECT id FROM users)');
  return (int)$n;
}

function mh_myclass_id($v): string { $c = is_string($v) ? $v : ''; if (!preg_match('/^my\d{4,6}$/', $c)) mh_fail('Unknown class.', 400); return $c; }
function mh_myclass_row(array $r): array {
  return ['id' => $r['cid'], 'code' => $r['code'], 'name' => $r['name'], 'term' => $r['term'], 'bytes' => (int)$r['bytes'], 'free' => (bool)$r['free'], 'share' => $r['share'] ?: null, 'created' => (int)$r['created'], 'updated' => (int)$r['updated']];
}
function mh_share_code(PDO $db): string {
  for ($i = 0; $i < 20; $i++) {
    $c = ''; for ($k = 0; $k < 8; $k++) $c .= MH_SHARE_ALPHABET[random_int(0, strlen(MH_SHARE_ALPHABET) - 1)];
    $st = $db->prepare('SELECT 1 FROM my_classes WHERE share = ?'); $st->execute([$c]); if (!$st->fetchColumn()) return $c;
  }
  mh_fail('Could not make a share link. Try again.', 500);
}

/** RevenueCat's view of one customer, or null when it cannot be reached. */
function mh_rc_subscriber(array $cfg, string $appUserId): ?array {
  $base = (string)($cfg['revenuecat_api'] ?? 'https://api.revenuecat.com/v1/subscribers/');
  $url = $base . rawurlencode($appUserId); $secret = (string)($cfg['revenuecat_secret'] ?? '');
  $headers = ['Authorization: Bearer ' . $secret, 'Accept: application/json', 'Content-Type: application/json'];
  if (function_exists('curl_init')) {
    $ch = curl_init($url); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_HTTPHEADER => $headers]);
    $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) return null;
  } else {
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'header' => implode("\r\n", $headers), 'ignore_errors' => true]]);
    $body = @file_get_contents($url, false, $ctx); if ($body === false) return null;
    $status = isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m) ? (int)$m[1] : 0; if ($status < 200 || $status >= 300) return null;
  }
  $j = json_decode((string)$body, true); return is_array($j) && isset($j['subscriber']) && is_array($j['subscriber']) ? $j['subscriber'] : null;
}

/** The plan of one account, from RevenueCat: asks at most every ten minutes, or when $refresh (120 times an hour at most), and remembers the answer. */
function mh_create_status(array $u, array $cfg, bool $refresh = false): array {
  $db = mh_myclass_db(); $now = time(); $uid = 'mh_' . $u['id'];
  $st = $db->prepare('SELECT * FROM create_status WHERE user_id = ?'); $st->execute([$u['id']]); $row = $st->fetch() ?: null;
  $secret = trim((string)($cfg['revenuecat_secret'] ?? ''));
  $stale = !$row || (int)$row['checked'] < $now - 600 || $refresh;
  if ($secret !== '' && $stale && ($row === null || mh_rate("create_status:{$u['id']}", 120, 3600))) {
    $sub = mh_rc_subscriber($cfg, $uid);
    if ($sub !== null) {
      $tier = ''; $exp = 0; $store = ''; $renews = false;
      foreach (['max' => (string)($cfg['max_entitlement'] ?? 'max'), 'pro' => (string)($cfg['pro_entitlement'] ?? 'pro')] as $name => $key) {
        $ent = $sub['entitlements'][$key] ?? null; if (!is_array($ent)) continue;
        $e = !empty($ent['expires_date']) ? (int)strtotime((string)$ent['expires_date']) : 0;
        $grace = !empty($ent['grace_period_expires_date']) ? (int)strtotime((string)$ent['grace_period_expires_date']) : 0;
        if (!($e === 0 || max($e, $grace) > $now)) continue;
        $tier = $name; $exp = $e === 0 ? 0 : max($e, $grace);
        $prod = (string)($ent['product_identifier'] ?? ''); $ps = $sub['subscriptions'][$prod] ?? []; $store = (string)($ps['store'] ?? '');
        $renews = empty($ps['unsubscribe_detected_at']) && empty($ps['billing_issues_detected_at']);
        break;
      }
      $db->prepare('INSERT INTO create_status (user_id, active, tier, expires, store, manage, renews, checked) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET active = excluded.active, tier = excluded.tier, expires = excluded.expires, store = excluded.store, manage = excluded.manage, renews = excluded.renews, checked = excluded.checked')
        ->execute([$u['id'], $tier !== '' ? 1 : 0, $tier, $exp, mb_substr($store, 0, 40), mb_substr((string)($sub['management_url'] ?? ''), 0, 400), $renews ? 1 : 0, $now]);
      $st->execute([$u['id']]); $row = $st->fetch() ?: null;
    }
  }
  $active = $row && (int)$row['active'] === 1 && ((int)$row['expires'] === 0 || (int)$row['expires'] > $now);
  $plan = $active ? ((string)($row['tier'] ?? '') ?: 'pro') : '';
  return ['active' => $active, 'plan' => $plan, 'until' => $row && (int)$row['expires'] ? gmdate('c', (int)$row['expires']) : null, 'store' => $row['store'] ?? '', 'manage_url' => $row['manage'] ?? '', 'renews' => $row ? (int)$row['renews'] === 1 : false, 'checked' => $row ? (int)$row['checked'] : 0];
}

/** A plan given without paying, for testers (plan_grants in config.local.php: email => 'pro' or 'max'). */
function mh_plan_grant(array $u, array $cfg): string {
  $g = is_array($cfg['plan_grants'] ?? null) ? $cfg['plan_grants'] : []; $email = strtolower((string)($u['email'] ?? ''));
  foreach ($g as $k => $v) if (strtolower((string)$k) === $email && in_array($v, ['pro', 'max'], true)) return $v;
  return '';
}
/** 'max', 'pro' or '' for one account: a grant, or what RevenueCat says. */
function mh_plan(array $u, array $cfg, bool $refresh = false): string {
  $g = mh_plan_grant($u, $cfg); if ($g === 'max') return 'max';
  $p = mh_create_status($u, $cfg, $refresh)['plan']; return $p === 'max' ? 'max' : ($g ?: $p);
}

function mh_myclass_route(string $route, array $in, array $cfg, string $ip): void {
  $db = mh_myclass_db(); $now = time();
  switch ($route) {
    case 'myclasses': {
      mh_method('GET'); $u = mh_require_user();
      $st = $db->prepare('SELECT cid, code, name, term, bytes, free, share, created, updated FROM my_classes WHERE user_id = ? ORDER BY created'); $st->execute([$u['id']]);
      mh_json(['ok' => true, 'classes' => array_map('mh_myclass_row', $st->fetchAll()), 'max' => MH_MYCLASS_MAX]);
    }
    case 'myclass': {
      mh_method('GET'); $u = mh_require_user(); $cid = mh_myclass_id($_GET['id'] ?? '');
      $st = $db->prepare('SELECT * FROM my_classes WHERE user_id = ? AND cid = ?'); $st->execute([$u['id'], $cid]); $r = $st->fetch();
      if (!$r) mh_fail('This class is not in your account.', 404);
      mh_json(['ok' => true, 'class' => mh_myclass_row($r), 'pack' => json_decode((string)$r['pack'], true)]);
    }
    case 'myclass_save': {
      mh_method('POST'); $u = mh_require_user(); mh_rate_or_fail("myclass_save:{$u['id']}", 120, 3600);
      $cid = mh_myclass_id($in['id'] ?? ''); $pack = $in['pack'] ?? null;
      if (!is_array($pack) || ($pack['format'] ?? '') !== 'mathub-class-pack' || ($pack['id'] ?? '') !== $cid) mh_fail('That is not a Mathub class.', 400);
      $code = trim((string)($pack['code'] ?? '')); $name = trim((string)($pack['name'] ?? ''));
      if ($code === '' || $name === '' || mb_strlen($code) > 40 || mb_strlen($name) > 200) mh_fail('The class needs a course code and a name.', 400);
      $json = json_encode($pack, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); $bytes = strlen((string)$json);
      if ($json === false || $bytes > MH_MYCLASS_BYTES) mh_fail('This class is too large to save (the limit is 3 MB).', 413);
      $st = $db->prepare('SELECT free, created FROM my_classes WHERE user_id = ? AND cid = ?'); $st->execute([$u['id'], $cid]); $old = $st->fetch();
      if (!$old) { $n = $db->prepare('SELECT COUNT(*) FROM my_classes WHERE user_id = ?'); $n->execute([$u['id']]); if ((int)$n->fetchColumn() >= MH_MYCLASS_MAX) mh_fail('Your account already has ' . MH_MYCLASS_MAX . ' classes. Delete one to add another.', 409); }
      $free = !empty($in['free']) || ($old && (int)$old['free'] === 1) ? 1 : 0;
      $db->prepare('INSERT INTO my_classes (user_id, cid, code, name, term, pack, bytes, free, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, cid) DO UPDATE SET code = excluded.code, name = excluded.name, term = excluded.term, pack = excluded.pack, bytes = excluded.bytes, free = excluded.free, updated = excluded.updated')
        ->execute([$u['id'], $cid, mb_substr($code, 0, 40), mb_substr($name, 0, 200), mb_substr(trim((string)($pack['term'] ?? '')), 0, 60), $json, $bytes, $free, $old ? (int)$old['created'] : $now, $now]);
      mh_json(['ok' => true, 'updated' => $now, 'free' => (bool)$free]);
    }
    case 'myclass_delete': {
      mh_method('POST'); $u = mh_require_user(); $cid = mh_myclass_id($in['id'] ?? '');
      $db->prepare('DELETE FROM my_classes WHERE user_id = ? AND cid = ?')->execute([$u['id'], $cid]);
      mh_json(['ok' => true]);
    }
    case 'myclass_share': {
      mh_method('POST'); $u = mh_require_user(); $cid = mh_myclass_id($in['id'] ?? ''); mh_rate_or_fail("myclass_share:{$u['id']}", 60, 3600);
      $st = $db->prepare('SELECT share FROM my_classes WHERE user_id = ? AND cid = ?'); $st->execute([$u['id'], $cid]); $r = $st->fetch();
      if (!$r) mh_fail('Save this class to your account first.', 404);
      $code = $r['share'] ?: mh_share_code($db);
      if (!$r['share']) $db->prepare('UPDATE my_classes SET share = ? WHERE user_id = ? AND cid = ?')->execute([$code, $u['id'], $cid]);
      mh_json(['ok' => true, 'code' => $code]);
    }
    case 'myclass_unshare': {
      mh_method('POST'); $u = mh_require_user(); $cid = mh_myclass_id($in['id'] ?? '');
      $db->prepare('UPDATE my_classes SET share = NULL WHERE user_id = ? AND cid = ?')->execute([$u['id'], $cid]);
      mh_json(['ok' => true]);
    }
    case 'admin_unshare': {   // a moderator stops a reported shared class (the class stays with its owner)
      mh_method('POST'); $u = mh_require_user(); if (!mh_is_mod($u)) mh_fail('Moderators only.', 403);
      $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($in['code'] ?? '')));
      $st = $db->prepare('UPDATE my_classes SET share = NULL WHERE share = ?'); $st->execute([$code]);
      mh_json(['ok' => true, 'stopped' => $st->rowCount()]);
    }
    case 'shared_class': {
      mh_method('GET'); mh_rate_or_fail("shared_class:$ip", 120, 3600);
      $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['code'] ?? '')));
      if (strlen($code) !== 8) mh_fail('That share code is not right. It has 8 letters and numbers.', 400);
      $st = $db->prepare('SELECT pack, code, name, term, updated FROM my_classes WHERE share = ?'); $st->execute([$code]); $r = $st->fetch();
      if (!$r) mh_fail('This class is not shared any more, or the code is wrong.', 404);
      $pack = json_decode((string)$r['pack'], true); if (!is_array($pack)) mh_fail('This class could not be read.', 500);
      mh_json(['ok' => true, 'code' => $code, 'pack' => $pack, 'updated' => (int)$r['updated']]);
    }
    case 'create_status': {   // the plan of the account signed in, and the web checkout for each plan
      mh_method('GET'); $u = mh_current_user();
      $links = ['pro' => trim((string)($cfg['pro_web_link'] ?? '')), 'max' => trim((string)($cfg['max_web_link'] ?? ''))]; $secret = trim((string)($cfg['revenuecat_secret'] ?? ''));
      $out = ['ok' => true, 'configured' => $secret !== '' && $links['pro'] !== '' && $links['max'] !== '', 'prices' => ['pro' => (string)($cfg['pro_web_price'] ?? '$15'), 'max' => (string)($cfg['max_web_price'] ?? '$50')], 'signed_in' => (bool)$u];
      if (!$u) mh_json($out + ['active' => false, 'plan' => '']);
      $s = mh_create_status($u, $cfg, !empty($_GET['refresh']));
      $grant = mh_plan_grant($u, $cfg); if ($grant && ($grant === 'max' || !$s['active'])) { $s['plan'] = $grant; $s['active'] = true; $s['granted'] = true; }
      $out['customer'] = 'mh_' . $u['id'];
      $out['buy'] = array_map(fn($l) => $l !== '' ? rtrim($l, '/') . '/' . rawurlencode($out['customer']) : '', $links);
      mh_json($out + $s);
    }
  }
  mh_fail('Not found.', 404);
}
