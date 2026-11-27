// SQLite storage via Node's built-in node:sqlite (Node >= 22.5): no native build step.
// All access is synchronous and the app runs as a single process, so a BEGIN IMMEDIATE ... COMMIT
// block is atomic with respect to other requests. Pragmas set per connection in openDb():
// foreign_keys, busy_timeout 5 s, secure_delete, and for files WAL with synchronous=FULL.
const fs = require("fs");
const path = require("path");

// node:sqlite prints an ExperimentalWarning on Node 22. Silence only that one warning.
const origEmit = process.emitWarning;
process.emitWarning = function (warning, ...args) {
  const msg = typeof warning === "string" ? warning : warning?.message;
  if (msg && msg.includes("SQLite is an experimental feature")) return;
  return origEmit.call(process, warning, ...args);
};
const { DatabaseSync } = require("node:sqlite");

// Every migration runs once, in order. Append new ones; never edit an applied one.
const MIGRATIONS = [
  // 1: core schema
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    wrapped_dek TEXT NOT NULL,              -- per-user data key, wrapped with the master key
    is_admin INTEGER NOT NULL DEFAULT 0,
    plan TEXT NOT NULL DEFAULT 'balanced',  -- saver | balanced | best  (picks the routing column)
    strict_privacy INTEGER NOT NULL DEFAULT 0, -- only zero-data-retention or self-hosted models
    eu_only INTEGER NOT NULL DEFAULT 0,     -- text jobs only use EU-hosted models
    auto_pick INTEGER NOT NULL DEFAULT 1,   -- router picks the model (gate metric)
    share_prompts INTEGER NOT NULL DEFAULT 0, -- opt-in: redacted prompts may be exported for benchmarks
    balance_micros INTEGER NOT NULL DEFAULT 0, -- prepaid credit, micro-USD, customer prices
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,            -- sha256 of the cookie token; raw token is never stored
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  -- Model catalog. One row per upstream model on one gateway. Prices are what WE pay.
  CREATE TABLE models (
    id TEXT PRIMARY KEY,                    -- "<gateway>:<slug>", e.g. "openrouter:anthropic/claude-opus-5.5"
    label TEXT NOT NULL,                    -- shown on the answer chip, e.g. "Claude Opus 5.5"
    vendor TEXT,                            -- "Anthropic"
    region TEXT,                            -- us | cn | eu | self
    gateway TEXT NOT NULL,                  -- openrouter | fal | openai | selfhosted
    slug TEXT NOT NULL,                     -- upstream model id / fal endpoint id
    jobs TEXT NOT NULL DEFAULT '[]',        -- JSON array of jobs this model can serve
    price_in REAL,                          -- USD per 1M input tokens (text models)
    price_out REAL,                         -- USD per 1M output tokens (text models)
    price_unit TEXT,                        -- media: image | megapixel | second | song | 1k_chars | minute | request
    price_per_unit REAL,                    -- media: USD per price_unit
    zdr INTEGER NOT NULL DEFAULT 0,         -- provider keeps no prompts/outputs for us
    retention_note TEXT,                    -- human-readable retention policy, published on /privacy
    open_weights INTEGER NOT NULL DEFAULT 0,
    self_hosted INTEGER NOT NULL DEFAULT 0, -- runs on GPUs we control
    supports_reasoning INTEGER NOT NULL DEFAULT 0,
    context_length INTEGER,
    params TEXT NOT NULL DEFAULT '{}',      -- JSON default request params (fal input defaults etc.)
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );

  -- The routing table: job x tier -> model. Data, not code; edited by admins and the weekly learner.
  CREATE TABLE routes (
    job TEXT NOT NULL,                      -- chat | code | image | video | music | voice | action
    tier TEXT NOT NULL,                     -- quality | balanced | budget | private
    model_id TEXT NOT NULL REFERENCES models(id),
    effort_override TEXT,                   -- NULL, or none | low | medium | high
    source TEXT NOT NULL DEFAULT 'seed',    -- seed | admin | learn
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (job, tier)
  );

  CREATE TABLE route_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job TEXT NOT NULL,
    tier TEXT NOT NULL,
    old_model_id TEXT,
    new_model_id TEXT,
    source TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_enc TEXT,                         -- encrypted with the user's DEK
    pins TEXT NOT NULL DEFAULT '{}',        -- JSON { [job]: { model_id, tier, source: "auto"|"user" } }
    pii_map_enc TEXT,                       -- encrypted placeholder map, stable across the conversation
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX conversations_user ON conversations(user_id, updated_at);

  CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,                     -- user | assistant
    content_enc TEXT NOT NULL,              -- encrypted JSON { text, media?: [{ type, url, mime? }] }
    parent_id TEXT,                         -- assistant -> the user message it answers
    request_id TEXT,                        -- assistant -> requests.id
    superseded INTEGER NOT NULL DEFAULT 0,  -- replaced by a regenerate / switch
    created_at INTEGER NOT NULL
  );
  CREATE INDEX messages_conversation ON messages(conversation_id, created_at);

  -- Routing log. Metadata only: never raw prompts or answers.
  CREATE TABLE requests (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT,
    message_id TEXT,                        -- the assistant message produced
    kind TEXT NOT NULL,                     -- auto | manual | regenerate | switch
    job TEXT,
    difficulty INTEGER,
    private INTEGER NOT NULL DEFAULT 0,
    tier TEXT,
    model_id TEXT,
    gateway TEXT,
    upstream_provider TEXT,                 -- e.g. OpenRouter's chosen provider ("Anthropic", "Together")
    effort TEXT,
    zdr INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    classifier_model TEXT,                  -- models.id or "heuristic"
    input_tokens INTEGER,
    output_tokens INTEGER,
    reasoning_tokens INTEGER,
    media_units REAL,                       -- images / seconds / songs billed
    api_cost_micros INTEGER NOT NULL DEFAULT 0,  -- what the providers charged us (incl. classifier)
    charged_micros INTEGER NOT NULL DEFAULT 0,   -- what we charged the user
    latency_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'ok',      -- ok | error | stopped (a Stop after text: partial answer kept)
    error_code TEXT,
    redactions TEXT NOT NULL DEFAULT '{}',  -- JSON counts by entity type, e.g. {"PERSON":2}
    feedback INTEGER,                       -- 1 = thumbs up, -1 = thumbs down, NULL = none
    regenerated INTEGER NOT NULL DEFAULT 0, -- user asked for a regenerate of this answer
    overridden INTEGER NOT NULL DEFAULT 0,  -- user switched away from this model
    created_at INTEGER NOT NULL
  );
  CREATE INDEX requests_user ON requests(user_id, created_at);
  CREATE INDEX requests_model ON requests(job, model_id, created_at);

  -- Credit ledger. SUM(delta_micros) per user always equals users.balance_micros.
  CREATE TABLE ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,                           -- set NULL when the user deletes their account
    delta_micros INTEGER NOT NULL,
    kind TEXT NOT NULL,                     -- signup_bonus | purchase | hold | release | charge | dev_topup | admin_adjust
    ref TEXT,                               -- request id, hold id, or Stripe checkout session id
    created_at INTEGER NOT NULL
  );
  CREATE INDEX ledger_user ON ledger(user_id, created_at);
  CREATE UNIQUE INDEX ledger_purchase_once ON ledger(ref) WHERE kind = 'purchase';

  CREATE TABLE holds (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_micros INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE stripe_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,

  // 2: sticky conversation privacy, signup-bonus claims, stored learner runs
  `
  -- Set (never cleared) as soon as any turn of the conversation is classified private, at the moment
  -- its question is stored, whether or not the answer succeeds. Later text turns re-send that
  -- question as history, so they must stay private too.
  ALTER TABLE conversations ADD COLUMN private INTEGER NOT NULL DEFAULT 0;

  -- One row per email address that has received the signup bonus. Keyed by an HMAC of the
  -- normalized address (keyed with a value derived from the master key), so the address itself is
  -- not kept after "delete everything", but re-registering the same address gets no second bonus.
  CREATE TABLE bonus_claims (
    email_hmac TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );

  -- Learner runs (admin page, CLI or the weekly schedule): proposals JSON and whether they were applied.
  CREATE TABLE learn_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,                   -- admin | cli | schedule
    days INTEGER NOT NULL,
    proposals TEXT NOT NULL DEFAULT '[]',
    applied INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  `,

  // 3: the cookie name each session was issued under, media prompts that quote earlier messages,
  //    and the usage totals of deleted accounts
  `
  -- 'host' = __Host-gode_session (COOKIE_SECURE), 'plain' = gode_session. NULL: made before this
  -- column existed, when production still issued gode_session. In secure mode the old name is
  -- accepted only for 'plain' and NULL rows, so a token issued under the __Host- name can never be
  -- tossed into a browser under the old name from a sibling subdomain (src/auth.js).
  ALTER TABLE sessions ADD COLUMN cookie TEXT;

  -- 1: a media prompt built from earlier messages too (a follow-up such as "now make a video of
  -- it" quotes the request it refers to). The privacy badge says so.
  ALTER TABLE requests ADD COLUMN context_included INTEGER NOT NULL DEFAULT 0;

  -- Per-UTC-day totals of the requests of accounts that were deleted ("delete everything" removes
  -- their requests rows). Counts and amounts only, no user, conversation or model: the gate
  -- metrics (src/router/learn.js) add them back, so deleting accounts can't make API cost vanish
  -- while their purchases stay in the ledger.
  CREATE TABLE usage_archive (
    day INTEGER PRIMARY KEY,                -- start of the UTC day of the requests, epoch ms
    requests INTEGER NOT NULL DEFAULT 0,
    auto INTEGER NOT NULL DEFAULT 0,
    manual INTEGER NOT NULL DEFAULT 0,
    switches INTEGER NOT NULL DEFAULT 0,
    api_micros INTEGER NOT NULL DEFAULT 0,
    failed_api_micros INTEGER NOT NULL DEFAULT 0,
    charged_micros INTEGER NOT NULL DEFAULT 0,
    up INTEGER NOT NULL DEFAULT 0,
    down INTEGER NOT NULL DEFAULT 0
  );
  `,
];

