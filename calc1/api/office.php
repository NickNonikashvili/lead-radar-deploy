<?php
/* ============================================================
   Mathub account server — Docs, Slides and Sheets (assets/office-docs.js, office-slides.js, office-sheets.js)
   Members' own files, kept with their account: a document, a slide deck or a spreadsheet, each a JSON body the page
   writes (what is in it is drawn and checked by the page; the server keeps it as it is, within the limits).
   - Saving names the version it was written on (base): when the file changed since on another device, the save is
     refused with 409 and both are kept by the page (it saves its copy as a new file), so nothing is lost.
   - Private: only the owner opens them, and nothing in them is sent anywhere, Bo included, unless the owner asks
     (Get Bo's feedback sends a document's text to draft feedback, as pasting it there would).
   - Limits: 300 files, 8 MB each (pictures included), 200 MB in all.
   - They go with the account (ON DELETE CASCADE) and are in the data export.
   Routes: office_list, office_get, office_save, office_rename, office_delete, office_copy
   ============================================================ */
declare(strict_types=1);

const MH_OFFICE_KINDS = ['doc', 'deck', 'sheet'];
const MH_OFFICE_MAX_FILES = 300;
const MH_OFFICE_MAX_BYTES = 8 * 1024 * 1024;
const MH_OFFICE_MAX_TOTAL = 200 * 1024 * 1024;

function mh_office_db(): PDO {
  static $ready = false; $db = mh_db();
  if (!$ready) {
    $db->exec('CREATE TABLE IF NOT EXISTS office_files (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, words INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, dev TEXT NOT NULL DEFAULT \'\', created INTEGER NOT NULL, updated INTEGER NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS office_files_user ON office_files (user_id, kind, updated)');
    $ready = true;
  }
  return $db;
}
function mh_office_title($s, string $kind): string {
  $t = trim((string)preg_replace('/[\x00-\x1F\x7F]+/u', ' ', is_scalar($s) ? (string)$s : '')); $t = mb_substr((string)preg_replace('/\s+/u', ' ', $t), 0, 120);
  return $t !== '' ? $t : ['doc' => 'Untitled document', 'deck' => 'Untitled presentation', 'sheet' => 'Untitled spreadsheet'][$kind];
}
function mh_office_row(array $r, bool $body = false): array {
  $o = ['id' => (int)$r['id'], 'kind' => (string)$r['kind'], 'title' => (string)$r['title'], 'size' => (int)$r['size'], 'words' => (int)$r['words'], 'version' => (int)$r['version'], 'created' => (int)$r['created'], 'updated' => (int)$r['updated']];
  if ($body) $o['body'] = json_decode((string)$r['body'], true);
  return $o;
}
function mh_office_mine(int $uid, int $id): ?array { $st = mh_office_db()->prepare('SELECT * FROM office_files WHERE id = ? AND user_id = ?'); $st->execute([$id, $uid]); $r = $st->fetch(); return $r ?: null; }
/** The body as the page sent it, checked: JSON of the right shape for its kind, within the size limit. */
function mh_office_body($b, string $kind): array {
  if (!is_array($b)) mh_fail('That file could not be read.', 400);
  $ok = match ($kind) { 'doc' => is_string($b['html'] ?? null), 'deck' => is_array($b['slides'] ?? null), 'sheet' => is_array($b['sheets'] ?? null) };
  if (!$ok) mh_fail('That file could not be read.', 400);
  $json = json_encode($b, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); if ($json === false) mh_fail('That file could not be read.', 400);
  if (strlen($json) > MH_OFFICE_MAX_BYTES) mh_fail('That file is over 8 MB, the most one can be. Make the pictures in it smaller, or split it in two.', 413);
  return [$json, max(0, min(10000000, (int)($b['words'] ?? 0)))];
}

