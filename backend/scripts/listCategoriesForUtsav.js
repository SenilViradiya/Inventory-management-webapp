const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Shop = require('../models/Shop');
const Category = require('../models/Category');

async function listCategoriesForUtsav() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find user and shop
    const user = await User.findOne({ email: 'utsavparmar161@gmail.com' }).populate('shop');
    if (!user) throw new Error('User not found');
    if (!user.shop) throw new Error('User has no shop assigned');
    const shopId = user.shop._id;
    console.log('Found user and shop:', user.shop.name);

    // List all categories for this shop
    const categories = await Category.find({ shop: shopId });
    if (!categories.length) {
      console.log('No categories found for this shop.');
      return;
    }
    console.log(`Categories for shop '${user.shop.name}':`);
    categories.forEach(cat => {
      console.log(`- ${cat.name} | ID: ${cat._id}`);
    });
  } catch (error) {
    console.error('Error listing categories:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

listCategoriesForUtsav();
