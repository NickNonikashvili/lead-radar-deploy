<?php
/*
 * Team (?p=users) — owners only.
 *   ?p=users           everyone in the team (owners first, switched-off accounts last) + "Add a team member"
 *   ?p=users&id=N      one member: name, email, role, language · set a new password · switch access off/on ·
 *                      remove (only once switched off) · their recent activity
 * Rules (checked again inside the saving transaction, so two owners acting at once can't lock everyone out):
 * nobody can change their own role, switch off or remove themselves (their own details are under My account),
 * and the last active owner can't be made a team member, switched off or removed.
 * Writing a new password_hash signs that person out everywhere; active = 0 signs them out at once.
 * Activity log: user.create, user.update, user.role, user.password, user.deactivate, user.reactivate, user.delete.
 */
require_once __DIR__ . '/manage-lib.php';
$me = require_owner();
$meId = (int) $me['id'];

/** '' when $meId may do $what (role|deactivate|delete) to $target, else the reason (translated). */
function team_block_reason(int $meId, array $target, string $what): string
{
  if ((int) $target['id'] === $meId) {
    if ($what === 'role') return t('You can’t change your own role. Another owner can do it for you.');
    if ($what === 'deactivate') return t('You can’t switch off your own access.');
    return t('You can’t remove yourself from the team.');
  }
  $actor = db_row('SELECT role, active FROM users WHERE id = ?', [$meId]);
  if (!$actor || $actor['role'] !== 'owner' || (int) $actor['active'] !== 1) return t('Only an active owner can do this.');
  if ($target['role'] === 'owner' && (int) $target['active'] === 1) {
    $others = (int) db_value("SELECT COUNT(*) FROM users WHERE role = 'owner' AND active = 1 AND id <> ?", [(int) $target['id']]);
    if ($others < 1) return t('{name} is the only active owner. Make someone else an owner first.', ['name' => $target['name']]);
  }
  return '';
}

/** Cleans a name typed into a form: one line, at most 100 characters. */
function team_name(string $s): string
{
  return mfs_cut(trim((string) preg_replace('/\s+/u', ' ', $s)), 100);
}

$id = get_int('id');
$errors = [];
$form = '';
$target = null;
if ($id > 0) {
  $target = db_row('SELECT * FROM users WHERE id = ?', [$id]);
  if (!$target) render_error(404, t('Not found'), t('There is no team member at this address — they may have been removed.'), '<p class="empty__text"><a href="' . h(url('users')) . '">' . h(t('Back to the team')) . '</a></p>');
}

