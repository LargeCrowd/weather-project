const { weatherIcon, weatherIconColors } = require('./weatherIcon');
const { SPECTRA6_HEX, SPECTRA6_PALETTE } = require('./colorPalette');
const { getZodiacOpaqueImage } = require('./stippleWatermark');
const { translateForecastText } = require('./weatherTranslations');
const { polarPoint, annularSectorPath, insetAnnularSectorPath } = require('./svgGeometry');
const { escapeXml, wrappedText, verticalText } = require('./svgTextHelpers');
const { createGridPositioner } = require('./gridPositioner');
const {
  GRID_LABELS, UV_LEVEL_LABELS, AQI_LEVEL_LABELS, MOON_PHASE_LABELS,
} = require('./gridLayout');

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
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${SPECTRA6_HEX.white}" stroke="${dayAccent}" stroke-width="3"/>

  ${watermark}
  ${renderHeader(calendar, WIDTH, TOP_MARGIN, dayAccent)}
  ${renderCouplets(calendar.couplet, WIDTH)}
  ${renderDayNumber(calendar.day, WIDTH, dayAccent)}
  ${renderSolarTermRibbon(calendar.ribbonText, WIDTH, dayAccent)}
  ${renderDateRow(calendar, WIDTH, dayAccent)}
  ${renderInfoBoard(weather, WIDTH, dayAccent, lang, timeString)}
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

function renderHeader(calendar, width, top, accent) {
  const { month, year, chineseMonthLabel } = calendar;
  return `
    // Year (always black - the watermark behind it already carries the accent color)
    <text x="100" y="${top + 78}" font-family="Optima" fill="${SPECTRA6_HEX.black}" text-anchor="start">
      <tspan font-size="80" font-weight="800" fill="${SPECTRA6_HEX.black}">${year}</tspan>
    </text>
    // Month (en) - accent-colored, matching the day accent (green/blue/red)
    <text x="${width / 2}" y="${top + 78}" font-family="Optima" fill="${accent}" text-anchor="middle">
      <tspan font-size="80" font-weight="700" letter-spacing="3" fill="${accent}">${escapeXml(month.toUpperCase())}</tspan>
    </text>
    // Month (chi)
    <text x="${width - 100}" y="${top + 78}" font-size="70" font-weight="700"
      font-family="'Lantinghei SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" fill="${accent}" text-anchor="end">
      ${escapeXml(chineseMonthLabel)}
    </text>
    <line x1="70" y1="${top + 104}" x2="${width - 70}" y2="${top + 104}" stroke="${accent}" stroke-width="3"/>`;
}

function renderDayNumber(day, width, accent) {
  return `<text x="${width / 2}" y="780" font-size="700" font-weight="900"
    font-family="Optima" fill="${accent}" text-anchor="middle">${day}</text>`;
}

function renderDateRow(calendar, width, accent) {
  const { weekdayEnglish, weekdayChinese, lunarDay, lunarMonth, lunarMonthSize, yearGanZhi } = calendar;
  const FAT_CJK_FONT = "'Yuanti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif";
  const CJK_FONT = "'Yuanti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif";

  return `
    // Weekday (chi) - accent-colored, matching the day accent
    <text x="250" y="980" font-size="75" font-weight="800"
      font-family="${FAT_CJK_FONT}" fill="${accent}" text-anchor="middle">
      ${escapeXml(weekdayChinese)}
    </text>
    // Weekday (en)
    <text x="250" y="1030" font-size="36" font-weight="700"
      font-family="Optima" fill="${accent}" text-anchor="middle">
      ${escapeXml(weekdayEnglish.toUpperCase())}
    </text>

    // Lunar day - accent-colored, mirroring the weekday text on the left
    <text x="${width - 250}" y="980" font-size="75" font-weight="800"
      font-family="${FAT_CJK_FONT}" fill="${accent}" text-anchor="middle">
      ${escapeXml(lunarDay)}
    </text>
    // Ganzhi year + lunar month + size (大/小) - only the year pillar, not
    // the month/day ganzhi (BaZi-style pillars), to avoid any fengshui/
    // astrology association.
    <text x="${width - 250}" y="1030" font-size="36" font-weight="500"
      font-family="${CJK_FONT}" fill="${accent}" text-anchor="middle">
      ${escapeXml(yearGanZhi)}年  ${escapeXml(lunarMonth)}月${escapeXml(lunarMonthSize)}
    </text>
  `;
}

