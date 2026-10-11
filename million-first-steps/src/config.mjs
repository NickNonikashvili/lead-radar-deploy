// ─────────────────────────────────────────────────────────────────────────────
//  Business settings — edit this file first. Everything here is used across the site.
// ─────────────────────────────────────────────────────────────────────────────
export default {
  brand: "Million First Steps",
  tagline: "Georgia Travel Experiences",

  // Full public URL once the site is live, without a trailing slash
  // (e.g. "https://millionfirststeps.ge"). Enables canonical links and sitemap.xml.
  siteUrl: "",

  // Contact details shown in the footer and on the contact page.
  // Leave a value empty ("") to hide it.
  email: "hello@millionfirststeps.ge", // TODO: replace with your real inbox
  phone: "", // e.g. "+995 555 12 34 56"
  whatsapp: "", // digits only, with country code, e.g. "995555123456"
  instagram: "", // e.g. "https://instagram.com/millionfirststeps"
  facebook: "",
  address: "Tbilisi, Georgia",

  // Legal entity shown in the footer, privacy policy and booking terms.
  // TODO: fill in once your company is registered (and your tourism-registry entry is done).
  legalName: "Million First Steps",
  registrationNumber: "",

  // Booking-request form. Paste the endpoint from a form service such as Formspree
  // (https://formspree.io) or Basin; requests are then emailed to you.
  // Left empty, the form opens the visitor's email app with everything pre-filled instead.
  formEndpoint: "",

  // Prices in the tour data are in EUR. These rates convert for the currency switcher
  // and are deliberately approximate — update them every few months.
  currencies: {
    EUR: { symbol: "€", rate: 1 },
    USD: { symbol: "$", rate: 1.16 },
    GEL: { symbol: "₾", rate: 3.15 },
  },

  // Price multiplier per person by party size (2 travellers sharing = 1.0).
  // Solo travellers pay for a whole car and room, larger parties share them.
  partyFactors: { 1: 1.65, 2: 1, 3: 0.93, 4: 0.87, 5: 0.84, 6: 0.82, 7: 0.8, 8: 0.79 },
};
