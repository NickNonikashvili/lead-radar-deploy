// Reading pane: toolbar (reply, archive, delete, spam, move, read, star, more), the message
// (header, privacy banner, sandboxed body, attachments, reply bar) and the rest of its
// conversation around it.
import { html, useEffect, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import {
  accountLabel,
  closeReader,
  compose,
  deleteForever,
  deleteMessages,
  folderOfMessage,
  moveMessages,
  openMoveDialog,
  retryDetail,
  setConversationView,
  showImagesFor,
  toggleRead,
  toggleSpam,
  toggleStar,
} from '../actions.js';
import { rawUrl } from '../api.js';
import { Icon, Spinner } from '../icons.js';
import { formatFullDate, initials, senderLabel } from '../format.js';
import { MOBILE_QUERY } from '../constants.js';
import { useMediaQuery } from '../hooks.js';
import { ColorDot } from './ui.js';
import { ReaderPlaceholder } from './EmptyStates.js';
import { BodyFrame, printMessage } from './BodyFrame.js';
import { Conversation, isFromMe } from './Conversation.js';
import { AddressRow, Attachments, recipientsSummary } from './MessageParts.js';
import { Menu } from './Menu.js';
import { SPECIAL, folderIcon, folderLabel, isInboxFolder } from './navModel.js';

function downloadOriginal(id) {
  const a = document.createElement('a');
  a.href = rawUrl(id);
  a.setAttribute('download', '');
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function ToolButton({ icon, label, hint, onClick, className = '', pressed, filled }) {
  return html`<button
    type="button"
    class=${`tool-btn ${className}`}
    onClick=${onClick}
    title=${hint ? `${label} (${hint})` : label}
    aria-label=${label}
    aria-pressed=${pressed === undefined ? undefined : pressed ? 'true' : 'false'}
  >
    <${Icon} name=${icon} size=${17} filled=${filled} />
  </button>`;
}

function ReaderToolbar({ message, folder, showImages, conversationView }) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const id = message.id;
  const use = folder ? folder.specialUse : null;
  const inTrash = use === SPECIAL.trash;
  const inJunk = use === SPECIAL.junk;
  const archived = use === SPECIAL.archive || use === SPECIAL.all;
  const inInbox = folder ? isInboxFolder(folder) : true;
  const sent = use === SPECIAL.sent;

  const more = [
    // On phones the reply buttons live in this menu (and at the end of the message).
    { id: 'reply', label: 'Reply', icon: 'reply', hint: 'r', onSelect: () => compose('reply', id), mobileOnly: true },
    { id: 'replyAll', label: 'Reply all', icon: 'replyAll', hint: 'a', onSelect: () => compose('replyAll', id), mobileOnly: true },
    { id: 'forward', label: 'Forward', icon: 'forward', hint: 'f', onSelect: () => compose('forward', id), mobileOnly: true },
    { id: 'move', label: 'Move to…', icon: 'folderMove', hint: 'v', onSelect: () => openMoveDialog([id]), mobileOnly: true },
    { id: 'spam', label: inJunk ? 'Not spam' : 'Report spam', icon: inJunk ? 'inboxIn' : 'spam', hint: '!', onSelect: () => toggleSpam([id]), mobileOnly: true },
    { separator: true, mobileOnly: true },
    !inInbox && !inJunk ? { id: 'inbox', label: 'Move to Inbox', icon: 'inboxIn', onSelect: () => moveMessages([id], 'inbox') } : null,
    inJunk ? { id: 'forever', label: 'Delete forever', icon: 'trash', danger: true, onSelect: () => deleteForever([id]) } : null,
    { id: 'print', label: 'Print', icon: 'printer', onSelect: () => printMessage(id, showImages, { preferTab: mobile }) },
    { id: 'raw', label: 'Download original (.eml)', icon: 'code', onSelect: () => downloadOriginal(id) },
    { separator: true },
    {
      id: 'conversation',
      label: conversationView ? 'Show this message only' : 'Show conversation',
      icon: 'messages',
      onSelect: () => setConversationView(!conversationView),
    },
  ];
  const items = more.filter((item) => item && (!item.mobileOnly || mobile));

  return html`<div class="reader-toolbar" role="toolbar" aria-label="Message actions">
    <button type="button" class="icon-btn reader-back" onClick=${() => closeReader()} aria-label="Back to messages" title="Back (Esc)">
      <${Icon} name="arrowLeft" size=${18} />
    </button>
    <div class="toolbar-group tool-wide">
      <${ToolButton} icon="reply" label="Reply" hint="r" onClick=${() => compose('reply', id)} />
      <${ToolButton} icon="replyAll" label="Reply all" hint="a" onClick=${() => compose('replyAll', id)} />
      <${ToolButton} icon="forward" label="Forward" hint="f" onClick=${() => compose('forward', id)} />
    </div>
    <span class="toolbar-sep tool-wide" aria-hidden="true"></span>
    <div class="toolbar-group">
      ${archived || sent ? null : html`<${ToolButton} icon="archive" label="Archive" hint="e" onClick=${() => moveMessages([id], 'archive')} />`}
      ${inTrash
        ? html`<${ToolButton} icon="trash" label="Delete forever" hint="#" onClick=${() => deleteForever([id])} />`
        : html`<${ToolButton} icon="trash" label="Delete" hint="#" onClick=${() => deleteMessages([id])} />`}
      <${ToolButton} className="tool-wide" icon=${inJunk ? 'inboxIn' : 'spam'} label=${inJunk ? 'Not spam' : 'Report spam'} hint="!" onClick=${() => toggleSpam([id])} />
      <${ToolButton} className="tool-wide" icon="folderMove" label="Move to…" hint="v" onClick=${() => openMoveDialog([id])} />
    </div>
    <span class="toolbar-sep tool-wide" aria-hidden="true"></span>
    <div class="toolbar-group">
      <${ToolButton}
        icon=${message.isRead ? 'mail' : 'mailOpen'}
        label=${message.isRead ? 'Mark unread' : 'Mark read'}
        hint="u"
        onClick=${() => toggleRead(id)}
      />
      <${ToolButton}
        className=${message.isStarred ? 'is-starred' : ''}
        icon="star"
        label="Star"
        hint="s"
        pressed=${!!message.isStarred}
        filled=${message.isStarred}
        onClick=${() => toggleStar(id)}
      />
      <${Menu} items=${items} label="More actions" buttonClass="tool-btn" iconSize=${17} />
    </div>
    <button type="button" class="icon-btn reader-close" onClick=${() => closeReader()} aria-label="Close message" title="Close (Esc)">
      <${Icon} name="x" size=${18} />
    </button>
  </div>`;
}

/** The opened message: sender, recipients, banners, body, attachments, reply buttons. */
function OpenedMessage({ message, detail, account, accounts, presets, folder, showImages, mine }) {
  const [showDetails, setShowDetails] = useState(false);
  const ready = !!(detail && detail.status === 'ready' && detail.message);
  const from = { name: message.fromName, address: message.fromAddress };
  const inJunk = folder && folder.specialUse === SPECIAL.junk;

  useEffect(() => setShowDetails(false), [message.id]);

  return html`<div class="opened">
    <div class="reader-from-row">
      <span class=${`avatar avatar-lg ${mine ? 'avatar-me' : ''}`} aria-hidden="true">${initials(message.fromName, message.fromAddress)}</span>
      <div class="reader-from">
        <div class="reader-sender">
          <span class="reader-sender-name">${mine ? `You (${senderLabel(message)})` : senderLabel(message)}</span>
          ${message.fromName && message.fromAddress ? html`<span class="reader-sender-addr">${`<${message.fromAddress}>`}</span>` : null}
        </div>
        ${ready
          ? html`<button type="button" class="reader-to-toggle" aria-expanded=${showDetails ? 'true' : 'false'} onClick=${() => setShowDetails((v) => !v)}>
              <span>${recipientsSummary(message, account, accounts)}</span>
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
    <div class="reader-badges">
      ${account
        ? html`<span class="account-badge" title=${`Received by ${account.email}`}>
            <${ColorDot} color=${account.color} />
            <span>${accountLabel(account, presets)}</span>
            <span class="account-badge-email">${account.email}</span>
          </span>`
        : null}
      ${folder && !isInboxFolder(folder)
        ? html`<span class="account-badge folder-badge" title=${`In ${folder.path}`}>
            <${Icon} name=${folderIcon(folder)} size=${13} />
            <span>${folderLabel(folder)}</span>
          </span>`
        : null}
    </div>

    ${inJunk
      ? html`<div class="banner banner-warning" role="status">
          <${Icon} name="spam" size=${16} />
          <span>This message is in Spam. Links and images in it may be unsafe.</span>
          <button type="button" class="btn btn-sm" onClick=${() => toggleSpam([message.id])}>Not spam</button>
        </div>`
      : null}
    ${ready && message.bodyError
      ? html`<div class="banner banner-warning" role="status">
          <${Icon} name="alert" size=${16} />
          <span>We couldn't download the full message from the mail server: ${message.bodyError}</span>
          <button type="button" class="btn btn-sm" onClick=${() => retryDetail(message.id)}>Try again</button>
        </div>`
      : null}
    ${ready && message.remoteImageCount > 0 && !showImages
      ? html`<div class="banner banner-info">
          <${Icon} name="image" size=${16} />
          <span>Images are hidden to protect your privacy.</span>
          <button type="button" class="btn btn-sm" onClick=${() => showImagesFor(message.id)}>Show images</button>
        </div>`
      : null}

    <div class="reader-body">
      ${ready
        ? html`<${BodyFrame} key=${`${message.id}:${showImages ? 1 : 0}`} messageId=${message.id} showImages=${showImages} title=${message.subject || '(no subject)'} />`
        : html`<div class="body-skeleton" aria-hidden="true">
            <span class="sk sk-line sk-w90"></span><span class="sk sk-line sk-w70"></span><span class="sk sk-line sk-w80"></span>
            <span class="sk sk-line sk-w40"></span>
          </div>`}
    </div>

    ${ready ? html`<${Attachments} messageId=${message.id} attachments=${message.attachments} />` : null}
    ${ready
      ? html`<div class="reply-bar">
          <button type="button" class="btn" onClick=${() => compose('reply', message.id)}><${Icon} name="reply" size=${15} /> Reply</button>
          <button type="button" class="btn" onClick=${() => compose('replyAll', message.id)}><${Icon} name="replyAll" size=${15} /> Reply all</button>
          <button type="button" class="btn" onClick=${() => compose('forward', message.id)}><${Icon} name="forward" size=${15} /> Forward</button>
        </div>`
      : null}
  </div>`;
}

export function Reader() {
  const s = useStore((st) => {
    const id = st.openId;
    return {
      openId: id,
      detail: id != null ? st.details[id] : null,
      thread: id != null ? st.threads[id] : null,
      item: id != null ? st.list.messages.find((m) => m.id === id) || null : null,
      accounts: st.accounts,
      folders: st.folders,
      presets: st.config.presets,
      showImages: id != null && !!st.showImages[id],
      conversationView: st.conversationView,
    };
  });
  const headingRef = useRef(null);

  // New message: move scroll to the top.
  useEffect(() => {
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
  const account = s.accounts.find((a) => a.id === message.accountId) || null;
  const folder = folderOfMessage(message);
  const thread = s.thread && s.thread.status !== 'error' && Array.isArray(s.thread.messages) ? s.thread.messages : null;
  const inConversation = s.conversationView && thread && thread.length > 1 && thread.some((m) => m.id === message.id);
  const opened = html`<${OpenedMessage}
    message=${message}
    detail=${detail}
    account=${account}
    accounts=${s.accounts}
    presets=${s.presets}
    folder=${folder}
    showImages=${s.showImages}
    mine=${isFromMe({ ...message, specialUse: folder ? folder.specialUse : null }, s.accounts)}
  />`;

  return html`<article class="reader" aria-labelledby="reader-subject">
    <${ReaderToolbar} message=${message} folder=${folder} showImages=${s.showImages} conversationView=${s.conversationView} />
    <div class="reader-scroll">
      <header class="reader-header">
        <h1 id="reader-subject" class="reader-subject" ref=${headingRef} tabindex="-1">${message.subject || '(no subject)'}</h1>
        ${inConversation ? html`<span class="thread-count">${thread.length} messages</span>` : null}
      </header>
      ${inConversation
        ? html`<${Conversation} key=${message.id} openId=${message.id} messages=${thread}>${opened}</${Conversation}>`
        : opened}
    </div>
  </article>`;
}
