// Generated-media URLs as the browser sees them.
//
// Media models (fal) return public https links on their own CDN. If the browser loaded those links
// directly, the media host would learn every user's IP address and user agent. With the media proxy
// on (MEDIA_PROXY, default), Gode stores the upstream URL inside the encrypted message and hands the
// browser a same-origin link instead: GET /api/media/<message id>/<index>, which checks ownership and
// streams the file through the server. data: URLs (OpenAI images) are already inline and pass through.
"use strict";

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
 * The URL to give the browser for media item `index` of assistant message `messageId`.
 * @param {object} config     uses config.privacy.mediaProxy and config.privacy.mediaProxyHosts
 * @param {string} messageId
 * @param {number} index
 * @param {string} url        the upstream URL as stored
 */
function publicMediaUrl(config, messageId, index, url) {
  const privacy = (config && config.privacy) || {};
  if (typeof url !== "string") return url;
  if (url.startsWith("data:")) return url;
  if (privacy.mediaProxy && messageId && Number.isInteger(index) && index >= 0 && isProxyableUrl(url, privacy.mediaProxyHosts)) {
    return `/api/media/${encodeURIComponent(messageId)}/${index}`;
  }
  return url;
}

module.exports = { isProxyableUrl, publicMediaUrl };
