#!/usr/bin/env node
"use strict";
// Builds the static Gode preview into preview/dist/ (no dependencies, Node 22):
//
//   index.html                           the page as an Artifact FRAGMENT (no doctype/html/head/body:
//                                        the host wraps it; preview/harness.js does the same locally)
//   app.js                               byte-identical copy of public/app.js (the real frontend)
//   styles.css                           public/styles.css + theme guards + preview layout overrides
//   vendor/react*.production.min.js      React 18.3.1 UMD, copied from public/vendor
//   mock-api.js                          the simulated backend: real Gode modules from src/ plus
//                                        preview/src, bundled with a small CommonJS bundler, and a
//                                        fixture made here from src/config.js defaults
//
//   node preview/build.js [--out <dir>] [--quiet]
//
// The bundler follows require() calls from preview/src/main.js. Node builtins are replaced by
// preview/src/shims (only crypto, net and express are allowed: anything else, such as fs or http,
// fails the build), and two product modules are swapped for browser stand-ins (src/crypto.js,
// src/redact/presidio.js). Everything else from src/ is bundled unchanged.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const PREVIEW = path.join(ROOT, "preview");
const ENTRY = "preview/src/main.js";

const BUILTINS = {
  crypto: "preview/src/shims/crypto.js",
  net: "preview/src/shims/net.js",
  express: "preview/src/shims/express.js",
};
// Product modules replaced in the bundle (the id stays the product path; the source is the shim).
const OVERRIDES = {
  "src/crypto.js": "preview/src/shims/gode-crypto.js",
  "src/redact/presidio.js": "preview/src/shims/presidio.js",
};
const FIXTURE_ID = "preview:fixture";
// Passed to every module as its `Buffer` (the browser has none).
const BUFFER_SHIM = "preview/src/shims/buffer.js";

// The deployment the preview simulates (see preview/README.md, "What the preview simulates").
const DEPLOYMENT = {
  name: "Phase 1 default deployment",
  // Gateways with keys: answers would go out through these. No self-hosted GPU server, so private
  // text takes PRIVATE_FALLBACK=zdr (a zero-retention model after redaction).
  gateways: { openrouter: true, openai: true, fal: true, selfhosted: false },
  presidio: false,
  stripe: false,
  demo: { email: "demo@example.com", password: "preview-demo" },
  storageKey: "gode-preview:v1",
};

function parseArgs(argv) {
  const out = { dir: path.join(PREVIEW, "dist"), quiet: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.dir = path.resolve(argv[++i]);
    else if (argv[i] === "--quiet") out.quiet = true;
    else throw new Error(`build: unknown option ${argv[i]}`);
  }
  return out;
}

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");
const readText = (id) => fs.readFileSync(path.join(ROOT, id), "utf8");

// ---------------------------------------------------------------------------------------------
// Fixture: what the server would read from its environment, computed by the real src/config.js
// ---------------------------------------------------------------------------------------------

function buildFixture() {
  const { loadConfig } = require(path.join(ROOT, "src/config.js"));
  // Exactly `npm run dev` (GODE_MOCK=1 ALLOW_DEV_TOPUP=1), with nothing from this machine's env.
  const config = JSON.parse(JSON.stringify(loadConfig({ NODE_ENV: "development", GODE_MOCK: "1", ALLOW_DEV_TOPUP: "1" })));
  // Paths of the build machine and secrets have no place in a published page.
  for (const k of ["rootDir", "dataDir", "databasePath", "masterKey", "publicUrl", "port"]) delete config[k];
  for (const g of Object.values(config.gateways || {})) if (g && typeof g === "object" && "apiKey" in g) g.apiKey = "";
  config.billing.stripeSecretKey = "";
  config.billing.stripeWebhookSecret = "";
  return { config, deployment: DEPLOYMENT };
}

// ---------------------------------------------------------------------------------------------
// Bundler
// ---------------------------------------------------------------------------------------------

