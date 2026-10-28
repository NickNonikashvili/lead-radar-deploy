<?php
/* ============================================================
   StudyCat account server — the student's own planner ("life")
   Route: life (GET: the stored document; PUT: merge and store)
   Tasks, to-dos, events, the timetable, habits, goals, the wheel
   of life, the journal, money, career and projects (assets/life.js).
   One JSON document per account, merged record by record so two
   devices never overwrite each other: lists of records with an id
   keep the newer copy of each record (its "u", milliseconds), maps
   of records (the journal by date) do the same per key, and deleted
   records stay as small tombstones for 90 days so the deletion
   reaches every device. Capped at 600 KB.
   ============================================================ */
declare(strict_types=1);

const MH_LIFE_MAX = 600000;
if (!function_exists('array_is_list')) { function array_is_list(array $a): bool { $i = 0; foreach ($a as $k => $_) { if ($k !== $i++) return false; } return true; } }   // PHP 8.0

function mh_life_is_list($v): bool { return is_array($v) && array_is_list($v); }
function mh_life_is_rec($v): bool { return is_array($v) && !array_is_list($v) && isset($v['u']); }

/** Newer record wins; a list of records merges by id, a map of records by key. */
function mh_life_merge($a, $b) {
  if (mh_life_is_list($a) && mh_life_is_list($b) && ($a || $b) && array_reduce(array_merge($a, $b), fn($ok, $r) => $ok && is_array($r) && isset($r['id']), true)) {
    $by = [];
    foreach ([$a, $b] as $list) foreach ($list as $r) { $id = (string)$r['id']; if (!isset($by[$id]) || (int)($r['u'] ?? 0) >= (int)($by[$id]['u'] ?? 0)) $by[$id] = $r; }
    $cut = (int)(microtime(true) * 1000) - 90 * 86400000;
    return array_values(array_filter($by, fn($r) => empty($r['del']) || (int)($r['u'] ?? 0) > $cut));
  }
  if (is_array($a) && is_array($b) && !array_is_list($a) && !array_is_list($b)) {
    if (mh_life_is_rec($a) || mh_life_is_rec($b)) return (int)($b['u'] ?? 0) >= (int)($a['u'] ?? 0) ? $b : $a;
    $out = $a; foreach ($b as $k => $v) $out[$k] = array_key_exists($k, $a) ? mh_life_merge($a[$k], $v) : $v;
    return $out;
  }
  return $b ?? $a;
}

function mh_life_route(string $route, array $in, array $cfg, string $ip): void {
  $db = mh_db(); $u = mh_require_user();
  $stored = $u['life'] ? (json_decode((string)$u['life'], true) ?: []) : [];
  if ($_SERVER['REQUEST_METHOD'] === 'GET') mh_json(['ok' => true, 'life' => $stored ?: (object)[], 'updated' => (int)($u['life_updated'] ?? 0)]);
  mh_method('PUT', 'POST');
  if (!mh_rate("life:user:{$u['id']}", 400, 3600)) mh_fail('Saving too often. Try again in a few minutes.', 429);
  $doc = $in['life'] ?? null; if (!is_array($doc) || array_is_list($doc)) mh_fail('Missing planner data.');
  $merged = $stored ? mh_life_merge($stored, $doc) : $doc;
  $json = json_encode($merged, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false || strlen($json) > MH_LIFE_MAX) mh_fail('Your planner is too large to save. Delete old journal pages or spending to make room.', 413);
  $updated = (int)(microtime(true) * 1000);
  $db->prepare('UPDATE users SET life = ?, life_updated = ? WHERE id = ?')->execute([$json, $updated, $u['id']]);
  mh_json(['ok' => true, 'life' => $merged, 'updated' => $updated]);
}
