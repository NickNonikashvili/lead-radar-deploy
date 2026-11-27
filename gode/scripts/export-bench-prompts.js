#!/usr/bin/env node
// Export real user prompts for the benchmark, ONLY from users who opted in (share_prompts = 1),
// with personal details replaced by placeholders.
//
//   node scripts/export-bench-prompts.js [--out bench/prompts.real.jsonl] [--limit 200]
//
// What is exported per prompt: a pseudonymous id (a hash of the message id, so a row cannot be
// looked up without the database), the redacted prompt text, and the job the router gave it.
// Never exported: user ids, emails, conversation ids, timestamps, answers. Conversations the router
// ever treated as private (health, money, legal, ...) are left out entirely, even for opted-in
// users: conversations.private, or any request of the conversation marked private, including turns
// whose answer failed or was stopped (they have no answer to link the privacy flag through).
//
// Each conversation is redacted the way the chat redacted it: in order, with its stored placeholder
// map, so a name introduced in an earlier turn ("my name is Jane Doe") stays hidden when a later
// prompt mentions it without the trigger phrase.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const JOBS = ["chat", "code", "image", "video", "music", "voice", "action"];
const DEFAULT_OUT = path.join(__dirname, "..", "bench", "prompts.real.jsonl");
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 100_000;
// Fixed salts: the sample and the exported ids are stable across runs (same DB -> same file).
const SAMPLE_SALT = "gode-bench-sample:";
const ID_SALT = "gode-bench-export:";

const USAGE = `Usage: node scripts/export-bench-prompts.js [--out <file>] [--limit N]

Exports up to N user prompts (default ${DEFAULT_LIMIT}) as benchmark JSONL {id, prompt, job_hint},
only from users who turned on "share prompts", with personal details replaced by placeholders
(each conversation is redacted with its own placeholder map, as in the chat). Conversations the
router ever treated as private are never exported. The sample is random but stable.

Options:
  --out <file>   output file   (default bench/prompts.real.jsonl; keep it out of git)
  --limit N      max prompts   (default ${DEFAULT_LIMIT})
  -h, --help     show this help

Then: node bench/run.js --prompts bench/prompts.real.jsonl`;

class ConfigError extends Error {}

