const mongoose = require('mongoose');

// تعريف شكل القراءة الواحدة داخل المصفوفة
const readingValueSchema = new mongoose.Schema({
  type: { // نوع القراءة (مثل: temperature, ph, tds)
    type: String,
    required: true,
    lowercase: true, // تخزين النوع بحروف صغيرة دائمًا للتوحيد
    trim: true
  },
  unit: { // وحدة القياس (مثل: celsius, pH, ppm)
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  value: { // القيمة الرقمية للمستشعر
    type: Number,
    required: true
  }
}, { _id: false }); // لا نحتاج لمعرف فريد لكل قراءة داخل المصفوفة

// تعريف المخطط الرئيسي للبيانات القادمة من الحارس
const readingSchema = new mongoose.Schema({
  guardian_id: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  // --- التغيير الجوهري هنا ---
  // استبدلنا كائن "data" الثابت بمصفوفة مرنة من القراءات
  readings: [readingValueSchema],
  // -------------------------
  battery_level: {
    type: Number,
    min: 0,
    max: 1
  }
});

module.exports = mongoose.model('Reading', readingSchema);