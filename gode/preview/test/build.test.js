"use strict";
// The built preview obeys the Artifact host's rules: a page FRAGMENT with relative supporting
// files, the real frontend byte for byte, theme guards generated from the product's dark tokens,
// and a bundle with no Node-only modules, no paths of the build machine and no secrets.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { previewBuild } = require("./helpers");
const { buildStyles, scanRequires, BUILTINS, OVERRIDES } = require("../build");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");

test("index.html is a fragment: title, stylesheet, #root and the scripts in order, all relative", () => {
  const { dir } = previewBuild();
  const html = read(dir, "index.html");
  assert.ok(html.startsWith("<title>Gode</title>"), "starts with its own <title>");
  assert.doesNotMatch(html, /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i, "no document tags: the host adds them");
  assert.match(html, /^<title>Gode<\/title>\n<link rel="stylesheet" href="styles\.css">\n<div id="root">/, "title, then the stylesheet, then #root");
  assert.match(html, /<div id="root">/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "mock-api.js", "app.js"]);
  for (const ref of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])) {
    assert.ok(!ref.startsWith("/") && !/^[a-z]+:/i.test(ref), `relative reference: ${ref}`);
    assert.ok(fs.existsSync(path.join(dir, ref)), `published file exists: ${ref}`);
  }
  assert.doesNotMatch(html, /<script>|\son[a-z]+=/i, "no inline scripts or handlers (the CSP refuses them)");
  assert.ok(!fs.existsSync(path.join(dir, "privacy.html")), "privacy.html is not shipped");
});

test("app.js is byte-identical to public/app.js; React is the vendored 18.3.1", () => {
  const { dir } = previewBuild();
  assert.ok(fs.readFileSync(path.join(dir, "app.js")).equals(fs.readFileSync(path.join(ROOT, "public/app.js"))));
  for (const f of ["react.production.min.js", "react-dom.production.min.js"]) {
    assert.ok(fs.readFileSync(path.join(dir, "vendor", f)).equals(fs.readFileSync(path.join(ROOT, "public/vendor", f))));
  }
});

test("styles: the product's dark tokens apply under both theme guards, with color-scheme per theme", () => {
  const { dir } = previewBuild();
  const css = read(dir, "styles.css");
  const source = fs.readFileSync(path.join(ROOT, "public/styles.css"), "utf8");
  const darkBlock = /@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}\n\}/.exec(source);
  assert.ok(darkBlock, "the product's dark block");
  const tokens = [...darkBlock[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
  assert.ok(tokens.length > 20);

  const guarded = /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}\n\}/.exec(css);
  const explicit = /:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(guarded && explicit, "both guarded selectors are present");
  for (const block of [guarded[1], explicit[1]]) {
    assert.match(block, /color-scheme: dark;/);
    for (const [name, value] of tokens) assert.ok(block.includes(`${name}: ${value};`), `${name} carried over`);
  }
  assert.match(css, /:root\[data-theme="light"\] \{\s*color-scheme: light;/);
  assert.doesNotMatch(css, /@media \(prefers-color-scheme: dark\) \{\s*:root \{/, "no unguarded dark block left");
  assert.match(css, /^:root \{\s*color-scheme: light;/m, "light by default");
  assert.match(css, /\.app-shell \{ height: 100%; \}/, "the shell fits a height: 100% chain");
  assert.match(css, /\.app-shell \{ contain: layout; \}/, "fixed overlays are placed against the shell, inside the host's padding");
  assert.match(css, /\.composer \{ padding-bottom: 16px; \}/, "no second safe-area inset under the composer");
  // The preview's honest notes: no model writes the answers, and no card can be charged.
  assert.match(css, /\.mock-note \{ font-size: 0; \}\n/);
  // Hidden from the accessibility tree too (visibility), with the icon and the preview line shown.
  assert.match(css, /\.mock-note \{ visibility: hidden; \}\n\.mock-note > \.icon,\n\.mock-note::after \{ visibility: visible; \}\n\.mock-note::after \{\n  content: "Gode preview: no AI model is called; each answer explains what the live app would do\.";/);
  // Toasts are placed inside the host's safe-area padding, like the shell's overlays, but only while
  // the shell is up: a contained body would stop the auth screen from scrolling the document.
  assert.match(css, /\nbody:has\(\.app-shell\) \{ contain: layout; \}\n/);
  assert.doesNotMatch(css, /\nbody \{ contain:/);
  assert.match(css, /\.pack-grid \+ p\.muted\.small::after \{\n  content: "Gode preview: card payments are off; use Developer top-up below for free test credit\.";/);
});

test("buildStyles refuses a stylesheet it does not understand instead of guessing", () => {
  assert.throws(() => buildStyles(":root { color-scheme: light dark; }"), /no prefers-color-scheme/);
  assert.throws(() => buildStyles(":root{color-scheme: light dark;}\n@media (prefers-color-scheme: dark) { .x { color: red } }"), /only a :root rule/);
});

test("mock-api.js: only browser-safe modules, no build-machine paths, no secrets", () => {
  const { dir, result } = previewBuild();
  const code = read(dir, "mock-api.js");
  for (const id of result.modules) {
    assert.ok(id.startsWith("src/") || id.startsWith("preview/src/") || id === "preview:fixture", `bundled module ${id}`);
  }
  for (const routes of ["auth", "me", "conversations", "chat", "models", "public", "billing", "admin"]) {
    assert.ok(result.modules.includes(`src/routes/${routes}.js`), `src/routes/${routes}.js is bundled unchanged`);
  }
  assert.ok(result.modules.includes("src/router/learn.js"), "the real learner");
  for (const banned of ["src/db.js", "src/app.js", "src/config.js", "src/billing/stripe.js", "src/providers/index.js", "src/routes/media.js"]) {
    assert.ok(!result.modules.includes(banned), `${banned} is not in the bundle`);
  }
  // Every bundled module's requires resolve to bundled modules or the shims (no fs, http, ...).
  for (const id of result.modules.filter((m) => m.startsWith("src/") && !OVERRIDES[m])) {
    for (const spec of scanRequires(fs.readFileSync(path.join(ROOT, id), "utf8"))) {
      if (!spec.startsWith(".")) assert.ok(Object.prototype.hasOwnProperty.call(BUILTINS, spec.replace(/^node:/, "")), `${id} requires ${spec}`);
    }
  }
  assert.ok(!code.includes(ROOT), "no absolute path of the build machine");
  assert.doesNotMatch(code, /sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/, "no Stripe keys");
  const fixture = result.fixture;
  assert.equal(fixture.config.mock, true);
  assert.equal(fixture.config.billing.margin, 0.3);
  assert.equal(fixture.config.billing.signupCreditUsd, 0.25);
  assert.equal(fixture.config.router.privateFallback, "zdr");
  assert.equal(fixture.config.gateways.openrouter.apiKey, "");
  assert.ok(!("rootDir" in fixture.config) && !("masterKey" in fixture.config));
});

test("the whole preview is far below the host's 16 MB limit", () => {
  const { result } = previewBuild();
  assert.ok(result.total < 4 * 1024 * 1024, `total ${result.total} bytes`);
});
