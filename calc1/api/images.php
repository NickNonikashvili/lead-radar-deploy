<?php
/* ============================================================
   StudyCat account server — pictures Bo makes for his board (assets/board-draw-more.js, the "image" drawing)
   - ai_image {prompt, style, shape, cid}: OpenAI's image model (ai_image_model, gpt-image-2; gpt-image-1 if the
     account cannot use it) draws it, with what Bo knows about the student and the class (api/students.php) so it
     fits them. It is kept in api/data/ai-img/ under a name made from what was asked, so the same picture is never
     made, or paid for, twice. Costs credits_image (15) credits, credits_image_big (22) wide or tall (api/credits.php).
   - ai_image_file &id=: the picture, to signed-in members only.
   ============================================================ */
declare(strict_types=1);

require_once __DIR__ . '/credits.php';

function mh_img_dir(): string { $d = __DIR__ . '/data/ai-img'; if (!is_dir($d)) @mkdir($d, 0775, true); return $d; }
function mh_img_settings(array $cfg): array {
  $V = mh_ai_voice_settings($cfg);   // the OpenAI key and address Bo's voice uses
  return ['key' => $V['key'], 'url' => $V['url'], 'model' => trim((string)($cfg['ai_image_model'] ?? 'gpt-image-2')) ?: 'gpt-image-2',
    'quality' => in_array($cfg['ai_image_quality'] ?? '', ['low', 'medium', 'high'], true) ? $cfg['ai_image_quality'] : 'medium'];
}
const MH_IMG_STYLE = [
  'diagram' => 'A clean, labelled educational diagram, like a good textbook figure: white background, clear outlines, a few flat colours, every label spelled correctly and pointing at the right part.',
  'illustration' => 'A clear educational illustration, friendly and modern, accurate in its details, with only the labels it needs, spelled correctly.',
  'photo' => 'A realistic, photographic image, accurate in its details, without any text.',
  'sketch' => 'A neat hand-drawn sketch on white paper, like a tutor would draw, with short labels spelled correctly.'];

/** One image from OpenAI: [HTTP status, the decoded bytes or '', what went wrong]. */
function mh_img_make(array $I, string $model, string $prompt, string $size): array {
  if (!function_exists('curl_init')) return [503, '', 'curl'];
  $body = json_encode(['model' => $model, 'prompt' => $prompt, 'size' => $size, 'quality' => $I['quality'], 'n' => 1, 'output_format' => 'webp', 'output_compression' => 85], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  $ch = curl_init(rtrim($I['url'], '/') . '/images/generations');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => 170, CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $I['key'], 'Content-Type: application/json']]);
  $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  if ($raw === false) return [504, '', 'no answer'];
  $j = json_decode((string)$raw, true); $b64 = is_array($j) ? (string)($j['data'][0]['b64_json'] ?? '') : '';
  if ($code < 200 || $code >= 300 || $b64 === '') return [$code ?: 502, '', is_array($j) ? (string)($j['error']['message'] ?? $j['error']['code'] ?? '') : substr((string)$raw, 0, 200)];
  $bin = base64_decode($b64, true); return $bin === false ? [502, '', 'bad image'] : [200, $bin, ''];
}

