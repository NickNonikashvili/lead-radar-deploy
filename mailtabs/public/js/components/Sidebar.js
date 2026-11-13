// Left navigation: Compose, Inbox (the tabs), unified views across accounts, and each
// account's folder tree. Desktop (>= 1024 px): always on screen, or an icon rail when
// collapsed. Smaller screens: a modal drawer opened from the header's menu button.
import { html, useEffect, useRef } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { accountLabel, closeDrawer, compose, openDialog, selectView, syncAccount, toggleCollapsed } from '../actions.js';
import { Icon, Logo } from '../icons.js';
import { DESKTOP_QUERY, UNIFIED_VIEWS } from '../constants.js';
import { useMediaQuery } from '../hooks.js';
import { ColorDot } from './ui.js';
import { FolderTree } from './FolderTree.js';
import { Menu } from './Menu.js';
import { isInboxFolder } from './navModel.js';

function badgeText(n) {
  return n > 999 ? '999+' : String(n);
}

/** Counts for the top navigation (Inbox unread, Drafts total, Spam unread, Outbox waiting). */
function useNavCounts() {
  return useStore((s) => {
    let drafts = 0;
    let junk = 0;
    for (const f of s.folders) {
      if (f.specialUse === '\\Drafts') drafts += f.totalCount || 0;
      else if (f.specialUse === '\\Junk') junk += f.unreadCount || 0;
    }
    const waiting = s.outbox.items.filter((o) => o.status === 'queued' || o.status === 'sending' || o.status === 'failed');
    return {
      inbox: s.allCounts.unreadCount,
      drafts,
      junk,
      outbox: waiting.length,
      outboxFailed: waiting.some((o) => o.status === 'failed'),
      view: s.view,
    };
  });
}

const COUNT_WORDS = { inbox: 'unread', drafts: 'drafts', junk: 'unread', outbox: 'waiting to send' };

function navItems(counts) {
  return [
    { id: 'inbox', label: 'Inbox', icon: 'inbox', count: counts.inbox },
    ...UNIFIED_VIEWS.map((v) => ({ id: v.id, label: v.label, icon: v.icon, count: counts[v.id] || 0, alert: v.id === 'outbox' && counts.outboxFailed })),
  ];
}

function NavList({ counts }) {
  return html`<ul class="nav-list" role="list">
    ${navItems(counts).map((item) => {
      const active = counts.view === item.id;
      return html`<li key=${item.id}>
        <button
          type="button"
          class=${`nav-item ${active ? 'is-active' : ''}`}
          aria-current=${active ? 'page' : undefined}
          data-view=${item.id}
          onClick=${() => selectView(item.id)}
        >
          <${Icon} name=${item.icon} size=${17} />
          <span class="nav-label">${item.label}</span>
          ${item.count
            ? html`<span class=${`nav-count ${item.alert ? 'is-alert' : ''}`}>
                <span aria-hidden="true">${badgeText(item.count)}</span>
                <span class="visually-hidden">, ${item.count} ${COUNT_WORDS[item.id] || ''}${item.alert ? ', some failed' : ''}</span>
              </span>`
            : null}
        </button>
      </li>`;
    })}
  </ul>`;
}

function AccountGroup({ account, presets, collapsed, inboxUnread, hasFolders, foldersLoaded }) {
  const key = `a:${account.id}`;
  const open = !collapsed[key];
  const name = account.displayName || account.email;
  const items = [
    { id: 'new', label: 'New folder…', icon: 'folderPlus', onSelect: () => openDialog('folder', { mode: 'create', accountId: account.id }) },
    { id: 'sync', label: 'Check for new mail', icon: 'refresh', onSelect: () => syncAccount(account.id) },
    { id: 'settings', label: 'Account settings', icon: 'settings', onSelect: () => openDialog('settings', { accountId: account.id }) },
  ];
  return html`<section class="acct-group" aria-label=${`${name} folders`}>
    <div class="acct-head">
      <button
        type="button"
        class="acct-toggle"
        aria-expanded=${open ? 'true' : 'false'}
        title=${`${accountLabel(account, presets)} · ${account.email}`}
        onClick=${() => toggleCollapsed(key)}
      >
        <${Icon} name="chevronRight" size=${14} className=${open ? 'rot-90' : ''} />
        <${ColorDot} color=${account.color} size=${8} />
        <span class="acct-name">${name}</span>
        ${!open && inboxUnread ? html`<span class="nav-count"><span aria-hidden="true">${badgeText(inboxUnread)}</span><span class="visually-hidden">, ${inboxUnread} unread</span></span>` : null}
      </button>
      <${Menu} items=${items} label=${`Actions for ${name}`} buttonClass="icon-btn folder-more" iconSize=${15} />
    </div>
    ${open
      ? hasFolders
        ? html`<${FolderTree} accountId=${account.id} />`
        : html`<p class="acct-empty">${foldersLoaded ? 'Folders appear after the first sync.' : 'Loading folders…'}</p>`
      : null}
  </section>`;
}

