<?php
/* ============================================================
   MatHub — discussion board endpoints (posts, comments, votes,
   reports, moderation). Included by index.php for forum_* routes.
   ============================================================ */
declare(strict_types=1);
require_once __DIR__ . '/filter.php';

const MH_COURSES = ['calc', 'physics', 'precalc', 'general'];
const MH_FLAIRS = ['question', 'discussion', 'resource', 'study-group', 'exam', 'other'];
const MH_PAGE = 25;

function mh_display_name(array $row, string $prefix = ''): string {
  $name = trim((string)($row[$prefix . 'name'] ?? '')); if ($name !== '') return mb_substr($name, 0, 40);
  $email = (string)($row[$prefix . 'email'] ?? ''); return $email !== '' ? substr($email, 0, strrpos($email, '@') ?: null) : 'student';
}
function mh_banned(int $userId): ?array {
  $st = mh_db()->prepare('SELECT * FROM bans WHERE user_id = ? AND until > ?'); $st->execute([$userId, time()]); $b = $st->fetch(); return $b ?: null;
}
function mh_can_post(array $u): void {
  if ((int)($u['terms_accepted'] ?? 0) <= 0) mh_fail('Please accept the community rules before posting.', 403, ['terms' => false]);
  if ($b = mh_banned((int)$u['id'])) mh_fail('Your posting access is paused until ' . gmdate('M j, Y', (int)$b['until']) . ($b['reason'] ? ' (' . $b['reason'] . ')' : '') . '.', 403, ['banned' => true]);
}
function mh_hot(int $score, int $created): float { $s = $score === 0 ? 0 : ($score > 0 ? 1 : -1) * log10(max(abs($score), 1)); return $s + ($created - 1600000000) / 45000; }
function mh_post_row(array $p, ?array $me, bool $mod, array $votes = []): array {
  $mine = $me && (int)$p['user_id'] === (int)$me['id']; $removed = (int)$p['removed'];
  $out = ['id' => (int)$p['id'], 'course' => $p['course'], 'flair' => $p['flair'], 'title' => $removed ? ($removed === 2 ? '[removed by a moderator]' : '[deleted]') : $p['title'], 'body' => $removed ? '' : $p['body'],
    'anon' => (int)$p['anon'], 'author' => (int)$p['anon'] ? 'Anonymous' : mh_display_name($p, 'u_'), 'mine' => $mine, 'created' => (int)$p['created'], 'edited' => $p['edited'] ? (int)$p['edited'] : null,
    'score' => (int)$p['score'], 'ncomments' => (int)$p['ncomments'], 'pinned' => (int)$p['pinned'], 'locked' => (int)$p['locked'], 'removed' => $removed, 'vote' => $votes['p' . $p['id']] ?? 0];
  if ($mod) { $out['author_real'] = mh_display_name($p, 'u_') . ' <' . $p['u_email'] . '>'; $out['user_id'] = (int)$p['user_id']; if ($removed) { $out['title_real'] = $p['title']; $out['body_real'] = $p['body']; } }
  return $out;
}
function mh_comment_row(array $c, ?array $me, bool $mod, int $postAuthor, array $votes = []): array {
  $mine = $me && (int)$c['user_id'] === (int)$me['id']; $removed = (int)$c['removed'];
  $out = ['id' => (int)$c['id'], 'post_id' => (int)$c['post_id'], 'parent_id' => $c['parent_id'] ? (int)$c['parent_id'] : null, 'body' => $removed ? ($removed === 2 ? '[removed by a moderator]' : '[deleted]') : $c['body'],
    'anon' => (int)$c['anon'], 'author' => (int)$c['anon'] ? 'Anonymous' : mh_display_name($c, 'u_'), 'is_op' => (int)$c['user_id'] === $postAuthor, 'mine' => $mine, 'created' => (int)$c['created'], 'edited' => $c['edited'] ? (int)$c['edited'] : null,
    'score' => (int)$c['score'], 'removed' => $removed, 'vote' => $votes['c' . $c['id']] ?? 0];
  if ($mod) { $out['author_real'] = mh_display_name($c, 'u_') . ' <' . $c['u_email'] . '>'; $out['user_id'] = (int)$c['user_id']; if ($removed) $out['body_real'] = $c['body']; }
  return $out;
}
function mh_my_votes(?array $me, string $kind, array $ids): array {
  if (!$me || !$ids) return [];
  $q = implode(',', array_fill(0, count($ids), '?')); $st = mh_db()->prepare("SELECT item_id, value FROM votes WHERE user_id = ? AND kind = ? AND item_id IN ($q)"); $st->execute(array_merge([$me['id'], $kind], $ids));
  $out = []; foreach ($st->fetchAll() as $r) $out[$kind . $r['item_id']] = (int)$r['value']; return $out;
}
function mh_recount(string $kind, int $id): int {
  $db = mh_db(); $st = $db->prepare('SELECT COALESCE(SUM(value), 0) FROM votes WHERE kind = ? AND item_id = ?'); $st->execute([$kind, $id]); $score = (int)$st->fetchColumn();
  $db->prepare(($kind === 'p' ? 'UPDATE posts' : 'UPDATE comments') . ' SET score = ? WHERE id = ?')->execute([$score, $id]); return $score;
}
function mh_get_post(int $id): ?array {
  $st = mh_db()->prepare('SELECT p.*, u.name AS u_name, u.email AS u_email FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?'); $st->execute([$id]); $p = $st->fetch(); return $p ?: null;
}
function mh_get_comment(int $id): ?array {
  $st = mh_db()->prepare('SELECT c.*, u.name AS u_name, u.email AS u_email FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?'); $st->execute([$id]); $c = $st->fetch(); return $c ?: null;
}

