const mongoose = require('mongoose');
const User = require('../models/User');
const Shop = require('../models/Shop');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find user
    const user = await User.findOne({ email: 'utsavparmar161@gmail.com' });
    if (!user) throw new Error('User not found');

    // Create new shop
    const shop = await Shop.create({
      name: 'ONE TO',
      phone: '0000000000',
      email: 'oneto@example.com',
      owner: user._id,
      address: { country: 'UK' },
      subscription: {
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      }
    });
    console.log('Shop created:', shop.name);

    // Assign shop to user
    user.shop = shop._id;
    await user.save();
    console.log('Shop assigned to user.');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
