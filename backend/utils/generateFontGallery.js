// Dev-only tool: renders a sample of the day number + header text in a set of
// candidate fonts, stacked in one image, so fonts can be compared visually
// without editing generateSVGColor.js and reloading one at a time.
const CANDIDATE_FONTS = [
  'Arial Black',
  'Arial Rounded MT Bold',
  'Helvetica Neue',
  'Avenir Next Heavy',
  'Avenir Black',
  'Futura',
  'Gill Sans',
  'DIN Alternate',
  'DIN Condensed',
  'Optima',
  'Rockwell',
  'Impact',
  'American Typewriter',
  'Baskerville',
  'Big Caslon',
  'Charter Black',
];

// macOS's built-in Simplified Chinese fonts - a mix of modern sans (PingFang/
// Heiti/Yuanti), traditional serif/Ming (Songti), and calligraphic/brush
// styles (Kaiti, Xingkai, Weibei, Libian) that read more like a real almanac.
const CJK_CANDIDATE_FONTS = [
  'PingFang SC',
  'Heiti SC',
  'Songti SC',
  'STSong',
  'Kaiti SC',
  'STKaiti',
  'Yuanti SC',
  'Xingkai SC',
  'Weibei SC',
  'Libian SC',
  'Lantinghei SC',
  'HanziPen SC',
];

function generateFontGallerySVG(fonts = CANDIDATE_FONTS, bigSample = '10', lineSample = 'SEPTEMBER 2026') {
  const WIDTH = 1200;
  const ROW_HEIGHT = 220;
  const HEIGHT = ROW_HEIGHT * fonts.length + 40;

  const rows = fonts
    .map((font, i) => {
      const y = 40 + i * ROW_HEIGHT;
      return `
        <line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="#ddd" stroke-width="1"/>
        <text x="30" y="${y + 30}" font-size="20" font-family="Arial" fill="#888">${font}</text>
        <text x="30" y="${y + 150}" font-size="150" font-weight="900" font-family="${font}" fill="black">${bigSample}</text>
        <text x="320" y="${y + 130}" font-size="40" font-weight="700" font-family="${font}" fill="black">${lineSample}</text>
      `;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>
  ${rows}
</svg>`;
}

module.exports = { generateFontGallerySVG, CANDIDATE_FONTS, CJK_CANDIDATE_FONTS };
