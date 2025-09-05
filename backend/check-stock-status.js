const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const ProductBatch = require('./models/ProductBatch');

async function checkCurrentStockStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db');
    console.log('Connected to MongoDB');

    console.log('\n=== CURRENT STOCK STATUS ANALYSIS ===\n');

    // 1. Get total products
    const totalProducts = await Product.countDocuments();
    console.log(`📦 Total Products in System: ${totalProducts}`);

    // 2. Get products with stock
    const productsWithQuantity = await Product.find({ quantity: { $gt: 0 } });
    const productsWithStockStructure = await Product.find({
      $or: [
        { 'stock.godown': { $gt: 0 } },
        { 'stock.store': { $gt: 0 } }
      ]
    });

    console.log(`📊 Products with legacy quantity > 0: ${productsWithQuantity.length}`);
    console.log(`🏪 Products with new stock structure: ${productsWithStockStructure.length}`);

    // 3. Check existing batches
    const totalBatches = await ProductBatch.countDocuments();
    const batchedProducts = await ProductBatch.distinct('productId');
    console.log(`📝 Total Batches: ${totalBatches}`);
    console.log(`🔗 Products with Batches: ${batchedProducts.length}`);

    // 4. Detailed analysis
    console.log('\n=== DETAILED STOCK ANALYSIS ===');

    // Products with only legacy quantity
    const legacyOnlyProducts = await Product.find({
      quantity: { $gt: 0 },
      $or: [
        { stock: { $exists: false } },
        { 'stock.total': { $exists: false } },
        { 'stock.total': 0 }
      ]
    });

    // Products with new stock structure
    const newStructureProducts = await Product.find({
      'stock.total': { $gt: 0 }
    });

    // Products that need batch migration
    const productsNeedingBatches = await Product.find({
      $or: [
        { quantity: { $gt: 0 } },
        { 'stock.total': { $gt: 0 } }
      ],
      _id: { $nin: batchedProducts }
    });

    console.log(`\n📋 Stock Structure Breakdown:`);
    console.log(`  - Legacy quantity only: ${legacyOnlyProducts.length} products`);
    console.log(`  - New stock structure: ${newStructureProducts.length} products`);
    console.log(`  - Need batch migration: ${productsNeedingBatches.length} products`);

    // 5. Sample data for each category
    console.log('\n🔍 Sample Data:');

    if (legacyOnlyProducts.length > 0) {
      console.log('\nLegacy Quantity Only (first 3):');
      legacyOnlyProducts.slice(0, 3).forEach(p => {
        console.log(`  - ${p.name}: quantity=${p.quantity}, stock=${JSON.stringify(p.stock || 'undefined')}`);
      });
    }

    if (newStructureProducts.length > 0) {
      console.log('\nNew Stock Structure (first 3):');
      newStructureProducts.slice(0, 3).forEach(p => {
        console.log(`  - ${p.name}: quantity=${p.quantity}, stock=${JSON.stringify(p.stock)}`);
      });
    }

    if (productsNeedingBatches.length > 0) {
      console.log('\nProducts Needing Batch Migration (first 5):');
      productsNeedingBatches.slice(0, 5).forEach(p => {
        const legacyQty = p.quantity || 0;
        const newQty = p.stock?.total || 0;
        const godown = p.stock?.godown || 0;
        const store = p.stock?.store || 0;
        
        console.log(`  - ${p.name}:`);
        console.log(`    Legacy qty: ${legacyQty}`);
        console.log(`    New structure: total=${newQty}, godown=${godown}, store=${store}`);
        console.log(`    Effective stock: ${Math.max(legacyQty, newQty)}`);
      });
    }

    // 6. Calculate migration impact
    const migrationSummary = {
      totalValue: 0,
      totalQuantity: 0,
      productCount: productsNeedingBatches.length,
      categories: {}
    };

    productsNeedingBatches.forEach(product => {
      const effectiveQty = Math.max(product.quantity || 0, product.stock?.total || 0);
      const value = effectiveQty * (product.price || 0);
      
      migrationSummary.totalQuantity += effectiveQty;
      migrationSummary.totalValue += value;
      
      const category = product.categoryName || product.category || 'Uncategorized';
      if (!migrationSummary.categories[category]) {
        migrationSummary.categories[category] = { count: 0, quantity: 0, value: 0 };
      }
      migrationSummary.categories[category].count++;
      migrationSummary.categories[category].quantity += effectiveQty;
      migrationSummary.categories[category].value += value;
    });

    console.log('\n💰 Migration Impact Summary:');
    console.log(`  - Products to migrate: ${migrationSummary.productCount}`);
    console.log(`  - Total quantity: ${migrationSummary.totalQuantity.toLocaleString()}`);
    console.log(`  - Total value: $${migrationSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

    console.log('\n📊 By Category:');
    Object.entries(migrationSummary.categories).forEach(([category, data]) => {
      console.log(`  - ${category}: ${data.count} products, ${data.quantity} units, $${data.value.toFixed(2)}`);
    });

    // 7. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (productsNeedingBatches.length === 0) {
      console.log('✅ All products already have batch data or no stock to migrate.');
      console.log('🎉 Your system is ready for batch-wise operations!');
    } else {
      console.log('📋 Migration Steps:');
      console.log('1. Run: node migrate-stock-to-batches.js (dry run analysis)');
      console.log('2. Review the migration preview');
      console.log('3. Run: node migrate-stock-to-batches.js --execute (actual migration)');
      console.log('4. Verify results with stock summary reports');
      
      console.log('\n⚠️  Migration Safety:');
      console.log('- Creates "MIGRATION-BATCH" for each product');
      console.log('- Preserves all existing stock quantities');
      console.log('- Maintains godown/store distribution');
      console.log('- Creates activity logs for audit trail');
      console.log('- Uses database transactions for data integrity');
    }

    console.log('\n🔄 System Compatibility:');
    console.log('- Legacy APIs will continue working');
    console.log('- New batch APIs provide advanced features');
    console.log('- Gradual transition possible');
    console.log('- No downtime required');

  } catch (error) {
    console.error('Stock analysis error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkCurrentStockStatus();
