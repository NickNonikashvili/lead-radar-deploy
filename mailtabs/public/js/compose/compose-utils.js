// Pure helpers for the composer (no DOM, no network): limits, scheduling, attachments,
// quote/signature handling on sanitised trees. Unit-tested in Node.
import { formatBytes } from '../format.js';
import { isTreeEmpty, parseHtml, sanitizeTree, treeText } from './sanitize.js';

export { formatBytes };

export const LIMITS = {
  maxRecipients: 100,
  maxSubject: 998,
  maxHtmlBytes: 2_000_000,
  maxAttachmentBytes: 25 * 1024 * 1024, // all attachments together
  maxSignatureBytes: 20 * 1024,
  maxSenderName: 100,
  maxScheduleMs: 365 * 24 * 60 * 60 * 1000,
};

export const MODES = ['new', 'reply', 'replyAll', 'forward', 'draft', 'outbox'];

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// ------------------------------------------------------------------------------- formatting

/** UTF-8 byte length without TextEncoder (works everywhere). */
export function byteLength(str) {
  let n = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i += 1;
    } else n += 3;
  }
  return n;
}

/** Title for a composer window. */
export function composerTitle(mode, subject) {
  const s = String(subject || '').trim();
  if (s) return s;
  if (mode === 'reply' || mode === 'replyAll') return 'Reply';
  if (mode === 'forward') return 'Forward';
  if (mode === 'draft' || mode === 'outbox') return 'Draft';
  return 'New message';
}

// ------------------------------------------------------------------------------- scheduling

function atHour(base, daysAhead, hour) {
  const d = new Date(base);
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/** Preset send times: tomorrow 8 AM and next Monday 8 AM (deduplicated). */
export function scheduleOptions(now = Date.now()) {
  const day = new Date(now).getDay(); // 0 = Sunday
  const tomorrow = atHour(now, 1, 8);
  const monday = atHour(now, ((8 - day) % 7) || 7, 8);
  const options = [{ id: 'tomorrow', label: 'Tomorrow morning', at: tomorrow }];
  if (monday !== tomorrow) options.push({ id: 'monday', label: 'Monday morning', at: monday });
  return options;
}

export function formatSendTime(ms, now = Date.now(), locale = undefined) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((ms - startToday.getTime()) / DAY);
  if (diffDays === 0) return `today, ${time}`;
  if (diffDays === 1) return `tomorrow, ${time}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const date = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  return `${date}, ${time}`;
}

/** Value for <input type="datetime-local"> in local time ("2026-11-14T08:00"). */
export function toLocalInputValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a datetime-local value as local time; NaN when malformed. */
export function parseLocalInputValue(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return NaN;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
  // Reject roll-overs such as Feb 31 and times skipped by a DST change.
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3]) || d.getHours() !== Number(m[4])) return NaN;
  return d.getTime();
}

/** null when ok, else a message for the user. */
export function validateSendAt(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return 'Pick a date and time.';
  if (ms < now + MINUTE) return 'Pick a time in the future.';
  if (ms > now + LIMITS.maxScheduleMs) return 'You can schedule up to a year ahead.';
  return null;
}

// ------------------------------------------------------------------------------- attachments

export function cleanFilename(name, fallback = 'attachment') {
  const cleaned = String(name || '')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return cleaned && !/^\.+$/.test(cleaned) ? cleaned : fallback;
}

/** Filename for a pasted image (clipboard images are usually called "image.png"). */
export function pastedImageName(type, now = Date.now()) {
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[type] || 'png';
  const d = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `pasted-image-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
}

export function attachmentsTotal(list) {
  return (list || []).reduce((sum, a) => sum + (a && a.status !== 'error' && Number.isFinite(a.size) ? a.size : 0), 0);
}

/**
 * Which of `files` ({ name, size }) fit next to the existing attachments.
 * -> { accepted: File[], rejected: [{ file, message }] }
 */
