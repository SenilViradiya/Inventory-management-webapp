const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Ensure exports directory exists
const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

     
      
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const { includeProducts = false } = req.query;

    // Get user's shop from the authenticated user
    const user = await require('../models/User').findById(req.user.id).populate('shop');
    
    // For superadmin/developer users, return all categories from all shops
    if (req.user.role === 'superadmin' || !user || !user.shop) {
      const allCategories = await Category.find({}).sort({ name: 1 });
      
      if (includeProducts === 'true') {
        for (let category of allCategories) {
          const productCount = await Product.countDocuments({ 
            category: category._id,
          });
          category.productCount = productCount;
        }
      }
      
      return res.json({
        categories: allCategories,
        count: allCategories.length
      });
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
    const productsInCategory = await Product.find({ 
      $or: [
        { categoryId: id },
        { category: id }
      ]
    });
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
        { 
          $or: [
            { categoryId: id },
            { category: id }
          ]
        },
        { 
          categoryId: moveProductsTo === 'uncategorized' ? null : moveProductsTo,
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
    let categoryFilter = { 
      $or: [
        { categoryId: id },
        { category: id }
      ]
    };

    if (includeSubcategories === 'true') {
      // Get all subcategory IDs
      const subcategories = await Category.find({ parent: id }).select('_id');
      const subcategoryIds = subcategories.map(sub => sub._id);
      categoryFilter = { 
        $or: [
          { categoryId: { $in: [id, ...subcategoryIds] } },
          { category: { $in: [id, ...subcategoryIds] } }
        ]
      };
    }
      // Get category IDs and names to search (include subcategories if requested)
      let searchCategoryIds = [category._id];
      let searchCategoryNames = [category.name];
      
      if (includeSubcategories === 'true') {
        const subcategories = await Category.find({ 
          parent: category._id,
          ...shopFilter 
        }).select('_id name');
        searchCategoryIds.push(...subcategories.map(sub => sub._id));
        searchCategoryNames.push(...subcategories.map(sub => sub.name));
      }

      // Build a product query that matches either categoryId (ObjectId) OR category/categoryName stored as strings
      const categoryOrClauses = [
        { categoryId: { $in: searchCategoryIds } },
        // some products store category as an ObjectId in `category` field
        { category: { $in: searchCategoryIds } },
        // some products store category as a string in `category` or `categoryName`
        { category: { $in: searchCategoryNames } },
        { categoryName: { $in: searchCategoryNames } }
      ];

      // Support optional search filter (search product name/brand/qrCode)
      const searchTerm = (req.query.search || '').trim();
      const productQuery = {};

      if (searchTerm) {
        const regex = { $regex: new RegExp(searchTerm, 'i') };
        productQuery.$and = [
          { $or: categoryOrClauses },
          { $or: [ { name: regex }, { brand: regex }, { qrCode: regex } ] }
        ];
      } else {
        productQuery.$or = categoryOrClauses;
      }

    // Apply sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(productQuery)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'username fullName')
      .populate('category', 'name');

    const total = await Product.countDocuments(productQuery);

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

// GET /api/categories/inventory-overview - Get category-wise inventory overview
router.get('/inventory-overview', authenticateToken, async (req, res) => {
  try {
    const { categoryId } = req.query;

    // Get user's shop from the authenticated user
    const user = await require('../models/User').findById(req.user.id).populate('shop');
    
    let shopFilter = {};
    if (user && user.shop && req.user.role !== 'superadmin') {
      shopFilter = { shop: user.shop._id };
    }

    // Get all categories or specific category
    let categoryFilter = shopFilter;
    if (categoryId) {
      categoryFilter._id = categoryId;
    }

    const categories = await Category.find(categoryFilter).sort({ name: 1 });

    const inventoryOverview = await Promise.all(categories.map(async (category) => {
      // Get products in this category
      // Try both categoryId and category fields for compatibility
      const products = await Product.find({ 
        $or: [
          { categoryId: category._id },
          { category: category._id }
        ],
        ...shopFilter
      });

      // Calculate stock statistics
      const totalProducts = products.length;
      const totalStock = products.reduce((sum, product) => sum + (product.stock?.total || product.quantity || 0), 0);
      const lowStockProducts = products.filter(product => {
        const currentStock = product.stock?.total || product.quantity || 0;
        return currentStock <= (product.lowStockThreshold || 5);
      });
      const outOfStockProducts = products.filter(product => {
        const currentStock = product.stock?.total || product.quantity || 0;
        return currentStock === 0;
      });
      const expiringProducts = products.filter(product => {
        if (!product.expirationDate) return false;
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        return product.expirationDate <= sevenDaysFromNow;
      });

      // Calculate total stock value
      const totalStockValue = products.reduce((sum, product) => {
        const stock = product.stock?.total || product.quantity || 0;
        return sum + (stock * (product.price || 0));
      }, 0);

      // Get stock distribution
      const stockDistribution = {
        godown: products.reduce((sum, product) => sum + (product.stock?.godown || 0), 0),
        store: products.reduce((sum, product) => sum + (product.stock?.store || 0), 0),
        reserved: products.reduce((sum, product) => sum + (product.stock?.reserved || 0), 0)
      };

      return {
        category: {
          id: category._id,
          name: category.name,
          description: category.description,
          icon: category.icon,
          color: category.color,
          parent: category.parent
        },
        inventory: {
          totalProducts,
          totalStock,
          totalStockValue: Math.round(totalStockValue * 100) / 100,
          stockDistribution,
          alerts: {
            lowStock: {
              count: lowStockProducts.length,
              products: lowStockProducts.map(p => ({
                id: p._id,
                name: p.name,
                currentStock: p.stock?.total || p.quantity || 0,
                threshold: p.lowStockThreshold || 5,
                price: p.price
              }))
            },
            outOfStock: {
              count: outOfStockProducts.length,
              products: outOfStockProducts.map(p => ({
                id: p._id,
                name: p.name,
                price: p.price
              }))
            },
            expiring: {
              count: expiringProducts.length,
              products: expiringProducts.map(p => ({
                id: p._id,
                name: p.name,
                expirationDate: p.expirationDate,
                currentStock: p.stock?.total || p.quantity || 0,
                price: p.price
              }))
            }
          }
        }
      };
    }));

    // If specific category requested, return single category data
    if (categoryId) {
      const categoryData = inventoryOverview[0];
      if (!categoryData) {
        return res.status(404).json({ message: 'Category not found' });
      }
      return res.json(categoryData);
    }

    // Calculate summary statistics
    const summary = {
      totalCategories: inventoryOverview.length,
      totalProducts: inventoryOverview.reduce((sum, cat) => sum + cat.inventory.totalProducts, 0),
      totalStock: inventoryOverview.reduce((sum, cat) => sum + cat.inventory.totalStock, 0),
      totalStockValue: Math.round(inventoryOverview.reduce((sum, cat) => sum + cat.inventory.totalStockValue, 0) * 100) / 100,
      totalLowStock: inventoryOverview.reduce((sum, cat) => sum + cat.inventory.alerts.lowStock.count, 0),
      totalOutOfStock: inventoryOverview.reduce((sum, cat) => sum + cat.inventory.alerts.outOfStock.count, 0),
      totalExpiring: inventoryOverview.reduce((sum, cat) => sum + cat.inventory.alerts.expiring.count, 0)
    };

    res.json({
      summary,
      categories: inventoryOverview
    });

  } catch (error) {
    console.error('Error fetching category inventory overview:', error);
    res.status(500).json({ message: 'Error fetching category inventory overview', error: error.message });
  }
});

// GET /api/categories/stock-summary - Get detailed stock summary by category
router.get('/stock-summary', authenticateToken, async (req, res) => {
  try {
    const { 
      categoryId, 
      categoryName,
      includeSubcategories = false,
      sortBy = 'name',
      sortOrder = 'asc',
      stockFilter = 'all', // 'all', 'low', 'out', 'normal'
      format = 'json' // 'json', 'csv', 'excel', 'pdf'
    } = req.query;

    // Get user's shop from the authenticated user
    const user = await require('../models/User').findById(req.user.id).populate('shop');
    
    let shopFilter = {};
    if (user && user.shop && req.user.role !== 'superadmin') {
      shopFilter = { shop: user.shop._id };
    }

    // Build category filter
    let categoryFilter = { ...shopFilter };
    
    if (categoryId) {
      categoryFilter._id = categoryId;
    } else if (categoryName) {
      categoryFilter.name = { $regex: new RegExp(categoryName, 'i') };
    }

    // Get matching categories
    const categories = await Category.find(categoryFilter).sort({ name: 1 });

    if (categories.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No categories found matching the criteria' 
      });
    }

    // Process each category to get stock summary
    const categoryStockSummary = await Promise.all(categories.map(async (category) => {
      // Get category IDs and names to search (include subcategories if requested)
      let searchCategoryIds = [category._id];
      let searchCategoryNames = [category.name];
      
      if (includeSubcategories === 'true') {
        const subcategories = await Category.find({ 
          parent: category._id,
          ...shopFilter 
        }).select('_id name');
        searchCategoryIds.push(...subcategories.map(sub => sub._id));
        searchCategoryNames.push(...subcategories.map(sub => sub.name).filter(Boolean));
      }

        // Build a robust set of clauses that covers different ways category is stored:
        // - categoryId (ObjectId)
        // - category (ObjectId)
        // - category (string name)
        // - categoryName (string)
        const categoryOrClauses = [
          { categoryId: { $in: searchCategoryIds } },
          { category: { $in: searchCategoryIds } },
          { category: { $in: searchCategoryNames } },
          { categoryName: { $in: searchCategoryNames } }
        ];

        // Base product query - NOTE: Products don't have shop field, only categories do
        // Base product query - no shop filter since products don't have shop field
        let productQuery = {};

        // Support optional search filter (search product name/brand/qrCode/categoryName)
        const searchTerm = (req.query.search || '').trim();
        if (searchTerm) {
          const regex = { $regex: new RegExp(searchTerm, 'i') };
          productQuery.$and = [
            { $or: categoryOrClauses },
            { $or: [ { name: regex }, { brand: regex }, { qrCode: regex }, { categoryName: regex } ] }
          ];
        } else {
          productQuery.$or = categoryOrClauses;
        }        // Find matching products (will be further filtered/sorted/paginated in memory)
        const products = await Product.find(productQuery).populate('createdBy', 'username fullName');
        console.log(`\n=== DEBUG INFO for category ${category.name} (${category._id}) ===`);
        console.log('Search Category IDs:', searchCategoryIds);
        console.log('Search Category Names:', searchCategoryNames);
        console.log('Product Query:', JSON.stringify(productQuery, null, 2));
        console.log(`Found ${products.length} products`);
        if (products.length > 0) {
          console.log('First product sample:', {
            id: products[0]._id,
            name: products[0].name,
            category: products[0].category,
            categoryId: products[0].categoryId,
            categoryName: products[0].categoryName
          });
        }
        // Pagination params for product lists (applied after filtering & sorting)
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10), 1), 1000);
        const skip = (page - 1) * limit;

      // Filter products based on stock status if specified
      let filteredProducts = products;
      if (stockFilter !== 'all') {
        filteredProducts = products.filter(product => {
          const totalStock = product.stock?.total || product.quantity || 0;
          const threshold = product.lowStockThreshold || 5;
          
          switch (stockFilter) {
            case 'low':
              return totalStock > 0 && totalStock <= threshold;
            case 'out':
              return totalStock === 0;
            case 'normal':
              return totalStock > threshold;
            default:
              return true;
          }
        });
      }

  // Sort products
      filteredProducts.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'stock':
            aValue = a.stock?.total || a.quantity || 0;
            bValue = b.stock?.total || b.quantity || 0;
            break;
          case 'godownStock':
            aValue = a.stock?.godown || 0;
            bValue = b.stock?.godown || 0;
            break;
          case 'storeStock':
            aValue = a.stock?.store || 0;
            bValue = b.stock?.store || 0;
            break;
          case 'stockValue':
            aValue = (a.stock?.total || a.quantity || 0) * a.price;
            bValue = (b.stock?.total || b.quantity || 0) * b.price;
            break;
          case 'price':
            aValue = a.price;
            bValue = b.price;
            break;
          default:
            aValue = a[sortBy] || '';
            bValue = b[sortBy] || '';
        }

        if (sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });
  // Apply pagination to sorted results
  const paginatedProducts = filteredProducts.slice(skip, skip + limit);

  // Transform products data with detailed stock information
  const productStockDetails = paginatedProducts.map(product => {
        const godownStock = product.stock?.godown || 0;
        const storeStock = product.stock?.store || 0;
        const totalStock = product.stock?.total || product.quantity || 0;
        const reservedStock = product.stock?.reserved || 0;
        const availableStock = totalStock - reservedStock;
        const threshold = product.lowStockThreshold || 5;
        const stockValue = totalStock * product.price;

        return {
          productId: product._id,
          productName: product.name,
          brand: product.brand || '',
          qrCode: product.qrCode,
          price: product.price,
          description: product.description || '',
          
          // Detailed Stock Information
          stockDetails: {
            godown: {
              quantity: godownStock,
              percentage: totalStock > 0 ? Math.round((godownStock / totalStock) * 100) : 0
            },
            store: {
              quantity: storeStock,
              percentage: totalStock > 0 ? Math.round((storeStock / totalStock) * 100) : 0
            },
            total: totalStock,
            reserved: reservedStock,
            available: availableStock,
            stockValue: Math.round(stockValue * 100) / 100
          },
          
          // Stock Status and Alerts
          stockStatus: {
            level: totalStock === 0 ? 'OUT_OF_STOCK' : 
                   totalStock <= threshold ? 'LOW_STOCK' : 'NORMAL',
            threshold: threshold,
            isLowStock: totalStock > 0 && totalStock <= threshold,
            isOutOfStock: totalStock === 0,
            needsReorder: totalStock <= threshold,
            stockHealth: totalStock === 0 ? 'Critical' :
                        totalStock <= threshold ? 'Poor' :
                        totalStock <= threshold * 2 ? 'Fair' : 'Good'
          },
          
          // Additional Information
          expirationDate: product.expirationDate,
          isExpiring: product.expirationDate && 
                     product.expirationDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdBy: product.createdBy?.fullName || 'N/A',
          lastUpdated: product.updatedAt || product.createdAt
        };
      });

      // Calculate category-level stock summary
      const categoryTotalStock = filteredProducts.reduce((sum, p) => sum + (p.stock?.total || p.quantity || 0), 0);
      const categoryGodownStock = filteredProducts.reduce((sum, p) => sum + (p.stock?.godown || 0), 0);
      const categoryStoreStock = filteredProducts.reduce((sum, p) => sum + (p.stock?.store || 0), 0);
      const categoryReservedStock = filteredProducts.reduce((sum, p) => sum + (p.stock?.reserved || 0), 0);
      const categoryStockValue = filteredProducts.reduce((sum, p) => {
        const stock = p.stock?.total || p.quantity || 0;
        return sum + (stock * p.price);
      }, 0);

      const lowStockCount = filteredProducts.filter(p => {
        const stock = p.stock?.total || p.quantity || 0;
        return stock > 0 && stock <= (p.lowStockThreshold || 5);
      }).length;

      const outOfStockCount = filteredProducts.filter(p => (p.stock?.total || p.quantity || 0) === 0).length;

      return {
        category: {
          id: category._id,
          name: category.name,
          description: category.description || '',
          icon: category.icon || 'folder',
          color: category.color || '#6B7280'
        },
        
        // Category Stock Summary
        stockSummary: {
          totalProducts: filteredProducts.length,
          stockDistribution: {
            godown: {
              quantity: categoryGodownStock,
              percentage: categoryTotalStock > 0 ? Math.round((categoryGodownStock / categoryTotalStock) * 100) : 0
            },
            store: {
              quantity: categoryStoreStock,
              percentage: categoryTotalStock > 0 ? Math.round((categoryStoreStock / categoryTotalStock) * 100) : 0
            },
            total: categoryTotalStock,
            reserved: categoryReservedStock,
            available: categoryTotalStock - categoryReservedStock
          },
          stockValue: Math.round(categoryStockValue * 100) / 100,
          alerts: {
            lowStock: lowStockCount,
            outOfStock: outOfStockCount,
            needsAttention: lowStockCount + outOfStockCount
          }
        },
        
        // Individual Product Details (paginated)
        products: productStockDetails,
        pagination: {
          currentPage: page,
          itemsPerPage: limit,
          totalItems: filteredProducts.length,
          totalPages: Math.max(1, Math.ceil(filteredProducts.length / limit))
        }
      };
    }));

    // Calculate overall summary
    const overallSummary = {
      totalCategories: categoryStockSummary.length,
      totalProducts: categoryStockSummary.reduce((sum, cat) => sum + cat.stockSummary.totalProducts, 0),
      overallStock: {
        godown: categoryStockSummary.reduce((sum, cat) => sum + cat.stockSummary.stockDistribution.godown.quantity, 0),
        store: categoryStockSummary.reduce((sum, cat) => sum + cat.stockSummary.stockDistribution.store.quantity, 0),
        total: categoryStockSummary.reduce((sum, cat) => sum + cat.stockSummary.stockDistribution.total, 0),
        reserved: categoryStockSummary.reduce((sum, cat) => sum + cat.stockSummary.stockDistribution.reserved, 0)
      },
      totalStockValue: Math.round(categoryStockSummary.reduce((sum, cat) => sum + cat.stockSummary.stockValue, 0) * 100) / 100,
      overallAlerts: {
        totalLowStock: categoryStockSummary.reduce((sum, cat) => sum + cat.stockSummary.alerts.lowStock, 0),
        totalOutOfStock: categoryStockSummary.reduce((sum, cat) => sum + cat.stockSummary.alerts.outOfStock, 0)
      }
    };

    // Add percentage calculations to overall summary
    if (overallSummary.overallStock.total > 0) {
      overallSummary.overallStock.godownPercentage = Math.round((overallSummary.overallStock.godown / overallSummary.overallStock.total) * 100);
      overallSummary.overallStock.storePercentage = Math.round((overallSummary.overallStock.store / overallSummary.overallStock.total) * 100);
    }

    // Log activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'VIEW_CATEGORY_STOCK_SUMMARY',
      details: `Viewed category stock summary - ${overallSummary.totalCategories} categories, ${overallSummary.totalProducts} products`
    }).save();
    console.log(`User ${req.user.id} viewed category stock summary - ${overallSummary.totalCategories} categories, ${overallSummary.totalProducts} products`);

    // Handle different export formats
    if (format === 'csv') {
      return exportStockSummaryAsCSV(res, categoryStockSummary, overallSummary);
    } else if (format === 'excel') {
      return exportStockSummaryAsExcel(res, categoryStockSummary, overallSummary);
    } else if (format === 'pdf') {
      return exportStockSummaryAsPDF(res, categoryStockSummary, overallSummary);
    }

    res.json({
      success: true,
      message: 'Category stock summary retrieved successfully',
      summary: overallSummary,
      categories: categoryStockSummary,
      filters: {
        categoryId,
        categoryName,
        includeSubcategories,
        stockFilter,
        sortBy,
        sortOrder,
        format
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching category stock summary:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching category stock summary', 
      error: error.message 
    });
  }
});