function mh_office_route(string $route, array $in, array $cfg): void {
  $u = mh_require_user(); $uid = (int)$u['id']; $db = mh_office_db();
  switch ($route) {
    case 'office_list': {
      mh_method('GET'); $kind = in_array($_GET['kind'] ?? '', MH_OFFICE_KINDS, true) ? $_GET['kind'] : '';
      $st = $db->prepare('SELECT id, kind, title, size, words, version, created, updated FROM office_files WHERE user_id = ?' . ($kind ? ' AND kind = ?' : '') . ' ORDER BY updated DESC'); $st->execute($kind ? [$uid, $kind] : [$uid]);
      $tot = $db->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS b FROM office_files WHERE user_id = ?'); $tot->execute([$uid]); $t = $tot->fetch();
      mh_json(['ok' => true, 'files' => array_map(fn($r) => mh_office_row($r), $st->fetchAll()), 'count' => (int)$t['n'], 'bytes' => (int)$t['b'], 'max_files' => MH_OFFICE_MAX_FILES, 'max_bytes' => MH_OFFICE_MAX_TOTAL]);
    }
    case 'office_get': {
      mh_method('GET'); $r = mh_office_mine($uid, (int)($_GET['id'] ?? 0)); if (!$r) mh_fail('That file is not here. It may have been deleted.', 404);
      mh_json(['ok' => true, 'file' => mh_office_row($r, true)]);
    }
    case 'office_save': {
      mh_method('POST'); mh_rate_or_fail("office:$uid", 240, 600, 'Saving very often: wait a moment.');
      $id = (int)($in['id'] ?? 0); $now = time(); $dev = mb_substr(preg_replace('/[^\w .:-]/u', '', (string)($in['device'] ?? '')), 0, 60);
      if ($id) {
        $r = mh_office_mine($uid, $id); if (!$r) mh_fail('That file is not here. It may have been deleted.', 404);
        [$json, $words] = mh_office_body($in['body'] ?? null, (string)$r['kind']);
        $base = (int)($in['base'] ?? 0);
        if ($base !== (int)$r['version'] && empty($in['force'])) mh_fail('This file was changed on another device since you opened it.', 409, ['conflict' => true, 'file' => mh_office_row($r), 'device' => (string)$r['dev']]);
        $tot = $db->prepare('SELECT COALESCE(SUM(size), 0) FROM office_files WHERE user_id = ? AND id <> ?'); $tot->execute([$uid, $id]);
        if ((int)$tot->fetchColumn() + strlen($json) > MH_OFFICE_MAX_TOTAL) mh_fail('Your files take up 200 MB, the most there is room for. Delete some, or make pictures smaller.', 413);
        $title = array_key_exists('title', $in) ? mh_office_title($in['title'], (string)$r['kind']) : (string)$r['title'];
        $db->prepare('UPDATE office_files SET title = ?, body = ?, size = ?, words = ?, version = version + 1, dev = ?, updated = ? WHERE id = ? AND user_id = ?')->execute([$title, $json, strlen($json), $words, $dev, $now, $id, $uid]);
      } else {
        $kind = (string)($in['kind'] ?? ''); if (!in_array($kind, MH_OFFICE_KINDS, true)) mh_fail('Pick a document, a presentation or a spreadsheet.', 400);
        [$json, $words] = mh_office_body($in['body'] ?? null, $kind);
        $tot = $db->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS b FROM office_files WHERE user_id = ?'); $tot->execute([$uid]); $t = $tot->fetch();
        if ((int)$t['n'] >= MH_OFFICE_MAX_FILES) mh_fail('That is ' . MH_OFFICE_MAX_FILES . ' files, the most there can be. Delete some first.', 400);
        if ((int)$t['b'] + strlen($json) > MH_OFFICE_MAX_TOTAL) mh_fail('Your files take up 200 MB, the most there is room for. Delete some, or make pictures smaller.', 413);
        $db->prepare('INSERT INTO office_files (user_id, kind, title, body, size, words, version, dev, created, updated) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')->execute([$uid, $kind, mh_office_title($in['title'] ?? '', $kind), $json, strlen($json), $words, $dev, $now, $now]);
        $id = (int)$db->lastInsertId();
      }
      mh_json(['ok' => true, 'file' => mh_office_row(mh_office_mine($uid, $id))]);
    }
    case 'office_rename': {
      mh_method('POST'); $r = mh_office_mine($uid, (int)($in['id'] ?? 0)); if (!$r) mh_fail('That file is not here. It may have been deleted.', 404);
      $db->prepare('UPDATE office_files SET title = ? WHERE id = ?')->execute([mh_office_title($in['title'] ?? '', (string)$r['kind']), (int)$r['id']]);
      mh_json(['ok' => true, 'file' => mh_office_row(mh_office_mine($uid, (int)$r['id']))]);
    }
    case 'office_copy': {
      mh_method('POST'); $r = mh_office_mine($uid, (int)($in['id'] ?? 0)); if (!$r) mh_fail('That file is not here. It may have been deleted.', 404);
      $tot = $db->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS b FROM office_files WHERE user_id = ?'); $tot->execute([$uid]); $t = $tot->fetch();
      if ((int)$t['n'] >= MH_OFFICE_MAX_FILES) mh_fail('That is ' . MH_OFFICE_MAX_FILES . ' files, the most there can be. Delete some first.', 400);
      if ((int)$t['b'] + (int)$r['size'] > MH_OFFICE_MAX_TOTAL) mh_fail('Your files take up 200 MB, the most there is room for. Delete some, or make pictures smaller.', 413);
      $title = mh_office_title(mb_substr((string)($in['title'] ?? ''), 0, 120) ?: 'Copy of ' . $r['title'], (string)$r['kind']); $now = time();
      $db->prepare('INSERT INTO office_files (user_id, kind, title, body, size, words, version, dev, created, updated) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')->execute([$uid, $r['kind'], $title, $r['body'], $r['size'], $r['words'], '', $now, $now]);
      mh_json(['ok' => true, 'file' => mh_office_row(mh_office_mine($uid, (int)$db->lastInsertId()))]);
    }
    case 'office_delete': {
      mh_method('POST'); $st = $db->prepare('DELETE FROM office_files WHERE id = ? AND user_id = ?'); $st->execute([(int)($in['id'] ?? 0), $uid]);
      if (!$st->rowCount()) mh_fail('That file is not here. It may have been deleted.', 404);
      mh_json(['ok' => true]);
    }
  }
  mh_fail('Not found.', 404);
}
