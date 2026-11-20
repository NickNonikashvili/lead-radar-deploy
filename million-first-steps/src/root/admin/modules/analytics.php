<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
/*
 * Statistics (?p=analytics): the website's own cookieless visit counts (api/hit.php → stats_* tables) and the
 * requests that came in over the same days.
 *   d = 7 | 30 (default) | 90   the period: the last d UTC days including today (the stats tables use UTC days)
 *   merge = 1                   top pages with all languages of a page added together
 * Every figure is compared with the d days before. Requests: spam left out, created_at within the same UTC days.
 * Read-only page (a POST is answered with a redirect after the CSRF check).
 */
$me = require_login();
if (is_post()) {
  csrf_check();
  redirect(url('analytics'));
}
require_once __DIR__ . '/insights-lib.php';

$d = get_int('d', 30);
if (!in_array($d, [7, 30, 90], true)) $d = 30;
$merge = get('merge') === '1';
$owner = is_owner();
$statsOn = (bool) setting('analytics_enabled');

list($first, $last) = ins_window($d);
list($pFirst, $pLast) = ins_window($d, 1);
$days = ins_days_list($first, $last);

// ── Totals ──────────────────────────────────────────────────────────────────

$cur = db_row('SELECT COALESCE(SUM(visitors), 0) AS v, COALESCE(SUM(views), 0) AS pv FROM stats_daily WHERE day >= ? AND day <= ?', [$first, $last]) ?: ['v' => 0, 'pv' => 0];
$prev = db_row('SELECT COALESCE(SUM(visitors), 0) AS v, COALESCE(SUM(views), 0) AS pv FROM stats_daily WHERE day >= ? AND day <= ?', [$pFirst, $pLast]) ?: ['v' => 0, 'pv' => 0];
$visitors = (int) $cur['v'];
$views = (int) $cur['pv'];
$visitorsPrev = (int) $prev['v'];
$viewsPrev = (int) $prev['pv'];
list($rFrom, $rTo) = ins_utc_bounds($first, $last);
list($rpFrom, $rpTo) = ins_utc_bounds($pFirst, $pLast);
$requests = (int) db_value("SELECT COUNT(*) FROM requests WHERE status <> 'spam' AND created_at >= ? AND created_at < ?", [$rFrom, $rTo]);
$requestsPrev = (int) db_value("SELECT COUNT(*) FROM requests WHERE status <> 'spam' AND created_at >= ? AND created_at < ?", [$rpFrom, $rpTo]);
$anyStats = (int) db_value('SELECT COUNT(*) FROM stats_daily') > 0;

// ── Per day ─────────────────────────────────────────────────────────────────

$byDay = [];
foreach (db_all('SELECT day, visitors, views FROM stats_daily WHERE day >= ? AND day <= ?', [$first, $last]) as $r) $byDay[$r['day']] = [(int) $r['visitors'], (int) $r['views']];
$visVals = [];
$viewVals = [];
$labels = [];
$axis = [];
$busiest = null;
foreach ($days as $i => $day) {
  $v = $byDay[$day][0] ?? 0;
  $visVals[] = $v;
  $viewVals[] = $byDay[$day][1] ?? 0;
  $labels[] = ins_weekday_day_label($day);
  if ($d === 7) {
    $dt = DateTime::createFromFormat('!Y-m-d', $day, new DateTimeZone('UTC'));
    $axis[] = ins_weekday_short((int) $dt->format('N')) . ' ' . $dt->format('j');
  } else {
    $axis[] = ins_day_label($day);
  }
  if ($v > 0 && ($busiest === null || $v > $busiest[1])) $busiest = [$day, $v];
}
$todayIdx = count($days) - 1;

// ── Pages ───────────────────────────────────────────────────────────────────

