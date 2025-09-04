const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductBatch' },
  promoPrice: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

promotionSchema.index({ productId: 1 });
promotionSchema.index({ batchId: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Promotion', promotionSchema);
