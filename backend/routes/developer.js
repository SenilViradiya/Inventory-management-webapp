const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const ActivityLog = require('../models/ActivityLog');
const ProductBatch = require('../models/ProductBatch');

// Middleware to check if user is developer/superadmin
const isDeveloper = (req, res, next) => {
  if (req.user.role === 'superadmin' || req.user.username === 'developer') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Developer privileges required.' });
  }
};

// GET /api/developer/analytics-dashboard - Get comprehensive analytics dashboard
router.get('/analytics-dashboard', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Set default date range if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get today's data
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    // Today's sales activities (REDUCE_STOCK activities)
    const todayActivities = await ActivityLog.find({
      action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
      reversed: false,
      createdAt: { $gte: startOfToday, $lt: endOfToday }
    }).populate('productId');

    // Calculate today's metrics
    let todaySales = 0;
    let todayItemsSold = 0;
    const categoryBreakdown = {};

    todayActivities.forEach(activity => {
      if (activity.productId) {
        const quantityReduced = activity.quantityBefore && activity.quantityAfter 
          ? activity.quantityBefore - activity.quantityAfter 
          : 1;
        const salesValue = quantityReduced * (activity.productId.price || 0);
        
        todaySales += salesValue;
        todayItemsSold += quantityReduced;
        
        const category = activity.productId.categoryName || 'Uncategorized';
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + salesValue;
      }
    });

    // Stock statistics
    const stockStats = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStockValue: { $sum: { $multiply: ['$stock.total', '$price'] } },
          lowStockProducts: {
            $sum: {
              $cond: [{ $lte: ['$stock.total', 5] }, 1, 0]
            }
          },
          outOfStockProducts: {
            $sum: {
              $cond: [{ $eq: ['$stock.total', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Recent activities
    const recentActivities = await ActivityLog.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).populate('productId').sort({ createdAt: -1 }).limit(10);

    // Top selling products (based on recent stock reductions)
    const topProducts = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
          reversed: false,
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$productId',
          totalSold: { $sum: 1 },
          lastSold: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $sort: { totalSold: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Batch statistics
    const batchStats = await ProductBatch.aggregate([
      {
        $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          totalBatchValue: { $sum: { $multiply: ['$totalQty', '$sellingPrice'] } },
          expiringBatches: {
            $sum: {
              $cond: [
                { $lte: ['$expiryDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const analyticsData = {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      todayMetrics: {
        sales: todaySales,
        itemsSold: todayItemsSold,
        transactions: todayActivities.length,
        categoryBreakdown: Object.entries(categoryBreakdown).map(([category, value]) => ({
          category,
          value
        }))
      },
      stockOverview: {
        totalProducts: stockStats[0]?.totalProducts || 0,
        totalStockValue: stockStats[0]?.totalStockValue || 0,
        lowStockProducts: stockStats[0]?.lowStockProducts || 0,
        outOfStockProducts: stockStats[0]?.outOfStockProducts || 0
      },
      batchOverview: {
        totalBatches: batchStats[0]?.totalBatches || 0,
        totalBatchValue: batchStats[0]?.totalBatchValue || 0,
        expiringBatches: batchStats[0]?.expiringBatches || 0
      },
      topProducts: topProducts.map(item => ({
        id: item.product._id,
        name: item.product.name,
        totalSold: item.totalSold,
        lastSold: item.lastSold,
        currentStock: item.product.stock?.total || 0
      })),
      recentActivities: recentActivities.map(activity => ({
        id: activity._id,
        action: activity.action,
        productName: activity.productId?.name || 'Unknown Product',
        change: activity.change || 0,
        timestamp: activity.createdAt,
        details: activity.details
      })),
      systemHealth: {
        totalUsers: await User.countDocuments(),
        activeUsers: await User.countDocuments({ isActive: true }),
        totalShops: await Shop.countDocuments(),
        activeShops: await Shop.countDocuments({ status: 'active' }),
        totalOrders: await Order.countDocuments(),
        recentOrders: await Order.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      }
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Error fetching analytics dashboard:', error);
    res.status(500).json({ message: 'Error fetching analytics dashboard', error: error.message });
  }
});

// GET /api/developer/analytics-realtime - Get real-time analytics data
router.get('/analytics-realtime', authenticateToken, isDeveloper, async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    // Recent stock movements (last hour)
    const recentMovements = await ActivityLog.find({
      action: { $in: ['REDUCE_STOCK', 'INCREASE_STOCK', 'STOCK_MOVEMENT'] },
      createdAt: { $gte: lastHour }
    }).populate('productId').sort({ createdAt: -1 }).limit(20);

    // Hourly sales data for the last 24 hours
    const hourlySales = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
          reversed: false,
          createdAt: { $gte: last24Hours }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $addFields: {
          hour: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$createdAt"
            }
          },
          quantityReduced: {
            $cond: {
              if: { $and: [
                { $ne: ["$quantityBefore", null] },
                { $ne: ["$quantityAfter", null] }
              ]},
              then: { $subtract: ["$quantityBefore", "$quantityAfter"] },
              else: 1
            }
          }
        }
      },
      {
        $group: {
          _id: "$hour",
          sales: { $sum: { $multiply: ["$quantityReduced", "$product.price"] } },
          transactions: { $sum: 1 },
          itemsSold: { $sum: "$quantityReduced" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Low stock alerts
    const lowStockAlerts = await Product.find({
      'stock.total': { $lte: 5, $gt: 0 }
    }).select('name stock price categoryName').limit(10);

    // Critical stock alerts (out of stock)
    const criticalAlerts = await Product.find({
      'stock.total': 0
    }).select('name stock price categoryName').limit(10);

    // Expiring batches (next 7 days)
    const expiringBatches = await ProductBatch.find({
      expiryDate: {
        $gte: now,
        $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    }).populate('productId').select('batchNumber expiryDate totalQty productId').limit(10);

    const realtimeData = {
      timestamp: now.toISOString(),
      recentMovements: recentMovements.map(movement => ({
        id: movement._id,
        action: movement.action,
        productName: movement.productId?.name || 'Unknown',
        change: movement.change || 0,
        timestamp: movement.createdAt,
        quantityBefore: movement.quantityBefore,
        quantityAfter: movement.quantityAfter
      })),
      hourlySales: hourlySales.map(hour => ({
        hour: hour._id,
        sales: hour.sales || 0,
        transactions: hour.transactions || 0,
        itemsSold: hour.itemsSold || 0
      })),
      alerts: {
        lowStock: lowStockAlerts.map(product => ({
          id: product._id,
          name: product.name,
          currentStock: product.stock?.total || 0,
          category: product.categoryName,
          price: product.price
        })),
        criticalStock: criticalAlerts.map(product => ({
          id: product._id,
          name: product.name,
          category: product.categoryName,
          price: product.price
        })),
        expiringBatches: expiringBatches.map(batch => ({
          id: batch._id,
          batchNumber: batch.batchNumber,
          productName: batch.productId?.name || 'Unknown',
          expiryDate: batch.expiryDate,
          quantity: batch.totalQty,
          daysToExpiry: Math.ceil((batch.expiryDate - now) / (24 * 60 * 60 * 1000))
        }))
      },
      summary: {
        totalMovementsLastHour: recentMovements.length,
        totalSalesLast24h: hourlySales.reduce((sum, hour) => sum + (hour.sales || 0), 0),
        totalTransactionsLast24h: hourlySales.reduce((sum, hour) => sum + (hour.transactions || 0), 0),
        lowStockCount: lowStockAlerts.length,
        criticalStockCount: criticalAlerts.length,
        expiringBatchesCount: expiringBatches.length
      }
    };

    res.json({
      success: true,
      data: realtimeData
    });
  } catch (error) {
    console.error('Error fetching real-time analytics:', error);
    res.status(500).json({ message: 'Error fetching real-time analytics', error: error.message });
  }
});

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
      // Analytics endpoints
      { path: '/api/developer/analytics-dashboard', method: 'GET', description: 'Get comprehensive analytics dashboard', status: 'active', category: 'Analytics' },
      { path: '/api/developer/analytics-realtime', method: 'GET', description: 'Get real-time analytics data', status: 'active', category: 'Analytics' },
      { path: '/api/analytics/dashboard', method: 'GET', description: 'Get main analytics dashboard', status: 'active', category: 'Analytics' },
      { path: '/api/analytics/today-sales', method: 'GET', description: 'Get today sales data', status: 'active', category: 'Analytics' },
      { path: '/api/analytics/detail', method: 'GET', description: 'Get detailed analytics', status: 'active', category: 'Analytics' },
      
      // Product endpoints
      { path: '/api/products', method: 'GET', description: 'Get all products', status: 'active', category: 'Products' },
      { path: '/api/products', method: 'POST', description: 'Create new product', status: 'active', category: 'Products' },
      { path: '/api/products/:id', method: 'PUT', description: 'Update product', status: 'active', category: 'Products' },
      { path: '/api/products/:id', method: 'DELETE', description: 'Delete product', status: 'active', category: 'Products' },
      
      // Batch endpoints
      { path: '/api/batches', method: 'GET', description: 'Get all product batches', status: 'active', category: 'Inventory' },
      { path: '/api/batches/product/:productId', method: 'GET', description: 'Get batches for product', status: 'active', category: 'Inventory' },
      { path: '/api/batches/add-stock', method: 'POST', description: 'Add new batch stock', status: 'active', category: 'Inventory' },
      { path: '/api/batches/move-to-store', method: 'POST', description: 'Move stock from godown to store', status: 'active', category: 'Inventory' },
      { path: '/api/batches/move-to-godown', method: 'POST', description: 'Move stock from store to godown', status: 'active', category: 'Inventory' },
      
      // Other core endpoints
      { path: '/api/shops', method: 'GET', description: 'Get all shops', status: 'active', category: 'Shops' },
      { path: '/api/users', method: 'GET', description: 'Get all users', status: 'active', category: 'Users' },
      { path: '/api/orders', method: 'GET', description: 'Get all orders', status: 'active', category: 'Orders' },
      { path: '/api/alerts', method: 'GET', description: 'Get alerts', status: 'active', category: 'Alerts' },
      { path: '/api/categories', method: 'GET', description: 'Get categories', status: 'active', category: 'Categories' },
      
      // Developer endpoints
      { path: '/api/developer/app-summary/:app', method: 'GET', description: 'Get app summary metrics', status: 'active', category: 'Developer' },
      { path: '/api/developer/system-metrics', method: 'GET', description: 'Get system metrics', status: 'active', category: 'Developer' },
      { path: '/api/developer/store-analytics/:storeId', method: 'GET', description: 'Get store-specific analytics', status: 'active', category: 'Developer' },
      { path: '/api/developer/store-requests/:storeId', method: 'GET', description: 'Get store request logs', status: 'active', category: 'Developer' }
    ];

    // Group endpoints by category
    const groupedEndpoints = endpoints.reduce((acc, endpoint) => {
      const category = endpoint.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(endpoint);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        endpoints,
        groupedEndpoints,
        totalEndpoints: endpoints.length,
        categories: Object.keys(groupedEndpoints)
      }
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
