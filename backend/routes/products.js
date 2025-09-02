const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const Category = require('../models/Category');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { uploadSingleToAzure, deleteFromAzure } = require('../middleware/upload');
const multer = require('multer');
const path = require('path');
const axios = require('axios'); // For OpenFoodFacts API calls

// Legacy multer configuration for fallback
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

// Validation rules (updated for new stock structure)
const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').optional().isMongoId().withMessage('Valid category ID required'),
  body('expirationDate').isISO8601().withMessage('Valid expiration date is required'),
  // Updated to support new stock structure
  body('stock.godown').optional().isInt({ min: 0 }).withMessage('Godown stock must be non-negative'),
  body('stock.store').optional().isInt({ min: 0 }).withMessage('Store stock must be non-negative'),
  // Keep legacy quantity support for backward compatibility
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('qrCode').trim().notEmpty().withMessage('QR code is required'),
  body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be non-negative'),
  body('shopId').isMongoId().withMessage('Valid shop ID is required')
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

// POST /api/products/scan - Enhanced QR code scanning endpoint for mobile integration
router.post('/scan', authenticateToken, [
  body('qrCode').trim().notEmpty().withMessage('QR code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { qrCode } = req.body;
    
    // Find product by QR code with additional details
    const product = await Product.findOne({ qrCode })
      .populate('createdBy', 'username fullName')
      .populate('categoryId', 'name description');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found with this QR code',
        qrCode
      });
    }

    // Calculate stock status
    const stockStatus = {
      isLowStock: product.stock.total <= product.lowStockThreshold,
      isOutOfStock: product.stock.total === 0,
      hasGodownStock: product.stock.godown > 0,
      hasStoreStock: product.stock.store > 0
    };

    // Calculate days until expiration
    const daysUntilExpiration = product.expirationDate 
      ? Math.ceil((new Date(product.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    // Enhanced response for mobile apps
    const response = {
      success: true,
      message: 'Product found successfully',
      data: {
        // Basic product info
        id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        qrCode: product.qrCode,
        imageUrl: product.imageUrl,
        
        // Stock information
        stock: {
          godown: product.stock.godown,
          store: product.stock.store,
          total: product.stock.total,
          reserved: product.stock.reserved,
          lowStockThreshold: product.lowStockThreshold
        },
        
        // Stock status indicators
        stockStatus,
        
        // Category information
        category: {
          id: product.categoryId?._id,
          name: product.categoryName,
          details: product.categoryId
        },
        
        // Expiration information
        expiration: {
          date: product.expirationDate,
          daysUntilExpiration,
          isExpired: daysUntilExpiration !== null && daysUntilExpiration <= 0,
          isExpiringSoon: daysUntilExpiration !== null && daysUntilExpiration <= 7 && daysUntilExpiration > 0
        },
        
        // Created by information
        createdBy: product.createdBy,
        
        // Timestamps
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      },
      
      // Quick actions available for this product
      availableActions: {
        canMoveToStore: product.stock.godown > 0,
        canMoveToGodown: product.stock.store > 0,
        canProcessSale: product.stock.store > 0,
        canAddStock: true,
        needsRestocking: stockStatus.isLowStock || stockStatus.isOutOfStock
      },
      
      // Scan metadata
      scanInfo: {
        scannedAt: new Date().toISOString(),
        scannedBy: req.user.id,
        scannedQrCode: qrCode
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('QR scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scanning QR code',
      error: error.message
    });
  }
});

// GET /api/products/scan/:qrCode - Alternative GET endpoint for QR scanning (for URL-based scanning)
router.get('/scan/:qrCode', authenticateToken, async (req, res) => {
  try {
    const qrCode = req.params.qrCode;
    
    // Reuse the same logic as POST /scan
    const product = await Product.findOne({ qrCode })
      .populate('createdBy', 'username fullName')
      .populate('categoryId', 'name description');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found with this QR code',
        qrCode
      });
    }

    // Calculate stock status
    const stockStatus = {
      isLowStock: product.stock.total <= product.lowStockThreshold,
      isOutOfStock: product.stock.total === 0,
      hasGodownStock: product.stock.godown > 0,
      hasStoreStock: product.stock.store > 0
    };

    // Calculate days until expiration
    const daysUntilExpiration = product.expirationDate 
      ? Math.ceil((new Date(product.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    // Enhanced response
    const response = {
      success: true,
      message: 'Product found successfully',
      data: {
        id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        qrCode: product.qrCode,
        imageUrl: product.imageUrl,
        stock: {
          godown: product.stock.godown,
          store: product.stock.store,
          total: product.stock.total,
          reserved: product.stock.reserved,
          lowStockThreshold: product.lowStockThreshold
        },
        stockStatus,
        category: {
          id: product.categoryId?._id,
          name: product.categoryName,
          details: product.categoryId
        },
        expiration: {
          date: product.expirationDate,
          daysUntilExpiration,
          isExpired: daysUntilExpiration !== null && daysUntilExpiration <= 0,
          isExpiringSoon: daysUntilExpiration !== null && daysUntilExpiration <= 7 && daysUntilExpiration > 0
        },
        createdBy: product.createdBy,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      },
      availableActions: {
        canMoveToStore: product.stock.godown > 0,
        canMoveToGodown: product.stock.store > 0,
        canProcessSale: product.stock.store > 0,
        canAddStock: true,
        needsRestocking: stockStatus.isLowStock || stockStatus.isOutOfStock
      },
      scanInfo: {
        scannedAt: new Date().toISOString(),
        scannedBy: req.user.id,
        scannedQrCode: qrCode
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('QR scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scanning QR code',
      error: error.message
    });
  }
});

// POST /api/products/scan-openfoodfacts - Scan product using OpenFoodFacts database
router.post('/scan-openfoodfacts', authenticateToken, [
  body('barcode').trim().notEmpty().withMessage('Barcode is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { barcode } = req.body;
    
    console.log(`🔍 Scanning barcode: ${barcode} using OpenFoodFacts API`);

    try {
      // Direct API call to OpenFoodFacts
      const response = await axios.get(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'InventoryApp/1.0 (contact@yourapp.com)'
        }
      });

      if (!response.data || response.data.status === 0) {
        return res.status(404).json({
          success: false,
          message: 'Product not found in OpenFoodFacts database',
          barcode,
          suggestion: 'This product might not be in the OpenFoodFacts database. You can add it manually to your inventory.'
        });
      }

      const product = response.data.product;
      
      // Extract and format the product information
      const formattedProduct = {
        success: true,
        message: 'Product found in OpenFoodFacts database',
        source: 'OpenFoodFacts',
        data: {
          // Basic product information
          barcode: product.code || barcode,
          name: product.product_name || product.generic_name || 'Unknown Product',
          brand: product.brands || 'Unknown Brand',
          description: product.generic_name || product.product_name || '',
          
          // Images
          images: {
            front: product.image_front_url || product.image_url || null,
            nutrition: product.image_nutrition_url || null,
            ingredients: product.image_ingredients_url || null,
            packaging: product.image_packaging_url || null
          },
          
          // Nutritional information (per 100g)
          nutrition: {
            energy_kj: product.nutriments?.['energy-kj_100g'] || null,
            energy_kcal: product.nutriments?.['energy-kcal_100g'] || null,
            fat: product.nutriments?.['fat_100g'] || null,
            saturated_fat: product.nutriments?.['saturated-fat_100g'] || null,
            carbohydrates: product.nutriments?.['carbohydrates_100g'] || null,
            sugars: product.nutriments?.['sugars_100g'] || null,
            fiber: product.nutriments?.['fiber_100g'] || null,
            proteins: product.nutriments?.['proteins_100g'] || null,
            salt: product.nutriments?.['salt_100g'] || null,
            sodium: product.nutriments?.['sodium_100g'] || null
          },
          
          // Categories and tags
          categories: product.categories_tags || [],
          labels: product.labels_tags || [],
          allergens: product.allergens_tags || [],
          
          // Packaging and quantity
          packaging: product.packaging || 'Unknown',
          quantity: product.quantity || null,
          serving_size: product.serving_size || null,
          
          // Quality scores
          quality: {
            nutriscore: product.nutriscore_grade || null,
            ecoscore: product.ecoscore_grade || null,
            nova_group: product.nova_group || null
          },
          
          // Additional information
          ingredients_text: product.ingredients_text || null,
          origins: product.origins || null,
          manufacturing_places: product.manufacturing_places || null,
          stores: product.stores || null,
          countries: product.countries_tags || [],
          
          // Timestamps from OpenFoodFacts
          created_t: product.created_t ? new Date(product.created_t * 1000) : null,
          last_modified_t: product.last_modified_t ? new Date(product.last_modified_t * 1000) : null
        },
        
        // Suggestions for your inventory
        inventoryMapping: {
          suggestedName: product.product_name || product.generic_name || 'Unknown Product',
          suggestedBrand: product.brands || 'Unknown Brand',
          suggestedDescription: product.generic_name || product.ingredients_text?.substring(0, 200) || '',
          suggestedPrice: null, // Price not available in OpenFoodFacts
          suggestedCategory: extractMainCategory(product.categories_tags || []),
          suggestedImageUrl: product.image_front_url || product.image_url || null,
          qrCode: barcode,
          
          // Suggested initial stock (you can customize this)
          suggestedStock: {
            godown: 0,
            store: 0,
            total: 0,
            lowStockThreshold: 5
          }
        },
        
        // OpenFoodFacts metadata
        openFoodFactsInfo: {
          url: `https://world.openfoodfacts.org/product/${barcode}`,
          lastUpdated: product.last_modified_t ? new Date(product.last_modified_t * 1000).toISOString() : null,
          completeness: product.completeness || 0,
          dataQuality: product.data_quality_tags || []
        },
        
        // Scan metadata
        scanInfo: {
          scannedAt: new Date().toISOString(),
          scannedBy: req.user.id,
          scannedBarcode: barcode,
          apiVersion: 'OpenFoodFacts v2'
        }
      };

      res.status(200).json(formattedProduct);

    } catch (apiError) {
      console.error('OpenFoodFacts API error:', apiError.message);
      
      if (apiError.code === 'ECONNABORTED') {
        return res.status(503).json({
          success: false,
          message: 'OpenFoodFacts API timeout',
          error: 'The request took too long to complete',
          barcode,
          suggestion: 'Please try again or check your internet connection.'
        });
      }
      
      return res.status(503).json({
        success: false,
        message: 'Failed to connect to OpenFoodFacts database',
        error: apiError.message,
        barcode,
        suggestion: 'Please check your internet connection or try again later.'
      });
    }

  } catch (error) {
    console.error('OpenFoodFacts scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scanning barcode with OpenFoodFacts',
      error: error.message
    });
  }
});

