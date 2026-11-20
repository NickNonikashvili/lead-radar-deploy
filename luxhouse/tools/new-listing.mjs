#!/usr/bin/env node
/**
 * Start a new residence from a folder of photographs.
 *
 *   npm run new-listing -- --slug vake-penthouse --photos /path/to/photos [--ref LH-1004]
 *
 * Copies the photos (sorted by file name) to content/source-photos/<slug>/01.jpg, 02.jpg …
 * and writes content/listings/<slug>.json with every field you need to fill in.
 * The residence stays unpublished until you set "published": true.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf("--" + name);
  return i > -1 ? args[i + 1] : undefined;
};

const slug = arg("slug");
const photosDir = arg("photos");
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !photosDir) {
  console.error("Usage: npm run new-listing -- --slug lowercase-with-dashes --photos /path/to/photos [--ref LH-1004]");
  process.exit(1);
}
const listingFile = path.join(ROOT, "content", "listings", `${slug}.json`);
if (fs.existsSync(listingFile)) {
  console.error(`content/listings/${slug}.json already exists.`);
  process.exit(1);
}
if (!fs.existsSync(photosDir) || !fs.statSync(photosDir).isDirectory()) {
  console.error(`Not a folder: ${photosDir}`);
  process.exit(1);
}

const IMAGE = /\.(jpe?g|png|webp)$/i;
const sources = fs.readdirSync(photosDir).filter((f) => IMAGE.test(f)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
if (!sources.length) {
  console.error("No .jpg, .png or .webp photos found in " + photosDir);
  process.exit(1);
}

// Next free reference number.
const listingsDir = path.join(ROOT, "content", "listings");
const used = fs.readdirSync(listingsDir).filter((f) => f.endsWith(".json")).map((f) => {
  try {
    return Number(String(JSON.parse(fs.readFileSync(path.join(listingsDir, f), "utf8")).ref || "").replace(/\D/g, "")) || 0;
  } catch (e) {
    return 0;
  }
});
const ref = arg("ref") || `LH-${Math.max(1000, ...used) + 1}`;

const dest = path.join(ROOT, "content", "source-photos", slug);
fs.mkdirSync(dest, { recursive: true });
const photos = sources.map((name, i) => {
  const file = String(i + 1).padStart(2, "0");
  fs.copyFileSync(path.join(photosDir, name), path.join(dest, file + path.extname(name).toLowerCase()));
  return { file, room: "" };
});

const tri = (text) => ({ en: text, ka: "", ru: "" });
const listing = {
  ref,
  slug,
  published: false,
  featured: false,
  status: "for-sale",
  listedAt: new Date().toISOString().slice(0, 10),
  price: { amount: 0, currency: "USD" },
  location: {
    key: "TODO-district-key",
    district: tri("TODO district"),
    context: tri("Tbilisi"),
    lat: null,
    lng: null,
    radiusM: 800,
  },
  facts: { areaM2: 1, landM2: null, rooms: null, bedrooms: null, bathrooms: "", floors: null },
  features: [],
  title: tri("TODO title"),
  tagline: tri("TODO one-sentence summary"),
  description: { en: ["TODO first paragraph", "TODO second paragraph"], ka: [], ru: [] },
  highlights: { en: [], ka: [], ru: [] },
  cover: "01",
  photos,
};
fs.writeFileSync(listingFile, JSON.stringify(listing, null, 2) + "\n");

console.log(`Created content/listings/${slug}.json (${ref}) with ${photos.length} photos.

Next:
  1. Fill in the TODO fields, all three languages, and a "room" for every photo
     (allowed rooms and features are listed in src/i18n/en.js).
  2. npm run images
  3. python tools/tour/build_tour.py --listing ${slug}     (3D tour, see README)
  4. Set "published": true, then: npm run check && npm test`);
