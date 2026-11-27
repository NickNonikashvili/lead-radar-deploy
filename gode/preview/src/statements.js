"use strict";
// Every SQL statement the bundled Gode modules prepare, with what SQLite would do for it on the
// preview's in-memory tables (./sqlite.js). Grouped by the module that issues it. The SQL text is
// copied from the source (whitespace does not matter); test/statements.test.js checks that every
// statement in those source files is registered here.
//
// Handler shape: { all(db, params, match) -> rows } for SELECT/PRAGMA (get() is the first row),
// { run(db, params, match) -> { changes, lastInsertRowid } } for writes. `params` are the
// arguments given to get/all/run: positional values, or one object of $named values.

const { orderBy, compareValues } = require("./sqlite");

const DAY_MS = 86_400_000;
const one = (row) => (row ? [row] : []);
const eqNoCase = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
const named = (params) => params[0] || {};
const pickCols = (row, cols) => Object.fromEntries(cols.map((c) => [c, row[c] === undefined ? null : row[c]]));

/** Rows of `name` matching pred, as full plain copies. */
function select(db, name, pred = () => true) {
  return db.rows(name).filter(pred).map((r) => ({ ...db.full(name, r), [ROWID_ALIAS]: db.rowid(r) }));
}
// Internal alias carried on selected copies so ORDER BY rowid works; stripped by strip().
const ROWID_ALIAS = "\u0000rowid";
const strip = (rows) =>
  rows.map((r) => {
    const { [ROWID_ALIAS]: _drop, ...rest } = r;
    return rest;
  });
const byRowid = (r) => r[ROWID_ALIAS];

function limit(rows, n) {
  const k = Number(n);
  return Number.isFinite(k) && k >= 0 ? rows.slice(0, k) : rows;
}

// ---------------------------------------------------------------------------------------------
// src/auth.js
// ---------------------------------------------------------------------------------------------

const AUTH = [
  ["SELECT * FROM users WHERE email = ?", { all: (db, [email]) => strip(select(db, "users", (u) => eqNoCase(u.email, email))) }],
  ["SELECT * FROM users WHERE id = ?", { all: (db, [id]) => strip(select(db, "users", (u) => u.id === id)) }],
  ["SELECT COUNT(*) AS n FROM users", { all: (db) => [{ n: db.rows("users").length }] }],
  [
    "INSERT INTO users (id, email, password_hash, wrapped_dek, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    { run: (db, [id, email, password_hash, wrapped_dek, is_admin, created_at]) => ({ changes: 1, lastInsertRowid: db.insert("users", { id, email, password_hash, wrapped_dek, is_admin, created_at }) }) },
  ],
  ["UPDATE users SET is_admin = ? WHERE id = ?", { run: (db, [v, id]) => ({ changes: db.update("users", (u) => u.id === id, { is_admin: v }) }) }],
  ["UPDATE users SET password_hash = ? WHERE id = ?", { run: (db, [v, id]) => ({ changes: db.update("users", (u) => u.id === id, { password_hash: v }) }) }],
  ["SELECT 1 AS hit FROM bonus_claims WHERE email_hmac = ?", { all: (db, [h]) => (db.rows("bonus_claims").some((b) => b.email_hmac === h) ? [{ hit: 1 }] : []) }],
  ["SELECT COUNT(*) AS n FROM bonus_claims WHERE created_at >= ?", { all: (db, [t]) => [{ n: db.rows("bonus_claims").filter((b) => b.created_at >= t).length }] }],
  [
    "INSERT INTO bonus_claims (email_hmac, created_at) VALUES (?, ?)",
    { run: (db, [email_hmac, created_at]) => ({ changes: 1, lastInsertRowid: db.insert("bonus_claims", { email_hmac, created_at }) }) },
  ],
  [
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, cookie) VALUES (?, ?, ?, ?, ?)",
    { run: (db, [token_hash, user_id, created_at, expires_at, cookie]) => ({ changes: 1, lastInsertRowid: db.insert("sessions", { token_hash, user_id, created_at, expires_at, cookie }) }) },
  ],
  [
    "SELECT s.expires_at AS session_expires_at, s.cookie AS session_cookie, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    {
      all: (db, [hash]) => {
        const s = db.rows("sessions").find((x) => x.token_hash === hash);
        const u = s && db.rows("users").find((x) => x.id === s.user_id);
        return s && u ? [{ session_expires_at: s.expires_at, session_cookie: s.cookie, ...db.full("users", u) }] : [];
      },
    },
  ],
  ["UPDATE sessions SET cookie = 'host' WHERE token_hash = ?", { run: (db, [h]) => ({ changes: db.update("sessions", (s) => s.token_hash === h, { cookie: "host" }) }) }],
  ["DELETE FROM sessions WHERE token_hash = ?", { run: (db, [h]) => ({ changes: db.remove("sessions", (s) => s.token_hash === h) }) }],
  ["DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", { run: (db, [u, h]) => ({ changes: db.remove("sessions", (s) => s.user_id === u && s.token_hash !== h) }) }],
  ["DELETE FROM sessions WHERE user_id = ?", { run: (db, [u]) => ({ changes: db.remove("sessions", (s) => s.user_id === u) }) }],
  ["DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?", { run: (db, [u, t]) => ({ changes: db.remove("sessions", (s) => s.user_id === u && s.expires_at <= t) }) }],
  ["DELETE FROM sessions WHERE expires_at <= ?", { run: (db, [t]) => ({ changes: db.remove("sessions", (s) => s.expires_at <= t) }) }],
  ["SELECT id, wrapped_dek FROM users WHERE id = ?", { all: (db, [id]) => select(db, "users", (u) => u.id === id).map((u) => pickCols(u, ["id", "wrapped_dek"])) }],
  ["PRAGMA wal_checkpoint(TRUNCATE)", { all: () => [{ busy: 0, log: 0, checkpointed: 0 }] }],
  // deleteEverything(): fold the user's requests into per-UTC-day totals before they go.
  [
    `INSERT INTO usage_archive (day, requests, auto, manual, switches, api_micros, failed_api_micros, charged_micros, up, down)
     SELECT (created_at / 86400000) * 86400000 AS d, COUNT(*),
            SUM(kind = 'auto'), SUM(kind = 'manual'), SUM(kind = 'switch'),
            SUM(api_cost_micros), SUM(CASE WHEN status <> 'ok' THEN api_cost_micros ELSE 0 END), SUM(charged_micros),
            SUM(CASE WHEN feedback = 1 THEN 1 ELSE 0 END), SUM(CASE WHEN feedback = -1 THEN 1 ELSE 0 END)
       FROM requests WHERE user_id = ? GROUP BY d
     ON CONFLICT(day) DO UPDATE SET
       requests = requests + excluded.requests, auto = auto + excluded.auto, manual = manual + excluded.manual,
       switches = switches + excluded.switches, api_micros = api_micros + excluded.api_micros,
       failed_api_micros = failed_api_micros + excluded.failed_api_micros,
       charged_micros = charged_micros + excluded.charged_micros, up = up + excluded.up, down = down + excluded.down`,
    {
      run: (db, [userId]) => {
        const groups = new Map();
        for (const r of db.rows("requests")) {
          if (r.user_id !== userId) continue;
          // SQLite integer division truncates toward zero.
          const day = Math.trunc(r.created_at / DAY_MS) * DAY_MS;
          const g = groups.get(day) || { requests: 0, auto: 0, manual: 0, switches: 0, api_micros: 0, failed_api_micros: 0, charged_micros: 0, up: 0, down: 0 };
          g.requests += 1;
          g.auto += r.kind === "auto" ? 1 : 0;
          g.manual += r.kind === "manual" ? 1 : 0;
          g.switches += r.kind === "switch" ? 1 : 0;
          g.api_micros += r.api_cost_micros || 0;
          g.failed_api_micros += r.status !== "ok" ? r.api_cost_micros || 0 : 0;
          g.charged_micros += r.charged_micros || 0;
          g.up += r.feedback === 1 ? 1 : 0;
          g.down += r.feedback === -1 ? 1 : 0;
          groups.set(day, g);
        }
        for (const [day, g] of groups) {
          const changed = db.update("usage_archive", (a) => a.day === day, (a) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, (a[k] || 0) + v])));
          if (!changed) db.insert("usage_archive", { day, ...g });
        }
        return { changes: groups.size };
      },
    },
  ],
  ["UPDATE ledger SET user_id = NULL WHERE user_id = ?", { run: (db, [u]) => ({ changes: db.update("ledger", (l) => l.user_id === u, { user_id: null }) }) }],
  [
    "DELETE FROM messages WHERE user_id = ?1 OR conversation_id IN (SELECT id FROM conversations WHERE user_id = ?1)",
    {
      run: (db, [u]) => {
        const convs = new Set(db.rows("conversations").filter((c) => c.user_id === u).map((c) => c.id));
        return { changes: db.remove("messages", (m) => m.user_id === u || convs.has(m.conversation_id)) };
      },
    },
  ],
  ["DELETE FROM conversations WHERE user_id = ?", { run: (db, [u]) => ({ changes: db.remove("conversations", (c) => c.user_id === u) }) }],
  ["DELETE FROM requests WHERE user_id = ?", { run: (db, [u]) => ({ changes: db.remove("requests", (r) => r.user_id === u) }) }],
  ["DELETE FROM holds WHERE user_id = ?", { run: (db, [u]) => ({ changes: db.remove("holds", (h) => h.user_id === u) }) }],
  ["DELETE FROM users WHERE id = ?", { run: (db, [u]) => ({ changes: db.remove("users", (x) => x.id === u) }) }],
];

