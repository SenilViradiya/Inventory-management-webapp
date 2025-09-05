const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Product = require('./models/Product');
const ProductBatch = require('./models/ProductBatch');

async function checkStockConsistency() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db');
    console.log('Connected to MongoDB');

    console.log('\n=== CHECKING STOCK CONSISTENCY ===\n');

    // Find products with store stock
    const productsWithStoreStock = await Product.find({ 'stock.store': { $gt: 0 } });
    console.log(`Found ${productsWithStoreStock.length} products with store stock > 0`);

    let inconsistencyCount = 0;
    
    for (const product of productsWithStoreStock) {
      // Sum up storeQty from all batches for this product
      const batches = await ProductBatch.find({ productId: product._id });
      const totalBatchStoreStock = batches.reduce((sum, batch) => sum + (batch.storeQty || 0), 0);
      
      if (Math.abs(product.stock.store - totalBatchStoreStock) > 0.01) { // Allow for tiny rounding errors
        inconsistencyCount++;
        console.log(`\n❌ INCONSISTENCY FOUND:`);
        console.log(`  Product: ${product.name}`);
        console.log(`  Product ID: ${product._id}`);
        console.log(`  Product.stock.store: ${product.stock.store}`);
        console.log(`  Sum of batch.storeQty: ${totalBatchStoreStock}`);
        console.log(`  Difference: ${product.stock.store - totalBatchStoreStock}`);
        
        if (batches.length > 0) {
          console.log(`  Batches:`);
          batches.forEach(batch => {
            console.log(`    - Batch ID: ${batch._id}, storeQty: ${batch.storeQty || 0}, godownQty: ${batch.godownQty || 0}`);
          });
        } else {
          console.log(`  ⚠️  No batches found for this product!`);
        }
      }
    }

    if (inconsistencyCount === 0) {
      console.log('\n✅ All products have consistent stock between Product.stock.store and sum of batch.storeQty');
    } else {
      console.log(`\n❌ Found ${inconsistencyCount} products with stock inconsistencies`);
      
      console.log('\n🔧 SUGGESTED FIXES:');
      console.log('1. Sync product stock with batch totals');
      console.log('2. Create missing batches for products without any');
      console.log('3. Review recent stock operations that might have caused this');
    }

    // Check for products with 0 batches but positive stock
    const productsWithoutBatches = await Product.find({
      $and: [
        { $or: [{ 'stock.store': { $gt: 0 } }, { 'stock.godown': { $gt: 0 } }] }
      ]
    });

    const orphanedProducts = [];
    for (const product of productsWithoutBatches) {
      const batchCount = await ProductBatch.countDocuments({ productId: product._id });
      if (batchCount === 0) {
        orphanedProducts.push(product);
      }
    }

    if (orphanedProducts.length > 0) {
      console.log(`\n⚠️  Found ${orphanedProducts.length} products with stock but no batches:`);
      orphanedProducts.slice(0, 5).forEach(product => {
        console.log(`  - ${product.name} (ID: ${product._id})`);
        console.log(`    Store: ${product.stock.store}, Godown: ${product.stock.godown}`);
      });
    }

  } catch (error) {
    console.error('Error checking stock consistency:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkStockConsistency();
