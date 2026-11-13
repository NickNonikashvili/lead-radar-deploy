// Empty / zero states for the workspace.
import { html } from '/vendor/preact-htm.js';
import { compose, openDialog, setFilter, setQuery } from '../actions.js';
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

// Empty unified views and special folders: [icon, title, text].
const VIEW_EMPTY = {
  starred: ['star', 'No starred messages', 'Star a message to find it here quickly, whichever account it is in.'],
  sent: ['send', 'Nothing sent yet', 'Mail you send from any of your accounts shows up here.'],
  drafts: ['draft', 'No drafts', 'Messages you start writing are saved here automatically.'],
  junk: ['spam', 'No spam', 'Mail your providers flag as spam lands here.'],
  trash: ['trash', 'Trash is empty', 'Deleted mail stays here until your provider removes it.'],
};
const SPECIAL_VIEW = { '\\Sent': 'sent', '\\Drafts': 'drafts', '\\Junk': 'junk', '\\Trash': 'trash', '\\Flagged': 'starred' };

export function NoMessages({ query, filter, tabName, syncing, view = 'inbox', folder = null }) {
  if (query) {
    return html`<div class="empty-state">
      <div class="empty-icon"><${Icon} name="search" size=${22} /></div>
      <h3 class="empty-title">No messages match “${query}”</h3>
      <p class="empty-text">Search looks at senders, subjects and message text in ${tabName}.</p>
      <button type="button" class="btn" onClick=${() => setQuery('')}>Clear search</button>
    </div>`;
  }
  if (syncing) {
    const inbox = view === 'inbox';
    return html`<div class="empty-state">
      <div class="empty-icon"><${Spinner} size=${22} /></div>
      <h3 class="empty-title">${inbox ? 'Syncing your inbox…' : `Checking ${tabName} for mail…`}</h3>
      <p class="empty-text">${inbox ? 'The first sync can take a minute. New mail will appear here automatically.' : 'This takes a moment the first time a folder is opened.'}</p>
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
  const viewKey = folder ? SPECIAL_VIEW[folder.specialUse] : view;
  const preset = VIEW_EMPTY[viewKey];
  if (preset) {
    const [icon, title, text] = preset;
    return html`<div class="empty-state">
      <div class="empty-icon"><${Icon} name=${icon} size=${22} /></div>
      <h3 class="empty-title">${title}</h3>
      <p class="empty-text">${text}</p>
      ${viewKey === 'sent' || viewKey === 'drafts'
        ? html`<button type="button" class="btn" onClick=${() => compose('new')}><${Icon} name="pen" size=${15} /> Compose</button>`
        : null}
    </div>`;
  }
  if (folder) {
    return html`<div class="empty-state">
      <div class="empty-icon"><${Icon} name="folder" size=${22} /></div>
      <h3 class="empty-title">${folder.hasOlder ? 'No recent messages here' : 'This folder is empty'}</h3>
      <p class="empty-text">${folder.hasOlder ? 'The server has older mail in this folder.' : 'Move messages here with “Move to…” or the v key.'}</p>
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
