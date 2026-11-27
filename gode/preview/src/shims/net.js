"use strict";
// Browser stand-in for Node's `net` module: only the address checks that src/redact/patterns.js
// (IPv6 detection) and src/auth.js (client network keys) call. Same answers as Node for the
// address forms those modules pass in (no zone ids reach them: auth strips "%zone" first).

const V4_PART = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const V4_RE = new RegExp(`^${V4_PART}(?:\\.${V4_PART}){3}$`);
const HEX_RE = /^[0-9a-f]{1,4}$/i;

function isIPv4(s) {
  return typeof s === "string" && V4_RE.test(s);
}

function isIPv6(s) {
  if (typeof s !== "string" || s.length < 2 || s.length > 45) return false;
  let text = s;
  const zone = text.indexOf("%");
  if (zone >= 0) {
    if (zone === text.length - 1) return false;
    text = text.slice(0, zone);
  }
  const halves = text.split("::");
  if (halves.length > 2) return false;
  const groups = (part) => (part === "" ? [] : part.split(":"));
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const all = [...head, ...tail];
  let count = 0;
  for (let i = 0; i < all.length; i++) {
    const g = all[i];
    const last = i === all.length - 1;
    if (last && g.includes(".")) {
      if (!isIPv4(g)) return false;
      count += 2;
    } else if (HEX_RE.test(g)) {
      count += 1;
    } else {
      return false;
    }
  }
  return halves.length === 2 ? count <= 7 : count === 8;
}

function isIP(s) {
  if (isIPv4(s)) return 4;
  if (isIPv6(s)) return 6;
  return 0;
}

module.exports = { isIP, isIPv4, isIPv6 };
