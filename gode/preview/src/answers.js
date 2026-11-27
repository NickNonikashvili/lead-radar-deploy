"use strict";
// What the preview "models" say. No AI model is called: each answer is written here, honestly
// says so, and explains what the live app would have done with the message (which model, why,
// effort, privacy, what was hidden) using the real routing decision the pipeline just made.
//
// Placeholders such as [PERSON_1] in the text the model would receive are shown as ‹name 1›:
// written as [PERSON_1], the pipeline's stream restorer would put the real value back, which is
// exactly what it does for a real model's answer.

const { chooseTier, difficultyToEffort } = require("../../src/router/effort");
const { expectedOutputTokens, providerCostMicros, formatCost } = require("../../src/chat/pipeline");
const { estimateTokens } = require("../../src/util");
const { isEditFollowUp } = require("./follow-up");

const PLAN_NAME = { saver: "Saver", balanced: "Balanced", best: "Best" };
const JOB_NAME = { chat: "Chat", code: "Code", image: "Image", video: "Video", music: "Music", voice: "Voice", action: "Action" };
const REGION = { us: "US", eu: "EU", cn: "China", self: "our servers" };
const TYPE_WORDS = {
  PERSON: ["name", "names"],
  EMAIL: ["email address", "email addresses"],
  PHONE: ["phone number", "phone numbers"],
  CARD: ["card number", "card numbers"],
  IBAN: ["IBAN", "IBANs"],
  SSN: ["ID number", "ID numbers"],
  IP: ["IP address", "IP addresses"],
  LOCATION: ["place", "places"],
  PASSPORT: ["passport number", "passport numbers"],
  LICENSE: ["license number", "license numbers"],
  BANK_ACCOUNT: ["bank account number", "bank account numbers"],
  CRYPTO: ["wallet address", "wallet addresses"],
  SECRET: ["secret", "secrets"],
};
const SHORT_WORD = { PERSON: "name", EMAIL: "email", PHONE: "phone", CARD: "card", IBAN: "IBAN", SSN: "ID", IP: "IP", LOCATION: "place", PASSPORT: "passport", LICENSE: "license", BANK_ACCOUNT: "account", CRYPTO: "wallet", SECRET: "secret" };

const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
const trimNum = (n) => String(Number(Number(n).toFixed(4)));

function listPhrase(items) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

/** {"PERSON":1,"EMAIL":2} -> "1 name and 2 email addresses" ("" when nothing was hidden). */
function hiddenPhrase(counts) {
  const parts = [];
  for (const [type, n] of Object.entries(counts || {})) {
    const k = Number(n);
    if (!(k > 0)) continue;
    const words = TYPE_WORDS[type] || ["personal detail", "personal details"];
    parts.push(`${k} ${k === 1 ? words[0] : words[1]}`);
  }
  return listPhrase(parts);
}

/**
 * " (it gets placeholders of the form [EMAIL_n], shown here as ‹email 1›)" for the first hidden
 * type, or "". Written with "n", not a number: a real placeholder in this answer would be filled
 * back in by the pipeline's restorer (its pattern needs digits).
 */
function placeholderNote(counts) {
  const type = Object.keys(counts || {}).find((t) => Number(counts[t]) > 0);
  if (!type) return "";
  return ` (it gets placeholders of the form [${type}_n], shown here as ‹${SHORT_WORD[type] || type.toLowerCase()} 1›)`;
}

/** "[PERSON_1]" -> "‹name 1›": shows what the model gets without the restorer filling it in. */
function showPlaceholders(text) {
  return String(text || "").replace(/\[([A-Z][A-Z_]*)_(\d+)\]/g, (_m, type, n) => `‹${SHORT_WORD[type] || type.toLowerCase()} ${n}›`);
}

