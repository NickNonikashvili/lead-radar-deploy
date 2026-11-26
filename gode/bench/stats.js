// Summary statistics and the markdown report for bench/run.js. Pure functions over the result rows,
// so the numbers in the report are unit-tested.
//
// Result row shape (one per prompt), produced by bench/run.js:
//   { id, job_hint, status: 'compared'|'skipped'|'error', skip_reason, error,
//     redactions: {TYPE: n}, classification: { job, difficulty, private, classifier_model, cost_usd },
//     gode: Side|null, auto: Side|null, verdict: Verdict|null }
//   Side    = { ok, error, model_id, label, model_reported, cost_usd, latency_ms, ttft_ms,
//               output_tokens, ... }
//   Verdict = { winner: 'gode'|'auto'|'tie'|null, by_error, judge_cost_usd, error, ... }

// Same as src/seed/catalog.js MEDIA_JOBS; kept local so the stats load without the app modules.
const MEDIA_JOBS = ["image", "video", "music", "voice"];

const isNum = (x) => typeof x === "number" && Number.isFinite(x);

function sum(values) {
  return values.filter(isNum).reduce((a, b) => a + b, 0);
}

/** Arithmetic mean of the finite values, or null when there are none. */
function mean(values) {
  const xs = values.filter(isNum);
  return xs.length ? sum(xs) / xs.length : null;
}

/**
 * Percentile with linear interpolation between closest ranks (the common "type 7" definition:
 * p50 of [1,2,3,4] is 2.5). Non-finite values are ignored; empty input gives null.
 */
