const analyticsService = require('../services/analyticsService');

// Mock models
jest.mock('../models/StockMovement', () => ({
  aggregate: jest.fn()
}));

jest.mock('../models/ActivityLog', () => ({
  find: jest.fn()
}));

const StockMovement = require('../models/StockMovement');
const ActivityLog = require('../models/ActivityLog');

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getStockAdded aggregates godown_in and store_in movements correctly', async () => {
    const mockAggResult = [{ totalQty: 100, totalCost: 500, count: 5 }];
    StockMovement.aggregate.mockResolvedValue(mockAggResult);

    const start = new Date('2025-01-01');
    const end = new Date('2025-01-02');
    
    const result = await analyticsService.getStockAdded({ start, end });

    expect(StockMovement.aggregate).toHaveBeenCalledWith([
      { $match: { movementType: { $in: ['godown_in', 'store_in'] }, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, totalQty: { $sum: '$quantity' }, totalCost: { $sum: { $multiply: ['$quantity', '$unitPrice'] } }, count: { $sum: 1 } } }
    ]);

    expect(result).toEqual({ totalQty: 100, totalCost: 500, count: 5 });
  });

  test('getStockAdded returns default values when no data', async () => {
    StockMovement.aggregate.mockResolvedValue([]);

    const result = await analyticsService.getStockAdded({});

    expect(result).toEqual({ totalQty: 0, totalCost: 0, count: 0 });
  });

  test('getSalesSummary calculates revenue and cost correctly', async () => {
    const mockAggResult = [{ 
      totalQty: 50, 
      revenue: 1000, 
      cost: 600, 
      transactions: 10 
    }];
    StockMovement.aggregate.mockResolvedValue(mockAggResult);

    const result = await analyticsService.getSalesSummary({});

    expect(result).toEqual({ totalQty: 50, revenue: 1000, cost: 600, transactions: 10 });
  });

  test('getPriceChanges filters by PRICE_UPDATE action and adds calculated fields', async () => {
    const mockEntries = [
      {
        _id: '1',
        action: 'PRICE_UPDATE',
        priceChange: { previousPrice: 10, newPrice: 12 },
        productId: { name: 'Product 1' }
      },
      {
        _id: '2', 
        action: 'PRICE_UPDATE',
        priceChange: { previousPrice: 15, newPrice: 12 },
        productId: { name: 'Product 2' }
      }
    ];

    ActivityLog.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockEntries)
    });

    const result = await analyticsService.getPriceChanges({});

    expect(result.count).toBe(2);
    expect(result.entries[0].priceIncrease).toBe(2); // 12 - 10
    expect(result.entries[0].percentChange).toBe('20.00'); // (2/10)*100
    expect(result.entries[1].priceIncrease).toBe(-3); // 12 - 15
    expect(result.entries[1].percentChange).toBe('-20.00'); // (-3/15)*100
  });

  test('rangeForDay creates correct start and end dates', () => {
    const testDate = new Date('2025-01-15T14:30:00');
    const range = analyticsService.rangeForDay(testDate);

    expect(range.start).toEqual(new Date('2025-01-15T00:00:00'));
    expect(range.end).toEqual(new Date('2025-01-16T00:00:00'));
  });

  test('rangeForDay uses current date when no date provided', () => {
    const now = new Date();
    const expectedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expectedEnd = new Date(expectedStart.getTime() + 24 * 60 * 60 * 1000);

    const range = analyticsService.rangeForDay();

    expect(range.start.getTime()).toBe(expectedStart.getTime());
    expect(range.end.getTime()).toBe(expectedEnd.getTime());
  });
});