// ── Saving ─────────────────────────────────────────────────────────────────
if (is_post()) {
  csrf_check();
  $form = post('action');

  if ($form === 'create') {
    $name = team_name(post('name'));
    $email = valid_email(post('email'));
    $role = post('role');
    $lang = post('lang');
    $pw = post_password('password');
    if ($name === '') $errors['name'] = t('Please enter their name.');
    if ($email === '') $errors['email'] = t('Please enter a valid email address — they sign in with it.');
    elseif ((int) db_value('SELECT COUNT(*) FROM users WHERE email = ?', [$email]) > 0) $errors['email'] = t('Someone in the team already uses this address.');
    if (!isset(USER_ROLES[$role])) $errors['role'] = t('Please choose a role.');
    if (!isset(UI_LANGS[$lang])) $lang = 'en';
    $pp = password_problem($pw);
    if ($pp !== '') $errors['password'] = $pp;
    if (!$errors) {
      try {
        db_exec('INSERT INTO users (email, name, password_hash, role, lang, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', [$email, $name, mfs_hash_password($pw), $role, $lang, now_utc()]);
        $newId = (int) db()->lastInsertId();
      } catch (PDOException $e) {
        $newId = 0;
        $errors['email'] = t('Someone in the team already uses this address.');
      }
      if ($newId) {
        $mailed = '';
        if (post('invite') !== '') {
          $body = t('Hello {name},', ['name' => $name]) . "\n\n"
            . t('{owner} has added you to the Million First Steps team area, where we look after requests and bookings from the website.', ['owner' => $me['name']]) . "\n\n"
            . t('Sign in here: {url}', ['url' => mfs_admin_base_url()]) . "\n"
            . t('Your email: {email}', ['email' => $email]) . "\n\n"
            . t('{owner} will give you your temporary password. After signing in, please choose your own under “My account”.', ['owner' => $me['name']]) . "\n\n"
            . t('If you weren’t expecting this email, you can ignore it.') . "\n";
          $mailed = send_mail($email, t('You’ve been added to the Million First Steps team area'), $body, (string) $me['email']) ? 'sent' : 'failed';
        }
        audit('user.create', 'user:' . $newId, $name . ' <' . $email . '> as ' . $role . ($mailed === 'sent' ? '; sign-in address emailed' : ($mailed === 'failed' ? '; email could not be sent' : '')));
        flash('ok', t('{name} is in the team. They sign in with {email} and the temporary password you chose — please give it to them yourself, and ask them to choose their own under My account.', ['name' => $name, 'email' => $email]));
        if ($mailed === 'sent') flash('info', t('We emailed {name} the sign-in address (without the password).', ['name' => $name]));
        if ($mailed === 'failed') flash('error', t('The email to {name} could not be sent. Please send them the sign-in address yourself: {url}', ['name' => $name, 'url' => mfs_admin_base_url()]));
        redirect(url('users'));
      }
    }
  } elseif ($target && $form === 'update') {
    $name = team_name(post('name'));
    $email = valid_email(post('email'));
    $role = post('role', (string) $target['role']);
    $lang = post('lang', (string) $target['lang']);
    if ($name === '') $errors['name'] = t('Please enter their name.');
    if ($email === '') $errors['email'] = t('Please enter a valid email address — they sign in with it.');
    elseif ((int) db_value('SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?', [$email, $id]) > 0) $errors['email'] = t('Someone in the team already uses this address.');
    if (!isset(USER_ROLES[$role])) $role = (string) $target['role'];
    if (!isset(UI_LANGS[$lang])) $lang = (string) $target['lang'];
    if (!$errors) {
      $result = db_tx(function () use ($id, $meId, $name, $email, $role, $lang) {
        $fresh = db_row('SELECT * FROM users WHERE id = ?', [$id]);
        if (!$fresh) return ['gone', []];
        if ($role !== $fresh['role'] && $role !== 'owner') {
          $why = team_block_reason($meId, $fresh, 'role');
          if ($why !== '') return ['role', $why];
        } elseif ($role !== $fresh['role'] && (int) $fresh['id'] === $meId) {
          return ['role', t('You can’t change your own role. Another owner can do it for you.')];
        }
        db_exec('UPDATE users SET name = ?, email = ?, role = ?, lang = ? WHERE id = ?', [$name, $email, $role, $lang, $id]);
        return ['ok', $fresh];
      });
      if ($result[0] === 'gone') {
        flash('error', t('That team member no longer exists.'));
        redirect(url('users'));
      }
      if ($result[0] === 'role') {
        $errors['role'] = $result[1];
      } else {
        $old = $result[1];
        $changes = [];
        if ($old['name'] !== $name) $changes[] = 'name: ' . $old['name'] . ' → ' . $name;
        if (strcasecmp((string) $old['email'], $email) !== 0) $changes[] = 'email: ' . $old['email'] . ' → ' . $email;
        if ($old['lang'] !== $lang) $changes[] = 'language: ' . $old['lang'] . ' → ' . $lang;
        if ($changes) audit('user.update', 'user:' . $id, $name . ': ' . implode('; ', $changes));
        if ($old['role'] !== $role) audit('user.role', 'user:' . $id, $name . ': ' . $old['role'] . ' → ' . $role);
        flash($changes || $old['role'] !== $role ? 'ok' : 'info', $old['role'] !== $role
          ? t('Saved. {name} is now: {role}.', ['name' => $name, 'role' => t(USER_ROLES[$role])])
          : ($changes ? t('Saved.') : t('Nothing had changed, so everything stays as it was.')));
        redirect(url('users', ['id' => $id]));
      }
    }
  } elseif ($target && $form === 'password') {
    if ((int) $target['id'] === $meId) redirect(url('account'));
    $pw = post_password('new');
    $pp = password_problem($pw, post_password('new2'));
    if ($pp !== '') $errors['new'] = $pp;
    if (!$errors) {
      db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [mfs_hash_password($pw), $id]);
      db_exec('DELETE FROM password_resets WHERE user_id = ?', [$id]);
      audit('user.password', 'user:' . $id, $target['name'] . ': new password set by ' . $me['name'] . '; signed out everywhere');
      flash('ok', t('New password saved. {name} has been signed out everywhere and signs in with the new password from now on — please give it to them yourself.', ['name' => $target['name']]));
      redirect(url('users', ['id' => $id]));
    }
  } elseif ($target && in_array($form, ['deactivate', 'reactivate', 'delete'], true)) {
    $result = db_tx(function () use ($id, $meId, $form) {
      $fresh = db_row('SELECT * FROM users WHERE id = ?', [$id]);
      if (!$fresh) return ['gone', ''];
      if ($form === 'reactivate') {
        if ((int) $fresh['active'] === 1) return ['ok', $fresh];
        db_exec('UPDATE users SET active = 1 WHERE id = ?', [$id]);
        return ['ok', $fresh];
      }
      $why = team_block_reason($meId, $fresh, $form);
      if ($why !== '') return ['blocked', $why];
      if ($form === 'deactivate') {
        db_exec('UPDATE users SET active = 0 WHERE id = ?', [$id]);
        db_exec('DELETE FROM password_resets WHERE user_id = ?', [$id]);
        return ['ok', $fresh];
      }
      if ((int) $fresh['active'] === 1) return ['blocked', t('Switch off their access first; then they can be removed.')];
      db_exec('DELETE FROM users WHERE id = ?', [$id]);
      return ['ok', $fresh];
    });
    if ($result[0] === 'gone') {
      flash('error', t('That team member no longer exists.'));
      redirect(url('users'));
    }
    if ($result[0] === 'blocked') {
      flash('error', $result[1]);
      redirect(url('users', ['id' => $id]));
    }
    $who = $result[1];
    if ($form === 'deactivate') {
      audit('user.deactivate', 'user:' . $id, $who['name'] . ' <' . $who['email'] . '>');
      flash('ok', t('{name} can no longer sign in, and has been signed out everywhere. You can switch their access back on at any time.', ['name' => $who['name']]));
      redirect(url('users', ['id' => $id]));
    }
    if ($form === 'reactivate') {
      if ((int) $who['active'] !== 1) audit('user.reactivate', 'user:' . $id, $who['name'] . ' <' . $who['email'] . '>');
      flash('ok', t('{name} can sign in again with their old password. If they’ve forgotten it, set a new one below.', ['name' => $who['name']]));
      redirect(url('users', ['id' => $id]));
    }
    audit('user.delete', 'user:' . $id, $who['name'] . ' <' . $who['email'] . '> (' . $who['role'] . ')');
    flash('ok', t('{name} has been removed from the team. Notes and bookings they made stay, without their name.', ['name' => $who['name']]));
    redirect(url('users'));
  } else {
    redirect($target ? url('users', ['id' => $id]) : url('users'));
  }
}

