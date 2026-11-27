"use strict";
// An in-memory stand-in for the node:sqlite database Gode's modules talk to (src/db.js), so the
// REAL modules (src/auth.js, src/chat/pipeline.js, src/billing/credits.js, src/seed/catalog.js and
// the route files) run unchanged in the browser.
//
// It is not a SQL engine: every statement those modules prepare is registered in
// ./statements.js with a handler that does what SQLite would do on these tables (same columns,
// defaults, ordering, constraints and return values: get() -> row | undefined, all() -> rows,
// run() -> { changes, lastInsertRowid }). prepare() of an unknown statement throws at once, so a
// product change that adds SQL fails the preview's contract tests instead of misbehaving.
//
// db.tx(fn) has src/db.js semantics: nested calls join the outer transaction, a throw rolls back
// every table to where the outermost transaction started, a returned promise is an error.

const SCHEMA = {
  users: {
    columns: ["id", "email", "password_hash", "wrapped_dek", "is_admin", "plan", "strict_privacy", "eu_only", "auto_pick", "share_prompts", "balance_micros", "created_at"],
    defaults: { is_admin: 0, plan: "balanced", strict_privacy: 0, eu_only: 0, auto_pick: 1, share_prompts: 0, balance_micros: 0 },
    primary: ["id"],
    unique: [["email", "nocase"]],
  },
  sessions: {
    columns: ["token_hash", "user_id", "created_at", "expires_at", "cookie"],
    defaults: { cookie: null },
    primary: ["token_hash"],
  },
  models: {
    columns: ["id", "label", "vendor", "region", "gateway", "slug", "jobs", "price_in", "price_out", "price_unit", "price_per_unit", "zdr", "retention_note", "open_weights", "self_hosted", "supports_reasoning", "context_length", "params", "enabled", "updated_at"],
    defaults: { jobs: "[]", zdr: 0, open_weights: 0, self_hosted: 0, supports_reasoning: 0, params: "{}", enabled: 1 },
    primary: ["id"],
  },
  routes: {
    columns: ["job", "tier", "model_id", "effort_override", "source", "updated_at"],
    defaults: { source: "seed" },
    primary: ["job", "tier"],
  },
  route_history: {
    columns: ["id", "job", "tier", "old_model_id", "new_model_id", "source", "reason", "created_at"],
    autoincrement: "id",
  },
  conversations: {
    columns: ["id", "user_id", "title_enc", "pins", "pii_map_enc", "created_at", "updated_at", "private"],
    defaults: { pins: "{}", private: 0 },
    primary: ["id"],
  },
  messages: {
    columns: ["id", "conversation_id", "user_id", "role", "content_enc", "parent_id", "request_id", "superseded", "created_at"],
    defaults: { superseded: 0 },
    primary: ["id"],
  },
  requests: {
    columns: [
      "id", "user_id", "conversation_id", "message_id", "kind", "job", "difficulty", "private", "tier", "model_id", "gateway",
      "upstream_provider", "effort", "zdr", "pinned", "classifier_model", "input_tokens", "output_tokens", "reasoning_tokens",
      "media_units", "api_cost_micros", "charged_micros", "latency_ms", "status", "error_code", "redactions", "feedback",
      "regenerated", "overridden", "created_at", "context_included",
    ],
    defaults: { private: 0, zdr: 0, pinned: 0, api_cost_micros: 0, charged_micros: 0, status: "ok", redactions: "{}", regenerated: 0, overridden: 0, context_included: 0 },
    primary: ["id"],
  },
  ledger: {
    columns: ["id", "user_id", "delta_micros", "kind", "ref", "created_at"],
    autoincrement: "id",
    // CREATE UNIQUE INDEX ledger_purchase_once ON ledger(ref) WHERE kind = 'purchase'
    uniqueWhere: [{ column: "ref", where: (r) => r.kind === "purchase", name: "ledger.ref" }],
  },
  holds: {
    columns: ["id", "user_id", "amount_micros", "created_at"],
    primary: ["id"],
  },
  stripe_events: {
    columns: ["id", "type", "created_at"],
    primary: ["id"],
  },
  bonus_claims: {
    columns: ["email_hmac", "created_at"],
    primary: ["email_hmac"],
  },
  learn_runs: {
    columns: ["id", "source", "days", "proposals", "applied", "created_at"],
    defaults: { proposals: "[]", applied: 0 },
    autoincrement: "id",
  },
  usage_archive: {
    columns: ["day", "requests", "auto", "manual", "switches", "api_micros", "failed_api_micros", "charged_micros", "up", "down"],
    defaults: { requests: 0, auto: 0, manual: 0, switches: 0, api_micros: 0, failed_api_micros: 0, charged_micros: 0, up: 0, down: 0 },
    primary: ["day"],
  },
};

const ROWID = "_rowid";

