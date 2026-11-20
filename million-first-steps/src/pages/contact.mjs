import { layout, liveReveal, liveText } from "../lib/layout.mjs";
import { designPage, finish, prepareForms, markChannels } from "../lib/site.mjs";
import config from "../config.mjs";

export default function contactPage() {
  const root = designPage("contact");

  // Contact details from the settings. Missing ones are built hidden, so the admin panel can switch them on.
  const info = root.querySelectorAll(".ct2-info > li");
  const [mail, tel, office, hours] = info;
  liveReveal(mail, mail.querySelector(".rv2"), "email", config.email);
  liveReveal(tel, tel.querySelector(".rv2"), "phone", config.phone);
  const addr = office.querySelector("address");
  liveText(office, addr, "address", config.address);
  const hp = hours.querySelector("p");
  liveText(hp, hp, "officeHours", config.officeHours);
  hours.querySelector("small").set_content("On the road, we’re with you every day.");
  markChannels(root, ".ct2-logos a", ".ct2-logos");

  // The drawn map stays; no third-party map loads (privacy). The link opens the address in Google Maps.
  root.querySelector("#lmap")?.remove();
  const open = root.querySelector(".ct2-map .open");
  open.setAttribute("href", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`);
  open.setAttribute("data-live-map", "");
  root.querySelector(".ct2-map .fallback").setAttribute("aria-hidden", "true");

  // The phone's country code goes with the request (the home form names it the same way).
  root.querySelector(".tel2 select")?.setAttribute("name", "country_code");
  prepareForms(root);

  return layout({
    page: "contact.html",
    title: "Contact",
    description: "A question about Georgia, a trip or anything else? Send us a message or plan a custom trip — a real person answers within 24 hours on weekdays.",
    main: finish(root),
    scripts: ["request.js", "contact.js"],
  });
}