function quote(text, max = 320) {
  let t = showPlaceholders(text).replace(/\s+/g, " ").trim();
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + "…";
  // Markdown that would change the quote's look is shown as typed.
  return "> " + t.replace(/([*_`~[\]\\])/g, "\\$1");
}

function effortWords(effort) {
  return !effort || effort === "none" ? "no thinking" : `${effort} effort`;
}

function effortLevel(effort) {
  return !effort || effort === "none" ? "none (no thinking)" : effort;
}

/**
 * " (DeepSeek, China)". A request that needs zero retention goes only to the model's
 * zero-retention hosts, which the privacy page names: for a model whose worst-case region (where
 * ordinary requests may be served, e.g. the vendor's own platform) is elsewhere, say that instead.
 */
function modelFacts(model, route) {
  const region = REGION[model.region] || model.region;
  if (route && route.zdr && model.zdr && model.region && !["eu", "us", "self"].includes(model.region)) {
    return ` (${[model.vendor, "through its zero-retention hosts only, which the privacy page names"].filter(Boolean).join("; ")})`;
  }
  const bits = [model.vendor, region].filter(Boolean);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

function lengthFor(difficulty) {
  const d = Number(difficulty) || 3;
  return d <= 2 ? "short" : d === 3 ? "medium" : "long";
}

const REASONING_SHARE = { none: 0, low: 300, medium: 1000, high: 2500 };

/**
 * Token counts the live answer would bill (the chip's cost is computed by the pipeline from
 * these at the model's catalog price): the input sent, plus a typical answer for the difficulty
 * and the reasoning allowance of the effort, never more than the request's max_tokens.
 */
function simulatedUsage({ messages, difficulty, effort, maxTokens, model }) {
  const inputTokens = estimateTokens((messages || []).map((m) => (m && m.content) || "").join("\n"));
  const reasoning = model && model.supports_reasoning ? REASONING_SHARE[effort] || 0 : 0;
  const outputTokens = expectedOutputTokens(lengthFor(difficulty), model && model.supports_reasoning ? effort : "none", maxTokens);
  return { inputTokens, outputTokens, reasoningTokens: Math.min(reasoning, outputTokens) };
}

const MEDIA_JOBS = new Set(["image", "video", "music", "voice"]);
const FALLBACK_PHRASE = { budget: "the cheapest", balanced: "a mid-priced", quality: "the highest-priced" };
// Redaction types that make a request private on their own (src/redact/patterns.js HIGH_RISK_TYPES).
const HIGH_RISK = ["CARD", "IBAN", "SSN", "BANK_ACCOUNT", "PASSPORT", "SECRET"];

const isAre = (list) => (list.length > 1 ? "are" : "is");

/** The privacy filters this user has on, by their Settings names. */
function filtersOn(user) {
  return [user && user.strict_privacy && "Strict privacy", user && user.eu_only && "EU-only"].filter(Boolean);
}

/** " (Strict privacy and EU-only are on)", or "" with no filter on. */
function filterNote(user) {
  const f = filtersOn(user);
  return f.length ? ` (${listPhrase(f)} ${isAre(f)} on)` : "";
}

/**
 * Why this model answers, from the routing decision the pipeline just made (the route event), the
 * conversation's pins before the turn (ctx.pinSource) and the routing table (ctx.routedModel).
 * Mirrors src/router/pick.js: a pick by hand, a private pick, a kept pin, the plan's column, the
 * nearest other column, or (no routed pick usable) a model chosen by price among those that qualify.
 */
function why(args) {
  const reason = whyPicked(args);
  // Phase 1 has no Action column: action requests are routed with the Chat row.
  return args.route && args.route.job === "action" && /\bfor chat\b/.test(reason) ? `${reason} (action requests use the Chat row in phase 1)` : reason;
}

function whyPicked({ route, mode, user, model, ctx }) {
  const plan = PLAN_NAME[user.plan] || "Balanced";
  const job = route.job === "action" ? "chat" : route.job;
  const media = MEDIA_JOBS.has(job);
  const wanted = chooseTier({ job, difficulty: route.difficulty, plan: user.plan });
  const tier = route.tier;
  const userPin = Boolean(ctx && ctx.pinSource === "user");
  const table = Boolean(ctx && typeof ctx.routedModel === "function");
  const routed = (t) => (table ? ctx.routedModel(job, t) : null);
  if (mode === "switch") return `you picked it from the switch menu, so it is pinned for this chat`;
  if (mode === "manual") return `auto-pick is off, so you chose it`;
  if (mode === "regenerate" && route.pinned) return `regenerated with the model pinned to this chat${userPin ? " (your pick)" : ""}`;
  const again = mode === "regenerate" ? " (picked again for the regenerate)" : "";
  if (tier === "private") {
    if (route.pinned && userPin) return `this private chat keeps your own pick, which may receive private requests`;
    if (route.pinned) return `this private chat keeps the zero-retention model it started with`;
    const own = routed("private");
    if (own && own.id === model.id) {
      if (media && !model.zdr) return `the private pick for ${job}; no ${job} model offers zero retention, so personal details are taken out of the prompt first${again}`;
      return `the private pick for ${job}${again}`;
    }
    return `private requests need a zero-retention or self-hosted model, and this deployment runs no model of its own, so a zero-retention model from the routing table (${wanted} column first) answers${again}`;
  }
  if (route.pinned) return `one model per chat, and this conversation is pinned to it${userPin ? " (your pick)" : ""}`;
  const at = media ? "" : ` at difficulty ${route.difficulty}`;
  const cell = routed(tier);
  if (table && !(cell && cell.id === model.id)) {
    // pickAuto's last step: no routed pick can be used, so one is chosen by price (byTierPrice).
    return `no routed pick for ${job} can be used here${filterNote(user)}, so ${FALLBACK_PHRASE[tier] || "the cheapest"} model that qualifies answers (your ${plan} plan${at} asks for the ${tier} column)${again}`;
  }
  if (tier === wanted) return `the ${tier} pick for ${job}${at} on your ${plan} plan${again}`;
  const w = routed(wanted);
  return `the ${tier} pick for ${job}; the ${wanted} pick${w ? ` (${w.label})` : ""} can't be used here${filterNote(user)}${again}`;
}

// The sensitive topics of src/router/classify.js PERSONAL_TERMS / SECRET_TERMS, by kind: the answer
// names the one this request is about instead of the whole list.
const TOPICS = [
  ["health", /\b(?:diagnos(?:is|es|ed)|medical|medications?|prescriptions?|therap(?:y|ist)|psychiatr\w*|mental health|hiv|lab results?|blood test results?|health records?)\b/gi],
  ["money", /\b(?:salary|salaries|payslips?|pay ?stubs?|bank statements?|bank account numbers?|credit score|tax returns?)\b/gi],
  ["legal matters", /\b(?:lawsuits?|divorce|custody|criminal record|immigration status|restraining order)\b/gi],
  ["identity documents", /\b(?:social security numbers?|passport numbers?)\b/gi],
  ["secrets", /\b(?:seed phrase|recovery phrase|passwords?|passcodes?|private keys?|2fa codes?|confidential)\b/gi],
];

/** "someone's health (“HIV”, “diagnosed”)", or null when no topic word is in the text. */
function topicPhrase(text) {
  const found = [];
  for (const [topic, re] of TOPICS) {
    const words = [...new Set((String(text || "").match(re) || []).map((w) => w.toLowerCase()))];
    if (words.length) found.push({ topic, words });
  }
  if (!found.length) return null;
  const quoted = found.flatMap((f) => f.words).slice(0, 2).map((w) => `“${/^hiv$/.test(w) ? "HIV" : w}”`);
  return `someone's ${listPhrase(found.map((f) => f.topic))} (${quoted.join(", ")})`;
}

function privacyLine({ route, model, user, ctx, text }) {
  // route.zdr: the router required zero retention for this answer (private or strict privacy).
  const enforced = route.zdr ? `${model.label} only gets it through zero-retention endpoints, so the provider keeps nothing` : null;
  if (route.private) {
    let lead;
    if (ctx && ctx.conversationWasPrivate) lead = "This chat became private earlier, so it stays private.";
    else {
      const risky = hiddenPhrase(Object.fromEntries(HIGH_RISK.map((t) => [t, (route.redactions || {})[t]])));
      const topic = risky ? null : topicPhrase(text);
      lead = risky
        ? `Private: it contains ${risky}, and that alone makes a request private.`
        : topic
          ? `Private: it is about ${topic}.`
          : "Private: it is about someone's health, money, legal matters or secrets.";
    }
    return `${lead} Only zero-retention or self-hosted models may answer; ${enforced || `${model.label} was the private pick`}.`;
  }
  if (user.strict_privacy) return `Strict privacy is on, so only zero-retention models may answer; ${enforced || `${model.label} was allowed`}.`;
  if (model.zdr) return `Not private, so zero retention is not required and any of ${model.label}'s providers may serve it.`;
  return `Not private. ${model.label} is not a zero-retention model, so private requests never go to it.`;
}

/**
 * Who read the message to route it. ctx.classifier (preview/src/backend.js) says why Gode's own
 * rules did it when they did: the message or the chat is private (no outside classifier may see
 * it), or a privacy filter excludes every classifier model.
 */
function classifierLine(route, ctx) {
  const c = (ctx && ctx.classifier) || {};
  if (route.classifier_model === "heuristic") {
    const base = "Gode's own rules, on our servers";
    if (c.reason === "private_chat") return `${base}: this chat is private, so its messages never go to an outside classifier.`;
    if (c.reason === "private" || (route.private && !c.reason)) return `${base} (a message our checks call private never goes to an outside classifier).`;
    if (c.reason === "filters" && c.filters && c.filters.length) {
      return `${base}: ${listPhrase(c.filters)} ${isAre(c.filters)} on, and the classifier model${c.label ? ` (${c.label})` : ""} doesn't meet ${c.filters.length > 1 ? "them" : "it"}, so the message stayed in-house.`;
    }
    return `${base}.`;
  }
  if (!route.classifier_model) return "the earlier decision for this question is reused (regenerate and switch don't classify again).";
  return `${route.classifier_label} read the message first, with personal details removed (in this preview, Gode's built-in rules stood in for it).`;
}

// The language a coding request names, in the order they are tested (C# and C++ before C, TypeScript
// before JavaScript). Go, C and R are also ordinary words, so they count only next to a coding word
// ("a Go function", "in C", "an R script").
const CODE_WORDS = "function|program|code|script|snippet|struct|module|package|library|class|method|implementation|example|file|app|cli|server|service|test|routine|func|macro|header|pointer|query";
const LANGUAGES = [
  ["typescript", /\btypescript\b|\bts\b/],
  ["javascript", /\bjavascript\b|\bnode(\.js)?\b|\breact\b|\bjs\b/],
  ["html", /\bhtml\b|<\/?[a-z][a-z0-9]*\b[^>]*>/],
  ["css", /\bcss\b|\bflexbox\b|\bstylesheet\b/],
  ["sql", /\bsql\b|\bpostgres|\bmysql\b|\bsqlite\b|\bquery\b/],
  ["bash", /\bbash\b|\bshell\b|\bscript to\b.*\b(files?|folder)\b/],
  ["csharp", /(?:^|[^a-z0-9])c#|\bc sharp\b|\bcsharp\b|\.net\b|\bdotnet\b/],
  ["cpp", /(?:^|[^a-z0-9])c\+\+|\bcpp\b/],
  ["objectivec", /\bobjective-?c\b/],
  ["c", new RegExp(`\\b(?:in|using|with|written in|ansi) c\\b(?![+#])|\\bc (?:${CODE_WORDS})s?\\b`)],
  ["go", new RegExp(`\\bgolang\\b|\\bgoroutines?\\b|\\b(?:in|using|with|written in) go\\b|\\bgo (?:${CODE_WORDS})s?\\b`)],
  ["rust", /\brust\b|\bcargo\b/],
  ["kotlin", /\bkotlin\b/],
  ["java", /\bjava\b|\bspring boot\b/],
  ["swift", /\bswift(?:ui)?\b/],
  ["php", /\bphp\b|\blaravel\b/],
  ["ruby", /\bruby\b|\brails\b/],
  ["python", /\bpython\b|\bpandas\b|\bdjango\b|\bflask\b/],
  // Named languages without a skeleton of their own: a plain fence with the language's comment.
  ["haskell", /\bhaskell\b/],
  ["scala", /\bscala\b/],
  ["elixir", /\belixir\b/],
  ["erlang", /\berlang\b/],
  ["clojure", /\bclojure\b/],
  ["lua", /\blua\b/],
  ["perl", /\bperl\b/],
  ["dart", /\bdart\b|\bflutter\b/],
  ["zig", /\bzig\b/],
  ["julia", new RegExp(`\\b(?:in|using|with) julia\\b|\\bjulia (?:${CODE_WORDS})s?\\b`)],
  ["r", new RegExp(`\\b(?:in|using|with|written in) r\\b|\\br (?:${CODE_WORDS})s?\\b|\\bggplot2?\\b|\\bdplyr\\b|\\btidyverse\\b`)],
  ["matlab", /\bmatlab\b|\boctave\b/],
  ["powershell", /\bpowershell\b/],
  ["fortran", /\bfortran\b/],
  ["fsharp", /(?:^|[^a-z0-9])f#|\bfsharp\b/],
  ["ocaml", /\bocaml\b/],
  ["solidity", /\bsolidity\b/],
];
// The comment of each language that has no skeleton of its own.
const LINE_COMMENT = { haskell: "--", lua: "--", elixir: "#", perl: "#", r: "#", julia: "#", powershell: "#", erlang: "%", matlab: "%", clojure: ";;", fortran: "!", scala: "//", dart: "//", zig: "//", fsharp: "//", objectivec: "//", solidity: "//", ocaml: "(*" };

/** The language a coding request names, or null. */
function namedLanguage(text) {
  const t = String(text || "").toLowerCase();
  for (const [lang, re] of LANGUAGES) if (re.test(t)) return lang;
  return null;
}

/** The language a coding request asks for, or "python" when it names none. */
function detectLanguage(text) {
  return namedLanguage(text) || "python";
}

const PHOTO_RENAMER = [
  "```python",
  "# rename_photos.py: rename photos to the date they were taken (EXIF), e.g. 2026-07-14_09-31-02.jpg",
  "import sys",
  "from datetime import datetime",
  "from pathlib import Path",
  "",
  "from PIL import Image  # pip install pillow",
  "",
  "DATE_TAKEN = 36867  # EXIF DateTimeOriginal",
  "",
  "",
  "def taken_at(path: Path) -> datetime | None:",
  "    with Image.open(path) as img:",
  "        raw = img.getexif().get_ifd(0x8769).get(DATE_TAKEN)",
  '    return datetime.strptime(raw, "%Y:%m:%d %H:%M:%S") if raw else None',
  "",
  "",
  "def main(folder: str) -> None:",
  '    for path in sorted(Path(folder).glob("*.[jJ][pP]*[gG]")):',
  "        when = taken_at(path)",
  "        if not when:",
  '            print(f"skipped {path.name}: no date taken")',
  "            continue",
  '        stem, suffix = when.strftime("%Y-%m-%d_%H-%M-%S"), path.suffix.lower()',
  "        target = path.with_name(stem + suffix)",
  "        n = 1",
  "        while target.exists() and target != path:  # two photos in the same second",
  '            target = path.with_name(f"{stem}_{n}{suffix}")',
  "            n += 1",
  "        if target == path:",
  "            continue  # already named after its date",
  "        path.rename(target)",
  '        print(f"{path.name} -> {target.name}")',
  "",
  "",
  'if __name__ == "__main__":',
  '    main(sys.argv[1] if len(sys.argv) > 1 else ".")',
  "```",
].join("\n");

// Words of a coding request that name the task: "a function that debounces another function" ->
// ["debounce"], "how do I reverse a linked list in JavaScript?" -> ["reverse", "linked", "list"],
// "a function that checks if a string is a palindrome" -> ["is", "palindrome"].
const SKIP_WORDS = new Set(["a", "an", "the", "my", "our", "your", "some", "another", "this", "that", "these", "those", "of", "me", "it", "i", "to", "simple", "small", "quick", "new"]);
const STOP_AT = new Set(["in", "with", "for", "using", "on", "from", "by", "and", "or", "so", "but", "into", "via", "without", "as", "like", "than", "then", "please", "which", "that", "when", "if", "whether"]);
const GENERIC_NOUNS = new Set(["function", "functions", "method", "code", "script", "program", "snippet", "class", "one", "something", "thing", "helper"]);
// Language names, removed before the task words are read. Go, C and R only next to a coding word.
const LANGUAGE_WORDS = new RegExp(
  `(?:^|\\s)(?:c\\+\\+|c#|f#)(?=[\\s.,;:!?]|$)|\\b(?:python|javascript|typescript|js|ts|node(?:\\.js)?|react|sql|bash|shell|golang|rust|java|kotlin|swift|php|ruby|html|css|haskell|scala|elixir|lua|perl|dart|matlab|powershell)\\b|\\b(?:in|using|with) (?:go|c|r|julia)\\b|\\b(?:go|c|r|julia)(?= (?:${CODE_WORDS})s?\\b)`,
  "g"
);
// Subjects too general to name the function after: "checks if a number is prime" -> is_prime.
const GENERIC_SUBJECTS = new Set(["number", "string", "word", "value", "input", "text", "list", "array", "year", "date", "it", "something", "thing", "given"]);

function baseVerb(word) {
  if (/(?:ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (/[^aeiou]ies$/.test(word)) return word.slice(0, -3) + "y";
  if (/[^su]s$/.test(word) && word.length > 3) return word.slice(0, -1);
  return word;
}

/** "checks if a string is a palindrome" -> ["is", "palindrome"]; "...whether an email is valid" -> ["is", "valid", "email"]. */
function predicateWords(t) {
  const m = /\b(?:checks?|tests?|determines?|tells?|detects?|validates?|verif(?:y|ies)|sees?|finds? out|returns? (?:true|whether)|is)\s+(?:if|whether)\s+(?:a|an|the|this|that|my|some|each|every|given)?\s*([a-z]+)\s+(is|are|has|have|contains?)\s+(an?\s+|the\s+)?([a-z]+)(?:\s+([a-z]+))?/.exec(t);
  if (!m) return null;
  const [, subject, verb, article, first, second] = m;
  const verbWord = verb === "has" || verb === "have" ? "has" : verb.startsWith("contain") ? "contains" : "is";
  const out = [verbWord, first];
  if (second && !STOP_AT.has(second) && !SKIP_WORDS.has(second) && !GENERIC_NOUNS.has(second)) out.push(second);
  // "an email is valid" -> is_valid_email; "a string is a palindrome" -> is_palindrome.
  if (!article && out.length === 2 && !GENERIC_SUBJECTS.has(subject) && !SKIP_WORDS.has(subject)) out.push(subject);
  return out.filter((w) => /^[a-z]/.test(w)).slice(0, 3);
}

function taskWords(text) {
  const t = showPlaceholders(text).toLowerCase().replace(LANGUAGE_WORDS, " ");
  const predicate = predicateWords(t);
  if (predicate && predicate.length >= 2) return predicate;
  const m =
    /\b(?:function|method|script|program|code|class|query|helper)\s+(?:that|which|to)\s+([^.,;:!?\n]+)/.exec(t) ||
    /\bhow (?:do|can|could|would|should) (?:i|we|you)\s+([^.,;:!?\n]+)/.exec(t) ||
    /\b(?:write|implement|build|create|make|code)\s+(?:me\s+)?([^.,;:!?\n]+)/.exec(t);
  if (!m) return [];
  const out = [];
  for (const raw of m[1].split(/\s+/)) {
    const w = raw.replace(/[^a-z0-9]/g, "");
    if (!w) continue;
    if (out.length && STOP_AT.has(w)) break;
    if (SKIP_WORDS.has(w) || GENERIC_NOUNS.has(w) || STOP_AT.has(w)) continue;
    out.push(out.length ? w : baseVerb(w));
    if (out.length === 3) break;
  }
  return out.filter((w) => /^[a-z]/.test(w));
}

const camel = (words) => (words.length ? words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("") : "main");
const snake = (words) => (words.length ? words.join("_") : "main");

/** The request as a one-line code comment: at most `max` characters, cut at a word, no markdown. */
function commentTitle(text, max = 70) {
  let t = showPlaceholders(text).replace(/\s+/g, " ").trim().replace(/\*\*|__|`+/g, "");
  if (t.length > max) {
    const cut = t.slice(0, max + 1);
    const space = cut.lastIndexOf(" ");
    t = (space > max / 2 ? cut.slice(0, space) : t.slice(0, max)).replace(/[\s,;:.-]+$/, "") + "…";
  }
  return t;
}

const TODO = "the live model writes the real implementation here";
const pascal = (words) => (words.length ? words.map((w) => w[0].toUpperCase() + w.slice(1)).join("") : "Run");
/** A name like is_palindrome / hasCycle: the function answers yes or no. */
const isPredicate = (w) => w.length > 1 && ["is", "has", "contains", "can", "should"].includes(w[0]);

// The skeleton function's one parameter, from the thing the request works on: "checks if a string
// is a palindrome" takes a string, "sorts a list" a list, "is a number prime" a number, "reads a
// file" a path; anything else a value. Each kind has its declaration in every language with a
// skeleton, and a sample argument for the call under it.
const PARAMS = {
  string: {
    name: "s", sample: '"racecar"',
    decl: { python: "s: str", javascript: "s", typescript: "s: string", go: "s string", rust: "s: &str", java: "String s", c: "const char *s", cpp: "const std::string& s", csharp: "string s", kotlin: "s: String", swift: "_ s: String", php: "string $s", ruby: "s" },
    arg: { php: '"racecar"' },
  },
  list: {
    name: "items", sample: "[3, 1, 2]",
    decl: { python: "items: list", javascript: "items", typescript: "items: number[]", go: "items []int", rust: "items: &[i64]", java: "int[] items", c: "const int *items, size_t n", cpp: "const std::vector<int>& items", csharp: "int[] items", kotlin: "items: List<Int>", swift: "_ items: [Int]", php: "array $items", ruby: "items" },
    arg: { go: "[]int{3, 1, 2}", rust: "&[3, 1, 2]", java: "new int[] {3, 1, 2}", c: "(int[]){3, 1, 2}, 3", cpp: "{3, 1, 2}", csharp: "new[] { 3, 1, 2 }", kotlin: "listOf(3, 1, 2)" },
  },
  number: {
    name: "n", sample: "42",
    decl: { python: "n: int", javascript: "n", typescript: "n: number", go: "n int", rust: "n: i64", java: "long n", c: "long n", cpp: "long n", csharp: "long n", kotlin: "n: Long", swift: "_ n: Int", php: "int $n", ruby: "n" },
    arg: {},
  },
  path: {
    name: "path", sample: '"photos"',
    decl: { python: "path: str", javascript: "path", typescript: "path: string", go: "path string", rust: "path: &str", java: "String path", c: "const char *path", cpp: "const std::string& path", csharp: "string path", kotlin: "path: String", swift: "_ path: String", php: "string $path", ruby: "path" },
    arg: {},
  },
  value: {
    name: "value", sample: '"example"',
    decl: { python: "value: str", javascript: "value", typescript: "value: string", go: "value string", rust: "value: &str", java: "String value", c: "const char *value", cpp: "const std::string& value", csharp: "string value", kotlin: "value: String", swift: "_ value: String", php: "string $value", ruby: "value" },
    arg: {},
  },
};
const PARAM_KIND = [
  ["string", /\b(?:a|an|the|given|each|one|any)\s+(?:\w+\s+)?(?:string|word|sentence|text|phrase|name|email(?: address)?|url|password|username)s?\b/],
  ["list", /\b(?:a|an|the|given|each|one|any)\s+(?:\w+\s+)?(?:list|array|vector|slice|sequence|collection)s?\b/],
  ["number", /\b(?:a|an|the|given|each|one|any)\s+(?:\w+\s+)?(?:number|integer|int|year|digit)s?\b/],
  ["path", /\b(?:a|an|the|given|each|my|one|any)\s+(?:\w+\s+)?(?:file|folder|directory|path)s?\b|\b(?:my|the|all|these)\s+(?:photos|pictures|images|files|documents)\b/],
];

function paramFor(text) {
  const t = String(text || "").toLowerCase();
  let best = null;
  for (const [kind, re] of PARAM_KIND) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.index)) best = { kind, index: m.index };
  }
  return PARAMS[best ? best.kind : "value"];
}

const declOf = (p, lang) => p.decl[lang];
const argOf = (p, lang) => (p.arg && p.arg[lang]) || p.sample;

const SKELETONS = {
  python: (title, w, text, p) => {
    const name = snake(w);
    if (name === "main") return ["```python", `# ${title}`, "def main() -> None:", `    ...  # ${TODO}`, "", "", 'if __name__ == "__main__":', "    main()", "```"];
    const call = `${name}(${argOf(p, "python")})`;
    return ["```python", `# ${title}`, `def ${name}(${declOf(p, "python")}) -> ${isPredicate(w) ? "bool" : "None"}:`, `    ...  # ${TODO}`, "", "", 'if __name__ == "__main__":', `    ${isPredicate(w) ? `print(${call})` : call}`, "```"];
  },
  javascript: (title, w, text, p) => {
    const name = camel(w);
    const params = name === "main" ? "" : declOf(p, "javascript");
    return ["```javascript", `// ${title.replace(/\*\//g, "* /")}`, `export function ${name}(${params}) {`, `  // ${TODO}`, ...(isPredicate(w) ? ["  return false;"] : []), "}", "```"];
  },
  typescript: (title, w, text, p) => {
    const name = camel(w);
    const params = name === "main" ? "" : declOf(p, "typescript");
    return ["```typescript", `// ${title}`, `export function ${name}(${params}): ${isPredicate(w) ? "boolean" : "void"} {`, `  // ${TODO}`, ...(isPredicate(w) ? ["  return false;"] : []), "}", "```"];
  },
  html: (title) => ["```html", `<!-- ${title.replace(/-{2,}/g, "-")} -->`, "<!-- the live model writes the real markup here -->", "```"],
  css: (title) => ["```css", `/* ${title.replace(/\*\//g, "* /")} */`, "/* the live model writes the real styles here */", "```"],
  sql: (title, w, text) => ["```sql", `-- ${title}`, "SELECT /* the columns you need */ *", `FROM ${sqlTable(text) || "your_table"}`, "WHERE /* the live model writes the real conditions here */ TRUE;", "```"],
  bash: (title, w) => {
    const name = snake(w);
    return ["```bash", "#!/usr/bin/env bash", `# ${title}`, "set -euo pipefail", "", `${name}() {`, '  local input="$1"', "  # the live model writes the real script here", "  :", "}", "", `${name} "$@"`, "```"];
  },
  go: (title, w, text, p) => {
    const name = camel(w);
    if (name === "main") return ["```go", `// ${title}`, "package main", "", "func main() {", `\t// ${TODO}`, "}", "```"];
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "go")})`;
    return ["```go", `// ${title}`, "package main", "", ...(pred ? ['import "fmt"', ""] : []), `func ${name}(${declOf(p, "go")})${pred ? " bool" : ""} {`, `\t// ${TODO}`, ...(pred ? ["\treturn false"] : []), "}", "", "func main() {", pred ? `\tfmt.Println(${call})` : `\t${call}`, "}", "```"];
  },
  rust: (title, w, text, p) => {
    const name = snake(w);
    if (name === "main") return ["```rust", `// ${title}`, "fn main() {", `    // ${TODO}`, "}", "```"];
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "rust")})`;
    return ["```rust", `// ${title}`, `fn ${name}(${declOf(p, "rust")})${pred ? " -> bool" : ""} {`, `    // ${TODO}`, ...(pred ? ["    false"] : []), "}", "", "fn main() {", pred ? `    println!("{}", ${call});` : `    ${call};`, "}", "```"];
  },
  java: (title, w, text, p) => {
    const name = camel(w);
    if (name === "main") return ["```java", `// ${title}`, "public class Main {", "    public static void main(String[] args) {", `        // ${TODO}`, "    }", "}", "```"];
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "java")})`;
    return ["```java", `// ${title}`, "public class Main {", `    static ${pred ? "boolean" : "void"} ${name}(${declOf(p, "java")}) {`, `        // ${TODO}`, ...(pred ? ["        return false;"] : []), "    }", "", "    public static void main(String[] args) {", pred ? `        System.out.println(${call});` : `        ${call};`, "    }", "}", "```"];
  },
  c: (title, w, text, p) => {
    const name = snake(w);
    if (name === "main") return ["```c", `// ${title}`, "#include <stdio.h>", "", "int main(void) {", `    // ${TODO}`, "    return 0;", "}", "```"];
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "c")})`;
    return ["```c", `// ${title}`, pred ? "#include <stdbool.h>" : null, p.name === "items" ? "#include <stddef.h>" : null, "#include <stdio.h>", "", `${pred ? "bool" : "void"} ${name}(${declOf(p, "c")}) {`, `    // ${TODO}`, ...(pred ? ["    return false;"] : []), "}", "", "int main(void) {", pred ? `    printf("%d\\n", ${call});` : `    ${call};`, "    return 0;", "}", "```"].filter((l) => l !== null);
  },
  cpp: (title, w, text, p) => {
    const name = camel(w);
    if (name === "main") return ["```cpp", `// ${title}`, "#include <iostream>", "", "int main() {", `    // ${TODO}`, "    return 0;", "}", "```"];
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "cpp")})`;
    const includes = ["#include <iostream>", p.name === "items" ? "#include <vector>" : p.decl.cpp.includes("std::string") ? "#include <string>" : null].filter(Boolean);
    return ["```cpp", `// ${title}`, ...includes, "", `${pred ? "bool" : "void"} ${name}(${declOf(p, "cpp")}) {`, `    // ${TODO}`, ...(pred ? ["    return false;"] : []), "}", "", "int main() {", pred ? `    std::cout << std::boolalpha << ${call} << "\\n";` : `    ${call};`, "    return 0;", "}", "```"];
  },
  csharp: (title, w, text, p) => {
    const name = pascal(w);
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "csharp")})`;
    return ["```csharp", `// ${title}`, "using System;", "", "public static class Program", "{", `    static ${pred ? "bool" : "void"} ${name}(${declOf(p, "csharp")})`, "    {", `        // ${TODO}`, ...(pred ? ["        return false;"] : []), "    }", "", "    public static void Main()", "    {", pred ? `        Console.WriteLine(${call});` : `        ${call};`, "    }", "}", "```"];
  },
  kotlin: (title, w, text, p) => {
    const name = camel(w);
    if (name === "main") return ["```kotlin", `// ${title}`, "fun main() {", `    // ${TODO}`, "}", "```"];
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "kotlin")})`;
    return ["```kotlin", `// ${title}`, `fun ${name}(${declOf(p, "kotlin")})${pred ? ": Boolean" : ""} {`, `    // ${TODO}`, ...(pred ? ["    return false"] : []), "}", "", "fun main() {", pred ? `    println(${call})` : `    ${call}`, "}", "```"];
  },
  swift: (title, w, text, p) => {
    const name = camel(w) === "main" ? "run" : camel(w);
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "swift")})`;
    return ["```swift", `// ${title}`, `func ${name}(${declOf(p, "swift")})${pred ? " -> Bool" : ""} {`, `    // ${TODO}`, ...(pred ? ["    return false"] : []), "}", "", pred ? `print(${call})` : call, "```"];
  },
  php: (title, w, text, p) => {
    const name = camel(w) === "main" ? "run" : camel(w);
    const pred = isPredicate(w);
    const call = `${name}(${argOf(p, "php")})`;
    return ["```php", "<?php", `// ${title}`, "", `function ${name}(${declOf(p, "php")}): ${pred ? "bool" : "void"}`, "{", `    // ${TODO}`, ...(pred ? ["    return false;"] : []), "}", "", pred ? `var_dump(${call});` : `${call};`, "```"];
  },
  ruby: (title, w, text, p) => {
    // Ruby names a yes-or-no method with a question mark: palindrome?
    const name = isPredicate(w) && w[0] === "is" ? `${snake(w.slice(1))}?` : snake(w) === "main" ? "run" : snake(w);
    const call = `${name}(${argOf(p, "ruby")})`;
    return ["```ruby", `# ${title}`, `def ${name}(${declOf(p, "ruby")})`, `  # ${TODO}`, ...(isPredicate(w) ? ["  false"] : []), "end", "", isPredicate(w) ? `puts ${call}` : call, "```"];
  },
};

