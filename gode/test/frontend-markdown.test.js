// public/app.js markdown-lite: the block and inline parser that renders model answers. Model output
// is untrusted, so besides the formatting cases these pin the safety rules: no raw HTML, no unsafe
// link schemes, and images in model text are never loaded (they become links).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// app.js runs on the vendored React UMD build; in node it exports its pure helpers instead of
// mounting (see the `lib` object at its end).
globalThis.React = require(path.join(__dirname, "..", "public", "vendor", "react.production.min.js"));
const { parseBlocks, parseInline } = require("../public/app.js");

const text = (v) => ({ t: "text", v });

test("a fence inside a list item is a code block in that item, not literal ``` text", () => {
  const [ol] = parseBlocks("1. Install the tool:\n   ```bash\n   npm install gode\n   ```\n2. Run it");
  assert.equal(ol.type, "ol");
  assert.equal(ol.items.length, 2);
  assert.deepEqual(ol.items[0], [
    { type: "p", text: "Install the tool:" },
    { type: "code", lang: "bash", code: "npm install gode", closed: true },
  ]);
  assert.deepEqual(ol.items[1], [{ type: "p", text: "Run it" }]);
  // Two-space indent under "- " too.
  const [ul] = parseBlocks("- Install:\n  ```sh\n  npm i\n  ```\n- Done");
  assert.equal(ul.items[0][1].type, "code");
  assert.equal(ul.items[0][1].code, "npm i");
});

test("a fence with an info string is a fence; its lines are code, and the rest of the answer survives", () => {
  const blocks = parseBlocks('```python title="x.py"\n# not a heading\nprint(1)\n```\nAfter the code.');
  assert.deepEqual(blocks, [
    { type: "code", lang: "python", code: "# not a heading\nprint(1)", closed: true },
    { type: "p", text: "After the code." },
  ]);
  assert.equal(parseBlocks("```shell script\nls\n```")[0].lang, "shell");
  // The closing fence must be at least as long as the opener; a shorter one is content.
  const [long] = parseBlocks("````md\n```\ninner\n```\n````");
  assert.equal(long.code, "```\ninner\n```");
  assert.equal(long.closed, true);
  // A backtick "fence" whose info string has a backtick is inline code, not a fence.
  assert.equal(parseBlocks("```x``` and more")[0].type, "p");
  // Mid-stream: an unclosed fence runs to the end, marked open.
  assert.deepEqual(parseBlocks("```js\nlet a"), [{ type: "code", lang: "js", code: "let a", closed: false }]);
});

test("GFM tables become table blocks with alignment; a half-received table stays text", () => {
  const [t] = parseBlocks("| Name | Qty |\n|:-----|:---:|\n| Apples | 3 |\n| Pears |");
  assert.deepEqual(t, { type: "table", align: ["left", "center"], head: ["Name", "Qty"], rows: [["Apples", "3"], ["Pears", ""]] });
  // Header without its delimiter row (still streaming): plain text.
  assert.deepEqual(parseBlocks("| Name | Qty |"), [{ type: "p", text: "| Name | Qty |" }]);
  // Column counts must match, and escaped pipes stay in the cell.
  assert.equal(parseBlocks("a | b\n---")[0].type, "p");
  assert.deepEqual(parseBlocks("a | b\n--|--\nx \\| y | z")[0].rows, [["x | y", "z"]]);
});

test("nested lists nest instead of flattening; loose lists and lazy continuation work", () => {
  const [ul] = parseBlocks("- a\n  - nested a\n  - nested b\n- b");
  assert.equal(ul.items.length, 2);
  assert.equal(ul.items[0][1].type, "ul");
  assert.deepEqual(ul.items[0][1].items, [[{ type: "p", text: "nested a" }], [{ type: "p", text: "nested b" }]]);
  // Two-space nesting under "1." (content at column 3) is a child too.
  const [ol] = parseBlocks("1. one\n  - sub\n2. two");
  assert.equal(ol.items.length, 2);
  assert.equal(ol.items[0][1].type, "ul");
  const loose = parseBlocks("- a\n\n- b\n\nafter");
  assert.equal(loose[0].items.length, 2);
  assert.equal(loose[0].tight, false);
  assert.deepEqual(loose[1], { type: "p", text: "after" });
  assert.deepEqual(parseBlocks("- item text\ncontinues here")[0].items[0], [{ type: "p", text: "item text\ncontinues here" }]);
  assert.equal(parseBlocks("3. three\n4. four")[0].start, 3);
});

