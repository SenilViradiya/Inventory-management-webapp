const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// GET /api/purchase-orders/list - List purchase orders
router.get('/list', authenticateToken, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const {
      shopId,
      page = 1,
      limit = 20,
      status,
      supplier,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Build filter
    const filter = { shop: shopId };
    
    if (status) filter.status = status;
    if (supplier) filter.supplier = supplier;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (search) {
      filter.poNumber = { $regex: search, $options: 'i' };
    }

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const purchaseOrders = await PurchaseOrder.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('supplier', 'name company email')
      .populate('createdBy', 'username fullName')
      .populate('items.product', 'name qrCode');

    const total = await PurchaseOrder.countDocuments(filter);

    res.json({
      purchaseOrders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchase orders', error: error.message });
  }
});

// POST /api/purchase-orders/create - Create purchase order
router.post('/create', authenticateToken, requirePermission('manage_suppliers'), [
  body('shopId').isMongoId().withMessage('Valid shop ID is required'),
  body('supplier').isMongoId().withMessage('Valid supplier ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity required'),
  body('items.*.unitCost').isFloat({ min: 0 }).withMessage('Valid unit cost required'),
  body('expectedDeliveryDate').optional().isISO8601().withMessage('Valid delivery date required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { shopId, supplier, items, expectedDeliveryDate, terms, notes } = req.body;

    // Verify supplier exists and belongs to shop
    const supplierDoc = await Supplier.findOne({ _id: supplier, shop: shopId });
    if (!supplierDoc) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Validate products and calculate totals
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.product}` });
      }

      const totalCost = item.quantity * item.unitCost;
      subtotal += totalCost;

      validatedItems.push({
        product: item.product,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost,
        notes: item.notes
      });
    }

    // Calculate tax and total (simplified - 8% tax)
    const tax = subtotal * 0.08;
    const shipping = 0; // Can be added later
    const total = subtotal + tax + shipping;

    const purchaseOrder = new PurchaseOrder({
      shop: shopId,
      supplier,
      items: validatedItems,
      subtotal,
      tax,
      shipping,
      total,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      terms: terms || 'Net 30',
      notes,
      createdBy: req.user.id,
      statusHistory: [{
        status: 'draft',
        updatedBy: req.user.id,
        updatedAt: new Date(),
        notes: 'Purchase order created'
      }]
    });

    await purchaseOrder.save();

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_PURCHASE_ORDER',
      details: `Created purchase order ${purchaseOrder.poNumber} for ${supplierDoc.name}`
    }).save();

    await purchaseOrder.populate([
      { path: 'supplier', select: 'name company email' },
      { path: 'items.product', select: 'name qrCode' }
    ]);

    res.status(201).json(purchaseOrder);

  } catch (error) {
    res.status(500).json({ message: 'Error creating purchase order', error: error.message });
  }
});

// GET /api/purchase-orders/:id - Get purchase order details
router.get('/:id', authenticateToken, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate('supplier')
      .populate('createdBy', 'username fullName')
      .populate('updatedBy', 'username fullName')
      .populate('approvedBy', 'username fullName')
      .populate('items.product', 'name qrCode image')
      .populate('statusHistory.updatedBy', 'username fullName');

    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    res.json(purchaseOrder);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchase order', error: error.message });
  }
});

// PUT /api/purchase-orders/:id/status - Update PO status
router.put('/:id/status', authenticateToken, requirePermission('manage_suppliers'), [
  body('status').isIn(['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'])
    .withMessage('Valid status required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, notes } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const updateData = {
      status,
      updatedBy: req.user.id
    };

    // Set specific timestamps based on status
    if (status === 'sent' && !purchaseOrder.sentAt) {
      updateData.sentAt = new Date();
    } else if (status === 'received' && !purchaseOrder.receivedAt) {
      updateData.receivedAt = new Date();
      updateData.actualDeliveryDate = new Date();
    }

    // Add to status history
    updateData.$push = {
      statusHistory: {
        status,
        updatedBy: req.user.id,
        updatedAt: new Date(),
        notes: notes || `Status updated to ${status}`
      }
    };

    const updatedPO = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('supplier', 'name company');

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_PURCHASE_ORDER',
      details: `Updated PO ${purchaseOrder.poNumber} status to ${status}`
    }).save();

    res.json(updatedPO);

  } catch (error) {
    res.status(500).json({ message: 'Error updating purchase order status', error: error.message });
  }
});

// POST /api/purchase-orders/:id/receive - Receive items
router.post('/:id/receive', authenticateToken, requirePermission('manage_suppliers'), [
  body('items').isArray({ min: 1 }).withMessage('Items to receive are required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID required'),
  body('items.*.receivedQuantity').isInt({ min: 0 }).withMessage('Valid received quantity required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { items: receivedItems } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    // Update received quantities and product stock
    for (const receivedItem of receivedItems) {
      const poItem = purchaseOrder.items.find(
        item => item.product.toString() === receivedItem.product
      );

      if (poItem) {
        const previousReceived = poItem.receivedQuantity || 0;
        const newReceived = receivedItem.receivedQuantity;
        const actuallyReceived = newReceived - previousReceived;

        // Update PO item
        poItem.receivedQuantity = newReceived;

        // Update product stock
        if (actuallyReceived > 0) {
          await Product.findByIdAndUpdate(receivedItem.product, {
            $inc: { quantity: actuallyReceived },
            updatedBy: req.user.id
          });
        }
      }
    }

    // Check if PO is fully received
    const allFullyReceived = purchaseOrder.items.every(
      item => (item.receivedQuantity || 0) >= item.quantity
    );

    const hasPartialReceipts = purchaseOrder.items.some(
      item => (item.receivedQuantity || 0) > 0
    );

    let newStatus = purchaseOrder.status;
    if (allFullyReceived) {
      newStatus = 'received';
    } else if (hasPartialReceipts) {
      newStatus = 'partially_received';
    }

    // Update PO
    const updateData = {
      items: purchaseOrder.items,
      status: newStatus,
      updatedBy: req.user.id
    };

    if (newStatus === 'received') {
      updateData.receivedAt = new Date();
      updateData.actualDeliveryDate = new Date();
    }

    updateData.$push = {
      statusHistory: {
        status: newStatus,
        updatedBy: req.user.id,
        updatedAt: new Date(),
        notes: 'Items received'
      }
    };

    const updatedPO = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'RECEIVE_PURCHASE_ORDER',
      details: `Received items for PO ${purchaseOrder.poNumber}`
    }).save();

    res.json(updatedPO);

  } catch (error) {
    res.status(500).json({ message: 'Error receiving purchase order items', error: error.message });
  }
});

// DELETE /api/purchase-orders/:id - Cancel purchase order
router.delete('/:id', authenticateToken, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    if (['received', 'partially_received'].includes(purchaseOrder.status)) {
      return res.status(400).json({ 
        message: 'Cannot cancel a purchase order that has been received' 
      });
    }

    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      status: 'cancelled',
      updatedBy: req.user.id,
      $push: {
        statusHistory: {
          status: 'cancelled',
          updatedBy: req.user.id,
          updatedAt: new Date(),
          notes: 'Purchase order cancelled'
        }
      }
    });

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CANCEL_PURCHASE_ORDER',
      details: `Cancelled PO ${purchaseOrder.poNumber}`
    }).save();

    res.json({ message: 'Purchase order cancelled successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Error cancelling purchase order', error: error.message });
  }
});

module.exports = router;
