// Shown instead of the filter bar while messages are selected: actions for the whole selection.
import { html, useEffect, useRef } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import {
  clearSelection,
  deleteForever,
  deleteMessages,
  folderById,
  moveMessages,
  openMoveDialog,
  selectAllLoaded,
  setFlagsBulk,
  toggleSpam,
} from '../actions.js';
import { Icon } from '../icons.js';
import { SPECIAL, isInboxFolder } from './navModel.js';

/** "Select all on this page" checkbox (checked / mixed / empty). */
export function SelectAllBox({ selected, total }) {
  const ref = useRef(null);
  const all = total > 0 && selected >= total;
  const some = selected > 0 && !all;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return html`<label class="select-all" title=${all ? 'Clear selection' : 'Select all on this page'}>
    <input
      ref=${ref}
      type="checkbox"
      checked=${all}
      disabled=${!total}
      aria-label=${all || some ? 'Clear selection' : 'Select all messages on this page'}
      onChange=${() => (all || some ? clearSelection() : selectAllLoaded())}
    />
  </label>`;
}

function BulkButton({ icon, label, onClick, hint }) {
  return html`<button type="button" class="tool-btn bulk-btn" aria-label=${label} title=${hint ? `${label} (${hint})` : label} onClick=${onClick}>
    <${Icon} name=${icon} size=${17} />
  </button>`;
}

export function BulkBar() {
  const s = useStore((st) => {
    const set = new Set(st.selectedIds);
    return { ids: st.selectedIds, picked: st.list.messages.filter((m) => set.has(m.id)), total: st.list.messages.length, view: st.view };
  });
  const ids = s.picked.map((m) => m.id);
  const kinds = s.picked.map((m) => {
    const f = folderById(m.folderId);
    if (f) return f.specialUse || (isInboxFolder(f) ? SPECIAL.inbox : 'custom');
    return { junk: SPECIAL.junk, trash: SPECIAL.trash, inbox: SPECIAL.inbox }[s.view] || 'custom';
  });
  const every = (use) => kinds.length > 0 && kinds.every((k) => k === use);
  const allTrash = every(SPECIAL.trash);
  const allJunk = every(SPECIAL.junk);
  const allArchived = kinds.length > 0 && kinds.every((k) => k === SPECIAL.archive || k === SPECIAL.all);
  const anyUnread = s.picked.some((m) => !m.isRead);
  const allStarred = s.picked.length > 0 && s.picked.every((m) => m.isStarred);

  return html`<div class="list-toolbar bulkbar" role="toolbar" aria-label="Selected messages">
    <${SelectAllBox} selected=${ids.length} total=${s.total} />
    <span class="bulk-count" aria-live="polite">${ids.length}<span class="bulk-count-word"> selected</span></span>
    <div class="bulk-actions">
      ${allArchived ? null : html`<${BulkButton} icon="archive" label="Archive" hint="e" onClick=${() => moveMessages(ids, 'archive')} />`}
      ${allTrash || allArchived ? html`<${BulkButton} icon="inboxIn" label="Move to Inbox" onClick=${() => moveMessages(ids, 'inbox')} />` : null}
      ${allTrash
        ? html`<${BulkButton} icon="trash" label="Delete forever" hint="#" onClick=${() => deleteForever(ids)} />`
        : html`<${BulkButton} icon="trash" label="Delete" hint="#" onClick=${() => deleteMessages(ids)} />`}
      <${BulkButton} icon=${allJunk ? 'inboxIn' : 'spam'} label=${allJunk ? 'Not spam' : 'Report spam'} hint="!" onClick=${() => toggleSpam(ids)} />
      <${BulkButton} icon="folderMove" label="Move to…" hint="v" onClick=${() => openMoveDialog(ids)} />
      <${BulkButton} icon=${anyUnread ? 'mailOpen' : 'mail'} label=${anyUnread ? 'Mark read' : 'Mark unread'} hint="u" onClick=${() => setFlagsBulk(ids, anyUnread ? 'read' : 'unread')} />
      <${BulkButton} icon="star" label=${allStarred ? 'Remove star' : 'Star'} hint="s" onClick=${() => setFlagsBulk(ids, allStarred ? 'unstar' : 'star')} />
    </div>
    <button type="button" class="icon-btn bulk-clear" aria-label="Clear selection" title="Clear selection (Esc)" onClick=${() => clearSelection()}>
      <${Icon} name="x" size=${17} />
    </button>
  </div>`;
}
