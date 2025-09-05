const express = require('express');
const router = express.Router();
const ProductBatch = require('../models/ProductBatch');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all batches with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      expired = false,
      productId,
      search,
      sortBy = 'expiryDate',
      sortOrder = 'asc'
    } = req.query;

    // Build filter query
    let filter = {};
    
    // Filter by product if specified
    if (productId) {
      filter.productId = productId;
    }

    // Filter by expired status
    const now = new Date();
    if (expired === 'true') {
      filter.expiryDate = { $lt: now };
    } else if (expired === 'false') {
      filter.expiryDate = { $gte: now };
    }

    // Search in batch number or product name
    if (search) {
      filter.$or = [
        { batchNumber: { $regex: search, $options: 'i' } },
        // You can add product name search by joining with Product model if needed
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const batches = await ProductBatch.find(filter)
      .populate('productId', 'name categoryName price')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const totalBatches = await ProductBatch.countDocuments(filter);
    const totalPages = Math.ceil(totalBatches / limitNum);

    // Calculate summary statistics
    const summary = await ProductBatch.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$totalQty' },
          totalValue: { $sum: { $multiply: ['$totalQty', '$sellingPrice'] } },
          avgQuantityPerBatch: { $avg: '$totalQty' },
          expiringSoon: {
            $sum: {
              $cond: [
                { $lte: ['$expiryDate', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          },
          expired: {
            $sum: {
              $cond: [
                { $lt: ['$expiryDate', now] },
                1,
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
        batches,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBatches,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        summary: summary[0] || {
          totalQuantity: 0,
          totalValue: 0,
          avgQuantityPerBatch: 0,
          expiringSoon: 0,
          expired: 0
        },
        filters: {
          expired,
          productId,
          search,
          sortBy,
          sortOrder
        }
      }
    });
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ message: 'Error fetching batches', error: err.message });
  }
});

// Create a new batch (Purchase/Receive stock - goes to GODOWN only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const payload = req.body;
    
    // 🏭 BUSINESS RULE: New batches ALWAYS go to GODOWN first
    // When purchasing/receiving stock, it should go to warehouse (godown) first
    const receivedQuantity = payload.totalQty || payload.quantity || payload.godownQty || 0;
    
    // Force new stock to godown only
    payload.godownQty = receivedQuantity;
    payload.storeQty = 0; // Store stock is 0 for new batches
    payload.totalQty = receivedQuantity;
    payload.originalQty = receivedQuantity;
    
    // Remove any conflicting quantity fields
    delete payload.quantity;
    
    console.log('🆕 Creating new batch (GODOWN STOCK) with payload:', JSON.stringify({
      productId: payload.productId,
      batchNumber: payload.batchNumber,
      receivedQuantity,
      godownQty: payload.godownQty,
      storeQty: payload.storeQty,
      totalQty: payload.totalQty,
      originalQty: payload.originalQty
    }, null, 2));
    
    const batch = new ProductBatch(payload);
    await batch.save();

    console.log('💾 Batch saved to database with ID:', batch._id);
    console.log('📦 Final batch quantities after save:', {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty, 
      totalQty: batch.totalQty,
      originalQty: batch.originalQty,
      productId: batch.productId
    });

    // Update product stock summary
    console.log('🔄 About to update product stock summary...');
    await updateProductStockSummary(payload.productId);

    console.log('✅ Batch created successfully. Stock added to GODOWN:', {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty, 
      totalQty: batch.totalQty
    });

    res.status(201).json({
      success: true,
      data: batch,
      message: `Batch created successfully! ${receivedQuantity} units added to Godown. Use transfer function to move to store.`
    });
  } catch (err) {
    console.error('❌ Error creating batch:', err);
    res.status(500).json({ message: 'Error creating batch', error: err.message });
  }
});

