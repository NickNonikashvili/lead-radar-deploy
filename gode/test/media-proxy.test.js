// GET /api/media/:messageId/:index: generated media streamed through Gode, so the media host never
// sees the viewer's IP. Ownership, the host allowlist, content types and stored-vs-shown URLs.
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");

const { createTestApp, createClient } = require("./helpers/app");
const { createApp } = require("../src/app");

const PASSWORD = "correct-horse-battery";
const FAL_URL = "https://v3.fal.media/files/abc/image.png";

/** A fake media host: records requests, answers by URL. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url: String(url), headers: { ...(opts.headers || {}) }, redirect: opts.redirect });
    const r = routes[String(url)];
    if (!r) return new Response("missing", { status: 404 });
    if (r.redirect) return new Response(null, { status: 302, headers: { location: r.redirect } });
    const headers = { "content-type": r.type, ...(r.headers || {}) };
    return new Response(r.body, { status: r.status || 200, headers });
  };
  fn.calls = calls;
  return fn;
}

function storeAnswer(t, user, media) {
  const { db, keyring } = t.deps;
  const dek = db.prepare("SELECT wrapped_dek FROM users WHERE id = ?").get(user.id).wrapped_dek;
  const at = Date.now();
  const convId = crypto.randomUUID();
  db.prepare("INSERT INTO conversations (id, user_id, title_enc, pins, created_at, updated_at) VALUES (?, ?, NULL, '{}', ?, ?)").run(convId, user.id, at, at);
  const q = crypto.randomUUID();
  const a = crypto.randomUUID();
  const insert = db.prepare("INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)");
  insert.run(q, convId, user.id, "user", keyring.encrypt(dek, { text: "draw a fox" }, { json: true }), null, at);
  insert.run(a, convId, user.id, "assistant", keyring.encrypt(dek, { text: "", media }, { json: true }), q, at + 1);
  return { convId, messageId: a, userMessageId: q };
}

describe("media proxy", () => {
  let t;
  let server;
  let url;
  let fetchStub;
  let alice;
  let bob;
  before(async () => {
    t = await createTestApp();
    fetchStub = fakeFetch({
      [FAL_URL]: { type: "image/png", body: Buffer.from("PNGDATA") },
      "https://v3.fal.media/files/abc/clip.mp4": { type: "video/mp4", body: Buffer.from("0123456789"), status: 206, headers: { "content-range": "bytes 0-9/100", "accept-ranges": "bytes" } },
      "https://v3.fal.media/files/abc/evil.svg": { type: "image/svg+xml", body: "<svg onload=alert(1)>" },
      "https://v3.fal.media/files/abc/moved.png": { redirect: "https://cdn.fal.media/final.png" },
      "https://cdn.fal.media/final.png": { type: "image/png", body: "FINAL" },
      "https://v3.fal.media/files/abc/away.png": { redirect: "https://evil.example/steal.png" },
    });
    const app = createApp({ ...t.deps, mediaFetch: fetchStub });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${server.address().port}`;
    alice = { c: createClient(url) };
    alice.user = await alice.c.signup("alice-media@example.test", PASSWORD);
    bob = { c: createClient(url) };
    bob.user = await bob.c.signup("bob-media@example.test", PASSWORD);
  });
  after(async () => {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    await t.close();
  });

  test("the conversation shows a same-origin link; the stored message keeps the upstream URL", async () => {
    const { convId, messageId, userMessageId } = storeAnswer(t, alice.user, [
      { type: "image", url: FAL_URL },
      { type: "image", url: "data:image/png;base64,AAAA" },
      { type: "image", url: "https://elsewhere.example/x.png" },
    ]);
    const r = await alice.c.json("GET", `/api/conversations/${convId}`);
    const answer = r.body.messages.find((m) => m.id === messageId);
    assert.deepEqual(
      answer.media.map((m) => m.url),
      [`/api/media/${messageId}/0`, "data:image/png;base64,AAAA", "https://elsewhere.example/x.png"]
    );
    assert.equal(r.body.messages.find((m) => m.id === userMessageId).answered, true);
    assert.ok(!r.text.includes("v3.fal.media"), "the browser is never told the media host's URL");
  });

  test("streams the owner's file with a safe content type and no third party in sight", async () => {
    const { messageId } = storeAnswer(t, alice.user, [{ type: "image", url: FAL_URL }]);
    fetchStub.calls.length = 0;
    const res = await alice.c.request("GET", `/api/media/${messageId}/0`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.equal(Buffer.from(await res.arrayBuffer()).toString(), "PNGDATA");
    assert.match(res.headers.get("content-security-policy"), /sandbox/);
    assert.equal(fetchStub.calls.length, 1);
    assert.equal(fetchStub.calls[0].url, FAL_URL);
    assert.equal(fetchStub.calls[0].redirect, "manual");
    const sent = JSON.stringify(fetchStub.calls[0].headers).toLowerCase();
    assert.ok(!sent.includes("cookie") && !sent.includes("x-forwarded") && !sent.includes("127.0.0.1"), "no user identity forwarded");
  });

  test("Range requests pass through for seeking", async () => {
    const { messageId } = storeAnswer(t, alice.user, [{ type: "video", url: "https://v3.fal.media/files/abc/clip.mp4" }]);
    const res = await alice.c.request("GET", `/api/media/${messageId}/0`, { headers: { Range: "bytes=0-9" } });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 0-9/100");
    assert.equal(res.headers.get("content-type"), "video/mp4");
    assert.equal(fetchStub.calls.at(-1).headers.Range, "bytes=0-9");
  });

  test("SVG (or anything scriptable) is never served inline from our origin", async () => {
    const { messageId } = storeAnswer(t, alice.user, [{ type: "image", url: "https://v3.fal.media/files/abc/evil.svg" }]);
    const res = await alice.c.request("GET", `/api/media/${messageId}/0`);
    assert.equal(res.headers.get("content-type"), "application/octet-stream");
    assert.equal(res.headers.get("content-disposition"), "attachment");
  });

  test("redirects are followed only to allowed hosts", async () => {
    const ok = storeAnswer(t, alice.user, [{ type: "image", url: "https://v3.fal.media/files/abc/moved.png" }]);
    const res = await alice.c.request("GET", `/api/media/${ok.messageId}/0`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "FINAL");
    const bad = storeAnswer(t, alice.user, [{ type: "image", url: "https://v3.fal.media/files/abc/away.png" }]);
    fetchStub.calls.length = 0;
    assert.equal((await alice.c.request("GET", `/api/media/${bad.messageId}/0`)).status, 404);
    assert.ok(!fetchStub.calls.some((c) => c.url.includes("evil.example")), "never fetched off the allowlist");
  });

  test("404 for someone else's message, a bad index, a non-allowed host and when signed out", async () => {
    const { messageId } = storeAnswer(t, alice.user, [
      { type: "image", url: FAL_URL },
      { type: "image", url: "https://elsewhere.example/x.png" },
    ]);
    fetchStub.calls.length = 0;
    assert.equal((await bob.c.request("GET", `/api/media/${messageId}/0`)).status, 404);
    assert.equal((await alice.c.request("GET", `/api/media/${messageId}/1`)).status, 404, "not on MEDIA_PROXY_HOSTS: no SSRF");
    assert.equal((await alice.c.request("GET", `/api/media/${messageId}/7`)).status, 404);
    assert.equal((await alice.c.request("GET", `/api/media/${messageId}/-1`)).status, 404);
    assert.equal((await alice.c.request("GET", `/api/media/${messageId}/x`)).status, 404);
    assert.equal((await createClient(url).request("GET", `/api/media/${messageId}/0`)).status, 401);
    assert.equal(fetchStub.calls.length, 0, "nothing was fetched for any of them");
  });

  test("an expired upstream file is a 404 with a clear message", async () => {
    const { messageId } = storeAnswer(t, alice.user, [{ type: "image", url: "https://v3.fal.media/files/gone.png" }]);
    const r = await alice.c.json("GET", `/api/media/${messageId}/0`);
    assert.equal(r.status, 404);
    assert.match(r.body.error, /expired/);
  });
});

test("with MEDIA_PROXY off the conversation shows the upstream URL and the route is a 404", async () => {
  const t = await createTestApp({ MEDIA_PROXY: "0" });
  try {
    const c = t.client();
    const user = await c.signup("noproxy@example.test", PASSWORD);
    const { convId, messageId } = storeAnswer(t, user, [{ type: "image", url: FAL_URL }]);
    const r = await c.json("GET", `/api/conversations/${convId}`);
    assert.equal(r.body.messages.find((m) => m.id === messageId).media[0].url, FAL_URL);
    assert.equal((await c.request("GET", `/api/media/${messageId}/0`)).status, 404);
    const csp = (await c.request("GET", "/api/me")).headers.get("content-security-policy");
    assert.match(csp, /img-src 'self' data: blob: https:/);
  } finally {
    await t.close();
  }
});