// ---------------------------------------------------------------------------------------------
// src/chat/pipeline.js
// ---------------------------------------------------------------------------------------------

const MESSAGE_HISTORY_COLS = ["seq", "id", "role", "content_enc", "parent_id", "created_at"];
const withSeq = (rows) => rows.map((m) => ({ seq: m[ROWID_ALIAS], ...m }));
const newestFirst = orderBy([
  ["created_at", "DESC"],
  [byRowid, "DESC"],
]);

const PIPELINE = [
  ["SELECT 1 AS ok FROM users WHERE id = ?", { all: (db, [id]) => (db.rows("users").some((u) => u.id === id) ? [{ ok: 1 }] : []) }],
  [
    "SELECT id, user_id, title_enc, pins, pii_map_enc, private FROM conversations WHERE id = ?",
    { all: (db, [id]) => select(db, "conversations", (c) => c.id === id).map((c) => pickCols(c, ["id", "user_id", "title_enc", "pins", "pii_map_enc", "private"])) },
  ],
  ["SELECT 1 AS ok FROM conversations WHERE id = ? AND user_id = ?", { all: (db, [id, u]) => (db.rows("conversations").some((c) => c.id === id && c.user_id === u) ? [{ ok: 1 }] : []) }],
  ["SELECT pins FROM conversations WHERE id = ?", { all: (db, [id]) => select(db, "conversations", (c) => c.id === id).map((c) => ({ pins: c.pins })) }],
  [
    "INSERT INTO conversations (id, user_id, title_enc, pins, pii_map_enc, private, created_at, updated_at) VALUES (?, ?, ?, '{}', ?, ?, ?, ?)",
    {
      run: (db, [id, user_id, title_enc, pii_map_enc, priv, created_at, updated_at]) => ({
        changes: 1,
        lastInsertRowid: db.insert("conversations", { id, user_id, title_enc, pins: "{}", pii_map_enc, private: priv, created_at, updated_at }),
      }),
    },
  ],
  ["UPDATE conversations SET private = 1 WHERE id = ? AND private = 0", { run: (db, [id]) => ({ changes: db.update("conversations", (c) => c.id === id && c.private === 0, { private: 1 }) }) }],
  [
    "UPDATE conversations SET title_enc = ? WHERE id = ? AND title_enc IS NULL",
    { run: (db, [t, id]) => ({ changes: db.update("conversations", (c) => c.id === id && c.title_enc === null, { title_enc: t }) }) },
  ],
  ["UPDATE conversations SET pii_map_enc = ? WHERE id = ?", { run: (db, [v, id]) => ({ changes: db.update("conversations", (c) => c.id === id, { pii_map_enc: v }) }) }],
  ["UPDATE conversations SET pins = ? WHERE id = ?", { run: (db, [v, id]) => ({ changes: db.update("conversations", (c) => c.id === id, { pins: v }) }) }],
  ["UPDATE conversations SET updated_at = ? WHERE id = ?", { run: (db, [t, id]) => ({ changes: db.update("conversations", (c) => c.id === id, { updated_at: t }) }) }],
  ["SELECT rowid AS seq, * FROM messages WHERE id = ?", { all: (db, [id]) => strip(withSeq(select(db, "messages", (m) => m.id === id))) }],
  [
    "SELECT rowid AS seq, id, role, content_enc, parent_id, created_at FROM messages WHERE conversation_id = ? AND superseded = 0 ORDER BY created_at DESC, rowid DESC LIMIT ?",
    {
      all: (db, [conv, n]) =>
        limit(select(db, "messages", (m) => m.conversation_id === conv && m.superseded === 0).sort(newestFirst), n).map((m) => pickCols({ ...m, seq: m[ROWID_ALIAS] }, MESSAGE_HISTORY_COLS)),
    },
  ],
  [
    "SELECT rowid AS seq, id, role, content_enc, parent_id, created_at FROM messages WHERE conversation_id = ? AND superseded = 0 AND (created_at < ? OR (created_at = ? AND rowid < ?)) ORDER BY created_at DESC, rowid DESC LIMIT ?",
    {
      all: (db, [conv, t1, t2, rid, n]) =>
        limit(
          select(db, "messages", (m) => m.conversation_id === conv && m.superseded === 0 && (m.created_at < t1 || (m.created_at === t2 && byRowid(m) < rid))).sort(newestFirst),
          n
        ).map((m) => pickCols({ ...m, seq: m[ROWID_ALIAS] }, MESSAGE_HISTORY_COLS)),
    },
  ],
  [
    "SELECT 1 AS ok FROM messages WHERE parent_id = ? AND role = 'assistant' AND superseded = 0 LIMIT 1",
    { all: (db, [p]) => (db.rows("messages").some((m) => m.parent_id === p && m.role === "assistant" && m.superseded === 0) ? [{ ok: 1 }] : []) },
  ],
  [
    "INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, superseded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
    {
      run: (db, [id, conversation_id, user_id, role, content_enc, parent_id, request_id, created_at]) => ({
        changes: 1,
        lastInsertRowid: db.insert("messages", { id, conversation_id, user_id, role, content_enc, parent_id, request_id, superseded: 0, created_at }),
      }),
    },
  ],
  ["UPDATE messages SET superseded = 1 WHERE id = ? AND superseded = 0", { run: (db, [id]) => ({ changes: db.update("messages", (m) => m.id === id && m.superseded === 0, { superseded: 1 }) }) }],
  ["SELECT * FROM requests WHERE id = ?", { all: (db, [id]) => strip(select(db, "requests", (r) => r.id === id)) }],
  ["SELECT jobs FROM models WHERE id = ?", { all: (db, [id]) => select(db, "models", (m) => m.id === id).map((m) => ({ jobs: m.jobs })) }],
  ["SELECT label, gateway FROM models WHERE id = ?", { all: (db, [id]) => select(db, "models", (m) => m.id === id).map((m) => ({ label: m.label, gateway: m.gateway })) }],
  [
    "SELECT r.classifier_model FROM messages m JOIN requests r ON r.id = m.request_id WHERE m.parent_id = ? AND r.classifier_model IS NOT NULL ORDER BY r.created_at LIMIT 1",
    {
      all: (db, [parent]) => {
        const reqs = new Map(db.rows("requests").map((r) => [r.id, r]));
        const joined = [];
        for (const m of db.rows("messages")) {
          if (m.parent_id !== parent) continue;
          const r = reqs.get(m.request_id);
          if (r && r.classifier_model !== null) joined.push({ classifier_model: r.classifier_model, created_at: r.created_at });
        }
        joined.sort(orderBy([["created_at", "ASC"]]));
        return joined.slice(0, 1).map((j) => ({ classifier_model: j.classifier_model }));
      },
    },
  ],
  ["SELECT 1 AS ok FROM holds WHERE id = ? AND user_id = ?", { all: (db, [id, u]) => (db.rows("holds").some((h) => h.id === id && h.user_id === u) ? [{ ok: 1 }] : []) }],
  ["UPDATE requests SET regenerated = 1 WHERE id = ?", { run: (db, [id]) => ({ changes: db.update("requests", (r) => r.id === id, { regenerated: 1 }) }) }],
  ["UPDATE requests SET overridden = 1 WHERE id = ?", { run: (db, [id]) => ({ changes: db.update("requests", (r) => r.id === id, { overridden: 1 }) }) }],
  [
    `INSERT INTO requests (id, user_id, conversation_id, message_id, kind, job, difficulty, private, tier, model_id,
         gateway, upstream_provider, effort, zdr, pinned, classifier_model, input_tokens, output_tokens,
         reasoning_tokens, media_units, api_cost_micros, charged_micros, latency_ms, status, error_code, redactions,
         context_included, created_at)
       VALUES ($id, $user_id, $conversation_id, $message_id, $kind, $job, $difficulty, $private, $tier, $model_id,
         $gateway, $upstream_provider, $effort, $zdr, $pinned, $classifier_model, $input_tokens, $output_tokens,
         $reasoning_tokens, $media_units, $api_cost_micros, $charged_micros, $latency_ms, $status, $error_code,
         $redactions, $context_included, $created_at)`,
    {
      run: (db, params) => {
        const p = named(params);
        const values = {};
        for (const [k, v] of Object.entries(p)) values[k.replace(/^\$/, "")] = v;
        return { changes: 1, lastInsertRowid: db.insert("requests", values) };
      },
    },
  ],
];