// The vertical scripture couplet (对联) flanking the big day number - one
// line per side, read top-to-bottom, matching where a real tear-away
// calendar prints its daily poem. Sits in the margin strip between the
// header underline and the date row.
//
// TOTAL_HEIGHT is fixed regardless of couplet length: each side's font
// size/line height is solved backwards from its own character count so a
// short couplet (fewer, bigger characters) and a long one (more, smaller
// characters) both fill the same vertical span, rather than a short one
// looking small and lost in the middle. MAX_FONT_SIZE stops a very short
// couplet from blowing up too large. TOTAL_HEIGHT here matches the old
// fixed LINE_HEIGHT(53) * (17-char max - 1), so the longest couplet looks
// the same as before and everything shorter now fills out to match it.
//
// Each column is anchored to a fixed padding from its own page edge
// (text-anchor start/end, not centered) so that as font size changes
// day-to-day, the outer edge (toward the page margin) stays put and only
// the inner edge (toward the day number) moves - keeping a consistent
// margin instead of the whole column drifting outward when it's large.
function renderCouplets(couplet, width) {
  const CJK_FONT = "'Xingkai SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif";
  const REF_FONT = "'Weibei SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif";
  // Bounded by the actual clear space on the page: the header underline
  // sits at ~y=194, and the date row's big text (font-size 75, y=980)
  // starts around y=926 - so ~700px between them, centered at ~560, is
  // as tall as any couplet (long or short) can safely stretch to.
  const TOTAL_HEIGHT = 600;
  const FONT_TO_LINE_HEIGHT_RATIO = 46 / 53;
  const MAX_FONT_SIZE = 100;
  const CENTER_Y = 585;
  const MARGIN_X = 80;

  const sizeFor = (text) => {
    const charCount = Array.from(text).length;
    const lineHeight = TOTAL_HEIGHT / Math.max(charCount - 1, 1);
    const fontSize = Math.min(lineHeight * FONT_TO_LINE_HEIGHT_RATIO, MAX_FONT_SIZE);
    return { lineHeight, fontSize };
  };

  const shared = { centerY: CENTER_Y, fill: SPECTRA6_HEX.black, fontFamily: CJK_FONT };
  const leftStyle = sizeFor(couplet.left);

  // The verse reference (e.g. "箴言 3:5") - one couplet has one reference
  // (not per side), rendered as its own small vertical column (same
  // top-to-bottom stack as the couplets) just inside the left couplet's
  // text, bottom-aligned with it: the left couplet's bottom is always at
  // CENTER_Y + TOTAL_HEIGHT/2 regardless of its length (see sizeFor), so
  // the reference's centerY is solved backwards to land its own last
  // character at that same fixed bottom.
  const REF_FONT_SIZE = 30;
  const REF_LINE_HEIGHT = 30;
  const REF_GAP = 12;
  const refCharCount = Array.from(couplet.ref).length;
  const refBottomY = CENTER_Y + TOTAL_HEIGHT / 2;
  const refCenterY = refBottomY - ((refCharCount - 1) * REF_LINE_HEIGHT) / 2;
  const refX = MARGIN_X - REF_GAP;

  return `
    ${verticalText(couplet.right, { x: width - MARGIN_X, ...shared, ...sizeFor(couplet.right), anchor: 'end' })}
    ${verticalText(couplet.left, { x: MARGIN_X, ...shared, ...leftStyle, anchor: 'start' })}
    ${verticalText(couplet.ref, {
      x: refX, centerY: refCenterY, fontSize: REF_FONT_SIZE, lineHeight: REF_LINE_HEIGHT,
      fontWeight: 500, fill: SPECTRA6_HEX.black, fontFamily: REF_FONT, anchor: 'end',
    })}
  `;
}

// The solar-term ribbon: a shallow fan-shaped band (an annular sector)
// dipping below its own center point, sitting in the gap between the big
// day number and the weekday/ganzhi row. All the geometry is named here
// so it's easy to hand-tune - nudge the angles for a deeper/shallower dip,
// the radii for a thicker/thinner band, or cy for how high it sits.
function renderSolarTermRibbon(solarTerm, width, accent) {
  const cx = width / 2;
  const cy = 1375;
  const outerR = 510;
  const innerR = 350;
  const startAngle = -20;
  const endAngle = 20;

  const path = annularSectorPath(cx, cy, innerR, outerR, startAngle, endAngle);
  const mid = polarPoint(cx, cy, (innerR + outerR) / 2, (startAngle + endAngle) / 2);

  // A second, thinner sector inset from the main border by a constant
  // distance on all sides - a decorative double-line frame.
  const BORDER_INSET = 10;
  const innerBorderPath = insetAnnularSectorPath(cx, cy, innerR, outerR, startAngle, endAngle, BORDER_INSET);

  // Scale the text to a consistent target width regardless of character
  // count, so a 2-character solar term reads noticeably bigger than a
  // 4-character scripture phrase rather than both using the same size.
  // CHAR_WIDTH_FACTOR is a rough CJK glyph-width-to-font-size ratio;
  // MAX_FONT_SIZE keeps very short text from overflowing the band's
  // radial thickness (outerR - innerR).
  const TARGET_TEXT_WIDTH = 255;
  const CHAR_WIDTH_FACTOR = 0.9;
  const MAX_FONT_SIZE = 130;
  const fontSize = Math.min(TARGET_TEXT_WIDTH / (solarTerm.length * CHAR_WIDTH_FACTOR), MAX_FONT_SIZE);

  return `
    <path d="${path}" fill="${SPECTRA6_HEX.white}" stroke="${accent}" stroke-width="4"/>
    <path d="${innerBorderPath}" fill="none" stroke="${accent}" stroke-width="1.5"/>
    <text x="${mid.x}" y="${mid.y + fontSize * 0.38}" font-size="${fontSize}" font-weight="700"
      font-family="'Weibei SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" fill="${SPECTRA6_HEX.black}" text-anchor="middle">
      ${escapeXml(solarTerm)}
    </text>
  `;
}

