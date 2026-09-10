const { weatherIcon } = require('./weatherIcon');
const { SPECTRA6_HEX, SPECTRA6_PALETTE } = require('./colorPalette');
const { getZodiacOpaqueImage } = require('./stippleWatermark');

// Color variant of the tear-away calendar, laid out in portrait for the
// Seeed 13.3" Spectra 6 panel (1200x1600, 6-color: black/white/red/yellow/
// blue/green). Same content and structure as the mono 800x480 layout in
// generateSVG.js, reflowed for the taller portrait canvas with color accents.
async function generateSVGColor({ weather, calendar }) {
  const WIDTH = 1200;
  const HEIGHT = 1600;
  // No physical clip-bar graphic (removed - risked burn-in on the e-ink
  // panel, being a solid black shape redrawn in the same spot every
  // refresh); this is now just the top margin the rest of the layout
  // measures from.
  const TOP_MARGIN = 90;

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const dayAccent = getDayAccentColor(calendar);
  // Centered directly behind the year in the header (matches renderHeader's
  // "2026" position: x=100, baseline y=TOP_MARGIN+78, roughly 100-300 wide).
  const watermark = await renderZodiacWatermark(calendar.zodiac, 200, TOP_MARGIN + 50, 250);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${SPECTRA6_HEX.white}" stroke="${SPECTRA6_HEX.black}" stroke-width="3"/>

  ${watermark}
  ${renderHeader(calendar, WIDTH, TOP_MARGIN)}
  ${renderDayNumber(calendar.day, WIDTH, dayAccent)}
  ${renderDateRow(calendar, WIDTH)}
  ${renderWeatherGrid(weather, WIDTH, HEIGHT, timeString)}
</svg>`;

  return svg;
}

const WATERMARK_RED = SPECTRA6_PALETTE.find((c) => c.name === 'red').rgb;

// A solid-color watermark of this year's zodiac animal (opaque, not
// dithered), centered on (centerX, centerY) behind all other content.
async function renderZodiacWatermark(zodiacChar, centerX, centerY, displaySize = 900) {
  const image = await getZodiacOpaqueImage(zodiacChar, { color: WATERMARK_RED });
  if (!image) return '';

  const x = centerX - displaySize / 2;
  const y = centerY - displaySize / 2;

  return `<image href="${image.dataUri}" x="${x}" y="${y}" width="${displaySize}" height="${displaySize}"/>`;
}

// Public holiday or Sunday -> red, Saturday -> blue, ordinary weekdays ->
// black, matching the traditional Chinese calendar convention of coloring
// weekend/holiday dates. Applied to the year, month, and day number.
function getDayAccentColor({ weekdayEnglish, isPublicHoliday }) {
  if (isPublicHoliday) return SPECTRA6_HEX.red;
  if (weekdayEnglish === 'Sunday') return SPECTRA6_HEX.red;
  if (weekdayEnglish === 'Saturday') return SPECTRA6_HEX.blue;
  return SPECTRA6_HEX.green;
}

function renderHeader(calendar, width, top) {
  const { month, year, chineseMonthLabel } = calendar;
  return `
    // Year (kept black - the watermark behind it provides the accent color now)
    <text x="100" y="${top + 78}" font-family="Optima" fill="${SPECTRA6_HEX.black}" text-anchor="start">
      <tspan font-size="80" font-weight="800" fill="${SPECTRA6_HEX.black}">${year}</tspan>
    </text>
    // Month (en) - always black; only the day number carries the accent color now
    <text x="${width / 2}" y="${top + 78}" font-family="Optima" fill="${SPECTRA6_HEX.black}" text-anchor="middle">
      <tspan font-size="80" font-weight="700" letter-spacing="3" fill="${SPECTRA6_HEX.black}">${escapeXml(month.toUpperCase())}</tspan>
    </text>
    // Month (chi)
    <text x="${width - 100}" y="${top + 78}" font-size="70" font-weight="700"
      font-family="'Kaiti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" fill="${SPECTRA6_HEX.black}" text-anchor="end">
      ${escapeXml(chineseMonthLabel)}
    </text>
    <line x1="70" y1="${top + 104}" x2="${width - 70}" y2="${top + 104}" stroke="${SPECTRA6_HEX.black}" stroke-width="3"/>
  `;
}

function renderDayNumber(day, width, accent) {
  return `<text x="${width / 2}" y="780" font-size="700" font-weight="900"
    font-family="Optima" fill="${accent}" text-anchor="middle">${day}</text>`;
}

function renderDateRow(calendar, width) {
  const { weekdayEnglish, weekdayChinese, lunarMonthDay, yearGanZhi } = calendar;
  const CJK_FONT = "'Kaiti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif";

  return `
    // Weekday (chi)
    <text x="250" y="930" font-size="65" font-weight="700"
      font-family="${CJK_FONT}" fill="${SPECTRA6_HEX.black}" text-anchor="middle">
      ${escapeXml(weekdayChinese)}
    </text>
    // Weekday (en)
    <text x="250" y="980" font-size="36" font-weight="700"
      font-family="Optima" fill="${SPECTRA6_HEX.black}" text-anchor="middle">
      ${escapeXml(weekdayEnglish.toUpperCase())}
    </text>

    // Lunar year (ganzhi)
    <text x="${width - 250}" y="930" font-size="65" font-weight="700"
      font-family="${CJK_FONT}" fill="${SPECTRA6_HEX.black}" text-anchor="middle">
      ${escapeXml(yearGanZhi)}年
    </text>
    // Lunar month/day
    <text x="${width - 250}" y="980" font-size="46"
      font-family="${CJK_FONT}" fill="${SPECTRA6_HEX.black}" text-anchor="middle">
      ${escapeXml(lunarMonthDay)}
    </text>
  `;
}

// The almanac-style bordered box: today's weather (centered icon block
// flanked by two 2x2 stat grids) squeezed into the top half, with the
// bottom half left empty - reserved for bus timings later.
function renderWeatherGrid(weather, width, height, timeString) {
  const {
    forecastText, tempHigh, tempLow, humidityHigh, humidityLow,
    windDirection, windSpeedLow, windSpeedHigh, psiLow, psiHigh, pm25Low, pm25High,
  } = weather;

  const boxLeft = 70;
  const boxRight = width - 70;
  const outerTop = 1000;
  const outerBottom = 1580;
  const contentBottom = outerTop + (outerBottom - outerTop) / 2;

  // Everything below uses the compressed top half as its working area.
  const boxTop = outerTop;
  const boxBottom = contentBottom;

  const centerWidth = 260;
  const sideWidth = (boxRight - boxLeft - centerWidth) / 2;
  const leftBoundary = boxLeft + sideWidth;
  const rightBoundary = boxRight - sideWidth;
  const midRow = boxTop + (boxBottom - boxTop) / 2;

  const leftCol1 = boxLeft + sideWidth / 4;
  const leftCol2 = boxLeft + (sideWidth * 3) / 4;
  const rightCol1 = rightBoundary + sideWidth / 4;
  const rightCol2 = rightBoundary + (sideWidth * 3) / 4;

  // NEA's PSI bands: 0-50 Good, 51-100 Moderate, 101-200 Unhealthy, 201+
  // Very Unhealthy/Hazardous - flag anything past "Moderate" in red.
  const psiColor = psiHigh > 100 ? SPECTRA6_HEX.red : SPECTRA6_HEX.black;
  // US EPA PM2.5 breakpoint for "Unhealthy" (ug/m3, 24-hour).
  const pm25Color = pm25High > 55 ? SPECTRA6_HEX.red : SPECTRA6_HEX.black;

  const iconColors = weatherIconColors(forecastText);
  const centerX = (leftBoundary + rightBoundary) / 2;

  return `<g>
    <rect x="${boxLeft}" y="${outerTop}" width="${boxRight - boxLeft}" height="${outerBottom - outerTop}"
      fill="${SPECTRA6_HEX.white}" stroke="${SPECTRA6_HEX.black}" stroke-width="3"/>
    <line x1="${boxLeft}" y1="${contentBottom}" x2="${boxRight}" y2="${contentBottom}" stroke="${SPECTRA6_HEX.black}" stroke-width="2.5"/>

    <line x1="${leftBoundary}" y1="${boxTop}" x2="${leftBoundary}" y2="${boxBottom}" stroke="${SPECTRA6_HEX.black}" stroke-width="1.5"/>
    <line x1="${rightBoundary}" y1="${boxTop}" x2="${rightBoundary}" y2="${boxBottom}" stroke="${SPECTRA6_HEX.black}" stroke-width="1.5"/>
    <line x1="${boxLeft}" y1="${midRow}" x2="${leftBoundary}" y2="${midRow}" stroke="${SPECTRA6_HEX.black}" stroke-width="1.5"/>
    <line x1="${boxLeft + sideWidth / 2}" y1="${boxTop}" x2="${boxLeft + sideWidth / 2}" y2="${boxBottom}" stroke="${SPECTRA6_HEX.black}" stroke-width="1.5"/>
    <line x1="${rightBoundary}" y1="${midRow}" x2="${boxRight}" y2="${midRow}" stroke="${SPECTRA6_HEX.black}" stroke-width="1.5"/>
    <line x1="${rightBoundary + sideWidth / 2}" y1="${boxTop}" x2="${rightBoundary + sideWidth / 2}" y2="${boxBottom}" stroke="${SPECTRA6_HEX.black}" stroke-width="1.5"/>

    <g transform="translate(${centerX - 36}, ${midRow - 90}) scale(0.6)">
      ${weatherIcon(forecastText, iconColors)}
    </g>
    ${wrappedText(forecastText, { x: centerX, y: midRow + 30, maxCharsPerLine: 14, lineHeight: 34, fontSize: 36, fontWeight: 700, fill: SPECTRA6_HEX.black })}

    ${statCell(leftCol1, boxTop, midRow, 'HIGH', `${tempHigh}°`, SPECTRA6_HEX.red)}
    ${statCell(leftCol2, boxTop, midRow, 'LOW', `${tempLow}°`, SPECTRA6_HEX.blue)}
    ${statCell(leftCol1, midRow, boxBottom, 'WIND SPD', `${windSpeedLow}–${windSpeedHigh}km/h`, SPECTRA6_HEX.black)}
    ${statCell(leftCol2, midRow, boxBottom, 'WIND DIR', windDirection, SPECTRA6_HEX.black)}

    ${statCell(rightCol1, boxTop, midRow, 'PSI', `${psiLow}–${psiHigh}`, psiColor)}
    ${statCell(rightCol2, boxTop, midRow, 'PM2.5', `${pm25Low}–${pm25High}`, pm25Color)}
    ${statCell(rightCol1, midRow, boxBottom, 'HUMIDITY', `${humidityLow}–${humidityHigh}%`, SPECTRA6_HEX.black)}
    ${statCell(rightCol2, midRow, boxBottom, 'UPDATED', timeString, SPECTRA6_HEX.black)}
  </g>`;
}

function statCell(centerX, top, bottom, label, value, valueColor) {
  const labelY = top + (bottom - top) / 2 - 8;
  const valueY = top + (bottom - top) / 2 + 32;
  return `<text x="${centerX}" y="${labelY}" font-size="32" font-weight="500"
      letter-spacing="1"
      font-family="Optima" fill="${SPECTRA6_HEX.black}" text-anchor="middle">${escapeXml(label)}</text>
    <text x="${centerX}" y="${valueY}" font-size="36" font-weight="700"
      font-family="Optima" fill="${valueColor}" text-anchor="middle">${escapeXml(String(value))}</text>`;
}

// SVG has no real auto-wrap/reflow, so this estimates line breaks by
// character count (no font metrics available at generation time) and
// renders each resulting line as its own centered tspan.
function wrapText(text, maxCharsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

function wrappedText(text, { x, y, maxCharsPerLine, lineHeight, fontSize, fontWeight, fill }) {
  const lines = wrapText(text, maxCharsPerLine);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map((line, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<text font-size="${fontSize}" font-weight="${fontWeight}"
    font-family="Optima" fill="${fill}" text-anchor="middle">${tspans}</text>`;
}

// Picks accent colors for the weather icon from the 6-color palette: yellow
// sun, blue rain/cloud/haze, yellow lightning bolt.
function weatherIconColors(forecastText) {
  const text = forecastText.toLowerCase();
  const outline = SPECTRA6_HEX.black;
  const fill = SPECTRA6_HEX.white;

  if (text.includes('thundery')) return { outline, fill, accent: SPECTRA6_HEX.yellow };
  if (text.includes('rain') || text.includes('shower')) return { outline, fill, accent: SPECTRA6_HEX.blue };
  if (text.includes('haz') || text.includes('mist') || text.includes('fog')) return { outline, fill, accent: SPECTRA6_HEX.black };
  if (text.includes('cloud') || text.includes('overcast')) return { outline, fill, accent: SPECTRA6_HEX.black };
  return { outline, fill, accent: SPECTRA6_HEX.yellow };
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[char]));
}

module.exports = { generateSVGColor };
