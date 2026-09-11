const { weatherIcon } = require('./weatherIcon');
const { SPECTRA6_HEX, SPECTRA6_PALETTE } = require('./colorPalette');
const { getZodiacOpaqueImage } = require('./stippleWatermark');

// Color variant of the tear-away calendar, laid out in portrait for the
// Seeed 13.3" Spectra 6 panel (1200x1600, 6-color: black/white/red/yellow/
// blue/green). Same content and structure as the mono 800x480 layout in
// generateSVG.js, reflowed for the taller portrait canvas with color accents.
async function generateSVGColor({ weather, calendar, lang = 'en' }) {
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
  ${renderWeatherGrid(weather, WIDTH, HEIGHT, timeString, lang)}
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

// Cell labels. Pollutant abbreviations (PSI/PM2.5/PM10/O3/SO2/CO/NO2) are
// used as-is in Chinese-language weather reports too, so those aren't
// translated - only the descriptive labels are.
const GRID_LABELS = {
  en: {
    high: 'HIGH', low: 'LOW', feelsLike: 'FEELS LIKE', humidity: 'HUMIDITY',
    liveTemp: 'LIVE TEMP', liveHumidity: 'LIVE HUMIDITY', rainfall: 'RAINFALL', uv: 'UV INDEX',
    windDir: 'WIND DIR', windSpd: 'WIND SPD', liveWindDir: 'LIVE WIND DIR', liveWindSpd: 'LIVE WIND SPD',
    updated: 'UPDATED',
  },
  zh: {
    high: '最高', low: '最低', feelsLike: '体感', humidity: '湿度',
    liveTemp: '现时气温', liveHumidity: '现时湿度', rainfall: '降雨量', uv: '紫外线',
    windDir: '风向', windSpd: '风速', liveWindDir: '现时风向', liveWindSpd: '现时风速',
    updated: '更新时间',
  },
};

// The almanac-style bordered box: a compact icon+forecast strip over a
// dense 4x5 grid packing in every NEA data point this project fetches
// (today's forecast range, live station readings, full pollutant
// breakdown, UV), with a smaller reserved strip at the bottom for bus
// timings later.
function renderWeatherGrid(weather, width, height, timeString, lang = 'en') {
  const L = GRID_LABELS[lang] || GRID_LABELS.en;
  const {
    forecastText,
    tempHigh, tempLow, humidityHigh, humidityLow, windDirection, windSpeedLow, windSpeedHigh,
    feelsLike,
    liveTempLow, liveTempHigh, liveHumidityLow, liveHumidityHigh,
    liveRainfallMax, liveWindDirection, liveWindSpeedLow, liveWindSpeedHigh,
    uvIndex,
    psiLow, psiHigh, pm25Low, pm25High, pm10Low, pm10High,
    o3Low, o3High, so2Low, so2High, coLow, coHigh, no2Low, no2High,
  } = weather;

  const boxLeft = 70;
  const boxRight = width - 70;
  const outerTop = 1000;
  const outerBottom = 1580;
  // Weather gets the bulk of the box; a smaller strip at the bottom stays
  // reserved (empty) for bus timings.
  const contentBottom = outerTop + (outerBottom - outerTop) * 0.75;

  const iconStripBottom = outerTop + 90;
  const gridTop = iconStripBottom;
  const gridBottom = contentBottom;
  const rowHeight = (gridBottom - gridTop) / 5;

  const colWidth = (boxRight - boxLeft) / 4;
  const col0 = boxLeft + colWidth * 0.5;
  const col1 = boxLeft + colWidth * 1.5;
  const col2 = boxLeft + colWidth * 2.5;
  const col3 = boxLeft + colWidth * 3.5;
  const cols = [col0, col1, col2, col3];

  const rowBoundary = (i) => gridTop + rowHeight * i;

  // NEA/US EPA-style bands: flag anything past the "Moderate"/"Unhealthy"
  // threshold in red. Where I don't have a confident published breakpoint
  // (O3/SO2/CO/NO2), the value is just shown without a warning color.
  const psiColor = psiHigh > 100 ? SPECTRA6_HEX.red : SPECTRA6_HEX.black;
  const pm25Color = pm25High > 55 ? SPECTRA6_HEX.red : SPECTRA6_HEX.black;
  const pm10Color = pm10High > 254 ? SPECTRA6_HEX.red : SPECTRA6_HEX.black;
  const uvColor = uvIndex >= 8 ? SPECTRA6_HEX.red : SPECTRA6_HEX.black;
  const rainColor = liveRainfallMax > 0 ? SPECTRA6_HEX.blue : SPECTRA6_HEX.black;

  const iconColors = weatherIconColors(forecastText);

  // Row definitions: [ [label, value, color], x4 ] - forecast summary, live
  // conditions, wind (forecast vs live), air quality part 1, part 2.
  const rows = [
    [
      [L.high, `${tempHigh}°`, SPECTRA6_HEX.red],
      [L.low, `${tempLow}°`, SPECTRA6_HEX.blue],
      [L.feelsLike, `${feelsLike}°`, SPECTRA6_HEX.black],
      [L.humidity, `${humidityLow}–${humidityHigh}%`, SPECTRA6_HEX.black],
    ],
    [
      [L.liveTemp, `${liveTempLow.toFixed(1)}–${liveTempHigh.toFixed(1)}°`, SPECTRA6_HEX.black],
      [L.liveHumidity, `${liveHumidityLow.toFixed(0)}–${liveHumidityHigh.toFixed(0)}%`, SPECTRA6_HEX.black],
      [L.rainfall, `${liveRainfallMax.toFixed(1)}mm`, rainColor],
      [L.uv, `${uvIndex}`, uvColor],
    ],
    [
      [L.windDir, windDirection, SPECTRA6_HEX.black],
      [L.windSpd, `${windSpeedLow}–${windSpeedHigh}km/h`, SPECTRA6_HEX.black],
      [L.liveWindDir, liveWindDirection, SPECTRA6_HEX.black],
      [L.liveWindSpd, `${liveWindSpeedLow.toFixed(0)}–${liveWindSpeedHigh.toFixed(0)}km/h`, SPECTRA6_HEX.black],
    ],
    [
      ['PSI', `${psiLow}–${psiHigh}`, psiColor],
      ['PM2.5', `${pm25Low}–${pm25High}`, pm25Color],
      ['PM10', `${pm10Low}–${pm10High}`, pm10Color],
      ['O3', `${o3Low}–${o3High}`, SPECTRA6_HEX.black],
    ],
    [
      ['SO2', `${so2Low}–${so2High}`, SPECTRA6_HEX.black],
      ['CO', `${coLow}–${coHigh}`, SPECTRA6_HEX.black],
      ['NO2', `${no2Low}–${no2High}`, SPECTRA6_HEX.black],
      [L.updated, timeString, SPECTRA6_HEX.black],
    ],
  ];

  const gridLines = [];
  for (let i = 1; i < 5; i++) {
    const y = rowBoundary(i);
    gridLines.push(`<line x1="${boxLeft}" y1="${y}" x2="${boxRight}" y2="${y}" stroke="${SPECTRA6_HEX.black}" stroke-width="1"/>`);
  }
  for (let i = 1; i < 4; i++) {
    const x = boxLeft + colWidth * i;
    gridLines.push(`<line x1="${x}" y1="${gridTop}" x2="${x}" y2="${gridBottom}" stroke="${SPECTRA6_HEX.black}" stroke-width="1"/>`);
  }

  const cells = rows
    .map((row, r) => row.map(([label, value, color], c) => statCell(cols[c], rowBoundary(r), rowBoundary(r + 1), label, value, color, { labelSize: 15, valueSize: 22 })).join(''))
    .join('');

  return `<g>
    <rect x="${boxLeft}" y="${outerTop}" width="${boxRight - boxLeft}" height="${outerBottom - outerTop}"
      fill="${SPECTRA6_HEX.white}" stroke="${SPECTRA6_HEX.black}" stroke-width="3"/>
    <line x1="${boxLeft}" y1="${iconStripBottom}" x2="${boxRight}" y2="${iconStripBottom}" stroke="${SPECTRA6_HEX.black}" stroke-width="2"/>
    <line x1="${boxLeft}" y1="${contentBottom}" x2="${boxRight}" y2="${contentBottom}" stroke="${SPECTRA6_HEX.black}" stroke-width="2.5"/>
    <rect x="${boxLeft}" y="${gridTop}" width="${boxRight - boxLeft}" height="${gridBottom - gridTop}" fill="none" stroke="${SPECTRA6_HEX.black}" stroke-width="2"/>
    ${gridLines.join('')}

    <g transform="translate(150, ${outerTop + 12}) scale(0.55)">
      ${weatherIcon(forecastText, iconColors)}
    </g>
    ${wrappedText(forecastText, { x: 650, y: outerTop + 55, maxCharsPerLine: 26, lineHeight: 30, fontSize: 30, fontWeight: 700, fill: SPECTRA6_HEX.black })}

    ${cells}
  </g>`;
}

function statCell(centerX, top, bottom, label, value, valueColor, { labelSize = 32, valueSize = 36 } = {}) {
  const labelY = top + (bottom - top) / 2 - 10;
  const valueY = top + (bottom - top) / 2 + 20;
  return `<text x="${centerX}" y="${labelY}" font-size="${labelSize}" font-weight="500"
      letter-spacing="0.5"
      font-family="Optima, 'Kaiti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" fill="${SPECTRA6_HEX.black}" text-anchor="middle">${escapeXml(label)}</text>
    <text x="${centerX}" y="${valueY}" font-size="${valueSize}" font-weight="700"
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
