// To / Cc / Bcc field: recipient chips, contact autocomplete (combobox + listbox), pasted lists.
import { html, useEffect, useRef, useState } from '/vendor/preact-htm.js';
import { initials } from '../format.js';
import { useUid } from '../hooks.js';
import { CIcon } from './compose-icons.js';
import { composeApi } from './compose-api.js';
import { registerCommit } from './compose.js';
import { addRecipients, formatRecipient, makeRecipient, parseAddressList, recipientLabel, sameAddress, splitTyped } from './recipients.js';

const SUGGEST_DELAY = 160;
const contactCache = new Map(); // query -> contacts (small LRU)

function remember(q, contacts) {
  contactCache.delete(q);
  contactCache.set(q, contacts);
  if (contactCache.size > 60) contactCache.delete(contactCache.keys().next().value);
}

/** Bold the part of `text` that matches the typed prefix (no markup strings involved). */
function Highlight({ text, query }) {
  const t = String(text || '');
  const q = String(query || '').trim().toLowerCase();
  if (!q) return t;
  const lower = t.toLowerCase();
  let at = lower.startsWith(q) ? 0 : lower.indexOf(` ${q}`);
  if (at > 0) at += 1;
  if (at < 0) return t;
  return html`${t.slice(0, at)}<mark class="cmp-hl">${t.slice(at, at + q.length)}</mark>${t.slice(at + q.length)}`;
}