// The full weather/air-quality/astronomy/MRT/traffic/bus board, built on
// gridPositioner.js's grid helper - a direct implementation of a hand-drawn
// mockup (symmetric layout: forecast tiles left, live tiles right; a
// bus-stop table flanking a weather icon in the middle; traffic entries
// wrapping around a central astronomy/MRT column at the bottom).
//
// This replaces the earlier config-driven GRID_ROWS/buildGridFields grid -
// that system assumed a uniform, freely-reorderable table, which doesn't
// fit a layout this specific about where each thing sits. Rearranging
// content now means editing this function directly, same as every other
// hand-composed section on this page (header, couplets, ribbon).
//
// Column zones: a narrow LEFT tile column (3 sub-columns), a wide MIDDLE
// column, a narrow RIGHT tile column (3 sub-columns, mirrored). The MIDDLE
// column itself subdivides differently per row band: 8 equal columns for
// the air-quality rows, or [bus stop 1 / weather icon / bus stop 2] for
// every row below that (kept aligned across bands by reusing the same
// weighted split throughout).
//
// Row bands, top to bottom:
//   0 title            - "FORECAST" / air-quality headers / "LIVE"
//   1 label+air-values - tile labels (high/low/humidity, temp/feels/humidity) + air-quality values
//   2 value+bus-titles - tile values + bus stop names + forecast text (tall row, for the banner text)
//   3 label2+bus-headers - tile labels (uv/wind dir/speed) + bus service numbers + weather icon
//   4 value2+bus-arrival - tile values + next bus arrival per service
//   5-8 traffic+astronomy - one expressway entry in each of 4 positions per row, astronomy/MRT in the middle
function renderInfoBoard(weather, width, accent, lang, timeString) {
  const L = GRID_LABELS[lang] || GRID_LABELS.en;
  const {
    forecastText, tempHigh, tempLow, humidityHigh, humidityLow, windDirection, windSpeedLow, windSpeedHigh,
    avgTemp, liveHumidityLow, liveHumidityHigh, liveRainfallMax, liveWindDirection,
    liveWindSpeedLow, liveWindSpeedHigh, feelsLike, uvIndex, uvLevelKey, psiLevelKey,
    psiLow, psiHigh, pm25Low, pm25High, pm10Low, pm10High, o3Low, o3High, so2Low, so2High, coLow, coHigh, no2Low, no2High,
    sunrise, sunset, moonPhaseKey, mrtHealth, trafficRows, busStops,
  } = weather;

  const boxLeft = 70;
  const boxRight = width - 70;
  const TOP = 1050;
  const BOTTOM = 1550;
  const CJK_FONT = "'Yuanti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif";

  // The whole board's type scale, grouped by which part of the board each
  // size belongs to (top to bottom, left to right) so it's easy to find
  // what to tune. Sized up from the original pass (11-20px), which read too
  // small at normal viewing distance for a display this size.
  const FONT = {
    // Row 0 section banners: "全日预报" / "现时气象".
    bannerTitle: 28,

    // Air-quality block: the "空气品质" stacked title, the PSI/PM2.5/etc
    // column headers, and their values below.
    aqiTitle: 24,
    aqiHeader: 20,
    aqiValue: 18,

    // Forecast (left) / live (right) tiles: labels shared by both label
    // rows, then values split by how much width each needs - big for
    // single short numbers (temp/feels-like/live temp), medium for short
    // strings with room to spare (%-ranges, wind direction, rainfall),
    // narrow for the longer combined wind-speed range string. UV gets its
    // own size since "N (level)" didn't read well sharing tileValueNarrow.
    tileLabel: 24,
    tileValueBig: 18,
    tileValueMed: 18,
    tileValueNarrow: 15,
    uvValue: 20,

    // Bus stop table: the stop-name badge, the service-number header, and
    // the stacked upcoming-arrival minutes below it.
    busBadge: 18,
    busHeader: 21,
    busArrival: 20,

    // The weather description text under the icon (e.g. "多云").
    weatherCaption: 28,

    // Expressway traffic rows and the astronomy/MRT column between them.
    trafficLabel: 18,
    trafficValue: 18,
    astroMrt: 20,

    // Corner "updated at" timestamp.
    timestamp: 15,
  };

  const psiColor = psiLevelKey === 'good' ? SPECTRA6_HEX.green : psiLevelKey === 'moderate' ? SPECTRA6_HEX.yellow : SPECTRA6_HEX.red;
  const uvColor = uvLevelKey === 'low' ? SPECTRA6_HEX.green : uvLevelKey === 'moderate' ? SPECTRA6_HEX.yellow : SPECTRA6_HEX.red;
  const pm25Color = pm25High > 55 ? SPECTRA6_HEX.red : pm25High > 25 ? SPECTRA6_HEX.yellow : SPECTRA6_HEX.green;
  const pm10Color = pm10High > 254 ? SPECTRA6_HEX.red : pm10High > 100 ? SPECTRA6_HEX.yellow : SPECTRA6_HEX.green;
  const rainColor = liveRainfallMax > 0 ? SPECTRA6_HEX.blue : SPECTRA6_HEX.black;
  const mrtColor = mrtHealth.normal ? SPECTRA6_HEX.green : SPECTRA6_HEX.red;
  const mrtStatusText = mrtHealth.normal
    ? (lang === 'zh' ? '正常' : 'Normal')
    : `${lang === 'zh' ? '受影响' : 'Disrupted'}-${mrtHealth.affectedLines.join(', ')}`;

  // All 9 rows equal weight - row 2 no longer needs to be taller than its
  // neighbors (that extra height used to be reserved for the bus-stop-name
  // titles, which now render as a small badge instead of a full-height row
  // cell - see stopLabelBadge below).
  const grid = createGridPositioner({
    x: boxLeft, y: TOP, width: boxRight - boxLeft, height: BOTTOM - TOP,
    columns: [2.2, 6, 2.2],
    rows: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  });
  const [leftX, midX, rightStart, rightEnd] = grid.colLines;
  const leftWidth = midX - leftX;
  const midWidth = rightStart - midX;
  const rightWidth = rightEnd - rightStart;

  const leftCols = equalCols(leftX, leftWidth, 3);
  const rightCols = equalCols(rightStart, rightWidth, 3);
  // 9 equal columns: a tall "AIR QUALITY" title (column 0, spans rows 0-1 -
  // no header/value split of its own) + 8 header/value column pairs
  // (rating, PSI, PM2.5, PM10, CO, SO2, NO2, O3).
  const airCols = equalCols(midX, midWidth, 9);
  // Bus stop 1 / weather icon / bus stop 2 - reused for every row band from
  // the bus-title row down through the traffic rows, so everything in the
  // middle column stays vertically aligned. The icon column is weighted
  // wider than a plain even split since it's the visual centerpiece.
  const [stop1X, iconX, stop2X, stop2End] = weightedCols(midX, midWidth, [3.5, 4, 3.5]);
  const stop1Width = iconX - stop1X;
  const iconWidth = stop2X - iconX;
  const stop2Width = stop2End - stop2X;
  const stop1BusCols = equalCols(stop1X, stop1Width, Math.max(busStops[0].arrivals.length, 1));
  const stop2BusCols = equalCols(stop2X, stop2Width, Math.max(busStops[1].arrivals.length, 1));

  // The 4 traffic-entry columns (left tile, bus1, bus2, right tile) should
  // all match width - the bus1/icon/bus2 split above is sized for the bus
  // table + weather icon, not for symmetric traffic columns, so the
  // traffic+astronomy rows get their own independent split of the same
  // midWidth: bus1/bus2 matched exactly to the outer tile columns, with
  // whatever's left over going to the astronomy column in the middle.
  const trafficStop1Width = leftWidth;
  const trafficStop2Width = rightWidth;
  const trafficIconWidth = midWidth - trafficStop1Width - trafficStop2Width;
  const trafficStop1X = midX;
  const trafficIconX = trafficStop1X + trafficStop1Width;
  const trafficStop2X = trafficIconX + trafficIconWidth;

  const zoneRect = (x, w, r) => ({ x, y: grid.rowLines[r], width: w, height: grid.rowLines[r + 1] - grid.rowLines[r] });

  // The air-quality VALUES row (row 1) and the bus-badge/forecast row (row
  // 2) share the boundary the tile columns use (grid.rowLines[2]) by
  // default - but that split is independent for the middle zone, shrinking
  // the air-quality values row and giving the freed space to the bus-badge/
  // weather row below it, so the center "weather section" reads bigger.
  const [, midRow1Bottom] = weightedCols(grid.rowLines[1], grid.rowLines[3] - grid.rowLines[1], [1, 4]);

  // Within that shrunk air-quality title span (grid.rowLines[0] to
  // midRow1Bottom), the header row (PSI/PM2.5/etc labels) and the value row
  // (88-120/45-74/etc) can have their own ratio too, independent of every
  // other row0/row1 boundary on the board. Raise the first weight to grow
  // the header row, the second to grow the value row.
  const [, airHeaderBottom] = weightedCols(grid.rowLines[0], midRow1Bottom - grid.rowLines[0], [1, 0.6]);
  const airHeaderRect = (i) => (
    { x: airCols[i], y: grid.rowLines[0], width: airCols[i + 1] - airCols[i], height: airHeaderBottom - grid.rowLines[0] }
  );
  const airValueRect = (i) => (
    { x: airCols[i], y: airHeaderBottom, width: airCols[i + 1] - airCols[i], height: midRow1Bottom - airHeaderBottom }
  );
  // The forecast/live tile columns had every row the exact same height,
  // reading very uniform next to the middle section's now-varied rhythm.
  // Squish the VALUE rows (the big temp/uv/wind numbers) a bit smaller than
  // the LABEL rows above them - same label/value size contrast already
  // applied to the middle section, just biased the other way (label grows,
  // value shrinks, instead of the reverse). Raise the first weight to
  // squish values more, lower it to squish them less.
  const [, tileRow2Top] = weightedCols(grid.rowLines[1], grid.rowLines[3] - grid.rowLines[1], [1.3, 1]);
  const [, tileRow4Top] = weightedCols(grid.rowLines[3], grid.rowLines[5] - grid.rowLines[3], [1.3, 1]);
  const tileRow1Rect = (cols, i) => ({ x: cols[i], y: grid.rowLines[1], width: cols[i + 1] - cols[i], height: tileRow2Top - grid.rowLines[1] });
  const tileRow2Rect = (cols, i) => ({ x: cols[i], y: tileRow2Top, width: cols[i + 1] - cols[i], height: grid.rowLines[3] - tileRow2Top });
  const tileRow3Rect = (cols, i) => ({ x: cols[i], y: grid.rowLines[3], width: cols[i + 1] - cols[i], height: tileRow4Top - grid.rowLines[3] });
  const tileRow4Rect = (cols, i) => ({ x: cols[i], y: tileRow4Top, width: cols[i + 1] - cols[i], height: grid.rowLines[5] - tileRow4Top });

  // Row 0: title banners + a tall "AIR QUALITY" title (spanning rows 0-1,
  // column 0) + 8 air-quality column headers (columns 1-8).
  const airHeaders = [L.aqiRating, 'PSI', 'PM2.5', 'PM10', 'CO', 'SO2', 'NO2', 'O3'];
  const row0 = [
    cellText(zoneRect(leftX, leftWidth, 0), lang === 'zh' ? '全日预报' : 'FORECAST', { fontSize: FONT.bannerTitle, weight: 700, fontFamily: CJK_FONT }),
    cellText(zoneRect(rightStart, rightWidth, 0), lang === 'zh' ? '现时气象' : 'LIVE', { fontSize: FONT.bannerTitle, weight: 700, fontFamily: CJK_FONT }),
    stackedLabelCell(
      { x: airCols[0], y: grid.rowLines[0], width: airCols[1] - airCols[0], height: midRow1Bottom - grid.rowLines[0] },
      L.aqiTitle, FONT.aqiTitle, 700,
    ),
    // aqiRating (index 0, e.g. "等级") is short enough now to run a size up
    // from the other 7 pollutant-abbreviation headers (PSI/PM2.5/etc), which
    // stay narrow and need the smaller size to avoid crowding.
    ...airHeaders.map((label, i) => cellText(airHeaderRect(i + 1), label, { fontSize: i === 0 ? FONT.aqiHeader + 4 : FONT.aqiHeader, weight: 700 })),
  ].join('');

  // Row 1: tile labels (left/right) + air-quality values.
  const airValues = [
    [AQI_LEVEL_LABELS[lang][psiLevelKey], psiColor],
    [`${psiLow}-${psiHigh}`, psiColor],
    [`${pm25Low}-${pm25High}`, pm25Color],
    [`${pm10Low}-${pm10High}`, pm10Color],
    [`${coLow}-${coHigh}`, SPECTRA6_HEX.black],
    [`${so2Low}-${so2High}`, SPECTRA6_HEX.black],
    [`${no2Low}-${no2High}`, SPECTRA6_HEX.black],
    [`${o3Low}-${o3High}`, SPECTRA6_HEX.black],
  ];
  const row1 = [
    cellText(tileRow1Rect(leftCols, 0), L.high, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow1Rect(leftCols, 1), L.low, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow1Rect(leftCols, 2), L.humidity, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow1Rect(rightCols, 0), L.liveTemp, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow1Rect(rightCols, 1), L.feelsLike, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow1Rect(rightCols, 2), L.liveHumidity, { fontSize: FONT.tileLabel, weight: 700 }),
    ...airValues.map(([text, color], i) => cellText(airValueRect(i + 1), text, { fontSize: FONT.aqiValue, weight: 700, color })),
  ].join('');

  // Row 2 (tall): tile values + bus stop titles.
  const displayForecastText = lang === 'zh' ? translateForecastText(forecastText) : forecastText;

  // The bus-number/arrivals section (stop1/stop2 columns) can start higher
  // than the tile columns' row2-row3 boundary now that the badge above it
  // no longer needs the full old row2 height - pulling it up closes the gap
  // between the badge and the bus numbers. Raise the second weight to bring
  // it closer to the badge, lower it to leave more of a gap.
  const [, busSectionTop] = weightedCols(midRow1Bottom, grid.rowLines[3] - midRow1Bottom, [1, 1]);
  const busBadgeRect = (x, w) => ({ x, y: midRow1Bottom, width: w, height: busSectionTop - midRow1Bottom });

  const row2 = [
    cellText(tileRow2Rect(leftCols, 0), `${tempHigh}°`, { fontSize: FONT.tileValueBig, weight: 700, color: SPECTRA6_HEX.red }),
    cellText(tileRow2Rect(leftCols, 1), `${tempLow}°`, { fontSize: FONT.tileValueBig, weight: 700, color: SPECTRA6_HEX.blue }),
    cellText(tileRow2Rect(leftCols, 2), `${humidityLow}-${humidityHigh}%`, { fontSize: FONT.tileValueMed, weight: 700 }),
    cellText(tileRow2Rect(rightCols, 0), `${avgTemp.toFixed(1)}°`, { fontSize: FONT.tileValueBig, weight: 700 }),
    cellText(tileRow2Rect(rightCols, 1), `${feelsLike}°`, { fontSize: FONT.tileValueBig, weight: 700 }),
    cellText(tileRow2Rect(rightCols, 2), `${liveHumidityLow.toFixed(0)}-${liveHumidityHigh.toFixed(0)}%`, { fontSize: FONT.tileValueMed, weight: 700 }),
    stopLabelBadge(busBadgeRect(stop1X, stop1Width), busStops[0].label, accent, FONT.busBadge),
    stopLabelBadge(busBadgeRect(stop2X, stop2Width), busStops[1].label, accent, FONT.busBadge),
  ].join('');

  // Row 3: tile labels (uv/wind) + bus service-number headers + weather
  // icon, with the forecast text now underneath the icon instead of above
  // it - both merged into one cell (midRow1Bottom to row 5) with no
  // internal divider between them (see buildInfoBoardGridLines' r===3 case).
  const iconColors = weatherIconColors(forecastText, SPECTRA6_HEX);
  const iconZoneBottom = grid.rowLines[5];
  const [, iconTextSplit] = weightedCols(midRow1Bottom, iconZoneBottom - midRow1Bottom, [3, 1]);
  const iconTop = midRow1Bottom;
  const iconBottom = iconTextSplit;
  const iconBoxSize = Math.min(iconWidth, iconBottom - iconTop) * 2.2;
  const iconScale = iconBoxSize / 170;

  // The bus header (1 service number) and arrivals (up to 3 stacked times)
  // need a different split than a plain 50/50 row3/row4 - split just the
  // bus columns' own busSectionTop-to-row5 span independently of the tile
  // columns' rows, which keep the normal grid.rowLines[3]/[4]/[5] split.
  const [busHeaderTop, busHeaderBottom, busArrivalsBottom] = weightedCols(busSectionTop, grid.rowLines[5] - busSectionTop, [1, 2.5]);
  const busHeaderRect = (cols, i) => ({ x: cols[i], y: busHeaderTop, width: cols[i + 1] - cols[i], height: busHeaderBottom - busHeaderTop });
  const busArrivalRect = (cols, i) => ({ x: cols[i], y: busHeaderBottom, width: cols[i + 1] - cols[i], height: busArrivalsBottom - busHeaderBottom });

  const row3 = [
    cellText(tileRow3Rect(leftCols, 0), L.uv, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow3Rect(leftCols, 1), L.windDir, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow3Rect(leftCols, 2), L.windSpd, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow3Rect(rightCols, 0), L.rainfall, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow3Rect(rightCols, 1), L.liveWindDir, { fontSize: FONT.tileLabel, weight: 700 }),
    cellText(tileRow3Rect(rightCols, 2), L.liveWindSpd, { fontSize: FONT.tileLabel, weight: 700 }),
    ...busStops[0].arrivals.map((bus, i) => cellText(busHeaderRect(stop1BusCols, i), bus.serviceNo, { fontSize: FONT.busHeader, weight: 700 })),
    `<g transform="translate(${iconX + iconWidth / 2 - iconBoxSize / 2}, ${iconTop + (iconBottom - iconTop - iconBoxSize) / 2}) scale(${iconScale})">${weatherIcon(forecastText, iconColors)}</g>`,
    wrappedText(displayForecastText, {
      x: iconX + iconWidth / 2, y: (iconTextSplit + iconZoneBottom) / 2, maxCharsPerLine: lang === 'zh' ? 6 : 12, lineHeight: 16, fontSize: FONT.weatherCaption, fontWeight: 700,
      fill: SPECTRA6_HEX.black, fontFamily: lang === 'zh' ? "'Kaiti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" : 'Optima',
    }),
    ...busStops[1].arrivals.map((bus, i) => cellText(busHeaderRect(stop2BusCols, i), bus.serviceNo, { fontSize: FONT.busHeader, weight: 700 })),
  ].join('');

  // Row 4: tile values (uv/wind) + next bus arrival per service.
  const row4 = [
    cellText(tileRow4Rect(leftCols, 0), `${uvIndex} (${UV_LEVEL_LABELS[lang][uvLevelKey]})`, { fontSize: FONT.uvValue, weight: 700, color: uvColor }),
    cellText(tileRow4Rect(leftCols, 1), windDirection, { fontSize: FONT.tileValueMed, weight: 700 }),
    cellText(tileRow4Rect(leftCols, 2), `${windSpeedLow}-${windSpeedHigh}km/h`, { fontSize: FONT.tileValueNarrow, weight: 700 }),
    cellText(tileRow4Rect(rightCols, 0), `${liveRainfallMax.toFixed(1)}mm`, { fontSize: FONT.tileValueMed, weight: 700, color: rainColor }),
    cellText(tileRow4Rect(rightCols, 1), liveWindDirection, { fontSize: FONT.tileValueMed, weight: 700 }),
    cellText(tileRow4Rect(rightCols, 2), `${liveWindSpeedLow.toFixed(0)}-${liveWindSpeedHigh.toFixed(0)}km/h`, { fontSize: FONT.tileValueNarrow, weight: 700 }),
    ...busStops[0].arrivals.map((bus, i) => nextBusesCell(busArrivalRect(stop1BusCols, i), bus, 3, FONT.busArrival)),
    ...busStops[1].arrivals.map((bus, i) => nextBusesCell(busArrivalRect(stop2BusCols, i), bus, 3, FONT.busArrival)),
  ].join('');

  // Rows 5-8: one expressway entry in each of 4 positions per row (16
  // total, matching trafficRows' fixed order from trafficData.js), flanking
  // an astronomy/MRT entry in the middle column.
  const astroMrtItems = [
    [L.mrtStatus, mrtStatusText, mrtColor],
    [L.sunrise, sunrise, SPECTRA6_HEX.black],
    [L.sunset, sunset, SPECTRA6_HEX.black],
    [L.moonPhase, MOON_PHASE_LABELS[lang][moonPhaseKey], SPECTRA6_HEX.black],
  ];
  const trafficRowsSvg = [];
  for (let j = 0; j < 4; j++) {
    const r = 5 + j;
    const [t0, t1, t2, t3] = trafficRows.slice(j * 4, j * 4 + 4);
    const [label, value, color] = astroMrtItems[j];
    trafficRowsSvg.push(
      trafficCell(zoneRect(leftX, leftWidth, r), t0, FONT.trafficLabel, FONT.trafficValue),
      trafficCell(zoneRect(trafficStop1X, trafficStop1Width, r), t1, FONT.trafficLabel, FONT.trafficValue),
      labelValueLine(zoneRect(trafficIconX, trafficIconWidth, r), label, value, color, FONT.astroMrt),
      trafficCell(zoneRect(trafficStop2X, trafficStop2Width, r), t2, FONT.trafficLabel, FONT.trafficValue),
      trafficCell(zoneRect(rightStart, rightWidth, r), t3, FONT.trafficLabel, FONT.trafficValue),
    );
  }

  const gridLines = buildInfoBoardGridLines({
    accent, boxLeft, boxRight, TOP, BOTTOM, grid, midX, rightStart,
    leftCols, rightCols, airCols, stop1X, iconX, stop2X, stop1BusCols, stop2BusCols, busHeaderBottom,
    midRow1Bottom, trafficIconX, trafficStop2X, tileRow2Top, tileRow4Top, busSectionTop, airHeaderBottom,
  });

  // "Updated at" timestamp - bottom-right corner of the table, just below
  // its border rather than inside the last traffic row (which already
  // fills that corner with real content, right up against the edge).
  const timestampText = `<text x="${boxRight}" y="${BOTTOM + 18}" font-size="${FONT.timestamp}" font-family="Optima" fill="${SPECTRA6_HEX.black}" text-anchor="end">${escapeXml(L.updated)}: ${escapeXml(timeString)}</text>`;

  return `<g>
    <rect x="${boxLeft}" y="${TOP}" width="${boxRight - boxLeft}" height="${BOTTOM - TOP}" fill="${SPECTRA6_HEX.white}" stroke="${accent}" stroke-width="3"/>
    ${gridLines}
    ${row0}
    ${row1}
    ${row2}
    ${row3}
    ${row4}
    ${trafficRowsSvg.join('')}
    ${timestampText}
  </g>`;
}

