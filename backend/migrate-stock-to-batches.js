const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const ProductBatch = require('./models/ProductBatch');
const ActivityLog = require('./models/ActivityLog');

async function migrateExistingStockToBatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db');
    console.log('Connected to MongoDB');

    console.log('\n=== STOCK TO BATCH MIGRATION ===\n');

    // 1. Get all products with existing stock
    const productsWithStock = await Product.find({
      $or: [
        { quantity: { $gt: 0 } },
        { 'stock.godown': { $gt: 0 } },
        { 'stock.store': { $gt: 0 } }
      ]
    });

    console.log(`Found ${productsWithStock.length} products with existing stock`);

    // 2. Check if we already have batch data for products
    const existingBatches = await ProductBatch.find({});
    const productsWithBatches = new Set(existingBatches.map(b => b.productId.toString()));

    console.log(`Found ${existingBatches.length} existing batches for ${productsWithBatches.size} products`);

    // 3. Migrate products that don't have batch data yet
    const productsToMigrate = productsWithStock.filter(p => !productsWithBatches.has(p._id.toString()));
    console.log(`\nNeed to migrate ${productsToMigrate.length} products to batch system`);

    if (productsToMigrate.length === 0) {
      console.log('✅ All products already have batch data or no stock to migrate');
      return;
    }

    // 4. Show current stock summary before migration
    console.log('\n📊 Current Stock Summary:');
    let totalProducts = 0;
    let totalQuantity = 0;
    let totalValue = 0;

    productsToMigrate.forEach(product => {
      const qty = product.stock?.total || product.quantity || 0;
      const value = qty * (product.price || 0);
      
      console.log(`  - ${product.name}: ${qty} units, $${value.toFixed(2)}`);
      totalProducts++;
      totalQuantity += qty;
      totalValue += value;
    });

    console.log(`\n📈 Migration Summary:`);
    console.log(`  - Products to migrate: ${totalProducts}`);
    console.log(`  - Total quantity: ${totalQuantity}`);
    console.log(`  - Total value: $${totalValue.toFixed(2)}`);

    // 5. Ask for confirmation before proceeding
    console.log('\n⚠️  MIGRATION PREVIEW ⚠️');
    console.log('This will create initial batches for products without batch data.');
    console.log('The migration will:');
    console.log('1. Create a "MIGRATION-BATCH" for each product');
    console.log('2. Preserve existing godown/store distribution');
    console.log('3. Set default expiry date (1 year from now)');
    console.log('4. Use current product price as both purchase and selling price');
    console.log('5. Add activity logs for the migration');

    // For safety, let's do a dry run first
    console.log('\n🔍 DRY RUN - Sample Migration Results:');
    
    const sampleSize = Math.min(3, productsToMigrate.length);
    for (let i = 0; i < sampleSize; i++) {
      const product = productsToMigrate[i];
      const godownQty = product.stock?.godown || 0;
      const storeQty = product.stock?.store || 0;
      const totalQty = product.stock?.total || product.quantity || 0;
      
      // If stock structure doesn't exist, assume all stock is in godown
      const finalGodownQty = (godownQty + storeQty === 0 && totalQty > 0) ? totalQty : godownQty;
      const finalStoreQty = storeQty;

      console.log(`\n  Product: ${product.name}`);
      console.log(`    Current: godown=${godownQty}, store=${storeQty}, total=${totalQty}`);
      console.log(`    Will create batch with: godown=${finalGodownQty}, store=${finalStoreQty}`);
      console.log(`    Batch expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`);
    }

    console.log('\n⚠️  To proceed with actual migration, run: node migrate-stock-to-batches.js --execute');
    
  } catch (error) {
    console.error('Migration analysis error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

async function executeStockMigration() {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db');
    console.log('Connected to MongoDB');

    console.log('\n=== EXECUTING STOCK MIGRATION ===\n');

    // Get products to migrate
    const productsWithStock = await Product.find({
      $or: [
        { quantity: { $gt: 0 } },
        { 'stock.godown': { $gt: 0 } },
        { 'stock.store': { $gt: 0 } }
      ]
    }).session(session);

    const existingBatches = await ProductBatch.find({}).session(session);
    const productsWithBatches = new Set(existingBatches.map(b => b.productId.toString()));
    const productsToMigrate = productsWithStock.filter(p => !productsWithBatches.has(p._id.toString()));

    console.log(`Migrating ${productsToMigrate.length} products...`);

    let migratedCount = 0;
    let totalQuantityMigrated = 0;
    const migrationResults = [];

    for (const product of productsToMigrate) {
      try {
        const godownQty = product.stock?.godown || 0;
        const storeQty = product.stock?.store || 0;
        const totalQty = product.stock?.total || product.quantity || 0;
        
        // If no proper stock structure, assume all stock is in godown
        const finalGodownQty = (godownQty + storeQty === 0 && totalQty > 0) ? totalQty : godownQty;
        const finalStoreQty = storeQty;
        const finalTotalQty = finalGodownQty + finalStoreQty;

        if (finalTotalQty === 0) {
          console.log(`⏭️  Skipping ${product.name} - no stock to migrate`);
          continue;
        }

        // Create migration batch
        const migrationBatch = new ProductBatch({
          productId: product._id,
          shopId: product.shopId,
          batchNumber: `MIGRATION-${Date.now()}-${product._id.toString().slice(-6)}`,
          purchasePrice: product.price || 0,
          sellingPrice: product.price || 0,
          godownQty: finalGodownQty,
          storeQty: finalStoreQty,
          totalQty: finalTotalQty,
          originalQty: finalTotalQty,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          manufacturingDate: new Date(), // Today
          supplierName: 'Stock Migration',
          invoiceNumber: 'MIG-' + Date.now(),
          status: 'active',
          notes: 'Automatically created during migration from legacy stock system',
          createdBy: product.createdBy
        });

        await migrationBatch.save({ session });

        // Update product stock structure if needed
        if (!product.stock || typeof product.stock !== 'object') {
          product.stock = {
            godown: finalGodownQty,
            store: finalStoreQty,
            total: finalTotalQty,
            reserved: 0
          };
          product.quantity = finalTotalQty; // Keep legacy field in sync
          await product.save({ session });
        }

        // Create activity log
        const activityLog = new ActivityLog({
          action: 'STOCK_MIGRATION',
          productId: product._id,
          userId: product.createdBy,
          shopId: product.shopId,
          details: {
            type: 'migration',
            batchId: migrationBatch._id,
            originalQuantity: totalQty,
            migratedGodown: finalGodownQty,
            migratedStore: finalStoreQty,
            migrationDate: new Date()
          },
          change: 0, // No net change, just restructuring
          quantityBefore: totalQty,
          quantityAfter: finalTotalQty
        });

        await activityLog.save({ session });

        migrationResults.push({
          productName: product.name,
          productId: product._id,
          batchId: migrationBatch._id,
          originalQty: totalQty,
          migratedGodown: finalGodownQty,
          migratedStore: finalStoreQty,
          totalMigrated: finalTotalQty
        });

        migratedCount++;
        totalQuantityMigrated += finalTotalQty;

        console.log(`✅ ${product.name}: ${finalTotalQty} units (${finalGodownQty} godown, ${finalStoreQty} store)`);

      } catch (error) {
        console.error(`❌ Error migrating ${product.name}:`, error.message);
      }
    }

    await session.commitTransaction();

    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log(`📊 Migration Results:`);
    console.log(`  - Products migrated: ${migratedCount}`);
    console.log(`  - Total quantity migrated: ${totalQuantityMigrated}`);
    console.log(`  - Batches created: ${migratedCount}`);

    console.log('\n📋 Migration Summary:');
    migrationResults.forEach(result => {
      console.log(`  - ${result.productName}: ${result.totalMigrated} units`);
    });

    console.log('\n✅ Your existing stock has been successfully converted to the batch system!');
    console.log('🔄 The system now supports both legacy and batch-wise operations.');

    return migrationResults;

  } catch (error) {
    await session.abortTransaction();
    console.error('Migration execution error:', error);
    throw error;
  } finally {
    session.endSession();
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Check command line arguments
const args = process.argv.slice(2);
const shouldExecute = args.includes('--execute');

if (shouldExecute) {
  console.log('🚀 EXECUTING MIGRATION...\n');
  executeStockMigration().catch(console.error);
} else {
  console.log('🔍 MIGRATION ANALYSIS MODE...\n');
  migrateExistingStockToBatches().catch(console.error);
}
