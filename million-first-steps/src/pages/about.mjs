import { layout, seal } from "../lib/layout.mjs";
import { designPage, finish, esc } from "../lib/site.mjs";
import { TOURS } from "../data/tours.mjs";
import config from "../config.mjs";

export default function aboutPage() {
  const root = designPage("about");

  // Our story: a father and a son.
  root.querySelector(".ab-story-tx").set_content(`<p class="eyebrow">About us · Our story</p>
      <h1 id="story-h" class="h2 ab-h1">A father, a son, and a country we can’t stop showing off</h1>
      <p class="pg-p">Million First Steps is a small, family-run Georgian travel company. We plan every journey ourselves, and we treat every traveller as a guest at our own table.</p>
      <p class="pg-p">One of us has spent a lifetime on Georgia's roads and knows which village bakery is still warm at dawn. The other grew up being dragged along — and now can't stop showing the country off to anyone who will listen.</p>
      <blockquote class="ab-quote">“We think your steps should be the next ones. The million-and-first.”</blockquote>
      <p class="pg-p">About 1.8 million years ago, early humans walked out of Africa and into the hills of what is now Georgia. Their bones, found at Dmanisi, are the oldest human fossils ever discovered outside Africa. Since then, Georgia has been crossed by traders on the Silk Road, Greek sailors chasing a golden fleece, saints, poets and armies — a million footsteps, give or take.</p>`);

  // Numbers we can stand behind.
  const nums = root.querySelectorAll(".ab-nums li");
  const facts = [
    ["2026", "Founded in Tbilisi"],
    [String(TOURS.length), "Journeys, each in three travel styles"],
    ["9", "Regions of Georgia we know by heart"],
  ];
  nums.forEach((li, i) => {
    li.querySelector("b").set_content(facts[i][0]);
    li.querySelectorAll("span").at(-1).set_content(facts[i][1]);
  });
  // The number of journeys follows the tours the owners show on the website (site.js).
  nums[1]?.querySelector("b").setAttribute("data-tour-count", TOURS.map((t) => t.id).join(" "));

  // The team: names as the designer was given them; roles and photos follow.
  root.querySelectorAll(".ab-team li").forEach((li) => {
    li.querySelector(".ab-pic small")?.remove();
    const role = li.querySelector(".role");
    if (role && /\[/.test(role.text)) role.remove();
    const b = li.querySelector("b");
    b.set_content(esc(b.text.replace(/\s*\[[^\]]*\]/g, "")));
    b.setAttribute("translate", "no");
  });
  const teamLede = root.querySelector('section[aria-labelledby="team-h"] .lede');
  if (teamLede) teamLede.set_content("A few of the faces behind your trip. Everyone here was born or has lived most of their life in Georgia.");

  // Company details from the settings. Every row is built (empty ones hidden) so the admin panel can change them.
  const dl = root.querySelector(".ab-co dl");
  const rows = [
    ["Legal name", "legalName", `<span translate="no" data-live="legalName">${esc(config.legalName)}</span>`],
    ["Identification code", "registrationNumber", `<span translate="no" data-live="registrationNumber">${esc(config.registrationNumber)}</span>`],
    ["Registered address", "address", `<span data-live="address">${esc(config.address)}</span>`],
    ["Email", "email", `<span class="rv " data-k="mail" data-live="email" data-v="${config.email ? seal(config.email) : ""}"><button type="button" class="reveal">Show email</button></span>`],
    ["Office hours", "officeHours", `<span data-live="officeHours">${esc(config.officeHours)}</span>`],
  ];
  const value = { legalName: config.legalName, registrationNumber: config.registrationNumber, address: config.address, email: config.email, officeHours: config.officeHours };
  dl.set_content(rows.map(([t, k, d]) => `<div data-live-wrap${value[k] ? "" : " hidden"}><dt>${t}</dt><dd>${d}</dd></div>`).join(""));
  const co = root.querySelector('section[aria-labelledby="co-h"] .lede');
  if (co) co.set_content(config.registrationNumber ? "Million First Steps is a registered Georgian company. You’ll find the same details on your written offer and invoice." : "You’ll find our company details on your written offer and invoice.");

  return layout({
    page: "about.html",
    title: "About us",
    description: "Million First Steps is a family-run Georgian travel company — a father and son planning private journeys through Georgia.",
    main: finish(root),
  });
}
