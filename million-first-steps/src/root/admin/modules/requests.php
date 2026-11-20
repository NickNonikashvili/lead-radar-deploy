<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
/*
 * Requests (?p=requests): the inbox of everything sent from the website's forms — newest first, status tabs
 * with counts, kind / search / "assigned to me" / "follow-up due" filters, bulk actions, 25 per page.
 * Filters: see modules/requests-lib.php. The top bar's search box lands here with ?q=.
 */
require_once __DIR__ . '/requests-lib.php';
$me = require_login();
$meId = (int) $me['id'];
$owner = is_owner();
$f = req_filters();
$page = max(1, get_int('page', 1));

// ── Bulk actions (POST to the list's own address, so we come back to the same tab, filters and page) ───────
if (is_post()) {
  csrf_check();
  $back = url('requests', req_params($f, ['page' => $page > 1 ? $page : null]));
  $ids = array_slice(post_ids('ids'), 0, 500);
  $act = post('bulk');
  if (!$ids) {
    flash('info', t('Tick at least one request first.'));
    redirect($back);
  }
  if ($act === 'delete') {
    if (!$owner) render_error(403, t('For owners only'), t('Only the owners can delete requests. You can mark them as lost or spam instead.'));
    $gone = db_tx(function (PDO $pdo) use ($ids) {
      $sel = $pdo->prepare('SELECT ref FROM requests WHERE id = ?');
      $del = $pdo->prepare('DELETE FROM requests WHERE id = ?');
      $out = [];
      foreach ($ids as $id) {
        $sel->execute([$id]);
        $ref = $sel->fetchColumn();
        $sel->closeCursor();
        if ($ref === false) continue;
        $del->execute([$id]);
        $out[$id] = (string) $ref;
      }
      return $out;
    });
    if ($gone) {
      audit('request.delete', count($gone) === 1 ? 'request:' . key($gone) : 'requests', implode(', ', $gone));
      flash('ok', tp(count($gone), '{n} request deleted.', '{n} requests deleted.'));
    } else {
      flash('info', t('Those requests were already gone.'));
    }
    redirect($back);
  }
  $messages = [
    'contacted' => ['{n} request marked as contacted.', '{n} requests marked as contacted.'],
    'lost' => ['{n} request marked as lost.', '{n} requests marked as lost.'],
    'spam' => ['{n} request moved to spam.', '{n} requests moved to spam.'],
    'new' => ['{n} request moved back to New.', '{n} requests moved back to New.'],
  ];
  if (isset($messages[$act])) {
    $changed = req_set_status($ids, $act, $meId);
    if ($changed) {
      audit('request.status', count($changed) === 1 ? 'request:' . key($changed) : 'requests', '→ ' . $act . ': ' . implode(', ', $changed));
      flash('ok', tp(count($changed), $messages[$act][0], $messages[$act][1]));
    } else {
      flash('info', t('Nothing changed — they already had that status.'));
    }
  }
  redirect($back);
}

// A reference typed into the search box opens that request straight away.
if ($f['q'] !== '' && preg_match('/^[A-Za-z0-9-]{4,40}$/', $f['q'])) {
  $hit = db_value('SELECT id FROM requests WHERE ref = ? COLLATE NOCASE', [$f['q']]);
  if ($hit) redirect(url('request', ['id' => (int) $hit]));
}

// ── Counts per status (with the other filters applied) and this page's rows ───────────────────────────────
list($wNoStatus, $aNoStatus) = req_where($f, $meId, false);
$counts = array_fill_keys(array_keys(REQUEST_STATUSES), 0);
foreach (db_all("SELECT r.status, COUNT(*) AS n FROM requests r WHERE $wNoStatus GROUP BY r.status", $aNoStatus) as $c) {
  if (isset($counts[$c['status']])) $counts[$c['status']] = (int) $c['n'];
}
$allCount = array_sum($counts) - $counts['spam'];
$total = $f['status'] === '' ? $allCount : $counts[$f['status']];
$pages = max(1, (int) ceil($total / REQ_PER_PAGE));
if ($page > $pages) $page = $pages;

list($w, $a) = req_where($f, $meId);
$rows = $total > 0 ? db_all(
  "SELECT r.id, r.ref, r.kind, r.status, r.name, r.email, r.phone, r.company, r.country, r.travel_dates, r.travellers,
          r.interests, r.tour_id, r.tier, r.message, r.lang, r.assigned_to, r.follow_up_on, r.read_at, r.created_at,
          u.name AS assignee
     FROM requests r LEFT JOIN users u ON u.id = r.assigned_to
    WHERE $w ORDER BY r.created_at DESC, r.id DESC LIMIT " . REQ_PER_PAGE . ' OFFSET ' . (($page - 1) * REQ_PER_PAGE),
  $a
) : [];
$everything = $total > 0 || req_has_filters($f) || $f['status'] !== '' ? 1 : (int) db_value('SELECT COUNT(*) FROM requests');
$newWaiting = (int) db_value("SELECT COUNT(*) FROM requests WHERE status = 'new'");

