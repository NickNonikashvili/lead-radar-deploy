<?php
/*
 * Page rendering: render() wraps a module's HTML in the admin layout (sidebar, top bar, page header, flashes).
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

/** URL of a file in admin/assets/ with a cache-busting version: asset('admin.css') → 'assets/admin.css?v=…'. */
function asset(string $file): string
{
  $file = basename($file);
  $path = MFS_ADMIN_DIR . '/assets/' . $file;
  $v = @filemtime($path);
  return 'assets/' . rawurlencode($file) . ($v ? '?v=' . $v : '');
}

/** The sidebar: key => [label, icon, page, owner only]. */
function mfs_nav_items(): array
{
  return [
    'dashboard' => ['Dashboard', 'dashboard', 'dashboard', false],
    'requests' => ['Requests', 'inbox', 'requests', false],
    'bookings' => ['Bookings', 'suitcase', 'bookings', false],
    'calendar' => ['Calendar', 'calendar', 'calendar', false],
    'analytics' => ['Statistics', 'chart', 'analytics', false],
    'tours' => ['Tours & prices', 'tag', 'tours', true],
    'settings' => ['Settings', 'settings', 'settings', true],
    'users' => ['Team', 'users', 'users', true],
  ];
}

/** Number of requests waiting with status "new" (for the sidebar badge). */
function mfs_new_request_count(): int
{
  try {
    return (int) db_value("SELECT COUNT(*) FROM requests WHERE status = 'new'");
  } catch (Throwable $e) {
    return 0;
  }
}

/** The brand block (footprint logo in its cream badge + name). */
function mfs_brand_html(string $tag = ''): string
{
  return '<span class="brand__badge"><img src="../assets/img/favicon.svg" alt="" width="20" height="32"></span>'
    . '<span class="brand__text"><span class="brand__name">Million First Steps</span>'
    . '<span class="brand__tag">' . h($tag !== '' ? $tag : t('Team area')) . '</span></span>';
}

function mfs_flashes_html(): string
{
  $out = '';
  foreach (mfs_take_flashes() as $f) {
    $type = $f[0];
    $ico = $type === 'ok' ? 'check' : ($type === 'error' ? 'alert' : 'info');
    $out .= '<div class="flash flash--' . h($type) . '" role="' . ($type === 'error' ? 'alert' : 'status') . '">'
      . '<span class="flash__icon">' . icon($ico) . '</span><p class="flash__text">' . h($f[1]) . '</p>'
      . '<button type="button" class="flash__close" data-dismiss aria-label="' . h(t('Close')) . '">' . icon('close') . '</button></div>';
  }
  return $out ? '<div class="flashes">' . $out . '</div>' : '';
}

/**
 * Prints a whole page and stops. $bodyHtml is your module's HTML (already escaped!).
 * $opts:
 *   'nav'     => active sidebar key (dashboard|requests|bookings|calendar|analytics|tours|settings|users|account)
 *   'css'     => ['requests.css']   extra files from admin/assets/
 *   'js'      => ['requests.js']    extra files from admin/assets/ (loaded with defer, after admin.js)
 *   'actions' => HTML for the right side of the page header (buttons)
 *   'crumbs'  => [[label, url], …]  breadcrumb trail above the title (last one may have url '')
 *   'lead'    => plain text under the title
 *   'status'  => HTTP status code (e.g. 404)
 *   'width'   => 'narrow' (forms, ~760px) | 'wide' (default, full width)
 *   'layout'  => 'app' (default when signed in) | 'auth' (centred card: login, setup …)
 *   'head'    => false to leave out the page header (title still used for <title>)
 *   'body_class' => extra class on <body>
 */
