<?php
/* ============================================================
   Mathub — study rooms: classmates join a call with Bo (assets/room.js, assets/talk.js).
   The student on the call (the host) opens a room and shares its code; up to MH_ROOM_GUESTS classmates join with
   it. They see the board and the captions as they happen, write on the board, and type questions that the host's
   Bo hears and answers. Nothing goes peer to peer (no TURN server on shared hosting, and campus Wi-Fi blocks it):
   each side posts what changed (room_post) and asks for what is new about once a second (room_poll).
   Routes: room_open, room_join, room_poll, room_post, room_leave, room_close.
   A classmate who joins gets the board as the host last sent it (rooms.snap) and asks the host for a fresh one
   (want_snap); it comes as a snap event.
   Kept: the rooms of the last day, their events for three hours; nothing of a room goes into Bo's memory.
   ============================================================ */
declare(strict_types=1);

const MH_ROOM_GUESTS = 3;
const MH_ROOM_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function mh_room_db(): PDO {
  static $ready = false; $db = mh_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cid TEXT NOT NULL DEFAULT "", created INTEGER NOT NULL, last INTEGER NOT NULL, ended INTEGER NOT NULL DEFAULT 0, want_snap INTEGER NOT NULL DEFAULT 0, snap TEXT NOT NULL DEFAULT "", snap_id INTEGER NOT NULL DEFAULT 0)');
    $db->exec('CREATE TABLE IF NOT EXISTS room_people (code TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, joined INTEGER NOT NULL, seen INTEGER NOT NULL, gone INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (code, user_id))');
    $db->exec('CREATE TABLE IF NOT EXISTS room_ev (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, uid INTEGER NOT NULL, name TEXT NOT NULL DEFAULT "", kind TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS room_ev_code ON room_ev(code, id)');
    $ready = true;
  }
  return $db;
}
/** First name for the room: theirs, or the start of their email. */
function mh_room_name(array $u): string { $n = trim(explode(' ', trim((string)($u['name'] ?? '')))[0] ?? ''); return mb_substr($n !== '' ? $n : explode('@', (string)$u['email'])[0], 0, 24); }
function mh_room_get(string $code): ?array {
  $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code)); if (strlen($code) !== 6) return null;
  $st = mh_room_db()->prepare('SELECT * FROM rooms WHERE code = ?'); $st->execute([$code]); $r = $st->fetch(); return $r ?: null;
}
/** Who is in the room now (seen in the last 20 seconds). */
function mh_room_people(string $code): array {
  $st = mh_room_db()->prepare('SELECT user_id, name FROM room_people WHERE code = ? AND gone = 0 AND seen >= ? ORDER BY joined'); $st->execute([$code, time() - 20]);
  return array_map(fn($p) => ['id' => (int)$p['user_id'], 'name' => $p['name']], $st->fetchAll());
}
function mh_room_ev(string $code, int $uid, string $name, string $kind, $data): int {
  $db = mh_room_db(); $db->prepare('INSERT INTO room_ev (code, uid, name, kind, data, created) VALUES (?, ?, ?, ?, ?, ?)')->execute([$code, $uid, $name, $kind, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), time()]);
  return (int)$db->lastInsertId();
}
/** The host's call is still on: the host asked for news in the last 90 seconds. */
function mh_room_live(array $r): bool { return !(int)$r['ended'] && (int)$r['last'] >= time() - 90; }
function mh_room_prune(): void {
  if (random_int(1, 30) !== 1) return; $db = mh_room_db(); $now = time();
  $db->prepare('DELETE FROM room_ev WHERE created < ?')->execute([$now - 3 * 3600]);
  $db->prepare('DELETE FROM room_people WHERE code IN (SELECT code FROM rooms WHERE last < ?)')->execute([$now - 86400]);
  $db->prepare('DELETE FROM rooms WHERE last < ?')->execute([$now - 86400]);
}

