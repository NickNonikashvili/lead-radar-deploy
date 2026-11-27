"use strict";
// The preview's written answers and captions explain what the live app would do. These checks run
// the real pipeline in the simulated backend and hold each explanation to the routing decision it
// describes: why this model (a switch, a pin, the plan's column, a filter), who classified the
// message and why, what the chip's cost is made of, the effort of on/off models, and the samples.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { previewBackend, previewClient } = require("./helpers");
const { formatCost } = require("../../src/chat/pipeline");

const ev = (x, name) => (x.events.find((e) => e.event === name) || {}).data;
/** The answer as the viewer ends up seeing it: the caption (media) or the streamed text. */
const answer = (x) => (ev(x, "replace") ? ev(x, "replace").text : x.events.filter((e) => e.event === "delta").map((e) => e.data.text).join(""));
/** Same rounding as costLine in preview/src/answers.js. */
const usd = (v) => {
  const m = Math.round(v * 1e6);
  return `$${m < 10_000 ? String(Number((m / 1e6).toPrecision(3))) : String(Number((m / 1e6).toFixed(4)))}`;
};

async function setup() {
  const b = await previewBackend();
  return { b, c: previewClient(b) };
}

test("a media caption gives the real reason: a switch, a regenerate, a pinned follow-up after a plan change", async () => {
  const { c } = await setup();
  const first = await c.sse("/api/chat", { text: "Draw a picture of a blue whale" });
  assert.match(answer(first), /would make it: the balanced pick for image on your Balanced plan\./);
  const route = ev(first, "route");
  const menu = await c.json("GET", `/api/models?job=image&conversation_id=${route.conversation_id}`);
  const other = menu.body.models.find((m) => m.id !== route.model.id);
  const switched = await c.sse(`/api/messages/${route.message_id}/switch`, { model_id: other.id });
  assert.match(answer(switched), /you picked it from the switch menu, so it is pinned for this chat\./);
  assert.doesNotMatch(answer(switched), /pick for image on your/);
  const regen = await c.sse(`/api/messages/${ev(switched, "route").message_id}/regenerate`, {});
  assert.match(answer(regen), /regenerated with the model pinned to this chat \(your pick\)\./);
  await c.json("PATCH", "/api/me", { plan: "best" });
  const follow = await c.sse("/api/chat", { conversation_id: route.conversation_id, text: "Now draw it at night" });
  assert.equal(ev(follow, "route").model.id, other.id);
  assert.match(answer(follow), /one model per chat, and this conversation is pinned to it \(your pick\)\./);
  assert.doesNotMatch(answer(follow), /budget pick|Best plan/);
});

