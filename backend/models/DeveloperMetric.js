const mongoose = require('mongoose');

const developerMetricSchema = new mongoose.Schema({
  app: { type: String, required: true },
  instanceId: { type: String },
  metricType: { type: String, required: true }, // e.g., 'crash', 'uptime', 'run'
  value: { type: Number, default: 1 },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

developerMetricSchema.index({ app: 1, metricType: 1, timestamp: -1 });

module.exports = mongoose.model('DeveloperMetric', developerMetricSchema);
