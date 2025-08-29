const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['superadmin', 'admin', 'staff']
  },
  permissions: [{
    type: String,
    enum: [
      'view_inventory',
      'edit_inventory',
      'delete_inventory',
      'view_reports',
      'generate_reports',
      'manage_staff',
      'view_analytics',
      'manage_orders',
      'manage_suppliers',
      'manage_categories',
      'view_all_shops',
      'manage_subscriptions',
      'manage_inquiries'
    ]
  }],
  description: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update timestamp
roleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Role', roleSchema);
