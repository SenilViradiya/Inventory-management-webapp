const mongoose = require('mongoose');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Role = require('../models/Role');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get superadmin role
    const superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) throw new Error('Superadmin role not found.');

    // Create superadmin user if not exists
    let user = await User.findOne({ email: 'utsavparmar161@gmail.com' });
    if (!user) {
      user = await User.create({
        firstName: 'Utsav',
        lastName: 'Best',
        username: 'utsav',
        email: 'utsavparmar161@gmail.com',
        password: 'admin123', // In production, hash this!
        role: superadminRole._id,
        createdAt: new Date(),
        isActive: true
      });
      console.log('Superadmin user created:', user.email);
    } else {
      console.log('Superadmin user already exists:', user.email);
    }

    // Create shop if not exists
    let shop = await Shop.findOne({ name: 'Best One' });
    if (!shop) {
      // Set subscription expiryDate to 1 year from now
      const now = new Date();
      const expiry = new Date(now);
      expiry.setFullYear(now.getFullYear() + 1);
      shop = await Shop.create({
        name: 'Best One',
        phone: '0000000000',
        email: 'bestone@example.com',
        owner: user._id,
        subscription: {
          plan: 'free',
          status: 'active',
          startDate: now,
          expiryDate: expiry
        }
      });
      console.log('Shop created:', shop.name);
    } else {
      console.log('Shop already exists:', shop.name);
    }

    // Assign shop to user if not already
    if (!user.shop || user.shop.toString() !== shop._id.toString()) {
      user.shop = shop._id;
      await user.save();
      console.log('Shop assigned to user.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
