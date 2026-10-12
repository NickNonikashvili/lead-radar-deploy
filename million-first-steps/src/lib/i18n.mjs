// Translations. The site is written once, in English; the build translates the finished HTML
// using src/i18n/<lang>*.json (English text → translation) and writes each language to /<lang>/.
//
//   npm run i18n:extract   list every translatable string in src/i18n/_strings.json
//   npm run i18n:check     report missing or broken translations for every language
import fs from "node:fs";
import { parse } from "node-html-parser";
import config from "../config.mjs";

export const LANGS = [
  { code: "en", name: "English", og: "en_GB" },
  { code: "ru", name: "Русский", og: "ru_RU" },
  { code: "ka", name: "ქართული", og: "ka_GE" },
  { code: "es", name: "Español", og: "es_ES" },
  { code: "fr", name: "Français", og: "fr_FR" },
  { code: "it", name: "Italiano", og: "it_IT" },
  { code: "pt", name: "Português", og: "pt_PT" },
  { code: "de", name: "Deutsch", og: "de_DE" },
];
export const DEFAULT_LANG = "en";

// Strings used by main.js rather than in the HTML.
export const JS_STRINGS = {
  day: "Day",
  fill: "Please fill in the highlighted fields.",
  sending: "Sending…",
  sent: "Gmadlobt — thank you! We'll reply within a day.",
  failed: "Sorry, that didn't send. Please email us at",
  mailto: "Your email app should open with everything filled in — just press send.",
  thanks: "Thank you!",
  bc: "{n} BC",
  ad: "AD {n}",
  wanderer: "Wanderer",
  explorer: "Explorer",
  "golden-fleece": "Golden Fleece",
};

const INLINE = new Set(["a", "em", "strong", "b", "i", "small", "span", "br", "abbr", "q", "mark", "time", "s", "u", "sup", "sub", "cite"]);
const SKIP = new Set(["script", "style", "noscript", "code", "pre"]);
const ATTRS = ["alt", "title", "placeholder", "aria-label", "data-unit", "data-label"];
const hasLetters = (s) => /\p{L}/u.test(s);
const norm = (s) => s.replace(/\s+/g, " ").trim();
const opaque = (el) => /(^|\s)(price|tp)(\s|$)/.test(el.getAttribute?.("class") || "");
const skipped = (el) => el.getAttribute?.("translate") === "no" || el.getAttribute?.("lang") === "ka" || SKIP.has(el.rawTagName?.toLowerCase());

// A "leaf" holds text and only inline formatting, so it can be translated as one sentence.
function isLeaf(el) {
  let text = false;
  for (const c of el.childNodes) {
    if (c.nodeType === 3) {
      if (hasLetters(c.rawText)) text = true;
    } else if (c.nodeType === 1) {
      const tag = c.rawTagName.toLowerCase();
      if (!INLINE.has(tag) || opaque(c) || c.getAttribute("data-depth") != null) return false;
      if (c.querySelector && [...c.querySelectorAll("*")].some((d) => !INLINE.has(d.rawTagName.toLowerCase()) || opaque(d))) return false;
      if (hasLetters(c.textContent)) text = true;
    }
  }
  return text;
}

