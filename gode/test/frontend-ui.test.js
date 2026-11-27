// public/app.js pure UI helpers: the live chip, error copy, the per-answer privacy badge, server
// messages (stopped / unanswered), the chat reducer, the screen-reader announcement and the privacy
// promises, which must never claim more than the server reports (and must match privacy.html).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

globalThis.React = require(path.join(__dirname, "..", "public", "vendor", "react.production.min.js"));
const ui = require("../public/app.js");

test("the live chip leaves out effort for media jobs, like the server's chip", () => {
  assert.equal(ui.liveChipText({ job: "image", model_label: "Qwen Image 3", effort: "none", est_cost_usd: 0.05 }), "Qwen Image 3 · est. $0.05");
  assert.equal(ui.liveChipText({ job: "video", model_label: "Veo 3.1", effort: "none", cost_usd: 2.08 }), "Veo 3.1 · $2.08");
  assert.equal(ui.liveChipText({ job: "chat", model_label: "DeepSeek", effort: "none", est_cost_usd: 0.001 }), "DeepSeek · no thinking · est. $0.001");
  assert.equal(ui.liveChipText({ job: "code", model_label: "Opus", effort: "high", cost_usd: 0.04 }), "Opus · high effort · $0.04");
});

test("error copy: busy, privacy filter down, out of credits and a dropped connection", () => {
  const busy = ui.errorCopy({ code: "busy", message: "Wait for the current answer to finish." });
  assert.equal(busy.title, "Still answering");
  assert.equal(busy.body, "Wait for the current answer to finish.");
  assert.equal(busy.retry, true);
  const filter = ui.errorCopy({ code: "redaction_unavailable" });
  assert.equal(filter.title, "Privacy filter unavailable");
  assert.match(filter.body, /nothing was sent/);
  assert.equal(filter.retry, true);
  const credits = ui.errorCopy({ code: "insufficient_credits" });
  assert.equal(credits.cta, "billing");
  assert.equal(credits.retry, true, "the unsent question can be sent once credits are added");
  const net = ui.errorCopy({ code: "network", message: "The connection dropped before the answer finished." });
  assert.equal(net.title, "Connection lost");
  assert.equal(net.body, "The connection dropped before the answer finished.");
});

test("privacy badge: the lock only when zero retention was enforced; private media gets a redacted badge", () => {
  assert.equal(ui.privacyBadgeFor({ private: false, zdr: false, model_region: "us" }), null);
  const privateText = ui.privacyBadgeFor({ private: true, zdr: true, model_region: "us" });
  assert.equal(privateText.kind, "private");
  assert.equal(privateText.icon, "lock");
  assert.equal(privateText.label, "Private");
  const privateMedia = ui.privacyBadgeFor({ private: true, zdr: false, model_region: "us", job: "image" });
  assert.equal(privateMedia.kind, "redacted");
  assert.notEqual(privateMedia.icon, "lock");
  assert.match(privateMedia.title, /may keep the request/);
  assert.doesNotMatch(privateMedia.title, /zero-retention or self-hosted models were allowed/);
  const strict = ui.privacyBadgeFor({ private: false, zdr: true, model_region: "eu" });
  assert.equal(strict.label, "Zero retention");
  const self = ui.privacyBadgeFor({ private: true, zdr: true, model_region: "self" });
  assert.equal(self.kind, "self");
  assert.doesNotMatch(self.title, /Nothing left our servers/);
});

test("server messages: stopped answers and unanswered questions are marked", () => {
  const stopped = ui.messageFromServer({ id: "a1", role: "assistant", text: "Once", media: [], stopped: true, request: { status: "stopped", chip: "X · low effort · $0.0002" } });
  assert.equal(stopped.stopped, true);
  assert.equal(ui.messageFromServer({ id: "a2", role: "assistant", text: "Hi", request: { status: "stopped" } }).stopped, true);
  assert.equal(ui.messageFromServer({ id: "a3", role: "assistant", text: "Hi", request: { status: "ok" } }).stopped, false);
  assert.equal(ui.messageFromServer({ id: "u1", role: "user", text: "Q", answered: false }).answered, false);
  assert.equal(ui.messageFromServer({ id: "u2", role: "user", text: "Q", answered: true }).answered, true);
  // Older servers without the flag: treated as answered (no false "No answer" marker).
  assert.equal(ui.messageFromServer({ id: "u3", role: "user", text: "Q" }).answered, true);
});

