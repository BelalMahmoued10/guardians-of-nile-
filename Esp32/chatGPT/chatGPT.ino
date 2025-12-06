/*
 * كود قراءة TS-300B على ESP32 العادي (WROOM-32)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

const char* WIFI_SSID = "Belal123";
const char* WIFI_PASS = "blalmessi10";

const char* SERVER_IP = "172.31.68.91";
const int SERVER_PORT = 3000;

// ------------ المستشعر ---------------
const int turbPin = 34;   // ADC1_CH7  ← الصحيح على ESP32
const float R1 = 2200.0;
const float R2 = 3300.0;
const float factor = (R1 + R2) / R2;

// ⚠ جهد ADC في ESP32 العادي = 1.1V
const float ADC_VREF = 1.1;

// المعايرة
const float V_CLEAR   = 4.95;
const float V_DIRTY   = 1.80;
const float NTU_DIRTY = 500.0;

WiFiUDP ntpUDP;
const long UTC_OFFSET = 7200;
NTPClient timeClient(ntpUDP, "pool.ntp.org", UTC_OFFSET);

String getFormattedDate(unsigned long epochTime) {
  char buf[30];
  time_t t = epochTime;
  strftime(buf, 30, "%Y-%m-%dT%H:%M:%SZ", gmtime(&t));
  return String(buf);
}

float readTurbidity() {
  long sum = 0;

  for (int i = 0; i < 10; i++) {
    sum += analogRead(turbPin);
    delay(4);
  }

  float v_adc = (sum / 10.0) * (ADC_VREF / 4095.0);
  float v_sensor = v_adc * factor;

  v_sensor = constrain(v_sensor, 0.5, 5.0);

  float slope = NTU_DIRTY / (V_CLEAR - V_DIRTY);
  float ntu = slope * (V_CLEAR - v_sensor);

  ntu = constrain(ntu, 0, 4000);

  return ntu;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  timeClient.begin();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    delay(3000);
    return;
  }

  timeClient.update();
  String timestamp = getFormattedDate(timeClient.getEpochTime());

  float ntu = readTurbidity();
  Serial.printf("NTU: %.1f\n", ntu);

  delay(2000);
}
