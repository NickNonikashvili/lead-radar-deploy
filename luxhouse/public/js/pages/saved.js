/* LUXHOUSE — saved residences.
   site.js fills the grid from the list kept in this browser and removes a home the moment its
   heart is cleared. This file keeps two details in step with it: the figure at the end of the
   page-head hairline, and the open place beside an odd number of saved homes. */
(() => {
  "use strict";

  const doc = document;
  const page = doc.querySelector("[data-saved-page]");
  if (!page || !("MutationObserver" in window)) return;

  const grid = page.querySelector("[data-saved-grid]");
  const empty = page.querySelector("[data-saved-empty]");
  const slotTemplate = doc.getElementById("saved-slot");
  const figure = doc.querySelector(".page--saved .page-head__label b");
  const savedSlugs = () => (window.LH && window.LH.saved ? window.LH.saved().length : 0);
  const pad = (n) => (n < 10 ? "0" : "") + n;

  const sync = () => {
    const cards = grid.querySelectorAll("[data-card]").length;
    // Before the cards arrive the list itself is the best count; an empty page counts nothing.
    if (figure) figure.textContent = pad(cards || (empty && !empty.hidden ? 0 : savedSlugs()));

    const slot = grid.querySelector("[data-saved-slot]");
    if (!cards) { if (slot) slot.remove(); return; }
    if (!slot) { if (slotTemplate && slotTemplate.content) grid.appendChild(slotTemplate.content.cloneNode(true)); return; }
    if (slot !== grid.lastElementChild) grid.appendChild(slot);
  };

  const watch = new MutationObserver(sync);
  watch.observe(grid, { childList: true });
  if (empty) watch.observe(empty, { attributes: true, attributeFilter: ["hidden"] });
  doc.addEventListener("lh:saved", sync);
  sync();
})();
