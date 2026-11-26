// Browser smoke test: the REAL server (`node server.js` in mock mode, real pipeline, a fresh
// database) driven by Chromium through every screen, at desktop (1280x820) and phone (375x812)
// sizes. Fails on any broken check, any unexpected console or network error in the browser, and
// any unexpected server log line.
//
//   npm run e2e
//
// Needs Playwright with its Chromium (not an npm dependency of Gode: install it once with
// `npm i -g playwright && npx playwright install chromium`, or set NODE_PATH to where it lives).
//
// Environment:
//   E2E_SHOTS=<dir>     where screenshots go (default: e2e/shots, git-ignored)
//   E2E_DATA_DIR=<dir>  parent of the temporary data directory (default: the OS temp dir)
//   E2E_KEEP=1          keep the temporary data directory (database, dev master key) afterwards
"use strict";
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const assert = require("assert/strict");
const { spawn } = require("child_process");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("e2e: Playwright is not installed. Run `npm i -g playwright && npx playwright install chromium` (see README).");
  process.exit(2);
}

const ROOT = path.join(__dirname, "..");
const SHOTS = path.resolve(process.env.E2E_SHOTS || path.join(__dirname, "shots"));
const PASSWORD = "correct horse battery";
const EMAIL = "ada@example.com";
const NAME = "Ada Lovelace";
const PII_PROMPT = `Hi, my name is ${NAME} and my email is ada.lovelace@example.org. Draft a short thank-you note to my landlord.`;
const SONNET = "Claude Sonnet 5.5";
fs.mkdirSync(SHOTS, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------------------------

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ ok: true, name });
    console.log("PASS", name);
  } catch (e) {
    results.push({ ok: false, name, error: e.message });
    console.log("FAIL", name, "\n    " + String(e.message).split("\n").slice(0, 8).join("\n    "));
  }
}

const browserLines = [];
function watch(page, label) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") browserLines.push(`[${label}] console ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => browserLines.push(`[${label}] pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) browserLines.push(`[${label}] http ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
}

// 4xx answers the scenarios cause on purpose. Chrome also logs each one as a console error
// ("Failed to load resource: ... 401"), which is the browser reporting a status, not a JS error.
const EXPECTED_BROWSER = [
  /http 401 GET \/api\/me$/, // logged-out start screen
  /http 401 POST \/api\/auth\/login$/, // wrong password on the log-in form
  /http 401 DELETE \/api\/me$/, // wrong password on "delete everything"
  /console error: Failed to load resource: the server responded with a status of 401 \(Unauthorized\)$/,
];

// Server log lines a clean run may print: boot, the dev master key notice, the one failure we
// trigger on purpose, shutdown.
const EXPECTED_SERVER = [
  /^\[gode\] seeded the model catalog \(\d+ models, \d+ routes\)$/,
  /^\[gode\] No GODE_MASTER_KEY set; generated a development key at .+\. Set GODE_MASTER_KEY in production\.$/,
  /^\[gode\] mock mode · gateways: none · http:\/\/localhost:\d+$/,
  /^\[pipeline\] [0-9a-f-]{36} failed: upstream_error$/,
  /^\[gode\] SIGTERM: shutting down$/,
];

