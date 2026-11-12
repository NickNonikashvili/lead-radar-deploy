// Filter chips + the message list with infinite scroll.
import { html, useEffect, useMemo, useRef } from '/vendor/preact-htm.js';
import { getState, useStore } from '../store.js';
import { accountLabel, loadMore, markAllRead, openMessage, retryWorkspace, setCursor, setFilter, toggleStar } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { formatListDate, senderLabel } from '../format.js';
import { useNow } from '../hooks.js';
import { EmptyTab, NoMessages } from './EmptyStates.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'starred', label: 'Starred' },
];

export function FilterBar() {
  const { filter, unread } = useStore((s) => {
    const tab = s.activeTabId === 'all' ? null : s.tabs.find((t) => t.id === s.activeTabId);
    return { filter: s.filter, unread: tab ? tab.unreadCount : s.allCounts.unreadCount };
  });
  return html`<div class="list-toolbar">
    <div class="segmented segmented-sm" role="group" aria-label="Show">
      ${FILTERS.map(
        (f) => html`<button key=${f.value} type="button" class="segment" aria-pressed=${filter === f.value ? 'true' : 'false'} onClick=${() => setFilter(f.value)}>
          ${f.label}
        </button>`
      )}
    </div>
    <button
      type="button"
      class="btn btn-ghost btn-sm"
      onClick=${() => markAllRead()}
      disabled=${!unread}
      aria-label="Mark all as read"
      title=${unread ? `Mark ${unread} unread as read` : 'Nothing unread here'}
    >
      <${Icon} name="checkAll" size=${16} />
      <span class="hide-xs" aria-hidden="true">Mark all as read</span>
    </button>
  </div>`;
}

function MessageRow({ m, account, presets, isCursor, isOpen, now }) {
  const cls = ['msg', m.isRead ? 'is-read' : 'is-unread', isCursor ? 'is-cursor' : '', isOpen ? 'is-open' : ''].join(' ');
  const acctName = account ? `${accountLabel(account, presets)} (${account.email})` : '';
  return html`<li class=${cls} data-id=${m.id}>
    <span class="msg-stripe" style=${{ background: account ? account.color : 'transparent' }} title=${acctName} aria-hidden="true"></span>
    <button
      type="button"
      class="msg-main"
      aria-current=${isOpen ? 'true' : undefined}
      onClick=${() => openMessage(m.id)}
      onFocus=${() => setCursor(m.id)}
    >
      ${!m.isRead ? html`<span class="visually-hidden">Unread. </span>` : null}
      <span class="msg-top">
        ${!m.isRead ? html`<span class="unread-dot" aria-hidden="true"></span>` : null}
        <span class="msg-from">${senderLabel(m)}</span>
        <span class="msg-meta">
          ${m.hasAttachments ? html`<${Icon} name="paperclip" size=${14} label="Has attachments" />` : null}
          <time dateTime=${new Date(m.date).toISOString()}>${formatListDate(m.date, now)}</time>
        </span>
      </span>
      <span class="msg-subject">${m.subject || '(no subject)'}</span>
      <span class="msg-snippet">${m.snippet || ' '}</span>
      ${acctName ? html`<span class="visually-hidden">. Account: ${acctName}</span>` : null}
    </button>
    <button
      type="button"
      class=${`msg-star ${m.isStarred ? 'is-on' : ''}`}
      aria-pressed=${m.isStarred ? 'true' : 'false'}
      aria-label="Star"
      title=${m.isStarred ? 'Unstar (s)' : 'Star (s)'}
      onClick=${() => toggleStar(m.id)}
    >
      <${Icon} name="star" size=${16} filled=${m.isStarred} />
    </button>
  </li>`;
}

function SkeletonRows({ count = 9 }) {
  return html`<ul class="msg-list is-skeleton" aria-hidden="true">
    ${Array.from({ length: count }, (_, i) => html`<li key=${i} class="msg skeleton-row">
      <span class="sk sk-line sk-w40"></span>
      <span class="sk sk-line sk-w70"></span>
      <span class="sk sk-line sk-w90"></span>
    </li>`)}
  </ul>`;
}

