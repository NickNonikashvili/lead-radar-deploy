<?php
/* ============================================================
   StudyCat account server — checking a syllabus before Bo reads it for the class maker
   - Any signed-in member can have Bo read a syllabus (api/ai.php, ai_class) to fill in the class maker
     (assets/maker.js). The class is the student's own (api/myclasses.php): it is never published for everyone.
     Before Bo reads anything, the upload is checked:
       * for malware (mh_cc_scan): the file has to be what it says it is (a PDF, a photo or plain text, by its
         first bytes), and never a program, an archive or a script under another name; a photo with a program
         or a web script hidden after the picture is refused; a PDF with active content (JavaScript, launch
         actions, embedded files, rich media, XFA forms, forms that send data) is refused, looking inside its
         compressed streams too, and a password-protected PDF cannot be read. When the server has ClamAV it
         scans the file as well, and when an administrator sets virustotal_key, VirusTotal is asked about the
         file's SHA-256 fingerprint (only the fingerprint is sent, never the file). The file itself is never
         kept: it goes to the AI to be read and is gone when the request ends.
       * that it is the syllabus of a course (MH_CC_SCREEN, an AI check of the document), not homework, notes or
         something else, and its code, title, school and term.
       * whether StudyCat's catalog has the same course (mh_cc_find): the maker offers it next to the student's own.
   - Public classes made from a syllabus are retired (2026.10.28.2): the routes community_publish and community_mine
     are gone. Classes published before stay in class_packs (uploaded_by "community:<account id>"); students who
     have one keep it, the class picker no longer offers it to others, and the admin panel's Classes tab can hide
     or delete it.
   ============================================================ */
declare(strict_types=1);

require_once __DIR__ . '/packs.php';

const MH_CC_SCREEN = <<<'TXT'
CHECK THIS DOCUMENT before anything is written. A student wants their own study class made from it, so it has to be the syllabus (or course outline or schedule) of a course.
A syllabus names the course and has course content: the topics or a schedule, and usually grading, exams, the instructor or the school.
It is NOT a syllabus if it is homework, a problem set, lecture notes, a textbook chapter, an essay, a résumé, a letter, an advertisement, a story, or random or placeholder text.
Reply with this JSON: {"syllabus": true or false, "reason": "one short sentence to show the student", "code": "the course code exactly as written (like CHMY 121), or empty", "name": "the course title", "school": "the college or university, or empty", "term": "like Fall 2026, or empty"}
TXT;

/* ---------- the course code and the school, compared loosely ---------- */
/** "CHMY 121", "chmy-121", "M151Q" → "CHMY121", "M151": the subject letters and the course number, without a trailing core letter. */
function mh_cc_code(string $raw): string {
  return preg_match('/\b([A-Z]{1,6})\s*[-–.]?\s*(\d{2,4})(?![0-9])/', strtoupper($raw), $m) ? $m[1] . $m[2] : '';
}
function mh_cc_school(string $raw): string {
  $s = strtolower(preg_replace('/[^a-z]/i', '', str_replace('&', 'and', $raw)));
  $s = preg_replace('/^the/', '', $s);
  if ($s === 'msu' || str_contains($s, 'montanastate')) return 'montanastate';
  return $s;
}
function mh_cc_same_school(string $a, string $b): bool { $a = mh_cc_school($a); $b = mh_cc_school($b); return $a === '' || $b === '' || $a === $b || str_contains($a, $b) || str_contains($b, $a); }

/** Every class on StudyCat that counts as there already: the built-in classes and the published class packs
    (not hidden ones, and not a class an instructor runs for their own students in #/teach). */
