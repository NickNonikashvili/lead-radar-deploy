<?php
/* ============================================================
   StudyCat account server — off-site backups
   Each day's copy of the database (api/extras.php mh_backup_make) also goes, encrypted, to a storage bucket that
   speaks the S3 API (Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO…), so a lost server is not a lost site.
   - Encrypted before it leaves the server: gzip, then AES-256-GCM in 1 MB chunks, with a key made from the
     passphrase (PBKDF2-SHA256, 200,000 rounds, a new salt for every copy). Each chunk's nonce counts up, and its
     authenticated data names the chunk and says whether it is the last, so a copy that was cut short, reordered or
     changed does not open. Without the passphrase nobody can read the copies, the storage company included.
   - Checked after it is sent: the bucket must report the size and the SHA-256 StudyCat sent.
   - Restored as a test once a week, and from the admin panel: the newest copy is downloaded, decrypted into a
     temporary file and opened with SQLite. PRAGMA integrity_check must say ok and it must hold as many members as
     the copy that was sent. The temporary files are deleted either way.
   - The bucket keeps the newest offsite_keep (30) copies, and none older than 90 days (the privacy policy's promise);
     older ones StudyCat sent are deleted, and nothing else in the bucket is touched.
   - Requests are signed with AWS Signature Version 4 (mh_s3_sign; tests/offsite.test.js checks it against botocore).
   - The work runs after the page that started it has its answer (housekeeping), or in the cron route, never
     while someone waits.
   Settings (admin panel → Keys & settings → Off-site backups): offsite_endpoint, offsite_region, offsite_bucket,
   offsite_prefix, offsite_key_id, offsite_secret, offsite_passphrase, offsite_keep.
   Routes: admin_offsite (status and history), admin_offsite_now (send the newest copy now), admin_offsite_test
   (restore the newest copy as a test). A copy opens anywhere with its passphrase:
     php api/backup-tool.php decrypt <copy.mhbak> <out.sqlite>
   ============================================================ */
declare(strict_types=1);

require_once __DIR__ . '/extras.php';
require_once __DIR__ . '/backupcrypto.php';

const MH_OFFSITE_NAME = '/^mathub-[0-9]{8}-[0-9]{4}(-manual)?\.sqlite\.mhbak$/';

/* ---------- settings ---------- */
function mh_offsite_cfg(?array $cfg = null): array {
  $cfg = $cfg ?? mh_config();
  return [
    'endpoint' => rtrim(trim((string)($cfg['offsite_endpoint'] ?? '')), '/'),
    'region' => trim((string)($cfg['offsite_region'] ?? '')) ?: 'us-east-1',
    'bucket' => trim((string)($cfg['offsite_bucket'] ?? '')),
    'prefix' => trim(trim((string)($cfg['offsite_prefix'] ?? '')), '/'),
    'key' => trim((string)($cfg['offsite_key_id'] ?? '')),
    'secret' => (string)($cfg['offsite_secret'] ?? ''),
    'pass' => (string)($cfg['offsite_passphrase'] ?? ''),
    'keep' => max(1, min(90, (int)($cfg['offsite_keep'] ?? 0) ?: 30)),
  ];
}
/** What is missing before copies can go off-site ('' when ready). */
function mh_offsite_missing(array $O): string {
  if ($O['endpoint'] === '' || $O['bucket'] === '' || $O['key'] === '' || $O['secret'] === '') return 'Set the storage address, bucket and keys under Keys & settings → Off-site backups.';
  if (!preg_match('#^https://#i', $O['endpoint']) && !preg_match('#^http://(127\.0\.0\.1|localhost)(:\d+)?(/|$)#i', $O['endpoint'])) return 'The storage address must start with https://.';
  if (mb_strlen($O['pass']) < 12) return 'Set an encryption passphrase of at least 12 characters under Keys & settings → Off-site backups.';
  if (!function_exists('openssl_encrypt') || !in_array('aes-256-gcm', openssl_get_cipher_methods(), true) || !function_exists('deflate_init') || !function_exists('curl_init')) return 'This server’s PHP lacks OpenSSL, zlib or cURL.';
  return '';
}
function mh_offsite_key(array $O, string $name): string { return ($O['prefix'] !== '' ? $O['prefix'] . '/' : '') . $name; }

