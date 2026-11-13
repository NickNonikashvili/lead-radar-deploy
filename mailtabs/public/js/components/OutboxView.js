// Outbox: messages queued (undo-send window or scheduled), being sent, or failed — with
// Edit (cancel and reopen in the composer), Retry and Delete.
import { html } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { accountLabel, cancelOutboxItem, closeDialog, deleteOutboxItem, openDialog, refreshOutbox, retryOutboxItem } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { formatFullDate, formatSendTime, shortAddressList } from '../format.js';
import { useNow } from '../hooks.js';
import { ColorDot } from './ui.js';

function recipients(to) {
  if (Array.isArray(to)) return shortAddressList(to, 3) || '(no recipients)';
  return typeof to === 'string' && to ? to : '(no recipients)';
}

function StatusPill({ item, now }) {
  if (item.status === 'failed') return html`<span class="pill pill-danger">Not sent</span>`;
  if (item.status === 'sending') return html`<span class="pill pill-accent"><${Spinner} size=${10} /> Sending…</span>`;
  const soon = item.sendAt - now < 60_000;
  return html`<span class=${`pill ${soon ? 'pill-accent' : 'pill-neutral'}`} title=${formatFullDate(item.sendAt)}>
    <${Icon} name="clock" size=${12} /> ${soon ? `Sending ${formatSendTime(item.sendAt, now)}` : `Scheduled ${formatSendTime(item.sendAt, now)}`}
  </span>`;
}

function confirmDelete(item) {
  if (item.status === 'failed') return deleteOutboxItem(item.id);
  openDialog('confirm', {
    title: 'Delete this message?',
    message: `“${item.subject || '(no subject)'}” won't be sent. To change it instead, use Edit.`,
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      closeDialog();
      await deleteOutboxItem(item.id);
    },
  });
}

export function OutboxView() {
  const { outbox, accounts, presets } = useStore((s) => ({ outbox: s.outbox, accounts: s.accounts, presets: s.config.presets }));
  const now = useNow(1000);
  // Failed first (they need attention), then the soonest to go out.
  const items = outbox.items.slice().sort((a, b) => (b.status === 'failed') - (a.status === 'failed') || a.sendAt - b.sendAt);

  let content;
  if (!outbox.loaded) {
    content = html`<div class="empty-state"><${Spinner} size=${22} label="Loading the outbox" /></div>`;
  } else if (outbox.error && !items.length) {
    content = html`<div class="empty-state">
      <div class="empty-icon is-danger"><${Icon} name="alert" size=${22} /></div>
      <h3 class="empty-title">Couldn't load the outbox</h3>
      <p class="empty-text">${outbox.error}</p>
      <button type="button" class="btn" onClick=${() => refreshOutbox({ quiet: false })}>Try again</button>
    </div>`;
  } else if (!items.length) {
    content = html`<div class="empty-state">
      <div class="empty-icon"><${Icon} name="outbox" size=${22} /></div>
      <h3 class="empty-title">Nothing waiting to be sent</h3>
      <p class="empty-text">Messages stay here during the undo-send delay, while they are scheduled, or if sending fails.</p>
    </div>`;
  } else {
    content = html`<ul class="outbox-list" aria-label="Outbox">
      ${items.map((item) => {
        const account = accounts.find((a) => a.id === item.accountId) || null;
        return html`<li key=${item.id} class=${`outbox-item is-${item.status}`}>
          <div class="outbox-main">
            <div class="outbox-top">
              <span class="outbox-to">To: ${recipients(item.to)}</span>
              <${StatusPill} item=${item} now=${now} />
            </div>
            <div class="outbox-subject">${item.subject || '(no subject)'}</div>
            <div class="outbox-meta">
              ${account ? html`<span class="outbox-from"><${ColorDot} color=${account.color} /> From ${accountLabel(account, presets)} · ${account.email}</span>` : null}
            </div>
            ${item.status === 'failed' && item.error ? html`<p class="outbox-error" role="note"><${Icon} name="alert" size=${14} /> ${item.error}</p>` : null}
          </div>
          <div class="outbox-actions">
            ${item.status === 'queued'
              ? html`<button type="button" class="btn btn-sm" onClick=${() => cancelOutboxItem(item.id)} title="Stop sending and open it in the composer">
                  <${Icon} name="edit" size=${14} /> Edit
                </button>`
              : null}
            ${item.status === 'failed'
              ? html`<button type="button" class="btn btn-sm" onClick=${() => retryOutboxItem(item.id)}><${Icon} name="refresh" size=${14} /> Retry</button>`
              : null}
            ${item.status !== 'sending'
              ? html`<button type="button" class="icon-btn" aria-label=${`Delete “${item.subject || 'message'}” from the outbox`} title="Delete" onClick=${() => confirmDelete(item)}>
                  <${Icon} name="trash" size=${16} />
                </button>`
              : null}
          </div>
        </li>`;
      })}
    </ul>
    <p class="outbox-note muted small">Mailtabs sends these from the server, so scheduled messages go out even when this page is closed.</p>`;
  }

  return html`<section class="outbox-pane" aria-label="Outbox">${content}</section>`;
}
