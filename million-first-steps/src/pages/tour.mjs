// Tour pages. The design has no tour page yet, so this one is built from its parts:
// the page hero, section heads, tinted bands, tour cards and the closing call to action.
import { layout } from "../lib/layout.mjs";
import { esc, join, tierPrices, livePrice, eur, ARROW } from "../lib/site.mjs";
import { icon } from "../lib/icons.mjs";
import { georgiaMap } from "../lib/map.mjs";
import { TIERS, ALWAYS_INCLUDED, NOT_INCLUDED } from "../data/tiers.mjs";
import { TOURS, STYLES } from "../data/tours.mjs";
import { PLACES } from "../data/places.mjs";
import { CARDS } from "../data/tour-cards.mjs";
import { TOUR_PHOTOS } from "../data/tour-photos.mjs";
import { HL_DECO, DAYS_ART, END_ART, TIER_ICON } from "../lib/tour-art.mjs";
import config from "../config.mjs";

const season = (s) => s.replace(/\s*\(.*\)$/, "");

// "You might also love": the first `show` tours are visible, the rest wait hidden (data-spare) and step in
// when the owners take one of the first off the website (site.js).
export function tourCards(list, show = list.length) {
  return `<ul class="tc-grid tc-grid--more" data-tour-more="${show}">${join(list, (t, i) => {
    const c = CARDS[t.id];
    return `<li data-tour-card="${t.id}"${i < show ? "" : " data-spare hidden"}><article class="tc"><div class="tc-ph"><img src="${c.img}" alt="${esc(c.alt)}" loading="lazy"><span class="tc-days">${t.days} days</span></div><div class="tc-body"><div class="tc-tags">${join(t.styles, (s) => `<span${s === "wine" ? ' class="w"' : ""}>${esc(STYLES[s])}</span>`)}</div><h3><a href="tours/${t.id}.html">${esc(t.name)}</a></h3><p class="tc-route">${c.stops.map(esc).join(" · ")}</p><div class="tc-foot"><span class="tc-price"><span>From</span> ${tierPrices(t)}<small>per person, private tour</small></span><span class="tc-go" aria-hidden="true">View tour ${ARROW}</span></div></div></article></li>`;
  })}</ul>`;
}

