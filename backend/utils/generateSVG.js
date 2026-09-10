const { weatherIcon } = require('./weatherIcon');

// Renders today's page of a Chinese-style tear-away desk calendar: a clip bar
// holding the pad, year/month header, a huge day number, a weekday + lunar
// date row, and - in place of the almanac's yi/ji grid - a bordered stat grid
// with today's weather. Sized for the 800x480 1-bit e-ink panel.
function generateSVG({ weather, calendar }) {
  const WIDTH = 800;
  const HEIGHT = 480;
  const CLIP_BAR_HEIGHT = 34;

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="white" stroke="black" stroke-width="2"/>

  ${renderClipBar(WIDTH, CLIP_BAR_HEIGHT)}
  ${renderHeader(calendar, WIDTH, CLIP_BAR_HEIGHT)}
  ${renderDayNumber(calendar.day, WIDTH)}
  ${renderDateRow(calendar, WIDTH)}
  ${renderWeatherGrid(weather, WIDTH, timeString)}
</svg>`;

  return svg;
}

// The pad's top binding strip, drawn as a solid bar (the clip holding it to
// the wall in the reference photo), with two rivets and a hanging loop.
function renderClipBar(width, barHeight) {
  const centerX = width / 2;
  return `<g>
    <rect x="0" y="0" width="${width}" height="${barHeight}" fill="black"/>
    <circle cx="${centerX - 300}" cy="${barHeight / 2}" r="6" fill="white"/>
    <circle cx="${centerX + 300}" cy="${barHeight / 2}" r="6" fill="white"/>
    <rect x="${centerX - 26}" y="${barHeight / 2 - 5}" width="52" height="10" rx="5" fill="white"/>
  </g>`;
}

function renderHeader(calendar, width, top) {
  const { month, year, chineseMonthLabel } = calendar;
  return `<text x="70" y="${top + 46}" font-family="Arial" fill="black" text-anchor="start">
      <tspan font-size="36" font-weight="800">${year}</tspan>
      <tspan font-size="24" font-weight="700" letter-spacing="2" dx="14">${escapeXml(month.toUpperCase())}</tspan>
    </text>
    <text x="${width - 70}" y="${top + 46}" font-size="26" font-weight="700"
      font-family="'PingFang SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" fill="black" text-anchor="end">
      ${escapeXml(chineseMonthLabel)}
    </text>
    <line x1="40" y1="${top + 62}" x2="${width - 40}" y2="${top + 62}" stroke="black" stroke-width="1.5"/>`;
}

function renderDayNumber(day, width) {
  return `<text x="${width / 2}" y="255" font-size="175" font-weight="900"
    font-family="Arial" fill="black" text-anchor="middle">${day}</text>`;
}

function renderDateRow(calendar, width) {
  const { weekdayEnglish, weekdayChinese, lunarMonthDay, yearGanZhi, zodiac } = calendar;
  return `<text x="70" y="290" font-size="26" font-weight="700"
      font-family="Arial, 'PingFang SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" fill="black" text-anchor="start">
      ${escapeXml(weekdayEnglish.toUpperCase())} &#183; ${escapeXml(weekdayChinese)}
    </text>
    <text x="${width - 70}" y="290" font-size="24"
      font-family="'PingFang SC', 'Heiti SC', 'Noto Sans CJK SC', sans-serif" fill="black" text-anchor="end">
      ${escapeXml(yearGanZhi)}年 属${escapeXml(zodiac)} &#183; ${escapeXml(lunarMonthDay)}
    </text>`;
}

// The almanac-style bordered grid: normally packed with yi/ji auspicious
// sayings, here repurposed to show today's weather as labelled stat cells.
function renderWeatherGrid(weather, width, timeString) {
  const { forecastText, tempHigh, tempLow, humidityHigh, humidityLow, windDirection, windSpeedLow, windSpeedHigh } = weather;

  const boxLeft = 40;
  const boxRight = width - 40;
  const boxTop = 320;
  const boxBottom = 460;
  const headerBottom = 372;
  const midRow = 416;

  const colWidth = (boxRight - boxLeft) / 3;
  const col1 = boxLeft + colWidth / 2;
  const col2 = boxLeft + colWidth * 1.5;
  const col3 = boxLeft + colWidth * 2.5;

  return `<g>
    <rect x="${boxLeft}" y="${boxTop}" width="${boxRight - boxLeft}" height="${boxBottom - boxTop}"
      fill="white" stroke="black" stroke-width="2"/>

    <g transform="translate(${boxLeft + 12}, ${boxTop + 6}) scale(0.42)">
      ${weatherIcon(forecastText)}
    </g>
    <text x="${boxLeft + 76}" y="${boxTop + 40}" font-size="26" font-weight="700"
      font-family="Arial" fill="black" text-anchor="start">${escapeXml(forecastText)}</text>

    <line x1="${boxLeft}" y1="${headerBottom}" x2="${boxRight}" y2="${headerBottom}" stroke="black" stroke-width="1.5"/>
    <line x1="${boxLeft + colWidth}" y1="${headerBottom}" x2="${boxLeft + colWidth}" y2="${boxBottom}" stroke="black" stroke-width="1"/>
    <line x1="${boxLeft + colWidth * 2}" y1="${headerBottom}" x2="${boxLeft + colWidth * 2}" y2="${boxBottom}" stroke="black" stroke-width="1"/>
    <line x1="${boxLeft}" y1="${midRow}" x2="${boxRight}" y2="${midRow}" stroke="black" stroke-width="1"/>

    ${statCell(col1, headerBottom, midRow, 'HIGH', `${tempHigh}°`)}
    ${statCell(col2, headerBottom, midRow, 'LOW', `${tempLow}°`)}
    ${statCell(col3, headerBottom, midRow, 'HUMIDITY', `${humidityLow}–${humidityHigh}%`)}

    ${statCell(col1, midRow, boxBottom, 'WIND DIR', windDirection)}
    ${statCell(col2, midRow, boxBottom, 'WIND SPD', `${windSpeedLow}–${windSpeedHigh}km/h`)}
    ${statCell(col3, midRow, boxBottom, 'UPDATED', timeString)}
  </g>`;
}

function statCell(centerX, top, bottom, label, value) {
  const labelY = top + (bottom - top) / 2 - 4;
  const valueY = top + (bottom - top) / 2 + 20;
  return `<text x="${centerX}" y="${labelY}" font-size="14" letter-spacing="1"
      font-family="Arial" fill="black" text-anchor="middle">${escapeXml(label)}</text>
    <text x="${centerX}" y="${valueY}" font-size="22" font-weight="700"
      font-family="Arial" fill="black" text-anchor="middle">${escapeXml(String(value))}</text>`;
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

module.exports = { generateSVG };
