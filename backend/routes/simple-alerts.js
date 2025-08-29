const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { simpleAuthenticateToken } = require('../middleware/simpleAuth');

// GET /api/simple-alerts/summary - Get basic alerts summary
router.get('/summary', simpleAuthenticateToken, async (req, res) => {
  try {
    const lowStockCount = await Product.countDocuments({
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
    });

    const expiringSoonCount = await Product.countDocuments({
      expirationDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      }
    });

    const expiredCount = await Product.countDocuments({
      expirationDate: { $lt: new Date() }
    });

    const outOfStockCount = await Product.countDocuments({
      quantity: 0
    });

    res.json({
      summary: {
        lowStock: lowStockCount,
        expiringSoon: expiringSoonCount,
        expired: expiredCount,
        outOfStock: outOfStockCount,
        total: lowStockCount + expiringSoonCount + expiredCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alerts summary', error: error.message });
  }
});

// GET /api/simple-alerts/low-stock - Get low stock products
router.get('/low-stock', simpleAuthenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const products = await Product.find({})
      .populate('createdBy', 'username fullName')
      .sort({ quantity: 1 })
      .limit(parseInt(limit));

    const lowStockProducts = products.filter(product => product.isLowStock);

    res.json({
      alerts: lowStockProducts.map(product => ({
        id: product._id,
        name: product.name,
        category: product.category,
        currentQuantity: product.quantity,
        threshold: product.lowStockThreshold,
        price: product.price,
        qrCode: product.qrCode,
        image: product.image,
        createdBy: product.createdBy,
        severity: product.quantity === 0 ? 'critical' : 'warning'
      })),
      count: lowStockProducts.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching low stock alerts', error: error.message });
  }
});

module.exports = router;
