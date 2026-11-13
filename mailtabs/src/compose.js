'use strict';

/**
 * Composing mail: validating what the composer sends, building the MIME message, and
 * preparing replies / forwards / reopened drafts. Pure: no network, no file access.
 *
 * Header injection: addresses with control characters are refused, and names, the subject
 * and filenames have every control character replaced before nodemailer (which encodes
 * headers itself) ever sees them.
 */

const nodeCrypto = require('crypto');
const { domainToASCII } = require('url');
const sanitizeHtml = require('sanitize-html');
const MailComposer = require('nodemailer/lib/mail-composer');
const addressparser = require('nodemailer/lib/addressparser');
const { HttpError } = require('./errors');
const { htmlToPlainText, escapeHtml, linkifyText, rewriteCidLinks } = require('./mailparse');

const COMPOSE_LIMITS = Object.freeze({
  maxRecipients: 100,
  maxSubject: 998,
  maxHtmlBytes: 2_000_000,
  maxAttachmentBytes: 25 * 1024 * 1024, // all attachments together
});
const MAX_ATTACHMENTS = 100;
const MAX_REFERENCES = 50;
const MAX_NAME = 200;

// Every C0/C1 control character plus the Unicode line/paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;
// eslint-disable-next-line no-control-regex
const HAS_CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

function invalid(message) {
  return new HttpError(400, message, 'INVALID_COMPOSE');
}

/** One line of header text: control characters (CR, LF, TAB...) become spaces. */
function headerText(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(CONTROL_CHARS, ' ').replace(/\s{2,}/g, ' ').trim();
}

// ---------------------------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------------------------

const LOCAL_PART = /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+(?:\.[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+)*$/u;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The address, normalised (domain lower-cased), or null when it is not a usable address. */
function normalizeAddress(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.length > 254 || HAS_CONTROL.test(s) || /\s/.test(s)) return null;
  const at = s.lastIndexOf('@');
  if (at < 1 || at === s.length - 1) return null;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1).toLowerCase();
  if (local.length > 64 || !LOCAL_PART.test(local)) return null;
  const ascii = domainToASCII(domain);
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split('.');
  if (labels.length < 2 || !labels.every((l) => DNS_LABEL.test(l)) || /^\d+$/.test(labels[labels.length - 1])) return null;
  return `${local}@${domain}`;
}

function isValidAddress(value) {
  return normalizeAddress(value) !== null;
}

/** { name, address } from an object or an "Name <addr>" / "addr" string, or throws 400. */
function recipient(entry, field) {
  let name = '';
  let address = '';
  if (typeof entry === 'string') {
    if (HAS_CONTROL.test(entry)) throw invalid(`${field}: an address contains invalid characters.`);
    const parsed = addressparser(entry).filter((a) => !a.group);
    if (parsed.length !== 1) throw invalid(`${field}: "${headerText(entry).slice(0, 80)}" is not a valid email address.`);
    name = parsed[0].name || '';
    address = parsed[0].address || '';
  } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    if (entry.name !== undefined && entry.name !== null && typeof entry.name !== 'string') throw invalid(`${field}: names must be text.`);
    if (typeof entry.address !== 'string') throw invalid(`${field}: every recipient needs an email address.`);
    name = entry.name || '';
    address = entry.address;
  } else {
    throw invalid(`${field}: every recipient needs an email address.`);
  }
  const normalized = normalizeAddress(address);
  if (!normalized) throw invalid(`${field}: "${headerText(address).slice(0, 80)}" is not a valid email address.`);
  return { name: headerText(name).slice(0, MAX_NAME), address: normalized };
}

function recipientList(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw invalid(`${field} must be a list of recipients.`);
  if (value.length > COMPOSE_LIMITS.maxRecipients) throw invalid(`Too many recipients (at most ${COMPOSE_LIMITS.maxRecipients}).`);
  return value.map((entry) => recipient(entry, field));
}