// All the divider lines for renderInfoBoard, kept in one place since each
// row band uses a different column subdivision.
function buildInfoBoardGridLines({
  accent, boxLeft, boxRight, TOP, BOTTOM, grid, midX, rightStart, leftCols, rightCols, airCols, stop1X, iconX, stop2X, stop1BusCols, stop2BusCols, busHeaderBottom,
  midRow1Bottom, trafficIconX, trafficStop2X, tileRow2Top, tileRow4Top, busSectionTop, airHeaderBottom,
}) {
  const lines = [];
  const hLine = (x1, x2, y, strokeWidth) => lines.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${accent}" stroke-width="${strokeWidth}"/>`);
  // Used to inset floating dividers (bus header/arrivals split, and the
  // vertical bus-column dividers below) from the section's own outer edges.
  const FLOAT_INSET = 8;
  for (let r = 1; r < grid.rowLines.length - 1; r++) {
    const y = grid.rowLines[r];
    const strokeWidth = r === 5 ? 2 : 1;
    if (r === 1) {
      // Skip the segment under the tall "AIR QUALITY" title (column 0) - it
      // spans rows 0-1 as one cell, so no divider cuts through it here. The
      // air-quality header/value columns use their own independent boundary
      // (airHeaderBottom) instead of this row's plain one; the right tile
      // zone (LIVE banner/labels) keeps the plain boundary.
      hLine(boxLeft, airCols[0], y, strokeWidth);
      hLine(airCols[1], rightStart, airHeaderBottom, strokeWidth);
      hLine(rightStart, boxRight, y, strokeWidth);
    } else if (r === 2) {
      // Tile columns use their own independent, raised label/value boundary
      // (tileRow2Top - squishes the value row); the middle zone (air
      // values / bus badges) uses its own separate boundary (midRow1Bottom).
      hLine(boxLeft, midX, tileRow2Top, strokeWidth);
      hLine(midX, rightStart, midRow1Bottom, strokeWidth);
      hLine(rightStart, boxRight, tileRow2Top, strokeWidth);
    } else if (r === 3) {
      // Tile columns keep the plain boundary; the bus columns and the icon
      // zone both drop it entirely - no line above the service numbers, and
      // none between the icon and the forecast text underneath it (they're
      // one merged cell now, see iconTextSplit in renderInfoBoard).
      hLine(boxLeft, midX, y, strokeWidth);
      hLine(rightStart, boxRight, y, strokeWidth);
    } else if (r === 4) {
      // Tile columns use their own independent, raised label/value boundary
      // (tileRow4Top); the bus columns use their own independent header/
      // arrivals split (busHeaderBottom, inset from the zone's own left/
      // right edges so it floats like the vertical dividers below); the
      // icon zone in between has no divider at all (one tall cell).
      hLine(boxLeft, stop1X, tileRow4Top, strokeWidth);
      hLine(stop1X + FLOAT_INSET, iconX - FLOAT_INSET, busHeaderBottom, strokeWidth);
      hLine(stop2X + FLOAT_INSET, rightStart - FLOAT_INSET, busHeaderBottom, strokeWidth);
      hLine(rightStart, boxRight, tileRow4Top, strokeWidth);
    } else {
      hLine(boxLeft, boxRight, y, strokeWidth);
    }
  }
  lines.push(`<line x1="${midX}" y1="${TOP}" x2="${midX}" y2="${BOTTOM}" stroke="${accent}" stroke-width="2"/>`);
  lines.push(`<line x1="${rightStart}" y1="${TOP}" x2="${rightStart}" y2="${BOTTOM}" stroke="${accent}" stroke-width="2"/>`);
  for (const x of [leftCols[1], leftCols[2], rightCols[1], rightCols[2]]) {
    lines.push(`<line x1="${x}" y1="${grid.rowLines[1]}" x2="${x}" y2="${grid.rowLines[5]}" stroke="${accent}" stroke-width="1"/>`);
  }
  for (let i = 1; i < airCols.length - 1; i++) {
    lines.push(`<line x1="${airCols[i]}" y1="${grid.rowLines[0]}" x2="${airCols[i]}" y2="${midRow1Bottom}" stroke="${accent}" stroke-width="1"/>`);
  }
  for (const x of [iconX, stop2X]) {
    lines.push(`<line x1="${x}" y1="${midRow1Bottom}" x2="${x}" y2="${grid.rowLines[5]}" stroke="${accent}" stroke-width="1.5"/>`);
  }
  for (const x of [trafficIconX, trafficStop2X]) {
    lines.push(`<line x1="${x}" y1="${grid.rowLines[5]}" x2="${x}" y2="${BOTTOM}" stroke="${accent}" stroke-width="1.5"/>`);
  }
  // Floating dividers between bus service columns - inset from the top
  // (busSectionTop, where the bus numbers now start, raised up toward the
  // badge) and bottom (the traffic-row start line) so they read as short
  // separators between cells rather than lines flush against the section's
  // own outer borders.
  for (let i = 1; i < stop1BusCols.length - 1; i++) {
    lines.push(`<line x1="${stop1BusCols[i]}" y1="${busSectionTop + FLOAT_INSET}" x2="${stop1BusCols[i]}" y2="${grid.rowLines[5] - FLOAT_INSET}" stroke="${accent}" stroke-width="1"/>`);
  }
  for (let i = 1; i < stop2BusCols.length - 1; i++) {
    lines.push(`<line x1="${stop2BusCols[i]}" y1="${busSectionTop + FLOAT_INSET}" x2="${stop2BusCols[i]}" y2="${grid.rowLines[5] - FLOAT_INSET}" stroke="${accent}" stroke-width="1"/>`);
  }
  return lines.join('');
}

