#!/usr/bin/env node
/**
 * Build responsive image variants for every listing photo.
 *
 *   content/source-photos/<slug>/<file>.(webp|jpg|jpeg|png)
 *     -> public/media/listings/<slug>/<file>-<width>.webp   (never upscaled)
 *     -> public/media/listings/<slug>/og.jpg                (1200x630 social preview of the cover)
 *     -> content/generated/media.json                       (sizes + placeholder colour per photo)
 *
 * Usage:  npm run images            (all listings; skips files that are already up to date)
 *         npm run images -- --force (rebuild everything)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "source-photos");
const OUT = path.join(ROOT, "public", "media", "listings");
const MANIFEST = path.join(ROOT, "content", "generated", "media.json");
const WIDTHS = [640, 1280, 1920];
const EXTS = [".webp", ".jpg", ".jpeg", ".png"];
const force = process.argv.includes("--force");

function findSource(slug, file) {
  for (const ext of EXTS) {
    const p = path.join(SRC, slug, file + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function hex(n) {
  return Math.round(n).toString(16).padStart(2, "0");
}

const manifest = {};
const listingFiles = fs.readdirSync(path.join(ROOT, "content", "listings")).filter((f) => f.endsWith(".json"));
let built = 0;
let skipped = 0;
const problems = [];

for (const lf of listingFiles) {
  const listing = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "listings", lf), "utf8"));
  const slug = listing.slug;
  const outDir = path.join(OUT, slug);
  fs.mkdirSync(outDir, { recursive: true });
  manifest[slug] = {};

  for (const photo of listing.photos || []) {
    const src = findSource(slug, photo.file);
    if (!src) {
      problems.push(`${slug}: source photo "${photo.file}" not found in content/source-photos/${slug}/`);
      continue;
    }
    const img = sharp(src, { failOn: "error" }).rotate();
    const meta = await img.metadata();
    // `rotate()` applies EXIF orientation; swap when the stored orientation is sideways.
    const sideways = meta.orientation && meta.orientation >= 5;
    const width = sideways ? meta.height : meta.width;
    const height = sideways ? meta.width : meta.height;
    const stats = await sharp(src).rotate().resize(32, 32, { fit: "inside" }).stats();
    const color = "#" + stats.channels.slice(0, 3).map((c) => hex(c.mean)).join("");

    const widths = [...new Set(WIDTHS.map((w) => Math.min(w, width)))].sort((a, b) => a - b);
    const srcMtime = fs.statSync(src).mtimeMs;
    for (const w of widths) {
      const dest = path.join(outDir, `${photo.file}-${w}.webp`);
      if (!force && fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= srcMtime) {
        skipped++;
        continue;
      }
      await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toFile(dest);
      built++;
    }
    manifest[slug][photo.file] = { w: width, h: height, color, widths };
  }

  // Social preview (JPEG for the widest crawler support).
  const coverSrc = findSource(slug, listing.cover || (listing.photos[0] && listing.photos[0].file));
  if (coverSrc) {
    const dest = path.join(outDir, "og.jpg");
    if (force || !fs.existsSync(dest) || fs.statSync(dest).mtimeMs < fs.statSync(coverSrc).mtimeMs) {
      await sharp(coverSrc).rotate().resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 84, mozjpeg: true }).toFile(dest);
      built++;
    } else {
      skipped++;
    }
  } else {
    problems.push(`${slug}: cover photo not found`);
  }
}

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`images: ${built} written, ${skipped} up to date, manifest -> content/generated/media.json`);
if (problems.length) {
  console.error("PROBLEMS:\n  " + problems.join("\n  "));
  process.exit(1);
}
