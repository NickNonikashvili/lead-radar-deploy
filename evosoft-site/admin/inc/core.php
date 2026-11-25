<?php
/*
 * EvoSoft admin panel: the shared core (headers, links, CSRF, layout, small helpers).
 * © 2026 EvoSoft Solutions. All rights reserved.
 *
 * Only admin/index.php includes the files in admin/inc/; the web server refuses them (admin/.htaccess,
 * site-builder/router.php). Everything is English: the panel is for the owner only.
 *
 * INTERNAL API, for the panel's own screens and for add-ons such as inc/finder.php
 * --------------------------------------------------------------------------------
 *   admin_h(string $s): string
 *       Escapes text for HTML, attributes included. Use it for every value you print, and for admin_url() in an href.
 *   admin_url(array $query = []): string
 *       A link inside the panel: admin_url(['view' => 'finder', 'page' => 2]) gives '/admin/?view=finder&page=2'.
 *       Empty values are left out. Put it through admin_h() inside HTML.
 *   admin_csrf_field(): string
 *       The hidden CSRF input. Put it in every <form method="post">. Scripts (fetch) can send the same token in an
 *       X-CSRF-Token header instead; the page carries it in <meta name="evo-csrf" content="...">.
 *   admin_require_post_csrf(): void
 *       Stops the request with 403 unless it is a POST from the panel's own pages (Sec-Fetch-Site / Origin / Referer)
 *       with the session's CSRF token. index.php calls it before every signed-in POST, finder actions included.
 *   admin_layout(string $title, string $bodyHtml, string $active): void
 *       Prints a whole page around $bodyHtml: head, header, navigation (marks $active: 'requests', 'finder' or
 *       'security'), any one-time message, footer. $bodyHtml goes inside <main> as it is, so escape what it holds.
 *   admin_json(array $data, int $code = 200): never
 *       Sends JSON with the panel's security headers, and stops.
 *   admin_redirect(array $query = [], string $flash = '', string $kind = 'ok'): never
 *       "303 See Other" to admin_url($query), with an optional one-time message ('ok' or 'error') on the next page.
 *       Use it after every POST that changes something, so a reload doesn't send it twice.
 *   admin_fail(int $code, string $title, string $message): never
 *       An error page (or JSON {"error": ...} when the request asked for JSON), and stops.
 *   admin_add_asset(string $type, string $url): void
 *       Adds a stylesheet ('css') or a deferred script ('js', loaded before assets/admin.js) to the next
 *       admin_layout(). Only same-site addresses: the Content-Security-Policy allows nothing else.
 *
 * ROUTING HOOKS for the client finder (inc/finder.php is optional: index.php includes it only if it exists)
 *   GET  ?view=finder&...         ->  finder_view(array $query): string
 *        Returns the body HTML only; index.php prints it with admin_layout('Client finder', $html, 'finder').
 *        $query is $_GET. Must not change anything (GET never changes state here).
 *   POST ?action=finder.<name>    ->  finder_action(string $name, array $post): never
 *        Called only when the owner is signed in and admin_require_post_csrf() has passed; <name> matches
 *        [a-z0-9_-]{1,40}, $post is $_POST. It must end the request itself: admin_redirect() for forms,
 *        admin_json() for scripts.
 *   Data: keep files in evo_data_dir() (api/lib.php), which is outside public_html; never in admin/.
 *   Pages: no inline <script> code and no style="" attributes (the CSP refuses them): scripts go in
 *   admin/assets/*.js, styles in admin/assets/admin.css. A <script type="application/json"> data block is fine.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

const ADMIN_COOKIE = 'evo_admin';           // the session cookie (path /admin/, HttpOnly, SameSite=Strict)
const ADMIN_PRE_COOKIE = 'evo_admin_pre';   // binds the sign-in form to the browser before there is a session
const ADMIN_DEVICE_COOKIE = 'evo_admin_dev'; // a browser the owner signed in from: its own sign-in allowance (auth.php)
const ADMIN_DEVICE_DAYS = 90;
const ADMIN_MAX_SECONDS = 43200;            // every session ends 12 hours after sign-in

function admin_h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
}

/** The panel's own address, e.g. '/admin/' (from where index.php runs). */
function admin_base(): string
{
    static $base = null;
    if ($base === null) {
        $dir = str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/admin/index.php')));
        $base = rtrim($dir, '/') . '/';
        if (!preg_match('#^/[A-Za-z0-9._/-]*$#', $base)) {
            $base = '/admin/';
        }
    }
    return $base;
}

