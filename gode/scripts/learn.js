#!/usr/bin/env node
// Weekly learner: prints the phase-1 gate metrics and the routing changes the logs support, stores
// the run (learn_runs, source 'cli') so an admin can review and apply it on the admin page, and
// with --apply writes them to the routing table at once (source 'learn', recorded in route_history).
//
// Reads only the metadata log (requests table): picks, cost, latency, 👍/👎, regenerate, switch.
// It never sees prompts or answers.
const fs = require("fs");
const path = require("path");

const DAY_MS = 24 * 60 * 60 * 1000;

const USAGE = `Usage: node scripts/learn.js [--days N] [--min-samples N] [--apply]

Reads Gode's routing log, prints the phase-1 gate metrics and the routing-table changes the
ratings support, comparing models only within each routing cell (job x tier): best satisfaction
for quality, best value for balanced, cheapest-as-good for budget, never a less-liked model for
quality or balanced; the private tier is never changed. The run is stored for the admin page
(/#/admin), where it can be reviewed and applied. Without --apply the routing table is unchanged.

Options:
  --days N          look back N days                                    (default LEARN_WINDOW_DAYS, 28)
  --min-samples N   ratings (thumbs, regenerates, switches) a model needs
                    in a routing cell before it counts                  (default LEARN_MIN_SAMPLES, 20)
  --apply           also write the proposals to the routing table now (change them back in /#/admin)
  -h, --help        show this help

Run it weekly, then review and apply the run on the admin page. Example crontab line (Mondays
04:17, server time), from the app directory:
  17 4 * * 1  cd /srv/gode && /usr/bin/node scripts/learn.js >> data/learn.log 2>&1
On hosts where a cron job can't reach the server's database (Render, Railway), set
LEARN_SCHEDULE=weekly instead: the server runs the learner itself and stores the run.`;

/** A user-facing problem (bad flag, missing database): printed without a stack, exit code 2. */
class ConfigError extends Error {}

function positiveInt(flag, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 3650) throw new ConfigError(`${flag} must be a whole number between 1 and 3650`);
  return n;
}