// Helper function to update product stock summary from batches
async function updateProductStockSummary(productId) {
  const Product = require('../models/Product');
  const mongoose = require('mongoose');
  
  try {
    console.log('📊 Updating product stock summary for productId:', productId);
    
    // Ensure productId is a valid ObjectId
    const objectId = mongoose.Types.ObjectId.isValid(productId) ? 
      new mongoose.Types.ObjectId(productId) : productId;
    
    // Calculate stock from all batches for this product
    const stockSummary = await ProductBatch.aggregate([
      { $match: { productId: objectId } },
      {
        $group: {
          _id: null,
          totalGodown: { $sum: '$godownQty' },
          totalStore: { $sum: '$storeQty' },
          totalQty: { $sum: '$totalQty' }
        }
      }
    ]);

    console.log('📋 Batch aggregation result:', stockSummary);
    
    const summary = stockSummary[0] || { totalGodown: 0, totalStore: 0, totalQty: 0 };
    
    console.log('📈 Calculated stock summary:', summary);

    // Update product stock
    const updateResult = await Product.findByIdAndUpdate(productId, {
      'stock.godown': summary.totalGodown,
      'stock.store': summary.totalStore,
      'stock.total': summary.totalQty,
      quantity: summary.totalQty // Also update legacy quantity field
    }, { new: true });

    console.log('✅ Product stock updated successfully:', {
      productId,
      newStock: {
        godown: summary.totalGodown,
        store: summary.totalStore,
        total: summary.totalQty
      },
      updatedProduct: updateResult ? {
        _id: updateResult._id,
        name: updateResult.name,
        stock: updateResult.stock,
        quantity: updateResult.quantity
      } : 'Product not found'
    });
    
  } catch (error) {
    console.error('❌ Error updating product stock summary:', error);
    throw error;
  }
}

// Get batches for a product
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const batches = await ProductBatch.find({ productId }).sort({ expiryDate: 1 });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching batches', error: err.message });
  }
});

// 📊 GET STOCK STATUS FOR A PRODUCT (Godown vs Store breakdown)
router.get('/stock-status/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const Product = require('../models/Product');
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Get all batches for this product
    const batches = await ProductBatch.find({ productId }).sort({ expiryDate: 1 });
    
    // Calculate stock breakdown
    const stockBreakdown = {
      totalGodown: 0,
      totalStore: 0,
      totalStock: 0,
      batchCount: batches.length,
      batches: batches.map(batch => ({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        godownQty: batch.godownQty,
        storeQty: batch.storeQty,
        totalQty: batch.totalQty,
        status: batch.status,
        isExpired: batch.isExpired(),
        isNearExpiry: batch.isNearExpiry()
      }))
    };

    // Sum up quantities
    batches.forEach(batch => {
      stockBreakdown.totalGodown += batch.godownQty;
      stockBreakdown.totalStore += batch.storeQty;
      stockBreakdown.totalStock += batch.totalQty;
    });

    // Compare with product stock
    const productStock = {
      godown: product.stock?.godown || 0,
      store: product.stock?.store || 0,
      total: product.stock?.total || product.quantity || 0
    };

    res.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        productStock,
        batchStock: stockBreakdown,
        stockMatch: {
          godown: productStock.godown === stockBreakdown.totalGodown,
          store: productStock.store === stockBreakdown.totalStore,
          total: productStock.total === stockBreakdown.totalStock
        }
      }
    });

  } catch (err) {
    console.error('❌ Error fetching stock status:', err);
    res.status(500).json({ message: 'Error fetching stock status', error: err.message });
  }
});