/** A fence for a named language with no skeleton of its own: its comment, the request and the TODO. */
function plainSkeleton(lang, title) {
  const open = LINE_COMMENT[lang] || "//";
  const line = (text) => (open === "(*" ? `(* ${text} *)` : `${open} ${text}`);
  return ["```" + lang, line(title), line(TODO), "```"];
}

/** The table a SQL request names: "in a users table" -> "users", "from the orders table" -> "orders". */
function sqlTable(text) {
  const t = String(text || "").toLowerCase();
  const m = /\b(?:from|in|on|into|of)\s+(?:a|an|the|my|our|your)?\s*`?([a-z_][a-z0-9_]*)`?\s+table\b/.exec(t) || /\btable\s+(?:called|named)\s+`?([a-z_][a-z0-9_]*)/.exec(t);
  return m && !["a", "the", "this", "that", "sql"].includes(m[1]) ? m[1] : null;
}

/** "duplicate emails" -> "email" (the column a duplicates query groups by). */
function duplicateColumn(text) {
  const m = /\bduplicated?\s+([a-z_][a-z0-9_]*)/.exec(String(text || "").toLowerCase()) || /\b([a-z_][a-z0-9_]*)\s+duplicates?\b/.exec(String(text || "").toLowerCase());
  if (!m || ["rows", "row", "records", "record", "entries", "entry", "values", "value", "data", "ones"].includes(m[1])) return null;
  const word = m[1];
  if (/ies$/.test(word)) return word.slice(0, -3) + "y";
  if (/(?:ses|xes|ches|shes)$/.test(word)) return word.slice(0, -2);
  return word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

// Common patterns a regex request names: [what it matches, pattern, an example that matches].
const REGEXES = [
  [/\b(?:uk|british)\s+post\s?codes?\b/, "UK_POSTCODE", "^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$", "SW1A 1AA", "i"],
  [/\b(?:us\s+)?zip\s?codes?\b|\bus\s+post\s?codes?\b/, "US_ZIP", "^[0-9]{5}(?:-[0-9]{4})?$", "94103-1234", ""],
  [/\be-?mail(?: address)?(?:es)?\b/, "EMAIL", "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", "name@example.com", ""],
  [/\bhex(?:adecimal)?\s+colou?r/, "HEX_COLOR", "^#(?:[0-9a-fA-F]{3}){1,2}$", "#1a2b3c", ""],
  [/\bip(?:v4)?\s+address/, "IPV4", "^(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\\.){3}(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])$", "192.168.0.1", ""],
  [/\b(?:iso\s+)?dates?\b|\byyyy-mm-dd\b/, "ISO_DATE", "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$", "2026-11-27", ""],
  [/\burls?\b|\bweb\s?links?\b/, "URL", "^https?://[^\\s/$.?#][^\\s]*$", "https://example.com/page", "i"],
];

/** A regex request: the pattern, with a test call (Python, or JavaScript / TypeScript when asked). */
function regexSample(lang, text, title) {
  const t = String(text || "").toLowerCase();
  if (!/\b(?:regex(?:es)?|regexp|regular expressions?)\b/.test(t)) return null;
  const known = REGEXES.find(([re]) => re.test(t));
  if (lang === "javascript" || lang === "typescript") {
    const fence = "```" + lang;
    if (!known) return [fence, `// ${title}`, "const PATTERN = /.../; // the live model writes the real pattern here", "", 'console.log(PATTERN.test("text to check"));', "```"];
    const [, name, pattern, example, flags] = known;
    return [fence, `// ${title}`, `const ${name} = /${pattern.replace(/\//g, "\\/")}/${flags};`, "", `console.log(${name}.test(${JSON.stringify(example)})); // true`, "```"];
  }
  if (lang !== "python") return null;
  if (!known) return ["```python", `# ${title}`, "import re", "", 'PATTERN = re.compile(r"...")  # the live model writes the real pattern here', "", 'print(bool(PATTERN.search("text to check")))', "```"];
  const [, name, pattern, example, flags] = known;
  return ["```python", `# ${title}`, "import re", "", `${name} = re.compile(r"${pattern}"${flags ? ", re.IGNORECASE" : ""})`, "", `print(bool(${name}.match(${JSON.stringify(example)})))  # True`, "```"];
}

