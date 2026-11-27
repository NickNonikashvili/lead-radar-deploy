"use strict";
// The demo account a first-time visitor lands in, made through the preview's own API (sign-up,
// chat, feedback), so every row is exactly what the app would store, then moved back in time so
// the sidebar shows Today / Yesterday / Previous 7 days.
//
// Everything here is fictional: demo@example.com, "Sam Carter" and sam.carter@example.com are
// sample values (example.com is reserved for examples).

const { typicalLatencyMs } = require("./seed-team");
const { usdToMicros } = require("../../src/util");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MINUTE = 60_000;

const WELCOME_TITLE = "Welcome to the Gode preview";

// Short enough to fit a phone screen at 375 x 812 (the app opens a chat at its latest message).
function welcomeText(demo) {
  return [
    `## ${WELCOME_TITLE}`,
    "",
    "The real Gode app on a simulated server. **No AI model is called, and nothing you type leaves this page.** Each answer explains which model the live app would pick and why, what it hides first, and what it would cost.",
    "",
    "**Sample chats** (in the menu on a phone):",
    "",
    "- **My name is Sam Carter…**: private, 2 details hidden",
    "- **Write a Python script…**: code, with its cost",
    "- **An image of a cozy reading…**: a picture",
    "- **Explain how compound interest…**: a follow-up on the same model",
    "",
    `Then try a **New chat**, **Settings**, **Billing** and **Admin**. You are **${demo.email}**, password \`${demo.password}\`. After Delete everything, log in with these to get the demo back.`,
  ].join("\n");
}

/** Read a whole event stream into [{ event, data }]. */
async function readEvents(res) {
  const text = await res.text();
  const events = [];
  for (const block of text.split(/\n\n/)) {
    let event = "message";
    const data = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (!data.length) continue;
    try {
      events.push({ event, data: JSON.parse(data.join("\n")) });
    } catch {
      events.push({ event, data: data.join("\n") });
    }
  }
  return events;
}

async function call(app, method, path, body) {
  const res = await app.fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) throw new Error(`seed: ${method} ${path} -> ${res.status} ${json && json.code}`);
  return json;
}

async function chat(app, text, conversationId) {
  const res = await app.fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(conversationId ? { conversation_id: conversationId, text } : { text }),
  });
  if (!res.ok) throw new Error(`seed: chat -> ${res.status}`);
  const events = await readEvents(res);
  const route = events.find((e) => e.event === "route");
  const done = events.find((e) => e.event === "done");
  const error = events.find((e) => e.event === "error");
  if (!route || !done || error) throw new Error(`seed: chat failed (${error ? error.data.code : "no done event"})`);
  return { conversationId: done.data.conversation_id, messageId: done.data.message_id, route: route.data };
}

/** Move every row written at or after `mark` back by `by` ms (one conversation's worth). */
function backdate(db, mark, by) {
  const shift = (table, cols) =>
    db.update(
      table,
      (r) => cols.some((c) => typeof r[c] === "number" && r[c] >= mark),
      (r) => Object.fromEntries(cols.filter((c) => typeof r[c] === "number" && r[c] >= mark).map((c) => [c, r[c] - by]))
    );
  shift("conversations", ["created_at", "updated_at"]);
  shift("messages", ["created_at"]);
  shift("requests", ["created_at"]);
  shift("ledger", ["created_at"]);
  shift("users", ["created_at"]);
  shift("bonus_claims", ["created_at"]);
}

/**
 * @param {{ db, app: { fetch }, credits, keyring, deployment, welcomeId?: string, restore?: { bonusMicros: number } }} deps
 *   welcomeId: the welcome conversation's id, known before the seed runs so the page can open it
 *   restore: the demo account is made again after Delete everything removed it (restoreDemo)
 */
