<?php
// Forgot password: emails a single-use link (1 hour). Always the same answer, whether or not the address has an account.
if (current_user()) redirect(url('account'));

$sent = false;
$email = '';
if (is_post()) {
  csrf_check();
  $email = mfs_cut(post('email'), 200);
  $addr = valid_email($email);
  if ($addr !== '' && !mfs_login_throttled($addr)) {
    $u = db_row('SELECT * FROM users WHERE email = ? AND active = 1', [$addr]);
    // At most 3 waiting links per person, so nobody can flood an inbox.
    if ($u && (int) db_value('SELECT COUNT(*) FROM password_resets WHERE user_id = ? AND used_at IS NULL AND expires_at > ?', [(int) $u['id'], time()]) < 3) {
      $link = mfs_create_reset_link((int) $u['id']);
      $prev = $GLOBALS['mfs_user'] ?? null;
      $GLOBALS['mfs_user'] = $u;           // write the email in their language
      $body = t('Hello {name},', ['name' => $u['name']]) . "\n\n"
        . t('Someone (hopefully you) asked to reset the password for the Million First Steps team area.') . "\n\n"
        . t('Choose a new password here — the link works once, for one hour:') . "\n" . $link . "\n\n"
        . t('If you didn’t ask for this, you can ignore this email; your password stays the same.') . "\n\n"
        . "— Million First Steps\n";
      $subject = t('Reset your password — Million First Steps');
      $GLOBALS['mfs_user'] = $prev;
      if (!send_mail($u['email'], $subject, $body)) error_log('[mfs-admin] password reset email could not be sent to user ' . $u['id']);
      audit('auth.reset_requested', 'user:' . $u['id']);
    }
  }
  flash('info', t('If this address has an account, we’ve sent it a link to choose a new password. It works for one hour. Check the spam folder if it doesn’t arrive in a few minutes.'));
  redirect(url('forgot', ['sent' => 1]));
}
$sent = get('sent') === '1';

ob_start(); ?>
<?php if (!$sent): ?>
<form method="post" action="<?= h(url('forgot')) ?>" class="form" data-once>
  <?= csrf_field() ?>
  <div class="field">
    <label class="field__label" for="email"><?= h(t('Email')) ?></label>
    <input class="input" type="email" id="email" name="email" value="<?= h($email) ?>" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required autofocus>
  </div>
  <button type="submit" class="btn btn--primary btn--block btn--lg"><?= icon('send') ?><?= h(t('Send me a link')) ?></button>
</form>
<?php endif; ?>
<p class="auth__back"><a href="<?= h(url('login')) ?>"><?= icon('arrow-left') ?><?= h(t('Back to sign in')) ?></a></p>
<?php
render(t('Forgot your password?'), ob_get_clean(), ['layout' => 'auth', 'lead' => $sent ? '' : t('Enter the email address you sign in with. We’ll send you a link to choose a new password.')]);
