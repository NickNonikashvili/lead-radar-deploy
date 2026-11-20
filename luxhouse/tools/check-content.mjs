#!/usr/bin/env node
/**
 * Content check: run before publishing.  npm run check
 *
 * Reports, per residence: missing translations, photos without built images,
 * unknown room / feature keys, placeholder values, and whether a 3D tour exists.
 * Also lists the contact details that are still empty in site.config.json.
 * Exits with code 1 when something must be fixed.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = require("../src/config.js");
const i18n = require("../src/i18n/index.js");

const errors = [];
const warnings = [];
const media = fs.existsSync(path.join(ROOT, "content/generated/media.json"))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, "content/generated/media.json"), "utf8"))
  : {};

const dir = path.join(ROOT, "content", "listings");
const refs = new Map();
let published = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  let l;
  try {
    l = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  } catch (err) {
    errors.push(`${file}: not valid JSON (${err.message})`);
    continue;
  }
  const where = l.slug || file;
  const err = (m) => errors.push(`${where}: ${m}`);
  const warn = (m) => warnings.push(`${where}: ${m}`);

  if (file !== `${l.slug}.json`) err(`file must be named ${l.slug}.json`);
  if (refs.has(l.ref)) err(`reference ${l.ref} is also used by ${refs.get(l.ref)}`);
  refs.set(l.ref, where);
  if (l.published === false) {
    warn("not published (set \"published\": true when it is ready)");
  } else {
    published++;
  }

  for (const lang of config.languages) {
    for (const field of ["title", "tagline"]) {
      if (!l[field] || !String(l[field][lang] || "").trim()) err(`${field}.${lang} is missing`);
    }
    if (!l.description || !Array.isArray(l.description[lang]) || !l.description[lang].length) err(`description.${lang} is missing`);
    else if (l.description.en && l.description[lang].length !== l.description.en.length) warn(`description.${lang} has a different number of paragraphs than English`);
    if (l.highlights && l.highlights.en && (!l.highlights[lang] || l.highlights[lang].length !== l.highlights.en.length)) err(`highlights.${lang} does not match English`);
    if (!l.location || !l.location.district || !l.location.district[lang]) err(`location.district.${lang} is missing`);
  }
  const text = JSON.stringify([l.title, l.tagline, l.description, l.highlights]);
  if (/TODO|Untitled|Lorem ipsum/i.test(text)) err("placeholder text is still present");

  if (!l.price || !(l.price.amount > 0)) warn("no price: the page will show “price on request”");
  if (!l.facts || !(l.facts.areaM2 > 1)) err("facts.areaM2 is missing");
  if (!l.location || !Number.isFinite(l.location.lat) || !Number.isFinite(l.location.lng)) warn("no map coordinates: the location map is hidden");

  const built = media[l.slug] || {};
  const seen = new Set();
  for (const p of l.photos || []) {
    if (seen.has(p.file)) err(`photo ${p.file} is listed twice`);
    seen.add(p.file);
    if (!built[p.file]) err(`photo ${p.file} has no built images (run: npm run images)`);
    if (!p.room) warn(`photo ${p.file} has no room label`);
    else if (!i18n.dicts.en.rooms[p.room]) err(`photo ${p.file}: unknown room "${p.room}" (see rooms in src/i18n/en.js)`);
  }
  if (l.cover && !seen.has(l.cover)) err(`cover "${l.cover}" is not one of the photos`);
  for (const f of l.features || []) if (!i18n.dicts.en.features[f]) err(`unknown feature "${f}" (see features in src/i18n/en.js)`);

  const tour = path.join(ROOT, "public", "media", "listings", l.slug, "tour", "tour.json");
  if (!fs.existsSync(tour)) {
    warn("no 3D tour yet (run: python tools/tour/build_tour.py --listing " + l.slug + ")");
  } else {
    const t = JSON.parse(fs.readFileSync(tour, "utf8"));
    if (t.fixture) err("the 3D tour is a test fixture, not built from this residence's photographs");
    for (const s of t.scenes || []) {
      for (const f of ["geo.bin", "color.webp", "thumb.webp"]) {
        if (!fs.existsSync(path.join(path.dirname(tour), s.base, f))) err(`tour scene ${s.id}: ${f} is missing`);
      }
      if (!seen.has(s.photo)) warn(`tour scene ${s.id} uses a photo that is no longer in the gallery`);
    }
  }
}

// Translation dictionaries share one structure (also covered by `npm test`).
const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, p + k + ".") : [p + k]));
const reference = keys(i18n.dicts.en);
for (const lang of config.languages) {
  if (!i18n.dicts[lang]) {
    errors.push(`language "${lang}" has no dictionary in src/i18n/`);
    continue;
  }
  const have = new Set(keys(i18n.dicts[lang]));
  for (const k of reference) if (!have.has(k)) errors.push(`src/i18n/${lang}.js: missing "${k}"`);
}

// Site-wide settings.
const c = config.contact;
if (!c.phone) warnings.push("site.config.json: contact.phone is empty (phone links are hidden)");
if (!c.email) warnings.push("site.config.json: contact.email is empty");
if (!config.baseUrl) warnings.push("BASE_URL / baseUrl is not set (needed for canonical links and social previews)");
if (!config.legalName || config.legalName === config.brand) warnings.push("site.config.json: legalName is empty (used in the footer, privacy policy and terms)");
if (!config.admin.password) warnings.push("ADMIN_PASSWORD is not set: the enquiry inbox at /admin is disabled");
if (!config.smtp.host && !config.webhookUrl) warnings.push("no SMTP or webhook configured: new enquiries are only stored, nobody is notified");

console.log(`${published} published residence(s), ${refs.size} total`);
if (warnings.length) console.log("\nTo review:\n  - " + warnings.join("\n  - "));
if (errors.length) {
  console.error("\nMust fix:\n  - " + errors.join("\n  - "));
  process.exit(1);
}
console.log("\nNo blocking problems.");
