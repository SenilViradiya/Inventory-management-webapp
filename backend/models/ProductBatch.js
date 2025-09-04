const mongoose = require('mongoose');

const productBatchSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  batchNumber: { type: String, default: '' },
  purchasePrice: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, default: 0, min: 0 },
  godownQty: { type: Number, default: 0, min: 0 },
  storeQty: { type: Number, default: 0, min: 0 },
  totalQty: { type: Number, default: 0, min: 0 },
  originalQty: { type: Number, default: 0, min: 0 },
  expiryDate: { type: Date },
  manufacturingDate: { type: Date },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: { type: String, default: '' },
  invoiceNumber: { type: String, default: '' },
  status: { type: String, enum: ['active', 'near_expiry', 'expired', 'sold_out'], default: 'active' },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

productBatchSchema.index({ productId: 1 });
productBatchSchema.index({ expiryDate: 1 });
productBatchSchema.index({ status: 1 });

productBatchSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  const diff = this.expiryDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

productBatchSchema.methods.isExpired = function() {
  return this.expiryDate ? (new Date() >= new Date(this.expiryDate)) : false;
};

productBatchSchema.methods.isNearExpiry = function(days = 30) {
  if (!this.expiryDate) return false;
  const d = this.daysUntilExpiry;
  return d !== null && d <= days && d > 0;
};

productBatchSchema.pre('save', function(next) {
  this.totalQty = (this.godownQty || 0) + (this.storeQty || 0);
  if (this.totalQty === 0) this.status = 'sold_out';
  else if (this.isExpired()) this.status = 'expired';
  else if (this.isNearExpiry()) this.status = 'near_expiry';
  else this.status = 'active';
  next();
});

module.exports = mongoose.model('ProductBatch', productBatchSchema);