$roleHelp = [
  'staff' => t('Requests, bookings, the calendar and statistics.'),
  'owner' => t('Everything, including prices, settings, the team and deleting records.'),
];
$avatarClass = function (array $u) { return 'avatar' . ($u['role'] === 'owner' ? ' tm-avatar--owner' : '') . ((int) $u['active'] !== 1 ? ' tm-avatar--off' : ''); };
$lastSeen = function (array $u) {
  if ((string) $u['last_login_at'] === '') return t('Never signed in');
  return t('Last signed in {when}', ['when' => fmt_ago($u['last_login_at'])]);
};

// ── One member ─────────────────────────────────────────────────────────────
if ($target) {
  $u = $target;
  $self = (int) $u['id'] === $meId;
  $active = (int) $u['active'] === 1;
  $roleBlock = $self ? t('You can’t change your own role. Another owner can do it for you.') : '';
  if (!$self && $u['role'] === 'owner' && $active && (int) db_value("SELECT COUNT(*) FROM users WHERE role = 'owner' AND active = 1 AND id <> ?", [(int) $u['id']]) < 1) {
    $roleBlock = t('{name} is the only active owner, so they stay an owner. Make someone else an owner first.', ['name' => $u['name']]);
  }
  $accessBlock = $self ? t('You can’t switch off your own access.') : (($u['role'] === 'owner' && $active && $roleBlock !== '') ? $roleBlock : '');
  $failed = $errors && $form === 'update';
  $val = function ($k, $fallback) use ($failed) { return $failed ? post($k) : (string) $fallback; };
  $open = (int) db_value("SELECT COUNT(*) FROM requests WHERE assigned_to = ? AND status IN ('new','contacted','quoted')", [(int) $u['id']]);
  $bookingsMade = (int) db_value('SELECT COUNT(*) FROM bookings WHERE created_by = ?', [(int) $u['id']]);
  $recent = db_all('SELECT action, target, details, at FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT 6', [(int) $u['id']]);
  $suggest = mg_suggest_password();

  ob_start(); ?>
  <div class="tm-member-head">
    <span class="<?= h($avatarClass($u)) ?> avatar--lg" aria-hidden="true"><?= h(initials($u['name'])) ?></span>
    <div class="tm-member-head__text">
      <p class="tm-member-head__mail"><?= h($u['email']) ?></p>
      <p class="row">
        <span class="pill pill--<?= h($u['role']) ?>"><?= h(t(USER_ROLES[$u['role']] ?? $u['role'])) ?></span>
        <?= $active ? '<span class="pill pill--green pill--plain">' . h(t('Can sign in')) . '</span>' : '<span class="pill pill--muted pill--plain">' . h(t('Access switched off')) . '</span>' ?>
        <?= $self ? '<span class="pill pill--gold pill--plain">' . h(t('You')) . '</span>' : '' ?>
      </p>
    </div>
  </div>

  <?php if ($self) { ?>
    <div class="callout callout--info">
      <?= icon('user') ?>
      <p><?= h(t('This is you. Your own name, email, language and password are changed under My account.')) ?> <a href="<?= h(url('account')) ?>"><?= h(t('Open My account')) ?></a></p>
    </div>
  <?php } ?>

  <div class="split">
    <div class="stack">
      <?php if (!$self) { ?>
      <form method="post" action="<?= h(url('users', ['id' => $u['id']])) ?>" class="card form" data-once novalidate>
        <div class="card__head"><div><h2 class="card__title"><?= h(t('Details and role')) ?></h2><p class="card__sub"><?= h(t('Their name in the team area, the email they sign in with, and what they can do.')) ?></p></div></div>
        <div class="card__body">
          <?= $failed ? mg_error_summary($errors) : '' ?>
          <?= csrf_field() ?><input type="hidden" name="action" value="update">
          <div class="form-row">
            <div class="field<?= mg_cls($errors, 'name') ?>">
              <label class="field__label" for="name"><?= h(t('Name')) ?></label>
              <input class="input" id="name" name="name" value="<?= h($val('name', $u['name'])) ?>" maxlength="100" autocomplete="off" required<?= mg_inv($errors, 'name') ?>>
              <?= mg_err($errors, 'name') ?>
            </div>
            <div class="field<?= mg_cls($errors, 'email') ?>">
              <label class="field__label" for="email"><?= h(t('Email')) ?></label>
              <input class="input" type="email" id="email" name="email" value="<?= h($val('email', $u['email'])) ?>" maxlength="200" autocomplete="off" inputmode="email" autocapitalize="none" spellcheck="false" required<?= mg_inv($errors, 'email') ?>>
              <?= mg_err($errors, 'email') ?>
            </div>
          </div>
          <fieldset class="fieldset<?= mg_cls($errors, 'role') ?>">
            <legend class="field__label"><?= h(t('Role')) ?></legend>
            <div class="tm-roles">
              <?php $curRole = $val('role', $u['role']); foreach (USER_ROLES as $r => $label) { ?>
                <label class="tm-role">
                  <input type="radio" name="role" value="<?= h($r) ?>"<?= $curRole === $r ? ' checked' : '' ?><?= $roleBlock !== '' && $r !== $u['role'] ? ' disabled' : '' ?>>
                  <span class="tm-role__box"><span class="tm-role__name"><?= h(t($label)) ?></span><span class="tm-role__help"><?= h($roleHelp[$r]) ?></span></span>
                </label>
              <?php } ?>
            </div>
            <?php if ($roleBlock !== '') { ?><p class="field__help"><?= icon('lock') ?> <?= h($roleBlock) ?></p><?php } ?>
            <?= mg_err($errors, 'role') ?>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="field__label"><?= h(t('Language of the team area')) ?></legend>
            <div class="choice-row">
              <?php $curLang = $val('lang', $u['lang']); foreach (UI_LANGS as $code => $label) { ?>
                <label class="choice"><input type="radio" name="lang" value="<?= h($code) ?>"<?= $curLang === $code ? ' checked' : '' ?>><span class="choice__box" lang="<?= h($code) ?>"><?= h($label) ?></span></label>
              <?php } ?>
            </div>
          </fieldset>
        </div>
        <div class="card__foot"><button type="submit" class="btn btn--primary"><?= icon('check') ?><?= h(t('Save')) ?></button></div>
      </form>

      <form method="post" action="<?= h(url('users', ['id' => $u['id']])) ?>" class="card form" data-once novalidate>
        <div class="card__head"><div><h2 class="card__title"><?= h(t('Set a new password')) ?></h2><p class="card__sub"><?= h(t('For when they’ve forgotten theirs. They’re signed out on every device and need the new password next time.')) ?></p></div></div>
        <div class="card__body">
          <?= $errors && $form === 'password' ? mg_error_summary($errors) : '' ?>
          <?= csrf_field() ?><input type="hidden" name="action" value="password">
          <input type="text" name="username" value="<?= h($u['email']) ?>" autocomplete="off" hidden>
          <div class="form-row">
            <div class="field<?= mg_cls($errors, 'new') ?>">
              <label class="field__label" for="new"><?= h(t('New password')) ?></label>
              <div class="input-group">
                <input class="input mono" type="text" id="new" name="new" value="<?= h($errors && $form === 'password' ? '' : $suggest) ?>" autocomplete="new-password" minlength="<?= MFS_PASSWORD_MIN ?>" spellcheck="false" autocapitalize="none" required data-copy-source<?= mg_inv($errors, 'new') ?>>
                <button type="button" class="input-group__btn" data-copy="<?= h($suggest) ?>" data-copy-from="#new" data-copied="<?= h(t('Copied')) ?>" aria-label="<?= h(t('Copy the password')) ?>"><?= icon('copy') ?></button>
              </div>
              <?= mg_err($errors, 'new') ?>
            </div>
            <div class="field">
              <label class="field__label" for="new2"><?= h(t('The same password again')) ?></label>
              <input class="input mono" type="text" id="new2" name="new2" value="" autocomplete="new-password" spellcheck="false" autocapitalize="none" required>
            </div>
          </div>
          <p class="field__help"><?= h(t('We suggest one; you can type your own (at least {n} characters). Give it to them in person or by phone, not in the same email as their address.', ['n' => MFS_PASSWORD_MIN])) ?></p>
        </div>
        <div class="card__foot"><button type="submit" class="btn btn--primary"><?= icon('key') ?><?= h(t('Save new password')) ?></button></div>
      </form>
      <?php } ?>

      <section class="danger-zone" aria-labelledby="access-h">
        <h2 class="danger-zone__title" id="access-h"><?= icon('lock') ?><?= h(t('Access')) ?></h2>
        <?php if ($active) { ?>
          <p class="danger-zone__text"><?= h(t('Switching off access signs them out at once. Everything they did stays; you can switch it back on at any time.')) ?></p>
          <?php if ($open > 0) { ?><p class="danger-zone__text"><?= icon('info') ?> <?= h(tp($open, '{name} has {n} open request assigned. It stays assigned to them — reassign it under Requests if needed.', '{name} has {n} open requests assigned. They stay assigned to them — reassign them under Requests if needed.', ['name' => $u['name']])) ?></p><?php } ?>
          <div class="danger-zone__row">
            <span><?= h(t('Switch off {name}’s access', ['name' => $u['name']])) ?></span>
            <?php if ($accessBlock !== '') { ?>
              <span class="small muted tm-blocked"><?= icon('lock') ?><?= h($accessBlock) ?></span>
            <?php } else { ?>
              <form method="post" action="<?= h(url('users', ['id' => $u['id']])) ?>" class="inline" data-confirm="<?= h(t('Switch off {name}’s access? They are signed out at once and can’t sign in until you switch it back on.', ['name' => $u['name']])) ?>" data-once>
                <?= csrf_field() ?><input type="hidden" name="action" value="deactivate">
                <button type="submit" class="btn btn--danger btn--sm"><?= icon('lock') ?><?= h(t('Switch off access')) ?></button>
              </form>
            <?php } ?>
          </div>
        <?php } else { ?>
          <p class="danger-zone__text"><?= h(t('{name} can’t sign in at the moment.', ['name' => $u['name']])) ?></p>
          <div class="danger-zone__row">
            <span><?= h(t('Let them sign in again')) ?></span>
            <form method="post" action="<?= h(url('users', ['id' => $u['id']])) ?>" class="inline" data-once>
              <?= csrf_field() ?><input type="hidden" name="action" value="reactivate">
              <button type="submit" class="btn btn--secondary btn--sm"><?= icon('refresh') ?><?= h(t('Switch access back on')) ?></button>
            </form>
          </div>
          <div class="danger-zone__row">
            <span><?= h(t('Remove them from the team for good. Notes and bookings they made stay, without their name.')) ?></span>
            <form method="post" action="<?= h(url('users', ['id' => $u['id']])) ?>" class="inline" data-confirm="<?= h(t('Remove {name} from the team for good? This can’t be undone.', ['name' => $u['name']])) ?>" data-once>
              <?= csrf_field() ?><input type="hidden" name="action" value="delete">
              <button type="submit" class="btn btn--danger btn--sm"><?= icon('trash') ?><?= h(t('Remove')) ?></button>
            </form>
          </div>
        <?php } ?>
      </section>
    </div>

    <aside class="stack">
      <section class="card">
        <div class="card__body">
          <dl class="kv kv--compact tm-facts">
            <div class="kv__row"><dt class="kv__key"><?= h(t('In the team since')) ?></dt><dd class="kv__val"><?= h(fmt_date($u['created_at'])) ?></dd></div>
            <div class="kv__row"><dt class="kv__key"><?= h(t('Last signed in')) ?></dt><dd class="kv__val"><?= h((string) $u['last_login_at'] !== '' ? fmt_ago($u['last_login_at']) : t('Never')) ?></dd></div>
            <div class="kv__row"><dt class="kv__key"><?= h(t('Open requests assigned')) ?></dt><dd class="kv__val"><?php if ($open > 0) { ?><a href="<?= h(url('requests')) ?>"><?= (int) $open ?></a><?php } else { ?>0<?php } ?></dd></div>
            <div class="kv__row"><dt class="kv__key"><?= h(t('Bookings created')) ?></dt><dd class="kv__val"><?= (int) $bookingsMade ?></dd></div>
          </dl>
        </div>
      </section>
      <section class="card">
        <div class="card__head"><div><h2 class="card__title"><?= h(t('Recent activity')) ?></h2></div>
          <div class="card__actions"><a class="btn btn--sm btn--ghost" href="<?= h(url('activity', ['who' => $u['id']])) ?>"><?= h(t('See all')) ?></a></div></div>
        <?php if ($recent) { ?>
          <ul class="list tm-recent">
            <?php foreach ($recent as $a) { ?>
              <li class="list__item"><span class="list__main"><span class="list__title"><?= h($a['action']) ?></span><span class="list__meta"><?= h(fmt_ago($a['at'])) ?><?= $a['details'] !== '' ? ' · ' . h(excerpt($a['details'], 70)) : '' ?></span></span></li>
            <?php } ?>
          </ul>
        <?php } else { ?>
          <div class="card__body"><p class="muted small"><?= h(t('Nothing yet.')) ?></p></div>
        <?php } ?>
      </section>
    </aside>
  </div>
  <?php
  render($u['name'], ob_get_clean(), [
    'nav' => 'users',
    'css' => ['manage.css'],
    'js' => ['manage.js'],
    'crumbs' => [[t('Team'), url('users')], [$u['name'], '']],
  ]);
}

