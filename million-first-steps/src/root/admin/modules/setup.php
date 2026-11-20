<?php
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }
// First run: create the first owner with the setup key from the build. Closed for good once anyone has an account.
if (mfs_user_count() > 0) {
  if (current_user()) redirect(url('dashboard'));
  flash('info', t('The team area is already set up. Please sign in.'));
  redirect(url('login'));
}

$key = mfs_setup_key();
$errors = [];
$v = ['name' => '', 'email' => '', 'key' => ''];
if (is_post() && $key !== '') {
  csrf_check();
  $v['name'] = mfs_cut(str_replace("\n", ' ', post('name')), 100);
  $v['email'] = mfs_cut(post('email'), 200);
  $v['key'] = mfs_cut(post('key'), 40);
  $given = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $v['key']));
  $password = post_password('password');
  $confirm = post_password('password2');

  // Wrong keys are limited per visitor (IP hash), plus a high limit for everyone together: a stranger can't
  // keep the owners from finishing the setup, and a 12-character key can't be guessed either way.
  if (mfs_login_throttled('(setup)', 50)) {
    $errors['key'] = t('Too many attempts. For your safety, please wait 15 minutes and then try again.');
  } elseif ($given === '' || !hash_equals($key, $given)) {
    mfs_record_attempt('(setup)', false);
    $errors['key'] = t('That setup key isn’t right. Check it and try again — capital letters and dashes don’t matter.');
  }
  if ($v['name'] === '') $errors['name'] = t('Please enter your name.');
  if (valid_email($v['email']) === '') $errors['email'] = t('Please enter a valid email address.');
  $pp = password_problem($password, $confirm);
  if ($pp !== '') $errors['password'] = $pp;

  if (!$errors) {
    $user = db_tx(function () use ($v, $password) {
      if ((int) db_value('SELECT COUNT(*) FROM users') > 0) return null;
      $lang = mfs_lang();
      $id = db_next_id('users');
      db_exec("INSERT INTO users (id, email, name, password_hash, role, lang, active, created_at) VALUES (?, ?, ?, ?, 'owner', ?, 1, ?)",
        [$id, valid_email($v['email']), $v['name'], mfs_hash_password($password), $lang, now_utc()]);
      return db_row('SELECT * FROM users WHERE id = ?', [$id]);
    });
    if (!$user) {
      flash('info', t('The team area is already set up. Please sign in.'));
      redirect(url('login'));
    }
    mfs_record_attempt('(setup)', true);
    mfs_login_user($user, false);
    audit('auth.setup', 'user:' . $user['id'], 'First owner account created');
    flash('ok', t('Welcome, {name}! Your owner account is ready. You can invite the rest of the team under Team.', ['name' => $user['name']]));
    redirect(url('dashboard'));
  }
}

$err = function ($k) use ($errors) {
  return isset($errors[$k]) ? '<p class="field__error" id="err-' . h($k) . '">' . icon('alert') . h($errors[$k]) . '</p>' : '';
};
$inv = function ($k) use ($errors) {
  return isset($errors[$k]) ? ' aria-invalid="true" aria-describedby="err-' . h($k) . '"' : '';
};
ob_start();
if ($key === ''): ?>
  <div class="callout callout--danger"><?= icon('alert') ?><p><?= h(t('The setup key file (admin/lib/setup-key.php) is missing. Build the website again and upload the new files, then come back to this page.')) ?></p></div>
<?php else: ?>
<?php if ($errors): ?>
  <div class="flash flash--error" role="alert"><span class="flash__icon"><?= icon('alert') ?></span><p class="flash__text"><?= h(t('Please check the highlighted fields.')) ?></p></div>
<?php endif; ?>
<form method="post" action="<?= h(url('setup')) ?>" class="form" data-once novalidate>
  <?= csrf_field() ?>
  <div class="field<?= isset($errors['key']) ? ' has-error' : '' ?>">
    <label class="field__label" for="key"><?= h(t('Setup key')) ?></label>
    <input class="input input--key mono" id="key" name="key" value="<?= h($v['key']) ?>" autocomplete="off" autocapitalize="characters" spellcheck="false" required autofocus placeholder="XXXX-XXXX-XXXX"<?= $inv('key') ?>>
    <p class="field__help"><?= h(t('The 12-character key that came with the website files. You only need it once.')) ?></p>
    <?= $err('key') ?>
  </div>
  <div class="divider"></div>
  <div class="field<?= isset($errors['name']) ? ' has-error' : '' ?>">
    <label class="field__label" for="name"><?= h(t('Your name')) ?></label>
    <input class="input" id="name" name="name" value="<?= h($v['name']) ?>" autocomplete="name" required<?= $inv('name') ?>>
    <?= $err('name') ?>
  </div>
  <div class="field<?= isset($errors['email']) ? ' has-error' : '' ?>">
    <label class="field__label" for="email"><?= h(t('Email')) ?></label>
    <input class="input" type="email" id="email" name="email" value="<?= h($v['email']) ?>" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required<?= $inv('email') ?>>
    <p class="field__help"><?= h(t('You’ll sign in with this address. Password reset links are sent here.')) ?></p>
    <?= $err('email') ?>
  </div>
  <div class="field<?= isset($errors['password']) ? ' has-error' : '' ?>">
    <label class="field__label" for="password"><?= h(t('Password')) ?></label>
    <div class="input-group">
      <input class="input" type="password" id="password" name="password" autocomplete="new-password" minlength="<?= MFS_PASSWORD_MIN ?>" required<?= $inv('password') ?>>
      <button type="button" class="input-group__btn" data-toggle-password="#password" aria-label="<?= h(t('Show password')) ?>" data-label-hide="<?= h(t('Hide password')) ?>"><?= icon('eye') ?></button>
    </div>
    <p class="field__help"><?= h(t('At least {n} characters. A short sentence you’ll remember works well.', ['n' => MFS_PASSWORD_MIN])) ?></p>
    <?= $err('password') ?>
  </div>
  <div class="field">
    <label class="field__label" for="password2"><?= h(t('Password again')) ?></label>
    <input class="input" type="password" id="password2" name="password2" autocomplete="new-password" required>
  </div>
  <button type="submit" class="btn btn--primary btn--block btn--lg"><?= icon('key') ?><?= h(t('Create owner account')) ?></button>
</form>
<?php endif;
render(t('Set up the team area'), ob_get_clean(), ['layout' => 'auth', 'lead' => t('Welcome! Let’s create the first owner account. You can add the rest of the team afterwards.')]);
