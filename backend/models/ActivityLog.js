const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE_PRODUCT',
      'UPDATE_PRODUCT',
      'UPDATE_QUANTITY',
      'DELETE_PRODUCT',
      'REDUCE_STOCK',
      'INCREASE_STOCK',
      'REVERSE_ADJUSTMENT',
      'LOGIN',
      'LOGOUT',
      'EXPORT_REPORT',
      'BULK_REDUCTION'
    ]
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  change: {
    type: Number, // Quantity change (+/-)
    default: 0
  },
  previousValue: {
    type: Number // Previous quantity value
  },
  newValue: {
    type: Number // New quantity value
  },
  details: {
    type: String, // Additional details about the action
    default: ''
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  reversible: {
    type: Boolean,
    default: false
  },
  reversed: {
    type: Boolean,
    default: false
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reversedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
activityLogSchema.index({ userId: 1 });
activityLogSchema.index({ productId: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ reversed: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
