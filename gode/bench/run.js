#!/usr/bin/env node
// Benchmark: Gode's router vs OpenRouter's own openrouter/auto, judged pairwise by an LLM.
//
//   node bench/run.js [--prompts bench/prompts.jsonl] [--limit 200] [--judge <model id>]
//                     [--out bench/results] [--concurrency 3] [--plan balanced]
//                     [--catalog <admin export .json>] [--dry]
//
// For each text prompt: redact -> classify -> pick (plan, no pins) -> stream the answer from the
// picked model; in parallel, the same redacted prompt goes to openrouter/auto. A judge model then
// compares the two answers with a randomised A/B order. Media prompts are classified, then skipped
// (openrouter/auto only does text) and counted. Writes results-<ts>.json and summary-<ts>.md.
//
// No billing, no users, no database file: the routing table is the seed catalog (or --catalog) in
// an in-memory SQLite database. Exit code 2 = configuration problem; per-prompt failures are
// recorded in the report and never fail the run.
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { judgePair, describeError } = require("./judge");
const { summarize, renderMarkdown, formatUsd, MEDIA_JOBS } = require("./stats");

// Same list as src/seed/catalog.js JOBS, repeated so this file's pure helpers load (and are
// testable) without the app modules.
const JOBS = ["chat", "code", "image", "video", "music", "voice", "action"];
const PLANS = ["saver", "balanced", "best"];
const DEFAULT_PROMPTS = path.join(__dirname, "prompts.jsonl");
const DEFAULT_OUT = path.join(__dirname, "results");
// A strong model that is not the default pick for most text prompts in the seed routing table
// (Opus is only the hard-code pick), which keeps self-preference small. Override with --judge.
const DEFAULT_JUDGE_MODEL_ID = "openrouter:anthropic/claude-opus-5.5";
const ANSWER_TIMEOUT_MS = 180_000;
const JUDGE_TIMEOUT_MS = 120_000;
const MAX_CONCURRENCY = 16;

const USAGE = `Usage: node bench/run.js [options]

Benchmarks Gode's router against openrouter/auto on the same (redacted) prompts.

Options:
  --prompts <file>      JSONL prompts {id, prompt, job_hint?}   (default bench/prompts.jsonl)
  --limit <n>           only the first n prompts                 (default: all)
  --judge <model id>    judge model: a catalog id or any "openrouter:<slug>"
                                                                 (default ${DEFAULT_JUDGE_MODEL_ID})
  --out <dir>           where results-*.json and summary-*.md go (default bench/results)
  --concurrency <n>     prompts in flight at once                (default 3)
  --plan <plan>         Gode plan: saver | balanced | best       (default balanced)
  --catalog <file>      routing table to test, as exported from the admin page
                        (default: the seed catalog)
  --dry                 force mock mode: no keys needed, no AI is called
  -h, --help            show this help

Live runs need OPENROUTER_API_KEY (the baseline) plus keys for the judge's gateway and any
gateway in the routing table you want Gode to use. Keys are read from .env.`;

/** A user-facing configuration problem: printed without a stack trace, exit code 2. */
class ConfigError extends Error {}

// ---------------------------------------------------------------------------------------------
// CLI parsing

function positiveInt(flag, value, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new ConfigError(`${flag} must be a whole number between 1 and ${max}`);
  return n;
}

