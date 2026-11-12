// The tab bar: "All inboxes" + the user's tabs (drag to reorder, ⋯ / double-click /
// long-press to edit) + "New tab".
import { html, useEffect, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { openDialog, reorderTabs, selectTab } from '../actions.js';
import { Icon } from '../icons.js';
import { ColorDot } from './ui.js';
import { useMediaQuery } from '../hooks.js';

const LONG_PRESS_MS = 550;

function badgeText(n) {
  return n > 999 ? '999+' : String(n);
}

function UnreadBadge({ count, active }) {
  if (!count) return null;
  return html`<span class=${`tab-badge ${active ? 'is-active' : ''}`}>
    <span aria-hidden="true">${badgeText(count)}</span>
    <span class="visually-hidden">, ${count} unread</span>
  </span>`;
}

function useLongPress(onLongPress) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);
  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    fired,
    handlers: {
      onPointerDown: (e) => {
        fired.current = false;
        if (e.pointerType !== 'touch') return;
        start.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = setTimeout(() => {
          fired.current = true;
          onLongPress();
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e) => {
        if (!timer.current || !start.current) return;
        if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      // Android Chrome fires contextmenu on long-press; treat it the same way.
      onContextMenu: (e) => {
        e.preventDefault();
        cancel();
        if (!fired.current) {
          fired.current = true;
          onLongPress();
        }
      },
    },
  };
}

function CustomTab({ tab, active, draggable, dragState, setDragState, order }) {
  const edit = () => openDialog('tabEditor', { tabId: tab.id });
  const { fired, handlers } = useLongPress(edit);
  const isDropTarget = dragState.overId === tab.id && dragState.dragId !== tab.id;

  const onClick = () => {
    if (fired.current) {
      fired.current = false; // the long-press already opened the editor
      return;
    }
    selectTab(tab.id);
  };

  const dnd = draggable
    ? {
        draggable: true,
        onDragStart: (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(tab.id));
          setDragState({ dragId: tab.id, overId: null, side: null });
        },
        onDragOver: (e) => {
          if (dragState.dragId == null || dragState.dragId === tab.id) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = e.currentTarget.getBoundingClientRect();
          const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
          if (dragState.overId !== tab.id || dragState.side !== side) setDragState({ ...dragState, overId: tab.id, side });
        },
        onDrop: (e) => {
          e.preventDefault();
          const dragId = dragState.dragId;
          setDragState({ dragId: null, overId: null, side: null });
          if (dragId == null || dragId === tab.id) return;
          const ids = order.filter((id) => id !== dragId);
          const at = ids.indexOf(tab.id) + (dragState.side === 'after' ? 1 : 0);
          ids.splice(at, 0, dragId);
          if (ids.join(',') !== order.join(',')) reorderTabs(ids);
        },
        onDragEnd: () => setDragState({ dragId: null, overId: null, side: null }),
      }
    : {};

  const cls = [
    'tab',
    active ? 'is-active' : '',
    dragState.dragId === tab.id ? 'is-dragging' : '',
    isDropTarget ? `is-drop-${dragState.side}` : '',
  ].join(' ');

  return html`<div class=${cls} data-tab-id=${tab.id} ...${dnd}>
    <button
      type="button"
      class="tab-btn"
      aria-current=${active ? 'page' : undefined}
      title=${draggable ? `${tab.name} — double-click to edit, drag to reorder` : tab.name}
      onClick=${onClick}
      onDblClick=${edit}
      ...${handlers}
    >
      <${ColorDot} color=${tab.color} />
      <span class="tab-name">${tab.name}</span>
      <${UnreadBadge} count=${tab.unreadCount} active=${active} />
    </button>
    <button type="button" class="tab-edit" aria-label=${`Edit tab ${tab.name}`} title="Edit tab" onClick=${edit}>
      <${Icon} name="more" size=${16} />
    </button>
  </div>`;
}

export function TabBar() {
  const { tabs, activeTabId, allUnread } = useStore((s) => ({
    tabs: s.tabs,
    activeTabId: s.activeTabId,
    allUnread: s.allCounts.unreadCount,
  }));
  const coarse = useMediaQuery('(pointer: coarse)');
  const [dragState, setDragState] = useState({ dragId: null, overId: null, side: null });
  const scrollRef = useRef(null);
  const order = tabs.map((t) => t.id);

  // Keep the active pill visible when it changes (narrow screens scroll).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector('.tab.is-active');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);

  const allActive = activeTabId === 'all';
  return html`<nav class="tabbar" aria-label="Tabs">
    <div class="tabbar-scroll" ref=${scrollRef}>
      <div class=${`tab tab-all ${allActive ? 'is-active' : ''}`}>
        <button type="button" class="tab-btn" aria-current=${allActive ? 'page' : undefined} onClick=${() => selectTab('all')}>
          <${Icon} name="inbox" size=${15} />
          <span class="tab-name">All inboxes</span>
          <${UnreadBadge} count=${allUnread} active=${allActive} />
        </button>
      </div>
      ${tabs.map(
        (t) => html`<${CustomTab}
          key=${t.id}
          tab=${t}
          active=${activeTabId === t.id}
          draggable=${!coarse}
          dragState=${dragState}
          setDragState=${setDragState}
          order=${order}
        />`
      )}
      <button type="button" class="tab-new" onClick=${() => openDialog('tabEditor', {})}>
        <${Icon} name="plus" size=${15} />
        <span>New tab</span>
      </button>
    </div>
  </nav>`;
}
