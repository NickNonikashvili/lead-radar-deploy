// One account's folders in the sidebar: nested lists with expand/collapse buttons (disclosure
// pattern), unread counts, and a ⋯ menu per folder (sync, new subfolder, rename, empty, delete).
import { html, useMemo } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { openDialog, selectFolder, syncFolderNow, toggleCollapsed } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { Menu } from './Menu.js';
import { buildFolderTree, canEmptyFolder, folderBadge, folderIcon, folderLabel, folderPathLabel, isProtectedFolder, parentOptions } from './navModel.js';

function badgeText(n) {
  return n > 999 ? '999+' : String(n);
}

/** Menu entries for a folder (sidebar ⋯ and the folder view header). */
export function folderMenuItems(folder, folders) {
  if (!folder) return [];
  const canParent = parentOptions(folders, folder.accountId).some((f) => f.id === folder.id);
  const items = [];
  if (folder.selectable !== false) items.push({ id: 'sync', label: 'Check for new mail', icon: 'refresh', onSelect: () => syncFolderNow(folder.id) });
  if (canParent) items.push({ id: 'sub', label: 'New subfolder…', icon: 'folderPlus', onSelect: () => openDialog('folder', { mode: 'create', accountId: folder.accountId, parentId: folder.id }) });
  if (!isProtectedFolder(folder)) items.push({ id: 'rename', label: 'Rename…', icon: 'edit', onSelect: () => openDialog('folder', { mode: 'rename', folderId: folder.id }) });
  if (canEmptyFolder(folder)) {
    items.push({ separator: true });
    items.push({ id: 'empty', label: `Empty ${folderLabel(folder)}…`, icon: 'trash', danger: true, onSelect: () => openDialog('folder', { mode: 'empty', folderId: folder.id }) });
  }
  if (!isProtectedFolder(folder)) {
    items.push({ separator: true });
    items.push({ id: 'delete', label: 'Delete folder…', icon: 'trash', danger: true, onSelect: () => openDialog('folder', { mode: 'delete', folderId: folder.id }) });
  }
  return items;
}

function FolderNode({ node, depth, ctx }) {
  const f = node.folder;
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && !ctx.collapsed[`f:${f.id}`];
  const active = ctx.activeId === f.id;
  const count = folderBadge(f);
  const syncing = ctx.folderSync[`f${f.id}`] === 'syncing';
  const selectable = f.selectable !== false;
  const label = folderLabel(f);
  const onSelect = () => (selectable ? selectFolder(f.id) : toggleCollapsed(`f:${f.id}`));

  return html`<li class="folder-item">
    <div class=${`folder-row ${active ? 'is-active' : ''}`} style=${{ '--depth': depth }}>
      ${hasChildren
        ? html`<button
            type="button"
            class="folder-toggle"
            aria-expanded=${expanded ? 'true' : 'false'}
            aria-label=${`${expanded ? 'Collapse' : 'Expand'} ${label}`}
            onClick=${() => toggleCollapsed(`f:${f.id}`)}
          >
            <${Icon} name="chevronRight" size=${14} className=${expanded ? 'rot-90' : ''} />
          </button>`
        : html`<span class="folder-toggle-gap" aria-hidden="true"></span>`}
      <button
        type="button"
        class="folder-btn"
        aria-current=${active ? 'page' : undefined}
        title=${folderPathLabel(f) !== label ? folderPathLabel(f) : undefined}
        onClick=${onSelect}
      >
        <${Icon} name=${folderIcon(f)} size=${16} />
        <span class=${`folder-name ${count && f.specialUse !== '\\Drafts' ? 'has-unread' : ''}`}>${label}</span>
        ${syncing ? html`<${Spinner} size=${12} />` : null}
        ${count && !syncing
          ? html`<span class="nav-count"><span aria-hidden="true">${badgeText(count)}</span><span class="visually-hidden">, ${count} ${f.specialUse === '\\Drafts' ? 'drafts' : 'unread'}</span></span>`
          : null}
      </button>
      <${Menu} items=${folderMenuItems(f, ctx.folders)} label=${`Actions for ${label}`} buttonClass="icon-btn folder-more" iconSize=${15} />
    </div>
    ${expanded
      ? html`<ul class="folder-children" role="list">
          ${node.children.map((child) => html`<${FolderNode} key=${child.folder.id} node=${child} depth=${depth + 1} ctx=${ctx} />`)}
        </ul>`
      : null}
  </li>`;
}

export function FolderTree({ accountId }) {
  const { folders, collapsed, activeId, folderSync } = useStore((s) => ({
    folders: s.folders,
    collapsed: s.collapsed,
    activeId: s.view === 'folder' ? s.folderId : null,
    folderSync: s.folderSync,
  }));
  const own = useMemo(() => folders.filter((f) => f.accountId === accountId), [folders, accountId]);
  const tree = useMemo(() => buildFolderTree(own), [own]);
  const ctx = { collapsed, activeId, folderSync, folders };

  return html`<ul class="folder-tree" role="list">
    ${tree.map((node) => html`<${FolderNode} key=${node.folder.id} node=${node} depth=${0} ctx=${ctx} />`)}
    <li class="folder-item">
      <button type="button" class="folder-new" onClick=${() => openDialog('folder', { mode: 'create', accountId })}>
        <${Icon} name="plus" size=${14} /> New folder…
      </button>
    </li>
  </ul>`;
}
