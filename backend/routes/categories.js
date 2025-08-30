const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// GET /api/categories/list - List all categories with hierarchy
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const { includeProducts = false } = req.query;

    // Get user's shop from the authenticated user
    const user = await require('../models/User').findById(req.user.id).populate('shop');
    if (!user || !user.shop) {
      return res.status(400).json({ message: 'User shop not found. Please contact administrator.' });
    }

    const shopId = user.shop._id;

    // Get category hierarchy
    const categoryHierarchy = await Category.getHierarchy(shopId);

    // If includeProducts is true, populate product counts
    if (includeProducts === 'true') {
      for (let category of categoryHierarchy) {
        const productCount = await Product.countDocuments({ 
          category: category._id,
          shop: shopId 
        });
        category.productCount = productCount;
        
        // Count products in subcategories recursively
        if (category.children && category.children.length > 0) {
          for (let child of category.children) {
            const childProductCount = await Product.countDocuments({ 
              category: child._id,
              shop: shopId 
            });
            child.productCount = childProductCount;
          }
        }
      }
    }

    res.json(categoryHierarchy);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// POST /api/categories/create - Create new category
router.post('/create', authenticateToken, requirePermission('manage_categories'), [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('parent').optional().isMongoId().withMessage('Valid parent category ID required'),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Valid hex color required'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, parent, description, icon, color, sortOrder } = req.body;

    // Get user's shop from the authenticated user
    const user = await require('../models/User').findById(req.user.id).populate('shop');
    if (!user || !user.shop) {
      return res.status(400).json({ message: 'User shop not found. Please contact administrator.' });
    }

    const shopId = user.shop._id;

    // Check if category name already exists in this shop
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      shop: shopId,
      parent: parent || null
    });

    if (existingCategory) {
      return res.status(400).json({ 
        message: 'Category with this name already exists in this location' 
      });
    }

    // If parent is specified, verify it exists and belongs to same shop
    if (parent) {
      const parentCategory = await Category.findOne({ 
        _id: parent, 
        shop: shopId 
      });
      if (!parentCategory) {
        return res.status(400).json({ message: 'Parent category not found' });
      }
    }

    const category = new Category({
      name: name.trim(),
      description: description?.trim(),
      parent: parent || null,
      shop: shopId,
      icon: icon || 'folder',
      color: color || '#6B7280',
      sortOrder: sortOrder || 0,
      createdBy: req.user.id
    });

    await category.save();

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_CATEGORY',
      details: `Created category: ${name}${parent ? ' under parent category' : ''}`
    }).save();

    await category.populate('createdBy', 'username fullName');
    res.status(201).json(category);

  } catch (error) {
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
});

// PUT /api/categories/update/:id - Update category
router.put('/update/:id', authenticateToken, requirePermission('manage_categories'), [
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Valid hex color required'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be non-negative'),
  body('parent').optional().isMongoId().withMessage('Valid parent category ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Verify user has access to shop
    const shop = await Shop.findById(category.shop);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const isOwner = shop.owner.toString() === req.user.id;
    const isStaff = shop.staff.some(s => s.user.toString() === req.user.id);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // If name is being changed, check for duplicates
    if (updateData.name && updateData.name !== category.name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
        shop: category.shop,
        parent: updateData.parent || category.parent,
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({ 
          message: 'Category with this name already exists in this location' 
        });
      }
    }

    // If parent is being changed, verify it exists and prevent circular references
    if (updateData.parent !== undefined) {
      if (updateData.parent) {
        // Check if parent exists
        const parentCategory = await Category.findOne({ 
          _id: updateData.parent, 
          shop: category.shop 
        });
        if (!parentCategory) {
          return res.status(400).json({ message: 'Parent category not found' });
        }

        // Prevent setting self as parent
        if (updateData.parent === id) {
          return res.status(400).json({ message: 'Category cannot be its own parent' });
        }

        // TODO: Add more sophisticated circular reference detection
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username fullName');

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'UPDATE_CATEGORY',
      details: `Updated category: ${updatedCategory.name}`
    }).save();

    res.json(updatedCategory);

  } catch (error) {
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
});

