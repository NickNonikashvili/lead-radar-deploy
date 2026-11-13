// Client-side HTML sanitiser for the composer (allow-list based).
//
// Every piece of untrusted HTML that reaches the editor (pasted/dropped content, quoted mail and
// drafts from the server, signatures) goes through here. Markup is parsed into a small tree
// ({ t: 'el', tag, attrs, kids } / { t: 'text', v }), filtered against an allow-list, and then
// either built into DOM nodes with createElement/setAttribute/createTextNode or re-serialised with
// strict escaping. Raw markup strings are never assigned to the DOM.
//
// Two output modes:
//   'editor' - for content shown in the editor: remote images are NOT loaded (src -> data-mt-src),
//              so replying to a newsletter neither pings trackers nor trips the page's img-src CSP.
//   'send'   - for HTML sent to the server: data-mt-src goes back to src.
// No imports and no DOM globals at module scope, so the whole file runs in Node for unit tests.

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const MAX_DEPTH = 120;
const MAX_STYLE_LENGTH = 4000;
const MAX_URL_LENGTH = 4096;
const MAX_DATA_URL_LENGTH = 6_000_000;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// Content of these is skipped by the string parser (never parsed as markup at all).
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext', 'template']);

const RAW_TEXT_END = Object.fromEntries([...RAW_TEXT].map((tag) => [tag, new RegExp(`</${tag}(?=[\\s/>]|$)`, 'gi')]));

// Dropped together with everything inside them.
const DROP = new Set([
  ...RAW_TEXT,
  'head', 'meta', 'link', 'base', 'object', 'embed', 'applet', 'frame', 'frameset', 'svg', 'math',
  'select', 'option', 'optgroup', 'datalist', 'button', 'input', 'keygen', 'audio', 'video', 'source',
  'track', 'canvas', 'map', 'area', 'param', 'dialog', 'portal', 'slot', 'picture', 'output', 'progress', 'meter',
]);

// Allowed tags, mapped to what they become. Anything not listed is unwrapped (children kept).
const TAGS = {
  a: 'a', b: 'b', strong: 'strong', i: 'i', em: 'em', u: 'u', s: 's', strike: 'strike', del: 'del', ins: 'ins',
  sub: 'sub', sup: 'sup', small: 'small', big: 'span', mark: 'mark', code: 'code', kbd: 'kbd', samp: 'samp', tt: 'code',
  q: 'q', cite: 'cite', abbr: 'abbr', span: 'span', font: 'span', br: 'br', wbr: 'wbr', hr: 'hr',
  p: 'p', div: 'div', center: 'div', blockquote: 'blockquote', pre: 'pre',
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
  ul: 'ul', ol: 'ol', li: 'li', dl: 'dl', dt: 'dt', dd: 'dd',
  table: 'table', thead: 'thead', tbody: 'tbody', tfoot: 'tfoot', tr: 'tr', td: 'td', th: 'th', caption: 'caption',
  colgroup: 'colgroup', col: 'col', img: 'img',
  section: 'div', article: 'div', header: 'div', footer: 'div', main: 'div', aside: 'div', nav: 'div',
  address: 'div', figure: 'div', figcaption: 'div', details: 'div', summary: 'div', fieldset: 'div', legend: 'div',
};

const STYLE_PROPS = new Set([
  'color', 'background-color', 'background',
  'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant',
  'text-align', 'text-decoration', 'text-decoration-line', 'text-decoration-color', 'text-decoration-style',
  'text-transform', 'text-indent', 'line-height', 'letter-spacing', 'word-spacing', 'white-space',
  'vertical-align', 'direction', 'word-break', 'overflow-wrap', 'word-wrap',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-style', 'border-width', 'border-radius',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-collapse', 'border-spacing',
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
  'list-style-type', 'list-style-position', 'table-layout', 'caption-side', 'empty-cells', 'float', 'clear',
]);

