// "Move to…": pick a folder of the messages' account, with search and arrow-key navigation
// (combobox + listbox pattern). Messages can only move within their own account.
import { html, useEffect, useMemo, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { accountLabel, closeDialog, findMessage, moveMessages, openDialog } from '../actions.js';
import { Icon } from '../icons.js';
import { plural } from '../format.js';
import { useUid } from '../hooks.js';
import { Dialog } from './Dialog.js';
import { ColorDot } from './ui.js';
import { folderIcon, folderMatches, folderPathLabel, moveTargets } from './navModel.js';

export function MoveDialog({ ids = [], accountId: initialAccount = null, query: initialQuery = '' }) {
  const { folders, accounts, presets } = useStore((s) => ({ folders: s.folders, accounts: s.accounts, presets: s.config.presets }));
  const messages = useMemo(() => ids.map((id) => findMessage(id)).filter(Boolean), [ids]);

  // Messages per account, most first: the dialog moves one account's messages at a time.
  const byAccount = useMemo(() => {
    const counts = new Map();
    for (const m of messages) counts.set(m.accountId, (counts.get(m.accountId) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [messages]);
  const [accountId, setAccountId] = useState(() => initialAccount || (byAccount[0] ? byAccount[0][0] : null));
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const listId = useUid('move-list');
  const optionId = (i) => `${listId}-opt-${i}`;

  const own = messages.filter((m) => m.accountId === accountId);
  const sourceIds = [...new Set(own.map((m) => m.folderId))];
  const excludeFolderId = sourceIds.length === 1 ? sourceIds[0] : null;
  const targets = moveTargets(folders, accountId, { excludeFolderId }).filter((f) => folderMatches(f, query));
  const account = accounts.find((a) => a.id === accountId) || null;
  const others = messages.length - own.length;

  useEffect(() => setActive(0), [query, accountId]);
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector(`#${CSS.escape(optionId(active))}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (folder) => {
    if (!folder) return;
    closeDialog();
    moveMessages(own.map((m) => m.id), 'move', { folderId: folder.id });
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(targets.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home' && targets.length) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && targets.length) {
      e.preventDefault();
      setActive(targets.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(targets[active]);
    }
  };

  const newFolder = () =>
    openDialog('folder', { mode: 'create', accountId, initialName: query.trim(), returnTo: { type: 'move', props: { ids, accountId, query: '' } } });

  const title = own.length === 1 && messages.length === 1 ? 'Move message' : `Move ${plural(own.length, 'message')}`;
  const footer = html`<button type="button" class="btn btn-ghost footer-start" onClick=${newFolder} disabled=${!accountId}>
      <${Icon} name="folderPlus" size=${15} /> New folder…
    </button>
    <button type="button" class="btn btn-ghost" onClick=${closeDialog}>Cancel</button>
    <button type="button" class="btn btn-primary" onClick=${() => choose(targets[active])} disabled=${!targets.length}>Move</button>`;

  return html`<${Dialog} title=${title} onClose=${closeDialog} footer=${footer} size="md" className="move-dialog">
    <div class="stack">
      ${byAccount.length > 1
        ? html`<div class="field">
            <span class="field-label" id=${`${listId}-acct`}>Messages from</span>
            <div class="segmented segmented-wrap" role="radiogroup" aria-labelledby=${`${listId}-acct`}>
              ${byAccount.map(([aid, n]) => {
                const a = accounts.find((x) => x.id === aid);
                return html`<button key=${aid} type="button" class="segment" role="radio" aria-checked=${aid === accountId ? 'true' : 'false'} onClick=${() => setAccountId(aid)}>
                  <${ColorDot} color=${a ? a.color : null} /> ${a ? a.displayName || a.email : 'Account'} (${n})
                </button>`;
              })}
            </div>
            <p class="field-hint">
              Messages can only move to folders of their own account; the ${plural(others, 'other message')} ${others === 1 ? 'stays where it is' : 'stay where they are'}.
            </p>
          </div>`
        : account
          ? html`<p class="move-account"><${ColorDot} color=${account.color} /> ${accountLabel(account, presets)} · <span class="muted">${account.email}</span></p>`
          : null}
      <label class="field">
        <span class="field-label">Folder</span>
        <input
          class="input"
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls=${listId}
          aria-activedescendant=${targets.length ? optionId(active) : undefined}
          aria-autocomplete="list"
          placeholder="Search folders"
          autocomplete="off"
          spellcheck=${false}
          value=${query}
          onInput=${(e) => setQuery(e.currentTarget.value)}
          onKeyDown=${onKeyDown}
          data-autofocus
        />
      </label>
      <ul class="move-list" role="listbox" id=${listId} aria-label="Folders" ref=${listRef}>
        ${targets.map(
          (f, i) => html`<li
            key=${f.id}
            id=${optionId(i)}
            role="option"
            aria-selected=${i === active ? 'true' : 'false'}
            class=${`move-option ${i === active ? 'is-active' : ''}`}
            onMouseMove=${() => i !== active && setActive(i)}
            onClick=${() => choose(f)}
          >
            <${Icon} name=${folderIcon(f)} size=${16} />
            <span class="move-name">${folderPathLabel(f)}</span>
          </li>`
        )}
        ${!targets.length
          ? html`<li class="move-empty" role="presentation">${query.trim() ? `No folder matches “${query.trim()}”.` : 'This account has no other folders yet.'}</li>`
          : null}
      </ul>
    </div>
  </${Dialog}>`;
}