// ---------------------------------------------------------------------------------------------
// src/billing/credits.js
// ---------------------------------------------------------------------------------------------

const CREDITS = [
  ["SELECT balance_micros FROM users WHERE id = ?", { all: (db, [id]) => select(db, "users", (u) => u.id === id).map((u) => ({ balance_micros: u.balance_micros })) }],
  [
    "UPDATE users SET balance_micros = balance_micros + ? WHERE id = ?",
    { run: (db, [delta, id]) => ({ changes: db.update("users", (u) => u.id === id, (u) => ({ balance_micros: u.balance_micros + delta })) }) },
  ],
  [
    "INSERT INTO ledger (user_id, delta_micros, kind, ref, created_at) VALUES (?, ?, ?, ?, ?)",
    { run: (db, [user_id, delta_micros, kind, ref, created_at]) => ({ changes: 1, lastInsertRowid: db.insert("ledger", { user_id, delta_micros, kind, ref, created_at }) }) },
  ],
  ["SELECT 1 AS found FROM ledger WHERE kind = 'purchase' AND ref = ?", { all: (db, [ref]) => (db.rows("ledger").some((l) => l.kind === "purchase" && l.ref === ref) ? [{ found: 1 }] : []) }],
  [
    "INSERT INTO holds (id, user_id, amount_micros, created_at) VALUES (?, ?, ?, ?)",
    { run: (db, [id, user_id, amount_micros, created_at]) => ({ changes: 1, lastInsertRowid: db.insert("holds", { id, user_id, amount_micros, created_at }) }) },
  ],
  ["SELECT id, user_id, amount_micros, created_at FROM holds WHERE id = ?", { all: (db, [id]) => strip(select(db, "holds", (h) => h.id === id)) }],
  ["DELETE FROM holds WHERE id = ?", { run: (db, [id]) => ({ changes: db.remove("holds", (h) => h.id === id) }) }],
  [
    "SELECT id, user_id, amount_micros FROM holds WHERE created_at <= ? ORDER BY created_at",
    {
      all: (db, [t]) =>
        select(db, "holds", (h) => h.created_at <= t)
          .sort(orderBy([["created_at", "ASC"], [byRowid, "ASC"]]))
          .map((h) => pickCols(h, ["id", "user_id", "amount_micros"])),
    },
  ],
  [
    "SELECT COALESCE(SUM(amount_micros), 0) AS n FROM holds WHERE user_id = ?",
    { all: (db, [u]) => [{ n: db.rows("holds").filter((h) => h.user_id === u).reduce((s, h) => s + h.amount_micros, 0) }] },
  ],
  // ledger(userId, { kinds }): an optional "AND kind IN (?, ...)" list.
  [
    /^SELECT id, kind, delta_micros, ref, created_at FROM ledger WHERE user_id = \?( AND kind IN \(\?(?:, \?)*\))? ORDER BY created_at DESC, id DESC LIMIT \?$/,
    {
      all: (db, params, match) => {
        const [userId, ...rest] = params;
        const n = rest.pop();
        const kinds = match[1] ? new Set(rest) : null;
        return limit(
          select(db, "ledger", (l) => l.user_id === userId && (!kinds || kinds.has(l.kind))).sort(
            orderBy([
              ["created_at", "DESC"],
              ["id", "DESC"],
            ])
          ),
          n
        ).map((l) => pickCols(l, ["id", "kind", "delta_micros", "ref", "created_at"]));
      },
    },
  ],
];

