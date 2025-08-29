const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  receivedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: String
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    required: true,
    unique: true
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  items: [purchaseOrderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shipping: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'],
    default: 'draft'
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  terms: {
    type: String,
    default: 'Net 30'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  sentAt: {
    type: Date
  },
  receivedAt: {
    type: Date
  },
  statusHistory: [{
    status: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }]
}, {
  timestamps: true
});

// Generate PO number
purchaseOrderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments({ shop: this.shop });
    this.poNumber = `PO-${new Date().getFullYear()}-${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

// Virtual for completion percentage
purchaseOrderSchema.virtual('completionPercentage').get(function() {
  if (!this.items || this.items.length === 0) return 0;
  
  const totalExpected = this.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalReceived = this.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
  
  return Math.round((totalReceived / totalExpected) * 100);
});

// Virtual for days overdue
purchaseOrderSchema.virtual('daysOverdue').get(function() {
  if (!this.expectedDeliveryDate || this.status === 'received' || this.status === 'cancelled') {
    return 0;
  }
  
  const today = new Date();
  const expected = new Date(this.expectedDeliveryDate);
  
  if (today > expected) {
    return Math.ceil((today - expected) / (1000 * 60 * 60 * 24));
  }
  
  return 0;
});

// Indexes
purchaseOrderSchema.index({ shop: 1, status: 1 });
purchaseOrderSchema.index({ shop: 1, createdAt: -1 });
purchaseOrderSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ poNumber: 1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
