import { layout } from "../lib/layout.mjs";
import { georgiaMap } from "../lib/map.mjs";
import { icon } from "../lib/icons.mjs";
import { join } from "../lib/html.mjs";
import { pageHero, media } from "../lib/components.mjs";
import { REGIONS } from "../data/regions.mjs";
import { TOUR_BY_ID } from "../data/tours.mjs";

export default function destinationsPage() {
  const allStops = ["tbilisi", "kazbegi", "mestia", "ushguli", "telavi", "sighnaghi", "davidgareja", "vardzia", "borjomi", "kutaisi", "martvili", "batumi", "omalo", "dmanisi", "mtskheta"];
  const body = `
${pageHero({
  sceneName: "svaneti",
  ka: "მიმართულებები",
  kicker: "Destinations",
  title: `${REGIONS.length} worlds in<br><em>one small country.</em>`,
  lead: "Glaciers and palm trees, cave cities and wine cellars, a capital that never sleeps and valleys where the road ends. Here is where we'll take you.",
  crumbs: [{ label: "Destinations" }],
})}

<section class="section section--paper dest-map" aria-label="Map">
  <div class="container dest-map__grid">
    <div class="dest-map__text">
      <p class="eyebrow">Find your way</p>
      <h2 class="h2" data-split>Where in<br><em>Georgia?</em></h2>
      <p class="lead" data-reveal>Choose a region to jump straight to it. Almost everywhere is within a day's drive of Tbilisi — and the drive is half the point.</p>
      <ul class="dest-index">
        ${join(REGIONS, (r, i) => `<li><a href="#${r.id}" data-region-link="${r.id}"><span class="dest-index__n">${String(i + 1).padStart(2, "0")}</span>${r.name}<span class="dest-index__ka" lang="ka">${r.ka}</span></a></li>`)}
      </ul>
    </div>
    <div class="dest-map__map" data-reveal>${georgiaMap({ stops: allStops, regions: true, className: "gmap--regions", label: "Map of Georgia's regions and destinations" })}</div>
  </div>
</section>

<div class="regions">
  ${join(
    REGIONS,
    (r, i) => `<section class="region ${i % 2 ? "region--flip" : ""}" id="${r.id}" aria-labelledby="${r.id}-title">
    <div class="container region__grid">
      <div class="region__media" data-clip-reveal>${media({ slot: `region-${r.id}`, sceneName: r.scene, alt: "" })}</div>
      <div class="region__text">
        <p class="region__ka" lang="ka">${r.ka}</p>
        <p class="eyebrow">${r.kicker}</p>
        <h2 class="h2" id="${r.id}-title" data-split>${r.name}</h2>
        <p class="lead" data-reveal>${r.text}</p>
        <ul class="region__highlights" data-reveal>${join(r.highlights, (h) => `<li>${icon("check")}${h}</li>`)}</ul>
        <p class="region__best" data-reveal>${icon("calendar")} <span><small>Best time</small>${r.best}</span></p>
        <div class="region__tours" data-reveal>
          ${join(r.tours, (id) => {
            const t = TOUR_BY_ID[id];
            return `<a class="pill-link" href="tours/${t.id}.html"><span>${t.name}</span><small>${t.days} days</small>${icon("arrow")}</a>`;
          })}
        </div>
      </div>
    </div>
  </section>`
  )}
</div>`;

  return layout({
    title: "Destinations in Georgia",
    description: "Tbilisi, Kazbegi, Svaneti, Kakheti, Vardzia, Colchis, the Black Sea coast, Tusheti and Dmanisi — the regions of Georgia and when to visit.",
    path: "destinations.html",
    body,
    bodyClass: "page-destinations",
    headerTheme: "ink",
  });
}
