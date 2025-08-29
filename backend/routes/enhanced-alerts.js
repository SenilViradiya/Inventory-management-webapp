const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Alert = require('../models/Alert');
const Shop = require('../models/Shop');
const { Subscription } = require('../models/Subscription');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// GET /api/alerts/list - Get all alerts for a shop
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const {
      shopId,
      page = 1,
      limit = 20,
      type,
      severity,
      isRead,
      isResolved,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (shopId) {
      filter.shop = shopId;
    } else if (req.user.shop) {
      filter.shop = req.user.shop._id;
    } else {
      filter.user = req.user.id;
    }
    
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (isResolved !== undefined) filter.isResolved = isResolved === 'true';

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const alerts = await Alert.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('shop', 'name')
      .populate('user', 'username fullName')
      .populate('resolvedBy', 'username fullName');

    const total = await Alert.countDocuments(filter);

    // Get summary counts
    const summary = await Alert.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAlerts: { $sum: 1 },
          unreadAlerts: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          unresolvedAlerts: { $sum: { $cond: [{ $eq: ['$isResolved', false] }, 1, 0] } },
          criticalAlerts: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      alerts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      summary: summary[0] || {
        totalAlerts: 0,
        unreadAlerts: 0,
        unresolvedAlerts: 0,
        criticalAlerts: 0
      }
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

// PUT /api/alerts/:id/read - Mark alert as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json(alert);

  } catch (error) {
    res.status(500).json({ message: 'Error marking alert as read', error: error.message });
  }
});

// PUT /api/alerts/:id/resolve - Mark alert as resolved
router.put('/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user.id
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json(alert);

  } catch (error) {
    res.status(500).json({ message: 'Error resolving alert', error: error.message });
  }
});

module.exports = router;
