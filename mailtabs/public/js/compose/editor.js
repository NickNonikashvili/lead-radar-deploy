// Rich-text editor for the composer and the signature settings: a contenteditable surface plus a
// formatting toolbar driven by document.execCommand (still the only API that keeps the browser's
// native undo stack). Untrusted HTML enters only through sanitize.js: pasted/dropped markup is
// sanitised before insertion, and a MutationObserver scrubs anything that slips in another way.
import { html, useEffect, useLayoutEffect, useRef, useState } from '/vendor/preact-htm.js';
import { CIcon } from './compose-icons.js';
import { cleanUrl, domToTree, escapeText, htmlToFragment, parseUntrusted, sanitizeHtml, sanitizeTree, serializeElement, treeText } from './sanitize.js';
import { pastedImageName } from './compose-utils.js';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl+';

// Elements that must never live in the editor, whatever inserted them.
const FORBIDDEN = 'script,style,link,meta,base,iframe,frame,frameset,object,embed,applet,form,input,button,select,textarea,svg,math,template,noscript,audio,video,canvas';

function closestWithin(node, selector, root) {
  let el = node && node.nodeType === 1 ? node : node && node.parentNode;
  while (el && el !== root) {
    if (el.nodeType === 1 && el.matches && el.matches(selector)) return el;
    el = el.parentNode;
  }
  return null;
}

function queryCommand(cmd) {
  try {
    return document.queryCommandState(cmd);
  } catch (_) {
    return false;
  }
}

function exec(cmd, value = null) {
  try {
    return document.execCommand(cmd, false, value);
  } catch (_) {
    return false;
  }
}

/** Turn what a user typed into a link target, or null. */
export function normaliseLinkInput(input) {
  const v = String(input || '').trim();
  if (!v) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return cleanUrl(v);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return cleanUrl(`mailto:${v}`);
  if (/^[^\s]+\.[^\s]{2,}/.test(v) && !/\s/.test(v)) return cleanUrl(`https://${v.replace(/^\/+/, '')}`);
  return null;
}

function blankLineEl() {
  const div = document.createElement('div');
  div.appendChild(document.createElement('br'));
  return div;
}

/** Replace, add or remove the data-mt-signature block inside `root` (editor content). */
function swapSignatureIn(root, signatureHtml) {
  const existing = root.querySelector('[data-mt-signature]');
  const frag = signatureHtml ? htmlToFragment(signatureHtml, document, { mode: 'editor' }) : null;
  const hasContent = frag && frag.childNodes.length > 0;
  if (existing) {
    if (hasContent) existing.replaceChildren(frag);
    else {
      // Also drop the blank line that separated it from the text.
      const prev = existing.previousElementSibling;
      existing.remove();
      if (prev && prev.textContent === '' && !prev.querySelector('img') && prev !== root.firstElementChild) prev.remove();
    }
  } else if (hasContent) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-mt-signature', '1');
    wrap.appendChild(frag);
    const quote = root.querySelector('[data-mt-quote]');
    if (quote) {
      root.insertBefore(blankLineEl(), quote);
      root.insertBefore(wrap, quote);
    } else {
      root.appendChild(blankLineEl());
      root.appendChild(wrap);
    }
  }
}

/** swapSignatureIn for body HTML that isn't in an editor (yet): same input and output format as the editor's. */
export function swapSignatureInHtml(bodyHtml, signatureHtml) {
  const root = document.createElement('div');
  root.appendChild(htmlToFragment(bodyHtml || '', document, { mode: 'editor' }));
  swapSignatureIn(root, signatureHtml);
  return serializeElement(root, { mode: 'send' });
}

/**
 * Owns one contenteditable element. Components call attach()/detach(); the composer reads the
 * content with getHtml() (sanitised for sending) and listens through `onChange`.
 */
