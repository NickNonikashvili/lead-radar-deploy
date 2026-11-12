'use strict';

/**
 * SSRF guard for user-supplied IMAP hosts.
 *
 * A user can type any host into the "Other (IMAP)" form, so without this check the server
 * could be made to open connections to its own loopback interface, the cloud metadata service
 * (169.254.169.254) or other machines on the private network. We resolve the name and refuse
 * it if ANY of its addresses is non-public. The caller then connects to one of the addresses we
 * checked (see imap.js), so a DNS answer that changes between check and connect cannot
 * smuggle a private address in (DNS rebinding).
 */

const dns = require('dns');
const net = require('net');
const { domainToASCII } = require('url');
const { HttpError } = require('./errors');

const NOT_ALLOWED_MESSAGE =
  'That server address points to a private or local network, which is not allowed. Use your provider\'s public IMAP server name.';

// ---------------------------------------------------------------------------------------------
// Address classification
// ---------------------------------------------------------------------------------------------

/** IPv4 dotted quad -> unsigned 32-bit integer, or null. */
function ipv4ToInt(ip) {
  if (!net.isIPv4(ip)) return null;
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

// [network, prefixLength] — everything that is not ordinary public unicast.
const BLOCKED_V4 = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (cloud metadata lives here)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast (deprecated)
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
].map(([network, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { base: (ipv4ToInt(network) & mask) >>> 0, mask };
});

function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // fail closed
  return BLOCKED_V4.some(({ base, mask }) => ((n & mask) >>> 0) === base);
}

/** IPv6 string -> array of 8 16-bit numbers, or null. Handles '::' and a dotted IPv4 tail. */
function parseIPv6(ip) {
  if (!net.isIPv6(ip)) return null;
  let s = ip;
  // An embedded IPv4 tail (e.g. ::ffff:127.0.0.1) becomes two hextets.
  const v4Match = s.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4Match) {
    const n = ipv4ToInt(v4Match[1]);
    if (n === null) return null;
    s = s.slice(0, -v4Match[1].length) + ((n >>> 16) & 0xffff).toString(16) + ':' + (n & 0xffff).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;
  const parts = [...head, ...new Array(halves.length === 2 ? missing : 0).fill('0'), ...tail].map((h) => parseInt(h, 16));
  if (parts.length !== 8 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 0xffff)) return null;
  return parts;
}

function hextetsToIPv4(hi, lo) {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
}

function isPrivateIPv6(ip) {
  const h = parseIPv6(ip);
  if (!h) return true; // fail closed

  const firstFiveZero = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0;
  // ::ffff:a.b.c.d — IPv4-mapped: judge by the IPv4 address it maps to.
  if (firstFiveZero && h[5] === 0xffff) return isPrivateIPv4(hextetsToIPv4(h[6], h[7]));
  // ::/96 — unspecified (::), loopback (::1) and the deprecated IPv4-compatible form.
  if (firstFiveZero && h[5] === 0) return true;
  // 64:ff9b::/96 — NAT64 well-known prefix: judge by the embedded IPv4 address.
  if (h[0] === 0x64 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
    return isPrivateIPv4(hextetsToIPv4(h[6], h[7]));
  }
  if (h[0] === 0x64 && h[1] === 0xff9b && h[2] === 1) return true; // 64:ff9b:1::/48 local-use NAT64
  if (h[0] === 0x100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true; // 100::/64 discard
  if (h[0] === 0x2001 && h[1] === 0) return true; // 2001::/32 Teredo (embeds arbitrary IPv4)
  if (h[0] === 0x2001 && h[1] === 0xdb8) return true; // 2001:db8::/32 documentation
  if (h[0] === 0x2002) return isPrivateIPv4(hextetsToIPv4(h[1], h[2])); // 2002::/16 6to4
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((h[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/**
 * True when `ip` is anything other than a public unicast address: loopback, private, link-local,
 * CGNAT, unique-local, multicast, reserved, IPv4-mapped forms of those, etc.
 * Fails closed: input that is not a valid IP address counts as private.
 */
function isPrivateAddress(ip) {
  if (typeof ip !== 'string') return true;
  let s = ip.trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const zone = s.indexOf('%'); // fe80::1%eth0
  if (zone >= 0) s = s.slice(0, zone);
  if (net.isIPv4(s)) return isPrivateIPv4(s);
  if (net.isIPv6(s)) return isPrivateIPv6(s);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Host validation
// ---------------------------------------------------------------------------------------------

const LABEL_RE = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;

/**
 * Normalise a user-typed host: trims, lowercases, strips a trailing dot and IPv6 brackets,
 * converts international domain names to punycode. Returns null when it is not a plausible
 * host name or IP literal (URLs, "user@host", spaces, ports…).
 */
function normalizeHost(host) {
  if (typeof host !== 'string') return null;
  let s = host.trim();
  if (!s || s.length > 255) return null;
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  if (net.isIP(s)) return s.toLowerCase();
  s = s.replace(/\.$/, '');
  if (/[\s/\\@:?#]/.test(s)) return null;
  const ascii = domainToASCII(s);
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split('.');
  if (!labels.every((label) => LABEL_RE.test(label))) return null;
  return ascii;
}

function lookupAll(host) {
  return new Promise((resolve, reject) => {
    dns.lookup(host, { all: true, verbatim: true }, (err, addresses) => (err ? reject(err) : resolve(addresses)));
  });
}

/**
 * Throws HttpError(400, …, 'HOST_NOT_ALLOWED') when the host is empty/invalid, or — unless
 * `allowPrivate` — when it is (or resolves to) a non-public address or is `localhost`.
 * DNS failures throw HttpError(400, friendly message, 'HOST_NOT_FOUND').
 *
 * @returns {Promise<{ host: string, addresses: Array<{address: string, family: number}> }>}
 *   the normalised host and the checked addresses ([] when allowPrivate is set: nothing to check,
 *   the caller connects by name).
 */
async function assertAllowedHost(host, { allowPrivate = false } = {}) {
  const normalized = normalizeHost(host);
  if (!normalized) {
    throw new HttpError(400, 'Enter a valid mail server name, like imap.example.com.', 'HOST_NOT_ALLOWED');
  }
  if (allowPrivate) return { host: normalized, addresses: [] };

  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    throw new HttpError(400, NOT_ALLOWED_MESSAGE, 'HOST_NOT_ALLOWED');
  }

  const literalFamily = net.isIP(normalized);
  let addresses;
  if (literalFamily) {
    addresses = [{ address: normalized, family: literalFamily }];
  } else {
    try {
      addresses = await lookupAll(normalized);
    } catch (err) {
      const temporary = err && (err.code === 'EAI_AGAIN' || err.code === 'ETIMEOUT');
      throw new HttpError(
        400,
        temporary
          ? `Could not look up the mail server "${normalized}" right now (DNS lookup failed). Try again in a moment.`
          : `Could not find the mail server "${normalized}". Check the server name for typos.`,
        'HOST_NOT_FOUND'
      );
    }
  }
  if (!addresses || !addresses.length) {
    throw new HttpError(400, `Could not find the mail server "${normalized}". Check the server name for typos.`, 'HOST_NOT_FOUND');
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new HttpError(400, NOT_ALLOWED_MESSAGE, 'HOST_NOT_ALLOWED');
  }
  return { host: normalized, addresses };
}

module.exports = { assertAllowedHost, isPrivateAddress, normalizeHost, parseIPv6 };
