const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');
const Shop = require('../models/Shop');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// GET /api/suppliers/list - List suppliers
router.get('/list', authenticateToken, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const {
      shopId,
      page = 1,
      limit = 20,
      search,
      category,
      isActive = true,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Build filter
    const filter = { shop: shopId };
    
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (category) filter.categories = category;
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const suppliers = await Supplier.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'username fullName');

    const total = await Supplier.countDocuments(filter);

    res.json({
      suppliers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching suppliers', error: error.message });
  }
});

// POST /api/suppliers/create - Create supplier
router.post('/create', authenticateToken, requirePermission('manage_suppliers'), [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('shopId').isMongoId().withMessage('Valid shop ID is required'),
  body('address.street').trim().notEmpty().withMessage('Street address is required'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.state').trim().notEmpty().withMessage('State is required'),
  body('address.postalCode').trim().notEmpty().withMessage('Postal code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const supplierData = {
      ...req.body,
      shop: req.body.shopId,
      createdBy: req.user.id
    };

    // Check if supplier email already exists for this shop
    const existingSupplier = await Supplier.findOne({
      email: req.body.email,
      shop: req.body.shopId
    });

    if (existingSupplier) {
      return res.status(400).json({ message: 'Supplier with this email already exists' });
    }

    const supplier = new Supplier(supplierData);
    await supplier.save();

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_SUPPLIER',
      details: `Created supplier: ${supplier.name}`
    }).save();

    await supplier.populate('createdBy', 'username fullName');
    res.status(201).json(supplier);

  } catch (error) {
    res.status(500).json({ message: 'Error creating supplier', error: error.message });
  }
});

// GET /api/suppliers/:id - Get supplier details
router.get('/:id', authenticateToken, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate('createdBy', 'username fullName');

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json(supplier);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching supplier', error: error.message });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', authenticateToken, requirePermission('manage_suppliers'), [
  body('name').optional().trim().notEmpty().withMessage('Supplier name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim().notEmpty().withMessage('Phone number cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Check if email is being changed and already exists
    if (req.body.email && req.body.email !== supplier.email) {
      const existingSupplier = await Supplier.findOne({
        email: req.body.email,
        shop: supplier.shop,
        _id: { $ne: req.params.id }
      });

      if (existingSupplier) {
        return res.status(400).json({ message: 'Supplier with this email already exists' });
      }
    }

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'username fullName');

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_SUPPLIER',
      details: `Updated supplier: ${updatedSupplier.name}`
    }).save();

    res.json(updatedSupplier);

  } catch (error) {
    res.status(500).json({ message: 'Error updating supplier', error: error.message });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', authenticateToken, requirePermission('manage_suppliers'), async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Soft delete - mark as inactive
    await Supplier.findByIdAndUpdate(req.params.id, { isActive: false });

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'DELETE_SUPPLIER',
      details: `Deleted supplier: ${supplier.name}`
    }).save();

    res.json({ message: 'Supplier deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Error deleting supplier', error: error.message });
  }
});

// GET /api/suppliers/:id/performance - Get supplier performance metrics
router.get('/:id/performance', authenticateToken, requirePermission('view_analytics'), async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 90 } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // This would require PurchaseOrder model to be fully implemented
    // For now, return placeholder data
    const performance = {
      totalOrders: 0,
      totalSpent: 0,
      avgDeliveryTime: 0,
      onTimeDeliveryRate: 0,
      qualityRating: 0,
      recentOrders: []
    };

    res.json(performance);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching supplier performance', error: error.message });
  }
});

// PUT /api/suppliers/:id/rating - Update supplier rating
router.put('/:id/rating', authenticateToken, requirePermission('manage_suppliers'), [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating, notes } = req.body;

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { rating, notes },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'RATE_SUPPLIER',
      details: `Rated supplier ${supplier.name}: ${rating}/5 stars`
    }).save();

    res.json(supplier);

  } catch (error) {
    res.status(500).json({ message: 'Error updating supplier rating', error: error.message });
  }
});

module.exports = router;