// ---------------------------------------------------------------------------------------------
// src/seed/catalog.js
// ---------------------------------------------------------------------------------------------

const byId = orderBy([["id", "ASC"]]);

const CATALOG = [
  // upsertModel(): INSERT INTO models (<MODEL_COLUMNS>, updated_at) VALUES ($...) ON CONFLICT(id) DO UPDATE ...
  [
    /^INSERT INTO models \(([a-z_, ]+), updated_at\) VALUES \(([$a-z_, ]+), \$updated_at\) ON CONFLICT\(id\) DO UPDATE SET (.+), updated_at = excluded\.updated_at$/,
    {
      run: (db, params, match) => {
        const p = named(params);
        const cols = match[1].split(",").map((c) => c.trim());
        const values = { updated_at: p.$updated_at };
        for (const c of cols) values[c] = p[`$${c}`];
        const changed = db.update("models", (m) => m.id === values.id, () => {
          const { id: _id, ...rest } = values;
          return rest;
        });
        if (changed) return { changes: 1 };
        return { changes: 1, lastInsertRowid: db.insert("models", values) };
      },
    },
  ],
  ["SELECT id FROM models WHERE id = ?", { all: (db, [id]) => select(db, "models", (m) => m.id === id).map((m) => ({ id: m.id })) }],
  ["SELECT model_id FROM routes WHERE job = ? AND tier = ?", { all: (db, [job, tier]) => select(db, "routes", (r) => r.job === job && r.tier === tier).map((r) => ({ model_id: r.model_id })) }],
  [
    `INSERT INTO routes (job, tier, model_id, effort_override, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(job, tier) DO UPDATE SET model_id = excluded.model_id, effort_override = excluded.effort_override,
       source = excluded.source, updated_at = excluded.updated_at`,
    {
      run: (db, [job, tier, model_id, effort_override, source, updated_at]) => {
        if (!db.rows("models").some((m) => m.id === model_id)) throw new Error("FOREIGN KEY constraint failed");
        const changed = db.update("routes", (r) => r.job === job && r.tier === tier, { model_id, effort_override, source, updated_at });
        if (changed) return { changes: 1 };
        return { changes: 1, lastInsertRowid: db.insert("routes", { job, tier, model_id, effort_override, source, updated_at }) };
      },
    },
  ],
  [
    "INSERT INTO route_history (job, tier, old_model_id, new_model_id, source, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    {
      run: (db, [job, tier, old_model_id, new_model_id, source, reason, created_at]) => ({
        changes: 1,
        lastInsertRowid: db.insert("route_history", { job, tier, old_model_id, new_model_id, source, reason, created_at }),
      }),
    },
  ],
  ["SELECT COUNT(*) AS n FROM models", { all: (db) => [{ n: db.rows("models").length }] }],
  [
    `SELECT id FROM models
        WHERE (self_hosted = 1 AND gateway <> 'selfhosted')
           OR (region = 'self' AND gateway <> 'selfhosted')
           OR (zdr = 1 AND gateway = 'fal')
           OR (zdr = 1 AND gateway = 'openai' AND ? = 0)
        ORDER BY id`,
    {
      all: (db, [approved]) =>
        select(
          db,
          "models",
          (m) =>
            (m.self_hosted === 1 && m.gateway !== "selfhosted") ||
            (m.region === "self" && m.gateway !== "selfhosted") ||
            (m.zdr === 1 && m.gateway === "fal") ||
            (m.zdr === 1 && m.gateway === "openai" && approved === 0)
        )
          .sort(byId)
          .map((m) => ({ id: m.id })),
    },
  ],
  [
    "UPDATE models SET self_hosted = 0, updated_at = ? WHERE self_hosted = 1 AND gateway <> 'selfhosted'",
    { run: (db, [t]) => ({ changes: db.update("models", (m) => m.self_hosted === 1 && m.gateway !== "selfhosted", { self_hosted: 0, updated_at: t }) }) },
  ],
  [
    "UPDATE models SET region = NULL, updated_at = ? WHERE region = 'self' AND gateway <> 'selfhosted'",
    { run: (db, [t]) => ({ changes: db.update("models", (m) => m.region === "self" && m.gateway !== "selfhosted", { region: null, updated_at: t }) }) },
  ],
  ["UPDATE models SET zdr = 0, updated_at = ? WHERE zdr = 1 AND gateway = 'fal'", { run: (db, [t]) => ({ changes: db.update("models", (m) => m.zdr === 1 && m.gateway === "fal", { zdr: 0, updated_at: t }) }) }],
  ["UPDATE models SET zdr = 0, updated_at = ? WHERE zdr = 1 AND gateway = 'openai'", { run: (db, [t]) => ({ changes: db.update("models", (m) => m.zdr === 1 && m.gateway === "openai", { zdr: 0, updated_at: t }) }) }],
  ["SELECT * FROM models ORDER BY id", { all: (db) => strip(select(db, "models").sort(byId)) }],
  ["SELECT * FROM models WHERE enabled = 1 ORDER BY id", { all: (db) => strip(select(db, "models", (m) => m.enabled === 1).sort(byId)) }],
  [
    "SELECT job, tier, model_id, effort_override, source, updated_at FROM routes ORDER BY job, tier",
    {
      all: (db) =>
        select(db, "routes")
          .sort(orderBy([["job", "ASC"], ["tier", "ASC"]]))
          .map((r) => pickCols(r, ["job", "tier", "model_id", "effort_override", "source", "updated_at"])),
    },
  ],
  ["SELECT * FROM models WHERE id = ?", { all: (db, [id]) => strip(select(db, "models", (m) => m.id === id)) }],
  [
    "SELECT job, tier, model_id, effort_override, source, updated_at FROM routes",
    { all: (db) => select(db, "routes").sort(orderBy([[byRowid, "ASC"]])).map((r) => pickCols(r, ["job", "tier", "model_id", "effort_override", "source", "updated_at"])) },
  ],
];