/** Parse argv (without node and script). Throws ConfigError on bad input. */
function parseArgs(argv) {
  const opts = {
    prompts: DEFAULT_PROMPTS,
    limit: null,
    judge: DEFAULT_JUDGE_MODEL_ID,
    out: DEFAULT_OUT,
    concurrency: 3,
    plan: "balanced",
    catalog: null,
    dry: false,
    help: false,
  };
  const takesValue = new Set(["--prompts", "--limit", "--judge", "--out", "--concurrency", "--plan", "--catalog"]);
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let value;
    const eq = arg.indexOf("=");
    if (arg.startsWith("--") && eq > 0) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    if (arg === "--dry") opts.dry = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (takesValue.has(arg)) {
      if (value === undefined) {
        value = argv[++i];
        if (value === undefined || value.startsWith("--")) throw new ConfigError(`${arg} needs a value`);
      }
      switch (arg) {
        case "--prompts":
          opts.prompts = path.resolve(value);
          break;
        case "--limit":
          opts.limit = positiveInt(arg, value);
          break;
        case "--judge":
          opts.judge = value.trim();
          break;
        case "--out":
          opts.out = path.resolve(value);
          break;
        case "--concurrency":
          opts.concurrency = positiveInt(arg, value, MAX_CONCURRENCY);
          break;
        case "--plan":
          if (!PLANS.includes(value)) throw new ConfigError(`--plan must be one of ${PLANS.join(", ")}`);
          opts.plan = value;
          break;
        case "--catalog":
          opts.catalog = path.resolve(value);
          break;
      }
    } else {
      throw new ConfigError(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------------------------
// Prompts

/**
 * Parse JSONL prompts. Blank lines are ignored; every other line must be {id, prompt, job_hint?}.
 * Throws ConfigError naming the line, because a silently dropped prompt skews the benchmark.
 */
function parsePromptsJsonl(text, { source = "prompts" } = {}) {
  const prompts = [];
  const seen = new Set();
  String(text)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim()) return;
      const where = `${source}:${i + 1}`;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        throw new ConfigError(`${where}: not valid JSON`);
      }
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new ConfigError(`${where}: expected a JSON object`);
      const id = typeof obj.id === "string" || typeof obj.id === "number" ? String(obj.id).trim() : "";
      if (!id) throw new ConfigError(`${where}: missing "id"`);
      if (seen.has(id)) throw new ConfigError(`${where}: duplicate id "${id}"`);
      if (typeof obj.prompt !== "string" || !obj.prompt.trim()) throw new ConfigError(`${where}: missing "prompt"`);
      const hint = obj.job_hint === undefined || obj.job_hint === null || obj.job_hint === "" ? null : String(obj.job_hint);
      if (hint !== null && !JOBS.includes(hint)) throw new ConfigError(`${where}: unknown job_hint "${hint}"`);
      seen.add(id);
      prompts.push({ id, prompt: obj.prompt, job_hint: hint });
    });
  return prompts;
}

function loadPrompts(file, limit = null) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new ConfigError(`cannot read prompts file ${file} (${e.code || e.message})`);
  }
  const prompts = parsePromptsJsonl(text, { source: path.basename(file) });
  if (!prompts.length) throw new ConfigError(`${file} has no prompts`);
  return limit ? prompts.slice(0, limit) : prompts;
}

// ---------------------------------------------------------------------------------------------
// Real modules (built lazily so the pure helpers above can be required without them)

/** Import an admin catalog export ({models, routes}) into the in-memory routing table. */
function importCatalogFile(catalog, db, file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new ConfigError(`cannot read catalog ${file} (${e.code || "invalid JSON"})`);
  }
  if (!data || !Array.isArray(data.models) || !Array.isArray(data.routes)) {
    throw new ConfigError(`${file} is not a catalog export: expected {"models": [...], "routes": [...]}`);
  }
  try {
    catalog.importCatalog(db, { models: data.models, routes: data.routes }, { source: "admin" });
  } catch (e) {
    throw new ConfigError(`catalog ${file} was rejected: ${e.message}`);
  }
}

/**
 * Build Gode's real router modules on an in-memory database.
 * @returns {{ config, db, redactor, providers, classifier, picker, getModel: Function, close: Function }}
 */