// n equal-width columns starting at x, spanning width - a thin wrapper
// around gridPositioner so column math stays consistent everywhere in
// renderInfoBoard rather than hand-computed per call site.
function equalCols(x, width, n) {
  return createGridPositioner({ x, y: 0, width, height: 1, columns: Array(n).fill(1), rows: [1] }).colLines;
}

// Columns sized by relative weight (like CSS `fr` units), e.g. [4,2,4].
function weightedCols(x, width, weights) {
  return createGridPositioner({ x, y: 0, width, height: 1, columns: weights, rows: [1] }).colLines;
}

// Centered text within a rect - the workhorse for most cells in
// renderInfoBoard. anchor 'start'/'end' aligns to the rect's own edge
// (with a small inset) instead of centering, for corner captions.
function cellText(rect, text, { fontSize = 14, weight = 500, color = SPECTRA6_HEX.black, fontFamily, anchor = 'middle' } = {}) {
  const family = fontFamily || "Optima, 'Kaiti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif";
  const inset = 6;
  const x = anchor === 'middle' ? rect.x + rect.width / 2 : anchor === 'end' ? rect.x + rect.width - inset : rect.x + inset;
  const y = rect.y + rect.height / 2 + fontSize * 0.35;
  return `<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="${weight}" font-family="${family}" fill="${color}" text-anchor="${anchor}">${escapeXml(String(text))}</text>`;
}

