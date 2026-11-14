'use strict';

/**
 * Small, self-made attachments for the seeded mail: a one-page PDF and a few PNG images,
 * generated from code so the demo contains no third-party artwork.
 */

const zlib = require('zlib');

// ---------------------------------------------------------------------------------------------
// PDF: one A4 page of text lines (Helvetica), with a coloured header bar.
// ---------------------------------------------------------------------------------------------

function pdfEscape(s) {
  return String(s).replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?');
}

/**
 * @param {{ title: string, lines: Array<string|{text:string,size?:number,bold?:boolean,gap?:number}>, accent?: [r,g,b] }} doc
 * @returns {Buffer}
 */
function makePdf({ title, lines, accent = [0.31, 0.27, 0.9] }) {
  const ops = [];
  ops.push(`${accent.join(' ')} rg 0 772 595 70 re f`);
  ops.push(`BT /F2 22 Tf 1 1 1 rg 48 798 Td (${pdfEscape(title)}) Tj ET`);
  let y = 730;
  for (const item of lines) {
    const line = typeof item === 'string' ? { text: item } : item;
    const size = line.size || 11;
    y -= line.gap !== undefined ? line.gap : size + 7;
    ops.push(`BT /${line.bold ? 'F2' : 'F1'} ${size} Tf 0.12 0.13 0.16 rg 48 ${y} Td (${pdfEscape(line.text)}) Tj ET`);
  }
  const content = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${pdfEscape(title)}) /Producer (Mailtabs demo seed) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ---------------------------------------------------------------------------------------------
// PNG: RGB images drawn by a per-pixel function.
// ---------------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** pixel(x, y) -> [r, g, b] (0..255). */
function makePng(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** A homepage hero mock-up: browser frame, headline bars, a button and a card grid. */
function heroMockPng() {
  const W = 640;
  const H = 400;
  const bg = [246, 247, 251];
  const ink = [30, 41, 59];
  const accent = [79, 70, 229];
  const soft = [224, 231, 255];
  const rect = (x, y, x0, y0, w, h, r = 0) => {
    if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
    if (!r) return true;
    const cx = Math.max(x0 + r, Math.min(x, x0 + w - r - 1));
    const cy = Math.max(y0 + r, Math.min(y, y0 + h - r - 1));
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  return makePng(W, H, (x, y) => {
    if (y < 28) {
      if ((x - 18) ** 2 + (y - 14) ** 2 < 25) return [248, 113, 113];
      if ((x - 34) ** 2 + (y - 14) ** 2 < 25) return [251, 191, 36];
      if ((x - 50) ** 2 + (y - 14) ** 2 < 25) return [52, 211, 153];
      if (rect(x, y, 90, 7, 460, 14, 7)) return [255, 255, 255];
      return [226, 232, 240];
    }
    if (rect(x, y, 40, 70, 300, 26, 6)) return ink;
    if (rect(x, y, 40, 106, 250, 26, 6)) return ink;
    if (rect(x, y, 40, 150, 280, 10, 5)) return [148, 163, 184];
    if (rect(x, y, 40, 168, 220, 10, 5)) return [148, 163, 184];
    if (rect(x, y, 40, 198, 130, 38, 10)) return accent;
    if (rect(x, y, 182, 198, 110, 38, 10)) return soft;
    if (rect(x, y, 380, 60, 220, 190, 16)) {
      const t = clamp01((x - 380 + (y - 60)) / 410);
      return mix([129, 140, 248], [236, 72, 153], t);
    }
    for (let i = 0; i < 3; i++) {
      if (rect(x, y, 40 + i * 190, 280, 170, 90, 12)) {
        if (rect(x, y, 56 + i * 190, 296, 34, 34, 8)) return [soft, [209, 250, 229], [254, 243, 199]][i];
        if (rect(x, y, 56 + i * 190, 342, 110, 8, 4)) return [203, 213, 225];
        return [255, 255, 255];
      }
    }
    return bg;
  });
}

/** A lake at sunset: gradient sky, sun, two mountain ridges and a rippled reflection. */
function lakePhotoPng() {
  const W = 720;
  const H = 440;
  const horizon = 270;
  const ridge1 = (x) => 190 + 34 * Math.sin(x / 70) + 18 * Math.sin(x / 23 + 1.3);
  const ridge2 = (x) => 228 + 22 * Math.sin(x / 45 + 2.1) + 9 * Math.sin(x / 13);
  const sky = (y) => mix([251, 146, 60], [99, 102, 241], clamp01(1 - y / horizon) ** 0.8);
  const scene = (x, y) => {
    if ((x - 470) ** 2 + (y - 205) ** 2 < 32 * 32) return [254, 240, 138];
    if (y > ridge2(x)) return mix([30, 41, 59], [51, 65, 85], (y - 220) / 60);
    if (y > ridge1(x)) return mix([67, 56, 202], [76, 29, 149], (y - 160) / 120);
    return sky(y);
  };
  return makePng(W, H, (x, y) => {
    if (y < horizon) return scene(x, y);
    const d = y - horizon;
    const ripple = Math.round(3 * Math.sin(d / 3 + x / 40));
    const src = scene(Math.min(W - 1, Math.max(0, x + ripple)), Math.max(0, horizon - 1 - Math.floor(d * 1.2)));
    return mix(src, [15, 23, 42], 0.25 + 0.4 * (d / (H - horizon)));
  });
}

/** A bar chart of weekly signups (for the side project's weekly report). */
function signupChartPng(values = [4, 7, 6, 9, 12, 10, 15, 18]) {
  const W = 560;
  const H = 280;
  const max = Math.max(...values);
  const barW = 44;
  const gap = (W - 60 - values.length * barW) / (values.length - 1);
  return makePng(W, H, (x, y) => {
    if (y === H - 40 && x > 30 && x < W - 20) return [148, 163, 184];
    if ((H - 40 - y) % 50 === 0 && y < H - 40 && x > 30 && x < W - 20 && x % 6 < 3) return [226, 232, 240];
    for (let i = 0; i < values.length; i++) {
      const x0 = 40 + i * (barW + gap);
      const h = Math.round((values[i] / max) * (H - 80));
      if (x >= x0 && x < x0 + barW && y >= H - 40 - h && y < H - 40) {
        return i === values.length - 1 ? [217, 119, 6] : [251, 191, 36];
      }
    }
    return [255, 255, 255];
  });
}

module.exports = { makePdf, makePng, heroMockPng, lakePhotoPng, signupChartPng };
