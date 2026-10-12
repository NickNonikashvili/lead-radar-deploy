import { layout } from "../lib/layout.mjs";
import { scene } from "../lib/scenes.mjs";
import { georgiaMap } from "../lib/map.mjs";
import { icon } from "../lib/icons.mjs";
import { join, words } from "../lib/html.mjs";
import { btn, media, sectionHead, tierSwitch, tourCard, price, footprints, hasPhoto } from "../lib/components.mjs";
import { REGIONS } from "../data/regions.mjs";
import { TIERS } from "../data/tiers.mjs";
import { TOUR_BY_ID } from "../data/tours.mjs";
import { LEGENDS } from "../data/history.mjs";
import { PLACES } from "../data/places.mjs";
import config from "../config.mjs";

const DEEP_TIME = [
  { value: 1800000, unit: "years ago", icon: "skull", title: "The first Europeans weren't European", text: "At Dmanisi, south of Tbilisi, lie the oldest human fossils ever found outside Africa. Humanity's first steps beyond its birthplace led here." },
  { value: 8000, unit: "years of winemaking", icon: "qvevri", title: "The first wine on Earth", text: "Neolithic jars from villages near Tbilisi hold the earliest known traces of grape wine, from around 6000 BC. Georgians never stopped." },
  { value: 1500, unit: "years of a unique alphabet", icon: "script", title: "A script found nowhere else", text: "Georgian has its own alphabet — three scripts, now UNESCO-listed — with inscriptions dated to the 5th century." },
  { value: 900, unit: "years since a golden age", icon: "crown", title: "Kings who built, a king named Tamar", text: "David the Builder's victory at Didgori in 1121 opened a golden age of cathedrals, academies and poetry under King Tamar." },
  { value: 1000001, unit: "st step — yours", icon: "door", title: "And the door is still open", text: "A guest, Georgians say, is a gift from God. Every journey here is the next step in a very long walk." },
];

// Buried qvevri in cross-section; wine fills it as you scroll.
const qvevri = `<svg class="qvevri" viewBox="0 0 400 560" role="img" aria-label="A clay qvevri buried in the earth, filling with amber wine">
  <defs>
    <linearGradient id="qvClay" x1="0" x2="1"><stop offset="0" stop-color="#7a3b1c"/><stop offset=".45" stop-color="#b8673a"/><stop offset="1" stop-color="#6a3016"/></linearGradient>
    <linearGradient id="qvWine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b24f"/><stop offset="1" stop-color="#b45a1c"/></linearGradient>
    <linearGradient id="qvSoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3020"/><stop offset="1" stop-color="#20140c"/></linearGradient>
    <clipPath id="qvInside"><path d="M176 92h48v28c64 22 104 92 104 172 0 104-52 196-128 196S72 396 72 292c0-80 40-150 104-172Z"/></clipPath>
  </defs>
  <rect x="0" y="70" width="400" height="490" fill="url(#qvSoil)"/>
  <path d="M0 70h400" stroke="#6b8a3a" stroke-width="6"/>
  <g fill="#6b4a33" opacity=".5">${Array.from({ length: 70 }, (_, i) => {
    const x = (i * 97) % 400, y = 90 + ((i * 61) % 460);
    return `<circle cx="${x}" cy="${y}" r="${1 + (i % 4)}"/>`;
  }).join("")}</g>
  <path d="M166 60h68v20h-8v32c68 24 112 98 112 180 0 112-58 208-138 208S62 404 62 292c0-82 44-156 112-180V80h-8Z" fill="url(#qvClay)"/>
  <g clip-path="url(#qvInside)">
    <rect x="60" y="80" width="280" height="420" fill="#2a160b"/>
    <g data-qvevri-wine>
      <rect x="60" y="80" width="280" height="420" fill="url(#qvWine)"/>
      <path d="M60 80c30-8 60 8 90 0s60-8 90 0 60 8 90 0v8H60Z" fill="#ffd27a" opacity=".6"/>
    </g>
    <g fill="#ffe2a8" opacity=".7" data-qvevri-bubbles>${Array.from({ length: 14 }, (_, i) => `<circle cx="${110 + ((i * 53) % 180)}" cy="${200 + ((i * 89) % 260)}" r="${2 + (i % 3)}"/>`).join("")}</g>
  </g>
  <path d="M150 52h100v14H150Z" fill="#8a4a24"/>
  <path d="M120 300c10-70 40-118 82-140" stroke="#f3c191" stroke-width="5" fill="none" opacity=".35" stroke-linecap="round"/>
</svg>`;

