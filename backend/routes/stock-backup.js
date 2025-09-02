const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const StockMovement = require('../models/StockMovement');
const StockService = require('../services/stockService');
const { authenticateToken, requireRole, protect } = require('../middleware/auth');

// NEW STOCK MANAGEMENT ROUTES

// @desc    Move stock from godown to store
// @route   POST /api/stock/move-to-store
// @access  Private
router.post('/move-to-store', protect, async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid quantity are required'
      });
    }

    const result = await StockService.moveGodownToStore(
      productId,
      parseInt(quantity),
      req.user._id,
      reason,
      notes
    );

    res.status(200).json({
      success: true,
      message: `Successfully moved ${quantity} units from godown to store`,
      data: result
    });

  } catch (error) {
    console.error('Move to store error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Move stock from store to godown
// @route   POST /api/stock/move-to-godown
// @access  Private
router.post('/move-to-godown', protect, async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid quantity are required'
      });
    }

    const result = await StockService.moveStoreToGodown(
      productId,
      parseInt(quantity),
      req.user._id,
      reason,
      notes
    );

    res.status(200).json({
      success: true,
      message: `Successfully moved ${quantity} units from store to godown`,
      data: result
    });

  } catch (error) {
    console.error('Move to godown error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Add stock to godown (new delivery)
// @route   POST /api/stock/add-godown
// @access  Private
router.post('/add-godown', protect, async (req, res) => {
  try {
    const { productId, quantity, reason, batchNumber, referenceNumber } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid quantity are required'
      });
    }

    const result = await StockService.addGodownStock(
      productId,
      parseInt(quantity),
      req.user._id,
      reason,
      batchNumber,
      referenceNumber
    );

    res.status(200).json({
      success: true,
      message: `Successfully added ${quantity} units to godown`,
      data: result
    });

  } catch (error) {
    console.error('Add godown stock error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Process sale from store
// @route   POST /api/stock/process-sale
// @access  Private
router.post('/process-sale', protect, async (req, res) => {
  try {
    const { productId, quantity, orderNumber } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid quantity are required'
      });
    }

    const result = await StockService.processSale(
      productId,
      parseInt(quantity),
      req.user._id,
      orderNumber
    );

    res.status(200).json({
      success: true,
      message: `Successfully processed sale of ${quantity} units`,
      data: result
    });

  } catch (error) {
    console.error('Process sale error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get stock movement history for a product
// @route   GET /api/stock/movement-history/:productId
// @access  Private
router.get('/movement-history/:productId', protect, async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit } = req.query;

    const history = await StockService.getStockHistory(
      productId,
      limit ? parseInt(limit) : 50
    );

    res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get stock summary
// @route   GET /api/stock/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const summary = await StockService.getStockSummary();

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get stock summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get products with low stock
// @route   GET /api/stock/low-stock
// @access  Private
router.get('/low-stock', protect, async (req, res) => {
  try {
    const products = await Product.find({
      $expr: {
        $lte: ['$stock.total', '$lowStockThreshold']
      }
    }).select('name stock lowStockThreshold price imageUrl category');

    res.status(200).json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get products with zero stock
// @route   GET /api/stock/out-of-stock
// @access  Private
router.get('/out-of-stock', protect, async (req, res) => {
  try {
    const products = await Product.find({
      'stock.total': 0
    }).select('name stock price imageUrl category');

    res.status(200).json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error('Get out of stock products error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// LEGACY ROUTES (Updated to work with new stock structure)
// POST /api/stock/reduce - Reduce stock by QR code or manual entry (Legacy - updated)
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

    // Check if sufficient stock is available in godown (reduce from godown by default)
    if (product.stock.godown < quantity) {
      return res.status(400).json({ 
        message: 'Insufficient stock in godown',
        availableStock: product.stock.godown,
        requestedQuantity: quantity
      });
    }

    const previousStock = {
      godown: product.stock.godown,
      store: product.stock.store,
      total: product.stock.total
    };

    // Reduce from godown stock
    product.stock.godown -= quantity;
    product.stock.total = product.stock.godown + product.stock.store;
    product.quantity = product.stock.total; // Update legacy field
    await product.save();

    // Create stock movement record
    const stockMovement = new StockMovement({
      productId: product._id,
      movementType: 'godown_out',
      fromLocation: 'godown',
      toLocation: 'customer',
      quantity,
      previousStock,
      newStock: {
        godown: product.stock.godown,
        store: product.stock.store,
        total: product.stock.total
      },
      reason: reason || 'QR Code Sale',
      performedBy: req.user.id
    });
    await stockMovement.save();

    // Log the activity (legacy support)
    const activityLog = new ActivityLog({
      userId: req.user.id,
      action: quantity > 1 ? 'BULK_REDUCTION' : 'REDUCE_STOCK',
      productId: product._id,
      change: -quantity,
      previousValue: previousStock.total,
      newValue: product.stock.total,
      details: reason || `Reduced stock by ${quantity} units via QR code`,
      reversible: true
    });
    await activityLog.save();

    res.json({
      message: 'Stock reduced successfully',
      product: {
        id: product._id,
        name: product.name,
        previousQuantity: previousStock.total,
        newQuantity: product.stock.total,
        reduction: quantity,
        stock: product.stock
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