// Helper function to extract main category from OpenFoodFacts categories
function extractMainCategory(categoriesTags) {
  if (!categoriesTags || categoriesTags.length === 0) {
    return 'General';
  }
  
  // Common category mappings
  const categoryMappings = {
    'beverages': 'Beverages',
    'snacks': 'Snacks',
    'dairy': 'Dairy Products',
    'meat': 'Meat & Poultry',
    'fish': 'Seafood',
    'fruits': 'Fruits',
    'vegetables': 'Vegetables',
    'cereals': 'Cereals & Grains',
    'bread': 'Bakery',
    'sweets': 'Confectionery',
    'frozen': 'Frozen Foods',
    'canned': 'Canned Goods',
    'spices': 'Spices & Seasonings',
    'oils': 'Oils & Fats',
    'alcoholic': 'Alcoholic Beverages',
    'non-alcoholic': 'Non-Alcoholic Beverages'
  };
  
  // Find the first matching category
  for (const tag of categoriesTags) {
    const cleanTag = tag.replace('en:', '').toLowerCase();
    for (const [key, value] of Object.entries(categoryMappings)) {
      if (cleanTag.includes(key)) {
        return value;
      }
    }
  }
  
  // If no specific match, return the first category (cleaned up)
  const firstCategory = categoriesTags[0].replace('en:', '').replace(/-/g, ' ');
  return firstCategory.charAt(0).toUpperCase() + firstCategory.slice(1);
}

