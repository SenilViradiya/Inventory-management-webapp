const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Shop = require('../models/Shop');

async function checkAndFixUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory');
    
    const user = await User.findOne({ email: 'admin@offlicense.com' });
    console.log('User found:', user ? 'Yes' : 'No');
    if (user) {
      console.log('User shop:', user.shop);
    }
    
    const shops = await Shop.find({}).limit(5);
    console.log('Available shops:', shops.length);
    shops.forEach(shop => {
      console.log('- ID:', shop._id, 'Name:', shop.name);
    });
    
    // Assign first shop to admin if no shop assigned
    if (user && !user.shop && shops.length > 0) {
      user.shop = shops[0]._id;
      await user.save();
      console.log('Assigned shop to admin user:', shops[0].name);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAndFixUser();
