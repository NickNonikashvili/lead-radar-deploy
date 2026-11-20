"use strict";

/**
 * Listings are plain JSON files in content/listings/. This module loads and
 * validates them, joins the generated image manifest and any generated 3D
 * tour manifest, and produces per-language view models for the templates.
 */

const fs = require("fs");
const path = require("path");
const config = require("./config");
const { pick } = require("./i18n");

const LISTINGS_DIR = path.join(config.root, "content", "listings");
const MEDIA_MANIFEST = path.join(config.root, "content", "generated", "media.json");
const MEDIA_ROOT = path.join(config.root, "public", "media", "listings");

const STATUSES = ["for-sale", "reserved", "sold"];
let cache = null;
let cacheStamp = "";

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (fallback !== undefined && err.code === "ENOENT") return fallback;
    throw new Error(`Cannot read ${path.relative(config.root, file)}: ${err.message}`);
  }
}

function stamp() {
  const parts = [];
  for (const f of fs.readdirSync(LISTINGS_DIR)) {
    if (f.endsWith(".json")) parts.push(f + ":" + fs.statSync(path.join(LISTINGS_DIR, f)).mtimeMs);
  }
  if (fs.existsSync(MEDIA_MANIFEST)) parts.push("media:" + fs.statSync(MEDIA_MANIFEST).mtimeMs);
  if (fs.existsSync(MEDIA_ROOT)) {
    for (const slug of fs.readdirSync(MEDIA_ROOT)) {
      const tour = path.join(MEDIA_ROOT, slug, "tour", "tour.json");
      if (fs.existsSync(tour)) parts.push("tour:" + slug + ":" + fs.statSync(tour).mtimeMs);
    }
  }
  return parts.join("|");
}

/** Throws a readable error if a listing file is missing something the site relies on. */
function validate(l, file) {
  const fail = (msg) => {
    throw new Error(`Listing ${file}: ${msg}`);
  };
  if (!l.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(l.slug)) fail("`slug` must be lowercase letters, digits and dashes");
  if (file !== l.slug + ".json") fail(`file name must be ${l.slug}.json`);
  if (!l.ref) fail("`ref` is required");
  if (!STATUSES.includes(l.status)) fail("`status` must be one of " + STATUSES.join(", "));
  if (!l.title || !l.title.en) fail("`title.en` is required");
  if (l.price && l.price.amount != null && !(Number(l.price.amount) > 0)) fail("`price.amount` must be a positive number");
  if (!l.location || !l.location.key || !l.location.district) fail("`location.key` and `location.district` are required");
  if (!Array.isArray(l.photos) || !l.photos.length) fail("at least one photo is required");
  if (!l.facts || !(Number(l.facts.areaM2) > 0)) fail("`facts.areaM2` is required");
}

function load() {
  const s = stamp();
  if (cache && s === cacheStamp) return cache;

  const media = readJson(MEDIA_MANIFEST, {});
  const list = [];
  for (const file of fs.readdirSync(LISTINGS_DIR).sort()) {
    if (!file.endsWith(".json")) continue;
    const l = readJson(path.join(LISTINGS_DIR, file));
    validate(l, file);
    const m = media[l.slug] || {};

    l.photos = l.photos
      .filter((p) => m[p.file]) // only photos that have built variants
      .map((p) => {
        const info = m[p.file];
        const base = `/media/listings/${l.slug}/${p.file}`;
        return {
          file: p.file,
          room: p.room || "",
          w: info.w,
          h: info.h,
          color: info.color,
          widths: info.widths,
          src: (w) => `${base}-${info.widths.includes(w) ? w : info.widths[info.widths.length - 1]}.webp`,
          srcset: info.widths.map((w) => `${base}-${w}.webp ${w}w`).join(", "),
          full: `${base}-${info.widths[info.widths.length - 1]}.webp`,
          portrait: info.h > info.w,
        };
      });
    if (!l.photos.length) continue; // images not built yet

    l.coverPhoto = l.photos.find((p) => p.file === l.cover) || l.photos[0];
    l.ogImage = `/media/listings/${l.slug}/og.jpg`;
    l.pricePerM2 = l.price && l.price.amount ? Math.round(l.price.amount / l.facts.areaM2) : null;
    l.hasPool = (l.features || []).includes("pool");

    const tourFile = path.join(MEDIA_ROOT, l.slug, "tour", "tour.json");
    l.tour = null;
    if (fs.existsSync(tourFile)) {
      const tour = readJson(tourFile);
      if (tour && Array.isArray(tour.scenes) && tour.scenes.length) l.tour = tour;
    }
    l.hasTour = Boolean(l.tour);
    list.push(l);
  }

  cache = list;
  cacheStamp = s;
  return cache;
}

function all() {
  return load().filter((l) => l.published !== false);
}

function bySlug(slug) {
  return all().find((l) => l.slug === slug) || null;
}

