<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
/*
 * One request (?p=request&id=…): quick replies (email / WhatsApp / call), what they asked for, every field as
 * sent, status + assignment + follow-up date, the notes timeline, bookings made from it, previous/next within
 * the list it was opened from (the inbox filters travel along: see requests-lib.php), spam, unread, delete
 * (owners). Opening it marks it as read.
 */
require_once __DIR__ . '/requests-lib.php';
require_once __DIR__ . '/bookings-lib.php';
$me = require_login();
$meId = (int) $me['id'];
$owner = is_owner();
$id = get_int('id');
$f = req_filters();
$self = url('request', req_params($f, ['id' => $id]));
$listUrl = url('requests', req_params($f));

$row = $id > 0 ? db_row('SELECT * FROM requests WHERE id = ?', [$id]) : null;
if (!$row) {
  render_error(404, t('Request not found'), t('This request no longer exists — it may have been deleted.'),
    '<div class="btn-row btn-row--center"><a class="btn btn--secondary" href="' . h(url('requests')) . '">' . icon('inbox') . h(t('Back to requests')) . '</a></div>');
}

// ── Changes (POST → redirect) ──────────────────────────────────────────────────────────────────────────────
if (is_post()) {
  csrf_check();
  $act = post('action');

  if ($act === 'save') {
    $status = post('status');
    if (!isset(REQUEST_STATUSES[$status])) $status = (string) $row['status'];
    $oldAssigned = $row['assigned_to'] === null ? null : (int) $row['assigned_to'];
    $assignRaw = post('assigned_to');
    $assigned = null;
    if ($assignRaw !== '') {
      $ok = preg_match('/^\d{1,9}$/', $assignRaw) && db_value('SELECT 1 FROM users WHERE id = ? AND (active = 1 OR id = ?)', [(int) $assignRaw, (int) $oldAssigned]);
      if (!$ok) {
        flash('error', t('Please choose someone from the team.'));
        redirect($self);
      }
      $assigned = (int) $assignRaw;
    }
    $followRaw = post('follow_up_on');
    $follow = req_valid_date($followRaw);
    if ($followRaw !== '' && $follow === '') {
      flash('error', t('Please choose the follow-up date from the calendar.'));
      redirect($self);
    }
    $oldFollow = (string) $row['follow_up_on'];
    $changes = [];
    if ($status !== $row['status']) $changes[] = 'status ' . $row['status'] . ' → ' . $status;
    if ($assigned !== $oldAssigned) $changes[] = 'assigned ' . ($assigned === null ? 'nobody' : 'user:' . $assigned);
    if ($follow !== $oldFollow) $changes[] = 'follow-up ' . ($follow === '' ? 'cleared' : $follow);
    if (!$changes) {
      flash('info', t('Nothing to save — no changes.'));
      redirect($self);
    }
    db_tx(function (PDO $pdo) use ($id, $row, $status, $assigned, $oldAssigned, $follow, $meId) {
      $now = now_utc();
      $pdo->prepare('UPDATE requests SET status = ?, assigned_to = ?, follow_up_on = ?, updated_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ?')
        ->execute([$status, $assigned, $follow === '' ? null : $follow, $now, $now, $id]);
      $note = $pdo->prepare('INSERT INTO notes (request_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)');
      if ($status !== $row['status']) $note->execute([$id, $meId, 'status', req_status_note((string) $row['status'], $status), $now]);
      if ($assigned !== $oldAssigned) {
        $who = $assigned === null ? '' : (string) db_value('SELECT name FROM users WHERE id = ?', [$assigned]);
        $note->execute([$id, $meId, 'system', $assigned === null ? 'No longer assigned to anyone' : 'Assigned to ' . $who, $now]);
      }
    });
    audit('request.update', 'request:' . $id, $row['ref'] . ': ' . implode('; ', $changes));
    flash('ok', $follow !== '' && $follow !== $oldFollow ? t('Saved. Follow-up on {date}.', ['date' => fmt_date($follow)]) : t('Saved.'));
    redirect($self);
  }

  if ($act === 'contacted') {
    if (req_set_status([$id], 'contacted', $meId)) {
      audit('request.status', 'request:' . $id, $row['ref'] . ': ' . $row['status'] . ' → contacted');
      flash('ok', t('Marked as contacted.'));
    }
    redirect($self);
  }

  if ($act === 'note') {
    $body = mfs_cut(post('body'), 5000);
    if ($body === '') {
      flash('error', t('Please write the note first.'));
      redirect($self);
    }
    $kind = post('note_kind') === 'email' ? 'email' : 'note';
    $alsoContacted = $kind === 'email' && $row['status'] === 'new';
    db_tx(function (PDO $pdo) use ($id, $meId, $kind, $body, $alsoContacted) {
      $now = now_utc();
      $pdo->prepare('INSERT INTO notes (request_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)')->execute([$id, $meId, $kind, $body, $now]);
      $pdo->prepare('UPDATE requests SET updated_at = ? WHERE id = ?')->execute([$now, $id]);
      if ($alsoContacted) req_set_status([$id], 'contacted', $meId);
    });
    audit($kind === 'email' ? 'request.email_note' : 'request.note', 'request:' . $id, $row['ref'] . ': ' . excerpt($body, 80));
    if ($alsoContacted) audit('request.status', 'request:' . $id, $row['ref'] . ': new → contacted');
    flash('ok', $alsoContacted ? t('Saved, and marked as contacted.') : t('Note added.'));
    redirect($self);
  }

  if ($act === 'delete_note') {
    $nid = (int) (preg_match('/^\d{1,12}$/', post('note_id')) ? post('note_id') : 0);
    $n = db_row('SELECT id, user_id, kind, body FROM notes WHERE id = ? AND request_id = ?', [$nid, $id]);
    if (!$n || !in_array($n['kind'], ['note', 'email'], true)) {
      flash('info', t('That note was already deleted.'));
    } elseif (!$owner && (int) $n['user_id'] !== $meId) {
      flash('error', t('You can only delete your own notes.'));
    } else {
      db_exec('DELETE FROM notes WHERE id = ?', [$nid]);
      audit('request.note_delete', 'request:' . $id, $row['ref'] . ': ' . excerpt($n['body'], 80));
      flash('ok', t('Note deleted.'));
    }
    redirect($self);
  }

  if ($act === 'spam' || $act === 'notspam') {
    $to = $act === 'spam' ? 'spam' : 'new';
    if (req_set_status([$id], $to, $meId)) audit('request.status', 'request:' . $id, $row['ref'] . ': ' . $row['status'] . ' → ' . $to);
    if ($to === 'spam') {
      flash('ok', t('{ref} moved to spam.', ['ref' => $row['ref']]));
      redirect($listUrl);
    }
    flash('ok', t('Moved back to New.'));
    redirect($self);
  }

  if ($act === 'unread') {
    db_exec('UPDATE requests SET read_at = NULL WHERE id = ?', [$id]);
    audit('request.unread', 'request:' . $id, $row['ref']);
    flash('ok', t('{ref} marked as unread.', ['ref' => $row['ref']]));
    redirect($listUrl);
  }

  if ($act === 'delete') {
    if (!$owner) render_error(403, t('For owners only'), t('Only the owners can delete requests. You can mark it as lost or spam instead.'));
    db_exec('DELETE FROM requests WHERE id = ?', [$id]);
    audit('request.delete', 'request:' . $id, $row['ref'] . ' ' . req_display_name($row));
    flash('ok', t('Request {ref} deleted.', ['ref' => $row['ref']]));
    redirect($listUrl);
  }

  redirect($self);
}

