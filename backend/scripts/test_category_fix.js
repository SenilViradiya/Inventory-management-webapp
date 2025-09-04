const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Category = require('../models/Category');
const Product = require('../models/Product');

async function testCategoryMatch() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Test the specific category from your example
    const categoryId = '68b2a9b9169596a1968d2fd1';
    const category = await Category.findById(categoryId);
    
    if (!category) {
      console.log('Category not found!');
      return;
    }
    
    console.log('\n=== CATEGORY INFO ===');
    console.log('ID:', category._id);
    console.log('Name:', category.name);
    
    // Search for products using the improved matching logic
    const searchCategoryIds = [category._id];
    const searchCategoryNames = [category.name];
    
    const categoryOrClauses = [
      { categoryId: { $in: searchCategoryIds } },
      { category: { $in: searchCategoryIds } },
      { category: { $in: searchCategoryNames } },
      { categoryName: { $in: searchCategoryNames } }
    ];
    
    const productQuery = { $or: categoryOrClauses };
    
    console.log('\n=== PRODUCT QUERY ===');
    console.log(JSON.stringify(productQuery, null, 2));
    
    const products = await Product.find(productQuery);
    
    console.log('\n=== RESULTS ===');
    console.log(`Found ${products.length} products`);
    
    if (products.length > 0) {
      console.log('\nFirst few products:');
      products.slice(0, 3).forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}`);
        console.log(`   categoryId: ${product.categoryId}`);
        console.log(`   category: ${product.category}`);
        console.log(`   categoryName: ${product.categoryName}`);
        console.log('');
      });
    }
    
    // Test with search term
    console.log('\n=== TESTING WITH SEARCH TERM "juice" ===');
    const searchTerm = 'juice';
    const regex = { $regex: new RegExp(searchTerm, 'i') };
    const searchQuery = {
      $and: [
        { $or: categoryOrClauses },
        { $or: [ { name: regex }, { brand: regex }, { qrCode: regex }, { categoryName: regex } ] }
      ]
    };
    
    const searchProducts = await Product.find(searchQuery);
    console.log(`Found ${searchProducts.length} products matching "juice"`);
    
    if (searchProducts.length > 0) {
      searchProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name} (category: ${product.category || product.categoryName})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testCategoryMatch();
