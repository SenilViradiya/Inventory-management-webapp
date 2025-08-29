const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    monthly: {
      type: Number,
      required: true
    },
    yearly: {
      type: Number,
      required: true
    }
  },
  features: {
    maxProducts: {
      type: Number,
      default: -1 // -1 means unlimited
    },
    maxStaff: {
      type: Number,
      default: -1
    },
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    exportReports: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    multiLocation: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  stripeProductId: {
    type: String
  },
  stripePriceIds: {
    monthly: String,
    yearly: String
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

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'cancelled', 'expired', 'trialing'],
    default: 'active'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  trialEnd: {
    type: Date
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date
  },
  endedAt: {
    type: Date
  },
  payment: {
    stripeSubscriptionId: {
      type: String,
      unique: true,
      sparse: true
    },
    stripeCustomerId: {
      type: String
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paypal', 'manual'],
      default: 'stripe'
    },
    lastPaymentDate: {
      type: Date
    },
    nextPaymentDate: {
      type: Date
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  coupon: {
    code: {
      type: String
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100
    },
    discountAmount: {
      type: Number,
      min: 0
    },
    validUntil: {
      type: Date
    }
  },
  metadata: {
    type: Map,
    of: String
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

// Virtual for checking if subscription is active
subscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && new Date() < this.currentPeriodEnd;
});

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function() {
  const today = new Date();
  const end = new Date(this.currentPeriodEnd);
  const diffTime = end - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
subscriptionSchema.index({ user: 1 });
subscriptionSchema.index({ shop: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = { SubscriptionPlan, Subscription };