// Anything that can fetch, execute or escape the declaration is refused outright.
const BAD_CSS = /[\\<>{}@]|\/\*|url\s*\(|image-set|image\s*\(|expression|javascript|vbscript|behavior|binding|attr\s*\(|var\s*\(|env\s*\(|element\s*\(/i;
const CSS_VALUE = /^[\p{L}\p{N}\s#%.,()'"+\-!/]*$/u;

const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const DATA_IMAGE = /^data:image\/(png|gif|jpe?g|webp|bmp);base64,[a-z0-9+/=\s]+$/i;
const DIMENSION = /^\d{1,4}(\.\d+)?(px|%)?$/i;
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,24}|rgba?\(\s*[\d.\s,%]+\))$/i;
const ALIGN_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'tr', 'table', 'img', 'caption', 'col', 'colgroup', 'thead', 'tbody', 'tfoot', 'hr']);
const CELL_TAGS = new Set(['td', 'th']);
const SIZED_TAGS = new Set(['img', 'table', 'td', 'th', 'col', 'colgroup', 'hr']);

// ---------------------------------------------------------------------------------- entities

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  zwnj: '‌', zwj: '‍', shy: '­', copy: '©', reg: '®', trade: '™', hellip: '…',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”',
  bdquo: '„', laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›', bull: '•', middot: '·',
  euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', para: '¶', deg: '°',
  plusmn: '±', times: '×', divide: '÷', iexcl: '¡', iquest: '¿', larr: '←', rarr: '→',
  uarr: '↑', darr: '↓', harr: '↔', hearts: '♥', check: '✓', dagger: '†', micro: 'µ',
  frac12: '½', frac14: '¼', frac34: '¾', sup2: '²', sup3: '³', ordf: 'ª', ordm: 'º',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', ecirc: 'ê', aacute: 'á', agrave: 'à', acirc: 'â',
  iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç', Eacute: 'É',
};

export function decodeEntities(str) {
  if (!str || str.indexOf('&') < 0) return str || '';
  return str.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '�';
      return String.fromCodePoint(code);
    }
    return Object.prototype.hasOwnProperty.call(NAMED, body) ? NAMED[body] : match;
  });
}

// ---------------------------------------------------------------------------------- parsing

const START_TAG = /<([a-zA-Z][^\s/>\u0000]*)/y;
const END_TAG = /<\/([a-zA-Z][^\s/>\u0000]*)[^>]*>/y;
const ATTR_NAME = /[^\s/>=][^\s/>=]*/y;
const WS = /[\s/]*/y;

