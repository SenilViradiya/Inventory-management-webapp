const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const analyticsService = require('../services/analyticsService');

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

// GET /api/analytics/detail - Detailed analytics for a range (stock added, movements, sales, price changes, promo impact)
router.get('/detail', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0,0,0,0));
    const end = endDate ? new Date(endDate) : new Date();

    console.log(`Analytics Detail Query - Start: ${start.toISOString()}, End: ${end.toISOString()}`);

    // Stock Added - Look for INCREASE_STOCK, CREATE_PRODUCT activities
    const stockAdded = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['INCREASE_STOCK', 'CREATE_PRODUCT'] },
          createdAt: { $gte: start, $lte: end }
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
        $unwind: { path: '$product', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: null,
          totalQty: { $sum: { $abs: '$change' } },
          totalCost: { $sum: { $multiply: [{ $abs: '$change' }, { $ifNull: ['$product.price', 0] }] } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Stock Movements Summary - All movement types
    const movements = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['STOCK_MOVEMENT', 'REDUCE_STOCK', 'INCREASE_STOCK'] },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $addFields: {
          movementType: {
            $switch: {
              branches: [
                { case: { $eq: ['$action', 'INCREASE_STOCK'] }, then: 'store_in' },
                { case: { $eq: ['$action', 'REDUCE_STOCK'] }, then: 'store_out' },
                { case: { $and: [{ $eq: ['$action', 'STOCK_MOVEMENT'] }, { $gt: ['$change', 0] }] }, then: 'store_in' },
                { case: { $and: [{ $eq: ['$action', 'STOCK_MOVEMENT'] }, { $lt: ['$change', 0] }] }, then: 'store_out' }
              ],
              default: 'store_out'
            }
          }
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
        $unwind: { path: '$product', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: '$movementType',
          count: { $sum: 1 },
          totalQty: { $sum: { $abs: '$change' } },
          totalValue: { $sum: { $multiply: [{ $abs: '$change' }, { $ifNull: ['$product.price', 0] }] } }
        }
      }
    ]);

    // Sales Summary - Focus on stock reductions (sales)
    const sales = await ActivityLog.aggregate([
      {
        $match: {
          $or: [
            { action: 'REDUCE_STOCK', createdAt: { $gte: start, $lte: end } },
            { action: 'STOCK_MOVEMENT', change: { $lt: 0 }, createdAt: { $gte: start, $lte: end } }
          ]
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
        $unwind: { path: '$product', preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          quantitySold: {
            $cond: {
              if: { $eq: ['$action', 'REDUCE_STOCK'] },
              then: {
                $cond: {
                  if: { $and: [{ $ne: ['$quantityBefore', null] }, { $ne: ['$quantityAfter', null] }] },
                  then: { $subtract: ['$quantityBefore', '$quantityAfter'] },
                  else: 1 // Default to 1 for REDUCE_STOCK if no quantity data
                }
              },
              else: { $abs: '$change' }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalQty: { $sum: '$quantitySold' },
          revenue: { $sum: { $multiply: ['$quantitySold', { $ifNull: ['$product.price', 0] }] } },
          cost: { $sum: { $multiply: ['$quantitySold', { $ifNull: ['$product.costPrice', '$product.price'] }] } },
          transactions: { $sum: 1 }
        }
      }
    ]);

    // Price Changes
    const priceChanges = await ActivityLog.aggregate([
      {
        $match: {
          action: 'UPDATE_PRODUCT',
          createdAt: { $gte: start, $lte: end },
          'details.oldPrice': { $exists: true },
          'details.newPrice': { $exists: true }
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
        $unwind: { path: '$product', preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          priceIncrease: { $subtract: ['$details.newPrice', '$details.oldPrice'] },
          percentChange: {
            $cond: {
              if: { $gt: ['$details.oldPrice', 0] },
              then: { $multiply: [{ $divide: [{ $subtract: ['$details.newPrice', '$details.oldPrice'] }, '$details.oldPrice'] }, 100] },
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          entries: {
            $push: {
              productName: '$product.name',
              oldPrice: '$details.oldPrice',
              newPrice: '$details.newPrice',
              priceIncrease: '$priceIncrease',
              percentChange: '$percentChange',
              createdAt: '$createdAt'
            }
          }
        }
      },
      {
        $project: {
          count: 1,
          entries: { $slice: ['$entries', 10] } // Limit to 10 recent entries
        }
      }
    ]);

    // Promotion Impact - Compare regular vs discounted sales
    const promoImpact = await ActivityLog.aggregate([
      {
        $match: {
          $or: [
            { action: 'REDUCE_STOCK', createdAt: { $gte: start, $lte: end } },
            { action: 'STOCK_MOVEMENT', change: { $lt: 0 }, createdAt: { $gte: start, $lte: end } }
          ]
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
        $unwind: { path: '$product', preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          quantitySold: {
            $cond: {
              if: { $eq: ['$action', 'REDUCE_STOCK'] },
              then: 1,
              else: { $abs: '$change' }
            }
          },
          isPromo: {
            $cond: {
              if: { $and: ['$details.salePrice', { $lt: ['$details.salePrice', '$product.price'] }] },
              then: true,
              else: false
            }
          },
          saleValue: {
            $multiply: [
              {
                $cond: {
                  if: { $eq: ['$action', 'REDUCE_STOCK'] },
                  then: 1,
                  else: { $abs: '$change' }
                }
              },
              { $ifNull: ['$details.salePrice', '$product.price', 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$isPromo',
          quantity: { $sum: '$quantitySold' },
          revenue: { $sum: '$saleValue' }
        }
      },
      {
        $group: {
          _id: null,
          promoQty: { $sum: { $cond: [{ $eq: ['$_id', true] }, '$quantity', 0] } },
          promoRevenue: { $sum: { $cond: [{ $eq: ['$_id', true] }, '$revenue', 0] } },
          normalQty: { $sum: { $cond: [{ $eq: ['$_id', false] }, '$quantity', 0] } },
          normalRevenue: { $sum: { $cond: [{ $eq: ['$_id', false] }, '$revenue', 0] } }
        }
      }
    ]);

    const result = {
      start: start.toISOString(),
      end: end.toISOString(), 
      stockAdded: stockAdded[0] || { totalQty: 0, totalCost: 0, count: 0 },
      movements: movements,
      sales: sales[0] || { totalQty: 0, revenue: 0, cost: 0, transactions: 0 },
      priceChanges: priceChanges[0] || { count: 0, entries: [] },
      promoImpact: promoImpact[0] || { promoQty: 0, promoRevenue: 0, normalQty: 0, normalRevenue: 0 }
    };

    console.log('Analytics Result:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (err) {
    console.error('Error fetching detailed analytics:', err);
    res.status(500).json({ message: 'Error fetching detailed analytics', error: err.message });
  }
});

// GET /api/analytics/detail/export - Export detailed analytics as CSV or PDF
router.get('/detail/export', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0,0,0,0));
    const end = endDate ? new Date(endDate) : new Date();

    const stockAdded = await analyticsService.getStockAdded({ start, end });
    const movements = await analyticsService.getStockMovementsSummary({ start, end });
    const sales = await analyticsService.getSalesSummary({ start, end });
    const priceChanges = await analyticsService.getPriceChanges({ start, end });
    const promoImpact = await analyticsService.getPromotionImpact({ start, end });

    const profit = sales.revenue - sales.cost;
    const profitMargin = sales.revenue > 0 ? (profit / sales.revenue * 100).toFixed(2) : 0;

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.pdf"`);
      doc.pipe(res);

      doc.fontSize(20).text('Detailed Analytics Report', 50, 50);
      doc.fontSize(12).text(`Period: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`, 50, 80);

      let yPos = 120;
      doc.text(`Stock Added: ${stockAdded.totalQty} units, $${stockAdded.totalCost.toFixed(2)} cost`, 50, yPos);
      yPos += 20;
      doc.text(`Sales: ${sales.totalQty} units, $${sales.revenue.toFixed(2)} revenue, $${sales.cost.toFixed(2)} cost`, 50, yPos);
      yPos += 20;
      doc.text(`Profit: $${profit.toFixed(2)} (${profitMargin}% margin)`, 50, yPos);
      yPos += 20;
      doc.text(`Price Changes: ${priceChanges.count} updates`, 50, yPos);
      yPos += 20;
      doc.text(`Promotions: ${promoImpact.promoQty} promo units, ${promoImpact.normalQty} normal units`, 50, yPos);

      doc.end();
    } else {
      // CSV format
      const csvData = [
        {
          metric: 'Stock Added Quantity',
          value: stockAdded.totalQty,
          cost: stockAdded.totalCost.toFixed(2),
          count: stockAdded.count
        },
        {
          metric: 'Sales Quantity',
          value: sales.totalQty,
          cost: sales.cost.toFixed(2),
          revenue: sales.revenue.toFixed(2)
        },
        {
          metric: 'Profit',
          value: profit.toFixed(2),
          margin: `${profitMargin}%`,
          transactions: sales.transactions
        },
        {
          metric: 'Price Changes',
          value: priceChanges.count,
          details: `${priceChanges.entries.filter(e => e.priceIncrease > 0).length} increases`
        },
        {
          metric: 'Promotional Sales',
          value: promoImpact.promoQty,
          revenue: promoImpact.promoRevenue.toFixed(2)
        }
      ];

      const fields = ['metric', 'value', 'cost', 'revenue', 'margin', 'count', 'transactions', 'details'];
      const csv = new Parser({ fields }).parse(csvData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    }
  } catch (err) {
    res.status(500).json({ message: 'Error exporting detailed analytics', error: err.message });
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
            $or: [
              { action: 'REDUCE_STOCK', createdAt: { $gte: startDate, $lte: endDate } },
              { action: 'STOCK_MOVEMENT', change: { $lt: 0 }, createdAt: { $gte: startDate, $lte: endDate } }
            ]
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
          $unwind: { path: '$product', preserveNullAndEmptyArrays: true }
        },
        {
          $addFields: {
            quantitySold: {
              $cond: {
                if: { $eq: ['$action', 'REDUCE_STOCK'] },
                then: {
                  $cond: {
                    if: { $and: [{ $ne: ['$quantityBefore', null] }, { $ne: ['$quantityAfter', null] }] },
                    then: { $subtract: ['$quantityBefore', '$quantityAfter'] },
                    else: 1 // Default to 1 for REDUCE_STOCK activities
                  }
                },
                else: { $abs: '$change' }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalQuantitySold: { $sum: '$quantitySold' },
            totalSalesValue: { $sum: { $multiply: ['$quantitySold', { $ifNull: ['$product.price', 0] }] } },
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
          $or: [
            { action: 'REDUCE_STOCK', createdAt: { $gte: startOfMonth } },
            { action: 'STOCK_MOVEMENT', change: { $lt: 0 }, createdAt: { $gte: startOfMonth } }
          ]
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
        $unwind: { path: '$product', preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          quantitySold: {
            $cond: {
              if: { $eq: ['$action', 'REDUCE_STOCK'] },
              then: 1,
              else: { $abs: '$change' }
            }
          },
          categoryName: {
            $ifNull: ['$product.categoryName', '$product.category', 'Uncategorized']
          }
        }
      },
      {
        $group: {
          _id: '$categoryName',
          quantitySold: { $sum: '$quantitySold' },
          salesValue: { $sum: { $multiply: ['$quantitySold', { $ifNull: ['$product.price', 0] }] } }
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
          $or: [
            { action: 'REDUCE_STOCK', createdAt: { $gte: startOfMonth } },
            { action: 'STOCK_MOVEMENT', change: { $lt: 0 }, createdAt: { $gte: startOfMonth } }
          ]
        }
      },
      {
        $addFields: {
          quantitySold: {
            $cond: {
              if: { $eq: ['$action', 'REDUCE_STOCK'] },
              then: 1,
              else: { $abs: '$change' }
            }
          }
        }
      },
      {
        $group: {
          _id: '$productId',
          quantitySold: { $sum: '$quantitySold' },
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
        $unwind: { path: '$product', preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          salesValue: { $multiply: ['$quantitySold', { $ifNull: ['$product.price', 0] }] }
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

