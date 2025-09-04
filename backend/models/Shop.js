const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Merged owner information from Business model
  owner: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    zipCode: String, // Added for compatibility
    country: String
  },
  // Additional business fields
  description: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  // Organization type determines available roles
  organizationType: {
    type: String,
    enum: ['my-organization', 'client-organization'],
    default: 'client-organization'
  },
  // Available roles based on organization type
  availableRoles: [{
    type: String,
    default: function() {
      if (this.organizationType === 'my-organization') {
        return ['developer', 'tester', 'marketer', 'designer', 'manager', 'admin', 'superadmin'];
      } else {
        return ['staff', 'admin'];
      }
    }
  }],
  // Users in this organization/shop
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  staff: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role'
    },
    permissions: [{
      type: String
    }],
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  subscription: {
    plan: {
      type: String,
      enum: ['trial', 'free', 'basic', 'premium', 'enterprise'],
      default: 'trial'
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'suspended'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: function() {
        // Default 30 days trial
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    },
    expiryDate: {
      type: Date,
      get: function() {
        return this.endDate;
      },
      set: function(value) {
        this.endDate = value;
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    trialExtensions: {
      type: Number,
      default: 0
    },
    paymentId: String,
    customerId: String
  },
  settings: {
    // Enhanced settings from both models
    maxUsers: {
      type: Number,
      default: 5
    },
    maxProducts: {
      type: Number,
      default: 100
    },
    features: [{
      type: String,
      enum: [
        'inventory_management',
        'qr_scanning',
        'analytics',
        'reports',
        'multi_user',
        'api_access',
        'priority_support'
      ]
    }],
    lowStockThreshold: {
      type: Number,
      default: 10
    },
    currency: {
      type: String,
      default: 'USD'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    notifications: {
      lowStock: {
        type: Boolean,
        default: true
      },
      expiredProducts: {
        type: Boolean,
        default: true
      },
      newOrders: {
        type: Boolean,
        default: true
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true,
    get: function() {
      return this.status === 'active';
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual for subscription status
shopSchema.virtual('isSubscriptionActive').get(function() {
  return this.subscription.status === 'active' && new Date() < (this.subscription.endDate || this.subscription.expiryDate);
});

// Virtual for days until subscription expires
shopSchema.virtual('daysUntilExpiry').get(function() {
  const today = new Date();
  const expiry = new Date(this.subscription.endDate || this.subscription.expiryDate);
  const diffTime = expiry - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Index for efficient queries (merged from both models)
shopSchema.index({ 'owner.email': 1 });
shopSchema.index({ 'subscription.endDate': 1 });
shopSchema.index({ 'subscription.expiryDate': 1 });
shopSchema.index({ status: 1 });
shopSchema.index({ organizationType: 1 });

// Pre-save middleware
shopSchema.pre('save', function(next) {
  // Sync expiryDate with endDate for backward compatibility
  if (this.subscription.endDate && !this.subscription.expiryDate) {
    this.subscription.expiryDate = this.subscription.endDate;
  }
  if (this.subscription.expiryDate && !this.subscription.endDate) {
    this.subscription.endDate = this.subscription.expiryDate;
  }
  next();
});

module.exports = mongoose.model('Shop', shopSchema);
