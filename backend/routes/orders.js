const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requirePermission, requireShopAccess } = require('../middleware/auth');

// GET /api/orders/list - List orders with filters
router.get('/list', authenticateToken, requirePermission('manage_orders'), async (req, res) => {
  try {
    const {
      shopId,
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortBy = 'orderDate',
      sortOrder = 'desc'
    } = req.query;

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Build filter
    const filter = { shop: shopId };
    
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) filter.orderDate.$lte = new Date(endDate);
    }
    
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'username fullName')
      .populate('items.product', 'name qrCode image');

    const total = await Order.countDocuments(filter);

    // Calculate summary statistics
    const summary = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' },
          statusBreakdown: {
            $push: {
              status: '$status',
              total: '$total'
            }
          }
        }
      }
    ]);

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      summary: summary[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        statusBreakdown: []
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

// POST /api/orders/create - Create new order
router.post('/create', authenticateToken, requirePermission('manage_orders'), [
  body('shopId').isMongoId().withMessage('Valid shop ID is required'),
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.email').optional().isEmail().withMessage('Valid email required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity required'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Valid unit price required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { shopId, customer, items, notes, paymentMethod = 'cash' } = req.body;

    // Verify shop access
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Validate products and calculate totals
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.product}` });
      }

      if (product.quantity < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}` 
        });
      }

      const totalPrice = item.quantity * item.unitPrice;
      subtotal += totalPrice;

      validatedItems.push({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        discount: item.discount || 0
      });
    }

    // Calculate tax and total (simplified - 8% tax)
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    // Create order
    const order = new Order({
      shop: shopId,
      customer,
      items: validatedItems,
      subtotal,
      tax,
      total,
      paymentMethod,
      notes,
      createdBy: req.user.id,
      statusHistory: [{
        status: 'pending',
        updatedBy: req.user.id,
        updatedAt: new Date(),
        notes: 'Order created'
      }]
    });

    await order.save();

    // Update product quantities
    for (const item of validatedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.quantity },
        updatedBy: req.user.id
      });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_ORDER',
      details: `Created order ${order.orderNumber} for ${customer.name}`
    }).save();

    await order.populate('items.product', 'name qrCode image');
    res.status(201).json(order);

  } catch (error) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
});

// GET /api/orders/details/:id - Get detailed order info
router.get('/details/:id', authenticateToken, requirePermission('manage_orders'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('shop', 'name')
      .populate('createdBy', 'username fullName')
      .populate('updatedBy', 'username fullName')
      .populate('items.product', 'name qrCode image category')
      .populate('statusHistory.updatedBy', 'username fullName');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching order details', error: error.message });
  }
});

// PUT /api/orders/update/:id - Update order status
router.put('/update/:id', authenticateToken, requirePermission('manage_orders'), [
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Valid status required'),
  body('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded'])
    .withMessage('Valid payment status required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, paymentStatus, notes, deliveryDate } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const updateData = {
      updatedBy: req.user.id
    };

    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);

    // Add to status history
    const statusHistoryEntry = {
      status: status || order.status,
      updatedBy: req.user.id,
      updatedAt: new Date(),
      notes: notes || `Status updated to ${status || order.status}`
    };

    updateData.$push = { statusHistory: statusHistoryEntry };

    // If order is cancelled, restore product quantities
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: item.quantity }
        });
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('items.product', 'name qrCode image');

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_ORDER',
      details: `Updated order ${order.orderNumber} status to ${status || order.status}`
    }).save();

    res.json(updatedOrder);

  } catch (error) {
    res.status(500).json({ message: 'Error updating order', error: error.message });
  }
});

// GET /api/orders/analytics/:shopId - Get order analytics
router.get('/analytics/:shopId', authenticateToken, requirePermission('view_analytics'), async (req, res) => {
  try {
    const { shopId } = req.params;
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const analytics = await Order.aggregate([
      {
        $match: {
          shop: mongoose.Types.ObjectId(shopId),
          orderDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$orderDate' }
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Status breakdown
    const statusBreakdown = await Order.aggregate([
      {
        $match: {
          shop: mongoose.Types.ObjectId(shopId),
          orderDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      }
    ]);

    // Top products
    const topProducts = await Order.aggregate([
      {
        $match: {
          shop: mongoose.Types.ObjectId(shopId),
          orderDate: { $gte: startDate }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ]);

    res.json({
      dailyAnalytics: analytics,
      statusBreakdown,
      topProducts,
      period: parseInt(period)
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching order analytics', error: error.message });
  }
});

module.exports = router;