/**
 * "How do I fix ...", "Why do I get ...": steps, then the failing line and a fixed one for a few
 * well-known errors; for any other error, where each goes (the live model reads your code).
 */
const DEBUG_RE = /\b(?:how (?:do|can|should) (?:i|we) (?:fix|solve|get rid of|debug)|fix(?:ing)?\s+(?:this|my|the|a|an)\b|why (?:do|does|am|is) (?:i|it|my|this)\b[^?]*\b(?:get|getting|throw|throws|throwing|fail|fails|failing|crash|crashes|error)|what (?:does|is) (?:this|the|my) error)/;
const ERROR_RE = /\b(?:error|exception|traceback|typeerror|referenceerror|keyerror|valueerror|attributeerror|segfault|undefined|null|nonetype|crash(?:es)?)\b/;
function debugSample(lang, text, title) {
  const t = String(text || "").toLowerCase();
  if (!DEBUG_RE.test(t) || !ERROR_RE.test(t)) return null;
  if (/cannot read propert(?:y|ies) of (?:undefined|null)|undefined is not an object|is undefined\b/.test(t)) {
    const react = /\breact\b|\bjsx\b|\bcomponent\b/.test(t);
    return {
      intro: "A real answer would walk through it like this (written by the preview, not by a model):",
      body: [
        "1. The stack trace names the line: it reads a property of something that is still `undefined` (often data that has not loaded yet, or a typo in a key).",
        "2. Guard the read with optional chaining, or give the value a default until it arrives.",
        "",
        react ? "```jsx" : "```javascript",
        `// ${title}`,
        ...(react
          ? ["// Before: crashes while `user` is still loading", "<p>{user.name}</p>", "", "// After: renders nothing until it arrives", "<p>{user?.name ?? ''}</p>"]
          : ["// Before: throws when `user` is undefined", "const name = user.name;", "", "// After: undefined-safe, with a fallback", "const name = user?.name ?? '';"]),
        "```",
      ].join("\n"),
    };
  }
  if (/\bkeyerror\b/.test(t)) {
    return {
      intro: "A real answer would walk through it like this (written by the preview, not by a model):",
      body: ["1. A `KeyError` means the dictionary has no such key: check its spelling, and print `data.keys()` to see what is there.", "2. When the key may be missing, read it with a default.", "", "```python", `# ${title}`, "# Before: raises KeyError when \"email\" is missing", 'email = data["email"]', "", "# After: None (or a default) instead of an exception", 'email = data.get("email", "")', "```"].join("\n"),
    };
  }
  if (/nonetype|'none' has no attribute|has no attribute/.test(t)) {
    return {
      intro: "A real answer would walk through it like this (written by the preview, not by a model):",
      body: ["1. Something returned `None` where you expected an object (a search with no match, a function without `return`).", "2. Check for `None` before using it.", "", "```python", `# ${title}`, "import re", "", "# Before: AttributeError when nothing matches", 'name = re.search(r"Name: (\\w+)", text).group(1)', "", "# After: handle the no-match case", 'match = re.search(r"Name: (\\w+)", text)', 'name = match.group(1) if match else ""', "```"].join("\n"),
    };
  }
  const open = { python: "#", ruby: "#", bash: "#", sql: "--" }[lang] || "//";
  const fenceLang = SKELETONS[lang] || LINE_COMMENT[lang] ? lang : "text";
  return {
    intro: "The live answer would be real code, rendered like this:",
    body: ["```" + fenceLang, `${open} ${title}`, `${open} 1. the line from your stack trace that fails`, `${open} 2. the changed line, and why it fixes the error`, `${open} (the live model writes both from your code)`, "```"].join("\n"),
  };
}

