const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
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
  // Users in this organization
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  subscription: {
    plan: {
      type: String,
      enum: ['trial', 'basic', 'premium', 'enterprise'],
      default: 'trial'
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
    isActive: {
      type: Boolean,
      default: true
    },
    trialExtensions: {
      type: Number,
      default: 0
    }
  },
  settings: {
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
    }]
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
businessSchema.index({ 'owner.email': 1 });
businessSchema.index({ 'subscription.endDate': 1 });
businessSchema.index({ status: 1 });

module.exports = mongoose.model('Business', businessSchema);
