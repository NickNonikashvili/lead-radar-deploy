// Conversation view in the reader: the other messages of the thread (same account, any
// folder, including your Sent replies) as collapsed cards around the opened message. A card
// expands into its own sandboxed body frame.
import { html, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { compose, expandThreadMessage, isDraftMessage, openMessage, showImagesFor } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { formatFullDate, formatListDate, initials, senderLabel } from '../format.js';
import { useNow } from '../hooks.js';
import { BodyFrame } from './BodyFrame.js';
import { Attachments, recipientsSummary } from './MessageParts.js';

const MAX_VISIBLE_BEFORE = 4; // longer histories collapse their middle behind "N more"

/** Was this sent by the user (from Sent, or from one of their own addresses)? */
export function isFromMe(m, accounts) {
  if (!m) return false;
  if (m.specialUse === '\\Sent') return true;
  const from = String(m.fromAddress || '').toLowerCase();
  return !!from && accounts.some((a) => String(a.email || '').toLowerCase() === from);
}

function CollapsedItem({ m, mine, now, onExpand }) {
  const draft = isDraftMessage(m);
  return html`<li class=${`thread-item is-collapsed ${m.isRead ? '' : 'is-unread'}`}>
    <button
      type="button"
      class="thread-summary"
      aria-expanded="false"
      onClick=${() => (draft ? openMessage(m.id) : onExpand(m.id))}
      title=${draft ? 'Open this draft in the composer' : 'Show this message'}
    >
      <span class=${`avatar ${mine ? 'avatar-me' : ''}`} aria-hidden="true">${initials(m.fromName, m.fromAddress)}</span>
      <span class="thread-from">${mine ? 'You' : senderLabel(m)}</span>
      ${draft ? html`<span class="msg-draft">Draft</span>` : null}
      <span class="thread-snippet">${m.snippet || ''}</span>
      <span class="thread-meta">
        ${m.hasAttachments ? html`<${Icon} name="paperclip" size=${13} label="Has attachments" />` : null}
        <time dateTime=${new Date(m.date).toISOString()}>${formatListDate(m.date, now)}</time>
      </span>
    </button>
  </li>`;
}

function ExpandedItem({ m, mine, onCollapse }) {
  const { detail, account, showImages, accounts } = useStore((s) => ({
    detail: s.details[m.id],
    account: s.accounts.find((a) => a.id === m.accountId) || null,
    showImages: !!s.showImages[m.id],
    accounts: s.accounts,
  }));
  const full = detail && detail.status === 'ready' ? detail.message : null;
  const message = full || m;
  return html`<li class="thread-item is-expanded">
    <button type="button" class="thread-summary is-header" aria-expanded="true" onClick=${() => onCollapse(m.id)} title="Collapse">
      <span class=${`avatar ${mine ? 'avatar-me' : ''}`} aria-hidden="true">${initials(m.fromName, m.fromAddress)}</span>
      <span class="thread-head-text">
        <span class="thread-from">${mine ? 'You' : senderLabel(m)}</span>
        <span class="thread-to">${full ? recipientsSummary(full, account, accounts) : ''}</span>
      </span>
      <time class="thread-date" dateTime=${new Date(m.date).toISOString()}>${formatFullDate(m.date)}</time>
    </button>
    <div class="thread-body">
      ${detail && detail.status === 'error'
        ? html`<p class="muted small">${detail.error}</p>`
        : !full
          ? html`<div class="thread-loading"><${Spinner} size=${16} label="Loading message" /></div>`
          : html`${full.remoteImageCount > 0 && !showImages
                ? html`<div class="banner banner-info">
                    <${Icon} name="image" size=${16} />
                    <span>Images are hidden to protect your privacy.</span>
                    <button type="button" class="btn btn-sm" onClick=${() => showImagesFor(m.id)}>Show images</button>
                  </div>`
                : null}
              <div class="reader-body">
                <${BodyFrame} key=${`${m.id}:${showImages ? 1 : 0}`} messageId=${m.id} showImages=${showImages} title=${message.subject || '(no subject)'} />
              </div>
              <${Attachments} messageId=${m.id} attachments=${full.attachments} />
              <div class="thread-actions">
                <button type="button" class="btn btn-sm" onClick=${() => compose('reply', m.id)}><${Icon} name="reply" size=${14} /> Reply</button>
                <button type="button" class="btn btn-sm" onClick=${() => compose('forward', m.id)}><${Icon} name="forward" size=${14} /> Forward</button>
              </div>`}
    </div>
  </li>`;
}

/**
 * `messages`: the thread, oldest first. `children` renders the opened message, which sits in
 * the conversation at its own position.
 */
export function Conversation({ openId, messages, children }) {
  const accounts = useStore((s) => s.accounts);
  const now = useNow();
  const [expanded, setExpanded] = useState(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const expand = (id) => {
    setExpanded((set) => new Set([...set, id]));
    expandThreadMessage(id);
  };
  const collapse = (id) => setExpanded((set) => new Set([...set].filter((x) => x !== id)));

  const openIndex = messages.findIndex((m) => m.id === openId);
  const before = openIndex >= 0 ? messages.slice(0, openIndex) : messages;
  const after = openIndex >= 0 ? messages.slice(openIndex + 1) : [];
  let hidden = 0;
  let shownBefore = before;
  if (!showAll && before.length > MAX_VISIBLE_BEFORE) {
    hidden = before.length - 3;
    shownBefore = [before[0], ...before.slice(-2)];
  }

  const item = (m) => {
    const mine = isFromMe(m, accounts);
    return expanded.has(m.id)
      ? html`<${ExpandedItem} key=${m.id} m=${m} mine=${mine} onCollapse=${collapse} />`
      : html`<${CollapsedItem} key=${m.id} m=${m} mine=${mine} now=${now} onExpand=${expand} />`;
  };

  return html`<ol class="thread" aria-label=${`Conversation, ${messages.length} messages`}>
    ${shownBefore.slice(0, hidden ? 1 : shownBefore.length).map(item)}
    ${hidden
      ? html`<li class="thread-more" key="more">
          <button type="button" class="thread-more-btn" onClick=${() => setShowAll(true)}>
            <span class="thread-more-count">${hidden}</span> more message${hidden === 1 ? '' : 's'}
          </button>
        </li>`
      : null}
    ${hidden ? shownBefore.slice(1).map(item) : null}
    <li class="thread-item is-open" key=${`open-${openId}`} aria-current="true">${children}</li>
    ${after.map(item)}
  </ol>`;
}
