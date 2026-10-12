import { layout } from "../lib/layout.mjs";
import { icon } from "../lib/icons.mjs";
import { join } from "../lib/html.mjs";
import { pageHero, sectionHead, tierSwitch, tourCard } from "../lib/components.mjs";
import { TIERS, ALWAYS_INCLUDED } from "../data/tiers.mjs";
import { TOURS, STYLES } from "../data/tours.mjs";

const ROWS = [
  ["car", "Vehicle", "vehicle"],
  ["bed", "Where you sleep", "stay"],
  ["dining", "How you eat", "dining"],
  ["guide", "Who travels with you", "guide"],
];

export default function toursPage() {
  const body = `
${pageHero({
  sceneName: "kazbegi",
  ka: "ტურები",
  kicker: "Private journeys",
  title: "Choose your<br><em>first step.</em>",
  lead: "Seven journeys through Georgia, each offered three ways — from family guesthouses to five-star design hotels. Every trip is private and can be tailored day by day.",
  crumbs: [{ label: "Tours" }],
})}

<section class="section tiers-compare" aria-label="Compare travel styles">
  <div class="container">
    ${sectionHead({ kicker: "Three ways to travel", title: "What changes<br><em>from tier to tier.</em>", lead: "The itinerary, the guide's passion and the views are identical. What you pay for is comfort: the car, the bed and the table." })}
    <div class="compare__switch">${tierSwitch()}</div>
    <div class="compare" data-reveal>
      <div class="compare__corner"><p>Same route.<br>Different comfort.</p></div>
      ${join(
        TIERS,
        (t, i) => `<div class="compare__head compare__head--${t.id}" style="--col:${i + 2}" data-col="${t.id}">
        <h3>${t.name}</h3><p>${t.tagline}</p>
      </div>`
      )}
      ${join(
        ROWS,
        ([ico, label, key], r) => `<div class="compare__label" style="--row:${r + 2}">${icon(ico)}<span>${label}</span></div>
        ${join(TIERS, (t, i) => `<div class="compare__cell" style="--col:${i + 2};--row:${r + 2}" data-col="${t.id}" data-label="${label}"><strong>${t[key].title}</strong><span>${t[key].text}</span></div>`)}`
      )}
      <div class="compare__label" style="--row:6">${icon("sun")}<span>Extras</span></div>
      ${join(TIERS, (t, i) => `<div class="compare__cell compare__cell--extras" style="--col:${i + 2};--row:6" data-col="${t.id}" data-label="Extras"><ul>${join(t.extras, (e) => `<li>${e}</li>`)}</ul></div>`)}
    </div>
    <div class="included" data-reveal>
      <h3 class="h4">${icon("check")} Always included, whichever tier you choose</h3>
      <ul>${join(ALWAYS_INCLUDED, (x) => `<li>${x}</li>`)}</ul>
    </div>
  </div>
</section>

<section class="section section--paper tours-list" aria-label="All tours">
  <div class="container">
    <div class="tours-list__bar">
      <div>
        <p class="eyebrow">All journeys</p>
        <h2 class="h2">Pick a story to walk through.</h2>
      </div>
      <div class="tours-list__controls">
        <p class="tours-list__label">Show prices for</p>
        ${tierSwitch()}
      </div>
    </div>
    <div class="chips" role="group" aria-label="Filter by interest" data-filter>
      <button type="button" class="chip is-active" data-filter-value="all" aria-pressed="true">All journeys</button>
      ${join(Object.entries(STYLES), ([k, v]) => `<button type="button" class="chip" data-filter-value="${k}" aria-pressed="false">${v}</button>`)}
    </div>
    <div class="tour-grid" data-filter-grid>${join(TOURS, (t) => tourCard(t))}</div>
    <p class="fineprint">Prices are per person, from, based on two travellers sharing, in euros. Larger parties pay less per person; solo travellers pay more. Use the calculator on each tour page for an estimate, and we'll confirm an exact quote for your dates.</p>
  </div>
</section>

<section class="section custom-trip" aria-label="Tailor-made">
  <div class="container custom-trip__inner" data-reveal>
    <span class="custom-trip__icon">${icon("compass")}</span>
    <div>
      <h2 class="h3">Don't see your journey?</h2>
      <p>Honeymoon in the vineyards, a family trip with grandparents, a photography week in Tusheti, a ski week in Gudauri — tell us and we'll draw the route.</p>
    </div>
    <a class="btn btn--gold" href="contact.html"><span class="btn__label">Design my own trip</span><span class="btn__icon">${icon("arrow")}</span></a>
  </div>
</section>`;

  return layout({
    title: "Tours of Georgia",
    description: "Private tours of Georgia in three comfort levels: Wanderer, Explorer and Golden Fleece. Wine, mountains, history and the Black Sea coast.",
    path: "tours.html",
    body,
    bodyClass: "page-tours",
    headerTheme: "ink",
  });
}
