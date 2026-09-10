const path = require('path');
const sharp = require('sharp');

// E-ink can't render true partial opacity - packToIndexed4BPP snaps every
// pixel to one of 6 solid colors, so a faint alpha-blended watermark would
// just vanish (or turn solid). Instead this converts a bold black-on-white
// source image into a sparse grid of small solid dots: each dot is fully
// opaque black (survives quantization untouched), but at low density they
// read visually as a faint gray silhouette, the same trick halftone
// printing uses.
const ZODIAC_FILES = {
  鼠: 'rat.png',
  牛: 'ox.png',
  虎: 'tiger.png',
  兔: 'rabbit.png',
  龙: 'dragon.png',
  蛇: 'snake.png',
  马: 'horse.png',
  羊: 'goat.png',
  猴: 'monkey.png',
  鸡: 'rooster.png',
  狗: 'dog.png',
  猪: 'pig.png',
};

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'zodiac');

// Cache each zodiac's stipple pattern - the source images never change at
// runtime, so there's no need to regenerate dots on every request.
const stippleCache = new Map();

async function getZodiacStipple(zodiacChar, options = {}) {
  const {
    size = 900,
    gridSpacing = 8,
    dotRadius = 1.8,
    density = 0.35,
    darkThreshold = 128,
  } = options;

  const cacheKey = `${zodiacChar}:${size}:${gridSpacing}:${dotRadius}:${density}:${darkThreshold}`;
  if (stippleCache.has(cacheKey)) return stippleCache.get(cacheKey);

  const fileName = ZODIAC_FILES[zodiacChar];
  if (!fileName) return null;

  const imagePath = path.join(ASSETS_DIR, fileName);
  const { data, info } = await sharp(imagePath)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  let dots = '';
  // A simple linear-congruential generator gives a deterministic (repeatable
  // across requests/renders), evenly-scattered keep/skip decision per dot -
  // avoids visible repeating patterns a fixed modulo grid would create.
  let seed = 1;

  for (let y = 0; y < height; y += gridSpacing) {
    for (let x = 0; x < width; x += gridSpacing) {
      const pixel = data[y * width + x];
      if (pixel >= darkThreshold) continue; // only stipple the dark/silhouette regions

      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed / 0x7fffffff > density) continue;

      dots += `<circle cx="${x}" cy="${y}" r="${dotRadius}"/>`;
    }
  }

  const result = { dotsMarkup: dots, width, height };
  stippleCache.set(cacheKey, result);
  return result;
}

// Opaque version: recolors the source image's dark silhouette to a solid
// color with a transparent background, embedded as a base64 PNG data URI.
// Every pixel is either fully the target color or fully transparent, so
// (unlike a true alpha/opacity blend) it survives packToIndexed4BPP's
// quantizer unchanged.
const opaqueCache = new Map();

async function getZodiacOpaqueImage(zodiacChar, options = {}) {
  const { size = 500, color = [190, 40, 40], darkThreshold = 128 } = options;

  const cacheKey = `${zodiacChar}:${size}:${color.join(',')}:${darkThreshold}`;
  if (opaqueCache.has(cacheKey)) return opaqueCache.get(cacheKey);

  const fileName = ZODIAC_FILES[zodiacChar];
  if (!fileName) return null;

  const imagePath = path.join(ASSETS_DIR, fileName);
  const { data, info } = await sharp(imagePath)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const isDark = data[i] < darkThreshold;
    const o = i * 4;
    if (isDark) {
      rgba[o] = color[0];
      rgba[o + 1] = color[1];
      rgba[o + 2] = color[2];
      rgba[o + 3] = 255;
    }
    // else leave fully transparent (alpha already 0 from Buffer.alloc)
  }

  const pngBuffer = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const result = { dataUri: `data:image/png;base64,${pngBuffer.toString('base64')}`, width, height };
  opaqueCache.set(cacheKey, result);
  return result;
}

module.exports = { getZodiacStipple, getZodiacOpaqueImage, ZODIAC_FILES };
