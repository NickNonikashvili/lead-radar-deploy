// Files the admin panel (src/root/admin, copied with the other server files) needs from the build:
// admin/lib/catalog.json — the tours, travel styles and contact details the site was built with,
// so the admin can show them and override them (prices, contact details) without a rebuild.
// admin/lib/setup-key.php — the one-time key that creates the first owner account (?p=setup). A new random
// key is made on every build (or MFS_SETUP_KEY=XXXX-XXXX-XXXX npm run build to choose it) and printed below.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import config from "../src/config.mjs";
import { TOURS } from "../src/data/tours.mjs";
import { TIERS } from "../src/data/tiers.mjs";
import { fileURLToPath } from "node:url";
import { LANGS, DEFAULT_LANG, loadDict, lookup } from "../src/lib/i18n.mjs";

// No 0/O, 1/I/L: easy to read out over the phone.
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function setupKey() {
  const given = (process.env.MFS_SETUP_KEY || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (given) {
    if (given.length < 10) throw new Error("MFS_SETUP_KEY must have at least 10 letters or digits");
    return given;
  }
  let key = "";
  for (let i = 0; i < 12; i++) key += KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)];
  return key;
}

// A name as the website shows it in each other language: {ru: "…", ka: "…"} (only translated ones). The admin
// uses these to recognise a tour or travel style a visitor picked on a page in their own language.
const i18nDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");
const looks = LANGS.filter((l) => l.code !== DEFAULT_LANG).map((l) => [l.code, lookup(loadDict(i18nDir, l.code))]);
function namesIn(name) {
  const out = {};
  for (const [code, look] of looks) {
    const v = look(name);
    if (v && v !== name) out[code] = v;
  }
  return out;
}

export function writeAdminFiles(out) {
  const dir = path.join(out, "admin", "lib");
  fs.mkdirSync(dir, { recursive: true });
  const catalog = {
    builtAt: new Date().toISOString(),
    brand: config.brand,
    siteUrl: config.siteUrl || "",
    languages: LANGS.map((l) => ({ code: l.code, name: l.name })),
    tiers: TIERS.map((t) => ({ id: t.id, name: t.name, names: namesIn(t.name) })),
    tours: TOURS.map((t) => ({ id: t.id, name: t.name, names: namesIn(t.name), days: t.days, styles: t.styles, prices: t.prices })),
    partyFactors: config.partyFactors,
    contact: {
      email: config.email, phone: config.phone, whatsapp: config.whatsapp, telegram: config.telegram, signal: config.signal,
      instagram: config.instagram, facebook: config.facebook, address: config.address, officeHours: config.officeHours,
      legalName: config.legalName, registrationNumber: config.registrationNumber, formTo: config.formTo,
    },
  };
  fs.writeFileSync(path.join(dir, "catalog.json"), JSON.stringify(catalog, null, 1) + "\n");

  const key = setupKey();
  fs.writeFileSync(
    path.join(dir, "setup-key.php"),
    `<?php\n// Written by the build (scripts/admin-files.mjs). The one-time key for admin/index.php?p=setup,\n` +
      `// which creates the first owner account. Once an account exists, the key no longer does anything.\n` +
      `if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }\nreturn '${key}';\n`,
    { mode: 0o644 }
  );
  console.log(`Admin setup key: ${key}`);
}
