// NEA doesn't publish a "feels like" temperature, so this computes one using
// the Australian Bureau of Meteorology's Apparent Temperature formula
// (Steadman) - chosen over the more commonly-cited US NOAA heat index
// because that one is a regression fit to US conditions/imperial units and
// is documented as unreliable outside its fitted range; this formula is
// designed for humid climates like Singapore's.
function getFeelsLikeTemp(tempC, humidityPct, windSpeedKmh) {
  const windSpeedMs = windSpeedKmh / 3.6;
  const vapourPressure = (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));

  const apparentTemp = tempC + 0.33 * vapourPressure - 0.7 * windSpeedMs - 4;
  return Math.round(apparentTemp);
}

module.exports = { getFeelsLikeTemp };
