const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');

class StockService {
  /**
   * Move stock from godown to store
   */
  static async moveGodownToStore(productId, quantity, userId, reason = 'Stock replenishment', notes = '') {
    const session = await Product.startSession();
    session.startTransaction();

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

      // Create stock movement record
      const stockMovement = new StockMovement({
        productId,
        movementType: 'godown_to_store',
        fromLocation: 'godown',
        toLocation: 'store',
        quantity,
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

      // Log activity
      await new ActivityLog({
        userId,
        action: 'STOCK_MOVEMENT',
        productId,
        details: `Moved ${quantity} units from godown to store. Reason: ${reason}`
      }).save({ session });

      await session.commitTransaction();
      return { success: true, product, stockMovement };

    } catch (error) {
      await session.abortTransaction();
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
      const stockMovement = new StockMovement({
        productId,
        movementType: 'store_to_godown',
        fromLocation: 'store',
        toLocation: 'godown',
        quantity,
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

      // Log activity
      await new ActivityLog({
        userId,
        action: 'STOCK_MOVEMENT',
        productId,
        details: `Moved ${quantity} units from store to godown. Reason: ${reason}`
      }).save({ session });

      await session.commitTransaction();
      return { success: true, product, stockMovement };

    } catch (error) {
      await session.abortTransaction();
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

      // Update stock levels
      product.stock.godown += quantity;
      product.stock.total = product.stock.godown + product.stock.store;
      product.quantity = product.stock.total; // Legacy field

      await product.save({ session });

      // Create stock movement record
      const stockMovement = new StockMovement({
        productId,
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
        referenceNumber
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
      return { success: true, product, stockMovement };

    } catch (error) {
      await session.abortTransaction();
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

      // Update stock levels
      product.stock.store -= quantity;
      product.stock.total = product.stock.godown + product.stock.store;
      product.quantity = product.stock.total; // Legacy field

      await product.save({ session });

      // Create stock movement record
      const stockMovement = new StockMovement({
        productId,
        movementType: 'store_out',
        fromLocation: 'store',
        toLocation: 'customer',
        quantity,
        previousStock,
        newStock: {
          godown: product.stock.godown,
          store: product.stock.store,
          total: product.stock.total
        },
        reason: 'Sale',
        performedBy: userId,
        referenceNumber: orderNumber
      });

      await stockMovement.save({ session });

      // Log activity
      await new ActivityLog({
        userId,
        action: 'REDUCE_STOCK',
        productId,
        details: `Sold ${quantity} units from store. Order: ${orderNumber}`
      }).save({ session });

      await session.commitTransaction();
      return { success: true, product, stockMovement };

    } catch (error) {
      await session.abortTransaction();
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