// Tables a "top N <things> by <amount>" query joins: what each row of it holds and how to add it up.
const RELATED = { order: ["orders", "total"], sale: ["sales", "amount"], purchase: ["purchases", "total"], invoice: ["invoices", "total"], payment: ["payments", "amount"], review: ["reviews", "rating"] };

/** "the top 5 customers by total order value" -> a GROUP BY, ORDER BY ... DESC, LIMIT 5 query. */
function topNQuery(text, title) {
  const t = String(text || "").toLowerCase();
  const m = /\btop\s+(\d{1,4})\s+([a-z_]+)\s+by\s+((?:[a-z_]+\s*){1,4})/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  const table = m[2];
  const one = table.replace(/ies$/, "y").replace(/s$/, "");
  const words = m[3].trim().split(/\s+/).filter((w) => !["the", "their", "total", "highest", "most", "biggest", "largest", "of", "in", "a"].includes(w));
  const relWord = words.map((w) => w.replace(/s$/, "")).find((w) => RELATED[w]);
  const head = ["```sql", `-- ${title}`, "-- Table and column names are guesses; the live model uses yours."];
  if (relWord) {
    const [rel, col] = RELATED[relWord];
    const a = table[0];
    const b = rel[0] === a ? rel.slice(0, 2) : rel[0];
    const counting = /\b(?:number|count)\b/.test(m[3]) || (/\bmost\b/.test(m[3]) && !/\b(?:value|amount|spend|spent|revenue)\b/.test(m[3]));
    const agg = counting ? `COUNT(${b}.id)` : rel === "reviews" ? `AVG(${b}.${col})` : `SUM(${b}.${col})`;
    const alias = counting ? `${rel}_count` : rel === "reviews" ? "average_rating" : `total_${relWord}_${col === "total" ? "value" : col}`;
    return [...head, `SELECT ${a}.id, ${a}.name, ${agg} AS ${alias}`, `FROM ${table} AS ${a}`, `JOIN ${rel} AS ${b} ON ${b}.${one}_id = ${a}.id`, `GROUP BY ${a}.id, ${a}.name`, `ORDER BY ${alias} DESC`, `LIMIT ${n};`, "```"];
  }
  const column = words.slice(0, 2).join("_") || "value";
  return [...head, "SELECT *", `FROM ${table}`, `ORDER BY ${column} DESC`, `LIMIT ${n};`, "```"];
}

