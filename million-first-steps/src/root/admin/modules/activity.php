<?php
// Placeholder for the "Activity" page (?p=activity) — the engineer building this page replaces this whole file.
$me = require_owner();
render(t('Activity'), '<div class="card empty"><div class="empty__mark" aria-hidden="true">' . icon('history') . '</div>'
  . '<h2 class="empty__title">' . h(t('This page is being built')) . '</h2>'
  . '<p class="empty__text">' . h(t('It will be ready soon. Everything else in the menu works as usual.')) . '</p></div>', ['nav' => 'settings']);
