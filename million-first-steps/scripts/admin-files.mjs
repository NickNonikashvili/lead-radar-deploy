// Files the admin panel (src/root/admin, copied with the other server files) needs from the build:
// admin/lib/catalog.json — the tours, travel styles and contact details the site was built with,
// so the admin can show them and override them (prices, contact details) without a rebuild.
import fs from "node:fs";
import path from "node:path";
import config from "../src/config.mjs";
import { TOURS } from "../src/data/tours.mjs";
import { TIERS } from "../src/data/tiers.mjs";
import { LANGS } from "../src/lib/i18n.mjs";

export function writeAdminFiles(out) {
  const dir = path.join(out, "admin", "lib");
  fs.mkdirSync(dir, { recursive: true });
  const catalog = {
    builtAt: new Date().toISOString(),
    brand: config.brand,
    languages: LANGS.map((l) => ({ code: l.code, name: l.name })),
    tiers: TIERS.map((t) => ({ id: t.id, name: t.name })),
    tours: TOURS.map((t) => ({ id: t.id, name: t.name, days: t.days, styles: t.styles, prices: t.prices })),
    partyFactors: config.partyFactors,
    contact: {
      email: config.email, phone: config.phone, whatsapp: config.whatsapp, telegram: config.telegram, signal: config.signal,
      instagram: config.instagram, facebook: config.facebook, address: config.address, officeHours: config.officeHours,
      legalName: config.legalName, registrationNumber: config.registrationNumber, formTo: config.formTo,
    },
  };
  fs.writeFileSync(path.join(dir, "catalog.json"), JSON.stringify(catalog, null, 1) + "\n");
}
