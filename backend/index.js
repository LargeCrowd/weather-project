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

// TODO: call a weather API (e.g. Open-Meteo, OpenWeatherMap) for today's forecast
async function getWeatherData() {
  throw new Error('getWeatherData not implemented yet');
}

// TODO: call a calendar source (e.g. Google Calendar API, an .ics feed) for today's events
async function getCalendarData() {
  throw new Error('getCalendarData not implemented yet');
}

// Core endpoint the ESP32 polls: builds today's calendar + weather layout as a
// 1-bit packed bitmap, matching bus_where's SVG -> sharp -> packTo1Bit pipeline.
app.get('/api/create-display-image', async (req, res) => {
  try {
    const [weather, calendar] = await Promise.all([
      getWeatherData(),
      getCalendarData(),
    ]);

    const svgContent = generateSVG({ weather, calendar });

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
