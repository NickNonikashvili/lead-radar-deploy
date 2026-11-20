import { layout } from "../lib/layout.mjs";
import { esc, join, ARROW } from "../lib/site.mjs";
import config from "../config.mjs";
import CREDITS from "../data/photo-credits.json" with { type: "json" };

const updated = config.legalUpdated;
const hero = (title, kicker, lede = "") =>
  `<section class="pg-hero lg-hero" aria-labelledby="pg-h"><div class="wrap pg-hero-in"><p class="eyebrow">${kicker}</p><h1 id="pg-h">${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</div></section>`;
const page = (inner) => `<main id="main">${inner}</main>`;
const mail = config.email ? `<a href="mailto:${config.email}">${config.email}</a>` : "see our contact page";

// Photos that came with the design from Pexels (free licence, credit not required).
const PEXELS = ["Poti", "Zugdidi", "Gori", "Bakhmaro", "Rustavi", "Ozurgeti", "Ambrolauri", "Tskaltubo"];

export function creditsPage() {
  const ours = Object.values(CREDITS);
  const main = page(`${hero("Credits &amp; licences", "Made with care")}
<section class="wrap pg-sec lg-prose">
  <p class="lede">Everything on this website is either original work made for ${esc(config.brand)} or used under a licence that allows it.</p>
  <h2>Photographs</h2>
  <ul class="lg-credits">${join(
    ours,
    (c) => `<li><b>“${esc(c.title)}”</b> by ${esc(c.author)}, <a href="${esc(c.source)}">Wikimedia Commons</a>, <a href="${esc(c.licenseUrl)}">${esc(c.license)}</a>${c.changes ? `. ${esc(c.changes)}` : ""}.</li>`
  )}<li>Photos of ${PEXELS.join(", ")} from <a href="https://www.pexels.com/">Pexels</a>, used under the Pexels licence.</li></ul>
  <h2>Illustrations, logo and maps</h2>
  <p>The illustrations, icons and the footprint logo were made for this website. Maps are drawn from <a href="https://www.naturalearthdata.com/">Natural Earth</a> data, which is in the public domain. Georgia is shown within its internationally recognised borders.</p>
  <h2>Typefaces</h2>
  <p>Fraunces, Manrope, Cinzel and Noto Serif Georgian are used under the <a href="https://openfontlicense.org/">SIL Open Font License 1.1</a>. They are served from this website, not from Google, so no visitor data is sent to a font provider.</p>
  <h2>Text</h2>
  <p>All text was written for this site. Historical facts come from established public sources.</p>
</section>`);
  return layout({ page: "credits.html", title: "Credits & licences", description: "Photo, typeface and map credits for the Million First Steps website.", main });
}

export function privacyPage() {
  const main = page(`${hero("Privacy policy", "Your data", "Short version: this website doesn’t track you. We only receive the details you choose to send us, and we use them only to plan your trip.")}
<section class="wrap pg-sec lg-prose">
  <p class="lg-meta">Last updated ${updated}</p>
  <h2>Who we are</h2>
  <p>${esc(config.legalName)}${config.registrationNumber ? ` (identification code ${esc(config.registrationNumber)})` : ""}, ${esc(config.address)} — “we”, “us”. Contact: ${mail}.</p>
  <h2>What this website collects</h2>
  <ul>
    <li><b>No cookies for visitors and no advertising trackers.</b> We don’t use Google Analytics, Facebook pixels or similar tools.</li>
    <li><b>Anonymous visit counts.</b> Our own server counts page views — which page, the website you came from, your language and the kind of device — without cookies and without storing your IP address. If your browser sends a “Do Not Track” or “Global Privacy Control” signal, you aren’t counted.</li>
    <li><b>Fonts and scripts are hosted on this website.</b> Your browser does not contact Google Fonts, map services or any other third party when you visit. The “Open in Google Maps” link only takes you to Google if you click it.</li>
    <li><b>Your preferences stay on your device.</b> Your language, your travel style and whether you closed a notice are remembered in your browser’s local storage. They never leave your device and you can clear them at any time.</li>
    <li><b>Our web host</b> keeps standard server logs (such as IP address and pages requested) for security and to keep the site running.</li>
  </ul>
  <h2>When you send us a request</h2>
  <p>If you use one of our forms or write to us, we receive what you give us: typically your name, email address, phone number, travel dates, party size, the places you’d like to see and any notes (such as dietary or mobility needs). Forms are sent to our inbox by our website host’s mail server; if that isn’t available, the form opens your own email program instead.</p>
  <p>Each request is emailed to us and kept in our booking system on our web host’s servers, which only our team can sign in to.</p>
  <p>We use these details only to reply to you, to plan and operate your journey, and — once you book — to meet our legal and accounting obligations. To run your trip we share only what’s needed with the hotels, drivers and guides who host you. We never sell your data or use it for advertising.</p>
  <h2>How long we keep it</h2>
  <p>Requests that don’t lead to a booking are deleted within 24 months. Booking records are kept for as long as tax and accounting law requires.</p>
  <h2>Your rights</h2>
  <p>You can ask to see, correct or delete your data, or object to how we use it, by emailing us. If you are in Georgia, the Law of Georgia on Personal Data Protection applies; if you are in the EU/EEA or UK, you also have rights under the GDPR, including the right to complain to your local data protection authority.</p>
</section>`);
  return layout({ page: "privacy.html", title: "Privacy policy", description: "How Million First Steps handles your personal data. No cookies, no tracking.", main });
}

