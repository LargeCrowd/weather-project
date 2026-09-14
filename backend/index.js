const express = require('express');
const axios = require('axios');
require('dotenv').config();
const sharp = require('sharp');

const app = express();
const PORT = 8080;

const allowedOrigins = [process.env.allowed_origin];

// import utility functions
const { generateSVG } = require('./utils/generateSVG');
const { packTo1Bit } = require('./utils/packTo1Bit');
const { generateSVGColor } = require('./utils/generateSVGColor');
const { packToIndexed4BPP } = require('./utils/packToIndexed4BPP');
const { getLunarInfo } = require('./utils/lunarCalendar');
const { getChineseMonthLabel } = require('./utils/chineseMonth');
const { getHolidayName } = require('./utils/publicHolidays');
const { translateHolidayName } = require('./utils/holidayNames');
const { generateFontGallerySVG, CJK_CANDIDATE_FONTS } = require('./utils/generateFontGallery');
const { getLiveStationData } = require('./utils/liveStationData');
const { getUvIndexData } = require('./utils/uvIndex');
const { getFeelsLikeTemp } = require('./utils/feelsLike');
const { cachedGet } = require('./utils/httpCache');
const { getPhraseOfTheDay } = require('./utils/scripturePhrases');
const { getCoupletOfTheDay } = require('./utils/couplets');
const { getAstronomyData } = require('./utils/astronomy');
const { getUvLevelKey, getPsiLevelKey } = require('./utils/advisoryLabels');
const { getBusArrivals, getMrtLineHealth } = require('./utils/ltaTransport');
const { getExpresswayTraffic } = require('./utils/trafficData');

// NEA's 24-hour forecast (data.gov.sg) - no API key required.
const NEA_24HR_FORECAST_URL = 'https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast';
// NEA's PSI (air quality) readings, one per region - no API key required.
const NEA_PSI_URL = 'https://api-open.data.gov.sg/v2/real-time/api/psi';
// Bus stops tracked for next-arrival timings in the weather grid, each
// labeled with its physical signboard name. Order here is left-to-right
// display order (renderBusStops in generateSVGColor.js lays them out side
// by side in this order).
const BUS_STOPS = [
  { code: '63321', label: 'Blk 627' },
  { code: '63329', label: 'opp Blk 627' },
];

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API caller is running');
});

// Fetches Singapore's general 24-hour forecast (today's high/low, humidity,
// wind and forecast text) from NEA via data.gov.sg.
async function getWeatherData() {
  const data = await cachedGet(NEA_24HR_FORECAST_URL);
  const { general } = data.data.records[0];

  return {
    forecastText: general.forecast.text,
    tempHigh: general.temperature.high,
    tempLow: general.temperature.low,
    humidityHigh: general.relativeHumidity.high,
    humidityLow: general.relativeHumidity.low,
    windDirection: general.wind.direction,
    windSpeedLow: general.wind.speed.low,
    windSpeedHigh: general.wind.speed.high,
  };
}

// Fetches every pollutant reading NEA's PSI endpoint exposes - PSI itself
// plus the five individual pollutants (PM2.5, PM10, O3, SO2, CO, NO2) that
// feed into it. All are reported per region (west/east/central/north/south)
// rather than as one nationwide number, so each takes the min/max across
// all five, same "range" treatment as humidity/wind.
async function getAirQualityData() {
  const data = await cachedGet(NEA_PSI_URL);
  const { readings } = data.data.items[0];

  const range = (field) => {
    const values = Object.values(readings[field]);
    return { low: Math.min(...values), high: Math.max(...values) };
  };

  const psi = range('psi_twenty_four_hourly');
  const pm25 = range('pm25_twenty_four_hourly');
  const pm10 = range('pm10_twenty_four_hourly');
  const o3 = range('o3_eight_hour_max');
  const so2 = range('so2_twenty_four_hourly');
  const co = range('co_eight_hour_max');
  const no2 = range('no2_one_hour_max');

  return {
    psiLow: psi.low, psiHigh: psi.high,
    pm25Low: pm25.low, pm25High: pm25.high,
    pm10Low: pm10.low, pm10High: pm10.high,
    o3Low: o3.low, o3High: o3.high,
    so2Low: so2.low, so2High: so2.high,
    coLow: co.low, coHigh: co.high,
    no2Low: no2.low, no2High: no2.high,
  };
}

