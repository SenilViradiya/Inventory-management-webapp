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
  azureBlobName: {
    type: String, // Azure Blob Storage blob name for deletion
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
  // Stock management - separate godown and store tracking
  stock: {
    godown: {
      type: Number,
      default: 0,
      min: 0
    },
    store: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      default: 0,
      min: 0
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0
    }
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
productSchema.index({ 'stock.total': 1 });

// Pre-save middleware to calculate total stock
productSchema.pre('save', function(next) {
  if (this.stock) {
    this.stock.total = (this.stock.godown || 0) + (this.stock.store || 0);
    // Update legacy quantity field for backward compatibility
    this.quantity = this.stock.total;
  }
  next();
});

// Virtual for available stock (total - reserved)
productSchema.virtual('availableStock').get(function() {
  return this.stock ? (this.stock.total - (this.stock.reserved || 0)) : this.quantity;
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  const available = this.availableStock;
  const threshold = this.lowStockThreshold || 5;
  
  if (available === 0) return 'out_of_stock';
  if (available <= threshold) return 'low_stock';
  return 'in_stock';
});

// Ensure virtuals are included in JSON output
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

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
