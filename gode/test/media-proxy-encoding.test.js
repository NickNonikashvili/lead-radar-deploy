// The media proxy and compressed upstreams: fetch decodes a gzip body by itself, so the proxy must
// never forward the upstream's (compressed) Content-Length with the decoded body. It asks for
// identity, and if a host compresses anyway it streams without a length.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const zlib = require("node:zlib");

const { createTestApp } = require("./helpers/app");

const ORIGINAL = Buffer.alloc(200_000, 7); // compressible "audio"
const GZ = zlib.gzipSync(ORIGINAL);

let upstream;
let seen;
let t;
let cookie;
let alice;

/** Real fetch, with the fal CDN host pointed at the local upstream. */
function mediaFetch(url, opts) {
  return fetch(String(url).replace(/^https:\/\/v3\.fal\.media/, `http://127.0.0.1:${upstream.address().port}`), opts);
}

function storeAudio(user, url) {
  const { db, keyring } = t.deps;
  const dek = db.prepare("SELECT wrapped_dek FROM users WHERE id = ?").get(user.id).wrapped_dek;
  const at = Date.now();
  const conv = crypto.randomUUID();
  const msg = crypto.randomUUID();
  db.prepare("INSERT INTO conversations (id, user_id, title_enc, pins, created_at, updated_at) VALUES (?, ?, NULL, '{}', ?, ?)").run(conv, user.id, at, at);
  db.prepare("INSERT INTO messages (id, conversation_id, user_id, role, content_enc, parent_id, request_id, created_at) VALUES (?, ?, ?, 'assistant', ?, NULL, NULL, ?)").run(
    msg, conv, user.id, keyring.encrypt(dek, { text: "", media: [{ type: "audio", url }] }, { json: true }), at
  );
  return msg;
}

/** A plain Node HTTP client: it enforces Content-Length framing like a browser does. */
function rawGet(pathname, headers = {}) {
  const { port } = new URL(t.url);
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: pathname, headers: { Cookie: cookie, ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

before(async () => {
  upstream = http.createServer((req, res) => {
    seen = { acceptEncoding: req.headers["accept-encoding"], range: req.headers.range };
    if (req.url.includes("polite") && req.headers["accept-encoding"] === "identity") {
      res.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": ORIGINAL.length });
      return res.end(ORIGINAL);
    }
    if (req.url.includes("range")) {
      res.writeHead(206, { "Content-Type": "audio/wav", "Content-Encoding": "gzip", "Content-Range": `bytes 0-99/${GZ.length}`, "Content-Length": 100 });
      return res.end(GZ.subarray(0, 100));
    }
    // A CDN that compresses whatever it was asked.
    res.writeHead(200, { "Content-Type": "audio/wav", "Content-Encoding": "gzip", "Content-Length": GZ.length, ETag: '"gz-1"' });
    res.end(GZ);
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  t = await createTestApp({}, { mediaFetch });
  alice = t.client();
  alice.user = await alice.signup("gzip@example.test");
  cookie = [...alice.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
});

after(async () => {
  await t.close();
  await new Promise((r) => upstream.close(r));
});

test("the proxy asks the media host for an uncompressed file", async () => {
  const id = storeAudio(alice.user, "https://v3.fal.media/files/polite.wav");
  const r = await rawGet(`/api/media/${id}/0`);
  assert.equal(r.status, 200);
  assert.equal(seen.acceptEncoding, "identity");
  assert.equal(Number(r.headers["content-length"]), ORIGINAL.length);
  assert.ok(r.body.equals(ORIGINAL));
});

test("a host that gzips anyway: the client gets exactly the decoded bytes, with no stale Content-Length", async () => {
  const id = storeAudio(alice.user, "https://v3.fal.media/files/always-gzip.wav");
  const r = await rawGet(`/api/media/${id}/0`);
  assert.equal(r.status, 200);
  assert.equal(r.headers["content-type"], "audio/wav");
  assert.ok(r.headers["content-length"] === undefined || Number(r.headers["content-length"]) === ORIGINAL.length, `content-length ${r.headers["content-length"]}`);
  assert.equal(r.headers["content-encoding"], undefined);
  assert.equal(r.headers.etag, undefined, "the compressed representation's ETag is not ours to pass on");
  assert.equal(r.body.length, ORIGINAL.length);
  assert.ok(r.body.equals(ORIGINAL));
});

test("a compressed range answer is refused rather than passed on with offsets that mean nothing", async () => {
  const id = storeAudio(alice.user, "https://v3.fal.media/files/range.wav");
  const r = await rawGet(`/api/media/${id}/0`, { Range: "bytes=0-99" });
  assert.equal(r.status, 502);
  assert.equal(JSON.parse(r.body.toString()).code, "upstream_error");
});
