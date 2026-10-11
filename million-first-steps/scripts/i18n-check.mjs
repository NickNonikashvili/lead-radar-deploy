// Checks every translation file against the English strings in src/i18n/_strings.json
// (run `npm run build` first so that list is current).
//   node scripts/i18n-check.mjs [lang]     exit code 1 if anything is missing or broken
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANGS, loadDict, problems } from "../src/lib/i18n.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");
const strings = JSON.parse(fs.readFileSync(path.join(dir, "_strings.json"), "utf8"));
const only = process.argv[2];
let failed = false;
for (const { code } of LANGS.filter((l) => l.code !== "en" && (!only || l.code === only))) {
  const dict = loadDict(dir, code);
  const errors = [], warnings = [];
  for (const s of strings) {
    const [err, warn] = problems(s, dict[s]);
    if (err) errors.push(`  ✗ ${err}: ${JSON.stringify(s).slice(0, 110)}`);
    else if (warn) warnings.push(`  ! ${warn}: ${JSON.stringify(s).slice(0, 90)}`);
  }
  const extra = Object.keys(dict).filter((k) => !strings.includes(k)).length;
  console.log(`${code}: ${strings.length - errors.length}/${strings.length} OK, ${errors.length} errors, ${warnings.length} warnings${extra ? `, ${extra} unused keys` : ""}`);
  if (errors.length) failed = true;
  if (only || process.argv.includes("--verbose")) console.log([...errors, ...warnings].join("\n"));
}
process.exit(failed ? 1 : 0);