test("the route event's pick source: a switch or manual pick is the user's", () => {
  const route = { request_id: "r", job: "chat", tier: "budget", model: { id: "m", label: "M" }, effort: "low", pinned: true };
  assert.equal(ui.requestFromRoute(route).pick_source, "auto");
  assert.equal(ui.requestFromRoute(route, "user").pick_source, "user");
});

test("chat reducer: a new send drops earlier failed sends the server never stored", () => {
  const state = {
    streams: {},
    threads: {
      k: {
        status: "ready",
        messages: [
          { key: "u0", role: "user", text: "stored" },
          { key: "a0", role: "assistant", error: { code: "upstream_error" }, userKey: "u0" },
          { key: "u1", role: "user", text: "unsent" },
          { key: "a1", role: "assistant", error: { code: "insufficient_credits" }, notStored: true, userKey: "u1" },
        ],
      },
    },
  };
  const next = ui.chatReducer(state, { type: "prune_unsent", key: "k" });
  assert.deepEqual(next.threads.k.messages.map((m) => m.key), ["u0", "a0"]);
  // Nothing to drop: the same state object (no re-render).
  assert.equal(ui.chatReducer(next, { type: "prune_unsent", key: "k" }), next);
});

test("the screen-reader announcement: once per finished answer, never for errors", () => {
  assert.equal(ui.announcementFor({ role: "assistant", phase: "writing", text: "x" }), "");
  assert.equal(ui.announcementFor({ role: "assistant", error: { code: "x" } }), "");
  assert.equal(ui.announcementFor({ role: "assistant", text: "Hello there", request: { chip: "M · low effort · $0.01" } }), "Answer ready. M · low effort · $0.01. Hello there");
  assert.equal(ui.announcementFor({ role: "assistant", text: "", media: [{}], request: { job: "image", chip: "Qwen Image 3 · $0.05" } }), "Image ready. Qwen Image 3 · $0.05");
  assert.match(ui.announcementFor({ role: "assistant", text: "partial", stopped: true, request: { chip: "M · $0.001" } }), /^Answer stopped\./);
  // Long answers are cut to their first 200 characters.
  assert.equal(ui.announcementFor({ role: "assistant", text: "x".repeat(500), request: null }), "Answer ready. " + "x".repeat(200) + "…");
});

test("privacy promises follow the server: self-hosting, fallback, Presidio, classifier, media proxy", () => {
  const byIcon = (list) => Object.fromEntries(list.map((p) => [p.icon, p]));
  const base = { models: [], redaction: { enabled: true, presidio: false }, private_fallback: "zdr", media_proxy: true };

  const none = byIcon(ui.promisesFor(ui.privacyFacts({ ...base, selfhosted: false, presidio: false, classifier: { label: "DeepSeek V4.1 Flash", zdr: true, region: "cn" } })));
  assert.equal(none.server.title, "Sensitive requests only go to zero-retention models");
  assert.doesNotMatch(none.server.body, /servers we control|never leaves/);
  assert.match(none.server.body, /classifier model \(DeepSeek V4\.1 Flash, zero retention, China\)/);
  assert.match(none.server.body, /media providers that may keep them/);
  assert.match(none["eye-off"].body, /Names are only caught when you introduce them/);
  assert.doesNotMatch(none["eye-off"].body, /^Names/);
  assert.match(none.user.body, /don’t see your IP address/);

  const block = byIcon(ui.promisesFor(ui.privacyFacts({ ...base, selfhosted: false, private_fallback: "block", classifier: null })));
  assert.equal(block.server.title, "Sensitive requests are not sent out");
  assert.match(block.server.body, /no outside classifier/);

  const self = byIcon(ui.promisesFor(ui.privacyFacts({ ...base, selfhosted: true, presidio: true, classifier: { label: "GPT-6 Luna", zdr: false, region: "us" } })));
  assert.equal(self.server.title, "Sensitive requests stay on our servers");
  assert.match(self.server.body, /its provider may keep requests/);
  assert.match(self["eye-off"].body, /^Names, email addresses/);

  const off = byIcon(ui.promisesFor(ui.privacyFacts({ ...base, redaction: { enabled: false, presidio: false } })));
  assert.match(off["eye-off"].title, /off on this server/);
  const noProxy = byIcon(ui.promisesFor(ui.privacyFacts({ ...base, media_proxy: false })));
  assert.doesNotMatch(noProxy.user.body, /IP address/);

  // Every variant keeps the backup caveat on deletion.
  for (const list of [none, block, self]) assert.match(list.trash.body, /Backups made before that still contain them/);
});

test("the first-screen privacy line only promises names with Presidio", () => {
  assert.match(ui.redactionLine({ presidio: false }), /^Emails, phone numbers/);
  assert.match(ui.redactionLine({ presidio: false }), /Names are caught only when you introduce them/);
  assert.match(ui.redactionLine({ presidio: true }), /^Names, emails/);
});

