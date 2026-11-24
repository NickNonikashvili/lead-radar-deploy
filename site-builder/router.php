<?php
// Preview the built site with PHP's own server, clean addresses and a working chat and quote form:
//   cd evosoft-site && php -S 127.0.0.1:8000 ../site-builder/router.php      then open http://127.0.0.1:8000/home
// It follows the same rules as the .htaccess files on the host (see site-builder/serve.mjs for the details): only
// api/chat.php and api/quote.php are public, and .htaccess files are never served.
// © 2026 EvoSoft Solutions. All rights reserved.
$root = realpath(__DIR__ . '/../evosoft-site');
// the path and query as sent: '//services.html' is a path here, never a host
[$rawPath, $q] = array_pad(explode('?', explode('#', $_SERVER['REQUEST_URI'], 2)[0], 2), 2, '');
$qs = $q !== '' ? '?' . $q : '';
$p = preg_replace('#[/\\\\]+#', '/', '/' . rawurldecode($rawPath)); // one slash at a time: no redirect to another host
$p = preg_replace(['#/(?:\./)+#', '#/\.$#'], '/', $p);                 // and no '.' segments, so /./api/ is /api/
if (str_contains($p, "\0") || in_array('..', explode('/', $p), true)) { $p = '/404'; }
$lang = null;
foreach (['ka', 'ru', 'es'] as $l) if ($p === "/$l" || str_starts_with($p, "/$l/")) $lang = $l;
$pre = $lang ? "/$lang/" : '/';
$rest = (string)substr($p, strlen($pre));
$go = function ($to) use ($qs) {
    header('Location: ' . implode('/', array_map('rawurlencode', explode('/', $to))) . $qs, true, 301);
    return true;
};
$isFile = fn($rel) => is_file($root . $rel);
$send = function ($code, $rel = null) use ($root, $pre) {
    if ($code === 404) $rel = "{$pre}404.html";
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    readfile($root . $rel);
    return true;
};

if ($lang && $p === "/$lang") return $go("/$lang/home");
if (preg_match('#(^|/)index\.html$#', $rest)) return $go($pre . preg_replace('#index\.html$#', 'home', $rest));
if (preg_match('#^pricing(\.html|/)?$#', $rest)) return $go($pre . 'contact');
if (str_ends_with($rest, '.html') && $isFile($pre . $rest)) return $go($pre . substr($rest, 0, -5));
if ($rest === '') return $go($pre . 'home');
if (preg_match('#^work/?$#', $rest)) return $go($pre . 'portfolio');
if (str_ends_with($rest, '/') && !is_dir($root . $pre . $rest)) return $go($pre . rtrim($rest, '/'));
if ($rest === '404') return $send(404);
if ($rest === 'index') return $go($pre . 'home');
if ($rest === 'home') return $send(200, $pre . 'index.html');
if (str_starts_with(basename($rest), '.ht')) return $send(404);
if (!$lang && str_starts_with($rest, 'api/') && !in_array($rest, ['api/chat.php', 'api/quote.php'], true)) return $send(404);
if ($isFile($pre . $rest)) return false;                       // assets, and api/chat.php and api/quote.php run as PHP
if (!str_contains($rest, '.') && $isFile($pre . $rest . '.html')) return $send(200, $pre . $rest . '.html');
return $send(404);
