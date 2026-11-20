import { layout } from "../lib/layout.mjs";
import { designPage, finish, byText, prepareForms, pruneChannels, esc, join } from "../lib/site.mjs";
import { TOURS, STYLES } from "../data/tours.mjs";
import { TIERS } from "../data/tiers.mjs";
import { CARDS } from "../data/tour-cards.mjs";
import config from "../config.mjs";
import { channels } from "../lib/layout.mjs";

// Price per person per day across all tours, per tier: "from about €100 to €140".
function perDay(tierId) {
  const v = TOURS.map((t) => t.prices[tierId] / t.days);
  const r = (x, f) => f(x / 10) * 10;
  return [r(Math.min(...v), Math.floor), r(Math.max(...v), Math.ceil)];
}

export default function home() {
  const root = designPage("index");

  // Hero form: no copy is emailed to the visitor, so don't promise one.
  const sub = root.querySelector("#req-done .req-sub");
  sub.set_content(`Your request number is <strong id="rq-id">MFS-0000</strong>. We’ll write back within 24 hours on weekdays.`);

  // Trust strip: we're new, so the first tile speaks about the three ways to travel instead of a rating.
  const rev = root.querySelector(".tr-rev");
  rev.querySelector(".tr-tx").set_content(`<b>Three ways to travel</b><small>From family guesthouses to five-star hotels</small>`);
  rev.querySelector(".tr-tx").removeAttribute("aria-label");

  // Journeys: our three featured tours, then the card to all tours.
  const grid = root.querySelector(".jr-grid");
  const all = grid.querySelector(".jr-all").toString();
  const featured = TOURS.filter((t) => CARDS[t.id]?.featured);
  const plus = grid.querySelector(".jr-plus").toString();
  grid.set_content(
    join(featured, (t) => {
      const c = CARDS[t.id];
      return `<div class="jr" data-like="${esc(t.name)}">
          <a class="ph" href="tours/${t.id}.html" tabindex="-1" aria-hidden="true"><img src="${c.img}" alt="" loading="lazy"><span class="days">${t.days} days</span></a>
          <div class="body">
            <span class="tag">${esc(STYLES[t.styles[0]])}</span>
            <a class="t" href="tours/${t.id}.html">${esc(t.name)}</a>
            <span class="route">${c.stops.map(esc).join(" <i></i> ")}</span>
            <span class="foot"><b>From €${Math.min(...Object.values(t.prices)).toLocaleString("en-US")}</b><button type="button" class="jr-add" aria-pressed="false">${plus}<span class="a">Would like to see</span><span class="o">In your request</span></button></span>
          </div>
        </div>`;
    }) + all
  );

  // Moments: these are pictures of places, not guests' clips, so they're captioned as such.
  const side = root.querySelector(".moments .side");
  const [eyebrow, h2, p] = side.querySelectorAll("h2, p").filter((el) => !el.closest(".rev-links"));
  eyebrow.set_content("Moments");
  h2.set_content("What a day here can look like.");
  p.set_content("Places and evenings our journeys are made of. Our guests’ own photos will join them soon.");
  const where = ["Tbilisi · all year", "Gudauri · December to April", "Svaneti · June to October", "Kakheti · September and October"];
  root.querySelectorAll(".collage .vid").forEach((li, i) => {
    li.querySelector(".play")?.remove();
    const cap = li.querySelectorAll("span").at(-1);
    const b = cap.querySelector("b").toString();
    cap.set_content(`${b}${where[i] || ""}`);
  });
  root.querySelector(".collage").setAttribute("aria-label", "Moments from the road");

  // Reviews: none yet, and we won't invent any.
  const reviews = root.querySelector('section[aria-label="Traveller reviews"]');
  reviews.setAttribute("aria-label", "A promise instead of reviews");
  reviews.querySelector(".reviews").set_content(`<figure class="rev rev-promise" style="margin:0"><p>“We are new, and proud of it. You won’t find invented reviews here — just a promise to look after you like our own guests. Be one of the first travellers to walk with us.”</p><figcaption class="who">The Million First Steps team</figcaption></figure>`);

  // FAQ: the designer left our facts to fill in.
  const [w, e] = [perDay("wanderer"), perDay("explorer")];
  const g = perDay("golden-fleece");
  const answers = {
    "How much does a private trip cost?": `It depends on the days, the number of travellers and where you stay. As a guide, for two travellers sharing: about €${w[0]}–${w[1]} per person per day as a Wanderer, €${e[0]}–${e[1]} as an Explorer and €${g[0]}–${g[1]} in the Golden Fleece style. You get one final price in writing before you pay anything.`,
    "How and when do I pay?": `A deposit confirms your trip once you accept the written quote; the balance is due by the date in your quote, usually a few weeks before you arrive. Nothing is paid online through this site.`,
    "What if I need to change or cancel?": `Tell us as early as possible. Changes are usually easy; cancellation charges depend on how close to the trip you cancel and are set out in your quote and our <a href="terms.html">booking terms</a>. Plans change, and we’d rather adjust the trip than lose you.`,
    "Is Georgia safe for travellers?": `Georgia is widely regarded as a safe, welcoming country, and violent crime against visitors is rare. Check your own government’s travel advice before you go. Your guide is with you on the road, and you can reach us any time.`,
    "Which languages do you speak?": `English, Georgian and Russian. If you’d like a guide in another language, tell us in your request and we’ll do our best to find one.`,
  };
  root.querySelectorAll(".fq").forEach((d) => {
    const q = d.querySelector(".fq-q").text.trim();
    if (answers[q]) d.querySelector(".fq-a").set_content(`<p>${answers[q]}</p>`);
  });

  // Messaging channels that exist; WhatsApp button falls back to the contact page.
  pruneChannels(root, ".dusk-chips a");
  const wa = root.querySelector(".btn-wa");
  if (channels().whatsapp) wa.setAttribute("href", channels().whatsapp);
  else {
    wa.setAttribute("href", "contact.html");
    const svg = wa.querySelector("svg")?.toString() || "";
    wa.set_content(`${svg}Ask us a question`);
  }

  prepareForms(root);

  return layout({
    page: "index.html",
    title: "Private trips in Georgia",
    description: "Private and custom trips around Georgia / Sakartvelo. We plan the route, meet you at the airport and stay with you until you fly home.",
    rootClass: "fx-on",
    main: finish(root),
    scripts: ["request.js", "home.js"],
  });
}