const REQUIRE_RE = /\brequire\(\s*(["'])([^"'\n]+)\1\s*\)/g;

/** Specifiers of require("...") calls, ignoring ones inside // and /* comments. */
function scanRequires(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
  const out = new Set();
  let m;
  while ((m = REQUIRE_RE.exec(code))) out.add(m[2]);
  return [...out];
}

function resolveSpec(fromId, spec) {
  const bare = spec.replace(/^node:/, "");
  if (Object.prototype.hasOwnProperty.call(BUILTINS, bare)) return BUILTINS[bare];
  if (spec === FIXTURE_ID) return FIXTURE_ID;
  if (!spec.startsWith(".")) throw new Error(`build: ${fromId} requires "${spec}", which the browser preview cannot provide`);
  const fromFile = OVERRIDES[fromId] || fromId;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  for (const candidate of [base, `${base}.js`, `${base}/index.js`]) {
    const abs = path.join(ROOT, candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      const id = rel(abs);
      if (id.startsWith("..")) throw new Error(`build: ${fromId} requires ${spec}, outside the repository`);
      return id;
    }
  }
  throw new Error(`build: ${fromId} requires "${spec}", which does not exist`);
}

function bundle({ fixture }) {
  const modules = new Map();
  const queue = [ENTRY, BUFFER_SHIM];
  while (queue.length) {
    const id = queue.shift();
    if (modules.has(id)) continue;
    let source;
    if (id === FIXTURE_ID) source = `module.exports = ${JSON.stringify(fixture)};\n`;
    else source = readText(OVERRIDES[id] || id);
    const deps = {};
    for (const spec of id === FIXTURE_ID ? [] : scanRequires(source)) {
      const target = resolveSpec(id, spec);
      deps[spec] = target;
      if (spec.startsWith("node:")) deps[spec.slice(5)] = target;
      queue.push(target);
    }
    modules.set(id, { id, file: id === FIXTURE_ID ? null : OVERRIDES[id] || id, source, deps });
  }

  const ids = [...modules.keys()].sort();
  const parts = [];
  parts.push(
    "/*! Gode preview: the simulated backend. Generated by preview/build.js; do not edit.",
    " * Bundles Gode's own modules from src/ (unchanged) with preview/src. See preview/README.md.",
    ` * Modules: ${ids.length}. */`,
    "(function () {",
    "var __defs = {};"
  );
  for (const id of ids) {
    const m = modules.get(id);
    const banner = m.file && m.file !== id ? ` (source: ${m.file})` : "";
    parts.push(
      `// ---- ${id}${banner} ----`,
      `__defs[${JSON.stringify(id)}] = [function (module, exports, require, __filename, __dirname, Buffer) {`,
      m.source.replace(/\n?$/, "\n"),
      `}, ${JSON.stringify(m.deps)}];`
    );
  }
  parts.push(
    "var __cache = {};",
    "function __load(id) {",
    "  var hit = __cache[id];",
    "  if (hit) return hit.exports;",
    "  var def = __defs[id];",
    '  if (!def) throw new Error("preview bundle: missing module " + id);',
    "  var mod = { id: id, exports: {} };",
    "  __cache[id] = mod;",
    "  var deps = def[1];",
    "  def[0].call(mod.exports, mod, mod.exports, function (spec) {",
    "    var target = deps[spec];",
    '    if (!target) throw new Error("preview bundle: " + id + " cannot require " + spec);',
    "    return __load(target);",
    '  }, id, id.replace(/\\/[^\\/]*$/, ""), id === ' + JSON.stringify(BUFFER_SHIM) + ' ? undefined : __load(' + JSON.stringify(BUFFER_SHIM) + '));',
    "  return mod.exports;",
    "}",
    `var api = __load(${JSON.stringify(ENTRY)});`,
    'if (typeof module === "object" && module && module.exports) module.exports = api;',
    'else if (typeof window !== "undefined" && window.document) api.start(window);',
    "})();",
    ""
  );
  return { code: parts.join("\n"), modules: ids };
}

// ---------------------------------------------------------------------------------------------
// Styles: dark tokens under both theme guards, color-scheme per theme, preview layout overrides
// ---------------------------------------------------------------------------------------------

/** The text between the braces that open at `open` (index of "{"), and the index after "}". */
function braceBlock(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return { inner: css.slice(open + 1, i), end: i + 1 };
    }
  }
  throw new Error("build: unbalanced braces in styles.css");
}

const PREVIEW_CSS = `
/* ---------- preview build overrides (preview/build.js; not part of public/styles.css) ---------- */
/* The host wraps this page and pads :root by the phone's safe areas (env(safe-area-inset-*)), so
   the app fits a height: 100% chain inside that padding instead of the viewport height (100vh /
   100dvh would overflow it). */
html, body { height: 100%; }
body { background: var(--bg); }
#root { height: 100%; min-height: 0; }
.app-shell { height: 100%; }
.boot, .auth, .public-page { min-height: 100%; }
/* Overlays the app fixes to the viewport (the phone drawer and its scrim, the switch menu's bottom
   sheet) are placed against the shell instead, which sits inside the host's padding: layout
   containment makes the shell their containing block. */
.app-shell { contain: layout; }
/* The same for the toasts (the app's .toast-stack and the preview's notes), which are fixed outside
   the shell: while the shell is up (it never scrolls the document) the body, which sits inside the
   host's padding, is their containing block, so a toast 64 px from the top is 64 px below the
   status bar, under the top bar, not over it. Not on the auth screen and the signed-out pages: a
   contained body would stop the document from scrolling them. */
body:has(.app-shell) { contain: layout; }
/* Inside that padding the app's own safe-area insets would count the safe areas twice. */
.composer { padding-bottom: 16px; }
@media (max-width: 560px) {
  .composer { padding-bottom: 12px; }
  .menu, .menu-up { bottom: 12px; }
}
/* The signed-out privacy page scrolls the document in the app. Here it scrolls inside the padding
   instead: its sticky bar then sticks below the status bar, and it opens at its own top (not at
   the auth screen's scroll offset). The auth screen keeps scrolling the document (its phone
   layout is a column-reverse flexbox, which cannot scroll its own overflow). */
.public-page { height: 100%; overflow-y: auto; }
/* Preview only: how to get into the demo account (the app's auth screen knows nothing of it). */
.auth-card > h2 + p.muted::after {
  content: "Gode preview: log in as ${DEPLOYMENT.demo.email} with the password ${DEPLOYMENT.demo.password} for the demo account (it comes back even after Delete everything).";
  display: block;
  margin-top: 10px;
  padding: 9px 12px;
  border: 1px solid var(--accent-soft-border);
  border-radius: var(--r-md);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 13px;
  line-height: 1.45;
}
/* Preview only: the sidebar's "Demo mode: answers come from a built-in test model" (the app's
   config.mock line) would suggest some model writes the answers; no model is called at all. */
.mock-note { font-size: 0; }
/* visibility, not only size: hidden text stays in the accessibility tree, innerText and a copy, so
   a screen reader would still read the test-model line before the preview's. The icon and the
   replacement line stay visible, so they are shown and announced. */
.mock-note { visibility: hidden; }
.mock-note > .icon,
.mock-note::after { visibility: visible; }
.mock-note::after {
  content: "Gode preview: no AI model is called; each answer explains what the live app would do.";
  font-size: 12px;
  line-height: 1.45;
}
/* Preview only: the credit packs look live (as on a server with Stripe), so say before any click
   that no card can be charged here and where free test credit comes from. The app's own line
   under the packs ("You pay securely on Stripe...") would contradict it, so the note replaces it,
   hidden the same way as .mock-note (out of the accessibility tree too). */
.pack-grid + p.muted.small { font-size: 0; visibility: hidden; }
.pack-grid + p.muted.small::after {
  content: "Gode preview: card payments are off; use Developer top-up below for free test credit.";
  visibility: visible;
  display: block;
  margin-top: 0;
  padding: 9px 12px;
  border: 1px solid var(--accent-soft-border);
  border-radius: var(--r-md);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 13px;
  line-height: 1.45;
}
/* The preview's own notes (downloads in the viewer's frame) sit with the app's toasts. */
.preview-notes { z-index: 101; }
`;

function buildStyles(css) {
  const MEDIA = "@media (prefers-color-scheme: dark)";
  const at = css.indexOf(MEDIA);
  if (at < 0) throw new Error("build: styles.css has no prefers-color-scheme: dark block");
  if (css.indexOf(MEDIA, at + MEDIA.length) >= 0) throw new Error("build: styles.css has more than one dark block; teach build.js about it");
  const media = braceBlock(css, css.indexOf("{", at));
  const inner = media.inner.trim();
  const rootOpen = inner.indexOf("{");
  if (!/^:root\s*$/.test(inner.slice(0, rootOpen))) throw new Error("build: the dark block must hold only a :root rule");
  const root = braceBlock(inner, rootOpen);
  if (inner.slice(root.end).trim()) throw new Error("build: the dark block must hold only a :root rule");
  const decls = root.inner.replace(/^\n+|\s+$/g, "");

  const guarded =
    `/* Dark theme (generated by preview/build.js from the block above in public/styles.css): the OS\n` +
    `   preference applies unless the viewer chose light; an explicit dark choice applies anyway. */\n` +
    `${MEDIA} {\n  :root:not([data-theme="light"]) {\n    color-scheme: dark;\n${decls.replace(/^/gm, "  ")}\n  }\n}\n\n` +
    `:root[data-theme="dark"] {\n  color-scheme: dark;\n${decls}\n}\n\n` +
    `:root[data-theme="light"] {\n  color-scheme: light;\n}`;
  let out = css.slice(0, at) + guarded + css.slice(media.end);

  // The base :root declares "light dark", which would let the browser draw dark form controls
  // under an explicit light choice: light by default, dark only through the guarded rules above.
  const base = /(:root\s*\{\s*)color-scheme:\s*light dark;/;
  if (!base.test(out)) throw new Error("build: expected `color-scheme: light dark;` at the top of :root");
  out = out.replace(base, "$1color-scheme: light;");
  return out + PREVIEW_CSS;
}

// ---------------------------------------------------------------------------------------------
// The page fragment
// ---------------------------------------------------------------------------------------------

function buildFragment() {
  const index = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
  const m = /<div id="root">[\s\S]*?\n {4}<\/div>/.exec(index);
  if (!m) throw new Error("build: could not find the #root markup in public/index.html");
  return [
    // The host puts the fragment inside <body>, so no <meta> here (a description and the theme are
    // the host's business); the title is the one element it reads from the fragment.
    "<title>Gode</title>",
    '<link rel="stylesheet" href="styles.css">',
    m[0].replace(/^ {4}/gm, ""),
    "<noscript><p style=\"max-width:32rem;margin:2rem auto;padding:0 1rem;text-align:center\">The Gode preview needs JavaScript.</p></noscript>",
    '<script src="vendor/react.production.min.js"></script>',
    '<script src="vendor/react-dom.production.min.js"></script>',
    '<script src="mock-api.js"></script>',
    '<script src="app.js"></script>',
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

function build({ dir = path.join(PREVIEW, "dist"), quiet = false } = {}) {
  const log = quiet ? () => {} : (...a) => console.log(...a);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "vendor"), { recursive: true });

  const fixture = buildFixture();
  const { code, modules } = bundle({ fixture });
  fs.writeFileSync(path.join(dir, "mock-api.js"), code);

  const appSrc = fs.readFileSync(path.join(ROOT, "public/app.js"));
  fs.writeFileSync(path.join(dir, "app.js"), appSrc);
  if (sha(fs.readFileSync(path.join(dir, "app.js"))) !== sha(appSrc)) throw new Error("build: dist/app.js is not byte-identical to public/app.js");

  for (const f of ["react.production.min.js", "react-dom.production.min.js"]) {
    const src = fs.readFileSync(path.join(ROOT, "public/vendor", f));
    if (!/18\.3\.1/.test(src.toString("utf8"))) throw new Error(`build: public/vendor/${f} is not React 18.3.1`);
    fs.writeFileSync(path.join(dir, "vendor", f), src);
  }

  fs.writeFileSync(path.join(dir, "styles.css"), buildStyles(fs.readFileSync(path.join(ROOT, "public/styles.css"), "utf8")));
  fs.writeFileSync(path.join(dir, "index.html"), buildFragment());

  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push({ file: path.relative(dir, p).split(path.sep).join("/"), bytes: fs.statSync(p).size });
    }
  };
  walk(dir);
  const total = files.reduce((n, f) => n + f.bytes, 0);
  log(`[preview] built ${rel(dir)}/ (${files.length} files, ${(total / 1024).toFixed(0)} KB; mock-api.js bundles ${modules.length} modules)`);
  return { dir, files, total, modules, fixture };
}

if (require.main === module) {
  try {
    build(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
}

module.exports = { build, buildStyles, buildFragment, buildFixture, bundle, scanRequires, DEPLOYMENT, BUILTINS, OVERRIDES };
