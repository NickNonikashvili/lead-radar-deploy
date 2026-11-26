// OpenRouter gateway: one key for most text/code models. See docs/ARCHITECTURE.md "Providers".
const { createChatProvider } = require("./openaiCompatible");

const SESSION_ID_MAX = 256; // OpenRouter's documented limit

// OpenRouter provider-routing keys a catalog entry may pin in params.openrouter_provider, with the
// type each must have. Example: EU models pinned to the vendor's own EU endpoint with
// { only: ["mistral"], allow_fallbacks: false }, so region 'eu' holds for every request.
// (Field list from OpenRouter's provider-routing docs, Nov 2026.)
const isStringList = (v) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s.length > 0 && s.length <= 100);
const isBool = (v) => typeof v === "boolean";
const isPlainObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const isNumberOrObject = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0) || isPlainObject(v);
const PROVIDER_PREF_TYPES = {
  only: isStringList,
  order: isStringList,
  ignore: isStringList,
  quantizations: isStringList,
  allow_fallbacks: isBool,
  require_parameters: isBool,
  zdr: isBool,
  enforce_distillable_text: isBool,
  data_collection: (v) => v === "allow" || v === "deny",
  sort: (v) => (typeof v === "string" && /^[a-z_]{1,32}$/.test(v)) || isPlainObject(v),
  preferred_min_throughput: isNumberOrObject,
  preferred_max_latency: isNumberOrObject,
  max_price: isPlainObject,
};

/**
 * The catalog's provider pin for `model` (params.openrouter_provider), validated. Fails closed: a
 * misspelled key or a wrong type throws instead of being dropped, because dropping `only` would
 * silently send an EU-only request to any host. Exported so admin routes can validate edits.
 * @returns {object} a copy of the pin, or {} when the model has none
 */
function providerPreferences(model) {
  const pref = model?.params?.openrouter_provider;
  if (pref === undefined || pref === null) return {};
  if (typeof pref !== "object" || Array.isArray(pref)) throw new TypeError("params.openrouter_provider must be an object");
  const out = {};
  for (const [key, value] of Object.entries(pref)) {
    const valid = Object.hasOwn(PROVIDER_PREF_TYPES, key) ? PROVIDER_PREF_TYPES[key] : null;
    if (!valid) throw new TypeError(`params.openrouter_provider.${key.slice(0, 40)} is not a supported provider setting`);
    if (!valid(value)) throw new TypeError(`params.openrouter_provider.${key} has the wrong type`);
    out[key] = Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value;
  }
  return out;
}

/**
 * Fields shared by chat and JSON requests: reasoning effort and the `provider` routing object.
 * `provider` is the ONLY place catalog routing params go; model.params is never spread into the body.
 */
function routingFields({ model, zdr }, effort) {
  const fields = {};
  // resolveEffort already returns null for models without reasoning support: send nothing then.
  if (effort) fields.reasoning = { effort };
  const provider = providerPreferences(model);
  if (zdr) {
    // Only zero-retention endpoints that also don't collect data; OpenRouter errors if none qualify,
    // which is what we want (never silently fall back to a retaining host). Applied after the
    // catalog pin, so a pin can narrow the hosts further but never weaken this.
    provider.zdr = true;
    provider.data_collection = "deny";
  }
  if (Object.keys(provider).length) fields.provider = provider;
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

module.exports = { createOpenRouterProvider, providerPreferences };
