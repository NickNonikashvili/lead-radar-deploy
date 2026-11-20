// Helpers for turning the designer's page bodies (src/design/*.html) into pages.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import { PARSE, icons, channels, markChannel, markChannelList } from "./layout.mjs";
import { TIERS } from "../data/tiers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DESIGN = path.join(here, "..", "design");

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const join = (list, fn) => list.map(fn).join("");

/** Parsed body of one design page. */
export const designPage = (name) => parse(icons(fs.readFileSync(path.join(DESIGN, name + ".html"), "utf8")), PARSE);

/** Serialise a page body; design asset paths move under assets/. */
export const finish = (root) =>
  (typeof root === "string" ? root : root.toString()).replace(/(["'(\s])(img|video|photos)\//g, "$1assets/$2/");

/** Element whose own text is exactly `text` (handy for picking out the designer's labels). */
export function byText(root, sel, text) {
  return root.querySelectorAll(sel).find((el) => el.text.replace(/\s+/g, " ").trim() === text);
}

/**
 * Forms send every field to send.php. Fields get a name (their id if they had none) and their
 * English label in data-en, so the email we receive reads the same whatever language the visitor used.
 */
export function prepareForms(root) {
  // A label's text without its "(optional)" hint (the contact message is only optional for custom trips).
  const labelText = (el) => (el ? el.querySelectorAll(".opt").reduce((s, o) => s.replace(o.text, ""), el.text) : "");
  root.querySelectorAll("form").forEach((form) => {
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      const id = el.getAttribute("id");
      if (!el.getAttribute("name") && id) el.setAttribute("name", id);
      if (el.getAttribute("type") === "hidden" && !id) return;
      let label = "";
      if (id) label = labelText(form.querySelector(`label[for="${id}"]`));
      if (!label) {
        const by = (el.getAttribute("aria-labelledby") || el.getAttribute("aria-describedby") || "").split(" ")[0];
        if (by) label = root.querySelector(`#${by}`)?.text || "";
      }
      if (!label && id) {
        const btn = form.querySelector(`[aria-controls][id="${id}-btn"]`);
        const by = btn?.getAttribute("aria-describedby");
        if (by) label = root.querySelector(`#${by}`)?.text || "";
      }
      if (!label) label = el.getAttribute("aria-label") || el.closest?.("label")?.text || el.getAttribute("placeholder") || el.getAttribute("name") || "";
      label = label.replace(/\s+/g, " ").replace(/\*$/, "").trim();
      if (label) el.setAttribute("data-en", label);
    });
  });
}

export const eur = (n) => `€${Math.round(n).toLocaleString("en-US")}`;

/** Price spans for every tier; CSS shows the one matching html[data-tier]. data-price lets site.js update them. */
export function tierPrices(tour) {
  return TIERS.map((t) => `<span class="tp" data-tier="${t.id}" data-price="${tour.id}:${t.id}">${eur(tour.prices[t.id])}</span>`).join("");
}

/** One price the admin panel can change: <span data-price="tour:tier">€1,690</span> (kept out of translations). */
export const livePrice = (tour, tier) => `<span data-price="${tour.id}:${tier}">${eur(tour.prices[tier])}</span>`;

/** The tier switch used on the tours page and tour pages. */
export function tierSelect(id = "tier") {
  return `<label class="dd tier-dd" for="${id}"><span class="sr-only">Travel style</span><select id="${id}" data-tier-select aria-label="Travel style">${join(
    TIERS,
    (t) => `<option value="${t.id}"${t.id === "explorer" ? " selected" : ""}>${esc(t.name)}</option>`
  )}</select><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></label>`;
}

/** Messaging chips/links: each marked with its channel (data-ch); those not set up are built hidden. */
export function markChannels(root, sel, listSel) {
  const ch = channels();
  root.querySelectorAll(sel).forEach((a) => {
    const key = (a.getAttribute("aria-label") || a.text).trim().toLowerCase();
    if (key in ch) markChannel(a.closest("li") || a, a, key);
  });
  if (listSel) root.querySelectorAll(listSel).forEach(markChannelList);
}

export const ARROW = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
