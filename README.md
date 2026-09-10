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
    ├── index.js                     # Express server - fetches weather/calendar data, builds and serves both bitmaps
    └── utils
        ├── generateSVG.js           # Mono tear-away calendar + weather SVG layout (800x480 landscape)
        ├── generateSVGColor.js      # Color tear-away calendar + weather SVG layout (1200x1600 portrait)
        ├── weatherIcon.js           # Line-art weather icons (sun/cloud/rain/thunder/haze), mono or color accents
        ├── colorPalette.js          # Spectra 6 palette (nibble values + approximate RGB) and color quantizer
        ├── lunarCalendar.js         # Gregorian -> Chinese lunar date conversion (lunar-javascript)
        ├── chineseMonth.js          # Gregorian month -> Chinese numeral + big/small (大/小/平) label
        ├── packTo1Bit.js            # Raw pixels -> packed 1-bit bitmap, for the mono panel (from bus_where, unchanged)
        └── packToIndexed4BPP.js     # Raw pixels -> packed indexed 4bpp bitmap, for the Spectra 6 panel
```

## Endpoints

- `GET /api/create-display-image` - mono 800x480, packed 1-bit, 48,000 bytes. Polled by `esp32/code.ino`.
- `GET /api/create-display-image-color` - color 1200x1600, packed indexed 4bpp, 960,000 bytes. Polled by
  `esp32/color_13in3/code.ino`.
- `GET /api/preview` / `GET /api/preview-color` - dev-only, render the same layouts as plain PNGs so they can be
  viewed directly in a browser.

Run `npm run dev` (instead of `npm start`) to auto-restart the server on file save (uses Node's built-in `--watch`,
no extra dependency) - then just reload the preview URL in your browser after editing a layout file.

## Data sources

- **Weather**: NEA's 24-hour forecast via [data.gov.sg](https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast)
  (Singapore-wide general forecast: high/low temp, humidity, wind, forecast text). No API key required.
- **Calendar**: today's date only, in Singapore time - no events or external calendar source. The Chinese lunar
  date, weekday, year (Gan-Zhi) and zodiac animal are computed locally with `lunar-javascript`.

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