$pageRows = db_all('SELECT path, SUM(views) AS v FROM stats_pages WHERE day >= ? AND day <= ? GROUP BY path ORDER BY v DESC, path', [$first, $last]);
$pageTotal = 0;
$pages = [];
foreach ($pageRows as $r) {
  $v = (int) $r['v'];
  if ($v <= 0) continue;
  $pageTotal += $v;
  $info = ins_page_info((string) $r['path']);
  $key = $merge ? ($info['notfound'] ? '(not found)' : $info['base']) : (string) $r['path'];
  if (!isset($pages[$key])) {
    $pages[$key] = [
      'label' => $merge ? $info['name'] : $info['label'],
      'value' => 0,
      'sub' => $info['notfound'] ? t('Someone followed a broken or mistyped link') : ($merge ? '' : (string) $r['path']),
      'href' => $merge ? ($info['known'] ? '..' . $info['base'] : '') : $info['href'],
      'external' => true,
      'langs' => [],
    ];
  }
  $pages[$key]['value'] += $v;
  if ($merge && !$info['notfound']) $pages[$key]['langs'][$info['lang'] !== '' ? $info['lang'] : 'en'] = true;
}
if ($merge) {
  foreach ($pages as $k => $p) {
    if (!$p['langs']) continue;
    $pages[$k]['sub'] = count($p['langs']) >= count(ins_site_langs())
      ? t('All {n} languages', ['n' => count($p['langs'])])
      : tp(count($p['langs']), '{n} language', '{n} languages') . ': ' . strtoupper(implode(', ', array_keys($p['langs'])));
  }
}
uasort($pages, function ($a, $b) {
  if ($a['value'] !== $b['value']) return $a['value'] > $b['value'] ? -1 : 1;
  return strcmp($a['label'], $b['label']);
});
$pages = array_values($pages);

// ── Languages, referrers, devices ───────────────────────────────────────────

$dims = ['lang' => [], 'ref' => [], 'device' => []];
foreach (db_all("SELECT dim, value, SUM(views) AS v FROM stats_dims WHERE day >= ? AND day <= ? AND dim IN ('lang', 'device') GROUP BY dim, value", [$first, $last]) as $r) {
  $dims[$r['dim']][(string) $r['value']] = (int) $r['v'];
}
// Referrers: only the busiest hosts come into PHP; the rest are added up as "Other websites".
foreach (db_all("SELECT value, SUM(views) AS v FROM stats_dims WHERE day >= ? AND day <= ? AND dim = 'ref' GROUP BY value ORDER BY v DESC, value LIMIT 60", [$first, $last]) as $r) {
  $dims['ref'][(string) $r['value']] = (int) $r['v'];
}
$refRest = (int) db_value("SELECT COALESCE(SUM(views), 0) FROM stats_dims WHERE day >= ? AND day <= ? AND dim = 'ref'", [$first, $last]) - array_sum($dims['ref']);
if ($refRest > 0) $dims['ref']['(other)'] = ($dims['ref']['(other)'] ?? 0) + $refRest;
arsort($dims['lang']);
$langRows = [];
foreach ($dims['lang'] as $code => $v) if ($v > 0) $langRows[] = ['label' => ins_lang_name($code), 'value' => $v];
$langTotal = array_sum($dims['lang']);

$refs = [];
foreach ($dims['ref'] as $host => $v) {
  if ($v <= 0) continue;
  $ri = ins_ref_info($host);
  if (!isset($refs[$ri['key']])) $refs[$ri['key']] = ['label' => $ri['name'], 'value' => 0, 'hosts' => [], 'direct' => $ri['direct']];
  $refs[$ri['key']]['value'] += $v;
  if (!$ri['direct'] && $ri['key'] !== '(other)') $refs[$ri['key']]['hosts'][$host] = $v;
}
foreach ($refs as $k => $r) {
  arsort($r['hosts']);
  $hosts = array_keys($r['hosts']);
  if ($r['direct']) $refs[$k]['sub'] = t('Typed the address, a bookmark, or an app that doesn’t say');
  elseif (count($hosts) > 1 || (count($hosts) === 1 && $hosts[0] !== $r['label'])) $refs[$k]['sub'] = implode(', ', array_slice($hosts, 0, 3)) . (count($hosts) > 3 ? ' …' : '');
  else $refs[$k]['sub'] = '';
}
uasort($refs, function ($a, $b) {
  if ($a['value'] !== $b['value']) return $a['value'] > $b['value'] ? -1 : 1;
  return strcmp($a['label'], $b['label']);
});
$refs = array_values($refs);
$refTotal = array_sum(array_column($refs, 'value'));

$deviceNames = ['phone' => 'Phones', 'tablet' => 'Tablets', 'desktop' => 'Computers', 'unknown' => 'Unknown'];
$devRows = [];
foreach ($deviceNames as $k => $label) {
  $v = $dims['device'][$k] ?? 0;
  if ($v > 0) $devRows[] = ['label' => t($label), 'value' => $v];
}
usort($devRows, function ($a, $b) { return $b['value'] <=> $a['value']; });
$devTotal = array_sum(array_column($devRows, 'value'));

// ── Requests in the period ──────────────────────────────────────────────────

