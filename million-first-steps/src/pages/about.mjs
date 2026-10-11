import { layout } from "../lib/layout.mjs";
import { icon } from "../lib/icons.mjs";
import { join, words } from "../lib/html.mjs";
import { pageHero, sectionHead, btn, footprints } from "../lib/components.mjs";

const VALUES = [
  ["people", "Private, always", "No coaches, no strangers. Every journey is just you and the people you came with — and us."],
  ["heart", "Hosts, not handlers", "We travel the way Georgians host: generously, personally, and with far too much food."],
  ["leaf", "Fair to the places we visit", "We work with family guesthouses, local winemakers and village cooks, and pay them properly."],
  ["shield", "Honest from the start", "Clear prices, no hidden extras, and no invented reviews. We'd rather earn our first ones."],
  ["compass", "Real journeys", "Routes we've driven ourselves, in every season, with time to stop when something is beautiful."],
  ["mountains", "Leave no trace", "Mountains, monasteries and villages should look the same after we've gone. Better, if we can help."],
];

export default function aboutPage() {
  const body = `
${pageHero({
  sceneName: "kakheti",
  ka: "ჩვენ შესახებ",
  kicker: "About us",
  title: "A father and a son.<br><em>One country to share.</em>",
  lead: "Million First Steps is a small, family-run Georgian travel company. We plan every journey ourselves, and we treat every traveller as a guest at our own table.",
  crumbs: [{ label: "About us" }],
})}

<section class="section name-story" aria-label="Our name">
  <div class="container name-story__grid">
    <div class="name-story__num" aria-hidden="true" data-reveal>1,000,001</div>
    <div>
      <p class="eyebrow">Why "Million First Steps"?</p>
      <h2 class="h2" data-split>Because the first steps<br><em>were taken here.</em></h2>
      <p class="lead" data-reveal>About 1.8 million years ago, early humans walked out of Africa and into the hills of what is now Georgia. Their bones, found at Dmanisi, are the oldest human fossils ever discovered outside Africa.</p>
      <p data-reveal>Since then, Georgia has been crossed by traders on the Silk Road, Greek sailors chasing a golden fleece, saints, poets and armies — a million footsteps, give or take. We think yours should be the next one. The million-and-first.</p>
    </div>
  </div>
  ${footprints(12, "name-story__trail")}
</section>

<section class="section section--dark story" aria-label="Our story">
  <div class="container">
    <p class="scrub-text scrub-text--xl" data-scrub-words>${words(
      "One of us has spent a lifetime on Georgia's roads and knows which village bakery is still warm at dawn. The other grew up being dragged along — and now can't stop showing the country off to anyone who will listen."
    )}</p>
    <div class="story__grid">
      <article data-reveal><h3 class="h4">The father</h3><p>Knows the roads, the winemakers and the stories behind every church. Has an opinion about the best khinkali in every valley — and he's usually right.</p></article>
      <article data-reveal><h3 class="h4">The son</h3><p>Plans the journeys, answers your messages, and makes sure the details — from dietary needs to an extra day in the mountains — are exactly right.</p></article>
    </div>
  </div>
</section>

<section class="section values" aria-label="What we believe">
  <div class="container">
    ${sectionHead({ kicker: "What we believe", title: "How we travel<br><em>— and how we don't.</em>" })}
    <div class="values__grid">
      ${join(VALUES, ([ico, t, d], i) => `<article class="value" data-reveal style="--d:${(i % 3) * 0.08}s"><span class="value__icon">${icon(ico)}</span><h3>${t}</h3><p>${d}</p></article>`)}
    </div>
  </div>
</section>

<section class="section section--paper promise" aria-label="Our promise">
  <div class="container promise__inner" data-reveal>
    <p class="eyebrow">A promise from a new company</p>
    <h2 class="h2">We're new. We won't pretend otherwise.</h2>
    <p class="lead">You won't find five hundred glowing reviews on this page — we haven't earned them yet, and we would never invent them. What we can promise: a reply from a real person within a day, honest advice even when it means a smaller booking, and a journey we'd be proud to take our own family on.</p>
    ${btn("contact.html", "Be one of our first travellers")}
  </div>
</section>`;

  return layout({
    title: "About us",
    description: "Million First Steps is a family-run Georgian travel company — a father and son planning private journeys through Georgia.",
    path: "about.html",
    body,
    bodyClass: "page-about",
    headerTheme: "ink",
  });
}
