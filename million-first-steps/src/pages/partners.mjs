import { layout, seal } from "../lib/layout.mjs";
import { designPage, finish, prepareForms } from "../lib/site.mjs";
import config from "../config.mjs";

export default function partnersPage() {
  const root = designPage("partners");
  // Partner email: the same inbox as the rest of the site.
  const rv = root.querySelector(".pf-side .rv");
  if (config.email) rv.setAttribute("data-v", seal(config.email));
  else rv.remove();
  // Spam trap like on the other forms.
  const form = root.querySelector("form.pf");
  form.insertAdjacentHTML("afterbegin", `<div class="hp" aria-hidden="true"><label>Leave this field empty<input type="text" name="website2" tabindex="-1" autocomplete="off"></label></div>`);
  form.querySelector('input[type="checkbox"]').setAttribute("name", "consent");
  prepareForms(root);
  return layout({
    page: "partners.html",
    title: "For travel partners",
    description: "Your ground partner in Georgia: private programmes, custom itineraries, transfers and licensed guides for tour operators and travel agencies.",
    main: finish(root),
    scripts: ["partners.js"],
  });
}
