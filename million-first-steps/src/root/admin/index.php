<?php
/*
 * Million First Steps — team area (admin panel). Front controller: index.php?p=<page>[&id=…].
 * Every page is a file in modules/; see lib/boot.php for the helpers and how a module is written.
 */
require __DIR__ . '/lib/boot.php';
mfs_web_start();

/** Every page: name => [module file, needs a signed-in user]. Modules check roles themselves. */
const MFS_PAGES = [
  'login' => 'login.php',
  'logout' => 'logout.php',
  'setup' => 'setup.php',
  'forgot' => 'forgot.php',
  'reset' => 'reset.php',
  'account' => 'account.php',
  'dashboard' => 'dashboard.php',
  'requests' => 'requests.php',
  'request' => 'request.php',
  'export' => 'export.php',
  'bookings' => 'bookings.php',
  'booking' => 'booking.php',
  'calendar' => 'calendar.php',
  'analytics' => 'analytics.php',
  'tours' => 'tours.php',
  'settings' => 'settings.php',
  'users' => 'users.php',
  'activity' => 'activity.php',
];
/** Pages that work without being signed in. */
const MFS_PUBLIC_PAGES = ['login', 'logout', 'setup', 'forgot', 'reset'];

/** Runs a module file in its own scope. Modules finish with render(), redirect() or exit. */
function mfs_run_module(string $file): void
{
  require $file;
}

$page = isset($_GET['p']) && is_string($_GET['p']) ? $_GET['p'] : 'dashboard';
if ($page === '') $page = 'dashboard';

// First run: no account yet → the setup page (except for the setup page itself).
if ($page !== 'setup' && mfs_user_count() === 0) redirect(url('setup'));

if (!isset(MFS_PAGES[$page]) || !preg_match('/^[a-z]+$/', $page)) {
  require_login();
  render_error(404, t('Page not found'), t('There is no page at this address. It may have moved — use the menu to find what you need.'));
}
if (!in_array($page, MFS_PUBLIC_PAGES, true)) require_login();

$file = __DIR__ . '/modules/' . MFS_PAGES[$page];
if (!is_file($file)) render_error(404, t('Page not found'), t('This part of the team area isn’t available yet.'));
mfs_run_module($file);
// A module that didn't finish its page:
render_error(500, t('Something went wrong'), t('This page did not finish loading. Please try again.'));
