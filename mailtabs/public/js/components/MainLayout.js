// Signed-in layout: header; sidebar (or drawer); the tab bar (Inbox) or a view header;
// warnings; list + reading pane (or the outbox); dialogs; the composer windows.
import { html, useEffect, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { accountLabel, openDialog, reconnectAccount } from '../actions.js';
import { Icon } from '../icons.js';
import { useGlobalShortcuts } from '../keyboard.js';
import { ComposerHost } from '../compose/ComposerHost.js';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';
import { TabBar } from './TabBar.js';
import { ViewHeader } from './FolderView.js';
import { BulkBar } from './BulkBar.js';
import { ComposeFab, FilterBar, MessageList } from './MessageList.js';
import { Reader } from './Reader.js';
import { OutboxView } from './OutboxView.js';
import { NoAccounts } from './EmptyStates.js';
import { AddAccountDialog } from './AddAccountDialog.js';
import { TabEditorDialog } from './TabEditorDialog.js';
import { SettingsDialog } from './SettingsDialog.js';
import { MoveDialog } from './MoveDialog.js';
import { FolderDialog } from './FolderDialog.js';
import { ConfirmDialog } from './ConfirmDialog.js';

function AccountAlerts() {
  const { accounts, presets } = useStore((s) => ({ accounts: s.accounts, presets: s.config.presets }));
  const [dismissed, setDismissed] = useState(() => new Set());
  const needReconnect = accounts.filter((a) => a.status === 'auth_error');
  // Other failures (server unreachable, timeouts...) keep retrying on their own, but the user
  // should still know that this inbox isn't being updated.
  const failing = accounts.filter((a) => a.status === 'error' && !dismissed.has(`${a.id}:${a.lastError}`));
  if (!needReconnect.length && !failing.length) return null;
  return html`<div class="alerts">
    ${needReconnect.map(
      (a) => html`<div key=${a.id} class="alert-bar" role="status">
        <${Icon} name="alert" size=${16} />
        <span class="alert-text"><strong>${accountLabel(a, presets)} (${a.email})</strong> needs to be reconnected.</span>
        <button type="button" class="btn btn-sm" onClick=${() => reconnectAccount(a)}>Reconnect</button>
      </div>`
    )}
    ${failing.map(
      (a) => html`<div key=${`e${a.id}`} class="alert-bar" role="status">
        <${Icon} name="alert" size=${16} />
        <span class="alert-text"><strong>${accountLabel(a, presets)} (${a.email})</strong> isn't updating: ${a.lastError || 'the last check failed.'}</span>
        <button type="button" class="btn btn-sm" onClick=${() => openDialog('settings', { section: 'accounts' })}>Settings</button>
        <button
          type="button"
          class="icon-btn"
          aria-label="Dismiss"
          title="Dismiss"
          onClick=${() => setDismissed((d) => new Set([...d, `${a.id}:${a.lastError}`]))}
        >
          <${Icon} name="x" size=${16} />
        </button>
      </div>`
    )}
  </div>`;
}

function Dialogs() {
  const dialog = useStore((s) => s.dialog);
  if (!dialog) return null;
  const props = dialog.props || {};
  // `key` remounts the dialog when switching between dialogs or targets.
  if (dialog.type === 'addAccount') return html`<${AddAccountDialog} key=${`add-${props.provider || ''}`} ...${props} />`;
  if (dialog.type === 'tabEditor') return html`<${TabEditorDialog} key=${`tab-${props.tabId || 'new'}`} ...${props} />`;
  if (dialog.type === 'settings') return html`<${SettingsDialog} key="settings" ...${props} />`;
  if (dialog.type === 'move') return html`<${MoveDialog} key=${`move-${(props.ids || []).join(',')}`} ...${props} />`;
  if (dialog.type === 'folder') return html`<${FolderDialog} key=${`folder-${props.mode}-${props.folderId || props.accountId}`} ...${props} />`;
  if (dialog.type === 'confirm') return html`<${ConfirmDialog} key=${`confirm-${props.title}`} ...${props} />`;
  return null;
}

export function MainLayout() {
  const { noAccounts, readerOpen, unread, view, selecting } = useStore((s) => ({
    noAccounts: s.accountsLoaded && s.accounts.length === 0,
    readerOpen: s.openId != null,
    unread: s.allCounts.unreadCount,
    view: s.view,
    selecting: s.selectedIds.length > 0,
  }));
  useGlobalShortcuts();

  // Unread count in the browser tab title.
  useEffect(() => {
    document.title = unread > 0 ? `(${unread > 999 ? '999+' : unread}) Mailtabs` : 'Mailtabs';
    return () => {
      document.title = 'Mailtabs';
    };
  }, [unread]);

  let main;
  if (noAccounts) {
    main = html`<main class="workspace workspace-empty"><${NoAccounts} /></main>`;
  } else if (view === 'outbox') {
    main = html`<main class="workspace workspace-single">
      <${OutboxView} />
      <${ComposeFab} />
    </main>`;
  } else {
    main = html`<main class=${`workspace ${readerOpen ? 'reader-open' : ''}`}>
      <section class="list-pane" aria-label="Message list">
        ${selecting ? html`<${BulkBar} />` : html`<${FilterBar} />`}
        <${MessageList} />
        <${ComposeFab} />
      </section>
      <section class="reader-pane" aria-label="Reading pane">
        <${Reader} />
      </section>
    </main>`;
  }

  return html`<div class=${`app ${noAccounts ? 'no-accounts' : ''}`}>
    <${Header} />
    <div class="app-body">
      ${noAccounts ? null : html`<${Sidebar} />`}
      <div class="app-main">
        ${noAccounts ? null : view === 'inbox' ? html`<${TabBar} />` : html`<${ViewHeader} />`}
        <${AccountAlerts} />
        ${main}
      </div>
    </div>
    <${Dialogs} />
    <${ComposerHost} />
  </div>`;
}