export function checkAttachmentFiles(existing, files, max = LIMITS.maxAttachmentBytes) {
  let total = attachmentsTotal(existing);
  const accepted = [];
  const rejected = [];
  for (const file of files || []) {
    const size = Number(file && file.size) || 0;
    const name = cleanFilename(file && file.name);
    if (size > max) {
      rejected.push({ file, message: `“${name}” is ${formatBytes(size)}. Attachments can be up to ${formatBytes(max)} in total.` });
    } else if (total + size > max) {
      rejected.push({ file, message: `“${name}” (${formatBytes(size)}) doesn't fit: attachments can be up to ${formatBytes(max)} in total.` });
    } else {
      total += size;
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

export function isImageType(type) {
  return /^image\//i.test(String(type || ''));
}

// ------------------------------------------------------------------------------- body helpers

const ATTRIBUTION = /(wrote|schrieb|a écrit|escribió|scrisse|schreef|написал|skrev|kirjoitti):?\s*$/i;

function nodeText(node) {
  return treeText({ kids: [node] });
}

function isBlank(node) {
  if (!node) return true;
  if (node.t === 'text') return !node.v.replace(/[\s ​]+/g, '');
  if (node.tag === 'br') return true;
  if (node.tag === 'div' || node.tag === 'p' || node.tag === 'span') return isTreeEmpty({ kids: node.kids || [] });
  return false;
}

function lastMeaningful(kids, before = kids.length) {
  let i = before - 1;
  while (i >= 0 && isBlank(kids[i])) i -= 1;
  return i;
}

/**
 * Split a reply body into what the user writes and the quoted original, so the quote can be
 * collapsed behind "…". Only a quote at the very end is split off (inline replies stay).
 * -> { body: tree, quote: tree | null }
 */
export function splitQuote(tree) {
  const kids = (tree && tree.kids) || [];
  const last = lastMeaningful(kids);
  if (last < 0) return { body: tree, quote: null };
  const node = kids[last];
  let isQuote = node.t === 'el' && node.tag === 'blockquote';
  if (!isQuote && node.t === 'el' && node.tag === 'div') {
    // e.g. <div><div>On ... wrote:</div><blockquote>...</blockquote></div>
    const inner = node.kids || [];
    const k = lastMeaningful(inner);
    isQuote = k >= 0 && inner[k].t === 'el' && inner[k].tag === 'blockquote' && ATTRIBUTION.test(nodeText({ t: 'el', kids: inner.slice(0, k) }).trim());
  }
  if (!isQuote) return { body: tree, quote: null };
  let start = last;
  const prev = lastMeaningful(kids, last);
  if (prev >= 0) {
    const text = nodeText(kids[prev]).trim();
    if (text.length < 400 && ATTRIBUTION.test(text)) start = prev;
  }
  // Trailing blank lines stay out of the body: one separator is added back when the quote is
  // re-joined (see QUOTE_SEPARATOR), so reopening a draft doesn't add a blank line each time.
  const bodyEnd = lastMeaningful(kids, start) + 1;
  return {
    body: { ...tree, kids: kids.slice(0, bodyEnd) },
    quote: { t: 'el', tag: '#root', attrs: [], kids: kids.slice(start) },
  };
}

function normaliseText(s) {
  return String(s || '').replace(/[\s ​]+/g, ' ').trim();
}

const isMarked = (n) => n.t === 'el' && (n.attrs || []).some((a) => a[0] === 'data-mt-signature');
const QUOTE_START = /forwarded message|original message|wrote:/i;

function stripMarkers(node) {
  if (node.t !== 'el') return node;
  return { ...node, attrs: (node.attrs || []).filter((a) => a[0] !== 'data-mt-signature'), kids: (node.kids || []).map(stripMarkers) };
}

/**
 * Keep only our own signature marker: the first top-level one before any quoted/forwarded
 * content. Markers inside quoted mail (e.g. another Mailtabs user's signature) are removed so
 * switching From never replaces somebody else's signature.
 */
export function keepOwnSignatureMarker(tree) {
  let kept = false;
  let pastQuote = false;
  const kids = ((tree && tree.kids) || []).map((n) => {
    if (n.t !== 'el') return n;
    if (!pastQuote && (n.tag === 'blockquote' || (!isMarked(n) && QUOTE_START.test(nodeText(n))))) pastQuote = true;
    if (isMarked(n) && !kept && !pastQuote) {
      kept = true;
      return { ...n, kids: (n.kids || []).map(stripMarkers) };
    }
    return stripMarkers(n);
  });
  return { ...tree, kids };
}

/**
 * Make sure the signature block in `tree` carries data-mt-signature so it can be swapped when
 * the From account changes. When the server didn't mark it, look for top-level nodes whose
 * text equals the signature's text and wrap them. Returns a new tree.
 */
export function markSignature(tree, signatureHtml) {
  const kids = (tree && tree.kids) || [];
  if (kids.some(isMarked)) return tree;
  const sigText = normaliseText(treeText(sanitizeTree(parseHtml(signatureHtml || ''))));
  if (!sigText) return tree;
  const limit = Math.min(kids.length, 60);
  for (let start = 0; start < limit; start += 1) {
    if (isBlank(kids[start])) continue;
    let acc = '';
    for (let end = start; end < limit; end += 1) {
      acc += nodeText(kids[end]);
      const norm = normaliseText(acc);
      if (norm === sigText) {
        const wrapped = { t: 'el', tag: 'div', attrs: [['data-mt-signature', '1']], kids: kids.slice(start, end + 1) };
        return { ...tree, kids: [...kids.slice(0, start), wrapped, ...kids.slice(end + 1)] };
      }
      if (norm.length > sigText.length || !sigText.startsWith(norm)) break;
    }
  }
  return tree;
}

/** Blank line between the message and a re-joined quote. */
export const QUOTE_SEPARATOR = '<div><br></div>';

/** Starting HTML for a new message: an empty line, then the signature (if any). */
export function newMessageHtml(signatureHtml) {
  const sig = String(signatureHtml || '').trim();
  return sig ? `<div><br></div><div><br></div><div data-mt-signature="1">${sig}</div>` : '<div><br></div>';
}

/** Does the text the user wrote talk about attachments? (For the "forgot to attach?" check.) */
export function mentionsAttachment(text) {
  return /\b(attach(ed|ment|ments|ing)?|enclosed|anbei|angehängt|pièce jointe|adjunto|in allegato)\b/i.test(String(text || ''));
}
