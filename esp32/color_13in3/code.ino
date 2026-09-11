/*
  Weather + Calendar Display - ESP32 Client (color variant)
  Hardware: Seeed XIAO ePaper Display Board EE02 + 13.3" E Ink Spectra 6
  (six-color) panel, 1200x1600, T133A01.

  This is the color/portrait counterpart to ../code.ino (which targets the
  older 7.5" monochrome panel over GxEPD2). Both firmwares are kept side by
  side so either display can be built against - pick the .ino that matches
  your hardware.

  Requires the Seeed_GFX2 library (https://github.com/Seeed-Studio/Seeed_GFX2)
  and PSRAM enabled in the Arduino IDE's Tools menu (the packed frame is
  ~960KB - too big for the chip's internal RAM alone).

  Refresh model: unlike the mono board (which polls every 60s, cheap on a
  panel with fast partial refresh), this Spectra 6 panel takes ~20s for a
  full refresh and has no partial-refresh mode. Polling it every few minutes
  would be wasteful and wear the panel for no visible benefit, since the
  calendar page is only actually wrong once a day. So this firmware sleeps
  until the next midnight (Singapore time, via NTP) and only refreshes then
  - plus on demand, via the 3 physical buttons on the EE02 board (GPIO
  numbers verified against the board's schematic):

    - Button 1 (GPIO2): manual refresh - re-fetch and redraw right now
    - Button 2 (GPIO3): next-day preview - show tomorrow's calendar page.
      Only the date/lunar/holiday fields actually shift to tomorrow; the
      weather/air-quality numbers stay live/today's, since NEA doesn't
      expose a same-detail forecast for a specific future day the way its
      24-hour endpoint does for today. See the backend's dayOffset comment
      on getCalendarData for the full explanation.
    - Button 3 (GPIO5): mode switch - cycles [calendar, bus timings,
      wallpaper]. Only "calendar" is implemented right now; the other two
      are placeholders for later (see DisplayMode below) - pressing this
      button on a real EE02 today will just skip drawing anything until you
      cycle back to calendar mode.

  Not yet implemented: a periodic "maintenance wipe" full-clear cycle some
  e-ink panels benefit from after many refreshes, to clear any accumulated
  ghosting. Worth revisiting once this has run for a while on real hardware
  and it's clear whether it's actually needed.
*/

#include <Seeed_GFX.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

Seeed_GFX display(Seeed_Product::Seeed_ePaper_13INCH3_C);

const char* ssid        = "wifi";
const char* password    = "password";
const char* serverBaseUrl = "http://{REPLACE_WITH_YOUR_COMPUTER_IP_ADDRESS}:8080";

const int32_t IMAGE_WIDTH  = 1200;
const int32_t IMAGE_HEIGHT = 1600;
// Indexed 4bpp: 2 pixels per byte.
const size_t IMAGE_SIZE = (size_t)IMAGE_WIDTH * IMAGE_HEIGHT / 2;

// Button pins, verified against the EE02 schematic - active-low with
// internal pullups (a press pulls the pin to ground).
const int BUTTON_REFRESH = 2;
const int BUTTON_PREVIEW = 3;
const int BUTTON_MODE    = 5;

enum DisplayMode {
  MODE_CALENDAR  = 0,
  MODE_BUS       = 1,
  MODE_WALLPAPER = 2,
  MODE_COUNT     = 3,
};

// RTC memory survives deep sleep (but not a power cycle), so the current
// mode and retry count persist across each night's sleep/wake cycle.
RTC_DATA_ATTR int displayMode = MODE_CALENDAR;
RTC_DATA_ATTR int failedAttempts = 0;

uint8_t* imageBuffer = nullptr;

void setup() {
  Serial.begin(115200);
  delay(3000); // Safety delay for upload

  pinMode(BUTTON_REFRESH, INPUT_PULLUP);
  pinMode(BUTTON_PREVIEW, INPUT_PULLUP);
  pinMode(BUTTON_MODE, INPUT_PULLUP);

  bool wantPreview = false;
  handleWakeReason(wantPreview);

  connectToWiFi();

  // Sync time and compute the nominal sleep duration while WiFi is still up
  // - fetchAndDrawImage() turns WiFi off before the display refresh to
  // avoid radio interference, so this has to happen before that.
  uint64_t sleepMicros = microsUntilNextMidnightSGT();

  bool success = false;

  if (displayMode == MODE_CALENDAR) {
    success = runCalendarMode(wantPreview);
  } else {
    Serial.printf("Display mode %d not implemented yet - skipping draw.\n", displayMode);
    success = true; // "not implemented" isn't a failure worth retrying sooner
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
  }

  if (success) {
    failedAttempts = 0;
  } else {
    failedAttempts++;
    if (failedAttempts < 5) {
      // Retry sooner instead of leaving a stale/blank display for a full
      // day over what's hopefully a transient failure.
      sleepMicros = 10ULL * 60 * 1000000ULL;
      Serial.printf("Attempt failed (%d/5) - retrying in 10 minutes.\n", failedAttempts);
    }
  }

  goToSleep(sleepMicros);
}

void loop() {
  // Unused
}

