const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Category = require('../models/Category');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken } = require('../middleware/auth');

// GET /api/categories - Get all categories (simplified for inventory management)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const categories = await Category.find({})
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

// POST /api/categories - Create new category
router.post('/', authenticateToken, [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, description, subcategories } = req.body;

    // Check if category name already exists
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    const category = new Category({
      name: name.trim(),
      description: description?.trim(),
      subcategories: subcategories || [],
      createdBy: req.user.id
    });

    await category.save();

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_CATEGORY',
      details: `Created category: ${name}`
    }).save();

    await category.populate('createdBy', 'username email');

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: category
    });

  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', authenticateToken, [
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { name, description, subcategories } = req.body;

    // Check if another category with same name exists
    if (name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (subcategories !== undefined) updateData.subcategories = subcategories;

    const category = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'username email');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_CATEGORY',
      details: `Updated category: ${category.name}`
    }).save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      category: category
    });

  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${productCount} product(s) associated with it.`
      });
    }

    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'DELETE_CATEGORY',
      details: `Deleted category: ${category.name}`
    }).save();

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
});

// GET /api/products - Get all products (simplified for inventory management)
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const products = await Product.find({})
      .populate('category', 'name')
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      products: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// POST /api/products - Create new product
router.post('/products', authenticateToken, [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stockQuantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('category').optional().isMongoId().withMessage('Valid category ID required'),
  body('sku').optional().trim(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, price, stockQuantity, category, sku, description } = req.body;

    // Check if SKU already exists
    if (sku) {
      const existingProduct = await Product.findOne({
        sku: { $regex: new RegExp(`^${sku}$`, 'i') }
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this SKU already exists'
        });
      }
    }

    const product = new Product({
      name: name.trim(),
      price: parseFloat(price),
      stockQuantity: parseInt(stockQuantity),
      category: category || null,
      sku: sku?.trim(),
      description: description?.trim(),
      createdBy: req.user.id
    });

    await product.save();

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_PRODUCT',
      details: `Created product: ${name}`
    }).save();

    await product.populate('category', 'name');
    await product.populate('createdBy', 'username email');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: product
    });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// PUT /api/products/:id - Update product
router.put('/products/:id', authenticateToken, [
  body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stockQuantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('category').optional().isMongoId().withMessage('Valid category ID required'),
  body('sku').optional().trim(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { name, price, stockQuantity, category, sku, description } = req.body;

    // Check if SKU already exists on another product
    if (sku) {
      const existingProduct = await Product.findOne({
        sku: { $regex: new RegExp(`^${sku}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this SKU already exists'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (stockQuantity !== undefined) updateData.stockQuantity = parseInt(stockQuantity);
    if (category !== undefined) updateData.category = category;
    if (sku !== undefined) updateData.sku = sku?.trim();
    if (description !== undefined) updateData.description = description?.trim();

    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name').populate('createdBy', 'username email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_PRODUCT',
      details: `Updated product: ${product.name}`
    }).save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: product
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'DELETE_PRODUCT',
      details: `Deleted product: ${product.name}`
    }).save();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

module.exports = router;