// Start tags that implicitly close an open <p>, as in the HTML tree builder.
const CLOSES_P = new Set(['address', 'article', 'aside', 'blockquote', 'center', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);

function elementNode(tag, attrs) {
  return { t: 'el', tag, attrs, kids: [] };
}

function readAttributes(s, start) {
  // Returns { attrs, end (index after '>'), selfClosing }.
  const attrs = [];
  let i = start;
  const n = s.length;
  for (;;) {
    WS.lastIndex = i;
    WS.exec(s);
    i = WS.lastIndex;
    if (i >= n) return { attrs, end: n };
    if (s[i] === '>') return { attrs, end: i + 1, selfClosing: s[i - 1] === '/' };
    ATTR_NAME.lastIndex = i;
    const m = ATTR_NAME.exec(s);
    if (!m) {
      i += 1; // a stray '=' and the like
      continue;
    }
    const name = m[0].toLowerCase();
    i = ATTR_NAME.lastIndex;
    while (i < n && /\s/.test(s[i])) i += 1;
    let value = '';
    if (s[i] === '=') {
      i += 1;
      while (i < n && /\s/.test(s[i])) i += 1;
      const q = s[i];
      if (q === '"' || q === "'") {
        const close = s.indexOf(q, i + 1);
        const stop = close < 0 ? n : close;
        value = s.slice(i + 1, stop);
        i = close < 0 ? n : close + 1;
      } else {
        let j = i;
        while (j < n && !/[\s>]/.test(s[j])) j += 1;
        value = s.slice(i, j);
        i = j;
      }
    }
    attrs.push([name, decodeEntities(value)]);
  }
}

/** Parse an HTML string into the sanitiser's tree (a forgiving subset of the HTML tree builder). */
export function parseHtml(input) {
  const s = String(input == null ? '' : input);
  const n = s.length;
  const root = elementNode('#root', []);
  const stack = [root];
  const top = () => stack[stack.length - 1];

  const pushText = (text) => {
    if (!text) return;
    const kids = top().kids;
    const last = kids[kids.length - 1];
    if (last && last.t === 'text') last.v += text;
    else kids.push({ t: 'text', v: text });
  };
  const closeTo = (tag, boundaries) => {
    for (let k = stack.length - 1; k > 0; k -= 1) {
      if (stack[k].tag === tag) {
        stack.length = k;
        return true;
      }
      if (boundaries && boundaries.has(stack[k].tag)) return false;
    }
    return false;
  };
  const LIST_SCOPE = new Set(['ul', 'ol', 'table', 'td', 'th']);
  const DL_SCOPE = new Set(['dl', 'table', 'td', 'th']);
  const ROW_SCOPE = new Set(['table', 'thead', 'tbody', 'tfoot']);
  const CELL_SCOPE = new Set(['tr', 'table']);

  let i = 0;
  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) {
      pushText(decodeEntities(s.slice(i)));
      break;
    }
    if (lt > i) pushText(decodeEntities(s.slice(i, lt)));
    i = lt;

    if (s.startsWith('<!--', i)) {
      const end = s.indexOf('-->', i + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    const next = s[i + 1];
    if (next === '!' || next === '?') {
      // doctype, CDATA, processing instruction: dropped (CDATA up to its terminator).
      const term = s.startsWith('<![CDATA[', i) ? ']]>' : '>';
      const end = s.indexOf(term, i + 2);
      i = end < 0 ? n : end + term.length;
      continue;
    }
    if (next === '/') {
      END_TAG.lastIndex = i;
      const m = END_TAG.exec(s);
      if (!m) {
        // "</ x>" and friends are bogus comments; a bare "</" at the end is text.
        const end = s.indexOf('>', i + 2);
        if (end < 0) {
          pushText(s.slice(i));
          break;
        }
        i = end + 1;
        continue;
      }
      i = END_TAG.lastIndex;
      const tag = m[1].toLowerCase();
      if (tag === 'br') top().kids.push(elementNode('br', []));
      else closeTo(tag);
      continue;
    }
    START_TAG.lastIndex = i;
    const m = START_TAG.exec(s);
    if (!m) {
      pushText('<');
      i += 1;
      continue;
    }
    const tag = m[1].toLowerCase();
    const { attrs, end, selfClosing } = readAttributes(s, START_TAG.lastIndex);
    i = end;

    if (RAW_TEXT.has(tag)) {
      // Skip everything up to the matching end tag; its content is never markup we keep.
      const closer = RAW_TEXT_END[tag];
      closer.lastIndex = i;
      const close = closer.exec(s);
      if (!close) {
        i = n;
      } else {
        const gt = s.indexOf('>', close.index);
        i = gt < 0 ? n : gt + 1;
      }
      continue;
    }

    if (CLOSES_P.has(tag) && top().tag === 'p') stack.pop();
    if (tag === 'li') closeTo('li', LIST_SCOPE);
    if (tag === 'dt' || tag === 'dd') {
      if (!closeTo('dt', DL_SCOPE)) closeTo('dd', DL_SCOPE);
    }
    if (tag === 'tr') closeTo('tr', ROW_SCOPE);
    if (tag === 'td' || tag === 'th') {
      if (!closeTo('td', CELL_SCOPE)) closeTo('th', CELL_SCOPE);
    }
    if (tag === 'a') closeTo('a'); // no nested links

    const el = elementNode(tag, attrs);
    if (stack.length > MAX_DEPTH) continue; // absurdly deep markup: its content flows into the parent
    top().kids.push(el);
    if (!VOID.has(tag) && !selfClosing) stack.push(el);
  }
  return root;
}

/** Convert a live DOM node's children into the sanitiser's tree (browser path). */
export function domToTree(node, depth = 0) {
  const root = elementNode('#root', []);
  if (!node) return root;
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 3) {
      root.kids.push({ t: 'text', v: c.nodeValue || '' });
    } else if (c.nodeType === 1) {
      const tag = String(c.localName || c.nodeName || '').toLowerCase();
      // Elements from SVG/MathML (or anything not HTML) are dropped with their content.
      const foreign = c.namespaceURI && c.namespaceURI !== HTML_NS;
      const attrs = [];
      if (c.attributes) for (const a of Array.from(c.attributes)) attrs.push([String(a.name).toLowerCase(), String(a.value)]);
      const el = elementNode(foreign ? '#foreign' : tag, attrs);
      if (!foreign && depth < MAX_DEPTH) el.kids = domToTree(c, depth + 1).kids;
      root.kids.push(el);
    }
  }
  return root;
}

