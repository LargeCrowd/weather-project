const { cachedGet } = require('./httpCache');

// NEA's real-time weather station network (dozens of stations island-wide),
// as opposed to the single islandwide 24-hour forecast - these are actual
// live sensor readings, not a forecast. Each endpoint returns one value per
// station, so (like PSI/PM2.5) this reports the island-wide min/max range.
const ENDPOINTS = {
  temperature: 'https://api-open.data.gov.sg/v2/real-time/api/air-temperature',
  humidity: 'https://api-open.data.gov.sg/v2/real-time/api/relative-humidity',
  rainfall: 'https://api-open.data.gov.sg/v2/real-time/api/rainfall',
  windSpeed: 'https://api-open.data.gov.sg/v2/real-time/api/wind-speed',
  windDirection: 'https://api-open.data.gov.sg/v2/real-time/api/wind-direction',
};

const KNOTS_TO_KMH = 1.852;
const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

function degreesToCompass(deg) {
  const index = Math.round(deg / 22.5) % 16;
  return COMPASS_POINTS[index];
}

function average(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

async function fetchStationValues(url) {
  const data = await cachedGet(url);
  const reading = data.data.readings[0];
  return reading.data.map((d) => d.value);
}

async function getLiveStationData() {
  const [temps, humidities, rainfalls, windSpeedsKnots, windDirections] = await Promise.all([
    fetchStationValues(ENDPOINTS.temperature),
    fetchStationValues(ENDPOINTS.humidity),
    fetchStationValues(ENDPOINTS.rainfall),
    fetchStationValues(ENDPOINTS.windSpeed),
    fetchStationValues(ENDPOINTS.windDirection),
  ]);

  const windSpeedsKmh = windSpeedsKnots.map((v) => v * KNOTS_TO_KMH);

  return {
    liveTempLow: Math.min(...temps),
    liveTempHigh: Math.max(...temps),
    liveHumidityLow: Math.min(...humidities),
    liveHumidityHigh: Math.max(...humidities),
    // 5-minute rainfall total (mm) - the highest reporting station, since
    // "is it raining right now, and how hard" is what this is really for.
    liveRainfallMax: Math.max(...rainfalls),
    liveWindSpeedLow: Math.min(...windSpeedsKmh),
    liveWindSpeedHigh: Math.max(...windSpeedsKmh),
    liveWindDirection: degreesToCompass(average(windDirections)),
    // Averages (not the min/max range) for feeding into the apparent-
    // temperature calculation, which wants one representative reading.
    avgTemp: average(temps),
    avgHumidity: average(humidities),
    avgWindSpeedKmh: average(windSpeedsKmh),
  };
}

module.exports = { getLiveStationData };