const escapeText = (s) => s.replace(/&(?![a-z#0-9]+;)/gi, "&amp;").replace(/</g, "&lt;");
const wordSpans = (text) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<span class="w">${escapeText(w)}</span>`)
    .join(" ");

/** Walks the document and calls visit(key, apply) for every translatable piece of text. */
function walk(root, visit) {
  const visitAttrs = (el) => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && hasLetters(v)) visit(norm(v), (t) => el.setAttribute(a, t));
    }
    if (el.rawTagName?.toLowerCase() === "meta") {
      const key = el.getAttribute("name") || el.getAttribute("property") || "";
      const v = el.getAttribute("content");
      if (/^(description|og:title|og:description)$/.test(key) && v && hasLetters(v)) visit(norm(v), (t) => el.setAttribute("content", t));
    }
  };
  const go = (el) => {
    if (el.nodeType !== 1) return;
    if (skipped(el)) return;
    visitAttrs(el);
    if (el.hasAttribute?.("data-scrub-words")) {
      const plain = norm(el.textContent);
      visit(plain, (t) => el.set_content(wordSpans(t)));
      return;
    }
    if (el.rawTagName && isLeaf(el)) {
      // Attributes on inline children (a title on an <abbr>) travel with the sentence.
      const html = el.innerHTML;
      const lead = html.match(/^\s*/)[0], tail = html.match(/\s*$/)[0];
      visit(norm(html), (t) => el.set_content(lead + t + tail));
      return;
    }
    for (const c of [...el.childNodes]) {
      if (c.nodeType === 3 && hasLetters(c.rawText)) {
        const raw = c.rawText;
        const lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
        visit(norm(raw), (t) => {
          c.rawText = lead + t + tail;
        });
      } else go(c);
    }
  };
  go(root);
}

const PARSE_OPTS = { comment: true, blockTextElements: { script: true, style: true, pre: true, textarea: true } };
const splitDoctype = (html) => {
  const m = html.match(/^<!doctype html>\n?/i);
  return [m ? m[0] : "", m ? html.slice(m[0].length) : html];
};

export function extract(html, into = new Set()) {
  const [, body] = splitDoctype(html);
  walk(parse(body, PARSE_OPTS), (key) => into.add(key));
  return into;
}

/** Load src/i18n/<lang>.json plus any <lang>.*.json parts. */
export function loadDict(dir, lang) {
  const dict = {};
  if (!fs.existsSync(dir)) return dict;
  for (const f of fs.readdirSync(dir).sort()) {
    if (f === `${lang}.json` || (f.startsWith(`${lang}.`) && f.endsWith(".json"))) Object.assign(dict, JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")));
  }
  return dict;
}

/**
 * Translate one built English page.
 * page: path of the page inside the site, e.g. "tours/cradle-of-wine.html".
 */
export function translatePage(html, { lang, dict, missing }) {
  const [doctype, body] = splitDoctype(html);
  const root = parse(body, PARSE_OPTS);
  walk(root, (key, apply) => {
    const t = dict[key];
    if (t) apply(t);
    else missing?.add(key);
  });
  const htmlEl = root.querySelector("html");
  htmlEl.setAttribute("lang", lang);
  htmlEl.setAttribute("data-site-root", "../" + (htmlEl.getAttribute("data-site-root") || ""));
  const og = root.querySelector('meta[property="og:locale"]');
  if (og) og.setAttribute("content", LANGS.find((l) => l.code === lang).og);
  let out = doctype + root.toString();
  // Pages move one folder down, so shared assets are one more level up.
  out = out.replace(/(["'\s,(])((?:\.\.\/)*)assets\//g, "$1../$2assets/");
  // Language links point at sibling languages, also one level up.
  out = out.replace(/(<a class="lang-link" href=")/g, "$1../");
  if (config.siteUrl) out = out.replace(`<link rel="canonical" href="${config.siteUrl}/`, `<link rel="canonical" href="${config.siteUrl}/${lang}/`);
  // Strings for main.js
  const js = Object.fromEntries(Object.entries(JS_STRINGS).map(([k, v]) => [k, dict[v] || v]));
  out = out.replace("window.MFS.t=null;", `window.MFS.t=${JSON.stringify(js)};`);
  out = out.replace(/(<select data-lang-switch[^>]*>[\s\S]*?)<\/select>/, (m) => m.replace(/ selected/g, "").replace(`value="${lang}"`, `value="${lang}" selected`));
  return out;
}

// Tag names plus the attributes that must never change (class, href, lang).
const tagSig = (s) =>
  (s.match(/<\/?[a-z][^>]*>/gi) || [])
    .map((x) => {
      const name = x.match(/^<\/?([a-z0-9]+)/i)[1].toLowerCase();
      const keep = (x.match(/\s(class|href|lang)="[^"]*"/g) || []).join("");
      return (x[1] === "/" ? "/" : "") + name + keep;
    })
    .sort()
    .join("|");
const digits = (s) => (s.replace(/(\d)[\s,.\u00a0\u202f'’](?=\d)/g, "$1").match(/\d+/g) || []).sort().join(" ");

/** Compare a translation with its source. Returns [errors, warnings]. */
export function problems(src, t) {
  if (typeof t !== "string" || !t.trim()) return ["missing", ""];
  if (tagSig(src) !== tagSig(t)) return ["HTML tags or their class/href differ from the English", ""];
  if (digits(src) !== digits(t)) return ["", `numbers differ (${digits(src)} → ${digits(t)})`];
  return ["", ""];
}
