// Header of a folder or unified view (shown instead of the tab bar), and the
// "Load older messages" footer of a folder list.
import { html } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { accountLabel, closeDialog, emptyFolders, loadOlder, openDialog, refreshView, viewTitle } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { UNIFIED_VIEWS } from '../constants.js';
import { plural } from '../format.js';
import { ColorDot } from './ui.js';
import { Menu } from './Menu.js';
import { folderMenuItems } from './FolderTree.js';
import { canEmptyFolder, folderIcon, folderLabel, folderPathLabel } from './navModel.js';

function confirmEmptyAll(def, targets) {
  const count = targets.reduce((n, f) => n + (f.totalCount || 0), 0);
  openDialog('confirm', {
    title: `Empty ${def.label} in every account?`,
    message: `${count ? `${plural(count, 'message')} will be` : 'Everything here will be'} deleted from the mail servers forever. This can't be undone.`,
    confirmLabel: `Empty ${def.label}`,
    danger: true,
    onConfirm: async () => {
      closeDialog();
      await emptyFolders(targets.map((f) => f.id));
    },
  });
}

export function ViewHeader() {
  const s = useStore((st) => ({
    view: st.view,
    folderId: st.folderId,
    folders: st.folders,
    accounts: st.accounts,
    presets: st.config.presets,
    folderSync: st.folderSync,
    outboxCount: st.outbox.items.length,
    title: viewTitle(st),
  }));
  const folder = s.view === 'folder' ? s.folders.find((f) => f.id === s.folderId) || null : null;
  const def = UNIFIED_VIEWS.find((v) => v.id === s.view) || null;
  const syncing = s.folderSync[s.view === 'folder' ? `f${s.folderId}` : s.view] === 'syncing';
  const account = folder ? s.accounts.find((a) => a.id === folder.accountId) || null : null;

  let sub = null;
  if (folder && account) {
    const path = folderPathLabel(folder);
    sub = html`<span class="viewbar-sub">
      <${ColorDot} color=${account.color} />
      <span class="viewbar-account">${account.displayName || accountLabel(account, s.presets)}</span>
      <span class="viewbar-email">${account.email}</span>
      ${path !== folderLabel(folder) ? html`<span class="viewbar-path" aria-hidden="true">· ${path}</span>` : null}
    </span>`;
  } else if (s.view === 'outbox') {
    sub = html`<span class="viewbar-sub">Messages waiting to be sent, from every account</span>`;
  } else if (def) {
    sub = html`<span class="viewbar-sub">All accounts</span>`;
  }

  const emptyTargets = def && (def.id === 'trash' || def.id === 'junk') ? s.folders.filter((f) => f.specialUse === def.specialUse) : [];
  return html`<div class="viewbar">
    <span class="viewbar-icon" aria-hidden="true"><${Icon} name=${folder ? folderIcon(folder) : def ? def.icon : 'folder'} size=${18} /></span>
    <div class="viewbar-titles">
      <h1 class="viewbar-title">${s.title}</h1>
      ${sub}
    </div>
    ${syncing ? html`<span class="viewbar-status" role="status"><${Spinner} size=${14} /><span class="hide-xs">Checking for new mail…</span></span>` : null}
    <span class="spacer"></span>
    ${folder && canEmptyFolder(folder)
      ? html`<button type="button" class="btn btn-ghost btn-sm btn-danger-text" onClick=${() => openDialog('folder', { mode: 'empty', folderId: folder.id })}>
          <${Icon} name="trash" size=${14} /><span>Empty ${folderLabel(folder)}</span>
        </button>`
      : null}
    ${emptyTargets.length
      ? html`<button type="button" class="btn btn-ghost btn-sm btn-danger-text" onClick=${() => confirmEmptyAll(def, emptyTargets)}>
          <${Icon} name="trash" size=${14} /><span>Empty ${def.label}</span>
        </button>`
      : null}
    <button
      type="button"
      class=${`icon-btn ${syncing ? 'is-busy' : ''}`}
      aria-label=${s.view === 'outbox' ? 'Refresh the outbox' : 'Check for new mail here'}
      title=${s.view === 'outbox' ? 'Refresh' : 'Check for new mail'}
      disabled=${syncing}
      onClick=${() => refreshView()}
    >
      <${Icon} name="refresh" size=${17} className=${syncing ? 'spin' : ''} />
    </button>
    ${folder ? html`<${Menu} items=${folderMenuItems(folder, s.folders)} label=${`Actions for ${folderLabel(folder)}`} buttonClass="icon-btn" iconSize=${17} />` : null}
  </div>`;
}

/** End of a folder list: offer to fetch older mail from the server when it has more. */
export function LoadOlder() {
  const { folder, backfill } = useStore((st) => ({
    folder: st.view === 'folder' ? st.folders.find((f) => f.id === st.folderId) || null : null,
    backfill: st.backfill,
  }));
  if (!folder || !folder.hasOlder) return null;
  const loading = backfill.status === 'loading' && backfill.folderId === folder.id;
  const error = backfill.status === 'error' && backfill.folderId === folder.id ? backfill.error : '';
  return html`<div class="load-older">
    ${error ? html`<span class="small load-older-error" role="alert">${error}</span>` : null}
    <button type="button" class="btn btn-sm" onClick=${() => loadOlder()} disabled=${loading}>
      ${loading ? html`<${Spinner} size=${13} /> Loading older messages…` : html`<${Icon} name="download" size=${14} /> Load older messages`}
    </button>
    <span class="muted small">Mailtabs keeps the most recent mail of each folder; older messages stay on the server until you ask.</span>
  </div>`;
}
