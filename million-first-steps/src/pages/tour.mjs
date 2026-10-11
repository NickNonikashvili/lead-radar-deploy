import { layout } from "../lib/layout.mjs";
import { isNight } from "../lib/scenes.mjs";
import { georgiaMap, routeFractions } from "../lib/map.mjs";
import { icon } from "../lib/icons.mjs";
import { join } from "../lib/html.mjs";
import { pageHero, price, tierPrices, tourCard } from "../lib/components.mjs";
import { TIERS, ALWAYS_INCLUDED, NOT_INCLUDED } from "../data/tiers.mjs";
import { TOURS } from "../data/tours.mjs";
import { PLACES } from "../data/places.mjs";
import config from "../config.mjs";

export default function tourPage(tour) {
  const root = "../";
  const others = TOURS.filter((t) => t.id !== tour.id)
    .sort((a, b) => b.styles.filter((s) => tour.styles.includes(s)).length - a.styles.filter((s) => tour.styles.includes(s)).length)
    .slice(0, 3);

  // Where along the route each day ends: walk the route forward, matching each day's stop.
  const frac = routeFractions(tour.route);
  let ptr = 0;
  const dayAt = tour.itinerary.map((d) => {
    const i = tour.route.indexOf(d.stop, ptr);
    if (i === -1) return frac[ptr];
    ptr = i;
    return frac[i];
  });

  const facts = `<ul class="tour-facts" data-reveal>
    <li>${icon("calendar")}<span><small>Duration</small>${tour.days} days · ${tour.days - 1} nights</span></li>
    <li>${icon("sun")}<span><small>Best season</small>${tour.season}</span></li>
    <li>${icon("mountains")}<span><small>Pace</small>${tour.level}</span></li>
    <li>${icon("coin")}<span><small>From, per person</small>${tierPrices(tour)}</span></li>
  </ul>`;

  const body = `
${pageHero({
  sceneName: tour.scene,
  photo: tour.photo,
  kicker: tour.kicker,
  title: tour.name,
  lead: tour.summary,
  root,
  crumbs: [{ href: "../tours.html", label: "Tours" }, { label: tour.name }],
  extra: facts,
})}

<section class="section highlights" aria-label="Highlights">
  <div class="container highlights__grid">
    <div>
      <p class="eyebrow">Highlights</p>
      <h2 class="h2" data-split>Why this<br><em>journey.</em></h2>
      <p class="highlights__regions">${icon("pin")} ${tour.regions.join(" · ")}</p>
    </div>
    <ol class="highlights__list">
      ${join(tour.highlights, (h, i) => `<li data-reveal><span class="highlights__n">${String(i + 1).padStart(2, "0")}</span><p>${h}</p></li>`)}
    </ol>
  </div>
</section>

<section class="section section--paper itinerary" aria-label="Day by day" data-itinerary>
  <div class="container">
    <header class="itinerary__head">
      <p class="eyebrow">Day by day</p>
      <h2 class="h2">The route</h2>
    </header>
    <div class="itinerary__grid">
      <div class="itinerary__map">
        <div class="itinerary__sticky" data-route-draw data-route-sync>
          ${georgiaMap({ route: tour.route, className: "gmap--tour", label: `Map of the ${tour.name} route` })}
          <p class="itinerary__now" aria-live="polite"><span data-now-day>Day 1</span> · <span data-now-place>${PLACES[tour.itinerary[0].stop].name}</span></p>
        </div>
      </div>
      <ol class="days">
        ${join(
          tour.itinerary,
          (d, i) => `<li class="day" data-stop="${d.stop}" data-day="${i + 1}" data-at="${dayAt[i].toFixed(4)}">
          <p class="day__n">Day ${i + 1}</p>
          <h3 class="day__title">${d.title}</h3>
          <p class="day__text">${d.text}</p>
          <p class="day__night">${icon("bed")} ${d.night}</p>
        </li>`
        )}
      </ol>
    </div>
  </div>
</section>

<section class="section tour-tiers" id="price" aria-label="Choose your comfort" data-calc data-prices='${JSON.stringify(tour.prices)}' data-tour="${tour.id}">
  <div class="container">
    <header class="section-head">
      <p class="eyebrow">Choose your comfort</p>
      <h2 class="h2" data-split>One route,<br><em>three ways to travel it.</em></h2>
    </header>
    <div class="tier-cards" role="radiogroup" aria-label="Travel style">
      ${join(
        TIERS,
        (t) => `<button type="button" class="tier-card tier-card--${t.id}" role="radio" aria-checked="${t.id === "explorer"}" data-set-tier="${t.id}" data-reveal>
        <span class="tier-card__top"><span class="tier-card__name">${t.name}</span><span class="tier-card__check">${icon("check")}</span></span>
        <span class="tier-card__price">from ${price(tour.prices[t.id])} <small>pp</small></span>
        <span class="tier-card__tag">${t.tagline}</span>
        <span class="tier-card__list">
          <span>${icon("car")}${t.vehicle.title}</span>
          <span>${icon("bed")}${t.stay.title}</span>
          <span>${icon("dining")}${t.dining.title}</span>
          <span>${icon("guide")}${t.guide.title}</span>
        </span>
        ${tour.tierNotes?.[t.id] ? `<span class="tier-card__note">${tour.tierNotes[t.id]}</span>` : ""}
      </button>`
      )}
    </div>

    <div class="calc" data-reveal>
      <div class="calc__inputs">
        <div class="calc__field">
          <span class="calc__label" id="party-label">Travellers</span>
          <div class="stepper" role="group" aria-labelledby="party-label">
            <button type="button" data-party="-1" aria-label="One fewer traveller">${icon("minus")}</button>
            <output data-party-out>2</output>
            <button type="button" data-party="1" aria-label="One more traveller">${icon("plus")}</button>
          </div>
        </div>
        <div class="calc__field">
          <span class="calc__label">Travel style</span>
          <p class="calc__tier" data-calc-tier>Explorer</p>
        </div>
      </div>
      <div class="calc__out">
        <p><span class="calc__label">Per person</span><strong data-calc-pp>${price(tour.prices.explorer)}</strong></p>
        <p><span class="calc__label">Estimated total</span><strong data-calc-total>${price(tour.prices.explorer * 2)}</strong></p>
      </div>
      <a class="btn btn--gold btn--lg calc__cta" href="../contact.html?tour=${tour.id}" data-calc-link><span class="btn__label">Request this journey</span><span class="btn__icon">${icon("arrow")}</span></a>
      <p class="calc__note">An estimate, not a quote — it depends on dates and availability. We'll send an exact price within a day, and you pay nothing until you're happy.</p>
    </div>

    <div class="incl" data-reveal>
      <div><h3 class="h4">${icon("check")} Included</h3><ul>${join(ALWAYS_INCLUDED, (x) => `<li>${x}</li>`)}<li>Everything listed for your chosen tier above</li></ul></div>
      <div><h3 class="h4">${icon("x")} Not included</h3><ul>${join(NOT_INCLUDED, (x) => `<li>${x}</li>`)}</ul></div>
    </div>
  </div>
</section>

<section class="section section--paper more-tours" aria-label="More journeys">
  <div class="container">
    <div class="featured__head"><h2 class="h3">You might also love</h2><a class="btn btn--line" href="../tours.html"><span class="btn__label">All journeys</span><span class="btn__icon">${icon("arrow")}</span></a></div>
    <div class="tour-grid tour-grid--3">${join(others, (t) => tourCard(t, root))}</div>
  </div>
</section>`;

  return layout({
    title: tour.name,
    description: `${tour.name}: a ${tour.days}-day private tour of Georgia. ${tour.summary.split(". ")[0]}.`,
    root,
    path: `tours/${tour.id}.html`,
    body,
    bodyClass: "page-tour",
    headerTheme: isNight(tour.scene) ? "cream" : "ink",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: tour.name,
      description: tour.summary,
      touristType: tour.styles,
      itinerary: {
        "@type": "ItemList",
        itemListElement: tour.itinerary.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: `Day ${i + 1}: ${d.title}` })),
      },
      offers: TIERS.map((t) => ({ "@type": "Offer", name: t.name, price: tour.prices[t.id], priceCurrency: "EUR" })),
      provider: { "@type": "TravelAgency", name: config.brand },
    },
  });
}
