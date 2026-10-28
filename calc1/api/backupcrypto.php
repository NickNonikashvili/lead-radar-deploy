<?php
/* ============================================================
   StudyCat — the encrypted backup file (api/offsite.php sends it; api/backup-tool.php opens it on any computer).
   Format: "MHBAK\x01", a 16-byte salt, the PBKDF2 rounds (uint32, big-endian) and a 4-byte nonce prefix; then
   chunks of [length (uint32)][GCM tag (16)][ciphertext]. The plaintext is the file gzipped, cut in 1 MB pieces;
   the key is PBKDF2-SHA256(passphrase, salt, rounds); chunk i's nonce is the prefix + i (uint64) and its
   authenticated data the header + i + whether it is the last, so a copy that was cut short, reordered or changed
   does not open. Only functions: nothing happens when this file is loaded.
   ============================================================ */
declare(strict_types=1);

const MH_BAK_MAGIC = "MHBAK\x01";
const MH_BAK_ITER = 200000;
const MH_BAK_CHUNK = 1048576;
const MH_BAK_HEAD = 30;   // magic (6) + salt (16) + rounds (4) + nonce prefix (4)

function mh_bak_key(string $pass, string $salt, int $rounds): string { return hash_pbkdf2('sha256', $pass, $salt, $rounds, 32, true); }
/** $src (any file) → $dst, gzipped and encrypted. Returns size and SHA-256 of $dst. */
function mh_bak_encrypt(string $src, string $dst, string $pass): array {
  $in = @fopen($src, 'rb'); $out = @fopen($dst, 'wb'); if (!$in || !$out) throw new RuntimeException('Could not open the backup files.');
  try {
    $salt = random_bytes(16); $np = random_bytes(4); $head = MH_BAK_MAGIC . $salt . pack('N', MH_BAK_ITER) . $np; $key = mh_bak_key($pass, $salt, MH_BAK_ITER);
    fwrite($out, $head); $z = deflate_init(ZLIB_ENCODING_GZIP, ['level' => 6]); $buf = ''; $i = 0;
    $emit = function (string $plain, bool $last) use (&$i, $key, $np, $head, $out): void {
      $tag = ''; $ct = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $np . pack('J', $i), $tag, $head . pack('J', $i) . ($last ? "\x01" : "\x00"), 16);
      if ($ct === false) throw new RuntimeException('Encryption failed.');
      if (fwrite($out, pack('N', strlen($ct)) . $tag . $ct) === false) throw new RuntimeException('Could not write the encrypted copy.');
      $i++;
    };
    while (!feof($in)) {
      $data = fread($in, 1048576); if ($data === false) throw new RuntimeException('Could not read the backup.');
      $buf .= deflate_add($z, $data, ZLIB_NO_FLUSH);
      while (strlen($buf) >= MH_BAK_CHUNK) { $emit(substr($buf, 0, MH_BAK_CHUNK), false); $buf = (string)substr($buf, MH_BAK_CHUNK); }
    }
    $buf .= deflate_add($z, '', ZLIB_FINISH);
    while (strlen($buf) > MH_BAK_CHUNK) { $emit(substr($buf, 0, MH_BAK_CHUNK), false); $buf = (string)substr($buf, MH_BAK_CHUNK); }
    $emit($buf, true);
  } finally { fclose($in); fclose($out); }
  clearstatcache(true, $dst);
  return ['size' => (int)filesize($dst), 'sha256' => hash_file('sha256', $dst)];
}
function mh_bak_read($fh, int $n): string { $s = ''; while (strlen($s) < $n && !feof($fh)) { $b = fread($fh, $n - strlen($s)); if ($b === false || $b === '') break; $s .= $b; } return $s; }
/** $src (an encrypted copy) → $dst, the original file. Returns its size; throws with a reason a person can act on. */
function mh_bak_decrypt(string $src, string $dst, string $pass): int {
  $in = @fopen($src, 'rb'); if (!$in) throw new RuntimeException('Could not open the copy.');
  $out = null; $n = 0;
  try {
    $head = mh_bak_read($in, MH_BAK_HEAD);
    if (strlen($head) !== MH_BAK_HEAD || substr($head, 0, 6) !== MH_BAK_MAGIC) throw new RuntimeException('This is not an encrypted StudyCat backup.');
    $salt = substr($head, 6, 16); $rounds = (int)unpack('N', substr($head, 22, 4))[1]; $np = substr($head, 26, 4);
    if ($rounds < 10000 || $rounds > 5000000) throw new RuntimeException('This copy is damaged.');
    $key = mh_bak_key($pass, $salt, $rounds); $out = @fopen($dst, 'wb'); if (!$out) throw new RuntimeException('Could not write the restored file.');
    $z = inflate_init(ZLIB_ENCODING_GZIP); $i = 0; $next = mh_bak_read($in, 4);
    while (true) {
      if (strlen($next) !== 4) throw new RuntimeException('This copy is cut short.');
      $len = (int)unpack('N', $next)[1]; if ($len > MH_BAK_CHUNK + 1024) throw new RuntimeException('This copy is damaged.');
      $tag = mh_bak_read($in, 16); $ct = $len ? mh_bak_read($in, $len) : '';
      if (strlen($tag) !== 16 || strlen($ct) !== $len) throw new RuntimeException('This copy is cut short.');
      $next = mh_bak_read($in, 4); $last = $next === '';
      $plain = openssl_decrypt($ct, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $np . pack('J', $i), $tag, $head . pack('J', $i) . ($last ? "\x01" : "\x00"));
      if ($plain === false) throw new RuntimeException($i === 0 ? 'Wrong passphrase, or the copy is damaged.' : ($last ? 'This copy is cut short or damaged.' : 'This copy is damaged.'));
      $data = @inflate_add($z, $plain, $last ? ZLIB_FINISH : ZLIB_SYNC_FLUSH); if ($data === false) throw new RuntimeException('This copy is damaged.');
      if ($data !== '' && fwrite($out, $data) === false) throw new RuntimeException('Could not write the restored file.');
      $n += strlen($data); $i++;
      if ($last) break;
    }
  } finally { fclose($in); if ($out) fclose($out); }
  return $n;
}