function parseArgs(argv) {
  const opts = { out: DEFAULT_OUT, limit: DEFAULT_LIMIT, help: false };
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let value;
    const eq = arg.indexOf("=");
    if (arg.startsWith("--") && eq > 0) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--out" || arg === "--limit") {
      if (value === undefined) value = argv[++i];
      if (value === undefined || value === "") throw new ConfigError(`${arg} needs a value`);
      if (arg === "--out") opts.out = path.resolve(value);
      else {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) throw new ConfigError(`--limit must be a whole number between 1 and ${MAX_LIMIT}`);
        opts.limit = n;
      }
    } else {
      throw new ConfigError(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

const sha256hex = (s) => crypto.createHash("sha256").update(s).digest("hex");

/** Order rows by a salted hash of their id: a random-looking sample that is the same every run. */
function stableSample(rows, limit, salt = SAMPLE_SALT) {
  return rows
    .map((r) => ({ r, k: sha256hex(salt + r.id) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .slice(0, limit)
    .map((x) => x.r);
}

/** Pseudonymous, stable export id: cannot be mapped back to a message without the database. */
function exportId(messageId) {
  return `r${sha256hex(ID_SALT + messageId).slice(0, 12)}`;
}

/**
 * Candidate user messages from opted-in users, newest version only, with the router's job (from
 * the request that answered them) and whether their conversation was ever private. Privacy is
 * judged per conversation: text turns re-send earlier messages, a failed or stopped private turn
 * has no answer to link its request through (requests.message_id is NULL), and the placeholder map
 * that redacts the conversation holds the private turn's values too.
 */
function selectCandidates(db) {
  return db
    .prepare(
      `SELECT m.id, m.user_id, m.conversation_id, m.content_enc, u.wrapped_dek, c.pii_map_enc,
              (SELECT r.job FROM messages a JOIN requests r ON r.id = a.request_id OR r.message_id = a.id
                WHERE a.parent_id = m.id AND a.role = 'assistant'
                ORDER BY a.superseded ASC, a.created_at DESC LIMIT 1) AS job,
              (c.private = 1
               OR EXISTS (SELECT 1 FROM requests r WHERE r.conversation_id = m.conversation_id AND r.private = 1)
               OR EXISTS (SELECT 1 FROM messages a JOIN requests r ON r.id = a.request_id OR r.message_id = a.id
                           WHERE a.conversation_id = m.conversation_id AND a.role = 'assistant' AND r.private = 1)) AS private
         FROM messages m
         JOIN users u ON u.id = m.user_id
         JOIN conversations c ON c.id = m.conversation_id
        WHERE m.role = 'user' AND m.superseded = 0 AND u.share_prompts = 1`
    )
    .all();
}

/** Message text from the decrypted content ({ text, media? } JSON; plain strings tolerated). */
function messageText(content) {
  if (typeof content === "string") return content;
  return content && typeof content.text === "string" ? content.text : "";
}

/**
 * Redact one conversation the way the chat did: every current message in order, with the
 * conversation's stored (decrypted) placeholder map. Returns Map(message id -> redacted text), or
 * null when the map cannot be decrypted (never fall back to redacting without it).
 */
async function redactConversation({ db, keyring, redactor }, { conversationId, wrappedDek, piiMapEnc }) {
  let map = null;
  if (piiMapEnc) {
    try {
      map = keyring.decrypt(wrappedDek, piiMapEnc, { json: true });
    } catch {
      return null;
    }
  }
  const rows = db
    .prepare("SELECT id, role, content_enc FROM messages WHERE conversation_id = ? AND superseded = 0 ORDER BY created_at, rowid")
    .all(conversationId);
  const messages = [];
  for (const row of rows) {
    let text;
    try {
      text = messageText(keyring.decrypt(wrappedDek, row.content_enc, { json: true }));
    } catch {
      continue; // counted when the row itself is a candidate
    }
    if (text.trim() && (row.role === "user" || row.role === "assistant")) messages.push({ id: row.id, role: row.role, content: text });
  }
  if (!messages.length) return new Map();
  // Always redact, whatever REDACTION says: the opt-in promise is "redacted prompts only".
  const red = await redactor.redactMessages(
    messages.map(({ role, content }) => ({ role, content })),
    map,
    { mode: "placeholder" }
  );
  return new Map(messages.map((m, i) => [m.id, red.messages[i].content]));
}

/**
 * Build the export rows. Walks the stable order until `limit` usable prompts are found, so skipped
 * rows (private, empty, undecryptable) do not shrink the sample.
 * @returns {Promise<{ rows: Array<{id, prompt, job_hint?}>, stats: object }>}
 */
async function buildExport({ db, keyring, redactor, limit }) {
  const candidates = selectCandidates(db);
  const ordered = stableSample(candidates, candidates.length);
  const stats = { candidates: candidates.length, private: 0, empty: 0, undecryptable: 0, redacted_prompts: 0, users: 0 };
  const users = new Set();
  const rows = [];
  const conversations = new Map(); // conversation id -> Promise<Map | null>
  for (const c of ordered) {
    if (rows.length >= limit) break;
    if (Number(c.private) === 1) {
      stats.private += 1;
      continue;
    }
    let text;
    try {
      text = messageText(keyring.decrypt(c.wrapped_dek, c.content_enc, { json: true }));
    } catch {
      // Wrong master key or a corrupt row; counted, and the whole run fails below if nothing decrypts.
      stats.undecryptable += 1;
      continue;
    }
    if (!text.trim()) {
      stats.empty += 1;
      continue;
    }
    if (!conversations.has(c.conversation_id)) {
      conversations.set(
        c.conversation_id,
        redactConversation({ db, keyring, redactor }, { conversationId: c.conversation_id, wrappedDek: c.wrapped_dek, piiMapEnc: c.pii_map_enc })
      );
    }
    const redacted = await conversations.get(c.conversation_id);
    const prompt = redacted ? redacted.get(c.id) : undefined;
    if (typeof prompt !== "string") {
      // The conversation's placeholder map would not decrypt: no export without it.
      stats.undecryptable += 1;
      continue;
    }
    if (prompt !== text) stats.redacted_prompts += 1;
    const row = { id: exportId(c.id), prompt };
    if (JOBS.includes(c.job)) row.job_hint = c.job;
    rows.push(row);
    users.add(c.user_id);
  }
  stats.users = users.size;
  return { rows, stats };
}

/** Write JSONL atomically, readable by the owner only (redacted, but still real people's words). */
function writeJsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/**
 * Run the export. Returns the exit code instead of exiting, so tests can call it.
 * @param {string[]} argv
 * @param {Record<string,string|undefined>} env
 * @param {{ log: Function, error: Function }} io
 */
async function main(argv = process.argv.slice(2), env = process.env, io = console) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    io.error(`export: ${e.message}\n\n${USAGE}`);
    return 2;
  }
  if (opts.help) {
    io.log(USAGE);
    return 0;
  }

  const { loadConfig } = require("../src/config");
  const { openDb } = require("../src/db");
  const { loadMasterKey, createKeyring } = require("../src/crypto");
  const { createRedactor } = require("../src/redact");

  const config = loadConfig(env);
  if (!fs.existsSync(config.databasePath)) {
    io.error(`export: no database at ${config.databasePath}. Set DATABASE_PATH or DATA_DIR to the server's data.`);
    return 2;
  }
  // loadMasterKey creates a fresh development key when none exists, which could never decrypt
  // anything already stored; require the server's real key instead.
  if (!config.masterKey && !fs.existsSync(path.join(config.dataDir, "master.key"))) {
    io.error("export: no master key. Set GODE_MASTER_KEY to the server's key (or DATA_DIR to the folder holding master.key).");
    return 2;
  }
  let keyring;
  try {
    keyring = createKeyring(loadMasterKey(config));
  } catch (e) {
    io.error(`export: ${e.message}`);
    return 2;
  }
  const redactor = createRedactor(config);

  const db = openDb(config.databasePath);
  let result;
  try {
    result = await buildExport({ db, keyring, redactor, limit: opts.limit });
  } finally {
    db.close();
  }
  const { rows, stats } = result;
  if (!rows.length && stats.undecryptable > 0) {
    io.error(`export: none of the ${stats.undecryptable} opted-in prompts could be decrypted. Is GODE_MASTER_KEY the key the server uses?`);
    return 2;
  }
  writeJsonl(opts.out, rows);
  io.log(
    `Exported ${rows.length} prompts from ${stats.users} opted-in users to ${opts.out} ` +
      `(${stats.redacted_prompts} had personal details replaced; skipped ${stats.private} private, ` +
      `${stats.empty} empty, ${stats.undecryptable} undecryptable; ${stats.candidates} candidates).`
  );
  if (!stats.candidates) io.log("No user has turned on prompt sharing yet (Settings -> share prompts).");
  return 0;
}

if (require.main === module) {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(`export: failed: ${err?.message || err}`);
      process.exitCode = 1;
    }
  );
}

module.exports = { main, parseArgs, stableSample, exportId, selectCandidates, redactConversation, buildExport, messageText, USAGE, ConfigError };
