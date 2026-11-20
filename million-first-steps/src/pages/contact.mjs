import { layout, seal } from "../lib/layout.mjs";
import { designPage, finish, prepareForms, pruneChannels, esc } from "../lib/site.mjs";
import config from "../config.mjs";

export default function contactPage() {
  const root = designPage("contact");

  // Contact details from the settings; missing ones disappear.
  const info = root.querySelectorAll(".ct2-info > li");
  const [mail, tel, office, hours] = info;
  if (config.email) mail.querySelector(".rv2").setAttribute("data-v", seal(config.email));
  else mail.remove();
  if (config.phone) tel.querySelector(".rv2").setAttribute("data-v", seal(config.phone));
  else tel.remove();
  office.querySelector("address").set_content(esc(config.address));
  const hp = hours.querySelector("p");
  if (config.officeHours) hp.set_content(esc(config.officeHours));
  else hp.remove();
  hours.querySelector("small").set_content("On the road, we’re with you every day.");
  pruneChannels(root, ".ct2-logos a");
  if (!root.querySelector(".ct2-logos li")) root.querySelector(".ct2-logos")?.remove();

  // The drawn map stays; no third-party map loads (privacy). The link opens the address in Google Maps.
  root.querySelector("#lmap")?.remove();
  const open = root.querySelector(".ct2-map .open");
  open.setAttribute("href", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`);
  root.querySelector(".ct2-map .fallback").setAttribute("aria-hidden", "true");

  // Thank-you note: honest reply time.
  prepareForms(root);

  return layout({
    page: "contact.html",
    title: "Contact",
    description: "A question about Georgia, a trip or anything else? Send us a message or plan a custom trip — a real person answers within 24 hours on weekdays.",
    main: finish(root),
    scripts: ["request.js", "contact.js"],
  });
}
