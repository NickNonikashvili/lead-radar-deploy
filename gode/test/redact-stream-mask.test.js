// The streaming high-risk masker never shows a value the final filter would mask, also when its
// first group is glued to punctuation ("IBAN:GB82 ..."): that group must stay held, or the value
// begins in text already shown and stays on screen until the final `replace`.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const redact = require("../src/redact");

const EMPTY_MAP = { byPlaceholder: {}, byValue: {}, counters: {} };
const TAIL = " and more text: that is the account the payment goes to, please check every digit.";

/** Stream `full` in `size`-char chunks; return what was shown and the first prefix that leaked. */
function stream(full, size) {
  const sr = redact.createStreamRestorer(EMPTY_MAP, { maskHighRisk: true });
  let shown = "";
  let leaked = null;
  for (let i = 0; i < full.length; i += size) {
    shown += sr.push(full.slice(i, i + size));
    if (leaked === null && Object.keys(redact.filterResponse(shown, EMPTY_MAP).masked).length) leaked = shown;
  }
  shown += sr.flush();
  return { shown, leaked };
}

for (const value of [
  "IBAN:GB82 WEST 1234 5698 7654 32",
  "IBAN.GB82 WEST 1234 5698 7654 32",
  "(GB82 WEST 1234 5698 7654 32)",
  "card:4539 1488 0343 6467",
  "(4539 1488 0343 6467)",
  "SSN:123-45-6789",
]) {
  test(`no prefix shown while streaming ever holds a whole value: ${value}`, () => {
    for (let size = 1; size <= 8; size++) {
      const { shown, leaked } = stream(value + TAIL, size);
      assert.equal(leaked, null, `chunk size ${size}: visible while streaming: ${JSON.stringify(leaked)}`);
      assert.ok(shown.includes("[redacted"), `chunk size ${size}: masked in the end: ${shown}`);
      assert.ok(shown.endsWith(TAIL), "the text after it is all there");
    }
  });
}

test("ordinary text glued to punctuation is still released (only short digit groups are held)", () => {
  const sr = redact.createStreamRestorer(EMPTY_MAP, { maskHighRisk: true });
  const out = sr.push("Note:this is fine and so is that ");
  assert.equal(out, "Note:this is fine and so is that ");
  assert.equal(sr.flush(), "");
});
