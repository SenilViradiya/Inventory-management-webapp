const mongoose = require('mongoose');
require('dotenv').config();
const Category = require('../models/Category');

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management';
  await mongoose.connect(MONGODB_URI);

  const argv = require('minimist')(process.argv.slice(2));
  const categoryId = argv.categoryId || '68b47995f0104c26161e9f6c';
  const categoryName = argv.categoryName || 'Baby & Child Care';

  try {
    console.log('Searching for category by ID:', categoryId);
    const byId = await Category.findById(categoryId).lean();
    console.log('Result by ID:', byId);

    console.log('\nSearching for category by name (case-insensitive):', categoryName);
    const byName = await Category.find({ name: { $regex: new RegExp(categoryName, 'i') } }).lean();
    console.log('Results by name:', byName);
  } catch (err) {
    console.error('Error querying categories:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