export class EditorController {
  constructor({ onChange, onFiles, onSubmitShortcut } = {}) {
    this.el = null;
    this.onChange = onChange || null;
    this.onFiles = onFiles || null;
    this.onSubmitShortcut = onSubmitShortcut || null;
    this.listeners = new Set();
    this.savedRange = null;
    this.internalDrag = false;
    this.stateCache = {};
    this.linkRequestHandler = null;
    this.handlers = {
      input: () => this.changed(),
      paste: (e) => this.onPaste(e),
      drop: (e) => this.onDrop(e),
      dragstart: () => {
        this.internalDrag = true;
      },
      dragend: () => {
        this.internalDrag = false;
      },
      keydown: (e) => this.onKeyDown(e),
      selectionchange: () => this.onSelectionChange(),
      blur: () => {
        // The selection is still in the editor while it blurs: keep it for toolbar/link actions.
        this.captureSelection();
        this.notify();
      },
    };
  }

  attach(el) {
    if (this.el === el) return;
    if (this.el) this.detach();
    this.el = el;
    // Plain <b>/<i> tags instead of style spans, and <div> lines like most mail clients.
    exec('styleWithCSS', false);
    exec('defaultParagraphSeparator', 'div');
    for (const type of ['input', 'paste', 'drop', 'dragstart', 'dragend', 'keydown', 'blur']) el.addEventListener(type, this.handlers[type]);
    document.addEventListener('selectionchange', this.handlers.selectionchange);
    this.observer = new MutationObserver((records) => this.scrub(records));
    this.observer.observe(el, { childList: true, subtree: true, attributes: true });
  }