test("the cost line adds up to the charge: the answer, the classifier's read, then the margin", async () => {
  const { c } = await setup();
  const res = await c.sse("/api/chat", { text: "Explain gravity in one sentence." });
  const done = ev(res, "done");
  const text = answer(res);
  assert.equal(ev(res, "route").classified_outside, true);
  assert.match(text, /the classifier's read of the message \(DeepSeek V4\.1 Flash\) adds \$0\.0000\d+/);
  // The total is written the way the chip shows it, and the chip shows it.
  assert.ok(text.includes(`that is ${formatCost(done.cost_usd)} in all, as on the chip`), `${formatCost(done.cost_usd)} in: ${text.slice(-400)}`);
  assert.ok(done.chip.endsWith(` · ${formatCost(done.cost_usd)}`), done.chip);
  assert.ok(usd(done.cost_usd));
});

test("Strict privacy and EU-only: the right reasons for the model, the in-house classifier and an on/off effort", async () => {
  const { c } = await setup();
  await c.json("PATCH", "/api/me", { plan: "best", strict_privacy: true, eu_only: true });
  const text = answer(await c.sse("/api/chat", { text: "Explain how a refrigerator works." }));
  assert.match(text, /\(Strict privacy and EU-only are on\)/);
  assert.match(text, /Classified by:\*\* Gode's own rules, on our servers: EU-only is on, and the classifier model \(DeepSeek V4\.1 Flash\) doesn't meet it/);
  assert.doesNotMatch(text, /our checks call private/);
  assert.match(text, /Mistral Large 4 only has thinking on or off, and anything above none runs as high/);
  assert.doesNotMatch(text, /nearest level Mistral Large 4 runs/);
});

test("EU-only with no routed pick usable: the model is chosen by price, and the answer says so", async () => {
  const { c } = await setup();
  await c.json("PATCH", "/api/me", { plan: "saver", eu_only: true });
  const res = await c.sse("/api/chat", { text: "Write a bash script to back up my home folder to an external drive." });
  assert.equal(ev(res, "route").model.label, "Mistral Large 4");
  const text = answer(res);
  assert.match(text, /no routed pick for code can be used here \(EU-only is on\), so the cheapest model that qualifies answers \(your Saver plan at difficulty 3 asks for the budget column\)/);
  assert.doesNotMatch(text, /the budget pick for code/);
});

test("private because of an ID number: said so, not 'health, money, legal matters'", async () => {
  const { c } = await setup();
  const res = await c.sse("/api/chat", { text: "Help me write a cover letter for a bakery job. My SSN is 123-45-6789." });
  assert.equal(ev(res, "route").private, true);
  const text = answer(res);
  assert.match(text, /Private: it contains 1 ID number, and that alone makes a request private\./);
  assert.doesNotMatch(text, /health, money, legal/);
  // The placeholder form is named without a number, so the restorer leaves it alone.
  assert.match(text, /placeholders of the form \[SSN_n\], shown here as ‹ID 1›/);
  assert.ok(!text.includes("123-45-6789"), "the note's [SSN_n] is not filled back in");
});

test("contact details after 'email' are chat, not an Action job", async () => {
  const { c } = await setup();
  const res = await c.sse("/api/chat", { text: "My name is Jane Roe, email jane@example.org. I am pregnant, what should I avoid?" });
  assert.equal(ev(res, "route").job, "chat");
  assert.doesNotMatch(answer(res), /Action:|Job:\*\* Action/);
});

test("code samples: a word-boundary comment, a task name, the right language", async () => {
  const { c } = await setup();
  const js = answer(await c.sse("/api/chat", { text: "Write a JavaScript function that debounces another function, with a short explanation." }));
  // A debounce is real code (written by the preview), with the parameters a debounce takes.
  assert.match(js, /A real answer would look like this \(written by the preview, not by a model\):\n\n```javascript\n\/\/ Write a JavaScript function that debounces another function, with a…\n/);
  assert.match(js, /export function debounce\(fn, waitMs = 250\) \{\n  let timer;\n  return \(\.\.\.args\) => \{\n    clearTimeout\(timer\);\n    timer = setTimeout\(\(\) => fn\(\.\.\.args\), waitMs\);/);
  const html = answer(await c.sse("/api/chat", { text: "What does <img src=x onerror=alert(1)> do in **HTML**?" }));
  assert.match(html, /```html\n<!-- What does <img src=x onerror=alert\(1\)> do in HTML\? -->/);
  assert.doesNotMatch(html, /```python/);
  const list = answer(await c.sse("/api/chat", { text: "How do I reverse a linked list in JavaScript?" }));
  assert.match(list, /export function reverseLinkedList\(items\)/);
  // A model without a thinking setting: one clean clause.
  assert.match(list, /Effort:\*\* no thinking \(Qwen3-Coder-Next has no thinking setting\)/);
});

test("the seeded photo renamer never renames a file twice or stacks suffixes", async () => {
  const { c } = await setup();
  const convs = (await c.json("GET", "/api/conversations")).body.conversations;
  const code = convs.find((x) => /Python script/.test(x.title));
  const msgs = (await c.json("GET", `/api/conversations/${code.id}`)).body.messages;
  const text = msgs[msgs.length - 1].text;
  assert.match(text, /stem, suffix = when\.strftime\("%Y-%m-%d_%H-%M-%S"\), path\.suffix\.lower\(\)/);
  assert.match(text, /while target\.exists\(\) and target != path:/);
  assert.match(text, /target = path\.with_name\(f"\{stem\}_\{n\}\{suffix\}"\)/);
  assert.match(text, /if target == path:\n\s+continue/);
  assert.doesNotMatch(text, /target\.stem/);
});

test("a mid-stream failure keeps a clean first sentence and a neutral detail line", async () => {
  const { c } = await setup();
  const res = await c.sse("/api/chat", { text: "Please answer this GODE_MOCK_FAIL_MIDSTREAM thanks" });
  assert.equal(answer(res), "**This is the Gode preview: no AI model was called.**");
  const err = ev(res, "error");
  assert.equal(err.code, "upstream_error");
  assert.equal(err.error, "The provider stopped responding mid-answer (simulated in this preview).");
});

test("media captions: no false 'swapped' claim, and a video frame says no video model was called", async () => {
  const { c } = await setup();
  const priv = await c.sse("/api/chat", { text: "Make a picture of me at my therapy session talking about my depression." });
  assert.equal(ev(priv, "route").private, true);
  assert.doesNotMatch(answer(priv), /were swapped/);
  assert.match(answer(priv), /Treated as private; nothing personal was found to take out\./);
  const video = await c.sse("/api/chat", { text: "A 5-second video of waves rolling onto a beach at sunset." });
  const svg = Buffer.from(ev(video, "media").url.split(",")[1], "base64").toString("utf8");
  assert.match(svg, /no video model was called/);
  assert.doesNotMatch(svg, /no image model/);
});

test("code samples in the language asked for: Go, C, C++, C#, Kotlin, Swift, PHP, Ruby, never a Python stand-in", async () => {
  const { detectLanguage, sampleContent } = require("../src/answers");
  const cases = [
    ["Write a C++ function to sort an array of integers", "cpp", /```cpp\n\/\/ Write a C\+\+ function to sort an array of integers\n#include <iostream>\n#include <vector>\n\nvoid sortArrayIntegers\(const std::vector<int>& items\) \{[\s\S]*sortArrayIntegers\(\{3, 1, 2\}\);/],
    ["Write a Go function that reverses a linked list", "go", /```go\n\/\/ Write a Go function that reverses a linked list\npackage main\n\nfunc reverseLinkedList\(items \[\]int\) \{\n\t\/\/ .*\n\}\n\nfunc main\(\) \{\n\treverseLinkedList\(\[\]int\{3, 1, 2\}\)\n\}/],
    ["Write a Go program that prints the time", "go", /```go\n/],
    ["Write code in Go to read a file line by line", "go", /func readFile\w*\(path string\)/],
    ["Write a C function that reverses a string", "c", /```c\n\/\/ .*\n#include <stdio.h>\n\nvoid reverse_string\(const char \*s\) \{/],
    ["Write a C# method that parses a date", "csharp", /```csharp\n[\s\S]*static void ParseDate\(string value\)/],
    ["Write a Kotlin function to sum a list", "kotlin", /```kotlin\n[\s\S]*fun sumList\(items: List<Int>\) \{/],
    ["Write a Swift function that checks if a number is prime", "swift", /```swift\n[\s\S]*func isPrime\(_ n: Int\) -> Bool \{[\s\S]*print\(isPrime\(42\)\)/],
    ["Write a PHP function to slugify a title", "php", /```php\n<\?php\n[\s\S]*function slugifyTitle\(string \$value\): void/],
    ["Write a Ruby method that checks if a string is a palindrome", "ruby", /```ruby\n[\s\S]*def palindrome\?\(s\)\n[\s\S]*puts palindrome\?\("racecar"\)/],
    ["Write a Haskell function for the Fibonacci numbers", "haskell", /```haskell\n-- Write a Haskell function for the Fibonacci numbers\n-- the live model writes the real implementation here\n```/],
    ["Write a function in R to plot a histogram", "r", /```r\n# /],
  ];
  for (const [text, lang, shape] of cases) {
    assert.equal(detectLanguage(text), lang, text);
    const body = sampleContent({ job: "code", text }).body;
    assert.match(body, shape, text);
    assert.doesNotMatch(body, /```python|\bdef \w+\(\) -> None/, `${text}: no Python stand-in`);
  }
  // Plain words are not languages: "go about", "a quick c", "R&D".
  assert.equal(detectLanguage("How do I go about writing a function that sorts names?"), "python");
  assert.equal(detectLanguage("Write a function that grades the R&D budget"), "python");
});

test("code samples: a yes-or-no task is named like one, and the request's own words name the rest", async () => {
  const { sampleContent, taskWords } = require("../src/answers");
  assert.deepEqual(taskWords("Write a Python function that checks if a string is a palindrome"), ["is", "palindrome"]);
  assert.deepEqual(taskWords("Write a function that checks whether an email is valid"), ["is", "valid", "email"]);
  assert.deepEqual(taskWords("a function to check if a year is a leap year"), ["is", "leap", "year"]);
  const py = sampleContent({ job: "code", text: "Write a Python function that checks if a string is a palindrome" }).body;
  // The function takes the thing it checks, and the call under it passes one.
  assert.match(py, /def is_palindrome\(s: str\) -> bool:/);
  assert.match(py, /print\(is_palindrome\("racecar"\)\)/);
  const ts = sampleContent({ job: "code", text: "Write a TypeScript function that checks if a number is prime" }).body;
  assert.match(ts, /export function isPrime\(n: number\): boolean \{\n  \/\/ .*\n  return false;\n\}/);
});

test("SQL and JavaScript samples look like the start of a real answer, never 'SELECT 1' or an empty debounce", async () => {
  const { c } = await setup();
  const dup = answer(await c.sse("/api/chat", { text: "Write a SQL query that finds duplicate emails in a users table" }));
  assert.match(dup, /```sql\n-- Write a SQL query that finds duplicate emails in a users table\nSELECT email, COUNT\(\*\) AS copies\nFROM users\nGROUP BY email\nHAVING COUNT\(\*\) > 1\nORDER BY copies DESC;\n```/);
  assert.doesNotMatch(dup, /SELECT 1/);
  const { sampleContent } = require("../src/answers");
  const list = sampleContent({ job: "code", text: "Write a SQL query to list last month's orders from the orders table" }).body;
  assert.match(list, /FROM orders\nWHERE/);
  assert.doesNotMatch(list, /SELECT 1/);
  const js = sampleContent({ job: "code", text: "Write a JavaScript function to debounce a callback" });
  assert.match(js.intro, /written by the preview, not by a model/);
  assert.match(js.body, /export function debounce\(fn, waitMs = 250\)/);
  const thr = sampleContent({ job: "code", text: "Write a TypeScript throttle function" }).body;
  assert.match(thr, /export function throttle<A extends unknown\[\]>\(fn: \(\.\.\.args: A\) => void, waitMs = 250\): \(\.\.\.args: A\) => void \{/);
});

test("an Action answer says why the Chat row picked its model", async () => {
  const { c } = await setup();
  const res = await c.sse("/api/chat", { text: "Email bob@example.com and tell him the meeting moved to 3pm" });
  assert.equal(ev(res, "route").job, "action");
  assert.match(answer(res), /pick for chat at difficulty \d on your Balanced plan \(action requests use the Chat row in phase 1\)/);
});

test("a private picture's caption ends the quoted prompt with a full stop before 'Treated as private'", async () => {
  const { c } = await setup();
  const res = await c.sse("/api/chat", { text: "Draw a watercolor of me at the clinic after I was diagnosed with diabetes" });
  assert.equal(ev(res, "route").private, true);
  assert.match(answer(res), /diagnosed with diabetes”\. Treated as private; nothing personal was found to take out\.$/);
});

test("manual mode: a media request answered in text by a hand-picked model says why, and how to get the media", async () => {
  const { c } = await setup();
  await c.json("PATCH", "/api/me", { auto_pick: false });
  const models = (await c.json("GET", "/api/models?job=chat")).body.models;
  const opus = models.find((m) => /Claude Opus/.test(m.label)) || models[0];
  const res = await c.sse("/api/chat", { text: "Make a 5-second video of waves rolling onto a beach at sunset", model_id: opus.id });
  assert.equal(ev(res, "route").job, "chat");
  const text = answer(res);
  assert.match(text, new RegExp(`- \\*\\*No video:\\*\\* your message asks for a video, but auto-pick is off and ${opus.label.replace(/[.()]/g, "\\$&")} only writes text, so the live app answers in text\\. Turn auto-pick on in Settings to get a video\\.`));
  // A text request in manual mode has no such line.
  assert.doesNotMatch(answer(await c.sse("/api/chat", { text: "Explain tides", model_id: opus.id })), /No video|No image|auto-pick is off and .* only writes text/);
});

test("code samples for everyday requests: a regex literal, steps for an error, a top-N query", async () => {
  const { sampleContent } = require("../src/answers");
  const regex = sampleContent({ job: "code", text: "Write a regex that matches a UK postcode" });
  assert.match(regex.intro, /written by the preview, not by a model/);
  assert.match(regex.body, /UK_POSTCODE = re\.compile\(r"\^\[A-Z\]\{1,2\}\[0-9\]\[A-Z0-9\]\? \?\[0-9\]\[A-Z\]\{2\}\$", re\.IGNORECASE\)\n\nprint\(bool\(UK_POSTCODE\.match\("SW1A 1AA"\)\)\)  # True/);
  assert.doesNotMatch(regex.body, /def regex\(/);
  const js = sampleContent({ job: "code", text: "Write a regex in JavaScript that matches an email address" }).body;
  assert.match(js, /const EMAIL = \/.+\/;\n\nconsole\.log\(EMAIL\.test\("name@example\.com"\)\); \/\/ true/);
  const fix = sampleContent({ job: "code", text: "How do I fix a TypeError: Cannot read properties of undefined in React?" });
  assert.match(fix.body, /^1\. The stack trace names the line/);
  assert.match(fix.body, /```jsx\n[\s\S]*<p>\{user\.name\}<\/p>[\s\S]*<p>\{user\?\.name \?\? ''\}<\/p>/);
  assert.doesNotMatch(fix.body, /function fix/i);
  const sql = sampleContent({ job: "code", text: "Write a SQL query that finds the top 5 customers by total order value" }).body;
  assert.match(sql, /SELECT c\.id, c\.name, SUM\(o\.total\) AS total_order_value\nFROM customers AS c\nJOIN orders AS o ON o\.customer_id = c\.id\nGROUP BY c\.id, c\.name\nORDER BY total_order_value DESC\nLIMIT 5;/);
  const go = sampleContent({ job: "code", text: "Write a Go function that checks if a string is a palindrome" }).body;
  assert.match(go, /func isPalindrome\(s string\) bool \{[\s\S]*fmt\.Println\(isPalindrome\("racecar"\)\)/);
});

test("the private sample names its topic, and a zero-retention request does not read as sent to the vendor's country", async () => {
  const { c } = await setup();
  const convs = (await c.json("GET", "/api/conversations")).body.conversations;
  const priv = convs.find((x) => /Sam Carter/.test(x.title));
  const msgs = (await c.json("GET", `/api/conversations/${priv.id}`)).body.messages;
  const text = msgs.filter((m) => m.request && m.request.private).pop().text;
  assert.match(text, /Privacy:\*\* Private: it is about someone's health \(“[a-z]+”(?:, “[A-Za-z]+”)?\)\./);
  assert.doesNotMatch(text, /health, money, legal matters or secrets/);
  assert.match(text, /Model:\*\* DeepSeek V4\.1 Flash \(DeepSeek; through its zero-retention hosts only, which the privacy page names\)/);
  assert.doesNotMatch(text, /\(DeepSeek, China\)/);
  // An ordinary request still says where the model may run.
  const plain = answer(await c.sse("/api/chat", { text: "Explain tides in two sentences." }));
  assert.match(plain, /DeepSeek V4\.1 Flash \(DeepSeek, China\)/);
});

test("'Read it aloud': the voice model would get only the words to say", async () => {
  const { c } = await setup();
  const res = await c.sse("/api/chat", { text: "Read this aloud in a warm voice: Good morning, everyone, and welcome!" });
  assert.equal(ev(res, "route").job, "voice");
  assert.match(answer(res), /It would get: “Good morning, everyone, and welcome!”/);
  assert.doesNotMatch(answer(res), /would get: “Read this aloud/);
});
