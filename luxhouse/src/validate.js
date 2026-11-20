"use strict";

const config = require("./config");
const leads = require("./leads");

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const SUBJECTS = ["general", "buying", "selling", "viewing"];
const PROPERTY_TYPES = ["house", "villa", "townhouse", "penthouse", "apartment", "land", "other"];

/** Trim, collapse control characters and cap the length of free text. */
function text(v, max) {
  if (v === undefined || v === null) return "";
  return String(v)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function oneLine(v, max) {
  return text(v, max).replace(/\s+/g, " ");
}

/**
 * Validate an enquiry submitted by one of the site's forms.
 * Returns { ok, errors, value, spam } — `errors` maps field name to a
 * translation key under `form.*`.
 */
function inquiry(body, findListing) {
  const b = body && typeof body === "object" ? body : {};
  const errors = {};

  // Honeypot: real visitors never see or fill this field.
  if (text(b.website, 200)) return { ok: false, spam: true, errors: {}, value: null };

  const type = leads.TYPES.includes(b.type) ? b.type : "contact";
  const lang = config.languages.includes(b.lang) ? b.lang : config.fallbackLanguage;

  const name = oneLine(b.name, 120);
  if (name.length < 2) errors.name = "errName";

  const phone = oneLine(b.phone, 40);
  const email = oneLine(b.email, 160).toLowerCase();
  const phoneDigits = phone.replace(/\D/g, "");
  if (!phone && !email) errors.contact = "errContact";
  if (phone && (phoneDigits.length < 6 || phoneDigits.length > 16 || !/^[\d\s()+\-./]+$/.test(phone))) errors.phone = "errPhone";
  if (email && !EMAIL_RE.test(email)) errors.email = "errEmail";

  if (b.consent !== true && b.consent !== "true" && b.consent !== "on") errors.consent = "errConsent";

  const value = { type, lang, name, phone, email, message: text(b.message, 3000) };

  const date = oneLine(b.date, 10);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date))) value.date = date;

  if (b.slug) {
    const listing = findListing(oneLine(b.slug, 120));
    if (listing) value.listing = { slug: listing.slug, ref: listing.ref, title: listing.title.en };
  }

  if (type === "contact") {
    const subject = oneLine(b.subject, 40);
    if (SUBJECTS.includes(subject)) value.subject = subject;
  }

  if (type === "valuation") {
    const property = {
      location: oneLine(b.propertyLocation, 200),
      type: PROPERTY_TYPES.includes(b.propertyType) ? b.propertyType : "",
      area: oneLine(b.propertyArea, 20).replace(/[^\d.,]/g, ""),
      expectedPrice: oneLine(b.expectedPrice, 30).replace(/[^\d.,\s]/g, "").trim(),
    };
    value.property = Object.fromEntries(Object.entries(property).filter(([, v]) => v));
  }

  return { ok: Object.keys(errors).length === 0, errors, value, spam: false };
}

module.exports = { inquiry, SUBJECTS, PROPERTY_TYPES, EMAIL_RE };