/** Collapse whitespace so a statement matches however the source indents it. */
function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, " ").trim();
}

class SqliteError extends Error {
  constructor(message, code = "SQLITE_ERROR") {
    super(message);
    this.name = "SqliteError";
    this.code = code;
  }
}

/** SQLite's BINARY collation on the values these tables hold (strings, numbers, null). */
function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  const ta = typeof a === "number" ? 0 : 1;
  const tb = typeof b === "number" ? 0 : 1;
  if (ta !== tb) return ta - tb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Comparator for ORDER BY terms: [[column or fn, "ASC"|"DESC"], ...]. */
function orderBy(terms) {
  return (x, y) => {
    for (const [key, dir] of terms) {
      const a = typeof key === "function" ? key(x) : x[key];
      const b = typeof key === "function" ? key(y) : y[key];
      const c = compareValues(a, b);
      if (c) return dir === "DESC" ? -c : c;
    }
    return 0;
  };
}

/** SQLite stores what it is given: booleans become 0/1, undefined is refused like node:sqlite. */
function storable(value, column) {
  if (value === undefined) throw new SqliteError(`preview db: undefined value for column ${column}`);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  return value;
}

/**
 * @param {{ statements: Array, onCommit?: () => void }} opts
 *   statements: [[sql string | RegExp, { all?, run? }], ...] (see ./statements.js)
 */
