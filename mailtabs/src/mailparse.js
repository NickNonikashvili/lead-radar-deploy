'use strict';

/**
 * MIME parsing, HTML sanitizing, snippets and the HTML document served to the sandboxed
 * message iframe.
 *
 * Defence in depth for email HTML:
 *   1. sanitizeEmailHtml() — allow-list of tags/attributes/URL schemes (this file);
 *   2. the body endpoint's CSP (no scripts at all, images only when the user asks);
 *   3. the iframe sandbox (no allow-scripts).
 */

const path = require('path');
const { simpleParser } = require('mailparser');
const sanitizeHtml = require('sanitize-html');

// html-to-text is mailparser's own dependency (not ours): load the copy mailparser itself uses.
// mailparser's built-in conversion cannot be configured and upper-cases headings, so we skip it
// and convert here. If the module is ever missing, the simple converter below takes over.
const convertHtml = (() => {
  try {
    const mailparserDir = path.dirname(require.resolve('mailparser'));
    return require(require.resolve('html-to-text', { paths: [mailparserDir] })).htmlToText;
  } catch (_) {
    return null;
  }
})();

// ---------------------------------------------------------------------------------------------
// Sanitizing
// ---------------------------------------------------------------------------------------------

const FORBIDDEN_TAGS = new Set([
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'link', 'meta', 'base', 'svg', 'math', 'video', 'audio', 'source',
  'track', 'canvas', 'portal', 'template', 'noscript', 'dialog',
]);

const ALLOWED_TAGS = [
  ...new Set([
    ...sanitizeHtml.defaults.allowedTags,
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'col', 'colgroup',
    'img', 'center', 'font', 'span', 'div', 'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'a', 'b', 'i', 'u', 's', 'strong', 'em', 'small', 'sup', 'sub', 'style',
    'big', 'strike', 'tt', 'del', 'ins',
  ]),
].filter((tag) => !FORBIDDEN_TAGS.has(tag));

const GLOBAL_ATTRIBUTES = [
  'style', 'class', 'align', 'valign', 'width', 'height', 'bgcolor', 'border', 'cellpadding',
  'cellspacing', 'colspan', 'rowspan', 'dir', 'color', 'face', 'size',
];

// Content of these is dropped along with the tag (never shown as text).
const NON_TEXT_TAGS = [
  'script', 'style', 'textarea', 'option', 'xmp', 'title', 'noscript', 'iframe', 'noembed',
  'noframes', 'template', 'select',
];

// Links may only go to the web, to email addresses or to an anchor in the same message.
const SAFE_HREF = /^(?:https?:|mailto:|#|\/\/)/i;
// Images may only come from the web, the message itself (cid:) or inline data images.
const SAFE_IMG_SRC = /^(?:https?:|\/\/|cid:|data:image\/)/i;
// After cid rewriting, inline images point at our own attachment endpoint.
const ATTACHMENT_PATH = /^\/api\/messages\/\d+\/attachments\/\d+$/;
// Browsers treat 'https:host/x' like 'https://host/x', so any http(s): URL counts as remote.
const REMOTE_URL = /^\s*(?:https?:|\/\/)/i;

/**
 * Neutralise URLs in CSS that could make the browser request something other than a remote
 * image/font or an inline one: relative URLs would hit this app's own endpoints with the
 * user's cookies, and @import pulls in further stylesheets.
 */
function scrubCss(css, { allowAttachmentPaths = false } = {}) {
  if (!css) return css;
  return String(css)
    // CSS escapes of plain letters (`\75 rl(`, `@\69mport`) decode to url( / @import in the
    // browser; real stylesheets never need them, so decode them before looking for URLs.
    .replace(/\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?/g, (m, hex) => {
      const cp = parseInt(hex, 16);
      return (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) ? String.fromCharCode(cp) : m;
    })
    .replace(/\\([g-zG-Z])/g, '$1')
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, _quote, value) => {
      const v = String(value).trim();
      if (SAFE_IMG_SRC.test(v) || (allowAttachmentPaths && ATTACHMENT_PATH.test(v))) return match;
      return 'none';
    });
}