export default function tourPage(tour) {
  const c = CARDS[tour.id];
  const others = TOURS.filter((t) => t.id !== tour.id)
    .sort((a, b) => b.styles.filter((s) => tour.styles.includes(s)).length - a.styles.filter((s) => tour.styles.includes(s)).length);
  const ask = `contact.html?topic=custom&tour=${encodeURIComponent(tour.name)}#cf-h`;
  // "Why this journey" photo stack (tour.js deals it): the first two load at once, the rest lazily.
  const photos = TOUR_PHOTOS[tour.id] || [{ img: c.img, alt: c.alt, cap: tour.name }];
  const chev = (d) => `<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const main = `<main id="main" class="tour-pg">
<section class="tr-hero" aria-labelledby="pg-h">
  <div class="tr-hero-ph"><img src="${c.img}" alt="${esc(c.alt)}"></div>
  <div class="wrap tr-hero-in">
    <nav class="tr-crumbs" aria-label="Breadcrumb"><a href="tours.html">Tours</a><span aria-hidden="true">/</span><span>${esc(tour.name)}</span></nav>
    <p class="tr-off" data-tour-unavailable="${tour.id}" role="status" hidden>This journey isn’t on offer at the moment. Ask us and we’ll suggest something similar.</p>
    <p class="eyebrow">${esc(tour.kicker)}</p>
    <h1 id="pg-h">${esc(tour.name)}</h1>
    <p class="lede">${esc(tour.summary)}</p>
    <ul class="tr-facts">
      <li>${icon("calendar")}<span><small>Duration</small><b>${tour.days} days · ${tour.days - 1} nights</b></span></li>
      <li>${icon("sun")}<span><small>Best season</small><b>${esc(season(tour.season))}</b></span></li>
      <li>${icon("mountains")}<span><small>Pace</small><b>${esc(tour.level)}</b></span></li>
      <li>${icon("coin")}<span><small>From, per person</small><b>${tierPrices(tour)}</b></span></li>
    </ul>
    <div class="pg-acts"><a class="btn-sun" href="#price">See prices</a><a class="btn-out" href="${ask}">Plan this trip</a></div>
  </div>
</section>

<section class="wrap pg-sec tr-high" aria-labelledby="hi-h">
  ${HL_DECO}
  <div class="hl-grid">
    <div class="hl-text"><div class="pg-head"><p class="eyebrow">Highlights</p><h2 id="hi-h" class="h2">Why this journey</h2><p class="tr-regions">${icon("pin")} ${tour.regions.map(esc).join(" · ")}</p></div>
    <ol class="tr-hi">${join(tour.highlights, (h, i) => `<li><span aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><p>${esc(h)}</p></li>`)}</ol></div>
    <div class="hl-photos" role="region" aria-roledescription="carousel" aria-label="Photos from this journey">
      <div class="hl-stack">${join(photos, (p, i) => `<figure class="hl-card"><img src="${p.img}" alt="${esc(p.alt)}"${i > 1 ? ' loading="lazy"' : ""}><figcaption>${esc(p.cap)}</figcaption></figure>`)}</div>
      <div class="hl-ctrl"${photos.length > 1 ? "" : " hidden"}>
        <button type="button" class="hl-btn" data-hl="prev" aria-label="Previous photo">${chev("M12.5 4.5L7 10l5.5 5.5")}</button>
        <span class="hl-count" aria-live="polite"><b>1</b> / ${photos.length}</span>
        <button type="button" class="hl-btn" data-hl="next" aria-label="Next photo">${chev("M7.5 4.5L13 10l-5.5 5.5")}</button>
        <button type="button" class="hl-btn hl-play" data-hl="pause" aria-label="Pause slideshow" aria-pressed="false"><svg class="i-pause" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5v11M13 4.5v11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><svg class="i-play" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5v11l8.5-5.5z" fill="currentColor"/></svg></button>
      </div>
    </div>
  </div>
</section>

<section class="pg-sec tint tr-days" aria-labelledby="days-h">
  ${DAYS_ART}
  <div class="wrap">
    <div class="tr-days-grid">
      <div class="tr-days-side"><div class="pg-head"><p class="eyebrow">Day by day</p><h2 id="days-h" class="h2">The route</h2></div>
      <div class="tr-map"><div class="tr-map-in">${georgiaMap({ route: tour.route, className: "gmap--tour", label: `Map of the ${tour.name} route` })}</div></div></div>
      <ol class="tr-dlist">${join(
        tour.itinerary,
        (d, i) => `<li class="tr-day" data-stop="${d.stop}"><p class="tr-dn">Day ${i + 1}<span aria-hidden="true"> · </span><span class="tr-dp">${esc(PLACES[d.stop]?.name || "")}</span></p><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p><p class="tr-night">${icon(d.night === "Departure" ? "plane" : "bed")} ${esc(d.night)}</p></li>`
      )}</ol>
    </div>
  </div>
</section>

<section class="wrap pg-sec tr-price" id="price" aria-labelledby="price-h" data-calc data-tour="${tour.id}" data-prices='${JSON.stringify(tour.prices)}' data-factors='${JSON.stringify(config.partyFactors)}'>
  <div class="pg-head"><p class="eyebrow">Choose your comfort</p><h2 id="price-h" class="h2">One route, three ways to travel it</h2></div>
  <div class="tr-tiers" role="radiogroup" aria-label="Travel style">${join(
    TIERS,
    (t) => `<button type="button" class="tr-tier tr-tier--${t.id}" role="radio" aria-checked="${t.id === "explorer"}" data-set-tier="${t.id}">
      ${t.id === "explorer" ? `<span class="tr-badge">Most popular</span>` : ""}
      <span class="tr-tier-top"><span class="tr-tier-name">${TIER_ICON[t.id]?.("tr-tier-ic") || ""}<b>${esc(t.name)}</b></span><span class="tr-check" aria-hidden="true">${icon("check")}</span></span>
      <span class="tr-tier-price"><small>From</small> ${livePrice(tour, t.id)} <small>per person</small></span>
      <span class="tr-tier-tag">${esc(t.tagline)}</span>
      <span class="tr-tier-list"><span>${icon(t.id === "wanderer" ? "sedan" : "car")}${esc(t.vehicle.title)}</span><span>${icon("bed")}${esc(t.stay.title)}</span><span>${icon("dining")}${esc(t.dining.title)}</span><span>${icon("guide")}${esc(t.guide.title)}</span></span>
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
    ${tourCards(others, 3)}
  </div>
</section>

<section class="pg-end" aria-labelledby="end-h">${END_ART}<div class="wrap pg-end-in"><h2 id="end-h" class="h2">Make it yours</h2><p class="lede">Add a day in the mountains, swap a museum for a winery or join two journeys. Tell us what you'd like and we'll shape the route around you.</p><div class="pg-acts"><a class="btn-sun" href="${ask}">Plan this trip ${ARROW}</a><a class="btn-out" href="contact.html">Ask a question</a></div></div></section>
</main>`;

  return layout({
    page: `tours/${tour.id}.html`,
    title: tour.name,
    description: tour.summary,
    main: main.replace(/(["'(\s])(img|photos)\//g, "$1assets/$2/"),
    scripts: ["tour.js"],
  });
}