function SidebarContent({ inDrawer = false }) {
  const counts = useNavCounts();
  const { accounts, presets, collapsed, folders, foldersLoaded } = useStore((s) => ({
    accounts: s.accounts,
    presets: s.config.presets,
    collapsed: s.collapsed,
    folders: s.folders,
    foldersLoaded: s.foldersLoaded,
  }));
  return html`<div class="sidebar-inner">
    ${inDrawer
      ? html`<div class="drawer-head">
          <${Logo} size=${26} />
          <span class="brand-name">Mailtabs</span>
          <button type="button" class="icon-btn drawer-close" aria-label="Close navigation" onClick=${() => closeDrawer()}>
            <${Icon} name="x" size=${18} />
          </button>
        </div>`
      : null}
    <div class="sidebar-top">
      <button type="button" class="btn btn-primary compose-btn" onClick=${() => compose('new')} title="Compose (c)">
        <${Icon} name="pen" size=${16} /> Compose
      </button>
    </div>
    <div class="sidebar-scroll">
      <${NavList} counts=${counts} />
      ${accounts.length ? html`<h2 class="sidebar-heading">Accounts</h2>` : null}
      ${accounts.map((a) => {
        const own = folders.filter((f) => f.accountId === a.id);
        const inbox = own.find(isInboxFolder);
        return html`<${AccountGroup}
          key=${a.id}
          account=${a}
          presets=${presets}
          collapsed=${collapsed}
          hasFolders=${own.length > 0}
          foldersLoaded=${foldersLoaded}
          inboxUnread=${inbox ? inbox.unreadCount || 0 : 0}
        />`;
      })}
      <button type="button" class="sidebar-add" onClick=${() => openDialog('addAccount')}>
        <${Icon} name="mailPlus" size=${15} /> Add account
      </button>
    </div>
  </div>`;
}

/** Collapsed desktop sidebar: icons only. */
function Rail() {
  const counts = useNavCounts();
  return html`<nav class="sidebar is-rail" aria-label="Mail">
    <button type="button" class="rail-compose" aria-label="Compose" title="Compose (c)" onClick=${() => compose('new')}>
      <${Icon} name="pen" size=${18} />
    </button>
    <ul class="rail-list" role="list">
      ${navItems(counts).map((item) => {
        const active = counts.view === item.id;
        const name = item.count ? `${item.label}, ${item.count} ${COUNT_WORDS[item.id] || ''}` : item.label;
        return html`<li key=${item.id}>
          <button
            type="button"
            class=${`rail-item ${active ? 'is-active' : ''}`}
            aria-current=${active ? 'page' : undefined}
            aria-label=${name}
            title=${item.label}
            data-view=${item.id}
            onClick=${() => selectView(item.id)}
          >
            <${Icon} name=${item.icon} size=${19} />
            ${item.count ? html`<span class=${`rail-badge ${item.alert ? 'is-alert' : ''}`} aria-hidden="true">${badgeText(item.count)}</span>` : null}
          </button>
        </li>`;
      })}
    </ul>
  </nav>`;
}

/** Modal drawer on tablets and phones (native <dialog>: focus stays inside, Esc closes). */
function Drawer() {
  const ref = useRef(null);
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const el = ref.current;
    const previouslyFocused = document.activeElement;
    try {
      el.showModal();
    } catch (_) {
      el.setAttribute('open', '');
    }
    const current = el.querySelector('[aria-current=page]') || el.querySelector('.compose-btn');
    if (current) current.focus({ preventScroll: true });
    const onCancel = (e) => {
      e.preventDefault();
      closeDrawer();
    };
    el.addEventListener('cancel', onCancel);
    return () => {
      el.removeEventListener('cancel', onCancel);
      if (el.open) el.close();
      if (previouslyFocused && previouslyFocused.isConnected && typeof previouslyFocused.focus === 'function') previouslyFocused.focus({ preventScroll: true });
    };
  }, []);
  return html`<dialog
    ref=${ref}
    class="drawer"
    aria-label="Navigation"
    onMouseDown=${(e) => {
      downOnBackdrop.current = e.target === ref.current;
    }}
    onClick=${(e) => {
      if (e.target === ref.current && downOnBackdrop.current) closeDrawer();
      downOnBackdrop.current = false;
    }}
  >
    <nav class="sidebar is-drawer" aria-label="Mail"><${SidebarContent} inDrawer /></nav>
  </dialog>`;
}

export function Sidebar() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { rail, drawerOpen } = useStore((s) => ({ rail: s.sidebarCollapsed, drawerOpen: s.drawerOpen }));

  // Growing the window past the breakpoint turns the drawer into the fixed sidebar.
  useEffect(() => {
    if (desktop && drawerOpen) closeDrawer();
  }, [desktop]);

  if (desktop) {
    return rail ? html`<${Rail} />` : html`<nav class="sidebar" aria-label="Mail"><${SidebarContent} /></nav>`;
  }
  return drawerOpen ? html`<${Drawer} />` : null;
}