/** The website's address, e.g. '/' (the folder above the panel). */
function admin_site_base(): string
{
    return rtrim(str_replace('\\', '/', dirname(rtrim(admin_base(), '/'))), '/') . '/';
}

function admin_url(array $query = []): string
{
    $query = array_filter($query, static fn($v): bool => $v !== null && $v !== '' && $v !== false);
    $qs = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    return admin_base() . ($qs !== '' ? '?' . $qs : '');
}

/** $url with ?v=<hash of the file>, so the year-long cache in .htaccess never serves an old copy; null if it's missing. */
function admin_asset_url(string $file, string $url): ?string
{
    return @is_file($file) ? $url . '?v=' . substr((string)md5_file($file), 0, 10) : null;
}

function admin_add_asset(string $type, string $url): void
{
    if (in_array($type, ['css', 'js'], true) && str_starts_with($url, '/') && !str_starts_with($url, '//')) {
        $GLOBALS['admin_assets'][$type][] = $url;
    }
}

function admin_is_https(): bool
{
    $https = strtolower((string)($_SERVER['HTTPS'] ?? ''));
    return ($https !== '' && $https !== 'off') || strtolower((string)($_SERVER['REQUEST_SCHEME'] ?? '')) === 'https'
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

/** This computer (php -S for testing): the only place plain http:// is allowed. */
function admin_is_local(): bool
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $host = strtolower((string)preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
    return in_array($ip, ['127.0.0.1', '::1'], true) && in_array($host, ['127.0.0.1', 'localhost', '[::1]'], true);
}

/** The headers every admin response carries. */
function admin_send_headers(): void
{
    if (headers_sent()) {
        return;
    }
    header_remove('X-Powered-By');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}

function admin_wants_json(): bool
{
    return str_contains(strtolower((string)($_SERVER['HTTP_ACCEPT'] ?? '')), 'application/json');
}

function admin_json(array $data, int $code = 200): never
{
    http_response_code($code);
    admin_send_headers();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function admin_redirect(array $query = [], string $flash = '', string $kind = 'ok'): never
{
    if ($flash !== '' && session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION['flash'] = [$kind === 'error' ? 'error' : 'ok', $flash];
    }
    http_response_code(303);
    admin_send_headers();
    header('Location: ' . admin_url($query));
    exit;
}

function admin_fail(int $code, string $title, string $message): never
{
    if (admin_wants_json()) {
        admin_json(['error' => $message], $code);
    }
    http_response_code($code);
    admin_layout($title, '<div class="page-head"><h1>' . admin_h($title) . '</h1></div><div class="card"><p>' . admin_h($message)
        . '</p><p><a href="' . admin_h(admin_url()) . '">Back to the requests</a></p></div>', '');
    exit;
}

/** The scheme and host this page was opened on, e.g. 'https://evosoft.solutions'. */
function admin_origin(): string
{
    return (admin_is_https() ? 'https' : 'http') . '://' . strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
}

/**
 * True when a POST clearly comes from the panel's own pages. The panel sends Referrer-Policy: no-referrer, so a
 * browser's own form posts usually carry "Origin: null" and no Referer; Sec-Fetch-Site (every current browser)
 * still says "same-origin". Any header that names another site fails; at least one must vouch for this one.
 */
function admin_same_origin(): bool
{
    $own = admin_origin();
    $ok = false;
    $site = strtolower((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($site !== '') {
        if ($site !== 'same-origin') {
            return false;
        }
        $ok = true;
    }
    $origin = strtolower(trim((string)($_SERVER['HTTP_ORIGIN'] ?? '')));
    if ($origin !== '' && $origin !== 'null') {
        if (rtrim($origin, '/') !== $own) {
            return false;
        }
        $ok = true;
    }
    $referer = strtolower(trim((string)($_SERVER['HTTP_REFERER'] ?? '')));
    if ($referer !== '') {
        if ($referer !== $own && !str_starts_with($referer, $own . '/')) {
            return false;
        }
        $ok = true;
    }
    return $ok;
}

function admin_csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return '';
    }
    if (!is_string($_SESSION['csrf'] ?? null) || strlen($_SESSION['csrf']) !== 64) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function admin_csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . admin_h(admin_csrf_token()) . '">';
}

function admin_require_post_csrf(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: GET, POST');
        admin_fail(405, 'Not allowed', 'This address only takes forms sent from the admin panel.');
    }
    if (!admin_same_origin()) {
        admin_fail(403, 'Not allowed', 'This form didn’t come from the admin panel, so nothing was changed.');
    }
    $sent = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $token = admin_csrf_token();
    if (!is_string($sent) || $token === '' || !hash_equals($token, $sent)) {
        admin_fail(403, 'Please try again', 'This form had expired (or came from somewhere else), so nothing was changed. Reload the page and try again.');
    }
}

/** The one-time message left by admin_redirect(), if any. */
function admin_take_flash(): ?array
{
    if (session_status() !== PHP_SESSION_ACTIVE || !is_array($_SESSION['flash'] ?? null)) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return [(string)($flash[0] ?? 'ok'), (string)($flash[1] ?? '')];
}

/** True once index.php has found a valid signed-in session (see admin_session_state() in auth.php). */
function admin_signed_in(): bool
{
    return ($GLOBALS['admin_signed_in'] ?? false) === true;
}

function admin_layout(string $title, string $bodyHtml, string $active): void
{
    admin_send_headers();
    if (!headers_sent()) {
        header('Content-Type: text/html; charset=utf-8');
    }
    $base = admin_base();
    $site = admin_site_base();
    $assets = dirname(__DIR__) . '/assets/';
    $head = '';
    $css = admin_asset_url($assets . 'admin.css', $base . 'assets/admin.css');
    if ($css !== null) {
        $head .= '<link rel="stylesheet" href="' . admin_h($css) . '">' . "\n";
    }
    foreach ($GLOBALS['admin_assets']['css'] ?? [] as $u) {
        $head .= '<link rel="stylesheet" href="' . admin_h($u) . '">' . "\n";
    }
    foreach ($GLOBALS['admin_assets']['js'] ?? [] as $u) {
        $head .= '<script src="' . admin_h($u) . '" defer></script>' . "\n";
    }
    $js = admin_asset_url($assets . 'admin.js', $base . 'assets/admin.js');
    if ($js !== null) {
        $head .= '<script src="' . admin_h($js) . '" defer></script>' . "\n";
    }
    $signed = admin_signed_in();
    if ($signed) {
        $head .= '<meta name="evo-csrf" content="' . admin_h(admin_csrf_token()) . '">' . "\n";
    }

    $nav = '';
    if ($signed) {
        $items = ['requests' => ['Requests', admin_url()], 'finder' => ['Client finder', admin_url(['view' => 'finder'])], 'security' => ['Security', admin_url(['view' => 'security'])]];
        $nav = '<nav class="nav" aria-label="Admin"><ul>';
        foreach ($items as $key => [$label, $href]) {
            $nav .= '<li><a href="' . admin_h($href) . '"' . ($key === $active ? ' aria-current="page"' : '') . '>' . admin_h($label) . '</a></li>';
        }
        $nav .= '</ul></nav>'
            . '<form class="signout" method="post" action="' . admin_h(admin_url(['action' => 'logout'])) . '">' . admin_csrf_field()
            . '<button class="btn on-dark" type="submit">Sign out</button></form>';
    }
    $flash = admin_take_flash();
    $flashHtml = '';
    if ($flash && $flash[1] !== '') {
        $flashHtml = '<div class="flash ' . ($flash[0] === 'error' ? 'flash-error' : 'flash-ok') . '" role="' . ($flash[0] === 'error' ? 'alert' : 'status') . '">'
            . admin_h($flash[1]) . '</div>';
    }
    $favicon = admin_h($site . 'favicon.ico');
    $logo = admin_h($site . 'assets/img/brand/logo-dark.svg');
    echo '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>' . admin_h($title) . ' · EvoSoft admin</title>
<link rel="icon" href="' . $favicon . '" sizes="any">
' . $head . '</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<header class="top">
<div class="top-in">
<a class="brand" href="' . admin_h(admin_url()) . '"><img src="' . $logo . '" alt="EvoSoft" width="112" height="24"><span class="brand-tag">Admin</span></a>
' . $nav . '
</div>
</header>
<main id="main" class="wrap" tabindex="-1">
' . $flashHtml . $bodyHtml . '
</main>
<footer class="foot wrap"><p>© 2026 EvoSoft Solutions. For the owner only: these pages are never cached or indexed.</p></footer>
</body>
</html>
';
}