// ---------------------------------------------------------------------------------------------
// src/routes/*.js
// ---------------------------------------------------------------------------------------------

const TRANSPARENCY_COLS = [
  "id", "created_at", "kind", "job", "tier", "model_id", "model_label", "gateway", "upstream_provider", "effort", "zdr",
  "private", "redactions", "charged_micros", "status", "error_code", "classifier_model", "classifier_label",
];
const TRANSPARENCY_SELECT = `SELECT r.id, r.created_at, r.kind, r.job, r.tier, r.model_id, m.label AS model_label, r.gateway,
              r.upstream_provider, r.effort, r.zdr, r.private, r.redactions, r.charged_micros, r.status, r.error_code,
              r.classifier_model, cm.label AS classifier_label
         FROM requests r
         LEFT JOIN models m ON m.id = r.model_id
         LEFT JOIN models cm ON cm.id = r.classifier_model`;

function transparencyRows(db, pred, n) {
  const labels = new Map(db.rows("models").map((m) => [m.id, m.label]));
  return limit(
    select(db, "requests", pred).sort(
      orderBy([
        ["created_at", "DESC"],
        [byRowid, "DESC"],
      ])
    ),
    n
  ).map((r) => pickCols({ ...r, model_label: labels.get(r.model_id) ?? null, classifier_label: labels.get(r.classifier_model) ?? null }, TRANSPARENCY_COLS));
}

const CONVERSATION_MESSAGE_COLS = [
  "id", "role", "content_enc", "parent_id", "request_id", "created_at", "r_id", "kind", "job", "tier", "model_id", "model_label",
  "model_region", "model_gateway", "effort", "charged_micros", "private", "zdr", "redactions", "feedback", "pinned", "status",
  "classifier_model", "context_included",
];
const REQUEST_JOIN_COLS = ["kind", "job", "tier", "model_id", "effort", "charged_micros", "private", "zdr", "redactions", "feedback", "pinned", "status", "classifier_model", "context_included"];

