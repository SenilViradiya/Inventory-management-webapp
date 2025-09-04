const ProductBatch = require('../models/ProductBatch');
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');

/**
 * Scans product batches and marks expired batches. For each expired batch with qty>0,
 * emits a StockMovement with movementType 'expired' and reduces product-level stock totals.
 */
async function runExpiryCheck() {
  const today = new Date();
  const expiredBatches = await ProductBatch.find({ expiryDate: { $lte: today }, totalQty: { $gt: 0 }, status: { $ne: 'expired' } });
  for (const b of expiredBatches) {
    const remaining = b.totalQty;
    // create an expired movement
    await new StockMovement({
      productId: b.productId,
      batchId: b._id,
      movementType: 'expired',
      fromLocation: 'store',
      toLocation: 'external',
      quantity: remaining,
      previousStock: { godown: b.godownQty, store: b.storeQty, total: b.totalQty },
      newStock: { godown: 0, store: 0, total: 0 },
      reason: 'Expired',
      performedBy: null,
      unitPrice: b.purchasePrice || 0
    }).save();

    // Adjust product totals conservatively (attempt both store/godown reductions)
    const product = await Product.findById(b.productId);
    if (product) {
      // reduce store first then godown
      const reduceFromStore = Math.min(product.stock.store, remaining);
      product.stock.store -= reduceFromStore;
      let left = remaining - reduceFromStore;
      const reduceFromGodown = Math.min(product.stock.godown, left);
      product.stock.godown -= reduceFromGodown;
      product.stock.total = product.stock.godown + product.stock.store;
      product.quantity = product.stock.total;
      await product.save();
    }

    b.godownQty = 0;
    b.storeQty = 0;
    b.totalQty = 0;
    b.status = 'expired';
    await b.save();
  }
}

module.exports = { runExpiryCheck };