function render(string $title, string $bodyHtml, array $opts = [])
{
  if (!empty($opts['status'])) http_response_code((int) $opts['status']);
  if (!headers_sent()) header('Content-Type: text/html; charset=utf-8');
  $user = current_user();
  $layout = $opts['layout'] ?? ($user ? 'app' : 'auth');
  if ($layout === 'app' && !$user) $layout = 'auth';
  $lang = mfs_lang();

  $css = '<link rel="stylesheet" href="' . h(asset('admin.css')) . '">';
  foreach ((array) ($opts['css'] ?? []) as $f) if (preg_match('/^[a-z0-9_-]+\.css$/', (string) $f)) $css .= '<link rel="stylesheet" href="' . h(asset($f)) . '">';
  $js = '<script src="' . h(asset('admin.js')) . '" defer></script>';
  foreach ((array) ($opts['js'] ?? []) as $f) if (preg_match('/^[a-z0-9_-]+\.js$/', (string) $f)) $js .= '<script src="' . h(asset($f)) . '" defer></script>';

  $html = '<!doctype html><html lang="' . h($lang) . '"><head><meta charset="utf-8">'
    . '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    . '<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="same-origin">'
    . '<meta name="theme-color" content="#2B2320">'
    . '<title>' . h($title) . ' · ' . h(t('Million First Steps team area')) . '</title>'
    . '<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">'
    . '<link rel="apple-touch-icon" href="../assets/img/apple-touch-icon.png">'
    . $css . $js . '</head>';

  $bodyClass = 'adm adm--' . $layout . (isset($opts['body_class']) ? ' ' . preg_replace('/[^a-z0-9 _-]/', '', (string) $opts['body_class']) : '');
  if ($layout === 'auth') {
    $html .= '<body class="' . h($bodyClass) . '"><main class="auth" id="main"><div class="auth__inner">'
      . '<a class="brand brand--auth" href="' . h(url('login')) . '">' . mfs_brand_html() . '</a>'
      . '<section class="auth__card" aria-labelledby="page-title"><h1 class="auth__title" id="page-title">' . h($title) . '</h1>'
      . (!empty($opts['lead']) ? '<p class="auth__lead">' . h($opts['lead']) . '</p>' : '')
      . mfs_flashes_html() . $bodyHtml . '</section>'
      . '<footer class="auth__foot">' . mfs_lang_switch() . '<a class="auth__site" href="../">' . h(t('View website')) . ' ' . icon('external') . '</a></footer>'
      . '</div></main></body></html>';
    echo $html;
    exit;
  }

  $active = (string) ($opts['nav'] ?? '');
  $html .= '<body class="' . h($bodyClass) . '"><a class="skip" href="#main">' . h(t('Skip to content')) . '</a><div class="shell">'
    . mfs_sidebar_html($user, $active)
    . '<div class="backdrop" data-menu-close hidden></div>'
    . '<div class="main">' . mfs_topbar_html($user, $opts)
    . '<main class="content' . (($opts['width'] ?? '') === 'narrow' ? ' content--narrow' : '') . '" id="main" tabindex="-1">';
  if (($opts['head'] ?? true) !== false) {
    $html .= '<header class="page-head"><div class="page-head__text">';
    if (!empty($opts['crumbs']) && is_array($opts['crumbs'])) {
      $c = [];
      foreach ($opts['crumbs'] as $cr) {
        $label = (string) ($cr[0] ?? '');
        $href = (string) ($cr[1] ?? '');
        $c[] = $href !== '' ? '<li><a href="' . h($href) . '">' . h($label) . '</a></li>' : '<li><span aria-current="page">' . h($label) . '</span></li>';
      }
      $html .= '<nav class="crumbs" aria-label="' . h(t('You are here')) . '"><ol>' . implode('', $c) . '</ol></nav>';
    }
    $html .= '<h1 class="page-head__title">' . h($title) . '</h1>'
      . (!empty($opts['lead']) ? '<p class="page-head__lead">' . h($opts['lead']) . '</p>' : '')
      . '</div>' . (!empty($opts['actions']) ? '<div class="page-head__actions">' . $opts['actions'] . '</div>' : '') . '</header>';
  }
  $html .= mfs_flashes_html() . $bodyHtml . '</main>'
    . '<footer class="foot"><span>' . h(t('Million First Steps team area')) . '</span><a href="../" target="_blank" rel="noopener">' . h(t('View website')) . ' ' . icon('external') . '</a></footer>'
    . '</div></div></body></html>';
  echo $html;
  exit;
}