export function RecipientField({ composerId, field, label, recipients, onChange, disabled = false, children }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const timer = useRef(null);
  const abortRef = useRef(null);
  const latest = useRef({ text, recipients, onChange });
  latest.current = { text, recipients, onChange };
  const uid = useUid(`rcpt-${field}`);
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;

  const closeList = () => {
    setOpen(false);
    setActive(-1);
  };

  const add = (entries) => {
    const { recipients: cur, onChange: change } = latest.current;
    const next = addRecipients(cur, entries.map((e) => (e.key ? e : makeRecipient(e))));
    if (next.length !== cur.length) change(next);
  };

  /** Turn whatever is typed into chips (called on blur, Enter, separators and before sending). */
  const commit = () => {
    const value = latest.current.text.trim();
    if (!value) return;
    const entries = parseAddressList(value);
    if (entries.length) add(entries);
    setText('');
    latest.current.text = '';
    closeList();
  };

  useEffect(() => registerCommit(composerId, commit), [composerId]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (abortRef.current) abortRef.current.abort();
    },
    []
  );

  const lookup = (q) => {
    clearTimeout(timer.current);
    if (abortRef.current) abortRef.current.abort();
    const query = q.trim();
    if (!query || query.length > 100) {
      setSuggestions([]);
      closeList();
      return;
    }
    const show = (contacts) => {
      const cur = latest.current.recipients;
      const fresh = (contacts || []).filter((c) => c && c.address && !cur.some((r) => sameAddress(r.address, c.address))).slice(0, 8);
      setSuggestions(fresh);
      setOpen(fresh.length > 0);
      setActive(fresh.length ? 0 : -1);
    };
    if (contactCache.has(query.toLowerCase())) {
      show(contactCache.get(query.toLowerCase()));
      return;
    }
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const { contacts } = await composeApi.contacts(query, { limit: 8, signal: ctrl.signal });
        remember(query.toLowerCase(), contacts || []);
        if (latest.current.text.trim() === query) show(contacts);
      } catch (_) {
        /* suggestions are optional: no toast */
      }
    }, SUGGEST_DELAY);
  };

  const choose = (contact) => {
    add([{ name: contact.name || '', address: contact.address }]);
    setText('');
    latest.current.text = '';
    setSuggestions([]);
    closeList();
    if (inputRef.current) inputRef.current.focus();
  };

  const onInput = (e) => {
    const value = e.currentTarget.value;
    const { complete, rest } = splitTyped(value);
    if (complete.length) add(complete);
    setText(rest);
    latest.current.text = rest;
    lookup(rest);
  };

  const onPaste = (e) => {
    const pasted = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (!pasted || !pasted.includes('@')) return;
    e.preventDefault();
    const entries = parseAddressList(`${latest.current.text} ${pasted}`);
    if (entries.length) add(entries);
    setText('');
    latest.current.text = '';
    closeList();
  };

  const focusChip = (index) => {
    const chips = listRef.current ? listRef.current.querySelectorAll('.chip') : [];
    if (chips[index]) chips[index].focus();
    else if (inputRef.current) inputRef.current.focus();
  };

  const removeAt = (index, { refocus = true } = {}) => {
    const cur = latest.current.recipients;
    latest.current.onChange(cur.filter((_, i) => i !== index));
    if (refocus) setTimeout(() => focusChip(Math.min(index, cur.length - 2)), 0);
  };

  const editAt = (index) => {
    const r = latest.current.recipients[index];
    if (!r) return;
    const value = r.name ? formatRecipient(r) : r.address;
    removeAt(index, { refocus: false });
    setText(value);
    latest.current.text = value;
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(value.length, value.length);
      }
    }, 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length && open) {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (open && active >= 0 && suggestions[active]) choose(suggestions[active]);
      else commit();
    } else if (e.key === 'Enter') {
      commit(); // Ctrl/Cmd+Enter sends: make the typed address a chip first, then let it bubble
    } else if (e.key === 'Tab' && !e.shiftKey && open && active >= 0 && suggestions[active]) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === 'Tab') {
      commit();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      closeList();
    } else if (e.key === 'Backspace' && !text && recipients.length) {
      e.preventDefault();
      focusChip(recipients.length - 1);
    } else if (e.key === 'ArrowLeft' && !text && recipients.length && e.currentTarget.selectionStart === 0) {
      focusChip(recipients.length - 1);
    }
  };

  const onChipKeyDown = (e, index) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      removeAt(index);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusChip(Math.max(0, index - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusChip(index + 1);
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      editAt(index);
    }
  };

  const activeId = open && active >= 0 ? `${listId}-${active}` : undefined;
  const invalidCount = recipients.filter((r) => !r.valid).length;

  return html`<div class=${`cmp-row cmp-rcpt ${invalidCount ? 'has-invalid' : ''}`} data-field=${field}>
    <span class="cmp-row-label" id=${labelId}>${label}</span>
    <div class="cmp-rcpt-box" onClick=${(e) => e.target === e.currentTarget && inputRef.current && inputRef.current.focus()}>
      <ul class="chips" ref=${listRef} aria-labelledby=${labelId}>
        ${recipients.map(
          (r, i) => html`<li
            key=${r.key}
            class=${`chip ${r.valid ? '' : 'is-invalid'}`}
            tabindex="-1"
            title=${r.valid ? formatRecipient(r) : `“${r.address || r.name}” doesn't look like an email address`}
            onKeyDown=${(e) => onChipKeyDown(e, i)}
            onDblClick=${() => editAt(i)}
          >
            ${r.valid ? null : html`<${CIcon} name="alert" size=${13} />`}
            <span class="chip-label">${recipientLabel(r)}</span>
            ${r.valid ? null : html`<span class="visually-hidden"> (invalid address)</span>`}
            <button type="button" class="chip-x" tabindex="-1" aria-label=${`Remove ${recipientLabel(r)}`} onClick=${() => removeAt(i, { refocus: false })} disabled=${disabled}>
              <${CIcon} name="x" size=${12} />
            </button>
          </li>`
        )}
        <li class="chip-input-wrap">
          <input
            ref=${inputRef}
            class="chip-input"
            type="text"
            inputmode="email"
            autocomplete="off"
            autocapitalize="off"
            spellcheck=${false}
            role="combobox"
            aria-labelledby=${labelId}
            aria-autocomplete="list"
            aria-expanded=${open ? 'true' : 'false'}
            aria-controls=${listId}
            aria-activedescendant=${activeId}
            aria-invalid=${invalidCount ? 'true' : 'false'}
            disabled=${disabled}
            value=${text}
            onInput=${onInput}
            onPaste=${onPaste}
            onKeyDown=${onKeyDown}
            onBlur=${() => {
              commit();
              closeList();
            }}
          />
        </li>
      </ul>
      <ul id=${listId} class=${`cmp-suggest ${open ? 'is-open' : ''}`} role="listbox" aria-label=${`Suggested ${label} recipients`} hidden=${!open}>
        ${open
          ? suggestions.map(
              (c, i) => html`<li
                key=${c.address}
                id=${`${listId}-${i}`}
                role="option"
                aria-selected=${i === active ? 'true' : 'false'}
                class=${`cmp-suggest-item ${i === active ? 'is-active' : ''}`}
                onMouseDown=${(e) => e.preventDefault()}
                onMouseEnter=${() => setActive(i)}
                onClick=${() => choose(c)}
              >
                <span class="cmp-avatar" aria-hidden="true">${initials(c.name, c.address)}</span>
                <span class="cmp-suggest-text">
                  <span class="cmp-suggest-name"><${Highlight} text=${c.name || c.address} query=${text} /></span>
                  ${c.name ? html`<span class="cmp-suggest-addr"><${Highlight} text=${c.address} query=${text} /></span>` : null}
                </span>
              </li>`
            )
          : null}
      </ul>
    </div>
    ${children}
  </div>`;
}
