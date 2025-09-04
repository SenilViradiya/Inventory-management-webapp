const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product = require('./models/Product');
require('dotenv').config();

async function testStockSummary() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test query for "Household Items" category
    const categoryId = '68b2a9b9169596a1968d2fd1';
    const categoryName = 'Household Items';
    
    console.log(`\n=== Testing Stock Summary for Category: ${categoryName} (${categoryId}) ===`);
    
    // Find the category
    const category = await Category.findById(categoryId);
    console.log('Category found:', category ? { id: category._id, name: category.name } : 'NOT FOUND');
    
    if (category) {
      // Test product queries
      console.log('\n--- Testing Product Queries ---');
      
      // Build search arrays
      const searchCategoryIds = [category._id];
      const searchCategoryNames = [category.name];
      
      console.log('Search Category IDs:', searchCategoryIds);
      console.log('Search Category Names:', searchCategoryNames);
      
      // Build query clauses
      const categoryOrClauses = [
        { categoryId: { $in: searchCategoryIds } },
        { category: { $in: searchCategoryIds } },
        { category: { $in: searchCategoryNames } },
        { categoryName: { $in: searchCategoryNames } }
      ];
      
      console.log('\nCategory OR Clauses:', JSON.stringify(categoryOrClauses, null, 2));
      
      // Test different product queries
      console.log('\n--- Query 1: All products matching category ---');
      const allProducts = await Product.find({ $or: categoryOrClauses });
      console.log(`Found ${allProducts.length} products`);
      
      if (allProducts.length > 0) {
        console.log('Sample products:');
        allProducts.slice(0, 3).forEach(p => {
          console.log({
            id: p._id,
            name: p.name,
            category: p.category,
            categoryId: p.categoryId,
            categoryName: p.categoryName,
            stock: p.stock || { total: p.quantity }
          });
        });
      }
      
      console.log('\n--- Query 2: Products with search term "juice" ---');
      const searchTerm = 'juice';
      const regex = { $regex: new RegExp(searchTerm, 'i') };
      const searchQuery = {
        $and: [
          { $or: categoryOrClauses },
          { $or: [ { name: regex }, { brand: regex }, { qrCode: regex }, { categoryName: regex } ] }
        ]
      };
      
      console.log('Search Query:', JSON.stringify(searchQuery, null, 2));
      const searchProducts = await Product.find(searchQuery);
      console.log(`Found ${searchProducts.length} products matching "juice"`);
      
      if (searchProducts.length > 0) {
        console.log('Matching products:');
        searchProducts.forEach(p => {
          console.log({
            id: p._id,
            name: p.name,
            category: p.category,
            categoryName: p.categoryName,
            stock: p.stock || { total: p.quantity }
          });
        });
      }
      
      console.log('\n--- Query 3: All products with "juice" anywhere ---');
      const allJuiceProducts = await Product.find({
        $or: [ { name: regex }, { brand: regex }, { qrCode: regex }, { categoryName: regex } ]
      });
      console.log(`Found ${allJuiceProducts.length} total products with "juice"`);
      
      if (allJuiceProducts.length > 0) {
        console.log('All juice products:');
        allJuiceProducts.slice(0, 5).forEach(p => {
          console.log({
            id: p._id,
            name: p.name,
            category: p.category,
            categoryName: p.categoryName,
            stock: p.stock || { total: p.quantity }
          });
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testStockSummary();
