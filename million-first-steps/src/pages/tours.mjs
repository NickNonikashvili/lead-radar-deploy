import { layout } from "../lib/layout.mjs";
import { designPage, finish, esc, join, tierPrices, tierSelect, ARROW } from "../lib/site.mjs";
import { TOURS, STYLES } from "../data/tours.mjs";
import { TIERS, ALWAYS_INCLUDED } from "../data/tiers.mjs";
import { CARDS, durationBucket } from "../data/tour-cards.mjs";

/** The three tiers side by side, used on the tours page. */
export function tiersSection() {
  const rows = [
    ["vehicle", "Vehicle"],
    ["stay", "Where you sleep"],
    ["dining", "How you eat"],
    ["guide", "Who travels with you"],
  ];
  return `<section class="pg-sec tint tiers-sec" id="tiers" aria-labelledby="tiers-h">
  <div class="wrap">
    <div class="pg-head"><p class="eyebrow">Three ways to travel</p><h2 id="tiers-h" class="h2">Same Georgia. Your kind of comfort.</h2><p class="lede">Every journey comes in three levels. The route stays the same — the car, the beds and the tables change. All are private: just you, your people, and us.</p></div>
    <ul class="tiers3">${join(
      TIERS,
      (t) => `<li class="tier3 tier3--${t.id}">
        <h3>${esc(t.name)}</h3><p class="tier3-tag">${esc(t.tagline)}</p><p class="tier3-sum">${esc(t.summary)}</p>
        <dl>${join(rows, ([k, label]) => `<div><dt>${label}</dt><dd><b>${esc(t[k].title)}</b>${esc(t[k].text)}</dd></div>`)}</dl>
        <button type="button" class="tier3-go" data-set-tier="${t.id}" aria-checked="${t.id === "explorer"}">Show ${esc(t.name)} prices</button>
      </li>`
    )}</ul>
    <p class="tiers-incl"><b>Always included, whichever tier you choose:</b> ${ALWAYS_INCLUDED.map(esc).join(" · ")}.</p>
  </div>
</section>`;
}

export default function toursPage() {
  const root = designPage("tours");

  // Filters: our styles and the lengths our tours come in; prices follow the chosen travel style.
  root.querySelector("#tc-type").set_content(`<option value="all">All styles</option>` + join(Object.entries(STYLES), ([k, v]) => `<option value="${k}">${esc(v)}</option>`));
  root.querySelector("#tc-dur").set_content(`<option value="all">Any length</option><option value="2-4">2–4 days</option><option value="5-7">5–7 days</option><option value="8+">8+ days</option>`);
  root.querySelector("#tc-reset").insertAdjacentHTML("beforebegin", `<span class="tp-tier"><span class="tp-tier-l">Prices for</span>${tierSelect("tc-tier")}</span>`);
  root.querySelector("#tc-n").set_content(String(TOURS.length));

  // Cards from our tours, reusing the design's icons.
  const first = root.querySelector("#tc-grid li");
  const seasonIcon = first.querySelector(".tc-season svg").toString();
  const grid = root.querySelector("#tc-grid");
  grid.set_content(
    join(TOURS, (t, i) => {
      const c = CARDS[t.id];
      return `<li data-dur="${durationBucket(t.days)}" data-days="${t.days}" data-type="${t.styles.join(" ")}" data-season="${c.seasons.join(" ")}" data-order="${i}"><article class="tc"><div class="tc-ph"><img src="${c.img}" alt="${esc(c.alt)}" loading="lazy"><span class="tc-days">${t.days} days</span>${i === 0 ? `<span class="tc-feat">${esc(t.kicker)}</span>` : ""}</div><div class="tc-body"><div class="tc-tags">${join(t.styles, (s) => `<span${s === "wine" ? ' class="w"' : ""}>${esc(STYLES[s])}</span>`)}</div><h2><a href="tours/${t.id}.html">${esc(t.name)}</a></h2><p class="tc-route">${c.stops.map(esc).join(" · ")}</p><p class="tc-season" style="margin:0">${seasonIcon}<span>Best: ${esc(t.season.split(" · ")[0].replace(/\s*\(.*\)$/, ""))}</span></p><div class="tc-foot"><span class="tc-price"><span>From</span> ${tierPrices(t.prices)}<small>per person, private tour</small></span><span class="tc-go" aria-hidden="true">View tour ${ARROW}</span></div></div></article></li>`;
    })
  );

  // The three tiers, between the tours and the closing call to action.
  root.querySelector(".pg-end").insertAdjacentHTML("beforebegin", tiersSection());

  return layout({
    page: "tours.html",
    title: "Private tours across Georgia",
    description: "Seven private journeys through Georgia, each in three travel styles — from family guesthouses to five-star hotels. Filter by season, length and style.",
    main: finish(root),
    scripts: ["tours.js"],
  });
}
