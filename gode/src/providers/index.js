// Provider registry: maps a model's gateway to the adapter that talks to it.
// In mock mode every gateway is served by the offline mock, so the app runs with no keys at all.
const { AppError } = require("../util");
const { createOpenRouterProvider } = require("./openrouter");
const { createOpenAIProvider } = require("./openai");
const { createSelfhostedProvider } = require("./selfhosted");
const { createFalProvider } = require("./fal");
const { createMockProvider } = require("./mock");

const GATEWAYS = ["openrouter", "openai", "selfhosted", "fal"];

/**
 * @param {object} config  loadConfig() result
 * @param {{ providers?: Record<string, object> }} [options]  test seam: replace adapters by gateway name
 */
function createProviders(config, { providers: overrides = {} } = {}) {
  const mock = overrides.mock || createMockProvider(config);
  const real = {
    openrouter: overrides.openrouter || createOpenRouterProvider(config),
    openai: overrides.openai || createOpenAIProvider(config),
    selfhosted: overrides.selfhosted || createSelfhostedProvider(config),
    fal: overrides.fal || createFalProvider(config),
  };

  /** The adapter for a gateway. Unconfigured gateways are returned too; their calls throw 503. */
  function get(gateway) {
    if (config.mock || gateway === "mock") return mock;
    const provider = real[gateway];
    if (!provider) throw new AppError(503, "gateway_not_configured", `Unknown gateway "${String(gateway).slice(0, 40)}"`);
    return provider;
  }

  /**
   * Can this model be called right now? Disabled models never are, whatever the mode. A configured
   * gateway can still be unavailable for a while: the self-hosted server after it failed to serve
   * (gateways.selfhosted.retryMs), so the picker applies PRIVATE_FALLBACK instead of sending every
   * private request into the outage.
   */
  function isAvailable(model) {
    if (!model || model.enabled === false || model.enabled === 0) return false;
    if (config.mock) return true;
    const provider = real[model.gateway];
    if (!provider) return false;
    return Boolean(typeof provider.available === "function" ? provider.available() : provider.configured());
  }

  /** Epoch ms until which a gateway counts as down after a failure to serve, or 0. */
  function downUntil(gateway) {
    if (config.mock) return 0;
    const provider = real[gateway];
    return provider && typeof provider.downUntil === "function" ? provider.downUntil() : 0;
  }

  /** { openrouter: bool, openai: bool, selfhosted: bool, fal: bool } for status pages. */
  function status() {
    return Object.fromEntries(GATEWAYS.map((g) => [g, Boolean(config.mock || real[g].configured())]));
  }

  return { get, isAvailable, downUntil, status, mock: Boolean(config.mock) };
}

module.exports = { createProviders, GATEWAYS };