async function seedDemo({ db, app, credits, keyring, deployment, welcomeId = globalThis.crypto.randomUUID(), restore = null }) {
  const demo = (deployment && deployment.demo) || { email: "demo@example.com", password: "preview-demo" };
  const now = Date.now();
  let mark = now;

  // Four days ago: the account, its welcome credit and a $5 credit purchase.
  const signedUp = await call(app, "POST", "/api/auth/signup", { email: demo.email, password: demo.password });
  const { user } = signedUp;
  if (restore) {
    // Made again after Delete everything: the address already had its one welcome credit (the
    // real rule, by an HMAC of the address), and it is no longer the first account, so it would
    // be an ordinary user. The demo gets both back, as it was.
    if (!(Number(signedUp.signup_bonus_usd) > 0) && restore.bonusMicros > 0) credits.grant(user.id, restore.bonusMicros, "signup_bonus", "signup");
    db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(1, user.id);
  }
  // A purchase is booked once per checkout reference (credits.grant): a restored demo's is a new one.
  credits.grant(user.id, 5_000_000, "purchase", restore ? `preview_seed_checkout_${now}` : "preview_seed_checkout");
  backdate(db, mark, 4 * DAY + 2 * HOUR);

  // Three days ago: a code question (the code column's balanced pick).
  mark = Date.now();
  const code = await chat(app, "Write a Python script that renames my photos by the date they were taken.");
  await call(app, "POST", `/api/messages/${encodeURIComponent(code.messageId)}/feedback`, { value: 1 });
  backdate(db, mark, 3 * DAY + 5 * HOUR);

  // Yesterday: an explanation, and a follow-up that stays on the conversation's pinned model.
  mark = Date.now();
  const interest = await chat(app, "Explain how compound interest works, like I’m 12.");
  await call(app, "POST", `/api/messages/${encodeURIComponent(interest.messageId)}/feedback`, { value: 1 });
  await chat(app, "And what changes if I add $10 every month?", interest.conversationId);
  backdate(db, mark, DAY + 3 * HOUR);

  // Today: a private health question with a name and an email in it.
  mark = Date.now();
  await chat(
    app,
    "My name is Sam Carter and I was diagnosed with HIV last month. How do I tell my partner? You can reach me at sam.carter@example.com."
  );
  backdate(db, mark, 3 * HOUR);

  // Today: a picture.
  mark = Date.now();
  const image = await chat(app, "An image of a cozy reading nook on a rainy afternoon, soft watercolor style.");
  await call(app, "POST", `/api/messages/${encodeURIComponent(image.messageId)}/feedback`, { value: 1 });
  backdate(db, mark, HOUR + 10 * MINUTE);

  // The seed runs with no pauses, so the answers above measured a latency of a few ms: give them
  // a typical live one, so the admin overview's "Avg latency" column reads like a real deployment.
  db.update(
    "requests",
    (r) => r.user_id === user.id,
    (r) => ({ latency_ms: typicalLatencyMs({ job: r.job, outputTokens: r.output_tokens, effort: r.effort }) })
  );

  // Just now: the welcome note (written straight to the tables; it is not an answer, so it has no
  // routing log row, chip or cost).
  const t = Date.now() - 2 * MINUTE;
  const row = db.rows("users").find((u) => u.id === user.id);
  const convId = welcomeId;
  db.tx(() => {
    db.insert("conversations", { id: convId, user_id: user.id, title_enc: keyring.encrypt(row.wrapped_dek, WELCOME_TITLE), pins: "{}", pii_map_enc: null, private: 0, created_at: t, updated_at: t });
    db.insert("messages", {
      id: globalThis.crypto.randomUUID(),
      conversation_id: convId,
      user_id: user.id,
      role: "assistant",
      content_enc: keyring.encrypt(row.wrapped_dek, { text: welcomeText(demo) }, { json: true }),
      parent_id: null,
      request_id: null,
      superseded: 0,
      created_at: t,
    });
  });
  return { userId: user.id, welcomeConversationId: convId };
}

/**
 * The demo account again, after Delete everything removed it: the same account, chats, credit and
 * admin flag as on a first visit (the teammates and their history were never deleted).
 * preview/src/demo-routes.js calls it when someone signs in with the demo's credentials.
 */
async function restoreDemo({ db, app, credits, keyring, deployment, config }) {
  const bonusMicros = usdToMicros((config && config.billing && config.billing.signupCreditUsd) || 0);
  return seedDemo({ db, app, credits, keyring, deployment, restore: { bonusMicros } });
}

module.exports = { seedDemo, restoreDemo, readEvents, welcomeText, WELCOME_TITLE };
