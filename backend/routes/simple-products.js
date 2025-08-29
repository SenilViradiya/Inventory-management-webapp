const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const { simpleAuthenticateToken } = require('../middleware/simpleAuth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/products/');
  },
  filename: function (req, file, cb) {
    const uniqueName = `product-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    
    if (mimeType && extName) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// GET /api/simple-products - Get all products with pagination and filtering
router.get('/', simpleAuthenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      category, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      lowStock 
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { qrCode: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }
    
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'username fullName');

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching products', 
      error: error.message 
    });
  }
});

// GET /api/simple-products/:id - Get single product
router.get('/:id', simpleAuthenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'username fullName');
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      product
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching product', 
      error: error.message 
    });
  }
});

// POST /api/simple-products - Create new product
router.post('/', simpleAuthenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      quantity, 
      category, 
      lowStockThreshold = 10,
      expirationDate,
      qrCode 
    } = req.body;

    // Create new product
    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      category,
      lowStockThreshold: parseInt(lowStockThreshold),
      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
      qrCode: qrCode || `AUTO-${Date.now()}`,
      image: req.file ? req.file.filename : undefined,
      createdBy: req.user._id
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error creating product', 
      error: error.message 
    });
  }
});

// PUT /api/simple-products/:id - Update product
router.put('/:id', simpleAuthenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      quantity, 
      category, 
      lowStockThreshold,
      expirationDate 
    } = req.body;

    const updateData = {
      ...(name && { name }),
      ...(description && { description }),
      ...(price && { price: parseFloat(price) }),
      ...(quantity !== undefined && { quantity: parseInt(quantity) }),
      ...(category && { category }),
      ...(lowStockThreshold && { lowStockThreshold: parseInt(lowStockThreshold) }),
      ...(expirationDate && { expirationDate: new Date(expirationDate) }),
      ...(req.file && { image: req.file.filename }),
      updatedAt: new Date()
    };

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'username fullName');

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating product', 
      error: error.message 
    });
  }
});

// DELETE /api/simple-products/:id - Delete product
router.delete('/:id', simpleAuthenticateToken, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting product', 
      error: error.message 
    });
  }
});

// GET /api/simple-products/search/qr/:qrCode - Search by QR code
router.get('/search/qr/:qrCode', simpleAuthenticateToken, async (req, res) => {
  try {
    const product = await Product.findOne({ qrCode: req.params.qrCode })
      .populate('createdBy', 'username fullName');
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      product
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error searching product', 
      error: error.message 
    });
  }
});

module.exports = router;
