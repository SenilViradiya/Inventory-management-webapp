#!/usr/bin/env node

/**
 * Test script to verify database connection using environment variables
 * Run this script to test if your database connection is working correctly
 *
 * Usage: node scripts/test-db-connection.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

console.log('🔍 Testing Database Connection...');
console.log('📝 Environment Variables:');
console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Not set'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log('');

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management';

console.log(`🔗 Connecting to: ${dbUri}`);

mongoose.connect(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully!');
  console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
  console.log(`🌐 Host: ${mongoose.connection.host}`);
  return mongoose.connection.close();
})
.then(() => {
  console.log('🔌 Connection closed successfully');
  console.log('');
  console.log('🎉 Database connection test completed!');
  process.exit(0);
})
.catch(err => {
  console.error('❌ MongoDB Connection Failed:');
  console.error(`   Error: ${err.message}`);
  console.log('');
  console.log('💡 Troubleshooting:');
  console.log('   1. Check if MongoDB is running');
  console.log('   2. Verify MONGODB_URI in .env file');
  console.log('   3. Check network connectivity');
  console.log('   4. Ensure database credentials are correct');
  process.exit(1);
});
