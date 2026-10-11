// Tiny templating helpers — pages are plain template literals.
export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const join = (arr, fn) => arr.map(fn).join("");

// Wraps each word in a span so the scroll script can light words up one by one.
export const words = (text) =>
  text
    .split(/\s+/)
    .map((w) => `<span class="w">${esc(w)}</span>`)
    .join(" ");
