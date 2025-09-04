const StockService = require('../services/stockService');

// Mock models used by StockService
jest.mock('../models/Product', () => {
  return {
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    }),
    findById: jest.fn()
  };
});

jest.mock('../models/ProductBatch', () => {
  return jest.fn().mockImplementation(() => ({
    save: jest.fn()
  }));
});

jest.mock('../models/StockMovement', () => {
  return jest.fn().mockImplementation(() => ({ save: jest.fn() }));
});

jest.mock('../models/Promotion', () => ({ findOne: jest.fn() }));

jest.mock('../models/ActivityLog', () => {
  return jest.fn().mockImplementation(() => ({ save: jest.fn().mockResolvedValue(true) }));
});

const Product = require('../models/Product');
const ProductBatch = require('../models/ProductBatch');
const StockMovement = require('../models/StockMovement');
const Promotion = require('../models/Promotion');

describe('StockService (batch-aware) unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('addGodownStock creates a new batch when none exists and records movement', async () => {
    const fakeSession = await Product.startSession();

    // Mock product
    const product = {
      _id: 'prod1',
      price: 10,
      stock: { godown: 0, store: 0, total: 0 },
      save: jest.fn()
    };
  // Mock findById(...).session(session) chain
  Product.findById.mockImplementation(() => ({ session: () => Promise.resolve(product) }));

  // Batch findOne should support chaining .session(session)
  const ProductBatchModel = require('../models/ProductBatch');
  ProductBatchModel.findOne = jest.fn().mockImplementation(() => ({ session: () => Promise.resolve(null) }));

    const result = await StockService.addGodownStock('prod1', 5, 'user1', 'New delivery', 'BATCH-1', 'INV-1');

    expect(Product.findById).toHaveBeenCalledWith('prod1');
    // product saved with updated stock
    expect(product.save).toHaveBeenCalled();
    // Ensure a StockMovement was created (StockMovement constructor mocked)
    const StockMovementMock = require('../models/StockMovement');
    expect(StockMovementMock).toHaveBeenCalled();
  });

  test('processSale consumes from batches FEFO and throws if insufficient batch stock', async () => {
    // Prepare product with store stock but batch storeQty insufficient
    const product = {
      _id: 'prod2',
      price: 5,
      // set product store stock >= requested quantity so batch-level insufficiency is tested
      stock: { godown: 0, store: 3, total: 3 },
      save: jest.fn()
    };
  Product.findById.mockImplementation(() => ({ session: () => Promise.resolve(product) }));

    // Mock batches with storeQty 1 each (total 2) so sale of 3 should throw
    const batchA = { _id: 'b1', storeQty: 1, save: jest.fn(), sellingPrice: 0 };
    const batchB = { _id: 'b2', storeQty: 1, save: jest.fn(), sellingPrice: 0 };
  const ProductBatchModel = require('../models/ProductBatch');
  // Mock find(...).sort(...).session(session) chain
  ProductBatchModel.find = jest.fn().mockImplementation(() => ({ sort: () => ({ session: () => Promise.resolve([batchA, batchB]) }) }));

    // No active promotion
  // Promotion.findOne may be called with .session(session) chain
  Promotion.findOne.mockImplementation(() => ({ session: () => Promise.resolve(null) }));

    await expect(StockService.processSale('prod2', 3, 'user2', 'ORDER-1')).rejects.toThrow(/Insufficient batch-level store stock/);
  });
});
