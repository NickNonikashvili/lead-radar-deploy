// Maps Gode's effort (none | low | medium | high) onto what a given model actually accepts.
// Upstreams differ: some reject 'none' (mandatory reasoning -> HTTP 400), some only know a subset of
// levels, and OpenAI direct returns 400 for any level the model does not list. The per-model
// capability lives in the catalog (model.params.reasoning), so this stays data-driven.

// Every level any upstream knows, lowest first. Our own vocabulary is a subset.
const EFFORT_RANK = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

function rankOf(effort) {
  return EFFORT_RANK.indexOf(effort);
}

/** Supported levels from the catalog, or null when the model doesn't publish a list. */
function supportedEfforts(model) {
  const list = model?.params?.reasoning?.efforts;
  if (!Array.isArray(list)) return null;
  const known = list.filter((e) => typeof e === "string" && rankOf(e) >= 0);
  return known.length ? known : null;
}

/** Nearest level by rank; ties go to the lower (cheaper) level. */
function nearest(effort, candidates) {
  const target = rankOf(effort);
  let best = null;
  for (const c of candidates) {
    const d = Math.abs(rankOf(c) - target);
    const bestD = best === null ? Infinity : Math.abs(rankOf(best) - target);
    if (d < bestD || (d === bestD && rankOf(c) < rankOf(best))) best = c;
  }
  return best;
}

/** Lowest level a mandatory-reasoning model accepts when the caller asked for no thinking. */
function lowestForMandatory(efforts) {
  if (!efforts) {
    // No published list: 'low' is the one level every reasoning API we use accepts ('minimal' is an
    // OpenAI-only level that some OpenAI models reject).
    return "low";
  }
  if (efforts.includes("minimal")) return "minimal";
  if (efforts.includes("low")) return "low";
  const levels = efforts.filter((e) => e !== "none").sort((a, b) => rankOf(a) - rankOf(b));
  return levels[0] || "low";
}

/**
 * @param {object} model  Model row (supports_reasoning, params.reasoning = { mandatory, efforts })
 * @param {string|null|undefined} effort  Gode effort; null/undefined = no preference (upstream default)
 * @returns {string|null} the level to send upstream, or null to send no reasoning parameter at all
 */
function resolveEffort(model, effort) {
  if (!model || !model.supports_reasoning) return null;
  if (effort === undefined || effort === null || effort === "") return null;
  if (typeof effort !== "string" || rankOf(effort) < 0) {
    throw new TypeError(`resolveEffort: unknown effort "${String(effort)}"`);
  }
  const mandatory = Boolean(model.params?.reasoning?.mandatory);
  const efforts = supportedEfforts(model);

  if (effort === "none") return mandatory ? lowestForMandatory(efforts) : "none";
  if (!efforts || efforts.includes(effort)) return effort;
  // Asked for some thinking: never silently turn it off by snapping to 'none' (e.g. Mistral's
  // [high, none] would tie 'low' between the two).
  const thinking = efforts.filter((e) => e !== "none");
  return nearest(effort, thinking.length ? thinking : efforts);
}

module.exports = { resolveEffort, EFFORT_RANK };