// UK-specific formatting utilities
const formatCurrencyUK = (amount) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatDateUK = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(date));
};

const formatDateTimeUK = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(date));
};

/**
 * Export stock summary as CSV with professional UK formatting
 * @param {Object} res - Express response object
 * @param {Array} categoryStockSummary - Category-wise stock data
 * @param {Object} overallSummary - Overall summary statistics
 */
function exportStockSummaryAsCSV(res, categoryStockSummary, overallSummary) {
  try {
    const csvData = [];
    
    // Add header information
    csvData.push({
      'Category Name': 'STOCK SUMMARY REPORT',
      'Category Description': 'Inventory Management System',
      'Product Name': `Generated: ${formatDateTimeUK(new Date())}`,
      'Brand': '',
      'QR Code': '',
      'Price (£)': '',
      'Description': '',
      'Warehouse Stock': '',
      'Shop Floor Stock': '',
      'Total Stock': '',
      'Reserved Stock': '',
      'Available Stock': '',
      'Stock Value (£)': '',
      'Stock Level': '',
      'Stock Health': '',
      'Low Stock Threshold': '',
      'Low Stock Alert': '',
      'Out of Stock Alert': '',
      'Reorder Required': '',
      'Expiry Date': '',
      'Expiry Alert': '',
      'Created By': '',
      'Last Updated': ''
    });

    // Add empty row
    csvData.push({});

    // Process each category
    categoryStockSummary.forEach((catSummary, catIndex) => {
      // Category header
      csvData.push({
        'Category Name': `CATEGORY ${catIndex + 1}: ${catSummary.category.name.toUpperCase()}`,
        'Category Description': catSummary.category.description || 'No description available',
        'Product Name': `Products in Category: ${catSummary.products.length}`,
        'Brand': '',
        'QR Code': '',
        'Price (£)': '',
        'Description': '',
        'Warehouse Stock': '',
        'Shop Floor Stock': '',
        'Total Stock': '',
        'Reserved Stock': '',
        'Available Stock': '',
        'Stock Value (£)': formatCurrencyUK(catSummary.stockSummary.stockValue),
        'Stock Level': '',
        'Stock Health': '',
        'Low Stock Threshold': '',
        'Low Stock Alert': '',
        'Out of Stock Alert': '',
        'Reorder Required': '',
        'Expiry Date': '',
        'Expiry Alert': '',
        'Created By': '',
        'Last Updated': ''
      });

      // Add product details
      catSummary.products.forEach((product, index) => {
        csvData.push({
          'Category Name': index === 0 ? catSummary.category.name : '',
          'Category Description': index === 0 ? (catSummary.category.description || '') : '',
          'Product Name': product.productName || 'Unnamed Product',
          'Brand': product.brand || 'Unknown Brand',
          'QR Code': product.qrCode || 'Not Assigned',
          'Price (£)': formatCurrencyUK(product.price || 0),
          'Description': product.description || 'No description',
          'Warehouse Stock': product.stockDetails.godown.quantity || 0,
          'Shop Floor Stock': product.stockDetails.store.quantity || 0,
          'Total Stock': product.stockDetails.total || 0,
          'Reserved Stock': product.stockDetails.reserved || 0,
          'Available Stock': product.stockDetails.available || 0,
          'Stock Value (£)': formatCurrencyUK(product.stockDetails.stockValue || 0),
          'Stock Level': product.stockStatus.level || 'Unknown',
          'Stock Health': product.stockStatus.stockHealth || 'Unknown',
          'Low Stock Threshold': product.stockStatus.threshold || 0,
          'Low Stock Alert': product.stockStatus.isLowStock ? 'YES' : 'NO',
          'Out of Stock Alert': product.stockStatus.isOutOfStock ? 'YES' : 'NO',
          'Reorder Required': product.stockStatus.needsReorder ? 'YES' : 'NO',
          'Expiry Date': formatDateUK(product.expirationDate),
          'Expiry Alert': product.isExpiring ? 'YES' : 'NO',
          'Created By': product.createdBy || 'System',
          'Last Updated': formatDateUK(product.lastUpdated)
        });
      });
      
      // Add category summary row
      csvData.push({
        'Category Name': `${catSummary.category.name.toUpperCase()} - CATEGORY SUMMARY`,
        'Category Description': `Total Products: ${catSummary.stockSummary.totalProducts}`,
        'Product Name': 'CATEGORY TOTALS',
        'Brand': '',
        'QR Code': '',
        'Price (£)': '',
        'Description': `Low Stock: ${catSummary.stockSummary.alerts?.lowStock || 0} | Out of Stock: ${catSummary.stockSummary.alerts?.outOfStock || 0}`,
        'Warehouse Stock': catSummary.stockSummary.stockDistribution.godown.quantity || 0,
        'Shop Floor Stock': catSummary.stockSummary.stockDistribution.store.quantity || 0,
        'Total Stock': catSummary.stockSummary.stockDistribution.total || 0,
        'Reserved Stock': catSummary.stockSummary.stockDistribution.reserved || 0,
        'Available Stock': catSummary.stockSummary.stockDistribution.available || 0,
        'Stock Value (£)': formatCurrencyUK(catSummary.stockSummary.stockValue || 0),
        'Stock Level': 'CATEGORY TOTAL',
        'Stock Health': catSummary.stockSummary.alerts?.lowStock > 0 ? 'Attention Required' : 'Good',
        'Low Stock Threshold': '',
        'Low Stock Alert': `${catSummary.stockSummary.alerts?.lowStock || 0} Items`,
        'Out of Stock Alert': `${catSummary.stockSummary.alerts?.outOfStock || 0} Items`,
        'Reorder Required': '',
        'Expiry Date': '',
        'Expiry Alert': '',
        'Created By': '',
        'Last Updated': formatDateUK(new Date())
      });
      
      // Add separator
      csvData.push({});
    });
    
    // Add overall summary
    csvData.push({
      'Category Name': 'GRAND SUMMARY - ENTIRE STORE',
      'Category Description': `Total Categories: ${overallSummary.totalCategories}`,
      'Product Name': 'STORE TOTALS',
      'Brand': '',
      'QR Code': '',
      'Price (£)': '',
      'Description': `Total Products: ${overallSummary.totalProducts || 0}`,
      'Warehouse Stock': overallSummary.overallStock.godown || 0,
      'Shop Floor Stock': overallSummary.overallStock.store || 0,
      'Total Stock': overallSummary.overallStock.total || 0,
      'Reserved Stock': overallSummary.overallStock.reserved || 0,
      'Available Stock': (overallSummary.overallStock.total || 0) - (overallSummary.overallStock.reserved || 0),
      'Stock Value (£)': formatCurrencyUK(overallSummary.totalStockValue || 0),
      'Stock Level': 'STORE TOTAL',
      'Stock Health': (overallSummary.overallAlerts?.totalLowStock || 0) > 0 ? 'Attention Required' : 'Good',
      'Low Stock Threshold': '',
      'Low Stock Alert': `${overallSummary.overallAlerts?.totalLowStock || 0} Products`,
      'Out of Stock Alert': `${overallSummary.overallAlerts?.totalOutOfStock || 0} Products`,
      'Reorder Required': 'See Individual Products',
      'Expiry Date': '',
      'Expiry Alert': '',
      'Created By': 'System Generated',
      'Last Updated': formatDateUK(new Date())
    });

    const csv = new Parser().parse(csvData);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `stock_summary_${timestamp}.csv`;
    const filePath = path.join(exportsDir, filename);
    
    // Save to local file system
    fs.writeFileSync(filePath, '\uFEFF' + csv); // Add BOM for proper Excel UTF-8 handling
    console.log(`✅ CSV exported successfully: ${filePath}`);
    
    // Send response to client
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.send('\uFEFF' + csv);
    
  } catch (error) {
    console.error('❌ CSV Export Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to export CSV file', 
      error: error.message,
      timestamp: formatDateTimeUK(new Date())
    });
  }
}