/** Distinct locations, for the filter drop-downs. */
function locations(lang) {
  const seen = new Map();
  for (const l of all()) {
    if (!seen.has(l.location.key)) seen.set(l.location.key, pick(l.location.district, lang));
  }
  return [...seen].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, lang));
}

const SORTS = {
  newest: (a, b) => String(b.listedAt || "").localeCompare(String(a.listedAt || "")),
  "price-desc": (a, b) => (b.price?.amount || 0) - (a.price?.amount || 0),
  "price-asc": (a, b) => (a.price?.amount || Infinity) - (b.price?.amount || Infinity),
  area: (a, b) => b.facts.areaM2 - a.facts.areaM2,
};

/** Parse and sanitize filter query parameters. */
function parseFilters(query) {
  const num = (v) => {
    const n = Number(String(v || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const keys = new Set(all().map((l) => l.location.key));
  return {
    location: keys.has(query.location) ? query.location : "",
    maxPrice: num(query.maxPrice),
    minBedrooms: num(query.minBedrooms),
    minArea: num(query.minArea),
    pool: query.pool === "1",
    tour: query.tour === "1",
    sort: Object.prototype.hasOwnProperty.call(SORTS, query.sort) ? query.sort : "newest",
  };
}

function search(filters) {
  const f = filters;
  return all()
    .filter((l) => !f.location || l.location.key === f.location)
    .filter((l) => !f.maxPrice || (l.price && l.price.amount <= f.maxPrice))
    .filter((l) => !f.minBedrooms || (l.facts.bedrooms || 0) >= f.minBedrooms)
    .filter((l) => !f.minArea || l.facts.areaM2 >= f.minArea)
    .filter((l) => !f.pool || l.hasPool)
    .filter((l) => !f.tour || l.hasTour)
    .sort(SORTS[f.sort]);
}

/** Flatten a listing into the strings a template needs for one language. */
function view(l, lang, t) {
  const facts = l.facts;
  const factRows = [];
  const add = (key, value) => {
    if (value !== null && value !== undefined && value !== "") factRows.push({ key, label: t(`residence.facts.${key}`), value });
  };
  add("area", t.area(facts.areaM2));
  if (facts.livingM2) add("living", t.area(facts.livingM2));
  if (facts.landM2) add("land", t.area(facts.landM2));
  add("rooms", facts.rooms);
  add("bedrooms", facts.bedrooms);
  add("bathrooms", facts.bathrooms);
  add("floors", facts.floors);
  if (facts.balconies) add("balconies", facts.balconyM2 ? `${facts.balconies} · ${t.area(facts.balconyM2)}` : facts.balconies);
  if (facts.build) add("build", t(`residence.values.${facts.build}`));
  if (facts.condition) add("condition", t(`residence.values.${facts.condition}`));
  if (facts.furnished) add("furnished", t("common.yes"));
  if (facts.landUse) add("landUse", t(`residence.values.${facts.landUse}`));
  if (l.pricePerM2) add("pricePerM2", t.money(l.pricePerM2, l.price.currency));

  const title = pick(l.title, lang);
  const district = pick(l.location.district, lang);
  const context = pick(l.location.context, lang);
  return {
    raw: l,
    slug: l.slug,
    ref: l.ref,
    status: l.status,
    statusLabel: t(`status.${l.status}`),
    url: `/${lang}/residences/${l.slug}`,
    tourUrl: l.hasTour ? `/${lang}/residences/${l.slug}/tour` : "",
    title,
    tagline: pick(l.tagline, lang),
    description: pick(l.description, lang) || [],
    highlights: pick(l.highlights, lang) || [],
    features: (l.features || []).map((key) => ({ key, label: t(`features.${key}`) })),
    district,
    context,
    place: context ? `${district}, ${context}` : district,
    price: l.price && l.price.amount ? l.price : null,
    priceLabel: l.price && l.price.amount ? t.money(l.price.amount, l.price.currency) : t("residence.priceOnRequest"),
    pricePerM2: l.pricePerM2,
    facts,
    factRows,
    photos: l.photos.map((p) => ({
      ...p,
      roomLabel: p.room ? t(`rooms.${p.room}`) : "",
      alt: p.room ? `${t(`rooms.${p.room}`)} — ${title}, ${district}` : `${title}, ${district}`,
    })),
    cover: null,
    hasTour: l.hasTour,
    hasPool: l.hasPool,
    tour: l.tour,
    location: l.location,
    ogImage: l.ogImage,
    listedAt: l.listedAt,
  };
}

function viewWithCover(l, lang, t) {
  const v = view(l, lang, t);
  v.cover = v.photos.find((p) => p.file === l.coverPhoto.file) || v.photos[0];
  return v;
}

module.exports = { all, bySlug, locations, parseFilters, search, view: viewWithCover, SORTS, STATUSES };