export function cookiesPage() {
  const main = page(`${hero("Cookies", "Your data", "This website doesn’t use cookies for visitors.")}
<section class="wrap pg-sec lg-prose">
  <p class="lg-meta">Last updated ${updated}</p>
  <h2>No cookies, no banner</h2>
  <p>We don’t set cookies for visitors and we don’t load anyone else’s analytics, advertising or social media trackers — which is also why you didn’t see a cookie banner.</p>
  <p>The only cookies on this site are a few for our own team on the staff area (to sign in and remember their language); visitors never get them.</p>
  <h2>What your browser remembers</h2>
  <p>To save you choosing again on every page, your browser keeps a few small settings in its local storage: the language you picked, the travel style you last looked at and whether you closed a notice. While you browse, it also keeps a copy of our current prices and contact details so that pages show them straight away. They stay on your device, are never sent to us, and you can clear them in your browser’s settings at any time.</p>
  <h2>Links to other websites</h2>
  <p>Links to Google Maps, WhatsApp, Telegram or social networks take you to those services, which have their own cookie and privacy policies.</p>
  <p>Questions? Write to us at ${mail}. More in our <a href="privacy.html">privacy policy</a>.</p>
</section>`);
  return layout({ page: "cookies.html", title: "Cookies", description: "This website doesn’t use cookies or trackers.", main });
}

export function termsPage() {
  const main = page(`${hero("Booking terms", "The small print, in plain words")}
<section class="wrap pg-sec lg-prose">
  <p class="lg-meta">Last updated ${updated}</p>
  <p class="lg-note">These terms are being finalised before we accept our first bookings. Until then, the written quote we send you sets out the conditions for your trip — nothing is binding until you have read it and confirmed.</p>
  <h2>1. Quotes and prices</h2>
  <p>Prices on this website are “from” prices per person, based on two travellers sharing, and are for guidance. Your exact price depends on dates, party size and availability, and is confirmed in writing in your personal quote.</p>
  <h2>2. Confirming your journey</h2>
  <p>Your journey is confirmed when you accept your quote and we receive the deposit stated in it. The balance is due by the date in your quote, usually a few weeks before arrival.</p>
  <h2>3. Changes and cancellations</h2>
  <p>Want to change something? Tell us as early as possible and we'll do our best — some changes may affect the price. If you need to cancel, the charges depend on how close to departure you cancel and on what we have already paid to hotels and partners; the exact scale is set out in your quote.</p>
  <p>If we ever have to change a significant part of your trip, we'll offer an equivalent alternative or a refund for the affected part.</p>
  <h2>4. Travel insurance</h2>
  <p>Comprehensive travel insurance, including medical cover and cancellation, is required for every traveller.</p>
  <h2>5. Health, safety and mountains</h2>
  <p>Some journeys include mountain roads and hikes at altitude. Please tell us about any health or mobility needs so we can plan safely. Your guide may adapt a route for weather or safety — their decision is final.</p>
  <h2>6. Complaints</h2>
  <p>If something isn't right during your trip, tell your guide or call us straight away so we can fix it while you're here. After your trip, write to us${config.email ? ` at ${mail}` : ""}.</p>
  <h2>7. Law</h2>
  <p>These terms are governed by the laws of Georgia. This does not remove any rights you may have under the consumer laws of your own country.</p>
</section>`);
  return layout({ page: "terms.html", title: "Booking terms", description: "Booking terms for Million First Steps journeys.", main });
}

export function notFoundPage() {
  const main = page(`<section class="pg-hero lg-hero nf" aria-labelledby="pg-h"><div class="wrap pg-hero-in"><p class="eyebrow">404</p><h1 id="pg-h">These footprints lead nowhere.</h1><p class="lede">The page you were looking for has wandered off into the mountains. Let's get you back on the trail.</p><div class="pg-acts"><a class="btn-sun" href="/index.html">Back to the start ${ARROW}</a><a class="btn-out" href="/tours.html">Browse tours</a></div></div></section>`);
  // Served at any address, so the layout makes its links absolute from the site root.
  return layout({ page: "404.html", title: "Page not found", description: "Page not found.", main, noindex: true });
}
