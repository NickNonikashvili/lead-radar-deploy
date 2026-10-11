// Fill the photo slots in src/data/photos.mjs with real photographs.
//
//   npm install                       once — installs sharp for image optimisation
//   npm run photos:commons            fill every empty slot from Wikimedia Commons
//   npm run photos:optimize           only optimise your own photos in src/assets/photos/<slot>.jpg
//
//   node scripts/fetch-photos.mjs --list=region-kazbegi
//        show the best freely licensed candidates for one slot (add --previews to save small
//        JPEG previews in photo-previews/ so you can look at them)
//   node scripts/fetch-photos.mjs --only=region-kazbegi --file="File:Gergeti Trinity Church.jpg" --force
//        use one specific Commons file for a slot (it is still licence-checked)
//
// Other flags: --force (replace existing photos), --only=<slot-id>, --any-quality (don't prefer
// Commons "Quality images"), --local-only.
//
// To make a choice permanent, put `file: "File:…"` (or a list of files, best first — later
// ones are backups) on the slot in src/data/photos.mjs.
//
// Only these licences are accepted: CC0, public domain, CC BY and CC BY-SA. Anything
// NonCommercial (NC) or NoDerivatives (ND), or with extra restrictions (personality rights,
// trademarks…), is skipped. Every download is recorded in src/data/photo-credits.json and
// credited automatically on the Credits page. ALWAYS look at what was picked before you publish.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PHOTOS } from "../src/data/photos.mjs";

// Behind an HTTPS proxy (some offices, cloud sandboxes), Node's fetch only uses it when asked to.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)], { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
  process.exit(r.status ?? 1);
}
import config from "../src/config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const photoDir = path.join(here, "..", "src", "assets", "photos");
const previewDir = path.join(here, "..", "photo-previews");
const creditsFile = path.join(here, "..", "src", "data", "photo-credits.json");
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : "";
};
const only = opt("only");
const listSlot = opt("list");
const fileArg = opt("file");
const UA = `MillionFirstStepsWebsite/1.0 (${config.email || "contact via website"})`;
const API = "https://commons.wikimedia.org/w/api.php?";
const THUMB_WIDTH = "1920"; // one of Wikimedia's standard thumbnail sizes

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

class Offline extends Error {}
async function get(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 403 || res.status === 407) throw new Offline(`blocked (${res.status})`);
    return res;
  } catch (e) {
    if (e instanceof Offline) throw e;
    throw new Offline(e.cause?.code || e.cause?.message || e.message);
  }
}

const strip = (html = "") => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const OK_LICENCE = /^(cc0|public domain|pd\b|pd-|cc[ -]by(-sa)?[ -]\d|cc[ -]by(-sa)?$|attribution|attribution-sharealike)/i;
const BAD_LICENCE = /\b(nc|nd|noncommercial|noderiv|fair use|all rights reserved)\b/i;

const IMAGEINFO = { prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: THUMB_WIDTH };

async function commonsSearch(query, quality) {
  const q = `${query} filetype:bitmap${quality ? ' incategory:"Quality_images"' : ""}`;
  const res = await get(API + new URLSearchParams({ action: "query", format: "json", generator: "search", gsrnamespace: "6", gsrsearch: q, gsrlimit: "30", ...IMAGEINFO }));
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = await res.json();
  return Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
}

async function commonsFile(title) {
  const t = title.startsWith("File:") ? title : `File:${title}`;
  const res = await get(API + new URLSearchParams({ action: "query", format: "json", titles: t, ...IMAGEINFO }));
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = await res.json();
  return Object.values(data.query?.pages || {})[0];
}

// Returns credit details if the file is usable for `def`, otherwise a reason string.
function check(page, def = {}) {
  const ii = page?.imageinfo?.[0];
  if (!ii) return "not found on Commons";
  if (!/image\/(jpeg|png|webp|tiff)/.test(ii.mime)) return `unsupported type ${ii.mime}`;
  const minW = def.minWidth || 1600;
  if (ii.width < minW) return `too small (${ii.width}px wide)`;
  if (def.orientation !== "any" && ii.width < ii.height * 1.15) return "not landscape";
  const m = ii.extmetadata || {};
  const licence = strip(m.LicenseShortName?.value);
  if (!OK_LICENCE.test(licence) || BAD_LICENCE.test(licence)) return `licence not allowed (${licence || "unknown"})`;
  if (strip(m.Restrictions?.value)) return `extra restrictions (${strip(m.Restrictions.value)})`;
  return {
    url: ii.thumburl || ii.url,
    file: page.title,
    title: strip(m.ObjectName?.value) || page.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
    author: strip(m.Artist?.value) || "Unknown author",
    license: licence,
    licenseUrl: strip(m.LicenseUrl?.value),
    source: ii.descriptionurl,
    size: `${ii.width}×${ii.height}`,
  };
}

