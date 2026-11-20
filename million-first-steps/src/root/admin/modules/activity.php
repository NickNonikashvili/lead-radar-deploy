<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
/*
 * Activity (?p=activity) — owners only. The audit log, newest first, 50 per page, grouped by day (Tbilisi time).
 * Linked from Settings (not in the sidebar). Read-only: lines are never edited or deleted here (bookings derive
 * their reference numbers from 'booking.create' lines).
 *
 * Filters (GET, all optional, combined):
 *   who   = <user id> | none (automatic entries and sign-in attempts by someone not signed in)
 *   area  = request | booking | payment | tours | settings | user | auth | export | system   (MG_AREAS)
 *   from, to = Y-m-d (Tbilisi dates, inclusive)
 *   q     = text in the details or target (e.g. a reference like B-2611-0003)
 *   page
 * Descriptions come from mg_action_title() / mg_action_details() in manage-lib.php; records that still exist
 * are linked (mg_target_links()).
 */
require_once __DIR__ . '/manage-lib.php';
$me = require_owner();

const ACT_PER_PAGE = 50;

if (is_post()) {
  // Nothing on this page changes anything.
  csrf_check();
  redirect(url('activity'));
}

/** A Tbilisi date 'Y-m-d' → the UTC time its day starts ('' when not a real date). $plusDays moves it. */
function act_utc_start(string $ymd, int $plusDays = 0): string
{
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $ymd)) return '';
  $d = DateTime::createFromFormat('!Y-m-d', $ymd, mfs_tz());
  if (!$d || $d->format('Y-m-d') !== $ymd) return '';
  if ($plusDays) $d->modify(($plusDays > 0 ? '+' : '') . $plusDays . ' day');
  $d->setTimezone(new DateTimeZone('UTC'));
  return $d->format('Y-m-d H:i:s');
}

/** LIKE pattern with the wildcards of $s taken literally (use with ESCAPE '\'). */
function act_like(string $s): string
{
  return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $s);
}

// ── Filters ────────────────────────────────────────────────────────────────
$who = get('who');
if ($who !== 'none' && !preg_match('/^\d{1,12}$/', $who)) $who = '';
$area = get('area');
if (!isset(MG_AREAS[$area])) $area = '';
$from = get('from');
$to = get('to');
if (act_utc_start($from) === '') $from = '';
if (act_utc_start($to) === '') $to = '';
if ($from !== '' && $to !== '' && $from > $to) list($from, $to) = [$to, $from];
$q = get('q');
if (strlen($q) > 100) $q = function_exists('mb_strcut') ? mb_strcut($q, 0, 100, 'UTF-8') : substr($q, 0, 100);
$page = max(1, get_int('page', 1));
$filters = ['who' => $who, 'area' => $area, 'from' => $from, 'to' => $to, 'q' => $q];
$filtered = implode('', $filters) !== '';

$where = [];
$args = [];
if ($who === 'none') {
  $where[] = 'a.user_id IS NULL';
} elseif ($who !== '') {
  $where[] = 'a.user_id = ?';
  $args[] = (int) $who;
}
if ($area !== '') {
  $ors = [];
  foreach (MG_AREAS[$area][2] as $prefix) {
    $ors[] = "a.action LIKE ? ESCAPE '\\'";
    $args[] = act_like($prefix) . '%';
  }
  $where[] = '(' . implode(' OR ', $ors) . ')';
}
if ($from !== '') {
  $where[] = 'a.at >= ?';
  $args[] = act_utc_start($from);
}
if ($to !== '') {
  $where[] = 'a.at < ?';
  $args[] = act_utc_start($to, 1);
}
if ($q !== '') {
  $like = '%' . act_like($q) . '%';
  $where[] = "(a.details LIKE ? ESCAPE '\\' OR a.target LIKE ? ESCAPE '\\')";
  array_push($args, $like, $like);
}
$sqlWhere = $where ? ' WHERE ' . implode(' AND ', $where) : '';

$all = (int) db_value('SELECT COUNT(*) FROM audit_log');
$total = $filtered ? (int) db_value('SELECT COUNT(*) FROM audit_log a' . $sqlWhere, $args) : $all;
$pages = max(1, (int) ceil($total / ACT_PER_PAGE));
if ($page > $pages) $page = $pages;
$rows = $total ? db_all('SELECT a.id, a.user_id, a.action, a.target, a.details, a.at FROM audit_log a' . $sqlWhere
  . ' ORDER BY a.at DESC, a.id DESC LIMIT ' . ACT_PER_PAGE . ' OFFSET ' . (($page - 1) * ACT_PER_PAGE), $args) : [];