/** Remove duplicates (case-insensitive) within and across the lists, earlier lists win. */
function dedupeRecipients(lists, seen = new Set()) {
  return lists.map((list) =>
    list.filter((r) => {
      const key = r.address.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  );
}

// ---------------------------------------------------------------------------------------------
// Message-IDs
// ---------------------------------------------------------------------------------------------

/** '<id@host>' (brackets added when missing), or null when it is not a plausible Message-ID. */
function normalizeMessageId(value) {
  if (typeof value !== 'string') return null;
  let s = value.trim();
  if (!s) return null;
  if (!s.startsWith('<')) s = `<${s}>`;
  return /^<[\x21-\x3b\x3d\x3f-\x7e]{1,995}>$/.test(s) ? s : null;
}

function normalizeReferences(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value.slice(0, 500)) {
    const id = normalizeMessageId(item);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  // RFC 5322 §3.6.4: keep the thread's first message and the most recent ones.
  return out.length > MAX_REFERENCES ? [out[0], ...out.slice(out.length - (MAX_REFERENCES - 1))] : out;
}

// ---------------------------------------------------------------------------------------------
// Outgoing HTML
// ---------------------------------------------------------------------------------------------

const OUTGOING_TAGS = [
  'a', 'abbr', 'address', 'b', 'bdi', 'bdo', 'big', 'blockquote', 'br', 'caption', 'center', 'cite', 'code', 'col',
  'colgroup', 'dd', 'del', 'dfn', 'div', 'dl', 'dt', 'em', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
  'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'tt', 'u', 'ul', 'var', 'wbr',
];
const OUTGOING_ATTRIBUTES = {
  '*': ['style', 'align', 'valign', 'width', 'height', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'dir', 'lang', 'title', 'color', 'face', 'size'],
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt'],
  blockquote: ['type', 'cite'],
  ol: ['start', 'type', 'reversed'],
  ul: ['type'],
  li: ['value'],
  td: ['scope', 'nowrap'],
  th: ['scope', 'nowrap'],
  // Composer markers (signature block, quote wrapper) so a reopened draft keeps them.
  div: ['data-mt-signature', 'data-mt-quote'],
};
const SAFE_HREF = /^(?:https?:|mailto:|tel:|#)/i;
const DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i;
// Inline images of messages stored here (rewritten cid: links); resolved to real parts on send.
const INTERNAL_IMAGE = /^\/api\/messages\/(\d{1,15})\/attachments\/(\d{1,4})$/;
// Positioning would let quoted mail lay itself over the app while it is in the editor.
const DENIED_CSS_PROPERTIES = new Set(['position', 'z-index', 'behavior', '-moz-binding', 'pointer-events', 'cursor']);

/** Inline style with dangerous properties, non-image URLs and CSS escapes removed. */
function scrubStyle(style) {
  const decoded = String(style || '')
    .replace(/\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?/g, (m, hex) => {
      const cp = parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '';
    })
    .replace(/\\(.)/g, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const decl of decoded.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 1) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    let value = decl.slice(colon + 1).trim();
    if (!/^-?[a-z][a-z0-9-]*$/.test(prop) || DENIED_CSS_PROPERTIES.has(prop)) continue;
    if (/expression\s*\(|javascript:|vbscript:|@import|[<>]/i.test(value)) continue;
    value = value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, _q, url) => {
      const v = String(url).trim();
      return /^https?:/i.test(v) || DATA_IMAGE.test(v) ? `url("${v.replace(/"/g, '%22')}")` : 'none';
    });
    if (value) out.push(`${prop}: ${value}`);
  }
  return out.join('; ');
}

/** Apply the inline-style scrub to whatever a tag transform returns. */
function withStyleScrub(transform) {
  return (tagName, attribs) => {
    const res = transform(tagName, attribs);
    if (res.attribs.style === undefined) return res;
    const style = scrubStyle(res.attribs.style);
    const out = { ...res.attribs };
    if (style) out.style = style;
    else delete out.style;
    return { tagName: res.tagName, attribs: out };
  };
}

// sanitize-html runs only ONE transform per tag (the tag's own, else '*'), so every transform
// is wrapped with the style scrub.
const TRANSFORMS = {
  body: (tagName, attribs) => ({ tagName: 'div', attribs }),
  a: (tagName, attribs) => {
    const out = { ...attribs };
    if (out.href !== undefined && !SAFE_HREF.test(String(out.href).trim())) delete out.href;
    if (out.target !== undefined && out.target !== '_blank') delete out.target;
    if (out.target === '_blank') out.rel = 'noopener noreferrer';
    return { tagName, attribs: out };
  },
  img: (tagName, attribs) => {
    const out = { ...attribs };
    const src = out.src === undefined ? '' : String(out.src).trim();
    const ok = /^https?:/i.test(src) || /^cid:[^\s"'<>]+$/i.test(src) || DATA_IMAGE.test(src) || INTERNAL_IMAGE.test(src);
    if (!ok) delete out.src;
    return { tagName, attribs: out };
  },
  div: (tagName, attribs) => {
    const out = { ...attribs };
    for (const marker of ['data-mt-signature', 'data-mt-quote']) if (out[marker] !== undefined) out[marker] = '1';
    return { tagName, attribs: out };
  },
  '*': (tagName, attribs) => ({ tagName, attribs }),
};

const OUTGOING_SANITIZE = {
  allowedTags: OUTGOING_TAGS,
  allowedAttributes: OUTGOING_ATTRIBUTES,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'cid', 'data'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'option', 'title', 'noscript', 'iframe', 'noembed', 'noframes', 'template', 'select', 'head', 'xmp', 'object', 'svg', 'math'],
  transformTags: Object.fromEntries(Object.entries(TRANSFORMS).map(([tag, fn]) => [tag, withStyleScrub(fn)])),
};

/**
 * Sanitise HTML that will be sent (or put in the editor as quoted mail): a generous allow-list
 * of formatting incl. inline styles; no scripts, styles sheets, forms, frames, media or event
 * handlers; links only to the web / mailto / tel; images from the web, cid:, data: or the
 * messages stored here.
 */
function sanitizeOutgoingHtml(html) {
  if (html === undefined || html === null || html === '') return '';
  return sanitizeHtml(String(html), OUTGOING_SANITIZE).trim();
}

/** Escaped, linkified plain text as HTML lines. */
function textToHtml(text) {
  const s = String(text || '').replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  if (!s) return '';
  return `<div>${linkifyText(s).replace(/\n/g, '<br>')}</div>`;
}

/**
 * Images in (sanitised) HTML that point at attachments of stored messages:
 * [{ messageId, index, src }] in order of appearance, unique.
 */
function internalImageRefs(html) {
  const out = [];
  const seen = new Set();
  for (const m of String(html || '').matchAll(/<img\b[^>]*?\ssrc="(\/api\/messages\/(\d{1,15})\/attachments\/(\d{1,4}))"/gi)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ src: m[1], messageId: Number(m[2]), index: Number(m[3]) });
  }
  return out;
}

