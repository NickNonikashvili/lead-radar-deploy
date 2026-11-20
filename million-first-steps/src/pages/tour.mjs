// Tour pages. The design has no tour page yet, so this one is built from its parts:
// the page hero, section heads, tinted bands, tour cards and the closing call to action.
import { layout } from "../lib/layout.mjs";
import { esc, join, tierPrices, ARROW } from "../lib/site.mjs";
import { icon } from "../lib/icons.mjs";
import { georgiaMap } from "../lib/map.mjs";
import { TIERS, ALWAYS_INCLUDED, NOT_INCLUDED } from "../data/tiers.mjs";
import { TOURS, STYLES } from "../data/tours.mjs";
import { PLACES } from "../data/places.mjs";
import { CARDS } from "../data/tour-cards.mjs";
import config from "../config.mjs";

const eur = (n) => `€${Math.round(n).toLocaleString("en-US")}`;
const season = (s) => s.replace(/\s*\(.*\)$/, "");

export function tourCards(list) {
  return `<ul class="tc-grid tc-grid--more">${join(list, (t) => {
    const c = CARDS[t.id];
    return `<li><article class="tc"><div class="tc-ph"><img src="${c.img}" alt="${esc(c.alt)}" loading="lazy"><span class="tc-days">${t.days} days</span></div><div class="tc-body"><div class="tc-tags">${join(t.styles, (s) => `<span${s === "wine" ? ' class="w"' : ""}>${esc(STYLES[s])}</span>`)}</div><h3><a href="tours/${t.id}.html">${esc(t.name)}</a></h3><p class="tc-route">${c.stops.map(esc).join(" · ")}</p><div class="tc-foot"><span class="tc-price"><span>From</span> ${tierPrices(t.prices)}<small>per person, private tour</small></span><span class="tc-go" aria-hidden="true">View tour ${ARROW}</span></div></div></article></li>`;
  })}</ul>`;
}