// 📝 UPDATE/EDIT BATCH (Comprehensive correction with validation)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get original batch data
    const originalBatch = await ProductBatch.findById(id).populate('productId', 'name');
    if (!originalBatch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    // Store original quantities for logging
    const originalQuantities = {
      godownQty: originalBatch.godownQty,
      storeQty: originalBatch.storeQty,
      totalQty: originalBatch.totalQty
    };

    console.log('📝 Updating batch:', originalBatch.batchNumber);
    console.log('📊 Original quantities:', originalQuantities);
    console.log('🔄 Requested updates:', updates);

    // Validate and process quantity updates
    if (updates.godownQty !== undefined || updates.storeQty !== undefined) {
      const newGodownQty = updates.godownQty !== undefined ? updates.godownQty : originalBatch.godownQty;
      const newStoreQty = updates.storeQty !== undefined ? updates.storeQty : originalBatch.storeQty;
      
      // Validate non-negative quantities
      if (newGodownQty < 0 || newStoreQty < 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Quantities cannot be negative' 
        });
      }

      // Auto-calculate total quantity
      updates.totalQty = newGodownQty + newStoreQty;
      
      console.log('📊 New quantities will be:', {
        godownQty: newGodownQty,
        storeQty: newStoreQty,
        totalQty: updates.totalQty
      });
    }

    // Update the batch
    const updatedBatch = await ProductBatch.findByIdAndUpdate(
      id, 
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('productId', 'name');

    // Update product stock summary
    await updateProductStockSummary(originalBatch.productId);

    // Log the correction activity
    const ActivityLog = require('../models/ActivityLog');
    const changedFields = [];
    
    if (originalQuantities.godownQty !== updatedBatch.godownQty) {
      changedFields.push(`Godown: ${originalQuantities.godownQty} → ${updatedBatch.godownQty}`);
    }
    if (originalQuantities.storeQty !== updatedBatch.storeQty) {
      changedFields.push(`Store: ${originalQuantities.storeQty} → ${updatedBatch.storeQty}`);
    }
    if (originalQuantities.totalQty !== updatedBatch.totalQty) {
      changedFields.push(`Total: ${originalQuantities.totalQty} → ${updatedBatch.totalQty}`);
    }

    await new ActivityLog({
      userId: req.user.id,
      action: 'BATCH_CORRECTION',
      details: `Corrected batch ${updatedBatch.batchNumber} for ${updatedBatch.productId.name}. Changes: ${changedFields.join(', ')}`
    }).save();

    console.log('✅ Batch updated successfully');

    res.json({
      success: true,
      message: 'Batch updated successfully and product stock recalculated',
      data: {
        batch: updatedBatch,
        changes: {
          original: originalQuantities,
          updated: {
            godownQty: updatedBatch.godownQty,
            storeQty: updatedBatch.storeQty,
            totalQty: updatedBatch.totalQty
          },
          changedFields
        }
      }
    });

  } catch (err) {
    console.error('❌ Error updating batch:', err);
    res.status(500).json({ message: 'Error updating batch', error: err.message });
  }
});

// 🔄 REVERSE/UNDO BATCH (Complete reversal)
router.post('/:id/reverse', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Batch reversal/correction' } = req.body;
    
    const batch = await ProductBatch.findById(id).populate('productId', 'name');
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    console.log('🔄 Reversing batch:', batch.batchNumber);
    console.log('📊 Current quantities:', {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty,
      totalQty: batch.totalQty
    });

    // Store original data for logging
    const originalData = {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty,
      totalQty: batch.totalQty,
      status: batch.status
    };

    // Reverse all quantities to zero
    batch.godownQty = 0;
    batch.storeQty = 0;
    batch.totalQty = 0;
    batch.status = 'reversed';
    batch.updatedAt = new Date();
    
    await batch.save();

    // Update product stock summary
    await updateProductStockSummary(batch.productId);

    // Log the reversal
    const ActivityLog = require('../models/ActivityLog');
    await new ActivityLog({
      userId: req.user.id,
      action: 'BATCH_REVERSAL',
      details: `Reversed batch ${batch.batchNumber} for ${batch.productId.name}. Original quantities - Godown: ${originalData.godownQty}, Store: ${originalData.storeQty}, Total: ${originalData.totalQty}. Reason: ${reason}`
    }).save();

    console.log('✅ Batch reversed successfully');

    res.json({
      success: true,
      message: 'Batch reversed successfully - all quantities set to zero',
      data: {
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        productName: batch.productId.name,
        reason,
        originalQuantities: originalData,
        currentQuantities: {
          godownQty: batch.godownQty,
          storeQty: batch.storeQty,
          totalQty: batch.totalQty,
          status: batch.status
        }
      }
    });

  } catch (err) {
    console.error('❌ Error reversing batch:', err);
    res.status(500).json({ message: 'Error reversing batch', error: err.message });
  }
});