// A vertically-centered stack of short label lines (e.g. ['空气','品质']) -
// used for the tall "AIR QUALITY" title cell, which spans two grid rows'
// worth of height with no value row of its own.
function stackedLabelCell(rect, lines, fontSize = 14, weight = 700) {
  const cx = rect.x + rect.width / 2;
  const lineHeight = fontSize * 1.3;
  const startY = rect.y + rect.height / 2 - (lineHeight * (lines.length - 1)) / 2 + fontSize * 0.35;
  return lines.map((line, i) => (
    `<text x="${cx}" y="${startY + i * lineHeight}" font-size="${fontSize}" font-weight="${weight}" font-family="Optima, 'Kaiti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" fill="${SPECTRA6_HEX.black}" text-anchor="middle">${escapeXml(line)}</text>`
  )).join('');
}

// One "label value" line (air-quality/astronomy/MRT style) - value colored
// per severity, label always black, single <text> with two <tspan>s so the
// whole label+value run centers as one unit.
// Label on its own line above the (colored, bold) value, rather than one
// run of "label value" - the astronomy/MRT column got squeezed narrower to
// match the traffic columns' width (see trafficIconWidth), and a combined
// English line like "MOON PHASE Waxing Crescent" no longer fits in one row;
// splitting the two keeps each within the column on its own.
function labelValueLine(rect, label, value, color, fontSize) {
  const cx = rect.x + rect.width / 2;
  const labelY = rect.y + rect.height * 0.42;
  const valueY = rect.y + rect.height * 0.75;
  const family = "Optima, 'Kaiti SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif";
  return `<text x="${cx}" y="${labelY}" font-size="${fontSize - 2}" font-weight="700" font-family="${family}" fill="${SPECTRA6_HEX.black}" text-anchor="middle">${escapeXml(label)}</text>
    <text x="${cx}" y="${valueY}" font-size="${fontSize}" font-weight="700" font-family="${family}" fill="${color}" text-anchor="middle">${escapeXml(String(value))}</text>`;
}

