"use strict";

/**
 * Server-side checks: translations, formatting, validation, every public
 * route in every language, the enquiry flow and the admin inbox.
 *
 *   npm test
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

// Isolated data directory and admin credentials for the test run.
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "luxhouse-test-"));
process.env.DATA_DIR = DATA_DIR;
process.env.ADMIN_USER = "admin";
process.env.ADMIN_PASSWORD = "test-password";
process.env.BASE_URL = "https://example.test";
delete process.env.SMTP_HOST;
delete process.env.LEAD_WEBHOOK_URL;

const config = require("../src/config");
const i18n = require("../src/i18n");
const listings = require("../src/listings");
const validate = require("../src/validate");
const app = require("../server");

let server;
let base;
const AUTH = "Basic " + Buffer.from("admin:test-password").toString("base64");

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

const get = (p, opts) => fetch(base + p, Object.assign({ redirect: "manual" }, opts));
const post = (body, headers) =>
  fetch(base + "/api/inquiries", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: JSON.stringify(body) });

// ------------------------------------------------------------------ translations
function shape(value, prefix, out) {
  if (Array.isArray(value)) {
    out.push(`${prefix}[]`);
    // Plural-form arrays legitimately differ in length between languages; structured arrays must match.
    if (value.length && typeof value[0] === "object") value.forEach((v, i) => shape(v, `${prefix}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) shape(value[key], prefix ? `${prefix}.${key}` : key, out);
  } else {
    out.push(prefix);
  }
  return out;
}

test("every language has exactly the same translation keys", () => {
  const reference = shape(i18n.dicts.en, "", []).sort();
  for (const lang of ["ka", "ru"]) {
    const keys = shape(i18n.dicts[lang], "", []).sort();
    assert.deepEqual(keys.filter((k) => !reference.includes(k)), [], `${lang} has extra keys`);
    assert.deepEqual(reference.filter((k) => !keys.includes(k)), [], `${lang} is missing keys`);
  }
});

test("no translation string is empty and placeholders match English", () => {
  const leaves = (obj, prefix, out) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out[key] = v;
      else if (v && typeof v === "object") leaves(v, key, out);
    }
    return out;
  };
  const en = leaves(i18n.dicts.en, "", {});
  const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
  for (const lang of ["ka", "ru"]) {
    const other = leaves(i18n.dicts[lang], "", {});
    for (const [key, value] of Object.entries(other)) {
      assert.ok(value.trim().length > 0, `${lang}:${key} is empty`);
      if (key in en && !/\.count\.\d+$/.test(key)) assert.equal(placeholders(value), placeholders(en[key]), `${lang}:${key} placeholders differ`);
    }
  }
});

test("plural forms and number formatting", () => {
  const en = i18n.translator("en");
  const ru = i18n.translator("ru");
  const ka = i18n.translator("ka");
  assert.equal(en.n("residences.count", 1), "1 residence");
  assert.equal(en.n("residences.count", 3), "3 residences");
  assert.equal(ru.n("residences.count", 1), "1 резиденция");
  assert.equal(ru.n("residences.count", 3), "3 резиденции");
  assert.equal(ru.n("residences.count", 5), "5 резиденций");
  assert.equal(ru.n("residences.count", 11), "11 резиденций");
  assert.equal(ru.n("residences.count", 21), "21 резиденция");
  assert.equal(ka.n("residences.count", 3), "3 რეზიდენცია");
  assert.equal(en.money(2200000, "USD"), "$2,200,000");
  assert.equal(ru.money(2200000, "USD"), "$2 200 000");
  assert.equal(ka.money(2204305, "GEL"), "₾2 204 305");
  assert.equal(en.area(1497), "1,497 m²");
  assert.equal(ka.area(560), "560 მ²");
});

// ------------------------------------------------------------------ listings
test("listings load with complete, consistent data", () => {
  const all = listings.all();
  assert.equal(all.length, 3);
  const refs = new Set();
  for (const l of all) {
    assert.ok(!refs.has(l.ref), `duplicate ref ${l.ref}`);
    refs.add(l.ref);
    for (const lang of config.languages) {
      assert.ok(l.title[lang], `${l.slug}: title.${lang}`);
      assert.ok(l.tagline[lang], `${l.slug}: tagline.${lang}`);
      assert.ok(l.description[lang].length >= 2, `${l.slug}: description.${lang}`);
      assert.equal(l.description[lang].length, l.description.en.length, `${l.slug}: description.${lang} paragraph count`);
      assert.equal(l.highlights[lang].length, l.highlights.en.length, `${l.slug}: highlights.${lang} count`);
      assert.ok(l.location.district[lang], `${l.slug}: district.${lang}`);
    }
    assert.ok(l.photos.length >= 10, `${l.slug}: photos`);
    assert.ok(l.coverPhoto, `${l.slug}: cover`);
    for (const p of l.photos) {
      for (const w of p.widths) {
        const file = path.join(config.root, "public", "media", "listings", l.slug, `${p.file}-${w}.webp`);
        assert.ok(fs.existsSync(file), `missing image ${file}`);
      }
      assert.ok(i18n.dicts.en.rooms[p.room], `${l.slug}: unknown room "${p.room}"`);
    }
    for (const f of l.features) assert.ok(i18n.dicts.en.features[f], `${l.slug}: unknown feature "${f}"`);
    assert.ok(fs.existsSync(path.join(config.root, "public", "media", "listings", l.slug, "og.jpg")), `${l.slug}: og image`);
    assert.ok(l.location.lat > 41 && l.location.lat < 42.2 && l.location.lng > 44 && l.location.lng < 45.5, `${l.slug}: coordinates near Tbilisi`);
  }
  // Facts as published by the owners.
  const bySlug = Object.fromEntries(all.map((l) => [l.slug, l]));
  assert.equal(bySlug["tabakhmela-residence"].price.amount, 850000);
  assert.equal(bySlug["tabakhmela-residence"].facts.areaM2, 560);
  assert.equal(bySlug["tabakhmela-residence"].facts.bedrooms, 5);
  assert.equal(bySlug["dighomi-garden-house"].price.amount, 1000000);
  assert.equal(bySlug["dighomi-garden-house"].facts.areaM2, 322);
  assert.equal(bySlug["dighomi-garden-house"].facts.landM2, 1497);
  assert.equal(bySlug["dighomi-stone-villa"].price.amount, 2200000);
  assert.equal(bySlug["dighomi-stone-villa"].facts.areaM2, 675);
  assert.equal(bySlug["dighomi-stone-villa"].facts.landM2, 888);
});

test("search filters and sorting", () => {
  const slugs = (q) => listings.search(listings.parseFilters(q)).map((l) => l.slug);
  assert.equal(slugs({}).length, 3);
  assert.deepEqual(slugs({ maxPrice: "1000000", sort: "price-asc" }), ["tabakhmela-residence", "dighomi-garden-house"]);
  assert.deepEqual(slugs({ minBedrooms: "5" }), ["tabakhmela-residence"]);
  assert.deepEqual(slugs({ location: "tabakhmela" }), ["tabakhmela-residence"]);
  assert.deepEqual(slugs({ location: "nowhere" }).length, 3, "unknown location is ignored");
  assert.deepEqual(slugs({ minArea: "600" }), ["dighomi-stone-villa"]);
  assert.deepEqual(slugs({ pool: "1", sort: "price-desc" }), ["dighomi-stone-villa", "tabakhmela-residence"]);
  assert.deepEqual(slugs({ sort: "area" }), ["dighomi-stone-villa", "tabakhmela-residence", "dighomi-garden-house"]);
  assert.deepEqual(slugs({ maxPrice: "<script>" }).length, 3, "garbage is ignored");
});

// ------------------------------------------------------------------ validation
test("enquiry validation", () => {
  const find = listings.bySlug;
  const ok = { type: "viewing", lang: "ka", name: "Nino Beridze", phone: "+995 555 12 34 56", consent: true, slug: "dighomi-stone-villa", date: "2026-12-01" };
  const r = validate.inquiry(ok, find);
  assert.equal(r.ok, true);
  assert.equal(r.value.listing.ref, "LH-1003");
  assert.equal(r.value.date, "2026-12-01");
  assert.equal(r.value.lang, "ka");

  assert.deepEqual(validate.inquiry({ ...ok, name: "" }, find).errors, { name: "errName" });
  assert.deepEqual(validate.inquiry({ ...ok, phone: "", email: "" }, find).errors, { contact: "errContact" });
  assert.deepEqual(validate.inquiry({ ...ok, phone: "abc" }, find).errors, { phone: "errPhone" });
  assert.deepEqual(validate.inquiry({ ...ok, phone: "", email: "not-an-email" }, find).errors, { email: "errEmail" });
  assert.deepEqual(validate.inquiry({ ...ok, consent: false }, find).errors, { consent: "errConsent" });
  assert.equal(validate.inquiry({ ...ok, website: "http://spam" }, find).spam, true);
  assert.equal(validate.inquiry({ ...ok, slug: "does-not-exist" }, find).value.listing, undefined);
  assert.equal(validate.inquiry({ ...ok, date: "tomorrow" }, find).value.date, undefined);
  assert.equal(validate.inquiry({ ...ok, lang: "xx" }, find).value.lang, config.fallbackLanguage);
  assert.equal(validate.inquiry({ ...ok, type: "evil" }, find).value.type, "contact");
  assert.equal(validate.inquiry({ ...ok, message: "x".repeat(5000) }, find).value.message.length, 3000);
  assert.equal(validate.inquiry(null, find).ok, false);
});

// ------------------------------------------------------------------ routes
test("root redirects by Accept-Language", async () => {
  for (const [header, lang] of [["ka-GE,ka;q=0.9,en;q=0.8", "ka"], ["ru", "ru"], ["en-GB", "en"], ["fr-FR", config.fallbackLanguage]]) {
    const res = await get("/", { headers: { "Accept-Language": header } });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), `/${lang}/`);
  }
});

test("every public page renders in every language", async () => {
  const pages = ["/", "/residences", "/services", "/sell", "/about", "/contact", "/saved", "/privacy", "/terms"];
  for (const l of listings.all()) pages.push(`/residences/${l.slug}`);
  for (const lang of config.languages) {
    for (const p of pages) {
      const url = `/${lang}${p === "/" ? "/" : p}`;
      const res = await get(url);
      assert.equal(res.status, 200, url);
      const html = await res.text();
      assert.ok(html.includes(`<html lang="${lang}"`), `${url}: lang attribute`);
      assert.match(html, /<title>[^<]{5,}<\/title>/, `${url}: title`);
      assert.match(html, /<meta name="description" content="[^"]{20,}"/, `${url}: description`);
      assert.ok(!/\b(undefined|NaN|\[object Object\])\b/.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), `${url}: leaked placeholder value`);
      assert.ok(!/>\s*[a-z]+(\.[a-zA-Z0-9]+){1,3}\s*</.test(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<a [^>]*>[^<]*<\/a>/g, "")), `${url}: untranslated key`);
      for (const alt of config.languages) assert.ok(html.includes(`hreflang="${alt}"`), `${url}: hreflang ${alt}`);
      assert.ok(html.includes('rel="canonical" href="https://example.test/'), `${url}: canonical`);
      // JSON-LD must parse.
      const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      assert.ok(ld, `${url}: JSON-LD`);
      JSON.parse(ld[1]);
    }
  }
});

test("residence pages carry the published facts", async () => {
  const html = await (await get("/en/residences/dighomi-stone-villa")).text();
  assert.ok(html.includes("$2,200,000"));
  assert.ok(html.includes("675 m²"));
  assert.ok(html.includes("888 m²"));
  assert.ok(html.includes("LH-1003"));
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const listing = ld["@graph"].find((n) => n["@type"] === "RealEstateListing");
  assert.equal(listing.offers.price, 2200000);
  assert.equal(listing.offers.priceCurrency, "USD");
  assert.equal(listing.mainEntity.numberOfBedrooms, 4);
  // The seller's exact street address is never published.
  for (const lang of config.languages) {
    for (const l of listings.all()) {
      const page = await (await get(`/${lang}/residences/${l.slug}`)).text();
      assert.ok(!/აისის|ჯანიაშვილ|ფრიდონ|Aisi|Janiashvili|Pridon/i.test(page), `${lang}/${l.slug}: street address leaked`);
      assert.ok(!page.includes("myhome.ge"), `${lang}/${l.slug}: source portal mentioned`);
    }
  }
});

test("unknown pages return a localized 404", async () => {
  for (const [url, needle] of [["/en/nope", "Page not found"], ["/ka/residences/missing", "გვერდი ვერ მოიძებნა"], ["/ru/nope/deeper", "Страница не найдена"]]) {
    const res = await get(url);
    assert.equal(res.status, 404, url);
    assert.ok((await res.text()).includes(needle), url);
  }
  assert.equal((await get("/api/unknown")).status, 404);
  // A residence without a generated tour has no tour page.
  for (const l of listings.all()) {
    const res = await get(`/en/residences/${l.slug}/tour`);
    assert.equal(res.status, l.hasTour ? 200 : 404, `${l.slug} tour`);
  }
});

test("sitemap, robots and health", async () => {
  const xml = await (await get("/sitemap.xml")).text();
  for (const lang of config.languages) {
    assert.ok(xml.includes(`<loc>https://example.test/${lang}/</loc>`));
    for (const l of listings.all()) assert.ok(xml.includes(`<loc>https://example.test/${lang}/residences/${l.slug}</loc>`));
  }
  assert.ok(!xml.includes("/saved"), "saved page is not in the sitemap");
  const robots = await (await get("/robots.txt")).text();
  assert.ok(robots.includes("Sitemap: https://example.test/sitemap.xml"));
  assert.ok(robots.includes("Disallow: /admin"));
  assert.deepEqual(await (await get("/healthz")).json(), { ok: true });
});

test("security headers", async () => {
  const res = await get("/en/");
  const csp = res.headers.get("content-security-policy");
  assert.ok(csp.includes("default-src 'self'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(!csp.includes("'unsafe-eval'"));
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("saved-cards endpoint only returns known residences", async () => {
  const res = await get("/api/cards?lang=ru&slugs=dighomi-stone-villa,nope,%3Cscript%3E");
  const body = await res.json();
  assert.equal(body.count, 1);
  assert.ok(body.html.includes("Каменная вилла"));
  assert.ok(!body.html.includes("<script>"));
});

// ------------------------------------------------------------------ enquiries + admin
test("enquiry flow: validation errors, storage, admin inbox, CSV, update, delete", async () => {
  let res = await post({ type: "viewing", name: "", consent: false });
  assert.equal(res.status, 422);
  assert.deepEqual(Object.keys((await res.json()).fields).sort(), ["consent", "contact", "name"]);

  res = await fetch(base + "/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{broken" });
  assert.equal(res.status, 400);

  // Honeypot submissions look successful but are dropped.
  res = await post({ type: "contact", name: "Bot", email: "bot@example.com", consent: true, website: "http://spam.example" });
  assert.equal(res.status, 200);

  res = await post({
    type: "viewing", lang: "en", name: "  Ana   Test ", phone: "+995 555 00 11 22", email: "Ana@Example.com",
    message: "=HYPERLINK(\"http://x\")  <b>hello</b>", consent: true, slug: "tabakhmela-residence", date: "2026-12-05",
  });
  assert.equal(res.status, 201);
  res = await post({ type: "valuation", lang: "ru", name: "Иван Тест", email: "ivan@example.com", consent: true, propertyLocation: "Vake", propertyType: "villa", propertyArea: "450", expectedPrice: "1 500 000" });
  assert.equal(res.status, 201);

  const stored = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "inquiries.json"), "utf8"));
  assert.equal(stored.length, 2, "honeypot and invalid submissions are not stored");
  const viewing = stored.find((x) => x.type === "viewing");
  assert.equal(viewing.name, "Ana Test");
  assert.equal(viewing.email, "ana@example.com");
  assert.equal(viewing.listing.ref, "LH-1001");
  assert.equal(viewing.status, "new");
  const valuation = stored.find((x) => x.type === "valuation");
  assert.deepEqual(valuation.property, { location: "Vake", type: "villa", area: "450", expectedPrice: "1 500 000" });

  // Admin requires credentials.
  assert.equal((await get("/admin")).status, 401);
  assert.equal((await get("/admin", { headers: { Authorization: "Basic " + Buffer.from("admin:wrong").toString("base64") } })).status, 401);
  res = await get("/admin", { headers: { Authorization: AUTH } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("Ana Test") && html.includes("Иван Тест"));
  assert.ok(html.includes("&lt;b&gt;hello&lt;/b&gt;"), "message is HTML-escaped");
  assert.ok(!html.includes("<b>hello</b>"));

  res = await get("/admin/export.csv", { headers: { Authorization: AUTH } });
  const csv = await res.text();
  assert.ok(csv.includes("Ana Test"));
  assert.ok(csv.includes("\"'=HYPERLINK"), "spreadsheet formulas are neutralised");

  // Updates need the same-origin header (cross-site form posts are rejected).
  const url = `${base}/admin/api/inquiries/${viewing.id}`;
  res = await fetch(url, { method: "PATCH", headers: { Authorization: AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) });
  assert.equal(res.status, 400);
  res = await fetch(url, { method: "PATCH", headers: { Authorization: AUTH, "Content-Type": "application/json", "X-Requested-With": "fetch" }, body: JSON.stringify({ status: "contacted", notes: "Called back" }) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).item.status, "contacted");
  res = await fetch(url, { method: "PATCH", headers: { Authorization: AUTH, "Content-Type": "application/json", "X-Requested-With": "fetch" }, body: JSON.stringify({ status: "bogus" }) });
  assert.equal((await res.json()).item.status, "contacted", "unknown status is ignored");

  res = await fetch(url, { method: "DELETE", headers: { Authorization: AUTH, "Content-Type": "application/json", "X-Requested-With": "fetch" }, body: "{}" });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(DATA_DIR, "inquiries.json"), "utf8")).length, 1);
});

test("enquiries are rate limited", async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await post({ type: "contact", name: "" });
  assert.equal(last.status, 429);
});

test("concurrent enquiries are all stored", async () => {
  const leads = require("../src/leads");
  const before = (await leads.list()).length;
  await Promise.all(Array.from({ length: 25 }, (_, i) => leads.add({ type: "contact", name: `Concurrent ${i}`, lang: "en" })));
  assert.equal((await leads.list()).length, before + 25);
});