function mh_img_route(string $route, array $in, array $cfg): void {
  switch ($route) {
    case 'ai_image': {
      mh_method('POST'); $u = mh_require_user(); $uid = (int)$u['id']; $I = mh_img_settings($cfg);
      if ($I['key'] === '') mh_fail('Pictures are not switched on yet.', 503);
      $prompt = trim(mb_substr(preg_replace('/\s+/u', ' ', (string)($in['prompt'] ?? '')), 0, 900)); if (mb_strlen($prompt) < 3) mh_fail('Describe the picture first.', 400);
      $style = isset(MH_IMG_STYLE[(string)($in['style'] ?? '')]) ? (string)$in['style'] : 'illustration';
      $shape = in_array($in['shape'] ?? '', ['wide', 'tall'], true) ? (string)$in['shape'] : 'square';
      $size = ['square' => '1024x1024', 'wide' => '1536x1024', 'tall' => '1024x1536'][$shape];
      $ln = defined('MH_AI_LANGS') ? (MH_AI_LANGS[is_string($in['lang'] ?? null) ? $in['lang'] : ''] ?? '') : '';   // words in the picture in their language (assets/i18n.js)
      $key = hash('sha256', json_encode(array_merge([$I['model'], $I['quality'], $size, $style, $prompt], $ln !== '' ? [$ln] : [])));
      $file = mh_img_dir() . "/$key.webp"; $url = 'api/index.php?r=ai_image_file&id=' . $key;
      if (is_file($file) && filesize($file) > 0) mh_json(['ok' => true, 'url' => $url, 'id' => $key, 'kept' => true]);   // made before: free
      $C = mh_credits_cfg($cfg); $cost = (int)round(1000 * ($shape === 'square' ? $C['image'] : $C['image_big']));
      mh_credits_need($u, $cost, $cfg, 'a picture');
      mh_rate_or_fail("ai_image:$uid", 20, 3600, 'That is a lot of pictures in an hour. Try again in a bit.');
      mh_rate_or_fail("ai_image_day:$uid", 60, 86400, 'That is a lot of pictures for one day. Bo can draw more tomorrow.');
      // what Bo knows about them and the class, so the picture fits (api/students.php)
      $cid = is_string($in['cid'] ?? null) && preg_match('/^[a-z0-9][a-z0-9_-]{0,40}$/', $in['cid']) ? $in['cid'] : '';
      $who = ''; try { require_once __DIR__ . '/students.php'; $who = mh_student_image_context($u, $cid, $cfg); } catch (Throwable $e) {}
      $full = 'For a university student\'s study board on StudyCat (Montana State University)' . ($who !== '' ? ": $who" : '') . ".\n" . MH_IMG_STYLE[$style] . ($ln !== '' ? "\nAny words or labels in the picture are in $ln; math notation stays as it is." : '') . "\n\nThe picture: " . $prompt;
      @set_time_limit(190); @ignore_user_abort(true);   // kept even if they leave: next time it is there
      [$code, $bin, $why] = mh_img_make($I, $I['model'], $full, $size);
      if ($code >= 400 && $code < 500 && $code !== 429 && $I['model'] !== 'gpt-image-1' && !preg_match('/safety|moderation|policy/i', $why)) { error_log('mathub image: ' . $I['model'] . ' refused (' . $code . ' ' . substr($why, 0, 120) . '), using gpt-image-1'); [$code, $bin, $why] = mh_img_make($I, 'gpt-image-1', $full, $size); }
      if ($code !== 200) {
        error_log('mathub image: ' . $code . ' ' . substr($why, 0, 200));
        if (preg_match('/safety|moderation|policy/i', $why)) mh_fail('That picture could not be made: it was turned down by the image model’s safety check. Bo can draw it as a diagram instead.', 422);
        mh_fail($code === 429 ? 'Bo’s pictures are very busy right now. Try again in a minute.' : 'That picture could not be made just now. Try again in a bit.', 502);
      }
      $tmp = $file . '.tmp' . bin2hex(random_bytes(4)); file_put_contents($tmp, $bin); @rename($tmp, $file);
      mh_credits_spend($u, 'image', $cost, '', 'Picture: ' . mb_substr($prompt, 0, 120), $cfg);
      try { if (function_exists('mh_student_note_image')) mh_student_note_image($u, $cid, $prompt); } catch (Throwable $e) {}
      mh_json(['ok' => true, 'url' => $url, 'id' => $key]);
    }
    case 'ai_image_file': {
      mh_method('GET'); mh_require_user();
      $id = preg_replace('/[^a-f0-9]/', '', (string)($_GET['id'] ?? '')); $f = mh_img_dir() . "/$id.webp";
      if (strlen($id) !== 64 || !is_file($f)) mh_fail('That picture is gone.', 404);
      header('Content-Type: image/webp'); header('Cache-Control: private, max-age=31536000, immutable'); header('X-Content-Type-Options: nosniff'); header('Content-Length: ' . filesize($f));
      readfile($f); exit;
    }
  }
  mh_fail('Not found.', 404);
}
