const express = require('express');
const router = express.Router();
// GET /api/alerts - Get latest alerts (limit)

const Product = require('../models/Product');
const { authenticateToken } = require('../middleware/auth');
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    // Get latest products with alerts (low stock, expiring soon, expired)
    const products = await Product.find({})
      .populate('createdBy', 'username fullName')
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit));

    // Filter for products with any alert condition
    const alerts = products.filter(product => product.isLowStock || product.isExpiringSoon || product.isExpired || product.quantity === 0);

    res.json({
      alerts: alerts.map(product => ({
        id: product._id,
        name: product.name,
        category: product.category,
        currentQuantity: product.quantity,
        threshold: product.lowStockThreshold,
        price: product.price,
        qrCode: product.qrCode,
        image: product.image,
        createdBy: product.createdBy,
        severity: product.quantity === 0 || product.isExpired ? 'critical' : product.isLowStock ? 'warning' : product.isExpiringSoon ? 'info' : 'info'
      })),
      count: alerts.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alerts', error: error.message });
  }
});
// GET /api/alerts/low-stock - Get low stock alerts
router.get('/low-stock', authenticateToken, async (req, res) => {
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

// GET /api/alerts/expiring-soon - Get products expiring soon
router.get('/expiring-soon', authenticateToken, async (req, res) => {
  try {
    const { days = 7, limit = 50 } = req.query;
    
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + parseInt(days));

    const products = await Product.find({
      expirationDate: { 
        $gte: new Date(),
        $lte: alertDate 
      }
    })
      .populate('createdBy', 'username fullName')
      .sort({ expirationDate: 1 })
      .limit(parseInt(limit));

    res.json({
      alerts: products.map(product => {
        const daysUntilExpiry = Math.ceil((product.expirationDate - new Date()) / (1000 * 60 * 60 * 24));
        
        return {
          id: product._id,
          name: product.name,
          category: product.category,
          expirationDate: product.expirationDate,
          daysUntilExpiry,
          quantity: product.quantity,
          price: product.price,
          qrCode: product.qrCode,
          image: product.image,
          createdBy: product.createdBy,
          severity: daysUntilExpiry <= 3 ? 'critical' : daysUntilExpiry <= 7 ? 'warning' : 'info'
        };
      }),
      count: products.length,
      daysFilter: parseInt(days)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expiring products', error: error.message });
  }
});

// GET /api/alerts/expired - Get expired products
router.get('/expired', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const products = await Product.find({
      expirationDate: { $lt: new Date() }
    })
      .populate('createdBy', 'username fullName')
      .sort({ expirationDate: 1 })
      .limit(parseInt(limit));

    res.json({
      alerts: products.map(product => {
        const daysExpired = Math.ceil((new Date() - product.expirationDate) / (1000 * 60 * 60 * 24));
        
        return {
          id: product._id,
          name: product.name,
          category: product.category,
          expirationDate: product.expirationDate,
          daysExpired,
          quantity: product.quantity,
          price: product.price,
          qrCode: product.qrCode,
          image: product.image,
          createdBy: product.createdBy,
          severity: 'critical'
        };
      }),
      count: products.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expired products', error: error.message });
  }
});

// GET /api/alerts/summary - Get alerts summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    // Get all products to analyze
    const products = await Product.find({});
    
    // Count different types of alerts
    const lowStockCount = products.filter(product => product.isLowStock).length;
    const expiringSoonCount = products.filter(product => product.isExpiringSoon && !product.isExpired).length;
    const expiredCount = products.filter(product => product.isExpired).length;
    const outOfStockCount = products.filter(product => product.quantity === 0).length;

    // Calculate critical alerts (immediate attention needed)
    const criticalAlerts = outOfStockCount + expiredCount;
    
    // Calculate warning alerts (attention needed soon)
    const warningAlerts = lowStockCount + expiringSoonCount;

    res.json({
      summary: {
        total: criticalAlerts + warningAlerts,
        critical: criticalAlerts,
        warning: warningAlerts,
        info: 0
      },
      breakdown: {
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        expiringSoon: expiringSoonCount,
        expired: expiredCount
      },
      hasAlerts: (criticalAlerts + warningAlerts) > 0,
      needsImmediateAttention: criticalAlerts > 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alerts summary', error: error.message });
  }
});

module.exports = router;