ob_start();

// Status tabs
$tabs = ['' => 'All'] + REQUEST_STATUSES;
if ($everything): // Day one (nothing received yet): just the welcome card, no empty tabs and filters.
?>
<nav class="tabs req-tabs" aria-label="<?= h(t('Status')) ?>">
<?php foreach ($tabs as $key => $label):
  $n = $key === '' ? $allCount : $counts[$key];
  $active = $f['status'] === (string) $key;
  $href = url('requests', req_params($f, ['status' => $key])); ?>
  <a class="tab<?= $active ? ' is-active' : '' ?>" href="<?= h($href) ?>"<?= $active ? ' aria-current="page"' : '' ?>><?= h(t($label)) ?> <span class="tab__count"><?= h(number_format($n)) ?></span></a>
<?php endforeach; ?>
</nav>

<form class="toolbar req-toolbar" method="get" action="index.php" role="search">
  <input type="hidden" name="p" value="requests">
  <?php if ($f['status'] !== ''): ?><input type="hidden" name="status" value="<?= h($f['status']) ?>"><?php endif; ?>
  <div class="toolbar__search search">
    <?= icon('search') ?>
    <label class="sr-only" for="rq-q"><?= h(t('Search requests')) ?></label>
    <input class="input" type="search" id="rq-q" name="q" value="<?= h($f['q']) ?>" placeholder="<?= h(t('Name, email, phone, reference…')) ?>" autocomplete="off" enterkeyhint="search">
  </div>
  <div class="toolbar__group">
    <label class="sr-only" for="rq-kind"><?= h(t('Kind of request')) ?></label>
    <select class="select" id="rq-kind" name="kind" data-autosubmit>
      <option value=""><?= h(t('All kinds')) ?></option>
      <?php foreach (REQUEST_KINDS as $k => $label): ?>
        <option value="<?= h($k) ?>"<?= $f['kind'] === $k ? ' selected' : '' ?>><?= h(t($label)) ?></option>
      <?php endforeach; ?>
    </select>
    <label class="check req-filter"><input type="checkbox" name="mine" value="1" data-autosubmit<?= $f['mine'] ? ' checked' : '' ?>><span class="check__box"><?= icon('check') ?></span><span class="check__label"><?= h(t('Assigned to me')) ?></span></label>
    <label class="check req-filter"><input type="checkbox" name="due" value="1" data-autosubmit<?= $f['due'] ? ' checked' : '' ?>><span class="check__box"><?= icon('check') ?></span><span class="check__label"><?= h(t('Follow-up due')) ?></span></label>
  </div>
  <span class="toolbar__spacer"></span>
  <button class="btn btn--secondary req-toolbar__go hide-sm" type="submit"><?= icon('search') ?><?= h(t('Search')) ?></button>
  <?php if (req_has_filters($f)): ?>
    <a class="btn btn--ghost" href="<?= h(url('requests', ['status' => $f['status']])) ?>"><?= icon('close') ?><?= h(t('Clear filters')) ?></a>
  <?php endif; ?>
</form>

<?php endif; ?>

<?php $spamDays = (int) setting('spam_retention_days');
if ($f['status'] === 'spam' && $total > 0): ?>
  <div class="callout callout--info req-callout"><?= icon('info') ?><p><?= h($spamDays > 0
    ? tp($spamDays, 'Spam is deleted automatically {n} day after it last changed.', 'Spam is deleted automatically {n} days after it last changed.')
    : t('Spam is kept until you delete it.')) ?></p></div>
<?php endif; ?>

