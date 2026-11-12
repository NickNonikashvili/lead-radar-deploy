'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PALETTE, nextPaletteColor } = require('../src/palette');

/** Import public/js/constants.js (a dependency-free ES module; the package itself is CommonJS). */
async function frontendConstants() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'constants.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
}

test('the server palette is the same as the frontend SWATCHES, in the same order', async () => {
  const { SWATCHES } = await frontendConstants();
  assert.deepEqual([...PALETTE], SWATCHES.map((s) => s.value));
  for (const c of PALETTE) assert.match(c, /^#[0-9a-f]{6}$/, 'lower-case #rrggbb, as requireColor stores it');
});

test('nextPaletteColor picks the first unused colour, then cycles by least use', () => {
  assert.equal(nextPaletteColor([]), PALETTE[0]);
  assert.equal(nextPaletteColor(undefined), PALETTE[0]);
  assert.equal(nextPaletteColor([PALETTE[0]]), PALETTE[1]);
  assert.equal(nextPaletteColor([PALETTE[0], PALETTE[2]]), PALETTE[1], 'gaps are filled first');
  assert.equal(nextPaletteColor([PALETTE[0].toUpperCase()]), PALETTE[1], 'case-insensitive');
  assert.equal(nextPaletteColor(['#123456', null, 'nope']), PALETTE[0], 'custom colours take no palette slot');

  // All used once: start again from the first; then the next one, and so on.
  const all = [...PALETTE];
  assert.equal(nextPaletteColor(all), PALETTE[0]);
  assert.equal(nextPaletteColor([...all, PALETTE[0]]), PALETTE[1]);
  assert.equal(nextPaletteColor([...all, PALETTE[0], PALETTE[1]]), PALETTE[2]);
  // A colour freed up by a deleted account is reused before any colour is used a third time.
  assert.equal(nextPaletteColor([...all.filter((c) => c !== PALETTE[5]), ...all]), PALETTE[5]);
});