function buildSanitizeOptions({ blockRemoteImages = false, allowAttachmentPaths = false } = {}) {
  return {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': GLOBAL_ATTRIBUTES,
      a: ['href', 'title', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', ...(blockRemoteImages ? ['data-blocked'] : [])],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'cid'],
    allowedSchemesByTag: { img: ['http', 'https', 'cid', 'data'] },
    allowProtocolRelative: true,
    // <style> is needed for real-world email layouts; CSP + sandbox contain what CSS can do.
    allowVulnerableTags: true,
    nonTextTags: NON_TEXT_TAGS,
    disallowedTagsMode: 'discard',
    transformTags: {
      // Keep the <body> background/colours by turning it into a wrapper div.
      body: (tagName, attribs) => ({ tagName: 'div', attribs }),
      a: (tagName, attribs) => {
        const out = { ...attribs };
        if (out.href !== undefined && !SAFE_HREF.test(String(out.href).trim())) delete out.href;
        out.target = '_blank';
        out.rel = 'noopener noreferrer';
        return { tagName: 'a', attribs: out };
      },
      img: (tagName, attribs) => {
        const out = { ...attribs };
        if (out.src !== undefined) {
          const src = String(out.src).trim();
          const ok = SAFE_IMG_SRC.test(src) || (allowAttachmentPaths && ATTACHMENT_PATH.test(src));
          if (!ok) delete out.src;
          else if (blockRemoteImages && REMOTE_URL.test(src)) {
            delete out.src;
            out['data-blocked'] = '1';
          }
        }
        return { tagName: 'img', attribs: out };
      },
      '*': (tagName, attribs) => {
        if (attribs.style) return { tagName, attribs: { ...attribs, style: scrubCss(attribs.style, { allowAttachmentPaths }) } };
        return { tagName, attribs };
      },
    },
  };
}

function sanitizeWith(html, opts) {
  if (html === null || html === undefined || html === '') return '';
  const out = sanitizeHtml(String(html), buildSanitizeOptions(opts));
  // <style> text is emitted raw by sanitize-html; scrub its URLs too.
  return out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) => open + scrubCss(css, opts) + close);
}

/** Sanitize untrusted email HTML for display (see module doc). */
function sanitizeEmailHtml(html) {
  return sanitizeWith(html, {});
}

// ---------------------------------------------------------------------------------------------
// cid: links, remote images, text helpers
// ---------------------------------------------------------------------------------------------

/**
 * Point cid: references (src="cid:…", url(cid:…)) at our attachment endpoint for the attachment
 * with that Content-ID. Unknown cids are left alone.
 */
