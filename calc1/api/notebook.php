<?php
/* ============================================================
   Mathub — the writer's notebook (assets/notebook.js): a writing class's numbered entries (NOTEBOOK in the class data;
   WRIT 101 has fifteen), written on the page and kept with the account so they are there on every device and at the
   end of the semester, when all of them are handed in together. Private: only the writer reads them, and no AI is
   involved. Each entry keeps the prompt the student copied in from class and the text, with its word count.
   Two devices: a save says which saved version it was written on (base) and from which device (dev). When the entry
   has changed since on another device, nothing is overwritten: the save is refused (409) with the saved entry, and
   the page asks which one to keep.
   Routes: notebook_list, notebook_save, notebook_delete.
   ============================================================ */

const MH_NOTEBOOK_MAX = 40000;   // characters in one entry, about 7,000 words
function mh_notebook_db(): PDO {
  static $ready = false; $db = mh_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS notebook_entries (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course TEXT NOT NULL, n INTEGER NOT NULL, prompt TEXT NOT NULL DEFAULT "", text TEXT NOT NULL DEFAULT "", words INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, dev TEXT NOT NULL DEFAULT "", PRIMARY KEY (user_id, course, n))');
    $cols = array_column($db->query('PRAGMA table_info(notebook_entries)')->fetchAll(), 'name');
    if (!in_array('dev', $cols, true)) $db->exec('ALTER TABLE notebook_entries ADD COLUMN dev TEXT NOT NULL DEFAULT ""');
    $ready = true;
  }
  return $db;
}
/** How many entries the class's notebook has (0: it has none). */
function mh_notebook_count(array $u, string $cid): int { $C = mh_ai_class($u, $cid); return max(0, min(40, (int)(($C['NOTEBOOK'] ?? [])['count'] ?? 0))); }
function mh_notebook_row(array $r): array { return ['n' => (int)$r['n'], 'prompt' => (string)$r['prompt'], 'text' => (string)$r['text'], 'words' => (int)$r['words'], 'updated' => (int)$r['updated']]; }

function mh_notebook_route(string $route, array $in, array $cfg, string $ip): void {
  $db = mh_notebook_db(); $u = mh_require_user(); $uid = (int)$u['id'];
  $cid = mh_ai_cid($in['class'] ?? ($_GET['class'] ?? '')); $count = mh_notebook_count($u, $cid);
  if (!$count) mh_fail('This class has no writer’s notebook.', 404);
  switch ($route) {
    case 'notebook_list': {
      mh_method('GET');
      $st = $db->prepare('SELECT * FROM notebook_entries WHERE user_id = ? AND course = ? ORDER BY n'); $st->execute([$uid, $cid]);
      mh_json(['ok' => true, 'count' => $count, 'entries' => array_map('mh_notebook_row', $st->fetchAll())]);
    }
    case 'notebook_save': {
      mh_method('POST'); $n = (int)($in['n'] ?? 0);
      if ($n < 1 || $n > $count) mh_fail('That entry is not in this notebook.', 400);
      $text = str_replace("\r", '', is_string($in['text'] ?? null) ? $in['text'] : '');
      $text = (string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text);
      if (mb_strlen($text) > MH_NOTEBOOK_MAX) mh_fail('That entry is too long to keep (about 7,000 words). Split it in two.', 413);
      $prompt = mh_ai_clip($in['prompt'] ?? '', 2000);
      $base = (int)($in['base'] ?? 0); $dev = preg_match('/^[a-z0-9]{8,32}$/', (string)($in['dev'] ?? '')) ? (string)$in['dev'] : '';
      mh_rate_or_fail("notebook:$uid", 900, 3600, 'Saving too often. Your words are kept on this device; try again in a few minutes.');
      $st = $db->prepare('SELECT * FROM notebook_entries WHERE user_id = ? AND course = ? AND n = ?'); $st->execute([$uid, $cid, $n]); $row = $st->fetch();
      // changed since this device's copy was written, by another device, to something else: keep both, ask
      if ($row && (int)$row['updated'] !== $base && ($dev === '' || $row['dev'] !== $dev) && ($row['text'] !== $text || $row['prompt'] !== $prompt))
        mh_fail('This entry was changed on another device.', 409, ['conflict' => true, 'entry' => mh_notebook_row($row)]);
      $words = count(preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY)); $now = max((int)(microtime(true) * 1000), $row ? (int)$row['updated'] + 1 : 0);
      $db->prepare('INSERT INTO notebook_entries (user_id, course, n, prompt, text, words, updated, dev) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, course, n) DO UPDATE SET prompt = excluded.prompt, text = excluded.text, words = excluded.words, updated = excluded.updated, dev = excluded.dev')
        ->execute([$uid, $cid, $n, $prompt, $text, $words, $now, $dev]);
      mh_json(['ok' => true, 'entry' => ['n' => $n, 'prompt' => $prompt, 'text' => $text, 'words' => $words, 'updated' => $now]]);
    }
    case 'notebook_delete': {
      mh_method('POST'); $n = (int)($in['n'] ?? 0);
      $st = $db->prepare('DELETE FROM notebook_entries WHERE user_id = ? AND course = ? AND n = ?'); $st->execute([$uid, $cid, $n]);
      mh_json(['ok' => true, 'deleted' => $st->rowCount()]);
    }
  }
  mh_fail('Unknown request.', 404);
}