$reqLang = [];
foreach (db_all("SELECT COALESCE(lang, '') AS lang, COUNT(*) AS n FROM requests WHERE status <> 'spam' AND created_at >= ? AND created_at < ? GROUP BY COALESCE(lang, '') ORDER BY n DESC", [$rFrom, $rTo]) as $r) {
  $code = strtolower((string) $r['lang']);
  $reqLang[] = ['label' => $code === '' ? t('Not known') : ins_lang_name($code), 'value' => (int) $r['n']];
}
$reqKind = [];
foreach (db_all("SELECT kind, COUNT(*) AS n FROM requests WHERE status <> 'spam' AND created_at >= ? AND created_at < ? GROUP BY kind ORDER BY n DESC", [$rFrom, $rTo]) as $r) {
  $reqKind[] = ['label' => t(REQUEST_KINDS[$r['kind']] ?? 'Other'), 'value' => (int) $r['n'], 'href' => url('requests', ['kind' => $r['kind']])];
}
$spamN = (int) db_value("SELECT COUNT(*) FROM requests WHERE status = 'spam' AND created_at >= ? AND created_at < ?", [$rFrom, $rTo]);

// ── Output ──────────────────────────────────────────────────────────────────

$vs = t('vs previous {n} days', ['n' => $d]);
$kpi = function (string $tone, string $icon, string $label, string $value, string $metaHtml, string $key, $raw, string $href = '') {
  $inner = '<span class="kpi__icon" aria-hidden="true">' . icon($icon) . '</span><p class="kpi__label">' . h($label) . '</p>'
    . '<p class="kpi__value" data-kpi="' . h($key) . '" data-value="' . h((string) $raw) . '">' . h($value) . '</p><p class="kpi__meta">' . $metaHtml . '</p>';
  return $href !== '' ? '<a class="kpi kpi--' . h($tone) . '" href="' . h($href) . '">' . $inner . '</a>' : '<div class="kpi kpi--' . h($tone) . '">' . $inner . '</div>';
};
$card = function (string $id, string $title, string $sub, string $body, string $actions = '') {
  return '<section class="card stats-card" aria-labelledby="' . h($id) . '"><div class="card__head"><div><h2 class="card__title" id="' . h($id) . '">' . h($title) . '</h2>'
    . ($sub !== '' ? '<p class="card__sub">' . h($sub) . '</p>' : '') . '</div>' . ($actions !== '' ? '<div class="card__actions">' . $actions . '</div>' : '') . '</div>'
    . '<div class="card__body">' . $body . '</div></section>';
};
/** A bar list, with everything after the first $show rows in a "Show all" disclosure. */
$listWithMore = function (array $rows, array $opts, int $show, string $moreLabel) {
  if (count($rows) <= $show + 1) return ins_bar_list($rows, $opts);
  $opts['total'] = $opts['total'] ?? array_sum(array_column($rows, 'value'));
  $opts['max'] = max(array_column($rows, 'value'));
  return ins_bar_list(array_slice($rows, 0, $show), $opts)
    . '<details class="stats-more"><summary>' . h($moreLabel) . '</summary>' . ins_bar_list(array_slice($rows, $show), $opts) . '</details>';
};
$nothing = function (string $text) use ($statsOn) {
  return ins_empty('chart', t('Nothing counted in this period'), $statsOn ? $text : t('Visitor counting is switched off.'));
};
$perVisit = $visitors > 0 ? $views / $visitors : null;
$perVisitPrev = $visitorsPrev > 0 ? $viewsPrev / $visitorsPrev : null;
$rate = ins_rate($requests, $visitors);

ob_start();
?>
<nav class="tabs stats-tabs" aria-label="<?= h(t('Period')) ?>">
<?php foreach ([7, 30, 90] as $n): ?>
  <a class="tab<?= $n === $d ? ' is-active' : '' ?>" href="<?= h(url('analytics', ['d' => $n === 30 ? null : $n, 'merge' => $merge ? '1' : null])) ?>"<?= $n === $d ? ' aria-current="page"' : '' ?>><?= h(tp($n, '{n} day', '{n} days')) ?></a>
<?php endforeach; ?>
</nav>

<?php if (!$statsOn): ?>
<div class="callout callout--warn stats-callout"><?= icon('alert') ?><div><p><strong><?= h(t('Visitor counting is switched off.')) ?></strong> <?= h($anyStats ? t('No new visits are being counted. The figures below are from before it was switched off.') : t('No visits are being counted.')) ?></p>
<?php if ($owner): ?><p><a href="<?= h(url('settings')) ?>"><?= h(t('Switch it on in Settings')) ?></a></p><?php endif; ?></div></div>
<?php elseif (!$anyStats): ?>
<div class="callout callout--info stats-callout"><?= icon('info') ?><div><p><strong><?= h(t('No visits counted yet.')) ?></strong> <?= h(t('Counting starts as soon as people visit the website. Check back tomorrow.')) ?></p></div></div>
<?php endif; ?>