// ---------------------------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------------------------

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(process.env.E2E_DATA_DIR || os.tmpdir(), "gode-e2e-"));
  const port = await freePort();
  // Everything that changes what the pages show is pinned here, so a developer's .env (which
  // server.js loads, without overriding variables that are already set) can't change the run.
  const env = {
    ...process.env,
    NODE_ENV: "development",
    GODE_MOCK: "1",
    ALLOW_DEV_TOPUP: "1",
    PORT: String(port),
    PUBLIC_URL: `http://127.0.0.1:${port}`,
    DATA_DIR: dataDir,
    DATABASE_PATH: path.join(dataDir, "gode.db"),
    GODE_MASTER_KEY: "",
    ADMIN_EMAILS: "",
    SIGNUP_CREDIT_USD: "0.25",
    CREDIT_MARGIN: "0.3",
    CREDIT_PACKS: "5,10,25",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    REDACTION: "on",
    PRESIDIO_ANALYZER_URL: "",
    PRIVATE_FALLBACK: "zdr",
    // One answer with feedback is enough for the learner to propose something.
    LEARN_MIN_SAMPLES: "1",
  };
  const child = spawn(process.execPath, [path.join(ROOT, "server.js")], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  const lines = [];
  let buffered = "";
  const onData = (chunk) => {
    buffered += chunk.toString("utf8");
    let nl;
    while ((nl = buffered.indexOf("\n")) >= 0) {
      lines.push(buffered.slice(0, nl));
      buffered = buffered.slice(nl + 1);
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));

  const deadline = Date.now() + 15_000;
  while (!lines.some((l) => l.includes(`localhost:${port}`))) {
    if (child.exitCode !== null) throw new Error(`server exited during boot:\n${lines.join("\n")}`);
    if (Date.now() > deadline) throw new Error(`server did not start within 15 s:\n${lines.join("\n")}`);
    await new Promise((r) => setTimeout(r, 50));
  }

  return {
    base: `http://127.0.0.1:${port}`,
    lines,
    async stop() {
      child.kill("SIGTERM");
      const result = await Promise.race([exited, new Promise((r) => setTimeout(() => r({ code: "timeout" }), 15_000))]);
      if (result.code === "timeout") child.kill("SIGKILL");
      if (buffered) lines.push(buffered);
      if (!process.env.E2E_KEEP) fs.rmSync(dataDir, { recursive: true, force: true });
      else console.log("kept data directory:", dataDir);
      return result;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------------------------

const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), ...opts });

async function noHorizontalScroll(page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw, `page scrolls sideways: scrollWidth ${sw} > innerWidth ${iw}`);
}

/** Wait until the newest answer stopped streaming and shows its final chip, a notice or "stopped". */
async function lastAnswerSettled(page) {
  await page.waitForFunction(
    () => {
      const msgs = document.querySelectorAll(".msg-assistant");
      const last = msgs[msgs.length - 1];
      if (!last || last.classList.contains("is-live")) return false;
      return Boolean(last.querySelector(".chip-text") || last.querySelector(".notice") || last.querySelector(".msg-stopped"));
    },
    null,
    { timeout: 20_000 }
  );
}

/**
 * Record what the newest answer looks like WHILE it streams (a MutationObserver, so nothing is
 * missed between polls): the growing text lengths, the chip texts and which live states appeared.
 */