const ROUTES = [
  // me.js
  [`${TRANSPARENCY_SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC, r.rowid DESC LIMIT ?`, { all: (db, [u, n]) => transparencyRows(db, (r) => r.user_id === u, n) }],
  [
    `${TRANSPARENCY_SELECT}
        WHERE r.user_id = ?1 AND (r.created_at < ?2 OR (r.created_at = ?2 AND r.rowid < ?3))
        ORDER BY r.created_at DESC, r.rowid DESC LIMIT ?4`,
    { all: (db, [u, t, rid, n]) => transparencyRows(db, (r) => r.user_id === u && (r.created_at < t || (r.created_at === t && byRowid(r) < rid)), n) },
  ],
  [
    "SELECT created_at, rowid AS rid FROM requests WHERE id = ? AND user_id = ?",
    { all: (db, [id, u]) => select(db, "requests", (r) => r.id === id && r.user_id === u).map((r) => ({ created_at: r.created_at, rid: r[ROWID_ALIAS] })) },
  ],
  // PATCH /api/me: UPDATE users SET <fixed column list> WHERE id = ?
  [
    /^UPDATE users SET ((?:(?:plan|strict_privacy|eu_only|auto_pick|share_prompts) = \?(?:, )?)+) WHERE id = \?$/,
    {
      run: (db, params, match) => {
        const cols = match[1].split(",").map((s) => s.replace("= ?", "").trim());
        const id = params[params.length - 1];
        const patch = Object.fromEntries(cols.map((c, i) => [c, params[i]]));
        return { changes: db.update("users", (u) => u.id === id, patch) };
      },
    },
  ],
  // conversations.js
  ["SELECT * FROM conversations WHERE id = ? AND user_id = ?", { all: (db, [id, u]) => strip(select(db, "conversations", (c) => c.id === id && c.user_id === u)) }],
  [
    "SELECT id, title_enc, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC",
    {
      all: (db, [u]) =>
        select(db, "conversations", (c) => c.user_id === u)
          .sort(
            orderBy([
              ["updated_at", "DESC"],
              [byRowid, "DESC"],
            ])
          )
          .map((c) => pickCols(c, ["id", "title_enc", "updated_at"])),
    },
  ],
  [
    "INSERT INTO conversations (id, user_id, title_enc, pins, created_at, updated_at) VALUES (?, ?, ?, '{}', ?, ?)",
    { run: (db, [id, user_id, title_enc, created_at, updated_at]) => ({ changes: 1, lastInsertRowid: db.insert("conversations", { id, user_id, title_enc, pins: "{}", created_at, updated_at }) }) },
  ],
  [
    `SELECT m.id, m.role, m.content_enc, m.parent_id, m.request_id, m.created_at,
              r.id AS r_id, r.kind, r.job, r.tier, r.model_id, md.label AS model_label, md.region AS model_region,
              md.gateway AS model_gateway, r.effort, r.charged_micros, r.private, r.zdr, r.redactions, r.feedback,
              r.pinned, r.status, r.classifier_model, r.context_included
         FROM messages m
         LEFT JOIN requests r ON r.id = m.request_id AND r.user_id = m.user_id
         LEFT JOIN models md ON md.id = r.model_id
        WHERE m.conversation_id = ? AND m.user_id = ? AND m.superseded = 0
        ORDER BY m.created_at, m.rowid`,
    {
      all: (db, [conv, u]) => {
        const reqs = new Map(db.rows("requests").map((r) => [r.id, r]));
        const models = new Map(db.rows("models").map((m) => [m.id, m]));
        return select(db, "messages", (m) => m.conversation_id === conv && m.user_id === u && m.superseded === 0)
          .sort(
            orderBy([
              ["created_at", "ASC"],
              [byRowid, "ASC"],
            ])
          )
          .map((m) => {
            const r0 = m.request_id !== null ? reqs.get(m.request_id) : null;
            const r = r0 && r0.user_id === m.user_id ? r0 : null;
            const md = r && r.model_id !== null ? models.get(r.model_id) : null;
            const row = { ...m, r_id: r ? r.id : null, model_label: md ? md.label : null, model_region: md ? md.region : null, model_gateway: md ? md.gateway : null };
            for (const c of REQUEST_JOIN_COLS) row[c] = r ? (r[c] === undefined ? null : r[c]) : null;
            return pickCols(row, CONVERSATION_MESSAGE_COLS);
          });
      },
    },
  ],
  [
    `SELECT m.parent_id, r.classifier_model
         FROM messages m JOIN requests r ON r.id = m.request_id AND r.user_id = m.user_id
        WHERE m.conversation_id = ? AND m.user_id = ? AND m.parent_id IS NOT NULL AND r.classifier_model IS NOT NULL
        ORDER BY r.created_at, m.rowid`,
    {
      all: (db, [conv, u]) => {
        const reqs = new Map(db.rows("requests").map((r) => [r.id, r]));
        const joined = [];
        for (const m of select(db, "messages", (x) => x.conversation_id === conv && x.user_id === u && x.parent_id !== null)) {
          const r = reqs.get(m.request_id);
          if (!r || r.user_id !== m.user_id || r.classifier_model === null) continue;
          joined.push({ parent_id: m.parent_id, classifier_model: r.classifier_model, k1: r.created_at, k2: m[ROWID_ALIAS] });
        }
        joined.sort((a, b) => compareValues(a.k1, b.k1) || compareValues(a.k2, b.k2));
        return joined.map((j) => ({ parent_id: j.parent_id, classifier_model: j.classifier_model }));
      },
    },
  ],
  [
    "UPDATE conversations SET title_enc = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    { run: (db, [t, at, id, u]) => ({ changes: db.update("conversations", (c) => c.id === id && c.user_id === u, { title_enc: t, updated_at: at }) }) },
  ],
  ["DELETE FROM messages WHERE conversation_id = ?", { run: (db, [id]) => ({ changes: db.remove("messages", (m) => m.conversation_id === id) }) }],
  ["DELETE FROM conversations WHERE id = ? AND user_id = ?", { run: (db, [id, u]) => ({ changes: db.remove("conversations", (c) => c.id === id && c.user_id === u) }) }],
  // chat.js
  [
    "SELECT id, conversation_id, role, request_id, superseded FROM messages WHERE id = ? AND user_id = ?",
    { all: (db, [id, u]) => select(db, "messages", (m) => m.id === id && m.user_id === u).map((m) => pickCols(m, ["id", "conversation_id", "role", "request_id", "superseded"])) },
  ],
  ["UPDATE requests SET feedback = ? WHERE id = ? AND user_id = ?", { run: (db, [v, id, u]) => ({ changes: db.update("requests", (r) => r.id === id && r.user_id === u, { feedback: v }) }) }],
  // models.js
  [
    "SELECT id, user_id, conversation_id, role, request_id FROM messages WHERE id = ?",
    { all: (db, [id]) => select(db, "messages", (m) => m.id === id).map((m) => pickCols(m, ["id", "user_id", "conversation_id", "role", "request_id"])) },
  ],
  [
    "SELECT user_id, job, model_id, private FROM requests WHERE id = ?",
    { all: (db, [id]) => select(db, "requests", (r) => r.id === id).map((r) => pickCols(r, ["user_id", "job", "model_id", "private"])) },
  ],
];

// ---------------------------------------------------------------------------------------------
// src/router/learn.js (the learner, the admin overview's stats and gate metrics) and
// src/routes/admin.js
// ---------------------------------------------------------------------------------------------

const toNum = (v) => (typeof v === "number" ? v : v === null || v === undefined ? null : Number(v));
/** SQLite SUM(): NULL over no rows (or only NULLs), else the sum of the non-NULL values. */
function sum(rows, fn) {
  let total = null;
  for (const r of rows) {
    const v = fn(r);
    if (v === null || v === undefined) continue;
    total = (total === null ? 0 : total) + Number(v);
  }
  return total;
}
const coalesce0 = (v) => (v === null ? 0 : v);