// POST /api/products/add-from-openfoodfacts - Add product to inventory from OpenFoodFacts data
router.post('/add-from-openfoodfacts', authenticateToken, requireRole('admin'), [
  body('barcode').trim().notEmpty().withMessage('Barcode is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock.godown').optional().isInt({ min: 0 }).withMessage('Godown stock must be non-negative'),
  body('stock.store').optional().isInt({ min: 0 }).withMessage('Store stock must be non-negative'),
  body('expirationDate').isISO8601().withMessage('Valid expiration date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { barcode, price, stock = {}, expirationDate, categoryId } = req.body;

    // Check if product already exists in your inventory
    const existingProduct = await Product.findOne({ qrCode: barcode });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this barcode already exists in your inventory'
      });
    }

    try {
      // Fetch product data from OpenFoodFacts using direct API call
      const response = await axios.get(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'InventoryApp/1.0 (contact@yourapp.com)'
        }
      });
      
      if (!response.data || response.data.status === 0) {
        return res.status(404).json({
          success: false,
          message: 'Product not found in OpenFoodFacts database'
        });
      }

      const offProduct = response.data.product;

      // Prepare product data for your inventory
      const inventoryProduct = {
        name: offProduct.product_name || offProduct.generic_name || 'Unknown Product',
        description: offProduct.generic_name || offProduct.ingredients_text?.substring(0, 500) || '',
        price: parseFloat(price),
        qrCode: barcode,
        imageUrl: offProduct.image_front_url || offProduct.image_url || '',
        
        // Stock information
        stock: {
          godown: parseInt(stock.godown) || 0,
          store: parseInt(stock.store) || 0,
          total: (parseInt(stock.godown) || 0) + (parseInt(stock.store) || 0),
          reserved: 0
        },
        
        expirationDate: new Date(expirationDate),
        lowStockThreshold: 5,
        createdBy: req.user.id,
        
        // OpenFoodFacts metadata
        openFoodFactsData: {
          brands: offProduct.brands,
          categories: offProduct.categories_tags,
          nutrition: offProduct.nutriments,
          allergens: offProduct.allergens_tags,
          ingredients: offProduct.ingredients_text,
          nutriscore: offProduct.nutriscore_grade,
          ecoscore: offProduct.ecoscore_grade,
          lastUpdated: new Date()
        }
      };

      // Set legacy quantity for backward compatibility
      inventoryProduct.quantity = inventoryProduct.stock.total;

      // Handle category
      if (categoryId) {
        const category = await Category.findById(categoryId);
        if (category) {
          inventoryProduct.categoryId = category._id;
          inventoryProduct.categoryName = category.name;
        }
      } else {
        // Auto-assign category based on OpenFoodFacts data
        inventoryProduct.categoryName = extractMainCategory(offProduct.categories_tags || []);
      }

      // Create the product
      const product = new Product(inventoryProduct);
      await product.save();

      // Log the activity
      await new ActivityLog({
        userId: req.user.id,
        action: 'CREATE_PRODUCT_FROM_OPENFOODFACTS',
        productId: product._id,
        details: `Added product from OpenFoodFacts: ${product.name} (${barcode})`
      }).save();

      await product.populate('createdBy', 'username fullName');

      res.status(201).json({
        success: true,
        message: 'Product successfully added to inventory from OpenFoodFacts',
        product,
        openFoodFactsUrl: `https://world.openfoodfacts.org/product/${barcode}`
      });

    } catch (apiError) {
      console.error('OpenFoodFacts API error:', apiError.message);
      return res.status(503).json({
        success: false,
        message: 'Failed to fetch product data from OpenFoodFacts',
        error: apiError.message
      });
    }

  } catch (error) {
    console.error('Add from OpenFoodFacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding product from OpenFoodFacts',
      error: error.message
    });
  }
});

