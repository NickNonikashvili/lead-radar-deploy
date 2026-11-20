"use strict";

require("dotenv").config({ quiet: true });

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const { rateLimit } = require("express-rate-limit");

const config = require("./src/config");
const i18n = require("./src/i18n");
const listings = require("./src/listings");
const leads = require("./src/leads");
const validate = require("./src/validate");
const { notify } = require("./src/notify");

const app = express();
const ASSET_VERSION = Date.now().toString(36);
const LEGAL_UPDATED = "2026-11-20";

app.disable("x-powered-by");
if (config.trustProxy) app.set("trust proxy", /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy === "true" ? 1 : config.trustProxy);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ------------------------------------------------------------------ security & static
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        // 'wasm-unsafe-eval' lets the 3D viewer start its mesh decoder (WebAssembly); no JS eval is allowed.
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://tile.openstreetmap.org"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: config.isProduction,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);
app.use((req, res, next) => {
  // Motion sensors and the XR device are used by the 3D tour; nothing else is needed.
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), xr-spatial-tracking=(self), gyroscope=(self), accelerometer=(self)");
  next();
});
app.use(compression());
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
    maxAge: config.isProduction ? "7d" : 0,
    setHeaders(res, file) {
      if (config.isProduction && /[\\/]media[\\/]|[\\/]vendor[\\/]/.test(file)) {
        res.setHeader("Cache-Control", "public, max-age=2592000");
      }
    },
  })
);
app.use(express.json({ limit: "20kb" }));

// ------------------------------------------------------------------ helpers
function origin(req) {
  return config.baseUrl || `${req.protocol}://${req.get("host")}`;
}

function negotiate(req) {
  const match = req.acceptsLanguages(...config.languages);
  return match || config.fallbackLanguage;
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function organizationLd(req, lang, t) {
  const o = {
    "@type": "RealEstateAgent",
    "@id": `${origin(req)}/#agency`,
    name: config.brand,
    url: `${origin(req)}/${lang}/`,
    description: t("meta.description", { brand: config.brand }),
    areaServed: { "@type": "City", name: "Tbilisi" },
  };
  if (config.contact.phone) o.telephone = config.contact.phone;
  if (config.contact.email) o.email = config.contact.email;
  const addr = i18n.pick(config.contact.address, lang);
  if (addr) o.address = { "@type": "PostalAddress", streetAddress: addr, addressLocality: "Tbilisi", addressCountry: "GE" };
  const same = Object.values(config.social);
  if (same.length) o.sameAs = same;
  return o;
}

/** Build the locals shared by every page of one language. */
function baseLocals(req, lang) {
  const t = i18n.translator(lang);
  // Path without the language prefix, e.g. "/residences/foo"
  const rest = req.originalUrl.split("?")[0].replace(new RegExp(`^/${lang}(?=/|$)`), "") || "/";
  const normalizedRest = rest === "/" ? "/" : rest.replace(/\/+$/, "");
  const alternates = Object.fromEntries(config.languages.map((l) => [l, `/${l}${normalizedRest === "/" ? "/" : normalizedRest}`]));
  const base = origin(req);
  return {
    lang,
    t,
    pick: (f) => i18n.pick(f, lang),
    config,
    languages: config.languages.map((l) => ({ code: l, short: i18n.dicts[l].lang.short, name: i18n.dicts[l].lang.name, url: alternates[l], current: l === lang })),
    alternates,
    origin: base,
    canonical: base + alternates[lang],
    path: normalizedRest,
    url: (p = "/") => `/${lang}${p === "/" ? "/" : p}`,
    asset: (p) => `${p}?v=${ASSET_VERSION}`,
    jsonLd,
    year: new Date().getFullYear(),
    title: "",
    description: t("meta.description", { brand: config.brand }),
    ogImage: "",
    headerOverlay: false,
    bodyClass: "",
    ld: [],
    noindex: false,
    scripts: [],
    styles: [],
    anyTour: listings.all().some((l) => l.hasTour),
    savedCardsUrl: `/api/cards?lang=${lang}`,
    legalUpdated: LEGAL_UPDATED,
  };
}

function render(req, res, next, page, locals, status = 200) {
  const data = Object.assign({}, res.locals.base, locals);
  data.ld = [organizationLd(req, data.lang, data.t)].concat(data.ld || []);
  app.render(`pages/${page}`, data, (err, body) => {
    if (err) return next(err);
    res.status(status).render("layout", Object.assign(data, { body }));
  });
}

function cardViews(list, lang, t) {
  return list.map((l) => listings.view(l, lang, t));
}

// ------------------------------------------------------------------ root, robots, sitemap, health
app.get("/", (req, res) => {
  res.vary("Accept-Language");
  res.redirect(302, `/${negotiate(req)}/`);
});

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin(req)}/sitemap.xml\n`);
});

const STATIC_PAGES = ["/", "/residences", "/services", "/sell", "/about", "/contact", "/privacy", "/terms"];

app.get("/sitemap.xml", (req, res) => {
  const base = origin(req);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const paths = STATIC_PAGES.map((p) => ({ p }));
  for (const l of listings.all()) {
    paths.push({ p: `/residences/${l.slug}`, lastmod: l.listedAt });
    if (l.hasTour) paths.push({ p: `/residences/${l.slug}/tour`, lastmod: l.listedAt });
  }
  const loc = (lang, p) => esc(`${base}/${lang}${p === "/" ? "/" : p}`);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  for (const { p, lastmod } of paths) {
    for (const lang of config.languages) {
      xml += `  <url>\n    <loc>${loc(lang, p)}</loc>\n`;
      if (lastmod) xml += `    <lastmod>${esc(lastmod)}</lastmod>\n`;
      for (const alt of config.languages) xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${loc(alt, p)}"/>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc(config.fallbackLanguage, p)}"/>\n  </url>\n`;
    }
  }
  xml += "</urlset>\n";
  res.type("application/xml").send(xml);
});