async function recordLive(page) {
  await page.evaluate(() => {
    const rec = { lengths: [], chips: [], seen: {} };
    window.__live = rec;
    const sample = () => {
      const msgs = document.querySelectorAll(".msg-assistant");
      const last = msgs[msgs.length - 1];
      if (!last) return;
      const md = last.querySelector(".md");
      if (md && last.classList.contains("is-live")) {
        const n = md.textContent.length;
        if (rec.lengths[rec.lengths.length - 1] !== n) rec.lengths.push(n);
      }
      const chip = last.querySelector(".chip-text");
      if (chip && rec.chips[rec.chips.length - 1] !== chip.textContent) rec.chips.push(chip.textContent);
      for (const sel of [".routing-state", ".chip-pulse", ".generating"]) if (last.querySelector(sel)) rec.seen[sel] = true;
    };
    window.__liveObserver?.disconnect();
    window.__liveObserver = new MutationObserver(sample);
    window.__liveObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  return async () =>
    page.evaluate(() => {
      window.__liveObserver?.disconnect();
      return window.__live;
    });
}

async function send(page, text) {
  await page.fill("#composer-input", text);
  await page.keyboard.press("Enter");
}

/** The open conversation's id, from the #/c/<id> route. */
function conversationIdOf(page) {
  const m = /#\/c\/([0-9a-f-]{36})/.exec(page.url());
  assert.ok(m, `not on a conversation: ${page.url()}`);
  return m[1];
}

/** JSON API call with the page's own session (shares the browser context's cookies). */
async function apiGet(page, base, urlPath) {
  const r = await page.request.get(base + urlPath);
  assert.equal(r.status(), 200, `GET ${urlPath} -> ${r.status()}`);
  return r.json();
}

async function logIn(page, base) {
  await page.goto(base + "/");
  await page.waitForSelector(".auth-card");
  if (await page.isVisible('.auth-tab:has-text("Log in")')) await page.click('.auth-tab:has-text("Log in")');
  await page.fill("#auth-email", EMAIL);
  await page.fill("#auth-password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForSelector(".composer, .empty-state");
}

// ---------------------------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------------------------

async function desktopFlow(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, colorScheme: "light" });
  const page = await ctx.newPage();
  watch(page, "desktop");
  const state = {};

  await check("auth screen renders under the real CSP, with inline validation", async () => {
    await page.goto(base + "/");
    await page.waitForSelector(".auth-card h2");
    assert.equal(await page.textContent(".auth-card h2"), "Create your account");
    await page.click("button[type=submit]");
    await page.waitForSelector("#auth-email-error");
    assert.match(await page.textContent("#auth-email-error"), /valid email/);
    await shot(page, "d-auth");
  });

  await check("log in with a wrong password shows the server's error inline", async () => {
    await page.click('.auth-tab:has-text("Log in")');
    await page.fill("#auth-email", "nobody@example.com");
    await page.fill("#auth-password", "wrong-password");
    await page.click("button[type=submit]");
    await page.waitForSelector(".form-error");
    assert.match(await page.textContent(".form-error"), /Wrong email or password/);
  });

  await check("sign up lands in chat with the $0.25 signup credit and the admin link", async () => {
    await page.click('.auth-tab:has-text("Sign up")');
    await page.fill("#auth-email", EMAIL);
    await page.fill("#auth-password", PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForSelector(".empty-state h1");
    assert.match(await page.textContent(".balance-value"), /^\$0\.25$/);
    assert.ok(await page.isVisible('.nav-link:has-text("Admin")'), "first account is the admin");
    const ledger = await apiGet(page, base, "/api/billing/ledger");
    assert.deepEqual(ledger.entries.map((e) => [e.kind, e.delta_usd]), [["signup_bonus", 0.25]]);
    await shot(page, "d-chat-empty");
  });

  await check("chat streams through the real pipeline: live chip, growing text, final chip, hidden details", async () => {
    const stop = await recordLive(page);
    await send(page, PII_PROMPT);
    await page.waitForSelector(".msg-user .bubble");
    await page.waitForSelector(".msg-assistant.is-live", { timeout: 10_000 });
    await shot(page, "d-chat-streaming");
    await lastAnswerSettled(page);
    const live = await stop();
    assert.ok(live.lengths.length >= 3, `text grew in pieces: ${JSON.stringify(live.lengths)}`);
    assert.ok(live.chips.some((c) => /est\. \$/.test(c)), `live chip with an estimate: ${JSON.stringify(live.chips)}`);

    const chip = await page.textContent(".msg-assistant .chip-text");
    assert.match(chip, /^DeepSeek V4\.1 Flash · low effort · (\$[\d.]+|<\$0\.0001)$/);
    // The mock model echoes what it received; the user sees the real values put back.
    const answer = await page.textContent(".msg-assistant .md");
    assert.ok(answer.includes(NAME), answer);
    assert.ok(!/\[PERSON_\d\]/.test(answer), "no placeholder on screen");
    assert.match(await page.textContent(".msg-assistant .badge-hidden"), /^2 personal details hidden from the model$/);
    state.conversationId = conversationIdOf(page);
    await page.waitForSelector(".conv-item.is-active .conv-title");
    assert.match(await page.textContent(".conv-item.is-active .conv-title"), /Ada Lovelace/, "title restored from placeholders");
    assert.ok(!/^\$0\.25$/.test(await page.textContent(".balance-value")), "balance moved");

    const conv = await apiGet(page, base, `/api/conversations/${state.conversationId}`);
    assert.equal(conv.messages[1].request.chip, chip, "stored chip == live chip");
    await shot(page, "d-chat-done");
  });

  await check("thumbs up is stored on the request; pressing again clears it", async () => {
    const up = page.locator('.msg-assistant .action-btn[aria-label="Good answer"]').last();
    await up.click();
    await page.waitForFunction(() => document.querySelector('.action-btn[aria-label="Good answer"]').getAttribute("aria-pressed") === "true");
    let conv = await apiGet(page, base, `/api/conversations/${state.conversationId}`);
    assert.equal(conv.messages[1].request.feedback, 1);
    await up.click();
    await page.waitForFunction(() => document.querySelector('.action-btn[aria-label="Good answer"]').getAttribute("aria-pressed") === "false");
    conv = await apiGet(page, base, `/api/conversations/${state.conversationId}`);
    assert.equal(conv.messages[1].request.feedback, null);
  });

  await check("switch menu lists candidates; switching to Claude Sonnet 5.5 replaces the answer", async () => {
    await page.click(".msg-assistant .chip-button");
    await page.waitForSelector(".menu .menu-item");
    const items = await page.$$eval(".menu .menu-item-label", (els) => els.map((e) => e.textContent));
    assert.ok(items.length >= 5, `candidates: ${items.join(", ")}`);
    assert.ok(items.includes(SONNET));
    assert.ok(await page.$(".menu .menu-item.is-current"), "current model marked");
    await page.waitForTimeout(250);
    await shot(page, "d-switch-menu");
    await page.click(`.menu .menu-item:has-text("${SONNET}")`);
    await page.waitForSelector(".msg-assistant.is-live");
    await lastAnswerSettled(page);
    assert.match(await page.textContent(".msg-assistant .chip-text"), /^Claude Sonnet 5\.5 · /);
    assert.equal(await page.$$eval(".msg-assistant", (e) => e.length), 1, "replaced, not appended");
  });

  await check("regenerate keeps the pinned model; thumbs up on the new answer", async () => {
    await page.locator('.msg-assistant .action-btn[aria-label="Regenerate with the same model"]').last().click();
    await page.waitForSelector(".msg-assistant.is-live");
    await lastAnswerSettled(page);
    assert.match(await page.textContent(".msg-assistant .chip-text"), /^Claude Sonnet 5\.5 · /);
    await page.locator('.msg-assistant .action-btn[aria-label="Good answer"]').last().click();
    await page.waitForFunction(() => document.querySelector('.action-btn[aria-label="Good answer"]').getAttribute("aria-pressed") === "true");
    const conv = await apiGet(page, base, `/api/conversations/${state.conversationId}`);
    assert.equal(conv.conversation.pins.chat.source, "user");
    assert.equal(conv.messages[1].request.feedback, 1);
  });

  await check("reload restores the conversation with the same chip", async () => {
    const chipBefore = await page.textContent(".msg-assistant .chip-text");
    await page.reload();
    await page.waitForSelector(".msg-assistant .chip-text");
    assert.equal(await page.$$eval(".msg-user", (e) => e.length), 1);
    assert.equal(await page.$$eval(".msg-assistant", (e) => e.length), 1);
    assert.equal(await page.textContent(".msg-assistant .chip-text"), chipBefore);
    assert.match(await page.textContent(".msg-user .bubble"), /Ada Lovelace/, "the question, decrypted");
  });

  await check("an image prompt shows generation progress, then the image", async () => {
    const stop = await recordLive(page);
    await send(page, "Draw a picture of a red fox in the snow");
    await page.waitForSelector(".msg-assistant:last-child .media img", { timeout: 15_000 });
    await lastAnswerSettled(page);
    const live = await stop();
    assert.ok(live.seen[".generating"], `a generating state was shown: ${JSON.stringify(live.seen)}`);
    const decoded = await page.$eval(".msg-assistant:last-child .media img", (img) => img.complete && img.naturalWidth > 0);
    assert.ok(decoded, "image decoded");
    assert.equal(await page.textContent(".msg-assistant:last-child .chip-text"), "Qwen Image 3 · $0.05");
    await shot(page, "d-media-image");
  });

  await check("an upstream failure mid-answer shows an inline notice with Try again", async () => {
    await send(page, "GODE_MOCK_FAIL_MIDSTREAM please explain compound interest");
    await page.waitForSelector(".msg-assistant:last-child .notice-error", { timeout: 15_000 });
    assert.ok(await page.$('.msg-assistant:last-child .notice-error button:has-text("Try again")'));
    await shot(page, "d-error-upstream");
  });

  await check("settings: plan and toggles are saved; strict privacy refuses media; transparency table", async () => {
    await page.click('.nav-link:has-text("Settings")');
    await page.waitForSelector(".plan-card");
    await page.click('.plan-card:has-text("Best")');
    await page.waitForSelector('.plan-card.is-selected:has-text("Best")');
    assert.equal((await apiGet(page, base, "/api/me")).user.plan, "best");
    assert.equal(await page.getAttribute("#share-prompts", "aria-checked"), "false", "share prompts is opt-in");
    await page.click("#strict-privacy");
    await page.waitForFunction(() => document.querySelector("#strict-privacy").getAttribute("aria-checked") === "true");
    assert.equal((await apiGet(page, base, "/api/me")).user.strict_privacy, true);

    await page.waitForSelector(".table tbody tr td.num");
    const rows = await page.$$eval(".table tbody tr", (r) => r.length);
    assert.ok(rows >= 5, `transparency rows: ${rows}`);
    const table = await page.textContent(".table");
    assert.ok(!table.includes("Lovelace") && !table.includes("fox"), "the log holds no prompt text");
    await shot(page, "d-settings");
    await page.locator(".page").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await shot(page, "d-settings-log");

    // Strict privacy + an image request: no media model is zero-retention, so it is refused.
    await page.click(".sidebar-new .btn");
    await send(page, "Draw a picture of a lighthouse at dusk");
    await page.waitForSelector(".msg-assistant:last-child .notice", { timeout: 15_000 });
    assert.match(await page.textContent(".msg-assistant:last-child .notice"), /Kept private, not sent/);
    assert.match(await page.textContent(".msg-assistant:last-child .notice"), /Strict privacy is on/);
    await shot(page, "d-private-blocked");

    await page.goto(base + "/#/settings");
    await page.click("#strict-privacy");
    await page.waitForFunction(() => document.querySelector("#strict-privacy").getAttribute("aria-checked") === "false");
    await page.click('.plan-card:has-text("Balanced")');
    await page.waitForSelector('.plan-card.is-selected:has-text("Balanced")');
  });

  await check("auto-pick off: the composer offers a model select and that model answers", async () => {
    await page.click("#auto-pick");
    await page.waitForFunction(() => document.querySelector("#auto-pick").getAttribute("aria-checked") === "false");
    await page.click(".sidebar-new .btn");
    await page.waitForSelector('.model-picker select option[value="openrouter:mistralai/mistral-large-4-0"]', { state: "attached" });
    await page.selectOption(".model-picker select", "openrouter:mistralai/mistral-large-4-0");
    assert.match(await page.textContent(".mode-pill"), /Manual/);
    await send(page, "Say hi in French");
    await lastAnswerSettled(page);
    assert.match(await page.textContent(".msg-assistant .chip-text"), /^Mistral Large 4 · /);
    await shot(page, "d-chat-manual");
    await page.goto(base + "/#/settings");
    await page.click("#auto-pick");
    await page.waitForFunction(() => document.querySelector("#auto-pick").getAttribute("aria-checked") === "true");
  });

  await check("billing: margin explainer, dev top-up (bounded at $100) and the ledger", async () => {
    await page.goto(base + "/#/billing");
    await page.waitForSelector(".balance-hero-value");
    assert.match(await page.textContent("#packs-title + .card-sub"), /API cost \+ margin \(30%\)/);
    await page.fill("#topup", "150");
    await page.click('button:has-text("Add test credit")');
    await page.waitForSelector("text=Enter an amount between $0.01 and $100.");
    const before = await page.textContent(".balance-hero-value");
    await page.fill("#topup", "3");
    await page.click('button:has-text("Add test credit")');
    await page.waitForFunction((b) => document.querySelector(".balance-hero-value").textContent !== b, before);
    await page.waitForSelector('td:has-text("Developer top-up")');
    assert.ok(await page.$('td:has-text("Welcome credit")'));
    const ledger = await apiGet(page, base, "/api/billing/ledger");
    assert.ok(ledger.entries.some((e) => e.kind === "dev_topup" && e.delta_usd === 3));
    assert.ok(ledger.entries.some((e) => e.kind === "charge" && e.delta_usd < 0), "charges are listed");
    // Balances under $10 keep sub-cent precision ("$3.1956") so small charges visibly move it.
    const shown = Number((await page.textContent(".balance-hero-value")).replace(/[^0-9.]/g, ""));
    assert.ok(Math.abs(shown - ledger.balance_usd) < 0.00005, `shown ${shown}, ledger ${ledger.balance_usd}`);
    await shot(page, "d-billing");
  });

  await check("admin overview: gate metrics and per-model stats from real requests", async () => {
    await page.goto(base + "/#/admin");
    await page.click('.tab:has-text("Overview")');
    await page.waitForSelector(".stat-grid:not(.is-loading) .stat-card .stat-value");
    const cards = await page.$$eval(".stat-card", (els) => els.map((e) => [e.querySelector(".stat-label").textContent, e.querySelector(".stat-value").textContent]));
    assert.ok(cards.length >= 4, JSON.stringify(cards));
    assert.ok(cards.every(([, v]) => v && v.trim()), "every card has a value");
    await page.waitForSelector(`td:has-text("${SONNET}")`);
    await shot(page, "d-admin-overview");
  });

  await check("admin routing: a model and effort edit is saved to the routing table", async () => {
    await page.click('.tab:has-text("Routing")');
    await page.waitForSelector(".table-grid select");
    const codeBudget = page.locator('select[aria-label="Code Budget model"]');
    const options = await codeBudget.locator("option").evaluateAll((els) => els.map((o) => o.value));
    assert.ok(options.every((id) => !/fal:|image/.test(id)), "only code-capable models offered");
    const target = options.find((id) => id === "openrouter:anthropic/claude-haiku-5.5") || options.find((id) => id !== (options[0] || ""));
    await codeBudget.selectOption(target);
    await page.waitForSelector('.route-status:has-text("Saved")');
    await page.selectOption('select[aria-label="Code Budget effort override"]', "low");
    const routing = await (async () => {
      for (let i = 0; i < 40; i++) {
        const r = await apiGet(page, base, "/api/admin/routing");
        const cell = r.routes.find((x) => x.job === "code" && x.tier === "budget");
        if (cell.effort_override === "low") return r;
        await page.waitForTimeout(50);
      }
      return apiGet(page, base, "/api/admin/routing");
    })();
    const cell = routing.routes.find((x) => x.job === "code" && x.tier === "budget");
    assert.deepEqual({ model_id: cell.model_id, effort_override: cell.effort_override, source: cell.source }, { model_id: target, effort_override: "low", source: "admin" });
    assert.equal(await page.$('select[aria-label="Image Quality effort override"]'), null, "no effort select for media jobs");
    await shot(page, "d-admin-routing");
  });

  await check("admin learner: proposals from the feedback, then Apply updates the grid", async () => {
    await page.click('button:has-text("Run learner")');
    await page.waitForSelector('button:has-text("Apply "), .notice:has-text("No changes proposed")');
    const apply = page.locator('button:has-text("Apply ")');
    assert.equal(await apply.count(), 1, "the feedback so far yields at least one proposal");
    await page.locator("#learn-title").scrollIntoViewIfNeeded();
    await shot(page, "d-admin-learn");
    const before = await apiGet(page, base, "/api/admin/routing");
    await apply.click();
    await page.waitForSelector('.notice-success:has-text("Routing table updated")');
    const after = await apiGet(page, base, "/api/admin/routing");
    const changed = after.routes.filter((r) => r.source === "learn");
    assert.ok(changed.length >= 1, "a cell was changed by the learner");
    for (const r of changed) {
      const old = before.routes.find((x) => x.job === r.job && x.tier === r.tier);
      assert.notEqual(old.model_id, r.model_id);
      assert.notEqual(r.tier, "private", "the learner never touches the private tier");
      const label = after.models.find((m) => m.id === r.model_id).label;
      const tierName = r.tier[0].toUpperCase() + r.tier.slice(1);
      const jobName = r.job[0].toUpperCase() + r.job.slice(1);
      assert.equal(await page.inputValue(`select[aria-label="${jobName} ${tierName} model"]`), r.model_id, `grid shows ${label}`);
    }
  });

  await check("admin catalog: a cleared price is flagged, a price edit is saved", async () => {
    await page.click('.tab:has-text("Catalog")');
    await page.fill('input[aria-label="Search models"]', "flux.1");
    const row = page.locator('tr:has-text("FLUX.1 schnell")');
    const input = row.locator("input[type=number]");
    const original = await input.inputValue();
    assert.ok(Number(original) > 0, "seeded with a price");
    await input.fill("");
    await row.locator('button:has-text("Save")').click();
    await row.locator(".row-status.ok").waitFor();
    await row.locator('.tag-warn:has-text("No price")').waitFor();
    await shot(page, "d-admin-catalog-unpriced");
    await input.fill(original);
    await row.locator('button:has-text("Save")').click();
    await row.locator(".row-status.ok").waitFor();
    assert.equal(await row.locator(".tag-warn").count(), 0, "flag gone once priced");
    const models = (await apiGet(page, base, "/api/admin/routing")).models;
    assert.equal(models.find((m) => m.label === "FLUX.1 schnell").price_per_unit, Number(original));
    await page.fill('input[aria-label="Search models"]', "");
    await shot(page, "d-admin-catalog");
  });

  await check("admin catalog: export downloads JSON that imports back", async () => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export JSON")')]);
    const file = path.join(SHOTS, "catalog-export.json");
    await dl.saveAs(file);
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.ok(data.models.length >= 30 && data.routes.length >= 28);
    await page.setInputFiles("input[type=file]", file);
    await page.waitForSelector('.notice-warn:has-text("Import catalog-export.json?")');
    await page.click('.notice-warn button:has-text("Import")');
    await page.waitForSelector('.toast:has-text("Catalog imported")');
    fs.rmSync(file, { force: true });
  });

  await check("privacy: the in-app page and /privacy.html list the live providers", async () => {
    await page.click('.nav-link:has-text("Privacy")');
    await page.waitForSelector(".table-providers tbody tr td");
    const n = await page.$$eval(".table-providers tbody tr", (r) => r.length);
    assert.ok(n >= 30, `providers: ${n}`);
    assert.match(await page.textContent(".privacy"), /can.t promise/i);
    await shot(page, "d-privacy");

    const p = await ctx.newPage();
    watch(p, "privacy.html");
    await p.goto(base + "/privacy.html");
    await p.waitForSelector(".table-providers tbody td");
    assert.equal(await p.$$eval(".promise", (e) => e.length), 7);
    assert.equal(await p.$$eval(".table-providers tbody tr", (r) => r.length), n);
    await shot(p, "d-privacy-standalone");
    await p.close();
  });

  await check("sidebar: delete a conversation with the inline confirm", async () => {
    await page.goto(base + "/#/");
    await page.waitForSelector(".conv-item");
    const before = await page.$$eval(".conv-item", (e) => e.length);
    await page.hover(".conv-item >> nth=0");
    await page.click(".conv-item >> nth=0 >> .conv-delete");
    await page.waitForSelector(".conv-item.is-confirming");
    await page.click(".conv-item.is-confirming .btn-danger");
    await page.waitForFunction((b) => document.querySelectorAll(".conv-item").length === b - 1, before);
    const list = await apiGet(page, base, "/api/conversations");
    assert.equal(list.conversations.length, before - 1);
  });

  return { ctx, page, state };
}

async function mobileFlow(browser, base, scheme) {
  const tag = scheme === "light" ? "m" : "mk";
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
  const m = await ctx.newPage();
  watch(m, `mobile-${scheme}`);
  await check(`phone 375x812 (${scheme}): log in, drawer, chat, switch sheet, every screen without sideways scroll`, async () => {
    await m.goto(base + "/");
    await m.waitForSelector(".auth-card");
    await noHorizontalScroll(m);
    await shot(m, `${tag}-auth`);
    await logIn(m, base);
    await m.waitForSelector(".empty-state");
    assert.ok(!(await m.isVisible(".sidebar")), "the sidebar is a closed drawer");
    await noHorizontalScroll(m);
    await shot(m, `${tag}-chat-empty`);

    await m.click(".menu-btn");
    await m.waitForSelector(".sidebar.is-open");
    await m.waitForTimeout(300);
    await shot(m, `${tag}-drawer`);
    await m.click(".conv-item .conv-link >> nth=0");
    await m.waitForSelector(".msg-assistant .chip-text");
    await m.waitForTimeout(300);
    assert.ok(!(await m.isVisible(".sidebar.is-open")), "the drawer closes on navigation");
    await noHorizontalScroll(m);
    await shot(m, `${tag}-chat`);

    await m.click(".msg-assistant >> nth=0 >> .chip-button");
    await m.waitForSelector(".menu .menu-item");
    const box = await m.$eval(".menu", (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: window.innerWidth, h: window.innerHeight };
    });
    assert.ok(box.l >= 0 && box.r <= box.w && box.t >= 0 && box.b <= box.h, `switch sheet inside the viewport: ${JSON.stringify(box)}`);
    await m.waitForTimeout(300);
    await shot(m, `${tag}-switch`);
    await m.click(".menu-scrim", { position: { x: 20, y: 20 } });
    await m.waitForSelector(".menu", { state: "detached" });

    await send(m, "Explain compound interest like I am 12");
    await lastAnswerSettled(m);
    assert.match(await m.textContent(".msg-assistant:last-child .chip-text"), / · \$|<\$0\.0001/);
    await noHorizontalScroll(m);
    await shot(m, `${tag}-chat-done`);

    for (const [hash, name, sel] of [
      ["#/settings", "settings", ".plan-card"],
      ["#/billing", "billing", ".balance-hero-value"],
      ["#/admin", "admin", ".stat-card"],
      ["#/privacy", "privacy", ".table-providers tbody td"],
    ]) {
      await m.goto(base + "/" + hash);
      await m.waitForSelector(sel);
      await m.waitForTimeout(150);
      await noHorizontalScroll(m);
      await shot(m, `${tag}-${name}`);
    }
    await m.goto(base + "/privacy.html");
    await m.waitForSelector(".table-providers tbody td");
    await noHorizontalScroll(m);
    await shot(m, `${tag}-privacy-standalone`);
  });
  await ctx.close();
}

