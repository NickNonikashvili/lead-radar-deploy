// Merges translator output into the dictionaries.
//   node scripts/i18n-merge.mjs [lang…] [--prune]
// Reads src/i18n/parts/<lang>.<n>.json (objects: English → translation), adds them to
// src/i18n/<lang>.json and reports entries whose HTML or numbers don't match the English.
// --prune drops translations of text the site no longer uses. Run `npm run build` first.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANGS, problems } from "../src/lib/i18n.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");
const strings = JSON.parse(fs.readFileSync(path.join(dir, "_strings.json"), "utf8"));
const loose = (s) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/ /g, " ").replace(/\s+/g, " ").trim();
const byLoose = new Map(strings.map((s) => [loose(s), s]));
const args = process.argv.slice(2);
const prune = args.includes("--prune");
const only = args.filter((a) => !a.startsWith("--"));

for (const { code } of LANGS.filter((l) => l.code !== "en" && (!only.length || only.includes(l.code)))) {
  const file = path.join(dir, `${code}.json`);
  const dict = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const partsDir = path.join(dir, "parts");
  const parts = fs.existsSync(partsDir) ? fs.readdirSync(partsDir).filter((f) => new RegExp(`^${code}\\.\\d+\\.json$`).test(f)) : [];
  let added = 0, unknown = 0;
  const bad = [];
  for (const p of parts) {
    const part = JSON.parse(fs.readFileSync(path.join(partsDir, p), "utf8"));
    for (const [k, v] of Object.entries(part)) {
      const key = strings.includes(k) ? k : byLoose.get(loose(k));
      if (!key) { unknown++; continue; }
      const [err] = problems(key, v);
      if (err) bad.push(`  ✗ ${err}: ${key.slice(0, 90)}`);
      dict[key] = v;
      added++;
    }
  }
  // Keep the file in the site's order; old keys the site still uses (by loose match) stay too.
  const used = new Set(strings.map(loose));
  const out = {};
  for (const s of strings) if (dict[s]) out[s] = dict[s];
  for (const [k, v] of Object.entries(dict)) if (!(k in out) && (!prune || used.has(loose(k)))) out[k] = v;
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
  console.log(`${code}: +${added} from ${parts.length} parts${unknown ? `, ${unknown} not on the site` : ""}${bad.length ? `, ${bad.length} need fixing` : ""}${prune ? `, ${Object.keys(dict).length - Object.keys(out).length} unused removed` : ""}`);
  if (bad.length) console.log(bad.slice(0, 20).join("\n"));
}
