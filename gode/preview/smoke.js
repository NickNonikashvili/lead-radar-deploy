#!/usr/bin/env node
"use strict";
// Browser smoke test of the BUILT preview (preview/dist) served by preview/harness.js, which
// emulates the Artifact host: the page skeleton, its CSP, a 599 for any real /api request, the
// sandboxed viewer frame, blocked storage, the phone app's safe-area padding and theme choices.
//
//   node preview/smoke.js            (after node preview/build.js; npm run preview:test does both)
//
// Fails on any broken check, any console error or warning, any CSP violation, any page error and
// any "[harness] real /api request" line. PREVIEW_SHOTS=<dir> saves screenshots there.

const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("preview smoke: Playwright is not installed (see the root README: npm i -g playwright).");
  process.exit(2);
}

const { startHarness } = require("./harness");

const DIST = path.join(__dirname, "dist");
const SHOTS = process.env.PREVIEW_SHOTS ? path.resolve(process.env.PREVIEW_SHOTS) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const DEMO = { email: "demo@example.com", password: "preview-demo" };
// Scratch files (the catalog export): next to the screenshots, or the OS temp dir.
const SCRATCH = SHOTS || fs.mkdtempSync(path.join(require("os").tmpdir(), "gode-preview-smoke-"));

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

const problems = [];
// Chrome's note about the viewer frame's own sandbox flags (the host uses the same ones): it is
// printed by the harness page that holds the iframe, not by the preview.
const EXPECTED_CONSOLE = [/An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing/];
async function watch(page, label) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (EXPECTED_CONSOLE.some((re) => re.test(m.text()))) return;
    problems.push(`[${label}] console ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (!u.startsWith("data:")) problems.push(`[${label}] request failed: ${r.method()} ${u} ${r.failure() && r.failure().errorText}`);
  });
  // CSP violations, also inside frames (an init script runs in every frame, outside the CSP).
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
}

async function cspViolations(page) {
  const all = [];
  for (const frame of page.frames()) {
    try {
      all.push(...(await frame.evaluate(() => window.__csp || [])));
    } catch {
      // detached frame
    }
  }
  return all;
}

const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: "disabled" });
};

async function noHorizontalScroll(page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw, `page scrolls sideways: scrollWidth ${sw} > innerWidth ${iw}`);
}

async function lastAnswerSettled(target) {
  await target.waitForFunction(
    () => {
      const msgs = document.querySelectorAll(".msg-assistant");
      const last = msgs[msgs.length - 1];
      if (!last || last.classList.contains("is-live")) return false;
      return Boolean(last.querySelector(".chip-text") || last.querySelector(".notice") || last.querySelector(".msg-stopped"));
    },
    null,
    { timeout: 25_000 }
  );
}

async function recordLive(page) {
  await page.evaluate(() => {
    const rec = { lengths: [], chips: [], seen: {}, details: [] };
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
      const gen = last.querySelector(".generating span");
      if (gen && rec.details[rec.details.length - 1] !== gen.textContent) rec.details.push(gen.textContent);
      for (const sel of [".routing-state", ".chip-pulse", ".generating"]) if (last.querySelector(sel)) rec.seen[sel] = true;
    };
    if (window.__liveObserver) window.__liveObserver.disconnect();
    window.__liveObserver = new MutationObserver(sample);
    window.__liveObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  return async () =>
    page.evaluate(() => {
      window.__liveObserver.disconnect();
      return window.__live;
    });
}

/** A badge's visible label (without its screen-reader sentence). */
async function badgeLabel(target, selector) {
  return target.$eval(selector, (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains("sr-only") && n.tagName !== "svg"))
      .map((n) => n.textContent)
      .join("")
      .trim()
  );
}

/** Poll an API read until check(body) holds (writes reach the backend after a network-like delay). */
async function apiUntil(page, urlPath, check, timeout = 5000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    last = await apiGet(page, urlPath);
    if (check(last.body)) return last;
    await page.waitForTimeout(100);
  }
  return last;
}

async function send(target, text) {
  await target.fill("#composer-input", text);
  await target.press("#composer-input", "Enter");
}

/** GET through the page's own fetch (the simulated backend), as the app would. */
async function apiGet(page, urlPath) {
  return page.evaluate(async (p) => {
    const r = await fetch(p, { headers: { Accept: "application/json" } });
    return { status: r.status, body: await r.json() };
  }, urlPath);
}

function conversationIdOf(page) {
  const m = /#\/c\/([0-9a-f-]{36})/.exec(page.url());
  assert.ok(m, `not on a conversation: ${page.url()}`);
  return m[1];
}

async function newChat(page) {
  await page.click(".sidebar-new button");
  await page.waitForSelector(".empty-state");
}

/** Go to an app route by its hash, as a link would (the phone drawer hides the nav links). */
async function go(target, hash) {
  await target.evaluate((h) => {
    window.location.hash = h;
  }, hash);
}

/** The admin page on one tab (the app remembers the last tab, so click it). */
async function adminTab(target, name) {
  if (!/#\/admin/.test(target.url())) {
    await go(target, "#/admin");
    await target.waitForSelector(".tabs .tab");
  }
  await target.click(`.tabs .tab:has-text("${name}")`);
  await target.waitForSelector(`.tabs .tab.is-active:has-text("${name}")`);
}

async function statValue(target, label) {
  await target.waitForSelector(".stat-grid:not(.is-loading) .stat-card .stat-value");
  return target.$eval(`.stat-card:has(.stat-label:text-is("${label}")) .stat-value`, (el) => el.textContent);
}

/** Wait for a toast with this text, then for it to go (so the next one is not confused with it). */
async function toast(target, text) {
  await target.waitForSelector(`.toast:has-text("${text}")`);
  await target.waitForSelector(`.toast:has-text("${text}")`, { state: "detached", timeout: 10_000 });
}

// ---------------------------------------------------------------------------------------------
// Desktop
// ---------------------------------------------------------------------------------------------

async function desktopFlow(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await watch(page, "desktop");
  const state = {};

  await check("lands signed in on the demo account, with the seeded chats, under the host's CSP", async () => {
    await page.goto(base);
    await page.waitForSelector(".composer", { timeout: 15_000 });
    await page.waitForSelector(".conv-item .conv-title");
    const titles = await page.$$eval(".conv-item .conv-title", (els) => els.map((e) => e.textContent));
    assert.ok(titles.length >= 5, `conversations: ${titles.join(" | ")}`);
    assert.equal(titles[0], "Welcome to the Gode preview");
    // The first visit opens the welcome note.
    await page.waitForSelector('.msg-assistant .md:has-text("No AI model is called")');
    assert.match(page.url(), /#\/c\/[0-9a-f-]{36}$/);
    assert.equal(await page.textContent(".conv-item.is-active .conv-title"), "Welcome to the Gode preview");
    assert.equal(await page.textContent(".sidebar-user"), DEMO.email);
    assert.match(await page.textContent(".balance-value"), /^\$5\.\d+$/);
    assert.ok(await page.isVisible('.nav-link:has-text("Admin")'), "the demo account is an admin");
    assert.match(await page.textContent(".mock-note"), /Demo mode/);
    await shot(page, "d-home");
  });

  await check("the seeded private chat shows the Private and hidden-details badges", async () => {
    await page.click('.conv-item:has-text("Sam Carter") .conv-link');
    await page.waitForSelector(".msg-assistant .chip-text");
    assert.equal(await badgeLabel(page, ".msg-assistant .badge-private"), "Private");
    assert.equal(await badgeLabel(page, ".msg-assistant .badge-hidden"), "2 personal details hidden from the model");
    assert.match(await page.textContent(".msg-user .bubble"), /Sam Carter/, "the user's own words, as typed");
    assert.ok((await page.textContent(".msg-assistant .md")).includes("‹name 1›"), "the answer shows what the model got");
    await shot(page, "d-private-seeded");
  });

  await check("the seeded code answer renders its code block", async () => {
    await page.click('.conv-item:has-text("Python") .conv-link');
    await page.waitForSelector(".msg-assistant .code-block");
    assert.equal(await page.textContent(".msg-assistant .code-lang"), "python");
    const code = await page.textContent(".msg-assistant .code-block pre");
    assert.match(code, /def main/);
    // Correct as shown: never renames a file twice, never stacks "_1_2" suffixes.
    assert.match(code, /while target\.exists\(\) and target != path:/);
    assert.match(code, /f"\{stem\}_\{n\}\{suffix\}"/);
  });

  await check("a new chat streams: routing state, live chip with an estimate, growing text, then the final chip and cost", async () => {
    await newChat(page);
    const before = await page.textContent(".balance-value");
    const stop = await recordLive(page);
    await send(page, "Explain the difference between TCP and UDP in a few sentences.");
    await page.waitForSelector(".msg-assistant.is-live", { timeout: 10_000 });
    await lastAnswerSettled(page);
    const live = await stop();
    assert.ok(live.seen[".routing-state"], `routing state shown: ${JSON.stringify(live.seen)}`);
    assert.ok(live.lengths.length >= 5, `text grew in pieces: ${live.lengths.length}`);
    assert.ok(live.chips.some((c) => /est\. (\$|<\$)/.test(c)), `live chip with an estimate: ${JSON.stringify(live.chips)}`);
    const chip = await page.textContent(".msg-assistant .chip-text");
    assert.match(chip, / · (\$[\d.]+|<\$0\.0001)$/);
    assert.doesNotMatch(chip, /est\./);
    const answer = await page.textContent(".msg-assistant .md");
    assert.match(answer, /no AI model was called/);
    assert.ok(answer.includes(chip.split(" · ")[0]), "the answer names the chip's model");
    state.conversationId = conversationIdOf(page);
    await page.waitForFunction((b) => document.querySelector(".balance-value").textContent !== b, before, { timeout: 5_000 }).catch(() => {});
    await shot(page, "d-chat-done");
  });

  await check("a screen reader hears the finished answer as plain words, not markdown", async () => {
    await page.waitForFunction(() => /^Answer ready\./.test(document.querySelector('.chat .sr-only[role="status"]').textContent));
    const said = await page.textContent('.chat .sr-only[role="status"]');
    assert.match(said, /^Answer ready\. .+ · .+\. This is the Gode preview: no AI model was called\. In the live app, /);
    assert.doesNotMatch(said, /\*\*|^#|`/);
  });

  await check("thumbs up is stored on the request; pressing again clears it", async () => {
    const up = page.locator('.msg-assistant .action-btn[aria-label="Good answer"]').last();
    await up.click();
    await page.waitForFunction(() => document.querySelector('.action-btn[aria-label="Good answer"]').getAttribute("aria-pressed") === "true");
    let conv = await apiUntil(page, `/api/conversations/${state.conversationId}`, (b) => b.messages[1].request.feedback === 1);
    assert.equal(conv.body.messages[1].request.feedback, 1);
    await up.click();
    await page.waitForFunction(() => document.querySelector('.action-btn[aria-label="Good answer"]').getAttribute("aria-pressed") === "false");
    conv = await apiUntil(page, `/api/conversations/${state.conversationId}`, (b) => b.messages[1].request.feedback === null);
    assert.equal(conv.body.messages[1].request.feedback, null);
  });

  await check("the switch menu lists candidates; switching to Claude Sonnet 5.5 replaces the answer", async () => {
    await page.click(".msg-assistant .chip-button");
    await page.waitForSelector(".menu .menu-item");
    const items = await page.$$eval(".menu .menu-item-label", (els) => els.map((e) => e.textContent));
    assert.ok(items.length >= 5, `candidates: ${items.join(", ")}`);
    assert.ok(items.includes("Claude Sonnet 5.5"));
    assert.ok(await page.$(".menu .menu-item.is-current"));
    await shot(page, "d-switch-menu");
    await page.click('.menu .menu-item:has-text("Claude Sonnet 5.5")');
    await page.waitForSelector(".msg-assistant.is-live");
    await lastAnswerSettled(page);
    assert.match(await page.textContent(".msg-assistant .chip-text"), /^Claude Sonnet 5\.5 · /);
    assert.equal(await page.$$eval(".msg-assistant", (e) => e.length), 1, "replaced, not appended");
    assert.match(await page.textContent(".msg-assistant .md"), /picked it from the switch menu/);
  });

  await check("regenerate keeps the pinned model", async () => {
    await page.locator('.msg-assistant .action-btn[aria-label="Regenerate with the same model"]').last().click();
    await page.waitForSelector(".msg-assistant.is-live");
    await lastAnswerSettled(page);
    assert.match(await page.textContent(".msg-assistant .chip-text"), /^Claude Sonnet 5\.5 · /);
    const conv = await apiGet(page, `/api/conversations/${state.conversationId}`);
    assert.equal(conv.body.conversation.pins.chat.source, "user");
    assert.equal(conv.body.messages.length, 2);
  });

  await check("Stop keeps the partial answer, marked Stopped, with what it cost", async () => {
    await page.evaluate(() => {
      const obs = new MutationObserver(() => {
        const last = [...document.querySelectorAll(".msg-assistant")].pop();
        const md = last && last.querySelector(".md");
        const btn = document.querySelector(".send-btn.is-stop");
        if (md && md.textContent.length > 40 && btn) {
          obs.disconnect();
          btn.click();
        }
      });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await send(page, "Tell me a long story about a lighthouse keeper and the sea");
    await page.waitForSelector(".msg-assistant:last-child .tag-stopped", { timeout: 15_000 });
    await page.waitForFunction(
      () => {
        const c = [...document.querySelectorAll(".msg-assistant")].pop().querySelector(".chip-text");
        return c && / · (\$[\d.]+|<\$0\.0001)$/.test(c.textContent) && !/est\./.test(c.textContent);
      },
      null,
      { timeout: 10_000 }
    );
    const conv = await apiGet(page, `/api/conversations/${state.conversationId}`);
    const last = conv.body.messages[conv.body.messages.length - 1];
    assert.equal(last.stopped, true);
    assert.equal(last.request.status, "stopped");
    assert.ok(last.text.length > 0);
    await shot(page, "d-stopped");
  });

  await check("an image prompt shows queue and generation progress, then the image", async () => {
    await newChat(page);
    const stop = await recordLive(page);
    await send(page, "Draw a picture of a red fox in the snow");
    await page.waitForSelector(".msg-assistant:last-child .media img", { timeout: 20_000 });
    await lastAnswerSettled(page);
    const live = await stop();
    assert.ok(live.seen[".generating"], "a generating state was shown");
    assert.ok(live.details.some((d) => /ahead of you in line|next in line/.test(d)), `queue position shown: ${JSON.stringify(live.details)}`);
    assert.ok(live.details.includes("Generating now…"), `generation shown: ${JSON.stringify(live.details)}`);
    const decoded = await page.$eval(".msg-assistant:last-child .media img", (img) => img.complete && img.naturalWidth > 0);
    assert.ok(decoded, "image decoded");
    assert.match(await page.textContent(".msg-assistant:last-child .chip-text"), /^Qwen Image 3 · \$0\.05\d*$/);
    assert.match(await page.textContent(".msg-assistant:last-child .md"), /no image model was called\. In the live app Qwen Image 3 would make it: the balanced pick for image on your Balanced plan\./);
    await shot(page, "d-image");
    // Switched by hand: the caption gives that reason, not the plan's column.
    await page.click(".msg-assistant:last-child .chip-button");
    await page.waitForSelector(".menu .menu-item");
    await page.click('.menu .menu-item:has-text("GPT Image 1 mini")');
    await page.waitForSelector(".msg-assistant:last-child .media img", { timeout: 20_000 });
    await lastAnswerSettled(page);
    assert.match(await page.textContent(".msg-assistant:last-child .md"), /GPT Image 1 mini would make it: you picked it from the switch menu, so it is pinned for this chat\./);
  });

  await check("a private prompt with a name routes privately: Private badge and hidden details", async () => {
    await newChat(page);
    await send(page, "My name is Alex Rivera and I was diagnosed with HIV last week. Who should I tell first?");
    await lastAnswerSettled(page);
    assert.equal(await badgeLabel(page, ".msg-assistant .badge-private"), "Private");
    assert.equal(await badgeLabel(page, ".msg-assistant .badge-hidden"), "1 personal detail hidden from the model");
    const answer = await page.textContent(".msg-assistant .md");
    assert.ok(answer.includes("‹name 1›") && !answer.includes("Alex Rivera"), "the model's view has a placeholder");
    assert.match(answer, /zero-retention/);
    const conv = await apiGet(page, `/api/conversations/${conversationIdOf(page)}`);
    assert.equal(conv.body.conversation.private, true);
    assert.equal(conv.body.messages[1].request.tier, "private");
    await shot(page, "d-private-new");
  });

  await check("an upstream failure mid-answer shows an inline notice with Try again", async () => {
    await newChat(page);
    await send(page, "GODE_MOCK_FAIL_MIDSTREAM please explain compound interest");
    await page.waitForSelector(".msg-assistant:last-child .notice-error", { timeout: 15_000 });
    assert.ok(await page.$('.msg-assistant:last-child .notice-error button:has-text("Try again")'));
    // The kept partial text is a clean first sentence; the detail line is not test jargon.
    assert.equal((await page.textContent(".msg-assistant:last-child .md")).trim(), "This is the Gode preview: no AI model was called.");
    assert.equal(await page.textContent(".msg-assistant:last-child .notice-detail"), "The provider stopped responding mid-answer (simulated in this preview).");
    // The chip agrees with "you weren't charged": no estimate left on it.
    assert.equal(await page.textContent(".msg-assistant:last-child .chip-text"), "DeepSeek V4.1 Flash · not charged");
  });

  await check("double-clicking Send sends once and the answer streams (the second click is not a Stop)", async () => {
    for (const how of ["two clicks", "dblclick"]) {
      await newChat(page);
      await page.fill("#composer-input", `What is the boiling point of water at altitude? (${how})`);
      if (how === "dblclick") await page.dblclick(".send-btn");
      else {
        await page.click(".send-btn");
        await page.waitForTimeout(150);
        await page.click(".send-btn");
      }
      await lastAnswerSettled(page);
      assert.equal(await page.$(".msg-assistant .msg-stopped"), null, `${how}: not stopped`);
      assert.ok(await page.$(".msg-assistant .chip-text"), `${how}: answered`);
      assert.match(page.url(), /#\/c\//, `${how}: the conversation was created`);
      assert.equal(await page.$$eval(".msg-user", (e) => e.length), 1);
    }
  });

  await check("Stop before the answer starts: nothing is stored, the question goes back to the composer, the next send starts the chat cleanly", async () => {
    await newChat(page);
    const count = async () => (await apiGet(page, "/api/conversations")).body.conversations.length;
    const before = await count();
    await send(page, "Explain how vaccines train the immune system");
    await page.waitForSelector(".send-btn.is-stop");
    await page.evaluate(() => document.querySelector(".send-btn.is-stop").click());
    await page.waitForSelector(".msg-assistant .msg-stopped");
    assert.match(await page.textContent(".msg-assistant .msg-stopped"), /Stopped before the answer started, so nothing was saved/);
    assert.equal(await page.inputValue("#composer-input"), "Explain how vaccines train the immune system");
    assert.doesNotMatch(page.url(), /#\/c\//);
    assert.equal(await count(), before, "no conversation was made");
    await page.fill("#composer-input", "And what about mRNA vaccines?");
    await page.press("#composer-input", "Enter");
    await page.waitForFunction(() => /#\/c\//.test(location.hash));
    await lastAnswerSettled(page);
    const onScreen = await page.$$eval(".msg-user .bubble", (els) => els.map((e) => e.textContent));
    assert.deepEqual(onScreen, ["And what about mRNA vaccines?"], "the stopped question is gone from the screen too");
    const conv = await apiGet(page, `/api/conversations/${conversationIdOf(page)}`);
    assert.deepEqual(conv.body.messages.map((m) => m.role), ["user", "assistant"]);
    assert.equal(conv.body.messages[0].text, "And what about mRNA vaccines?");
  });

  await check("a reload keeps everything (stored in this browser) and stays signed in", async () => {
    await page.goto(`${base}#/c/${state.conversationId}`);
    await page.reload();
    await page.waitForSelector(".msg-assistant .chip-text");
    assert.match(await page.textContent(".msg-assistant .chip-text"), /^Claude Sonnet 5\.5 · /);
    assert.equal(await page.evaluate(() => window.__godePreview.persistent()), true);
  });

  await check("settings: the plan is saved, the transparency log lists requests, a wrong current password is refused", async () => {
    await page.click('.nav-link:has-text("Settings")');
    await page.waitForSelector(".plan-card");
    await page.click('.plan-card:has-text("Best")');
    await page.waitForSelector('.plan-card.is-selected:has-text("Best")');
    assert.equal((await apiUntil(page, "/api/me", (b) => b.user.plan === "best")).body.user.plan, "best");
    await page.waitForSelector(".table-log tbody tr td.num");
    const rows = await page.$$eval(".table-log tbody tr", (els) => els.length);
    assert.ok(rows >= 8, `log rows: ${rows}`);
    assert.ok((await page.textContent(".table-log")).includes("Gode's own rules"), "the private requests name Gode's own rules");
    // Every column fits the desktop card (the table scrolls sideways only on narrow screens).
    const log = await page.$eval(".table-log", (t) => ({ sw: t.parentElement.scrollWidth, cw: t.parentElement.clientWidth }));
    assert.ok(log.sw <= log.cw, `the transparency log fits: ${JSON.stringify(log)}`);
    await page.fill("#password-current", "not my password");
    await page.fill("#password-next", "another passphrase");
    await page.fill("#password-again", "another passphrase");
    await page.click('button:has-text("Change password")');
    await page.waitForSelector("#password-error");
    assert.match(await page.textContent("#password-error"), /current password is not right/);
    await page.click('.plan-card:has-text("Balanced")');
    await page.waitForSelector('.plan-card.is-selected:has-text("Balanced")');
    await shot(page, "d-settings");
  });

  await check("the privacy page lists the live providers without a self-hosted model", async () => {
    await page.click('.nav-link:has-text("Privacy")');
    await page.waitForSelector(".table-providers tbody tr td strong");
    const text = await page.textContent(".privacy");
    assert.match(text, /Sensitive requests only go to zero-retention models/);
    assert.ok(!/Our servers/.test(await page.textContent(".table-providers")), "no self-hosted model listed");
    // The private route's model does not read as sent to China: zero-retention requests go to its listed hosts.
    const runsIn = await page.textContent('.table-providers tr:has(td strong:text-is("DeepSeek V4.1 Flash")) td[data-label="Runs in"]');
    assert.equal(runsIn, "China, for ordinary requestsZero-retention requests: only the hosts named under “What they keep”.");
  });

  await check("log out, refused and accepted sign-ups, then back into the demo account", async () => {
    await page.click('.nav-link:has-text("Log out")');
    await page.waitForSelector(".auth-card");
    await page.click('.auth-tab:has-text("Sign up")');
    await page.fill("#auth-email", "viewer@example.com");
    await page.fill("#auth-password", "password123");
    await page.click("button[type=submit]");
    await page.waitForSelector(".form-error");
    assert.match(await page.textContent(".form-error"), /too common/);
    await page.fill("#auth-password", "my own passphrase");
    await page.click("button[type=submit]");
    await page.waitForSelector(".empty-state");
    assert.equal(await page.textContent(".balance-value"), "$0.25");
    assert.equal(await page.$(".conv-item"), null, "a new account starts with no chats");
    assert.ok(!(await page.isVisible('.nav-link:has-text("Admin")')), "not an admin");
    await page.click('.nav-link:has-text("Log out")');
    await page.waitForSelector(".auth-card");
    if (await page.isVisible('.auth-tab:has-text("Log in")')) await page.click('.auth-tab:has-text("Log in")');
    await page.fill("#auth-email", DEMO.email);
    await page.fill("#auth-password", "not the password");
    await page.click("button[type=submit]");
    await page.waitForSelector(".form-error");
    assert.match(await page.textContent(".form-error"), /Wrong email or password/);
    await page.fill("#auth-password", DEMO.password);
    await page.click("button[type=submit]");
    await page.waitForSelector(".conv-item");
    assert.equal(await page.textContent(".sidebar-user"), DEMO.email);
  });

  await check("settings: a password change goes through (and back), signed in all along", async () => {
    await page.click('.nav-link:has-text("Settings")');
    await page.waitForSelector("#password-current");
    await page.fill("#password-current", DEMO.password);
    await page.fill("#password-next", "password");
    await page.fill("#password-again", "password");
    await page.click('button:has-text("Change password")');
    await page.waitForFunction(() => /too common/.test((document.querySelector("#password-error") || {}).textContent || ""));
    for (const [from, to] of [
      [DEMO.password, "a brand new demo passphrase"],
      ["a brand new demo passphrase", DEMO.password],
    ]) {
      await page.fill("#password-current", from);
      await page.fill("#password-next", to);
      await page.fill("#password-again", to);
      await page.click('button:has-text("Change password")');
      await toast(page, "Password changed");
    }
    assert.equal(await page.inputValue("#password-current"), "", "the form is cleared");
    assert.equal((await apiGet(page, "/api/me")).status, 200, "still signed in");
  });

  await check("billing: the packs answer that payments are off in the preview (no navigation); test credit is bounded and lands in the ledger", async () => {
    await page.click('.balance-card a:has-text("Buy credits")');
    await page.waitForSelector(".balance-hero-value");
    await page.waitForSelector('td:has-text("Credit purchase")');
    assert.match(await page.textContent("#packs-title + .card-sub"), /API cost \+ margin \(30%\)/);
    assert.ok(await page.$('td:has-text("Welcome credit")'));
    assert.ok(await page.$('td:has-text("Usage")'), "charges are listed");
    const url = page.url();
    await page.click('.pack:has-text("$10")');
    await page.waitForSelector(".card .field-error");
    assert.match(await page.textContent(".card .field-error"), /Payments are off in this preview/);
    assert.match(await page.textContent(".card .field-error"), /Developer top-up/);
    assert.equal(page.url(), url, "the page did not navigate");
    assert.equal(await page.$$eval(".pack[disabled]", (e) => e.length), 0, "the packs can be tried again");
    await shot(page, "d-billing-checkout");
    await page.fill("#topup", "150");
    await page.click('button:has-text("Add test credit")');
    await page.waitForSelector("text=Enter an amount above $0 and up to $100.");
    const before = await page.textContent(".balance-hero-value");
    await page.fill("#topup", "2.5");
    await page.click('button:has-text("Add test credit")');
    await page.waitForSelector('.toast:has-text("Added $2.50 of test credit")');
    await page.waitForFunction((b) => document.querySelector(".balance-hero-value").textContent !== b, before);
    await page.waitForSelector('td:has-text("Developer top-up")');
    const ledger = (await apiGet(page, "/api/billing/ledger")).body;
    assert.equal(ledger.entries[0].kind, "dev_topup");
    assert.equal(ledger.entries[0].delta_usd, 2.5);
    assert.equal(await page.textContent(".balance-value"), await page.textContent(".balance-hero-value"), "sidebar and page agree");
    await shot(page, "d-billing");
  });

  await check("admin overview: gate metrics from the seeded team history, and they move when the viewer chats", async () => {
    await adminTab(page, "Overview");
    await page.waitForSelector(".stat-grid:not(.is-loading) .stat-card .stat-value");
    const cards = await page.$$eval(".stat-card", (els) => els.map((e) => [e.querySelector(".stat-label").textContent, e.querySelector(".stat-value").textContent]));
    assert.equal(cards.length, 7, JSON.stringify(cards));
    assert.ok(cards.every(([, v]) => v && v.trim() && v.trim() !== "—"), `every card has a value: ${JSON.stringify(cards)}`);
    assert.equal(await statValue(page, "Kept auto-pick"), "80%");
    assert.equal(await statValue(page, "Gross margin"), "23.1%");
    const requests = Number((await statValue(page, "Requests")).replace(/[^\d]/g, ""));
    assert.ok(requests > 150, `requests ${requests}`);
    await page.waitForSelector('.table-compact td:has-text("Claude Opus 5.5")');
    await page.waitForSelector('.table-compact td:has-text("Gemini 4 Carbon")');
    await shot(page, "d-admin-overview");
    await page.click('.seg:has-text("7 days")');
    await page.waitForFunction((n) => {
      const card = [...document.querySelectorAll(".stat-card")].find((c) => c.querySelector(".stat-label").textContent === "Requests");
      const grid = document.querySelector(".stat-grid");
      return card && grid && !grid.classList.contains("is-loading") && Number(card.querySelector(".stat-value").textContent.replace(/[^\d]/g, "")) < n;
    }, requests);
    await page.click('.seg:has-text("28 days")');
    // One more answer, then the overview counts it.
    await page.click(".sidebar-new button");
    await page.waitForSelector(".empty-state");
    await send(page, "What is a good name for a goldfish?");
    await lastAnswerSettled(page);
    await adminTab(page, "Overview");
    await page.waitForFunction((n) => {
      const card = [...document.querySelectorAll(".stat-card")].find((c) => c.querySelector(".stat-label").textContent === "Requests");
      return card && Number(card.querySelector(".stat-value").textContent.replace(/[^\d]/g, "")) === n + 1;
    }, requests);
  });

  await check("admin learner: two proposals from the team's feedback; Apply updates the grid", async () => {
    await adminTab(page, "Routing");
    await page.waitForSelector(".table-grid select");
    assert.match(await page.textContent(".classifier"), /DeepSeek V4\.1 Flash/);
    await page.click('button:has-text("Run learner")');
    await page.waitForSelector('button:has-text("Apply 2 changes")');
    const rows = await page.$$eval(".card:has(#learn-title) tbody tr", (els) => els.map((tr) => [...tr.querySelectorAll("td")].slice(0, 4).map((td) => td.textContent)));
    assert.deepEqual(rows, [
      ["Chat", "Quality", "Gemini 4 Carbon", "Claude Opus 5.5"],
      ["Code", "Budget", "Qwen3-Coder-Next", "DeepSeek V4.1 Flash"],
    ]);
    // "Why" is a sentence, not the audit string route_history keeps.
    const why = await page.$$eval(".card:has(#learn-title) tbody td.reason", (els) => els.map((td) => td.textContent));
    assert.match(why[0], /^People rated Claude Opus 5\.5 clearly better than Gemini 4 Carbon \(0\.\d\d vs 0\.\d\d, from \d+ and \d+ ratings\)\. It costs \$[\d.]+ vs \$[\d.]+ per answer\.$/);
    assert.match(why[1], /^DeepSeek V4\.1 Flash is rated at least as well as Qwen3-Coder-Next \(.*\) and costs less: \$[\d.]+ vs \$[\d.]+ per answer\.$/);
    for (const w of why) assert.doesNotMatch(w, /learn \w+\/\w+|within 0\.02 of the current/);
    await page.locator("#learn-title").scrollIntoViewIfNeeded();
    await shot(page, "d-admin-learn");
    await page.click('button:has-text("Apply 2 changes")');
    await page.waitForSelector('.notice-success:has-text("Routing table updated")');
    await page.waitForFunction(() => {
      const sel = document.querySelector('select[aria-label="Chat Quality model"]');
      return sel && sel.value === "openrouter:anthropic/claude-opus-5.5";
    });
    assert.equal(await page.inputValue('select[aria-label="Code Budget model"]'), "openrouter:deepseek/deepseek-v4.1-flash");
    const routing = (await apiGet(page, "/api/admin/routing")).body;
    assert.deepEqual(routing.routes.filter((r) => r.source === "learn").map((r) => `${r.job}/${r.tier}`).sort(), ["chat/quality", "code/budget"]);
    await page.click('.tabs .tab:has-text("Overview")');
    await page.waitForSelector("p.muted.small:has-text('Last learner run')");
    assert.match(await page.textContent("p.muted.small:has-text('Last learner run')"), /2 proposals, 2 applied/);
  });

  await check("admin routing: an edit is saved; an unsafe private pick is refused in its cell", async () => {
    await adminTab(page, "Routing");
    await page.waitForSelector(".table-grid select");
    await page.selectOption('select[aria-label="Chat Budget model"]', "openrouter:anthropic/claude-haiku-5.5");
    await page.waitForSelector('.route-status:has-text("Saved")');
    await page.selectOption('select[aria-label="Chat Budget effort override"]', "low");
    const cell = await apiUntil(page, "/api/admin/routing", (b) => b.routes.some((r) => r.job === "chat" && r.tier === "budget" && r.effort_override === "low"));
    const chatBudget = cell.body.routes.find((r) => r.job === "chat" && r.tier === "budget");
    assert.deepEqual([chatBudget.model_id, chatBudget.effort_override, chatBudget.source], ["openrouter:anthropic/claude-haiku-5.5", "low", "admin"]);
    await page.selectOption('select[aria-label="Chat Private model"]', "openrouter:google/gemini-4-carbon");
    await page.waitForSelector('.route-cell.is-error .route-status:has-text("must be zero-retention or self-hosted")');
    const priv = (await apiGet(page, "/api/admin/routing")).body.routes.find((r) => r.job === "chat" && r.tier === "private");
    assert.equal(priv.model_id, "selfhosted:qwen3.8-27b", "the private cell is unchanged");
    assert.equal(await page.$('select[aria-label="Action Quality model"]'), null, "no editable Action cells");
    assert.equal(await page.$('select[aria-label="Image Quality effort override"]'), null, "no effort select for media jobs");
    await shot(page, "d-admin-routing");
    // Put the chat budget cell back.
    await page.selectOption('select[aria-label="Chat Budget effort override"]', "");
    await page.waitForSelector('.route-status:has-text("Saved")');
    await page.selectOption('select[aria-label="Chat Budget model"]', "openrouter:deepseek/deepseek-v4.1-flash");
    await apiUntil(page, "/api/admin/routing", (b) => b.routes.some((r) => r.job === "chat" && r.tier === "budget" && r.model_id === "openrouter:deepseek/deepseek-v4.1-flash" && r.effort_override === null));
  });

  await check("admin catalog: a cleared price is flagged, a price edit is saved", async () => {
    await adminTab(page, "Catalog");
    await page.fill('input[aria-label="Search models"]', "flux.1");
    const row = page.locator('tr:has-text("FLUX.1 schnell")');
    const input = row.locator("input[type=number]");
    const original = await input.inputValue();
    assert.ok(Number(original) > 0, "seeded with a price");
    await input.fill("");
    await row.locator('button:has-text("Save")').click();
    await row.locator(".row-status.ok").waitFor();
    await row.locator('.tag-warn:has-text("No price")').waitFor();
    await input.fill(original);
    await row.locator('button:has-text("Save")').click();
    await row.locator(".row-status.ok").waitFor();
    assert.equal(await row.locator(".tag-warn").count(), 0, "flag gone once priced");
    const models = (await apiGet(page, "/api/admin/routing")).body.models;
    assert.equal(models.find((m) => m.label === "FLUX.1 schnell").price_per_unit, Number(original));
    await page.fill('input[aria-label="Search models"]', "");
    await shot(page, "d-admin-catalog");
  });

  await check("admin catalog: Export JSON downloads the catalog, which imports back", async () => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export JSON")')]);
    const file = path.join(SCRATCH, "catalog-export.json");
    await dl.saveAs(file);
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.ok(data.models.length >= 30 && data.routes.length >= 28);
    assert.ok(data.routes.some((r) => r.job === "chat" && r.tier === "quality" && r.model_id === "openrouter:anthropic/claude-opus-5.5"), "the learner's change is in it");
    await page.setInputFiles("input[type=file]", file);
    await page.waitForSelector('.notice-warn:has-text("Import catalog-export.json?")');
    await page.click('.notice-warn button:has-text("Import")');
    await toast(page, "Catalog imported");
    fs.rmSync(file, { force: true });
  });

  await check("admin users: the team is listed; search finds one; credit is added and taken back", async () => {
    await adminTab(page, "Users");
    await page.waitForSelector(".table-users tbody tr td .model-name");
    const emails = await page.$$eval(".table-users tbody tr .model-name", (els) => els.map((e) => e.textContent));
    // Newest first: the account made in the sign-up check above, the demo, then the team.
    assert.deepEqual(emails, ["viewer@example.com", DEMO.email, "mei@example.com", "jordan@example.com", "priya@example.com", "alex@example.com"]);
    await page.fill('input[aria-label="Search users by email"]', "PRIYA");
    await page.click('.filters button:has-text("Search")');
    await page.waitForFunction(() => document.querySelectorAll(".table-users tbody tr").length === 1);
    const row = page.locator('.table-users tr:has-text("priya@example.com")');
    const balance = async () => (await apiGet(page, "/api/admin/users?email=priya")).body.users[0].balance_usd;
    const before = await balance();
    await row.locator("input[type=number]").fill("1.5");
    await row.locator('input[type="text"]').fill("goodwill");
    await row.locator('button:has-text("Apply")').click();
    await toast(page, "Added $1.50");
    assert.ok(Math.abs((await balance()) - (before + 1.5)) < 1e-6, "credit added");
    await row.locator("input[type=number]").fill("-1.5");
    await row.locator('button:has-text("Apply")').click();
    await toast(page, "Took back $1.50");
    assert.ok(Math.abs((await balance()) - before) < 1e-6, "and taken back");
    await row.locator("input[type=number]").fill("0");
    await row.locator('button:has-text("Apply")').click();
    await page.waitForSelector('.row-status.bad:has-text("Enter an amount")');
    await shot(page, "d-admin-users");
    // Your own row: the sidebar's balance changes with it.
    await page.fill('input[aria-label="Search users by email"]', DEMO.email);
    await page.click('.filters button:has-text("Search")');
    await page.waitForFunction(() => document.querySelectorAll(".table-users tbody tr").length === 1);
    const mine = page.locator(`.table-users tr:has-text("${DEMO.email}")`);
    const sidebar = await page.textContent(".balance-value");
    await mine.locator("input[type=number]").fill("1.5");
    await mine.locator('button:has-text("Apply")').click();
    await toast(page, "Added $1.50");
    assert.equal(await page.textContent(".balance-value"), (await mine.locator("td.num").textContent()).trim(), "sidebar and row agree");
    assert.notEqual(await page.textContent(".balance-value"), sidebar);
    await mine.locator("input[type=number]").fill("-1.5");
    await mine.locator('button:has-text("Apply")').click();
    await toast(page, "Took back $1.50");
    assert.equal(await page.textContent(".balance-value"), sidebar);
  });

  await check("sidebar: delete a conversation with the inline confirm", async () => {
    await page.goto(`${base}#/`);
    await page.waitForSelector(".conv-item");
    const before = await page.$$eval(".conv-item", (e) => e.length);
    await page.hover(".conv-item >> nth=0");
    await page.click(".conv-item >> nth=0 >> .conv-delete");
    await page.waitForSelector(".conv-item.is-confirming");
    await page.click(".conv-item.is-confirming .btn-danger");
    await page.waitForFunction((b) => document.querySelectorAll(".conv-item").length === b - 1, before);
    const list = (await apiGet(page, "/api/conversations")).body;
    assert.equal(list.conversations.length, before - 1);
  });

  await check("no CSP violations on the desktop flow so far", async () => {
    assert.deepEqual(await cspViolations(page), []);
  });

  await check("delete everything: a wrong password is refused inline; the right one signs out, for good (also after a reload)", async () => {
    await page.click('.nav-link:has-text("Settings")');
    await page.click('button:has-text("Delete my account and data")');
    await page.fill("#delete-password", "nope-nope-nope");
    await page.click('button:has-text("Delete everything")');
    await page.waitForSelector("#delete-error");
    assert.match(await page.textContent("#delete-error"), /Wrong password/);
    assert.ok(await page.isVisible(".plan-card"), "still signed in");
    await page.fill("#delete-password", DEMO.password);
    await page.click('button:has-text("Delete everything")');
    await page.waitForSelector(".auth-card");
    assert.equal(await page.textContent(".auth-card h2"), "Create your account");
    await page.waitForTimeout(400); // the debounced save
    await page.reload();
    await page.waitForSelector(".auth-card");
    const login = await page.evaluate(async (d) => {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: d.email, password: "not-the-password" }) });
      return r.status;
    }, DEMO);
    assert.equal(login, 401, "the demo account is gone");
    assert.equal((await apiGet(page, "/api/me")).status, 401);
  });

  await check("after Delete everything the auth screen says how to get the demo back, and its credentials restore it", async () => {
    const hint = await page.evaluate(() => getComputedStyle(document.querySelector(".auth-card > h2 + p.muted"), "::after").content);
    assert.ok(hint.includes(DEMO.email) && hint.includes(DEMO.password) && /Delete everything/.test(hint), hint);
    // Typed into the sign-up form, as a viewer who only noted the details would.
    await page.fill("#auth-email", DEMO.email);
    await page.fill("#auth-password", DEMO.password);
    await page.click("button[type=submit]");
    await page.waitForSelector(".conv-item .conv-title");
    assert.equal(await page.textContent(".sidebar-user"), DEMO.email);
    assert.ok(await page.isVisible('.nav-link:has-text("Admin")'), "an admin again");
    assert.match(await page.textContent(".balance-value"), /^\$5\.\d+$/);
    const titles = await page.$$eval(".conv-item .conv-title", (els) => els.map((e) => e.textContent));
    assert.equal(titles[0], "Welcome to the Gode preview");
    assert.ok(titles.some((t) => /Sam Carter/.test(t)) && titles.some((t) => /Python script/.test(t)), titles.join(" | "));
    await shot(page, "d-demo-restored");
  });

  await check("no CSP violations on the desktop flow", async () => {
    assert.deepEqual(await cspViolations(page), []);
  });

  await context.close();
}

