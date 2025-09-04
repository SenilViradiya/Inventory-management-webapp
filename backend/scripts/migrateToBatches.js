/**
 * migrateToBatches.js
 * Scans existing StockMovement records and creates ProductBatch documents when possible.
 * Supports DRY_RUN=1 to only print actions.
 */
const mongoose = require('mongoose');
const StockMovement = require('../models/StockMovement');
const ProductBatch = require('../models/ProductBatch');
const Product = require('../models/Product');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in environment');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const dryRun = process.env.DRY_RUN === '1';

  // Strategy: for godown_in movements with batchNumber or referenceNumber, create a batch per (productId, batchNumber, referenceNumber)
  const movements = await StockMovement.find({ movementType: 'godown_in' }).sort({ createdAt: 1 });
  const groups = {};
  for (const m of movements) {
    const key = `${m.productId}_${m.batchNumber || ''}_${m.referenceNumber || ''}`;
    groups[key] = groups[key] || { productId: m.productId, batchNumber: m.batchNumber, referenceNumber: m.referenceNumber, total: 0 };
    groups[key].total += m.quantity;
  }

  for (const key of Object.keys(groups)) {
    const g = groups[key];
    console.log(`${dryRun ? '[DRY]' : '[CREATE]'} Batch for product ${g.productId} batchNumber=${g.batchNumber} qty=${g.total}`);
    if (!dryRun) {
      const product = await Product.findById(g.productId);
      const batch = new ProductBatch({
        productId: g.productId,
        batchNumber: g.batchNumber || '',
        purchasePrice: 0,
        sellingPrice: product ? product.price : 0,
        godownQty: g.total,
        originalQty: g.total,
        invoiceNumber: g.referenceNumber || ''
      });
      await batch.save();
    }
  }

  console.log('Migration complete');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