// Builds the date fields (Gregorian + lunar) for the tear-away calendar
// page, anchored to Singapore time regardless of the server's own timezone.
// dayOffset=1 shifts everything to tomorrow, for the ESP32's "next day
// preview" button - note this only shifts the *calendar* (date/lunar/
// holiday); the weather/air-quality fields elsewhere in the response stay
// as today's/live readings, since NEA doesn't expose a same-detail forecast
// for a specific future day the way the 24-hour endpoint does for today.
async function getCalendarData(dayOffset = 0) {
  const now = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const monthNumFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    month: 'numeric',
  });

  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const day = Number(parts.day);
  const monthNum = Number(monthNumFormatter.format(now));

  const lunar = getLunarInfo(year, monthNum, day);
  const chineseMonthLabel = getChineseMonthLabel(year, monthNum);
  const isoDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const holidayNameEnglish = await getHolidayName(isoDate);
  const publicHoliday = !!holidayNameEnglish;
  // The ribbon under the day number: a public holiday's name takes priority
  // (rare and significant - Christmas, CNY, National Day), then the solar
  // term name on the day one begins, otherwise a scripture phrase for the
  // day (see scripturePhrases.js). A holiday and a solar term's start
  // essentially never land on the same date, but if they ever do, the
  // holiday wins.
  const ribbonText = (holidayNameEnglish && translateHolidayName(holidayNameEnglish))
    || lunar.solarTerm
    || getPhraseOfTheDay(year, monthNum, day);
  // The vertical scripture couplet flanking the big day number.
  const couplet = getCoupletOfTheDay(year, monthNum, day);

  return {
    day,
    month: parts.month,
    year,
    weekdayEnglish: parts.weekday,
    chineseMonthLabel,
    isPublicHoliday: publicHoliday,
    couplet,
    ...lunar,
    ribbonText,
  };
}

async function buildDisplayData(dayOffset = 0) {
  const [weather, airQuality, liveStation, uv, calendar, busArrivalsByStop, mrtHealth, trafficRows] = await Promise.all([
    getWeatherData(),
    getAirQualityData(),
    getLiveStationData(),
    getUvIndexData(),
    getCalendarData(dayOffset),
    Promise.all(BUS_STOPS.map((stop) => getBusArrivals(stop.code))),
    getMrtLineHealth(),
    getExpresswayTraffic(),
  ]);
  const busStops = BUS_STOPS.map((stop, i) => ({ label: stop.label, code: stop.code, arrivals: busArrivalsByStop[i] }));

  const feelsLike = getFeelsLikeTemp(liveStation.avgTemp, liveStation.avgHumidity, liveStation.avgWindSpeedKmh);
  // Sunrise/sunset/moon phase aren't NEA data - computed astronomically for
  // whichever day the calendar itself is showing (today, or tomorrow for
  // the ESP32 preview button).
  const astronomyDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  const astronomy = getAstronomyData(astronomyDate);
  const uvLevelKey = getUvLevelKey(uv.uvIndex);
  const psiLevelKey = getPsiLevelKey(airQuality.psiHigh);

  return {
    weather: {
      ...weather, ...airQuality, ...liveStation, ...uv, feelsLike, ...astronomy,
      uvLevelKey, psiLevelKey, busStops, mrtHealth, trafficRows,
    },
    calendar,
  };
}

// preview="tomorrow" is the ESP32's "next day preview" button - see the
// dayOffset note on getCalendarData for what it does and doesn't shift.
function dayOffsetFromQuery(req) {
  return req.query.preview === 'tomorrow' ? 1 : 0;
}

async function buildDisplaySVG(dayOffset = 0) {
  return generateSVG(await buildDisplayData(dayOffset));
}

async function buildDisplaySVGColor(dayOffset = 0, lang = 'en') {
  return generateSVGColor({ ...(await buildDisplayData(dayOffset)), lang });
}