function mh_offsite_db(): PDO {
  static $ready = false; $db = mh_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS offsite_log (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT NOT NULL DEFAULT \'\', at INTEGER NOT NULL, ok INTEGER NOT NULL DEFAULT 0, size INTEGER NOT NULL DEFAULT 0, sha256 TEXT NOT NULL DEFAULT \'\', users INTEGER NOT NULL DEFAULT 0, ms INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT \'\')');
    $db->exec('CREATE INDEX IF NOT EXISTS offsite_log_kind ON offsite_log (kind, at)');
    $ready = true;
  }
  return $db;
}
function mh_offsite_log(string $kind, string $name, bool $ok, array $x = []): void {
  mh_offsite_db()->prepare('INSERT INTO offsite_log (kind, name, at, ok, size, sha256, users, ms, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$kind, $name, time(), $ok ? 1 : 0, (int)($x['size'] ?? 0), (string)($x['sha256'] ?? ''), (int)($x['users'] ?? 0), (int)($x['ms'] ?? 0), mb_substr((string)($x['note'] ?? ''), 0, 300)]);
  mh_offsite_db()->exec('DELETE FROM offsite_log WHERE id NOT IN (SELECT id FROM offsite_log ORDER BY id DESC LIMIT 400)');
}
function mh_offsite_last(string $kind, bool $okOnly = false): ?array {
  $st = mh_offsite_db()->prepare('SELECT * FROM offsite_log WHERE kind = ?' . ($okOnly ? ' AND ok = 1' : '') . ' ORDER BY id DESC LIMIT 1'); $st->execute([$kind]); $r = $st->fetch(); return $r ?: null;
}
function mh_offsite_tmp(): string { $d = mh_backup_dir() . '/tmp'; if (!is_dir($d)) @mkdir($d, 0755, true); return $d; }
/** One send or test at a time: a lock held while it runs (null when another is running). */
function mh_offsite_lock() { $f = @fopen(mh_offsite_tmp() . '/offsite.lock', 'c'); if (!$f) return null; if (!flock($f, LOCK_EX | LOCK_NB)) { fclose($f); return null; } return $f; }
function mh_offsite_unlock($f): void { if ($f) { flock($f, LOCK_UN); fclose($f); } }

/* ---------- AWS Signature Version 4 for S3 ---------- */
/** The request's address: virtual-hosted (bucket.s3.region.amazonaws.com) for Amazon, path-style (endpoint/bucket/key) for the rest. */
function mh_s3_target(array $O, string $key): array {
  $p = parse_url($O['endpoint']); $scheme = strtolower($p['scheme'] ?? 'https'); $host = strtolower($p['host'] ?? ''); $base = rtrim((string)($p['path'] ?? ''), '/');
  $port = isset($p['port']) && !(($scheme === 'https' && (int)$p['port'] === 443) || ($scheme === 'http' && (int)$p['port'] === 80)) ? ':' . (int)$p['port'] : '';
  if (preg_match('/(^|\.)amazonaws\.com$/', $host) && preg_match('/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/', $O['bucket'])) { $host = $O['bucket'] . '.' . $host; $path = $base . '/' . $key; }
  else $path = $base . '/' . $O['bucket'] . ($key !== '' ? '/' . $key : '');
  return ['scheme' => $scheme, 'host' => $host . $port, 'path' => $path];
}
function mh_s3_query(array $q): string { ksort($q, SORT_STRING); $o = []; foreach ($q as $k => $v) $o[] = rawurlencode((string)$k) . '=' . rawurlencode((string)$v); return implode('&', $o); }
/** Headers for one request, the Authorization header included. $headers are signed too. */
function mh_s3_sign(string $method, string $host, string $path, array $query, array $headers, string $payloadHash, array $O, int $now): array {
  $amz = gmdate('Ymd\THis\Z', $now); $day = substr($amz, 0, 8);
  $h = ['host' => $host, 'x-amz-content-sha256' => $payloadHash, 'x-amz-date' => $amz];
  foreach ($headers as $k => $v) $h[strtolower(trim((string)$k))] = (string)$v;
  ksort($h, SORT_STRING);
  $canonHeaders = ''; foreach ($h as $k => $v) $canonHeaders .= $k . ':' . trim((string)preg_replace('/\s+/', ' ', $v)) . "\n";
  $signed = implode(';', array_keys($h));
  $uri = implode('/', array_map('rawurlencode', explode('/', $path))); if ($uri === '') $uri = '/';
  $creq = "$method\n$uri\n" . mh_s3_query($query) . "\n$canonHeaders\n$signed\n$payloadHash";
  $scope = "$day/{$O['region']}/s3/aws4_request";
  $sts = "AWS4-HMAC-SHA256\n$amz\n$scope\n" . hash('sha256', $creq);
  $k = hash_hmac('sha256', $day, 'AWS4' . $O['secret'], true);
  foreach ([$O['region'], 's3', 'aws4_request'] as $part) $k = hash_hmac('sha256', $part, $k, true);
  $h['authorization'] = "AWS4-HMAC-SHA256 Credential={$O['key']}/$scope, SignedHeaders=$signed, Signature=" . hash_hmac('sha256', $sts, $k);
  return $h;
}
/** One request. $opt: upload (a file to PUT), sink (a file to download into), sha256 (of what is sent), headers, timeout. */
function mh_s3(array $O, string $method, string $key, array $query = [], array $opt = []): array {
  $T = mh_s3_target($O, $key);
  $hash = (string)($opt['sha256'] ?? hash('sha256', ''));
  $h = mh_s3_sign($method, $T['host'], $T['path'], $query, $opt['headers'] ?? [], $hash, $O, time());
  $url = $T['scheme'] . '://' . $T['host'] . implode('/', array_map('rawurlencode', explode('/', $T['path']))) . ($query ? '?' . mh_s3_query($query) : '');
  $lines = []; foreach ($h as $k => $v) $lines[] = "$k: $v"; $lines[] = 'Expect:';
  $ch = curl_init($url); $resp = []; $in = $out = null;
  curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_CONNECTTIMEOUT => 15, CURLOPT_TIMEOUT => (int)($opt['timeout'] ?? 600), CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_HEADERFUNCTION => function ($c, $line) use (&$resp) { $p = strpos($line, ':'); if ($p !== false) $resp[strtolower(trim(substr($line, 0, $p)))] = trim(substr($line, $p + 1)); return strlen($line); }]);
  if (!empty($opt['upload'])) { $in = fopen($opt['upload'], 'rb'); $size = filesize($opt['upload']); $lines[] = 'Content-Length: ' . $size; curl_setopt_array($ch, [CURLOPT_UPLOAD => true, CURLOPT_INFILE => $in, CURLOPT_INFILESIZE => $size]); }
  if ($method === 'HEAD') curl_setopt($ch, CURLOPT_NOBODY, true);
  if (!empty($opt['sink'])) { $out = fopen($opt['sink'], 'wb'); curl_setopt($ch, CURLOPT_FILE, $out); }
  else curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, $lines);
  $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $err = curl_error($ch); curl_close($ch);
  if ($in) fclose($in); if ($out) fclose($out);
  if (!empty($opt['sink']) && ($code < 200 || $code >= 300)) { $body = (string)@file_get_contents($opt['sink'], false, null, 0, 4000); @unlink($opt['sink']); }
  return ['code' => $code, 'body' => is_string($body) ? $body : '', 'headers' => $resp, 'error' => $err];
}
/** A short reason from a failed request: the storage's own error code and message when it sent one. */
function mh_s3_why(array $r): string {
  if ($r['code'] === 0) return 'Could not reach the storage' . ($r['error'] !== '' ? ': ' . $r['error'] : '.');
  if (preg_match('#<Code>([^<]+)</Code>#', $r['body'], $c)) { preg_match('#<Message>([^<]*)</Message>#', $r['body'], $m); return 'The storage said ' . $c[1] . ($m && $m[1] !== '' ? ': ' . html_entity_decode($m[1]) : '') . " (HTTP {$r['code']})."; }
  return "The storage answered HTTP {$r['code']}.";
}
/** The copies StudyCat sent that are in the bucket: [key, name, size, modified], newest first. */
function mh_s3_list(array $O): array {
  $out = []; $token = '';
  for ($page = 0; $page < 20; $page++) {
    $q = ['list-type' => '2', 'prefix' => $O['prefix'] !== '' ? $O['prefix'] . '/' : '']; if ($token !== '') $q['continuation-token'] = $token;
    $r = mh_s3($O, 'GET', '', $q, ['timeout' => 60]); if ($r['code'] !== 200) throw new RuntimeException(mh_s3_why($r));
    $x = @simplexml_load_string($r['body']); if (!$x) throw new RuntimeException('The storage’s list could not be read.');
    foreach ($x->Contents as $c) { $key = (string)$c->Key; $name = basename($key); if (!preg_match(MH_OFFSITE_NAME, $name) || $key !== mh_offsite_key($O, $name)) continue; $out[] = ['key' => $key, 'name' => $name, 'size' => (int)$c->Size, 'modified' => (int)strtotime((string)$c->LastModified)]; }
    if ((string)$x->IsTruncated !== 'true') break; $token = (string)$x->NextContinuationToken; if ($token === '') break;
  }
  usort($out, fn($a, $b) => strcmp($b['name'], $a['name'])); return $out;
}

