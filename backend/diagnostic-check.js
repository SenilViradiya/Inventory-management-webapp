const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Product = require('./models/Product');
const ActivityLog = require('./models/ActivityLog');

async function diagnosticCheck() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db');
    console.log('Connected to MongoDB');

    console.log('\n=== DIAGNOSTIC CHECK ===\n');

    // 1. Check Products
    const totalProducts = await Product.countDocuments({});
    console.log(`📦 Total Products: ${totalProducts}`);

    if (totalProducts > 0) {
      const sampleProducts = await Product.find({}).limit(3);
      console.log('\n📋 Sample Products:');
      sampleProducts.forEach(product => {
        console.log(`  - ${product.name}: Qty=${product.quantity}, Price=${product.price}, Category=${product.category}`);
      });

      const productStats = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$quantity' },
            totalValue: { $sum: { $multiply: ['$quantity', '$price'] } },
            avgPrice: { $avg: '$price' }
          }
        }
      ]);
      console.log('\n📊 Product Stats:');
      console.log(`  - Total Quantity: ${productStats[0]?.totalQuantity || 0}`);
      console.log(`  - Total Value: $${productStats[0]?.totalValue?.toFixed(2) || 0}`);
      console.log(`  - Average Price: $${productStats[0]?.avgPrice?.toFixed(2) || 0}`);
    }

    // 2. Check Activity Logs
    const totalActivities = await ActivityLog.countDocuments({});
    console.log(`\n📝 Total Activity Logs: ${totalActivities}`);

    if (totalActivities > 0) {
      const actionTypes = await ActivityLog.aggregate([
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);
      console.log('\n🎯 Activity Types:');
      actionTypes.forEach(action => {
        console.log(`  - ${action._id}: ${action.count} times`);
      });

      // Recent activities
      const recentActivities = await ActivityLog.find({})
        .populate('productId', 'name')
        .sort({ createdAt: -1 })
        .limit(5);
      
      console.log('\n🕒 Recent Activities:');
      recentActivities.forEach(activity => {
        console.log(`  - ${activity.action} | Product: ${activity.productId?.name || 'Unknown'} | Change: ${activity.change} | Date: ${activity.createdAt.toISOString()}`);
      });

      // Check date range of activities
      const dateRange = await ActivityLog.aggregate([
        {
          $group: {
            _id: null,
            earliest: { $min: '$createdAt' },
            latest: { $max: '$createdAt' }
          }
        }
      ]);
      console.log('\n📅 Activity Date Range:');
      console.log(`  - Earliest: ${dateRange[0]?.earliest?.toISOString() || 'None'}`);
      console.log(`  - Latest: ${dateRange[0]?.latest?.toISOString() || 'None'}`);
    }

    // 3. Check what the dashboard query actually returns
    console.log('\n🔍 Dashboard Query Test:');
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    console.log(`  - Query Date Range: ${yesterday.toISOString()} to ${now.toISOString()}`);

    const stockMovements = await ActivityLog.aggregate([
      {
        $match: {
          createdAt: { $gte: yesterday, $lte: now }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          totalChange: { $sum: '$change' }
        }
      }
    ]);

    console.log('\n📈 Stock Movements (Last 24h):');
    if (stockMovements.length === 0) {
      console.log('  - No movements found in the last 24 hours');
    } else {
      stockMovements.forEach(movement => {
        console.log(`  - ${movement._id}: ${movement.count} activities, Total Change: ${movement.totalChange}`);
      });
    }

    // 4. Check for specific issues
    console.log('\n🔧 Potential Issues:');
    
    // Check for activities without product references
    const activitiesWithoutProducts = await ActivityLog.countDocuments({
      productId: { $exists: false }
    });
    console.log(`  - Activities without productId: ${activitiesWithoutProducts}`);

    // Check for products with zero or negative quantity
    const zeroQuantityProducts = await Product.countDocuments({ quantity: { $lte: 0 } });
    console.log(`  - Products with zero/negative quantity: ${zeroQuantityProducts}`);

    // Check for activities with reversed flag
    const reversedActivities = await ActivityLog.countDocuments({ reversed: true });
    console.log(`  - Reversed activities: ${reversedActivities}`);

  } catch (error) {
    console.error('Error during diagnostic check:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

diagnosticCheck();
