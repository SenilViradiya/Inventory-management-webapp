const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const StockMovement = require('../models/StockMovement');
const StockService = require('../services/stockService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// NEW STOCK MANAGEMENT ROUTES

// @desc    Move stock from godown to store
// @route   POST /api/stock/move-to-store
// @access  Private
router.post('/move-to-store', authenticateToken, async (req, res) => {
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
router.post('/move-to-godown', authenticateToken, async (req, res) => {
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

// @desc    Bulk move stock from godown to store
// @route   POST /api/stock/bulk-move-to-store
// @access  Private
router.post('/bulk-move-to-store', authenticateToken, [
  body('movements').isArray({ min: 1 }).withMessage('Movements array is required'),
  body('movements.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('movements.*.reason').optional().isString().withMessage('Reason must be a string'),
  body('movements.*.notes').optional().isString().withMessage('Notes must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { movements, globalReason, globalNotes } = req.body;
    const results = [];
    const failures = [];
    let totalMoved = 0;

    // Process each movement
    for (let i = 0; i < movements.length; i++) {
      const movement = movements[i];
      try {
        // Check if productId or qrCode is provided
        if (!movement.productId && !movement.qrCode) {
          failures.push({
            productId: movement.productId || movement.qrCode,
            quantity: movement.quantity,
            status: 'failed',
            error: 'Either productId or qrCode is required'
          });
          continue;
        }

        let product;
        let productIdentifier;

        // Find product by either productId or qrCode
        if (movement.productId) {
          // Check if it's a valid MongoDB ObjectId
          const mongoose = require('mongoose');
          if (mongoose.Types.ObjectId.isValid(movement.productId)) {
            product = await Product.findById(movement.productId);
            productIdentifier = movement.productId;
          } else {
            // If not a valid ObjectId, treat it as a qrCode
            product = await Product.findOne({ qrCode: movement.productId });
            productIdentifier = movement.productId;
          }
        } else if (movement.qrCode) {
          product = await Product.findOne({ qrCode: movement.qrCode });
          productIdentifier = movement.qrCode;
        }

        if (!product) {
          failures.push({
            productId: productIdentifier,
            quantity: movement.quantity,
            status: 'failed',
            error: 'Product not found'
          });
          continue;
        }

        const result = await StockService.moveGodownToStore(
          product._id,
          parseInt(movement.quantity),
          req.user._id,
          movement.reason || globalReason || 'Bulk move to store',
          movement.notes || globalNotes
        );

        results.push({
          productId: product._id,
          productName: product.name,
          qrCode: product.qrCode,
          quantity: movement.quantity,
          status: 'success',
          data: result
        });
        totalMoved += movement.quantity;

      } catch (error) {
        failures.push({
          productId: movement.productId || movement.qrCode,
          quantity: movement.quantity,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.length;
    const failureCount = failures.length;

    res.status(successCount > 0 ? 200 : 400).json({
      success: successCount > 0,
      message: `Bulk move completed. ${successCount} successful, ${failureCount} failed. Total ${totalMoved} units moved.`,
      summary: {
        totalProcessed: movements.length,
        successful: successCount,
        failed: failureCount,
        totalQuantityMoved: totalMoved
      },
      results,
      failures
    });

  } catch (error) {
    console.error('Bulk move to store error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during bulk move',
      error: error.message
    });
  }
});

// @desc    Bulk move stock from store to godown
// @route   POST /api/stock/bulk-move-to-godown
// @access  Private
router.post('/bulk-move-to-godown', authenticateToken, [
  body('movements').isArray({ min: 1 }).withMessage('Movements array is required'),
  body('movements.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('movements.*.reason').optional().isString().withMessage('Reason must be a string'),
  body('movements.*.notes').optional().isString().withMessage('Notes must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { movements, globalReason, globalNotes } = req.body;
    const results = [];
    const failures = [];
    let totalMoved = 0;

    // Process each movement
    for (let i = 0; i < movements.length; i++) {
      const movement = movements[i];
      try {
        // Check if productId or qrCode is provided
        if (!movement.productId && !movement.qrCode) {
          failures.push({
            productId: movement.productId || movement.qrCode,
            quantity: movement.quantity,
            status: 'failed',
            error: 'Either productId or qrCode is required'
          });
          continue;
        }

        let product;
        let productIdentifier;

        // Find product by either productId or qrCode
        if (movement.productId) {
          // Check if it's a valid MongoDB ObjectId
          const mongoose = require('mongoose');
          if (mongoose.Types.ObjectId.isValid(movement.productId)) {
            product = await Product.findById(movement.productId);
            productIdentifier = movement.productId;
          } else {
            // If not a valid ObjectId, treat it as a qrCode
            product = await Product.findOne({ qrCode: movement.productId });
            productIdentifier = movement.productId;
          }
        } else if (movement.qrCode) {
          product = await Product.findOne({ qrCode: movement.qrCode });
          productIdentifier = movement.qrCode;
        }

        if (!product) {
          failures.push({
            productId: productIdentifier,
            quantity: movement.quantity,
            status: 'failed',
            error: 'Product not found'
          });
          continue;
        }

        const result = await StockService.moveStoreToGodown(
          product._id,
          parseInt(movement.quantity),
          req.user._id,
          movement.reason || globalReason || 'Bulk move to godown',
          movement.notes || globalNotes
        );

        results.push({
          productId: product._id,
          productName: product.name,
          qrCode: product.qrCode,
          quantity: movement.quantity,
          status: 'success',
          data: result
        });
        totalMoved += movement.quantity;

      } catch (error) {
        failures.push({
          productId: movement.productId || movement.qrCode,
          quantity: movement.quantity,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.length;
    const failureCount = failures.length;

    res.status(successCount > 0 ? 200 : 400).json({
      success: successCount > 0,
      message: `Bulk move completed. ${successCount} successful, ${failureCount} failed. Total ${totalMoved} units moved.`,
      summary: {
        totalProcessed: movements.length,
        successful: successCount,
        failed: failureCount,
        totalQuantityMoved: totalMoved
      },
      results,
      failures
    });

  } catch (error) {
    console.error('Bulk move to godown error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during bulk move',
      error: error.message
    });
  }
});

// @desc    Add stock to godown (new delivery)
// @route   POST /api/stock/add-godown
// @access  Private
router.post('/add-godown', authenticateToken, async (req, res) => {
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

// @desc    Update godown stock for specific product
// @route   POST /api/stock/godown/:productId/update
// @access  Private
router.post('/godown/:productId/update', authenticateToken, [
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('quantityChange').optional().isInt().withMessage('Quantity change must be an integer'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('qrCode').optional().isString().withMessage('QR code must be a string')
], async (req, res) => {
  console.log('🔄 POST /api/stock/godown/:productId/update - Update godown stock request:');
  console.log('👤 User ID:', req.user?.id);
  console.log('🆔 Product ID:', req.params.productId);
  console.log('📄 Request Body:', JSON.stringify(req.body, null, 2));

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { quantity, quantityChange, reason = 'Godown stock update', notes, qrCode } = req.body;
    const productId = req.params.productId;

    // Validate that either quantity or quantityChange is provided
    if (quantity === undefined && quantityChange === undefined) {
      console.log('❌ Neither quantity nor quantityChange provided');
      return res.status(400).json({
        success: false,
        message: 'Either quantity (absolute) or quantityChange (relative) must be provided'
      });
    }

    // Find the product by ID or QR code if provided
    let product;
    if (qrCode) {
      product = await Product.findOne({ qrCode });
      if (!product) {
        console.log('❌ Product not found for QR code:', qrCode);
        return res.status(404).json({
          success: false,
          message: 'Product not found with the provided QR code'
        });
      }
    } else {
      product = await Product.findById(productId);
      if (!product) {
        console.log('❌ Product not found for ID:', productId);
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
    }

    console.log('✅ Product found:', {
      id: product._id,
      name: product.name,
      currentGodownStock: product.stock?.godown || 0
    });

    // Calculate the new godown stock
    const currentGodownStock = product.stock?.godown || 0;
    let newGodownStock;
    let difference;
    let movementType;

    if (quantity !== undefined) {
      // Absolute quantity update
      newGodownStock = parseInt(quantity);
      difference = newGodownStock - currentGodownStock;
      movementType = difference >= 0 ? 'godown_in' : 'godown_out';
      console.log('📊 Absolute quantity update:', {
        currentGodownStock,
        newGodownStock,
        difference
      });
    } else {
      // Relative quantity change
      const change = parseInt(quantityChange);
      newGodownStock = currentGodownStock + change;
      difference = change;
      movementType = change >= 0 ? 'godown_in' : 'godown_out';
      
      // Prevent negative stock
      if (newGodownStock < 0) {
        console.log('❌ Insufficient stock for quantity change:', {
          currentGodownStock,
          requestedChange: change,
          resultingStock: newGodownStock
        });
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for this operation',
          data: {
            currentGodownStock,
            requestedChange: change,
            availableStock: currentGodownStock
          }
        });
      }
      
      console.log('📊 Relative quantity change:', {
        currentGodownStock,
        quantityChange: change,
        newGodownStock,
        difference
      });
    }

    // Update only the godown stock
    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      {
        $set: {
          'stock.godown': newGodownStock,
          'stock.total': newGodownStock + (product.stock?.store || 0)
        }
      },
      { new: true, runValidators: true }
    );

    console.log('✅ Product godown stock updated:', {
      id: updatedProduct._id,
      name: updatedProduct.name,
      newStock: updatedProduct.stock
    });

    // Create stock movement record with correct field names
    const stockMovement = new StockMovement({
      productId: product._id,
      movementType: movementType,
      fromLocation: movementType === 'godown_in' ? 'external' : 'godown',
      toLocation: movementType === 'godown_in' ? 'godown' : 'external',
      quantity: Math.abs(difference),
      performedBy: req.user.id,
      reason,
      notes: notes || '',
      previousStock: {
        godown: currentGodownStock,
        store: product.stock?.store || 0,
        total: (product.stock?.godown || 0) + (product.stock?.store || 0)
      },
      newStock: {
        godown: newGodownStock,
        store: product.stock?.store || 0,
        total: newGodownStock + (product.stock?.store || 0)
      }
    });

    await stockMovement.save();
    console.log('📝 Stock movement record created:', stockMovement._id);

    // Create activity log
    await ActivityLog.create({
      userId: req.user.id,
      action: 'STOCK_MOVEMENT',
      productId: product._id,
      change: difference,
      previousValue: currentGodownStock,
      newValue: newGodownStock,
      details: `Updated godown stock for ${product.name} from ${currentGodownStock} to ${newGodownStock} (${difference >= 0 ? '+' : ''}${difference})`
    });

    console.log('📄 Activity log created for godown stock update');

    res.status(200).json({
      success: true,
      message: `Successfully updated godown stock to ${newGodownStock} units`,
      data: {
        product: {
          id: updatedProduct._id,
          name: updatedProduct.name,
          stock: updatedProduct.stock
        },
        movement: {
          id: stockMovement._id,
          type: stockMovement.movementType,
          quantity: stockMovement.quantity,
          difference
        }
      }
    });

  } catch (error) {
    console.error('❌ Update godown stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update godown stock',
      details: error.message
    });
  }
});

// @desc    Update store stock for specific product
// @route   POST /api/stock/store/:productId/update
// @access  Private
router.post('/store/:productId/update', authenticateToken, [
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('quantityChange').optional().isInt().withMessage('Quantity change must be an integer'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('qrCode').optional().isString().withMessage('QR code must be a string')
], async (req, res) => {
  console.log('🔄 POST /api/stock/store/:productId/update - Update store stock request:');
  console.log('👤 User ID:', req.user?.id);
  console.log('🆔 Product ID:', req.params.productId);
  console.log('📄 Request Body:', JSON.stringify(req.body, null, 2));

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { quantity, quantityChange, reason = 'Store stock update', notes, qrCode } = req.body;
    const productId = req.params.productId;

    // Validate that either quantity or quantityChange is provided
    if (quantity === undefined && quantityChange === undefined) {
      console.log('❌ Neither quantity nor quantityChange provided');
      return res.status(400).json({
        success: false,
        message: 'Either quantity (absolute) or quantityChange (relative) must be provided'
      });
    }

    // Find the product by ID or QR code if provided
    let product;
    if (qrCode) {
      product = await Product.findOne({ qrCode });
      if (!product) {
        console.log('❌ Product not found for QR code:', qrCode);
        return res.status(404).json({
          success: false,
          message: 'Product not found with the provided QR code'
        });
      }
    } else {
      product = await Product.findById(productId);
      if (!product) {
        console.log('❌ Product not found for ID:', productId);
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
    }

    console.log('✅ Product found:', {
      id: product._id,
      name: product.name,
      currentStoreStock: product.stock?.store || 0
    });

    // Calculate the new store stock
    const currentStoreStock = product.stock?.store || 0;
    let newStoreStock;
    let difference;
    let movementType;

    if (quantity !== undefined) {
      // Absolute quantity update
      newStoreStock = parseInt(quantity);
      difference = newStoreStock - currentStoreStock;
      movementType = difference >= 0 ? 'store_in' : 'store_out';
      console.log('📊 Absolute quantity update:', {
        currentStoreStock,
        newStoreStock,
        difference
      });
    } else {
      // Relative quantity change
      const change = parseInt(quantityChange);
      newStoreStock = currentStoreStock + change;
      difference = change;
      movementType = change >= 0 ? 'store_in' : 'store_out';
      
      // Prevent negative stock
      if (newStoreStock < 0) {
        console.log('❌ Insufficient stock for quantity change:', {
          currentStoreStock,
          requestedChange: change,
          resultingStock: newStoreStock
        });
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for this operation',
          data: {
            currentStoreStock,
            requestedChange: change,
            availableStock: currentStoreStock
          }
        });
      }
      
      console.log('📊 Relative quantity change:', {
        currentStoreStock,
        quantityChange: change,
        newStoreStock,
        difference
      });
    }

    // Update only the store stock
    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      {
        $set: {
          'stock.store': newStoreStock,
          'stock.total': (product.stock?.godown || 0) + newStoreStock
        }
      },
      { new: true, runValidators: true }
    );

    console.log('✅ Product store stock updated:', {
      id: updatedProduct._id,
      name: updatedProduct.name,
      newStock: updatedProduct.stock
    });

    // Create stock movement record with correct field names
    const stockMovement = new StockMovement({
      productId: product._id,
      movementType: movementType,
      fromLocation: movementType === 'store_in' ? 'external' : 'store',
      toLocation: movementType === 'store_in' ? 'store' : 'external',
      quantity: Math.abs(difference),
      performedBy: req.user.id,
      reason,
      notes: notes || '',
      previousStock: {
        godown: product.stock?.godown || 0,
        store: currentStoreStock,
        total: (product.stock?.godown || 0) + (product.stock?.store || 0)
      },
      newStock: {
        godown: product.stock?.godown || 0,
        store: newStoreStock,
        total: (product.stock?.godown || 0) + newStoreStock
      }
    });

    await stockMovement.save();
    console.log('📝 Stock movement record created:', stockMovement._id);

    // Create activity log
    await ActivityLog.create({
      userId: req.user.id,
      action: 'STOCK_MOVEMENT',
      productId: product._id,
      change: difference,
      previousValue: currentStoreStock,
      newValue: newStoreStock,
      details: `Updated store stock for ${product.name} from ${currentStoreStock} to ${newStoreStock} (${difference >= 0 ? '+' : ''}${difference})`
    });

    console.log('📄 Activity log created for store stock update');

    res.status(200).json({
      success: true,
      message: `Successfully updated store stock to ${newStoreStock} units`,
      data: {
        product: {
          id: updatedProduct._id,
          name: updatedProduct.name,
          stock: updatedProduct.stock
        },
        movement: {
          id: stockMovement._id,
          type: stockMovement.movementType,
          quantity: stockMovement.quantity,
          difference
        }
      }
    });

  } catch (error) {
    console.error('❌ Update store stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update store stock',
      details: error.message
    });
  }
});

// @desc    Process sale from store
// @route   POST /api/stock/process-sale
// @access  Private
router.post('/process-sale', authenticateToken, async (req, res) => {
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
router.get('/movement-history/:productId', authenticateToken, async (req, res) => {
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
router.get('/summary', authenticateToken, async (req, res) => {
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
router.get('/low-stock', authenticateToken, async (req, res) => {
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
router.get('/out-of-stock', authenticateToken, async (req, res) => {
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

// POST /api/stock/increase - Increase stock (Admin and Staff) - Updated for new structure
router.post('/increase', authenticateToken, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('location').isIn(['godown', 'store']).withMessage('Location must be godown or store'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, quantity, location = 'godown', reason = '' } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const previousStock = {
      godown: product.stock.godown,
      store: product.stock.store,
      total: product.stock.total
    };

    // Add to specified location
    if (location === 'godown') {
      product.stock.godown += quantity;
    } else {
      product.stock.store += quantity;
    }
    
    product.stock.total = product.stock.godown + product.stock.store;
    product.quantity = product.stock.total; // Update legacy field
    await product.save();

    // Create stock movement record
    const stockMovement = new StockMovement({
      productId: product._id,
      movementType: location === 'godown' ? 'godown_in' : 'store_in',
      fromLocation: 'supplier',
      toLocation: location,
      quantity,
      previousStock,
      newStock: {
        godown: product.stock.godown,
        store: product.stock.store,
        total: product.stock.total
      },
      reason: reason || `Stock increase to ${location}`,
      performedBy: req.user.id
    });
    await stockMovement.save();

    // Log the activity (legacy support)
    const activityLog = new ActivityLog({
      userId: req.user.id,
      action: 'INCREASE_STOCK',
      productId: product._id,
      change: quantity,
      previousValue: previousStock.total,
      newValue: product.stock.total,
      details: reason || `Increased stock by ${quantity} units in ${location}`,
      reversible: true
    });
    await activityLog.save();

    res.json({
      message: 'Stock increased successfully',
      product: {
        id: product._id,
        name: product.name,
        previousQuantity: previousStock.total,
        newQuantity: product.stock.total,
        increase: quantity,
        location,
        stock: product.stock
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

    const previousStock = {
      godown: product.stock.godown,
      store: product.stock.store,
      total: product.stock.total
    };

    // Reverse the stock change by adjusting the total and distributing appropriately
    const changeAmount = activityLog.change;
    
    if (changeAmount > 0) {
      // If it was an increase, reduce from store first, then godown
      let remainingToReduce = changeAmount;
      
      if (product.stock.store >= remainingToReduce) {
        product.stock.store -= remainingToReduce;
      } else {
        remainingToReduce -= product.stock.store;
        product.stock.store = 0;
        product.stock.godown = Math.max(0, product.stock.godown - remainingToReduce);
      }
    } else {
      // If it was a reduction, add back to store
      product.stock.store += Math.abs(changeAmount);
    }
    
    product.stock.total = product.stock.godown + product.stock.store;
    product.quantity = product.stock.total; // Update legacy field
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
      change: -changeAmount,
      previousValue: previousStock.total,
      newValue: product.stock.total,
      details: reason || `Reversed previous ${activityLog.action.toLowerCase()} action`,
      reversible: false
    });
    await reversalLog.save();

    res.json({
      message: 'Stock adjustment reversed successfully',
      product: {
        id: product._id,
        name: product.name,
        previousQuantity: previousStock.total,
        newQuantity: product.stock.total,
        reversedChange: -changeAmount,
        stock: product.stock
      },
      originalLogId: logId,
      reversalLogId: reversalLog._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error reversing stock adjustment', error: error.message });
  }
});

// GET /api/stock/history/:productId - Get stock history for a product (Legacy route)
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
        currentQuantity: product.stock.total,
        stock: product.stock
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
      .populate('productId', 'name qrCode stock')
      .populate('reversedBy', 'username fullName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recent activities', error: error.message });
  }
});

// ============================================================================
// STOCK SUMMARY PAGE APIs
// ============================================================================

// @desc    Get comprehensive stock overview for stock summary page
// @route   GET /api/stock/overview
// @access  Private
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { category, location, search, minStock, maxStock } = req.query;

    // Build filter
    let filter = {};
    if (category && category !== 'all') {
      filter.categoryName = category;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { qrCode: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all products with stock information
    const products = await Product.find(filter)
      .select('name qrCode categoryName stock price imageUrl lowStockThreshold')
      .sort({ name: 1 });

    // Filter by stock levels if specified
    let filteredProducts = products;
    if (minStock !== undefined || maxStock !== undefined) {
      filteredProducts = products.filter(product => {
        const total = product.stock?.total || 0;
        if (minStock !== undefined && total < parseInt(minStock)) return false;
        if (maxStock !== undefined && total > parseInt(maxStock)) return false;
        return true;
      });
    }

    // Calculate summary statistics
    const totalProducts = filteredProducts.length;
    const totalStockValue = filteredProducts.reduce((sum, product) => {
      return sum + ((product.stock?.total || 0) * (product.price || 0));
    }, 0);
    const totalQuantity = filteredProducts.reduce((sum, product) => {
      return sum + (product.stock?.total || 0);
    }, 0);
    const lowStockCount = filteredProducts.filter(product => {
      const total = product.stock?.total || 0;
      return total <= (product.lowStockThreshold || 0) && total > 0;
    }).length;
    const outOfStockCount = filteredProducts.filter(product => {
      return (product.stock?.total || 0) === 0;
    }).length;

    // Group by location
    const locationBreakdown = filteredProducts.reduce((acc, product) => {
      const godown = product.stock?.godown || 0;
      const store = product.stock?.store || 0;
      
      acc.godown.quantity += godown;
      acc.godown.value += godown * (product.price || 0);
      acc.store.quantity += store;
      acc.store.value += store * (product.price || 0);
      
      return acc;
    }, {
      godown: { quantity: 0, value: 0 },
      store: { quantity: 0, value: 0 }
    });

    // Group by category
    const categoryBreakdown = filteredProducts.reduce((acc, product) => {
      const category = product.categoryName || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { 
          quantity: 0, 
          value: 0, 
          products: 0,
          lowStock: 0,
          outOfStock: 0 
        };
      }
      
      const quantity = product.stock?.total || 0;
      const value = quantity * (product.price || 0);
      
      acc[category].quantity += quantity;
      acc[category].value += value;
      acc[category].products += 1;
      
      if (quantity === 0) {
        acc[category].outOfStock += 1;
      } else if (quantity <= (product.lowStockThreshold || 0)) {
        acc[category].lowStock += 1;
      }
      
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        overview: {
          totalProducts,
          totalQuantity,
          totalStockValue,
          lowStockCount,
          outOfStockCount,
          averageStockValue: totalProducts > 0 ? totalStockValue / totalProducts : 0
        },
        locationBreakdown,
        categoryBreakdown,
        products: filteredProducts,
        filters: {
          category: category || 'all',
          location,
          search,
          minStock,
          maxStock
        }
      }
    });

  } catch (error) {
    console.error('Get stock overview error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get stock summary with pagination and advanced filtering
// @route   GET /api/stock/summary-detailed
// @access  Private
router.get('/summary-detailed', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      stockStatus, // 'low', 'out', 'normal', 'all'
      location, // 'godown', 'store', 'both'
      sortBy = 'name',
      sortOrder = 'asc',
      search
    } = req.query;

    // Build filter
    let filter = {};
    if (category && category !== 'all') {
      filter.categoryName = category;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { qrCode: { $regex: search, $options: 'i' } }
      ];
    }

    // Get products
    let products = await Product.find(filter)
      .select('name qrCode categoryName stock price imageUrl lowStockThreshold createdAt')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

    // Filter by stock status
    if (stockStatus && stockStatus !== 'all') {
      products = products.filter(product => {
        const total = product.stock?.total || 0;
        const threshold = product.lowStockThreshold || 0;
        
        switch (stockStatus) {
          case 'out':
            return total === 0;
          case 'low':
            return total > 0 && total <= threshold;
          case 'normal':
            return total > threshold;
          default:
            return true;
        }
      });
    }

    // Filter by location
    if (location && location !== 'both') {
      products = products.filter(product => {
        if (location === 'godown') {
          return (product.stock?.godown || 0) > 0;
        } else if (location === 'store') {
          return (product.stock?.store || 0) > 0;
        }
        return true;
      });
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProducts = products.slice(startIndex, endIndex);

    // Add stock status to each product
    const productsWithStatus = paginatedProducts.map(product => {
      const total = product.stock?.total || 0;
      const threshold = product.lowStockThreshold || 0;
      
      let stockStatus = 'normal';
      if (total === 0) stockStatus = 'out';
      else if (total <= threshold) stockStatus = 'low';
      
      return {
        ...product.toObject(),
        stockStatus,
        stockValue: total * (product.price || 0)
      };
    });

    res.json({
      success: true,
      data: {
        products: productsWithStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(products.length / limit),
          totalProducts: products.length,
          hasNextPage: endIndex < products.length,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        },
        filters: {
          category: category || 'all',
          stockStatus: stockStatus || 'all',
          location: location || 'both',
          sortBy,
          sortOrder,
          search
        }
      }
    });

  } catch (error) {
    console.error('Get detailed stock summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get stock alerts (low stock, out of stock, expiring batches)
// @route   GET /api/stock/alerts
// @access  Private
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const { priority = 'all' } = req.query;

    // Get low stock products
    const lowStockProducts = await Product.find({
      $expr: {
        $and: [
          { $gt: ['$stock.total', 0] },
          { $lte: ['$stock.total', '$lowStockThreshold'] }
        ]
      }
    }).select('name stock lowStockThreshold price imageUrl categoryName');

    // Get out of stock products
    const outOfStockProducts = await Product.find({
      'stock.total': 0
    }).select('name stock price imageUrl categoryName');

    // Get expiring batches (if using batch system)
    const ProductBatch = require('../models/ProductBatch');
    const expiringBatches = await ProductBatch.find({
      expiryDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
      }
    }).populate('productId', 'name categoryName').sort({ expiryDate: 1 });

    // Calculate alert priorities
    const alerts = [];

    // Critical: Out of stock
    outOfStockProducts.forEach(product => {
      alerts.push({
        id: product._id,
        type: 'out_of_stock',
        priority: 'critical',
        title: 'Out of Stock',
        message: `${product.name} is out of stock`,
        product: product,
        timestamp: new Date()
      });
    });

    // High: Low stock
    lowStockProducts.forEach(product => {
      alerts.push({
        id: product._id,
        type: 'low_stock',
        priority: 'high',
        title: 'Low Stock Alert',
        message: `${product.name} has only ${product.stock.total} units left (threshold: ${product.lowStockThreshold})`,
        product: product,
        timestamp: new Date()
      });
    });

    // Medium: Expiring batches
    expiringBatches.forEach(batch => {
      const daysToExpiry = Math.ceil((batch.expiryDate - new Date()) / (24 * 60 * 60 * 1000));
      alerts.push({
        id: batch._id,
        type: 'expiring_batch',
        priority: 'medium',
        title: 'Batch Expiring Soon',
        message: `Batch ${batch.batchNumber} for ${batch.productId?.name} expires in ${daysToExpiry} days`,
        batch: batch,
        daysToExpiry,
        timestamp: new Date()
      });
    });

    // Filter by priority if specified
    let filteredAlerts = alerts;
    if (priority !== 'all') {
      filteredAlerts = alerts.filter(alert => alert.priority === priority);
    }

    // Sort by priority and timestamp
    const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    filteredAlerts.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Summary counts
    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.priority === 'critical').length,
      high: alerts.filter(a => a.priority === 'high').length,
      medium: alerts.filter(a => a.priority === 'medium').length,
      byType: {
        outOfStock: outOfStockProducts.length,
        lowStock: lowStockProducts.length,
        expiringBatches: expiringBatches.length
      }
    };

    res.json({
      success: true,
      data: {
        alerts: filteredAlerts,
        summary,
        filter: priority
      }
    });

  } catch (error) {
    console.error('Get stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get stock movements history
// @route   GET /api/stock/movements
// @access  Private
router.get('/movements', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      productId,
      movementType, // 'in', 'out', 'transfer'
      dateFrom,
      dateTo,
      userId
    } = req.query;

    // Build filter
    let filter = {};
    if (productId) filter.productId = productId;
    if (userId) filter.userId = userId;
    if (movementType) {
      switch (movementType) {
        case 'in':
          filter.action = { $in: ['INCREASE_STOCK', 'STOCK_RECEIVED'] };
          break;
        case 'out':
          filter.action = { $in: ['REDUCE_STOCK', 'BULK_REDUCTION'] };
          break;
        case 'transfer':
          filter.action = 'STOCK_MOVEMENT';
          break;
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Get movements with pagination
    const skip = (page - 1) * limit;
    const movements = await ActivityLog.find(filter)
      .populate('productId', 'name qrCode categoryName imageUrl')
      .populate('userId', 'username fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMovements = await ActivityLog.countDocuments(filter);

    // Calculate summary
    const summary = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalMovements: { $sum: 1 },
          totalStockIn: {
            $sum: {
              $cond: [
                { $in: ['$action', ['INCREASE_STOCK', 'STOCK_RECEIVED']] },
                { $abs: '$change' },
                0
              ]
            }
          },
          totalStockOut: {
            $sum: {
              $cond: [
                { $in: ['$action', ['REDUCE_STOCK', 'BULK_REDUCTION']] },
                { $abs: '$change' },
                0
              ]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        movements,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalMovements / limit),
          totalMovements,
          hasNextPage: skip + movements.length < totalMovements,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        },
        summary: summary[0] || {
          totalMovements: 0,
          totalStockIn: 0,
          totalStockOut: 0
        },
        filters: {
          productId,
          movementType,
          dateFrom,
          dateTo,
          userId
        }
      }
    });

  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Export stock summary as CSV
// @route   GET /api/stock/export
// @access  Private
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'csv', category, stockStatus } = req.query;

    // Build filter
    let filter = {};
    if (category && category !== 'all') {
      filter.categoryName = category;
    }

    // Get products
    let products = await Product.find(filter)
      .select('name qrCode categoryName stock price lowStockThreshold createdAt');

    // Filter by stock status
    if (stockStatus && stockStatus !== 'all') {
      products = products.filter(product => {
        const total = product.stock?.total || 0;
        const threshold = product.lowStockThreshold || 0;
        
        switch (stockStatus) {
          case 'out':
            return total === 0;
          case 'low':
            return total > 0 && total <= threshold;
          case 'normal':
            return total > threshold;
          default:
            return true;
        }
      });
    }

    if (format === 'csv') {
      const { Parser } = require('json2csv');
      
      const csvData = products.map(product => ({
        'Product Name': product.name,
        'QR Code': product.qrCode,
        'Category': product.categoryName || 'Uncategorized',
        'Total Stock': product.stock?.total || 0,
        'Godown Stock': product.stock?.godown || 0,
        'Store Stock': product.stock?.store || 0,
        'Price': product.price || 0,
        'Stock Value': (product.stock?.total || 0) * (product.price || 0),
        'Low Stock Threshold': product.lowStockThreshold || 0,
        'Stock Status': (() => {
          const total = product.stock?.total || 0;
          const threshold = product.lowStockThreshold || 0;
          if (total === 0) return 'Out of Stock';
          if (total <= threshold) return 'Low Stock';
          return 'Normal';
        })(),
        'Created Date': product.createdAt?.toISOString().split('T')[0] || ''
      }));

      const parser = new Parser();
      const csv = parser.parse(csvData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=stock-summary-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: products
      });
    }

  } catch (error) {
    console.error('Export stock summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