<div class="stats">
  <section class="stats__kpis" aria-label="<?= h(t('Key figures')) ?>">
    <div class="kpis stats-kpis">
      <?= $kpi('blue', 'users', t('Visitors'), ins_num($visitors), ($visitors || $visitorsPrev) ? ins_trend($visitors, $visitorsPrev, $vs) : '<span>' . h(t('None counted yet')) . '</span>', 'visitors', $visitors) ?>
      <?= $kpi('blue', 'eye', t('Page views'), ins_num($views), ($views || $viewsPrev) ? ins_trend($views, $viewsPrev, $vs) : '<span>' . h(t('None counted yet')) . '</span>', 'views', $views) ?>
      <?= $kpi('gold', 'note', t('Pages per visitor'), $perVisit !== null ? ins_num($perVisit, 1) : '—',
        $perVisitPrev !== null ? '<span>' . h(t('{n} in the previous {days} days', ['n' => ins_num($perVisitPrev, 1), 'days' => $d])) . '</span>' : '<span>' . h(t('Pages seen per visitor per day')) . '</span>',
        'per_visit', $perVisit !== null ? round($perVisit, 1) : '') ?>
      <?= $kpi('wine', 'inbox', t('Requests'), ins_num($requests), ($requests || $requestsPrev) ? ins_trend($requests, $requestsPrev, $vs) : '<span>' . h(t('None in this period')) . '</span>', 'requests', $requests, url('requests')) ?>
      <?= $kpi('wine', 'star', t('Request rate'), $rate !== null ? $rate : '—',
        '<span>' . h(ins_rate_note($requests, $visitors)) . '</span>', 'rate', $rate !== null ? $rate : '') ?>
      <?= $kpi('green', 'calendar', t('Busiest day'), $busiest ? ins_weekday_day_label($busiest[0]) : '—',
        '<span>' . h($busiest ? tp($busiest[1], '{n} visitor', '{n} visitors') : t('No visits yet')) . '</span>', 'busiest', $busiest ? $busiest[0] : '') ?>
    </div>
  </section>

  <section class="card stats-chart">
    <?= ins_column_chart([
      'id' => 'stats-days',
      'title' => t('Visitors and page views'),
      'sub' => ins_range_label($first, $last),
      'desc' => t('Visitors and page views per day from {from} to {to}: {visitors} visitors and {views} page views in all.', [
        'from' => ins_day_label($first, true), 'to' => ins_day_label($last, true), 'visitors' => ins_num($visitors), 'views' => ins_num($views),
      ]),
      'labels' => $labels,
      'axis' => $axis,
      'steps' => $d === 7 ? [2, 1, 1] : ($d === 30 ? [7, 7, 7] : [28, 14, 7]),
      'series' => [
        ['name' => t('Page views'), 'values' => $viewVals, 'type' => 'bar', 'tone' => 'muted'],
        ['name' => t('Visitors'), 'values' => $visVals, 'type' => 'line', 'tone' => 'wine'],
      ],
      'partial' => $todayIdx,
      'partial_label' => t('Today so far'),
      'table_head' => t('Day'),
      'tip' => function ($i) use ($labels, $visVals, $viewVals, $todayIdx) {
        return ($i === $todayIdx ? t('Today so far') : $labels[$i]) . ' — ' . tp($visVals[$i], '{n} visitor', '{n} visitors') . ', ' . tp($viewVals[$i], '{n} page view', '{n} page views');
      },
      'empty' => $statsOn ? t('No visits counted in this period yet.') : t('Visitor counting is switched off.'),
      'empty_html' => (!$statsOn && $owner) ? '<a class="btn btn--secondary btn--sm" href="' . h(url('settings')) . '">' . icon('settings') . h(t('Open settings')) . '</a>' : '',
    ]) ?>
  </section>

<?php if ($views === 0): ?>
  <section class="card stats-card" aria-labelledby="stats-none-t"><div class="card__head"><div><h2 class="card__title" id="stats-none-t"><?= h(t('Pages, sources, languages and devices')) ?></h2></div></div>
    <div class="card__body"><?= ins_empty('chart', t('Nothing counted in this period'), $statsOn
      ? t('Once people visit the website, you’ll see the most visited pages, where visitors come from, the languages they read in and the devices they use.')
      : t('Visitor counting is switched off.')) ?></div></section>
<?php else: ?>
  <div class="stats__grid">
    <div class="stats__col">