// Father, son and the dog — the founders card illustration.
const foundersArt = `<svg class="founders__art" viewBox="0 0 600 720" role="img" aria-label="Illustration of a father, a son and their dog looking out over the mountains">
  <defs><linearGradient id="fdSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dcae"/><stop offset=".6" stop-color="#f0b06c"/><stop offset="1" stop-color="#d98a52"/></linearGradient>
  <radialGradient id="fdSun"><stop offset="0" stop-color="#ffe5a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe5a8" stop-opacity="0"/></radialGradient></defs>
  <rect width="600" height="720" fill="url(#fdSky)"/>
  <circle cx="390" cy="380" r="260" fill="url(#fdSun)"/><circle cx="390" cy="380" r="34" fill="#fff4dc"/>
  <path d="M0 420 70 360l50 30 90-120 60 70 40-40 110 110 70-60 110 90V720H0Z" fill="#d3a273"/>
  <path d="M210 270l-26 46 18-6 12 22 14-28 16 16 8-22 30 32-12-36Z" fill="#fff1dc"/>
  <path d="M0 500c90-50 200-60 300-30s200 20 300-10V720H0Z" fill="#8a5b37"/>
  <path d="M0 600c120-40 240-30 340 0 90 26 180 10 260-20V720H0Z" fill="#3d2716"/>
  <g fill="#24170d">
    <circle cx="200" cy="472" r="13"/><path d="M186 488h28l4 58-6 56h-9l-3-50-3 50h-9l-6-56Z"/><rect x="166" y="490" width="22" height="46" rx="7"/><path d="M216 520l20 78" stroke="#24170d" stroke-width="3"/>
    <circle cx="262" cy="500" r="11"/><path d="M250 513h24l3 46-5 43h-8l-2-38-2 38h-8l-5-43Z"/><path d="M273 520l-58-18" stroke="#24170d" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="326" cy="584" rx="22" ry="19"/><circle cx="338" cy="556" r="12"/><ellipse cx="348" cy="558" rx="8" ry="6"/><ellipse cx="331" cy="558" rx="5" ry="10"/><path d="M306 580q-18-4-14-26" stroke="#24170d" stroke-width="7" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

export default function home() {
  const worlds = REGIONS;
  const featured = ["footsteps-of-the-first-europeans", "the-grand-journey", "cradle-of-wine"].map((id) => TOUR_BY_ID[id]);
  const grand = TOUR_BY_ID["the-grand-journey"];
  const majors = Object.entries(PLACES)
    .filter(([, p]) => p.major)
    .map(([id]) => id);

  // The title sits between the far range and the main massif, so it can sink behind the peaks.
  const heroTitle = `<p class="hero__ka" lang="ka" translate="no"><span data-hero-title>საქართველო · Sakartvelo</span></p>
      <h1 class="hero__title" translate="no"><span class="hero__line" data-hero-title>Million</span> <span class="hero__line" data-hero-title>First Steps</span></h1>
      <p class="hero__tag" translate="no"><span data-hero-title>Georgia Travel Experiences</span></p>`;
  const heroScene = scene("hero", { layered: true, className: "hero__scene" }).replace(
    '<svg class="scene__layer scene__layer--main"',
    `${heroTitle}<svg class="scene__layer scene__layer--main"`
  );

  const body = `
