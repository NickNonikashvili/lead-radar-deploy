// The sandboxed iframe that shows a message body (auto-sized to its content), and printing.
import { html, useEffect, useRef, useState } from '/vendor/preact-htm.js';
import { bodyUrl, printUrl } from '../api.js';
import { forwardShortcutsFrom } from '../keyboard.js';

// NEVER add allow-scripts here: with allow-same-origin it would let email HTML
// run script with access to the app. The body endpoint also sends its own CSP.
export const FRAME_SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

// The print page is loaded into a hidden frame so the browser's print dialog opens right away.
// allow-modals is what lets print() run in a sandboxed frame; scripts stay off (and the
// print page's CSP forbids them as well).
const PRINT_SANDBOX = 'allow-same-origin allow-modals';

/** Height of the iframe's content, independent of the iframe's current height. */
function contentHeight(iframe) {
  let doc;
  try {
    doc = iframe.contentDocument;
  } catch (_) {
    return null; // not same-origin (should not happen)
  }
  if (!doc || !doc.documentElement) return null;
  const body = doc.body;
  if (!body) return null;
  // Measure the content wrapper, not html/body: their height can depend on the iframe's own
  // height (height:100%, 100vh), which would make every resize grow the iframe again.
  const wrapper = doc.getElementById('mt-root');
  const view = doc.defaultView;
  const style = view ? view.getComputedStyle(body) : null;
  const padding = style ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.marginTop) + parseFloat(style.marginBottom) : 32;
  const h = wrapper ? wrapper.getBoundingClientRect().height + (Number.isFinite(padding) ? padding : 32) : body.scrollHeight;
  return Math.ceil(h);
}

// If an email still manages to grow with its frame, stop following it after a few rounds
// and let the frame scroll instead.
const MAX_GROWTHS_PER_SECOND = 6;

export function BodyFrame({ messageId, showImages, title }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(160);
  const observer = useRef(null);

  const growth = useRef({ count: 0, since: 0, last: 0 });
  const resize = () => {
    const iframe = ref.current;
    if (!iframe) return;
    const h = contentHeight(iframe);
    if (!h || h <= 0) return;
    const g = growth.current;
    const now = performance.now();
    if (now - g.since > 1000) {
      g.since = now;
      g.count = 0;
    }
    if (h > g.last) g.count += 1;
    g.last = h;
    if (g.count > MAX_GROWTHS_PER_SECOND) {
      if (observer.current) observer.current.disconnect();
      return;
    }
    setHeight(h);
  };

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(resize);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  const onLoad = () => {
    resize();
    const iframe = ref.current;
    let doc = null;
    try {
      doc = iframe && iframe.contentDocument;
    } catch (_) {
      doc = null;
    }
    if (!doc || !doc.body) return;
    // Late-loading images and web fonts change the height after `load`.
    if (observer.current) observer.current.disconnect();
    if (typeof ResizeObserver === 'function') {
      observer.current = new ResizeObserver(() => resize());
      observer.current.observe(doc.body);
    }
    doc.addEventListener('load', resize, true); // capture: <img> load events don't bubble
    forwardShortcutsFrom(doc);
  };

  return html`<iframe
    ref=${ref}
    class="reader-frame"
    title=${`Message body: ${title}`}
    sandbox=${FRAME_SANDBOX}
    src=${bodyUrl(messageId, showImages)}
    referrerpolicy="no-referrer"
    style=${{ height: `${height}px` }}
    onLoad=${onLoad}
  ></iframe>`;
}

let printFrame = null;

/**
 * Print a message: the server renders a printable page; desktop browsers print it straight
 * from a hidden frame, phones (and anything that refuses) get it in a new tab instead.
 */
export function printMessage(messageId, showImages, { preferTab = false } = {}) {
  const url = printUrl(messageId, showImages);
  const openTab = () => window.open(url, '_blank', 'noopener');
  if (preferTab) return openTab();
  if (printFrame) printFrame.remove();
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.setAttribute('sandbox', PRINT_SANDBOX);
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.title = 'Print';
  frame.addEventListener('load', () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (_) {
      openTab();
    }
  });
  frame.src = url;
  document.body.appendChild(frame);
  printFrame = frame;
}
