<?php
// Router for PHP's built-in web server, with the same clean addresses as the .htaccess on Hostinger:
//   php -S localhost:8080 -t dist scripts/router.php
// /about serves about.html; /about.html and /about/ redirect to /about; folders get their slash
// (/tours → /tours/); old addresses redirect; .php files (send.php, the admin panel, api/) run;
// unknown addresses get the 404 page. Works on PHP 7.4 and later.

$root = rtrim(str_replace('\\', '/', (string) $_SERVER['DOCUMENT_ROOT']), '/');
$uri = (string) $_SERVER['REQUEST_URI'];
$q = strpos($uri, '?');
$query = $q === false ? '' : substr($uri, $q);
$path = rawurldecode($q === false ? $uri : substr($uri, 0, $q));
if ($path === '' || $path[0] !== '/') {
    $path = '/' . $path;
}

function mfs_redirect($to, $query)
{
    $parts = array_map('rawurlencode', explode('/', $to));
    header('Location: ' . implode('/', $parts) . $query, true, 301);
    exit;
}

// The 404 page, in the language of the address (/ru/… gets ru/404.html) when there is one.
function mfs_not_found($root)
{
    global $path;
    $page = $root . '/404.html';
    if (preg_match('#^/(ru|ka|es|fr|it|pt|de|zh)/#', (string) $path, $m) && is_file($root . '/' . $m[1] . '/404.html')) {
        $page = $root . '/' . $m[1] . '/404.html';
    }
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    readfile($page);
    exit;
}

function mfs_page($file)
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

if (strpos($path, "\0") !== false || preg_match('#(^|/)\.\.(/|$)#', $path)) {
    mfs_not_found($root);
}

// Doubled slashes and "/./" go to the plain address (like the .htaccess), so the checks below always see
// the address as it really is (/admin//lib/… is /admin/lib/…).
if (preg_match('#//|/\.(/|$)#', $path)) {
    $clean = preg_replace('#/(\./)+#', '/', preg_replace('#/+#', '/', $path));
    $clean = preg_replace('#/\.$#', '/', $clean);
    if (in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', array('GET', 'HEAD'), true)) {
        mfs_redirect($clean, $query);
    }
    mfs_not_found($root);
}

// Never served: hidden files (except .well-known), databases, logs, settings, the admin panel's code and data
// (the same files the .htaccess files close).
if (preg_match('#/\.(?!well-known(/|$))#', $path)
    || preg_match('#\.(sqlite[^/]*|db|log|ini|lock)$#i', $path)
    || preg_match('#(^|/)(error_log|php_errorlog)$#i', $path)
    || preg_match('#^/admin/(lib|data|modules)(/|$)#i', $path)
    || preg_match('#^/admin/(.*/)?([^/]+\.(bak|md|sh|inc)|config\.local\.php)$#i', $path)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Forbidden\n";
    exit;
}

$file = $root . $path;

// Folders always end in a slash (relative links depend on it), the admin panel included.
if (is_dir($file) && substr($path, -1) !== '/') {
    mfs_redirect($path . '/', $query);
}

// No settings from the admin panel yet: "no changes" rather than a 404 (see .htaccess).
if ($path === '/api/live.json' && !is_file($file)) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache');
    readfile($root . '/assets/live-none.json');
    exit;
}

// The admin panel and the visit counter look after themselves.
if (preg_match('#^/(admin|api)(/|$)#', $path)) {
    if (is_file($file) || is_dir($file)) {
        return false;
    }
    mfs_not_found($root);
}

// Pages from earlier versions of the site.
$legacy = array(
    '#^((?:/[a-z]{2})?/)tours\.html$#' => '$1tours/',
    '#^((?:/[a-z]{2})?/)travel-guide(?:\.html)?/?$#' => '$1guide/',
    '#^((?:/[a-z]{2})?/)plan(?:\.html)?/?$#' => '$1guide/',
    '#^((?:/[a-z]{2})?/)history(?:\.html)?/?$#' => '$1discover-georgia',
    '#^((?:/[a-z]{2})?/)destinations(?:\.html)?/?$#' => '$1',
);
foreach ($legacy as $re => $to) {
    if (preg_match($re, $path)) {
        mfs_redirect(preg_replace($re, $to, $path), $query);
    }
}

// Asked for a file name: redirect to the clean address (/index.html → /, /about.html → /about).
if (preg_match('#^(.*/)index(?:\.html)?/?$#', $path, $m)) {
    if (is_file($root . $m[1] . 'index.html')) {
        mfs_redirect($m[1], $query);
    }
    // /about/index.html → /about in one step
    if (strlen($m[1]) > 1 && !is_dir($root . $m[1]) && is_file($root . rtrim($m[1], '/') . '.html')) {
        mfs_redirect(rtrim($m[1], '/'), $query);
    }
}
if (substr($path, -5) === '.html' && basename($path) !== '404.html' && is_file($file)) {
    mfs_redirect(substr($path, 0, -5), $query);
}
// /about/ → /about
if (strlen($path) > 1 && substr($path, -1) === '/' && !is_dir($file) && is_file(rtrim($file, '/') . '.html')) {
    mfs_redirect(rtrim($path, '/'), $query);
}

if (is_dir($file)) {
    if (is_file($file . 'index.html')) {
        mfs_page($file . 'index.html');
    }
    if (is_file($file . 'index.php')) {
        return false;
    }
    mfs_not_found($root);
}
if (is_file($file)) {
    return false; // a static file or a .php script: the built-in server handles it
}
if (substr($path, -1) !== '/' && basename($path) !== '404' && is_file($file . '.html')) {
    mfs_page($file . '.html');
}
mfs_not_found($root);
