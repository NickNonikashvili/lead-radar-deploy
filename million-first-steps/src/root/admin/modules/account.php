<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
// My account: name, email, language and password. Everyone (owners and team members) can open it.
$me = require_login();
$errors = [];
$form = '';

if (is_post()) {
  csrf_check();
  $form = post('action');

  if ($form === 'details') {
    $name = mfs_cut(str_replace("\n", ' ', post('name')), 100);
    $email = valid_email(post('email'));
    $lang = post('lang');
    if ($name === '') $errors['name'] = t('Please enter your name.');
    if ($email === '') $errors['email'] = t('Please enter a valid email address.');
    if (!isset(UI_LANGS[$lang])) $lang = 'en';
    $emailChanged = $email !== '' && strcasecmp($email, (string) $me['email']) !== 0;
    if ($emailChanged) {
      if (!password_verify(post_password('current'), (string) $me['password_hash'])) {
        $errors['current'] = t('To change your email, enter your current password.');
      } elseif ((int) db_value('SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?', [$email, $me['id']]) > 0) {
        $errors['email'] = t('Someone in the team already uses this address.');
      }
    }
    if (!$errors) {
      db_exec('UPDATE users SET name = ?, email = ?, lang = ? WHERE id = ?', [$name, $email, $lang, $me['id']]);
      // A new sign-in address: reset links sent to the old one stop working.
      if ($emailChanged) db_exec('DELETE FROM password_resets WHERE user_id = ?', [$me['id']]);
      $_SESSION['lang'] = $lang;
      mfs_remember_lang($lang);
      $changes = [];
      if ($name !== $me['name']) $changes[] = 'name';
      if ($emailChanged) $changes[] = 'email ' . $me['email'] . ' → ' . $email;
      if ($lang !== $me['lang']) $changes[] = 'language ' . $lang;
      if ($changes) audit('account.update', 'user:' . $me['id'], implode('; ', $changes));
      unset($GLOBALS['mfs_user']);
      current_user();
      flash('ok', t('Your details are saved.'));
      redirect(url('account'));
    }
  } elseif ($form === 'password') {
    $current = post_password('current_pw');
    $new = post_password('new');
    if (!password_verify($current, (string) $me['password_hash'])) {
      $errors['current_pw'] = t('That isn’t your current password.');
    } else {
      $pp = password_problem($new, post_password('new2'));
      if ($pp !== '') $errors['new'] = $pp;
      elseif (hash_equals($current, $new)) $errors['new'] = t('Choose a password that is different from the current one.');
    }
    if (!$errors) {
      $hash = mfs_hash_password($new);
      db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $me['id']]);
      db_exec('DELETE FROM password_resets WHERE user_id = ?', [$me['id']]);
      mfs_refresh_session_password($hash);
      audit('account.password', 'user:' . $me['id'], 'Password changed; other sessions signed out');
      flash('ok', t('Your password is changed. You stay signed in here; any other devices have been signed out.'));
      redirect(url('account'));
    }
  } else {
    redirect(url('account'));
  }
}

$err = function ($k) use ($errors) {
  return isset($errors[$k]) ? '<p class="field__error" id="err-' . h($k) . '">' . icon('alert') . h($errors[$k]) . '</p>' : '';
};
$inv = function ($k) use ($errors) {
  return isset($errors[$k]) ? ' aria-invalid="true" aria-describedby="err-' . h($k) . '"' : '';
};
$cls = function ($k) use ($errors) {
  return isset($errors[$k]) ? ' has-error' : '';
};
$val = function ($k, $fallback) use ($form) {
  return $form === 'details' ? post($k) : $fallback;
};
$since = (int) ($_SESSION['since'] ?? 0);
ob_start(); ?>
<?php if ($errors): ?>
  <div class="flash flash--error" role="alert"><span class="flash__icon"><?= icon('alert') ?></span><p class="flash__text"><?= h(t('Please check the highlighted fields.')) ?></p></div>
