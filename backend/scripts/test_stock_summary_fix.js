const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');

async function testProductQuery() {
  try {
    // Connect to MongoDB (using the same connection as the main app)
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://senilv:senilv123@cluster0.ysm2eig.mongodb.net/inventory_management?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    
    console.log('Connected to MongoDB');

    // Test the specific query that was failing
    const categoryId = '68b2a9b9169596a1968d2fd1'; // Household Items
    const category = await Category.findById(categoryId);
    
    if (!category) {
      console.log('Category not found');
      return;
    }
    
    console.log('Found category:', {
      id: category._id,
      name: category.name,
      description: category.description
    });

    // Test the new product query logic (without shop filter)
    const searchCategoryIds = [category._id];
    const searchCategoryNames = [category.name];

    const categoryOrClauses = [
      { categoryId: { $in: searchCategoryIds } },
      { category: { $in: searchCategoryIds } },
      { category: { $in: searchCategoryNames } },
      { categoryName: { $in: searchCategoryNames } }
    ];

    const productQuery = { $or: categoryOrClauses };

    console.log('\nProduct Query:', JSON.stringify(productQuery, null, 2));

    const products = await Product.find(productQuery).limit(5);
    console.log(`\nFound ${products.length} products:`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   CategoryId: ${product.categoryId}`);
      console.log(`   CategoryName: ${product.categoryName}`);
      console.log(`   Stock: ${product.stock?.total || product.quantity || 0}`);
      console.log('');
    });

    // Test with search term
    console.log('\n--- Testing with search term "juice" ---');
    const searchTerm = 'juice';
    const regex = { $regex: new RegExp(searchTerm, 'i') };
    const searchQuery = {
      $and: [
        { $or: categoryOrClauses },
        { $or: [ { name: regex }, { brand: regex }, { qrCode: regex }, { categoryName: regex } ] }
      ]
    };

    console.log('Search Query:', JSON.stringify(searchQuery, null, 2));
    const searchProducts = await Product.find(searchQuery).limit(5);
    console.log(`Found ${searchProducts.length} products with search term "${searchTerm}"`);
    
    searchProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   CategoryId: ${product.categoryId}`);
      console.log(`   CategoryName: ${product.categoryName}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testProductQuery();
