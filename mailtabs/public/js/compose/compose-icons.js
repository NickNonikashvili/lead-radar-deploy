// Extra icons for the composer (same 24x24 stroke style as /js/icons.js). Names not defined here
// fall back to the shared set, so components can use <${CIcon} name="trash" /> for either.
import { html } from '/vendor/preact-htm.js';
import { Icon } from '../icons.js';

const PATHS = {
  minus: () => html`<path d="M5 12h14" />`,
  chevronUp: () => html`<path d="m18 15-6-6-6 6" />`,
  maximize: () => html`<path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="m21 3-7 7" /><path d="m3 21 7-7" />`,
  minimize: () => html`<path d="M4 14h6v6" /><path d="M20 10h-6V4" /><path d="m14 10 7-7" /><path d="m3 21 7-7" />`,
  send: () => html`<path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" />`,
  clock: () => html`<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />`,
  bold: () => html`<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />`,
  italic: () => html`<path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4 9 20" />`,
  underline: () => html`<path d="M6 4v6a6 6 0 0 0 12 0V4" /><path d="M4 20h16" />`,
  strike: () => html`<path d="M16 6.5C15.2 5 13.7 4 12 4c-2.5 0-4.5 1.6-4.5 3.6 0 1.5 1 2.5 3 3.2" /><path d="M4 12h16" /><path d="M8 17.5c.8 1.5 2.3 2.5 4 2.5 2.5 0 4.5-1.6 4.5-3.6 0-.6-.2-1.2-.5-1.7" />`,
  listBullet: () => html`<path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />`,
  listNumber: () => html`<path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 4.5h1.2V9" /><path d="M3.8 9h2.6" /><path d="M3.8 14.2a1.3 1.3 0 0 1 2.4.6c0 .9-2.5 2.2-2.5 3.7h2.6" />`,
  quote: () => html`<path d="M7 7h3v5c0 2.5-1.2 4-3.5 4.6" /><path d="M7 7c-1 0-2 .8-2 2v1.5c0 .8.6 1.5 1.5 1.5H10" /><path d="M15 7h3v5c0 2.5-1.2 4-3.5 4.6" /><path d="M15 7c-1 0-2 .8-2 2v1.5c0 .8.6 1.5 1.5 1.5H18" />`,
  unlink: () => html`<path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" /><path d="M8 2v3M2 8h3M16 22v-3M22 16h-3" />`,
  eraser: () => html`<path d="m7 21-4.3-4.3a1.5 1.5 0 0 1 0-2.1l9.9-9.9a1.5 1.5 0 0 1 2.1 0l5.6 5.6a1.5 1.5 0 0 1 0 2.1L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" />`,
  undo: () => html`<path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />`,
  redo: () => html`<path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />`,
  textFormat: () => html`<path d="m6.5 16 5.5-12 5.5 12" /><path d="M8.6 11.5h6.8" /><path d="M4 20.5h16" />`,
  dots: () => html`<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />`,
  upload: () => html`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" />`,
  signature: () => html`<path d="M3 17c3-1 4.5-9 7-9 2 0 0 7 2 7s2.5-4 4-4 1 3 2.5 3H21" /><path d="M3 21h18" />`,
};

export function CIcon({ name, size = 16, label, className = '' }) {
  const draw = PATHS[name];
  if (!draw) return html`<${Icon} name=${name} size=${size} label=${label} className=${className} />`;
  return html`<svg
    class=${`icon icon-${name} ${className}`}
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
    aria-hidden=${label ? undefined : 'true'}
    role=${label ? 'img' : undefined}
    aria-label=${label || undefined}
  >${draw()}</svg>`;
}