// ---------------------------------------------------------------------------------- filtering

/** Validate a URL for an attribute: returns the cleaned URL or null. */
export function cleanUrl(value, { schemes = LINK_SCHEMES, allowData = false } = {}) {
  if (typeof value !== 'string') return null;
  // Browsers ignore tab/CR/LF inside URLs and leading/trailing control characters + spaces.
  const url = value.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return null;
  if (allowData && /^data:/i.test(url)) {
    return url.length <= MAX_DATA_URL_LENGTH && DATA_IMAGE.test(url) ? url : null;
  }
  if (url.length > MAX_URL_LENGTH) return null;
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
  if (!m || !schemes.has(m[1].toLowerCase())) return null;
  if ((m[1].toLowerCase() === 'http' || m[1].toLowerCase() === 'https') && !/^https?:\/\/[^/\s]/i.test(url)) return null;
  return url;
}

/** Keep only safe, presentational CSS declarations. Returns '' when nothing survives. */
export function cleanStyle(value) {
  if (typeof value !== 'string' || !value) return '';
  const out = [];
  for (const decl of value.slice(0, MAX_STYLE_LENGTH).split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const val = decl.slice(colon + 1).trim();
    if (!STYLE_PROPS.has(prop) || !val || val.length > 300) continue;
    if (BAD_CSS.test(val) || !CSS_VALUE.test(val)) continue;
    out.push(`${prop}: ${val}`);
  }
  return out.join('; ');
}

