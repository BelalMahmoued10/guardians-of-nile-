const mongoose = require('mongoose');

const sensorTypeSchema = new mongoose.Schema({
  // المعرف الفريد الذي يرسله المستشعر (مثل: "temperature" أو "ph")
  type: {
    type: String,
    required: true,
    unique: true, // لا يمكن تكرار نفس النوع
    lowercase: true,
    trim: true
  },
  // الاسم الذي سيظهر للمستخدم (مثل: "درجة الحرارة")
  name: {
    type: String,
    required: true,
    trim: true
  },
  // وحدة القياس (مثل: "°C" أو "ppm")
  unit: {
    type: String,
    required: true,
    trim: true
  },
  // --- هنا يبدأ "العقل" ---
  // القواعد التي سنستخدمها للتحليل
  normal_min: { type: Number }, // الحد الأدنى الطبيعي
  normal_max: { type: Number }, // الحد الأقصى الطبيعي
  warning_min: { type: Number }, // حد التحذير الأدنى
  warning_max: { type: Number }, // حد التحذير الأقصى
});

module.exports = mongoose.model('SensorType', sensorTypeSchema);