// ⚖️ STOCK ADJUSTMENT (Add/Remove quantities with reason)
router.post('/:id/adjust', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      adjustmentType, // 'add' or 'remove'
      location, // 'godown' or 'store'
      quantity,
      reason = 'Stock adjustment'
    } = req.body;

    // Validation
    if (!adjustmentType || !location || !quantity || quantity <= 0) {
      return res.status(400).json({ 
        success: false,
        message: 'adjustmentType (add/remove), location (godown/store), and positive quantity are required' 
      });
    }

    if (!['add', 'remove'].includes(adjustmentType)) {
      return res.status(400).json({ 
        success: false,
        message: 'adjustmentType must be "add" or "remove"' 
      });
    }

    if (!['godown', 'store'].includes(location)) {
      return res.status(400).json({ 
        success: false,
        message: 'location must be "godown" or "store"' 
      });
    }

    const batch = await ProductBatch.findById(id).populate('productId', 'name');
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    console.log(`⚖️ ${adjustmentType.toUpperCase()} adjustment: ${quantity} units ${adjustmentType === 'add' ? 'to' : 'from'} ${location}`);
    console.log('📊 Before adjustment:', {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty,
      totalQty: batch.totalQty
    });

    // Store original quantities
    const originalQuantities = {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty,
      totalQty: batch.totalQty
    };

    // Apply adjustment
    const adjustmentValue = adjustmentType === 'add' ? quantity : -quantity;
    
    if (location === 'godown') {
      const newGodownQty = batch.godownQty + adjustmentValue;
      if (newGodownQty < 0) {
        return res.status(400).json({ 
          success: false,
          message: `Cannot remove ${quantity} units. Only ${batch.godownQty} units available in godown` 
        });
      }
      batch.godownQty = newGodownQty;
    } else { // store
      const newStoreQty = batch.storeQty + adjustmentValue;
      if (newStoreQty < 0) {
        return res.status(400).json({ 
          success: false,
          message: `Cannot remove ${quantity} units. Only ${batch.storeQty} units available in store` 
        });
      }
      batch.storeQty = newStoreQty;
    }

    // Recalculate total
    batch.totalQty = batch.godownQty + batch.storeQty;
    batch.updatedAt = new Date();

    await batch.save();

    console.log('📊 After adjustment:', {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty,
      totalQty: batch.totalQty
    });

    // Update product stock summary
    await updateProductStockSummary(batch.productId);

    // Log the adjustment
    const ActivityLog = require('../models/ActivityLog');
    await new ActivityLog({
      userId: req.user.id,
      action: 'STOCK_ADJUSTMENT',
      details: `${adjustmentType.toUpperCase()} ${quantity} units ${adjustmentType === 'add' ? 'to' : 'from'} ${location} for batch ${batch.batchNumber} (${batch.productId.name}). Reason: ${reason}`
    }).save();

    console.log('✅ Stock adjustment completed');

    res.json({
      success: true,
      message: `Successfully ${adjustmentType === 'add' ? 'added' : 'removed'} ${quantity} units ${adjustmentType === 'add' ? 'to' : 'from'} ${location}`,
      data: {
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        productName: batch.productId.name,
        adjustment: {
          type: adjustmentType,
          location,
          quantity,
          reason
        },
        quantities: {
          before: originalQuantities,
          after: {
            godownQty: batch.godownQty,
            storeQty: batch.storeQty,
            totalQty: batch.totalQty
          }
        }
      }
    });

  } catch (err) {
    console.error('❌ Error adjusting stock:', err);
    res.status(500).json({ message: 'Error adjusting stock', error: err.message });
  }
});

// 📜 GET BATCH HISTORY/AUDIT TRAIL
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const batch = await ProductBatch.findById(id).populate('productId', 'name');
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    // Get all activity logs related to this batch
    const ActivityLog = require('../models/ActivityLog');
    const batchHistory = await ActivityLog.find({
      $or: [
        { details: { $regex: batch.batchNumber, $options: 'i' } },
        { details: { $regex: batch._id.toString(), $options: 'i' } }
      ]
    })
    .populate('userId', 'username fullName')
    .sort({ createdAt: -1 })
    .limit(50);

    // Also get transfer and sale history for this batch
    const transferHistory = await ActivityLog.find({
      action: { $in: ['STOCK_TRANSFER_GODOWN_TO_STORE', 'PROCESS_SALE'] },
      details: { $regex: batch.batchNumber, $options: 'i' }
    })
    .populate('userId', 'username fullName')
    .sort({ createdAt: -1 });

    const allHistory = [...batchHistory, ...transferHistory]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50); // Limit to 50 most recent entries

    res.json({
      success: true,
      data: {
        batch: {
          _id: batch._id,
          batchNumber: batch.batchNumber,
          productName: batch.productId.name,
          currentQuantities: {
            godownQty: batch.godownQty,
            storeQty: batch.storeQty,
            totalQty: batch.totalQty
          },
          status: batch.status,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt
        },
        history: allHistory.map(log => ({
          id: log._id,
          action: log.action,
          details: log.details,
          performedBy: log.userId ? 
            (log.userId.fullName || log.userId.username) : 'System',
          timestamp: log.createdAt,
          date: new Date(log.createdAt).toLocaleDateString('en-GB'),
          time: new Date(log.createdAt).toLocaleTimeString('en-GB')
        })),
        summary: {
          totalActivities: allHistory.length,
          lastActivity: allHistory.length > 0 ? allHistory[0].createdAt : null,
          actionsCount: {
            created: allHistory.filter(h => h.action.includes('CREATE')).length,
            transfers: allHistory.filter(h => h.action.includes('TRANSFER')).length,
            sales: allHistory.filter(h => h.action.includes('SALE')).length,
            corrections: allHistory.filter(h => h.action.includes('CORRECTION') || h.action.includes('ADJUSTMENT') || h.action.includes('REVERSAL')).length
          }
        }
      }
    });

  } catch (err) {
    console.error('❌ Error fetching batch history:', err);
    res.status(500).json({ message: 'Error fetching batch history', error: err.message });
  }
});