/** What a database file holds, for checking a restore: integrity and its members. */
function mh_bak_inspect(string $file): array {
  $db = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $check = (string)$db->query('PRAGMA integrity_check')->fetchColumn();
  $users = (int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn(); $tables = (int)$db->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")->fetchColumn();
  $db = null; return ['check' => $check, 'users' => $users, 'tables' => $tables];
}

/* ---------- sending, checking, restoring ---------- */
/** Sends the newest local copy (made now when there is none from the last day), checks it, and trims the bucket. */
function mh_offsite_send(?array $cfg = null): array {
  $O = mh_offsite_cfg($cfg); if (($miss = mh_offsite_missing($O)) !== '') throw new RuntimeException($miss);
  @set_time_limit(900); $t0 = microtime(true);
  $list = mh_backup_list(); if (!$list || time() - $list[0]['mtime'] > 26 * 3600) { mh_backup_make('auto'); $list = mh_backup_list(); }
  $local = $list[0]; $name = $local['name'] . '.mhbak'; $src = mh_backup_dir() . '/' . $local['name']; $tmp = mh_offsite_tmp() . '/' . $name;
  try {
    $users = mh_bak_inspect($src)['users'];
    $enc = mh_bak_encrypt($src, $tmp, $O['pass']);
    $key = mh_offsite_key($O, $name);
    $r = mh_s3($O, 'PUT', $key, [], ['upload' => $tmp, 'sha256' => $enc['sha256'], 'headers' => ['content-type' => 'application/octet-stream', 'x-amz-meta-sha256' => $enc['sha256'], 'x-amz-meta-users' => (string)$users]]);
    if ($r['code'] < 200 || $r['code'] >= 300) throw new RuntimeException(mh_s3_why($r));
    $hd = mh_s3($O, 'HEAD', $key, [], ['timeout' => 60]);
    if ($hd['code'] !== 200) throw new RuntimeException('Sent, but the storage cannot find it: ' . mh_s3_why($hd));
    if ((int)($hd['headers']['content-length'] ?? -1) !== $enc['size']) throw new RuntimeException('Sent, but the storage holds a different size (' . ($hd['headers']['content-length'] ?? '?') . ' bytes, not ' . $enc['size'] . ').');
    if (($hd['headers']['x-amz-meta-sha256'] ?? '') !== $enc['sha256']) throw new RuntimeException('Sent, but the storage does not report the fingerprint StudyCat sent.');
    $kept = mh_offsite_trim($O);
    $res = ['name' => $name, 'size' => $enc['size'], 'sha256' => $enc['sha256'], 'users' => $users, 'ms' => (int)round(1000 * (microtime(true) - $t0)), 'note' => $kept === null ? 'Old copies could not be listed.' : "$kept in the bucket"];
    mh_offsite_log('send', $name, true, $res); return $res;
  } catch (Throwable $e) {
    mh_offsite_log('send', $name, false, ['note' => $e->getMessage(), 'ms' => (int)round(1000 * (microtime(true) - $t0))]); throw $e;
  } finally { @unlink($tmp); }
}
/** Deletes the copies StudyCat sent beyond the newest offsite_keep, and any older than 90 days. Returns how many are left (null: could not list). */
function mh_offsite_trim(array $O): ?int {
  try { $all = mh_s3_list($O); } catch (Throwable $e) { return null; }
  $left = 0;
  foreach ($all as $i => $c) {
    if ($i < $O['keep'] && ($c['modified'] === 0 || $c['modified'] > time() - 90 * 86400)) { $left++; continue; }
    mh_s3($O, 'DELETE', $c['key'], [], ['timeout' => 60]);
  }
  return $left;
}
/** Downloads the newest copy, decrypts it and opens it: the proof that a restore works. */
function mh_offsite_restore_test(?array $cfg = null): array {
  $O = mh_offsite_cfg($cfg); if (($miss = mh_offsite_missing($O)) !== '') throw new RuntimeException($miss);
  @set_time_limit(900); $t0 = microtime(true); $name = ''; $dl = $db = '';
  try {
    $all = mh_s3_list($O); if (!$all) throw new RuntimeException('There is no copy in the bucket yet.');
    $name = $all[0]['name']; $key = $all[0]['key'];
    $hd = mh_s3($O, 'HEAD', $key, [], ['timeout' => 60]); if ($hd['code'] !== 200) throw new RuntimeException(mh_s3_why($hd));
    $dl = mh_offsite_tmp() . '/restore-' . bin2hex(random_bytes(4)) . '.mhbak'; $db = substr($dl, 0, -6) . '.sqlite';
    $r = mh_s3($O, 'GET', $key, [], ['sink' => $dl]); if ($r['code'] !== 200) throw new RuntimeException(mh_s3_why($r));
    $sha = hash_file('sha256', $dl); $want = (string)($hd['headers']['x-amz-meta-sha256'] ?? '');
    if ($want !== '' && !hash_equals($want, $sha)) throw new RuntimeException('The copy downloaded is not the one that was sent (its SHA-256 differs).');
    $size = mh_bak_decrypt($dl, $db, $O['pass']);
    $x = mh_bak_inspect($db);
    if ($x['check'] !== 'ok') throw new RuntimeException('The restored database is damaged: ' . mb_substr($x['check'], 0, 120));
    $had = (int)($hd['headers']['x-amz-meta-users'] ?? -1);
    if ($had >= 0 && $x['users'] !== $had) throw new RuntimeException("The restored database has {$x['users']} members; the copy sent had $had.");
    $res = ['name' => $name, 'size' => $size, 'sha256' => $sha, 'users' => $x['users'], 'tables' => $x['tables'], 'ms' => (int)round(1000 * (microtime(true) - $t0)), 'note' => "integrity ok · {$x['tables']} tables · {$x['users']} members"];
    mh_offsite_log('restore', $name, true, $res); return $res;
  } catch (Throwable $e) {
    mh_offsite_log('restore', $name, false, ['note' => $e->getMessage(), 'ms' => (int)round(1000 * (microtime(true) - $t0))]); throw $e;
  } finally { if ($dl !== '') @unlink($dl); if ($db !== '') { @unlink($db); @unlink($db . '-journal'); @unlink($db . '-wal'); @unlink($db . '-shm'); } }
}
/** From housekeeping: today's copy goes off-site once, and a restore is tested once a week. After the answer is sent. */
function mh_offsite_tick(bool $now = false): array {
  $O = mh_offsite_cfg(); if (mh_offsite_missing($O) !== '') return [];
  $list = mh_backup_list(); $newest = $list ? $list[0]['name'] . '.mhbak' : '';
  $sent = mh_offsite_last('send', true); $tried = mh_offsite_last('send');
  $sendDue = $newest !== '' && (!$sent || $sent['name'] !== $newest) && (!$tried || $tried['ok'] || $tried['name'] !== $newest || time() - (int)$tried['at'] > 3 * 3600);   // a copy that failed is tried again after 3 hours; a new copy right away
  $test = mh_offsite_last('restore'); $age = $test ? time() - (int)$test['at'] : 0;
  $testDue = (bool)$sent && (!$test || ($test['ok'] ? $age > 7 * 86400 : $age > 86400));   // weekly; a failed one again the next day
  if (!$sendDue && !$testDue) return [];
  $work = function () use ($sendDue, $testDue): array {
    $lock = mh_offsite_lock(); if (!$lock) return [];   // another request is already at it
    $did = [];
    if ($sendDue) { try { $r = mh_offsite_send(); $did[] = 'off-site: ' . $r['name']; } catch (Throwable $e) { $did[] = 'off-site failed: ' . $e->getMessage(); } }
    if ($testDue && mh_offsite_last('send', true)) { try { mh_offsite_restore_test(); $did[] = 'restore test: ok'; } catch (Throwable $e) { $did[] = 'restore test failed: ' . $e->getMessage(); } }
    mh_offsite_unlock($lock); return $did;
  };
  if ($now) return $work();
  register_shutdown_function(function () use ($work): void { if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request(); elseif (function_exists('litespeed_finish_request')) @litespeed_finish_request(); @ignore_user_abort(true); try { $work(); } catch (Throwable $e) { error_log('mathub offsite: ' . $e->getMessage()); } });
  return ['off-site: started after this answer'];
}
/** For the admin panel and the weekly report. */
function mh_offsite_status(?array $cfg = null): array {
  $O = mh_offsite_cfg($cfg); $miss = mh_offsite_missing($O);
  $rows = mh_offsite_db()->query('SELECT * FROM offsite_log ORDER BY id DESC LIMIT 30')->fetchAll();
  $pub = fn($r) => $r ? ['kind' => $r['kind'], 'name' => $r['name'], 'at' => (int)$r['at'], 'ok' => (bool)$r['ok'], 'size' => (int)$r['size'], 'users' => (int)$r['users'], 'ms' => (int)$r['ms'], 'note' => $r['note']] : null;
  $where = $O['endpoint'] !== '' && $O['bucket'] !== '' ? (string)parse_url($O['endpoint'], PHP_URL_HOST) . ' · ' . $O['bucket'] . ($O['prefix'] !== '' ? '/' . $O['prefix'] : '') : '';
  return ['ready' => $miss === '', 'missing' => $miss, 'where' => $where, 'keep' => $O['keep'],
    'last_sent' => $pub(mh_offsite_last('send', true)), 'last_send' => $pub(mh_offsite_last('send')), 'last_test' => $pub(mh_offsite_last('restore')), 'last_test_ok' => $pub(mh_offsite_last('restore', true)), 'log' => array_map($pub, $rows)];
}

function mh_offsite_route(string $route, array $in, array $cfg): void {
  $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Admins only.', 403);
  switch ($route) {
    case 'admin_offsite': { mh_method('GET'); mh_json(['ok' => true] + mh_offsite_status($cfg)); }
    case 'admin_offsite_now': {
      mh_method('POST'); $lock = mh_offsite_lock(); if (!$lock) mh_fail('A copy is being sent or tested right now. Try again in a few minutes.', 429);
      try { $r = mh_offsite_send($cfg); } catch (Throwable $e) { mh_offsite_unlock($lock); mh_fail($e->getMessage(), 502); }
      mh_offsite_unlock($lock);
      mh_json(['ok' => true, 'sent' => $r] + mh_offsite_status($cfg));
    }
    case 'admin_offsite_test': {
      mh_method('POST'); $lock = mh_offsite_lock(); if (!$lock) mh_fail('A copy is being sent or tested right now. Try again in a few minutes.', 429);
      try { $r = mh_offsite_restore_test($cfg); } catch (Throwable $e) { mh_offsite_unlock($lock); mh_fail('The restore test failed: ' . $e->getMessage(), 502); }
      mh_offsite_unlock($lock);
      mh_json(['ok' => true, 'tested' => $r] + mh_offsite_status($cfg));
    }
  }
  mh_fail('Not found.', 404);
}