// signalRows(db, since, { byTier }): the one statement template, in both of its shapes.
function signalSql(byTier) {
  const keys = byTier ? "job, tier, model_id" : "job, model_id";
  return `SELECT ${keys},
              COUNT(*) AS n,
              COALESCE(SUM(CASE WHEN feedback = 1 THEN 1 ELSE 0 END), 0) AS up,
              COALESCE(SUM(CASE WHEN feedback = -1 THEN 1 ELSE 0 END), 0) AS down,
              COALESCE(SUM(regenerated), 0) AS regenerated,
              COALESCE(SUM(overridden), 0) AS overridden,
              COALESCE(SUM(api_cost_micros), 0) AS cost_sum,
              COALESCE(SUM(latency_ms), 0) AS latency_sum,
              COUNT(latency_ms) AS latency_n
         FROM requests
        WHERE created_at >= ? AND status = 'ok' AND job IS NOT NULL AND model_id IS NOT NULL
              ${byTier ? "AND tier IS NOT NULL" : ""}
        GROUP BY ${keys}
        ORDER BY ${keys}`;
}

function signalRows(byTier) {
  const keys = byTier ? ["job", "tier", "model_id"] : ["job", "model_id"];
  return (db, [since]) => {
    const groups = new Map();
    for (const r of db.rows("requests")) {
      if (!(r.created_at >= since) || r.status !== "ok" || r.job === null || r.model_id === null) continue;
      if (byTier && r.tier === null) continue;
      const k = JSON.stringify(keys.map((c) => r[c]));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const out = [];
    for (const rows of groups.values()) {
      const row = pickCols(rows[0], keys);
      row.n = rows.length;
      row.up = rows.filter((r) => r.feedback === 1).length;
      row.down = rows.filter((r) => r.feedback === -1).length;
      row.regenerated = coalesce0(sum(rows, (r) => r.regenerated));
      row.overridden = coalesce0(sum(rows, (r) => r.overridden));
      row.cost_sum = coalesce0(sum(rows, (r) => r.api_cost_micros));
      row.latency_sum = coalesce0(sum(rows, (r) => r.latency_ms));
      row.latency_n = rows.filter((r) => r.latency_ms !== null && r.latency_ms !== undefined).length;
      out.push(row);
    }
    return out.sort(orderBy(keys.map((k) => [k, "ASC"])));
  };
}

/** SQLite LIKE with an ESCAPE character: % and _ wildcards, case-insensitive for ASCII only. */
function likeMatcher(pattern, escape) {
  const lowerAscii = (s) => String(s).replace(/[A-Z]/g, (c) => c.toLowerCase());
  let re = "";
  const p = lowerAscii(pattern);
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (escape && c === escape && i + 1 < p.length) {
      re += p[++i].replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    } else if (c === "%") re += "[\\s\\S]*";
    else if (c === "_") re += "[\\s\\S]";
    else re += c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
  const rx = new RegExp(`^${re}$`, "u");
  return (value) => typeof value === "string" && rx.test(lowerAscii(value));
}

const learnRunsNewest = orderBy([
  ["created_at", "DESC"],
  ["id", "DESC"],
]);
const ADMIN_USER_COLS = ["id", "email", "balance_micros", "is_admin", "created_at"];
const usersNewest = orderBy([
  ["created_at", "DESC"],
  ["id", "ASC"],
]);

const LEARN = [
  [signalSql(false), { all: signalRows(false) }],
  [signalSql(true), { all: signalRows(true) }],
  [
    "SELECT model_id, effort_override FROM routes WHERE job = ? AND tier = ?",
    { all: (db, [job, tier]) => select(db, "routes", (r) => r.job === job && r.tier === tier).map((r) => pickCols(r, ["model_id", "effort_override"])) },
  ],
  [
    "INSERT INTO learn_runs (source, days, proposals, applied, created_at) VALUES (?, ?, ?, ?, ?)",
    { run: (db, [source, days, proposals, applied, created_at]) => ({ changes: 1, lastInsertRowid: db.insert("learn_runs", { source, days, proposals, applied, created_at }) }) },
  ],
  [
    "UPDATE learn_runs SET applied = applied + ? WHERE id = ?",
    { run: (db, [n, id]) => ({ changes: db.update("learn_runs", (r) => r.id === Number(id), (r) => ({ applied: r.applied + Number(n) })) }) },
  ],
  ["SELECT * FROM learn_runs WHERE id = ?", { all: (db, [id]) => strip(select(db, "learn_runs", (r) => r.id === Number(id))) }],
  [
    "SELECT * FROM learn_runs WHERE source = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    { all: (db, [source, n]) => strip(limit(select(db, "learn_runs", (r) => r.source === source).sort(learnRunsNewest), n)) },
  ],
  ["SELECT * FROM learn_runs ORDER BY created_at DESC, id DESC LIMIT ?", { all: (db, [n]) => strip(limit(select(db, "learn_runs").sort(learnRunsNewest), n)) }],
  // gateMetrics(): the requests in the window...
  [
    `SELECT COUNT(*) AS requests,
              COALESCE(SUM(CASE WHEN kind = 'auto' THEN 1 ELSE 0 END), 0) AS auto,
              COALESCE(SUM(CASE WHEN kind = 'manual' THEN 1 ELSE 0 END), 0) AS manual,
              COALESCE(SUM(CASE WHEN kind = 'switch' THEN 1 ELSE 0 END), 0) AS switches,
              COALESCE(SUM(api_cost_micros), 0) AS api,
              COALESCE(SUM(CASE WHEN status <> 'ok' THEN api_cost_micros ELSE 0 END), 0) AS api_failed,
              COALESCE(SUM(charged_micros), 0) AS charged,
              COALESCE(SUM(CASE WHEN feedback = 1 THEN 1 ELSE 0 END), 0) AS up,
              COALESCE(SUM(CASE WHEN feedback = -1 THEN 1 ELSE 0 END), 0) AS down
         FROM requests WHERE created_at >= ?`,
    {
      all: (db, [since]) => {
        const rows = db.rows("requests").filter((r) => r.created_at >= since);
        const count = (pred) => rows.filter(pred).length;
        return [
          {
            requests: rows.length,
            auto: count((r) => r.kind === "auto"),
            manual: count((r) => r.kind === "manual"),
            switches: count((r) => r.kind === "switch"),
            api: coalesce0(sum(rows, (r) => r.api_cost_micros)),
            // CASE ... ELSE 0: a NULL status is not <> 'ok' (NULL), so it counts 0.
            api_failed: coalesce0(sum(rows, (r) => (r.status !== null && r.status !== "ok" ? r.api_cost_micros : 0))),
            charged: coalesce0(sum(rows, (r) => r.charged_micros)),
            up: count((r) => r.feedback === 1),
            down: count((r) => r.feedback === -1),
          },
        ];
      },
    },
  ],
  // ...the users active in it (auto-pick kept / on now)...
  [
    `SELECT COUNT(*) AS users,
              COALESCE(SUM(CASE WHEN u.auto_pick = 1 THEN 1 ELSE 0 END), 0) AS auto_on,
              COALESCE(SUM(CASE WHEN a.manual = 0 THEN 1 ELSE 0 END), 0) AS kept
         FROM (SELECT user_id, SUM(CASE WHEN kind = 'manual' THEN 1 ELSE 0 END) AS manual
                 FROM requests WHERE created_at >= ? AND user_id IS NOT NULL GROUP BY user_id) a
         JOIN users u ON u.id = a.user_id`,
    {
      all: (db, [since]) => {
        const manual = new Map();
        for (const r of db.rows("requests")) {
          if (!(r.created_at >= since) || r.user_id === null) continue;
          manual.set(r.user_id, (manual.get(r.user_id) || 0) + (r.kind === "manual" ? 1 : 0));
        }
        const users = new Map(db.rows("users").map((u) => [u.id, u]));
        let n = 0;
        let autoOn = 0;
        let kept = 0;
        for (const [userId, m] of manual) {
          const u = users.get(userId);
          if (!u) continue;
          n += 1;
          if (u.auto_pick === 1) autoOn += 1;
          if (m === 0) kept += 1;
        }
        return [{ users: n, auto_on: autoOn, kept }];
      },
    },
  ],
  // ...the credit given in it...
  [
    `SELECT COALESCE(SUM(CASE WHEN kind = 'purchase' THEN delta_micros ELSE 0 END), 0) AS purchases,
              COALESCE(SUM(CASE WHEN kind IN ('signup_bonus', 'dev_topup') THEN delta_micros ELSE 0 END), 0) AS free,
              COALESCE(SUM(CASE WHEN kind = 'admin_adjust' THEN delta_micros ELSE 0 END), 0) AS adjusted
         FROM ledger WHERE created_at >= ?`,
    {
      all: (db, [since]) => {
        const rows = db.rows("ledger").filter((l) => l.created_at >= since);
        return [
          {
            purchases: coalesce0(sum(rows, (l) => (l.kind === "purchase" ? l.delta_micros : 0))),
            free: coalesce0(sum(rows, (l) => (l.kind === "signup_bonus" || l.kind === "dev_topup" ? l.delta_micros : 0))),
            adjusted: coalesce0(sum(rows, (l) => (l.kind === "admin_adjust" ? l.delta_micros : 0))),
          },
        ];
      },
    },
  ],
  // ...and the archived totals of deleted accounts.
  [
    `SELECT COALESCE(SUM(requests), 0) AS requests, COALESCE(SUM(auto), 0) AS auto, COALESCE(SUM(manual), 0) AS manual,
              COALESCE(SUM(switches), 0) AS switches, COALESCE(SUM(api_micros), 0) AS api,
              COALESCE(SUM(failed_api_micros), 0) AS api_failed, COALESCE(SUM(charged_micros), 0) AS charged,
              COALESCE(SUM(up), 0) AS up, COALESCE(SUM(down), 0) AS down
         FROM usage_archive WHERE day >= ?`,
    {
      all: (db, [day]) => {
        const rows = db.rows("usage_archive").filter((a) => a.day >= day);
        const s = (c) => coalesce0(sum(rows, (a) => a[c]));
        return [
          {
            requests: s("requests"),
            auto: s("auto"),
            manual: s("manual"),
            switches: s("switches"),
            api: s("api_micros"),
            api_failed: s("failed_api_micros"),
            charged: s("charged_micros"),
            up: s("up"),
            down: s("down"),
          },
        ];
      },
    },
  ],
];

const ADMIN = [
  ["SELECT effort_override FROM routes WHERE job = ? AND tier = ?", { all: (db, [job, tier]) => select(db, "routes", (r) => r.job === job && r.tier === tier).map((r) => pickCols(r, ["effort_override"])) }],
  ["SELECT id FROM users WHERE id = ?", { all: (db, [id]) => select(db, "users", (u) => u.id === id).map((u) => pickCols(u, ["id"])) }],
  // GET /api/admin/users: `SELECT ${cols} FROM users ...`, with and without the email filter.
  [
    "SELECT id, email, balance_micros, is_admin, created_at FROM users WHERE email LIKE ? ESCAPE '\\' ORDER BY created_at DESC, id LIMIT ?",
    {
      all: (db, [pattern, n]) => {
        const match = likeMatcher(pattern, "\\");
        return limit(select(db, "users", (u) => match(u.email)).sort(usersNewest), n).map((u) => pickCols(u, ADMIN_USER_COLS));
      },
    },
  ],
  [
    "SELECT id, email, balance_micros, is_admin, created_at FROM users ORDER BY created_at DESC, id LIMIT ?",
    { all: (db, [n]) => limit(select(db, "users").sort(usersNewest), n).map((u) => pickCols(u, ADMIN_USER_COLS)) },
  ],
];

// Statements more than one module prepares are registered once (the first group above wins).
function dedupe(groups) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const entry of group) {
      const key = entry[0] instanceof RegExp ? `re:${entry[0].source}` : String(entry[0]).replace(/\s+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
    }
  }
  return out;
}

const STATEMENTS = dedupe([AUTH, PIPELINE, CREDITS, CATALOG, ROUTES, LEARN, ADMIN]);

/** Extra statement groups (tests, or more bundled modules) on top of the built-in ones. */
function withStatements(...groups) {
  return dedupe([STATEMENTS, ...groups]);
}

module.exports = { STATEMENTS, withStatements, ROWID_ALIAS, select, strip, pickCols, limit, byRowid, one, likeMatcher, signalSql };