// Delete a batch
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const batch = await ProductBatch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    
    const productId = batch.productId;
    await ProductBatch.findByIdAndDelete(req.params.id);
    
    // Update product stock after deleting batch
    await updateProductStockSummary(productId);
    
    res.json({ success: true, message: 'Batch deleted and product stock updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting batch', error: err.message });
  }
});

// 🚚 TRANSFER STOCK FROM GODOWN TO STORE
router.post('/transfer-to-store', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { batchId, quantity, reason = 'Stock replenishment' } = req.body;
    
    if (!batchId || !quantity || quantity <= 0) {
      return res.status(400).json({ 
        success: false,
        message: 'batchId and positive quantity are required' 
      });
    }

    const batch = await ProductBatch.findById(batchId).populate('productId', 'name');
    if (!batch) {
      return res.status(404).json({ 
        success: false,
        message: 'Batch not found' 
      });
    }

    // Check if enough stock in godown
    if (batch.godownQty < quantity) {
      return res.status(400).json({ 
        success: false,
        message: `Insufficient godown stock. Available: ${batch.godownQty}, Requested: ${quantity}` 
      });
    }

    console.log(`🚚 Transferring ${quantity} units from Godown to Store for batch ${batch.batchNumber}`);
    console.log('📊 Before transfer:', {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty,
      totalQty: batch.totalQty
    });

    // Transfer stock: Godown → Store
    batch.godownQty -= quantity;
    batch.storeQty += quantity;
    // Total quantity remains the same (just moving location)
    
    await batch.save();

    console.log('📊 After transfer:', {
      godownQty: batch.godownQty,
      storeQty: batch.storeQty,
      totalQty: batch.totalQty
    });

    // Update product stock summary
    await updateProductStockSummary(batch.productId);

    // Log the transfer activity
    const ActivityLog = require('../models/ActivityLog');
    await new ActivityLog({
      userId: req.user.id,
      action: 'STOCK_TRANSFER_GODOWN_TO_STORE',
      details: `Transferred ${quantity} units of ${batch.productId.name} from Godown to Store (Batch: ${batch.batchNumber}). Reason: ${reason}`
    }).save();

    res.json({
      success: true,
      message: `Successfully transferred ${quantity} units from Godown to Store`,
      data: {
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        productName: batch.productId.name,
        transferredQuantity: quantity,
        reason,
        currentStock: {
          godown: batch.godownQty,
          store: batch.storeQty,
          total: batch.totalQty
        }
      }
    });

  } catch (err) {
    console.error('❌ Error transferring stock:', err);
    res.status(500).json({ message: 'Error transferring stock', error: err.message });
  }
});

