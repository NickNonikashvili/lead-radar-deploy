import { layout } from "../lib/layout.mjs";
import { icon } from "../lib/icons.mjs";
import { esc, join } from "../lib/html.mjs";
import { CREDITS } from "../lib/components.mjs";
import { PHOTOS } from "../data/photos.mjs";
import config from "../config.mjs";

const simpleHero = (title, kicker) => `<section class="legal-hero"><div class="container"><p class="eyebrow">${kicker}</p><h1 class="h1">${title}</h1></div></section>`;
const updated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function creditsPage() {
  const photos = Object.entries(CREDITS);
  const body = `${simpleHero("Credits & licences", "Made with care")}
<section class="section legal">
  <div class="container prose">
    <p class="lead">Everything on this website is either original work made for ${config.brand} or used under a licence that allows it. Here is the full list.</p>

    <h2>Illustrations, logo and maps</h2>
    <p>All landscape illustrations, icons and the footprint logo were created specifically for this website and belong to ${esc(config.legalName)}. The maps are drawn from <a href="https://www.naturalearthdata.com/">Natural Earth</a> data, which is in the public domain. Georgia is shown within its internationally recognised borders.</p>

    <h2>Photographs</h2>
    ${
      photos.length
        ? `<ul class="credit-list">${join(
            photos,
            ([slot, c]) => `<li><strong>${esc(PHOTOS[slot]?.alt || slot)}</strong> — ${c.title ? `“${esc(c.title)}” ` : ""}by ${c.authorUrl ? `<a href="${esc(c.authorUrl)}">${esc(c.author)}</a>` : esc(c.author)}${
              c.source ? `, <a href="${esc(c.source)}">source</a>` : ""
            }, ${c.licenseUrl ? `<a href="${esc(c.licenseUrl)}">${esc(c.license)}</a>` : esc(c.license)}${c.changes ? `. ${esc(c.changes)}` : ""}.</li>`
          )}</ul>`
        : `<p>This version of the site uses no third-party photographs.</p>`
    }

    <h2>Typefaces</h2>
    <p>Cinzel, Cormorant Garamond, Manrope and Noto Serif Georgian are used under the <a href="https://openfontlicense.org/">SIL Open Font License 1.1</a>. They are served from this website, not from Google, so no visitor data is sent to a font provider.</p>

    <h2>Software</h2>
    <ul>
      <li><a href="https://gsap.com/">GSAP</a> with ScrollTrigger and SplitText — used under the GSAP Standard “No Charge” License.</li>
      <li><a href="https://lenis.darkroom.engineering/">Lenis</a> smooth scrolling — MIT License.</li>
    </ul>

    <h2>Text</h2>
    <p>All text was written for this site. Historical facts come from established public sources; see our history page for notes.</p>
  </div>
</section>`;
  return layout({ title: "Credits & licences", description: "Image, typeface, map and software credits for the Million First Steps website.", path: "credits.html", body, bodyClass: "page-legal", cta: false });
}

export function privacyPage() {
  const body = `${simpleHero("Privacy policy", "Your data")}
<section class="section legal">
  <div class="container prose">
    <p class="meta">Last updated ${updated}</p>
    <p class="lead">Short version: this website doesn't track you. We only receive the details you choose to send us, and we use them only to plan your trip.</p>

    <h2>Who we are</h2>
    <p>${esc(config.legalName)}${config.registrationNumber ? ` (registration no. ${esc(config.registrationNumber)})` : ""}, ${esc(config.address)} — “we”, “us”. Contact: ${config.email ? `<a href="mailto:${config.email}">${config.email}</a>` : "see our contact page"}.</p>

    <h2>What this website collects</h2>
    <ul>
      <li><strong>No cookies, no analytics, no advertising trackers.</strong> We don't use Google Analytics, Facebook pixels or similar tools.</li>
      <li><strong>Fonts and scripts are hosted on this website.</strong> Your browser does not contact Google Fonts or any other third-party content service when you visit.</li>
      <li><strong>Your preferences stay on your device.</strong> If you choose a currency or travel style, your browser remembers it in local storage. It never leaves your device and you can clear it at any time.</li>
      <li><strong>Our web host</strong> may keep standard server logs (such as IP address and pages requested) for security and to keep the site running.</li>
    </ul>

    <h2>When you send us a request</h2>
    <p>If you use our form or write to us, we receive what you give us: typically your name, email address, phone number, country, travel dates, party size and any notes (such as dietary or mobility needs). ${
      config.formEndpoint
        ? "Form submissions are delivered to us through a form-processing service acting on our behalf."
        : "The form opens your own email program, so your request is sent by you, from your email account, directly to us."
    }</p>
    <p>We use these details only to reply to you, to plan and operate your journey, and — once you book — to meet our legal and accounting obligations. To run your trip we share only what's needed with the hotels, drivers and guides who host you. We never sell your data or use it for advertising.</p>

    <h2>How long we keep it</h2>
    <p>Requests that don't lead to a booking are deleted within 24 months. Booking records are kept for as long as tax and accounting law requires.</p>

    <h2>Your rights</h2>
    <p>You can ask to see, correct or delete your data, or object to how we use it, by emailing us. If you are in Georgia, the Law of Georgia on Personal Data Protection applies; if you are in the EU/EEA or UK, you also have rights under the GDPR, including the right to complain to your local data protection authority.</p>
  </div>
</section>`;
  return layout({ title: "Privacy policy", description: "How Million First Steps handles your personal data. No cookies, no tracking.", path: "privacy.html", body, bodyClass: "page-legal", cta: false });
}

export function termsPage() {
  const body = `${simpleHero("Booking terms", "The small print, in plain words")}
<section class="section legal">
  <div class="container prose">
    <p class="meta">Last updated ${updated}</p>
    <div class="callout">${icon("alert")}<p>These terms are being finalised before we accept our first bookings. Until then, the written quote we send you sets out the conditions for your trip — nothing is binding until you have read it and confirmed.</p></div>

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
    <p>If something isn't right during your trip, tell your guide or call us straight away so we can fix it while you're here. After your trip, write to us${config.email ? ` at <a href="mailto:${config.email}">${config.email}</a>` : ""}.</p>

    <h2>7. Law</h2>
    <p>These terms are governed by the laws of Georgia. This does not remove any rights you may have under the consumer laws of your own country.</p>
  </div>
</section>`;
  return layout({ title: "Booking terms", description: "Booking terms for Million First Steps journeys.", path: "terms.html", body, bodyClass: "page-legal", cta: false });
}

export function notFoundPage() {
  const body = `<section class="notfound">
  <div class="container notfound__inner">
    <p class="notfound__num">404</p>
    <h1 class="h2">These footprints lead nowhere.</h1>
    <p class="lead">The page you were looking for has wandered off into the mountains. Let's get you back on the trail.</p>
    <div class="notfound__actions">
      <a class="btn btn--gold" href="index.html"><span class="btn__label">Back to the start</span><span class="btn__icon">${icon("arrow")}</span></a>
      <a class="btn btn--ghost" href="tours.html"><span class="btn__label">Browse journeys</span></a>
    </div>
  </div>
</section>`;
  return layout({ title: "Page not found", description: "Page not found.", path: "404.html", body, bodyClass: "page-404", headerTheme: "cream", root: "/", cta: false });
}
