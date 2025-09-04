const mongoose = require('mongoose');
require('dotenv').config();
const Category = require('../models/Category');
const Product = require('../models/Product');

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management';
  await mongoose.connect(MONGODB_URI);

  const argv = require('minimist')(process.argv.slice(2));
  const rawCategoryId = argv.categoryId || argv.c;
  const categoryName = argv.categoryName || argv.name || '';
  const search = argv.search || '';
  const includeSub = argv.includeSubcategories === 'true';

  try {
    let category;
    if (rawCategoryId) {
      // try find by id
      try {
        category = await Category.findById(rawCategoryId).lean();
      } catch (e) {
        // ignore
      }
    }

    if (!category && categoryName) {
      category = await Category.findOne({ name: { $regex: new RegExp(categoryName, 'i') } }).lean();
    }

    if (!category) {
      console.log(JSON.stringify({ success: false, message: 'Category not found' }, null, 2));
      return;
    }

    const categoryIds = [category._id.toString()];
    if (includeSub) {
      const subs = await Category.find({ parent: category._id }).select('_id').lean();
      subs.forEach(s => categoryIds.push(s._id.toString()));
    }

    // Build product query
    const orClauses = [ { categoryId: { $in: categoryIds } }, { category: { $in: categoryIds } } ];
    const finalQuery = { $or: orClauses };
    if (search) {
      finalQuery.$and = [ finalQuery.$or ? { $or: orClauses } : {}, { $or: [ { name: { $regex: new RegExp(search, 'i') } }, { brand: { $regex: new RegExp(search, 'i') } }, { qrCode: { $regex: new RegExp(search, 'i') } } ] } ];
      delete finalQuery.$or;
    }

    const products = await Product.find(finalQuery).lean();

    const mapped = products.map(p => ({
      productId: p._id,
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
    }));

    console.log(JSON.stringify({ success: true, category: { id: category._id, name: category.name }, count: mapped.length, products: mapped }, null, 2));

  } catch (err) {
    console.error('Error running script:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
