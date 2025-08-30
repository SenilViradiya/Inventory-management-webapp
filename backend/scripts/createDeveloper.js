const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../models/User');
const Role = require('../models/Role');
const Shop = require('../models/Shop'); // Assuming you have a Shop model

// Connect to MongoDB using environment variable
// Set MONGODB_URI in .env file or use default localhost connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error:', err));

async function createDeveloperUser() {
  try {
    // First create or find the developer role
    let developerRole = await Role.findOne({ name: 'superadmin' });
    
    if (!developerRole) {
      developerRole = new Role({
        name: 'superadmin',
        permissions: [
          'view_inventory',
          'edit_inventory',
          'delete_inventory',
          'view_reports',
          'generate_reports',
          'manage_staff',
          'view_analytics',
          'manage_orders',
          'manage_suppliers',
          'manage_categories',
          'view_all_shops',
          'manage_subscriptions',
          'manage_inquiries'
        ],
        description: 'Developer with full system access'
      });
      await developerRole.save();
      console.log('Developer role created');
    }

    // Check if developer user already exists
    const existingDev = await User.findOne({ email: 'developer@admin.com' });
    if (existingDev) {
      console.log('Developer user already exists');
      return;
    }

    // Create developer user
    const hashedPassword = await bcrypt.hash('Dev@123456', 10);
    
    const developerUser = new User({
      username: 'developer',
      email: 'developer@admin.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Developer',
      role: developerRole._id,
      permissions: [
        'all:access',
        'business:create',
        'business:read',
        'business:update',
        'business:delete',
        'users:manage',
        'trial:extend',
        'system:admin'
      ],
      isEmailVerified: true
    });

    await developerUser.save();
    console.log('Developer user created successfully');
    console.log('Email: developer@admin.com');
    console.log('Password: Dev@123456');
    console.log('Role: developer (superadmin)');
    
  } catch (error) {
    console.error('Error creating developer user:', error);
  } finally {
    mongoose.connection.close();
  }
}

async function associateUserWithShop() {
  try {
    const userEmail = 'admin@offlicense.com'; // Email of the user to associate
    const shopId = 'YOUR_SHOP_ID'; // Replace with the actual shop ID

    // Find the user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log(`User with email ${userEmail} not found.`);
      return;
    }

    // Update the user's shopId
    user.shop = shopId;
    await user.save();

    console.log(`User ${userEmail} successfully associated with shop ID ${shopId}.`);
  } catch (error) {
    console.error('Error associating user with shop:', error);
  } finally {
    mongoose.connection.close();
  }
}

async function createShopAndAssignToUser() {
  try {
    const userEmail = 'admin@offlicense.com'; // Email of the user to associate

    // Find the user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log(`User with email ${userEmail} not found.`);
      return;
    }

    // Create a new shop
    const newShop = new Shop({
      name: 'New Shop',
      address: '123 Main Street',
      phone: '123-456-7890',
      email: 'shop@example.com',
      isActive: true,
      owner: user._id, // Assign the user as the owner
      subscription: {
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year from now
        isActive: true
      }
    });
    await newShop.save();
    console.log(`New shop created with ID: ${newShop._id}`);

    // Assign the new shop to the user
    user.shop = newShop._id;
    await user.save();

    console.log(`User ${userEmail} successfully assigned to shop ID ${newShop._id}.`);
  } catch (error) {
    console.error('Error creating shop and assigning to user:', error);
  } finally {
    mongoose.connection.close();
  }
}

createDeveloperUser();
associateUserWithShop();
createShopAndAssignToUser();