function mh_cc_catalog(): array {
  static $out = null; if ($out !== null) return $out; $out = [];
  foreach (array_keys(MH_BUILTIN_NAMES) as $id) {
    $j = json_decode((string)@file_get_contents(__DIR__ . "/classdata/$id.json"), true); if (!is_array($j)) continue;
    $out[] = ['id' => $id, 'code' => (string)($j['code'] ?? ''), 'name' => (string)($j['name'] ?? ''), 'school' => (string)($j['COURSE']['school'] ?? 'Montana State University')];
  }
  foreach (mh_pack_db()->query("SELECT id, code, name, stub FROM class_packs WHERE enabled = 1 AND uploaded_by NOT LIKE 'teach:%'")->fetchAll() as $r) {
    $st = json_decode((string)$r['stub'], true);
    $out[] = ['id' => (string)$r['id'], 'code' => (string)$r['code'], 'name' => (string)$r['name'], 'school' => (string)($st['COURSE']['school'] ?? '')];
  }
  return $out;
}
/** The class on StudyCat with this course code at this school, or null. */
function mh_cc_find(string $code, string $school): ?array {
  $k = mh_cc_code($code); if ($k === '') return null;
  foreach (mh_cc_catalog() as $c) if (mh_cc_code($c['code']) === $k && mh_cc_same_school($c['school'], $school)) return ['id' => $c['id'], 'code' => $c['code'], 'name' => $c['name']];
  return null;
}

