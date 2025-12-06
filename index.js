const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const fetch = require('node-fetch');
const path = require('path');
// --- 1. استدعاء الموديلات ---
const Reading = require('./models/Reading');

// --- 2. إعداد الخادم ---
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 3. الاتصال بقاعدة البيانات ---
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ ممتاز! تم الاتصال بقاعدة البيانات بنجاح.'))
  .catch((err) => console.error('❌ خطأ: لم نتمكن من الاتصال بقاعدة البيانات.', err));

// --- 4. دالة العقل المحلل (اليدوي الثابت) ---
function analyzeReading(type, value) {
    let status = 'good', message = 'القراءة ضمن المعدل الطبيعي.';
    if (value === null || value === undefined || isNaN(value)) {
        return { value: '-', status: 'unknown', message: 'البيانات مفقودة أو غير صالحة.' };
    }
    if (type === 'temperature') {
        if (value > 30) { status = 'danger'; message = 'خطر: درجة الحرارة مرتفعة جدًا.'; }
        else if (value > 28) { status = 'warning'; message = 'تحذير: درجة الحرارة مرتفعة.'; }
        else if (value < 15) { status = 'warning'; message = 'تحذير: درجة الحرارة منخفضة.'; }
    } else if (type === 'ph') {
        if (value > 8.5 || value < 6.5) { status = 'danger'; message = 'خطر: مستوى الحموضة خارج النطاق الآمن.'; }
        else if (value > 8.0 || value < 7.0) { status = 'warning'; message = 'تحذير: القراءة تميل إلى القلوية/الحموضة.'; }
    } else if (type === 'tds') {
        if (value > 500) { status = 'danger'; message = 'خطر: المواد الصلبة الذائبة مرتفعة جدًا.'; }
        else if (value > 300) { status = 'warning'; message = 'تحذير: المواد الصلبة الذائبة مرتفعة.'; }
    } else if (type === 'turbidity') {
        if (value > 150) { status = 'danger'; message = 'خطر: المياه شديدة العكارة.'; }
        else if (value > 50) { status = 'warning'; message = 'تحذير: المياه عكرة بشكل ملحوظ.'; }
    } else if (type === 'battery') {
        let batteryValue = Math.round(value * 100);
        if (value < 0.2) { status = 'danger'; message = 'خطر: البطارية على وشك النفاذ!'; }
        else if (value < 0.5) { status = 'warning'; message = 'تحذير: البطارية منخفضة.'; }
        else { message = 'البطارية في حالة جيدة.'; }
        return { value: batteryValue, status: status, message: message };
    }
    return { value: value, status: status, message: message };
}

// --- 5. اللينكات (Routes) ---

app.get('/', (req, res) => { res.send('API حراس النيل يعمل!'); });

// أ. جلب كل القراءات
app.get('/api/v1/readings', async (req, res) => {
  try {
    const allReadings = await Reading.find().sort({ timestamp: -1 });
    res.status(200).json(allReadings);
  } catch (error) { res.status(500).json({ message: "Error fetching data", error: error.message }); }
});

// ب. إرسال قراءة جديدة
app.post('/api/v1/readings', async (req, res) => {
  try {
    const newReading = new Reading(req.body);
    await newReading.save();
    res.status(201).json({ message: "Data saved successfully!", data: newReading });
  } catch (error) { res.status(500).json({ message: "Error saving data", error: error.message }); }
});

// ج. العقل اليدوي (للداش بورد)
app.get('/api/v1/readings/:guardianId', async (req, res) => {
  try {
    const { guardianId } = req.params;
    const readings = await Reading.find({ guardian_id: guardianId }).sort({ timestamp: -1 });
    if (readings.length === 0) {
      return res.status(404).json({ message: "No readings found for this guardian." });
    }
    const latestReading = readings[0];
    const history = readings.slice(0, 15).reverse();
    const analysis = {};
    if (Array.isArray(latestReading.readings)) {
        latestReading.readings.forEach(sensor => {
          analysis[sensor.type] = analyzeReading(sensor.type, sensor.value);
        });
    }
    analysis['battery'] = analyzeReading('battery', latestReading.battery_level);
    analysis['location'] = {
        value: `${latestReading.location.latitude.toFixed(4)}, ${latestReading.location.longitude.toFixed(4)}`,
        status: 'good',
        message: 'آخر موقع مسجل للحارس.'
    };
    res.status(200).json({ 
        guardian_id: latestReading.guardian_id,
        timestamp: latestReading.timestamp,
        history: history,
        analysis: analysis 
    });
  } catch (error) {
    console.error("Error in guardian detail route:", error);
    res.status(500).json({ message: "Error fetching guardian data", error: error.message });
  }
});

