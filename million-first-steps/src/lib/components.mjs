import fs from "node:fs";
import { esc, join } from "./html.mjs";
import { icon } from "./icons.mjs";
import { TIERS } from "../data/tiers.mjs";
import { STYLES } from "../data/tours.mjs";
import { PHOTOS } from "../data/photos.mjs";
import config from "../config.mjs";
import { scene as sceneInline } from "./scenes.mjs";

const photoDir = new URL("../assets/photos/", import.meta.url);
const creditsFile = new URL("../data/photo-credits.json", import.meta.url);
export const CREDITS = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, "utf8")) : {};
export const hasPhoto = (id) => fs.existsSync(new URL(`${id}-1600.webp`, photoDir));

const eur = (n) => `${config.currencies.EUR.symbol}${Math.round(n).toLocaleString("en-US")}`;
export const price = (n) => `<span class="price" data-eur="${n}">${eur(n)}</span>`;

export const btn = (href, label, { variant = "gold", ico = "arrow", cls = "", attrs = "" } = {}) =>
  `<a class="btn btn--${variant} ${cls}" href="${href}" ${attrs}><span class="btn__label">${label}</span>${ico ? `<span class="btn__icon">${icon(ico)}</span>` : ""}</a>`;

export const eyebrow = (text) => `<p class="eyebrow">${text}</p>`;

export function sectionHead({ kicker, title, lead, align = "left", split = true }) {
  return `<header class="section-head section-head--${align}">
    ${kicker ? eyebrow(kicker) : ""}
    <h2 class="h2"${split ? " data-split" : ""}>${title}</h2>
    ${lead ? `<p class="lead" data-reveal>${lead}</p>` : ""}
  </header>`;
}

/** A real photo if one has been added for `slot`, otherwise the named illustrated scene. */
export function media({ slot, sceneName, alt = "", root = "", className = "", eager = false }) {
  if (slot && hasPhoto(slot)) {
    const a = alt || PHOTOS[slot]?.alt || "";
    const credit = CREDITS[slot];
    return `<figure class="media media--photo ${className}">
      <img src="${root}assets/photos/${slot}-1600.webp" srcset="${root}assets/photos/${slot}-800.webp 800w, ${root}assets/photos/${slot}-1600.webp 1600w" sizes="(min-width: 900px) 60vw, 100vw" alt="${esc(a)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" data-depth-img>
      ${credit ? `<figcaption class="media__credit">${esc(credit.short || `Photo: ${credit.author}, ${credit.license}`)}</figcaption>` : ""}
    </figure>`;
  }
  return `<div class="media media--scene ${className}"><img class="scene-img" src="${root}assets/scenes/${sceneName}.svg" alt="${esc(alt)}" ${
    eager ? "" : 'loading="lazy"'
  } decoding="async" data-depth-img></div>`;
}

export const tierSwitch = (label = "Travel style") => `<div class="tier-switch" role="radiogroup" aria-label="${label}">
  ${join(
    TIERS,
    (t) =>
      `<button type="button" class="tier-switch__btn" role="radio" aria-checked="${t.id === "explorer"}" data-set-tier="${t.id}"><span>${t.name}</span></button>`
  )}
  <span class="tier-switch__thumb" aria-hidden="true"></span>
</div>`;

/** Price for every tier; CSS shows the one matching <html data-tier>. */
export const tierPrices = (tour) =>
  join(TIERS, (t) => `<span class="tp" data-tier="${t.id}">${price(tour.prices[t.id])}</span>`);

export function tourCard(tour, root = "", { size = "" } = {}) {
  return `<article class="tour-card ${size}" data-styles="${tour.styles.join(" ")}" data-reveal>
    <a class="tour-card__link" href="${root}tours/${tour.id}.html" aria-label="${esc(tour.name)} — ${tour.days} days">
      <div class="tour-card__media">${media({ slot: tour.photo, sceneName: tour.scene, root })}
        <span class="tour-card__days"><strong>${tour.days}</strong> days</span>
      </div>
      <div class="tour-card__body">
        <p class="tour-card__kicker">${tour.kicker}</p>
        <h3 class="tour-card__title">${tour.name}</h3>
        <p class="tour-card__summary">${tour.summary.split(". ")[0].replace(/\.$/, "")}.</p>
        <ul class="tags">${join(tour.styles, (s) => `<li>${STYLES[s]}</li>`)}</ul>
        <div class="tour-card__foot">
          <p class="tour-card__price"><span>from</span> ${tierPrices(tour)} <span>pp</span></p>
          <span class="tour-card__go">${icon("arrow")}</span>
        </div>
      </div>
    </a>
  </article>`;
}

export const footprints = (n = 6, cls = "") =>
  `<div class="trail ${cls}" aria-hidden="true">${Array.from(
    { length: n },
    (_, i) => `<svg class="trail__step" viewBox="0 0 20 32" style="--i:${i}"><ellipse cx="10" cy="20" rx="6.5" ry="10"/><circle cx="6" cy="6" r="2.2"/><circle cx="10.5" cy="4.6" r="2.4"/><circle cx="14.6" cy="6.6" r="2"/></svg>`
  ).join("")}</div>`;

/** Hero used on every inner page: an illustrated scene whose layers drift apart on scroll. */
export function pageHero({ kicker, title, lead = "", sceneName, photo, ka = "", crumbs = [], root = "", extra = "" }) {
  const usePhoto = photo && hasPhoto(photo);
  const bg = usePhoto
    ? `<img class="page-hero__photo" src="${root}assets/photos/${photo}-1600.webp" srcset="${root}assets/photos/${photo}-800.webp 800w, ${root}assets/photos/${photo}-1600.webp 1600w" sizes="100vw" alt="" fetchpriority="high">`
    : sceneInline(sceneName);
  const credit = usePhoto && CREDITS[photo] ? `<p class="page-hero__credit">${esc(CREDITS[photo].short)}</p>` : "";
  return `<section class="page-hero" data-page-hero>
  <div class="page-hero__scene" aria-hidden="true">${bg}</div>
  <div class="page-hero__veil" aria-hidden="true"></div>
  <div class="container page-hero__content">
    ${
      crumbs.length
        ? `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${root}index.html">Home</a></li>${crumbs
            .map((c) => (c.href ? `<li><a href="${c.href}">${c.label}</a></li>` : `<li aria-current="page">${c.label}</li>`))
            .join("")}</ol></nav>`
        : ""
    }
    ${ka ? `<p class="page-hero__ka" lang="ka">${ka}</p>` : ""}
    ${kicker ? `<p class="eyebrow">${kicker}</p>` : ""}
    <h1 class="page-hero__title" data-split>${title}</h1>
    ${lead ? `<p class="page-hero__lead" data-reveal>${lead}</p>` : ""}
    ${extra}
  </div>
  ${credit}
</section>`;
}