function buildDeps({ env = process.env, dry = false, catalogFile = null } = {}) {
  const { loadConfig } = require("../src/config");
  const { openDb } = require("../src/db");
  const catalog = require("../src/seed/catalog");
  const { createRedactor } = require("../src/redact");
  const { createProviders } = require("../src/providers");
  const { createClassifier } = require("../src/router/classify");
  const { createPicker } = require("../src/router/pick");

  const config = loadConfig(dry ? { ...env, GODE_MOCK: "1" } : env);
  const db = openDb(":memory:");
  try {
    catalog.seedCatalog(db);
    if (catalogFile) importCatalogFile(catalog, db, catalogFile);
  } catch (e) {
    db.close();
    throw e;
  }
  const redactor = createRedactor(config);
  const providers = createProviders(config);
  const classifier = createClassifier({ config, db, providers, redactor });
  const picker = createPicker({ db, config, providers });
  return {
    config,
    db,
    redactor,
    providers,
    classifier,
    picker,
    getModel: (id) => catalog.getModel(db, id),
    close: () => db.close(),
  };
}

/** openrouter/auto as an ad-hoc model object. It reports the model it chose in usage.modelReported. */
function baselineModel() {
  return {
    id: "openrouter:openrouter/auto",
    label: "OpenRouter Auto",
    vendor: "OpenRouter",
    region: null,
    gateway: "openrouter",
    slug: "openrouter/auto",
    jobs: ["chat", "code", "action"],
    price_in: null, // auto bills the chosen model's price; the provider reports it as usage.cost
    price_out: null,
    price_unit: null,
    price_per_unit: null,
    zdr: false,
    retention_note: null,
    open_weights: false,
    self_hosted: false,
    // The router picks its own effort; sending one would override that choice.
    supports_reasoning: false,
    context_length: null,
    params: {},
    enabled: true,
  };
}

const OPENROUTER_ID_RE = /^openrouter:[A-Za-z0-9._~-]+\/[A-Za-z0-9._:~-]+$/;

/** The judge: a text model from the catalog, or an ad-hoc "openrouter:<vendor>/<model>". */
function resolveJudgeModel(deps, id) {
  const wanted = String(id || "").trim();
  if (!wanted) throw new ConfigError("--judge needs a model id");
  const model = deps.getModel(wanted);
  if (model) {
    if (!model.jobs.includes("chat")) throw new ConfigError(`judge ${wanted} is not a text model`);
    return model;
  }
  if (OPENROUTER_ID_RE.test(wanted)) {
    const slug = wanted.slice("openrouter:".length);
    return { ...baselineModel(), id: wanted, label: slug, vendor: null, slug };
  }
  throw new ConfigError(`unknown judge model "${wanted}": use a catalog model id or "openrouter:<vendor>/<model>"`);
}

/** Live runs must be able to reach the baseline and the judge; fail before spending anything. */
function checkLiveConfig(deps, judgeModel) {
  if (deps.config.mock) return;
  if (!deps.providers.get("openrouter").configured()) {
    throw new ConfigError("OPENROUTER_API_KEY is required for the openrouter/auto baseline (or run with --dry)");
  }
  if (!deps.providers.isAvailable(judgeModel)) {
    throw new ConfigError(`judge ${judgeModel.id} is not available: its gateway (${judgeModel.gateway}) has no key, or the model is disabled`);
  }
}

// ---------------------------------------------------------------------------------------------
// Running one prompt

const ms = (t0) => Math.round(performance.now() - t0);

/** Price per token from the model row, used when the provider did not report a cost. */
function costFromUsage(usage, model) {
  if (usage && typeof usage.costUsd === "number" && Number.isFinite(usage.costUsd)) {
    return { costUsd: usage.costUsd, source: "reported" };
  }
  const priced = model && Number.isFinite(model.price_in) && Number.isFinite(model.price_out);
  if (usage && priced) {
    const inTok = Number(usage.inputTokens) || 0;
    const outTok = Number(usage.outputTokens) || 0; // includes reasoning tokens, as upstreams bill them
    return { costUsd: (inTok * model.price_in + outTok * model.price_out) / 1_000_000, source: "computed" };
  }
  return { costUsd: null, source: "unknown" };
}

