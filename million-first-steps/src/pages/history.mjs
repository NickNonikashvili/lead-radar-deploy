import { layout } from "../lib/layout.mjs";
import { icon } from "../lib/icons.mjs";
import { join, words } from "../lib/html.mjs";
import { pageHero, sectionHead, media, hasPhoto } from "../lib/components.mjs";
import { ERAS, LEGENDS, HERITAGE, GEO_ALPHABET } from "../data/history.mjs";
import { TOUR_BY_ID } from "../data/tours.mjs";

const ERA_PHOTO = { skull: "history-skull", qvevri: "history-qvevri", tamar: "history-tamar", sword: "history-gelati", tower: "history-towers", script: "history-script" };

const alphabetWidget = `<div class="alphabet" data-alphabet>
  <div class="alphabet__try">
    <label for="name-ka" class="alphabet__label">Write your name in Georgian</label>
    <input id="name-ka" type="text" maxlength="24" placeholder="Type your name…" autocomplete="off" data-alphabet-input>
    <p class="alphabet__out" lang="ka" aria-live="polite" data-alphabet-out>მოგზაური</p>
    <p class="alphabet__hint">A playful approximation — Georgian has sounds English doesn't, and vice versa. (მოგზაური means "traveller".)</p>
  </div>
  <ul class="alphabet__grid" lang="ka" aria-label="The 33 letters of the modern Georgian alphabet">
    ${join(GEO_ALPHABET, ([k, l]) => `<li><span>${k}</span><small>${l}</small></li>`)}
  </ul>
</div>`;

export default function historyPage() {
  const body = `
${pageHero({
  sceneName: "dmanisi",
  ka: "ისტორია",
  kicker: "The history of Georgia",
  title: "1.8 million years<br><em>in one scroll.</em>",
  lead: "Few countries can tell the human story from its very first chapter. Georgia can: the first humans outside Africa, the first wine, one of the first Christian kingdoms, an alphabet all its own — and a hospitality that survived everything.",
  crumbs: [{ label: "History" }],
})}

<section class="section history-intro" aria-label="Introduction">
  <div class="container">
    <p class="scrub-text scrub-text--xl" data-scrub-words>${words(
      "Empires came from every direction — Persian, Roman, Arab, Byzantine, Mongol, Ottoman, Russian. Georgians kept their language, their faith, their songs and their wine. Walk through it with us."
    )}</p>
  </div>
</section>

<section class="timeline" data-timeline aria-label="Timeline">
  <div class="timeline__line" aria-hidden="true"><span class="timeline__fill" data-timeline-fill></span></div>
  <ol class="timeline__list">
    ${join(ERAS, (e, i) => {
      const tour = e.tour && TOUR_BY_ID[e.tour];
      const slot = ERA_PHOTO[e.icon];
      const visual = slot && hasPhoto(slot) ? media({ slot, className: "era__photo" }) : `<div class="era__medal" aria-hidden="true">${icon(e.icon)}<span>${e.short}</span></div>`;
      return `<li class="era ${i % 2 ? "era--right" : "era--left"}" data-era>
      <span class="era__dot" aria-hidden="true"></span>
      <div class="era__visual" data-reveal>${visual}</div>
      <div class="era__body">
        <p class="era__year">${e.year}</p>
        <h2 class="era__title" data-split>${e.title}</h2>
        ${join(e.text, (p) => `<p data-reveal>${p}</p>`)}
        ${e.alphabet ? alphabetWidget : ""}
        ${tour ? `<a class="link-arrow era__tour" href="tours/${tour.id}.html" data-reveal>Walk it on <strong>${tour.name}</strong> ${icon("arrow")}</a>` : ""}
      </div>
    </li>`;
    })}
  </ol>
</section>

<section class="section section--dark legends legends--dark" aria-label="Legends">
  <div class="container">
    ${sectionHead({ kicker: "Myths & legends", title: "Stories older<br><em>than the churches.</em>" })}
    <div class="legends__grid">
      ${join(LEGENDS, (l, i) => `<article class="legend" data-reveal style="--d:${i * 0.08}s"><span class="legend__icon">${icon(l.icon)}</span><h3 class="legend__title">${l.title}</h3><p>${l.text}</p></article>`)}
    </div>
  </div>
</section>

<section class="section heritage" aria-label="UNESCO heritage">
  <div class="container">
    ${sectionHead({ kicker: "Recognised by UNESCO", title: "Heritage the whole<br><em>world signed up for.</em>" })}
    <div class="heritage__grid">
      <div data-reveal>
        <h3 class="h4">${icon("heritage")} World Heritage sites</h3>
        <ul class="heritage__list">${join(HERITAGE.world, (h) => `<li><span>${h.name}</span><strong>${h.year}</strong></li>`)}</ul>
      </div>
      <div data-reveal>
        <h3 class="h4">${icon("ornament")} Intangible Cultural Heritage</h3>
        <ul class="heritage__list">${join(HERITAGE.intangible, (h) => `<li><span>${h.name}${h.note ? ` <small>(${h.note})</small>` : ""}</span><strong>${h.year}</strong></li>`)}</ul>
      </div>
    </div>
    <p class="fineprint">This history was written for Million First Steps from established sources — UNESCO, the Georgian National Museum, and peer-reviewed research on Dmanisi and early winemaking. Dates for the deep past are approximate, and scholars still debate some of them; that is part of the fun.</p>
  </div>
</section>`;

  return layout({
    title: "History of Georgia",
    description:
      "The history of Georgia in one scroll: Dmanisi's 1.8-million-year-old humans, 8,000 years of wine, Colchis and the Golden Fleece, St Nino, David the Builder, King Tamar and today.",
    path: "history.html",
    body,
    bodyClass: "page-history",
    headerTheme: "cream",
  });
}
