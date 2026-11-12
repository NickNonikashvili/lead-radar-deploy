// Reading pane: header, actions, privacy banner, sandboxed body iframe, attachments.
import { html, useEffect, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { accountLabel, closeReader, moveMessages, retryDetail, showImagesFor, toggleRead, toggleStar } from '../actions.js';
import { attachmentUrl, bodyUrl } from '../api.js';
import { Icon, Spinner } from '../icons.js';
import { formatAddress, formatBytes, formatFullDate, initials, senderLabel } from '../format.js';
import { ColorDot } from './ui.js';
import { forwardShortcutsFrom } from '../keyboard.js';
import { ReaderPlaceholder } from './EmptyStates.js';

// NEVER add allow-scripts here: with allow-same-origin it would let email HTML
// run script with access to the app. The body endpoint also sends its own CSP.
const FRAME_SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

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

function BodyFrame({ messageId, showImages, title }) {
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

function recipientsSummary(message, account) {
  const me = account ? account.email.toLowerCase() : '';
  const label = (e) => (e && e.address && e.address.toLowerCase() === me ? 'me' : (e && (e.name || e.address)) || '');
  const people = [...(message.to || []), ...(message.cc || [])].map(label).filter(Boolean);
  if (!people.length) return 'to undisclosed recipients';
  return `to ${people.length > 3 ? `${people.slice(0, 3).join(', ')} +${people.length - 3}` : people.join(', ')}`;
}

function AddressRow({ label, list }) {
  if (!list || !list.length) return null;
  return html`<div class="detail-row">
    <dt>${label}</dt>
    <dd>${list.map((e, i) => html`<span key=${i} class="addr">${formatAddress(e)}${i < list.length - 1 ? ', ' : ''}</span>`)}</dd>
  </div>`;
}

function Attachments({ messageId, attachments }) {
  const files = (attachments || []).filter((a) => !a.inline);
  if (!files.length) return null;
  return html`<section class="attachments" aria-label="Attachments">
    <h2 class="attachments-title"><${Icon} name="paperclip" size=${14} /> ${files.length === 1 ? '1 attachment' : `${files.length} attachments`}</h2>
    <ul class="attachment-list">
      ${files.map(
        (a) => html`<li key=${a.index}>
          <a class="attachment" href=${attachmentUrl(messageId, a.index)} download=${a.filename || 'attachment'} title=${`Download ${a.filename || 'attachment'}`}>
            <span class="attachment-icon"><${Icon} name=${String(a.contentType || '').startsWith('image/') ? 'image' : 'file'} size=${18} /></span>
            <span class="attachment-text">
              <span class="attachment-name">${a.filename || 'Untitled attachment'}</span>
              <span class="attachment-size">${formatBytes(a.size)}</span>
            </span>
            <span class="attachment-dl"><${Icon} name="download" size=${16} /></span>
          </a>
        </li>`
      )}
    </ul>
  </section>`;
}

function ReaderToolbar({ message }) {
  const id = message.id;
  return html`<div class="reader-toolbar" role="toolbar" aria-label="Message actions">
    <button type="button" class="icon-btn reader-back" onClick=${() => closeReader()} aria-label="Back to messages" title="Back (Esc)">
      <${Icon} name="arrowLeft" size=${18} />
    </button>
    <div class="toolbar-group">
      <button type="button" class="tool-btn" onClick=${() => moveMessages([id], 'archive')} title="Archive (e)" aria-label="Archive">
        <${Icon} name="archive" size=${17} /><span class="tool-label">Archive</span>
      </button>
      <button type="button" class="tool-btn" onClick=${() => moveMessages([id], 'trash')} title="Delete (#)" aria-label="Delete">
        <${Icon} name="trash" size=${17} /><span class="tool-label">Delete</span>
      </button>
      <button
        type="button"
        class="tool-btn"
        onClick=${() => toggleRead(id)}
        title=${message.isRead ? 'Mark unread (u)' : 'Mark read (u)'}
        aria-label=${message.isRead ? 'Mark unread' : 'Mark read'}
      >
        <${Icon} name=${message.isRead ? 'mail' : 'mailOpen'} size=${17} /><span class="tool-label">${message.isRead ? 'Mark unread' : 'Mark read'}</span>
      </button>
      <button
        type="button"
        class=${`tool-btn ${message.isStarred ? 'is-starred' : ''}`}
        onClick=${() => toggleStar(id)}
        aria-pressed=${message.isStarred ? 'true' : 'false'}
        aria-label="Star"
        title=${message.isStarred ? 'Unstar (s)' : 'Star (s)'}
      >
        <${Icon} name="star" size=${17} filled=${message.isStarred} /><span class="tool-label">${message.isStarred ? 'Starred' : 'Star'}</span>
      </button>
    </div>
    <button type="button" class="icon-btn reader-close" onClick=${() => closeReader()} aria-label="Close message" title="Close (Esc)">
      <${Icon} name="x" size=${18} />
    </button>
  </div>`;
}

export function Reader() {
  const s = useStore((st) => {
    const id = st.openId;
    return {
      openId: id,
      detail: id != null ? st.details[id] : null,
      item: id != null ? st.list.messages.find((m) => m.id === id) || null : null,
      accounts: st.accounts,
      presets: st.config.presets,
      showImages: id != null && !!st.showImages[id],
    };
  });
  const [showDetails, setShowDetails] = useState(false);
  const headingRef = useRef(null);

  // New message: collapse the recipient details and move focus/scroll to the top.
  useEffect(() => {
    setShowDetails(false);
    const scroller = headingRef.current && headingRef.current.closest('.reader-scroll');
    if (scroller) scroller.scrollTop = 0;
  }, [s.openId]);

  if (s.openId == null) return html`<${ReaderPlaceholder} />`;

  const detail = s.detail;
  if (detail && detail.status === 'error') {
    return html`<div class="reader-placeholder">
      <div class="empty-icon is-danger"><${Icon} name="alert" size=${22} /></div>
      <p class="empty-title">${detail.notFound ? 'This message is no longer available' : "Couldn't open this message"}</p>
      <p class="empty-text">${detail.notFound ? 'It may have been moved or deleted in another app.' : detail.error}</p>
      <div class="row-gap">
        ${detail.notFound ? null : html`<button type="button" class="btn" onClick=${() => retryDetail(s.openId)}>Try again</button>`}
        <button type="button" class="btn btn-ghost" onClick=${() => closeReader()}>Back to messages</button>
      </div>
    </div>`;
  }

  // While the detail loads, show what the list row already knows.
  const message = (detail && detail.message) || s.item;
  if (!message) {
    return html`<div class="reader-placeholder"><${Spinner} size=${22} label="Loading message" /></div>`;
  }
  const ready = !!(detail && detail.status === 'ready' && detail.message);
  const account = s.accounts.find((a) => a.id === message.accountId) || null;
  const from = { name: message.fromName, address: message.fromAddress };

  return html`<article class="reader" aria-labelledby="reader-subject">
    <${ReaderToolbar} message=${message} />
    <div class="reader-scroll">
      <header class="reader-header">
        <h1 id="reader-subject" class="reader-subject" ref=${headingRef} tabindex="-1">${message.subject || '(no subject)'}</h1>
        <div class="reader-from-row">
          <span class="avatar avatar-lg" aria-hidden="true">${initials(message.fromName, message.fromAddress)}</span>
          <div class="reader-from">
            <div class="reader-sender">
              <span class="reader-sender-name">${senderLabel(message)}</span>
              ${message.fromName && message.fromAddress ? html`<span class="reader-sender-addr">${`<${message.fromAddress}>`}</span>` : null}
            </div>
            ${ready
              ? html`<button type="button" class="reader-to-toggle" aria-expanded=${showDetails ? 'true' : 'false'} onClick=${() => setShowDetails((v) => !v)}>
                  <span>${recipientsSummary(message, account)}</span>
                  <${Icon} name="chevronDown" size=${14} className=${showDetails ? 'rot-180' : ''} />
                </button>`
              : html`<span class="muted small">Loading…</span>`}
          </div>
          <time class="reader-date" dateTime=${new Date(message.date).toISOString()}>${formatFullDate(message.date)}</time>
        </div>
        ${showDetails && ready
          ? html`<dl class="reader-details">
              <${AddressRow} label="From" list=${[from]} />
              <${AddressRow} label="To" list=${message.to} />
              <${AddressRow} label="Cc" list=${message.cc} />
              <${AddressRow} label="Reply-To" list=${message.replyTo} />
              <div class="detail-row"><dt>Date</dt><dd>${formatFullDate(message.date)}</dd></div>
            </dl>`
          : null}
        ${account
          ? html`<span class="account-badge" title=${`Received by ${account.email}`}>
              <${ColorDot} color=${account.color} />
              <span>${accountLabel(account, s.presets)}</span>
              <span class="account-badge-email">${account.email}</span>
            </span>`
          : null}
      </header>

      ${ready && message.bodyError
        ? html`<div class="banner banner-warning" role="status">
            <${Icon} name="alert" size=${16} />
            <span>We couldn't download the full message from the mail server: ${message.bodyError}</span>
            <button type="button" class="btn btn-sm" onClick=${() => retryDetail(message.id)}>Try again</button>
          </div>`
        : null}
      ${ready && message.remoteImageCount > 0 && !s.showImages
        ? html`<div class="banner banner-info">
            <${Icon} name="image" size=${16} />
            <span>Images are hidden to protect your privacy.</span>
            <button type="button" class="btn btn-sm" onClick=${() => showImagesFor(message.id)}>Show images</button>
          </div>`
        : null}

      <div class="reader-body">
        ${ready
          ? html`<${BodyFrame} key=${`${message.id}:${s.showImages ? 1 : 0}`} messageId=${message.id} showImages=${s.showImages} title=${message.subject || '(no subject)'} />`
          : html`<div class="body-skeleton" aria-hidden="true">
              <span class="sk sk-line sk-w90"></span><span class="sk sk-line sk-w70"></span><span class="sk sk-line sk-w80"></span>
              <span class="sk sk-line sk-w40"></span>
            </div>`}
      </div>

      ${ready ? html`<${Attachments} messageId=${message.id} attachments=${message.attachments} />` : null}
    </div>
  </article>`;
}