// POST /api/products - Create new product (Admin only) - Updated for new stock structure
router.post('/', authenticateToken, requireRole('admin'), (req, res, next) => {
  uploadSingleToAzure('image', 'products')(req, res, next);
}, productValidation, async (req, res) => {
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

    // Validate category existence
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(400).json({ message: 'Invalid category ID provided' });
    }

    const productData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Normalize category: store both categoryId and categoryName for fast reads/sorting
    if (category) {
      productData.categoryId = category._id;
      productData.categoryName = category.name;
    }
    // Remove legacy category field if present
    if (productData.category) delete productData.category;

    // Handle stock structure - support both new and legacy formats
    if (req.body.stock) {
      // New stock structure provided
      productData.stock = {
        godown: parseInt(req.body.stock.godown) || 0,
        store: parseInt(req.body.stock.store) || 0,
        total: (parseInt(req.body.stock.godown) || 0) + (parseInt(req.body.stock.store) || 0),
        reserved: 0
      };
      // Set legacy quantity field for backward compatibility
      productData.quantity = productData.stock.total;
    } else if (req.body.quantity !== undefined) {
      // Legacy quantity provided - put all stock in godown by default
      const quantity = parseInt(req.body.quantity) || 0;
      productData.stock = {
        godown: quantity,
        store: 0,
        total: quantity,
        reserved: 0
      };
      productData.quantity = quantity;
    } else {
      // No stock provided - initialize with zeros
      productData.stock = {
        godown: 0,
        store: 0,
        total: 0,
        reserved: 0
      };
      productData.quantity = 0;
    }

    // Add image URL if uploaded to Azure or local path as fallback
    if (req.file) {
      productData.imageUrl = req.file.azureUrl || `/uploads/products/${req.file.filename}`;
      // Store Azure blob name for future deletion if needed
      if (req.file.azureBlobName) {
        productData.azureBlobName = req.file.azureBlobName;
      }
    }

    const product = new Product(productData);
    await product.save();

    // Log the activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_PRODUCT',
      productId: product._id,
      details: `Created product: ${product.name} with stock - Godown: ${product.stock.godown}, Store: ${product.stock.store}`
    }).save();

    await product.populate('createdBy', 'username fullName');
    res.status(201).json(product);
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
});

