const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const ProductBatch = require('./models/ProductBatch');
const ActivityLog = require('./models/ActivityLog');

class SafeBatchMigration {
  constructor() {
    this.migrationStats = {
      totalProducts: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      totalQuantityMigrated: 0,
      totalValueMigrated: 0,
      errors: []
    };
  }

  async analyzeCurrentStock() {
    console.log('\n=== STOCK ANALYSIS FOR BATCH MIGRATION ===\n');

    // 1. Get all products with stock
    const allProducts = await Product.find({});
    console.log(`📦 Total Products: ${allProducts.length}`);

    // 2. Filter products that need migration
    const existingBatches = await ProductBatch.find({});
    const productsWithBatches = new Set(existingBatches.map(b => b.productId.toString()));

    const productsWithStock = allProducts.filter(product => {
      const hasLegacyStock = (product.quantity || 0) > 0;
      const hasNewStock = (product.stock?.total || 0) > 0;
      const hasBatches = productsWithBatches.has(product._id.toString());
      
      return (hasLegacyStock || hasNewStock) && !hasBatches;
    });

    console.log(`🔍 Products Analysis:`);
    console.log(`  - Total products: ${allProducts.length}`);
    console.log(`  - Products with existing batches: ${productsWithBatches.size}`);
    console.log(`  - Products needing batch migration: ${productsWithStock.length}`);

    // 3. Categorize products by stock structure
    const categories = {
      legacyOnly: [],
      newStructure: [],
      bothStructures: [],
      noStock: []
    };

    productsWithStock.forEach(product => {
      const legacyQty = product.quantity || 0;
      const newQty = product.stock?.total || 0;

      if (legacyQty > 0 && newQty === 0) {
        categories.legacyOnly.push(product);
      } else if (legacyQty === 0 && newQty > 0) {
        categories.newStructure.push(product);
      } else if (legacyQty > 0 && newQty > 0) {
        categories.bothStructures.push(product);
      } else {
        categories.noStock.push(product);
      }
    });

    console.log(`\n📊 Stock Structure Breakdown:`);
    console.log(`  - Legacy quantity only: ${categories.legacyOnly.length}`);
    console.log(`  - New stock structure only: ${categories.newStructure.length}`);
    console.log(`  - Both structures: ${categories.bothStructures.length}`);
    console.log(`  - No stock: ${categories.noStock.length}`);

    // 4. Show sample data for each category
    this.showSampleData(categories);

    // 5. Calculate migration impact
    const migrationImpact = this.calculateMigrationImpact(productsWithStock);
    console.log('\n💰 Migration Impact:');
    console.log(`  - Products to migrate: ${migrationImpact.productCount}`);
    console.log(`  - Total quantity: ${migrationImpact.totalQuantity.toLocaleString()}`);
    console.log(`  - Total value: $${migrationImpact.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

    this.migrationStats.totalProducts = productsWithStock.length;
    return { productsWithStock, categories, migrationImpact };
  }

  showSampleData(categories) {
    const sampleSize = 3;

    if (categories.legacyOnly.length > 0) {
      console.log(`\n🔧 Legacy Structure Only (first ${Math.min(sampleSize, categories.legacyOnly.length)}):`);
      categories.legacyOnly.slice(0, sampleSize).forEach(p => {
        console.log(`  - ${p.name}: quantity=${p.quantity}, stock=${JSON.stringify(p.stock || 'undefined')}`);
      });
    }

    if (categories.newStructure.length > 0) {
      console.log(`\n🆕 New Structure Only (first ${Math.min(sampleSize, categories.newStructure.length)}):`);
      categories.newStructure.slice(0, sampleSize).forEach(p => {
        console.log(`  - ${p.name}: quantity=${p.quantity || 0}, stock=${JSON.stringify(p.stock)}`);
      });
    }

    if (categories.bothStructures.length > 0) {
      console.log(`\n⚠️  Both Structures (first ${Math.min(sampleSize, categories.bothStructures.length)}):`);
      categories.bothStructures.slice(0, sampleSize).forEach(p => {
        console.log(`  - ${p.name}: quantity=${p.quantity}, stock=${JSON.stringify(p.stock)}`);
      });
    }
  }

  calculateMigrationImpact(products) {
    const impact = {
      productCount: products.length,
      totalQuantity: 0,
      totalValue: 0,
      categories: {}
    };

    products.forEach(product => {
      const effectiveQty = this.getEffectiveQuantity(product);
      const value = effectiveQty * (product.price || 0);
      
      impact.totalQuantity += effectiveQty;
      impact.totalValue += value;
      
      const category = product.categoryName || product.category || 'Uncategorized';
      if (!impact.categories[category]) {
        impact.categories[category] = { count: 0, quantity: 0, value: 0 };
      }
      impact.categories[category].count++;
      impact.categories[category].quantity += effectiveQty;
      impact.categories[category].value += value;
    });

    return impact;
  }

  getEffectiveQuantity(product) {
    const legacyQty = product.quantity || 0;
    const newQty = product.stock?.total || 0;
    
    // If both exist, use the higher value (safest approach)
    // If only one exists, use that value
    return Math.max(legacyQty, newQty);
  }

  getStockDistribution(product) {
    const effectiveQty = this.getEffectiveQuantity(product);
    
    // If product has new stock structure, use it
    if (product.stock && typeof product.stock === 'object') {
      return {
        godownQty: product.stock.godown || 0,
        storeQty: product.stock.store || 0,
        totalQty: effectiveQty
      };
    }
    
    // If only legacy quantity exists, assume all stock is in godown
    return {
      godownQty: effectiveQty,
      storeQty: 0,
      totalQty: effectiveQty
    };
  }

  async createBatchForProduct(product, session) {
    try {
      const stockDistribution = this.getStockDistribution(product);
      
      if (stockDistribution.totalQty === 0) {
        return { success: true, message: 'No stock to migrate', batch: null };
      }

      // Create migration batch
      const batchData = {
        productId: product._id,
        shopId: product.shopId,
        batchNumber: `MIG-${Date.now()}-${product._id.toString().slice(-6)}`,
        purchasePrice: product.costPrice || product.price || 0,
        sellingPrice: product.price || 0,
        godownQty: stockDistribution.godownQty,
        storeQty: stockDistribution.storeQty,
        totalQty: stockDistribution.totalQty,
        originalQty: stockDistribution.totalQty,
        expiryDate: product.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
        manufacturingDate: new Date(),
        supplierName: 'Stock Migration',
        invoiceNumber: `MIG-${Date.now()}`,
        status: 'active',
        notes: `Migrated from legacy stock system. Original quantity: ${product.quantity || 0}, Original stock: ${JSON.stringify(product.stock || {})}`,
        createdBy: product.createdBy
      };

      const batch = new ProductBatch(batchData);
      await batch.save({ session });

      // Update product stock structure to ensure consistency
      if (!product.stock || typeof product.stock !== 'object') {
        product.stock = {
          godown: stockDistribution.godownQty,
          store: stockDistribution.storeQty,
          total: stockDistribution.totalQty,
          reserved: 0
        };
      }
      
      // Keep legacy quantity field in sync
      product.quantity = stockDistribution.totalQty;
      await product.save({ session });

      // Create activity log
      const activityLog = new ActivityLog({
        action: 'STOCK_MIGRATION_TO_BATCH',
        productId: product._id,
        userId: product.createdBy,
        shopId: product.shopId,
        details: {
          type: 'batch_migration',
          batchId: batch._id,
          originalQuantity: product.quantity,
          migratedGodown: stockDistribution.godownQty,
          migratedStore: stockDistribution.storeQty,
          migrationTimestamp: new Date(),
          batchNumber: batch.batchNumber
        },
        change: 0, // No net change, just restructuring
        quantityBefore: this.getEffectiveQuantity(product),
        quantityAfter: stockDistribution.totalQty
      });

      await activityLog.save({ session });

      return {
        success: true,
        message: 'Batch created successfully',
        batch: {
          id: batch._id,
          batchNumber: batch.batchNumber,
          godownQty: batch.godownQty,
          storeQty: batch.storeQty,
          totalQty: batch.totalQty
        }
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
        batch: null
      };
    }
  }

  async executeBatchMigration(products, batchSize = 10) {
    console.log('\n🚀 EXECUTING BATCH MIGRATION\n');
    console.log(`📋 Migration Settings:`);
    console.log(`  - Products to migrate: ${products.length}`);
    console.log(`  - Batch size: ${batchSize}`);
    console.log(`  - Database: ${process.env.MONGODB_URI?.split('/').pop()}`);

    const totalBatches = Math.ceil(products.length / batchSize);
    console.log(`  - Total batches: ${totalBatches}\n`);

    for (let i = 0; i < products.length; i += batchSize) {
      const currentBatch = Math.floor(i / batchSize) + 1;
      const batch = products.slice(i, i + batchSize);
      
      console.log(`📦 Processing Batch ${currentBatch}/${totalBatches} (${batch.length} products)...`);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const batchResults = [];

        for (const product of batch) {
          this.migrationStats.processed++;
          
          const result = await this.createBatchForProduct(product, session);
          
          if (result.success) {
            this.migrationStats.successful++;
            if (result.batch) {
              this.migrationStats.totalQuantityMigrated += result.batch.totalQty;
              this.migrationStats.totalValueMigrated += result.batch.totalQty * (product.price || 0);
            }
            console.log(`  ✅ ${product.name}: ${result.batch?.totalQty || 0} units`);
          } else {
            this.migrationStats.failed++;
            this.migrationStats.errors.push({
              productName: product.name,
              productId: product._id,
              error: result.message
            });
            console.log(`  ❌ ${product.name}: ${result.message}`);
          }

          batchResults.push({
            productName: product.name,
            result
          });
        }

        await session.commitTransaction();
        console.log(`✅ Batch ${currentBatch} completed successfully\n`);

        // Add a small delay between batches to avoid overwhelming the database
        if (currentBatch < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        await session.abortTransaction();
        console.error(`❌ Batch ${currentBatch} failed:`, error.message);
        
        // Add failed products to error list
        batch.forEach(product => {
          this.migrationStats.failed++;
          this.migrationStats.errors.push({
            productName: product.name,
            productId: product._id,
            error: `Batch transaction failed: ${error.message}`
          });
        });
      } finally {
        session.endSession();
      }
    }

    this.printMigrationSummary();
  }

  printMigrationSummary() {
    console.log('\n🎉 MIGRATION COMPLETED!\n');
    console.log('📊 Migration Statistics:');
    console.log(`  - Total products: ${this.migrationStats.totalProducts}`);
    console.log(`  - Processed: ${this.migrationStats.processed}`);
    console.log(`  - Successful: ${this.migrationStats.successful}`);
    console.log(`  - Failed: ${this.migrationStats.failed}`);
    console.log(`  - Success rate: ${((this.migrationStats.successful / this.migrationStats.processed) * 100).toFixed(2)}%`);
    
    console.log('\n💰 Migrated Stock:');
    console.log(`  - Total quantity: ${this.migrationStats.totalQuantityMigrated.toLocaleString()}`);
    console.log(`  - Total value: $${this.migrationStats.totalValueMigrated.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

    if (this.migrationStats.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.migrationStats.errors.forEach(error => {
        console.log(`  - ${error.productName}: ${error.error}`);
      });
    }

    console.log('\n✅ Next Steps:');
    console.log('1. Verify the migration results');
    console.log('2. Run stock consistency checks');
    console.log('3. Test batch-wise operations');
    console.log('4. Update your application to use the new batch system');
  }
}

async function runSafeMigration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`🔗 Connected to: ${process.env.MONGODB_URI?.split('/').pop()}`);

    const migration = new SafeBatchMigration();

    // Check command line arguments
    const args = process.argv.slice(2);
    const shouldExecute = args.includes('--execute');
    const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 10;

    if (!shouldExecute) {
      console.log('🔍 RUNNING ANALYSIS MODE (use --execute to run actual migration)');
      await migration.analyzeCurrentStock();
      console.log('\n💡 To execute migration, run:');
      console.log('node batch-migration-tool.js --execute');
      console.log('node batch-migration-tool.js --execute --batch-size=5  (for smaller batches)');
    } else {
      console.log('🚀 RUNNING MIGRATION MODE');
      const { productsWithStock } = await migration.analyzeCurrentStock();
      
      if (productsWithStock.length === 0) {
        console.log('✅ No products need migration. All products already have batch data or no stock.');
        return;
      }

      console.log('\n⚠️  SAFETY CONFIRMATION ⚠️');
      console.log(`Database: ${process.env.MONGODB_URI?.split('/').pop()}`);
      console.log(`Products to migrate: ${productsWithStock.length}`);
      console.log('\nProceeding with migration in 3 seconds...');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await migration.executeBatchMigration(productsWithStock, batchSize);
    }

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the migration
runSafeMigration();