async function candidates(def, limit = 8) {
  const out = [], seen = new Set();
  const queries = [].concat(def.commons || []);
  for (const quality of flag("any-quality") ? [false] : [true, false]) {
    for (const q of queries) {
      for (const page of await commonsSearch(q, quality)) {
        if (seen.has(page.title)) continue;
        seen.add(page.title);
        const c = check(page, def);
        if (typeof c === "object") out.push({ ...c, quality });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

async function install(slot, pick) {
  const img = await get(pick.url);
  if (!img.ok) throw new Error(`download ${img.status}`);
  await optimise(Buffer.from(await img.arrayBuffer()), slot);
  const { url, size, quality, ...credit } = pick;
  credits[slot] = { ...credit, changes: "Resized and converted to WebP", short: `Photo: ${pick.author} / Wikimedia Commons, ${pick.license}` };
  saveCredits();
  console.log(`✓ ${slot}: "${pick.title}" by ${pick.author} (${pick.license}, ${size})\n    ${pick.source}`);
}

function offline(e) {
  console.error(
    `\nCan't reach Wikimedia Commons (${e.message}).\n` +
      "Check that commons.wikimedia.org and upload.wikimedia.org are reachable from this machine — " +
      "on a locked-down network, add both to the allowed domains."
  );
  process.exit(2);
}

// ── --list: show candidates for one slot ───────────────────────────────────
if (listSlot) {
  const def = PHOTOS[listSlot];
  if (!def) {
    console.error(`Unknown slot "${listSlot}". Slots: ${Object.keys(PHOTOS).join(", ")}`);
    process.exit(1);
  }
  try {
    const list = await candidates(def, 10);
    if (!list.length) console.log(`No freely licensed candidates for "${[].concat(def.commons).join('" / "')}".`);
    for (const [i, c] of list.entries()) {
      console.log(`${i + 1}. ${c.file}  (${c.size}, ${c.license}${c.quality ? ", Quality image" : ""})\n   by ${c.author}\n   ${c.source}`);
      if (flag("previews")) {
        const dir = path.join(previewDir, listSlot);
        fs.mkdirSync(dir, { recursive: true });
        const res = await get(c.url);
        if (res.ok) await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 640 }).jpeg({ quality: 70 }).toFile(path.join(dir, `${i + 1}.jpg`));
      }
    }
    if (flag("previews") && list.length) console.log(`\nPreviews saved in ${path.relative(process.cwd(), path.join(previewDir, listSlot))}/`);
  } catch (e) {
    if (e instanceof Offline) offline(e);
    throw e;
  }
  process.exit(0);
}

// ── fill slots ─────────────────────────────────────────────────────────────
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
  const wanted = (only && fileArg) || def.file;
  if (flag("local-only") || (!def.commons && !wanted) || (have && !flag("force"))) {
    skipped++;
    continue;
  }

  try {
    let ok = false;
    if (wanted) {
      // `file` may list backups: the first file that passes the checks and downloads wins.
      for (const title of [].concat(wanted)) {
        const pick = check(await commonsFile(title), { ...def, orientation: "any", minWidth: 1200 });
        if (typeof pick === "string") {
          console.log(`✗ ${slot}: ${title} can't be used — ${pick}`);
          continue;
        }
        try {
          await install(slot, pick);
          ok = true;
          break;
        } catch (e) {
          if (e instanceof Offline) throw e;
          console.log(`✗ ${slot}: ${title} — ${e.message}`);
        }
      }
    } else {
      const pick = (await candidates(def, 1))[0];
      if (!pick) {
        console.log(`– ${slot}: nothing suitable for "${[].concat(def.commons).join('" / "')}" — add your own photo or edit the query in photos.mjs`);
        continue;
      }
      await install(slot, pick);
      ok = true;
    }
    if (!ok) continue;
    done++;
    await new Promise((r) => setTimeout(r, 600)); // be polite to Wikimedia's servers
  } catch (e) {
    if (e instanceof Offline) offline(e);
    console.log(`✗ ${slot}: ${e.message}`);
  }
}
console.log(`\n${done} photo(s) added, ${skipped} slot(s) left as they were.`);
if (done) console.log("Review every photo before publishing, then run `npm run build`. Credits appear on credits.html automatically.");