// د. العقل الذكي (Gemini)
app.get('/api/v1/ai-analysis/:guardianId', async (req, res) => {
  try {
    const { guardianId } = req.params;
    const guardianReadings = await Reading.find({ guardian_id: guardianId }).sort({ timestamp: -1 }).limit(50); 
    if (guardianReadings.length === 0) {
      return res.status(400).json({ report: "لا توجد بيانات كافية لهذا الحارس." });
    }

    const prompt = `
      **المهمة:** تحليل بيانات مستشعر مياه عائم.
      **شخصيتك (أيها الذكاء الاصطناعي):**
      أنت عالم هيدرولوجي وخبير بيئي عالمي، متخصص في جودة مياه نهر النيل والترع المصرية ومستند إلى **القانون المصري رقم 48 لسنة 1982 وتعديلاته (قرار 402 لسنة 2009)**.
      **البيانات:**
      إليك آخر ${guardianReadings.length} قراءة من مستشعر "${guardianId}":
      ${JSON.stringify(guardianReadings, null, 2)}

      **التقرير المطلوب (تنسيق Markdown):**
      قم بإنشاء تقرير تحليل احترافي باللغة العربية في شكل نصي (Markdown).
      التقرير يجب أن يتضمن الأقسام الأربعة التالية بالضبط:
      1.  **# 1. تقييم جودة البيانات (صحيحة أم لا؟)**
          * (قم بتقييم موثوقية البيانات واذكر القراءات المستحيلة).
      2.  **# 2. الملخص التنفيذي (التحليل البيئي)**
          * (ملخص للحالة البيئية بناءً على البيانات الموثوقة).
      3.  **# 3. التحليل التفصيلي (دراسة كاملة)**
          * (حلل كل قراءة وقارنها بالمعايير القانونية المصرية مثل المادة 60 و 61).
      4.  **# 4. توصيات عملية**
          * (توصيات بناءً على القانون والتحليل).
    `;
    
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL_NAME = "gemini-2.5-flash"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    const requestBody = { contents: [{ parts: [{ "text": prompt }] }] };

    console.log(`إرسال طلب تحليل لـ Gemini (للحارس: ${guardianId} باستخدام ${MODEL_NAME})...`);
    
    const geminiResponse = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.json();
        console.error("خطأ من Gemini API (direct):", errorBody);
        throw new Error(`خطأ من API: ${geminiResponse.statusText}`);
    }

    const data = await geminiResponse.json();
    const reportText = data.candidates[0].content.parts[0].text;
    console.log("تم استلام التقرير من Gemini.");
    res.status(200).json({ report: reportText });

  } catch (error) {
    console.error("خطأ أثناء الاتصال بـ Gemini API (Direct Fetch):", error);
    res.status(500).json({ report: "حدث خطأ أثناء إنشاء التحليل الذكي." });
  }
});

// هـ. حذف مجموعة محددة (لصفحة الأدمن)
app.post('/api/v1/readings/delete-multiple', async (req, res) => {
    try {
        const { ids } = req.body; 
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "لم يتم تحديد أي حراس لحذفهم." });
        }
        const result = await Reading.deleteMany({ guardian_id: { $in: ids } });
        console.log(`تم حذف ${result.deletedCount} قراءة لـ ${ids.length} حارس.`);
        res.status(200).json({ message: `تم حذف ${ids.length} حارس وكل بياناتهم بنجاح.` });
    } catch (error) {
        console.error("خطأ أثناء حذف مجموعة:", error);
        res.status(500).json({ message: "حدث خطأ أثناء الحذف المجمع.", error: error.message });
    }
});

// و. حذف كل البيانات (لصفحة الأدمن)
app.delete('/api/v1/readings/all-data', async (req, res) => {
    try {
        const result = await Reading.deleteMany({}); 
        console.warn(`!!! تم حذف كل البيانات (${result.deletedCount} قراءة) !!!`);
        res.status(200).json({ message: `!!! تم حذف جميع بيانات الحراس (${result.deletedCount} قراءة) بنجاح.` });
    } catch (error) {
        console.error("خطأ أثناء حذف كل البيانات:", error);
        res.status(500).json({ message: "حدث خطأ أثناء حذف كل البيانات.", error: error.message });
    }
});
// ---------------------------------

// --- 6. تشغيل الخادم ---
app.listen(port, () => {
  console.log(`الخادم يعمل على http://localhost:${port}`);
});
module.exports = app;