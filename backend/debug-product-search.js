const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Product = require('./models/Product');
const Category = require('./models/Category');

async function debugProductSearch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-db');
    console.log('Connected to MongoDB');

    console.log('\n=== DEBUGGING PRODUCT SEARCH ===\n');

    // 1. Check what categories exist
    console.log('1. Available Categories:');
    const categories = await Category.find({}).select('name _id');
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat._id})`);
    });

    // 2. Check for products that might match "Crisps & Chips"
    console.log('\n2. Searching for products with "Crisps" or "Chips":');
    
    const crispProducts = await Product.find({
      $or: [
        { name: { $regex: 'crisps', $options: 'i' } },
        { name: { $regex: 'chips', $options: 'i' } },
        { categoryName: { $regex: 'crisps', $options: 'i' } },
        { categoryName: { $regex: 'chips', $options: 'i' } }
      ]
    }).limit(10);

    console.log(`Found ${crispProducts.length} products matching "crisps" or "chips":`);
    crispProducts.forEach(product => {
      console.log(`  - ${product.name}`);
      console.log(`    Category: ${product.category}`);
      console.log(`    CategoryId: ${product.categoryId}`);
      console.log(`    CategoryName: ${product.categoryName}`);
      console.log(`    ----`);
    });

    // 3. Test the exact search query from the API
    console.log('\n3. Testing exact API search query:');
    
    // This mimics the current API logic
    const apiFilter = {
      category: 'Crisps & Chips' // This is what the API is currently doing
    };
    
    const searchFilter = {
      $or: [
        { name: { $regex: 'Crisps & Chips', $options: 'i' } },
        { qrCode: { $regex: 'Crisps & Chips', $options: 'i' } }
      ]
    };

    console.log('Current API filter (category):', apiFilter);
    const categoryResults = await Product.find(apiFilter);
    console.log(`Results with category filter: ${categoryResults.length}`);

    console.log('Current API filter (search):', searchFilter);
    const searchResults = await Product.find(searchFilter);
    console.log(`Results with search filter: ${searchResults.length}`);

    // 4. Test corrected filters
    console.log('\n4. Testing corrected filters:');
    
    const correctedFilter = {
      $or: [
        { categoryName: 'Crisps & Chips' },
        { categoryName: { $regex: 'Crisps.*Chips', $options: 'i' } },
        { name: { $regex: 'Crisps & Chips', $options: 'i' } }
      ]
    };

    console.log('Corrected filter:', JSON.stringify(correctedFilter, null, 2));
    const correctedResults = await Product.find(correctedFilter);
    console.log(`Results with corrected filter: ${correctedResults.length}`);

    if (correctedResults.length > 0) {
      console.log('Sample corrected results:');
      correctedResults.slice(0, 3).forEach(product => {
        console.log(`  - ${product.name} (Category: ${product.categoryName})`);
      });
    }

    // 5. Check what categoryNames actually exist
    console.log('\n5. Actual categoryName values in products:');
    const uniqueCategories = await Product.distinct('categoryName');
    console.log('Unique categoryName values:');
    uniqueCategories.forEach(cat => {
      console.log(`  - "${cat}"`);
    });

  } catch (error) {
    console.error('Error during search debug:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugProductSearch();
