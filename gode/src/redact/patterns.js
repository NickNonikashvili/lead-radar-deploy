"use strict";
// Built-in recognizers for personal data. These always run, Presidio or not, so they are the floor of
// the privacy promise: when Presidio is down or not deployed, this file alone decides what leaves.
// Precision matters as much as recall: every false positive costs answer quality (the model sees
// "[PHONE_1]" instead of a date), every false negative leaks. Structured types are validated
// (Luhn, mod-97, SSN ranges) instead of trusting the regex shape alone.
//
// Entity: { type, start, end, score, value }  (UTF-16 offsets, end exclusive)

const net = require("net");

// ---------------------------------------------------------------------------------------------
// Word lists for the PERSON heuristics. Three tiers of "this is not a name":
//   STRONG_REJECT  for strong triggers ("my name is", "Dr."), where almost anything capitalised is a name
//   MEDIUM_REJECT  for salutations/sign-offs/field labels ("Dear X", "Regards,\nX")
//   COMMON_WORDS   for weak triggers ("I'm X", "Hi X,") and for propagating names through the text
// ---------------------------------------------------------------------------------------------
const words = (s) => s.trim().split(/\s+/);

const STOPWORDS = words(`
  a an the and or but nor not no yes so if then than that this these those there here it its i me my
  mine we us our ours you your yours he him his she her hers they them their theirs is am are was were be
  been being has have had do does did to of in on at by for with from about as into onto upon over under
  after before between through during without within again also just only very too all any some each
  every both either neither few many much more most other such own same what which who whom whose when
  where why how because while until unless although though however please thanks thank sorry hi hello
  hey dear ok okay well oh now today tomorrow yesterday tonight let lets let's i'm im it's its
`);
const DAYS = words(`monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri`);
// Months that are also common given names stay out of the medium tier ("Dear June," is a person).
const MONTHS_NOT_NAMES = words(`january february march july september october november december jan feb mar apr jun jul aug sep sept oct nov dec`);
const MONTHS_NAMES = words(`april may june august`);
const TITLES = words(`mr mrs ms mx miss dr prof professor sir dame madam madame mme mlle herr frau rev st saint captain capt officer sgt lord lady`);
const SALUTATIONS = words(`
  sirs team all everyone everybody folks guys friends friend colleague colleagues customer customers
  client clients valued hiring manager managers recruiter recruiters applicant candidate parent parents
  reader readers editor editors support admissions committee board member members staff department
  office sales service services management hr admin administrator user users world there again mom mum
  dad mother father sister brother son daughter grandma grandpa diary god sirs ladies gentlemen
  community partner partners owner owners neighbor neighbour host guest guests student students
  teacher teachers people human humans bot assistant agent
`);
const GENERAL = words(`
  going gonna looking trying working thinking wondering planning writing getting having feeling doing
  making taking coming starting running building learning reading asking calling hoping leaving moving
  using studying applying sending waiting reaching following checking interested excited happy sad glad
  fine good great sure ready done new back home tired busy free available afraid aware able late early
  right wrong alone single married pregnant sick ill hungry bored confused stuck lost curious worried
  concerned scared nervous stressed unsure certain positive still really actually currently always
  never almost kind sort big fan huge old young retired unemployed freelance freelancer developer
  engineer designer writer doctor nurse founder ceo cto coo cfo vp beginner expert author programmer
  consultant lawyer analyst scientist researcher marketer seller buyer like best better first last next
  important interesting curious honest serious sorry grateful thankful pleased delighted impressed
  american british english french german spanish italian portuguese dutch swedish norwegian danish
  finnish polish russian ukrainian chinese japanese korean indian pakistani canadian australian
  mexican brazilian argentinian irish scottish welsh african european asian arab turkish greek israeli
  iranian vietnamese thai filipino indonesian nigerian kenyan egyptian swiss austrian belgian czech
  hungarian romanian python java javascript typescript react node linux windows mac apple google
  microsoft amazon excel word chrome docker github gode claude chatgpt gemini openai sql api
  something someone anyone nothing everything thing things one two three four five ten hundred
  morning afternoon evening night week month year weekend holiday christmas easter regards cheers
  sincerely best wishes love thanks yours truly faithfully respectfully cordially warmly
  regarding subject re fw fwd note notes update question questions issue problem request order invoice
  attached please kindly quick final draft hello hey hi welcome congratulations happy birthday
  maybe perhaps later soon anytime whenever asap passionate eager keen thrilled motivated confident
  experienced qualified skilled dedicated committed responsible reliable flexible open honored
  honoured proud humbled certified licensed based located available writing reaching contacting
  could would should might must shall
  summarise summarize explain translate rewrite write describe list compare analyse analyze draft fix
  debug review create generate convert tell show give find make help calculate outline brainstorm
  suggest recommend plan design refactor optimise optimize implement build deploy test edit proofread
  paraphrase simplify classify extract
  kubernetes k8s postgres postgresql mysql sqlite mongodb redis nginx apache aws azure gcp terraform
  ansible kafka spark hadoop pandas numpy scipy django flask fastapi rails laravel vue angular svelte
  nextjs nuxt rust golang swift kotlin scala ruby php perl bash zsh powershell git npm yarn pnpm webpack
  vite babel jest pytest selenium playwright figma notion slack jira confluence salesforce shopify
  stripe wordpress tailwind bootstrap graphql grpc json yaml html css xml csv pdf llm gpt ios android
  ubuntu debian fedora macos unix
`);
// Common English words that are also given names: rejected only by the weak tier.
const NAME_LIKE = words(`
  mark bill grace hope joy rose faith summer winter spring autumn fall art chase dawn frank guy ray rich
  sue pat sky star honey baby angel buddy pal mate dude bro sis love will may can
`);

