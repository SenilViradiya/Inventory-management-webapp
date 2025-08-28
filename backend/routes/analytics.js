const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken } = require('../middleware/auth');

// GET /api/analytics/today-sales - Get today's sales data
router.get('/today-sales', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get today's stock movements
    const todayActivities = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
          reversed: false,
          createdAt: { $gte: startOfDay, $lt: endOfDay }
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
          quantityReduced: {
            $cond: {
              if: { $gt: [{ $type: "$quantityBefore" }, "missing"] },
              then: { $subtract: ["$quantityBefore", "$quantityAfter"] },
              else: 1 // Default to 1 if quantity info is missing
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $multiply: ["$quantityReduced", "$product.price"] } },
          totalItemsSold: { $sum: "$quantityReduced" },
          totalTransactions: { $sum: 1 },
          salesByCategory: {
            $push: {
              category: "$product.category",
              quantity: "$quantityReduced",
              value: { $multiply: ["$quantityReduced", "$product.price"] }
            }
          }
        }
      }
    ]);

    // Process category breakdown
    let categoryBreakdown = [];
    if (todayActivities.length > 0) {
      const categoryMap = new Map();
      todayActivities[0].salesByCategory.forEach(sale => {
        if (!categoryMap.has(sale.category)) {
          categoryMap.set(sale.category, { quantity: 0, value: 0 });
        }
        const category = categoryMap.get(sale.category);
        category.quantity += sale.quantity;
        category.value += sale.value;
      });
      
      categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        quantity: data.quantity,
        value: data.value
      }));
    }

    // Get hourly sales data for the day
    const hourlySales = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
          reversed: false,
          createdAt: { $gte: startOfDay, $lt: endOfDay }
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
          quantityReduced: {
            $cond: {
              if: { $gt: [{ $type: "$quantityBefore" }, "missing"] },
              then: { $subtract: ["$quantityBefore", "$quantityAfter"] },
              else: 1
            }
          },
          hour: { $hour: "$createdAt" }
        }
      },
      {
        $group: {
          _id: "$hour",
          sales: { $sum: { $multiply: ["$quantityReduced", "$product.price"] } },
          transactions: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const result = {
      totalSales: todayActivities.length > 0 ? todayActivities[0].totalSales : 0,
      totalItemsSold: todayActivities.length > 0 ? todayActivities[0].totalItemsSold : 0,
      totalTransactions: todayActivities.length > 0 ? todayActivities[0].totalTransactions : 0,
      categoryBreakdown,
      hourlySales: hourlySales.map(h => ({
        hour: h._id,
        sales: h.sales,
        transactions: h.transactions
      })),
      date: startOfDay.toISOString().split('T')[0]
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching today sales:', error);
    res.status(500).json({ message: 'Error fetching today sales data', error: error.message });
  }
});