// ---------------------------------------------------------------------------------------------
// More chat behaviour, on a fresh demo account of its own (the desktop flow's counts stay as they are)
// ---------------------------------------------------------------------------------------------

/** Count the composer's sends: every POST /api/chat the app makes, with its text. */
/** Wait for keyboard focus on the last answer's Regenerate button; say where it is otherwise. */
async function focusOnRegenerate(page, step) {
  try {
    await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute("aria-label") === "Regenerate with the same model", null, { timeout: 8000 });
  } catch {
    const where = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? a.tagName + "." + a.className + " " + (a.getAttribute("aria-label") || "") : "none";
    });
    throw new Error(`${step}: focus is on ${where}, not on Regenerate`);
  }
}

async function countChatPosts(page) {
  await page.evaluate(() => {
    window.__posts = [];
    if (window.__postsWrapped) return;
    window.__postsWrapped = true;
    const f = window.fetch;
    window.fetch = function (url, init) {
      if (String(url) === "/api/chat" && init && init.method === "POST") window.__posts.push(JSON.parse(init.body).text);
      return f.apply(this, arguments);
    };
  });
  return () => page.evaluate(() => window.__posts.slice());
}

/** Press Stop with a real pointer press (not a scripted click), in the button's middle. */
async function mouseStop(page) {
  const box = await page.locator(".send-btn.is-stop").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

async function moreChat(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await watch(page, "more");

  await check("a message sent from the welcome note starts its own chat, titled after the question", async () => {
    await page.goto(base);
    await page.waitForSelector('.msg-assistant .md:has-text("No AI model is called")');
    await send(page, "What is a good name for a cat?");
    await page.waitForFunction(() => document.querySelector(".conv-item.is-active .conv-title") && document.querySelector(".conv-item.is-active .conv-title").textContent !== "Welcome to the Gode preview");
    await lastAnswerSettled(page);
    assert.match(await page.textContent(".conv-item.is-active .conv-title"), /^What is a good name for/);
    assert.deepEqual(await page.$$eval(".msg-user .bubble", (els) => els.map((e) => e.textContent)), ["What is a good name for a cat?"]);
    const answer = await page.textContent(".msg-assistant .md");
    assert.match(answer, /What DeepSeek V4\.1 Flash would receive:/);
    assert.doesNotMatch(answer, /earlier message/);
    await page.click('.conv-item:has-text("Welcome to the Gode preview") .conv-link');
    await page.waitForSelector('.msg-assistant .md:has-text("No AI model is called")');
    assert.equal(await page.$$eval(".messages .msg", (e) => e.length), 1, "the welcome note stays a note");
    assert.equal(await page.inputValue("#composer-input"), "");
  });

  await check("money on screen agrees: a seeded answer's cost line and its chip, and the billing history adds up to the balance", async () => {
    await page.click('.conv-item:has-text("Write a Python script") .conv-link');
    await page.waitForSelector(".msg-assistant .chip-text");
    const md = await page.textContent(".msg-assistant:last-child .md");
    const said = /that is (\$[\d.]+) in all, as on the chip/.exec(md);
    assert.ok(said, md.slice(-300));
    assert.ok((await page.textContent(".msg-assistant:last-child .chip-text")).endsWith(" · " + said[1]), "the chip shows the cost the answer states");
    await go(page, "#/billing");
    await page.waitForSelector(".table-ledger tbody tr td.num");
    const amounts = await page.$$eval(".table-ledger tbody tr td.num", (els) => els.map((td) => td.textContent.trim()));
    const ledger = (await apiGet(page, "/api/billing/ledger")).body;
    assert.equal(amounts.length, ledger.entries.length, "every row is listed");
    const micros = (t) => Math.round(Number(t.replace(/^[+]/, "").replace("−", "-").replace("$", "")) * 1e6);
    const sum = amounts.reduce((a, t) => a + micros(t), 0);
    assert.equal(sum, Math.round(ledger.balance_usd * 1e6), `rows ${amounts.join(" ")} add up to the balance`);
    assert.ok(amounts.some((t) => /^−\$0\.0\d{4,}$/.test(t)), `exact charges: ${amounts.join(" ")}`);
  });

  await check("a real Stop press (keyboard, or mouse past the double-click guard) never sends the composer's text again", async () => {
    const posts = await countChatPosts(page);
    // Keyboard, while the answer is still being routed: the question comes back, unsent.
    await newChat(page);
    await send(page, "Explain how vaccines train the immune system");
    await page.waitForSelector(".send-btn.is-stop");
    await page.focus(".send-btn.is-stop");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".msg-assistant .msg-stopped");
    await page.waitForTimeout(800);
    assert.deepEqual(await posts(), ["Explain how vaccines train the immune system"], "keyboard Stop during routing");
    assert.equal(await page.inputValue("#composer-input"), "Explain how vaccines train the immune system");
    assert.match(await page.textContent(".msg-assistant .msg-stopped"), /Stopped before the answer started, so nothing was saved/);
    // Mouse, 0.6 s after sending (past the guard), still routing.
    await countChatPosts(page);
    await page.press("#composer-input", "Enter");
    await page.waitForSelector(".send-btn.is-stop");
    await page.waitForTimeout(600);
    await mouseStop(page);
    await page.waitForSelector(".msg-assistant .msg-stopped");
    await page.waitForTimeout(800);
    assert.deepEqual(await posts(), ["Explain how vaccines train the immune system"], "mouse Stop during routing");
    // Mouse, mid-answer, with the next message half typed: the answer is kept, the draft stays.
    await countChatPosts(page);
    await page.fill("#composer-input", "Tell me a long story about a lighthouse keeper");
    await page.press("#composer-input", "Enter");
    await page.waitForFunction(() => {
      const md = [...document.querySelectorAll(".msg-assistant .md")].pop();
      return md && md.textContent.length > 60;
    });
    await page.fill("#composer-input", "Actually, make it about a ship cap");
    await mouseStop(page);
    await page.waitForSelector(".msg-assistant:last-child .tag-stopped");
    await page.waitForTimeout(800);
    assert.deepEqual(await posts(), ["Tell me a long story about a lighthouse keeper"], "mouse Stop mid-answer");
    assert.equal(await page.inputValue("#composer-input"), "Actually, make it about a ship cap");
    assert.match(await page.textContent(".msg-assistant:last-child .msg-stopped"), /kept as far as it got/);
    await page.fill("#composer-input", "");
  });

  await check("stopping a picture while it is being made says from the start that it is charged (no 'before the answer started', no Try again)", async () => {
    await newChat(page);
    await send(page, "Generate an image of a castle on a hill at dawn");
    await page.waitForSelector('.msg-assistant .generating:has-text("Generating now")', { timeout: 15_000 });
    await page.evaluate(() => {
      const seen = [];
      window.__stopNotes = seen;
      const sample = () => {
        const el = document.querySelector(".msg-assistant:last-child .msg-stopped");
        if (!el) return;
        const t = el.textContent + (el.querySelector("button") ? " [Try again]" : "");
        if (seen[seen.length - 1] !== t) seen.push(t);
      };
      new MutationObserver(sample).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await page.focus(".send-btn.is-stop");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => {
      const c = document.querySelector(".msg-assistant:last-child .chip-text");
      return c && document.querySelector(".msg-assistant:last-child .msg-stopped") && !/est\./.test(c.textContent);
    }, null, { timeout: 10_000 });
    const notes = await page.evaluate(() => window.__stopNotes);
    assert.ok(notes.length > 0, "a stopped note was shown");
    for (const n of notes) {
      assert.doesNotMatch(n, /before the answer started/, `never "not started": ${JSON.stringify(notes)}`);
      assert.doesNotMatch(n, /\[Try again\]/, `no Try again for a charged answer: ${JSON.stringify(notes)}`);
      assert.match(n, /after the provider had started making it/);
    }
    assert.match(await page.textContent(".msg-assistant:last-child .chip-text"), /^Qwen Image 3 · \$0\.05\d*$/);
  });

  await check("stopping a regenerate or a switch says the earlier answer is kept and what the stopped attempt cost", async () => {
    // A picture: regenerated, stopped while the provider makes it.
    await page.click('.conv-item:has-text("An image of a cozy reading") .conv-link');
    await page.waitForSelector(".msg-assistant .media img");
    const before = await page.textContent(".balance-value");
    const imgBefore = await page.getAttribute(".msg-assistant:last-child .media img", "src");
    await page.click('.msg-assistant:last-child .action-btn[aria-label="Regenerate with the same model"]');
    await page.waitForSelector('.msg-assistant .generating:has-text("Generating now")', { timeout: 15_000 });
    await page.focus(".send-btn.is-stop");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".msg-assistant:last-child .msg-stopped-attempt");
    assert.match(await page.textContent(".msg-assistant:last-child .msg-stopped-attempt"), /^StoppedYou stopped the new answer from Qwen Image 3, so the earlier answer is kept\. The stopped attempt (?:is charged|cost \$[\d.]+): providers bill a generation once it starts\.$/);
    assert.equal(await page.getAttribute(".msg-assistant:last-child .media img", "src"), imgBefore, "the earlier picture is back");
    // The figure comes from the routing log, and the balance moved by it.
    await page.waitForFunction(() => /cost \$[\d.]+:/.test(document.querySelector(".msg-assistant:last-child .msg-stopped-attempt").textContent), null, { timeout: 8000 });
    const note = await page.textContent(".msg-assistant:last-child .msg-stopped-attempt");
    const log = (await apiGet(page, "/api/transparency?limit=5")).body.requests;
    const row = log.find((r) => r.kind === "regenerate" && r.status === "stopped");
    assert.ok(row && row.cost_usd > 0, JSON.stringify(log.slice(0, 2)));
    assert.ok(note.includes("cost $" + String(row.cost_usd) + ":"), note + " vs " + row.cost_usd);
    await page.waitForFunction((b) => document.querySelector(".balance-value").textContent !== b, before);
    // A switch to another picture model, stopped the same way.
    await page.click(".msg-assistant:last-child .chip-button");
    await page.waitForSelector(".menu .menu-item:not(.is-current)");
    const target = (await page.textContent(".menu .menu-item:not(.is-current) .menu-item-label")).trim();
    await page.click(".menu .menu-item:not(.is-current)");
    await page.waitForSelector('.msg-assistant .generating:has-text("Generating now")', { timeout: 15_000 });
    await page.focus(".send-btn.is-stop");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".msg-assistant:last-child .msg-stopped-attempt");
    const escaped = target.replace(/[.()+]/g, (c) => "\\" + c);
    assert.match(await page.textContent(".msg-assistant:last-child .msg-stopped-attempt"), new RegExp("You stopped the new answer from " + escaped + ", so the earlier answer is kept\\."));
    assert.equal(await page.getAttribute(".msg-assistant:last-child .media img", "src"), imgBefore);
    // A new regenerate that finishes clears the note.
    await page.click('.msg-assistant:last-child .action-btn[aria-label="Regenerate with the same model"]');
    await lastAnswerSettled(page);
    await page.waitForSelector(".msg-assistant:last-child .msg-stopped-attempt", { state: "detached" });
  });

  await check("keyboard: after Regenerate or a switch-menu pick, focus stays on the answer, then moves to its Regenerate button", async () => {
    await page.click('.conv-item:has-text("Explain how compound interest") .conv-link');
    await page.waitForSelector(".msg-assistant:last-child .chip-text");
    // Opening a chat puts focus in the message box (an effect after the render); a keyboard user
    // then moves to the answer's buttons.
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "composer-input");
    await page.focus('.msg-assistant:last-child .action-btn[aria-label="Regenerate with the same model"]');
    await page.keyboard.press("Enter");
    await page.waitForSelector(".msg-assistant:last-child.is-live");
    const during = await page.evaluate(() => [document.activeElement.tagName, document.activeElement.classList.contains("msg-assistant")]);
    assert.deepEqual(during, ["ARTICLE", true], "the answer holds focus while it is rewritten, not <body>");
    await lastAnswerSettled(page);
    await focusOnRegenerate(page, "after Regenerate");
    assert.equal(await page.evaluate(() => document.activeElement.closest(".msg-assistant") === [...document.querySelectorAll(".msg-assistant")].pop()), true);
    // The switch menu, by keyboard.
    await page.focus(".msg-assistant:last-child .chip-button");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".menu .menu-item");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".msg-assistant:last-child.is-live");
    assert.notEqual(await page.evaluate(() => document.activeElement.tagName), "BODY", "not dropped to <body> by the menu closing");
    await lastAnswerSettled(page);
    await focusOnRegenerate(page, "after a switch-menu pick");
    // Someone who moves on meanwhile is not pulled back: focus in the composer stays there.
    await page.click('.msg-assistant:last-child .action-btn[aria-label="Regenerate with the same model"]');
    await page.waitForSelector(".msg-assistant:last-child.is-live");
    await page.focus("#composer-input");
    await lastAnswerSettled(page);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.activeElement.id), "composer-input");
  });

  await check("a private picture with nothing personal in it: the badge claims no removal, and the caption's quote ends with a full stop", async () => {
    await newChat(page);
    await send(page, "Draw a watercolor of me at the clinic after I was diagnosed with diabetes");
    await page.waitForSelector(".msg-assistant:last-child .media img", { timeout: 20_000 });
    await lastAnswerSettled(page);
    assert.equal(await badgeLabel(page, ".msg-assistant:last-child .badge-redacted"), "Private · no zero retention");
    const title = await page.getAttribute(".msg-assistant:last-child .badge-redacted", "title");
    assert.match(title, /nothing personal was found to replace/);
    assert.doesNotMatch(title, /replaced with generic words/);
    assert.match(await page.textContent(".msg-assistant:last-child .md"), /diabetes”\. Treated as private; nothing personal was found to take out\.$/);
  });

  await check("reloading mid-answer keeps the answer so far: stopped, charged and in the transparency log", async () => {
    await newChat(page);
    await send(page, "Write a long detailed analysis of the causes of the French Revolution");
    await page.waitForFunction(() => {
      const md = [...document.querySelectorAll(".msg-assistant .md")].pop();
      return /#\/c\//.test(location.hash) && md && md.textContent.length > 120;
    });
    const id = conversationIdOf(page);
    await page.reload();
    await page.waitForSelector(".msg-assistant .msg-stopped", { timeout: 10_000 });
    assert.match(await page.textContent(".msg-assistant .msg-stopped"), /kept as far as it got/);
    assert.equal(await page.$(".msg-unanswered"), null, "not 'No answer'");
    const conv = await apiGet(page, `/api/conversations/${id}`);
    const last = conv.body.messages[conv.body.messages.length - 1];
    assert.equal(last.request.status, "stopped");
    assert.ok(last.request.cost_usd > 0, "charged for what it wrote");
    const log = (await apiGet(page, "/api/transparency")).body.requests;
    assert.equal(log.find((r) => r.id === last.request.id).status, "stopped");
  });

  await check("billing and the sidebar say no model is called and no card is charged; a pack pressed by keyboard keeps focus", async () => {
    const after = (sel) => page.$eval(sel, (el) => getComputedStyle(el, "::after").content);
    assert.match(await after(".mock-note"), /Gode preview: no AI model is called; each answer explains what the live app would do\./);
    assert.equal(await page.$eval(".mock-note", (el) => getComputedStyle(el).fontSize), "0px", "the app's 'built-in test model' line is not shown");
    // Nor read out, nor copied: only the preview's line reaches the accessibility tree (Chromium's
    // own tree, as a screen reader gets it; Playwright's ariaSnapshot skips CSS-generated text).
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const said = nodes.filter((n) => !n.ignored && n.role && n.role.value === "StaticText").map((n) => (n.name && n.name.value) || "");
    assert.ok(said.some((t) => /^Gode preview: no AI model is called/.test(t)), "the preview's line is announced");
    assert.deepEqual(said.filter((t) => /Demo mode|built-in test model/.test(t)), [], "the app's test-model line is not");
    await cdp.detach();
    assert.doesNotMatch(await page.$eval(".mock-note", (el) => el.innerText), /Demo mode/);
    await go(page, "#/billing");
    await page.waitForSelector(".pack");
    assert.match(await after(".pack-grid + p.muted.small"), /Gode preview: card payments are off; use Developer top-up below for free test credit\./);
    await page.focus('.pack:has-text("$5")');
    await page.keyboard.press("Enter");
    await page.waitForSelector(".card .field-error");
    assert.deepEqual(
      await page.evaluate(() => [document.activeElement.classList.contains("pack"), document.activeElement.textContent, document.activeElement.getAttribute("aria-describedby")]),
      [true, "$5of credits", "buy-error"],
      "focus stays on the pack, which points at the message"
    );
    await page.keyboard.press("Tab");
    assert.match(await page.evaluate(() => document.activeElement.textContent), /^\$10/, "the next Tab goes on from there");
  });

  await check("the transparency log marks every simulated request, the pictures too", async () => {
    await go(page, "#/settings");
    await page.waitForSelector(".table-log tbody tr td.num");
    const providers = await page.$$eval(".table-log tbody tr", (rows) => rows.map((r) => r.textContent));
    const image = providers.find((t) => /Image/.test(t) && /Qwen Image 3/.test(t));
    assert.ok(image && image.includes("fal → preview (simulated)"), `image row: ${image}`);
    assert.ok(!providers.some((t) => /\bfal(?! →)/.test(t)), "no row says plain fal");
  });

  await check("admin: taking back more credit than a member has says what was taken", async () => {
    await adminTab(page, "Users");
    await page.waitForSelector(".table-users tbody tr td .model-name");
    const row = page.locator('.table-users tr:has-text("priya@example.com")');
    const before = (await row.locator("td.num").textContent()).trim();
    await row.locator("input[type=number]").fill("-100");
    await row.locator('button:has-text("Apply")').click();
    await page.waitForSelector('.toast:has-text("(all of it)")');
    // The exact amount taken (the list shows the balance in cents).
    const took = /^Took back \$(\d+\.\d+) \(all of it\)\. New balance \$0\.00\.$/.exec(await page.textContent('.toast:has-text("(all of it)")'));
    assert.ok(took, "the take-back toast");
    assert.equal("$" + Number(took[1]).toFixed(2), before);
    assert.equal((await row.locator("td.num").textContent()).trim(), "$0.00");
  });

  await check("a new account with $0.25 that tries 'Make a video' is told what it costs, not that it is out of credits", async () => {
    await page.click('.nav-link:has-text("Log out")');
    await page.waitForSelector(".auth-card");
    await page.click('.auth-tab:has-text("Sign up")');
    await page.fill("#auth-email", "broke@example.com");
    await page.fill("#auth-password", "quiet-harbor-41");
    await page.click("button[type=submit]");
    await page.waitForSelector(".empty-state");
    await page.click('.suggestion:has-text("Make a video")');
    await page.press("#composer-input", "Enter");
    await page.waitForSelector(".msg-assistant .notice", { timeout: 15_000 });
    assert.equal(await page.textContent(".msg-assistant .notice-title"), "Not enough credit for this");
    assert.match(await page.textContent(".msg-assistant .notice"), /This costs about \$0\.\d+ and your balance is \$0\.25\. Buy credits to continue\./);
    assert.ok(await page.$('.msg-assistant .notice a:has-text("Buy credits")'));
    assert.deepEqual(await cspViolations(page), []);
  });
  await context.close();
}

