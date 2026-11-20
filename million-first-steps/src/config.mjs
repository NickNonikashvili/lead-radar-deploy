// ─────────────────────────────────────────────────────────────────────────────
//  Business settings — edit this file first. Everything here is used across the site.
//  After editing, run `npm run build` and upload the new dist/ folder.
// ─────────────────────────────────────────────────────────────────────────────
export default {
  brand: "Million First Steps",
  tagline: "Georgia Travel Experiences",

  // Full public URL once the site is live, without a trailing slash
  // (e.g. "https://millionfirststeps.ge"). Enables canonical links, hreflang and sitemap.xml.
  siteUrl: "",

  // Contact details. Leave a value empty ("") to hide it everywhere on the site.
  // Email and phone are only revealed on click, so simple scrapers can't harvest them.
  email: "hello@millionfirststeps.ge", // TODO: replace with your real inbox
  phone: "", // e.g. "+995 555 12 34 56"
  whatsapp: "", // number with country code, e.g. "995555123456"
  telegram: "", // username, e.g. "millionfirststeps"
  signal: "", // a signal.me link
  instagram: "", // e.g. "https://instagram.com/millionfirststeps"
  facebook: "",
  address: "Tbilisi, Georgia",
  officeHours: "Mon–Fri, 10:00–19:00 Tbilisi time (GMT+4)",

  // Legal entity shown in the footer, About page, privacy policy and booking terms.
  // TODO: fill in once the company is registered.
  legalName: "Million First Steps",
  registrationNumber: "",

  // Date shown as "Last updated" on the legal pages. Change it when you edit them.
  legalUpdated: "20 November 2026",

  // Where the website's forms are emailed. Empty = the email address above.
  // Forms are sent by send.php on Hostinger (or any PHP host). Where PHP isn't available
  // (e.g. a preview), the form opens the visitor's email app instead.
  formTo: "",

  // Tour prices are per person in EUR for two travellers sharing. This multiplier adjusts them by
  // party size on each tour page (solo travellers pay for a whole car and room, larger groups share).
  partyFactors: { 1: 1.65, 2: 1, 3: 0.93, 4: 0.87, 5: 0.84, 6: 0.82, 7: 0.8, 8: 0.79 },
};