<section class="hero" data-hero aria-label="Introduction">
  <div class="hero__pin">
    ${heroScene}
    <div class="hero__veil" aria-hidden="true"></div>
    <div class="hero__content">
      <p class="hero__intro" data-hero-in>1.8 million years ago, the first humans to leave Africa walked into these mountains. They had good reason. <em>Yours will be the million-and-first step.</em></p>
      <div class="hero__actions" data-hero-in>
        ${btn("tours.html", "Explore journeys")}
        ${btn("#deep-time", "Why Georgia?", { variant: "ghost", ico: "arrow-down" })}
      </div>
    </div>
    <div class="hero__scroll" aria-hidden="true"><span>Scroll</span><span class="hero__scroll-line"></span></div>
    <div class="hero__reveal" aria-hidden="true">
      <div class="hero__reveal-inner">
        <p class="eyebrow">Journeys through deep time</p>
        <p class="deeptime__num deeptime__num--ghost">1,800,000</p>
        <p class="deeptime__unit">years ago</p>
      </div>
    </div>
  </div>
</section>

<section class="deeptime" id="deep-time" data-deeptime aria-label="Journeys through deep time">
  <div class="deeptime__pin">
    <div class="deeptime__sky" aria-hidden="true"></div>
    <div class="container deeptime__inner">
      <p class="eyebrow deeptime__eyebrow">Journeys through deep time</p>
      <div class="deeptime__counter" aria-hidden="true">
        <span class="deeptime__num" data-dt-num>1,800,000</span>
        <span class="deeptime__unit" data-dt-unit>years ago</span>
      </div>
      <ol class="deeptime__steps">
        ${join(
          DEEP_TIME,
          (s, i) => `<li class="dt-step" data-value="${s.value}" data-unit="${s.unit}" style="--i:${i}">
          <span class="dt-step__num">${s.value.toLocaleString("en-US")} <small>${s.unit}</small></span>
          <span class="dt-step__icon">${icon(s.icon)}</span>
          <h3 class="dt-step__title">${s.title}</h3>
          <p class="dt-step__text">${s.text}</p>
        </li>`
        )}
      </ol>
      <div class="deeptime__rail" aria-hidden="true">${join(DEEP_TIME, (s, i) => `<span class="deeptime__tick" style="--i:${i}"></span>`)}<span class="deeptime__bar"></span></div>
      <a class="deeptime__more link-arrow" href="history.html">Read the whole story ${icon("arrow")}</a>
    </div>
  </div>
</section>

<section class="worlds" data-worlds aria-label="Regions of Georgia">
  <div class="worlds__pin">
    <div class="worlds__track" data-worlds-track>
      <div class="worlds__intro">
        <p class="eyebrow">One small country</p>
        <h2 class="h2" data-split>${worlds.length} worlds,<br><em>a day's drive apart.</em></h2>
        <p class="lead">Georgia is about the size of Ireland. Inside it: 5,000-metre peaks, subtropical rainforest, semi-desert monasteries, the Black Sea — and the oldest wine country on Earth.</p>
        <p class="worlds__hint" aria-hidden="true">${icon("arrow")} Keep scrolling</p>
      </div>
      ${join(
        worlds,
        (r, i) => `<article class="world" data-world>
        <a class="world__link" href="destinations.html#${r.id}">
          <div class="world__media">${media({ slot: `region-${r.id}`, sceneName: r.scene, alt: "" })}</div>
          <div class="world__shade" aria-hidden="true"></div>
          <div class="world__text">
            <p class="world__index">${String(i + 1).padStart(2, "0")} / ${String(worlds.length).padStart(2, "0")}</p>
            <p class="world__ka" lang="ka">${r.ka}</p>
            <h3 class="world__name">${r.name}</h3>
            <p class="world__kicker">${r.kicker}</p>
            <p class="world__line">${r.line}</p>
            <span class="world__go">Discover ${icon("arrow")}</span>
          </div>
        </a>
      </article>`
      )}
    </div>
    <div class="worlds__progress" aria-hidden="true"><span data-worlds-bar></span></div>
  </div>
</section>

