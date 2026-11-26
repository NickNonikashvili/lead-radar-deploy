// OpenRouter gateway: one key for most text/code models. See docs/ARCHITECTURE.md "Providers".
const { createChatProvider } = require("./openaiCompatible");

const SESSION_ID_MAX = 256; // OpenRouter's documented limit

/** Fields shared by chat and JSON requests: reasoning effort and the ZDR routing restriction. */
function routingFields({ zdr }, effort) {
  const fields = {};
  // resolveEffort already returns null for models without reasoning support: send nothing then.
  if (effort) fields.reasoning = { effort };
  // Only zero-retention endpoints that also don't collect data; OpenRouter errors if none qualify,
  // which is what we want (never silently fall back to a retaining host).
  if (zdr) fields.provider = { zdr: true, data_collection: "deny" };
  return fields;
}

function createOpenRouterProvider(config) {
  const gw = config.gateways.openrouter;
  return createChatProvider({
    name: "openrouter",
    configured: () => Boolean(gw.apiKey),
    baseUrl: () => gw.baseUrl,
    headers: () => ({
      Authorization: `Bearer ${gw.apiKey}`,
      "HTTP-Referer": config.publicUrl,
      "X-OpenRouter-Title": "Gode",
      "X-Title": "Gode", // legacy name of the same attribution header
    }),
    chatFields: (args, effort) => {
      const fields = routingFields(args, effort);
      // Opaque per-conversation id (never a user id): keeps one provider warm for prompt caching.
      if (typeof args.sessionId === "string" && args.sessionId) {
        fields.session_id = args.sessionId.slice(0, SESSION_ID_MAX);
      }
      return fields;
    },
    jsonFields: (args, effort) => routingFields(args, effort),
  });
}

module.exports = { createOpenRouterProvider };
