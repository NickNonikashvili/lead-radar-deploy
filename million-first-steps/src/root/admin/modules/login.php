<?php
// Sign in. Throttled per IP hash and per email; the same answer for an unknown email and a wrong password.
if (current_user()) redirect(mfs_safe_next(get('next')));

$email = '';
$error = '';
$next = get('next');
if (is_post()) {
  csrf_check();
  $email = mfs_cut(post('email'), 200);
  $password = post_password('password');
  $remember = post('remember') === '1';
  $next = post('next');
  if (mfs_login_throttled($email)) {
    $error = t('Too many attempts. For your safety, please wait 15 minutes and then try again.');
  } else {
    $user = ($email !== '' && $password !== '') ? mfs_check_password($email, $password) : null;
    if ($user) {
      mfs_record_attempt($email, true);
      mfs_login_user($user, $remember);
      audit('auth.login', 'user:' . $user['id'], $remember ? 'Kept signed in for 30 days' : '');
      redirect(mfs_safe_next($next));
    }
    mfs_record_attempt($email, false);
    $error = t('That email and password don’t match. Please try again.');
    if (mfs_login_throttled($email)) {
      audit('auth.locked', '', 'Sign-in paused for 15 minutes after ' . MFS_THROTTLE_MAX . ' failed attempts (last email tried: ' . mfs_cut($email, 120) . ')');
      $error = t('Too many attempts. For your safety, please wait 15 minutes and then try again.');
    }
  }
}

$local = preg_match('/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/', mfs_host());
ob_start();
?>
<?php if (!mfs_is_https() && !$local): ?>
  <div class="callout callout--warn"><?= icon('alert') ?><p><?= h(t('This connection isn’t secure (the address doesn’t start with https://). Turn on “Force HTTPS” for the website in hPanel before signing in.')) ?></p></div>
<?php endif; ?>
<?php if ($error !== ''): ?>
  <div class="flash flash--error" role="alert"><span class="flash__icon"><?= icon('alert') ?></span><p class="flash__text"><?= h($error) ?></p></div>
<?php endif; ?>
<form method="post" action="<?= h(url('login')) ?>" class="form" data-once novalidate>
  <?= csrf_field() ?>
  <input type="hidden" name="next" value="<?= h($next) ?>">
  <div class="field">
    <label class="field__label" for="email"><?= h(t('Email')) ?></label>
    <input class="input" type="email" id="email" name="email" value="<?= h($email) ?>" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required <?= $email === '' ? 'autofocus' : '' ?>>
  </div>
  <div class="field">
    <div class="field__top"><label class="field__label" for="password"><?= h(t('Password')) ?></label><a class="field__link" href="<?= h(url('forgot')) ?>"><?= h(t('Forgot your password?')) ?></a></div>
    <div class="input-group">
      <input class="input" type="password" id="password" name="password" autocomplete="current-password" required <?= $email !== '' ? 'autofocus' : '' ?>>
      <button type="button" class="input-group__btn" data-toggle-password="#password" aria-label="<?= h(t('Show password')) ?>" data-label-hide="<?= h(t('Hide password')) ?>"><?= icon('eye') ?></button>
    </div>
  </div>
  <label class="check">
    <input type="checkbox" name="remember" value="1" <?= post('remember') === '1' ? 'checked' : '' ?>>
    <span class="check__box" aria-hidden="true"><?= icon('check') ?></span>
    <span class="check__label"><?= h(t('Keep me signed in on this device')) ?><span class="check__help"><?= h(t('For 30 days. Only tick this on your own phone or computer.')) ?></span></span>
  </label>
  <button type="submit" class="btn btn--primary btn--block btn--lg"><?= h(t('Sign in')) ?></button>
</form>
<?php
render(t('Sign in'), ob_get_clean(), ['layout' => 'auth', 'lead' => t('Welcome back. Sign in to see requests, bookings and the calendar.')]);