/**
 * The viewer's frame as a person meets it: nothing touched for a while (Playwright's own frame
 * calls count as user input, so none are made until the end), then the host focuses the frame and
 * a key is typed.
 */
async function frameFocus(browser, base) {
  await check("the viewer frame opens a chat with no focus-policy error; a key typed once the frame has focus goes to the message box", async () => {
    // A new chat, and a first visit's welcome note: each in a fresh browser profile.
    for (const src of ["/#/", "/"]) {
      const context = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await watch(page, "frame-focus");
      const policy = [];
      page.on("console", (m) => {
        if (/Permissions policy violation/.test(m.text())) policy.push(m.text());
      });
      try {
        await page.goto(`${base}frame.html?src=${encodeURIComponent(src)}`);
        await page.waitForTimeout(2500);
        assert.deepEqual(policy, [], `${src}: no focus-without-user-activation error`);
        await page.focus("#viewer");
        await page.keyboard.type("hello there");
        const inner = await (await page.$("#viewer")).contentFrame();
        assert.equal(await inner.inputValue("#composer-input"), "hello there", `${src}: the key went to the message box`);
      } finally {
        await context.close();
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Host conditions
// ---------------------------------------------------------------------------------------------

async function storageBlocked(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await watch(page, "nostorage");
  await check("storage blocked (?nostorage=1): seeded and signed in from memory; chat, settings, billing and admin all work", async () => {
    await page.goto(`${base}?nostorage=1`);
    await page.waitForSelector(".conv-item");
    assert.equal(await page.evaluate(() => { try { return typeof window.localStorage.getItem("x"); } catch (e) { return e.name; } }), "SecurityError");
    assert.equal(await page.evaluate(() => { try { return typeof window.sessionStorage.getItem("x"); } catch (e) { return e.name; } }), "SecurityError");
    assert.equal(await page.evaluate(() => window.__godePreview.persistent()), false);
    await page.waitForSelector('.msg-assistant .md:has-text("No AI model is called")');
    await go(page, "#/");
    await page.waitForSelector(".empty-state");
    await send(page, "Does this work without storage?");
    await lastAnswerSettled(page);
    assert.match(await page.textContent(".msg-assistant .chip-text"), / · /);
    const id = conversationIdOf(page);
    await page.click('.msg-assistant .action-btn[aria-label="Good answer"]');
    await apiUntil(page, `/api/conversations/${id}`, (b) => b.messages[1].request.feedback === 1);
    await page.click('.nav-link:has-text("Settings")');
    await page.click('.plan-card:has-text("Saver")');
    await page.waitForSelector('.plan-card.is-selected:has-text("Saver")');
    await page.click('.balance-card a:has-text("Buy credits")');
    await page.fill("#topup", "1");
    await page.click('button:has-text("Add test credit")');
    await page.waitForSelector('.toast:has-text("Added $1.00 of test credit")');
    await adminTab(page, "Overview");
    await page.waitForSelector(".stat-grid:not(.is-loading) .stat-card .stat-value");
    await adminTab(page, "Users");
    await page.waitForSelector('.table-users td:has-text("alex@example.com")');
    // Nothing is kept: a reload starts again from the seeded demo, still signed in.
    await page.reload();
    await page.waitForSelector(".conv-item");
    const list = (await apiGet(page, "/api/conversations")).body.conversations;
    assert.ok(!list.some((c) => c.id === id), "the chat from before the reload is gone (memory only)");
    assert.equal((await apiGet(page, "/api/me")).body.user.plan, "balanced");
    assert.deepEqual(await cspViolations(page), []);
  });
  await context.close();
}

async function sandboxedFrame(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await watch(page, "frame");
  await check("inside the sandboxed viewer frame: loads, chats, media renders", async () => {
    await page.goto(`${base}frame.html?src=/`);
    const frame = page.frameLocator("#viewer");
    await frame.locator(".conv-item").first().waitFor({ timeout: 15_000 });
    const handle = await page.$("#viewer");
    const inner = await handle.contentFrame();
    await inner.waitForSelector('.msg-assistant .md:has-text("No AI model is called")');
    await go(inner, "#/");
    await inner.waitForSelector(".empty-state");
    await inner.fill("#composer-input", "An image of a lighthouse at dusk, oil painting");
    await inner.press("#composer-input", "Enter");
    await inner.waitForSelector(".msg-assistant:last-child .media img", { timeout: 20_000 });
    await lastAnswerSettled(inner);
    assert.equal(await page.getAttribute("#viewer", "sandbox"), "allow-scripts allow-same-origin allow-forms allow-popups");
    await shot(page, "f-frame");
    // Downloads are inert in the viewer's frame: the preview says what to do instead.
    let downloads = 0;
    page.on("download", () => downloads++);
    await inner.click(".msg-assistant:last-child .media figcaption a");
    await inner.waitForSelector('.preview-note:has-text("Downloads are blocked inside this preview frame")');
    await adminTab(inner, "Catalog");
    await inner.click('button:has-text("Export JSON")');
    await inner.waitForSelector('.preview-note:has-text("the catalog JSON was copied to your clipboard")');
    assert.equal(downloads, 0);
    // A credit pack: the preview answers with a message, and nothing tries to leave the frame.
    await inner.click('.balance-card a:has-text("Buy credits")');
    await inner.click('.pack:has-text("$5")');
    await inner.waitForSelector(".card .field-error");
    assert.match(await inner.textContent(".card .field-error"), /Payments are off in this preview/);
    assert.equal(new URL(inner.url()).hash, "#/billing");
    await adminTab(inner, "Overview");
    await inner.waitForSelector(".stat-grid:not(.is-loading) .stat-card .stat-value");
    await inner.click('.nav-link:has-text("Log out")');
    await inner.waitForSelector(".auth-card");
    if (await inner.isVisible('.auth-tab:has-text("Log in")')) await inner.click('.auth-tab:has-text("Log in")');
    await inner.fill("#auth-email", DEMO.email);
    await inner.fill("#auth-password", DEMO.password);
    await inner.click("button[type=submit]");
    await inner.waitForSelector(".conv-item");
    assert.deepEqual(await cspViolations(page), []);
  });
  await context.close();
}

/**
 * A cross-origin parent framing the page without clipboard permission (no allow="clipboard-write"),
 * as an embed may: Copy still works, with no permissions-policy error.
 */
async function crossOriginFrame(browser, base) {
  const http = require("http");
  const parent = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><title>Embed</title><iframe id="viewer" style="width:1100px;height:740px;border:0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" src="${base}"></iframe>`);
  });
  await new Promise((r) => parent.listen(0, "127.0.0.1", r));
  // localhost vs 127.0.0.1: another origin than the harness.
  const url = `http://localhost:${parent.address().port}/`;
  const context = await browser.newContext({ viewport: { width: 1140, height: 780 }, deviceScaleFactor: 1 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: url.slice(0, -1) });
  const page = await context.newPage();
  await watch(page, "xframe");
  await check("a cross-origin embed without clipboard permission: Copy still copies, with no raw error", async () => {
    await page.goto(url);
    const inner = await (await page.waitForSelector("#viewer")).contentFrame();
    await inner.waitForSelector(".conv-item");
    assert.notEqual(new URL(inner.url()).origin, new URL(url).origin);
    await inner.click('.conv-item:has-text("Python") .conv-link');
    await inner.waitForSelector(".msg-assistant .code-block");
    await inner.click('.msg-assistant .code-block button:has-text("Copy")');
    await inner.waitForSelector('.msg-assistant .code-block button:has-text("Copied")');
    assert.equal(await inner.$(".toast-error"), null);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(clip, /^# rename_photos\.py/);
  });
  await context.close();
  await new Promise((r) => parent.close(r));
}

/** Every screen of the app on a phone, in one color scheme, with no sideways scroll anywhere. */
async function phoneTour(browser, base, scheme) {
  const tag = scheme === "light" ? "p" : "pk";
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: scheme });
  const page = await context.newPage();
  await watch(page, `phone-${scheme}`);
  await check(`phone 375x812 (${scheme}): every screen without sideways scroll; drawer, chat and switch sheet work`, async () => {
    await page.goto(base);
    await page.waitForSelector('.msg-assistant .md:has-text("No AI model is called")');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(bg, scheme === "dark" ? "rgb(15, 17, 16)" : "rgb(247, 247, 244)", "the scheme's background");
    assert.ok(!(await page.isVisible(".sidebar")), "the sidebar is a closed drawer");
    await noHorizontalScroll(page);
    await shot(page, `${tag}-home`);
    await page.click(".menu-btn");
    await page.waitForSelector(".sidebar.is-open");
    await page.waitForTimeout(300);
    await noHorizontalScroll(page);
    await shot(page, `${tag}-drawer`);
    await page.click('.sidebar .conv-item:has-text("Python") .conv-link');
    await page.waitForSelector(".msg-assistant .code-block");
    await page.waitForTimeout(300);
    assert.ok(!(await page.isVisible(".sidebar.is-open")), "the drawer closes on navigation");
    await noHorizontalScroll(page);
    await shot(page, `${tag}-code`);
    await page.click(".msg-assistant >> nth=0 >> .chip-button");
    await page.waitForSelector(".menu .menu-item");
    const box = await page.$eval(".menu", (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: window.innerWidth, h: window.innerHeight };
    });
    assert.ok(box.l >= 0 && box.r <= box.w && box.t >= 0 && box.b <= box.h, `switch sheet inside the viewport: ${JSON.stringify(box)}`);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-switch`);
    await page.click(".menu-scrim", { position: { x: 20, y: 20 } });
    await page.waitForSelector(".menu", { state: "detached" });
    await page.click(".menu-btn");
    await page.waitForSelector(".sidebar.is-open");
    await page.click(".sidebar-new button");
    await page.waitForSelector(".empty-state");
    await send(page, "Write a bash script that backs up my Documents folder every night.");
    await lastAnswerSettled(page);
    await noHorizontalScroll(page);
    await shot(page, `${tag}-chat-done`);
    for (const [hash, name, sel] of [
      ["#/settings", "settings", ".plan-card"],
      ["#/billing", "billing", ".balance-hero-value"],
      ["#/privacy", "privacy", ".table-providers tbody td"],
    ]) {
      await page.goto(base + hash);
      await page.waitForSelector(sel);
      await page.waitForTimeout(150);
      await noHorizontalScroll(page);
      await shot(page, `${tag}-${name}`);
    }
    await page.goto(base + "#/admin");
    for (const [tab, sel] of [
      ["Overview", ".stat-grid:not(.is-loading) .stat-card .stat-value"],
      ["Routing", ".table-grid select"],
      ["Catalog", ".price-cell"],
      ["Users", ".table-users tbody td .model-name"],
    ]) {
      await adminTab(page, tab);
      await page.waitForSelector(sel);
      await page.waitForTimeout(150);
      await noHorizontalScroll(page);
      await shot(page, `${tag}-admin-${tab.toLowerCase()}`);
    }
    await page.evaluate(() => fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
    await page.goto(base + "#/");
    await page.reload();
    await page.waitForSelector(".auth-card");
    await noHorizontalScroll(page);
    await shot(page, `${tag}-auth`);
  });
  await context.close();
}

/** Phone first screens and tight spots: where each screen opens, and money values never cut off. */
async function phoneDetails(browser, base) {
  const open = async (label, viewport, query = "") => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await watch(page, label);
    await page.goto(base + query);
    await page.waitForSelector(".conv-item", { state: "attached" });
    return { context, page };
  };
  const view = (page, sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(".messages");
      const r = el.getBoundingClientRect();
      const t = document.querySelector(s).getBoundingClientRect();
      return { scrollTop: el.scrollTop, top: t.top - r.top, bottom: t.bottom - r.top, height: el.clientHeight };
    }, sel);

  await check("phone first screen: the welcome note opens at its top (heading and the no-AI line in view)", async () => {
    for (const [w, h, q] of [[375, 812, ""], [375, 667, ""], [320, 568, "?safearea=1"]]) {
      const { context, page } = await open(`phone-${w}x${h}`, { width: w, height: h }, q);
      await page.waitForSelector(".msg-assistant .md-h");
      await page.waitForTimeout(900);
      const v = await view(page, ".msg-assistant .md-h");
      assert.ok(v.scrollTop === 0 && v.top >= 0, `${w}x${h}${q}: ${JSON.stringify(v)}`);
      const line = await view(page, ".msg-assistant .md p strong");
      assert.ok(line.bottom <= line.height, `${w}x${h}${q}: the no-AI line in view ${JSON.stringify(line)}`);
      if (w === 375 && h === 667) {
        // Opened again from another chat (where it does not fit the screen): at its top too.
        await page.click(".menu-btn");
        await page.click('.sidebar .conv-item:has-text("Python") .conv-link');
        await page.waitForSelector(".msg-assistant .code-block");
        await page.waitForTimeout(400);
        // Any other chat still opens at its latest message.
        const gap = await page.$eval(".messages", (el) => el.scrollHeight - el.scrollTop - el.clientHeight);
        assert.ok(gap < 2, `the code chat opens at its end: ${gap}`);
        await page.click(".menu-btn");
        await page.click('.sidebar .conv-item:has-text("Welcome") .conv-link');
        await page.waitForSelector(".msg-assistant .md-h");
        await page.waitForTimeout(600);
        const again = await view(page, ".msg-assistant .md-h");
        assert.ok(again.scrollTop === 0 && again.top >= 0, `reopened: ${JSON.stringify(again)}`);
      }
      if (w === 375 && h === 812) {
        // The note is short enough to fit, and names the sample chats.
        const fits = await page.$eval(".messages", (el) => el.scrollHeight <= el.clientHeight);
        assert.ok(fits, "the welcome note fits a 375x812 screen");
        assert.match(await page.textContent(".msg-assistant .md"), /Sample chats.*My name is Sam Carter….*Write a Python script…/s);
        await shot(page, "pd-welcome");
        // A new chat opens at its top too (its heading, not its last suggestion).
        await page.click(".menu-btn");
        await page.click(".sidebar-new button");
        await page.waitForSelector(".empty-state h1");
        await page.waitForTimeout(300);
        const e = await view(page, ".empty-state h1");
        assert.ok(e.scrollTop === 0 && e.top >= 0, `new chat: ${JSON.stringify(e)}`);
        // The image chat ends with its chip and actions fully above the composer.
        await page.click(".menu-btn");
        await page.click('.sidebar .conv-item:has-text("cozy reading") .conv-link');
        await page.waitForSelector(".msg-assistant .media img");
        await page.waitForFunction(() => document.querySelector(".msg-assistant .media img").complete);
        await page.waitForTimeout(500);
        const chip = await view(page, ".msg-assistant .msg-meta");
        assert.ok(chip.bottom <= chip.height + 0.5, `chip above the composer: ${JSON.stringify(chip)}`);
        await shot(page, "pd-image-chat");
        // Billing history: the amount column in view without sideways scrolling.
        await go(page, "#/billing");
        await page.waitForSelector(".table-ledger tbody td.num");
        const ledger = await page.$eval(".table-ledger", (t) => ({ sw: t.parentElement.scrollWidth, cw: t.parentElement.clientWidth }));
        assert.ok(ledger.sw <= ledger.cw, `ledger fits: ${JSON.stringify(ledger)}`);
      }
      await context.close();
    }
  });

  await check("phone 320 px: the chip cuts the model name, never the cost", async () => {
    const { context, page } = await open("phone-320-chip", { width: 320, height: 640 });
    await page.click(".menu-btn");
    await page.click('.sidebar .conv-item:has-text("Python") .conv-link');
    await page.waitForSelector(".msg-assistant .chip-text .chip-cost");
    const c = await page.$eval(".msg-assistant .chip-text", (el) => {
      const cost = el.querySelector(".chip-cost").getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { costRight: cost.right, boxRight: box.right, cost: el.querySelector(".chip-cost").textContent, text: el.textContent };
    });
    assert.ok(c.costRight <= c.boxRight + 0.5, JSON.stringify(c));
    assert.match(c.cost, /^ · \$[\d.]+$/);
    assert.match(c.text, /^Claude Sonnet 5\.5 · /);
    await shot(page, "pd-320-chip");
    await context.close();
  });

  await check("short phone screens: the drawer keeps a few chats in view and scrolls to the account section", async () => {
    for (const [w, h, q] of [[320, 568, "?safearea=1"], [320, 480, ""]]) {
      const { context, page } = await open(`drawer-${w}x${h}`, { width: w, height: h }, q);
      await page.click(".menu-btn");
      await page.waitForSelector(".sidebar.is-open");
      await page.waitForTimeout(350);
      const d = await page.evaluate(() => {
        const list = document.querySelector(".conv-nav").getBoundingClientRect();
        const items = [...document.querySelectorAll(".conv-nav .conv-item")].filter((i) => {
          const b = i.getBoundingClientRect();
          return b.top >= list.top && b.bottom <= list.bottom;
        });
        return { listH: list.height, inView: items.length };
      });
      assert.ok(d.listH >= 150 && d.inView >= 3, `${w}x${h}${q}: ${JSON.stringify(d)}`);
      await page.$eval(".sidebar", (el) => (el.scrollTop = el.scrollHeight));
      await page.click('.sidebar .nav-link:has-text("Settings")');
      await page.waitForSelector(".plan-card");
      if (q) await shot(page, "pd-drawer-short");
      await context.close();
    }
  });

  await check("phone app safe areas: the signed-out privacy page opens at its top, its bar below the status bar", async () => {
    const { context, page } = await open("privacy-safearea", { width: 320, height: 640 }, "?safearea=1");
    await page.evaluate(() => fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
    await page.reload();
    await page.waitForSelector(".auth-card");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    assert.ok((await page.evaluate(() => window.scrollY)) > 100, "the auth screen was scrolled");
    await page.click('.auth-foot a:has-text("Our privacy promise")');
    await page.waitForSelector(".public-bar");
    await page.waitForTimeout(200);
    const top = await page.evaluate(() => ({ y: window.scrollY, bar: document.querySelector(".public-bar").getBoundingClientRect().top, h1: document.querySelector(".public-page h1").getBoundingClientRect().top }));
    assert.ok(top.y === 0 && top.bar >= 47 && top.h1 > top.bar, JSON.stringify(top));
    await page.$eval(".public-page", (el) => (el.scrollTop = 900));
    await page.waitForTimeout(150);
    assert.ok((await page.evaluate(() => document.querySelector(".public-bar").getBoundingClientRect().top)) >= 47, "the sticky bar stays below the 47 px status bar");
    await shot(page, "pd-privacy-safearea");
    await context.close();
  });
}

async function phone(browser, base) {
  await phoneTour(browser, base, "light");
  await phoneTour(browser, base, "dark");

  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await watch(page, "phone-safearea");
  await check("phone 375x812 in the app's safe areas (?safearea=1): the shell and the whole composer fit inside the padding", async () => {
    await page.goto(`${base}?safearea=1`);
    await page.waitForSelector(".composer");
    const fits = async () => {
      const box = await page.evaluate(() => {
        const rect = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        };
        return { shell: rect(".app-shell"), composer: rect(".composer"), input: rect("#composer-input"), send: rect(".send-btn"), ih: window.innerHeight, iw: window.innerWidth, docH: document.documentElement.scrollHeight };
      });
      assert.ok(box.shell.top >= 46 && box.shell.bottom <= box.ih - 33, `shell inside the padding: ${JSON.stringify(box)}`);
      for (const k of ["composer", "input", "send"]) {
        const r = box[k];
        assert.ok(r && r.top >= 47 && r.bottom <= box.ih - 34 && r.left >= 0 && r.right <= box.iw, `${k} fully visible above the bottom padding: ${JSON.stringify(box)}`);
      }
      assert.ok(box.docH <= box.ih, `no vertical page scroll: ${JSON.stringify(box)}`);
    };
    await fits();
    await noHorizontalScroll(page);
    await shot(page, "s-home");
    await page.click(".menu-btn");
    await page.waitForSelector(".sidebar.is-open");
    const sidebar = await page.$eval(".sidebar", (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, ih: window.innerHeight };
    });
    assert.ok(sidebar.top >= 46 && sidebar.bottom <= sidebar.ih - 33, `drawer inside the padding: ${JSON.stringify(sidebar)}`);
    await page.click('.sidebar .conv-item:has-text("Python") .conv-link');
    await page.waitForSelector(".msg-assistant .code-block");
    await page.waitForTimeout(300);
    await fits();
    await noHorizontalScroll(page);
    await send(page, "And make it skip files that are already renamed.");
    await lastAnswerSettled(page);
    await fits();
    await shot(page, "s-chat");
  });
  await check("phone safe areas (?safearea=1): toasts appear below the top bar, not over it", async () => {
    await page.click('.msg-assistant:last-child .action-btn[aria-label="Copy answer"]');
    await page.waitForSelector(".toast");
    const r = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      return { toast: box(document.querySelector(".toast")).top, bar: box(document.querySelector(".topbar")).bottom };
    });
    assert.ok(r.toast >= r.bar, "toast top " + r.toast + " at or below the top bar's bottom " + r.bar);
    await shot(page, "s-toast");
  });
  await context.close();

  for (const width of [320, 360]) {
    const ctx = await browser.newContext({ viewport: { width, height: 700 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage();
    await watch(pg, "phone-manual-" + width);
    await check("phone " + width + " px with auto-pick off: the model select, 'Turn on auto-pick' and Send fit in the composer", async () => {
      await pg.goto(base);
      await pg.waitForSelector(".composer");
      await pg.evaluate(() => fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auto_pick: false }) }));
      await pg.reload();
      await pg.waitForSelector(".model-picker .select option:not([value=''])", { state: "attached" });
      const r = await pg.evaluate(() => {
        const box = (sel) => {
          const b = document.querySelector(sel).getBoundingClientRect();
          return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) };
        };
        const cb = document.querySelector(".composer-box");
        const inner = cb.getBoundingClientRect().right - parseFloat(getComputedStyle(cb).paddingRight);
        return { select: box(".model-picker .select"), link: box(".model-picker-link"), send: box(".send-btn"), inner: Math.round(inner) };
      });
      const where = JSON.stringify(r);
      assert.ok(r.link.r <= r.send.l, "the link ends before Send: " + where);
      assert.ok(r.select.r <= r.link.l, "the select ends before the link: " + where);
      assert.ok(r.send.r <= r.inner + 1, "Send inside the box: " + where);
      assert.ok(r.select.r - r.select.l >= 100, "the select keeps room for a model name: " + where);
      await noHorizontalScroll(pg);
      await shot(pg, "p" + width + "-manual");
    });
    await ctx.close();
  }

  const narrow = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p2 = await narrow.newPage();
  await watch(p2, "phone-320");
  await check("phone 320 px: chat, a streamed answer, settings, billing, admin and the auth screen without sideways scroll", async () => {
    await p2.goto(base);
    await p2.waitForSelector('.msg-assistant .md:has-text("No AI model is called")');
    await noHorizontalScroll(p2);
    await go(p2, "#/");
    await p2.waitForSelector(".empty-state");
    await send(p2, "Write a bash script that backs up my Documents folder every night.");
    await lastAnswerSettled(p2);
    await noHorizontalScroll(p2);
    await shot(p2, "p320-chat");
    for (const [hash, sel] of [
      ["#/settings", ".plan-card"],
      ["#/billing", ".balance-hero-value"],
      ["#/admin", ".tabs .tab"],
      ["#/privacy", ".table-providers tbody td"],
    ]) {
      await p2.goto(base + hash);
      await p2.waitForSelector(sel);
      await noHorizontalScroll(p2);
    }
    await adminTab(p2, "Routing");
    await p2.waitForSelector(".table-grid select");
    await noHorizontalScroll(p2);
    await p2.evaluate(() => fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
    await p2.goto(base + "#/");
    await p2.reload();
    await p2.waitForSelector(".auth-card");
    await noHorizontalScroll(p2);
  });
  await narrow.close();
}

async function themes(browser, base) {
  const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const scheme = (page) => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  const cases = [
    { name: "OS dark, no choice", colorScheme: "dark", query: "", want: "rgb(15, 17, 16)", wantScheme: "dark" },
    { name: "OS dark, viewer chose light", colorScheme: "dark", query: "?theme=light", want: "rgb(247, 247, 244)", wantScheme: "light" },
    { name: "OS light, viewer chose dark", colorScheme: "light", query: "?theme=dark", want: "rgb(15, 17, 16)", wantScheme: "dark" },
    { name: "OS light, no choice", colorScheme: "light", query: "", want: "rgb(247, 247, 244)", wantScheme: "light" },
  ];
  for (const c of cases) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1, colorScheme: c.colorScheme });
    const page = await context.newPage();
    await watch(page, `theme ${c.name}`);
    await check(`theme: ${c.name}`, async () => {
      await page.goto(base + c.query);
      await page.waitForSelector(".composer");
      assert.equal(await bg(page), c.want);
      assert.equal(await scheme(page), c.wantScheme);
      if (c.query === "?theme=dark") await shot(page, "t-dark");
      if (c.query === "?theme=light") await shot(page, "t-light-over-dark-os");
      // The viewer flips the theme with the page open: the explicit choice wins either way.
      const LIGHT = "rgb(247, 247, 244)";
      const DARK = "rgb(15, 17, 16)";
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
      assert.equal(await bg(page), LIGHT);
      assert.equal(await scheme(page), "light");
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      assert.equal(await bg(page), DARK);
      assert.equal(await scheme(page), "dark");
      await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
      assert.equal(await bg(page), c.colorScheme === "dark" ? DARK : LIGHT, "back to the OS preference");
    });
    await context.close();
  }

  // Desktop dark: every screen renders on the dark tokens (screenshots for review).
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1, colorScheme: "dark" });
  const page = await context.newPage();
  await watch(page, "dark-tour");
  await check("desktop dark: chat, settings, billing, admin and privacy render", async () => {
    await page.goto(base);
    await page.waitForSelector(".conv-item");
    await page.click('.conv-item:has-text("Sam Carter") .conv-link');
    await page.waitForSelector(".msg-assistant .chip-text");
    await shot(page, "k-private");
    for (const [hash, name, sel] of [
      ["#/", "k-home", ".composer"],
      ["#/settings", "k-settings", ".plan-card"],
      ["#/billing", "k-billing", ".balance-hero-value"],
      ["#/privacy", "k-privacy", ".table-providers tbody td"],
    ]) {
      await page.goto(base + hash);
      await page.waitForSelector(sel);
      await page.waitForTimeout(150);
      assert.equal(await bg(page), "rgb(15, 17, 16)");
      await shot(page, name);
    }
    await page.goto(base + "#/admin");
    for (const tab of ["Overview", "Routing", "Catalog", "Users"]) {
      await adminTab(page, tab);
      await page.waitForTimeout(250);
      await shot(page, `k-admin-${tab.toLowerCase()}`);
    }
    assert.deepEqual(await cspViolations(page), []);
  });
  await context.close();
}

// ---------------------------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error("preview smoke: preview/dist is missing; run node preview/build.js first");
    process.exit(2);
  }
  const harness = await startHarness({ dist: DIST, log: () => {} });
  const browser = await chromium.launch();
  try {
    await desktopFlow(browser, harness.url);
    await moreChat(browser, harness.url);
    await frameFocus(browser, harness.url);
    await storageBlocked(browser, harness.url);
    await sandboxedFrame(browser, harness.url);
    await phone(browser, harness.url);
    await phoneDetails(browser, harness.url);
    await crossOriginFrame(browser, harness.url);
    await themes(browser, harness.url);
  } finally {
    await browser.close();
    await harness.close();
  }

  await check("the page made no real /api request (the simulated backend answered all of them)", async () => {
    const hits = harness.lines.filter((l) => l.startsWith("[harness] real /api request"));
    assert.deepEqual(hits, []);
  });
  await check("no console errors or warnings, page errors or failed requests", async () => {
    assert.deepEqual(problems, []);
  });
  await check("no missing supporting files", async () => {
    assert.deepEqual(harness.lines.filter((l) => l.startsWith("[harness] 404")), []);
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\npreview smoke: ${results.length - failed.length}/${results.length} passed`);
  if (SHOTS) console.log(`screenshots in ${SHOTS}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
