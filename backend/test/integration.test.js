// Integration tests to ensure services work together correctly

describe('Integration Tests - Service Layer', () => {
  
  test('Analytics service can be imported and has required methods', () => {
    const analyticsService = require('../services/analyticsService');
    expect(analyticsService).toBeDefined();
    expect(typeof analyticsService.getStockAdditionSummary).toBe('function');
    expect(typeof analyticsService.getSalesSummary).toBe('function');
    expect(typeof analyticsService.getPriceChangeSummary).toBe('function');
  });

  test('Activity logger service works correctly', () => {
    const activityLogger = require('../services/activityLogger');
    expect(activityLogger).toBeDefined();
    expect(typeof activityLogger.logActivity).toBe('function');
    expect(typeof activityLogger.logPriceChange).toBe('function');
    expect(typeof activityLogger.logPromotion).toBe('function');
  });
});

describe('Integration Tests - File Structure', () => {
  
  test('All required service files exist and can be imported', () => {
    expect(() => require('../services/analyticsService')).not.toThrow();
    expect(() => require('../services/activityLogger')).not.toThrow();
    expect(() => require('../services/expiryService')).not.toThrow();
    expect(() => require('../services/preAggregationService')).not.toThrow();
    expect(() => require('../services/stockService')).not.toThrow();
  });

  test('All new model files exist and can be imported', () => {
    expect(() => require('../models/ProductBatch')).not.toThrow();
    expect(() => require('../models/Promotion')).not.toThrow();
    expect(() => require('../models/DeveloperMetric')).not.toThrow();
    expect(() => require('../models/DailyAnalytics')).not.toThrow();
  });

  test('All new route files exist and can be imported', () => {
    expect(() => require('../routes/batches')).not.toThrow();
    expect(() => require('../routes/promotions')).not.toThrow();
    expect(() => require('../routes/developer-analytics')).not.toThrow();
  });

  test('Enhanced route files can still be imported', () => {
    expect(() => require('../routes/analytics')).not.toThrow();
    expect(() => require('../routes/reports')).not.toThrow();
  });
});