<?php endif; ?>
<div class="split">
  <div class="stack">
    <form method="post" action="<?= h(url('account')) ?>" class="card form" data-once>
      <div class="card__head"><div><h2 class="card__title"><?= h(t('Your details')) ?></h2><p class="card__sub"><?= h(t('How you appear to the team, and the address you sign in with.')) ?></p></div></div>
      <div class="card__body">
        <?= csrf_field() ?><input type="hidden" name="action" value="details">
        <div class="form-row">
          <div class="field<?= $cls('name') ?>">
            <label class="field__label" for="name"><?= h(t('Name')) ?></label>
            <input class="input" id="name" name="name" value="<?= h($val('name', $me['name'])) ?>" autocomplete="name" required<?= $inv('name') ?>>
            <?= $err('name') ?>
          </div>
          <div class="field<?= $cls('email') ?>">
            <label class="field__label" for="email"><?= h(t('Email')) ?></label>
            <input class="input" type="email" id="email" name="email" value="<?= h($val('email', $me['email'])) ?>" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required<?= $inv('email') ?>>
            <?= $err('email') ?>
          </div>
        </div>
        <div class="field<?= $cls('current') ?>">
          <label class="field__label" for="current"><?= h(t('Current password')) ?> <span class="field__opt"><?= h(t('only when you change your email')) ?></span></label>
          <input class="input" type="password" id="current" name="current" autocomplete="current-password"<?= $inv('current') ?>>
          <?= $err('current') ?>
        </div>
        <fieldset class="fieldset">
          <legend class="field__label"><?= h(t('Language of the team area')) ?></legend>
          <div class="choice-row">
            <?php $curLang = $val('lang', $me['lang']); foreach (UI_LANGS as $code => $label): ?>
              <label class="choice">
                <input type="radio" name="lang" value="<?= h($code) ?>" <?= $curLang === $code ? 'checked' : '' ?>>
                <span class="choice__box" lang="<?= h($code) ?>"><?= h($label) ?></span>
              </label>
            <?php endforeach; ?>
          </div>
        </fieldset>
      </div>
      <div class="card__foot form-actions"><button type="submit" class="btn btn--primary"><?= icon('check') ?><?= h(t('Save details')) ?></button></div>
    </form>

    <form method="post" action="<?= h(url('account')) ?>" class="card form" data-once>
      <div class="card__head"><div><h2 class="card__title"><?= h(t('Change password')) ?></h2><p class="card__sub"><?= h(t('Changing it signs you out on every other phone and computer.')) ?></p></div></div>
      <div class="card__body">
        <?= csrf_field() ?><input type="hidden" name="action" value="password">
        <input type="email" name="username" value="<?= h($me['email']) ?>" autocomplete="username" hidden>
        <div class="field<?= $cls('current_pw') ?>">
          <label class="field__label" for="current_pw"><?= h(t('Current password')) ?></label>
          <input class="input" type="password" id="current_pw" name="current_pw" autocomplete="current-password" required<?= $inv('current_pw') ?>>
          <?= $err('current_pw') ?>
        </div>
        <div class="form-row">
          <div class="field<?= $cls('new') ?>">
            <label class="field__label" for="new"><?= h(t('New password')) ?></label>
            <div class="input-group">
              <input class="input" type="password" id="new" name="new" autocomplete="new-password" minlength="<?= MFS_PASSWORD_MIN ?>" required<?= $inv('new') ?>>
              <button type="button" class="input-group__btn" data-toggle-password="#new" aria-label="<?= h(t('Show password')) ?>" data-label-hide="<?= h(t('Hide password')) ?>"><?= icon('eye') ?></button>
            </div>
            <?= $err('new') ?>
          </div>
          <div class="field">
            <label class="field__label" for="new2"><?= h(t('New password again')) ?></label>
            <input class="input" type="password" id="new2" name="new2" autocomplete="new-password" required>
          </div>
        </div>
        <p class="field__help"><?= h(t('At least {n} characters. A short sentence you’ll remember works well.', ['n' => MFS_PASSWORD_MIN])) ?></p>
      </div>
      <div class="card__foot form-actions"><button type="submit" class="btn btn--primary"><?= icon('lock') ?><?= h(t('Change password')) ?></button></div>
    </form>
  </div>

  <aside class="stack">
    <section class="card">
      <div class="card__body">
        <div class="profile">
          <span class="avatar avatar--lg" aria-hidden="true"><?= h(initials($me['name'])) ?></span>
          <div>
            <p class="profile__name"><?= h($me['name']) ?></p>
            <p class="profile__mail"><?= h($me['email']) ?></p>
            <span class="pill pill--<?= h($me['role']) ?>"><?= h(t(USER_ROLES[$me['role']] ?? $me['role'])) ?></span>
          </div>
        </div>
        <dl class="kv kv--compact">
          <div class="kv__row"><dt class="kv__key"><?= h(t('Member since')) ?></dt><dd class="kv__val"><?= h(fmt_date($me['created_at'])) ?></dd></div>
          <div class="kv__row"><dt class="kv__key"><?= h(t('Signed in here')) ?></dt><dd class="kv__val"><?= $since ? h(fmt_date(gmdate('Y-m-d H:i:s', $since), true)) : '—' ?></dd></div>
          <div class="kv__row"><dt class="kv__key"><?= h(t('On this device')) ?></dt><dd class="kv__val"><?= h(!empty($_SESSION['remember']) ? t('Kept signed in for 30 days') : t('Signed out after 12 hours without use')) ?></dd></div>
        </dl>
      </div>
    </section>
    <section class="callout callout--info">
      <?= icon('shield') ?>
      <div>
        <p class="strong"><?= h($me['role'] === 'owner' ? t('You are an owner') : t('You are a team member')) ?></p>
        <p><?= h($me['role'] === 'owner'
          ? t('Owners can do everything, including prices, settings, the team and deleting records.')
          : t('You can work with requests, bookings, the calendar and statistics. Prices, settings and the team are managed by the owners.')) ?></p>
      </div>
    </section>
  </aside>
</div>
<?php
render(t('My account'), ob_get_clean(), ['nav' => 'account', 'lead' => t('Your name, email, language and password.')]);
