const mongoose = require('mongoose');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Role = require('../models/Role'); // Import Role model
require('dotenv').config();

console.log('MONGO_URI:', process.env.MONGO_URI);

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventory-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Fetch the ObjectId for the superadmin role
    const superadminRole = await Role.findOne({ name: 'superadmin' });
    if (!superadminRole) {
      throw new Error('Superadmin role not found. Please ensure roles are seeded in the database.');
    }

    // Check if the user already exists
    let user = await User.findOne({ email: 'john.doe.kingfisher@example.com' });
    if (!user) {
      // Create Superadmin User
      user = await User.create({
        firstName: 'John',
        lastName: 'Doe',
        username: 'john.doe.kingfisher',
        email: 'john.doe.kingfisher@example.com',
        password: 'securepassword', // Replace with hashed password in production
        role: superadminRole._id, // Use the ObjectId of the superadmin role
        createdAt: new Date(),
      });

      console.log(`Superadmin created: ${user.email}`);
    } else {
      console.log(`Superadmin already exists: ${user.email}`);
    }

    // Create Kingfisher Shop London
    const shop = await Shop.create({
      name: 'Kingfisher Shop London',
      location: 'London',
      createdAt: new Date(),
      email: 'kingfisher.london@example.com', // Required field
      phone: '123-456-7890', // Required field
      owner: user._id, // Required field (linking to the superadmin user)
      subscription: {
        plan: 'premium', // Example subscription plan
        status: 'active',
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      }
    });

    console.log(`Shop created: ${shop.name}`);

    // Check if mock data should be added
    if (process.env.ADD_MOCK_DATA === 'true') {
      console.log('Adding mock data...');

      // Create Categories
      const category = await Category.create({
        name: 'Beverages',
        shop: shop._id
      });

      console.log(`Category created: ${category.name}`);

      // Create Products
      const product = await Product.create({
        name: 'Kingfisher Beer',
        price: 2.5,
        stock: {
          godown: 100,
          store: 50,
          total: 150
        },
        category: category._id,
        shop: shop._id,
        qrCode: 'KF12345',
        description: 'A refreshing beer.',
        createdAt: new Date()
      });

      console.log(`Product created: ${product.name}`);
    }

    console.log('Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