function cleanAttrs(node, tag, mode, markers) {
  const out = [];
  const seen = new Set();
  const add = (name, value) => {
    if (seen.has(name)) return;
    seen.add(name);
    out.push([name, value]);
  };
  let fontColor = null;
  for (const [rawName, rawValue] of node.attrs) {
    const name = String(rawName).toLowerCase();
    const value = String(rawValue == null ? '' : rawValue);
    if (name.startsWith('on')) continue;
    switch (name) {
      case 'style': {
        const css = cleanStyle(value);
        if (css) add('style', css);
        break;
      }
      case 'dir':
        if (/^(ltr|rtl|auto)$/i.test(value)) add('dir', value.toLowerCase());
        break;
      case 'lang':
        if (/^[a-z]{1,8}(-[a-z0-9]{1,8})*$/i.test(value)) add('lang', value);
        break;
      case 'title':
        if (value.length <= 300) add('title', value);
        break;
      case 'align':
        if (ALIGN_TAGS.has(tag) && /^(left|right|center|justify|middle|top|bottom)$/i.test(value)) add('align', value.toLowerCase());
        break;
      case 'valign':
        if ((CELL_TAGS.has(tag) || tag === 'tr') && /^(top|middle|bottom|baseline)$/i.test(value)) add('valign', value.toLowerCase());
        break;
      case 'width':
      case 'height':
        if (SIZED_TAGS.has(tag) && DIMENSION.test(value.trim())) add(name, value.trim());
        break;
      case 'colspan':
      case 'rowspan':
        if (CELL_TAGS.has(tag) && /^\d{1,3}$/.test(value.trim())) add(name, value.trim());
        break;
      case 'span':
        if ((tag === 'col' || tag === 'colgroup') && /^\d{1,3}$/.test(value.trim())) add('span', value.trim());
        break;
      case 'cellpadding':
      case 'cellspacing':
      case 'border':
        if (tag === 'table' && /^\d{1,2}$/.test(value.trim())) add(name, value.trim());
        break;
      case 'bgcolor':
        if ((tag === 'table' || tag === 'tr' || CELL_TAGS.has(tag)) && COLOR.test(value.trim())) add('bgcolor', value.trim());
        break;
      case 'color':
        if (node.tag === 'font' && COLOR.test(value.trim())) fontColor = value.trim();
        break;
      case 'start':
        if (tag === 'ol' && /^-?\d{1,6}$/.test(value.trim())) add('start', value.trim());
        break;
      case 'type':
        if (tag === 'ol' && /^(1|a|A|i|I)$/.test(value.trim())) add('type', value.trim());
        else if (tag === 'ul' && /^(disc|circle|square)$/i.test(value.trim())) add('type', value.trim().toLowerCase());
        else if (tag === 'blockquote' && value.trim().toLowerCase() === 'cite') add('type', 'cite');
        break;
      case 'href':
        if (tag === 'a') {
          const url = cleanUrl(value);
          if (url) add('href', url);
        }
        break;
      case 'alt':
        if (tag === 'img') add('alt', value.slice(0, 500));
        break;
      case 'src':
      case 'data-mt-src':
        if (tag === 'img') {
          const data = name === 'src' ? cleanUrl(value, { allowData: true, schemes: new Set() }) : null;
          if (data) {
            add('src', data);
            break;
          }
          const remote = cleanUrl(value, { schemes: new Set(['http', 'https']) });
          if (remote) add(mode === 'editor' ? 'data-mt-src' : 'src', remote);
        }
        break;
      case 'data-mt-signature':
      case 'data-mt-quote':
        // The composer's own markers; pasted content never gets to bring its own.
        if (tag === 'div' && markers) add(name, '1');
        break;
      default:
        break; // class, id, data-*, event handlers, form attributes, ...: dropped
    }
  }
  if (fontColor) {
    const existing = out.find((a) => a[0] === 'style');
    const css = cleanStyle(`color: ${fontColor}`);
    if (css) {
      if (existing) existing[1] = `${css}; ${existing[1]}`;
      else out.push(['style', css]);
    }
  }
  return out;
}

function sanitizeKids(kids, mode, depth, markers) {
  const out = [];
  for (const node of kids) {
    if (!node) continue;
    if (node.t === 'text') {
      const v = String(node.v || '').replace(/\u0000/g, '');
      if (!v) continue;
      const last = out[out.length - 1];
      if (last && last.t === 'text') last.v += v;
      else out.push({ t: 'text', v });
      continue;
    }
    if (node.t !== 'el') continue;
    const source = node.tag;
    if (DROP.has(source) || source === '#foreign') continue;
    const tag = Object.prototype.hasOwnProperty.call(TAGS, source) ? TAGS[source] : null;
    const kidsOut = depth < MAX_DEPTH && !VOID.has(source) ? sanitizeKids(node.kids || [], mode, depth + 1, markers) : [];
    if (!tag) {
      // Unknown or structural-only element (form, label, o:p, custom elements...): keep the content.
      for (const k of kidsOut) out.push(k);
      continue;
    }
    const attrs = cleanAttrs(node, tag, mode, markers);
    if (tag === 'img' && !attrs.some((a) => a[0] === 'src' || a[0] === 'data-mt-src')) {
      const alt = attrs.find((a) => a[0] === 'alt');
      if (alt && alt[1].trim()) out.push({ t: 'text', v: `[${alt[1].trim()}]` });
      continue;
    }
    if (tag === 'a' && !attrs.some((a) => a[0] === 'href')) {
      for (const k of kidsOut) out.push(k); // a link with an unsafe target becomes plain text
      continue;
    }
    out.push({ t: 'el', tag, attrs, kids: VOID.has(tag) ? [] : kidsOut });
  }
  return out;
}

