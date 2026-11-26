"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { detectBuiltin, luhnValid, ibanValid, ssnValid, resolveOverlaps } = require("../src/redact/patterns");
const { createPresidioClient, labelForPresidioType, PresidioError } = require("../src/redact/presidio");
const { createRedactor, normalizeValue, HIGH_RISK_TYPES } = require("../src/redact");

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

/** [type, value] pairs found by the built-in recognizers. */
const found = (text) => detectBuiltin(text).map((e) => [e.type, e.value]);
const ofType = (text, type) => detectBuiltin(text).filter((e) => e.type === type).map((e) => e.value);

function quietLogger() {
  const lines = { warn: [], info: [] };
  return { lines, warn: (m) => lines.warn.push(String(m)), info: (m) => lines.info.push(String(m)) };
}

const plainRedactor = () => createRedactor({ privacy: {} }, { logger: quietLogger() });

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

/** Minimal Presidio /analyze + /health stub. `handler(body, req)` returns { status, json } or a raw body. */
function startStub(handler) {
  const state = { requests: [] };
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const entry = { method: req.method, url: req.url, headers: req.headers, raw };
      state.requests.push(entry);
      if (req.method === "GET" && req.url === "/health") {
        const up = state.healthy !== false;
        res.writeHead(up ? 200 : 503, { "content-type": "text/html; charset=utf-8" });
        return res.end(up ? "Presidio Analyzer service is up" : "down");
      }
      let body = null;
      try {
        body = JSON.parse(raw);
      } catch {
        /* the handler decides */
      }
      const out = await handler(body, req, state);
      if (out === "HANG") return; // never answer: exercises the client timeout
      res.writeHead(out.status || 200, { "content-type": "application/json" });
      res.end(typeof out.raw === "string" ? out.raw : JSON.stringify(out.json));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      state.url = `http://127.0.0.1:${server.address().port}`;
      state.close = () => new Promise((r) => server.close(r));
      state.server = server;
      resolve(state);
    });
  });
}

/** Presidio-style result for the first occurrence of `value` in `text` (code point offsets). */
function presidioHit(text, value, entity_type, score = 0.85) {
  const idx = text.indexOf(value);
  assert.ok(idx >= 0, `fixture: ${value} not in text`);
  const start = [...text.slice(0, idx)].length;
  return { analysis_explanation: null, end: start + [...value].length, entity_type, score, start };
}

