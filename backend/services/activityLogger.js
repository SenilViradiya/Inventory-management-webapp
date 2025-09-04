const ActivityLog = require('../models/ActivityLog');

/**
 * Consistent activity logging service
 */
class ActivityLogger {
  
  static async logPriceChange(userId, productId, field, previousPrice, newPrice, details = '') {
    return await new ActivityLog({
      userId,
      action: 'PRICE_UPDATE',
      productId,
      priceChange: {
        previousPrice,
        newPrice,
        field
      },
      details: details || `${field} changed from $${previousPrice} to $${newPrice}`,
      metadata: { field, previousPrice, newPrice }
    }).save();
  }

  static async logStockMovement(userId, productId, movementType, quantity, details = '', metadata = {}) {
    return await new ActivityLog({
      userId,
      action: 'STOCK_MOVEMENT',
      productId,
      change: movementType.includes('out') ? -quantity : quantity,
      details,
      metadata: { movementType, ...metadata }
    }).save();
  }

  static async logBatchUpdate(userId, batchId, action, details = '', metadata = {}) {
    return await new ActivityLog({
      userId,
      action: 'BATCH_UPDATE',
      details,
      metadata: { batchId, batchAction: action, ...metadata }
    }).save();
  }

  static async logPromotionActivity(userId, productId, action, details = '', metadata = {}) {
    const actionType = action === 'create' ? 'PROMOTION_CREATED' : 'PROMOTION_UPDATED';
    return await new ActivityLog({
      userId,
      action: actionType,
      productId,
      details,
      metadata
    }).save();
  }
}

module.exports = ActivityLogger;
