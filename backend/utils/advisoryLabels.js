// NEA's official UV Index advisory bands.
function getUvLevelKey(uvIndex) {
  if (uvIndex >= 11) return 'extreme';
  if (uvIndex >= 8) return 'veryHigh';
  if (uvIndex >= 6) return 'high';
  if (uvIndex >= 3) return 'moderate';
  return 'low';
}

// NEA's official PSI advisory bands. Takes the region's worst (high)
// reading, same convention as the raw PSI cell's red-flag threshold.
function getPsiLevelKey(psiHigh) {
  if (psiHigh > 300) return 'hazardous';
  if (psiHigh > 200) return 'veryUnhealthy';
  if (psiHigh > 100) return 'unhealthy';
  if (psiHigh > 50) return 'moderate';
  return 'good';
}

module.exports = { getUvLevelKey, getPsiLevelKey };
