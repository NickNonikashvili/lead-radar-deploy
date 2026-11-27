// Generated-media URLs as the browser sees them.
//
// Media models (fal) return public https links on their own CDN. If the browser loaded those links
// directly, the media host would learn every user's IP address and user agent. With the media proxy
// on (MEDIA_PROXY, default), Gode stores the upstream URL inside the encrypted message and hands the
// browser a same-origin link instead: GET /api/media/<message id>/<index>, which checks ownership and
// streams the file through the server. data: URLs (OpenAI images) are already inline and pass through.
// With the proxy on, a link on a host outside MEDIA_PROXY_HOSTS is not handed out at all (null): the
// page's CSP only loads media from 'self', data: and blob:, and loading it directly would show that
// host the viewer's IP. The UI then says the file can't be shown, and the host is logged once.
"use strict";

// Hosts already reported, so a chat with many such files logs one line per host per process.
const warnedHosts = new Set();
const MAX_WARNED_HOSTS = 100;

function warnUnlistedHost(url, logger) {
  let host = "invalid URL";
  try {
    host = new URL(String(url)).hostname.toLowerCase() || host;
  } catch {
    // keep the placeholder
  }
  if (warnedHosts.has(host) || warnedHosts.size >= MAX_WARNED_HOSTS) return;
  warnedHosts.add(host);
  // The host only: the path of a media link can identify the generation.
  logger?.warn?.(`[media] a generated file is on ${host}, which is not in MEDIA_PROXY_HOSTS; it is not shown`);
}

/** True when `url` is an https URL on one of `hosts` (or a subdomain of one). */
function isProxyableUrl(url, hosts) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return (hosts || []).some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * The URL to give the browser for media item `index` of assistant message `messageId`, or null when
 * the proxy is on and the file is on a host it may not fetch from (see the header).
 * @param {object} config     uses config.privacy.mediaProxy and config.privacy.mediaProxyHosts
 * @param {string} messageId
 * @param {number} index
 * @param {string} url        the upstream URL as stored
 * @param {{ logger?: { warn: Function } }} [opts]  where an unlisted host is reported (once)
 */
function publicMediaUrl(config, messageId, index, url, { logger = console } = {}) {
  const privacy = (config && config.privacy) || {};
  if (typeof url !== "string") return url;
  if (url.startsWith("data:")) return url;
  if (!privacy.mediaProxy) return url;
  if (messageId && Number.isInteger(index) && index >= 0 && isProxyableUrl(url, privacy.mediaProxyHosts)) {
    return `/api/media/${encodeURIComponent(messageId)}/${index}`;
  }
  warnUnlistedHost(url, logger);
  return null;
}

module.exports = { isProxyableUrl, publicMediaUrl };
