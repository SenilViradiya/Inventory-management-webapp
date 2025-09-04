const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  movementType: {
    type: String,
    enum: [
      'godown_to_store',    // Move from godown to store
      'store_to_godown',    // Move from store to godown
      'godown_in',          // Stock arrival to godown
      'godown_out',         // Stock removal from godown
      'store_in',           // Stock arrival to store
      'store_out',          // Stock removal from store (sale)
      'adjustment',         // Stock adjustment/correction
      'expired',            // Stock removed due to expiry
      'damaged',            // Stock removed due to damage
      'returned'            // Stock returned from customer
    ],
    required: true
  },
  fromLocation: {
    type: String,
    enum: ['godown', 'store', 'external', 'supplier', 'customer'],
    required: true
  },
  toLocation: {
    type: String,
    enum: ['godown', 'store', 'external', 'supplier', 'customer'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductBatch'
  },
  unitPrice: { // price per unit at time of movement (purchase or sale)
    type: Number,
    default: 0,
    min: 0
  },
  previousStock: {
    godown: { type: Number, default: 0 },
    store: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  newStock: {
    godown: { type: Number, default: 0 },
    store: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  reason: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  batchNumber: {
    type: String,
    default: ''
  },
  referenceNumber: {
    type: String, // Order number, delivery note, etc.
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better query performance
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ movementType: 1 });
stockMovementSchema.index({ performedBy: 1 });
stockMovementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
