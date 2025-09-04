// Script: migrateCategoryField.js
// Purpose: Backfill `categoryId` and `categoryName` on Product documents.
// Usage: node scripts/migrateCategoryField.js

const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management'
async function migrate() {
  await mongoose.connect(MONGO_URI ,
     { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB', MONGO_URI);

  const products = await Product.find({});
  console.log(`Found ${products.length} products`);

  let updated = 0;
  for (const p of products) {
    // If already has categoryName and categoryId (or at least categoryName), skip
    if (p.categoryName && (p.categoryId || p.categoryName)) continue;

    // Legacy field: some products may still have `category` key (string)
    // Mongoose model no longer has `category`, but raw docs may.
    const raw = p.toObject();
    const legacyCategory = raw.category || null; // if present

    let newCategoryId = null;
    let newCategoryName = p.categoryName || '';

    if (legacyCategory) {
      // If legacyCategory looks like an ObjectId, try to use it
      if (/^[0-9a-fA-F]{24}$/.test(legacyCategory)) {
        newCategoryId = legacyCategory;
        // try to fetch name from Category collection
        try {
          const cat = await Category.findById(newCategoryId).lean();
          if (cat && cat.name) newCategoryName = cat.name;
        } catch (e) {
          // ignore lookup errors
        }
      } else {
        // legacyCategory is a name string; try to find category by name
        const cat = await Category.findOne({ name: legacyCategory }).lean();
        if (cat) {
          newCategoryId = cat._id;
          newCategoryName = cat.name;
        } else {
          // Use the legacy string as categoryName
          newCategoryName = legacyCategory;
        }
      }
    }

    // If still no categoryName, leave as 'Uncategorized'
    if (!newCategoryName) newCategoryName = 'Uncategorized';

    const update = {
      categoryName: newCategoryName
    };
    if (newCategoryId) update.categoryId = newCategoryId;

    if (process.env.DRY_RUN === '1') {
      console.log('[DRY RUN] Would update product', p._id.toString(), update);
    } else {
      await Product.updateOne({ _id: p._id }, { $set: update });
      updated++;
    }
  }

  console.log(`Updated ${updated} products`);
  await mongoose.disconnect();
  console.log('Migration complete');
}

migrate().catch(err => {
  console.error('Migration error', err);
  process.exit(1);
});