// Figures out why we woke up (scheduled midnight rollover vs. a specific
// button) and updates displayMode / wantPreview accordingly.
void handleWakeReason(bool& wantPreview) {
  if (esp_sleep_get_wakeup_cause() != ESP_SLEEP_WAKEUP_EXT1) {
    Serial.println("Woke on schedule (midnight rollover or retry timer).");
    return;
  }

  uint64_t wakePins = esp_sleep_get_ext1_wakeup_status();

  if (wakePins & (1ULL << BUTTON_MODE)) {
    displayMode = (displayMode + 1) % MODE_COUNT;
    Serial.printf("Mode button pressed. New mode: %d\n", displayMode);
  } else if (wakePins & (1ULL << BUTTON_PREVIEW)) {
    wantPreview = true;
    Serial.println("Preview button pressed: showing tomorrow.");
  } else if (wakePins & (1ULL << BUTTON_REFRESH)) {
    Serial.println("Refresh button pressed: manual refresh.");
  }
}

bool runCalendarMode(bool preview) {
  if (!display.begin()) {
    Serial.println(display.lastResult().message);
    return false;
  }

  if (psramInit()) {
    imageBuffer = (uint8_t*)ps_malloc(IMAGE_SIZE);
  } else {
    imageBuffer = (uint8_t*)malloc(IMAGE_SIZE);
  }

  if (!imageBuffer) {
    Serial.println("Error: Out of RAM (enable PSRAM in Tools menu)");
    return false;
  }

  return fetchAndDrawImage(preview);
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts > 20) ESP.restart();
  }
  Serial.println("\nConnected!");
}

bool fetchAndDrawImage(bool preview) {
  HTTPClient http;

  http.setConnectTimeout(30000);
  http.setTimeout(30000);

  String url = String(serverBaseUrl) + "/api/create-display-image-color";
  if (preview) url += "?preview=tomorrow";

  http.begin(url);
  int httpCode = http.GET();
  bool success = false;

  if (httpCode == 200) {
    int totalLen = http.getSize();
    Serial.printf("Server file size: %d\n", totalLen);

    if (totalLen == IMAGE_SIZE) {
      WiFiClient* stream = http.getStreamPtr();

      size_t bytesDownloaded = 0;
      unsigned long startTime = millis();

      while (bytesDownloaded < IMAGE_SIZE && (millis() - startTime < 30000)) {
        size_t available = stream->available();

        if (available > 0) {
          size_t remaining = IMAGE_SIZE - bytesDownloaded;
          size_t readNow = (available < remaining) ? available : remaining;

          stream->readBytes(imageBuffer + bytesDownloaded, readNow);
          bytesDownloaded += readNow;
          startTime = millis();

          if (bytesDownloaded % 100000 == 0) {
            Serial.printf("Progress: %u / %u\n", (unsigned)bytesDownloaded, (unsigned)IMAGE_SIZE);
          }
        } else {
          delay(10);
        }
      }

      Serial.printf("\nFinal Download Count: %u bytes\n", (unsigned)bytesDownloaded);

      if (bytesDownloaded == IMAGE_SIZE) {
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        Serial.println("WiFi OFF. Drawing bitmap...");

        if (!display.pushImage4BPP(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT, imageBuffer)) {
          Serial.println("Packed 4bpp image rejected");
        } else {
          // refresh() pushes the frame to the panel, then sleeps and powers
          // it down internally - no separate power-off call needed.
          const GfxResult result = display.refresh();
          if (!result) {
            Serial.println(result.message);
          } else {
            Serial.println("Done!");
            success = true;
          }
        }
      } else {
        Serial.println("ERROR: Download Timed Out. Incomplete Data.");
      }
    } else {
      Serial.printf("Error: Server sent %d bytes (Expected %u)\n", totalLen, (unsigned)IMAGE_SIZE);
    }
  } else {
    Serial.printf("HTTP GET Failed: %d\n", httpCode);
  }

  http.end();
  return success;
}

void goToSleep(uint64_t sleepMicros) {
  Serial.printf("Sleeping %.1f hours.\n", sleepMicros / 3600000000.0);

  esp_sleep_enable_timer_wakeup(sleepMicros);

  // Arm all 3 buttons for wake, regardless of which sleep duration above
  // was chosen - any press brings the device back immediately.
  uint64_t buttonMask = (1ULL << BUTTON_REFRESH) | (1ULL << BUTTON_PREVIEW) | (1ULL << BUTTON_MODE);
  esp_sleep_enable_ext1_wakeup(buttonMask, ESP_EXT1_WAKEUP_ANY_LOW);

  esp_deep_sleep_start();
}

// Uses NTP (over the WiFi connection already established this cycle) to
// find how many microseconds remain until the next 00:00:00 in Singapore
// time (UTC+8, no daylight saving). Falls back to a flat 24h if time sync
// fails, so a transient NTP outage doesn't wedge the sleep schedule.
uint64_t microsUntilNextMidnightSGT() {
  configTime(8 * 3600, 0, "pool.ntp.org", "time.google.com");

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 10000)) {
    Serial.println("NTP sync failed - defaulting to a flat 24h sleep.");
    return 24ULL * 60 * 60 * 1000000ULL;
  }

  int secondsSinceMidnight = timeinfo.tm_hour * 3600 + timeinfo.tm_min * 60 + timeinfo.tm_sec;
  int secondsUntilMidnight = (24 * 60 * 60) - secondsSinceMidnight;
  // Floor this in case we happen to wake at 23:59:58 or similar - avoid an
  // effectively-zero sleep that would just spin right back on.
  if (secondsUntilMidnight < 60) secondsUntilMidnight += 24 * 60 * 60;

  return (uint64_t)secondsUntilMidnight * 1000000ULL;
}