export function MessageList() {
  const s = useStore((st) => ({
    list: st.list,
    cursorId: st.cursorId,
    openId: st.openId,
    accounts: st.accounts,
    presets: st.config.presets,
    activeTabId: st.activeTabId,
    tabs: st.tabs,
    filter: st.filter,
    query: st.query,
  }));
  const now = useNow();
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const { list } = s;

  const accountsById = useMemo(() => new Map(s.accounts.map((a) => [a.id, a])), [s.accounts]);
  const tab = s.activeTabId === 'all' ? null : s.tabs.find((t) => t.id === s.activeTabId) || null;
  const tabName = tab ? `“${tab.name}”` : 'your inboxes';
  const tabAccounts = tab ? (tab.allAccounts ? s.accounts : s.accounts.filter((a) => (tab.accountIds || []).includes(a.id))) : s.accounts;
  const syncing = tabAccounts.some((a) => a.status === 'pending' || a.status === 'syncing');

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !list.nextCursor || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: scrollRef.current, rootMargin: '400px 0px' }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [list.nextCursor, list.messages.length, list.loadingMore]);

  // Keep the cursor row visible, and carry keyboard focus along with it when the
  // focus is already in the list (or nowhere in particular).
  useEffect(() => {
    // Read the latest cursor: effects run a frame late and keys may have moved it again.
    const cursorId = getState().cursorId;
    if (cursorId == null || !scrollRef.current) return;
    const row = scrollRef.current.querySelector(`.msg[data-id="${cursorId}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest' });
    const active = document.activeElement;
    const focusInList = active && scrollRef.current.contains(active);
    if (focusInList || !active || active === document.body) {
      const btn = row.querySelector('.msg-main');
      if (btn && btn !== active) btn.focus({ preventScroll: true });
    }
  }, [s.cursorId]);

  // Scroll back to the top when the list itself changes (new tab / filter / search).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [list.key]);

  let content;
  if (tab && !tab.allAccounts && !(tab.accountIds || []).length) {
    content = html`<${EmptyTab} tab=${tab} />`;
  } else if (list.status === 'error' && !list.messages.length) {
    content = html`<div class="empty-state">
      <div class="empty-icon is-danger"><${Icon} name="alert" size=${22} /></div>
      <h3 class="empty-title">Couldn't load your mail</h3>
      <p class="empty-text">${list.error}</p>
      <button type="button" class="btn" onClick=${() => retryWorkspace()}>Try again</button>
    </div>`;
  } else if ((list.status === 'loading' || list.status === 'idle') && !list.messages.length) {
    content = html`<${SkeletonRows} />`;
  } else if (!list.messages.length) {
    content = html`<${NoMessages} query=${s.query.trim()} filter=${s.filter} tabName=${tabName} syncing=${syncing} />`;
  } else {
    content = html`<ul class="msg-list" aria-label="Messages">
        ${list.messages.map(
          (m) => html`<${MessageRow}
            key=${m.id}
            m=${m}
            account=${accountsById.get(m.accountId)}
            presets=${s.presets}
            isCursor=${s.cursorId === m.id}
            isOpen=${s.openId === m.id}
            now=${now}
          />`
        )}
      </ul>
      <div class="list-foot" ref=${sentinelRef}>
        ${list.loadingMore ? html`<span class="muted small"><${Spinner} size=${14} /> Loading more…</span>` : null}
        ${!list.loadingMore && list.moreError
          ? html`<span class="small">${list.moreError} <button type="button" class="link-btn" onClick=${() => loadMore()}>Retry</button></span>`
          : null}
        ${!list.loadingMore && !list.moreError && list.nextCursor
          ? html`<button type="button" class="link-btn small" onClick=${() => loadMore()}>Load more</button>`
          : null}
        ${!list.nextCursor && list.messages.length > 12 ? html`<span class="muted small">That's everything.</span>` : null}
      </div>`;
  }

  const refreshing = list.status === 'loading' && list.messages.length > 0;
  return html`<div class="list-scroll" ref=${scrollRef} aria-busy=${list.status === 'loading' ? 'true' : 'false'}>
    ${refreshing ? html`<div class="progress-bar" role="progressbar" aria-label="Loading"></div>` : null}
    ${content}
  </div>`;
}
