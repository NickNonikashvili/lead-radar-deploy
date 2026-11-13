// UI constants shared by several components.

/** Eight preset colors for accounts and tabs (first is the brand indigo). */
export const SWATCHES = [
  { value: '#4f46e5', name: 'Indigo' },
  { value: '#2563eb', name: 'Blue' },
  { value: '#0891b2', name: 'Teal' },
  { value: '#059669', name: 'Green' },
  { value: '#d97706', name: 'Amber' },
  { value: '#dc2626', name: 'Red' },
  { value: '#db2777', name: 'Pink' },
  { value: '#7c3aed', name: 'Violet' },
];

/**
 * Display info for provider presets. The server's `presets` (GET /api/config)
 * stay the source of truth for hosts/auth; this only adds tile labels and a
 * neutral letter mark (no third-party logos are bundled).
 */
export const PROVIDER_UI = {
  gmail: { label: 'Gmail', mark: 'G', tint: '#ea4335' },
  outlook: { label: 'Outlook / Hotmail / Microsoft 365', short: 'Outlook', mark: 'O', tint: '#0a64c8' },
  yahoo: { label: 'Yahoo', mark: 'Y', tint: '#6001d2' },
  icloud: { label: 'iCloud', mark: 'i', tint: '#3b82f6' },
  aol: { label: 'AOL', mark: 'A', tint: '#1f2937' },
  fastmail: { label: 'Fastmail', mark: 'F', tint: '#2563eb' },
  zoho: { label: 'Zoho', mark: 'Z', tint: '#d97706' },
  gmx: { label: 'GMX', mark: 'G', tint: '#1c449b' },
  yandex: { label: 'Yandex', mark: 'Y', tint: '#dc2626' },
  imap: { label: 'Other (IMAP)', short: 'IMAP', mark: '', tint: '#64748b' },
};

/** Order of provider tiles in the Add account dialog. */
export const PROVIDER_ORDER = ['gmail', 'outlook', 'yahoo', 'icloud', 'aol', 'fastmail', 'zoho', 'gmx', 'yandex', 'imap'];

export function providerLabel(key, presets, { short = false } = {}) {
  const ui = PROVIDER_UI[key];
  if (ui) return short ? ui.short || ui.label : ui.label;
  const preset = (presets || []).find((p) => p.key === key);
  return (preset && preset.label) || key || 'Email';
}

export const RULE_FIELDS = [
  { value: 'from', label: 'From' },
  { value: 'to', label: 'To' },
  { value: 'subject', label: 'Subject' },
  { value: 'body', label: 'Body' },
];

export const RULE_OPS = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: "doesn't contain" },
];

export const MAX_RULES = 20;
export const MAX_TAB_NAME = 40;

export const SHORTCUTS = [
  { keys: ['c'], label: 'Compose' },
  { keys: ['j'], label: 'Next message' },
  { keys: ['k'], label: 'Previous message' },
  { keys: ['Enter', 'o'], label: 'Open message' },
  { keys: ['r'], label: 'Reply' },
  { keys: ['a'], label: 'Reply all' },
  { keys: ['f'], label: 'Forward' },
  { keys: ['e'], label: 'Archive' },
  { keys: ['#'], label: 'Delete' },
  { keys: ['v'], label: 'Move to…' },
  { keys: ['!'], label: 'Report spam / not spam' },
  { keys: ['s'], label: 'Star / unstar' },
  { keys: ['u'], label: 'Mark read / unread' },
  { keys: ['x'], label: 'Select / deselect' },
  { keys: ['z'], label: 'Undo the last move' },
  { keys: ['/'], label: 'Search' },
  { keys: ['Esc'], label: 'Close message / clear selection' },
];

/**
 * Views that combine one kind of folder across every account (plus the outbox).
 * `specialUse` is the folder type the view is made of.
 */
export const UNIFIED_VIEWS = [
  { id: 'starred', label: 'Starred', icon: 'star' },
  { id: 'sent', label: 'Sent', icon: 'send', specialUse: '\\Sent' },
  { id: 'drafts', label: 'Drafts', icon: 'draft', specialUse: '\\Drafts' },
  { id: 'outbox', label: 'Outbox', icon: 'outbox' },
  { id: 'junk', label: 'Spam', icon: 'spam', specialUse: '\\Junk' },
  { id: 'trash', label: 'Trash', icon: 'trash', specialUse: '\\Trash' },
];

/** Undo-send delay choices (seconds) offered in Settings. */
export const UNDO_SEND_CHOICES = [0, 5, 10, 20, 30];

export const MOBILE_QUERY = '(max-width: 767px)';
/** At and above this width the sidebar is always on screen (else it's a drawer). */
export const DESKTOP_QUERY = '(min-width: 1024px)';

export const SEARCH_INPUT_ID = 'mailtabs-search';