  detach() {
    if (!this.el) return;
    for (const type of ['input', 'paste', 'drop', 'dragstart', 'dragend', 'keydown', 'blur']) this.el.removeEventListener(type, this.handlers[type]);
    document.removeEventListener('selectionchange', this.handlers.selectionchange);
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    this.el = null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of [...this.listeners]) fn();
  }

  changed() {
    if (this.onChange) this.onChange();
    this.notify();
  }

  // ---- content

  /** Replace the content with (untrusted) HTML. */
  setHtml(untrusted) {
    if (!this.el) return;
    const frag = htmlToFragment(untrusted || '', document, { mode: 'editor' });
    this.el.replaceChildren(frag);
    if (!this.el.firstChild) this.el.appendChild(this.blankLine());
  }

  /** Content sanitised for sending ('send' mode restores remote image URLs). */
  getHtml() {
    return this.el ? serializeElement(this.el, { mode: 'send' }) : null;
  }

  /** Text the user wrote (without the signature or an expanded quote). */
  getText() {
    if (!this.el) return '';
    const strip = (nodes) =>
      nodes
        .filter((n) => !(n.t === 'el' && n.attrs.some((a) => a[0] === 'data-mt-signature' || a[0] === 'data-mt-quote')))
        .map((n) => (n.t === 'el' ? { ...n, kids: strip(n.kids) } : n));
    const tree = domToTree(this.el);
    return treeText({ kids: strip(tree.kids) });
  }

  isEmpty() {
    return !this.getText().replace(/[\s ​]+/g, '') && !(this.el && this.el.querySelector('img'));
  }

  blankLine() {
    return blankLineEl();
  }

  /**
   * Replace (or add/remove) the data-mt-signature block. Returns false when the editor isn't
   * showing anything yet (the caller then changes the HTML it is about to load instead).
   */
  swapSignature(signatureHtml) {
    if (!this.el) return false;
    swapSignatureIn(this.el, signatureHtml);
    this.notify();
    return true;
  }

  /** Move a collapsed quote into the editor. */
  appendQuote(quoteHtml) {
    if (!this.el || !quoteHtml) return;
    const wrap = document.createElement('div');
    wrap.setAttribute('data-mt-quote', '1');
    wrap.appendChild(htmlToFragment(quoteHtml, document, { mode: 'editor' }));
    this.el.appendChild(this.blankLine());
    this.el.appendChild(wrap);
    if (typeof wrap.scrollIntoView === 'function') wrap.scrollIntoView({ block: 'nearest' });
  }

  /** where: 'start' (first line), 'end', or 'keep' (where the caret was, else the end). */
  focus(where = 'start') {
    if (!this.el) return;
    const sel = window.getSelection();
    if (where === 'keep') {
      const inside = !!sel && sel.rangeCount > 0 && this.el.contains(sel.getRangeAt(0).startContainer);
      this.el.focus({ preventScroll: true });
      if (inside) return;
      if (sel && this.savedRange && this.el.contains(this.savedRange.startContainer)) {
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
        return;
      }
      where = 'end';
    }
    this.el.focus({ preventScroll: where !== 'end' });
    if (!sel) return;
    const range = document.createRange();
    if (where === 'end') {
      range.selectNodeContents(this.el);
      range.collapse(false);
    } else {
      // Inside the first line, so typing goes into its <div> instead of before it.
      let target = this.el;
      while (target.firstChild && target.firstChild.nodeType === 1 && !['BR', 'IMG', 'HR'].includes(target.firstChild.nodeName)) target = target.firstChild;
      range.setStart(target, 0);
      range.collapse(true);
      if (this.el.parentElement) this.el.parentElement.scrollTop = 0;
    }
    sel.removeAllRanges();
    sel.addRange(range);
    this.savedRange = range.cloneRange();
  }

  // ---- selection

  selectionInside() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !this.el) return null;
    const range = sel.getRangeAt(0);
    return this.el.contains(range.commonAncestorContainer) ? range : null;
  }

  onSelectionChange() {
    // Only track the selection while the editor has focus: when focus moves to a field (e.g. the
    // link form) browsers may collapse the old selection, which must not overwrite the saved one.
    if (!this.el || document.activeElement !== this.el) return;
    const range = this.selectionInside();
    if (!range) return;
    this.savedRange = range.cloneRange();
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.notify();
    });
  }

  captureSelection() {
    const range = this.selectionInside();
    if (range) this.savedRange = range.cloneRange();
  }

  /** Focus the editor and put back the last selection it had (focus moves to toolbars/forms). */
  restoreSelection() {
    if (!this.el) return false;
    const hadFocus = document.activeElement === this.el;
    const live = this.selectionInside();
    if (hadFocus && live) return true;
    const saved = this.savedRange && this.el.contains(this.savedRange.commonAncestorContainer) ? this.savedRange.cloneRange() : null;
    if (!hadFocus) this.el.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    if (saved) sel.addRange(saved);
    else if (live) sel.addRange(live);
    else {
      const r = document.createRange();
      r.selectNodeContents(this.el);
      r.collapse(false);
      sel.addRange(r);
    }
    return true;
  }

  /** Toolbar state for the current selection (only meaningful while it is in this editor). */
  getState() {
    const range = this.selectionInside() || (this.savedRange && this.el && this.el.contains(this.savedRange.commonAncestorContainer) ? this.savedRange : null);
    if (!range) return {};
    const node = range.startContainer;
    const active = document.activeElement === this.el;
    const link = !!closestWithin(node, 'a[href]', this.el);
    return {
      bold: active && queryCommand('bold'),
      italic: active && queryCommand('italic'),
      // Links are underlined by the browser; don't report that as the Underline format.
      underline: active && !link && queryCommand('underline'),
      strikeThrough: active && queryCommand('strikeThrough'),
      insertUnorderedList: !!closestWithin(node, 'ul', this.el),
      insertOrderedList: !!closestWithin(node, 'ol', this.el),
      blockquote: !!closestWithin(node, 'blockquote', this.el),
      link,
    };
  }

  // ---- commands

  command(cmd) {
    if (!this.el) return;
    this.restoreSelection();
    if (cmd === 'blockquote') {
      // Toggle: formatBlock wraps the current line, and formatBlock div unwraps it again.
      const range = this.selectionInside();
      const inQuote = range && closestWithin(range.startContainer, 'blockquote', this.el);
      exec('formatBlock', inQuote ? 'div' : 'blockquote');
    } else if (cmd === 'removeFormat') {
      exec('removeFormat');
      exec('unlink');
    } else if (cmd === 'unlink') {
      this.removeLink();
      return;
    } else {
      exec(cmd);
    }
    this.changed();
  }

  linkInfo() {
    const range = this.selectionInside() || this.savedRange;
    if (!range || !this.el || !this.el.contains(range.commonAncestorContainer)) return { href: '', text: '', collapsed: true };
    const anchor = closestWithin(range.startContainer, 'a[href]', this.el);
    return { href: anchor ? anchor.getAttribute('href') || '' : '', text: range.toString(), collapsed: range.collapsed, inLink: !!anchor };
  }

  /** Link the selection (or insert `text` at the caret) to an already-validated URL. */
  applyLink(url, text) {
    const safe = cleanUrl(url);
    if (!safe || !this.el) return false;
    this.restoreSelection();
    const range = this.selectionInside();
    const anchor = range && closestWithin(range.startContainer, 'a[href]', this.el);
    if (anchor) {
      anchor.setAttribute('href', safe);
    } else if (!range || range.collapsed) {
      const label = String(text || '').trim() || safe.replace(/^mailto:/i, '');
      document.execCommand('insertHTML', false, sanitizeHtml(`<a href="${escapeText(safe).replace(/"/g, '&quot;')}">${escapeText(label)}</a>`, { mode: 'editor' }));
    } else {
      exec('createLink', safe);
    }
    this.changed();
    return true;
  }

  removeLink() {
    if (!this.el) return;
    this.restoreSelection();
    const range = this.selectionInside();
    const anchor = range && closestWithin(range.startContainer, 'a[href]', this.el);
    if (anchor && range.collapsed) {
      const r = document.createRange();
      r.selectNodeContents(anchor);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
    exec('unlink');
    this.changed();
  }

  requestLink() {
    if (this.linkRequestHandler) this.linkRequestHandler();
  }

  // ---- input handling

  insertUntrustedHtml(untrusted) {
    // insertHTML keeps the native undo history; the markup is sanitised first.
    if (!document.execCommand('insertHTML', false, sanitizeHtml(untrusted, { mode: 'editor', markers: false }))) {
      const range = this.selectionInside();
      if (!range) return;
      range.deleteContents();
      const frag = htmlToFragment(untrusted, document, { mode: 'editor', markers: false });
      const last = frag.lastChild;
      range.insertNode(frag);
      if (last) {
        range.setStartAfter(last);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }

  insertText(text) {
    if (!document.execCommand('insertText', false, text)) {
      const range = this.selectionInside();
      if (!range) return;
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    }
  }

  onPaste(e) {
    const dt = e.clipboardData;
    if (!dt) return;
    const htmlData = dt.getData('text/html') || '';
    const text = dt.getData('text/plain') || '';
    const files = Array.from(dt.files || []);
    e.preventDefault();
    // "Copy image" puts an <img> (and no text) next to the image file: attach the file.
    const markupHasText = htmlData && treeText(sanitizeTree(parseUntrusted(htmlData))).trim();
    if (files.length && !text.trim() && !markupHasText) {
      if (this.onFiles) {
        this.onFiles(
          files.map((f) => (f.name && f.name !== 'image.png' ? f : new File([f], pastedImageName(f.type), { type: f.type || 'image/png' })))
        );
      }
      return;
    }
    if (htmlData.trim()) this.insertUntrustedHtml(htmlData);
    else if (text) this.insertText(text);
    this.changed();
  }

  onDrop(e) {
    const dt = e.dataTransfer;
    if (!dt) return;
    if (dt.files && dt.files.length) {
      e.preventDefault();
      e.stopPropagation(); // the composer window would attach them a second time
      if (this.onFiles) this.onFiles(Array.from(dt.files));
      return;
    }
    if (this.internalDrag) return; // moving text inside the editor: the browser handles it
    const htmlData = dt.getData('text/html') || '';
    const text = dt.getData('text/plain') || '';
    if (!htmlData && !text) return;
    e.preventDefault();
    let range = null;
    if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(e.clientX, e.clientY);
    else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    }
    this.el.focus({ preventScroll: true });
    if (range && this.el.contains(range.startContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    if (htmlData.trim()) this.insertUntrustedHtml(htmlData);
    else this.insertText(text);
    this.changed();
  }

  onKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'k') {
      e.preventDefault();
      this.captureSelection(); // selectionchange is async: take the selection as it is right now
      this.requestLink();
    } else if (e.shiftKey && (e.key === '&' || e.code === 'Digit7')) {
      e.preventDefault();
      this.command('insertOrderedList');
    } else if (e.shiftKey && (e.key === '*' || e.code === 'Digit8')) {
      e.preventDefault();
      this.command('insertUnorderedList');
    } else if (key === 'b' || key === 'i' || key === 'u') {
      // Native, but let the toolbar catch up.
      setTimeout(() => this.changed(), 0);
    }
  }

  /** Defence in depth: remove anything dangerous that entered the editor by any route. */
  scrub(records) {
    for (const r of records) {
      if (r.type === 'attributes') {
        this.scrubElement(r.target);
        continue;
      }
      for (const node of r.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches(FORBIDDEN)) {
          node.remove();
          continue;
        }
        this.scrubElement(node);
        for (const bad of node.querySelectorAll(FORBIDDEN)) bad.remove();
        for (const child of node.querySelectorAll('*')) this.scrubElement(child);
      }
    }
  }

  scrubElement(el) {
    if (!el || el.nodeType !== 1 || !el.attributes) return;
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'formaction' || name === 'srcdoc') el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'xlink:href') && !cleanUrl(attr.value)) el.removeAttribute(attr.name);
      else if (name === 'src' && el.nodeName === 'IMG' && !/^data:image\//i.test(attr.value) && !/^blob:/i.test(attr.value)) {
        // Remote images aren't loaded in the editor (privacy + CSP); they are restored on send.
        const remote = cleanUrl(attr.value, { schemes: new Set(['http', 'https']) });
        el.removeAttribute('src');
        if (remote) el.setAttribute('data-mt-src', remote);
      }
    }
  }
}