function createDatabase({ statements, onCommit } = {}) {
  const exact = new Map();
  const patterns = [];
  for (const [key, handler] of statements || []) {
    if (key instanceof RegExp) patterns.push([key, handler]);
    else {
      const k = normalizeSql(key);
      if (exact.has(k)) throw new Error(`preview db: statement registered twice: ${k}`);
      exact.set(k, handler);
    }
  }

  let tables = {};
  let seq = {};
  let depth = 0;
  let snapshot = null;
  let changedSinceCommit = false;

  function reset() {
    tables = Object.fromEntries(Object.keys(SCHEMA).map((t) => [t, []]));
    seq = Object.fromEntries(Object.keys(SCHEMA).map((t) => [t, 0]));
  }
  reset();

  function rowsOf(name) {
    const rows = tables[name];
    if (!rows) throw new SqliteError(`preview db: no such table: ${name}`);
    return rows;
  }

  /** A plain copy of a stored row: every schema column, no internal rowid. */
  function full(name, row) {
    if (!row) return undefined;
    const out = {};
    for (const c of SCHEMA[name].columns) out[c] = row[c] === undefined ? null : row[c];
    return out;
  }

  function rowid(row) {
    return row[ROWID];
  }

  function markChanged() {
    changedSinceCommit = true;
    if (depth === 0) commitDone();
  }

  function commitDone() {
    if (!changedSinceCommit) return;
    changedSinceCommit = false;
    if (typeof onCommit === "function") onCommit();
  }

  function checkConstraints(name, candidate, ignore) {
    const spec = SCHEMA[name];
    const rows = rowsOf(name);
    if (spec.primary) {
      const clash = rows.find((r) => r !== ignore && spec.primary.every((c) => r[c] === candidate[c]));
      if (clash) throw new SqliteError(`UNIQUE constraint failed: ${spec.primary.map((c) => `${name}.${c}`).join(", ")}`, "SQLITE_CONSTRAINT_PRIMARYKEY");
    }
    for (const [col, collate] of spec.unique || []) {
      const norm = (v) => (collate === "nocase" && typeof v === "string" ? v.toLowerCase() : v);
      if (rows.some((r) => r !== ignore && norm(r[col]) === norm(candidate[col]))) {
        throw new SqliteError(`UNIQUE constraint failed: ${name}.${col}`, "SQLITE_CONSTRAINT_UNIQUE");
      }
    }
    for (const u of spec.uniqueWhere || []) {
      if (!u.where(candidate)) continue;
      if (rows.some((r) => r !== ignore && u.where(r) && r[u.column] === candidate[u.column])) {
        throw new SqliteError(`UNIQUE constraint failed: ${u.name}`, "SQLITE_CONSTRAINT_UNIQUE");
      }
    }
  }

  /** INSERT: missing columns take their schema default (or NULL). Returns the new rowid. */
  function insert(name, values) {
    const spec = SCHEMA[name];
    const row = {};
    for (const c of spec.columns) {
      const v = Object.prototype.hasOwnProperty.call(values, c) ? values[c] : spec.defaults && c in spec.defaults ? spec.defaults[c] : null;
      row[c] = storable(v, `${name}.${c}`);
    }
    for (const k of Object.keys(values)) if (!spec.columns.includes(k)) throw new SqliteError(`table ${name} has no column named ${k}`);
    let id;
    if (spec.autoincrement) {
      const key = spec.autoincrement;
      if (row[key] === null) row[key] = seq[name] + 1;
      id = row[key];
      if (id > seq[name]) seq[name] = id;
    } else {
      for (const c of spec.primary || []) {
        if (row[c] === null) throw new SqliteError(`NOT NULL constraint failed: ${name}.${c}`, "SQLITE_CONSTRAINT_NOTNULL");
      }
      seq[name] += 1;
      id = seq[name];
    }
    checkConstraints(name, row, null);
    row[ROWID] = id;
    rowsOf(name).push(row);
    markChanged();
    return id;
  }

  /** UPDATE rows matching pred with patch(row) -> { column: value }. Rows are replaced, never mutated. */
  function update(name, pred, patch) {
    const rows = rowsOf(name);
    let changes = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!pred(row)) continue;
      const p = typeof patch === "function" ? patch(row) : patch;
      const next = { ...row };
      for (const [k, v] of Object.entries(p)) {
        if (!SCHEMA[name].columns.includes(k)) throw new SqliteError(`no such column: ${k}`);
        next[k] = storable(v, `${name}.${k}`);
      }
      checkConstraints(name, next, row);
      rows[i] = next;
      changes += 1;
    }
    if (changes) markChanged();
    return changes;
  }

  function remove(name, pred) {
    const rows = rowsOf(name);
    const keep = rows.filter((r) => !pred(r));
    const changes = rows.length - keep.length;
    if (changes) {
      tables[name] = keep;
      markChanged();
    }
    return changes;
  }

  function prepare(sql) {
    const text = normalizeSql(sql);
    let handler = exact.get(text);
    let match = null;
    if (!handler) {
      for (const [re, h] of patterns) {
        match = re.exec(text);
        if (match) {
          handler = h;
          break;
        }
      }
    }
    if (!handler) throw new SqliteError(`preview db: statement not supported by the preview: ${text.slice(0, 300)}`);
    const bound = (fn, mode) =>
      function (...params) {
        if (typeof fn !== "function") throw new SqliteError(`preview db: ${mode}() is not supported for: ${text.slice(0, 200)}`);
        return fn(api, params, match);
      };
    const all = handler.all ? bound(handler.all, "all") : bound(null, "all");
    return {
      sql: text,
      all,
      get: handler.all
        ? (...params) => {
            const rows = handler.all(api, params, match);
            return rows.length ? rows[0] : undefined;
          }
        : bound(null, "get"),
      run: handler.run
        ? (...params) => {
            const out = handler.run(api, params, match) || {};
            return { changes: out.changes || 0, lastInsertRowid: out.lastInsertRowid || 0 };
          }
        : bound(null, "run"),
    };
  }

  function exec(sql) {
    const text = normalizeSql(sql);
    if (/^PRAGMA /i.test(text)) return;
    throw new SqliteError(`preview db: exec() is not supported: ${text.slice(0, 120)}`);
  }

  function tx(fn) {
    if (depth > 0) return fn();
    snapshot = { tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.slice()])), seq: { ...seq } };
    depth = 1;
    try {
      const out = fn();
      if (out && typeof out.then === "function") throw new Error("db.tx callback must be synchronous");
      depth = 0;
      snapshot = null;
      commitDone();
      return out;
    } catch (e) {
      depth = 0;
      tables = snapshot.tables;
      seq = snapshot.seq;
      snapshot = null;
      changedSinceCommit = false;
      throw e;
    }
  }

  /** Everything needed to rebuild the database (rows keep their rowids). */
  function dump() {
    return { tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.map((r) => ({ ...r }))])), seq: { ...seq } };
  }

  /** Replace the contents with a dump(). Unknown tables are ignored, missing ones start empty. */
  function load(state) {
    reset();
    if (!state || typeof state !== "object" || !state.tables) return;
    for (const name of Object.keys(SCHEMA)) {
      const rows = Array.isArray(state.tables[name]) ? state.tables[name] : [];
      tables[name] = rows.filter((r) => r && typeof r === "object" && Number.isFinite(r[ROWID])).map((r) => {
        const row = { [ROWID]: r[ROWID] };
        for (const c of SCHEMA[name].columns) row[c] = r[c] === undefined ? null : r[c];
        return row;
      });
      const maxRowid = tables[name].reduce((m, r) => Math.max(m, r[ROWID]), 0);
      seq[name] = Math.max(maxRowid, Number(state.seq && state.seq[name]) || 0);
    }
  }

  const api = {
    // node:sqlite surface used by Gode's modules
    prepare,
    exec,
    tx,
    isOpen: true,
    close() {},
    // table access for statement handlers and preview-internal code (seed, tests)
    rows: rowsOf,
    full,
    rowid,
    insert,
    update,
    remove,
    dump,
    load,
    reset,
    get inTransaction() {
      return depth > 0;
    },
  };
  return api;
}

module.exports = { createDatabase, SCHEMA, normalizeSql, orderBy, compareValues, SqliteError, ROWID };
