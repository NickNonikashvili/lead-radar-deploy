// © 2026 EvoSoft Solutions
// Prices for the quote builder (/estimate). All amounts are US dollars. STARTER PRICES: change them to your own.
//
// The build writes this file to evosoft-site/api/pricing.json (for api/quote.php, which recomputes every estimate on
// the server, so what you see in the email and the admin panel is never what a visitor's browser claimed) and into the
// /estimate page (for the live price). Both use the same rules, written out below; change a rule in both places:
// evosoft-site/assets/js/estimate.js (estimate()) and evosoft-site/api/lib.php (evo_estimate()).
//
// HOW AN ESTIMATE IS WORKED OUT
//  1. base = types[type].base. It includes types[type].pages pages (for a web app, screens).
//  2. pages = the pages picked (each counts 1; "home" is always picked) + extraPages.
//     extra pages = max(0, pages - types[type].pages), each costing types[type].extraPage.
//  3. features: each picked feature adds features[f].price, except where features[f].includedIn lists the type (then 0).
//     "multilingual" costs features.multilingual.price × (languages - 1), and nothing when languages is 1.
//     A feature that costs 0 (included, or multilingual with one language) gets no breakdown row.
//  4. store only: products tier adds products[tier].price.
//  5. content: copywriting = content.copywriting.perPage × pages; logo and photos add their price.
//  6. subtotal = 1 + 2 + 3 + 4 + 5. With timeline "rush", the whole subtotal × timeline.rush.factor.
//  7. shown as a range: low = round50(total × range.low), high = round50(total × range.high), where round50 rounds to
//     the nearest 50 (halves up). "total" is also kept, unrounded to the dollar (Math.round).
//  8. monthly care (optional) is separate: care[plan].monthly per month.
//  9. weeks: types[type].weeks [min, max], each + ceil(extra pages / 5) + floor(number of features that cost more than 0 / 3);
//     with "rush", each × timeline.rush.weeksFactor, rounded up; min is at least 1 and max at least min + 1.
// Every priced line is returned as a breakdown row { key, amount } so the page and the email can list them.

export const pricing = {
  currency: 'USD',
  version: 1,
  range: { low: 0.9, high: 1.15 },
  types: {
    landing: { base: 450, pages: 1, extraPage: 90, weeks: [1, 2] },
    portfolio: { base: 700, pages: 4, extraPage: 90, weeks: [2, 3] },
    business: { base: 900, pages: 5, extraPage: 90, weeks: [3, 5] },
    store: { base: 2200, pages: 5, extraPage: 90, weeks: [5, 8] },
    webapp: { base: 4500, pages: 5, extraPage: 250, weeks: [8, 14] },
  },
  // pages a visitor can tick (home is always included)
  pages: ['home', 'about', 'services', 'gallery', 'pricing', 'team', 'blog', 'faq', 'contact', 'testimonials', 'careers', 'locations'],
  maxExtraPages: 40,
  features: {
    booking: { price: 350 },
    payments: { price: 450, includedIn: ['store'] },
    cms: { price: 300, includedIn: ['store', 'webapp'] },
    multilingual: { price: 150 },
    accounts: { price: 600, includedIn: ['webapp'] },
    search: { price: 150 },
    newsletter: { price: 100 },
    livechat: { price: 120 },
    maps: { price: 60 },
    reviews: { price: 120 },
    seo: { price: 350 },
    analytics: { price: 180 },
  },
  maxLanguages: 5,
  products: {
    small: { price: 0 }, // up to 50 products
    medium: { price: 300 }, // 50 to 200
    large: { price: 800 }, // 200 to 1,000
    huge: { price: 1500 }, // more than 1,000
  },
  content: {
    copywriting: { perPage: 60 },
    logo: { price: 350 },
    photos: { price: 150 },
  },
  care: {
    none: { monthly: 0 },
    basic: { monthly: 49 },
    standard: { monthly: 99 },
    pro: { monthly: 199 },
  },
  timeline: {
    flexible: { factor: 1 },
    standard: { factor: 1 },
    rush: { factor: 1.25, weeksFactor: 0.75 },
  },
  // the choices that only change the look (no price), so the server can check them
  industries: ['restaurant', 'clinic', 'beauty', 'construction', 'consulting', 'retail', 'tourism', 'education', 'fitness', 'realestate', 'tech', 'other'],
  palettes: ['navy', 'forest', 'sunset', 'ocean', 'mono', 'blush', 'custom'],
  fonts: ['modern', 'elegant', 'friendly', 'bold'],
  layouts: ['clean', 'bold', 'classic'],
  modes: ['light', 'dark'],
};
