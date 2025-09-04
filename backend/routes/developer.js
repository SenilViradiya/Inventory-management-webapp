const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');

// Middleware to check if user is developer/superadmin
const isDeveloper = (req, res, next) => {
  if (req.user.role === 'superadmin' || req.user.username === 'developer') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Developer privileges required.' });
  }
};

// GET /api/developer/app-summary/:app - Get app summary metrics
router.get('/app-summary/:app', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { app } = req.params;
    const { startDate, endDate } = req.query;

    // Mock data for now - you can implement real metrics based on your needs
    const summary = {
      appName: app,
      version: '1.0.0',
      uptime: '99.9%',
      totalUsers: await User.countDocuments(),
      totalShops: await Shop.countDocuments(),
      totalProducts: await Product.countDocuments(),
      totalOrders: await Order.countDocuments(),
      dateRange: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString()
      },
      metrics: {
        activeUsers: await User.countDocuments({ isActive: true }),
        activeShops: await Shop.countDocuments({ status: 'active' }),
        lowStockProducts: await Product.countDocuments({ quantity: { $lte: 5 } }),
        recentOrders: await Order.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      }
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching app summary', error: error.message });
  }
});

// GET /api/developer/system-metrics - Get system metrics
router.get('/system-metrics', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const metrics = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      database: {
        status: 'connected',
        collections: {
          users: await User.countDocuments(),
          shops: await Shop.countDocuments(),
          products: await Product.countDocuments(),
          orders: await Order.countDocuments()
        }
      },
      api: {
        totalRequests: 0, // You can implement request counting
        averageResponseTime: 0, // You can implement response time tracking
        errorRate: 0 // You can implement error rate tracking
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching system metrics', error: error.message });
  }
});

// GET /api/developer/api-endpoints - Get API endpoints info
router.get('/api-endpoints', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const endpoints = [
      { path: '/api/products', method: 'GET', description: 'Get all products', status: 'active' },
      { path: '/api/products', method: 'POST', description: 'Create new product', status: 'active' },
      { path: '/api/shops', method: 'GET', description: 'Get all shops', status: 'active' },
      { path: '/api/users', method: 'GET', description: 'Get all users', status: 'active' },
      { path: '/api/orders', method: 'GET', description: 'Get all orders', status: 'active' },
      { path: '/api/analytics', method: 'GET', description: 'Get analytics data', status: 'active' },
      { path: '/api/alerts', method: 'GET', description: 'Get alerts', status: 'active' },
      { path: '/api/categories', method: 'GET', description: 'Get categories', status: 'active' }
    ];

    res.json({
      success: true,
      data: endpoints
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching API endpoints', error: error.message });
  }
});

// GET /api/developer/store-analytics/:storeId - Get analytics for specific store
router.get('/store-analytics/:storeId', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { storeId } = req.params;

    const shop = await Shop.findById(storeId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Get analytics for the specific shop
    const analytics = {
      shop: {
        id: shop._id,
        name: shop.name,
        status: shop.status
      },
      products: {
        total: await Product.countDocuments({ shop: storeId }),
        lowStock: await Product.countDocuments({ shop: storeId, quantity: { $lte: 5 } }),
        outOfStock: await Product.countDocuments({ shop: storeId, quantity: 0 })
      },
      orders: {
        total: await Order.countDocuments({ shop: storeId }),
        thisMonth: await Order.countDocuments({
          shop: storeId,
          createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
        })
      },
      revenue: {
        thisMonth: 0, // You can calculate from orders
        lastMonth: 0
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching store analytics', error: error.message });
  }
});

// GET /api/developer/store-requests/:storeId - Get latest requests for specific store
router.get('/store-requests/:storeId', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { storeId } = req.params;

    // Mock request data - you can implement real request logging
    const requests = [
      {
        id: 1,
        method: 'GET',
        endpoint: '/api/products',
        timestamp: new Date(),
        responseTime: 120,
        status: 200,
        userAgent: 'Frontend App'
      },
      {
        id: 2,
        method: 'POST',
        endpoint: '/api/products',
        timestamp: new Date(Date.now() - 60000),
        responseTime: 250,
        status: 201,
        userAgent: 'Frontend App'
      },
      {
        id: 3,
        method: 'GET',
        endpoint: '/api/orders',
        timestamp: new Date(Date.now() - 120000),
        responseTime: 95,
        status: 200,
        userAgent: 'Frontend App'
      }
    ];

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching store requests', error: error.message });
  }
});

module.exports = router;
