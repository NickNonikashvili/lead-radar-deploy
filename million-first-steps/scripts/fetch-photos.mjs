// Fill the photo slots in src/data/photos.mjs with real photographs.
//
//   npm install                 (once — installs sharp for image optimisation)
//   npm run photos:commons      search Wikimedia Commons for every empty slot
//   npm run photos:optimize     only optimise your own photos in src/assets/photos/<slot>.jpg
//
// Flags: --force (replace existing photos), --only=<slot-id>, --any-quality (don't prefer
// Commons "Quality images"), --local-only.
//
// Only these licences are accepted: CC0, public domain, CC BY and CC BY-SA. Anything
// NonCommercial (NC) or NoDerivatives (ND), or with extra restrictions (personality rights,
// trademarks…), is skipped. Every download is recorded in src/data/photo-credits.json and
// credited automatically on the Credits page. ALWAYS look at what was picked before you publish.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHOTOS } from "../src/data/photos.mjs";
import config from "../src/config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const photoDir = path.join(here, "..", "src", "assets", "photos");
const creditsFile = path.join(here, "..", "src", "data", "photo-credits.json");
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const only = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1];
const UA = `MillionFirstStepsWebsite/1.0 (${config.email || "contact via website"})`;

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("This script needs the 'sharp' image library. Run `npm install` in million-first-steps/ first.");
  process.exit(1);
}

fs.mkdirSync(photoDir, { recursive: true });
const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, "utf8")) : {};
const saveCredits = () => fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2) + "\n");

async function optimise(input, slot) {
  for (const w of [1600, 800]) {
    await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(photoDir, `${slot}-${w}.webp`));
  }
}

const strip = (html = "") => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const OK_LICENCE = /^(cc0|public domain|pd\b|pd-|cc[ -]by(-sa)?[ -]\d|cc[ -]by(-sa)?$|attribution|attribution-sharealike)/i;
const BAD_LICENCE = /\b(nc|nd|noncommercial|noderiv|fair use|all rights reserved)\b/i;

async function commonsSearch(query, quality) {
  const q = `${query} filetype:bitmap${quality ? ' incategory:"Quality_images"' : ""}`;
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: q,
      gsrlimit: "25",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "2000",
    });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = await res.json();
  return Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
}

function acceptable(page) {
  const ii = page.imageinfo?.[0];
  if (!ii || !/image\/(jpeg|png)/.test(ii.mime)) return null;
  if (ii.width < 1600 || ii.width < ii.height * 1.15) return null; // landscape and large enough
  const m = ii.extmetadata || {};
  const licence = strip(m.LicenseShortName?.value);
  if (!OK_LICENCE.test(licence) || BAD_LICENCE.test(licence)) return null;
  if (strip(m.Restrictions?.value)) return null; // personality rights, trademarks, etc.
  return {
    url: ii.thumburl || ii.url,
    title: strip(m.ObjectName?.value) || page.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
    author: strip(m.Artist?.value) || "Unknown author",
    license: licence,
    licenseUrl: strip(m.LicenseUrl?.value),
    source: ii.descriptionurl,
  };
}

let done = 0, skipped = 0;
for (const [slot, def] of Object.entries(PHOTOS)) {
  if (only && slot !== only) continue;
  const have = fs.existsSync(path.join(photoDir, `${slot}-1600.webp`));
  const local = ["jpg", "jpeg", "png"].map((e) => path.join(photoDir, `${slot}.${e}`)).find(fs.existsSync);

  if (local && (!have || flag("force"))) {
    await optimise(local, slot);
    console.log(`✓ ${slot}: optimised your photo ${path.basename(local)}`);
    done++;
    continue;
  }
  if (flag("local-only") || !def.commons || (have && !flag("force"))) {
    skipped++;
    continue;
  }

  try {
    let pick = null;
    for (const quality of flag("any-quality") ? [false] : [true, false]) {
      for (const page of await commonsSearch(def.commons, quality)) if ((pick = acceptable(page))) break;
      if (pick) break;
    }
    if (!pick) {
      console.log(`– ${slot}: nothing suitable for "${def.commons}" — add your own photo or edit the query in photos.mjs`);
      continue;
    }
    const img = await fetch(pick.url, { headers: { "User-Agent": UA } });
    if (!img.ok) throw new Error(`download ${img.status}`);
    await optimise(Buffer.from(await img.arrayBuffer()), slot);
    credits[slot] = {
      ...pick,
      changes: "Resized and converted to WebP",
      short: `Photo: ${pick.author} / Wikimedia Commons, ${pick.license}`,
    };
    delete credits[slot].url;
    saveCredits();
    console.log(`✓ ${slot}: "${pick.title}" by ${pick.author} (${pick.license})\n    ${pick.source}`);
    done++;
    await new Promise((r) => setTimeout(r, 600)); // be polite to Wikimedia's servers
  } catch (e) {
    console.log(`✗ ${slot}: ${e.message}`);
  }
}
console.log(`\n${done} photo(s) added, ${skipped} slot(s) left as they were.`);
if (done) console.log("Review every photo before publishing, then run `npm run build`. Credits appear on credits.html automatically.");