/** Parse argv. Returns { days, minSamples, apply, help } (days/minSamples null = config default). */
function parseArgs(argv) {
  const opts = { days: null, minSamples: null, apply: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let value;
    const eq = arg.indexOf("=");
    if (arg.startsWith("--") && eq > 0) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--days" || arg === "--min-samples") {
      if (value === undefined) value = argv[++i];
      if (value === undefined) throw new ConfigError(`${arg} needs a value`);
      if (arg === "--days") opts.days = positiveInt(arg, value);
      else opts.minSamples = positiveInt(arg, value);
    } else {
      throw new ConfigError(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------------------------
// Formatting (pure, so the wording is easy to test)

const na = (v) => v === null || v === undefined;
const fmtPct = (v) => (na(v) ? "n/a" : `${Number(v).toFixed(1)}%`);
const fmtRate = (v) => (na(v) ? "n/a" : `${(Number(v) * 100).toFixed(1)}%`);
const fmtUsd = (v) => (na(v) ? "n/a" : `$${Number(v).toFixed(4)}`);
const fmtInt = (v) => (na(v) ? "n/a" : Number(v).toLocaleString("en-US"));

/** Lines describing gateMetrics(). Rates (0..1) and *_pct fields are rendered as percentages. */
function formatGate(gate, { days }) {
  const since = new Date(gate.since_ms ?? Date.now() - days * DAY_MS).toISOString().slice(0, 10);
  const failed = na(gate.failed_api_cost_usd) ? "" : ` (${fmtUsd(gate.failed_api_cost_usd)} on failed or stopped requests)`;
  const rows = [
    ["Active users", `${fmtInt(gate.users)}${na(gate.total_users) ? "" : ` (of ${fmtInt(gate.total_users)} signed up)`}`],
    ["Auto-pick kept (active users, from their requests)", fmtPct(gate.auto_pick_kept_pct)],
    ["Auto-pick on now (same users)", fmtPct(gate.auto_pick_on_pct)],
    ["Auto-picked share of new turns", fmtPct(gate.auto_requests_pct)],
    ["Override rate (switches / auto picks)", fmtRate(gate.override_rate)],
    ["Requests", fmtInt(gate.requests)],
    ["API cost (what we paid)", `${fmtUsd(gate.api_cost_usd)}${failed}`],
    ["Charged (taken from balances)", fmtUsd(gate.charged_usd)],
    ["Gross margin", fmtPct(gate.gross_margin_pct)],
    ["Purchases (real money in)", fmtUsd(gate.purchases_usd)],
    ["Free credit granted (signup bonus, dev top-ups)", `${fmtUsd(gate.free_credit_usd)}${na(gate.free_credit_share_pct) ? "" : ` (${fmtPct(gate.free_credit_share_pct)} of credit granted)`}`],
    ["Thumbs-up rate (of rated answers)", fmtRate(gate.thumbs_up_rate)],
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  const lines = [`Gate metrics, last ${days} days (since ${since}):`];
  for (const [k, v] of rows) lines.push(`  ${k.padEnd(width)}  ${v}`);
  // Phase-1 gate from the roadmap: "people keep auto-pick on and credits cover API costs".
  // Reported, not judged: what counts as "keep auto-pick on" is the founder's call. Charges paid
  // from free credit are not revenue, so the cash figure is printed next to the credit one.
  const yes = (v) => (v ? "yes" : "NO");
  const covers = gate.requests ? yes(gate.charged_usd >= gate.api_cost_usd) : "n/a (no requests)";
  const cash = gate.requests && !na(gate.cash_covers_api_costs) ? `; purchases cover API costs: ${yes(gate.cash_covers_api_costs)}` : "";
  const kept = na(gate.auto_pick_kept_pct) && !na(gate.auto_pick_on_pct) ? gate.auto_pick_on_pct : gate.auto_pick_kept_pct;
  lines.push("");
  lines.push(`Phase-1 gate: auto-pick kept on by ${fmtPct(kept)} of active users; credits cover API costs: ${covers}${cash}.`);
  return lines;
}

/** Fixed-width text table. */
function textTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ").trimEnd();
  return [line(headers), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)];
}

/** Lines describing the proposals. `labelOf(id)` maps a model id to its display label. */
function formatProposals(proposals, { minSamples, labelOf = (id) => id }) {
  if (!proposals.length) {
    return [
      `No routing changes proposed (a routing cell changes only when its current model and a better one each have at least ${minSamples} ratings in that cell).`,
    ];
  }
  // n = ratings in the cell (what --min-samples counts).
  const score = (s, n) => (na(s) ? "n/a" : `${Number(s).toFixed(2)}${na(n) ? "" : ` (n=${n})`}`);
  const rows = proposals.map((p) => [
    p.job,
    p.tier,
    labelOf(p.current_model_id),
    labelOf(p.proposed_model_id),
    score(p.current_score, p.current_n),
    score(p.proposed_score, p.proposed_n),
  ]);
  const lines = [`${proposals.length} proposed routing change${proposals.length === 1 ? "" : "s"}:`, ""];
  lines.push(...textTable(["Job", "Tier", "Current", "Proposed", "Current score", "Proposed score"], rows));
  lines.push("");
  lines.push("Why:");
  for (const p of proposals) lines.push(`  ${p.job}/${p.tier}: ${p.reason}`);
  return lines;
}

// ---------------------------------------------------------------------------------------------

/**
 * Run the learner. Returns the exit code instead of exiting, so tests can call it.
 * @param {string[]} argv
 * @param {Record<string,string|undefined>} env
 * @param {{ log: Function, error: Function }} io
 */
function main(argv = process.argv.slice(2), env = process.env, io = console) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    io.error(`learn: ${e.message}\n\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    io.log(USAGE);
    return 0;
  }

  // Loaded lazily so --help works without config or a database.
  const { loadConfig } = require("../src/config");
  const { openDb } = require("../src/db");
  const { getModel } = require("../src/seed/catalog");
  const { gateMetrics, proposeRoutes, applyProposals, recordLearnRun } = require("../src/router/learn");

  const config = loadConfig(env);
  // openDb would happily create an empty database; a learner run against nothing is a mistake.
  if (!fs.existsSync(config.databasePath)) {
    io.error(`learn: no database at ${config.databasePath}. Set DATABASE_PATH or DATA_DIR to the server's data.`);
    return 2;
  }
  const days = opts.days ?? config.learn.windowDays;
  const minSamples = opts.minSamples ?? config.learn.minSamples;
  // Absolute timestamp (not a lookback) so "since" is unambiguous for every learn.js function.
  const sinceMs = Date.now() - days * DAY_MS;

  const db = openDb(config.databasePath);
  try {
    const gate = gateMetrics(db, { sinceMs });
    const proposals = proposeRoutes(db, { minSamples, sinceMs });
    const labelOf = (id) => getModel(db, id)?.label || id;

    for (const line of formatGate(gate, { days })) io.log(line);
    io.log("");
    for (const line of formatProposals(proposals, { minSamples, labelOf })) io.log(line);

    const applied = opts.apply && proposals.length ? applyProposals(db, proposals, { source: "learn" }) : 0;
    const runId = recordLearnRun(db, { source: "cli", days, proposals, applied });
    if (opts.apply && proposals.length) {
      io.log("");
      io.log(`Applied ${applied} of ${proposals.length} (cells changed since the proposal are skipped). Each change is recorded in route_history.`);
    } else if (proposals.length) {
      io.log("");
      io.log(`Dry run: routing table unchanged. Stored as learner run ${runId}: review and apply it on the admin page, or re-run with --apply.`);
    }
    return 0;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  // Same .env as the server, wherever the script is started from. Real env vars win over the file.
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
  try {
    process.exitCode = main();
  } catch (e) {
    // A database problem must fail loudly for cron. Messages carry no user data.
    console.error(`learn: failed: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs, formatGate, formatProposals, textTable, USAGE, ConfigError };