// GET /api/analytics/dashboard - Get dashboard analytics
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get total products and stock value
    const products = await Product.find({});
    const totalProducts = products.length;
    const totalStockValue = products.reduce((sum, product) => sum + (product.price * product.quantity), 0);
    const totalQuantity = products.reduce((sum, product) => sum + product.quantity, 0);

    // Get low stock products
    const lowStockProducts = products.filter(product => product.isLowStock);
    
    // Get expiring soon products (within 7 days)
    const expiringSoonProducts = products.filter(product => product.isExpiringSoon && !product.isExpired);
    
    // Get expired products
    const expiredProducts = products.filter(product => product.isExpired);

    // Get sales data (stock reductions) for different periods
    const getDailySales = async (startDate, endDate) => {
      return await ActivityLog.aggregate([
        {
          $match: {
            action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
            reversed: false,
            createdAt: { $gte: startDate, $lte: endDate }
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
          $group: {
            _id: null,
            totalQuantitySold: { $sum: { $abs: '$change' } },
            totalSalesValue: { $sum: { $multiply: [{ $abs: '$change' }, '$product.price'] } },
            transactions: { $sum: 1 }
          }
        }
      ]);
    };

    const [dailySales, weeklySales, monthlySales, yearlySales] = await Promise.all([
      getDailySales(startOfDay, now),
      getDailySales(startOfWeek, now),
      getDailySales(startOfMonth, now),
      getDailySales(startOfYear, now)
    ]);

    // Get category-wise sales for the current month
    const categorySales = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
          reversed: false,
          createdAt: { $gte: startOfMonth }
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
        $group: {
          _id: '$product.category',
          quantitySold: { $sum: { $abs: '$change' } },
          salesValue: { $sum: { $multiply: [{ $abs: '$change' }, '$product.price'] } }
        }
      },
      {
        $sort: { salesValue: -1 }
      }
    ]);

    // Get top selling products for the current month
    const topProducts = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
          reversed: false,
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: '$productId',
          quantitySold: { $sum: { $abs: '$change' } },
          transactions: { $sum: 1 }
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
        $addFields: {
          salesValue: { $multiply: ['$quantitySold', '$product.price'] }
        }
      },
      {
        $sort: { quantitySold: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      summary: {
        totalProducts,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        totalQuantity,
        lowStockCount: lowStockProducts.length,
        expiringSoonCount: expiringSoonProducts.length,
        expiredCount: expiredProducts.length
      },
      sales: {
        daily: dailySales[0] || { totalQuantitySold: 0, totalSalesValue: 0, transactions: 0 },
        weekly: weeklySales[0] || { totalQuantitySold: 0, totalSalesValue: 0, transactions: 0 },
        monthly: monthlySales[0] || { totalQuantitySold: 0, totalSalesValue: 0, transactions: 0 },
        yearly: yearlySales[0] || { totalQuantitySold: 0, totalSalesValue: 0, transactions: 0 }
      },
      categorySales,
      topProducts,
      alerts: {
        lowStock: lowStockProducts.map(p => ({
          id: p._id,
          name: p.name,
          quantity: p.quantity,
          threshold: p.lowStockThreshold
        })),
        expiringSoon: expiringSoonProducts.map(p => ({
          id: p._id,
          name: p.name,
          expirationDate: p.expirationDate,
          quantity: p.quantity
        })),
        expired: expiredProducts.map(p => ({
          id: p._id,
          name: p.name,
          expirationDate: p.expirationDate,
          quantity: p.quantity
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard analytics', error: error.message });
  }
});

// GET /api/analytics/sales-trend - Get sales trend data
router.get('/sales-trend', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    
    const now = new Date();
    const startDate = new Date(now.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));

    let groupBy;
    let dateFormat;

    switch (period) {
      case 'hourly':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'daily':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        dateFormat = '%Y-W%U';
        break;
      case 'monthly':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        dateFormat = '%Y-%m';
        break;
      default:
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        dateFormat = '%Y-%m-%d';
    }

    const salesTrend = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
          reversed: false,
          createdAt: { $gte: startDate }
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
        $group: {
          _id: groupBy,
          quantitySold: { $sum: { $abs: '$change' } },
          salesValue: { $sum: { $multiply: [{ $abs: '$change' }, '$product.price'] } },
          transactions: { $sum: 1 },
          date: { $first: { $dateToString: { format: dateFormat, date: '$createdAt' } } }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.week': 1 }
      }
    ]);

    res.json({
      period,
      days: parseInt(days),
      data: salesTrend.map(item => ({
        date: item.date,
        quantitySold: item.quantitySold,
        salesValue: Math.round(item.salesValue * 100) / 100,
        transactions: item.transactions
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales trend', error: error.message });
  }
});

// GET /api/analytics/category-performance - Get category performance
router.get('/category-performance', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate;
    const now = new Date();

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const categoryPerformance = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] },
          reversed: false,
          createdAt: { $gte: startDate }
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
        $group: {
          _id: '$product.category',
          quantitySold: { $sum: { $abs: '$change' } },
          salesValue: { $sum: { $multiply: [{ $abs: '$change' }, '$product.price'] } },
          transactions: { $sum: 1 },
          uniqueProducts: { $addToSet: '$productId' }
        }
      },
      {
        $addFields: {
          uniqueProductsCount: { $size: '$uniqueProducts' },
          averageTransactionValue: { $divide: ['$salesValue', '$transactions'] }
        }
      },
      {
        $sort: { salesValue: -1 }
      }
    ]);

    // Get total stock value by category
    const stockValueByCategory = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
          totalQuantity: { $sum: '$quantity' },
          productCount: { $sum: 1 }
        }
      }
    ]);

    // Merge the data
    const categoryData = categoryPerformance.map(perf => {
      const stock = stockValueByCategory.find(s => s._id === perf._id) || {
        totalStockValue: 0,
        totalQuantity: 0,
        productCount: 0
      };

      return {
        category: perf._id,
        sales: {
          quantitySold: perf.quantitySold,
          salesValue: Math.round(perf.salesValue * 100) / 100,
          transactions: perf.transactions,
          uniqueProducts: perf.uniqueProductsCount,
          averageTransactionValue: Math.round(perf.averageTransactionValue * 100) / 100
        },
        inventory: {
          totalStockValue: Math.round(stock.totalStockValue * 100) / 100,
          totalQuantity: stock.totalQuantity,
          productCount: stock.productCount
        }
      };
    });

    res.json({
      period,
      categories: categoryData
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category performance', error: error.message });
  }
});

module.exports = router;
