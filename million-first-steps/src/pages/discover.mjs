import { layout } from "../lib/layout.mjs";
import { designPage, finish, esc } from "../lib/site.mjs";
import { ERAS } from "../data/history.mjs";
import { TOURS } from "../data/tours.mjs";

export default function discoverPage() {
  const root = designPage("discover-georgia");

  // "Walk it on …" links lead to the tour that visits each era's places.
  const eras = root.querySelectorAll(".tl-list > li.era");
  eras.forEach((li, i) => {
    const tour = TOURS.find((t) => t.id === ERAS[i]?.tour);
    const go = li.querySelector(".era-go");
    if (!go) return;
    if (!tour) return go.remove();
    go.setAttribute("href", `tours/${tour.id}.html`);
    go.querySelector("b").set_content(esc(tour.name));
  });

  return layout({
    page: "discover-georgia.html",
    title: "The history of Georgia",
    description: "1.8 million years in one scroll: the first Europeans, the first wine, the Golden Fleece, an alphabet like no other — and a hospitality that survived everything.",
    main: finish(root),
    scripts: ["discover.js"],
  });
}