/** Catalog row for the model openrouter/auto reported (exact slug, then without a -YYYYMMDD suffix). */
function lookupReportedModel(deps, reported) {
  if (!reported) return null;
  const slug = String(reported);
  return deps.getModel(`openrouter:${slug}`) || deps.getModel(`openrouter:${slug.replace(/-\d{8}$/, "")}`) || null;
}

/** Stream one answer to completion, timing first token and total. */
async function streamAnswer({ provider, model, messages, effort, maxTokens, zdr, timeoutMs = ANSWER_TIMEOUT_MS }) {
  const signal = AbortSignal.timeout(timeoutMs);
  const t0 = performance.now();
  let ttftMs = null;
  let text = "";
  let usage = null;
  for await (const ev of provider.streamChat({ model, messages, effort, maxTokens, zdr, signal })) {
    if (ev?.type === "delta" && typeof ev.text === "string") {
      if (ttftMs === null) ttftMs = ms(t0);
      text += ev.text;
    } else if (ev?.type === "usage") {
      usage = ev;
    }
  }
  if (!text.trim()) throw Object.assign(new Error("the model returned an empty answer"), { code: "empty_answer" });
  return { text, usage, ttftMs, latencyMs: ms(t0) };
}

function sideMetrics(answer, cost) {
  const u = answer.usage || {};
  return {
    ok: true,
    error: null,
    text: answer.text,
    input_tokens: u.inputTokens ?? null,
    output_tokens: u.outputTokens ?? null,
    reasoning_tokens: u.reasoningTokens ?? null,
    upstream_provider: u.upstreamProvider ?? null,
    model_reported: u.modelReported ?? null,
    answer_cost_usd: cost.costUsd,
    cost_source: cost.source,
  };
}

/** Gode's pick for this prompt: the user's plan, no conversation pins, no manual override. */
async function pickGode(deps, ctx, classification) {
  const t0 = performance.now();
  try {
    const pick = await deps.picker.pick({
      job: classification.job,
      difficulty: classification.difficulty,
      private: classification.private,
      user: ctx.user,
      pins: {},
      overrideModelId: null,
    });
    return { ok: true, pick, ms: ms(t0) };
  } catch (err) {
    return { ok: false, error: describeError(err), ms: ms(t0) };
  }
}

/** Gode's answer from the picked model. Latency includes classification + pick (routing_ms). */
async function answerGode(deps, ctx, { picked, rawMessages, redactedMessages, classification }) {
  const routingMs = classification.ms + picked.ms;
  const base = { model_id: null, label: null, tier: null, effort: null, zdr: false, reason: null, routing_ms: routingMs };
  if (!picked.ok) return { ...base, ok: false, error: picked.error };
  const { pick } = picked;
  const model = pick.model;
  const side = {
    ...base,
    model_id: model.id,
    label: model.label,
    tier: pick.tier,
    effort: pick.effort,
    zdr: Boolean(pick.zdrRequired),
    reason: pick.reason || null,
  };
  // Same rule as the chat pipeline: self-hosted models get the original text unless configured otherwise.
  const messages = model.self_hosted && !deps.config.privacy.redactSelfHosted ? rawMessages : redactedMessages;
  try {
    const answer = await streamAnswer({
      provider: deps.providers.get(model.gateway),
      model,
      messages,
      effort: pick.effort,
      maxTokens: deps.config.router.maxOutputTokens,
      zdr: Boolean(pick.zdrRequired),
      timeoutMs: ctx.answerTimeoutMs,
    });
    const cost = costFromUsage(answer.usage, model);
    const classifierCost = classification.cost_usd ?? 0;
    return {
      ...side,
      ...sideMetrics(answer, cost),
      classifier_cost_usd: classifierCost,
      // What one Gode request really costs: the answer plus the classifier call that routed it.
      cost_usd: cost.costUsd === null ? null : cost.costUsd + classifierCost,
      latency_ms: routingMs + answer.latencyMs,
      ttft_ms: answer.ttftMs === null ? null : routingMs + answer.ttftMs,
    };
  } catch (err) {
    return { ...side, ok: false, error: describeError(err) };
  }
}

