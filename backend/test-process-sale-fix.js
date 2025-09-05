// Test script to verify the processSale fix
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-migration-test';

async function testProcessSale() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test the transaction fix by importing StockService
    const StockService = require('./services/stockService');
    const Product = require('./models/Product');

    // Find a product with store stock
    const product = await Product.findOne({ 'stock.store': { $gt: 0 } });
    
    if (!product) {
      console.log('❌ No products with store stock found');
      return;
    }

    console.log(`📦 Testing sale with product: ${product.name}`);
    console.log(`📊 Current store stock: ${product.stock.store}`);

    // Create a fake user ID for testing
    const testUserId = new mongoose.Types.ObjectId();

    // Try to process a small sale
    const saleQuantity = Math.min(1, product.stock.store);
    
    console.log(`🔄 Processing sale of ${saleQuantity} units...`);
    
    const result = await StockService.processSale(
      product._id,
      saleQuantity,
      testUserId,
      'TEST-ORDER-001'
    );

    console.log('✅ Sale processed successfully!');
    console.log('📋 Result:', {
      success: result.success,
      totalQuantitySold: result.totalQuantitySold,
      movementsCount: result.movements?.length || 0,
      orderNumber: result.orderNumber
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('abortTransaction after calling commitTransaction')) {
      console.error('🚨 Transaction error still exists!');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testProcessSale();