/** Replace internal image srcs by `map[src]` (a cid) or drop the src when not in the map. */
function replaceInternalImages(html, map = {}) {
  return String(html || '').replace(/(<img\b[^>]*?\s)src="(\/api\/messages\/\d{1,15}\/attachments\/\d{1,4})"/gi, (match, head, src) =>
    map[src] ? `${head}src="cid:${map[src]}"` : head.replace(/\s$/, ' ')
  );
}

/** Turn data: images into embedded (cid) parts — many mail apps block data: URLs. */
function embedDataImages(html) {
  const attachments = [];
  let n = 0;
  const out = String(html || '').replace(/(<img\b[^>]*?\s)src="(data:image\/(png|jpe?g|gif|webp|bmp);base64,([a-z0-9+/=\s]+))"/gi, (match, head, _all, type, data) => {
    const content = Buffer.from(data.replace(/\s+/g, ''), 'base64');
    if (!content.length) return head.replace(/\s$/, ' ');
    n += 1;
    const cid = `img${n}.${nodeCrypto.randomBytes(6).toString('hex')}@mailtabs`;
    const ext = type.toLowerCase() === 'jpg' ? 'jpeg' : type.toLowerCase();
    attachments.push({ filename: `image-${n}.${ext === 'jpeg' ? 'jpg' : ext}`, contentType: `image/${ext}`, content, cid });
    return `${head}src="cid:${cid}"`;
  });
  return { html: out, attachments };
}

