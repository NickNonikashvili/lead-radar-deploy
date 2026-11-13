// Address helpers for the recipient fields (pure, unit-tested in Node).

export const MAX_RECIPIENTS = 100;

// Practical check, close to what mail servers accept: local@domain.tld, no spaces, no
// characters that need quoting, a dotted domain with a 2+ character TLD (IDN letters allowed).
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@(?=.{1,253}$)(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}\p{N}-]{2,63}$/u;

export function isValidEmail(address) {
  if (typeof address !== 'string') return false;
  const a = address.trim();
  if (!a || a.length > 254 || /[\u0000-\u001f\u007f]/.test(a)) return false;
  if (a.startsWith('.') || a.includes('..') || a.split('@')[0].endsWith('.')) return false;
  return EMAIL.test(a);
}

function unquote(name) {
  let n = String(name || '').trim();
  if (n.length >= 2 && ((n[0] === '"' && n[n.length - 1] === '"') || (n[0] === "'" && n[n.length - 1] === "'"))) {
    n = n.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return n.replace(/\s+/g, ' ').trim();
}

/** Split on , ; and newlines that are outside "quotes" and <angle brackets>. */
function tokenize(text) {
  const tokens = [];
  let cur = '';
  let quote = false;
  let angle = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\\' && quote && i + 1 < text.length) {
      cur += ch + text[i + 1];
      i += 1;
      continue;
    }
    if (ch === '"') quote = !quote;
    else if (!quote && ch === '<') angle = true;
    else if (!quote && ch === '>') angle = false;
    if (!quote && !angle && (ch === ',' || ch === ';' || ch === '\n' || ch === '\r')) {
      tokens.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  tokens.push(cur);
  return tokens.map((t) => t.trim()).filter(Boolean);
}

/** One "Name <addr>", "addr" or "Name addr" token -> { name, address }. */
export function parseAddress(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  let name = '';
  let address = '';
  const angle = /^([\s\S]*?)<([^<>]*)>\s*$/.exec(t);
  if (angle) {
    name = unquote(angle[1]);
    address = angle[2];
  } else {
    const m = /^([\s\S]*?)\s+(\S+@\S+)$/.exec(t);
    if (m && m[1].trim() && !m[1].includes('@')) {
      name = unquote(m[1]);
      address = m[2];
    } else {
      address = t;
    }
  }
  address = address.trim().replace(/^mailto:/i, '').replace(/^[("'[]+|[)"'\]]+$/g, '').trim();
  if (name && name.toLowerCase() === address.toLowerCase()) name = '';
  return { name, address };
}

/**
 * Parse a pasted/typed list: "Ada <ada@x.org>, "Doe, John" <j@d.com>; bob@y.com".
 * Unquoted "Last, First <addr>" (as some clients copy it) is glued back together.
 */
const WORD = /^\p{L}[\p{L}.'-]*$/u;

export function parseAddressList(text) {
  const tokens = tokenize(String(text || ''));
  const merged = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    const nextName = next ? next.replace(/<[^<>]*>\s*$/, '').trim() : '';
    if (WORD.test(t) && next && /<[^<>]*@[^<>]*>\s*$/.test(next) && WORD.test(nextName)) {
      merged.push(`"${t}, ${nextName}" ${next.slice(next.lastIndexOf('<'))}`);
      i += 1;
      continue;
    }
    merged.push(t);
  }
  return merged.map(parseAddress).filter((a) => a && (a.address || a.name));
}

/**
 * While typing: split off everything before the last top-level separator.
 * "ada@x.org, bo" -> { complete: [{ address: 'ada@x.org' }], rest: 'bo' }.
 */
export function splitTyped(text) {
  const s = String(text || '');
  let quote = false;
  let angle = false;
  let last = -1;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '"') quote = !quote;
    else if (!quote && ch === '<') angle = true;
    else if (!quote && ch === '>') angle = false;
    else if (!quote && !angle && (ch === ',' || ch === ';' || ch === '\n' || ch === '\r')) last = i;
  }
  if (last < 0) return { complete: [], rest: s };
  return { complete: parseAddressList(s.slice(0, last)), rest: s.slice(last + 1).replace(/^\s+/, '') };
}

/** A recipient object for the UI: { key, name, address, valid }. */
let keySeq = 0;
export function makeRecipient(entry) {
  const name = String((entry && entry.name) || '').trim().slice(0, 200);
  const address = String((entry && entry.address) || '').trim().slice(0, 320);
  keySeq += 1;
  return { key: `r${keySeq}`, name, address, valid: isValidEmail(address) };
}

export function sameAddress(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

/** Add entries to a list, skipping duplicates (case-insensitive) and capping at MAX_RECIPIENTS. */
export function addRecipients(list, entries) {
  const out = [...list];
  for (const e of entries) {
    if (!e || !e.address) continue;
    if (out.some((r) => sameAddress(r.address, e.address))) continue;
    if (out.length >= MAX_RECIPIENTS) break;
    out.push(e.key ? e : makeRecipient(e));
  }
  return out;
}

/** "Ada Lovelace <ada@x.org>" with the name quoted when it contains specials. */
export function formatRecipient(r) {
  if (!r) return '';
  const name = String(r.name || '').trim();
  if (!name) return r.address || '';
  const safe = /[",;<>@()[\]\\:]/.test(name) ? `"${name.replace(/(["\\])/g, '\\$1')}"` : name;
  return `${safe} <${r.address}>`;
}

/** Short chip label: the name, else the address. */
export function recipientLabel(r) {
  return (r && (String(r.name || '').trim() || r.address)) || '';
}