async function closedPortUrl() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}`;
}

// ---------------------------------------------------------------------------------------------
// validators
// ---------------------------------------------------------------------------------------------

describe("validators", () => {
  test("luhnValid", () => {
    assert.equal(luhnValid("4111111111111111"), true);
    assert.equal(luhnValid("4111 1111 1111 1111"), true);
    assert.equal(luhnValid("4111-1111-1111-1111"), true);
    assert.equal(luhnValid("79927398713"), true);
    assert.equal(luhnValid("4111111111111112"), false);
    assert.equal(luhnValid(""), false);
    assert.equal(luhnValid("abcd"), false);
    assert.equal(luhnValid(null), false);
  });

  test("ibanValid: country, length and mod-97", () => {
    for (const ok of ["DE89 3704 0044 0532 0130 00", "GB82WEST12345698765432", "gb82 west 1234 5698 7654 32", "NL91ABNA0417164300", "FR1420041010050500013M02606", "BE68539007547034", "NO9386011117947"]) {
      assert.equal(ibanValid(ok), true, ok);
    }
    assert.equal(ibanValid("DE89370400440532013001"), false, "bad checksum");
    assert.equal(ibanValid("DE8937040044053201300"), false, "wrong length for DE");
    assert.equal(ibanValid("XX89370400440532013000"), false, "unknown country");
    assert.equal(ibanValid("hello"), false);
    assert.equal(ibanValid(undefined), false);
  });

  test("ssnValid: area/group/serial rules", () => {
    assert.equal(ssnValid("536-90-4399"), true);
    assert.equal(ssnValid("536904399"), true);
    for (const bad of ["000-12-3456", "666-12-3456", "900-12-3456", "123-00-4567", "123-45-0000", "111-11-1111", "12345678"]) {
      assert.equal(ssnValid(bad), false, bad);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// built-in recognizers
// ---------------------------------------------------------------------------------------------

describe("detectBuiltin: EMAIL", () => {
  test("finds emails with offsets and values", () => {
    const text = "Write to Ada.L+test@mail.example.co.uk, thanks.";
    const [e] = detectBuiltin(text);
    assert.equal(e.type, "EMAIL");
    assert.equal(e.value, "Ada.L+test@mail.example.co.uk");
    assert.equal(text.slice(e.start, e.end), e.value);
    assert.equal(e.score, 1);
  });

  test("ignores handles and hostless strings", () => {
    assert.deepEqual(ofType("ping @ada on chat, or user@localhost, or a@b.c", "EMAIL"), []);
  });
});

describe("detectBuiltin: PHONE", () => {
  const positives = [
    "+1 (555) 123-4567",
    "555-123-4567",
    "(555) 123-4567",
    "555.123.4567",
    "+44 20 7946 0958",
    "+44 (0) 20 7946 0958",
    "+49 151 12345678",
    "+33 6 12 34 56 78",
    "+4915112345678",
    "07911 123456",
    "01.23.45.67.89",
    "2125551234",
  ];
  for (const p of positives) {
    test(`matches ${p}`, () => {
      assert.deepEqual(ofType(`Reach me at ${p} today.`, "PHONE"), [p]);
    });
  }

  test("unformatted digits need a phone keyword or a NANP shape", () => {
    assert.deepEqual(ofType("phone: 12345678", "PHONE"), ["12345678"]);
    assert.deepEqual(ofType("whatsapp 4915112345", "PHONE"), ["4915112345"]);
    assert.deepEqual(ofType("order 12345678 shipped", "PHONE"), []);
    assert.deepEqual(ofType("timestamp 1764115200", "PHONE"), []);
  });

  const negatives = [
    ["ISO date", "The meeting is on 2026-11-26 at noon."],
    ["dotted date", "Due 26.11.2026 please"],
    ["slash date", "Due 11/26/2026 please"],
    ["date-time", "at 2026-11-26T10:30:00Z"],
    ["price", "It costs $1234567 now"],
    ["price with code", "Budget EUR 1 234 567 for it"],
    ["price suffix", "about 1 234 567 € in total"],
    ["thousands", "We sold 1 234 567 units"],
    ["version", "Windows version 10.0.19041.1234"],
    ["semver", "upgrade to 1.2.3 soon"],
    ["years", "between 2025 2026 and later"],
    ["year range", "from 1999-2004 roughly"],
    ["decimal", "pi is 3.14159265 ok"],
    ["decimal number", "total 12345678.90 owed"],
    ["IPv4", "server 10.20.30.40 is down"],
    ["IPv4 other", "server 192.168.100.200 is down"],
    ["ISBN", "ISBN 978-3-16-148410-0"],
    ["valid card", "card 4111 1111 1111 1111 please"],
    ["invalid card", "card 4111 1111 1111 1112 please"],
    ["SSN shape", "ssn 536-90-4399"],
    ["small list", "pick 1 2 3 4 5 6 7 8"],
  ];
  for (const [name, text] of negatives) {
    test(`does not match ${name}`, () => {
      assert.deepEqual(ofType(text, "PHONE"), [], text);
    });
  }

  test("splits a phone from an adjacent date", () => {
    assert.deepEqual(ofType("on 2026-11-26 555-123-4567 works", "PHONE"), ["555-123-4567"]);
    assert.deepEqual(ofType("call 555-123-4567 2 times", "PHONE"), ["555-123-4567"]);
  });
});

describe("detectBuiltin: CARD", () => {
  for (const c of ["4111 1111 1111 1111", "4111-1111-1111-1111", "4111111111111111", "3782 822463 10005", "5555555555554444", "6011 1111 1111 1117"]) {
    test(`matches ${c}`, () => {
      assert.deepEqual(found(`my card is ${c}.`), [["CARD", c]]);
    });
  }

  test("requires Luhn, an issuer prefix and consistent grouping", () => {
    for (const bad of ["4111 1111 1111 1112", "0000 0000 0000 0000", "1234567890123452", "4111 1111-1111 1111"]) {
      assert.deepEqual(ofType(`card ${bad}`, "CARD"), [], bad);
    }
  });

  test("drops a trailing group that is not part of the number", () => {
    assert.deepEqual(ofType("4111 1111 1111 1111 12 items", "CARD"), ["4111 1111 1111 1111"]);
  });
});

describe("detectBuiltin: IBAN", () => {
  test("matches grouped, compact and lower-case IBANs", () => {
    assert.deepEqual(found("Pay DE89 3704 0044 0532 0130 00 now"), [["IBAN", "DE89 3704 0044 0532 0130 00"]]);
    assert.deepEqual(found("Pay GB82WEST12345698765432."), [["IBAN", "GB82WEST12345698765432"]]);
    assert.deepEqual(ofType("iban nl91 abna 0417 1643 00", "IBAN"), ["nl91 abna 0417 1643 00"]);
    assert.deepEqual(ofType("BE68 5390 0754 7034 Thanks", "IBAN"), ["BE68 5390 0754 7034"]);
  });

  test("rejects bad checksums and prose that has the shape", () => {
    assert.deepEqual(ofType("Pay DE89 3704 0044 0532 0130 01 now", "IBAN"), []);
    assert.deepEqual(ofType("at12 then they were good", "IBAN"), []);
  });
});

describe("detectBuiltin: SSN", () => {
  test("matches formatted SSNs and bare ones next to a keyword", () => {
    assert.deepEqual(found("SSN 536-90-4399"), [["SSN", "536-90-4399"]]);
    assert.deepEqual(found("ss 536 90 4399"), [["SSN", "536 90 4399"]]);
    assert.deepEqual(found("my social security number is 536904399"), [["SSN", "536904399"]]);
  });

  test("rejects invalid ranges and bare digits without context", () => {
    assert.deepEqual(ofType("id 000-12-3456 and 666-12-3456", "SSN"), []);
    assert.deepEqual(ofType("ref 536904399", "SSN"), []);
    assert.deepEqual(ofType("536-90-43991", "SSN"), []);
  });
});

describe("detectBuiltin: IP", () => {
  test("matches IPv4 and IPv6", () => {
    assert.deepEqual(found("from 10.0.0.5 and 8.8.8.8"), [["IP", "10.0.0.5"], ["IP", "8.8.8.8"]]);
    assert.deepEqual(found("host 2001:db8::ff00:42:8329 up"), [["IP", "2001:db8::ff00:42:8329"]]);
    assert.deepEqual(found("mapped ::ffff:192.0.2.1 here"), [["IP", "::ffff:192.0.2.1"]]);
  });

  test("ignores loopback, invalid octets, versions, C++ scopes, times, slices and MACs", () => {
    for (const t of ["127.0.0.1", "0.0.0.0", "999.1.1.1", "v1.2.3.4", "1.2.3.4.5", "std::vector", "abc::def", "at 12:30:45", "x[1::2]", "::1", "00:1A:2B:3C:4D:5E"]) {
      assert.deepEqual(ofType(`see ${t} ok`, "IP"), [], t);
    }
  });
});

describe("detectBuiltin: SECRET", () => {
  const ghp = `ghp_${"aB3".repeat(12)}`;
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  const positives = [
    ["openai", "sk-proj-AbCdEf1234567890ghIJklMNop", "sk-proj-AbCdEf1234567890ghIJklMNop"],
    ["anthropic", "sk-ant-api03-Zx9Yw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe", "sk-ant-api03-Zx9Yw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe"],
    ["aws", "AKIAIOSFODNN7EXAMPLE", "AKIAIOSFODNN7EXAMPLE"],
    ["github", ghp, ghp],
    ["slack", "xoxb-1234567890-abcdefghij", "xoxb-1234567890-abcdefghij"],
    ["stripe", "sk_live_51HaBcDeFgHiJkLmN0pQ", "sk_live_51HaBcDeFgHiJkLmN0pQ"],
    ["jwt", jwt, jwt],
    ["password colon", "password: hunter2", "hunter2"],
    ["password is", "my password is Tr0ub4dor&3.", "Tr0ub4dor&3"],
    ["pin", "my PIN is 4821", "4821"],
    ["env var", "DB_PASSWORD=correcthorse99", "correcthorse99"],
    ["api key", 'api_key = "abcd1234efgh5678"', "abcd1234efgh5678"],
    ["bearer", "Authorization: Bearer abc123def456ghi789jkl", "abc123def456ghi789jkl"],
    ["url credentials", "postgres://admin:s3cr3t@db.example.com:5432/app", "admin:s3cr3t"],
  ];
  for (const [name, text, value] of positives) {
    test(`matches ${name}`, () => {
      assert.deepEqual(ofType(text, "SECRET"), [value]);
    });
  }

  test("URL credentials are not mistaken for an email", () => {
    assert.deepEqual(found("postgres://admin:s3cr3t@db.example.com/app"), [["SECRET", "admin:s3cr3t"]]);
  });

  test("private key blocks", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAx7\nabc\n-----END RSA PRIVATE KEY-----";
    assert.deepEqual(ofType(`here:\n${key}\nthanks`, "SECRET"), [key]);
  });

  test("ignores code, placeholders and instructions", () => {
    for (const t of [
      "password: string;",
      "const password = process.env.DB_PASSWORD",
      "password = req.body.password",
      "Reset your password: click the link",
      "password: ********",
      "password: <your password>",
      "use sk-learn-model-selection-tool",
      "task-abcdefghijklmnopqrstuvwxyz123",
      "token: abcdefghijklmnop",
      "GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
      "const user = { name, password: hashed, role };",
      "login(password: hashedPassword)",
    ]) {
      assert.deepEqual(ofType(t, "SECRET"), [], t);
    }
  });
});

describe("detectBuiltin: PERSON", () => {
  const positives = [
    ["my name is", "Hello, my name is Ada Lovelace.", ["Ada Lovelace"]],
    ["my name is lower-case", "hi my name is ada lovelace and i need help", ["ada lovelace"]],
    ["my name's", "My name's José Álvarez", ["José Álvarez"]],
    ["I'm", "I'm Grace Hopper, an engineer", ["Grace Hopper"]],
    ["Dear", "Dear John,\nthanks for the call", ["John"]],
    ["Dear with title", "Dear Mr. Smith, hello", ["Smith"]],
    ["title", "I met Dr. Jane Smith yesterday", ["Jane Smith"]],
    ["apostrophe", "Ask Mr. O'Brien about it", ["O'Brien"]],
    ["middle initial", "Talk to Dr. John F. Kennedy now", ["John F. Kennedy"]],
    ["particle", "Mr. Ludwig van Beethoven wrote", ["Ludwig van Beethoven"]],
    ["sign-off newline", "See you then.\n\nRegards,\nJohn Smith", ["John Smith"]],
    ["sign-off blank line", "Best regards,\n\nMaría García\nCEO", ["María García"]],
    ["sign-off same line", "Thanks, Bob", ["Bob"]],
    ["sign-off after a sentence", "Pay by Friday. Thanks,\nAnna", ["Anna"]],
    ["greeting", "Hi Sarah,\nquick question", ["Sarah"]],
    ["relation", "my wife Sarah loves it", ["Sarah"]],
    ["field", "From: John Smith <john@x.com>", ["John Smith"]],
    ["intro", "Hi, this is Priya from Acme", ["Priya"]],
    ["call me", "Call me Ishmael.", ["Ishmael"]],
    ["possessive", "Ask Dr. Ada's lab", ["Ada"]],
    ["name-like word next to a clear name", "I'm Grace Hopper", ["Grace Hopper"]],
    ["D'Angelo", "Dear D'Angelo,", ["D'Angelo"]],
  ];
  for (const [name, text, values] of positives) {
    test(`finds ${name}`, () => {
      assert.deepEqual(ofType(text, "PERSON"), values, text);
    });
  }

  test("propagates a detected name through the rest of the text", () => {
    assert.deepEqual(ofType("My name is Ada Lovelace. Later Ada said Lovelace was right.", "PERSON"), ["Ada Lovelace", "Ada", "Lovelace"]);
  });

  test("never propagates single common words", () => {
    assert.deepEqual(ofType("Dear Will, Will you come?", "PERSON"), ["Will"]);
  });

  const negatives = [
    "I'm Going to the store",
    "I'm Sorry about that",
    "I'm Not sure",
    "I'm Working On It",
    "I'm Free on Monday",
    "I'm American",
    "Dear Sir or Madam,",
    "Dear Hiring Manager,",
    "Dear Valued Customer",
    "Regards,\nThe Team",
    "Thanks,\nMonday works",
    "Thanks,\nMonday",
    "Regards,\nJanuary",
    "Hi there,",
    "Hello World!",
    "Hi Team,",
    "Thanks, I will try",
    "I like it. Thanks, John Smith did it",
    "Monday Tuesday Friday",
    "Going home. Sorry Mark. Paris is lovely.",
    "my boss is angry",
    "Mr. Monday",
    "i miss Paris",
    "I'm May",
    "Hi Mark,",
    "Dear Hiring Manager, I am Passionate about design",
    "Call me Maybe is a song",
    "To: All staff",
  ];
  for (const text of negatives) {
    test(`no false positive: ${JSON.stringify(text)}`, () => {
      assert.deepEqual(ofType(text, "PERSON"), []);
    });
  }
});

describe("resolveOverlaps", () => {
  const text = "abcdefghijklmnopqrstuvwxyz";
  test("cross-type: higher score wins, then longer span", () => {
    const out = resolveOverlaps(
      [
        { type: "PHONE", start: 0, end: 10, score: 0.7 },
        { type: "CARD", start: 2, end: 8, score: 1 },
        { type: "IP", start: 12, end: 15, score: 0.9 },
        { type: "LOCATION", start: 12, end: 18, score: 0.9 },
      ],
      text
    );
    assert.deepEqual(
      out.map((e) => [e.type, e.start, e.end]),
      [
        ["CARD", 2, 8],
        ["LOCATION", 12, 18],
      ]
    );
  });

  test("same type: overlapping spans merge into their union", () => {
    const out = resolveOverlaps(
      [
        { type: "PERSON", start: 0, end: 3, score: 0.95 },
        { type: "PERSON", start: 0, end: 12, score: 0.6 },
      ],
      text
    );
    assert.deepEqual(out, [{ type: "PERSON", start: 0, end: 12, score: 0.95, value: "abcdefghijkl" }]);
  });

  test("drops malformed spans", () => {
    assert.deepEqual(resolveOverlaps([{ type: "X", start: 5, end: 2, score: 1 }, { type: "X", start: 0, end: 99, score: 1 }, null], text), []);
  });
});

// ---------------------------------------------------------------------------------------------
// redactMessages
// ---------------------------------------------------------------------------------------------

describe("redactMessages (placeholder mode)", () => {
  test("replaces entities, returns the map and per-type counts", async () => {
    const r = plainRedactor();
    const res = await r.redactMessages([{ role: "user", content: "Email ada@example.com or call 555-123-4567. My name is Ada Lovelace." }], null);
    assert.equal(res.messages[0].content, "Email [EMAIL_1] or call [PHONE_1]. My name is [PERSON_1].");
    assert.equal(res.messages[0].role, "user");
    assert.deepEqual(res.counts, { EMAIL: 1, PHONE: 1, PERSON: 1 });
    assert.deepEqual(res.map, {
      v: 1,
      byValue: { "EMAIL\u0000ada@example.com": "[EMAIL_1]", "PHONE\u00005551234567": "[PHONE_1]", "PERSON\u0000ada lovelace": "[PERSON_1]" },
      byPlaceholder: { "[EMAIL_1]": "ada@example.com", "[PHONE_1]": "555-123-4567", "[PERSON_1]": "Ada Lovelace" },
      counters: { EMAIL: 1, PHONE: 1, PERSON: 1 },
    });
    assert.deepEqual(JSON.parse(JSON.stringify(res.map)), res.map, "map is JSON-serialisable");
  });

  test("same real value gets the same placeholder across calls (normalised)", async () => {
    const r = plainRedactor();
    const first = await r.redactMessages(
      [{ role: "user", content: "I'm Ada Lovelace, ada@example.com, +1 (555) 123-4567, card 4111 1111 1111 1111, IBAN DE89 3704 0044 0532 0130 00" }],
      null
    );
    const second = await r.redactMessages(
      [{ role: "user", content: "my name is ADA LOVELACE, mail ADA@Example.COM, phone 555.123.4567, card 4111-1111-1111-1111, iban de89370400440532013000" }],
      first.map
    );
    assert.equal(second.messages[0].content, "my name is [PERSON_1], mail [EMAIL_1], phone [PHONE_1], card [CARD_1], iban [IBAN_1]");
    assert.deepEqual(second.map.counters, first.map.counters, "no new placeholders were issued");
  });

  test("values already in the map are redacted without any trigger phrase", async () => {
    const r = plainRedactor();
    const first = await r.redactMessages([{ role: "user", content: "My name is Ada Lovelace" }], null);
    const second = await r.redactMessages(
      [
        { role: "assistant", content: "Nice to meet you, Ada Lovelace!" },
        { role: "user", content: "What would ada lovelace say? Ask Ada." },
      ],
      first.map
    );
    assert.equal(second.messages[0].content, "Nice to meet you, [PERSON_1]!");
    assert.equal(second.messages[1].content, "What would [PERSON_1] say? Ask [PERSON_2].");
    assert.equal(second.map.byPlaceholder["[PERSON_2]"], "Ada");
    const third = await r.redactMessages([{ role: "user", content: "Ada again" }], second.map);
    assert.equal(third.messages[0].content, "[PERSON_2] again");
  });

  test("a name introduced late in the list is also caught in earlier messages", async () => {
    const r = plainRedactor();
    const res = await r.redactMessages(
      [
        { role: "assistant", content: "Ada Lovelace, is that you?" },
        { role: "user", content: "Yes, my name is Ada Lovelace." },
      ],
      null
    );
    assert.deepEqual(
      res.messages.map((m) => m.content),
      ["[PERSON_1], is that you?", "Yes, my name is [PERSON_1]."]
    );
    assert.deepEqual(res.counts, { PERSON: 2 });
  });

  test("counts cover every message of this call only", async () => {
    const r = plainRedactor();
    const a = await r.redactMessages([{ role: "user", content: "a@x.io b@x.io" }], null);
    assert.deepEqual(a.counts, { EMAIL: 2 });
    const b = await r.redactMessages([{ role: "user", content: "a@x.io" }, { role: "user", content: "no pii here" }], a.map);
    assert.deepEqual(b.counts, { EMAIL: 1 });
  });

  test("does not mutate the input map or messages", async () => {
    const r = plainRedactor();
    const first = await r.redactMessages([{ role: "user", content: "a@x.io" }], null);
    const snapshot = JSON.stringify(first.map);
    const msgs = [{ role: "user", content: "b@x.io" }];
    const second = await r.redactMessages(msgs, first.map);
    assert.equal(JSON.stringify(first.map), snapshot);
    assert.equal(msgs[0].content, "b@x.io");
    assert.equal(second.map.byPlaceholder["[EMAIL_2]"], "b@x.io");
  });

  test("user text that looks like a placeholder is never confused with a real mapping", async () => {
    const r = plainRedactor();
    const first = await r.redactMessages([{ role: "user", content: "My name is Ada Lovelace" }], null);
    const second = await r.redactMessages([{ role: "user", content: "What does [PERSON_1] mean? And person_1 in my code?" }], first.map);
    const content = second.messages[0].content;
    assert.ok(!content.includes("[PERSON_1]"), content);
    assert.deepEqual(second.counts, {}, "look-alikes are not personal data");
    // The model echoes both; the user gets back exactly what they typed, not "Ada Lovelace".
    assert.equal(r.restore(content, second.map), "What does [PERSON_1] mean? And person_1 in my code?");
    // A real mapping still restores.
    assert.equal(r.restore("[PERSON_1] said", second.map), "Ada Lovelace said");
  });

  test("tolerates non-string content and validates arguments", async () => {
    const r = plainRedactor();
    const res = await r.redactMessages([{ role: "user", content: null }, { role: "user", content: "" }, { role: "user", content: "a@x.io" }], undefined);
    assert.deepEqual(
      res.messages.map((m) => m.content),
      [null, "", "[EMAIL_1]"]
    );
    await assert.rejects(r.redactMessages("hi", null), TypeError);
    await assert.rejects(r.redactMessages([], "not a map"), TypeError);
    await assert.rejects(r.redactMessages([], null, { mode: "nope" }), TypeError);
  });

  test("a stored map is sanitised: bad keys ignored, counters never reissue a placeholder", async () => {
    const r = plainRedactor();
    const stored = JSON.parse(
      '{"v":1,"byValue":{"__proto__":"[EMAIL_1]","EMAIL\\u0000a@x.io":"[EMAIL_7]"},"byPlaceholder":{"[EMAIL_7]":"a@x.io","__proto__":"x"},"counters":{}}'
    );
    const res = await r.redactMessages([{ role: "user", content: "a@x.io b@x.io" }], stored);
    assert.equal(res.messages[0].content, "[EMAIL_7] [EMAIL_8]");
    assert.equal(Object.getPrototypeOf(res.map.byValue), Object.prototype);
  });
});

describe("redactMessages (generic mode)", () => {
  test("uses neutral phrases, distinguishes distinct values, leaves the map alone", async () => {
    const r = plainRedactor();
    const res = await r.redactMessages(
      [{ role: "user", content: "Paint Dr. Jane Smith with Dr. Bob Stone and Dr. Jane Smith again, email jane@x.io, card 4111111111111111" }],
      null,
      { mode: "generic" }
    );
    assert.equal(res.messages[0].content, "Paint Dr. a person with Dr. another person and Dr. a person again, email an email address, card a card number");
    assert.deepEqual(res.map, { v: 1, byValue: {}, byPlaceholder: {}, counters: {} });
    assert.deepEqual(res.counts, { PERSON: 3, EMAIL: 1, CARD: 1 });
  });

  test("known values from the conversation map are replaced too", async () => {
    const r = plainRedactor();
    const first = await r.redactMessages([{ role: "user", content: "my name is Ada Lovelace" }], null);
    const res = await r.redactMessages([{ role: "user", content: "a portrait of Ada Lovelace" }], first.map, { mode: "generic" });
    assert.equal(res.messages[0].content, "a portrait of a person");
    assert.deepEqual(res.map, first.map);
  });

  test("placeholder look-alikes are left as typed", async () => {
    const r = plainRedactor();
    const res = await r.redactMessages([{ role: "user", content: "a sign that says [PERSON_1]" }], null, { mode: "generic" });
    assert.equal(res.messages[0].content, "a sign that says [PERSON_1]");
  });
});

// ---------------------------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------------------------

describe("restore", () => {
  const map = {
    v: 1,
    byValue: {},
    byPlaceholder: { "[PERSON_1]": "Ada Lovelace", "[EMAIL_1]": "ada@example.com", "[BANK_ACCOUNT_1]": "12345678", "[SECRET_1]": "a$&b$1" },
    counters: {},
  };
  const r = plainRedactor();
  const cases = [
    ["exact", "Hi [PERSON_1]!", "Hi Ada Lovelace!"],
    ["case change", "Hi [person_1] / [Person_1]", "Hi Ada Lovelace / Ada Lovelace"],
    ["no brackets", "Hi PERSON_1, mail EMAIL_1.", "Hi Ada Lovelace, mail ada@example.com."],
    ["one bracket", "Hi [PERSON_1 and PERSON_1]", "Hi Ada Lovelace and Ada Lovelace"],
    ["markdown escapes", String.raw`Hi \[PERSON\_1\] and BANK\_ACCOUNT\_1`, "Hi Ada Lovelace and 12345678"],
    ["underscore label", "acct [BANK_ACCOUNT_1]", "acct 12345678"],
    ["possessive", "[PERSON_1]'s notes", "Ada Lovelace's notes"],
    ["unknown placeholder", "Hi [PERSON_2] and [PHONE_1]", "Hi [PERSON_2] and [PHONE_1]"],
    ["longer number", "Hi [PERSON_12] PERSON_10", "Hi [PERSON_12] PERSON_10"],
    ["inside identifiers", "XPERSON_1 PERSON_1x MY_PERSON_1 PERSON_1_name", "XPERSON_1 PERSON_1x MY_PERSON_1 PERSON_1_name"],
    ["replacement patterns are literal", "key [SECRET_1]", "key a$&b$1"],
    ["no placeholders", "plain text", "plain text"],
  ];
  for (const [name, input, expected] of cases) {
    test(name, () => assert.equal(r.restore(input, map), expected));
  }

  test("null map, empty map, non-string input", () => {
    assert.equal(r.restore("Hi [PERSON_1]", null), "Hi [PERSON_1]");
    assert.equal(r.restore("Hi [PERSON_1]", { v: 1, byValue: {}, byPlaceholder: {}, counters: {} }), "Hi [PERSON_1]");
    assert.equal(r.restore(undefined, map), "");
    assert.equal(r.restore("", map), "");
  });

  test("round trip through redactMessages", async () => {
    const res = await r.redactMessages([{ role: "user", content: "Dear John,\ncall +44 20 7946 0958 or mail john@x.io" }], null);
    assert.equal(r.restore(res.messages[0].content, res.map), "Dear John,\ncall +44 20 7946 0958 or mail john@x.io");
  });
});

// ---------------------------------------------------------------------------------------------
// stream restorer
// ---------------------------------------------------------------------------------------------

describe("createStreamRestorer", () => {
  const map = {
    v: 1,
    byValue: {},
    byPlaceholder: { "[PERSON_1]": "Ada", "[PERSON_10]": "Bob Stone", "[EMAIL_1]": "ada@example.com", "[BANK_ACCOUNT_1]": "DE-ACCT" },
    counters: {},
  };
  const r = plainRedactor();
  const samples = [
    "Hello [PERSON_1], your email is [EMAIL_1].",
    "PERSON_1 and [person_10] and [PERSON_1",
    "[PERSON_12] [PERSON_2] xPERSON_1 PERSON_1x PERSON_1_a [[PERSON_1]]",
    String.raw`md: \[PERSON\_1\] \[EMAIL\_1 BANK\_ACCOUNT\_1\]`,
    "acct [BANK_ACCOUNT_1] / BANK_ACCOUNT_1, [BANK_ACC] [BANK_",
    "ends with [PERSON_",
    "ends with PERSON_1",
    "[",
    "\\",
    "brackets [x] [P] [PE] [PER] PER PERSONAL [EMAILS] EMAIL_1EMAIL_1 é[PERSON_1]é",
    "🙂[PERSON_10]🙂 PERSON_10]",
  ];

  function runChunks(chunks) {
    const s = r.createStreamRestorer(map);
    let out = "";
    for (const c of chunks) out += s.push(c);
    return out + s.flush();
  }

  for (const sample of samples) {
    test(`every 2-way split equals restore(): ${JSON.stringify(sample).slice(0, 40)}`, () => {
      const expected = r.restore(sample, map);
      for (let i = 0; i <= sample.length; i++) {
        assert.equal(runChunks([sample.slice(0, i), sample.slice(i)]), expected, `split at ${i}`);
      }
    });

    test(`every 3-way split and char-by-char equal restore(): ${JSON.stringify(sample).slice(0, 40)}`, () => {
      const expected = r.restore(sample, map);
      for (let i = 0; i <= sample.length; i++) {
        for (let j = i; j <= sample.length; j++) {
          assert.equal(runChunks([sample.slice(0, i), sample.slice(i, j), sample.slice(j)]), expected, `split at ${i},${j}`);
        }
      }
      assert.equal(runChunks([...sample]), expected, "char by char");
      assert.equal(runChunks(sample.split("")), expected, "code units");
    });
  }

  test("random multi-chunk splits of a long text", () => {
    const rand = mulberry32(42);
    const text = samples.join(" | ").repeat(3);
    const expected = r.restore(text, map);
    for (let round = 0; round < 300; round++) {
      const chunks = [];
      let i = 0;
      while (i < text.length) {
        const n = 1 + Math.floor(rand() * 12);
        chunks.push(text.slice(i, i + n));
        i += n;
      }
      assert.equal(runChunks(chunks), expected);
    }
  });

  test("holds back only a minimal tail and never emits a partial placeholder", () => {
    const s = r.createStreamRestorer(map);
    assert.equal(s.push("Hello "), "Hello ");
    assert.equal(s.push("["), "");
    assert.equal(s.push("PER"), "");
    assert.equal(s.push("SON_"), "");
    assert.equal(s.push("1"), "");
    assert.equal(s.push("]"), "Ada");
    assert.equal(s.push(" and PERSON_1"), " and ");
    assert.equal(s.push(" ok [X"), "Ada ok [X");
    assert.equal(s.push(" [PERSON_9"), " [PERSON_9", "no placeholder in the map starts with PERSON_9");
    assert.equal(s.push(" [PERSON_1"), " ", "could still become [PERSON_1] or [PERSON_10]");
    assert.equal(s.push("0"), "");
    assert.equal(s.push("]."), "Bob Stone.");
    assert.equal(s.flush(), "");
  });

  test("text that cannot start a placeholder is emitted immediately", () => {
    const s = r.createStreamRestorer(map);
    assert.equal(s.push("supercalifragilistic"), "supercalifragilistic");
    assert.equal(s.push(" price: 5"), " price: 5");
    assert.equal(s.push(" xPER"), " xPER", "bare placeholder needs a word boundary");
    assert.equal(s.flush(), "");
  });

  test("an empty map passes chunks straight through", () => {
    const s = r.createStreamRestorer(null);
    assert.equal(s.push("[PERSON_1"), "[PERSON_1");
    assert.equal(s.push(undefined), "");
    assert.equal(s.flush(), "");
  });

  test("flush restores a pending complete placeholder", () => {
    const s = r.createStreamRestorer(map);
    assert.equal(s.push("bye PERSON_1"), "bye ");
    assert.equal(s.flush(), "Ada");
  });
});

// ---------------------------------------------------------------------------------------------
// filterResponse / isSensitive
// ---------------------------------------------------------------------------------------------

describe("filterResponse", () => {
  const r = plainRedactor();

  test("masks high-risk values that are not the user's own", async () => {
    const res = await r.redactMessages([{ role: "user", content: "my card is 4539-1488-0343-6467 and my email a@x.io" }], null);
    const answer =
      "Your card 4539 1488 0343 6467 is fine. Try 5425 2334 3010 9903, IBAN DE89 3704 0044 0532 0130 00, SSN 536-90-4399, key sk-proj-AbCdEf1234567890ghIJklMNop. Mail a@x.io or b@x.io, call 555-123-4567.";
    const out = r.filterResponse(answer, res.map);
    assert.equal(
      out.text,
      "Your card 4539 1488 0343 6467 is fine. Try [redacted CARD], IBAN [redacted IBAN], SSN [redacted SSN], key [redacted SECRET]. Mail a@x.io or b@x.io, call 555-123-4567."
    );
    assert.deepEqual(out.masked, { CARD: 1, IBAN: 1, SSN: 1, SECRET: 1 });
  });

  test("keeps the user's own secrets and identifiers", async () => {
    const res = await r.redactMessages([{ role: "user", content: "password: hunter2 and SSN 536-90-4399" }], null);
    const out = r.filterResponse("Your password hunter2? Use password: hunter2 with SSN 536 90 4399.", res.map);
    assert.deepEqual(out.masked, {});
    assert.equal(out.text, "Your password hunter2? Use password: hunter2 with SSN 536 90 4399.");
  });

  test("public test cards and documentation keys in code answers are left alone", () => {
    const answer = "Use 4242 4242 4242 4242 or 4111111111111111 in Stripe test mode; AWS docs use AKIAIOSFODNN7EXAMPLE.";
    assert.deepEqual(r.filterResponse(answer, null), { text: answer, masked: {} });
  });

  test("without a map everything high-risk is masked", () => {
    assert.deepEqual(r.filterResponse("card 4539148803436467", null), { text: "card [redacted CARD]", masked: { CARD: 1 } });
    assert.deepEqual(r.filterResponse("", null), { text: "", masked: {} });
    assert.deepEqual(r.filterResponse("nothing here", null), { text: "nothing here", masked: {} });
  });
});

describe("isSensitive", () => {
  const r = plainRedactor();
  test("true only for high-risk types", () => {
    assert.deepEqual([...HIGH_RISK_TYPES].sort(), ["BANK_ACCOUNT", "CARD", "IBAN", "PASSPORT", "SECRET", "SSN"]);
    for (const t of HIGH_RISK_TYPES) assert.equal(r.isSensitive({ [t]: 1 }), true, t);
    assert.equal(r.isSensitive({ PERSON: 3, EMAIL: 1, PHONE: 2, IP: 1, LOCATION: 1 }), false);
    assert.equal(r.isSensitive({ CARD: 0 }), false);
    assert.equal(r.isSensitive({}), false);
    assert.equal(r.isSensitive(null), false);
  });
});

describe("normalizeValue", () => {
  test("per-type canonical forms", () => {
    assert.equal(normalizeValue("EMAIL", " Ada@Example.COM "), "ada@example.com");
    assert.equal(normalizeValue("PHONE", "+1 (555) 123-4567"), "5551234567");
    assert.equal(normalizeValue("PHONE", "0044 20 7946 0958"), normalizeValue("PHONE", "+44 20 7946 0958"));
    assert.equal(normalizeValue("CARD", "4111-1111 1111-1111"), "4111111111111111");
    assert.equal(normalizeValue("IBAN", "de89 3704"), "DE893704");
    assert.equal(normalizeValue("PERSON", "Ada   LOVELACE."), "ada lovelace");
    assert.equal(normalizeValue("SECRET", "AbC"), "AbC");
  });
});

// ---------------------------------------------------------------------------------------------
// Presidio client
// ---------------------------------------------------------------------------------------------

describe("Presidio client", () => {
  let stub;
  let mode = "ok";
  before(async () => {
    stub = await startStub((body) => {
      if (mode === "error") return { status: 500, json: { error: "boom" } };
      if (mode === "badjson") return { raw: "not json" };
      if (mode === "notarray") return { json: { results: [] } };
      if (mode === "hang") return "HANG";
      const text = body.text;
      const hits = [];
      if (text.includes("Maria Garcia")) hits.push(presidioHit(text, "Maria Garcia", "PERSON"));
      if (text.includes("Berlin")) hits.push(presidioHit(text, "Berlin", "LOCATION"));
      if (text.includes("maria@x.io")) hits.push(presidioHit(text, "maria@x.io", "EMAIL_ADDRESS", 1), presidioHit(text, "x.io", "URL", 0.5));
      if (text.includes("tomorrow")) hits.push(presidioHit(text, "tomorrow", "DATE_TIME"));
      if (text.includes("Danish")) hits.push(presidioHit(text, "Danish", "NRP"));
      if (text.includes("12345678")) hits.push(presidioHit(text, "12345678", "US_BANK_NUMBER", 0.05));
      if (text.includes("AB1234567")) hits.push(presidioHit(text, "AB1234567", "UK_PASSPORT", 0.9));
      hits.push({ entity_type: "PERSON", start: 5, end: 2, score: 0.9 }, { entity_type: "PERSON", start: 0.5, end: 3, score: 0.9 }, null);
      return { json: hits };
    });
  });
  after(() => stub.close());

  test("sends {text, language, score_threshold} and maps entity types", async () => {
    mode = "ok";
    const client = createPresidioClient({ url: `${stub.url}/`, language: "en", scoreThreshold: 0.4, cacheSize: 0 });
    const text = "Maria Garcia (maria@x.io) is Danish, moves to Berlin tomorrow; acct 12345678, passport AB1234567";
    const n0 = stub.requests.length;
    const ents = await client.analyze(text);
    const req = stub.requests[n0];
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/analyze");
    assert.match(req.headers["content-type"], /application\/json/);
    assert.deepEqual(JSON.parse(req.raw), { text, language: "en", score_threshold: 0.4 });
    assert.deepEqual(
      ents.map((e) => [e.type, e.value]),
      [
        ["PERSON", "Maria Garcia"],
        ["LOCATION", "Berlin"],
        ["EMAIL", "maria@x.io"],
        ["PASSPORT", "AB1234567"],
      ]
    );
    for (const e of ents) assert.equal(text.slice(e.start, e.end), e.value);
  });

  test("converts code point offsets to UTF-16 (emoji before entities)", async () => {
    mode = "ok";
    const client = createPresidioClient({ url: stub.url, cacheSize: 0 });
    const text = "😀😀 hi 🎉 Maria Garcia from Berlin";
    const ents = await client.analyze(text);
    assert.deepEqual(
      ents.map((e) => e.value),
      ["Maria Garcia", "Berlin"]
    );
  });

  test("caches by text hash so history is not re-sent every turn", async () => {
    mode = "ok";
    const client = createPresidioClient({ url: stub.url, cacheSize: 2 });
    const n0 = stub.requests.length;
    await client.analyze("Maria Garcia one");
    await client.analyze("Maria Garcia one");
    assert.equal(stub.requests.length, n0 + 1);
    await client.analyze("two");
    await client.analyze("three"); // evicts "one"
    await client.analyze("Maria Garcia one");
    assert.equal(stub.requests.length, n0 + 4);
    assert.deepEqual(await client.analyze("   "), [], "blank text is not sent");
    assert.equal(stub.requests.length, n0 + 4);
  });

  test("throws PresidioError on HTTP errors, bad JSON, wrong shape and timeouts", async () => {
    const client = createPresidioClient({ url: stub.url, cacheSize: 0, timeoutMs: 150 });
    for (const m of ["error", "badjson", "notarray"]) {
      mode = m;
      await assert.rejects(client.analyze("Maria Garcia"), (err) => err instanceof PresidioError && !err.message.includes("Maria"), m);
    }
    mode = "hang";
    const t0 = Date.now();
    await assert.rejects(client.analyze("Maria Garcia"), /timed out after 150 ms/);
    assert.ok(Date.now() - t0 < 1500);
    mode = "ok";
  });

  test("health()", async () => {
    const client = createPresidioClient({ url: stub.url });
    stub.healthy = true;
    assert.equal(await client.health(), true);
    stub.healthy = false;
    assert.equal(await client.health(), false);
    stub.healthy = true;
    assert.equal(await createPresidioClient({ url: await closedPortUrl(), timeoutMs: 300 }).health(), false);
  });

  test("validates options", () => {
    assert.throws(() => createPresidioClient({}), TypeError);
    assert.throws(() => createPresidioClient({ url: "localhost:5002" }), TypeError);
  });

  test("label table", () => {
    assert.equal(labelForPresidioType("EMAIL_ADDRESS"), "EMAIL");
    assert.equal(labelForPresidioType("US_BANK_NUMBER"), "BANK_ACCOUNT");
    assert.equal(labelForPresidioType("URL_CREDENTIALS"), "SECRET");
    assert.equal(labelForPresidioType("US_DRIVER_LICENSE"), "LICENSE");
    assert.equal(labelForPresidioType("DATE_TIME"), null);
    assert.equal(labelForPresidioType("NRP"), null);
    assert.equal(labelForPresidioType("URL"), null);
    assert.equal(labelForPresidioType(undefined), null);
  });
});

// ---------------------------------------------------------------------------------------------
// Redactor + Presidio
// ---------------------------------------------------------------------------------------------

describe("redactor with Presidio", () => {
  let stub;
  let mode = "ok";
  before(async () => {
    stub = await startStub((body) => {
      if (mode === "error") return { status: 503, json: { error: "down" } };
      const text = body.text;
      const hits = [];
      for (const name of ["Maria Garcia", "Thanks", "Ada Lovelace"]) if (text.includes(name)) hits.push(presidioHit(text, name, "PERSON"));
      if (text.includes("Berlin")) hits.push(presidioHit(text, "Berlin", "LOCATION"));
      if (text.includes("2026-11-26")) hits.push(presidioHit(text, "2026-11-26", "PHONE_NUMBER", 0.6));
      return { json: hits };
    });
  });
  after(() => stub.close());

  const config = (url) => ({ privacy: { presidioUrl: url, presidioScoreThreshold: 0.5, presidioLanguage: "en" } });

  test("merges Presidio entities with the built-ins", async () => {
    mode = "ok";
    const r = createRedactor(config(stub.url), { logger: quietLogger() });
    assert.equal(r.presidioEnabled, true);
    assert.equal(await r.presidioHealth(), true);
    const res = await r.redactMessages([{ role: "user", content: "Tell Maria Garcia (maria@x.io) I moved to Berlin on 2026-11-26. Thanks" }], null);
    assert.equal(res.messages[0].content, "Tell [PERSON_1] ([EMAIL_1]) I moved to [LOCATION_1] on 2026-11-26. Thanks");
    assert.deepEqual(res.counts, { PERSON: 1, EMAIL: 1, LOCATION: 1 });
    const ents = await r.analyze("my name is Ada Lovelace");
    assert.deepEqual(ents.map((e) => [e.type, e.value]), [["PERSON", "Ada Lovelace"]], "overlapping same-type spans merge");
    const lastBody = JSON.parse(stub.requests.at(-1).raw);
    assert.deepEqual(Object.keys(lastBody).sort(), ["language", "score_threshold", "text"]);
  });

  test("Presidio down: built-ins still redact, one warning without text, recovery noticed", async () => {
    mode = "error";
    const logger = quietLogger();
    const r = createRedactor(config(stub.url), { logger, presidioRetryMs: 0 });
    for (let i = 0; i < 3; i++) {
      const res = await r.redactMessages([{ role: "user", content: "my name is Ada Lovelace, email ada@x.io, tell Maria Garcia" }], null);
      assert.equal(res.messages[0].content, "my name is [PERSON_1], email [EMAIL_1], tell Maria Garcia");
    }
    assert.equal(logger.lines.warn.length, 1);
    assert.match(logger.lines.warn[0], /Presidio analyzer unavailable \(presidio: HTTP 503\)/);
    assert.ok(!/Ada|Maria|ada@x\.io/.test(logger.lines.warn[0]));
    mode = "ok";
    const res = await r.redactMessages([{ role: "user", content: "tell Maria Garcia" }], null);
    assert.equal(res.messages[0].content, "tell [PERSON_1]");
    assert.equal(logger.lines.info.length, 1);
    assert.equal(logger.lines.warn.length, 1);
  });

  test("Presidio unreachable: falls back quickly and backs off", async () => {
    const logger = quietLogger();
    const url = await closedPortUrl();
    const r = createRedactor(config(url), { logger, presidioRetryMs: 60_000 });
    const res = await r.redactMessages([{ role: "user", content: "card 4111 1111 1111 1111" }], null);
    assert.equal(res.messages[0].content, "card [CARD_1]");
    assert.equal(logger.lines.warn.length, 1);
    assert.ok(!logger.lines.warn[0].includes("4111"));
    assert.equal(await r.presidioHealth(), false);
  });

  test("Presidio timeout: falls back to built-ins within the timeout", async () => {
    const hang = await startStub(() => "HANG");
    try {
      const logger = quietLogger();
      const r = createRedactor(config(hang.url), { logger, presidioTimeoutMs: 200 });
      const t0 = Date.now();
      const res = await r.redactMessages([{ role: "user", content: "mail ada@x.io" }], null);
      assert.equal(res.messages[0].content, "mail [EMAIL_1]");
      assert.ok(Date.now() - t0 < 1500);
      assert.match(logger.lines.warn[0], /timed out/);
    } finally {
      hang.server.closeAllConnections();
      await hang.close();
    }
  });

  test("no Presidio URL: built-ins only, no requests", async () => {
    const r = createRedactor({ privacy: { presidioUrl: "" } });
    assert.equal(r.presidioEnabled, false);
    assert.equal(await r.presidioHealth(), false);
    const res = await r.redactMessages([{ role: "user", content: "tell Maria Garcia, ada@x.io" }], null);
    assert.equal(res.messages[0].content, "tell Maria Garcia, [EMAIL_1]");
  });
});
