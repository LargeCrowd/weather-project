// Generic SVG polar-coordinate / annular-sector geometry helpers - no
// weather/calendar-specific logic, safe to reuse from any layout.

// Point on a circle at `angleDeg`, measured clockwise from straight up
// (0 = 12 o'clock, 90 = 3 o'clock, 180 = 6 o'clock, 270 = 9 o'clock) -
// the convention the ribbon's angles are written in.
function polarPoint(cx, cy, r, angleDeg) {
  const rad = (Math.PI / 180) * angleDeg;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// Path for a "fan blade": the region between two concentric arcs
// (innerR/outerR) and two radii (startAngle/endAngle) - a slice of an
// annulus, tapered at both ends since its straight edges point at the
// shared center rather than running parallel.
function annularSectorPath(cx, cy, innerR, outerR, startAngle, endAngle) {
  const outerStart = polarPoint(cx, cy, outerR, startAngle);
  const outerEnd = polarPoint(cx, cy, outerR, endAngle);
  const innerEnd = polarPoint(cx, cy, innerR, endAngle);
  const innerStart = polarPoint(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

// A fan-blade path inset by a constant distance on all four sides - true
// perpendicular offset, not annularSectorPath's shared-center rotation
// (which makes the two straight edges fan out from the same point,
// so the gap between two nested annularSectorPaths isn't constant width).
// The arcs offset the simple way (concentric, radius -+ inset); each
// straight edge is offset to an actual parallel line, found by moving
// perpendicular to that edge before walking back out along it - since
// that perpendicular offset and the walk-out distance are then the two
// legs of a right triangle against the target radius, the walk-out
// distance is sqrt(radius^2 - inset^2) (Pythagoras).
function insetAnnularSectorPath(cx, cy, innerR, outerR, startAngle, endAngle, inset) {
  const outerR2 = outerR - inset;
  const innerR2 = innerR + inset;
  const walkOuter = Math.sqrt(Math.max(outerR2 * outerR2 - inset * inset, 0));
  const walkInner = Math.sqrt(Math.max(innerR2 * innerR2 - inset * inset, 0));

  // normalSign +1/-1 picks which way (toward the sector's interior) the
  // edge at this angle gets nudged before walking out along it.
  const cornerAt = (angleDeg, normalSign, walk) => {
    const rad = (Math.PI / 180) * angleDeg;
    const nx = Math.cos(rad) * normalSign;
    const ny = Math.sin(rad) * normalSign;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    return { x: cx + inset * nx + walk * dx, y: cy + inset * ny + walk * dy };
  };

  const outerStart = cornerAt(startAngle, 1, walkOuter);
  const innerStart = cornerAt(startAngle, 1, walkInner);
  const outerEnd = cornerAt(endAngle, -1, walkOuter);
  const innerEnd = cornerAt(endAngle, -1, walkInner);
  const largeArc = endAngle - startAngle - (2 * inset) / ((innerR2 + outerR2) / 2) > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR2} ${outerR2} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR2} ${innerR2} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

module.exports = { polarPoint, annularSectorPath, insetAnnularSectorPath };