/** Baseline: the same redacted messages to openrouter/auto, under the same zero-retention constraint. */
async function answerAuto(deps, ctx, { redactedMessages, zdr }) {
  const model = baselineModel();
  const base = { model_id: model.id, label: model.label, zdr };
  try {
    const answer = await streamAnswer({
      provider: deps.providers.get("openrouter"),
      model,
      messages: redactedMessages,
      maxTokens: deps.config.router.maxOutputTokens,
      zdr,
      timeoutMs: ctx.answerTimeoutMs,
    });
    // Auto is billed at the chosen model's price; OpenRouter reports it, the catalog is the fallback.
    const reported = answer.usage?.costUsd == null ? lookupReportedModel(deps, answer.usage?.modelReported) : null;
    const cost = costFromUsage(answer.usage, reported || model);
    return { ...base, ...sideMetrics(answer, cost), cost_usd: cost.costUsd, latency_ms: answer.latencyMs, ttft_ms: answer.ttftMs };
  } catch (err) {
    return { ...base, ok: false, error: describeError(err) };
  }
}

/** Decide the prompt: judge when both answered, otherwise the side that answered wins. */
async function decide(deps, ctx, { id, redactedPrompt, gode, auto }) {
  if (gode.ok && auto.ok) {
    const v = await judgePair({
      provider: deps.providers.get(ctx.judgeModel.gateway),
      model: ctx.judgeModel,
      id,
      prompt: redactedPrompt,
      godeAnswer: gode.text,
      autoAnswer: auto.text,
      signal: AbortSignal.timeout(ctx.judgeTimeoutMs),
    });
    return {
      winner: v.winner,
      raw: v.raw,
      gode_position: v.gode_position,
      reason: v.reason,
      error: v.error,
      by_error: false,
      truncated: v.truncated,
      judge_cost_usd: v.usage ? costFromUsage(v.usage, ctx.judgeModel).costUsd : null,
    };
  }
  const base = { raw: null, gode_position: null, error: null, by_error: true, judge_cost_usd: null };
  if (!gode.ok && !auto.ok) return { ...base, winner: null, reason: "both sides failed" };
  // A failed answer is worse than any answer; the report shows how many verdicts came from this.
  const loser = gode.ok ? auto : gode;
  return { ...base, winner: gode.ok ? "gode" : "auto", reason: `${gode.ok ? "auto" : "gode"} failed (${loser.error?.code || "error"})` };
}

/**
 * Run one prompt end to end. Prompt-level failures are recorded in the row, never thrown.
 * @returns {Promise<object>} result row (shape documented in bench/stats.js)
 */
