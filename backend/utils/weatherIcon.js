// Line-art weather icons. Default colors (black stroke, white fill) suit the
// 1-bit mono e-ink pack; pass `colors` (from colorPalette.SPECTRA6_HEX) to
// accent them for the 6-color Spectra panel instead.
// Matched against NEA forecast text since it's free-form ("Thundery Showers",
// "Partly Cloudy (Day)", etc.) rather than a fixed enum.
const DEFAULT_COLORS = { outline: 'black', fill: 'white', accent: 'black' };

function weatherIcon(forecastText = '', colors = DEFAULT_COLORS) {
  const text = forecastText.toLowerCase();
  const c = { ...DEFAULT_COLORS, ...colors };

  if (text.includes('thundery')) return thunderIcon(c);
  if (text.includes('rain') || text.includes('shower')) return rainIcon(c);
  if (text.includes('haz') || text.includes('mist') || text.includes('fog')) return hazeIcon(c);
  if (text.includes('cloud') || text.includes('overcast')) return cloudIcon(c);
  return sunIcon(c);
}

function cloudPath(c) {
  return `<path d="M30 55 a20 20 0 0 1 0 -40 a25 25 0 0 1 48 -6 a18 18 0 0 1 2 46 z"
    fill="${c.fill}" stroke="${c.outline}" stroke-width="4"/>`;
}

function sunIcon(c) {
  return `<g>
    <circle cx="60" cy="55" r="26" fill="${c.accent}" stroke="${c.outline}" stroke-width="4"/>
    <g stroke="${c.outline}" stroke-width="4" stroke-linecap="round">
      <line x1="60" y1="5" x2="60" y2="18"/>
      <line x1="60" y1="92" x2="60" y2="105"/>
      <line x1="10" y1="55" x2="23" y2="55"/>
      <line x1="97" y1="55" x2="110" y2="55"/>
      <line x1="25" y1="20" x2="34" y2="29"/>
      <line x1="86" y1="81" x2="95" y2="90"/>
      <line x1="95" y1="20" x2="86" y2="29"/>
      <line x1="34" y1="81" x2="25" y2="90"/>
    </g>
  </g>`;
}

function cloudIcon(c) {
  return `<g>${cloudPath(c)}</g>`;
}

function rainIcon(c) {
  return `<g>
    ${cloudPath(c)}
    <g stroke="${c.accent}" stroke-width="4" stroke-linecap="round">
      <line x1="40" y1="70" x2="34" y2="90"/>
      <line x1="60" y1="70" x2="54" y2="90"/>
      <line x1="80" y1="70" x2="74" y2="90"/>
    </g>
  </g>`;
}

function thunderIcon(c) {
  return `<g>
    ${cloudPath(c)}
    <polygon points="66,66 50,92 62,92 54,112 78,82 65,82" fill="${c.accent}" stroke="${c.accent}" stroke-width="2"/>
  </g>`;
}

function hazeIcon(c) {
  return `<g>
    ${cloudPath(c)}
    <g stroke="${c.outline}" stroke-width="4" stroke-linecap="round">
      <line x1="25" y1="72" x2="95" y2="72"/>
      <line x1="20" y1="84" x2="90" y2="84"/>
      <line x1="30" y1="96" x2="100" y2="96"/>
    </g>
  </g>`;
}

module.exports = { weatherIcon };