function percentile(values, p) {
  if (!isNum(p) || p < 0 || p > 100) throw new RangeError("percentile: p must be between 0 and 100");
  const xs = values.filter(isNum).sort((a, b) => a - b);
  if (!xs.length) return null;
  const rank = (p / 100) * (xs.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return xs[lo] + (xs[hi] - xs[lo]) * (rank - lo);
}

/** Percentage rounded to one decimal, or null when the denominator is 0. */
function pct(n, d) {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

/** Count occurrences: [['x', 3], ['y', 1]] sorted by count desc, then key. Null/empty keys skipped. */
function tally(keys) {
  const counts = new Map();
  for (const k of keys) {
    if (k === null || k === undefined || k === "") continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

/** Win/tie/loss from Gode's point of view over a set of verdicts. */
function verdictCounts(verdicts) {
  const out = { gode: 0, auto: 0, tie: 0, none: 0, by_error: 0 };
  for (const v of verdicts) {
    const w = v?.winner;
    if (w === "gode" || w === "auto" || w === "tie") out[w] += 1;
    else out.none += 1;
    if (v?.by_error && (w === "gode" || w === "auto")) out.by_error += 1;
  }
  out.decided = out.gode + out.auto + out.tie;
  out.win_pct = pct(out.gode, out.decided);
  out.tie_pct = pct(out.tie, out.decided);
  out.loss_pct = pct(out.auto, out.decided);
  return out;
}

/** Cost, latency and error figures for one side over the compared rows. */
function sideSummary(rows, side) {
  const sides = rows.map((r) => r[side]).filter(Boolean);
  const ok = sides.filter((s) => s.ok);
  const costs = ok.map((s) => s.cost_usd).filter(isNum);
  return {
    attempted: sides.length,
    ok: ok.length,
    errors: sides.length - ok.length,
    error_codes: tally(sides.filter((s) => !s.ok).map((s) => s.error?.code || "error")),
    cost_known: costs.length,
    cost_unknown: ok.length - costs.length,
    total_cost_usd: costs.length ? sum(costs) : null,
    mean_cost_usd: mean(costs),
    latency_p50_ms: percentile(ok.map((s) => s.latency_ms), 50),
    latency_p95_ms: percentile(ok.map((s) => s.latency_ms), 95),
    ttft_p50_ms: percentile(ok.map((s) => s.ttft_ms), 50),
    mean_output_tokens: mean(ok.map((s) => s.output_tokens)),
  };
}

/**
 * Cost ratio Gode / auto over prompts where BOTH sides answered with a known cost. Pairing matters:
 * comparing totals over different prompt sets would credit whichever side failed on expensive ones.
 */
function pairedCost(rows) {
  const pairs = rows.filter((r) => r.gode?.ok && r.auto?.ok && isNum(r.gode.cost_usd) && isNum(r.auto.cost_usd));
  const gode = sum(pairs.map((r) => r.gode.cost_usd));
  const auto = sum(pairs.map((r) => r.auto.cost_usd));
  const ratio = pairs.length && auto > 0 ? gode / auto : null;
  return {
    n: pairs.length,
    gode_usd: pairs.length ? gode : null,
    auto_usd: pairs.length ? auto : null,
    ratio,
    savings_pct: ratio === null ? null : Math.round((1 - ratio) * 1000) / 10,
  };
}

function perJob(compared) {
  const byJob = new Map();
  for (const r of compared) {
    const job = r.classification?.job || r.job_hint || "unknown";
    if (!byJob.has(job)) byJob.set(job, []);
    byJob.get(job).push(r);
  }
  return Object.fromEntries(
    [...byJob.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([job, rows]) => [
        job,
        {
          n: rows.length,
          ...verdictCounts(rows.map((r) => r.verdict)),
          gode_mean_cost_usd: mean(rows.filter((r) => r.gode?.ok).map((r) => r.gode.cost_usd)),
          auto_mean_cost_usd: mean(rows.filter((r) => r.auto?.ok).map((r) => r.auto.cost_usd)),
        },
      ])
  );
}

/** How often the classifier's job matched the prompt file's job_hint. */
function classifierAgreement(rows) {
  const judged = rows.filter((r) => r.job_hint && r.classification?.job);
  // `action` is answered as chat in phase 1, so the classifier saying "chat" for it is not a miss
  // for routing purposes; it is still reported as a mismatch so the classifier can be tuned.
  const agree = judged.filter((r) => r.classification.job === r.job_hint);
  return {
    n: judged.length,
    agree: agree.length,
    agreement_pct: pct(agree.length, judged.length),
    mismatches: tally(judged.filter((r) => r.classification.job !== r.job_hint).map((r) => `${r.job_hint} -> ${r.classification.job}`)),
    classifier_models: tally(rows.map((r) => r.classification?.classifier_model)),
    total_cost_usd: sum(rows.map((r) => r.classification?.cost_usd)),
  };
}

function redactionSummary(rows) {
  const entities = {};
  let prompts = 0;
  for (const r of rows) {
    const counts = r.redactions || {};
    const n = Object.values(counts).filter(isNum).reduce((a, b) => a + b, 0);
    if (n > 0) prompts += 1;
    for (const [type, c] of Object.entries(counts)) if (isNum(c)) entities[type] = (entities[type] || 0) + c;
  }
  return { prompts_with_redactions: prompts, entities };
}

/**
 * Aggregate the per-prompt rows into the numbers the report shows.
 * @param {Array<object>} results
 * @param {{ judgeModelId?: string }} [opts]
 */
function summarize(results, { judgeModelId = null } = {}) {
  const rows = Array.isArray(results) ? results : [];
  const compared = rows.filter((r) => r.status === "compared");
  const skipped = rows.filter((r) => r.status === "skipped");
  const failed = rows.filter((r) => r.status === "error");
  const verdicts = compared.map((r) => r.verdict);

  // Self-preference check: LLM judges tend to favour answers written by themselves.
  const judgeSlug = judgeModelId ? String(judgeModelId).replace(/^[a-z]+:/, "") : null;
  const sameAsJudge = (s) => Boolean(judgeSlug && s?.ok && (s.model_id === judgeModelId || slugOf(s) === judgeSlug));

  return {
    prompts: rows.length,
    compared: compared.length,
    skipped: { total: skipped.length, by_reason: tally(skipped.map((r) => r.skip_reason || "skipped")) },
    failed: { total: failed.length, codes: tally(failed.map((r) => r.error?.code || "error")) },
    verdicts: verdictCounts(verdicts),
    judge: {
      model_id: judgeModelId,
      // Rows decided by a side failing never reached the judge, so they are not judge errors.
      errors: compared.filter((r) => r.verdict?.error && !r.verdict?.by_error).length,
      total_cost_usd: sum(compared.map((r) => r.verdict?.judge_cost_usd)),
      answered_by_judge_model: {
        gode: compared.filter((r) => sameAsJudge(r.gode)).length,
        auto: compared.filter((r) => sameAsJudge(r.auto)).length,
      },
    },
    gode: sideSummary(compared, "gode"),
    auto: sideSummary(compared, "auto"),
    cost: pairedCost(compared),
    per_job: perJob(compared),
    models: {
      gode: tally(compared.filter((r) => r.gode?.ok).map((r) => r.gode.label || r.gode.model_id)),
      auto: tally(compared.filter((r) => r.auto?.ok).map((r) => r.auto.model_reported || "unknown")),
    },
    classifier: classifierAgreement(rows),
    redaction: redactionSummary(rows),
  };
}

/** The upstream slug a side's answer came from (auto reports the model it chose). */
function slugOf(side) {
  if (side.model_reported) return String(side.model_reported).replace(/-\d{8}$/, "");
  return side.model_id ? String(side.model_id).replace(/^[a-z]+:/, "") : null;
}

// ---------------------------------------------------------------------------------------------
// Markdown

/** USD with enough precision to be meaningful for both totals and sub-cent means. */
function formatUsd(x) {
  if (!isNum(x)) return "n/a";
  const a = Math.abs(x);
  if (a === 0) return "$0";
  if (a >= 1) return `$${x.toFixed(2)}`;
  if (a >= 0.01) return `$${x.toFixed(4)}`;
  return `$${x.toFixed(6)}`;
}

function formatMs(x) {
  if (!isNum(x)) return "n/a";
  return x >= 10_000 ? `${(x / 1000).toFixed(1)} s` : `${Math.round(x)} ms`;
}

/** "1 prompt", "3 prompts". */
function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatPct(x) {
  return isNum(x) ? `${x.toFixed(1)}%` : "n/a";
}

/** Escape a value for a markdown table cell. */
function cell(v) {
  return String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function table(headers, rows) {
  const lines = [`| ${headers.map(cell).join(" | ")} |`, `|${headers.map(() => " --- ").join("|")}|`];
  for (const r of rows) lines.push(`| ${r.map(cell).join(" | ")} |`);
  return lines.join("\n");
}

/**
 * Render the human summary.
 * @param {object} summary  summarize() output
 * @param {{ startedAt?: string, finishedAt?: string, promptsFile?: string, mock?: boolean, plan?: string,
 *           judgeModelId?: string, judgeLabel?: string, catalogFile?: string|null }} meta
 */
function renderMarkdown(summary, meta = {}) {
  const s = summary;
  const v = s.verdicts;
  const out = [];
  out.push("# Gode vs openrouter/auto");
  out.push("");
  out.push(
    `Run ${meta.startedAt || ""}${meta.finishedAt ? ` to ${meta.finishedAt}` : ""}. ` +
      `${s.prompts} prompts from \`${meta.promptsFile || "?"}\`; ${s.compared} compared, ${s.skipped.total} skipped (non-text), ` +
      `${s.failed.total} failed before answering. Gode plan: ${meta.plan || "balanced"}. ` +
      `Routing table: ${meta.catalogFile ? `\`${meta.catalogFile}\`` : "seed catalog"}. ` +
      `Judge: ${meta.judgeLabel || meta.judgeModelId || "?"}.`
  );
  if (meta.mock) {
    out.push("");
    out.push(
      "> **Dry run (mock mode).** Answers came from the offline mock provider and no AI was called. " +
        "The mock judge returns no verdict, and openrouter/auto's cost is unknown, so verdicts and the " +
        "cost ratio below say nothing about real quality. Use this run to check the plumbing only."
    );
  }
  out.push("");
  out.push("## Headline");
  out.push("");
  out.push(
    v.decided
      ? `Gode won **${formatPct(v.win_pct)}**, tied **${formatPct(v.tie_pct)}** and lost **${formatPct(v.loss_pct)}** ` +
          `of ${plural(v.decided, "decided comparison")} (${v.gode} / ${v.tie} / ${v.auto})` +
          `${v.by_error ? `; ${v.by_error} of these were decided because one side failed` : ""}. ` +
          `${plural(v.none, "comparison")} had no verdict.`
      : `No comparison was decided; ${plural(v.none, "comparison")} had no verdict.`
  );
  out.push("");
  const c = s.cost;
  out.push(
    table(
      ["", "Gode", "openrouter/auto"],
      [
        ["Answers OK / failed", `${s.gode.ok} / ${s.gode.errors}`, `${s.auto.ok} / ${s.auto.errors}`],
        ["Total cost (answers with known cost)", formatUsd(s.gode.total_cost_usd), formatUsd(s.auto.total_cost_usd)],
        ["Mean cost per prompt", formatUsd(s.gode.mean_cost_usd), formatUsd(s.auto.mean_cost_usd)],
        ["Answers with unknown cost", s.gode.cost_unknown, s.auto.cost_unknown],
        ["Latency p50", formatMs(s.gode.latency_p50_ms), formatMs(s.auto.latency_p50_ms)],
        ["Latency p95", formatMs(s.gode.latency_p95_ms), formatMs(s.auto.latency_p95_ms)],
        ["Time to first token p50", formatMs(s.gode.ttft_p50_ms), formatMs(s.auto.ttft_p50_ms)],
        ["Mean output tokens", isNum(s.gode.mean_output_tokens) ? Math.round(s.gode.mean_output_tokens) : "n/a", isNum(s.auto.mean_output_tokens) ? Math.round(s.auto.mean_output_tokens) : "n/a"],
      ]
    )
  );
  out.push("");
  out.push(
    c.ratio === null
      ? "Cost ratio: n/a (no prompt where both sides answered with a known cost)."
      : `Cost ratio Gode / auto over the ${c.n} prompts where both costs are known: **${c.ratio.toFixed(3)}** ` +
          `(${formatUsd(c.gode_usd)} vs ${formatUsd(c.auto_usd)}; ${c.savings_pct >= 0 ? `${c.savings_pct}% cheaper` : `${-c.savings_pct}% dearer`}).`
  );
  out.push("");
  out.push(
    "Gode's cost includes its classifier call; its latency includes classification and the pick. " +
      "Both sides received the same redacted prompt."
  );

  out.push("");
  out.push("## Per job (as classified by Gode)");
  out.push("");
  const jobs = Object.entries(s.per_job);
  out.push(
    jobs.length
      ? table(
          ["Job", "n", "Gode wins", "Ties", "Auto wins", "No verdict", "Win %", "Gode mean cost", "Auto mean cost"],
          jobs.map(([job, j]) => [job, j.n, j.gode, j.tie, j.auto, j.none, formatPct(j.win_pct), formatUsd(j.gode_mean_cost_usd), formatUsd(j.auto_mean_cost_usd)])
        )
      : "_No compared prompts._"
  );

  out.push("");
  out.push("## Models Gode picked");
  out.push("");
  out.push(s.models.gode.length ? table(["Model", "Prompts"], s.models.gode) : "_None._");
  out.push("");
  out.push("## Models openrouter/auto picked");
  out.push("");
  out.push(s.models.auto.length ? table(["Model (as reported)", "Prompts"], s.models.auto) : "_None._");

  out.push("");
  out.push("## Classifier");
  out.push("");
  const k = s.classifier;
  out.push(
    `Agreed with the prompt file's job_hint on ${k.agree} of ${k.n} prompts (${formatPct(k.agreement_pct)}). ` +
      `Classifier cost over all prompts: ${formatUsd(k.total_cost_usd)}. ` +
      `Classifier used: ${k.classifier_models.map(([m, n]) => `${m} (${n})`).join(", ") || "n/a"}.`
  );
  if (k.mismatches.length) {
    out.push("");
    out.push(table(["job_hint -> classified", "Prompts"], k.mismatches));
  }

  out.push("");
  out.push("## Skipped and failed");
  out.push("");
  out.push(
    s.skipped.total
      ? `Skipped ${plural(s.skipped.total, "media request")} (openrouter/auto only makes text): ` +
          s.skipped.by_reason.map(([r, n]) => `${r} (${n})`).join(", ") + "."
      : "No prompts were skipped."
  );
  if (s.failed.total) {
    out.push("");
    out.push(`${plural(s.failed.total, "prompt")} failed before either side answered: ${s.failed.codes.map(([r, n]) => `${r} (${n})`).join(", ")}.`);
  }
  const errLine = (name, side) =>
    side.errors ? `${name} failed on ${plural(side.errors, "prompt")}: ${side.error_codes.map(([r, n]) => `${r} (${n})`).join(", ")}.` : null;
  for (const line of [errLine("Gode", s.gode), errLine("openrouter/auto", s.auto)]) {
    if (line) {
      out.push("");
      out.push(line);
    }
  }

  out.push("");
  out.push("## Redaction");
  out.push("");
  const entities = Object.entries(s.redaction.entities).sort((a, b) => b[1] - a[1]);
  out.push(
    `${plural(s.redaction.prompts_with_redactions, "prompt")} had personal details replaced before anything left: ` +
      (entities.length ? entities.map(([t, n]) => `${t} ${n}`).join(", ") : "none") +
      "."
  );

  out.push("");
  out.push("## How to read this");
  out.push("");
  const notes = [
    "The judge is an LLM comparing the two answers pairwise. Gode's answer was put in slot A or B by a hash of the prompt id, so position bias cancels out over many prompts and reruns use the same order.",
    "A side that failed to answer loses that prompt; both failing gives no verdict. Judge errors also give no verdict.",
    `Judge cost: ${formatUsd(s.judge.total_cost_usd)}; judge errors: ${s.judge.errors}.`,
  ];
  const self = s.judge.answered_by_judge_model;
  if (self.gode || self.auto) {
    notes.push(
      `Caution: the judge model also wrote ${self.gode} of Gode's and ${self.auto} of auto's answers. LLM judges can favour their own writing; rerun with a different --judge to check.`
    );
  }
  for (const n of notes) out.push(`- ${n}`);
  out.push("");
  return out.join("\n");
}

module.exports = {
  MEDIA_JOBS,
  sum,
  mean,
  percentile,
  pct,
  tally,
  verdictCounts,
  sideSummary,
  pairedCost,
  classifierAgreement,
  redactionSummary,
  summarize,
  formatUsd,
  formatMs,
  plural,
  renderMarkdown,
};
