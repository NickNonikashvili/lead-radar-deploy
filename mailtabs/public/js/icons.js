// Inline SVG icons (24x24 grid, stroke style). Each entry is a function so every
// render gets fresh vnodes (Preact mutates vnodes it has rendered).
import { html } from '/vendor/preact-htm.js';

const PATHS = {
  inbox: () => html`<path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />`,
  search: () => html`<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />`,
  refresh: () => html`<path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" /><path d="M3 21v-5h5" /><path d="M3 12A9 9 0 0 1 18.36 5.64L21 8" /><path d="M21 3v5h-5" />`,
  star: () => html`<path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85z" />`,
  archive: () => html`<rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" />`,
  trash: () => html`<path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />`,
  mail: () => html`<rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />`,
  mailOpen: () => html`<path d="M3 9.5 12 4l9 5.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="m3 9.5 9 6 9-6" />`,
  mailPlus: () => html`<path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8" /><path d="m3 7 9 6 9-6" /><path d="M19 16v6M16 19h6" />`,
  paperclip: () => html`<path d="m21 11-8.6 8.6a5 5 0 0 1-7.07-7.07l8.6-8.6a3.33 3.33 0 0 1 4.71 4.71l-8.6 8.6a1.67 1.67 0 0 1-2.36-2.36l7.9-7.9" />`,
  plus: () => html`<path d="M12 5v14M5 12h14" />`,
  more: () => html`<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />`,
  settings: () => html`<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" />`,
  logout: () => html`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />`,
  arrowLeft: () => html`<path d="M19 12H5" /><path d="m12 19-7-7 7-7" />`,
  chevronLeft: () => html`<path d="m15 18-6-6 6-6" />`,
  chevronRight: () => html`<path d="m9 18 6-6-6-6" />`,
  chevronDown: () => html`<path d="m6 9 6 6 6-6" />`,
  x: () => html`<path d="M18 6 6 18M6 6l12 12" />`,
  check: () => html`<path d="M20 6 9 17l-5-5" />`,
  checkAll: () => html`<path d="M2 12.5 6 16.5 14.5 8" /><path d="m11.5 15.5 1 1L21 8" />`,
  alert: () => html`<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />`,
  info: () => html`<circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />`,
  image: () => html`<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />`,
  edit: () => html`<path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />`,
  download: () => html`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" />`,
  file: () => html`<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" />`,
  user: () => html`<circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />`,
  lock: () => html`<rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />`,
  external: () => html`<path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />`,
  keyboard: () => html`<rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />`,
  moon: () => html`<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />`,
  server: () => html`<rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" />`,
  eye: () => html`<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />`,
  eyeOff: () => html`<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.16 3.19" /><path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="m2 2 20 20" />`,
  link: () => html`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />`,
  sparkles: () => html`<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />`,
};

/**
 * <${Icon} name="star" size=${16} filled />
 * Decorative by default (aria-hidden); pass `label` to expose it to assistive tech.
 */
export function Icon({ name, size = 16, filled = false, label, className = '' }) {
  const draw = PATHS[name];
  if (!draw) return null;
  return html`<svg
    class=${`icon icon-${name} ${className}`}
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill=${filled ? 'currentColor' : 'none'}
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

/** The Mailtabs mark: an envelope sitting under a row of tabs. */
export function Logo({ size = 28 }) {
  return html`<svg class="logo-mark" width=${size} height=${size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
    <rect x="7" y="7" width="7" height="3.2" rx="1.6" fill="#fff" opacity="0.95" />
    <rect x="15.5" y="7" width="5" height="3.2" rx="1.6" fill="#fff" opacity="0.55" />
    <rect x="22" y="7" width="3" height="3.2" rx="1.5" fill="#fff" opacity="0.35" />
    <rect x="7" y="12.5" width="18" height="12.5" rx="2.4" fill="none" stroke="#fff" stroke-width="2" />
    <path d="M7.8 14l8.2 5.6 8.2-5.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

export function Spinner({ size = 16, label }) {
  return html`<span class="spinner" style=${{ width: `${size}px`, height: `${size}px` }} role=${label ? 'status' : undefined} aria-label=${label || undefined} aria-hidden=${label ? undefined : 'true'}></span>`;
}
