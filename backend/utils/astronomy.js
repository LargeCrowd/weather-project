const SunCalc = require('suncalc');

// Singapore's approximate geographic center - fine for sunrise/sunset and
// moon phase, neither of which vary meaningfully across a city this size.
const SINGAPORE_LAT = 1.3521;
const SINGAPORE_LON = 103.8198;

// SunCalc's moon phase is a continuous 0-1 fraction (0 = new moon, 0.25 =
// first quarter, 0.5 = full moon, 0.75 = last quarter, back to 1 = new
// moon) - banded here into the 8 named phases.
const MOON_PHASE_BANDS = [
  { upTo: 0.03, key: 'newMoon' },
  { upTo: 0.22, key: 'waxingCrescent' },
  { upTo: 0.28, key: 'firstQuarter' },
  { upTo: 0.47, key: 'waxingGibbous' },
  { upTo: 0.53, key: 'fullMoon' },
  { upTo: 0.72, key: 'waningGibbous' },
  { upTo: 0.78, key: 'lastQuarter' },
  { upTo: 0.97, key: 'waningCrescent' },
  { upTo: 1.01, key: 'newMoon' },
];

function getMoonPhaseKey(phase) {
  return MOON_PHASE_BANDS.find((band) => phase <= band.upTo).key;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Sunrise/sunset and moon phase for a given date - computed astronomically
// (NEA has no equivalent endpoint for these), using Singapore's
// approximate center point.
function getAstronomyData(date) {
  const times = SunCalc.getTimes(date, SINGAPORE_LAT, SINGAPORE_LON);
  const moon = SunCalc.getMoonIllumination(date);

  return {
    sunrise: formatTime(times.sunrise),
    sunset: formatTime(times.sunset),
    moonPhaseKey: getMoonPhaseKey(moon.phase),
  };
}

module.exports = { getAstronomyData };
