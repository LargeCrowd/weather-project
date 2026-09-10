// Layout stub - adapted from bus_where's generateSVG.js pattern (build an SVG string
// sized for the 800x480 e-ink panel, stamp a last-updated time in the corner).
// TODO: replace the placeholder panels below once we settle on the weather/calendar data shape.
function generateSVG({ weather, calendar }) {
  const WIDTH = 800;
  const HEIGHT = 480;
  const PADDING = 20;

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="white" stroke="black" stroke-width="2"/>

  <!-- Left panel: today's calendar -->
  <text x="${PADDING}" y="40" font-size="24" font-weight="bold" fill="black">Today</text>

  <!-- Right panel: weather forecast -->
  <line x1="${WIDTH / 2}" y1="0" x2="${WIDTH / 2}" y2="${HEIGHT}" stroke="black" stroke-width="1"/>
  <text x="${WIDTH / 2 + PADDING}" y="40" font-size="24" font-weight="bold" fill="black">Weather</text>

  <text x="${WIDTH - 15}" y="${HEIGHT - 15}" font-size="20" font-family="Arial" fill="black" text-anchor="end">
    Updated: ${timeString}
  </text>
  </svg>`;

  return svgContent;
}

module.exports = { generateSVG };
