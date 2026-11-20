"use strict";

const dicts = {
  en: require("./en"),
  ka: require("./ka"),
  ru: require("./ru"),
};

const NBSP = " ";

function get(obj, key) {
  let cur = obj;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
}

/** Index of the plural form to use for `n` in each language. */
function pluralIndex(lang, n) {
  const abs = Math.abs(n);
  if (lang === "ru") {
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return 0;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
    return 2;
  }
  if (lang === "ka") return 0; // Georgian nouns stay singular after a numeral
  return abs === 1 ? 0 : 1;
}

/** 1234567 -> "1,234,567" (en) or "1 234 567" (ka, ru; non-breaking spaces). */
function formatNumber(value, lang, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const sep = lang === "en" ? "," : NBSP;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const dec = lang === "en" ? "." : ",";
  return (n < 0 ? "−" : "") + grouped + (frac ? dec + frac : "");
}

const CURRENCY_SYMBOL = { USD: "$", GEL: "₾", EUR: "€" };

function formatMoney(amount, currency, lang) {
  const sym = CURRENCY_SYMBOL[currency] || currency + NBSP;
  return sym + formatNumber(Math.round(amount), lang);
}

function formatDate(iso, lang) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  const locale = dicts[lang] ? dicts[lang].lang.locale : "en-US";
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(d);
  } catch (_) {
    return iso;
  }
}

function translator(lang) {
  const dict = dicts[lang] || dicts.en;
  const t = (key, vars) => {
    let v = get(dict, key);
    if (v === undefined) v = get(dicts.en, key);
    if (v === undefined) return key;
    return typeof v === "string" ? interpolate(v, vars) : v;
  };
  /** Plural-aware lookup: the dictionary value is an array of forms. */
  t.n = (key, n, vars) => {
    let forms = get(dict, key);
    if (!Array.isArray(forms)) forms = get(dicts.en, key);
    if (!Array.isArray(forms)) return key;
    const form = forms[Math.min(pluralIndex(lang, n), forms.length - 1)];
    return interpolate(form, Object.assign({ n: formatNumber(n, lang) }, vars));
  };
  t.num = (v, decimals) => formatNumber(v, lang, decimals);
  t.money = (amount, currency) => formatMoney(amount, currency, lang);
  t.date = (iso) => formatDate(iso, lang);
  t.area = (v) => `${formatNumber(v, lang)}${NBSP}${dict.units.m2}`;
  t.lang = lang;
  t.dict = dict;
  return t;
}

/** Pick the localized value of a `{ en, ka, ru }` field, falling back to English. */
function pick(field, lang) {
  if (field == null) return "";
  if (typeof field === "string" || Array.isArray(field)) return field;
  if (field[lang] != null && field[lang] !== "") return field[lang];
  return field.en != null ? field.en : "";
}

module.exports = { dicts, translator, pick, formatNumber, formatMoney, formatDate, pluralIndex, NBSP };