<section class="wine" data-wine aria-label="The cradle of wine">
  <div class="container wine__grid">
    <div class="wine__visual">
      <div class="wine__sticky">
        ${qvevri}
        <p class="wine__caption"><span data-wine-year>6000 BC</span> · Shulaveri, 50 km south of Tbilisi</p>
      </div>
    </div>
    <div class="wine__text">
      <p class="eyebrow">The cradle of wine</p>
      <h2 class="h2" data-split>8,000 vintages,<br><em>and counting.</em></h2>
      <p class="scrub-text" data-scrub-words>${words(
        "Before writing, before the wheel reached Europe, someone in a village south of Tbilisi buried a clay jar in the earth and filled it with grapes. Georgians have been doing it ever since."
      )}</p>
      <ul class="facts">
        <li data-reveal><strong>c. 6000 BC</strong><span>Earliest known evidence of grape wine — found in Georgia, published in 2017.</span></li>
        <li data-reveal><strong>2013</strong><span>Qvevri winemaking inscribed by UNESCO as Intangible Cultural Heritage.</span></li>
        <li data-reveal><strong>500+</strong><span>Native grape varieties — Saperavi, Rkatsiteli, Mtsvane, Kisi and hundreds more.</span></li>
        <li data-reveal><strong>Amber</strong><span>White grapes fermented on their skins in qvevri: Georgia's gift to the natural-wine world.</span></li>
      </ul>
      ${btn("tours/cradle-of-wine.html", "The Cradle of Wine tour")}
    </div>
  </div>
</section>

<section class="legends" aria-label="Legends">
  <div class="container">
    ${sectionHead({ kicker: "Where myths were born", title: "The Greeks set their<br><em>greatest stories here.</em>", lead: "Jason sailed here for the Golden Fleece. Prometheus was chained to these peaks. Georgians have a few legends of their own." })}
    <div class="legends__grid">
      ${join(
        LEGENDS,
        (l, i) => `<article class="legend" data-reveal style="--d:${i * 0.08}s">
        <span class="legend__icon">${icon(l.icon)}</span>
        <h3 class="legend__title">${l.title}</h3>
        <p>${l.text}</p>
      </article>`
      )}
    </div>
  </div>
</section>

<section class="statement" aria-label="Georgian hospitality">
  <div class="container">
    <p class="eyebrow">სტუმარი ღვთისაა · The guest is from God</p>
    <p class="statement__text" data-scrub-words>${words(
      "In Georgia, a guest is a gift from God. Expect to be fed until you surrender, toasted by strangers, and sent home with a bottle of somebody's grandfather's wine."
    )}</p>
    <div class="statement__grid">
      <article data-reveal><span class="statement__icon">${icon("people")}</span><h3>The supra</h3><p>A Georgian feast is led by a tamada, the toastmaster, through toasts to peace, to ancestors, to friendship and to you. It can last all night. Pace yourself.</p></article>
      <article data-reveal><span class="statement__icon">${icon("ornament")}</span><h3>Songs in three voices</h3><p>Georgian polyphonic singing is UNESCO-listed — and in 1977 the song Chakrulo was sent into deep space on the Voyager Golden Record.</p></article>
      <article data-reveal><span class="statement__icon">${icon("dining")}</span><h3>Khachapuri &amp; khinkali</h3><p>Cheese bread with an egg on top. Soup dumplings you eat by hand, never with a fork. Walnuts, pomegranate, tarragon. You will not leave hungry.</p></article>
    </div>
  </div>
</section>