function mh_room_route(string $route, array $in, array $cfg, string $ip): void {
  $db = mh_room_db(); $u = mh_require_user(); $uid = (int)$u['id']; $now = time(); mh_room_prune();
  if (!(int)$u['verified']) mh_fail('Confirm your email first.', 403);
  switch ($route) {
    case 'room_open': {
      // the host, on a call: their open room, or a new one
      mh_method('POST'); mh_rate_or_fail("room_open:$uid", 30, 86400, 'That is a lot of study rooms for one day.');
      $cid = preg_replace('/[^a-z0-9_-]/', '', strtolower((string)($in['class'] ?? ''))); $cid = mb_substr($cid, 0, 40);
      $st = $db->prepare('SELECT * FROM rooms WHERE host = ? AND ended = 0 AND last >= ? ORDER BY created DESC LIMIT 1'); $st->execute([$uid, $now - 90]); $r = $st->fetch();
      if ($r) { $db->prepare('UPDATE rooms SET last = ?, cid = ? WHERE code = ?')->execute([$now, $cid, $r['code']]); mh_json(['ok' => true, 'code' => $r['code'], 'people' => mh_room_people($r['code']), 'last' => (int)$db->query('SELECT COALESCE(MAX(id), 0) FROM room_ev')->fetchColumn()]); }
      $db->prepare('UPDATE rooms SET ended = 1 WHERE host = ? AND ended = 0')->execute([$uid]);
      do { $code = ''; for ($i = 0; $i < 6; $i++) $code .= MH_ROOM_ABC[random_int(0, strlen(MH_ROOM_ABC) - 1)]; } while (mh_room_get($code));
      $db->prepare('INSERT INTO rooms (code, host, cid, created, last) VALUES (?, ?, ?, ?, ?)')->execute([$code, $uid, $cid, $now, $now]);
      mh_json(['ok' => true, 'code' => $code, 'people' => [], 'last' => (int)$db->query('SELECT COALESCE(MAX(id), 0) FROM room_ev')->fetchColumn()]);
    }
    case 'room_join': {
      mh_method('POST'); mh_rate_or_fail("room_join:$uid", 60, 3600, 'That is a lot of joining. Try again in a bit.');
      $r = mh_room_get((string)($in['code'] ?? '')); if (!$r || !mh_room_live($r)) mh_fail('That study room is not open. Check the code, or ask for a new one.', 404);
      $code = $r['code']; if ((int)$r['host'] === $uid) mh_fail('This is your own study room: you are on the call.', 400);
      $st = $db->prepare('SELECT * FROM room_people WHERE code = ? AND user_id = ?'); $st->execute([$code, $uid]); $me = $st->fetch();
      if (!$me && count(mh_room_people($code)) >= MH_ROOM_GUESTS) mh_fail('This study room is full: ' . MH_ROOM_GUESTS . ' classmates at most.', 409);
      $name = mh_room_name($u);
      $db->prepare('INSERT INTO room_people (code, user_id, name, joined, seen, gone) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(code, user_id) DO UPDATE SET seen = excluded.seen, gone = 0')->execute([$code, $uid, $name, $now, $now]);
      $db->prepare('UPDATE rooms SET want_snap = 1 WHERE code = ?')->execute([$code]);   // the host sends the whole board for them
      mh_room_ev($code, $uid, $name, 'sys', ['t' => 'joined']);
      $hs = $db->prepare('SELECT name, email FROM users WHERE id = ?'); $hs->execute([(int)$r['host']]); $host = $hs->fetch() ?: ['name' => '', 'email' => ''];
      $caps = $db->prepare("SELECT id, name, data FROM room_ev WHERE code = ? AND kind = 'cap' ORDER BY id DESC LIMIT 6"); $caps->execute([$code]);
      $pages = $db->prepare("SELECT data FROM room_ev WHERE code = ? AND kind = 'page' ORDER BY id"); $pages->execute([$code]);
      mh_json(['ok' => true, 'code' => $code, 'cid' => $r['cid'], 'host' => mh_room_name($host), 'snap' => $r['snap'] !== '' ? json_decode($r['snap'], true) : null, 'last' => (int)$r['snap_id'],
        'caps' => array_reverse(array_map(fn($c) => ['id' => (int)$c['id']] + (json_decode($c['data'], true) ?: []), $caps->fetchAll())), 'pages' => array_map(fn($p) => json_decode($p['data'], true), $pages->fetchAll()), 'people' => mh_room_people($code)]);
    }
    case 'room_poll': {
      // what is new since `after`, from everyone else; the host also hears whether a new classmate needs the whole board
      $r = mh_room_get((string)($in['code'] ?? ($_GET['code'] ?? ''))); if (!$r) mh_fail('That study room is not open.', 404);
      $code = $r['code']; $host = (int)$r['host'] === $uid; $after = max(0, (int)($in['after'] ?? ($_GET['after'] ?? 0)));
      if ($host) $db->prepare('UPDATE rooms SET last = ? WHERE code = ?')->execute([$now, $code]);
      else {
        $st = $db->prepare('UPDATE room_people SET seen = ? WHERE code = ? AND user_id = ? AND gone = 0'); $st->execute([$now, $code, $uid]);
        if (!$st->rowCount()) mh_fail('You are not in this study room.', 403);
      }
      $st = $db->prepare('SELECT id, uid, name, kind, data FROM room_ev WHERE code = ? AND id > ? AND uid != ? ORDER BY id LIMIT 300'); $st->execute([$code, $after, $uid]);
      $ev = array_map(fn($e) => ['id' => (int)$e['id'], 'from' => (int)$e['uid'] === (int)$r['host'] ? 'host' : 'guest', 'name' => $e['name'], 'kind' => $e['kind'], 'data' => json_decode($e['data'], true)], $st->fetchAll());
      $last = $ev ? $ev[count($ev) - 1]['id'] : $after;
      if (!$ev) { $mx = $db->prepare('SELECT COALESCE(MAX(id), 0) FROM room_ev WHERE code = ?'); $mx->execute([$code]); $last = max($after, (int)$mx->fetchColumn()); }
      mh_json(['ok' => true, 'events' => $ev, 'last' => $last, 'people' => mh_room_people($code), 'ended' => !mh_room_live($r) && !$host, 'want_snap' => $host && (int)$r['want_snap'] === 1]);
    }
    case 'room_post': {
      // host: board changes (op), captions (cap), Bo's pages (page), the whole board (snap); classmates: board changes and questions (ask)
      mh_method('POST'); $r = mh_room_get((string)($in['code'] ?? '')); if (!$r || !mh_room_live($r)) mh_fail('That study room is not open.', 404);
      $code = $r['code']; $host = (int)$r['host'] === $uid;
      if (!$host) { $st = $db->prepare('SELECT 1 FROM room_people WHERE code = ? AND user_id = ? AND gone = 0'); $st->execute([$code, $uid]); if (!$st->fetchColumn()) mh_fail('You are not in this study room.', 403); }
      mh_rate_or_fail("room_post:$uid", 2400, 3600, 'Slow down a little.');
      $name = mh_room_name($u); $ids = [];
      foreach (array_slice(is_array($in['events'] ?? null) ? $in['events'] : [], 0, 40) as $e) {
        if (!is_array($e)) continue; $kind = (string)($e['kind'] ?? ''); $d = $e['data'] ?? null;
        $size = strlen((string)json_encode($d));
        if ($kind === 'op' && is_array($d) && in_array($d['a'] ?? '', ['add', 'del'], true) && is_array($d['its'] ?? null) && $size <= 80000) $ids[] = mh_room_ev($code, $uid, $name, 'op', ['a' => $d['a'], 'its' => array_slice($d['its'], 0, 200)]);
        elseif ($kind === 'ask' && !$host && is_array($d)) { $t = trim(mb_substr((string)($d['t'] ?? ''), 0, 500)); if ($t === '') continue; mh_rate_or_fail("room_ask:$uid", 30, 600, 'That is a lot of questions. Give Bo a moment.'); $ids[] = mh_room_ev($code, $uid, $name, 'ask', ['t' => $t]); }
        elseif ($kind === 'cap' && $host && is_array($d)) { $t = trim(mb_substr((string)($d['t'] ?? ''), 0, 1200)); if ($t === '') continue; $ids[] = mh_room_ev($code, $uid, $name, 'cap', ['who' => in_array($d['who'] ?? '', ['bo', 'you', 'guest'], true) ? $d['who'] : 'bo', 'name' => mb_substr((string)($d['name'] ?? ''), 0, 24), 't' => $t]); }
        elseif ($kind === 'page' && $host && is_array($d) && $size <= 30000) $ids[] = mh_room_ev($code, $uid, $name, 'page', ['i' => max(0, min(200, (int)($d['i'] ?? 0))), 'title' => mb_substr((string)($d['title'] ?? ''), 0, 120), 'items' => array_slice(is_array($d['items'] ?? null) ? $d['items'] : [], 0, 40)]);
        elseif ($kind === 'snap' && $host && is_array($d) && $size <= 700000) {
          $board = ['items' => array_values((array)($d['items'] ?? [])), 'marks' => array_values((array)($d['marks'] ?? []))];
          $id = mh_room_ev($code, $uid, $name, 'snap', $board); $ids[] = $id;   // whoever joined while it was on its way gets it as news
          $db->prepare('UPDATE rooms SET snap = ?, snap_id = ?, want_snap = 0 WHERE code = ?')->execute([json_encode($board, JSON_UNESCAPED_SLASHES), $id, $code]);
        }
      }
      mh_json(['ok' => true, 'ids' => $ids]);
    }
    case 'room_leave': {
      mh_method('POST'); $r = mh_room_get((string)($in['code'] ?? '')); if (!$r) mh_json(['ok' => true]);
      $st = $db->prepare('UPDATE room_people SET gone = 1 WHERE code = ? AND user_id = ? AND gone = 0'); $st->execute([$r['code'], $uid]);
      if ($st->rowCount()) mh_room_ev($r['code'], $uid, mh_room_name($u), 'sys', ['t' => 'left']);
      mh_json(['ok' => true]);
    }
    case 'room_close': {
      mh_method('POST'); $r = mh_room_get((string)($in['code'] ?? '')); if (!$r || (int)$r['host'] !== $uid) mh_json(['ok' => true]);
      $db->prepare('UPDATE rooms SET ended = 1 WHERE code = ?')->execute([$r['code']]); mh_room_ev($r['code'], $uid, mh_room_name($u), 'sys', ['t' => 'ended']);
      mh_json(['ok' => true]);
    }
  }
  mh_fail('Unknown request.', 404);
}
