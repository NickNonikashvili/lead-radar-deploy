// Merges translation parts into src/i18n/<lang>.json.
// A part is src/i18n/parts/<lang>.<start>.json: a JSON array of translations for
// _strings.json[start], _strings.json[start + 1], … in the same order.
//   node scripts/i18n-merge.mjs <lang>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");
const lang = process.argv[2];
if (!lang) throw new Error("Usage: node scripts/i18n-merge.mjs <lang>");
const strings = JSON.parse(fs.readFileSync(path.join(dir, "_strings.json"), "utf8"));
const file = path.join(dir, `${lang}.json`);
const dict = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
const partsDir = path.join(dir, "parts");
const parts = fs.existsSync(partsDir) ? fs.readdirSync(partsDir).filter((f) => f.startsWith(`${lang}.`) && f.endsWith(".json")) : [];
for (const f of parts) {
  const start = Number(f.split(".")[1]);
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(partsDir, f), "utf8"));
  } catch (e) {
    console.error(`✗ ${f} is not valid JSON: ${e.message}`);
    process.exitCode = 1;
    continue;
  }
  if (!Array.isArray(arr)) throw new Error(`${f} must contain a JSON array`);
  if (start + arr.length > strings.length) console.error(`✗ ${f} has ${arr.length} entries but only ${strings.length - start} strings remain from ${start}`);
  arr.forEach((t, i) => {
    if (strings[start + i] !== undefined && typeof t === "string" && t.trim()) dict[strings[start + i]] = t;
  });
  console.log(`${f}: ${arr.length} entries (${start}–${start + arr.length - 1})`);
}
// Keep only keys that are still in use, in page order.
const out = {};
for (const s of strings) if (dict[s]) out[s] = dict[s];
fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`${lang}.json: ${Object.keys(out).length}/${strings.length} strings`);