// ── Reading it ─────────────────────────────────────────────────────────────────────────────────────────────
if ($row['read_at'] === null || $row['read_at'] === '') {
  db_exec('UPDATE requests SET read_at = ? WHERE id = ? AND read_at IS NULL', [now_utc(), $id]);
}

$fields = req_fields($row);
$name = req_display_name($row);
$rawEmail = trim((string) $row['email']);
$email = valid_email($rawEmail);
$phone = trim((string) $row['phone']);
$mailto = mailto_href($email, 'Re: ' . $row['ref'] . ' — Million First Steps');
$tel = tel_href($phone);
$wa = whatsapp_href($phone);
$country = req_country($row, $fields);
$lang = strtolower((string) $row['lang']);
$langName = req_lang_name($lang);
$kindLabel = t(REQUEST_KINDS[$row['kind']] ?? 'Other');
$open = in_array($row['status'], REQ_OPEN_STATUSES, true);

$notes = db_all('SELECT n.id, n.user_id, n.kind, n.body, n.created_at, u.name AS who
  FROM notes n LEFT JOIN users u ON u.id = n.user_id WHERE n.request_id = ? ORDER BY n.created_at DESC, n.id DESC', [$id]);
$bookings = db_all('SELECT id, ref, status, tour_id, tour_name, start_date, end_date, total_price FROM bookings WHERE request_id = ? ORDER BY created_at, id', [$id]);
$team = req_team($row['assigned_to'] === null ? null : (int) $row['assigned_to']);

// Previous / next in the list this was opened from (newest first).
list($w, $a) = req_where($f, $meId);
$c = (string) $row['created_at'];
$newer = db_value("SELECT r.id FROM requests r WHERE $w AND (r.created_at > ? OR (r.created_at = ? AND r.id > ?)) ORDER BY r.created_at ASC, r.id ASC LIMIT 1", array_merge($a, [$c, $c, $id]));
$older = db_value("SELECT r.id FROM requests r WHERE $w AND (r.created_at < ? OR (r.created_at = ? AND r.id < ?)) ORDER BY r.created_at DESC, r.id DESC LIMIT 1", array_merge($a, [$c, $c, $id]));
$pos = 0;
$inList = (int) db_value("SELECT COUNT(*) FROM requests r WHERE $w AND r.id = ?", array_merge($a, [$id])) > 0;
if ($inList) {
  $pos = 1 + (int) db_value("SELECT COUNT(*) FROM requests r WHERE $w AND (r.created_at > ? OR (r.created_at = ? AND r.id > ?))", array_merge($a, [$c, $c, $id]));
  $listTotal = (int) db_value("SELECT COUNT(*) FROM requests r WHERE $w", $a);
  $pg = (int) ceil($pos / REQ_PER_PAGE);
  if ($pg > 1) $listUrl = url('requests', req_params($f, ['page' => $pg]));
}

// What they asked for: the facts worth seeing at a glance.
$facts = [];
if (trim((string) $row['travel_dates']) !== '') $facts[] = ['calendar', t('When'), (string) $row['travel_dates'], ''];
if (trim((string) $row['travellers']) !== '') $facts[] = ['users', t('Travellers'), (string) $row['travellers'], ''];
$tours = tours();
$tourId = (string) $row['tour_id'];
$tier = (string) $row['tier'];
$knownTour = $tourId !== '' && isset($tours[$tourId]);
if ($tourId !== '') {
  $facts[] = ['map-pin', t('Tour'), tour_name($tourId) . ($tier !== '' ? ' · ' . tier_name($tier) : ''), $knownTour && preg_match('/^[a-z0-9-]{1,80}$/', $tourId) ? '../tours/' . $tourId : ''];
}
$interests = trim((string) $row['interests']);
if ($interests !== '' && $tourId !== '') {
  // Only repeat the interests when they say more than the tour's name and style.
  $strip = [];
  foreach (catalog()['tours'] as $ct) if ((string) $ct['id'] === $tourId) foreach (mfs_all_names($ct) as $nm) array_push($strip, $nm, preg_replace('/^the\s+/i', '', $nm));
  foreach (catalog()['tiers'] as $ct) if ((string) $ct['id'] === $tier) $strip = array_merge($strip, mfs_all_names($ct));
  $rest = str_ireplace(array_filter($strip, 'strlen'), '', str_replace('’', "'", $interests));
  if (!preg_match('/[\p{L}\p{N}]/u', (string) $rest)) $interests = '';
}
if ($interests !== '') $facts[] = ['star', t('Would like to see'), $interests, ''];
if (trim((string) $row['company']) !== '') $facts[] = ['suitcase', t('Company'), (string) $row['company'], ''];
foreach (['c-tp' => ['note', 'Topic'], 'website' => ['link', 'Website'], 'volume' => ['chart', 'Expected volume']] as $fname => $meta) {
  $v = req_field($fields, $fname);
  if ($v !== '') $facts[] = [$meta[0], t($meta[1]), $v, ''];
}
$message = trim((string) $row['message']);

// Website prices for their party, to reply with a figure straight away.
$priceHint = '';
$party = req_party_size($row['travellers']);
if ($knownTour && $party > 0) {
  $bits = [];
  foreach (tiers() as $tid => $tname) {
    if ($tier !== '' && $tid !== $tier) continue;
    $p = suggest_price($tourId, $tid, $party);
    if ($p > 0) $bits[] = '<span class="req-price__item"><span class="req-price__tier">' . h(tier_name($tid)) . '</span> <span class="req-price__sum">' . h(fmt_money($p)) . '</span></span>';
  }
  if ($bits) {
    $priceHint = '<div class="req-price">' . icon('euro') . '<div><p class="req-price__title">' . h(tp($party, 'Website price for {n} traveller', 'Website price for {n} travellers')) . '</p>'
      . '<p class="req-price__list">' . implode('', $bits) . '</p></div></div>';
  }
}

$dateField = function (int $days) {
  return req_days_from_today($days);
};

ob_start(); ?>
<div class="req-layout">
<div class="req-main">

  <section class="card req-hero" aria-label="<?= h(t('Reply')) ?>">
    <div class="req-hero__tags">
      <?= status_badge($row['status']) ?>
      <span class="pill pill--plain pill--muted"><?= h($kindLabel) ?></span>
      <?php if ($langName !== ''): ?><span class="req-hero__fact"><?= icon('globe') ?><?= h($langName) ?></span><?php endif; ?>
      <?php if ($country !== ''): ?><span class="req-hero__fact"><?= icon('map-pin') ?><?= h($country) ?></span><?php endif; ?>
    </div>

    <?php if ($mailto !== '' || $tel !== '' || $wa !== ''): ?>
    <div class="req-reply">
      <?php if ($mailto !== ''): ?><a class="btn btn--primary btn--lg req-reply__btn" href="<?= h($mailto) ?>"><?= icon('mail') ?><?= h(t('Email')) ?></a><?php endif; ?>
      <?php if ($wa !== ''): ?><a class="btn btn--secondary btn--lg req-reply__btn req-reply__btn--wa" href="<?= h($wa) ?>" target="_blank" rel="noopener noreferrer"><?= icon('whatsapp') ?><?= h(t('WhatsApp')) ?></a><?php endif; ?>
      <?php if ($tel !== ''): ?><a class="btn btn--secondary btn--lg req-reply__btn" href="<?= h($tel) ?>"><?= icon('phone') ?><?= h(t('Call')) ?></a><?php endif; ?>
    </div>
    <?php endif; ?>

    <dl class="req-hero__contact">
      <?php if ($rawEmail !== ''): ?>
      <div class="req-contact-row">
        <dt class="sr-only"><?= h(t('Email')) ?></dt>
        <dd><span class="req-contact-row__icon"><?= icon('mail') ?></span><span class="req-contact-row__val"><?= h($rawEmail) ?></span>
          <?php if ($email !== ''): ?><button type="button" class="btn btn--ghost btn--icon req-copy" data-copy="<?= h($email) ?>" data-copied="<?= h(t('Copied')) ?>" aria-label="<?= h(t('Copy email')) ?>" title="<?= h(t('Copy email')) ?>"><?= icon('copy') ?></button>
          <?php else: ?><span class="pill pill--spam pill--plain"><?= h(t('Not a valid address')) ?></span><?php endif; ?>
        </dd>
      </div>
      <?php endif; ?>
      <?php if ($phone !== ''): ?>
      <div class="req-contact-row">
        <dt class="sr-only"><?= h(t('Phone')) ?></dt>
        <dd><span class="req-contact-row__icon"><?= icon('phone') ?></span><span class="req-contact-row__val"><?= h($phone) ?></span>
          <button type="button" class="btn btn--ghost btn--icon req-copy" data-copy="<?= h($phone) ?>" data-copied="<?= h(t('Copied')) ?>" aria-label="<?= h(t('Copy phone number')) ?>" title="<?= h(t('Copy phone number')) ?>"><?= icon('copy') ?></button>
        </dd>
      </div>
      <?php endif; ?>
    </dl>
    <?php if ($rawEmail === '' && $phone === ''): ?>
      <div class="callout callout--warn"><?= icon('alert') ?><p><?= h(t('No email address or phone number came with this request.')) ?></p></div>
    <?php elseif ($phone !== '' && $wa === '' && $tel !== ''): ?>
      <p class="req-hero__hint"><?= h(t('WhatsApp needs a number with its country code (+…), which this one doesn’t have.')) ?></p>
    <?php endif; ?>
    <?php if ($lang !== '' && $lang !== 'en' && isset(REQ_LANG_NAMES[$lang])): ?>
      <p class="req-hero__hint"><?= icon('globe') ?><span><?= h(t('They used the website in {language} — a reply in that language will be appreciated.', ['language' => t(REQ_LANG_NAMES[$lang])])) ?></span></p>
    <?php endif; ?>

    <?php if ($row['status'] === 'new'): ?>
    <form method="post" action="<?= h($self) ?>" class="req-hero__done" data-once>
      <?= csrf_field() ?><input type="hidden" name="action" value="contacted">
      <span class="req-hero__done-text"><?= h(t('Replied already?')) ?></span>
      <button class="btn btn--secondary" type="submit"><?= icon('check') ?><?= h(t('Mark as contacted')) ?></button>
    </form>
    <?php endif; ?>
  </section>

  <section class="card req-ask">
    <div class="card__head"><div><h2 class="card__title"><?= h(t('What they’re asking for')) ?></h2>
      <p class="card__sub"><?php $ago = fmt_ago($row['created_at']); $full = fmt_date($row['created_at'], true);
        echo h(t('Received {when}', ['when' => $ago]) . ($ago !== $full ? ' · ' . $full : '')); ?></p></div></div>
    <div class="card__body">
      <?php if ($facts): ?>
      <ul class="req-facts">
        <?php foreach ($facts as $fa): ?>
        <li class="req-fact">
          <span class="req-fact__icon" aria-hidden="true"><?= icon($fa[0]) ?></span>
          <span class="req-fact__text"><span class="req-fact__label"><?= h($fa[1]) ?></span>
            <span class="req-fact__value"><?= h($fa[2]) ?></span>
            <?php if ($fa[3] !== ''): ?><a class="req-fact__link" href="<?= h($fa[3]) ?>" target="_blank" rel="noopener"><?= h(t('See it on the website')) ?> <?= icon('external') ?></a><?php endif; ?>
          </span>
        </li>
        <?php endforeach; ?>
      </ul>
      <?php endif; ?>
      <?= $priceHint ?>
      <?php if ($message !== ''): ?>
        <figure class="req-message">
          <figcaption class="req-message__label"><?= icon('note') ?><?= h(t('Their message')) ?></figcaption>
          <blockquote class="req-message__text"<?= preg_match('/^[a-z]{2}$/', $lang) ? ' lang="' . h($lang) . '"' : '' ?>><?= h($message) ?></blockquote>
        </figure>
      <?php elseif (!$facts): ?>
        <p class="muted"><?= h(t('They didn’t write anything beyond their contact details.')) ?></p>
      <?php endif; ?>
    </div>
  </section>

  <section class="card req-notes" id="notes">
    <div class="card__head"><div><h2 class="card__title"><?= h(t('Notes and history')) ?></h2>
      <p class="card__sub"><?= h(t('Only the team sees these.')) ?></p></div></div>
    <div class="card__body">
      <form method="post" action="<?= h($self) ?>#notes" class="form req-note-form" data-once>
        <?= csrf_field() ?><input type="hidden" name="action" value="note">
        <div class="field">
          <label class="sr-only" for="note-body"><?= h(t('New note')) ?></label>
          <textarea class="textarea" id="note-body" name="body" rows="3" maxlength="5000" required placeholder="<?= h(t('Add a note for the team — what you discussed, what you sent, what’s next…')) ?>"></textarea>
        </div>
        <?php if ($row['status'] === 'new'): ?><p class="field__help"><?= h(t('“I replied by email” also marks the request as contacted.')) ?></p><?php endif; ?>
        <div class="req-note-form__foot">
          <div class="choice-row" role="radiogroup" aria-label="<?= h(t('Kind of note')) ?>">
            <label class="choice"><input type="radio" name="note_kind" value="note" checked><span class="choice__box"><?= icon('note') ?><?= h(t('Note')) ?></span></label>
            <label class="choice"><input type="radio" name="note_kind" value="email"><span class="choice__box"><?= icon('mail') ?><?= h(t('I replied by email')) ?></span></label>
          </div>
          <button class="btn btn--primary" type="submit"><?= icon('plus') ?><?= h(t('Add note')) ?></button>
        </div>
      </form>

      <ol class="timeline req-timeline">
        <?php foreach ($notes as $n):
          $kind = in_array($n['kind'], ['note', 'status', 'system', 'email'], true) ? $n['kind'] : 'system';
          $dot = ['note' => 'note', 'status' => 'refresh', 'system' => 'info', 'email' => 'mail'][$kind];
          $who = $n['who'] !== null && $n['who'] !== '' ? (string) $n['who'] : ($n['user_id'] === null && $kind === 'system' ? t('System') : t('Former team member'));
          $canDelete = in_array($kind, ['note', 'email'], true) && ($owner || (int) $n['user_id'] === $meId); ?>
        <li class="tl-item tl-item--<?= h($kind) ?>">
          <span class="tl-item__dot" aria-hidden="true"><?= icon($dot) ?></span>
          <div class="tl-item__head">
            <span class="tl-item__who"><?= h($who) ?></span>
            <?php if ($kind === 'email'): ?><span class="pill pill--wine pill--plain req-tl-tag"><?= h(t('Replied by email')) ?></span><?php endif; ?>
            <time class="tl-item__time" datetime="<?= h(str_replace(' ', 'T', (string) $n['created_at']) . 'Z') ?>" title="<?= h(fmt_date($n['created_at'], true)) ?>"><?= h(fmt_ago($n['created_at'])) ?></time>
            <?php if ($canDelete): ?>
            <form method="post" action="<?= h($self) ?>#notes" class="req-tl-del">
              <?= csrf_field() ?><input type="hidden" name="action" value="delete_note"><input type="hidden" name="note_id" value="<?= (int) $n['id'] ?>">
              <button class="btn btn--ghost btn--icon btn--sm" type="submit" data-confirm="<?= h(t('Delete this note?')) ?>" aria-label="<?= h(t('Delete note')) ?>" title="<?= h(t('Delete note')) ?>"><?= icon('trash') ?></button>
            </form>
            <?php endif; ?>
          </div>
          <div class="tl-item__body"><?= h(req_note_text($kind, (string) $n['body'])) ?></div>
        </li>
        <?php endforeach; ?>
        <li class="tl-item tl-item--system">
          <span class="tl-item__dot" aria-hidden="true"><?= icon('inbox') ?></span>
          <div class="tl-item__head"><span class="tl-item__who"><?= h(t('Website')) ?></span>
            <time class="tl-item__time" datetime="<?= h(str_replace(' ', 'T', $c) . 'Z') ?>" title="<?= h(fmt_date($c, true)) ?>"><?= h(fmt_ago($c)) ?></time></div>
          <div class="tl-item__body"><?= h(trim((string) $row['kind_label']) !== '' ? t('Request received: {form}', ['form' => t((string) $row['kind_label'])]) : t('Request received from the website')) ?></div>
        </li>
      </ol>
    </div>
  </section>

  <section class="card req-sent">
    <div class="card__head"><div><h2 class="card__title"><?= h(t('Everything they sent')) ?></h2>
      <p class="card__sub"><?= h(t('Every field of the form, in order, exactly as it arrived.')) ?></p></div></div>
    <div class="card__body">
      <dl class="kv">
        <?php foreach ($fields as $fi): ?>
        <div class="kv__row"><dt class="kv__key"><?= h(t($fi['l'])) ?></dt><dd class="kv__val"><?= h(in_array($fi['v'], ['Yes', 'No'], true) ? t($fi['v']) : $fi['v']) ?></dd></div>
        <?php endforeach; ?>
        <?php if (!$fields): ?><div class="kv__row"><dt class="kv__key"><?= h(t('Form fields')) ?></dt><dd class="kv__val muted"><?= h(t('None were stored.')) ?></dd></div><?php endif; ?>
      </dl>
      <dl class="kv req-sent__meta">
        <div class="kv__row"><dt class="kv__key"><?= h(t('Reference')) ?></dt><dd class="kv__val"><span class="copy-field"><span class="mono"><?= h($row['ref']) ?></span><button type="button" class="btn btn--ghost btn--icon btn--sm" data-copy="<?= h($row['ref']) ?>" data-copied="<?= h(t('Copied')) ?>" aria-label="<?= h(t('Copy reference')) ?>"><?= icon('copy') ?></button></span></dd></div>
        <?php if (trim((string) $row['kind_label']) !== ''): ?><div class="kv__row"><dt class="kv__key"><?= h(t('Form')) ?></dt><dd class="kv__val"><?= h(t((string) $row['kind_label'])) ?></dd></div><?php endif; ?>
        <?php if (trim((string) $row['page']) !== ''): ?><div class="kv__row"><dt class="kv__key"><?= h(t('Sent from page')) ?></dt><dd class="kv__val mono"><?= h($row['page']) ?></dd></div><?php endif; ?>
        <?php if ($langName !== ''): ?><div class="kv__row"><dt class="kv__key"><?= h(t('Website language')) ?></dt><dd class="kv__val"><?= h($langName) ?></dd></div><?php endif; ?>
        <div class="kv__row"><dt class="kv__key"><?= h(t('Received')) ?></dt><dd class="kv__val"><?= h(fmt_date($row['created_at'], true)) ?></dd></div>
        <?php if ($row['updated_at'] !== $row['created_at']): ?><div class="kv__row"><dt class="kv__key"><?= h(t('Last change')) ?></dt><dd class="kv__val"><?= h(fmt_date($row['updated_at'], true)) ?></dd></div><?php endif; ?>
      </dl>
    </div>
  </section>

</div>
<aside class="req-aside" aria-label="<?= h(t('Manage this request')) ?>">

  <form method="post" action="<?= h($self) ?>" class="card form req-manage" data-once>
    <?= csrf_field() ?><input type="hidden" name="action" value="save">
    <div class="card__head"><div><h2 class="card__title"><?= h(t('Status and follow-up')) ?></h2>
      <p class="card__sub"><?= h(t('Last change {when}', ['when' => fmt_ago($row['updated_at'])])) ?></p></div></div>
    <div class="card__body">
      <div class="field">
        <label class="field__label" for="rq-status"><?= h(t('Status')) ?></label>
        <select class="select" id="rq-status" name="status">
          <?php foreach (REQUEST_STATUSES as $k => $label): ?><option value="<?= h($k) ?>"<?= $row['status'] === $k ? ' selected' : '' ?>><?= h(t($label)) ?></option><?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="rq-assigned"><?= h(t('Assigned to')) ?></label>
        <select class="select" id="rq-assigned" name="assigned_to">
          <option value=""><?= h(t('Nobody yet')) ?></option>
          <?php foreach ($team as $u):
            $label = (int) $u['id'] === $meId ? t('{name} (you)', ['name' => $u['name']]) : (string) $u['name'];
            if (!(int) $u['active']) $label = t('{name} (no longer in the team)', ['name' => $u['name']]); ?>
            <option value="<?= (int) $u['id'] ?>"<?= (int) $row['assigned_to'] === (int) $u['id'] && $row['assigned_to'] !== null ? ' selected' : '' ?>><?= h($label) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="rq-follow"><?= h(t('Follow up on')) ?> <span class="field__opt"><?= h(t('optional')) ?></span></label>
        <input class="input" type="date" id="rq-follow" name="follow_up_on" value="<?= h((string) $row['follow_up_on']) ?>" min="2000-01-01" max="2100-12-31">
        <div class="chips req-quick" data-date-target="#rq-follow" hidden>
          <button type="button" class="chip" data-date="<?= h($dateField(1)) ?>"><?= h(t('Tomorrow')) ?></button>
          <button type="button" class="chip" data-date="<?= h($dateField(3)) ?>"><?= h(t('In 3 days')) ?></button>
          <button type="button" class="chip" data-date="<?= h($dateField(7)) ?>"><?= h(t('In a week')) ?></button>
          <?php if ((string) $row['follow_up_on'] !== ''): ?><button type="button" class="chip" data-date=""><?= h(t('No date')) ?></button><?php endif; ?>
        </div>
        <?php if ($open && (string) $row['follow_up_on'] !== ''): ?><p class="field__help"><?= req_follow_html($row) ?></p><?php endif; ?>
      </div>
    </div>
    <div class="card__foot"><button class="btn btn--primary btn--block" type="submit"><?= icon('check') ?><?= h(t('Save')) ?></button></div>
  </form>

  <?php if ($row['status'] !== 'spam'): ?>
  <section class="card req-booking">
    <div class="card__head"><div><h2 class="card__title"><?= h(t('Booking')) ?></h2>
      <p class="card__sub"><?= h($bookings ? tp(count($bookings), '{n} booking made from this request', '{n} bookings made from this request') : t('Ready to confirm? The booking form opens with these details filled in.')) ?></p></div></div>
    <?php if ($bookings): ?>
    <ul class="list">
      <?php foreach ($bookings as $b):
        $dates = $b['start_date'] ? fmt_date($b['start_date']) . ($b['end_date'] && $b['end_date'] !== $b['start_date'] ? ' – ' . fmt_date($b['end_date']) : '') : t('No dates yet'); ?>
      <li><a class="list__item" href="<?= h(url('booking', ['id' => (int) $b['id']])) ?>">
        <span class="list__icon"><?= icon('suitcase') ?></span>
        <span class="list__main"><span class="list__title"><?= h($b['ref']) ?> · <?= h(bk_tour_label($b, false)) ?></span>
          <span class="list__meta"><?= h($dates) ?> · <?= h(fmt_money($b['total_price'])) ?></span></span>
        <span class="list__aside"><?= status_badge($b['status'], 'booking') ?></span></a></li>
      <?php endforeach; ?>
    </ul>
    <?php endif; ?>
    <div class="card__foot"><a class="btn <?= $bookings ? 'btn--secondary' : 'btn--primary' ?> btn--block" href="<?= h(url('booking', ['new' => 1, 'from' => $id])) ?>"><?= icon('plus') ?><?= h($bookings ? t('Create another booking') : t('Create booking')) ?></a></div>
  </section>
  <?php endif; ?>

  <section class="card req-more">
    <div class="card__head"><h2 class="card__title"><?= h(t('More')) ?></h2></div>
    <div class="card__body">
      <form method="post" action="<?= h($self) ?>"><?= csrf_field() ?><input type="hidden" name="action" value="unread">
        <button class="btn btn--secondary btn--block" type="submit"><?= icon('eye-off') ?><?= h(t('Mark as unread')) ?></button></form>
      <?php if ($row['status'] === 'spam'): ?>
      <form method="post" action="<?= h($self) ?>"><?= csrf_field() ?><input type="hidden" name="action" value="notspam">
        <button class="btn btn--secondary btn--block" type="submit"><?= icon('refresh') ?><?= h(t('Not spam — move back to New')) ?></button></form>
      <?php else: ?>
      <form method="post" action="<?= h($self) ?>" data-confirm="<?= h(t('Move this request to spam? Spam is deleted automatically after a while.')) ?>"><?= csrf_field() ?><input type="hidden" name="action" value="spam">
        <button class="btn btn--secondary btn--block" type="submit"><?= icon('flag') ?><?= h(t('Mark as spam')) ?></button></form>
      <?php endif; ?>
      <?php if ($owner): ?>
      <form method="post" action="<?= h($self) ?>" data-confirm="<?= h(t('Delete this request for good? Its notes are deleted too; bookings made from it are kept. This can’t be undone.')) ?>"><?= csrf_field() ?><input type="hidden" name="action" value="delete">
        <button class="btn btn--danger btn--block" type="submit"><?= icon('trash') ?><?= h(t('Delete request')) ?></button></form>
      <?php endif; ?>
    </div>
  </section>

</aside>
</div>
<?php
$body = ob_get_clean();

$navHtml = '<nav class="req-pn" aria-label="' . h(t('Other requests')) . '">';
if ($pos) $navHtml .= '<span class="req-pn__pos">' . h(t('{n} of {total}', ['n' => number_format($pos), 'total' => number_format($listTotal)])) . '</span>';
$navHtml .= $newer
  ? '<a class="btn btn--secondary" href="' . h(url('request', req_params($f, ['id' => (int) $newer]))) . '" rel="prev" title="' . h(t('Newer request')) . '">' . icon('chevron-left') . '<span>' . h(t('Previous')) . '</span></a>'
  : '<span class="btn btn--secondary" aria-disabled="true">' . icon('chevron-left') . '<span>' . h(t('Previous')) . '</span></span>';
$navHtml .= $older
  ? '<a class="btn btn--secondary" href="' . h(url('request', req_params($f, ['id' => (int) $older]))) . '" rel="next" title="' . h(t('Older request')) . '"><span>' . h(t('Next')) . '</span>' . icon('chevron-right') . '</a>'
  : '<span class="btn btn--secondary" aria-disabled="true"><span>' . h(t('Next')) . '</span>' . icon('chevron-right') . '</span>';
$navHtml .= '</nav>';

$listLabel = $f['status'] !== '' ? t(REQUEST_STATUSES[$f['status']]) : t('Requests');
$crumbs = [[t('Requests'), url('requests')]];
if ($f['status'] !== '' || req_has_filters($f)) $crumbs[] = [$f['status'] !== '' ? $listLabel : t('Search results'), $listUrl];
$crumbs[] = [(string) $row['ref'], ''];

render($name, $body, [
  'nav' => 'requests',
  'css' => ['requests.css'],
  'js' => ['requests.js'],
  'crumbs' => $crumbs,
  'lead' => $kindLabel . ' · ' . t('received {when}', ['when' => fmt_ago($row['created_at'])]),
  'actions' => $navHtml,
]);
