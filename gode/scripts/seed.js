#!/usr/bin/env node
// Seed the model catalog and routing table.
//
//   node scripts/seed.js            fill an empty catalog (no-op when models already exist)
//   node scripts/seed.js --force    upsert every seed model and reset the seeded routes
//
// --force overwrites admin and learner edits to the seeded route cells, which is why it is opt-in.
const path = require("path");

const USAGE = "Usage: node scripts/seed.js [--force]";

/** Parse CLI args. Returns { force, help } or throws on an unknown argument. */
function parseArgs(argv) {
  const opts = { force: false, help: false };
  for (const arg of argv) {
    if (arg === "--force" || arg === "-f") opts.force = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

/** Human-readable result lines; kept separate from I/O so the wording is easy to test. */
function describeResult(result, { force, databasePath, models, routes, classifierModelId }) {
  const lines = [];
  if (result.seeded) {
    lines.push(`${force ? "Re-seeded" : "Seeded"} ${result.models} models and ${result.routes} routes into ${databasePath}.`);
  } else {
    lines.push(`Catalog already has ${models} models; nothing changed. Use --force to upsert the seeds.`);
  }
  lines.push(`Catalog now: ${models} models, ${routes} routes. Default classifier: ${classifierModelId}.`);
  return lines;
}

/**
 * Run the seeder. Returns a process exit code instead of exiting so it can be called from tests.
 * @param {string[]} argv
 * @param {Record<string,string|undefined>} env
 * @param {{ log?: Function, error?: Function }} io
 */
function main(argv = process.argv.slice(2), env = process.env, io = console) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    io.error(`${e.message}\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    io.log(USAGE);
    return 0;
  }

  // Loaded lazily so `--help` works without touching config or the database.
  const { loadConfig } = require("../src/config");
  const { openDb } = require("../src/db");
  const { seedCatalog, CLASSIFIER_MODEL_ID } = require("../src/seed/catalog");

  const config = loadConfig(env);
  const db = openDb(config.databasePath);
  try {
    const result = seedCatalog(db, { force: opts.force });
    const models = db.prepare("SELECT COUNT(*) AS n FROM models").get().n;
    const routes = db.prepare("SELECT COUNT(*) AS n FROM routes").get().n;
    const classifierModelId = config.router.classifierModelId || CLASSIFIER_MODEL_ID;
    for (const line of describeResult(result, {
      force: opts.force,
      databasePath: config.databasePath,
      models,
      routes,
      classifierModelId,
    })) {
      io.log(line);
    }
    return 0;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  // Same .env as the server, wherever the script is started from. Real env vars win over the file.
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
  try {
    process.exitCode = main();
  } catch (e) {
    // A seed failure (bad schema, locked DB) must fail loudly for deploy scripts; no secrets are in it.
    console.error(`Seeding failed: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs, describeResult };