<section class="tiers-home" aria-label="Ways to travel">
  <div class="container">
    ${sectionHead({ kicker: "Three ways to travel", title: "Same Georgia.<br><em>Your kind of comfort.</em>", lead: "Every journey comes in three levels. The route stays the same — the car, the beds and the tables change. All are private: just you, your people, and us." })}
    <div class="tiers-home__switch" data-reveal>${tierSwitch()}</div>
    <div class="tier-panels" data-reveal>
      ${join(
        TIERS,
        (t) => `<div class="tier-panel" data-tier-panel="${t.id}">
        <div class="tier-panel__head">
          <h3 class="tier-panel__name">${t.name}</h3>
          <p class="tier-panel__tag">${t.tagline}</p>
          <p class="tier-panel__summary">${t.summary}</p>
          <p class="tier-panel__eg">e.g. 7-day Footsteps of the First Europeans from <strong>${price(TOUR_BY_ID["footsteps-of-the-first-europeans"].prices[t.id])}</strong> per person</p>
        </div>
        <ul class="tier-panel__features">
          <li>${icon("car")}<div><strong>${t.vehicle.title}</strong><span>${t.vehicle.text}</span></div></li>
          <li>${icon("bed")}<div><strong>${t.stay.title}</strong><span>${t.stay.text}</span></div></li>
          <li>${icon("dining")}<div><strong>${t.dining.title}</strong><span>${t.dining.text}</span></div></li>
          <li>${icon("guide")}<div><strong>${t.guide.title}</strong><span>${t.guide.text}</span></div></li>
        </ul>
      </div>`
      )}
    </div>
    <div class="featured">
      <div class="featured__head"><h3 class="h3">Start with a favourite</h3>${btn("tours.html", "All journeys", { variant: "line" })}</div>
      <div class="tour-grid tour-grid--3">${join(featured, (t) => tourCard(t))}</div>
    </div>
  </div>
</section>

<section class="mapsec" data-mapsec aria-label="Map of Georgia">
  <div class="container mapsec__grid">
    <div class="mapsec__text">
      <p class="eyebrow">69,700 km² · about the size of Ireland</p>
      <h2 class="h2" data-split>From glaciers to semi-desert<br><em>in a single day.</em></h2>
      <ul class="stats">
        <li data-reveal><strong data-count="5193">5,193</strong><span>metres — Shkhara, Georgia's highest peak</span></li>
        <li data-reveal><strong data-count="4">4</strong><span>UNESCO World Heritage sites</span></li>
        <li data-reveal><strong data-count="2850">2,850</strong><span>metres — the Abano pass, the summer-only road to Tusheti</span></li>
        <li data-reveal><strong data-count="12">12</strong><span>days to see it all on The Grand Journey</span></li>
      </ul>
      ${btn("tours/the-grand-journey.html", "See the Grand Journey")}
    </div>
    <div class="mapsec__map" data-route-draw>
      ${georgiaMap({ route: grand.route, stops: majors, className: "gmap--home", label: "Map of Georgia showing the Grand Journey route" })}
    </div>
  </div>
</section>

<section class="founders" aria-label="Who we are">
  <div class="container founders__grid">
    <div class="founders__media" data-reveal>${hasPhoto("about-founders") ? media({ slot: "about-founders" }) : foundersArt}</div>
    <div class="founders__text">
      <p class="eyebrow">Who we are</p>
      <h2 class="h2" data-split>A father, a son, and a country<br><em>we can't stop showing off.</em></h2>
      <p class="lead" data-reveal>We started Million First Steps to share the Georgia we grew up with — the roads, the tables, the people — with travellers who want more than a checklist. Small and private by design: when you travel with us, you travel with family.</p>
      <p data-reveal>We are new, and proud of it. You won't find invented reviews here — just a promise to look after you like our own guests. Be one of the first travellers to walk with us.</p>
      ${btn("about.html", "Our story", { variant: "line" })}
    </div>
  </div>
  ${footprints(9, "founders__trail")}
</section>`;

  return layout({
    title: "",
    description:
      "Private tours of Georgia — from the 1.8-million-year-old footsteps of Dmanisi to the wine valleys of Kakheti and the towers of Svaneti. Three ways to travel, one unforgettable country.",
    path: "index.html",
    body,
    bodyClass: "page-home",
    headerTheme: "ink",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "TravelAgency",
      name: config.brand,
      description: config.tagline,
      ...(config.siteUrl ? { url: config.siteUrl } : {}),
      ...(config.email ? { email: config.email } : {}),
      ...(config.phone ? { telephone: config.phone } : {}),
      areaServed: { "@type": "Country", name: "Georgia" },
      address: { "@type": "PostalAddress", addressLocality: "Tbilisi", addressCountry: "GE" },
    },
  });
}
