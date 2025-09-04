const ActivityLogger = require('../services/activityLogger');

// Mock ActivityLog model
jest.mock('../models/ActivityLog', () => {
  return jest.fn().mockImplementation((data) => {
    const mockInstance = {
      ...data,
      save: jest.fn().mockResolvedValue({ _id: 'mock-id', ...data })
    };
    return mockInstance;
  });
});

const ActivityLog = require('../models/ActivityLog');

describe('ActivityLogger service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('logPriceChange creates proper activity log with price change structure', async () => {
    const result = await ActivityLogger.logPriceChange(
      'user1', 'prod1', 'price', 10.50, 12.00, 'Price increased due to inflation'
    );

    expect(ActivityLog).toHaveBeenCalledWith({
      userId: 'user1',
      action: 'PRICE_UPDATE',
      productId: 'prod1',
      priceChange: {
        previousPrice: 10.50,
        newPrice: 12.00,
        field: 'price'
      },
      details: 'Price increased due to inflation',
      metadata: { field: 'price', previousPrice: 10.50, newPrice: 12.00 }
    });

    expect(result._id).toBe('mock-id');
  });

  test('logStockMovement calculates change correctly for different movement types', async () => {
    // Test outgoing movement (negative change)
    await ActivityLogger.logStockMovement('user1', 'prod1', 'store_out', 5, 'Sale');

    expect(ActivityLog).toHaveBeenCalledWith({
      userId: 'user1',
      action: 'STOCK_MOVEMENT',
      productId: 'prod1',
      change: -5,
      details: 'Sale',
      metadata: { movementType: 'store_out' }
    });

    // Test incoming movement (positive change)
    jest.clearAllMocks();
    await ActivityLogger.logStockMovement('user1', 'prod1', 'godown_in', 10, 'Delivery');

    expect(ActivityLog).toHaveBeenCalledWith({
      userId: 'user1',
      action: 'STOCK_MOVEMENT',
      productId: 'prod1',
      change: 10,
      details: 'Delivery',
      metadata: { movementType: 'godown_in' }
    });
  });

  test('logBatchUpdate includes batch metadata', async () => {
    await ActivityLogger.logBatchUpdate('user1', 'batch1', 'expired', 'Batch marked as expired', { reason: 'past_expiry' });

    expect(ActivityLog).toHaveBeenCalledWith({
      userId: 'user1',
      action: 'BATCH_UPDATE',
      details: 'Batch marked as expired',
      metadata: { batchId: 'batch1', batchAction: 'expired', reason: 'past_expiry' }
    });
  });

  test('logPromotionActivity handles create and update actions', async () => {
    // Test create
    await ActivityLogger.logPromotionActivity('user1', 'prod1', 'create', 'New promotion created');

    expect(ActivityLog).toHaveBeenCalledWith({
      userId: 'user1',
      action: 'PROMOTION_CREATED',
      productId: 'prod1',
      details: 'New promotion created',
      metadata: {}
    });

    // Test update
    jest.clearAllMocks();
    await ActivityLogger.logPromotionActivity('user1', 'prod1', 'update', 'Promotion updated');

    expect(ActivityLog).toHaveBeenCalledWith({
      userId: 'user1',
      action: 'PROMOTION_UPDATED',
      productId: 'prod1',
      details: 'Promotion updated',
      metadata: {}
    });
  });
});