// ------------------------------------------------------------------------------- components

/** The editable surface. `html` is (re)loaded whenever `version` changes. */
export function EditorSurface({ controller, html: initialHtml, version = 0, label = 'Message', className = '', minHeight }) {
  const ref = useRef(null);
  useEffect(() => {
    controller.attach(ref.current);
    return () => controller.detach();
  }, [controller]);
  useEffect(() => {
    controller.setHtml(initialHtml || '');
  }, [controller, version]);
  return html`<div
    ref=${ref}
    class=${`rte ${className}`}
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    aria-label=${label}
    spellcheck="true"
    style=${minHeight ? { minHeight } : undefined}
  ></div>`;
}

const BUTTONS = [
  { cmd: 'bold', icon: 'bold', label: 'Bold', keys: `${MOD_KEY}B`, toggle: true },
  { cmd: 'italic', icon: 'italic', label: 'Italic', keys: `${MOD_KEY}I`, toggle: true },
  { cmd: 'underline', icon: 'underline', label: 'Underline', keys: `${MOD_KEY}U`, toggle: true },
  { cmd: 'strikeThrough', icon: 'strike', label: 'Strikethrough', toggle: true },
  { sep: true },
  { cmd: 'insertUnorderedList', icon: 'listBullet', label: 'Bulleted list', keys: `${MOD_KEY}Shift+8`, toggle: true },
  { cmd: 'insertOrderedList', icon: 'listNumber', label: 'Numbered list', keys: `${MOD_KEY}Shift+7`, toggle: true },
  { cmd: 'blockquote', icon: 'quote', label: 'Quote', toggle: true, full: true },
  { sep: true },
  { cmd: 'link', icon: 'link', label: 'Insert link', keys: `${MOD_KEY}K`, toggle: true },
  { cmd: 'unlink', icon: 'unlink', label: 'Remove link' },
  { cmd: 'removeFormat', icon: 'eraser', label: 'Clear formatting' },
  { sep: true, full: true },
  { cmd: 'undo', icon: 'undo', label: 'Undo', keys: `${MOD_KEY}Z`, full: true },
  { cmd: 'redo', icon: 'redo', label: 'Redo', keys: IS_MAC ? '⌘⇧Z' : 'Ctrl+Y', full: true },
];

