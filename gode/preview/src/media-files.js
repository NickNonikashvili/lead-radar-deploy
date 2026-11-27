"use strict";
// The files the preview's media "models" return: an SVG picture and short WAV sounds, as data:
// URLs (the page's CSP allows data: for img and media). Ported from src/providers/mock.js
// (svgDataUrl, wavDataUrl), which uses Node's Buffer: here btoa and typed arrays do the same job,
// and the picture says plainly that no image model made it.

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

/** Same hue rule as the mock provider, so a prompt always gets the same colours. */
function hue(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

function base64(bytes) {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

function utf8Base64(text) {
  return base64(new TextEncoder().encode(text));
}

/** Break a caption into at most `lines` lines of about `width` characters. */
function wrap(text, width, lines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      if (cur) out.push(cur);
      cur = w.length > width ? w.slice(0, width - 1) + "…" : w;
      if (out.length === lines) break;
    } else cur = (cur + " " + w).trim();
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(" ").length > out.join(" ").length) out[lines - 1] = out[lines - 1].replace(/.?$/, "…");
  return out.slice(0, lines);
}

/**
 * A 1024x1024 SVG "generation": a soft scene in the prompt's colours, the model's name and the
 * prompt the media model would have received (already genericized by the pipeline).
 * @param {{ label: string, prompt: string, job: string, aspect?: string }} opts
 */
function svgDataUrl({ label, prompt, job, aspect }) {
  const [aw, ah] = /^(\d+):(\d+)$/.test(String(aspect || "")) ? String(aspect).split(":").map(Number) : [1, 1];
  const W = 1024;
  const H = Math.round(Math.min(1.8, Math.max(0.55, ah / aw)) * W);
  const h1 = hue(prompt);
  const h2 = (h1 + 40) % 360;
  const h3 = (h1 + 200) % 360;
  const lines = wrap(prompt, 34, 3);
  const kind = job === "video" ? "Video preview · first frame" : "Image preview";
  const text = lines
    .map((l, i) => `<text x="${W / 2}" y="${H * 0.62 + i * 44}" font-size="32" fill="#fff" fill-opacity=".92" text-anchor="middle">${xmlEscape(l)}</text>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},62%,58%)"/><stop offset="1" stop-color="hsl(${h2},55%,38%)"/></linearGradient>` +
    `<radialGradient id="s" cx=".72" cy=".28" r=".35"><stop offset="0" stop-color="hsl(${h3},90%,85%)" stop-opacity=".9"/><stop offset="1" stop-color="hsl(${h3},90%,85%)" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#s)"/>` +
    `<path d="M0 ${H * 0.78} C ${W * 0.25} ${H * 0.7}, ${W * 0.45} ${H * 0.86}, ${W * 0.7} ${H * 0.76} S ${W} ${H * 0.74}, ${W} ${H * 0.74} V ${H} H 0 Z" fill="#000" fill-opacity=".18"/>` +
    `<path d="M0 ${H * 0.86} C ${W * 0.3} ${H * 0.8}, ${W * 0.6} ${H * 0.94}, ${W} ${H * 0.84} V ${H} H 0 Z" fill="#000" fill-opacity=".22"/>` +
    `<rect x="${W / 2 - 230}" y="${H * 0.3}" width="460" height="64" rx="32" fill="#000" fill-opacity=".28"/>` +
    `<text x="${W / 2}" y="${H * 0.3 + 43}" font-size="30" font-weight="600" fill="#fff" text-anchor="middle">${xmlEscape(kind)}</text>` +
    `<text x="${W / 2}" y="${H * 0.5}" font-size="46" font-weight="700" fill="#fff" text-anchor="middle">${xmlEscape(String(label).slice(0, 40))}</text>` +
    text +
    `<text x="${W / 2}" y="${H - 36}" font-size="24" fill="#fff" fill-opacity=".8" text-anchor="middle">Gode preview: no ${job === "video" ? "video" : "image"} model was called</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${utf8Base64(svg)}`;
}

/** 8 kHz, 8-bit mono PCM WAV from a sample function (t in seconds -> -1..1). */
function wav(seconds, sample) {
  const rate = 8000;
  const n = Math.round(rate * seconds);
  const buf = new Uint8Array(44 + n);
  const view = new DataView(buf.buffer);
  const ascii = (off, s) => {
    for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + n, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, n, true);
  for (let i = 0; i < n; i++) buf[44 + i] = Math.max(0, Math.min(255, Math.round(128 + 90 * sample(i / rate))));
  return `data:audio/wav;base64,${base64(buf)}`;
}

const cache = new Map();

/** A short arpeggio (music) or a soft two-tone chime (voice). */
function wavDataUrl(job) {
  const kind = job === "music" ? "music" : "voice";
  if (cache.has(kind)) return cache.get(kind);
  let url;
  if (kind === "music") {
    const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
    const step = 0.22;
    url = wav(notes.length * step, (t) => {
      const i = Math.min(notes.length - 1, Math.floor(t / step));
      const local = t - i * step;
      const env = Math.min(1, local * 40) * Math.exp(-local * 6);
      return env * (0.7 * Math.sin(2 * Math.PI * notes[i] * t) + 0.3 * Math.sin(4 * Math.PI * notes[i] * t));
    });
  } else {
    url = wav(0.9, (t) => {
      const f = t < 0.45 ? 523.25 : 392.0;
      const local = t < 0.45 ? t : t - 0.45;
      return Math.exp(-local * 7) * Math.sin(2 * Math.PI * f * t);
    });
  }
  cache.set(kind, url);
  return url;
}

module.exports = { svgDataUrl, wavDataUrl, hue, wrap };
