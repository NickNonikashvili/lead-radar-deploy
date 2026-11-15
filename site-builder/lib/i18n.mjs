// Languages and translations for the site builder.
//
// Every visible English string goes through t() (plain text) or t.html() (escaped for HTML), and the content in
// data/*.mjs is translated field by field with translateData(). A translation file maps the English text to the
// translation: site-builder/i18n/<lang>/*.json, all files in the folder merged in name order:
//   { "Get a free quote": "Получить бесплатную оценку", "{n} demo accounts": { "one": "…", "few": "…", "many": "…", "other": "…" } }
// {name} placeholders must be kept. Missing strings fall back to English, and the build reports them.
// © 2026 EvoSoft Solutions. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';

export const LANGS = [
  { code: 'en', prefix: '', native: 'English', short: 'EN', locale: 'en_US', dateLocale: 'en-GB' },
  { code: 'ka', prefix: 'ka/', native: 'ქართული', short: 'KA', locale: 'ka_GE', dateLocale: 'ka-GE' },
  { code: 'ru', prefix: 'ru/', native: 'Русский', short: 'RU', locale: 'ru_RU', dateLocale: 'ru-RU' },
  { code: 'es', prefix: 'es/', native: 'Español', short: 'ES', locale: 'es_ES', dateLocale: 'es-ES' },
];

export const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function loadDict(dir, code) {
  const folder = path.join(dir, code);
  const dict = {};
  if (code === 'en' || !fs.existsSync(folder)) return dict;
  for (const name of fs.readdirSync(folder).filter((f) => f.endsWith('.json')).sort()) {
    let part;
    try {
      part = JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
    } catch (e) {
      throw new Error(`Translation file ${code}/${name} is not valid JSON: ${e.message}`);
    }
    for (const [k, v] of Object.entries(part)) if (v !== '' && v !== null) dict[k] = v;
  }
  return dict;
}

/**
 * t(key, vars)          translated plain text, {placeholders} filled from vars
 * t.html(key, vars)     the same, HTML-escaped first; vars are inserted as they are (so they may hold markup)
 * t.n(n, one, other)    a count: English picks one/other; a translation of `other` may give every plural form
 * sink(key, info)       called for every lookup (the English build uses it to list all strings)
 */
export function makeT(code, dict, sink) {
  const rules = new Intl.PluralRules(code);
  const missing = new Map();
  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m)) : s);
  function lookup(key, n, ctx, plural) {
    if (sink) sink(key, { ctx, plural });
    let v = code === 'en' ? undefined : dict[key];
    if (v === undefined) {
      if (code !== 'en' && !missing.has(key)) missing.set(key, { ctx, plural });
      return null;
    }
    if (typeof v === 'object') v = v[rules.select(Number(n ?? 0))] ?? v.other ?? null;
    return typeof v === 'string' ? v : null;
  }
  const t = (key, vars, ctx) => fill(lookup(key, vars?.n, ctx, false) ?? key, vars);
  t.html = (key, vars, ctx) => fill(escHtml(lookup(key, vars?.n, ctx, false) ?? key), vars);
  t.n = (n, one, other, vars = {}, ctx) => {
    const v = lookup(other, n, ctx, true);
    return fill(v ?? (n === 1 ? one : other), { n, ...vars });
  };
  t.missing = missing;
  t.code = code;
  return t;
}

// ---------- translating the data files ----------
// Keys whose values are never translated (addresses, logins, file names, tech names, people's and products' names).
const SKIP = new Set(['slug', 'url', 'href', 'key', 'login', 'password', 'icon', 'file', 'og', 'accent', 'tile', 'signinUrl', 'email', 'phones', 'countryCode', 'legalName', 'stack', 'stats', 'year']);

export function isText(at, value) {
  if (typeof value !== 'string' || !/\p{L}/u.test(value)) return false;
  if (at.some((p) => SKIP.has(p))) return false;
  const last = at[at.length - 1];
  if (last === 'name' && !['services', 'chat'].includes(at[0])) return false;
  // Table rows: the first column holds IDs and addresses.
  const r = at.lastIndexOf('rows');
  if (r >= 0 && at.length === r + 3 && at[r + 2] === 0) return false;
  // extras: [label, value]; the value is a code or a login.
  if (at.includes('extras') && last === 1) return false;
  // A single token that looks like a host name, an email, a path or a code.
  if (!/\s/.test(value) && /[@/]|^[\w-]+(\.[\w-]+)+$|\d/.test(value)) return false;
  return true;
}

// In the data, a table can list `rawColumns` (column numbers shown exactly as written, e.g. names inside an English
// demo), and an account whose `name` is a label rather than a person's name sets `translateName: true`.
export function translateData(value, t, at = []) {
  if (Array.isArray(value)) return value.map((v, i) => translateData(v, t, [...at, i]));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'rows' && Array.isArray(value.rawColumns) && Array.isArray(v)) out[k] = v.map((row, ri) => row.map((c, ci) => (value.rawColumns.includes(ci) ? c : translateData(c, t, [...at, k, ri, ci]))));
      else if (k === 'name' && value.translateName && typeof v === 'string') out[k] = t(v, undefined, `data: ${[...at, k].join('.')}`);
      else out[k] = translateData(v, t, [...at, k]);
    }
    return out;
  }
  return isText(at, value) ? t(value, undefined, `data: ${at.join('.')}`) : value;
}