/**
 * Export stock summary as Excel format (Enhanced JSON structure)
 * @param {Object} res - Express response object
 * @param {Array} categoryStockSummary - Category-wise stock data
 * @param {Object} overallSummary - Overall summary statistics
 */
function exportStockSummaryAsExcel(res, categoryStockSummary, overallSummary) {
  try {
    const excelData = {
      reportInfo: {
        title: 'Professional Stock Summary Report',
        subtitle: 'UK Store Management System',
        generatedAt: formatDateTimeUK(new Date()),
        generatedBy: 'Store Management System v2.0',
        format: 'Excel Compatible JSON',
        currency: 'GBP (£)',
        locale: 'en-GB'
      },
      overallSummary: {
        ...overallSummary,
        totalStockValueFormatted: formatCurrencyUK(overallSummary.totalStockValue || 0),
        summaryDate: formatDateUK(new Date()),
        stockDistribution: {
          warehouse: {
            quantity: overallSummary.overallStock?.godown || 0,
            percentage: overallSummary.overallStock?.godownPercentage || 0
          },
          shopFloor: {
            quantity: overallSummary.overallStock?.store || 0,
            percentage: overallSummary.overallStock?.storePercentage || 0
          },
          total: overallSummary.overallStock?.total || 0,
          reserved: overallSummary.overallStock?.reserved || 0,
          available: (overallSummary.overallStock?.total || 0) - (overallSummary.overallStock?.reserved || 0)
        }
      },
      categoryBreakdown: categoryStockSummary.map(catSummary => ({
        category: {
          ...catSummary.category,
          productCount: catSummary.products.length
        },
        stockSummary: {
          ...catSummary.stockSummary,
          stockValueFormatted: formatCurrencyUK(catSummary.stockSummary.stockValue || 0),
          stockDistribution: {
            warehouse: catSummary.stockSummary.stockDistribution?.godown?.quantity || 0,
            shopFloor: catSummary.stockSummary.stockDistribution?.store?.quantity || 0,
            total: catSummary.stockSummary.stockDistribution?.total || 0,
            reserved: catSummary.stockSummary.stockDistribution?.reserved || 0,
            available: catSummary.stockSummary.stockDistribution?.available || 0
          }
        },
        products: catSummary.products.map(product => ({
          ...product,
          priceFormatted: formatCurrencyUK(product.price || 0),
          stockValueFormatted: formatCurrencyUK(product.stockDetails?.stockValue || 0),
          expirationDateFormatted: formatDateUK(product.expirationDate),
          lastUpdatedFormatted: formatDateUK(product.lastUpdated),
          alerts: {
            isLowStock: product.stockStatus?.isLowStock || false,
            isOutOfStock: product.stockStatus?.isOutOfStock || false,
            needsReorder: product.stockStatus?.needsReorder || false,
            isExpiring: product.isExpiring || false
          },
          stockDetails: {
            warehouse: product.stockDetails?.godown?.quantity || 0,
            shopFloor: product.stockDetails?.store?.quantity || 0,
            total: product.stockDetails?.total || 0,
            reserved: product.stockDetails?.reserved || 0,
            available: product.stockDetails?.available || 0,
            stockValue: product.stockDetails?.stockValue || 0
          }
        }))
      })),
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedAtUK: formatDateTimeUK(new Date()),
        format: 'Enhanced Excel JSON',
        description: 'Professional Stock Summary Report - Excel Compatible Format',
        version: '2.0.0',
        locale: 'en-GB',
        currency: 'GBP',
        totalRecords: categoryStockSummary.reduce((acc, cat) => acc + cat.products.length, 0)
      }
    };
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `stock_summary_excel_${timestamp}.json`;
    const filePath = path.join(exportsDir, filename);
    
    // Save to local file system
    fs.writeFileSync(filePath, JSON.stringify(excelData, null, 2));
    console.log(`✅ Excel JSON exported successfully: ${filePath}`);
    
    // Send response to client
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.json(excelData);
    
  } catch (error) {
    console.error('❌ Excel Export Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to export Excel file', 
      error: error.message,
      timestamp: formatDateTimeUK(new Date())
    });
  }
}

