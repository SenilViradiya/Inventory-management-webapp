const mongoose = require('mongoose');
require('dotenv').config();
const Category = require('../models/Category');
const Product = require('../models/Product');                             

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management';
  await mongoose.connect(MONGODB_URI);

  const argv = require('minimist')(process.argv.slice(2));
  const categoryId = argv.categoryId || '68b47995f0104c26161e9f6c';
  const categoryName = argv.categoryName || '';
  const search = argv.search || 'juice';

  try {
    // Find category
    let category = null;
    if (categoryId) category = await Category.findById(categoryId).lean();
    if (!category && categoryName) category = await Category.findOne({ name: { $regex: new RegExp(categoryName, 'i') } }).lean();

    if (!category) {
      console.log(JSON.stringify({ success: false, message: 'Category not found' }, null, 2));
      return;
    }

    // Build product query
    const categoryIds = [category._id];
    const query = {
      $or: [ { categoryId: { $in: categoryIds } }, { category: { $in: categoryIds } } ]
    };

    if (search) {
      query.$and = [
        { $or: [ { name: { $regex: new RegExp(search, 'i') } }, { brand: { $regex: new RegExp(search, 'i') } }, { qrCode: { $regex: new RegExp(search, 'i') } } ] },
        query
      ];
      delete query.$or;
    }

    const products = await Product.find(query)
      .select('name brand qrCode price stock quantity')
      .limit(500)
      .lean();

    const output = {
      success: true,
      category: { id: category._id, name: category.name },
      query: { categoryId: category._id, categoryName, search },
      count: products.length,
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        brand: p.brand,
        qrCode: p.qrCode,
        price: p.price,
        stock: {
          godown: p.stock?.godown || 0,
          store: p.stock?.store || 0,
          total: (p.stock && typeof p.stock.total !== 'undefined') ? p.stock.total : (p.quantity || 0),
          reserved: p.stock?.reserved || 0
        }
      }))
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
