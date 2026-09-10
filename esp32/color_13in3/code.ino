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

  Fetches a pre-rendered, pre-packed indexed-4bpp frame from the backend's
  /api/create-display-image-color endpoint and pushes it directly - all
  layout/weather/calendar work happens server-side, matching the pipeline
  used by the mono firmware.
*/

#include <Seeed_GFX.h>
#include <WiFi.h>
#include <HTTPClient.h>

Seeed_GFX display(Seeed_Product::Seeed_ePaper_13INCH3_C);

const char* ssid      = "wifi";
const char* password  = "password";
const char* serverUrl = "http://{REPLACE_WITH_YOUR_COMPUTER_IP_ADDRESS}:8080/api/create-display-image-color";

const int32_t IMAGE_WIDTH  = 1200;
const int32_t IMAGE_HEIGHT = 1600;
// Indexed 4bpp: 2 pixels per byte.
const size_t IMAGE_SIZE = (size_t)IMAGE_WIDTH * IMAGE_HEIGHT / 2;

// How often to wake up and refresh. The panel itself takes ~12s to redraw,
// and a day-at-a-glance display doesn't need to update often - 5 minutes is
// a reasonable default; raise it further to save battery.
const uint64_t SLEEP_INTERVAL_US = 5ULL * 60 * 1000000ULL;

uint8_t* imageBuffer = nullptr;

void setup() {
  Serial.begin(115200);
  delay(3000); // Safety delay for upload

  if (!display.begin()) {
    Serial.println(display.lastResult().message);
    goToSleep();
    return;
  }

  if (psramInit()) {
    imageBuffer = (uint8_t*)ps_malloc(IMAGE_SIZE);
  } else {
    imageBuffer = (uint8_t*)malloc(IMAGE_SIZE);
  }

  if (!imageBuffer) {
    Serial.println("Error: Out of RAM (enable PSRAM in Tools menu)");
    goToSleep();
    return;
  }

  connectToWiFi();
  fetchAndDrawImage();

  goToSleep();
}

void loop() {
  // Unused
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

void fetchAndDrawImage() {
  HTTPClient http;

  http.setConnectTimeout(30000);
  http.setTimeout(30000);

  http.begin(serverUrl);
  int httpCode = http.GET();

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
}

void goToSleep() {
  Serial.println("Sleeping...");
  esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
  esp_deep_sleep_start();
}
