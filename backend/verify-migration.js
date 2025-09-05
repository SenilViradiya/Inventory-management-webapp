const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const ProductBatch = require('./models/ProductBatch');
const ActivityLog = require('./models/ActivityLog');

async function verifyMigrationResults() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`🔗 Connected to: ${process.env.MONGODB_URI?.split('/').pop()}`);

    console.log('\n=== POST-MIGRATION VERIFICATION ===\n');

    // 1. Overall statistics
    const totalProducts = await Product.countDocuments();
    const totalBatches = await ProductBatch.countDocuments();
    const migrationLogs = await ActivityLog.countDocuments({ action: 'STOCK_MIGRATION_TO_BATCH' });

    console.log('📊 Overall Statistics:');
    console.log(`  - Total products: ${totalProducts}`);
    console.log(`  - Total batches: ${totalBatches}`);
    console.log(`  - Migration logs: ${migrationLogs}`);

    // 2. Stock consistency check
    console.log('\n🔍 Stock Consistency Check:');
    
    const productsWithBatches = await Product.aggregate([
      {
        $lookup: {
          from: 'productbatches',
          localField: '_id',
          foreignField: 'productId',
          as: 'batches'
        }
      },
      {
        $addFields: {
          batchCount: { $size: '$batches' },
          totalBatchGodown: { $sum: '$batches.godownQty' },
          totalBatchStore: { $sum: '$batches.storeQty' },
          totalBatchQty: { $sum: '$batches.totalQty' }
        }
      },
      {
        $match: {
          batchCount: { $gt: 0 }
        }
      }
    ]);

    console.log(`  - Products with batches: ${productsWithBatches.length}`);

    // 3. Check for inconsistencies
    const inconsistencies = [];
    productsWithBatches.forEach(product => {
      const productStock = product.stock || {};
      const productGodown = productStock.godown || 0;
      const productStore = productStock.store || 0;
      const productTotal = productStock.total || product.quantity || 0;

      const batchGodown = product.totalBatchGodown;
      const batchStore = product.totalBatchStore;
      const batchTotal = product.totalBatchQty;

      if (productGodown !== batchGodown || productStore !== batchStore || productTotal !== batchTotal) {
        inconsistencies.push({
          productName: product.name,
          productId: product._id,
          productStock: { godown: productGodown, store: productStore, total: productTotal },
          batchStock: { godown: batchGodown, store: batchStore, total: batchTotal }
        });
      }
    });

    if (inconsistencies.length === 0) {
      console.log('  ✅ All stock levels are consistent between products and batches');
    } else {
      console.log(`  ⚠️  Found ${inconsistencies.length} inconsistencies:`);
      inconsistencies.slice(0, 5).forEach(item => {
        console.log(`    - ${item.productName}:`);
        console.log(`      Product: ${JSON.stringify(item.productStock)}`);
        console.log(`      Batches: ${JSON.stringify(item.batchStock)}`);
      });
      if (inconsistencies.length > 5) {
        console.log(`    ... and ${inconsistencies.length - 5} more`);
      }
    }

    // 4. Migration batch analysis
    console.log('\n📦 Migration Batch Analysis:');
    const migrationBatches = await ProductBatch.find({ 
      batchNumber: { $regex: /^MIG-/ } 
    }).populate('productId', 'name price');

    console.log(`  - Migration batches created: ${migrationBatches.length}`);
    
    if (migrationBatches.length > 0) {
      const totalMigratedQty = migrationBatches.reduce((sum, batch) => sum + batch.totalQty, 0);
      const totalMigratedValue = migrationBatches.reduce((sum, batch) => {
        return sum + (batch.totalQty * (batch.sellingPrice || 0));
      }, 0);

      console.log(`  - Total migrated quantity: ${totalMigratedQty.toLocaleString()}`);
      console.log(`  - Total migrated value: $${totalMigratedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

      // Sample migration batches
      console.log('\n📋 Sample Migration Batches (first 5):');
      migrationBatches.slice(0, 5).forEach(batch => {
        console.log(`  - ${batch.productId?.name || 'Unknown Product'}:`);
        console.log(`    Batch: ${batch.batchNumber}`);
        console.log(`    Stock: godown=${batch.godownQty}, store=${batch.storeQty}, total=${batch.totalQty}`);
        console.log(`    Value: $${(batch.totalQty * batch.sellingPrice).toFixed(2)}`);
      });
    }

    // 5. Products without batches (if any)
    const productsWithoutBatches = await Product.find({
      $or: [
        { quantity: { $gt: 0 } },
        { 'stock.total': { $gt: 0 } }
      ]
    });

    const realProductsWithoutBatches = [];
    for (const product of productsWithoutBatches) {
      const batches = await ProductBatch.find({ productId: product._id });
      if (batches.length === 0) {
        realProductsWithoutBatches.push(product);
      }
    }

    console.log(`\n📦 Products Without Batches: ${realProductsWithoutBatches.length}`);
    if (realProductsWithoutBatches.length > 0) {
      console.log('⚠️  These products have stock but no batches:');
      realProductsWithoutBatches.slice(0, 5).forEach(product => {
        console.log(`  - ${product.name}: qty=${product.quantity}, stock=${JSON.stringify(product.stock || {})}`);
      });
    } else {
      console.log('✅ All products with stock have corresponding batches');
    }

    // 6. Test batch operations
    console.log('\n🧪 Testing Batch Operations:');
    
    // Find a product with batches for testing
    const testProduct = await Product.findOne().populate('batches');
    const testBatches = await ProductBatch.find({ productId: testProduct._id });
    
    if (testBatches.length > 0) {
      console.log(`  - Test product: ${testProduct.name}`);
      console.log(`  - Batches found: ${testBatches.length}`);
      console.log(`  - Sample batch: ${testBatches[0].batchNumber}`);
      console.log('  ✅ Batch queries working correctly');
    } else {
      console.log('  ⚠️  No batches found for testing');
    }

    // 7. Activity log verification
    console.log('\n📝 Activity Log Verification:');
    const recentMigrationLogs = await ActivityLog.find({ 
      action: 'STOCK_MIGRATION_TO_BATCH' 
    }).sort({ createdAt: -1 }).limit(5).populate('productId', 'name');

    if (recentMigrationLogs.length > 0) {
      console.log(`  - Recent migration logs: ${recentMigrationLogs.length}`);
      console.log('  - Sample logs:');
      recentMigrationLogs.forEach(log => {
        console.log(`    ${log.productId?.name || 'Unknown'}: ${log.details?.batchNumber || 'No batch'}`);
      });
      console.log('  ✅ Activity logging working correctly');
    } else {
      console.log('  ⚠️  No migration logs found');
    }

    // 8. Overall health check
    console.log('\n🏥 Overall Health Check:');
    
    const healthScore = {
      total: 0,
      passed: 0
    };

    // Check 1: Stock consistency
    healthScore.total++;
    if (inconsistencies.length === 0) {
      healthScore.passed++;
      console.log('  ✅ Stock consistency: PASS');
    } else {
      console.log('  ❌ Stock consistency: FAIL');
    }

    // Check 2: Migration completeness
    healthScore.total++;
    if (realProductsWithoutBatches.length === 0) {
      healthScore.passed++;
      console.log('  ✅ Migration completeness: PASS');
    } else {
      console.log('  ❌ Migration completeness: FAIL');
    }

    // Check 3: Activity logs
    healthScore.total++;
    if (migrationLogs > 0) {
      healthScore.passed++;
      console.log('  ✅ Activity logging: PASS');
    } else {
      console.log('  ❌ Activity logging: FAIL');
    }

    // Check 4: Batch functionality
    healthScore.total++;
    if (testBatches.length > 0) {
      healthScore.passed++;
      console.log('  ✅ Batch functionality: PASS');
    } else {
      console.log('  ❌ Batch functionality: FAIL');
    }

    const healthPercentage = (healthScore.passed / healthScore.total) * 100;
    console.log(`\n🎯 Overall Health Score: ${healthScore.passed}/${healthScore.total} (${healthPercentage.toFixed(1)}%)`);

    if (healthPercentage === 100) {
      console.log('🎉 MIGRATION SUCCESSFUL! Your system is ready for batch-wise operations.');
    } else if (healthPercentage >= 75) {
      console.log('⚠️  MIGRATION MOSTLY SUCCESSFUL with minor issues. Review and fix the failed checks.');
    } else {
      console.log('❌ MIGRATION HAS SIGNIFICANT ISSUES. Please review and re-run migration if needed.');
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Fix any inconsistencies found');
    console.log('2. Test batch-wise stock operations');
    console.log('3. Update frontend to use new batch APIs');
    console.log('4. Train users on new batch features');

  } catch (error) {
    console.error('Verification error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

verifyMigrationResults();
