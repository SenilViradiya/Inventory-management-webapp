const mongoose = require('mongoose');
const Category = require('../models/Category');
const Shop = require('../models/Shop');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventory-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Fetch the shop ID for Kingfisher Shop London
    const shop = await Shop.findOne({ name: 'Kingfisher Shop London' });
    if (!shop) {
      throw new Error('Shop not found. Please ensure the shop exists in the database.');
    }

    console.log(`Testing category hierarchy for shop: ${shop.name}`);

    // Test the getHierarchy method
    const hierarchy = await Category.getHierarchy(shop._id);
    console.log('Category Hierarchy:', JSON.stringify(hierarchy, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
