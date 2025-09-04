const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Product = require('./models/Product');
const ActivityLog = require('./models/ActivityLog');

async function fixAnalyticsIssues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db');
    console.log('Connected to MongoDB');

    console.log('\n=== FIXING ANALYTICS ISSUES ===\n');

    // 1. Check and fix product categories
    console.log('1. Checking Product Categories...');
    const productsWithoutCategory = await Product.find({ 
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: undefined }
      ]
    }).limit(5);

    console.log(`Found ${productsWithoutCategory.length} products without proper categories`);
    
    if (productsWithoutCategory.length > 0) {
      console.log('Sample products without categories:');
      productsWithoutCategory.forEach(product => {
        console.log(`  - ${product.name}: category=${product.category}, categoryId=${product.categoryId}, categoryName=${product.categoryName}`);
      });
    }

    // 2. Check REDUCE_STOCK activities in detail
    console.log('\n2. Analyzing REDUCE_STOCK Activities...');
    const reduceStockActivities = await ActivityLog.find({ 
      action: 'REDUCE_STOCK' 
    })
    .populate('productId', 'name price')
    .sort({ createdAt: -1 })
    .limit(10);

    console.log(`Found ${reduceStockActivities.length} REDUCE_STOCK activities`);
    reduceStockActivities.forEach(activity => {
      console.log(`  - Product: ${activity.productId?.name || 'Missing'}`);
      console.log(`    Change: ${activity.change}`);
      console.log(`    Quantity Before: ${activity.quantityBefore}`);
      console.log(`    Quantity After: ${activity.quantityAfter}`);
      console.log(`    Created: ${activity.createdAt}`);
      console.log(`    ----`);
    });

    // 3. Check STOCK_MOVEMENT activities
    console.log('\n3. Analyzing STOCK_MOVEMENT Activities...');
    const stockMovements = await ActivityLog.find({ 
      action: 'STOCK_MOVEMENT',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
    .populate('productId', 'name price')
    .sort({ createdAt: -1 });

    console.log(`Found ${stockMovements.length} recent STOCK_MOVEMENT activities`);
    stockMovements.forEach(activity => {
      console.log(`  - Product: ${activity.productId?.name || 'Missing'}`);
      console.log(`    Change: ${activity.change}`);
      console.log(`    Type: ${activity.details?.type || 'Unknown'}`);
      console.log(`    Created: ${activity.createdAt}`);
      console.log(`    ----`);
    });

    // 4. Test correct analytics calculation
    console.log('\n4. Testing Corrected Analytics Logic...');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    console.log(`Date range: ${yesterday.toISOString()} to ${today.toISOString()}`);

    // Test with corrected logic for sales calculation
    const salesData = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ['REDUCE_STOCK', 'STOCK_MOVEMENT'] },
          createdAt: { $gte: yesterday, $lte: today },
          $or: [
            { change: { $lt: 0 } }, // Negative change means stock reduction
            { 'details.type': 'store_out' }
          ]
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: {
          path: '$product',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          quantityReduced: {
            $cond: {
              if: { $eq: ['$action', 'STOCK_MOVEMENT'] },
              then: { $abs: '$change' },
              else: {
                $cond: {
                  if: { $and: [{ $ne: ['$quantityBefore', null] }, { $ne: ['$quantityAfter', null] }] },
                  then: { $subtract: ['$quantityBefore', '$quantityAfter'] },
                  else: { $abs: '$change' }
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalQty: { $sum: '$quantityReduced' },
          totalRevenue: { $sum: { $multiply: ['$quantityReduced', { $ifNull: ['$product.price', 0] }] } },
          transactions: { $sum: 1 }
        }
      }
    ]);

    console.log('Corrected Sales Calculation:');
    if (salesData.length > 0) {
      console.log(`  - Total Quantity Sold: ${salesData[0].totalQty}`);
      console.log(`  - Total Revenue: $${salesData[0].totalRevenue?.toFixed(2) || 0}`);
      console.log(`  - Total Transactions: ${salesData[0].transactions}`);
    } else {
      console.log('  - No sales data found with corrected logic');
    }

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

fixAnalyticsIssues();
