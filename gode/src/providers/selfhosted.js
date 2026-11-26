// Self-hosted OpenAI-compatible server (vLLM, Ollama, TGI, llama.cpp) for the private tier.
// Prompts sent here never leave infrastructure Gode controls, so there are no ZDR/routing fields.
const { createChatProvider } = require("./openaiCompatible");

/** Reasoning fields that the common open-weight servers understand. */
function reasoningFields(effort) {
  if (!effort) return {};
  const fields = { reasoning_effort: effort };
  // Qwen-style chat templates only switch thinking off through this template flag (vLLM/SGLang);
  // servers that don't know it ignore it.
  if (effort === "none") fields.chat_template_kwargs = { enable_thinking: false };
  return fields;
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
  });
}

module.exports = { createSelfhostedProvider };
