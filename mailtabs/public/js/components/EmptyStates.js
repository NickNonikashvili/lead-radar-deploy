// Empty / zero states for the workspace.
import { html } from '/vendor/preact-htm.js';
import { openDialog, setFilter, setQuery } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { Kbd, ProviderMark } from './ui.js';
import { PROVIDER_UI } from '../constants.js';

const FIRST_PROVIDERS = ['gmail', 'outlook', 'yahoo', 'icloud', 'imap'];

export function NoAccounts() {
  return html`<section class="empty-hero" aria-labelledby="empty-hero-title">
    <div class="empty-hero-card">
      <div class="empty-hero-icon"><${Icon} name="mailPlus" size=${28} /></div>
      <h2 id="empty-hero-title" class="empty-hero-title">Connect your first email account</h2>
      <p class="empty-hero-text">
        Mailtabs pulls the inboxes of all your accounts into one place. Add an account, then make tabs like
        “Work” or “Personal” and choose which accounts appear in each.
      </p>
      <div class="provider-quick">
        ${FIRST_PROVIDERS.map(
          (key) => html`<button key=${key} type="button" class="provider-quick-btn" onClick=${() => openDialog('addAccount', { provider: key })}>
            <${ProviderMark} provider=${key} size=${28} />
            <span>${key === 'outlook' ? 'Outlook' : PROVIDER_UI[key].label}</span>
          </button>`
        )}
      </div>
      <button type="button" class="link-btn" onClick=${() => openDialog('addAccount')}>See all providers</button>
    </div>
  </section>`;
}

export function EmptyTab({ tab }) {
  return html`<div class="empty-state">
    <div class="empty-icon"><${Icon} name="link" size=${22} /></div>
    <h3 class="empty-title">This tab has no accounts yet</h3>
    <p class="empty-text">Choose which accounts' mail should appear in “${tab.name}”.</p>
    <button type="button" class="btn btn-primary" onClick=${() => openDialog('tabEditor', { tabId: tab.id })}>
      <${Icon} name="edit" size=${15} /> Edit tab
    </button>
  </div>`;
}

export function NoMessages({ query, filter, tabName, syncing }) {
  if (query) {
    return html`<div class="empty-state">
      <div class="empty-icon"><${Icon} name="search" size=${22} /></div>
      <h3 class="empty-title">No messages match “${query}”</h3>
      <p class="empty-text">Search looks at senders, subjects and message text in ${tabName}.</p>
      <button type="button" class="btn" onClick=${() => setQuery('')}>Clear search</button>
    </div>`;
  }
  if (syncing) {
    return html`<div class="empty-state">
      <div class="empty-icon"><${Spinner} size=${22} /></div>
      <h3 class="empty-title">Syncing your inbox…</h3>
      <p class="empty-text">The first sync can take a minute. New mail will appear here automatically.</p>
    </div>`;
  }
  if (filter === 'unread' || filter === 'starred') {
    return html`<div class="empty-state">
      <div class="empty-icon"><${Icon} name=${filter === 'unread' ? 'checkAll' : 'star'} size=${22} /></div>
      <h3 class="empty-title">${filter === 'unread' ? 'No unread mail' : 'No starred messages'}</h3>
      <p class="empty-text">${filter === 'unread' ? `You've read everything in ${tabName}.` : 'Star a message to find it here quickly.'}</p>
      <button type="button" class="btn" onClick=${() => setFilter('all')}>Show all mail</button>
    </div>`;
  }
  return html`<div class="empty-state">
    <div class="empty-icon"><${Icon} name="check" size=${22} /></div>
    <h3 class="empty-title">You're all caught up</h3>
    <p class="empty-text">There's no mail in ${tabName} right now.</p>
  </div>`;
}

export function ReaderPlaceholder() {
  return html`<div class="reader-placeholder">
    <div class="empty-icon"><${Icon} name="mailOpen" size=${24} /></div>
    <p class="empty-title">Select a message to read it</p>
    <p class="empty-text">Move with <${Kbd}>j</${Kbd}> and <${Kbd}>k</${Kbd}>, open with <${Kbd}>Enter</${Kbd}>.</p>
  </div>`;
}