<?php if (!$rows):
  if (!$everything): ?>
  <section class="card empty">
    <div class="empty__mark" aria-hidden="true"><?= icon('inbox') ?></div>
    <h2 class="empty__title"><?= h(t('No requests yet')) ?></h2>
    <p class="empty__text"><?= h(t('When someone sends a form on the website — a trip request, a message or a partner enquiry — it appears here, and you also get it by email.')) ?></p>
    <div class="btn-row btn-row--center"><a class="btn btn--secondary" href="../" target="_blank" rel="noopener"><?= icon('external') ?><?= h(t('View website')) ?></a></div>
  </section>
  <?php elseif (req_has_filters($f)): ?>
  <section class="card empty">
    <div class="empty__mark" aria-hidden="true"><?= icon('search') ?></div>
    <h2 class="empty__title"><?= h(t('Nothing matches')) ?></h2>
    <p class="empty__text"><?php
      $elsewhere = $f['status'] === '' ? $counts['spam'] : ($allCount + $counts['spam'] - $counts[$f['status']]);
      // Say what the active filter is about: only a search gets the "try other words" hint.
      $why = $f['q'] !== '' ? t('Try a different word or part of a phone number, or clear the filters.')
        : ($f['mine'] ? t('Nothing is assigned to you here right now.')
        : ($f['due'] ? t('No follow-ups are due here.') : t('There are no requests of this kind here.')));
      echo h($elsewhere > 0 ? tp($elsewhere, 'No requests here match, but {n} under another tab does — see the counts above.', 'No requests here match, but {n} under other tabs do — see the counts above.') : $why); ?></p>
    <div class="btn-row btn-row--center"><a class="btn btn--secondary" href="<?= h(url('requests', ['status' => $f['status']])) ?>"><?= icon('close') ?><?= h(t('Clear filters')) ?></a></div>
  </section>
  <?php else:
    $emptyText = [
      'new' => ['All caught up', 'There are no new requests waiting for a reply.'],
      'contacted' => ['None at the moment', 'Requests you’ve replied to but not yet sent a quote for appear here.'],
      'quoted' => ['None at the moment', 'Requests you’ve sent a price to appear here.'],
      'booked' => ['No bookings from requests yet', 'When a request turns into a booking, it appears here.'],
      'lost' => ['Nothing lost', 'Requests that didn’t turn into a trip appear here.'],
      'spam' => ['No spam', $spamDays > 0 ? 'Messages you mark as spam appear here and are deleted automatically.' : 'Messages you mark as spam appear here. They are kept until you delete them.'],
    ][$f['status']] ?? ['Nothing here', 'There are no requests with this status.']; ?>
  <section class="card empty">
    <div class="empty__mark" aria-hidden="true"><?= icon($f['status'] === 'new' ? 'check' : 'inbox') ?></div>
    <h2 class="empty__title"><?= h(t($emptyText[0])) ?></h2>
    <p class="empty__text"><?= h(t($emptyText[1])) ?></p>
    <div class="btn-row btn-row--center"><a class="btn btn--secondary" href="<?= h(url('requests')) ?>"><?= h(t('See all requests')) ?></a></div>
  </section>
  <?php endif; ?>
