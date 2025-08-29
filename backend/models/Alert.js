const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['low_stock', 'expired_product', 'expiring_soon', 'subscription_expiring', 'order_update', 'system', 'custom'],
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['product', 'order', 'subscription', 'inquiry', 'purchase_order']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  expiresAt: {
    type: Date
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  actions: [{
    label: String,
    action: String,
    data: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Virtual for age in hours
alertSchema.virtual('ageInHours').get(function() {
  const timeDiff = new Date() - this.createdAt;
  return Math.round(timeDiff / (1000 * 60 * 60));
});

// Virtual for urgency score
alertSchema.virtual('urgencyScore').get(function() {
  const severityScore = {
    'info': 1,
    'warning': 2,
    'error': 3,
    'critical': 4
  };
  
  const typeScore = {
    'system': 4,
    'subscription_expiring': 3,
    'expired_product': 3,
    'low_stock': 2,
    'expiring_soon': 2,
    'order_update': 1,
    'custom': 1
  };
  
  const ageScore = Math.min(this.ageInHours / 24, 3); // Max 3 points for age
  
  return (severityScore[this.severity] || 1) + (typeScore[this.type] || 1) + ageScore;
});

// Static method to create low stock alerts
alertSchema.statics.createLowStockAlert = async function(product, shop) {
  return this.create({
    title: 'Low Stock Alert',
    message: `Product "${product.name}" is running low (${product.quantity} remaining)`,
    type: 'low_stock',
    severity: 'warning',
    shop: shop,
    relatedEntity: {
      entityType: 'product',
      entityId: product._id
    },
    metadata: {
      productName: product.name,
      currentQuantity: product.quantity,
      threshold: product.lowStockThreshold
    },
    actions: [{
      label: 'Reorder Now',
      action: 'create_purchase_order',
      data: { productId: product._id }
    }]
  });
};

// Static method to create expiration alerts
alertSchema.statics.createExpirationAlert = async function(product, shop, daysUntilExpiry) {
  const severity = daysUntilExpiry <= 0 ? 'error' : daysUntilExpiry <= 3 ? 'warning' : 'info';
  const type = daysUntilExpiry <= 0 ? 'expired_product' : 'expiring_soon';
  
  return this.create({
    title: daysUntilExpiry <= 0 ? 'Product Expired' : 'Product Expiring Soon',
    message: `Product "${product.name}" ${daysUntilExpiry <= 0 ? 'has expired' : `expires in ${daysUntilExpiry} days`}`,
    type: type,
    severity: severity,
    shop: shop,
    relatedEntity: {
      entityType: 'product',
      entityId: product._id
    },
    metadata: {
      productName: product.name,
      expirationDate: product.expirationDate,
      daysUntilExpiry: daysUntilExpiry
    },
    actions: [{
      label: 'Mark for Clearance',
      action: 'mark_clearance',
      data: { productId: product._id }
    }]
  });
};

// Indexes
alertSchema.index({ shop: 1, isRead: 1, createdAt: -1 });
alertSchema.index({ user: 1, isRead: 1, createdAt: -1 });
alertSchema.index({ type: 1, severity: 1 });
alertSchema.index({ isResolved: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