/**
 * Open (and migrate) the database. Pass ":memory:" in tests.
 * @returns {import('node:sqlite').DatabaseSync & { tx: Function }}
 */
function openDb(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;");
  // A second connection (the cron learner, `npm run seed -- --force`, a backup) may hold the write
  // lock for a moment: wait for it instead of failing at once with "database is locked". node:sqlite
  // is synchronous, so a wait blocks the event loop; such locks last milliseconds in practice.
  db.exec("PRAGMA busy_timeout = 5000;");
  // Deleted rows ("delete everything", expired sessions) are overwritten with zeros, not left in
  // free pages of the file.
  db.exec("PRAGMA secure_delete = ON;");
  if (file !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
    // FULL, not NORMAL: in WAL mode NORMAL can roll back a committed transaction on power loss, and
    // a Stripe credit grant acknowledged with 2xx is never redelivered. One extra fsync per commit.
    db.exec("PRAGMA synchronous = FULL;");
  }
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);");
  const applied = new Set(db.prepare("SELECT version FROM schema_migrations").all().map((r) => r.version));
  MIGRATIONS.forEach((sql, i) => {
    const version = i + 1;
    if (applied.has(version)) return;
    tx(db, () => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, Date.now());
    });
  });

  db.tx = (fn) => tx(db, fn);
  return db;
}

const depths = new WeakMap();
/** Run fn inside BEGIN IMMEDIATE/COMMIT. Nested calls join the outer transaction. */
function tx(db, fn) {
  const depth = depths.get(db) || 0;
  if (depth > 0) return fn();
  db.exec("BEGIN IMMEDIATE");
  depths.set(db, 1);
  try {
    const out = fn();
    if (out && typeof out.then === "function") throw new Error("db.tx callback must be synchronous");
    depths.set(db, 0);
    db.exec("COMMIT");
    return out;
  } catch (e) {
    depths.set(db, 0);
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw e;
  }
}

module.exports = { openDb, MIGRATIONS };
