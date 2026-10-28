<?php
/* ============================================================
   StudyCat account server — peer review swaps (#/<class>/peer; assets/peer.js)
   In a class whose instructor turned swaps on (class_ai.peer, api/instruct.php), a student offers a version of a
   project draft (one they shared with Bo) for a swap. When a classmate offers one for the same project, they are
   paired: each reads the other's draft (the draft only, not Bo's feedback) and writes back, with comments on exact
   passages and a note on the whole, due a few days later (class_ai.peer_days). What a reviewer sends is final, shows
   on the author's review of that version, and can go into their next request to Bo as peer review comments.
   Either can report the other's draft (it goes to the moderators and ends the swap) or never be paired with them
   again. Swaps, notes and blocks go with the accounts and with the draft versions (ON DELETE CASCADE).
   Routes: peer_status, peer_join, peer_leave, peer_get, peer_save, peer_report, peer_block.
   ============================================================ */
declare(strict_types=1);

const MH_PEER_COMMENTS = 30;
function mh_peer_db(): PDO {
  static $ready = false; require_once __DIR__ . '/drafts.php'; $db = mh_draft_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS peer_queue (course TEXT NOT NULL, project TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, review_id INTEGER NOT NULL REFERENCES draft_reviews(id) ON DELETE CASCADE, since INTEGER NOT NULL, PRIMARY KEY (course, project, user_id))');
    $db->exec('CREATE TABLE IF NOT EXISTS peer_swaps (id INTEGER PRIMARY KEY AUTOINCREMENT, course TEXT NOT NULL, project TEXT NOT NULL, a_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, a_review INTEGER NOT NULL REFERENCES draft_reviews(id) ON DELETE CASCADE, b_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, b_review INTEGER NOT NULL REFERENCES draft_reviews(id) ON DELETE CASCADE, created INTEGER NOT NULL, due INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0, closed_by INTEGER NOT NULL DEFAULT 0, why TEXT NOT NULL DEFAULT \'\')');
    $db->exec('CREATE INDEX IF NOT EXISTS peer_swaps_a ON peer_swaps (a_user, course)');
    $db->exec('CREATE INDEX IF NOT EXISTS peer_swaps_b ON peer_swaps (b_user, course)');
    $db->exec('CREATE TABLE IF NOT EXISTS peer_notes (swap_id INTEGER NOT NULL REFERENCES peer_swaps(id) ON DELETE CASCADE, from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, overall TEXT NOT NULL DEFAULT \'\', comments TEXT NOT NULL DEFAULT \'[]\', sent INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, PRIMARY KEY (swap_id, from_user))');
    $db->exec('CREATE TABLE IF NOT EXISTS peer_blocks (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, other_id INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, other_id))');
    $ready = true;
  }
  return $db;
}
function mh_peer_on(string $cid): array { require_once __DIR__ . '/instruct.php'; $S = mh_class_ai($cid); return [(bool)$S['peer'], (int)$S['peer_days']]; }
/** The swap, when this person is in it; with which side they are. */
function mh_peer_swap(int $id, int $uid, string $cid): ?array {
  $st = mh_peer_db()->prepare('SELECT * FROM peer_swaps WHERE id = ? AND course = ? AND (a_user = ? OR b_user = ?)'); $st->execute([$id, $cid, $uid, $uid]); $s = $st->fetch();
  if (!$s) return null; $me = (int)$s['a_user'] === $uid ? 'a' : 'b'; $other = $me === 'a' ? 'b' : 'a';
  return $s + ['me' => $me, 'other' => $other, 'my_review' => (int)$s[$me . '_review'], 'their_review' => (int)$s[$other . '_review'], 'other_id' => (int)$s[$other . '_user']];
}
function mh_peer_notes(int $swap, int $from): array {
  $st = mh_peer_db()->prepare('SELECT * FROM peer_notes WHERE swap_id = ? AND from_user = ?'); $st->execute([$swap, $from]); $r = $st->fetch();
  return $r ? ['overall' => (string)$r['overall'], 'comments' => json_decode((string)$r['comments'], true) ?: [], 'sent' => (int)$r['sent'], 'updated' => (int)$r['updated']] : ['overall' => '', 'comments' => [], 'sent' => 0, 'updated' => 0];
}
function mh_peer_name(int $uid): string { $st = mh_db()->prepare('SELECT name, email FROM users WHERE id = ?'); $st->execute([$uid]); $r = $st->fetch(); return $r ? mh_display_name($r) : 'A classmate'; }
/** What classmates sent about one of this person's versions (for its review page, api/drafts.php). */
function mh_peer_for_review(int $uid, int $reviewId): array {
  $db = mh_peer_db(); $out = [];
  $st = $db->prepare('SELECT * FROM peer_swaps WHERE ((a_user = ? AND a_review = ?) OR (b_user = ? AND b_review = ?)) AND closed = 0 ORDER BY id'); $st->execute([$uid, $reviewId, $uid, $reviewId]);
  foreach ($st->fetchAll() as $s) { $other = (int)$s['a_user'] === $uid ? (int)$s['b_user'] : (int)$s['a_user']; $n = mh_peer_notes((int)$s['id'], $other); if ($n['sent']) $out[] = ['swap' => (int)$s['id'], 'name' => mh_peer_name($other), 'overall' => $n['overall'], 'comments' => $n['comments'], 'sent' => $n['sent']]; }
  return $out;
}
function mh_peer_notify(int $to, string $kind, string $title, string $snippet, string $link, array $actor): void {
  try { mh_db()->prepare('INSERT INTO notifications (user_id, kind, post_id, comment_id, actor_id, actor, title, snippet, link, created) VALUES (?, ?, 0, NULL, ?, ?, ?, ?, ?, ?)')->execute([$to, $kind, (int)$actor['id'], mh_display_name($actor), mb_substr($title, 0, 140), mb_substr($snippet, 0, 200), $link, time()]); } catch (Throwable $e) { error_log('StudyCat notify: ' . $e->getMessage()); }
}

