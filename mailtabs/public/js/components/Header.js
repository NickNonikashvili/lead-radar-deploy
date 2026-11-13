// Top bar: navigation toggle, brand, search (debounced, scoped to the current view),
// refresh, user menu.
import { html, useEffect, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { openDialog, openDrawer, closeDrawer, setQuery, setSidebarCollapsed, signOut, syncAll, viewTitle } from '../actions.js';
import { Icon, Logo } from '../icons.js';
import { initials, timeAgo } from '../format.js';
import { DESKTOP_QUERY, SEARCH_INPUT_ID } from '../constants.js';
import { useDebouncedCallback, useMediaQuery, useNow, useOutsideClick, useUid } from '../hooks.js';

/** Desktop: collapse the sidebar to icons. Smaller screens: open the navigation drawer. */
function NavToggle() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { rail, drawerOpen, noAccounts } = useStore((s) => ({ rail: s.sidebarCollapsed, drawerOpen: s.drawerOpen, noAccounts: s.accountsLoaded && s.accounts.length === 0 }));
  if (noAccounts) return null;
  if (desktop) {
    return html`<button
      type="button"
      class="icon-btn topbar-btn nav-toggle"
      aria-label=${rail ? 'Expand the sidebar' : 'Collapse the sidebar'}
      title=${rail ? 'Expand sidebar' : 'Collapse sidebar'}
      onClick=${() => setSidebarCollapsed(!rail)}
    >
      <${Icon} name="menu" size=${19} />
    </button>`;
  }
  return html`<button
    type="button"
    class="icon-btn topbar-btn nav-toggle"
    aria-label="Show folders and accounts"
    aria-expanded=${drawerOpen ? 'true' : 'false'}
    title="Folders and accounts"
    onClick=${() => (drawerOpen ? closeDrawer() : openDrawer())}
  >
    <${Icon} name="menu" size=${19} />
  </button>`;
}

function SearchBox() {
  const { query, tabName } = useStore((s) => ({
    query: s.query,
    // The outbox has nothing to search: searching from there searches the inboxes.
    tabName: s.view === 'outbox' ? 'All inboxes' : viewTitle(s),
  }));
  const [value, setValue] = useState(query);
  const debouncedSet = useDebouncedCallback((v) => setQuery(v), 300);

  // Follow external resets (e.g. sign-out clears the query).
  useEffect(() => {
    setValue((v) => (v.trim() === query.trim() ? v : query));
  }, [query]);

  const onInput = (e) => {
    const v = e.currentTarget.value;
    setValue(v);
    debouncedSet(v);
  };
  const clear = () => {
    debouncedSet.cancel();
    setValue('');
    setQuery('');
    const input = document.getElementById(SEARCH_INPUT_ID);
    if (input) input.focus();
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (value) clear();
      else e.currentTarget.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      debouncedSet.cancel();
      setQuery(value);
    }
  };

  return html`<form class="search" role="search" onSubmit=${(e) => e.preventDefault()}>
    <span class="search-icon"><${Icon} name="search" size=${16} /></span>
    <input
      id=${SEARCH_INPUT_ID}
      class="search-input"
      type="search"
      placeholder=${`Search ${tabName}`}
      aria-label=${`Search mail in ${tabName}`}
      autocomplete="off"
      spellcheck=${false}
      value=${value}
      onInput=${onInput}
      onKeyDown=${onKeyDown}
    />
    ${value
      ? html`<button type="button" class="icon-btn search-clear" aria-label="Clear search" onClick=${clear}><${Icon} name="x" size=${14} /></button>`
      : html`<kbd class="kbd search-kbd" aria-hidden="true">/</kbd>`}
  </form>`;
}

function RefreshButton() {
  const { syncing, lastChecked } = useStore((s) => ({
    syncing: s.syncing,
    lastChecked: Math.max(s.lastCheckedAt || 0, ...s.accounts.map((a) => a.lastSyncedAt || 0)) || null,
  }));
  const now = useNow(30_000);
  const tip = syncing ? 'Checking for new mail…' : lastChecked ? `Last checked ${timeAgo(lastChecked, now)}` : 'Check for new mail';
  return html`<button
    type="button"
    class=${`icon-btn topbar-btn ${syncing ? 'is-busy' : ''}`}
    aria-label=${syncing ? 'Checking for new mail' : `Check for new mail. ${tip}`}
    title=${tip}
    aria-busy=${syncing ? 'true' : 'false'}
    onClick=${() => syncAll()}
  >
    <${Icon} name="refresh" size=${18} className=${syncing ? 'spin' : ''} />
  </button>`;
}

function UserMenu() {
  const user = useStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useUid('user-menu');

  useOutsideClick([buttonRef, menuRef], () => setOpen(false), open);

  useEffect(() => {
    if (open && menuRef.current) {
      const first = menuRef.current.querySelector('[role=menuitem]');
      if (first) first.focus();
    }
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus && buttonRef.current) buttonRef.current.focus();
  };
  // Return focus to the avatar button first so dialogs opened from the menu
  // hand focus back to it when they close (the menu item itself unmounts).
  const choose = (fn) => () => {
    close(true);
    fn();
  };

  const onMenuKeyDown = (e) => {
    const items = [...menuRef.current.querySelectorAll('[role=menuitem]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  if (!user) return null;
  return html`<div class="menu-wrap">
    <button
      ref=${buttonRef}
      type="button"
      class="avatar-btn"
      aria-haspopup="menu"
      aria-expanded=${open ? 'true' : 'false'}
      aria-controls=${open ? menuId : undefined}
      aria-label=${`Account menu for ${user.name || user.email}`}
      onClick=${() => setOpen((o) => !o)}
    >
      <span class="avatar" aria-hidden="true">${initials(user.name, user.email)}</span>
    </button>
    ${open
      ? html`<div ref=${menuRef} class="menu" role="menu" id=${menuId} aria-label="Account" onKeyDown=${onMenuKeyDown}>
          <div class="menu-header" role="presentation">
            <div class="menu-name">${user.name || 'Signed in'}</div>
            <div class="menu-email">${user.email}</div>
          </div>
          <button type="button" role="menuitem" class="menu-item" onClick=${choose(() => openDialog('settings'))}>
            <${Icon} name="settings" size=${16} /> Settings
          </button>
          <button type="button" role="menuitem" class="menu-item" onClick=${choose(() => openDialog('addAccount'))}>
            <${Icon} name="mailPlus" size=${16} /> Add email account
          </button>
          <div class="menu-sep" role="separator"></div>
          <button type="button" role="menuitem" class="menu-item" onClick=${choose(() => signOut())}>
            <${Icon} name="logout" size=${16} /> Sign out
          </button>
        </div>`
      : null}
  </div>`;
}

export function Header() {
  return html`<header class="topbar">
    <${NavToggle} />
    <div class="brand">
      <${Logo} size=${28} />
      <span class="brand-name">Mailtabs</span>
    </div>
    <${SearchBox} />
    <div class="topbar-actions">
      <${RefreshButton} />
      <${UserMenu} />
    </div>
  </header>`;
}
