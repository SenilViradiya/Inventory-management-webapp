const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'United States'
    }
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String,
    position: String
  },
  paymentTerms: {
    type: String,
    enum: ['net_15', 'net_30', 'net_60', 'cash_on_delivery', 'advance_payment'],
    default: 'net_30'
  },
  currency: {
    type: String,
    default: 'USD'
  },
  taxId: {
    type: String
  },
  bankDetails: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    routingNumber: String,
    swiftCode: String
  },
  categories: [{
    type: String
  }],
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  notes: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastOrderDate: {
    type: Date
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual for full address
supplierSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.postalCode}, ${addr.country}`;
});

// Indexes
supplierSchema.index({ shop: 1, isActive: 1 });
supplierSchema.index({ shop: 1, name: 1 });
supplierSchema.index({ email: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