// ── The team list + add a member ──────────────────────────────────────────
$people = db_all("SELECT u.*, (SELECT COUNT(*) FROM requests r WHERE r.assigned_to = u.id AND r.status IN ('new','contacted','quoted')) AS open_requests
  FROM users u ORDER BY u.active DESC, CASE u.role WHEN 'owner' THEN 0 ELSE 1 END, u.name COLLATE NOCASE");
$activeCount = 0;
foreach ($people as $p) if ((int) $p['active'] === 1) $activeCount++;
$addFailed = $errors && $form === 'create';
$av = function ($k, $fallback = '') use ($addFailed) { return $addFailed ? post($k) : $fallback; };
$suggest = $addFailed ? post_password('password') : mg_suggest_password();

ob_start(); ?>
<div class="split">
  <div class="stack">
    <section class="card card--flush">
      <div class="table-wrap">
        <table class="table tm-table">
          <caption class="sr-only"><?= h(t('Team')) ?></caption>
          <thead><tr>
            <th scope="col"><?= h(t('Member')) ?></th>
            <th scope="col"><?= h(t('Role')) ?></th>
            <th scope="col"><?= h(t('Signed in')) ?></th>
            <th scope="col" class="num"><?= h(t('Open requests')) ?></th>
            <th scope="col"><span class="sr-only"><?= h(t('Actions')) ?></span></th>
          </tr></thead>
          <tbody>
          <?php foreach ($people as $p) {
            $href = url('users', ['id' => (int) $p['id']]);
            $on = (int) $p['active'] === 1; ?>
            <tr data-href="<?= h($href) ?>"<?= $on ? '' : ' class="tm-row--off"' ?>>
              <td class="cell-primary" data-label="<?= h(t('Member')) ?>">
                <span class="tm-who">
                  <span class="<?= h($avatarClass($p)) ?>" aria-hidden="true"><?= h(initials($p['name'])) ?></span>
                  <span class="tm-who__text">
                    <a class="cell-main" href="<?= h($href) ?>"><?= h($p['name']) ?><?= (int) $p['id'] === $meId ? ' <span class="pill pill--gold pill--plain tm-you">' . h(t('You')) . '</span>' : '' ?></a>
                    <span class="cell-sub truncate"><?= h($p['email']) ?></span>
                  </span>
                </span>
              </td>
              <td data-label="<?= h(t('Role')) ?>">
                <span class="pill pill--<?= h($p['role']) ?>"><?= h(t(USER_ROLES[$p['role']] ?? $p['role'])) ?></span>
                <?php if (!$on) { ?><span class="pill pill--muted pill--plain"><?= h(t('Access off')) ?></span><?php } ?>
              </td>
              <td data-label="<?= h(t('Signed in')) ?>"><span class="small"><?= h((string) $p['last_login_at'] !== '' ? fmt_ago($p['last_login_at']) : t('Never')) ?></span></td>
              <td class="num" data-label="<?= h(t('Open requests')) ?>"><?= (int) $p['open_requests'] ?></td>
              <td class="actions"><a class="btn btn--sm btn--secondary" href="<?= h($href) ?>"><?= icon('edit') ?><?= h(t('Manage')) ?><span class="sr-only"> <?= h($p['name']) ?></span></a></td>
            </tr>
          <?php } ?>
          </tbody>
        </table>
      </div>
    </section>
    <?php if (count($people) === 1) { ?>
      <section class="card card--muted empty empty--sm">
        <div class="empty__mark" aria-hidden="true"><?= icon('users') ?></div>
        <h2 class="empty__title"><?= h(t('Just you so far')) ?></h2>
        <p class="empty__text"><?= h(t('Add the rest of the team — each person gets their own sign-in, so you can see who answered which request.')) ?></p>
      </section>
    <?php } ?>
    <div class="callout callout--info">
      <?= icon('shield') ?>
      <div>
        <p><strong><?= h(t('Owners')) ?>:</strong> <?= h($roleHelp['owner']) ?></p>
        <p><strong><?= h(t('Team members')) ?>:</strong> <?= h($roleHelp['staff']) ?></p>
      </div>
    </div>
  </div>

  <aside class="stack">
    <form method="post" action="<?= h(url('users')) ?>" class="card form" id="add" data-once novalidate>
      <div class="card__head"><div><h2 class="card__title"><?= h(t('Add a team member')) ?></h2><p class="card__sub"><?= h(t('They get their own sign-in.')) ?></p></div></div>
      <div class="card__body">
        <?= $addFailed ? mg_error_summary($errors) : '' ?>
        <?= csrf_field() ?><input type="hidden" name="action" value="create">
        <div class="field<?= mg_cls($errors, 'name') ?>">
          <label class="field__label" for="add-name"><?= h(t('Name')) ?></label>
          <input class="input" id="add-name" name="name" value="<?= h($av('name')) ?>" maxlength="100" autocomplete="off" required<?= mg_inv($errors, 'name') ?>>
          <?= mg_err($errors, 'name') ?>
        </div>
        <div class="field<?= mg_cls($errors, 'email') ?>">
          <label class="field__label" for="add-email"><?= h(t('Email')) ?></label>
          <input class="input" type="email" id="add-email" name="email" value="<?= h($av('email')) ?>" maxlength="200" autocomplete="off" inputmode="email" autocapitalize="none" spellcheck="false" required<?= mg_inv($errors, 'email') ?>>
          <p class="field__help"><?= h(t('They sign in with this address, and password reset links go there.')) ?></p>
          <?= mg_err($errors, 'email') ?>
        </div>
        <fieldset class="fieldset<?= mg_cls($errors, 'role') ?>">
          <legend class="field__label"><?= h(t('Role')) ?></legend>
          <div class="tm-roles tm-roles--stack">
            <?php $r0 = $av('role', 'staff'); foreach (USER_ROLES as $r => $label) { ?>
              <label class="tm-role">
                <input type="radio" name="role" value="<?= h($r) ?>"<?= $r0 === $r ? ' checked' : '' ?>>
                <span class="tm-role__box"><span class="tm-role__name"><?= h(t($label)) ?></span><span class="tm-role__help"><?= h($roleHelp[$r]) ?></span></span>
              </label>
            <?php } ?>
          </div>
          <?= mg_err($errors, 'role') ?>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="field__label"><?= h(t('Language of the team area')) ?></legend>
          <div class="choice-row">
            <?php $l0 = $av('lang', 'en'); foreach (UI_LANGS as $code => $label) { ?>
              <label class="choice"><input type="radio" name="lang" value="<?= h($code) ?>"<?= $l0 === $code ? ' checked' : '' ?>><span class="choice__box" lang="<?= h($code) ?>"><?= h($label) ?></span></label>
            <?php } ?>
          </div>
        </fieldset>
        <div class="field<?= mg_cls($errors, 'password') ?>">
          <label class="field__label" for="add-pw"><?= h(t('Temporary password')) ?></label>
          <div class="input-group">
            <input class="input mono" type="text" id="add-pw" name="password" value="<?= h($suggest) ?>" minlength="<?= MFS_PASSWORD_MIN ?>" autocomplete="new-password" spellcheck="false" autocapitalize="none" required<?= mg_inv($errors, 'password') ?>>
            <button type="button" class="input-group__btn" data-copy="<?= h($suggest) ?>" data-copy-from="#add-pw" data-copied="<?= h(t('Copied')) ?>" aria-label="<?= h(t('Copy the password')) ?>"><?= icon('copy') ?></button>
          </div>
          <p class="field__help"><?= h(t('We suggest one; you can type your own (at least {n} characters). Give it to them yourself — they can change it under My account.', ['n' => MFS_PASSWORD_MIN])) ?></p>
          <?= mg_err($errors, 'password') ?>
        </div>
        <label class="check">
          <input type="checkbox" name="invite" value="1"<?= !$addFailed || post('invite') !== '' ? ' checked' : '' ?>>
          <span class="check__box"><?= icon('check') ?></span>
          <span class="check__label"><?= h(t('Email them the sign-in address')) ?><span class="check__help"><?= h(t('Without the password.')) ?></span></span>
        </label>
      </div>
      <div class="card__foot"><button type="submit" class="btn btn--primary btn--block"><?= icon('plus') ?><?= h(t('Add to the team')) ?></button></div>
    </form>
  </aside>
</div>
<?php
render(t('Team'), ob_get_clean(), [
  'nav' => 'users',
  'css' => ['manage.css'],
  'js' => ['manage.js'],
  'lead' => tp($activeCount, '{n} person can sign in to the team area.', '{n} people can sign in to the team area.'),
  'actions' => '<a class="btn btn--primary" href="#add">' . icon('plus') . h(t('Add a team member')) . '</a>',
]);