// ------------------------------------------------------------------ API
const inquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ ok: false, error: "tooMany" }),
});

app.post("/api/inquiries", inquiryLimiter, async (req, res, next) => {
  try {
    const result = validate.inquiry(req.body, listings.bySlug);
    // Bots that fill the honeypot get a success response and nothing is stored.
    if (result.spam) return res.json({ ok: true });
    if (!result.ok) return res.status(422).json({ ok: false, error: "validation", fields: result.errors });

    const lead = await leads.add(
      Object.assign(result.value, {
        meta: {
          ip: req.ip,
          userAgent: String(req.get("user-agent") || "").slice(0, 300),
          page: String(req.get("referer") || "").slice(0, 300),
        },
      })
    );
    // Do not make the visitor wait for email/webhook delivery.
    notify(lead).catch((err) => console.error("[notify]", err));
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Server-rendered cards for the "Saved" page (the saved list lives in the visitor's browser). */
app.get("/api/cards", (req, res, next) => {
  const lang = config.languages.includes(req.query.lang) ? req.query.lang : config.fallbackLanguage;
  const slugs = String(req.query.slugs || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  const t = i18n.translator(lang);
  const found = slugs.map((s) => listings.bySlug(s)).filter(Boolean);
  const locals = Object.assign(baseLocals(req, lang), { cards: cardViews(found, lang, t) });
  app.render("partials/card-list", locals, (err, html) => {
    if (err) return next(err);
    res.set("Cache-Control", "no-store").json({ count: found.length, html });
  });
});

// ------------------------------------------------------------------ admin (enquiry inbox)
function adminAuth(req, res, next) {
  if (!config.admin.password) return res.status(404).send("Not found");
  const header = req.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    const eq = (a, b) => {
      const ha = crypto.createHash("sha256").update(a).digest();
      const hb = crypto.createHash("sha256").update(b).digest();
      return crypto.timingSafeEqual(ha, hb);
    };
    if (idx > -1 && eq(user, config.admin.user) && eq(pass, config.admin.password)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Admin", charset="UTF-8"').status(401).send("Authentication required");
}

const adminLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false });
const admin = express.Router();
admin.use(adminLimiter, adminAuth, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

/** State-changing admin calls must come from our own page (blocks cross-site form posts). */
function sameOriginJson(req, res, next) {
  if (req.get("x-requested-with") !== "fetch" || !req.is("application/json")) return res.status(400).json({ ok: false });
  next();
}

admin.get("/", async (req, res, next) => {
  try {
    const all = await leads.list();
    const status = leads.STATUSES.includes(req.query.status) ? req.query.status : "";
    const items = status ? all.filter((x) => x.status === status) : all;
    const counts = Object.fromEntries(leads.STATUSES.map((s) => [s, all.filter((x) => x.status === s).length]));
    res.render("admin/inbox", { config, items, counts, total: all.length, status, statuses: leads.STATUSES, asset: (p) => `${p}?v=${ASSET_VERSION}` });
  } catch (err) {
    next(err);
  }
});

admin.patch("/api/inquiries/:id", sameOriginJson, async (req, res, next) => {
  try {
    const item = await leads.update(req.params.id, { status: req.body.status, notes: req.body.notes });
    if (!item) return res.status(404).json({ ok: false });
    res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
});

admin.delete("/api/inquiries/:id", sameOriginJson, async (req, res, next) => {
  try {
    const ok = await leads.remove(req.params.id);
    res.status(ok ? 200 : 404).json({ ok });
  } catch (err) {
    next(err);
  }
});

admin.get("/export.csv", async (req, res, next) => {
  try {
    const all = await leads.list();
    const cols = ["createdAt", "status", "type", "name", "phone", "email", "lang", "residence", "date", "subject", "propertyLocation", "propertyType", "propertyArea", "expectedPrice", "message", "notes"];
    const cell = (v) => {
      let s = v === undefined || v === null ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = all.map((x) =>
      [
        x.createdAt, x.status, x.type, x.name, x.phone, x.email, x.lang,
        x.listing ? `${x.listing.ref} ${x.listing.title}` : "",
        x.date, x.subject,
        x.property && x.property.location, x.property && x.property.type, x.property && x.property.area, x.property && x.property.expectedPrice,
        x.message, x.notes,
      ].map(cell).join(",")
    );
    res.set("Content-Disposition", 'attachment; filename="inquiries.csv"');
    res.type("text/csv").send("\ufeff" + cols.join(",") + "\r\n" + rows.join("\r\n") + "\r\n");
  } catch (err) {
    next(err);
  }
});

app.use("/admin", admin);

// ------------------------------------------------------------------ public pages, one router per language
function languageRouter(lang) {
  const router = express.Router();
  const t = i18n.translator(lang);

  router.use((req, res, next) => {
    res.locals.base = baseLocals(req, lang);
    next();
  });

  router.get("/", (req, res, next) => {
    const all = listings.all();
    const featured = all.filter((l) => l.featured).sort(listings.SORTS["price-desc"]);
    const hero = all.find((l) => l.slug === config.home.heroListing) || featured[0] || all[0];
    // The 3D section links to a real tour when one exists; until then it only shows a photograph.
    const preferred = all.find((l) => l.slug === config.home.tourShowcase);
    const tourListing = (preferred && preferred.hasTour ? preferred : all.find((l) => l.hasTour)) || null;
    const showcase = tourListing || preferred || hero;
    render(req, res, next, "home", {
      title: `${config.brand} — ${t("meta.tagline")}`,
      headerOverlay: true,
      hero: hero ? listings.view(hero, lang, t) : null,
      featured: cardViews(featured.length ? featured : all, lang, t),
      tourListing: tourListing ? listings.view(tourListing, lang, t) : null,
      showcase: showcase ? listings.view(showcase, lang, t) : null,
      locations: listings.locations(lang),
      ogImage: hero ? hero.ogImage : "",
    });
  });

  router.get("/residences", (req, res, next) => {
    const filters = listings.parseFilters(req.query);
    const results = listings.search(filters);
    const active = Boolean(filters.location || filters.maxPrice || filters.minBedrooms || filters.minArea || filters.pool || filters.tour);
    const cards = cardViews(results, lang, t);
    render(req, res, next, "residences", {
      title: `${t("residences.title")} — ${config.brand}`,
      description: t("residences.lead"),
      filters,
      filtersActive: active,
      cards,
      locations: listings.locations(lang),
      mapPoints: cards.map((c) => ({ slug: c.slug, title: c.title, place: c.district, price: c.priceLabel, url: c.url, lat: c.location.lat, lng: c.location.lng, radius: c.location.radiusM, img: c.cover.src(640) })),
      noindex: active || filters.sort !== "newest",
      canonical: res.locals.base.origin + `/${lang}/residences`,
      scripts: ["/vendor/leaflet/leaflet.js"],
      styles: ["/vendor/leaflet/leaflet.css"],
    });
  });

  router.get("/residences/:slug", (req, res, next) => {
    const l = listings.bySlug(req.params.slug);
    if (!l) return next();
    const v = listings.view(l, lang, t);
    const others = listings.all().filter((x) => x.slug !== l.slug).slice(0, 3);
    const base = res.locals.base;
    const ld = [
      {
        "@type": "RealEstateListing",
        "@id": `${base.canonical}#listing`,
        url: base.canonical,
        name: `${v.title} — ${v.place}`,
        description: v.tagline,
        datePosted: l.listedAt,
        inLanguage: lang,
        image: l.photos.slice(0, 8).map((p) => base.origin + p.full),
        ...(v.price
          ? {
              offers: {
                "@type": "Offer",
                price: v.price.amount,
                priceCurrency: v.price.currency,
                availability: l.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
                seller: { "@id": `${base.origin}/#agency` },
              },
            }
          : {}),
        mainEntity: {
          "@type": "SingleFamilyResidence",
          name: v.title,
          numberOfRooms: l.facts.rooms,
          numberOfBedrooms: l.facts.bedrooms,
          floorSize: { "@type": "QuantitativeValue", value: l.facts.areaM2, unitCode: "MTK" },
          address: { "@type": "PostalAddress", addressLocality: v.district, addressRegion: "Tbilisi", addressCountry: "GE" },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("nav.home"), item: `${base.origin}/${lang}/` },
          { "@type": "ListItem", position: 2, name: t("nav.residences"), item: `${base.origin}/${lang}/residences` },
          { "@type": "ListItem", position: 3, name: v.title, item: base.canonical },
        ],
      },
    ];
    render(req, res, next, "residence", {
      title: `${v.title}, ${v.district} — ${v.priceLabel} — ${config.brand}`,
      description: v.tagline,
      ogImage: l.ogImage,
      headerOverlay: true,
      r: v,
      others: cardViews(others, lang, t),
      gel: v.price && v.price.currency === "USD" ? Math.round(v.price.amount * config.currency.usdToGel) : null,
      ld,
      scripts: ["/vendor/leaflet/leaflet.js"],
      styles: ["/vendor/leaflet/leaflet.css"],
    });
  });

  router.get("/residences/:slug/tour", (req, res, next) => {
    const l = listings.bySlug(req.params.slug);
    if (!l || !l.hasTour) return next();
    const v = listings.view(l, lang, t);
    const base = res.locals.base;
    const mediaBase = `/media/listings/${l.slug}/tour/`;
    const tourData = {
      base: mediaBase,
      version: l.tour.version || 1,
      scenes: l.tour.scenes.map((s) => ({
        ...s,
        label: s.room ? t(`rooms.${s.room}`) : "",
      })),
      strings: t("tour"),
      listingUrl: v.url,
      galleryUrl: v.url + "#gallery",
    };
    res.render(
      "pages/tour",
      Object.assign({}, base, {
        title: `${t("tour.title", { title: v.title })} — ${config.brand}`,
        description: t("residence.tourText"),
        ogImage: l.ogImage,
        r: v,
        tourData,
      })
    );
  });

  const simple = (route, page, locals) =>
    router.get(route, (req, res, next) => render(req, res, next, page, typeof locals === "function" ? locals(req, res) : locals));

  simple("/services", "services", { title: `${t("services.title")} — ${config.brand}`, description: t("services.lead") });
  simple("/sell", "sell", { title: `${t("sell.title", { brand: config.brand })}`, description: t("sell.lead") });
  simple("/about", "about", { title: `${t("about.title", { brand: config.brand })}`, description: t("about.lead") });
  simple("/contact", "contact", () => ({
    title: `${t("contact.title")} — ${config.brand}`,
    description: t("contact.lead"),
    scripts: config.contact.office ? ["/vendor/leaflet/leaflet.js"] : [],
    styles: config.contact.office ? ["/vendor/leaflet/leaflet.css"] : [],
  }));
  simple("/saved", "saved", { title: `${t("saved.title")} — ${config.brand}`, noindex: true });
  simple("/privacy", "legal", { title: `${t("legal.privacyTitle")} — ${config.brand}`, legalTitle: t("legal.privacyTitle"), sections: t("legal.privacy") });
  simple("/terms", "legal", { title: `${t("legal.termsTitle")} — ${config.brand}`, legalTitle: t("legal.termsTitle"), sections: t("legal.terms") });

  return router;
}

for (const lang of config.languages) app.use(`/${lang}`, languageRouter(lang));

// ------------------------------------------------------------------ 404 and errors
function langFromPath(req) {
  const first = req.path.split("/")[1];
  return config.languages.includes(first) ? first : negotiate(req);
}

app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/admin")) return res.status(404).json({ ok: false, error: "not_found" });
  const lang = langFromPath(req);
  const t = i18n.translator(lang);
  res.locals.base = Object.assign(baseLocals(req, lang), {
    // A missing page has no translations to point at: send the language switcher to each home page.
    languages: config.languages.map((l) => ({ code: l, short: i18n.dicts[l].lang.short, name: i18n.dicts[l].lang.name, url: `/${l}/`, current: l === lang })),
    alternates: {},
    canonical: "",
  });
  render(req, res, next, "404", { title: `${t("errors.notFoundTitle")} — ${config.brand}`, noindex: true }, 404);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ ok: false, error: "bad_json" });
  if (err && err.type === "entity.too.large") return res.status(413).json({ ok: false, error: "too_large" });
  console.error("[error]", req.method, req.originalUrl, err);
  if (res.headersSent) return;
  if (req.path.startsWith("/api/") || req.path.startsWith("/admin")) return res.status(500).json({ ok: false, error: "server" });
  const t = i18n.translator(langFromPath(req));
  res
    .status(500)
    .type("html")
    .send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t("errors.serverTitle")}</title><body style="font-family:system-ui;padding:12vh 8vw;background:#f6f3ee;color:#101214"><h1 style="font-weight:500">${t("errors.serverTitle")}</h1><p>${t("errors.serverText")}</p><p><a href="/" style="color:inherit">${config.brand}</a></p>`);
});

// ------------------------------------------------------------------ start
if (require.main === module) {
  leads.selfCheck();
  const count = listings.all().length;
  const skipped = listings.loadProblems();
  app.listen(config.port, () => {
    console.log(`${config.brand} running at http://localhost:${config.port}  (${count} residences, languages: ${config.languages.join(", ")})`);
    if (skipped.length) console.log(`WARNING: ${skipped.length} listing file(s) were skipped. Run "npm run check" for details.`);
    if (!config.admin.password) console.log("Admin inbox is disabled: set ADMIN_PASSWORD in .env to enable /admin");
    if (!config.baseUrl) console.log("Tip: set BASE_URL (or baseUrl in site.config.json) to your public address for correct canonical links.");
  });
}

module.exports = app;
