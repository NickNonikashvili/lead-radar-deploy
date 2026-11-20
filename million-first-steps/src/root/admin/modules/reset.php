<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
// Choose a new password from an emailed link. The token is single-use and expires after an hour.
$token = is_post() ? post('token') : get('token');
$reset = $token !== '' ? mfs_find_reset($token) : null;
// The page (and the sign-in page after it) in the account's own language, unless one was picked here.
if ($reset && !isset($_GET['lang'])) mfs_remember_lang((string) $reset['lang']);

if (!$reset) {
  ob_start(); ?>
  <div class="callout callout--warn"><?= icon('clock') ?><p><?= h(t('This link has expired or has already been used. Links work once, for one hour.')) ?></p></div>
  <a class="btn btn--primary btn--block btn--lg" href="<?= h(url('forgot')) ?>"><?= icon('send') ?><?= h(t('Send a new link')) ?></a>
  <p class="auth__back"><a href="<?= h(url('login')) ?>"><?= icon('arrow-left') ?><?= h(t('Back to sign in')) ?></a></p>
  <?php
  render(t('Link no longer valid'), ob_get_clean(), ['layout' => 'auth', 'status' => is_post() ? 400 : 200]);
}

$error = '';
if (is_post()) {
  csrf_check();
  $password = post_password('password');
  $error = password_problem($password, post_password('password2'));
  if ($error === '') {
    $ok = db_tx(function () use ($reset, $password) {
      // Claim the link first, so two quick submissions can't both use it.
      if (db_exec('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL', [time(), (int) $reset['reset_id']]) !== 1) return false;
      db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [mfs_hash_password($password), (int) $reset['id']]);
      db_exec('DELETE FROM password_resets WHERE user_id = ? AND id <> ?', [(int) $reset['id'], (int) $reset['reset_id']]);
      return true;
    });
    if ($ok) {
      $lang = mfs_lang();
      $GLOBALS['mfs_user'] = ['id' => (int) $reset['id'], 'lang' => $lang] + $reset;
      audit('auth.password_reset', 'user:' . $reset['id'], 'New password chosen from an emailed link');
      mfs_forget_session();
      mfs_remember_lang($lang);
      flash('ok', t('Your new password is saved. Please sign in with it. Any other devices have been signed out.'));
      redirect(url('login'));
    }
    flash('error', t('This link has expired or has already been used. Links work once, for one hour.'));
    redirect(url('forgot'));
  }
}

ob_start(); ?>
<?php if ($error !== ''): ?>
  <div class="flash flash--error" role="alert"><span class="flash__icon"><?= icon('alert') ?></span><p class="flash__text"><?= h($error) ?></p></div>
<?php endif; ?>
<p class="auth__who"><?= icon('user') ?><span><?= h($reset['name']) ?> · <?= h($reset['email']) ?></span></p>
<form method="post" action="<?= h(url('reset')) ?>" class="form" data-once>
  <?= csrf_field() ?>
  <input type="hidden" name="token" value="<?= h($token) ?>">
  <input type="email" name="username" value="<?= h($reset['email']) ?>" autocomplete="username" hidden>
  <div class="field<?= $error !== '' ? ' has-error' : '' ?>">
    <label class="field__label" for="password"><?= h(t('New password')) ?></label>
    <div class="input-group">
      <input class="input" type="password" id="password" name="password" autocomplete="new-password" minlength="<?= MFS_PASSWORD_MIN ?>" required autofocus>
      <button type="button" class="input-group__btn" data-toggle-password="#password" aria-label="<?= h(t('Show password')) ?>" data-label-hide="<?= h(t('Hide password')) ?>"><?= icon('eye') ?></button>
    </div>
    <p class="field__help"><?= h(t('At least {n} characters. A short sentence you’ll remember works well.', ['n' => MFS_PASSWORD_MIN])) ?></p>
  </div>
  <div class="field">
    <label class="field__label" for="password2"><?= h(t('New password again')) ?></label>
    <input class="input" type="password" id="password2" name="password2" autocomplete="new-password" required>
  </div>
  <button type="submit" class="btn btn--primary btn--block btn--lg"><?= icon('check') ?><?= h(t('Save new password')) ?></button>
</form>
<?php
render(t('Choose a new password'), ob_get_clean(), ['layout' => 'auth']);