// ---------------------------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------------------------

const MODES = ['new', 'reply', 'replyAll', 'forward'];
const UPLOAD_ID = /^[A-Za-z0-9_-]{16,64}$/;

function positiveId(value, what) {
  const n = typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n < 1) throw invalid(`Invalid ${what}.`);
  return n;
}

function optionalId(value, what) {
  if (value === undefined || value === null || value === '') return null;
  return positiveId(value, what);
}

function attachmentList(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw invalid('Attachments must be a list.');
  if (value.length > MAX_ATTACHMENTS) throw invalid(`Too many attachments (at most ${MAX_ATTACHMENTS}).`);
  const out = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid('Invalid attachment.');
    let entry;
    if (item.uploadId !== undefined && item.uploadId !== null) {
      if (typeof item.uploadId !== 'string' || !UPLOAD_ID.test(item.uploadId)) throw invalid('Invalid attachment.');
      entry = { uploadId: item.uploadId };
    } else {
      const index = item.index;
      if (!Number.isInteger(index) || index < 0 || index > 9999) throw invalid('Invalid attachment.');
      entry = { messageId: positiveId(item.messageId, 'attachment'), index };
    }
    const key = entry.uploadId ? `u:${entry.uploadId}` : `m:${entry.messageId}:${entry.index}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(entry);
    }
  }
  return out;
}

/**
 * Validate and normalise a compose payload.
 * @param {object} payload { accountId, to, cc, bcc, subject, html, attachments, inReplyTo?, references?,
 *   replyToMessageId?, forwardOfMessageId?, mode? }
 * @param {{ draft?: boolean }} [opts] drafts may have no recipients yet
 * @returns normalised payload (unknown fields dropped); throws HttpError(400, ..., 'INVALID_COMPOSE')
 */
function validatePayload(payload, { draft = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalid('The message is missing.');
  const accountId = positiveId(payload.accountId, 'From account');
  const mode = payload.mode === undefined || payload.mode === null || payload.mode === 'draft' ? 'new' : payload.mode;
  if (!MODES.includes(mode)) throw invalid('Invalid compose mode.');

  const [to, cc, bcc] = dedupeRecipients([recipientList(payload.to, 'To'), recipientList(payload.cc, 'Cc'), recipientList(payload.bcc, 'Bcc')]);
  const total = to.length + cc.length + bcc.length;
  if (total > COMPOSE_LIMITS.maxRecipients) throw invalid(`Too many recipients (at most ${COMPOSE_LIMITS.maxRecipients} in To, Cc and Bcc together).`);
  if (!draft && total === 0) throw invalid('Add at least one recipient.');

  if (payload.subject !== undefined && payload.subject !== null && typeof payload.subject !== 'string') throw invalid('The subject must be text.');
  const subject = headerText(payload.subject);
  if (subject.length > COMPOSE_LIMITS.maxSubject) throw invalid(`The subject is too long (at most ${COMPOSE_LIMITS.maxSubject} characters).`);

  if (payload.html !== undefined && payload.html !== null && typeof payload.html !== 'string') throw invalid('The message text is invalid.');
  const rawHtml = payload.html || '';
  if (Buffer.byteLength(rawHtml, 'utf8') > COMPOSE_LIMITS.maxHtmlBytes) {
    throw invalid('The message text is too long. Remove pasted images or long quoted text and attach them instead.');
  }
  const html = sanitizeOutgoingHtml(rawHtml);

  return {
    accountId,
    mode,
    to,
    cc,
    bcc,
    subject,
    html,
    attachments: attachmentList(payload.attachments),
    inReplyTo: normalizeMessageId(payload.inReplyTo),
    references: normalizeReferences(payload.references),
    replyToMessageId: optionalId(payload.replyToMessageId, 'original message'),
    forwardOfMessageId: optionalId(payload.forwardOfMessageId, 'forwarded message'),
  };
}

// ---------------------------------------------------------------------------------------------
// MIME
// ---------------------------------------------------------------------------------------------

const CONTENT_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;

/** A filename safe for a MIME header: no path, no control characters, not empty. */
function cleanFilename(name, fallback = 'attachment') {
  const base = String(name || '')
    .replace(CONTROL_CHARS, '')
    .split(/[\\/]/)
    .pop()
    .replace(/["<>]/g, '')
    .trim()
    .slice(0, 200);
  return base && base !== '.' && base !== '..' ? base : fallback;
}

/** 'type/subtype' (lower case, no parameters), else application/octet-stream. */
function cleanContentType(value) {
  const t = String(value || '').split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE.test(t) ? t : 'application/octet-stream';
}

function asciiDomain(email) {
  const domain = String(email || '').split('@').pop() || '';
  const ascii = domainToASCII(domain.toLowerCase());
  return ascii && /^[a-z0-9.-]+$/.test(ascii) ? ascii : 'mailtabs.invalid';
}

/** A fresh Message-ID on the sender's domain. */
function newMessageId(email) {
  return `<${nodeCrypto.randomUUID()}@${asciiDomain(email)}>`;
}

/**
 * Build the raw RFC 5322 message.
 * @param {{ account, payload, attachments?: Array<{filename, contentType, content: Buffer, cid?}>,
 *   date?: Date, draft?: boolean, keepBcc?: boolean, fromName?: string, messageId?: string }} args payload
 *   must be validatePayload() output; internal (/api/...) images must already be resolved (left-overs are dropped).
 *   keepBcc: keep the Bcc header in a message to send (Microsoft Graph reads the recipients from it).
 * @returns {Promise<{ raw: Buffer, messageId: string, date: Date, envelope: { from: string, to: string[] } }>}
 *   drafts keep the Bcc header (so reopening keeps it) but leave Bcc out of the envelope.
 */
async function buildMime({ account, payload, attachments = [], date, draft = false, keepBcc = false, fromName, messageId }) {
  if (!account || !account.email) throw new TypeError('buildMime: account.email is required');
  const p = payload || {};
  const embedded = embedDataImages(replaceInternalImages(p.html || ''));
  const html = embedded.html;
  const parts = [...attachments, ...embedded.attachments].map((a, i) => {
    const content = Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content || '');
    const part = {
      filename: cleanFilename(a.filename, `attachment-${i + 1}`),
      contentType: cleanContentType(a.contentType),
      content,
      contentDisposition: a.cid ? 'inline' : 'attachment',
    };
    if (a.cid) part.cid = String(a.cid).replace(/[^\x21-\x3b\x3d\x3f-\x7e]/g, '');
    return part;
  });
  const totalBytes = parts.reduce((sum, a) => sum + a.content.length, 0);
  if (totalBytes > COMPOSE_LIMITS.maxAttachmentBytes) {
    throw new HttpError(400, 'The attachments are too large (at most 25 MB together). Remove some, or share them as links.', 'ATTACHMENTS_TOO_LARGE');
  }

  const id = normalizeMessageId(messageId) || newMessageId(account.email);
  const sentDate = date || new Date();
  const name = headerText(fromName !== undefined && fromName !== null ? fromName : account.sender_name || '').slice(0, MAX_NAME);
  const text = htmlToPlainText(html);
  const mail = {
    from: { name, address: account.email },
    to: p.to || [],
    cc: p.cc || [],
    bcc: p.bcc || [],
    subject: headerText(p.subject),
    messageId: id,
    date: sentDate,
    text: text || '',
    attachments: parts,
    newline: 'win',
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  if (html) mail.html = html;
  const inReplyTo = normalizeMessageId(p.inReplyTo);
  if (inReplyTo) mail.inReplyTo = inReplyTo;
  const references = normalizeReferences(p.references);
  if (references.length) mail.references = references;
  if (!mail.to.length && !mail.cc.length && !mail.bcc.length) delete mail.to;

  const node = new MailComposer(mail).compile();
  node.keepBcc = !!(draft || keepBcc);
  const raw = await node.build();

  const envelopeTo = [...(p.to || []), ...(p.cc || []), ...(draft ? [] : p.bcc || [])].map((r) => r.address);
  return { raw, messageId: id, date: sentDate, envelope: { from: account.email, to: [...new Set(envelopeTo)] } };
}

// ---------------------------------------------------------------------------------------------
// Reply / forward / draft preparation
// ---------------------------------------------------------------------------------------------

const REPLY_PREFIX = /^\s*(?:(?:re|aw|sv|antw|odp)\s*(?:\[\d+\])?\s*[:：]\s*)+/i;
const FORWARD_PREFIX = /^\s*(?:(?:fwd?|wg|tr|rv|enc)\s*(?:\[\d+\])?\s*[:：]\s*)+/i;

/** 'Re: x' for 'x', 'Re: x', 'RE: Re: x' and 'Aw: x' alike (no stacking). */
function replySubject(subject) {
  return `Re: ${headerText(subject).replace(REPLY_PREFIX, '')}`.trim();
}

function forwardSubject(subject) {
  return `Fwd: ${headerText(subject).replace(FORWARD_PREFIX, '')}`.trim();
}

function parseJsonArray(text) {
  try {
    const v = JSON.parse(text || '[]');
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

/** Usable { name, address } entries of a stored address list (invalid ones skipped). */
function storedAddresses(json) {
  const out = [];
  for (const a of parseJsonArray(json)) {
    if (!a || typeof a !== 'object') continue;
    const address = normalizeAddress(typeof a.address === 'string' ? a.address : '');
    if (address) out.push({ name: headerText(typeof a.name === 'string' ? a.name : '').slice(0, MAX_NAME), address });
  }
  return out;
}

function ownAddresses(accounts) {
  const own = new Set();
  for (const a of accounts || []) {
    for (const v of [a.email, a.smtp_user, a.imap_user]) {
      const s = String(v || '').trim().toLowerCase();
      if (s.includes('@')) own.add(s);
    }
  }
  return own;
}

function formatDate(ms, { timeZone, locale } = {}) {
  const date = new Date(Number(ms) || Date.now());
  try {
    return new Intl.DateTimeFormat(locale || 'en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone || 'UTC',
      timeZoneName: timeZone ? undefined : 'short',
    }).format(date);
  } catch (_) {
    return date.toUTCString();
  }
}

function personHtml(name, address) {
  const n = headerText(name);
  const a = headerText(address);
  if (n && a) return `${escapeHtml(n)} &lt;${escapeHtml(a)}&gt;`;
  return escapeHtml(n || a || 'Unknown sender');
}

function addressListHtml(list) {
  return list.map((a) => personHtml(a.name, a.address)).join(', ');
}

// Quoted mail must leave room for what the user writes within maxHtmlBytes.
const MAX_QUOTE_BYTES = 1_500_000;

/** The original's body as HTML for quoting (sanitised for sending; images stay resolvable). */
function originalBodyHtml(original) {
  if (original.html_body && String(original.html_body).trim()) {
    const html = sanitizeOutgoingHtml(original.html_body);
    if (html && Buffer.byteLength(html, 'utf8') <= MAX_QUOTE_BYTES) return html;
  }
  const text = original.text_body && String(original.text_body).trim() ? String(original.text_body) : '';
  if (text) {
    // Very long mail: quote the start of its text (escaping can triple its size).
    const cut = text.length > MAX_QUOTE_BYTES / 4 ? `${text.slice(0, MAX_QUOTE_BYTES / 4)}\n[…]` : text;
    return textToHtml(cut);
  }
  return original.snippet ? `<div>${escapeHtml(original.snippet)}</div>` : '';
}

function signatureBlock(signatureHtml) {
  const sig = sanitizeOutgoingHtml(signatureHtml || '');
  return sig ? `<div><br></div><div data-mt-signature="1">${sig}</div>` : '';
}

function referencesFor(original) {
  const refs = parseJsonArray(original.references_json).filter((r) => typeof r === 'string');
  if (!refs.length && original.in_reply_to) refs.push(original.in_reply_to);
  if (original.message_id) refs.push(original.message_id);
  return normalizeReferences(refs);
}

/** Attachments of a stored message the user would expect to see (not inline images). */
function forwardableAttachments(row) {
  return parseJsonArray(row.attachments_json)
    .filter((a) => a && Number.isInteger(a.index) && !a.inline)
    .map((a) => ({
      messageId: row.id,
      index: a.index,
      filename: cleanFilename(a.filename, `attachment-${a.index + 1}`),
      contentType: cleanContentType(a.contentType),
      size: Number.isFinite(a.size) ? a.size : null,
    }));
}

/**
 * Prefill for the composer.
 * @param {{ db?, mode: 'new'|'reply'|'replyAll'|'forward', original?: object (messages row; its body
 *   should be downloaded first — see SyncManager.fetchBodyNow), account: object (the From account; for
 *   replies/forwards the account that received the original), accounts: object[] (all of the user's),
 *   inSentFolder?: boolean (the original sits in that account's Sent folder),
 *   signatureHtml?: string, timeZone?: string, locale?: string }} args
 * @returns payload { accountId, mode, to, cc, bcc, subject, html, attachments, inReplyTo, references,
 *   replyToMessageId, forwardOfMessageId } — attachments carry filename/contentType/size for display.
 */
function prepareCompose({ mode = 'new', original, account, accounts = [], inSentFolder = false, signatureHtml, timeZone, locale } = {}) {
  if (!account) throw new TypeError('prepareCompose: account is required');
  const signature = signatureBlock(signatureHtml !== undefined ? signatureHtml : account.signature_html);
  const base = {
    accountId: account.id,
    mode: 'new',
    to: [],
    cc: [],
    bcc: [],
    subject: '',
    html: `<p><br></p>${signature}`,
    attachments: [],
    inReplyTo: null,
    references: [],
    replyToMessageId: null,
    forwardOfMessageId: null,
  };
  if (mode === 'new' || !original) return base;
  if (!MODES.includes(mode)) throw invalid('Invalid compose mode.');

  const own = ownAddresses(accounts.length ? accounts : [account]);
  const from = normalizeAddress(original.from_address || '') ? { name: headerText(original.from_name || ''), address: normalizeAddress(original.from_address) } : null;
  const origTo = storedAddresses(original.to_json);
  const origCc = storedAddresses(original.cc_json);
  const replyTo = storedAddresses(original.reply_to_json);
  const date = formatDate(original.date, { timeZone, locale });
  const body = originalBodyHtml(original);

  if (mode === 'forward') {
    const header = [
      '---------- Forwarded message ---------',
      `From: ${from ? personHtml(from.name, from.address) : personHtml(original.from_name, original.from_address)}`,
      `Date: ${escapeHtml(date)}`,
      `Subject: ${escapeHtml(headerText(original.subject))}`,
      origTo.length ? `To: ${addressListHtml(origTo)}` : null,
      origCc.length ? `Cc: ${addressListHtml(origCc)}` : null,
    ].filter(Boolean);
    return {
      ...base,
      mode: 'forward',
      subject: forwardSubject(original.subject),
      html: `<p><br></p>${signature}<div><br></div><div>${header.join('<br>')}<br><br></div>${body ? `<div>${body}</div>` : ''}`,
      attachments: forwardableAttachments(original),
      // Threads the forward with the original here; recipients' apps simply ignore it.
      references: referencesFor(original),
      forwardOfMessageId: original.id,
    };
  }

  // Reply / reply all. A message the replying account sent (or filed in its Sent folder) is
  // answered to its recipients. Mail from another of the user's accounts is answered like anyone
  // else's: back to that address.
  const mine = ownAddresses([account]);
  const sentByMe = !!inSentFolder || !!(from && mine.has(from.address.toLowerCase()));
  let answered = [];
  let to;
  let cc = [];
  if (sentByMe) {
    to = origTo;
    if (mode === 'replyAll') cc = origCc;
  } else {
    answered = replyTo.length ? replyTo : from ? [from] : [];
    to = answered;
    if (mode === 'replyAll') {
      to = [...to, ...origTo];
      cc = origCc;
    }
  }
  if (mode === 'replyAll') {
    // Leave out the user's own addresses, except the one being answered.
    const keep = new Set(answered.map((r) => r.address.toLowerCase()).filter((a) => !mine.has(a)));
    const isOwn = (r) => own.has(r.address.toLowerCase()) && !keep.has(r.address.toLowerCase());
    const othersTo = to.filter((r) => !isOwn(r));
    // A note to self stays addressed to self rather than to nobody.
    to = othersTo.length || cc.some((r) => !isOwn(r)) ? othersTo : to.slice(0, 1);
    cc = cc.filter((r) => !isOwn(r));
  }
  [to, cc] = dedupeRecipients([to, cc]);
  if (to.length > COMPOSE_LIMITS.maxRecipients) to = to.slice(0, COMPOSE_LIMITS.maxRecipients);
  cc = cc.slice(0, Math.max(0, COMPOSE_LIMITS.maxRecipients - to.length));

  const who = from ? personHtml(from.name, from.address) : personHtml(original.from_name, original.from_address);
  const quote =
    `<div>On ${escapeHtml(date)}, ${who} wrote:<br></div>` +
    `<blockquote type="cite" style="margin: 0 0 0 0.8ex; border-left: 1px solid #cccccc; padding-left: 1ex">${body}</blockquote>`;
  return {
    ...base,
    mode,
    to,
    cc,
    subject: replySubject(original.subject),
    html: `<p><br></p>${signature}<div><br></div>${quote}`,
    inReplyTo: normalizeMessageId(original.message_id || ''),
    references: referencesFor(original),
    replyToMessageId: original.id,
  };
}

/**
 * Composer payload for a reopened draft.
 * @param {{ to, cc, bcc?, subject, html, text, attachments, inReplyTo?, references? }} parsed
 *   parseRawMessage()-style result of the draft's source (bcc read from the Bcc header)
 * @param {object} row the draft's messages row (attachments are referenced through it)
 */
function parseDraft(parsed, row) {
  const p = parsed || {};
  const clean = (list) => (Array.isArray(list) ? list : []).map((a) => ({ name: headerText(a && a.name).slice(0, MAX_NAME), address: normalizeAddress((a && a.address) || '') })).filter((a) => a.address);
  const [to, cc, bcc] = dedupeRecipients([clean(p.to), clean(p.cc), clean(p.bcc)]);
  const attachments = Array.isArray(p.attachments) ? p.attachments : [];
  let html = '';
  if (p.html && String(p.html).trim()) {
    // Inline images point at this draft's own parts until it is saved or sent again.
    html = sanitizeOutgoingHtml(rewriteCidLinks(String(p.html), row.id, attachments));
  } else if (p.text) {
    html = textToHtml(p.text);
  }
  const inReplyTo = normalizeMessageId(p.inReplyTo || '');
  return {
    accountId: row.account_id,
    mode: inReplyTo ? 'reply' : 'new',
    to,
    cc,
    bcc,
    subject: headerText(p.subject),
    html,
    attachments: attachments
      .filter((a) => a && Number.isInteger(a.index) && !a.inline)
      .map((a) => ({
        messageId: row.id,
        index: a.index,
        filename: cleanFilename(a.filename, `attachment-${a.index + 1}`),
        contentType: cleanContentType(a.contentType),
        size: Number.isFinite(a.size) ? a.size : null,
      })),
    inReplyTo,
    references: normalizeReferences(p.references || []),
    replyToMessageId: null,
    forwardOfMessageId: null,
  };
}

module.exports = {
  COMPOSE_LIMITS,
  validatePayload,
  buildMime,
  prepareCompose,
  parseDraft,
  sanitizeOutgoingHtml,
  normalizeAddress,
  isValidAddress,
  normalizeMessageId,
  replySubject,
  forwardSubject,
  cleanFilename,
  cleanContentType,
  internalImageRefs,
  replaceInternalImages,
  embedDataImages,
  newMessageId,
};