function LinkForm({ controller, onClose }) {
  const [info] = useState(() => controller.linkInfo());
  const [url, setUrl] = useState(info.href || '');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const urlRef = useRef(null);
  const needsText = info.collapsed && !info.inLink;

  // Layout effect: focus before the next keystroke can land in the editor.
  useLayoutEffect(() => {
    if (urlRef.current) urlRef.current.focus();
  }, []);

  const apply = (e) => {
    e.preventDefault();
    const target = normaliseLinkInput(url);
    if (!target) {
      setError('Enter a web address like example.com, or an email address.');
      return;
    }
    controller.applyLink(target, text);
    onClose();
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    } else if (e.key === 'Enter') {
      apply(e);
    }
  };
  return html`<div class="rte-link" role="group" aria-label="Link" onKeyDown=${onKeyDown}>
    ${needsText
      ? html`<label class="rte-link-field">
          <span class="rte-link-label">Text</span>
          <input class="input" type="text" value=${text} placeholder="Text to show" onInput=${(e) => setText(e.currentTarget.value)} />
        </label>`
      : null}
    <label class="rte-link-field">
      <span class="rte-link-label">Link</span>
      <input
        ref=${urlRef}
        class=${`input ${error ? 'is-invalid' : ''}`}
        type="text"
        inputmode="url"
        autocomplete="off"
        spellcheck=${false}
        value=${url}
        placeholder="example.com or name@example.com"
        aria-invalid=${error ? 'true' : 'false'}
        onInput=${(e) => {
          setUrl(e.currentTarget.value);
          setError('');
        }}
      />
    </label>
    ${error ? html`<p class="rte-link-error" role="alert">${error}</p>` : null}
    <div class="rte-link-actions">
      ${info.inLink
        ? html`<button
            type="button"
            class="btn btn-sm btn-ghost btn-danger-text"
            onClick=${() => {
              controller.removeLink();
              onClose();
            }}
          >
            Remove link
          </button>`
        : null}
      <span class="spacer"></span>
      <button type="button" class="btn btn-sm btn-ghost" onClick=${() => onClose(true)}>Cancel</button>
      <button type="button" class="btn btn-sm btn-primary" onClick=${apply}>${info.inLink ? 'Update' : 'Add link'}</button>
    </div>
  </div>`;
}