test("quotes hold blocks; hostile nesting depth is bounded", () => {
  const [q] = parseBlocks("> # Title\n> - x");
  assert.equal(q.type, "quote");
  assert.deepEqual(q.blocks.map((b) => b.type), ["h", "ul"]);
  // 2000 levels of nesting must not overflow the stack.
  assert.doesNotThrow(() => parseBlocks(">".repeat(2000) + " deep"));
  assert.doesNotThrow(() => parseBlocks(Array.from({ length: 300 }, (_, i) => " ".repeat(i * 2) + "- x").join("\n")));
});

test("links keep balanced parentheses (Wikipedia) and never take unsafe schemes", () => {
  assert.deepEqual(parseInline("[Wiki](https://en.wikipedia.org/wiki/Foo_(bar)) end"), [
    { t: "link", href: "https://en.wikipedia.org/wiki/Foo_(bar)", children: [text("Wiki")] },
    text(" end"),
  ]);
  assert.deepEqual(parseInline("see https://en.wikipedia.org/wiki/Foo_(bar)."), [
    text("see "),
    { t: "link", href: "https://en.wikipedia.org/wiki/Foo_(bar)", children: [text("https://en.wikipedia.org/wiki/Foo_(bar)")] },
    text("."),
  ]);
  assert.deepEqual(parseInline("[x](javascript:alert(1))"), [text("[x](javascript:alert(1))")]);
  assert.deepEqual(parseInline('[t](https://a.test "title")')[0].href, "https://a.test");
  // Raw HTML is just text (React escapes it when rendering).
  assert.deepEqual(parseInline("<img src=x onerror=alert(1)>"), [text("<img src=x onerror=alert(1)>")]);
});

test("images in model text are links, never loaded", () => {
  assert.deepEqual(parseInline("![cat](https://x.test/c.png)"), [{ t: "link", href: "https://x.test/c.png", children: [text("Image: cat")] }]);
  assert.deepEqual(parseInline("![](https://x.test/c.png)")[0].children, [text("Image")]);
  // An image with an unsafe URL is plain text.
  assert.deepEqual(parseInline("![x](data:image/png;base64,AAAA)"), [text("![x](data:image/png;base64,AAAA)")]);
  const all = JSON.stringify(parseBlocks("Here: ![a](https://t.test/a.png)").map((b) => parseInline(b.text)));
  assert.ok(!/"t":"img"|"image"/.test(all));
});

test("emphasis needs word boundaries; backslash escapes are literal", () => {
  assert.deepEqual(parseInline("Compute 2*x + 3*y"), [text("Compute 2*x + 3*y")]);
  assert.deepEqual(parseInline("a \\*literal\\* b"), [text("a *literal* b")]);
  assert.deepEqual(parseInline("snake_case_name and __init__"), [text("snake_case_name and __init__")]);
  assert.deepEqual(parseInline("a *em* b"), [text("a "), { t: "em", children: [text("em")] }, text(" b")]);
  assert.deepEqual(parseInline("(*a*)"), [text("("), { t: "em", children: [text("a")] }, text(")")]);
  assert.deepEqual(parseInline("_u_"), [{ t: "em", children: [text("u")] }]);
  assert.deepEqual(parseInline("**bold** ~~gone~~"), [
    { t: "strong", children: [text("bold")] },
    text(" "),
    { t: "del", children: [text("gone")] },
  ]);
  assert.deepEqual(parseInline("``a ` b`` and `c`"), [{ t: "code", v: "a ` b" }, text(" and "), { t: "code", v: "c" }]);
});
