<?php
/* ============================================================
   Mathub — open an off-site backup (api/offsite.php) on any computer with PHP 8 (OpenSSL, zlib, PDO SQLite), with
   this file and backupcrypto.php beside it:
     php backup-tool.php decrypt <copy.sqlite.mhbak> <restored.sqlite>
     php backup-tool.php check <restored.sqlite>
   The passphrase is asked for (or read from MATHUB_BACKUP_PASSPHRASE). To put a restored database back, stop the
   site, replace api/data/mathub.sqlite with it (delete mathub.sqlite-wal and -shm beside it) and start again.
   Command line only: the web gets a 404.
   ============================================================ */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/backupcrypto.php';

function mh_bak_check(string $file): string {
  $db = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $check = (string)$db->query('PRAGMA integrity_check')->fetchColumn();
  $users = (int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn(); $tables = (int)$db->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")->fetchColumn();
  return "integrity: $check · $tables tables · $users members";
}
function mh_ask(string $prompt): string {
  $env = getenv('MATHUB_BACKUP_PASSPHRASE'); if (is_string($env) && $env !== '') return $env;
  fwrite(STDERR, $prompt); $tty = stripos(PHP_OS, 'WIN') !== 0 && function_exists('posix_isatty') && posix_isatty(STDIN);
  if ($tty) shell_exec('stty -echo'); $line = fgets(STDIN); if ($tty) { shell_exec('stty echo'); fwrite(STDERR, "\n"); }
  return rtrim((string)$line, "\r\n");
}

[$cmd, $a, $b] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? ''];
try {
  if ($cmd === 'decrypt' && $a !== '' && $b !== '') {
    if (file_exists($b)) throw new RuntimeException("$b already exists: name a new file.");
    try { $n = mh_bak_decrypt($a, $b, mh_ask('Passphrase: ')); } catch (Throwable $e) { @unlink($b); throw $e; }
    echo "Restored $n bytes to $b\n", mh_bak_check($b), "\n"; exit(0);
  }
  if ($cmd === 'check' && $a !== '') { echo mh_bak_check($a), "\n"; exit(0); }
  fwrite(STDERR, "Usage:\n  php backup-tool.php decrypt <copy.sqlite.mhbak> <restored.sqlite>\n  php backup-tool.php check <restored.sqlite>\n"); exit(2);
} catch (Throwable $e) { fwrite(STDERR, $e->getMessage() . "\n"); exit(1); }