/* ---------- the malware check ---------- */
const MH_CC_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** '' when the file is safe to read, otherwise what to tell the student. $file is ['type', 'data' (base64)] from mh_ai_file
    (or a stored class request's file); a Word file (.docx) is allowed when $file['type'] says so. $report gets what was
    checked, for the admin panel: the kind, each check, ClamAV and VirusTotal's answers and the file's SHA-256. */
function mh_cc_scan(array $file, array $cfg, ?array &$report = null): string {
  $bin = base64_decode((string)$file['data'], true); if ($bin === false || $bin === '') return 'That file could not be read.';
  $type = (string)$file['type'];
  $report = ['kind' => ['application/pdf' => 'PDF', MH_CC_DOCX => 'Word document', 'text/plain' => 'Text file'][$type] ?? (str_starts_with($type, 'image/') ? 'Photo' : $type), 'sha256' => hash('sha256', $bin), 'bytes' => strlen($bin), 'checks' => [], 'clamav' => 'not on this server', 'virustotal' => 'not set up', 'at' => time()];
  $wrong = 'That file is not a syllabus: it is %s. Upload the syllabus as a PDF, a photo or a text file.';
  foreach (["MZ" => 'a Windows program', "\x7fELF" => 'a program', "\xcf\xfa\xed\xfe" => 'a program', "\xce\xfa\xed\xfe" => 'a program', "\xfe\xed\xfa" => 'a program', "\xca\xfe\xba\xbe" => 'a program',
            "PK\x03\x04" => 'a compressed archive', "Rar!" => 'a compressed archive', "7z\xbc\xaf" => 'a compressed archive', "\x1f\x8b" => 'a compressed archive', "#!" => 'a script', "\xd0\xcf\x11\xe0" => 'an Office document'] as $sig => $what)
    if (str_starts_with($bin, $sig) && !($type === MH_CC_DOCX && $sig === "PK\x03\x04")) return sprintf($wrong, $what);
  $report['checks'][] = 'Not a program, an archive or a script';
  if ($type === MH_CC_DOCX) {
    if (!str_starts_with($bin, "PK\x03\x04")) return 'That is not a real Word file. Save it as a PDF, or paste its text.';
    $why = mh_cc_docx_check($bin); if ($why !== '') return $why;
    $report['checks'][] = 'No macros, embedded files or programs, outside templates or links that run things';
  } elseif ($type === 'application/pdf') {
    if (strpos(substr($bin, 0, 1024), '%PDF-') === false) return 'That file is not a real PDF. Export the syllabus as a PDF again, or paste its text.';
    $act = mh_cc_pdf_active($bin);
    if ($act === 'password') return 'That PDF is protected with a password, so Bo cannot read it. Save a copy without the password, or paste its text.';
    if ($act !== '') return "That PDF was refused: it has $act in it, which a syllabus never needs. Print it to a new PDF, or paste its text.";
    $report['checks'][] = 'A real PDF, with no JavaScript, launch actions, embedded files, media or forms that send data (inside its compressed parts too), and no password';
  } elseif (str_starts_with($type, 'image/')) {
    $info = @getimagesizefromstring($bin); $want = ['image/jpeg' => IMAGETYPE_JPEG, 'image/png' => IMAGETYPE_PNG, 'image/webp' => IMAGETYPE_WEBP, 'image/gif' => IMAGETYPE_GIF][$type] ?? -1;
    if (!$info || $info[2] !== $want) return 'That photo could not be read. Take the picture again, or upload a PDF.';
    if ($info[0] > 20000 || $info[1] > 20000) return 'That photo is too large to read. Take it again at a normal size.';
    // a picture with a program or a web script hidden in it
    if (preg_match('/<\?php|<%@|<script[\s>]/i', $bin) || (strpos($bin, "PK\x03\x04") !== false && strpos($bin, "PK\x05\x06") !== false)) return 'That photo was refused: it has something hidden inside it. Take the picture again.';
    $report['checks'][] = 'A real picture, with nothing hidden after it';
  } elseif ($type === 'text/plain') {
    if (strpos($bin, "\0") !== false || !mb_check_encoding($bin, 'UTF-8')) return 'That text file could not be read. Paste the text instead.';
    $report['checks'][] = 'Plain text';
  }
  $clam = mh_cc_clamav($bin); if ($clam === true) return 'That file was refused: the virus scanner found something in it.';
  if ($clam === false) $report['clamav'] = 'clean';
  $key = trim((string)($cfg['virustotal_key'] ?? ''));
  if ($key !== '') {
    $bad = mh_cc_virustotal($report['sha256'], $key, $cfg); if ($bad !== null && $bad > 0) return 'That file was refused: virus scanners know it as harmful.';
    $report['virustotal'] = $bad === null ? 'not seen before (only its fingerprint was looked up)' : 'clean';
  }
  return '';
}
/** A Word file (.docx is a zip of XML parts): '' when it is only a document, otherwise why it is refused. Macros, embedded
    files and objects, ActiveX, programs or scripts inside, a template, frame or object loaded from outside (how Word files
    smuggle code in), DDE fields that run commands and pieces pulled in from elsewhere are refused; so is a zip that
    unpacks to far more than it is (a zip bomb), or one that is not a Word document. */
function mh_cc_docx_check(string $bin): string {
  if (!class_exists('ZipArchive')) return 'This server cannot open Word files to check them. Save the syllabus as a PDF, or paste its text.';
  $tmp = tempnam(sys_get_temp_dir(), 'mhdocx'); if ($tmp === false || @file_put_contents($tmp, $bin) === false) return 'That Word file could not be read. Save it as a PDF, or paste its text.';
  $z = new ZipArchive(); $ok = $z->open($tmp, ZipArchive::RDONLY) === true;
  try {
    if (!$ok) return 'That Word file could not be opened. Save it as a PDF, or paste its text.';
    if ($z->numFiles < 3 || $z->numFiles > 3000) return 'That is not a normal Word file. Save it as a PDF, or paste its text.';
    $total = 0; $names = [];
    for ($i = 0; $i < $z->numFiles; $i++) {
      $st = $z->statIndex($i); if (!$st) return 'That Word file could not be read. Save it as a PDF, or paste its text.';
      $n = (string)$st['name']; $names[] = $n; $total += (int)$st['size'];
      if ((int)$st['size'] > 60000000 || $total > 150000000 || ((int)$st['comp_size'] > 0 && (int)$st['size'] / (int)$st['comp_size'] > 200 && (int)$st['size'] > 5000000)) return 'That Word file unpacks to far more than it should, so it was refused. Save it as a PDF.';
      if (preg_match('#(^|/)(vbaProject\.bin|vbaData\.xml)$#i', $n)) return 'That Word file was refused: it has macros in it, which a syllabus never needs. Save it as a PDF, or paste its text.';
      if (preg_match('#(^|/)(activeX|embeddings)/|oleObject|\.(exe|dll|com|bat|cmd|scr|pif|js|jse|vbs|vbe|wsf|ps1|hta|jar|msi|lnk|sh)$#i', $n)) return 'That Word file was refused: it has an embedded file or program in it, which a syllabus never needs. Save it as a PDF, or paste its text.';
    }
    if (!in_array('[Content_Types].xml', $names, true) || !in_array('word/document.xml', $names, true)) return 'That is not a Word document. Upload the syllabus as a PDF, a photo or a Word (.docx) file.';
    $ct = (string)$z->getFromName('[Content_Types].xml'); if (stripos($ct, 'macroEnabled') !== false || stripos($ct, 'vbaProject') !== false) return 'That Word file was refused: it is made to run macros. Save it as a PDF, or paste its text.';
    foreach ($names as $n) {
      if (preg_match('#\.rels$#i', $n)) {
        $x = (string)$z->getFromName($n);
        if (preg_match_all('#<Relationship\b[^>]*>#i', $x, $mm)) foreach ($mm[0] as $rel)
          if (preg_match('#TargetMode\s*=\s*"External"#i', $rel) && preg_match('#Type\s*=\s*"[^"]*/(attachedTemplate|oleObject|frame|subDocument|aFChunk|package|control)"#i', $rel)) return 'That Word file was refused: it loads something from the internet when it opens. Save it as a PDF, or paste its text.';
      }
      if (preg_match('#^word/[^/]+\.xml$#i', $n)) {
        $x = (string)$z->getFromName($n);
        if (preg_match('#<w:altChunk\b#i', $x)) return 'That Word file was refused: it pulls in content from elsewhere. Save it as a PDF, or paste its text.';
        if (preg_match('#<w:instrText\b[^>]*>[^<]*\bDDE(AUTO)?\b|\bw:instr\s*=\s*"[^"]*\bDDE(AUTO)?\b#i', $x)) return 'That Word file was refused: it has a field that can run commands. Save it as a PDF, or paste its text.';
      }
    }
    return '';
  } finally { if ($ok) $z->close(); @unlink($tmp); }
}
/** The text of a Word file (.docx), paragraph by paragraph, for the admin's preview and for Bo; '' when it cannot be read. */
function mh_cc_docx_text(string $bin, int $max = 120000): string {
  if (!class_exists('ZipArchive')) return '';
  $tmp = tempnam(sys_get_temp_dir(), 'mhdocx'); if ($tmp === false || @file_put_contents($tmp, $bin) === false) return '';
  $z = new ZipArchive(); $x = '';
  if ($z->open($tmp, ZipArchive::RDONLY) === true) { $x = (string)$z->getFromName('word/document.xml'); $z->close(); }
  @unlink($tmp); if ($x === '') return '';
  $x = preg_replace(['#</w:p>#', '#<w:(tab|br|cr)\b[^>]*/>#', '#</w:tc>#'], ["\n", "\t", "\t"], $x);
  $t = html_entity_decode(strip_tags($x), ENT_QUOTES | ENT_XML1, 'UTF-8');
  $t = preg_replace(["/[ \t]+\n/", "/\n{3,}/"], ["\n", "\n\n"], $t);
  return mb_substr(trim($t), 0, $max);
}
/** What active content a PDF has ('' for none, 'password' when it is encrypted): its names may be written with #xx escapes,
    and its compressed streams (object streams too) are opened and looked through, up to a limit. */
function mh_cc_pdf_active(string $bin): string {
  if (preg_match('#/Encrypt(?![A-Za-z])#', $bin)) return 'password';
  $keys = ['/JavaScript' => 'JavaScript', '/JS' => 'JavaScript', '/Launch' => 'an action that opens a program', '/EmbeddedFile' => 'a file hidden inside it', '/RichMedia' => 'embedded media', '/XFA' => 'an XFA form', '/SubmitForm' => 'a form that sends data', '/ImportData' => 'an action that loads data'];
  $look = function (string $s) use ($keys): string {
    if (strpos($s, '#') !== false) $s = preg_replace_callback('/#([0-9A-Fa-f]{2})/', fn($m) => chr(hexdec($m[1])), $s);   // /J#61vaScript is /JavaScript
    foreach ($keys as $k => $what) if (preg_match('#' . preg_quote($k, '#') . '(?![A-Za-z0-9])#', $s)) return $what;
    return '';
  };
  $w = $look($bin); if ($w !== '') return $w;
  $off = 0; $seen = 0; $total = 0;
  while ($seen < 4000 && $total < 60000000 && preg_match('/stream\r?\n/', $bin, $m, PREG_OFFSET_CAPTURE, $off)) {
    $start = $m[0][1] + strlen($m[0][0]); $end = strpos($bin, 'endstream', $start); if ($end === false) break;
    $dict = substr($bin, max(0, $m[0][1] - 800), min(800, $m[0][1]));
    if (preg_match_all('/\d+\s+\d+\s+obj\b/', $dict, $om, PREG_OFFSET_CAPTURE)) $dict = substr($dict, (int)end($om[0])[1]);   // this stream's own dictionary
    $off = $end + 9; $seen++;
    if (preg_match('#/Subtype\s*/Image#', $dict) || !preg_match('#/FlateDecode#', $dict)) continue;   // pictures, and streams that are not compressed (already looked through)
    $out = @zlib_decode(substr($bin, $start, $end - $start), 20000000); if (!is_string($out) || $out === '') continue;
    $total += strlen($out); $w = $look($out); if ($w !== '') return $w;
  }
  return '';
}
/** ClamAV, when the server has it: true when it finds something, false when clean, null when it cannot run. */
function mh_cc_clamav(string $bin): ?bool {
  if (!function_exists('proc_open')) return null;
  $exe = ''; foreach (['/usr/bin/clamdscan', '/usr/local/bin/clamdscan', '/usr/bin/clamscan', '/usr/local/bin/clamscan'] as $p) if (@is_executable($p)) { $exe = $p; break; }
  if ($exe === '') return null;
  $pr = @proc_open([$exe, '--no-summary', '-'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes); if (!is_resource($pr)) return null;
  @fwrite($pipes[0], $bin); @fclose($pipes[0]); stream_set_blocking($pipes[1], false); $t = time();
  while (time() - $t < 40) { $s = proc_get_status($pr); if (!$s['running']) break; usleep(100000); }
  $s = proc_get_status($pr); if ($s['running']) { @proc_terminate($pr); @proc_close($pr); return null; }
  @fclose($pipes[1]); @fclose($pipes[2]); @proc_close($pr);
  return $s['exitcode'] === 1 ? true : ($s['exitcode'] === 0 ? false : null);
}
/** How many of VirusTotal's scanners call this file harmful (by its SHA-256 only), or null when it is unknown or unreachable. */
function mh_cc_virustotal(string $sha, string $key, array $cfg): ?int {
  if (!function_exists('curl_init')) return null;
  $url = rtrim((string)($cfg['virustotal_api'] ?? 'https://www.virustotal.com/api/v3/files/'), '/') . '/' . $sha;
  $ch = curl_init($url); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_HTTPHEADER => ['x-apikey: ' . $key, 'accept: application/json']]);
  $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  if ($raw === false || $code !== 200) return null;
  $j = json_decode((string)$raw, true); $st = $j['data']['attributes']['last_analysis_stats'] ?? null;
  return is_array($st) ? (int)($st['malicious'] ?? 0) : null;
}