$links = mg_target_links($rows);

// The people to filter by: everyone in the team, then anyone in the log who has since been removed.
$people = [];
foreach (db_all('SELECT id, name, active FROM users ORDER BY active DESC, name COLLATE NOCASE') as $u) {
  $people[(string) $u['id']] = (string) $u['name'] . ((int) $u['active'] === 1 ? '' : ' (' . t('access off') . ')');
}
foreach (db_all('SELECT DISTINCT user_id FROM audit_log WHERE user_id IS NOT NULL ORDER BY user_id') as $r) {
  $k = (string) (int) $r['user_id'];
  if (!isset($people[$k])) $people[$k] = t('Former team member (no. {id})', ['id' => $k]);
}
if ($who !== '' && $who !== 'none' && !isset($people[$who])) $people[$who] = t('Former team member (no. {id})', ['id' => $who]);

$areaTone = [
  'request' => 'gold', 'booking' => 'green', 'payment' => 'green', 'tours' => 'wine', 'settings' => 'blue',
  'user' => 'violet', 'auth' => 'grey', 'export' => 'grey', 'system' => 'grey',
];
$linkLabel = function (string $target): string {
  if (strpos($target, 'request:') === 0) return t('Open the request');
  if (strpos($target, 'booking:') === 0 || strpos($target, 'payment:') === 0) return t('Open the booking');
  if (strpos($target, 'user:') === 0) return t('Open their page');
  if (strpos($target, 'settings:tour') === 0 || $target === 'settings:party_factors') return t('Open Tours & prices');
  return t('Open in Settings');
};
$today = local_today();
$yesterday = (new DateTime('yesterday', mfs_tz()))->format('Y-m-d');

ob_start(); ?>
<form method="get" action="index.php" class="toolbar act-toolbar" role="search" aria-label="<?= h(t('Filter the activity log')) ?>">
  <input type="hidden" name="p" value="activity">
  <div class="toolbar__search search act-toolbar__search">
    <?= icon('search') ?>
    <label class="sr-only" for="act-q"><?= h(t('Search the details')) ?></label>
    <input class="input" type="search" id="act-q" name="q" value="<?= h($q) ?>" placeholder="<?= h(t('Search the details, e.g. a reference')) ?>" autocomplete="off" maxlength="100">
  </div>
  <div class="act-toolbar__group">
    <div class="act-filter">
      <label class="act-filter__label" for="act-who"><?= h(t('Person')) ?></label>
      <select class="select" id="act-who" name="who" data-autosubmit>
        <option value=""><?= h(t('Everyone')) ?></option>
        <?php foreach ($people as $id => $name) { ?><option value="<?= h($id) ?>"<?= $who === (string) $id ? ' selected' : '' ?>><?= h($name) ?></option><?php } ?>
        <option value="none"<?= $who === 'none' ? ' selected' : '' ?>><?= h(t('Automatic or not signed in')) ?></option>
      </select>
    </div>
    <div class="act-filter">
      <label class="act-filter__label" for="act-area"><?= h(t('Area')) ?></label>
      <select class="select" id="act-area" name="area" data-autosubmit>
        <option value=""><?= h(t('All areas')) ?></option>
        <?php foreach (MG_AREAS as $key => $info) { ?><option value="<?= h($key) ?>"<?= $area === $key ? ' selected' : '' ?>><?= h(t($info[0])) ?></option><?php } ?>
      </select>
    </div>
    <div class="act-filter act-filter--date">
      <label class="act-filter__label" for="act-from"><?= h(t('From')) ?></label>
      <input class="input" type="date" id="act-from" name="from" value="<?= h($from) ?>" max="<?= h($today) ?>">
    </div>
    <div class="act-filter act-filter--date">
      <label class="act-filter__label" for="act-to"><?= h(t('To')) ?></label>
      <input class="input" type="date" id="act-to" name="to" value="<?= h($to) ?>" max="<?= h($today) ?>">
    </div>
  </div>
  <div class="act-toolbar__actions">
    <button type="submit" class="btn btn--dark"><?= icon('filter') ?><?= h(t('Show')) ?></button>
    <?php if ($filtered) { ?><a class="btn btn--ghost" href="<?= h(url('activity')) ?>"><?= icon('close') ?><?= h(t('Clear filters')) ?></a><?php } ?>
  </div>
</form>

<p class="act-count" aria-live="polite">
  <?php if ($filtered) { ?>
    <?= h(tp($total, '{n} entry matches', '{n} entries match')) ?> <span class="muted"><?= h(t('(of {all} in the log)', ['all' => number_format($all)])) ?></span>
  <?php } else { ?>
    <?= h(tp($total, '{n} entry in the log', '{n} entries in the log')) ?>
  <?php } ?>
