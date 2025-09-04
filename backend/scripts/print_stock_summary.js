    const mongoose = require('mongoose');
require('dotenv').config();

const Category = require('../models/Category');
const Product = require('../models/Product');

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management';
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  // Parameters (hardcoded from request) - can be overridden via argv
  const argv = require('minimist')(process.argv.slice(2));
  const categoryId = argv.categoryId || argv.c || '68b47995f0104c26161e9f6c';
  const categoryName = argv.categoryName || argv.name || 'Baby & Child Care';
  const search = argv.search || 'juice';
  const includeSubcategories = (argv.includeSubcategories === 'true');

  try {
    // Build category filter
    const categoryFilter = {};
    if (categoryId) categoryFilter._id = categoryId;
    else if (categoryName) categoryFilter.name = { $regex: new RegExp(categoryName, 'i') };

    const categories = await Category.find(categoryFilter).limit(50).lean();
    if (!categories || categories.length === 0) {
      console.log(JSON.stringify({ success: false, message: 'No categories found' }, null, 2));
      return process.exit(0);
    }

    const results = [];

    for (const category of categories) {
      let searchCategoryIds = [category._id];
      if (includeSubcategories) {
        const subs = await Category.find({ parent: category._id }).select('_id').lean();
        searchCategoryIds.push(...subs.map(s => s._id));
      }

      // Product filter
      const productQuery = {
        $or: [
          { categoryId: { $in: searchCategoryIds } },
          { category: { $in: searchCategoryIds } }
        ]
      };

      if (search) {
        productQuery.$and = [
          productQuery,
          {
            $or: [
              { name: { $regex: new RegExp(search, 'i') } },
              { brand: { $regex: new RegExp(search, 'i') } },
              { qrCode: { $regex: new RegExp(search, 'i') } }
            ]
          }
        ];
        delete productQuery.$or; // $and contains it
      }

      const products = await Product.find(productQuery).limit(200).lean();

      const productDetails = products.map(p => {
        const godown = (p.stock && p.stock.godown) || 0;
        const store = (p.stock && p.stock.store) || 0;
        const total = (p.stock && (typeof p.stock.total !== 'undefined' ? p.stock.total : null)) ?? (p.quantity || 0);
        const reserved = (p.stock && p.stock.reserved) || 0;
        return {
          productId: p._id,
          productName: p.name,
          brand: p.brand || '',
          qrCode: p.qrCode,
          price: p.price,
          stock: {
            godown,
            store,
            total,
            reserved,
            available: total - reserved
          }
        };
      });

      results.push({
        category: { id: category._id, name: category.name, description: category.description },
        products: productDetails
      });
    }

    console.log(JSON.stringify({ success: true, query: { categoryId, categoryName, search }, results }, null, 2));
  } catch (err) {
    console.error('Error in script:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