<?php
$mergeChips = '<nav class="chips stats-chips" aria-label="' . h(t('Languages')) . '">'
  . '<a class="chip' . (!$merge ? ' is-active' : '') . '" href="' . h(url('analytics', ['d' => $d === 30 ? null : $d])) . '"' . (!$merge ? ' aria-current="true"' : '') . '>' . h(t('Each language')) . '</a>'
  . '<a class="chip' . ($merge ? ' is-active' : '') . '" href="' . h(url('analytics', ['d' => $d === 30 ? null : $d, 'merge' => '1'])) . '"' . ($merge ? ' aria-current="true"' : '') . '>' . h(t('All languages together')) . '</a></nav>';
echo $card('stats-pages-t', t('Most visited pages'), $pages ? tp($pageTotal, '{n} page view', '{n} page views') . ' · ' . t('names open the page on the website') : t('Which pages people look at most'),
  $pages ? $listWithMore($pages, ['share' => true, 'total' => $pageTotal], 12, tp(count($pages) - 12, 'Show {n} more page', 'Show {n} more pages')) : $nothing(t('Pages appear here once people visit the website.')),
  $pages ? $mergeChips : '');
?>
    </div>
    <div class="stats__col">
<?php
echo $card('stats-ref-t', t('Where visitors come from'), t('Arrivals from other websites, or directly'),
  $refs ? $listWithMore($refs, ['share' => true, 'tone' => 'green'], 8, tp(count($refs) - 8, 'Show {n} more', 'Show {n} more')) . '<p class="stats-note">' . h(t('Moving between your own pages isn’t counted here.')) . '</p>'
    : $nothing(t('Search engines, social networks and other websites that send visitors show up here.')));
echo $card('stats-lang-t', t('Website languages'), t('Page views by the language of the page'),
  $langRows ? ins_bar_list($langRows, ['share' => true, 'tone' => 'blue']) : $nothing(t('The languages people read the website in show up here.')));
echo $card('stats-dev-t', t('Devices'), t('Page views by screen size'),
  $devRows ? ins_bar_list($devRows, ['share' => true, 'tone' => 'wine']) : $nothing(t('Phones, tablets and computers show up here.')));
?>
    </div>
  </div>
<?php endif; ?>

  <div class="stats__grid stats__grid--even">
<?php
echo $card('stats-rlang-t', t('Requests by language'), t('Language of the website page the form was sent from'),
  $reqLang ? ins_bar_list($reqLang, ['share' => true]) : ins_empty('inbox', t('No requests in this period'), t('Requests sent through the website’s forms are counted here.')));
echo $card('stats-rkind-t', t('Requests by kind'), $spamN > 0 ? tp($spamN, 'Not counting {n} spam message', 'Not counting {n} spam messages') : t('Spam is never counted'),
  $reqKind ? ins_bar_list($reqKind, ['share' => true, 'tone' => 'wine']) : ins_empty('inbox', t('No requests in this period'), t('Trip requests, messages and partner enquiries are counted here.')));
?>
  </div>

  <section class="card card--muted stats-how" aria-labelledby="stats-how-t">
    <div class="stats-how__icon" aria-hidden="true"><?= icon('shield') ?></div>
    <div>
      <h2 class="stats-how__title" id="stats-how-t"><?= h(t('How visits are counted')) ?></h2>
      <ul class="stats-how__list">
        <li><?= h(t('Our own server counts each page view. There are no cookies, no outside services, and IP addresses are never stored.')) ?></li>
        <li><?= h(t('A visitor is recognised for one day only, by an anonymous code that changes every day — so someone who visits on three days counts as three visitors.')) ?></li>
        <li><?= h(t('Not counted: search engine robots, browsers that ask not to be tracked (Do Not Track or Global Privacy Control), and your team’s own browsers once they’ve signed in here.')) ?></li>
        <li><?= h(t('Days run from midnight to midnight UTC (4 am to 4 am in Tbilisi). Requests are counted over the same days.')) ?></li>
      </ul>
<?php if ($owner): ?>
      <p class="stats-how__foot"><a href="<?= h(url('settings')) ?>"><?= icon('settings') ?><?= h($statsOn ? t('Visitor counting can be switched off in Settings') : t('Switch visitor counting on in Settings')) ?></a></p>
<?php endif; ?>
    </div>
  </section>
</div>
<?php
render(t('Statistics'), ob_get_clean(), [
  'nav' => 'analytics',
  'lead' => t('Last {n} days: {range}', ['n' => $d, 'range' => ins_range_label($first, $last)]),
  'css' => ['charts.css', 'analytics.css'],
  'js' => ['charts.js'],
]);
