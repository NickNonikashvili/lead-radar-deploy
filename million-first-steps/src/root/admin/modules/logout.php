<?php
// Sign out (POST only, with the CSRF token). A plain visit just goes back to the right page.
if (!is_post()) redirect(current_user() ? url('dashboard') : url('login'));
csrf_check();
$u = current_user();
if ($u) audit('auth.logout', 'user:' . $u['id']);
mfs_forget_session();
flash('ok', t('You have signed out. See you soon.'));
redirect(url('login'));