// DELETE /api/categories/delete/:id - Delete category
router.delete('/delete/:id', authenticateToken, requirePermission('manage_categories'), async (req, res) => {
  try {
    const { id } = req.params;
    const { moveProductsTo, deleteSubcategories = false } = req.query;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Verify user has access to shop
    const shop = await Shop.findById(category.shop);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const isOwner = shop.owner.toString() === req.user.id;
    const isStaff = shop.staff.some(s => s.user.toString() === req.user.id);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check for subcategories
    const subcategories = await Category.find({ parent: id });
    if (subcategories.length > 0 && deleteSubcategories !== 'true') {
      return res.status(400).json({ 
        message: 'Category has subcategories. Either delete them first or set deleteSubcategories=true',
        subcategoriesCount: subcategories.length
      });
    }

    // Check for products in this category
    const productsInCategory = await Product.find({ category: id });
    if (productsInCategory.length > 0) {
      if (!moveProductsTo) {
        return res.status(400).json({ 
          message: 'Category contains products. Specify moveProductsTo parameter or move products first',
          productsCount: productsInCategory.length
        });
      }

      // Verify target category exists
      if (moveProductsTo !== 'uncategorized') {
        const targetCategory = await Category.findOne({ 
          _id: moveProductsTo, 
          shop: category.shop 
        });
        if (!targetCategory) {
          return res.status(400).json({ message: 'Target category not found' });
        }
      }

      // Move products
      await Product.updateMany(
        { category: id },
        { 
          category: moveProductsTo === 'uncategorized' ? null : moveProductsTo,
          updatedBy: req.user.id
        }
      );
    }

    // Delete subcategories if requested
    if (deleteSubcategories === 'true') {
      await Category.deleteMany({ parent: id });
    }

    // Delete the category
    await Category.findByIdAndDelete(id);

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'DELETE_CATEGORY',
      details: `Deleted category: ${category.name}${productsInCategory.length > 0 ? ` (moved ${productsInCategory.length} products)` : ''}`
    }).save();

    res.json({ 
      message: 'Category deleted successfully',
      movedProducts: productsInCategory.length,
      deletedSubcategories: deleteSubcategories === 'true' ? subcategories.length : 0
    });

  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
});

// GET /api/categories/:id/products - Get products in category
router.get('/:id/products', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      includeSubcategories = false,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Build query
    let categoryFilter = { category: id };

    if (includeSubcategories === 'true') {
      // Get all subcategory IDs
      const subcategories = await Category.find({ parent: id }).select('_id');
      const subcategoryIds = subcategories.map(sub => sub._id);
      categoryFilter = { 
        category: { $in: [id, ...subcategoryIds] }
      };
    }

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(categoryFilter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'username fullName')
      .populate('category', 'name');

    const total = await Product.countDocuments(categoryFilter);

    res.json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      category: {
        id: category._id,
        name: category.name,
        description: category.description
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching category products', error: error.message });
  }
});

// POST /api/categories/reorder - Reorder categories
router.post('/reorder', authenticateToken, requirePermission('manage_categories'), [
  body('categories').isArray().withMessage('Categories must be an array'),
  body('categories.*.id').isMongoId().withMessage('Valid category ID required'),
  body('categories.*.sortOrder').isInt({ min: 0 }).withMessage('Sort order must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { categories } = req.body;

    // Update all categories in batch
    const updatePromises = categories.map(cat => 
      Category.findByIdAndUpdate(cat.id, { sortOrder: cat.sortOrder })
    );

    await Promise.all(updatePromises);

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'REORDER_CATEGORIES',
      details: `Reordered ${categories.length} categories`
    }).save();

    res.json({ message: 'Categories reordered successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Error reordering categories', error: error.message });
  }
});

module.exports = router;