function mh_peer_route(string $route, array $in, array $cfg): void {
  $db = mh_peer_db(); $u = mh_require_user(); $uid = (int)$u['id'];
  $cid = mh_ai_cid($in['class'] ?? ($_GET['class'] ?? '')); $C = mh_ai_class($u, $cid); $P = mh_draft_projects($C);
  if (!$P) mh_fail('This class has no projects for peer review.', 404);
  [$on, $days] = mh_peer_on($cid);
  $pname = fn(string $pid) => mh_ai_plain($P[$pid]['short'] ?? $pid, 40);
  switch ($route) {
    case 'peer_status': {
      mh_method('GET');
      $q = $db->prepare('SELECT q.project, q.review_id, q.since, r.version FROM peer_queue q JOIN draft_reviews r ON r.id = q.review_id WHERE q.course = ? AND q.user_id = ? ORDER BY q.since'); $q->execute([$cid, $uid]);
      $st = $db->prepare('SELECT * FROM peer_swaps WHERE course = ? AND (a_user = ? OR b_user = ?) ORDER BY id DESC LIMIT 60'); $st->execute([$cid, $uid, $uid]); $swaps = [];
      foreach ($st->fetchAll() as $s) {
        $me = (int)$s['a_user'] === $uid ? 'a' : 'b'; $other = (int)$s[($me === 'a' ? 'b' : 'a') . '_user'];
        $gave = mh_peer_notes((int)$s['id'], $uid); $got = mh_peer_notes((int)$s['id'], $other);
        $ver = $db->prepare('SELECT version FROM draft_reviews WHERE id = ?'); $ver->execute([(int)$s[$me . '_review']]);
        $swaps[] = ['id' => (int)$s['id'], 'project' => (string)$s['project'], 'created' => (int)$s['created'], 'due' => (int)$s['due'], 'closed' => (int)$s['closed'], 'name' => mh_peer_name($other),
          'my_review' => (int)$s[$me . '_review'], 'my_version' => (int)$ver->fetchColumn(), 'gave' => ['sent' => $gave['sent'], 'started' => $gave['updated'] > 0], 'got' => ['sent' => $got['sent']]];
      }
      mh_json(['ok' => true, 'on' => $on, 'days' => $days, 'waiting' => array_map(fn($r) => ['project' => (string)$r['project'], 'review_id' => (int)$r['review_id'], 'version' => (int)$r['version'], 'since' => (int)$r['since']], $q->fetchAll()), 'swaps' => $swaps]);
    }
    case 'peer_join': {   // offer a version; paired at once when a classmate is waiting with the same project
      mh_method('POST');
      if (!$on) mh_fail('Your instructor has not turned on peer review swaps for this class.', 403);
      $st = $db->prepare('SELECT id, project, version FROM draft_reviews WHERE id = ? AND user_id = ? AND course = ?'); $st->execute([(int)($in['review_id'] ?? 0), $uid, $cid]); $r = $st->fetch();
      if (!$r || !isset($P[$r['project']])) mh_fail('Pick one of your drafts for this class.', 404);
      $pid = (string)$r['project'];
      $open = $db->prepare('SELECT s.id FROM peer_swaps s WHERE s.course = ? AND s.project = ? AND s.closed = 0 AND (s.a_user = ? OR s.b_user = ?) AND (SELECT COUNT(*) FROM peer_notes n WHERE n.swap_id = s.id AND n.sent > 0) < 2'); $open->execute([$cid, $pid, $uid, $uid]);
      if ($open->fetchColumn()) mh_fail('You already have a peer review swap going for ' . $pname($pid) . '. Finish it first.', 409);
      mh_rate_or_fail('peer_join:' . $uid, 30, 3600, 'Slow down a little.');
      $db->beginTransaction();
      try {
        $m = $db->prepare('SELECT q.user_id, q.review_id FROM peer_queue q WHERE q.course = ? AND q.project = ? AND q.user_id != ? AND q.user_id NOT IN (SELECT other_id FROM peer_blocks WHERE user_id = ?) AND q.user_id NOT IN (SELECT user_id FROM peer_blocks WHERE other_id = ?)
          ORDER BY (SELECT COUNT(*) FROM peer_swaps s WHERE s.course = q.course AND s.project = q.project AND ((s.a_user = q.user_id AND s.b_user = ?) OR (s.b_user = q.user_id AND s.a_user = ?))), q.since LIMIT 1');
        $m->execute([$cid, $pid, $uid, $uid, $uid, $uid, $uid]); $mate = $m->fetch();
        if (!$mate) {
          $db->prepare('INSERT INTO peer_queue (course, project, user_id, review_id, since) VALUES (?, ?, ?, ?, ?) ON CONFLICT(course, project, user_id) DO UPDATE SET review_id = excluded.review_id')->execute([$cid, $pid, $uid, (int)$r['id'], time()]);
          $db->commit(); mh_json(['ok' => true, 'waiting' => true]);
        }
        $db->prepare('DELETE FROM peer_queue WHERE course = ? AND project = ? AND user_id IN (?, ?)')->execute([$cid, $pid, $uid, (int)$mate['user_id']]);
        $now = time(); $db->prepare('INSERT INTO peer_swaps (course, project, a_user, a_review, b_user, b_review, created, due) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$cid, $pid, (int)$mate['user_id'], (int)$mate['review_id'], $uid, (int)$r['id'], $now, $now + $days * 86400]);
        $id = (int)$db->lastInsertId(); $db->commit();
      } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
      mh_peer_notify((int)$mate['user_id'], 'peer_pair', $pname($pid), 'Read their draft and write back in ' . $days . ' day' . ($days === 1 ? '' : 's') . '.', '#/' . $cid . '/peer/' . $id, $u);
      mh_json(['ok' => true, 'paired' => $id]);
    }
    case 'peer_leave': {
      mh_method('POST'); $db->prepare('DELETE FROM peer_queue WHERE course = ? AND project = ? AND user_id = ?')->execute([$cid, (string)($in['project'] ?? ''), $uid]);
      mh_json(['ok' => true]);
    }
    case 'peer_get': {   // their draft to read, what I wrote so far, and what they wrote about mine
      mh_method('GET'); $s = mh_peer_swap((int)($_GET['id'] ?? 0), $uid, $cid); if (!$s) mh_fail('That peer review is not yours.', 404);
      $their = null;
      if (!(int)$s['closed']) { $st = $db->prepare('SELECT version, stage, words, text FROM draft_reviews WHERE id = ?'); $st->execute([$s['their_review']]); $t = $st->fetch(); $their = $t ? ['version' => (int)$t['version'], 'stage' => (string)$t['stage'], 'words' => (int)$t['words'], 'text' => (string)$t['text']] : null; }
      $got = mh_peer_notes((int)$s['id'], $s['other_id']);
      mh_json(['ok' => true, 'swap' => ['id' => (int)$s['id'], 'project' => (string)$s['project'], 'created' => (int)$s['created'], 'due' => (int)$s['due'], 'closed' => (int)$s['closed'], 'closed_by_me' => (int)$s['closed_by'] === $uid, 'my_review' => $s['my_review']],
        'name' => mh_peer_name($s['other_id']), 'draft' => $their, 'mine' => mh_peer_notes((int)$s['id'], $uid), 'got' => $got['sent'] ? $got : null]);
    }
    case 'peer_save': {   // what I write about their draft; "send" makes it final and tells them
      mh_method('POST'); $s = mh_peer_swap((int)($in['id'] ?? 0), $uid, $cid); if (!$s) mh_fail('That peer review is not yours.', 404);
      if ((int)$s['closed']) mh_fail('This peer review has ended.', 409);
      $cur = mh_peer_notes((int)$s['id'], $uid); if ($cur['sent']) mh_fail('You already sent this peer review.', 409);
      $st = $db->prepare('SELECT text FROM draft_reviews WHERE id = ?'); $st->execute([$s['their_review']]); $text = (string)$st->fetchColumn(); $N = mh_draft_norm($text);
      $clean = fn($v, int $n) => trim(mb_substr((string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r", '', is_string($v) ? $v : '')), 0, $n));
      $overall = $clean($in['overall'] ?? '', 4000); $comments = [];
      foreach (array_slice(is_array($in['comments'] ?? null) ? $in['comments'] : [], 0, MH_PEER_COMMENTS) as $c) {
        if (!is_array($c)) continue; $q = trim((string)preg_replace('/\s+/u', ' ', $clean($c['quote'] ?? '', 400))); $note = $clean($c['note'] ?? '', 1000);
        if ($note === '') continue;
        if ($q !== '' && mb_strpos($N, mh_draft_norm($q)) === false) mh_fail('One of your comments points at words that are not in their draft. Select the passage again.', 400);
        $comments[] = ['quote' => $q, 'note' => $note];
      }
      $send = !empty($in['send']);
      if ($send && $overall === '' && !$comments) mh_fail('Write a comment or a note on the whole draft first.', 400);
      mh_rate_or_fail('peer_save:' . $uid, 600, 3600, 'Slow down a little.');
      $now = time();
      $db->prepare('INSERT INTO peer_notes (swap_id, from_user, overall, comments, sent, updated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(swap_id, from_user) DO UPDATE SET overall = excluded.overall, comments = excluded.comments, sent = excluded.sent, updated = excluded.updated')
        ->execute([(int)$s['id'], $uid, $overall, json_encode($comments, JSON_UNESCAPED_UNICODE), $send ? $now : 0, $now]);
      if ($send) mh_peer_notify($s['other_id'], 'peer_sent', $pname((string)$s['project']), count($comments) . ' comment' . (count($comments) === 1 ? '' : 's') . ($overall !== '' ? ' and a note on the whole draft' : '') . '.', '#/' . $cid . '/drafts/' . $s['their_review'], $u);
      mh_json(['ok' => true, 'mine' => mh_peer_notes((int)$s['id'], $uid)]);
    }
    case 'peer_report':   // to the moderators, and the swap ends; never paired again
    case 'peer_block': {
      mh_method('POST'); $s = mh_peer_swap((int)($in['id'] ?? 0), $uid, $cid); if (!$s) mh_fail('That peer review is not yours.', 404);
      $why = mh_ai_clip($in['reason'] ?? '', 500);
      if ($route === 'peer_report' && $why === '') mh_fail('Say briefly what is wrong, for the moderators.', 400);
      $now = time();
      $db->prepare('INSERT OR IGNORE INTO peer_blocks (user_id, other_id, created) VALUES (?, ?, ?)')->execute([$uid, $s['other_id'], $now]);
      if (!(int)$s['closed']) $db->prepare('UPDATE peer_swaps SET closed = ?, closed_by = ?, why = ? WHERE id = ?')->execute([$now, $uid, $route === 'peer_report' ? 'report' : 'block', (int)$s['id']]);
      if ($route === 'peer_report') mh_db()->prepare('INSERT INTO reports (kind, item_id, user_id, reason, created) VALUES (\'peer\', ?, ?, ?, ?)')->execute([(int)$s['id'], $uid, $why, $now]);
      mh_json(['ok' => true]);
    }
  }
  mh_fail('Unknown request.', 404);
}
