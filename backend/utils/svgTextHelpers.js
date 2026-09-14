// Generic SVG text-layout helpers (XML escaping, manual line-wrapping,
// stacked vertical CJK text) - no weather/calendar-specific logic, safe to
// reuse from any layout.

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[char]));
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

function wrappedText(text, { x, y, maxCharsPerLine, lineHeight, fontSize, fontWeight, fill, fontFamily = 'Optima' }) {
  const lines = wrapText(text, maxCharsPerLine);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map((line, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<text font-size="${fontSize}" font-weight="${fontWeight}"
    font-family="${fontFamily}" fill="${fill}" text-anchor="middle">${tspans}</text>`;
}

// One character per line, stacked top-to-bottom and centered on `centerY` -
// the traditional vertical layout for a couplet/poem column. SVG has no
// built-in vertical text flow reliable across renderers, so this just
// stacks single-character <tspan>s, the same manual-layout approach as
// wrappedText's horizontal line wrapping.
function verticalText(text, { x, centerY, fontSize, lineHeight, fontWeight = 700, fill, fontFamily, anchor = 'middle' }) {
  const chars = Array.from(text);
  const startY = centerY - ((chars.length - 1) * lineHeight) / 2;
  const tspans = chars
    .map((char, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(char)}</tspan>`)
    .join('');

  return `<text font-size="${fontSize}" font-weight="${fontWeight}"
    font-family="${fontFamily}" fill="${fill}" text-anchor="${anchor}">${tspans}</text>`;
}

module.exports = { escapeXml, wrapText, wrappedText, verticalText };