/**
 * Real code for a few common requests (written by the preview, not by a model): a debounce or
 * throttle in JavaScript or TypeScript, a regex for a common pattern, a duplicates or a "top N by"
 * query in SQL. Null for anything else.
 */
function knownSample(lang, text, words, title) {
  const w = words || [];
  const head = (comment) => [`${comment} ${title}`];
  if ((lang === "javascript" || lang === "typescript") && (w[0] === "debounce" || w[0] === "throttle")) {
    const ts = lang === "typescript";
    const fence = "```" + lang;
    const sig = ts ? "<A extends unknown[]>(fn: (...args: A) => void, waitMs = 250): (...args: A) => void" : "(fn, waitMs = 250)";
    const args = ts ? "...args: A" : "...args";
    if (w[0] === "debounce") {
      return [fence, ...head("//"), "// Calls `fn` once calls stop for `waitMs`, with the latest arguments.", `export function debounce${sig} {`, `  let timer${ts ? ": ReturnType<typeof setTimeout> | undefined" : ""};`, `  return (${args}) => {`, "    clearTimeout(timer);", "    timer = setTimeout(() => fn(...args), waitMs);", "  };", "}", "```"];
    }
    return [fence, ...head("//"), "// Calls `fn` at most once every `waitMs`; calls in between are dropped.", `export function throttle${sig} {`, "  let last = 0;", `  return (${args}) => {`, "    const now = Date.now();", "    if (now - last < waitMs) return;", "    last = now;", "    fn(...args);", "  };", "}", "```"];
  }
  const regex = regexSample(lang, text, title);
  if (regex) return regex;
  if (lang === "sql") {
    const top = topNQuery(text, title);
    if (top) return top;
  }
  if (lang === "sql" && /\bduplicat/i.test(text)) {
    const column = duplicateColumn(text);
    if (!column) return null;
    const table = sqlTable(text) || `${column === "email" ? "users" : "your_table"}`;
    return ["```sql", ...head("--"), `SELECT ${column}, COUNT(*) AS copies`, `FROM ${table}`, `GROUP BY ${column}`, "HAVING COUNT(*) > 1", "ORDER BY copies DESC;", "```"];
  }
  return null;
}

