const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String, // URL or file path
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  expirationDate: {
    type: Date,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  qrCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
    min: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
productSchema.index({ qrCode: 1 });
productSchema.index({ category: 1 });
productSchema.index({ expirationDate: 1 });
productSchema.index({ quantity: 1 });

// Virtual for checking if product is low stock
productSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.lowStockThreshold;
});

// Virtual for checking if product is expiring soon (within 7 days)
productSchema.virtual('isExpiringSoon').get(function() {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  return this.expirationDate <= sevenDaysFromNow;
});

// Virtual for checking if product is expired
productSchema.virtual('isExpired').get(function() {
  return this.expirationDate < new Date();
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
