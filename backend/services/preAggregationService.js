const DailyAnalytics = require('../models/DailyAnalytics');
const analyticsService = require('./analyticsService');

/**
 * Pre-aggregation service for daily analytics snapshots
 */
class PreAggregationService {
  
  static async generateDailySnapshot(date) {
    const { start, end } = analyticsService.rangeForDay(date);
    
    try {
      const [stockAdded, movements, sales, priceChanges, promotions] = await Promise.all([
        analyticsService.getStockAdded({ start, end }),
        analyticsService.getStockMovementsSummary({ start, end }),
        analyticsService.getSalesSummary({ start, end }),
        analyticsService.getPriceChanges({ start, end }),
        analyticsService.getPromotionImpact({ start, end })
      ]);

      // Calculate additional metrics
      const profit = sales.revenue - sales.cost;
      const priceIncreases = priceChanges.entries.filter(e => e.priceIncrease > 0).length;
      const priceDecreases = priceChanges.entries.filter(e => e.priceIncrease < 0).length;

      const snapshot = {
        date: start,
        stockAdded,
        sales: { ...sales, profit },
        movements,
        priceChanges: {
          count: priceChanges.count,
          increases: priceIncreases,
          decreases: priceDecreases
        },
        promotions,
        lastUpdated: new Date()
      };

      // Upsert the daily snapshot
      await DailyAnalytics.findOneAndUpdate(
        { date: start },
        snapshot,
        { upsert: true, new: true }
      );

      return snapshot;
    } catch (error) {
      console.error('Error generating daily snapshot:', error);
      throw error;
    }
  }

  static async getDailySnapshots(startDate, endDate, limit = 30) {
    const query = {};
    if (startDate) query.date = { $gte: new Date(startDate) };
    if (endDate) query.date = { ...query.date, $lte: new Date(endDate) };

    return await DailyAnalytics.find(query)
      .sort({ date: -1 })
      .limit(limit)
      .lean();
  }

  static async generateMissingSnapshots(daysBack = 7) {
    const today = new Date();
    const promises = [];

    for (let i = 0; i < daysBack; i++) {
      const date = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
      promises.push(this.generateDailySnapshot(date));
    }

    return await Promise.allSettled(promises);
  }
}

module.exports = PreAggregationService;