function rewriteCidLinks(html, messageId, attachments) {
  if (!html || !attachments || !attachments.length) return html || '';
  const byCid = new Map();
  for (const att of attachments) {
    if (att && att.cid) {
      if (!byCid.has(att.cid)) byCid.set(att.cid, att);
      const lower = String(att.cid).toLowerCase();
      if (!byCid.has(lower)) byCid.set(lower, att);
    }
  }
  if (!byCid.size) return html;
  return String(html).replace(/(["'(]\s*)cid:([^"'()\s>]+)/gi, (match, prefix, rawCid) => {
    let cid = rawCid;
    try {
      cid = decodeURIComponent(rawCid);
    } catch (_) {
      /* keep the raw form */
    }
    const att = byCid.get(rawCid) || byCid.get(cid) || byCid.get(cid.toLowerCase());
    return att ? `${prefix}/api/messages/${Number(messageId)}/attachments/${Number(att.index)}` : match;
  });
}

/** Number of remote images (<img> with an http(s) or protocol-relative src, plus CSS url(http…)). */
function countRemoteImages(html) {
  if (!html) return 0;
  let count = 0;
  sanitizeHtml(String(html), {
    allowedTags: ['img'],
    allowedAttributes: { img: ['src'] },
    transformTags: {
      img: (tagName, attribs) => {
        if (attribs.src && REMOTE_URL.test(String(attribs.src))) count += 1;
        return { tagName, attribs };
      },
    },
  });
  const cssMatches = String(html).match(/url\(\s*['"]?\s*(?:https?:|\/\/)/gi);
  return count + (cssMatches ? cssMatches.length : 0);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', zwnj: '', zwj: '', shy: '' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    const v = ENTITIES[ent.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

/** Crude HTML -> text (fallback when html-to-text can't be used for a message). */
function htmlToText(html) {
  if (!html) return '';
  return decodeEntities(
    String(html)
      .replace(/<(style|script|head|title)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

// Deepest element nesting handed to html-to-text: its recursive walk overflows the stack at
// about 2000 levels (mailparser uses the same limit). Real markup stays far below this.
const MAX_HTML_DEPTH = 1000;
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Whether well-formed (sanitized) HTML nests elements deeper than `max`. Linear scan. */
function nestsDeeperThan(html, max) {
  let depth = 0;
  for (const m of String(html).matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    if (m[3] || VOID_TAGS.has(m[2].toLowerCase())) continue;
    if (m[1]) depth = Math.max(0, depth - 1);
    else if (++depth > max) return true;
  }
  return false;
}

const HTML_TO_TEXT_OPTIONS = {
  wordwrap: false,
  limits: { maxDepth: MAX_HTML_DEPTH },
  selectors: [
    // html-to-text upper-cases headings and table header cells by default, which turns list
    // previews into "Q4 ROADMAP REVIEW — ...". Keep the sender's capitalisation.
    ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((selector) => ({ selector, options: { uppercase: false } })),
    { selector: 'table', options: { uppercaseHeaderCells: false } },
    // Layout-table cells on their own lines ("Name Owner", not "NameOwner").
    { selector: 'td', format: 'block' },
    { selector: 'th', format: 'block' },
    // Logos, spacers and tracking pixels (often data: URLs) are noise in a text version.
    { selector: 'img', format: 'skip' },
  ],
};

/** Plain text for an HTML body, keeping the original capitalisation. */
function htmlToPlainText(html) {
  if (!html) return '';
  const s = String(html);
  if (convertHtml && s.length <= MAX_HTML_TO_TEXT && !nestsDeeperThan(s, MAX_HTML_DEPTH)) {
    try {
      return convertHtml(s, HTML_TO_TEXT_OPTIONS).trim();
    } catch (_) {
      /* fall through to the simple converter */
    }
  }
  return htmlToText(s);
}

// Characters used by marketing mail to pad preheaders; invisible, so drop them from previews.
const INVISIBLE_CHARS = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯﻿ㅤﾠ]/g;

/** Text as a preview shows it: link targets and invisible padding dropped, whitespace collapsed. */
function previewText(text) {
  return String(text)
    // html-to-text renders links as "text [https://…]" — noise in a preview.
    .replace(/\s*\[(?:https?|mailto|cid):[^\]\s]*\]/gi, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The text without its first line when that line just repeats the subject (many emails start
 * with the subject as a heading, so the preview would show it twice). Compared ignoring case,
 * whitespace and link targets; anything else on the line keeps it.
 */
function stripLeadingSubject(text, subject) {
  if (!text) return '';
  const wanted = subject ? previewText(subject).toLowerCase() : '';
  if (!wanted) return String(text);
  const lines = String(text).split('\n');
  const first = lines.findIndex((line) => previewText(line) !== '');
  if (first >= 0 && previewText(lines[first]).toLowerCase() === wanted) return lines.slice(first + 1).join('\n');
  return String(text);
}

/** One-line plain-text preview: whitespace collapsed, at most 200 characters. */
function makeSnippet(text, max = 200) {
  if (!text) return '';
  let s = previewText(text);
  if (s.length > max) {
    let cut = s.slice(0, max - 1);
    if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1); // don't split a surrogate pair
    s = `${cut.replace(/\s+$/, '')}…`;
  }
  return s;
}

function escapeHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TEXT_URL = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

/** Escape plain text and turn URLs into links. */
function linkifyText(text) {
  const str = String(text || '');
  let out = '';
  let last = 0;
  for (const m of str.matchAll(TEXT_URL)) {
    let url = m[0];
    // Trailing punctuation is almost always sentence punctuation, not part of the URL.
    while (/[.,;:!?'")\]}>*]$/.test(url)) {
      if (url.endsWith(')') && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) break;
      url = url.slice(0, -1);
    }
    if (url.length < 5) continue;
    const href = /^www\./i.test(url) ? `http://${url}` : url;
    out += escapeHtml(str.slice(last, m.index));
    out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    last = m.index + url.length;
  }
  return out + escapeHtml(str.slice(last));
}

const RESET_CSS = [
  'html{color-scheme:light}',
  'body{margin:0;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
  'font-size:14px;line-height:1.5;color:#1f2328;background:#fff;word-wrap:break-word;overflow-wrap:break-word}',
  'img{max-width:100%}',
  'pre.mt-text{margin:0;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere;font-family:inherit;font-size:inherit}',
  'img[data-blocked]{background:#f3f4f6}',
  '.mt-empty{color:#6b7280;font-style:italic}',
].join('');

/**
 * The complete HTML document shown inside the message iframe.
 * @param {{html?: string|null, text?: string|null, subject?: string|null}} body
 * @param {{showImages?: boolean}} options remote images are stripped unless showImages
 */
function renderBodyDocument({ html, text, subject } = {}, { showImages = false } = {}) {
  let content;
  if (html && String(html).trim()) {
    // Re-sanitize on output as well: cheap insurance should a stored body ever be unsafe.
    content = sanitizeWith(html, { blockRemoteImages: !showImages, allowAttachmentPaths: true });
  } else if (text && String(text).trim()) {
    content = `<pre class="mt-text">${linkifyText(text)}</pre>`;
  } else {
    content = '<p class="mt-empty">This message has no text.</p>';
  }
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    // Remote images/CSS backgrounds (once shown) must not tell senders where they were opened.
    '<meta name="referrer" content="no-referrer">' +
    '<base target="_blank">' +
    `<title>${escapeHtml(subject || '')}</title>` +
    `<style>${RESET_CSS}</style>` +
    // The app sizes the iframe to #mt-root. The trailing style stops emails whose html/body are
    // `height:100%` / `100vh` from growing with the iframe (each resize would grow them again).
    `</head><body><div id="mt-root">${content}</div>` +
    '<style>html,body{height:auto!important;min-height:0!important;max-height:none!important}</style>' +
    '</body></html>'
  );
}

// ---------------------------------------------------------------------------------------------
// MIME parsing
// ---------------------------------------------------------------------------------------------

// Converting multi-megabyte HTML to text is slow; past this the simple converter is used.
const MAX_HTML_TO_TEXT = 1500000;

function flattenAddresses(field) {
  const out = [];
  const walk = (list) => {
    for (const a of list || []) {
      if (!a) continue;
      if (Array.isArray(a.group)) walk(a.group);
      else if (a.address || a.name) out.push({ name: (a.name || '').trim(), address: (a.address || '').trim() });
    }
  };
  for (const obj of Array.isArray(field) ? field : field ? [field] : []) walk(obj.value);
  return out;
}

const EXTENSIONS = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/html': 'html', 'text/calendar': 'ics',
  'message/rfc822': 'eml', 'application/zip': 'zip',
};

function defaultFilename(contentType, index) {
  const ext = EXTENSIONS[String(contentType || '').toLowerCase()];
  return `attachment-${index + 1}${ext ? `.${ext}` : ''}`;
}

/**
 * The Date header in epoch ms, or null when there is none or it can't be read.
 * mailparser silently substitutes "now" for an unreadable Date header, which would make old
 * mail look brand new; the caller then falls back to the server's arrival time instead.
 */
function headerDate(parsed) {
  if (!(parsed.date instanceof Date) || Number.isNaN(parsed.date.getTime())) return null;
  const line = (parsed.headerLines || []).find((h) => h && h.key === 'date');
  if (!line) return null;
  const raw = String(line.line || '').replace(/^date:\s*/i, '').trim();
  const looksLikeNow = Math.abs(parsed.date.getTime() - Date.now()) < 5000;
  if (looksLikeNow && Number.isNaN(Date.parse(raw.replace(/\s*\([^)]*\)\s*$/, '')))) return null;
  return parsed.date.getTime();
}

/**
 * Parse a raw RFC 822 message.
 * @param {Buffer|string} source
 */
async function parseRawMessage(source) {
  const parsed = await simpleParser(source, {
    keepCidLinks: true, // we rewrite cid: links ourselves once the row id is known
    skipTextToHtml: true,
    skipImageLinks: true,
    // mailparser's HTML -> text conversion upper-cases headings; htmlToPlainText() does it instead.
    skipHtmlToText: true,
  });

  const html = parsed.html ? sanitizeEmailHtml(parsed.html) : null;
  let text = typeof parsed.text === 'string' ? parsed.text.replace(/\s+$/, '') : '';
  if (!text.trim() && html) text = htmlToPlainText(html);

  const attachments = (parsed.attachments || []).map((att, index) => {
    const cid = att.cid ? String(att.cid) : null;
    // "Inline" = actually displayed inside the HTML body; anything else is shown as a chip.
    const inline = !!(cid && html && html.includes(`cid:${cid}`));
    const content = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || '');
    return {
      index,
      filename: att.filename || defaultFilename(att.contentType, index),
      contentType: att.contentType || 'application/octet-stream',
      size: Number.isFinite(att.size) ? att.size : content.length,
      cid,
      inline,
      content,
    };
  });

  const from = flattenAddresses(parsed.from)[0] || null;
  const date = headerDate(parsed);

  return {
    messageId: parsed.messageId || null,
    subject: typeof parsed.subject === 'string' ? parsed.subject : null,
    from,
    to: flattenAddresses(parsed.to),
    cc: flattenAddresses(parsed.cc),
    replyTo: flattenAddresses(parsed.replyTo),
    date,
    text,
    html,
    snippet: makeSnippet(stripLeadingSubject(text, parsed.subject)),
    attachments,
    hasAttachments: attachments.some((a) => !a.inline),
    remoteImageCount: countRemoteImages(html),
  };
}

module.exports = {
  parseRawMessage,
  sanitizeEmailHtml,
  rewriteCidLinks,
  makeSnippet,
  stripLeadingSubject,
  renderBodyDocument,
  countRemoteImages,
  htmlToText,
  htmlToPlainText,
  linkifyText,
  escapeHtml,
};