const COMPOUND_INTEREST =
  "Here is the gist a real answer would cover: interest is money paid for letting a bank (or a loan) use your money. " +
  "**Compound** interest means you earn interest on your interest too. Put $100 away at 10% a year: after one year you " +
  "have $110; the next year you earn 10% of $110, so $121; then $133.10, and so on. The pile grows faster every year, " +
  "which is why starting early matters more than starting big.";

/** The request a follow-up edits ("Add a --dry-run option" after "Write a script that ..."), or null. */
function followedRequest(text, earlier) {
  if (!isEditFollowUp(text)) return null;
  const list = (Array.isArray(earlier) ? earlier : []).map((x) => String(x || "").trim()).filter(Boolean);
  for (let i = list.length - 1; i >= 0; i--) if (!isEditFollowUp(list[i])) return list[i];
  return null;
}

/**
 * A short sample of the kind of content the live answer would hold, for a few known prompts.
 * `earlier`: the chat's earlier questions, so a follow-up's code continues the request it edits.
 */
function sampleContent({ job, text, earlier }) {
  const t = String(text || "");
  if (job === "code") {
    const base = followedRequest(t, earlier);
    if (base) {
      // The updated code in the language of the request it edits, named after that task.
      const lang = namedLanguage(t) || detectLanguage(base);
      const title = commentTitle(t);
      const lines = SKELETONS[lang] ? SKELETONS[lang](title, taskWords(base), base, paramFor(base)) : plainSkeleton(lang, title);
      return { intro: "The live answer would be the updated code, rendered like this:", body: lines.join("\n") };
    }
    if (/\brenam(?:e|es|ing)\b[\s\S]*\b(?:photos?|pictures?|images?)\b[\s\S]*\bdates?\b/i.test(t)) return { intro: "A real answer would look like this (written by the preview, not by a model):", body: PHOTO_RENAMER };
    const lang = detectLanguage(t);
    const title = commentTitle(t);
    const debug = debugSample(lang, t, title);
    if (debug) return debug;
    const words = taskWords(t);
    const known = knownSample(lang, t, words, title);
    if (known) return { intro: "A real answer would look like this (written by the preview, not by a model):", body: known.join("\n") };
    const lines = SKELETONS[lang] ? SKELETONS[lang](title, words, t, paramFor(t)) : plainSkeleton(lang, title);
    return { intro: "The live answer would be real code, rendered like this:", body: lines.join("\n") };
  }
  if (job === "chat" && /\bcompound interest\b/i.test(t)) return { intro: null, body: COMPOUND_INTEREST };
  return null;
}

/** Micro-dollars as "$0.000081" (three significant digits below a cent) or "$0.0703". */
function usd(micros) {
  const m = Math.max(0, Math.round(Number(micros) || 0));
  const v = m / 1e6;
  if (m === 0) return "$0";
  return `$${m < 10_000 ? String(Number(v.toPrecision(3))) : String(Number(v.toFixed(4)))}`;
}

/**
 * How the chip's cost comes about: the answer's tokens at the model's catalog price, the
 * classifier's read of the message when an outside classifier model read it (the pipeline adds
 * that call to the bill: turn.classifierCost), then Gode's margin on the sum (credits.priceFor).
 */
