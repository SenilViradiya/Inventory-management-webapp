const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// POST /api/stock/reduce - Reduce stock by QR code or manual entry
router.post('/reduce', authenticateToken, [
  body('qrCode').trim().notEmpty().withMessage('QR code is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { qrCode, quantity, reason = '' } = req.body;

    // Find product by QR code
    const product = await Product.findOne({ qrCode });
    if (!product) {
      return res.status(404).json({ message: 'Product not found with this QR code' });
    }

    // Check if sufficient stock is available
    if (product.quantity < quantity) {
      return res.status(400).json({ 
        message: 'Insufficient stock',
        availableStock: product.quantity,
        requestedQuantity: quantity
      });
    }

    const previousQuantity = product.quantity;
    product.quantity -= quantity;
    await product.save();

    // Log the activity
    const activityLog = new ActivityLog({
      userId: req.user.id,
      action: quantity > 1 ? 'BULK_REDUCTION' : 'REDUCE_STOCK',
      productId: product._id,
      change: -quantity,
      previousValue: previousQuantity,
      newValue: product.quantity,
      details: reason || `Reduced stock by ${quantity} units`,
      reversible: true
    });
    await activityLog.save();

    res.json({
      message: 'Stock reduced successfully',
      product: {
        id: product._id,
        name: product.name,
        previousQuantity,
        newQuantity: product.quantity,
        reduction: quantity
      },
      logId: activityLog._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error reducing stock', error: error.message });
  }
});

// POST /api/stock/increase - Increase stock (Admin and Staff)
router.post('/increase', authenticateToken, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, quantity, reason = '' } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const previousQuantity = product.quantity;
    product.quantity += quantity;
    await product.save();

    // Log the activity
    const activityLog = new ActivityLog({
      userId: req.user.id,
      action: 'INCREASE_STOCK',
      productId: product._id,
      change: quantity,
      previousValue: previousQuantity,
      newValue: product.quantity,
      details: reason || `Increased stock by ${quantity} units`,
      reversible: true
    });
    await activityLog.save();

    res.json({
      message: 'Stock increased successfully',
      product: {
        id: product._id,
        name: product.name,
        previousQuantity,
        newQuantity: product.quantity,
        increase: quantity
      },
      logId: activityLog._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error increasing stock', error: error.message });
  }
});

// POST /api/stock/reverse/:logId - Reverse a stock adjustment (Admin only)
router.post('/reverse/:logId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { logId } = req.params;
    const { reason } = req.body;

    // Find the activity log
    const activityLog = await ActivityLog.findById(logId).populate('productId');
    if (!activityLog) {
      return res.status(404).json({ message: 'Activity log not found' });
    }

    // Check if the action is reversible
    if (!activityLog.reversible) {
      return res.status(400).json({ message: 'This action cannot be reversed' });
    }

    // Check if already reversed
    if (activityLog.reversed) {
      return res.status(400).json({ message: 'This action has already been reversed' });
    }

    const product = await Product.findById(activityLog.productId._id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Reverse the stock change
    const previousQuantity = product.quantity;
    product.quantity -= activityLog.change; // Subtract the original change to reverse it
    
    // Ensure quantity doesn't go below 0
    if (product.quantity < 0) {
      product.quantity = 0;
    }
    
    await product.save();

    // Mark the original log as reversed
    activityLog.reversed = true;
    activityLog.reversedBy = req.user.id;
    activityLog.reversedAt = new Date();
    await activityLog.save();

    // Create a new log entry for the reversal
    const reversalLog = new ActivityLog({
      userId: req.user.id,
      action: 'REVERSE_ADJUSTMENT',
      productId: product._id,
      change: -activityLog.change,
      previousValue: previousQuantity,
      newValue: product.quantity,
      details: reason || `Reversed previous ${activityLog.action.toLowerCase()} action`,
      reversible: false
    });
    await reversalLog.save();

    res.json({
      message: 'Stock adjustment reversed successfully',
      product: {
        id: product._id,
        name: product.name,
        previousQuantity,
        newQuantity: product.quantity,
        reversedChange: -activityLog.change
      },
      originalLogId: logId,
      reversalLogId: reversalLog._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error reversing stock adjustment', error: error.message });
  }
});

// GET /api/stock/history/:productId - Get stock history for a product
router.get('/history/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const history = await ActivityLog.find({ 
      productId,
      action: { $in: ['REDUCE_STOCK', 'INCREASE_STOCK', 'BULK_REDUCTION', 'REVERSE_ADJUSTMENT'] }
    })
      .populate('userId', 'username fullName')
      .populate('reversedBy', 'username fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments({ 
      productId,
      action: { $in: ['REDUCE_STOCK', 'INCREASE_STOCK', 'BULK_REDUCTION', 'REVERSE_ADJUSTMENT'] }
    });

    res.json({
      history,
      product: {
        id: product._id,
        name: product.name,
        currentQuantity: product.quantity
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stock history', error: error.message });
  }
});

// GET /api/stock/recent-activities - Get recent stock activities
router.get('/recent-activities', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const activities = await ActivityLog.find({
      action: { $in: ['REDUCE_STOCK', 'INCREASE_STOCK', 'BULK_REDUCTION', 'REVERSE_ADJUSTMENT'] }
    })
      .populate('userId', 'username fullName')
      .populate('productId', 'name qrCode')
      .populate('reversedBy', 'username fullName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recent activities', error: error.message });
  }
});

module.exports = router;