function mfs_sidebar_html(array $user, string $active): string
{
  $owner = $user['role'] === 'owner';
  $new = mfs_new_request_count();
  $items = '';
  $manage = '';
  foreach (mfs_nav_items() as $key => $it) {
    list($label, $ico, $page, $ownerOnly) = $it;
    if ($ownerOnly && !$owner) continue;
    $isActive = $active === $key;
    $badge = ($key === 'requests' && $new > 0)
      ? '<span class="nav__badge" title="' . h(tp($new, '{n} new request', '{n} new requests')) . '">' . ($new > 99 ? '99+' : $new) . '<span class="sr-only"> ' . h(t('new')) . '</span></span>'
      : '';
    $a = '<a class="nav__item' . ($isActive ? ' is-active' : '') . '" href="' . h(url($page)) . '"' . ($isActive ? ' aria-current="page"' : '') . '>'
      . '<span class="nav__icon">' . icon($ico) . '</span><span class="nav__label">' . h(t($label)) . '</span>' . $badge . '</a>';
    if ($ownerOnly) $manage .= $a; else $items .= $a;
  }
  $acc = $active === 'account';
  return '<aside class="side" id="side" aria-label="' . h(t('Menu')) . '">'
    . '<div class="side__top"><a class="brand" href="' . h(url('dashboard')) . '">' . mfs_brand_html() . '</a>'
    . '<button type="button" class="side__close" data-menu-close aria-label="' . h(t('Close menu')) . '">' . icon('close') . '</button></div>'
    . '<nav class="nav" aria-label="' . h(t('Team area')) . '">' . $items
    . ($manage !== '' ? '<p class="nav__group">' . h(t('Manage')) . '</p>' . $manage : '') . '</nav>'
    . '<div class="side__foot">'
    . '<div class="side__user">'
    . '<span class="avatar" aria-hidden="true">' . h(initials($user['name'])) . '</span>'
    . '<span class="side__who"><span class="side__name">' . h($user['name']) . '</span><span class="side__role">' . h(t(USER_ROLES[$user['role']] ?? $user['role'])) . '</span></span></div>'
    . '<a class="nav__item nav__item--sm' . ($acc ? ' is-active' : '') . '" href="' . h(url('account')) . '"' . ($acc ? ' aria-current="page"' : '') . '><span class="nav__icon">' . icon('user') . '</span><span class="nav__label">' . h(t('My account')) . '</span></a>'
    . '<form method="post" action="' . h(url('logout')) . '" class="nav__form">' . csrf_field()
    . '<button type="submit" class="nav__item nav__item--sm"><span class="nav__icon">' . icon('logout') . '</span><span class="nav__label">' . h(t('Sign out')) . '</span></button></form>'
    . '<a class="nav__item nav__item--sm" href="../" target="_blank" rel="noopener"><span class="nav__icon">' . icon('external') . '</span><span class="nav__label">' . h(t('View website')) . '</span><span class="sr-only"> ' . h(t('(opens in a new tab)')) . '</span></a>'
    . '</div></aside>';
}