function costLine({ model, usage, margin, ctx }) {
  const pct = Math.round((Number(margin) || 0) * 100);
  const prices = model.price_in !== null && model.price_out !== null ? ` (${model.label}: $${trimNum(model.price_in)} in / $${trimNum(model.price_out)} out per 1M tokens)` : "";
  const thinking = usage.reasoningTokens ? `, ${fmtInt(usage.reasoningTokens)} of them thinking` : "";
  const answerMicros = providerCostMicros(model, { usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: 0 } }).micros;
  const c = ctx && ctx.classifier && Number(ctx.classifier.costMicros) > 0 ? ctx.classifier : null;
  const apiMicros = answerMicros + (c ? Number(c.costMicros) : 0);
  const priceFor = ctx && typeof ctx.priceFor === "function" ? ctx.priceFor : (api) => (api > 0 ? Math.ceil(api * (1 + (Number(margin) || 0)) - 1e-6) : 0);
  const total = priceFor(apiMicros);
  return (
    `The chip shows what this answer would cost in the live app: ${fmtInt(usage.inputTokens)} tokens in and about ` +
    `${fmtInt(usage.outputTokens)} out${thinking}, at the catalog price${prices}, which comes to ${usd(answerMicros)}` +
    (c ? `; the classifier's read of the message${c.label ? ` (${c.label})` : ""} adds ${usd(c.costMicros)}` : "") +
    `; plus Gode's ${pct}% margin, that is ${formatCost(total / 1e6)} in all, as on the chip. It is paid from your preview credit.`
  );
}

/** The effort line: what the model runs at and why (difficulty, a model without thinking, on/off models). */
function effortLineFor({ model, effort, route }) {
  const r = route;
  if (!model.supports_reasoning) return `no thinking (${model.label} has no thinking setting)`;
  const wantedEffort = difficultyToEffort(r.difficulty);
  let line = effortLevel(effort);
  if (r.effort_lowered) return `${line}, lowered because your balance only covers a short answer`;
  if (effort === wantedEffort) return `${line}, set by the difficulty`;
  const levels = model.params && model.params.reasoning && Array.isArray(model.params.reasoning.efforts) ? model.params.reasoning.efforts : [];
  const on = levels.filter((e) => e !== "none");
  if (levels.includes("none") && on.length === 1) {
    return `${line} (difficulty ${r.difficulty} asks for ${effortWords(wantedEffort)}; ${model.label} only has thinking on or off, and anything above none runs as ${on[0]})`;
  }
  return `${line} (difficulty ${r.difficulty} asks for ${effortWords(wantedEffort)}; this is the nearest level ${model.label} runs)`;
}

/**
 * The preview answer for a text job.
 * @returns {{ text: string, usage: { inputTokens, outputTokens, reasoningTokens } }}
 */
function composeTextAnswer({ model, messages, effort, maxTokens, route, mode, user, margin, ctx }) {
  const r = route || { job: "chat", difficulty: 3, tier: "balanced", effort, redactions: {}, private: false };
  const u = user || {};
  const latest = [...(messages || [])].reverse().find((m) => m && m.role === "user");
  const latestText = latest ? String(latest.content || "") : "";
  const earlier = (messages || []).filter((m) => m && m.role !== "system").length - 1;
  const usage = simulatedUsage({ messages, difficulty: r.difficulty, effort, maxTokens, model });
  const hidden = hiddenPhrase(r.redactions);
  const job = JOB_NAME[r.job] || r.job;

  const lines = [
    `**This is the Gode preview: no AI model was called.** In the live app, **${model.label}** would write this answer.`,
    "",
    `- **Job:** ${job}, difficulty ${r.difficulty} of 5`,
    `- **Model:** ${model.label}${modelFacts(model, r)}: ${why({ route: r, mode, user: u, model, ctx })}`,
    `- **Effort:** ${effortLineFor({ model, effort, route: r })}`,
    `- **Privacy:** ${privacyLine({ route: r, model, user: u, ctx, text: latestText })}`,
    `- **Hidden before sending:** ${hidden ? `${hidden}, replaced with placeholders; the real values are put back in this answer on Gode's side` : "nothing found (emails, phone, card and ID numbers, and names you introduce, are caught)"}`,
    `- **Classified by:** ${classifierLine(r, ctx)}`,
  ];
  // Auto-pick off: a model picked by hand answers in the job it can do (pipeline manualJob), so a
  // media request to a text model is answered in text. Say so, and how to get the media.
  const asked = ctx && ctx.classifier && ctx.classifier.job;
  if (mode === "manual" && MEDIA_JOBS.has(asked) && asked !== r.job) {
    const thing = { image: "an image", video: "a video", music: "music", voice: "spoken audio" }[asked];
    lines.splice(3, 0, `- **No ${asked === "voice" ? "audio" : asked === "music" ? "music" : asked}:** your message asks for ${thing}, but auto-pick is off and ${model.label} only writes text, so the live app answers in text. Turn auto-pick on in Settings to get ${thing}.`);
  }
  if (r.job === "action") lines.push(`- **Action:** sending, posting or scheduling in other apps comes in phase 2; the live app prepares the draft and you send it yourself.`);
  lines.push(
    "",
    `**What ${model.label} would receive${earlier > 0 ? `, after the ${earlier} earlier message${earlier === 1 ? "" : "s"} of this chat` : ""}:**${placeholderNote(r.redactions)}`,
    "",
    quote(latestText)
  );
  const earlierQuestions = (messages || []).filter((m) => m && m.role === "user" && m !== latest).map((m) => String(m.content || ""));
  const sample = sampleContent({ job: r.job, text: latestText, earlier: earlierQuestions });
  if (sample) {
    lines.push("");
    if (sample.intro) lines.push(sample.intro, "");
    lines.push(sample.body);
  }
  lines.push("", costLine({ model, usage, margin, ctx }));
  return { text: lines.join("\n"), usage };
}

const MEDIA_NOUN = { image: "image", video: "video", music: "music", voice: "voice" };

/**
 * The caption stored with a preview picture or sound (the pipeline keeps at most 500 characters):
 * that no model was called, which model the live app would use and why (the same reasons as a
 * text answer: a switch, a pin, the plan's column, the private pick), and the prompt it would get.
 */
function composeMediaCaption({ model, job, prompt, route, user, mode, ctx }) {
  const r = route || { job, tier: "balanced", difficulty: 3, redactions: {}, private: false };
  const u = user || {};
  const reason = why({ route: { ...r, job: r.job || job }, mode, user: u, model, ctx });
  const shown = String(prompt || "").replace(/\s+/g, " ").trim();
  const head = `**Gode preview:** no ${MEDIA_NOUN[job] || job} model was called. In the live app **${model.label}** would make it: ${reason}. It would get: `;
  const swapped = Object.values(r.redactions || {}).some((n) => Number(n) > 0);
  const tail = swapped ? " Personal details were swapped for generic words first." : r.private ? " Treated as private; nothing personal was found to take out." : "";
  const room = Math.max(40, 490 - head.length - tail.length - 2);
  const body = shown.length > room ? shown.slice(0, room - 1).trimEnd() + "…" : shown;
  // The quote ends the sentence: a full stop after it when more follows and it has none of its own.
  const stop = tail && !/[.!?]$/.test(body) ? "." : "";
  return `${head}“${body.replace(/([*_`~[\]\\])/g, "\\$1")}”${stop}${tail}`;
}

module.exports = { composeTextAnswer, composeMediaCaption, hiddenPhrase, showPlaceholders, simulatedUsage, detectLanguage, sampleContent, taskWords, knownSample, paramFor, topicPhrase, modelFacts, commentTitle, why, classifierLine, privacyLine, costLine, effortLineFor, PHOTO_RENAMER };