// LTA's TrafficIncidents `Type` field is a small fixed enum (Accident, Road
// Block, Vehicle Breakdown, Fire, Flash Flood, Heavy Traffic, Obstacle,
// Road Works, Diversion, Unattended Vehicle, Weather, Miscellaneous) - most
// are already short enough to show as-is; these are the ones that don't fit
// next to "Nmin" in a single-row cell. Convention: abbreviate the generic
// noun ("Vehicle" -> "Veh.") and drop words that don't add information once
// paired with an already-descriptive word ("Heavy Traffic" -> "Heavy",
// since every entry here IS traffic). Unmapped types pass through unchanged.
const INCIDENT_TYPE_ABBREVIATIONS = {
  'vehicle breakdown': 'V. Bdown',
  'unattended vehicle': 'Unatt. Veh.',
  'heavy traffic': 'Heavy',
  'road works': 'Rdworks',
  'road block': 'Rd Block',
  miscellaneous: 'Misc.',
};

function shortenIncidentType(type) {
  return INCIDENT_TYPE_ABBREVIATIONS[type.toLowerCase()] || type;
}

// One expressway direction: route name on the left, minutes (+ incident
// type in LTA's own wording, abbreviated if needed, if any) on the right,
// single row - black when normal, red when LTA reports an incident.
function trafficCell(rect, route, labelFontSize = 12, valueFontSize = 13) {
  const label = `${route.name}(${route.shortDest})`;
  const value = route.minutes == null ? '-' : `${route.minutes}m${route.incidentType ? ` ${shortenIncidentType(route.incidentType)}` : ''}`;
  const color = route.incidentType ? SPECTRA6_HEX.red : SPECTRA6_HEX.black;
  const inset = 6;
  const y = rect.y + rect.height / 2 + valueFontSize * 0.35;
  return `<text x="${rect.x + inset}" y="${y}" font-size="${labelFontSize}" font-weight="700" font-family="Optima" fill="${SPECTRA6_HEX.black}" text-anchor="start">${escapeXml(label)}</text>
    <text x="${rect.x + rect.width - inset}" y="${y}" font-size="${valueFontSize}" font-weight="700" font-family="Optima" fill="${color}" text-anchor="end">${escapeXml(value)}</text>`;
}

