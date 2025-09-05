const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const ProductBatch = require('../models/ProductBatch');
const Promotion = require('../models/Promotion');

class StockService {
  /**
   * Move stock from godown to store
   */
  static async moveGodownToStore(productId, quantity, userId, reason = 'Stock replenishment', notes = '') {
    const session = await Product.startSession();
    session.startTransaction();
    let transactionCommitted = false;

    try {
      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw new Error('Product not found');
      }

      // Check if enough stock in godown
      if (product.stock.godown < quantity) {
        throw new Error(`Insufficient stock in godown. Available: ${product.stock.godown}, Requested: ${quantity}`);
      }

      // Store previous stock levels
      const previousStock = {
        godown: product.stock.godown,
        store: product.stock.store,
        total: product.stock.total
      };

      // Update stock levels
      product.stock.godown -= quantity;
      product.stock.store += quantity;
      product.stock.total = product.stock.godown + product.stock.store;
      product.quantity = product.stock.total; // Legacy field

      await product.save({ session });

      // Allocate movement to batches using FEFO (earliest expiry first). If batches do not cover
      // the movement, create a fallback generic movement for the remainder.
      let remaining = quantity;
      const movements = [];

      const batches = await ProductBatch.find({ productId, godownQty: { $gt: 0 } }).sort({ expiryDate: 1 }).session(session);
      for (const b of batches) {
        if (remaining <= 0) break;
        const take = Math.min(b.godownQty, remaining);
        if (take <= 0) continue;

        b.godownQty -= take;
        b.storeQty += take;
        await b.save({ session });

        const mv = new StockMovement({
          productId,
          batchId: b._id,
          movementType: 'godown_to_store',
          fromLocation: 'godown',
          toLocation: 'store',
          quantity: take,
          previousStock,
          newStock: {
            godown: product.stock.godown,
            store: product.stock.store,
            total: product.stock.total
          },
          reason,
          notes,
          performedBy: userId,
          unitPrice: b.purchasePrice || 0
        });

        await mv.save({ session });
        movements.push(mv);
        remaining -= take;
      }

      if (remaining > 0) {
        const stockMovement = new StockMovement({
          productId,
          movementType: 'godown_to_store',
          fromLocation: 'godown',
          toLocation: 'store',
          quantity: remaining,
          previousStock,
          newStock: {
            godown: product.stock.godown,
            store: product.stock.store,
            total: product.stock.total
          },
          reason,
          notes,
          performedBy: userId
        });

        await stockMovement.save({ session });
        movements.push(stockMovement);
      }

      // Log activity
      await new ActivityLog({
        userId,
        action: 'STOCK_MOVEMENT',
        productId,
        details: `Moved ${quantity} units from godown to store. Reason: ${reason}`
      }).save({ session });

      await session.commitTransaction();
      transactionCommitted = true;
      
      return { success: true, product, movements };

    } catch (error) {
      if (!transactionCommitted) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Move stock from store to godown
   */
  static async moveStoreToGodown(productId, quantity, userId, reason = 'Stock return', notes = '') {
    const session = await Product.startSession();
    session.startTransaction();
    let transactionCommitted = false;

    try {
      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw new Error('Product not found');
      }

      // Check if enough stock in store
      if (product.stock.store < quantity) {
        throw new Error(`Insufficient stock in store. Available: ${product.stock.store}, Requested: ${quantity}`);
      }

      // Store previous stock levels
      const previousStock = {
        godown: product.stock.godown,
        store: product.stock.store,
        total: product.stock.total
      };

      // Update stock levels
      product.stock.store -= quantity;
      product.stock.godown += quantity;
      product.stock.total = product.stock.godown + product.stock.store;
      product.quantity = product.stock.total; // Legacy field

      await product.save({ session });

      // Create stock movement record
      // Allocate movement to batches from store to godown (FEFO ordering).
      let remainingRev = quantity;
      const movementsRev = [];
      const storeBatches = await ProductBatch.find({ productId, storeQty: { $gt: 0 } }).sort({ expiryDate: 1 }).session(session);
      for (const b of storeBatches) {
        if (remainingRev <= 0) break;
        const take = Math.min(b.storeQty, remainingRev);
        if (take <= 0) continue;

        b.storeQty -= take;
        b.godownQty += take;
        await b.save({ session });

        const mv = new StockMovement({
          productId,
          batchId: b._id,
          movementType: 'store_to_godown',
          fromLocation: 'store',
          toLocation: 'godown',
          quantity: take,
          previousStock,
          newStock: {
            godown: product.stock.godown,
            store: product.stock.store,
            total: product.stock.total
          },
          reason,
          notes,
          performedBy: userId,
          unitPrice: b.purchasePrice || 0
        });

        await mv.save({ session });
        movementsRev.push(mv);
        remainingRev -= take;
      }

      if (remainingRev > 0) {
        const stockMovement = new StockMovement({
          productId,
          movementType: 'store_to_godown',
          fromLocation: 'store',
          toLocation: 'godown',
          quantity: remainingRev,
          previousStock,
          newStock: {
            godown: product.stock.godown,
            store: product.stock.store,
            total: product.stock.total
          },
          reason,
          notes,
          performedBy: userId
        });

        await stockMovement.save({ session });
        movementsRev.push(stockMovement);
      }

      // Log activity
      await new ActivityLog({
        userId,
        action: 'STOCK_MOVEMENT',
        productId,
        details: `Moved ${quantity} units from store to godown. Reason: ${reason}`
      }).save({ session });

      await session.commitTransaction();
      transactionCommitted = true;
      
      return { success: true, product, movements: movementsRev };

    } catch (error) {
      if (!transactionCommitted) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Add stock to godown (new delivery)
   */
  static async addGodownStock(productId, quantity, userId, reason = 'New delivery', batchNumber = '', referenceNumber = '') {
    const session = await Product.startSession();
    session.startTransaction();
    let transactionCommitted = false;

    try {
      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw new Error('Product not found');
      }

      // Store previous stock levels
      const previousStock = {
        godown: product.stock.godown,
        store: product.stock.store,
        total: product.stock.total
      };

      // Create or update a ProductBatch for this delivery. Prefer matching by batchNumber + invoice.
      let batch = null;
      if (batchNumber) {
        batch = await ProductBatch.findOne({ productId, batchNumber }).session(session);
      }

      if (!batch) {
        batch = new ProductBatch({
          productId,
          batchNumber: batchNumber || '',
          purchasePrice: 0,
          sellingPrice: product.price || 0,
          godownQty: quantity,
          originalQty: quantity,
          supplierName: '',
          invoiceNumber: referenceNumber,
          createdBy: userId
        });
      } else {
        batch.godownQty += quantity;
        batch.originalQty += quantity;
      }

      await batch.save({ session });

      // Update product-level stock totals
      product.stock.godown += quantity;
      product.stock.total = product.stock.godown + product.stock.store;
      product.quantity = product.stock.total; // Legacy field
      await product.save({ session });

      // Create stock movement record referencing batch
      const stockMovement = new StockMovement({
        productId,
        batchId: batch._id,
        movementType: 'godown_in',
        fromLocation: 'supplier',
        toLocation: 'godown',
        quantity,
        previousStock,
        newStock: {
          godown: product.stock.godown,
          store: product.stock.store,
          total: product.stock.total
        },
        reason,
        performedBy: userId,
        batchNumber,
        referenceNumber,
        unitPrice: batch.purchasePrice || 0
      });

      await stockMovement.save({ session });

      // Log activity
      await new ActivityLog({
        userId,
        action: 'INCREASE_STOCK',
        productId,
        details: `Added ${quantity} units to godown. Reason: ${reason}`
      }).save({ session });

      await session.commitTransaction();
      transactionCommitted = true;
      
      return { success: true, product, stockMovement, batch };

    } catch (error) {
      if (!transactionCommitted) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Process sale from store
   */
  static async processSale(productId, quantity, userId, orderNumber = '') {
    const session = await Product.startSession();
    session.startTransaction();
    let transactionCommitted = false;

    try {
      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw new Error('Product not found');
      }

      // Check if enough stock in store
      if (product.stock.store < quantity) {
        throw new Error(`Insufficient stock in store for sale. Available: ${product.stock.store}, Requested: ${quantity}`);
      }

      // Store previous stock levels
      const previousStock = {
        godown: product.stock.godown,
        store: product.stock.store,
        total: product.stock.total
      };


      // Consume from batches using FEFO (earliest expiry first). Record a StockMovement for each batch consumed.
      let remaining = quantity;
      const movements = [];

      const storeBatches = await ProductBatch.find({ productId, storeQty: { $gt: 0 } }).sort({ expiryDate: 1 }).session(session);
      for (const b of storeBatches) {
        if (remaining <= 0) break;
        const take = Math.min(b.storeQty, remaining);
        if (take <= 0) continue;

        b.storeQty -= take;
        await b.save({ session });

        product.stock.store -= take;

        // Determine sale unit price: promotion > batch sellingPrice > product price
        let unitPrice = product.price || 0;
        const now = new Date();
        const promo = await Promotion.findOne({ productId: product._id, active: true, startDate: { $lte: now }, endDate: { $gte: now } }).session(session);
        if (promo && promo.promoPrice) unitPrice = promo.promoPrice;
        else if (b.sellingPrice && b.sellingPrice > 0) unitPrice = b.sellingPrice;

        const mv = new StockMovement({
          productId,
          batchId: b._id,
          movementType: 'store_out',
          fromLocation: 'store',
          toLocation: 'customer',
          quantity: take,
          previousStock,
          newStock: {
            godown: product.stock.godown,
            store: product.stock.store,
            total: product.stock.total
          },
          reason: 'Sale',
          performedBy: userId,
          referenceNumber: orderNumber,
          unitPrice
        });

        await mv.save({ session });
        movements.push(mv);
        remaining -= take;
      }

      if (remaining > 0) {
        throw new Error(`Insufficient batch-level store stock. Remaining: ${remaining}`);
      }

      // Update product totals and save
      product.stock.total = product.stock.godown + product.stock.store;
      product.quantity = product.stock.total;
      await product.save({ session });

      // Log activity
      await new ActivityLog({
        userId,
        action: 'REDUCE_STOCK',
        productId,
        details: `Sold ${quantity} units from store. Order: ${orderNumber}`
      }).save({ session });

      await session.commitTransaction();
      transactionCommitted = true;
      
      return { 
        success: true, 
        product, 
        movements,
        totalQuantitySold: quantity,
        orderNumber 
      };

    } catch (error) {
      if (!transactionCommitted) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get stock movement history for a product
   */
  static async getStockHistory(productId, limit = 50) {
    return await StockMovement.find({ productId })
      .populate('performedBy', 'username fullName')
      .populate('batchId')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Get current stock summary
   */
  static async getStockSummary() {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalGodownStock: { $sum: '$stock.godown' },
          totalStoreStock: { $sum: '$stock.store' },
          totalStock: { $sum: '$stock.total' },
          lowStockProducts: {
            $sum: {
              $cond: [
                { $lte: ['$stock.total', '$lowStockThreshold'] },
                1,
                0
              ]
            }
          },
          outOfStockProducts: {
            $sum: {
              $cond: [
                { $eq: ['$stock.total', 0] },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    const result = await Product.aggregate(pipeline);
    return result[0] || {
      totalProducts: 0,
      totalGodownStock: 0,
      totalStoreStock: 0,
      totalStock: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0
    };
  }
}

module.exports = StockService;