export default function tourPage(tour) {
  const c = CARDS[tour.id];
  const others = TOURS.filter((t) => t.id !== tour.id)
    .sort((a, b) => b.styles.filter((s) => tour.styles.includes(s)).length - a.styles.filter((s) => tour.styles.includes(s)).length)
    .slice(0, 3);
  const ask = `contact.html?topic=custom&tour=${encodeURIComponent(tour.name)}#cf-h`;

  const main = `<main id="main" class="tour-pg">
<section class="tr-hero" aria-labelledby="pg-h">
  <div class="tr-hero-ph"><img src="${c.img}" alt="${esc(c.alt)}"></div>
  <div class="wrap tr-hero-in">
    <nav class="tr-crumbs" aria-label="Breadcrumb"><a href="tours.html">Tours</a><span aria-hidden="true">/</span><span>${esc(tour.name)}</span></nav>
    <p class="eyebrow">${esc(tour.kicker)}</p>
    <h1 id="pg-h">${esc(tour.name)}</h1>
    <p class="lede">${esc(tour.summary)}</p>
    <ul class="tr-facts">
      <li>${icon("calendar")}<span><small>Duration</small><b>${tour.days} days · ${tour.days - 1} nights</b></span></li>
      <li>${icon("sun")}<span><small>Best season</small><b>${esc(season(tour.season))}</b></span></li>
      <li>${icon("mountains")}<span><small>Pace</small><b>${esc(tour.level)}</b></span></li>
      <li>${icon("coin")}<span><small>From, per person</small><b>${tierPrices(tour.prices)}</b></span></li>
    </ul>
    <div class="pg-acts"><a class="btn-sun" href="#price">See prices</a><a class="btn-out" href="${ask}">Plan this trip</a></div>
  </div>
</section>

<section class="wrap pg-sec tr-high" aria-labelledby="hi-h">
  <div class="pg-head"><p class="eyebrow">Highlights</p><h2 id="hi-h" class="h2">Why this journey</h2><p class="tr-regions">${icon("pin")} ${tour.regions.map(esc).join(" · ")}</p></div>
  <ol class="tr-hi">${join(tour.highlights, (h, i) => `<li><span aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><p>${esc(h)}</p></li>`)}</ol>
</section>

<section class="pg-sec tint tr-days" aria-labelledby="days-h">
  <div class="wrap">
    <div class="pg-head"><p class="eyebrow">Day by day</p><h2 id="days-h" class="h2">The route</h2></div>
    <div class="tr-days-grid">
      <div class="tr-map"><div class="tr-map-in">${georgiaMap({ route: tour.route, className: "gmap--tour", label: `Map of the ${tour.name} route` })}</div></div>
      <ol class="tr-dlist">${join(
        tour.itinerary,
        (d, i) => `<li class="tr-day" data-stop="${d.stop}"><p class="tr-dn">Day ${i + 1}<span aria-hidden="true"> · </span><span class="tr-dp">${esc(PLACES[d.stop]?.name || "")}</span></p><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p><p class="tr-night">${icon("bed")} ${esc(d.night)}</p></li>`
      )}</ol>
    </div>
  </div>
</section>

<section class="wrap pg-sec tr-price" id="price" aria-labelledby="price-h" data-calc data-prices='${JSON.stringify(tour.prices)}' data-factors='${JSON.stringify(config.partyFactors)}'>
  <div class="pg-head"><p class="eyebrow">Choose your comfort</p><h2 id="price-h" class="h2">One route, three ways to travel it</h2></div>
  <div class="tr-tiers" role="radiogroup" aria-label="Travel style">${join(
    TIERS,
    (t) => `<button type="button" class="tr-tier tr-tier--${t.id}" role="radio" aria-checked="${t.id === "explorer"}" data-set-tier="${t.id}">
      <span class="tr-tier-top"><b>${esc(t.name)}</b><span class="tr-check" aria-hidden="true">${icon("check")}</span></span>
      <span class="tr-tier-price"><small>From</small> ${eur(tour.prices[t.id])} <small>per person</small></span>
      <span class="tr-tier-tag">${esc(t.tagline)}</span>
      <span class="tr-tier-list"><span>${icon("car")}${esc(t.vehicle.title)}</span><span>${icon("bed")}${esc(t.stay.title)}</span><span>${icon("dining")}${esc(t.dining.title)}</span><span>${icon("guide")}${esc(t.guide.title)}</span></span>
      ${tour.tierNotes?.[t.id] ? `<span class="tr-tier-note">${esc(tour.tierNotes[t.id])}</span>` : ""}
    </button>`
  )}</div>
  <div class="tr-calc">
    <div class="tr-calc-in">
      <div><span class="tr-cl" id="party-label">Travellers</span>
        <div class="tr-step" role="group" aria-labelledby="party-label"><button type="button" data-party="-1" aria-label="One fewer traveller">−</button><output data-party-out>2</output><button type="button" data-party="1" aria-label="One more traveller">+</button></div></div>
      <div><span class="tr-cl">Per person</span><strong data-calc-pp>${eur(tour.prices.explorer)}</strong></div>
      <div><span class="tr-cl">Estimated total</span><strong data-calc-total>${eur(tour.prices.explorer * 2)}</strong></div>
    </div>
    <a class="btn-sun tr-calc-cta" href="${ask}" data-calc-link data-tour="${esc(tour.name)}">Request this journey ${ARROW}</a>
    <p class="tr-calc-note">An estimate, not a quote — it depends on dates and availability. We'll send an exact price within a day, and you pay nothing until you're happy.</p>
  </div>
  <div class="tr-incl">
    <div><h3>${icon("check")} Included</h3><ul>${join(ALWAYS_INCLUDED, (x) => `<li>${esc(x)}</li>`)}<li>Everything listed for your chosen tier above</li></ul></div>
    <div><h3>${icon("x")} Not included</h3><ul>${join(NOT_INCLUDED, (x) => `<li>${esc(x)}</li>`)}</ul></div>
  </div>
</section>

<section class="pg-sec tint tr-more" aria-labelledby="more-h">
  <div class="wrap">
    <div class="pg-head"><p class="eyebrow">More journeys</p><h2 id="more-h" class="h2">You might also love</h2></div>
    ${tourCards(others)}
  </div>
</section>

<section class="pg-end" aria-labelledby="end-h"><div class="wrap pg-end-in"><h2 id="end-h" class="h2">Make it yours</h2><p class="lede">Add a day in the mountains, swap a museum for a winery or join two journeys. Tell us what you'd like and we'll shape the route around you.</p><div class="pg-acts"><a class="btn-sun" href="${ask}">Plan this trip ${ARROW}</a><a class="btn-out" href="contact.html">Ask a question</a></div></div></section>
</main>`;

  return layout({
    page: `tours/${tour.id}.html`,
    title: tour.name,
    description: tour.summary,
    main: main.replace(/(["'(\s])(img|photos)\//g, "$1assets/$2/"),
    scripts: ["tour.js"],
  });
}