function mh_forum_route(string $route, array $in, array $cfg, string $ip): void {
  $db = mh_db(); $me = mh_current_user(); $mod = mh_is_mod($me); $now = time();
  switch ($route) {

    case 'terms_accept':
      mh_method('POST'); $u = mh_require_user();
      $db->prepare('UPDATE users SET terms_accepted = ? WHERE id = ?')->execute([$now, $u['id']]); $u['terms_accepted'] = $now;
      mh_json(['ok' => true, 'user' => mh_user_public($u)]);

    case 'forum_posts':
      mh_method('GET');
      $course = (string)($_GET['course'] ?? ''); $sort = (string)($_GET['sort'] ?? 'hot'); $q = trim((string)($_GET['q'] ?? '')); $page = max(0, (int)($_GET['page'] ?? 0));
      $where = ['p.removed = 0']; $args = [];
      if ($course !== '' && $course !== 'all') { if (!in_array($course, MH_COURSES, true)) mh_fail('Unknown class.'); $where[] = 'p.course = ?'; $args[] = $course; }
      if ($q !== '') { $where[] = '(p.title LIKE ? OR p.body LIKE ?)'; $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], mb_substr($q, 0, 80)) . '%'; $args[] = $like; $args[] = $like; }
      $order = $sort === 'new' ? 'p.created DESC' : ($sort === 'top' ? 'p.score DESC, p.created DESC' : 'p.created DESC');
      $limit = $sort === 'hot' ? 400 : MH_PAGE + 1; $offset = $sort === 'hot' ? 0 : $page * MH_PAGE;
      $st = $db->prepare('SELECT p.*, u.name AS u_name, u.email AS u_email FROM posts p JOIN users u ON u.id = p.user_id WHERE ' . implode(' AND ', $where) . " ORDER BY p.pinned DESC, $order LIMIT $limit OFFSET $offset"); $st->execute($args); $rows = $st->fetchAll();
      if ($sort === 'hot') { usort($rows, fn($a, $b) => ($b['pinned'] <=> $a['pinned']) ?: (mh_hot((int)$b['score'], (int)$b['created']) <=> mh_hot((int)$a['score'], (int)$a['created']))); $rows = array_slice($rows, $page * MH_PAGE, MH_PAGE + 1); }
      $more = count($rows) > MH_PAGE; $rows = array_slice($rows, 0, MH_PAGE);
      $votes = mh_my_votes($me, 'p', array_map(fn($r) => (int)$r['id'], $rows));
      $posts = array_map(function ($r) use ($me, $mod, $votes) { $o = mh_post_row($r, $me, $mod, $votes); if (!$me) { $o['body'] = ''; $o['author'] = ''; $o['preview'] = true; } else $o['body'] = mb_substr($o['body'], 0, 400); return $o; }, $rows);
      mh_json(['ok' => true, 'posts' => $posts, 'more' => $more, 'page' => $page, 'guest' => !$me]);

    case 'forum_post':
      mh_method('GET'); $u = mh_require_user();
      $p = mh_get_post((int)($_GET['id'] ?? 0)); if (!$p || ((int)$p['removed'] === 2 && !$mod && (int)$p['user_id'] !== (int)$u['id'])) mh_fail('That post is not available.', 404);
      $st = $db->prepare('SELECT c.*, u.name AS u_name, u.email AS u_email FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created ASC'); $st->execute([$p['id']]); $cs = $st->fetchAll();
      $votes = array_merge(mh_my_votes($u, 'p', [(int)$p['id']]), mh_my_votes($u, 'c', array_map(fn($c) => (int)$c['id'], $cs)));
      $b = mh_banned((int)$u['id']);
      mh_json(['ok' => true, 'post' => mh_post_row($p, $u, $mod, $votes), 'comments' => array_map(fn($c) => mh_comment_row($c, $u, $mod, (int)$p['user_id'], $votes), $cs), 'mod' => $mod, 'banned' => $b ? (int)$b['until'] : 0, 'terms' => (int)$u['terms_accepted'] > 0]);

    case 'forum_post_create':
      mh_method('POST'); $u = mh_require_user(); mh_can_post($u);
      mh_rate_or_fail("post:user:{$u['id']}", 12, 3600, 'You are posting very fast. Take a short break and try again.');
      $course = (string)($in['course'] ?? 'general'); $flair = (string)($in['flair'] ?? 'question');
      if (!in_array($course, MH_COURSES, true)) mh_fail('Pick a class for the post.'); if (!in_array($flair, MH_FLAIRS, true)) $flair = 'other';
      $title = trim(preg_replace('/\s+/u', ' ', mh_str($in, 'title', 140))); $body = trim(mb_substr((string)($in['body'] ?? ''), 0, 8000));
      if (mb_strlen($title) < 3) mh_fail('Give the post a title (at least 3 characters).'); if ($body === '') mh_fail('Write something in the body.');
      $title = mh_censor($title); $body = mh_censor($body); $anon = !empty($in['anon']) ? 1 : 0;
      $db->prepare('INSERT INTO posts (user_id, course, flair, title, body, anon, created, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$u['id'], $course, $flair, $title, $body, $anon, $now, $ip]);
      $id = (int)$db->lastInsertId();
      $db->prepare('INSERT OR REPLACE INTO votes (user_id, kind, item_id, value) VALUES (?, "p", ?, 1)')->execute([$u['id'], $id]); mh_recount('p', $id);
      mh_json(['ok' => true, 'post' => mh_post_row(mh_get_post($id), $u, $mod, ['p' . $id => 1])]);

    case 'forum_post_edit':
      mh_method('POST'); $u = mh_require_user(); mh_can_post($u);
      $p = mh_get_post((int)($in['id'] ?? 0)); if (!$p || (int)$p['user_id'] !== (int)$u['id'] || (int)$p['removed']) mh_fail('You can only edit your own posts.', 403);
      $title = trim(preg_replace('/\s+/u', ' ', mh_str($in, 'title', 140))); $body = trim(mb_substr((string)($in['body'] ?? ''), 0, 8000));
      if (mb_strlen($title) < 3 || $body === '') mh_fail('A title and a body are required.');
      $db->prepare('UPDATE posts SET title = ?, body = ?, edited = ? WHERE id = ?')->execute([mh_censor($title), mh_censor($body), $now, $p['id']]);
      mh_json(['ok' => true, 'post' => mh_post_row(mh_get_post((int)$p['id']), $u, $mod, mh_my_votes($u, 'p', [(int)$p['id']]))]);

    case 'forum_post_delete':
      mh_method('POST'); $u = mh_require_user();
      $p = mh_get_post((int)($in['id'] ?? 0)); if (!$p) mh_fail('Post not found.', 404);
      if ((int)$p['user_id'] === (int)$u['id']) $db->prepare('UPDATE posts SET removed = 1 WHERE id = ?')->execute([$p['id']]);
      elseif ($mod) $db->prepare('UPDATE posts SET removed = 2 WHERE id = ?')->execute([$p['id']]);
      else mh_fail('You can only delete your own posts.', 403);
      mh_json(['ok' => true]);

    case 'forum_comment_create':
      mh_method('POST'); $u = mh_require_user(); mh_can_post($u);
      mh_rate_or_fail("comment:user:{$u['id']}", 80, 3600, 'You are commenting very fast. Take a short break and try again.');
      $p = mh_get_post((int)($in['post_id'] ?? 0)); if (!$p || (int)$p['removed']) mh_fail('That post is not available.', 404);
      if ((int)$p['locked'] && !$mod) mh_fail('This post is locked; no new comments.', 403);
      $parent = (int)($in['parent_id'] ?? 0) ?: null;
      if ($parent) { $pc = mh_get_comment($parent); if (!$pc || (int)$pc['post_id'] !== (int)$p['id']) mh_fail('Reply target not found.', 404); }
      $body = trim(mb_substr((string)($in['body'] ?? ''), 0, 3000)); if ($body === '') mh_fail('Write a comment first.');
      $anon = !empty($in['anon']) ? 1 : 0;
      $db->prepare('INSERT INTO comments (post_id, user_id, parent_id, body, anon, created, ip) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$p['id'], $u['id'], $parent, mh_censor($body), $anon, $now, $ip]);
      $id = (int)$db->lastInsertId();
      $db->prepare('INSERT OR REPLACE INTO votes (user_id, kind, item_id, value) VALUES (?, "c", ?, 1)')->execute([$u['id'], $id]); mh_recount('c', $id);
      $db->prepare('UPDATE posts SET ncomments = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND removed = 0) WHERE id = ?')->execute([$p['id'], $p['id']]);
      mh_json(['ok' => true, 'comment' => mh_comment_row(mh_get_comment($id), $u, $mod, (int)$p['user_id'], ['c' . $id => 1])]);

    case 'forum_comment_edit':
      mh_method('POST'); $u = mh_require_user(); mh_can_post($u);
      $c = mh_get_comment((int)($in['id'] ?? 0)); if (!$c || (int)$c['user_id'] !== (int)$u['id'] || (int)$c['removed']) mh_fail('You can only edit your own comments.', 403);
      $body = trim(mb_substr((string)($in['body'] ?? ''), 0, 3000)); if ($body === '') mh_fail('Write a comment first.');
      $db->prepare('UPDATE comments SET body = ?, edited = ? WHERE id = ?')->execute([mh_censor($body), $now, $c['id']]);
      $p = mh_get_post((int)$c['post_id']);
      mh_json(['ok' => true, 'comment' => mh_comment_row(mh_get_comment((int)$c['id']), $u, $mod, (int)$p['user_id'], mh_my_votes($u, 'c', [(int)$c['id']]))]);

    case 'forum_comment_delete':
      mh_method('POST'); $u = mh_require_user();
      $c = mh_get_comment((int)($in['id'] ?? 0)); if (!$c) mh_fail('Comment not found.', 404);
      if ((int)$c['user_id'] === (int)$u['id']) $db->prepare('UPDATE comments SET removed = 1 WHERE id = ?')->execute([$c['id']]);
      elseif ($mod) $db->prepare('UPDATE comments SET removed = 2 WHERE id = ?')->execute([$c['id']]);
      else mh_fail('You can only delete your own comments.', 403);
      $db->prepare('UPDATE posts SET ncomments = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND removed = 0) WHERE id = ?')->execute([$c['post_id'], $c['post_id']]);
      mh_json(['ok' => true]);

    case 'forum_vote':
      mh_method('POST'); $u = mh_require_user();
      mh_rate_or_fail("vote:user:{$u['id']}", 400, 3600);
      $kind = ($in['kind'] ?? '') === 'c' ? 'c' : 'p'; $id = (int)($in['id'] ?? 0); $value = max(-1, min(1, (int)($in['value'] ?? 0)));
      $item = $kind === 'p' ? mh_get_post($id) : mh_get_comment($id); if (!$item || (int)$item['removed']) mh_fail('Not available.', 404);
      if ($value === 0) $db->prepare('DELETE FROM votes WHERE user_id = ? AND kind = ? AND item_id = ?')->execute([$u['id'], $kind, $id]);
      else $db->prepare('INSERT OR REPLACE INTO votes (user_id, kind, item_id, value) VALUES (?, ?, ?, ?)')->execute([$u['id'], $kind, $id, $value]);
      mh_json(['ok' => true, 'score' => mh_recount($kind, $id), 'vote' => $value]);

    case 'forum_report':
      mh_method('POST'); $u = mh_require_user();
      mh_rate_or_fail("report:user:{$u['id']}", 30, 3600);
      $kind = ($in['kind'] ?? '') === 'c' ? 'c' : 'p'; $id = (int)($in['id'] ?? 0); $reason = mh_str($in, 'reason', 300);
      $item = $kind === 'p' ? mh_get_post($id) : mh_get_comment($id); if (!$item) mh_fail('Not available.', 404);
      if ($reason === '') mh_fail('Say briefly what the problem is.');
      $st = $db->prepare('SELECT id FROM reports WHERE kind = ? AND item_id = ? AND user_id = ? AND status = "open"'); $st->execute([$kind, $id, $u['id']]);
      if (!$st->fetch()) $db->prepare('INSERT INTO reports (kind, item_id, user_id, reason, created) VALUES (?, ?, ?, ?, ?)')->execute([$kind, $id, $u['id'], $reason, $now]);
      mh_json(['ok' => true, 'message' => 'Thanks. A moderator will take a look.']);

    case 'forum_reports':
      mh_method('GET'); $u = mh_require_user(); if (!$mod) mh_fail('Moderators only.', 403);
      $st = $db->query('SELECT r.*, u.email AS reporter FROM reports r JOIN users u ON u.id = r.user_id WHERE r.status = "open" ORDER BY r.created DESC LIMIT 200'); $out = [];
      foreach ($st->fetchAll() as $r) {
        $item = $r['kind'] === 'p' ? mh_get_post((int)$r['item_id']) : mh_get_comment((int)$r['item_id']); if (!$item) continue;
        $out[] = ['id' => (int)$r['id'], 'kind' => $r['kind'], 'item_id' => (int)$r['item_id'], 'post_id' => (int)($r['kind'] === 'p' ? $r['item_id'] : $item['post_id']), 'reason' => $r['reason'], 'reporter' => $r['reporter'], 'created' => (int)$r['created'],
          'snippet' => mb_substr($r['kind'] === 'p' ? $item['title'] . ' — ' . $item['body'] : $item['body'], 0, 200), 'author' => mh_display_name($item, 'u_') . ' <' . $item['u_email'] . '>', 'removed' => (int)$item['removed']];
      }
      $bans = $db->query('SELECT b.*, u.email FROM bans b JOIN users u ON u.id = b.user_id WHERE b.until > ' . $now)->fetchAll();
      mh_json(['ok' => true, 'reports' => $out, 'bans' => array_map(fn($b) => ['user_id' => (int)$b['user_id'], 'email' => $b['email'], 'until' => (int)$b['until'], 'reason' => $b['reason']], $bans)]);

    case 'forum_mod':
      mh_method('POST'); $u = mh_require_user(); if (!$mod) mh_fail('Moderators only.', 403);
      $action = (string)($in['action'] ?? ''); $kind = ($in['kind'] ?? '') === 'c' ? 'c' : 'p'; $id = (int)($in['id'] ?? 0);
      $item = $kind === 'p' ? mh_get_post($id) : mh_get_comment($id);
      if (in_array($action, ['pin', 'unpin', 'lock', 'unlock'], true)) { if (!$item || $kind !== 'p') mh_fail('Post not found.', 404); $col = in_array($action, ['pin', 'unpin'], true) ? 'pinned' : 'locked'; $db->prepare("UPDATE posts SET $col = ? WHERE id = ?")->execute([in_array($action, ['pin', 'lock'], true) ? 1 : 0, $id]); }
      elseif ($action === 'remove' || $action === 'restore') { if (!$item) mh_fail('Not found.', 404); $db->prepare(($kind === 'p' ? 'UPDATE posts' : 'UPDATE comments') . ' SET removed = ? WHERE id = ?')->execute([$action === 'remove' ? 2 : 0, $id]); if ($kind === 'c') $db->prepare('UPDATE posts SET ncomments = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND removed = 0) WHERE id = ?')->execute([$item['post_id'], $item['post_id']]); }
      elseif ($action === 'ban') { $target = (int)($in['user_id'] ?? 0) ?: ($item ? (int)$item['user_id'] : 0); if (!$target) mh_fail('Who should be banned?'); if ($target === (int)$u['id']) mh_fail('You cannot ban yourself.'); $days = max(1, min(3650, (int)($in['days'] ?? 7))); $db->prepare('INSERT OR REPLACE INTO bans (user_id, until, reason, created) VALUES (?, ?, ?, ?)')->execute([$target, $now + $days * 86400, mh_str($in, 'reason', 200), $now]); }
      elseif ($action === 'unban') { $target = (int)($in['user_id'] ?? 0); $db->prepare('DELETE FROM bans WHERE user_id = ?')->execute([$target]); }
      elseif ($action === 'resolve') { $db->prepare('UPDATE reports SET status = "closed" WHERE id = ?')->execute([(int)($in['report_id'] ?? 0)]); }
      else mh_fail('Unknown moderation action.');
      if (in_array($action, ['remove', 'restore'], true) || ($action === 'ban' && $item)) $db->prepare('UPDATE reports SET status = "closed" WHERE kind = ? AND item_id = ?')->execute([$kind, $id]);
      mh_json(['ok' => true]);

    /* ---------- administrator ---------- */
    case 'admin_stats':
      mh_method('GET'); $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      $n = fn($sql) => (int)$db->query($sql)->fetchColumn();
      mh_json(['ok' => true, 'users' => $n('SELECT COUNT(*) FROM users WHERE verified = 1'), 'pending' => $n('SELECT COUNT(*) FROM users WHERE verified = 0'), 'active_7d' => $n('SELECT COUNT(*) FROM users WHERE last_login > ' . ($now - 7 * 86400)),
        'posts' => $n('SELECT COUNT(*) FROM posts WHERE removed = 0'), 'comments' => $n('SELECT COUNT(*) FROM comments WHERE removed = 0'), 'removed' => $n('SELECT COUNT(*) FROM posts WHERE removed > 0') + $n('SELECT COUNT(*) FROM comments WHERE removed > 0'),
        'reports' => $n('SELECT COUNT(*) FROM reports WHERE status = "open"'), 'bans' => $n('SELECT COUNT(*) FROM bans WHERE until > ' . $now), 'moderators' => array_values(array_unique(array_merge($cfg['admins'] ?? [], $cfg['moderators'] ?? []))), 'admins' => $cfg['admins'] ?? []]);

    case 'admin_users':
      mh_method('GET'); $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      $q = trim((string)($_GET['q'] ?? '')); $page = max(0, (int)($_GET['page'] ?? 0)); $args = [];
      $where = '1=1'; if ($q !== '') { $where = '(u.email LIKE ? OR u.name LIKE ?)'; $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], mb_substr($q, 0, 80)) . '%'; $args = [$like, $like]; }
      $st = $db->prepare("SELECT u.id, u.email, u.name, u.verified, u.created, u.last_login, u.terms_accepted,
          (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.removed = 0) AS nposts, (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id AND c.removed = 0) AS ncomments,
          (SELECT until FROM bans b WHERE b.user_id = u.id AND b.until > $now) AS banned_until
        FROM users u WHERE $where ORDER BY u.created DESC LIMIT 51 OFFSET " . ($page * 50)); $st->execute($args); $rows = $st->fetchAll();
      $more = count($rows) > 50; $rows = array_slice($rows, 0, 50);
      mh_json(['ok' => true, 'more' => $more, 'users' => array_map(fn($r) => ['id' => (int)$r['id'], 'email' => $r['email'], 'name' => $r['name'], 'verified' => (int)$r['verified'] === 1, 'created' => (int)$r['created'], 'last_login' => (int)$r['last_login'], 'terms' => (int)$r['terms_accepted'] > 0,
        'posts' => (int)$r['nposts'], 'comments' => (int)$r['ncomments'], 'banned_until' => $r['banned_until'] ? (int)$r['banned_until'] : 0, 'mod' => mh_is_mod(['email' => $r['email']]), 'admin' => mh_is_admin(['email' => $r['email']])], $rows)]);

    case 'admin_user':
      mh_method('POST'); $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      $target = (int)($in['user_id'] ?? 0); $action = (string)($in['action'] ?? '');
      $st = $db->prepare('SELECT * FROM users WHERE id = ?'); $st->execute([$target]); $t = $st->fetch(); if (!$t) mh_fail('User not found.', 404);
      if ($target === (int)$u['id'] && in_array($action, ['delete', 'ban'], true)) mh_fail('You cannot ' . $action . ' your own account here. Use Settings.');
      if (mh_is_admin($t) && $action !== 'unban') mh_fail('Other administrators can only be changed in api/config.php.');
      if ($action === 'delete') { $db->prepare('DELETE FROM users WHERE id = ?')->execute([$target]); $db->prepare('DELETE FROM votes WHERE user_id = ?')->execute([$target]); $db->prepare('DELETE FROM reports WHERE user_id = ?')->execute([$target]); $db->prepare('DELETE FROM bans WHERE user_id = ?')->execute([$target]); }
      elseif ($action === 'ban') { $days = max(1, min(3650, (int)($in['days'] ?? 30))); $db->prepare('INSERT OR REPLACE INTO bans (user_id, until, reason, created) VALUES (?, ?, ?, ?)')->execute([$target, $now + $days * 86400, mh_str($in, 'reason', 200), $now]); }
      elseif ($action === 'unban') { $db->prepare('DELETE FROM bans WHERE user_id = ?')->execute([$target]); }
      elseif ($action === 'verify') { $db->prepare('UPDATE users SET verified = 1 WHERE id = ?')->execute([$target]); }
      elseif ($action === 'logout_all') { $db->prepare('DELETE FROM tokens WHERE user_id = ?')->execute([$target]); }
      else mh_fail('Unknown action.');
      mh_json(['ok' => true]);

    case 'admin_purge':
      mh_method('POST'); $u = mh_require_user(); if (!mh_is_admin($u)) mh_fail('Administrators only.', 403);
      $kind = ($in['kind'] ?? '') === 'c' ? 'c' : 'p'; $id = (int)($in['id'] ?? 0);
      if ($kind === 'p') { if (!mh_get_post($id)) mh_fail('Post not found.', 404); $db->prepare('DELETE FROM votes WHERE kind = "c" AND item_id IN (SELECT id FROM comments WHERE post_id = ?)')->execute([$id]); $db->prepare('DELETE FROM reports WHERE kind = "c" AND item_id IN (SELECT id FROM comments WHERE post_id = ?)')->execute([$id]); $db->prepare('DELETE FROM comments WHERE post_id = ?')->execute([$id]); $db->prepare('DELETE FROM votes WHERE kind = "p" AND item_id = ?')->execute([$id]); $db->prepare('DELETE FROM reports WHERE kind = "p" AND item_id = ?')->execute([$id]); $db->prepare('DELETE FROM posts WHERE id = ?')->execute([$id]); }
      else { $c = mh_get_comment($id); if (!$c) mh_fail('Comment not found.', 404); $db->prepare('UPDATE comments SET parent_id = ? WHERE parent_id = ?')->execute([$c['parent_id'], $id]); $db->prepare('DELETE FROM votes WHERE kind = "c" AND item_id = ?')->execute([$id]); $db->prepare('DELETE FROM reports WHERE kind = "c" AND item_id = ?')->execute([$id]); $db->prepare('DELETE FROM comments WHERE id = ?')->execute([$id]); $db->prepare('UPDATE posts SET ncomments = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND removed = 0) WHERE id = ?')->execute([$c['post_id'], $c['post_id']]); }
      mh_json(['ok' => true]);

    default:
      mh_fail('Not found.', 404);
  }
}