// 💰 PROCESS SALE (Reduce from Store Stock)
router.post('/process-sale', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity, salePrice, reason = 'Product sale' } = req.body;
    
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ 
        success: false,
        message: 'productId and positive quantity are required' 
      });
    }

    // Find batches with store stock (FIFO - First In, First Out by expiry date)
    const batchesWithStoreStock = await ProductBatch.find({
      productId: productId,
      storeQty: { $gt: 0 }
    }).sort({ expiryDate: 1 }).populate('productId', 'name');

    if (batchesWithStoreStock.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No store stock available for sale. Transfer stock from godown first.' 
      });
    }

    // Check total available store stock
    const totalStoreStock = batchesWithStoreStock.reduce((sum, batch) => sum + batch.storeQty, 0);
    if (totalStoreStock < quantity) {
      return res.status(400).json({ 
        success: false,
        message: `Insufficient store stock. Available: ${totalStoreStock}, Requested: ${quantity}` 
      });
    }

    console.log(`💰 Processing sale of ${quantity} units using FIFO method`);
    
    let remainingQuantity = quantity;
    const updatedBatches = [];

    // Process sale using FIFO (First expiring first)
    for (const batch of batchesWithStoreStock) {
      if (remainingQuantity <= 0) break;

      const quantityFromThisBatch = Math.min(batch.storeQty, remainingQuantity);
      
      console.log(`📦 Taking ${quantityFromThisBatch} from batch ${batch.batchNumber} (expires: ${batch.expiryDate})`);
      
      batch.storeQty -= quantityFromThisBatch;
      batch.totalQty -= quantityFromThisBatch; // Reduce total quantity (sold)
      
      await batch.save();
      updatedBatches.push({
        batchNumber: batch.batchNumber,
        quantitySold: quantityFromThisBatch,
        remainingStore: batch.storeQty,
        remainingTotal: batch.totalQty
      });
      
      remainingQuantity -= quantityFromThisBatch;
    }

    // Update product stock summary
    await updateProductStockSummary(productId);

    // Log the sale activity
    const ActivityLog = require('../models/ActivityLog');
    const product = await require('../models/Product').findById(productId);
    await new ActivityLog({
      userId: req.user.id,
      action: 'PROCESS_SALE',
      details: `Sold ${quantity} units of ${product.name}. Reason: ${reason}. Batches used: ${updatedBatches.length}`
    }).save();

    res.json({
      success: true,
      message: `Successfully processed sale of ${quantity} units`,
      data: {
        productId,
        productName: product.name,
        quantitySold: quantity,
        salePrice: salePrice || 'Not specified',
        reason,
        batchesUsed: updatedBatches
      }
    });

  } catch (err) {
    console.error('❌ Error processing sale:', err);
    res.status(500).json({ message: 'Error processing sale', error: err.message });
  }
});

