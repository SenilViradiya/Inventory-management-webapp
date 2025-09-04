const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requirePermission } = require('../middleware/auth');

     
      
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

// Helper function to export stock summary as CSV
function exportStockSummaryAsCSV(res, categoryStockSummary, overallSummary) {
  try {
    // Flatten data for CSV export
    const csvData = [];
    
    categoryStockSummary.forEach(catSummary => {
      catSummary.products.forEach((product, index) => {
        csvData.push({
          'Category Name': index === 0 ? catSummary.category.name : '', // Only show category name on first product
          'Category Description': index === 0 ? catSummary.category.description : '',
          'Product Name': product.productName,
          'Brand': product.brand,
          'QR Code': product.qrCode,
          'Price': product.price,
          'Description': product.description,
          'Godown Stock': product.stockDetails.godown.quantity,
          'Store Stock': product.stockDetails.store.quantity,
          'Total Stock': product.stockDetails.total,
          'Reserved Stock': product.stockDetails.reserved,
          'Available Stock': product.stockDetails.available,
          'Stock Value': product.stockDetails.stockValue,
          'Stock Level': product.stockStatus.level,
          'Stock Health': product.stockStatus.stockHealth,
          'Low Stock Threshold': product.stockStatus.threshold,
          'Is Low Stock': product.stockStatus.isLowStock ? 'Yes' : 'No',
          'Is Out of Stock': product.stockStatus.isOutOfStock ? 'Yes' : 'No',
          'Needs Reorder': product.stockStatus.needsReorder ? 'Yes' : 'No',
          'Expiration Date': product.expirationDate ? new Date(product.expirationDate).toLocaleDateString() : '',
          'Is Expiring': product.isExpiring ? 'Yes' : 'No',
          'Created By': product.createdBy,
          'Last Updated': product.lastUpdated ? new Date(product.lastUpdated).toLocaleDateString() : ''
        });
      });
      
      // Add category summary row
      csvData.push({
        'Category Name': `${catSummary.category.name} - SUMMARY`,
        'Category Description': `Total Products: ${catSummary.stockSummary.totalProducts}`,
        'Product Name': 'CATEGORY TOTALS',
        'Brand': '',
        'QR Code': '',
        'Price': '',
        'Description': '',
        'Godown Stock': catSummary.stockSummary.stockDistribution.godown.quantity,
        'Store Stock': catSummary.stockSummary.stockDistribution.store.quantity,
        'Total Stock': catSummary.stockSummary.stockDistribution.total,
        'Reserved Stock': catSummary.stockSummary.stockDistribution.reserved,
        'Available Stock': catSummary.stockSummary.stockDistribution.available,
        'Stock Value': catSummary.stockSummary.stockValue,
        'Stock Level': '',
        'Stock Health': '',
        'Low Stock Threshold': '',
        'Is Low Stock': '',
        'Is Out of Stock': '',
        'Needs Reorder': '',
        'Expiration Date': '',
        'Is Expiring': '',
        'Created By': '',
        'Last Updated': ''
      });
      
      // Add empty row between categories
      csvData.push({});
    });
    
    // Add overall summary
    csvData.push({
      'Category Name': 'OVERALL SUMMARY',
      'Category Description': `Total Categories: ${overallSummary.totalCategories}`,
      'Product Name': 'GRAND TOTALS',
      'Brand': '',
      'QR Code': '',
      'Price': '',
      'Description': '',
      'Godown Stock': overallSummary.overallStock.godown,
      'Store Stock': overallSummary.overallStock.store,
      'Total Stock': overallSummary.overallStock.total,
      'Reserved Stock': overallSummary.overallStock.reserved,
      'Available Stock': overallSummary.overallStock.total - overallSummary.overallStock.reserved,
      'Stock Value': overallSummary.totalStockValue,
      'Stock Level': '',
      'Stock Health': '',
      'Low Stock Threshold': '',
      'Is Low Stock': `${overallSummary.overallAlerts.totalLowStock} products`,
      'Is Out of Stock': `${overallSummary.overallAlerts.totalOutOfStock} products`,
      'Needs Reorder': '',
      'Expiration Date': '',
      'Is Expiring': '',
      'Created By': '',
      'Last Updated': new Date().toLocaleDateString()
    });

    const csv = new Parser().parse(csvData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stock_summary.csv"');
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return res.status(500).json({ success: false, message: 'Error exporting CSV', error: error.message });
  }
}

// Helper function to export stock summary as Excel (JSON format for Excel readers)
function exportStockSummaryAsExcel(res, categoryStockSummary, overallSummary) {
  try {
    const excelData = {
      summary: overallSummary,
      categories: categoryStockSummary,
      metadata: {
        exportedAt: new Date().toISOString(),
        format: 'excel',
        description: 'Stock Summary Report - Excel Format'
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="stock_summary.json"');
    return res.json(excelData);
  } catch (error) {
    console.error('Error exporting Excel:', error);
    return res.status(500).json({ success: false, message: 'Error exporting Excel', error: error.message });
  }
}

// Helper function to export stock summary as PDF
function exportStockSummaryAsPDF(res, categoryStockSummary, overallSummary) {
  try {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="stock_summary_${new Date().toISOString().split('T')[0]}.pdf"`);
    
    doc.pipe(res);

    // Title
    doc.fontSize(18).font('Helvetica-Bold');
    doc.text('Stock Summary Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Overall Summary Table
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('Overall Summary', 30, doc.y);
    doc.moveDown(0.5);

    // Summary table with proper borders
    const summaryTableY = doc.y;
    const summaryColWidths = [200, 120, 120, 120];
    const summaryHeaders = ['Metric', 'Count/Stock', 'Value', 'Percentage'];
    
    // Draw table header
    doc.fontSize(11).font('Helvetica-Bold');
    let currentX = 30;
    summaryHeaders.forEach((header, i) => {
      doc.rect(currentX, summaryTableY, summaryColWidths[i], 25).stroke();
      doc.fillColor('#f0f0f0').rect(currentX, summaryTableY, summaryColWidths[i], 25).fill();
      doc.fillColor('black');
      doc.text(header, currentX + 8, summaryTableY + 8, { width: summaryColWidths[i] - 16 });
      currentX += summaryColWidths[i];
    });

    // Summary table data
    const summaryData = [
      ['Total Categories', overallSummary.totalCategories.toString(), '-', '-'],
      ['Total Products', overallSummary.totalProducts.toString(), '-', '-'],
      ['Total Stock Value', '-', `$${overallSummary.totalStockValue.toFixed(2)}`, '-'],
      ['Total Stock Units', overallSummary.overallStock.total.toString(), '-', '100%'],
      ['Godown Stock', overallSummary.overallStock.godown.toString(), '-', `${overallSummary.overallStock.godownPercentage || 0}%`],
      ['Store Stock', overallSummary.overallStock.store.toString(), '-', `${overallSummary.overallStock.storePercentage || 0}%`],
      ['Reserved Stock', overallSummary.overallStock.reserved.toString(), '-', '-'],
      ['Low Stock Items', overallSummary.overallAlerts.totalLowStock.toString(), '-', '-'],
      ['Out of Stock Items', overallSummary.overallAlerts.totalOutOfStock.toString(), '-', '-']
    ];

    doc.fontSize(10).font('Helvetica');
    summaryData.forEach((row, rowIndex) => {
      const rowY = summaryTableY + 25 + (rowIndex * 22);
      currentX = 30;
      
      row.forEach((cell, colIndex) => {
        doc.rect(currentX, rowY, summaryColWidths[colIndex], 22).stroke();
        doc.text(cell.toString(), currentX + 8, rowY + 6, { width: summaryColWidths[colIndex] - 16 });
        currentX += summaryColWidths[colIndex];
      });
    });

    doc.y = summaryTableY + 25 + (summaryData.length * 22) + 30;

    // Category Details
    categoryStockSummary.forEach((catSummary, catIndex) => {
      if (catIndex > 0 || doc.y > 600) {
        doc.addPage();
        doc.y = 50;
      }

      // Category Header
      doc.fontSize(16).font('Helvetica-Bold');
      doc.fillColor('#2563eb');
      doc.text(`Category: ${catSummary.category.name}`, 30, doc.y);
      doc.fillColor('black');
      doc.moveDown(0.3);
      
      doc.fontSize(11).font('Helvetica');
      doc.text(`Products: ${catSummary.stockSummary.totalProducts} | Total Stock: ${catSummary.stockSummary.stockDistribution.total} | Value: $${catSummary.stockSummary.stockValue.toFixed(2)}`, 30, doc.y);
      doc.moveDown(0.7);

      if (catSummary.products.length > 0) {
        // Products Table Header (removed Brand column, increased Product Name width)
        const tableTop = doc.y;
        const colWidths = [280, 70, 70, 70, 80, 90];
        const headers = ['Product Name', 'Godown', 'Store', 'Total', 'Price', 'Status'];
        
        doc.fontSize(11).font('Helvetica-Bold');
        currentX = 30;
        headers.forEach((header, i) => {
          doc.rect(currentX, tableTop, colWidths[i], 25).stroke();
          doc.fillColor('#f8f9fa').rect(currentX, tableTop, colWidths[i], 25).fill();
          doc.fillColor('black');
          doc.text(header, currentX + 5, tableTop + 8, { width: colWidths[i] - 10 });
          currentX += colWidths[i];
        });

        // Products Data
        doc.fontSize(10).font('Helvetica');
        catSummary.products.forEach((product, prodIndex) => {
          const rowY = tableTop + 25 + (prodIndex * 35); // Increased row height for two-line text
          
          if (rowY > 720) {
            doc.addPage();
            doc.y = 50;
            return;
          }

          currentX = 30;
          
          // Product name with two-line support
          const productName = product.productName;
          const maxLineLength = 40; // Approximate characters per line
          let displayName = productName;
          let secondLine = '';
          
          if (productName.length > maxLineLength) {
            // Try to break at a word boundary
            const words = productName.split(' ');
            let firstLine = '';
            let remainingWords = [];
            
            for (let i = 0; i < words.length; i++) {
              if ((firstLine + words[i]).length <= maxLineLength) {
                firstLine += (firstLine ? ' ' : '') + words[i];
              } else {
                remainingWords = words.slice(i);
                break;
              }
            }
            
            displayName = firstLine;
            secondLine = remainingWords.join(' ');
            if (secondLine.length > maxLineLength) {
              secondLine = secondLine.substring(0, maxLineLength - 3) + '...';
            }
          }

          const rowData = [
            displayName,
            product.stockDetails.godown.quantity.toString(),
            product.stockDetails.store.quantity.toString(),
            product.stockDetails.total.toString(),
            `$${product.price.toFixed(2)}`,
            product.stockStatus.level
          ];

          rowData.forEach((data, i) => {
            doc.rect(currentX, rowY, colWidths[i], 35).stroke();
            if (i === 0) {
              // Product name column - handle two lines
              doc.text(data, currentX + 5, rowY + 5, { width: colWidths[i] - 10 });
              if (secondLine) {
                doc.text(secondLine, currentX + 5, rowY + 18, { width: colWidths[i] - 10 });
              }
            } else {
              // Other columns - center vertically
              doc.text(data, currentX + 5, rowY + 12, { width: colWidths[i] - 10 });
            }
            currentX += colWidths[i];
          });
        });

        // Category totals row
        const totalRowY = tableTop + 25 + (catSummary.products.length * 35);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e40af');
        currentX = 30;
        
        const totalData = [
          'CATEGORY TOTAL:',
          catSummary.stockSummary.stockDistribution.godown.quantity.toString(),
          catSummary.stockSummary.stockDistribution.store.quantity.toString(),
          catSummary.stockSummary.stockDistribution.total.toString(),
          `$${catSummary.stockSummary.stockValue.toFixed(2)}`,
          `${catSummary.stockSummary.alerts.lowStock} Low | ${catSummary.stockSummary.alerts.outOfStock} Out`
        ];

        totalData.forEach((data, i) => {
          doc.rect(currentX, totalRowY, colWidths[i], 25).stroke();
          doc.fillColor('#e0f2fe').rect(currentX, totalRowY, colWidths[i], 25).fill();
          doc.fillColor('#1e40af');
          doc.text(data, currentX + 5, totalRowY + 8, { width: colWidths[i] - 10 });
          currentX += colWidths[i];
        });
        
        doc.fillColor('black');
        doc.y = totalRowY + 35;
      }
      
      doc.moveDown(1);
    });

    // Footer
    doc.fontSize(8).font('Helvetica');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 30, doc.page.height - 50);

    doc.end();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    return res.status(500).json({ success: false, message: 'Error exporting PDF', error: error.message });
  }
}

module.exports = router;
