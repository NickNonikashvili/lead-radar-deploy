"use strict";

/**
 * Site configuration.
 *
 * Everything a non-developer needs to change lives in `site.config.json`
 * (brand, phone, email, address, social links, exchange rate).
 * Secrets and per-deployment values come from environment variables (.env).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const file = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));

function clean(v) {
  return typeof v === "string" ? v.trim() : v;
}

/** Digits only, for tel: / wa.me links. */
function digits(v) {
  return String(v || "").replace(/[^\d+]/g, "");
}

const contact = file.contact || {};
const phone = clean(contact.phone) || "";
const whatsapp = clean(contact.whatsapp) || "";
const telegram = clean(contact.telegram) || "";

const config = {
  root: ROOT,
  brand: clean(file.brand) || "Luxhouse",
  legalName: clean(file.legalName) || clean(file.brand) || "Luxhouse",
  // Public origin, no trailing slash. Used for canonical URLs, sitemap and social previews.
  baseUrl: (process.env.BASE_URL || clean(file.baseUrl) || "").replace(/\/+$/, ""),
  languages: Array.isArray(file.languages) && file.languages.length ? file.languages : ["en", "ka", "ru"],
  fallbackLanguage: file.fallbackLanguage || "en",
  home: {
    heroListing: clean(file.home && file.home.heroListing) || "",
    tourShowcase: clean(file.home && file.home.tourShowcase) || "",
  },
  contact: {
    phone,
    phoneHref: phone ? `tel:${digits(phone)}` : "",
    whatsapp,
    whatsappHref: whatsapp ? `https://wa.me/${digits(whatsapp).replace(/^\+/, "")}` : "",
    telegram,
    telegramHref: telegram ? `https://t.me/${telegram.replace(/^@/, "")}` : "",
    email: clean(contact.email) || "",
    address: contact.address || {},
    hours: contact.hours || {},
    office: contact.office && Number.isFinite(contact.office.lat) && Number.isFinite(contact.office.lng)
      ? { lat: contact.office.lat, lng: contact.office.lng }
      : null,
  },
  social: Object.fromEntries(Object.entries(file.social || {}).filter(([, v]) => clean(v))),
  // Optional hand-picked frames and focal points per listing: see src/art.js.
  art: file.art && typeof file.art === "object" ? file.art : {},
  currency: {
    usdToGel: Number(file.currency && file.currency.usdToGel) || 2.7,
    rateDate: (file.currency && file.currency.rateDate) || "",
  },
  mortgage: Object.assign(
    { defaultDownPaymentPct: 30, defaultRatePct: 9.5, defaultYears: 15 },
    file.mortgage || {}
  ),
  port: Number(process.env.PORT) || 3100,
  dataDir: process.env.DATA_DIR || path.join(ROOT, "data"),
  admin: {
    user: process.env.ADMIN_USER || "admin",
    password: process.env.ADMIN_PASSWORD || "",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "",
    to: process.env.MAIL_TO || "",
  },
  webhookUrl: process.env.LEAD_WEBHOOK_URL || "",
  trustProxy: process.env.TRUST_PROXY || "",
  isProduction: process.env.NODE_ENV === "production",
};

module.exports = config;
