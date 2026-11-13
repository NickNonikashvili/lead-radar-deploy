// Pure formatting helpers (no DOM access) so they can be unit-tested in Node.

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Compact date for message rows:
 *   today -> "9:41 AM", within the last 6 days -> "Mon",
 *   this year -> "Mar 4", older years -> "3/4/24".
 */
export function formatListDate(ms, now = Date.now(), locale = undefined) {
  if (!Number.isFinite(ms)) return '';
  const date = new Date(ms);
  const today = startOfDay(now);
  if (ms >= today && ms < today + DAY) {
    return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  }
  if (ms >= today - 6 * DAY && ms < today) {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  }
  if (date.getFullYear() === new Date(now).getFullYear()) {
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(locale, { year: '2-digit', month: 'numeric', day: 'numeric' });
}

/** Full date for the reading pane, e.g. "Thu, Mar 4, 2026, 9:41 AM". */
export function formatFullDate(ms, locale = undefined) {
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString(locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "just now", "2 min ago", "3 h ago", "yesterday", "4 days ago", or a date. */
export function timeAgo(ms, now = Date.now(), locale = undefined) {
  if (!Number.isFinite(ms)) return 'never';
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/**
 * When a queued message goes out: "in 8 s", "in 5 min", "today at 3:40 PM",
 * "tomorrow at 8:00 AM", "Mon, Nov 16 at 8:00 AM" (past times: "now").
 */
export function formatSendTime(ms, now = Date.now(), locale = undefined) {
  if (!Number.isFinite(ms)) return '';
  const diff = ms - now;
  if (diff <= 0) return 'now';
  if (diff < 60_000) return `in ${Math.ceil(diff / 1000)} s`;
  if (diff < 60 * 60_000) return `in ${Math.round(diff / 60_000)} min`;
  const time = new Date(ms).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const today = startOfDay(now);
  if (ms < today + DAY) return `today at ${time}`;
  if (ms < today + 2 * DAY) return `tomorrow at ${time}`;
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  const day = new Date(ms).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
  return `${day} at ${time}`;
}

/** One or two letters for an avatar. */
export function initials(name, email) {
  const source = String(name || '').replace(/["'()<>]/g, ' ').trim();
  if (source) {
    const parts = source.split(/\s+/).filter((p) => /\p{L}|\p{N}/u.test(p));
    if (parts.length >= 2) return (first(parts[0]) + first(parts[parts.length - 1])).toUpperCase();
    if (parts.length === 1) return first(parts[0]).toUpperCase();
  }
  const local = String(email || '').split('@')[0];
  return local ? first(local).toUpperCase() : '?';
}

function first(word) {
  // Array.from keeps surrogate pairs (emoji, CJK extension chars) intact.
  return Array.from(word)[0] || '';
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** "Name <address>" when both exist, else whichever exists. */
export function formatAddress(entry) {
  if (!entry) return '';
  const name = (entry.name || '').trim();
  const address = (entry.address || '').trim();
  if (name && address && name.toLowerCase() !== address.toLowerCase()) return `${name} <${address}>`;
  return name || address;
}

/** Short label for an address list: names when present, else addresses. */
export function shortAddressList(list, max = 3) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const labels = list.map((e) => (e && (e.name || e.address)) || '').filter(Boolean);
  if (labels.length <= max) return labels.join(', ');
  return `${labels.slice(0, max).join(', ')} +${labels.length - max}`;
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Display name for a sender with a sensible fallback. */
export function senderLabel(msg) {
  return (msg && (msg.fromName || msg.fromAddress)) || '(unknown sender)';
}

/** The domain part of an email address, lowercased ('' if none). */
export function emailDomain(email) {
  const at = String(email || '').lastIndexOf('@');
  return at >= 0 ? String(email).slice(at + 1).trim().toLowerCase() : '';
}

/** Find the preset whose domain list contains the email's domain. */
export function guessPresetKey(email, presets) {
  const domain = emailDomain(email);
  if (!domain || !Array.isArray(presets)) return null;
  const hit = presets.find((p) => Array.isArray(p.domains) && p.domains.includes(domain));
  return hit ? hit.key : null;
}
