const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');
const ProductBatch = require('../models/ProductBatch');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');

/**
 * Utility to build a date range (start,end) for a given day or range
 */
function rangeForDay(date) {
  const d = date ? new Date(date) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function getStockAdded({ start, end }) {
  const match = { movementType: { $in: ['godown_in', 'store_in'] } };
  if (start && end) match.createdAt = { $gte: start, $lt: end };

  const agg = await StockMovement.aggregate([
    { $match: match },
    { $group: { _id: null, totalQty: { $sum: '$quantity' }, totalCost: { $sum: { $multiply: ['$quantity', '$unitPrice'] } }, count: { $sum: 1 } } }
  ]);

  return agg[0] || { totalQty: 0, totalCost: 0, count: 0 };
}

async function getStockMovementsSummary({ start, end }) {
  const match = {};
  if (start && end) match.createdAt = { $gte: start, $lt: end };

  const agg = await StockMovement.aggregate([
    { $match: match },
    { $group: { _id: '$movementType', count: { $sum: 1 }, totalQty: { $sum: '$quantity' }, totalValue: { $sum: { $multiply: ['$quantity', '$unitPrice'] } } } }
  ]);

  return agg;
}

async function getSalesSummary({ start, end }) {
  const match = { movementType: 'store_out' };
  if (start && end) match.createdAt = { $gte: start, $lt: end };

  const agg = await StockMovement.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'productbatches',
        localField: 'batchId',
        foreignField: '_id',
        as: 'batch'
      }
    },
    { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        totalQty: { $sum: '$quantity' },
        revenue: { $sum: { $multiply: ['$quantity', '$unitPrice'] } },
        cost: { $sum: { $multiply: ['$quantity', { $ifNull: ['$batch.purchasePrice', 0] }] } },
        transactions: { $sum: 1 }
      }
    }
  ]);

  return agg[0] || { totalQty: 0, revenue: 0, cost: 0, transactions: 0 };
}

async function getPriceChanges({ start, end, limit = 50 }) {
  const match = { action: 'PRICE_UPDATE' };
  if (start && end) match.createdAt = { $gte: start, $lt: end };

  const entries = await ActivityLog.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('productId', 'name price')
    .lean();

  return { 
    count: entries.length, 
    entries: entries.map(e => ({
      ...e,
      priceIncrease: e.priceChange ? (e.priceChange.newPrice - e.priceChange.previousPrice) : 0,
      percentChange: e.priceChange && e.priceChange.previousPrice > 0 
        ? ((e.priceChange.newPrice - e.priceChange.previousPrice) / e.priceChange.previousPrice * 100).toFixed(2)
        : 0
    }))
  };
}

async function getPromotionImpact({ start, end }) {
  const match = { movementType: 'store_out' };
  if (start && end) match.createdAt = { $gte: start, $lt: end };

  // Sales where unitPrice < product.price are likely promotional
  const agg = await StockMovement.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        quantity: 1,
        unitPrice: 1,
        normalPrice: '$product.price',
        promo: { $cond: [{ $lt: ['$unitPrice', '$product.price'] }, true, false] }
      }
    },
    {
      $group: {
        _id: '$promo',
        qty: { $sum: '$quantity' },
        revenue: { $sum: { $multiply: ['$quantity', '$unitPrice'] } }
      }
    }
  ]);

  const result = { promoQty: 0, promoRevenue: 0, normalQty: 0, normalRevenue: 0 };
  for (const r of agg) {
    if (r._id === true) {
      result.promoQty = r.qty; result.promoRevenue = r.revenue;
    } else {
      result.normalQty = r.qty; result.normalRevenue = r.revenue;
    }
  }

  return result;
}

module.exports = {
  rangeForDay,
  getStockAdded,
  getStockMovementsSummary,
  getSalesSummary,
  getPriceChanges,
  getPromotionImpact
};
