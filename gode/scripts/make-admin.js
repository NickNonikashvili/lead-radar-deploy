#!/usr/bin/env node
// Grant or revoke admin for an existing account, directly in the database.
//
//   node scripts/make-admin.js you@example.com            make the account an admin
//   node scripts/make-admin.js you@example.com --revoke   take admin away
//
// This is the operator-only way to create the first admin in production, where the "first account
// becomes admin" rule is off (FIRST_USER_ADMIN). Sign up in the browser first, then run this on the
// server. With ADMIN_EMAILS set, that list alone decides who is an admin (it is re-checked on every
// request), so this script refuses to change anything: edit ADMIN_EMAILS and restart instead.
// Admin rights take effect on the user's next request; no restart is needed.
const path = require("path");

const USAGE = "Usage: node scripts/make-admin.js <email> [--revoke]";

/** Parse CLI args. Returns { email, revoke, help } or throws on bad input. */
function parseArgs(argv) {
  const opts = { email: null, revoke: false, help: false };
  for (const arg of argv) {
    if (arg === "--revoke") opts.revoke = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
    else if (opts.email) throw new Error("give exactly one email address");
    else opts.email = arg;
  }
  if (!opts.help && !opts.email) throw new Error("an email address is required");
  return opts;
}

/**
 * Run the command. Returns a process exit code instead of exiting so tests can call it.
 * @param {string[]} argv
 * @param {Record<string,string|undefined>} env
 * @param {{ log: Function, error: Function }} io
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
  const { loadConfig } = require("../src/config");
  const { openDb } = require("../src/db");
  const { normalizeEmail } = require("../src/auth");

  const email = normalizeEmail(opts.email);
  if (!email) {
    io.error("That is not a valid email address.");
    return 2;
  }
  const config = loadConfig(env);
  if (config.adminEmails.length) {
    io.error(
      "ADMIN_EMAILS is set, so it alone decides who is an admin (checked on every request). " +
        `${opts.revoke ? "Remove the address from" : "Add the address to"} ADMIN_EMAILS and restart Gode instead.`
    );
    return 1;
  }
  const db = openDb(config.databasePath);
  try {
    const row = db.prepare("SELECT id, is_admin FROM users WHERE email = ?").get(email);
    if (!row) {
      io.error("No account with that email. Sign up first, then run this again.");
      return 1;
    }
    const want = opts.revoke ? 0 : 1;
    if (Number(row.is_admin) === want) {
      io.log(opts.revoke ? "That account is not an admin; nothing changed." : "That account is already an admin; nothing changed.");
      return 0;
    }
    db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(want, row.id);
    io.log(opts.revoke ? "Admin rights removed." : "Admin rights granted. They apply on the account's next request.");
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
    console.error(`make-admin failed: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs };
