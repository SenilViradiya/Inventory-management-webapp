const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function generateTestToken() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management');
    console.log('Connected to MongoDB');

    // Find a user to generate token for
    const user = await User.findOne();
    if (!user) {
      console.log('No user found. Please create a user first.');
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        username: user.username,
        email: user.email 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('🔑 Generated Test Token:');
    console.log(token);
    
    console.log('\n👤 User Details:');
    console.log('ID:', user._id);
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    
    console.log('\n🧪 Test API Calls with Token:');
    console.log(`export TOKEN="${token}"`);
    console.log('\n1. Get Stock Summary:');
    console.log('curl -X GET "http://localhost:5001/api/stock/summary" -H "Authorization: Bearer $TOKEN"');
    
    console.log('\n2. Get all products:');
    console.log('curl -X GET "http://localhost:5001/api/products" -H "Authorization: Bearer $TOKEN"');

    // Get a product ID for testing stock movements
    const product = await Product.findOne();
    if (product) {
      console.log('\n3. Move stock from godown to store:');
      console.log(`curl -X POST "http://localhost:5001/api/stock/move-to-store" \\`);
      console.log('  -H "Authorization: Bearer $TOKEN" \\');
      console.log('  -H "Content-Type: application/json" \\');
      console.log(`  -d '{`);
      console.log(`    "productId": "${product._id}",`);
      console.log(`    "quantity": 5,`);
      console.log(`    "reason": "Store restocking"`);
      console.log(`  }'`);
      
      console.log('\n4. Get stock movement history:');
      console.log(`curl -X GET "http://localhost:5001/api/stock/movement-history/${product._id}" -H "Authorization: Bearer $TOKEN"`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

generateTestToken();
