// Pieces of a message shown by the reader and by conversation items.
import { html } from '/vendor/preact-htm.js';
import { attachmentUrl } from '../api.js';
import { Icon } from '../icons.js';
import { formatAddress, formatBytes } from '../format.js';

/** "to me, Priya, Marcus +2" — any of the user's own addresses reads as "me". */
export function recipientsSummary(message, account, accounts = []) {
  const mine = new Set([account && account.email, ...accounts.map((a) => a.email)].filter(Boolean).map((e) => e.toLowerCase()));
  const label = (e) => (e && e.address && mine.has(e.address.toLowerCase()) ? 'me' : (e && (e.name || e.address)) || '');
  const people = [...(message.to || []), ...(message.cc || [])].map(label).filter(Boolean);
  if (!people.length) return 'to undisclosed recipients';
  return `to ${people.length > 3 ? `${people.slice(0, 3).join(', ')} +${people.length - 3}` : people.join(', ')}`;
}

export function AddressRow({ label, list }) {
  if (!list || !list.length) return null;
  return html`<div class="detail-row">
    <dt>${label}</dt>
    <dd>${list.map((e, i) => html`<span key=${i} class="addr">${formatAddress(e)}${i < list.length - 1 ? ', ' : ''}</span>`)}</dd>
  </div>`;
}

export function Attachments({ messageId, attachments }) {
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