async function darkTour(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  watch(page, "dark");
  await check("desktop dark theme: every screen renders", async () => {
    await logIn(page, base);
    await page.click(".conv-item .conv-link >> nth=0");
    await page.waitForSelector(".msg-assistant .chip-text");
    await shot(page, "k-chat");
    for (const [hash, name, sel] of [
      ["#/settings", "k-settings", ".plan-card"],
      ["#/billing", "k-billing", ".balance-hero-value"],
      ["#/admin", "k-admin", ".stat-card"],
      ["#/privacy", "k-privacy", ".table-providers tbody td"],
    ]) {
      await page.goto(base + "/" + hash);
      await page.waitForSelector(sel);
      await page.waitForTimeout(150);
      await shot(page, name);
    }
  });
  await ctx.close();
}

async function deleteEverything(page, base) {
  await check("delete everything: a wrong password is refused inline; the right one signs out for good", async () => {
    await page.goto(base + "/#/settings");
    await page.click('button:has-text("Delete my account and data")');
    await page.fill("#delete-password", "nope-nope-nope");
    await page.click('button:has-text("Delete everything")');
    await page.waitForSelector("#delete-error");
    assert.match(await page.textContent("#delete-error"), /Wrong password/);
    assert.ok(await page.isVisible(".plan-card"), "still signed in");
    await shot(page, "d-delete-error");
    await page.fill("#delete-password", PASSWORD);
    await page.click('button:has-text("Delete everything")');
    await page.waitForSelector(".auth-card");
    assert.equal(await page.textContent(".auth-card h2"), "Create your account");
    // The account is gone: its credentials no longer log in.
    const r = await page.request.post(base + "/api/auth/login", { data: { email: EMAIL, password: PASSWORD }, headers: { Origin: base } });
    assert.equal(r.status(), 401);
  });
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

(async () => {
  const server = await startServer();
  console.log(`server: ${server.base} (screenshots: ${SHOTS})`);
  const browser = await chromium.launch();
  let exit = { code: null };
  try {
    const desktop = await desktopFlow(browser, server.base);
    await mobileFlow(browser, server.base, "light");
    await mobileFlow(browser, server.base, "dark");
    await darkTour(browser, server.base);
    await deleteEverything(desktop.page, server.base);
    await desktop.ctx.close();
  } finally {
    await browser.close();
    exit = await server.stop();
  }

  await check("the server shut down cleanly on SIGTERM", async () => {
    assert.equal(exit.code, 0, `exit ${JSON.stringify(exit)}`);
  });

  const unexpectedBrowser = browserLines.filter((l) => !EXPECTED_BROWSER.some((re) => re.test(l)));
  const unexpectedServer = server.lines.filter((l) => l.trim() && !EXPECTED_SERVER.some((re) => re.test(l)));
  console.log(`\nbrowser console/network lines: ${browserLines.length}, unexpected: ${unexpectedBrowser.length}`);
  unexpectedBrowser.forEach((l) => console.log("   ", l));
  console.log(`server log lines: ${server.lines.length}, unexpected: ${unexpectedServer.length}`);
  unexpectedServer.forEach((l) => console.log("   ", l));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length || unexpectedBrowser.length || unexpectedServer.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