// Get expired batches
router.get('/expired', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const expiredBatches = await ProductBatch.find({
      expiryDate: { $lt: new Date() }
    })
    .populate('productId', 'name categoryName')
    .sort({ expiryDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const totalExpired = await ProductBatch.countDocuments({
      expiryDate: { $lt: new Date() }
    });

    res.json({
      success: true,
      data: {
        expiredBatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalExpired / parseInt(limit)),
          totalExpired,
          limit: parseInt(limit)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching expired batches', error: err.message });
  }
});

// Get expiring soon batches (next 7 days)
router.get('/expiring-soon', authenticateToken, async (req, res) => {
  try {
    const { days = 7, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + parseInt(days));
    
    const expiringSoonBatches = await ProductBatch.find({
      expiryDate: { 
        $gte: new Date(),
        $lte: expiringDate
      }
    })
    .populate('productId', 'name categoryName')
    .sort({ expiryDate: 1 })
    .skip(skip)
    .limit(parseInt(limit));

    const totalExpiringSoon = await ProductBatch.countDocuments({
      expiryDate: { 
        $gte: new Date(),
        $lte: expiringDate
      }
    });

    res.json({
      success: true,
      data: {
        expiringSoonBatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalExpiringSoon / parseInt(limit)),
          totalExpiringSoon,
          limit: parseInt(limit)
        },
        daysFilter: parseInt(days)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching expiring batches', error: err.message });
  }
});

// Get batch statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const stats = await ProductBatch.aggregate([
      {
        $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          totalQuantity: { $sum: '$totalQty' },
          totalValue: { $sum: { $multiply: ['$totalQty', '$sellingPrice'] } },
          averageQuantity: { $avg: '$totalQty' },
          expired: {
            $sum: {
              $cond: [{ $lt: ['$expiryDate', now] }, 1, 0]
            }
          },
          expiring7Days: {
            $sum: {
              $cond: [
                { $and: [
                  { $gte: ['$expiryDate', now] },
                  { $lte: ['$expiryDate', next7Days] }
                ]},
                1,
                0
              ]
            }
          },
          expiring30Days: {
            $sum: {
              $cond: [
                { $and: [
                  { $gte: ['$expiryDate', now] },
                  { $lte: ['$expiryDate', next30Days] }
                ]},
                1,
                0
              ]
            }
          },
          godownStock: { $sum: '$godownQty' },
          storeStock: { $sum: '$storeQty' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalBatches: 0,
        totalQuantity: 0,
        totalValue: 0,
        averageQuantity: 0,
        expired: 0,
        expiring7Days: 0,
        expiring30Days: 0,
        godownStock: 0,
        storeStock: 0
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching batch statistics', error: err.message });
  }
});

// Search batches by product name or batch number
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { 
      q, // search query
      page = 1, 
      limit = 20,
      status = 'all', // 'active', 'expired', 'expiring', 'all'
      location = 'all' // 'godown', 'store', 'all'
    } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query (q) is required'
      });
    }

    // Build search filter
    let searchFilter = {
      $or: [
        { batchNumber: { $regex: q, $options: 'i' } }
      ]
    };

    // First find products matching the search term
    const Product = require('../models/Product');
    const matchingProducts = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { qrCode: { $regex: q, $options: 'i' } }
      ]
    }).select('_id');

    // Add product IDs to search filter
    if (matchingProducts.length > 0) {
      searchFilter.$or.push({
        productId: { $in: matchingProducts.map(p => p._id) }
      });
    }

    // Add status filter
    const now = new Date();
    if (status === 'expired') {
      searchFilter.expiryDate = { $lt: now };
    } else if (status === 'expiring') {
      searchFilter.expiryDate = {
        $gte: now,
        $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      };
    } else if (status === 'active') {
      searchFilter.expiryDate = { $gte: now };
    }

    // Add location filter
    if (location === 'godown') {
      searchFilter.godownQty = { $gt: 0 };
    } else if (location === 'store') {
      searchFilter.storeQty = { $gt: 0 };
    }

    // Execute search with pagination
    const skip = (page - 1) * limit;
    const batches = await ProductBatch.find(searchFilter)
      .populate('productId', 'name categoryName price imageUrl qrCode')
      .sort({ expiryDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalResults = await ProductBatch.countDocuments(searchFilter);

    // Add calculated fields
    const enrichedBatches = batches.map(batch => {
      const daysToExpiry = Math.ceil((batch.expiryDate - now) / (24 * 60 * 60 * 1000));
      return {
        ...batch.toObject(),
        daysToExpiry,
        isExpired: batch.expiryDate < now,
        isExpiringSoon: daysToExpiry <= 7 && daysToExpiry > 0,
        totalValue: batch.totalQty * batch.sellingPrice
      };
    });

    res.json({
      success: true,
      data: {
        batches: enrichedBatches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalResults / limit),
          totalResults,
          hasNextPage: skip + batches.length < totalResults,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        },
        searchQuery: q,
        filters: { status, location }
      }
    });

  } catch (err) {
    console.error('Batch search error:', err);
    res.status(500).json({ message: 'Error searching batches', error: err.message });
  }
});

