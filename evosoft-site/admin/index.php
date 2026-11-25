<?php
/*
 * EvoSoft admin panel (/admin/): every quote request, its status and notes, CSV export, and the client finder.
 * For the owner only. Front controller: every page and every form goes through this file; admin/.htaccess lets
 * nothing else in this folder be fetched except assets/*.css and assets/*.js.
 *
 *   GET  /admin/                       requests (filters: ?status= &source= &q= &page=)
 *   GET  /admin/?r=<id>                one request
 *   GET  /admin/?view=export&...       the filtered requests as CSV
 *   GET  /admin/?view=finder&...       the client finder (inc/finder.php, when it exists)
 *   GET  /admin/?view=security         how sign-in works, and tools to change the password or add a code app
 *   POST /admin/?action=login | logout | save&r=<id> | delete&r=<id> | tool.password | tool.totp | tool.check
 *        | finder.<name>
 * Nothing changes on a GET. Every POST is checked for its origin and CSRF token (inc/core.php).
 * Settings (api/config.example.php): admin_password_hash, admin_totp_secret, admin_session_minutes.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

const EVO_ADMIN = true;
ini_set('display_errors', '0'); // errors go to the server's log, never onto the page

require dirname(__DIR__) . '/api/lib.php';
require __DIR__ . '/inc/core.php';
require __DIR__ . '/inc/auth.php';
require __DIR__ . '/inc/setup.php';
require __DIR__ . '/inc/requests.php';

admin_send_headers();
$cfg = evo_config();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'HEAD', 'POST'], true)) {
    header('Allow: GET, POST');
    admin_fail(405, 'Not allowed', 'This address only takes GET and POST.');
}
$action = is_string($_GET['action'] ?? null) ? $_GET['action'] : '';
if ($method !== 'POST' && $action !== '') {
    admin_fail(405, 'Not allowed', 'Actions only run from the panel’s own forms.');
}

// A password must never travel in the clear: plain http:// only works on this computer (php -S, for testing).
if (!admin_is_https() && !admin_is_local() && ($cfg['admin_require_https'] ?? true) !== false) {
    $host = preg_replace('/[^A-Za-z0-9.:\-\[\]]/', '', (string)($_SERVER['HTTP_HOST'] ?? '')) ?: 'evosoft.solutions';
    $https = 'https://' . $host . admin_base();
    if ($method !== 'POST') {
        http_response_code(403);
        admin_layout('Use https', '<div class="page-head"><h1>Please use the secure address</h1><p>The admin panel only opens over https, so your password is never sent in the clear.</p>'
            . '<p><a class="btn primary" href="' . admin_h($https) . '">Open ' . admin_h($https) . '</a></p></div>', '');
        exit;
    }
    admin_fail(403, 'Use https', 'The admin panel only takes forms sent over https. Nothing was changed.');
}

// Not set up yet (or the line is broken): only the setup page, which saves nothing and signs nobody in.
$hashState = admin_hash_state($cfg);
if ($hashState !== 'ok') {
    $result = [];
    if ($method === 'POST') {
        if (!in_array($action, ['tool.password', 'tool.totp', 'tool.check'], true)) {
            admin_setup_page($cfg, $hashState, [], 404);
        }
        if (!admin_same_origin()) {
            admin_fail(403, 'Not allowed', 'This form didn’t come from the admin panel, so it was ignored.');
        }
        if (!evo_rate_ok('admin-setup', admin_ip_bucket(evo_client_ip()), 20, 900)) {
            admin_fail(429, 'Please wait', 'Too many tries. Please wait 15 minutes, then try again.');
        }
        $result = admin_tool_run($action);
    }
    admin_setup_page($cfg, $hashState, $result, ($result['errors'] ?? []) !== [] ? 422 : 200);
}
if (admin_totp_key($cfg) === null) {
    http_response_code(503);
    admin_layout('Settings problem', '<div class="page-head"><h1>The panel is locked</h1><p><code>admin_totp_secret</code> is set in the settings file, but it isn’t a valid base32 key, so nobody can sign in.'
        . ' Fix the line (or delete it to turn two-step sign-in off).</p></div>', '');
    exit;
}

// Signed in?
$state = admin_session_state($cfg);
if ($state !== 'in') {
    if ($method === 'POST' && $action === 'login') {
        admin_handle_login($cfg); // signs in and redirects, or shows the form again
    }
    $next = admin_clean_id($_GET['r'] ?? '');
    if ($method === 'POST') {
        admin_login_page($cfg, $state === 'expired' ? 'You were signed out after a while without using the panel, so that wasn’t saved. Please sign in again.'
            : 'Please sign in first. Nothing was changed.', 401, $next);
    }
    // A link from another site (the "Open it in the admin panel" button in webmail) never carries the SameSite=Strict
    // cookie, so a signed-in owner would see the sign-in form. Reload once from this page itself: that navigation is
    // same-origin, so the browser sends the cookie. GET only, and nothing here changes anything.
    if ($state === 'out' && !isset($_COOKIE[ADMIN_COOKIE]) && admin_cross_site_navigation()) {
        admin_bounce_page($next !== '' ? ['r' => $next] : []);
    }
    $note = $state === 'expired' ? 'You were signed out after a while without using the panel. Please sign in again.'
        : (isset($_GET['bye']) ? 'You’re signed out.' : '');
    admin_login_page($cfg, '', 200, $next, $note);
}
$GLOBALS['admin_signed_in'] = true;
evo_housekeeping($cfg); // the same clean-up the forms run, at most once an hour

if ($method === 'POST') {
    admin_require_post_csrf();
    $id = admin_clean_id($_GET['r'] ?? '');
    if ($action === 'login') {
        admin_redirect();
    }
    if ($action === 'logout') {
        admin_logout();
    }
    if ($action === 'save') {
        req_save($id);
    }
    if ($action === 'delete') {
        req_delete($id);
    }
    if (in_array($action, ['tool.password', 'tool.totp', 'tool.check'], true)) {
        $result = admin_tool_run($action);
        http_response_code($result['errors'] ? 422 : 200);
        admin_layout('Security', admin_security_view($cfg, $result), 'security');
        exit;
    }
    if (preg_match('/^finder\.([a-z0-9_-]{1,40})$/', $action, $m) && is_file(__DIR__ . '/inc/finder.php')) {
        require_once __DIR__ . '/inc/finder.php';
        if (function_exists('finder_action')) {
            finder_action($m[1], $_POST);
        }
    }
    admin_fail(404, 'Not found', 'There is no such action.');
}

if (isset($_GET['r'])) {
    $id = admin_clean_id($_GET['r']);
    $q = $id !== '' ? evo_quote_find($id) : null;
    if ($q === null) {
        admin_fail(404, 'Not found', 'There is no request with that address. It may have been deleted.');
    }
    $q['meta'] = evo_quote_meta(evo_quote_meta_all(), $id);
    // the live preview, drawn by the public site's own script and styles (when the build has made them)
    // (both or neither: the script without its styles would draw a mess, so admin.js then says it's unavailable)
    $site = dirname(__DIR__);
    $css = admin_asset_url($site . '/assets/css/preview.css', admin_site_base() . 'assets/css/preview.css');
    $js = admin_asset_url($site . '/assets/js/site-preview.js', admin_site_base() . 'assets/js/site-preview.js');
    if ($css !== null && $js !== null) {
        admin_add_asset('css', $css);
        admin_add_asset('js', $js);
    }
    admin_layout($q['name'] !== '' ? $q['name'] : 'Request', req_detail_view($q), 'requests');
    exit;
}

$view = is_string($_GET['view'] ?? null) ? $_GET['view'] : '';
switch ($view) {
    case '':
    case 'requests':
        admin_layout('Requests', req_list_view($_GET), 'requests');
        exit;
    case 'export':
        req_export($_GET);
    case 'security':
        admin_layout('Security', admin_security_view($cfg), 'security');
        exit;
    case 'finder':
        if (is_file(__DIR__ . '/inc/finder.php')) {
            require_once __DIR__ . '/inc/finder.php';
        }
        if (function_exists('finder_view')) {
            admin_layout('Client finder', finder_view($_GET), 'finder');
        } else {
            admin_layout('Client finder', '<div class="page-head"><h1>Client finder</h1><p>Coming soon: a search for businesses that need a website, with the results listed here.</p></div>', 'finder');
        }
        exit;
    default:
        admin_fail(404, 'Not found', 'There is no such page in the admin panel.');
}