// PUT /api/products/:id - Update product (Admin only)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res, next) => {
  uploadSingleToAzure('image', 'products')(req, res, next);
}, async (req, res) => {
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

    // Delete old Azure blob if new image is uploaded and old one exists
    if (req.file && product.azureBlobName) {
      try {
        await deleteFromAzure(product.azureBlobName);
      } catch (error) {
        console.warn('Failed to delete old product image from Azure:', error.message);
      }
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    // If category is provided on update, normalize it to categoryId + categoryName
    if (req.body.category) {
      const newCat = await Category.findById(req.body.category);
      if (!newCat) {
        return res.status(400).json({ message: 'Invalid category ID provided' });
      }
      updateData.categoryId = newCat._id;
      updateData.categoryName = newCat.name;
      // Remove legacy category key if present
      if (updateData.category) delete updateData.category;
    }

    // Add image URL if uploaded to Azure or local path as fallback
    if (req.file) {
      updateData.image = req.file.azureUrl || `/uploads/products/${req.file.filename}`;
      // Store Azure blob name for future deletion if needed
      if (req.file.azureBlobName) {
        updateData.azureBlobName = req.file.azureBlobName;
      }
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
    // Validate shopId
    if (!req.user.shop || !req.user.shop._id) {
      return res.status(400).json({ message: 'Invalid shop ID' });
    }

    const categories = await Category.find({ shop: req.user.shop._id });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

module.exports = router;
