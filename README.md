# weather-project

An e-ink display showing today's calendar and weather forecast, on a XIAO ESP32-S3 + 7.5" e-paper panel.

Built off the display/backend pipeline from [rexyyong/bus_where](https://github.com/rexyyong/bus_where): a backend
renders an SVG, converts it to a raw 1-bit bitmap, and serves it over HTTP; the ESP32 polls that endpoint, downloads
the bitmap, and draws it to the e-paper display.

## Structure

```
weather-project
├── esp32
│   └── code.ino          # ESP32 firmware - fetch/draw/deep-sleep loop (from bus_where, unchanged)
└── backend
    ├── index.js           # Express server - builds and serves the display bitmap
    └── utils
        ├── generateSVG.js  # SVG layout for calendar + weather (stub, TODO)
        └── packTo1Bit.js   # Raw pixels -> packed 1-bit bitmap (from bus_where, unchanged)
```

## Status

- [x] ESP32 firmware ported (fetch bitmap, draw, deep sleep)
- [x] Backend pipeline scaffolded (SVG -> sharp -> 1-bit pack -> serve)
- [ ] Pick a weather API and wire up `getWeatherData()`
- [ ] Pick a calendar source and wire up `getCalendarData()`
- [ ] Design the actual calendar + weather SVG layout
- [ ] Frontend (if needed) for configuration
