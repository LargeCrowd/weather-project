# weather-project

An e-ink display styled like a Chinese tear-away desk calendar - a big daily page number, Gregorian and lunar date,
and today's weather. The backend supports two display targets, each with its own firmware:

- **Mono 7.5"** - XIAO ESP32-S3 + monochrome 800x480 e-paper panel (the original board, via GxEPD2).
- **Color 13.3"** - Seeed XIAO ePaper Display Board EE02 + 6-color E Ink Spectra 6 panel, 1200x1600 portrait
  (via [Seeed_GFX2](https://github.com/Seeed-Studio/Seeed_GFX2)).

Built off the display/backend pipeline from [rexyyong/bus_where](https://github.com/rexyyong/bus_where): the backend
renders an SVG, converts it to a packed bitmap, and serves it over HTTP; the ESP32 polls that endpoint, downloads
the bitmap, and draws it to its e-paper display.

## Structure

```
weather-project
├── esp32
│   ├── code.ino                     # Mono 7.5" firmware - fetch/draw/deep-sleep loop (from bus_where, unchanged)
│   └── color_13in3
│       └── code.ino                 # Color 13.3" firmware - fetch/draw/deep-sleep loop (Seeed_GFX2)
└── backend
    ├── index.js                     # Express server - fetches weather/calendar/transit data, builds and serves both bitmaps
    ├── assets/data
    │   ├── scripture_phrases.json   # 4-character phrases shown in the ribbon on non-solar-term days
    │   └── couplets.json            # Daily left/right couplet + verse reference, for the vertical columns
    └── utils
        ├── generateSVG.js           # Mono tear-away calendar + weather SVG layout (800x480 landscape)
        ├── generateSVGColor.js      # Color tear-away calendar + weather SVG layout (1200x1600 portrait) - composes
        │                            #   the sections below; see "Adjusting the layout"
        ├── gridLayout.js            # Weather grid CONFIG - which stat appears in which row/cell (color layout only)
        ├── svgGeometry.js           # Generic polar-coordinate / annular-sector path helpers (used by the ribbon)
        ├── svgTextHelpers.js        # Generic SVG text helpers - XML escaping, line-wrapping, stacked vertical CJK text
        ├── weatherIcon.js           # Line-art weather icons (sun/cloud/rain/thunder/haze), mono or color accents
        ├── colorPalette.js          # Spectra 6 palette (nibble values + approximate RGB) and color quantizer
        ├── stippleWatermark.js      # Zodiac-animal background watermark (stippled mono / solid color)
        ├── lunarCalendar.js         # Gregorian -> Chinese lunar date, ganzhi, zodiac, solar term (lunar-javascript)
        ├── chineseMonth.js          # Gregorian month -> Chinese numeral + big/small (大/小/平) label
        ├── publicHolidays.js        # Singapore public holiday lookup by date (data.gov.sg/MOM dataset)
        ├── holidayNames.js          # English -> Chinese holiday name translation
        ├── scripturePhrases.js      # Deterministic "phrase of the day" pick from scripture_phrases.json
        ├── couplets.js              # Deterministic "couplet of the day" pick from couplets.json
        ├── weatherTranslations.js   # NEA forecast text -> Chinese translation
        ├── astronomy.js            # Sunrise/sunset + moon phase for Singapore (suncalc)
        ├── advisoryLabels.js        # NEA's official UV Index / PSI band -> qualitative level key (low/moderate/...)
        ├── ltaTransport.js          # LTA DataMall: live bus arrivals + crowding, MRT line health
        ├── trafficData.js           # LTA DataMall: expressway travel times + incidents (8 expressways, 2 directions each)
        ├── liveStationData.js       # NEA live weather station readings (temp/humidity/rainfall/wind)
        ├── uvIndex.js               # NEA live UV Index reading
        ├── feelsLike.js             # Heat-index style "feels like" temperature from live station data
        ├── httpCache.js             # Short-lived response cache for outbound API calls
        ├── generateFontGallery.js   # Dev-only font comparison sheet (see /api/font-gallery below)
        ├── packTo1Bit.js            # Raw pixels -> packed 1-bit bitmap, for the mono panel (from bus_where, unchanged)
        └── packToIndexed4BPP.js     # Raw pixels -> packed indexed 4bpp bitmap, for the Spectra 6 panel
```

## Adjusting the layout

**To rearrange which weather/air-quality/celestial/transit/traffic stat appears where in the color panel's grid**, edit
`GRID_ROWS` in `backend/utils/gridLayout.js` - it's a plain array of rows, each a list of 4 field keys (`null` for a
blank cell). Reordering rows, reordering keys within a row, or moving a key to a different row is just editing that
array; nothing else needs to change. To add a brand-new stat or change how its value/severity color is computed, add
it to `buildGridFields` in the same file, then reference its key from `GRID_ROWS`. Bus-arrival rows aren't part of
this config - they're appended automatically, sized to however many bus services are being tracked.

**Everything else on the color page** (header, big day number, date row, the vertical couplet, the fan-shaped solar
term ribbon) is hand-tuned illustration code in `generateSVGColor.js`, not config - each section is its own
`render*` function with named constants (positions, radii, angles, font sizes) at the top, meant to be nudged
directly. The geometry math itself (`polarPoint`, `annularSectorPath`, etc.) lives in `svgGeometry.js` and shouldn't
need touching.

The mono 800x480 layout (`generateSVG.js`) is a separate, simpler file and hasn't been split up the same way.

## Endpoints

- `GET /api/create-display-image` - mono 800x480, packed 1-bit, 48,000 bytes. Polled by `esp32/code.ino`.
- `GET /api/create-display-image-color` - color 1200x1600, packed indexed 4bpp, 960,000 bytes. Polled by
  `esp32/color_13in3/code.ino`. Accepts `?lang=zh` to switch the weather grid's cell labels to Chinese (dev-only,
  not wired to firmware).
- `GET /api/preview` / `GET /api/preview-color` - dev-only, render the same layouts as plain PNGs so they can be
  viewed directly in a browser. Both accept `?preview=tomorrow` (the ESP32's "next day" button - shifts the calendar
  date only, not weather/air-quality, since NEA doesn't forecast those per-day) and `?lang=zh` (color only).
- `GET /api/font-gallery` / `GET /api/font-gallery-cjk` - dev-only, renders a sheet of candidate fonts side by side
  (optionally `?fonts=Font%20One,Font%20Two`) so you can compare options without editing a layout file and reloading
  one font at a time.

Run `npm run dev` (instead of `npm start`) to auto-restart the server on file save (uses Node's built-in `--watch`,
no extra dependency) - then just reload the preview URL in your browser after editing a layout file.

## Data sources

- **Weather**: NEA's 24-hour forecast via [data.gov.sg](https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast)
  (Singapore-wide general forecast: high/low temp, humidity, wind, forecast text), plus NEA's PSI/pollutant, live
  station, and UV Index endpoints for the rest of the grid. No API key required for any of these (`DATA_GOV_SG_API_KEY`
  in `.env` is optional - it only raises the rate limit).
- **Calendar**: today's date, in Singapore time. The Chinese lunar date, weekday, ganzhi year/day, zodiac animal,
  and solar term are computed locally with `lunar-javascript`. Singapore public holidays come from a `data.gov.sg`/MOM
  dataset (English names only; Chinese names are a hand-built lookup in `holidayNames.js`). Sunrise/sunset and moon
  phase are computed locally with `suncalc` (not an NEA data source).
- **Transit** (color panel only): live bus arrival countdowns + crowding and MRT line health via LTA DataMall.
  Requires `LTA_DATAMALL_API_KEY` in `.env` - see `.env.example` for where to request one.
- **Expressway traffic** (color panel only): estimated travel time for each of 8 major expressways' 2 directions
  (LTA's `EstTravelTimes`), plus whichever ones currently have a reported incident (LTA's `TrafficIncidents` -
  roadwork/breakdown, shown with LTA's own wording rather than an invented "heavy/light" label, since LTA doesn't
  publish an official congestion band for travel time the way it does for UV/PSI). Same `LTA_DATAMALL_API_KEY` as
  transit above. The Singapore-Johor checkpoint crossing time was considered but dropped - the only source found
  (sgtrafficnow.com) renders its live numbers client-side rather than in static HTML, so scraping it would need
  browser automation or reverse-engineering an undocumented internal endpoint.
- **Scripture/couplets**: the ribbon's daily phrase and the vertical couplet flanking the day number are picked
  deterministically by date from `assets/data/scripture_phrases.json` / `assets/data/couplets.json` - not fetched
  from anywhere.

## Status

- [x] Mono firmware ported (fetch bitmap, draw, deep sleep)
- [x] Color firmware written for the EE02 / 13.3" Spectra 6 board (fetch packed 4bpp frame, push, deep sleep)
- [x] Backend pipeline wired up for both targets (NEA weather + lunar calendar -> SVG -> sharp -> pack -> serve)
- [x] Tear-away Chinese calendar + weather SVG layout designed, in both mono landscape and color portrait
- [ ] Set real WiFi credentials and server URL in both `esp32/code.ino` and `esp32/color_13in3/code.ino` (currently
      placeholders)
- [ ] Verify the color firmware against real EE02 hardware (written and quantization-tested against the library
      source, but not yet run on the physical panel)
- [ ] Frontend (if needed) for configuration

### Note on Chinese text rendering

The SVG layouts render Chinese characters (lunar date, weekday) through the SVG font stack. Whatever machine runs
the backend needs a CJK-capable font available to the system SVG renderer sharp/libvips uses - this works out of the
box on macOS, but on a headless Linux server you may need to install one, e.g. `apt install fonts-noto-cjk`.

### Note on the color quantizer

`colorPalette.js`'s RGB values for the 6 Spectra colors are visual approximations, not calibrated ink measurements -
recalibrate them once you have the physical panel in hand. Anti-aliased edges of black text/strokes are desaturated
grays that (in plain RGB distance) can land closer to the muted green/blue than to true black, so low-saturation
pixels are classified by luminance (black vs white) before any hue matching runs; see the comment in
`nearestPaletteNibble` for details.

### Color firmware setup notes

- Install the [Seeed_GFX2](https://github.com/Seeed-Studio/Seeed_GFX2) Arduino library (not compatible with TFT_eSPI -
  uninstall conflicting display libraries first).
- Enable **PSRAM** in the Arduino IDE's Tools menu - the packed frame is ~960KB, too big for internal RAM alone.
- Board: XIAO ESP32S3 Plus.
