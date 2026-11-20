import { layout } from "../lib/layout.mjs";
import { designPage, finish, esc, join, ARROW } from "../lib/site.mjs";
import { ARTICLES, REVIEWED } from "../data/guide.mjs";

const words = (a) => [a.intro, ...a.body.flatMap(([h, ps]) => [h, ...ps])].join(" ").replace(/<[^>]+>/g, "").split(/\s+/).length;
const minutes = (a) => Math.max(2, Math.round(words(a) / 200));
const meta = (a) => `<span>${minutes(a)} min read</span><span>Last reviewed ${REVIEWED}</span>`;

export function guidePage() {
  const root = designPage("travel-guide");
  const bySlug = (title) => ARTICLES.find((a) => a.card === title.replace(/\s+/g, " ").trim());
  // Featured article and the cards point at real articles.
  const feat = root.querySelector("#tg-feat");
  const fa = bySlug(feat.querySelector("h2").text);
  feat.setAttribute("href", `guide/${fa.slug}.html`);
  feat.querySelector(".tg-meta").set_content(meta(fa));
  root.querySelectorAll(".tg-card").forEach((card) => {
    const a = bySlug(card.querySelector("h3").text);
    if (!a) return card.closest("li").remove();
    card.setAttribute("href", `guide/${a.slug}.html`);
    card.querySelector(".tg-meta").set_content(meta(a));
  });
  root.querySelector("#tg-n").set_content(String(root.querySelectorAll(".tg-card").length));
  return layout({
    page: "guide/index.html",
    title: "Travel guide: before you fly",
    description: "Visas, airports, seasons, money, SIM cards, safety and how a Georgian supra works — practical answers before your trip to Georgia.",
    main: finish(root),
    scripts: ["guide.js"],
  });
}

export function articlePage(a) {
  const guide = designPage("travel-guide");
  const art = guide.querySelector(".tg-hero .pg-art")?.toString() || "";
  const card = guide.querySelectorAll(".tg-card").find((c) => c.querySelector("h3")?.text.trim() === a.card);
  const icon = card?.querySelector(".tg-ic")?.toString() || "";
  const related = ARTICLES.filter((x) => x.slug !== a.slug && x.cat === a.cat).concat(ARTICLES.filter((x) => x.slug !== a.slug && x.cat !== a.cat)).slice(0, 3);
  const main = `<main id="main" class="ga">
<section class="pg-hero ga-hero" aria-labelledby="pg-h">${art}
  <div class="wrap ga-hero-in">
    <nav class="tr-crumbs" aria-label="Breadcrumb"><a href="travel-guide.html">Travel Guide</a><span aria-hidden="true">/</span><span>${esc(a.cat)}</span></nav>
    ${icon}
    <h1 id="pg-h">${esc(a.card)}</h1>
    <p class="lede">${esc(a.intro)}</p>
    <p class="tg-meta">${meta(a)}</p>
  </div>
</section>
<article class="wrap ga-body">${join(a.body, ([h, ps]) => `${h ? `<h2>${esc(h)}</h2>` : ""}${join(ps, (p) => `<p>${p}</p>`)}`)}
  <p class="ga-help">Something not covered here? <a href="contact.html">Ask us</a> — a real person answers within 24 hours on weekdays.</p>
</article>
<section class="pg-sec tint" aria-labelledby="rel-h">
  <div class="wrap">
    <div class="pg-head"><p class="eyebrow">Travel Guide</p><h2 id="rel-h" class="h2">Keep reading</h2></div>
    <ul class="tg-grid ga-rel">${join(related, (r) => `<li><a class="tg-card" href="guide/${r.slug}.html"><span class="cat">${esc(r.cat)}</span><h3>${esc(r.card)}</h3><p>${esc(r.intro)}</p><span class="tg-meta">${meta(r)}</span></a></li>`)}</ul>
    <p class="ga-all"><a class="btn-out" href="travel-guide.html">All articles ${ARROW}</a></p>
  </div>
</section>
</main>`;
  return layout({
    page: `guide/${a.slug}.html`,
    title: a.card,
    description: a.intro,
    main: finish(main),
  });
}
