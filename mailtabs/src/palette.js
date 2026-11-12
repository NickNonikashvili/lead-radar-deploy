'use strict';

/**
 * The colour palette for accounts. These values are copied from SWATCHES in
 * public/js/constants.js (test/palette.test.js checks that both lists stay the same).
 */

const PALETTE = Object.freeze(['#4f46e5', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed']);

/**
 * The first palette colour that none of `usedColors` has. When every colour is taken, the one
 * used least often is picked (palette order breaks ties), so new accounts cycle through the palette.
 */
function nextPaletteColor(usedColors) {
  const counts = new Map(PALETTE.map((c) => [c, 0]));
  for (const c of usedColors || []) {
    const key = String(c || '').toLowerCase();
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }
  let best = PALETTE[0];
  for (const c of PALETTE) if (counts.get(c) < counts.get(best)) best = c;
  return best;
}

module.exports = { PALETTE, nextPaletteColor };