/**
 * Export stock summary as professional PDF with UK formatting
 * @param {Object} res - Express response object
 * @param {Array} categoryStockSummary - Category-wise stock data
 * @param {Object} overallSummary - Overall summary statistics
 */
function exportStockSummaryAsPDF(res, categoryStockSummary, overallSummary) {
  try {
    const doc = new PDFDocument({ 
      margin: 50, // Increased margin from 40 to 50
      size: 'A4',
      info: {
        Title: 'Stock Summary Report',
        Author: 'UK Store Management System',
        Subject: 'Professional Inventory Report',
        Keywords: 'stock, inventory, report, UK, professional'
      }
    });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `stock_summary_${timestamp}.pdf`;
    const filePath = path.join(exportsDir, filename);
    
    // Save to local file system first
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    
    // Also send response to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    doc.pipe(res);

    // Get shop information for header
    let shopName = 'UK Store Management System';
    if (categoryStockSummary.length > 0 && categoryStockSummary[0].category?.shopName) {
      shopName = categoryStockSummary[0].category.shopName;
    }

    // Helper function to add header to each page
    function addHeader() {
      doc.fillColor('#1e3a8a').fontSize(24).font('Helvetica-Bold');
      doc.text('STOCK SUMMARY REPORT', 50, 50, { align: 'center' });
      
      doc.fillColor('#3b82f6').fontSize(16).font('Helvetica');
      doc.text(shopName, 50, 85, { align: 'center' });
      
      doc.fillColor('#6b7280').fontSize(12).font('Helvetica');
      doc.text(`Generated: ${formatDateTimeUK(new Date())} | Currency: GBP (£)`, 50, 110, { align: 'center' });
      
      // Add company line
      doc.strokeColor('#e5e7eb').lineWidth(2);
      doc.moveTo(50, 135).lineTo(545, 135).stroke();
      
      doc.fillColor('black');
      doc.y = 150;
    }

    // Add initial header
    addHeader();

    // Executive Summary Section
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e40af');
    doc.text('EXECUTIVE SUMMARY', 50, doc.y);
    doc.moveDown(0.5);

    // Professional summary table with proper margins
    const summaryTableY = doc.y;
    const summaryColWidths = [200, 110, 110, 110]; // Adjusted for 50px margins
    const summaryHeaders = ['Key Metrics', 'Quantity', 'Value (£)', 'Percentage'];
    
    // Draw professional table header
    doc.fontSize(12).font('Helvetica-Bold').fillColor('white');
    let currentX = 50;
    summaryHeaders.forEach((header, i) => {
      doc.rect(currentX, summaryTableY, summaryColWidths[i], 30).fill('#1e40af').stroke('#1e40af');
      doc.text(header, currentX + 10, summaryTableY + 10, { width: summaryColWidths[i] - 20 });
      currentX += summaryColWidths[i];
    });

    // Summary data with professional formatting
    const summaryData = [
      ['Total Categories', (overallSummary.totalCategories || 0).toString(), '-', '100%'],
      ['Total Products', (overallSummary.totalProducts || 0).toString(), '-', '100%'],
      ['Total Stock Value', '-', formatCurrencyUK(overallSummary.totalStockValue || 0), '100%'],
      ['Total Stock Units', (overallSummary.overallStock?.total || 0).toString(), '-', '100%'],
      ['Warehouse Stock', (overallSummary.overallStock?.godown || 0).toString(), '-', `${overallSummary.overallStock?.godownPercentage || 0}%`],
      ['Shop Floor Stock', (overallSummary.overallStock?.store || 0).toString(), '-', `${overallSummary.overallStock?.storePercentage || 0}%`],
      ['Reserved Stock', (overallSummary.overallStock?.reserved || 0).toString(), '-', `${(((overallSummary.overallStock?.reserved || 0) / (overallSummary.overallStock?.total || 1)) * 100).toFixed(1)}%`],
      ['Low Stock Alerts', (overallSummary.overallAlerts?.totalLowStock || 0).toString(), '-', 'Alert Level'],
      ['Out of Stock Items', (overallSummary.overallAlerts?.totalOutOfStock || 0).toString(), '-', 'Critical']
    ];

    doc.fontSize(11).font('Helvetica').fillColor('black');
    summaryData.forEach((row, rowIndex) => {
      const rowY = summaryTableY + 30 + (rowIndex * 25);
      currentX = 50;
      
      // Alternate row colours for better readability
      const fillColor = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(50, rowY, 530, 25).fill(fillColor); // Adjusted width for margins
      
      row.forEach((cell, colIndex) => {
        doc.rect(currentX, rowY, summaryColWidths[colIndex], 25).stroke('#e2e8f0');
        
        // Highlight critical values
        const textColor = (cell.includes('Critical') || cell.includes('Alert')) ? '#dc2626' : '#1f2937';
        doc.fillColor(textColor);
        
        doc.text(cell, currentX + 8, rowY + 8, { 
          width: summaryColWidths[colIndex] - 16,
          align: colIndex === 0 ? 'left' : 'center'
        });
        currentX += summaryColWidths[colIndex];
      });
    });

    doc.fillColor('black');
    doc.y = summaryTableY + 30 + (summaryData.length * 25) + 30;

    // Add detailed category analysis with proper pagination
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1f2937');
    doc.text('📊 DETAILED CATEGORY ANALYSIS', 50, doc.y);
    doc.moveDown(1);

    categoryStockSummary.forEach((category, categoryIndex) => {
      // Check if we need a new page (more conservative page break)
      if (doc.y > 650) {
        doc.addPage();
        addHeader();
      }

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#3b82f6');
      doc.text(`${categoryIndex + 1}. ${category.category.name}`, 50, doc.y);
      doc.moveDown(0.5);

      // Category summary in a professional box
      const categoryBoxY = doc.y;
      doc.rect(50, categoryBoxY, 530, 80).fill('#f1f5f9').stroke('#cbd5e1'); // Adjusted for margins
      
      doc.fontSize(10).font('Helvetica').fillColor('#334155');
      doc.text(`Products: ${category.stockSummary.totalProducts} | Total Value: ${formatCurrencyUK(category.stockSummary.stockValue)}`, 60, categoryBoxY + 10);
      doc.text(`Stock Units: ${category.stockSummary.stockDistribution.total} | Low Stock: ${category.stockSummary.alerts.lowStock}`, 60, categoryBoxY + 25);
      doc.text(`Warehouse: ${category.stockSummary.stockDistribution.godown.quantity} | Store: ${category.stockSummary.stockDistribution.store.quantity}`, 60, categoryBoxY + 40);
      if (category.category.description) {
        doc.text(`Description: ${category.category.description}`, 60, categoryBoxY + 55);
      }

      doc.y = categoryBoxY + 90;

      // Products table for this category with pagination
      if (category.products && category.products.length > 0) {
        const colWidths = [180, 70, 70, 70, 70, 75]; // Adjusted for margins
        const headers = ['Product Name', 'Warehouse', 'Store', 'Total', 'Price (£)', 'Status'];
        
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1f2937');
        doc.text('Products in this category:', 50, doc.y);
        doc.moveDown(0.5);

        // Calculate how many products can fit per page
        const productRowHeight = 25;
        const maxProductsPerPage = Math.floor((750 - doc.y) / productRowHeight) - 2; // Reserve space for header and total

        // Show first 5 products, then summarize the rest
        const productsToShow = category.products.slice(0, 5);
        const remainingProducts = category.products.slice(5);

        const tableY = doc.y;
        
        // Table header
        doc.fontSize(10).font('Helvetica-Bold').fillColor('white');
        currentX = 50;
        headers.forEach((header, i) => {
          doc.rect(currentX, tableY, colWidths[i], 25).fill('#1e40af').stroke('#1e40af');
          doc.text(header, currentX + 5, tableY + 8, { width: colWidths[i] - 10 });
          currentX += colWidths[i];
        });

        // Show first 5 products
        doc.fontSize(9).font('Helvetica').fillColor('black');
        productsToShow.forEach((product, productIndex) => {
          const rowY = tableY + 25 + (productIndex * 20);
          currentX = 50;
          
          // Alternate row colors
          const fillColor = productIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(50, rowY, 535, 20).fill(fillColor); // Adjusted width

          const rowData = [
            product.productName.length > 25 ? product.productName.substring(0, 22) + '...' : product.productName,
            (product.stockDetails.godown.quantity || 0).toString(),
            (product.stockDetails.store.quantity || 0).toString(),
            (product.stockDetails.total || 0).toString(),
            formatCurrencyUK(product.price || 0).replace('£', ''),
            product.stockStatus.level === 'LOW_STOCK' ? '🔻 Low' : 
            product.stockStatus.level === 'OUT_OF_STOCK' ? '❌ Out' : '✅ OK'
          ];

          rowData.forEach((data, i) => {
            doc.rect(currentX, rowY, colWidths[i], 20).stroke('#e2e8f0');
            
            // Color code the status column
            if (i === 5) {
              const color = data.includes('Low') ? '#f59e0b' : data.includes('Out') ? '#dc2626' : '#059669';
              doc.fillColor(color);
            } else {
              doc.fillColor('#1f2937');
            }
            
            doc.text(data, currentX + 3, rowY + 6, { width: colWidths[i] - 6 });
            currentX += colWidths[i];
          });
        });

        let nextRowY = tableY + 25 + (productsToShow.length * 20);

        // Show summary for remaining products if any
        if (remainingProducts.length > 0) {
          doc.fontSize(9).font('Helvetica-Oblique').fillColor('#6b7280');
          doc.rect(50, nextRowY, 535, 20).fill('#f9fafb').stroke('#e2e8f0');
          doc.text(`... and ${remainingProducts.length} more products (total: ${category.products.length} products)`, 55, nextRowY + 6);
          nextRowY += 20;
        }

        // Category total row
        const totalRowY = nextRowY;
        const totalData = [
          'CATEGORY TOTAL:',
          category.stockSummary.stockDistribution.godown.quantity.toString(),
          category.stockSummary.stockDistribution.store.quantity.toString(),
          category.stockSummary.stockDistribution.total.toString(),
          formatCurrencyUK(category.stockSummary.stockValue).replace('£', ''),
          `${category.stockSummary.alerts.lowStock} Low`
        ];

        doc.fontSize(10).font('Helvetica-Bold').fillColor('white');
        currentX = 50;
        totalData.forEach((data, i) => {
          doc.rect(currentX, totalRowY, colWidths[i], 25).fill('#1e40af').stroke('#1e40af');
          doc.text(data, currentX + 5, totalRowY + 8, { width: colWidths[i] - 10 });
          currentX += colWidths[i];
        });
        
        doc.fillColor('black');
        doc.y = totalRowY + 35;
      }
      
      doc.moveDown(1);
    });

    // Professional footer with proper margins
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280');
    const footerY = doc.page.height - 80; // Increased footer margin
    doc.text(`Report Generated: ${formatDateTimeUK(new Date())} | ${shopName} | UK Store Management System v2.0`, 50, footerY);
    doc.text('This report contains confidential business information', 50, footerY + 15);
    
    // Add page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(9).fillColor('#9ca3af');
      doc.text(`Page ${i + 1} of ${pageCount}`, 450, doc.page.height - 60, { align: 'right' });
    }

    doc.end();

    // Log successful export after stream closes
    writeStream.on('finish', () => {
      console.log(`✅ PDF exported successfully: ${filePath}`);
    });

    writeStream.on('error', (error) => {
      console.error(`❌ Error saving PDF to filesystem: ${error.message}`);
    });

  } catch (error) {
    console.error('❌ PDF Export Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to export PDF file', 
      error: error.message,
      timestamp: formatDateTimeUK(new Date())
    });
  }
}

module.exports = router;
