const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const Category = require('../models/Category');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { simpleAuthenticateToken } = require('../middleware/simpleAuth');
const { uploadSingleToAzure, deleteFromAzure } = require('../middleware/upload');
const azureBlobService = require('../services/azureBlobService');
const multer = require('multer');
const path = require('path');
const axios = require('axios'); // For OpenFoodFacts API calls

// Helper function to upload file to Azure
const uploadToAzure = async (file) => {
  if (!file) {
    throw new Error('No file provided for upload');
  }
  
  try {
    const uploadResult = await azureBlobService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      'products'
    );
    console.log('✅ Azure upload successful:', uploadResult.url);
    return uploadResult.url;
  } catch (error) {
    console.error('❌ Azure upload failed:', error);
    throw error;
  }
};

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
  // body('expirationDate').isISO8601().withMessage('Valid expiration date is required'),
  // Updated to support new stock structure
  body('stock.godown').optional().isInt({ min: 0 }).withMessage('Godown stock must be non-negative'),
  body('stock.store').optional().isInt({ min: 0 }).withMessage('Store stock must be non-negative'),
  // Keep legacy quantity support for backward compatibility
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('qrCode').trim().notEmpty().withMessage('QR code is required'),
  body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be non-negative'),
  body('shopId').isMongoId().withMessage('Valid shop ID is required'),
  // Add validation for imageUrl and brand
  body('imageUrl').optional().isURL().withMessage('Image URL must be a valid URL'),
  body('brand').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Brand must be between 1-100 characters')
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
    console.log(`📍 Request URL: https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    console.log(`👤 User ID: ${req.user.id}`);

    try {
      // Direct API call to OpenFoodFacts
      const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
      console.log(`📡 Making API call to: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'InventoryApp/1.0 (contact@yourapp.com)'
        }
      });

      console.log(`✅ API Response Status: ${response.status}`);
      console.log(`📊 API Response Data Status: ${response.data?.status}`);
      console.log(`📦 Product Found: ${response.data?.product ? 'Yes' : 'No'}`);
      
      if (response.data?.product) {
        console.log(`🏷️ Product Name: ${response.data.product.product_name || 'N/A'}`);
        console.log(`🏢 Brand: ${response.data.product.brands || 'N/A'}`);
      }

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
      console.error('🚨 OpenFoodFacts API error details:');
      console.error(`❌ Error Message: ${apiError.message}`);
      console.error(`📍 Error Code: ${apiError.code || 'N/A'}`);
      console.error(`🌐 Request URL: ${apiError.config?.url || 'N/A'}`);
      console.error(`📊 Response Status: ${apiError.response?.status || 'N/A'}`);
      console.error(`📄 Response Data: ${JSON.stringify(apiError.response?.data || {}, null, 2)}`);
      console.error(`⏱️ Timeout: ${apiError.code === 'ECONNABORTED' ? 'YES' : 'NO'}`);
      
      if (apiError.response?.status === 404) {
        console.log(`🔍 Product with barcode ${barcode} not found in OpenFoodFacts database`);
        return res.status(404).json({
          success: false,
          message: 'Product not found in OpenFoodFacts database',
          barcode,
          suggestion: 'This product might not be in the OpenFoodFacts database. You can add it manually to your inventory.',
          debug: {
            url: `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
            status: apiError.response?.status,
            statusText: apiError.response?.statusText
          }
        });
      }
      
      if (apiError.code === 'ECONNABORTED') {
        console.log(`⏱️ Request timeout for barcode ${barcode}`);
        return res.status(503).json({
          success: false,
          message: 'OpenFoodFacts API timeout',
          error: 'The request took too long to complete',
          barcode,
          suggestion: 'Please try again or check your internet connection.',
          debug: {
            timeout: '10 seconds',
            url: `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
          }
        });
      }
      
      console.log(`🌐 Network or API error for barcode ${barcode}`);
      return res.status(503).json({
        success: false,
        message: 'Failed to connect to OpenFoodFacts database',
        error: apiError.message,
        barcode,
        suggestion: 'Please check your internet connection or try again later.',
        debug: {
          errorCode: apiError.code,
          status: apiError.response?.status,
          url: `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
        }
      });
    }

  } catch (error) {
    console.error('🚨 General OpenFoodFacts scan error:');
    console.error(`❌ Error Message: ${error.message}`);
    console.error(`📋 Error Stack: ${error.stack}`);
    console.error(`🔍 Barcode: ${req.body?.barcode || 'N/A'}`);
    console.error(`👤 User ID: ${req.user?.id || 'N/A'}`);
    
    res.status(500).json({
      success: false,
      message: 'Error scanning barcode with OpenFoodFacts',
      error: error.message,
      debug: {
        barcode: req.body?.barcode,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      }
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
    // Log the incoming payload for debugging
    console.log('📦 POST /api/products - Incoming request:');
    console.log('👤 User ID:', req.user?.id);
    console.log('🏪 Shop ID:', req.user?.shop?._id);
    console.log('🎭 User Role:', req.user?.role);
    console.log('📄 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('📎 File Upload:', req.file ? {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      azureUrl: req.file.azureUrl,
      azureBlobName: req.file.azureBlobName
    } : 'No file uploaded');
    console.log('🌐 Client IP:', req.ip || req.connection.remoteAddress);
    console.log('🔗 User Agent:', req.get('User-Agent'));
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if QR code already exists
    console.log('🔍 Checking if QR code already exists:', req.body.qrCode);
    const existingProduct = await Product.findOne({ qrCode: req.body.qrCode });
    if (existingProduct) {
      console.log('❌ QR code already exists for product:', existingProduct.name);
      return res.status(400).json({ message: 'Product with this QR code already exists' });
    }

    // Validate category existence
    console.log('📂 Validating category ID:', req.body.category);
    const category = await Category.findById(req.body.category);
    if (!category) {
      console.log('❌ Invalid category ID provided:', req.body.category);
      return res.status(400).json({ message: 'Invalid category ID provided' });
    }
    console.log('✅ Category found:', category.name);

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

    // Add image URL if uploaded to Azure or provided as URL
    if (req.body.imageUrl && req.body.imageUrl.trim()) {
      // Direct URL provided - use it directly without Azure upload
      console.log('🔗 Using provided image URL:', req.body.imageUrl);
      productData.imageUrl = req.body.imageUrl.trim();
      // No Azure blob name since it's an external URL
      productData.azureBlobName = null;
    } else if (req.file) {
      // File uploaded - use Azure URL or local path as fallback
      console.log('📁 File uploaded, using Azure storage');
      productData.imageUrl = req.file.azureUrl || `/uploads/products/${req.file.filename}`;
      // Store Azure blob name for future deletion if needed
      if (req.file.azureBlobName) {
        productData.azureBlobName = req.file.azureBlobName;
      }
    } else {
      console.log('📷 No image provided');
      productData.imageUrl = null;
      productData.azureBlobName = null;
    }

    console.log('💾 Final product data to save:', JSON.stringify(productData, null, 2));

    const product = new Product(productData);
    await product.save();
    
    console.log('✅ Product successfully created:');
    console.log('🆔 Product ID:', product._id);
    console.log('🏷️ Product Name:', product.name);
    console.log('🔖 QR Code:', product.qrCode);
    console.log('📦 Stock:', product.stock);

    // Log the activity
    await new ActivityLog({
      userId: req.user.id,
      action: 'CREATE_PRODUCT',
      productId: product._id,
      details: `Created product: ${product.name} with stock - Godown: ${product.stock.godown}, Store: ${product.stock.store}`
    }).save();

    await product.populate('createdBy', 'username fullName');
    console.log('📤 Sending response with populated product data');
    res.status(201).json(product);
  } catch (error) {
    console.error('🚨 Product creation error details:');
    console.error('❌ Error Message:', error.message);
    console.error('📋 Error Stack:', error.stack);
    console.error('📄 Request Body:', JSON.stringify(req.body, null, 2));
    console.error('👤 User:', req.user?.id);
    console.error('⏰ Timestamp:', new Date().toISOString());
    
    res.status(500).json({ 
      message: 'Error creating product', 
      error: error.message,
      debug: {
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
        requestBody: req.body
      }
    });
  }
});

// PUT /api/products/:id - Update product (Admin only)
router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
  console.log('🔄 PUT /api/products/:id - Update request received');
  console.log('🌐 Client IP:', req.ip || req.connection.remoteAddress);
  console.log('🔗 User Agent:', req.get('User-Agent'));
  console.log('🔑 Authorization Header Present:', !!req.headers.authorization);
  console.log('🔑 Authorization Header Value:', req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'Not present');
  console.log('👤 User from middleware:', req.user ? {
    id: req.user.id,
    username: req.user.username,
    role: req.user.role
  } : 'No user found');
  console.log('🆔 Product ID:', req.params.id);
  console.log('📄 Request Body:', JSON.stringify(req.body, null, 2));
  console.log('📎 File Upload:', req.file ? {
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype
  } : 'No file uploaded');
  console.log('⏰ Timestamp:', new Date().toISOString());

  // Check if user was properly authenticated
  if (!req.user) {
    console.log('❌ Authentication failed - No user found in request');
    console.log('🔍 Available request properties:', Object.keys(req));
    console.log('🔍 Request headers:', JSON.stringify(req.headers, null, 2));
    return res.status(401).json({ 
      message: 'Authentication required',
      debug: {
        timestamp: new Date().toISOString(),
        userPresent: !!req.user,
        authHeaderPresent: !!req.headers.authorization
      }
    });
  }

  console.log('✅ User authenticated successfully, proceeding with update...');

  try {
    const productId = req.params.id;
    const updateData = { ...req.body };
    
    // Remove undefined/null fields from updateData
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key];
      }
    });

    console.log('📋 Cleaned update data:', JSON.stringify(updateData, null, 2));

    // Find the existing product first
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      console.log('❌ Product not found for ID:', productId);
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('✅ Existing product found:', {
      id: existingProduct._id,
      name: existingProduct.name,
      currentImage: existingProduct.imageUrl
    });

    // Check if QR code is being changed and if it already exists
    if (updateData.qrCode && updateData.qrCode !== existingProduct.qrCode) {
      const existingQRProduct = await Product.findOne({ 
        qrCode: updateData.qrCode,
        _id: { $ne: productId }
      });
      if (existingQRProduct) {
        console.log('❌ QR code already exists for another product');
        return res.status(400).json({ message: 'Product with this QR code already exists' });
      }
    }

    // Handle image update logic with priority system
    let imageToSet = existingProduct.imageUrl; // Keep existing image by default
    let shouldDeleteOldImage = false;
    
    console.log('🖼️ === IMAGE UPDATE DEBUG ===');
    console.log('🖼️ Current image in product:', existingProduct.imageUrl);
    console.log('🖼️ Request imageUrl provided:', updateData.imageUrl);
    console.log('🖼️ File uploaded:', !!req.file);
    console.log('🖼️ Request body keys:', Object.keys(req.body));
    console.log('🖼️ Update data keys:', Object.keys(updateData));

    // Priority 1: Check for imageUrl in request body
    if (updateData.imageUrl !== undefined) {
      console.log('🔗 ImageUrl provided in request body:', updateData.imageUrl);
      
      if (updateData.imageUrl === '' || updateData.imageUrl === null) {
        // User wants to remove the image
        console.log('� Removing image (empty imageUrl provided)');
        imageToSet = '';
        shouldDeleteOldImage = existingProduct.imageUrl && existingProduct.imageUrl.includes('blob.core.windows.net');
      } else {
        // User provided a new URL
        console.log('✅ Using provided URL as image:', updateData.imageUrl);
        imageToSet = updateData.imageUrl;
        shouldDeleteOldImage = existingProduct.imageUrl && existingProduct.imageUrl.includes('blob.core.windows.net') && existingProduct.imageUrl !== updateData.imageUrl;
      }
    }
    // Priority 2: Check for uploaded file (only if no imageUrl was provided)
    else if (req.file) {
      console.log('📁 File uploaded, processing Azure upload...');
      try {
        const imageUrl = await uploadToAzure(req.file);
        console.log('☁️ Azure upload successful:', imageUrl);
        imageToSet = imageUrl;
        shouldDeleteOldImage = existingProduct.imageUrl && existingProduct.imageUrl.includes('blob.core.windows.net');
      } catch (uploadError) {
        console.error('❌ Azure upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image to Azure', details: uploadError.message });
      }
    }
    // If no image provided in request, keep existing image
    else {
      console.log('📷 No image provided in request, keeping existing image:', existingProduct.imageUrl);
      imageToSet = existingProduct.imageUrl;
    }

    // Set the final image value in the correct field
    updateData.imageUrl = imageToSet;
    console.log('🖼️ Final image value to set:', imageToSet);

    // Clean up old Azure blob if needed
    if (shouldDeleteOldImage && existingProduct.imageUrl) {
      console.log('🗑️ Attempting to delete old Azure blob:', existingProduct.imageUrl);
      try {
        await deleteFromAzure(existingProduct.imageUrl);
        console.log('✅ Old Azure blob deleted successfully');
      } catch (deleteError) {
        console.error('⚠️ Failed to delete old Azure blob:', deleteError);
        // Don't fail the update if blob deletion fails
      }
    }

    // Handle stock updates (support both new structure and legacy)
    if (updateData.stock || updateData.quantity !== undefined) {
      console.log('📊 Processing stock updates...');
      
      if (updateData.stock) {
        console.log('📦 New stock structure provided:', updateData.stock);
        
        // Handle both string and object stock data
        let stockData;
        if (typeof updateData.stock === 'string') {
          try {
            stockData = JSON.parse(updateData.stock);
            console.log('📄 Parsed stock from string:', stockData);
          } catch (parseError) {
            console.error('❌ Failed to parse stock JSON:', parseError);
            return res.status(400).json({ error: 'Invalid stock format' });
          }
        } else {
          stockData = updateData.stock;
        }
        
        // Ensure stock object has proper structure and calculate total
        const godownStock = parseInt(stockData.godown) || 0;
        const storeStock = parseInt(stockData.store) || 0;
        
        updateData.stock = {
          godown: godownStock,
          store: storeStock,
          total: godownStock + storeStock,
          reserved: stockData.reserved || 0
        };
        
        // Update legacy quantity field for compatibility
        updateData.quantity = updateData.stock.total;
      } else if (updateData.quantity !== undefined) {
        console.log('🔄 Legacy quantity provided, converting to new structure:', updateData.quantity);
        // Convert legacy quantity to new stock structure (assume all goes to store)
        updateData.stock = {
          godown: existingProduct.stock?.godown || 0,
          store: parseInt(updateData.quantity) || 0
        };
        delete updateData.quantity; // Remove legacy field
      }
      
      console.log('� Final stock structure:', updateData.stock);
    }

    // Parse numeric fields if they're strings
    if (updateData.price && typeof updateData.price === 'string') {
      updateData.price = parseFloat(updateData.price);
      console.log('💰 Parsed price:', updateData.price);
    }

    if (updateData.lowStockThreshold && typeof updateData.lowStockThreshold === 'string') {
      updateData.lowStockThreshold = parseInt(updateData.lowStockThreshold);
      console.log('⚠️ Parsed lowStockThreshold:', updateData.lowStockThreshold);
    }

    // Handle category field mapping (frontend sends 'category', schema uses 'categoryId')
    if (updateData.category) {
      console.log('🏷️ Category provided, mapping to categoryId:', updateData.category);
      updateData.categoryId = updateData.category;
      delete updateData.category; // Remove the invalid field
    }

    // If categoryId is provided, validate it exists
    if (updateData.categoryId) {
      const categoryExists = await Category.findById(updateData.categoryId);
      if (!categoryExists) {
        console.log('❌ Invalid category ID provided:', updateData.categoryId);
        return res.status(400).json({ message: 'Invalid category ID provided' });
      }
      console.log('✅ Category validation passed:', categoryExists.name);
    }

    console.log('💾 Final update data before database update:', JSON.stringify(updateData, null, 2));

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    ).populate('categoryId', 'name');

    if (!updatedProduct) {
      console.log('❌ Product update failed - product not found after update');
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('✅ Product updated successfully:', {
      id: updatedProduct._id,
      name: updatedProduct.name,
      image: updatedProduct.imageUrl,
      stock: updatedProduct.stock
    });

    // Log the activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'UPDATE_PRODUCT',
      productId: updatedProduct._id,
      details: `Updated product: ${updatedProduct.name}`
    });

    console.log('📝 Activity log created for product update');

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('❌ Error updating product:', error);
    console.error('🚨 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      productId: req.params.id,
      userId: req.user?.id,
      requestBody: req.body,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      error: 'Failed to update product', 
      details: error.message,
      debug: {
        productId: req.params.id,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      },
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
