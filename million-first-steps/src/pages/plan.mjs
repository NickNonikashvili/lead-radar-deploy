import { layout } from "../lib/layout.mjs";
import { icon } from "../lib/icons.mjs";
import { join } from "../lib/html.mjs";
import { pageHero, sectionHead } from "../lib/components.mjs";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// 0 closed / not advised · 1 possible · 2 good · 3 best
const SEASONS = [
  ["Tbilisi", [1, 1, 2, 3, 3, 2, 2, 2, 3, 3, 2, 2], "Hot in July–August; lovely in spring and autumn."],
  ["Kakheti & wine", [1, 1, 2, 2, 3, 3, 2, 2, 3, 3, 2, 1], "Harvest (rtveli) in September–October."],
  ["Kazbegi", [1, 1, 1, 1, 2, 3, 3, 3, 3, 2, 1, 1], "Winter is beautiful, but the pass can close in storms."],
  ["Svaneti", [2, 2, 2, 1, 1, 2, 3, 3, 3, 2, 1, 2], "Summer hiking; ski season at Hatsvali and Tetnuldi."],
  ["Tusheti", [0, 0, 0, 0, 0, 2, 3, 3, 3, 1, 0, 0], "The only road opens roughly mid-June to early October."],
  ["Vardzia & the south", [1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 1, 1], "Warm days, cold nights in the highlands."],
  ["Imereti & Colchis", [1, 1, 2, 2, 3, 3, 2, 2, 3, 3, 2, 1], "Lush and green; humid in midsummer."],
  ["Black Sea coast", [1, 1, 1, 1, 2, 3, 3, 3, 3, 2, 1, 1], "Swimming from June to September."],
];

const ESSENTIALS = [
  ["passport", "Visas", "Citizens of around 95 countries — including the EU, UK, USA, Canada and Australia — can visit visa-free, most for up to a year. Others can apply online through Georgia's official e-visa portal. Always check the Ministry of Foreign Affairs website before you travel."],
  ["coin", "Money", "The currency is the Georgian lari (GEL, ₾). Cards work almost everywhere in cities; carry some cash for villages, markets and the mountains. ATMs are easy to find."],
  ["lang", "Language", "Georgian, with its own alphabet. Many older people speak Russian and more and more young people speak English. Gamarjoba = hello, madloba = thank you, gaumarjos = cheers!"],
  ["clock", "Time", "Georgia Standard Time, GMT+4 all year round — no daylight saving."],
  ["plug", "Power", "220 V, 50 Hz, with European two-pin plugs (types C and F)."],
  ["plane", "Getting here", "International airports at Tbilisi (TBS), Kutaisi (KUT) and Batumi (BUS). We meet every guest at arrivals."],
  ["shield", "Safety & insurance", "Georgia is widely regarded as a safe, welcoming country. Mountain weather changes fast and roads wind — which is why we drive. Travel insurance is required on all our journeys."],
  ["alert", "Emergencies", "Dial 112 for police, ambulance or fire. Our team is reachable 24/7 throughout your trip."],
];

const ETIQUETTE = [
  ["Churches", "Cover shoulders and knees; women usually cover their hair. Scarves and wraps are often available at the door."],
  ["The supra", "Wait for the tamada's toast before you drink wine. Never toast with beer — that is traditionally reserved for enemies."],
  ["Khinkali", "Eat with your hands: hold the knot, bite, sip the broth, then eat the rest. Leave the knot on your plate — it's how people count."],
  ["Tipping", "Many restaurants add a 10% service charge; check the bill. Otherwise, rounding up is appreciated, never expected."],
];

const FAQ = [
  ["How do I book?", "Send us a request through the contact page — dates, travellers and the journey you like. We reply personally within a day with a tailored plan and an exact quote. Once you're happy, a deposit confirms the trip. You'll find the details in our booking terms."],
  ["Can I change the itinerary?", "Yes. Every journey is private, so we can add a day in the mountains, swap a museum for a winery or combine two tours. The published itineraries are starting points."],
  ["What's the difference between the tiers?", "The route and experiences are the same. Wanderer uses guesthouses and simpler cars, Explorer boutique hotels and a separate guide and driver, Golden Fleece the best hotels, all meals and a senior expert guide. See the comparison on the Tours page."],
  ["Do you cater for vegetarians and allergies?", "Easily. Georgian cooking is full of vegetarian and vegan dishes — lobio beans, walnut pkhali, aubergine rolls — partly thanks to the Orthodox fasting tradition. Tell us about allergies when you book."],
  ["How far ahead should I book?", "Two to four months ahead for summer and the September–October harvest; a few weeks is often enough at other times. Tusheti and the best Golden Fleece hotels fill up first."],
  ["Is Georgia suitable for children and older travellers?", "Very. Georgians adore children, and every itinerary can slow down. Tell us who's coming and we'll pace the days accordingly."],
];

