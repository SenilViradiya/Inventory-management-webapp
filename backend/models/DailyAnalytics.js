const mongoose = require('mongoose');

const dailyAnalyticsSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  stockAdded: {
    totalQty: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  sales: {
    totalQty: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    transactions: { type: Number, default: 0 },
    profit: { type: Number, default: 0 }
  },
  movements: [{
    type: { type: String },
    count: { type: Number },
    totalQty: { type: Number },
    totalValue: { type: Number }
  }],
  priceChanges: {
    count: { type: Number, default: 0 },
    increases: { type: Number, default: 0 },
    decreases: { type: Number, default: 0 }
  },
  promotions: {
    promoQty: { type: Number, default: 0 },
    promoRevenue: { type: Number, default: 0 },
    normalQty: { type: Number, default: 0 },
    normalRevenue: { type: Number, default: 0 }
  },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

dailyAnalyticsSchema.index({ date: 1 });

module.exports = mongoose.model('DailyAnalytics', dailyAnalyticsSchema);