async function runPrompt(deps, ctx, item) {
  const row = {
    id: item.id,
    job_hint: item.job_hint,
    prompt_chars: item.prompt.length,
    status: "compared",
    skip_reason: null,
    error: null,
    redactions: {},
    classification: null,
    gode: null,
    auto: null,
    verdict: null,
  };
  const rawMessages = [{ role: "user", content: item.prompt }];
  let redactedMessages = rawMessages;
  try {
    // Mirrors the chat pipeline: redaction can be switched off with REDACTION=off.
    if (deps.config.privacy.redaction) {
      const r = await deps.redactor.redactMessages(rawMessages, null, { mode: "placeholder" });
      redactedMessages = r.messages;
      row.redactions = r.counts || {};
    }
    const t0 = performance.now();
    const cls = await deps.classifier.classify({ text: redactedMessages[0].content, history: [], redactionCounts: row.redactions });
    row.classification = {
      job: cls.job,
      difficulty: cls.difficulty,
      private: Boolean(cls.private),
      classifier_model: cls.classifierModel || null,
      cost_usd: (Number(cls.usage?.costMicros) || 0) / 1_000_000,
      ms: ms(t0),
    };
  } catch (err) {
    return { ...row, status: "error", error: describeError(err) };
  }

  // openrouter/auto only makes text, so media prompts can't be compared. They are still classified
  // above, which shows how well the classifier spots them.
  const cls = row.classification;
  if (item.job_hint && MEDIA_JOBS.includes(item.job_hint)) return { ...row, status: "skipped", skip_reason: `media_hint_${item.job_hint}` };
  if (MEDIA_JOBS.includes(cls.job)) return { ...row, status: "skipped", skip_reason: `classified_${cls.job}` };

  const picked = await pickGode(deps, ctx, cls);
  // Apples to apples: when Gode must use zero-retention endpoints, so must the baseline.
  const zdr = picked.ok ? Boolean(picked.pick.zdrRequired) : cls.private;
  const [gode, auto] = await Promise.all([
    answerGode(deps, ctx, { picked, rawMessages, redactedMessages, classification: cls }),
    answerAuto(deps, ctx, { redactedMessages, zdr }),
  ]);
  const verdict = await decide(deps, ctx, { id: item.id, redactedPrompt: redactedMessages[0].content, gode, auto });
  return { ...row, gode, auto, verdict };
}

/** Run fn over items with at most `limit` in flight; results keep input order. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** One progress line per prompt: ids, jobs and model names only, never prompt or answer text. */
function progressLine(row, done, total) {
  const n = String(done).padStart(String(total).length);
  const head = `[${n}/${total}] ${row.id} ${(row.classification?.job || row.job_hint || "?").padEnd(6)}`;
  if (row.status === "skipped") return `${head} skipped (${row.skip_reason})`;
  if (row.status === "error") return `${head} failed (${row.error?.code})`;
  const g = row.gode.ok ? row.gode.label : `error:${row.gode.error?.code}`;
  const a = row.auto.ok ? row.auto.model_reported || "auto" : `error:${row.auto.error?.code}`;
  return `${head} gode=${g} auto=${a} -> ${row.verdict?.winner || "no verdict"}`;
}

/**
 * Benchmark a list of prompts.
 * @param {object} args
 * @param {object} args.deps        buildDeps() result (or test fakes with the same shape)
 * @param {Array<{id, prompt, job_hint}>} args.prompts
 * @param {object} args.judgeModel  resolveJudgeModel() result
 * @param {string} [args.plan]
 * @param {number} [args.concurrency]
 * @param {(line: string) => void} [args.log]
 */
async function runBenchmark({ deps, prompts, judgeModel, plan = "balanced", concurrency = 3, log = () => {}, answerTimeoutMs = ANSWER_TIMEOUT_MS, judgeTimeoutMs = JUDGE_TIMEOUT_MS }) {
  const ctx = {
    judgeModel,
    user: { plan, strict_privacy: false, eu_only: false },
    answerTimeoutMs,
    judgeTimeoutMs,
  };
  let done = 0;
  return mapLimit(prompts, Math.max(1, concurrency), async (item) => {
    let row;
    try {
      row = await runPrompt(deps, ctx, item);
    } catch (err) {
      // Defensive: runPrompt records failures itself; this keeps one bad prompt from ending the run.
      row = { id: item.id, job_hint: item.job_hint, status: "error", error: describeError(err), redactions: {} };
    }
    done += 1;
    log(progressLine(row, done, prompts.length));
    return row;
  });
}

/** File-name-safe ISO timestamp: 2026-11-26T19-40-00-000Z. */
function fileStamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

