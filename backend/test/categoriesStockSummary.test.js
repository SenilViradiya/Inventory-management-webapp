// Tests for category stock-summary endpoint
// Mocks models and authentication middleware to exercise route logic in isolation

// Mock middleware before requiring the route so router picks up the mocked middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    // Provide a superadmin user so shopFilter is bypassed
    req.user = { id: 'user1', role: 'superadmin' };
    return next();
  },
  requirePermission: () => (req, res, next) => next()
}));

// Mock models with explicit factories to avoid loading Mongoose
jest.mock('../models/Category', () => ({
  find: jest.fn()
}));

jest.mock('../models/Product', () => ({
  find: jest.fn()
}));

jest.mock('../models/ActivityLog', () => {
  return jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue(true)
  }));
});

// Mock User model so routes that call User.findById don't try to cast a non-ObjectId
jest.mock('../models/User', () => ({
  findById: jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue({
      _id: 'user1',
      username: 'testuser',
      isActive: true,
      role: { name: 'superadmin', permissions: [] },
      shop: null
    })
  })
}));

const express = require('express');
const request = require('supertest');

const Category = require('../models/Category');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');

// Require the router after mocks are in place
const categoriesRouter = require('../routes/categories');

describe('GET /api/categories/stock-summary', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/categories', categoriesRouter);
  });

  test('returns overall and category stock summary (all products)', async () => {
    const category = { _id: 'c1', name: 'TestCategory', description: 'desc' };

    // Category.find(...).sort(...)
    Category.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([category]) });

    const product1 = {
      _id: 'p1',
      name: 'Prod A',
      brand: 'BrandA',
      qrCode: 'q1',
      price: 20,
      description: 'd1',
      stock: { godown: 5, store: 5, total: 10, reserved: 2 },
      lowStockThreshold: 5,
      expirationDate: null,
      createdBy: { fullName: 'Creator A' },
      updatedAt: new Date(),
      createdAt: new Date()
    };

    const product2 = {
      _id: 'p2',
      name: 'Prod B',
      brand: 'BrandB',
      qrCode: 'q2',
      price: 10,
      description: 'd2',
      stock: { godown: 1, store: 1, total: 2, reserved: 0 },
      lowStockThreshold: 5,
      expirationDate: null,
      createdBy: { fullName: 'Creator B' },
      updatedAt: new Date(),
      createdAt: new Date()
    };

    Product.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([product1, product2]) });

    const res = await request(app)
      .get('/api/categories/stock-summary')
      .query({ categoryName: 'TestCategory' })
      .expect(200);

    expect(res.body.success).toBe(true);
    // One category found
    expect(res.body.summary.totalCategories).toBe(1);
    // Two products in category
    expect(res.body.summary.totalProducts).toBe(2);
    // Category-level total products
    expect(res.body.categories[0].stockSummary.totalProducts).toBe(2);
    // Overall stock total should be 12 (10 + 2)
    expect(res.body.summary.overallStock.total).toBe(12);
    // ActivityLog should have been called to record viewing summary
    expect(ActivityLog).toHaveBeenCalled();
    expect(ActivityLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'VIEW_CATEGORY_STOCK_SUMMARY' }));
  });

  test('applies stockFilter=low and returns only low-stock products', async () => {
    const category = { _id: 'c2', name: 'LowCategory', description: 'low desc' };
    Category.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([category]) });

    const productLow = {
      _id: 'p3',
      name: 'Low Prod',
      price: 5,
      stock: { godown: 0, store: 2, total: 2, reserved: 0 },
      lowStockThreshold: 5,
      createdBy: { fullName: 'Creator' },
      updatedAt: new Date(),
      createdAt: new Date()
    };

    const productNormal = {
      _id: 'p4',
      name: 'Normal Prod',
      price: 15,
      stock: { godown: 10, store: 5, total: 15, reserved: 0 },
      lowStockThreshold: 5,
      createdBy: { fullName: 'Creator' },
      updatedAt: new Date(),
      createdAt: new Date()
    };

    Product.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([productLow, productNormal]) });

    const res = await request(app)
      .get('/api/categories/stock-summary')
      .query({ categoryName: 'LowCategory', stockFilter: 'low' })
      .expect(200);

    expect(res.body.success).toBe(true);
    // Only the low stock product should be counted
    expect(res.body.summary.totalProducts).toBe(1);
    expect(res.body.summary.overallStock.total).toBe(2);
    expect(res.body.categories[0].stockSummary.totalProducts).toBe(1);
  });

});
