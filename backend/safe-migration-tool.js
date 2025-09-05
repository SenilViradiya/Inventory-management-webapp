const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const ProductBatch = require('./models/ProductBatch');
const ActivityLog = require('./models/ActivityLog');
const Category = require('./models/Category');
const User = require('./models/User');
const Shop = require('./models/Shop');

async function createBackupDatabase() {
  try {
    console.log('\n=== CREATING BACKUP DATABASE FOR MIGRATION TESTING ===\n');

    // Original database connection
    const originalDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db';
    const backupDB = originalDB.replace('/inventory-db', '/inventory-migration-test');
    
    console.log(`📂 Original Database: ${originalDB}`);
    console.log(`💾 Backup Database: ${backupDB}`);

    // Connect to original database
    console.log('\n1️⃣ Connecting to original database...');
    await mongoose.connect(originalDB);
    console.log('✅ Connected to original database');

    // Get data counts from original database
    const originalCounts = {
      products: await Product.countDocuments(),
      batches: await ProductBatch.countDocuments(),
      activities: await ActivityLog.countDocuments(),
      categories: await Category.countDocuments(),
      users: await User.countDocuments(),
      shops: await Shop.countDocuments()
    };

    console.log('\n📊 Original Database Statistics:');
    Object.entries(originalCounts).forEach(([collection, count]) => {
      console.log(`  - ${collection}: ${count} documents`);
    });

    // Export data from original database
    console.log('\n2️⃣ Exporting data from original database...');
    const exportData = {
      products: await Product.find({}).lean(),
      batches: await ProductBatch.find({}).lean(),
      activities: await ActivityLog.find({}).lean(),
      categories: await Category.find({}).lean(),
      users: await User.find({}).lean(),
      shops: await Shop.find({}).lean()
    };

    console.log('✅ Data exported successfully');

    // Disconnect from original database
    await mongoose.disconnect();
    console.log('🔌 Disconnected from original database');

    // Connect to backup database
    console.log('\n3️⃣ Connecting to backup database...');
    await mongoose.connect(backupDB);
    console.log('✅ Connected to backup database');

    // Clear backup database (in case it exists)
    console.log('\n4️⃣ Clearing backup database...');
    await Product.deleteMany({});
    await ProductBatch.deleteMany({});
    await ActivityLog.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    await Shop.deleteMany({});
    console.log('✅ Backup database cleared');

    // Import data to backup database
    console.log('\n5️⃣ Importing data to backup database...');
    
    // Import in dependency order (users and shops first, then categories, then products, etc.)
    if (exportData.users.length > 0) {
      await User.insertMany(exportData.users);
      console.log(`  ✅ Imported ${exportData.users.length} users`);
    }

    if (exportData.shops.length > 0) {
      await Shop.insertMany(exportData.shops);
      console.log(`  ✅ Imported ${exportData.shops.length} shops`);
    }

    if (exportData.categories.length > 0) {
      await Category.insertMany(exportData.categories);
      console.log(`  ✅ Imported ${exportData.categories.length} categories`);
    }

    if (exportData.products.length > 0) {
      await Product.insertMany(exportData.products);
      console.log(`  ✅ Imported ${exportData.products.length} products`);
    }

    if (exportData.batches.length > 0) {
      await ProductBatch.insertMany(exportData.batches);
      console.log(`  ✅ Imported ${exportData.batches.length} batches`);
    }

    if (exportData.activities.length > 0) {
      await ActivityLog.insertMany(exportData.activities);
      console.log(`  ✅ Imported ${exportData.activities.length} activities`);
    }

    // Verify backup database
    console.log('\n6️⃣ Verifying backup database...');
    const backupCounts = {
      products: await Product.countDocuments(),
      batches: await ProductBatch.countDocuments(),
      activities: await ActivityLog.countDocuments(),
      categories: await Category.countDocuments(),
      users: await User.countDocuments(),
      shops: await Shop.countDocuments()
    };

    console.log('\n📊 Backup Database Statistics:');
    Object.entries(backupCounts).forEach(([collection, count]) => {
      console.log(`  - ${collection}: ${count} documents`);
    });

    // Verify data integrity
    console.log('\n🔍 Data Integrity Check:');
    let allMatch = true;
    Object.entries(originalCounts).forEach(([collection, originalCount]) => {
      const backupCount = backupCounts[collection];
      const match = originalCount === backupCount;
      console.log(`  - ${collection}: ${match ? '✅' : '❌'} (${originalCount} → ${backupCount})`);
      if (!match) allMatch = false;
    });

    if (allMatch) {
      console.log('\n🎉 BACKUP CREATED SUCCESSFULLY!');
      console.log('\n📋 Next Steps:');
      console.log('1. Update .env file to point to backup database:');
      console.log(`   MONGODB_URI=${backupDB}`);
      console.log('2. Run migration test: node migrate-stock-to-batches.js');
      console.log('3. Test APIs with migrated data');
      console.log('4. Once satisfied, apply to production database');
      
      console.log('\n⚠️  Environment Setup:');
      console.log('To test with backup database, create a .env.backup file:');
      console.log(`MONGODB_URI=${backupDB}`);
      console.log('PORT=5002  # Use different port');
      console.log('NODE_ENV=testing');
      
      console.log('\nThen run: cp .env.backup .env && npm run dev');
    } else {
      console.log('\n❌ BACKUP VERIFICATION FAILED!');
      console.log('Some data counts do not match. Please check the migration process.');
    }

  } catch (error) {
    console.error('Backup creation error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Function to run migration test on backup database
async function testMigrationOnBackup() {
  try {
    const backupDB = (process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db').replace('/inventory-db', '/inventory-migration-test');
    
    console.log('\n=== TESTING MIGRATION ON BACKUP DATABASE ===\n');
    console.log(`🔗 Using backup database: ${backupDB}`);

    await mongoose.connect(backupDB);
    console.log('✅ Connected to backup database');

    // Run pre-migration analysis
    console.log('\n📊 Pre-Migration Analysis:');
    const preProducts = await Product.countDocuments();
    const preBatches = await ProductBatch.countDocuments();
    const preActivities = await ActivityLog.countDocuments();
    
    const productsWithStock = await Product.find({
      $or: [
        { quantity: { $gt: 0 } },
        { 'stock.godown': { $gt: 0 } },
        { 'stock.store': { $gt: 0 } }
      ]
    });

    const existingBatchedProducts = await ProductBatch.distinct('productId');
    const productsNeedingMigration = productsWithStock.filter(p => 
      !existingBatchedProducts.includes(p._id.toString())
    );

    console.log(`  - Total products: ${preProducts}`);
    console.log(`  - Products with stock: ${productsWithStock.length}`);
    console.log(`  - Existing batches: ${preBatches}`);
    console.log(`  - Products needing migration: ${productsNeedingMigration.length}`);

    if (productsNeedingMigration.length === 0) {
      console.log('\n✅ No migration needed - all products already have batch data');
      return;
    }

    // Calculate migration impact
    let totalQuantity = 0;
    let totalValue = 0;
    
    productsNeedingMigration.forEach(product => {
      const qty = Math.max(product.quantity || 0, product.stock?.total || 0);
      const value = qty * (product.price || 0);
      totalQuantity += qty;
      totalValue += value;
    });

    console.log(`\n💰 Migration Impact:`);
    console.log(`  - Quantity to migrate: ${totalQuantity.toLocaleString()}`);
    console.log(`  - Value to migrate: $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

    console.log('\n⚠️  This is a SAFE TEST on backup data');
    console.log('Ready to proceed with migration test? The process will:');
    console.log('1. Create migration batches for each product');
    console.log('2. Update stock structures');
    console.log('3. Create activity logs');
    console.log('4. Verify data integrity');

    return {
      preStats: { products: preProducts, batches: preBatches, activities: preActivities },
      migrationNeeded: productsNeedingMigration.length,
      totalQuantity,
      totalValue
    };

  } catch (error) {
    console.error('Migration test preparation error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from backup database');
  }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--create-backup')) {
  createBackupDatabase().catch(console.error);
} else if (args.includes('--test-migration')) {
  testMigrationOnBackup().catch(console.error);
} else {
  console.log('\n🛡️  SAFE MIGRATION TESTING TOOL\n');
  console.log('Available commands:');
  console.log('  --create-backup     Create backup database with current data');
  console.log('  --test-migration    Test migration process on backup database');
  console.log('\nUsage:');
  console.log('  node migrate-stock-to-batches.js --create-backup');
  console.log('  node migrate-stock-to-batches.js --test-migration');
  console.log('\n💡 Recommended workflow:');
  console.log('1. Create backup database');
  console.log('2. Update .env to point to backup');
  console.log('3. Test migration on backup');
  console.log('4. Validate results');
  console.log('5. Apply to production when ready');
}
