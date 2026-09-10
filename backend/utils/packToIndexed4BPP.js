const { nearestPaletteNibble } = require('./colorPalette');

// Packs raw RGB pixels (3 bytes/pixel, from sharp's .raw() with no alpha)
// into the indexed 4bpp format Seeed_GFX2's Panel_EPaper::pushImage4BPP
// expects: each pixel quantized to the nearest Spectra-6 palette nibble, two
// pixels per byte (even x -> high nibble, odd x -> low nibble), row stride
// ceil(width / 2) bytes.
function packToIndexed4BPP(rawRgbBuffer, width, height) {
  const stride = Math.ceil(width / 2);
  const packed = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelOffset = (y * width + x) * 3;
      const r = rawRgbBuffer[pixelOffset];
      const g = rawRgbBuffer[pixelOffset + 1];
      const b = rawRgbBuffer[pixelOffset + 2];
      const nibble = nearestPaletteNibble(r, g, b);

      const byteIndex = y * stride + (x >> 1);
      if (x & 1) {
        packed[byteIndex] |= nibble & 0x0f;
      } else {
        packed[byteIndex] |= (nibble << 4) & 0xf0;
      }
    }
  }

  return packed;
}

module.exports = { packToIndexed4BPP };
