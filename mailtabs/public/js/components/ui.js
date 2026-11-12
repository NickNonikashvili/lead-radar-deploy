// Small presentational building blocks shared across screens.
import { html, useEffect, useRef } from '/vendor/preact-htm.js';
import { Icon, Spinner } from '../icons.js';
import { PROVIDER_UI, SWATCHES } from '../constants.js';
import { timeAgo } from '../format.js';
import { useUid } from '../hooks.js';

/** Radio-group of color swatches. */
export function ColorSwatches({ value, onChange, label = 'Color', name }) {
  const groupName = useUid(name || 'color');
  const current = (value || '').toLowerCase();
  return html`<fieldset class="swatches">
    <legend class="field-label">${label}</legend>
    <div class="swatch-row">
      ${SWATCHES.map(
        (s) => html`<label key=${s.value} class="swatch" title=${s.name}>
          <input
            type="radio"
            class="visually-hidden"
            name=${groupName}
            value=${s.value}
            checked=${current === s.value}
            onChange=${() => onChange(s.value)}
          />
          <span class="swatch-dot" style=${{ '--swatch': s.value }}><${Icon} name="check" size=${14} /></span>
          <span class="visually-hidden">${s.name}</span>
        </label>`
      )}
    </div>
  </fieldset>`;
}

/**
 * The first swatch none of `used` has; when all are taken, the least-used one (swatch order breaks
 * ties). The server picks account colours the same way (src/palette.js).
 */
export function nextFreeColor(used) {
  const counts = new Map(SWATCHES.map((s) => [s.value, 0]));
  for (const c of used || []) {
    const key = String(c || '').toLowerCase();
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }
  let best = SWATCHES[0].value;
  for (const s of SWATCHES) if (counts.get(s.value) < counts.get(best)) best = s.value;
  return best;
}

export function ColorDot({ color, size = 8, className = '' }) {
  return html`<span class=${`color-dot ${className}`} style=${{ background: color || 'var(--text-3)', width: `${size}px`, height: `${size}px` }} aria-hidden="true"></span>`;
}

/** Neutral letter mark for a provider tile (no third-party logos). */
export function ProviderMark({ provider, size = 36 }) {
  const ui = PROVIDER_UI[provider] || PROVIDER_UI.imap;
  return html`<span class="provider-mark" style=${{ '--tint': ui.tint, width: `${size}px`, height: `${size}px` }} aria-hidden="true">
    ${ui.mark ? ui.mark : html`<${Icon} name="server" size=${Math.round(size * 0.5)} />`}
  </span>`;
}

/** Account sync status as a small pill. */
export function StatusPill({ account, now }) {
  const status = account.status;
  if (status === 'syncing') {
    return html`<span class="pill pill-accent"><${Spinner} size=${10} /> Syncing…</span>`;
  }
  if (status === 'pending') return html`<span class="pill pill-neutral">Waiting to sync</span>`;
  if (status === 'auth_error') return html`<span class="pill pill-warning" title=${account.lastError || ''}>Needs reconnect</span>`;
  if (status === 'error') {
    return html`<span class="pill pill-danger" title=${account.lastError || ''}>Error: ${account.lastError || 'sync failed'}</span>`;
  }
  return html`<span class="pill pill-success">Up to date${account.lastSyncedAt ? ` · ${timeAgo(account.lastSyncedAt, now)}` : ''}</span>`;
}

/** Checkbox list of tabs (used to attach an account to tabs). */
export function TabChecklist({ tabs, selected, onToggle, emptyText = 'No tabs yet.' }) {
  if (!tabs.length) return html`<p class="muted small">${emptyText}</p>`;
  return html`<div class="check-list">
    ${tabs.map(
      (t) => html`<label key=${t.id} class=${`check-row ${t.allAccounts ? 'is-disabled' : ''}`}>
        <input
          type="checkbox"
          checked=${t.allAccounts || selected.includes(t.id)}
          disabled=${!!t.allAccounts}
          onChange=${(e) => onToggle(t.id, e.currentTarget.checked)}
        />
        <${ColorDot} color=${t.color} />
        <span class="check-label">${t.name}</span>
        ${t.allAccounts ? html`<span class="check-note">shows all accounts</span>` : null}
      </label>`
    )}
  </div>`;
}

export function InlineError({ message, id }) {
  const ref = useRef(null);
  // Errors often render at the end of a long, scrolled form: bring them into view.
  useEffect(() => {
    if (message && ref.current && typeof ref.current.scrollIntoView === 'function') {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [message]);
  if (!message) return null;
  return html`<div class="inline-error" role="alert" id=${id} ref=${ref}>
    <${Icon} name="alert" size=${16} />
    <span>${message}</span>
  </div>`;
}

export function Kbd({ children }) {
  return html`<kbd class="kbd">${children}</kbd>`;
}