const DAY_SET = new Set(DAYS);
const STRONG_REJECT = new Set([...STOPWORDS, ...DAYS, ...TITLES]);
const MEDIUM_REJECT = new Set([...STRONG_REJECT, ...MONTHS_NOT_NAMES, ...SALUTATIONS, ...GENERAL]);
// Name-like words: a weak trigger accepts them only next to an unambiguous name ("I'm Grace Hopper").
const SOFT_WORDS = new Set([...MONTHS_NAMES, ...NAME_LIKE]);
const COMMON_WORDS = new Set([...MEDIUM_REJECT, ...SOFT_WORDS]);

/** True if a single word is a common English word (used to sanity-check NER output too). */
function isCommonWord(word) {
  return COMMON_WORDS.has(String(word || "").toLowerCase().replace(/['’]s$/, ""));
}

// ---------------------------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------------------------

/** Luhn checksum over the digits of `input` (spaces/dashes ignored). */
function luhnValid(input) {
  const digits = String(input ?? "").replace(/[\s-]/g, "");
  if (!/^\d{2,}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// IBAN lengths per country (SWIFT IBAN registry). An exact length per country plus mod-97 keeps the
// false-positive rate on ordinary alphanumeric text negligible.
const IBAN_LENGTHS = Object.freeze({
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27, BR: 29, BY: 28,
  CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18,
  FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HN: 28, HR: 21, HU: 28,
  IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20,
  LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28,
  NL: 18, NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33, SA: 24,
  SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26,
  UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
});

/** IBAN check: known country, exact length for that country, ISO 13616 mod-97 == 1. */
function ibanValid(input) {
  const s = String(input ?? "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  if (IBAN_LENGTHS[s.slice(0, 2)] !== s.length) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digits = code >= 65 ? String(code - 55) : ch; // A=10 … Z=35
    for (let i = 0; i < digits.length; i++) rem = (rem * 10 + (digits.charCodeAt(i) - 48)) % 97;
  }
  return rem === 1;
}

/** US SSN structural validity: area not 000/666/9xx, group not 00, serial not 0000, not one repeated digit. */
function ssnValid(input) {
  const d = String(input ?? "").replace(/[\s-]/g, "");
  if (!/^\d{9}$/.test(d)) return false;
  const area = Number(d.slice(0, 3));
  if (area === 0 || area === 666 || area >= 900) return false;
  if (d.slice(3, 5) === "00" || d.slice(5) === "0000") return false;
  return !/^(\d)\1{8}$/.test(d);
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function entity(type, start, end, score, text) {
  return { type, start, end, score, value: text.slice(start, end) };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Values like "string", "<password>", "${DB_PASS}" or "process.env.X" are code, not secrets. */
function isPlaceholderSecret(value) {
  const v = value.replace(/[.,;)]+$/, "");
  if (v.length < 3) return true;
  if (/^[<{[$%*#]/.test(v) || /^\*+$|^x{3,}$|^\.{3,}$/i.test(v)) return true;
  if (/^(?:process\.env|os\.environ|env\.|config\.|settings\.|req\.|request\.|self\.|this\.)/i.test(v)) return true;
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(v) && !/\d/.test(v)) return true; // member access
  if (/\($|\)$/.test(v)) return true; // function call
  // Instructions ("password: click the link") rather than a value.
  if (/^[a-z]+$/.test(v) && (isCommonWord(v) || /^(?:click|tap|enter|reset|change|forgot|forgotten|type|use|see|login|log|sign|update|create|choose|pick|press|follow|visit|go|check|contact)$/.test(v))) return true;
  return /^(?:string|str|number|int|integer|bool|boolean|null|nil|none|undefined|required|optional|true|false|any|text|char|varchar|password|passwd|secret|token|hidden|redacted|example|changeme|placeholder|your[_-]?\w*|my[_-]?password|empty|blank|same|below|above|here|there|incorrect|wrong|invalid|correct|weak|strong|missing|set|unset|not|the|a|an|is|of|for|to)$/i.test(v);
}

// ---------------------------------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------------------------------
// Bounded quantifiers keep this linear on hostile input (no catastrophic backtracking).
const EMAIL_RE = /(?<![\w.%+-])[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.){1,8}[A-Za-z]{2,24}(?![\w-])/g;
// "postgres://user:pa55@host" — the "pa55@host" part is a URL credential, not an email.
const URL_USERINFO_BEFORE = /[a-z][a-z0-9+.-]{0,20}:\/\/[^\s/@:]{0,128}:$/i;

function detectEmails(text, out) {
  for (const m of text.matchAll(EMAIL_RE)) {
    if (URL_USERINFO_BEFORE.test(text.slice(Math.max(0, m.index - 160), m.index))) continue;
    out.push(entity("EMAIL", m.index, m.index + m[0].length, 1, text));
  }
}

// ---------------------------------------------------------------------------------------------
// SECRET
// ---------------------------------------------------------------------------------------------
// Structured tokens: the prefix alone is a strong signal; the body check rules out kebab-case words
// ("sk-learn-model-selection").
const TOKEN_PATTERNS = [
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,256}/g, body: 7 },
  { re: /\bsk-(?:proj-|svcacct-|admin-|or-v1-)?[A-Za-z0-9_-]{20,256}/g, body: 3 },
  { re: /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,256}\b/g },
  { re: /\bwhsec_[A-Za-z0-9+/=]{16,256}/g },
  { re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { re: /\bgh[pousr]_[A-Za-z0-9]{30,255}\b/g },
  { re: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/g },
  { re: /\bglpat-[A-Za-z0-9_-]{20,64}\b/g },
  { re: /\bhf_[A-Za-z0-9]{30,64}\b/g },
  { re: /\bxox[abposr]-[A-Za-z0-9-]{10,250}/g },
  { re: /\bAIza[0-9A-Za-z_-]{35}(?![\w-])/g },
  { re: /\beyJ[A-Za-z0-9_-]{8,2048}\.eyJ[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{8,2048}/g }, // JWT
  { re: /-----BEGIN (?:[A-Z0-9]+ ){0,3}PRIVATE KEY-----[\s\S]{16,8192}?-----END (?:[A-Z0-9]+ ){0,3}PRIVATE KEY-----/g },
];

function looksRandom(body) {
  const digits = (body.match(/\d/g) || []).length;
  const upper = (body.match(/[A-Z]/g) || []).length;
  return digits >= 2 && (upper >= 1 || body.length >= 32) && !body.includes("--");
}

// Context secrets: the value after "password:", "api_key=", "Bearer", FOO_TOKEN=…
const CONTEXT_PATTERNS = [
  {
    re: /\b(?:password|passwd|passphrase|passcode|pwd)\b(?:[ \t]+(?:is|was)[ \t]*:?|[ \t]*[:=])[ \t]*(["'`]?)([^\s"'`]{3,128})\1/dgiu,
    score: 0.9,
  },
  { re: /\bpin(?:[ \t]*code)?\b(?:[ \t]+(?:is|was)[ \t]*:?|[ \t]*[:=])[ \t]*()(\d{4,8})(?!\d)/dgiu, score: 0.85 },
  {
    re: /\b(?:api[_ -]?key|apikey|secret[_ -]?key|client[_ -]?secret|access[_ -]?token|auth[_ -]?token|refresh[_ -]?token|bearer[_ -]?token|private[_ -]?key|secret|token)\b["']?[ \t]*[:=][ \t]*(["'`]?)([A-Za-z0-9_\-./+=~]{12,512})\1/dgiu,
    score: 0.85,
    random: true,
  },
  {
    re: /\b[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|APIKEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIALS?)[A-Z0-9_]*[ \t]*[:=][ \t]*(["'`]?)([^\s"'`]{6,512})\1/dgu,
    score: 0.9,
  },
  { re: /\bbearer[ \t]+()([A-Za-z0-9_\-.~+/]{16,2048}=*)/dgiu, score: 0.9, random: true },
  { re: /\bauthorization[ \t]*:[ \t]*basic[ \t]+()([A-Za-z0-9+/]{8,1024}={0,2})/dgiu, score: 0.9 },
];

// scheme://user:password@host → the "user:password" part is the secret; the host stays readable.
const URL_CREDENTIALS_RE = /\b[a-z][a-z0-9+.-]{1,20}:\/\/([^\s:/@]{1,128}):([^\s/@]{1,256})@/dgiu;

function detectSecrets(text, out) {
  for (const { re, body = 0 } of TOKEN_PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (body && !looksRandom(m[0].slice(body))) continue;
      out.push(entity("SECRET", m.index, m.index + m[0].length, 1, text));
    }
  }
  for (const { re, score, random } of CONTEXT_PATTERNS) {
    for (const m of text.matchAll(re)) {
      let [start, end] = m.indices[2];
      let value = text.slice(start, end);
      // "{ password: hashed, ... }": an unquoted identifier followed by code punctuation is a variable.
      if (!m[1] && /^[A-Za-z_$][\w$]*[,;)}\]]$/.test(value) && !/\d/.test(value)) continue;
      if (!m[1] && /^[a-z]+(?:[A-Z][a-z]+)+$/.test(value)) continue; // camelCase identifier
      // A sentence-final period/comma is far more likely punctuation than part of the password.
      const trimmed = value.replace(/[.,;)]+$/, "");
      end -= value.length - trimmed.length;
      value = trimmed;
      if (!value || isPlaceholderSecret(value)) continue;
      if (random && !(/\d/.test(value) && /[A-Za-z]/.test(value))) continue;
      out.push(entity("SECRET", start, end, score, text));
    }
  }
  for (const m of text.matchAll(URL_CREDENTIALS_RE)) {
    if (isPlaceholderSecret(m[2])) continue;
    out.push(entity("SECRET", m.indices[1][0], m.indices[2][1], 0.95, text));
  }
}

// ---------------------------------------------------------------------------------------------
// CARD — 13–19 digits, optional consistent spaces/dashes, Luhn-valid, plausible issuer prefix.
// ---------------------------------------------------------------------------------------------
const CARD_RE = /(?<![\w+./-])\d(?:[ -]?\d){12,18}(?![\w]|[./-]\d)/g;

function validCard(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  if (!/^[2-6]/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  const seps = raw.match(/[ -]/g);
  if (seps) {
    if (new Set(seps).size > 1) return false;
    const groups = raw.split(/[ -]/);
    if (groups[0].length !== 4) return false;
    if (groups.slice(0, -1).some((g) => g.length < 4 || g.length > 6)) return false;
    if (groups[groups.length - 1].length > 6) return false;
  }
  return luhnValid(digits);
}

function detectCards(text, out) {
  for (const m of text.matchAll(CARD_RE)) {
    let raw = m[0];
    // "4111 1111 1111 1111 12" → retry without trailing groups that are not part of the number.
    for (let tries = 0; tries < 3 && raw; tries++) {
      if (validCard(raw)) {
        out.push(entity("CARD", m.index, m.index + raw.length, 1, text));
        break;
      }
      const cut = raw.search(/[ -]\d+$/);
      if (cut < 0) break;
      raw = raw.slice(0, cut);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// IBAN — country code + check digits + BBAN, compact or in groups of four.
// ---------------------------------------------------------------------------------------------
const IBAN_RE = /(?<![\w])[A-Za-z]{2}\d{2}(?:[ ]?[A-Za-z0-9]{4}){2,7}(?:[ ]?[A-Za-z0-9]{1,4})?(?![\w])/g;

function plausibleIban(raw) {
  if (!ibanValid(raw)) return false;
  // Every registered IBAN's BBAN is at least half digits; prose that happens to fit the shape is not.
  const bban = raw.replace(/\s/g, "").slice(4);
  return (bban.match(/\d/g) || []).length * 2 >= bban.length;
}

function detectIbans(text, out) {
  for (const m of text.matchAll(IBAN_RE)) {
    let raw = m[0];
    for (let tries = 0; tries < 3 && raw; tries++) {
      if (plausibleIban(raw)) {
        out.push(entity("IBAN", m.index, m.index + raw.length, 1, text));
        break;
      }
      const cut = raw.lastIndexOf(" ");
      if (cut < 0) break;
      raw = raw.slice(0, cut);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// SSN — "123-45-6789" / "123 45 6789"; a bare 9-digit run only next to an SSN keyword.
// ---------------------------------------------------------------------------------------------
const SSN_RE = /(?<![\w-])\d{3}([- ])\d{2}\1\d{4}(?![\w]|-\d)/g;
const SSN_BARE_RE = /(?<![\w-])\d{9}(?![\w])/g;
const SSN_CONTEXT = /\b(?:ssn|ss#|social[ -]security(?:[ -](?:number|no\.?|#))?|itin|tin|taxpayer[ -]id(?:entification)?(?:[ -]number)?)\b[^\n]{0,30}$/i;

function detectSsns(text, out) {
  for (const m of text.matchAll(SSN_RE)) {
    if (!ssnValid(m[0])) continue;
    const ctx = SSN_CONTEXT.test(text.slice(Math.max(0, m.index - 50), m.index));
    out.push(entity("SSN", m.index, m.index + m[0].length, ctx ? 0.95 : 0.85, text));
  }
  for (const m of text.matchAll(SSN_BARE_RE)) {
    if (!ssnValid(m[0])) continue;
    if (!SSN_CONTEXT.test(text.slice(Math.max(0, m.index - 50), m.index))) continue;
    out.push(entity("SSN", m.index, m.index + 9, 0.9, text));
  }
}

// ---------------------------------------------------------------------------------------------
// IP — v4 and v6. Loopback/unspecified/broadcast addresses identify no one and are everywhere in
// code questions, so they are left alone.
// ---------------------------------------------------------------------------------------------
const IPV4_RE = /(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\w]|\.\d)/g;
const IPV6_RE = /(?<![\w:.])[0-9A-Fa-f]{0,4}(?::[0-9A-Fa-f]{0,4}){2,7}(?:(?<=:)(?:\d{1,3}\.){3}\d{1,3})?(?![\w:]|\.\d)/g;

function boringIp(ip) {
  return /^(?:127\.|0\.0\.0\.0$|255\.255\.255\.255$)/.test(ip) || /^(?:::1?|0*:0*:0*:0*:0*:0*:0*:0*1?)$/i.test(ip);
}

function detectIps(text, out) {
  for (const m of text.matchAll(IPV4_RE)) {
    if (boringIp(m[0])) continue;
    out.push(entity("IP", m.index, m.index + m[0].length, 0.9, text));
  }
  for (const m of text.matchAll(IPV6_RE)) {
    const ip = m[0];
    // "abc::def" (C++ scope), "12:30:45" (times) and Python slices "x[1::2]" fail these checks.
    const groups = ip.split(/[:.]/).filter(Boolean);
    if (!net.isIPv6(ip) || !/\d/.test(ip) || boringIp(ip)) continue;
    if (groups.length < 2 || !groups.some((g) => g.length >= 3)) continue;
    out.push(entity("IP", m.index, m.index + ip.length, 0.9, text));
  }
}

// ---------------------------------------------------------------------------------------------
// PHONE — the noisiest type. A permissive candidate regex, then validation that rejects dates,
// years, prices, versions, IPs, card-shaped and thousands-separated numbers. Unformatted digit runs
// only count with a phone keyword nearby or a valid North American / national-trunk shape.
//
// Numbers separated only by spaces are the weakest signal of all: logs, tables and lists put
// numbers side by side all the time ('"GET / HTTP/1.1" 200 5123' is a status code and a byte
// count, "ports 8080 8443 9000" are ports). Without a phone keyword or a "+" they count only in a
// few unmistakable national shapes (see spaceGroupedPhone). Dashes, dots and parentheses are how
// people actually write phone numbers, so those keep the general rules.
// ---------------------------------------------------------------------------------------------
const PHONE_RE = /(?<![\w+$€£¥₹./-])\+?(?:\(\d{1,4}\)[ .-]?|\d)[\d .()-]{4,24}\d(?![\w]|[.,]\d)/gu;
const PHONE_CONTEXT = /\b(?:phone|tel|telephone|mobile|mob|cell|cellphone|call|text|sms|whatsapp|signal|telegram|fax|contact|number|no\.|nr\.|ring|reach|dial)\b[^\n]{0,25}$/i;
// An identifier label right before the number ("order #", "invoice no.", "build", "port", "PID"):
// the number names a thing, not a person. It wins over PHONE_CONTEXT, which also matches
// "no."/"number" ("order number 555-123-4567" is an order). Personal identifiers such as account
// numbers are deliberately absent: redacting one of those as a phone is the safe mistake.
const ID_BEFORE = new RegExp(
  String.raw`\b(?:order|invoice|receipt|ticket|issue|bug|pr|ref|reference|sku|item|product|part|serial|tracking|shipment|parcel|` +
    String.raw`transaction|txn|build|version|ver|release|rev|revision|commit|pid|uid|gid|id|port|job|batch|lot|row|error|status)s?` +
    String.raw`[ \t]*(?:(?:#|no\.?|nr\.?|num(?:ber)?\.?|id)[ \t]*)?[:=#]?[ \t]*$`,
  "i"
);
// "#1234 5678" right before the number: an issue/ticket reference unless a phone keyword says otherwise.
const HASH_BEFORE = /#[ \t]*$/;
// A phone number never starts with a calendar date ("2026.11.26.1234" is a build, "2026-11-26 10" a timestamp).
const ISO_DATE_PREFIX = /^(?:19|20)\d{2}([-./])(?:0?[1-9]|1[0-2])\1(?:0?[1-9]|[12]\d|3[01])(?!\d)/;
const CURRENCY_BEFORE = /(?:[$€£¥₹]|\b(?:usd|eur|gbp|chf|jpy|cad|aud|sek|nok|dkk|inr|rs\.?))[ \t]*$/i;
const CURRENCY_AFTER = /^[ \t]*(?:[$€£¥₹%]|(?:usd|eur|gbp|chf|jpy|cad|aud|sek|nok|dkk|inr|dollars?|euros?|pounds?|bucks|kr|ms|kb|mb|gb|px)\b)/i;

const isYear = (g) => /^(?:19|20)\d{2}$/.test(g);

/**
 * Space-separated digit groups (no "+", no keyword nearby) that are phone numbers on their own.
 * Anything else written this way needs a keyword ("call me on 6123 4567"): local numbers without an
 * area code and other countries' spaced formats are given up here on purpose, because the same
 * shapes fill every log line and table ("200 5123", "1024 2048", "12 34 56 78 90").
 */
function spaceGroupedPhone(body) {
  const groups = body.split(" ");
  const digits = groups.join("");
  if (/^(\d)\1+$/.test(digits)) return false; // "0000 0000 0000": padding, hex-dump offsets
  // National trunk prefix ("020 7946 0958", "07911 123456", "06 12 34 56 78") or 00 + country code.
  if (/^0(?:[1-9]\d{0,3}|0[1-9]\d{0,2})$/.test(groups[0]) && digits.length >= 9) return true;
  if (/^(?:1 )?[2-9]\d{2} [2-9]\d{2} \d{4}$/.test(body)) return true; // North America: "212 555 1234"
  if (/^[6-9]\d{4} \d{5}$/.test(body)) return true; // India mobile: "98765 43210"
  if (/^1[3-9]\d \d{4} \d{4}$/.test(body)) return true; // China mobile: "138 0013 8000"
  return false;
}

function isDateLike(s) {
  let m = /^(\d{4})[-./ ](\d{1,2})[-./ ](\d{1,2})$/.exec(s);
  if (m) return isYear(m[1]) && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
  m = /^(\d{1,2})[-./ ](\d{1,2})[-./ ](\d{4}|\d{2})$/.exec(s);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    return a >= 1 && b >= 1 && ((a <= 31 && b <= 12) || (a <= 12 && b <= 31));
  }
  return false;
}

/** Looks like a card number (valid or not): never a phone, even when the Luhn check fails. */
function cardShaped(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  if (validCard(raw)) return true;
  const groups = raw.split(/[ -]/);
  return groups.length >= 3 && groups.slice(0, -1).every((g) => g.length === 4);
}

/** Score a phone candidate string, 0 = not a phone. `before` is the text preceding it. */
function phoneScore(s, before) {
  let context; // computed at most once (after phoneShapeScore's cheap checks)
  const hasContext = () => (context ??= PHONE_CONTEXT.test(before));
  const score = phoneShapeScore(s, hasContext);
  if (!score || s.startsWith("+")) return score;
  // Identifier labels are checked last: the costliest test, and most candidates fail earlier.
  if (ID_BEFORE.test(before) || (HASH_BEFORE.test(before) && !hasContext())) return 0;
  return score;
}

/** The shape rules of phoneScore. `hasContext()` says whether a phone keyword precedes the candidate. */
function phoneShapeScore(s, hasContext) {
  const intl = s.startsWith("+");
  const body = (intl ? s.slice(1) : s).replace(/\(0\)/g, " ");
  const digits = body.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || (intl && digits.length < 8)) return 0;
  if (!/^[\d(]/.test(body) || !/\d$/.test(body)) return 0;

  const opens = (body.match(/\(/g) || []).length;
  const closes = (body.match(/\)/g) || []).length;
  if (opens !== closes || opens > 1) return 0;
  if (opens && !/^\(\d{1,4}\)|[ .-]\(\d{1,4}\)/.test(body)) return 0;

  const context = hasContext();
  const formatted = /[ .()-]/.test(body);
  // Space-only grouping first: it rejects most of what logs and tables produce, cheaply.
  if (formatted && !intl && !context && /^[\d ]+$/.test(body) && !spaceGroupedPhone(body)) return 0;
  if (!formatted) {
    if (intl) return 0.8;
    if (luhnValid(digits) && digits.length >= 13) return 0; // a bare card number
    if (context) return 0.75;
    if (/^1?[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return 0.6; // NANP 10/11 digits
    if (/^0[1-9]\d{8,9}$/.test(digits)) return 0.6; // national trunk prefix (UK, EU)
    return 0;
  }

  const groups = body.split(/[ .()-]+/).filter(Boolean);
  // "1 2 3 4 5 6 7" and ISBNs have single-digit groups; "+33 6 12 34 56 78" may after the country code.
  if (groups.some((g, i) => g.length < 2 && i > (intl ? 1 : 0))) return 0;
  if (isDateLike(body) || (groups.length >= 2 && groups.every(isYear))) return 0;
  // A date glued to more digits: "2026-11-26 10" (then ":15:32"), "2026.11.26.1234" (a build).
  if (ISO_DATE_PREFIX.test(body) || body.split(" ").some(isDateLike)) return 0;
  if (/^\d{3}[- ]\d{2}[- ]\d{4}$/.test(body)) return 0; // SSN shape
  if (body.includes(".")) {
    // Dots: only "555.123.4567" / "01.23.45.67.89" styles; never versions, decimals or IPv4.
    if (/[ -]/.test(body) || groups.length < 3) return 0;
    if (groups.some((g) => g.length < 2 || g.length > 4)) return 0;
    if (!intl && groups.length === 4 && groups.every((g) => g.length <= 3)) return 0;
  }
  // "1 234 567" is a number with thousands separators, not a phone.
  if (!intl && !context && /^[\d .]+$/.test(body) && groups.length >= 2 && groups[0].length <= 3 && groups.slice(1).every((g) => g.length === 3)) {
    return 0;
  }
  return (intl ? 0.8 : 0.7) + (context ? 0.1 : 0);
}

function detectPhones(text, out) {
  for (const m of text.matchAll(PHONE_RE)) {
    const raw = m[0];
    const start = m.index;
    const before = text.slice(Math.max(0, start - 40), start);
    if (CURRENCY_BEFORE.test(before) || CURRENCY_AFTER.test(text.slice(start + raw.length, start + raw.length + 12))) continue;
    if (!raw.startsWith("+") && cardShaped(raw)) continue; // "+4915112345678" may pass Luhn by chance

    // The candidate may glue a phone to neighbouring numbers ("on 2026-11-26 555-123-4567"): try the
    // whole run first, then shorter runs of whole space-separated words, longest and leftmost first.
    const parts = [];
    const digitsBefore = [0]; // prefix sums, so runs that cannot hold 7–15 digits are skipped cheaply
    for (const w of raw.matchAll(/[^ ]+/g)) {
      parts.push({ s: w.index, e: w.index + w[0].length });
      digitsBefore.push(digitsBefore[digitsBefore.length - 1] + w[0].replace(/\D/g, "").length);
    }
    let found = null;
    // No real phone format has more than 7 space-separated groups ("+33 1 23 45 67 89" has 6).
    for (let len = Math.min(parts.length, 7); len >= 1 && !found; len--) {
      for (let i = 0; i + len <= parts.length; i++) {
        const nDigits = digitsBefore[i + len] - digitsBefore[i];
        if (nDigits < 7 || nDigits > 15) continue;
        const s = parts[i].s;
        const e = parts[i + len - 1].e;
        const score = phoneScore(raw.slice(s, e), text.slice(Math.max(0, start + s - 40), start + s));
        if (score) {
          found = { s, e, score };
          break;
        }
      }
    }
    if (found) out.push(entity("PHONE", start + found.s, start + found.e, found.score, text));
  }
}

// ---------------------------------------------------------------------------------------------
// PERSON — trigger phrases followed by a name. Names: capitalised tokens (Unicode), with O'Brien,
// Jean-Luc, McDonald, middle initials and particles ("van", "de"). Each trigger says how sure it is
// and which word list rules a token out.
// ---------------------------------------------------------------------------------------------
const NAME_TOKEN = /(?:\p{Lu}['’](?=\p{Lu}))?\p{Lu}[\p{Ll}\p{M}]+(?:\p{Lu}[\p{Ll}\p{M}]+)?(?:['’-]\p{Lu}?[\p{Ll}\p{M}]+)*/uy;
const LOWER_NAME_TOKEN = /\p{Ll}[\p{Ll}\p{M}]+(?:['’-]\p{Ll}[\p{Ll}\p{M}]+)*/uy;
const INITIAL_TOKEN = /\p{Lu}\./uy;
const PARTICLE_TOKEN = /(?:van|von|de|da|di|del|della|der|den|du|la|le|bin|ibn|al|el)(?=[ \u00a0]\p{Lu})/uy;

// After a sign-off / field label the name must end the line (optionally followed by ", CEO", "<mail>").
const LINE_END = /^[ \t]*(?:[.!]?[ \t]*(?:\r?\n|$)|[,;<(|–—-])/;
const GREETING_END = /^[ \t]*(?:[,!:]|\r?\n|$)/;
const INTRO_END = /^[ \t]+(?:from|here|speaking|calling|again)\b/i;

const SIGNOFFS = String.raw`(?:(?:best|kind|warm|warmest|many|with)[ \t]+(?:regards|wishes|thanks)|regards|best|cheers|thanks(?:[ \t]+(?:again|so much|a lot))?|thank you(?:[ \t]+(?:again|so much))?|sincerely|yours(?:[ \t]+(?:sincerely|truly|faithfully))?|respectfully|cordially|love|all the best|take care|talk soon|xoxo|warmly|with gratitude)`;
const RELATIONS = String.raw`(?:(?:ex-?)?(?:wife|husband|partner|girlfriend|boyfriend|fianc[eé]e?)|son|daughter|kid|child|mom|mum|mother|dad|father|brother|sister|sibling|(?:best )?friend|boss|manager|colleague|co-?worker|neighbou?r|doctor|dentist|therapist|lawyer|attorney|accountant|client|customer|teacher|student|cousin|uncle|aunt|niece|nephew|grandma|grandmother|grandpa|grandfather|landlord|landlady|tenant|roommate|flatmate|employee|assistant|coach)`;

const PERSON_TRIGGERS = [
  { re: /\bmy[ \t]+name(?:[ \t]+is|['’]s)[ \t]+/giu, score: 0.9, reject: STRONG_REJECT, allowLower: true },
  { re: /\b(?:call me|i(?:['’]m| am) called|they call me|people call me)[ \t]+/giu, score: 0.8, reject: MEDIUM_REJECT },
  { re: /\b[Ii](?:['’]m| am)[ \t]+/gu, score: 0.7, reject: MEDIUM_REJECT, weak: true },
  { re: /\b(?:this is|it['’]s)[ \t]+/giu, score: 0.7, reject: MEDIUM_REJECT, weak: true, end: INTRO_END },
  { re: /\b(?:Mr|Mrs|Ms|Mx|Miss|Dr|Prof|Sir|Dame|Mme|Mlle|Herr|Frau)\.?[ \u00a0]+/gu, score: 0.85, reject: STRONG_REJECT },
  { re: /\bdear[ \t]+/giu, score: 0.8, reject: MEDIUM_REJECT },
  // Sign-off at the start of a line, or right after a sentence ("…by Friday. Thanks,\nAnna").
  { re: new RegExp(String.raw`(?:^|(?<=[.!?)][ \t]{1,4}))[ \t]*${SIGNOFFS}[ \t]*(?:,[ \t]*(?:\r?\n[ \t]*){0,2}|[.!]?[ \t]*(?:\r?\n[ \t]*){1,2})`, "gimu"), score: 0.75, reject: MEDIUM_REJECT, end: LINE_END },
  { re: /^[ \t]*(?:hi|hello|hey|hiya|howdy|greetings|good[ \t]+(?:morning|afternoon|evening))[ \t]+/gimu, score: 0.6, reject: MEDIUM_REJECT, weak: true, end: GREETING_END },
  { re: new RegExp(String.raw`\bmy[ \t]+${RELATIONS},?[ \t]+`, "giu"), score: 0.7, reject: MEDIUM_REJECT, weak: true },
  {
    re: /^[ \t]*(?:name|full name|first name|last name|surname|given name|contact(?: name)?|attn|attention|patient(?: name)?|client name|customer name|employee name|signed|from|to|cc|bcc|reply-to)[ \t]*:[ \t]*/gimu,
    score: 0.75,
    reject: MEDIUM_REJECT,
    end: LINE_END,
  },
];

function matchAt(re, text, pos) {
  re.lastIndex = pos;
  const m = re.exec(text);
  return m ? m[0] : null;
}

function isRejected(token, reject) {
  const w = token.toLowerCase();
  return reject.has(w) || DAY_SET.has(w);
}

/**
 * Read a name starting exactly at `pos`. Returns { start, end } or null. Tokens are separated by a
 * single space; the name stops at the first token that is a known non-name word.
 */
function readName(text, pos, { reject, allowLower = false, weak = false }) {
  const parts = [];
  let i = pos;
  for (let n = 0; n < 6 && parts.filter((p) => p.name).length < 3; n++) {
    if (n > 0) {
      if (text[i] !== " " && text[i] !== "\u00a0") break;
      i += 1;
    }
    let tok = matchAt(NAME_TOKEN, text, i);
    let lower = false;
    if (!tok && allowLower) {
      tok = matchAt(LOWER_NAME_TOKEN, text, i);
      lower = Boolean(tok);
    }
    const name = Boolean(tok);
    if (!tok && n > 0) tok = matchAt(INITIAL_TOKEN, text, i) || matchAt(PARTICLE_TOKEN, text, i);
    if (!tok) break;
    const after = text[i + tok.length];
    if (after && WORD_CHAR.test(after)) break; // "Ada2", "ADA": not a clean name token
    if (name) {
      const clean = tok.replace(/['’]s$/, "");
      if (isRejected(clean, lower ? COMMON_WORDS : reject)) break;
      parts.push({ start: i, end: i + clean.length, name: true });
      if (clean.length !== tok.length) break; // possessive ends the name
    } else {
      parts.push({ start: i, end: i + tok.length, name: false });
    }
    i += tok.length;
  }
  while (parts.length && !parts[parts.length - 1].name) parts.pop();
  if (!parts.length) return null;
  if (weak) {
    const names = parts.filter((p) => p.name).map((p) => text.slice(p.start, p.end));
    // "I'm May", "Hi Mark": too ambiguous alone; "I'm Grace Hopper" is fine.
    if (names.every((w) => SOFT_WORDS.has(w.toLowerCase()))) return null;
    // "I'm Going", "I am Passionate": gerunds and adjectives are far more common than names here.
    if (names.length === 1 && names[0].length >= 6 && /ing$/i.test(names[0])) return null;
    if (names.length === 1 && names[0].length >= 7 && /(?:ive|ful|ous|able|ible|ate)$/i.test(names[0])) return null;
  }
  return { start: parts[0].start, end: parts[parts.length - 1].end };
}

function detectPersonTriggers(text, out) {
  for (const t of PERSON_TRIGGERS) {
    for (const m of text.matchAll(t.re)) {
      const pos = m.index + m[0].length;
      const span = readName(text, pos, t);
      if (!span) continue;
      if (t.end && !t.end.test(text.slice(span.end, span.end + 80))) continue;
      out.push(entity("PERSON", span.start, span.end, t.score, text));
    }
  }
}

/**
 * Once "Ada Lovelace" is known to be a name, other mentions ("Ada said…") are too. Single tokens are
 * matched case-sensitively and only when they are not common words, so "Will" or "May" never spread.
 */
function propagateNames(text, persons, out) {
  const seen = new Set();
  for (const p of persons) {
    const tokens = p.value.split(/[ \u00a0]+/);
    const variants = [];
    if (tokens.length > 1) variants.push({ v: p.value, flags: "giu" });
    for (const tok of tokens) {
      if (tok.length < 3 || isCommonWord(tok) || /\.$/.test(tok)) continue;
      variants.push({ v: tok, flags: /^\p{Ll}/u.test(tok) ? "giu" : "gu" });
    }
    for (const { v, flags } of variants) {
      const key = `${flags}\u0000${v}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(v)}(?![\\p{L}\\p{N}_])`, flags);
      for (const m of text.matchAll(re)) out.push(entity("PERSON", m.index, m.index + m[0].length, 0.6, text));
    }
  }
}

function detectPersons(text, out) {
  const found = [];
  detectPersonTriggers(text, found);
  if (!found.length) return;
  out.push(...found);
  propagateNames(text, found, out);
}

// ---------------------------------------------------------------------------------------------
// Overlap resolution
// ---------------------------------------------------------------------------------------------

// High-risk types: one exposed fragment of these is already a leak (and a privacy signal).
const HIGH_RISK_TYPES = Object.freeze(["CARD", "IBAN", "SSN", "BANK_ACCOUNT", "PASSPORT", "SECRET"]);
const HIGH_RISK = new Set(HIGH_RISK_TYPES);

/** Order in which overlapping entities win: higher score, then longer span, then earlier start. */
const beats = (a, b) => b.score - a.score || b.end - b.start - (a.end - a.start) || a.start - b.start;

/**
 * A high-risk entity must never lose part of itself to an overlapping entity of another type: a
 * known name inside a password ("password: rex-1985!Qz" with "Rex" in the map) would otherwise win
 * on score, replace only "rex" and send "-1985!Qz" upstream, counted as PERSON. So within each
 * cluster of overlapping entities, a high-risk entity absorbs (takes the union of) every other-type
 * entity it overlaps, keeping its own type and score. Two exceptions keep the normal rule:
 * look-alikes the user typed ("[SECRET_1]") are text, not data; and an entity that fully covers the
 * high-risk one with a higher score already hides all of it. Between two high-risk entities the
 * winner absorbs the loser. Mutates and returns `list` minus the absorbed entries.
 */
function absorbIntoHighRisk(list) {
  if (!list.some((e) => HIGH_RISK.has(e.type) && !e.literal)) return list;
  list.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    if (cluster.length > 1) absorbCluster(cluster);
    for (const e of cluster) if (!e.absorbed) out.push(e);
    cluster = [];
  };
  for (const e of list) {
    if (cluster.length && e.start >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.end);
  }
  flush();
  return out;
}

function absorbCluster(cluster) {
  const isRisky = (e) => HIGH_RISK.has(e.type) && !e.literal;
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of cluster) {
      for (const b of cluster) {
        if (a === b || a.absorbed || b.absorbed) continue;
        if (b.end <= a.start || b.start >= a.end) continue; // no overlap
        if (a.type === b.type) {
          // Same-type spans were merged before, so only one that grew here can overlap another of
          // its type ("SECRET + PERSON" now reaching the next SECRET): merge again, or the ranking
          // below would drop one of them and expose the part only it covered.
          a.start = Math.min(a.start, b.start);
          a.end = Math.max(a.end, b.end);
          a.score = Math.max(a.score, b.score);
          a.literal = a.literal && b.literal;
          a.known = a.known && b.known;
          b.absorbed = true;
          changed = true;
          continue;
        }
        if (!isRisky(a) && !isRisky(b)) continue;
        // h absorbs x: h is the high-risk one, or the winner when both are.
        const [h, x] = isRisky(a) && (!isRisky(b) || beats(a, b) <= 0) ? [a, b] : [b, a];
        if (!isRisky(x) && x.start <= h.start && x.end >= h.end && x.score > h.score) continue;
        h.start = Math.min(h.start, x.start);
        h.end = Math.max(h.end, x.end);
        x.absorbed = true;
        changed = true;
      }
    }
  }
}

/**
 * Make entities non-overlapping, sorted by start.
 * 1. Overlapping entities of the SAME type merge into their union, so a partial span from one
 *    recognizer never leaves part of a value exposed ("Ada" + "Ada Lovelace" → "Ada Lovelace").
 * 2. A high-risk entity absorbs the other-type entities it overlaps (see absorbIntoHighRisk).
 * 3. Otherwise, across types, the higher score wins, then the longer span, then the earlier start.
 * Extra boolean flags (`literal`, `known`) survive a merge only when every merged part had them.
 */
function resolveOverlaps(entities, text) {
  const valid = entities.filter(
    (e) => e && typeof e.type === "string" && Number.isInteger(e.start) && Number.isInteger(e.end) && e.start >= 0 && e.end > e.start && e.end <= text.length
  );
  const byType = new Map();
  for (const e of valid) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type).push(e);
  }
  const merged = [];
  for (const list of byType.values()) {
    list.sort((a, b) => a.start - b.start || b.end - a.end);
    let cur = null;
    for (const e of list) {
      if (cur && e.start < cur.end) {
        cur.end = Math.max(cur.end, e.end);
        cur.score = Math.max(cur.score, e.score);
        cur.literal = cur.literal && Boolean(e.literal);
        cur.known = cur.known && Boolean(e.known);
      } else {
        if (cur) merged.push(cur);
        cur = { type: e.type, start: e.start, end: e.end, score: Number(e.score) || 0, literal: Boolean(e.literal), known: Boolean(e.known) };
      }
    }
    if (cur) merged.push(cur);
  }
  const ranked = absorbIntoHighRisk(merged).sort(beats);
  const accepted = []; // kept sorted by start
  for (const e of ranked) {
    let lo = 0;
    let hi = accepted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (accepted[mid].start < e.start) lo = mid + 1;
      else hi = mid;
    }
    const prev = accepted[lo - 1];
    const next = accepted[lo];
    if ((prev && prev.end > e.start) || (next && next.start < e.end)) continue;
    accepted.splice(lo, 0, e);
  }
  return accepted.map((e) => {
    const out = { type: e.type, start: e.start, end: e.end, score: e.score, value: text.slice(e.start, e.end) };
    if (e.literal) out.literal = true;
    if (e.known) out.known = true;
    return out;
  });
}

/** Run every built-in recognizer over `text`; returns non-overlapping entities sorted by start. */
function detectBuiltin(text) {
  if (typeof text !== "string" || !text) return [];
  const out = [];
  detectSecrets(text, out);
  detectEmails(text, out);
  detectCards(text, out);
  detectIbans(text, out);
  detectSsns(text, out);
  detectIps(text, out);
  detectPhones(text, out);
  detectPersons(text, out);
  return resolveOverlaps(out, text);
}

module.exports = {
  detectBuiltin,
  luhnValid,
  ibanValid,
  ssnValid,
  resolveOverlaps,
  isCommonWord,
  isDateLike,
  escapeRegExp,
  IBAN_LENGTHS,
  HIGH_RISK_TYPES,
};
