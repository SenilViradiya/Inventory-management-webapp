const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const Category = require('../models/Category');
const Shop = require('../models/Shop');
const Role = require('../models/Role');
require('dotenv').config();

async function testStockAPI() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management');
    console.log('Connected to MongoDB');

    // Get existing entities
    const user = await User.findOne().populate('role');
    const category = await Category.findOne();
    const shop = await Shop.findOne();

    if (!user || !category || !shop) {
      console.log('Missing required entities:');
      console.log('User:', !!user);
      console.log('Category:', !!category);
      console.log('Shop:', !!shop);
      return;
    }

    console.log('Found entities:');
    console.log('User ID:', user._id);
    console.log('Category ID:', category._id);
    console.log('Shop ID:', shop._id);

    // Test creating a product via API (simulated)
    const testProduct = {
      name: 'Test Beer 330ml',
      description: 'Test beer for API testing',
      price: 3.99,
      stock: {
        godown: 50,
        store: 10,
        total: 60,
        reserved: 0
      },
      quantity: 60,
      qrCode: 'TESTBEER001',
      category: category._id.toString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      lowStockThreshold: 20,
      shopId: shop._id.toString(),
      barcode: '1234567890123',
      weight: 330,
      tags: ['test', 'beer']
    };

    console.log('\nTest product data:');
    console.log(JSON.stringify(testProduct, null, 2));

    // Check if product already exists
    const existingProduct = await Product.findOne({ qrCode: testProduct.qrCode });
    if (existingProduct) {
      console.log('\nProduct already exists with ID:', existingProduct._id);
      
      // Test stock movements
      console.log('\nCurrent stock:');
      console.log('Godown:', existingProduct.stock.godown);
      console.log('Store:', existingProduct.stock.store);
      console.log('Total:', existingProduct.stock.total);
      
      // Show sample API calls
      console.log('\n🚀 Sample API Calls:');
      console.log('\n1. Get Stock Summary:');
      console.log('curl -X GET "http://localhost:5001/api/stock/summary"');
      
      console.log('\n2. Move stock from godown to store:');
      console.log(`curl -X POST "http://localhost:5001/api/stock/move-to-store" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{`);
      console.log(`    "productId": "${existingProduct._id}",`);
      console.log(`    "quantity": 5,`);
      console.log(`    "reason": "Store restocking",`);
      console.log(`    "notes": "Moving items for weekend rush"`);
      console.log(`  }'`);
      
      console.log('\n3. Add new stock to godown:');
      console.log(`curl -X POST "http://localhost:5001/api/stock/add-godown" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{`);
      console.log(`    "productId": "${existingProduct._id}",`);
      console.log(`    "quantity": 100,`);
      console.log(`    "reason": "New delivery",`);
      console.log(`    "batchNumber": "BATCH001",`);
      console.log(`    "referenceNumber": "PO-2024-001"`);
      console.log(`  }'`);
      
      console.log('\n4. Process a sale:');
      console.log(`curl -X POST "http://localhost:5001/api/stock/process-sale" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{`);
      console.log(`    "productId": "${existingProduct._id}",`);
      console.log(`    "quantity": 2,`);
      console.log(`    "orderNumber": "ORDER-001"`);
      console.log(`  }'`);
      
      console.log('\n5. Get stock movement history:');
      console.log(`curl -X GET "http://localhost:5001/api/stock/movement-history/${existingProduct._id}"`);
      
      console.log('\n6. Get low stock products:');
      console.log('curl -X GET "http://localhost:5001/api/stock/low-stock"');
      
    } else {
      console.log('\nNo test product found. Creating one...');
      
      const product = new Product({
        ...testProduct,
        category: category._id,
        shopId: shop._id,
        createdBy: user._id
      });
      
      await product.save();
      console.log('✅ Test product created with ID:', product._id);
      console.log('Stock - Godown:', product.stock.godown, 'Store:', product.stock.store, 'Total:', product.stock.total);
    }

    console.log('\n📋 Available Stock Management Endpoints:');
    console.log('POST /api/stock/move-to-store     - Move stock from godown to store');
    console.log('POST /api/stock/move-to-godown    - Move stock from store to godown');
    console.log('POST /api/stock/add-godown        - Add new stock to godown');
    console.log('POST /api/stock/process-sale      - Process a sale from store');
    console.log('GET  /api/stock/summary           - Get overall stock summary');
    console.log('GET  /api/stock/low-stock         - Get products with low stock');
    console.log('GET  /api/stock/out-of-stock      - Get products with zero stock');
    console.log('GET  /api/stock/movement-history/:id - Get stock movement history');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
testStockAPI();