/** Formatting toolbar (role=toolbar with roving focus). `compact` hides the less common buttons. */
export function FormatToolbar({ controller, compact = false, label = 'Formatting', className = '' }) {
  const [, setTick] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const barRef = useRef(null);

  useEffect(() => controller.subscribe(() => setTick((n) => n + 1)), [controller]);
  useEffect(() => {
    controller.linkRequestHandler = () => setLinkOpen(true);
    return () => {
      controller.linkRequestHandler = null;
    };
  }, [controller]);

  const state = controller.getState();
  const buttons = BUTTONS.filter((b) => !compact || !b.full);
  const actionable = buttons.filter((b) => !b.sep);

  const run = (b) => {
    if (b.cmd === 'link') {
      setLinkOpen((open) => !open);
      return;
    }
    controller.command(b.cmd);
  };
  const onKeyDown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    if (e.target.closest && e.target.closest('.rte-link')) return;
    e.preventDefault();
    let i = focusIndex;
    if (e.key === 'ArrowRight') i = (i + 1) % actionable.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + actionable.length) % actionable.length;
    else if (e.key === 'Home') i = 0;
    else i = actionable.length - 1;
    setFocusIndex(i);
    const el = barRef.current && barRef.current.querySelectorAll('.rte-btn')[i];
    if (el) el.focus();
  };

  let idx = -1;
  return html`<div class=${`rte-toolbar-wrap ${className}`}>
    ${linkOpen
      ? html`<${LinkForm}
          controller=${controller}
          onClose=${(restore) => {
            setLinkOpen(false);
            if (restore) controller.restoreSelection();
          }}
        />`
      : null}
    <div ref=${barRef} class="rte-toolbar" role="toolbar" aria-label=${label} onKeyDown=${onKeyDown}>
      ${buttons.map((b, i) => {
        if (b.sep) return html`<span key=${`sep${i}`} class="rte-sep" aria-hidden="true"></span>`;
        idx += 1;
        const my = idx;
        const pressed = b.cmd === 'link' ? linkOpen || !!state.link : !!state[b.cmd];
        return html`<button
          key=${b.cmd}
          type="button"
          class=${`rte-btn ${pressed && b.toggle ? 'is-on' : ''}`}
          aria-label=${b.label}
          title=${b.keys ? `${b.label} (${b.keys})` : b.label}
          aria-pressed=${b.toggle ? (pressed ? 'true' : 'false') : undefined}
          tabindex=${my === focusIndex ? '0' : '-1'}
          onMouseDown=${(e) => e.preventDefault()}
          onFocus=${() => setFocusIndex(my)}
          onClick=${() => run(b)}
        >
          <${CIcon} name=${b.icon} size=${16} />
        </button>`;
      })}
    </div>
  </div>`;
}