/** Write results-<ts>.json and summary-<ts>.md. Returns their paths. */
function writeReport(outDir, { meta, summary, results }, startedAt = new Date()) {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = fileStamp(startedAt);
  const resultsPath = path.join(outDir, `results-${stamp}.json`);
  const summaryPath = path.join(outDir, `summary-${stamp}.md`);
  fs.writeFileSync(resultsPath, `${JSON.stringify({ meta, summary, results }, null, 2)}\n`);
  fs.writeFileSync(summaryPath, renderMarkdown(summary, meta));
  return { resultsPath, summaryPath };
}

function relative(p) {
  const rel = path.relative(process.cwd(), p);
  return rel && !rel.startsWith("..") ? rel : p;
}

/**
 * CLI entry point. Returns the exit code instead of exiting, so tests can call it.
 * @param {string[]} argv
 * @param {Record<string,string|undefined>} env
 * @param {{ log: Function, error: Function }} io
 */
async function main(argv = process.argv.slice(2), env = process.env, io = console) {
  let opts;
  let deps = null;
  try {
    opts = parseArgs(argv);
    if (opts.help) {
      io.log(USAGE);
      return 0;
    }
    const prompts = loadPrompts(opts.prompts, opts.limit);
    deps = buildDeps({ env, dry: opts.dry, catalogFile: opts.catalog });
    const judgeModel = resolveJudgeModel(deps, opts.judge);
    checkLiveConfig(deps, judgeModel);

    const mode = deps.config.mock ? (opts.dry ? "dry run (mock mode)" : "mock mode: no gateway keys found, so this is a dry run") : "live";
    io.error(`Benchmarking ${prompts.length} prompts, ${mode}. Judge: ${judgeModel.id}. Plan: ${opts.plan}.`);
    const startedAt = new Date();
    const results = await runBenchmark({
      deps,
      prompts,
      judgeModel,
      plan: opts.plan,
      concurrency: opts.concurrency,
      log: (line) => io.error(line),
    });
    const finishedAt = new Date();
    const summary = summarize(results, { judgeModelId: judgeModel.id });
    const meta = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      mock: Boolean(deps.config.mock),
      dry: opts.dry,
      promptsFile: relative(opts.prompts),
      catalogFile: opts.catalog ? relative(opts.catalog) : null,
      limit: opts.limit,
      concurrency: opts.concurrency,
      plan: opts.plan,
      judgeModelId: judgeModel.id,
      judgeLabel: judgeModel.label,
      baseline: "openrouter/auto",
      node: process.version,
    };
    const paths = writeReport(opts.out, { meta, summary, results }, startedAt);
    const v = summary.verdicts;
    io.log(
      `Gode won ${v.gode}, tied ${v.tie}, lost ${v.auto} (${v.none} without verdict) over ${summary.compared} compared prompts; ` +
        `${summary.skipped.total} skipped. Cost Gode ${formatUsd(summary.gode.total_cost_usd)} vs auto ${formatUsd(summary.auto.total_cost_usd)}.`
    );
    io.log(`Summary: ${relative(paths.summaryPath)}`);
    io.log(`Results: ${relative(paths.resultsPath)}`);
    return 0;
  } catch (e) {
    if (e instanceof ConfigError) {
      io.error(`bench: ${e.message}`);
      if (!opts) io.error(USAGE);
      return 2;
    }
    throw e;
  } finally {
    deps?.close();
  }
}

if (require.main === module) {
  // Same .env as the server, wherever the script is started from. Real env vars win over the file.
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      // Unexpected crash (a bug, not a config problem). Messages never contain prompt text.
      console.error(`bench: crashed: ${err?.stack || err}`);
      process.exitCode = 1;
    }
  );
}

module.exports = {
  ConfigError,
  DEFAULT_JUDGE_MODEL_ID,
  USAGE,
  parseArgs,
  parsePromptsJsonl,
  loadPrompts,
  buildDeps,
  baselineModel,
  resolveJudgeModel,
  checkLiveConfig,
  costFromUsage,
  lookupReportedModel,
  streamAnswer,
  runPrompt,
  runBenchmark,
  mapLimit,
  fileStamp,
  writeReport,
  main,
};