// ?lang=zh switches the weather grid's cell labels to Chinese (see
// GRID_LABELS in gridLayout.js) - a dev-only comparison view, not wired up
// to the ESP32 firmware.
function langFromQuery(req) {
  return req.query.lang === 'zh' ? 'zh' : 'en';
}

// Core endpoint the ESP32 polls: builds today's calendar + weather layout as a
// 1-bit packed bitmap, matching bus_where's SVG -> sharp -> packTo1Bit pipeline.
app.get('/api/create-display-image', async (req, res) => {
  try {
    const svgContent = await buildDisplaySVG(dayOffsetFromQuery(req));

    const rawBuffer = await sharp(Buffer.from(svgContent))
      .resize(800, 480, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toColourspace('b-w')
      .raw()
      .toBuffer();

    const finalBuffer = packTo1Bit(rawBuffer);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', finalBuffer.length);
    res.send(finalBuffer);

    console.log('Sent binary bitmap to ESP32. Size:', finalBuffer.length);
  } catch (err) {
    console.error('Image generation error:', err);
    res.status(500).send('Image generation failed');
  }
});

// Dev-only preview: same layout, rendered as a plain PNG so it can be viewed
// directly in a browser instead of the ESP32's packed 1-bit format.
app.get('/api/preview', async (req, res) => {
  try {
    const svgContent = await buildDisplaySVG(dayOffsetFromQuery(req));

    const png = await sharp(Buffer.from(svgContent))
      .resize(800, 480, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    console.error('Preview generation error:', err);
    res.status(500).send('Preview generation failed');
  }
});

// Core endpoint for the 13.3" Spectra 6 color panel (Seeed EE02 board):
// builds the same layout in portrait color, packed indexed 4bpp for
// Seeed_GFX2's pushImage4BPP (1200x1600, 960,000 bytes).
app.get('/api/create-display-image-color', async (req, res) => {
  try {
    const svgContent = await buildDisplaySVGColor(dayOffsetFromQuery(req), langFromQuery(req));

    const rawBuffer = await sharp(Buffer.from(svgContent))
      .resize(1200, 1600, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .removeAlpha()
      .raw()
      .toBuffer();

    const finalBuffer = packToIndexed4BPP(rawBuffer, 1200, 1600);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', finalBuffer.length);
    res.send(finalBuffer);

    console.log('Sent color bitmap to ESP32. Size:', finalBuffer.length);
  } catch (err) {
    console.error('Color image generation error:', err);
    res.status(500).send('Image generation failed');
  }
});

// Dev-only preview of the color layout, rendered as a plain PNG.
app.get('/api/preview-color', async (req, res) => {
  try {
    const svgContent = await buildDisplaySVGColor(dayOffsetFromQuery(req), langFromQuery(req));

    const png = await sharp(Buffer.from(svgContent))
      .resize(1200, 1600, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    console.error('Color preview generation error:', err);
    res.status(500).send('Preview generation failed');
  }
});

// Dev-only: compares candidate fonts side by side (day number + header
// sample) so you can eyeball options without editing generateSVGColor.js
// and reloading one at a time. Pass ?fonts=Font%20One,Font%20Two to
// override the built-in candidate list.
app.get('/api/font-gallery', async (req, res) => {
  try {
    const fonts = req.query.fonts ? req.query.fonts.split(',') : undefined;
    const svgContent = generateFontGallerySVG(fonts);

    const png = await sharp(Buffer.from(svgContent)).png().toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    console.error('Font gallery generation error:', err);
    res.status(500).send('Font gallery generation failed');
  }
});

// Same as /api/font-gallery, for the Chinese text (weekday, lunar date,
// month label) instead of the Latin header/day number.
app.get('/api/font-gallery-cjk', async (req, res) => {
  try {
    const fonts = req.query.fonts ? req.query.fonts.split(',') : CJK_CANDIDATE_FONTS;
    const svgContent = generateFontGallerySVG(fonts, '廿九', '九月小 · 星期四 · 丙午年 属马');

    const png = await sharp(Buffer.from(svgContent)).png().toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    console.error('CJK font gallery generation error:', err);
    res.status(500).send('CJK font gallery generation failed');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
