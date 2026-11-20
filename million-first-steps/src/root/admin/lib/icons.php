<?php
/*
 * Inline SVG icons (24×24, stroke = currentColor, 1.8 wide). icon('inbox') → <svg class="icon icon--inbox" …>.
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

const MFS_ICONS = [
  'dashboard' => '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
  'inbox' => '<path d="M21.5 12.5h-5.5l-1.8 2.7h-4.4l-1.8-2.7H2.5"/><path d="M5.6 5.2 2.5 12.5v5.5a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-5.5l-3.1-7.3A2 2 0 0 0 16.6 4H7.4a2 2 0 0 0-1.8 1.2z"/>',
  'calendar' => '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/>',
  'suitcase' => '<rect x="2.5" y="7" width="19" height="13.5" rx="2.5"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M7 7v13.5M17 7v13.5"/>',
  'chart' => '<path d="M3.5 3.5v15.5a1.5 1.5 0 0 0 1.5 1.5h15.5"/><path d="M7.5 15.5l3.8-4.3 3 2.8 5.2-6.5"/>',
  'tag' => '<path d="M20.4 13.6 13.6 20.4a2 2 0 0 1-2.8 0L3 12.6V3h9.6l7.8 7.8a2 2 0 0 1 0 2.8z"/><circle cx="7.6" cy="7.6" r="1.6"/>',
  'settings' => '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  'users' => '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><circle cx="17.2" cy="9" r="2.7"/><path d="M16.3 13.8c2.9.3 5.2 2.8 5.2 5.9"/>',
  'user' => '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  'logout' => '<path d="M9.5 20.5H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4.5"/><path d="M15.5 16.5 20 12l-4.5-4.5M20 12H9"/>',
  'search' => '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  'plus' => '<path d="M12 5v14M5 12h14"/>',
  'download' => '<path d="M12 3.5v11.5M7 10l5 5 5-5M4.5 20.5h15"/>',
  'mail' => '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.8 8.5-6.8"/>',
  'phone' => '<path d="M21.5 16.6v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.6 3.9 2 2 0 0 1 3.6 1.7h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L7.6 9.4a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z"/>',
  'whatsapp' => '<path d="M3.5 20.5 4.9 16A8.6 8.6 0 1 1 8 19.2z"/><path d="M9 8.3c.2-.5.6-.6 1-.6.3 0 .5.4.7 1l.4 1c.1.3 0 .6-.3.9l-.4.4c.6 1.2 1.6 2.2 2.8 2.8l.4-.4c.3-.3.6-.4.9-.3l1 .4c.6.2 1 .4 1 .7 0 .4-.1.8-.6 1-1.5.8-3.4.2-5.2-1.5-1.8-1.8-2.4-3.8-1.7-5.4z"/>',
  'edit' => '<path d="M12.5 20.5h8"/><path d="M16.6 3.6a2.1 2.1 0 0 1 3 3L7.3 18.9l-4 1 1-4z"/>',
  'trash' => '<path d="M3.5 6.5h17M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7M18.5 6.5l-.8 12.6a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 6.5M10 11v5.5M14 11v5.5"/>',
  'check' => '<path d="M20 6.5 9.5 17 4 11.5"/>',
  'arrow' => '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  'arrow-left' => '<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>',
  'external' => '<path d="M14 3.5h6.5V10M20.5 3.5 11 13M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5h5"/>',
  'menu' => '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  'close' => '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-left' => '<path d="m14.5 6-6 6 6 6"/>',
  'chevron-right' => '<path d="m9.5 6 6 6-6 6"/>',
  'chevron-down' => '<path d="m6 9.5 6 6 6-6"/>',
  'copy' => '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  'eye' => '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off' => '<path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  'alert' => '<path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  'info' => '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
  'globe' => '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  'note' => '<path d="M14 3H6.5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5z"/><path d="M14 3v5.5h5.5M8.5 13h7M8.5 17h4.5"/>',
  'euro' => '<path d="M17.5 6.5a7 7 0 1 0 0 11"/><path d="M4 10h9M4 14h9"/>',
  'lock' => '<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  'key' => '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2.2 2.2"/>',
  'home' => '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1z"/>',
  'refresh' => '<path d="M20.5 12a8.5 8.5 0 0 1-14.7 5.8M3.5 12A8.5 8.5 0 0 1 18.2 6.2"/><path d="M18.5 2.5v4h-4M5.5 21.5v-4h4"/>',
  'bell' => '<path d="M6 8.5a6 6 0 0 1 12 0c0 7 3 8.5 3 8.5H3s3-1.5 3-8.5"/><path d="M10.3 20.5a1.9 1.9 0 0 0 3.4 0"/>',
  'filter' => '<path d="M3.5 5h17l-6.5 8v6l-4 2v-8z"/>',
  'star' => '<path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1.1 6.1L12 17.1 6.4 20l1.1-6.1L3 9.5l6.2-.9z"/>',
  'map-pin' => '<path d="M12 21.5s7-6 7-11.5a7 7 0 0 0-14 0c0 5.5 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.5"/>',
  'send' => '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>',
  'history' => '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5V8H8M12 7.5V12l3 2"/>',
  'shield' => '<path d="M12 21s8-3.5 8-10V5l-8-3-8 3v6c0 6.5 8 10 8 10z"/><path d="m8.5 11.5 2.5 2.5 4.5-4.5"/>',
  'flag' => '<path d="M4.5 21V4M4.5 4h12l-2 4 2 4h-12"/>',
  'link' => '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  'print' => '<path d="M6.5 9V3.5h11V9M6.5 17.5h-2a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-2"/><rect x="6.5" y="14" width="11" height="7" rx="1"/>',
  'more' => '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  'sun' => '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  'telegram' => '<path d="m21.5 3.5-19 7.3 6.2 2.2 2.3 7 3.5-4.6 5 3.6z"/><path d="m8.7 13 9.3-6.5-6.9 8.4"/>',
];

/** An inline SVG icon (decorative: aria-hidden). Unknown names give an empty string. */
function icon($name): string
{
  $n = (string) $name;
  if (!isset(MFS_ICONS[$n])) return '';
  return '<svg class="icon icon--' . $n . '" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . MFS_ICONS[$n] . '</svg>';
}