<?php else: ?>
<form method="post" action="<?= h(url('requests', req_params($f, ['page' => $page > 1 ? $page : null]))) ?>" class="card card--flush req-list">
  <?= csrf_field() ?>
  <div class="bulkbar req-bulkbar" data-bulk-show hidden>
    <label class="req-bulkbar__all"><input class="box" type="checkbox" data-check-all="ids[]"><span><?= h(t('All on this page')) ?></span></label>
    <?php $sel = explode('{n}', t('{n} selected'), 2); ?>
    <span class="bulkbar__count" aria-live="polite"><?= h($sel[0]) ?><span data-bulk-count>0</span><?= h($sel[1] ?? '') ?></span>
    <span class="req-bulkbar__btns">
    <?php if ($f['status'] === 'spam'): ?>
      <button class="btn btn--sm btn--secondary" type="submit" name="bulk" value="new" data-bulk><?= icon('refresh') ?><?= h(t('Not spam')) ?></button>
    <?php else: ?>
      <button class="btn btn--sm btn--secondary" type="submit" name="bulk" value="contacted" data-bulk><?= icon('check') ?><?= h(t('Mark contacted')) ?></button>
      <button class="btn btn--sm btn--secondary" type="submit" name="bulk" value="lost" data-bulk><?= h(t('Mark lost')) ?></button>
      <button class="btn btn--sm btn--secondary" type="submit" name="bulk" value="spam" data-bulk data-confirm="<?= h(t('Move the selected requests to spam?')) ?>"><?= icon('flag') ?><?= h(t('Spam')) ?></button>
    <?php endif; ?>
    <?php if ($owner): ?>
      <button class="btn btn--sm btn--danger-solid" type="submit" name="bulk" value="delete" data-bulk data-confirm="<?= h(t('Delete the selected requests for good? Their notes are deleted too. This can’t be undone.')) ?>"><?= icon('trash') ?><?= h(t('Delete')) ?></button>
    <?php endif; ?>
    </span>
  </div>
  <div class="table-wrap">
    <table class="table req-table">
      <thead><tr>
        <th class="check"><input class="box" type="checkbox" data-check-all="ids[]" aria-label="<?= h(t('Select all on this page')) ?>"></th>
        <th scope="col"><?= h(t('From')) ?></th>
        <th scope="col"><?= h(t('Request')) ?></th>
        <th scope="col" class="req-wide"><?= h(t('Travel')) ?></th>
        <th scope="col"><?= h(t('Status')) ?></th>
        <th scope="col"><?= h(t('Received')) ?></th>
      </tr></thead>
      <tbody>
      <?php foreach ($rows as $r):
        $href = url('request', req_params($f, ['id' => (int) $r['id']]));
        $who = req_display_name($r);
        $contact = trim((string) $r['email']) !== '' ? (string) $r['email'] : (string) $r['phone'];
        $summary = req_summary($r);
        $unread = $r['read_at'] === null || $r['read_at'] === '';
        $travel = trim((string) $r['travel_dates']);
        $party = trim((string) $r['travellers']); ?>
        <tr class="<?= $unread ? 'is-unread' : '' ?>" data-href="<?= h($href) ?>">
          <td class="check"><input class="box" type="checkbox" name="ids[]" value="<?= (int) $r['id'] ?>" aria-label="<?= h(t('Select {name}', ['name' => $who])) ?>"></td>
          <td class="cell-primary" data-label="<?= h(t('From')) ?>">
            <a class="cell-main" href="<?= h($href) ?>"><?= h($who) ?><?php if ($unread): ?><span class="sr-only"> (<?= h(t('unread')) ?>)</span><?php endif; ?></a>
            <span class="cell-sub req-contact"<?= $contact !== '' ? ' title="' . h($contact) . '"' : '' ?>><?php if ($contact !== '' && $contact !== $who): ?><?= h($contact) ?><span class="req-sm"> · </span><?php endif; ?><span class="req-sm"><?= h(fmt_ago($r['created_at'])) ?></span></span>
          </td>
          <td data-label="<?= h(t('Request')) ?>"><div class="req-cell">
            <?php if ($summary !== ''): ?><span class="req-cell__main"><?= h($summary) ?></span><?php endif; ?>
            <span class="req-cell__sub"><?= h(t(REQUEST_KINDS[$r['kind']] ?? 'Other')) ?> · <span class="mono"><?= h($r['ref']) ?></span><?php if ($travel !== ''): ?><span class="req-mid"> · <?= h($travel) ?></span><?php endif; ?></span>
          </div></td>
          <td class="req-wide" data-label="<?= h(t('Travel')) ?>"><?php if ($travel !== '' || $party !== ''): ?><div class="req-cell">
            <?php if ($travel !== ''): ?><span class="req-cell__main req-cell__main--plain"><?= h($travel) ?></span><?php endif; ?>
            <?php if ($party !== ''): ?><span class="req-cell__sub"><?= h($party) ?></span><?php endif; ?>
          </div><?php endif; ?></td>
          <td data-label="<?= h(t('Status')) ?>"><div class="req-status">
            <?= status_badge($r['status']) ?>
            <?php if (!empty($r['assignee'])): ?><span class="avatar avatar--sm req-assignee" title="<?= h(t('Assigned to {name}', ['name' => $r['assignee']])) ?>" aria-label="<?= h(t('Assigned to {name}', ['name' => $r['assignee']])) ?>" role="img"><?= h(initials($r['assignee'])) ?></span><?php endif; ?>
            <?= req_follow_html($r) ?>
          </div></td>
          <td class="nowrap req-received" data-label="<?= h(t('Received')) ?>"><time datetime="<?= h(str_replace(' ', 'T', (string) $r['created_at']) . 'Z') ?>" title="<?= h(fmt_date($r['created_at'], true)) ?>"><?= h(fmt_ago($r['created_at'])) ?></time></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</form>
<?= pager($total, $page, REQ_PER_PAGE, ['p' => 'requests'] + req_params($f)) ?>
<?php endif;

$actions = '';
if ($owner && $total > 0) {
  $actions = '<a class="btn btn--secondary" href="' . h(url('export', req_params($f, ['type' => 'requests']))) . '">' . icon('download') . h(t('Export CSV')) . '</a>';
}
$lead = $newWaiting > 0
  ? tp($newWaiting, '{n} new request is waiting for a reply.', '{n} new requests are waiting for a reply.')
  : t('Everything people send from the website’s forms.');
render(t('Requests'), ob_get_clean(), [
  'nav' => 'requests',
  'css' => ['requests.css'],
  'actions' => $actions,
  'lead' => $lead,
  'search' => '',
]);
