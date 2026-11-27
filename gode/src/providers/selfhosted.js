// Self-hosted OpenAI-compatible server (vLLM, Ollama, TGI, llama.cpp) for the private tier.
// Prompts sent here never leave infrastructure Gode controls, so there are no ZDR/routing fields.
const { createChatProvider } = require("./openaiCompatible");

/**
 * Reasoning fields that the common open-weight servers understand.
 * - 'none': thinking off through the chat-template flag that Qwen-style templates read
 *   (vLLM/SGLang); servers that don't know it ignore it. reasoning_effort is left out, because
 *   vLLM validates it against low|medium|high and may reject 'none' with a 400.
 * - any other effort: reasoning_effort as resolved for the model.
 */
function reasoningFields(effort) {
  if (!effort) return {};
  if (effort === "none") return { chat_template_kwargs: { enable_thinking: false } };
  return { reasoning_effort: effort };
}

function createSelfhostedProvider(config) {
  const gw = config.gateways.selfhosted;
  return createChatProvider({
    name: "selfhosted",
    configured: () => Boolean(gw.baseUrl),
    baseUrl: () => gw.baseUrl,
    // The API key is optional: many in-cluster servers run without one.
    headers: () => (gw.apiKey ? { Authorization: `Bearer ${gw.apiKey}` } : {}),
    // max_tokens is the one output limit every OpenAI-compatible server accepts.
    maxTokensLegacy: true,
    chatFields: (args, effort) => ({ stream_options: { include_usage: true }, ...reasoningFields(effort) }),
    jsonFields: (args, effort) => reasoningFields(effort),
    defaultUpstreamProvider: "self-hosted",
    timeouts: () => config.gateways.timeouts,
    // One server: a failure to serve means it is down, so private requests use PRIVATE_FALLBACK
    // (via the registry's isAvailable) instead of failing one after another.
    outageRetryMs: () => gw.retryMs ?? 30_000,
  });
}

module.exports = { createSelfhostedProvider };