// A softly-squared, accent-filled badge (white bold text) spanning the full
// width of its cell - horizontal margin matches the vertical margin already
// above/below it (badgeHeight centered in rect leaves that gap top and
// bottom; the same gap is used as the left/right inset), so the badge reads
// as one consistently-padded block rather than a pill hugging its text.
function stopLabelBadge(rect, label, accent, fontSize = 16) {
  const badgeHeight = fontSize * 1.8;
  const cornerRadius = 8;
  const padding = (rect.height - badgeHeight) / 2;
  const bx = rect.x + padding;
  const by = rect.y + padding;
  const badgeWidth = rect.width - padding * 2;
  const cx = rect.x + rect.width / 2;
  return `<rect x="${bx}" y="${by}" width="${badgeWidth}" height="${badgeHeight}" rx="${cornerRadius}" fill="${accent}"/>
    <text x="${cx}" y="${by + badgeHeight / 2 + fontSize * 0.35}" font-size="${fontSize}" font-weight="700" font-family="Optima" fill="${SPECTRA6_HEX.white}" text-anchor="middle">${escapeXml(label)}</text>`;
}

// Up to 3 upcoming arrivals for one bus service, stacked vertically in the
// same cell, each colored by that arrival's own crowding level (LTA's Load
// field: SEA = seats available, SDA = standing available, LSD = limited
// standing/very crowded).
function nextBusesCell(rect, bus, maxCount = 3, fontSize = 15) {
  const arrivals = bus.arrivals.slice(0, maxCount);
  if (arrivals.length === 0) return cellText(rect, '-', { fontSize: 15, weight: 700 });
  const lineHeight = fontSize * 1.2;
  const cx = rect.x + rect.width / 2;
  const startY = rect.y + rect.height / 2 - (lineHeight * (arrivals.length - 1)) / 2 + fontSize * 0.35;
  return arrivals.map((arrival, i) => (
    `<text x="${cx}" y="${startY + i * lineHeight}" font-size="${fontSize}" font-weight="700" font-family="Optima" fill="${crowdColor(arrival.load)}" text-anchor="middle">${escapeXml(arrival.minutes === 0 ? 'Arr' : String(arrival.minutes))}</text>`
  )).join('');
}

function crowdColor(load) {
  if (load === 'SEA') return SPECTRA6_HEX.green;
  if (load === 'SDA') return SPECTRA6_HEX.yellow;
  if (load === 'LSD') return SPECTRA6_HEX.red;
  return SPECTRA6_HEX.black;
}

module.exports = { generateSVGColor };
