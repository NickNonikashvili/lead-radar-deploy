"use strict";
// Browser stand-in for Node's `crypto` module, as far as the bundled Gode modules use it:
// src/util.js calls crypto.randomUUID() for every id. Anything else throws, so a new use shows up
// in the contract tests instead of silently misbehaving.

function webCrypto() {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function") throw new Error("preview: Web Crypto is not available");
  return c;
}

function randomBytes(n) {
  const out = new Uint8Array(n);
  webCrypto().getRandomValues(out);
  return out;
}

function randomUUID() {
  const c = webCrypto();
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Older browsers without crypto.randomUUID (outside a secure context): RFC 4122 v4 by hand.
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function unsupported(name) {
  return () => {
    throw new Error(`preview: crypto.${name} is not available in the browser preview`);
  };
}

module.exports = {
  randomUUID,
  randomBytes,
  createHash: unsupported("createHash"),
  createHmac: unsupported("createHmac"),
  scrypt: unsupported("scrypt"),
  timingSafeEqual: unsupported("timingSafeEqual"),
};