export default function planPage() {
  const body = `
${pageHero({
  sceneName: "adjara",
  ka: "დაგეგმე",
  kicker: "Plan your trip",
  title: "Everything to know<br><em>before you go.</em>",
  lead: "Visas, money, seasons, manners at the table — the practical side of a trip to Georgia, from people who live here.",
  crumbs: [{ label: "Plan your trip" }],
})}

<section class="section essentials" aria-label="Essentials">
  <div class="container">
    ${sectionHead({ kicker: "Essentials", title: "The short<br><em>version.</em>" })}
    <div class="essentials__grid">
      ${join(ESSENTIALS, ([ico, t, d], i) => `<article class="essential" data-reveal style="--d:${(i % 4) * 0.06}s"><span class="essential__icon">${icon(ico)}</span><h3>${t}</h3><p>${d}</p></article>`)}
    </div>
  </div>
</section>

<section class="section section--paper seasons" aria-label="When to go">
  <div class="container">
    ${sectionHead({ kicker: "When to go", title: "There's no bad month —<br><em>only different Georgias.</em>", lead: "Spring is green and full of flowers, summer opens the high mountains, autumn brings the harvest, and winter means skiing and quiet, snowy monasteries." })}
    <div class="season-chart" data-reveal role="table" aria-label="Best months to visit each region">
      <div class="season-chart__row season-chart__row--head" role="row">
        <span role="columnheader" class="season-chart__region">Region</span>
        ${join(MONTHS, (m, i) => `<span role="columnheader" title="${MONTH_NAMES[i]}"><abbr title="${MONTH_NAMES[i]}">${m}</abbr></span>`)}
      </div>
      ${join(
        SEASONS,
        ([name, vals, note]) => `<div class="season-chart__row" role="row">
        <span class="season-chart__region" role="rowheader">${name}<small>${note}</small></span>
        ${join(vals, (v, i) => `<span role="cell" class="sc sc--${v}" style="--m:${i}" aria-label="${MONTH_NAMES[i]}: ${["not possible", "possible", "good", "best"][v]}"></span>`)}
      </div>`
      )}
      <p class="season-chart__legend"><span class="sc sc--3"></span> Best <span class="sc sc--2"></span> Good <span class="sc sc--1"></span> Possible <span class="sc sc--0"></span> Closed</p>
    </div>
  </div>
</section>

<section class="section etiquette" aria-label="Etiquette">
  <div class="container etiquette__grid">
    <div>
      <p class="eyebrow">Good manners</p>
      <h2 class="h2" data-split>How to be<br><em>a perfect guest.</em></h2>
      <p class="lead" data-reveal>Georgians forgive almost anything from a guest. But these will win you friends.</p>
    </div>
    <dl class="etiquette__list">
      ${join(ETIQUETTE, ([t, d]) => `<div data-reveal><dt>${t}</dt><dd>${d}</dd></div>`)}
    </dl>
  </div>
</section>

<section class="section section--dark faq" aria-label="Questions">
  <div class="container faq__grid">
    <div>
      <p class="eyebrow">Questions</p>
      <h2 class="h2" data-split>Asked by almost<br><em>everyone.</em></h2>
      <a class="link-arrow" href="contact.html">Ask us anything else ${icon("arrow")}</a>
    </div>
    <div class="faq__list">
      ${join(FAQ, ([q, a]) => `<details class="faq__item" data-reveal><summary>${q}<span class="faq__icon">${icon("plus")}</span></summary><p>${a}</p></details>`)}
    </div>
  </div>
</section>`;

  return layout({
    title: "Plan your trip to Georgia",
    description: "Practical advice for visiting Georgia: visas, money, language, the best time to visit each region, etiquette and frequently asked questions.",
    path: "plan.html",
    body,
    bodyClass: "page-plan",
    headerTheme: "ink",
  });
}