test("static privacy.html carries the conservative wording (what app.js shows before it knows more)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "privacy.html"), "utf8");
  const cards = [...html.matchAll(/<li class="promise">\s*<h2>([^<]+)<\/h2>\s*<p>([^<]+)<\/p>/g)].map((m) => ({ title: m[1], body: m[2] }));
  const expected = ui.promisesFor(ui.privacyFacts(null)).map(({ title, body }) => ({ title, body }));
  assert.deepEqual(cards, expected);
  assert.doesNotMatch(html, /never leaves|Sensitive requests stay on our servers/);
});

test("transparency: the classifier column names the classifier, nothing for a reused decision", () => {
  assert.equal(ui.classifierText({ classifier_model: "openrouter:deepseek/deepseek-v4.1-flash", classifier_label: "DeepSeek V4.1 Flash" }), "DeepSeek V4.1 Flash");
  assert.equal(ui.classifierText({ classifier_model: "heuristic", classifier_label: "Gode's own rules" }), "Gode's own rules");
  assert.equal(ui.classifierText({ classifier_model: null, classifier_label: null }), null);
});

test("a connection that drops mid-answer is a 'network' error in our words; Stop stays a stop", async () => {
  const realFetch = globalThis.fetch;
  const streamOf = (read) => ({
    ok: true,
    status: 200,
    headers: { get: (h) => (h.toLowerCase() === "content-type" ? "text/event-stream" : null) },
    body: { getReader: () => ({ read }) },
  });
  try {
    const events = [];
    let calls = 0;
    globalThis.fetch = async () =>
      streamOf(async () => {
        calls += 1;
        if (calls === 1) return { value: new TextEncoder().encode('event: delta\ndata: {"text":"Hi"}\n\nevent: done\ndata: {"cost'), done: false };
        throw new TypeError("network error");
      });
    await assert.rejects(
      ui.streamApi("/api/chat", {}, { onEvent: (e, d) => events.push([e, d]) }),
      (err) => err instanceof ui.ApiError && err.code === "network" && err.status === 0 && /connection dropped/.test(err.message)
    );
    assert.deepEqual(events, [["delta", { text: "Hi" }]], "the complete event arrived; the cut-off `done` was not parsed");

    globalThis.fetch = async () =>
      streamOf(async () => {
        throw new DOMException("The user aborted a request.", "AbortError");
      });
    await assert.rejects(ui.streamApi("/api/chat", {}, { onEvent() {} }), { name: "AbortError" });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("off switches meet the 3:1 non-text contrast minimum in both themes", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "public", "styles.css"), "utf8");
  const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
  const token = (name, from) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css.slice(from))[1];
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  assert.match(css, /\.switch \{[^}]*background: var\(--switch-off\)/, "the off track uses the token");
  for (const [theme, from] of [["light", 0], ["dark", darkStart]]) {
    const track = token("switch-off", from);
    for (const surface of ["surface", "surface-2"]) assert.ok(ratio(track, token(surface, from)) >= 3, `${theme} track vs --${surface}`);
    assert.ok(ratio(track, "#ffffff") >= 3, `${theme} thumb vs track`);
  }
});

test("stopped note: a charged media stop says why it was charged", () => {
  assert.match(ui.stoppedNote({ text: "Once upon", request: { job: "chat" } }), /kept as far as it got/);
  assert.match(ui.stoppedNote({ text: "", media: [], request: { job: "video", cost_usd: 2.08 } }), /started making it.*charged/);
  assert.equal(ui.stoppedNote({ text: "", media: [], request: { job: "video", cost_usd: 0 } }), "Stopped before the answer started.");
  assert.equal(ui.stoppedNote({ text: "", media: [], request: { job: "chat", cost_usd: null } }), "Stopped before the answer started.");
});

test("privacy badge: a private media follow-up says the earlier message went with it", () => {
  const plain = ui.privacyBadgeFor({ private: true, zdr: false, model_region: "us", job: "image" });
  assert.doesNotMatch(plain.title, /earlier message/);
  const followUp = ui.privacyBadgeFor({ private: true, zdr: false, model_region: "us", job: "video", context_included: true });
  assert.equal(followUp.kind, "redacted");
  assert.match(followUp.title, /included the earlier message it builds on/);
  assert.match(followUp.title, /may keep the request/);
  assert.equal(ui.requestFromRoute({ request_id: "r", model: {}, context_included: true }).context_included, true);
});