/** Filter a parsed tree against the allow-list. */
export function sanitizeTree(root, { mode = 'send', markers = true } = {}) {
  return { t: 'el', tag: '#root', attrs: [], kids: sanitizeKids((root && root.kids) || [], mode, 0, markers) };
}

// ---------------------------------------------------------------------------------- output

export function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
}

function escapeAttr(s) {
  return escapeText(s).replace(/"/g, '&quot;');
}

/** Serialise a (sanitised) tree. Tag and attribute names come from the allow-list only. */
export function serializeTree(root) {
  const parts = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.t === 'text') {
        parts.push(escapeText(node.v));
        continue;
      }
      parts.push(`<${node.tag}`);
      for (const [name, value] of node.attrs) parts.push(` ${name}="${escapeAttr(value)}"`);
      parts.push('>');
      if (VOID.has(node.tag)) continue;
      walk(node.kids);
      parts.push(`</${node.tag}>`);
    }
  };
  walk(root.kids || []);
  return parts.join('');
}

/** Build DOM nodes for a sanitised tree in `doc` (no markup parsing involved). */
export function treeToFragment(root, doc) {
  const frag = doc.createDocumentFragment();
  const build = (nodes, parent) => {
    for (const node of nodes) {
      if (node.t === 'text') {
        parent.appendChild(doc.createTextNode(node.v));
        continue;
      }
      const el = doc.createElement(node.tag);
      for (const [name, value] of node.attrs) el.setAttribute(name, value);
      if (!VOID.has(node.tag)) build(node.kids, el);
      parent.appendChild(el);
    }
  };
  build(root.kids || [], frag);
  return frag;
}

/** Plain text of a tree (for "is it empty?" and keyword checks). Block ends become newlines. */
export function treeText(root) {
  const BLOCK = new Set(['p', 'div', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'hr', 'table', 'ul', 'ol']);
  let out = '';
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.t === 'text') out += node.v;
      else {
        walk(node.kids || []);
        if (BLOCK.has(node.tag)) out += '\n';
      }
    }
  };
  walk((root && root.kids) || []);
  return out;
}

/** True when a tree has no visible text and no images. */
export function isTreeEmpty(root) {
  const hasImage = (nodes) => nodes.some((n) => n.t === 'el' && (n.tag === 'img' || hasImage(n.kids || [])));
  return !treeText(root).replace(/[\s ​]+/g, '') && !hasImage((root && root.kids) || []);
}

// ---------------------------------------------------------------------------------- entry points

/** Parse untrusted HTML with the browser's own parser when there is one (inert document). */
export function parseUntrusted(html) {
  if (typeof DOMParser === 'function') {
    try {
      const doc = new DOMParser().parseFromString(String(html == null ? '' : html), 'text/html');
      return domToTree(doc.body || doc.documentElement);
    } catch (_) {
      /* fall back to the string parser */
    }
  }
  return parseHtml(html);
}

/** Untrusted HTML string -> sanitised HTML string. */
export function sanitizeHtml(html, { mode = 'send', markers = true } = {}) {
  return serializeTree(sanitizeTree(parseUntrusted(html), { mode, markers }));
}

/** Untrusted HTML string -> DocumentFragment ready to insert into the editor. */
export function htmlToFragment(html, doc, { mode = 'editor', markers = true } = {}) {
  return treeToFragment(sanitizeTree(parseUntrusted(html), { mode, markers }), doc);
}

/** The editor's (or any element's) content as sanitised HTML for sending. */
export function serializeElement(el, { mode = 'send' } = {}) {
  return serializeTree(sanitizeTree(domToTree(el), { mode }));
}

/** Plain text -> HTML with line breaks kept (each line becomes a <div>, like typing does). */
export function textToHtml(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
  if (lines.length === 1) return escapeText(lines[0]);
  return lines.map((line) => (line ? `<div>${escapeText(line)}</div>` : '<div><br></div>')).join('');
}

export const SANITIZE_LIMITS = { MAX_DEPTH, MAX_STYLE_LENGTH, MAX_URL_LENGTH };
