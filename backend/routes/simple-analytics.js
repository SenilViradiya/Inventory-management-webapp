const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { simpleAuthenticateToken } = require('../middleware/simpleAuth');

// GET /api/simple-analytics/dashboard - Get basic dashboard analytics
router.get('/dashboard', simpleAuthenticateToken, async (req, res) => {
  try {
    // Basic product stats
    const totalProducts = await Product.countDocuments();
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
    });
    const outOfStockProducts = await Product.countDocuments({ quantity: 0 });
    
    // Total inventory value
    const inventoryValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    // Category breakdown
    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$price', '$quantity'] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Recent products (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentProducts = await Product.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Expiring soon
    const expiringSoon = await Product.countDocuments({
      expirationDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      overview: {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        recentProducts,
        expiringSoon,
        totalInventoryValue: inventoryValue[0]?.totalValue || 0,
        totalQuantity: inventoryValue[0]?.totalQuantity || 0
      },
      categories: categoryStats,
      alerts: {
        lowStock: lowStockProducts,
        outOfStock: outOfStockProducts,
        expiringSoon
      }
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching dashboard analytics', 
      error: error.message 
    });
  }
});

// GET /api/simple-analytics/inventory-value - Get inventory value over time
router.get('/inventory-value', simpleAuthenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // For simplicity, we'll just return current inventory value
    // In a real app, you'd track historical data
    const inventoryValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    res.json({
      currentValue: inventoryValue[0]?.totalValue || 0,
      currentQuantity: inventoryValue[0]?.totalQuantity || 0,
      period: `${days} days`,
      note: 'Historical tracking not implemented in simple version'
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching inventory value', 
      error: error.message 
    });
  }
});

module.exports = router;
