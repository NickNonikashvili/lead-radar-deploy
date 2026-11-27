#!/usr/bin/env node
// Reset a user's password when they can't log in (phase 1 has no email-based reset).
//
//   node scripts/reset-password.js user@example.com
//
// Sets a new random password, signs the account out everywhere and prints the password ONCE on
// this terminal. Give it to the user over a channel you trust and ask them to change it in
// Settings right away. It is not stored or logged anywhere else (only its scrypt hash is).
const path = require("path");

const USAGE = "Usage: node scripts/reset-password.js <email>";

function parseArgs(argv) {
  const opts = { email: null, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
    else if (opts.email) throw new Error("give exactly one email address");
    else opts.email = arg;
  }
  if (!opts.help && !opts.email) throw new Error("an email address is required");
  return opts;
}

/**
 * @param {string[]} argv
 * @param {Record<string,string|undefined>} env
 * @param {{ log: Function, error: Function }} io
 * @returns {Promise<number>} the exit code
 */
async function main(argv = process.argv.slice(2), env = process.env, io = console) {
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
  const { hashPassword, randomToken } = require("../src/crypto");

  const email = normalizeEmail(opts.email);
  if (!email) {
    io.error("That is not a valid email address.");
    return 2;
  }
  const config = loadConfig(env);
  const db = openDb(config.databasePath);
  try {
    const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (!row) {
      io.error("No account with that email.");
      return 1;
    }
    // 120 random bits, URL-safe so it survives copy and paste.
    const password = randomToken(15);
    const hash = await hashPassword(password);
    const signedOut = db.tx(() => {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, row.id);
      return db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id).changes;
    });
    io.log(`New one-time password: ${password}`);
    io.log(`Signed out ${signedOut} session(s). Ask the user to log in with it and change it in Settings at once.`);
    return 0;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  // Same .env as the server, wherever the script is started from. Real env vars win over the file.
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`reset-password failed: ${e.message}`);
      process.exitCode = 1;
    }
  );
}

module.exports = { main, parseArgs };
