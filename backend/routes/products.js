const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Validation rules
const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('expirationDate').isISO8601().withMessage('Valid expiration date is required'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('qrCode').trim().notEmpty().withMessage('QR code is required'),
  body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be non-negative')
];

// GET /api/products - Get all products with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      category,
      search,
      lowStock,
      expiringSoon,
      expired,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { qrCode: { $regex: search, $options: 'i' } }
      ];
    }

    // Get products with filtering
    let query = Product.find(filter);

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    query = query.sort(sortOptions);

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    query = query.skip(skip).limit(parseInt(limit));

    const products = await query.populate('createdBy', 'username fullName');
    const total = await Product.countDocuments(filter);

    // Apply additional filters after fetching (for virtual properties)
    let filteredProducts = products;
    
    if (lowStock === 'true') {
      filteredProducts = filteredProducts.filter(product => product.isLowStock);
    }
    
    if (expiringSoon === 'true') {
      filteredProducts = filteredProducts.filter(product => product.isExpiringSoon && !product.isExpired);
    }
    
    if (expired === 'true') {
      filteredProducts = filteredProducts.filter(product => product.isExpired);
    }

    res.json({
      products: filteredProducts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'username fullName')
      .populate('updatedBy', 'username fullName');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
});

// GET /api/products/qr/:qrCode - Get product by QR code
router.get('/qr/:qrCode', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findOne({ qrCode: req.params.qrCode })
      .populate('createdBy', 'username fullName');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
});

// POST /api/products - Create new product (Admin only)
router.post('/', authenticateToken, requireRole('admin'), upload.single('image'), productValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if QR code already exists
    const existingProduct = await Product.findOne({ qrCode: req.body.qrCode });
    if (existingProduct) {
      return res.status(400).json({ message: 'Product with this QR code already exists' });
    }

    const productData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Add image path if uploaded
    if (req.file) {
      productData.image = `/uploads/products/${req.file.filename}`;
    }

    const product = new Product(productData);
    await product.save();

    // Log the activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_PRODUCT',
      productId: product._id,
      details: `Created product: ${product.name}`
    }).save();

    await product.populate('createdBy', 'username fullName');
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
});

// PUT /api/products/:id - Update product (Admin only)
router.put('/:id', authenticateToken, requireRole('admin'), upload.single('image'), async (req, res) => {
  try {
    // Only validate fields that are being updated
    const fieldsToValidate = [];
    if (req.body.name !== undefined) fieldsToValidate.push(body('name').trim().notEmpty().withMessage('Product name is required'));
    if (req.body.price !== undefined) fieldsToValidate.push(body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'));
    if (req.body.category !== undefined) fieldsToValidate.push(body('category').trim().notEmpty().withMessage('Category is required'));
    if (req.body.expirationDate !== undefined && req.body.expirationDate !== '') fieldsToValidate.push(body('expirationDate').isISO8601().withMessage('Valid expiration date is required'));
    if (req.body.quantity !== undefined) fieldsToValidate.push(body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'));
    if (req.body.qrCode !== undefined) fieldsToValidate.push(body('qrCode').trim().notEmpty().withMessage('QR code is required'));
    if (req.body.lowStockThreshold !== undefined) fieldsToValidate.push(body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be non-negative'));

    // Run validations only on provided fields
    if (fieldsToValidate.length > 0) {
      await Promise.all(fieldsToValidate.map(validation => validation.run(req)));
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if QR code is being changed and if it already exists
    if (req.body.qrCode && req.body.qrCode !== product.qrCode) {
      const existingProduct = await Product.findOne({ 
        qrCode: req.body.qrCode,
        _id: { $ne: req.params.id }
      });
      if (existingProduct) {
        return res.status(400).json({ message: 'Product with this QR code already exists' });
      }
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    // Add image path if uploaded
    if (req.file) {
      updateData.image = `/uploads/products/${req.file.filename}`;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: false }
    ).populate('createdBy', 'username fullName').populate('updatedBy', 'username fullName');

    // Log the activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_PRODUCT',
      productId: updatedProduct._id,
      details: `Updated product: ${updatedProduct.name}`
    }).save();

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
});

// DELETE /api/products/:id - Delete product (Admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);

    // Log the activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'DELETE_PRODUCT',
      productId: req.params.id,
      details: `Deleted product: ${product.name}`
    }).save();

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
});

// PATCH /api/products/:id/quantity - Update product quantity only
router.patch('/:id/quantity', authenticateToken, async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ message: 'Quantity is required' });
    }

    const quantityNum = parseInt(quantity);
    if (isNaN(quantityNum) || quantityNum < 0) {
      return res.status(400).json({ message: 'Quantity must be a non-negative integer' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { 
        quantity: quantityNum,
        updatedBy: req.user.id
      },
      { new: true, runValidators: false }
    ).populate('createdBy', 'username fullName').populate('updatedBy', 'username fullName');

    // Log the activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_QUANTITY',
      productId: updatedProduct._id,
      details: `Updated quantity for ${updatedProduct.name} to ${quantityNum}`
    }).save();

    res.json(updatedProduct);
  } catch (error) {
    console.error('Quantity update error:', error);
    res.status(500).json({ message: 'Error updating quantity', error: error.message });
  }
});

// GET /api/products/categories/list - Get all categories
router.get('/categories/list', authenticateToken, async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories.sort());
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

module.exports = router;
