// The 6-color palette for E Ink Spectra 6 panels (e.g. Seeed's 13.3" EE02
// board). Nibble values match Seeed_GFX2's TFT_EPD_* constants
// (src/core/Color.h) - the panel's driver expects exactly these indices.
// The RGB triples are visual approximations for rendering/quantization only;
// real ink is less saturated than these and can be recalibrated once you
// have the physical panel in hand.
const SPECTRA6_PALETTE = [
  { name: 'white', nibble: 0x0, rgb: [255, 255, 255] },
  { name: 'green', nibble: 0x2, rgb: [30, 130, 80] },
  { name: 'red', nibble: 0x6, rgb: [190, 40, 40] },
  { name: 'yellow', nibble: 0xb, rgb: [235, 190, 40] },
  { name: 'blue', nibble: 0xd, rgb: [30, 70, 150] },
  { name: 'black', nibble: 0xf, rgb: [0, 0, 0] },
];

function hex(rgb) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const SPECTRA6_HEX = Object.fromEntries(SPECTRA6_PALETTE.map((c) => [c.name, hex(c.rgb)]));

const BLACK = SPECTRA6_PALETTE.find((c) => c.name === 'black');
const WHITE = SPECTRA6_PALETTE.find((c) => c.name === 'white');
const CHROMATIC = SPECTRA6_PALETTE.filter((c) => c.name !== 'black' && c.name !== 'white').map((c) => ({
  ...c,
  hue: getHue(...c.rgb),
}));

// Anti-aliased edges of black text/strokes on a white background are desaturated
// grays (e.g. ~128,128,128). In plain RGB-distance terms those grays can land
// closer to our muted green/blue than to true black, because this palette's
// colors are deliberately desaturated e-ink approximations, not primaries. So
// low-chroma pixels are classified by luminance (black vs white) first, and
// only pixels with real color saturation are matched against the chromatic
// palette entries (red/yellow/blue/green).
const CHROMA_THRESHOLD = 40;

function getHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;

  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

function nearestPaletteNibble(r, g, b) {
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (chroma < CHROMA_THRESHOLD) {
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance < 128 ? BLACK.nibble : WHITE.nibble;
  }

  // Matched by hue rather than raw RGB distance: a light/anti-aliased tint
  // of a saturated color (e.g. pink, from red blending toward white) has a
  // hue close to that color's, but its RGB magnitude can otherwise land
  // numerically closer to an unrelated palette color.
  const pixelHue = getHue(r, g, b);
  let best = CHROMATIC[0];
  let bestDistance = Infinity;
  for (const color of CHROMATIC) {
    const distance = hueDistance(pixelHue, color.hue);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }
  return best.nibble;
}

module.exports = { SPECTRA6_PALETTE, SPECTRA6_HEX, nearestPaletteNibble };