</p>

<?php if (!$rows) { ?>
  <section class="card empty">
    <div class="empty__mark" aria-hidden="true"><?= icon($filtered ? 'filter' : 'history') ?></div>
    <?php if ($filtered) { ?>
      <h2 class="empty__title"><?= h(t('Nothing matches these filters')) ?></h2>
      <p class="empty__text"><?= h(t('Try another person, area or dates — or clear the filters to see everything.')) ?></p>
      <div class="btn-row btn-row--center"><a class="btn btn--secondary" href="<?= h(url('activity')) ?>"><?= icon('close') ?><?= h(t('Clear filters')) ?></a></div>
    <?php } else { ?>
      <h2 class="empty__title"><?= h(t('Nothing has happened yet')) ?></h2>
      <p class="empty__text"><?= h(t('Sign-ins, changes to requests, bookings, prices and settings will be listed here as they happen.')) ?></p>
    <?php } ?>
  </section>
<?php } else { ?>
  <div class="card card--flush act-card">
    <?php $day = null;
    foreach ($rows as $r) {
      $local = utc_to_local($r['at']);
      $d = $local ? $local->format('Y-m-d') : '';
      if ($d !== $day) {
        if ($day !== null) echo '</ol></section>';
        $day = $d;
        $dayLabel = $d === $today ? t('Today') : ($d === $yesterday ? t('Yesterday') : '');
        echo '<section class="act-day" aria-label="' . h($dayLabel !== '' ? $dayLabel . ', ' . fmt_date($d) : fmt_date($d)) . '">'
          . '<h2 class="act-day__title">' . ($dayLabel !== '' ? '<span>' . h($dayLabel) . '</span> ' : '') . '<span class="act-day__date">' . h(fmt_date($d)) . '</span></h2>'
          . '<ol class="act-list">';
      }
      $action = (string) $r['action'];
      $ar = mg_action_area($action);
      $tone = $areaTone[$ar] ?? 'grey';
      $details = mg_action_details($action, (string) $r['details']);
      $uid = $r['user_id'] !== null ? (int) $r['user_id'] : 0; ?>
      <li class="act-item act-item--<?= h($tone) ?>">
        <span class="act-item__icon" aria-hidden="true"><?= icon($ar !== '' ? MG_AREAS[$ar][1] : 'history') ?></span>
        <div class="act-item__main">
          <p class="act-item__title"><?= h(mg_action_title($action, (string) $r['target'], (string) $r['details'])) ?></p>
          <?php if ($details !== '') { ?><p class="act-item__details"><?= h($details) ?></p><?php } ?>
          <p class="act-item__meta">
            <?php if ($uid > 0) { ?>
              <a class="act-item__who" href="<?= h(url('activity', ['who' => $uid] + array_diff_key($filters, ['who' => 1]))) ?>" title="<?= h(t('Only this person')) ?>"><?= h(mg_actor_name($r)) ?></a>
            <?php } else { ?>
              <span class="act-item__who act-item__who--none"><?= h(mg_actor_name($r)) ?></span>
            <?php } ?>
            <?php if ($ar !== 'system') { ?><span class="act-item__area"><?= h($ar !== '' ? t(MG_AREAS[$ar][0]) : $action) ?></span><?php } ?>
            <?php if (isset($links[(int) $r['id']])) { ?>
              <a class="act-item__link" href="<?= h($links[(int) $r['id']]) ?>"><?= h($linkLabel((string) $r['target'])) ?><?= icon('arrow') ?></a>
            <?php } ?>
          </p>
        </div>
        <time class="act-item__time" datetime="<?= h($local ? $local->format('c') : '') ?>" title="<?= h(fmt_date($r['at'], true)) ?>"><?= h($local ? $local->format('H:i') : '') ?></time>
      </li>
    <?php }
    if ($day !== null) echo '</ol></section>'; ?>
  </div>
  <?= pager($total, $page, ACT_PER_PAGE, ['p' => 'activity'] + $filters) ?>
<?php } ?>

<p class="act-foot small muted"><?= icon('lock') ?><span><?= h(t('The log is a record: entries can’t be changed or deleted. Times are Tbilisi time.')) ?></span></p>
<?php
render(t('Activity'), ob_get_clean(), [
  'nav' => 'settings',
  'css' => ['manage.css'],
  'js' => ['manage.js'],
  'crumbs' => [[t('Settings'), url('settings')], [t('Activity'), '']],
  'lead' => t('Who did what in the team area, newest first.'),
]);