// Export batches as CSV, Excel, or PDF
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { 
      format = 'csv', // 'csv', 'excel', 'pdf'
      status = 'all',
      location = 'all',
      productId,
      startDate,
      endDate
    } = req.query;

    // Build filter
    let filter = {};
    if (productId) filter.productId = productId;
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Status filter
    const now = new Date();
    if (status === 'expired') {
      filter.expiryDate = { $lt: now };
    } else if (status === 'expiring') {
      filter.expiryDate = {
        $gte: now,
        $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      };
    } else if (status === 'active') {
      filter.expiryDate = { $gte: now };
    }

    // Location filter
    if (location === 'godown') {
      filter.godownQty = { $gt: 0 };
    } else if (location === 'store') {
      filter.storeQty = { $gt: 0 };
    }

    // Get batches
    const batches = await ProductBatch.find(filter)
      .populate('productId', 'name categoryName qrCode')
      .sort({ expiryDate: 1 });

    // Prepare data for export
    const exportData = batches.map(batch => {
      const daysToExpiry = Math.ceil((batch.expiryDate - now) / (24 * 60 * 60 * 1000));
      return {
        'Batch Number': batch.batchNumber,
        'Product Name': batch.productId?.name || 'N/A',
        'Product QR': batch.productId?.qrCode || 'N/A',
        'Category': batch.productId?.categoryName || 'N/A',
        'Total Quantity': batch.totalQty,
        'Godown Quantity': batch.godownQty,
        'Store Quantity': batch.storeQty,
        'Purchase Price': batch.purchasePrice,
        'Selling Price': batch.sellingPrice,
        'Total Value': batch.totalQty * batch.sellingPrice,
        'Expiry Date': batch.expiryDate.toISOString().split('T')[0],
        'Days to Expiry': daysToExpiry,
        'Status': batch.expiryDate < now ? 'Expired' : 
                 daysToExpiry <= 7 ? 'Expiring Soon' : 'Active',
        'Created Date': batch.createdAt.toISOString().split('T')[0]
      };
    });

    if (format === 'csv') {
      const { Parser } = require('json2csv');
      const parser = new Parser();
      const csv = parser.parse(exportData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=batches-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);

    } else if (format === 'excel') {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Batches');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=batches-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buffer);

    } else if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=batches-${new Date().toISOString().split('T')[0]}.pdf`);
      
      doc.pipe(res);
      
      // Title
      doc.fontSize(20).text('Batch Inventory Report', { align: 'center' });
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);
      
      // Summary
      doc.fontSize(14).text('Summary:', { underline: true });
      doc.fontSize(10)
         .text(`Total Batches: ${batches.length}`)
         .text(`Total Quantity: ${batches.reduce((sum, b) => sum + b.totalQty, 0)}`)
         .text(`Total Value: $${batches.reduce((sum, b) => sum + (b.totalQty * b.sellingPrice), 0).toFixed(2)}`)
         .moveDown();
      
      // Table header
      const startY = doc.y;
      const rowHeight = 20;
      const colWidths = [80, 120, 60, 60, 80, 80];
      const headers = ['Batch #', 'Product', 'Qty', 'Days', 'Value', 'Status'];
      
      let currentY = startY;
      
      // Draw headers
      doc.fontSize(8).fillColor('black');
      headers.forEach((header, i) => {
        const x = 50 + colWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
        doc.rect(x, currentY, colWidths[i], rowHeight).stroke();
        doc.text(header, x + 5, currentY + 5, { width: colWidths[i] - 10 });
      });
      
      currentY += rowHeight;
      
      // Draw data rows
      exportData.slice(0, 30).forEach((batch, index) => { // Limit to 30 rows for PDF
        const rowData = [
          batch['Batch Number'],
          batch['Product Name'].substring(0, 15),
          batch['Total Quantity'].toString(),
          batch['Days to Expiry'].toString(),
          `$${batch['Total Value'].toFixed(1)}`,
          batch['Status']
        ];
        
        rowData.forEach((data, i) => {
          const x = 50 + colWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
          doc.rect(x, currentY, colWidths[i], rowHeight).stroke();
          doc.text(data, x + 5, currentY + 5, { width: colWidths[i] - 10 });
        });
        
        currentY += rowHeight;
        
        // Add new page if needed
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
      });
      
      if (exportData.length > 30) {
        doc.text(`... and ${exportData.length - 30} more batches`, 50, currentY + 20);
      }
      
      doc.end();

    } else {
      res.json({
        success: true,
        data: exportData
      });
    }

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ message: 'Error exporting batch data', error: err.message });
  }
});

// Add stock to existing batch
router.post('/add-stock', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { batchId, godownQty = 0, storeQty = 0, reason } = req.body;

    if (!batchId || (godownQty <= 0 && storeQty <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID and valid quantity (godown or store) are required'
      });
    }

    const batch = await ProductBatch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Update batch quantities
    batch.godownQty += parseInt(godownQty);
    batch.storeQty += parseInt(storeQty);
    batch.totalQty = batch.godownQty + batch.storeQty;
    
    await batch.save();

    // Update product stock summary
    await updateProductStockSummary(batch.productId);

    // Log activity
    const ActivityLog = require('../models/ActivityLog');
    await ActivityLog.create({
      userId: req.user._id,
      action: 'INCREASE_STOCK',
      productId: batch.productId,
      change: parseInt(godownQty) + parseInt(storeQty),
      reason: reason || 'Stock added to batch',
      details: {
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        godownAdded: godownQty,
        storeAdded: storeQty
      }
    });

    res.json({
      success: true,
      data: batch,
      message: 'Stock added to batch successfully'
    });

  } catch (err) {
    console.error('Add stock to batch error:', err);
    res.status(500).json({ message: 'Error adding stock to batch', error: err.message });
  }
});

module.exports = router;

// Admin endpoints to trigger expiry job and check status
const { executeExpiryJob, getStatus } = require('../services/expiryRunner');

router.post('/_run-expiry', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await executeExpiryJob();
    res.json({ success: true, status: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/_expiry-status', authenticateToken, requireRole('admin'), async (req, res) => {
  res.json(getStatus());
});
