/*
 * ========================================================
 * كود "حراس النيل" - (مع فلتر أمان لمنع القراءات الوهمية)
 * ========================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NTPClient.h> 
#include <WiFiUdp.h>
#include <time.h>      

// ----------------------------------------------------
// ** 1. إعدادات الشبكة والخادم (عدّل دي بنفسك) **
// ----------------------------------------------------
const char* WIFI_SSID = "Belal123";       // اسم شبكة الواي فاي
const char* WIFI_PASS = "blalmessi10";   // باسورد شبكة الواي فاي
const char* SERVER_IP = "10.85.83.205"; // (ده مثال، غيره للـ IP بتاعك)
const int SERVER_PORT = 3000;
// ----------------------------------------------------

// ----------------------------------------------------
// ** 2. إعدادات المستشعر والوقت **
// ----------------------------------------------------
const int TURBIDITY_PIN = 34; // ⚠️ الدبوس المتصل بـ "مقسم الجهد"

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7200); 
// ----------------------------------------------------

// --- دالة تحويل الوقت ---
String getFormattedDate(unsigned long epochTime) {
  char buf[30];
  time_t t = epochTime;
  strftime(buf, 30, "%Y-%m-%dT%H:%M:%SZ", gmtime(&t));
  return String(buf);
}
int guardianCounter = 1; // <-- **أضف هذا السطر هنا**
// ---------------------------------------

void setup() {
  Serial.begin(115200);
  delay(1000); 
  Serial.println("\n\n===========================");
  Serial.println("بدء تشغيل حارس النيل (بفلتر أمان)...");
  
  pinMode(TURBIDITY_PIN, INPUT);

  // (نفس كود اتصال الواي فاي)
  Serial.print("جاري الاتصال بشبكة: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nتم الاتصال بالواي فاي بنجاح!");
  Serial.println(WiFi.localIP());

  timeClient.begin();
}

void loop() {
  Serial.println("--------------------");
  
  // 1. تحديث الوقت من الإنترنت
  timeClient.update();
  String formattedTime = getFormattedDate(timeClient.getEpochTime()); 
  Serial.print("الوقت الحالي: ");
  Serial.println(formattedTime);

  // 2. قراءة مستشعر العكارة
  int sensorValue = analogRead(TURBIDITY_PIN); 
  
  // --- **الإضافة الجديدة: فلتر الأمان** ---
  // (4095 هي أقصى قراءة، 0 هي أقل قراءة)
  // لو الدبوس "طاير في الهوا" (unconnected) هيدي 0 أو 4095
  // **تعديل: إحنا هنسيب 0 و 4095 عشان ممكن تكون قراية حقيقية في حالات نادرة**
  // **الأفضل نستخدم مدى ضيق جدًا للخطأ**
  if (sensorValue < 10) { // لو القراءة 0 (أو قريبة جدًا من 0)
    Serial.println("!!! تحذير: المستشعر غير متصل أو به عطل !!!");
    Serial.print("القراءة التناظرية (خارج النطاق): "); Serial.println(sensorValue);
    Serial.println("تم تخطي الإرسال... الانتظار 4 دقائق.");
    delay(240000); // (نفس مدة الانتظار عشان منعملش سبام)
    return; // <-- أهم خطوة: ارجع لأول الـ loop ومتكملش
  }
  // --- نهاية الفلتر ---

  // (لو الكود وصل هنا، يبقى القراءة سليمة ومنطقية)
  float voltage = sensorValue * (3.3 / 4095.0); 

  float ntu;
  if (voltage > 2.8) { 
    ntu = 0;
  } else {
    ntu = map(voltage * 100, 150, 280, 3000, 0); 
  }
  
  Serial.print("القراءة التناظرية (0-4095): "); Serial.println(sensorValue);
  Serial.print("الجهد الواصل للـ ESP32 (0-3.3V): "); Serial.println(voltage);
  Serial.print("قيمة العكارة (NTU) (تحتاج معايرة): "); Serial.println(ntu);

  // 3. بناء كائن الـ JSON
  StaticJsonDocument<512> jsonDoc;
  
  String guardianName = "Guardian-Test-" + String(guardianCounter); 
  jsonDoc["guardian_id"] = guardianName; 
  Serial.print("إرسال بيانات للحارس: ");
  Serial.println(guardianName);
  guardianCounter++; 
  
  jsonDoc["timestamp"] = formattedTime; 
  
  JsonObject location = jsonDoc.createNestedObject("location");
  location["latitude"] = 27.1751 + (random(0, 100) / 1000.0);
  location["longitude"] = 31.1872 + (random(0, 100) / 1000.0);

  JsonArray readings = jsonDoc.createNestedArray("readings");
  JsonObject turbReading = readings.createNestedObject();
  turbReading["type"] = "turbidity";
  turbReading["unit"] = "ntu";
  turbReading["value"] = ntu;

  jsonDoc["battery_level"] = 0.95; 

  String jsonString;
  serializeJson(jsonDoc, jsonString);
  Serial.println("Sending JSON:");
  Serial.println(jsonString);

  // 5. إرسال البيانات للباك اند (HTTP POST)
  HTTPClient http;
  String serverUrl = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/v1/readings";
  
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode == 201) { 
    Serial.println(">>> تم إرسال البيانات بنجاح! <<<");
  } else {
    Serial.printf("[HTTP] فشل الإرسال، كود الخطأ: %d\n", httpResponseCode);
  }

  http.end();

  // 6. الانتظار (4 دقائق)
  Serial.println("تم. الانتظار لمدة 4 دقائق...");
  delay(240000); 
}