function mfs_topbar_html(array $user, array $opts): string
{
  $new = mfs_new_request_count();
  $q = (string) ($opts['search'] ?? (get('p') === 'requests' ? get('q') : ''));
  return '<header class="topbar">'
    . '<button type="button" class="topbar__menu" data-menu-toggle aria-controls="side" aria-expanded="false">' . icon('menu') . '<span class="sr-only">' . h(t('Menu')) . '</span></button>'
    . '<a class="topbar__brand" href="' . h(url('dashboard')) . '"><span class="brand__badge brand__badge--sm"><img src="../assets/img/favicon.svg" alt="" width="14" height="22"></span><span>Million First Steps</span></a>'
    . '<form class="topbar__search" method="get" action="index.php" role="search"><input type="hidden" name="p" value="requests">'
    . '<label class="sr-only" for="top-q">' . h(t('Search requests')) . '</label>'
    . '<span class="topbar__search-icon">' . icon('search') . '</span>'
    . '<input class="input" type="search" id="top-q" name="q" value="' . h($q) . '" placeholder="' . h(t('Search requests: name, email, phone, ref…')) . '" autocomplete="off"></form>'
    . '<span class="topbar__date">' . h(fmt_date(local_today())) . '</span>'
    . '<a class="topbar__inbox" href="' . h(url('requests', ['status' => 'new'])) . '" aria-label="' . h(tp($new, '{n} new request', '{n} new requests')) . '">' . icon('inbox')
    . ($new > 0 ? '<span class="topbar__count">' . ($new > 99 ? '99+' : $new) . '</span>' : '') . '</a>'
    . '</header>';
}

/** "English · ქართული" links for the sign-in pages (keeps the current page). */
function mfs_lang_switch(): string
{
  $cur = mfs_lang();
  $out = [];
  foreach (UI_LANGS as $code => $name) {
    $q = $_GET;
    unset($q['_b']);
    $q['lang'] = $code;
    if (!isset($q['p'])) $q['p'] = 'login';
    $href = 'index.php?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986);
    $out[] = $code === $cur
      ? '<span class="lang-switch__item is-current" lang="' . h($code) . '" aria-current="true">' . h($name) . '</span>'
      : '<a class="lang-switch__item" lang="' . h($code) . '" href="' . h($href) . '">' . h($name) . '</a>';
  }
  return '<nav class="lang-switch" aria-label="' . h(t('Language')) . '">' . implode('', $out) . '</nav>';
}

/** A calm error page (with the full layout when signed in) and stop. */
function render_error(int $status, string $title, string $message, string $extraHtml = '')
{
  $user = current_user();
  $back = $user
    ? '<a class="btn btn--primary" href="' . h(url('dashboard')) . '">' . icon('dashboard') . h(t('Go to the dashboard')) . '</a>'
    : '<a class="btn btn--primary" href="' . h(url('login')) . '">' . h(t('Go to sign in')) . '</a>';
  $body = '<div class="' . ($user ? 'card ' : '') . 'empty empty--page"><div class="empty__mark" aria-hidden="true">' . icon($status === 403 ? 'lock' : ($status === 404 ? 'map-pin' : 'info')) . '</div>'
    . ($user ? '<h2 class="empty__title">' . h($title) . '</h2>' : '')
    . '<p class="empty__text">' . h($message) . '</p>' . $extraHtml . '<div class="btn-row btn-row--center">' . $back . '</div></div>';
  render($title, $body, ['status' => $status, 'head' => false]);
}

/** A page that works without the database (data folder missing, SQLite off). */
function mfs_fatal_page(int $status, string $title, string $message, string $detail = '')
{
  if (!headers_sent()) {
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
  }
  $css = @is_file(MFS_ADMIN_DIR . '/assets/admin.css') ? '<link rel="stylesheet" href="assets/admin.css">' : '';
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    . '<meta name="robots" content="noindex, nofollow"><title>' . h($title) . '</title>' . $css . '</head>'
    . '<body class="adm adm--auth"><main class="auth"><div class="auth__inner"><div class="brand brand--auth">' . mfs_brand_html(t('Team area')) . '</div>'
    . '<section class="auth__card"><h1 class="auth__title">' . h($title) . '</h1><p>' . h($message) . '</p>'
    . ($detail !== '' ? '<p class="muted small">' . h($detail) . '</p>' : '') . '</section></div></main></body></html>';
  exit;
}
